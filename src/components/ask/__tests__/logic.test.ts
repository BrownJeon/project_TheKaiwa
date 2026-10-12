import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { ChatMessageView, TurnDoneEvent } from '@/types/chat'
import { turnNoticeText } from '../../chat/labels'
import {
  ASK_ID_SET_MAX,
  ASK_KEYS,
  addId,
  arrivedTransitions,
  askAnswerView,
  askElapsedSec,
  askFailureCopy,
  askMetaOf,
  askNoticeText,
  askPendingSince,
  askPendingView,
  askReplyFromDone,
  askSourceHref,
  askTitleOf,
  idsAdd,
  isAskFocusTarget,
  isAskProposalKind,
  parseIdSet,
  readIds,
  removeId,
  teacherTitle,
} from '../logic'
import { ASK_COPY } from '../askCopy'

// task-064 §25-11 ⑤~⑬ — 화면이 고르는 값은 순수 함수에서 정하고 여기서 잠근다.

const src = (type: string, id = 'abc_123', date = '2026-10-10', label = '駅に降りて → 駅で降りて') => ({ type, id, date, label })

test('⑤ askSourceHref — 6 유형 주소(교정 n=50 · 공부 기록은 그 날짜의 달 · 상황은 역할극 방)', () => {
  assert.equal(askSourceHref(src('CORRECTION') as never), '/drawer/corrections?focus=abc_123&n=50')
  assert.equal(askSourceHref(src('LESSON') as never), '/study/today/talk/abc_123')
  assert.equal(askSourceHref(src('SCENARIO', 'chat_9') as never), '/study/ai/talk/chat_9')
  assert.equal(askSourceHref(src('REVIEW') as never), '/study/today')
  assert.equal(askSourceHref(src('EVALUATION') as never), '/study/today/eval/abc_123')
  assert.equal(askSourceHref(src('STUDY_LOG', 'log1', '2026-09-30') as never), '/plan?month=2026-09&day=2026-09-30&log=log1')
})

test('⑤ askSourceHref — id 형식 이상(공백·/·65자·빈 값)·날짜 이상·모르는 유형(WORD 포함) → null', () => {
  for (const type of ['CORRECTION', 'LESSON', 'SCENARIO', 'REVIEW', 'EVALUATION', 'STUDY_LOG']) {
    for (const id of ['a b', 'a/b', 'x'.repeat(65), '', '../x', 'a%2Fb']) assert.equal(askSourceHref(src(type, id) as never), null, `${type} ${id}`)
    assert.notEqual(askSourceHref(src(type, 'x'.repeat(64)) as never), null, type)
  }
  assert.equal(askSourceHref(src('STUDY_LOG', 'log1', '2026-9-3') as never), null)
  assert.equal(askSourceHref(src('STUDY_LOG', 'log1', '') as never), null)
  assert.equal(askSourceHref(src('WORD') as never), null)
  assert.equal(askSourceHref(src('NOPE') as never), null)
  assert.equal(askSourceHref({ type: null, id: 'abc_123', date: '2026-10-10' }), null)
})

test('⑤ askSourceHref — 집계 항목(id:null)은 유형별 기본 화면만: 공부 기록 → 계획표, 복습 → 공부 탭, 그 밖·모르는 유형 → null(계약 §2-18-A 3항)', () => {
  const agg = (type: string | null) => askSourceHref({ type: type as never, id: null, date: '2026-10-10' })
  assert.equal(agg('STUDY_LOG'), '/plan')
  assert.equal(agg('REVIEW'), '/study/today')
  for (const t of ['CORRECTION', 'LESSON', 'SCENARIO', 'EVALUATION', 'WORD', null]) assert.equal(agg(t), null, String(t))
  assert.equal(askSourceHref({ type: 'STUDY_LOG', id: null, date: '' }), '/plan', '날짜가 없어도 계획표')
})

test('⑤ 「질문으로」 돌아오기 대상은 ← 머리가 있는 집중 화면(수업·평가·역할극)뿐', () => {
  assert.ok(isAskFocusTarget('LESSON') && isAskFocusTarget('EVALUATION') && isAskFocusTarget('SCENARIO'))
  for (const t of ['CORRECTION', 'REVIEW', 'STUDY_LOG']) assert.ok(!isAskFocusTarget(t as never))
})

test('⑥ askMetaOf — 모르는 근거 유형은 type:null 로 남김(라벨만) · id 가 문자열이 아니거나 비면 null · 빈 라벨·객체 아님 버림 · confidence 밖 → MEDIUM · 칩 모르는 키·빈 라벨 버림 · records 이상 → null', () => {
  const meta = askMetaOf({
    sources: [
      src('LESSON'),
      src('WORD'),
      { type: 'CORRECTION', id: 1, date: 'x', label: 'y' },
      { type: 'STUDY_LOG', id: null, date: '2026-10-01', label: '이번 주 공부 4번' },
      src('REVIEW', '', '2026-10-01', '복습 대기 3개'),
      src('REVIEW', 'r1', '2026-10-01', '   '),
      'junk',
    ],
    confidence: 'SURE',
    needsScope: { prompt: '언제 기록을 볼까요?', options: [{ key: 'THIS_WEEK', label: '이번 주' }, { key: 'YEAR', label: '올해' }, { key: 'ALL', label: '' }, null] },
    records: { intent: 'PROGRESS', count: -1 },
  })
  assert.ok(meta)
  assert.deepEqual(meta.sources, [
    src('LESSON'),
    { ...src('WORD'), type: null },
    { type: 'CORRECTION', id: null, date: 'x', label: 'y' },
    { type: 'STUDY_LOG', id: null, date: '2026-10-01', label: '이번 주 공부 4번' },
    { type: 'REVIEW', id: null, date: '2026-10-01', label: '복습 대기 3개' },
  ])
  assert.equal(meta.confidence, 'MEDIUM')
  assert.deepEqual(meta.needsScope, { prompt: '언제 기록을 볼까요?', options: [{ key: 'THIS_WEEK', label: '이번 주' }] })
  assert.equal(meta.records, null)
  assert.deepEqual(askMetaOf({ sources: [], confidence: 'LOW', needsScope: null, records: { intent: 'GENERAL', count: 0 } }), {
    sources: [],
    confidence: 'LOW',
    needsScope: null,
    records: { intent: 'GENERAL', count: 0 },
  })
  for (const bad of [null, undefined, [], 3, 'x', true]) assert.equal(askMetaOf(bad), null)
  assert.equal(askMetaOf({ sources: 'x', confidence: 'HIGH' })?.sources.length, 0)
})

test('⑥ askReplyFromDone — 본문 = answerMd, 번역 null, 구조값은 ask 로', () => {
  const dn = {
    userMessageId: 'u1',
    assistantMessageId: 'a1',
    conversation: { answerMd: '**답**', replyKo: null, sources: [src('LESSON')], confidence: 'HIGH', needsScope: null, records: { intent: 'MIXED', count: 1 } },
  } as unknown as TurnDoneEvent
  const r = askReplyFromDone(dn)
  assert.equal(r.content, '**답**')
  assert.equal(r.translation, null)
  assert.equal(r.status, 'DONE')
  assert.equal(r.ask?.confidence, 'HIGH')
  assert.equal(r.ask?.sources.length, 1)
  assert.equal(askReplyFromDone({ ...dn, conversation: { replyJa: 'x' } } as unknown as TurnDoneEvent).content, '')
})

const msg = (ask: unknown, content = '본문'): ChatMessageView => ({ id: 'a1', role: 'ASSISTANT', content, status: 'DONE', createdAt: '2026-10-12T00:00:00Z', ask } as unknown as ChatMessageView)
const meta = (o: Record<string, unknown>) => ({ sources: [], confidence: 'MEDIUM', needsScope: null, records: null, ...o })

test('⑦ askAnswerView — LOW 줄(근거 유무) · HIGH·MEDIUM 조용 · 기록 없음 줄 · 근거 영역 · 칩 · promptExtra', () => {
  const on = { isLast: true, idle: true }
  assert.equal(askAnswerView(msg(meta({ confidence: 'LOW', sources: [src('LESSON')] })), on).lowLine, 'withSources')
  assert.equal(askAnswerView(msg(meta({ confidence: 'LOW' })), on).lowLine, 'noSources')
  assert.equal(askAnswerView(msg(meta({ confidence: 'HIGH' })), on).lowLine, null)
  assert.equal(askAnswerView(msg(meta({ confidence: 'MEDIUM' })), on).lowLine, null)
  assert.equal(askAnswerView(msg(meta({ records: { intent: 'PROGRESS', count: 0 } })), on).noneLine, true)
  assert.equal(askAnswerView(msg(meta({ records: { intent: 'GENERAL', count: 0 } })), on).noneLine, false)
  assert.equal(askAnswerView(msg(meta({ records: { intent: 'EXPRESSION', count: 2 } })), on).noneLine, false)
  assert.equal(askAnswerView(msg(meta({})), on).noneLine, false)
  assert.equal(askAnswerView(msg(meta({ sources: [] })), on).showSources, false)
  assert.equal(askAnswerView(msg(meta({ sources: [src('LESSON')] })), on).showSources, true)
  const ns = { prompt: '언제 기록을 볼까요?', options: [{ key: 'ALL', label: '전체 기간' }] }
  assert.equal(askAnswerView(msg(meta({ needsScope: ns })), on).chips, true)
  assert.equal(askAnswerView(msg(meta({ needsScope: ns })), { isLast: false, idle: true }).chips, false)
  assert.equal(askAnswerView(msg(meta({ needsScope: ns })), { isLast: true, idle: false }).chips, false)
  assert.equal(askAnswerView(msg(meta({ needsScope: ns })), on).promptExtra, true)
  assert.equal(askAnswerView(msg(meta({ needsScope: ns }), '답이에요.\n\n언제 기록을 볼까요?'), on).promptExtra, false)
  const bare = askAnswerView(msg(undefined), on)
  assert.deepEqual(bare, { lowLine: null, noneLine: false, showSources: false, chips: false, promptExtra: false })
})

test('⑦-b noneLine — 서버가 규칙으로 즉시 되묻는 답(needsScope 있음 + records.count 0)에는 「관련 기록을 못 찾았어요」 줄이 뜨지 않는다 · needsScope 가 없을 때만', () => {
  const ns = { prompt: '언제 기록을 볼까요?', options: [{ key: 'THIS_WEEK', label: '이번 주' }, { key: 'ALL', label: '전체 기간' }] }
  for (const isLast of [true, false]) {
    for (const idle of [true, false]) {
      for (const intent of ['PROGRESS', 'EXPRESSION', 'MIXED']) {
        const v = askAnswerView(msg(meta({ needsScope: ns, records: { intent, count: 0 } })), { isLast, idle })
        assert.equal(v.noneLine, false, `되묻기 답 ${intent} isLast=${isLast} idle=${idle}`)
      }
    }
  }
  // needsScope 가 없으면 기존 그대로 — 기록 질문(GENERAL 아님)인데 0건이면 줄을 그린다
  for (const intent of ['PROGRESS', 'EXPRESSION', 'MIXED']) {
    assert.equal(askAnswerView(msg(meta({ needsScope: null, records: { intent, count: 0 } })), { isLast: true, idle: true }).noneLine, true, intent)
  }
  assert.equal(askAnswerView(msg(meta({ needsScope: null, records: { intent: 'GENERAL', count: 0 } })), { isLast: true, idle: true }).noneLine, false)
  assert.equal(askAnswerView(msg(meta({ needsScope: null, records: { intent: 'PROGRESS', count: 3 } })), { isLast: true, idle: true }).noneLine, false)
  // 되묻기 답의 다른 칸은 그대로 — 칩·안내 문장은 계속 그린다
  const asked = askAnswerView(msg(meta({ needsScope: ns, records: { intent: 'PROGRESS', count: 0 } })), { isLast: true, idle: true })
  assert.equal(asked.chips, true)
  assert.equal(asked.promptExtra, true)
})

test('AskSource.id 는 string | null — 서버 집계 항목(id:null)이 화면 타입과 정합: askMetaOf 가 id:null 을 보존하고 askSourceHref 가 기본 화면으로 보낸다', () => {
  const m = askMetaOf({
    sources: [
      { type: 'STUDY_LOG', id: null, date: '2026-10-06', label: '이번 주 공부 요약' },
      { type: 'REVIEW', id: null, date: '2026-10-12', label: '복습 대기 3개' },
      { type: 'CORRECTION', id: 'cr_1', date: '2026-10-10', label: '교정' },
    ],
    confidence: 'HIGH',
    needsScope: null,
    records: { intent: 'PROGRESS', count: 3 },
  })
  assert.deepEqual(m?.sources.map((x) => x.id), [null, null, 'cr_1'])
  const hrefs = m?.sources.map((x) => askSourceHref(x))
  assert.deepEqual(hrefs, ['/plan', '/study/today', '/drawer/corrections?focus=cr_1&n=50'])
})

test('⑧ askPendingView — 단계 매핑 · 단계 없음 0 · 이어받은 대기 5초 경계 · 초 표시 5초부터 · 안내 30·90초', () => {
  assert.equal(askPendingView('PROMPT', 'streaming', 0).step, 0)
  assert.equal(askPendingView('LLM', 'streaming', 0).step, 1)
  assert.equal(askPendingView('PARSE', 'streaming', 0).step, 2)
  assert.equal(askPendingView(null, 'sending', 12).step, 0)
  assert.equal(askPendingView(null, 'detached', 4).step, 0)
  assert.equal(askPendingView(null, 'detached', 5).step, 1)
  assert.equal(askPendingView('PARSE', 'detached', 1).step, 2)
  assert.equal(askPendingView(null, 'streaming', 4).showSec, false)
  assert.equal(askPendingView(null, 'streaming', 5).showSec, true)
  assert.equal(askPendingView(null, 'streaming', 29).hint, null)
  assert.equal(askPendingView(null, 'streaming', 30).hint, 'h30')
  assert.equal(askPendingView(null, 'streaming', 89).hint, 'h30')
  assert.equal(askPendingView(null, 'streaming', 90).hint, 'h90')
})

test('⑧ askPendingSince — 이 화면에서 보낸 턴은 시작 시각, 이어받은 대기는 마지막 내 질문 시각 · 경과 초 음수 → 0', () => {
  const ms = [
    { id: 'u0', role: 'USER', content: 'q0', status: 'DONE', createdAt: '2026-10-12T00:00:00Z' },
    { id: 'a0', role: 'ASSISTANT', content: 'x', status: 'DONE', createdAt: '2026-10-12T00:00:10Z' },
    { id: 'u1', role: 'USER', content: 'q1', status: 'DONE', createdAt: '2026-10-12T00:01:00Z' },
    { id: 'a1', role: 'ASSISTANT', content: '', status: 'PENDING', createdAt: '2026-10-12T00:01:01Z' },
  ] as ChatMessageView[]
  assert.equal(askPendingSince('streaming', 1234, ms), 1234)
  assert.equal(askPendingSince('detached', 9999, ms), Date.parse('2026-10-12T00:01:00Z'))
  assert.equal(askPendingSince('detached', 9999, []), 9999)
  assert.equal(askElapsedSec(Date.parse('2026-10-12T00:01:42Z'), Date.parse('2026-10-12T00:01:00Z')), 42)
  assert.equal(askElapsedSec(1000, 5000), 0)
  assert.equal(askElapsedSec(0, 5000), 0)
  assert.equal(askElapsedSec(5000, null), 0)
})

const rate = (sec: number, reason?: string) => ({ kind: 'rate' as const, text: '', retryAfterSec: sec, ...(reason ? { reason } : {}) })

test('⑨ askNoticeText — 429 초·분·오늘 · ASK_BUSY · 409 기존 문구 · 네트워크 · 400 서버 문구 · 404 · 남은 횟수 없음', () => {
  assert.equal(askNoticeText(rate(12), 12), '질문을 너무 자주 보냈어요. 12초 뒤에 보낼 수 있어요.')
  assert.equal(askNoticeText(rate(90), 90), '질문을 너무 자주 보냈어요. 90초 뒤에 보낼 수 있어요.')
  assert.equal(askNoticeText(rate(91), 91), '질문을 너무 자주 보냈어요. 2분 뒤에 보낼 수 있어요.')
  assert.equal(askNoticeText(rate(3600), 3600), '질문을 너무 자주 보냈어요. 60분 뒤에 보낼 수 있어요.')
  assert.equal(askNoticeText(rate(3601), 3601), '질문을 너무 자주 보냈어요. 오늘은 더 보낼 수 없어요 — 내일 다시 물어봐 주세요.')
  assert.equal(askNoticeText(rate(40000), 3000), '질문을 너무 자주 보냈어요. 오늘은 더 보낼 수 없어요 — 내일 다시 물어봐 주세요.', '하루 한도는 처음 받은 초로 가른다')
  assert.equal(askNoticeText(rate(20), null), '질문을 너무 자주 보냈어요. 20초 뒤에 보낼 수 있어요.', '첫 틱 전에는 받은 초')
  assert.equal(askNoticeText(rate(7, 'ASK_BUSY'), 7), '지금 질문이 몰려 있어요. 7초 뒤에 다시 물어봐 주세요.')
  assert.equal(askNoticeText({ kind: 'rate', text: '', reason: 'ASK_BUSY' }, null), '지금 질문이 몰려 있어요. 잠시 뒤에 다시 물어봐 주세요.')
  assert.equal(askNoticeText({ kind: 'error', text: 'x', status: 409 }, null), turnNoticeText({ status: 409 }))
  assert.equal(askNoticeText({ kind: 'error', text: 'x', status: 0 }, null), '보내지 못했어요. 인터넷 연결을 확인하고 다시 보내 주세요.')
  assert.equal(askNoticeText({ kind: 'error', text: '질문은 1,000자까지예요', status: 400 }, null), '질문은 1,000자까지예요')
  assert.equal(askNoticeText({ kind: 'notFound', text: 'x', status: 404 }, null), '질문 방을 찾을 수 없어요')
  for (const n of [1, 30, 91, 3601]) for (const r of [undefined, 'ASK_BUSY']) assert.doesNotMatch(askNoticeText(rate(n, r), n), /남은|회|번 더|하루 60|분당 3/)
})

test('⑨-b askNoticeText — 429 reason 우선: ASK_DAILY 는 초 값과 무관하게 「오늘」 · ASK_RATE 는 초가 커도 분·초 문구 · reason 이 없거나 모르는 값이면 retryAfterSec>3600 추정으로 폴백', () => {
  const DAY = '질문을 너무 자주 보냈어요. 오늘은 더 보낼 수 없어요 — 내일 다시 물어봐 주세요.'
  // ASK_DAILY: 서버가 하루 한도라고 말했으니 숫자가 작아도(옛 응답·이상값) 「오늘」
  assert.equal(askNoticeText(rate(86000, 'ASK_DAILY'), 86000), DAY)
  assert.equal(askNoticeText(rate(30, 'ASK_DAILY'), 30), DAY, 'retryAfterSec 가 작아도 reason 이 우선')
  assert.equal(askNoticeText(rate(86000, 'ASK_DAILY'), 5), DAY, '카운트다운 끝 무렵에도 오늘 문구 유지')
  assert.equal(askNoticeText({ kind: 'rate', text: '', reason: 'ASK_DAILY' }, null), DAY, '초를 몰라도 오늘 문구')
  // ASK_RATE: 분당 한도 — 초 값이 3600 을 넘어도(비정상) 하루로 추정하지 않는다
  assert.equal(askNoticeText(rate(12, 'ASK_RATE'), 12), '질문을 너무 자주 보냈어요. 12초 뒤에 보낼 수 있어요.')
  assert.equal(askNoticeText(rate(91, 'ASK_RATE'), 91), '질문을 너무 자주 보냈어요. 2분 뒤에 보낼 수 있어요.')
  assert.equal(askNoticeText(rate(5000, 'ASK_RATE'), 5000), '질문을 너무 자주 보냈어요. 84분 뒤에 보낼 수 있어요.', 'reason 이 추정보다 우선')
  assert.equal(askNoticeText({ kind: 'rate', text: '', reason: 'ASK_RATE' }, null), '질문을 너무 자주 보냈어요. 1초 뒤에 보낼 수 있어요.')
  // ASK_BUSY 는 그대로
  assert.equal(askNoticeText(rate(30, 'ASK_BUSY'), 30), '지금 질문이 몰려 있어요. 30초 뒤에 다시 물어봐 주세요.')
  // reason 이 없거나 모르는 값 → 기존 추정
  for (const r of [undefined, '', 'SOMETHING_ELSE']) {
    assert.equal(askNoticeText(rate(3601, r), 3601), DAY, `추정 폴백 ${String(r)}`)
    assert.equal(askNoticeText(rate(40000, r), 3000), DAY, `처음 받은 초로 가른다 ${String(r)}`)
    assert.equal(askNoticeText(rate(3600, r), 3600), '질문을 너무 자주 보냈어요. 60분 뒤에 보낼 수 있어요.', `경계 ${String(r)}`)
    assert.equal(askNoticeText(rate(12, r), 12), '질문을 너무 자주 보냈어요. 12초 뒤에 보낼 수 있어요.', `분 ${String(r)}`)
  }
  // 어떤 갈래도 남은 횟수·한도 숫자를 말하지 않는다
  for (const reason of [undefined, 'ASK_RATE', 'ASK_DAILY', 'ASK_BUSY']) {
    for (const n of [1, 30, 91, 3601, 86000]) assert.doesNotMatch(askNoticeText(rate(n, reason), n), /남은|회|번 더|하루 60|분당 3|\b60\b(?!분|초)/, `${String(reason)} ${n}`)
  }
})

test('⑩ askFailureCopy — 시간 초과만 따로, 그 밖 코드·이어받은 실패는 답 불가(버튼은 화면이 늘 그린다)', () => {
  assert.deepEqual(askFailureCopy({ text: '', retryable: true, code: 'ENGINE_TIMEOUT' }), { title: ASK_COPY.failTimeout, body: ASK_COPY.failTimeoutBody })
  for (const f of [{ text: '', retryable: false, code: 'ENGINE_UNAVAILABLE' }, { text: '', retryable: true, code: 'ENGINE_ERROR' }, { text: '', retryable: true }, null]) {
    assert.deepEqual(askFailureCopy(f), { title: ASK_COPY.failUnavail, body: ASK_COPY.failUnavailBody })
  }
})

test('⑪ askTitleOf — 공백·개행 접기 · 앞 30 코드포인트 · 말줄임표 없음 · 서로게이트 쌍 경계', () => {
  assert.equal(askTitleOf('  오늘\n\n복습할   거\t뭐 있어?  '), '오늘 복습할 거 뭐 있어?')
  assert.equal(askTitleOf('가'.repeat(30)), '가'.repeat(30))
  assert.equal(askTitleOf('가'.repeat(31)), '가'.repeat(30))
  assert.equal(Array.from(askTitleOf('😀'.repeat(40))).length, 30)
  assert.ok(!askTitleOf('가'.repeat(50)).includes('…'))
  assert.equal(askTitleOf(`${'가'.repeat(29)} 나`), '가'.repeat(29))
})

test('⑫ arrivedTransitions — 첫 읽기 토스트 없음 · running→false 만 · waiting 에서 옮김', () => {
  const items = [
    { id: 'a', running: false },
    { id: 'b', running: true },
    { id: 'c', running: false },
  ]
  assert.deepEqual(arrivedTransitions(null, items, new Set()), { fromWaiting: [], fromPolling: [], running: ['b'] })
  assert.deepEqual(arrivedTransitions(null, items, new Set(['a', 'b'])), { fromWaiting: ['a'], fromPolling: [], running: ['b'] })
  assert.deepEqual(arrivedTransitions(new Set(['a', 'b']), items, new Set()), { fromWaiting: [], fromPolling: ['a'], running: ['b'] })
  assert.deepEqual(arrivedTransitions(new Set(['x']), items, new Set()), { fromWaiting: [], fromPolling: [], running: ['b'] })
})

test('⑫ id 집합 — 20개 상한 · 중복 없음 · 깨진 JSON·배열 아님·문자열 아닌 값 → 빈 집합', () => {
  let ids: string[] = []
  for (let i = 0; i < 25; i++) ids = idsAdd(ids, `c${i}`)
  assert.equal(ids.length, ASK_ID_SET_MAX)
  assert.equal(ids[0], 'c5')
  assert.deepEqual(idsAdd(['a', 'b'], 'a'), ['b', 'a'])
  assert.deepEqual(parseIdSet('{bad'), [])
  assert.deepEqual(parseIdSet('{"a":1}'), [])
  assert.deepEqual(parseIdSet(null), [])
  assert.deepEqual(parseIdSet('["a",1,"b",null,"a"]'), ['a', 'b'])
  assert.deepEqual(parseIdSet(JSON.stringify(Array.from({ length: 30 }, (_, i) => `x${i}`))).length, ASK_ID_SET_MAX)
})

test('⑫ id 집합 저장소 — 예외를 던지는 저장소는 빈 집합 · 쓰기 예외도 삼킨다', () => {
  const g = globalThis as { window?: unknown }
  const had = 'window' in g
  const prev = g.window
  const mem = new Map<string, string>()
  g.window = {
    sessionStorage: {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    },
  }
  try {
    addId(ASK_KEYS.waiting, 'r1')
    addId(ASK_KEYS.waiting, 'r2')
    removeId(ASK_KEYS.waiting, 'r1')
    assert.deepEqual(readIds(ASK_KEYS.waiting), ['r2'])
    g.window = {
      sessionStorage: {
        getItem: () => {
          throw new Error('blocked')
        },
        setItem: () => {
          throw new Error('blocked')
        },
        removeItem: () => {
          throw new Error('blocked')
        },
      },
    }
    assert.deepEqual(readIds(ASK_KEYS.waiting), [])
    assert.doesNotThrow(() => addId(ASK_KEYS.newAnswer, 'x'))
  } finally {
    if (had) g.window = prev
    else delete g.window
  }
})

test('⑬ teacherTitle — 「선생님」은 그대로, 이름이면 「이름 선생님」', () => {
  assert.equal(teacherTitle('선생님'), '선생님')
  assert.equal(teacherTitle('사쿠라'), '사쿠라 선생님')
})

test('제안 종류 — ASK 3a 는 단어·기록·레벨만 그린다(주제·복습 일정·모르는 값은 그리지 않음)', () => {
  for (const k of ['ADD_WORD', 'ADD_STUDY_LOG', 'SET_LEVEL']) assert.ok(isAskProposalKind(k))
  for (const k of ['ADD_TOPIC', 'SCHEDULE_REVIEW', 'X']) assert.ok(!isAskProposalKind(k))
})
