/**
 * AI 시나리오 초안(`scenarioDraft`, S3 `POST /api/v1/scenarios/drafts` #166) 응답 계약 — task-010d PE-2b. 프롬프트는 `prompts/scenarioDraft.ts`.
 *
 * 설계(왜 모델 출력이 `ScenarioInput` 모양과 다른가):
 *  - 모델은 **납작한 초안**(`title`·`titleJa`·`difficulty`·`roles`·`goalKo`·`successCriteria[]`·`steps[]`(글 목록)·`keyExpressions[{ja,reading,ko}]`·`requiredExpressions`·`opening`)을 낸다.
 *    `level`·`description`·`topicIds` 는 모델이 내지 않는다 — 학습자가 고른 값·쓴 글이라 코드가 그대로 채운다(`fitScenarioDraft`). 모델이 말한 수준이 학습자 선택과 어긋나는 일을 없애고 출력 토큰을 아낀다.
 *  - 최종 결과(`ScenarioDraftFinal.draft`)는 `types/scenario.ts` `ScenarioInput` 과 같은 모양이다(`goal{communicativeGoalKo, successCriteria}`·`steps[{ko}]`·표현에 id 없음) — S3 응답을
 *    그대로 #163 만들기 본문으로 쓸 수 있고, 서버가 `normalizeScenarioInput(draft, 'create')` 를 통과시키면 문제가 없도록 **한도 안으로 맞춘다**(테스트가 실제 `normalizeScenarioInput` 과 대조).
 *  - **재시도 비용을 아낀다**: 사용자가 기다리는 호출이라(가이드 15초 "조금 오래") ajv 위반·`extraCheck` 위반은 모두 +1회 호출(= 지연 두 배)이다. 그래서 스키마는 **개수 하한과 상식적인 길이 상한**만 막고,
 *    길이 초과·중복·너무 짧은 표현·가나가 아닌 읽기 같은 "고칠 수 있는 것"은 코드가 결정적으로 고친다(`fitScenarioDraft`). `extraCheck` 는 고칠 수 없는 것(대화 순서·표현이 2개 미만이 됨 등)만 알린다.
 *  - 상황으로 만들 수 없는 입력(`status = NOT_SITUATION | UNSAFE`)은 초안 없이 돌아온다 → 라우트가 422 `dr-gen-422`. 사유 코드만 Trace 에 남긴다(입력 원문 금지).
 *
 * 핵심 표현 규칙의 근거: 코드의 표현 확인(`learning/lessons/matching.ts` `chunkForms`)은 문장부호·〜 를 뗀 표기가 학습자 말에 **그대로 들어 있는지**를 본다 — 고정 부분이 3자 이하면
 * 아무 말에나 걸리고(A1-PE 교훈 "표기 3자 이하 짧은 표현은 겹침 기준이 약하다"), 구체 명사가 든 긴 문장은 같은 말을 해도 걸리지 않는다. 그래서 틀(〜를 빈자리로) + 고정 부분 5자 이상("5자 이상 구체적" — Leader 지시)을 요구한다.
 */
import type { JlptLevel } from '@/types/lesson'
import { SCENARIO_LIMITS as L, type ScenarioInput } from '@/types/scenario'

/** 표현 고정 부분(〜·문장부호·공백 제외)의 최소 글자 수 — 미만은 코드가 버린다(지시문은 5자 이상을 권한다). */
export const SCENARIO_DRAFT_EXPRESSION_CORE_MIN = 5
/** 모델이 권하는 개수(지시문). 상한·하한 자체는 `SCENARIO_LIMITS` 가 정한다. */
export const SCENARIO_DRAFT_STEPS_HINT = '4~6'
export const SCENARIO_DRAFT_EXPRESSIONS_HINT = '5~8'
/** 필수 표현 수 상한(지시문 "2~3") — 표현이 많아도 이 이상은 요구하지 않는다. */
export const SCENARIO_DRAFT_REQUIRED_MAX = 3
/** 입력 설명 상한 — `SCENARIO_LIMITS.descriptionMax`(300) 와 같다. */
export const SCENARIO_DRAFT_DESCRIPTION_MAX = L.descriptionMax

export type ScenarioDraftStatus = 'OK' | 'NOT_SITUATION' | 'UNSAFE'

export interface ScenarioDraftModel {
  title: string
  titleJa: string
  difficulty: number
  roles: { learner: string; tutor: string }
  goalKo: string
  successCriteria: string[]
  steps: string[]
  keyExpressions: { ja: string; reading: string; ko: string }[]
  requiredExpressions: number
  opening: { ja: string; ko: string }
}

export interface ScenarioDraftResponse {
  status: ScenarioDraftStatus
  draft: ScenarioDraftModel | null
}

const str = (max: number, min = 1) => ({ type: 'string', minLength: min, maxLength: max }) as const

const DRAFT_OBJECT = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'titleJa', 'difficulty', 'roles', 'goalKo', 'successCriteria', 'steps', 'keyExpressions', 'requiredExpressions', 'opening'],
  properties: {
    // 선언 순서 = 출력 순서 지시. 순서(steps)가 표현보다 먼저, 첫마디(opening)가 맨 끝(상황을 다 정한 뒤 쓴다).
    title: str(L.titleMax),
    titleJa: str(L.titleJaMax),
    difficulty: { type: 'integer', minimum: L.difficultyMin, maximum: L.difficultyMax },
    roles: {
      type: 'object',
      additionalProperties: false,
      required: ['learner', 'tutor'],
      properties: { learner: str(L.roleMax), tutor: str(L.roleMax) },
    },
    goalKo: str(L.goalMax),
    successCriteria: { type: 'array', minItems: L.successCriteriaMin, maxItems: L.successCriteriaMax, items: str(L.successCriterionMax) },
    steps: { type: 'array', minItems: L.stepsMin, maxItems: L.stepsMax, items: str(L.stepMax) },
    keyExpressions: {
      type: 'array',
      minItems: L.expressionsMin,
      maxItems: L.expressionsMax,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['ja', 'reading', 'ko'],
        // reading 은 비어 있어도 된다(ja 가 전부 가나) — 가나가 아닌 읽기는 스키마가 아니라 코드가 버린다(재시도를 만들지 않는다).
        properties: { ja: str(L.expressionJaMax), reading: str(L.expressionReadingMax, 0), ko: str(L.expressionKoMax) },
      },
    },
    requiredExpressions: { type: 'integer', minimum: 1, maximum: L.expressionsMax },
    opening: {
      type: 'object',
      additionalProperties: false,
      required: ['ja', 'ko'],
      properties: { ja: str(L.openingJaMax), ko: str(L.openingKoMax) },
    },
  },
} as const

export const SCENARIO_DRAFT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'draft'],
  properties: {
    status: { type: 'string', enum: ['OK', 'NOT_SITUATION', 'UNSAFE'] },
    draft: { anyOf: [{ type: 'null' }, DRAFT_OBJECT] },
  },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// 글 정리(순수) — `learning/scenarios/shape.ts` `cleanScenarioText` 와 같은 결과여야 한다(테스트가 대조)
// ─────────────────────────────────────────────────────────────────────────────
const BRAILLE_BLANK = String.fromCodePoint(0x2800)

/** 한 줄 글 정리: 공백류(줄바꿈 포함) → 한 칸, 서식·제어·무시 가능 문자 제거, 꺾쇠(`<` `>`) 제거(사용자 상황 입력 검사가 400 으로 막는 문자). */
export function cleanDraftText(raw: unknown): string {
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
const cpLen = (s: string): number => cps(s).length

/** 코드포인트 `max` 이하로 자른다(넘으면 끝을 `…` 로). */
function cutTo(s: string, max: number): string {
  const a = cps(s)
  return a.length <= max ? s : `${a.slice(0, Math.max(1, max - 1)).join('').trimEnd()}…`
}

const JA_CHAR = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u
const HANGUL = /\p{Script=Hangul}/u
const KANJI = /\p{Script=Han}/u
/** `schemas.ts` `LESSON_READING_PATTERN` 과 같은 문자 종류(히라가나·가타카나·장음·문장부호·공백). */
const READING_RE = /^[\p{Script=Hiragana}\p{Script=Katakana}ー・「」『』〜…、。！？!?\s]*$/u
const MATCH_STRIP = /[\s　、。，．,.!！?？・「」『』（）()【】〔〕［］[\]〈〉《》…‥~〜～"'“”‘’:：;；-]/g

const kataToHira = (s: string): string => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))

/** 표현 비교·길이용 핵심 — `learning/lessons/matching.ts` `normalizeForMatch` 와 같은 규칙(가타카나→히라가나, 부호·〜 제거). */
export function expressionCore(ja: string): string {
  return kataToHira(ja.normalize('NFKC')).toLowerCase().replace(MATCH_STRIP, '')
}

/**
 * 어느 상황에나 쓰는 사회적 말(인사·감사·사과·네/아니오·알겠다) — **통째로** 이런 말인 표현은 버린다(필수 표현 수가 이런 말로 채워지면 연습이 되지 않는다).
 * 값은 `expressionCore` 결과(히라가나, 부호 제거). 이 말이 *들어 있는* 긴 표현은 그대로 둔다. 시드 점검(`tests/prompts/scenario-seed-check.ts` FILLERS)과 같은 취지.
 */
export const GENERIC_EXPRESSION_CORES: ReadonlySet<string> = new Set(
  [
    'ありがとう', 'ありがとうございます', 'ありがとうございました', 'どうもありがとうございます', 'どうもありがとうございました', 'どうも',
    'すみません', 'すいません', 'ごめんなさい', 'ごめん', 'しつれいします', 'しつれいしました',
    'はい', 'いいえ', 'ええ', 'うん', 'そうです', 'そうですね', 'そうですか', 'わかりました', 'かしこまりました', 'だいじょうぶです', 'だいじょうぶ',
    'こんにちは', 'こんばんは', 'おはようございます', 'おはよう', 'さようなら', 'じゃあね', 'またね',
    'よろしくおねがいします', 'よろしくおねがいいたします', 'おねがいします', 'おねがいいたします', 'おねがい',
    'いただきます', 'ごちそうさまでした', 'おつかれさまです', 'おつかれさまでした', 'おげんきですか', 'げんきです',
  ].map((t) => expressionCore(t)),
)

/** 자리표시 기호(〇○◯□ 와 반각·전각 물결) — 코드의 표현 확인이 쓰는 정규화는 이 기호를 모르므로 `〜` 하나로 통일하고, 중간 빈칸은 버린다. */
const BLANK_RUN = /[〇○◯□～~〜]+/gu

/** `〜` 로 통일한 표현이 맨 앞·맨 끝이 아닌 **중간**에 빈칸을 가졌는가(고정 글이 빈칸 양쪽에 모두 있음) — 코드의 표현 확인이 이어진 글만 찾아 이런 표현은 쓴 것으로 인정되지 않는다. */
export function hasMiddleBlank(ja: string): boolean {
  if (!ja.includes('〜')) return false
  const fixed = ja.split('〜').map((part) => expressionCore(part).length > 0)
  return fixed.indexOf(true) !== fixed.lastIndexOf(true)
}

// ─────────────────────────────────────────────────────────────────────────────
// 보정
// ─────────────────────────────────────────────────────────────────────────────
export interface ScenarioDraftContext {
  /** 학습자가 고른 수준. 결과 `level` 이 이 값이다(모델 출력과 무관). */
  level: JlptLevel
  /** 학습자가 쓴 상황 설명 — `description` 으로 그대로(≤300자) 싣는다. */
  description?: string | null
  /** 학습자가 고른 장소(주제) id — 있으면 `topicIds` 로 싣는다(권한 확인은 서버). 프롬프트에는 넣지 않는다. */
  topicId?: string | null
}

export type ScenarioDraftOutput = Required<Pick<ScenarioInput, 'title' | 'level' | 'difficulty' | 'roles' | 'goal' | 'steps' | 'keyExpressions' | 'requiredExpressions'>> & {
  titleJa: string | null
  description: string | null
  opening: { ja: string; ko: string } | null
  topicIds?: string[]
}

/** 코드가 고친 것 — Trace 수치용(원문 없음). */
export interface ScenarioDraftRepairs {
  /** 길이 상한으로 잘린 글 칸 수(제목·역할·목표·조건·순서·뜻·첫마디 뜻). */
  truncated: number
  droppedSteps: number
  droppedCriteria: number
  /** 표현을 버린 이유별 수. */
  droppedExpressions: { tooLong: number; tooShort: number; notJapanese: number; duplicate: number; noMeaning: number; overLimit: number; generic: number; midBlank: number }
  /** 가나가 아니어서 버린 읽기 수(표현은 남김). */
  readingsDropped: number
  /** 첫마디를 쓸 수 없어 `null` 로 둔 경우. */
  openingDropped: boolean
  difficultyClamped: boolean
  requiredClamped: boolean
}

export type ScenarioDraftProblem =
  | 'DRAFT_MISSING'
  | 'TITLE_EMPTY'
  | 'ROLES_EMPTY'
  | 'GOAL_EMPTY'
  | 'CRITERIA_EMPTY'
  | 'STEPS_TOO_FEW'
  | 'EXPRESSIONS_TOO_FEW'

export type ScenarioDraftFinalStatus = 'OK' | 'NOT_SITUATION' | 'UNSAFE' | 'INVALID'

export interface ScenarioDraftFinal {
  status: ScenarioDraftFinalStatus
  /** `status === 'OK'` 일 때만. */
  draft: ScenarioDraftOutput | null
  /** `status === 'INVALID'` 일 때 이유 코드(재시도 안내·Trace 용). */
  problems: ScenarioDraftProblem[]
  repairs: ScenarioDraftRepairs
}

/** 수준별 난이도 띠(지시문과 같다). 모델 값이 띠 밖이면 가까운 쪽으로 옮긴다. */
export const SCENARIO_DRAFT_DIFFICULTY_BAND: Readonly<Record<JlptLevel, readonly [number, number]>> = {
  N5: [1, 2],
  N4: [2, 3],
  N3: [3, 4],
  N2: [3, 5],
  N1: [4, 5],
}

const emptyRepairs = (): ScenarioDraftRepairs => ({
  truncated: 0,
  droppedSteps: 0,
  droppedCriteria: 0,
  droppedExpressions: { tooLong: 0, tooShort: 0, notJapanese: 0, duplicate: 0, noMeaning: 0, overLimit: 0, generic: 0, midBlank: 0 },
  readingsDropped: 0,
  openingDropped: false,
  difficultyClamped: false,
  requiredClamped: false,
})

/** 문장 끝의 다듬기 — 모델이 붙이는 바깥 따옴표(「」 "")를 뗀다. */
function unquote(s: string): string {
  return s.replace(/^[「『"“]+/, '').replace(/[」』"”]+$/, '').trim()
}

const noProblems = (status: ScenarioDraftFinalStatus, repairs: ScenarioDraftRepairs, problems: ScenarioDraftProblem[] = []): ScenarioDraftFinal => ({ status, draft: null, problems, repairs })

/**
 * 모델 응답 → `ScenarioInput` 모양 초안. 스키마를 통과한 응답을 받지만 방어적으로 읽는다. 고칠 수 있는 것은 고치고(`repairs` 로 센다),
 * 고칠 수 없는 것(필수 칸이 비었거나 순서·표현이 2개 미만)은 `INVALID` 와 이유를 돌려준다.
 */
export function fitScenarioDraft(ctx: ScenarioDraftContext, data: ScenarioDraftResponse): ScenarioDraftFinal {
  const repairs = emptyRepairs()
  const status = data?.status
  if (status === 'NOT_SITUATION' || status === 'UNSAFE') return noProblems(status, repairs)
  const d = data?.draft
  if (status !== 'OK' || !d || typeof d !== 'object') return noProblems('INVALID', repairs, ['DRAFT_MISSING'])

  const problems: ScenarioDraftProblem[] = []
  const text = (v: unknown, max: number): string => {
    const t = cleanDraftText(v)
    if (cpLen(t) > max) {
      repairs.truncated += 1
      return cutTo(t, max)
    }
    return t
  }

  const title = text(d.title, L.titleMax)
  if (!title) problems.push('TITLE_EMPTY')
  const titleJaRaw = text(d.titleJa, L.titleJaMax)
  const titleJa = titleJaRaw && JA_CHAR.test(titleJaRaw) && !HANGUL.test(titleJaRaw) ? titleJaRaw : null

  const learner = text(d.roles?.learner, L.roleMax)
  const tutor = text(d.roles?.tutor, L.roleMax)
  if (!learner || !tutor) problems.push('ROLES_EMPTY')

  const goalKo = text(d.goalKo, L.goalMax)
  if (!goalKo) problems.push('GOAL_EMPTY')

  const seenCriteria = new Set<string>()
  const criteria: string[] = []
  for (const c of Array.isArray(d.successCriteria) ? d.successCriteria : []) {
    const t = text(c, L.successCriterionMax)
    if (!t || seenCriteria.has(t)) {
      repairs.droppedCriteria += t ? 1 : 0
      continue
    }
    seenCriteria.add(t)
    criteria.push(t)
  }
  if (criteria.length > L.successCriteriaMax) repairs.droppedCriteria += criteria.length - L.successCriteriaMax
  if (!criteria.length) problems.push('CRITERIA_EMPTY')

  const steps: string[] = []
  for (const s of Array.isArray(d.steps) ? d.steps : []) {
    const t = text(s, L.stepMax)
    if (t) steps.push(t)
    else repairs.droppedSteps += 1
  }
  if (steps.length > L.stepsMax) {
    repairs.droppedSteps += steps.length - L.stepsMax
    steps.length = L.stepsMax
  }
  if (steps.length < L.stepsMin) problems.push('STEPS_TOO_FEW')

  const seenCore = new Set<string>()
  const expressions: { ja: string; reading?: string; ko: string }[] = []
  for (const e of Array.isArray(d.keyExpressions) ? d.keyExpressions : []) {
    // 일본어 글 사이의 띄어쓰기는 걷는다(모델이 단어 사이에 공백을 넣는 경우가 있다 — 「これが パスポートです」). 코드의 표현 확인도 공백을 무시한다.
    const ja = unquote(cleanDraftText(e?.ja)).replace(/(?<=[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー〜、。！？]) +| +(?=[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}〜])/gu, '').replace(BLANK_RUN, '〜')
    if (!ja || !JA_CHAR.test(ja) || HANGUL.test(ja)) {
      repairs.droppedExpressions.notJapanese += 1
      continue
    }
    if (cpLen(ja) > L.expressionJaMax) {
      repairs.droppedExpressions.tooLong += 1
      continue
    }
    const core = expressionCore(ja)
    if (cpLen(core) < SCENARIO_DRAFT_EXPRESSION_CORE_MIN) {
      repairs.droppedExpressions.tooShort += 1
      continue
    }
    if (GENERIC_EXPRESSION_CORES.has(core)) {
      repairs.droppedExpressions.generic += 1
      continue
    }
    if (hasMiddleBlank(ja)) {
      repairs.droppedExpressions.midBlank += 1
      continue
    }
    const ko = text(e?.ko, L.expressionKoMax)
    if (!ko) {
      repairs.droppedExpressions.noMeaning += 1
      continue
    }
    // 같은 표현(가나 종류·부호만 다름)이나 한쪽이 다른 쪽에 통째로 들어 있으면(코드 표현 확인이 둘을 구분하지 못한다) 먼저 나온 것만.
    const dup = seenCore.has(core) || [...seenCore].some((c) => c.includes(core) || core.includes(c))
    if (dup) {
      repairs.droppedExpressions.duplicate += 1
      continue
    }
    seenCore.add(core)
    // 읽기는 띄어쓰기 없이 이어 쓴다(모델이 단어 사이에 공백을 넣는 경우가 있다 — 화면 ruby·검색에 방해).
    const readingRaw = cleanDraftText(e?.reading).replace(/\s+/g, '')
    let reading: string | undefined
    if (readingRaw) {
      // ja 가 전부 가나면 읽기는 같은 글이다 — 싣지 않는다. 한자가 있는데 읽기가 가나가 아니거나 너무 길면 읽기만 버린다.
      if (KANJI.test(ja) && READING_RE.test(readingRaw) && cpLen(readingRaw) <= L.expressionReadingMax) reading = readingRaw
      else if (KANJI.test(ja)) repairs.readingsDropped += 1
    }
    expressions.push({ ja, ...(reading ? { reading } : {}), ko })
  }
  if (expressions.length > L.expressionsMax) {
    repairs.droppedExpressions.overLimit += expressions.length - L.expressionsMax
    expressions.length = L.expressionsMax
  }
  if (expressions.length < L.expressionsMin) problems.push('EXPRESSIONS_TOO_FEW')

  if (problems.length) return noProblems('INVALID', repairs, problems)

  // 필수 표현 수: 1~min(표현 수, 3).
  const requiredCap = Math.max(1, Math.min(expressions.length, SCENARIO_DRAFT_REQUIRED_MAX))
  const reqRaw = Number.isFinite(d.requiredExpressions) ? Math.floor(d.requiredExpressions) : 2
  const required = Math.max(1, Math.min(requiredCap, reqRaw))
  if (required !== reqRaw) repairs.requiredClamped = true

  // 난이도: 학습자 수준 띠 안으로.
  const band = SCENARIO_DRAFT_DIFFICULTY_BAND[ctx.level] ?? [L.difficultyMin, L.difficultyMax]
  const diffRaw = Number.isFinite(d.difficulty) ? Math.floor(d.difficulty) : band[0]
  const difficulty = Math.max(band[0], Math.min(band[1], Math.max(L.difficultyMin, Math.min(L.difficultyMax, diffRaw))))
  if (difficulty !== diffRaw) repairs.difficultyClamped = true

  // 첫마디: 선생님이 쓸 수 없으면(일본어가 아님·너무 김·한국어 뜻 없음) 첫마디 없이 — 학습자가 먼저 말을 거는 상황이 된다(초안은 그대로 저장 가능).
  let opening: { ja: string; ko: string } | null = null
  const oj = cleanDraftText(d.opening?.ja)
  const ok = text(d.opening?.ko, L.openingKoMax)
  if (oj && JA_CHAR.test(oj) && !HANGUL.test(oj) && cpLen(oj) <= L.openingJaMax && ok) opening = { ja: oj, ko: ok }
  else repairs.openingDropped = true

  const descRaw = cleanDraftText(ctx.description ?? '')
  const description = descRaw ? cutTo(descRaw, L.descriptionMax) : null
  const topicId = typeof ctx.topicId === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(ctx.topicId) ? ctx.topicId : null

  const draft: ScenarioDraftOutput = {
    title,
    titleJa,
    description,
    level: ctx.level,
    difficulty,
    roles: { learner, tutor },
    goal: { communicativeGoalKo: goalKo, successCriteria: criteria.slice(0, L.successCriteriaMax) },
    steps: steps.map((ko) => ({ ko })),
    keyExpressions: expressions.map((e) => ({ ja: e.ja, ...(e.reading ? { reading: e.reading } : {}), ko: e.ko })),
    requiredExpressions: required,
    opening,
    ...(topicId ? { topicIds: [topicId] } : {}),
  }
  return { status: 'OK', draft, problems: [], repairs }
}

const PROBLEM_TEXT: Record<ScenarioDraftProblem, string> = {
  DRAFT_MISSING: 'status 가 OK 이면 draft 객체가 있어야 합니다.',
  TITLE_EMPTY: 'title 이 비어 있습니다.',
  ROLES_EMPTY: 'roles.learner 와 roles.tutor 에 짧은 한국어 역할 이름을 모두 채워야 합니다.',
  GOAL_EMPTY: 'goalKo 가 비어 있습니다.',
  CRITERIA_EMPTY: 'successCriteria 에 한국어 성공 조건이 1개 이상 있어야 합니다.',
  STEPS_TOO_FEW: `steps 는 비지 않은 항목이 ${L.stepsMin}개 이상이어야 합니다.`,
  EXPRESSIONS_TOO_FEW: `keyExpressions 는 쓸 수 있는 표현(일본어, 고정 부분 ${SCENARIO_DRAFT_EXPRESSION_CORE_MIN}자 이상, 한국어 뜻 있음, 서로 겹치지 않음)이 ${L.expressionsMin}개 이상이어야 합니다.`,
}

/** `completeJson` 의 `extraCheck` — 고칠 수 없는 위반만 알려 재시도 1회로 보낸다(그 밖은 `fitScenarioDraft` 가 코드로 고친다). */
export function scenarioDraftViolations(ctx: ScenarioDraftContext, data: ScenarioDraftResponse): string[] {
  const fin = fitScenarioDraft(ctx, data)
  return fin.status === 'INVALID' ? fin.problems.map((p) => PROBLEM_TEXT[p]) : []
}
