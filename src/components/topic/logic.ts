/**
 * 주제·상황 관리(task-045 T5) 순수 함수 — 출처 판정·정렬·「상황 n개」 셈·진행 중 챌린지·한도·주소. 화면 상태·요청을 모른다(단위 시험 대상).
 *
 * 출처(screens.md §16-2 S2): `isSeed` → `SEED` · 내 행이면서 #179 내 버전(`state:'COPIED' && !orphan`)의 `copyId` → `COPY` · 그 밖 → `MINE`.
 * 상황은 `isMine` 으로 같은 규칙(`!isMine` → `SEED`). 내 주제 30개 한도는 사본을 포함한다(`TOPIC_LIMITS.minePerUser`).
 */
import type { ChallengeListResponse } from '@/types/challenge'
import type { Topic } from '@/types/lesson'
import type { ScenarioListItem } from '@/types/scenario'
import type { SeedKind, SeedOverrideItem } from '@/types/seedOverride'
import { TOPIC_LIMITS } from '@/types/topic'

export type Origin = 'MINE' | 'SEED' | 'COPY'
export type ManageTab = 'topics' | 'scenarios'
export type ScenarioFilter = 'all' | 'mine' | 'seed'

export const MANAGE_HREF = '/settings/scenarios'
export const TOPIC_NEW_HREF = '/settings/scenarios/topics/new'
export const SCENARIO_NEW_FROM_MANAGE_HREF = '/study/ai/scenario/new?from=manage'

export const topicHref = (id: string): string => `/settings/scenarios/topics/${encodeURIComponent(id)}`

/**
 * 주제 행(`TopicRow`)의 실제 높이 근거(px) — 클래스에서 계산한 값이다(실측은 QA). 본문 `line-height: 1.5`(globals.css)를 이어받고
 * `text-[Npx]` 는 글자 크기만 정한다: 테두리 1+1 · `py-3` 12+12 · 제목 줄 15×1.5(뱃지 22 보다 큼) · `gap-0.5` 2 · 일본어 이름 13×1.5 ·
 * `gap-0.5` 2 · `mt-0.5` 2 · 메타 줄 12×1.5. 일본어 이름이 없는 행은 `min-h-[76px]` 하한이 잡고, 챌린지 뱃지(22)가 붙으면 메타 줄이 22 로 커져 +4.
 * 자리표시·빈 상자가 이 값을 쓰면 내 주제 1개·기본 주제 도착 때 아래가 밀리지 않는다(`topic/__tests__/rowHeight.test.ts` 가 클래스와 이 값을 묶어 둔다).
 */
export const TOPIC_ROW_PARTS = { border: 2, padY: 24, title: 22.5, gap: 2, titleJa: 19.5, metaTop: 2, meta: 18 } as const
export const TOPIC_ROW_MIN_HEIGHT = 76

export function topicRowHeight(p: { [K in keyof typeof TOPIC_ROW_PARTS]: number } = TOPIC_ROW_PARTS): number {
  return p.border + p.padY + p.title + p.gap + p.titleJa + p.gap + p.metaTop + p.meta
}

export const TOPIC_ROW_HEIGHT = topicRowHeight()

/** 상황 목록만 다시 읽을 때(#161 단독 실패의 [다시 시도]) 자리표시가 적어도 이만큼 보인다 — 응답이 바로 실패해도 「눌렀다」가 눈에 보이게. */
export const RETRY_MIN_BUSY_MS = 500

export function retryBusyRemainingMs(startedAt: number, now: number, min: number = RETRY_MIN_BUSY_MS): number {
  return Math.min(min, Math.max(0, min - (now - startedAt)))
}

export function parseManageTab(v: unknown): ManageTab {
  return v === 'scenarios' ? 'scenarios' : 'topics'
}

/** `?tab`·`?sc` — 주제 탭이 기본이라 주소에서 뺀다. 시트는 상황 탭에서만 연다. */
export function manageHref(tab: ManageTab, sheetId: string | null = null): string {
  if (tab === 'topics') return MANAGE_HREF
  return `${MANAGE_HREF}?tab=scenarios${sheetId ? `&sc=${encodeURIComponent(sheetId)}` : ''}`
}

/** 그 종류의 내 버전 id(고아 제외). */
export function copyIdSet(overrides: readonly SeedOverrideItem[], kind: SeedKind): Set<string> {
  const out = new Set<string>()
  for (const o of overrides) if (o.kind === kind && o.state === 'COPIED' && !o.orphan && o.copyId) out.add(o.copyId)
  return out
}

/** 숨긴 기본 항목 수(주제·상황 합) — 숨김 + 사본이 사라진 고아(되돌리기가 정리한다). */
export function hiddenSeedCount(overrides: readonly SeedOverrideItem[]): number {
  return overrides.filter((o) => o.state === 'HIDDEN' || o.orphan).length
}

export function topicOrigin(t: Pick<Topic, 'id' | 'isSeed'>, copyIds: ReadonlySet<string>): Origin {
  if (t.isSeed) return 'SEED'
  return copyIds.has(t.id) ? 'COPY' : 'MINE'
}

export function scenarioOrigin(s: Pick<ScenarioListItem, 'id' | 'isMine'>, copyIds: ReadonlySet<string>): Origin {
  if (!s.isMine) return 'SEED'
  return copyIds.has(s.id) ? 'COPY' : 'MINE'
}

/** 주제 id → 그 주제에 이어진 상황 수(#161 `topics[]` — 한 상황이 여러 주제에 이어질 수 있다). */
export function scenarioCountByTopic(items: readonly Pick<ScenarioListItem, 'id' | 'topics'>[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const s of items) {
    const seen = new Set<string>()
    for (const t of s.topics ?? []) {
      if (!t?.id || seen.has(t.id)) continue
      seen.add(t.id)
      out.set(t.id, (out.get(t.id) ?? 0) + 1)
    }
  }
  return out
}

/** 진행 중 챌린지(#155 `status=ACTIVE&limit=1` — 사용자당 하나). 시작 전(0일째)·주제가 지워진 챌린지는 뱃지를 달지 않는다. */
export function activeChallengeBadge(res: Pick<ChallengeListResponse, 'items'> | null | undefined): { topicId: string; day: number } | null {
  const c = res?.items?.find((x) => x.status === 'ACTIVE')
  if (!c || !c.topic?.id || !(c.stats?.dayIndex >= 1)) return null
  return { topicId: c.topic.id, day: c.stats.dayIndex }
}

export interface TopicRowView {
  id: string
  title: string
  titleJa: string | null
  level: string
  origin: Origin
  chunkCount: number
  /** #161 이 실패했으면 null — 행은 「기본 표현 n개」만. */
  scenarioCount: number | null
  challengeDay: number | null
}

export interface TopicSections {
  mine: TopicRowView[]
  /** 기본(서버 순서) 뒤에 내 버전(이름순). */
  seed: TopicRowView[]
  /** 내 주제 한도 셈(MINE + COPY). */
  ownedCount: number
}

const byTitle = (a: { title: string }, b: { title: string }) => a.title.localeCompare(b.title, 'ko')

export function buildTopicSections(
  topics: readonly Topic[],
  ctx: { copyIds: ReadonlySet<string>; scenarioCounts: ReadonlyMap<string, number> | null; active: { topicId: string; day: number } | null },
): TopicSections {
  const rows = topics.map(
    (t): TopicRowView => ({
      id: t.id,
      title: t.title,
      titleJa: t.titleJa?.trim() ? t.titleJa : null,
      level: t.level,
      origin: topicOrigin(t, ctx.copyIds),
      chunkCount: Array.isArray(t.chunks) ? t.chunks.length : 0,
      scenarioCount: ctx.scenarioCounts ? (ctx.scenarioCounts.get(t.id) ?? 0) : null,
      challengeDay: ctx.active && ctx.active.topicId === t.id ? ctx.active.day : null,
    }),
  )
  const mine = rows.filter((r) => r.origin === 'MINE')
  const copies = rows.filter((r) => r.origin === 'COPY').sort(byTitle)
  const seeds = rows.filter((r) => r.origin === 'SEED')
  return { mine, seed: [...seeds, ...copies], ownedCount: mine.length + copies.length }
}

export function topicLimitReached(ownedCount: number): boolean {
  return ownedCount >= TOPIC_LIMITS.minePerUser
}

export interface ScenarioRowView {
  item: ScenarioListItem
  origin: Origin
}

export interface ScenarioRows {
  rows: ScenarioRowView[]
  counts: { all: number; mine: number; seed: number }
  /** 내 상황 50개 한도 셈(MINE + COPY — 사본도 내 행이다). */
  ownedCount: number
}

export function buildScenarioRows(items: readonly ScenarioListItem[], copyIds: ReadonlySet<string>): ScenarioRows {
  const rows = items.map((item) => ({ item, origin: scenarioOrigin(item, copyIds) }))
  const mine = rows.filter((r) => r.origin === 'MINE').length
  const owned = rows.filter((r) => r.origin !== 'SEED').length
  return { rows, counts: { all: rows.length, mine, seed: rows.length - mine }, ownedCount: owned }
}

/** 「내가 만든」 = MINE, 「기본」 = 기본 + 내 버전(주제 탭 절 나눔과 같다). */
export function filterScenarioRows(rows: readonly ScenarioRowView[], filter: ScenarioFilter): ScenarioRowView[] {
  if (filter === 'mine') return rows.filter((r) => r.origin === 'MINE')
  if (filter === 'seed') return rows.filter((r) => r.origin !== 'MINE')
  return [...rows]
}
