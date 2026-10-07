'use client'

/**
 * 주제 보기(S6, screens.md §16-2 — 데모 v2 `topic`) `/settings/scenarios/topics/<id>[?sc=<상황 id>]`.
 * 머리 카드 → 출처 안내(기본 / 「✎ 내 버전」 + [기본으로 되돌리기]) → 진행 중 챌린지 → 기본 표현(읽기 전용, [고치기]) → 이 주제의 상황(공유 상황 시트) →
 * 맨 아래 글자 버튼(지우기 / 숨기기 / 내 버전 지우기 → 확인 시트 S8·S9).
 * 지우기·숨기기 뒤 관리 화면으로, 되돌리기 뒤 시드의 주제 보기로 `replace({ scroll: false })` — 토스트 문구는 sessionStorage 로 넘긴다(제목을 URL 에 싣지 않음).
 * 시트 열기·닫기·토스트는 `main` 스크롤을 건드리지 않는다(R1~R6). 되돌린 뒤 도착한 주제 보기는 머리 카드 제목으로 초점을 옮긴다(의도된 이동).
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { readStore, writeStore } from '@/components/common/storage'
import Toast, { useToast } from '@/components/common/Toast'
import { Badge } from '@/components/common/ui'
import { useNativeEnv } from '@/components/common/useNativeEnv'
import { BtnLink, ErrorBox, InfoBox, Skeleton, ULink } from '@/components/challenge/parts'
import { sheetIdAfterHydration } from '@/components/scenario/logic'
import ScenarioCard from '@/components/scenario/ScenarioCard'
import ScenarioSheet from '@/components/scenario/ScenarioSheet'
import { CARD } from '@/components/scenario/scenarioCopy'
import BackBar from '@/components/shell/BackBar'
import {
  challengeHref,
  flashText,
  MANAGE_FLASH_KEY,
  MANAGE_HREF,
  parseFlash,
  removalFlash,
  REMOVAL_MODE_OF,
  SCENARIO_CARD_HEIGHT,
  topicDetailSkeleton,
  topicEditHref,
  topicHref,
  topicScenarioNewHref,
  topicSheetHref,
  type ManageFlash,
  type Origin,
  type OriginHint,
  type TopicDetailView,
} from './logic'
import TopicRemovalSheet from './TopicRemovalSheet'
import { MANAGE, REVIEW, TOPIC } from './topicCopy'
import { useTopicDetail } from './useTopicDetail'
import type { RemovalState, RemovalTarget } from './useTopicRemoval'

const ORIGIN_BADGE: Record<Origin, string> = { MINE: MANAGE.badgeMine, SEED: MANAGE.badgeSeed, COPY: MANAGE.badgeCopy }
const SCENARIO_BADGE: Record<Origin, string> = { MINE: CARD.mine, SEED: MANAGE.badgeSeed, COPY: MANAGE.badgeCopy }
const CHUNK_TYPE: Record<string, string> = REVIEW.type

const leaveFlash = (f: ManageFlash) => writeStore('session', MANAGE_FLASH_KEY, JSON.stringify(f))

export default function TopicDetail({ id, initialSheetId, originHint = null }: { id: string; initialSheetId: string | null; originHint?: OriginHint | null }) {
  const router = useRouter()
  const d = useTopicDetail(id)
  const { refresh } = d
  const { message, show } = useToast()
  const [sheetId, setSheetId] = useState<string | null>(initialSheetId)
  const urlHasSheet = useRef(!!initialSheetId)
  const { ready: hydrated } = useNativeEnv()
  const openId = sheetIdAfterHydration(sheetId, hydrated)
  const [removal, setRemoval] = useState<RemovalTarget | null>(null)
  const headRef = useRef<HTMLHeadingElement>(null)
  const focusHead = useRef(false)

  // 되돌리기 뒤 이 주제(시드)로·주제 만들기(T5-3a) 저장 뒤 새 주제로·주제 고치기(T5-4) 저장 뒤(내 버전이면 사본으로) 왔을 때만 — 관리 화면용 토스트는 건드리지 않는다.
  useEffect(() => {
    const f = parseFlash(readStore('session', MANAGE_FLASH_KEY))
    if (!f || (f.kind !== 'restored' && f.kind !== 'created' && f.kind !== 'saved' && f.kind !== 'copySaved')) return
    writeStore('session', MANAGE_FLASH_KEY, null)
    show(flashText(f))
    focusHead.current = true
  }, [id, show])

  const ready = d.status === 'ready'
  useEffect(() => {
    if (!focusHead.current || !ready) return
    focusHead.current = false
    headRef.current?.focus()
  }, [ready, id])

  const openSheet = useCallback(
    (sid: string) => {
      setSheetId(sid)
      urlHasSheet.current = true
      router.replace(topicSheetHref(id, sid), { scroll: false })
    },
    [id, router],
  )

  const closeSheet = useCallback(() => {
    setSheetId(null)
    if (urlHasSheet.current) {
      urlHasSheet.current = false
      router.replace(topicSheetHref(id, null), { scroll: false })
    }
  }, [id, router])

  const onScenarioDeleted = useCallback(
    (_: string, toast: string) => {
      closeSheet()
      refresh()
      show(toast)
    },
    [closeSheet, refresh, show],
  )

  const onRemovalDone = useCallback(
    (s: RemovalState & { result: NonNullable<RemovalState['result']>; preview: NonNullable<RemovalState['preview']> }) => {
      const t = removal
      if (!t) return
      leaveFlash(removalFlash(t.mode, s.preview.title, s.result))
      setRemoval(null)
      if (t.mode === 'restore' && t.seedId) router.replace(topicHref(t.seedId, 'SEED'), { scroll: false })
      else router.replace(MANAGE_HREF, { scroll: false })
    },
    [removal, router],
  )

  const onRemovalGone = useCallback(
    (kind: 'gone' | 'notOverridden') => {
      leaveFlash({ kind })
      setRemoval(null)
      router.replace(MANAGE_HREF, { scroll: false })
    },
    [router],
  )

  const v = d.view
  return (
    <>
      <BackBar sticky backHref={MANAGE_HREF} backLabel={TOPIC.back} title={v?.topic.title ?? ''} />
      <div className="mx-auto min-w-0 max-w-[520px] px-4 pb-8 pt-3">
        {d.status === 'loading' ? (
          <DetailSkeleton hint={originHint} />
        ) : d.status === 'error' ? (
          <ErrorBox title={MANAGE.loadFail} body={MANAGE.loadFailBody} retryLabel={MANAGE.retry} onRetry={d.reload} />
        ) : !v ? (
          <NotFound />
        ) : (
          <Body
            v={v}
            headRef={headRef}
            onOpenScenario={openSheet}
            onRetryScenarios={d.retryScenarios}
            scenariosRetrying={d.scenariosRetrying}
            onRemove={(mode) => setRemoval({ mode, topicId: v.topic.id, seedId: v.seedId })}
          />
        )}
      </div>
      <ScenarioSheet id={openId} onClose={closeSheet} onDeleted={onScenarioDeleted} />
      <TopicRemovalSheet target={removal} onClose={() => setRemoval(null)} onDone={onRemovalDone} onGone={onRemovalGone} />
      <Toast message={message} />
    </>
  )
}

/**
 * 주제 보기 자리표시 — 높이·모양 근거는 `logic.ts` `TOPIC_DETAIL_SKELETON`·`topicDetailSkeleton`. 공용 `Skeleton`(gap-2 8)이 아니라 실제 화면과 같은 블록 간격(12·18)으로 늘어놓아
 * 도착 뒤에도 출처 안내 상자·표현 절의 시작 위치가 같다(읽기 알림은 하나만). `hint`(링크의 `?o=`)는 출처 안내 상자 자리를 두거나 빼는 데만 쓴다 —
 * 내가 만든 주제에는 그 상자가 없다. 도착하면 힌트가 아니라 실제 데이터(`Body` 의 `v.origin`)로 그린다.
 */
function DetailSkeleton({ hint }: { hint: OriginHint | null }) {
  const block = 'block rounded-[14px] bg-surface2'
  return (
    <div>
      <p role="status" className="sr-only">
        {TOPIC.loading}
      </p>
      <div aria-hidden="true">
        {topicDetailSkeleton(hint).map((b) => (
          <span key={b.key} className={block} style={{ height: b.height, marginTop: b.gap }} />
        ))}
      </div>
    </div>
  )
}

function NotFound() {
  return (
    <div className="mt-3 rounded-[14px] border border-line bg-surface px-4 py-5 text-center">
      <p className="text-[15px] font-semibold break-keep">{TOPIC.notFound}</p>
      <p className="mt-1 text-[13px] text-ink2 break-keep">{TOPIC.notFoundBody}</p>
      <div className="mt-4 flex">
        <BtnLink href={MANAGE_HREF} replace>
          {TOPIC.notFoundBtn}
        </BtnLink>
      </div>
    </div>
  )
}

function Body({
  v,
  headRef,
  onOpenScenario,
  onRetryScenarios,
  scenariosRetrying,
  onRemove,
}: {
  v: TopicDetailView
  headRef: React.RefObject<HTMLHeadingElement | null>
  onOpenScenario: (id: string) => void
  onRetryScenarios: () => void
  scenariosRetrying: boolean
  onRemove: (mode: RemovalTarget['mode']) => void
}) {
  const t = v.topic
  const removeLabel = v.origin === 'MINE' ? TOPIC.remove : v.origin === 'SEED' ? TOPIC.hide : TOPIC.copyRemove
  const removeSub = v.origin === 'SEED' ? TOPIC.hideSub : v.origin === 'COPY' ? TOPIC.copyRemoveSub : null
  return (
    <>
      <section className="min-w-0 rounded-[14px] border border-line bg-surface px-3.5 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <h2 ref={headRef} tabIndex={-1} className="min-w-0 break-words text-[18px] font-bold outline-none">
            {t.title}
          </h2>
          <Badge>{t.level}</Badge>
          <Badge>{ORIGIN_BADGE[v.origin]}</Badge>
        </div>
        {t.titleJa?.trim() ? (
          <p lang="ja" className="mt-1 break-words text-[13px] text-ink2">
            {t.titleJa}
          </p>
        ) : null}
        {t.description?.trim() ? <p className="mt-2 text-[14px] break-keep [overflow-wrap:anywhere]">{t.description}</p> : null}
      </section>

      {v.origin === 'SEED' ? (
        <InfoBox className="mt-3">
          <p>{TOPIC.seedInfo}</p>
        </InfoBox>
      ) : v.origin === 'COPY' ? (
        <InfoBox className="mt-3">
          <p className="font-bold">{v.copyDate ? TOPIC.copyInfo(v.copyDate) : MANAGE.badgeCopy}</p>
          {v.seedId ? (
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => onRemove('restore')}
              className="inline-flex min-h-11 items-center text-[14px] font-semibold underline underline-offset-[3px]"
            >
              {TOPIC.revert}
            </button>
          ) : null}
        </InfoBox>
      ) : null}

      {v.challenge ? (
        <div className="mt-3 flex min-w-0 items-center gap-2.5 rounded-[14px] border border-line bg-surface px-3.5 py-1.5">
          <p className="min-w-0 flex-1 text-[14px] font-semibold break-keep [overflow-wrap:anywhere]">{TOPIC.challenge(v.challenge.title, v.challenge.day, v.challenge.lengthDays)}</p>
          <ULink href={challengeHref(v.challenge.id)} className="flex-none">
            {TOPIC.challengeLink}
            <span aria-hidden="true">&nbsp;›</span>
          </ULink>
        </div>
      ) : null}

      <section aria-labelledby="tp-chunks" className="mt-[18px] min-w-0">
        <div className="mb-1 flex min-w-0 items-center gap-2">
          <h2 id="tp-chunks" className="min-w-0 flex-1 truncate text-[15px] font-semibold">
            {TOPIC.chunksHead(v.chunkCount)}
          </h2>
          <Link href={topicEditHref(t.id)} aria-label={TOPIC.editAria(t.title)} className="inline-flex min-h-11 flex-none items-center px-1 text-[14px] font-semibold underline underline-offset-[3px]">
            {TOPIC.edit}
          </Link>
        </div>
        <div className="flex flex-col gap-3">
          {v.chunkGroups.map((g) => (
            <div key={g.type} className="min-w-0">
              <h3 className="text-[12px] font-semibold text-ink2">{CHUNK_TYPE[g.type] ?? g.type}</h3>
              <ul className="mt-1 rounded-[14px] border border-line bg-surface px-3.5">
                {g.chunks.map((c) => (
                  <li key={c.id} className="min-w-0 border-b border-line py-2 last:border-b-0">
                    <p lang="ja" className="break-words text-[16px]">
                      {c.textJa}
                    </p>
                    {c.reading ? (
                      <p lang="ja" className="break-words text-[13px] text-ink2">
                        {c.reading}
                      </p>
                    ) : null}
                    <p className="text-[13px] text-ink2 break-keep [overflow-wrap:anywhere]">{c.meaningKo}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="tp-scenarios" className="mt-[18px] min-w-0">
        <h2 id="tp-scenarios" className="mb-2 min-w-0 truncate text-[15px] font-semibold">
          {v.scenarios ? TOPIC.scenariosHead(v.scenarios.length) : MANAGE.tabScenarios(null)}
        </h2>
        {!v.scenarios ? (
          // [다시 시도] 를 눌렀다는 것이 보이게 — 다시 실패해도 최소 0.5초는 자리표시(관리 화면 #161 과 같은 방식).
          scenariosRetrying ? (
            <div aria-busy="true">
              <Skeleton heights={[SCENARIO_CARD_HEIGHT, SCENARIO_CARD_HEIGHT]} label={MANAGE.loading} />
            </div>
          ) : (
            <ErrorBox title={MANAGE.loadFail} body={MANAGE.loadFailBody} retryLabel={MANAGE.retry} onRetry={onRetryScenarios} />
          )
        ) : v.scenarios.length ? (
          <ul className="flex flex-col gap-2">
            {v.scenarios.map((r) => (
              <li key={r.item.id} className="min-w-0">
                <ScenarioCard item={r.item} onOpen={onOpenScenario} originBadge={SCENARIO_BADGE[r.origin]} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex min-h-[76px] items-center justify-center rounded-[14px] border border-dashed border-line px-4 py-3 text-center text-[13px] text-ink2 break-keep">
            {TOPIC.scenariosEmpty}
          </p>
        )}
        <div className="mt-2 flex">
          <BtnLink href={topicScenarioNewHref(t.id)} variant="ghost">
            {TOPIC.addScenario}
          </BtnLink>
        </div>
      </section>

      <div className="mt-8 text-center">
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => onRemove(REMOVAL_MODE_OF[v.origin])}
          className="inline-flex min-h-11 items-center px-2 text-[14px] font-semibold text-bad underline underline-offset-[3px]"
        >
          {removeLabel}
        </button>
        {removeSub ? <p className="text-[12px] text-ink2 break-keep">{removeSub}</p> : null}
      </div>
    </>
  )
}
