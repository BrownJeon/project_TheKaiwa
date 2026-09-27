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
 * 용량 LRU·예열·정리 잡은 P1(task-012b). 오디오 조회 URL(#24)은 서명 URL(`audioUrl.ts`, task-007).
 */
import { createHash } from 'node:crypto'
import type { SpeechProfile } from '@prisma/client'
import { prisma, readDataFile, removeDataFile, writeDataFile } from '@/modules/infra'

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
}

/** HIT 면 파일을 읽고 hits·lastHitAt 을 올린다. 행은 있는데 파일이 없으면 행을 지우고 MISS. */
export async function readCachedAudio(key: string): Promise<CachedAudio | null> {
  const segs = cacheSegments(key)
  const row = await prisma.ttsCache.findUnique({ where: { key }, select: { durationMs: true, modelVersion: true, dictionaryVersion: true } })
  if (!row) return null
  const audio = await readDataFile(segs)
  if (!audio) {
    await prisma.ttsCache.delete({ where: { key } }).catch(() => undefined)
    return null
  }
  void prisma.ttsCache.update({ where: { key }, data: { hits: { increment: 1 }, lastHitAt: new Date() } }).catch(() => undefined)
  return { audio, durationMs: row.durationMs, modelVersion: row.modelVersion, dictionaryVersion: row.dictionaryVersion }
}

export async function storeCachedAudio(key: string, parts: CacheKeyParts, audio: Buffer, durationMs: number | null): Promise<void> {
  const segs = cacheSegments(key)
  await writeDataFile(segs, audio)
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
  }
  try {
    await prisma.ttsCache.upsert({ where: { key }, create: { key, ...data }, update: { bytes: data.bytes, durationMs, path: data.path } })
  } catch (e) {
    // 다른 프로세스가 같은 키를 먼저 넣었다(같은 입력 → 같은 오디오) — 그 행이 이 파일을 가리키므로 그대로 둔다.
    if ((e as { code?: string }).code === 'P2002') return
    // 행을 못 남기면 파일도 치운다 — 행 없는 파일은 조회 경로가 닿지 않는 쓰레기가 된다.
    await removeDataFile(segs).catch(() => undefined)
    throw e
  }
}
