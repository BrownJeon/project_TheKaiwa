import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { answeredBy, showsChoiceList } from '../cardFirst'
import FlipControls from '../FlipControls'
import { choiceRecordedText, flipRecordedText } from '../labels'
import type { DeckCard } from '../useVocabDeck'
import { readCode } from '../../__tests__/sourceCode'

// task-084(IMP-0062) — 카드 우선 세트에서 객관식으로 답한 카드도 보기 없이 기록 한 줄. 이전 4지선다 세트·답하기 전 보기 열림은 그대로.

const CH = ['가다', '물', '불', '친구']
type Ans = 'CORRECT' | 'WRONG' | 'SKIPPED' | null
const base = (answer: Ans, over: { open?: boolean; chosenText?: string | null } = {}) => ({ answered: answer !== null, answer, ...over })

test('showsChoiceList: 이전 4지선다(CHOICE)는 답하기 전·후 모두 보기를 그린다(그 세트의 모양은 그대로)', () => {
  for (const answer of [null, 'CORRECT', 'WRONG', 'SKIPPED'] as const) {
    for (const open of [false, true]) {
      assert.equal(showsChoiceList('CHOICE', base(answer, { open })), true, `CHOICE answer=${answer} open=${open}`)
    }
  }
  assert.equal(showsChoiceList('CHOICE', null), true, '카드가 아직 없어도 CHOICE 는 보기 쪽(덱은 카드 없으면 그리지 않는다)')
})

test('showsChoiceList: 카드 우선(FLIP) — 보기를 열었고 아직 안 답한 카드만 보기, 나머지는 기록/버튼 영역', () => {
  assert.equal(showsChoiceList('FLIP', base(null, { open: true })), true, '답하기 전 보기 열림(F1·P)')
  assert.equal(showsChoiceList('FLIP', base(null, { open: false })), false, '보기 닫힘(F0)')
  assert.equal(showsChoiceList('FLIP', base(null)), false, 'open 없음(이전 뒤집기 세트·새 마운트)')
  assert.equal(showsChoiceList('FLIP', null), false)
  assert.equal(showsChoiceList('FLIP', undefined), false)
})

test('showsChoiceList: 카드 우선(FLIP)에서 답한 카드는 직접·객관식·건너뜀 모두 보기 없음 — 열림 값이 남아 있어도 보지 않는다', () => {
  const answered = [
    ['직접 알았어요', base('CORRECT', { chosenText: null })],
    ['직접 몰랐어요', base('WRONG', { chosenText: null })],
    ['객관식 맞힘', base('CORRECT', { chosenText: '가다' })],
    ['객관식 틀림', base('WRONG', { chosenText: '불' })],
    ['건너뜀', base('SKIPPED', { chosenText: null })],
  ] as const
  for (const [label, card] of answered) {
    assert.equal(showsChoiceList('FLIP', card), false, `${label} · 열림 없음`)
    assert.equal(showsChoiceList('FLIP', { ...card, open: true }), false, `${label} · 열림 값이 남은 상태에서도 보기를 그리지 않는다(task-084 핵심)`)
  }
  // 답이 answer 로만 와도(answered 플래그 없이) 답한 카드다 — `isAnswered` 규칙 그대로
  assert.equal(showsChoiceList('FLIP', { answered: false, answer: 'WRONG', open: true }), false, 'answer 만 와도 답한 카드')
  // 객관식으로 답한 카드는 방식 판정(answeredBy)은 여전히 'choice' — 띠·결과 목록·내 답이 이 값을 쓴다
  assert.equal(answeredBy({ answered: true, answer: 'WRONG', chosenText: '불' }, 'FLIP'), 'choice')
})

test('기록 한 줄 문구: 객관식은 띠와 같은 말(맞았어요·틀렸어요), 직접·건너뜀은 그대로', () => {
  assert.equal(flipRecordedText('CORRECT', '가다'), '맞았어요로 기록했어요', '객관식 맞힘')
  assert.equal(flipRecordedText('WRONG', '불'), '틀렸어요로 기록했어요', '객관식 틀림 — 「몰랐어요」가 아니다')
  assert.equal(flipRecordedText('CORRECT', null), '알았어요로 기록했어요', '직접 알았어요')
  assert.equal(flipRecordedText('WRONG', null), '몰랐어요로 기록했어요', '직접 몰랐어요')
  assert.equal(flipRecordedText('CORRECT'), '알았어요로 기록했어요', 'chosenText 인자 없이도 직접 답으로 읽는다')
  assert.equal(flipRecordedText('SKIPPED', null), '건너뛴 카드로 기록했어요')
  assert.equal(flipRecordedText('SKIPPED', '불'), '건너뛴 카드로 기록했어요', '건너뜀은 chosenText 가 남아 있어도 건너뜀 문구')
  assert.equal(choiceRecordedText('CORRECT'), '맞았어요로 기록했어요')
  assert.equal(choiceRecordedText('WRONG'), '틀렸어요로 기록했어요')
})

const noop = () => {}
const deckCard = (over: Partial<DeckCard> = {}): DeckCard =>
  ({ order: 0, wordId: 'w1', surface: '行く', reading: 'いく', meaning: '가다', choices: CH, answered: false, answer: null, flagged: false, ...over }) as DeckCard
const props = { side: 'back' as const, peekable: true, locked: true, finePointer: false, onFlip: noop, onSelf: noop, onChoices: noop }
const render = (card: DeckCard) => renderToStaticMarkup(createElement(FlipControls, { ...props, card }))
const textOf = (html: string) => html.replace(/<[^>]+>/g, '')

test('FlipControls: 객관식으로 답한 카드도 버튼 없이 기록 한 줄 — 직접 답한 카드와 같은 마크업(문구만 다름)', () => {
  const choiceRight = render(deckCard({ answered: true, answer: 'CORRECT', chosenText: '가다', correctText: '가다' }))
  const choiceWrong = render(deckCard({ answered: true, answer: 'WRONG', chosenText: '불', correctText: '가다' }))
  const selfRight = render(deckCard({ answered: true, answer: 'CORRECT', chosenText: null }))
  const skipped = render(deckCard({ answered: true, answer: 'SKIPPED', chosenText: null }))
  assert.equal(textOf(choiceRight), '맞았어요로 기록했어요')
  assert.equal(textOf(choiceWrong), '틀렸어요로 기록했어요')
  assert.equal(textOf(selfRight), '알았어요로 기록했어요')
  assert.equal(textOf(skipped), '건너뛴 카드로 기록했어요')
  for (const html of [choiceRight, choiceWrong, selfRight, skipped]) {
    assert.doesNotMatch(html, /<button|<ol|<li/, '보기·버튼 없음')
    assert.match(html, /^<p role="status" class="[^"]*min-h-\[52px\]/, '직접 답한 카드와 같은 52px 기록 줄')
  }
  assert.equal(choiceRight.replace(textOf(choiceRight), ''), selfRight.replace(textOf(selfRight), ''), '문구를 빼면 마크업이 같다')
})

const code = (f: string) => readCode(join(process.cwd(), 'src/components/vocab', f))

test('배선: 덱 아래 영역은 showsChoiceList 하나로 가르고(옛 answeredBy 분기 없음), 답 응답은 어떤 방식이든 보기를 닫고 초점을 [다음 카드]로 보낸다', () => {
  const deck = code('VocabDeck.tsx')
  assert.match(deck, /\{showsChoiceList\(mode, card\) \? \(/, '아래 영역 분기는 순수 함수 하나')
  assert.doesNotMatch(deck, /answeredBy\(/, '객관식으로 답한 카드의 ChoiceList(locked) 줄이 돌아오지 않는다')
  assert.match(code('FlipControls.tsx'), /flipRecordedText\(card\.answer, card\.chosenText\)/, '기록 줄이 chosenText 로 방식을 가른다')

  const hook = code('useVocabDeck.ts')
  const at = hook.indexOf("(i: number, r: AttemptResult, kind: 'choice' | 'self' | 'skip') => {")
  assert.ok(at >= 0, 'onAnswered 를 찾는다')
  const end = hook.indexOf('\n    },', at)
  const onAnswered = hook.slice(at, end)
  assert.match(onAnswered, /open: false/, '① 답이 들어오면 보기 열림(open)을 끈다 — 방식 무관')
  assert.match(onAnswered, /^      setFocus\(\(x\) => \(\{ seq: x\.seq \+ 1, kind: 'next' \}\)\)$/m, '② 초점은 kind 조건 없이 늘 [다음 카드] — 객관식도 직접 답과 같은 길')
  const focusAt = onAnswered.indexOf('setFocus(')
  assert.doesNotMatch(onAnswered.slice(0, focusAt), /if \(kind === 'self'\) \{|if \(kind !== 'choice'\)/, '초점 앞에 방식 분기 없음')
})
