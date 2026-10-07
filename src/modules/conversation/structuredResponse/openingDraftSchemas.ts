/**
 * 역할극 첫마디 일본어 제안(`openingDraft`, task-045 IMP-0026 요청 2·D5=A) 응답 계약·입력 검사·응답 보정 — 프롬프트는 `prompts/openingDraft.ts`.
 *
 * 하는 일: 학습자가 상황 편집 화면에서 **선생님 첫마디를 한국어로** 적으면 AI 가 그 뜻 그대로 **선생님(roles.tutor)이 학습자(roles.learner)에게 건네는 일본어 첫마디**(+ 읽기)를
 * 제안한다. 이 호출은 **아무것도 저장하지 않는다**(제안→채택: 학습자가 일본어·읽기를 확인하고 [저장]할 때 상황 저장 API 가 `opening{ja, ko}` 로 쓴다 — 읽기는 저장하지 않는다).
 * 역할극은 저장된 일본어를 그대로 말한다(AI 호출 0, `talkScenario` 의 첫마디 규칙 그대로).
 *
 * 설계(`topicDraft`·`scenarioDraft` 선례)
 *  - **스키마는 구조만** 본다(status·ja·reading 모양, 느슨한 길이). 글자 종류·길이·읽기 대조는 **코드가** 본다(`fitOpeningDraft`) — 한 칸 때문에 응답 전체를 다시 부르지 않게.
 *  - 재시도는 **고칠 수 없을 때만**: ja 가 없거나 한글·괄호·따옴표 같은 일본어가 아닌 글자·한국어에 없는 로마자·엔진명·숨은 글자가 있으면(`INVALID`) JSON 재시도 1회.
 *    60자·3문장 예산을 넘는 것(뒤 문장을 버리면 뜻이 줄어든다)도 **첫 시도에서만** 재시도 사유로 알린다(`openingDraftViolations`).
 *  - **예산을 못 맞출 때(REV-149 #2)**: 재시도 뒤에도 넘으면 문장 경계에서 뒤 문장을 버려 `JA_TRUNCATED` 경고와 함께 제안하는 것은 **버려도 반쪽이 되지 않을 때만**이다 —
 *    버리는 문장이 최대 `jaMaxCutSentences`(1)개이고, 그 문장이 학습자에게 답을 청하는 문장(물음·요청·권유 — `ASKS_FOR_REPLY`)이 아닐 때. 남는 글에 닫히지 않은 따옴표·괄호가 있을 수 없는 것은
 *    ja 에 따옴표·괄호를 아예 허용하지 않아서다(`JA_CHAR`). 그 밖은 제안하지 않고 `TOO_LONG`(첫 문장만으로 60자 초과 포함) — 라우트가 422 로 「조금 줄여 주세요」를 알린다.
 *    `TOO_LONG` 은 마지막 시도에서는 재시도 사유가 **아니다**(엔진이 던지면 502 가 되므로 데이터를 돌려받아 `finalize` 가 `TOO_LONG` 으로 알린다).
 *  - **읽기는 확인용 보조**다. 가나 구간·길이가 어긋나면 **읽기만 버린다**(`READING_DROPPED`, 제안은 유지). 한자 읽기 자체가 맞는지는 기계가 알 수 없다 — 학습자가 ▶ 로 들어 확인한다.
 *  - 거절(`NOT_AN_UTTERANCE`·`UNSAFE`)은 **초안 없이** 돌아온다 → 라우트가 같은 문구의 422(사유를 구분해 알리지 않는다 — 우회 시도를 돕지 않게).
 *  - **서버 이중 방어**: 프롬프트가 못 막은 경우를 위해 ja·읽기에 URL·꺾쇠·비밀 모양·숨은 글자(`detectUnsafeTopicText`)를 막는다. ja 에 **한글이 한 글자라도 있으면** 거절(사용자 한국어 글 되풀이·시스템 문구 누출 방어).
 *
 * 한국어 입력(`ko`)은 상황 입력 검사(`cleanScenarioText` 와 같은 정리·꺾쇠·비밀 유사 글)에 더해 **한글 음절이 한 글자 이상**이어야 한다(`no_hangul`) — 영문·일본어·자모뿐인 글은 LLM 을 부르지 않고 400.
 */
import { llm } from '@/modules/engine'
import { codePointLength, isSecretLikeText } from '@/modules/infra'
import { SCENARIO_LIMITS as SL } from '@/types/scenario'
import { readingMatchesSurface, toHiragana } from '../prompts/topicWords'
import { JLPT_LEVELS, type JlptLevel } from './schemas'
import { cleanTopicText, detectUnsafeTopicText } from './topicDraftSchemas'

/** 한도 — 지시문·스키마·보정이 같은 값을 쓴다(상황 입력 한도 `SCENARIO_LIMITS` 와 어긋나면 단위 시험이 잡는다). */
export const OPENING_DRAFT_LIMITS = {
  /** 입력: 한국어 첫마디 1~80자(= `SCENARIO_LIMITS.openingKoMax`, 저장 때 `opening.ko` 한도와 같다). */
  koMin: 1,
  koMax: SL.openingKoMax,
  /** 입력 상황 정보(모두 선택, 역할은 필수). */
  titleMax: SL.titleMax,
  titleJaMax: SL.titleJaMax,
  goalMax: SL.goalMax,
  roleMax: SL.roleMax,
  placeTitleMax: 40,
  /** 결과 일본어: 60자(= `SCENARIO_LIMITS.openingJaMax`) 이하·3문장 이하. 시드 첫마디가 3문장까지 있다("はじめまして。田中です。お名前は何ですか。"). */
  jaMax: SL.openingJaMax,
  jaMaxSentences: 3,
  /** 예산 때문에 뒤에서 버려도 되는 문장 수 — 둘 이상 버리면 뜻의 대부분이 사라져 제안하지 않는다(`TOO_LONG`). */
  jaMaxCutSentences: 1,
  /** 읽기(가나) 상한 — 60자 한자 글의 읽기는 보통 100자 안쪽. */
  readingMax: 160,
  /** ja 의 라틴 문자 상한(ATM·JR 같은 약어 정도). 그 안에서도 한국어 입력에 있는 낱말만 허용한다(`JA_LATIN`). */
  latinMaxLetters: 6,
  /** 스키마가 받는 느슨한 상한(넘으면 코드가 문장 경계에서 자르거나 재시도). */
  rawJaMax: 120,
  rawReadingMax: 240,
} as const

export type OpeningDraftStatus = 'OK' | 'NOT_AN_UTTERANCE' | 'UNSAFE'

export interface OpeningDraftResponse {
  status: OpeningDraftStatus
  /** status 가 OK 일 때 일본어 첫마디, 아니면 null. */
  ja: string | null
  /** ja 전체의 가나 읽기(모르면 null). */
  reading: string | null
}

/**
 * 스키마 — `JSON.stringify` 가 프롬프트에 그대로 실리므로 설명 없이 짧게 둔다. `required` 순서 = 출력 순서(status → ja → reading: 읽기를 일본어 바로 뒤에 쓰게 한다).
 * 세 키 모두 필수·거절이면 null(topicDraft 와 같은 모양). 길이 상한은 **느슨**하다 — 정확한 한도는 `fitOpeningDraft` 가 본다.
 */
export const OPENING_DRAFT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'ja', 'reading'],
  properties: {
    status: { type: 'string', enum: ['OK', 'NOT_AN_UTTERANCE', 'UNSAFE'] },
    ja: { anyOf: [{ type: 'null' }, { type: 'string', minLength: 1, maxLength: OPENING_DRAFT_LIMITS.rawJaMax }] },
    reading: { anyOf: [{ type: 'null' }, { type: 'string', minLength: 1, maxLength: OPENING_DRAFT_LIMITS.rawReadingMax }] },
  },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// 입력 검사 (순수)
// ─────────────────────────────────────────────────────────────────────────────
export interface OpeningDraftBodyProblem {
  field:
    | 'body'
    | 'ko'
    | 'scenario'
    | 'scenario.title'
    | 'scenario.titleJa'
    | 'scenario.goal'
    | 'scenario.level'
    | 'scenario.placeTitle'
    | 'scenario.roles'
    | 'scenario.roles.learner'
    | 'scenario.roles.tutor'
  reason: 'required' | 'type' | 'min_length' | 'max_length' | 'forbidden_char' | 'secret_like' | 'no_text' | 'no_hangul' | 'enum' | 'unknown_key'
  message: string
}

export interface OpeningDraftScenarioContext {
  title: string | null
  titleJa: string | null
  goal: string | null
  placeTitle: string | null
  roles: { learner: string; tutor: string }
  level: JlptLevel
}

export interface OpeningDraftBody {
  ko: string
  scenario: OpeningDraftScenarioContext
}

export type OpeningDraftBodyResult = { ok: true; value: OpeningDraftBody } | { ok: false; problems: OpeningDraftBodyProblem[] }

const BODY_KEYS = ['ko', 'scenario'] as const
const SCENARIO_KEYS = ['title', 'titleJa', 'goal', 'level', 'placeTitle', 'roles'] as const
const ROLE_KEYS = ['learner', 'tutor'] as const
const HANGUL_SYLLABLE = /[가-힣]/

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

interface TextRule {
  /** 필수(비면 `required`). */
  required: boolean
  max: number
  /** 한글 음절이 한 글자 이상이어야 한다(`ko` 만). */
  hangul?: boolean
}

/** 글 한 칸 정리·검사 — 통과하면 정리된 글(선택 칸이 비면 null), 아니면 문제를 모으고 null. */
function readText(problems: OpeningDraftBodyProblem[], field: OpeningDraftBodyProblem['field'], raw: unknown, label: string, rule: TextRule): string | null {
  if (raw === undefined || raw === null) {
    if (rule.required) problems.push({ field, reason: 'required', message: `${label}을(를) 적어 주세요.` })
    return null
  }
  if (typeof raw !== 'string') {
    problems.push({ field, reason: 'type', message: `${label}은(는) 글이어야 해요.` })
    return null
  }
  const t = cleanTopicText(raw)
  const n = codePointLength(t)
  if (n === 0) {
    if (rule.required) problems.push({ field, reason: 'required', message: `${label}을(를) 적어 주세요.` })
    return null
  }
  // 막는 글(`detectUnsafeTopicText` — 정리한 글 기준, 전각 `＜＞`·`ｈｔｔｐ：／／` 포함): 꺾쇠·URL·남은 숨은 글자는 forbidden_char, 비밀 모양은 secret_like.
  const unsafe = detectUnsafeTopicText(t)
  if (n > rule.max) problems.push({ field, reason: 'max_length', message: `${label}은(는) ${rule.max}자까지 쓸 수 있어요.` })
  else if (unsafe === 'MARKUP') problems.push({ field, reason: 'forbidden_char', message: `${label}에 꺾쇠(< >)는 쓸 수 없어요.` })
  else if (unsafe === 'URL') problems.push({ field, reason: 'forbidden_char', message: `${label}에 인터넷 주소는 넣을 수 없어요.` })
  else if (unsafe === 'CONTROL_CHARS') problems.push({ field, reason: 'forbidden_char', message: `${label}에 쓸 수 없는 글자가 있어요.` })
  else if (!/[\p{L}\p{N}]/u.test(t)) problems.push({ field, reason: 'no_text', message: `${label}에 글자를 적어 주세요.` })
  else if (rule.hangul && !HANGUL_SYLLABLE.test(t)) problems.push({ field, reason: 'no_hangul', message: `${label}은(는) 한국어로 적어 주세요.` })
  else if (unsafe === 'SECRET_LIKE' || isSecretLikeText(t)) problems.push({ field, reason: 'secret_like', message: `${label}에 비밀번호·키처럼 보이는 글은 넣을 수 없어요.` })
  else return t
  return null
}

function onlyKeys(problems: OpeningDraftBodyProblem[], field: OpeningDraftBodyProblem['field'], o: Record<string, unknown>, allowed: readonly string[]): void {
  for (const k of Object.keys(o)) if (!allowed.includes(k)) problems.push({ field, reason: 'unknown_key', message: `넣을 수 없는 항목이에요: ${k}` })
}

/**
 * 첫마디 일본어 제안 요청 본문 검사(LLM 호출 전) — `{ko, scenario:{title?, titleJa?, goal?, placeTitle?, level?, roles:{learner, tutor}}}` 만(모르는 키는 `unknown_key`).
 * 문제는 한 번에 모두 모은다(화면이 칸마다 문구를 붙인다). `scenario.level` 이 없으면 `opts.defaultLevel`(학습자 수준)을 쓴다.
 * 라우트는 `problems[0]` 을 `ApiError('VALIDATION', message, {field, reason})` 로 바꾼다(#166·#176 과 같은 400).
 */
export function parseOpeningDraftBody(body: unknown, opts: { defaultLevel?: JlptLevel } = {}): OpeningDraftBodyResult {
  if (!isObj(body)) return { ok: false, problems: [{ field: 'body', reason: 'type', message: '요청 형식이 올바르지 않아요.' }] }
  const L = OPENING_DRAFT_LIMITS
  const problems: OpeningDraftBodyProblem[] = []
  onlyKeys(problems, 'body', body, BODY_KEYS)

  const ko = readText(problems, 'ko', body.ko, '선생님 첫마디', { required: true, max: L.koMax, hangul: true })

  let scenario: OpeningDraftScenarioContext | null = null
  const sc = body.scenario
  if (sc === undefined || sc === null) problems.push({ field: 'scenario', reason: 'required', message: '상황 정보가 필요해요.' })
  else if (!isObj(sc)) problems.push({ field: 'scenario', reason: 'type', message: '상황 정보 형식이 올바르지 않아요.' })
  else {
    onlyKeys(problems, 'scenario', sc, SCENARIO_KEYS)
    const title = readText(problems, 'scenario.title', sc.title, '상황 이름', { required: false, max: L.titleMax })
    const titleJa = readText(problems, 'scenario.titleJa', sc.titleJa, '일본어 상황 이름', { required: false, max: L.titleJaMax })
    const goal = readText(problems, 'scenario.goal', sc.goal, '목표', { required: false, max: L.goalMax })
    const placeTitle = readText(problems, 'scenario.placeTitle', sc.placeTitle, '장소', { required: false, max: L.placeTitleMax })
    let learner: string | null = null
    let tutor: string | null = null
    if (!isObj(sc.roles)) problems.push({ field: 'scenario.roles', reason: sc.roles === undefined || sc.roles === null ? 'required' : 'type', message: '역할(나·선생님)을 정해 주세요.' })
    else {
      onlyKeys(problems, 'scenario.roles', sc.roles, ROLE_KEYS)
      learner = readText(problems, 'scenario.roles.learner', sc.roles.learner, '내 역할', { required: true, max: L.roleMax })
      tutor = readText(problems, 'scenario.roles.tutor', sc.roles.tutor, '선생님 역할', { required: true, max: L.roleMax })
    }
    let level: JlptLevel | null = null
    const lv = sc.level === undefined || sc.level === null ? opts.defaultLevel : sc.level
    if ((JLPT_LEVELS as readonly unknown[]).includes(lv)) level = lv as JlptLevel
    else problems.push({ field: 'scenario.level', reason: 'enum', message: '수준을 골라 주세요.' })
    if (learner && tutor && level) scenario = { title, titleJa, goal, placeTitle, roles: { learner, tutor }, level }
  }

  if (problems.length > 0 || ko === null || scenario === null) return { ok: false, problems }
  return { ok: true, value: { ko, scenario } }
}

// ─────────────────────────────────────────────────────────────────────────────
// 응답 보정 (순수)
// ─────────────────────────────────────────────────────────────────────────────
const cps = (s: string): string[] => Array.from(s)
const cpLen = (s: string): number => cps(s).length

const INVISIBLE = /[\p{Cf}\p{Default_Ignorable_Code_Point}\u{2800}]/gu
const LINE_BREAKS = /[\r\n\t\v\f\u{85}\u{2028}\u{2029}]+/gu
const ANY_SPACE = /[\s\u{3000}]+/gu

/** 한글 음절·호환 자모(ㄱ-ㅣ)·옛 자모 블록 어디든 — ja 에는 한글이 한 글자도 없어야 한다. */
const HANGUL = /[\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uAC00-\uD7FF]/u
const KANA_ANY = /[ぁ-ゖァ-ヺ]/
/**
 * 가나(ひらがな·カタカナ·ー)·한자·々〆·숫자·라틴 문자·문장부호만 일본어 첫마디에 허용한다. 괄호·**따옴표(「」『』 포함)**·슬래시·이모지·ASCII 하이픈·기호는 읽기 병기·장식이라 거절한다 —
 * 프롬프트가 「따옴표를 쓰지 않는다」고 하므로 검사도 같게 둔다(REV-149 #7). 따옴표가 아예 없으면 버리는 문장 뒤에 닫히지 않은 따옴표가 남을 수도 없다(#2).
 * `，．,.!?` 는 이 검사 전에 전각 `、。！？` 로 바뀐다(`fullWidthPunct`). 공백은 먼저 지운다(일본어는 띄어쓰기가 없다).
 */
const JA_CHAR = /^[ぁ-ゖァ-ヺーヽヾゝゞ々〆㐀-䶿一-鿿0-9０-９A-Za-zＡ-Ｚａ-ｚ。、，．,.！？!?…・〜～]$/u
const JA_LETTER = /[ぁ-ゖァ-ヺ々〆㐀-䶿一-鿿]/u
const LATIN_LETTER = /[A-Za-zＡ-Ｚａ-ｚ]/g
const LATIN_RUN = /[A-Za-zＡ-Ｚａ-ｚ]+/g
/** 읽기에 허용하는 글자: 가나·ー·・ 와 최소 문장부호. */
const READING_CHAR = /^[ぁ-ゖァ-ヺーヽヾゝゞ・。、，．！？!?…]$/u
const STRIP_PUNCT = /[。、，．,.！？!?…・〜～「」『』-]/g
/** 읽기·표기의 문장부호를 비교할 때 세는 부호(전각으로 정리한 뒤). `〜～` 는 읽기에 쓸 수 없어 세지 않는다. */
const PUNCT_MARK = /[。、！？…・]/g
/** 학습자에게 답을 청하는 문장(물음·요청·권유)의 표지 — 이런 문장을 뒤에서 버리면 첫마디의 요점(학습자가 대답할 거리)이 사라진다. 끝맺음 부호를 뗀 문장 끝이 か 인 문장도 물음이다(시드는 물음을 `。` 로 끝낸다). */
const ASKS_FOR_REPLY = /[？?]|ください|下さい|お願い|どうぞ|ましょう|ませんか/u
const SENTENCE_END = /[。！？!?…]+$/u
/** 문장 조각: 끝맺음 부호(`。！？!?` 연속, 뒤따르는 닫는 따옴표 포함) 단위. 끝맺음이 없는 마지막 조각도 한 문장으로 센다. */
const SENTENCES = /[^。！？!?]*[。！？!?]+[」』]*|[^。！？!?]+$/gu

export function splitOpeningSentences(s: string): string[] {
  return s.match(SENTENCES) ?? []
}

/** 버려진 이유·고칠 수 없는 문제 코드(재시도 안내·Trace 용 — 사용자에게 보이지 않는다). */
export type OpeningDraftProblem =
  | 'DRAFT_MISSING' // status OK 인데 ja 가 없거나 글이 아님·알 수 없는 status
  | 'TEXT_UNSAFE' // ja 에 URL·꺾쇠·비밀 모양·숨은 글자
  | 'ENGINE_NAME' // ja 에 엔진·모델 이름
  | 'JA_HANGUL' // ja 에 한글(사용자 입력 되풀이·번역 안 됨)
  | 'JA_CHARS' // 허용 밖 글자(괄호·따옴표·기호·이모지 …)
  | 'JA_NO_JAPANESE' // 가나·한자가 한 글자도 없음
  | 'JA_LATIN' // 로마자 과다, 또는 한국어 입력에 없는 로마자 낱말(PWNED 같은 주입·장식)

export type OpeningDraftWarning = 'JA_TRUNCATED' | 'READING_DROPPED'

/** 읽기를 버린 이유 — `PUNCT` = 읽기에 ja 에 없는(또는 순서가 다른) 문장부호가 붙었다. */
export type OpeningReadingDropReason = 'MISSING' | 'LEN' | 'CHARS' | 'UNSAFE' | 'MISMATCH' | 'PUNCT'

/** 예산을 못 맞춰 제안을 포기한 이유(`TOO_LONG`) — `FIRST_SENTENCE` 첫 문장만으로 60자 초과 · `DROPS_MANY` 버려야 할 문장이 둘 이상 · `DROPS_ASK` 버려야 할 문장이 물음·요청·권유. */
export type OpeningTooLongReason = 'FIRST_SENTENCE' | 'DROPS_MANY' | 'DROPS_ASK'

export interface OpeningDraftRepairs {
  /** 예산(60자·3문장) 때문에 버린 뒤 문장 수. */
  jaCutSentences: number
  /** 읽기를 버린 이유(남겼으면 null). */
  readingDrop: OpeningReadingDropReason | null
  /** 결과 ja 의 코드포인트 수·문장 수(OK 일 때). */
  jaChars: number
  sentences: number
  /** `TOO_LONG` 일 때 이유(아니면 null). */
  tooLongReason: OpeningTooLongReason | null
}

export type OpeningDraftFinalStatus = 'OK' | 'NOT_AN_UTTERANCE' | 'UNSAFE' | 'INVALID' | 'TOO_LONG'

export interface OpeningDraftFinal {
  status: OpeningDraftFinalStatus
  /** `status === 'OK'` 일 때만. 공백을 지운 일본어(≤60자). */
  ja: string | null
  /** `status === 'OK'` 이고 읽기가 검사를 통과했을 때만(가나·문장부호). 저장하지 않는다. */
  reading: string | null
  /** `INVALID` 일 때 이유. */
  problems: OpeningDraftProblem[]
  /** `OK` 일 때 화면이 알릴 수 있는 사항. */
  warnings: OpeningDraftWarning[]
  repairs: OpeningDraftRepairs
}

/** 응답을 검사할 때 필요한 요청 쪽 정보 — `ko` = 학습자가 적은 한국어 첫마디(정리한 글). ja 의 로마자 낱말이 한국어에 있던 것인지 대조한다. */
export interface OpeningDraftContext {
  ko: string
}

const emptyRepairs = (): OpeningDraftRepairs => ({ jaCutSentences: 0, readingDrop: null, jaChars: 0, sentences: 0, tooLongReason: null })
const done = (status: OpeningDraftFinalStatus, problems: OpeningDraftProblem[] = []): OpeningDraftFinal => ({ status, ja: null, reading: null, problems, warnings: [], repairs: emptyRepairs() })
const tooLong = (reason: OpeningTooLongReason): OpeningDraftFinal => ({ ...done('TOO_LONG'), repairs: { ...emptyRepairs(), tooLongReason: reason } })

/**
 * 반각 문장부호 → 전각(일본어 표기 관례) — 모델이 `ですか?`·`、` 대신 `,` 를 쓰는 것을 고친다(시험 실측: haiku 가 `?` 를 섞었다). 전각 쉼표·마침표 `，．` 도 `、。` 로 맞춘다.
 * 소수점(`3.5`·`３．５`)의 점은 그대로 둔다.
 */
function fullWidthPunct(s: string): string {
  return s.replace(/\?/g, '？').replace(/!/g, '！').replace(/[,，]/g, '、').replace(/(?<![0-9０-９])[.．](?![0-9０-９])/g, '。')
}

/** 로마자 낱말 비교용 — 전각 → 반각(NFKC)·소문자·영문자만. 한국어 입력의 `Wi-Fi` 와 ja 의 `WiFi` 가 같게 보인다. */
const latinKey = (s: string): string => s.normalize('NFKC').toLowerCase().replace(/[^a-z]+/g, '')

/** 학습자에게 답을 청하는 문장인가(물음·요청·권유) — 뒤에서 버리면 안 되는 문장. */
function asksForReply(seg: string): boolean {
  // 끝인사 「よろしくお願いします」 는 요청이 아니다(자기소개 끝에 붙는 인사 — 버려도 요점이 남는다).
  const s = seg.replace(/よろしくお願い/g, '')
  return ASKS_FOR_REPLY.test(s) || s.replace(SENTENCE_END, '').endsWith('か')
}

/** `sub` 가 `full` 의 (떨어져 있어도 순서가 같은) 부분열인가. */
function isSubsequence(sub: string[], full: string[]): boolean {
  let i = 0
  for (const x of full) if (i < sub.length && sub[i] === x) i++
  return i === sub.length
}

/** 읽기·표기를 문장부호 뺀 글로 비교할 때 쓴다. */
const stripPunct = (s: string): string => s.replace(STRIP_PUNCT, '')

/**
 * 표기의 가나 구간(조사·어미·히라가나 낱말)이 읽기에 **순서대로** 그대로 나타나고 그 사이를 한자 구간의 읽기(1글자 이상)가 채우는가 — `readingMatchesSurface` 가 앞·뒤 가나만 보는 것을 가운데 가나 구간까지 넓힌 것.
 * 예: 표기 `旅行に行った` → `^.{2,}?に.{1,}?った$` 와 맞아야 한다(조사 `に` 를 빼먹거나 `に` 를 다른 글자로 바꾸거나 한자 구간 읽기가 글자 수보다 짧은 읽기를 가려낸다).
 * 한자 구간의 읽기 **자체**(聞き → きき)가 맞는지는 여전히 알 수 없다 — 학습자가 ▶ 로 들어 확인한다.
 */
function kanaAnchorsMatch(surface: string, reading: string): boolean {
  const s = toHiragana(surface)
  const r = toHiragana(reading)
  const runs = s.match(/[ぁ-ゖーゝゞ]+|[^ぁ-ゖーゝゞ]+/gu) ?? []
  // 한자·숫자·로마자 구간은 글자마다 최소 1모라(`readingMatchesSurface` 의 전체 길이 규칙을 구간마다 적용 — 名前 → な 처럼 구간 안에서 줄어든 읽기를 가려낸다).
  const pattern = runs.map((run) => (/^[ぁ-ゖーゝゞ]/u.test(run) ? run : `.{${Array.from(run).length},}?`)).join('')
  return new RegExp(`^${pattern}$`, 'u').test(r)
}

/** ja 조각들과 읽기 조각들이 모두 가나 구간·길이로 맞는가(문장 수가 같으면 문장마다, 다르면 전체를 한 번에). `readingMatchesSurface` 와 같은 규칙. */
function readingMatches(jaSegs: string[], readingSegs: string[]): boolean {
  const pairs: Array<[string, string]> = jaSegs.length === readingSegs.length ? jaSegs.map((s, i) => [stripPunct(s), stripPunct(readingSegs[i])]) : [[stripPunct(jaSegs.join('')), stripPunct(readingSegs.join(''))]]
  return pairs.every(([s, r]) => (s === '' && r === '') || (readingMatchesSurface(s, r) && kanaAnchorsMatch(s, r)))
}

function checkReading(rawReading: unknown, jaSegs: string[], keep: number): { reading: string | null; drop: OpeningReadingDropReason | null } {
  if (typeof rawReading !== 'string') return { reading: null, drop: 'MISSING' }
  if (detectUnsafeTopicText(rawReading.replace(LINE_BREAKS, ' ')) !== null) return { reading: null, drop: 'UNSAFE' }
  const reading = fullWidthPunct(rawReading.replace(INVISIBLE, '').replace(ANY_SPACE, ''))
  if (reading === '') return { reading: null, drop: 'MISSING' }
  if (cpLen(reading) > OPENING_DRAFT_LIMITS.readingMax) return { reading: null, drop: 'LEN' }
  if (!cps(reading).every((c) => READING_CHAR.test(c)) || !KANA_ANY.test(reading)) return { reading: null, drop: 'CHARS' }
  // 읽기는 ja 에 없는 문장부호를 더하지 못한다(REV-149 #6) — 읽기의 부호 열이 ja 의 부호 열의 부분열이어야 한다(읽기가 부호를 빼먹는 것은 허용: 확인용 보조일 뿐).
  if (!isSubsequence(reading.match(PUNCT_MARK) ?? [], jaSegs.join('').match(PUNCT_MARK) ?? [])) return { reading: null, drop: 'PUNCT' }
  const readingSegs = splitOpeningSentences(reading)
  // 뒤 문장을 버렸다면 읽기도 같은 문장 수만 남긴다(문장 수가 달라 자를 곳을 모르면 읽기를 버린다).
  if (keep < jaSegs.length) {
    if (readingSegs.length !== jaSegs.length) return { reading: null, drop: 'MISMATCH' }
    const cutJa = jaSegs.slice(0, keep)
    const cutRead = readingSegs.slice(0, keep)
    return readingMatches(cutJa, cutRead) ? { reading: cutRead.join(''), drop: null } : { reading: null, drop: 'MISMATCH' }
  }
  return readingMatches(jaSegs, readingSegs) ? { reading, drop: null } : { reading: null, drop: 'MISMATCH' }
}

/**
 * 모델 응답 → 쓸 수 있는 제안. 스키마를 통과한 응답을 받지만 방어적으로 읽는다.
 * 순서: 거절 상태(상태가 이긴다 — 모델이 ja 를 같이 내도 무시) → ja 존재 → 막는 글(숨은·제어 문자·꺾쇠·URL·비밀 모양, 줄바꿈은 공백으로 접고 본다) → 엔진명 → 한글 → 공백 제거 →
 * 허용 글자 → 가나·한자 존재 → 라틴(상한·한국어 입력에 있는 낱말만) → 60자·3문장 예산(문장 경계에서 뒤 문장을 버리고 `JA_TRUNCATED` — 버려도 반쪽이 되지 않을 때만, 아니면 제안 없이 `TOO_LONG`)
 * → 읽기(어긋나면 읽기만 버림). `ctx.ko` 는 요청의 한국어 첫마디(정리한 글).
 */
export function fitOpeningDraft(data: OpeningDraftResponse, ctx: OpeningDraftContext): OpeningDraftFinal {
  const status = data?.status
  if (status === 'NOT_AN_UTTERANCE' || status === 'UNSAFE') return done(status)
  const rawJa = data?.ja
  if (status !== 'OK' || typeof rawJa !== 'string' || rawJa.trim() === '') return done('INVALID', ['DRAFT_MISSING'])

  if (detectUnsafeTopicText(rawJa.replace(LINE_BREAKS, ' ')) !== null) return done('INVALID', ['TEXT_UNSAFE'])
  if (llm.mentionsEngineIdentity(rawJa)) return done('INVALID', ['ENGINE_NAME'])
  if (HANGUL.test(rawJa)) return done('INVALID', ['JA_HANGUL'])
  const ja = fullWidthPunct(rawJa.replace(INVISIBLE, '').replace(ANY_SPACE, ''))
  if (!JA_LETTER.test(ja)) return done('INVALID', ['JA_NO_JAPANESE'])
  if (!cps(ja).every((c) => JA_CHAR.test(c))) return done('INVALID', ['JA_CHARS'])
  if ((ja.match(LATIN_LETTER) ?? []).length > OPENING_DRAFT_LIMITS.latinMaxLetters) return done('INVALID', ['JA_LATIN'])
  // 로마자 낱말은 한국어 입력에 있던 것만(ATM·JR 처럼 학습자가 적은 약어). 입력에 없는 `PWNED` 같은 글은 거절한다(REV-149 #5).
  const koKey = latinKey(ctx?.ko ?? '')
  if ((ja.match(LATIN_RUN) ?? []).some((run) => !koKey.includes(latinKey(run)))) return done('INVALID', ['JA_LATIN'])

  const segs = splitOpeningSentences(ja)
  let keep = segs.length
  while (keep > 0 && (keep > OPENING_DRAFT_LIMITS.jaMaxSentences || cpLen(segs.slice(0, keep).join('')) > OPENING_DRAFT_LIMITS.jaMax)) keep--
  if (keep === 0) return tooLong('FIRST_SENTENCE')
  const cut = segs.slice(keep)
  // 뒤 문장을 버려도 반쪽이 되지 않을 때만 제안한다(REV-149 #2): 많이 버리거나 물음·요청·권유를 버리면 제안하지 않는다.
  if (cut.length > OPENING_DRAFT_LIMITS.jaMaxCutSentences) return tooLong('DROPS_MANY')
  if (cut.some(asksForReply)) return tooLong('DROPS_ASK')
  const finalJa = segs.slice(0, keep).join('')

  const { reading, drop } = checkReading(data.reading, segs, keep)
  const warnings: OpeningDraftWarning[] = []
  if (keep < segs.length) warnings.push('JA_TRUNCATED')
  if (drop !== null) warnings.push('READING_DROPPED')
  return {
    status: 'OK',
    ja: finalJa,
    reading,
    problems: [],
    warnings,
    repairs: { jaCutSentences: segs.length - keep, readingDrop: drop, jaChars: cpLen(finalJa), sentences: keep, tooLongReason: null },
  }
}

const PROBLEM_TEXT: Record<OpeningDraftProblem, string> = {
  DRAFT_MISSING: 'status 가 OK 이면 ja 는 일본어 글 한 개여야 합니다.',
  TEXT_UNSAFE: 'ja 에는 URL(http://·www.)·꺾쇠(< >)·키나 비밀번호처럼 보이는 글·보이지 않는 글자를 넣지 않습니다. 평범한 일본어 글로 다시 쓰세요.',
  ENGINE_NAME: 'ja 에는 AI·모델·도구 이름을 넣지 않습니다. 선생님이 건네는 말만 쓰세요.',
  JA_HANGUL: 'ja 는 일본어로만 씁니다. 한글이 들어 있습니다 — 한국어 말을 일본어로 옮기세요.',
  JA_CHARS: 'ja 에는 한자·가나·숫자와 문장부호(。、？！)만 씁니다. 괄호·읽기 병기·따옴표(「」 포함)·하이픈·기호·이모지는 쓰지 않습니다.',
  JA_NO_JAPANESE: 'ja 에 한자나 가나가 한 글자도 없습니다. 일본어 문장으로 쓰세요.',
  JA_LATIN: `ja 의 로마자는 한국어 말에 있던 낱말(약어)만, 모두 ${OPENING_DRAFT_LIMITS.latinMaxLetters}자까지 쓸 수 있습니다. 그 밖의 외래어는 가타카나로 쓰세요(예: エーティーエム).`,
}

const BUDGET_TEXT = `ja 가 ${OPENING_DRAFT_LIMITS.jaMax}자·${OPENING_DRAFT_LIMITS.jaMaxSentences}문장 안에 뜻이 다 들어가지 않습니다(넘치는 문장을 버리면 뜻이 줄어듭니다). 한국어의 문장이나 구를 빼지 말고, 겹친 경어·군더더기를 줄여 더 짧은 정중체(です·ます)로 다시 쓰세요.`

/**
 * `completeJson` 의 `extraCheck` — 고칠 수 없는 위반을 알려 JSON 재시도 1회로 보낸다. 예산을 못 맞추는 응답(뒤 문장 버림 `JA_TRUNCATED`·제안 포기 `TOO_LONG`)은 **첫 시도에서만** 사유로 알린다
 * (`info.attempt` — 재시도 뒤의 `JA_TRUNCATED` 는 경고로, `TOO_LONG` 은 데이터로 받는다: 마지막 시도의 위반은 엔진이 던져 502 가 되므로 `TOO_LONG` 을 위반으로 두지 않는다).
 * `info` 를 생략하면 첫 시도로 본다. `ctx.ko` = 요청의 한국어 첫마디(로마자 낱말 대조).
 */
export function openingDraftViolations(data: OpeningDraftResponse, ctx: OpeningDraftContext, info?: { attempt: number; maxAttempts: number }): string[] {
  const fin = fitOpeningDraft(data, ctx)
  if (fin.status === 'INVALID') return fin.problems.map((p) => PROBLEM_TEXT[p])
  const lastAttempt = info !== undefined && info.attempt >= info.maxAttempts
  if (lastAttempt) return []
  if (fin.status === 'TOO_LONG' || fin.warnings.includes('JA_TRUNCATED')) return [BUDGET_TEXT]
  return []
}
