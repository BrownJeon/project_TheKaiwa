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
import ScopeLine, { scopeLinePaddingBottom } from '../ScopeLine'
import { ScopeNoticeBody } from '../ScopeNoticeSheet'
import AskGreeting from '../AskGreeting'
import { tempQuestion } from '../AskNewConversation'
import { replaceAskUrl } from '../logic'
import { calls, declOf, effectCallbacks, ownerName, parseCode, text, walk as walkAst } from './astCode'

// task-066 §26-13 ①④⑨⑭⑯ — 질문 탭 챗봇창의 화면 구조·대화 수명 불변식(소스 구조 + 렌더 결과). 변이: 각 줄 끝 주석.

const comp = join(__dirname, '..', '..')
const askDir = join(comp, 'ask')
const appAsk = join(comp, '..', 'app', '(app)', 'ask')

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

test('⑨ 주소 적기 — 생성 직후·없는 대화는 replaceAskUrl(window.history, u) 한 곳만, 직접 history 호출·router.replace 로 ?chat= 을 적지 않는다, 새 질문 시작만 router.push(/ask)', () => {
  const f = join(askDir, 'AskChatTab.tsx')
  const t = readCode(f)
  const sf = parseCode(f)
  // 호출 모양(첫 인자 null)은 replaceAskUrl 한 곳이 정한다 — 여기서 history.replaceState/history.state 를 직접 쓰지 않는다(F1)
  assert.ok(!/history\.replaceState|history\.state|history\.pushState/.test(t), '직접 history 호출 금지')
  const reps = calls(sf, (c) => c === 'replaceAskUrl')
  assert.equal(reps.length, 1)
  assert.equal(text(reps[0]), 'replaceAskUrl(window.history, u)')
  assert.equal(ownerName(reps[0]), 'replaceUrl')
  assert.match(t, /replaceUrl\(askChatHref\(seed\.chat\.id\)\)/)
  assert.equal(calls(sf, (c) => c === 'router.replace').length, 0, 'router.replace 금지(§26-14 A 6)')
  assert.match(t, /onNewConversation=\{\(\) => router\.push\('\/ask'\)\}/)
  // 상태를 먼저 바꾸고 주소를 적는다(순서를 뒤집으면 새 대화로 오판할 수 있다)
  assert.match(t, /setConv\(\(c\) => \(\{ id: seed\.chat\.id, seed, greeting: true, n: c\.n \}\)\)\s*replaceUrl\(askChatHref\(seed\.chat\.id\)\)/)
  assert.match(t, /const t = askConvTransition\(prevQ, q, conv\.id\)/)
  assert.ok(!/<AskChatTab[^>]*\bkey=/.test(readCode(join(appAsk, '(tab)', 'page.tsx'))), 'AskChatTab 에 key 를 주지 않는다')
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
  assert.match(text(declOf(sf, 'startNew')), /setConv\(\(c\) => \(\{ id: null, seed: null, greeting: false, n: c\.n \+ 1 \}\)\)/)
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

test('⑭ 구조 — loading 은 AskTabSkeleton 만 · 옛 목록 파일 없음 · routes 불변 · 자리표시는 데이터 요청 0·inert', () => {
  assert.match(readCode(join(appAsk, '(tab)', 'loading.tsx')), /return <AskTabSkeleton \/>/)
  for (const f of ['AskHome.tsx', 'AskComposerCard.tsx', 'AskExamples.tsx', 'AskHomeSkeleton.tsx', 'useScopeNoticeGate.ts', '__tests__/askHome.test.ts', '__tests__/scopeNotice.test.ts'])
    assert.equal(existsSync(join(askDir, f)), false, f)
  assert.equal(isFocusRoute('/ask'), false)
  assert.equal(isFocusRoute('/ask/abc'), true)
  const sk = readCode(join(askDir, 'AskTabSkeleton.tsx'))
  assert.ok(!/apiGet|apiPost|fetch\(/.test(sk))
  assert.ok((sk.match(/\binert\b/g) ?? []).length >= 3)
  const page = readCode(join(appAsk, '(tab)', 'page.tsx'))
  assert.match(page, /initialChatId=\{isAskId\(chat\) \? chat : null\}/)
  assert.ok(page.includes('await auth()') && page.includes('/login?callbackUrl='))
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

test('범위 줄(§26-8 B) — 줄 전체가 버튼 · 접근 이름 · 탭 4px / 지난 대화 제스처 여백 · 터치 위 8 아래 4', () => {
  const h = renderToStaticMarkup(createElement(ScopeLine, { variant: 'tab' }))
  assert.equal((h.match(/<button\b/g) ?? []).length, 1)
  assert.ok(h.includes(`aria-label="${ASK_COPY.scopeLine.aria}"`) && h.includes('data-kb-docked'))
  assert.ok(h.includes('before:-top-2') && h.includes('before:-bottom-1') && h.includes('min-h-8'))
  assert.ok(h.includes(ASK_COPY.scopeLine.text) && h.includes(ASK_COPY.scopeLine.more))
  assert.equal(scopeLinePaddingBottom('tab'), 4)
  assert.equal(scopeLinePaddingBottom('room'), 'max(4px, var(--safe-bottom))')
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
