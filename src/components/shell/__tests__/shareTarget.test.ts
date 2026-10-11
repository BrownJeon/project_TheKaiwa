import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  decideShareAction,
  isShareCallback,
  SHARE_EVENT,
  SHARE_LOGIN_HREF,
  SHARE_LOGIN_NOTE,
  SHARE_PASTE_HREF,
  SHARE_PASTE_PATH,
} from '../shareTarget'

test('상수 — 주소에는 표시만, 문구는 데모 v1 그대로', () => {
  assert.equal(SHARE_PASTE_PATH, '/study/today/talk/new/paste')
  assert.equal(SHARE_PASTE_HREF, '/study/today/talk/new/paste?from=share')
  assert.equal(SHARE_LOGIN_HREF, '/login?callbackUrl=%2Fstudy%2Ftoday%2Ftalk%2Fnew%2Fpaste%3Ffrom%3Dshare')
  assert.equal(SHARE_EVENT, 'kaiwa:shared-text')
  assert.equal(SHARE_LOGIN_NOTE, '공유한 글은 로그인하면 붙여넣기 화면에 넣어 드려요.')
})

test('isShareCallback — 공유 붙여넣기 주소만 참', () => {
  assert.equal(isShareCallback(SHARE_PASTE_HREF), true)
  assert.equal(isShareCallback('/study/today/talk/new/paste?x=1&from=share'), true)
  assert.equal(isShareCallback('/study/today/talk/new/paste?from=%73hare'), true)
})

test('isShareCallback — 로그인 주소에 인코딩돼 실린 값을 한 번 풀어 읽은 것(searchParams 와 같음)', () => {
  const q = new URLSearchParams(SHARE_LOGIN_HREF.split('?')[1])
  assert.equal(isShareCallback(q.get('callbackUrl')), true)
  // 두 번 인코딩된 값은 경로가 달라 거짓(서버가 이미 한 번 풀어 준다).
  assert.equal(isShareCallback(encodeURIComponent(SHARE_PASTE_HREF)), false)
})

test('isShareCallback — 다른 경로·다른 표시·쓰레기 값·null 은 거짓', () => {
  assert.equal(isShareCallback(SHARE_PASTE_PATH), false)
  assert.equal(isShareCallback('/study/today/talk/new/paste?from=other'), false)
  assert.equal(isShareCallback('/study/today/talk/new/paste/?from=share'), false)
  assert.equal(isShareCallback('/study/today?from=share'), false)
  assert.equal(isShareCallback('/study/today'), false)
  assert.equal(isShareCallback(null), false)
  assert.equal(isShareCallback(undefined), false)
  assert.equal(isShareCallback(''), false)
  assert.equal(isShareCallback('http://[::1'), false)
  assert.equal(isShareCallback('::::'), false)
})

test('isShareCallback — 다른 출처(절대·프로토콜 상대 주소)는 거짓', () => {
  assert.equal(isShareCallback('https://evil.example/study/today/talk/new/paste?from=share'), false)
  assert.equal(isShareCallback('//evil.example/study/today/talk/new/paste?from=share'), false)
})

test('decideShareAction — 붙여넣기 화면', () => {
  assert.equal(decideShareAction(SHARE_PASTE_PATH, ''), 'signal')
  assert.equal(decideShareAction(SHARE_PASTE_PATH, '?from=other'), 'signal')
  assert.equal(decideShareAction(SHARE_PASTE_PATH, '?from=share'), 'stay')
})

test('decideShareAction — 초대코드 화면은 가입을 끊지 않는다', () => {
  assert.equal(decideShareAction('/invite', ''), 'stay')
  assert.equal(decideShareAction('/invite', '?code=abc'), 'stay')
})

test('decideShareAction — 로그인 화면: 이미 안내 중이면 그대로, 아니면 callbackUrl 을 바꾼다', () => {
  assert.equal(decideShareAction('/login', SHARE_LOGIN_HREF.slice('/login'.length)), 'stay')
  assert.equal(decideShareAction('/login', '?callbackUrl=%2Fstudy%2Ftoday'), 'login')
  assert.equal(decideShareAction('/login', ''), 'login')
  assert.equal(decideShareAction('/login', '?oauth_error=failed&callbackUrl=' + encodeURIComponent(SHARE_PASTE_HREF)), 'stay')
})

test('decideShareAction — 그 밖 어느 화면이든 이동', () => {
  for (const p of ['/', '/study/today', '/study/ai/c1', '/study/today/talk/new', '/admin', '/plan', '/settings']) {
    assert.equal(decideShareAction(p, ''), 'go', p)
  }
})
