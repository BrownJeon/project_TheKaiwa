import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// task-045 T5-3a-fix(REV-162 M-2·M-3): 훅(`useTopicDraft.ts`)·화면은 DOM 없이 돌릴 수 없어, 요구 동작이 코드에 남아 있는지 소스 문자열로 고정한다
// (`scrollGuard.test.ts`·`removalA11y.test.ts` 와 같은 방식). 규칙을 설명하는 주석은 제외하고 본다. 실제 동작(초점·sessionStorage 수명·44px 실측)은 QA.
const TOPIC_DIR = join(__dirname, '..')
const SETTINGS_DIR = join(__dirname, '..', '..', '..', 'app', '(app)', 'settings')
const NEW_PAGE = join(__dirname, '..', '..', '..', 'app', '(app)', 'settings', 'scenarios', 'topics', 'new', 'page.tsx')

const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
const read = (...p: string[]) => strip(readFileSync(join(...p), 'utf8'))
const hook = read(TOPIC_DIR, 'useTopicDraft.ts')

/** `start` 가 처음 나오는 곳부터 `end` 가 처음 나오는 곳 앞까지. 못 찾으면 시험이 실패한다(코드가 크게 바뀌어 가드를 다시 맞춰야 한다는 뜻). */
function between(src: string, start: string | RegExp, end: string | RegExp): string {
  const a = typeof start === 'string' ? src.indexOf(start) : src.search(start)
  assert.ok(a >= 0, `찾지 못함: ${String(start)}`)
  const rest = src.slice(a)
  const b = typeof end === 'string' ? rest.indexOf(end, 1) : rest.slice(1).search(end) + 1
  assert.ok(b > 0, `끝을 찾지 못함: ${String(end)}`)
  return rest.slice(0, b)
}

// ── M-3 ① 저장 성공 → 보관 삭제 ────────────────────────────────────────────

const saveOk = between(hook, 'const res = await createTopic(', '} catch (e) {')

test('M-3 ① 저장 성공 직후 이 탭 보관을 닫고(closeStore), 닫은 뒤에는 어떤 쓰기도 일어나지 않는다', () => {
  const close = saveOk.indexOf('closeStore()')
  assert.ok(close >= 0, '저장 성공 분기에 closeStore() 가 없다 — 초안이 sessionStorage 에 남는다')
  assert.ok(close < saveOk.indexOf('router.replace('), '이동하기 전에 지운다')
  const closeFn = between(hook, 'const closeStore = useCallback(', '}, [])')
  assert.match(closeFn, /storeClosed\.current = true/, '닫힘 표시')
  assert.match(closeFn, /writeStore\('session', TOPIC_DRAFT_STORE_KEY, null\)/, '키 삭제')
  const flushFn = between(hook, 'const flush = useCallback(', '}, [])')
  assert.match(flushFn, /^const flush = useCallback\(\(\) => \{\s*const snap = snapRef\.current\s*if \(storeClosed\.current \|\| !snap\) return\s*writeStore/, '닫힌 뒤(저장·버리기)에는 flush 가 아무것도 쓰지 않는다')
  const discardFn = between(hook, 'const discard = useCallback(', '}, [closeStore')
  assert.match(discardFn, /closeStore\(\)/, '버리기도 보관을 닫는다')
})

// ── M-3 ② R5 스크롤 ────────────────────────────────────────────────────────

test('M-3 ② 저장 성공의 router.replace 만 { scroll: false } — 나가기·버리기는 기본 스크롤(맨 위)', () => {
  const calls = [...saveOk.matchAll(/router\.replace\(([^\n]*)\)\s*$/gm)].map((m) => m[1])
  assert.equal(calls.length, 1, '저장 성공에서 이동은 한 곳')
  assert.match(calls[0], /topicHref\(id\)/)
  assert.match(calls[0], /\{\s*scroll:\s*false\s*\}/, '새 주제 보기로 이동할 때 { scroll: false }')
  const leaveFn = between(hook, 'const leave = useCallback(', 'const discard = useCallback(')
  assert.match(leaveFn, /router\.push\(MANAGE_HREF\)/)
  assert.ok(!/scroll:\s*false/.test(leaveFn), '나가기는 기본 스크롤')
  const discardFn = between(hook, 'const discard = useCallback(', 'return {')
  assert.match(discardFn, /router\.replace\(MANAGE_HREF\)/)
  assert.ok(!/scroll:\s*false/.test(discardFn), '버리기는 기본 스크롤')
})

// ── M-3 ③ 보관 값 ─────────────────────────────────────────────────────────

test('M-3 ③ sessionStorage 에 쓰는 곳은 다섯 곳뿐(세 가지 형태)이고 값은 초안 본문·입력값뿐 — 실패 문구·서버 message 를 저장하지 않는다', () => {
  const calls = [...hook.matchAll(/writeStore\('session',[^\n]*\)\s*$/gm)].map((m) => m[0].trim())
  const allowed = [
    // 읽을 때 남의 값·손상 값 지우기(M-1)
    "writeStore('session', TOPIC_DRAFT_STORE_KEY, null)",
    // 자동 보관
    "writeStore('session', TOPIC_DRAFT_STORE_KEY, isBlankTopicStore(snap) ? null : serializeTopicStore({ ...snap, savedAt: Date.now() }))",
    // 저장 성공 토스트용 1회 값(제목뿐)
    "writeStore('session', MANAGE_FLASH_KEY, JSON.stringify(flash))",
  ]
  assert.equal(calls.length, 5, `쓰는 곳: 읽을 때 지우기 1 + 자동 보관 1 + closeStore 1 + dropRestore 1 + 토스트 1 — ${calls.join(' | ')}`)
  for (const c of calls) assert.ok(allowed.includes(c), `허용하지 않는 sessionStorage 쓰기: ${c}`)
  // 자동 보관 값(snap)의 칸 — 새 칸(실패 문구 등)이 들어오면 이 목록을 보고 사람이 판단하게 한다.
  const snapKeys = /snapRef\.current = restore \? null : \{ ([^}]*) \}/.exec(hook)?.[1].split(',').map((k) => k.trim())
  assert.deepEqual(snapKeys, ['userId', 'ask', 'draft', 'warnings', 'arrivalTitle', 'edited'])
  // 토스트용 값은 종류와 제목뿐
  const flash = /const flash: ManageFlash = \{ ([^\n]*) \}\s*$/m.exec(saveOk)?.[1] ?? ''
  assert.match(flash, /^kind: 'created', title: typeof res\?\.topic\?\.title === 'string' \? res\.topic\.title : d\.title$/)
  // 서버 message·실패 문구는 어떤 쓰기에도 나오지 않는다
  for (const c of calls) assert.ok(!/message|failure|saveMessage|genFailure|askError|\.text/.test(c), `쓰기 인자에 실패 문구 후보: ${c}`)
})

// ── M-3 ④ 취소 ─────────────────────────────────────────────────────────────

test('M-3 ④ 그만두기(취소) 뒤에는 입력·초안·보관을 건드리지 않고 안내만 켠다', () => {
  const onDone = between(hook, 'const onDone = useCallback(', '[arrive, requestFocus]')
  const canceled = between(onDone, "if (o.kind === 'canceled') {", 'const f = o.failure')
  assert.match(canceled, /if \(!hasDraft\) setCanceled\(true\)/, '안내는 초안이 없을 때만')
  assert.ok(!/setAskState|setAsk\(|setDraftState|setDraft\(|setRestore|writeStore|closeStore|dropRestore|setEdited|setWarn/.test(canceled), `취소 분기가 입력·초안·보관을 건드린다:\n${canceled}`)
  assert.match(hook, /const cancelGenerate = useCallback\(\(\) => flightCtl\.cancel\(\), \[flightCtl\]\)/, '그만두기는 요청 취소뿐')
})

// ── M-3 ⑤ 이어 고치기 중 덮어쓰기 ────────────────────────────────────────────

test('M-3 ⑤ 이어 고칠지 묻는 동안(restore)은 보관을 덮어쓰지 않고, 고르면(이어서/버리기) 그때부터 규칙이 바뀐다', () => {
  const effect = between(hook, 'snapRef.current = restore ? null :', '}, [restore, userId')
  assert.match(effect, /if \(restore \|\| storeClosed\.current\) return\s*const t = setTimeout\(flush, SAVE_DEBOUNCE_MS\)/, '묻는 동안·닫힌 뒤에는 디바운스 쓰기를 예약하지 않는다')
  // 이어서 고치기: 초안을 상태로 옮기면서(arrive) restore 를 비운다 — 그 뒤부터 같은 키에 다시 쓴다.
  const arrive = between(hook, 'const arrive = useCallback(', 'const onDone = useCallback(')
  assert.match(arrive, /setRestore\(null\)/)
  const accept = between(hook, 'const acceptRestore = useCallback(', 'const dropRestore = useCallback(')
  assert.match(accept, /arrive\(restore\.draft, restore\.warnings/)
  // 버리기: 키를 지우고 restore 를 비운다.
  const drop = between(hook, 'const dropRestore = useCallback(', 'const problems = useMemo(')
  assert.match(drop, /writeStore\('session', TOPIC_DRAFT_STORE_KEY, null\)[\s\S]*setRestore\(null\)/)
  // 언마운트 flush 도 같은 규칙(snap 이 null 이면 아무것도 안 쓴다)을 지난다.
  assert.match(hook, /return \(\) => clearTimeout\(t\)/)
  assert.match(hook, /flightCtl\.dispose\(\)\s*flush\(\)/)
})

// ── M-1 주인 확인 ─────────────────────────────────────────────────────────

test('M-1 읽을 때 주인을 확인해 남의 값은 지운다 · 화면은 userId 를 그리지 않는다 · 로그아웃이 이 키를 지운다', () => {
  assert.match(hook, /export function useTopicDraft\(defaultLevel: DraftLevel, userId: string\)/)
  const init = between(hook, 'const [stored] = useState', 'const [restore, setRestore]')
  assert.match(init, /readTopicStore\(readStore\('session', TOPIC_DRAFT_STORE_KEY\), userId\)/)
  assert.match(init, /if \(r\.discard\) writeStore\('session', TOPIC_DRAFT_STORE_KEY, null\)/)
  assert.match(init, /return r\.store/)
  assert.match(read(NEW_PAGE), /<TopicCreateScreen defaultLevel=\{draftLevelOf\(profile\.level\)\} userId=\{session\.user\.id\} \/>/, '서버가 내부 사용자 id 를 넘긴다')
  const screen = read(TOPIC_DIR, 'TopicCreateScreen.tsx')
  assert.match(screen, /useTopicDraft\(defaultLevel, userId\)/)
  const mentions = screen.split('\n').filter((l) => l.includes('userId'))
  assert.ok(mentions.length >= 3)
  for (const l of mentions) assert.match(l, /userId: string|userId=\{userId\}|useTopicDraft\(defaultLevel, userId\)|\{ defaultLevel, userId \}/, `userId 를 화면에 쓰면 안 된다: ${l}`)
  assert.ok(!/\$\{userId\}|>\s*\{userId\}\s*</.test(screen), '글로 그리지 않는다')
  const logout = read(SETTINGS_DIR, 'LogoutButton.client.tsx')
  const fin = between(logout, 'finally {', '}\n      }}')
  assert.match(fin, /writeStore\('session', TOPIC_DRAFT_STORE_KEY, null\)/, '로그아웃이 이 키를 지운다')
  assert.ok(fin.indexOf('writeStore(') < fin.indexOf("window.location.replace('/login')"), '이동하기 전에 지운다')
  assert.match(logout, /await fetch\('\/api\/auth\/logout', \{ method: 'POST' \}\)/, '기존 로그아웃 요청은 그대로')
})

// ── M-2 터치 44px ─────────────────────────────────────────────────────────

test('M-2 주제 만들기의 Btn size="sm"(38px)은 모두 min-h-11 로 44px 를 맞춘다 — 표현 더하기·바꾸기·취소·다시 만들기 확인 두 개', () => {
  const expected: Array<[string, number]> = [
    ['ChunkEditor.tsx', 3],
    ['TopicDraftReview.tsx', 2],
  ]
  for (const [file, count] of expected) {
    const src = read(TOPIC_DIR, file)
    const sm = [...src.matchAll(/<Btn\b[\s\S]*?<\/Btn>/g)].map((m) => m[0]).filter((b) => /size="sm"/.test(b))
    assert.equal(sm.length, count, `${file} 의 sm 버튼 수`)
    for (const b of sm) assert.match(b, /min-h-11/, `${file} sm 버튼에 min-h-11 필요:\n${b.slice(0, 120)}`)
  }
})
