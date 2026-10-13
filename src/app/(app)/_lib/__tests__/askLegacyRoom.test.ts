/**
 * task-067 D5 — 옛 `/ask/<id>` → `/ask?chat=<id>` 서버 리다이렉트. 목적지 계산은 순수 함수(`legacyAskRoomTarget`)로 시험하고,
 * 페이지 파일은 「그리지 않고 넘기기만, 대화를 읽지 않는다(존재 여부 비노출)」 구조를 고정한다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isAskId } from '@/components/ask/logic'
import { legacyAskRoomTarget } from '../askLegacyRoom'

function chatParam(href: string): string | null {
  const u = new URL(href, 'http://localhost')
  assert.equal(u.pathname, '/ask')
  return u.searchParams.get('chat')
}

test('/ask/abc → /ask?chat=abc · cuid 모양 id 도 그대로', () => {
  assert.equal(legacyAskRoomTarget('abc'), '/ask?chat=abc')
  const cuid = 'cmg8x2k1q0003ab12cd34ef56'
  assert.equal(legacyAskRoomTarget(cuid), `/ask?chat=${cuid}`)
  assert.equal(chatParam(legacyAskRoomTarget(cuid)), cuid)
  assert.equal(legacyAskRoomTarget('a_b-C9'), '/ask?chat=a_b-C9')
})

test('형식이 아닌 id 는 쿼리 없이 /ask(새 빈 대화) — 공백·경로 문자·인코딩·빈 값·64자 초과·문자열 아님', () => {
  const bad: unknown[] = [
    '', ' ', 'abc def', ' abc', 'abc ', '../x', 'a/b', '..', 'a?chat=b', 'a&x=1', 'a#b', '%2Fetc', 'abc%20', '<script>', '한글',
    'x'.repeat(65), undefined, null, 123, ['abc'], { id: 'abc' },
  ]
  for (const v of bad) assert.equal(legacyAskRoomTarget(v), '/ask', `값 ${JSON.stringify(v)}`)
  assert.equal(legacyAskRoomTarget('x'.repeat(64)), `/ask?chat=${'x'.repeat(64)}`)
})

test('탭이 ?chat= 을 읽는 규칙과 같다 — 넘긴 값은 탭의 isAskId 를 통과하고 그대로 돌아온다', () => {
  for (const id of ['abc', 'cmg8x2k1q0003ab12cd34ef56', 'Z-9_z']) {
    const back = chatParam(legacyAskRoomTarget(id))
    assert.equal(back, id)
    assert.ok(isAskId(back))
  }
})

test('페이지: 그리지 않고 redirect 만 · 대화·설정을 읽지 않는다(없는 id·남의 id 같은 응답) · 세션 없으면 로그인으로 새 주소를 들고 간다', () => {
  const src = readFileSync(join(__dirname, '..', '..', 'ask', '[chatId]', 'page.tsx'), 'utf8')
  const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')
  assert.ok(!/import AskRoom|<AskRoom|components\/ask\/AskRoom/.test(code), 'AskRoom 을 더는 그리지 않는다')
  assert.ok(!/<[A-Z]/.test(code), 'JSX 를 그리지 않는다')
  assert.ok(!/prisma|getProfile|getOwnedChat|getChatDetail|@\/modules\/(conversation|preferences)/.test(code), '대화·설정을 읽지 않는다')
  assert.match(code, /const target = legacyAskRoomTarget\(chatId\)/)
  assert.match(code, /if \(!session\) redirect\(`\/login\?callbackUrl=\$\{encodeURIComponent\(target\)\}`\)/)
  assert.match(code, /\n\s*redirect\(target\)\s*\n\}/)
  assert.ok(!/permanentRedirect/.test(code), '옛 주소를 영구(308)로 묶지 않는다')
})
