import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decideAppUpdate, safeDownloadUrl, type AppVersionResponse } from '../useAppUpdate'
import { isFocusRoute } from '../routes'
import { publishedLabel } from '../appUpdateCopy'

const ORIGIN = 'https://kaiwa.test'
const info = (o: Partial<AppVersionResponse> = {}): AppVersionResponse => ({
  latest: '1.1.0',
  latestCode: 2,
  minSupportedCode: 1,
  url: 'https://kaiwa.test/app/download/latest.apk',
  notes: '휴대폰 인식 개선',
  bytes: 31_000_000,
  publishedAt: '2026-09-28T00:00:00.000Z',
  ...o,
})
const mine = { name: '1.0.0', code: 1 }

test('#8 판정: 번호로만 — 최신·권장·강제, #8 실패·앱 버전 모름은 hidden', () => {
  assert.equal(decideAppUpdate(mine, info({ latestCode: 1, latest: '1.0.0' }), null, '2026-09-28', ORIGIN).state, 'hidden')
  assert.equal(decideAppUpdate(mine, info(), null, '2026-09-28', ORIGIN).state, 'recommended')
  assert.equal(decideAppUpdate(mine, info({ minSupportedCode: 2 }), null, '2026-09-28', ORIGIN).state, 'forced')
  assert.equal(decideAppUpdate({ name: '1.10.0', code: 10 }, info({ latest: '1.9.0', latestCode: 9 }), null, '2026-09-28', ORIGIN).state, 'hidden', '이름 문자열 비교 오판 없음')
  assert.equal(decideAppUpdate(mine, null, null, '2026-09-28', ORIGIN).state, 'hidden', '#8 실패는 조용히')
  assert.equal(decideAppUpdate(null, info(), null, '2026-09-28', ORIGIN).state, 'hidden', '웹(getAppInfo 없음)')
  assert.equal(decideAppUpdate(mine, info({ latest: null, latestCode: null }), null, '2026-09-28', ORIGIN).state, 'hidden', 'AppRelease 행 없음')
})

test('권장 띠 닫기: 그날(KST)만, 더 새 번호가 나오면 다시 · 강제는 닫기 기록과 무관', () => {
  const today = '2026-09-28'
  assert.equal(decideAppUpdate(mine, info(), { code: 2, day: today }, today, ORIGIN).dismissedToday, true)
  assert.equal(decideAppUpdate(mine, info(), { code: 2, day: '2026-09-27' }, today, ORIGIN).dismissedToday, false, '다음 날 다시')
  assert.equal(decideAppUpdate(mine, info({ latestCode: 3 }), { code: 2, day: today }, today, ORIGIN).dismissedToday, false, '새 번호면 다시')
  const forced = decideAppUpdate(mine, info({ minSupportedCode: 2 }), { code: 2, day: today }, today, ORIGIN)
  assert.equal(forced.state, 'forced', '띠 표시 여부는 화면이 state 로 판단(강제는 늘)')
})

test('받기 주소는 같은 출처 /app/download/ 만, 크기·바뀐 점', () => {
  assert.equal(safeDownloadUrl('https://kaiwa.test/app/download/latest.apk', ORIGIN), 'https://kaiwa.test/app/download/latest.apk')
  assert.equal(safeDownloadUrl('https://evil.test/app/download/latest.apk', ORIGIN), 'https://kaiwa.test/app/download/latest.apk')
  assert.equal(safeDownloadUrl('/app/other', ORIGIN), 'https://kaiwa.test/app/download/latest.apk')
  assert.equal(safeDownloadUrl('javascript:alert(1)', ORIGIN), 'https://kaiwa.test/app/download/latest.apk')
  assert.equal(safeDownloadUrl(null, 'http://localhost:3011'), 'http://localhost:3011/app/download/latest.apk')
  const s = decideAppUpdate(mine, info({ notes: '   ', bytes: 0 }), null, '2026-09-28', ORIGIN)
  assert.equal(s.latest?.notes, null)
  assert.equal(s.latest?.bytes, null)
  assert.equal(publishedLabel('2026-09-27T16:00:00.000Z'), '9월 28일', 'KST 날짜')
  assert.equal(publishedLabel('nope'), null)
})

test('집중 화면(권장 띠·탭 숨김)', () => {
  assert.ok(isFocusRoute('/study/ai/talk/c1'))
  assert.ok(isFocusRoute('/study/ai/chat/c1'))
  assert.ok(isFocusRoute('/study/today/words/s1'))
  assert.ok(isFocusRoute('/study/today/talk/new'), 'task-010 오늘의 회화 — 주제·붙여넣기·수업은 집중 화면')
  assert.ok(isFocusRoute('/study/today/talk/ls1'))
  assert.ok(!isFocusRoute('/study/today'))
  assert.ok(!isFocusRoute('/study/ai'))
  assert.ok(!isFocusRoute('/settings'))
})
