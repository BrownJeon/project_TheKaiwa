/**
 * 회화방 일본어 도우미(`phraseHelp`, task-056 IMP-0030, `POST /api/v1/chats/:id/phrase-help` #180) 응답 계약·입력 검사·응답 보정 — 프롬프트는 `prompts/phraseHelp.ts`.
 *
 * 하는 일: 학습자가 회화 중 말이 막혔을 때 **하고 싶은 말을 한국어로** 적으면 AI 가 그 뜻을 **바로 말할 수 있는 일본어 표현 1~3개**(`ja` + 한국어 뜻 `ko` + 말투 꼬리표 `labelKo` + 왜 자연스러운지 `whyKo`)로 제안한다.
 * 이 호출은 **아무것도 저장하지 않는다**(제안만 — 학습자가 [입력창에 넣기]/직접 말하기로 고른다. 대답 연습 #169·첫마디 제안 #178 과 같은 "저장 없는 제안 호출").
 *
 * 설계(`openingDraft`·`replyPractice` 선례를 따른다)
 *  - **스키마는 구조만** 본다(status·items 모양, 느슨한 길이). 글자 종류·길이·문장 수·중복은 **코드가 항목 단위로** 본다(`fitPhraseHelp`) — 한 항목 때문에 응답 전체를 다시 부르면 사용자가 기다리는 시간이 두 배가 된다.
 *  - 재시도는 **고칠 수 없을 때만**: status 가 OK 인데 쓸 수 있는 항목이 하나도 없으면(`INVALID`) `phraseHelpViolations` 가 `extraCheck` 로 알려 JSON 재시도 1회.
 *    전부 길이 예산을 넘은 경우(`TOO_LONG`)는 첫 시도에서만 재시도 사유이고, 마지막 시도에서는 데이터로 돌려받아 「못 찾음」(빈 결과)으로 처리한다(openingDraft 와 같은 이유 — 마지막 시도의 위반은 엔진이 던져 502 가 된다).
 *  - 거절(`NOT_A_PHRASE`·`UNSAFE`)은 **항목 없이** 돌아온다 → 라우트는 둘 다 200 `{items: []}` 로 알린다(사유를 구분해 알리지 않는다 — 우회 시도를 돕지 않게. 화면은 「못 찾음」 한 가지 상태).
 *  - **항목 단위 보정**: `ja` 가 쓸 수 없으면(한글·허용 밖 글자·로마자 낱말·길이·문장 수·URL/꺾쇠/비밀 모양·엔진명) 그 항목만 버린다. `ko` 가 비었거나 일본어 글자가 섞였으면 항목을 버린다(화면은 뜻 줄을 항상 보인다).
 *    `labelKo`·`whyKo` 는 **칸만** 버린다(항목은 유지) — 화면은 둘 다 없어도 된다. 항목이 하나만 남으면 `labelKo` 는 싣지 않는다.
 *  - **서버 이중 방어**: 프롬프트가 거절을 못 한 경우를 위해 `ja`·`ko`·`labelKo`·`whyKo` 에 URL·꺾쇠·비밀 모양·숨은 글자(`detectUnsafeTopicText`)를 막고, `ja` 의 로마자는 **학습자가 쓴 말(질의)에 있던 낱말만** 허용한다
 *    (`PWNED` 같은 주입 흔적을 일본어 칸에서 걸러 낸다). `ja` 에 **한글이 한 글자라도 있으면** 항목을 버린다(사용자 한국어 글 되풀이·시스템 문구 누출 방어).
 *
 * 로그·Trace 원칙: **이 파일의 위반 문구(`PROBLEM_TEXT`·`BUDGET_TEXT`)는 모두 고정 문장**이다 — 엔진이 1차 위반을 `console.warn` 으로 찍고(`[json] 1차 응답 계약 위반 …`) 최종 실패 예외 메시지에도 싣기 때문에
 * 사용자 질의·모델 출력 조각이 들어가면 안 된다. Trace 용 수치는 `phraseHelpTrace` 만 쓴다(글 원문 0).
 *
 * 질의 입력(`queryKo`)은 openingDraft 와 같은 정리·꺾쇠·URL·비밀 모양 검사에 더해 **한글 음절이 한 글자 이상**이어야 한다(`no_hangul`) — 영문·일본어·자모뿐인 글은 LLM 을 부르지 않고 400.
 */
import { llm } from '@/modules/engine'
import { codePointLength, isSecretLikeText } from '@/modules/infra'
import { cleanTopicText, detectUnsafeTopicText } from './topicDraftSchemas'

/** 한도 — 지시문·스키마·보정이 같은 값을 쓴다(어긋나면 단위 시험이 잡는다). 단위는 모두 코드포인트. */
export const PHRASE_HELP_LIMITS = {
  /** 입력: 한국어 질의 1~100자(정리·앞뒤 공백 제거 뒤). 본문은 `readJsonObject(req, 1024)` 안(한글 100자 ≈ 300바이트). */
  queryMin: 1,
  queryMax: 100,
  /** 입력 맥락(선택, 역할극 방만): 역할 이름·목표 한 줄. */
  roleMax: 12,
  goalMax: 60,
  /** 결과 항목 수(보정이 앞에서부터 3개만 쓴다). */
  itemsMax: 3,
  /**
   * 결과 일본어: 100자 이하·3문장 이하(질의가 100자까지라 두세 문장이 될 수 있다). 넘으면 항목을 버린다(자르면 뜻이 줄어든다).
   * (task-056 실측: 처음엔 70자·뜻 80자였는데, 93자 질의에서 뜻(ko)이 80자를 넘어 항목이 모두 버려져 502 가 났다 — 질의 상한 100자와 어긋난 값. 한국어 100자 ≈ 일본어 70~95자·뜻 80~110자.)
   */
  jaMax: 100,
  jaMaxSentences: 3,
  /** 한국어 뜻·꼬리표·이유. 꼬리표는 8자(화면 꼬리표 폭), 이유는 한 줄(약 40자 안팎, 60자 상한). */
  koMax: 120,
  labelMax: 8,
  whyMax: 60,
  /** 지시문에 적는 이유 길이(모델이 10~20자 넘기는 경향 — 실측 task-056: 지시 60자에 61~78자 → 보정이 이유 칸을 버림). 보정 상한(`whyMax`)은 그 여유분이다. */
  whyAsk: 45,
  /** 이유 안에 인용할 수 있는 일본어 글자 수(「…」 한두 개). */
  whyJaMax: 30,
  /** ja 의 라틴 문자 상한(ATM·JR·Wi-Fi 정도). 그 안에서도 학습자가 쓴 낱말만 허용한다. */
  latinMaxLetters: 6,
  /** 스키마가 받는 느슨한 상한(넘으면 코드가 칸·항목을 버리고, 스키마 위반으로 재시도하지 않는다). */
  rawItemsMax: 4,
  rawJaMax: 160,
  rawKoMax: 200,
  rawLabelMax: 40,
  rawWhyMax: 200,
} as const

export type PhraseHelpStatus = 'OK' | 'NOT_A_PHRASE' | 'UNSAFE'

export interface PhraseHelpModelItem {
  ja: string
  ko: string
  /** 항목이 둘 이상일 때 서로 다른 점(≤8자). 하나뿐이면 null. */
  labelKo: string | null
  /** 왜 자연스러운지 한 줄. 없으면 null. */
  whyKo: string | null
}

export interface PhraseHelpResponse {
  status: PhraseHelpStatus
  /** status 가 OK 일 때 1~3개(모델이 4개까지 내도 스키마가 받고 보정이 3개로 자른다), 아니면 []. */
  items: PhraseHelpModelItem[]
}

const str = (max: number, min = 1) => ({ type: 'string', minLength: min, maxLength: max }) as const
const nullableStr = (max: number) => ({ anyOf: [{ type: 'null' }, { type: 'string', minLength: 1, maxLength: max }] }) as const

/**
 * 스키마 — `JSON.stringify` 가 프롬프트에 그대로 실리므로 설명 없이 짧게 둔다. `properties` 순서 = 출력 순서
 * (status → items, 항목은 ja → ko → labelKo → whyKo: 일본어를 먼저 쓰고 그 뜻을 쓰게 해 `ko` 가 질의 베끼기가 아니라 `ja` 의 뜻이 되게 한다).
 * 항목의 필수는 `ja`·`ko` 둘뿐이고 `labelKo`·`whyKo` 는 **생략하거나 null** 이어도 된다 — 둘 다 화면이 없어도 되는 꾸밈 칸이다.
 * (task-056 실측: 처음엔 openingDraft 처럼 모든 키 필수·없으면 null 이었는데 둘째 항목의 `whyKo` 키를 빠뜨려 재시도가 났다(58호출 중 2건, 건당 +4~5초). 꾸밈 칸 때문에 사용자를 두 배로 기다리게 하지 않는다.)
 * 길이 상한은 **느슨**하다 — 정확한 한도는 `fitPhraseHelp` 가 본다.
 */
export const PHRASE_HELP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'items'],
  properties: {
    status: { type: 'string', enum: ['OK', 'NOT_A_PHRASE', 'UNSAFE'] },
    items: {
      type: 'array',
      maxItems: PHRASE_HELP_LIMITS.rawItemsMax,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['ja', 'ko'],
        properties: {
          ja: str(PHRASE_HELP_LIMITS.rawJaMax),
          ko: str(PHRASE_HELP_LIMITS.rawKoMax),
          labelKo: nullableStr(PHRASE_HELP_LIMITS.rawLabelMax),
          whyKo: nullableStr(PHRASE_HELP_LIMITS.rawWhyMax),
        },
      },
    },
  },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// 입력 검사 (순수)
// ─────────────────────────────────────────────────────────────────────────────
export interface PhraseHelpBodyProblem {
  field: 'body' | 'queryKo'
  reason: 'required' | 'type' | 'max_length' | 'forbidden_char' | 'secret_like' | 'no_text' | 'no_hangul' | 'unknown_key'
  message: string
}

export interface PhraseHelpBody {
  queryKo: string
}

export type PhraseHelpBodyResult = { ok: true; value: PhraseHelpBody } | { ok: false; problems: PhraseHelpBodyProblem[] }

const HANGUL_SYLLABLE = /[가-힣]/

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/**
 * 도우미 요청 본문 검사(LLM 호출 전) — `{queryKo}` 하나뿐(모르는 키는 `unknown_key`). 문제는 한 번에 모두 모은다.
 * 라우트는 `problems[0]` 을 `ApiError('VALIDATION', message, {field:'queryKo', reason})` 로 바꾼다(#166·#176·#178 과 같은 400).
 * 화면이 빈칸·101자 이상은 먼저 막지만 서버도 같은 한도를 건다. `no_hangul`(영문·일본어·자모뿐)·`forbidden_char`(꺾쇠·URL·숨은 글자)·`secret_like` 는 화면이 못 막는 사유다.
 */
export function parsePhraseHelpBody(body: unknown): PhraseHelpBodyResult {
  if (!isObj(body)) return { ok: false, problems: [{ field: 'body', reason: 'type', message: '요청 형식이 올바르지 않아요.' }] }
  const L = PHRASE_HELP_LIMITS
  const problems: PhraseHelpBodyProblem[] = []
  for (const k of Object.keys(body)) if (k !== 'queryKo') problems.push({ field: 'body', reason: 'unknown_key', message: `넣을 수 없는 항목이에요: ${k}` })

  const raw = body.queryKo
  let queryKo: string | null = null
  if (raw === undefined || raw === null) problems.push({ field: 'queryKo', reason: 'required', message: '하고 싶은 말을 한국어로 써 주세요.' })
  else if (typeof raw !== 'string') problems.push({ field: 'queryKo', reason: 'type', message: '하고 싶은 말은 글이어야 해요.' })
  else {
    const t = cleanTopicText(raw)
    const n = codePointLength(t)
    // 막는 글(`detectUnsafeTopicText` — 정리한 글 기준, 전각 `＜＞`·`ｈｔｔｐ：／／` 포함): 꺾쇠·URL·남은 숨은 글자는 forbidden_char, 비밀 모양은 secret_like.
    const unsafe = n > 0 ? detectUnsafeTopicText(t) : null
    if (n < L.queryMin) problems.push({ field: 'queryKo', reason: 'required', message: '하고 싶은 말을 한국어로 써 주세요.' })
    else if (n > L.queryMax) problems.push({ field: 'queryKo', reason: 'max_length', message: `하고 싶은 말은 ${L.queryMax}자까지 쓸 수 있어요.` })
    else if (unsafe === 'MARKUP') problems.push({ field: 'queryKo', reason: 'forbidden_char', message: '꺾쇠(< >)는 쓸 수 없어요.' })
    else if (unsafe === 'URL') problems.push({ field: 'queryKo', reason: 'forbidden_char', message: '인터넷 주소는 넣을 수 없어요.' })
    else if (unsafe === 'CONTROL_CHARS') problems.push({ field: 'queryKo', reason: 'forbidden_char', message: '쓸 수 없는 글자가 있어요.' })
    else if (!/[\p{L}\p{N}]/u.test(t)) problems.push({ field: 'queryKo', reason: 'no_text', message: '글자를 적어 주세요.' })
    else if (!HANGUL_SYLLABLE.test(t)) problems.push({ field: 'queryKo', reason: 'no_hangul', message: '하고 싶은 말을 한국어로 써 주세요.' })
    else if (unsafe === 'SECRET_LIKE' || isSecretLikeText(t)) problems.push({ field: 'queryKo', reason: 'secret_like', message: '비밀번호·키처럼 보이는 글은 넣을 수 없어요.' })
    else queryKo = t
  }

  if (problems.length > 0 || queryKo === null) return { ok: false, problems }
  return { ok: true, value: { queryKo } }
}

// ─────────────────────────────────────────────────────────────────────────────
// 응답 보정 (순수)
// ─────────────────────────────────────────────────────────────────────────────
const cps = (s: string): string[] => Array.from(s)
const cpLen = (s: string): number => cps(s).length

const INVISIBLE = /[\p{Cf}\p{Default_Ignorable_Code_Point}\u{2800}]/gu
const LINE_BREAKS = /[\r\n\t\v\f\u{85}\u{2028}\u{2029}]+/gu
const ANY_SPACE = /[\s\u{3000}]+/gu

/** 한글 음절·호환 자모(ㄱ-ㅣ)·옛 자모 블록 어디든 — `ja` 에는 한글이 한 글자도 없어야 한다. */
const HANGUL_ANY = /[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-퟿]/u
const KANA_ANY = /[ぁ-ゖァ-ヺ]/u
const HAN_ANY = /[㐀-䶿一-鿿]/u
const JA_LETTER = /[ぁ-ゖァ-ヺ々〆㐀-䶿一-鿿]/u
const JA_ANY_G = /[ぁ-ゖァ-ヺ㐀-䶿一-鿿]/gu
/**
 * 가나·한자·々〆·숫자·라틴 문자·문장부호만 허용한다(`openingDraft` 와 같은 집합). 괄호·따옴표(「」 포함)·슬래시·이모지·기호는 읽기 병기·장식이라 거절한다.
 * ASCII 하이픈은 `Wi-Fi`·`e-mail` 처럼 **양옆이 영숫자일 때만** 허용한다(`jaCharsOk`). `，．,.!?` 는 이 검사 전에 전각 `、。！？` 로 바뀐다(`fullWidthPunct`).
 */
const JA_CHAR = /^[ぁ-ゖァ-ヺーヽヾゝゞ々〆㐀-䶿一-鿿0-9０-９A-Za-zＡ-Ｚａ-ｚ。、，．,.！？!?…・〜～]$/u
const ASCII_ALNUM = /^[A-Za-z0-9]$/
const LATIN_LETTER = /[A-Za-zＡ-Ｚａ-ｚ]/g
const LATIN_RUN = /[A-Za-zＡ-Ｚａ-ｚ]+/g
/** 문장 조각: 끝맺음 부호(`。！？!?` 연속, 뒤따르는 닫는 따옴표 포함) 단위. 끝맺음이 없는 마지막 조각도 한 문장으로 센다. */
const SENTENCES = /[^。！？!?]*[。！？!?]+[」』]*|[^。！？!?]+$/gu
/** 중복 비교용 — 가나 종류·부호·공백을 걷은 형태. */
const STRIP = /[\s　、。，．,.!！?？・「」『』（）()【】〔〕［］[\]〈〉《》…‥~〜～"'“”‘’:：;；-]/g
const kataToHira = (s: string): string => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
const form = (s: string): string => kataToHira(s.normalize('NFKC')).toLowerCase().replace(STRIP, '')

export function splitPhraseSentences(s: string): string[] {
  return s.match(SENTENCES) ?? []
}

/** 반각 문장부호 → 전각(일본어 표기 관례). 소수점(`3.5`)의 점은 그대로 둔다. */
function fullWidthPunct(s: string): string {
  return s.replace(/\?/g, '？').replace(/!/g, '！').replace(/[,，]/g, '、').replace(/(?<![0-9０-９])[.．](?![0-9０-９])/g, '。')
}

/** 로마자 낱말 비교용 — 전각 → 반각(NFKC)·소문자·영문자만. 질의의 `Wi-Fi` 와 ja 의 `WiFi` 가 같게 보인다. */
const latinKey = (s: string): string => s.normalize('NFKC').toLowerCase().replace(/[^a-z]+/g, '')

function jaCharsOk(ja: string): boolean {
  const a = cps(ja)
  return a.every((c, i) => {
    if (c === '-') return i > 0 && i < a.length - 1 && ASCII_ALNUM.test(a[i - 1]) && ASCII_ALNUM.test(a[i + 1])
    return JA_CHAR.test(c)
  })
}

/** 항목을 버린 이유 · `INVALID` 의 원인 코드(재시도 안내·Trace 용 — 사용자에게 보이지 않는다). */
export type PhraseHelpDropReason =
  | 'ITEM_SHAPE' // 항목이 객체가 아니거나 ja/ko 가 글이 아님
  | 'TEXT_UNSAFE' // URL·꺾쇠·비밀 모양·숨은 글자
  | 'ENGINE_NAME' // 엔진·모델 이름
  | 'JA_HANGUL' // ja 에 한글
  | 'JA_CHARS' // 허용 밖 글자(괄호·따옴표·기호·이모지 …)
  | 'JA_NO_JAPANESE' // 가나·한자가 한 글자도 없음
  | 'JA_LATIN' // 로마자 과다, 또는 학습자가 쓰지 않은 로마자 낱말
  | 'JA_TOO_LONG' // 100자 초과
  | 'JA_SENTENCES' // 3문장 초과
  | 'KO_BAD' // ko 가 비었거나 한글이 없거나 일본어 글자가 섞였거나 120자 초과
  | 'DUPLICATE' // 앞 항목과 같은 말

export type PhraseHelpFinalStatus = 'OK' | 'NOT_A_PHRASE' | 'UNSAFE' | 'INVALID' | 'TOO_LONG'

export interface PhraseHelpItem {
  ja: string
  ko: string
  /** 항목이 둘 이상 남았고 꼬리표가 검사를 통과했을 때만. */
  labelKo?: string
  /** 이유가 검사를 통과했을 때만. */
  whyKo?: string
}

export interface PhraseHelpRepairs {
  /** 모델이 낸 항목 수(OK 일 때). */
  itemsRaw: number
  /** 최종 항목 수. */
  itemsKept: number
  /** 버린 항목 수(보정이 본 앞 `itemsMax`개 + 개수 초과분은 제외). */
  itemsDropped: number
  /** 칸만 버린 수(항목은 유지). */
  labelDropped: number
  whyDropped: number
  /** 첫 항목 ja 의 코드포인트 수(OK 일 때, 아니면 0). */
  firstJaChars: number
}

export interface PhraseHelpFinal {
  status: PhraseHelpFinalStatus
  /** `status === 'OK'` 일 때만 1~3개. 그 밖은 []. */
  items: PhraseHelpItem[]
  /** 항목을 버린 이유(종류별 수 아님 — 있었던 이유 목록, 중복 없음). `INVALID`·`TOO_LONG` 일 때 원인. */
  problems: PhraseHelpDropReason[]
  repairs: PhraseHelpRepairs
}

/** 응답을 검사할 때 필요한 요청 쪽 정보 — 질의(정리한 글). `ja` 의 로마자 낱말이 학습자가 쓴 것인지 대조한다(요청과 같은 값이어야 한다). */
export interface PhraseHelpContext {
  queryKo: string
}

const emptyRepairs = (): PhraseHelpRepairs => ({ itemsRaw: 0, itemsKept: 0, itemsDropped: 0, labelDropped: 0, whyDropped: 0, firstJaChars: 0 })
const done = (status: PhraseHelpFinalStatus, problems: PhraseHelpDropReason[] = [], repairs: PhraseHelpRepairs = emptyRepairs()): PhraseHelpFinal => ({ status, items: [], problems, repairs })

/** 한 줄 글 칸 정리 — 숨은 글자·줄바꿈 제거, 공백 정리. 글이 아니면 null. */
function cleanLine(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const t = cleanTopicText(raw)
  return t === '' ? null : t
}

/** 안전 글 검사 — URL·꺾쇠·비밀 모양·숨은 글자 또는 엔진명이 있으면 이유를, 없으면 null. */
function unsafeReason(text: string): 'TEXT_UNSAFE' | 'ENGINE_NAME' | null {
  if (detectUnsafeTopicText(text.replace(LINE_BREAKS, ' ')) !== null) return 'TEXT_UNSAFE'
  if (llm.mentionsEngineIdentity(text)) return 'ENGINE_NAME'
  return null
}

type JaCheck = { ja: string } | { drop: PhraseHelpDropReason }

function checkJa(raw: unknown, allowedLatin: string): JaCheck {
  if (typeof raw !== 'string' || raw.trim() === '') return { drop: 'ITEM_SHAPE' }
  const bad = unsafeReason(raw)
  if (bad) return { drop: bad }
  if (HANGUL_ANY.test(raw)) return { drop: 'JA_HANGUL' }
  const ja = fullWidthPunct(raw.replace(INVISIBLE, '').replace(ANY_SPACE, ''))
  if (!JA_LETTER.test(ja)) return { drop: 'JA_NO_JAPANESE' }
  if (!jaCharsOk(ja)) return { drop: 'JA_CHARS' }
  if ((ja.match(LATIN_LETTER) ?? []).length > PHRASE_HELP_LIMITS.latinMaxLetters) return { drop: 'JA_LATIN' }
  // 로마자 낱말은 학습자가 쓴 말(질의)에 있던 것만(ATM·JR·Wi-Fi). 입력에 없는 `PWNED` 같은 글은 거절한다.
  if ((ja.match(LATIN_RUN) ?? []).some((run) => !allowedLatin.includes(latinKey(run)))) return { drop: 'JA_LATIN' }
  if (cpLen(ja) > PHRASE_HELP_LIMITS.jaMax) return { drop: 'JA_TOO_LONG' }
  if (splitPhraseSentences(ja).length > PHRASE_HELP_LIMITS.jaMaxSentences) return { drop: 'JA_SENTENCES' }
  return { ja }
}

/** 한국어 칸(뜻·꼬리표) 공통 검사 — 한글 음절이 있고 일본어 글자(가나·한자)가 없고 안전해야 한다. */
function koText(raw: unknown, max: number): string | null {
  const t = cleanLine(raw)
  if (t === null || cpLen(t) > max) return null
  if (!HANGUL_SYLLABLE.test(t) || KANA_ANY.test(t) || HAN_ANY.test(t) || unsafeReason(t) !== null) return null
  return t
}

/** 일본어를 감싼 따옴표(`'…'`·`"…"`·`‘…’`·`“…”`)를 화면이 일본어 글자체로 보이는 「…」 로 맞춘다 — 안에 가나·한자가 있는 쌍만. */
const JA_QUOTED = /["'“‘]([^"'“”‘’「」『』]*?[ぁ-ゖァ-ヺ㐀-䶿一-鿿][^"'“”‘’「」『』]*?)["'”’]/gu
const JA_IN_CORNER = /[「『][^」』]*[」』]/g

/**
 * 이유 칸 — 한글이 있고 안전해야 한다. 일본어 낱말은 **「」 안에서만**, 모두 `whyJaMax`자까지 허용한다(화면이 「」 안을 일본어 글자체로 그린다) —
 * 다른 따옴표로 감싼 일본어는 「」 로 고치고, 따옴표 없이 한국어 문장에 섞인 일본어(`〜たい로`·`自然な정중한`)가 남으면 이유 칸을 버린다.
 */
function whyText(raw: unknown): string | null {
  const cleaned = cleanLine(raw)
  if (cleaned === null) return null
  const t = cleaned.replace(JA_QUOTED, '「$1」')
  if (cpLen(t) > PHRASE_HELP_LIMITS.whyMax) return null
  if (!HANGUL_SYLLABLE.test(t) || unsafeReason(t) !== null) return null
  if ((t.match(JA_ANY_G) ?? []).length > PHRASE_HELP_LIMITS.whyJaMax) return null
  if (JA_ANY_G.test(t.replace(JA_IN_CORNER, ''))) return null
  return t
}

const isTooLongOnly = (reasons: readonly PhraseHelpDropReason[]): boolean => reasons.length > 0 && reasons.every((r) => r === 'JA_TOO_LONG' || r === 'JA_SENTENCES')

/**
 * 모델 응답 → 쓸 수 있는 제안. 스키마를 통과한 응답을 받지만 방어적으로 읽는다.
 * 순서: 거절 상태(상태가 이긴다 — 모델이 항목을 같이 내도 무시) → OK 아님·items 없음 → 항목마다 `ja`(안전·엔진명·한글·허용 글자·로마자·길이·문장 수)·`ko` 검사 → 중복 제거 → 앞 3개 →
 * 꼬리표·이유 칸 검사(항목이 둘 이상일 때만 꼬리표). 하나도 못 쓰면 길이 때문이면 `TOO_LONG`, 아니면 `INVALID`.
 */
export function fitPhraseHelp(data: PhraseHelpResponse, ctx: PhraseHelpContext): PhraseHelpFinal {
  const status = data?.status
  if (status === 'NOT_A_PHRASE' || status === 'UNSAFE') return done(status)
  const rawItems: unknown[] = Array.isArray(data?.items) ? data.items : []
  if (status !== 'OK' || rawItems.length === 0) return done('INVALID', ['ITEM_SHAPE'], { ...emptyRepairs(), itemsRaw: rawItems.length })

  const allowedLatin = latinKey(ctx?.queryKo ?? '')
  const kept: Array<{ item: PhraseHelpItem; labelRaw: unknown; whyRaw: unknown }> = []
  const seen = new Set<string>()
  const reasons = new Set<PhraseHelpDropReason>()
  let dropped = 0
  for (const entry of rawItems) {
    if (kept.length === PHRASE_HELP_LIMITS.itemsMax) break
    const e = entry !== null && typeof entry === 'object' ? (entry as Record<string, unknown>) : null
    if (!e) {
      reasons.add('ITEM_SHAPE')
      dropped++
      continue
    }
    const ja = checkJa(e.ja, allowedLatin)
    if ('drop' in ja) {
      reasons.add(ja.drop)
      dropped++
      continue
    }
    const ko = koText(e.ko, PHRASE_HELP_LIMITS.koMax)
    if (ko === null) {
      reasons.add('KO_BAD')
      dropped++
      continue
    }
    const key = form(ja.ja)
    if (seen.has(key)) {
      reasons.add('DUPLICATE')
      dropped++
      continue
    }
    seen.add(key)
    kept.push({ item: { ja: ja.ja, ko }, labelRaw: e.labelKo, whyRaw: e.whyKo })
  }

  const problems = [...reasons]
  const repairs: PhraseHelpRepairs = { ...emptyRepairs(), itemsRaw: rawItems.length, itemsKept: kept.length, itemsDropped: dropped }
  if (kept.length === 0) return done(isTooLongOnly(problems) ? 'TOO_LONG' : 'INVALID', problems, repairs)

  const multi = kept.length >= 2
  const items = kept.map(({ item, labelRaw, whyRaw }) => {
    const out: PhraseHelpItem = { ...item }
    if (multi) {
      const label = labelRaw === null || labelRaw === undefined ? null : koText(labelRaw, PHRASE_HELP_LIMITS.labelMax)
      if (label !== null) out.labelKo = label
      else if (labelRaw !== null && labelRaw !== undefined) repairs.labelDropped++
    }
    const why = whyRaw === null || whyRaw === undefined ? null : whyText(whyRaw)
    if (why !== null) out.whyKo = why
    else if (whyRaw !== null && whyRaw !== undefined) repairs.whyDropped++
    return out
  })
  repairs.firstJaChars = cpLen(items[0].ja)
  return { status: 'OK', items, problems, repairs }
}

/** Trace 단계에 싣는 수치·코드(글 원문 0) — 서비스가 `steps.push({ name: 'PHRASE_HELP', …phraseHelpTrace(fin) })` 로 쓴다. */
export function phraseHelpTrace(fin: PhraseHelpFinal): { outcome: PhraseHelpFinalStatus; itemsRaw: number; itemsKept: number; itemsDropped: number; labelDropped: number; whyDropped: number; firstJaChars: number; dropReasons: string } {
  return {
    outcome: fin.status,
    itemsRaw: fin.repairs.itemsRaw,
    itemsKept: fin.repairs.itemsKept,
    itemsDropped: fin.repairs.itemsDropped,
    labelDropped: fin.repairs.labelDropped,
    whyDropped: fin.repairs.whyDropped,
    firstJaChars: fin.repairs.firstJaChars,
    dropReasons: fin.problems.join(','),
  }
}

/** 라우트 응답용: `{items}` — 거절·못 찾음·길이 초과는 빈 배열(200). `INVALID` 는 호출하지 않는다(502). */
export function phraseHelpItems(fin: PhraseHelpFinal): PhraseHelpItem[] {
  return fin.status === 'OK' ? fin.items : []
}

const PROBLEM_TEXT: Record<PhraseHelpDropReason, string> = {
  ITEM_SHAPE: 'status 가 OK 이면 items 에 {ja, ko, labelKo, whyKo} 모양의 표현이 1~3개 있어야 합니다.',
  TEXT_UNSAFE: '표현에는 URL(http://·www.)·꺾쇠(< >)·키나 비밀번호처럼 보이는 글·보이지 않는 글자를 넣지 않습니다. 평범한 글로 다시 쓰세요.',
  ENGINE_NAME: '표현에는 AI·모델·도구 이름을 넣지 않습니다. 학습자가 할 말만 쓰세요.',
  JA_HANGUL: 'ja 는 일본어로만 씁니다. 한글이 들어 있습니다 — 한국어 말을 일본어로 옮기세요. 사람 이름·상호도 한글로 두지 말고 가타카나로 옮깁니다.',
  JA_CHARS: 'ja 에는 한자·가나·숫자와 문장부호(。、？！)만 씁니다. 괄호·읽기 병기·따옴표(「」 포함)·슬래시·기호·이모지는 쓰지 않습니다.',
  JA_NO_JAPANESE: 'ja 에 한자나 가나가 한 글자도 없습니다. 일본어 문장으로 쓰세요.',
  JA_LATIN: `ja 의 로마자는 학습자가 쓴 낱말(약어)만, 모두 ${PHRASE_HELP_LIMITS.latinMaxLetters}자까지 쓸 수 있습니다. 그 밖의 외래어는 가타카나로 쓰세요.`,
  JA_TOO_LONG: `ja 한 개가 ${PHRASE_HELP_LIMITS.jaMax}자 안에 들어가지 않습니다. 뜻은 그대로 두고 더 짧고 간결한 말로 다시 쓰세요.`,
  JA_SENTENCES: `ja 한 개가 ${PHRASE_HELP_LIMITS.jaMaxSentences}문장을 넘습니다. 뜻은 그대로 두고 더 간결하게 다시 쓰세요.`,
  KO_BAD: `ko 는 ja 의 한국어 뜻(한글만, ${PHRASE_HELP_LIMITS.koMax}자 이내)이어야 합니다. 일본어 글자를 넣지 않습니다.`,
  DUPLICATE: '같은 표현을 되풀이하지 말고 말투가 다른 표현을 쓰세요.',
}

/**
 * `completeJson` 의 `extraCheck` — 고칠 수 없는 위반(쓸 수 있는 항목이 하나도 없음)을 알려 JSON 재시도 1회로 보낸다. 모두 **고정 문장**이다(엔진이 로그로 찍는다).
 * 길이 때문에 전부 못 쓰는 응답(`TOO_LONG`)은 **첫 시도에서만** 사유로 알린다 — 마지막 시도의 위반은 엔진이 던져 502 가 되므로 `TOO_LONG` 은 마지막 시도에서 데이터로 받는다(「못 찾음」 처리).
 * `info` 를 생략하면 첫 시도로 본다. `ctx` = 요청에 쓴 질의(로마자 낱말 대조).
 */
export function phraseHelpViolations(data: PhraseHelpResponse, ctx: PhraseHelpContext, info?: { attempt: number; maxAttempts: number }): string[] {
  const fin = fitPhraseHelp(data, ctx)
  if (fin.status === 'INVALID') return fin.problems.map((p) => PROBLEM_TEXT[p])
  const lastAttempt = info !== undefined && info.attempt >= info.maxAttempts
  if (fin.status === 'TOO_LONG' && !lastAttempt) return fin.problems.map((p) => PROBLEM_TEXT[p])
  return []
}
