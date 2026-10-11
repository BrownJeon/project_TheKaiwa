/**
 * 회화방 일본어 도우미 부품(task-056, screens §22)을 정적 렌더해 본다(서버 렌더 — 효과는 돌지 않는다, 선례 `scenario/__tests__/roomRender.test.ts`).
 *  - VoiceBar `trailing` 이 비면 DOM 이 예전과 같다(가운데 칸 `flex justify-center` 그대로, 바깥은 바이트 동일).
 *  - 버튼(닫힘·열림·잠김·안내 연결) · 안내 말풍선 · 판의 상태(처음·로딩·느림·결과 1/3개·펼침·빈 결과·오류·시간 초과·429·글자 모드·자막만·녹음 중).
 *  - `TalkRoom.tsx` 배치(소스 검사): 도우미가 열리면 대답 연습을 그리지 않음 · 마친 역할극엔 없음 · 보내면 닫힘 · 마이크 누르면 도우미 소리 멈춤.
 *    소스 검사는 모두 **주석을 걷은 소스**(`readCode`)에서 본다 — 주석 처리한 호출·속성이 통과하지 않게(REV-193 F-1 · REV-194 F-1).
 *  - 저장·엔진명: 도우미 파일에 localStorage·sessionStorage·console 이 없다(안내 플래그는 `claimHelperTip` 하나).
 */
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { PhraseHelpItem } from '@/types/phraseHelp'
import { readCode } from '../../__tests__/sourceCode'
import { HELPER } from '../helperCopy'
import PhraseHelperButton, { HELPER_PANEL_ID } from '../PhraseHelperButton'
import PhraseHelperCard from '../PhraseHelperCard'
import PhraseHelperPanel, { type PhraseHelperPanelProps } from '../PhraseHelperPanel'
import PhraseHelperTip, { HELPER_TIP_ID } from '../PhraseHelperTip'
import type { TalkView } from '../talkState'
import type { HelperPhase, PhraseHelper } from '../usePhraseHelper'
import VoiceBar from '../VoiceBar'

const render = (el: ReactElement) => renderToStaticMarkup(el)
const text = (html: string) => html.replace(/<[^>]+>/g, '')
const noop = () => {}

/* ── VoiceBar 슬롯 ─────────────────────────────────────────────────── */

const VIEW = (over: Partial<TalkView> = {}): TalkView =>
  ({ state: 'IDLE', sub: null, ptt: { phase: 'idle', disabled: false, label: '누르고 있는 동안 말하기' }, statusText: '누르고 있는 동안 말해요', showStop: false, keyboardDisabled: false, ...over }) as TalkView
const bar = (view: TalkView, trailing?: unknown) =>
  render(createElement(VoiceBar, { view, db: null, onPress: noop, onRelease: noop, onAbort: noop, onKeyboard: noop, onStop: noop, ...(trailing === undefined ? {} : { trailing: trailing as never }) }))

const OLD_MIDDLE = /<div class="flex justify-center">(<button[^]*?<\/button>)<\/div>/
const NEW_MIDDLE = /<div class="grid min-w-0 grid-cols-\[minmax\(0,1fr\)_72px_minmax\(0,1fr\)\] items-center"><span aria-hidden="true"><\/span>(<button[^]*?<\/button>)<div class="ml-3 justify-self-start">([^]*?)<\/div><\/div>/

test('VoiceBar: trailing 이 없으면(undefined·null·false·빈 글) 가운데 칸은 예전 그대로 `flex justify-center` + 마이크 하나', () => {
  for (const view of [VIEW(), VIEW({ showStop: true, state: 'SPEAKING' })]) {
    const plain = bar(view)
    assert.match(plain, OLD_MIDDLE)
    assert.ok(!plain.includes('grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)]') && !plain.includes('ml-3 justify-self-start'), '새 격자·도우미 칸 없음')
    for (const empty of [null, false, '']) assert.equal(bar(view, empty), plain, `trailing=${JSON.stringify(empty)}`)
  }
})

test('VoiceBar: trailing 이 있으면 가운데 칸만 바뀐다(마이크 72 가운데 · 오른쪽 칸 ml-3) — 상태 줄·⌨·■ 칸은 바이트 동일', () => {
  for (const view of [VIEW(), VIEW({ showStop: true, state: 'SPEAKING' })]) {
    const plain = bar(view)
    const withBtn = bar(view, createElement('i', { 'data-x': '1' }))
    const m = withBtn.match(NEW_MIDDLE)
    assert.ok(m, '새 가운데 칸')
    assert.equal(m[2], '<i data-x="1"></i>')
    const pttOld = plain.match(OLD_MIDDLE)?.[1]
    assert.equal(m[1], pttOld, '마이크 버튼 마크업 그대로')
    assert.equal(withBtn.replace(NEW_MIDDLE, '<MID/>'), plain.replace(OLD_MIDDLE, '<MID/>'), '가운데 칸 밖은 같다')
  }
})

/* ── 버튼 · 안내 ───────────────────────────────────────────────────── */

const btn = (p: { open?: boolean; locked?: boolean; describedBy?: string }) =>
  render(createElement(PhraseHelperButton, { open: false, locked: false, onToggle: noop, onLocked: noop, ...p }))

test('도우미 버튼: 둥근 44px · 이름 「일본어 도우미」 · 열림 때만 aria-controls · 잠김은 disabled 대신 aria-disabled · title 없음', () => {
  const closed = btn({})
  assert.match(closed, /^<button type="button" aria-label="일본어 도우미" aria-expanded="false" class="grid h-11 w-11 flex-none place-items-center rounded-full border/)
  assert.ok(closed.includes('border-line bg-surface'))
  assert.ok(!closed.includes('aria-controls'), '판이 없으면 없는 id 를 가리키지 않는다')
  assert.ok(!closed.includes('title='))
  assert.ok(closed.includes('<span aria-hidden="true"') && closed.includes('가<span lang="ja" class="text-accent">あ</span>'))
  const open = btn({ open: true })
  assert.ok(open.includes(`aria-expanded="true" aria-controls="${HELPER_PANEL_ID}"`))
  assert.ok(open.includes('bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--color-accent)]'))
  const locked = btn({ locked: true })
  assert.ok(locked.includes('aria-disabled="true"') && locked.includes('opacity-40'))
  assert.ok(!/\sdisabled=""/.test(locked), 'disabled 속성은 쓰지 않는다(눌러서 이유를 듣게)')
  assert.ok(btn({ describedBy: HELPER_TIP_ID }).includes(`aria-describedby="${HELPER_TIP_ID}"`))
})

test('안내 말풍선: role=note · 문구 · ✕ 「안내 닫기」(히트 44) · 꼬리 · 데모 위치 공식', () => {
  const html = render(createElement(PhraseHelperTip, { onClose: noop }))
  assert.ok(html.startsWith(`<div id="${HELPER_TIP_ID}" role="note"`))
  assert.ok(html.includes('right-[calc((100%-192px)/2+4px)]') && html.includes('bottom-[calc(100%+8px)]') && html.includes('w-[196px]'))
  assert.ok(text(html).includes(HELPER.tip))
  assert.ok(html.includes('aria-label="안내 닫기"') && html.includes('before:-inset-2'))
  assert.ok(html.includes('border-t-ink'))
})

/* ── 판 ───────────────────────────────────────────────────────────── */

const SOUND = {
  tap: noop,
  retry: noop,
  stop: noop,
  view: () => ({ phase: 'idle', look: 'idle', label: '', busy: false }),
  line: () => ({ kind: 'live', text: '' }),
}
const ITEMS: PhraseHelpItem[] = [
  { ja: '喉が枯れました。', ko: '목이 쉬었어요.', labelKo: '정중하게', whyKo: '「枯れる」는 목소리가 쉴 때 써요.' },
  { ja: '声がかすれちゃった。', ko: '목소리가 쉬어 버렸어.', labelKo: '친구끼리' },
  { ja: '喉の調子が悪いです。', ko: '목 상태가 안 좋아요.', labelKo: '차분하게' },
]

function fakeH(p: Partial<Record<keyof PhraseHelper, unknown>> & { phase?: HelperPhase } = {}): PhraseHelper {
  return {
    open: true,
    setOpen: noop,
    close: noop,
    query: '',
    setQuery: noop,
    phase: 'idle',
    items: [],
    more: false,
    setMore: noop,
    rateUntil: null,
    emptyHint: false,
    serverMsg: null,
    typing: false,
    setTyping: noop,
    announce: '',
    ask: noop,
    retry: noop,
    sound: SOUND,
    play: noop,
    stopSound: noop,
    fresh: true,
    ...p,
  } as unknown as PhraseHelper
}
const panel = (h: PhraseHelper, p: Partial<PhraseHelperPanelProps> = {}) =>
  render(
    createElement(PhraseHelperPanel, {
      h,
      kind: 'talk',
      textMode: false,
      textOnly: false,
      locked: false,
      focusOnOpen: false,
      onClose: noop,
      onFill: noop,
      blocked: false,
      otherOpen: false,
      onDismiss: noop,
      ...p,
    }),
  )

test('판 뼈대: section#talk-helper(aria-labelledby·data-kb-docked·높이 상한·판 안 스크롤) · 머리 · 입력 줄 · 늘 마운트된 안내 줄·낭독 줄', () => {
  const html = panel(fakeH())
  assert.match(html, /^<section id="talk-helper" aria-labelledby="talk-helper-title" data-kb-docked="true" class="max-h-\[min\(46dvh,320px\)\] flex-none overflow-y-auto overscroll-contain/)
  assert.ok(html.includes('<h2 id="talk-helper-title"') && text(html).includes(HELPER.title) && text(html).includes(HELPER.sub))
  assert.ok(html.includes('aria-label="일본어 도우미 닫기"'))
  assert.ok(html.includes('<form noValidate=""'))
  assert.ok(html.includes('<label class="sr-only" for="talk-helper-q">한국어로 물어볼 말</label>'))
  assert.match(html, /<input id="talk-helper-q" type="text" lang="ko" enterKeyHint="search" autoComplete="off" spellCheck="false" aria-describedby="talk-helper-msg"/)
  assert.ok(html.includes('placeholder="예: 목이 쉬었어요"'))
  assert.ok(html.includes('text-[16px]'), '입력칸 16px(확대 방지)')
  assert.match(html, /<p id="talk-helper-msg" role="status" class="[^"]*empty:mt-0[^"]*"><\/p>/)
  assert.match(html, /<p role="status" class="sr-only"><\/p>/)
  assert.ok(html.includes('[:root[data-kb]_&amp;]:hidden'), '키보드가 올라오면 본문을 숨긴다')
  assert.ok(!html.includes('<svg width="22"'), '판 안에 마이크 없음')
  assert.ok(!text(html).includes('저장') && !text(html).includes('단어장'), '저장 버튼 없음')
})

test('hp-open / hp-empty: 처음 = 예시 칩 3개(방 종류별) · 빈 칸이면 [물어보기] aria-disabled · 빈 제출 안내 줄', () => {
  const talk = panel(fakeH())
  assert.ok(text(talk).includes(HELPER.examplesLead))
  for (const ex of HELPER.examples.talk) assert.ok(talk.includes(`>${ex}</span></button>`), ex)
  assert.ok(talk.includes("before:-inset-y-[5px]"), '칩 히트 44 (padding box 34 + 위아래 5px)')
  assert.match(talk, /<button type="submit" aria-disabled="true"/)
  const rp = panel(fakeH(), { kind: 'rp' })
  for (const ex of HELPER.examples.rp) assert.ok(rp.includes(`>${ex}</span></button>`), ex)
  assert.ok(rp.includes('placeholder="예: 얼음 적게 해 주세요"'))
  const empty = panel(fakeH({ emptyHint: true, query: ' ' }))
  assert.match(empty, /<p id="talk-helper-msg" role="status" class="[^"]*text-bad[^"]*">물어볼 말을 한국어로 써 주세요<\/p>/)
  const typed = panel(fakeH({ query: '목이 쉬었어요' }))
  assert.match(typed, /<button type="submit" class=/, '한 글자 이상이면 켜짐(aria-disabled 없음)')
})

test('hp-long: 90자부터 n/100(오른쪽) · 101자 bad 초과 + [물어보기] 흐림 · 서버 400 문구는 안내 줄에', () => {
  const at95 = panel(fakeH({ query: '가'.repeat(95) }))
  assert.match(at95, /<p id="talk-helper-msg" role="status" class="[^"]*text-ink2 text-right">95\/100<\/p>/)
  assert.match(at95, /<button type="submit" class=/)
  const over = panel(fakeH({ query: '가'.repeat(101) }))
  assert.match(over, /class="[^"]*text-bad text-right">100자까지 물어볼 수 있어요 · 101\/100<\/p>/)
  assert.match(over, /<button type="submit" aria-disabled="true"/)
  const server = panel(fakeH({ query: 'hello', serverMsg: '하고 싶은 말을 한국어로 써 주세요.' }))
  assert.ok(server.includes('>하고 싶은 말을 한국어로 써 주세요.</p>'))
})

test('hp-loading / hp-slow: 스켈레톤 120·120 + sr 「찾는 중」, 5초부터 「조금만 기다려 주세요」, [물어보기] 흐림', () => {
  const loading = panel(fakeH({ phase: 'loading', query: '목이 쉬었어요' }))
  assert.equal((loading.match(/style="height:120px"/g) ?? []).length, 2)
  assert.ok(text(loading).includes(HELPER.loadingSr))
  assert.ok(!text(loading).includes(HELPER.slow))
  assert.match(loading, /<button type="submit" aria-disabled="true"/)
  assert.ok(text(panel(fakeH({ phase: 'slow', query: 'x' }))).includes(HELPER.slow))
})

test('hp-result: 후보 1개 = 카드 하나(꼬리표·[다른 말투] 없음) · 뜻 늘 보임 · 이유 줄 · ▶ 「… 듣기」', () => {
  const one = panel(fakeH({ phase: 'result', items: [ITEMS[0]] }))
  assert.ok(one.includes('<ul aria-label="일본어 표현"'))
  assert.equal((one.match(/<li /g) ?? []).length, 1)
  assert.ok(!one.includes('정중하게'), '후보 1개면 꼬리표 없음')
  assert.ok(!one.includes('talk-helper-alts'))
  assert.ok(text(one).includes('목이 쉬었어요.'))
  assert.ok(one.includes('<span lang="ja">「枯れる」</span>'), '이유 줄 「」 안은 lang=ja')
  assert.ok(one.includes('border-l-2 border-line pl-2'))
  assert.ok(one.includes('aria-label="喉が枯れました。 듣기"'))
  assert.ok(one.includes('lang="ja" class="text-[17px] text-ink [overflow-wrap:anywhere]"'), '일본어 17px·줄바꿈 anywhere')
  assert.ok(!one.includes(HELPER.fill), '말 모드 카드에는 [입력창에 넣기] 없음')
  // 이유가 없으면 줄 자체가 없다(정상)
  assert.ok(!panel(fakeH({ phase: 'result', items: [{ ja: 'はい', ko: '네' }] })).includes('border-l-2'))
})

test('hp-result(②B) / hp-more: 첫 카드만 + [다른 말투 2개 더 보기 · 꼬리표 요약] · 나머지는 hidden 으로 늘 마운트 · 펼치면 「다른 말투 접기」', () => {
  const closed = panel(fakeH({ phase: 'result', items: ITEMS }))
  assert.ok(closed.includes('aria-expanded="false" aria-controls="talk-helper-alts"'))
  assert.ok(text(closed).includes('다른 말투 2개 더 보기') && text(closed).includes('친구끼리 · 차분하게'))
  assert.match(closed, /<ul id="talk-helper-alts" aria-label="다른 말투" hidden=""/)
  assert.ok(closed.includes('>정중하게</span>'), '후보 2개 이상이면 첫 카드에도 꼬리표')
  assert.ok(text(closed).includes('▾'))
  const open = panel(fakeH({ phase: 'result', items: ITEMS, more: true }))
  assert.ok(open.includes('aria-expanded="true" aria-controls="talk-helper-alts"'))
  assert.match(open, /<ul id="talk-helper-alts" aria-label="다른 말투" class=/)
  assert.ok(text(open).includes(HELPER.less) && text(open).includes('▴'))
  assert.equal((open.match(/<li /g) ?? []).length, 3)
})

test('hp-text / hp-textonly / hp-rec: 글자 모드는 카드마다 [입력창에 넣기] · 자막만이면 ▶ 없음 · 녹음 중 입력 disabled·버튼 aria-disabled', () => {
  const t = panel(fakeH({ phase: 'result', items: ITEMS }), { textMode: true })
  assert.equal((t.match(/>입력창에 넣기</g) ?? []).length, 3)
  const only = panel(fakeH({ phase: 'result', items: ITEMS }), { textOnly: true })
  assert.ok(!only.includes(' 듣기"'))
  const rec = panel(fakeH({ phase: 'result', items: ITEMS, query: '목이 쉬었어요' }), { locked: true, textMode: true })
  assert.match(rec, /<input id="talk-helper-q"[^>]* disabled=""/)
  assert.match(rec, /<button type="submit" aria-disabled="true"/)
  assert.ok(rec.includes('aria-label="喉が枯れました。 듣기" aria-disabled="true"'))
  assert.match(rec, /<button type="button" aria-disabled="true" class="inline-flex h-11[^"]*opacity-40">입력창에 넣기<\/button>/)
  assert.ok(rec.includes('aria-expanded="false" aria-controls="talk-helper-alts"') && !/aria-disabled="true"[^>]*aria-controls="talk-helper-alts"/.test(rec), '[다른 말투] 펼침은 녹음 중에도 허용')
})

test('hp-none / hp-error / hp-timeout / hp-rate / busy: 실패 상자 문구 · 오류·시간 초과만 role=alert + [다시 시도] · 429 는 대기 동안 [다시 시도] 흐림', () => {
  const none = panel(fakeH({ phase: 'none' }))
  assert.ok(text(none).includes(HELPER.none) && text(none).includes('예: ‘천천히 말해 주세요’'))
  assert.ok(!none.includes('role="alert"') && !text(none).includes(HELPER.retry), '빈 결과는 [다시 시도] 없음')
  assert.ok(text(panel(fakeH({ phase: 'none' }), { kind: 'rp' })).includes('예: ‘얼음 적게 해 주세요’'))
  const error = panel(fakeH({ phase: 'error' }))
  assert.match(error, /<div role="alert"><p[^>]*>지금은 표현을 가져오지 못했어요.<\/p><button type="button" class="inline-flex h-11/)
  assert.ok(text(panel(fakeH({ phase: 'timeout' }))).includes(HELPER.timeout))
  assert.ok(text(panel(fakeH({ phase: 'busy' }))).includes(HELPER.busy))
  const rate = panel(fakeH({ phase: 'rate', rateUntil: Date.now() + 30_000 }))
  assert.ok(!rate.includes('role="alert"'))
  assert.match(rate, /<button type="button" aria-disabled="true" class="[^"]*opacity-40">다시 시도<\/button>/)
  assert.match(rate, /<button type="submit" aria-disabled="true"/, '대기 동안 [물어보기]도 흐림')
})

test('낭독 줄: 결과 문장은 늘 마운트된 sr status 에 들어간다', () => {
  const html = panel(fakeH({ phase: 'result', items: ITEMS, announce: '표현 3개를 찾았어요' }))
  assert.match(html, /<p role="status" class="sr-only">표현 3개를 찾았어요<\/p>/)
})

test('카드(단독): 소리 실패 안내는 그 카드 안 아래 한 줄 · 재생 중이면 ■ + 주황 바탕 + 「… 멈추기」', () => {
  const failing = {
    ...SOUND,
    view: () => ({ phase: 'idle', look: 'idle', label: '', busy: false }),
    line: (k: string) => (k === 'helper:0' ? { kind: 'msg', msg: 'fail' } : { kind: 'live', text: '' }),
  }
  const html = render(
    createElement('ul', null, createElement(PhraseHelperCard, { item: ITEMS[0], index: 0, count: 1, ann: { s: 'off' }, textMode: false, textOnly: false, locked: false, sound: failing as never, onPlay: noop, onFill: noop })),
  )
  assert.ok(html.includes('role="alert"') && text(html).includes('목소리를 불러오지 못했어요.'))
  const playing = { ...SOUND, view: () => ({ phase: 'playing', look: 'on', label: '', busy: false }) }
  const p = render(
    createElement('ul', null, createElement(PhraseHelperCard, { item: ITEMS[0], index: 0, count: 1, ann: { s: 'off' }, textMode: false, textOnly: false, locked: false, sound: playing as never, onPlay: noop, onFill: noop })),
  )
  assert.ok(p.includes('aria-label="喉が枯れました。 멈추기"') && p.includes('bg-accent text-on-accent'))
})

test('엔진명·모델명: 버튼·안내·판의 모든 상태 DOM(글·aria-*)에 엔진·모델 이름이 없다', () => {
  const phases: HelperPhase[] = ['idle', 'loading', 'slow', 'result', 'none', 'error', 'timeout', 'rate', 'busy']
  const htmls = [btn({}), btn({ open: true, describedBy: HELPER_TIP_ID }), btn({ locked: true }), render(createElement(PhraseHelperTip, { onClose: noop }))]
  for (const phase of phases)
    for (const textMode of [false, true])
      for (const kind of ['talk', 'rp'] as const)
        htmls.push(panel(fakeH({ phase, items: ITEMS, more: true, rateUntil: Date.now() + 5_000, query: '목이 쉬었어요', announce: '표현 3개를 찾았어요' }), { textMode, kind }))
  for (const html of htmls) assert.doesNotMatch(html, /claude|haiku|sonnet|opus|whisper|reazon|style-?bert|sbv2|qwen|ollama|model_?id|speaker_?id|traceId/i)
})

/* ── TalkRoom 배치(소스 검사) · 저장·엔진명 ──────────────────────────── */

const SRC = join(process.cwd(), 'src/components/talk')
/** 주석을 걷어 낸 소스. */
const read = (f: string) => readCode(join(SRC, f))

test('TalkRoom: 도우미가 열리면 대답 연습을 그리지 않고 · 마친 역할극엔 도우미가 없고 · 보내면 닫히고 · 마이크를 누르면 도우미 소리를 멈춘다', () => {
  const src = read('TalkRoom.tsx')
  assert.match(src, /\{helperShown \? \(\s*<PhraseHelperPanel[^]*?\) : \(\s*<PracticeDock /)
  assert.match(src, /const helperShown = helper\.shown\n/)
  assert.match(src, /\{rp\.ended \? \(\s*<RolePlayEndedBar rp=\{rp\} \/>\s*\) : mode === 'voice'/)
  assert.match(src, /trailing=\{helperButton\}/)
  // onAccepted 콜백 본문만 잘라서 본다 — 파일 전체에 게으른 정규식을 걸면 뒤쪽 toggleHelper·onFill 의 helper.close() 에 걸린다(REV-191 M-1). `read` 가 주석을 걷었으므로 `// helper.close()` 는 호출로 치지 않는다(REV-193 F-1).
  const acceptedAt = src.indexOf('queue.startTurn(aid)')
  const accepted = src.slice(acceptedAt, src.indexOf('onAudio:', acceptedAt))
  assert.ok(acceptedAt > 0 && accepted.length > 0 && accepted.length < 400, 'onAccepted 끝(onAudio:) 까지')
  assert.match(accepted, /^queue\.startTurn\(aid\)\s*pauseStatus\(true\)/)
  assert.match(accepted, /\bhelper\.close\(\)/, 'onAccepted 에서 닫음')
  assert.match(src, /const onPress = \(\) => \{\s*helper\.stopSound\(\)/)
  assert.match(src, /rp\.closePractice\(\)\s*if \(rp\.goalOpen\) rp\.toggleGoal\(\)\s*helper\.setOpen\(true\)/, '열 때 대답 연습·목표 카드를 접는다')
  assert.match(src, /otherOpen=\{rp\.goalOpen \|\| rp\.practiceOpen\}/)
  assert.match(src, /blocked=\{strip !== null\}\s*otherOpen/)
  assert.match(src, /onLocked=\{\(\) => notify\(helperLockToast\(helperLockWhy\)\)\}/)
  // 입력 중에는 아래 바를 숨긴다(초점 기반)
  assert.match(src, /helper\.typing \? null : \(\s*<div className="relative flex-none">/)
  assert.match(src, /<div hidden=\{helper\.typing\} className="contents">\s*<Composer/)
  // 안내는 말 모드에서만, 숨김 조건 전부
  assert.match(src, /const tipShown = tipOpen && !helper\.open && !helperLock && strip === null && !rp\.practiceOpen && !toast\.message/)
  assert.match(src, /const voiceBarReady = load === 'ready' && !!chat && !rp\.ended && mode === 'voice'/)
})

test('TalkRoom·판·훅: 녹음 중에도 판은 그대로(⑤A) · 처음 열기만 입력칸 초점 · ✕·Esc 는 초점을 버튼으로 · 입력 중 판정은 초점 기반 · 409 ENDED 는 방 다시 읽기', () => {
  const room = read('TalkRoom.tsx')
  // 판 표시 조건에 녹음·인식(helperLock) 이 들어가지 않는다 — 잠김은 판 안 입력·버튼만.
  assert.match(room, /const helperShown = helper\.shown\n/)
  assert.match(room, /ended: rp\.ended,/, '마친 역할극 여부는 훅에 넘긴다')
  assert.match(room, /locked=\{helperLock\}\s*focusOnOpen=\{helper\.fresh\}/)
  assert.match(room, /onEnded: \(\) => void rp\.reload\(\)/)
  assert.match(room, /const closeHelperToButton = \(\) => \{\s*focusHelperBtnRef\.current = true\s*helper\.close\(\)/)
  assert.match(room, /if \(helper\.open \|\| helper\.typing \|\| !focusHelperBtnRef\.current\) return\s*focusHelperBtnRef\.current = false\s*helperBtnRef\.current\?\.focus\(\)/)
  assert.match(room, /onClose=\{closeHelperToButton\}/)
  // 띠·다른 판 때문에 닫히면 초점을 옮기지 않는다
  assert.match(room, /onDismiss=\{helper\.close\}/)
  // [입력창에 넣기] 로 닫히면 초점은 입력창으로 — 누르는 순간 입력창은 숨겨져 있으므로(판 안 버튼은 입력칸 초점을 지킨다) 다시 그려진 뒤 효과에서 옮긴다(QA-C F-3)
  assert.match(room, /onFill=\{\(ja\) => \{\s*composerRef\.current\?\.fill\(ja\)\s*focusComposerRef\.current = true\s*helper\.close\(\)/)
  assert.match(room, /if \(helper\.open \|\| helper\.typing \|\| !focusComposerRef\.current\) return\s*focusComposerRef\.current = false\s*composerRef\.current\?\.focus\(\)/)
  const hook = read('usePhraseHelper.ts')
  assert.match(hook, /fresh: phase === 'idle'/)
  assert.match(hook, /const close = useCallback\(\(\) => \{\s*setOpen\(false\)\s*setTyping\(false\)/, '닫으면 입력 중 표시도 끈다(언마운트 땐 blur 가 안 온다)')
  const closeBody = hook.match(/const close = useCallback\(\(\) => \{([^]*?)\}, \[\]\)/)?.[1] ?? ''
  assert.ok(closeBody.includes('setOpen(false)') && !closeBody.includes('abort'), '닫기는 요청을 취소하지 않는다(결과 기억)')
  const pnl = read('PhraseHelperPanel.tsx')
  assert.match(pnl, /useLayoutEffect\(\(\) => \{\s*if \(focusOnOpenRef\.current\) ref\.current\?\.focus\(\)/)
  assert.match(pnl, /onFocus=\{\(\) => h\.setTyping\(true\)\}\s*onBlur=\{\(\) => h\.setTyping\(false\)\}/)
  assert.match(pnl, /if \(helperDismissOf\(p, \{ blocked, otherOpen \}\)\) onDismiss\(\)/, '띠·다른 판은 새로 뜰 때만 닫는다(helperDismissOf)')
  assert.match(pnl, /onKeyDown=\{closeOnEscape\(onClose\)\}/, 'Esc 는 ✕ 와 같은 onClose')
  // 아래 바 숨김은 data-kb 가 아니라 초점(helper.typing) — 판 본문만 data-kb 로 숨긴다
  assert.doesNotMatch(room, /data-kb[^-]/)
})

test('저장·엔진명: 도우미 파일은 브라우저 저장소·console 을 쓰지 않는다(안내 플래그는 claimHelperTip 의 readStore/writeStore 하나)', () => {
  const files = ['PhraseHelperButton.tsx', 'PhraseHelperTip.tsx', 'PhraseHelperPanel.tsx', 'PhraseHelperCard.tsx', 'usePhraseHelper.ts', 'helperCopy.ts', 'phraseHelperLogic.ts']
  for (const f of files) {
    const code = read(f)
    assert.doesNotMatch(code, /localStorage|sessionStorage|console\./, f)
    assert.doesNotMatch(code, /claude|haiku|sonnet|whisper|reazon|style-?bert|qwen/i, f)
  }
  const logic = read('phraseHelperLogic.ts')
  assert.equal((logic.match(/writeStore\(/g) ?? []).length, 0, '직접 쓰기는 기본 인자로 받은 write 하나뿐')
  assert.match(logic, /write\('local', HELPER_TIP_KEY, '1'\)/)
  assert.doesNotMatch(read('usePhraseHelper.ts'), /readStore|writeStore/, '질의·결과는 메모리만')
})

/* ── REV-191 보강 ─────────────────────────────────────────────────── */

test('usePhraseHelper → createHelperRequester 위임(M-2): 막힘 이유 pending 은 컨트롤러 · 언마운트는 dispose · 요청은 start 로만', () => {
  const hook = read('usePhraseHelper.ts')
  assert.match(hook, /const \[req\] = useState\(createHelperRequester\)/)
  assert.match(hook, /askBlockOf\(\{ query: q, pending: req\.pending\(\), recording: recordingRef\.current, rateWaiting: rateWaiting\(\) \}\)/, '요청 중 재요청 막기(MU1)')
  assert.match(hook, /useEffect\(\(\) => \(\) => req\.dispose\(\), \[req\]\)/, '언마운트 취소·타이머 정리(MU2)')
  assert.match(hook, /void req\.start\(\(signal\) => apiPost<unknown>\(`\/api\/v1\/chats\/\$\{encodeURIComponent\(chatId\)\}\/phrase-help`, \{ queryKo: q\.trim\(\) \}, \{ signal \}\), \{\s*onSlow: \(\) => setPhase\(\(p\) => \(p === 'loading' \? 'slow' : p\)\),\s*settle,\s*\}\)/)
  assert.doesNotMatch(hook, /AbortController|setTimeout|clearTimeout|settleHelper/, '수명주기는 컨트롤러에만 있다')
})

test('[물어보기]·입력칸(MU5·MU6): 조합 중 Enter 는 isImeEnter 로 막고 · [물어보기] 누름은 pointerdown 기본 동작을 막아 입력 초점을 지킨다', () => {
  const pnl = read('PhraseHelperPanel.tsx')
  assert.match(pnl, /onKeyDown=\{\(e\) => \{\s*if \(isImeEnter\(e\)\) e\.preventDefault\(\)\s*\}\}/)
  const submitAt = pnl.indexOf('type="submit"')
  const submitBtn = pnl.slice(submitAt, pnl.indexOf('{HELPER.ask}', submitAt))
  assert.ok(submitAt > 0 && submitBtn.length > 0 && submitBtn.length < 400, '[물어보기] 버튼 여는 태그만')
  assert.match(submitBtn, /onPointerDown=\{keepInputFocus\}/)
})

type El = { type: unknown; props: { children?: unknown; onClick?: () => void; [k: string]: unknown } }
const isEl = (n: unknown): n is El => !!n && typeof n === 'object' && 'type' in n && 'props' in n
function buttonsOf(node: unknown, out: El[] = []): El[] {
  if (Array.isArray(node)) for (const c of node) buttonsOf(c, out)
  else if (isEl(node)) {
    if (node.type === 'button') out.push(node)
    buttonsOf(node.props.children, out)
  }
  return out
}

test('카드 잠금(MU7): 녹음 중(locked) ▶·[입력창에 넣기]를 눌러도 onPlay·onFill 을 부르지 않는다 — 풀리면 부른다', () => {
  for (const locked of [true, false]) {
    const plays: Array<[number, string]> = []
    const fills: string[] = []
    const tree = PhraseHelperCard({
      item: ITEMS[0],
      index: 2,
      count: 3,
      ann: { s: 'off' } as never,
      textMode: true,
      textOnly: false,
      locked,
      sound: SOUND as never,
      onPlay: (i, t) => plays.push([i, t]),
      onFill: (ja) => fills.push(ja),
    })
    const btns = buttonsOf(tree)
    const play = btns.find((b) => String(b.props['aria-label']).endsWith(' 듣기'))
    const fill = btns.find((b) => b.props.children === HELPER.fill)
    assert.ok(play && fill, '▶ 와 [입력창에 넣기]')
    assert.equal(play.props['aria-disabled'], locked || undefined)
    assert.equal(fill.props['aria-disabled'], locked || undefined)
    play.props.onClick?.()
    fill.props.onClick?.()
    if (locked) {
      assert.deepEqual(plays, [], `locked=${locked}: 소리 안 남`)
      assert.deepEqual(fills, [], `locked=${locked}: 입력창에 안 넣음`)
    } else {
      assert.equal(plays.length, 1)
      assert.equal(plays[0][0], 2)
      assert.ok(plays[0][1].length > 0)
      assert.deepEqual(fills, [ITEMS[0].ja])
    }
  }
})

test('예시 칩(L-3): 말줄임은 안쪽 span — 버튼에 overflow 가 없어 위아래 히트 확장(before:)이 잘리지 않는다(히트 44)', () => {
  for (const kind of ['talk', 'rp'] as const) {
    const html = panel(fakeH(), { kind })
    const chips = [...html.matchAll(/<button type="button" class="([^"]*)"><span class="([^"]*)">([^<]*)<\/span><\/button>/g)]
    assert.deepEqual(
      chips.map((m) => m[3]),
      [...HELPER.examples[kind]],
    )
    for (const [, btnCls, spanCls] of chips) {
      const b = btnCls.split(' ')
      for (const c of ['relative', 'h-9', 'max-w-full', 'rounded-full', 'px-3', 'text-[13px]', 'before:absolute', 'before:inset-x-0', 'before:-inset-y-[5px]']) assert.ok(b.includes(c), c)
      assert.ok(!b.some((c) => /^(truncate|overflow-|text-ellipsis|text-clip|whitespace-)/.test(c)), `버튼에 overflow·말줄임 없음: ${btnCls}`)
      assert.deepEqual(spanCls.split(' ').sort(), ['block', 'truncate'])
    }
  }
})

test('안내 연결(I-1): 말풍선은 말 모드 입력 바에서만 그리므로 tipShown 이 모드까지 본다 — 버튼 aria-describedby 와 말풍선이 같은 값', () => {
  const room = read('TalkRoom.tsx')
  assert.match(room, /const tipShown = [^\n]*&& mode === 'voice'\n/)
  assert.match(room, /describedBy=\{tipShown \? HELPER_TIP_ID : undefined\}/)
  assert.equal((room.match(/<PhraseHelperTip /g) ?? []).length, 1)
  assert.match(room, /helper\.typing \? null : \(\s*<div className="relative flex-none">\s*\{tipShown \? <PhraseHelperTip /)
})
