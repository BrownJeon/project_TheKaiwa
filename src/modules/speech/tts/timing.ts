/**
 * 단어 timing — L4 쪽 좌표 정리(task-012b-4, speech-platform/16 §8, Leader D-T1·D-T3·D-T7).
 *
 * 좌표 단계(전부 코드포인트):
 *   엔진(보낸 글) ─어댑터─▶ 정규화 글(`normalizedText`) ─이 파일─▶ 조각 글(합성 요청 `text` = 턴 청크 문장·#23 text·#62c clip 글)
 *
 * - **캐시(`TtsCache.timing`)에는 정규화 글 좌표로 둔다.** 캐시 키(12요소)가 정규화 글로 정해지므로 같은 키의 행은 원문이 달라도
 *   (`OK`/`オーケー`, 앞 공백, 이모지 등) 같은 오디오를 가리킨다 — 조각 글 좌표를 저장하면 다른 원문 요청에 틀린 위치를 준다.
 *   조각 글 좌표는 원문을 아는 자리(합성 호출)에서 그때그때 정규화 token map 으로 되돌린다.
 * - 되돌릴 수 없거나·오디오 길이와 어긋나거나·헤더 상한(3KB)을 넘으면 **전체를 null**(일부 단어만 버리지 않는다 — 틀린 강조 금지).
 * - 화면·응답에는 글·읽기·엔진 정보가 없다(`TtsTiming` = 숫자만).
 */
import { tts } from '@/modules/engine'
import type { TtsTiming } from '@/types/tts'
import type { NormalizationToken } from './normalizer'

type TtsTimingOutput = tts.TtsTimingOutput
type TtsTimingWord = tts.TtsTimingWord

/** 앱 → 브라우저 헤더 상한(base64url 길이). nginx 응답 헤더 버퍼 4KB 안에 다른 헤더와 함께 들어가야 한다(REV-130 I-4 ⒜). */
export const TTS_TIMING_HEADER_MAX = 3072
/** timing 의 오디오 길이와 실제 wav 길이 허용 차(ms) — 둘 다 같은 샘플 수에서 반올림한 값이라 보통 0~1. */
export const TIMING_DURATION_TOLERANCE_MS = 2

const VERSION_RE = /^[\w.:-]{1,40}$/
const METHODS = new Set(['ENGINE_DURATION', 'FORCED_ALIGN'])
const STORED_MAX_CP = 200

/** `TtsCache.timing` JSON — 정규화 글 좌표. `alignerVersion` 은 `timingVersion` 칸과 같다. */
export interface StoredTiming {
  v: 1
  method: TtsTimingOutput['method']
  alignerVersion: string
  coord: 'codepoint'
  base: 'normalizedText'
  durationMs: number
  words: TtsTimingWord[]
}

const cpLen = (s: string) => [...s].length

/** 엔진 결과 → 캐시 형식. 엔진이 말한 오디오 길이가 실제 wav 와 다르거나 단어가 정규화 글 밖이면 null. */
export function toStoredTiming(t: TtsTimingOutput | null | undefined, normalizedText: string, audioDurationMs: number): StoredTiming | null {
  if (!t || !METHODS.has(t.method) || !VERSION_RE.test(t.version)) return null
  if (Math.abs(t.durationMs - audioDurationMs) > TIMING_DURATION_TOLERANCE_MS) return null
  const words = tts.checkTimingWords(t.words, { textCodePoints: cpLen(normalizedText), durationMs: t.durationMs })
  if (!words) return null
  return { v: 1, method: t.method, alignerVersion: t.version, coord: 'codepoint', base: 'normalizedText', durationMs: t.durationMs, words }
}

/** DB JSON → 캐시 형식(모양만 본다 — 글 길이 검사는 되돌릴 때). `timingVersion` 칸과 JSON 버전이 다르거나 모르는 형식이면 null. */
export function parseStoredTiming(raw: unknown, timingVersion: string | null | undefined): StoredTiming | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const j = raw as Record<string, unknown>
  if (j.v !== 1 || j.coord !== 'codepoint' || j.base !== 'normalizedText') return null
  if (typeof j.method !== 'string' || !METHODS.has(j.method)) return null
  if (typeof j.alignerVersion !== 'string' || !VERSION_RE.test(j.alignerVersion) || j.alignerVersion !== timingVersion) return null
  if (typeof j.durationMs !== 'number' || !Number.isSafeInteger(j.durationMs) || j.durationMs <= 0) return null
  const words = tts.checkTimingWords(j.words, { textCodePoints: STORED_MAX_CP, durationMs: j.durationMs })
  if (!words) return null
  return { v: 1, method: j.method as StoredTiming['method'], alignerVersion: j.alignerVersion, coord: 'codepoint', base: 'normalizedText', durationMs: j.durationMs, words }
}

/**
 * 정규화 결과의 코드 유닛별 원문 구간 — `normalizeJapanese` 의 조립(구간 사이 원문 그대로 + 치환값, 끝에서 trim)을 그대로 다시 한다.
 * 바뀌지 않은 token(보호 구간 등)은 한 칸씩, 바뀐 token 은 그 원문 구간 전체를 가리킨다. 다시 조립한 글이 정규화 글과 다르면 null.
 */
export function normalizationUnitMap(source: string, tokens: readonly NormalizationToken[], normalizedText: string): tts.TextUnitMap | null {
  let raw = ''
  const start: number[] = []
  const end: number[] = []
  const copy = (from: number, to: number) => {
    for (let i = from; i < to; i++) {
      start.push(i)
      end.push(i + 1)
    }
    raw += source.slice(from, to)
  }
  let pos = 0
  for (const t of tokens) {
    if (t.srcStart < pos || t.srcEnd < t.srcStart || t.srcEnd > source.length) return null
    copy(pos, t.srcStart)
    if (t.replaced === source.slice(t.srcStart, t.srcEnd)) copy(t.srcStart, t.srcEnd)
    else {
      for (let k = 0; k < t.replaced.length; k++) {
        start.push(t.srcStart)
        end.push(t.srcEnd)
      }
      raw += t.replaced
    }
    pos = t.srcEnd
  }
  copy(pos, source.length)
  const lead = raw.length - raw.trimStart().length
  if (raw.trim() !== normalizedText) return null
  return { derived: normalizedText, source, start: start.slice(lead, lead + normalizedText.length), end: end.slice(lead, lead + normalizedText.length) }
}

/** 화면 형식 → `X-Tts-Timing` 값(base64url, 패딩 없음). 상한을 넘으면 null(헤더 생략). */
export function encodeTimingHeader(t: TtsTiming | null): string | null {
  if (!t) return null
  const value = Buffer.from(JSON.stringify({ v: t.v, coord: t.coord, durationMs: t.durationMs, words: t.words }), 'utf8').toString('base64url')
  return value.length <= TTS_TIMING_HEADER_MAX ? value : null
}

export interface ChunkTiming {
  timing: TtsTiming | null
  /** Trace `TTS_TIMING.status` — `OK` 또는 null 인 이유. */
  status: string
  words: number
  /** 헤더 값 길이(OK 일 때). */
  bytes: number | null
}

/**
 * 캐시 형식(정규화 글 좌표) → 화면 형식(조각 글 좌표). `missing` = stored 가 없을 때 남길 상태(엔진 사유·`NONE`).
 * 실제 재생할 wav 길이와 timing 길이가 어긋나면(같은 키를 동시에 다시 합성해 파일과 행이 엇갈린 경우 등) null.
 */
export function chunkTiming(stored: StoredTiming | null, missing: string, chunk: { text: string; tokens: readonly NormalizationToken[] | undefined; normalizedText: string }, audioDurationMs: number | null): ChunkTiming {
  const none = (status: string): ChunkTiming => ({ timing: null, status, words: 0, bytes: null })
  if (!stored) return none(missing)
  if (audioDurationMs === null || Math.abs(stored.durationMs - audioDurationMs) > TIMING_DURATION_TOLERANCE_MS) return none('DURATION_MISMATCH')
  if (!chunk.tokens) return none('NO_TOKEN_MAP')
  const map = normalizationUnitMap(chunk.text, chunk.tokens, chunk.normalizedText)
  const words = map ? tts.projectTimingWords(stored.words, map) : null
  if (!words) return none('PROJECT_FAILED')
  const timing: TtsTiming = { v: 1, coord: 'codepoint', durationMs: stored.durationMs, words: words.map((w) => [w[0], w[1], w[2], w[3]]) }
  const header = encodeTimingHeader(timing)
  // 엔진 쪽 `TOO_LARGE`(서비스 헤더 4KB 초과)와 Trace 에서 구별한다.
  if (!header) return none('HEADER_TOO_LARGE')
  return { timing, status: 'OK', words: words.length, bytes: header.length }
}
