/**
 * 대답 연습 제안(`replyPractice`, S10 `POST /api/v1/chats/:id/reply-practice` #169) 응답 계약 — task-010d PE-2b. 프롬프트는 `prompts/replyPractice.ts`.
 *
 * 설계(왜 모델 출력이 S10 응답 모양과 다른가):
 *  - 화면(`PracticeDock`)의 S10 응답은 `{ja, ko, blank?{start,end}, choices?[3], answerIndex?, hintKo?}` 다. 그런데 **LLM 이 코드포인트 구간(`start`·`end`)과 정답 위치를 직접 내게 하면 틀리기 쉽다**
 *    (글자 수 세기 오류·정답이 늘 첫 칸/둘째 칸에 몰리는 편향). 그래서 모델은 `blankText`(ja 안에 글자 그대로 있는 빈칸 정답)와 `distractors`(틀린 보기 2개)만 낸다.
 *    **코드가** ja 에서 `blankText` 를 찾아 구간을 계산하고(`blank = {start, end}`, 코드포인트·끝은 제외 — `Array.from(ja).slice(start, end).join('') === choices[answerIndex]`),
 *    보기 3개를 정답 위치를 섞어 만든다(위치 = ja 해시 % 3 — 같은 문장이면 같은 배치라 시험이 재현되고, 문장마다는 고르게 퍼진다).
 *  - **고르기 세트는 통째로 있거나 없거나다**: `blank`·`choices`·`answerIndex` 는 서로 묶여 있다 — 하나라도 어긋나면(빈칸이 ja 안에 없음·보기가 겹침·범위 밖 등) 셋을 모두 버린다.
 *    화면은 `splitBlank` 가 null 이면 [고르기]를 비활성하고 [말하기]·[따라 하기]로 연다(가이드 §3-E `pr-noblank`) — 그래서 `ja`·`ko` 는 항상 남는다.
 *  - `hintKo` 는 **정답을 새게 하면 버린다**(일본어 글자가 하나라도 있거나 정답 표기를 포함) — [힌트]와 [정답 보기]가 별개 단계이기 때문이다. 버려지면 화면이 [힌트] 버튼을 감춘다(`hintKo` 가 있을 때만).
 *  - 서버는 응답을 보내기 직전 `checkReplyPracticeShape` 로 한 번 더 검사할 수 있다(JSON 왕복·수동 변경 방어) — 위반이 있으면 `dropChoiceSet` 으로 셋을 버린다.
 */

export type ReplyPracticeDropReason =
  | 'BLANK_EMPTY'
  | 'BLANK_TOO_LONG'
  | 'BLANK_NOT_IN_JA'
  | 'BLANK_NOT_JAPANESE'
  | 'BLANK_COVERS_SENTENCE'
  | 'DISTRACTOR_COUNT'
  | 'DISTRACTOR_NOT_JAPANESE'
  | 'DISTRACTOR_TOO_LONG'
  | 'DISTRACTOR_SAME_AS_ANSWER'
  | 'DISTRACTOR_DUPLICATE'
  | 'DISTRACTOR_OVERLAP'

export type ReplyPracticeHintDrop = 'HINT_EMPTY' | 'HINT_LEAK'

export const REPLY_PRACTICE_JA_MAX = 60
export const REPLY_PRACTICE_KO_MAX = 80
export const REPLY_PRACTICE_BLANK_MAX = 20
/** 모델이 내는 틀린 보기 수 상한 — 쓰이는 것은 2개, 3번째는 앞의 것이 정답·다른 보기와 겹칠 때를 위한 예비다. */
export const REPLY_PRACTICE_DISTRACTORS_MAX = 3
export const REPLY_PRACTICE_HINT_MAX = 60
/** 빈칸이 문장의 이 비율(코드포인트)을 넘으면 연습이 되지 않는다 — 고르기 세트를 버린다. */
export const REPLY_PRACTICE_BLANK_RATIO_MAX = 0.7

export interface ReplyPracticeModel {
  ja: string
  ko: string
  blankText: string
  distractors: string[]
  hintKo: string
}

const str = (max: number, min = 1) => ({ type: 'string', minLength: min, maxLength: max }) as const

export const REPLY_PRACTICE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ja', 'ko', 'blankText', 'distractors', 'hintKo'],
  properties: {
    // 선언 순서 = 출력 순서: 대답 문장 → 뜻 → 그 안의 빈칸 정답 → 틀린 보기 → 힌트.
    ja: str(REPLY_PRACTICE_JA_MAX),
    ko: str(REPLY_PRACTICE_KO_MAX),
    blankText: str(REPLY_PRACTICE_BLANK_MAX),
    // 2~3개: 쓰이는 것은 2개. 3번째는 예비(앞의 보기가 정답·다른 보기와 겹치면 코드가 건너뛰고 다음 것을 쓴다 — 세트를 통째로 버리는 일을 줄인다).
    distractors: { type: 'array', minItems: 2, maxItems: REPLY_PRACTICE_DISTRACTORS_MAX, items: str(REPLY_PRACTICE_BLANK_MAX) },
    // 힌트가 정답을 새게 할 수밖에 없으면 비워도 된다(코드가 새는 힌트를 버리는 것과 같은 결과) — 재시도를 만들지 않는다.
    hintKo: str(REPLY_PRACTICE_HINT_MAX, 0),
  },
} as const

/** S10 응답 중 모델·코드가 만드는 부분(`messageId` 는 서버가 붙인다). */
export interface ReplyPracticeSuggestion {
  ja: string
  ko: string
  /** `[start, end)` 코드포인트 구간 — `Array.from(ja).slice(start, end).join('')` 이 정답이다. */
  blank?: { start: number; end: number }
  choices?: [string, string, string]
  answerIndex?: 0 | 1 | 2
  hintKo?: string
}

export interface ReplyPracticeFinal {
  /** `false` 면 대답 문장(`ja`·`ko`)이 쓸 수 없다 — 라우트가 5xx(`pr-error`). */
  ok: boolean
  suggestion: ReplyPracticeSuggestion | null
  /** 고르기 세트를 버린 이유(없으면 세트가 있다). Trace 수치용 — 글 원문 없음. */
  choiceSetDropped: ReplyPracticeDropReason | null
  hintDropped: ReplyPracticeHintDrop | null
}

const BRAILLE_BLANK = String.fromCodePoint(0x2800)

/** 한 줄 글 정리 — 공백류 → 한 칸, 서식·제어·무시 가능 문자 제거. */
export function cleanPracticeText(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw
    .split(BRAILLE_BLANK)
    .join('')
    .replace(/\s+/g, ' ')
    .replace(/[\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}<>]/gu, '')
    .replace(/ {2,}/g, ' ')
    .trim()
}

const cps = (s: string): string[] => Array.from(s)
const JA_CHAR = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u
const HANGUL = /\p{Script=Hangul}/u
/** 사이즈·숫자 같은 1~3자 영숫자(「Lでお願いします」의 L)는 빈칸·보기가 될 수 있다. */
const SHORT_CODE = /^[A-Za-z0-9０-９Ａ-Ｚａ-ｚ]{1,3}$/u
/** 빈칸 정답·보기로 쓸 수 있는 글 — 일본어 글자가 있거나 1~3자 영숫자 코드이고 한글이 없다. */
const isAnswerText = (t: string): boolean => !HANGUL.test(t) && (JA_CHAR.test(t) || SHORT_CODE.test(t))
const STRIP = /[\s　、。，．,.!！?？・「」『』（）()【】〔〕［］[\]〈〉《》…‥~〜～"'“”‘’:：;；-]/g
const kataToHira = (s: string): string => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
/** 보기 비교용 정규화 — 가나 종류·부호·공백을 걷어 같은 말을 같게 본다. */
const form = (s: string): string => kataToHira(s.normalize('NFKC')).toLowerCase().replace(STRIP, '')

/** 문자열 → 0 이상 정수(FNV-1a). 정답 위치를 문장마다 고르게·재현 가능하게 정한다. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5
  for (const ch of s) {
    h ^= ch.codePointAt(0)!
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/** 정답 위치(0~2) — 같은 `ja` 면 같은 값. */
export function answerPositionFor(ja: string): 0 | 1 | 2 {
  return (fnv1a(ja) % 3) as 0 | 1 | 2
}

/** `ja` 안에서 `answer` 가 처음 나오는 코드포인트 구간. 없으면 null. */
export function findBlank(ja: string, answer: string): { start: number; end: number } | null {
  const a = cps(ja)
  const b = cps(answer)
  if (!b.length || b.length > a.length) return null
  for (let i = 0; i + b.length <= a.length; i++) {
    let ok = true
    for (let j = 0; j < b.length; j++) {
      if (a[i + j] !== b[j]) {
        ok = false
        break
      }
    }
    if (ok) return { start: i, end: i + b.length }
  }
  return null
}

/**
 * S10 의 "고르기 세트" 불변식 검사(서버가 응답 직전에 부를 수 있는 단일 출처). 위반 문구를 돌려준다(없으면 빈 배열).
 * - `blank`·`choices`·`answerIndex` 는 모두 있거나 모두 없다.
 * - `0 <= start < end <= ja 코드포인트 수` · `choices` 3개(서로 다른 글, 정규화 기준) · `answerIndex` 0~2 · 정답 보기가 빈칸 구간의 글과 같다.
 */
export function checkReplyPracticeShape(s: ReplyPracticeSuggestion): string[] {
  const v: string[] = []
  if (typeof s.ja !== 'string' || !s.ja.trim()) v.push('ja 가 비어 있다')
  if (typeof s.ko !== 'string' || !s.ko.trim()) v.push('ko 가 비어 있다')
  const set = [s.blank !== undefined, s.choices !== undefined, s.answerIndex !== undefined]
  if (set.some(Boolean) && !set.every(Boolean)) {
    v.push('blank·choices·answerIndex 는 함께 있어야 한다')
    return v
  }
  if (!set[0]) return v
  const len = cps(s.ja).length
  const b = s.blank!
  if (!Number.isInteger(b.start) || !Number.isInteger(b.end) || b.start < 0 || b.start >= b.end || b.end > len) v.push(`blank 범위 [${b.start}, ${b.end}) 가 ja(${len}자) 밖이다`)
  const c = s.choices!
  if (!Array.isArray(c) || c.length !== 3 || c.some((x) => typeof x !== 'string' || !x.trim())) v.push('choices 는 비지 않은 글 3개여야 한다')
  else if (new Set(c.map(form)).size !== 3) v.push('choices 에 같은 글이 있다')
  if (s.answerIndex !== 0 && s.answerIndex !== 1 && s.answerIndex !== 2) v.push('answerIndex 는 0~2 여야 한다')
  if (!v.length && cps(s.ja).slice(b.start, b.end).join('') !== c[s.answerIndex!]) v.push('정답 보기가 빈칸 구간의 글과 다르다')
  return v
}

/** 고르기 세트를 버린 제안(검사 통과 불가 시 라우트가 쓴다). */
export function dropChoiceSet(s: ReplyPracticeSuggestion): ReplyPracticeSuggestion {
  const out: ReplyPracticeSuggestion = { ja: s.ja, ko: s.ko }
  if (s.hintKo !== undefined) out.hintKo = s.hintKo
  return out
}

/** 보기 하나를 읽는다 — 정리한 글 또는 버림 이유. */
function readDistractor(raw: unknown): { text: string } | { drop: ReplyPracticeDropReason } {
  const t = cleanPracticeText(raw)
  if (!t || !isAnswerText(t)) return { drop: 'DISTRACTOR_NOT_JAPANESE' }
  if (cps(t).length > REPLY_PRACTICE_BLANK_MAX) return { drop: 'DISTRACTOR_TOO_LONG' }
  return { text: t }
}

/**
 * 모델 응답 → S10 응답(`messageId` 제외). 대답 문장(`ja`·`ko`)이 쓸 수 없으면 `ok:false`, 그 밖의 어긋남은 해당 칸만 버린다(위 설계 주석).
 * `position` 은 시험용 — 주면 정답 보기 위치를 고정한다(기본은 `answerPositionFor(ja)`).
 */
export function finalizeReplyPractice(data: ReplyPracticeModel, opts: { position?: 0 | 1 | 2 } = {}): ReplyPracticeFinal {
  const ja = cleanPracticeText(data?.ja)
  const ko = cleanPracticeText(data?.ko)
  const none: ReplyPracticeFinal = { ok: false, suggestion: null, choiceSetDropped: null, hintDropped: null }
  if (!ja || !JA_CHAR.test(ja) || HANGUL.test(ja) || cps(ja).length > REPLY_PRACTICE_JA_MAX) return none
  if (!ko || cps(ko).length > REPLY_PRACTICE_KO_MAX) return none
  const suggestion: ReplyPracticeSuggestion = { ja, ko }

  // ① 고르기 세트 — 통째로.
  let dropped: ReplyPracticeDropReason | null = null
  const answer = cleanPracticeText(data?.blankText)
  if (!answer) dropped = 'BLANK_EMPTY'
  else if (cps(answer).length > REPLY_PRACTICE_BLANK_MAX) dropped = 'BLANK_TOO_LONG'
  else if (!isAnswerText(answer)) dropped = 'BLANK_NOT_JAPANESE'
  const range = !dropped ? findBlank(ja, answer) : null
  if (!dropped && !range) dropped = 'BLANK_NOT_IN_JA'
  if (!dropped && range && (range.end - range.start) / cps(ja).length > REPLY_PRACTICE_BLANK_RATIO_MAX) dropped = 'BLANK_COVERS_SENTENCE'
  const ds = Array.isArray(data?.distractors) ? data.distractors.slice(0, REPLY_PRACTICE_DISTRACTORS_MAX) : []
  if (!dropped && ds.length < 2) dropped = 'DISTRACTOR_COUNT'
  if (!dropped) {
    // 앞에서부터 쓸 수 있는 보기 2개를 고른다 — 일본어가 아님·너무 김·정답과 같음·이미 고른 보기와 같음·한쪽이 다른 쪽에 통째로 들어감(예: 정답 「アイスコーヒー」·보기 「コーヒー」,
    // 같은 뜻으로 읽힐 수 있다)은 건너뛴다. 2개를 못 채우면 첫 건너뜀 이유로 세트를 버린다.
    const fa = form(answer)
    const picked: string[] = []
    const pickedForms: string[] = []
    let firstReject: ReplyPracticeDropReason | null = null
    for (const raw of ds) {
      if (picked.length === 2) break
      const r = readDistractor(raw)
      let reject: ReplyPracticeDropReason | null = null
      if ('drop' in r) reject = r.drop
      else {
        const f = form(r.text)
        if (!f) reject = 'DISTRACTOR_NOT_JAPANESE'
        else if (f === fa) reject = 'DISTRACTOR_SAME_AS_ANSWER'
        else if (pickedForms.includes(f)) reject = 'DISTRACTOR_DUPLICATE'
        else if ([fa, ...pickedForms].some((o) => f.includes(o) || o.includes(f))) reject = 'DISTRACTOR_OVERLAP'
        else {
          picked.push(r.text)
          pickedForms.push(f)
        }
      }
      if (reject && !firstReject) firstReject = reject
    }
    if (picked.length < 2) dropped = firstReject ?? 'DISTRACTOR_COUNT'
    else {
      const pos = opts.position ?? answerPositionFor(ja)
      const choices: string[] = [...picked]
      choices.splice(pos, 0, answer)
      suggestion.blank = range!
      suggestion.choices = choices as [string, string, string]
      suggestion.answerIndex = pos
    }
  }
  // 마지막 방어 — 만든 세트가 불변식을 어기면(있을 수 없지만) 버린다.
  if (!dropped && checkReplyPracticeShape(suggestion).length) {
    delete suggestion.blank
    delete suggestion.choices
    delete suggestion.answerIndex
    dropped = 'BLANK_NOT_IN_JA'
  }

  // ② 힌트 — 정답을 새게 하면 버린다.
  let hintDropped: ReplyPracticeHintDrop | null = null
  const hint = cleanPracticeText(data?.hintKo)
  if (!hint) hintDropped = 'HINT_EMPTY'
  else if (cps(hint).length > REPLY_PRACTICE_HINT_MAX || JA_CHAR.test(hint)) hintDropped = 'HINT_LEAK'
  else suggestion.hintKo = hint
  return { ok: true, suggestion, choiceSetDropped: dropped, hintDropped }
}

/** `completeJson` 의 `extraCheck` — 대답 문장이 쓸 수 없을 때만 알려 재시도 1회로 보낸다(보기·힌트는 코드가 해당 칸만 버린다). */
export function replyPracticeViolations(data: ReplyPracticeModel): string[] {
  const fin = finalizeReplyPractice(data)
  if (fin.ok) return []
  return ['ja 는 한국어 없이 일본어로 쓴 대답 한 문장(60자 이내)이어야 하고, ko 는 그 한국어 뜻(80자 이내)이어야 합니다.']
}
