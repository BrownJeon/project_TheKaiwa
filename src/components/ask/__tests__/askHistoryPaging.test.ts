import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ChatSummary } from '@/types/chat'
import { readCode } from '../../__tests__/sourceCode'
import { AskHistoryList } from '../AskHistorySheet'
import { ASK_LIST_LIMIT } from '../homeLogic'
import { ASK_COPY } from '../askCopy'
import {
  ASK_HISTORY_PAGE,
  INITIAL_PAGER,
  beginPage,
  canNext,
  canPrev,
  deleteHistoryRow,
  fillerCount,
  historyListUrl,
  historyPages,
  isPaged,
  liveRunningMap,
  pageAfterDelete,
  pagerView,
  patchRow,
  pushCursor,
  reloadAfterDelete,
  resetPager,
  rowRunning,
  settlePage,
  type AskListPage,
  type HistoryStatus,
  type PagerState,
} from '../historyPaging'

// task-067 §27-10 T1~T8 · T13 · T23 — 지난 질문 시트 5개씩 쪽(순수 계산·상태 전이·삭제 실행).

const row = (id: string, o: Partial<ChatSummary> = {}): ChatSummary => ({
  id,
  kind: 'ASK',
  title: `질문 ${id}`,
  lastMessageAt: '2026-10-13T05:00:00.000Z',
  preview: '답',
  messageCount: 2,
  reviewedAt: null,
  running: false,
  ...o,
})
const rows = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => row(`${prefix}${i + 1}`))
const resp = (items: ChatSummary[], nextCursor: string | null, total: number): AskListPage => ({ items, nextCursor, total })
const NOW = new Date('2026-10-13T08:00:00.000Z')
const ok = (page: AskListPage) => ({ ok: true as const, page, now: NOW })

/** 열고 1쪽을 받은 상태(12개 → 3쪽). */
function firstPageOf(total = 12): PagerState {
  const s = beginPage(INITIAL_PAGER, 'open')
  assert.ok(s.req)
  return settlePage(s, s.req, ok(resp(rows('a', Math.min(5, total)), total > 5 ? 'c1' : null, total)))
}

test('T1 한 쪽 최대 5행 — ASK_HISTORY_PAGE === 5 · 요청 limit=5 · 커서는 인코딩', () => {
  assert.equal(ASK_HISTORY_PAGE, 5)
  assert.equal(historyListUrl(null), '/api/v1/chats?kind=ASK&limit=5')
  assert.equal(historyListUrl('a b/c'), '/api/v1/chats?kind=ASK&limit=5&cursor=a%20b%2Fc')
})

test('T2 historyPages = max(1, ⌈total/5⌉) — 0→1 · 1→1 · 5→1 · 6→2 · 12→3 · 15→3 · 16→4 · null→1', () => {
  assert.deepEqual([0, 1, 5, 6, 12, 15, 16].map(historyPages), [1, 1, 1, 2, 3, 3, 4])
  assert.equal(historyPages(null), 1)
})

test('T3 5개 이하면 쪽 줄 없음 — total ≤ 5 && 1쪽 → paged=false · 6개부터 · 1쪽이 아니면 늘 있음', () => {
  assert.equal(isPaged(0, 0), false)
  assert.equal(isPaged(5, 0), false)
  assert.equal(isPaged(null, 0), false)
  assert.equal(isPaged(6, 0), true)
  assert.equal(isPaged(3, 1), true, '다른 기기에서 지워져 줄었어도 2쪽을 보는 중이면 쪽 줄을 지운다 → 길을 잃지 않게 남김')
})

test('T4 [다음] 흐림 — 마지막 쪽(total 기준) · nextCursor 없음 · 1쪽 [이전] 흐림', () => {
  const v = (o: Partial<Parameters<typeof pagerView>[0]>) => pagerView({ page: 0, pages: 3, total: 12, status: 'ready', hasNext: true, ...o })
  assert.deepEqual([v({}).prevDisabled, v({}).nextDisabled], [true, false], '1쪽: 이전 흐림 · 다음 켜짐')
  assert.deepEqual([v({ page: 1 }).prevDisabled, v({ page: 1 }).nextDisabled], [false, false])
  assert.equal(v({ page: 2, hasNext: true }).nextDisabled, true, 'total 로 보면 마지막 쪽 — 서버가 커서를 줘도 흐림')
  assert.equal(v({ page: 1, hasNext: false }).nextDisabled, true, '커서가 없으면 흐림')
  assert.equal(v({ page: 1, status: 'pageError' }).prevDisabled, false, '쪽 오류에서도 앞 쪽으로 갈 수 있다')
  assert.equal(v({ page: 1, status: 'pageError' }).nextDisabled, true, '쪽 오류면 그 쪽의 다음 커서를 모른다 — 흐림(데모와 다른 곳 ②)')
  assert.equal(v({}).label, '1 / 3')
  assert.equal(v({}).sub, '모두 12개')
  assert.equal(v({ page: 1 }).sr, '3쪽 중 2쪽 · 모두 12개')
  assert.equal(v({ total: 1234, pages: 247 }).sub, '모두 1,234개')
})

test('T5 쪽 넘기는 중 — 두 단추 흐림 · 라벨이 이미 목표 쪽 · 「불러오는 중…」 · status 「2쪽을 불러오고 있어요」', () => {
  const s = beginPage(firstPageOf(), 'next')
  assert.equal(s.status, 'paging')
  assert.equal(s.page, 1, '목표 쪽으로 먼저 바꾼다')
  const v = pagerView({ page: s.page, pages: historyPages(s.total), total: s.total, status: s.status, hasNext: s.hasNext })
  assert.deepEqual([v.prevDisabled, v.nextDisabled], [true, true])
  assert.equal(v.label, '2 / 3')
  assert.equal(v.sub, '불러오는 중…')
  assert.equal(v.sr, '2쪽을 불러오고 있어요')
  assert.equal(beginPage(s, 'next'), s, '넘기는 중 [다음] 연타 — 상태 그대로(요청 0)')
  assert.equal(beginPage(s, 'prev'), s, '넘기는 중 [이전] 연타 — 상태 그대로')
})

test('T6 커서 스택 — [다음] = cursors[page+1] · [이전] = cursors[page−1] 로 다시 읽음 · 뒤쪽 옛 커서는 버림', () => {
  assert.deepEqual(pushCursor([null], 0, 'c1'), [null, 'c1'])
  assert.deepEqual(pushCursor([null, 'c1', 'c2', 'c3'], 1, 'c2b'), [null, 'c1', 'c2b'])
  let s = firstPageOf()
  assert.deepEqual(s.cursors, [null, 'c1'])
  s = beginPage(s, 'next')
  assert.deepEqual(s.req && [s.req.page, s.req.cursor], [1, 'c1'])
  s = settlePage(s, s.req!, ok(resp(rows('b', 5), 'c2', 12)))
  assert.deepEqual(s.cursors, [null, 'c1', 'c2'])
  s = beginPage(s, 'next')
  assert.deepEqual(s.req && [s.req.page, s.req.cursor], [2, 'c2'])
  s = settlePage(s, s.req!, ok(resp(rows('c', 2), null, 12)))
  assert.equal(s.items.length, 2)
  assert.equal(canNext(s), false)
  s = beginPage(s, 'prev')
  assert.deepEqual(s.req && [s.req.page, s.req.cursor, s.req.silent], [1, 'c1', false], '이전 쪽도 저장해 둔 행이 아니라 그 커서로 다시 읽는다')
  assert.equal(s.items.length, 0)
})

test('T6 늦게 온 옛 응답은 버린다 — 열기(조용히) 요청보다 [다음] 응답이 먼저 와도 옛 응답이 덮지 않는다', () => {
  let s = firstPageOf()
  s = beginPage(s, 'open')
  const openReq = s.req!
  assert.equal(openReq.silent, true, '받은 행이 있으면 그대로 보여 둔 채 조용히')
  assert.equal(s.items.length, 5)
  s = beginPage(s, 'next')
  const nextReq = s.req!
  assert.ok(nextReq.seq > openReq.seq)
  const early = settlePage(s, openReq, ok(resp(rows('z', 5), 'zz', 99)))
  assert.equal(early, s, '[다음] 응답을 기다리는 동안 옛 열기 응답이 먼저 와도 1쪽 행으로 덮지 않는다')
  assert.deepEqual([s.status, s.page], ['paging', 1])
  assert.equal(settlePage(s, openReq, { ok: false }), s, '옛 요청의 실패도 무시')
  s = settlePage(s, nextReq, ok(resp(rows('b', 5), 'c2', 12)))
  const late = settlePage(s, openReq, ok(resp(rows('z', 5), 'zz', 99)))
  assert.equal(late, s, '옛 순서표의 응답은 상태를 바꾸지 않는다')
  assert.deepEqual([s.page, s.items[0]?.id, s.total], [1, 'b1', 12])
  const lateFail = settlePage(s, openReq, { ok: false })
  assert.equal(lateFail, s)
})

test('T6 처음 불러오기·오류 — 첫 실패 = firstError(쪽 줄 없음) · 쪽 실패 = pageError(그 쪽에 머묾) · 조용한 다시 읽기 실패 = 행 유지', () => {
  let s = beginPage(INITIAL_PAGER, 'open')
  assert.equal(s.status, 'first')
  s = settlePage(s, s.req!, { ok: false })
  assert.equal(s.status, 'firstError')
  s = beginPage(s, 'retry')
  assert.deepEqual([s.status, s.req?.cursor], ['first', null])
  s = settlePage(s, s.req!, ok(resp(rows('a', 5), 'c1', 12)))
  s = beginPage(s, 'next')
  s = settlePage(s, s.req!, { ok: false })
  assert.deepEqual([s.status, s.page, s.items.length], ['pageError', 1, 0])
  assert.equal(canPrev(s), true)
  assert.equal(canNext(s), false)
  const r = beginPage(s, 'retry')
  assert.deepEqual([r.status, r.page, r.req?.cursor], ['paging', 1, 'c1'], '같은 커서로 다시')
  let q = firstPageOf()
  q = beginPage(q, 'open')
  q = settlePage(q, q.req!, { ok: false })
  assert.deepEqual([q.status, q.items.length, q.req], ['ready', 5, null], '열 때 조용히 다시 읽다 실패해도 오류 표시 없이 행 유지')
})

test('T6 열 때 다시 읽은 쪽이 비었고 1쪽이 아니면 앞 쪽으로 — 쪽 수·「모두 n개」는 가장 최근 total', () => {
  let s = firstPageOf()
  s = beginPage(s, 'next')
  s = settlePage(s, s.req!, ok(resp(rows('b', 5), 'c2', 12)))
  s = beginPage(s, 'open')
  s = settlePage(s, s.req!, ok(resp([], null, 5)))
  assert.deepEqual([s.status, s.page, s.req?.page, s.req?.cursor, s.total], ['paging', 0, 0, null, 5])
  s = settlePage(s, s.req!, ok(resp(rows('a', 5), null, 5)))
  assert.deepEqual([s.status, s.page, historyPages(s.total), isPaged(s.total, s.page)], ['ready', 0, 1, false])
})

test('T7 마지막 쪽 빈 자리 = 5 − 행 수 · 쪽 오류면 4(오류 상자 한 줄) · 5개 이하면 0', () => {
  assert.equal(fillerCount(true, 2), 3)
  assert.equal(fillerCount(true, 5), 0)
  assert.equal(fillerCount(true, 1), 4, '쪽 오류 상자')
  assert.equal(fillerCount(false, 3), 0, '5개 이하 — 시트가 행 수만큼만 높다')
  assert.equal(fillerCount(true, 0), 5)
})

test('T8 삭제 뒤 — 지금 쪽이 비고 1쪽이 아니면 앞 쪽 · 1쪽은 그대로', () => {
  assert.equal(pageAfterDelete(2, 0), 1)
  assert.equal(pageAfterDelete(2, 1), 2)
  assert.equal(pageAfterDelete(0, 0), 0)
  let s = firstPageOf()
  s = beginPage(s, 'next')
  s = settlePage(s, s.req!, ok(resp(rows('b', 5), 'c2', 11)))
  s = beginPage(s, 'next')
  s = settlePage(s, s.req!, ok(resp([row('last')], null, 11)))
  assert.deepEqual([s.page, historyPages(s.total)], [2, 3])
  const after = reloadAfterDelete(s, 'last')
  assert.deepEqual([after.page, after.total, after.status, after.req?.cursor, after.req?.silent], [1, 10, 'paging', 'c1', false], '빈 마지막 쪽에 머물지 않는다')
  const mid = reloadAfterDelete(firstPageOf(), 'a3')
  assert.deepEqual([mid.page, mid.total, mid.items.map((c) => c.id), mid.req?.silent, mid.req?.cursor], [0, 11, ['a1', 'a2', 'a4', 'a5'], true, null], '같은 커서로 조용히 다시 — 뒤 행이 올라온다')
})

test('J2 1쪽으로 — 새 대화가 생기면(resetKey) 1쪽·커서 처음 · 이미 1쪽이면 그대로', () => {
  let s = firstPageOf()
  assert.equal(resetPager(s), s)
  s = beginPage(s, 'next')
  s = settlePage(s, s.req!, ok(resp(rows('b', 5), 'c2', 12)))
  const r = resetPager(s)
  assert.deepEqual([r.page, r.cursors, r.total, r.items.length, r.status, r.req], [0, [null], null, 0, 'first', null])
  assert.ok(r.seq >= s.seq, '순서표는 되돌리지 않는다 — 진행 중이던 옛 응답이 끼어들지 않게')
})

test('J6 제목 제자리 고침 — 순서 그대로 · 다른 쪽 행이면 그대로', () => {
  const s = firstPageOf()
  const p = patchRow(s, 'a2', { title: '새 제목' })
  assert.deepEqual(p.items.map((c) => [c.id, c.title]).slice(0, 3), [['a1', '질문 a1'], ['a2', '새 제목'], ['a3', '질문 a3']])
  assert.equal(patchRow(s, 'zz', { title: 'x' }), s)
})

test('T13 행 「답 만드는 중」 덮어쓰기 — 알약용 최근 목록 값이 우선 · 없으면 쪽 값 · 순서 불변', () => {
  const live = liveRunningMap([row('a1', { running: true }), row('a2', { running: false })])
  assert.equal(rowRunning(row('a1', { running: false }), live), true)
  assert.equal(rowRunning(row('a2', { running: true }), live), false, '더 새 값(끝남)')
  assert.equal(rowRunning(row('a9', { running: true }), live), true, '알약 목록 밖(21번째 이후)은 쪽 값')
})

test('T23 시트 삭제 — 잠긴 행 요청 0 + 토스트 · 성공 = 저장소 정리·토스트 1·알약/쪽 다시·지금 대화면 onDeleted(id, true) · 실패 = 알림 0', async () => {
  const log: string[] = []
  const deps = (fail = false) => ({
    del: async (id: string) => {
      log.push(`del:${id}`)
      if (fail) throw new Error('x')
    },
    forget: (id: string) => log.push(`forget:${id}`),
    toast: (m: string) => log.push(`toast:${m}`),
    refreshActivity: () => log.push('refresh'),
    reload: (id: string) => log.push(`reload:${id}`),
    onDeleted: (id: string, cur: boolean) => log.push(`deleted:${id}:${cur}`),
  })
  assert.equal(await deleteHistoryRow(deps(), 'r1', { locked: true, currentChatId: null }), 'locked')
  assert.deepEqual(log.splice(0), [`toast:${ASK_COPY.menu.deleteBusy}`])
  assert.equal(await deleteHistoryRow(deps(), 'r1', { locked: false, currentChatId: 'r2' }), 'ok')
  assert.deepEqual(log.splice(0), ['del:r1', 'forget:r1', `toast:${ASK_COPY.deletedToast}`, 'refresh', 'reload:r1', 'deleted:r1:false'])
  assert.equal(await deleteHistoryRow(deps(), 'r2', { locked: false, currentChatId: 'r2' }), 'ok')
  assert.ok(log.splice(0).includes('deleted:r2:true'))
  assert.equal(await deleteHistoryRow(deps(true), 'r3', { locked: false, currentChatId: null }), 'failed')
  assert.deepEqual(log.splice(0), ['del:r3'], '실패 — 저장소·토스트·부모 알림 0(확인 화면에 실패 한 줄)')
})

// ── 렌더(공용 Sheet 는 포털이라 목록 칸 부품 `AskHistoryList` 를 그린다) ─────────────────────────────

const askDir = join(__dirname, '..')
const code = (f: string) => readCode(join(askDir, f))

function list(o: { status?: HistoryStatus; items?: ChatSummary[]; total?: number | null; page?: number; hasNext?: boolean } = {}): string {
  const status = o.status ?? 'ready'
  const total = o.total === undefined ? 12 : o.total
  const page = o.page ?? 0
  const view = pagerView({ page, pages: historyPages(total), total, status, hasNext: o.hasNext ?? true })
  return renderToStaticMarkup(
    createElement(AskHistoryList, {
      status,
      items: o.items ?? rows('a', 5),
      paged: isPaged(total, page),
      view,
      renderRow: (c: ChatSummary) => createElement('li', { key: c.id, 'data-row': c.id }, c.title),
      onRetry: () => {},
      onPrev: () => {},
      onNext: () => {},
    }),
  )
}
const realRows = (html: string) => (html.match(/<li data-row=/g) ?? []).length
const fillers = (html: string) => (html.match(/<li aria-hidden="true" class="invisible">/g) ?? []).length
const NAV = 'aria-label="지난 질문 쪽"'

test('T1 렌더 — 행 li(숨은 자리 제외) ≤ 5: 6개를 줘도 5행 · 훅은 historyListUrl(limit=5)로만 읽는다', () => {
  assert.equal(realRows(list({ items: rows('a', 6) })), 5)
  const hook = code('useAskHistoryPages.ts')
  assert.match(hook, /apiGet<AskListPage>\(historyListUrl\(req\.cursor\)\)/)
  assert.ok(!/limit=/.test(hook), '훅에 다른 limit 을 적지 않는다(한 곳 — historyListUrl)')
  assert.match(code('historyPaging.ts'), /limit=\$\{ASK_HISTORY_PAGE\}/)
})

test('T3 렌더 — 5개 이하 1쪽: 쪽 줄 0 · 숨은 자리 0 · 6개부터 쪽 줄', () => {
  const few = list({ items: rows('a', 3), total: 3, hasNext: false })
  assert.ok(!few.includes(NAV))
  assert.equal(fillers(few), 0)
  assert.equal(realRows(few), 3)
  assert.ok(!list({ items: rows('a', 5), total: 5, hasNext: false }).includes(NAV))
  assert.ok(list({ total: 6 }).includes(NAV))
})

test('T4 렌더 — 흐림 = aria-disabled="true" 이고 disabled 속성 0 · 1쪽 [이전] 흐림 · 마지막 쪽 [다음] 흐림', () => {
  const p1 = list()
  assert.equal((p1.match(/aria-disabled="true"/g) ?? []).length, 1, '1쪽: [이전]만')
  assert.ok(!/\sdisabled(=|\s|>)/.test(p1), 'disabled 속성을 쓰지 않는다(초점이 빠지지 않게, J9)')
  const last = list({ page: 2, items: rows('c', 2), hasNext: true })
  const btns = last.match(/<button [^>]*>/g) ?? []
  assert.equal(btns.length, 2)
  assert.ok(!btns[0].includes('aria-disabled="true"'), '마지막 쪽 [이전] 켜짐')
  assert.ok(btns[1].includes('aria-disabled="true"'), 'total 로 마지막 쪽 — [다음] 흐림')
  assert.match(last, /aria-hidden="true" class="min-w-0 flex-1 text-center tabular-nums"/, '가운데 라벨은 화면 읽기에서 숨김')
  assert.match(last, /<p role="status" class="sr-only">3쪽 중 3쪽 · 모두 12개<\/p>/)
  assert.match(last, /h-11 min-w-\[92px\]/, '쪽 단추 44 × ≥92')
})

test('T5 렌더 — 넘기는 중: 회색 자리 5 · ul aria-busy · 두 단추 흐림 · 라벨 목표 쪽', () => {
  const h = list({ status: 'paging', page: 1, items: [] })
  assert.match(h, /<ul class="flex min-w-0 flex-col gap-2" aria-busy="true">/)
  assert.equal((h.match(/<li aria-hidden="true" class="h-\[68px\] rounded-\[14px\] bg-surface2"><\/li>/g) ?? []).length, 5)
  assert.equal((h.match(/aria-disabled="true"/g) ?? []).length, 2)
  assert.match(h, />2 \/ 3</)
  assert.match(h, />불러오는 중…</)
  assert.equal(fillers(h), 0)
})

test('T7 렌더 — 마지막 쪽 빈 자리 = 5 − 행 수(aria-hidden·invisible · 실제 행과 같은 두 줄 구조) · 쪽 오류면 4 · 5개 이하 0', () => {
  const last = list({ page: 2, items: rows('c', 2), hasNext: false })
  assert.equal(realRows(last), 2)
  assert.equal(fillers(last), 3)
  assert.ok(!/min-h-\[68px\]|h-\[68px\][^"]*invisible/.test(last), '고정 68 높이가 아니라 행 모양 그대로(글자 크게 보기에서 같이 커짐)')
  const err = list({ status: 'pageError', page: 1, items: [] })
  assert.equal(fillers(err), 4)
  assert.match(err, /role="alert"[\s\S]*이 쪽을 불러오지 못했어요[\s\S]*다시 시도/)
  assert.equal(fillers(list({ items: rows('a', 3), total: 3, hasNext: false })), 0)
})

test('27-4 D 렌더 — 처음 불러오기 = 회색 자리 5 + sr 「지난 질문을 불러오고 있어요」, 쪽 줄 0 · 목록 오류 = 오류 상자(쪽 줄 0) · 빈 = 두 줄 안내', () => {
  const first = list({ status: 'first', total: null, items: [] })
  assert.match(first, /<p role="status" class="sr-only">지난 질문을 불러오고 있어요<\/p>/)
  assert.ok(!first.includes(NAV))
  const ferr = list({ status: 'firstError', total: null, items: [] })
  assert.match(ferr, /role="alert"[\s\S]*지난 질문을 불러오지 못했어요[\s\S]*연결을 확인하고 다시 시도해 주세요\./)
  assert.ok(!ferr.includes(NAV) && !ferr.includes('<ul'))
  const empty = list({ total: 0, items: [], hasNext: false })
  assert.ok(empty.includes('아직 지난 질문이 없어요.') && empty.includes('질문을 보내면 여기에 최근 순으로 쌓여요.'))
  assert.ok(!empty.includes(NAV))
})

test('T12 알약 값은 useAskActivity 만 — 최근 20개(ASK_LIST_LIMIT) 읽기 그대로 · 시트·쪽 훅은 running/newCount 를 계산하지 않는다', () => {
  assert.equal(ASK_LIST_LIMIT, 20)
  assert.match(code('useAskActivity.ts'), /`\/api\/v1\/chats\?kind=ASK&limit=\$\{ASK_LIST_LIMIT\}`/)
  for (const f of ['useAskHistoryPages.ts', 'AskHistorySheet.tsx', 'historyPaging.ts']) {
    const c = code(f)
    assert.ok(!/askActivityOf|newCount|askHistoryState/.test(c), `${f}: 알약 값 계산 0`)
  }
  assert.ok(!/useAskHistoryPages/.test(code('AskChatTab.tsx')), '탭은 쪽 훅을 쓰지 않는다 — 알약은 activity 로만')
  assert.match(code('AskHistorySheet.tsx'), /running=\{rowRunning\(c, live\)\}/, '쪽 행에는 덮어쓰기만')
})

test('27-5 시트 배선 — 삭제는 deleteHistoryRow 한 곳(#31) · 잠금 = rowRunning · 하위 화면 제목 · 저장·삭제 중 닫기 막음 · 확인 화면 describedBy', () => {
  const c = code('AskHistorySheet.tsx')
  assert.equal((c.match(/apiDelete\(/g) ?? []).length, 1)
  assert.match(c, /deleteHistoryRow\(/)
  assert.match(c, /locked: lockedOf\(row\)/)
  assert.match(c, /dismissible=\{!busy\}/)
  assert.match(c, /describedBy=\{sub\.kind === 'confirm' \? confirmBodyId : undefined\}/)
  assert.match(c, /<ChatRenameForm\s+variant="ask"/)
  assert.ok(!/Link|href=|\/ask\//.test(c), '시트에 링크·/ask/<id> 0')
  assert.ok(!/router\.|useRouter|replaceState/.test(c), '주소는 시트가 바꾸지 않는다(부모 replaceUrl 한 곳)')
})
