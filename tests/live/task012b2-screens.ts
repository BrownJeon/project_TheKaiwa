/**
 * task-012b-2 화면 상태 확인 — **API 응답을 가로채 고정 응답을 주입**한다. DB 를 쓰는 요청은 서버로 보내지 않는다:
 * #21c 목록·#21a 확정·#66 평가 상세는 고정 응답, 그 밖 GET 은 통과(읽기), 그 밖 쓰기 요청은 막고 기록한다.
 * 앱 공통 쓰기(출석 체크인 등)·읽기 표시용 POST(후리가나)도 막고 줄 끝에 기록만 한다(실패로 세지 않음).
 * 세션은 QA 계정 1 의 id 를 **읽기만** 해서 qa 토큰(1시간)을 직접 만든다(qa-session.ts 의 upsert 를 쓰지 않음). 각 브라우저 문맥을 닫기 전에 쿠키를 지운다.
 * 확인: 360/390/412 × 780/892 — 가로 넘침 0 · 스크롤 영역 1곳(시트 열림 상태는 시트 본문 예외) · 44px 미만 터치 대상 목록 · 엔진 이름 0
 *   내 발화 기록 L1·L2·L3·L4·L5(목록)·L11(카드 펼침)·R9(직접 고치기 시트)·R5(기록 성공)·R6(409) · 설정 진입 줄 배지 · 평가 결과 채점 글 출처 4줄.
 * 실행(미러, dev 서버 `APP_ENV=LOCAL next dev -H 127.0.0.1 -p 3027` 따로): `node --env-file=.env --import tsx tests/live/task012b2-screens.ts 3027`
 *   SIZES=390x892,360x780 처럼 폭을 줄일 수 있다 · ONLY=log,entry,eval 로 묶음을 고를 수 있다.
 * 브라우저: playwright-core(상위 node_modules) + 시스템 Chrome(`CHROME_PATH`, 기본 /usr/bin/google-chrome).
 */
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import { SESSION_COOKIE_NAME } from '../../src/modules/infra/jwt'

type Json = Record<string, unknown>
/* eslint-disable @typescript-eslint/no-explicit-any -- playwright-core 는 프로젝트 의존성이 아니라 동적 import(타입 없음) */
type Page = any

const PORT = process.argv[2] ?? '3027'
if (PORT === '3010') throw new Error('운영 포트 3010 에서는 실행하지 않는다')
const BASE = `http://127.0.0.1:${PORT}`
const ok = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data, message: null }) })
const fail = (status: number, code: string) => ({ status, contentType: 'application/json', body: JSON.stringify({ success: false, message: code, data: { code } }) })

// ── 고정 응답 ──────────────────────────────────────────────────────────────────────────────
const H = 3600_000
const at = (hoursAgo: number) => new Date(Date.now() - hoursAgo * H).toISOString()
const utt = (over: Json): Json => ({
  id: 'u1',
  createdAt: at(1),
  durationMs: 2400,
  status: 'ANALYZED',
  realtimeText: '駅はどこですか',
  analysisText: '低級はどこですか',
  finalText: null,
  finalSource: 'REALTIME',
  requiresReview: true,
  wasReviewTarget: true,
  audioAvailable: true,
  chatMessageId: 'm1',
  context: { kind: 'TALK', id: 'chat1' },
  ...over,
})
const LONG = 'すみません、さっき注文したアイスコーヒーなんですけど、やっぱりホットに変えてもらえますか。それと、持ち帰りでお願いしたいんですが、袋は大丈夫です。'
const ROWS: Json[] = [
  utt({ id: 'u1' }),
  utt({ id: 'u2', createdAt: at(1.2), realtimeText: 'お会計お願いします', analysisText: '', chatMessageId: 'm2' }),
  utt({ id: 'u3', createdAt: at(2), realtimeText: LONG, analysisText: LONG.replace('ホット', 'ポット'), context: { kind: 'LESSON', id: 'l1' }, chatMessageId: null }),
  utt({ id: 'u4', createdAt: at(3), requiresReview: false, finalSource: 'ANALYSIS', finalText: '低級はどこですか', chatMessageId: 'm4' }),
  utt({ id: 'u5', createdAt: at(4), requiresReview: false, finalSource: 'USER', finalText: '駅はどこにありますか', wasReviewTarget: false, context: { kind: 'EVALUATION', id: null }, chatMessageId: null }),
  utt({ id: 'u6', createdAt: at(30), requiresReview: false, wasReviewTarget: false, audioAvailable: false, realtimeText: 'はい、そうです', analysisText: 'はい、そうです', context: { kind: 'UNSENT', id: null }, chatMessageId: null }),
  utt({ id: 'u7', createdAt: at(31), status: 'QUEUED', requiresReview: false, wasReviewTarget: false, analysisText: null, realtimeText: 'ありがとうございました' }),
  utt({ id: 'u8', createdAt: at(800), status: 'FAILED', requiresReview: false, wasReviewTarget: false, analysisText: null, audioAvailable: false, realtimeText: 'また明日', context: { kind: 'DELETED', id: null }, chatMessageId: null }),
]
const list = (items: Json[], over: Json = {}) => ({ items, nextCursor: null, reviewableCount: items.filter((i) => i.requiresReview && i.status === 'ANALYZED' && i.finalSource === 'REALTIME').length, ...over })
const view = (id: string, finalSource: string, finalText: string) => ({ id, chatMessageId: null, durationMs: 2400, status: 'ANALYZED', realtimeText: '駅はどこですか', analysisText: '低級はどこですか', requiresReview: false, finalText, finalSource, audioUrl: null })

const evItem = (over: Json): Json => ({
  id: 'i1', order: 1, kind: 'LISTEN_RESPOND', prompt: { instructionKo: '듣고 답해 보세요', textJa: '駅はどこですか' }, maxScore: 10, answered: true,
  answerText: '駅はあそこです', answerOrder: null, answerSpot: null, inputSource: 'TEXT', voiced: true, answeredAt: at(1), textRevealed: false,
  expected: { modelJa: '駅はあちらです' }, score: 7, correct: null, feedback: '좋아요.', dims: ['accuracy'], ...over,
})
const evaluation = {
  id: 'ev1', kind: 'TALK', level: 'N5', status: 'DONE', topic: { id: 'tp1', title: '길 묻기' }, timeLimitSec: 600, startedAt: at(1.5), deadlineAt: at(1.3), submittedAt: at(1.2),
  completedAt: at(1.1), overtime: false, jobId: null, error: null, itemCount: 4, answeredCount: 4,
  items: [
    evItem({ id: 'i1', order: 1 }),
    evItem({ id: 'i2', order: 2, inputSource: 'SERVER_STT' }),
    evItem({ id: 'i3', order: 3, kind: 'SITUATION_RESPOND', prompt: { situationKo: '가게에서 계산하고 싶어요' }, inputSource: 'REALTIME_STT', answerText: 'お会計お願いします' }),
    evItem({ id: 'i4', order: 4, kind: 'SITUATION_RESPOND', prompt: { situationKo: '길을 물어요' }, inputSource: 'TEXT', voiced: false }),
  ],
  result: { totalScore: 70, grade: 'GOOD', rubric: null, comment: '잘했어요.', nextFocus: [], studyLogId: null, completedAt: at(1.1), overtime: false, durationSec: 300, levelProposal: null },
}

interface Fx {
  list?: unknown | 'error' | 'hang'
  review?: unknown
  patch?: ReturnType<typeof ok> | ReturnType<typeof fail>
}

async function wire(page: Page, fx: Fx, log: string[]) {
  await page.route('**/api/**', async (route: any) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = url.pathname
    const m = req.method()
    if (p === '/api/v1/speech/utterances' && m === 'GET') {
      if (fx.list === 'error') return route.fulfill(fail(500, 'INTERNAL'))
      if (fx.list === 'hang') return new Promise(() => undefined)
      if (url.searchParams.get('reviewable') === '1') return route.fulfill(ok(fx.review ?? list(ROWS.filter((r) => r.requiresReview && r.status === 'ANALYZED' && r.finalSource === 'REALTIME'))))
      return route.fulfill(ok(fx.list ?? list([])))
    }
    if (/^\/api\/v1\/speech\/utterances\/[^/]+$/.test(p) && m === 'PATCH') {
      log.push(`patch ${req.postData() ?? ''}`)
      return route.fulfill(fx.patch ?? ok(view('u1', 'ANALYSIS', '低級はどこですか')))
    }
    if (/^\/api\/v1\/speech\/utterances\/[^/]+\/audio$/.test(p)) return route.fulfill(fail(404, 'NOT_FOUND'))
    if (p === '/api/v1/evaluations/ev1') return route.fulfill(ok(evaluation))
    if (m !== 'GET') {
      log.push(`blocked ${m} ${p}`)
      return route.fulfill(fail(503, 'BLOCKED'))
    }
    return route.continue()
  })
}

async function measure(page: Page) {
  return page.evaluate(() => {
    const de = document.documentElement
    const scrollers = [...document.querySelectorAll<HTMLElement>('*')].filter((el) => {
      const cs = getComputedStyle(el)
      return /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1 && !el.closest('[role="dialog"]')
    })
    const small = [...document.querySelectorAll<HTMLElement>('main button, main a, main label, header button, header a, [role="dialog"] button')]
      .filter((el) => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && r.height < 44 && !el.closest('.sr-only')
      })
      .map((el) => `${(el.textContent ?? '').trim().slice(0, 14)}(${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)})`)
    const wide = [...document.querySelectorAll<HTMLElement>('main *')].filter((el) => el.getBoundingClientRect().right > de.clientWidth + 0.5).length
    const text = document.body.innerText
    return {
      overflowX: Math.max(de.scrollWidth - de.clientWidth, wide ? 1 : 0),
      scrollers: scrollers.length + (de.scrollHeight > de.clientHeight + 1 ? 1 : 0),
      scrollerTags: scrollers.map((e) => e.tagName.toLowerCase()).join(','),
      small,
      engine: /claude|haiku|sonnet|opus|qwen|whisper|reazon|sherpa|style-?bert|confidence|0\.85|task-\d|Phase \d/i.test(text),
      text: text.replace(/\s+/g, ' ').slice(0, 240),
    }
  })
}

async function main() {
  if ((process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 에서는 실행하지 않는다')
  const prisma = new PrismaClient()
  const user = await prisma.user.findFirst({ where: { email: 'qa-bot@thekaiwa.test', provider: 'test' }, select: { id: true, email: true } })
  await prisma.$disconnect()
  if (!user) throw new Error('QA 계정 1 이 없다 — qa-session.ts 로 먼저 만든다(이 스크립트는 DB 에 쓰지 않는다)')
  const token = jwt.sign({ userId: user.id, email: user.email, qa: true }, process.env.JWT_SECRET!, { expiresIn: '1h' })
  const pwName = 'playwright-core'
  const { chromium } = (await import(pwName)) as { chromium: any }
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', headless: true })
  const rows: string[] = []
  let fails = 0
  const run = async (id: string, path: string, fx: Fx, w: number, h: number, act?: (page: Page, log: string[]) => Promise<string | null>) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'reduce', locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
    await ctx.addCookies([{ name: SESSION_COOKIE_NAME, value: token, domain: '127.0.0.1', path: '/', httpOnly: true }])
    const log: string[] = []
    const page = await ctx.newPage()
    await wire(page, fx, log)
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: fx.list === 'hang' ? 'domcontentloaded' : 'networkidle', timeout: 180_000 }).catch(() => page.waitForTimeout(3000))
      await page.waitForTimeout(1200)
      const note = act ? await act(page, log) : null
      const r = await measure(page)
      const bad = r.overflowX > 0 || r.engine || r.scrollers > 1 || (note?.startsWith('FAIL') ?? false)
      if (bad) fails++
      rows.push(`${bad ? 'FAIL' : 'ok  '} ${id} ${w}x${h} overflowX=${r.overflowX} scroll=${r.scrollers}[${r.scrollerTags}] small<44=${r.small.length ? r.small.join(' ') : '-'}${note ? ` · ${note}` : ''}${log.length ? ` · ${log.join(';')}` : ''}`)
      if (w === 390 && h === 892) rows.push(`     text: ${r.text}`)
      console.log(rows.slice(w === 390 && h === 892 ? -2 : -1).join('\n'))
    } catch (e) {
      fails++
      rows.push(`FAIL ${id} ${w}x${h} ${(e as Error).message.slice(0, 160)}`)
      console.log(rows.at(-1))
    } finally {
      await ctx.clearCookies()
      await ctx.close()
    }
  }
  const has = (page: Page, s: string) => page.evaluate((t: string) => document.body.innerText.includes(t), s)
  const expect = async (page: Page, wants: string[]) => {
    const miss: string[] = []
    for (const s of wants) if (!(await has(page, s))) miss.push(s)
    return miss.length ? `FAIL missing ${miss.join('|')}` : 'text ok'
  }

  const sizes = (process.env.SIZES ?? '360x780,390x780,412x780,360x892,390x892,412x892').split(',').map((v) => v.split('x').map(Number))
  const only = new Set((process.env.ONLY ?? 'log,entry,eval').split(','))
  const LOG = '/settings/utterances'
  for (const [w, h] of sizes) {
    if (only.has('log')) {
      await run('L1.loading', LOG, { list: 'hang' }, w, h, (p) => expect(p, ['불러오는 중…']))
      await run('L2.empty', LOG, { list: list([]) }, w, h, (p) => expect(p, ['아직 말로 한 기록이 없어요.', '회화하러 가기']))
      await run('L3.emptyReview', `${LOG}?filter=review`, { list: list([]), review: list([]) }, w, h, (p) => expect(p, ['확인할 말이 없어요.']))
      await run('L4.error', LOG, { list: 'error' }, w, h, (p) => expect(p, ['기록을 불러오지 못했어요.', '다시 시도']))
      await run('L5.list', LOG, { list: list(ROWS, { nextCursor: 'c1' }) }, w, h, (p) =>
        expect(p, ['확인 필요 3', '회화에서 보기', '수업에서 보기', '다시 들어 본 말로 확인', '내가 고친 말', '녹음 보관 기간(30일)이 지났어요', '연결된 대화 없음', '지운 대화', '더 보기']),
      )
      await run('L11.open', LOG, { list: list(ROWS) }, w, h, async (p) => {
        await p.getByRole('button', { name: '확인하기' }).first().click()
        await p.waitForTimeout(300)
        return expect(p, ['이렇게 들렸어요', '이렇게도 들렸어요', '이걸로 기록하기', '직접 고치기', '처음 기록까지 다 봤어요'])
      })
      await run('R9.sheet', LOG, { list: list(ROWS) }, w, h, async (p) => {
        await p.getByRole('button', { name: '확인하기' }).first().click()
        await p.getByRole('button', { name: '직접 고치기' }).first().click()
        await p.waitForTimeout(300)
        const dlg = await p.$('[role="dialog"]')
        const ta = await p.$('[role="dialog"] textarea[lang="ja"]')
        if (!dlg || !ta) return 'FAIL sheet not open'
        const box = await ta.boundingBox()
        const vh = await p.evaluate(() => window.innerHeight)
        return box && box.y + box.height <= vh ? 'sheet ok · textarea visible' : 'FAIL textarea hidden'
      })
      if (w === 390 && h === 892) {
        await run('R5.done', LOG, { list: list(ROWS) }, w, h, async (p, log) => {
          await p.getByRole('button', { name: '확인하기' }).first().click()
          await p.getByText('이렇게도 들렸어요').first().click()
          await p.getByRole('button', { name: '이걸로 기록하기' }).click()
          await p.waitForTimeout(500)
          const sent = log.some((l) => l.includes('"choice":"ANALYSIS"'))
          return sent && (await has(p, '✓ 기록했어요 · 다시 들어 본 말로')) ? 'R5 ok' : 'FAIL R5'
        })
        await run('R6.conflict', LOG, { list: list(ROWS), patch: fail(409, 'NOT_REVIEWABLE') }, w, h, async (p) => {
          await p.getByRole('button', { name: '확인하기' }).first().click()
          await p.getByText('이렇게 들렸어요').first().click()
          await p.getByRole('button', { name: '이걸로 기록하기' }).click()
          await p.waitForTimeout(500)
          return (await has(p, '이미 확인한 말이에요.')) ? 'R6 ok' : 'FAIL R6'
        })
        await run('R2.pickFirst', LOG, { list: list(ROWS) }, w, h, async (p, log) => {
          await p.getByRole('button', { name: '확인하기' }).first().click()
          // aria-disabled 버튼도 눌린다(이유를 알리려고 disabled 를 쓰지 않음) — Playwright 는 aria-disabled 를 비활성으로 보므로 force.
          await p.getByRole('button', { name: '이걸로 기록하기' }).click({ force: true })
          await p.waitForTimeout(300)
          return (await has(p, '먼저 하나를 골라 주세요.')) && !log.some((l) => l.startsWith('patch')) ? 'no-pick ok' : 'FAIL no-pick'
        })
      }
    }
    if (only.has('entry')) {
      await run('D.entry', '/settings', { list: list(ROWS) }, w, h, async (p) => {
        await p.waitForTimeout(800)
        const link = await p.$('a[href="/settings/utterances"]')
        if (!link) return 'FAIL entry link missing'
        const b = await link.boundingBox()
        return (await has(p, '확인 3')) && b && b.height >= 44 ? `entry ok h=${Math.round(b.height)}` : 'FAIL entry badge/height'
      })
    }
    if (only.has('eval')) {
      await run('E.result', '/study/today/eval/ev1', {}, w, h, async (p) => {
        for (const b of await p.$$('main button[aria-expanded="false"][aria-controls]')) await b.click().catch(() => undefined)
        await p.waitForTimeout(400)
        return expect(p, ['말로 답함 · 내가 고친 말로 채점했어요', '말로 답함 · 다시 들어 본 말로 채점했어요', '말로 답함 · 처음 들린 말로 채점했어요', '글자로 답함'])
      })
    }
  }
  await browser.close()
  console.log(`\n[task012b2-screens] ${rows.filter((r) => /^(ok|FAIL)/.test(r)).length} checks · fail ${fails}`)
  process.exitCode = fails ? 1 : 0
}
main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
