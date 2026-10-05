/**
 * task-036 QA — 새 턴(읽기 줄 필드 없는 done)으로 만든 강사 말풍선이 실 Chrome 에서 정상인지 확인한다(화면 코드는 `useChatTurn.ts` 한 줄 삭제뿐 — 회귀 확인).
 *
 * ① 새 서버(--base)에서 CHAT·TALK 방을 만들고 실제 턴 1~2건씩(한자 포함 일본어 입력) → ② 360/390/412 × 780/892 에서 `/study/ai/chat/:id`·`/study/ai/talk/:id` 를 열어
 *   강사 말풍선의 후리가나(<ruby>)·한글 줄(<p lang="ko"> `[…]`)·가로 넘침·페이지 세로 스크롤·콘솔/페이지 오류·엔진명 문자열·터치 대상(보내기·말하기 버튼)을 잰다
 *   ③ XSS 리터럴(`<img src=x onerror=…>` 를 사용자 말로 보낸 CHAT 턴 → img 요소 0·onerror 미실행·글자로 보임) ④ 다크 390×892 한 번
 *   ⑤ **옛 JS 호환**: --head(HEAD 사본 dev 서버)의 옛 클라이언트 페이지에서 턴을 보내되 `/turns` 요청만 **새 서버로 우회**(route.fetch) — 옛 `useChatTurn`(`replyReading ?? null`)이
 *   새 `done`(키 `replyJa·replyKo`뿐)을 받아도 예외 없이 말풍선이 그려지는지.
 * 사용: node tests/live/task036-ui.mjs --base http://localhost:3011 --head http://localhost:3012 --user <쿠키 파일> [--out <스크린샷 디렉터리 — /tmp/qa-artifacts 아래만>]
 * 쿠키는 tests/live/qa-session.ts 로 만든 권한 600 파일. QA 방은 끝에 지운다. 출력에 쿠키·전사 전문은 찍지 않는다(고정 합성 문장의 첫 글자만).
 */
import { readFileSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const a = Object.fromEntries(process.argv.slice(2).reduce((acc, x, i, all) => (x.startsWith('--') ? [...acc, [x.slice(2), all[i + 1]]] : acc), []))
const BASE = a.base
const HEAD = a.head
for (const u of [BASE, HEAD].filter(Boolean)) if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(u)) throw new Error('localhost 만')
const cookie = readFileSync(a.user, 'utf8').trim()
const [cname, ...crest] = cookie.split('=')
const cval = crest.join('=')
if (a.out) mkdirSync(a.out, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function api(method, path, json, base = BASE) {
  const r = await fetch(base + path, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: json === undefined ? undefined : JSON.stringify(json) })
  const body = await r.json().catch(() => ({}))
  return { status: r.status, data: body.data ?? {} }
}
async function turn(chatId, text) {
  const r = await fetch(`${BASE}/api/v1/chats/${chatId}/turns`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ text, inputSource: 'TEXT' }) })
  const raw = await r.text()
  const m = /event: done\ndata: (.+)/.exec(raw)
  return m ? JSON.parse(m[1]) : null
}
/** ruby 의 rt 를 뺀 본문 */
const baseTextFn = `(el) => { const c = el.cloneNode(true); c.querySelectorAll('rt,rp,.sr-only').forEach((n) => n.remove()); return (c.textContent || '').replace(/\\s+/g, '') }`

const KANJI = /[\u4e00-\u9fff]/
const chromeVersion = await (async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
  const v = b.version()
  await b.close()
  return v
})()
console.log(`재현 조건: Chrome ${chromeVersion} headless · DSF 2.625 · isMobile · locale ko-KR · tz Asia/Seoul · reducedMotion=reduce · 폰트 로딩 대기(document.fonts.ready) · 네트워크 fixture 없음(실 dev 서버·실 dev gateway)`)

const chats = []
try {
  // ① 실제 새 턴
  const chat = await api('POST', '/api/v1/chats', { kind: 'CHAT', title: 't036 ui chat' })
  const talk = await api('POST', '/api/v1/chats', { kind: 'TALK', title: 't036 ui talk' })
  const chatId = String(chat.data.id)
  const talkId = String(talk.data.id)
  chats.push(chatId, talkId)
  let dChat = await turn(chatId, '今日は天気がいいですね。どこかへ行きたいです。')
  await sleep(6000)
  let dTalk = await turn(talkId, '私は毎日日本語を勉強しています。')
  await sleep(6000)
  const xssText = '<img src=x onerror="window.__xss=1"> 日本語を勉強します'
  const dXss = await turn(chatId, xssText)
  check('새 턴 3건 done 수신(CHAT 2·TALK 1)', !!dChat && !!dTalk && !!dXss)
  if (!dChat || !dTalk || !dXss) throw new Error('턴 실패')
  // 한자가 없는 답이면(루비 판정 불가) 한 번 더 시도
  for (let k = 0; k < 2 && !KANJI.test(dChat.conversation.replyJa); k++) {
    await sleep(6000)
    dChat = await turn(chatId, '週末は友達と買い物に行きます。')
  }
  for (let k = 0; k < 2 && !KANJI.test(dTalk.conversation.replyJa); k++) {
    await sleep(6000)
    dTalk = await turn(talkId, '昨日は図書館で本を読みました。')
  }
  console.log(`새 말 replyJa(CHAT 마지막) 한자 포함=${KANJI.test(dChat.conversation.replyJa)} · (TALK 마지막) 한자 포함=${KANJI.test(dTalk.conversation.replyJa)} · done 키 CHAT=${Object.keys(dChat.conversation)} TALK=${Object.keys(dTalk.conversation)}`)
  const lastJa = { chat: dChat.conversation.replyJa.replace(/\s+/g, ''), talk: dTalk.conversation.replyJa.replace(/\s+/g, '') }

  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] })
  try {
    const sizes = []
    for (const w of [360, 390, 412]) for (const h of [780, 892]) sizes.push([w, h, 'light'])
    sizes.push([390, 892, 'dark'])
    for (const [w, h, scheme] of sizes) {
      for (const kind of ['chat', 'talk']) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce', colorScheme: scheme })
        await ctx.addCookies([{ name: cname, value: cval, url: BASE }])
        await ctx.grantPermissions(['microphone'], { origin: BASE }).catch(() => undefined)
        const page = await ctx.newPage()
        const errors = []
        page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 160)))
        page.on('pageerror', (e) => errors.push(`pageerror ${String(e).slice(0, 160)}`))
        const bad = []
        page.on('response', (r) => r.status() >= 500 && bad.push(`${r.status()} ${r.url().replace(BASE, '')}`))
        const id = kind === 'chat' ? chatId : talkId
        await page.goto(`${BASE}/study/ai/${kind}/${id}`, { waitUntil: 'networkidle' })
        const want = lastJa[kind]
        await page.waitForFunction(([fn, text]) => {
          const f = eval(fn)
          return [...document.querySelectorAll('[lang="ja"]')].some((e) => f(e) === text)
        }, [baseTextFn, want], { timeout: 20000 }).catch(() => undefined)
        // 분석(#24r) 이 끝나 루비가 채워질 때까지
        await page.waitForSelector('ruby', { timeout: 15000 }).catch(() => undefined)
        await page.evaluate(() => document.fonts.ready)
        await page.waitForTimeout(1200)
        const info = await page.evaluate(([fn, text]) => {
          const f = eval(fn)
          const els = [...document.querySelectorAll('[lang="ja"]')].filter((e) => f(e) === text)
          const el = els[els.length - 1]
          const bubble = el?.closest('div')
          const hang = bubble ? [...bubble.parentElement.querySelectorAll('p[lang="ko"]')].map((p) => (p.textContent || '').replace(/\s+/g, ' ').trim()).find((t) => /\[.*[가-힣].*\]/.test(t)) ?? null : null
          const de = document.documentElement
          const over = [...document.querySelectorAll('body *')].filter((e) => {
            const r = e.getBoundingClientRect()
            return r.width > 0 && r.right > de.clientWidth + 0.5
          })
          const rb = el ? [...el.querySelectorAll('ruby')] : []
          const rect = bubble?.getBoundingClientRect()
          const btnH = (sel) => [...document.querySelectorAll(sel)].map((b) => Math.round(b.getBoundingClientRect().height))
          const ptt = [...document.querySelectorAll('button')].filter((b) => /눌러|말하|누르/.test((b.getAttribute('aria-label') || '') + (b.textContent || '')) && b.getBoundingClientRect().width >= 48).map((b) => [Math.round(b.getBoundingClientRect().width), Math.round(b.getBoundingClientRect().height)])
          return {
            found: !!el,
            rubies: rb.length,
            rubySample: rb.slice(0, 3).map((r) => (r.firstChild?.textContent ?? '') + '{' + (r.querySelector('rt')?.textContent ?? '') + '}').join(''),
            rtPx: rb[0] ? getComputedStyle(rb[0].querySelector('rt')).fontSize : null,
            hangul: hang,
            jaClip: el ? el.scrollWidth > el.clientWidth + 1 : null,
            bubbleInside: rect ? rect.left >= -0.5 && rect.right <= de.clientWidth + 0.5 : null,
            scrollW: de.scrollWidth,
            clientW: de.clientWidth,
            pageV: de.scrollHeight - window.innerHeight,
            overN: over.length,
            overSample: over.slice(0, 3).map((e) => e.tagName + '.' + String(e.className).slice(0, 40)),
            sendH: btnH('form button[type="submit"]'),
            ptt,
            engine: (document.body.innerHTML.match(/reazon|whisper|style-?bert|model_id|speaker_id/gi) || []).length,
            bg: getComputedStyle(document.body).backgroundColor,
            fg: getComputedStyle(document.body).color,
          }
        }, [baseTextFn, want])
        const tag = `${kind.toUpperCase()} ${w}×${h} ${scheme}`
        check(`${tag} 새 강사 말풍선 표시`, info.found)
        const kanji = KANJI.test(want)
        check(`${tag} 후리가나(<ruby>) ${kanji ? '>0' : '해당 없음(한자 없음)'}`, !kanji || info.rubies > 0, `ruby=${info.rubies} ${info.rubySample} rt=${info.rtPx}`)
        check(`${tag} 한글 줄 표시`, !!info.hangul, `hangul=${JSON.stringify((info.hangul ?? '').slice(0, 50))}`)
        check(`${tag} 잘림 0·말풍선 화면 안·가로 넘침 0·페이지 세로 스크롤 0`, info.jaClip === false && info.bubbleInside === true && info.scrollW <= info.clientW && info.overN === 0 && info.pageV <= 1, `jaClip=${info.jaClip} inside=${info.bubbleInside} scrollW=${info.scrollW}/${info.clientW} over=${info.overN}${info.overSample.length ? ' ' + info.overSample.join('|') : ''} pageV=${info.pageV}`)
        check(`${tag} 콘솔·페이지 오류 0·5xx 0`, errors.length === 0 && bad.length === 0, `errors=${errors.length}${errors.length ? ' ' + errors.join(' / ') : ''} 5xx=${bad.join(',') || 0}`)
        check(`${tag} 엔진명 문자열 0`, info.engine === 0, `hits=${info.engine}`)
        if (kind === 'chat') check(`${tag} 보내기 버튼 ≥44px`, info.sendH.length > 0 && info.sendH.every((x) => x >= 44), `h=${info.sendH.join(',')}`)
        else check(`${tag} 말하기(PTT) 버튼 ≥64px`, info.ptt.some(([pw, ph]) => pw >= 64 && ph >= 64), `btn=${JSON.stringify(info.ptt)}`)
        if (scheme === 'dark') check(`${tag} 다크 토큰 반전(본문 배경이 어둡다)`, (() => { const m = /rgba?\((\d+), (\d+), (\d+)/.exec(info.bg); return !!m && (Number(m[1]) + Number(m[2]) + Number(m[3])) / 3 < 100 })(), `bg=${info.bg} fg=${info.fg}`)
        if (a.out && w === 390 && h === 892) await page.screenshot({ path: `${a.out}/${kind}-${w}x${h}-${scheme}.png` })
        // ③ XSS — CHAT 방에서만
        if (kind === 'chat' && scheme === 'light' && w === 390 && h === 892) {
          const xss = await page.evaluate(() => ({ imgX: document.querySelectorAll('img[src="x"]').length, flag: window.__xss ?? null, literal: (document.body.innerText || '').includes('<img src=x onerror=') }))
          check('XSS 리터럴: img 요소 0·onerror 미실행·글자로 남음', xss.imgX === 0 && xss.flag === null && xss.literal, JSON.stringify(xss))
        }
        await ctx.close()
      }
    }

    // ⑤ 옛 JS(HEAD 사본 페이지)가 새 서버의 done 을 받는 경우
    if (HEAD) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 892 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' })
      await ctx.addCookies([{ name: cname, value: cval, url: HEAD }])
      const page = await ctx.newPage()
      const errors = []
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 160)))
      page.on('pageerror', (e) => errors.push(`pageerror ${String(e).slice(0, 160)}`))
      let proxied = null
      await page.route(new RegExp(`${HEAD.replace(/[.]/g, '\\.')}/api/v1/chats/${chatId}/turns$`), async (route) => {
        const res = await route.fetch({ url: `${BASE}/api/v1/chats/${chatId}/turns` }) // 새 서버(--base) 로 우회, 같은 쿠키·본문
        const body = await res.text()
        proxied = (/event: done\ndata: (.+)/.exec(body) ?? [])[1] ?? null
        await route.fulfill({ response: res, body })
      })
      await page.goto(`${HEAD}/study/ai/chat/${chatId}`, { waitUntil: 'networkidle' })
      await page.waitForSelector('textarea[aria-label="메시지 입력"]', { timeout: 15000 })
      await page.fill('textarea[aria-label="메시지 입력"]', '映画を見るのが好きです。')
      await page.click('form button[type="submit"]')
      await page.waitForFunction(() => /映画/.test(document.body.innerText) && document.querySelectorAll('[lang="ja"]').length >= 3, null, { timeout: 30000 }).catch(() => undefined)
      await page.waitForTimeout(8000)
      const doc = proxied ? JSON.parse(proxied) : null
      const replyJa = doc?.conversation?.replyJa ?? ''
      const shown = replyJa ? await page.evaluate(([fn, t]) => { const f = eval(fn); return [...document.querySelectorAll('[lang="ja"]')].some((e) => f(e) === t) }, [baseTextFn, replyJa.replace(/\s+/g, '')]) : false
      check('옛 JS(HEAD 클라이언트) ← 새 done: 우회 턴 수신(키 replyJa·replyKo 뿐)', !!doc && JSON.stringify(Object.keys(doc.conversation).sort()) === '["replyJa","replyKo"]', `keys=${doc ? Object.keys(doc.conversation) : '-'}`)
      check('옛 JS 가 새 done 으로 강사 말풍선을 그린다(예외 0·내용 일치)', !!doc && shown && errors.length === 0, `shown=${shown} errors=${errors.length}${errors.length ? ' ' + errors.join(' / ') : ''}`)
      await ctx.close()
    }
  } finally {
    await browser.close()
  }
} finally {
  for (const id of chats) await api('DELETE', `/api/v1/chats/${id}`).catch(() => undefined)
}
const fail = results.filter((r) => !r.ok)
console.log(`\n결과: PASS ${results.length - fail.length} / ${results.length}${fail.length ? ` · FAIL ${fail.length}` : ''}`)
process.exit(fail.length ? 1 : 0)
