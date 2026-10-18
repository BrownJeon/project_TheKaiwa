import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { JlptLevel, Topic, TopicChunk } from '@/types/lesson'
import { SEED_PACK_LABEL } from '@/types/seedPack'
import { levelLabel } from '@/components/vocab/labels'
import { ConfirmStep, GoalStep } from '../ChallengeCreateScreen'
import { CREATE } from '../challengeCopy'
import { LevelCompareLine, LevelPills, TopicLevelsBody } from '../createParts'
import { EMPTY_DRAFT, profileLevelProps, type Draft, type LevelContext } from '../logic'

/**
 * task-076 REV-076U M-1 — 만들기 화면의 값 연결을 렌더·호출로 확인한다(소스 정규식 아님):
 * 고른 난이도가 알약·확인 단계에 보이는 것, 알약 클릭이 값을 바꾸는 것, 내 수준/내 목표 값 전달, ① 설명 목록.
 * 기대값은 손으로 적은 글이다(구현 식을 되풀이하지 않는다). 화면 본체(`ChallengeCreateScreen`)는 하이드레이션 뒤에만 본문을 그려
 * 정적 렌더가 안 되므로, 그 안의 연결 두 곳(`levelCtx`·① `levels`)은 맨 아래에서 소스로 확인한다.
 */

const ORDER: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']
const text = (html: string) => html.replace(/<[^>]+>/g, '')
const nowrapSpans = (html: string) => [...html.matchAll(/<span class="whitespace-nowrap">(.*?)<\/span>/g)].map((m) => text(m[1]))
const chunk = (i: number): TopicChunk => ({ id: `c${i}`, chunkType: 'ACTION', textJa: `こんにちは${i}`, reading: null, meaningKo: `안녕${i}`, order: i })
const topicOf = (level: JlptLevel): Topic => ({
  id: `t_${level}`,
  title: '카페 주문',
  titleJa: 'カフェで注文',
  level,
  description: null,
  tags: [],
  isSeed: true,
  chunks: [1, 2, 3, 4, 5, 6].map(chunk),
  lessonCount: 0,
  lastLessonAt: null,
})
const draftOf = (level: JlptLevel | null): Draft => ({ ...EMPTY_DRAFT, topicId: 't', level })
const GOAL = { lesson: true, words: false, wordCount: null }

function goalProps(level: JlptLevel | null, topicLevel: JlptLevel, ctx: LevelContext, onChange: (p: Partial<Draft>) => void = () => {}) {
  return { topic: topicOf(topicLevel), draft: draftOf(level), goal: GOAL, today: '2026-10-18', levelCtx: ctx, headRef: null, reasonId: 'rs', onChange }
}

/** ③ 난이도 fieldset 하나만 잘라낸다(그 아래 「하루에 무엇을」 fieldset 과 섞이지 않게). */
function levelFieldset(html: string): string {
  const at = html.indexOf('<fieldset')
  const end = html.indexOf('</fieldset>', at)
  assert.ok(at >= 0 && end > at, '난이도 fieldset')
  return html.slice(at, end + '</fieldset>'.length)
}
const checkedValues = (html: string) =>
  [...html.matchAll(/<input type="radio"[^>]*>/g)].map((m) => m[0]).filter((r) => r.includes('checked=""')).map((r) => /value="(N[1-5])"/.exec(r)?.[1])
const srTexts = (html: string) => [...html.matchAll(/<span class="sr-only">(.*?)<\/span>/g)].map((m) => m[1])
const compareText = (html: string, id: string) => text(new RegExp(`<p id="${id}"[^>]*>(.*?)</p>`).exec(html)?.[1] ?? '<<없음>>')
const hintText = (html: string) => text(/<p aria-live="polite"[^>]*>(.*?)<\/p>/.exec(html)?.[1] ?? '<<없음>>')

// ── (a) ③ 목표 단계 — 고른 난이도·프로필 값이 그대로 보인다 ──────────────────────────────────────

test('③ 정적 렌더: 고른 난이도(≠주제)가 체크된 칸이고, 주제 난이도는 「이 주제 기본」 꼬리말로만 구별된다', () => {
  const ctx: LevelContext = { my: 'N5', goal: 'N3', topic: 'N4' }
  const html = levelFieldset(renderToStaticMarkup(createElement(GoalStep, goalProps('N2', 'N4', ctx))))
  assert.deepEqual(checkedValues(html), ['N2'], '고른 값(N2)만 체크 — 주제 난이도(N4)가 체크되면 안 된다')
  assert.deepEqual(srTexts(html), ['초보자 (N5), 내 수준', '초급 (N4), 이 주제 기본', '중급 (N3), 내 목표', '고급 (N2)', '최상급 (N1)'])
})

test('③ 정적 렌더: 비교 줄의 내 수준·내 목표 값이 넘겨 준 프로필 값과 일치 — 수준·목표를 다르게 줘 서로 바뀌면 실패', () => {
  const html = renderToStaticMarkup(createElement(GoalStep, goalProps('N2', 'N4', { my: 'N5', goal: 'N3', topic: 'N4' })))
  assert.equal(compareText(html, 'rs-lv'), '내 수준 초보자 (N5) · 내 목표 중급 (N3) · 이 주제 초급 (N4)')
  const swapped = renderToStaticMarkup(createElement(GoalStep, goalProps('N2', 'N4', { my: 'N3', goal: 'N5', topic: 'N4' })))
  assert.equal(compareText(swapped, 'rs-lv'), '내 수준 중급 (N3) · 내 목표 초보자 (N5) · 이 주제 초급 (N4)')
  // 목표를 모르면 그 묶음만 빠진다.
  const noGoal = renderToStaticMarkup(createElement(GoalStep, goalProps(null, 'N2', { my: 'N4', goal: null, topic: 'N2' })))
  assert.equal(compareText(noGoal, 'rs-lv'), '내 수준 초급 (N4) · 이 주제 고급 (N2)')
  // 비교 줄 id 가 난이도 묶음 설명으로 이어진다.
  assert.ok(html.includes('aria-describedby="rs-lv"'))
})

test('③ 정적 렌더: 안내 줄은 고른 값과 내 수준의 차이를 말한다 — 내 목표가 아니라 내 수준 기준', () => {
  // 내 수준 N5, 고른 N2 → 3단계 위. 내 목표(N2)와 같아도 경고 기준은 내 수준.
  const high = renderToStaticMarkup(createElement(GoalStep, goalProps('N2', 'N4', { my: 'N5', goal: 'N2', topic: 'N4' })))
  assert.equal(hintText(high), '내 수준보다 3단계 어려워요. 처음엔 모르는 말이 많을 수 있어요.')
  // 내 수준 N2, 고른 N5 → 아래. 내 목표가 N5 여도 같은 문구.
  const low = renderToStaticMarkup(createElement(GoalStep, goalProps('N5', 'N4', { my: 'N2', goal: 'N5', topic: 'N4' })))
  assert.equal(hintText(low), '내 수준보다 쉬워요. 복습하듯 가볍게 할 수 있어요.')
  // 같음·1단계 위 = 비움(자리는 유지).
  assert.equal(hintText(renderToStaticMarkup(createElement(GoalStep, goalProps('N3', 'N4', { my: 'N4', goal: null, topic: 'N4' })))), '')
  assert.equal(hintText(renderToStaticMarkup(createElement(GoalStep, goalProps('N4', 'N4', { my: 'N4', goal: null, topic: 'N4' })))), '')
  // 내 수준을 모르면 안내 없음.
  assert.equal(hintText(renderToStaticMarkup(createElement(GoalStep, goalProps('N1', 'N4', { my: null, goal: 'N1', topic: 'N4' })))), '')
})

test('③ 정적 렌더: 손대지 않은 값은 주제 난이도를 따라간다(주제가 바뀌면 같이 바뀜), 고른 값은 주제가 바뀌어도 남는다', () => {
  const ctx = (topic: JlptLevel): LevelContext => ({ my: 'N4', goal: null, topic })
  for (const t of ORDER) assert.deepEqual(checkedValues(renderToStaticMarkup(createElement(GoalStep, goalProps(null, t, ctx(t))))), [t], `손 안 댐 · 주제 ${t}`)
  for (const t of ORDER) assert.deepEqual(checkedValues(renderToStaticMarkup(createElement(GoalStep, goalProps('N3', t, ctx(t))))), ['N3'], `고름 N3 · 주제 ${t}`)
})

// ── (c) 알약 클릭이 고른 값을 바꾼다 ────────────────────────────────────────────────────────────

type AnyEl = ReactElement<{ children?: ReactNode; [k: string]: unknown }>
/** 요소 트리에서 조건에 맞는 요소를 모두 찾는다(함수 컴포넌트는 호출하지 않고 그 자리의 요소로 둔다). */
function findAll(node: ReactNode, pred: (el: AnyEl) => boolean, out: AnyEl[] = []): AnyEl[] {
  if (Array.isArray(node)) {
    for (const n of node) findAll(n, pred, out)
    return out
  }
  if (isValidElement(node)) {
    const el = node as AnyEl
    if (pred(el)) out.push(el)
    findAll(el.props.children, pred, out)
  }
  return out
}

test('알약 onChange: 칸마다 자기 값을 부모 콜백에 넘긴다(지금 고른 값을 되풀이하지 않음) — 클릭 시뮬레이션', () => {
  const picked: JlptLevel[] = []
  const tree = LevelPills({ name: 'lv', value: 'N3', ctx: { my: 'N4', goal: 'N3', topic: 'N4' }, onChange: (l) => picked.push(l) })
  const inputs = findAll(tree, (el) => el.type === 'input')
  assert.equal(inputs.length, 5)
  assert.deepEqual(inputs.map((el) => el.props.value), ORDER)
  assert.deepEqual(inputs.map((el) => el.props.checked), [false, false, true, false, false])
  for (const el of inputs) (el.props.onChange as (e: unknown) => void)({ target: { value: el.props.value } })
  assert.deepEqual(picked, ['N5', 'N4', 'N3', 'N2', 'N1'])
})

test('③ 알약 연결: GoalStep 이 알약에 고른 값·프로필 값·콜백을 넘기고, 클릭하면 부모에게 {level} 이 간다', () => {
  const ctx: LevelContext = { my: 'N5', goal: 'N3', topic: 'N4' }
  const patches: Partial<Draft>[] = []
  // 훅(useId)이 있는 함수라 Probe 의 렌더 안에서 불러 그 결과 트리를 잡는다.
  let tree: ReactNode = null
  const props = goalProps('N2', 'N4', ctx, (p) => patches.push(p))
  renderToStaticMarkup(
    createElement(() => {
      tree = GoalStep(props)
      return null
    }),
  )
  const pills = findAll(tree, (el) => el.type === LevelPills)
  assert.equal(pills.length, 1)
  assert.equal(pills[0].props.value, 'N2', '알약이 보이는 값 = 고른 값(주제 난이도 N4 아님)')
  assert.deepEqual(pills[0].props.ctx, ctx)
  ;(pills[0].props.onChange as (l: JlptLevel) => void)('N1')
  ;(pills[0].props.onChange as (l: JlptLevel) => void)('N5')
  assert.deepEqual(patches, [{ level: 'N1' }, { level: 'N5' }])
  const lines = findAll(tree, (el) => el.type === LevelCompareLine)
  assert.equal(lines.length, 1)
  assert.deepEqual(lines[0].props.groups, [
    { head: '내 수준', label: '초보자 (N5)' },
    { head: '내 목표', label: '중급 (N3)' },
    { head: '이 주제', label: '초급 (N4)' },
  ])
})

// ── (b) ④ 확인 단계 — 「난이도」 줄 ─────────────────────────────────────────────────────────────

function confirmDd(level: JlptLevel | null, topicLevel: JlptLevel): string {
  const html = renderToStaticMarkup(
    createElement(ConfirmStep, {
      topic: topicOf(topicLevel),
      draft: draftOf(level),
      goal: GOAL,
      startDate: '2026-10-18',
      when: '오늘',
      headRef: null,
      err: null,
      onFix: () => {},
    }),
  )
  const m = /<dt[^>]*>난이도<\/dt><dd[^>]*>(.*?)<\/dd>/.exec(html)
  assert.ok(m, '「난이도」 줄')
  return m[1]
}

test('④ 정적 렌더: 「난이도」 dd = 고른 값, 작은 글 = 「이 주제 기본은 {주제}」 / 같으면 「이 주제 기본」', () => {
  const diff = confirmDd('N3', 'N4')
  assert.equal(text(diff), '중급 (N3)이 주제 기본은 초급 (N4)')
  assert.deepEqual(nowrapSpans(diff), ['중급 (N3)', '초급 (N4)'])
  assert.equal(text(confirmDd('N1', 'N5')), '최상급 (N1)이 주제 기본은 초보자 (N5)')
  // 손대지 않음 = 주제 난이도, 같은 값을 골라도 같은 모양.
  assert.equal(text(confirmDd(null, 'N4')), '초급 (N4)이 주제 기본')
  assert.equal(text(confirmDd('N4', 'N4')), '초급 (N4)이 주제 기본')
  assert.deepEqual(nowrapSpans(confirmDd(null, 'N2')), ['고급 (N2)'])
})

test('④ 정적 렌더: 다섯 단계 전부 — 고른 값(≠주제)이 앞, 주제 난이도가 뒤. 이름 (코드)는 SEED_PACK_LABEL 과 같다', () => {
  assert.equal(SEED_PACK_LABEL.N3, '중급 (N3)', '표기 정본 리터럴')
  for (const sel of ORDER)
    for (const top of ORDER) {
      const expected = sel === top ? `${levelLabel(sel)}${CREATE.rowLevelSame}` : `${levelLabel(sel)}${CREATE.rowLevelDiffHead}${levelLabel(top)}`
      assert.equal(text(confirmDd(sel, top)), expected, `고름 ${sel} · 주제 ${top}`)
      assert.equal(levelLabel(sel), SEED_PACK_LABEL[sel])
    }
  assert.equal(CREATE.rowLevelSame, '이 주제 기본')
  assert.equal(CREATE.rowLevelDiffHead, '이 주제 기본은 ')
})

// ── (d) 프로필 → 화면 props ─────────────────────────────────────────────────────────────────────

test('프로필 → props: 내 수준 = level, 내 목표 = goalLevel (서로 다른 값으로 — 바뀌면 실패), 목표 없음 = null', () => {
  assert.deepEqual(profileLevelProps({ level: 'N5', goalLevel: 'N2' }), { myLevel: 'N5', goalLevel: 'N2' })
  assert.deepEqual(profileLevelProps({ level: 'N1', goalLevel: 'N4' }), { myLevel: 'N1', goalLevel: 'N4' })
  assert.deepEqual(profileLevelProps({ level: 'N3', goalLevel: null }), { myLevel: 'N3', goalLevel: null })
})

// ── (e) ① 주제 고르기 설명 ──────────────────────────────────────────────────────────────────────

test('① 설명: 주어진 levels 를 쌍점 꼴 한 문장으로 — 다섯 단계 · 한 단계 · 빈 목록(「—」)', () => {
  const all = renderToStaticMarkup(createElement(TopicLevelsBody, { levels: ORDER }))
  assert.equal(text(all), '내 수준에 맞는 주제를 보여 드려요: 초보자 (N5) · 초급 (N4) · 중급 (N3) · 고급 (N2) · 최상급 (N1). 챌린지 동안 매일 이 주제로 공부해요.')
  assert.deepEqual(nowrapSpans(all), ['초보자 (N5)', '초급 (N4)', '중급 (N3)', '고급 (N2)', '최상급 (N1)'])
  const one = renderToStaticMarkup(createElement(TopicLevelsBody, { levels: ['N2'] }))
  assert.equal(text(one), '내 수준에 맞는 주제를 보여 드려요: 고급 (N2). 챌린지 동안 매일 이 주제로 공부해요.')
  const none = renderToStaticMarkup(createElement(TopicLevelsBody, { levels: [] }))
  assert.equal(text(none), '내 수준에 맞는 주제를 보여 드려요: —. 챌린지 동안 매일 이 주제로 공부해요.')
  assert.deepEqual(nowrapSpans(none), [])
})

// ── 화면 본체 연결(정적 렌더 불가 — 하이드레이션 뒤에만 본문) · page.tsx ───────────────────────────

const srcDir = join(__dirname, '..', '..', '..')
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
const read = (rel: string) => strip(readFileSync(join(srcDir, rel), 'utf8'))
const count = (src: string, needle: string) => src.split(needle).length - 1

test('연결(소스): 본체가 ③ 에 내 수준 → my · 내 목표 → goal · 고른 주제 난이도 → topic 으로, ① 에 주제 목록의 levels 를 넘긴다', () => {
  const src = read('components/challenge/ChallengeCreateScreen.tsx')
  assert.equal(count(src, 'levelCtx={{ my: myLevel, goal: goalLevel, topic: topic.level }}'), 1)
  assert.equal(count(src, '<TopicLevelsBody levels={(topics.data?.level ?? []).filter(isJlptLevel)} />'), 1)
  assert.match(src, /export function GoalStep\(/)
  assert.match(src, /export function ConfirmStep\(/)
})

test('연결(소스): page.tsx 는 getProfile 결과를 profileLevelProps 로만 화면에 넘긴다(수준·목표를 직접 꺼내 넘기지 않음)', () => {
  const src = read('app/(app)/plan/challenge/new/page.tsx')
  assert.equal(count(src, '{...profileLevelProps(profile)}'), 1)
  assert.ok(!/\bmyLevel=|\bgoalLevel=/.test(src), 'page.tsx 에서 myLevel=/goalLevel= 를 직접 쓰지 않는다')
  assert.match(src, /import \{ profileLevelProps \} from '@\/components\/challenge\/logic'/)
})
