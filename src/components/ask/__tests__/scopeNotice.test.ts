import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readCode } from '../../__tests__/sourceCode'
import { ASK_COPY } from '../askCopy'
import { ASK_KEYS } from '../logic'
import { ScopeNoticeBody } from '../ScopeNoticeSheet'
import { readScopeNoticeAck, scopeNoticeAcked, writeScopeNoticeAck } from '../useScopeNoticeGate'

// task-064 §25-5 I · 25-12 B 9 — 보내는 범위 시트(승인 데모 v2 문구 그대로, Leader L-5)와 「처음 한 번」 관문.

const noop = () => {}
const body = (mode: 'first' | 'again') => renderToStaticMarkup(createElement(ScopeNoticeBody, { mode, leadId: 'lead', onConfirm: noop, onClose: noop }))
const count = (s: string, sub: string) => s.split(sub).length - 1

function withWindow(storage: Partial<Storage> | 'throw', fn: () => void) {
  const g = globalThis as { window?: unknown }
  const prev = g.window
  g.window =
    storage === 'throw'
      ? Object.defineProperty({}, 'localStorage', {
          get() {
            throw new Error('SecurityError')
          },
        })
      : { localStorage: storage }
  try {
    fn()
  } finally {
    g.window = prev
  }
}

test('안내 키 값 — "1" 만 본 것, 나머지·없음은 안 본 것', () => {
  assert.equal(scopeNoticeAcked('1'), true)
  for (const v of [null, '', '0', 'true', ' 1']) assert.equal(scopeNoticeAcked(v), false, String(v))
})

test('읽기·쓰기 — localStorage `kaiwa.ask.scopeNotice.v1`, 예외는 안 본 것(시트가 뜬다)', () => {
  assert.equal(ASK_KEYS.scopeNotice, 'kaiwa.ask.scopeNotice.v1')
  const mem = new Map<string, string>()
  const fake = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) }
  withWindow(fake, () => {
    assert.equal(readScopeNoticeAck(), false)
    writeScopeNoticeAck()
    assert.equal(mem.get('kaiwa.ask.scopeNotice.v1'), '1')
    assert.equal(readScopeNoticeAck(), true)
  })
  withWindow('throw', () => {
    assert.equal(readScopeNoticeAck(), false)
    assert.doesNotThrow(() => writeScopeNoticeAck())
  })
  withWindow({ getItem: () => { throw new Error('x') } }, () => assert.equal(readScopeNoticeAck(), false))
  assert.equal(readScopeNoticeAck(), false) // 서버(창 없음)
})

test('처음(first) — 승인 데모 문구: 보내는 것 5줄·보내지 않는 것 3줄, [알겠어요, 보내기][취소], 다시 보기 안내 꼬리', () => {
  const h = body('first')
  assert.ok(h.includes('<p id="lead">'), '첫 문단이 describedBy 대상')
  assert.ok(h.includes(`<b class="font-bold">${ASK_COPY.scope.leadBold}</b>`))
  assert.equal(ASK_COPY.scope.send.length, 5)
  assert.equal(ASK_COPY.scope.noSend.length, 3)
  for (const t of [...ASK_COPY.scope.send, ...ASK_COPY.scope.noSend]) assert.ok(h.includes(t), t)
  assert.equal(count(h, '<li'), 8)
  assert.equal(count(h, '>✓</span>'), 5)
  assert.equal(count(h, '>×</span>'), 3)
  assert.ok(h.includes(ASK_COPY.scope.sendHead) && h.includes(ASK_COPY.scope.noSendHead))
  assert.ok(h.includes(ASK_COPY.scope.note + ASK_COPY.scope.noteFirstTail))
  assert.ok(h.includes(`>${ASK_COPY.scope.ok}</button>`) && h.includes(`>${ASK_COPY.scope.cancel}</button>`))
  assert.ok(h.indexOf(ASK_COPY.scope.ok) < h.indexOf(`>${ASK_COPY.scope.cancel}<`), '확정 → 취소 순서')
  assert.ok(!h.includes(`>${ASK_COPY.scope.close}</button>`))
  // 표식은 숨기고 머리가 뜻을 말한다(25-9)
  assert.equal(count(h, 'aria-hidden="true"'), 8)
})

test('다시 보기(again) — [닫기] 하나, 보내기 버튼·다시 보기 꼬리 없음', () => {
  const h = body('again')
  assert.ok(h.includes(`>${ASK_COPY.scope.close}</button>`))
  assert.ok(!h.includes(ASK_COPY.scope.ok) && !h.includes(`>${ASK_COPY.scope.cancel}</button>`))
  assert.ok(h.includes(ASK_COPY.scope.note) && !h.includes(ASK_COPY.scope.noteFirstTail.trim()))
})

test('3a 범위·Leader 정정 — 음성 줄·교정 설명·역할극·단어장 문구 없음', () => {
  for (const mode of ['first', 'again'] as const) {
    const h = body(mode)
    for (const bad of ['목소리', '말로', '받아쓴', '교정 설명', '역할극', '상황 연습', '단어장']) assert.ok(!h.includes(bad), `${mode}:${bad}`)
  }
})

test('구조 — 공용 Sheet 안·describedBy 연결, 키는 ASK_KEYS 한 곳에서만', () => {
  const sheet = readCode('src/components/ask/ScopeNoticeSheet.tsx')
  assert.match(sheet, /<Sheet[^>]*describedBy=\{leadId\}/)
  assert.ok(!sheet.includes('dangerouslySetInnerHTML'))
  const gate = readCode('src/components/ask/useScopeNoticeGate.ts')
  assert.ok(gate.includes('ASK_KEYS.scopeNotice') && !gate.includes("'kaiwa.ask.scopeNotice"))
  assert.ok(gate.includes("readStore('local'") && gate.includes("writeStore('local'"))
})
