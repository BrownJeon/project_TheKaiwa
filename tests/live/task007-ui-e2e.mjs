/**
 * task-007 회화방 화면 E2E(실 Chrome + Playwright fake audio) — 완료 기준 9.
 *
 *   푸시투토크(fake mic) → 인식 → 자동 전송 → 문장별 재생(chunkIndex 순) → 교정 카드 즉시 · barge-in(재생 중 누르면 즉시 녹음)
 *   · 텍스트 입력 전환 · 다시 듣기 2종 · 360/390/412 넘침 0·터치 ≥44px(PTT 72) · 엔진명·서명 URL DOM/콘솔 0.
 *
 * 실행(미러에서, dev 서버를 따로 띄운 뒤 — 접속은 localhost, 127.0.0.1 은 Next 16 dev 청크 403):
 *   node tests/live/task007-ui-e2e.mjs --base http://localhost:3012 --cookie <qa-session 파일> --audio <16k wav> --out <스크린샷 디렉터리>
 * `playwright-core` 는 워크스페이스 밖(~/node_modules)에서 찾는다 — 프로젝트 의존성이 아니다. 브라우저는 /usr/bin/google-chrome.
 * 만든 회화는 끝에 지운다(QA 계정 소유만). 쿠키·서명 URL·발화 원문은 출력하지 않는다.
 */
import { readFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
)
const BASE = args.base ?? 'http://localhost:3012'
const COOKIE = readFileSync(args.cookie, 'utf8').trim()
const AUDIO = args.audio
const OUT = args.out ?? '/tmp/task007-ui'
const HOLD_MS = Number(args.hold ?? 3600)
mkdirSync(OUT, { recursive: true })

const [cookieName, ...rest] = COOKIE.split('=')
const cookieValue = rest.join('=')
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}
const ENGINE_RE = /claude|haiku|sonnet|opus|qwen|reazon|sherpa|whisper|style-?bert|sbv2|gateway|connectionKey|traceId|엔진|모델/i
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${AUDIO}`],
})
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: false })
await ctx.grantPermissions(['microphone'], { origin: BASE })
// 개발 티켓의 wsUrl 은 DB connection(운영 gateway 127.0.0.1:8100 — 운영 도메인 Origin 만 허용)에서 온다. 개발 gateway
// (run_dev.py, 이 dev 서버 Origin 허용·콜백 = 이 dev 서버)로 돌리려면 `--ws-rewrite ws://127.0.0.1:8100=>ws://127.0.0.1:8197`.
// 테스트 페이지 안에서만 주소를 바꾼다 — 앱 코드·DB 설정은 그대로.
// Next dev 도구 배지(좌하단)가 ⌨ 버튼을 덮는다 — 개발 서버에만 있는 것이라 테스트 페이지에서 숨긴다(운영 빌드엔 없음).
await ctx.addInitScript(() => {
  const hide = () => {
    const s = document.createElement('style')
    s.textContent = 'nextjs-portal{display:none!important}'
    document.head.appendChild(s)
  }
  if (document.head) hide()
  else document.addEventListener('DOMContentLoaded', hide)
})
if (args['ws-rewrite']) {
  const [from, to] = args['ws-rewrite'].split('=>')
  await ctx.addInitScript(
    ([f, t]) => {
      const Orig = window.WebSocket
      window.WebSocket = new Proxy(Orig, {
        construct(target, list) {
          const [u, ...rest] = list
          const s = String(u)
          return new target(s.startsWith(f) ? t + s.slice(f.length) : s, ...rest)
        },
      })
    },
    [from, to],
  )
}
await ctx.addCookies([{ name: cookieName, value: cookieValue, url: BASE, httpOnly: true, sameSite: 'Lax' }])
const page = await ctx.newPage()
const consoleLines = []
page.on('console', (m) => consoleLines.push(`${m.type()}: ${m.text()}`))
const ttsFetches = []
page.on('response', (r) => {
  const u = r.url()
  if (u.includes('/api/v1/speech/tts/') && !u.endsWith('/status')) ttsFetches.push({ url: u, status: r.status(), type: r.headers()['content-type'] ?? '' })
})

let chatId = null
try {
  // ── 홈: 기본 탭 회화 ───────────────────────────────────────────
  await page.goto(`${BASE}/study/ai`, { waitUntil: 'networkidle' })
  const talkSelected = await page.locator('[role=radio][aria-checked=true]', { hasText: '회화' }).count()
  check('홈 기본 탭 = 회화', talkSelected === 1)
  check('홈 회화 탭: 새 회화 버튼', (await page.getByRole('button', { name: '＋ 새 회화' }).count()) === 1)
  await page.screenshot({ path: join(OUT, 'home-390.png') })

  // ── 방 만들기(API) → 입장 ──────────────────────────────────────
  const created = await page.request.post(`${BASE}/api/v1/chats`, { data: { kind: 'TALK', title: 'E2E 회화' } })
  chatId = (await created.json()).data.id
  check('회화 만들기 #28', created.status() === 200 && !!chatId)
  await page.goto(`${BASE}/study/ai/talk/${chatId}`, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-talk-state]')
  check('회화방 입장 IDLE', (await page.getAttribute('[data-talk-state]', 'data-talk-state')) === 'IDLE')
  check('하단 탭 숨김', (await page.locator('nav[aria-label="주 메뉴"]').count()) === 0)

  const ptt = page.locator('button[aria-describedby="talk-status"]')
  const box = await ptt.boundingBox()
  check('푸시투토크 72×72', box && Math.round(box.width) === 72 && Math.round(box.height) === 72, box ? `${box.width}×${box.height}` : 'none')

  // ── 3폭 넘침·터치 ──────────────────────────────────────────────
  const layout = async (w) => {
    await page.setViewportSize({ width: w, height: 800 })
    await sleep(250)
    return page.evaluate(() => {
      const vw = document.documentElement.clientWidth
      const over = [...document.querySelectorAll('body *')].filter((el) => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.right > vw + 0.5 && getComputedStyle(el).position !== 'fixed'
      }).length
      const small = [...document.querySelectorAll('button, a[href], [role=radio], [role=switch]')]
        .filter((el) => {
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) return false
          const before = getComputedStyle(el, '::before')
          const hitH = before && before.content !== 'none' && before.position === 'absolute' ? Math.max(r.height, parseFloat(before.height) || 0) : r.height
          return Math.min(r.width, hitH) < 43.5
        })
        .map((el) => el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 20))
      return { scroll: document.documentElement.scrollWidth, vw, over, small }
    })
  }
  for (const w of [360, 390, 412]) {
    const l = await layout(w)
    check(`${w}px 가로 넘침 0`, l.scroll === l.vw && l.over === 0, `scrollWidth=${l.scroll} over=${l.over}`)
    check(`${w}px 터치 ≥44px`, l.small.length === 0, l.small.join(', '))
    await page.screenshot({ path: join(OUT, `room-empty-${w}.png`) })
  }
  await page.setViewportSize({ width: 390, height: 844 })

  // ── 푸시투토크 → 인식 → 자동 전송 → 재생 ────────────────────────
  const states = []
  await page.exposeFunction('__talkState', (s, t) => states.push([s, t]))
  await page.evaluate(() => {
    const el = document.querySelector('[data-talk-state]')
    let last = ''
    const tick = () => {
      const s = el?.getAttribute('data-talk-state') ?? ''
      if (s !== last) {
        last = s
        window.__talkState(s, performance.now())
      }
      requestAnimationFrame(tick)
    }
    tick()
  })
  const b = await ptt.boundingBox()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await page.mouse.down()
  await sleep(HOLD_MS)
  const releasedAt = await page.evaluate(() => performance.now())
  await page.mouse.up()
  await page.waitForFunction(() => document.querySelector('[data-talk-state]')?.getAttribute('data-talk-state') === 'SPEAKING', null, { timeout: 25_000 }).catch(() => null)
  const speakingAt = states.find(([s]) => s === 'SPEAKING')?.[1]
  check('상태 흐름 RECORDING→RECOGNIZING→THINKING→SPEAKING', ['RECORDING', 'RECOGNIZING', 'THINKING', 'SPEAKING'].every((s) => states.some(([x]) => x === s)), states.map(([s]) => s).join('→'))
  check('손 뗌→첫 재생(클라 관측)', speakingAt !== undefined, speakingAt ? `${Math.round(speakingAt - releasedAt)}ms` : '재생 없음')
  const userBubble = await page.locator('li p[lang=ja]').first().textContent()
  check('사용자 말풍선 = 인식 텍스트', !!userBubble && userBubble.length > 1, userBubble ? `${[...userBubble].length}자` : '')
  await page.screenshot({ path: join(OUT, 'room-speaking-390.png') })
  const highlighted = await page.locator('span.bg-accent-soft').count()
  check('재생 중 문장 강조', highlighted >= 1)
  check('이름 줄 "말하는 중"', (await page.getByText('말하는 중', { exact: false }).count()) >= 1)
  await page.waitForFunction(() => document.querySelector('[data-talk-state]')?.getAttribute('data-talk-state') === 'IDLE', null, { timeout: 30_000 }).catch(() => null)
  check('재생 끝 → IDLE', (await page.getAttribute('[data-talk-state]', 'data-talk-state')) === 'IDLE')
  const voiceCards = await page.locator('li[id^="cr_"]').count()
  // 합성 테스트 음성은 인식기가 틀린 활용을 바로잡아 적을 수 있다(行くました→行きました) — 음성 턴의 교정 유무는 참고만.
  console.log(`INFO  음성 턴 교정 카드 ${voiceCards}장(인식 결과에 따라 0 가능)`)
  check('▶ 다시 듣기 버튼', (await page.getByRole('button', { name: '선생님 말 다시 듣기' }).count()) >= 1)
  check('▶ 내 목소리 버튼', (await page.getByRole('button', { name: '내 목소리 다시 듣기' }).count()) >= 1)
  await sleep(4_500) // 커밋 지연으로 404 재시도 중인 청크 받기가 끝나기를 기다린다(재시도 대기 합 4초)
  // 서명 URL 은 출력하지 않는다 — URL 별 마지막 응답만 센다(방금 합성된 청크는 커밋 지연으로 404 뒤 재시도 200 일 수 있다).
  const lastByUrl = new Map()
  for (const f of ttsFetches) lastByUrl.set(f.url, f)
  const finals = [...lastByUrl.values()]
  const retried404 = ttsFetches.filter((f) => f.status === 404).length
  check('청크 받기(#24) 청크마다 최종 200 audio/wav', finals.length > 0 && finals.every((f) => f.status === 200 && f.type.startsWith('audio/')), `청크 ${finals.length}개, 404 뒤 재시도 ${retried404}회`)
  await page.screenshot({ path: join(OUT, 'room-done-390.png'), fullPage: false })

  // ── 다시 듣기 2종 ──────────────────────────────────────────────
  await page.getByRole('button', { name: '선생님 말 다시 듣기' }).last().click()
  const replayOk = await page.waitForFunction(() => document.getElementById('talk-status')?.textContent?.includes('다시 듣는 중'), null, { timeout: 10_000 }).then(() => true, () => false)
  check('선생님 다시 듣기 → "다시 듣는 중"', replayOk)
  await page.getByRole('button', { name: '선생님 말 멈추기' }).click().catch(() => undefined)
  await sleep(200)
  if ((await page.getByRole('button', { name: '내 목소리 다시 듣기' }).count()) > 0) {
    await page.getByRole('button', { name: '내 목소리 다시 듣기' }).first().click()
    const mineOk = await page.waitForFunction(() => document.getElementById('talk-status')?.textContent?.includes('내 목소리를 듣는 중'), null, { timeout: 10_000 }).then(() => true, () => false)
    check('내 목소리 다시 듣기(#21b) → "내 목소리를 듣는 중"', mineOk)
    await page.getByRole('button', { name: '선생님 말 멈추기' }).click().catch(() => undefined)
  }
  await sleep(300)

  // ── 글자 입력 전환 + 틀린 문장 → 교정 카드 즉시 ─────────────────
  // (가짜 마이크 파일은 누를 때마다 처음부터가 아니라 이어서 재생돼 두 번째 음성 턴은 무음일 수 있다 — 교정·barge-in 은 글자 턴의 답으로 본다.)
  await page.getByRole('button', { name: '글자로 입력하기' }).click()
  const ta = page.getByRole('textbox', { name: '메시지 입력' })
  check('글자 모드 전환', (await ta.count()) === 1)
  const WRONG = '昨日、友達と映画を見に行くました。'
  await ta.fill(WRONG)
  await page.getByRole('button', { name: '보내기' }).click()
  const textTurn = await page
    .waitForFunction((w) => [...document.querySelectorAll('li p[lang=ja]')].some((p) => p.textContent === w), WRONG, { timeout: 10_000 })
    .then(() => true, () => false)
  check('글자로 보내기 → 사용자 말풍선(원문 그대로)', textTurn)

  // ── barge-in: 이 답이 소리 나는 중에 음성 모드로 돌아가 누르면 즉시 녹음 ─────
  const sp2 = await page.waitForFunction(() => document.querySelector('[data-talk-state]')?.getAttribute('data-talk-state') === 'SPEAKING', null, { timeout: 25_000 }).then(() => true, () => false)
  check('글자 턴 답도 소리로(SPEAKING)', sp2)
  if (sp2) {
    await page.getByRole('button', { name: '말로 입력하기' }).click()
    const bb = await ptt.boundingBox()
    const stillSpeaking = (await page.getAttribute('[data-talk-state]', 'data-talk-state')) === 'SPEAKING'
    const label = await ptt.getAttribute('aria-label')
    check('말하는 중 PTT 라벨 = 누르면 멈추고 말하기', !stillSpeaking || label === '누르면 선생님 말을 멈추고 말하기', label ?? '')
    const t0 = await page.evaluate(() => performance.now())
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2)
    await page.mouse.down()
    const rec = await page.waitForFunction(() => document.querySelector('[data-talk-state]')?.getAttribute('data-talk-state') === 'RECORDING', null, { timeout: 2_000 }).then(() => true, () => false)
    const t1 = await page.evaluate(() => performance.now())
    check('barge-in: 재생 중 누름 → RECORDING(소리 멈춤)', rec && stillSpeaking, `${Math.round(t1 - t0)}ms${stillSpeaking ? '' : ' (누르기 전에 재생이 끝남)'}`)
    await sleep(150)
    await page.mouse.up() // 300ms 미만 = 짧게 누름 → 녹음 취소(보내지 않음)
  }
  await page.waitForFunction(() => document.querySelector('[data-talk-state]')?.getAttribute('data-talk-state') === 'IDLE', null, { timeout: 40_000 }).catch(() => null)
  check('barge-in 뒤 남은 청크 자동재생 없음 → IDLE', (await page.getAttribute('[data-talk-state]', 'data-talk-state')) === 'IDLE')
  const cards = await page.locator('li[id^="cr_"]').count()
  check('교정 카드 즉시(사용자 말풍선 아래)', cards >= 1, `${cards}장`)
  check('교정 카드 카운터 숨김', (await page.locator('li[id^="cr_"]').getByText(/^\d+\/\d+$/).count()) === 0)
  if (cards >= 1) {
    const origin = await page.locator('li[id^="cr_"]').last().locator('p[lang=ja]').first().textContent()
    check('교정 원문 = 보낸 글 그대로', origin === WRONG.replace(/。$/, '') || origin === WRONG, origin ?? '')
    await page.locator('li[id^="cr_"]').last().scrollIntoViewIfNeeded()
    await page.screenshot({ path: join(OUT, 'room-correction-390.png') })
  }
  check('음성 모드 복귀', (await ptt.count()) === 1)

  // ── 엔진명·서명 URL 비노출 ─────────────────────────────────────
  const leak = await page.evaluate((reSrc) => {
    const re = new RegExp(reSrc, 'i')
    const text = document.body.innerText
    const labels = [...document.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label')).join(' ')
    const attrs = [...document.querySelectorAll('*')].flatMap((e) => [...e.attributes].map((a) => a.value)).filter((v) => v.includes('/api/v1/speech/tts/'))
    return { text: re.test(text), labels: re.test(labels), urlAttrs: attrs.length }
  }, ENGINE_RE.source)
  check('화면·aria 엔진명 0', !leak.text && !leak.labels)
  check('DOM 속성에 서명 URL 0', leak.urlAttrs === 0)
  check('콘솔에 서명 URL·엔진명 0', !consoleLines.some((l) => l.includes('/api/v1/speech/tts/') || ENGINE_RE.test(l)))
  // 브라우저는 실패한 fetch 를 콘솔 오류로 찍는다 — 청크 404 재시도(서버 커밋 지연)는 따로 세고 나머지만 본다.
  await sleep(4_500)
  const allLast = new Map()
  for (const f of ttsFetches) allLast.set(f.url, f)
  const all404 = ttsFetches.filter((f) => f.status === 404).length
  check('모든 턴 청크 최종 200(재시도 포함)', [...allLast.values()].every((f) => f.status === 200), `청크 ${allLast.size}개, 404 뒤 재시도 ${all404}회`)
  const errors = consoleLines.filter((l) => l.startsWith('error'))
  const nonChunk = errors.filter((l) => !l.includes('status of 404'))
  check('콘솔 오류 0(청크 404 재시도 제외)', nonChunk.length === 0 && errors.length - nonChunk.length <= all404, nonChunk.slice(0, 3).join(' | '))
  for (const w of [360, 412]) {
    const l = await layout(w)
    check(`${w}px 대화 뒤 가로 넘침 0`, l.scroll === l.vw && l.over === 0, `over=${l.over}`)
    await page.screenshot({ path: join(OUT, `room-done-${w}.png`) })
  }
} catch (e) {
  check('실행', false, String(e?.message ?? e).slice(0, 300))
} finally {
  if (chatId) {
    const del = await page.request.delete(`${BASE}/api/v1/chats/${chatId}`).catch(() => null)
    console.log(`cleanup chat: ${del ? del.status() : 'failed'}`)
  }
  await browser.close()
  const failed = results.filter((r) => !r.ok).length
  console.log(`\nRESULT ${results.length - failed}/${results.length} PASS`)
  process.exitCode = failed ? 1 : 0
}
