/**
 * 일본어 도우미 QA-C 반송 수정(task-056 F-1·F-2·F-5) — 소스 글자 모양이 아니라 **판단 함수와 요소 트리를 실제로 불러** 동작을 잠근다.
 *  - F-1 판이 언제 보이고 언제 스스로 닫히는가: `helperPanelShown`·`helperLocked`·`helperDismissOf` 를 말하기 상태 × 열림 × 마침 × 띠로 돌려 본다.
 *    (QA 가 본 「녹음 시작 시 판 소멸」은 STT 연결 실패 오류 띠가 새로 떠서 §22-10 대로 닫힌 것이었다 — 그 경로도 표에 넣는다.)
 *  - F-2 판 머리 ✕ 와 Esc 가 같은 `onClose` 로 닫고, ✕ 는 누르는 동안 입력칸 초점을 지킨다(초점이 옮겨 가면 아래 바가 다시 그려져 판이 밀리고 click 이 사라진다).
 *  - F-3 판 안 **모든** 버튼(✕·[물어보기]·예시 칩·[다른 말투]·[다시 시도]·▶·[입력창에 넣기])이 같은 방식으로 초점을 지킨다 — 두 파일의 `<button` 을 전부 훑어 하나라도 빠지면 실패.
 *    소스를 읽는 단언은 모두 **주석을 걷은 소스**(`readCode`)에서 본다 — `// onPointerDown={keepInputFocus}` 처럼 주석 처리한 속성이 통과하지 않게(REV-194 F-1).
 *  - F-5 예시 칩·안내 ✕ 의 실제 누름 영역 높이 = 44px (클래스 이름에서 계산).
 * 실제 브라우저 재현·수정 후 수치는 task-056-dev-ui-record.md 「QA-C 반송 수정」.
 */
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readCode } from '../../__tests__/sourceCode'
import { HELPER } from '../helperCopy'
import PhraseHelperCard from '../PhraseHelperCard'
import PhraseHelperPanel, { PhraseHelperHead } from '../PhraseHelperPanel'
import PhraseHelperTip from '../PhraseHelperTip'
import {
  closeOnEscape,
  helperDismissOf,
  helperLocked,
  helperPanelShown,
  keepInputFocus,
  type HelperOverlays,
} from '../phraseHelperLogic'
import type { TalkState } from '../talkState'
import type { PhraseHelper } from '../usePhraseHelper'

const STATES: TalkState[] = ['IDLE', 'RECORDING', 'RECOGNIZING', 'QUEUED', 'THINKING', 'SPEAKING']
const NONE: HelperOverlays = { blocked: false, otherOpen: false }

/** 주석을 걷어 낸 소스 — 주석 처리한 속성·호출·요소가 소스 검사를 통과시키지 않는다(REV-194 F-1). */
const talkSrc = (file: string) => readCode(join(process.cwd(), 'src/components/talk', file))

/* ── F-1 판이 보이는 조건 ─────────────────────────────────────────── */

test('F-1 판 표시: 열려 있고 마친 역할극이 아니면 말하기 상태(녹음·인식 포함)와 무관하게 그린다 — 잠김은 입력·버튼만', () => {
  for (const state of STATES)
    for (const open of [true, false])
      for (const ended of [true, false]) {
        assert.equal(helperPanelShown({ open, ended }), open && !ended, `${state} open=${open} ended=${ended}`)
      }
  // ⑤A — 녹음·인식 중에는 판이 남고(shown) 입력칸·카드 버튼이 잠긴다(locked)
  for (const state of ['RECORDING', 'RECOGNIZING'] as const) {
    assert.equal(helperPanelShown({ open: true, ended: false }), true, `${state}: 판 유지`)
    assert.equal(helperLocked(state), true, `${state}: 잠김`)
  }
  // 선생님이 답을 만드는 중(대기·생각)도 잠긴다 — 도우미가 먼저 AI 호출 줄에 서면 턴 첫 음성이 5초 예산을 넘긴다(사용자 결정 2026-10-11, QA-B2). 판은 그대로 그려진다.
  for (const state of ['QUEUED', 'THINKING'] as const) {
    assert.equal(helperPanelShown({ open: true, ended: false }), true, `${state}: 판 유지`)
    assert.equal(helperLocked(state), true, `${state}: 잠김`)
  }
  // 열 수 있는 상태는 IDLE·선생님 말 재생 중(AI 호출이 이미 끝남)뿐
  for (const state of ['IDLE', 'SPEAKING'] as const) assert.equal(helperLocked(state), false, state)
})

/* ── F-1 판이 스스로 닫히는 조건 ─────────────────────────────────── */

test('F-1 자동 닫힘(§22-10): 띠·목표 카드·대답 연습이 「새로」 뜰 때만 — 이미 있던 것·내려가는 것·말하기 시작은 해당 없음', () => {
  const rows: Array<[string, HelperOverlays, HelperOverlays, boolean]> = [
    ['아무 일 없음', NONE, NONE, false],
    ['띠가 새로 뜸(예: STT 연결 실패 오류 띠)', NONE, { blocked: true, otherOpen: false }, true],
    ['띠가 이미 떠 있던 채로 판을 연 뒤', { blocked: true, otherOpen: false }, { blocked: true, otherOpen: false }, false],
    ['띠가 내려감', { blocked: true, otherOpen: false }, NONE, false],
    ['목표 카드·대답 연습이 새로 펼쳐짐', NONE, { blocked: false, otherOpen: true }, true],
    ['펼쳐진 채로 그대로', { blocked: false, otherOpen: true }, { blocked: false, otherOpen: true }, false],
    ['접힘', { blocked: false, otherOpen: true }, NONE, false],
    ['띠가 있는 채로 대답 연습이 새로 펼쳐짐', { blocked: true, otherOpen: false }, { blocked: true, otherOpen: true }, true],
    ['대답 연습이 있는 채로 띠가 새로 뜸', { blocked: false, otherOpen: true }, { blocked: true, otherOpen: true }, true],
    ['띠가 내려가고 대답 연습이 올라옴(동시)', { blocked: true, otherOpen: false }, { blocked: false, otherOpen: true }, true],
  ]
  for (const [name, prev, next, want] of rows) assert.equal(helperDismissOf(prev, next), want, name)
})

test('F-1 시나리오: 열기 → 누르기(녹음) → 놓기(인식) → 보내기(accepted) — 판은 녹음·인식 내내 남고 accepted 에서만 닫힌다 / 누르자마자 오류 띠가 뜨면 그때 닫힌다', () => {
  type Room = { open: boolean; ended: boolean; talk: TalkState; overlays: HelperOverlays }
  const shown = (r: Room) => helperPanelShown({ open: r.open, ended: r.ended })
  const locked = (r: Room) => helperLocked(r.talk)
  // 띠가 바뀔 때는 판의 효과(helperDismissOf)가 닫기를 요청한다 — 방은 open 을 false 로 만든다.
  const setOverlays = (r: Room, next: HelperOverlays): Room => ({ ...r, overlays: next, open: r.open && !helperDismissOf(r.overlays, next) })

  let r: Room = { open: true, ended: false, talk: 'IDLE', overlays: NONE }
  assert.deepEqual([shown(r), locked(r)], [true, false], '열림')

  r = { ...r, talk: 'RECORDING' }
  assert.deepEqual([shown(r), locked(r)], [true, true], '녹음 중: 판 유지 + 잠김')
  r = { ...r, talk: 'RECOGNIZING' }
  assert.deepEqual([shown(r), locked(r)], [true, true], '인식 중: 판 유지 + 잠김')
  r = { ...r, talk: 'THINKING', open: false } // 턴 accepted → TalkRoom onAccepted 의 helper.close()
  assert.deepEqual([shown(r), locked(r)], [false, true], '보냈다(accepted): 판은 닫히고, 선생님이 답하는 동안 버튼은 계속 잠긴다(예전에는 여기서 풀렸다)')
  r = { ...r, talk: 'SPEAKING' }
  assert.deepEqual([shown(r), locked(r)], [false, false], '선생님 말 재생(AI 호출 끝): 잠김 풀림')

  // QA-C 환경(STT 게이트웨이 없음): 누르자마자 연결 실패 오류 띠가 새로 뜬다
  let e: Room = { open: true, ended: false, talk: 'IDLE', overlays: NONE }
  e = { ...e, talk: 'RECORDING' }
  assert.equal(shown(e), true, '누른 직후엔 아직 남아 있다')
  e = setOverlays(e, { blocked: true, otherOpen: false })
  assert.equal(shown(e), false, '오류 띠가 새로 뜨면 §22-10 대로 닫힌다(결과는 기억)')

  // 너무 짧아 보내지 않은 녹음: accepted 가 없으니 판이 그대로
  let s: Room = { open: true, ended: false, talk: 'IDLE', overlays: NONE }
  for (const talk of ['RECORDING', 'RECOGNIZING', 'IDLE'] as const) s = { ...s, talk }
  assert.equal(shown(s), true, '짧은 녹음: 판 유지')

  // 마친 역할극이면 열려 있어도 그리지 않는다
  assert.equal(shown({ ...s, ended: true }), false)
})

/* ── F-2 ✕ 와 Esc ─────────────────────────────────────────────────── */

type El = { type: unknown; props: { children?: unknown; [k: string]: unknown } }
const isEl = (n: unknown): n is El => !!n && typeof n === 'object' && 'type' in n && 'props' in n
function buttonsOf(node: unknown, out: El[] = []): El[] {
  if (Array.isArray(node)) for (const c of node) buttonsOf(c, out)
  else if (isEl(node)) {
    if (node.type === 'button') out.push(node)
    buttonsOf(node.props.children, out)
  }
  return out
}
const spyEvent = () => {
  let prevented = 0
  return { e: { key: '', preventDefault: () => void prevented++ }, count: () => prevented }
}

test('F-2 판 머리 ✕: 눌러도 입력칸 초점을 옮기지 않고(pointerdown 취소) · click 은 받은 onClose 그대로 부른다', () => {
  const calls: string[] = []
  const onClose = () => void calls.push('close')
  const x = buttonsOf(PhraseHelperHead({ onClose })).find((b) => b.props['aria-label'] === HELPER.close)
  assert.ok(x, '✕ 버튼 「일본어 도우미 닫기」')
  assert.strictEqual(x.props.onClick, onClose, 'click → 방이 넘긴 닫기 하나')
  // 초점 지킴 — 초점이 옮겨 가 입력칸이 blur 되면 아래 바가 다시 그려져 판이 밀리고 click 이 사라진다
  const down = spyEvent()
  ;(x.props.onPointerDown as (e: unknown) => void)(down.e)
  assert.equal(down.count(), 1, 'pointerdown preventDefault')
  assert.equal(calls.length, 0, 'pointerdown 만으로는 닫지 않는다(click 이 닫는다)')
  ;(x.props.onClick as () => void)()
  assert.deepEqual(calls, ['close'])
  // 누름 영역은 44px 원(둥근 아이콘 버튼)
  assert.ok(String(x.props.className).includes('h-11') && String(x.props.className).includes('w-11'))
})

test('F-2 Esc 와 ✕ 는 같은 닫기 경로 — Esc 는 onClose 를 부르고 기본 동작을 막으며, 다른 키는 무시한다', () => {
  const calls: string[] = []
  const onClose = () => void calls.push('close')
  const onKeyDown = closeOnEscape(onClose)
  const esc = spyEvent()
  onKeyDown({ ...esc.e, key: 'Escape' })
  assert.deepEqual(calls, ['close'])
  assert.equal(esc.count(), 1)
  for (const key of ['Enter', 'Tab', 'a', 'Esc', ' ', 'ArrowDown']) {
    const k = spyEvent()
    onKeyDown({ ...k.e, key })
    assert.equal(k.count(), 0, `${key} 은 막지 않는다`)
  }
  assert.deepEqual(calls, ['close'], '다른 키는 닫지 않는다')

  // 같은 onClose 하나로 ✕ 와 Esc 를 모두 건다 — 판 section 의 두 군데(머리 ✕·키 입력)가 같은 prop 이름을 받는다
  const panel = talkSrc('PhraseHelperPanel.tsx')
  assert.equal((panel.match(/<PhraseHelperHead onClose=\{onClose\} \/>/g) ?? []).length, 1)
  assert.equal((panel.match(/onKeyDown=\{closeOnEscape\(onClose\)\}/g) ?? []).length, 1)
  // 방은 그 onClose 로 초점 복귀 표시 + helper.close() 를 한다(닫는 길이 하나)
  const room = talkSrc('TalkRoom.tsx')
  assert.match(room, /onClose=\{closeHelperToButton\}/)
  assert.match(room, /const closeHelperToButton = \(\) => \{\s*focusHelperBtnRef\.current = true\s*helper\.close\(\)\s*\}/)
})

/** 주석을 걷은 소스에서 `<button` … `</button>` 조각을 전부 뽑는다(JSX 속성 안에 `=>` 가 있어 여는 태그 끝을 `>` 로 찾지 않는다). */
const buttonBlocks = (file: string) => talkSrc(file).split('<button').slice(1).map((b) => b.split('</button>')[0])
const KEEP = 'onPointerDown={keepInputFocus}'

test('keepInputFocus: pointerdown 기본 동작(초점 이동)을 막는다', () => {
  const d = spyEvent()
  keepInputFocus(d.e)
  assert.equal(d.count(), 1)
})

test('F-3 판 안 모든 버튼은 누르는 동안 입력칸 초점을 지킨다 — 버튼별(소스의 <button> 을 전부 훑는다: 새 버튼이 생기면 여기서 걸린다)', () => {
  const expected: Record<string, Array<[string, string]>> = {
    'PhraseHelperPanel.tsx': [
      ['판 머리 ✕', 'aria-label={HELPER.close}'],
      ['[물어보기]', 'type="submit"'],
      ['예시 칩', 'askNow(ex)'],
      ['[다른 말투 n개 더 보기]', 'aria-controls={ALTS_ID}'],
      ['[다시 시도]', '{HELPER.retry}'],
    ],
    'PhraseHelperCard.tsx': [
      ['[입력창에 넣기]', '{HELPER.fill}'],
      ['▶ 듣기·멈추기', 'HELPER.listen(item.ja)'],
    ],
  }
  for (const [file, list] of Object.entries(expected)) {
    const blocks = buttonBlocks(file)
    assert.equal(blocks.length, list.length, `${file}: 버튼 ${blocks.length}개 — 목록(${list.map((x) => x[0]).join(' · ')})과 다르면 새 버튼에 ${KEEP} 를 달고 이 목록에 더한다`)
    for (const [name, hint] of list) {
      const hits = blocks.filter((b) => b.includes(hint))
      assert.equal(hits.length, 1, `${file} ${name}: 단서 「${hint}」 를 가진 버튼이 정확히 하나`)
      assert.ok(hits[0].includes(KEEP), `${file} ${name}: ${KEEP} 가 있어야 첫 탭이 먹는다`)
    }
    for (const b of blocks) assert.ok(b.includes(KEEP), `${file}: ${KEEP} 없는 버튼 — ${b.slice(0, 80).replace(/\s+/g, ' ')}`)
  }
})

const ITEM = { ja: '声がかれています', ko: '목이 쉬었어요', labelKo: '목이 쉬었을 때', whyKo: '자연스러워요' }
const SOUND_STUB = { view: () => ({ phase: 'idle', busy: false, look: 'off' }), line: () => ({ kind: 'live', text: '' }) }
function cardButtons(over: { locked?: boolean; onPlay?: (i: number, t: string) => void; onFill?: (ja: string) => void }) {
  const tree = PhraseHelperCard({
    item: ITEM, index: 2, count: 3, ann: {} as never, textMode: true, textOnly: false, locked: over.locked ?? false,
    sound: SOUND_STUB as never, onPlay: over.onPlay ?? (() => {}), onFill: over.onFill ?? (() => {}),
  })
  const all = buttonsOf(tree)
  return { play: all.find((b) => String(b.props['aria-label']).endsWith('듣기')), fill: all.find((b) => b.props.children === HELPER.fill), count: all.length }
}

test('F-3 카드 버튼 ▶·[입력창에 넣기]: pointerdown 은 초점을 지키고 · click 은 풀려 있을 때만 일을 한다(녹음 중에는 aria-disabled 로 막힘)', () => {
  const calls: string[] = []
  const open = cardButtons({ onPlay: (i, t) => void calls.push(`play:${i}:${t}`), onFill: (ja) => void calls.push(`fill:${ja}`) })
  assert.equal(open.count, 2)
  assert.ok(open.play && open.fill)
  for (const b of [open.play, open.fill]) {
    const d = spyEvent()
    ;(b.props.onPointerDown as (e: unknown) => void)(d.e)
    assert.equal(d.count(), 1, 'pointerdown preventDefault')
    assert.equal(b.props['aria-disabled'], undefined, '풀려 있음')
  }
  assert.deepEqual(calls, [], 'pointerdown 만으로는 아무 일도 하지 않는다')
  ;(open.play.props.onClick as () => void)()
  ;(open.fill.props.onClick as () => void)()
  assert.deepEqual(calls, ['play:2:声がかれています', 'fill:声がかれています'])

  const locked: string[] = []
  const rec = cardButtons({ locked: true, onPlay: () => void locked.push('play'), onFill: () => void locked.push('fill') })
  for (const b of [rec.play, rec.fill]) {
    assert.ok(b)
    assert.equal(b.props['aria-disabled'], true, '녹음 중: aria-disabled')
    const d = spyEvent()
    ;(b.props.onPointerDown as (e: unknown) => void)(d.e)
    assert.equal(d.count(), 1, '잠겨도 초점은 지킨다(입력칸은 disabled 라 초점이 없어도 판이 밀리지 않게 같은 길)')
    ;(b.props.onClick as () => void)()
  }
  assert.deepEqual(locked, [], '잠긴 동안 click 은 일을 하지 않는다')
})

test('F-3 새 질의는 입력칸을 내린다(키보드 내림, §22-10) — [물어보기]·예시 칩·[다시 시도]가 같다 / 막혀 있으면 초점 유지 / [입력창에 넣기]는 초점을 입력창으로', () => {
  const panel = talkSrc('PhraseHelperPanel.tsx')
  assert.match(panel, /const askNow = \(q\?: string\) => \{\s*if \(askBlockOf\(\{ query: q \?\? h\.query, pending, recording: locked, rateWaiting \}\) === null\) ref\.current\?\.blur\(\)\s*h\.ask\(q\)\s*\}/)
  assert.match(panel, /const submit = \(\) => askNow\(\)/, '[물어보기]·Enter')
  assert.match(panel, /onClick=\{\(\) => askNow\(ex\)\}/, '예시 칩')
  assert.match(panel, /if \(waiting \|\| locked\) return\s*ref\.current\?\.blur\(\)\s*h\.retry\(\)/, '[다시 시도]')
  assert.doesNotMatch(panel, /h\.ask\(ex\)/, '칩이 askNow 를 건너뛰지 않는다')
})

test('판 렌더: 머리 ✕ 가 판 안에 한 번 그려진다(PhraseHelperHead 로 옮겨도 마크업 같음)', () => {
  const h = { open: true, query: '', phase: 'idle', items: [], more: false, rateUntil: null, emptyHint: false, serverMsg: null, typing: false, announce: '', setTyping() {}, setMore() {}, setQuery() {}, ask() {}, retry() {}, play() {}, stopSound() {}, fresh: true } as unknown as PhraseHelper
  const html = renderToStaticMarkup(
    createElement(PhraseHelperPanel, { h, kind: 'talk', textMode: false, textOnly: false, locked: false, focusOnOpen: false, onClose() {}, onFill() {}, blocked: false, otherOpen: false, onDismiss() {} }),
  )
  assert.equal((html.match(/aria-label="일본어 도우미 닫기"/g) ?? []).length, 1)
  assert.ok(html.includes('<h2 id="talk-helper-title"'))
})

/* ── F-5 누름 영역 44px ───────────────────────────────────────────── */

/** Tailwind 클래스 이름에서 요소 높이와 `::before` 위아래 확장을 읽어 실제 누름 영역을 계산한다. 테두리는 padding box 바깥이라 `::before` 기준에서 빠진다. */
function hitHeight(cls: string[]): number {
  const unit = (prefix: string) => {
    const c = cls.find((x) => new RegExp(`^${prefix}-\\d+(\\.\\d+)?$`).test(x))
    return c ? Number(c.slice(prefix.length + 1)) * 4 : null
  }
  const h = unit('h')
  assert.ok(h !== null, `높이 클래스 ${cls.join(' ')}`)
  const border = cls.includes('border') ? 1 : 0
  const arb = cls.map((c) => c.match(/^before:-inset-y-\[(\d+)px\]$/)?.[1]).find(Boolean)
  const std = cls.map((c) => c.match(/^before:-inset-(?:y-)?(\d+)$/)?.[1]).find(Boolean)
  const inset = arb ? Number(arb) : std ? Number(std) * 4 : 0
  return h - 2 * border + 2 * inset
}

test('F-5 예시 칩: 보이는 36px 의 누름 영역이 padding box(테두리 안쪽) 기준 확장까지 합쳐 정확히 44px', () => {
  const talk = renderToStaticMarkup(
    createElement(PhraseHelperPanel, {
      h: { open: true, query: '', phase: 'idle', items: [], more: false, rateUntil: null, emptyHint: false, serverMsg: null, typing: false, announce: '', setTyping() {}, setMore() {}, setQuery() {}, ask() {}, retry() {}, play() {}, stopSound() {}, fresh: true } as unknown as PhraseHelper,
      kind: 'talk', textMode: false, textOnly: false, locked: false, focusOnOpen: false, onClose() {}, onFill() {}, blocked: false, otherOpen: false, onDismiss() {},
    }),
  )
  const chips = [...talk.matchAll(/<button type="button" class="([^"]*)"><span class="block truncate">/g)]
  assert.equal(chips.length, HELPER.examples.talk.length)
  for (const [, cls] of chips) {
    const list = cls.split(' ')
    assert.equal(list.includes('h-9'), true, '보이는 높이 36px(h-9)')
    assert.equal(hitHeight(list), 44, `칩 누름 영역: ${cls}`)
  }
})

test('F-5 대조: 테두리 없는 안내 ✕(28px + 8px)·판 머리 ✕(44px 자체)도 44px', () => {
  const tip = renderToStaticMarkup(createElement(PhraseHelperTip, { onClose() {} }))
  const tipBtn = tip.match(/<button type="button" aria-label="안내 닫기" class="([^"]*)"/)
  assert.ok(tipBtn)
  assert.equal(hitHeight(tipBtn[1].split(' ')), 44)
  const head = buttonsOf(PhraseHelperHead({ onClose() {} }))[0]
  assert.equal(hitHeight(String(head.props.className).split(' ')), 44)
  // 계산기 자체 확인: 옛 값(위아래 4px)이면 42 — QA-C 가 잰 값
  assert.equal(hitHeight(['h-9', 'border', 'before:-inset-y-1']), 42)
})
