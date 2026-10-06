/**
 * TTS Audio Cache(speech-platform/16 §11, P0) — `DATA_ROOT/tts-cache/<키 앞 2자>/<키>.wav` + `TtsCache` 행.
 *
 * 키 = sha1(12요소, 청크 단위, §155·api-contract #23 순서):
 *   normalizedText | voiceProfileId | modelVersion | dictionaryVersion | speechProfile | style | styleWeight | speed | pitch | intonation | engineConnectionKey | textVersion
 * - 수치는 세그먼트 **유효값**(§4.3 배율 적용 후)을 소수 3자리 고정 문자열로 넣는다(0.8 과 0.80000001 이 갈리지 않게).
 * - 요소들을 `|` 로 이어 붙이지 않고 JSON 배열로 직렬화해 해시한다 — 텍스트 안의 `|` 로 요소 경계가 흐려지는 충돌을 막는다.
 * - 사전 요소는 `dictionaryVersion` 에 **적용된 힌트 요약(lexiconDigest)** 을 덧붙인다. 버전이 같아도 범위(USER·LESSON·COURSE)가
 *   달라 다른 읽기가 적용된 요청끼리 오디오가 섞이지 않게 하기 위함(정본 12요소의 "사전 버전" 요소를 세분한 것 — 요소 수는 그대로).
 * - 파일 경로는 **키(16진 40자)만**으로 만든다. 사용자 입력은 경로에 들어가지 않고, 조회 때도 DB 의 path 를 믿지 않고 키에서 다시 만든다.
 * 오디오 조회 URL(#24)은 서명 URL(`audioUrl.ts`, task-007). 용량 정리·예열 후보는 아래 "P1"(task-012b-3, 16 §11.2).
 */
import { createHash } from 'node:crypto'
import { Prisma, type SpeechProfile } from '@prisma/client'
import { prisma, readDataFile, removeDataFile, writeDataFile } from '@/modules/infra'
import { parseStoredTiming, type StoredTiming } from './timing'

export const TTS_CACHE_DIR = 'tts-cache'
/** 합성 경로(#23) 텍스트 버전 — 정규화 규칙 변경은 normalizedText 가 바뀌어 자연히 갈리므로 올릴 일이 드물다. */
export const TTS_TEXT_VERSION = 1

const KEY_RE = /^[0-9a-f]{40}$/

export interface CacheKeyParts {
  normalizedText: string
  voiceProfileId: string
  modelVersion: string
  dictionaryVersion: number
  lexiconDigest: string | null
  speechProfile: SpeechProfile
  style: string
  styleWeight: number
  speed: number
  pitch: number
  intonation: number
  engineConnectionKey: string
  textVersion: number
}

const f3 = (n: number) => n.toFixed(3)

export function ttsCacheKey(p: CacheKeyParts): string {
  const elements = [
    p.normalizedText,
    p.voiceProfileId,
    p.modelVersion,
    p.lexiconDigest ? `${p.dictionaryVersion}:${p.lexiconDigest}` : String(p.dictionaryVersion),
    p.speechProfile,
    p.style,
    f3(p.styleWeight),
    f3(p.speed),
    f3(p.pitch),
    f3(p.intonation),
    p.engineConnectionKey,
    String(p.textVersion),
  ]
  return createHash('sha1').update(JSON.stringify(elements)).digest('hex')
}

export function isCacheKey(v: unknown): v is string {
  return typeof v === 'string' && KEY_RE.test(v)
}

/** DATA_ROOT 기준 경로 조각 — 키 형식이 아니면 throw(경로 탈출 차단). */
export function cacheSegments(key: string): [string, string, string] {
  if (!isCacheKey(key)) throw new Error('잘못된 캐시 키')
  return [TTS_CACHE_DIR, key.slice(0, 2), `${key}.wav`]
}

export interface CachedAudio {
  audio: Buffer
  durationMs: number | null
  /** #24 응답 헤더용(task-007). 합성 직후 값에는 없다. */
  modelVersion?: string
  dictionaryVersion?: number
  /** 단어 timing(정규화 글 좌표, task-012b-4). 012b-4 이전 행·모르는 형식은 null. */
  timing?: StoredTiming | null
}

/** HIT 면 파일을 읽고 hits·lastHitAt 을 올린다. 행은 있는데 파일이 없으면 행을 지우고 MISS. */
export async function readCachedAudio(key: string): Promise<CachedAudio | null> {
  const segs = cacheSegments(key)
  const row = await prisma.ttsCache.findUnique({ where: { key }, select: { durationMs: true, modelVersion: true, dictionaryVersion: true, timing: true, timingVersion: true } })
  if (!row) return null
  const audio = await readDataFile(segs)
  if (!audio) {
    await prisma.ttsCache.delete({ where: { key } }).catch(() => undefined)
    return null
  }
  void prisma.ttsCache.update({ where: { key }, data: { hits: { increment: 1 }, lastHitAt: new Date() } }).catch(() => undefined)
  return { audio, durationMs: row.durationMs, modelVersion: row.modelVersion, dictionaryVersion: row.dictionaryVersion, timing: parseStoredTiming(row.timing, row.timingVersion) }
}

/**
 * timing 칸 — create·update 에 **같이** 싣는다(task-012b-4). update 는 같은 키를 다시 합성해 wav 파일을 덮어쓴 경우라
 * (다른 프로세스와 경합) timing 도 그 오디오 것으로 바꿔야 한다. 이번 합성에 timing 이 없으면 옛 값을 지운다(DbNull) —
 * 다른 오디오의 timing 이 남아 어긋나는 것보다 없는 편이 낫다.
 */
export function timingColumns(timing: StoredTiming | null): { timing: Prisma.InputJsonValue | typeof Prisma.DbNull; timingVersion: string | null } {
  if (!timing) return { timing: Prisma.DbNull, timingVersion: null }
  return { timing: JSON.parse(JSON.stringify(timing)) as Prisma.InputJsonValue, timingVersion: timing.alignerVersion }
}

/** `storeCachedAudio` 의 upsert 인자(순수 — 테스트가 create·update 칸을 본다). */
export function ttsCacheUpsertArgs(key: string, parts: CacheKeyParts, audio: Buffer, durationMs: number | null, timing: StoredTiming | null) {
  const segs = cacheSegments(key)
  const t = timingColumns(timing)
  const data = {
    voiceProfileId: parts.voiceProfileId,
    normalizedText: parts.normalizedText.slice(0, 200),
    modelVersion: parts.modelVersion.slice(0, 20),
    dictionaryVersion: parts.dictionaryVersion,
    speechProfile: parts.speechProfile,
    style: parts.style.slice(0, 40),
    styleWeight: parts.styleWeight,
    speed: parts.speed,
    pitch: parts.pitch,
    intonation: parts.intonation,
    engineConnectionKey: parts.engineConnectionKey.slice(0, 80),
    textVersion: parts.textVersion,
    textHash: createHash('sha1').update(parts.normalizedText).digest('hex'),
    path: segs.join('/'),
    bytes: audio.length,
    durationMs,
    ...t,
  }
  return { where: { key }, create: { key, ...data }, update: { bytes: data.bytes, durationMs, path: data.path, ...t } }
}

export async function storeCachedAudio(key: string, parts: CacheKeyParts, audio: Buffer, durationMs: number | null, timing: StoredTiming | null = null): Promise<void> {
  const segs = cacheSegments(key)
  await writeDataFile(segs, audio)
  try {
    await prisma.ttsCache.upsert(ttsCacheUpsertArgs(key, parts, audio, durationMs, timing))
  } catch (e) {
    // 다른 프로세스가 같은 키를 먼저 넣었다(같은 입력 → 같은 오디오) — 그 행이 이 파일을 가리키므로 그대로 둔다.
    if ((e as { code?: string }).code === 'P2002') return
    // 행을 못 남기면 파일도 치운다 — 행 없는 파일은 조회 경로가 닿지 않는 쓰레기가 된다.
    await removeDataFile(segs).catch(() => undefined)
    throw e
  }
}

// ── P1 용량 정리 · 예열 후보(task-012b-3, speech-platform/16 §11.2) ────────────────────────────────
// 실행 진입점(관리자 액션·스케줄)은 아직 없다 — 이 task 는 계획·실행 함수만 둔다. 예열 합성(M4 부하)은 호출하지 않는다.
// TtsCache 에는 환경 칸이 없고 DATA_ROOT 도 개발·운영이 같다 → 정리는 **모든 환경의 캐시**에 닿는다(개발 미러에서 불러도 운영 캐시가 지워진다).
// 그래서 `pruneTtsCache` 는 기본이 dryRun(계획만)이고, 실제 삭제는 `dryRun: false` + 범위를 정하는 `store` 를 둘 다 명시해야 한다(REV-119 M-2).
// `src/`(테스트 제외)에 호출이 없다는 것은 speech/__tests__/task012b3Cache.test.ts 소스 스캔이 고정한다 — 진입점을 열 때 환경 칸 문제부터 다시 정할 것.

/** 상한 기본값 2GB(16 §11.2 `tts.cache.maxBytes` 기본). 그 AppSetting 키는 아직 seed 에 없다 — 올리려면 seed + ConfigurationVersion·감사 규칙. */
export const TTS_CACHE_MAX_BYTES_DEFAULT = 2 * 1024 ** 3
/** 최근 쓴 항목 보호 창 — 서명 URL(#24, 600초) 동안 재생·재요청이 올 수 있고, 막 저장된 행도 여기에 든다. URL 수명보다 길게 둔다. */
export const TTS_CACHE_PROTECT_MS = 15 * 60_000
/** 한 번에 읽는 행 상한(2GB ÷ 청크 평균 수십 KB ≈ 수만 행보다 넉넉히). 넘으면 `truncated`. */
export const TTS_CACHE_PRUNE_MAX_ROWS = 200_000

export interface CacheEntryLite {
  key: string
  bytes: number
  lastHitAt: Date | null
  createdAt: Date
}

export interface CachePrunePlan {
  totalBytes: number
  maxBytes: number
  /** 지울 순서(가장 오래 안 쓴 것부터). */
  remove: CacheEntryLite[]
  remainingBytes: number
  /** 보호 창 안이라 건너뛴 항목 수(상한을 넘은 상태에서 지울 차례였던 것만 센다). */
  protectedCount: number
  /** 지운 뒤 상한 이하가 되는가 — 보호 항목만으로 상한을 넘으면 false. */
  reachable: boolean
}

/** 마지막 사용 = max(lastHitAt, createdAt). 히트가 없던 항목은 만든 시각이 마지막 사용이다. */
function lastUse(e: CacheEntryLite): number {
  return Math.max(e.createdAt.getTime(), e.lastHitAt ? e.lastHitAt.getTime() : 0)
}

/** LRU 정리 계획(순수). 총량 ≤ 상한이면 아무것도 지우지 않는다. 마지막 사용이 보호 창 안(또는 미래 시각)인 항목은 지우지 않는다. */
export function planCachePrune(rows: readonly CacheEntryLite[], opts: { maxBytes: number; now: Date; protectMs?: number }): CachePrunePlan {
  const maxBytes = Math.max(0, Math.floor(opts.maxBytes))
  const protectMs = opts.protectMs ?? TTS_CACHE_PROTECT_MS
  const totalBytes = rows.reduce((s, r) => s + Math.max(0, r.bytes), 0)
  let remaining = totalBytes
  const remove: CacheEntryLite[] = []
  let protectedCount = 0
  if (totalBytes > maxBytes) {
    const ordered = [...rows].sort((a, b) => lastUse(a) - lastUse(b) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    const cutoff = opts.now.getTime() - protectMs
    for (const r of ordered) {
      if (remaining <= maxBytes) break
      if (lastUse(r) >= cutoff) {
        protectedCount++
        continue
      }
      remove.push(r)
      remaining -= Math.max(0, r.bytes)
    }
  }
  return { totalBytes, maxBytes, remove, remainingBytes: remaining, protectedCount, reachable: remaining <= maxBytes }
}

/** 정리 저장소 경계(테스트는 메모리 구현). */
export interface CachePruneStore {
  listEntries(limit: number): Promise<CacheEntryLite[]>
  /** 계획 때 본 lastHitAt 그대로일 때만 행을 지운다(그 사이 재생돼 히트가 오른 항목은 남긴다). 지웠으면 true. */
  deleteRowIfUnchanged(e: CacheEntryLite): Promise<boolean>
  removeFile(key: string): Promise<void>
}

/** TtsCache 표 **전체** — 환경 칸이 없어 개발·운영 행이 섞여 있다. 이 저장소로 실제 삭제하면 운영 캐시도 지워진다. */
export const prismaCachePruneStore: CachePruneStore = {
  listEntries: (limit) => prisma.ttsCache.findMany({ select: { key: true, bytes: true, lastHitAt: true, createdAt: true }, take: limit }),
  async deleteRowIfUnchanged(e) {
    const r = await prisma.ttsCache.deleteMany({ where: { key: e.key, lastHitAt: e.lastHitAt } })
    return r.count === 1
  },
  // 경로는 DB 의 path 를 믿지 않고 키(16진 40자)에서 다시 만든다 — DATA_ROOT/tts-cache 밖으로 나갈 수 없다(cacheSegments).
  async removeFile(key) {
    await removeDataFile(cacheSegments(key))
  },
}

export interface CachePruneResult extends Omit<CachePrunePlan, 'remove'> {
  dryRun: boolean
  planned: number
  deleted: number
  freedBytes: number
  /** 계획 뒤 히트가 올라 남긴 항목. */
  skippedChanged: number
  /** 행은 지웠는데 파일 삭제가 실패한 수(파일은 조회 경로가 닿지 않는 쓰레기로 남는다). */
  fileErrors: number
  truncated: boolean
}

interface PruneTtsCacheCommon {
  maxBytes?: number
  now?: Date
  protectMs?: number
}

/**
 * 정리 옵션. 생략·`dryRun: true` = 계획만(삭제 0, 저장소 생략 시 TtsCache 전체를 읽기만).
 * 실제 삭제는 `dryRun: false` 리터럴 + 지울 범위를 정하는 `store` 를 **둘 다** 적어야 한다 — 인자 없이 부르면 지우지 않는다.
 */
export type PruneTtsCacheOptions = (PruneTtsCacheCommon & { dryRun?: true; store?: CachePruneStore }) | (PruneTtsCacheCommon & { dryRun: false; store: CachePruneStore })

/**
 * LRU 정리. 기본은 dryRun(계획만) — 실제 삭제는 `deleteFromSharedCacheIncludingProduction` 에서만 일어나고, `dryRun: false` 와 `store` 를 명시해야 그리로 간다.
 */
export async function pruneTtsCache(opts: PruneTtsCacheOptions = {}): Promise<CachePruneResult> {
  const dryRun = opts.dryRun !== false
  if (!dryRun && !opts.store) throw new Error('pruneTtsCache: 실제 삭제(dryRun: false)는 지울 범위(store)를 명시해야 한다 — 개발·운영이 같은 TtsCache·DATA_ROOT 를 쓴다')
  const store = opts.store ?? prismaCachePruneStore
  const now = opts.now ?? new Date()
  const rows = await store.listEntries(TTS_CACHE_PRUNE_MAX_ROWS + 1)
  const truncated = rows.length > TTS_CACHE_PRUNE_MAX_ROWS
  const plan = planCachePrune(truncated ? rows.slice(0, TTS_CACHE_PRUNE_MAX_ROWS) : rows, { maxBytes: opts.maxBytes ?? TTS_CACHE_MAX_BYTES_DEFAULT, now, protectMs: opts.protectMs })
  const { remove, ...rest } = plan
  const result: CachePruneResult = { ...rest, dryRun, planned: remove.length, deleted: 0, freedBytes: 0, skippedChanged: 0, fileErrors: 0, truncated }
  if (dryRun) return result
  await deleteFromSharedCacheIncludingProduction(remove, store, result)
  result.remainingBytes = plan.totalBytes - result.freedBytes
  result.reachable = result.remainingBytes <= plan.maxBytes
  return result
}

/**
 * 실제 삭제 — **경고: 개발(LOCAL)·운영(PRODUCTION)이 같은 DATA_ROOT 와 같은 TtsCache 표(환경 칸 없음)를 쓰므로,
 * 저장소가 표 전체(prismaCachePruneStore)면 개발 미러에서 불러도 운영 캐시가 지워진다**(캐시라 데이터 손실은 아니지만 재합성·M4 부하).
 * 순서: 행 조건부 삭제 → 파일 삭제. 행을 먼저 지우면 그 뒤 조회는 MISS(재합성)라 끊긴 재생이 없고,
 * 같은 키를 다른 요청이 그 사이 다시 만들었다가 파일만 지워져도 다음 조회가 "행은 있는데 파일 없음"으로 행을 치운다(readCachedAudio).
 * 형식이 틀린 키는 파일을 건드리지 않고 행만 지운다(조회 경로가 닿지 않는 행).
 */
async function deleteFromSharedCacheIncludingProduction(remove: readonly CacheEntryLite[], store: CachePruneStore, result: CachePruneResult): Promise<void> {
  for (const e of remove) {
    if (!(await store.deleteRowIfUnchanged(e))) {
      result.skippedChanged++
      continue
    }
    result.deleted++
    if (!isCacheKey(e.key)) {
      result.freedBytes += Math.max(0, e.bytes)
      continue
    }
    try {
      await store.removeFile(e.key)
      result.freedBytes += Math.max(0, e.bytes)
    } catch {
      result.fileErrors++
    }
  }
}

/** 16 §11.2 예시 예열 문장. AppSetting `tts.cache.warmupSentences` 키는 아직 없다(위 상한과 같은 규칙). */
export const TTS_WARMUP_SENTENCES_DEFAULT: readonly string[] = ['もう一度言ってみましょう。', 'おはようございます。', 'ありがとうございます。']
export const TTS_WARMUP_PROFILES: readonly SpeechProfile[] = ['NATIVE', 'LEARNING_SLOW']
export const TTS_WARMUP_MAX_CANDIDATES = 200
const WARMUP_TEXT_MAX = 100
const VOICE_ID_RE = /^[\w.:-]{1,80}$/

export interface WarmupCandidate {
  text: string
  voiceId: string
  speechProfile: SpeechProfile
}

/**
 * 예열 후보 = 문장 × 선택 가능한 목소리 × {NATIVE, LEARNING_SLOW}(순수 — 합성·DB 없음). 중복·빈 문장·100자 초과·형식이 틀린 id 는 뺀다.
 * 실제 캐시 키는 사용자 음성 설정(속도·스타일)과 사전 버전에 따라 달라진다 — 실행 쪽이 문장마다 합성 준비(prepareSentence)로 키를 만들고
 * `missingCacheKeys` 로 없는 것만 합성해야 한다(회화 시간대를 피해 한 번에 하나씩 — 회화 TTS 큐를 막지 않게).
 */
export function planWarmupCandidates(opts: { voiceIds: readonly string[]; sentences?: readonly string[]; profiles?: readonly SpeechProfile[]; max?: number }): WarmupCandidate[] {
  const sentences = [...new Set((opts.sentences ?? TTS_WARMUP_SENTENCES_DEFAULT).map((s) => s.trim()))].filter((s) => s.length > 0 && [...s].length <= WARMUP_TEXT_MAX)
  const voices = [...new Set(opts.voiceIds)].filter((v) => VOICE_ID_RE.test(v))
  const profiles = [...new Set(opts.profiles ?? TTS_WARMUP_PROFILES)]
  const max = Math.max(0, opts.max ?? TTS_WARMUP_MAX_CANDIDATES)
  const out: WarmupCandidate[] = []
  for (const voiceId of voices) for (const speechProfile of profiles) for (const text of sentences) if (out.length < max) out.push({ text, voiceId, speechProfile })
  return out
}

/** 아직 캐시에 없는 키(형식이 틀린 키는 뺀다). */
export async function missingCacheKeys(keys: readonly string[], db: { ttsCache: { findMany(args: { where: { key: { in: string[] } }; select: { key: true } }): Promise<{ key: string }[]> } } = prisma): Promise<string[]> {
  const valid = [...new Set(keys)].filter(isCacheKey)
  if (valid.length === 0) return []
  const have = new Set((await db.ttsCache.findMany({ where: { key: { in: valid } }, select: { key: true } })).map((r) => r.key))
  return valid.filter((k) => !have.has(k))
}
