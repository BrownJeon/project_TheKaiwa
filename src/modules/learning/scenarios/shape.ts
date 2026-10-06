/**
 * 상황 입력 정리·검사(#163 만들기 · #164 고치기 · 시드 로더 `prisma/seed-scenarios.ts`) — **순수 함수**(DB 없음, task-010d A3a).
 *
 * 글 칸 정리(모든 칸 한 줄): 보이지 않는 문자(서식·무시 가능 문자·점자 공백) 제거 → 줄바꿈·탭을 공백으로 → 제어문자 제거(`sanitizeText`) →
 * 연속 공백 하나로. 정리한 뒤 비면 "없음", 꺾쇠(`<`·`>`)·비밀 유사 문자열(`isSecretLikeText`)은 400 — 이 글은 화면과 A1 `[상황]` 헤더에 그대로 실린다.
 * 문제는 한 번에 모두 모은다(`problems[]` — 화면이 칸마다 문구를 붙인다). 길이는 코드포인트(`SCENARIO_LIMITS`, `src/types/scenario.ts`).
 *
 * 저장 모양(domain-model §9-1 + 이 task 의 정함 — 정본 반영 필요):
 *   `goal = {communicativeGoal_ko, successCriteria[]}` · `constraints = {…기존 칸, steps:[{ko}], opening:{ja,ko}|null}` ·
 *   `keyExpressions = [{id, ja, reading?, ko, chunkType?, match?}]` · `completionRule = {…기존 칸, requiredExpressions, tutorJudgement:true}`.
 */
import type { ChunkType, JlptLevel } from '@prisma/client'
import { codePointLength, isSecretLikeText, sanitizeText } from '@/modules/infra'
import { SCENARIO_LIMITS as L, type ScenarioFieldProblem, type ScenarioGoal, type ScenarioOpening, type ScenarioRoles, type ScenarioStep } from '@/types/scenario'
import { SCENARIO_REQUIRED_DEFAULT } from './expressions'

export const SCENARIO_LEVELS: readonly JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']
const CHUNK_TYPES: readonly ChunkType[] = ['NAME', 'ACTION', 'FEELING', 'MODIFIER']
const ID = /^[A-Za-z0-9_-]{1,40}$/
const INVISIBLE = /[\p{Cf}\p{Default_Ignorable_Code_Point}\u{2800}]/gu
const LINE_BREAKS = /[\r\n\t\v\f\u{85}\u{2028}\u{2029}]+/gu

export const isScenarioId = (v: unknown): v is string => typeof v === 'string' && ID.test(v)

/** 한 줄 글 정리(위 규칙). 서식만 정리하고 길이·금지 문자 판단은 하지 않는다. */
export function cleanScenarioText(raw: string): string {
  return sanitizeText(raw.replace(INVISIBLE, '').replace(LINE_BREAKS, ' ')).replace(/ {2,}/g, ' ')
}

export interface ScenarioExpressionInput {
  /** 들어온 id(형식이 맞을 때만) — 고치기에서 기존 표현을 그대로 둘 때 쓴다. 만들 때는 서버가 새로 정한다. */
  id: string | null
  ja: string
  reading: string | null
  ko: string
  chunkType: ChunkType | null
  /** 시드만(코드 표현 확인 대안 — expressions.ts `match`). */
  match: string | null
}

/** 정리한 입력. 고치기(patch)는 보낸 칸만 있다. */
export interface ScenarioFields {
  title?: string
  titleJa?: string | null
  description?: string | null
  level?: JlptLevel
  difficulty?: number
  roles?: ScenarioRoles
  goal?: ScenarioGoal
  steps?: ScenarioStep[]
  keyExpressions?: ScenarioExpressionInput[]
  requiredExpressions?: number
  opening?: ScenarioOpening | null
  topicIds?: string[]
}

export type ScenarioInputMode = 'create' | 'patch' | 'seed'

const KEYS = ['title', 'titleJa', 'description', 'level', 'difficulty', 'roles', 'goal', 'steps', 'keyExpressions', 'requiredExpressions', 'opening', 'topicIds'] as const
const REQUIRED_ON_CREATE = ['title', 'level', 'roles', 'goal', 'steps', 'keyExpressions'] as const

type Problems = ScenarioFieldProblem[]

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

function onlyKeys(p: Problems, o: Record<string, unknown>, keys: readonly string[], prefix: string): void {
  for (const k of Object.keys(o)) if (!keys.includes(k)) p.push({ field: `${prefix}${k}`, reason: 'unknown_key', message: `넣을 수 없는 항목이에요: ${k}` })
}

/** 글 칸 하나. 없음(undefined·null·정리 후 빈 글)은 null — 필수면 문제로 남긴다. */
function textField(p: Problems, field: string, v: unknown, max: number, label: string, required: boolean): string | null {
  if (v === undefined || v === null) {
    if (required) p.push({ field, reason: 'required', message: `${label}을(를) 적어 주세요.` })
    return null
  }
  if (typeof v !== 'string') {
    p.push({ field, reason: 'type', message: `${label}은(는) 글이어야 해요.` })
    return null
  }
  const t = cleanScenarioText(v)
  if (!t) {
    if (required) p.push({ field, reason: 'required', message: `${label}을(를) 적어 주세요.` })
    return null
  }
  if (codePointLength(t) > max) p.push({ field, reason: 'max_length', message: `${label}은(는) ${max}자까지 쓸 수 있어요.` })
  else if (/[<>]/.test(t)) p.push({ field, reason: 'forbidden_char', message: `${label}에 꺾쇠(< >)는 쓸 수 없어요.` })
  else if (isSecretLikeText(t)) p.push({ field, reason: 'secret_like', message: `${label}에 비밀번호·키처럼 보이는 글은 넣을 수 없어요.` })
  return t
}

function intField(p: Problems, field: string, v: unknown, min: number, max: number, label: string): number | null {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) {
    p.push({ field, reason: `range ${min}-${max}`, message: `${label}은(는) ${min}~${max} 사이 정수예요.` })
    return null
  }
  return v
}

function listField(p: Problems, field: string, v: unknown, min: number, max: number, label: string): unknown[] | null {
  if (!Array.isArray(v)) {
    p.push({ field, reason: 'type', message: `${label}은(는) 목록이어야 해요.` })
    return null
  }
  if (v.length < min) p.push({ field, reason: `min ${min}`, message: `${label}은(는) ${min}개 이상이어야 해요.` })
  else if (v.length > max) p.push({ field, reason: `max ${max}`, message: `${label}은(는) ${max}개까지 넣을 수 있어요.` })
  return v.slice(0, max)
}

function readRoles(p: Problems, v: unknown): ScenarioRoles | null {
  if (!isObj(v)) {
    p.push({ field: 'roles', reason: 'required', message: '역할(나·선생님)을 정해 주세요.' })
    return null
  }
  onlyKeys(p, v, ['learner', 'tutor'], 'roles.')
  const learner = textField(p, 'roles.learner', v.learner, L.roleMax, '내 역할', true)
  const tutor = textField(p, 'roles.tutor', v.tutor, L.roleMax, '선생님 역할', true)
  return learner && tutor ? { learner, tutor } : null
}

function readGoal(p: Problems, v: unknown, mode: ScenarioInputMode): ScenarioGoal | null {
  if (!isObj(v)) {
    p.push({ field: 'goal', reason: 'required', message: '목표를 적어 주세요.' })
    return null
  }
  // 시드 JSON 은 저장 키(`communicativeGoal_ko`)로 써도 받는다(#22 키 통일 전 작성분 대비). API 는 화면 키만.
  const alias = mode === 'seed' && v.communicativeGoalKo === undefined && v.communicativeGoal_ko !== undefined
  onlyKeys(p, v, alias ? ['communicativeGoal_ko', 'successCriteria'] : ['communicativeGoalKo', 'successCriteria'], 'goal.')
  const goalKo = textField(p, 'goal.communicativeGoalKo', alias ? v.communicativeGoal_ko : v.communicativeGoalKo, L.goalMax, '목표', true)
  const raw = listField(p, 'goal.successCriteria', v.successCriteria, L.successCriteriaMin, L.successCriteriaMax, '성공 조건')
  const criteria = (raw ?? []).map((c, i) => textField(p, `goal.successCriteria[${i}]`, c, L.successCriterionMax, '성공 조건', true)).filter((c): c is string => !!c)
  return goalKo && raw ? { communicativeGoalKo: goalKo, successCriteria: criteria } : null
}

function readSteps(p: Problems, v: unknown): ScenarioStep[] | null {
  const raw = listField(p, 'steps', v, L.stepsMin, L.stepsMax, '대화 순서')
  if (!raw) return null
  return raw
    .map((s, i) => {
      if (!isObj(s)) {
        p.push({ field: `steps[${i}]`, reason: 'type', message: '대화 순서 항목 모양이 올바르지 않아요.' })
        return null
      }
      onlyKeys(p, s, ['ko'], `steps[${i}].`)
      const ko = textField(p, `steps[${i}].ko`, s.ko, L.stepMax, '대화 순서', true)
      return ko ? { ko } : null
    })
    .filter((s): s is ScenarioStep => !!s)
}

function readExpressions(p: Problems, v: unknown, mode: ScenarioInputMode): ScenarioExpressionInput[] | null {
  const raw = listField(p, 'keyExpressions', v, L.expressionsMin, L.expressionsMax, '핵심 표현')
  if (!raw) return null
  const seenJa = new Set<string>()
  const seenId = new Set<string>()
  const out: ScenarioExpressionInput[] = []
  raw.forEach((e, i) => {
    const f = `keyExpressions[${i}]`
    if (!isObj(e)) {
      p.push({ field: f, reason: 'type', message: '핵심 표현 항목 모양이 올바르지 않아요.' })
      return
    }
    onlyKeys(p, e, mode === 'seed' ? ['id', 'ja', 'reading', 'ko', 'chunkType', 'match'] : ['id', 'ja', 'reading', 'ko', 'chunkType'], `${f}.`)
    let id: string | null = null
    if (e.id !== undefined && e.id !== null) {
      if (isScenarioId(e.id)) id = e.id
      else if (mode === 'seed') p.push({ field: `${f}.id`, reason: 'format', message: '표현 id 는 영문·숫자·_·- 1~40자예요.' })
    } else if (mode === 'seed') p.push({ field: `${f}.id`, reason: 'required', message: '시드 표현에는 고정 id 가 있어야 해요.' })
    if (id && seenId.has(id)) {
      if (mode === 'seed') p.push({ field: `${f}.id`, reason: 'duplicate', message: `표현 id 가 겹쳐요: ${id}` })
      id = null
    }
    if (id) seenId.add(id)
    const ja = textField(p, `${f}.ja`, e.ja, L.expressionJaMax, '일본어 표현', true)
    const reading = textField(p, `${f}.reading`, e.reading, L.expressionReadingMax, '읽기', false)
    const ko = textField(p, `${f}.ko`, e.ko, L.expressionKoMax, '뜻', true)
    let chunkType: ChunkType | null = null
    if (e.chunkType !== undefined && e.chunkType !== null) {
      if ((CHUNK_TYPES as readonly unknown[]).includes(e.chunkType)) chunkType = e.chunkType as ChunkType
      else p.push({ field: `${f}.chunkType`, reason: CHUNK_TYPES.join('|'), message: '표현 종류가 올바르지 않아요.' })
    }
    const match = mode === 'seed' ? textField(p, `${f}.match`, e.match, L.expressionJaMax, '표현 확인 대안', false) : null
    if (ja) {
      if (seenJa.has(ja)) p.push({ field: `${f}.ja`, reason: 'duplicate', message: '같은 표현이 두 번 들어 있어요.' })
      seenJa.add(ja)
    }
    if (ja && ko) out.push({ id, ja, reading, ko, chunkType, match })
  })
  return out
}

function readOpening(p: Problems, v: unknown): ScenarioOpening | null {
  if (v === null) return null
  if (!isObj(v)) {
    p.push({ field: 'opening', reason: 'type', message: '선생님 첫마디 모양이 올바르지 않아요.' })
    return null
  }
  onlyKeys(p, v, ['ja', 'ko'], 'opening.')
  const ja = textField(p, 'opening.ja', v.ja, L.openingJaMax, '선생님 첫마디', true)
  const ko = textField(p, 'opening.ko', v.ko, L.openingKoMax, '첫마디 뜻', true)
  return ja && ko ? { ja, ko } : null
}

function readTopicIds(p: Problems, v: unknown): string[] | null {
  const raw = listField(p, 'topicIds', v, 0, L.topicsMax, '장소')
  if (!raw) return null
  const out: string[] = []
  raw.forEach((t, i) => {
    if (!isScenarioId(t)) p.push({ field: `topicIds[${i}]`, reason: 'format', message: '장소 값이 올바르지 않아요.' })
    else if (!out.includes(t)) out.push(t)
  })
  return out
}

/**
 * 본문 → 정리한 칸 + 문제 목록. `create`·`seed` 는 필수 칸이 모두 있어야 하고, `patch` 는 보낸 칸만(최소 1칸).
 * 필수 표현 수는 표현 목록을 함께 보낸 경우에만 여기서 범위를 본다(고치기에서 표현 없이 보내면 저장된 표현 수로 `mergeScenarioFields` 가 본다).
 */
export function normalizeScenarioInput(body: Record<string, unknown>, mode: ScenarioInputMode): { value: ScenarioFields; problems: ScenarioFieldProblem[] } {
  const p: Problems = []
  onlyKeys(p, body, KEYS, '')
  const has = (k: string) => body[k] !== undefined
  if (mode !== 'patch') {
    for (const k of REQUIRED_ON_CREATE) if (!has(k)) p.push({ field: k, reason: 'required', message: '꼭 넣어야 하는 항목이 빠졌어요.' })
  } else if (!KEYS.some((k) => has(k))) p.push({ field: 'body', reason: 'empty', message: '고칠 항목이 없어요.' })
  const v: ScenarioFields = {}
  if (has('title')) v.title = textField(p, 'title', body.title, L.titleMax, '제목', true) ?? undefined
  if (has('titleJa')) v.titleJa = textField(p, 'titleJa', body.titleJa, L.titleJaMax, '일본어 제목', false)
  if (has('description')) v.description = textField(p, 'description', body.description, L.descriptionMax, '상황 설명', false)
  if (has('level')) {
    if ((SCENARIO_LEVELS as readonly unknown[]).includes(body.level)) v.level = body.level as JlptLevel
    else p.push({ field: 'level', reason: SCENARIO_LEVELS.join('|'), message: '수준은 N5~N1 중에서 골라 주세요.' })
  }
  if (has('difficulty')) v.difficulty = intField(p, 'difficulty', body.difficulty, L.difficultyMin, L.difficultyMax, '난이도') ?? undefined
  if (has('roles')) v.roles = readRoles(p, body.roles) ?? undefined
  if (has('goal')) v.goal = readGoal(p, body.goal, mode) ?? undefined
  if (has('steps')) v.steps = readSteps(p, body.steps) ?? undefined
  if (has('keyExpressions')) v.keyExpressions = readExpressions(p, body.keyExpressions, mode) ?? undefined
  if (has('opening')) v.opening = readOpening(p, body.opening)
  if (has('topicIds')) v.topicIds = readTopicIds(p, body.topicIds) ?? undefined
  if (has('requiredExpressions')) {
    const max = v.keyExpressions?.length ?? L.expressionsMax
    v.requiredExpressions = intField(p, 'requiredExpressions', body.requiredExpressions, 1, Math.max(1, max), '필수 표현 수') ?? undefined
  }
  return { value: v, problems: p }
}

/** 필수 표현 수 기본값 = min(2, 표현 수). */
export function defaultRequiredExpressions(count: number): number {
  return Math.max(0, Math.min(SCENARIO_REQUIRED_DEFAULT, count))
}

/**
 * 표현 id 정하기 — `keep` 에 있는 id(고치기의 기존 표현)는 그대로, 나머지는 `e<n>`(기존 `e<n>` 의 최대 다음 번호부터, 겹치지 않게).
 * 만들 때는 `keep` 이 비어 있어 들어온 id 를 쓰지 않는다(클라이언트가 id 를 정하지 않는다). 시드는 `keepAll` 로 들어온 id 를 그대로 쓴다.
 */
export function assignExpressionIds(items: readonly ScenarioExpressionInput[], keep: ReadonlySet<string>, keepAll = false): string[] {
  const used = new Set<string>()
  const fixed = items.map((e) => (e.id && (keepAll || keep.has(e.id)) && !used.has(e.id) ? (used.add(e.id), e.id) : null))
  let n = 0
  for (const id of [...keep, ...used]) {
    const m = /^e(\d{1,6})$/.exec(id)
    if (m) n = Math.max(n, Number(m[1]))
  }
  return fixed.map((id) => {
    if (id) return id
    let next: string
    do next = `e${++n}`
    while (used.has(next) || keep.has(next))
    used.add(next)
    return next
  })
}

/** 저장할 표현 JSON(읽기 규약 `readScenarioExpressions` 와 짝). */
export function expressionsJson(items: readonly ScenarioExpressionInput[], ids: readonly string[]): Record<string, unknown>[] {
  return items.map((e, i) => ({
    id: ids[i],
    ja: e.ja,
    ...(e.reading ? { reading: e.reading } : {}),
    ko: e.ko,
    ...(e.chunkType ? { chunkType: e.chunkType } : {}),
    ...(e.match ? { match: e.match } : {}),
  }))
}

export const goalJson = (g: ScenarioGoal) => ({ communicativeGoal_ko: g.communicativeGoalKo, successCriteria: g.successCriteria })

const rec = (v: unknown): Record<string, unknown> => (isObj(v) ? v : {})

/** `constraints` 에 단계·첫마디를 얹는다(조건·분기 등 다른 칸은 그대로). */
export function constraintsJson(prev: unknown, steps: readonly ScenarioStep[] | undefined, opening: ScenarioOpening | null | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = { ...rec(prev) }
  if (steps !== undefined) out.steps = steps.map((s) => ({ ko: s.ko }))
  if (opening !== undefined) out.opening = opening ? { ja: opening.ja, ko: opening.ko } : null
  return out
}

export function completionRuleJson(prev: unknown, required: number): Record<string, unknown> {
  return { ...rec(prev), requiredExpressions: required, tutorJudgement: true }
}
