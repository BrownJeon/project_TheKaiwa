/**
 * L3 `learning/recordRetrieval` — ASK 본인 기록 조회(api-contract §2-18-A 5·9항, learning-personalization §3-2, module-dependency §10).
 *
 * 진입점은 `retrieveRecords` 하나. `userId` 는 호출자(라우트·orchestrator)가 **세션에서 꺼낸 값**만 넘긴다 — 프롬프트·모델 출력의 id 는 쓰지 않는다.
 * 캐시하지 않는다. 로그를 쓰지 않는다(질문·기록 본문을 어디에도 남기지 않는다 — 건수·함수 이름·소요 시간만 `meta` 로 돌려준다).
 * 결과 `items` 만 프롬프트로 가고, `sourceMap` 은 서버가 모델의 `sourceKeys` 를 실제 행으로 풀 때(`resolveSourceKeys`)만 쓴다.
 */
import { prisma } from '@/modules/infra'
import { assemble } from './assemble'
import { resolveRange } from './range'
import {
  findExpressions,
  FUNCTION_SOURCE_TYPES,
  getDueReviews,
  getProgressSummary,
  getRecentCorrections,
  getSkillState,
  type Candidate,
  type RetrievalCtx,
  type RetrievalDb,
} from './sources'
import { normalizeTerms } from './text'
import {
  ASK_DEFAULT_SCOPE,
  isAskIntent,
  isAskScopeKey,
  RECORD_RETRIEVAL_LIMITS,
  type AcceptedCorrectionReader,
  type RolePlayReader,
  type AskIntent,
  type AskScope,
  type RecordSourceRef,
  type RecordSourceType,
  type RetrievalFunctionName,
  type RetrievalResult,
} from './types'

export * from './types'
export type { RetrievalDb } from './sources'
export { normalizeTerms as normalizeRecordSearchTerms } from './text'

export interface RetrieveRecordsOptions {
  /** 질문에서 뽑은 검색어(정규화·개수·길이 상한은 여기서 다시 건다). 표현 찾기(`findExpressions`)에만 쓴다. */
  terms?: readonly unknown[]
  /**
   * 채택 교정 읽기 — `Correction` 은 L2 소유라 conversation 이 넘긴다(`askCorrectionReader`). 없으면 교정은 0건.
   * 보통은 conversation `retrieveAskRecords` 가 이 값을 채워 부른다.
   */
  corrections?: AcceptedCorrectionReader | null
  /** 역할극 방 읽기 — `Chat` 도 L2 소유라 conversation 이 넘긴다(`askRolePlayReader`). 없으면 상황 연습 0건. */
  rolePlays?: RolePlayReader | null
  /** 시험용(기본 = prisma·지금 시각). */
  db?: RetrievalDb
  now?: () => Date
}

type Runner = (ctx: RetrievalCtx) => Promise<Candidate[]>

const RUNNERS: Partial<Record<RetrievalFunctionName, Runner>> = {
  getProgressSummary,
  getDueReviews,
  getRecentCorrections,
  findExpressions,
  getSkillState,
}

/**
 * 의도 → 부를 함수(순서 = 결과 앞뒤 우선순위). GENERAL 은 함수를 하나도 부르지 않는다(근거 항상 빈 배열).
 * EXPRESSION·MIXED 는 검색어가 있으면 찾기를 맨 앞에 둔다(같은 레슨이 겹치면 앞 함수의 항목이 남는다). MIXED = PROGRESS ∪ EXPRESSION.
 */
export function retrievalPlan(intent: AskIntent, hasTerms: boolean): RetrievalFunctionName[] {
  if (intent === 'PROGRESS') return ['getProgressSummary', 'getDueReviews', 'getSkillState', 'getRecentCorrections']
  if (intent === 'EXPRESSION') return hasTerms ? ['findExpressions', 'getRecentCorrections'] : ['getRecentCorrections', 'findExpressions']
  if (intent === 'MIXED') {
    return hasTerms
      ? ['findExpressions', 'getProgressSummary', 'getRecentCorrections', 'getDueReviews', 'getSkillState']
      : ['getProgressSummary', 'getRecentCorrections', 'findExpressions', 'getDueReviews', 'getSkillState']
  }
  return []
}

function empty(intent: AskIntent, scopeKey: AskScope['key'], started: number): RetrievalResult {
  return { intent, items: [], sourceMap: Object.create(null) as Record<string, RecordSourceRef>, meta: { count: 0, functionsCalled: [], truncated: false, scopeKey, elapsedMs: Math.round(performance.now() - started) } }
}

export async function retrieveRecords(userId: string, intent: AskIntent, scope: AskScope | null, opts: RetrieveRecordsOptions = {}): Promise<RetrievalResult> {
  const started = performance.now()
  if (!isAskIntent(intent)) throw new TypeError('retrieveRecords: 알 수 없는 의도')
  const scopeKey = scope && isAskScopeKey(scope.key) ? scope.key : ASK_DEFAULT_SCOPE.key
  if (typeof userId !== 'string' || !userId) return empty(intent, scopeKey, started)
  const terms = normalizeTerms(opts.terms ?? [])
  const plan = retrievalPlan(intent, terms.length > 0)
  if (!plan.length) return empty(intent, scopeKey, started)

  const ctx: RetrievalCtx = {
    db: opts.db ?? prisma,
    userId,
    range: resolveRange(scopeKey, (opts.now ?? (() => new Date()))()),
    terms,
    corrections: opts.corrections ?? null,
    rolePlays: opts.rolePlays ?? null,
  }
  const lists = await Promise.all(plan.map((fn) => (RUNNERS[fn] as Runner)(ctx)))
  const { items, sourceMap, truncated } = assemble(lists)
  return { intent, items, sourceMap, meta: { count: items.length, functionsCalled: plan, truncated, scopeKey, elapsedMs: Math.round(performance.now() - started) } }
}

/** 이 결과에서 근거로 인정할 수 있는 종류 — 실제로 부른 함수가 만들 수 있는 종류의 합(GENERAL = 없음). */
export function allowedSourceTypes(result: Pick<RetrievalResult, 'intent' | 'meta'>): Set<RecordSourceType> {
  if (result.intent === 'GENERAL') return new Set()
  return new Set(result.meta.functionsCalled.flatMap((fn) => FUNCTION_SOURCE_TYPES[fn] ?? []))
}

const KEY = /^S([1-9]\d?)$/

/**
 * 모델이 낸 `sourceKeys` → 실제 근거(계약 3·9항 ②). 서버가 반드시 이걸로만 `sources[]` 를 만든다:
 * 문자열 `S#` 이고 이번 결과의 `sourceMap` 에 있고 이 의도에서 부른 함수가 만든 종류인 키만, 처음 나온 순서·중복 없이, 최대 20개.
 * GENERAL·모양이 어긋난 입력은 빈 배열. 돌려주는 객체는 복사본이다.
 */
export function resolveSourceKeys(result: RetrievalResult, keys: unknown): RecordSourceRef[] {
  if (result.intent === 'GENERAL' || !Array.isArray(keys)) return []
  const allowed = allowedSourceTypes(result)
  const out: RecordSourceRef[] = []
  const seen = new Set<string>()
  for (const k of keys) {
    if (out.length >= RECORD_RETRIEVAL_LIMITS.items) break
    if (typeof k !== 'string' || !KEY.test(k) || seen.has(k)) continue
    if (!Object.prototype.hasOwnProperty.call(result.sourceMap, k)) continue
    const ref = result.sourceMap[k]
    if (!ref || !allowed.has(ref.type)) continue
    seen.add(k)
    out.push({ type: ref.type, id: ref.id, date: ref.date, label: ref.label })
  }
  return out
}
