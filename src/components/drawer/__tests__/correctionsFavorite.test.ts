/**
 * task-074 후속 — 채택 교정 모음의 단어 상세 시트 머리 별 연결(screens.md §32-5·§32-9).
 * 동작 시험이 중심: 진짜 컨트롤러(`createFavoriteController`)를 이 화면이 훅에 넘기는 두 콜백(`correctionsInFavoriteView`·`correctionsFavoriteEffect`)에 물려 가짜 `send` 로 돌린다.
 * jsdom 이 없어 「화면이 `fav` 를 시트에 넘기는가」·「훅 위치」는 소스 스캔(보조)으로 묶는다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createFavoriteController, type FavEffect } from '@/components/vocab/favorite'
import FavoriteStar from '@/components/vocab/FavoriteStar'
import { GENERIC_ERROR, NETWORK_ERROR, WORD_NOT_FOUND } from '@/components/vocab/labels'
import type { WordFavorites } from '@/components/vocab/useWordFavorites'
import WordDetailSheet from '@/components/vocab/WordDetailSheet'
import type { WordEntry } from '@/types/vocab'
import { correctionsFavoriteEffect, correctionsInFavoriteView, type CorrectionsOpenWord } from '../correctionsFavorite'

const noop = () => {}
const flush = () => new Promise<void>((r) => setImmediate(r))

/** 화면이 훅에 넘기는 두 콜백과 같은 모양 — `host.open` 은 응답 순간(최신 렌더)의 열린 단어 시트. */
function rig(open: CorrectionsOpenWord = null) {
  const calls: unknown[][] = []
  const host = { open }
  const deps = {
    inFavoriteView: correctionsInFavoriteView,
    onEffect: (x: FavEffect) =>
      correctionsFavoriteEffect(x, host.open, {
        toast: (m) => calls.push(['toast', m]),
        wordGone: (fromId, m) => calls.push(['gone', fromId, m]),
      }),
  }
  let t = 0
  const sent: Array<{ id: string; to: boolean; resolve: (v: { favorite?: unknown }) => void; reject: (e: unknown) => void }> = []
  const c = createFavoriteController({
    send: (id, to) =>
      new Promise((resolve, reject) => {
        sent.push({ id, to, resolve, reject })
      }),
    now: () => ++t,
    inFavoriteView: deps.inFavoriteView,
    onChange: noop,
    onEffect: deps.onEffect,
  })
  return { c, sent, calls, host, deps }
}

test('F1 이 화면은 즐겨찾기 칸이 아니다 — inFavoriteView 늘 false · 켜고 꺼서 성공해도 토스트·시트 닫기 0(「즐겨찾기에서 뺐어요」 없음) · 컨트롤러 reload 도 무시', async () => {
  const r = rig({ wordId: 'w1', fromId: 'c1' })
  assert.equal(r.deps.inFavoriteView(), false)
  r.c.press('w1', false)
  assert.deepEqual([r.sent[0]!.id, r.sent[0]!.to], ['w1', true])
  r.sent[0]!.resolve({ favorite: true })
  await flush()
  assert.deepEqual(r.c.view('w1', false, 0), { on: true, locked: false })
  r.c.press('w1', true)
  assert.equal(r.sent[1]!.to, false)
  r.sent[1]!.resolve({ favorite: false })
  await flush()
  assert.deepEqual(r.c.view('w1', true, 0), { on: false, locked: false })
  assert.deepEqual(r.calls, [], '성공 응답에는 토스트·닫기가 없다')
  r.deps.onEffect({ id: 'w1', reload: true, toast: null, notFound: false })
  assert.deepEqual(r.calls, [], 'reload 표시는 이 화면에서 아무 일도 하지 않는다')
})

test('F2 실패: 500 → 일반 실패 문구 토스트 1회 · 상태 0 → 연결 문구 · 둘 다 별은 누르기 전 값으로 · 시트는 그대로(닫기 0)', async () => {
  const r = rig({ wordId: 'w1', fromId: 'c1' })
  r.c.press('w1', false)
  r.sent[0]!.reject({ status: 500 })
  await flush()
  assert.deepEqual(r.calls, [['toast', GENERIC_ERROR]])
  assert.deepEqual(r.c.view('w1', false, 0), { on: false, locked: false })
  r.calls.length = 0
  r.c.press('w1', false)
  r.sent[1]!.reject({ status: 0 })
  await flush()
  assert.deepEqual(r.calls, [['toast', NETWORK_ERROR]])
  assert.deepEqual(r.c.view('w1', false, 0), { on: false, locked: false })
})

test('F3 404 + 그 단어 시트가 열려 있음 → 이 화면의 「단어가 사라짐」 경로 1번(누른 카드 id·단어 없음 문구) · 토스트를 따로 또 보이지 않는다 · 별은 되돌림', async () => {
  const r = rig(null)
  r.host.open = { wordId: 'w1', fromId: 'c9' } // 컨트롤러·콜백을 만든 뒤에 열린 시트도 응답 순간에 읽는다
  r.c.press('w1', false)
  r.sent[0]!.reject({ status: 404 })
  await flush()
  assert.deepEqual(r.calls, [['gone', 'c9', WORD_NOT_FOUND]])
  assert.deepEqual(r.c.view('w1', false, 0), { on: false, locked: false })
})

test('F4 404 인데 시트가 닫혔거나(응답 전에 닫음) 다른 단어가 열려 있음 → 토스트 1회만, 시트를 닫거나 다시 읽지 않는다', async () => {
  const closedBefore = rig({ wordId: 'w1', fromId: 'c1' })
  closedBefore.c.press('w1', false)
  closedBefore.host.open = null // 응답이 오기 전에 시트를 닫음
  closedBefore.sent[0]!.reject({ status: 404 })
  await flush()
  assert.deepEqual(closedBefore.calls, [['toast', WORD_NOT_FOUND]])

  const other = rig({ wordId: 'w1', fromId: 'c1' })
  other.c.press('w1', false)
  other.host.open = { wordId: 'w2', fromId: 'c1' } // 시트 안에서 다른 단어로 넘어감
  other.sent[0]!.reject({ status: 404 })
  await flush()
  assert.deepEqual(other.calls, [['toast', WORD_NOT_FOUND]])
})

// ── 시트 요소 모양: `fav` 를 넘기면 머리 별 말고는 안 넘길 때와 같다 ─────────────────────────────

const word = (o: Partial<WordEntry> = {}): WordEntry => ({
  id: 'w1',
  surface: '食べる',
  reading: 'たべる',
  meaning: '먹다',
  partOfSpeech: 'VERB',
  chunkType: 'ACTION',
  category: null,
  source: 'SEED',
  origin: 'BASE',
  readOnly: true,
  correctCount: 0,
  wrongCount: 0,
  archived: false,
  ...o,
})

function elementOf<P>(Comp: (p: P) => ReactNode, props: P): ReactElement {
  let out: ReactNode = null
  function Probe() {
    out = Comp(props)
    return null
  }
  renderToStaticMarkup(createElement(Probe))
  assert.ok(isValidElement(out))
  return out as ReactElement
}

/** 함수는 같은 모양으로 둔다(`[fn]`) — 요소 트리를 값으로 비교하려는 정규화. */
function norm(v: unknown): unknown {
  if (typeof v === 'function') return '[fn]'
  if (Array.isArray(v)) return v.map(norm)
  if (isValidElement(v)) {
    const { children, ...rest } = v.props as Record<string, unknown>
    const t = v.type as unknown as { name?: string; displayName?: string }
    return { type: typeof v.type === 'string' ? v.type : (t.displayName ?? t.name ?? '[type]'), key: v.key, props: norm(rest), children: norm(children) }
  }
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, norm(x)]))
  return v
}

test('F5 이 화면이 시트에 넘기는 props 로 — fav 를 넘기면 머리 별(headerAction)만 더 생기고 나머지 요소 트리는 안 넘길 때와 같다', () => {
  const presses: unknown[][] = []
  const fav: WordFavorites = { press: (id, shown) => presses.push([id, shown]), view: () => ({ on: true, locked: false }), stamp: () => 3 }
  // CorrectionsScreen 397행과 같은 모양: categories 빈 배열, 보관 변경 처리기 비어 있음.
  const host = { wordId: 'w1', preview: word({ favorite: false }), categories: [], onClose: noop, onChanged: noop, onArchivedChange: noop, onRemoved: noop, onOpenWord: noop, onNotFound: noop, onToast: noop }
  const without = elementOf(WordDetailSheet, host)
  const withFav = elementOf(WordDetailSheet, { ...host, fav })

  const a = norm(without) as { props: Record<string, unknown> }
  const b = norm(withFav) as { props: Record<string, unknown> }
  assert.ok(JSON.stringify(a).length > 400, '비교하는 트리가 비어 있지 않다(정규화가 자식을 버리지 않음)')
  assert.equal(a.props.headerAction, undefined, '안 넘기면 머리 별 없음 — 지금 그대로')
  const action = (withFav.props as { headerAction?: ReactElement<Record<string, unknown>> }).headerAction
  assert.ok(action && action.type === FavoriteStar && action.props.variant === 'sheet' && action.props.on === true && action.props.locked === false)
  const { headerAction: gone, ...bRest } = b.props
  assert.ok(gone, '넘기면 머리 별이 생긴다')
  const { headerAction: none, ...aRest } = a.props
  assert.equal(none, undefined)
  assert.deepEqual(bRest, aRest, '머리 별 말고 시트 props 는 같다')
  assert.deepEqual({ ...b, props: bRest }, { ...a, props: aRest }, '자식 요소 트리도 같다')
  ;(action.props.onPress as () => void)()
  assert.deepEqual(presses, [['w1', true]], '별을 누르면 이 화면이 가진 기록(fav)으로 간다')
})

// ── 소스 스캔(보조) ──────────────────────────────────────────────────────────────────

const screen = readFileSync(join(__dirname, '..', 'CorrectionsScreen.tsx'), 'utf8').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')

test('S1 CorrectionsScreen: 훅은 조기 반환보다 앞에서 1번 · 단어 시트 요소에 fav 를 넘김 1번 · 요청·플러그인 직접 호출 0 · 효과의 reload 를 읽지 않음', () => {
  const hookAt = screen.indexOf('useWordFavorites({')
  assert.ok(hookAt > 0)
  assert.equal(screen.split('useWordFavorites(').length - 1, 1)
  const hookArg = screen.slice(hookAt, screen.indexOf('\n  })', hookAt) + 5)
  assert.match(hookArg, /inFavoriteView: correctionsInFavoriteView,/, '즐겨찾기 칸이 아니다')
  assert.match(hookArg, /onEffect: \(x\) => correctionsFavoriteEffect\(x, wordSheet, \{ toast: toast\.show, wordGone: afterWordGone \}\)/, '최신 시트·이 화면의 토스트·「단어가 사라짐」 경로')
  assert.ok(hookAt < screen.indexOf("if (view.body === 'emptyFirst')"), '훅 규칙: 첫 비어 있음 조기 반환 앞')
  const sheet = screen.slice(screen.indexOf('<WordDetailSheet'))
  assert.match(sheet.slice(0, sheet.indexOf('/>')), /\bfav=\{fav\}/, 'WordDetailSheet 요소 안')
  assert.equal(screen.split('fav={fav}').length - 1, 1)
  assert.doesNotMatch(screen, /\bfetch\(|window\.Capacitor|apiPost/)
  assert.doesNotMatch(screen, /\.reload\b/)
})
