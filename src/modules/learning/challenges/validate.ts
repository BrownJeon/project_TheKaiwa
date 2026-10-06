/**
 * 챌린지 API 입력 검증(설계서 §9-1 #155·#156·#159) — 순수 함수. 위반은 전부 400 VALIDATION, 화이트리스트 밖 키도 400.
 * 날짜는 받지 않는다(`start: 'TODAY'|'TOMORROW'` 만 — 날짜는 서버 KST, api-contract §0-6).
 */
import { ApiError, codePointLength, decodeCursor, isTimeIdCursor, parseLimit, sanitizeText } from '@/modules/infra'
import type { ChallengeLength, ChallengeWordCount } from '@/types/challenge'
import { CHALLENGE_LENGTHS, CHALLENGE_WORD_COUNTS } from './metrics'

export const CHALLENGE_TITLE_MAX = 40
export const CHALLENGE_LIST_LIMIT_DEFAULT = 20
export const CHALLENGE_LIST_LIMIT_MAX = 50

function bad(field: string, message: string, reason = 'invalid'): never {
  throw new ApiError('VALIDATION', message, { field, reason })
}

function onlyKeys(body: Record<string, unknown>, keys: readonly string[], prefix = ''): void {
  const extra = Object.keys(body).filter((k) => !keys.includes(k))
  if (extra.length) bad(`${prefix}${extra[0]}`, `넣을 수 없는 항목입니다: ${extra.join(', ')}`, 'unknown_key')
}

const ID = /^[A-Za-z0-9_-]{1,40}$/

export function isChallengeId(id: unknown): id is string {
  return typeof id === 'string' && ID.test(id)
}

export interface CreateChallengeInput {
  topicId: string
  lengthDays: ChallengeLength
  start: 'TODAY' | 'TOMORROW'
  lesson: boolean
  words: boolean
  /** 생략하면 null — 서버가 학습 설정(하루 단어 수)으로 정한다. `words:false` 면 무시. */
  wordCount: ChallengeWordCount | null
  /** 비었거나 생략하면 null — 자동 제목. */
  title: string | null
}

/** #156 `{topicId, lengthDays: 7|14|30, start, dailyGoal: {lesson, words, wordCount?: 5|10|15}, title?: ≤40자}`. */
export function parseCreateChallengeBody(body: Record<string, unknown>): CreateChallengeInput {
  onlyKeys(body, ['topicId', 'lengthDays', 'start', 'dailyGoal', 'title'])
  if (!isChallengeId(body.topicId)) bad('topicId', '주제를 골라 주세요.', 'required')
  if (!(CHALLENGE_LENGTHS as readonly unknown[]).includes(body.lengthDays)) bad('lengthDays', '기간은 7·14·30일 중에서 골라 주세요.', CHALLENGE_LENGTHS.join('|'))
  if (body.start !== 'TODAY' && body.start !== 'TOMORROW') bad('start', '시작일은 오늘 또는 내일이에요.', 'TODAY|TOMORROW')
  const goal = body.dailyGoal
  if (!goal || typeof goal !== 'object' || Array.isArray(goal)) bad('dailyGoal', '하루 목표를 정해 주세요.', 'required')
  const g = goal as Record<string, unknown>
  onlyKeys(g, ['lesson', 'words', 'wordCount'], 'dailyGoal.')
  if (typeof g.lesson !== 'boolean') bad('dailyGoal.lesson', '오늘의 회화 과제를 켤지 정해 주세요.', 'boolean')
  if (typeof g.words !== 'boolean') bad('dailyGoal.words', '주제 단어 과제를 켤지 정해 주세요.', 'boolean')
  if (!g.lesson && !g.words) bad('dailyGoal', '하루 목표를 하나 이상 골라 주세요.', 'NO_TASK')
  let wordCount: ChallengeWordCount | null = null
  if (g.words && g.wordCount !== undefined && g.wordCount !== null) {
    if (!(CHALLENGE_WORD_COUNTS as readonly unknown[]).includes(g.wordCount)) bad('dailyGoal.wordCount', '단어 장수는 5·10·15장 중에서 골라 주세요.', CHALLENGE_WORD_COUNTS.join('|'))
    wordCount = g.wordCount as ChallengeWordCount
  }
  let title: string | null = null
  if (body.title !== undefined && body.title !== null) {
    if (typeof body.title !== 'string') bad('title', '제목은 문자열이어야 합니다.')
    const t = sanitizeText(body.title)
    if (codePointLength(t) > CHALLENGE_TITLE_MAX) bad('title', `제목은 ${CHALLENGE_TITLE_MAX}자까지 쓸 수 있어요.`, `max ${CHALLENGE_TITLE_MAX}`)
    title = t || null
  }
  return {
    topicId: body.topicId as string,
    lengthDays: body.lengthDays as ChallengeLength,
    start: body.start as 'TODAY' | 'TOMORROW',
    lesson: g.lesson as boolean,
    words: g.words as boolean,
    wordCount,
    title,
  }
}

/** #159 본문은 `{}`(빈 본문 포함). */
export function parseEndChallengeBody(body: Record<string, unknown>): void {
  onlyKeys(body, [])
}

export type ChallengeListStatus = 'ACTIVE' | 'FINISHED' | 'ALL'

export interface ChallengeListQuery {
  status: ChallengeListStatus
  limit: number
  cursor: { t: string; id: string } | null
}

/** #155 `?status=ACTIVE|FINISHED|ALL&limit=&cursor=` — FINISHED = COMPLETED + ENDED. */
export function parseChallengeListQuery(q: URLSearchParams): ChallengeListQuery {
  for (const k of q.keys()) {
    if (k !== 'status' && k !== 'limit' && k !== 'cursor') bad(k, `지원하지 않는 조건입니다: ${k}`, 'unknown_key')
  }
  const raw = q.get('status')
  const status = raw === null || raw === '' ? 'ALL' : raw
  if (status !== 'ACTIVE' && status !== 'FINISHED' && status !== 'ALL') bad('status', 'status 는 ACTIVE·FINISHED·ALL 입니다.', 'ACTIVE|FINISHED|ALL')
  return {
    status,
    limit: parseLimit(q.get('limit'), CHALLENGE_LIST_LIMIT_DEFAULT, CHALLENGE_LIST_LIMIT_MAX),
    cursor: decodeCursor(q.get('cursor'), isTimeIdCursor),
  }
}
