/**
 * AI 주제 초안(`topicDraft`, task-045 IMP-0026 결정 1·7) 응답 계약·입력 검사·항목 검사 — 프롬프트는 `prompts/topicDraft.ts`.
 *
 * 하는 일: 학습자가 **주제 한 줄(+수준)** 만 적으면 AI 가 **주제 설명과 기본 표현(`TopicChunk`)** 초안을 만든다. 이 호출은 아무것도 저장하지 않는다
 * (제안→채택: 학습자가 검토·수정해 [저장]해야 `ConversationTopic`·`TopicChunk` 행이 생긴다 — 초안 단계에는 DB 행이 없다).
 *
 * 설계(`scenarioDraft`·`topicWords` 선례를 합친 것)
 *  - **스키마는 구조만** 본다(필드·형·enum·느슨한 길이). 읽기 가나·중복·유형 분포·수준 창·너무 긴 글은 한 항목이 틀렸다고 응답 전체를 다시 부르면
 *    사용자가 기다리는 시간이 두 배가 되므로(lesson@v3·v4 의 `pattern` 위반 전체 실패 선례) **스키마에 넣지 않고 항목 단위로 버린다**(`fitTopicDraft`).
 *  - 재시도는 **고칠 수 없을 때만**: 초안이 없거나(OK 인데 draft null) 제목이 비었거나 쓸 수 있는 표현이 `TOPIC_DRAFT_LIMITS.chunksMin` 미만이면 `INVALID` →
 *    `topicDraftViolations` 가 `extraCheck` 로 알려 JSON 재시도 1회. 그 밖(표현 몇 개 모자람·유형 얇음)은 `warnings` 로 알리고 **초안은 그대로 돌려준다**
 *    — 학습자가 검토 화면에서 고치고 저장 때 서버가 다시 검사한다.
 *  - 수준(`level`)은 모델이 내지 않는다 — 학습자가 고른 값을 코드가 채운다(`scenarioDraft` 와 같다). 표현마다 `jlpt` 는 모델이 자기 판단으로 낸다(A12 선례). 수준 창은 A12 의 ±1 과 **다르다**:
 *    기본 표현은 쉬운 말도 주제의 일부라 **쉬운 쪽은 막지 않고 한 단계보다 어려운 것만 버린다**(`topicDraftLevelWindow` — 실측: N3 주제에서 パスポート·荷物 같은 N5 표현을 ±1 창이 버려 표현이 12개로 줄었다).
 *    `jlpt` 는 검사에만 쓰고 결과 초안에는 싣지 않는다(`TopicChunk` 에 그 칸이 없다).
 *  - 주제가 아닌 입력(`NOT_A_TOPIC`)·부적절·지시 무시 시도(`UNSAFE`)는 **초안 없이** 돌아온다 → 라우트가 같은 문구의 422(사유를 구분해 알리지 않는다 — 우회 시도를 돕지 않게).
 *  - **서버 이중 방어(REV-147 I-1)**: 프롬프트가 거절을 못 한 경우를 위해 코드도 URL·꺾쇠·비밀 모양·보이지 않는 문자를 막는다(`detectUnsafeTopicText`). 표현 칸은 그 **표현만 버리고**(`URL`·`MARKUP`·
 *    `SECRET_LIKE`·`CONTROL_CHARS` 가 버린 이유), 제목·일본어 제목·설명은 고칠 수 없으니 **초안 전체를 `INVALID`(`TEXT_UNSAFE`)로 거절**해 엔진이 JSON 재시도 1회를 한다(재시도 뒤에도 걸리면 502).
 *    엔진·모델 이름은 제목·설명에서 막지 않는다(학습자가 쓴 주제 이름 자체일 수 있다).
 *
 * 이 파일은 `prompts/topicWords.ts` 의 순수 함수(읽기 대조·정규화 키·수준 창)를 가져다 쓴다 — 주제 단어(A12)와 **같은 표기·읽기 규칙**이어야 이 초안의 표현이
 * 나중에 A12 `exclude`·수업 조각·챌린지 카드로 흘러가도 어긋나지 않는다. `topicWords.ts` 는 이 파일을 import 하지 않아 순환은 없다.
 */
import { llm } from '@/modules/engine'
import { codePointLength, isSecretLikeText, sanitizeText } from '@/modules/infra'
import { normalizeTopicWordKey, readingMatchesSurface } from '../prompts/topicWords'
import { CHUNK_TYPES, JLPT_LEVELS, type ChunkType, type JlptLevel } from './schemas'

/** 한도 — 지시문·스키마·보정이 같은 값을 쓴다(어긋나면 단위 시험이 잡는다). DB 칸(`title` 80·`description` 300·`textJa` 120·`reading` 160·`meaningKo` 160)보다 모두 좁다. */
export const TOPIC_DRAFT_LIMITS = {
  /** 입력: 주제 이름 2~40자·보충 설명 ≤200자(코드포인트, 정리한 뒤). */
  inputTitleMin: 2,
  inputTitleMax: 40,
  inputNoteMax: 200,
  /** 결과 글 칸. 제목·일본어 제목은 20자를 넘으면 자르고(…), 설명은 120자. */
  titleMax: 20,
  titleJaMax: 20,
  descriptionMax: 120,
  /** 표현 수: 모델에게 요청하는 수(지시문 — 범위가 아니라 유형마다 정확히 `perTypeMax` 개, 실측에서 범위 지시는 한 유형 5~7개로 넘쳐 버려지는 항목이 많았다)·검사 뒤 받아 주는 하한·유형당 범위. 유형이 4개라 합계 상한은 4×4=16. */
  chunksRequest: 16,
  chunksTarget: 12,
  chunksMin: 8,
  perTypeMin: 2,
  perTypeMax: 4,
  /** 표현 칸 길이(드롭 기준). */
  textJaMax: 20,
  readingMax: 40,
  meaningMax: 30,
  /** 스키마가 받는 표현 수 상한(모델이 넘겨 쓰는 여유 — 넘치면 유형당 상한이 자른다). */
  rawChunksMax: 24,
} as const

export type TopicDraftStatus = 'OK' | 'NOT_A_TOPIC' | 'UNSAFE'

export interface TopicDraftChunkModel {
  textJa: string
  reading: string
  meaningKo: string
  chunkType: ChunkType
  /** N5~N1, 급수를 모르면 null. 모델이 JSON null 대신 문자열 "null" 을 내는 이탈(topicWords 실측)을 스키마가 받아 주고 `fitTopicDraft` 가 null 로 본다. */
  jlpt: JlptLevel | 'null' | null
}

export interface TopicDraftModel {
  title: string
  titleJa: string
  description: string
  chunks: TopicDraftChunkModel[]
}

export interface TopicDraftResponse {
  status: TopicDraftStatus
  draft: TopicDraftModel | null
}

const str = (max: number, min = 1) => ({ type: 'string', minLength: min, maxLength: max }) as const

/**
 * 스키마 — `JSON.stringify` 가 프롬프트(`[출력 JSON 스키마]`)에 그대로 실리므로 설명 문구 없이 짧게 둔다. `required` 순서 = 출력 순서 지시
 * (status → title → titleJa → description → chunks, 표현은 textJa → reading → meaningKo → chunkType → jlpt: 읽기를 표기 바로 뒤에 쓰게 한다).
 * 길이 상한은 **느슨**하다(제목 40·설명 200·표현 24개) — 정확한 한도는 `fitTopicDraft` 가 자르거나 버린다.
 */
export const TOPIC_DRAFT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'draft'],
  properties: {
    status: { type: 'string', enum: ['OK', 'NOT_A_TOPIC', 'UNSAFE'] },
    draft: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'titleJa', 'description', 'chunks'],
          properties: {
            title: str(40),
            titleJa: str(40),
            description: str(200),
            chunks: {
              type: 'array',
              minItems: 1,
              maxItems: TOPIC_DRAFT_LIMITS.rawChunksMax,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['textJa', 'reading', 'meaningKo', 'chunkType', 'jlpt'],
                properties: {
                  textJa: str(40),
                  reading: str(80),
                  meaningKo: str(80),
                  chunkType: { type: 'string', enum: [...CHUNK_TYPES] },
                  jlpt: { anyOf: [{ type: 'null' }, { type: 'string', pattern: '^(N[1-5]|null)$' }] },
                },
              },
            },
          },
        },
      ],
    },
  },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// 입력 정리·검사 (순수) — `learning/scenarios/shape.ts` `cleanScenarioText` 와 같은 결과여야 한다(테스트가 대조)
// ─────────────────────────────────────────────────────────────────────────────
const INVISIBLE = /[\p{Cf}\p{Default_Ignorable_Code_Point}\u{2800}]/gu
const LINE_BREAKS = /[\r\n\t\v\f\u{85}\u{2028}\u{2029}]+/gu

/** 한 줄 글 정리: 보이지 않는 문자(서식·무시 가능·점자 공백) 제거 → 줄바꿈·탭을 공백으로 → 제어문자 제거 → 연속 공백 한 칸. 길이·금지 문자 판단은 하지 않는다. */
export function cleanTopicText(raw: string): string {
  return sanitizeText(raw.replace(INVISIBLE, '').replace(LINE_BREAKS, ' ')).replace(/ {2,}/g, ' ')
}

export interface TopicDraftBodyProblem {
  field: 'title' | 'level' | 'note' | 'body'
  reason: 'required' | 'type' | 'min_length' | 'max_length' | 'forbidden_char' | 'secret_like' | 'no_text' | 'enum' | 'unknown_key'
  message: string
}

export interface TopicDraftBody {
  title: string
  level: JlptLevel
  note: string | null
}

export type TopicDraftBodyResult = { ok: true; value: TopicDraftBody } | { ok: false; problems: TopicDraftBodyProblem[] }

const BODY_KEYS = ['title', 'level', 'note'] as const

function textField(
  problems: TopicDraftBodyProblem[],
  field: 'title' | 'note',
  raw: unknown,
  label: string,
  bounds: { min: number; max: number },
): string | null {
  if (typeof raw !== 'string') {
    problems.push({ field, reason: 'type', message: `${label}은(는) 글이어야 해요.` })
    return null
  }
  const t = cleanTopicText(raw)
  const n = codePointLength(t)
  if (n === 0 && bounds.min === 0) return null
  if (n < bounds.min) problems.push({ field, reason: n === 0 ? 'required' : 'min_length', message: n === 0 ? `${label}을(를) 적어 주세요.` : `${label}을(를) ${bounds.min}자 이상 적어 주세요.` })
  else if (n > bounds.max) problems.push({ field, reason: 'max_length', message: `${label}은(는) ${bounds.max}자까지 쓸 수 있어요.` })
  else if (/[<>]/.test(t)) problems.push({ field, reason: 'forbidden_char', message: `${label}에 꺾쇠(< >)는 쓸 수 없어요.` })
  else if (!/[\p{L}\p{N}]/u.test(t)) problems.push({ field, reason: 'no_text', message: `${label}에 글자를 적어 주세요.` })
  else if (isSecretLikeText(t)) problems.push({ field, reason: 'secret_like', message: `${label}에 비밀번호·키처럼 보이는 글은 넣을 수 없어요.` })
  else return t
  return null
}

/**
 * 주제 초안 요청 본문 검사(LLM 호출 전) — `{title, level?, note?}` 만(그 밖 키는 `unknown_key`). 문제는 한 번에 모두 모은다(화면이 칸마다 문구를 붙인다).
 * `level` 이 없으면 `opts.defaultLevel`(학습자 수준)을 쓴다. 라우트는 `problems[0]` 을 `ApiError('VALIDATION', message, {field, reason})` 로 바꾼다(#166 `parseScenarioDraftBody` 와 같은 400).
 * 꺾쇠·비밀 유사 글은 정리된 글 기준으로 판정한다.
 */
export function parseTopicDraftBody(body: unknown, opts: { defaultLevel?: JlptLevel } = {}): TopicDraftBodyResult {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return { ok: false, problems: [{ field: 'body', reason: 'type', message: '요청 형식이 올바르지 않아요.' }] }
  const o = body as Record<string, unknown>
  const problems: TopicDraftBodyProblem[] = []
  for (const k of Object.keys(o)) if (!(BODY_KEYS as readonly string[]).includes(k)) problems.push({ field: 'body', reason: 'unknown_key', message: `넣을 수 없는 항목이에요: ${k}` })

  let title: string | null = null
  if (o.title === undefined || o.title === null) problems.push({ field: 'title', reason: 'required', message: '주제를 적어 주세요.' })
  else title = textField(problems, 'title', o.title, '주제', { min: TOPIC_DRAFT_LIMITS.inputTitleMin, max: TOPIC_DRAFT_LIMITS.inputTitleMax })

  let level: JlptLevel | null = null
  const lv = o.level === undefined || o.level === null ? opts.defaultLevel : o.level
  if ((JLPT_LEVELS as readonly unknown[]).includes(lv)) level = lv as JlptLevel
  else problems.push({ field: 'level', reason: 'enum', message: '수준을 골라 주세요.' })

  let note: string | null = null
  if (o.note !== undefined && o.note !== null) note = textField(problems, 'note', o.note, '보충 설명', { min: 0, max: TOPIC_DRAFT_LIMITS.inputNoteMax })

  if (problems.length > 0 || title === null || level === null) return { ok: false, problems }
  return { ok: true, value: { title, level, note } }
}

// ─────────────────────────────────────────────────────────────────────────────
// 항목 검사·보정 (순수)
// ─────────────────────────────────────────────────────────────────────────────
const cps = (s: string): string[] => Array.from(s)
const cpLen = (s: string): number => cps(s).length

/** 코드포인트 `max` 이하로 자른다(넘으면 끝을 `…` 로, `…` 포함 `max` 이내). */
function cutTo(s: string, max: number): string {
  const a = cps(s)
  return a.length <= max ? s : `${a.slice(0, Math.max(1, max - 1)).join('').trimEnd()}…`
}

/** 이미 정리된 글 한 칸(보이지 않는 문자·꺾쇠 제거) — 모델 출력용. */
function cleanModelText(v: unknown): string {
  return typeof v === 'string' ? cleanTopicText(v).replace(/[<>]/g, '') : ''
}

// ── 모델이 낸 글·학습자가 고친 글에서 막는 것(REV-147 I-1) ────────────────────────────────────────────
// 입력 쪽(`parseTopicDraftBody`)은 꺾쇠·비밀 유사 글만 막고, 결과 쪽은 `cleanModelText` 가 꺾쇠를 **조용히 벗겨** `<script>` 가 `script` 로 남았다.
// 저장된 제목·설명은 이후 A12·#166 프롬프트로 다시 흘러가므로(2차 주입) URL·태그·키 모양·숨은 글자는 벗기지 않고 **막는다**.
// 엔진·모델 이름(claude 등)은 일부러 막지 않는다 — 학습자가 적은 주제 이름 자체일 수 있다(Leader 결정). 표현 칸(`checkTopicChunkFields`)의 `ENGINE_NAME` 은 기존대로다.
/** 막는 글의 종류 — 표현 칸에서는 버리는 이유 코드로도 쓴다(통계·로그용). */
export type TopicDraftUnsafeKind = 'CONTROL_CHARS' | 'MARKUP' | 'URL' | 'SECRET_LIKE'

/** 제어문자(줄바꿈·탭 포함)·서식(`Cf`)·사용자 정의(`Co`)·짝 없는 서로게이트·무시 가능(한글 채움 문자 등)·점자 공백·줄 구분자·NEL. */
const HIDDEN_OR_CONTROL = /[\p{Cc}\p{Cf}\p{Co}\p{Cs}\p{Default_Ignorable_Code_Point}\u{2800}\u{2028}\u{2029}\u{85}]/u
/** `scheme://`(http·https·ftp·file …)·`www.`·`javascript:`. 도메인만 있는 글(`example.com`)은 막지 않는다 — 오탐이 더 크다. */
const URL_LIKE = /[a-z][a-z0-9+.-]{1,15}:\/\/|\bwww\.|\bjavascript:/i

/**
 * 한 칸 글이 막아야 하는 종류인지 — 순서는 숨은·제어 문자 → 꺾쇠(전각 `＜＞` 포함, NFKC) → URL(전각 `ｈｔｔｐ：／／` 포함) → 비밀 모양(`isSecretLikeText`).
 * 아무 문제 없으면 `null`. **제목·설명처럼 줄바꿈을 공백으로 접는 칸은 호출 전에 접어서 넘긴다**(`fitTopicDraft`) — 이 함수는 줄바꿈도 `CONTROL_CHARS` 로 본다.
 * 저장 검증(학습자가 고친 제목·설명·표현)도 같은 함수를 써야 초안과 규칙이 같다.
 */
export function detectUnsafeTopicText(text: string): TopicDraftUnsafeKind | null {
  if (HIDDEN_OR_CONTROL.test(text)) return 'CONTROL_CHARS'
  const t = text.normalize('NFKC')
  if (/[<>]/.test(t)) return 'MARKUP'
  if (URL_LIKE.test(t)) return 'URL'
  if (isSecretLikeText(t)) return 'SECRET_LIKE'
  return null
}

/** 이모지 표현 선택자(VS16)·이모지 사이 접합 문자(ZWJ) — 그림 문자 바로 뒤(·사이)에 있을 때만 허용한다. 다른 자리의 같은 문자는 URL 쪼개기에 쓰일 수 있어 그대로 남긴다. */
const EMOJI_VS16 = /(\p{Extended_Pictographic}|[0-9#*])\u{FE0F}/gu
const EMOJI_ZWJ = /(\p{Extended_Pictographic}[\u{1F3FB}-\u{1F3FF}]?)\u{200D}(?=\p{Extended_Pictographic})/gu

/**
 * 학습자가 직접 고친 글(#57·#171 저장)용 `detectUnsafeTopicText` — REV-148 L-8: 「여행 ✈+VS16」·「👩+ZWJ+🍳」 처럼 **이모지에 붙은** VS16(U+FE0F)·ZWJ(U+200D) 만 허용한다.
 * 허용한 접합 문자를 걷어 낸 글로 원래 검사를 하므로(꺾쇠·URL·비밀 모양·제어문자 금지는 그대로) 이모지 자리 밖의 접합 문자나 그것으로 쪼갠 URL 은 여전히 막힌다.
 * 줄바꿈은 호출 전에 접어서 넘긴다(원래 함수와 같다). 원래 함수는 바꾸지 않는다 — AI 초안 검사는 계속 엄격하다.
 */
export function detectUnsafeUserTopicText(text: string): TopicDraftUnsafeKind | null {
  return detectUnsafeTopicText(text.replace(EMOJI_VS16, '$1').replace(EMOJI_ZWJ, '$1'))
}

// `topicWords.ts` 의 SURFACE_ALLOWED·READING_ALLOWED 와 같은 문자 종류다(드리프트는 단위 시험이 같은 표로 대조한다).
const KANA_CLASS = '\\u3041-\\u3096\\u30A1-\\u30FA\\u30FC'
const KANJI_CLASS = '\\u3005\\u3006\\u3400-\\u4DBF\\u4E00-\\u9FFF'
const SURFACE_ALLOWED = new RegExp(`^[${KANA_CLASS}\\u30FB${KANJI_CLASS}0-9０-９〜]+$`)
const SURFACE_HAS_LETTER = new RegExp(`[${KANA_CLASS}${KANJI_CLASS}]`)
const READING_ALLOWED = new RegExp(`^[${KANA_CLASS}\\u30FB]+$`)
const KANA_ANY = /[ぁ-ゖァ-ヺ]/
const HANGUL = /[가-힣]/
const JA_CHAR = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u

function normalizeMeaning(m: string): string {
  return m.normalize('NFKC').toLowerCase().replace(/[\s.,!?~·()（）、。，…-]/g, '')
}

/**
 * 기본 표현에 허용하는 급수 — **쉬운 쪽은 모두, 어려운 쪽은 학습자 수준보다 한 단계까지**(N5→N5·N4, N4→N5·N4·N3, N3→N5~N2, N1→전부).
 * A12 `topicWordsLevelWindow`(±1)와 일부러 다르다: 주제의 기본 표현에는 パスポート·荷物 같은 쉬운 말이 자연스럽게 섞이고, 문제는 너무 어려운 말뿐이다.
 */
export function topicDraftLevelWindow(level: JlptLevel): JlptLevel[] {
  const i = JLPT_LEVELS.indexOf(level)
  return JLPT_LEVELS.filter((_, j) => j <= (i < 0 ? 0 : i) + 1)
}

function isJlptLevel(v: unknown): v is JlptLevel {
  return typeof v === 'string' && (JLPT_LEVELS as readonly string[]).includes(v)
}

/** 버려진 표현의 이유 — 통계·로그용 고정 코드(사용자에게 보이지 않는다). */
export type TopicDraftDropReason =
  | 'MALFORMED'
  | 'ENGINE_NAME' // 엔진·모델 이름이 응답에 나옴
  | 'SURFACE_LEN'
  | 'SURFACE_CHARS' // textJa 가 가나·한자·숫자 외 문자(한글·로마자·괄호·부호·공백)를 포함하거나 가나·한자가 한 글자도 없음
  | 'READING_LEN'
  | 'READING_CHARS' // reading 이 가나(·ー·・) 외 문자를 포함
  | 'READING_MISMATCH' // 가나로 쓴 부분(앞·뒤 가나 구간·전부 가나인 표기)이 reading 과 어긋남
  | 'MEANING_CHARS' // meaningKo 에 한글이 없거나 가나 포함, 길이 0 또는 > meaningMax
  | 'JLPT_TOO_HARD' // jlpt 가 학습자 수준보다 두 단계 이상 어려움(`topicDraftLevelWindow`)
  | 'DUP_SURFACE' // 앞 표현과 같은 표기(정규화 키)
  | 'DUP_MEANING' // 앞 표현과 뜻이 같음
  | 'TYPE_OVER' // 한 유형이 perTypeMax 개를 넘음 — 앞선 것만 남김
  | TopicDraftUnsafeKind // CONTROL_CHARS(숨은·제어 문자·줄바꿈) · MARKUP(꺾쇠) · URL · SECRET_LIKE(키·토큰 모양) — 세 칸 어디에 있어도 그 표현을 버린다

/**
 * 표현 한 개의 표기·읽기·뜻 검사(엔진명 → 막는 글(숨은 문자·꺾쇠·URL·비밀 모양) → 표기 길이·문자 → 읽기 길이·문자·표기 대조 → 뜻 문자·길이) — 통과하면 `null`, 아니면 버리는 이유.
 * `fitTopicDraft`(AI 응답)와 **저장 검증(라우트가 학습자가 고친 표현을 다시 검사할 때)** 이 같은 규칙을 쓰도록 분리했다. 급수·중복·유형 수는 여기서 보지 않는다(초안 전용 규칙).
 * 한자 읽기 자체가 맞는지는 알 수 없다(가나로 쓴 앞·뒤 구간과 길이만 대조) — 그건 학습자 검토 몫이다.
 * 표현은 한 줄 칸이라 줄바꿈도 `CONTROL_CHARS` 로 막는다(제목·설명처럼 공백으로 접지 않는다).
 */
export function checkTopicChunkFields(textJa: string, reading: string, meaningKo: string): TopicDraftDropReason | null {
  const L = TOPIC_DRAFT_LIMITS
  if ([textJa, reading, meaningKo].some((t) => llm.mentionsEngineIdentity(t))) return 'ENGINE_NAME'
  for (const t of [textJa, reading, meaningKo]) {
    const unsafe = detectUnsafeTopicText(t)
    if (unsafe) return unsafe
  }
  const surfaceLen = cpLen(textJa)
  if (surfaceLen < 1 || surfaceLen > L.textJaMax) return 'SURFACE_LEN'
  if (!SURFACE_ALLOWED.test(textJa) || !SURFACE_HAS_LETTER.test(textJa)) return 'SURFACE_CHARS'
  const readingLen = cpLen(reading)
  if (readingLen < 1 || readingLen > L.readingMax) return 'READING_LEN'
  if (!READING_ALLOWED.test(reading) || !KANA_ANY.test(reading)) return 'READING_CHARS'
  if (!readingMatchesSurface(textJa, reading)) return 'READING_MISMATCH'
  const meaningLen = cpLen(meaningKo)
  if (meaningLen < 1 || meaningLen > L.meaningMax || !HANGUL.test(meaningKo) || KANA_ANY.test(meaningKo)) return 'MEANING_CHARS'
  return null
}

export interface TopicDraftChunk {
  chunkType: ChunkType
  textJa: string
  reading: string
  meaningKo: string
}

export interface TopicDraftOutput {
  /** 한국어 주제 제목(≤20자). */
  title: string
  /** 일본어 제목(≤20자, 가나·한자뿐일 때만) — 아니면 null. */
  titleJa: string | null
  /** 학습자가 고른 수준(모델 출력과 무관). */
  level: JlptLevel
  /** 한국어 한 줄 설명(≤120자) — 한글이 없거나 비면 null. */
  description: string | null
  /** 기본 표현(유형 NAME·ACTION·FEELING·MODIFIER 순, 같은 유형 안은 모델이 낸 순서). `order` 는 저장 때 배열 인덱스로 채운다. */
  chunks: TopicDraftChunk[]
}

export type TopicDraftFinalStatus = 'OK' | 'NOT_A_TOPIC' | 'UNSAFE' | 'INVALID'

/** `TEXT_UNSAFE` = 제목·일본어 제목·설명(폴백한 입력 제목 포함) 중 하나에 URL·꺾쇠·비밀 모양·숨은 문자가 있다 — 벗겨서 쓰지 않고 **초안 전체를 거절**하고 JSON 재시도 1회로 보낸다. */
export type TopicDraftProblem = 'DRAFT_MISSING' | 'TITLE_EMPTY' | 'TEXT_UNSAFE' | 'CHUNKS_TOO_FEW'

/** `TITLE_TRUNCATED`(task-045 T2, REV-147 L-7) = 제목이 `titleMax` 를 넘어 `…` 로 잘렸다(입력 21~40자를 모델이 줄이지 않은 경우 등) — 화면이 「제목이 길어서 줄였어요」를 띄운다. */
export type TopicDraftWarning = 'CHUNKS_SHORT' | 'DESCRIPTION_MISSING' | 'TITLE_JA_MISSING' | `TYPE_THIN_${ChunkType}` | 'TITLE_TRUNCATED'

export interface TopicDraftRepairs {
  /** 모델이 낸 표현 수(통과 + 버림). */
  received: number
  /** 통과해 초안에 남은 표현 수. */
  kept: number
  dropped: Array<{ textJa: string; reason: TopicDraftDropReason }>
  droppedByReason: Partial<Record<TopicDraftDropReason, number>>
  /** 제목·일본어 제목·설명을 길이 상한으로 자른 칸 수. */
  truncated: number
  /** 모델 제목이 비어 입력 주제 이름으로 대신한 경우. */
  titleFallback: boolean
  /** 유형별 남은 표현 수. */
  typeCounts: Record<ChunkType, number>
}

export interface TopicDraftContext {
  /** 학습자가 고른 수준 — 결과 `level`·수준 창(`topicDraftLevelWindow`: 쉬운 쪽 전부·어려운 쪽 한 단계)의 기준. */
  level: JlptLevel
  /** 학습자가 쓴 주제 이름(정리된 것) — 모델 제목이 비었을 때 대신 쓴다. */
  title?: string | null
}

export interface TopicDraftFinal {
  status: TopicDraftFinalStatus
  /** `status === 'OK'` 일 때만. */
  draft: TopicDraftOutput | null
  /** `status === 'INVALID'` 일 때 이유 코드(재시도 안내·Trace 용). */
  problems: TopicDraftProblem[]
  /** `status === 'OK'` 일 때 화면이 알릴 수 있는 사항(고칠 수는 있지만 초안은 그대로 쓸 수 있다). */
  warnings: TopicDraftWarning[]
  repairs: TopicDraftRepairs
}

const emptyTypeCounts = (): Record<ChunkType, number> => ({ NAME: 0, ACTION: 0, FEELING: 0, MODIFIER: 0 })
const emptyRepairs = (): TopicDraftRepairs => ({ received: 0, kept: 0, dropped: [], droppedByReason: {}, truncated: 0, titleFallback: false, typeCounts: emptyTypeCounts() })

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

const done = (status: TopicDraftFinalStatus, repairs: TopicDraftRepairs, problems: TopicDraftProblem[] = []): TopicDraftFinal => ({ status, draft: null, problems, warnings: [], repairs })

/**
 * 모델 응답 → 쓸 수 있는 초안. 스키마를 통과한 응답을 받지만 방어적으로 읽는다. 표현은 **항목 단위로 버리고**(응답 전체를 다시 부르지 않는다) 고칠 수 있는 글 길이는
 * 자른다. 고칠 수 없는 것(초안 없음·제목 없음·쓸 수 있는 표현 `chunksMin` 미만)은 `INVALID` 와 이유를 돌려준다.
 * `NOT_A_TOPIC`·`UNSAFE` 는 모델이 draft 를 같이 내도 무시하고 초안 없이 돌려준다(상태가 이긴다).
 */
export function fitTopicDraft(ctx: TopicDraftContext, data: TopicDraftResponse): TopicDraftFinal {
  const repairs = emptyRepairs()
  const status = data?.status
  if (status === 'NOT_A_TOPIC' || status === 'UNSAFE') return done(status, repairs)
  const d = asRecord(data?.draft)
  if (status !== 'OK' || !d) return done('INVALID', repairs, ['DRAFT_MISSING'])

  const L = TOPIC_DRAFT_LIMITS
  const cut = (v: unknown, max: number): string => {
    const t = cleanModelText(v)
    if (cpLen(t) > max) {
      repairs.truncated += 1
      return cutTo(t, max)
    }
    return t
  }
  // 막는 글(I-1): 줄바꿈은 예전처럼 공백으로 접고(`cleanTopicText`) 나머지 숨은·제어 문자·꺾쇠·URL·비밀 모양은 **자르기 전의 원문 전체**에서 찾는다
  // (뒤쪽이 20자 자름에 잘려 나가기 전에 본다). 벗겨서 통과시키지 않는다 — 한 칸이라도 걸리면 초안 전체가 INVALID.
  let unsafeText = false
  const guardText = (v: unknown): void => {
    if (typeof v === 'string' && detectUnsafeTopicText(v.replace(LINE_BREAKS, ' ')) !== null) unsafeText = true
  }
  guardText(d.title)
  guardText(d.titleJa)
  guardText(d.description)

  let title = cut(d.title, L.titleMax)
  let titleTruncated = cpLen(cleanModelText(d.title)) > L.titleMax
  if (!title && ctx.title) {
    title = cutTo(cleanModelText(ctx.title), L.titleMax)
    titleTruncated = cpLen(cleanModelText(ctx.title)) > L.titleMax
    repairs.titleFallback = title !== ''
    guardText(ctx.title) // 입력 제목은 본문 검사(꺾쇠·비밀)를 이미 지났지만 URL 은 아직이다 — 폴백으로 쓰는 값도 같은 규칙
  }
  const problems: TopicDraftProblem[] = []
  if (!title) problems.push('TITLE_EMPTY')
  if (unsafeText) problems.push('TEXT_UNSAFE')
  const titleJaRaw = cut(d.titleJa, L.titleJaMax)
  const titleJa = titleJaRaw && JA_CHAR.test(titleJaRaw) && !HANGUL.test(titleJaRaw) ? titleJaRaw : null
  const descRaw = cut(d.description, L.descriptionMax)
  const description = descRaw && HANGUL.test(descRaw) ? descRaw : null

  // ── 표현 ─────────────────────────────────────────────────────────────────────
  const window = new Set<string>(topicDraftLevelWindow(ctx.level))
  const list = Array.isArray(d.chunks) ? d.chunks : []
  const seenSurface = new Set<string>()
  const seenMeaning = new Set<string>()
  const byType: Record<ChunkType, TopicDraftChunk[]> = { NAME: [], ACTION: [], FEELING: [], MODIFIER: [] }
  const drop = (textJa: string, reason: TopicDraftDropReason) => {
    repairs.dropped.push({ textJa, reason })
    repairs.droppedByReason[reason] = (repairs.droppedByReason[reason] ?? 0) + 1
  }
  for (const item of list) {
    repairs.received++
    const o = asRecord(item)
    if (!o || typeof o.textJa !== 'string' || typeof o.reading !== 'string' || typeof o.meaningKo !== 'string') {
      drop(typeof o?.textJa === 'string' ? o.textJa : '', 'MALFORMED')
      continue
    }
    const textJa = o.textJa.trim()
    const reading = o.reading.trim()
    const meaningKo = o.meaningKo.replace(/\s*[,，、]\s*/g, ', ').trim()
    const chunkType = o.chunkType
    const jlpt = o.jlpt === null || o.jlpt === undefined || o.jlpt === 'null' ? null : o.jlpt
    if (!(CHUNK_TYPES as readonly unknown[]).includes(chunkType) || (jlpt !== null && !isJlptLevel(jlpt))) {
      drop(textJa, 'MALFORMED')
      continue
    }
    const bad = checkTopicChunkFields(textJa, reading, meaningKo)
    if (bad) {
      drop(textJa, bad)
      continue
    }
    if (jlpt !== null && !window.has(jlpt)) {
      drop(textJa, 'JLPT_TOO_HARD')
      continue
    }
    const key = normalizeTopicWordKey(textJa)
    if (seenSurface.has(key)) {
      drop(textJa, 'DUP_SURFACE')
      continue
    }
    const mKey = normalizeMeaning(meaningKo)
    if (mKey && seenMeaning.has(mKey)) {
      drop(textJa, 'DUP_MEANING')
      continue
    }
    const type = chunkType as ChunkType
    if (byType[type].length >= L.perTypeMax) {
      drop(textJa, 'TYPE_OVER')
      continue
    }
    seenSurface.add(key)
    if (mKey) seenMeaning.add(mKey)
    byType[type].push({ chunkType: type, textJa, reading, meaningKo })
  }
  const chunks = CHUNK_TYPES.flatMap((t) => byType[t])
  repairs.kept = chunks.length
  for (const t of CHUNK_TYPES) repairs.typeCounts[t] = byType[t].length
  if (chunks.length < L.chunksMin) problems.push('CHUNKS_TOO_FEW')
  if (problems.length > 0) return done('INVALID', repairs, problems)

  const warnings = topicContentWarnings({ titleJa, description, chunks })
  if (titleTruncated) warnings.push('TITLE_TRUNCATED')
  return { status: 'OK', draft: { title, titleJa, level: ctx.level, description, chunks }, problems: [], warnings, repairs }
}

/**
 * 초안·저장한 주제 공통 안내(저장을 막지 않는다) — 순서 고정: `CHUNKS_SHORT` → `TYPE_THIN_*`(유형 순) → `DESCRIPTION_MISSING` → `TITLE_JA_MISSING`.
 * `TITLE_TRUNCATED` 는 초안에서만(저장은 20자 초과를 400 으로 막는다).
 */
export function topicContentWarnings(t: { titleJa: string | null; description: string | null; chunks: ReadonlyArray<{ chunkType: string }> }): TopicDraftWarning[] {
  const L = TOPIC_DRAFT_LIMITS
  const warnings: TopicDraftWarning[] = []
  if (t.chunks.length < L.chunksTarget) warnings.push('CHUNKS_SHORT')
  for (const type of CHUNK_TYPES) if (t.chunks.filter((c) => c.chunkType === type).length < L.perTypeMin) warnings.push(`TYPE_THIN_${type}`)
  if (!t.description) warnings.push('DESCRIPTION_MISSING')
  if (!t.titleJa) warnings.push('TITLE_JA_MISSING')
  return warnings
}

/** 저장 검사(#57·#171)의 표현 중복 — 초안과 같은 정규화(표기 `normalizeTopicWordKey`·뜻 `normalizeMeaning`). 첫 중복의 위치와 종류, 없으면 null. */
export function findTopicChunkDuplicate(chunks: ReadonlyArray<{ textJa: string; meaningKo: string }>): { index: number; reason: 'DUP_SURFACE' | 'DUP_MEANING' } | null {
  const surfaces = new Set<string>()
  const meanings = new Set<string>()
  for (const [index, c] of chunks.entries()) {
    const key = normalizeTopicWordKey(c.textJa)
    if (surfaces.has(key)) return { index, reason: 'DUP_SURFACE' }
    const m = normalizeMeaning(c.meaningKo)
    if (m && meanings.has(m)) return { index, reason: 'DUP_MEANING' }
    surfaces.add(key)
    if (m) meanings.add(m)
  }
  return null
}

const PROBLEM_TEXT: Record<TopicDraftProblem, string> = {
  DRAFT_MISSING: 'status 가 OK 이면 draft 객체가 있어야 합니다.',
  TITLE_EMPTY: 'draft.title 이 비어 있습니다.',
  TEXT_UNSAFE: 'draft.title·titleJa·description 에는 URL(http://·www.)·꺾쇠(< >)·키나 비밀번호처럼 보이는 글·보이지 않는 글자를 넣지 않습니다. 평범한 한 줄 글로 다시 쓰세요.',
  CHUNKS_TOO_FEW: `draft.chunks 는 쓸 수 있는 표현(읽기가 가나로 정확하고 서로 겹치지 않으며 한 유형 ${TOPIC_DRAFT_LIMITS.perTypeMax}개 이하)이 ${TOPIC_DRAFT_LIMITS.chunksMin}개 이상이어야 합니다.`,
}

/** `completeJson` 의 `extraCheck` — 고칠 수 없는 위반만 알려 JSON 재시도 1회로 보낸다(그 밖은 `fitTopicDraft` 가 항목 단위로 버린다). */
export function topicDraftViolations(ctx: TopicDraftContext, data: TopicDraftResponse): string[] {
  const fin = fitTopicDraft(ctx, data)
  return fin.status === 'INVALID' ? fin.problems.map((p) => PROBLEM_TEXT[p]) : []
}
