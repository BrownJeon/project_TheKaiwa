import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { JlptLevel, Topic, TopicChunk } from '@/types/lesson'
import { GoalStep } from '../ChallengeCreateScreen'
import { CREATE } from '../challengeCopy'
import { EMPTY_DRAFT, wordsLevelNote, type Draft, type LevelContext } from '../logic'

/**
 * task-078 화면(screens.md §35 · 승인 데모 v1, 질문 1 C2 · 2 a · 3 b · 4 a) — 챌린지 만들기 ③ 난이도 묶음 맨 아래
 * 「새 단어 안내」 상자. 고른 난이도가 이 주제보다 2단계 이상 어려울 때만 보이고, 쉬운 쪽·단어 목표·내 수준과 무관하다.
 * 기대값은 손으로 옮긴 표·글이다(구현 식을 되풀이하지 않는다 — level076View 와 같은 원칙).
 */

const ORDER: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']
const text = (html: string) => html.replace(/<[^>]+>/g, '')
const NOTE = '이 주제보다 많이 어려운 난이도라, 새 단어가 모자란 날은 주제 표현으로 채워요.'
const HIGH2 = '내 수준보다 2단계 어려워요. 처음엔 모르는 말이 많을 수 있어요.'
const INFOBOX = 'rounded-xl bg-surface2'

// ── ① 순수 함수 — 35-4 경계표 25칸 전수 ─────────────────────────────────────────────────────────

// 행 = 고른 난이도, 열 = 주제 난이도(N5 N4 N3 N2 N1). 숫자 = { steps }, 0 = null(안 보임).
const TABLE: Record<JlptLevel, readonly number[]> = {
  N5: [0, 0, 0, 0, 0],
  N4: [0, 0, 0, 0, 0],
  N3: [2, 0, 0, 0, 0],
  N2: [3, 2, 0, 0, 0],
  N1: [4, 3, 2, 0, 0],
}

test('① wordsLevelNote: 25칸 전수 — 주제보다 2·3·4단계 어려우면 { steps }, 1단계·같음·쉬운 쪽(−1~−4)은 null', () => {
  let shown = 0
  for (const sel of ORDER) {
    ORDER.forEach((topic, i) => {
      const want = TABLE[sel][i]
      const got = wordsLevelNote(sel, topic)
      if (want === 0) assert.equal(got, null, `고른 ${sel} · 주제 ${topic}`)
      else {
        shown++
        assert.deepEqual(got, { steps: want }, `고른 ${sel} · 주제 ${topic}`)
      }
    })
  }
  assert.equal(shown, 6, '보이는 칸은 25칸 중 6칸')
})

test('① wordsLevelNote: 반환은 { steps } 하나뿐(방향 필드 없음 — 질문 2 a)', () => {
  assert.deepEqual(Object.keys(wordsLevelNote('N1', 'N5')!), ['steps'])
})

// ── ② 렌더 — 난이도 fieldset 안 live 영역 ───────────────────────────────────────────────────────

const chunk = (i: number): TopicChunk => ({ id: `c${i}`, chunkType: 'ACTION', textJa: `こんにちは${i}`, reading: null, meaningKo: `안녕${i}`, order: i })
const topicOf = (level: JlptLevel): Topic => ({
  id: `t_${level}`,
  title: '카페 주문',
  titleJa: 'カフェで注文',
  level,
  description: null,
  tags: [],
  isSeed: true,
  chunks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(chunk),
  lessonCount: 0,
  lastLessonAt: null,
})
type Goal = { lesson: boolean; words: boolean; wordCount: 10 | null }
const WORDS_OFF: Goal = { lesson: true, words: false, wordCount: null }
const WORDS_ON: Goal = { lesson: true, words: true, wordCount: 10 }

function render(level: JlptLevel | null, topicLevel: JlptLevel, my: JlptLevel | null, goal: Goal = WORDS_OFF): string {
  const draft: Draft = { ...EMPTY_DRAFT, topicId: 't', level }
  const ctx: LevelContext = { my, goal: null, topic: topicLevel }
  const html = renderToStaticMarkup(
    createElement(GoalStep, { topic: topicOf(topicLevel), draft, goal, today: '2026-10-19', levelCtx: ctx, headRef: null, reasonId: 'rs', onChange: () => {} }),
  )
  const at = html.indexOf('<fieldset')
  const end = html.indexOf('</fieldset>', at)
  assert.ok(at >= 0 && end > at, '난이도 fieldset')
  return html.slice(at, end + '</fieldset>'.length)
}

/**
 * live 영역 = 난이도 fieldset 의 마지막 자식(감싸개 div) — 여는 태그부터 **짝이 되는 `</div>`**(중첩 카운트)까지.
 * fieldset 닫기 직전까지 자르면 상자가 감싸개 «안» 인지 «뒤(형제)» 인지 구분하지 못한다(REV-078 F-4) — 감싸개 뒤에는 아무것도 없어야 한다.
 */
function liveRegion(fs: string): string {
  const at = fs.indexOf('<div aria-live="polite">')
  assert.ok(at >= 0, '감싸개 <div aria-live="polite"> 가 있다')
  const tag = /<div\b|<\/div>/g
  tag.lastIndex = at
  let depth = 0
  let end = -1
  for (let m = tag.exec(fs); m; m = tag.exec(fs)) {
    depth += m[0] === '</div>' ? -1 : 1
    if (depth === 0) {
      end = m.index + m[0].length
      break
    }
  }
  assert.ok(end > at, '감싸개의 짝 </div>')
  assert.equal(fs.slice(end, fs.lastIndexOf('</fieldset>')), '', '감싸개가 fieldset 의 마지막 자식 — 감싸개 뒤에 다른 요소(상자 포함)가 없다')
  return fs.slice(at, end)
}
const hasBox = (live: string) => live.includes(INFOBOX)

test('② 렌더: 고른 N2 · 주제 N4 · 내 수준 N4 → live 영역은 div 하나, 안 순서 = 기존 줄 → 상자 글', () => {
  const fs = render('N2', 'N4', 'N4')
  assert.equal(fs.match(/aria-live=/g)?.length, 1, '난이도 fieldset 안 aria-live 는 정확히 1개')
  assert.equal(fs.match(/<div aria-live="polite">/g)?.length, 1, '그 1개가 클래스 없는 div 감싸개')
  assert.ok(!/<p[^>]*aria-live/.test(fs), '기존 줄 p 에는 aria-live 가 없다(감싸개로 올라감)')
  const live = liveRegion(fs)
  assert.equal(text(live), HIGH2 + NOTE)
  assert.ok(live.indexOf(HIGH2) < live.indexOf(NOTE), '기존 줄이 먼저')
  assert.ok(hasBox(live), '상자 = InfoBox')
  assert.match(live, /^<div aria-live="polite"><p class="mt-1 [^"]*">/, '감싸개의 첫 자식 = 기존 줄 p(클래스 그대로)')
  assert.match(live, new RegExp(`<div class="${INFOBOX} [^"]* mt-2">`), '상자 className="mt-2"')
})

test('② 렌더: 상자는 감싸개 «안»(질문 4 a — 기존 줄과 한 live 영역) — 짝 </div> 안에 상자 글, 그 뒤에는 없음', () => {
  const fs = render('N2', 'N4', 'N4')
  const live = liveRegion(fs)
  assert.ok(live.includes(NOTE) && hasBox(live), '상자·글이 감싸개 안')
  assert.ok(!fs.slice(fs.indexOf(live) + live.length).includes(NOTE), '감싸개 뒤에 상자 글이 없다')
})

test('② 렌더: 단어 목표 켬·끔 둘 다 같은 상자(질문 3 b) — 단어 목표와 무관', () => {
  const off = liveRegion(render('N2', 'N4', 'N4', WORDS_OFF))
  const on = liveRegion(render('N2', 'N4', 'N4', WORDS_ON))
  assert.ok(hasBox(off) && hasBox(on))
  assert.equal(on, off, '켬/끔에 따라 live 영역이 달라지지 않는다')
})

test('② 렌더: 내 수준을 몰라도 상자는 보인다(기존 줄은 빈 글) — 기준은 주제, 내 수준 아님', () => {
  const live = liveRegion(render('N2', 'N4', null))
  assert.ok(hasBox(live))
  assert.equal(text(live), NOTE, '기존 줄은 빈 글이고 상자 글만')
  assert.match(live, /^<div aria-live="polite"><p class="mt-1 [^"]*"><\/p>/, '빈 기존 줄도 그려 둔다')
})

test('② 렌더: 1단계 어려움·손 안 댐·쉬운 쪽은 상자 없음, 감싸개는 그대로', () => {
  const cases: [JlptLevel | null, JlptLevel, string][] = [
    ['N3', 'N4', '1단계 어려움'],
    [null, 'N4', '손 안 댐(= 주제 난이도)'],
    ['N5', 'N4', '1단계 쉬움'],
    ['N4', 'N2', '2단계 쉬움(질문 2 a)'],
    ['N5', 'N2', '3단계 쉬움(질문 2 a)'],
  ]
  for (const [sel, topic, why] of cases) {
    for (const goal of [WORDS_OFF, WORDS_ON]) {
      const fs = render(sel, topic, 'N4', goal)
      const live = liveRegion(fs)
      assert.ok(!hasBox(live), `${why}: 상자 없음`)
      assert.ok(!fs.includes(NOTE), `${why}: 상자 글 없음`)
      assert.equal(fs.match(/<div aria-live="polite">/g)?.length, 1, `${why}: 감싸개는 늘 있다`)
    }
  }
})

test('② 렌더: 주제보다 3·4단계 어려워도 같은 상자(글에 단계 수 없음)', () => {
  for (const [sel, topic] of [['N1', 'N4'], ['N1', 'N5'], ['N3', 'N5'], ['N1', 'N3']] as [JlptLevel, JlptLevel][]) {
    const live = liveRegion(render(sel, topic, 'N4'))
    assert.ok(hasBox(live), `${sel}·${topic}`)
    assert.ok(live.includes(NOTE), `${sel}·${topic}`)
  }
})

test('② 렌더: live 영역에 role·aria-atomic·경고색·아이콘이 없다(막지 않는 안내)', () => {
  const live = liveRegion(render('N1', 'N5', 'N5', WORDS_ON))
  assert.ok(hasBox(live))
  for (const bad of ['role=', 'aria-atomic', 'text-bad', 'text-warn', 'bg-warn', '<svg', 'hidden']) assert.ok(!live.includes(bad), bad)
})

// ── ③ 배선(소스) — 위치·속성만 ──────────────────────────────────────────────────────────────────

const dir = join(__dirname, '..')
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
const goalSrc = () => {
  const src = strip(readFileSync(join(dir, 'ChallengeCreateScreen.tsx'), 'utf8'))
  return src.slice(src.indexOf('function GoalStep('), src.indexOf('function ConfirmStep('))
}

test('③ 배선: GoalStep 안 aria-live 1회 · role="status"·aria-atomic·role="note" 없음 · 감싸개가 구분선보다 앞', () => {
  const goal = goalSrc()
  assert.equal(goal.match(/aria-live/g)?.length, 1)
  assert.ok(goal.includes('<div aria-live="polite">'), '클래스 없는 div 감싸개')
  for (const bad of ['role="status"', 'aria-atomic', 'role="note"', 'role="alert"']) assert.ok(!goal.includes(bad), bad)
  const wrap = goal.indexOf('<div aria-live="polite">')
  const box = goal.indexOf('{CREATE.wordsNoteHigh}')
  const divider = goal.indexOf('mt-5 border-t')
  assert.ok(wrap >= 0 && box > wrap && divider > box, `감싸개 ${wrap} < 상자 ${box} < 구분선 ${divider}`)
  const tail = goal.slice(box, goal.indexOf('</fieldset>', box))
  assert.equal(tail.match(/<\/div>/g)?.length, 1, '상자와 </fieldset> 사이 닫는 </div> 는 감싸개 하나 — 상자가 감싸개 안(REV-078 F-4)')
})

test('③ 배선: 조건은 wordsLevelNote(sel, topic.level) 한 번뿐 — 그 줄에 goal. 없음, 넣고 빼기는 조건부 렌더', () => {
  const goal = goalSrc()
  assert.equal(goal.match(/wordsLevelNote\(/g)?.length, 1)
  const line = goal.split('\n').find((l) => l.includes('wordsLevelNote('))!
  assert.match(line, /wordsLevelNote\(sel, topic\.level\)/)
  assert.ok(!/goal\.|wordsBlocked|levelCtx/.test(line), line.trim())
  assert.match(goal, /\{wordsNote \? <InfoBox className="mt-2">\{CREATE\.wordsNoteHigh\}<\/InfoBox> : null\}/)
})

// ── ④ 문구 ──────────────────────────────────────────────────────────────────────────────────────

test('④ 문구: CREATE.wordsNoteHigh 글자 그대로 · 문자열 상수 · 난이도 이름/코드/숫자/「세요」/엔진명 없음', () => {
  assert.equal(typeof CREATE.wordsNoteHigh, 'string')
  assert.equal(CREATE.wordsNoteHigh, NOTE)
  assert.equal([...CREATE.wordsNoteHigh].length, 45)
  assert.ok(!/N[1-5]|\d|초보자|초급|중급|고급|최상급|세요/.test(CREATE.wordsNoteHigh))
  assert.ok(!/claude|anthropic|haiku|sonnet|opus|qwen|whisper|reazon|sherpa|style[-_ ]?bert|sbv2|ollama|gpt|엔진|모델/i.test(CREATE.wordsNoteHigh))
})
