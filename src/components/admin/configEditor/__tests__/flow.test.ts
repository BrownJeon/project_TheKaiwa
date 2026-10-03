import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Err } from '@/components/common/errors'
import FlowBar from '../FlowBar'
import { checkConfirmInput, checkReasonInput, FLOW_START, flowAfterEdit, type FlowInput, flowView, normalizeReason, testMinutesLeft, testPassed, writeErrorView } from '../flow'
import { writeMeta } from '../configApi'
import { shortHash } from '../ApplySheet'

const base: FlowInput = { flow: FLOW_START, production: false, canApply: true, canTest: true, syntaxError: false, errorCount: 0, changeCount: 2, cooldownSec: 0, testSec: 0 }
const ids = (i: FlowInput) => flowView(i).buttons.map((b) => b.id)
const text = (i: FlowInput) => flowView(i).message.map((p) => (typeof p === 'string' ? p : p.b)).join('')
const states = (i: FlowInput) => flowView(i).steps.map((s) => s.state)

test('막대 상태 전이(개발): 검증 → 테스트 또는 건너뛰기 → 요약 → 적용', () => {
  assert.deepEqual(ids(base), ['discard', 'validate'])
  assert.match(text(base), /바뀐 값 2개/)
  const v = { ...base, flow: { v: 'ok' as const, t: null, d: false } }
  assert.deepEqual(ids(v), ['discard', 'skip', 'test'])
  assert.deepEqual(states(v), ['done', 'cur', 'idle', 'idle'])
  const t = { ...base, flow: { v: 'ok' as const, t: 'ok' as const, d: false } }
  assert.deepEqual(ids(t), ['discard', 'diff'])
  const d = { ...base, flow: { v: 'ok' as const, t: 'ok' as const, d: true } }
  assert.deepEqual(ids(d), ['discard', 'apply'])
  assert.equal(flowView(d).buttons[1].label, '적용…')
  const partial = { ...base, flow: { v: 'ok' as const, t: 'partial' as const, d: false } }
  assert.deepEqual(ids(partial), ['discard', 'diff'], '개발 환경은 일부만 확인이어도 이어서')
  const skip = { ...base, flow: { v: 'ok' as const, t: 'skip' as const, d: true } }
  assert.deepEqual(states(skip), ['done', 'skip', 'done', 'cur'])
})

test('막대(운영): 테스트 필수 · 일부만 확인 = 적용 불가(버튼 없음) · 비 최고관리자 = 🔒 단계, 적용 버튼 없음', () => {
  const p = { ...base, production: true, flow: { v: 'ok' as const, t: null, d: false } }
  assert.deepEqual(ids(p), ['discard', 'test'], '운영은 건너뛰기가 없다')
  assert.equal(flowView(p).steps[1].label, '테스트(필수)')
  const partial = { ...p, flow: { v: 'ok' as const, t: 'partial' as const, d: false } }
  assert.deepEqual(ids(partial), ['discard'])
  assert.match(text(partial), /운영에 적용할 수 없어요/)
  const viewer = { ...p, canApply: false, flow: { v: 'ok' as const, t: 'ok' as const, d: true } }
  assert.deepEqual(ids(viewer), ['discard'])
  assert.equal(flowView(viewer).steps[3].state, 'lock')
  assert.match(text(viewer), /최고관리자\(SUPER_ADMIN\)만/)
  const sup = { ...p, flow: { v: 'ok' as const, t: 'ok' as const, d: true } }
  assert.equal(flowView(sup).buttons[1].label, 'PRODUCTION 에 적용…')
  assert.equal(testPassed('partial', true), false)
  assert.equal(testPassed('partial', false), true)
})

test('막대: 문법 오류면 검증 비활성 · 검증 오류 수 · 30초 대기 · 테스트 중 · 실패', () => {
  const syn = flowView({ ...base, syntaxError: true })
  assert.equal(syn.buttons[1].disabled, true)
  assert.match(text({ ...base, flow: { v: 'err', t: null, d: false }, errorCount: 3 }), /고칠 칸 3개/)
  assert.match(text({ ...base, flow: { v: 'err', t: null, d: false }, errorCount: 3, onRawTab: true }), /오류 3건/)
  const wait = flowView({ ...base, flow: { v: 'ok', t: 'wait', d: false }, cooldownSec: 12 })
  assert.equal(wait.buttons.find((b) => b.id === 'test')?.label, '12초 뒤 다시')
  assert.equal(wait.buttons.find((b) => b.id === 'test')?.disabled, true)
  const run = flowView({ ...base, flow: { v: 'ok', t: 'run', d: false }, testSec: 4 })
  assert.equal(run.buttons[1].busy, true)
  assert.match(text({ ...base, flow: { v: 'ok', t: 'run', d: false }, testSec: 4 }), /4초/)
  assert.match(text({ ...base, flow: { v: 'ok', t: 'fail', d: false } }), /테스트 실패/)
  assert.deepEqual(flowAfterEdit({ v: 'ok', t: 'wait', d: true }), { v: null, t: 'wait', d: false })
  assert.deepEqual(flowAfterEdit({ v: 'ok', t: 'ok', d: true }), { v: null, t: null, d: false })
})

test('막대 렌더: 권한 없는 적용은 버튼 DOM 이 없다(비활성 아님)', () => {
  const noop = () => undefined
  const viewer = renderToStaticMarkup(createElement(FlowBar, { view: flowView({ ...base, production: true, canApply: false, flow: { v: 'ok', t: 'ok', d: true } }), onButton: noop }))
  assert.doesNotMatch(viewer, /에 적용…/)
  assert.match(viewer, /🔒/)
  assert.match(viewer, /초안 버리기/)
  const sup = renderToStaticMarkup(createElement(FlowBar, { view: flowView({ ...base, production: true, flow: { v: 'ok', t: 'ok', d: true } }), onButton: noop }))
  assert.match(sup, /PRODUCTION 에 적용…/)
})

test('막대 렌더: 키보드가 열린 동안(html[data-kb]) fixed 막대만 숨고 빈 자리는 남는다(012c QA 결함 #1)', () => {
  const html = renderToStaticMarkup(createElement(FlowBar, { view: flowView(base), onButton: () => undefined }))
  const divs = [...html.matchAll(/<div\b([^>]*)>/g)].map(([, attrs]) => ({
    attrs,
    cls: (/\bclass="([^"]*)"/.exec(attrs)?.[1] ?? '').replace(/&amp;/g, '&').split(/\s+/),
  }))
  const KB_HIDDEN = '[:root[data-kb]_&]:hidden'
  const bar = divs.filter((d) => d.attrs.includes('role="region"'))
  assert.equal(bar.length, 1)
  assert.ok(bar[0].cls.includes('fixed'), '숨기는 대상은 fixed 막대')
  assert.ok(bar[0].cls.includes(KB_HIDDEN), '막대에 키보드 열림 숨김 변형이 있어야 한다')
  const spacer = divs.filter((d) => d.cls.includes('h-[150px]'))
  assert.equal(spacer.length, 1)
  assert.match(spacer[0].attrs, /aria-hidden="true"/)
  assert.ok(!spacer[0].cls.includes(KB_HIDDEN), '빈 자리는 숨기지 않는다(마지막 칸 여유 유지)')
  assert.equal(divs.filter((d) => d.cls.includes(KB_HIDDEN)).length, 1, '숨김은 막대 영역 하나뿐')
})

test('이유·확인 문구 미리 검사(서버 규칙과 같은 길이 셈)', () => {
  assert.equal(normalizeReason('  a\nb\r\n\tc  '), 'a b c')
  assert.equal(checkReasonInput('   ', false), '변경 이유를 적어 주세요.')
  assert.equal(checkReasonInput('짧음', false), null)
  assert.match(checkReasonInput('짧음', true) ?? '', /10자 이상/)
  assert.equal(checkReasonInput('응답이 느려 제한 시간을 늘림', true), null)
  assert.match(checkReasonInput('가'.repeat(201), false) ?? '', /200자까지/)
  assert.equal(checkConfirmInput('production', true), 'PRODUCTION 을 대문자로 그대로 입력해 주세요.')
  assert.equal(checkConfirmInput(' PRODUCTION ', true), null)
  assert.equal(checkConfirmInput('', false), null)
})

const err = (status: number, details: Record<string, unknown> = {}, message = ''): Err => ({ status, message, code: null, details, retryAfterSec: null })

test('쓰기 실패 해석: 409 충돌·요약 불일치·기본 연결 · 403 확인 문구·테스트·권한 · 422 이유·손상 · 400 칸 오류·이유 길이', () => {
  const ctx = { changeCount: 2 }
  const conflict = writeErrorView(err(409, { reason: 'VERSION_CONFLICT', currentVersion: 7 }), ctx)
  assert.equal(conflict.kind, 'notice')
  if (conflict.kind === 'notice') {
    assert.deepEqual(conflict.actions, ['rebase', 'discard'])
    assert.match(conflict.text, /v7/)
    assert.match(conflict.text, /2개는 그대로/)
    assert.equal(conflict.block, true)
  }
  const mm = writeErrorView(err(409, { reason: 'SUMMARY_MISMATCH' }), ctx)
  assert.ok(mm.kind === 'notice' && mm.actions[0] === 'remakeDiff')
  const prim = writeErrorView(err(409, { reason: 'PRIMARY_IN_USE', roles: ['LLM'] }), ctx)
  assert.ok(prim.kind === 'notice' && prim.actions[0] === 'roleLink' && /LLM/.test(prim.text))
  assert.deepEqual(writeErrorView(err(403, { reason: 'PRODUCTION_CONFIRMATION_REQUIRED' }), ctx).kind, 'confirm')
  const tr = writeErrorView(err(403, { reason: 'PRODUCTION_TEST_REQUIRED', detail: 'EXPIRED' }), ctx)
  assert.ok(tr.kind === 'notice' && tr.actions[0] === 'retest' && /30분이 지남/.test(tr.text))
  const forb = writeErrorView(err(403, { missing: ['config.apply.production'] }), ctx)
  assert.ok(forb.kind === 'notice' && /config\.apply\.production/.test(forb.text) && forb.block)
  const secret = writeErrorView(err(422, { field: 'reason', reason: 'E_REASON_SECRET_LIKE' }), ctx)
  assert.ok(secret.kind === 'reason' && /비밀처럼/.test(secret.text))
  const dmg = writeErrorView(err(422, { reason: 'E_SNAPSHOT_INTEGRITY' }), ctx)
  assert.ok(dmg.kind === 'notice' && dmg.block)
  const short = writeErrorView(err(400, { field: 'reason', reason: 'REASON_TOO_SHORT', min: 10, length: 4 }), ctx)
  assert.ok(short.kind === 'reason' && /10자 이상/.test(short.text) && /4자/.test(short.text))
  const fields = writeErrorView(err(400, { stage: 'SCHEMA', errors: [{ key: 'connection.timeoutMs', rule: 'min', message: '최솟값' }] }), ctx)
  assert.ok(fields.kind === 'fields' && fields.errors.length === 1)
  assert.equal(writeErrorView(err(0), ctx).kind, 'notice')
  // 응답 원문(이유 등)을 되돌려 화면에 싣지 않는다 — 고정 문구만.
  const anyNotice = writeErrorView(err(500, {}, 'sk-should-not-show'), ctx)
  assert.ok(anyNotice.kind === 'notice' && !/sk-should-not-show/.test(anyNotice.text))
})

test('쓰기 꼬리: 운영만 확인 문구·요약 해시, 테스트 결과 id 는 있을 때만 · 해시 줄임 · 남은 분', () => {
  assert.deepEqual(writeMeta({ baseVersion: 3, reason: 'r', production: false, confirm: 'x', summaryHash: 'h', testResultId: null }), { baseVersion: 3, reason: 'r' })
  assert.deepEqual(writeMeta({ baseVersion: 3, reason: 'r', production: true, confirm: ' PRODUCTION ', summaryHash: 'h', testResultId: 't' }), { baseVersion: 3, reason: 'r', confirm: 'PRODUCTION', summaryHash: 'h', testResultId: 't' })
  assert.equal(shortHash('sha256:3f9a0c00112233c21e'), '3f9a0c…c21e')
  assert.equal(shortHash(null), '—')
  assert.equal(testMinutesLeft(new Date(10 * 60_000).toISOString(), 1), 10)
  assert.equal(testMinutesLeft(new Date(1000).toISOString(), 60_000), 0)
  assert.equal(testMinutesLeft(null, 1), null)
})

test('확인 칸 렌더: PRODUCTION 입력 칸은 운영 쓰기(needsConfirm)에서만 · 이유 규칙 안내(운영 10~200자)', async () => {
  const { default: ReasonFields } = await import('../ReasonFields')
  const noop = () => undefined
  const base = { reason: '', onReason: noop, reasonError: null, confirm: '', onConfirm: noop, confirmError: null }
  const local = renderToStaticMarkup(createElement(ReasonFields, { ...base, production: false, needsConfirm: false }))
  assert.doesNotMatch(local, /aria-label="확인 문구"/)
  assert.match(local, /1~200자/)
  const prod = renderToStaticMarkup(createElement(ReasonFields, { ...base, production: true, needsConfirm: true, confirmError: 'PRODUCTION 을 대문자로 그대로 입력해 주세요.' }))
  assert.match(prod, /aria-label="확인 문구"/)
  assert.match(prod, /10~200자/)
  assert.match(prod, /aria-invalid="true"/)
})
