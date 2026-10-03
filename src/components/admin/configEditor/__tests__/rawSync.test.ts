/**
 * REV-047 M-1(Raw JSON 편집 중 Form 변경 → 적용 글 = 요약한 초안) · L-1(Raw JSON 의 __proto__ 키로 프로토타입 오염) 회귀.
 * 훅(`useConfigEditor`)은 아래 순수 함수를 그 순서대로 부른다: Raw 켬 = `docText(docWithDraft(...))` → Raw 입력 = `parseRawText` →
 * Raw 편집 중 Form 입력 = `rawTextWithField` 후 `parseRawText` → 적용 = `applyPayload`.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyPayload,
  connectionFormBody,
  type Draft,
  docText,
  docWithDraft,
  EMPTY_DRAFT,
  type FieldModel,
  flatFromDoc,
  parseRawText,
  rawTextWithField,
  requestPatch,
  RESET_VALUE,
  setDraftValue,
} from '../draft'

const SCOPE = 'ENGINE_CONNECTION' as const
const STORED_DOC = {
  connection: { baseUrl: 'http://127.0.0.1:9000', timeoutMs: 20000 },
  runtime: { model: 'm', vad: { threshold: 0.5 } },
  credentialRef: null,
  logLevel: 'INFO',
  enabled: true,
}
const storedFlat = flatFromDoc(SCOPE, STORED_DOC)
const knownKeys = [...Object.keys(storedFlat).filter((k) => k !== 'connection.credentialRef'), 'runtime.prewarm', 'runtime.vad.endpointSilenceMs', 'runtime.tts.speed']
/** 저장값이 없는 칸의 Effective 값. */
const EFFECTIVE: Record<string, unknown> = { 'runtime.prewarm': true, 'runtime.vad.endpointSilenceMs': 500, 'runtime.tts.speed': 1 }
type F = Pick<FieldModel, 'key' | 'hasStored' | 'stored' | 'effective'>
const field = (key: string): F => {
  const has = Object.prototype.hasOwnProperty.call(storedFlat, key)
  return { key, hasStored: has, stored: has ? storedFlat[key] : undefined, effective: has ? storedFlat[key] : EFFECTIVE[key] }
}
const ctx = { scope: SCOPE, storedFlat, knownKeys }

function parsed(text: string): Draft {
  const r = parseRawText(text, SCOPE, storedFlat, knownKeys)
  assert.ok(r.ok, '글이 읽혀야 한다')
  return r.ok ? r.draft : EMPTY_DRAFT
}

/** 훅의 Raw 편집 중 Form 입력과 같은 순서: 글에 넣고 다시 읽는다. */
function formEditWhileRaw(text: string, key: string, value: unknown): { text: string; draft: Draft } {
  const next = rawTextWithField(text, SCOPE, field(key), value)
  assert.ok(next !== null)
  return { text: next!, draft: parsed(next!) }
}

test('M-1 ① Raw JSON 편집 뒤 Form 에서 값을 바꾸고 적용하면 적용 글 = 변경 요약 후보(requestPatch(draft)) — Raw 에서 고친 내용도 남는다', () => {
  // Raw 편집 켬 → Raw 에서 model 을 바꾸고 x- 메모를 넣는다(들여쓰기 4칸 — 사용자 글).
  const opened = docText(docWithDraft(SCOPE, STORED_DOC, EMPTY_DRAFT))
  const userDoc = JSON.parse(opened)
  userDoc.runtime.model = 'm2'
  userDoc['x-note'] = '메모'
  const rawEdited = JSON.stringify(userDoc, null, 4)
  const afterRaw = parsed(rawEdited)
  assert.deepEqual(requestPatch(afterRaw), { 'runtime.model': 'm2' })

  // Form 탭에서 요청 상한을 바꾼다(예전: rawText 그대로 → 적용 글에 45000 이 없었다).
  const s1 = formEditWhileRaw(rawEdited, 'connection.timeoutMs', 45000)
  assert.deepEqual(s1.draft, setDraftValue(afterRaw, field('connection.timeoutMs'), 45000), 'Form 초안 규칙과 같은 초안')
  const summary = requestPatch(s1.draft)
  assert.deepEqual(summary, { 'runtime.model': 'm2', 'connection.timeoutMs': 45000 })

  const p = applyPayload({ draft: s1.draft, rawText: s1.text, ...ctx })
  assert.equal(p.kind, 'raw')
  if (p.kind === 'raw') {
    assert.equal(p.text, s1.text)
    assert.deepEqual(requestPatch(parsed(p.text)), summary, '서버 #111 이 이 글에서 읽을 변경 = 확인한 요약')
    const doc = JSON.parse(p.text)
    assert.equal(doc['x-note'], '메모', 'Raw 에서 따로 넣은 내용은 Form 변경으로 사라지지 않는다')
    assert.equal(doc.runtime.model, 'm2')
    assert.equal(doc.connection.timeoutMs, 45000)
  }

  // 결함 재현 경로(Form 변경 전 글이 남은 경우)는 글을 보내지 않고 초안 patch(#107) + 안내.
  assert.deepEqual(applyPayload({ draft: s1.draft, rawText: rawEdited, ...ctx }), { kind: 'patch', patch: summary, rawIgnored: true })
  // 읽기 전 글(문법 오류)·지운 저장 키가 있는 글도 보내지 않는다.
  assert.deepEqual(applyPayload({ draft: s1.draft, rawText: s1.text.slice(0, -2), ...ctx }), { kind: 'patch', patch: summary, rawIgnored: true })
  const noVad = JSON.parse(s1.text)
  delete noVad.runtime.vad
  assert.equal(applyPayload({ draft: s1.draft, rawText: JSON.stringify(noVad), ...ctx }).kind, 'patch')
})

test('M-1 ① Raw 편집 중 Form 되돌리기·기준값 복귀: 저장값 있는 키는 저장값으로, 없는 키는 문서에서 지운다(빈 부모도) · 문법 오류면 받지 않는다', () => {
  const opened = docText(docWithDraft(SCOPE, STORED_DOC, EMPTY_DRAFT))
  let s = formEditWhileRaw(opened, 'runtime.model', 'm9')
  s = formEditWhileRaw(s.text, 'runtime.prewarm', false)
  s = formEditWhileRaw(s.text, 'runtime.tts.speed', 1.2)
  s = formEditWhileRaw(s.text, 'runtime.vad.endpointSilenceMs', 650)
  assert.deepEqual(requestPatch(s.draft), { 'runtime.model': 'm9', 'runtime.prewarm': false, 'runtime.tts.speed': 1.2, 'runtime.vad.endpointSilenceMs': 650 })

  s = formEditWhileRaw(s.text, 'runtime.model', RESET_VALUE)
  s = formEditWhileRaw(s.text, 'runtime.prewarm', true) // Effective 와 같아짐 = 초안에서 빠짐
  s = formEditWhileRaw(s.text, 'runtime.tts.speed', RESET_VALUE)
  s = formEditWhileRaw(s.text, 'runtime.vad.endpointSilenceMs', RESET_VALUE)
  assert.deepEqual(requestPatch(s.draft), {})
  assert.deepEqual(JSON.parse(s.text), STORED_DOC, '되돌리면 저장 문서 그대로(새로 만든 runtime.tts 빈 객체도 없음)')
  assert.deepEqual(applyPayload({ draft: s.draft, rawText: s.text, ...ctx }), { kind: 'raw', text: s.text })

  assert.equal(rawTextWithField('{"connection": {', SCOPE, field('connection.timeoutMs'), 1), null)
  assert.equal(rawTextWithField('[1]', SCOPE, field('connection.timeoutMs'), 1), null)
})

test('M-1 ② Raw JSON 만 고쳐 적용하면 사용자 글이 글자 그대로 #111 로 간다 · Raw 를 켜지 않았으면 #107 patch', () => {
  // Form 에서 먼저 바꾼 값이 있는 채로 Raw 편집을 켠 경우(E2E 2c)도 글 = 초안.
  const formFirst = setDraftValue(EMPTY_DRAFT, field('runtime.vad.threshold'), 0.6)
  const opened = docText(docWithDraft(SCOPE, STORED_DOC, formFirst))
  assert.deepEqual(applyPayload({ draft: parsed(opened), rawText: opened, ...ctx }), { kind: 'raw', text: opened })

  const userText = opened.replace('"timeoutMs": 20000', '"timeoutMs":   30000').replace('"model": "m"', '"model": "m3"')
  const d = parsed(userText)
  assert.deepEqual(requestPatch(d), { 'runtime.vad.threshold': 0.6, 'connection.timeoutMs': 30000, 'runtime.model': 'm3' })
  assert.deepEqual(applyPayload({ draft: d, rawText: userText, ...ctx }), { kind: 'raw', text: userText })
  assert.deepEqual(applyPayload({ draft: d, rawText: null, ...ctx }), { kind: 'patch', patch: requestPatch(d), rawIgnored: false })
})

test('L-1 Raw JSON 의 __proto__·constructor·prototype 키는 초안에 넣지 않고 오류로 — Object.prototype 오염 없음', () => {
  const names = ['polluted', 'polluted2', 'polluted3', 'polluted4', 'polluted5']
  const clean = () => names.every((n) => (({}) as Record<string, unknown>)[n] === undefined && !Object.prototype.hasOwnProperty.call(Object.prototype, n))

  const text = '{"connection":{"baseUrl":"http://127.0.0.1:9000","timeoutMs":20000,"constructor":{"prototype":{"polluted2":1}}},"runtime":{"__proto__":{"polluted":1},"model":"m","vad":{"threshold":0.5}},"__proto__":{"polluted3":1},"credentialRef":null,"logLevel":"INFO","enabled":true}'
  const r = parseRawText(text, SCOPE, storedFlat, knownKeys)
  assert.ok(r.ok)
  if (r.ok) {
    assert.deepEqual([...r.blocked].sort(), ['__proto__', 'connection.constructor', 'runtime.__proto__'])
    assert.deepEqual(requestPatch(r.draft), {}, '막힌 키는 초안(스키마 밖 키 포함)에 들어가지 않는다')
    docWithDraft(SCOPE, STORED_DOC, r.draft)
    assert.equal(applyPayload({ draft: r.draft, rawText: text, ...ctx }).kind, 'patch', '막힌 키가 있는 글은 #111 로 보내지 않는다')
  }
  // 경로 쓰기 자체도 막힌 마디를 건너뛴다(초안에 직접 들어와도).
  const doc = docWithDraft(SCOPE, STORED_DOC, { patch: {}, unknown: { 'runtime.__proto__.polluted': 1, 'connection.constructor.prototype.polluted2': 1 } })
  assert.deepEqual(doc, STORED_DOC)
  assert.equal(connectionFormBody({ 'runtime.__proto__.polluted5': 1 }), null)
  assert.equal(rawTextWithField(docText(STORED_DOC), SCOPE, { key: 'runtime.__proto__.polluted5', hasStored: false, stored: undefined, effective: undefined }, 1), null)
  // 평면 키 scope(운영 설정): 맨 위 __proto__
  const app = parseRawText('{"__proto__":{"polluted4":1},"value":"x"}', 'APP_SETTING', { value: 'y' }, ['value'])
  assert.ok(app.ok)
  if (app.ok) {
    assert.deepEqual(app.blocked, ['__proto__'])
    assert.deepEqual(requestPatch(app.draft), { value: 'x' })
    docWithDraft('APP_SETTING', { value: 'y' }, app.draft)
  }
  assert.ok(clean(), 'Object.prototype 에 새 속성이 생기지 않는다')
})
