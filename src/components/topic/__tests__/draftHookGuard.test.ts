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

// T5-3b: 저장이 「#57 → #163 순차」(`logic.runTopicCreateSave`)로 바뀌어 성공 마무리는 `finishSaved` 한 곳이 한다(저장 성공·`partial` 의 [주제 보기로] 공용).
// 그래서 시험 구간을 `finishSaved` 본문으로 옮기고, 저장 성공 분기가 그것을 부르는지 따로 본다.
const saveOk = between(hook, 'const finishSaved = useCallback(', '[closeStore, router],')

test('M-3 ① 저장 성공 직후 이 탭 보관을 닫고(closeStore), 닫은 뒤에는 어떤 쓰기도 일어나지 않는다', () => {
  const close = saveOk.indexOf('closeStore()')
  assert.ok(close >= 0, '저장 성공 분기에 closeStore() 가 없다 — 초안이 sessionStorage 에 남는다')
  assert.ok(close < saveOk.indexOf('router.replace('), '이동하기 전에 지운다')
  const saveFn = between(hook, 'const save = useCallback(', 'const goToTopic = useCallback(')
  assert.match(saveFn, /if \(r\.kind === 'done'\) \{\s*finishSaved\(r\.topicId, r\.title, r\.saved\)\s*return/, '전부 저장되면 finishSaved 로 마무리')
  assert.ok(!/closeStore\(\)|router\./.test(saveFn), '저장 함수는 보관을 직접 닫거나 이동하지 않는다(partial·실패는 화면에 남는다)')
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
  // T5-3b 가 의도적으로 더한 칸: scenarios(상황 초안 본문·체크·저장된 상황 id) · savedTopicId(주제를 두 번 만들지 않게) · scAsked(자동 요청을 다시 보내지 않게).
  // 셋 다 초안 본문·id·참거짓뿐이고 실패 문구·서버 message 가 아니다(모양은 `logic.storedScenarioPart` 가 읽을 때 다시 검사).
  const snapKeys = /snapRef\.current = restore \? null : \{ ([^}]*) \}/.exec(hook)?.[1].split(',').map((k) => k.trim())
  assert.deepEqual(snapKeys, ['userId', 'ask', 'draft', 'warnings', 'arrivalTitle', 'edited', 'scenarios', 'savedTopicId', 'scAsked'])
  // 곧바로 보관(keepNow)은 저장 표시 두 칸만 덮어쓰고 같은 flush 경로를 쓴다(새 쓰기 자리 없음).
  const keepNow = between(hook, 'const keepNow = useCallback(', '[flush],')
  assert.match(keepNow, /patch: Partial<Pick<StoredTopicDraft, 'scenarios' \| 'savedTopicId'>>/)
  assert.match(keepNow, /flush\(\)/)
  // 토스트용 값은 종류·제목·함께 저장한 상황 수뿐
  const flash = /const flash: ManageFlash = \{ ([^\n]*) \}\s*$/m.exec(saveOk)?.[1] ?? ''
  assert.match(flash, /^kind: 'created', title, scenarios: saved$/)
  // 서버 message·실패 문구는 어떤 쓰기에도 나오지 않는다
  for (const c of calls) assert.ok(!/message|failure|saveMessage|genFailure|askError|\.text/.test(c), `쓰기 인자에 실패 문구 후보: ${c}`)
})

// ── M-3 ④ 취소 ─────────────────────────────────────────────────────────────

test('M-3 ④ 그만두기(취소) 뒤에는 입력·초안·보관을 건드리지 않고 안내만 켠다', () => {
  // T5-3b: 의존 배열에 자동 상황 초안(autoScenario)이 더해져 끝 표지를 접두로 맞췄다.
  const onDone = between(hook, 'const onDone = useCallback(', '[arrive, requestFocus, autoScenario]')
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

// ── T5-3b-fix (REV-164) 소스 가드 ──────────────────────────────────────────

test('REV-164 L-5 ① 저장 표시는 곧바로 보관한다 — 주제 저장·상황 저장 성공 직후 keepNow 가 불리고, 그 뒤 디바운스(300ms)에 기대지 않는다', () => {
  const onTopic = between(hook, 'const onTopicSaved = useCallback(', 'const onScenarioSaved = useCallback(')
  assert.match(onTopic, /savedTopicRef\.current = id\s*setSavedTopicId\(id\)\s*keepNow\(\{ savedTopicId: id \}\)/, '#57 성공 직후 주제 id 를 곧바로 보관(새로 고침이 300ms 안에 와도 주제를 두 번 만들지 않는다)')
  const onScenario = between(hook, 'const onScenarioSaved = useCallback(', 'const save = useCallback(')
  assert.match(onScenario, /setScenarios\(next\)\s*keepNow\(\{ scenarios: next \}\)/, '#163 성공마다 저장된 상황 id 를 곧바로 보관')
  const keepNow = between(hook, 'const keepNow = useCallback(', '[flush],')
  assert.match(keepNow, /snapRef\.current = \{ \.\.\.snapRef\.current, \.\.\.patch \}\s*flush\(\)/, '값을 덮어쓴 뒤 같은 flush 경로로 즉시 쓴다')
  // 저장 흐름이 이 두 훅을 실제로 넘긴다(넘기지 않으면 위 보관은 불리지 않는다)
  const saveFn = between(hook, 'const save = useCallback(', 'const goToTopic = useCallback(')
  assert.match(saveFn, /\{ onTopicSaved, onScenarioSaved, onProgress: setProgress \}/)
})

test('REV-164 L-5 ② 저장 더블 탭 가드 — 저장은 saveGuard.run 안에서만 요청을 보낸다(훅이 가드를 실제로 쓴다)', () => {
  assert.match(hook, /const \[saveGuard\] = useState\(createOnceGuard\)/, '가드는 화면 수명 동안 하나')
  const saveFn = between(hook, 'const save = useCallback(', 'const goToTopic = useCallback(')
  const run = saveFn.indexOf('saveGuard.run(async () => {')
  assert.ok(run >= 0, 'saveGuard.run 래퍼가 없다 — 더블 탭이 #57 을 두 번 보낼 수 있다')
  assert.ok(saveFn.indexOf('runTopicCreateSave(') > run, '요청은 가드 안쪽에서만')
  assert.ok(!saveFn.slice(0, run).includes('runTopicCreateSave('), '가드 밖에서 요청하지 않는다')
  assert.equal([...saveFn.matchAll(/runTopicCreateSave\(/g)].length, 1, '저장 요청 경로는 하나')
})

test('REV-164 L-1 저장 중에는 ← 가 막힌다 — 화면이 onBack 에서 되돌리고 BackBar 는 aria-disabled·누름 무시', () => {
  const screen = read(TOPIC_DIR, 'TopicCreateScreen.tsx')
  const onBack = between(screen, 'const onBack = () => {', 'const k = m.pick.k')
  assert.match(onBack, /^const onBack = \(\) => \{\s*if \(saving\) return/, '저장 중이면 아무것도 하지 않는다(나가기 시트도 열지 않는다)')
  assert.match(screen, /const saving = m\.stage === 'saving'/)
  assert.match(screen, /onBack=\{onBack\}\s*backDisabled=\{saving\}/, 'BackBar 에 저장 중임을 알린다')
  const bar = read(TOPIC_DIR, '..', 'shell', 'BackBar.tsx')
  assert.match(bar, /onClick=\{\(\) => !backDisabled && onBack\(\)\}/, '비활성이면 누름을 무시')
  assert.match(bar, /aria-disabled=\{backDisabled \|\| undefined\}/, '보조 기술에 비활성을 알린다')
  assert.match(bar, /backDisabled = false/, '기본은 막지 않는다(다른 화면 동작 그대로)')
})

test('REV-164 L-3 상황 카드 체크는 상황 제목이 든 접근성 이름을 가진다 · 보이는 label 글은 그대로', () => {
  const cards = read(TOPIC_DIR, 'ScenarioDraftCards.tsx')
  const input = between(cards, '<input\n', '/>')
  assert.match(input, /id=\{ck\}[\s\S]*type="checkbox"[\s\S]*aria-label=\{scenarioKeepName\(index, title\)\}/, '체크 이름 = 순번 + 제목 + 「이 상황도 저장」')
  assert.match(cards, /slots\.map\(\(s, i\) => \(\s*<ScenarioCard key=\{s\.key\} index=\{i \+ 1\}/, '카드 순번은 목록 위치(1부터)')
  assert.match(cards, /<label htmlFor=\{ck\}[^>]*>[\s\S]*<span className="break-keep">\{SCDRAFT\.keep\}<\/span>/, '보이는 글은 그대로')
})

test('REV-164 L-4 저장 안내 줄은 고른 상황이 없어도 사라지지 않는다 — 두 글을 같은 칸에 겹쳐 그려 줄 높이가 한 번도 바뀌지 않는다', () => {
  const review = read(TOPIC_DIR, 'TopicDraftReview.tsx')
  assert.match(review, /saveNote\?: \{ on: string; off: string; active: boolean \} \| null/)
  assert.match(review, /<p className="grid [^"]*\[&>\*\]:col-start-1 \[&>\*\]:row-start-1">\s*<span className=\{saveNote\.active \? '' : 'invisible'\}>\{saveNote\.on\}<\/span>\s*<span className=\{saveNote\.active \? 'invisible' : ''\}>\{saveNote\.off\}<\/span>/)
  const screen = read(TOPIC_DIR, 'TopicCreateScreen.tsx')
  assert.match(screen, /saveNote=\{\{ on: REVIEW\.saveOrder, off: REVIEW\.saveIdle, active: saveNoteActive\(k, m\.scFlight\.busy\) \}\}/, 'k=0 이어도 null 로 줄을 없애지 않고, 만드는 중에는 on')
  assert.ok(!/saveNote=\{k > 0/.test(screen))
})

test('REV-166 L-D S7 주제 고치기도 저장 중 ← 를 막는다 — BackBar backDisabled + onBack 즉시 반환', () => {
  const screen = read(TOPIC_DIR, 'TopicEditScreen.tsx')
  assert.match(screen, /<BackBar[^>]*onBack=\{m\.status === 'ready' \? onBack : undefined\}[^>]*backDisabled=\{m\.saving\}/, '저장 중 ← 비활성')
  const onBack = between(screen, 'const onBack = () => {', 'const seed =')
  assert.match(onBack, /editBackAction\(m\.edited, m\.saving\)/)
  assert.match(onBack, /if \(act === 'ignore'\) return/, '저장 중이면 아무것도 하지 않는다(시트도 이동도 없음)')
})
