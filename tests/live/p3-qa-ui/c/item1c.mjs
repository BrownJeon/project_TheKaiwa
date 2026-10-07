/**
 * 항목 1C — S3 서버 응답 → 고정 문구(page.route 스텁, Claude 호출 0), 390×844.
 * 15초 「조금 더 걸리고 있어요」·벽시계·502·409·429·422(서버 message 가 화면에 안 나옴)·400·네트워크 단절.
 */
import { tapAt, BASE, NEW_PATH, SSDIR, activeInfo, check, closeBrowser, cookieOf, launch, mainText, note, openPage, prisma, sleep, summary, j } from './lib.mjs'

const c4 = cookieOf(process.env.QA_COOKIE)
const browser = await launch()
const { ctx, page, reqs, errors } = await openPage(browser, 390, 844, c4)
page.setDefaultTimeout(60000)
const SECRET = 'SERVER-MSG-XYZ-엔진명-sherpa'
const env = (status, code, details, message = SECRET) => ({ status, contentType: 'application/json', body: JSON.stringify({ success: false, data: { code, ...(details ? { details } : {}) }, message }) })
const input = () => page.locator('#tp-ask')
const submit = () => page.getByRole('button', { name: '초안 만들기', exact: true })
const d170 = () => reqs.filter((r) => r.m === 'POST' && r.p === '/api/v1/topics/drafts')
let handler = null
await page.route('**/api/v1/topics/drafts', (route) => handler(route))
async function go() {
  await page.goto(BASE + NEW_PATH, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await input().waitFor({ state: 'visible' })
  await sleep(500)
}
async function run(text, h, waitMs = 1500) {
  handler = h
  await input().fill(text)
  await sleep(120)
  await tapAt(page, submit())
  await sleep(waitMs)
}
try {
  await go()
  // 1) 15초 넘으면 한 줄 더 → 502
  const t0 = Date.now()
  handler = async (route) => { await sleep(16500); await route.fulfill(env(502, 'UPSTREAM_ERROR', null)) }
  await input().fill('병원 진료')
  await tapAt(page, submit())
  await sleep(14000)
  const early = await mainText(page)
  check('1C-14초 시점엔 「조금 더 걸리고 있어요」 아직 없음', !early.includes('조금 더 걸리고 있어요'), `t=${Date.now() - t0}ms`)
  await sleep(2000)
  const late = await mainText(page)
  const at = Date.now() - t0
  check(`1C-15초(실측 ${at}ms)를 넘기면 「조금 더 걸리고 있어요. 그만두고 다시 만들어도 돼요.」 한 줄 더`, late.includes('조금 더 걸리고 있어요. 그만두고 다시 만들어도 돼요.') && late.includes('선생님이 주제 초안을 만들고 있어요'), late.slice(0, 200))
  await sleep(1800)
  const t502 = await mainText(page)
  const btnRetry = await page.getByRole('button', { name: '다시 만들기' }).count()
  const a502 = await activeInfo(page)
  check('1C-502 → 고정 문구 「잠시 문제가 생겼어요. 다시 만들어 볼까요?」 + [다시 만들기]·서버 message 노출 0', t502.includes('잠시 문제가 생겼어요. 다시 만들어 볼까요?') && btnRetry === 1 && !t502.includes('SERVER-MSG') && !t502.includes('sherpa') && !t502.includes('엔진명'), `retryBtn=${btnRetry} active=${j(a502)} text=${t502.slice(0, 220)}`)
  check('1C-502 후 입력 유지(「병원 진료」)', (await input().inputValue()) === '병원 진료')
  // 2) 422 — 서버 message 노출 0
  await run('오늘 날씨 어때', async (route) => route.fulfill(env(422, 'UNPROCESSABLE', { reason: 'NOT_A_TOPIC' })))
  let t = await mainText(page)
  let a = await activeInfo(page)
  check('1C-422 NOT_A_TOPIC(서버 message 를 바꿔도) → 고정 문구 「이 글로는 주제를 만들기 어려워요…」·서버 message 0·입력칸 초점', t.includes('이 글로는 주제를 만들기 어려워요. 장소·상황·활동 이름을 적어 주세요(예: 병원 진료, 공항 체크인).') && !t.includes('SERVER-MSG') && a?.id === 'tp-ask', `active=${j(a)}`)
  // 3) 409
  await run('병원 진료', async (route) => route.fulfill(env(409, 'CONFLICT', { reason: 'DRAFT_BUSY' })))
  t = await mainText(page)
  check('1C-409 DRAFT_BUSY → 고정 문구 「다른 화면에서 주제 초안을 만드는 중이에요…」·서버 message 0', t.includes('다른 화면에서 주제 초안을 만드는 중이에요. 끝난 뒤 다시 눌러 주세요.') && !t.includes('SERVER-MSG'), t.slice(0, 200))
  // 4) 429 분당
  await run('병원 진료', async (route) => route.fulfill(env(429, 'RATE_LIMITED', { retryAfterSec: 33 })))
  t = await mainText(page)
  note('429 분당 화면: ' + t.slice(60, 260))
  check('1C-429(분당 retryAfterSec 33) → 「초안은 1분에 6번까지 만들 수 있어요. 33초 뒤 다시 눌러 주세요.」·서버 message 0', t.includes('초안은 1분에 6번까지 만들 수 있어요. 33초 뒤 다시 눌러 주세요.') && !t.includes('SERVER-MSG'))
  // 5) 429 하루(24시간급 retryAfterSec)
  await run('병원 진료', async (route) => route.fulfill(env(429, 'RATE_LIMITED', { retryAfterSec: 7200 })))
  t = await mainText(page)
  const blocked = await submit().getAttribute('aria-disabled')
  note('429 하루 화면: ' + t.slice(60, 280) + ` | 제출 aria-disabled=${blocked}`)
  check('1C-429(하루급 retryAfterSec 7200) → 「오늘은 주제 초안을 20번 모두 만들었어요. 약 2시간 뒤 다시 만들 수 있어요.」·[초안 만들기] 막힘', t.includes('오늘은 주제 초안을 20번 모두 만들었어요. 약 2시간 뒤 다시 만들 수 있어요.') && blocked === 'true', `aria-disabled=${blocked}`)
  // 6) 400 칸
  await go()
  await run('병원 진료', async (route) => route.fulfill(env(400, 'BAD_REQUEST', { field: 'title', reason: 'forbidden_char' })))
  t = await mainText(page)
  a = await activeInfo(page)
  check('1C-400 title forbidden_char → 칸 고정 문구(「을(를)」 병기 0)·서버 message 0·입력칸 초점', !t.includes('SERVER-MSG') && !t.includes('을(를)') && /쓸 수 없어요|적어 주세요/.test(t) && a?.id === 'tp-ask', `active=${j(a)} text=${t.slice(60, 260)}`)
  // 7) 네트워크 단절
  await run('병원 진료', async (route) => route.abort('failed'))
  t = await mainText(page)
  check('1C-네트워크 단절 → 「인터넷 연결을 확인한 뒤 다시 눌러 주세요.」', t.includes('인터넷 연결을 확인한 뒤 다시 눌러 주세요.'), t.slice(60, 240))
  check('1C-스텁 요청 총 건수 = 스텁한 횟수(서버 호출 0)', d170().length >= 7, `n=${d170().length} statuses=${j(d170().map((r) => r.status))}`)
  check('1C-페이지 오류 0', errors.length === 0, errors.join('|'))
  await page.screenshot({ path: `${SSDIR}/item1c-390.png` })
} catch (e) {
  check('1C-스크립트 오류', false, String(e).slice(0, 400))
} finally {
  await ctx.close()
}
await closeBrowser(browser)
summary('항목 1C')
await prisma.$disconnect()
