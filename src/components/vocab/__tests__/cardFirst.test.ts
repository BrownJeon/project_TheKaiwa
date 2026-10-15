import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  answeredBy,
  blockedNextHint,
  canChoose,
  canToggleChoices,
  CARD_FIRST,
  choicesState,
  DECK_SOUND_MSG,
  deckHint,
  deckSoundLive,
  deckSoundMessage,
  deckSoundView,
  fixedHint,
  frontHint,
  hasChoices,
  hangulBlock,
  isMixed,
  isNoChoiceSet,
  isSoundStopTap,
  KEY_HINT,
  listenTexts,
  methodBadge,
  methodTally,
  modeTag,
  modeTagAfter,
  resultVerb,
  rightAction,
  canAskSkip,
  canSwipeRight,
  choicesToggleFocus,
  skipSheetOpen,
  splitLine,
  tapAction,
  upAction,
} from '../cardFirst'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readCode } from '../../__tests__/sourceCode'
import DeckToolbar from '../DeckToolbar'
import FlipControls from '../FlipControls'
import { HINT } from '../labels'
import type { DeckCard } from '../useVocabDeck'
import { SOUND_IDLE, type WordSoundState } from '../wordSound'

const CH = ['가다', '물', '불', '친구']
type Ans = 'CORRECT' | 'WRONG' | 'SKIPPED' | null
const c = (answer: Ans, chosenText: string | null = null) => ({ answered: answer !== null, answer, chosenText })

test('hasChoices: undefined·null·[] 은 모두 없음, 보기가 있으면 있음', () => {
  assert.equal(hasChoices({ choices: undefined }), false, '이전 뒤집기 세트')
  assert.equal(hasChoices({ choices: null }), false, '보기 없는 새 세트')
  assert.equal(hasChoices({ choices: [] }), false)
  assert.equal(hasChoices({}), false)
  assert.equal(hasChoices(null), false)
  assert.equal(hasChoices(undefined), false)
  assert.equal(hasChoices({ choices: CH }), true)
})

test('answeredBy: CHOICE · FLIP+chosenText · FLIP 스스로 · SKIPPED · 안 답함', () => {
  assert.equal(answeredBy(c('CORRECT'), 'CHOICE'), 'choice', '이전 4지선다 세트는 늘 객관식')
  assert.equal(answeredBy(c('WRONG', '불'), 'FLIP'), 'choice', 'FLIP 에서 보기로 고른 카드')
  assert.equal(answeredBy(c('CORRECT'), 'FLIP'), 'self', 'FLIP 스스로 표시')
  assert.equal(answeredBy(c('WRONG'), 'FLIP'), 'self')
  assert.equal(answeredBy(c('SKIPPED'), 'FLIP'), 'skip')
  assert.equal(answeredBy(c('SKIPPED'), 'CHOICE'), 'skip', '건너뜀은 방식보다 먼저')
  assert.equal(answeredBy(c(null), 'FLIP'), null)
  assert.equal(answeredBy(c(null, '불'), 'FLIP'), null, '응답 전에는 chosenText 가 있어도 안 답함')
  assert.equal(answeredBy({ answered: false, answer: 'CORRECT', chosenText: null }, 'FLIP'), 'self', 'answer 만 와도 답한 카드')
  assert.equal(answeredBy(undefined, 'FLIP'), null)
})

test('isNoChoiceSet: FLIP 이고 카드가 있고 모든 카드에 보기가 없을 때만', () => {
  const flip = { mode: 'FLIP' as const }
  assert.equal(isNoChoiceSet({ session: flip, cards: [{ choices: null }, { choices: null }] }), true)
  assert.equal(isNoChoiceSet({ session: flip, cards: [{ choices: undefined }, { choices: [] }] }), true)
  assert.equal(isNoChoiceSet({ session: flip, cards: [{ choices: null }, { choices: CH }] }), false)
  assert.equal(isNoChoiceSet({ session: flip, cards: [] }), false, '빈 카드 배열 → false')
  assert.equal(isNoChoiceSet({ session: { mode: 'CHOICE' }, cards: [{ choices: null }] }), false, 'CHOICE → false')
  assert.equal(isNoChoiceSet({ session: null, cards: undefined }), false, '빈 세트 응답')
})

test('choicesState: 카드 우선 세트의 안 답한 앞면에서만 closed/open', () => {
  const open = { choices: CH, answered: false, answer: null, open: true }
  const closed = { ...open, open: false }
  assert.equal(choicesState('FLIP', closed, 'front'), 'closed')
  assert.equal(choicesState('FLIP', open, 'front'), 'open')
  assert.equal(choicesState('FLIP', closed, 'back'), 'none', '뜻 보기 면')
  assert.equal(choicesState('FLIP', { ...closed, answered: true, answer: 'CORRECT' as const }, 'front'), 'none')
  assert.equal(choicesState('FLIP', { ...closed, choices: null }, 'front'), 'none', '보기 없는 세트')
  assert.equal(choicesState('CHOICE', closed, 'front'), 'none', '이전 4지선다 세트')
  assert.equal(choicesState('FLIP', undefined, 'front'), 'none')
})

test('canChoose·canToggleChoices: 보기 고르기는 이전 4지선다 또는 보기를 연 카드만, 뜻을 본 카드는 열지도 고르지도 못한다', () => {
  assert.equal(canChoose('CHOICE', { choices: CH }), true, '이전 4지선다 세트(지금 동작)')
  assert.equal(canChoose('FLIP', { choices: CH, open: true }), true, '카드 우선 F1')
  assert.equal(canChoose('FLIP', { choices: CH, open: false }), false, '보기를 열지 않은 앞면(F0)')
  assert.equal(canChoose('FLIP', { choices: CH, open: true, flipped: true }), false, '뜻 보기 면 — chosenText·selfResult 동시 경로 차단')
  assert.equal(canChoose('FLIP', { choices: null, open: true }), false, '보기 없는 세트')
  assert.equal(canChoose('FLIP', undefined), false)
  assert.equal(canToggleChoices('FLIP', { choices: CH }), true)
  assert.equal(canToggleChoices('FLIP', { choices: CH, flipped: true }), false, 'B0 에서는 객관식을 열 수 없다')
  assert.equal(canToggleChoices('FLIP', { choices: [] }), false)
  assert.equal(canToggleChoices('CHOICE', { choices: CH }), false)
})

test('modeTag: 방식 이름은 이전 4지선다(CHOICE)에만', () => {
  assert.equal(modeTag('CHOICE'), '4지선다 · ')
  assert.equal(modeTag('FLIP'), '')
  assert.equal(modeTagAfter('CHOICE'), ' · 4지선다')
  assert.equal(modeTagAfter('FLIP'), '')
})

// Q9 예시 5장: 食べる 스스로 알았어요 · 行く 객관식 정답 · 水 객관식 오답 · 高い 스스로 몰랐어요 · 友達 표시 후 끝내기(건너뜀)
const Q9 = [c('CORRECT'), c('CORRECT', '가다'), c('WRONG', '불'), c('WRONG'), c('SKIPPED')]

test('methodTally·splitLine: Q9 5장 → 객관식 2장 중 1장 · 스스로 2장 중 1장, 건너뜀은 세지 않는다', () => {
  const t = methodTally(Q9, 'FLIP')
  assert.deepEqual(t, { choice: 2, choiceCorrect: 1, self: 2, selfCorrect: 1 })
  assert.equal(isMixed(t), true)
  assert.equal(splitLine(t), '객관식 2장 중 1장 맞힘 · 스스로 2장 중 1장 알았어요')
  assert.equal(CARD_FIRST.splitLine(2, 1, 2, 1), '객관식 2장 중 1장 맞힘 · 스스로 2장 중 1장 알았어요')
})

test('methodTally·splitLine: 섞이지 않은 세트는 구분 줄이 없다', () => {
  const selfOnly = methodTally([c('CORRECT'), c('WRONG'), c('SKIPPED'), c(null)], 'FLIP')
  assert.deepEqual(selfOnly, { choice: 0, choiceCorrect: 0, self: 2, selfCorrect: 1 })
  assert.equal(splitLine(selfOnly), null)
  const choiceOnly = methodTally([c('CORRECT', '가다'), c('WRONG', '불')], 'FLIP')
  assert.equal(splitLine(choiceOnly), null)
  const legacy = methodTally([c('CORRECT'), c('WRONG')], 'CHOICE')
  assert.deepEqual(legacy, { choice: 2, choiceCorrect: 1, self: 0, selfCorrect: 0 }, '이전 4지선다는 모두 객관식')
  assert.equal(splitLine(legacy), null)
})

test('resultVerb: CHOICE 이거나 객관식 답이 하나라도 있으면 「맞혔어요」', () => {
  assert.equal(resultVerb([c('CORRECT')], 'CHOICE'), '맞혔어요')
  assert.equal(resultVerb(Q9, 'FLIP'), '맞혔어요')
  assert.equal(resultVerb([c('CORRECT'), c('SKIPPED')], 'FLIP'), '알았어요', '스스로만')
  assert.equal(resultVerb([], 'FLIP'), '알았어요')
})

test('methodBadge: 객관식 맞힘/틀림 · 스스로 알았어요/몰랐어요 · 건너뜀 · 안 답함 null', () => {
  assert.deepEqual(Q9.map((x) => methodBadge(x, 'FLIP')), [
    { text: '스스로 알았어요', tone: 'good' },
    { text: '객관식 맞힘', tone: 'good' },
    { text: '객관식 틀림', tone: 'bad' },
    { text: '스스로 몰랐어요', tone: 'bad' },
    { text: '건너뜀', tone: 'neutral' },
  ])
  assert.equal(methodBadge(c(null), 'FLIP'), null)
})

const tapBase = { mode: 'FLIP' as const, side: 'front' as const, isCurrent: true, answered: false, pending: false, hasChoices: true, peekable: true }

test('tapAction: 카드 우선 = 보기 열기/닫기, 뜻 보기 면·답함·대기 = 무반응, 이전 세트 = 지금 동작', () => {
  assert.equal(tapAction(tapBase), 'choices', '카드 우선 세트 앞면')
  assert.equal(tapAction({ ...tapBase, side: 'back' }), 'none', '뜻 보기 면(B0)에서는 객관식을 열지 않는다')
  assert.equal(tapAction({ ...tapBase, answered: true }), 'none')
  assert.equal(tapAction({ ...tapBase, pending: true }), 'none', '확인 중')
  assert.equal(tapAction({ ...tapBase, isCurrent: false }), 'none', '지난 카드')
  assert.equal(tapAction({ ...tapBase, mode: 'CHOICE' }), 'reading', '이전 4지선다: 읽기 토글')
  assert.equal(tapAction({ ...tapBase, hasChoices: false }), 'flip', '보기 없는 세트·이전 뒤집기: 뜻 보기')
  assert.equal(tapAction({ ...tapBase, hasChoices: false, peekable: false }), 'reading', '뜻 없는 FLIP(대체 흐름)')
  assert.equal(tapAction({ ...tapBase, peekable: false }), 'choices', '보기가 있으면 보기가 먼저')
})

test('frontHint: 보기 닫힘·열림·보기 없음·뜻 없음, 이전 4지선다와 답한 카드는 없음', () => {
  const card = { choices: CH, answered: false, answer: null }
  assert.equal(frontHint('FLIP', card, true), '카드를 누르면 객관식으로 골라요')
  assert.equal(frontHint('FLIP', { ...card, open: true }, true), '카드를 다시 누르면 객관식을 닫아요')
  assert.equal(frontHint('FLIP', { ...card, choices: null }, true), '탭하면 뜻이 보여요')
  assert.equal(frontHint('FLIP', { ...card, choices: undefined }, false), '알았어요·몰랐어요를 누르면 뜻이 보여요')
  assert.equal(frontHint('CHOICE', card, false), null)
  assert.equal(frontHint('FLIP', { ...card, answered: true, answer: 'CORRECT' as const }, true), null)
})

const hintBase = { coarse: false, mode: 'FLIP' as const, side: 'front' as const, isCurrent: true, answered: false, open: false, hasChoices: true, peekable: true }

// task-060: 터치 힌트는 바뀐 제스처(↑ 뜻 보기 · → 건너뛰기), 키 힌트는 새 키(S 확인·H 한글)를 넣었다 — 옛 문구 단언을 새 문구로 바꿈.
// task-070: 터치 힌트의 ← 는 이전 카드(옛 다음), → 는 푼 카드에서 다음 카드(안 푼 카드는 건너뛰기).
test('fixedHint: 7 갈래(터치·이전 4지선다·답함·뜻 보기 면·보기 열림·앞면 보기 있음/없음)', () => {
  assert.equal(fixedHint({ ...hintBase, coarse: true }), '↑ 밀어 뜻 보기 · ← 밀어 이전 · → 밀어 건너뛰기')
  assert.equal(fixedHint({ ...hintBase, mode: 'CHOICE' }), '1~4 고르기 · → 다음 · ← 이전 · F 표시')
  assert.equal(fixedHint({ ...hintBase, answered: true, side: 'back' }), 'Enter 다음 카드 · ← 이전 · F 표시')
  assert.equal(fixedHint({ ...hintBase, isCurrent: false, side: 'back' }), 'Enter 다음 카드 · ← 이전 · F 표시', '지난 카드')
  assert.equal(fixedHint({ ...hintBase, side: 'back' }), '1 알았어요 · 2 몰랐어요 · S 건너뛰기 · → 다음 · F 표시')
  assert.equal(fixedHint({ ...hintBase, open: true }), '1~4 고르기 · C 닫기 · S 건너뛰기 · → 다음 · F 표시')
  assert.equal(fixedHint(hintBase), 'Space 뜻 보기 · C 객관식 · S 건너뛰기 · H 한글 · → 다음 · F 표시')
  assert.equal(fixedHint({ ...hintBase, hasChoices: false }), 'Space 뜻 보기 · S 건너뛰기 · H 한글 · → 다음 · F 표시')
  assert.equal(fixedHint({ ...hintBase, hasChoices: false, peekable: false }), KEY_HINT.self, '뜻 없는 카드는 앞면에서 1·2')
  // 수정 라운드: 터치가 먼저인 건 그대로지만, 이전 4지선다 세트는 위로 밀어도 뜻이 안 열리므로(upAction → 「먼저 답을 골라」) 「↑ 밀어 뜻 보기」를 뺀다.
  assert.equal(fixedHint({ ...hintBase, coarse: true, mode: 'CHOICE' }), KEY_HINT.touchChoice, '터치가 먼저(이전 4지선다는 ↑ 없음)')
  assert.equal(fixedHint({ ...hintBase, coarse: true, mode: 'CHOICE' }), '← 밀어 이전 · → 밀어 건너뛰기')
  assert.equal(fixedHint({ ...hintBase, coarse: true, mode: 'FLIP' }), KEY_HINT.touch, 'FLIP 세트의 터치 힌트는 그대로')
  assert.doesNotMatch(KEY_HINT.touchChoice, /↑|뜻 보기/, '이전 4지선다 터치 힌트에 위로 밀기가 없다')
  for (const side of ['front', 'back'] as const) {
    // task-070: 안 답한 4지선다 카드는 면과 무관하게 touchChoice, 답한 4지선다 카드는 → 가 다음이므로 touchDone(건너뛰기라고 거짓말하지 않는다)
    assert.equal(fixedHint({ ...hintBase, coarse: true, mode: 'CHOICE', side }), KEY_HINT.touchChoice, `안 답한 이전 4지선다 터치는 면(${side})과 무관`)
    assert.equal(fixedHint({ ...hintBase, coarse: true, mode: 'CHOICE', side, answered: true }), KEY_HINT.touchDone, `답한 이전 4지선다 카드(${side}) → 는 다음`)
    assert.equal(fixedHint({ ...hintBase, coarse: false, mode: 'CHOICE', side }), KEY_HINT.choice, '정밀 포인터의 이전 4지선다 키 힌트는 그대로')
  }
})

// 감사 REV-060-1 L-1: 터치 고정 힌트는 카드 상태마다 맞는 제스처만 말한다 — ↑·→ 가 반응하지 않는 상태에서 거짓 안내를 하지 않는다.
test('fixedHint 터치 4 갈래: 이전 4지선다 · 답한/지난 카드 · 안 답한 지금 카드의 뒷면 · 앞면', () => {
  const touch = { ...hintBase, coarse: true }
  assert.equal(fixedHint({ ...touch, mode: 'CHOICE' }), KEY_HINT.touchChoice, '안 답한 이전 4지선다')
  assert.equal(fixedHint({ ...touch, mode: 'CHOICE', answered: true, side: 'back' }), KEY_HINT.touchDone, '답한 이전 4지선다는 답한 카드 갈래')
  assert.equal(fixedHint({ ...touch, mode: 'CHOICE', isCurrent: false, answered: true, side: 'back' }), KEY_HINT.touchDone, '지난 이전 4지선다 카드')
  // 답한 카드·지난 카드 — 위로 밀기는 무반응(upAction none), 오른쪽 밀기는 다음 카드(rightAction next)
  assert.equal(fixedHint({ ...touch, answered: true, side: 'back' }), KEY_HINT.touchDone, '답한 지금 카드')
  assert.equal(fixedHint({ ...touch, isCurrent: false, answered: true, side: 'back' }), KEY_HINT.touchDone, '지난 카드')
  assert.equal(fixedHint({ ...touch, isCurrent: false, side: 'front' }), KEY_HINT.touchDone, '지난 카드는 면과 무관')
  // 안 답한 지금 카드의 뒷면 — 이미 뜻을 봤으니 ↑ 가 없고, → 는 건너뛰기 확인(다음으로는 답한 뒤에야)
  assert.equal(fixedHint({ ...touch, side: 'back' }), KEY_HINT.touchBack, '안 답한 지금 카드 뒷면')
  assert.equal(fixedHint({ ...touch, side: 'back', open: true }), KEY_HINT.touchBack, '뒷면이면 보기 열림 여부와 무관')
  // 앞면 — 지금 문구 그대로
  assert.equal(fixedHint(touch), KEY_HINT.touch, '앞면(보기 있음)')
  assert.equal(fixedHint({ ...touch, hasChoices: false }), KEY_HINT.touch, '앞면(보기 없음)')
  assert.equal(fixedHint({ ...touch, open: true }), KEY_HINT.touch, '앞면(보기 열림)')
  // 정해진 문구
  assert.equal(KEY_HINT.touchDone, '← 밀어 이전 · → 밀어 다음')
  assert.equal(KEY_HINT.touchBack, '← 밀어 이전 · → 밀어 건너뛰기')
  // 뜻이 없는 카드(대체 흐름)의 앞면은 ↑ 가 뜻을 못 연다(upAction → 안내) — 뒷면과 같은 문구(정밀 포인터 갈래가 이미 같은 규칙)
  assert.equal(fixedHint({ ...touch, peekable: false, hasChoices: false }), KEY_HINT.touchBack, '뜻 없는 카드 앞면')
  assert.deepEqual(upAction({ mode: 'FLIP', side: 'front', isCurrent: true, answered: false, busy: false, peekable: false }).kind, 'hint', '근거: 그 카드에서 ↑ 는 뜻을 열지 않는다')
})

test('터치 힌트 문구(task-070 지도): ← 는 늘 이전, → 는 푼 카드면 다음·안 푼 카드면 건너뛰기 — 거짓 안내가 없고 360 폭 한 줄에 들어간다', () => {
  assert.doesNotMatch(KEY_HINT.touchDone, /↑|건너뛰기|뜻 보기|표시/, '답한·지난 카드: ↑ 무반응 · → 는 다음이지 건너뛰기가 아니다')
  assert.match(KEY_HINT.touchDone, /→ 밀어 다음/, '푼 카드의 오른쪽 밀기는 다음 카드')
  assert.doesNotMatch(KEY_HINT.touchBack, /↑|뜻 보기|표시|→ 밀어 다음/, '뒷면: 이미 뜻을 봤고 → 는 다음이 아니다')
  assert.match(KEY_HINT.touchBack, /→ 밀어 건너뛰기/, '안 답한 뒷면의 오른쪽 밀기는 건너뛰기 확인')
  assert.match(KEY_HINT.touchChoice, /→ 밀어 건너뛰기/, '안 답한 이전 4지선다의 오른쪽 밀기도 건너뛰기 확인')
  for (const [name, text] of Object.entries({ touch: KEY_HINT.touch, touchDone: KEY_HINT.touchDone, touchBack: KEY_HINT.touchBack, touchChoice: KEY_HINT.touchChoice })) {
    assert.match(text, /← 밀어 이전/, `${name}: 왼쪽 밀기 = 이전 카드`)
    assert.doesNotMatch(text, /← 밀어 다음|→ 밀어 이전/, `${name}: 옛 지도(왼쪽=다음·오른쪽=이전)가 남지 않는다`)
  }
  for (const [name, text] of Object.entries({ touchDone: KEY_HINT.touchDone, touchBack: KEY_HINT.touchBack, touchChoice: KEY_HINT.touchChoice })) {
    assert.ok([...text].length <= [...KEY_HINT.touch].length, `${name} ${[...text].length}자 ≤ touch ${[...KEY_HINT.touch].length}자`)
  }
})

test('blockedNextHint: 보기 열림 · 뜻 보기 면 · 앞면 닫힘 · 보기 없는 세트 · 이전 4지선다', () => {
  assert.equal(blockedNextHint('FLIP', { choices: CH, open: true }), '먼저 답을 골라 주세요')
  assert.equal(blockedNextHint('FLIP', { choices: CH, flipped: true }), '알았어요·몰랐어요를 먼저 골라 주세요')
  // task-060: [뜻 보기]·[객관식] 버튼이 없어져 버튼 이름 대신 카드 조작으로 안내한다(옛: '뜻 보기나 객관식으로 먼저 답해 주세요').
  assert.equal(blockedNextHint('FLIP', { choices: CH }), '카드를 위로 밀거나 눌러서 먼저 답해 주세요')
  assert.equal(blockedNextHint('FLIP', { choices: null }), '알았어요·몰랐어요를 먼저 골라 주세요', '§23-12 ⑦')
  assert.equal(blockedNextHint('CHOICE', { choices: CH }), HINT.answerFirst)
  assert.equal(blockedNextHint('FLIP', undefined), HINT.answerFirst)
})

test('deckHint: 저장 실패류만 빨강, 나머지 중립(문구 그대로)', () => {
  assert.deepEqual(deckHint(HINT.saveFailed), { text: HINT.saveFailed, tone: 'bad' })
  assert.deepEqual(deckHint(HINT.flagFailed), { text: HINT.flagFailed, tone: 'bad' })
  assert.deepEqual(deckHint(HINT.finishFailed), { text: HINT.finishFailed, tone: 'bad' })
  assert.deepEqual(deckHint(HINT.flagged), { text: HINT.flagged, tone: 'neutral' })
  assert.deepEqual(deckHint(CARD_FIRST.answerFirst), { text: CARD_FIRST.answerFirst, tone: 'neutral' })
})

const S = (s: Partial<WordSoundState>): WordSoundState => ({ ...SOUND_IDLE, ...s })

test('deckSoundView: 6 모양 · 보이는 글자 · 접근 이름', () => {
  assert.deepEqual(deckSoundView(SOUND_IDLE, 'word'), { look: 'idle', text: '단어 듣기', ariaLabel: undefined, busy: false, icon: 'play' })
  assert.deepEqual(deckSoundView(SOUND_IDLE, 'ex'), { look: 'idle', text: '예문 듣기', ariaLabel: undefined, busy: false, icon: 'play' })
  assert.deepEqual(deckSoundView(S({ target: 'word', phase: 'loading' }), 'word'), {
    look: 'loading',
    text: '불러오는 중',
    ariaLabel: '단어 불러오는 중, 누르면 취소',
    busy: true,
    icon: 'spin',
  })
  assert.deepEqual(deckSoundView(S({ target: 'ex', phase: 'playing' }), 'ex'), { look: 'on', text: '멈추기', ariaLabel: '예문 소리 멈추기', busy: false, icon: 'stop' })
  assert.equal(deckSoundView(S({ target: 'ex', phase: 'playing' }), 'word').look, 'idle', '소리는 한 번에 하나 — 다른 버튼은 대기')
  assert.equal(deckSoundView(S({ msg: { target: 'word', kind: 'textonly' } }), 'word').look, 'mute')
  assert.equal(deckSoundView(S({ target: 'ex', phase: 'blocked', msg: { target: 'ex', kind: 'blocked' } }), 'ex').look, 'blocked')
  for (const kind of ['fail', 'slow', 'offline'] as const) {
    const v = deckSoundView(S({ msg: { target: 'ex', kind } }), 'ex')
    assert.equal(v.look, 'fail', kind)
    assert.equal(v.text, '예문 듣기')
    assert.equal(v.ariaLabel, undefined)
  }
  assert.equal(deckSoundView(S({ msg: { target: 'word', kind: 'rate' } }), 'word').look, 'idle', '연타는 모양 그대로(안내 줄만)')
  assert.equal(deckSoundView(S({ msg: { target: 'word', kind: 'fail' } }), 'ex').look, 'idle', '안내는 누른 버튼에만')
})

test('deckSoundMessage·DECK_SOUND_MSG: 뜻 보기 면에서만, 실패 셋은 빨강', () => {
  assert.equal(deckSoundMessage(S({ msg: { target: 'word', kind: 'fail' } }), 'front'), null)
  assert.equal(deckSoundMessage(SOUND_IDLE, 'back'), null)
  assert.deepEqual(deckSoundMessage(S({ msg: { target: 'word', kind: 'fail' } }), 'back'), { text: '목소리를 불러오지 못했어요 · 다시 눌러 주세요', tone: 'bad' })
  assert.equal(DECK_SOUND_MSG.slow.tone, 'bad')
  assert.equal(DECK_SOUND_MSG.offline.tone, 'bad')
  assert.deepEqual(DECK_SOUND_MSG.textonly, { text: '지금은 선생님 목소리를 들을 수 없어요(자막만)', tone: 'neutral' })
  assert.equal(DECK_SOUND_MSG.rate.tone, 'neutral')
  assert.equal(DECK_SOUND_MSG.blocked.text, '소리를 켜려면 ▶ 를 한 번 더 눌러 주세요')
  const all = Object.values(DECK_SOUND_MSG).map((m) => m.text).join(' ')
  assert.doesNotMatch(all, /claude|haiku|sonnet|opus|qwen|reazon|whisper|style-bert|엔진|모델/i)
})

test('deckSoundLive·isSoundStopTap: 재생 중 알림, 같은 버튼 다시 누름 = 멈춤', () => {
  assert.equal(deckSoundLive(S({ target: 'ex', phase: 'playing' })), '예문 소리 재생 중')
  assert.equal(deckSoundLive(S({ target: 'word', phase: 'loading' })), '')
  assert.equal(deckSoundLive(SOUND_IDLE), '')
  assert.equal(isSoundStopTap(S({ target: 'word', phase: 'loading' }), 'word'), true)
  assert.equal(isSoundStopTap(S({ target: 'word', phase: 'playing' }), 'word'), true)
  assert.equal(isSoundStopTap(S({ target: 'word', phase: 'playing' }), 'ex'), false, '다른 버튼은 새로 듣기')
  assert.equal(isSoundStopTap(S({ target: 'word', phase: 'blocked' }), 'word'), false, '막힌 소리는 다시 틀기')
})

test('listenTexts: 표현·예문(평문) — 예문 없음·100자 초과는 null', () => {
  assert.deepEqual(listenTexts({ surface: '行く', example: '学校に行く。' }), { word: '行く', ex: '学校に行く。' })
  assert.deepEqual(listenTexts({ surface: '水', example: null }), { word: '水', ex: null })
  assert.equal(listenTexts({ surface: '水', example: 'あ'.repeat(101) }).ex, null)
  assert.equal(listenTexts({ surface: '水', example: 'あ'.repeat(100) }).ex, 'あ'.repeat(100))
})

// ── 구조 가드(§23-3 E · §23-10 D) — 실기기에서만 드러나는 함정을 소스 수준에서 묶어 둔다 ──────────────────

const read = (f: string) => readFileSync(join(process.cwd(), 'src/components/vocab', f), 'utf8')

test('구조: 제스처 영역 touchend 의 preventDefault 유지(카드 탭 직후 생긴 보기에 유령 클릭 방지)', () => {
  const stack = read('SwipeCardStack.tsx')
  const end = stack.slice(stack.indexOf('onTouchEnd={'), stack.indexOf('onTouchCancel='))
  assert.match(end, /e\.preventDefault\(\)/, 'onTouchEnd 안에 preventDefault 가 있어야 한다')
  assert.ok(end.indexOf('preventDefault') < end.indexOf('dragEnd('), 'preventDefault 가 dragEnd(→ onTap) 보다 먼저')
})

test('구조: 카드 면(제스처 영역) 안에는 버튼이 없다 — [객관식]·듣기는 덱의 카드 밖', () => {
  assert.doesNotMatch(read('VocabCardFace.tsx'), /<button|role="button"/)
  const deck = read('VocabDeck.tsx')
  const stage = deck.slice(deck.indexOf('<SwipeCardStack'), deck.indexOf('</div>', deck.indexOf('<SwipeCardStack')))
  assert.doesNotMatch(stage, /DeckListenRow|FlipControls|ChoiceList|<button/, '카드 무대 안에 버튼 부품 없음')
})

test('구조: 덱은 세트 방식 이름을 직접 쓰지 않는다(modeTag 만)', () => {
  assert.doesNotMatch(read('VocabDeck.tsx'), /MODE_LABEL/)
})

// ── task-060 덱 조작 정리 — 위로 밀기 = 뜻 보기 · 오른쪽 밀기 = 건너뛰기 확인 · [읽기]/[한글] 분리 ─────────────────────

const upBase = { mode: 'FLIP' as const, side: 'front' as const, isCurrent: true, answered: false, busy: false, peekable: true }

test('upAction: 지금 카드·안 답함·뜻 있음·앞면이면 뜻 보기, 처리 못 하면 한 줄 안내 또는 무반응(튀지 않음)', () => {
  assert.deepEqual(upAction(upBase), { kind: 'flip' })
  assert.deepEqual(upAction({ ...upBase, side: 'back' }), { kind: 'hint', text: HINT.selfFirst }, '이미 뒤집음')
  assert.deepEqual(upAction({ ...upBase, peekable: false }), { kind: 'hint', text: CARD_FIRST.selfToPeek }, '뜻 없는 카드')
  assert.deepEqual(upAction({ ...upBase, answered: true, side: 'back' }), { kind: 'none' }, '답한 카드 — 뒷면이 이미 보임')
  assert.deepEqual(upAction({ ...upBase, isCurrent: false, answered: true, side: 'back' }), { kind: 'none' }, '지난 카드')
  assert.deepEqual(upAction({ ...upBase, busy: true }), { kind: 'none' }, '답 저장 중·넘기는 중')
  assert.deepEqual(upAction({ ...upBase, mode: 'CHOICE', peekable: false }), { kind: 'hint', text: HINT.answerFirst }, '이전 4지선다 — 고르기 전엔 뜻이 없다')
})

const skipBase = { isCurrent: true, answered: false, busy: false }

test('canAskSkip: 안 답한 지금 카드만 확인 시트를 열 수 있다', () => {
  assert.equal(canAskSkip(skipBase), true)
  assert.equal(canAskSkip({ ...skipBase, answered: true }), false)
  assert.equal(canAskSkip({ ...skipBase, isCurrent: false }), false)
  assert.equal(canAskSkip({ ...skipBase, busy: true }), false)
})

test('rightAction(task-070): 푼 카드(지난 카드 포함) = 다음 카드, 안 푼 지금 카드 = 건너뛰기 확인, 저장/넘기는/끝내는 중 = 무반응', () => {
  assert.deepEqual(rightAction(skipBase), { kind: 'ask' }, '안 푼 지금 카드 — task-060 그대로')
  assert.deepEqual(rightAction({ ...skipBase, answered: true }), { kind: 'next' }, '푼 지금 카드(마지막이면 deck.next 가 결과로)')
  assert.deepEqual(rightAction({ ...skipBase, isCurrent: false, answered: true }), { kind: 'next' }, '푼 지난 카드')
  assert.deepEqual(rightAction({ ...skipBase, busy: true }), { kind: 'none' }, '저장 중 — 안 푼 카드')
  assert.deepEqual(rightAction({ ...skipBase, busy: true, answered: true }), { kind: 'none' }, '넘기는/끝내는 중 — 푼 카드')
  assert.deepEqual(rightAction({ ...skipBase, isCurrent: false }), { kind: 'none' }, '안 푼 지난 카드는 있을 수 없는 상태 — 아무것도 하지 않는다')
  // 어느 경우에도 안내 문구(hint)를 돌려주지 않는다 — 옛 「이전 카드는 아래 [이전] 버튼으로 가요」는 사라졌다
  for (const isCurrent of [true, false]) for (const answered of [true, false]) for (const busy of [true, false]) {
    assert.ok(['next', 'ask', 'none'].includes(rightAction({ isCurrent, answered, busy }).kind), `${isCurrent}/${answered}/${busy}`)
  }
  assert.equal('prevByButton' in CARD_FIRST, false, '오른쪽 밀기는 더 이상 [이전] 버튼을 안내하지 않는다')
})

test('canSwipeRight: 오른쪽 저항 = rightAction 이 무반응이 아닐 때만 자유', () => {
  assert.equal(canSwipeRight(skipBase), true, '건너뛰기 확인을 열 수 있다')
  assert.equal(canSwipeRight({ ...skipBase, answered: true }), true, '다음 카드로 갈 수 있다')
  assert.equal(canSwipeRight({ ...skipBase, isCurrent: false, answered: true }), true)
  assert.equal(canSwipeRight({ ...skipBase, busy: true }), false)
  assert.equal(canSwipeRight({ ...skipBase, busy: true, answered: true }), false)
  assert.equal(canSwipeRight({ ...skipBase, isCurrent: false }), false)
})

test('hangulBlock: 앱 한글 설정 꺼짐과 카드에 한글 표기 없음을 가른다, 불러오는 중·준비됨·설정 로드 전은 막지 않는다', () => {
  assert.equal(hangulBlock({ prefsLoaded: true, appHangul: false, layer: 'off' }), '설정에서 한글 표기를 켜 주세요')
  assert.equal(hangulBlock({ prefsLoaded: true, appHangul: false, layer: 'ready' }), CARD_FIRST.hangul.settingOff, '설정이 먼저')
  assert.equal(hangulBlock({ prefsLoaded: true, appHangul: true, layer: 'none' }), '이 카드는 한글 표기가 없어요', '분석 불가·읽기 불일치')
  assert.equal(hangulBlock({ prefsLoaded: true, appHangul: true, layer: undefined }), CARD_FIRST.hangul.none)
  assert.equal(hangulBlock({ prefsLoaded: true, appHangul: true, layer: 'ready' }), null)
  assert.equal(hangulBlock({ prefsLoaded: true, appHangul: true, layer: 'loading' }), null, '받는 중 — 켜면 자리 막대')
  assert.equal(hangulBlock({ prefsLoaded: false, appHangul: true, layer: 'off' }), null, '설정 로드 전에는 막지 않는다')
})

test('문구(task-060): 앞면 안내·건너뛰기 확인 — 엔진·모델 이름 없음', () => {
  // 수정 라운드: 카드 안 안내(「카드를 누르면 객관식으로 골라요」·「탭하면 뜻이 보여요」)와 겹치지 않게 첫 줄은 위로 밀기만 말한다.
  assert.equal(CARD_FIRST.slotHint, '카드를 위로 밀면 뜻이 보여요')
  assert.equal(CARD_FIRST.slotHintNoChoice, '카드를 위로 밀어도 뜻이 보여요')
  assert.doesNotMatch(`${CARD_FIRST.slotHint} ${CARD_FIRST.slotHintNoChoice}`, /탭|누르|객관식/, '탭·객관식 안내는 카드 안에만 둔다(중복 없음)')
  assert.equal(CARD_FIRST.frontHint, '카드를 누르면 객관식으로 골라요', '카드 안 안내는 그대로')
  assert.equal(CARD_FIRST.tapToPeek, '탭하면 뜻이 보여요', '카드 안 안내는 그대로')
  assert.equal(CARD_FIRST.skipSheet.title, '이 카드를 건너뛸까요?')
  assert.equal(CARD_FIRST.skipSheet.body, "건너뛴 카드는 '건너뜀'으로 기록하고 뜻을 보여 드려요.")
  assert.equal(CARD_FIRST.skipSheet.confirm, '건너뛰기')
  assert.equal(CARD_FIRST.skipSheet.cancel, '취소')
  assert.equal(CARD_FIRST.hangul.label, '한글')
  const all = [CARD_FIRST.slotHint, CARD_FIRST.slotHintNoChoice, CARD_FIRST.answerFirst, ...Object.values(CARD_FIRST.skipSheet), ...Object.values(CARD_FIRST.hangul), ...Object.values(KEY_HINT)].join(' ')
  assert.doesNotMatch(all, /claude|haiku|sonnet|opus|qwen|reazon|whisper|style-bert|엔진|모델/i)
  assert.doesNotMatch(KEY_HINT.touch, /표시/, '터치 힌트에 옛 의미(↑ 표시)가 남지 않는다')
  assert.doesNotMatch(KEY_HINT.touchChoice, /표시/)
})

// 화면 렌더(서버 렌더 한 번) — 앞면 첫 줄은 버튼 없이 52px 자리 + 안내, 뒷면 첫 줄과 같은 높이.
const noop = () => {}
const deckCard = (over: Partial<DeckCard> = {}): DeckCard =>
  ({ order: 0, wordId: 'w1', surface: '行く', reading: 'いく', meaning: '가다', choices: CH, answered: false, answer: null, flagged: false, ...over }) as DeckCard
const buttonsOf = (html: string) => Array.from(html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g), (m) => ({ attrs: m[1], text: m[2].replace(/<[^>]+>/g, '') }))
const classOf = (attrs: string) => /class="([^"]*)"/.exec(attrs)?.[1] ?? ''
const isSrOnly = (attrs: string) => /(?:^|\s)sr-only(?=\s|$)/.test(classOf(attrs))
const rootClass = (html: string) => /^<div class="([^"]*)"/.exec(html)?.[1] ?? ''

test('FlipControls 앞면: [뜻 보기]·[객관식] 이 보이지 않고(화면 읽기 전용 대체 버튼만) 52px 자리에 안내 한 줄', () => {
  const props = { card: deckCard(), side: 'front' as const, peekable: true, locked: false, finePointer: true, onFlip: noop, onSelf: noop }
  const withChoices = renderToStaticMarkup(createElement(FlipControls, { ...props, onChoices: noop }))
  const bs = buttonsOf(withChoices)
  assert.deepEqual(bs.map((b) => b.text), ['뜻 보기', '객관식'], '대체 버튼 2개')
  assert.ok(bs.every((b) => isSrOnly(b.attrs)), '보이는 버튼 없음')
  assert.match(withChoices, new RegExp(CARD_FIRST.slotHint))
  assert.match(withChoices, /<p aria-hidden="true"/, '안내는 화면 읽기에 숨긴다(대체 버튼이 같은 일을 한다)')
  assert.match(rootClass(withChoices), /(?:^|\s)h-\[52px\](?=\s|$)/, '자리 52px 고정')

  const noChoices = renderToStaticMarkup(createElement(FlipControls, props))
  assert.deepEqual(buttonsOf(noChoices).map((b) => [b.text, isSrOnly(b.attrs)]), [['뜻 보기', true]])
  assert.match(noChoices, new RegExp(CARD_FIRST.slotHintNoChoice))
  assert.match(rootClass(noChoices), /(?:^|\s)h-\[52px\](?=\s|$)/)
})

test('choicesToggleFocus: 열면 첫 보기, 닫으면 옮기지 않는다(앞면에 보이는 컨트롤이 없다), 카드 탭은 늘 옮기지 않는다', () => {
  assert.equal(choicesToggleFocus(true, 'btn'), 'first')
  assert.equal(choicesToggleFocus(true, 'key'), 'first')
  assert.equal(choicesToggleFocus(false, 'btn'), null, '닫은 뒤 초점이 눈에 안 보이는 [객관식] 으로 가지 않는다(WCAG 2.4.7)')
  assert.equal(choicesToggleFocus(false, 'key'), null)
  assert.equal(choicesToggleFocus(true, 'tap'), null, '카드 탭은 초점을 옮기지 않는다(§23-6 B)')
  assert.equal(choicesToggleFocus(false, 'tap'), null)
})

// ── 수정 라운드 — 눈에 안 보이는 버튼으로 초점이 가지 않는다 · Tab 으로 닿으면 칩으로 보인다(WCAG 2.4.7) ─────────────────────────
const vocabCode = (f: string) => readCode(join(process.cwd(), 'src/components/vocab', f))

test('초점 구조: 앞면 안내 자리의 sr-only 버튼에는 자동 초점 ref 를 달지 않는다 — 뒷면 [알았어요]·보기 첫 항목·[다음 카드] 초점은 그대로', () => {
  const flip = vocabCode('FlipControls.tsx')
  const front = flip.slice(flip.indexOf("side === 'front' && peekable"), flip.indexOf('const busy'))
  assert.ok(front.includes('CARD_FIRST.flipBtn') && front.includes('CARD_FIRST.choicesBtn'), '앞면 분기를 제대로 잘랐는지(두 대체 버튼을 담고 있어야 한다)')
  assert.doesNotMatch(front, /\bref=/, '앞면의 [뜻 보기]·[객관식] 에 ref 없음 — 자동 초점이 안 보이는 버튼으로 가지 않는다')
  assert.doesNotMatch(flip, /choicesRef/, '[객관식] 초점 ref 는 없다')
  assert.match(flip, /ref=\{r === 'CORRECT' \? firstRef : undefined\}/, '뒷면 [알았어요] 초점은 그대로')
  assert.match(vocabCode('ChoiceList.tsx'), /ref=\{i === 0 \? firstRef : undefined\}/, '보기 첫 항목 초점은 그대로')
  const deck = vocabCode('VocabDeck.tsx')
  assert.doesNotMatch(deck, /choicesRef/)
  assert.match(deck, /nextRef\.current/, '[다음 카드] 초점은 그대로')
  assert.match(deck, /firstRef\.current/)
  const hook = vocabCode('useVocabDeck.ts')
  assert.doesNotMatch(hook, /choicesBtn/, '초점 종류에서 보이지 않는 [객관식] 이 빠졌다')
  assert.match(hook, /choicesToggleFocus\(/, '보기 열기/닫기 초점은 순수 규칙을 쓴다')
})

// 화면 읽기 전용 대체 버튼(sr-only)의 Tab 초점 칩 — 앞면 안내 자리([뜻 보기]·[객관식])와 도구 줄([건너뛰기])이 같은 모양·같은 규칙을 쓴다.
function assertSrChip(attrs: string, label: string) {
  const cls = classOf(attrs).split(/\s+/)
  assert.ok(cls.includes('sr-only'), `${label}: 평소엔 보이지 않는다`)
  // sr-only 가 숨기는 속성(크기·여백·잘림)을 초점 상태에서만 되돌린다. 위치(absolute)는 sr-only 그대로라 자리 밖으로 밀리지 않는다.
  for (const t of ['focus-visible:inset-0', 'focus-visible:m-auto', 'focus-visible:h-8', 'focus-visible:w-fit', 'focus-visible:overflow-visible', 'focus-visible:[clip-path:none]']) {
    assert.ok(cls.includes(t), `${label}: ${t}`)
  }
  assert.ok(cls.includes('focus-visible:border') && cls.includes('focus-visible:border-line') && cls.includes('focus-visible:bg-surface'), `${label}: 테두리 칩(GHOST 와 어울리는 border-line·surface)`)
  assert.ok(cls.includes('focus-visible:outline-2') && cls.includes('focus-visible:outline-accent'), `${label}: 앱 공통 초점 윤곽`)
  // not-sr-only 는 position 을 static 으로 돌려 자리 밖으로 밀어낸다 — 같은 변형의 absolute 와 우선순위도 불확실하다.
  assert.ok(!cls.some((t) => /^focus-visible:(not-sr-only|static|relative|fixed|sticky)$/.test(t)), `${label}: position 을 바꾸지 않는다`)
  assert.ok(!cls.some((t) => /^focus-visible:(h|min-h)-(\d{2,}|\[)/.test(t)), `${label}: 칩이 52px 를 넘지 않는다(h-8 = 32px)`)
}

test('FlipControls 앞면: sr-only 버튼은 Tab 으로 닿을 때(:focus-visible)만 52px 자리 안 칩으로 보이고, 다른 것을 밀어내지 않는다', () => {
  const props = { card: deckCard(), side: 'front' as const, peekable: true, locked: false, finePointer: true, onFlip: noop, onSelf: noop }
  const html = renderToStaticMarkup(createElement(FlipControls, { ...props, onChoices: noop }))
  const bs = buttonsOf(html)
  assert.equal(bs.length, 2)
  for (const b of bs) assertSrChip(b.attrs, b.text)
  assert.match(rootClass(html), /(?:^|\s)relative(?=\s|$)/, '칩의 위치 기준은 52px 자리')
  assert.match(rootClass(html), /(?:^|\s)group\/slot(?=\s|$)/, '이름 있는 group — 위쪽 다른 group 의 초점에 반응하지 않는다')
  assert.match(rootClass(html), /(?:^|\s)h-\[52px\](?=\s|$)/, '높이 52px 고정 유지')
  assert.match(html, /<p aria-hidden="true" class="[^"]*group-has-\[:focus-visible\]\/slot:invisible/, '칩이 뜨는 동안 같은 자리의 안내 글은 감춘다(겹침 방지)')
})

test('FlipControls: 뒤집으면 [알았어요][몰랐어요] 52px — 앞면 자리와 같은 높이(카드 무대 높이 불변), 뜻 없는 앞면·답한 카드는 그대로', () => {
  const props = { card: deckCard(), peekable: true, locked: false, finePointer: false, onFlip: noop, onSelf: noop, onChoices: noop }
  const back = renderToStaticMarkup(createElement(FlipControls, { ...props, side: 'back' as const }))
  const bs = buttonsOf(back)
  assert.deepEqual(bs.map((b) => b.text), ['알았어요', '몰랐어요'])
  for (const b of bs) {
    assert.ok(!isSrOnly(b.attrs), '뒷면 버튼은 보인다')
    assert.match(classOf(b.attrs), /(?:^|\s)h-\[52px\](?=\s|$)/)
  }
  const selfFront = renderToStaticMarkup(createElement(FlipControls, { ...props, side: 'front' as const, peekable: false }))
  assert.deepEqual(buttonsOf(selfFront).map((b) => b.text), ['알았어요', '몰랐어요'], '뜻 없는 카드는 앞면에서 바로 채점(그대로)')
  const done = renderToStaticMarkup(createElement(FlipControls, { ...props, side: 'back' as const, card: deckCard({ answered: true, answer: 'SKIPPED' }) }))
  assert.equal(buttonsOf(done).length, 0)
  assert.match(done, /min-h-\[52px\]/)
})

const toolbarProps = {
  answered: false,
  isFirst: false,
  isLast: false,
  flagged: false,
  showReading: true,
  readingAvailable: true,
  showHangul: false,
  hangulAvailable: true,
  locked: false,
  onPrev: noop,
  onReading: noop,
  onFlag: noop,
  onHangul: noop,
  onSkipAsk: noop,
  onNext: noop,
}

test('DeckToolbar 안 답한 카드: [이전][읽기][표시][한글] 4칸(옛 [건너뛰기] 자리에 [한글]), 건너뛰기는 화면 읽기 전용 버튼만', () => {
  const html = renderToStaticMarkup(createElement(DeckToolbar, toolbarProps))
  const gridStart = html.indexOf('grid grid-cols-4')
  assert.ok(gridStart >= 0)
  const grid = html.slice(gridStart, html.indexOf('</div>', gridStart))
  const cells = buttonsOf(grid)
  assert.deepEqual(cells.map((b) => b.text), ['이전', 'あ읽기', '표시', '가한글'])
  assert.ok(cells.every((b) => !isSrOnly(b.attrs)))
  assert.match(cells[3].attrs, /aria-pressed="false"/, '켬/끔 토글')
  const skip = buttonsOf(html).filter((b) => b.text === '건너뛰기')
  assert.equal(skip.length, 1)
  assert.ok(isSrOnly(skip[0].attrs), '건너뛰기는 보이지 않는다(오른쪽 밀기·S 키의 대체 경로)')
  assert.ok(!grid.includes('건너뛰기'), '도구 줄 칸에는 건너뛰기가 없다')

  const on = buttonsOf(renderToStaticMarkup(createElement(DeckToolbar, { ...toolbarProps, showHangul: true })))
  assert.match(on.find((b) => b.text === '가한글')?.attrs ?? '', /aria-pressed="true"/)
  const blocked = buttonsOf(renderToStaticMarkup(createElement(DeckToolbar, { ...toolbarProps, hangulAvailable: false })))
  const hg = blocked.find((b) => b.text === '가한글')?.attrs ?? ''
  assert.match(hg, /aria-disabled="true"/, '막힘 — 누르면 이유를 알린다')
  assert.doesNotMatch(hg, /aria-pressed/)
  const busy = buttonsOf(renderToStaticMarkup(createElement(DeckToolbar, { ...toolbarProps, locked: true })))
  assert.match(busy.find((b) => b.text === '건너뛰기')?.attrs ?? '', /aria-disabled="true"/)
})

test('DeckToolbar 답한 카드·지난 카드: [이전][표시][다음 카드 ›] 그대로 — [한글]·건너뛰기 없음', () => {
  const html = renderToStaticMarkup(createElement(DeckToolbar, { ...toolbarProps, answered: true }))
  assert.deepEqual(buttonsOf(html).map((b) => b.text), ['이전', '표시', '다음 카드›'])
  const last = renderToStaticMarkup(createElement(DeckToolbar, { ...toolbarProps, answered: true, isLast: true }))
  assert.match(last, /결과 보기/)
})

test('DeckToolbar [건너뛰기]: Tab 으로 닿을 때(:focus-visible)만 칩으로 보인다 — 칸 높이 52px·다른 칸 위치를 밀지 않는다', () => {
  const html = renderToStaticMarkup(createElement(DeckToolbar, toolbarProps))
  const skip = buttonsOf(html).filter((b) => b.text === '건너뛰기')
  assert.equal(skip.length, 1)
  assertSrChip(skip[0].attrs, '건너뛰기')
  // 칩의 위치 기준 = 도구 줄을 감싼 relative 한 겹. 그 겹은 높이·여백을 더하지 않는다(칸 높이·위치 불변).
  assert.equal(rootClass(html), 'relative', '감싸는 겹은 relative 뿐 — 높이·여백·flex·grid 없음')
  const gridStart = html.indexOf('grid grid-cols-4')
  const grid = html.slice(gridStart, html.indexOf('</div>', gridStart))
  assert.ok(!grid.includes('건너뛰기'), '칩은 4칸 격자 밖(절대 위치) — 칸을 하나 더 차지하지 않는다')
  const cells = buttonsOf(grid)
  assert.equal(cells.length, 4)
  for (const b of cells) assert.match(classOf(b.attrs), /(?:^|\s)h-\[52px\](?=\s|$)/, `${b.text} 칸 높이 52px`)
  assert.ok(html.indexOf('건너뛰기') > html.indexOf('</div>', gridStart), '칩은 격자 뒤 — Tab 순서는 [한글] 다음, 그리고 칸 위에 그려진다')
  // 답한 카드의 도구 줄에는 칩 자체가 없다
  assert.ok(!renderToStaticMarkup(createElement(DeckToolbar, { ...toolbarProps, answered: true })).includes('건너뛰기'))
})

test('초점 소스 가드: 새 카드로 넘어갈 때 자동 초점은 눈에 안 보이는 [건너뛰기] 로 가지 않는다', () => {
  const tb = vocabCode('DeckToolbar.tsx')
  const from = tb.indexOf('if (answered)')
  const answeredBranch = tb.slice(from, tb.indexOf('\n  }\n', from))
  assert.match(answeredBranch, /ref=\{nextRef\}/, '자동 초점 ref 는 답한 카드의 [다음 카드] 한 곳')
  const rest = tb.replace(answeredBranch, '')
  assert.doesNotMatch(rest, /\bref=/, '안 답한 카드의 도구 줄([건너뛰기] 포함)에는 ref 가 없다')
  assert.doesNotMatch(tb, /skipRef|useRef/, '[건너뛰기] 에 붙일 ref 자체가 없다')
  const deck = vocabCode('VocabDeck.tsx')
  assert.equal((deck.match(/\.focus\(/g) ?? []).length, 1, '덱의 자동 초점 호출은 효과 한 곳')
  assert.match(deck, /deck\.focus\.kind === 'next' \? nextRef\.current : firstRef\.current/, '자동 초점 대상 = [다음 카드]·첫 보기/[알았어요] 뿐')
  assert.doesNotMatch(deck, /skipRef/)
  assert.match(vocabCode('useVocabDeck.ts'), /export type FocusTarget = \{ seq: number; kind: 'next' \| 'first' \}/, '초점 종류에 건너뛰기가 없다')
  // 건너뛰기 확인 시트가 닫히면 Sheet 가 연 요소(칩)로 초점을 돌려주는 것은 사용자가 직접 연 경우뿐이다 — 덱 코드는 초점을 옮기지 않는다.
  assert.doesNotMatch(vocabCode('SkipConfirmSheet.tsx'), /document\.querySelector|getElementById/, '시트는 [취소] ref 로만 초점을 옮긴다')
})

// 소스 구조(주석을 걷은 코드만 본다 — sourceCode.readCode)
const code = (f: string) => readCode(join(process.cwd(), 'src/components/vocab', f))

test('구조: 위로 밀기는 실제로 뜻이 열릴 때만 카드가 튄다 · 좌우 저항은 갈 수 있는지(canLeft·canRight)로', () => {
  const stack = code('SwipeCardStack.tsx')
  assert.match(stack, /onUp: \(\) => boolean/)
  assert.match(stack, /if \(onUp\(\) && !reducedMotion\) \{\s*setBump\(true\)/)
  assert.equal((stack.match(/setBump\(true\)/g) ?? []).length, 1)
  assert.match(stack, /resistX\(drag\.x, canLeft, canRight\)/)
  assert.doesNotMatch(stack, /canGoPrev|canGoNext|canSkip/, '옛 방향 이름(왼쪽=다음·오른쪽=건너뛰기)이 남지 않는다')
  // task-059 규칙 유지
  assert.match(stack, /touchAction: 'none'/)
  assert.match(stack, /classifyGesture\(x - startRef\.current\.x, y - startRef\.current\.y\)/)
})

test('구조: 덱 배선 — 위 = 뜻 보기(onUp), 오른쪽 = onRight(rightAction), 건너뛰기는 확인 시트에서만, 한글은 [한글] 상태로', () => {
  const deck = code('VocabDeck.tsx')
  const stack = deck.slice(deck.indexOf('<SwipeCardStack'), deck.indexOf('renderTop='))
  assert.match(stack, /onUp=\{onUp\}/)
  assert.match(stack, /onRight=\{onRight\}/)
  assert.match(stack, /canRight=\{/)
  assert.doesNotMatch(stack, /toggleFlag/, '위 = 표시 배선이 남지 않는다')
  assert.match(deck, /upAction\(/)
  assert.match(deck, /rightAction\(/)
  // 건너뛰기(#50 skipped)는 확인 시트의 확정에서만 부른다
  assert.equal((deck.match(/deck\.skip\(\)/g) ?? []).length, 1)
  const sheet = deck.slice(deck.indexOf('<SkipConfirmSheet'), deck.indexOf('/>', deck.indexOf('<SkipConfirmSheet')))
  assert.match(sheet, /deck\.skip\(\)/)
  assert.match(deck, /case 'skipAsk':/)
  assert.match(deck, /case 'hangul':/)
  assert.doesNotMatch(deck, /case 'skip':/)
  assert.match(deck, /const faceHangul = \(deck\.showHangul && /, '앞면 한글 줄은 [한글] 상태')
  assert.doesNotMatch(deck, /deck\.showReading && layers/, '[읽기]가 한글을 켜지 않는다')
  assert.match(deck, /sheetOpen: endOpen \|\| skipOpen \|\|/)
})

// task-070: 좌우 스와이프 지도(왼쪽 = 이전 · 오른쪽 = 푼 카드는 다음/안 푼 카드는 건너뛰기 확인)를 소스 의미로 고정한다.
// light 트랙은 QA 가 없어 배선(어느 방향이 어느 함수로 가는가)을 시험이 직접 잡아야 한다 — 공백·주석에 둔감한 정규식으로 묶는다.
const body = (src: string, from: string, to: string): string => {
  const a = src.indexOf(from)
  assert.ok(a >= 0, `표지 없음: ${from}`)
  const b = src.indexOf(to, a + from.length)
  assert.ok(b > a, `끝 표지 없음: ${to}`)
  return src.slice(a, b)
}

test('구조(task-070): 스택 — 왼쪽 판정 → onLeft, 오른쪽 판정 → onRight, 저항은 canLeft·canRight, 날아가기는 FLY_OUT_TRANSFORM(오른쪽)', () => {
  const stack = code('SwipeCardStack.tsx')
  assert.match(stack, /g\s*===\s*'left'\s*\)\s*onLeft\(\)/, '왼쪽 판정은 onLeft')
  assert.match(stack, /g\s*===\s*'right'\s*\)\s*onRight\(\)/, '오른쪽 판정은 onRight')
  assert.doesNotMatch(stack, /g\s*===\s*'left'\s*\)\s*onRight|g\s*===\s*'right'\s*\)\s*onLeft/, '방향이 뒤바뀌지 않는다')
  assert.match(stack, /import\s*\{[^}]*\bFLY_OUT_TRANSFORM\b[^}]*\}\s*from\s*'\.\/deck'/)
  const exit = body(stack, 'if (exiting) {', '} else if (drag.active)')
  assert.match(exit, /transform\s*=\s*FLY_OUT_TRANSFORM/, '넘어가는 카드는 FLY_OUT_TRANSFORM 으로')
  assert.doesNotMatch(stack, /translateX\(\s*-/, '왼쪽으로 날아가는 literal 이 남지 않는다')
  // reduced-motion 은 날아가지 않고 투명도만 — 기존 규칙
  const reduced = body(exit, 'if (reducedMotion)', 'else {')
  assert.match(reduced, /transition\s*=\s*'opacity 0\.12s ease'/)
  assert.doesNotMatch(reduced, /transform\s*=/, 'reduced-motion 은 transform 을 바꾸지 않는다')
  // 날아가는 동안(exiting)과 잠금(locked)에는 드래그를 시작하지 않는다 — 기존 규칙
  assert.match(stack, /if\s*\(\s*locked\s*\|\|\s*exiting\s*\)\s*return/)
})

test('구조(task-070): 덱 — onLeft = deck.prev, onRight = rightAction 결과(next → deck.next · ask → askSkip), 저항 입력은 canPrev·canSwipeRight', () => {
  const deck = code('VocabDeck.tsx')
  const stack = deck.slice(deck.indexOf('<SwipeCardStack'), deck.indexOf('renderTop='))
  assert.match(stack, /onLeft=\{deck\.prev\}/, '왼쪽 = 이전 카드')
  assert.doesNotMatch(stack, /onLeft=\{deck\.next\}|onLeft=\{onRight\}/)
  assert.match(stack, /onRight=\{onRight\}/)
  assert.doesNotMatch(stack, /onRight=\{deck\./, '오른쪽은 rightAction 을 거친다(안 푼 카드에서 바로 다음으로 가지 않게)')
  assert.match(stack, /canLeft=\{canPrev\(view\)\}/, '왼쪽 저항 = 이전 카드가 있는가')
  assert.match(stack, /canRight=\{canSwipeRight\(skipCtx\)\}/, '오른쪽 저항 = 다음·건너뛰기 확인을 할 수 있는가')
  assert.doesNotMatch(deck, /canGoNext|canSkip=/)
  // 오른쪽으로 날아가는 카드가 `main` 의 가로 스크롤 범위를 만들지 않게 무대가 가로만 자른다
  const at = deck.indexOf('<SwipeCardStack')
  assert.match(deck.slice(deck.lastIndexOf('className="', at), at), /\boverflow-x-clip\b/, '카드 무대 = overflow-x-clip')
  // 오른쪽 밀기·저항의 입력: 지금 카드가 푼 카드인지·지금 카드인지, 저장/넘기는/끝내는 중이면 잠김
  assert.match(deck, /const skipCtx = \{\s*isCurrent,\s*answered,\s*busy: locked\s*\}/)
  assert.match(deck, /const locked = deck\.exiting \|\| finishing \|\| !!card\?\.pending/)
  // 소리는 카드가 바뀌면(왼쪽 밀기의 이전 카드·오른쪽 밀기의 다음 카드 모두) 멈춘다 — 기존 규칙
  assert.match(deck, /useEffect\(\(\) => \{\s*stopSound\(\)\s*\}, \[view, stopSound\]\)/)
  const onRight = body(deck, 'const onRight = () => {', '\n  }\n')
  assert.match(onRight, /rightAction\(skipCtx\)/)
  assert.match(onRight, /r\.kind\s*===\s*'next'\s*\)\s*deck\.next\(\)/, '푼 카드 → 다음 카드(마지막이면 결과는 deck.next)')
  assert.match(onRight, /r\.kind\s*===\s*'ask'\s*\)\s*askSkip\(\)/, '안 푼 카드 → 건너뛰기 확인 시트만(기록은 시트에서)')
  assert.doesNotMatch(onRight, /deck\.skip\(|deck\.prev|showHint/, '오른쪽 밀기가 바로 건너뛰거나 이전으로 가거나 안내를 띄우지 않는다')
  // 건너뛰기 기록(#50 skipped)은 확인 시트의 확정에서만 — 기존 규칙
  assert.equal((deck.match(/deck\.skip\(\)/g) ?? []).length, 1)
  // 키보드·버튼은 그대로: ← = 이전 · → = 다음, [이전] · [다음 카드]
  assert.match(deck, /case\s*'prev':\s*deck\.prev\(\)/)
  assert.match(deck, /case\s*'advance':\s*case\s*'next':\s*deck\.next\(\)/)
  assert.match(deck, /onPrev=\{deck\.prev\}/)
  assert.match(deck, /onNext=\{deck\.next\}/)
})

test('구조(task-070): 훅 — prev 는 canPrev 로 첫 카드 안내, next 는 안 푼 카드 막힘 안내 · 마지막 푼 카드 결과 · 날아간 뒤 다음 카드', () => {
  const hook = code('useVocabDeck.ts')
  const prev = body(hook, 'const prev = useCallback(() => {', '[goTo, showHint]')
  assert.match(prev, /if\s*\(\s*!canPrev\(v\)\s*\)\s*\{\s*showHint\(HINT\.firstCard\)\s*return\s*\}/, '첫 카드면 「첫 카드예요」')
  assert.match(prev, /goTo\(v - 1\)/)
  const next = body(hook, 'const next = useCallback(() => {', '[doFinish, goTo, mode, reducedMotion, showHint]')
  assert.match(next, /if\s*\(\s*!isAnswered\(cs\[v\]\)\s*\)\s*\{\s*showHint\(blockedNextHint\(mode, cs\[v\]\)\)\s*return\s*\}/, '안 푼 카드에서 다음은 막힘 안내(키보드 →·[다음 카드])')
  assert.match(next, /if\s*\(\s*v \+ 1 >= cs\.length\s*\)\s*\{\s*void doFinish\(\)\s*return\s*\}/, '마지막 푼 카드는 결과')
  assert.match(next, /setExiting\(true\)/)
  assert.match(next, /goTo\(v \+ 1\)/)
  assert.match(next, /reducedMotion \? 120 : FLY_MS/, 'reduced-motion 은 기존대로')
})

test('구조: 앞면 한글 줄은 [읽기]와 무관 — 카드 면은 넘겨받은 한글 상태만 그린다', () => {
  const face = code('VocabCardFace.tsx')
  assert.doesNotMatch(face, /showReading \? <HangulLine/)
  assert.match(face, /<HangulLine state=\{hangul\} size=\{15\} \/>/)
  assert.match(face, /ruby=\{showReading \? ruby : null\}/, '[읽기] = 앞면 히라가나(루비)만')
})

test('구조: 건너뛰기 확인 시트 — 공용 Sheet(초점·Esc·바깥 탭·aria-modal), 본문을 두 버튼 설명으로, 확정 → 취소 순서, 첫 초점 [취소]', () => {
  const s = code('SkipConfirmSheet.tsx')
  assert.match(s, /from '@\/components\/common\/Sheet'/)
  assert.match(s, /<p id=\{bodyId\}/)
  assert.equal((s.match(/aria-describedby=\{bodyId\}/g) ?? []).length, 2, '첫 초점이 [취소]여도 본문을 읽는다')
  assert.doesNotMatch(s, /\bdescribedBy=/, 'Sheet describedBy 연결은 주제 삭제 확인 한 곳(removalA11y M-1)')
  assert.match(s, /setTimeout\(\(\) => cancelRef\.current\?\.focus\(\), 0\)/, 'Sheet 가 제목에 초점을 준 뒤 [취소]로')
  assert.ok(s.indexOf('skipSheet.confirm') < s.indexOf('skipSheet.cancel'), '확정 → 취소(전 화면 순서)')
  assert.match(s, /ref=\{cancelRef\}/)
})

// ── 감사 REV-060-1 M-1 · L-2 · L-3 — 건너뛰기 시트 열림 조건과 덱 핵심 배선을 잠근다 ─────────────────────────────────────────

const sheetBase = { skipFor: 4, order: 4, answered: false, phase: 'playing' as const }

test('skipSheetOpen: 연 카드가 지금 보이고 · 안 답했고 · 덱이 playing 일 때만 열려 있다', () => {
  assert.equal(skipSheetOpen(sheetBase), true)
  assert.equal(skipSheetOpen({ ...sheetBase, skipFor: null }), false, '연 적 없음')
  assert.equal(skipSheetOpen({ ...sheetBase, order: 5 }), false, '다른 카드로 바뀜')
  assert.equal(skipSheetOpen({ ...sheetBase, order: null }), false, '카드 없음')
  assert.equal(skipSheetOpen({ ...sheetBase, answered: true }), false, '답이 들어옴')
  for (const phase of ['loading', 'finishing', 'result', 'closed', 'notFound', 'error'] as const) {
    assert.equal(skipSheetOpen({ ...sheetBase, phase }), false, `phase ${phase}`)
  }
  assert.equal(skipSheetOpen({ skipFor: 0, order: 0, answered: false, phase: 'playing' }), true, '첫 카드(order 0)도 열린다 — 0 을 「없음」으로 읽지 않는다')
})

/** 주석 걷은 소스에서 `from` 이 시작하는 줄부터, 그 줄과 같은 들여쓰기의 닫는 `}` 까지(둘 다 포함). */
function block(src: string, from: string): string {
  const at = src.indexOf(from)
  assert.ok(at >= 0, `소스에 ${from} 가 없다`)
  const lineStart = src.lastIndexOf('\n', at) + 1
  const indent = /^\s*/.exec(src.slice(lineStart))![0]
  const end = src.indexOf(`\n${indent}}`, at)
  assert.ok(end > at, `${from} 의 닫는 줄을 못 찾았다`)
  return src.slice(at, end + 1 + indent.length + 1)
}

test('구조(M-1): 덱 [한글]·H 키는 toggleHangul, [읽기]·기존 키는 toggleReading — 서로 바뀌지 않는다', () => {
  const deck = code('VocabDeck.tsx')
  const bar = deck.slice(deck.indexOf('<DeckToolbar'), deck.indexOf('/>', deck.indexOf('<DeckToolbar')))
  assert.match(bar, /onHangul=\{\(\) => deck\.toggleHangul\(hangulBlocked\)\}/, '[한글] 버튼 = toggleHangul(막힘 사유)')
  assert.match(bar, /onReading=\{deck\.toggleReading\}/, '[읽기] 버튼 = toggleReading')
  assert.match(bar, /hangulAvailable=\{!hangulBlocked\}/, '[한글] 가능 여부 = 막힘 사유 없음')
  assert.match(bar, /showHangul=\{deck\.showHangul\}/)
  assert.doesNotMatch(bar, /onHangul=\{[^}]*toggleReading/, '[한글] 이 [읽기] 상태를 건드리지 않는다')
  assert.doesNotMatch(bar, /onReading=\{[^}]*toggleHangul/, '[읽기] 가 [한글] 상태를 건드리지 않는다')
  const keys = block(deck, 'switch (intent.type) {')
  assert.match(keys, /case 'hangul':\s*deck\.toggleHangul\(hangulBlocked\)\s*break/, 'H 키 = toggleHangul(막힘 사유)')
  assert.match(keys, /case 'reading':\s*deck\.toggleReading\(\)\s*break/, '읽기 키 = toggleReading')
  // 도구 줄 두 버튼이 제 핸들러에 걸려 있다(칸 순서: [읽기] 가 [한글] 앞)
  const bar2 = code('DeckToolbar.tsx')
  const reading = bar2.slice(bar2.indexOf('onClick={onReading}') - 200, bar2.indexOf('onClick={onReading}') + 20)
  assert.match(reading, /aria-pressed=\{readingAvailable \? showReading : undefined\}[\s\S]*onClick=\{onReading\}/, '[읽기] 칸')
  const hangul = bar2.slice(bar2.indexOf('onClick={onHangul}') - 200, bar2.indexOf('onClick={onHangul}') + 20)
  assert.match(hangul, /aria-pressed=\{hangulAvailable \? showHangul : undefined\}[\s\S]*aria-disabled=\{!hangulAvailable \|\| undefined\}[\s\S]*onClick=\{onHangul\}/, '[한글] 칸')
  assert.equal((bar2.match(/onClick=\{onReading\}/g) ?? []).length, 1)
  assert.equal((bar2.match(/onClick=\{onHangul\}/g) ?? []).length, 1)
})

test('구조(M-1): 위로 밀기 콜백은 실제로 뜻이 열릴 때만 true 를 돌려준다', () => {
  const up = block(code('VocabDeck.tsx'), 'const onUp = (): boolean => {')
  assert.match(up, /const r = upAction\(\{ mode, side, isCurrent, answered, busy: locked, peekable \}\)/)
  assert.match(up, /if \(r\.kind === 'flip'\) deck\.flip\(\)/)
  assert.match(up, /else if \(r\.kind === 'hint'\) deck\.showHint\(r\.text\)/)
  assert.match(up, /return r\.kind === 'flip'\s*\}$/, '튀는 조건 = flip 일 때만(콜백의 마지막 문장)')
  assert.doesNotMatch(up, /return true|return !!|return r\.kind !== /)
})

test('구조(M-1): 건너뛰기 열림 조건은 skipSheetOpen 하나 · 시트는 askSkip 으로만 연다 · 기록은 시트 확정 한 곳', () => {
  const deck = code('VocabDeck.tsx')
  assert.match(deck, /const skipOpen = skipSheetOpen\(\{ skipFor, order: card\?\.order \?\? null, answered, phase: deck\.phase \}\)/, '열림 조건은 순수 함수 한 곳')
  assert.doesNotMatch(deck, /skipFor === card\.order|!answered && deck\.phase === 'playing'/, '컴포넌트 안에 열림 조건을 다시 쓰지 않는다')
  assert.match(deck, /<SkipConfirmSheet\s+open=\{skipOpen\}/)
  // askSkip: 가드를 모두 가지고, setSkipFor(card.order) 로만 연다
  const ask = block(deck, 'const askSkip = () => {')
  assert.match(ask, /!card/)
  assert.match(ask, /endOpen/, 'L-2: 끝내기 확인 시트가 열려 있으면 열지 않는다')
  assert.match(ask, /deck\.phase !== 'playing'/)
  assert.match(ask, /!canAskSkip\(skipCtx\)/)
  assert.match(ask, /^\s*if \([^\n]*\) return\s*\n\s*setSkipFor\(card\.order\)/m, '가드(return) 뒤에 setSkipFor(card.order)')
  // setSkipFor 인자는 card.order(askSkip 안 한 곳)와 null(닫기) 뿐
  const args = [...deck.matchAll(/setSkipFor\(([^)]*)\)/g)].map((m) => m[1])
  assert.equal(args.filter((a) => a === 'card.order').length, 1)
  assert.ok(args.every((a) => a === 'card.order' || a === 'null'), `setSkipFor 인자: ${args.join(', ')}`)
  assert.equal((ask.match(/setSkipFor\(/g) ?? []).length, 1)
  // 열림 경로 셋(오른쪽 밀기 · S 키 · 화면 읽기 [건너뛰기])은 askSkip 만 부른다
  assert.match(block(deck, 'const onRight = () => {'), /if \(r\.kind === 'ask'\) askSkip\(\)/)
  assert.match(block(deck, 'switch (intent.type) {'), /case 'skipAsk':\s*askSkip\(\)\s*break/)
  assert.match(deck.slice(deck.indexOf('<DeckToolbar'), deck.indexOf('/>', deck.indexOf('<DeckToolbar'))), /onSkipAsk=\{askSkip\}/)
  // 건너뛰기 기록(deck.skip)은 시트 확정에서만 — 참조로 넘기는 경로도 없다
  assert.equal((deck.match(/\bdeck\.skip\b/g) ?? []).length, 1, 'deck.skip 은 한 곳')
  const sheet = deck.slice(deck.indexOf('<SkipConfirmSheet'), deck.indexOf('/>', deck.indexOf('<SkipConfirmSheet')))
  assert.match(sheet, /onConfirm=\{\(\) => \{\s*setSkipFor\(null\)\s*deck\.skip\(\)\s*\}\}/, '확정 = 시트 닫고 기록')
  assert.match(sheet, /onClose=\{\(\) => setSkipFor\(null\)\}/)
})

test('구조(L-3): 열림 조건이 풀리면 연 카드 기록(skipFor)을 비운다 — 끝내기 실패로 phase 가 되돌아와도 시트가 다시 열리지 않는다', () => {
  const deck = code('VocabDeck.tsx')
  assert.match(deck, /if \(skipFor !== null && !skipOpen\) setSkipFor\(null\)/)
  // 렌더 중 상태 정리(ExpressionEditor 와 같은 패턴)는 skipOpen 계산 뒤·askSkip 앞, 그리고 hooks(useEffect)가 아닌 본문
  assert.ok(deck.indexOf('const skipOpen = ') < deck.indexOf('if (skipFor !== null && !skipOpen)'))
  assert.ok(deck.indexOf('if (skipFor !== null && !skipOpen)') < deck.indexOf('const askSkip = '))
  // 순수 규칙으로 보면: 같은 카드가 다시 playing 이 되어도 skipFor 가 비어 있으면 닫힘
  assert.equal(skipSheetOpen({ skipFor: null, order: 4, answered: false, phase: 'playing' }), false)
})
