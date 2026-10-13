import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import ts from 'typescript'
import { renderToStaticMarkup } from 'react-dom/server'
import { readCode } from '../../__tests__/sourceCode'
import { isFocusRoute } from '../../shell/routes'
import { composerPaddingBottom } from '../../chat/Composer'
import { ASK_COPY } from '../askCopy'
import ScopeLine from '../ScopeLine'
import { ScopeNoticeBody } from '../ScopeNoticeSheet'
import AskGreeting from '../AskGreeting'
import { tempQuestion } from '../AskNewConversation'
import { askConvTransition, replaceAskUrl } from '../logic'
import { askInitialConvId, askOpenAction } from '../AskChatTab'
import { calls, declOf, effectCallbacks, ownerName, parseCode, text, walk as walkAst } from './astCode'

// task-066 §26-13 ①④⑨⑭⑯ — 질문 탭 챗봇창의 화면 구조·대화 수명 불변식(소스 구조 + 렌더 결과). 변이: 각 줄 끝 주석.

const comp = join(__dirname, '..', '..')
const askDir = join(comp, 'ask')
const appAsk = join(comp, '..', 'app', '(app)', 'ask')

/** 선언을 찾지 못하면 그 자리에서 실패(검사가 헛돌지 않게). */
function mustDecl(sf: ts.SourceFile, name: string): ts.Node {
  const d = declOf(sf, name)
  assert.ok(d, `${name} 선언을 찾지 못했다`)
  return d
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? (f === '__tests__' ? [] : walk(p)) : /\.(ts|tsx)$/.test(f) ? [p] : []
  })
}

test('① 질문 화면에 보내기 확인 창이 없다 — 관문 훅·확인 키·확인 문구·onConfirm 0, 범위 시트는 mode 없이 [닫기]만', () => {
  for (const f of [...walk(askDir), ...walk(appAsk)]) {
    const s = readCode(f)
    for (const bad of ['useScopeNoticeGate', 'scopeNotice', 'kaiwa.ask.scopeNotice', '알겠어요, 보내기', 'onConfirm']) assert.ok(!s.includes(bad), `${f}: ${bad}`)
  }
  const sheet = readCode(join(askDir, 'ScopeNoticeSheet.tsx'))
  assert.match(sheet, /export default function ScopeNoticeSheet\(\{ open, onClose \}: \{ open: boolean; onClose: \(\) => void \}\)/) // mode prop 을 되살리면 실패
  const html = renderToStaticMarkup(createElement(ScopeNoticeBody, { leadId: 'l', onClose: () => {} }))
  assert.equal((html.match(/<button\b/g) ?? []).length, 1, '버튼은 [닫기] 하나')
  assert.ok(html.includes(`>${ASK_COPY.scope.close}</button>`))
  for (const t of [...ASK_COPY.scope.send, ASK_COPY.scope.noSend[0], ASK_COPY.scope.noSend[3], ASK_COPY.scope.voiceBandTail, ASK_COPY.scope.note]) assert.ok(html.includes(t), t)
  assert.ok(html.includes(`<b class="font-bold">${ASK_COPY.scope.voiceBold}</b>`) && html.includes('bg-accent-soft'), '목소리 줄 강조')
})

test('① 보내기 경로는 범위 시트를 열지 않는다 — setScopeOpen 호출은 범위 줄·메뉴 「보내는 범위 보기」에서만(금지어 없이 되살린 관문도 잡는다)', () => {
  const allowed = new Set(['onOpen', 'onScope', 'openScopeFromMenu'])
  for (const f of ['AskNewConversation.tsx', 'AskRoom.tsx']) {
    const sf = parseCode(join(askDir, f))
    const sets = calls(sf, (c) => c === 'setScopeOpen')
    assert.ok(sets.length >= 3, `${f}: 호출처를 찾지 못했다(${sets.length})`)
    for (const c of sets) {
      if (c.arguments[0]?.getText() === 'false') continue
      assert.ok(allowed.has(ownerName(c) ?? ''), `${f}: setScopeOpen(${text(c.arguments[0])}) 가 「${ownerName(c)}」 안에 있다`)
    }
  }
})

test('④ /ask 를 열 때 방을 만들지 않는다 — 어떤 효과(한 줄이든 블록이든)에도 #28·방 만들기·보내기 호출 0, 만드는 곳은 첫 보내기(create) 한 곳', () => {
  let seen = 0
  for (const f of ['AskChatTab.tsx', 'AskNewConversation.tsx', 'AskRoom.tsx', 'useAskInput.tsx']) {
    const effects = effectCallbacks(parseCode(join(askDir, f)))
    seen += effects.length
    for (const cb of effects) {
      const t = text(cb)
      assert.ok(!/apiPost|\/api\/v1\/chats'|createAskConversation|createChat|\bcreate\b|\bonCreated\b|\bsendChip\b|\bonSend\b/.test(t), `${f} 효과 안에 방 만들기/보내기: ${t.slice(0, 90)}`)
    }
  }
  assert.ok(seen >= 6, `효과를 충분히 찾지 못했다(${seen}) — 검사가 헛돈다`)
  for (const f of ['AskChatTab.tsx', 'AskRoom.tsx']) assert.equal(calls(parseCode(join(askDir, f)), (c) => c === 'apiPost').length, 0, `${f}: apiPost`)
  const n = parseCode(join(askDir, 'AskNewConversation.tsx'))
  const posts = calls(n, (c) => c === 'apiPost')
  assert.equal(posts.length, 1)
  assert.equal(ownerName(posts[0]), 'createChat')
  assert.equal(posts[0].getText(), "apiPost<CreatedChat>('/api/v1/chats', { kind: 'ASK', title })")
  const made = calls(n, (c) => c === 'createAskConversation')
  assert.equal(made.length, 1)
  assert.equal(ownerName(made[0]), 'create')
  // `create` 이름은 선언 하나와 `onSend: create` 하나뿐 — 다른 곳(효과·마운트 훅)이 부르지 못한다
  const ids: ts.Identifier[] = []
  walkAst(n, (x) => {
    if (ts.isIdentifier(x) && x.text === 'create') ids.push(x)
  })
  assert.equal(ids.length, 2)
  assert.deepEqual(ids.map((i) => (ts.isVariableDeclaration(i.parent) ? 'decl' : ts.isPropertyAssignment(i.parent) ? `prop:${i.parent.name.getText()}` : '기타')).sort(), ['decl', 'prop:onSend'])
})

test('T9 주소 갱신은 한 곳 — ask/** 에 router.push(·router.replace(·useRouter 0, replaceState( 는 logic.ts 한 곳(첫 인자 null), history.state 를 넘기는 호출 0', () => {
  let scanned = 0
  for (const f of walk(askDir)) {
    const c = readCode(f)
    scanned++
    for (const bad of ['router.push(', 'router.replace(', 'useRouter', 'history.state', 'pushState(']) assert.ok(!c.includes(bad), `${f}: ${bad}`) // router.push('/ask') 를 되살리면 실패
    const n = (c.match(/replaceState\(/g) ?? []).length
    assert.equal(n, f.endsWith(`${'logic.ts'}`) ? 1 : 0, `${f}: replaceState( ${n}`)
  }
  assert.ok(scanned >= 20, `ask/** 파일을 충분히 읽지 못했다(${scanned})`)
  assert.match(readCode(join(askDir, 'logic.ts')), /h\.replaceState\(null, '', url\)/)
  const f = join(askDir, 'AskChatTab.tsx')
  const sf = parseCode(f)
  const reps = calls(sf, (c) => c === 'replaceAskUrl')
  assert.equal(reps.length, 1)
  assert.equal(text(reps[0]), 'replaceAskUrl(window.history, u)')
  assert.equal(ownerName(reps[0]), 'replaceUrl')
  assert.match(readCode(f), /onNewConversation=\{startFresh\}/)
  assert.ok(!/<AskChatTab[^>]*\bkey=/.test(readCode(join(appAsk, '(tab)', 'page.tsx'))), 'AskChatTab 에 key 를 주지 않는다')
})

test('T10 열기 순서 — 상태(setConv) 먼저, 주소(replaceUrl) 나중: 생성 직후·시트에서 열기·새 질문 시작 모두 · 전이는 none(같은 대화를 두 번 열지 않음)', () => {
  const sf = parseCode(join(askDir, 'AskChatTab.tsx'))
  const order = (name: string) => calls(mustDecl(sf, name)).map((c) => c.getText())
  const open = order('openConv')
  assert.ok(open.indexOf('setConv((c) => ({ id: row.id, seed: null, greeting: false, n: c.n, hint: row.title }))') >= 0, 'openConv 가 힌트 제목과 함께 연다')
  assert.ok(open.indexOf('replaceUrl(askChatHref(row.id))') > open.findIndex((t) => t.startsWith('setConv(')), '주소를 먼저 바꾸면 실패') // 순서를 뒤집으면 실패
  assert.ok(open.lastIndexOf('setHistoryOpen(false)') > open.indexOf('replaceUrl(askChatHref(row.id))'), '여는 경로는 주소 뒤에 시트를 닫는다')
  assert.ok(open.includes('focusPill()'), '머리가 새로 그려지니 초점은 알약으로')
  const fresh = order('startFresh')
  assert.deepEqual(fresh, ['setFailed(null)', 'startNew()', "replaceUrl('/ask')", 'focusPill()'])
  const t = readCode(join(askDir, 'AskChatTab.tsx'))
  assert.match(t, /setConv\(\(c\) => \(\{ id: seed\.chat\.id, seed, greeting: true, n: c\.n, hint: null \}\)\)\s*replaceUrl\(askChatHref\(seed\.chat\.id\)\)\s*setPageResetKey\(\(k\) => k \+ 1\)/)
  assert.match(t, /const t = askConvTransition\(prevQ, q, conv\.id\)/)
  // 상태가 먼저 바뀌어 있으면 주소 전이는 none
  assert.equal(askConvTransition(null, 'B', 'B'), 'none')
  assert.equal(askConvTransition('A', 'B', 'B'), 'none')
  assert.equal(askConvTransition('A', null, null), 'none')
  assert.deepEqual(askConvTransition('A', 'B', 'A'), { open: 'B' }, '대조군 — 상태를 먼저 안 바꾸면 다시 연다')
})

test('T11 「지금 대화」 행 — 시트만 닫음(setConv·replaceUrl 0), 다른 행만 연다', () => {
  assert.equal(askOpenAction('A', 'A'), 'close') // 같은 대화도 다시 열면 실패
  assert.equal(askOpenAction('B', 'A'), 'open')
  assert.equal(askOpenAction('B', null), 'open')
  const sf = parseCode(join(askDir, 'AskChatTab.tsx'))
  const guard = mustDecl(sf, 'openConv').getText()
  assert.match(guard, /if \(askOpenAction\(row\.id, conv\.id\) === 'close'\) \{\s*setHistoryOpen\(false\)\s*return\s*\}/)
})

test('T22 처음 값 — 주소 쿼리가 정본: 형식이 맞는 chat 이면 그 대화, 없거나 틀리면 빈 대화(서버가 처음 그린 값은 쓰지 않는다)', () => {
  assert.equal(askInitialConvId('B'), 'B') // 주소를 안 읽으면 실패
  assert.equal(askInitialConvId(null), null)
  assert.equal(askInitialConvId('../x'), null)
  assert.equal(askInitialConvId(''), null)
  // 낡은 서버 값(`?chat=A` 로 그린 A)이 두 번째 인자로 들어와도 무시 — 되살리면 뒤로가기에서 주소(/ask)와 다른 대화 A 가 열린다(REV-067B-3)
  const stale = askInitialConvId as unknown as (q: string | null, serverChatId: string | null) => string | null
  assert.equal(stale(null, 'A'), null)
  assert.equal(stale('../x', 'A'), null)
  assert.equal(stale('B', 'A'), 'B')
  assert.equal(askInitialConvId.length, 1, '서버 값을 받는 자리가 없다')
  const tab = readCode(join(askDir, 'AskChatTab.tsx'))
  assert.match(tab, /useState<Conv>\(\(\) => \(\{ id: askInitialConvId\(q\),/)
  assert.ok(!tab.includes('initialChatId'), '서버 prop 이 되돌아오면 실패')
  assert.match(tab, /export default function AskChatTab\(\{ teacherName \}: \{ teacherName: string \}\)/)
})

test('시트 연결(§27-4 A·27-5 D) — 열기·제목·삭제·1쪽으로·알약 ref, 지금 대화를 지우면 시트 닫고 빈 대화(주소 /ask, 기록 0)', () => {
  const t = readCode(join(askDir, 'AskChatTab.tsx'))
  for (const s of ['onOpen={openConv}', 'onRenamed={renamed}', 'onDeleted={onDeleted}', 'pageResetKey={pageResetKey}', 'onToast={toast.show}', 'currentChatId={conv.id}', '<AskHistoryButton ref={pillRef}', 'titleHint={conv.hint}', 'onTitleChange={renamed}'])
    assert.ok(t.includes(s), s)
  const sf = parseCode(join(askDir, 'AskChatTab.tsx'))
  assert.deepEqual(calls(mustDecl(sf, 'onDeleted')).map((c) => c.getText()), ['setHistoryOpen(false)', 'startFresh()'])
  assert.match(mustDecl(sf, 'onDeleted').getText(), /if \(!wasCurrent\) return/)
  assert.match(mustDecl(sf, 'renamed').getText(), /c\.id === id \? \{ \.\.\.c, hint: title \} : c/)
})

/** Next 16 이 패치한 `history.replaceState` 의 동기화 규칙 모델 — `data.__NA`/`data._N` 이 있으면 라우터 동기화(= useSearchParams 갱신)를 건너뛴다. */
function nextPatchedHistory() {
  const rec = { synced: [] as string[], written: [] as Array<[unknown, string, string]> }
  const h = {
    state: { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: { tree: 't' } } as unknown,
    replaceState(data: unknown, unused: string, url: string) {
      const d = data as { __NA?: boolean; _N?: boolean } | null
      if (!(d?.__NA || d?._N)) rec.synced.push(url)
      rec.written.push([data, unused, url])
    },
  }
  return { h, rec }
}

test('F1 replaceAskUrl — 첫 인자는 null · 주소 그대로 · 한 번 → Next 라우터가 동기화한다(옛 호출은 건너뛰어졌다)', () => {
  const { h, rec } = nextPatchedHistory()
  replaceAskUrl(h, '/ask?chat=abc')
  assert.equal(rec.written.length, 1)
  assert.equal(rec.written[0][0], null, '첫 인자는 반드시 null — history.state 를 넘기면 동기화가 건너뛰어진다')
  assert.equal(rec.written[0][1], '')
  assert.equal(rec.written[0][2], '/ask?chat=abc')
  assert.deepEqual(rec.synced, ['/ask?chat=abc'], 'useSearchParams·하단 탭·router.push/replace 비교가 새 주소를 본다')
  // 대조군: 옛 호출 모양은 모델에서 동기화가 일어나지 않는다(모델이 결함을 가려내는지)
  const old = nextPatchedHistory()
  old.h.replaceState(old.h.state, '', '/ask?chat=abc')
  assert.deepEqual(old.rec.synced, [])
})

test('F1 전제 — 설치된 Next 의 replaceState 패치가 아직 __NA/_N 이면 동기화를 건너뛴다(바뀌면 replaceAskUrl 가정을 다시 확인)', { skip: !existsSync(join(process.cwd(), 'node_modules', 'next', 'dist', 'client', 'components', 'app-router.js')) }, () => {
  const src = readFileSync(join(process.cwd(), 'node_modules', 'next', 'dist', 'client', 'components', 'app-router.js'), 'utf8')
  const at = src.indexOf('window.history.replaceState = function replaceState(data, _unused, url)')
  assert.ok(at > 0, 'Next 의 replaceState 패치를 찾지 못했다 — 동기화 규칙이 바뀌었는지 확인')
  const body = src.slice(at, at + 700)
  assert.ok(body.indexOf('data?.__NA || data?._N') > 0 && body.indexOf('data?.__NA || data?._N') < body.indexOf('applyUrlFromHistoryPushReplace(url)'), '__NA/_N 이면 동기화 전에 돌아가는 규칙')
  assert.ok(body.includes('copyNextJsInternalHistoryState(data)'), 'null 이면 내부 state 를 복사해 동기화')
})

test('대화 없음(404)·불러오기 실패 — onGone: 주소 /ask → 토스트 → 빈 대화 / onLoadFailed: 실패 id 기억 → 빈 대화', () => {
  const sf = parseCode(join(askDir, 'AskChatTab.tsx'))
  const attr = (name: string): ts.JsxAttribute => {
    let found: ts.JsxAttribute | null = null
    walkAst(sf, (n) => {
      if (!found && ts.isJsxAttribute(n) && n.name.getText() === name) found = n
    })
    assert.ok(found, name)
    return found as ts.JsxAttribute
  }
  assert.deepEqual(
    calls(attr('onGone')).map((c) => c.getText()),
    ["replaceUrl('/ask')", 'toast.show(ASK_COPY.goneToast)', 'startNew()'],
    'onGone 순서·내용(startNew 를 빼면 지워진 대화 화면이 남는다)',
  )
  assert.deepEqual(calls(attr('onLoadFailed')).map((c) => c.getText()), ['setFailed(conv.id)', 'startNew()'])
  // startNew 는 빈 대화로 바꾼다(n 을 올려 다시 마운트)
  assert.match(text(declOf(sf, 'startNew')), /setConv\(\(c\) => \(\{ id: null, seed: null, greeting: false, n: c\.n \+ 1, hint: null \}\)\)/)
})

test('삭제 뒤 이동 — ASK 는 flash 표지를 쓰고 router.replace(/ask) 로 나가고, TALK·CHAT 은 각자 목록 탭으로(F1 로 화면이 실제로 바뀌는 경로)', () => {
  const sf = parseCode(join(comp, 'chat', 'ChatMenuSheet.tsx'))
  const remove = declOf(sf, 'remove')
  assert.ok(remove)
  const askReplace = calls(remove, (c) => c === 'router.replace').find((c) => c.arguments[0]?.getText() === "'/ask'")
  assert.ok(askReplace, "ASK 삭제 뒤 router.replace('/ask') 가 없다 — 화면이 안 바뀌고 시트가 삭제 중에 잠긴다")
  let guarded = false
  for (let p: ts.Node | undefined = askReplace.parent; p; p = p.parent) if (ts.isIfStatement(p) && p.expression.getText() === 'ask') guarded = true
  assert.ok(guarded, 'if (ask) 안에 있다')
  const writes = calls(remove, (c) => c === 'writeStore').map((c) => c.getText())
  assert.deepEqual(writes, ["writeStore('session', ASK_KEYS.flash, 'deleted')"])
  const order = calls(remove).map((c) => c.getText())
  assert.ok(order.indexOf(writes[0]) < order.indexOf(askReplace.getText()), '표지를 먼저 적고 이동')
  assert.ok(order.includes("router.replace(talk ? '/study/ai?tab=talk' : '/study/ai?tab=chat')"), 'TALK·CHAT 이동은 그대로')
})

test('⑭ 구조 — loading 은 AskTabSkeleton 만 · 옛 목록 파일 없음 · 질문은 집중 화면 아님(T21) · 자리표시는 데이터 요청 0·inert · 머리 둘째 줄 「새 질문」', () => {
  assert.match(readCode(join(appAsk, '(tab)', 'loading.tsx')), /return <AskTabSkeleton \/>/)
  for (const f of ['AskHome.tsx', 'AskComposerCard.tsx', 'AskExamples.tsx', 'AskHomeSkeleton.tsx', 'useScopeNoticeGate.ts', '__tests__/askHome.test.ts', '__tests__/scopeNotice.test.ts'])
    assert.equal(existsSync(join(askDir, f)), false, f)
  assert.equal(isFocusRoute('/ask'), false)
  assert.equal(isFocusRoute('/ask/abc'), false)
  const sk = readCode(join(askDir, 'AskTabSkeleton.tsx'))
  assert.ok(!/apiGet|apiPost|fetch\(/.test(sk))
  assert.ok((sk.match(/\binert\b/g) ?? []).length >= 3)
  for (const f of ['AskTabSkeleton.tsx', 'AskNewConversation.tsx']) assert.ok(readCode(join(askDir, f)).includes('heading={<AskHeadTitle state="new" />}'), f)
  const page = readCode(join(appAsk, '(tab)', 'page.tsx'))
  assert.match(page, /<AskChatTab teacherName=\{teacherName\} \/>/) // 지금 대화는 서버 값이 아니라 화면이 주소에서 읽는다(T22)
  assert.ok(!page.includes('initialChatId'))
  assert.ok(page.includes('await auth()'))
  // 로그인이 풀린 채 대화 주소로 오면 돌아올 주소에 그 대화(§27-7 A — T20 의 탭 쪽)
  assert.match(page, /redirect\(`\/login\?callbackUrl=\$\{encodeURIComponent\(isAskId\(chat\) \? askChatHref\(chat\) : '\/ask'\)\}`\)/)
})

test('⑯ 공용 확장 기본값 — Composer 아래 여백 문자열 그대로 · MessageList lead 없음 = 지금 · ChatMenuSheet extraTop 없음·TALK/CHAT 문구', () => {
  assert.equal(composerPaddingBottom(true), 'max(8px, var(--safe-bottom))')
  assert.equal(composerPaddingBottom(false), '8px')
  const c = readCode(join(comp, 'chat', 'Composer.tsx'))
  assert.match(c, /safeBottom = true,/) // 기본값을 false 로 바꾸면 실패
  const ml = readCode(join(comp, 'chat', 'MessageList.tsx'))
  assert.match(ml, /\{messages\.length === 0 && !trailingPending && !tail \? \(\s*\(intro \?\? <RoomIntro teacherName=\{teacherName\} onPick=\{onPick\} \/>\)\s*\) : \(\s*<>\s*\{lead\}\s*<ul className="min-w-0">\{rows\}<\/ul>/)
  const m = readCode(join(comp, 'chat', 'ChatMenuSheet.tsx'))
  assert.match(m, /const removeLabel = ask \? ASK_COPY\.menu\.delete : `\$\{noun\} 삭제`/)
  assert.match(m, /mode === 'confirmDelete' \? removeLabel : ask \? ASK_COPY\.menu\.title : `\$\{noun\} 메뉴`/)
  assert.match(m, /const noun = ask \? ASK_COPY\.menu\.noun : talk \? '회화' : '채팅'/)
  assert.match(m, /\{extraTop\}\s*\{ask \? <p className="pt-3 pb-1 text-\[12px\] font-semibold text-ink2">\{ASK_COPY\.menu\.convHead\}<\/p> : null\}\s*<button/)
  // 회화·채팅 화면은 새 prop 을 넘기지 않는다
  for (const f of [join(comp, 'talk', 'TalkRoom.tsx'), join(comp, 'chat', 'ChatRoom.tsx')]) {
    const s = readCode(f)
    assert.ok(!s.includes('extraTop') && !s.includes('safeBottom') && !/\blead=/.test(s), f)
  }
})

test('범위 줄(§26-8 B) — 줄 전체가 버튼 · 접근 이름 · 아래 4px(제스처 여백은 하단 탭이) · 터치 위 8 아래 4', () => {
  const h = renderToStaticMarkup(createElement(ScopeLine, {}))
  assert.equal((h.match(/<button\b/g) ?? []).length, 1)
  assert.ok(h.includes(`aria-label="${ASK_COPY.scopeLine.aria}"`) && h.includes('data-kb-docked'))
  assert.ok(h.includes('before:-top-2') && h.includes('before:-bottom-1') && h.includes('min-h-8'))
  assert.ok(h.includes(ASK_COPY.scopeLine.text) && h.includes(ASK_COPY.scopeLine.more))
  assert.ok(h.includes('style="padding-bottom:4px"') && !h.includes('safe-bottom'))
})

test('안내 말풍선(§26-5 D) — 칩 3개는 버튼(min-h-11·바로 보냄), 말로 묻기 상자는 누르는 기능 없음·lang=ja', () => {
  const picked: string[] = []
  const h = renderToStaticMarkup(createElement(AskGreeting, { teacherName: '사쿠라', onPick: (q: string) => picked.push(q) }))
  assert.equal((h.match(/<button\b/g) ?? []).length, 3)
  assert.equal((h.match(/min-h-11/g) ?? []).length, 3)
  assert.ok(h.includes('사쿠라 선생님') && h.includes(ASK_COPY.greeting.chipsLabel) && h.includes(ASK_COPY.greeting.voiceHead))
  assert.match(h, /<ul lang="ja"[^>]*><li>大丈夫<\/li>/)
  assert.ok(h.includes(`<b class="font-bold">${ASK_COPY.greeting.leadBold}</b>`))
  assert.match(readCode(join(askDir, 'AskGreeting.tsx')), /onClick=\{\(\) => onPick\(e\.q\)\}/)
})

test('임시 말풍선(§26-3 C 2) — 보내는 중 · 말이면 REALTIME_STT · 발화 id 없음', () => {
  const t = tempQuestion('大丈夫', 'voice', '2026-10-13T00:00:00Z')
  assert.equal(t.localStatus, 'SENDING')
  assert.equal(t.inputSource, 'REALTIME_STT')
  assert.ok(!('utteranceId' in t))
  assert.equal(tempQuestion('질문', 'text', 'x').inputSource, 'TEXT')
})
