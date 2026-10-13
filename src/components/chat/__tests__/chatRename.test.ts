import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readCode } from '../../__tests__/sourceCode'
import { calls, declOf, parseCode } from '../../ask/__tests__/astCode'
import { ASK_COPY } from '../../ask/askCopy'
import ChatRenameForm, { ChatRenameFields, renameCancelAllowed, renameCheck, renameErrorAfterInput, saveRename, saveRenameUnlessBusy } from '../ChatRenameForm'
import { renameCancelTarget } from '../ChatMenuSheet'

// task-067 §27-10 T15·T16·T17 — 제목 바꾸기 공용 칸(진입 3곳)과 ⋯ 메뉴의 시작 화면. 변이: 각 줄 끝 주석.

const chatDir = join(__dirname, '..')
const noop = () => {}

// 옮기기 전 `ChatMenuSheet` rename 본문(2026-10-13 지금 코드를 그대로 렌더해 적은 값) — 회화·채팅 칸은 한 글자도 바뀌면 안 된다.
const OLD_IDLE =
  '<div class="flex flex-col gap-2"><div class="flex min-w-0 flex-col gap-1.5 "><label for="chatRename" class="text-[12.5px] font-medium text-ink2">제목</label><input id="chatRename" class="h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-[16px] text-ink" value="駅で"/></div><div class="mt-3 flex gap-2 [&amp;&gt;*]:min-w-0 [&amp;&gt;*]:flex-1"><button type="button" class="inline-flex items-center justify-center gap-2 rounded-xl font-semibold h-12 px-4 text-[15px] bg-accent text-on-accent disabled:opacity-40 ">저장</button><button type="button" class="inline-flex items-center justify-center gap-2 rounded-xl font-semibold h-12 px-4 text-[15px] border border-line bg-surface disabled:opacity-40 ">취소</button></div></div>'
const OLD_BUSY_ERR =
  '<div class="flex flex-col gap-2"><div class="flex min-w-0 flex-col gap-1.5 "><label for="chatRename" class="text-[12.5px] font-medium text-ink2">제목</label><input id="chatRename" class="h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-[16px] text-ink" value="駅で"/></div><p role="alert" class="text-[12px] text-bad break-keep">ERR</p><div class="mt-3 flex gap-2 [&amp;&gt;*]:min-w-0 [&amp;&gt;*]:flex-1"><button type="button" aria-disabled="true" aria-busy="true" class="inline-flex items-center justify-center gap-2 rounded-xl font-semibold h-12 px-4 text-[15px] bg-accent text-on-accent disabled:opacity-40 ">저장 중…</button><button type="button" aria-disabled="true" class="inline-flex items-center justify-center gap-2 rounded-xl font-semibold h-12 px-4 text-[15px] border border-line bg-surface disabled:opacity-40 ">취소</button></div></div>'

const fields = (over: Partial<Parameters<typeof ChatRenameFields>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(ChatRenameFields, { variant: 'default', inputId: 'x', hintId: 'h', value: '駅で', error: null, invalid: false, busy: false, onChange: noop, onSave: noop, onCancel: noop, ...over }),
  )

test('T16 회화·채팅(default) 칸 = 옮기기 전 ChatMenuSheet rename 본문 그대로(쉬는 중·저장 중+실패) — 글자 수·안내 줄·n/100 없음', () => {
  const idle = renderToStaticMarkup(createElement(ChatRenameForm, { chatId: 'c1', initial: '駅で', onSaved: noop, onCancel: noop }))
  assert.equal(idle, OLD_IDLE) // 글자 수·안내 줄을 모든 종류에 붙이면 실패
  assert.equal(fields({ error: 'ERR', invalid: true, busy: true }), OLD_BUSY_ERR) // default 에 aria-invalid·readOnly 를 붙이면 실패
  assert.ok(!idle.includes('/ 100') && !idle.includes('aria-describedby'))
})

test('T16 질문(ask) 칸 — 「n / 100」(aria-hidden)·안내 줄(describedby)·Enter 완료 키·자동완성 끔, 오류면 aria-invalid + 오류 줄이 안내 자리를 대신', () => {
  const a = fields({ variant: 'ask', value: '大丈夫 😀' })
  assert.match(a, /<p aria-hidden="true" class="text-right text-\[12px\] tabular-nums text-ink2">5 \/ 100<\/p>/) // 코드포인트 5 — 이모지도 1(UTF-16 으로 세면 6)
  assert.match(a, /<input id="x" autoComplete="off" enterKeyHint="done" aria-describedby="h"/)
  assert.ok(a.includes('<p id="h" class="text-[12.5px] text-ink2 break-keep">') && !a.includes('aria-invalid'))
  const bad = fields({ variant: 'ask', value: 'あ'.repeat(101), error: '제목은 100자까지 쓸 수 있어요', invalid: true })
  assert.match(bad, /font-semibold text-bad">101 \/ 100</)
  assert.ok(bad.includes('aria-invalid="true"') && bad.includes('border-bad'))
  assert.match(bad, /<p id="h" role="alert" class="text-\[12\.5px\] font-semibold text-bad break-keep">제목은 100자까지 쓸 수 있어요<\/p>/)
  assert.equal((bad.match(/id="h"/g) ?? []).length, 1, '안내 줄과 오류 줄은 같은 자리 하나')
  const busy = fields({ variant: 'ask', busy: true })
  assert.ok(busy.includes('readOnly=""') && busy.includes('aria-busy="true"') && busy.includes('저장 중…'))
})

test('T15 제목 검사 — 빈 값·공백만 → 「제목을 적어 주세요」, 101 코드포인트 → 「…100자까지…」 둘 다 요청 0 · 100 코드포인트(이모지 섞음) → PATCH 1회, 앞뒤 공백 뺀 값', async () => {
  assert.deepEqual(renameCheck(''), { ok: false, reason: 'empty' })
  assert.deepEqual(renameCheck('   '), { ok: false, reason: 'empty' })
  const over = '😀'.repeat(101) // UTF-16 202 — length 로 세면 100 과 101 을 구분하지 못한다
  assert.deepEqual(renameCheck(over), { ok: false, reason: 'over' })
  const hundred = '😀'.repeat(50) + 'あ'.repeat(50)
  assert.deepEqual(renameCheck(`  ${hundred} `), { ok: true, title: hundred }) // length(150) 로 세면 실패
  for (const variant of ['default', 'ask'] as const) {
    const sent: Array<[string, unknown]> = []
    const patch = async (url: string, body: unknown) => {
      sent.push([url, body])
      return {}
    }
    assert.deepEqual(await saveRename({ chatId: 'c 1', value: ' ', variant, patch }), { ok: false, error: '제목을 적어 주세요', invalid: true })
    assert.deepEqual(await saveRename({ chatId: 'c 1', value: over, variant, patch }), { ok: false, error: '제목은 100자까지 쓸 수 있어요', invalid: true })
    assert.equal(sent.length, 0, `${variant}: 검사에 걸리면 요청 0`)
    let started = 0
    assert.deepEqual(await saveRename({ chatId: 'c 1', value: `  ${hundred} `, variant, patch, onStart: () => started++ }), { ok: true, title: hundred })
    assert.deepEqual(sent, [['/api/v1/chats/c%201', { title: hundred }]])
    assert.equal(started, 1)
  }
})

test('T15 저장 실패 문구 — 질문은 데모 원문 하나(404 포함), 회화·채팅은 지금처럼 actionErrorText', async () => {
  const fail = async () => {
    throw Object.assign(new Error('x'), { status: 404 })
  }
  const a = await saveRename({ chatId: 'q1', value: '제목', variant: 'ask', patch: fail })
  assert.deepEqual(a, { ok: false, error: '제목을 바꾸지 못했어요. 연결을 확인하고 다시 해 보세요.', invalid: false })
  const d = await saveRename({ chatId: 'c1', value: '제목', variant: 'default', patch: fail })
  assert.equal(d.ok, false)
  assert.notEqual(!d.ok && d.error, '제목을 바꾸지 못했어요. 연결을 확인하고 다시 해 보세요.') // 질문 문구를 모든 종류에 쓰면 실패
})

test('T15 Enter 저장은 질문 칸만, 일본어·한국어 조합 중(isComposing)이면 무시 · 자동 초점은 afterCommit 뒤', () => {
  const sf = parseCode(join(chatDir, 'ChatRenameForm.tsx'))
  const key = declOf(sf, 'onKey')
  assert.ok(key, 'onKey')
  assert.match(key.getText(), /e\.key !== 'Enter' \|\| e\.nativeEvent\.isComposing/)
  assert.match(readCode(join(chatDir, 'ChatRenameForm.tsx')), /onKeyDown=\{ask \? onKey : undefined\}|onKeyDown=\{onKey\}/)
  assert.ok(calls(sf, (c) => c === 'requestAnimationFrame' || c === 'window.requestAnimationFrame').length >= 1, '초점은 다음 프레임 뒤(Sheet 가 제목에 주는 초점에 씻기지 않게)')
})

test('T17 ChatMenuSheet startMode — 기본 menu(지금), rename 으로 열면 [취소] = 시트 닫기(메뉴로 안 감), 연 순간 startMode 로 맞춤', () => {
  assert.equal(renameCancelTarget('rename'), 'close')
  assert.equal(renameCancelTarget('menu'), 'menu') // 기본값을 rename 으로 바꾸면 실패
  assert.equal(renameCancelTarget(undefined), 'menu')
  const m = readCode(join(chatDir, 'ChatMenuSheet.tsx'))
  assert.match(m, /startMode = 'menu',/)
  assert.match(m, /if \(open !== seenOpen\) \{\s*setSeenOpen\(open\)\s*if \(open\) \{\s*setMode\(startMode\)/)
  assert.match(m, /<ChatRenameForm\b[^>]*variant=\{ask \? 'ask' : 'default'\}/)
  assert.match(m, /dismissible=\{!busy && !renameBusy\}/)
  assert.ok(!m.includes('id="chatRename"'), '칸은 ChatRenameForm 한 곳')
  // 회화·채팅 화면은 새 prop 을 넘기지 않는다(지금 동작)
  for (const f of ['talk/TalkRoom.tsx', 'chat/ChatRoom.tsx']) assert.ok(!readCode(join(chatDir, '..', f)).includes('startMode'), f)
})

// REV-067B-1·2·5 — 칸의 상태 전이를 순수 함수로 빼서 잠근다(DOM 시험 도구 없음). 변이: 각 줄 끝 주석.

const formSource = () => parseCode(join(chatDir, 'ChatRenameForm.tsx'))

test('T15 입력하면 오류가 사라진다(질문) — 빈 값/초과 안내는 지우고, 저장 실패는 남기고, 회화·채팅(default)은 그대로 [REV-067B-1]', () => {
  const empty = { error: ASK_COPY.rename.empty, invalid: true }
  const over = { error: ASK_COPY.rename.over, invalid: true }
  const fail = { error: ASK_COPY.rename.fail, invalid: false }
  const none = { error: null, invalid: false }
  assert.deepEqual(renameErrorAfterInput('ask', empty), none) // 오류를 안 지우면 실패
  assert.deepEqual(renameErrorAfterInput('ask', over), none)
  assert.deepEqual(renameErrorAfterInput('ask', fail), fail, '저장 실패 문구는 입력해도 남는다(승인 데모)')
  assert.deepEqual(renameErrorAfterInput('ask', none), none)
  assert.deepEqual(renameErrorAfterInput('default', { error: '제목을 적어 주세요', invalid: true }), { error: '제목을 적어 주세요', invalid: true }, '회화·채팅은 옮기기 전처럼 그대로(T16)')
  // 칸의 onChange 가 이 전이를 실제로 쓴다
  const sf = formSource()
  const onInput = declOf(sf, 'onInput')
  assert.ok(onInput, 'onInput')
  const t = onInput.getText()
  assert.match(t, /setValue\(v\)/)
  assert.match(t, /renameErrorAfterInput\(variant, \{ error, invalid \}\)/)
  assert.match(t, /setError\(next\.error\)[^]*setInvalid\(next\.invalid\)/)
  assert.match(readCode(join(chatDir, 'ChatRenameForm.tsx')), /onChange=\{onInput\}/) // setValue 를 바로 넘기면 실패
})

test('T15 저장 중 두 번째 저장은 요청을 만들지 않는다(이중 제출 가드) — 쉬는 중 1회·저장 중 0회, 둘 다 default·ask [REV-067B-5]', async () => {
  for (const variant of ['default', 'ask'] as const) {
    const sent: unknown[] = []
    const patch = async (url: string, body: unknown) => {
      sent.push([url, body])
      return {}
    }
    let started = 0
    const o = { chatId: 'c1', value: '제목', variant, patch, onStart: () => started++ }
    assert.equal(await saveRenameUnlessBusy(true, o), null) // 가드를 지우면 실패
    assert.equal(sent.length, 0, `${variant}: 저장 중이면 요청 0`)
    assert.equal(started, 0, `${variant}: 저장 중이면 시작 표시도 안 한다`)
    assert.deepEqual(await saveRenameUnlessBusy(false, o), { ok: true, title: '제목' })
    assert.equal(sent.length, 1, `${variant}: 쉬는 중이면 요청 1`)
  }
  // 칸의 저장이 지금 저장 중 여부(busy)를 가드에 넘긴다
  const save = declOf(formSource(), 'save')
  assert.ok(save, 'save')
  const guard = calls(save, (c) => c === 'saveRenameUnlessBusy')
  assert.equal(guard.length, 1)
  assert.equal(guard[0].arguments[0]?.getText(), 'busy', '항상 false 를 넘기면 가드가 죽는다')
  assert.equal(calls(save, (c) => c === 'saveRename').length, 0, '가드 없이 saveRename 을 바로 부르면 실패')
})

test('T17 [취소] — 회화·채팅(default)은 저장 중에도 먹는다(옛 ChatMenuSheet: 메뉴로 돌아감), 질문(ask)만 저장 중엔 안 먹는다 [REV-067B-2]', () => {
  assert.equal(renameCancelAllowed('default', true), true) // 저장 중 취소를 막으면(회화·채팅 동작이 바뀌면) 실패
  assert.equal(renameCancelAllowed('default', false), true)
  assert.equal(renameCancelAllowed('ask', true), false)
  assert.equal(renameCancelAllowed('ask', false), true)
  // 칸의 [취소] 가 이 결정을 실제로 쓴다
  assert.match(readCode(join(chatDir, 'ChatRenameForm.tsx')), /onCancel=\{\(\) => \{\s*if \(renameCancelAllowed\(variant, busy\)\) onCancel\(\)\s*\}\}/)
})
