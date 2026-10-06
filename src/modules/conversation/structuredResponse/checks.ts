/**
 * 스키마로 표현하지 못하는 후검증 — 위반 문구 배열을 돌려주면 engine.llm.completeJson 이 1회 재시도한다.
 *
 * 원문 무수정(검증 세트 V1 — 실패는 CRITICAL, 정본 design-spec §8 "`correction.original` 바이트 일치"):
 *  - TALK·CHAT: `original` 은 이번 학습자 말과 **바이트 단위로 같아야** 한다(부분 인용 없음).
 *  - REVIEW: 여러 문장짜리 메시지에서 틀린 문장 하나를 짚을 수 있어야 하므로 **메시지 전체 또는 문장 하나 전체**
 *    (。！？!? · 줄바꿈 경계)와 같아야 한다. 문장 안의 임의 조각(예: 2글자)은 인정하지 않는다
 *    — 조각 인용을 허용하면 일본어에서는 거의 모든 두 글자가 원문에 있어 검사가 무력해진다(reviewer REV-004 Critical).
 *  - 앞뒤 공백을 걷어 내고 비교하지 않는다 — 모델이 고친 흔적을 숨기지 않기 위해서다.
 * 저장 시에는 라우트가 모델 값이 아니라 **서버가 가진 원문**을 `Correction.original` 에 넣는다(task-006) — 이 검사는 계약 위반 탐지용이다.
 */
import { llm } from '@/modules/engine'
import { chunkAppearsIn } from './matching'
import { LESSON_CHUNKS_MAX } from './schemas'
import type { ChatReviewResponse, LessonResponse, TutorResponse, WordEnrichResponse } from './schemas'

/** TALK·CHAT: 바이트 일치만. */
export function isExactOriginal(input: string, original: string): boolean {
  return original === input
}

/** 문장 경계(。！？!? 뒤·줄바꿈)로 나눈 문장들. 각 문장의 앞뒤 공백만 걷는다(문장 사이 공백 처리용). */
export function splitJaSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？!?])|\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** REVIEW: 메시지 전체 또는 문장 하나 전체와 바이트 일치. */
export function isVerbatimQuote(input: string, original: string): boolean {
  if (original === input) return true
  return splitJaSentences(input).includes(original)
}

/** 일본어 문장 수 — 。！？!? 로 끝나는 덩어리를 센다(끝 부호가 없는 마지막 덩어리도 1문장). */
export function countJaSentences(text: string): number {
  const parts = text.split(/(?<=[。！？!?])/).map((s) => s.trim()).filter(Boolean)
  return parts.length
}

/**
 * replyJa 문장 수 **기본** 상한(`opts.maxSentences` 를 안 줄 때 — CHAT(`checkChatResponse`, 프롬프트 목표 최대 2문장)과 sceneCap 없는
 * 호출). TALK 는 talk@v4(task-024)부터 `sceneCap`(1~4) + `TALK_SCENE_CAP_TOLERANCE` 를 `maxSentences` 로 넘긴다(`prompts/talk.ts`).
 * 기본값의 근거: 프롬프트 목표는 2문장이지만 **재시도는 3문장 초과에서만** 건다. 실측(2026-09-27)에서 haiku 가 짧은 3문장을
 * 종종 써서 재시도가 붙으면 턴이 ~10s 로 늘었다(12s fail-fast 위협). 3문장은 TTS·화면에 무리가 없어 계약 위반으로 보지 않는다.
 */
export const REPLY_SENTENCE_HARD_CAP = 3

export function checkTalkResponse(input: string, data: TutorResponse, opts: { maxSentences?: number } = {}): string[] {
  const v: string[] = []
  const max = opts.maxSentences ?? REPLY_SENTENCE_HARD_CAP
  if (countJaSentences(data.conversation.replyJa) > max) v.push(`conversation.replyJa 는 ${max}문장 이내여야 한다`)
  const c = data.correction
  if (c) {
    if (!isExactOriginal(input, c.original)) {
      v.push('correction.original 은 [입력]의 학습자 말 전체를 한 글자도 바꾸지 않고 그대로 복사해야 한다(일부만 인용하거나 공백·문장부호를 바꾸지 않는다)')
    }
    if (c.corrected === c.original) v.push('correction.corrected 가 original 과 같다 — 오류가 없으면 correction 을 null 로 둔다')
    // task-010c(talk@v3) — 코치 모드 힌트가 정답을 그대로 흘리면 "스스로 고치기 유도"라는 목적을 잃는다.
    if (c.hintKo && c.hintKo.includes(c.corrected)) {
      v.push('correction.hintKo 에 정답(corrected)을 그대로 포함하면 안 된다 — 정답을 직접 말하지 않는 힌트여야 한다')
    }
  }
  return v
}

/**
 * task-028(IMP-0020) — `conversation.replyKo`(한국어 번역) 이중 높임 후검증. 재현(2026-10-03, traceId
 * `t_rApoXn51DLgsUlR4OfBD`): 일본어는 정상(「ビニール袋をお付けします」)이었는데 번역이 「비닐봉투를 드려드리겠습니다」
 * (겸양 「드리다」가 "드려"로 한 번 더 겹친 이중 높임 비문)로 나왔다. 지시문(`prompts/talk.ts` tail)만으로 모든 모델·조합을
 * 막는다는 보장이 없어 **명백한 패턴 하나만** 좁게 잡는다 — "드려드리"가 붙어 나오면 걸고, "드려요"·"말씀드립니다"처럼
 * 정상적으로 "드리"가 한 번만 쓰이는 표현은 걸리지 않는다. 뒤의 "드리" 활용(드릴게요처럼 ㄹ 로 축약되는 형태 포함 — 드리/드릴/
 * 드린/드립/드렸)까지 본다(픽스처 t05 "안내해드려드릴게요"). **TALK(A1) 전용** — `checkTalkResponse`(CHAT 도 이것을
 * 호출한다)가 아니라 `buildTalkRequest` 의 `extraCheck` 에서만 이 함수를 추가로 합성한다(task-028 범위: 채팅(A2) 번역은
 * 비범위 — 같은 문제가 보이면 보고만 한다는 Leader 결정).
 */
const DOUBLE_HONORIFIC_KO_RE = /드려\s*(드리|드릴|드린|드립|드렸)/

export function checkReplyKoNaturalness(replyKo: string, field: string = 'conversation.replyKo'): string[] {
  return DOUBLE_HONORIFIC_KO_RE.test(replyKo)
    ? [`${field} 에 이중 높임("드려드리"처럼 겸양을 두 번 겹친 표현)이 있다 — 한 번만 자연스럽게 높인다(예: "드리겠습니다"·"넣어 드리겠습니다")`]
    : []
}

/**
 * task-026(talk@v7·chat@v2) — 학습자 말 번역 `userKo` 의 이중 높임 검사. **재시도 대상이 아니다**(REV-086 M3) — 번역은 부가 정보라
 * 이 때문에 ajv 재시도(≈+10s, 12s fail-fast 위협)나 턴 실패를 만들지 않는다. `sanitizeUserKo` 가 걸리면 null 로 버린다
 * (replyKo 후검증과 달리 TALK·CHAT extraCheck 에 합성하지 않는다). 공개 함수는 정리 함수·테스트가 쓴다.
 */
export function checkUserKoNaturalness(userKo: string | null | undefined): string[] {
  return typeof userKo === 'string' ? checkReplyKoNaturalness(userKo, 'userKo') : []
}

const USER_KO_HANGUL_RE = /[\u1100-\u11ff\u3131-\u318e\uac00-\ud7a3]/
const USER_KO_JAPANESE_RE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/

/**
 * `userKo` 저장 상한(UTF-16 길이). 입력은 최대 1,000자(`TURN_TEXT_MAX`)이고 번역은 같은 자릿수라 2,000 이면 정상 번역을 막지 않으면서 폭주 출력만
 * 거른다. 입력이 짧은데 번역이 폭주한 경우는 입력의 4배(최소 200)로 더 조인다. 넘으면 **자르지 않고 null** — 문장 중간에서 잘린 번역은
 * 틀린 뜻을 보이게 하므로 [다시 가져오기] 가 낫다.
 */
export const USER_KO_STORE_MAX = 2_000
export function userKoStoreLimit(input: string): number {
  return Math.min(USER_KO_STORE_MAX, Math.max(200, input.trim().length * 4))
}

/**
 * `userKo` 저장 전 정리(순수) — 저장할 값을 돌려주고, 못 쓰면 null(내 발화 `translation` 을 비워 두고 화면이 [다시 가져오기] 를 보인다).
 * **어떤 입력에도 던지지 않고 재시도도 없다**(스키마는 `userKo` 를 선택·null 허용·길이 무제한으로 둔다 — REV-086 M3).
 * null 이 되는 경우: ① 누락·null·문자열 아님·공백뿐 ② 저장 상한(`userKoStoreLimit`) 초과 — 자르지 않음 ③ 입력과 같은 문자열(베끼기)
 * ④ 일본어가 든 입력인데 한글이 하나도 없음(원문 베끼기·번역 거부) ⑤ 이중 높임(`checkUserKoNaturalness`).
 * 입력에 일본어가 없으면(숫자·영어 한 마디 등) 한글 유무를 따지지 않는다.
 */
export function sanitizeUserKo(input: string, userKo: unknown): string | null {
  if (typeof userKo !== 'string') return null
  const t = userKo.trim()
  if (!t) return null
  if (t.length > userKoStoreLimit(input)) return null
  if (t === input.trim()) return null
  if (USER_KO_JAPANESE_RE.test(input) && !USER_KO_HANGUL_RE.test(t)) return null
  if (checkUserKoNaturalness(t).length > 0) return null
  return t
}

/**
 * task-039(talk@v9, IMP-0025) — `correction.extraNoteKo`(JLPT·교과서식 추가 설명) 저장 상한(UTF-16 길이). 지시문 권고는 `EXTRA_NOTE_PROMPT_MAX`(40자)이고 실측(task-039 이력서: 채움 39건 중앙값 19자·p90 34자·최대 43자)에서 모델이 넘기는 길이를 본 뒤
 * 정했다. 넘으면 **자르지 않고 null** — 문장 중간에서 잘린 문형 설명은 틀린 정보를 보이게 한다(`userKo` 와 같은 방침).
 */
export const EXTRA_NOTE_STORE_MAX = 200
const EXTRA_NOTE_HANGUL_RE = /[\u1100-\u11ff\u3131-\u318e\uac00-\ud7a3]/
/** 학습자 원문 통째 복사 검사를 거는 최소 길이(비교용 정규화 — NFKC·공백·구두점 제거 — 뒤 글자 수). 「はい」 같은 짧은 말은 설명 속 짧은 인용과 우연히 겹쳐 정상 값을 버리게 된다. */
export const EXTRA_NOTE_LEARNER_MIN = 4
/**
 * 추가 설명의 보이지 않는 문자 처리(REV-115 L-1 · Codex C2 low). 접기 = 공백 하나로 바꿔 저장, 거부 = 값 전체를 null.
 *
 * | 문자 | 처리 |
 * |---|---|
 * | JS `\s` 공백류(U+0009–000D·U+0020·U+00A0·U+1680·U+2000–200A·U+202F·U+205F·U+3000)·줄바꿈류 U+0085(NEL)·U+2028·U+2029 | 접기 |
 * | 서식 문자 `\p{Cf}` 전부 — U+200B–200F(ZWSP·ZWNJ·ZWJ·LRM·RLM)·U+202A–202E(BiDi 임베딩·덮어쓰기)·U+2060–2064·U+2066–2069(isolate)·U+FEFF·U+00AD·U+061C·U+E0001·U+E0020–E007F(태그) 등 | 거부(접기 **전**에 검사) |
 * | 기본 무시 코드 포인트 `\p{Default_Ignorable_Code_Point}` — U+034F(CGJ)·U+115F·U+1160·U+3164·U+FFA0(한글 채움)·U+FE00–FE0F·U+E0100–E01EF(변이 선택자)·U+17B4·U+17B5·U+180B–180F 등 | 거부(접기 전) |
 * | U+2800(점자 빈 칸 — 기본 무시 문자가 아니지만 빈 칸으로 보인다)·짝 없는 서로게이트(`\p{Cs}`) | 거부(접기 전) |
 * | 접은 뒤 남은 C0·DEL·C1(U+0000–001F·U+007F·U+0080–009F) | 거부 |
 *
 * 서식·제어 문자는 화면에 보이지 않으면서 글자 순서(BiDi)·경계를 바꿔 저장된 문자열과 보이는 설명을 다르게 만든다. 한·일 문형 설명 한 줄에 나올 이유가 없으니
 * 지워서 살리지 않고 값이 오염됐다는 신호로 보고 버린다(부가 정보라 버려도 줄이 안 보일 뿐이다). U+FEFF 는 JS `\s` 에 들어 있어 접기 전에 봐야 거부된다.
 * 한글 채움(U+3164 등)은 한글 검사까지 만족시키므로 한글 검사보다 먼저 걸러야 빈 줄이 저장되지 않는다(REV-116 L-7 · Codex C2 3차).
 * 줄바꿈류는 개행과 같은 뜻이라 거부하지 않고 접는다(한 줄 계약 — Codex C1 low).
 */
// 변이 선택자 U+FE0F 가 붙는 이모지(U+2764 U+FE0F 류)·ZWJ 이모지 시퀀스도 함께 거부된다 — 일본어 문형 설명 칸에 이모지를 쓸 이유가 없고 실데이터(TALK·A3)에 U+FE0F·ZWJ 가 든 값이 0건이라 오탐 비용이 없다.
const INVISIBLE_CHAR_RE = /[\p{Cf}\p{Default_Ignorable_Code_Point}\p{Cs}\u{2800}]/u
const oneLine = (s: string) => s.replace(/[\s\u0085]+/g, ' ').trim()
const hasControlChar = (s: string) => {
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i)
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return true
  }
  return false
}
/**
 * 원문·메인 설명 복제 비교 전용(REV-115 L-1 ⓐ · REV-116 L-7) — NFKC(반각·전각 통일) 뒤 공백·구두점(`\p{P}`: 。、．，.,!?！？「」『』()（）…〜・ 등)과
 * `INVISIBLE_CHAR_RE` 의 보이지 않는 문자를 지운다. 추가 설명 쪽은 이미 거부됐으니, 비교 **상대**(학습자 원문·메인 설명)에 낀 보이지 않는 문자 때문에
 * 화면상 같은 글의 복제를 놓치지 않게 하려는 것이다. 저장값은 바꾸지 않는다.
 */
const comparable = (s: string) => s.normalize('NFKC').replace(/[\s\p{P}\p{Cf}\p{Default_Ignorable_Code_Point}\p{Cs}\u{2800}]/gu, '')

/**
 * `extraNoteKo` 저장 전 정리(순수) — 저장·표시할 값을 돌려주고, 못 쓰면 null(화면은 추가 설명 줄을 그리지 않는다). **어떤 입력에도 던지지 않고 재시도도 없다**(스키마는 이 필드를 선택·null 허용·길이 무제한으로
 * 둔다 — 부가 정보가 ajv 재시도(≈+6s)나 턴 실패를 만들면 안 된다, `sanitizeUserKo` 와 같은 구조).
 * 저장값은 **한 줄**이다(Codex C1 low): 개행·탭·NEL 등 공백류는 공백 하나로 접는다 — 여러 줄 값이 카드·텍스트 출력의 줄 경계를 깨지 않게(접기·거부 문자 표는 `INVISIBLE_CHAR_RE` 위 주석).
 * null 이 되는 경우: ① 누락·null·문자열 아님·공백뿐 ② 보이지 않는 문자(`\p{Cf}`·기본 무시 코드 포인트·U+2800·짝 없는 서로게이트) 포함 — 접기 전 원값으로 판단
 * ③ 접은 뒤 저장 상한(`EXTRA_NOTE_STORE_MAX`) 초과 — 자르지 않음 ④ 접은 뒤에도 제어문자(U+0000–001F·U+007F·U+0080–009F) 잔존 ⑤ 한글이 하나도 없음(한국어 추가 설명이어야 한다)
 * ⑥ `explanationKo` 와 같거나 `explanationKo` 를 통째로 포함(메인 설명 베끼기 — 추가 정보가 없다). 양쪽을 `comparable` 로 맞춘 뒤 비교하고(REV-116 L-7 — 공백·구두점·보이지 않는 문자
 *    삽입으로 빠져나가지 않게), 정규화한 메인 설명이 빈 문자열이면 검사하지 않는다(빈 문자열은 무엇에나 포함된다)
 * ⑦ `learnerText`(서버가 가진 학습자 원문)를 통째로 포함(Codex C1 medium — 「참고: <학습자 발화>」 처럼 원문이 새 칸으로 복제·반출되지 않게). 양쪽을 `comparable`(NFKC·공백·구두점·보이지 않는 문자 제거)로
 *    맞춘 뒤 비교하고(REV-115 L-1 — 끝 구두점·반각/전각 차이로 빠져나가지 않게), 정규화한 원문이 `EXTRA_NOTE_LEARNER_MIN` 자 미만이면 검사하지 않는다. 인자를 안 주면 검사 없음(옛 두 인자 호출 호환)
 * ⑧ 엔진·모델 이름 노출(엔진명은 화면·저장에 새지 않는다).
 */
export function sanitizeExtraNoteKo(explanationKo: string, extraNoteKo: unknown, learnerText?: string): string | null {
  if (typeof extraNoteKo !== 'string') return null
  if (INVISIBLE_CHAR_RE.test(extraNoteKo)) return null
  const t = oneLine(extraNoteKo)
  if (!t) return null
  if (t.length > EXTRA_NOTE_STORE_MAX) return null
  if (hasControlChar(t)) return null
  if (!EXTRA_NOTE_HANGUL_RE.test(t)) return null
  const tc = comparable(t)
  const main = typeof explanationKo === 'string' ? comparable(explanationKo) : ''
  if (main && tc.includes(main)) return null
  const learner = typeof learnerText === 'string' ? comparable(learnerText) : ''
  if (learner.length >= EXTRA_NOTE_LEARNER_MIN && tc.includes(learner)) return null
  if (llm.mentionsEngineIdentity(t)) return null
  return t
}

export function checkChatResponse(input: string, data: TutorResponse): string[] {
  const v = checkTalkResponse(input, { ...data, correction: null })
  if (data.correction !== null) v.push('CHAT 모드에서 correction 은 항상 null 이다')
  return v
}

export function checkChatReview(messages: { id: string; text: string }[], data: ChatReviewResponse): string[] {
  const v: string[] = []
  const byId = new Map(messages.map((m) => [m.id, m.text]))
  data.items.forEach((it, i) => {
    const text = byId.get(it.message_id)
    if (text === undefined) {
      v.push(`items[${i}].message_id '${it.message_id}' 는 입력에 없는 id 다 — 받은 id 를 그대로 써야 한다`)
      return
    }
    if (!isVerbatimQuote(text, it.original)) v.push(`items[${i}].original 은 해당 메시지 전체 또는 그 안의 문장 하나 전체를 한 글자도 바꾸지 않고 인용해야 한다`)
    if (it.corrected === it.original) v.push(`items[${i}].corrected 가 original 과 같다`)
  })
  return v
}

/**
 * A10 단어 보강(V9 계열) — 스키마가 표현 못 하는 두 가지만 본다: ① `valid` 와 나머지 필드의 일관성
 * ② `example` 이 `surface` 를 표기 그대로(한자·가나 변경 없이) 포함하는지.
 *
 * **활용형 예외를 둔다(2026-09-27 실측 결정, 최초에는 "예외 없음"으로 갔다가 뒤집음)**: 처음에는 `surface` 가
 * 사전형이든 활용형(예: 「行きました」)이든 리터럴 부분 일치만 보면 된다고 판단했다. 그런데 haiku 로 12건 실측 중
 * VERB `かける`(다의어 픽스처, w08)가 **재시도 1회 후에도 계속 드롭됐다**(위반율 1/12 ≈ 8% > 목표 5%). 원인은
 * 표기 이탈이 아니라 — 프롬프트로 "표기 그대로" 를 아무리 강조해도 모델이 자연스러움을 위해 예문을 활용형으로
 * 쓰기 때문이었다(`かける` 사전형 대신 `かけました`/`かけて` 등, `raw` 확인: 재시도 두 후보 모두 활용형).
 * VERB(食べる) 도 최초 실측에서 1회 재시도가 필요했던 항목이었다(정본형 대신 활용 시도가 먼저 나옴) — 이 카테고리
 * 전체가 구조적으로 걸린다는 뜻이다. 그래서 VERB·ADJ_I 는 **어간(표기에서 마지막 1글자를 뺀 나머지)**이
 * 리터럴로 들어 있으면 통과시킨다 — 일본어 활용은 어간을 보존하고 어미만 바꾸므로(1군 동사·い형용사는 항상,
 * カ변格·サ변格 같은 불규칙 동사·「いい」 같은 예외는 못 잡지만 드물다) 값싸고 결정적인 근사다. 그 밖의 품사
 * (NOUN·ADJ_NA·ADVERB·PARTICLE·EXPRESSION·OTHER)는 활용이 없으니 여전히 리터럴 전체 일치만 인정한다 —
 * 여기서 어간 근사를 쓰면 한자→가나 이탈(예: 「掛ける」로 바꿔치기) 같은 진짜 계약 위반을 놓친다.
 *
 * `reading` 이 히라가나·장음 부호(ー) 밖의 문자(가타카나·한자·로마자·공백)를 쓰면 위반 — 가타카나 외래어
 * (コーヒー 등)에서 모델이 원표기를 그대로 reading 에 넣는 이탈이 관찰돼 추가했다(정규화 함정, 재발 가능).
 * `invalidReason` 유무만 보고 그 밖의 필드(예: valid=false 인데 partOfSpeech 가 채워짐)는 **묻지 않는다** —
 * 그 값은 라우트가 버리므로 검사 비용 대비 재시도만 늘어난다(과도한 검사로 재시도가 잦아지지 않게).
 */
const WORD_ENRICH_READING_RE = /^[ぁ-ゖー]+$/
const WORD_ENRICH_CONJUGATABLE_POS = new Set<WordEnrichResponse['partOfSpeech']>(['VERB', 'ADJ_I'])

/** VERB·ADJ_I 는 어간(마지막 1글자를 뺀 나머지)까지만, 그 밖은 표기 전체가 리터럴로 들어 있어야 한다. */
function exampleCoversSurface(surface: string, example: string, partOfSpeech: WordEnrichResponse['partOfSpeech']): boolean {
  if (example.includes(surface)) return true
  if (partOfSpeech && WORD_ENRICH_CONJUGATABLE_POS.has(partOfSpeech) && surface.length >= 2) {
    return example.includes(surface.slice(0, -1))
  }
  return false
}

export function checkWordEnrich(surface: string, data: WordEnrichResponse): string[] {
  const v: string[] = []
  if (data.valid) {
    if (data.invalidReason !== null) v.push('valid=true 이면 invalidReason 은 null 이어야 한다')
    if (!data.reading) v.push('valid=true 이면 reading 이 있어야 한다')
    else if (!WORD_ENRICH_READING_RE.test(data.reading)) v.push('reading 은 히라가나와 장음 부호(ー)만 사용해야 한다 — 가타카나·한자·로마자·공백을 쓰지 않는다')
    if (!data.meaning) v.push('valid=true 이면 meaning 이 있어야 한다')
    if (!data.partOfSpeech) v.push('valid=true 이면 partOfSpeech 가 있어야 한다')
    if (!data.example) v.push('valid=true 이면 example 이 있어야 한다')
    else if (!exampleCoversSurface(surface, data.example, data.partOfSpeech)) {
      v.push(
        data.partOfSpeech && WORD_ENRICH_CONJUGATABLE_POS.has(data.partOfSpeech)
          ? 'example 은 [단어]를 그대로 또는 그 어간을 살린 활용형으로 포함해야 한다(한자·가나 표기 자체는 바꾸지 않는다)'
          : 'example 은 [단어]를 표기 그대로(한자·가나를 바꾸지 않고) 포함해야 한다',
      )
    }
    if (!data.exampleKo) v.push('valid=true 이면 exampleKo 가 있어야 한다')
  } else if (!data.invalidReason) {
    v.push('valid=false 이면 invalidReason 에 한국어로 이유를 적어야 한다')
  }
  return v
}

/**
 * A4 레슨 생성(LESSON) — 스키마가 표현 못 하는 것만 본다(개수·길이·choices 중복·answer 범위·reading 가나 패턴은
 * `LESSON_SCHEMA` 가 minItems/maxItems·uniqueItems·enum·pattern 으로 이미 강제한다 — 여기서 다시 세지 않는다):
 *  ① `chunks[].id` 보존 — 입력 `topic.chunks` 의 id 를 그대로 쓰거나 `new-N` 이어야 하고(없는 id 를 지어내면 위반),
 *     `isNew` 가 그 판정과 모순되면 안 된다(기존 id 인데 isNew=true, new-N 인데 isNew=false 둘 다 위반).
 *  ② `targetIds ⊆ chunks∪grammar id` — quiz·application·speaking 이 이번 레슨에 없는 id 를 가리키면 위반.
 *  ③ 일본어 필드(ja·textJa·exampleJa·modelAnswerJa)에 한글이 섞이지 않았는지, 응답 전체에 엔진·모델 이름이 없는지.
 *  ④(2026-09-28 Leader 3차 결정) application·speaking 의 `modelAnswerJa` 가 자기 목표 chunk(`textJa`·`reading`)를
 *     실제로 담고 있는지(`matching.ts` `chunkAppearsIn`) — `repairLessonResponse` 가 못 담은 chunk 를 이미
 *     `targetIds` 에서 뺐을 것이므로, 여기 남아 있는 것은 "빼면 빈 배열이 돼 보정 못 한" 경우다.
 *
 * **quiz.promptKo(lesson@v8, 2026-09-30 task-025 IMP-0014)**: 스키마가 필수·비어 있지 않은 문자열로 강제하므로(옛 v7 의
 * "promptKo·promptJa 중 최소 하나" 규칙은 없어졌다) 여기서는 그 안에 **한글이 실제로 있는지**만 본다 — 일본어 문장을 promptKo 에
 * 넣는 자리 바뀜을 잡는다. 마지막 시도(`tolerateContentMismatch`)에서는 이 검사도 건너뛴다(한국어 뜻이 부실한 채 레슨이 나가는 편이
 * 레슨 전체를 잃는 것보다 낫다).
 *
 * **의도적으로 안 보는 것**: `sourceText` 레슨이 원문 표현을 실제로 살렸는지는
 * task-010 Leader's Plan L7 이 "느슨"이라고 명시한 항목이라 — 자동 판정 기준이 모호해 재시도만 늘리므로 여기서 강제하지
 * 않는다(QA 가 수동으로 본다). ④는 grammar targetId 를 보지 않는다(matching.ts 주석 — 문형 자체가 문장에 그대로
 * 나타나길 기대할 수 없다).
 */
const NEW_CHUNK_ID_RE = /^new-\d+$/
const HANGUL_RE = /[가-힣]/

function hasHangul(text: string): boolean {
  return HANGUL_RE.test(text)
}

export interface LessonCheckContext {
  allowedChunkIds: string[]
  /**
   * lesson@v6(2026-09-28, 운영 11b 후속 2차) — true 면 ④(콘텐츠 매칭, 아래 `checkContentMatch`) 위반을 위반
   * 목록에 넣지 않는다. `buildLessonRequest` 의 `extraCheck` 가 **`runJsonWithRetry` 의 마지막 시도(2차)에서만**
   * 이 값을 true 로 준다(재측정에서 확인 — v5 로 지시문을 추가한 뒤에도 sourceText 경로 1/8 이 재시도까지 하고도
   * 같은 "단일 참조라 repair 가 못 뺀" 콘텐츠 불일치로 실패했다). ①~③(id 존재·중복·isNew 일관성)·한글 혼입·엔진명
   * 노출은 이 옵션과 무관하게 항상 검사한다 — targetIds 는 여전히 이 레슨에 실재하는 chunk/grammar id 를 가리키므로
   * (그 존재는 여전히 강제) 데이터 무결성은 깨지지 않고, "모범 답이 그 표현을 완벽히 보여주지 못한다"는 콘텐츠
   * 품질 저하만 허용하는 것이다 — 레슨 전체를 잃는 것보다 낫다는 Leader 판단(재시도까지 실패한 극히 드문
   * 잔여 사례 한정). 상세: `agent-vault/30-Knowledge/decisions/llm-japanese-quality.md`§11.
   * lesson@v8 부터 `quiz[].promptKo` 의 한글 유무 검사도 같은 이유로 이 옵션이 켜지면 건너뛴다(위 함수 주석).
   */
  tolerateContentMismatch?: boolean
}

/**
 * 위반 종류 꼬리표(lesson@v8 task-025b) — 마지막 시도 면책 로그가 "④ 매칭 N건·promptKo 한글 M건"을 따로 세려고 쓴다.
 * 면책(`tolerateContentMismatch`)이 건너뛰는 규칙은 정확히 `content`·`promptKo` 두 종류뿐이다. 나머지는 모두 `other`.
 */
export type LessonViolationKind = 'content' | 'promptKo' | 'other'
export interface LessonViolation {
  kind: LessonViolationKind
  message: string
}

/** 기존 호출부 호환용 — 메시지만 돌려준다. 종류가 필요하면 `checkLessonResponseDetailed`. */
export function checkLessonResponse(ctx: LessonCheckContext, data: LessonResponse): string[] {
  return checkLessonResponseDetailed(ctx, data).map((x) => x.message)
}

export function checkLessonResponseDetailed(ctx: LessonCheckContext, data: LessonResponse): LessonViolation[] {
  const v: LessonViolation[] = []
  const push = (message: string, kind: LessonViolationKind = 'other') => {
    v.push({ kind, message })
  }
  const allowed = new Set(ctx.allowedChunkIds)
  const chunkIds = new Set<string>()
  data.chunks.forEach((c, i) => {
    if (chunkIds.has(c.id)) push(`chunks[${i}].id '${c.id}' 가 다른 chunks 항목과 중복이다`)
    chunkIds.add(c.id)
    const isKnown = allowed.has(c.id)
    const looksNew = NEW_CHUNK_ID_RE.test(c.id)
    if (!isKnown && !looksNew) {
      push(`chunks[${i}].id '${c.id}' 는 입력 조각에 없고 "new-N" 형식도 아니다 — 입력 조각을 쓰면 그 id 를 그대로, 새 표현은 new-1, new-2… 로 붙여야 한다`)
    }
    if (looksNew && !c.isNew) push(`chunks[${i}] id '${c.id}' 는 new- 로 시작하므로 isNew=true 여야 한다`)
    if (isKnown && c.isNew) push(`chunks[${i}] id '${c.id}' 는 입력 조각이므로 isNew=false 여야 한다`)
    if (hasHangul(c.textJa)) push(`chunks[${i}].textJa 에 한글이 섞여 있다`)
  })
  const grammarIds = new Set<string>()
  data.grammar.forEach((g, i) => {
    if (grammarIds.has(g.id)) push(`grammar[${i}].id '${g.id}' 가 다른 grammar 항목과 중복이다`)
    grammarIds.add(g.id)
    if (hasHangul(g.exampleJa)) push(`grammar[${i}].exampleJa 에 한글이 섞여 있다`)
  })
  const refIds = new Set<string>([...chunkIds, ...grammarIds])
  const checkTargetIds = (targetIds: string[], where: string) => {
    targetIds.forEach((id) => {
      if (refIds.has(id)) return
      // 2026-09-28 v2 재발 방지(실측 topic#2 FAILED): 재시도에서 모델이 "없는 id" 를 chunks 에 새로 추가해 8개 상한을
      // 넘기는 사고가 실제로 났다(chunks 는 이미 repairLessonResponse 가 채울 수 있는 만큼 채운 뒤라 더 채울 자리가
      // 없다). chunks 가 이미 상한이면 "추가하지 말라"를 명시하고, 아니면 일반 안내만 준다.
      const hint =
        data.chunks.length >= LESSON_CHUNKS_MAX
          ? `(chunks 가 이미 ${LESSON_CHUNKS_MAX}개(상한)라 새로 추가하지 마세요 — targetIds 에서 이 id 를 빼거나 이미 응답에 있는 다른 chunks·grammar id 로 바꾸세요)`
          : `(chunks·grammar 에 먼저 넣거나 targetIds 에서 빼세요)`
      push(`${where}.targetIds 의 '${id}' 는 이 레슨의 chunks·grammar id 에 없다 ${hint}`)
    })
  }
  data.dialogue.forEach((d, i) => {
    if (hasHangul(d.ja)) push(`dialogue[${i}].ja 에 한글이 섞여 있다`)
  })
  data.quiz.forEach((q, i) => {
    // lesson@v8 — 문제 문장의 한국어 뜻은 필수(스키마가 비어 있지 않은 문자열을 강제). 여기서는 한글이 실제로 있는지만 본다.
    if (!ctx.tolerateContentMismatch && !hasHangul(q.promptKo)) {
      // (e)=B(2026-10-01) — 재시도 안내가 "문제 문장의 한국어 뜻"만 말하면 빈칸 문제를 다시 번역으로 쓰게 돼 정답이 노출된다. 빈칸 문제는 할 일만 쓰도록 같이 안내한다(로직 무변경, 문구만).
      push(`quiz[${i}].promptKo 에 한국어(한글)가 없다 — 한국어로 쓰세요: 일본어 문장은 promptJa 에만 두고 promptKo 에는 "문장의 뜻을 고르세요."처럼 고르라는 지시를, 빈칸 문제는 "빈칸에 들어갈 알맞은 말을 고르세요."처럼 할 일만 — 정답의 뜻은 쓰지 않는다`, 'promptKo')
    }
    checkTargetIds(q.targetIds, `quiz[${i}]`)
  })
  // 2026-09-28 Leader 3차 결정 — application·speaking 의 modelAnswerJa 가 자기 목표 chunk 표현을 실제로 담고 있는지
  // (문법 id 는 대상 아님, matching.ts 주석 참고). repairLessonResponse 의 ④가 못 담은 chunk 를 이미 뺐을 것이므로,
  // 여기서 남아 있는 것은 "빼면 targetIds 가 비어서 보정하지 못한" 경우다.
  const chunkById = new Map(data.chunks.map((c) => [c.id, c]))
  const checkContentMatch = (targetIds: string[], modelAnswerJa: string, where: string) => {
    if (ctx.tolerateContentMismatch) return // lesson@v6 — 마지막 시도에서는 이 검사를 건너뛴다(위 LessonCheckContext 주석).
    targetIds.forEach((id) => {
      const c = chunkById.get(id)
      if (!c) return // grammar id 등은 대상 아님(존재 여부는 위 checkTargetIds 가 본다)
      if (!chunkAppearsIn(modelAnswerJa, c)) {
        push(`${where}.modelAnswerJa 가 목표 표현 '${c.textJa}'(targetIds 의 '${id}')를 담고 있지 않다`, 'content')
      }
    })
  }
  data.application.forEach((a, i) => {
    if (hasHangul(a.modelAnswerJa)) push(`application[${i}].modelAnswerJa 에 한글이 섞여 있다`)
    checkTargetIds(a.targetIds, `application[${i}]`)
    checkContentMatch(a.targetIds, a.modelAnswerJa, `application[${i}]`)
  })
  data.speaking.forEach((s, i) => {
    if (hasHangul(s.modelAnswerJa)) push(`speaking[${i}].modelAnswerJa 에 한글이 섞여 있다`)
    checkTargetIds(s.targetIds, `speaking[${i}]`)
    checkContentMatch(s.targetIds, s.modelAnswerJa, `speaking[${i}]`)
  })
  const allText = [
    data.title,
    data.titleKo,
    data.rolesKo.A,
    data.rolesKo.B,
    ...data.dialogue.flatMap((d) => [d.ja, d.ko]),
    ...data.chunks.flatMap((c) => [c.textJa, c.meaningKo]),
    ...data.grammar.flatMap((g) => [g.pattern, g.explanationKo, g.exampleJa, g.exampleKo]),
    ...data.quiz.flatMap((q) => [q.promptKo, q.promptJa, ...q.choices, q.explanationKo].filter((x): x is string => Boolean(x))),
    ...data.application.flatMap((a) => [a.promptKo, a.hintJa, a.modelAnswerJa, a.modelKo].filter((x): x is string => Boolean(x))),
    ...data.speaking.flatMap((s) => [s.promptKo, s.modelAnswerJa, s.modelKo]),
    data.nextPreview.titleKo,
    data.nextPreview.teaserKo,
  ]
  if (allText.some((t) => llm.mentionsEngineIdentity(t))) push('응답 어딘가에 엔진·모델 이름이 노출됐다')
  return v
}
