'use client'

/**
 * 회화 탭 '시나리오'(가이드 §3-B, D-2 A 한 화면): [＋ 내 상황 만들기] → 추천(≤3, 서버 순서) → 장소 칩 → 장소별 카드 묶음.
 * 칩 값은 화면 상태(주소에 넣지 않음). `?sc=<id>` 면 목록과 함께 그 상황 시트를 열고, 닫으면 `sc`·`saved` 를 `replace` 로 지운다.
 * 딥링크 시트는 수화가 끝난 뒤에 연다(`sheetIdAfterHydration` — 첫 렌더부터 열면 서버 렌더와 어긋나 React #418, qa-p2c-A 결함 #2).
 * 수화 여부는 `useNativeEnv().ready`(서버 스냅샷 false → 수화 직후 true) — effect 안 setState 없이.
 * 바깥 여백·스크롤은 `StudyAiHome` 래퍼 그대로(이 화면은 스크롤 영역을 만들지 않는다 — 장소 칩 가로 스크롤만).
 * 역할극 방에서 [그만두기]로 나왔으면 방이 남긴 한 번짜리 값을 읽고 바로 지운 뒤 "그만뒀어요" 토스트를 한 번 보인다(REV-141 L-4).
 */
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { readStore, writeStore } from '@/components/common/storage'
import Toast, { useToast } from '@/components/common/Toast'
import { Btn, Section, SectionHeader } from '@/components/common/ui'
import { useNativeEnv } from '@/components/common/useNativeEnv'
import { ErrorBox, Skeleton } from '@/components/challenge/parts'
import { effectiveFilter, groupByPlace, pickRecommended, placeOptions, quitNoticeOf, sheetIdAfterHydration, type PlaceFilter } from './logic'
import PlaceChips from './PlaceChips'
import ScenarioCard from './ScenarioCard'
import ScenarioSheet from './ScenarioSheet'
import { HOME, ROOM_STORE, SCENARIO_HOME_HREF, SCENARIO_NEW_HREF } from './scenarioCopy'
import { useScenarioList } from './useScenarioList'

export default function ScenarioHome({ initialSheetId = null, saved = false }: { initialSheetId?: string | null; saved?: boolean }) {
  const router = useRouter()
  const list = useScenarioList()
  const [filter, setFilter] = useState<PlaceFilter>('all')
  const [sheetId, setSheetId] = useState<string | null>(initialSheetId)
  const [showSaved, setShowSaved] = useState(saved && !!initialSheetId)
  const urlHasSheet = useRef(!!initialSheetId)
  const { ready: hydrated } = useNativeEnv()
  const openId = sheetIdAfterHydration(sheetId, hydrated)
  const { message, show } = useToast()

  useEffect(() => {
    const notice = quitNoticeOf(readStore('session', ROOM_STORE.quitDone))
    if (!notice) return
    writeStore('session', ROOM_STORE.quitDone, null)
    show(notice)
  }, [show])

  const data = list.data
  const items = useMemo(() => data?.items ?? [], [data])
  const options = useMemo(() => placeOptions(items), [items])
  const f = effectiveFilter(filter, options)
  const groups = useMemo(() => groupByPlace(items, f), [items, f])
  const reco = useMemo(() => (data ? pickRecommended(data) : []), [data])
  const create = () => router.push(SCENARIO_NEW_HREF)

  const closeSheet = useCallback(() => {
    setSheetId(null)
    setShowSaved(false)
    if (urlHasSheet.current) {
      urlHasSheet.current = false
      router.replace(SCENARIO_HOME_HREF, { scroll: false })
    }
  }, [router])

  return (
    <>
      <Btn className="mt-3.5 w-full" onClick={create}>
        {HOME.create}
      </Btn>
      <p className="mt-2 text-[13px] text-ink2 break-keep">{HOME.intro}</p>

      {list.status === 'loading' ? (
        <div className="mt-[18px]">
          <Skeleton heights={[88, 88, 88]} label={HOME.loadingSr} />
        </div>
      ) : list.status === 'error' ? (
        <ErrorBox className="mt-[18px]" title={HOME.error} onRetry={list.reload} />
      ) : items.length === 0 ? (
        <EmptyState title={HOME.emptyTitle} body={HOME.emptyBody} onCreate={create} />
      ) : (
        <>
          {reco.length ? (
            <Section>
              <SectionHeader title={HOME.recoTitle} right={<span className="flex-none text-[12px] text-ink2">{HOME.recoSub}</span>} />
              <ul className="flex flex-col gap-2">
                {reco.map((x) => (
                  <li key={x.id} className="min-w-0">
                    <ScenarioCard item={x} variant="reco" onOpen={setSheetId} />
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
          <div className="mt-[18px]">
            <PlaceChips<PlaceFilter> ariaLabel={HOME.placeAria} options={options} value={f} onChange={setFilter} />
          </div>
          {f === 'mine' && groups.length === 0 ? (
            <EmptyState title={HOME.mineEmptyTitle} body={HOME.mineEmptyBody} onCreate={create} />
          ) : (
            groups.map((g) => (
              <section key={g.key} className="mt-[18px] min-w-0" aria-label={g.title}>
                <div className="mb-2 flex min-w-0 items-baseline gap-1.5">
                  <h3 className="min-w-0 truncate text-[15px] font-semibold">{g.title}</h3>
                  {g.titleJa ? (
                    <span lang="ja" className="min-w-0 truncate text-[13px] text-ink2">
                      {g.titleJa}
                    </span>
                  ) : null}
                  <span className="flex-none text-[12px] text-ink2">{HOME.groupCount(g.items.length)}</span>
                </div>
                <ul className="flex flex-col gap-2">
                  {g.items.map((x) => (
                    <li key={x.id} className="min-w-0">
                      <ScenarioCard item={x} onOpen={setSheetId} />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      )}

      <ScenarioSheet
        id={openId}
        saved={showSaved && openId === initialSheetId}
        onClose={closeSheet}
        onDeleted={(_, toast) => {
          closeSheet()
          list.refresh()
          show(toast)
        }}
      />
      <Toast message={message} />
    </>
  )
}

function EmptyState({ title, body, onCreate }: { title: string; body: string; onCreate: () => void }) {
  return (
    <div className="mt-[18px] rounded-xl border border-dashed border-line px-4 py-6 text-center">
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      <p className="mt-1 text-[13px] text-ink2 break-keep">{body}</p>
      <Btn variant="ghost" className="mt-3 w-full" onClick={onCreate}>
        {HOME.create}
      </Btn>
    </div>
  )
}
