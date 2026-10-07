/**
 * 주제·상황 관리(task-045 T5) 순수 함수 — 출처 판정·정렬·「상황 n개」 셈·진행 중 챌린지·한도·주소. 화면 상태·요청을 모른다(단위 시험 대상).
 *
 * 출처(screens.md §16-2 S2): `isSeed` → `SEED` · 내 행이면서 #179 내 버전(`state:'COPIED' && !orphan`)의 `copyId` → `COPY` · 그 밖 → `MINE`.
 * 상황은 `isMine` 으로 같은 규칙(`!isMine` → `SEED`). 내 주제 30개 한도는 사본을 포함한다(`TOPIC_LIMITS.minePerUser`).
 */
import type { ChallengeListResponse } from '@/types/challenge'
import type { Topic, TopicChunk } from '@/types/lesson'
import type { ScenarioListItem } from '@/types/scenario'
import type { RestoreSeedResult, SeedKind, SeedOverrideItem } from '@/types/seedOverride'
import { TOPIC_CHUNK_TYPES, TOPIC_LIMITS, type TopicRemovalPreview, type TopicRemovalResult, type TopicRemovalScenarioRef } from '@/types/topic'
import { REMOVAL, TOAST, TOPIC, FAIL, type RemovalMode } from './topicCopy'

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

/* ───────── T5-2 주제 보기(S6)·지우기 확인(S8·S9)·숨긴 기본 항목·돌아왔을 때 토스트 ───────── */

export const topicEditHref = (id: string): string => `${topicHref(id)}/edit`
/** 상황 시트를 연 주제 보기 — `?sc=` 는 시트 딥링크(관리 화면과 같은 규칙). */
export const topicSheetHref = (id: string, sheetId: string | null): string => (sheetId ? `${topicHref(id)}?sc=${encodeURIComponent(sheetId)}` : topicHref(id))
/** S6 [＋ 이 주제로 상황 만들기] — 장소 미리 고르기·관리 화면으로 돌아오기(T5-5a 가 읽는 쿼리). */
export const topicScenarioNewHref = (id: string): string => `${SCENARIO_NEW_FROM_MANAGE_HREF}&topicId=${encodeURIComponent(id)}`
export const challengeHref = (id: string): string => `/plan/challenge/${encodeURIComponent(id)}`

/** 숨긴 기본 항목 시트의 줄 — 숨김 + 사본이 사라진 고아(`hiddenSeedCount` 와 같은 기준, 두 종류 모두). */
export function hiddenSeedItems(overrides: readonly SeedOverrideItem[]): SeedOverrideItem[] {
  return overrides.filter((o) => o.state === 'HIDDEN' || o.orphan)
}

/** 내 버전 주제의 override(시드 id·만든 때). */
export function topicCopyOverride(overrides: readonly SeedOverrideItem[], copyId: string): SeedOverrideItem | null {
  return overrides.find((o) => o.kind === 'TOPIC' && o.state === 'COPIED' && !o.orphan && o.copyId === copyId) ?? null
}

const KST_MONTH_DAY = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' })

/** 「M월 D일」(한국 시각). 읽을 수 없는 값이면 null — 날짜 없이 쓰지 않도록 화면이 문구를 고른다. */
export function monthDayKst(iso: string | null | undefined): string | null {
  const t = iso ? Date.parse(iso) : NaN
  if (!Number.isFinite(t)) return null
  const parts = KST_MONTH_DAY.formatToParts(new Date(t))
  const m = parts.find((p) => p.type === 'month')?.value
  const d = parts.find((p) => p.type === 'day')?.value
  return m && d ? `${m}월 ${d}일` : null
}

export interface TopicChallengeCard {
  id: string
  title: string
  day: number
  lengthDays: number
}

/** S6 진행 중 챌린지 카드 — 이 주제의 진행 중 챌린지(시작 전 0일째는 뱃지와 같이 싣지 않는다). */
export function activeChallengeFor(res: Pick<ChallengeListResponse, 'items'> | null | undefined, topicId: string): TopicChallengeCard | null {
  const c = res?.items?.find((x) => x.status === 'ACTIVE')
  if (!c || c.topic?.id !== topicId || !(c.stats?.dayIndex >= 1)) return null
  return { id: c.id, title: c.title, day: c.stats.dayIndex, lengthDays: c.lengthDays }
}

export interface ChunkGroup {
  type: string
  chunks: TopicChunk[]
}

/** 기본 표현을 종류 4묶음(이름·액션·느낌·꾸밈 순, 묶음 안은 서버 순서)으로. 모르는 종류는 뒤에 그대로 둔다(버리지 않는다). */
export function groupChunks(chunks: readonly TopicChunk[]): ChunkGroup[] {
  const sorted = [...chunks].sort((a, b) => a.order - b.order)
  const known = TOPIC_CHUNK_TYPES as readonly string[]
  const order = [...known, ...new Set(sorted.map((c) => c.chunkType as string).filter((t) => !known.includes(t)))]
  return order.map((type) => ({ type, chunks: sorted.filter((c) => c.chunkType === type) })).filter((g) => g.chunks.length > 0)
}

export interface TopicDetailView {
  topic: Topic
  origin: Origin
  /** 내 버전일 때 그 시드 id(되돌리기 #176). */
  seedId: string | null
  /** 내 버전을 만든 날(「M월 D일」), 읽을 수 없으면 null. */
  copyDate: string | null
  chunkGroups: ChunkGroup[]
  chunkCount: number
  /** #161 이 실패했으면 null. */
  scenarios: ScenarioRowView[] | null
  challenge: TopicChallengeCard | null
}

/** S6 — 상세 API 가 없어 #56 목록에서 id 로 찾는다(§16-0 #3). 없으면 null(지워졌거나 숨긴 주제 — 「찾을 수 없어요」). */
export function buildTopicDetail(
  id: string,
  d: { topics: readonly Topic[]; overrides: readonly SeedOverrideItem[]; scenarios: readonly ScenarioListItem[] | null; challenges: Pick<ChallengeListResponse, 'items'> | null },
): TopicDetailView | null {
  const topic = d.topics.find((t) => t.id === id)
  if (!topic) return null
  const origin = topicOrigin(topic, copyIdSet(d.overrides, 'TOPIC'))
  const ov = origin === 'COPY' ? topicCopyOverride(d.overrides, id) : null
  const chunks = Array.isArray(topic.chunks) ? topic.chunks : []
  const scCopies = copyIdSet(d.overrides, 'SCENARIO')
  return {
    topic,
    origin,
    seedId: ov?.seedId ?? null,
    copyDate: monthDayKst(ov?.updatedAt),
    chunkGroups: groupChunks(chunks),
    chunkCount: chunks.length,
    scenarios: d.scenarios
      ? d.scenarios.filter((s) => (s.topics ?? []).some((t) => t?.id === id)).map((item) => ({ item, origin: scenarioOrigin(item, scCopies) }))
      : null,
    challenge: activeChallengeFor(d.challenges, id),
  }
}

/** S6 맨 아래 행동 → 확인 시트 mode(§16-2 S6 표). */
export const REMOVAL_MODE_OF: Record<Origin, Exclude<RemovalMode, 'restore'>> = { MINE: 'delete', SEED: 'hide', COPY: 'copyDelete' }

export interface RemovalLine {
  text: string
  sub: string | null
}

export interface RemovalView {
  /** 진행 중 챌린지 상자 — `bad` = 경고 상자(굵은 머리), `info` = 안내(숨기기 — 챌린지는 이어진다). */
  warn: { tone: 'bad' | 'info'; title: string | null; text: string } | null
  /** 첫머리 문단(`info` 면 안내 상자). */
  leads: { text: string; info: boolean }[]
  gone: RemovalLine[]
  /** 되돌리기 — 「기본 주제로 되돌아가요」 줄. */
  back: RemovalLine[]
  keep: RemovalLine[]
}

const titles = (refs: readonly TopicRemovalScenarioRef[]): string | null => (refs.length ? refs.map((r) => r.title).join(' · ') : null)

/**
 * 확인 시트 본문(§16-2 S8·S9) — 숫자·제목은 늘 #172 미리보기(또는 409 `details.preview`)에서. 완료 기록 줄은 `finishedChallenges > 0` 일 때만.
 * 지우기·내 버전 지우기는 미리보기 `delete`(= 맨 위 값), 되돌리기는 `restore`, 숨기기는 상황 변화가 없다(서버가 빈 목록을 준다).
 */
export function removalView(mode: RemovalMode, p: TopicRemovalPreview): RemovalView {
  const a = p.activeChallenge
  const impact = mode === 'restore' ? p.restore : (p.delete ?? { scenariosArchived: p.scenariosArchived, scenariosUnlinked: p.scenariosUnlinked, scenariosRelinked: p.scenariosRelinked })
  const archived = mode === 'hide' ? [] : (impact?.scenariosArchived ?? [])
  const unlinked = mode === 'hide' || mode === 'restore' ? [] : (impact?.scenariosUnlinked ?? [])
  const relinked = mode === 'restore' ? (impact?.scenariosRelinked ?? []) : []
  const challengeLine: RemovalLine | null = a ? { text: REMOVAL.goneChallenge, sub: TOPIC.challenge(a.title, a.day, a.lengthDays) } : null

  const warn: RemovalView['warn'] = !a
    ? null
    : mode === 'hide'
      ? { tone: 'info', title: null, text: REMOVAL.warn.hide(a.title) }
      : { tone: 'bad', title: REMOVAL.warnTitle, text: REMOVAL.warn[mode](a.title, a.day) }

  const leads: RemovalView['leads'] = []
  if (mode === 'hide') leads.push({ text: REMOVAL.hideBody, info: true })
  if (mode === 'copyDelete') leads.push({ text: REMOVAL.copyDeleteBody, info: false })
  if (mode === 'restore') leads.push({ text: REMOVAL.restoreBody, info: false })
  if (!a && (mode === 'delete' || mode === 'copyDelete')) leads.push({ text: REMOVAL.noActive, info: false })
  if (!a && mode === 'restore') leads.push({ text: REMOVAL.noActiveRestore, info: false })

  const gone: RemovalLine[] = []
  if (archived.length) gone.push({ text: REMOVAL.goneScenarios(archived.length), sub: titles(archived) })
  if (challengeLine && mode !== 'hide') gone.push(challengeLine)

  const back: RemovalLine[] = relinked.length ? [{ text: REMOVAL.relinked(relinked.length), sub: titles(relinked) }] : []

  const keep: RemovalLine[] = []
  if (p.finishedChallenges > 0) keep.push({ text: REMOVAL.keepFinished, sub: null })
  if (unlinked.length) keep.push({ text: REMOVAL.keepUnlinked(unlinked.length), sub: REMOVAL.keepUnlinkedSub })
  keep.push({ text: REMOVAL.keepRecords, sub: null })

  return { warn, leads, gone, back, keep }
}

/** 실행 버튼 글자 — 진행 중 챌린지가 함께 지워지면 「챌린지까지 …」(숨기기는 챌린지가 이어져 그대로). */
export function removalActionLabel(mode: RemovalMode, p: TopicRemovalPreview | null, busy: boolean): string {
  if (busy) return REMOVAL.busy[mode === 'copyDelete' ? 'delete' : mode]
  if (!p) return REMOVAL.checking
  if (p.activeChallenge && (mode === 'delete' || mode === 'copyDelete')) return REMOVAL.btnWithChallenge.delete
  if (p.activeChallenge && mode === 'restore') return REMOVAL.btnWithChallenge.restore
  return REMOVAL.btn[mode]
}

/** 409 `details.preview` 가 미리보기 모양인지(아니면 화면이 #172 를 다시 읽는다 — 옛 `ack` 로 다시 보내지 않게). */
export function asRemovalPreview(v: unknown): TopicRemovalPreview | null {
  if (!v || typeof v !== 'object') return null
  const p = v as Partial<TopicRemovalPreview>
  if (typeof p.ack !== 'string' || !p.ack || typeof p.title !== 'string' || typeof p.topicId !== 'string') return null
  if (!Array.isArray(p.scenariosArchived) || !Array.isArray(p.scenariosUnlinked) || typeof p.finishedChallenges !== 'number') return null
  return p as TopicRemovalPreview
}

/** #176 주제 내 버전 되돌리기 응답의 `removal`(#173 `REMOVED` 모양) — 비어 있으면 0 으로 채운다(토스트는 제목만 쓴다). */
export function restoreRemovalOf(r: RestoreSeedResult, topicId: string): TopicRemovalResult {
  const x = r.removal as Partial<TopicRemovalResult> | null
  const n = (v: unknown) => (typeof v === 'number' && v >= 0 ? v : 0)
  return {
    topicId: typeof x?.topicId === 'string' ? x.topicId : topicId,
    result: 'REMOVED',
    mode: 'RESTORE',
    challengeDeleted: x?.challengeDeleted === true,
    deletedChallengeId: typeof x?.deletedChallengeId === 'string' ? x.deletedChallengeId : null,
    scenariosArchived: n(x?.scenariosArchived),
    scenariosUnlinked: n(x?.scenariosUnlinked),
    scenariosRelinked: n(x?.scenariosRelinked),
    seedId: r.seedId,
  }
}

/**
 * 돌아왔을 때 토스트(§16-2 S2 `saved` — sessionStorage `kaiwa.manage.flash`). 제목을 URL 에 싣지 않으려고 저장소에 두고, 받는 화면이 마운트 때 한 번 읽어 지운다.
 * 저장소 값은 이 모양만 받는다 — 문구는 늘 `topicCopy.ts` 고정 문구 + 제목이다.
 */
export const MANAGE_FLASH_KEY = 'kaiwa.manage.flash'

export type ManageFlash =
  | { kind: 'removed'; title: string; scenarios: number; challenge: boolean }
  | { kind: 'copyRemoved' | 'hidden' | 'restored'; title: string }
  | { kind: 'gone' | 'notOverridden' }

/** 결과 숫자는 응답 값(미리보기 아님 — `ack` 는 진행 중 챌린지만 덮어 상황 수는 바뀔 수 있다). */
export function removalFlash(mode: RemovalMode, title: string, r: TopicRemovalResult): ManageFlash {
  if (mode === 'restore') return { kind: 'restored', title }
  if (mode === 'hide' || r.result === 'HIDDEN') return { kind: 'hidden', title }
  if (mode === 'copyDelete') return { kind: 'copyRemoved', title }
  return { kind: 'removed', title, scenarios: r.scenariosArchived, challenge: r.challengeDeleted }
}

export function parseFlash(raw: string | null): ManageFlash | null {
  if (!raw) return null
  let v: unknown
  try {
    v = JSON.parse(raw)
  } catch {
    return null
  }
  if (!v || typeof v !== 'object') return null
  const f = v as Record<string, unknown>
  if (f.kind === 'gone' || f.kind === 'notOverridden') return { kind: f.kind }
  if (typeof f.title !== 'string' || !f.title.trim() || f.title.length > 200) return null
  if (f.kind === 'copyRemoved' || f.kind === 'hidden' || f.kind === 'restored') return { kind: f.kind, title: f.title }
  if (f.kind === 'removed') {
    const s = typeof f.scenarios === 'number' && Number.isInteger(f.scenarios) && f.scenarios >= 0 ? f.scenarios : 0
    return { kind: 'removed', title: f.title, scenarios: s, challenge: f.challenge === true }
  }
  return null
}

export function flashText(f: ManageFlash): string {
  switch (f.kind) {
    case 'removed':
      return TOAST.removed(f.title, f.scenarios, f.challenge)
    case 'copyRemoved':
      return TOAST.copyRemoved(f.title)
    case 'hidden':
      return TOAST.hidden(f.title)
    case 'restored':
      return TOAST.restored(f.title)
    case 'gone':
      return REMOVAL.gone
    case 'notOverridden':
      return FAIL.notOverridden
  }
}

/** 지우기·숨기기 뒤 관리 화면에서 초점을 목록 머리(「내가 만든 주제」)로 옮길지. */
export const flashFocusesList = (f: ManageFlash): boolean => f.kind !== 'restored'

