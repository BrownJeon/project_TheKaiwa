/**
 * 생성 기준 수준 `T`(task-076, IMP-0051 — 승인 데모 v2 D4·D5·D6 ★, `docs/screens.md` §33) — 오늘의 회화(주제 수업)·챌린지 주제 「새 단어」·
 * 내 단어장 세트 가중 기준이 같은 규칙을 쓴다:
 *
 *   T = 진행 중 챌린지가 있으면 challenge.level, 없으면 profile.goalLevel ?? profile.level
 *
 * 「진행 중」은 `topics/visible.ts` `isChallengeInProgress` 하나로 판정한다(ACTIVE ∧ 주제 있음 ∧ 종료일 ≥ 오늘 — 시작 전 포함, REV-152a L-1:
 * 가린 시드 예외·주제 삭제 사전 조회와 같은 집합). 챌린지 `level` 은 만들 때 얼린 값(#156 `level`, 없으면 주제 난이도)이다.
 *
 * 자리가 `challenges/` 가 아니라 learning 바로 아래인 이유: `vocab/sessions.ts` 는 `challenges` 를 값 import 할 수 없다(REV-121 L-5 —
 * `lessons/today → challenges → topics/pool` 순환, task042 import 경계 시험). 이 파일은 `topics/visible`·preferences·infra 만 읽어
 * lessons·vocab·challenges 가 모두 순환 없이 쓴다(앞선 예: `refs.ts`).
 */
import type { JlptLevel } from '@prisma/client'
import { dates, prisma, type Tx } from '@/modules/infra'
import { getProfile } from '@/modules/preferences'
import { isChallengeInProgress } from './topics/visible'

/** 쉬움 → 어려움. */
export const JLPT_LEVELS: readonly JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']

export function isJlptLevel(v: unknown): v is JlptLevel {
  return typeof v === 'string' && (JLPT_LEVELS as readonly string[]).includes(v)
}

/** T 의 출처 — #58 `recommendation.levelSource`(오늘 탭 회화 뱃지 꼬리표 「챌린지 / 내 목표 / 내 수준」). */
export type TargetLevelSource = 'CHALLENGE' | 'GOAL' | 'LEVEL'

export interface TargetLevel {
  level: JlptLevel
  source: TargetLevelSource
}

export interface TargetLevelProfile {
  level: string | null | undefined
  goalLevel: string | null | undefined
}

/**
 * 순수 규칙. `challengeLevel` = 진행 중 챌린지의 `level`(없으면 null). `profile` 을 못 읽었으면 null.
 * 알 수 없으면 null — 호출자는 「지금 동작 그대로」로 간다(데모 결정표 9번 줄).
 */
export function resolveTargetLevel(challengeLevel: string | null | undefined, profile: TargetLevelProfile | null): TargetLevel | null {
  if (isJlptLevel(challengeLevel)) return { level: challengeLevel, source: 'CHALLENGE' }
  if (!profile) return null
  if (isJlptLevel(profile.goalLevel)) return { level: profile.goalLevel, source: 'GOAL' }
  if (isJlptLevel(profile.level)) return { level: profile.level, source: 'LEVEL' }
  return null
}

export interface InProgressChallengeLevel {
  challengeId: string
  topicId: string
  level: JlptLevel
}

/** 진행 중 챌린지의 얼린 난이도 — 없으면 null. 읽기 1회, 쓰기 없음(지연 전이도 하지 않는다 — 기간 지난 ACTIVE 는 판정에서 빠진다). */
export async function getInProgressChallengeLevel(db: Pick<Tx, 'challenge'>, userId: string, now: Date): Promise<InProgressChallengeLevel | null> {
  // 사용자당 ACTIVE 는 하나(activeKey 유일)지만 다른 챌린지 조회와 같은 순서로 고른다.
  const row = await db.challenge.findFirst({
    where: { userId, status: 'ACTIVE' },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, status: true, topicId: true, level: true, endDate: true },
  })
  if (!row || row.topicId === null || !isChallengeInProgress(row, dates.todayKst(now))) return null
  return { challengeId: row.id, topicId: row.topicId, level: row.level }
}

export type TargetProfileReader = (userId: string) => Promise<TargetLevelProfile>

export interface ReadTargetLevelOptions {
  /** 챌린지를 읽을 DB(가짜 DB) — 없으면 실제 DB. */
  db?: Pick<Tx, 'challenge'>
  /** 시계 — 없으면 지금. */
  now?: () => Date
  /** 프로필 읽기 — 이미 읽은 값이 있으면 넘겨 두 번 읽지 않는다. 없으면 `getProfile`. */
  profile?: TargetProfileReader
}

/**
 * 사용자의 T. 챌린지가 있으면 프로필을 읽지 않는다(필요 없음). 조회가 실패하면 null(로그는 오류 이름만) — 기준을 확정할 수 없을 때는
 * 호출자가 지금 동작(주제 수준·지금 뱃지)을 그대로 쓴다. 던지지 않는다.
 */
export async function readTargetLevel(userId: string, opts: ReadTargetLevelOptions = {}): Promise<TargetLevel | null> {
  try {
    const ch = await getInProgressChallengeLevel(opts.db ?? prisma, userId, (opts.now ?? (() => new Date()))())
    if (ch) return resolveTargetLevel(ch.level, null)
    return resolveTargetLevel(null, await (opts.profile ?? getProfile)(userId))
  } catch (e) {
    console.error('[learning] 기준 수준 계산 실패:', e instanceof Error ? e.name : 'unknown')
    return null
  }
}
