import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { AdminEnvironment, Capability } from '@/types/admin'
import type { LexiconDiffRowDto, LexiconEntryDto } from '@/types/lexicon'
import LexiconActions from '../LexiconActions'
import LexiconDiffList, { DiffCounts } from '../LexiconDiffList'
import LexiconList from '../LexiconList'
import { lexiconAccess } from '../useLexiconAccess'
import { isAllZero, rollbackSlot } from '../VersionDetailSheet'
import WriteConfirmFields, { appendReason } from '../WriteConfirmFields'

// `voices.read` 만인 역할은 지금 역할 표에 없어서(§10-11 ⑬) 가짜 capability 로 네 갈래를 확인한다.
const caps = (...c: Capability[]) => (cap: Capability) => c.includes(cap)
const READ_ONLY = caps('voices.read')
const MANAGE = caps('voices.read', 'voices.manage')
const SUPER = caps('voices.read', 'voices.manage', 'config.apply.production')

test('lexiconAccess 네 갈래', () => {
  const cases: [string, (c: Capability) => boolean, AdminEnvironment, Partial<ReturnType<typeof lexiconAccess>>][] = [
    ['voices.read 만', READ_ONLY, 'LOCAL', { canManage: false, canWrite: false, canPreview: false, needsConfirm: false, note: 'READ_ONLY' }],
    ['voices.manage · LOCAL', MANAGE, 'LOCAL', { canManage: true, canWrite: true, canPreview: true, needsConfirm: false, note: null }],
    ['voices.manage · PRODUCTION(ADMIN·DEVELOPER)', MANAGE, 'PRODUCTION', { canManage: true, canWrite: false, canPreview: true, needsConfirm: false, note: 'PROD_SUPER_ONLY' }],
    ['SUPER_ADMIN · PRODUCTION', SUPER, 'PRODUCTION', { canManage: true, canWrite: true, canPreview: true, needsConfirm: true, note: 'PROD_WARN' }],
    ['SUPER_ADMIN · LOCAL', SUPER, 'LOCAL', { canWrite: true, needsConfirm: false, note: null }],
    ['voices.read 만 · PRODUCTION', READ_ONLY, 'PRODUCTION', { canWrite: false, canPreview: false, note: 'READ_ONLY' }],
  ]
  for (const [name, can, env, want] of cases) {
    const got = lexiconAccess(can, env)
    for (const [k, v] of Object.entries(want)) assert.equal(got[k as keyof typeof got], v, `${name}: ${k}`)
  }
})

const noop = () => undefined

test('액션 줄: 쓰기 권한이 없으면 추가·가져오기 버튼이 DOM 에 없고 내보내기만 있다', () => {
  const ro = renderToStaticMarkup(createElement(LexiconActions, { access: lexiconAccess(READ_ONLY, 'LOCAL'), onAdd: noop, onImport: noop, onExport: noop }))
  assert.doesNotMatch(ro, /항목 추가/)
  assert.doesNotMatch(ro, /가져오기/)
  assert.match(ro, /내보내기/)
  const prodAdmin = renderToStaticMarkup(createElement(LexiconActions, { access: lexiconAccess(MANAGE, 'PRODUCTION'), onAdd: noop, onImport: noop, onExport: noop }))
  assert.doesNotMatch(prodAdmin, /항목 추가|가져오기/)
  const rw = renderToStaticMarkup(createElement(LexiconActions, { access: lexiconAccess(MANAGE, 'LOCAL'), onAdd: noop, onImport: noop, onExport: noop }))
  assert.match(rw, /항목 추가/)
  assert.match(rw, /가져오기/)
  assert.match(rw, /내보내기/)
})

test('확인 문구 칸은 PRODUCTION 쓰기(needsConfirm)에서만', () => {
  const base = { reason: '', onReason: noop, confirm: '', onConfirm: noop, quick: ['오독 수정'], errors: {} }
  const off = renderToStaticMarkup(createElement(WriteConfirmFields, { ...base, needsConfirm: false }))
  assert.doesNotMatch(off, /확인 문구/)
  assert.match(off, /오독 수정/)
  const on = renderToStaticMarkup(createElement(WriteConfirmFields, { ...base, needsConfirm: true, errors: { confirm: 'PRODUCTION 을 그대로 입력해야 바꿀 수 있어요.' } }))
  assert.match(on, /aria-label="확인 문구"/)
  assert.match(on, /aria-invalid="true"/)
  assert.equal(appendReason('', '오독 수정'), '오독 수정')
  assert.equal(appendReason('日本橋 오독 ', '오독 수정'), '日本橋 오독 · 오독 수정')
})

const entry = (p: Partial<LexiconEntryDto>): LexiconEntryDto => ({
  id: 'e1',
  surface: '日本橋',
  reading: 'ニホンバシ',
  accentType: 0,
  priority: 10,
  scope: 'GLOBAL',
  scopeRefId: null,
  wordType: 'PLACE',
  note: null,
  enabled: true,
  moraCount: 5,
  createdAt: '2026-09-28T00:00:00.000Z',
  updatedAt: '2026-09-28T00:00:00.000Z',
  ...p,
})

test('목록: 표·카드 두 모양, 첫 칸 버튼 이름은 권한에 따라 고치기/보기, 꺼진 항목은 뱃지만', () => {
  const items = [entry({}), entry({ id: 'e2', surface: '等々力', reading: 'トドロキ', enabled: false, scope: 'VOICE', scopeRefId: 'voice_haruka_0001' })]
  const props = { items, total: 2, page: 1, pageSize: 50, voiceName: (id: string) => (id === 'voice_haruka_0001' ? '하루카' : null), now: 0, onOpen: noop }
  const rw = renderToStaticMarkup(createElement(LexiconList, { ...props, canWrite: true }))
  assert.match(rw, /<table/)
  assert.match(rw, /<ul/)
  assert.match(rw, /aria-label="日本橋 고치기"/)
  assert.match(rw, /상태: 꺼짐/)
  assert.match(rw, /하루카/)
  assert.doesNotMatch(rw, /opacity/)
  const ro = renderToStaticMarkup(createElement(LexiconList, { ...props, canWrite: false }))
  assert.match(ro, /aria-label="日本橋 보기"/)
  assert.doesNotMatch(ro, /고치기/)
})

test('diff 표시: 수정은 바뀐 칸만, 끔·다시 켬·추가 문구, 외 n개, 빈 목록', () => {
  const b = { surface: '日本橋', reading: 'ニッポンバシ', accentType: 0, priority: 10, scope: 'GLOBAL' as const, scopeRefId: null, wordType: null, enabled: true, note: null }
  const rows: LexiconDiffRowDto[] = [
    { kind: 'CHANGED', surface: '日本橋', scope: 'GLOBAL', scopeRefId: null, before: b, after: { ...b, reading: 'ニホンバシ', accentType: 3 } },
    { kind: 'DISABLED', surface: '神保町', scope: 'GLOBAL', scopeRefId: null, before: { ...b, surface: '神保町', reading: 'ジンボーチョー' }, after: null },
    { kind: 'ADDED', surface: '等々力', scope: 'USER', scopeRefId: 'cm1abcdefghijk', before: null, after: { ...b, surface: '等々力', reading: 'トドロキ', priority: 20 } },
    { kind: 'ENABLED', surface: '渋谷', scope: 'GLOBAL', scopeRefId: null, before: null, after: { ...b, surface: '渋谷', reading: 'シブヤ' } },
  ]
  const html = renderToStaticMarkup(createElement(LexiconDiffList, { rows, truncated: 3 }))
  assert.match(html, /읽기 <span lang="ja" class="text-ink">ニッポンバシ<\/span> → <span lang="ja" class="text-ink">ニホンバシ<\/span>/)
  assert.match(html, /악센트 0 → 3/)
  assert.doesNotMatch(html, /우선 10 → 10/)
  assert.match(html, /이제 쓰지 않아요/)
  assert.match(html, /다시 써요/)
  assert.match(html, /우선 20/)
  assert.match(html, /cm1abcde…/)
  assert.match(html, /외 3개/)
  assert.match(renderToStaticMarkup(createElement(LexiconDiffList, { rows: [], truncated: 0 })), /바뀐 항목이 없어요/)
  const counts = renderToStaticMarkup(createElement(DiffCounts, { counts: { added: 1, changed: 0, disabled: 2, enabled: 0 } }))
  assert.match(counts, /border-bad/)
})

test('버전 상세 발밑: 사용 중 = 안내, 쓰기 가능 = 되돌리기 버튼, 보기 전용 = 없음 · 지금과 같으면 되돌릴 것 없음', () => {
  assert.equal(rollbackSlot({ status: 'ACTIVE', version: 9 }, 9, true), 'current')
  assert.equal(rollbackSlot({ status: 'SUPERSEDED', version: 7 }, 9, true), 'button')
  assert.equal(rollbackSlot({ status: 'ROLLED_BACK', version: 8 }, 9, false), 'none')
  assert.equal(rollbackSlot({ status: 'SUPERSEDED', version: 7 }, null, true), 'none')
  assert.equal(isAllZero({ counts: { added: 0, changed: 0, disabled: 0, enabled: 0 } }), true)
  assert.equal(isAllZero({ counts: { added: 0, changed: 1, disabled: 0, enabled: 0 } }), false)
})
