import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ChatMessageView, ProposalDto } from '@/types/chat'
import { OFF } from '@/components/common/japanese/annotations'
import { readCode } from '../../__tests__/sourceCode'
import { ASK_COPY } from '../askCopy'
import { askMetaOf } from '../logic'
import SourceList from '../SourceList'
import AskAnswer, { answerProposals } from '../AskAnswer'
import AskPending from '../AskPending'
import AskFailed from '../AskFailed'
import { isFocusRoute } from '../../shell/routes'
import { askArrivalText, askPlaceholder, askToastBottom, exampleTexts } from '../AskRoom'

// task-064 §25-11 ⑦⑧⑩⑬⑯⑰⑱ 중 질문 방 몫 — 답 묶음 표시 조건은 렌더 결과로, 방 배선은 주석을 걷은 소스로 잠근다.

const noop = () => {}
const T = '사쿠라 선생님'

function msg(over: Partial<ChatMessageView> & { ask?: unknown } = {}): ChatMessageView {
  return { id: 'a1', role: 'ASSISTANT', content: '답 본문이에요.', status: 'DONE', createdAt: '2026-10-12T03:00:00.000Z', ...over } as ChatMessageView
}
const src = (type: string, id = 'c1', label = '駅に降りて → 駅で降りて') => ({ type, id, date: '2026-10-10', label })
const prop = (id: string, kind: string, messageId = 'a1', payload: Record<string, unknown> = {}): ProposalDto =>
  ({ id, kind, payload, status: 'PROPOSED', messageId }) as ProposalDto

function answer(m: ChatMessageView, opts: { isLast?: boolean; idle?: boolean; proposals?: ProposalDto[] } = {}) {
  return renderToStaticMarkup(
    createElement(AskAnswer, {
      m,
      isLast: opts.isLast ?? true,
      idle: opts.idle ?? true,
      chatId: 'q1',
      teacherName: '사쿠라',
      title: T,
      proposals: opts.proposals ?? [],
      annOf: () => OFF,
      onPickScope: noop,
      onOwnScope: noop,
      onProposalChange: noop,
      onToast: noop,
    }),
  )
}
const has = (h: string, s: string) => h.includes(s)

test('⑦ LOW + 근거 → 답 맨 위 한 줄(근거를 눌러…) + 근거 영역, 순서 = 정보 줄 → 본문 → 근거', () => {
  const h = answer(msg({ ask: { confidence: 'LOW', sources: [src('CORRECTION')], needsScope: null, records: { intent: 'CORRECTIONS', count: 1 } } }))
  assert.ok(has(h, ASK_COPY.lowBold) && has(h, ASK_COPY.lowWithSources))
  assert.ok(has(h, ASK_COPY.sourcesHead))
  assert.ok(h.indexOf(ASK_COPY.lowBold) < h.indexOf('답 본문이에요.'))
  assert.ok(h.indexOf('답 본문이에요.') < h.indexOf(ASK_COPY.sourcesHead))
  assert.ok(h.indexOf('</article>') < h.indexOf(ASK_COPY.sourcesHead), '근거는 답 카드 밖, 아래')
  assert.ok(has(h, `aria-label="${ASK_COPY.answerAria(T)}"`))
})

test('⑦ LOW + 근거 없음 → 「중요한 건 한 번 더…」, HIGH·MEDIUM 은 줄 없음', () => {
  const low = answer(msg({ ask: { confidence: 'LOW', sources: [], needsScope: null, records: null } }))
  assert.ok(has(low, ASK_COPY.lowNoSources) && !has(low, ASK_COPY.lowWithSources))
  for (const c of ['HIGH', 'MEDIUM']) {
    const h = answer(msg({ ask: { confidence: c, sources: [src('LESSON')], needsScope: null, records: null } }))
    assert.ok(!has(h, ASK_COPY.lowBold), c)
  }
})

test('⑦ GENERAL·빈 근거 → 근거 영역(머리 포함) 0, 기록 없음 줄 0', () => {
  const h = answer(msg({ ask: { confidence: 'HIGH', sources: [], needsScope: null, records: { intent: 'GENERAL', count: 0 } } }))
  assert.ok(!has(h, ASK_COPY.sourcesHead) && !has(h, ASK_COPY.noneBold))
  assert.ok(!has(h, '<section'))
})

test('⑦ 기록 없음 줄 — intent≠GENERAL && count=0 만', () => {
  assert.ok(has(answer(msg({ ask: { confidence: 'MEDIUM', sources: [], needsScope: null, records: { intent: 'PROGRESS', count: 0 } } })), ASK_COPY.noneBold))
  assert.ok(!has(answer(msg({ ask: { confidence: 'MEDIUM', sources: [], needsScope: null, records: { intent: 'PROGRESS', count: 2 } } })), ASK_COPY.noneBold))
  assert.ok(!has(answer(msg({ ask: { confidence: 'MEDIUM', sources: [], needsScope: null, records: null } })), ASK_COPY.noneBold))
})

test('⑦ 되묻기 칩 — 가장 최근 답·쉬는 중에만, 본문에 없는 되묻기 문장은 따로 한 줄', () => {
  const ask = { confidence: 'MEDIUM', sources: [], records: null, needsScope: { prompt: '어느 기간을 볼까요?', options: [{ key: 'THIS_WEEK', label: '이번 주' }, { key: 'LAST_30D', label: '지난 30일' }] } }
  const h = answer(msg({ ask }))
  assert.ok(has(h, `aria-label="${ASK_COPY.scopeGroup}"`) && has(h, '이번 주') && has(h, ASK_COPY.scopeOwn))
  assert.ok(has(h, '어느 기간을 볼까요?'), 'promptExtra')
  assert.ok(h.indexOf('답 본문이에요.') < h.indexOf('어느 기간을 볼까요?') && h.indexOf('어느 기간을 볼까요?') < h.indexOf(ASK_COPY.scopeGroup))
  assert.ok(!has(answer(msg({ ask }), { isLast: false }), ASK_COPY.scopeGroup))
  assert.ok(!has(answer(msg({ ask }), { idle: false }), ASK_COPY.scopeGroup))
  const inBody = answer(msg({ content: '어느 기간을 볼까요?', ask }))
  assert.equal(inBody.split('어느 기간을 볼까요?').length - 1, 1, '본문에 있으면 다시 쓰지 않음')
})

test('⑦ ask 칸이 없거나 모양이 이상하면 본문만(줄·근거·칩 없음)', () => {
  for (const a of [undefined, null, 3, ['x']]) {
    const h = answer(msg({ ask: a }))
    assert.ok(has(h, '답 본문이에요.') && !has(h, ASK_COPY.lowBold) && !has(h, ASK_COPY.sourcesHead) && !has(h, ASK_COPY.scopeGroup), String(a))
  }
})

test('답 본문 안 링크·HTML 은 그리지 않는다 — <a>·href 는 근거 카드에만', () => {
  const content = '[눌러](javascript:alert(1)) <img src=x onerror=alert(1)> https://example.com www.example.com 끝'
  const h = answer(msg({ content, ask: { confidence: 'HIGH', sources: [], needsScope: null, records: null } }))
  for (const bad of ['<a ', 'href=', '<img', 'onerror', 'javascript:', 'https://', 'www.']) assert.ok(!has(h, bad), bad)
  assert.ok(has(h, '눌러'))
})

test('제안 카드 — 그 답의 ADD_WORD·ADD_STUDY_LOG·SET_LEVEL 만(ADD_TOPIC·모르는 kind·다른 답 것은 없음), 근거 아래', () => {
  const ps = [
    prop('p1', 'ADD_STUDY_LOG'),
    prop('p2', 'ADD_TOPIC', 'a1', { title: '주제' }),
    prop('p3', 'SCHEDULE_REVIEW'),
    prop('p4', 'SET_LEVEL', 'a1', { level: 'N4', fromLevel: 'N5' }),
    prop('p5', 'ADD_STUDY_LOG', 'other'),
  ]
  assert.deepEqual(answerProposals(ps, 'a1').map((p) => p.id), ['p1', 'p4'])
  const h = answer(msg({ ask: { confidence: 'HIGH', sources: [src('LESSON', 'l1')], needsScope: null, records: null } }), { proposals: ps })
  assert.ok(has(h, ASK_COPY.studyLog.q) && has(h, ASK_COPY.level.cap))
  assert.ok(!has(h, '주제 제안'))
  assert.ok(h.indexOf(ASK_COPY.sourcesHead) < h.indexOf(ASK_COPY.studyLog.q), '답 → 근거 → 제안(D7 A)')
})

test('근거 카드 — 상세·기본 화면은 링크(›), 집계 항목(id:null)·모르는 유형은 정적 카드(링크·버튼·초점·› 없음, 모르는 유형은 라벨만)', () => {
  const sources = [
    src('LESSON', 'l1', '수업 표현'),
    { type: 'STUDY_LOG', id: null, date: '2026-10-10', label: '이번 주 공부 4번' },
    { type: 'CORRECTION', id: null, date: '2026-10-10', label: '조사 교정 누적 5개' },
  ]
  const h = renderToStaticMarkup(createElement(SourceList, { chatId: 'q1', sources: sources as never }))
  assert.equal(h.split('<a ').length - 1, 2, '수업 상세 + 계획표 기본 화면')
  assert.ok(has(h, 'href="/study/today/talk/l1"') && has(h, 'href="/plan"'))
  const statics = h.split('<div class=').slice(1)
  assert.equal(statics.length, 1)
  assert.ok(has(statics[0], '교정 · ') && has(statics[0], '조사 교정 누적 5개') && !has(statics[0], '›') && !has(statics[0], 'tabindex') && !has(statics[0], 'role='))
  assert.ok(!has(h, '<button'), '3장 이하 — 더 보기 없음')

  const meta = askMetaOf({ sources: [{ type: 'FUTURE_KIND', id: 'x1', date: '2026-10-10', label: '새 종류 기록' }], confidence: 'HIGH', needsScope: null, records: null })
  const u = renderToStaticMarkup(createElement(SourceList, { chatId: 'q1', sources: meta?.sources ?? [] }))
  assert.ok(has(u, '새 종류 기록') && !has(u, '<a ') && !has(u, '›'))
  assert.ok(!Object.values(ASK_COPY.sourceType).some((t) => has(u, `${t} · `)), '모르는 유형은 머리 줄 없음')
})

test('⑧ 대기 카드 — 단계 문장 status, 경과 초 숨김, 버튼 0(「나가서 기다리기」 없음)', () => {
  const h = renderToStaticMarkup(createElement(AskPending, { teacherName: '사쿠라', title: T, stage: 'LLM', phase: 'streaming', since: null }))
  assert.ok(has(h, `role="status"`) && has(h, ASK_COPY.stageMain[1]))
  assert.ok(!has(h, '<button') && !has(h, '나가서 기다리기'))
})

test('⑩ 실패 카드 — 시간 초과/답 불가 문구, [다시 받기] 늘 있음', () => {
  const t = renderToStaticMarkup(createElement(AskFailed, { teacherName: '사쿠라', title: T, failure: { text: 'x', retryable: false, code: 'ENGINE_TIMEOUT' } as never, busy: false, onRetry: noop }))
  assert.ok(has(t, ASK_COPY.failTimeout) && has(t, `>${ASK_COPY.retryGet}</button>`))
  const u = renderToStaticMarkup(createElement(AskFailed, { teacherName: '사쿠라', title: T, failure: null, busy: true, onRetry: noop }))
  assert.ok(has(u, ASK_COPY.failUnavail) && has(u, ASK_COPY.retryGetBusy))
})

test('입력 바 안내 문구 — [직접 쓸게요] 뒤 > 기다리는 중 > 기본', () => {
  assert.equal(askPlaceholder({ scopeOwn: true, busy: false }), ASK_COPY.placeholderScopeOwn)
  assert.equal(askPlaceholder({ scopeOwn: false, busy: true }), ASK_COPY.placeholderWaiting)
  assert.equal(askPlaceholder({ scopeOwn: false, busy: false }), ASK_COPY.placeholder)
})

test('도착 알림 한 줄 — 근거·제안 수(0 은 뺌, 아는 제안 종류만)', () => {
  const m = msg({ ask: { confidence: 'HIGH', sources: [src('LESSON', 'l1'), src('REVIEW', 'r1')], needsScope: null, records: null } })
  assert.equal(askArrivalText(T, m, [prop('p1', 'ADD_WORD'), prop('p2', 'ADD_TOPIC')]), `${T} 답이 도착했어요 · 근거 2개 · 제안 1개`)
  assert.equal(askArrivalText(T, msg(), []), `${T} 답이 도착했어요`)
})

test('예문 분석 요청 — 끝난 선생님 답의 예문 일본어 줄만(중복 없이), 내 질문·대기·실패 답은 제외', () => {
  const ex = '> 駅で降りてください。\n> → 역에서 내려 주세요.'
  const ms = [
    msg({ id: 'u1', role: 'USER', content: '> 駅で降りてください。' }),
    msg({ id: 'a1', content: `설명\n\n${ex}` }),
    msg({ id: 'a2', content: ex }),
    msg({ id: 'a3', content: '> 待ってください。', status: 'FAILED' }),
  ]
  assert.deepEqual(exampleTexts(ms), ['駅で降りてください。'])
})

const room = () => readCode('src/components/ask/AskRoom.tsx')

test('⑯⑰ 대화 배선(§26-5 B) — 공용 부품을 질문 옵션으로(분석 끔·낭독 끔·초점·안내 문구·도착 알림), 관문·표시 바 없음', () => {
  const r = room()
  for (const s of [
    'annotate={false}',
    'liveOff',
    'focusable',
    'followContent',
    'arrivalAlign="answer-start"',
    'pillLabel={ASK_COPY.newAnswer}',
    'toReply: askReplyFromDone',
    'forgetAskReturn()',
    'removeId(ASK_KEYS.waiting, chatId)',
    'removeId(ASK_KEYS.newAnswer, chatId)',
    'addId(ASK_KEYS.waiting, chatId)',
    'role="status"',
    "keys={['fu', 'hg']}",
    'busyReason: loading ? ASK_COPY.loadingConv : ASK_COPY.sendLocked',
    'restoreText: (text, info) => inputRef.current?.onRestore(text, info)',
    '<ScopeLine onOpen={() => setScopeOpen(true)} />',
    'extraTop={<AskMenuTop',
    'lead={greeting ?',
    'tail={input.tail ?? undefined}',
  ])
    assert.ok(r.includes(s), s)
  assert.match(r, /const title = teacherTitle\(teacherName\)/)
  // D8 — 머리 아래 표시 바 없음(⋯ 메뉴로)
  assert.ok(!r.includes('<DisplayBar'), '표시 바는 메뉴로 옮겼다')
  // 말 질문은 REALTIME_STT 만(발화 id 없음) — 보내는 길은 doSend 하나
  assert.match(r, /void send\(text, \{ \.\.\.extra, \.\.\.askSendOptions\(via\) \}\)/)
  assert.ok(!/utteranceId/.test(r))
})

test('⑤ 첫 전송 배선 — takeSeed 가 true 일 때만 보내고(#29 없이), 아니면 #29 로 읽어 이어받는다', () => {
  const r = room()
  assert.match(r, /if \(takeSeed\(s\) && s\) \{\s*listRef\.current\?\.scrollToBottom\(\)\s*void send\(s\.text, askSendOptions\(s\.via\)\)\s*return\s*\}/)
  assert.match(r, /if \(detail\.chat\.running\) attach\(turnBaseOf\(detail\.messages\)\)/)
})

test('불러오기 결과 — 404·질문 아닌 대화(옛 /ask/<회화 id>)는 onGone, 그 밖 오류는 onLoadFailed(화면 안 오류·다른 방으로 보내기 없음, §27-7 A·L3)', () => {
  const r = room()
  assert.match(r, /if \(detail\.chat\.kind !== 'ASK'\) \{\s*goneRef\.current\(\)\s*return\s*\}/)
  assert.match(r, /if \(toErr\(e\)\.status === 404\) goneRef\.current\(\)\s*else failedRef\.current\(\)/)
  assert.match(r, /onNotFound: \(\) => goneRef\.current\(\)/)
  assert.ok(!/setLoad\('(notFound|error)'\)/.test(r) && !r.includes('ErrorBlock') && !r.includes('LoadingBlock'))
})

test('머리(§27-2·27-3 B) — AppBar heading = AskHeadTitle(불러온 뒤에만 ready), 머리 제목 = ⋯ 메뉴를 제목 칸으로 바로, 저장하면 부모 힌트도 맞춤 · 힌트 바뀌면 렌더 중 chat.title', () => {
  const r = room()
  assert.match(r, /const ready = load === 'ready' && !!chat/)
  assert.match(r, /heading=\{<AskHeadTitle state=\{ready \? 'ready' : 'loading'\} title=\{chat\?\.title \?\? titleHint\} onRename=\{\(\) => setMenu\('rename'\)\} \/>\}/)
  assert.match(r, /<AskMenuButton onClick=\{\(\) => setMenu\('menu'\)\} \/>/)
  assert.match(r, /open=\{menu !== null\}\s*startMode=\{menu \?\? 'menu'\}/)
  assert.match(r, /setChat\(\(c\) => \(c \? \{ \.\.\.c, title: t \} : c\)\)\s*onTitleChange\(chatId, t\)/)
  assert.match(r, /if \(titleHint !== seenHint\) \{\s*setSeenHint\(titleHint\)\s*if \(titleHint && chat && chat\.title !== titleHint\) setChat\(\{ \.\.\.chat, title: titleHint \}\)/)
  // 새 질문 시작은 늘 부모(D4 — 주소 갱신 한 곳)
  assert.match(r, /const newQ = \(\) => \{\s*setMenu\(null\)\s*onNewConversation\(\)\s*\}/)
})

test('토스트 위치(§26-8 D) — 글자 181 · 말 237, 키보드가 열리면 하단 탭 몫 0(글자 109 · 말 165)', () => {
  assert.equal(askToastBottom({ mode: 'text', kbOpen: false }), 181)
  assert.equal(askToastBottom({ mode: 'voice', kbOpen: false }), 237)
  assert.equal(askToastBottom({ mode: 'text', kbOpen: true }), 109)
  assert.equal(askToastBottom({ mode: 'voice', kbOpen: true }), 165)
})

test('금기 — HTML 주입·취소 요청·나가기 버튼·엔진 이름 0', () => {
  for (const f of ['AskRoom.tsx', 'AskAnswer.tsx', 'ScopeNoticeSheet.tsx']) {
    const s = readCode(`src/components/ask/${f}`)
    for (const bad of ['dangerouslySetInnerHTML', 'innerHTML', 'DOMParser', '나가서 기다리기', '/cancel', 'getUserMedia'])
      assert.ok(!s.includes(bad), `${f}:${bad}`)
    assert.doesNotMatch(s, /claude|haiku|sonnet|opus|qwen|reazon|whisper|style-bert|sherpa|zipformer|onnx/i, f)
  }
})

test('⑰ 라우트 — 옛 지난 대화 page 는 task-067 D5 로 `/ask?chat=<id>` 리다이렉트만(AskRoom 을 그리지 않음, 상세는 `src/app/(app)/_lib/__tests__/askLegacyRoom.test.ts`), 같은 폴더에 loading.tsx 없음', () => {
  const p = readCode('src/app/(app)/ask/[chatId]/page.tsx')
  assert.ok(p.includes('await auth()') && p.includes('/login?callbackUrl=') && p.includes('redirect(target)'))
  assert.doesNotMatch(p, /<AskRoom\b/)
  assert.equal(existsSync('src/app/(app)/ask/[chatId]/loading.tsx'), false)
})

const askDir = join(__dirname, '..')
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? (f === '__tests__' ? [] : walk(p)) : /\.(ts|tsx)$/.test(f) ? [p] : []
  })
}

test('T21 room 0 — 질문 화면에 room 변형·BackBar·옛 /ask/<id> 주소 0 · 집중 화면 목록에 /ask/ 없음(하단 탭 늘 보임)', () => {
  for (const f of walk(askDir)) {
    const c = readCode(f)
    for (const bad of ['variant="room"', "'room'", 'BackBar', 'AskVariant', 'askRoomRedirect', 'returnHref']) assert.ok(!c.includes(bad), `${f}: ${bad}`)
    assert.ok(!/[`'"]\/ask\/\$?\{?/.test(c), `${f}: 옛 /ask/<id> 주소`) // SourceList 대체값 `/ask/${id}` 를 되살리면 실패
  }
  assert.ok(!readCode('src/components/shell/routes.ts').includes("'/ask/'"))
  assert.equal(isFocusRoute('/ask/abc'), false) // routes 에 '/ask/' 를 되살리면 실패
  assert.equal(isFocusRoute('/ask'), false)
  // 근거 카드 → 집중 화면 → 「질문으로」 는 늘 탭 화면의 그 대화(리다이렉트를 거치지 않음)
  assert.match(readCode(join(askDir, 'SourceList.tsx')), /rememberAskReturn\(askChatHref\(chatId\), href\.split\('\?'\)\[0\]\)/)
  // 채팅방 주소로 연 질문 대화도 탭 화면으로 바로
  assert.match(readCode('src/components/chat/ChatRoom.tsx'), /if \(detail\.chat\.kind === 'ASK'\) \{\s*router\.replace\(askChatHref\(chatId\)\)/)
})
