/**
 * qa-p2b — 오늘 탭(챌린지 진행 중, 실제 서버·실제 데이터)의 **실측 화면 지표** — 폭 360·390·412 × 높이 892(DSF 2.625·isMobile·hasTouch·ko-KR·Asia/Seoul·reducedMotion):
 * 가로 넘침(px) · 페이지 레벨 세로 스크롤 여부(main 스크롤 영역 수) · 터치 대상(button·a[href]·[role=button])의 **히트 영역 반영** 최소 크기 — `::before` 확장
 * (position:absolute·음수 inset)을 계산 스타일로 읽어 본체 rect 에 더한다(qa-p2a task044-screens-x 와 같은 취지). 44px 미만 목록은 이름과 함께 찍는다.
 * LLM 0 — 챌린지(단어+회화 켬) 하나를 만들고 #158·#58 만 읽는다. 쓰기: 챌린지 1건(끝에 지움).
 *   BASE=http://127.0.0.1:3032 node --env-file=.env --import tsx tests/live/p2b-qa/today-touch-probe.ts /tmp/c3
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { QA_USER_WHERE } from '../../../src/modules/infra/users'

/* eslint-disable @typescript-eslint/no-explicit-any -- playwright-core 는 프로젝트 의존성이 아니라 동적 import(타입 없음) */
if ((process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 환경에서는 실행하지 않는다')
const BASE = process.env.BASE ?? 'http://127.0.0.1:3032'
const bm = /^http:\/\/(127\.0\.0\.1|localhost):(\d+)$/.exec(BASE)
if (!bm || Number(bm[2]) === 3010) throw new Error('BASE 는 localhost(운영 3010 제외)만 허용')
const COOKIE = readFileSync(process.argv[2] ?? '', 'utf8').trim()
const [cname, ...crest] = COOKIE.split('=')
const prisma = new PrismaClient()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function api(method: string, path: string, body?: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  const r = await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', Cookie: COOKIE }, body: body === undefined ? undefined : JSON.stringify(body) })
  const j = (await r.json().catch(() => ({}))) as { data?: Record<string, unknown> }
  return { status: r.status, data: j.data ?? {} }
}

async function main(): Promise<void> {
  const user = await prisma.user.findFirst({ where: { AND: [{ email: 'qa-bot3@thekaiwa.test' }, QA_USER_WHERE] }, select: { id: true } })
  if (!user) throw new Error('QA 계정 3 이 없다')
  if (await prisma.challenge.count({ where: { userId: user.id, status: 'ACTIVE' } })) throw new Error('계정 3 에 진행 중 챌린지가 있다')
  const topic = await prisma.conversationTopic.findFirstOrThrow({ where: { userId: null, chunks: { some: {} } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true } })
  const c = await api('POST', '/api/v1/challenges', { topicId: topic.id, lengthDays: 7, start: 'TODAY', dailyGoal: { lesson: true, words: true, wordCount: 10 } })
  const cid = String(c.data.id ?? '')
  // playwright-core 는 프로젝트 의존성이 아니라(상위 node_modules) 정적 import 하면 클린 체크아웃 tsc 가 TS2307 — 변수 지정자로 동적 import(task044-screens.ts 와 같은 방식).
  const pwName = 'playwright-core'
  const { chromium } = (await import(pwName)) as { chromium: any }
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', headless: true })
  let fails = 0
  try {
    for (const width of [360, 390, 412]) {
      const ctx = await browser.newContext({ viewport: { width, height: 892 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' })
      await ctx.addCookies([{ name: cname, value: crest.join('='), url: BASE, httpOnly: true }])
      // 쓰기는 막는다(화면 확인만).
      await ctx.route('**/api/**', (r: any) => (r.request().method() === 'GET' ? r.continue() : r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":{},"message":null}' })))
      const page = await ctx.newPage()
      // tsx(esbuild keepNames)가 page.evaluate 안의 이름 있는 함수에 `__name` 호출을 넣는다 — 페이지에 같은 이름의 빈 래퍼를 둔다.
      await page.addInitScript('window.__name = (f) => f')
      await page.goto(`${BASE}/study/today`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      for (let i = 0; i < 60; i++) {
        if (/새 단어 10장/.test(await page.evaluate(() => document.body.innerText))) break
        await sleep(300)
      }
      await sleep(800)
      const m = await page.evaluate(() => {
        const over = Math.max(document.documentElement.scrollWidth - window.innerWidth, 0)
        const scrollers = Array.from(document.querySelectorAll('*')).filter((el) => {
          const cs = getComputedStyle(el)
          return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1
        }).length
        const docScroll = document.documentElement.scrollHeight > window.innerHeight + 1
        const px = (v: string) => (v.endsWith('px') ? parseFloat(v) : 0)
        const small: { name: string; raw: string; eff: string }[] = []
        let minEff = 999
        for (const el of Array.from(document.querySelectorAll('button,a[href],[role="button"]'))) {
          const h = el as HTMLElement
          if (h.offsetParent === null) continue
          const r = h.getBoundingClientRect()
          if (r.width <= 0 || r.height <= 0) continue
          const b = getComputedStyle(h, '::before')
          let effH = r.height
          let effW = r.width
          if (b.content !== 'none' && b.position === 'absolute') {
            effH = r.height - Math.min(px(b.top), 0) - Math.min(px(b.bottom), 0)
            effW = r.width - Math.min(px(b.left), 0) - Math.min(px(b.right), 0)
          }
          minEff = Math.min(minEff, Math.min(effH, effW))
          if (effH < 44 || effW < 44) small.push({ name: (h.getAttribute('aria-label') ?? h.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 30), raw: `${Math.round(r.width)}x${Math.round(r.height)}`, eff: `${Math.round(effW)}x${Math.round(effH)}` })
        }
        const tabs = document.querySelector('nav')
        const tabsBottom = tabs ? Math.round(window.innerHeight - tabs.getBoundingClientRect().bottom) : -1
        return { over, scrollers, docScroll, small, minEff: Math.round(minEff), tabsBottom }
      })
      console.log(`${m.over === 0 && m.small.length === 0 ? 'PASS' : 'FAIL'} W${width} — 가로 넘침 ${m.over}px · 내부 스크롤 영역 ${m.scrollers}곳 · 문서 세로 스크롤 ${m.docScroll ? '있음' : '없음'} · 히트영역 반영 터치 대상 최소 ${m.minEff}px · 44px 미만 ${m.small.length}개${m.small.length ? ' ' + JSON.stringify(m.small) : ''}`)
      if (m.over !== 0 || m.small.length) fails++
      await ctx.close()
    }
  } finally {
    await browser.close()
    if (cid) await prisma.challenge.deleteMany({ where: { id: cid, userId: user.id } })
    console.log('정리: 챌린지 1건')
  }
  console.log(`\n결과: ${fails ? `FAIL ${fails}` : 'PASS'}`)
  if (fails) process.exitCode = 1
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
