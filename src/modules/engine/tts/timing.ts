/**
 * 단어 timing 공용 도우미(task-012b-4, speech-platform/16 §8) — 엔진 중립·순수 함수. 글 좌표는 전부 **코드포인트**다.
 *
 *  - `checkTimingWords`: 정수 4-튜플 [startMs, endMs, charStart, charEnd] 모양·범위·순서 검사. 하나라도 어긋나면 null(틀린 강조보다 없는 강조).
 *  - `projectTimingWords`: 글을 한 번 바꾼 쪽(derived) 좌표를 바꾸기 전(source) 좌표로 되돌린다. 바꿈 구간 안에 걸친 단어는 그 구간 전체로
 *    넓히고, 넓혀서 겹친 이웃은 합친다(`15` → `十`·`五` 처럼). 되돌릴 수 없으면 null.
 *
 * 어댑터(사전 치환 되돌리기)와 L4 speech/tts(정규화 되돌리기)가 같은 규칙을 쓴다.
 */
import type { TtsTimingWord } from '../registry/types'

/** 단어 수 상한 — 세그먼트가 100자 이하라 넉넉하다. 넘으면 형식 오류로 본다. */
export const TIMING_MAX_WORDS = 400
const MAX_MS = 10 * 60_000

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v)

/**
 * 단어 배열 검사: 정수 4-튜플, `0 ≤ start < end`, `end ≤ durationMs`(알 때), `0 ≤ charStart < charEnd ≤ textCodePoints`,
 * 시간·글 모두 오름차순이고 앞 단어와 겹치지 않는다. 비어 있으면 null.
 */
export function checkTimingWords(raw: unknown, limits: { textCodePoints: number; durationMs: number | null }): TtsTimingWord[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > TIMING_MAX_WORDS) return null
  const out: TtsTimingWord[] = []
  let prevEnd = 0
  let prevCharEnd = 0
  for (const w of raw) {
    if (!Array.isArray(w) || w.length !== 4 || !w.every(isInt)) return null
    const [s, e, cs, ce] = w as [number, number, number, number]
    if (s < 0 || e <= s || e > MAX_MS) return null
    if (limits.durationMs !== null && e > limits.durationMs) return null
    if (cs < 0 || ce <= cs || ce > limits.textCodePoints) return null
    if (s < prevEnd || cs < prevCharEnd) return null
    prevEnd = e
    prevCharEnd = ce
    out.push([s, e, cs, ce])
  }
  return out
}

/**
 * 바꾼 글(derived)의 코드 유닛마다 바꾸기 전 글(source)의 코드 유닛 구간 [start, end).
 * 그대로 옮긴 글자는 자기 자리 한 칸, 치환으로 생긴 글자는 치환 전 구간 전체를 가리킨다.
 */
export interface TextUnitMap {
  derived: string
  source: string
  start: readonly number[]
  end: readonly number[]
}

/** 코드포인트 i 의 코드 유닛 위치(길이 = 코드포인트 수 + 1). */
export function codePointOffsets(s: string): number[] {
  const out: number[] = []
  let u = 0
  for (const ch of s) {
    out.push(u)
    u += ch.length
  }
  out.push(u)
  return out
}

/** 코드 유닛 위치 → 코드포인트 위치. 서로게이트 쌍 한가운데는 -1. */
function unitToCodePoint(s: string): Int32Array {
  const out = new Int32Array(s.length + 1).fill(-1)
  let cp = 0
  let u = 0
  for (const ch of s) {
    out[u] = cp
    u += ch.length
    cp++
  }
  out[u] = cp
  return out
}

/** derived 코드포인트 좌표 단어 → source 코드포인트 좌표. 결과도 `checkTimingWords` 를 통과해야 한다. */
export function projectTimingWords(words: readonly TtsTimingWord[], map: TextUnitMap): TtsTimingWord[] | null {
  const n = map.derived.length
  if (map.start.length !== n || map.end.length !== n) return null
  const dOff = codePointOffsets(map.derived)
  const sCp = unitToCodePoint(map.source)
  const merged: [number, number, number, number][] = []
  for (const [s, e, cs, ce] of words) {
    if (ce >= dOff.length) return null
    const us = dOff[cs]
    const ue = dOff[ce]
    if (!(us < ue) || ue > n) return null
    let a = Infinity
    let b = -Infinity
    for (let u = us; u < ue; u++) {
      a = Math.min(a, map.start[u])
      b = Math.max(b, map.end[u])
    }
    if (!(a >= 0 && b <= map.source.length && a < b)) return null
    const ca = sCp[a]
    const cb = sCp[b]
    if (ca < 0 || cb < 0) return null
    const prev = merged[merged.length - 1]
    if (prev && ca < prev[3]) {
      if (ca < prev[2]) return null
      prev[1] = Math.max(prev[1], e)
      prev[3] = Math.max(prev[3], cb)
      continue
    }
    merged.push([s, e, ca, cb])
  }
  return checkTimingWords(merged, { textCodePoints: sCp[map.source.length], durationMs: null })
}

/** 바꾸지 않은 글의 지도(자기 자리 한 칸씩). */
export function identityUnitMap(text: string): TextUnitMap {
  const idx = Array.from({ length: text.length }, (_, i) => i)
  return { derived: text, source: text, start: idx, end: idx.map((i) => i + 1) }
}
