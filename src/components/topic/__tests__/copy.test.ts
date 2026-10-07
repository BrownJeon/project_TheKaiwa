import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FAIL, MANAGE } from '../topicCopy'

// task-045 T5-1(REV-159 M-1·L-1·L-4). 서버 판정 규칙 정본: `detectUnsafeTopicText`(숨은·제어 글자 → 꺾쇠 → 링크 주소 → 비밀 모양),
// `isSecretLikeText`(키 접두어·Bearer·JWT·`password=`·긴 영문·숫자 토큰), `hasCardLikeDigits`(카드 번호 모양 13자리↑).
test('forbidden_char 문구 — 서버가 이 reason 으로 묶는 세 원인(꺾쇠·링크 주소·숨은 글자)을 모두 말한다', () => {
  assert.equal(FAIL.field.forbiddenChar, '꺾쇠(< >)·링크 주소·눈에 보이지 않는 글자는 쓸 수 없어요.')
})

test('secret_like 문구 — 비밀번호·카드 번호·긴 영문 숫자 키(초안 경로의 긴 토큰)를 말한다', () => {
  assert.equal(FAIL.field.secretLike, '비밀번호·카드 번호·긴 영문 숫자 키처럼 보이는 글은 쓸 수 없어요.')
})

test('같은 화면의 두 radiogroup 이름(분절·상황 칩)은 비어 있지 않고 서로 다르다', () => {
  assert.equal(MANAGE.tabsAria, '관리 대상')
  assert.equal(MANAGE.filterAria, '상황 보기 범위')
  assert.ok(MANAGE.tabsAria.trim() && MANAGE.filterAria.trim())
  assert.notEqual(MANAGE.tabsAria, MANAGE.filterAria)
})
