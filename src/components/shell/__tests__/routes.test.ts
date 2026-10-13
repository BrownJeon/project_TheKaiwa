import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FOCUS_ROUTE_PREFIXES, isFocusRoute } from '../routes'

// task-045 T5-1(REV-159 M-2): 「내 상황·주제」 관리 화면은 집중 화면이라 하단 탭·권장 업데이트 띠가 숨는다.
// 접두어를 지우면 관리 화면 아래에 하단 탭이 다시 나오는데 다른 시험은 이를 잡지 못했다(변이 확인).
test('/settings/scenarios 접두어 — 관리 화면과 그 하위 경로는 집중 화면, /settings 자체는 아님', () => {
  assert.ok(FOCUS_ROUTE_PREFIXES.includes('/settings/scenarios'))
  assert.ok(isFocusRoute('/settings/scenarios'))
  assert.ok(isFocusRoute('/settings/scenarios/topics/x'))
  assert.ok(isFocusRoute('/settings/scenarios/topics/new'))
  assert.ok(!isFocusRoute('/settings'))
  assert.ok(!isFocusRoute('/settings/utterances'))
})

// task-067 §27-7 C(T21): 지난 질문도 탭 화면 `/ask?chat=<id>` 에서 열고 옛 `/ask/<id>` 는 서버 리다이렉트뿐 — 질문 주소는 집중 화면이 아니다
// (남겨 두면 리다이렉트 순간 하단 탭이 깜빡 숨는다). 다른 집중 화면은 그대로.
test('질문 주소는 집중 화면 아님 — /ask · /ask?chat= · 옛 /ask/<id> 모두 하단 탭 보임, 다른 집중 화면 그대로', () => {
  assert.ok(!FOCUS_ROUTE_PREFIXES.some((p) => p.startsWith('/ask')))
  assert.ok(!isFocusRoute('/ask'))
  assert.ok(!isFocusRoute('/ask/abc'))
  assert.ok(isFocusRoute('/study/ai/chat/x') && isFocusRoute('/study/ai/talk/x') && isFocusRoute('/plan/challenge/x'))
})
