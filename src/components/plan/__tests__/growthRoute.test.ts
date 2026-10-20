import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// task-080 라우트(screens.md §36-2): `/plan/growth` 는 `(tab)` 그룹의 형제 — 안에 두면 `(tab)/loading.tsx`(달력 자리표시)가 먼저 뜬다.
const app = join(__dirname, '..', '..', '..', 'app', '(app)', 'plan')
const read = (...p: string[]) => readFileSync(join(app, ...p), 'utf8')

test('plan/growth/ 아래에는 page·loading 두 파일뿐(하위 경로로 loading 이 새지 않는다), (tab) 안에 growth 없음, plan/loading.tsx 없음 유지', () => {
  assert.deepEqual(readdirSync(join(app, 'growth')).sort(), ['loading.tsx', 'page.tsx'])
  assert.ok(!existsSync(join(app, '(tab)', 'growth')))
  assert.ok(!existsSync(join(app, 'loading.tsx')), 'plan 바로 아래 loading.tsx 는 챌린지·성장 진입에도 뜬다')
  assert.ok(existsSync(join(app, '(tab)', 'loading.tsx')))
})

test('page — 세션 없으면 로그인(돌아올 주소 /plan/growth) · 앱바 «계획표» · Suspense 안 GrowthScreen · 문서 제목 «성장 · 계획표»', () => {
  const page = read('growth', 'page.tsx')
  assert.match(page, /const session = await auth\(\)\s+if \(!session\) redirect\(`\/login\?callbackUrl=\$\{encodeURIComponent\('\/plan\/growth'\)\}`\)/)
  assert.match(page, /<AppBar title="계획표" \/>\s+<Suspense fallback=\{null\}>\s+<GrowthScreen today=\{todayKst\(\)\} \/>\s+<\/Suspense>/)
  assert.match(page, /export const metadata = \{ title: GROWTH\.docTitle \}/)
  assert.match(read('growth', 'loading.tsx'), /return <GrowthSkeleton \/>/)
})
