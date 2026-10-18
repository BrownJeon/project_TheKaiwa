/**
 * #58 오늘 — 새 수업(task-010) + 오늘의 복습(task-010b: `mode`·`review`·`guard`·`cycle`·`decisionPending`·`decisionJobId`·`nextReview`,
 * `../reviewSchedule`). 복습 칸 계산이 실패해도 레슨 칸은 내려주고 복습 칸은 비운다(Leader 결정 ⑥ — 오류는 로그만).
 *
 *  - `todayLessons`: 오늘(KST) 날짜 레슨 전부(만든 순 최신부터, 복습 레슨 포함 — 항목마다 `kind`). 만드는 중이면 `jobId`(잡이 죽었으면
 *    여기서 FAILED 로 닫는다 — 복습 레슨은 REVIEW_GEN 잡으로 판정).
 *  - `resume`: 오늘 이전 날짜의 READY·IN_PROGRESS **새 수업(kind=NEW)** 중 가장 최근 것 1개(이어서 하기 — 지난 복습 레슨은 넣지 않는다, ★①).
 *  - `recommendation`(Leader 추가 사양, designer 데모 v1): 가장 최근에 끝낸 주제 레슨이 있으면 그 주제 + 그 수업의 `nextPreview`
 *    (CONTINUE). 그 주제를 이미 `TOPIC_ROTATE_AFTER`번 끝냈으면 학습자 수준에서 가장 적게 한 다른 주제(NEXT_TOPIC). 끝낸 주제 수업이
 *    없으면 학습자 수준의 주제 중 가장 적게 한 것(START). 하던 수업(READY·IN_PROGRESS)이 있으면 화면은 그쪽을 먼저 보인다 — 추천은 참고용.
 *    task-041: 진행 중 챌린지(기간 안·수업 과제 켜짐)가 있고 오늘 그 주제 새 수업을 아직 안 끝냈으면 그 주제가 최우선(CHALLENGE) — 같은 주제 3번
 *    회전 규칙보다 앞선다. 챌린지 칸 계산이 실패하면 기존 추천으로(로그만). LLM·잡을 늘리지 않는다(DB 읽기만).
 */
import type { JlptLevel, LessonKind, LessonStatus } from '@prisma/client'
import { dates, prisma, type Tx } from '@/modules/infra'
import { getProfile } from '@/modules/preferences'
import { getActiveChallengeTopic, type ActiveChallengeTopic, type ChallengeDeps } from '../challenges'
import type { ReviewDecisionDriver } from '../repetition/decision'
import { EMPTY_REVIEW_STATE, getTodayReviewState, type TodayReviewState } from '../reviewSchedule'
import { doneLessonStats, levelWindow, pickFewestLessonTopic } from '../topics'
import { readTargetLevel, type TargetLevel, type TargetLevelProfile, type TargetLevelSource } from '../targetLevel'
import { readStoredContent, summarizeExpressions } from './content'
import { lessonGenKindOf, settleGenerating } from './generate'
import { readProgress, speakingRecords } from './progress'

/** 같은 주제를 이만큼 끝냈으면 다른 주제를 권한다. */
export const TOPIC_ROTATE_AFTER = 3

export interface TodayLessonItem {
  id: string
  kind: LessonKind
  status: LessonStatus
  title: string
  titleKo: string | null
  stageDone: number
  topic: { id: string; title: string } | null
  /** 상황 수업(task-010d A2)이면 그 상황 id, 아니면 null. */
  scenarioId: string | null
  score: number | null
  jobId: string | null
  /** 말하기에서 쓴 표현 수·판정 가능한 목표 수(§12-11 ① — 홈 완료 카드). 본문이 없으면 null. */
  speaking: { used: number; total: number } | null
}

export interface LessonRecommendation {
  topicId: string
  topicTitle: string
  level: JlptLevel
  reason: 'CONTINUE' | 'NEXT_TOPIC' | 'START' | 'CHALLENGE'
  nextPreview: { titleKo: string; teaserKo: string } | null
}

/**
 * #58 응답의 추천(task-076 L8) — `level` 은 지금처럼 **주제 난이도**(「주제 고르기」 등 다른 소비처 보호), 새 칸 `lessonLevel` 은 그 수업을
 * 만들 수준 T(#59 주제 수업이 실제로 쓰는 값), `levelSource` 는 T 의 출처. 기준을 확정하지 못하면(조회 실패) 둘 다 null — 화면은 지금 뱃지.
 */
export interface TodayLessonRecommendation extends LessonRecommendation {
  lessonLevel: JlptLevel | null
  levelSource: TargetLevelSource | null
}

export interface TodayLessonsDto extends TodayReviewState {
  date: string
  todayLessons: TodayLessonItem[]
  resume: { id: string; title: string; titleKo: string | null; stageDone: number; date: string } | null
  recommendation: TodayLessonRecommendation | null
}

const ITEM_SELECT = {
  id: true, kind: true, status: true, title: true, stageDone: true, score: true, content: true, progress: true, date: true, scenarioId: true,
  topic: { select: { id: true, title: true } },
} as const

function previewOf(content: unknown): LessonRecommendation['nextPreview'] {
  const np = readStoredContent(content)?.nextPreview
  return np && typeof np.titleKo === 'string' && typeof np.teaserKo === 'string' ? { titleKo: np.titleKo, teaserKo: np.teaserKo } : null
}

async function activeChallengeSafely(userId: string, over?: Partial<ChallengeDeps>): Promise<ActiveChallengeTopic | null> {
  try {
    return await getActiveChallengeTopic(userId, over)
  } catch (e) {
    console.error('[today] 챌린지 추천 계산 실패:', e instanceof Error ? e.name : 'unknown')
    return null
  }
}

/** 추천 계산의 주입점 — 라우트(`getTodayLessons`)는 기본값(실제 DB·기존 추천 규칙)만 쓰고, 단위 테스트가 메모리 DB 를 넘긴다(REV-120 L-4). */
export interface TodayRecommendDeps {
  db: Pick<Tx, 'lesson'>
  /** 진행 중 챌린지 판정(`getActiveChallengeTopic`)에 넘길 의존성 — 없으면 실제 DB. */
  challenge: Partial<ChallengeDeps> | undefined
  /** 챌린지 추천이 아닐 때의 기존 추천(CONTINUE·NEXT_TOPIC·START). */
  byHistory: (userId: string, level: JlptLevel) => Promise<LessonRecommendation | null>
}

/** #58 `recommendation` — 챌린지 주제 최우선(CHALLENGE), 아니면 기존 추천. */
export async function recommendTodayLesson(userId: string, level: JlptLevel, over: Partial<TodayRecommendDeps> = {}): Promise<LessonRecommendation | null> {
  const deps: TodayRecommendDeps = { db: prisma, challenge: undefined, byHistory: recommendByHistory, ...over }
  const challenge = await activeChallengeSafely(userId, deps.challenge)
  if (challenge && !challenge.lessonDoneToday) {
    const lastOfTopic = await deps.db.lesson.findFirst({
      where: { userId, status: 'DONE', kind: 'NEW', topicId: challenge.topicId },
      orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
      select: { content: true },
    })
    return { topicId: challenge.topicId, topicTitle: challenge.topicTitle, level: challenge.level, reason: 'CHALLENGE', nextPreview: lastOfTopic ? previewOf(lastOfTopic.content) : null }
  }
  return deps.byHistory(userId, level)
}

/** 추천 + 수업 수준 칸(순수). 추천 자체(주제·`level`·`reason`)는 손대지 않는다. */
export function attachLessonLevel(rec: LessonRecommendation | null, target: TargetLevel | null): TodayLessonRecommendation | null {
  if (!rec) return null
  return { ...rec, lessonLevel: target?.level ?? null, levelSource: target?.source ?? null }
}

/**
 * #58 `recommendation` — 기존 추천(`recommendTodayLesson`, 주제 고르기는 지금처럼 내 수준 ±1 창)에 T(`challenges` `readTargetLevel`)를 붙인다.
 * `profile` 은 #58 이 이미 읽은 값을 넘긴다(두 번 읽지 않음). 추천 계산은 `profile.level` 만 쓴다(지금 그대로).
 */
export async function recommendWithLessonLevel(
  userId: string,
  profile: { level: JlptLevel } & TargetLevelProfile,
  over: Partial<TodayRecommendDeps> = {},
): Promise<TodayLessonRecommendation | null> {
  const [rec, target] = await Promise.all([
    recommendTodayLesson(userId, profile.level, over),
    readTargetLevel(userId, { db: over.challenge?.db, now: over.challenge?.now, profile: async () => profile }),
  ])
  return attachLessonLevel(rec, target)
}

async function recommendByHistory(userId: string, level: JlptLevel): Promise<LessonRecommendation | null> {
  const window = levelWindow(level)
  const last = await prisma.lesson.findFirst({
    where: { userId, status: 'DONE', topicId: { not: null } },
    orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
    select: { content: true, topic: { select: { id: true, title: true, level: true, userId: true } } },
  })
  const topic = last?.topic && (last.topic.userId === null || last.topic.userId === userId) ? last.topic : null
  if (topic) {
    const done = (await doneLessonStats(userId, [topic.id])).get(topic.id)?.count ?? 0
    const nextPreview = previewOf(last?.content)
    if (done < TOPIC_ROTATE_AFTER) return { topicId: topic.id, topicTitle: topic.title, level: topic.level, reason: 'CONTINUE', nextPreview }
    const next = (await pickFewestLessonTopic(userId, [level], topic.id)) ?? (await pickFewestLessonTopic(userId, window, topic.id))
    if (next) return { topicId: next.id, topicTitle: next.title, level: next.level, reason: 'NEXT_TOPIC', nextPreview: null }
    return { topicId: topic.id, topicTitle: topic.title, level: topic.level, reason: 'CONTINUE', nextPreview }
  }
  const start = (await pickFewestLessonTopic(userId, [level])) ?? (await pickFewestLessonTopic(userId, window))
  return start ? { topicId: start.id, topicTitle: start.title, level: start.level, reason: 'START', nextPreview: null } : null
}

async function reviewStateSafely<T>(userId: string, driver: ReviewDecisionDriver<T> | null, today: string): Promise<TodayReviewState> {
  try {
    return await getTodayReviewState(userId, driver, today)
  } catch (e) {
    console.error('[today] 복습 칸 계산 실패:', e instanceof Error ? e.name : 'unknown')
    return EMPTY_REVIEW_STATE
  }
}

/** `opts.reviewDecision` = 강사 판단 잡 함수 묶음(라우트가 conversation 으로 만든다). 없으면 판단 잡을 걸지 않는다(폴백 세션만). */
export async function getTodayLessons<T = unknown>(userId: string, opts: { reviewDecision?: ReviewDecisionDriver<T> | null } = {}): Promise<TodayLessonsDto> {
  const today = dates.todayKst()
  const rows = await prisma.lesson.findMany({
    where: { userId, date: dates.toDbDate(today) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 20,
    select: ITEM_SELECT,
  })
  const todayLessons: TodayLessonItem[] = []
  for (const r of rows) {
    let status = r.status
    let jobId: string | null = null
    if (status === 'GENERATING') {
      jobId = await settleGenerating(userId, r.id, undefined, lessonGenKindOf(r.kind))
      if (!jobId) status = (await prisma.lesson.findFirst({ where: { id: r.id, userId }, select: { status: true } }))?.status ?? status
    }
    const content = readStoredContent(r.content)
    const expr = content ? summarizeExpressions(content, speakingRecords(readProgress(r.progress))) : null
    todayLessons.push({
      id: r.id,
      kind: r.kind,
      status,
      title: r.title,
      titleKo: content?.titleKo ?? null,
      stageDone: r.stageDone,
      topic: r.topic ? { id: r.topic.id, title: r.topic.title } : null,
      scenarioId: r.scenarioId ?? null,
      score: r.score,
      jobId,
      speaking: expr ? { used: expr.usedIds.length, total: expr.usedIds.length + expr.missedIds.length } : null,
    })
  }
  const older = await prisma.lesson.findFirst({
    where: { userId, kind: 'NEW', date: { lt: dates.toDbDate(today) }, status: { in: ['READY', 'IN_PROGRESS'] } },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    select: ITEM_SELECT,
  })
  const profile = await getProfile(userId)
  const review = await reviewStateSafely(userId, opts.reviewDecision ?? null, today)
  return {
    ...review,
    date: today,
    todayLessons,
    resume: older ? { id: older.id, title: older.title, titleKo: readStoredContent(older.content)?.titleKo ?? null, stageDone: older.stageDone, date: dates.fromDbDate(older.date) } : null,
    recommendation: await recommendWithLessonLevel(userId, { level: profile.level as JlptLevel, goalLevel: profile.goalLevel }),
  }
}
