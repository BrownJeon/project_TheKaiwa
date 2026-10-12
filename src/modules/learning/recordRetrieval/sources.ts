/**
 * 화이트리스트 조회 함수 6개 — ASK 가 본인 기록을 읽는 **유일한 길**(learning-personalization §3-2). LLM 은 SQL 을 만들거나 고르지 않는다:
 * 인자는 세션 userId·범위(enum → KST 구간)·정규화된 검색어뿐이다.
 *
 * 외부 전송 범위 D2=(b) = 사용자가 승인한 「보내는 범위」 동의 문구(api-contract §2-18-A 5항, 2026-10-12 Leader 정정)를 **읽는 칸**으로 지킨다:
 *   - 내보내는 것: ① 공부 기록 요약(횟수·점수·복습 예정 목록 — 연속 출석 일수는 동의 문구에 없어 보내지 않는다, REV-064-U L-2) ② 채택 교정의 원래 문장·고친 문장(+ 오류 유형 라벨) ③ 수업(레슨)에서 배운 표현.
 *     상황 연습은 「역할극 「제목」 마침」 수준의 요약만(근거 카드가 그 역할극 방으로 가게).
 *   - 모든 쿼리는 `where.userId = 세션 userId`(상황 제목은 본인 것 또는 공개 시드만) + 명시 `select`.
 *   - 읽지 않는 것: 단어장(`WordEntry` — 표 자체를 `RetrievalDb` 에서 뺐다)·대화·발화(`Chat`·`ChatMessage`·`Utterance`)·교정 설명·
 *     역할극 핵심 표현(`Scenario.keyExpressions`)·레슨 `sourceText`(붙여넣은 원문)·`dialogue`·평가 `comment`·`StudyLog.summary`·`toolLog`·`RequestTrace`.
 *   - 교정·역할극 방은 L2 소유라 주입받은 읽기 함수로만, 교정은 `status=ACCEPTED` 만(PROPOSED·REJECTED 는 받아도 버린다).
 *   - 복습 예정 목록의 글은 레슨 표현·교정(고친 문장) 출처 항목만 싣고, 단어장 단어·상황 출처 항목은 개수로만 센다.
 * 집계(공부한 날·턴 수 등)는 `StatsSnapshot` 만 읽는다(삭제 뒤에도 불변 — domain-model 규칙 2).
 */
import type { Prisma } from '@prisma/client'
import { dates, type Tx } from '@/modules/infra'
import { readStoredContent } from '../lessons/content'
import { dbDateWhere, instantWhere, kstDateOf, periodKeyWhere, type RetrievalRange } from './range'
import { clip, errorTypeKo, joinParts, labelOf, matchesAnyTerm } from './text'
import type { AcceptedCorrectionReader, AcceptedCorrectionRow, RecordSourceType, RetrievalFunctionName, RolePlayReader, RolePlayRow } from './types'

/** 이 계층이 읽을 수 있는 표 — 타입에서부터 단어장·대화·교정·제안·추적 표를 뺀다(구조로 막기). */
export type RetrievalDb = Pick<Tx, 'statsSnapshot' | 'attendance' | 'repetitionItem' | 'lesson' | 'scenario' | 'evaluation' | 'learnerErrorStat'>

/** 함수가 내는 후보(키 붙이기·상한 적용 전). 외부로 가는 모양은 assemble 이 허용 칸만 골라 새로 만든다. */
export interface Candidate {
  fn: RetrievalFunctionName
  type: RecordSourceType
  id: string | null
  dateKst: string
  text: string
  label: string
  /** 항목 글이 300자 규칙으로 잘렸는지. */
  cut: boolean
}

export interface RetrievalCtx {
  db: RetrievalDb
  userId: string
  range: RetrievalRange
  terms: readonly string[]
  corrections: AcceptedCorrectionReader | null
  rolePlays: RolePlayReader | null
}

/** 함수 → 그 함수가 만들 수 있는 근거 종류(계약 9항 ② — 서버가 `sourceKeys` 를 풀 때 이 밖의 종류는 인정하지 않는다). */
export const FUNCTION_SOURCE_TYPES: Record<RetrievalFunctionName, readonly RecordSourceType[]> = {
  getProgressSummary: ['STUDY_LOG', 'LESSON', 'EVALUATION'],
  getDueReviews: ['REVIEW'],
  getRecentCorrections: ['CORRECTION'],
  findExpressions: ['CORRECTION', 'LESSON', 'SCENARIO'],
  getLessonsByTopic: ['LESSON'],
  getSkillState: ['CORRECTION'],
}

/** 함수별 후보 상한(전체 상한 20·2,000자는 assemble 이 건다). */
export const SOURCE_CAPS = {
  dailyRows: 1000,
  progressLessons: 4,
  progressEvals: 3,
  dueBreakdownScan: 1000,
  dueItems: 8,
  corrections: 10,
  correctionMatches: 5,
  lessonsScan: 20,
  lessonsShown: 4,
  lessonExpressions: 8,
  rolePlayScan: 10,
  rolePlaysShown: 3,
  topicLessons: 5,
  errorTypes: 5,
} as const

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0)
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

function cand(fn: RetrievalFunctionName, type: RecordSourceType, id: string | null, dateKst: string, parts: Parameters<typeof joinParts>[0], label: string, fallbackLabel: string): Candidate | null {
  const { text, cut } = joinParts(parts)
  if (!text) return null
  return { fn, type, id, dateKst, text, label: labelOf(label) || fallbackLabel, cut }
}

const nonNull = <T>(xs: readonly (T | null)[]): T[] => xs.filter((x): x is T => x !== null)

/** 여러 목록을 한 칸씩 번갈아 합친다(각 목록 안 순서 유지) — 한 함수가 상한을 다 차지하지 않게. */
export function interleave<T>(lists: readonly (readonly T[])[]): T[] {
  const out: T[] = []
  const max = Math.max(0, ...lists.map((l) => l.length))
  for (let i = 0; i < max; i++) for (const l of lists) if (i < l.length) out.push(l[i])
  return out
}

// ── 레슨 표현(③) ────────────────────────────────────────────────────────────

interface Expr {
  ja: string
  ko: string
}

/** 레슨 본문에서 **배운 표현**만 — 조각(`chunks` 표기·뜻)과 문법 패턴(`grammar.pattern`·짧은 뜻). 대화·예문·문제·응용·말하기는 읽지 않는다. */
function lessonExpressions(content: unknown): Expr[] {
  const c = readStoredContent(content)
  if (!c) return []
  const out: Expr[] = []
  for (const ch of c.chunks) {
    const o = obj(ch)
    if (str(o.textJa)) out.push({ ja: str(o.textJa), ko: str(o.meaningKo) })
  }
  for (const g of c.grammar) {
    const o = obj(g)
    if (str(o.pattern)) out.push({ ja: str(o.pattern), ko: str(o.explanationKo) })
  }
  return out
}

/** `머리 표현1 뜻1 / 표현2 뜻2 …` — 검색어와 맞는 표현을 앞에 둔다(300자에서 잘려도 맞는 것이 남게). 뜻은 40자까지. */
function exprList(head: string, exprs: readonly Expr[], terms: readonly string[], max: number = SOURCE_CAPS.lessonExpressions): string {
  const hit = terms.length ? exprs.filter((e) => matchesAnyTerm([e.ja, e.ko], terms)) : []
  const rest = exprs.filter((e) => !hit.includes(e))
  const list = [...hit, ...rest].slice(0, max).map((e) => `${clip(e.ja, 40)}${e.ko ? ` ${clip(e.ko, 40)}` : ''}`)
  return `${head} ${list.join(' / ')}`
}

// ── 1. 진도 요약(①) ─────────────────────────────────────────────────────────

const RUBRIC_KO: [string, string][] = [
  ['accuracy', '정확성'],
  ['vocabulary', '어휘'],
  ['grammar', '문법'],
  ['naturalness', '자연스러움'],
  ['assembly', '조립'],
]

/** 기간 학습 요약(DAILY 스냅샷 합 + 출석 일수) 1건 + 기간 안 끝낸 레슨(점수·배운 표현)·평가(점수). 활동이 하나도 없으면 요약을 내지 않는다(→ 「관련 기록 없음」 신호). */
export async function getProgressSummary(ctx: RetrievalCtx): Promise<Candidate[]> {
  const { db, userId, range } = ctx
  const [daily, attendDays, lessons, evals] = await Promise.all([
    db.statsSnapshot.findMany({
      where: { userId, kind: 'DAILY', periodKey: periodKeyWhere(range) },
      orderBy: { periodKey: 'desc' },
      take: SOURCE_CAPS.dailyRows,
      select: { periodKey: true, data: true },
    }),
    db.attendance.count({ where: { userId, date: dbDateWhere(range) } }),
    db.lesson.findMany({
      where: { userId, status: 'DONE', date: dbDateWhere(range) },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: SOURCE_CAPS.progressLessons,
      select: { id: true, title: true, date: true, kind: true, score: true, content: true },
    }),
    db.evaluation.findMany({
      where: { userId, status: 'DONE', completedAt: instantWhere(range) },
      orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
      take: SOURCE_CAPS.progressEvals,
      select: { id: true, kind: true, totalScore: true, rubric: true, completedAt: true },
    }),
  ])

  const t = { activeDays: 0, lessons: 0, reviews: 0, sessions: 0, correct: 0, wrong: 0, talk: 0, chat: 0, accepted: 0, evals: 0 }
  for (const row of daily) {
    const d = obj(row.data)
    const w = obj(d.words)
    const c = obj(d.corrections)
    const r = obj(d.repetition)
    const day = {
      lessons: num(d.lessons), reviews: num(d.reviews), sessions: num(w.sessions), correct: num(w.correct), wrong: num(w.wrong),
      talk: num(d.talkTurns), chat: num(d.chatTurns), accepted: num(c.accepted), evals: num(d.evals),
    }
    if (day.lessons + day.reviews + day.sessions + day.talk + day.chat + day.accepted + day.evals + num(r.studied) > 0) t.activeDays++
    t.lessons += day.lessons
    t.reviews += day.reviews
    t.sessions += day.sessions
    t.correct += day.correct
    t.wrong += day.wrong
    t.talk += day.talk
    t.chat += day.chat
    t.accepted += day.accepted
    t.evals += day.evals
  }

  const out: (Candidate | null)[] = []
  if (t.activeDays > 0 || attendDays > 0) {
    const span = range.fromKst ? `${range.labelKo}(${range.fromKst}~${range.toKst})` : `${range.labelKo}(~${range.toKst})`
    out.push(
      cand(
        'getProgressSummary',
        'STUDY_LOG',
        null,
        range.today,
        [
          `${span} 학습 요약(오늘 ${range.today} 기준)`,
          `공부한 날 ${t.activeDays}일`,
          `출석 ${attendDays}일`,
          `레슨 완료 ${t.lessons}회`,
          `복습 ${t.reviews}회`,
          `단어 세트 ${t.sessions}회(맞힘 ${t.correct}/틀림 ${t.wrong})`,
          `회화 ${t.talk}턴`,
          `채팅 ${t.chat}턴`,
          `교정 채택 ${t.accepted}건`,
          `평가 ${t.evals}회`,
          daily.length >= SOURCE_CAPS.dailyRows ? `최근 ${SOURCE_CAPS.dailyRows}일 기준` : null,
        ],
        `${range.labelKo} 학습 요약`,
        '학습 요약',
      ),
    )
  }
  // 같은 레슨이 표현 찾기에도 나오면 앞의 것(여기)만 남는다(assemble 중복 제거) — 그래서 점수와 함께 배운 표현 몇 개를 같이 싣는다.
  for (const l of lessons) {
    const exprs = lessonExpressions(l.content)
    out.push(
      cand(
        'getProgressSummary',
        'LESSON',
        l.id,
        dates.fromDbDate(l.date),
        [`레슨 「${clip(l.title, 80)}」 완료`, l.kind === 'REVIEW' ? '복습 레슨' : null, typeof l.score === 'number' ? `점수 ${l.score}점` : null, exprs.length ? exprList('배운 표현:', exprs, [], 4) : null],
        l.title,
        '레슨',
      ),
    )
  }
  for (const e of evals) {
    const rubric = obj(e.rubric)
    const dims = RUBRIC_KO.filter(([k]) => typeof rubric[k] === 'number').map(([k, ko]) => `${ko} ${rubric[k]}`)
    const kindKo = e.kind === 'WORDS' ? '단어' : '회화'
    const score = typeof e.totalScore === 'number' ? `${e.totalScore}점` : null
    out.push(
      cand(
        'getProgressSummary',
        'EVALUATION',
        e.id,
        e.completedAt ? kstDateOf(e.completedAt) : range.today,
        [`평가(${kindKo}) 완료`, score, dims.length ? `세부(0~5) ${dims.join('/')}` : null],
        `평가(${kindKo})${score ? ` ${score}` : ''}`,
        '평가',
      ),
    )
  }
  return nonNull(out)
}

// ── 2. 오늘 복습할 항목(① 복습 예정 목록) ────────────────────────────────────

/** 글을 실어도 되는 반복 항목 출처 — 레슨·주제 표현(③)과 채택 교정의 고친 문장(②). 단어장 단어·상황 출처는 개수로만. */
const TEXT_REF_TYPES = ['TopicChunk', 'Expr', 'Grammar', 'Correction'] as const
const isTextRef = (refType: string) => (TEXT_REF_TYPES as readonly string[]).includes(refType)

function dueKindKo(refType: string): '표현' | '교정' | '단어' | '상황' | '기타' {
  if (refType === 'Correction') return '교정'
  if (refType === 'WordEntry') return '단어'
  if (refType === 'Scenario') return '상황'
  return isTextRef(refType) ? '표현' : '기타'
}

/**
 * 오늘(KST)까지 복습 예정인 반복 항목 — 대기 수 집계 1건(종류별 개수) + 글을 실어도 되는 항목을 집중(FOCUS) 먼저 최대 8건.
 * 교정 출처 항목은 고친 문장만(`meaningKo` 는 교정 설명에서 만든 값이라 싣지 않는다). 범위와 무관(지금 상태).
 */
export async function getDueReviews(ctx: RetrievalCtx): Promise<Candidate[]> {
  const { db, userId, range } = ctx
  const due = { userId, nextDueAt: { lte: dates.toDbDate(range.today) } }
  const textDue = { ...due, refType: { in: [...TEXT_REF_TYPES] } }
  const select = { id: true, itemType: true, refType: true, textJa: true, meaningKo: true, studiedCount: true, wrongCount: true, priority: true, nextDueAt: true } as const
  const order: Prisma.RepetitionItemOrderByWithRelationInput[] = [{ nextDueAt: 'asc' }, { id: 'asc' }]
  // 우선순위 정렬을 enum 순서에 맡기지 않는다(DB·드라이버마다 다르다) — 집중 항목을 따로 읽어 앞에 둔다.
  const [total, kinds, focus, normal] = await Promise.all([
    db.repetitionItem.count({ where: due }),
    db.repetitionItem.findMany({ where: due, take: SOURCE_CAPS.dueBreakdownScan, select: { refType: true, priority: true } }),
    db.repetitionItem.findMany({ where: { ...textDue, priority: 'FOCUS' }, orderBy: order, take: SOURCE_CAPS.dueItems, select }),
    db.repetitionItem.findMany({ where: { ...textDue, priority: 'NORMAL' }, orderBy: order, take: SOURCE_CAPS.dueItems, select }),
  ])
  if (total === 0) return []
  const byKind = new Map<string, number>()
  let focusCount = 0
  for (const k of kinds) {
    const ko = dueKindKo(k.refType)
    byKind.set(ko, (byKind.get(ko) ?? 0) + 1)
    if (k.priority === 'FOCUS') focusCount++
  }
  const breakdown = ['표현', '교정', '단어', '상황', '기타'].filter((k) => byKind.get(k)).map((k) => `${k} ${byKind.get(k)}`).join(', ')
  const out: (Candidate | null)[] = [
    cand(
      'getDueReviews',
      'REVIEW',
      null,
      range.today,
      [`오늘(${range.today}) 기준 복습할 항목 ${total}개(집중 ${focusCount}개)`, breakdown ? `종류: ${breakdown}` : null],
      `오늘 복습 대기 ${total}개`,
      '오늘 복습',
    ),
  ]
  for (const r of [...focus, ...normal].slice(0, SOURCE_CAPS.dueItems)) {
    if (!isTextRef(r.refType)) continue
    const correction = r.refType === 'Correction'
    const meaning = !correction && r.meaningKo ? ` — ${clip(r.meaningKo, 40)}` : ''
    out.push(
      cand(
        'getDueReviews',
        'REVIEW',
        r.id,
        r.nextDueAt ? dates.fromDbDate(r.nextDueAt) : range.today,
        [`복습 예정(${correction ? '교정' : '표현'}) ${clip(r.textJa, 80)}${meaning}`, `학습 ${r.studiedCount}회`, r.wrongCount > 0 ? `틀림 ${r.wrongCount}회` : null, r.priority === 'FOCUS' ? '집중 항목' : null],
        r.textJa,
        '복습 항목',
      ),
    )
  }
  return nonNull(out)
}

// ── 3. 채택 교정(②) ─────────────────────────────────────────────────────────

/** 받은 교정 행 → 후보(원래 문장·고친 문장·유형 라벨만). 본인·ACCEPTED 가 아닌 행은 여기서 버린다(읽기 함수가 잘못 구현돼도 나가지 않게). */
function correctionCandidates(fn: RetrievalFunctionName, userId: string, rows: readonly AcceptedCorrectionRow[], cap: number): Candidate[] {
  const out: Candidate[] = []
  for (const r of rows) {
    if (out.length >= cap) break
    if (!r || r.userId !== userId || r.status !== 'ACCEPTED') continue
    if (!(r.createdAt instanceof Date) || Number.isNaN(r.createdAt.getTime())) continue
    const c = cand(fn, 'CORRECTION', r.id, kstDateOf(r.createdAt), [`채택한 교정(${errorTypeKo(str(r.errorType))})`, `「${clip(r.original, 140)}」 → 「${clip(r.corrected, 140)}」`], r.corrected, '교정')
    if (c) out.push(c)
  }
  return out
}

/** 기간 안 채택 교정(최근순 ≤10). 읽기 함수가 없으면 0건. */
export async function getRecentCorrections(ctx: RetrievalCtx): Promise<Candidate[]> {
  if (!ctx.corrections) return []
  const rows = await ctx.corrections(ctx.userId, { from: ctx.range.fromInstant, toExclusive: ctx.range.toExclusive, terms: [], take: SOURCE_CAPS.corrections })
  return correctionCandidates('getRecentCorrections', ctx.userId, rows ?? [], SOURCE_CAPS.corrections)
}

// ── 4. 표현 찾기(② 교정 문장 · ③ 레슨 표현 · 상황 연습 요약) ─────────────────

/**
 * 표현 찾기 — 채택 교정의 원래·고친 문장(검색어가 있을 때) · 레슨에서 배운 표현 · 상황 연습 요약(역할극 「제목」 마침/진행 중, id = 역할극 방).
 * 검색어가 없으면 기간 안 최근 것. 단어장·역할극 핵심 표현·교정 설명은 읽지 않는다.
 */
export async function findExpressions(ctx: RetrievalCtx): Promise<Candidate[]> {
  const { db, userId, range, terms } = ctx
  const [lessons, corrRows, rolePlayRows] = await Promise.all([
    db.lesson.findMany({
      where: { userId, status: { in: ['DONE', 'IN_PROGRESS'] }, date: dbDateWhere(range) },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: terms.length ? SOURCE_CAPS.lessonsScan : SOURCE_CAPS.lessonsShown,
      select: { id: true, title: true, date: true, content: true },
    }),
    terms.length && ctx.corrections
      ? ctx.corrections(userId, { from: range.fromInstant, toExclusive: range.toExclusive, terms, take: SOURCE_CAPS.correctionMatches })
      : Promise.resolve([] as readonly AcceptedCorrectionRow[]),
    ctx.rolePlays ? ctx.rolePlays(userId, { from: range.fromInstant, toExclusive: range.toExclusive, take: SOURCE_CAPS.rolePlayScan }) : Promise.resolve([] as readonly RolePlayRow[]),
  ])

  const lessonC: Candidate[] = []
  for (const l of lessons) {
    if (lessonC.length >= SOURCE_CAPS.lessonsShown) break
    const exprs = lessonExpressions(l.content)
    if (!exprs.length) continue
    if (terms.length && !matchesAnyTerm([l.title, ...exprs.flatMap((e) => [e.ja, e.ko])], terms)) continue
    const c = cand('findExpressions', 'LESSON', l.id, dates.fromDbDate(l.date), [exprList(`레슨 「${clip(l.title, 60)}」 배운 표현:`, exprs, terms)], l.title, '레슨')
    if (c) lessonC.push(c)
  }

  const rolePlayC = await rolePlayCandidates(ctx, rolePlayRows ?? [])
  const corrC = correctionCandidates('findExpressions', userId, corrRows ?? [], SOURCE_CAPS.correctionMatches)
  return interleave([corrC, lessonC, rolePlayC])
}

/** 역할극 방 → 「역할극 「상황 제목」 마침/진행 중」. 상황 제목은 본인 상황 또는 공개 시드에서만 읽고, 못 읽으면 그 방은 뺀다. */
async function rolePlayCandidates(ctx: RetrievalCtx, rows: readonly RolePlayRow[]): Promise<Candidate[]> {
  const mine = rows.filter((r) => r && r.userId === ctx.userId && typeof r.chatId === 'string' && r.chatId && typeof r.scenarioId === 'string' && r.scenarioId && r.createdAt instanceof Date)
  if (!mine.length) return []
  const ids = [...new Set(mine.map((r) => r.scenarioId as string))].slice(0, SOURCE_CAPS.rolePlayScan)
  const scenarios = await ctx.db.scenario.findMany({
    where: { id: { in: ids }, OR: [{ userId: null, isSeed: true }, { userId: ctx.userId }] },
    select: { id: true, title: true, titleJa: true },
  })
  const byId = new Map(scenarios.map((s) => [s.id, s]))
  const out: Candidate[] = []
  const seen = new Set<string>()
  for (const r of mine) {
    if (out.length >= SOURCE_CAPS.rolePlaysShown) break
    const s = byId.get(r.scenarioId as string)
    if (!s || seen.has(r.chatId)) continue
    if (ctx.terms.length && !matchesAnyTerm([s.title, s.titleJa], ctx.terms)) continue
    seen.add(r.chatId)
    const at = r.endedAt ?? r.createdAt
    const c = cand('findExpressions', 'SCENARIO', r.chatId, kstDateOf(at), [`역할극 「${clip(s.title, 60)}」 ${r.endedAt ? '마침' : '진행 중'}`], s.title, '역할극')
    if (c) out.push(c)
  }
  return out
}

// ── 5. 주제별 레슨 ──────────────────────────────────────────────────────────

const ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/

/** 그 주제로 한 레슨(최근 ≤5) — 점수와 배운 표현. 3a 의 `retrieveRecords` 는 주제 인자가 없어 부르지 않는다(3b 도구화 때 연결). */
export async function getLessonsByTopic(ctx: RetrievalCtx, topicId: string): Promise<Candidate[]> {
  if (typeof topicId !== 'string' || !ID_PATTERN.test(topicId)) return []
  const rows = await ctx.db.lesson.findMany({
    where: { userId: ctx.userId, topicId, status: { in: ['DONE', 'IN_PROGRESS'] } },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: SOURCE_CAPS.topicLessons,
    select: { id: true, title: true, date: true, status: true, score: true, content: true },
  })
  return nonNull(
    rows.map((l) =>
      cand(
        'getLessonsByTopic',
        'LESSON',
        l.id,
        dates.fromDbDate(l.date),
        [exprList(`레슨 「${clip(l.title, 60)}」 ${l.status === 'DONE' ? '완료' : '진행 중'}${typeof l.score === 'number' ? `(점수 ${l.score}점)` : ''} 배운 표현:`, lessonExpressions(l.content), [])],
        l.title,
        '레슨',
      ),
    ),
  )
}

// ── 6. 능력 상태 ────────────────────────────────────────────────────────────

/**
 * 약점 상태 — 능력 축 표(`LearnerSkillState`)는 아직 스키마에 없다(Phase 3 task-013). 그때까지는 L3 의 누적 오류 통계
 * `LearnerErrorStat`(채택 교정마다 +1, 발음 분석 유래 PRONUNCIATION 제외)을 **오류 유형 라벨별 횟수**로 합한 집계 1건을 낸다(문장 없음). 없으면 0건.
 */
export async function getSkillState(ctx: RetrievalCtx): Promise<Candidate[]> {
  const rows = await ctx.db.learnerErrorStat.findMany({
    where: { userId: ctx.userId, type: { not: 'PRONUNCIATION' } },
    orderBy: [{ count: 'desc' }, { id: 'asc' }],
    take: 50,
    select: { type: true, count: true },
  })
  const byType = new Map<string, number>()
  for (const r of rows) if (num(r.count) > 0) byType.set(r.type, (byType.get(r.type) ?? 0) + num(r.count))
  const top = [...byType.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, SOURCE_CAPS.errorTypes)
  if (!top.length) return []
  const c = cand(
    'getSkillState',
    'CORRECTION',
    null,
    ctx.range.today,
    [`채택한 교정 유형 누적(전체 기간): ${top.map(([t, n]) => `${errorTypeKo(t)} ${n}회`).join(', ')}`],
    '자주 교정받은 유형',
    '교정 유형',
  )
  return c ? [c] : []
}
