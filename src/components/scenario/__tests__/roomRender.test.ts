/**
 * 역할극 회화방 부품(task-010d B2)을 실제 `useRolePlay` 로 정적 렌더해 본다(서버 렌더 — 효과는 돌지 않는다).
 *  - 역할극이 아닌 대화: 방에 얹은 부품이 아무것도 그리지 않고 머리가 예전 모양 그대로(바이트 비교).
 *  - 역할극: 첫마디 방·대화 중·마친 방·녹음 중·글자 모드·수업에서 이어짐, 대답 연습 판 3방식·로딩·실패.
 *  - `TalkRoom.tsx` 의 삽입 줄이 모두 역할극 조건 안에 있는지(소스 검사 — 주석을 걷은 소스에서 본다: 주석 처리한 삽입이 통과하지 않게, REV-194 F-1 과 같은 약점).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { createElement, Fragment, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import TalkRoomHeader from '@/components/talk/TalkRoomHeader'
import type { ChatInfo, ChatMessageView, RolePlayChatView, RolePlayResultView } from '@/types/chat'
import { readCode } from '../../__tests__/sourceCode'
import PracticeDock from '../PracticeDock'
import { RolePlayEndedBar } from '../RolePlayBars'
import RolePlayEndSheet from '../RolePlayEndSheet'
import RolePlayGoalCard from '../RolePlayGoalCard'
import RolePlayIntro, { RolePlaySystemLine } from '../RolePlayIntro'
import type { PracticeView } from '../practiceLogic'
import { END, PRACTICE, ROOM } from '../scenarioCopy'
import { useRolePlay, type RolePlay } from '../useRolePlay'

const ROUTER = { push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {}, forward: () => {}, refresh: () => {} }
const render = (el: ReactElement) => renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: ROUTER as never }, el))

const SC: RolePlayChatView = {
  id: 'sc1',
  title: '카페에서 주문하기',
  titleJa: null,
  roles: { learner: '손님', tutor: '점원' },
  goalKo: '커피를 주문한다',
  steps: [{ ko: '인사' }, { ko: '주문' }, { ko: '계산' }, { ko: '나가기' }],
  keyExpressions: [
    { id: 'e1', ja: 'お願いします', ko: '부탁합니다' },
    { id: 'e2', ja: 'ください', ko: '주세요' },
  ],
  requiredExpressions: 1,
  progress: { usedIds: [], stepIndex: null },
  ended: null,
  lesson: null,
}
const RESULT: RolePlayResultView = {
  replayed: false,
  chatId: 'c1',
  scenarioId: 'sc1',
  studyLogId: 'l1',
  repetitionItemId: null,
  outcome: 'ACHIEVED',
  goalAchieved: true,
  tutorGoalAchieved: true,
  codeRulePassed: true,
  communicationSuccess: true,
  judged: true,
  expressions: { usedIds: ['e1'], missedIds: ['e2'], verifiedIds: ['e1'], required: 1, total: 2 },
  turns: 3,
  hintsUsed: 0,
  selfCorrections: 0,
  pendingCorrections: 0,
  endedAt: '2026-10-07T01:00:00.000Z',
}
const chatOf = (scenario?: RolePlayChatView): ChatInfo => ({ id: 'c1', kind: 'TALK', title: '카페에서 주문하기', running: false, reviewedAt: null, messageCount: 1, ...(scenario ? { scenario } : {}) })
const msg = (id: string, role: 'USER' | 'ASSISTANT', status: 'DONE' | 'PENDING' = 'DONE'): ChatMessageView => ({ id, role, content: 'いらっしゃいませ', status, createdAt: '2026-10-07T00:00:00.000Z' })
const OPENING = [msg('a0', 'ASSISTANT')]
const MID = [msg('a0', 'ASSISTANT'), msg('u1', 'USER'), msg('a1', 'ASSISTANT'), msg('u2', 'USER')]

interface RoomProps {
  chat: ChatInfo | null
  messages: ChatMessageView[]
  talkState?: string
  voice?: boolean
  /** 대답 연습 판 상태를 정적으로 보려고 훅 값 일부를 바꿔 넣는다(클릭 없이). */
  patch?: (rp: RolePlay) => RolePlay
}

/** TalkRoom 이 얹는 순서 그대로(머리 → 목표 카드 → 안내 → 대답 연습 → 마친 바 → 시트) + 입력창 안내. */
function Room({ chat, messages, talkState = 'IDLE', voice = true, patch }: RoomProps) {
  const base = useRolePlay({ chatId: 'c1', chat, messages, talkState, turnBusy: false, listening: talkState === 'RECORDING', notify: () => {}, srAnnounce: () => {}, roomSounding: false, stopRoom: () => {} })
  const rp = patch ? patch(base) : base
  return createElement(
    Fragment,
    null,
    createElement(TalkRoomHeader, { teacherName: '유우', title: chat?.title ?? null, ...rp.header }),
    createElement(RolePlayGoalCard, { rp }),
    createElement(RolePlaySystemLine, { rp }),
    createElement(RolePlayIntro, { rp, teacherName: '유우', voice }),
    createElement(PracticeDock, { rp, voice, textOnly: false, blocked: false, onFill: () => {}, onToast: () => {} }),
    rp.ended ? createElement(RolePlayEndedBar, { rp }) : null,
    createElement(RolePlayEndSheet, { rp }),
    createElement('i', { 'data-placeholder': rp.placeholder ?? '' }),
  )
}
const room = (p: RoomProps) => render(createElement(Room, p))
const strip = (html: string) => html.replace(/<[^>]+>/g, '')

/* ── 역할극이 아닌 대화: 지금과 같다 ───────────────────────────────────── */

test('일반 회화(`chat.scenario` 없음): 얹은 부품은 빈 출력, 머리는 역할극 prop 없이 그린 것과 바이트 동일', () => {
  const plain = render(createElement(TalkRoomHeader, { teacherName: '유우', title: '카페에서 주문하기' }))
  for (const messages of [[], OPENING, MID]) {
    for (const talkState of ['IDLE', 'SPEAKING', 'RECORDING']) {
      assert.equal(room({ chat: chatOf(), messages, talkState }), `${plain}<i data-placeholder=""></i>`, `${messages.length}개·${talkState}`)
    }
  }
  assert.equal(room({ chat: null, messages: [] }), `${render(createElement(TalkRoomHeader, { teacherName: '유우', title: null }))}<i data-placeholder=""></i>`, '불러오는 중')
  // 예전 머리(HEAD) 모양: 제목 h1 은 글자 + sr-only 한 칸, [마치기]·역할 태그 없음
  assert.match(plain, /<h1 class="max-w-full truncate text-\[16px\] font-semibold leading-5">유우<span class="sr-only">/)
  assert.ok(!plain.includes(ROOM.end))
  assert.ok(plain.includes('href="/study/ai?tab=talk"'))
})

test('일반 회화: 훅 값 — 입력창 안내는 정확히 null(방의 기존 문구가 그대로 — P1)·머리 prop 빈 묶음·역할극 아님', () => {
  const seen: RolePlay[] = []
  function Probe({ chat }: { chat: ChatInfo | null }) {
    seen.push(useRolePlay({ chatId: 'c1', chat, messages: MID, talkState: 'IDLE', turnBusy: false, listening: false, notify: () => {}, srAnnounce: () => {}, roomSounding: false, stopRoom: () => {} }))
    return null
  }
  render(createElement(Probe, { chat: chatOf() }))
  render(createElement(Probe, { chat: null }))
  assert.equal(seen.length, 2)
  for (const rp of seen) {
    assert.equal(rp.placeholder, null)
    assert.deepEqual(rp.header, {})
    assert.equal(rp.active, false)
    assert.equal(rp.view, null)
  }
})

/* ── 역할극 ─────────────────────────────────────────────────────────── */

test('rp-open-first: 첫마디 방 — 목표 카드 펼침·시스템 줄·대답 연습 접힌 줄·머리 역할 태그·[마치기]·← 시나리오로', () => {
  const html = room({ chat: chatOf(SC), messages: OPENING })
  assert.match(html, /aria-expanded="true" aria-controls="rp-goal"/)
  assert.ok(html.includes('id="rp-goal"'))
  // 펼친 카드는 높이 상한 안에서 스크롤(REV-141 M-1)
  assert.match(html, /<div id="rp-goal" class="[^"]*max-h-\[40dvh\] overflow-y-auto/)
  assert.ok(html.includes(ROOM.roleTag('점원')))
  assert.ok(html.includes(ROOM.srTitle(SC.title)))
  assert.match(html, /aria-haspopup="dialog"[^>]*>마치기</)
  assert.ok(!/aria-haspopup="dialog" aria-disabled/.test(html) && !/aria-disabled="true" aria-haspopup="dialog"/.test(html), '방이 준비됐고 턴이 없으면 누를 수 있다')
  assert.ok(html.includes('href="/study/ai?tab=scenario"'))
  assert.ok(html.includes(`aria-label="${ROOM.back}"`))
  assert.ok(strip(html).includes(`${ROOM.sysPre}점원${ROOM.sysMid}손님이에요. ${ROOM.sysFirst}`))
  assert.ok(html.includes(PRACTICE.entry) && html.includes(PRACTICE.entrySub))
  assert.ok(html.includes('aria-expanded="false"'), '대답 연습은 접힌 줄')
  // rp-nostep: 단계는 번호만(✓·● 없음, aria-current 없음), 요약 "4단계 · 표현 0/2"
  assert.ok(html.includes(ROOM.summarySteps(4, ROOM.summaryExpr(0, 2))))
  assert.ok(!html.includes('aria-current'))
  assert.ok(!html.includes('●'))
  assert.ok(html.includes('>1.</span>') && html.includes('>4.</span>'))
  // 표현 칩: 일본어 lang, 쓴 것 없음
  assert.ok(!html.includes(ROOM.usedSr))
  assert.equal(html.match(/data-placeholder="([^"]*)"/)?.[1], ROOM.textPlaceholder('손님으로'))
})

test('rp-mid: 대화 중(내 말 ≥1) — 카드는 접힌 채 열리고 요약에 쓴 표현 수, 마지막이 내 말이면 대답 연습 없음', () => {
  const sc = { ...SC, progress: { usedIds: ['e2', 'zz'], stepIndex: null } }
  const html = room({ chat: chatOf(sc), messages: MID })
  assert.match(html, /aria-expanded="false" aria-controls="rp-goal"/)
  assert.ok(!html.includes('id="rp-goal"'))
  assert.ok(html.includes(ROOM.summarySteps(4, ROOM.summaryExpr(1, 2))), '모르는 id(zz)는 세지 않는다')
  assert.ok(!html.includes(PRACTICE.entry))
  // 선생님 말로 끝나면 대답 연습 줄이 다시 나온다
  assert.ok(room({ chat: chatOf(sc), messages: [...MID, msg('a2', 'ASSISTANT')] }).includes(PRACTICE.entry))
  // 진행 중 답(PENDING)·녹음 중에는 자리째 없다
  assert.ok(!room({ chat: chatOf(sc), messages: [...MID, msg('a2', 'ASSISTANT', 'PENDING')] }).includes(PRACTICE.entry))
  assert.ok(!room({ chat: chatOf(sc), messages: OPENING, talkState: 'RECORDING' }).includes(PRACTICE.entry))
  assert.ok(room({ chat: chatOf(sc), messages: OPENING, talkState: 'SPEAKING' }).includes(PRACTICE.entry), '선생님이 말하는 중에도 펼칠 수 있다')
  assert.ok(!room({ chat: chatOf(sc), messages: OPENING, talkState: 'THINKING' }).includes(PRACTICE.entry))
})

test('rp-mid(진행값 있음): 단계 ✓·● 와 aria-current, 요약 "2/4단계"', () => {
  const sc = { ...SC, progress: { usedIds: ['e1'], stepIndex: 1 } }
  const html = room({ chat: chatOf(sc), messages: [msg('a0', 'ASSISTANT')] })
  assert.ok(html.includes(ROOM.summaryStepAt(2, 4, ROOM.summaryExpr(1, 2))))
  assert.ok(html.includes('aria-current="step"'))
  assert.ok(html.includes(`, ${ROOM.stepDoneSr}`) && html.includes(`, ${ROOM.stepNowSr}`))
  assert.ok(html.includes(ROOM.usedSr), '쓴 표현 칩은 ✓ 와 sr 글')
})

test('rp-open-me·rp-text·rp-fromlesson: 첫마디 없는 방 안내(음성·글자), 수업에서 이어짐', () => {
  const lessonSc = { ...SC, lesson: { id: 'L1', title: '카페 표현' } }
  const voice = strip(room({ chat: chatOf(lessonSc), messages: [] }))
  assert.ok(voice.includes(ROOM.introLead('유우는', '점원', '손님이에요')))
  assert.ok(voice.includes(ROOM.introHowVoice('손님이')))
  assert.ok(voice.includes(ROOM.introTry) && voice.includes('お願いします'))
  assert.ok(voice.includes(ROOM.fromLesson('카페 표현')))
  assert.ok(!voice.includes(PRACTICE.entry), '선생님 말이 없으면 대답 연습 없음')
  const text = strip(room({ chat: chatOf(SC), messages: [], voice: false }))
  assert.ok(text.includes(ROOM.introHowText('손님이')))
  assert.ok(!text.includes(ROOM.fromLesson('카페 표현')))
})

test('rp-ended: 마친 방 — 요약 "마침", [마치기] 없음, 대답 연습 없음, 마친 바([결과 보기]·[다시 하기])', () => {
  const html = room({ chat: chatOf({ ...SC, ended: RESULT }), messages: [...MID, msg('a2', 'ASSISTANT')] })
  assert.ok(html.includes(`>${ROOM.summaryEnded}<`))
  assert.ok(!html.includes('aria-haspopup="dialog"'))
  assert.ok(!html.includes(PRACTICE.entry))
  assert.ok(html.includes(ROOM.endedTitle) && html.includes(ROOM.endedResult) && html.includes(ROOM.endedRetry))
  assert.ok(html.includes('max(8px, var(--safe-bottom))'))
  assert.ok(!html.includes(END.confirmTitle), '시트는 닫혀 있다')
})

/* ── 대답 연습 판(훅 값 일부를 바꿔 정적으로) ───────────────────────────── */

const VIEW: PracticeView = {
  messageId: 'a0',
  ja: 'コーヒーをください',
  ko: '커피 주세요',
  choose: { before: '', answer: 'コーヒー', after: 'をください', choices: ['お茶', 'コーヒー', 'ジュース'], answerIndex: 1 },
  hintKo: '마실 것',
}
const opened = (state: RolePlay['practiceState'], mode: RolePlay['practiceMode'] = 'choose') => (rp: RolePlay): RolePlay => ({ ...rp, practiceOpen: true, practiceState: state, practiceMode: mode })

test('대답 연습 판: 고르기·말하기·따라 하기 — 판 안에 마이크·보내기 없음, 글자 모드에서만 [입력창에 넣기]', () => {
  const base = { chat: chatOf(SC), messages: OPENING }
  const choose = room({ ...base, patch: opened({ phase: 'ready', view: VIEW }, 'choose') })
  assert.ok(choose.includes(`aria-label="${PRACTICE.region}"`))
  assert.ok(choose.includes(PRACTICE.chooseLead) && choose.includes(`aria-label="${PRACTICE.blankAria}"`))
  assert.equal((choose.match(/<button type="button" lang="ja" aria-pressed="false"/g) ?? []).length, 3, '보기 3개')
  assert.ok(choose.includes(`<legend class="sr-only">${PRACTICE.chooseLegend}</legend>`))
  const say = room({ ...base, patch: opened({ phase: 'ready', view: VIEW }, 'say') })
  assert.ok(say.includes(PRACTICE.sayLead) && say.includes(PRACTICE.hint) && say.includes(PRACTICE.showAnswer) && say.includes(PRACTICE.sayHowVoice))
  const repeat = room({ ...base, patch: opened({ phase: 'ready', view: VIEW }, 'repeat') })
  assert.ok(repeat.includes(PRACTICE.repeatLead) && repeat.includes(`aria-label="${PRACTICE.listenAria}"`) && repeat.includes(PRACTICE.repeatHowVoice))
  assert.ok(!repeat.includes(PRACTICE.fill), '음성 모드에는 [입력창에 넣기] 없음(D-8)')
  const repeatText = room({ ...base, voice: false, patch: opened({ phase: 'ready', view: VIEW }, 'repeat') })
  assert.ok(repeatText.includes(PRACTICE.fill))
  for (const html of [choose, say, repeat, repeatText]) {
    const panel = html.slice(html.indexOf(`aria-label="${PRACTICE.region}"`))
    assert.ok(!/마이크|보내기|PushToTalk|data-ptt/.test(panel.slice(0, panel.indexOf('</section>'))), '판 안 마이크·보내기 금지')
    assert.ok(/role="radiogroup" aria-label="연습 방식"/.test(html))
  }
})

test('대답 연습 판: 로딩(스켈레톤·5초 문구)·실패(오류 alert·429 대기·진행 중)', () => {
  const base = { chat: chatOf(SC), messages: OPENING }
  const loading = room({ ...base, patch: opened({ phase: 'loading', slow: false }) })
  assert.ok(loading.includes(PRACTICE.loadingSr) && !loading.includes(PRACTICE.slow))
  assert.ok(room({ ...base, patch: opened({ phase: 'loading', slow: true }) }).includes(PRACTICE.slow))
  const error = room({ ...base, patch: opened({ phase: 'failed', failure: { kind: 'error' }, until: null }) })
  assert.match(error, /role="alert"[^>]*><p[^>]*>대답 예시를 만들지 못했어요\./)
  assert.ok(error.includes(PRACTICE.retry) && !error.includes('aria-disabled="true"'))
  const rate = room({ ...base, patch: opened({ phase: 'failed', failure: { kind: 'rate', sec: 9 }, until: Date.now() + 9000 }) })
  // 남은 초는 화면에 붙은 뒤(카운트다운 효과) 채워진다 — 서버 렌더는 초 없는 문구
  assert.ok(rate.includes('role="status"') && (rate.includes(PRACTICE.rate) || /[0-9]초 뒤 다시 눌러 주세요\./.test(rate)))
  assert.ok(rate.includes('aria-disabled="true"'), '대기 중 [다시 시도] 비활성')
  const busy = room({ ...base, patch: opened({ phase: 'failed', failure: { kind: 'busy' }, until: null }) })
  assert.ok(busy.includes(PRACTICE.busy))
})

/* ── TalkRoom 삽입 줄은 모두 역할극 조건 안 ─────────────────────────────── */

test('TalkRoom: 역할극 삽입은 조건부(일반 회화 출력 불변) — 그리는 부품은 rp 가 없으면 null 이다', () => {
  const src = readCode(join(__dirname, '..', '..', 'talk', 'TalkRoom.tsx'))
  const must = [
    "data-roleplay={rp.active ? 'on' : undefined}",
    'intro={rp.active ? <RolePlayIntro',
    '{rp.active && !olderCursor && messages[0]?.id === m.id ? <RolePlaySystemLine rp={rp} /> : null}',
    '} else if (showTopicEnd && rp.active) {',
    '{rp.ended ? (',
    '{rp.active ? <p',
    'placeholder={rp.placeholder ?? TALK_ROOM.textPlaceholder}',
    'if (isRolePlayEndedRejection(st, info?.details)) {',
    '{...rp.header}',
    '<RolePlayGoalCard rp={rp} />',
    '<RolePlayEndSheet rp={rp} />',
    'rp.onDone(dn)',
    'rp.stopSound()',
  ]
  for (const s of must) assert.ok(src.includes(s), s)
  // 한 번씩만(중복 삽입 없음)
  assert.equal(src.split('useRolePlay(').length - 1, 1)
  assert.equal(src.split('<PracticeDock ').length - 1, 1)
  // SSE·재생·말풍선 부품은 역할극을 모른다 — 부정 단언이라 원문 그대로 본다(주석에 이름이 있어도 실패하는 쪽이 더 엄격하고, 주석 처리로는 없던 참조를 숨길 수 없다)
  for (const f of ['TalkTutorBubble.tsx', 'useTalkPlayback.ts', 'VoiceBar.tsx']) {
    const other = readFileSync(join(__dirname, '..', '..', 'talk', f), 'utf8')
    assert.ok(!/scenario|rolePlay|RolePlay/.test(other), f)
  }
})
