'use client'

/**
 * 「지난 질문」 시트(task-066 §26-4 C → task-067 §27-4·27-5) — 공용 `Sheet`, 시트 안만 스크롤. 한 쪽 5개 + `‹ 이전 · 1 / 3 · 다음 ›`.
 * 행 = `AskListItem`(누르면 `onOpen` — 탭 화면이 같은 자리에서 연다) + 형제 ⋯ → 같은 시트 안 하위 화면(이 대화 · 제목 바꾸기 · 삭제 확인, J4 시트 위 시트 없음).
 * 쪽 상태는 이 시트 안 훅이 들고(시트는 탭 화면이 살아 있는 동안 늘 마운트) 다시 열면 보던 쪽을 다시 읽는다(J2). 닫으면 하위 화면만 목록으로.
 * 알약 값은 `activity`(최근 20개)가 정한다 — 쪽 행에서는 「답 만드는 중」 덮어쓰기에만 쓴다(27-4 E). 쪽을 보는 동안 순서를 섞지 않는다.
 */
import { useEffect, useId, useRef, useState } from 'react'
import Sheet from '@/components/common/Sheet'
import { apiDelete } from '@/components/common/api'
import { Btn, BtnRow } from '@/components/common/ui'
import { JaRuns } from '@/components/common/japanese/JaRuns'
import ChatRenameForm from '@/components/chat/ChatRenameForm'
import type { ChatSummary } from '@/types/chat'
import { ASK_COPY } from './askCopy'
import AskListItem from './AskListItem'
import AskPager from './AskPager'
import { MENU_ROW, afterCommit } from './AskRoom'
import { ASK_ROW_CLASS } from './homeLogic'
import { ASK_HISTORY_PAGE, deleteHistoryRow, fillerCount, liveRunningMap, pagerView, rowRunning, type HistoryStatus, type PagerView } from './historyPaging'
import { ASK_KEYS, removeId } from './logic'
import type { AskActivity } from './useAskActivity'
import { useAskHistoryPages } from './useAskHistoryPages'

type Sub = { kind: 'list' } | { kind: 'row' | 'rename' | 'confirm'; row: ChatSummary }

const H = ASK_COPY.history
const LIST: Sub = { kind: 'list' }

function forgetRoom(id: string): void {
  removeId(ASK_KEYS.waiting, id)
  removeId(ASK_KEYS.newAnswer, id)
}

/** 마지막 쪽도 5행 높이(J1) — 실제 행과 같은 두 줄 구조의 숨은 행. 글자 크게 보기로 행이 커지면 같이 커져 쪽 줄이 움직이지 않는다(고정 높이 아님). */
function FillerRow() {
  return (
    <li aria-hidden="true" className="invisible">
      <span className={ASK_ROW_CLASS}>
        <span className="block truncate text-[15px] font-semibold">가</span>
        <span className="block truncate text-[14px]">가</span>
      </span>
    </li>
  )
}

function ErrorBox({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-xl bg-bad-soft px-3.5 py-3 text-[13.5px] text-bad">
      <span className="block text-[14.5px] font-semibold">{title}</span>
      <span className="block break-keep">{ASK_COPY.listErrorBody}</span>
      <button type="button" onClick={onRetry} className="mt-0.5 inline-flex min-h-11 items-center font-semibold underline">
        {ASK_COPY.retry}
      </button>
    </div>
  )
}

/**
 * 목록 칸 + 쪽 줄(27-4 D) — 서버 렌더로 시험할 수 있게 상태 없는 부품으로 나눴다(공용 `Sheet` 는 포털이라 서버에서 그리지 않는다).
 * 행 그리기는 부모가 `renderRow` 로 넘긴다.
 */
export function AskHistoryList({
  status,
  items,
  paged,
  view,
  renderRow,
  onRetry,
  onPrev,
  onNext,
}: {
  status: HistoryStatus
  items: readonly ChatSummary[]
  paged: boolean
  view: PagerView
  renderRow: (c: ChatSummary) => React.ReactNode
  onRetry: () => void
  onPrev: () => void
  onNext: () => void
}) {
  if (status === 'firstError') return <ErrorBox title={ASK_COPY.listError} onRetry={onRetry} />
  if (status === 'ready' && items.length === 0) {
    return (
      <div className="flex flex-col gap-1 pt-2 text-[14px] text-ink2">
        <p>{H.empty}</p>
        <p className="break-keep">{H.emptyHint}</p>
      </div>
    )
  }
  const skeleton = status === 'first' || status === 'paging'
  const shown = skeleton ? [] : items.slice(0, ASK_HISTORY_PAGE)
  const used = skeleton ? ASK_HISTORY_PAGE : status === 'pageError' ? 1 : shown.length
  const fillers = fillerCount(paged, used)
  return (
    <>
      <ul className="flex min-w-0 flex-col gap-2" aria-busy={status === 'paging' || undefined}>
        {skeleton
          ? Array.from({ length: ASK_HISTORY_PAGE }, (_, i) => <li key={`s${i}`} aria-hidden="true" className="h-[68px] rounded-[14px] bg-surface2" />)
          : status === 'pageError'
            ? (
                <li>
                  <ErrorBox title={H.pageError} onRetry={onRetry} />
                </li>
              )
            : shown.map(renderRow)}
        {Array.from({ length: fillers }, (_, i) => (
          <FillerRow key={`f${i}`} />
        ))}
      </ul>
      {status === 'first' ? (
        <p role="status" className="sr-only">
          {H.loadingSr}
        </p>
      ) : null}
      {paged ? (
        <div className="mt-2.5">
          <AskPager view={view} onPrev={onPrev} onNext={onNext} />
        </div>
      ) : null}
    </>
  )
}

export default function AskHistorySheet({
  open,
  activity,
  currentChatId,
  pageResetKey,
  onClose,
  onOpen,
  onRenamed,
  onDeleted,
  onToast,
}: {
  open: boolean
  activity: AskActivity
  currentChatId: string | null
  /** 바뀌면 1쪽으로(빈 대화에서 새 대화가 생겼을 때 — J2·L6) */
  pageResetKey: number
  onClose: () => void
  /** 행 누름 — 탭 화면이 같은 자리에서 연다(지금 대화면 시트만 닫는다, 27-1 A) */
  onOpen: (row: ChatSummary) => void
  onRenamed: (id: string, title: string) => void
  /** 시트에서 지웠다 — `wasCurrent` 면 부모가 시트를 닫고 빈 대화로(27-5 D) */
  onDeleted: (id: string, wasCurrent: boolean) => void
  onToast: (msg: string) => void
}) {
  const pages = useAskHistoryPages({ open, resetKey: pageResetKey })
  const [sub, setSub] = useState<Sub>(LIST)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const confirmBodyId = useId()

  // 부모가 닫으면(행 열기·지금 대화 삭제) 하위 화면만 목록으로 — 쪽은 그대로(J2).
  if (!open && (sub.kind !== 'list' || failed)) {
    setSub(LIST)
    setFailed(false)
  }

  const { refresh } = activity
  useEffect(() => {
    if (open) refresh()
  }, [open, refresh])

  const toast = onToast
  const live = liveRunningMap(activity.items)
  const latest = (row: ChatSummary) => pages.items.find((c) => c.id === row.id) ?? row
  const lockedOf = (row: ChatSummary) => rowRunning(latest(row), live)

  const focusIn = (selector: string) =>
    afterCommit(() => {
      const box = boxRef.current
      const el = box?.querySelector<HTMLElement>(selector) ?? box?.closest('[role="dialog"]')?.querySelector<HTMLElement>('h2')
      el?.focus()
    })
  const focusTitle = () => afterCommit(() => boxRef.current?.closest('[role="dialog"]')?.querySelector<HTMLElement>('h2')?.focus())

  const toSub = (next: Sub) => {
    setSub(next)
    setFailed(false)
    if (next.kind === 'row') focusIn('[data-sheet-first]')
    else if (next.kind === 'confirm') focusIn('[data-sheet-cancel]')
  }
  const backToList = (id: string) => {
    setSub(LIST)
    setFailed(false)
    focusIn(`[data-ask-row-more="${CSS.escape(id)}"]`)
  }
  const close = () => {
    if (busy) return
    setSub(LIST)
    setFailed(false)
    onClose()
  }
  const turnPage = (go: () => void) => {
    go()
    const scroller = boxRef.current?.parentElement
    if (scroller) scroller.scrollTop = 0
  }

  const remove = async (row: ChatSummary) => {
    if (busy) return
    setBusy(true)
    setFailed(false)
    const r = await deleteHistoryRow(
      {
        del: (id) => apiDelete(`/api/v1/chats/${encodeURIComponent(id)}`),
        forget: forgetRoom,
        toast,
        refreshActivity: refresh,
        reload: pages.reload,
        onDeleted,
      },
      row.id,
      { locked: lockedOf(row), currentChatId },
    )
    setBusy(false)
    if (r === 'failed') setFailed(true)
    else if (r === 'ok') {
      setSub(LIST)
      if (row.id !== currentChatId) focusTitle()
    }
  }

  let title: string = H.title
  let body: React.ReactNode
  if (sub.kind === 'list') {
    body = (
      <AskHistoryList
        status={pages.status}
        items={pages.items}
        paged={pages.paged}
        view={pagerView({ page: pages.page, pages: pages.pages, total: pages.total, status: pages.status, hasNext: pages.hasNext })}
        onRetry={pages.retry}
        onPrev={() => turnPage(pages.prev)}
        onNext={() => turnPage(pages.next)}
        renderRow={(c) => (
          <AskListItem
            key={c.id}
            chat={c}
            isNew={activity.newIds.has(c.id)}
            now={pages.now}
            current={c.id === currentChatId}
            running={rowRunning(c, live)}
            onOpen={() => onOpen(c)}
            onMore={() => toSub({ kind: 'row', row: c })}
          />
        )}
      />
    )
  } else {
    const row = latest(sub.row)
    if (sub.kind === 'row') {
      title = H.rowTitle
      const locked = lockedOf(row)
      body = (
        <div className="flex flex-col">
          <p className="truncate pb-1 text-[15px] font-semibold">
            <JaRuns text={row.title} />
          </p>
          <button type="button" data-sheet-first="" className={`${MENU_ROW} border-b border-line`} onClick={() => toSub({ kind: 'rename', row })}>
            {H.rename}{' '}
            <span aria-hidden="true" className="text-ink2">
              ›
            </span>
          </button>
          <button
            type="button"
            className={`${MENU_ROW} text-bad ${locked ? 'opacity-50' : ''}`}
            aria-disabled={locked || undefined}
            onClick={locked ? () => toast(ASK_COPY.menu.deleteBusy) : () => toSub({ kind: 'confirm', row })}
          >
            {ASK_COPY.menu.delete}
          </button>
          {locked ? <p className="px-1 pt-2 text-[12.5px] text-ink2">{H.deleteBusyNote}</p> : null}
          <Btn variant="ghost" className="mt-3 w-full" onClick={() => backToList(row.id)}>
            {H.toList}
          </Btn>
        </div>
      )
    } else if (sub.kind === 'rename') {
      title = H.rename
      body = (
        <ChatRenameForm
          variant="ask"
          chatId={row.id}
          initial={row.title}
          onBusyChange={setBusy}
          onSaved={(t) => {
            pages.patch(row.id, { title: t })
            toast(ASK_COPY.rename.saved)
            onRenamed(row.id, t)
            backToList(row.id)
          }}
          onCancel={() => backToList(row.id)}
        />
      )
    } else {
      title = ASK_COPY.menu.delete
      const [pre, post] = H.confirmQ('\u0000').split('\u0000')
      body = (
        <div className="flex flex-col gap-1">
          <p className="text-[16px] font-semibold break-keep">
            {pre}
            <JaRuns text={row.title} />
            {post}
          </p>
          <p id={confirmBodyId} className="text-[14px] text-ink2 break-keep">
            {ASK_COPY.menu.confirmBody}
          </p>
          {failed ? (
            <p role="alert" className="mt-1 rounded-xl bg-bad-soft px-3 py-2.5 text-[13.5px] text-bad break-keep">
              {ASK_COPY.menu.deleteFail}
            </p>
          ) : null}
          <BtnRow>
            <Btn variant="danger" onClick={() => void remove(row)} aria-busy={busy || undefined} aria-disabled={busy || undefined}>
              {busy ? '삭제 중…' : '삭제'}
            </Btn>
            <Btn variant="ghost" data-sheet-cancel="" onClick={busy ? undefined : () => backToList(row.id)} aria-disabled={busy || undefined}>
              취소
            </Btn>
          </BtnRow>
        </div>
      )
    }
  }

  return (
    <Sheet open={open} title={title} onClose={close} dismissible={!busy} describedBy={sub.kind === 'confirm' ? confirmBodyId : undefined}>
      <div ref={boxRef} className="min-w-0">
        {body}
      </div>
    </Sheet>
  )
}
