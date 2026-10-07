'use client'

/**
 * 내 상황·주제(S2, screens.md §16-2 — 화면=A 분절) `/settings/scenarios?tab=topics|scenarios[&sc=<id>]`.
 * 두 탭이 `useManageData` 한 번 읽은 값을 나눠 쓴다(탭을 바꿔도 다시 읽지 않음). 탭·시트는 `router.replace(…, { scroll: false })` 로 주소만 맞춘다 —
 * 목록 `key` 바꾸기·다시 마운트·`scrollTo`·`scrollIntoView` 를 하지 않아 `main` 스크롤과 초점(누른 분절·연 카드)이 그대로다(R1~R6).
 * 출처 칩·토글은 React 상태만(주소에 싣지 않음). 딥링크 시트는 수화가 끝난 뒤에 연다(`sheetIdAfterHydration`, 회화 탭과 같은 이유).
 * 불러오는 중은 같은 높이 자리표시(IMP-0027 — 「아직 없어요」·가짜 숫자를 먼저 보이지 않는다). 주제 자리표시·빈 상자 높이는 실제 주제 행 높이
 * (`TOPIC_ROW_HEIGHT` — 근거는 `logic.ts`), 상황 탭 자리표시는 칩 44 + 카드 88.
 * 돌아왔을 때 토스트(T5-2): 주제 보기의 지우기·숨기기 뒤 sessionStorage `kaiwa.manage.flash`(마운트 때 한 번 읽고 지움 → 초점 「내가 만든 주제」 절 제목),
 * 상황 편집기 저장 뒤 `&saved=1`(한 번 보이고 주소에서 지움 — 다시 들어와도 다시 뜨지 않음), 상황 시트의 지우기·숨기기·되돌리기는 시트가 넘긴 문구 그대로.
 */
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Segmented from '@/components/common/Segmented'
import { readStore, writeStore } from '@/components/common/storage'
import Toast, { useToast } from '@/components/common/Toast'
import { Btn } from '@/components/common/ui'
import { useNativeEnv } from '@/components/common/useNativeEnv'
import { BLOCKED_FACE, BtnLink, ErrorBox, InfoBox, Skeleton } from '@/components/challenge/parts'
import { sheetIdAfterHydration } from '@/components/scenario/logic'
import PlaceChips from '@/components/scenario/PlaceChips'
import ScenarioCard from '@/components/scenario/ScenarioCard'
import ScenarioSheet from '@/components/scenario/ScenarioSheet'
import { CARD, SHEET } from '@/components/scenario/scenarioCopy'
import BackBar from '@/components/shell/BackBar'
import {
  activeChallengeBadge,
  buildScenarioRows,
  buildTopicSections,
  copyIdSet,
  filterScenarioRows,
  flashFocusesList,
  flashText,
  hiddenSeedCount,
  hiddenSeedItems,
  MANAGE_FLASH_KEY,
  manageHref,
  parseFlash,
  scenarioCountByTopic,
  SCENARIO_NEW_FROM_MANAGE_HREF,
  TOPIC_NEW_HREF,
  TOPIC_ROW_HEIGHT,
  topicLimitReached,
  type ManageTab,
  type Origin,
  type ScenarioFilter,
  type ScenarioRows,
  type TopicSections,
} from './logic'
import type { SeedOverrideItem } from '@/types/seedOverride'
import HiddenSeedSheet from './HiddenSeedSheet'
import TopicRow from './TopicRow'
import { HIDDEN, MANAGE, TOAST } from './topicCopy'
import { useManageData, type ManageData } from './useManageData'

const LIMIT_NOTE_ID = 'mg-topic-limit'
/** 지운 뒤 초점이 갈 절 제목(T5-2). */
export const MINE_HEADING_ID = 'mg-mine'

interface ManageView {
  topics: TopicSections
  /** #161 이 실패했으면 null. */
  scenarios: ScenarioRows | null
  topicTotal: number
  hidden: number
}

function viewOf(d: ManageData): ManageView {
  const counts = d.scenarios ? scenarioCountByTopic(d.scenarios) : null
  return {
    topics: buildTopicSections(d.topics, { copyIds: copyIdSet(d.overrides, 'TOPIC'), scenarioCounts: counts, active: activeChallengeBadge(d.challenges) }),
    scenarios: d.scenarios ? buildScenarioRows(d.scenarios, copyIdSet(d.overrides, 'SCENARIO')) : null,
    topicTotal: d.topics.length,
    hidden: hiddenSeedCount(d.overrides),
  }
}

const SCENARIO_BADGE: Record<Origin, string> = { MINE: CARD.mine, SEED: MANAGE.badgeSeed, COPY: MANAGE.badgeCopy }

export default function ManageScreen({
  initialTab,
  initialSheetId,
  initialSaved = false,
}: {
  initialTab: ManageTab
  initialSheetId: string | null
  /** 상황 편집기 저장 뒤(`&saved=1`) — 토스트 한 번. */
  initialSaved?: boolean
}) {
  const router = useRouter()
  const data = useManageData()
  const { refresh, reload, retryList, listRetrying } = data
  const [tab, setTab] = useState<ManageTab>(initialSheetId ? 'scenarios' : initialTab)
  const [filter, setFilter] = useState<ScenarioFilter>('all')
  const [sheetId, setSheetId] = useState<string | null>(initialSheetId)
  const urlHasSheet = useRef(!!initialSheetId)
  const { ready: hydrated } = useNativeEnv()
  const openId = sheetIdAfterHydration(sheetId, hydrated)
  const { message, show } = useToast()
  const view = useMemo(() => (data.data ? viewOf(data.data) : null), [data.data])
  const [hiddenItems, setHiddenItems] = useState<SeedOverrideItem[] | null>(null)
  const savedPending = useRef(initialSaved && !!initialSheetId)

  useEffect(() => {
    const f = parseFlash(readStore('session', MANAGE_FLASH_KEY))
    // 되돌리기 토스트는 시드의 주제 보기가 읽는다.
    if (!f || f.kind === 'restored') return
    writeStore('session', MANAGE_FLASH_KEY, null)
    show(flashText(f))
    if (flashFocusesList(f)) document.getElementById(MINE_HEADING_ID)?.focus()
  }, [show])

  useEffect(() => {
    if (initialSaved) router.replace(manageHref('scenarios', initialSheetId), { scroll: false })
  }, [initialSaved, initialSheetId, router])

  // 저장한 상황이 내 버전이면 「내 버전으로 저장했어요」 — 출처는 #179 를 읽은 뒤에야 안다(실패하면 일반 문구).
  useEffect(() => {
    if (!savedPending.current || data.status === 'loading') return
    savedPending.current = false
    const origin = view?.scenarios?.rows.find((r) => r.item.id === initialSheetId)?.origin
    show(origin === 'COPY' ? TOAST.copySaved : SHEET.saved)
  }, [data.status, view, initialSheetId, show])

  const changeTab = (next: ManageTab) => {
    if (next === tab) return
    setTab(next)
    router.replace(manageHref(next), { scroll: false })
  }

  const openSheet = useCallback(
    (id: string) => {
      setSheetId(id)
      urlHasSheet.current = true
      router.replace(manageHref('scenarios', id), { scroll: false })
    },
    [router],
  )

  const closeSheet = useCallback(() => {
    setSheetId(null)
    if (urlHasSheet.current) {
      urlHasSheet.current = false
      router.replace(manageHref('scenarios'), { scroll: false })
    }
  }, [router])

  // 지우기·숨기기·되돌리기마다 문구가 다르다 — 시트가 고른 문구를 그대로 보인다(예전에는 늘 「지웠어요」).
  const onDeleted = useCallback(
    (_: string, toast: string) => {
      closeSheet()
      refresh()
      show(toast)
    },
    [closeSheet, refresh, show],
  )

  const openHidden = useCallback(() => {
    if (data.data) setHiddenItems(hiddenSeedItems(data.data.overrides))
  }, [data.data])

  const closeHidden = useCallback(
    (restored: number) => {
      setHiddenItems(null)
      if (restored > 0) {
        refresh()
        show(HIDDEN.shown)
      }
    },
    [refresh, show],
  )

  return (
    <>
      <BackBar sticky backHref="/settings" backLabel={MANAGE.back} title={MANAGE.title} />
      <div className="mx-auto min-w-0 max-w-[520px] px-4 pb-8 pt-3">
        <Segmented<ManageTab>
          ariaLabel={MANAGE.tabsAria}
          options={[
            { value: 'topics', label: MANAGE.tabTopics(view ? view.topicTotal : null) },
            { value: 'scenarios', label: MANAGE.tabScenarios(view?.scenarios ? view.scenarios.counts.all : null) },
          ]}
          value={tab}
          onChange={changeTab}
        />
        {tab === 'topics' ? (
          <TopicsPanel failed={data.status === 'error'} view={view} onRetry={reload} onOpenHidden={openHidden} />
        ) : (
          <ScenariosPanel
            failed={data.status === 'error'}
            view={view}
            filter={filter}
            onFilter={setFilter}
            onOpen={openSheet}
            onRetry={reload}
            onRetryList={retryList}
            retrying={listRetrying}
            onOpenHidden={openHidden}
          />
        )}
      </div>
      <ScenarioSheet id={openId} onClose={closeSheet} onDeleted={onDeleted} />
      <HiddenSeedSheet items={hiddenItems} onClose={closeHidden} />
      <Toast message={message} />
    </>
  )
}

function TopicsPanel({ failed, view, onRetry, onOpenHidden }: { failed: boolean; view: ManageView | null; onRetry: () => void; onOpenHidden: () => void }) {
  const limit = view ? topicLimitReached(view.topics.ownedCount) : false
  return (
    <>
      <div className="mt-3.5 flex">
        {limit ? (
          <Btn aria-disabled="true" aria-describedby={LIMIT_NOTE_ID} className={`w-full ${BLOCKED_FACE}`}>
            {MANAGE.createTopic}
          </Btn>
        ) : (
          <BtnLink href={TOPIC_NEW_HREF}>{MANAGE.createTopic}</BtnLink>
        )}
      </div>
      {limit ? (
        <InfoBox className="mt-2">
          <p id={LIMIT_NOTE_ID}>{MANAGE.mineFull}</p>
        </InfoBox>
      ) : (
        <p className="mt-2 text-[13px] text-ink2 break-keep">
          {MANAGE.createTopicSub}{' '}
          {/* 불러오기 전에는 자리만 잡는다(숫자를 지어내지 않고 줄 높이를 지킨다). */}
          <span className={`whitespace-nowrap tabular-nums ${view ? '' : 'invisible'}`} aria-hidden={view ? undefined : true}>
            {MANAGE.mineCount(view ? view.topics.ownedCount : 0)}
          </span>
        </p>
      )}

      {failed ? (
        <ErrorBox className="mt-[18px]" title={MANAGE.loadFail} body={MANAGE.loadFailBody} retryLabel={MANAGE.retry} onRetry={onRetry} />
      ) : (
        <>
          <section aria-labelledby={MINE_HEADING_ID} className="mt-[18px] min-w-0">
            <h2 id={MINE_HEADING_ID} tabIndex={-1} className="mb-2 min-w-0 truncate text-[15px] font-semibold outline-none">
              {MANAGE.mineSection(view ? view.topics.mine.length : null)}
            </h2>
            {!view ? (
              <Skeleton heights={[TOPIC_ROW_HEIGHT]} label={MANAGE.loading} />
            ) : view.topics.mine.length ? (
              <TopicList rows={view.topics.mine} />
            ) : (
              <Dashed minHeight={TOPIC_ROW_HEIGHT}>{MANAGE.mineEmpty}</Dashed>
            )}
          </section>
          <section aria-labelledby="mg-seed" className="mt-[18px] min-w-0">
            <h2 id="mg-seed" className="mb-2 min-w-0 truncate text-[15px] font-semibold">
              {MANAGE.seedSection(view ? view.topics.seed.length : null)}
            </h2>
            {!view ? <Blocks heights={[TOPIC_ROW_HEIGHT, TOPIC_ROW_HEIGHT, TOPIC_ROW_HEIGHT]} /> : view.topics.seed.length ? <TopicList rows={view.topics.seed} /> : null}
            {view && view.hidden > 0 ? <HiddenRow n={view.hidden} onOpen={onOpenHidden} /> : null}
          </section>
        </>
      )}
    </>
  )
}

function ScenariosPanel({
  failed,
  view,
  filter,
  onFilter,
  onOpen,
  onRetry,
  onRetryList,
  retrying,
  onOpenHidden,
}: {
  failed: boolean
  view: ManageView | null
  filter: ScenarioFilter
  onFilter: (f: ScenarioFilter) => void
  onOpen: (id: string) => void
  onRetry: () => void
  onRetryList: () => void
  /** #161 만 실패했을 때 [다시 시도] 를 누른 직후(최소 시간 유지) — 자리표시가 보이고, 다시 실패하면 오류 상자가 다시 나타난다. */
  retrying: boolean
  onOpenHidden: () => void
}) {
  const sc = view?.scenarios ?? null
  const rows = useMemo(() => (sc ? filterScenarioRows(sc.rows, filter) : []), [sc, filter])
  return (
    <>
      <div className="mt-3.5 flex">
        <BtnLink href={SCENARIO_NEW_FROM_MANAGE_HREF}>{MANAGE.createScenario}</BtnLink>
      </div>
      <p className={`mt-2 text-[13px] text-ink2 tabular-nums ${sc ? '' : 'invisible'}`} aria-hidden={sc ? undefined : true}>
        {MANAGE.scenarioCount(sc ? sc.ownedCount : 0)}
      </p>

      {failed ? (
        <ErrorBox className="mt-[18px]" title={MANAGE.loadFail} body={MANAGE.loadFailBody} retryLabel={MANAGE.retry} onRetry={onRetry} />
      ) : !view ? (
        <div className="mt-[18px]">
          <Skeleton heights={[44, 88, 88, 88]} label={MANAGE.loading} />
        </div>
      ) : !sc ? (
        retrying ? (
          <div className="mt-[18px]" aria-busy="true">
            <Skeleton heights={[44, 88, 88, 88]} label={MANAGE.loading} />
          </div>
        ) : (
          <ErrorBox className="mt-[18px]" title={MANAGE.loadFail} body={MANAGE.loadFailBody} retryLabel={MANAGE.retry} onRetry={onRetryList} />
        )
      ) : (
        <>
          <div className="mt-[18px]">
            <PlaceChips<ScenarioFilter>
              ariaLabel={MANAGE.filterAria}
              options={[
                { value: 'all', label: MANAGE.filterAll(sc.counts.all) },
                { value: 'mine', label: MANAGE.filterMine(sc.counts.mine) },
                { value: 'seed', label: MANAGE.filterSeed(sc.counts.seed) },
              ]}
              value={filter}
              onChange={onFilter}
            />
          </div>
          {rows.length ? (
            <ul className="mt-2 flex flex-col gap-2">
              {rows.map((r) => (
                <li key={r.item.id} className="min-w-0">
                  <ScenarioCard item={r.item} onOpen={onOpen} originBadge={SCENARIO_BADGE[r.origin]} />
                </li>
              ))}
            </ul>
          ) : (
            <Dashed className="mt-2">{MANAGE.scenarioEmpty}</Dashed>
          )}
          {view.hidden > 0 ? <HiddenRow n={view.hidden} onOpen={onOpenHidden} /> : null}
        </>
      )}
    </>
  )
}

function TopicList({ rows }: { rows: TopicSections['mine'] }) {
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.id} className="min-w-0">
          <TopicRow row={r} />
        </li>
      ))}
    </ul>
  )
}

/** 첫 자리표시 뒤에 이어지는 같은 높이 자리(읽기 알림은 첫 `Skeleton` 하나만). */
function Blocks({ heights }: { heights: number[] }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-2">
      {heights.map((h, i) => (
        <span key={i} className="block rounded-[14px] bg-surface2" style={{ height: h }} />
      ))}
    </div>
  )
}

/** 빈 목록 — 같은 자리의 자리표시와 높이를 맞춘다(주제 탭은 주제 행 높이) — 도착 뒤에도 아래가 밀리지 않는다. */
function Dashed({ children, className = '', minHeight = 76 }: { children: React.ReactNode; className?: string; minHeight?: number }) {
  return (
    <div style={{ minHeight }} className={`flex items-center justify-center rounded-[14px] border border-dashed border-line px-4 py-3 text-center text-[13px] text-ink2 ${className}`}>
      <p className="break-keep">{children}</p>
    </div>
  )
}

/** 숨긴 기본 항목 수 → 다시 보기 시트(T5-2). 높이·모양은 T5-1 의 정적 줄 그대로(56). */
function HiddenRow({ n, onOpen }: { n: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={onOpen}
      className="mt-3 flex min-h-14 w-full min-w-0 items-center gap-2 rounded-[14px] border border-line bg-surface px-3.5 py-2.5 text-left text-[15px] font-semibold"
    >
      <span className="min-w-0 flex-1 truncate">{MANAGE.hiddenRow(n)}</span>
      <span aria-hidden="true" className="flex-none text-ink2">
        ›
      </span>
    </button>
  )
}
