/**
 * #58 오늘 — task-010 은 새 수업(NEW) 모드만. 복습 칸(`review`·`guard`·`cycle`)은 task-010b 가 채운다(계약 형태만 유지, 지금은 null).
 *
 *  - `todayLessons`: 오늘(KST) 날짜 레슨 전부(만든 순 최신부터). 만드는 중이면 `jobId`(잡이 죽었으면 여기서 FAILED 로 닫는다).
 *  - `resume`: 오늘 이전 날짜의 READY·IN_PROGRESS 레슨 중 가장 최근 것 1개(이어서 하기).
 *  - `recommendation`(Leader 추가 사양, designer 데모 v1): 가장 최근에 끝낸 주제 레슨이 있으면 그 주제 + 그 수업의 `nextPreview`
 *    (CONTINUE). 그 주제를 이미 `TOPIC_ROTATE_AFTER`번 끝냈으면 학습자 수준에서 가장 적게 한 다른 주제(NEXT_TOPIC). 끝낸 주제 수업이
 *    없으면 학습자 수준의 주제 중 가장 적게 한 것(START). 하던 수업(READY·IN_PROGRESS)이 있으면 화면은 그쪽을 먼저 보인다 — 추천은 참고용.
 */
import type { JlptLevel, LessonKind, LessonStatus } from '@prisma/client'
import { dates, prisma } from '@/modules/infra'
import { getProfile } from '@/modules/preferences'
import { doneLessonStats, levelWindow, pickFewestLessonTopic } from '../topics'
import { readStoredContent, summarizeExpressions } from './content'
import { settleGenerating } from './generate'
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
  score: number | null
  jobId: string | null
  /** 말하기에서 쓴 표현 수·판정 가능한 목표 수(§12-11 ① — 홈 완료 카드). 본문이 없으면 null. */
  speaking: { used: number; total: number } | null
}

export interface LessonRecommendation {
  topicId: string
  topicTitle: string
  level: JlptLevel
  reason: 'CONTINUE' | 'NEXT_TOPIC' | 'START'
  nextPreview: { titleKo: string; teaserKo: string } | null
}

export interface TodayLessonsDto {
  mode: 'NEW'
  date: string
  review: null
  guard: null
  cycle: null
  todayLessons: TodayLessonItem[]
  resume: { id: string; title: string; titleKo: string | null; stageDone: number; date: string } | null
  recommendation: LessonRecommendation | null
}

const ITEM_SELECT = {
  id: true, kind: true, status: true, title: true, stageDone: true, score: true, content: true, progress: true, date: true,
  topic: { select: { id: true, title: true } },
} as const

async function recommend(userId: string, level: JlptLevel): Promise<LessonRecommendation | null> {
  const window = levelWindow(level)
  const last = await prisma.lesson.findFirst({
    where: { userId, status: 'DONE', topicId: { not: null } },
    orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
    select: { content: true, topic: { select: { id: true, title: true, level: true, userId: true } } },
  })
  const topic = last?.topic && (last.topic.userId === null || last.topic.userId === userId) ? last.topic : null
  if (topic) {
    const done = (await doneLessonStats(userId, [topic.id])).get(topic.id)?.count ?? 0
    const np = readStoredContent(last?.content)?.nextPreview
    const nextPreview = np && typeof np.titleKo === 'string' && typeof np.teaserKo === 'string' ? { titleKo: np.titleKo, teaserKo: np.teaserKo } : null
    if (done < TOPIC_ROTATE_AFTER) return { topicId: topic.id, topicTitle: topic.title, level: topic.level, reason: 'CONTINUE', nextPreview }
    const next = (await pickFewestLessonTopic(userId, [level], topic.id)) ?? (await pickFewestLessonTopic(userId, window, topic.id))
    if (next) return { topicId: next.id, topicTitle: next.title, level: next.level, reason: 'NEXT_TOPIC', nextPreview: null }
    return { topicId: topic.id, topicTitle: topic.title, level: topic.level, reason: 'CONTINUE', nextPreview }
  }
  const start = (await pickFewestLessonTopic(userId, [level])) ?? (await pickFewestLessonTopic(userId, window))
  return start ? { topicId: start.id, topicTitle: start.title, level: start.level, reason: 'START', nextPreview: null } : null
}

export async function getTodayLessons(userId: string): Promise<TodayLessonsDto> {
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
      jobId = await settleGenerating(userId, r.id)
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
      score: r.score,
      jobId,
      speaking: expr ? { used: expr.usedIds.length, total: expr.usedIds.length + expr.missedIds.length } : null,
    })
  }
  const older = await prisma.lesson.findFirst({
    where: { userId, date: { lt: dates.toDbDate(today) }, status: { in: ['READY', 'IN_PROGRESS'] } },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    select: ITEM_SELECT,
  })
  const profile = await getProfile(userId)
  return {
    mode: 'NEW',
    date: today,
    review: null,
    guard: null,
    cycle: null,
    todayLessons,
    resume: older ? { id: older.id, title: older.title, titleKo: readStoredContent(older.content)?.titleKo ?? null, stageDone: older.stageDone, date: dates.fromDbDate(older.date) } : null,
    recommendation: await recommend(userId, profile.level as JlptLevel),
  }
}
