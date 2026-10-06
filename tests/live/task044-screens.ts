/**
 * task-044 화면 상태 확인(가이드 §6 A 안) — **API 응답을 전부 가로채 고정 응답을 주입**한다. DB 를 쓰는 요청은 보내지 않는다:
 * 알려진 #158·#58·#46·#48·#49·#54·#47 은 고정 응답, 그 밖 GET 은 통과(읽기), 그 밖 쓰기 요청은 막고 기록한다.
 * 세션은 QA 계정 3 의 id 를 **읽기만** 해서 qa 토큰(1시간)을 직접 만든다(qa-session.ts 의 upsert 를 쓰지 않음).
 * 확인: 360/390/412 × 780/892 — 가로 넘침 0 · 스크롤 영역 1곳 · 44px 미만 터치 대상 목록 · 덱 첫 화면 스크롤 없음(780) · 대기 화면 떠나면 #47 취소.
 * 대기 화면 행(`w.gen`·`w.busy409`·`w.leave`)은 #47 응답을 붙잡아 두므로 networkidle 을 기다리지 않는다(task043-screens 와 같은 방식) —
 * `domcontentloaded` 로 들어가 대기 문구가 보이면 그 상태(응답 보류 중)를 잰다. 붙잡은 응답은 `HOLD_MS` 뒤 풀리지만 그 전에 창을 닫는다.
 * 실행(미러, dev 서버 `next dev -H 127.0.0.1 -p 3026` 따로): `node --env-file=.env --import tsx tests/live/task044-screens.ts 3026`
 * 브라우저: playwright-core(상위 node_modules) + 시스템 Chrome(`CHROME_PATH`, 기본 /usr/bin/google-chrome).
 * 가드: `APP_ENV=PRODUCTION` 거부 · 서버는 localhost 이고 운영 포트 3010 거부(가로채지 않는 GET 이 운영으로 나가지 않게).
 */
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import { SESSION_COOKIE_NAME } from '../../src/modules/infra/jwt'

type Json = Record<string, unknown>
/* eslint-disable @typescript-eslint/no-explicit-any -- playwright-core 는 프로젝트 의존성이 아니라 동적 import(타입 없음) */
type Page = any

if ((process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 환경에서는 실행하지 않는다')
const PORT = process.argv[2] ?? '3026'
const BASE = `http://127.0.0.1:${PORT}`
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE) || BASE.endsWith(':3010')) throw new Error('BASE 는 localhost(운영 3010 제외)만 허용')
/** 대기 화면 행에서 #47 응답을 붙잡아 두는 시간 — 대기 상태를 재고 창을 닫기까지 충분하면 된다. */
const HOLD_MS = 15_000
const kst = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const yday = new Date(Date.now() + 9 * 3600_000 - 86_400_000).toISOString().slice(0, 10)
const ok = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data, message: null }) })
const conflict = (details: Json) => ({ status: 409, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'conflict', data: { code: 'CONFLICT', details } }) })

// ── 고정 응답 ──────────────────────────────────────────────────────────────────────────────
const challenge = {
  id: 'ch1', title: '카페 주문 7일 챌린지', topic: { id: 'tp1', title: '카페 주문', exists: true }, level: 'N5', lengthDays: 7, startDate: yday, endDate: kst, status: 'ACTIVE',
  dailyGoal: { lesson: true, words: true, wordCount: 10, wordsMinAnswered: 8, countSkipped: false, ruleVersion: 1 },
  stats: { dayIndex: 4, elapsedDays: 3, metDays: 2, rate: 0.67, streak: 2, longestStreak: 2, todayMet: false }, endedAt: null,
}
const words = (state: string, answered = 0, sessionId: string | null = null) => ({ kind: 'WORDS', state, sessionId, wordCount: 10, minAnswered: 8, answered, sets: answered ? 1 : 0 })
const lesson = (state: string, lessonId: string | null = null) => ({ kind: 'LESSON', state, lessonId, jobId: state === 'GENERATING' ? 'job-x' : null })
const ch158 = (w: Json | null, l: Json | null, goalMet = false) => ({ challenge, today: { date: kst, dayIndex: 4, topic: { id: 'tp1', title: '카페 주문' }, tasks: [w, l].filter(Boolean), goalMet }, recentlyEnded: null })
const item = (over: Json) => ({ id: 'l1', kind: 'NEW', status: 'DONE', title: 'x', titleKo: null, stageDone: 5, topic: { id: 'tp1', title: '카페 주문' }, score: 80, jobId: null, speaking: null, ...over })
const lessons58 = (list: Json[], over: Json = {}) => ({ mode: 'NEW', date: kst, todayLessons: list, resume: null, recommendation: { topicId: 'tp1', topicTitle: '카페 주문', level: 'N5', reason: 'CHALLENGE', nextPreview: { titleKo: '계산하기', teaserKo: '…' } }, ...over })
const summary = (over: Json) => ({ id: 's9', date: kst, mode: 'CHOICE', cardCount: 10, answeredCount: 3, correctCount: 2, wrongCount: 1, skippedCount: 0, status: 'IN_PROGRESS', keptAt: null, replayOfId: null, topic: null, ...over })
const topicDto = (ai: number, lc = 0) => ({ id: 'tp1', title: '카페 주문', aiCardCount: ai, lessonCardCount: lc })
const SURF = ['お冷', '注文', 'メニュー', 'お会計', 'ホット', 'アイス', '持ち帰り', 'おすすめ', '少々', 'お待ちください']
const cards = (n = 10) => SURF.slice(0, n).map((s, i) => ({ order: i, wordId: null, surface: s, reading: null, choices: ['찬물', '주문', '메뉴', '계산'], flagged: false, answered: false }))
const deck = (topic: Json | null, status = 'IN_PROGRESS') => ({ session: { id: 'd1', date: kst, mode: 'CHOICE', requestedCount: 10, cardCount: 10, status, topic }, cards: status === 'DONE' ? cards().map((c, i) => ({ ...c, answered: true, answer: i % 3 ? 'CORRECT' : 'WRONG', correctText: c.choices[i % 4], chosenText: c.choices[0] })) : cards() })

interface Fx {
  ch?: unknown | 'error'
  l58?: unknown
  recent?: unknown[]
  s49?: unknown
  gen?: unknown
  post47?: Array<{ delay?: number; res: ReturnType<typeof ok> | ReturnType<typeof conflict> }>
  storage?: Record<string, string>
  /** 이 글이 보일 때까지 기다린 뒤 잰다(응답을 붙잡아 두는 대기 화면 행 — networkidle 대신). */
  waitText?: string
}

const S6: Record<string, Fx> = {
  's6.none': { ch: { challenge: null, today: null, recentlyEnded: null }, l58: lessons58([]) },
  's6.cerr': { ch: 'error', l58: lessons58([]) },
  's6.todo': { ch: ch158(words('TODO'), lesson('TODO')), l58: lessons58([]) },
  's6.short': { ch: ch158(words('SHORT', 4), lesson('DONE', 'l1')), l58: lessons58([item({})]), recent: [summary({ id: 'a', status: 'DONE', answeredCount: 6, correctCount: 3, wrongCount: 1, skippedCount: 2, topic: topicDto(6) })] },
  's6.done': { ch: ch158(words('DONE', 9), lesson('DONE', 'l1'), true), l58: lessons58([item({})]) },
  's6.wip': { ch: ch158(words('IN_PROGRESS', 0, 's9'), lesson('TODO')), l58: lessons58([]), recent: [summary({ topic: topicDto(10) })] },
  's6.otheropen': { ch: ch158(words('TODO'), lesson('TODO')), l58: lessons58([item({ id: 'o2', status: 'IN_PROGRESS', stageDone: 2, topic: { id: 't9', title: '길 묻기 — 아주 긴 다른 주제 이름이 들어오는 경우' } })]) },
  's6.busy': { ch: ch158(words('TODO'), lesson('TODO')), l58: lessons58([item({ id: 'p1', status: 'GENERATING', topic: null, jobId: 'jp' })]) },
  's6.gen': { ch: ch158(words('TODO'), lesson('GENERATING', 'c1')), l58: lessons58([item({ id: 'c1', status: 'GENERATING', jobId: 'jc' })]) },
  's6.cont': { ch: ch158(words('SHORT', 4), lesson('CONTINUE', 'c1')), l58: lessons58([], { resume: { id: 'c1', title: 'カフェ', titleKo: '카페', stageDone: 2, date: yday } }) },
}
const tok = (wordsDone = false) => ({ 'kaiwa.vocab.topicStart': JSON.stringify({ v: 1, topicId: 'tp1', title: '카페 주문', count: 10, mode: 'CHOICE', wordsDone, at: 0 }) })
const WAIT: Record<string, Fx> = {
  'w.gen': {
    storage: tok(),
    waitText: '새 단어를 만들고 있어요',
    post47: [{ delay: HOLD_MS, res: ok({ session: deck(topicDto(10)).session, cards: cards(), generation: { source: 'AI', generatedNow: true, reason: null } }) }],
  },
  'w.busy409': {
    storage: tok(),
    waitText: '다른 화면에서 새 단어를 만들고 있어요',
    post47: [{ res: conflict({ reason: 'GENERATING' }) }, { delay: HOLD_MS, res: conflict({ reason: 'GENERATING' }) }],
  },
  'w.alldone': { storage: tok(true), post47: [{ res: ok({ session: null, empty: { reason: 'TOPIC_ALL_DONE_TODAY', cta: ['MY_WORDS'] } }) }] },
}
const DECK: Record<string, Fx> = {
  'd.ai': { ch: ch158(words('TODO'), lesson('TODO')), s49: deck(topicDto(10)) },
  'd.timeout': { ch: ch158(words('TODO'), lesson('TODO')), s49: deck(topicDto(0, 3)), storage: { 'kaiwa.vocab.topicGen.d1': JSON.stringify({ source: 'TOPIC', generatedNow: false, reason: 'TIMEOUT' }) } },
  'd.base4': { ch: ch158(words('SHORT', 4), lesson('TODO')), s49: deck(topicDto(6)) },
  'd.mine': { ch: ch158(words('TODO'), lesson('TODO')), s49: deck(null) },
  'r.reopen': { ch: ch158(words('TODO'), lesson('TODO')), s49: deck(topicDto(7), 'DONE') },
}

async function wire(page: Page, fx: Fx, log: string[]) {
  const post47 = [...(fx.post47 ?? [])]
  await page.route('**/api/**', async (route: any) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = url.pathname
    const m = req.method()
    if (p === '/api/v1/challenges/today') return fx.ch === 'error' ? route.fulfill({ status: 500, body: '{}' }) : route.fulfill(ok(fx.ch ?? { challenge: null, today: null, recentlyEnded: null }))
    if (p === '/api/v1/lessons/today') return route.fulfill(ok(fx.l58 ?? lessons58([])))
    if (p === '/api/v1/words/categories') return route.fulfill(ok([{ category: null, count: 40, archivedCount: 0 }]))
    if (p === '/api/v1/vocab/stats') return route.fulfill(ok({ byCount: [], daily: [], streakDays: 0 }))
    if (p === '/api/v1/vocab/sessions' && m === 'GET') return route.fulfill(ok({ items: url.searchParams.get('kept') ? [] : (fx.recent ?? []), nextCursor: null }))
    if (p === '/api/v1/vocab/sessions' && m === 'POST') {
      const next = post47.shift()
      if (!next) return route.fulfill(conflict({ reason: 'GENERATING' }))
      if (next.delay) await new Promise((r) => setTimeout(r, next.delay))
      return route.fulfill(next.res).catch(() => undefined)
    }
    if (/^\/api\/v1\/vocab\/sessions\/[^/]+$/.test(p) && m === 'GET') return route.fulfill(ok(fx.s49 ?? deck(null)))
    if (m !== 'GET') {
      log.push(`blocked ${m} ${p}`)
      return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'blocked', data: { code: 'BLOCKED' } }) })
    }
    return route.continue()
  })
}

async function measure(page: Page) {
  return page.evaluate(() => {
    const de = document.documentElement
    const scrollers = [...document.querySelectorAll<HTMLElement>('*')].filter((el) => {
      const cs = getComputedStyle(el)
      return /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1
    })
    const small = [...document.querySelectorAll<HTMLElement>('main button, main a, header button, header a')]
      .filter((el) => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && (r.height < 44 || r.width < 44) && !el.closest('.sr-only')
      })
      .map((el) => `${(el.textContent ?? '').trim().slice(0, 18)}(${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)})`)
    const text = document.body.innerText
    return {
      overflowX: de.scrollWidth - de.clientWidth,
      scrollers: scrollers.length + (de.scrollHeight > de.clientHeight + 1 ? 1 : 0),
      scrollerTags: scrollers.map((e) => e.tagName.toLowerCase()).join(','),
      small,
      engine: /claude|haiku|sonnet|opus|qwen|whisper|reazon|style-?bert|task-\d|Phase \d/i.test(text),
      text: text.replace(/\s+/g, ' ').slice(0, 260),
    }
  })
}

async function main() {
  const prisma = new PrismaClient()
  // 응답을 전부 가로채므로 계정은 화면 인증에만 쓴다 — 챌린지 레인 계정 3 이 아직 없으면(첫 라이브 전) 계정 1 로 읽기만 한다.
  const users = await prisma.user.findMany({ where: { email: { in: ['qa-bot3@thekaiwa.test', 'qa-bot@thekaiwa.test'] }, provider: 'test' }, select: { id: true, email: true } })
  await prisma.$disconnect()
  const user = users.find((u) => u.email.startsWith('qa-bot3')) ?? users[0]
  if (!user) throw new Error('QA 계정(3·1)이 없다 — qa-session.ts 로 먼저 만든다(이 스크립트는 DB 에 쓰지 않는다)')
  console.log(`[task044-screens] account=${user.email.split('@')[0]}`)
  const token = jwt.sign({ userId: user.id, email: user.email, qa: true }, process.env.JWT_SECRET!, { expiresIn: '1h' })
  const pwName = 'playwright-core'
  const { chromium } = (await import(pwName)) as { chromium: any }
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', headless: true })
  const rows: string[] = []
  let fails = 0
  const run = async (
    id: string,
    path: string,
    fx: Fx,
    w: number,
    h: number,
    extra?: (page: Page, log: string[]) => Promise<string | null>,
    before?: (page: Page) => void,
  ) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'reduce', locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
    await ctx.addCookies([{ name: SESSION_COOKIE_NAME, value: token, domain: '127.0.0.1', path: '/', httpOnly: true }])
    const log: string[] = []
    const page = await ctx.newPage()
    await wire(page, fx, log)
    if (fx.storage) await page.addInitScript((kv: Record<string, string>) => { for (const [k, v] of Object.entries(kv)) if (!sessionStorage.getItem(`${k}.__set`)) { sessionStorage.setItem(k, k === 'kaiwa.vocab.topicStart' ? JSON.stringify({ ...JSON.parse(v), at: Date.now() }) : v); sessionStorage.setItem(`${k}.__set`, '1') } }, fx.storage)
    // 리스너는 이동 앞에 단다 — 이동 뒤에 달면 이미 끝난 요청은 잡히지 않는다.
    before?.(page)
    try {
      let stateNote: string | null = null
      if (fx.waitText) {
        await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 180_000 }).catch(() => undefined)
        const seen = await page
          .waitForFunction((t: string) => document.body?.innerText.includes(t), fx.waitText, { timeout: 60_000 })
          .then(() => true)
          .catch(() => false)
        if (!seen) stateNote = `FAIL state not reached ("${fx.waitText}")`
        else if (!page.url().includes(path)) stateNote = `FAIL left ${path} before measuring (${new URL(page.url()).pathname})`
        await page.waitForTimeout(300)
      } else {
        await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 180_000 }).catch(() => page.waitForTimeout(3000))
        await page.waitForTimeout(1500)
      }
      const r = await measure(page)
      const extraNote = extra ? await extra(page, log) : null
      const note = [stateNote, extraNote].filter(Boolean).join(' · ') || null
      const bad = r.overflowX > 0 || r.engine || r.scrollers > 1 || (note?.includes('FAIL') ?? false)
      if (bad) fails++
      rows.push(`${bad ? 'FAIL' : 'ok  '} ${id} ${w}x${h} overflowX=${r.overflowX} scroll=${r.scrollers}[${r.scrollerTags}] small=${r.small.length ? r.small.join(' ') : '-'}${note ? ` · ${note}` : ''}${log.length ? ` · ${log.join(';')}` : ''}`)
      if (w === 390 && h === 892) rows.push(`     text: ${r.text}`)
      console.log(rows.slice(w === 390 && h === 892 ? -2 : -1).join('\n'))
    } catch (e) {
      fails++
      rows.push(`FAIL ${id} ${w}x${h} ${(e as Error).message.slice(0, 160)}`)
    } finally {
      await ctx.close()
    }
  }
  // SIZES=390x892,360x780 처럼 줄일 수 있다(dev 첫 컴파일 포함 6폭 전부는 10분 넘게 걸릴 수 있다).
  const sizes = (process.env.SIZES ?? '360x780,390x780,412x780,360x892,390x892,412x892').split(',').map((v) => v.split('x').map(Number))
  const deckNoScroll = async (page: Page) => {
    const s = await page.evaluate(() => { const m = document.querySelector('main'); return m ? m.scrollHeight - m.clientHeight : -1 })
    return s > 1 ? `FAIL deck main scroll ${s}px` : `deck scroll 0`
  }
  for (const [w, h] of sizes) {
    for (const [id, fx] of Object.entries(S6)) await run(id, '/study/today', fx, w, h)
    for (const [id, fx] of Object.entries(WAIT)) await run(id, '/study/today/words/new', fx, w, h)
    for (const [id, fx] of Object.entries(DECK)) await run(id, '/study/today/words/d1', fx, w, h, id.startsWith('d.') && h === 780 && w !== 360 ? deckNoScroll : undefined)
  }
  // 떠나면 취소: 대기 중(#47 응답 보류) ← 를 누르면 #47 이 net::ERR_ABORTED 로 끝난다
  let aborted: string | null = null
  await run(
    'w.leave',
    '/study/today/words/new',
    WAIT['w.gen'],
    390,
    892,
    async (page) => {
      await page.click('header a[href="/study/today"]')
      await page.waitForTimeout(2500)
      return aborted ? `abort on leave ok (${aborted})` : 'FAIL #47 not aborted on leave'
    },
    (page) => {
      page.on('requestfailed', (rq: any) => {
        if (rq.url().endsWith('/api/v1/vocab/sessions') && rq.method() === 'POST') aborted = rq.failure()?.errorText ?? 'failed'
      })
    },
  )
  await browser.close()
  console.log(`\n[task044-screens] ${rows.filter((r) => /^(ok|FAIL)/.test(r)).length} checks · fail ${fails}`)
  process.exitCode = fails ? 1 : 0
}
main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
