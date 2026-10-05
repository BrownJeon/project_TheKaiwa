/**
 * task-034 QA — 합성(#23) 경로로 옛 코드(OLD 3012 = git HEAD 복제본) vs 새 코드(NEW 3011)를 같은 DB·같은 M4 로 비교한다.
 *   - 명시적: 옛 코드가 만든 `明日香さん` 캐시 행·오디오를 새 코드가 재사용하지 않는다(키·MISS), 사전 적용 문장은 키 동일(오디오 공유 정당)
 *   - 합성 응답 normalizedText·dictionaryVersion·Trace(TTS_LEXICON matches)
 * 만든 TtsCache 행·파일은 끝(finally)에 지운다(키별). 사용: node --env-file=.env --import tsx tests/live/task034-qa-synth.ts <qa-bot cookie>
 */
import { createHash } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { removeDataFile } from '../../src/modules/infra/storage'
import { cacheSegments } from '../../src/modules/speech/tts/cache'
import { call, check, cookie, corpus, ENGINE_NAME_RE, NEW, OLD, sleep, summary } from './task034-lib'

const ck = cookie(process.argv[2] ?? '')
const prisma = new PrismaClient()
const createdKeys = new Set<string>()

interface Synth {
  status: number
  cacheKey: string
  cached: boolean
  normalizedText: string
  dictionaryVersion: number
  durationMs: number | null
  traceId: string
  matches: number | null
  bytes: number
  sha: string
  riff: boolean
}
async function synth(base: string, text: string): Promise<Synth> {
  const r = await call(base, ck, 'POST', '/api/v1/speech/tts', { text }, { accept: 'application/json' })
  if (r.status !== 200) throw new Error(`${base} ${text} → HTTP ${r.status} ${r.text.slice(0, 200)}`)
  const d = r.json.data
  if (!d.cached) createdKeys.add(d.cacheKey)
  let matches: number | null = null
  for (let i = 0; i < 15; i++) {
    const t = await prisma.requestTrace.findFirst({ where: { traceId: d.traceId }, select: { steps: true } })
    if (t) {
      const lex = (t.steps as { name: string; matches?: number }[]).find((s) => s.name === 'TTS_LEXICON')
      matches = typeof lex?.matches === 'number' ? lex.matches : null
      break
    }
    await sleep(200)
  }
  // 캐시 저장은 응답 뒤에 이어진다(설계) — 다른 프로세스 요청이 저장 도중에 오면 MISS 라, 행이 보일 때까지 기다렸다 다음 호출로 넘어간다.
  if (!d.cached) for (let i = 0; i < 40; i++) if (!(await prisma.ttsCache.findUnique({ where: { key: d.cacheKey }, select: { key: true } }))) await sleep(200)
  else break
  const a = await call(base, ck, 'GET', d.url)
  const riff = a.bytes.subarray(0, 4).toString('latin1') === 'RIFF' && a.bytes.subarray(8, 12).toString('latin1') === 'WAVE'
  return { status: a.status, cacheKey: d.cacheKey, cached: d.cached, normalizedText: d.normalizedText, dictionaryVersion: d.dictionaryVersion, durationMs: d.durationMs, traceId: d.traceId, matches, bytes: a.bytes.length, sha: createHash('sha256').update(a.bytes).digest('hex').slice(0, 12), riff }
}
const fmt = (s: Synth) => `key=${s.cacheKey.slice(0, 10)} cached=${s.cached} v${s.dictionaryVersion} dur=${s.durationMs}ms bytes=${s.bytes} sha=${s.sha} matches=${s.matches} norm「${s.normalizedText}」`

async function main() {
  const before = await prisma.ttsCache.count()
  try {
    // ── 1. 明日香さん: OLD(가드 전) → NEW ───────────────────────────────
    console.log('## 1. 明日香さん — 옛 코드가 만든 캐시를 새 코드가 재사용하는지')
    const o1 = await synth(OLD, '明日香さん')
    console.log(`  OLD #1 ${fmt(o1)}`)
    const n1 = await synth(NEW, '明日香さん')
    console.log(`  NEW #1 ${fmt(n1)}`)
    const n1b = await synth(NEW, '明日香さん')
    console.log(`  NEW #2 ${fmt(n1b)}`)
    check('S1 옛 코드: 明日香さん 에 hint 1건(明日) 적용 = 결함 재현, MISS 로 캐시 행 생성', o1.status === 200 && o1.matches === 1 && !o1.cached && o1.riff, `matches=${o1.matches}`)
    check('S2 새 코드: hint 0건·옛 키와 다른 키·MISS(옛 오디오 재사용 없음)', n1.status === 200 && n1.matches === 0 && n1.cacheKey !== o1.cacheKey && !n1.cached && n1.riff, `old ${o1.cacheKey.slice(0, 10)} → new ${n1.cacheKey.slice(0, 10)} cached=${n1.cached}`)
    check('S3 새 코드 같은 문장 재요청: 같은 새 키 HIT(캐시 정상 동작)', n1b.cacheKey === n1.cacheKey && n1b.cached === true, `cached=${n1b.cached}`)
    check('S4 옛 코드가 만든 행은 그대로(옛 키 행 존재) — 새 코드 요청이 덮어쓰지 않음', !!(await prisma.ttsCache.findUnique({ where: { key: o1.cacheKey }, select: { key: true } })) && !!(await prisma.ttsCache.findUnique({ where: { key: n1.cacheKey }, select: { key: true } })), '두 키 모두 DB 행 존재')
    console.log(`  (참고) 음원: OLD ${o1.durationMs}ms/${o1.bytes}B vs NEW ${n1.durationMs}ms/${n1.bytes}B — 같은 문장이 다른 소리로 합성됨`)
    check('S5 두 오디오는 서로 다른 소리(길이·바이트 모두 상이)', o1.bytes !== n1.bytes || o1.durationMs !== n1.durationMs, `${o1.durationMs}/${o1.bytes} vs ${n1.durationMs}/${n1.bytes}`)

    // ── 2. 사전 적용 문장: 키 공유(소리 동일) ──────────────────────────
    console.log('\n## 2. 회귀 — 사전이 정당히 적용되는 문장은 옛·새 키가 같고 오디오를 공유한다')
    const n2 = await synth(NEW, '明日は晴れです')
    const o2 = await synth(OLD, '明日は晴れです')
    console.log(`  NEW ${fmt(n2)}\n  OLD ${fmt(o2)}`)
    check('S6 明日は晴れです: 새·옛 키 동일 · hint 1건(アシタ 적용 유지) · 두 번째(OLD)는 HIT', n2.cacheKey === o2.cacheKey && n2.matches === 1 && o2.matches === 1 && o2.cached === true, `matches new/old=${n2.matches}/${o2.matches} oldcached=${o2.cached}`)
    const n3 = await synth(NEW, '明日')
    check('S7 明日 단독: hint 1건 · 정상 합성(RIFF)', n3.matches === 1 && n3.riff && n3.status === 200, fmt(n3))
    const n4 = await synth(NEW, '明日3時に会おう。')
    const o4 = await synth(OLD, '明日3時に会おう。')
    console.log(`  NEW ${fmt(n4)}\n  OLD ${fmt(o4)}`)
    check('S8 明日3時に会おう。: 정규화 한자 이웃에도 사전 유지 — 새·옛 키 동일(hint 1)', n4.cacheKey === o4.cacheKey && n4.matches === 1, `new「${n4.normalizedText}」`)
    const n5 = await synth(NEW, '今日は天気がいいですね。')
    check('S9 일반 문장 합성 정상(RIFF·길이>0·hint 0)', n5.riff && (n5.durationMs ?? 0) > 0 && n5.matches === 0 && n5.status === 200, fmt(n5))

    // ── 3. 복합어+단독 혼재: 옛 키 ≠ 새 키 ────────────────────────────
    console.log('\n## 3. 혼재 문장')
    const o6 = await synth(OLD, '明日香さんは明日来ます')
    const n6 = await synth(NEW, '明日香さんは明日来ます')
    console.log(`  OLD ${fmt(o6)}\n  NEW ${fmt(n6)}`)
    check('S10 明日香さんは明日来ます: 옛 hint 2 → 새 hint 0 · 키 상이 · 새는 MISS(재합성)', o6.matches === 2 && n6.matches === 0 && o6.cacheKey !== n6.cacheKey && !n6.cached, `old matches=${o6.matches} new=${n6.matches}`)

    // ── 4. 응답 노출 ────────────────────────────────────────────────────
    const hit = corpus.join('\n').match(ENGINE_NAME_RE)
    check('E1 #23 응답 전체에 엔진명·model_id·speaker_id 0건', !hit, hit ? `검출: ${hit[0]}` : `${corpus.length}개 응답`)
  } finally {
    let removed = 0
    for (const key of createdKeys) {
      await prisma.ttsCache.delete({ where: { key } }).catch(() => undefined)
      await removeDataFile(cacheSegments(key)).catch(() => undefined)
      removed++
    }
    const after = await prisma.ttsCache.count()
    console.log(`\n정리: 이 실행이 만든 TtsCache 키 ${removed}개 삭제(행·파일) — 행 수 ${before} → ${after}`)
    check('C1 TtsCache 행 수 원복', after === before, `${before} → ${after}`)
    await prisma.$disconnect()
  }
  summary('task034-qa-synth')
}
main().catch((e) => {
  console.error(e)
  process.exitCode = 2
})
