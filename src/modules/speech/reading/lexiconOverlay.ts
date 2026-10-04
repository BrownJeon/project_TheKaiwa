/**
 * 화면 읽기 줄에 관리자 발음 사전 덮어쓰기(task-032) — 분석기 조각(원본) 위에 활성 사전 항목을 얹는 순수 함수.
 *
 * 적용 범위는 **GLOBAL + 본인 USER** 뿐이다(사용자 결정 2026-10-05). VOICE 는 목소리별 소리 보정이라 화면 읽기에 맞지 않고,
 * 읽기 요청에는 레슨·주제 문맥이 없다. 매칭은 TTS 와 같은 최장 일치(`findLexiconMatches`)라 표시와 소리가 같은 항목을 고른다.
 *
 * 매칭 하나의 처리(원문 좌표, 조각 = 분석기 세그먼트):
 *   1. 같음   — 매칭 구간이 조각 경계와 맞고 조각 소리(발음 또는 읽기)가 항목 읽기와 같으면 그대로(분석기의 더 나은 루비 유지).
 *   2. 교체   — 경계가 맞고 읽기가 다르면 그 조각들을 한 조각으로(루비 = 항목 읽기 정렬, 발음 = 항목 읽기).
 *   3. 유지   — 경계가 안 맞고 구간 밖으로 삐져나온 부분에 가나 아닌 글자가 있으면 분석기가 더 긴 단어(복합어)를 본 것(明日香 ≠ 明日).
 *   4. 유지   — 삐져나온 부분이 가나뿐이고 조각 소리 = 앞가나+항목 읽기+뒷가나 면 이미 같은 소리(青かった + 青か).
 *   5. 숨김   — 그 밖(가나 활용형과 읽기 충돌, 上手い + 上手=ジョウズ) — 겹친 조각의 루비·발음을 비운다("틀린 것보다 없음").
 * 불변식: 결과 표기를 이어 붙이면 원문(아니면 원본 반환) · 입력 배열·조각 객체는 바꾸지 않는다(서버 캐시 객체다) · 예외면 원본.
 */
import { findLexiconMatches, selectEntries, type LexiconEntryData } from '../tts/lexicon'
import { alignWordRuby, hasKanji, type ReadingSegment } from './client'

const KANA_ONLY = /^[ぁ-ゖァ-ヺー]+$/

/** 표시에 쓰는 항목 — GLOBAL + `userId` 의 USER 만(문맥 id 를 userId 하나만 넘기므로 VOICE·LESSON·COURSE 는 빠진다). */
export function selectDisplayEntries(entries: readonly LexiconEntryData[], userId: string | null | undefined): Map<string, LexiconEntryData> {
  return selectEntries(entries, { userId: userId ?? null })
}

function toKata(s: string): string {
  return s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
}

/** 조각의 읽기(가타카나) — 루비 읽기 + 가나 표기. 분석기 응답에 읽기 칸이 없어 재구성한다. 한자인데 읽기가 없으면 null. */
function readOf(s: ReadingSegment): string | null {
  if (s.ruby) {
    let out = ''
    for (const [t, r] of s.ruby) {
      if (r !== null) out += toKata(r)
      else if (hasKanji(t)) return null
      else out += toKata(t)
    }
    return out
  }
  return hasKanji(s.surface) ? null : toKata(s.surface)
}

function sounds(segs: readonly ReadingSegment[], idx: readonly number[], target: string): boolean {
  let pron = ''
  let read = ''
  let pronOk = true
  let readOk = true
  for (const i of idx) {
    const p = segs[i].pron
    if (p === null) pronOk = false
    else pron += p
    const r = readOf(segs[i])
    if (r === null) readOk = false
    else read += r
  }
  return (pronOk && pron === target) || (readOk && read === target)
}

function replaced(surface: string, reading: string, boundary: ReadingSegment['boundary']): ReadingSegment {
  const pieces = alignWordRuby(surface, reading)
  return { surface, ruby: pieces ? pieces.map((p) => [p.text, p.reading] as [string, string | null]) : null, pron: reading, boundary }
}

function overlay(text: string, segments: ReadingSegment[], selected: ReadonlyMap<string, LexiconEntryData>): ReadingSegment[] {
  const offs: Array<[number, number]> = []
  let p = 0
  for (const s of segments) {
    offs.push([p, p + s.surface.length])
    p += s.surface.length
  }
  if (p !== text.length || segments.map((s) => s.surface).join('') !== text) return segments
  const matches = findLexiconMatches(text, selected)
  if (matches.length === 0) return segments
  const out: ReadingSegment[] = segments.slice()
  let changed = false
  // 오른쪽부터 — 교체(splice)가 왼쪽 조각 번호를 밀지 않게.
  for (let m = matches.length - 1; m >= 0; m--) {
    const { start, end, reading } = matches[m]
    const idx: number[] = []
    offs.forEach(([a, b], i) => {
      if (a < end && b > start) idx.push(i)
    })
    if (idx.length === 0) continue
    const a0 = offs[idx[0]][0]
    const b1 = offs[idx[idx.length - 1]][1]
    if (a0 === start && b1 === end) {
      if (sounds(segments, idx, reading)) continue
      out.splice(idx[0], idx.length, replaced(text.slice(start, end), reading, segments[idx[0]].boundary))
      // 합친 구간 끝의 조사(は·を·へ)가 항목 안으로 들어갔다 — 뒤 조각의 '조사 뒤' 표식은 구절 경계로.
      const next = out[idx[0] + 1]
      if (next && next.boundary === 'particle') out[idx[0] + 1] = { ...next, boundary: 'phrase' }
      changed = true
      continue
    }
    const pre = text.slice(a0, start)
    const suf = text.slice(end, b1)
    if (!KANA_ONLY.test(pre + suf)) continue
    if (sounds(segments, idx, toKata(pre) + reading + toKata(suf))) continue
    for (const i of idx) out[i] = { ...out[i], ruby: null, pron: null }
    changed = true
  }
  if (!changed) return segments
  return out.map((s) => s.surface).join('') === text ? out : segments
}

/**
 * `text` 의 분석기 조각에 사전을 덮어쓴 새 배열. 바뀐 것이 없으면 입력 그대로(같은 참조)를 돌려준다 — 입력은 읽기만 한다.
 * `selected` 는 `selectDisplayEntries` 결과(요청당 한 번).
 */
export function applyLexiconOverlay(text: string, segments: ReadingSegment[], selected: ReadonlyMap<string, LexiconEntryData>): ReadingSegment[] {
  if (selected.size === 0 || segments.length === 0) return segments
  try {
    return overlay(text, segments, selected)
  } catch {
    return segments
  }
}
