import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { hangulLine, type ReadingSegment } from '@/modules/speech/reading/client'
import {
  AnnotationClient,
  LOADING,
  NONE,
  OFF,
  pickWordHangul,
  wordFallbackText,
  wordHangulState,
  type AnnotateResponse,
  type AnnotationState,
} from '../japanese/annotations'

/**
 * task-071 — 표제어 분석 읽기가 저장 읽기와 어긋나거나 발음을 못 구한 단어는 저장 읽기를 같은 분석기에 한 번 더 넣어 한글 줄을 만든다.
 * 순수 함수(`wordFallbackText`·`pickWordHangul`) + 훅과 같은 순서의 흐름 시뮬레이션(요청 수) + 훅 배선 소스 스캔.
 * 시료는 운영 분석기로 확인한 사례의 모양(温い=ぬるい → 누루이 · 丈夫=じょうぶ → 죠-부 · 七=しち → 발음 없음)을 합성한 것이다.
 */

const seg = (surface: string, ruby: ReadingSegment['ruby'], pron: string | null): ReadingSegment => ({ surface, ruby, pron, boundary: null })
const ready = (segments: ReadingSegment[]): AnnotationState => ({ s: 'ready', segments })

// 정상: 明日/あした — 분석 읽기 = 저장 읽기, 발음 있음
const ASHITA = [seg('明日', [['明日', 'あした']], 'アシタ')]
// 불일치: 温い 저장 ぬるい vs 분석기 ぬくい
const NURUI_FIRST = [seg('温い', [['温', 'ぬく'], ['い', null]], 'ヌクイ')]
// 저장 읽기(히라가나)를 분석기에 넣은 결과 — 루비 없음, 읽기 = 표기
const NURUI_SECOND = [seg('ぬるい', null, 'ヌルイ')]
const JOUBU_FIRST = [seg('丈夫', [['丈夫', 'じょうふ']], 'ジョーフ')]
const JOUBU_SECOND = [seg('じょうぶ', null, 'ジョーブ')]
// 七/しち: 저장 읽기를 넣어도 발음을 못 구한다(실측 288/289 중 남는 1개)
const SHICHI_FIRST = [seg('七', [['七', 'なな']], 'ナナ')]
const SHICHI_SECOND = [seg('しち', null, null)]
// 발음 없음(noPron): 읽기는 맞는데 pron 이 비었다
const NANI_FIRST = [seg('何々', [['何々', 'なになに']], null)]
const NANI_SECOND = [seg('なになに', null, 'ナニナニ')]

const sameWord = (a: AnnotationState, b: AnnotationState) => assert.equal(a, b)

// ── 순수 함수 ① 정상 유지 ─────────────────────────────────────────────────────

test('①정상: 저장 읽기와 같고 발음이 있으면 두 번째 요청 글자 없음 · 첫 분석 그대로(wordHangulState 와 같다)', () => {
  const first = ready(ASHITA)
  assert.equal(wordFallbackText(true, first, 'あした'), '')
  assert.equal(wordFallbackText(true, first, 'アシタ'), '', '가타카나 저장 읽기도 같은 읽기')
  sameWord(pickWordHangul(true, first, 'あした', NONE), first)
  sameWord(pickWordHangul(true, first, 'あした', LOADING), first)
  assert.equal(pickWordHangul(true, first, 'あした', NONE), wordHangulState(true, first, 'あした'))
})

// ── ② 불일치 → 두 번째 대기 중 loading ───────────────────────────────────────

test('②불일치: 두 번째 요청 글자 = 저장 읽기, 도착 전에는 loading(「한글 표기가 없어요」가 번쩍이지 않는다)', () => {
  const first = ready(NURUI_FIRST)
  assert.equal(wordFallbackText(true, first, 'ぬるい'), 'ぬるい')
  sameWord(pickWordHangul(true, first, 'ぬるい', LOADING), LOADING)
  assert.equal(pickWordHangul(true, first, 'ぬるい', LOADING).s, 'loading')
})

// ── ③ 불일치 + 두 번째 일치·발음 있음 → ready(두 번째) ────────────────────────

test('③불일치 + 두 번째가 저장 읽기와 같고 발음이 있으면 ready(두 번째 segments) → 누루이·죠-부', () => {
  const secondNurui = ready(NURUI_SECOND)
  const a = pickWordHangul(true, ready(NURUI_FIRST), 'ぬるい', secondNurui)
  sameWord(a, secondNurui)
  assert.equal(a.s === 'ready' ? hangulLine(a.segments) : null, '누루이')
  const secondJoubu = ready(JOUBU_SECOND)
  const b = pickWordHangul(true, ready(JOUBU_FIRST), 'じょうぶ', secondJoubu)
  sameWord(b, secondJoubu)
  assert.equal(b.s === 'ready' ? hangulLine(b.segments) : null, '죠-부')
  // 기존 규칙으로는 숨겨졌다 — 이번 변경 전 동작(1단계만)과 대조
  assert.equal(wordHangulState(true, ready(NURUI_FIRST), 'ぬるい'), NONE)
})

// ── ④ 두 번째도 불일치 → none ────────────────────────────────────────────────

test('④두 번째도 저장 읽기와 어긋나면 none — 어긋난 발음을 보이는 경로를 만들지 않는다', () => {
  const wrongSecond = ready([seg('ぬるい', [['ぬるい', 'ぬくい']], 'ヌクイ')])
  assert.equal(pickWordHangul(true, ready(NURUI_FIRST), 'ぬるい', wrongSecond), NONE)
})

// ── ⑤ 두 번째 hangulLine null(七 しち) → none ─────────────────────────────────

test('⑤두 번째가 같은 읽기여도 발음을 못 구하면(七=しち) none', () => {
  const first = ready(SHICHI_FIRST)
  assert.equal(wordFallbackText(true, first, 'しち'), 'しち')
  assert.equal(pickWordHangul(true, first, 'しち', ready(SHICHI_SECOND)), NONE)
})

// ── ⑥ 두 번째 실패/none/off → none ───────────────────────────────────────────

test('⑥두 번째 분석이 실패·분석 불가(none)·꺼짐(off)이면 none', () => {
  const first = ready(NURUI_FIRST)
  assert.equal(pickWordHangul(true, first, 'ぬるい', NONE), NONE)
  assert.equal(pickWordHangul(true, first, 'ぬるい', OFF), NONE)
})

// ── ⑦ 첫 분석이 발음 없음 → 두 번째 시도 ─────────────────────────────────────

test('⑦첫 분석이 읽기는 맞는데 발음이 없으면(何々) 두 번째를 시도해 ready 로 구한다', () => {
  const first = ready(NANI_FIRST)
  assert.equal(hangulLine(NANI_FIRST), null)
  assert.equal(wordFallbackText(true, first, 'なになに'), 'なになに')
  sameWord(pickWordHangul(true, first, 'なになに', LOADING), LOADING)
  const second = ready(NANI_SECOND)
  sameWord(pickWordHangul(true, first, 'なになに', second), second)
  assert.equal(pickWordHangul(true, first, 'なになに', NONE), NONE, '두 번째도 안 되면 숨김')
})

// ── ⑧ 저장 읽기 없음 → 기존 동작 ─────────────────────────────────────────────

test('⑧저장 읽기가 없으면(null·빈 값·공백) 대체하지 않고 첫 분석을 그대로 쓴다', () => {
  for (const stored of [null, undefined, '', '   ']) {
    for (const f of [ready(NURUI_FIRST), ready(NANI_FIRST)]) {
      assert.equal(wordFallbackText(true, f, stored), '', `stored=${JSON.stringify(stored)}`)
      sameWord(pickWordHangul(true, f, stored, ready(NURUI_SECOND)), f)
    }
  }
})

// ── ⑨ 한글 끔 → off · 요청 0 ─────────────────────────────────────────────────

test('⑨한글 끔이면 off · 두 번째 요청 글자 없음', () => {
  assert.equal(wordFallbackText(false, ready(NURUI_FIRST), 'ぬるい'), '')
  assert.equal(pickWordHangul(false, ready(NURUI_FIRST), 'ぬるい', ready(NURUI_SECOND)), OFF)
  assert.equal(pickWordHangul(false, ready(ASHITA), 'あした', LOADING), OFF)
})

// ── ⑩ 첫 분석이 loading/none/off → 두 번째 요청 0 ────────────────────────────

test('⑩첫 분석이 loading·none·off 면 두 번째 요청 글자 없음 · 첫 상태 그대로', () => {
  for (const first of [LOADING, NONE, OFF]) {
    assert.equal(wordFallbackText(true, first, 'ぬるい'), '')
    sameWord(pickWordHangul(true, first, 'ぬるい', ready(NURUI_SECOND)), first)
  }
})

test('저장 읽기 글자: 앞뒤 공백만 걷어 보낸다 · 가타카나 저장 읽기는 두 번째가 같은 읽기로 대조된다', () => {
  assert.equal(wordFallbackText(true, ready(NURUI_FIRST), '  ぬるい '), 'ぬるい')
  const second = ready([seg('ヌルイ', null, 'ヌルイ')])
  sameWord(pickWordHangul(true, ready(NURUI_FIRST), 'ヌルイ', second), second)
})

// ── 훅과 같은 순서의 흐름: 요청 수 · 중간 상태 ────────────────────────────────

interface W {
  surface: string
  reading: string | null
}

/** 가짜 분석 API 위의 `AnnotationClient` + 훅(`useWordLayersList`)과 같은 순서의 한 렌더. */
function makeFlow(table: Record<string, ReadingSegment[] | null>) {
  const calls: string[][] = []
  const queue: Array<() => void> = []
  const client = new AnnotationClient({
    post: async (texts): Promise<AnnotateResponse> => {
      calls.push(texts)
      return { available: true, items: texts.map((t) => (table[t] ? { segments: table[t] as ReadingSegment[] } : null)) }
    },
    schedule: (fn) => {
      queue.push(fn)
    },
  })
  /** 렌더: 첫 분석 상태 → 두 번째 글자 → 두 번째 상태 → 결정. 그 뒤 효과로 두 층의 요청이 나간다(렌더 때 본 상태는 요청 전 상태다). */
  const render = (words: W[], on = true): AnnotationState[] => {
    const surfaces = words.map((w) => (on ? w.surface : ''))
    const first = surfaces.map((t) => client.stateOf(t))
    const texts = words.map((w, i) => wordFallbackText(on, first[i], w.reading))
    const second = texts.map((t) => client.stateOf(t))
    const out = words.map((w, i) => pickWordHangul(on, first[i], w.reading, second[i]))
    client.request(surfaces.filter((t) => t))
    client.request(texts.filter((t) => t))
    return out
  }
  /** 예약된 묶음 하나를 보내고 끝날 때까지 기다린다. */
  const run = async () => {
    queue.shift()?.()
    await client.flush()
  }
  return { client, calls, render, run, pendingRuns: () => queue.length }
}

const TABLE: Record<string, ReadingSegment[] | null> = {
  明日: ASHITA,
  温い: NURUI_FIRST,
  ぬるい: NURUI_SECOND,
  七: SHICHI_FIRST,
  しち: SHICHI_SECOND,
  何々: NANI_FIRST,
  なになに: NANI_SECOND,
  丈夫: JOUBU_FIRST,
  じょうぶ: null, // 두 번째 분석 불가
}

const WORDS: W[] = [
  { surface: '明日', reading: 'あした' }, // 정상
  { surface: '温い', reading: 'ぬるい' }, // 불일치 → 구제
  { surface: '七', reading: 'しち' }, // 불일치 → 두 번째도 발음 없음 → 숨김
  { surface: '何々', reading: 'なになに' }, // 발음 없음 → 구제
  { surface: '丈夫', reading: 'じょうぶ' }, // 불일치 → 두 번째 분석 불가 → 숨김
  { surface: '明日', reading: null }, // 저장 읽기 없음 → 첫 분석 그대로
]

test('흐름: 두 번째 요청은 어긋난·발음 없는 단어의 저장 읽기만 — 정상·저장 읽기 없음은 0, 최종 상태가 규칙대로', async () => {
  const f = makeFlow(TABLE)
  assert.deepEqual(f.render(WORDS).map((s) => s.s), Array(6).fill('loading'), '첫 분석 대기 중 전부 loading')
  await f.run() // 1차: 표제어
  f.render(WORDS) // 첫 분석이 도착한 렌더 — 효과로 2차 요청
  await f.run() // 2차: 저장 읽기
  const last = f.render(WORDS)
  assert.deepEqual(last.map((s) => s.s), ['ready', 'ready', 'none', 'ready', 'none', 'ready'])
  assert.equal(last[1].s === 'ready' ? hangulLine(last[1].segments) : null, '누루이')
  assert.equal(last[3].s === 'ready' ? hangulLine(last[3].segments) : null, '나니나니')
  assert.deepEqual(f.calls.map((c) => c.slice().sort()), [['七', '何々', '丈夫', '明日', '温い'].sort(), ['しち', 'じょうぶ', 'なになに', 'ぬるい'].sort()], '1차 = 표제어 5종(중복 제거), 2차 = 어긋난 4개의 저장 읽기만')
  // 안정 상태에서 다시 그려도 새 요청이 없다(루프 없음)
  f.render(WORDS)
  assert.equal(f.pendingRuns(), 0)
  assert.equal(f.calls.length, 2)
})

test('흐름(중간 상태): 첫 분석만 도착한 렌더에서 어긋난 단어는 loading(none 아님), 정상 단어는 ready', async () => {
  const f = makeFlow(TABLE)
  const words = WORDS.slice(0, 3)
  f.render(words)
  await f.run()
  const mid = f.render(words)
  assert.deepEqual(mid.map((s) => s.s), ['ready', 'loading', 'loading'], '정상 = ready, 어긋난 둘 = loading')
  assert.equal(mid[1], LOADING)
  await f.run()
  assert.deepEqual(f.render(words).map((s) => s.s), ['ready', 'ready', 'none'])
})

test('흐름: 한글 끔이면 두 층 모두 요청 0 · 상태 off', async () => {
  const f = makeFlow(TABLE)
  const out = f.render(WORDS, false)
  assert.deepEqual(out.map((s) => s.s), Array(6).fill('off'))
  assert.equal(f.pendingRuns(), 0)
  assert.equal(f.calls.length, 0)
})

test('흐름: 저장 읽기 분석이 이미 캐시에 있으면(다른 화면에서 받음) 추가 요청 없이 곧바로 최종 상태', async () => {
  const f = makeFlow(TABLE)
  f.render([{ surface: 'ぬるい', reading: 'ぬるい' }, { surface: '温い', reading: 'ぬるい' }])
  await f.run()
  const out = f.render([{ surface: '温い', reading: 'ぬるい' }])
  assert.equal(out[0].s, 'ready', '두 번째 글자 ぬるい 는 이미 캐시 — loading 을 거치지 않는다')
  assert.equal(f.pendingRuns(), 0)
  assert.equal(f.calls.length, 1)
})

// ── 훅 배선 소스 스캔(동작 의미 — 공백·주석·줄 번호에 둔감) ─────────────────────

const SRC = readFileSync(join(process.cwd(), 'src/components/common/japanese/annotations.ts'), 'utf8')
const flat = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ')
const hookBody = flat(SRC.slice(SRC.indexOf('export function useWordLayersList('), SRC.indexOf('export function useWordLayers(')))

test('useWordLayersList 배선: useAnnotations 두 번(표제어·저장 읽기 글자) · 한글 상태는 pickWordHangul 로만 · wordHangulState 직접 호출 없음', () => {
  assert.equal((hookBody.match(/useAnnotations\(/g) ?? []).length, 2, '훅 호출 개수는 렌더마다 같게 고정(2)')
  assert.match(hookBody, /const states = useAnnotations\(surfaces\)/)
  assert.match(hookBody, /const fallbacks = useAnnotations\(\s*words\.map\(\(w, i\) => wordFallbackText\(on, states\[i\], w\.reading\)\)\s*\)/)
  assert.match(hookBody, /hangul: pickWordHangul\(on, states\[i\], w\.reading, fallbacks\[i\]\)/)
  assert.ok(!/\bwordHangulState\(/.test(hookBody), '훅은 1단계 함수를 직접 부르지 않는다')
  assert.match(hookBody, /const on = prefs\.loaded && prefs\.showHangul/)
  // 메모 의존성에 두 번째 분석이 들어 있어야 도착했을 때 층이 갱신된다
  assert.match(hookBody, /\[key, prefs\.loaded, prefs\.showFurigana, prefs\.showHangul, states, fallbacks\]/)
  assert.ok(!/\bif \(|\bfor \(|\bwhile \(/.test(hookBody.slice(0, hookBody.indexOf('useMemo'))), '훅 호출은 조건·반복 안에 없다')
})

test('pickWordHangul 본문: 대체 결과는 저장 읽기 대조 + 발음 확인을 모두 통과해야 하고, 새 변환 규칙·엔진명이 없다', () => {
  const body = flat(SRC.slice(SRC.indexOf('function wordHangulUsable('), SRC.indexOf('export interface WordLayers')))
  assert.match(body, /function wordHangulUsable\(segments[^)]*\)[^{]*\{ return readingMatches\(segments, stored\) && hangulLine\(segments\) !== null \}/)
  assert.match(body, /second\.s === 'ready' && wordHangulUsable\(second\.segments, stored\) \? second : NONE/)
  assert.match(body, /if \(second\.s === 'loading'\) return LOADING/)
  assert.ok(!/\bkanaToHangul\b|\bpronLine\b|reazon|whisper|style-bert/i.test(SRC.replace(/\/\*[\s\S]*?\*\//g, '')), '우회 변환·엔진명 없음')
})
