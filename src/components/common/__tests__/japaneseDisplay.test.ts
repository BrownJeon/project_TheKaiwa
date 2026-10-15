import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { ReadingSegment } from '@/modules/speech/reading/client'
import {
  AnnotationClient,
  ANNOTATE_RETRY_AFTER_MS,
  ANNOTATE_RETRY_MAX,
  ANNOTATION_CACHE_MAX,
  canRetryAnnotate,
  changedRanges,
  isReadingSegment,
  listenWake,
  NONE,
  OFF,
  wordHangulState,
  cutRubyByRanges,
  needsAnnotation,
  readingMatches,
  segmentsHiragana,
  spanRange,
  splitForAnnotate,
  type AnnotateResponse,
} from '../japanese/annotations'
import {
  claimWhile,
  clearFreshSuccessToast,
  DISPLAY_COPY,
  DISPLAY_TOAST_MS,
  DisplayPrefsStore,
  SaveFailureClaims,
  userTrFailure,
  watchSaveFailures,
  type DisplayValues,
} from '../japanese/displayPrefs'
import { HANGUL_LINE_SLOT_CLASS, HangulPlaceholder } from '../japanese/JapaneseText'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { fetchUserTranslation, withUserTranslation } from '@/components/chat/messages'
import type { ChatMessageView } from '@/types/chat'

/**
 * task-026 화면 A — 공용 일본어 표시 부품의 순수 로직: 400자 분할 · 범위 자르기 · 단어 읽기 대조 · 묶음/캐시 규칙 · 표시 설정 저장소
 * (낙관 반영·되돌림·연타 마지막 값·옛 localStorage 1회 이관) · 화면 코드의 우회 변환 금지(O-1).
 */

const seg = (surface: string, ruby: ReadingSegment['ruby'] = null, pron: string | null = surface): ReadingSegment => ({ surface, ruby, pron, boundary: null })

// ── 400자 분할 ────────────────────────────────────────────────────────────────

test('splitForAnnotate: 400자 이하는 그대로, 넘으면 마지막 문장 끝 뒤에서 자르고 이으면 원문', () => {
  assert.deepEqual(splitForAnnotate('短い。'), ['短い。'])
  const a = 'あ'.repeat(250) + '。'
  const b = 'い'.repeat(250) + '！'
  const c = 'う'.repeat(30)
  const text = a + b + c
  const parts = splitForAnnotate(text)
  assert.ok(parts)
  assert.equal(parts.join(''), text)
  assert.ok(parts.every((p) => p.length <= 400))
  assert.deepEqual(parts, [a, b + c])
})

test('splitForAnnotate: 400자 안에 끊을 곳이 없으면 null(숨김), 줄바꿈도 끊는 자리', () => {
  assert.equal(splitForAnnotate('あ'.repeat(401)), null)
  const t = 'か'.repeat(399) + '\n' + 'き'.repeat(10)
  assert.deepEqual(splitForAnnotate(t), ['か'.repeat(399) + '\n', 'き'.repeat(10)])
  // 400번째 글자가 끊는 자리면 정확히 400자 조각.
  const u = 'さ'.repeat(399) + '？' + 'し'.repeat(5)
  assert.deepEqual(splitForAnnotate(u), ['さ'.repeat(399) + '？', 'し'.repeat(5)])
})

// ── 범위 자르기 ──────────────────────────────────────────────────────────────

test('cutRubyByRanges: 범위가 한자 묶음 경계와 맞으면 읽기 유지, 가운데를 자르면 그 묶음만 읽기를 뺀다', () => {
  const pieces = [
    { text: '今日', reading: 'きょう' },
    { text: 'は', reading: null },
    { text: '天気', reading: 'てんき' },
    { text: 'です', reading: null },
  ]
  const hl = { start: 3, end: 5, className: 'hl' }
  const runs = cutRubyByRanges(pieces, [hl])
  assert.deepEqual(
    runs.map((r) => [r.range?.className ?? '-', r.pieces.map((p) => `${p.text}${p.reading ? `{${p.reading}}` : ''}`).join('')]),
    [['-', '今日{きょう}は'], ['hl', '天気{てんき}'], ['-', 'です']],
  )
  // 天|気 사이를 자름 → 天気 읽기 없음(두 쪽 모두), 글자·범위 유지
  const cut = cutRubyByRanges(pieces, [{ start: 4, end: 7, className: 'x' }])
  assert.deepEqual(
    cut.map((r) => [r.range?.className ?? '-', r.pieces.map((p) => `${p.text}${p.reading ? `{${p.reading}}` : ''}`).join('')]),
    [['-', '今日{きょう}は天'], ['x', '気です']],
  )
  assert.equal(cut.flatMap((r) => r.pieces.map((p) => p.text)).join(''), '今日は天気です')
})

test('cutRubyByRanges: 범위 없으면 그대로 한 묶음, 코드포인트 기준(이모지)', () => {
  const runs = cutRubyByRanges([{ text: '😀あ', reading: null }, { text: '本', reading: 'ほん' }], [{ start: 1, end: 2, className: 'm', as: 'mark' }])
  assert.deepEqual(runs.map((r) => r.range?.as ?? null), [null, 'mark', null])
  assert.deepEqual(runs.map((r) => r.pieces.map((p) => p.text).join('')), ['😀', 'あ', '本'])
  assert.equal(cutRubyByRanges([{ text: '本', reading: 'ほん' }]).length, 1)
})

test('spanRange·changedRanges: 문장 조각·diff → 코드포인트 범위', () => {
  assert.deepEqual(spanRange(['はい。', 'そうです。'], 1, 'h'), { start: 3, end: 8, className: 'h' })
  assert.equal(spanRange(['a'], 2, 'h'), null)
  assert.deepEqual(
    changedRanges([{ text: '私', changed: false }, { text: 'わ', changed: true }, { text: '学生', changed: false }], 'del'),
    [{ start: 1, end: 2, className: 'del' }],
  )
})

// ── 단어 읽기 대조 ───────────────────────────────────────────────────────────

test('segmentsHiragana·readingMatches: 저장 읽기와 분석 읽기가 다르면(明日=あす vs あした) 한글 숨김', () => {
  const ashita = [seg('明日', [['明日', 'あした']], 'アシタ')]
  assert.equal(segmentsHiragana(ashita), 'あした')
  assert.equal(readingMatches(ashita, 'あした'), true)
  assert.equal(readingMatches(ashita, 'アシタ'), true, '가타카나 저장 읽기도 히라가나로 대조')
  assert.equal(readingMatches(ashita, 'あす'), false)
  assert.equal(readingMatches(ashita, null), true, '저장 읽기가 없으면 대조하지 않는다')
  const okurigana = [seg('面白い', [['面白', 'おもしろ'], ['い', null]], 'オモシロイ')]
  assert.equal(readingMatches(okurigana, 'おもしろい'), true)
  assert.equal(readingMatches([seg('コーヒー', null, 'コーヒー')], 'こーひー'), true)
})

test('needsAnnotation: 두 층 끔·빈 문장·한자 없는데 한글 끔이면 요청하지 않는다', () => {
  assert.equal(needsAnnotation('今日', false, false), false)
  assert.equal(needsAnnotation('  ', true, true), false)
  assert.equal(needsAnnotation('あした', true, false), false)
  assert.equal(needsAnnotation('あした', false, true), true)
  assert.equal(needsAnnotation('今日', true, false), true)
})

// ── 묶음·캐시 ────────────────────────────────────────────────────────────────

function makeClient(handler: (texts: string[]) => Promise<AnnotateResponse>, clock: { t: number } = { t: 0 }) {
  const calls: string[][] = []
  let pending: (() => void) | null = null
  const client = new AnnotationClient({
    post: (texts) => {
      calls.push(texts)
      return handler(texts)
    },
    schedule: (fn) => {
      pending = fn
    },
    now: () => clock.t,
  })
  const flush = async () => {
    const fn = pending
    pending = null
    fn?.()
    await new Promise((r) => setTimeout(r, 0))
  }
  return { client, calls, flush }
}

const okAll = async (texts: string[]): Promise<AnnotateResponse> => ({ items: texts.map((t) => ({ segments: [seg(t)] })), available: true })

test('AnnotationClient: 같은 tick 의 요청을 64개씩 묶고 중복은 한 번만, 결과는 캐시(다시 묻지 않음)', async () => {
  const { client, calls, flush } = makeClient(okAll)
  const texts = Array.from({ length: 70 }, (_, i) => `文${i}`)
  client.request(texts.slice(0, 40))
  client.request([...texts.slice(30, 70), '文0'])
  assert.equal(client.stateOf('文1').s, 'loading')
  await flush()
  assert.deepEqual(calls.map((c) => c.length), [64, 6])
  assert.equal(client.stateOf('文1').s, 'ready')
  client.request(['文1', '文2'])
  assert.equal(calls.length, 2, '캐시 적중은 다시 보내지 않는다')
})

test('AnnotationClient: available:true 의 null 칸은 null 캐시(none), available:false·HTTP 실패는 캐시 안 함 → none, 35초 뒤 다시 요청하면 실패만 다시 묻는다', async () => {
  let mode: 'nullOk' | 'down' | 'http' | 'ok' = 'nullOk'
  const clock = { t: 1_000 }
  const { client, calls, flush } = makeClient(async (texts) => {
    if (mode === 'http') throw new Error('500')
    if (mode === 'ok') return okAll(texts)
    return { items: texts.map(() => null), available: mode === 'nullOk' }
  }, clock)
  client.request(['不可'])
  await flush()
  assert.equal(client.stateOf('不可').s, 'none')
  assert.equal(client.cached('不可'), null)
  mode = 'down'
  client.request(['停止'])
  await flush()
  assert.equal(client.stateOf('停止').s, 'none')
  assert.equal(client.cached('停止'), undefined, 'available:false 는 캐시하지 않는다')
  mode = 'http'
  client.request(['失敗'])
  await flush()
  assert.equal(client.stateOf('失敗').s, 'none')
  mode = 'ok'
  clock.t += ANNOTATE_RETRY_AFTER_MS
  client.request(['停止', '失敗', '不可'])
  await flush()
  assert.deepEqual(calls[calls.length - 1], ['停止', '失敗'], 'null 캐시는 다시 묻지 않고 실패만 다시')
  assert.equal(client.stateOf('停止').s, 'ready')
})

test('AnnotationClient: 400자 넘는 말은 조각으로 보내고 세그먼트를 순서대로 잇는다 · 표기가 원문과 다르면 쓰지 않는다', async () => {
  const { client, calls, flush } = makeClient(async (texts) => ({
    items: texts.map((t) => (t === 'ずれ' ? { segments: [seg('ずれた')] } : { segments: [seg(t)] })),
    available: true,
  }))
  const long = 'あ'.repeat(300) + '。' + 'い'.repeat(150)
  client.request([long, 'ずれ'])
  await flush()
  assert.deepEqual(calls[0].map((t) => t.length), [301, 150, 2])
  const st = client.stateOf(long)
  assert.equal(st.s, 'ready')
  if (st.s === 'ready') assert.equal(st.segments.map((s) => s.surface).join(''), long)
  assert.equal(client.stateOf('ずれ').s, 'none')
  assert.equal(client.stateOf('あ'.repeat(401)).s, 'none', '끊을 곳 없음 = 숨김')
  client.request(['あ'.repeat(401)])
  assert.equal(calls.length, 1, '나눌 수 없는 말은 보내지 않는다')
})

// ── REV-096 #1: 실패 조각 다시 묻기(이벤트 기반·간격·횟수 상한) ─────────────────

/** 가짜 서버 — `fail` 이면 고른 방식으로 실패, 아니면 전부 분석 성공. */
function failingServer(kind: '429' | 'timeout' | 'down') {
  const state = { fail: true }
  const handler = async (texts: string[]): Promise<AnnotateResponse> => {
    if (!state.fail) return okAll(texts)
    if (kind === '429') throw Object.assign(new Error('429'), { status: 429 })
    if (kind === 'timeout') throw new DOMException('요청 시간이 지났어요', 'TimeoutError')
    return { items: texts.map(() => null), available: false }
  }
  return { state, handler }
}

for (const kind of ['429', 'timeout', 'down'] as const) {
  test(`AnnotationClient 재시도(${kind}): 0초·34초 재요청 0 · 35초 정확히 1회 · 성공하면 ready + 실패 기록 삭제`, async () => {
    const srv = failingServer(kind)
    const clock = { t: 5_000 }
    const { client, calls, flush } = makeClient(srv.handler, clock)
    client.request(['昨日'])
    await flush()
    assert.equal(calls.length, 1)
    assert.equal(client.stateOf('昨日').s, 'none')
    assert.deepEqual(client.failure('昨日'), { at: 5_000, n: 1 })
    client.request(['昨日'])
    await flush()
    clock.t += ANNOTATE_RETRY_AFTER_MS - 1_000
    client.request(['昨日'])
    await flush()
    assert.equal(calls.length, 1, '0초·34초에는 다시 묻지 않는다')
    srv.state.fail = false
    clock.t += 1_000
    client.request(['昨日'])
    client.request(['昨日'])
    assert.equal(client.stateOf('昨日').s, 'none', '다시 묻는 동안에도 숨김 유지(막대로 흔들지 않는다)')
    await flush()
    assert.equal(calls.length, 2, '35초 — 정확히 1회')
    assert.equal(client.stateOf('昨日').s, 'ready')
    assert.equal(client.failure('昨日'), undefined)
  })

  test(`AnnotationClient 재시도(${kind}): 최초 포함 3번째 실패 뒤에는 더 묻지 않는다(상한은 문장 단위 전역)`, async () => {
    const srv = failingServer(kind)
    const clock = { t: 0 }
    const { client, calls, flush } = makeClient(srv.handler, clock)
    for (let i = 0; i < 6; i++) {
      client.request(['明後日'])
      await flush()
      clock.t += ANNOTATE_RETRY_AFTER_MS
    }
    assert.equal(calls.length, 1 + ANNOTATE_RETRY_MAX)
    assert.equal(calls.length, 3)
    assert.equal(client.failure('明後日')?.n, 3)
    srv.state.fail = false
    clock.t += 10 * ANNOTATE_RETRY_AFTER_MS
    client.request(['明後日'])
    await flush()
    assert.equal(calls.length, 3, '서버가 돌아와도 이 세션에서는 숨김')
    assert.equal(client.stateOf('明後日').s, 'none')
  })
}

test('canRetryAnnotate: 간격(35초)과 횟수(재시도 2회) 둘 다 만족할 때만', () => {
  assert.equal(canRetryAnnotate({ at: 0, n: 1 }, 34_999), false)
  assert.equal(canRetryAnnotate({ at: 0, n: 1 }, 35_000), true)
  assert.equal(canRetryAnnotate({ at: 0, n: 2 }, 35_000), true)
  assert.equal(canRetryAnnotate({ at: 0, n: 3 }, 1e9), false)
})

test('AnnotationClient 재시도: available:true 의 null 칸은 시간이 지나도 다시 묻지 않는다', async () => {
  const clock = { t: 0 }
  const { client, calls, flush } = makeClient(async (texts) => ({ items: texts.map(() => null), available: true }), clock)
  client.request(['読めない'])
  await flush()
  clock.t += 100 * ANNOTATE_RETRY_AFTER_MS
  client.request(['読めない'])
  await flush()
  assert.equal(calls.length, 1)
  assert.equal(client.failure('読めない'), undefined)
})

test('AnnotationClient 재진입: 같은 문장 100번 요청·flush 중 요청·emit 마다 요청해도 큐 중복 0·emit 루프 0', async () => {
  const clock = { t: 0 }
  let fail = true
  const { client, calls, flush } = makeClient(async (texts) => {
    if (fail) throw new Error('down')
    return okAll(texts)
  }, clock)
  let emits = 0
  // 화면 훅처럼 캐시 버전이 바뀔 때마다 같은 문장을 다시 넘긴다.
  const unsub = client.subscribe(() => {
    emits++
    client.request(['一', '二'])
  })
  for (let i = 0; i < 100; i++) client.request(['一', '二'])
  assert.equal(emits, 1, '처음 넣을 때 한 번')
  await flush()
  assert.deepEqual(calls, [['一', '二']])
  assert.ok(emits <= 3, `emit ${emits}`)
  fail = false
  clock.t += ANNOTATE_RETRY_AFTER_MS
  const before = emits
  for (let i = 0; i < 100; i++) client.request(['一', '二'])
  await flush()
  assert.deepEqual(calls, [['一', '二'], ['一', '二']])
  assert.ok(emits - before <= 3, `emit ${emits - before}`)
  unsub()
})

test('AnnotationClient: 실패 기록은 캐시와 같은 상한 — 넘으면 오래된 것부터 지운다', async () => {
  const { client, flush } = makeClient(async () => {
    throw new Error('down')
  })
  const texts = Array.from({ length: ANNOTATION_CACHE_MAX + 5 }, (_, i) => `失${i}`)
  client.request(texts)
  for (let i = 0; i < 40; i++) await flush()
  assert.equal(client.failure('失0'), undefined, '가장 오래된 것은 지워진다')
  assert.ok(client.failure(`失${ANNOTATION_CACHE_MAX + 4}`))
  const kept = texts.filter((t) => client.failure(t)).length
  assert.equal(kept, ANNOTATION_CACHE_MAX)
})

test('listenWake: 앱 복귀(visible)·online 에서만 깨우고, 해제하면 두 리스너 모두 뗀다', () => {
  const doc = Object.assign(new EventTarget(), { visibilityState: 'hidden' as DocumentVisibilityState })
  const win = new EventTarget()
  let n = 0
  const off = listenWake(doc as unknown as Document, win as unknown as Window, () => n++)
  doc.dispatchEvent(new Event('visibilitychange'))
  assert.equal(n, 0, '숨겨질 때는 아님')
  doc.visibilityState = 'visible'
  doc.dispatchEvent(new Event('visibilitychange'))
  win.dispatchEvent(new Event('online'))
  assert.equal(n, 2)
  off()
  doc.dispatchEvent(new Event('visibilitychange'))
  win.dispatchEvent(new Event('online'))
  assert.equal(n, 2, '해제 뒤 0')
})

test('useAnnotations 정적: asked 집합 없음·타이머 폴링 없음·[want, ver, wake] 로 request·wake 리스너는 cleanup 반환', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/common/japanese/annotations.ts'), 'utf8')
  const hook = src.slice(src.indexOf('export function useAnnotations('), src.indexOf('export function useAnnotation('))
  assert.ok(hook.length > 0)
  assert.ok(!/\basked\b/.test(hook), 'asked 집합 없음')
  assert.ok(!/setInterval|setTimeout|requestAnimationFrame/.test(src.replace(/schedule: \(fn\) => \{\s*setTimeout\(fn, 0\)/, '')), '타이머 폴링 없음(묶음 예약 1곳만)')
  assert.match(hook, /useEffect\(\(\) => listenWake\(document, window, \(\) => setWake\(\(w\) => w \+ 1\)\), \[\]\)/, '리스너 효과는 listenWake 의 해제 함수를 돌려준다')
  assert.match(hook, /annotationClient\.request\(want\)\s*\}, \[want, ver, wake\]\)/)
})

// ── REV-095 M-1: 단어 한글의 읽기 불일치 숨김 배선 ───────────────────────────────

test('wordHangulState: 한글 끔 = off · 분석 읽기 ≠ 저장 읽기 = none · 그 밖 그대로', () => {
  const ready = { s: 'ready' as const, segments: [seg('明日', [['明日', 'あした']])] }
  assert.equal(wordHangulState(false, ready, 'あした'), OFF)
  assert.equal(wordHangulState(true, ready, 'あす'), NONE)
  assert.equal(wordHangulState(true, ready, 'あした'), ready)
  assert.equal(wordHangulState(true, ready, null), ready, '저장 읽기 없으면 대조하지 않는다')
  assert.equal(wordHangulState(true, { s: 'loading' }, 'あす').s, 'loading')
})

test('useWordLayersList 정적: 한글 상태는 pickWordHangul(→ wordHangulState 1단계 + 저장 읽기 2단계)로만 정한다(task-071)', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/common/japanese/annotations.ts'), 'utf8')
  const hook = src.slice(src.indexOf('export function useWordLayersList('), src.indexOf('export function useWordLayers('))
  assert.match(hook, /hangul: pickWordHangul\(on, states\[i\], w\.reading, fallbacks\[i\]\)/)
  assert.match(hook, /const on = prefs\.loaded && prefs\.showHangul/)
  const pick = src.slice(src.indexOf('export function pickWordHangul('), src.indexOf('export interface WordLayers'))
  assert.match(pick, /return wordHangulState\(on, first, stored\)/)
})

// ── 표시 설정 저장소 ─────────────────────────────────────────────────────────

const never = <T>() => new Promise<T>(() => undefined)

function makeStore(
  opts: { server?: Partial<DisplayValues>; legacy?: string | null; getFails?: boolean; getHangs?: boolean; timeoutMs?: number } = {},
) {
  const puts: Array<Partial<DisplayValues>> = []
  const signals: AbortSignal[] = []
  let legacy = opts.legacy ?? null
  let failPut = false
  let hangPut = false
  const gates: Array<() => void> = []
  let gated = false
  const store = new DisplayPrefsStore({
    get: async (signal) => {
      if (signal) signals.push(signal)
      if (opts.getHangs) return never()
      if (opts.getFails) throw new Error('down')
      return { showFurigana: true, showHangul: true, showTranslation: false, ...opts.server }
    },
    put: async (body, signal) => {
      puts.push(body)
      if (signal) signals.push(signal)
      if (hangPut) return never()
      if (gated) await new Promise<void>((r) => gates.push(r))
      if (failPut) throw new Error('offline')
      return body
    },
    readLegacy: () => legacy,
    removeLegacy: () => {
      legacy = null
    },
    timeoutMs: opts.timeoutMs,
  })
  const tick = () => new Promise((r) => setTimeout(r, 0))
  return {
    store,
    puts,
    tick,
    legacy: () => legacy,
    signals,
    setFailPut: (v: boolean) => (failPut = v),
    setHangPut: (v: boolean) => (hangPut = v),
    gate: (v: boolean) => (gated = v),
    release: () => gates.splice(0).forEach((r) => r()),
  }
}

test('DisplayPrefsStore: 로드 전 loaded:false, GET 뒤 서버 값 · GET 실패면 기본값으로 loaded + error', async () => {
  const a = makeStore({ server: { showHangul: false } })
  assert.equal(a.store.getSnapshot().loaded, false)
  await a.store.ensureLoaded()
  assert.deepEqual(
    (({ loaded, showFurigana, showHangul, showTranslation }) => ({ loaded, showFurigana, showHangul, showTranslation }))(a.store.getSnapshot()),
    { loaded: true, showFurigana: true, showHangul: false, showTranslation: false },
  )
  const b = makeStore({ getFails: true })
  await b.store.ensureLoaded()
  assert.equal(b.store.getSnapshot().loaded, true)
  assert.equal(b.store.getSnapshot().error, true)
  assert.equal(b.store.getSnapshot().showFurigana, true)
})

test('DisplayPrefsStore: 낙관 반영 → PUT(바꾼 키 하나) · 실패면 되돌리고 onError · 번역은 trEpoch 증가', async () => {
  const s = makeStore()
  await s.store.ensureLoaded()
  const epoch = s.store.getSnapshot().trEpoch
  s.store.set('showTranslation', true)
  assert.equal(s.store.getSnapshot().showTranslation, true, '바로 반영')
  assert.equal(s.store.getSnapshot().trEpoch, epoch + 1)
  await s.tick()
  assert.deepEqual(s.puts, [{ showTranslation: true }])
  s.setFailPut(true)
  let errors = 0
  s.store.set('showHangul', false, () => errors++)
  assert.equal(s.store.getSnapshot().showHangul, false)
  await s.tick()
  await s.tick()
  assert.equal(s.store.getSnapshot().showHangul, true, '실패 → 되돌림')
  assert.equal(errors, 1)
})

test('DisplayPrefsStore: 연타하면 보내는 중인 요청 뒤에 마지막 값만 보낸다', async () => {
  const s = makeStore()
  await s.store.ensureLoaded()
  s.gate(true)
  s.store.set('showFurigana', false)
  await s.tick()
  s.store.set('showFurigana', true)
  s.store.set('showFurigana', false)
  s.store.set('showFurigana', true)
  s.gate(false)
  s.release()
  await s.tick()
  await s.tick()
  // 첫 PUT(false) 확인 뒤 마지막 값(true)만 한 번 더.
  assert.deepEqual(s.puts, [{ showFurigana: false }, { showFurigana: true }])
  assert.equal(s.store.getSnapshot().showFurigana, true)
})

test('DisplayPrefsStore 이관: 옛 값 off + 서버 켬 → PUT false 후 키 삭제 · 실패면 키 유지 · on/서버 이미 끔은 PUT 없이 삭제', async () => {
  const a = makeStore({ legacy: 'off' })
  await a.store.ensureLoaded()
  await a.tick()
  assert.deepEqual(a.puts, [{ showFurigana: false }])
  assert.equal(a.legacy(), null)
  assert.equal(a.store.getSnapshot().showFurigana, false)

  const b = makeStore({ legacy: 'off' })
  b.setFailPut(true)
  await b.store.ensureLoaded()
  await b.tick()
  assert.equal(b.legacy(), 'off', 'PUT 실패면 다음 로드에 다시')

  const c = makeStore({ legacy: 'on' })
  await c.store.ensureLoaded()
  assert.deepEqual(c.puts, [])
  assert.equal(c.legacy(), null)

  const d = makeStore({ legacy: 'off', server: { showFurigana: false } })
  await d.store.ensureLoaded()
  assert.deepEqual(d.puts, [])
  assert.equal(d.legacy(), null)
})

// ── REV-094 M-2: 시간 상한 ───────────────────────────────────────────────────

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

test('DisplayPrefsStore 시간 상한: GET 이 영영 안 오면 상한 뒤 기본값으로 loaded + error, 요청 신호는 끊긴다', async () => {
  const s = makeStore({ getHangs: true, timeoutMs: 20 })
  const started = Date.now()
  await s.store.ensureLoaded()
  assert.ok(Date.now() - started >= 15, '상한까지는 기다린다')
  const snap = s.store.getSnapshot()
  assert.equal(snap.loaded, true)
  assert.equal(snap.error, true)
  assert.deepEqual([snap.showFurigana, snap.showHangul, snap.showTranslation], [true, true, false])
  assert.equal(s.signals.length, 1)
  assert.equal(s.signals[0].aborted, true, 'fetch 도 끊는다')
})

test('DisplayPrefsStore 시간 상한: PUT 이 멈추면 상한 뒤 되돌림 + onError, 줄이 풀려 다음 토글이 나간다', async () => {
  const s = makeStore({ timeoutMs: 20 })
  await s.store.ensureLoaded()
  s.setHangPut(true)
  let errors = 0
  s.store.set('showHangul', false, () => errors++)
  assert.equal(s.store.getSnapshot().showHangul, false, '낙관 반영')
  await wait(40)
  assert.equal(s.store.getSnapshot().showHangul, true, '시간 초과 = 실패 → 서버 값으로')
  assert.equal(errors, 1)
  s.setHangPut(false)
  s.store.set('showTranslation', true)
  await s.tick()
  assert.deepEqual(s.puts, [{ showHangul: false }, { showTranslation: true }], '멈춘 PUT 뒤에도 줄이 계속 간다')
})

test('AnnotationClient 시간 상한: #24r 이 영영 안 오면 상한 뒤 failed(none), 캐시 안 함 · 35초 뒤 다시 요청되면 다시 묻는다', async () => {
  const signals: AbortSignal[] = []
  let hang = true
  let pending: (() => void) | null = null
  const calls: string[][] = []
  const clock = { t: 0 }
  const client = new AnnotationClient({
    now: () => clock.t,
    post: (texts, signal) => {
      calls.push(texts)
      if (signal) signals.push(signal)
      return hang ? never() : okAll(texts)
    },
    schedule: (fn) => {
      pending = fn
    },
    timeoutMs: 20,
  })
  client.request(['遅い'])
  const run = pending as (() => void) | null
  run?.()
  assert.equal(client.stateOf('遅い').s, 'loading')
  await wait(40)
  assert.equal(client.stateOf('遅い').s, 'none', '막대가 계속 돌지 않는다')
  assert.equal(client.cached('遅い'), undefined)
  assert.equal(signals[0]?.aborted, true)
  hang = false
  client.request(['遅い'])
  assert.equal(pending, run, '쉼 안에서는 다시 묻지 않는다(새 flush 예약 없음)')
  clock.t += ANNOTATE_RETRY_AFTER_MS
  client.request(['遅い'])
  await client.flush()
  assert.equal(calls.length, 2)
  assert.equal(client.stateOf('遅い').s, 'ready')
})

// ── REV-094 L-1·L-4: 전송 중 값 보호 · 이관도 같은 줄 ──────────────────────────

test('DisplayPrefsStore L-1: 보내는 중인 PUT 이 있을 때 reload 의 GET(옛 값)이 낙관 값·확인 값을 덮지 않는다', async () => {
  const server: Partial<DisplayValues> = { showFurigana: true }
  const s = makeStore({ server })
  await s.store.ensureLoaded()
  s.gate(true)
  s.store.set('showFurigana', false)
  await s.tick()
  assert.deepEqual(s.puts, [{ showFurigana: false }], 'PUT 전송 중')
  // 설정 화면 진입 — PUT 이 서버에 닿기 전의 GET(켬)이 먼저 돌아온다.
  await s.store.reload()
  assert.equal(s.store.getSnapshot().showFurigana, false, '화면은 누른 값 그대로')
  s.gate(false)
  s.release()
  await s.tick()
  await s.tick()
  assert.equal(s.store.getSnapshot().showFurigana, false)
  // 확인 값이 옛 GET(켬)으로 덮였다면 아래 켬은 "이미 서버 값"으로 건너뛰어 PUT 이 나가지 않는다.
  s.store.set('showFurigana', true)
  await s.tick()
  assert.deepEqual(s.puts, [{ showFurigana: false }, { showFurigana: true }])
  // 전송 중이 아닌 키는 reload 가 서버 값으로 맞춘다.
  server.showHangul = false
  await s.store.reload()
  assert.equal(s.store.getSnapshot().showHangul, false)
})

test('DisplayPrefsStore L-4: 이관 PUT 도 같은 줄 — 이관 중 사용자가 히라가나를 켜면 이관 뒤에 사용자 값이 나가 서버가 켬으로 끝난다', async () => {
  const s = makeStore({ legacy: 'off' })
  s.gate(true)
  await s.store.ensureLoaded()
  await s.tick()
  assert.deepEqual(s.puts, [{ showFurigana: false }], '이관 PUT 전송 중')
  assert.equal(s.store.getSnapshot().showFurigana, false)
  s.store.set('showFurigana', true)
  assert.equal(s.legacy(), null, '사용자가 직접 정하면 옛 값은 지운다(다음 로드에 다시 이관하지 않음)')
  s.gate(false)
  s.release()
  await s.tick()
  await s.tick()
  assert.deepEqual(s.puts, [{ showFurigana: false }, { showFurigana: true }], '순서 보장')
  assert.equal(s.store.getSnapshot().showFurigana, true)

  // 이관 PUT 실패 → 화면은 서버 값(켬)으로, 키는 남겨 다음 로드에 다시.
  const f = makeStore({ legacy: 'off' })
  f.setFailPut(true)
  await f.store.ensureLoaded()
  await f.tick()
  await f.tick()
  assert.equal(f.legacy(), 'off')
  assert.equal(f.store.getSnapshot().showFurigana, true)
})

// ── REV-096 #2: 저장 실패 알림(failEpoch → 앱 셸 한 곳) ────────────────────────

test('failEpoch: PUT 실패 +1(되돌림) · 시간 초과 +1 · 성공 0 · 서로 다른 키 2개 실패 +2', async () => {
  const s = makeStore({ timeoutMs: 20 })
  await s.store.ensureLoaded()
  const e0 = s.store.getSnapshot().failEpoch
  assert.equal(e0, 0)
  s.store.set('showTranslation', true)
  await s.tick()
  assert.equal(s.store.getSnapshot().failEpoch, 0, '성공은 그대로')
  s.setFailPut(true)
  s.store.set('showHangul', false)
  await s.tick()
  await s.tick()
  assert.equal(s.store.getSnapshot().showHangul, true, '되돌림')
  assert.equal(s.store.getSnapshot().failEpoch, 1)
  s.setFailPut(false)
  s.setHangPut(true)
  s.store.set('showFurigana', false)
  await wait(40)
  assert.equal(s.store.getSnapshot().showFurigana, true)
  assert.equal(s.store.getSnapshot().failEpoch, 2, '시간 초과도 +1')
  s.setHangPut(false)
  s.setFailPut(true)
  s.store.set('showHangul', false)
  s.store.set('showTranslation', false)
  await s.tick()
  await s.tick()
  await s.tick()
  assert.equal(s.store.getSnapshot().failEpoch, 4, '서로 다른 키 2개 → +2')
})

test('failEpoch: 같은 키 연타 중 앞 PUT 실패를 뒤 값이 이어받으면 올리지 않는다', async () => {
  const puts: Array<Partial<DisplayValues>> = []
  let releaseFirst: (() => void) | null = null
  const store = new DisplayPrefsStore({
    get: async () => ({ showFurigana: true, showHangul: true, showTranslation: false }),
    put: async (body) => {
      puts.push(body)
      if (puts.length === 1) {
        await new Promise<void>((r) => (releaseFirst = r))
        throw new Error('offline')
      }
      return body
    },
    readLegacy: () => null,
    removeLegacy: () => undefined,
  })
  const tick = () => new Promise((r) => setTimeout(r, 0))
  await store.ensureLoaded()
  store.set('showHangul', false)
  await tick()
  store.set('showHangul', true)
  store.set('showHangul', false)
  ;(releaseFirst as (() => void) | null)?.()
  await tick()
  await tick()
  assert.equal(store.getSnapshot().showHangul, false)
  assert.equal(store.getSnapshot().failEpoch, 0)
  assert.deepEqual(puts, [{ showHangul: false }, { showHangul: false }])
})

test('failEpoch: 옛 값 이관 PUT 실패는 올리지 않는다(사용자가 누른 것이 아님)', async () => {
  const b = makeStore({ legacy: 'off' })
  b.setFailPut(true)
  await b.store.ensureLoaded()
  await b.tick()
  await b.tick()
  assert.deepEqual(b.puts, [{ showFurigana: false }])
  assert.equal(b.store.getSnapshot().showFurigana, true, '화면은 서버 값')
  assert.equal(b.store.getSnapshot().failEpoch, 0)
})

test('watchSaveFailures: 구독 이후 오른 만큼만 알린다(지난 실패로 알리지 않음) · 해제 뒤 0', async () => {
  const s = makeStore()
  await s.store.ensureLoaded()
  s.setFailPut(true)
  s.store.set('showHangul', false)
  await s.tick()
  await s.tick()
  assert.equal(s.store.getSnapshot().failEpoch, 1)
  let n = 0
  const off = watchSaveFailures(s.store, () => n++)
  assert.equal(n, 0, '마운트 때 토스트 금지')
  s.store.set('showTranslation', true)
  await s.tick()
  await s.tick()
  assert.equal(n, 1)
  s.setFailPut(false)
  s.store.set('showFurigana', false)
  await s.tick()
  assert.equal(n, 1, '성공·다른 emit 은 알리지 않는다')
  off()
  s.setFailPut(true)
  s.store.set('showFurigana', true)
  await s.tick()
  await s.tick()
  assert.equal(n, 1)
})

test('저장 실패 알림 정적: 앱 셸이 DisplaySaveNotice 를 그리고, 화면 코드는 prefs.set 에 실패 콜백을 넘기지 않는다', () => {
  const root = join(process.cwd(), 'src')
  const layout = readFileSync(join(root, 'app/(app)/layout.tsx'), 'utf8')
  assert.match(layout, /import DisplaySaveNotice from '@\/components\/shell\/DisplaySaveNotice'/)
  assert.match(layout, /<DisplaySaveNotice \/>/)
  const notice = readFileSync(join(root, 'components/shell/DisplaySaveNotice.tsx'), 'utf8')
  assert.match(notice, /useDisplaySaveFailure\(\(\) => saveFailureClaims\.route\(\(\) => toast\.show\(DISPLAY_COPY\.saveFailed, DISPLAY_TOAST_MS\)\)\)/)
  const files: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) {
        if (name !== '__tests__') walk(p)
      } else if (/\.(ts|tsx)$/.test(name)) files.push(p)
    }
  }
  walk(join(root, 'components'))
  const calls: string[] = []
  for (const f of files) {
    const src = readFileSync(f, 'utf8')
    for (const m of src.matchAll(/prefs\.set\(([^)]*)\)/g)) calls.push(`${f}: ${m[1]}`)
    // 실패 알림 문구는 셸과(회화방이 맡는 동안) 회화방만 안다.
    if (!/(DisplaySaveNotice|TalkRoom)\.tsx$/.test(f)) assert.ok(!/DISPLAY_COPY\.saveFailed/.test(src), `${f}: 실패 토스트는 셸·회화방만`)
  }
  assert.ok(calls.length >= 2, calls.join('\n'))
  for (const c of calls) assert.equal(c.split(':').pop()!.split(',').length, 2, `3번째 인자 없음 — ${c}`)
})

// ── task-030 2단계 ────────────────────────────────────────────────────────────

/** Tailwind 정수 클래스 → px (`h-11`=44 · `h-8`=32). */
const twPx = (cls: string, prefix: string): number => {
  const m = new RegExp(`(?:^|\\s)${prefix}-(\\d+(?:\\.\\d+)?)(?:\\s|$)`).exec(cls)
  assert.ok(m, `${prefix}-N 없음`)
  return Number(m[1]) * 4
}

test('QA-L2: 표시 바 토글의 유효 터치 높이 ≥ 44px — 바 아래 선은 border 가 아니라 안쪽 그림자, 터치 확장은 바 안에서 44 로 잘린다', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/common/japanese/JapaneseText.tsx'), 'utf8')
  const bar = /<div\s+role="group"[^>]*?className="([^"]+)"/.exec(src)?.[1]
  assert.ok(bar, 'DisplayBar className')
  const toggle = /className=\{`(relative h-8[^`]*?)\$\{/.exec(src)?.[1]
  assert.ok(toggle, 'DisplayToggles className')
  assert.ok(!/(^|\s)border-b(\s|$)/.test(bar), 'border-b 가 있으면 안쪽 높이가 43px')
  assert.match(bar, /shadow-\[inset_0_-1px_0_var\(--color-line\)\]/, '같은 색·같은 자리의 안쪽 1px 선')
  assert.match(bar, /overflow-x-auto/)
  const inner = twPx(bar, 'h') - 0 // border 없음 → 안쪽 = 바 높이
  const pill = twPx(toggle, 'h')
  const ext = Number(/before:-inset-y-\[(\d+)px\]/.exec(toggle)?.[1])
  assert.equal(inner, 44)
  assert.equal(pill, 32)
  const effective = Math.min(inner, pill + 2 * ext) // 가로 스크롤 상자가 위아래로 넘친 영역을 자른다
  assert.ok(effective >= 44, `유효 터치 높이 ${effective}`)
  assert.ok(pill + 2 * ext >= 44)
})

test('QA-L3: 내 말풍선 대기 자리 = 한글 줄과 같은 높이(위 2 + 19.5), 막대 아래 여백 0 — 기본 막대와 다른 말풍선은 그대로', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/common/japanese/JapaneseText.tsx'), 'utf8')
  // 실제 한글 줄: mt-0.5(2px) + 13px × leading 1.5.
  const lineH = 13 * Number(/leading-\[(\d+(?:\.\d+)?)\]/.exec(src.slice(src.indexOf('export function HangulLine')))?.[1])
  const slotH = Number(/h-\[(\d+(?:\.\d+)?)px\]/.exec(HANGUL_LINE_SLOT_CLASS)?.[1])
  assert.equal(lineH, 19.5)
  assert.equal(slotH, lineH)
  assert.match(HANGUL_LINE_SLOT_CLASS, /(^|\s)mt-0\.5(\s|$)/, '위 2px = 한글 줄과 같다')
  const slot = renderToStaticMarkup(createElement(HangulPlaceholder, { onTint: true, asLine: true }))
  assert.match(slot, /h-\[19\.5px\]/)
  assert.match(slot, /items-center/)
  assert.match(slot, /bg-surface"|bg-surface /, '내 말 말풍선 막대 색')
  assert.ok(!/mb-1|mt-1\.5/.test(slot), '막대 위아래 여백 0')
  assert.match(slot, /w-\[62%\]/)
  // 기본(선생님 말풍선·교정·수업 줄)은 지금 막대 그대로.
  const dflt = renderToStaticMarkup(createElement(HangulPlaceholder, {}))
  assert.match(dflt, /mb-1 mt-1\.5/)
  assert.ok(!/19\.5/.test(dflt))
  // 내 말풍선만 넘긴다.
  const bubble = readFileSync(join(process.cwd(), 'src/components/chat/MessageBubble.tsx'), 'utf8')
  assert.equal(bubble.match(/waitAsLine/g)?.length, 1)
  assert.match(bubble, /<HangulLine state=\{ann\} onTint waitAsLine \/>/)
  const hl = /<HangulLine[^>]*waitAsLine/g
  for (const f of ['talk/TalkCorrectionCard.tsx', 'chat/CorrectionCard.tsx', 'chat/ProposalCard.tsx']) {
    assert.ok(!hl.test(readFileSync(join(process.cwd(), 'src/components', f), 'utf8')), f)
  }
})

test('REV-097 L-1: 저장 실패 때 방금 띄운 성공 토스트를 빈 문구·0ms 로 지운다 — 오래된 것·맡은 화면이 있으면 지우지 않는다', () => {
  const calls: Array<[string, number | undefined]> = []
  const onToast = (m: string, ms?: number) => calls.push([m, ms])
  const none = new SaveFailureClaims()
  clearFreshSuccessToast(1000, 1000 + DISPLAY_TOAST_MS - 1, onToast, none)
  assert.deepEqual(calls, [['', 0]], '토스트 시간 안 = 지운다')
  clearFreshSuccessToast(1000, 1000 + DISPLAY_TOAST_MS, onToast, none)
  assert.equal(calls.length, 1, '이미 사라질 때가 지났으면 부르지 않는다')
  const claimed = new SaveFailureClaims()
  claimed.claim(() => {})
  clearFreshSuccessToast(1000, 1001, onToast, claimed)
  assert.equal(calls.length, 1, '방이 맡은 동안은 지우지 않는다(실패 문구가 같은 칸을 덮는다)')
  const src = readFileSync(join(process.cwd(), 'src/components/common/japanese/JapaneseText.tsx'), 'utf8')
  assert.match(src, /useDisplaySaveFailure\(\(\) => clearFreshSuccessToast\(shownAt\.current, Date\.now\(\), onToast\)\)/)
})

test('REV-097 L-2: 회화방이 맡은 동안 실패 알림은 방 한 곳 · 해제 뒤 늦은 실패는 셸 · 한 번에 하나 · 방은 자기 notify 규칙을 쓴다', async () => {
  const s = makeStore()
  await s.store.ensureLoaded()
  const claims = new SaveFailureClaims()
  const log: string[] = []
  const off = watchSaveFailures(s.store, () => claims.route(() => log.push('shell')))
  const fail = async (key: 'showHangul' | 'showTranslation' | 'showFurigana', v: boolean) => {
    s.setFailPut(true)
    s.store.set(key, v)
    await s.tick()
    await s.tick()
  }
  await fail('showHangul', false)
  assert.deepEqual(log, ['shell'], '맡은 화면이 없으면 셸')
  const release = claims.claim(() => log.push('room'))
  await fail('showTranslation', true)
  assert.deepEqual(log, ['shell', 'room'], '맡은 동안은 방 한 곳(셸 0)')
  const release2 = claims.claim(() => log.push('room2'))
  release() // 먼저 맡았던 쪽의 해제는 지금 맡은 쪽을 풀지 않는다
  await fail('showFurigana', false)
  assert.deepEqual(log, ['shell', 'room', 'room2'])
  release2()
  await fail('showHangul', false)
  assert.deepEqual(log, ['shell', 'room', 'room2', 'shell'], '방을 떠난 뒤 늦게 온 실패는 셸이 띄운다')
  off()
  // 배선(정적): 방이 notify 로 맡고, 셸은 route 로만 띄운다. 자리·미룸은 방의 기존 값·규칙 그대로.
  const root = join(process.cwd(), 'src/components')
  const room = readFileSync(join(root, 'talk/TalkRoom.tsx'), 'utf8')
  assert.match(room, /useClaimDisplaySaveFailure\(\s*\(\) => \{\s*if \(recordingRef\.current\) saveFailDeferredRef\.current = true\s*else showToast\(DISPLAY_COPY\.saveFailed, DISPLAY_TOAST_MS\)\s*\},\s*load === 'ready' && !!chat,/)
  assert.match(room, /const VOICE_TOAST_BOTTOM = 136/)
  assert.match(room, /const TEXT_TOAST_BOTTOM = 84/)
  assert.match(room, /if \(recordingRef\.current\) deferredToastRef\.current = \{ msg, ms \}/)
  assert.match(room, /bottomPx=\{mode === 'voice' \? VOICE_TOAST_BOTTOM : TEXT_TOAST_BOTTOM\}/)
  const notice = readFileSync(join(root, 'shell/DisplaySaveNotice.tsx'), 'utf8')
  assert.match(notice, /saveFailureClaims\.route\(\(\) => toast\.show\(DISPLAY_COPY\.saveFailed, DISPLAY_TOAST_MS\)\)/)
  assert.ok(!/bottomPx/.test(notice), '셸은 기본 자리(84)')
})

test('REV-099 M-1·L-2: 맡기는 방 본 화면(enabled)일 때만 · enabled 가 꺼지거나 언마운트하면 해제 → 셸', () => {
  const claims = new SaveFailureClaims()
  const log: string[] = []
  const fire = () => claims.route(() => log.push('shell'))
  // effect 수명 흉내: 훅은 `useLayoutEffect(() => claimWhile(enabled, fn, …), [enabled])` — 반환값이 곧 cleanup.
  let cleanup: (() => void) | undefined
  const run = (enabled: boolean) => {
    cleanup?.()
    cleanup = claimWhile(enabled, () => log.push('room'), claims)
  }
  run(false) // 로드 중·오류·없음 화면
  fire()
  assert.deepEqual(log, ['shell'], 'enabled false 동안은 셸')
  run(true) // 방 본 화면
  fire()
  assert.deepEqual(log, ['shell', 'room'], 'enabled true 면 방')
  run(false) // 다시 오류·재시도 화면
  fire()
  assert.deepEqual(log, ['shell', 'room', 'shell'], 'enabled 가 꺼지면 해제 → 셸')
  run(true)
  cleanup?.() // 언마운트
  fire()
  assert.deepEqual(log, ['shell', 'room', 'shell', 'shell'], '언마운트하면 해제 → 셸')
  // 배선(정적): 방은 본 화면 조건을 넘기고, 훅은 enabled 로 다시 맡으며 해제 함수를 effect 로 그대로 돌려준다.
  const room = readFileSync(join(process.cwd(), 'src/components/talk/TalkRoom.tsx'), 'utf8')
  assert.match(room, /load === 'ready' && !!chat,/)
  const prefs = readFileSync(join(process.cwd(), 'src/components/common/japanese/displayPrefs.ts'), 'utf8')
  assert.match(
    prefs,
    /useLayoutEffect\(\s*\(\) => claimWhile\(enabled, \(\) => ref\.current\(\), saveFailureClaims, \(\) => leftRef\.current\?\.\(\) \?\? false, \(\) => deferRef\.current\?\.\(\) \?\? false\),\s*\[enabled\],?\s*\)/,
  )
  assert.match(prefs, /return enabled \? claims\.claim\(fn, takeLeftover, deferring\) : undefined/)
})

test('REV-100 T1: 맡기·해제는 layout effect(커밋 안 동기) — passive effect 로 맡지 않는다', () => {
  const prefs = readFileSync(join(process.cwd(), 'src/components/common/japanese/displayPrefs.ts'), 'utf8')
  assert.match(prefs, /useLayoutEffect\(\s*\(\) => claimWhile\(enabled, /)
  assert.ok(!/useEffect\(\s*\(\) => claimWhile\(/.test(prefs), 'useEffect 로 맡으면 커밋~cleanup 사이 실패가 죽은 방으로 간다')
  assert.match(prefs, /import \{ useEffect, useLayoutEffect, useRef, useSyncExternalStore \} from 'react'/)
})

test('REV-100 T2a: 해제 때 남은 알림이 있으면(takeLeftover true) 셸 정확히 1회 · 없으면 0회', () => {
  const claims = new SaveFailureClaims()
  const sink: string[] = []
  claims.setShell(() => sink.push('shell'))
  claims.claim(() => {}, () => true)()
  assert.deepEqual(sink, ['shell'])
  claims.claim(() => {}, () => false)()
  claims.claim(() => {})() // takeLeftover 없음
  assert.deepEqual(sink, ['shell'], '남은 것이 없으면 이관 0')
})

test('REV-100 T2b: 이미 새 claim 에 밀린(stale) 토큰의 해제는 이관하지 않는다(이중 알림 금지)', () => {
  const claims = new SaveFailureClaims()
  const sink: string[] = []
  claims.setShell(() => sink.push('shell'))
  const old = claims.claim(() => {}, () => true)
  const fresh = claims.claim(() => {}, () => false)
  old()
  assert.deepEqual(sink, [], '밀린 토큰 해제 = 0')
  assert.ok(claims.isClaimed(), '새 claim 은 그대로')
  fresh()
  assert.deepEqual(sink, [])
})

test('REV-100 T2c: takeLeftover 가 읽고 비우므로 같은 해제를 두 번 불러도 1회', () => {
  const claims = new SaveFailureClaims()
  const sink: string[] = []
  claims.setShell(() => sink.push('shell'))
  let left = true
  const release = claims.claim(() => {}, () => {
    const v = left
    left = false
    return v
  })
  release()
  release()
  claims.claim(() => {}, () => {
    const v = left
    left = false
    return v
  })()
  assert.deepEqual(sink, ['shell'])
})

test('REV-100 T2d: 셸 미등록에서도 throw 0 · setShell 해제 함수를 부른 뒤엔 이관 0 · 다른 셸이 등록돼 있으면 옛 해제는 건드리지 않는다', () => {
  const claims = new SaveFailureClaims()
  assert.doesNotThrow(() => claims.claim(() => {}, () => true)())
  const sink: string[] = []
  const off = claims.setShell(() => sink.push('a'))
  off()
  claims.claim(() => {}, () => true)()
  assert.equal(sink.length, 0, '셸 해제 뒤 이관 0')
  const offA = claims.setShell(() => sink.push('a'))
  claims.setShell(() => sink.push('b'))
  offA() // 밀린 셸의 해제는 지금 셸을 풀지 않는다
  claims.claim(() => {}, () => true)()
  assert.deepEqual(sink, ['b'])
})

test('REV-100 T2e: 녹음 중 모사 — 알림은 미루고 놓은 뒤 1회 · 다른 안내가 덮어쓰지 않음 · 방 해제 때 남았으면 셸 1회, 이미 냈으면 0', () => {
  // TalkRoom 의 배선을 그대로 옮긴 모델: recording·saveFailDeferred(저장 실패 전용)·deferredToast(일반 안내, 한 칸).
  const makeRoom = () => {
    const claims = new SaveFailureClaims()
    const log: string[] = []
    const shell = () => log.push('shell')
    claims.setShell(shell)
    const st = { recording: false, saveFailDeferred: false, deferredToast: null as string | null }
    const showToast = (m: string) => log.push(m)
    const notify = (m: string) => {
      if (st.recording) st.deferredToast = m
      else showToast(m)
    }
    const release = claims.claim(
      () => {
        if (st.recording) st.saveFailDeferred = true
        else showToast('saveFailed')
      },
      () => {
        const v = st.saveFailDeferred
        st.saveFailDeferred = false
        return v
      },
    )
    const endRecording = () => {
      st.recording = false
      if (st.deferredToast) {
        const d = st.deferredToast
        st.deferredToast = null
        showToast(d)
      }
      if (st.saveFailDeferred) {
        st.saveFailDeferred = false
        showToast('saveFailed')
      }
    }
    return { claims, log, st, notify, release, endRecording }
  }
  const a = makeRoom()
  a.st.recording = true
  a.claims.route(shellFallback(a.log))
  a.claims.route(shellFallback(a.log)) // 녹음 중 두 번 실패해도
  assert.deepEqual(a.log, [], '녹음 중엔 셸·방 모두 0(화면·스크린리더 미룸)')
  a.notify('mode') // 덮어쓰기 시도
  a.endRecording()
  assert.deepEqual(a.log, ['mode', 'saveFailed'], '놓은 뒤 저장 실패 1회(마지막 칸에 남음)')
  const b = makeRoom()
  b.st.recording = true
  b.claims.route(shellFallback(b.log))
  b.release() // 녹음 중 방 이탈(언마운트)
  assert.deepEqual(b.log, ['shell'], '미룬 채 해제 → 셸 1회')
  b.release()
  assert.deepEqual(b.log, ['shell'], '다시 해제해도 중복 0')
  const c = makeRoom()
  c.st.recording = true
  c.claims.route(shellFallback(c.log))
  c.endRecording()
  c.release()
  assert.deepEqual(c.log, ['saveFailed'], '이미 낸 뒤 해제 → 셸 0')
})

function shellFallback(log: string[]): () => void {
  return () => log.push('SHELL-FALLBACK')
}

test('REV-100 T2f: 배선(정적) — TalkRoom 은 저장 실패 전용 ref·takeLeftover 를 넘기고 일반 deferredToastRef 를 안 쓴다 · 셸은 setShell 등록 · 문구·자리·시간 불변', () => {
  const root = join(process.cwd(), 'src/components')
  const room = readFileSync(join(root, 'talk/TalkRoom.tsx'), 'utf8')
  assert.match(room, /const saveFailDeferredRef = useRef\(false\)/)
  const hook = room.slice(room.indexOf('useClaimDisplaySaveFailure('), room.indexOf("load === 'ready' && !!chat,"))
  assert.ok(!/deferredToastRef|notify\(/.test(hook), '맡은 콜백은 notify·deferredToastRef 를 거치지 않는다')
  assert.match(room, /const left = saveFailDeferredRef\.current\s*saveFailDeferredRef\.current = false\s*return left/)
  assert.match(room, /if \(!recording && saveFailDeferredRef\.current\) \{\s*saveFailDeferredRef\.current = false\s*showToast\(DISPLAY_COPY\.saveFailed, DISPLAY_TOAST_MS\)/)
  assert.match(room, /const VOICE_TOAST_BOTTOM = 136/)
  assert.match(room, /const TEXT_TOAST_BOTTOM = 84/)
  const notice = readFileSync(join(root, 'shell/DisplaySaveNotice.tsx'), 'utf8')
  assert.match(notice, /saveFailureClaims\.setShell\(\(\) => show\(DISPLAY_COPY\.saveFailed, DISPLAY_TOAST_MS\)\)/)
  assert.match(notice, /saveFailureClaims\.route\(\(\) => toast\.show\(DISPLAY_COPY\.saveFailed, DISPLAY_TOAST_MS\)\)/)
  assert.equal(DISPLAY_TOAST_MS, 2200)
})

test('REV-097 L-3: 겹쳐 부른 flush 도 한 번에 하나만 보낸다 — 서버 동시 상한 429 가 같은 조각의 실패 횟수를 중복으로 올리지 않는다', async () => {
  let inflight = 0
  let maxInflight = 0
  const calls: string[][] = []
  const clock = { t: 0 }
  const client = new AnnotationClient({
    post: async (texts) => {
      calls.push(texts)
      inflight++
      maxInflight = Math.max(maxInflight, inflight)
      await new Promise((r) => setTimeout(r, 5))
      inflight--
      // 서버 사용자별 동시 상한(2건)을 흉내 — 한 번에 둘을 넘게 받으면 429. 우리는 하나씩만 보내야 한다.
      if (maxInflight > 1) throw new Error('429')
      return okAll(texts)
    },
    schedule: () => {},
    now: () => clock.t,
  })
  client.request(['一'])
  const f1 = client.flush()
  client.request(['二']) // 첫 flush 가 도는 중 새 조각 + 새 flush(앱 복귀·새 말 도착)
  const f2 = client.flush()
  client.request(['三'])
  const f3 = client.flush()
  await Promise.all([f1, f2, f3])
  assert.equal(maxInflight, 1, '동시에 둘 이상 보내지 않는다')
  assert.deepEqual(calls.flat().sort(), ['一', '三', '二'].sort(), '쌓인 조각은 빠짐없이 한 번씩')
  for (const t of ['一', '二', '三']) {
    assert.equal(client.failure(t), undefined, `${t} 실패 기록 없음`)
    assert.deepEqual(client.cached(t), [seg(t)])
  }
  // 요청 1회 실패는 그 조각의 실패 횟수를 정확히 1 올린다.
  const bad = new AnnotationClient({ post: async () => { throw new Error('429') }, schedule: () => {}, now: () => 0 })
  bad.request(['失'])
  await Promise.all([bad.flush(), bad.flush(), bad.flush()])
  assert.equal(bad.failure('失')?.n, 1)
})

// ── task-031: 녹음 중 저장 실패 → 성공 안내 즉시 지움 · 이상 응답 → 숨김 ─────────────────

test('task-031 (030 QA-#1): 회화방 녹음 중 저장 실패 — 방금 띄운 성공 안내는 실패 확정 때 바로 지우고, 실패 알림은 손 뗀 뒤 1번', async () => {
  // 실제 저장소(PUT 실패)·맡기·clearFreshSuccessToast + TalkRoom notify/맡기 배선을 그대로 옮긴 방 모델.
  const s = makeStore()
  await s.store.ensureLoaded()
  const claims = new SaveFailureClaims()
  const shell: string[] = []
  claims.setShell(() => shell.push('shell'))
  const st = { recording: false, saveFailDeferred: false, deferred: null as { msg: string; ms?: number } | null, shown: null as string | null }
  const log: string[] = []
  const showToast = (m: string, ms?: number) => {
    st.shown = m || null
    log.push(m === '' ? `clear:${ms}` : m)
  }
  const notify = (msg: string, ms?: number) => {
    if (!msg && st.recording) {
      if (st.deferred) st.deferred = null
      else showToast('', 0)
      return
    }
    if (st.recording) st.deferred = { msg, ms }
    else showToast(msg, ms)
  }
  const release = claims.claim(
    () => {
      if (st.recording) st.saveFailDeferred = true
      else showToast('saveFailed', DISPLAY_TOAST_MS)
    },
    () => {
      const v = st.saveFailDeferred
      st.saveFailDeferred = false
      return v
    },
    () => st.recording,
  )
  const endRecording = () => {
    st.recording = false
    if (st.deferred) {
      const d = st.deferred
      st.deferred = null
      showToast(d.msg, d.ms)
    }
    if (st.saveFailDeferred) {
      st.saveFailDeferred = false
      showToast('saveFailed', DISPLAY_TOAST_MS)
    }
  }
  // 표시 바(DisplayToggles) — 성공 안내 + 시각 기록, 실패 때 clearFreshSuccessToast(셸 route 와 함께 같은 failEpoch 를 듣는다).
  let shownAt = 0
  let clock = 10_000
  const offClear = watchSaveFailures(s.store, () => clearFreshSuccessToast(shownAt, clock, notify, claims))
  const offShell = watchSaveFailures(s.store, () => claims.route(() => shell.push('shell-route')))
  const tap = (key: 'showHangul' | 'showFurigana', v: boolean) => {
    s.store.set(key, v)
    notify('success', DISPLAY_TOAST_MS)
    shownAt = clock
  }

  // ① QA-#1 재현: 녹음 전 스위치(성공 안내 즉시) → 바로 녹음 → 1.2초 뒤 PUT 실패.
  s.gate(true)
  s.setFailPut(true)
  tap('showHangul', false)
  assert.equal(st.shown, 'success')
  st.recording = true
  clock += 1200
  s.release()
  await s.tick()
  await s.tick()
  assert.equal(s.store.getSnapshot().showHangul, true, '값은 서버 값으로 되돌아간다')
  assert.equal(st.shown, null, '성공 안내는 실패 확정 순간 지워진다(예전: ~1.4초 잔류)')
  assert.deepEqual(log, ['success', 'clear:0'])
  assert.equal(st.saveFailDeferred, true, '실패 알림은 녹음 중 미룬다')
  endRecording()
  assert.deepEqual(log, ['success', 'clear:0', 'saveFailed'], '손 뗀 뒤 실패 알림 정확히 1번')
  assert.deepEqual(shell, [], '셸 알림 0(방이 맡음)')

  // ② 녹음 중 스위치(성공 안내도 미뤄짐) → 실패: 미뤄 둔 성공 안내를 버리고, 놓은 뒤 실패 1번만.
  log.length = 0
  clock += 5000
  st.recording = true
  tap('showFurigana', false)
  assert.deepEqual(st.deferred, { msg: 'success', ms: DISPLAY_TOAST_MS })
  s.release()
  await s.tick()
  await s.tick()
  assert.equal(st.deferred, null, '미뤄 둔 성공 안내는 버린다')
  assert.deepEqual(log, [], '떠 있는 다른 안내는 건드리지 않는다')
  endRecording()
  assert.deepEqual(log, ['saveFailed'])

  // ③ 녹음 중이 아니면 예전 그대로: 지우지 않고 실패 문구가 바로 덮는다(빈 문구가 실패 알림을 지우는 순서 문제 없음).
  log.length = 0
  clock += 5000
  tap('showHangul', false)
  s.release()
  await s.tick()
  await s.tick()
  assert.deepEqual(log, ['success', 'saveFailed'])

  // ④ 성공 안내가 이미 지난 뒤(2.2초 밖) 녹음 중 실패면 떠 있는 다른 안내를 지우지 않는다.
  log.length = 0
  clock += 5000
  tap('showHangul', false)
  notify('other')
  st.recording = true
  clock += DISPLAY_TOAST_MS
  s.release()
  await s.tick()
  await s.tick()
  assert.deepEqual(log, ['success', 'other'])
  assert.equal(st.shown, 'other')
  endRecording()
  assert.deepEqual(log, ['success', 'other', 'saveFailed'])
  assert.deepEqual(shell, [])

  offClear()
  offShell()
  release()
  s.gate(false)
})

test('task-031: SaveFailureClaims.isDeferring — 맡은 화면의 deferring 값 · 맡기 없음·deferring 없음 = false · clearFreshSuccessToast 분기', () => {
  const claims = new SaveFailureClaims()
  assert.equal(claims.isDeferring(), false)
  let rec = false
  const release = claims.claim(() => {}, undefined, () => rec)
  assert.equal(claims.isDeferring(), false)
  rec = true
  assert.equal(claims.isDeferring(), true)
  const calls: Array<[string, number | undefined]> = []
  const onToast = (m: string, ms?: number) => calls.push([m, ms])
  clearFreshSuccessToast(1000, 1001, onToast, claims)
  assert.deepEqual(calls, [['', 0]], '맡은 화면이 미루는 중이면 지운다')
  clearFreshSuccessToast(1000, 1000 + DISPLAY_TOAST_MS, onToast, claims)
  assert.equal(calls.length, 1, '오래된 성공 안내는 미루는 중이어도 지우지 않는다')
  rec = false
  clearFreshSuccessToast(1000, 1001, onToast, claims)
  assert.equal(calls.length, 1, '맡은 화면이 바로 띄우면 지우지 않는다')
  release()
  claims.claim(() => {})
  assert.equal(claims.isDeferring(), false, 'deferring 을 안 넘긴 맡기는 미루지 않는 것으로 본다')
  // 배선(정적): 회화방은 recordingRef 로 미룸을 알리고, notify 는 빈 문구를 녹음 중에도 미루지 않는다.
  const room = readFileSync(join(process.cwd(), 'src/components/talk/TalkRoom.tsx'), 'utf8')
  assert.match(room, /return left\s*\},\s*\(\) => recordingRef\.current,\s*\)/)
  assert.match(room, /if \(!msg && recordingRef\.current\) \{\s*if \(deferredToastRef\.current\) deferredToastRef\.current = null\s*else showToast\('', 0\)\s*return\s*\}/)
})

test('task-031 (REV-099 L-3): 이상 응답(segments:[null]·필드 누락·모양 불일치)은 그 조각만 "모름"(none) — loading 0, 다른 조각·뒤 묶음은 정상', async () => {
  const bad: Record<string, unknown> = {
    널조각: { segments: [null] },
    표기없음: { segments: [{ ruby: null, pron: 'ア', boundary: null }] },
    읽기숫자: { segments: [{ surface: '읽기숫자', ruby: null, pron: 3, boundary: null }] },
    경계이상: { segments: [{ surface: '경계이상', ruby: null, pron: null, boundary: 'word' }] },
    루비이상: { segments: [{ surface: '루비이상', ruby: [['루비이상']], pron: null, boundary: null }] },
    루비문자열: { segments: [{ surface: '루비문자열', ruby: '루비', pron: null, boundary: null }] },
    배열칸: [1, 2],
    숫자칸: 7,
  }
  const { client, calls, flush } = makeClient(async (texts) => ({
    items: texts.map((t) => (t in bad ? bad[t] : { segments: [seg(t)] })) as AnnotateResponse['items'],
    available: true,
  }))
  const texts = [...Object.keys(bad), '正常']
  client.request(texts)
  await flush()
  for (const t of Object.keys(bad)) {
    assert.equal(client.stateOf(t).s, 'none', `${t}: 숨김`)
  }
  assert.equal(client.stateOf('正常').s, 'ready', '같은 묶음의 정상 조각은 그대로')
  assert.ok(texts.every((t) => client.stateOf(t).s !== 'loading'), 'loading 으로 남은 조각 0')
  // 세그먼트 모양 이상은 분석 불가로 null 캐시(다시 묻지 않음) — 시간이 지나도 같은 문장으로 요청하지 않는다.
  for (const t of ['널조각', '표기없음', '읽기숫자', '경계이상', '루비이상', '루비문자열']) assert.equal(client.cached(t), null, t)
  const n = calls.length
  client.request(['널조각', '正常'])
  await flush()
  assert.equal(calls.length, n, '이상 칸·정상 칸 모두 다시 묻지 않는다')
  // 뒤에 온 새 문장도 막히지 않는다(예전: throw 로 drain 이 끊겨 뒤 조각까지 영구 loading).
  client.request(['다음'])
  assert.equal(client.stateOf('다음').s, 'loading')
  await flush()
  assert.equal(client.stateOf('다음').s, 'ready')
})

test('task-031: 정상·429 재시도 경로는 그대로 — 429 는 실패 기록(none) 뒤 35초 지나 다시 묻고 성공하면 ready', async () => {
  const clock = { t: 1_000 }
  let fail = true
  const { client, calls, flush } = makeClient(async (texts) => {
    if (fail) throw new Error('429')
    return okAll(texts)
  }, clock)
  client.request(['再'])
  await flush()
  assert.equal(client.stateOf('再').s, 'none')
  assert.equal(client.failure('再')?.n, 1)
  assert.equal(client.cached('再'), undefined, '429 는 캐시하지 않는다')
  fail = false
  clock.t += ANNOTATE_RETRY_AFTER_MS
  client.request(['再'])
  await flush()
  assert.equal(calls.length, 2)
  assert.equal(client.stateOf('再').s, 'ready')
  assert.equal(client.failure('再'), undefined)
})

test('isReadingSegment: #24r 세그먼트 계약 모양만 통과', () => {
  assert.equal(isReadingSegment({ surface: '今日', ruby: [['今日', 'きょう']], pron: 'キョー', boundary: null }), true)
  assert.equal(isReadingSegment({ surface: 'は', ruby: null, pron: 'ワ', boundary: 'particle' }), true)
  assert.equal(isReadingSegment({ surface: '。', ruby: null, pron: null, boundary: 'phrase' }), true)
  assert.equal(isReadingSegment(null), false)
  assert.equal(isReadingSegment([]), false)
  assert.equal(isReadingSegment({ surface: 'あ', pron: 'ア', boundary: null }), false, 'ruby 누락')
  assert.equal(isReadingSegment({ surface: 'あ', ruby: null, boundary: null }), false, 'pron 누락')
  assert.equal(isReadingSegment({ surface: 'あ', ruby: null, pron: 'ア' }), false, 'boundary 누락')
  assert.equal(isReadingSegment({ surface: '今', ruby: [['今', 1]], pron: null, boundary: null }), false)
})

// ── REV-094 L-2·M-1: 내 말 번역 ───────────────────────────────────────────────

test('userTrFailure: #32t 오류 → 칸 문구(409 reason·429·400/404·그 밖)', () => {
  const L = DISPLAY_COPY.userTr.fetch
  assert.deepEqual(userTrFailure({ status: 409, details: { reason: 'TURN_RUNNING' } }, L), { s: 'blocked', text: DISPLAY_COPY.userTr.turnRunning, label: L })
  assert.deepEqual(userTrFailure({ status: 409, details: { reason: 'TRANSLATION_BUSY' } }, L), { s: 'blocked', text: DISPLAY_COPY.userTr.busy, label: L })
  assert.deepEqual(userTrFailure({ status: 409, details: {} }, L), { s: 'blocked', text: DISPLAY_COPY.userTr.turnRunning, label: L }, 'reason 없음')
  assert.deepEqual(userTrFailure({ status: 429, details: { retryAfterSec: 30 } }, L), { s: 'blocked', text: DISPLAY_COPY.userTr.rate, label: L })
  assert.deepEqual(userTrFailure({ status: 400 }, L), { s: 'blocked', text: DISPLAY_COPY.userTr.blocked, label: null }, '버튼 없음')
  assert.deepEqual(userTrFailure({ status: 404, details: null }, L), { s: 'blocked', text: DISPLAY_COPY.userTr.blocked, label: null })
  for (const status of [0, -1, 500, 502, 422]) assert.deepEqual(userTrFailure({ status }, L), { s: 'failed' }, `status ${status}`)
})

test('withUserTranslation: 가져온 번역을 그 내 말의 translation 에 넣고 상태 표시를 지운다(접었다 펴도 유지)', () => {
  const msg = (id: string, role: 'USER' | 'ASSISTANT', extra: Partial<ChatMessageView> = {}) =>
    ({ id, role, content: id, status: 'DONE', createdAt: '2026-10-04T10:00:00.000Z', translation: null, ...extra }) as unknown as ChatMessageView
  const ms = [msg('u1', 'USER', { translationState: 'failed' }), msg('a1', 'ASSISTANT'), msg('u2', 'USER')]
  const out = withUserTranslation(ms, 'u1', '오늘 뭐 먹었어요?')
  assert.notEqual(out, ms, '새 배열')
  assert.equal(out[0].translation, '오늘 뭐 먹었어요?')
  assert.equal('translationState' in out[0], false)
  assert.equal(out[1], ms[1])
  assert.equal(out[2], ms[2])
  assert.equal(withUserTranslation(ms, 'nope', 'x'), ms, '없는 말')
  assert.equal(withUserTranslation(ms, 'a1', 'x'), ms, '강사 말은 건드리지 않는다')
  assert.equal(withUserTranslation(ms, 'u2', '  '), ms, '빈 번역')
})

test('fetchUserTranslation: 받은 번역은 onTranslated 로 목록에 올린다 · 빈 번역은 올리지 않는다 · 오류는 던진다(REV-095 M-1)', async () => {
  const urls: string[] = []
  const up: Array<[string, string]> = []
  const onTr = (id: string, text: string) => void up.push([id, text])
  const ok = await fetchUserTranslation(async (url) => (urls.push(url), { translation: '오늘 뭐 먹었어요?' }), 'c 1', 'm/1', onTr)
  assert.equal(ok, '오늘 뭐 먹었어요?')
  assert.deepEqual(up, [['m/1', '오늘 뭐 먹었어요?']])
  assert.equal(urls[0], '/api/v1/chats/c%201/messages/m%2F1/translation')
  assert.equal(await fetchUserTranslation(async () => ({ translation: '  ' }), 'c', 'm', onTr), null)
  assert.equal(await fetchUserTranslation(async () => ({ translation: null }), 'c', 'm', onTr), null)
  assert.equal(up.length, 1)
  await assert.rejects(fetchUserTranslation(async () => Promise.reject(new Error('429')), 'c', 'm', onTr))
  assert.equal(up.length, 1)
})

test('내 말 번역 배선 정적: 말풍선 → fetchUserTranslation(onTranslated) → 목록 → 방 화면 withUserTranslation', () => {
  const read = (f: string) => readFileSync(join(process.cwd(), 'src/components', f), 'utf8')
  const bubble = read('chat/MessageBubble.tsx')
  assert.match(bubble, /await fetchUserTranslation\([^;]*, chatId, message\.id, onTranslated\)/)
  assert.match(bubble, /<UserTranslation chatId=\{chatId\} message=\{message\} onTranslated=\{onTranslated\} \/>/)
  assert.match(read('chat/MessageList.tsx'), /<UserBubble [^>]*onTranslated=\{onUserTranslated\}/)
  assert.match(read('chat/ChatRoom.tsx'), /onUserTranslated=\{\(id, text\) => setMessages\(\(ms\) => withUserTranslation\(ms, id, text\)\)\}/)
  const talk = read('talk/TalkRoom.tsx')
  assert.match(talk, /const onUserTranslated = \(id: string, text: string\) => setMessages\(\(ms\) => withUserTranslation\(ms, id, text\)\)/)
  assert.match(talk, /onTranslated=\{onUserTranslated\}/)
})

// ── 우회 변환 금지(QA O-1) ────────────────────────────────────────────────────

test('화면 코드는 kanaToHangul·pronLine 을 부르지 않는다(한글 줄은 hangulLine 만)', () => {
  const root = join(process.cwd(), 'src', 'components')
  const files: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) {
        if (name !== '__tests__') walk(p)
      } else if (/\.(ts|tsx)$/.test(name)) files.push(p)
    }
  }
  walk(root)
  const offenders = files.filter((f) => /\b(kanaToHangul|pronLine)\b/.test(readFileSync(f, 'utf8')))
  assert.deepEqual(offenders, [])
})
