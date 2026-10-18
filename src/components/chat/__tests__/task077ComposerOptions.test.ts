/**
 * task-077 UI-1 — 오늘의 회화 ⑤ 가 쓰도록 넓힌 `Composer` 선택 prop(Enter 방식·초안 키 전체·보내기 이름).
 * 넘기지 않으면 지금 회화·채팅·질문 동작 그대로(기본 마크업은 `sharedDefaults`·`askChatTab` 도 본다).
 * Enter 규칙은 순수 함수(`enterSubmits`)를 모든 조합으로, 초안 키는 마운트 때 읽는 값으로 본다(렌더러가 없어 효과의 쓰기는 배선만 본다).
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readCode } from '../../__tests__/sourceCode'
import Composer, { composerDraftKey, enterSubmits, type ComposerEnter } from '../Composer'

const noop = () => {}

/* ── Enter 규칙 ──────────────────────────────────────────────────── */

test('enterSubmits: 모든 조합 — 지금(finePointer) = 정밀 포인터에서만 · 레슨(always) = 모바일 포함, 둘 다 Shift·IME 조합(isComposing·229)·다른 키는 보내지 않는다', () => {
  let rows = 0
  for (const mode of ['finePointer', 'always'] as ComposerEnter[]) {
    for (const key of ['Enter', 'a', 'Tab']) {
      for (const shiftKey of [false, true]) {
        for (const isComposing of [false, true]) {
          for (const keyCode of [13, 229]) {
            for (const fine of [false, true]) {
              let asked = 0
              const got = enterSubmits({ key, shiftKey, isComposing, keyCode }, mode, () => {
                asked++
                return fine
              })
              const plain = key === 'Enter' && !shiftKey && !isComposing && keyCode !== 229
              const want = plain && (mode === 'always' || fine)
              assert.equal(got, want, JSON.stringify({ mode, key, shiftKey, isComposing, keyCode, fine }))
              // 매체 질의는 지금 방식에서 「그냥 Enter」일 때만 한다(지금 코드와 같은 순서)
              assert.equal(asked, mode === 'finePointer' && plain ? 1 : 0, `asked ${JSON.stringify({ mode, key, shiftKey, isComposing, keyCode })}`)
              rows++
            }
          }
        }
      }
    }
  }
  assert.equal(rows, 96)
})

test('enterSubmits: 대표 사례(손으로 적음) — 모바일 회화 Enter = 줄바꿈 · 모바일 레슨 Enter = 확인 · 일본어 변환 확정 Enter 는 어디서나 줄도 아님', () => {
  const mobile = () => false
  const desktop = () => true
  const enter = { key: 'Enter', shiftKey: false, isComposing: false, keyCode: 13 }
  assert.equal(enterSubmits(enter, 'finePointer', mobile), false)
  assert.equal(enterSubmits(enter, 'finePointer', desktop), true)
  assert.equal(enterSubmits(enter, 'always', mobile), true)
  assert.equal(enterSubmits({ ...enter, shiftKey: true }, 'always', desktop), false)
  assert.equal(enterSubmits({ ...enter, isComposing: true }, 'always', mobile), false)
  assert.equal(enterSubmits({ ...enter, keyCode: 229 }, 'always', mobile), false)
})

test('Composer 는 Enter 판단을 enterSubmits 하나로 — 기본 방식 finePointer · 매체 질의는 (pointer: fine)', () => {
  const c = readCode('src/components/chat/Composer.tsx')
  assert.match(c, /enterSends = 'finePointer',/)
  assert.match(
    c,
    /if \(!enterSubmits\(\{ key: e\.key, shiftKey: e\.shiftKey, isComposing: e\.nativeEvent\.isComposing, keyCode: e\.keyCode \}, enterSends, \(\) => window\.matchMedia\('\(pointer: fine\)'\)\.matches\)\) return\s*e\.preventDefault\(\)\s*submit\(\)/,
  )
})

/* ── 초안 키 ─────────────────────────────────────────────────────── */

test('composerDraftKey: chatId 면 지금 키(kaiwa.chat.draft.{id}) · draftKey 면 그 키 전체(레슨 키)', () => {
  assert.equal(composerDraftKey({ chatId: 'c1' }), 'kaiwa.chat.draft.c1')
  assert.equal(composerDraftKey({ draftKey: 'kaiwa.lesson.speakDraft.L1.i2' }), 'kaiwa.lesson.speakDraft.L1.i2')
  assert.equal(composerDraftKey({ chatId: 'c1', draftKey: 'k' }), 'k', '둘 다면 넘긴 키 전체가 먼저')
})

test('Composer 초안 쓰기·읽기는 같은 키 하나(storeKey) — 효과 의존성도 그 키', () => {
  const c = readCode('src/components/chat/Composer.tsx')
  assert.match(c, /const storeKey = composerDraftKey\(\{ chatId, draftKey \}\)/)
  assert.match(c, /useState\(\(\) => readStore\('session', storeKey\) \?\? ''\)/)
  assert.match(c, /writeStore\('session', storeKey, text === '' \? null : text\), 300\)/)
  assert.match(c, /\}, \[storeKey, text\]\)/)
  assert.ok(!c.includes('KEYS.draft(chatId)'), '대화 키를 따로 계산하는 길이 없다')
})

/* ── 렌더 ────────────────────────────────────────────────────────── */

const base = { busy: false, blockedUntil: null, placeholder: '일본어로 답해 보세요', onSend: noop, onBlocked: noop, handleRef: { current: null } }
const render = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(Composer, { ...base, ...props } as never))

function withSession<T>(data: Record<string, string>, fn: () => T): T {
  const g = globalThis as { window?: unknown }
  const had = 'window' in g
  const prev = g.window
  const mem = new Map(Object.entries(data))
  const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) }
  g.window = { sessionStorage: storage, localStorage: storage }
  try {
    return fn()
  } finally {
    if (had) g.window = prev
    else delete g.window
  }
}
const value = (html: string) => html.match(/<textarea[^>]*>([^<]*)<\/textarea>/)?.[1] ?? null

test('초안 키 전체(draftKey): 과제마다 그 키의 초안을 읽는다 — 다른 과제·회화방 초안이 섞이지 않는다(과제가 바뀌면 key 로 새로 그린다)', () => {
  const data = { 'kaiwa.lesson.speakDraft.L1.a': '週末に', 'kaiwa.lesson.speakDraft.L1.b': '料理が', 'kaiwa.chat.draft.L1': '회화 초안' }
  withSession(data, () => {
    assert.equal(value(render({ key: 'a', draftKey: 'kaiwa.lesson.speakDraft.L1.a' })), '週末に')
    assert.equal(value(render({ key: 'b', draftKey: 'kaiwa.lesson.speakDraft.L1.b' })), '料理が')
    assert.equal(value(render({ key: 'c', draftKey: 'kaiwa.lesson.speakDraft.L1.c' })), '')
    // 지금 경로(chatId)는 지금 키
    assert.equal(value(render({ chatId: 'L1' })), '회화 초안')
  })
})

test('sendLabel: 막힌 이유가 없을 때 보내기 이름 · 확인 중(busy)·글자 수 초과는 이유가 먼저 · 기본은 「보내기」', () => {
  assert.match(render({ chatId: 'c1', sendLabel: '확인하기' }), /<button type="submit" aria-label="확인하기"/)
  assert.match(render({ chatId: 'c1', sendLabel: '확인하기', busy: true, busyReason: '확인하는 중…' }), /<button type="submit" aria-label="확인하는 중…"/)
  assert.match(render({ chatId: 'c1' }), /<button type="submit" aria-label="보내기"/)
  withSession({ 'kaiwa.chat.draft.c2': 'あ'.repeat(1001) }, () => {
    assert.match(render({ chatId: 'c2', sendLabel: '확인하기' }), /<button type="submit" aria-label="1,000자까지 보낼 수 있어요"/)
  })
})

test('기본값 = 지금: 새 prop 을 기본값 그대로 넘긴 마크업은 넘기지 않은 것과 같다 · draftKey 로 지금 키를 넘겨도 같다', () => {
  withSession({ 'kaiwa.chat.draft.c1': 'こんにちは' }, () => {
    const now = render({ chatId: 'c1' })
    assert.equal(render({ chatId: 'c1', enterSends: 'finePointer', sendLabel: '보내기' }), now)
    assert.equal(render({ draftKey: 'kaiwa.chat.draft.c1' }), now)
    assert.equal(render({ chatId: 'c1', enterSends: 'always' }), now, 'Enter 방식은 마크업에 드러나지 않는다')
    assert.equal(value(now), 'こんにちは')
  })
})
