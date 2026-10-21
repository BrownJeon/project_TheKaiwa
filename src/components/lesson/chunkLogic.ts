/**
 * ③ 조각 단계의 순수 논리(screens §37-4-2) — 화면 부품(`StageChunk`·`ChunkSentence`·`PieceCollect`)이 이 함수만 부른다.
 *  - 조각 글·종류·뜻은 저장된 `dialogue[i].pieces` 에서만 온다. 읽기(루비)·한글은 문장 전체 분석(#24r)을 조각 범위로 자른다 —
 *    화면이 읽기·한글 변환 규칙을 새로 만들지 않는다(`rubyPieces`·`cutRubyByRanges`·`hangulLine` 재사용).
 *  - `phraseText`·`pieceCount` 는 서버 `modules/learning/lessons/content.ts` 의 같은 이름 함수와 **같은 규칙**이다(L3 를 화면에서 import 하지
 *    않으므로 두 벌 — 공용 픽스처 `lessons/__tests__/pieceRuleCases.json` 으로 양쪽을 같은 기대값에 묶는다).
 */
import { cutRubyByRanges, type AnnotationState, type TextRange } from '@/components/common/japanese/annotations'
import { hangulLine, rubyPieces, type ReadingSegment, type RubyPiece } from '@/modules/speech/reading/client'
import type { DialoguePiece, PieceType } from '@/types/lesson'
import { PIECE_TYPE_ORDER } from './lessonCopy'

/** 조각 규칙이 읽는 만큼의 내용 모양 — 레슨 내용(`LessonContent`)도, 픽스처의 일부 모양도 받는다. */
export interface ChunkContent {
  dialogue: readonly { pieces?: readonly DialoguePiece[] | null }[]
}

export interface PieceRange {
  /** 코드포인트 기준 [start, end) */
  start: number
  end: number
}

export interface CollectedPiece {
  type: PieceType
  ja: string
  ko: string
  /** 처음 나온 줄 번호(모아 보기 소리 — piece 재생 위치) */
  line: number
  /** 그 줄 안 조각 index */
  j: number
}

const cpLen = (s: string) => Array.from(s).length

// 저장 JSON 은 생성 때 정리됐지만, 모양이 어긋난 항목 하나 때문에 화면이 던지지 않게 최소 형태만 본다(서버 `isPiece` 와 같은 기준 — 셈이 같아야 한다).
const isPiece = (p: unknown): p is DialoguePiece =>
  typeof p === 'object' && p !== null && typeof (p as { ja?: unknown }).ja === 'string' && ((p as { type?: unknown }).type === null || typeof (p as { type?: unknown }).type === 'string')

/** 어떤 줄에도 `pieces` 배열이 없으면 `'none'`(옛 수업) — 한 줄이라도 배열이면 `'lines'`(그 밖의 null 줄은 줄마다 «나누지 못했어요»). */
export function chunkMode(content: ChunkContent): 'none' | 'lines' {
  return content.dialogue.some((d) => Array.isArray(d.pieces)) ? 'lines' : 'none'
}

/**
 * 조각마다 원문 안 코드포인트 범위 — 앞에서부터 누적. `lineJa` 를 주면 이은 글이 원문과 **정확히** 같을 때만 범위를 돌려주고 다르면 null
 * (서버가 NFC 로 이미 걸렀지만, NFC 만 같고 글자가 다르면 분석 조각 위치와 어긋나므로 화면은 그 줄을 «조각 없는 줄» 로 그린다).
 */
export function pieceRanges(pieces: readonly DialoguePiece[], lineJa?: string): PieceRange[] | null {
  if (lineJa !== undefined && pieces.map((p) => p.ja).join('') !== lineJa) return null
  const out: PieceRange[] = []
  let pos = 0
  for (const p of pieces) {
    const n = cpLen(p.ja)
    out.push({ start: pos, end: pos + n })
    pos += n
  }
  return out
}

const plainRuns = (pieces: readonly DialoguePiece[]): RubyPiece[][] => pieces.map((p) => [{ text: p.ja, reading: null }])

const segmentsMatch = (segments: readonly ReadingSegment[], lineJa: string) => segments.map((s) => s.surface).join('') === lineJa

/**
 * 조각별 루비 조각 — 문장 전체 루비를 조각 경계에서 자른다(`cutRubyByRanges` — 경계가 한자 묶음 한가운데면 그 묶음 읽기만 빠짐).
 * 히라가나 끔·분석 대기/실패·분석 글이 원문과 다름·조각 범위 없음이면 조각 글 그대로(읽기 없음).
 */
export function pieceRuns(state: AnnotationState, lineJa: string, pieces: readonly DialoguePiece[], showFu: boolean): RubyPiece[][] {
  if (!showFu || state.s !== 'ready' || !segmentsMatch(state.segments, lineJa)) return plainRuns(pieces)
  const ranges = pieceRanges(pieces, lineJa)
  if (!ranges) return plainRuns(pieces)
  const marks: TextRange[] = ranges.map((r, j) => ({ start: r.start, end: r.end, className: String(j) }))
  const out: RubyPiece[][] = pieces.map(() => [])
  for (const run of cutRubyByRanges(rubyPieces(state.segments), marks)) {
    const j = run.range ? marks.indexOf(run.range) : -1
    if (j >= 0) out[j].push(...run.pieces)
  }
  return out.map((run, j) => (run.length ? run : [{ text: pieces[j].ja, reading: null }]))
}

/**
 * 조각별 한글 — 분석 조각을 **시작 위치가 든 조각**에 붙이고, 그 묶음을 `hangulLine` 으로 바꾼다(문장 한글 줄과 같은 변환 — 묶음 첫 분석 조각
 * 앞 구분은 넣지 않는다). 분석 조각 하나가 조각 경계를 넘으면 걸친 조각 모두 null(고른 조각 줄의 `[한글]` 생략). 문장부호 조각(type null)은
 * 한글이 필요 없어 늘 null. 범위·분석 글이 원문과 맞지 않으면 모두 null.
 */
export function pieceHangul(segments: readonly ReadingSegment[], lineJa: string, pieces: readonly DialoguePiece[]): (string | null)[] {
  const ranges = pieceRanges(pieces, lineJa)
  if (!ranges || !segmentsMatch(segments, lineJa)) return pieces.map(() => null)
  const at = (pos: number) => ranges.findIndex((r) => r.start <= pos && pos < r.end)
  const groups: ReadingSegment[][] = pieces.map(() => [])
  const broken = new Set<number>()
  let pos = 0
  for (const s of segments) {
    const n = cpLen(s.surface)
    if (n === 0) continue
    const a = at(pos)
    const b = at(pos + n - 1)
    if (a < 0 || b < 0) return pieces.map(() => null)
    if (a !== b) for (let k = a; k <= b; k++) broken.add(k)
    else groups[a].push(s)
    pos += n
  }
  return pieces.map((p, j) => {
    if (p.type === null || broken.has(j) || groups[j].length === 0) return null
    return hangulLine(groups[j].map((s, i) => (i === 0 ? { ...s, boundary: null } : s)))
  })
}

/**
 * 조각 경계를 살린 한글 한 줄(데모 `hgLine`) — 연결 조각(LINK)은 앞에 붙이고(띄어쓰기 없음) 나머지는 한 칸 띄운다. `slash` 조각 뒤 « /»
 * (문장부호 조각은 글 없이 빗금만). 끝의 빗금은 뺀다. 글이 있는 조각 하나라도 한글을 못 구하면 빗금 없이 지금 `hangulLine(segments)` 로 대신.
 */
export function pieceHangulLine(segments: readonly ReadingSegment[], lineJa: string, pieces: readonly DialoguePiece[]): string | null {
  const hs = pieceHangul(segments, lineJa, pieces)
  if (pieces.some((p, j) => p.type !== null && hs[j] === null)) return hangulLine(segments)
  let out = ''
  pieces.forEach((p, j) => {
    const h = hs[j]
    if (p.type !== null && h !== null) out += (!out ? '' : p.type === 'LINK' && !out.endsWith('/') ? '' : ' ') + h
    if (p.slash === true && out && !out.endsWith('/')) out += ' /'
  })
  out = out.replace(/ \/$/, '')
  return out || hangulLine(segments)
}

/** 조각 j 가 든 끊어 읽기 구간 번호 — 앞 조각들의 `slash` 수(`phraseText` 와 같은 나눔). */
export function phraseIndexOf(pieces: readonly DialoguePiece[], j: number): number {
  let k = 0
  for (let q = 0; q < j && q < pieces.length; q++) if (pieces[q].slash === true) k++
  return k
}

/**
 * 끊어 읽기 구간 k 의 글 — `slash` 조각 «뒤» 에서 나눈 묶음의 조각 글을 잇고 **끝의 `type null` 조각(문장부호)을 뺀다**. 없는 구간·문장부호뿐인
 * 구간은 null(화면은 그 구간 버튼을 그리지 않는다). 서버 `content.ts` `phraseText`(#62c `phrase` 소리 글)와 같은 규칙.
 */
export function phraseText(pieces: readonly DialoguePiece[], k: number): string | null {
  const phrases: DialoguePiece[][] = []
  let cur: DialoguePiece[] = []
  for (const p of pieces) {
    cur.push(p)
    if (p.slash === true) {
      phrases.push(cur)
      cur = []
    }
  }
  if (cur.length) phrases.push(cur)
  const ph = Number.isInteger(k) && k >= 0 && k < phrases.length ? phrases[k] : null
  if (!ph) return null
  let end = ph.length
  while (end > 0 && ph[end - 1].type === null) end--
  const text = ph.slice(0, end).map((p) => p.ja).join('')
  return text || null
}

const typeRank = (t: string) => {
  const i = (PIECE_TYPE_ORDER as readonly string[]).indexOf(t)
  return i < 0 ? PIECE_TYPE_ORDER.length : i
}

/**
 * 오늘의 조각 모아 보기 — 모든 줄의 `type ≠ null` 조각을 `type + '\u0000' + ja` 로 한 번만(처음 나온 줄·위치를 기억), 종류 순서
 * `PIECE_TYPE_ORDER`(같은 종류 안은 처음 나온 순서). null 줄·옛 수업 줄은 건너뛴다.
 */
export function collectPieces(content: ChunkContent): CollectedPiece[] {
  const seen = new Set<string>()
  const out: CollectedPiece[] = []
  content.dialogue.forEach((d, line) => {
    if (!Array.isArray(d.pieces)) return
    d.pieces.forEach((p: unknown, j: number) => {
      if (!isPiece(p) || p.type === null) return
      const key = `${p.type}\u0000${p.ja}`
      if (seen.has(key)) return
      seen.add(key)
      out.push({ type: p.type, ja: p.ja, ko: typeof p.ko === 'string' ? p.ko : '', line, j })
    })
  })
  return out.map((p, i) => ({ p, i })).sort((a, b) => typeRank(a.p.type) - typeRank(b.p.type) || a.i - b.i).map((x) => x.p)
}

/** 오늘의 조각 수 — `collectPieces` 개수, 옛 수업(`chunkMode === 'none'`)은 null. 종료 카드·오늘 카드·서버 #58 `pieces` 가 모두 이 규칙. */
export function pieceCount(content: ChunkContent): number | null {
  return chunkMode(content) === 'none' ? null : collectPieces(content).length
}

/** 재생 키(`pb.active`·`pb.playLines` 의 key) — 줄 다시 듣기·구간 듣기와 겹치지 않는 이름. */
export const pieceKey = (line: number, j: number) => `piece:${line}:${j}`
export const phraseKey = (line: number, k: number) => `phrase:${line}:${k}`
