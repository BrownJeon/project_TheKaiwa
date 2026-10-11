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
  splitLine,
  tapAction,
} from '../cardFirst'
import { HINT } from '../labels'
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

test('fixedHint: 7 갈래(터치·이전 4지선다·답함·뜻 보기 면·보기 열림·앞면 보기 있음/없음)', () => {
  assert.equal(fixedHint({ ...hintBase, coarse: true }), '← 밀어 다음 · → 밀어 이전 · ↑ 밀어 표시')
  assert.equal(fixedHint({ ...hintBase, mode: 'CHOICE' }), '1~4 고르기 · → 다음 · ← 이전 · F 표시')
  assert.equal(fixedHint({ ...hintBase, answered: true, side: 'back' }), 'Enter 다음 카드 · ← 이전 · F 표시')
  assert.equal(fixedHint({ ...hintBase, isCurrent: false, side: 'back' }), 'Enter 다음 카드 · ← 이전 · F 표시', '지난 카드')
  assert.equal(fixedHint({ ...hintBase, side: 'back' }), '1 알았어요 · 2 몰랐어요 · → 다음 · F 표시')
  assert.equal(fixedHint({ ...hintBase, open: true }), '1~4 고르기 · C 닫기 · → 다음 · F 표시')
  assert.equal(fixedHint(hintBase), 'Space 뜻 보기 · C 객관식 · → 다음 · F 표시')
  assert.equal(fixedHint({ ...hintBase, hasChoices: false }), 'Space 뜻 보기 · → 다음 · F 표시')
  assert.equal(fixedHint({ ...hintBase, hasChoices: false, peekable: false }), KEY_HINT.self, '뜻 없는 카드는 앞면에서 1·2')
  assert.equal(fixedHint({ ...hintBase, coarse: true, mode: 'CHOICE' }), KEY_HINT.touch, '터치가 먼저')
})

test('blockedNextHint: 보기 열림 · 뜻 보기 면 · 앞면 닫힘 · 보기 없는 세트 · 이전 4지선다', () => {
  assert.equal(blockedNextHint('FLIP', { choices: CH, open: true }), '먼저 답을 골라 주세요')
  assert.equal(blockedNextHint('FLIP', { choices: CH, flipped: true }), '알았어요·몰랐어요를 먼저 골라 주세요')
  assert.equal(blockedNextHint('FLIP', { choices: CH }), '뜻 보기나 객관식으로 먼저 답해 주세요')
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
