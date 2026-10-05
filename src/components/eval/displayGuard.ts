/**
 * AI 평가의 일본어 표시 층 정답 보호(task-033 서브태스크 A, screens §15-11-2 A·E) — 순수 함수만(DOM·요청 없음, 단위 테스트 `__tests__/displayGuard.test.ts`).
 *
 * 평가 상세(#66)는 제출 전에 `expected` 를 주지 않아 화면이 가진 것은 문항의 `prompt` 뿐이다. 그래서 정답을 흘릴 수 있는 자리를 여기서 정한다.
 *  - P1 읽기 쓰기 단어: 제출 전 히라가나·`[한글]` 둘 다 그리지 않는다(`showReadingGuardNote` 로 안내 1줄만).
 *  - P2 같은 평가 다른 문항 속 읽기 쓰기 단어(교차 보호): `readingGuardKeys` 어간 키가 나오는 모든 자리(`guardHits`)의 히라가나를 빼고 그 블록 `[한글]` 을 숨긴다.
 *  - P3 듣고 답하기 들려주는 문장: 제출 전 글자가 없다(#66 `textHidden`) — 이 파일은 그 문장을 분석 목록에 넣지 않는다.
 *  - P4 문장 조립 조각: 히라가나만(조각 `[한글]`·문장 전체 소리 줄 없음) — 한자 없는 조각은 분석하지 않는다.
 * 평가 전체에 번역 층은 없다. 변환은 `@/modules/speech/reading/client` 의 `rubyPieces`·`hasKanji` 만 쓴다(화면이 변환 규칙을 만들지 않는다).
 */
import type { RubyPiece } from '@/modules/speech/reading/client'
import { hasKanji, rubyPieces } from '@/modules/speech/reading/client'
import { cutRubyByRanges, plainPieces, type AnnotationState, type TextRange } from '@/components/common/japanese/annotations'
import type { EvaluationItem } from '@/types/evaluation'
import { promptArr, promptStr, spotFix } from './logic'

const cpLen = (s: string) => Array.from(s).length

/** 읽기 쓰기 표기에서 마지막 한자까지 자른 어간(`片付ける`→`片付`, `食べる`→`食`). 한자가 없으면 '' — 가나 단어는 소리가 글자 그대로라 흘릴 것이 없다. */
export function guardStem(surface: string): string {
  const chars = Array.from(surface.trim())
  let last = -1
  chars.forEach((c, i) => {
    if (hasKanji(c)) last = i
  })
  return last < 0 ? '' : chars.slice(0, last + 1).join('')
}

/** 이 평가의 `READING_INPUT` 문항마다 어간 키(중복 제거). 활용형(`食べました`)에서도 새지 않게 표기 전체가 아니라 어간으로 막는다(§15-11-7 ⓐ). */
export function readingGuardKeys(items: ReadonlyArray<Pick<EvaluationItem, 'kind' | 'prompt'>>): string[] {
  const keys: string[] = []
  for (const it of items) {
    if (it.kind !== 'READING_INPUT') continue
    const key = guardStem(promptStr(it.prompt, 'surface'))
    if (key && !keys.includes(key)) keys.push(key)
  }
  return keys
}

/** 블록 글자에서 각 키가 나오는 **모든** 자리(코드포인트 [start,end)) — 겹치는 자리는 하나로 합친다. 히트가 없으면 보호 대상이 아니다. */
export function guardHits(text: string, keys: readonly string[]): TextRange[] {
  if (!text || keys.length === 0) return []
  const chars = Array.from(text)
  const raw: Array<[number, number]> = []
  for (const key of keys) {
    const k = Array.from(key)
    if (k.length === 0) continue
    for (let i = 0; i + k.length <= chars.length; i++) {
      let same = true
      for (let j = 0; j < k.length; j++) {
        if (chars[i + j] !== k[j]) {
          same = false
          break
        }
      }
      if (same) raw.push([i, i + k.length])
    }
  }
  raw.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const merged: Array<[number, number]> = []
  for (const r of raw) {
    const last = merged[merged.length - 1]
    if (last && r[0] < last[1]) last[1] = Math.max(last[1], r[1])
    else merged.push([r[0], r[1]])
  }
  return merged.map(([start, end]) => ({ start, end, className: '' }))
}

/** 히트 범위와 한 글자라도 겹치는 조각의 읽기를 뺀다 — 조각 전체가 보호된다(반쪽 읽기 없음). */
function maskPieces(pieces: readonly RubyPiece[], hits: readonly TextRange[]): RubyPiece[] {
  let pos = 0
  return pieces.map((p) => {
    const start = pos
    pos += cpLen(p.text)
    const hit = p.reading !== null && hits.some((h) => start < h.end && h.start < pos)
    return hit ? { text: p.text, reading: null } : { ...p }
  })
}

/**
 * 보호 블록의 `JaText ruby` — 분석 결과가 있으면 히트 겹친 조각의 읽기만 뺀다. 기다리는 중·한자 있음 = 줄간격만 예약(`plainPieces`),
 * 그 밖(끔·분석 불가·읽기 없음·조각을 이은 글이 `text` 와 다름 = 범위를 믿을 수 없음) = null.
 */
export function guardedRuby(text: string, state: AnnotationState, hits: readonly TextRange[], showFurigana: boolean): RubyPiece[] | null {
  if (!showFurigana) return null
  if (state.s === 'loading') return hasKanji(text) ? plainPieces(text) : null
  if (state.s !== 'ready') return null
  const pieces = rubyPieces(state.segments)
  if (!pieces.some((p) => p.reading)) return null
  if (pieces.map((p) => p.text).join('') !== text) return null
  return maskPieces(pieces, hits)
}

/** 저장 읽기로 정렬한 단어 루비(`alignWordRuby`)에서 히트 겹친 조각의 읽기를 뺀다 — 줄간격 예약은 그대로 둔다(보호 단어만 상자가 줄지 않게). */
export function guardWordRuby(pieces: readonly RubyPiece[] | null, hits: readonly TextRange[]): RubyPiece[] | null {
  return pieces ? maskPieces(pieces, hits) : null
}

/** 안내 1줄(★ `ITEM.readingGuardNote`)을 그릴 때: 히라가나나 한글이 하나라도 켜져 있을 때만(둘 다 끔이면 숨길 것이 없다). */
export function showReadingGuardNote(loaded: boolean, showFurigana: boolean, showHangul: boolean): boolean {
  return loaded && (showFurigana || showHangul)
}

const BLANK = '___'

/** 용법 빈칸 문장을 `___` 에서 둘로 나눈다(없으면 null → 문장 전체 한 블록). */
export function blankParts(sentenceJa: string): { before: string; after: string } | null {
  const at = sentenceJa.indexOf(BLANK)
  return at < 0 ? null : { before: sentenceJa.slice(0, at), after: sentenceJa.slice(at + BLANK.length) }
}

/**
 * 틀린 곳 찾기 조각별 루비 — 문장 전체를 한 번 분석한 읽기를 조각 경계(`segments.join('')` = 문장)로 나눈다. 경계가 한자 묶음을 자르면 그 묶음만
 * 읽기가 없다(`cutRubyByRanges`). 기다리는 중·한자 있는 조각 = 줄간격 예약. `hits`(교차 보호)가 있으면 겹친 조각의 읽기도 뺀다.
 */
export function spotSegmentRuby(state: AnnotationState, segments: readonly string[], showFurigana: boolean, hits: readonly TextRange[] = []): Array<RubyPiece[] | null> {
  const none = segments.map(() => null)
  if (!showFurigana) return none
  if (state.s === 'loading') return segments.map((s) => (hasKanji(s) ? plainPieces(s) : null))
  if (state.s !== 'ready') return none
  const sentence = segments.join('')
  const all = rubyPieces(state.segments)
  if (all.map((p) => p.text).join('') !== sentence) return none
  const pieces = maskPieces(all, hits)
  let pos = 0
  const ranges: TextRange[] = segments.map((s) => {
    const start = pos
    pos += cpLen(s)
    return { start, end: pos, className: '' }
  })
  const runs = cutRubyByRanges(pieces, ranges)
  return segments.map((s, i) => {
    const got = runs.filter((r) => r.range === ranges[i]).flatMap((r) => r.pieces)
    if (got.length === 0) return hasKanji(s) ? plainPieces(s) : null
    return got.some((p) => p.reading) ? got : null
  })
}

/** 용법 고르기 결과 — 빈칸에 말을 채운 문장과 그 말의 범위. 빈칸이 없거나 채울 말이 없으면 null(화면은 옛 빈칸 그림으로). */
export function filledRange(sentenceJa: string, fill: string | null | undefined, className: string): { text: string; ranges: TextRange[] } | null {
  const at = sentenceJa.indexOf(BLANK)
  if (at < 0 || !fill) return null
  const start = cpLen(sentenceJa.slice(0, at))
  return { text: sentenceJa.slice(0, at) + fill + sentenceJa.slice(at + BLANK.length), ranges: [{ start, end: start + cpLen(fill), className }] }
}

/**
 * 틀린 곳 찾기 결과 "정답 — 고친 곳" 줄 — 앞 + 틀린 말(취소선) + ' ' + 고친 말(밑줄) + 뒤 를 한 글로 만들고 두 말의 범위를 돌려준다.
 * 틀린 말이 문장에 없으면 null, 고친 말을 못 뽑으면 `hasFix:false`(틀린 말 취소선만 — 화면이 고친 문장을 따로 한 줄 보인다).
 */
export function fixLineRanges(
  sentence: string,
  wrongSpan: string,
  correctedJa: string,
  cls: { wrong: string; fix: string },
): { text: string; ranges: TextRange[]; hasFix: boolean } | null {
  const f = spotFix(sentence, wrongSpan, correctedJa)
  if (!f) return null
  const wrongStart = cpLen(f.before)
  const wrongEnd = wrongStart + cpLen(f.wrong)
  const ranges: TextRange[] = [{ start: wrongStart, end: wrongEnd, className: cls.wrong }]
  if (!f.fix) return { text: f.before + f.wrong + f.after, ranges, hasFix: false }
  const fixStart = wrongEnd + 1
  ranges.push({ start: fixStart, end: fixStart + cpLen(f.fix), className: cls.fix })
  return { text: `${f.before}${f.wrong} ${f.fix}${f.after}`, ranges, hasFix: true }
}

/** 결과 화면 용법 고르기 정답 말(`expected.answer` 번째 보기). */
export function usageRightFill(item: Pick<EvaluationItem, 'prompt' | 'expected'>): string {
  return promptArr(item.prompt, 'choices')[Number(item.expected?.answer)] ?? ''
}

/** 결과 화면 문장 조립 내 답 — 조각을 띄어 이은 문장(없으면 저장한 글자). */
export function assembleMineText(item: Pick<EvaluationItem, 'prompt' | 'answerOrder' | 'answerText'>): string {
  const pieces = promptArr(item.prompt, 'pieces')
  return item.answerOrder ? item.answerOrder.map((k) => pieces[k] ?? '').join(' ') : (item.answerText ?? '')
}

/** 결과 화면 문장 조립 정답 — `expected.order` 를 띄어 이은 문장. */
export function assembleRightText(item: Pick<EvaluationItem, 'expected'>): string {
  const order = item.expected?.order
  return Array.isArray(order) ? order.filter((x): x is string => typeof x === 'string').join(' ') : ''
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/**
 * 읽기 분석을 미리 데울 문장 목록 — 화면이 한 번에 묶어 요청해 문항을 넘길 때 막대가 다시 뜨지 않게 한다(각 문항은 자기 문장을 다시 받는다 = 캐시 적중).
 * 제출 전(`done:false`)은 푸는 화면이 그리는 문장만: 단어 상자(뜻 고르기·조각 분류)·용법 빈칸 앞뒤(한자 있는 쪽)·일본어 보기·글자로 본 문장·내가 한 말·
 * 조립 조각(한자 있는 것)·틀린 곳 문장. **읽기 쓰기 단어(P1)와 숨긴 듣기 문장(P3)은 넣지 않는다.** 결과(`done:true`)는 결과 화면이 그리는 문장만:
 * 내 답·정답·모범 답·들려준 말·채운 문장·고친 줄·고친 문장.
 */
export function collectEvalTexts(items: readonly EvaluationItem[], opts: { done?: boolean } = {}): string[] {
  const out: string[] = []
  const add = (t: string | null | undefined) => {
    if (t && t.trim() && !out.includes(t)) out.push(t)
  }
  const addKanji = (t: string) => {
    if (hasKanji(t)) add(t)
  }
  for (const it of items) {
    const p = it.prompt
    const e = it.expected ?? {}
    if (!opts.done) {
      switch (it.kind) {
        case 'MEANING_CHOICE':
          add(promptStr(p, 'surface'))
          break
        case 'CHUNK_CLASSIFY':
          add(promptStr(p, 'textJa'))
          break
        case 'USAGE_CHOICE': {
          const sentence = promptStr(p, 'sentenceJa')
          const parts = blankParts(sentence)
          if (parts) {
            addKanji(parts.before)
            addKanji(parts.after)
          } else addKanji(sentence)
          for (const c of promptArr(p, 'choices')) add(c)
          break
        }
        case 'LISTEN_RESPOND':
          if (it.textRevealed) add(promptStr(p, 'textJa'))
          add(it.answerText)
          break
        case 'SITUATION_RESPOND':
          add(it.answerText)
          break
        case 'ASSEMBLE':
          for (const piece of promptArr(p, 'pieces')) addKanji(piece)
          break
        case 'CORRECTION_SPOT':
          add(promptStr(p, 'sentenceJa'))
          break
        default:
          break
      }
      continue
    }
    switch (it.kind) {
      case 'USAGE_CHOICE': {
        const sentence = promptStr(p, 'sentenceJa')
        add(filledRange(sentence, it.answerText, '')?.text)
        add(filledRange(sentence, usageRightFill(it), '')?.text)
        break
      }
      case 'READING_INPUT':
        add(it.answerText)
        add(str(e.reading))
        break
      case 'ASSEMBLE':
        add(assembleMineText(it))
        add(assembleRightText(it))
        break
      case 'LISTEN_RESPOND':
        add(promptStr(p, 'textJa'))
        add(it.answerText)
        add(str(e.modelAnswerJa))
        break
      case 'SITUATION_RESPOND':
        add(it.answerText)
        add(str(e.modelAnswerJa))
        break
      case 'CORRECTION_SPOT': {
        const sentence = promptStr(p, 'sentenceJa')
        const corrected = str(e.correctedJa)
        add(sentence)
        add(fixLineRanges(sentence, str(e.wrongSpan), corrected, { wrong: '', fix: '' })?.text)
        add(corrected)
        break
      }
      default:
        break
    }
  }
  return out
}
