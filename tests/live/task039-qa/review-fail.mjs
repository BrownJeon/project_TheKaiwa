// task-039 QA — 표현 점검(A3) 엔진 실패 주입(서버를 CLAUDE_CLI_PATH=없는 경로 로 기동): 서버 응답·부분 저장·다시 시도·화면 FAIL_TEXT·[다시 시도]·3폭 가로 넘침.
// 주의: 타임아웃(90s)이 아니라 엔진 실행 실패 주입이다 — 같은 "점검 실패" 경로(AiJob FAILED·오류 응답)를 타는지 본다.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { chromium } from 'playwright-core'
const a = Object.fromEntries(process.argv.slice(2).reduce((acc, x, i, all) => (x.startsWith('--') ? [...acc, [x.slice(2), all[i + 1]]] : acc), []))
const BASE = a.base
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE) || /:3010$/.test(BASE)) throw new Error('dev localhost 만')
const cookie = readFileSync(a.cookie, 'utf8').trim()
const [cname, ...cr] = cookie.split('=')
const prisma = new PrismaClient()
const fx = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/chat-review-style.json'), 'utf8')).messages
const results = []
const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`) }
const api = async (m, p, j) => { const r = await fetch(BASE + p, { method: m, headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: j === undefined ? undefined : JSON.stringify(j) }); const t = await r.text(); let b = {}; try { b = JSON.parse(t) } catch {} ; return { status: r.status, body: b, text: t } }
const chatIds = []
try {
  const c = await api('POST', '/api/v1/chats', { kind: 'CHAT', title: 'qa039 fail' })
  const chatId = c.body.data.id
  chatIds.push(chatId)
  const userId = (await prisma.chat.findUnique({ where: { id: chatId }, select: { userId: true } })).userId
  const base = Date.now() - 3_600_000
  for (let k = 0; k < fx.length; k++) await prisma.chatMessage.create({ data: { chatId, userId, role: 'USER', content: fx[k].text, inputSource: 'TEXT', status: 'DONE', createdAt: new Date(base + k * 60000) } })
  await prisma.chat.update({ where: { id: chatId }, data: { messageCount: fx.length, lastMessageAt: new Date(base + 14 * 60000) } })
  const wordBase = await prisma.wordEntry.count({ where: { userId } })
  const state = async () => ({ corr: await prisma.correction.count({ where: { chatId } }), reviewedAt: (await prisma.chat.findUnique({ where: { id: chatId }, select: { reviewedAt: true } })).reviewedAt, props: await prisma.tutorProposal.count({ where: { chatId } }), jobs: await prisma.aiJob.findMany({ where: { userId, refId: chatId }, select: { status: true, kind: true } }), words: (await prisma.wordEntry.count({ where: { userId } })) - wordBase })
  const r1 = await api('POST', `/api/v1/chats/${chatId}/review`)
  const s1 = await state()
  console.log(`  1회차 POST #33 → status ${r1.status} code=${r1.body?.data?.code ?? '-'} msg=${String(r1.body?.message ?? '').slice(0, 80)} · 상태 ${JSON.stringify(s1)}`)
  check('엔진 실패 → #33 오류 응답(200 아님·본문에 엔진·경로 문자열 없음)', r1.status >= 400 && !/claude|nonexistent|spawn|ENOENT|\/home\//i.test(r1.text), `status=${r1.status}`)
  check('실패 후 부분 저장 없음(교정 0·reviewedAt null·제안 0·단어 0)·AiJob 은 FAILED', s1.corr === 0 && s1.reviewedAt === null && s1.props === 0 && s1.words === 0 && s1.jobs.every((j) => j.status === 'FAILED'), JSON.stringify(s1))
  const r2 = await api('POST', `/api/v1/chats/${chatId}/review`)
  const s2 = await state()
  check('다시 시도(같은 POST)도 같은 실패·409 ALREADY_REVIEWED/CONFLICT 아님·중복·부분 행 없음', r2.status === r1.status && s2.corr === 0 && s2.reviewedAt === null && s2.props === 0 && s2.jobs.filter((j) => j.status === 'FAILED').length === s2.jobs.length, `status=${r2.status} jobs=${JSON.stringify(s2.jobs.map((j) => j.status))}`)
  // 화면
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
  try {
    for (const w of [360, 390, 412]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 780 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' })
      await ctx.addCookies([{ name: cname, value: cr.join('='), url: BASE }])
      const page = await ctx.newPage()
      const errs = []
      page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)))
      await page.goto(`${BASE}/study/ai/chat/${chatId}/review`, { waitUntil: 'load' })
      await page.getByRole('button', { name: /점검 받기/ }).first().waitFor({ timeout: 25000 }).catch(() => undefined)
      const startBtn = page.getByRole('button', { name: /점검 받기/ })
      check(`${w} 안내 화면에 [점검 받기]`, (await startBtn.count()) > 0)
      await startBtn.first().click()
      await page.waitForSelector('text=점검을 끝내지 못했어요', { timeout: 30000 }).catch(() => undefined)
      const failShown = (await page.getByText('점검을 끝내지 못했어요').count()) > 0
      const retry = page.getByRole('button', { name: /다시 점검하기/ })
      const retryH = (await retry.count()) ? Math.round((await retry.first().boundingBox()).height) : 0
      const ov = await page.evaluate(() => { const de = document.documentElement; const over = [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > de.clientWidth + 0.5 }); return { n: over.length, pageV: de.scrollHeight - innerHeight, engine: (document.body.innerHTML.match(/reazon|whisper|style-?bert|model_id|speaker_id|claude|haiku|sonnet|ENOENT|nonexistent/gi) || []).length } })
      check(`${w} FAIL_TEXT 표시·[다시 점검하기] 높이 ≥44px·가로 넘침 0·엔진/경로 문자열 0`, failShown && retryH >= 44 && ov.n === 0 && ov.engine === 0 && errs.length === 0, `fail=${failShown} retryH=${retryH} over=${ov.n} engine=${ov.engine} pageerr=${errs.length}`)
      if (retryH) {
        await retry.first().click()
        await page.waitForTimeout(500)
        await page.waitForSelector('text=점검을 끝내지 못했어요', { timeout: 30000 }).catch(() => undefined)
        const again = (await page.getByText('점검을 끝내지 못했어요').count()) > 0 && (await page.getByRole('button', { name: /다시 점검하기/ }).count()) > 0
        check(`${w} [다시 점검하기] 누른 뒤에도 같은 실패 화면(깨지지 않음)`, again)
      }
      await ctx.close()
    }
  } finally { await browser.close() }
  const sf = await state()
  check('3폭 × 화면 점검 시도 뒤에도 부분 저장·중복 없음(교정 0·reviewedAt null·제안 0·단어 0)', sf.corr === 0 && sf.reviewedAt === null && sf.props === 0 && sf.words === 0, `${JSON.stringify({ corr: sf.corr, props: sf.props, words: sf.words, jobs: sf.jobs.length, failedJobs: sf.jobs.filter((j) => j.status === 'FAILED').length })}`)
} finally {
  for (const id of chatIds) await prisma.chat.delete({ where: { id } }).catch(() => undefined)
  await prisma.$disconnect()
}
console.log(`\n결과: ${results.filter(Boolean).length}/${results.length} PASS`)
process.exitCode = results.every(Boolean) ? 0 : 1
