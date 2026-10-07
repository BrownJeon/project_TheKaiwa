/**
 * qa-045-ui-e3 보조 — 변형 화면(선택·만드는 중·검토·오류) 보이는 글에 엔진·모델명·「AI」·서버 message 가 없는지. DB 쓰기 0, #177 모의.
 * 실행: cd $Q && QA_BASE=http://127.0.0.1:3057 QA_SNAPSHOT=$Q QA_COOKIE=<c3 쿠키 파일> node --env-file=.env <이 파일>
 */
import { check, note, summary, launch, openPage, cookieOf, sleep, BASE, SEED_SC, prisma, closeBrowser } from '../e/lib.mjs'
import { env, errEnv, SRV_MSG, draftFromSeed, mockPost, tap, pageText } from '../e/ui.mjs'

const FORBID = /\bAI\b|reazon|whisper|style-bert|claude|qwen|haiku|sonnet|opus|model_id|speaker_id|SECRET-MSG/gi
const cookie = cookieOf(process.env.QA_COOKIE)
const base = await draftFromSeed(cookie, SEED_SC)
const browser = await launch()
try {
  const { ctx, page } = await openPage(browser, 390, 844, cookie)
  let mode = 'gen'
  await mockPost(page, '**/api/v1/scenarios/*/variants/drafts', async () => (mode === 'gen' ? { delay: 1500, json: env({ draft: base.draft, changedFields: ['title', 'steps'], axes: { persona: 'kind', twist: 'none', flow: 'same', level: 'same' } }) } : { delay: 150, status: 502, json: errEnv('ENGINE_ERROR', {}, SRV_MSG) }))
  await page.goto(`${BASE}/study/ai/scenario/${SEED_SC}/variant`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.getByText('무엇을 바꿔 볼까요?').first().waitFor({ timeout: 90000 })
  await sleep(300)
  const seen = {}
  seen.pick = await pageText(page)
  await tap(page, page.locator('label:has(input[name="va-persona"][value="kind"])').first())
  mode = 'fail'
  await tap(page, page.locator('button', { hasText: '변형 초안 만들기' }).first())
  await sleep(1000)
  seen.fail = await pageText(page)
  mode = 'gen'
  await tap(page, page.locator('button', { hasText: '다시 만들기' }).first())
  await sleep(500)
  seen.gen = await pageText(page)
  await page.waitForSelector('text=변형 초안이 왔어요', { timeout: 10000 }).catch(() => {})
  seen.review = await pageText(page)
  for (const [k, t] of Object.entries(seen)) {
    const hits = t.match(FORBID) ?? []
    check(`[390] 변형 화면 ${k} 단계 보이는 글: 엔진·모델명·AI·서버 message 0건`, hits.length === 0, JSON.stringify(hits) + ' len=' + t.length)
  }
  await ctx.close()
} finally {
  await closeBrowser(browser)
  summary('probe-text')
  await prisma.$disconnect()
  process.exit(0)
}
