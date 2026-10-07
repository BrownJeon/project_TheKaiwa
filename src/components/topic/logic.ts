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
// T5-3a 주제 만들기(아래 구역)가 쓰는 것.
import { isAbort } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import { cpLength } from '@/components/common/format'
import { DRAFT_LEVELS, oneLine, type DraftLevel } from '@/components/scenario/logic'
import type { JlptLevel } from '@/types/lesson'
import type { TopicChunkType } from '@/types/topic'
import { TOPIC_SAVE_LIMITS, type TopicCreateInput, type TopicDraftRequestBody, type TopicWarningCode } from '@/types/topicWrite'
import { failureCopy, TOPIC_ASK_TITLE_MAX, TOPIC_ASK_TITLE_MIN, type Failure, type FieldFailure } from './failure'
import { CREATE, REVIEW } from './topicCopy'
import type { TopicUpdateInput } from '@/types/topicWrite'
import { EDIT } from './topicCopy'

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
  /** T5-3a 주제 만들기 저장 뒤 새 주제 보기(S6)가 읽는다. */
  | { kind: 'created'; title: string }
  /** T5-4 주제 고치기 저장 뒤 주제 보기(S6)가 읽는다 — 내 주제·내 버전(#171) · 기본 주제를 내 버전으로(#174, 사본 id 의 S6). */
  | { kind: 'saved' | 'copySaved' }

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
  if (f.kind === 'saved' || f.kind === 'copySaved') return { kind: f.kind }
  if (typeof f.title !== 'string' || !f.title.trim() || f.title.length > 200) return null
  if (f.kind === 'copyRemoved' || f.kind === 'hidden' || f.kind === 'restored') return { kind: f.kind, title: f.title }
  if (f.kind === 'created') return { kind: 'created', title: f.title }
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
    case 'created':
      return TOAST.created(f.title, 0)
    case 'saved':
      return TOAST.saved
    case 'copySaved':
      return TOAST.copySaved
  }
}

/** 지우기·숨기기 뒤 관리 화면에서 초점을 목록 머리(「내가 만든 주제」)로 옮길지. */
export const flashFocusesList = (f: ManageFlash): boolean => f.kind !== 'restored'

/* ───────── T5-3a 주제 만들기(S3 묻기·S4 검토·#57 저장) — 편집 값·검사·요청 본문·이 탭 보관·요청 흐름 ───────── */

export const TOPIC_DRAFT_STORE_KEY = 'kaiwa.topic.draft'
export const TOPIC_DRAFT_STORE_VERSION = 1
export const TOPIC_DRAFT_LONG_MS = 15_000
/** 벽시계 상한(§16-2 S3 「60초」 — 서버 예산 40초 + 여유). */
export const TOPIC_DRAFT_TIMEOUT_MS = 60_000
/** 요청 직후 이 시간 동안은 [그만두기] 가 듣지 않는다 — 더블 탭의 둘째 탭이 방금 시작한 요청을 끊으면 서버는 계속 돌아 한도만 쓴다(`scenario/openingFlight.ts` 와 같은 규칙). */
export const TOPIC_DRAFT_CANCEL_LOCK_MS = 800
/** 서버 안내 기준(`TOPIC_DRAFT_LIMITS.chunksTarget`·`perTypeMin`) — 「확인해 볼 곳」 줄이 고쳐졌는지 볼 때만 쓴다(저장은 막지 않는다). */
export const TOPIC_CHUNKS_TARGET = 12
export const TOPIC_TYPE_MIN = 2

const CHUNK_TYPES: readonly TopicChunkType[] = TOPIC_CHUNK_TYPES
const JLPT: readonly JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']

export interface TopicAsk {
  title: string
  level: DraftLevel
}

/** 편집 중 표현 한 개 — `key` 는 화면 안에서만 쓰는 고정 열쇠(목록 `key`·칸 id), 서버로 보내지 않는다. */
export interface EditableChunk {
  key: string
  /** S7 주제 고치기(T5-4)에서만 — 서버가 준 표현 id 그대로(화면이 만들지 않는다). #57·#174 본문에는 싣지 않는다. */
  id?: string
  chunkType: TopicChunkType
  textJa: string
  reading: string
  meaningKo: string
}

export interface EditableTopicDraft {
  title: string
  titleJa: string
  level: JlptLevel
  description: string
  /** 배열 순서 = 저장 순서. 화면은 종류 4묶음으로 나눠 보인다(묶음 안은 이 순서). */
  chunks: EditableChunk[]
}

export type ChunkField = 'textJa' | 'reading' | 'meaningKo'
export type ChunkValues = Omit<EditableChunk, 'key'>

/** 저장 전 문제 — `key` 는 `title`·`titleJa`·`level`·`description`·`chunks`·`chunk:<열쇠>:<칸>`. */
export interface TopicProblem {
  key: string
  message: string
}

const isJlpt = (v: unknown): v is JlptLevel => typeof v === 'string' && (JLPT as readonly string[]).includes(v)
const isChunkType = (v: unknown): v is TopicChunkType => typeof v === 'string' && (CHUNK_TYPES as readonly string[]).includes(v)

/** S3 주제 한 줄 검사(#170 2~40자). */
export function topicAskProblem(title: string): string | null {
  const n = cpLength(oneLine(title))
  if (n < TOPIC_ASK_TITLE_MIN) return CREATE.short
  if (n > TOPIC_ASK_TITLE_MAX) return CREATE.long
  return null
}

/** #170 본문 — `note` 칸은 화면에 없다. */
export function topicAskBody(ask: TopicAsk): TopicDraftRequestBody {
  return { title: oneLine(ask.title), level: ask.level }
}

export const chunkKeyOf = (n: number): string => `c${n}`

export function nextChunkKey(chunks: readonly EditableChunk[]): string {
  let max = 0
  for (const c of chunks) {
    const m = /^c(\d+)$/.exec(c.key)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return chunkKeyOf(max + 1)
}

const TOPIC_WARNING_CODES: readonly TopicWarningCode[] = [
  'CHUNKS_SHORT',
  'TYPE_THIN_NAME',
  'TYPE_THIN_ACTION',
  'TYPE_THIN_FEELING',
  'TYPE_THIN_MODIFIER',
  'DESCRIPTION_MISSING',
  'TITLE_JA_MISSING',
  'TITLE_TRUNCATED',
]
const isWarningCode = (v: unknown): v is TopicWarningCode => typeof v === 'string' && (TOPIC_WARNING_CODES as readonly string[]).includes(v)

/** #170 응답 → 편집 값. 모양이 어긋나면 null(화면은 일시 실패로 다룬다). 쓸 수 없는 표현 한 개는 버리지 않고 그대로 둔다 — 저장 검사가 그 행을 짚는다. */
export function topicDraftFromResponse(raw: unknown): { draft: EditableTopicDraft; warnings: TopicWarningCode[] } | null {
  const d = (raw as { draft?: unknown } | null)?.draft as Record<string, unknown> | undefined
  if (!d || typeof d !== 'object') return null
  if (typeof d.title !== 'string' || !isJlpt(d.level) || !Array.isArray(d.chunks)) return null
  const chunks: EditableChunk[] = []
  for (const c of d.chunks as unknown[]) {
    const o = c as Record<string, unknown> | null
    if (!o || !isChunkType(o.chunkType) || typeof o.textJa !== 'string' || typeof o.reading !== 'string' || typeof o.meaningKo !== 'string') return null
    chunks.push({ key: chunkKeyOf(chunks.length + 1), chunkType: o.chunkType, textJa: o.textJa, reading: o.reading, meaningKo: o.meaningKo })
  }
  const warnings = Array.isArray((raw as { warnings?: unknown }).warnings) ? ((raw as { warnings: unknown[] }).warnings.filter(isWarningCode) as TopicWarningCode[]) : []
  return {
    draft: {
      title: d.title,
      titleJa: typeof d.titleJa === 'string' ? d.titleJa : '',
      level: d.level,
      description: typeof d.description === 'string' ? d.description : '',
      chunks,
    },
    warnings,
  }
}

/** #57 본문 — `chunks[].id`·화면 열쇠·`order` 는 보내지 않는다(배열 순서가 순서, 새 주제에 `id` 를 보내면 400). */
export function topicCreateBody(d: EditableTopicDraft): TopicCreateInput {
  const titleJa = oneLine(d.titleJa)
  const description = oneLine(d.description)
  return {
    title: oneLine(d.title),
    titleJa: titleJa || null,
    level: d.level,
    description: description || null,
    chunks: d.chunks.map((c) => ({ chunkType: c.chunkType, textJa: c.textJa.trim(), reading: c.reading.trim(), meaningKo: c.meaningKo.trim() })),
  }
}

/* 서버 검사(`topicDraftSchemas.ts` `checkTopicChunkFields`·`saveBody.ts`)와 같은 문자 종류 — components 는 `@/modules` 를 읽지 못해 옮겨 적고, `topicDraft.test.ts` 가 서버 함수와 같은 표로 대조한다.
   숨은·제어 글자·비밀 모양·읽기와 표기의 어긋남은 서버만 본다(400 → `failure.ts` 칸 문구). */
const KANA_CLASS = '\\u3041-\\u3096\\u30A1-\\u30FA\\u30FC'
const KANJI_CLASS = '\\u3005\\u3006\\u3400-\\u4DBF\\u4E00-\\u9FFF'
const SURFACE_ALLOWED = new RegExp(`^[${KANA_CLASS}\\u30FB${KANJI_CLASS}0-9０-９〜]+$`)
const SURFACE_HAS_LETTER = new RegExp(`[${KANA_CLASS}${KANJI_CLASS}]`)
const READING_ALLOWED = new RegExp(`^[${KANA_CLASS}\\u30FB]+$`)
const KANA_ANY = /[ぁ-ゖァ-ヺ]/
const HANGUL = /[가-힣]/
const JA_CHAR = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u
const URL_LIKE = /[a-z][a-z0-9+.-]{1,15}:\/\/|\bwww\.|\bjavascript:/i
const MARKUP = /[<>＜＞]/

const blocked = (s: string): boolean => {
  const t = s.normalize('NFKC')
  return MARKUP.test(t) || URL_LIKE.test(t)
}
const surfaceKey = (s: string) => s.normalize('NFKC').replace(/[\s　、。，．,.!！?？・「」『』〜~…]/g, '')
const meaningKey = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[\s.,!?~·()（）、。，…-]/g, '')

/** 표현 한 개의 칸 검사(중복은 `others` — 같은 주제의 다른 표현). 칸마다 첫 문제 하나. */
export function chunkFieldProblems(v: ChunkValues, others: readonly ChunkValues[] = []): Partial<Record<ChunkField, string>> {
  const L = TOPIC_SAVE_LIMITS
  const out: Partial<Record<ChunkField, string>> = {}
  const ja = v.textJa.trim()
  const rd = v.reading.trim()
  const mk = v.meaningKo.trim()
  if (!ja) out.textJa = FAIL.field.required('textJa')
  else if (cpLength(ja) > L.textJaMax) out.textJa = FAIL.field.max('textJa', L.textJaMax)
  else if (blocked(ja)) out.textJa = FAIL.field.forbiddenChar
  else if (HANGUL.test(ja) || !SURFACE_HAS_LETTER.test(ja)) out.textJa = FAIL.field.notJapanese
  else if (!SURFACE_ALLOWED.test(ja)) out.textJa = FAIL.field.chars
  else if (others.some((o) => surfaceKey(o.textJa.trim()) === surfaceKey(ja))) out.textJa = FAIL.field.duplicate
  if (!rd) out.reading = FAIL.field.required('reading')
  else if (cpLength(rd) > L.readingMax) out.reading = FAIL.field.max('reading', L.readingMax)
  else if (!READING_ALLOWED.test(rd) || !KANA_ANY.test(rd)) out.reading = FAIL.field.reading
  if (!mk) out.meaningKo = FAIL.field.required('meaningKo')
  else if (cpLength(mk) > L.meaningMax) out.meaningKo = FAIL.field.max('meaningKo', L.meaningMax)
  else if (blocked(mk)) out.meaningKo = FAIL.field.forbiddenChar
  else if (!HANGUL.test(mk) || KANA_ANY.test(mk)) out.meaningKo = FAIL.field.noHangul
  else if (others.some((o) => meaningKey(o.meaningKo.trim()) === meaningKey(mk))) out.meaningKo = FAIL.field.duplicate
  return out
}

export const chunkProblemKey = (chunkKey: string, field: ChunkField): string => `chunk:${chunkKey}:${field}`
const CHUNK_FIELDS: readonly ChunkField[] = ['textJa', 'reading', 'meaningKo']

/** 종류 4묶음(이름·액션·느낌·꾸밈 순, 묶음 안은 배열 순서) — 빈 묶음은 뺀다. */
export function chunkGroupsOf(chunks: readonly EditableChunk[]): { type: TopicChunkType; items: EditableChunk[] }[] {
  return CHUNK_TYPES.map((type) => ({ type, items: chunks.filter((c) => c.chunkType === type) })).filter((g) => g.items.length > 0)
}

/** 저장 전 검사 — 화면 위에서 아래 순서(주제 정보 → 표현 개수 → 묶음 순서의 표현). 중복은 앞(배열 순서) 표현을 두고 뒤 표현을 짚는다. */
export function validateTopicDraft(d: EditableTopicDraft): TopicProblem[] {
  const L = TOPIC_SAVE_LIMITS
  const out: TopicProblem[] = []
  const title = oneLine(d.title)
  if (cpLength(title) < L.titleMin) out.push({ key: 'title', message: FAIL.field.required('title') })
  else if (cpLength(title) > L.titleMax) out.push({ key: 'title', message: FAIL.field.max('title', L.titleMax) })
  else if (blocked(title)) out.push({ key: 'title', message: FAIL.field.forbiddenChar })
  const titleJa = oneLine(d.titleJa)
  if (titleJa) {
    if (cpLength(titleJa) > L.titleJaMax) out.push({ key: 'titleJa', message: FAIL.field.max('titleJa', L.titleJaMax) })
    else if (blocked(titleJa)) out.push({ key: 'titleJa', message: FAIL.field.forbiddenChar })
    else if (!JA_CHAR.test(titleJa) || HANGUL.test(titleJa)) out.push({ key: 'titleJa', message: FAIL.field.notJapanese })
  }
  if (!isJlpt(d.level)) out.push({ key: 'level', message: FAIL.field.enum })
  const desc = oneLine(d.description)
  if (cpLength(desc) > L.descriptionMax) out.push({ key: 'description', message: FAIL.field.max('description', L.descriptionMax) })
  else if (desc && blocked(desc)) out.push({ key: 'description', message: FAIL.field.forbiddenChar })
  const n = d.chunks.length
  if (n < L.chunksMin || n > L.chunksMax) out.push({ key: 'chunks', message: FAIL.field.count(n) })
  const index = new Map(d.chunks.map((c, i) => [c.key, i]))
  for (const g of chunkGroupsOf(d.chunks)) {
    for (const c of g.items) {
      const i = index.get(c.key) ?? 0
      const found = chunkFieldProblems(c, d.chunks.slice(0, i))
      for (const f of CHUNK_FIELDS) if (found[f]) out.push({ key: chunkProblemKey(c.key, f), message: found[f] as string })
    }
  }
  return out
}

/** 400 칸 문제(`failure.ts` 가 고른 고정 문구) → 화면 칸 열쇠. `chunks[i]` 는 보낸 배열 순서 = `d.chunks` 순서. 화면 결함(모양 오류)은 `defect` 로 따로. */
export function serverTopicProblems(problems: readonly FieldFailure[], d: EditableTopicDraft): { problems: TopicProblem[]; defect: boolean } {
  const out: TopicProblem[] = []
  let defect = false
  for (const p of problems) {
    if (p.defect) {
      defect = true
      continue
    }
    // 칸 이름 없는 `chunks[i]`(서버 `engine_name` — 세 칸 중 어느 칸인지 서버만 안다)도 그 행의 첫 칸에 붙인다 — 안 그러면 고칠 행을 모른 채 같은 400 을 반복한다.
    const m = /^chunks\[(\d+)\](?:\.(textJa|reading|meaningKo|chunkType))?$/.exec(p.field)
    if (m) {
      const c = d.chunks[Number(m[1])]
      const f: ChunkField = m[2] === undefined || m[2] === 'chunkType' ? 'textJa' : (m[2] as ChunkField)
      out.push({ key: c ? chunkProblemKey(c.key, f) : 'chunks', message: p.text })
    } else if (p.field === 'title' || p.field === 'titleJa' || p.field === 'description' || p.field === 'level' || p.field === 'chunks') {
      out.push({ key: p.field, message: p.text })
    } else defect = true
  }
  return { problems: out, defect }
}

/** 문제 열쇠 → 화면 요소 id(초점 대상). 표현 칸 문제는 칸이 접혀 있으면 그 행의 ⋯ 버튼(`chunkRowDomId`)으로 떨어진다. */
export const topicProblemDomId = (key: string): string => `tp-${key.replace(/:/g, '-')}`
export const chunkRowDomId = (chunkKey: string): string => `tp-row-${chunkKey}`
export const chunkKeyOfProblem = (key: string): string | null => /^chunk:([^:]+):/.exec(key)?.[1] ?? null

/** 같은 종류 안에서 위(-1)·아래(+1)로 — 바로 앞·뒤 같은 종류 표현과 배열 자리를 바꾼다. 움직일 수 없으면 같은 배열. */
export function chunkMove(chunks: readonly EditableChunk[], key: string, dir: -1 | 1): EditableChunk[] {
  const i = chunks.findIndex((c) => c.key === key)
  if (i < 0) return [...chunks]
  let j = i + dir
  while (j >= 0 && j < chunks.length && chunks[j].chunkType !== chunks[i].chunkType) j += dir
  if (j < 0 || j >= chunks.length) return [...chunks]
  const next = [...chunks]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

export function chunkCanMove(chunks: readonly EditableChunk[], key: string, dir: -1 | 1): boolean {
  const type = chunks.find((x) => x.key === key)?.chunkType
  const same = chunks.filter((c) => c.chunkType === type)
  const i = same.findIndex((c) => c.key === key)
  return i >= 0 && (dir < 0 ? i > 0 : i < same.length - 1)
}

/** 지운 뒤 초점을 둘 이웃(같은 묶음의 다음 → 앞, 없으면 null — 화면이 [＋ 표현 더하기]로). */
export function chunkNeighborKey(chunks: readonly EditableChunk[], key: string): string | null {
  const type = chunks.find((c) => c.key === key)?.chunkType
  const same = chunks.filter((c) => c.chunkType === type)
  const i = same.findIndex((c) => c.key === key)
  if (i < 0) return null
  return same[i + 1]?.key ?? same[i - 1]?.key ?? null
}

/** 고치기 [바꾸기] — 있는 열쇠면 그 자리를 바꾸고(종류가 바뀌면 새 묶음의 끝 순서로 보인다), 없으면 끝에 더한다. */
export function chunkUpsert(chunks: readonly EditableChunk[], c: EditableChunk): EditableChunk[] {
  const i = chunks.findIndex((x) => x.key === c.key)
  if (i < 0) return [...chunks, c]
  const next = [...chunks]
  next[i] = c
  return next
}

/** 「확인해 볼 곳」 한 줄(§16-2 S4·v2 E) — 저장을 막지 않는다. `target` = 누르면 초점을 옮길 칸. */
export interface WarnLine {
  code: 'TITLE_TRUNCATED' | 'TITLE_JA_MISSING' | 'DESCRIPTION_MISSING' | 'CHUNKS_SHORT' | 'TYPE_THIN'
  text: string
  target: 'title' | 'titleJa' | 'description' | 'chunks'
  types: TopicChunkType[]
}

/** 도착 때 한 번 만든다(숫자는 도착 때 값). 여러 종류가 모자라면 한 줄로 묶는다. 화면 순서 = 칸 순서. */
export function topicWarnLines(codes: readonly TopicWarningCode[], d: EditableTopicDraft): WarnLine[] {
  const has = (c: TopicWarningCode) => codes.includes(c)
  const out: WarnLine[] = []
  if (has('TITLE_TRUNCATED')) out.push({ code: 'TITLE_TRUNCATED', text: REVIEW.warn.TITLE_TRUNCATED, target: 'title', types: [] })
  if (has('TITLE_JA_MISSING')) out.push({ code: 'TITLE_JA_MISSING', text: REVIEW.warn.TITLE_JA_MISSING, target: 'titleJa', types: [] })
  if (has('DESCRIPTION_MISSING')) out.push({ code: 'DESCRIPTION_MISSING', text: REVIEW.warn.DESCRIPTION_MISSING, target: 'description', types: [] })
  if (has('CHUNKS_SHORT')) out.push({ code: 'CHUNKS_SHORT', text: REVIEW.warn.CHUNKS_SHORT(d.chunks.length), target: 'chunks', types: [] })
  const thin = CHUNK_TYPES.filter((t) => has(`TYPE_THIN_${t}` as TopicWarningCode))
  if (thin.length) {
    const n = Math.max(...thin.map((t) => d.chunks.filter((c) => c.chunkType === t).length))
    out.push({ code: 'TYPE_THIN', text: REVIEW.warn.TYPE_THIN(thin, n), target: 'chunks', types: thin })
  }
  return out
}

/** 줄이 고쳐졌는지(줄은 사라지지 않고 「✓ 고쳤어요」로 바뀐다 — R2). */
export function warnLineFixed(w: WarnLine, d: EditableTopicDraft, arrivalTitle: string): boolean {
  switch (w.code) {
    case 'TITLE_TRUNCATED':
      return oneLine(d.title) !== oneLine(arrivalTitle)
    case 'TITLE_JA_MISSING':
      return oneLine(d.titleJa) !== ''
    case 'DESCRIPTION_MISSING':
      return oneLine(d.description) !== ''
    case 'CHUNKS_SHORT':
      return d.chunks.length >= TOPIC_CHUNKS_TARGET
    case 'TYPE_THIN':
      return w.types.every((t) => d.chunks.filter((c) => c.chunkType === t).length >= TOPIC_TYPE_MIN)
  }
}

/** 이 탭 보관 모양(§16-4) — 초안 본문과 입력값뿐(토큰·응답 원문·서버 문구 없음). T5-3b 가 상황 초안 칸을 더한다. */
export interface StoredTopicDraft {
  version: typeof TOPIC_DRAFT_STORE_VERSION
  /** 이 초안의 주인(내부 사용자 id) — 읽을 때 지금 사용자와 같을 때만 쓴다(REV-162 M-1: 같은 탭에서 계정을 바꿔도 남의 초안이 보이지 않게). 화면에는 나오지 않는다. */
  userId: string
  ask: TopicAsk
  draft: EditableTopicDraft | null
  warnings: TopicWarningCode[]
  /** `TITLE_TRUNCATED` 줄이 고쳐졌는지 볼 기준(도착 때 이름). */
  arrivalTitle: string
  edited: boolean
  savedAt: number
}

const STORE_TEXT_MAX = 400
const STORE_CHUNKS_MAX = 40
const okText = (v: unknown): v is string => typeof v === 'string' && v.length <= STORE_TEXT_MAX

export function serializeTopicStore(s: Omit<StoredTopicDraft, 'version'>): string {
  return JSON.stringify({ version: TOPIC_DRAFT_STORE_VERSION, ...s })
}

export function isBlankTopicStore(s: Pick<StoredTopicDraft, 'ask' | 'draft'>): boolean {
  return !s.draft && oneLine(s.ask.title) === ''
}

/** 이 탭에 남은 초안 — 모양이 하나라도 어긋나면 통째로 버린다(다른 판의 값·손댄 값). 주인(`userId`)이 지금 사용자와 다르거나 없으면(옛 형식) 같다. */
export function parseTopicStore(raw: string | null, userId: string): StoredTopicDraft | null {
  if (!raw || !userId) return null
  let v: unknown
  try {
    v = JSON.parse(raw)
  } catch {
    return null
  }
  const s = v as Record<string, unknown> | null
  if (!s || typeof s !== 'object' || s.version !== TOPIC_DRAFT_STORE_VERSION || s.userId !== userId) return null
  const ask = s.ask as Record<string, unknown> | null
  if (!ask || !okText(ask.title) || !(DRAFT_LEVELS as readonly string[]).includes(ask.level as string)) return null
  let draft: EditableTopicDraft | null = null
  if (s.draft !== null && s.draft !== undefined) {
    const d = s.draft as Record<string, unknown>
    if (typeof d !== 'object' || !okText(d.title) || !okText(d.titleJa) || !okText(d.description) || !isJlpt(d.level)) return null
    if (!Array.isArray(d.chunks) || d.chunks.length > STORE_CHUNKS_MAX) return null
    const chunks: EditableChunk[] = []
    const keys = new Set<string>()
    for (const c of d.chunks as unknown[]) {
      const o = c as Record<string, unknown> | null
      if (!o || typeof o.key !== 'string' || !/^c\d{1,4}$/.test(o.key) || keys.has(o.key) || !isChunkType(o.chunkType)) return null
      if (!okText(o.textJa) || !okText(o.reading) || !okText(o.meaningKo)) return null
      keys.add(o.key)
      chunks.push({ key: o.key, chunkType: o.chunkType, textJa: o.textJa, reading: o.reading, meaningKo: o.meaningKo })
    }
    draft = { title: d.title, titleJa: d.titleJa, level: d.level, description: d.description, chunks }
  }
  const warnings = Array.isArray(s.warnings) ? (s.warnings.filter(isWarningCode) as TopicWarningCode[]) : []
  return {
    version: TOPIC_DRAFT_STORE_VERSION,
    userId,
    ask: { title: ask.title, level: ask.level as DraftLevel },
    draft,
    warnings,
    arrivalTitle: okText(s.arrivalTitle) ? s.arrivalTitle : '',
    edited: s.edited === true,
    savedAt: typeof s.savedAt === 'number' ? s.savedAt : 0,
  }
}

/** 읽기 한 번의 결정 — 보관 값이 있는데 이 사용자 것이 아니거나 못 읽으면 지운다(`discard`). 다른 사용자·옛 형식·손상 모두 같은 길이다. */
export function readTopicStore(raw: string | null, userId: string): { store: StoredTopicDraft | null; discard: boolean } {
  const store = parseTopicStore(raw, userId)
  return { store, discard: !!raw && !store }
}

/** #170 요청 한 건의 흐름 — React 를 모르는 제어기(시험 가능). 한 번에 하나(409 `DRAFT_BUSY` 도 한도를 쓴다)·취소 잠금·15초 `long`·벽시계 상한. */
export interface TopicDraftFlightState {
  busy: boolean
  /** 만드는 중이고 취소 잠금이 지났을 때만. */
  cancelable: boolean
  long: boolean
}
export const TOPIC_DRAFT_IDLE: TopicDraftFlightState = { busy: false, cancelable: false, long: false }

export type TopicDraftOutcome =
  | { kind: 'ok'; draft: EditableTopicDraft; warnings: TopicWarningCode[] }
  | { kind: 'fail'; failure: Failure }
  | { kind: 'canceled' }

export interface TopicDraftFlightDeps {
  post: (body: TopicDraftRequestBody, signal: AbortSignal) => Promise<unknown>
  onState: (s: TopicDraftFlightState) => void
  timers?: { set: (fn: () => void, ms: number) => unknown; clear: (handle: unknown) => void }
}

export interface TopicDraftFlight {
  /** 요청 중이면 false(아무것도 보내지 않는다). */
  start: (body: TopicDraftRequestBody, onDone: (o: TopicDraftOutcome) => void) => boolean
  /** 취소 잠금이 지난 요청만 끊는다. */
  cancel: () => void
  /** 화면이 사라질 때 — 요청·타이머 정리(결과를 알리지 않는다). */
  dispose: () => void
}

const SYNTH_TIMEOUT = { status: 504, message: '', code: null, details: {}, retryAfterSec: null }
const SYNTH_BAD_SHAPE = { status: 502, message: '', code: null, details: {}, retryAfterSec: null }

export function createTopicDraftFlight(deps: TopicDraftFlightDeps): TopicDraftFlight {
  const timers = deps.timers ?? { set: (fn: () => void, ms: number) => setTimeout(fn, ms), clear: (h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>) }
  type Run = { ac: AbortController; handles: unknown[]; timedOut: boolean; cancelable: boolean; onDone: (o: TopicDraftOutcome) => void }
  let cur: Run | null = null
  let state = TOPIC_DRAFT_IDLE
  const emit = (next: Partial<TopicDraftFlightState>) => {
    state = { ...state, ...next }
    deps.onState(state)
  }
  const release = (run: Run) => {
    run.handles.forEach((h) => timers.clear(h))
    run.handles = []
    if (cur === run) cur = null
  }
  const finish = (run: Run, o: TopicDraftOutcome) => {
    release(run)
    emit({ busy: false, cancelable: false, long: false })
    run.onDone(o)
  }
  return {
    start(body, onDone) {
      if (cur) return false
      const run: Run = { ac: new AbortController(), handles: [], timedOut: false, cancelable: false, onDone }
      cur = run
      run.handles.push(
        timers.set(() => {
          run.cancelable = true
          if (cur === run) emit({ cancelable: true })
        }, TOPIC_DRAFT_CANCEL_LOCK_MS),
        timers.set(() => {
          if (cur === run) emit({ long: true })
        }, TOPIC_DRAFT_LONG_MS),
        timers.set(() => {
          run.timedOut = true
          run.ac.abort()
        }, TOPIC_DRAFT_TIMEOUT_MS),
      )
      emit({ busy: true, cancelable: false, long: false })
      deps.post(body, run.ac.signal).then(
        (raw) => {
          if (cur !== run) return
          const r = topicDraftFromResponse(raw)
          if (!r) finish(run, { kind: 'fail', failure: failureCopy('topicDraft', SYNTH_BAD_SHAPE) })
          else finish(run, { kind: 'ok', draft: r.draft, warnings: r.warnings })
        },
        (e: unknown) => {
          if (cur !== run) return
          if (run.timedOut) return finish(run, { kind: 'fail', failure: failureCopy('topicDraft', SYNTH_TIMEOUT) })
          if (isAbort(e)) return finish(run, { kind: 'canceled' })
          finish(run, { kind: 'fail', failure: failureCopy('topicDraft', toErr(e)) })
        },
      )
      return true
    },
    cancel() {
      const run = cur
      if (!run || !run.cancelable) return
      release(run)
      run.ac.abort()
      emit({ busy: false, cancelable: false, long: false })
      run.onDone({ kind: 'canceled' })
    },
    dispose() {
      const run = cur
      if (!run) return
      release(run)
      run.ac.abort()
    },
  }
}

/** 저장(#57) 한 번에 하나 — 더블 탭의 둘째 탭은 요청을 만들지 않는다. `run` 이 false 면 이미 도는 중. */
export function createOnceGuard(): { run: (fn: () => Promise<void>) => boolean; busy: () => boolean } {
  let busy = false
  return {
    run(fn) {
      if (busy) return false
      busy = true
      void fn().finally(() => {
        busy = false
      })
      return true
    },
    busy: () => busy,
  }
}

/* ───────── T5-4 주제 고치기(S7) — 저장 경로·바뀐 칸 본문(#171)·내 버전 본문(#174)·수준 바꿈 표현 다시 받기(D4-A)·저장 결과 ───────── */

export type TopicEditRoute = 'patch' | 'fork'

/** 저장 경로 — 내 주제·내 버전은 #171(보낸 칸만), 기본 주제는 #174(전체 값으로 내 버전 만들기). 출처는 `topicOrigin`(#56 `isSeed` + #179 사본 id)이 정한다. */
export function topicEditRoute(origin: Origin): TopicEditRoute {
  return origin === 'SEED' ? 'fork' : 'patch'
}

/** #56 항목 → 편집 값. 표현은 서버 `order` 순, 화면 열쇠는 c1..cN, `id` 는 서버 값 그대로(읽기가 없는 옛 행은 빈 글 — 그 표현을 보낼 때 저장 검사가 짚는다). */
export function topicEditFrom(t: Pick<Topic, 'title' | 'titleJa' | 'level' | 'description' | 'chunks'>): EditableTopicDraft {
  const sorted = [...t.chunks].sort((a, b) => a.order - b.order)
  return {
    title: t.title,
    titleJa: t.titleJa ?? '',
    level: t.level,
    description: t.description ?? '',
    chunks: sorted.map((c, i) => ({ key: chunkKeyOf(i + 1), id: c.id, chunkType: c.chunkType, textJa: c.textJa, reading: c.reading ?? '', meaningKo: c.meaningKo })),
  }
}

const sameChunk = (a: EditableChunk, b: EditableChunk): boolean =>
  a.id === b.id && a.chunkType === b.chunkType && a.textJa.trim() === b.textJa.trim() && a.reading.trim() === b.reading.trim() && a.meaningKo.trim() === b.meaningKo.trim()

/**
 * #171 본문 — 바뀐 칸만. 표현이 하나라도 바뀌면(순서·더함·지움 포함) 지금 목록 전체를 보낸다: 원래 있던 표현은 서버가 준 `id` 그대로, 새 표현(더한 것·다시 받은 것)은
 * `id` 없이, 지운 표현은 목록에서 빠진다. `id` 는 원본에 있던 값만 싣는다(화면이 id 를 만들지 않는다). 글(`textJa`)을 바꾼 표현은 서버가 옛 행을 지우고 새 id 를 준다.
 * 바뀐 게 없으면 null(서버를 부르지 않는다).
 */
export function topicEditPatch(orig: EditableTopicDraft, cur: EditableTopicDraft): TopicUpdateInput | null {
  const out: TopicUpdateInput = {}
  if (oneLine(cur.title) !== oneLine(orig.title)) out.title = oneLine(cur.title)
  if (oneLine(cur.titleJa) !== oneLine(orig.titleJa)) out.titleJa = oneLine(cur.titleJa) || null
  if (cur.level !== orig.level) out.level = cur.level
  if (oneLine(cur.description) !== oneLine(orig.description)) out.description = oneLine(cur.description) || null
  const same = cur.chunks.length === orig.chunks.length && cur.chunks.every((c, i) => sameChunk(c, orig.chunks[i]))
  if (!same) {
    const known = new Set(orig.chunks.map((c) => c.id).filter((v): v is string => !!v))
    out.chunks = cur.chunks.map((c) => ({
      ...(c.id && known.has(c.id) ? { id: c.id } : {}),
      chunkType: c.chunkType,
      textJa: c.textJa.trim(),
      reading: c.reading.trim(),
      meaningKo: c.meaningKo.trim(),
    }))
  }
  return Object.keys(out).length ? out : null
}

export const isTopicEdited = (orig: EditableTopicDraft, cur: EditableTopicDraft): boolean => topicEditPatch(orig, cur) !== null

/** #174 본문 — #57 과 같은 전체 값(`id` 없음 — 사본은 새 표현 행이라 진행이 0부터). */
export const topicForkBody = (cur: EditableTopicDraft): TopicUpdateInput => topicCreateBody(cur)

const INFO_KEYS: ReadonlySet<string> = new Set(['title', 'titleJa', 'level', 'description'])
const isChunkProblem = (key: string): boolean => key === 'chunks' || key.startsWith('chunk:')

/**
 * 저장 전 검사(T5-3a 규칙 그대로). #171 은 보낸 칸만 서버가 보므로 보내는 칸의 문제만 짚는다 — 읽기가 빈 옛 표현 때문에 이름 고치기가 막히지 않게.
 * #174 는 전체 값을 보내므로 전부.
 */
export function validateTopicEdit(cur: EditableTopicDraft, route: TopicEditRoute, patch: TopicUpdateInput | null): TopicProblem[] {
  const all = validateTopicDraft(cur)
  if (route === 'fork') return all
  const sent = patch ?? {}
  return all.filter((p) => (isChunkProblem(p.key) ? !!sent.chunks : INFO_KEYS.has(p.key) && p.key in sent))
}

/** 400 칸 문제 → 화면 칸. `chunks[i].id` `not_found`(다른 곳에서 바뀐 표현)는 칸이 아니라 저장 줄 안내(`stale`), 그 밖의 id 문제는 화면 결함. */
export function editServerProblems(problems: readonly FieldFailure[], cur: EditableTopicDraft): { problems: TopicProblem[]; stale: boolean; defect: boolean } {
  const isId = (p: FieldFailure) => /^chunks\[\d+\]\.id$/.test(p.field)
  const ids = problems.filter(isId)
  const stale = ids.some((p) => !p.defect && p.text === FAIL.field.chunkGone)
  const s = serverTopicProblems(
    problems.filter((p) => !isId(p)),
    cur,
  )
  return { problems: s.problems, stale, defect: s.defect || ids.some((p) => p.defect || p.text !== FAIL.field.chunkGone) }
}

/** 화면이 할 일(저장 실패) — 찾을 수 없음 · 다른 탭이 먼저 내 버전을 만듦 · 기본 주제로 바꿔 다시 누르기 · 칸 문제 · 저장 줄 문구. 서버 `message` 는 쓰지 않는다. */
export interface TopicEditFailView {
  notFound: boolean
  copied: boolean
  forceSeed: boolean
  problems: TopicProblem[]
  message: { text: string; block: boolean } | null
}

export function topicEditFailView(f: Failure, cur: EditableTopicDraft): TopicEditFailView {
  const base: TopicEditFailView = { notFound: false, copied: false, forceSeed: false, problems: [], message: null }
  switch (f.kind) {
    case 'gone':
    case 'seedGone':
      return { ...base, notFound: true }
    case 'copied':
      return { ...base, copied: true }
    case 'useFork':
      return { ...base, forceSeed: true, message: { text: f.text, block: false } }
    case 'field': {
      const s = editServerProblems(f.problems, cur)
      const text = s.stale ? EDIT.chunkGone : s.defect || !s.problems.length ? FAIL.field.defect : null
      return { ...base, problems: s.problems, message: text ? { text, block: false } : null }
    }
    default:
      return { ...base, message: { text: f.text, block: f.block } }
  }
}

/** [내 버전 열기] — 다른 화면이 먼저 만든 사본 id(#179 다시 읽은 값). 없으면 null(관리 화면으로). */
export function seedCopyId(overrides: readonly SeedOverrideItem[], seedId: string): string | null {
  const o = overrides.find((x) => x.kind === 'TOPIC' && x.seedId === seedId && x.state === 'COPIED' && !x.orphan && !!x.copyId)
  return o?.copyId ?? null
}

export interface TopicEditSaveInput {
  id: string
  route: TopicEditRoute
  orig: EditableTopicDraft
  cur: EditableTopicDraft
}

export interface TopicEditApi {
  patch: (id: string, body: TopicUpdateInput) => Promise<unknown>
  fork: (id: string, body: TopicUpdateInput) => Promise<unknown>
}

export type TopicEditSaveOutcome =
  | { kind: 'unchanged' }
  | { kind: 'invalid'; problems: TopicProblem[] }
  /** `id` = 저장된 주제(#171 같은 id · #174 사본 id). 응답에서 못 읽으면 null(관리 화면으로). */
  | { kind: 'saved'; route: TopicEditRoute; id: string | null }
  | { kind: 'fail'; failure: Failure }

const idOf = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

/** 저장 한 번 — 바뀐 게 없으면 서버 0 · 검사 실패면 서버 0 · 경로대로 한 요청. 더블 탭은 화면이 `createOnceGuard` 로 막는다. */
export async function runTopicEditSave(input: TopicEditSaveInput, api: TopicEditApi): Promise<TopicEditSaveOutcome> {
  const { id, route, orig, cur } = input
  const patch = topicEditPatch(orig, cur)
  if (!patch) return { kind: 'unchanged' }
  const problems = validateTopicEdit(cur, route, patch)
  if (problems.length) return { kind: 'invalid', problems }
  try {
    if (route === 'patch') {
      const res = (await api.patch(id, patch)) as { topic?: { id?: unknown } } | null
      return { kind: 'saved', route, id: idOf(res?.topic?.id) ?? id }
    }
    const res = (await api.fork(id, topicForkBody(cur))) as { copyId?: unknown; topic?: { id?: unknown } } | null
    return { kind: 'saved', route, id: idOf(res?.copyId) ?? idOf(res?.topic?.id) }
  } catch (e) {
    return { kind: 'fail', failure: failureCopy(route === 'patch' ? 'topicEdit' : 'topicFork', toErr(e), { chunkCount: cur.chunks.length }) }
  }
}

/** 저장 뒤 주제 보기(S6)에 남길 토스트. */
export const editFlash = (route: TopicEditRoute): ManageFlash => ({ kind: route === 'fork' ? 'copySaved' : 'saved' })

/** D4-A 수준 바꿈 상자 — 지금 표현이 만들어진 수준과 고른 수준이 다르고, [지금 표현 두기]로 넘긴 수준이 아니면 보인다. */
export function levelRegenPrompt(chunksLevel: JlptLevel, curLevel: JlptLevel, keptLevel: JlptLevel | null): { from: JlptLevel; to: JlptLevel } | null {
  if (curLevel === chunksLevel || curLevel === keptLevel) return null
  return { from: chunksLevel, to: curLevel }
}

/** #170 본문 — 지금 이름 + 새 수준(이름·설명은 바꾸지 않는다). 이름이 #170 범위(2~40자) 밖이면 null(보내지 않는다). */
export function levelRegenBody(cur: Pick<EditableTopicDraft, 'title' | 'level'>): TopicDraftRequestBody | null {
  if (topicAskProblem(cur.title)) return null
  return { title: oneLine(cur.title), level: cur.level }
}

/** 다시 받은 표현 → 편집기 값. 모두 새 표현(`id` 없음 — 저장하면 옛 표현은 빠지고 연습 기록이 처음부터), 화면 열쇠는 지금 목록 다음 번호부터(열려 있던 고치기 칸이 새 행을 가리키지 않게). */
export function regenChunks(current: readonly EditableChunk[], fresh: readonly EditableChunk[]): EditableChunk[] {
  let n = Number(nextChunkKey(current).slice(1))
  return fresh.map((c) => ({ key: chunkKeyOf(n++), chunkType: c.chunkType, textJa: c.textJa, reading: c.reading, meaningKo: c.meaningKo }))
}

const CHUNK_WARNINGS: ReadonlySet<TopicWarningCode> = new Set(['CHUNKS_SHORT', 'TYPE_THIN_NAME', 'TYPE_THIN_ACTION', 'TYPE_THIN_FEELING', 'TYPE_THIN_MODIFIER'])

/** 다시 받은 표현의 「확인해 볼 곳」 — 표현 관련 안내만(이름·설명은 받지 않으므로). */
export function regenWarnLines(codes: readonly TopicWarningCode[], d: EditableTopicDraft): WarnLine[] {
  return topicWarnLines(
    codes.filter((c) => CHUNK_WARNINGS.has(c)),
    d,
  )
}

/** 표현 다시 받기 실패 문구 — 첫 줄은 늘 「표현을 받지 못했어요…」, 한도·동시 요청·맞지 않는 이름이면 그 이유를 둘째 줄로(§16-7 `TOPIC_DRAFT`). */
export function levelRegenFailLines(f: Failure): { text: string; detail: string | null; block: boolean } {
  const specific = f.kind === 'rate' || f.kind === 'daily' || f.kind === 'busy' || f.kind === 'unfit' || f.kind === 'userGone' || f.kind === 'field'
  return { text: EDIT.lvlFail, detail: specific ? f.text : null, block: f.block }
}

