/**
 * task-012b-3 TTS 캐시 정리·예열 후보(speech-platform/16 §11.2) + Trace `voiceId` 허용 키(목소리별 지표 원천).
 * DB 없이 메모리 저장소로 돈다. 실제 파일 삭제 경로는 임시 DATA_ROOT 에서만.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeDataFile } from '@/modules/infra'
import {
  cacheSegments,
  missingCacheKeys,
  planCachePrune,
  planWarmupCandidates,
  prismaCachePruneStore,
  pruneTtsCache,
  TTS_CACHE_MAX_BYTES_DEFAULT,
  TTS_CACHE_PROTECT_MS,
  TTS_WARMUP_PROFILES,
  TTS_WARMUP_SENTENCES_DEFAULT,
  type CacheEntryLite,
  type CachePruneStore,
} from '../tts/cache'
import { TTS_AUDIO_URL_TTL_SEC } from '../tts/audioUrl'
import { synthSteps, ttsStep } from '../tts/metrics'

const NOW = new Date('2026-10-06T03:00:00Z')
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000)
const k = (c: string) => c.repeat(40)
const entry = (key: string, bytes: number, lastHitMinAgo: number | null, createdMinAgo = 10_000): CacheEntryLite => ({ key, bytes, lastHitAt: lastHitMinAgo === null ? null : ago(lastHitMinAgo), createdAt: ago(createdMinAgo) })

test('기본값 — 상한 2GB, 보호 창은 서명 URL 수명보다 길다, 예열 = 16 §11.2 문장 × {NATIVE, LEARNING_SLOW}', () => {
  assert.equal(TTS_CACHE_MAX_BYTES_DEFAULT, 2 * 1024 ** 3)
  assert.ok(TTS_CACHE_PROTECT_MS > TTS_AUDIO_URL_TTL_SEC * 1000)
  assert.deepEqual([...TTS_WARMUP_PROFILES], ['NATIVE', 'LEARNING_SLOW'])
  assert.equal(TTS_WARMUP_SENTENCES_DEFAULT.length, 3)
})

test('정리 계획 — 상한 이하면 0건, 넘으면 마지막 사용(max(lastHitAt, createdAt))이 오래된 것부터, 남은 크기 ≤ 상한', () => {
  const rows = [entry(k('a'), 100, 60), entry(k('b'), 100, null, 300), entry(k('c'), 100, 30), entry(k('d'), 100, 5000)]
  assert.equal(planCachePrune(rows, { maxBytes: 400, now: NOW }).remove.length, 0)
  const p = planCachePrune(rows, { maxBytes: 250, now: NOW })
  // 마지막 사용: d 5000분 · b 300분(히트 없음 → 생성 시각) · a 60분 · c 30분
  assert.deepEqual(p.remove.map((r) => r.key[0]), ['d', 'b'])
  assert.equal(p.remainingBytes, 200)
  assert.ok(p.remainingBytes <= p.maxBytes)
  assert.equal(p.reachable, true)
})

test('정리 계획 — 보호 창(15분) 안·미래 시각 항목은 지우지 않고, 그것만으로 상한을 넘으면 reachable=false', () => {
  const rows = [entry(k('a'), 100, 1), entry(k('b'), 100, 14), entry(k('c'), 100, -5), entry(k('d'), 100, 16)]
  const p = planCachePrune(rows, { maxBytes: 100, now: NOW })
  assert.deepEqual(p.remove.map((r) => r.key[0]), ['d'])
  assert.equal(p.protectedCount, 3)
  assert.equal(p.remainingBytes, 300)
  assert.equal(p.reachable, false)
  // 막 만든 항목(히트 없음, 생성 1분 전)도 보호
  assert.equal(planCachePrune([entry(k('e'), 500, null, 1)], { maxBytes: 0, now: NOW }).remove.length, 0)
})

class MemPruneStore implements CachePruneStore {
  rows: CacheEntryLite[]
  files = new Set<string>()
  failFile = new Set<string>()
  touchedBeforeDelete = new Set<string>()
  constructor(rows: CacheEntryLite[]) {
    this.rows = rows.map((r) => ({ ...r }))
    for (const r of rows) this.files.add(r.key)
  }
  async listEntries(limit: number) {
    return this.rows.slice(0, limit).map((r) => ({ ...r }))
  }
  async deleteRowIfUnchanged(e: CacheEntryLite) {
    const i = this.rows.findIndex((r) => r.key === e.key)
    if (i < 0) return false
    if (this.touchedBeforeDelete.has(e.key)) this.rows[i].lastHitAt = NOW
    if ((this.rows[i].lastHitAt?.getTime() ?? null) !== (e.lastHitAt?.getTime() ?? null)) return false
    this.rows.splice(i, 1)
    return true
  }
  async removeFile(key: string) {
    cacheSegments(key)
    if (this.failFile.has(key)) throw new Error('EIO')
    this.files.delete(key)
  }
}

test('정리 실행 — 행 조건부 삭제 → 파일 삭제, 그 사이 히트가 오른 항목은 남김, 파일 실패는 따로 셈, dryRun 은 아무것도 지우지 않음', async () => {
  const rows = [entry(k('a'), 100, 600), entry(k('b'), 100, 500), entry(k('c'), 100, 400), entry(k('d'), 100, 1)]
  const dry = new MemPruneStore(rows)
  const d = await pruneTtsCache({ maxBytes: 150, now: NOW, dryRun: true, store: dry })
  assert.equal(d.planned, 3)
  assert.equal(d.deleted, 0)
  assert.equal(dry.rows.length, 4)

  const s = new MemPruneStore(rows)
  s.touchedBeforeDelete.add(k('b'))
  s.failFile.add(k('c'))
  const r = await pruneTtsCache({ dryRun: false, maxBytes: 150, now: NOW, store: s })
  assert.equal(r.dryRun, false)
  assert.equal(r.planned, 3)
  assert.equal(r.deleted, 2) // a, c(행)
  assert.equal(r.skippedChanged, 1) // b
  assert.equal(r.fileErrors, 1) // c 파일
  assert.equal(r.freedBytes, 100)
  assert.equal(r.remainingBytes, 300)
  assert.equal(r.reachable, false)
  assert.deepEqual(s.rows.map((x) => x.key[0]).sort(), ['b', 'd'])
  assert.ok(!s.files.has(k('a')))
  assert.ok(s.files.has(k('c')))
})

test('REV-119 M-2 — 기본은 dryRun(지우지 않음), 실제 삭제는 dryRun:false 리터럴 + store 명시가 둘 다 있어야 한다', async () => {
  const rows = [entry(k('a'), 100, 600), entry(k('b'), 100, 500), entry(k('c'), 100, 400)]
  // dryRun 을 적지 않으면 계획만 — 행·파일 그대로
  const s = new MemPruneStore(rows)
  const d = await pruneTtsCache({ maxBytes: 0, now: NOW, store: s })
  assert.equal(d.dryRun, true)
  assert.equal(d.planned, 3)
  assert.equal(d.deleted, 0)
  assert.equal(d.freedBytes, 0)
  assert.equal(s.rows.length, 3)
  assert.equal(s.files.size, 3)
  // false 리터럴이 아닌 값(0·'false'·null)도 지우지 않는다
  for (const loose of [0, 'false', null]) {
    const r = await pruneTtsCache({ maxBytes: 0, now: NOW, store: s, dryRun: loose } as never)
    assert.equal(r.dryRun, true, String(loose))
    assert.equal(r.deleted, 0)
  }
  assert.equal(s.rows.length, 3)
  // 실제 삭제인데 범위(store)가 없으면 표 전체(운영 포함)로 가지 않고 DB 를 읽기 전에 거절한다
  // @ts-expect-error — 타입에서도 막힌다(dryRun:false 는 store 필수)
  await assert.rejects(pruneTtsCache({ dryRun: false, maxBytes: 0, now: NOW }), /store/)
  const r = await pruneTtsCache({ dryRun: false, maxBytes: 0, now: NOW, store: s })
  assert.equal(r.deleted, 3)
  assert.equal(s.rows.length, 0)
})

test('REV-119 M-2 — src/(테스트 제외)에 pruneTtsCache 호출·import·재export 가 없다(실행 진입점 0), 실삭제 함수는 pruneTtsCache 안에서 한 번만 불린다', () => {
  const root = join(process.cwd(), 'src')
  const files: string[] = []
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name !== '__tests__' && e.name !== 'node_modules') walk(p)
      } else if (/\.(ts|tsx|js|mjs)$/.test(e.name) && !/\.test\.(ts|tsx|js|mjs)$/.test(e.name)) files.push(p)
    }
  }
  walk(root)
  const cachePath = join(root, 'modules/speech/tts/cache.ts')
  assert.ok(files.includes(cachePath))
  assert.ok(files.length > 100, `스캔 파일 수 ${files.length}`)
  const others = files.filter((f) => f !== cachePath && readFileSync(f, 'utf8').includes('pruneTtsCache'))
  assert.deepEqual(others, [])
  const src = readFileSync(cachePath, 'utf8')
  // cache.ts 안에서도 정의 말고는 호출이 없다
  assert.equal([...src.matchAll(/\bpruneTtsCache\s*\(/g)].length, [...src.matchAll(/function pruneTtsCache\s*\(/g)].length)
  assert.equal([...src.matchAll(/\bdeleteFromSharedCacheIncludingProduction\s*\(/g)].length, 2) // 정의 1 + 호출 1
  assert.ok(!/export\s+(async\s+)?function\s+deleteFromSharedCacheIncludingProduction/.test(src))
})

test('정리 실행 — 형식이 틀린 키는 파일을 건드리지 않고 행만 지운다 / 실제 저장소의 파일 경로는 키에서만 만든다(DATA_ROOT 밖 불가)', async () => {
  const s = new MemPruneStore([entry('../../etc/passwd', 100, 600), entry(k('a'), 100, 600)])
  let fileCalls = 0
  const orig = s.removeFile.bind(s)
  s.removeFile = async (key: string) => {
    fileCalls++
    return orig(key)
  }
  const r = await pruneTtsCache({ dryRun: false, maxBytes: 0, now: NOW, store: s })
  assert.equal(r.deleted, 2)
  assert.equal(fileCalls, 1)
  await assert.rejects(prismaCachePruneStore.removeFile('../../etc/passwd'), /잘못된 캐시 키/)
})

test('정리 실행 — 실제 파일 삭제는 DATA_ROOT/tts-cache/<앞 2자>/<키>.wav 만', async () => {
  const root = mkdtempSync(join(tmpdir(), 'kaiwa-012b3-'))
  const saved = process.env.DATA_ROOT
  process.env.DATA_ROOT = root
  try {
    const key = k('e')
    await writeDataFile(cacheSegments(key), Buffer.from('RIFF'))
    const p = join(root, 'tts-cache', 'ee', `${key}.wav`)
    assert.ok(existsSync(p))
    await prismaCachePruneStore.removeFile(key)
    assert.ok(!existsSync(p))
  } finally {
    if (saved === undefined) delete process.env.DATA_ROOT
    else process.env.DATA_ROOT = saved
    rmSync(root, { recursive: true, force: true })
  }
})

test('예열 후보 — 목소리 × 프로필 × 문장, 중복·빈 문장·100자 초과·이상한 id 제외, 상한', () => {
  const c = planWarmupCandidates({ voiceIds: ['teacher_a', 'teacher_a', 'bad id', 'teacher_b'], sentences: ['おはようございます。', ' おはようございます。 ', '', 'あ'.repeat(101)] })
  assert.deepEqual(c, [
    { text: 'おはようございます。', voiceId: 'teacher_a', speechProfile: 'NATIVE' },
    { text: 'おはようございます。', voiceId: 'teacher_a', speechProfile: 'LEARNING_SLOW' },
    { text: 'おはようございます。', voiceId: 'teacher_b', speechProfile: 'NATIVE' },
    { text: 'おはようございます。', voiceId: 'teacher_b', speechProfile: 'LEARNING_SLOW' },
  ])
  assert.equal(planWarmupCandidates({ voiceIds: ['v1', 'v2'] }).length, 2 * 2 * 3)
  assert.equal(planWarmupCandidates({ voiceIds: ['v1', 'v2'], max: 5 }).length, 5)
})

test('예열 — 캐시에 없는 키만(형식이 틀린 키는 뺀다)', async () => {
  const have = new Set([k('a')])
  let asked: string[] = []
  const db = {
    ttsCache: {
      findMany: async (a: { where: { key: { in: string[] } } }) => {
        asked = a.where.key.in
        return a.where.key.in.filter((x) => have.has(x)).map((key) => ({ key }))
      },
    },
  }
  assert.deepEqual(await missingCacheKeys([k('a'), k('b'), k('b'), 'nope'], db), [k('b')])
  assert.deepEqual(asked, [k('a'), k('b')])
  assert.deepEqual(await missingCacheKeys(['nope'], db), [])
})

test('Trace 허용 키 — TTS_SYNTH 는 voiceId(Voice Profile id)를 싣고 다른 단계는 버린다, synthSteps 도 voiceId 를 싣는다', () => {
  assert.equal(ttsStep('TTS_SYNTH[1]', 5, { voiceId: 'teacher_haruka', connectionKey: 'tts-main' }).voiceId, 'teacher_haruka')
  assert.equal(ttsStep('TTS_PLAN', 5, { voiceId: 'teacher_haruka' } as never).voiceId, undefined)
  assert.equal(ttsStep('TTS', 5, { voiceId: 'teacher_haruka' } as never).voiceId, undefined)
  // 안전 문자열 규칙 그대로(공백·한자 등은 버린다)
  assert.equal(ttsStep('TTS_SYNTH[0]', 5, { voiceId: '春香 voice' }).voiceId, undefined)
  const out = { audio: Buffer.alloc(10), metrics: { httpMs: 100, synthMs: 80, queueMs: null, encodeMs: null, audioMs: 1000, modelLoaded: 'hit' as const } }
  const steps = synthSteps(out, { connectionKey: 'tts-main', modelVersion: '1.0.0', ms: 120, durationMs: 1000, chunkIndex: 0, voiceId: 'teacher_haruka' })
  assert.equal(steps.find((s) => s.name === 'TTS_SYNTH[0]')!.voiceId, 'teacher_haruka')
  assert.equal(synthSteps(out, { connectionKey: 'tts-main', modelVersion: '1.0.0', ms: 120, durationMs: 1000 }).find((s) => s.name === 'TTS_SYNTH[0]')!.voiceId, undefined)
})

test('합성 경로 — synthesize.ts 의 TTS_SYNTH 단계 5곳(HIT·SKIPPED·합류·MISS·실패) 전부 voiceId: voice.id(Voice Profile id)를 싣는다', () => {
  const src = readFileSync(join(process.cwd(), 'src/modules/speech/tts/synthesize.ts'), 'utf8')
  const calls = [...src.matchAll(/ttsStep\(synthName,[^\n]*/g), ...src.matchAll(/synthSteps\(out,[^\n]*/g)].map((m) => m[0])
  assert.equal(calls.length, 5)
  for (const c of calls) assert.ok(c.includes('voiceId: voice.id'), c.slice(0, 80))
  // 엔진 쪽 식별자(모델 id·speaker id)는 단계에 싣지 않는다.
  for (const c of calls) assert.ok(!/voiceModelId|speakerId/.test(c), c.slice(0, 80))
})
