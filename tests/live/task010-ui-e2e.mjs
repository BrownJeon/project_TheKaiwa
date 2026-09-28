/**
 * task-010 오늘의 회화 화면 E2E(실 Chrome + Playwright) — screens §12 · 승인 데모 v2.
 *
 *   오늘 홈 카드(시작·실패·준비됨·완료) · 주제 고르기·시트 · 붙여넣기(짧음·일본어 아님·생성 → 대기 → 실패/준비) · 5단계 전 흐름
 *   (① 구간 느리게→보통·글자 가림·줄 강조·메모 → 제안 → 채택 / ② 예문 / ③ 문제 5 / ④ 응용 / ⑤ 글자 답·건너뛰기 → 수업 마치기) · 종료 카드 ·
 *   재개(이어서 토스트·다시 보기 쓰기 0) · 자막만(TEXT_ONLY — 이 테스트 페이지에서만 상태 응답·오디오를 가로챔) · 없는 수업 404 ·
 *   360/390/412 × 780/892 가로 넘침 0 · 엔진명 DOM/콘솔 0.
 *
 * 실행(미러에서, dev 서버를 따로 띄운 뒤 — 접속은 localhost):
 *   node --env-file=.env tests/live/task010-ui-e2e.mjs --base http://localhost:3011 --cookie <qa-session 파일> --out <스크린샷 디렉터리> [--gen 1]
 * `--gen 1` 이면 붙여넣기로 실제 수업 생성(A4)까지 기다린다(없으면 생성 요청 → 대기 화면 확인까지만, 실패/성공 어느 쪽이든 그 화면을 찍는다).
 * 5단계 흐름은 **QA 계정에 넣은 고정 레슨**(READY, 시드 주제 "카페 주문" 조각 id 사용)으로 한다 — A4 호출 없이 화면만 검증. 끝에 QA 계정 레슨 관련 행을 지운다.
 * `playwright-core` 는 워크스페이스 밖(~/node_modules). 쿠키·서명 URL 은 출력하지 않는다.
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { chromium } from 'playwright-core'

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []))
const BASE = args.base ?? 'http://localhost:3011'
const COOKIE = readFileSync(args.cookie, 'utf8').trim()
const OUT = args.out ?? '/tmp/task010-ui'
const REAL_GEN = args.gen === '1'
mkdirSync(OUT, { recursive: true })
const [cookieName, ...rest] = COOKIE.split('=')
const cookieValue = rest.join('=')
const prisma = new PrismaClient()
const results = []
const metrics = {}
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}
const ENGINE_RE = /claude|haiku|sonnet|opus|qwen|reazon|sherpa|zipformer|onnx|whisper|style-?bert|sbv2|connectionKey|traceId|엔진|모델|Phase|task-/i
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

const user = await prisma.user.findUniqueOrThrow({ where: { email: 'qa-bot@thekaiwa.test' }, select: { id: true } })
const uid = user.id
const cafe = await prisma.conversationTopic.findFirstOrThrow({ where: { isSeed: true, title: '카페 주문' }, include: { chunks: true } })
const chunkId = (ja) => cafe.chunks.find((c) => c.textJa === ja)?.id ?? `missing-${ja}`

const dailyBefore = await prisma.statsSnapshot.findUnique({ where: { userId_kind_periodKey: { userId: uid, kind: 'DAILY', periodKey: today } }, select: { data: true } })
let seededWordId = null

async function wipe() {
  const lessons = await prisma.lesson.findMany({ where: { userId: uid }, select: { id: true } })
  await prisma.statsSnapshot.deleteMany({ where: { userId: uid, kind: 'LESSON' } })
  await prisma.studyLog.deleteMany({ where: { userId: uid, type: { in: ['LESSON', 'REVIEW'] } } })
  await prisma.repetitionItem.deleteMany({ where: { userId: uid } })
  await prisma.aiJob.deleteMany({ where: { userId: uid, kind: 'LESSON_GEN' } })
  await prisma.tutorProposal.deleteMany({ where: { userId: uid, chatId: null, kind: 'ADD_WORD' } })
  await prisma.wordEntry.deleteMany({ where: { userId: uid, source: 'LESSON' } })
  await prisma.requestTrace.deleteMany({ where: { userId: uid, refType: { in: ['lessonGen', 'lessonAudio'] } } })
  await prisma.lesson.deleteMany({ where: { id: { in: lessons.map((l) => l.id) } } })
}

function fixtureContent() {
  const d = (speaker, ja, reading, ko, segment) => ({ speaker, ja, reading, ko, segment })
  const ch = (ja, reading, meaningKo, chunkType) => ({ id: chunkId(ja), textJa: ja, reading, meaningKo, chunkType, isNew: false })
  return {
    v: 1,
    title: 'カフェで注文する',
    titleKo: '카페에서 주문하기',
    rolesKo: { A: '점원', B: '손님' },
    dialogue: [
      d('A', 'いらっしゃいませ。ご注文はお決まりですか。', 'いらっしゃいませ。ごちゅうもんはおきまりですか。', '어서 오세요. 주문하시겠어요?', 1),
      d('B', '冷たいコーヒーを一つください。', 'つめたいこーひーをひとつください。', '차가운 커피 하나 주세요.', 1),
      d('A', 'サイズはどうなさいますか。', 'さいずはどうなさいますか。', '사이즈는 어떻게 하시겠어요?', 1),
      d('B', '小さいサイズでお願いします。', 'ちいさいさいずでおねがいします。', '작은 사이즈로 부탁해요.', 2),
      d('A', 'こちらでお召し上がりですか。', 'こちらでおめしあがりですか。', '여기서 드시나요?', 2),
      d('B', 'いいえ、持ち帰ります。', 'いいえ、もちかえります。', '아니요, 가져갈게요.', 2),
      d('A', 'かしこまりました。紅茶もいかがですか。', 'かしこまりました。こうちゃもいかがですか。', '알겠습니다. 홍차도 어떠세요?', 3),
      d('B', '今日は大丈夫です。', 'きょうはだいじょうぶです。', '오늘은 괜찮아요.', 3),
    ],
    segmentCount: 3,
    chunks: [
      ch('コーヒー', 'こーひー', '커피', 'NAME'),
      ch('紅茶', 'こうちゃ', '홍차', 'NAME'),
      ch('ください', 'ください', '주세요', 'ACTION'),
      ch('持ち帰ります', 'もちかえります', '가져가요(포장)', 'ACTION'),
      ch('一つ', 'ひとつ', '하나', 'MODIFIER'),
      ch('冷たい', 'つめたい', '차가운', 'MODIFIER'),
      { id: 'new-1', textJa: '注文', reading: 'ちゅうもん', meaningKo: '주문', chunkType: 'NAME', isNew: true },
    ],
    grammar: [
      { id: 'g1', pattern: '〜をください', explanationKo: '물건 뒤에 붙여 "~을 주세요"라고 정중하게 부탁해요.', exampleJa: '水をください。', exampleReading: 'みずをください。', exampleKo: '물 주세요.' },
      { id: 'g2', pattern: 'Nでお願いします', explanationKo: '고르는 것 뒤에 붙여 "~로 부탁해요"라고 말해요.', exampleJa: '小さいサイズでお願いします。', exampleReading: 'ちいさいさいずでおねがいします。', exampleKo: '작은 사이즈로 부탁해요.' },
    ],
    quiz: [
      { id: 'q1', promptKo: '"커피"는 일본어로?', promptJa: null, choices: ['コーヒー', 'お茶', '水', 'ケーキ'], answer: 0, targetIds: [chunkId('コーヒー')], explanationKo: 'コーヒー 가 커피예요.' },
      { id: 'q2', promptKo: '"가져가요(포장)"에 맞는 말은?', promptJa: null, choices: ['食べます', '持ち帰ります', '飲みます', '見ます'], answer: 1, targetIds: [chunkId('持ち帰ります')], explanationKo: '持ち帰ります 는 가져간다는 뜻이에요.' },
      { id: 'q3', promptKo: null, promptJa: '水を＿＿。', choices: ['ください', 'です', 'ます', 'だ'], answer: 0, targetIds: ['g1'], explanationKo: '〜をください 로 부탁해요.' },
      { id: 'q4', promptKo: '"하나"는?', promptJa: null, choices: ['二つ', '一つ', '三つ', '四つ'], answer: 1, targetIds: [chunkId('一つ')], explanationKo: '一つ 가 하나예요.' },
      { id: 'q5', promptKo: '"작은 사이즈로 부탁해요"에 맞는 문장은?', promptJa: null, choices: ['小さいサイズでお願いします。', '大きいサイズです。', 'サイズはいいです。', '小さいです。'], answer: 0, targetIds: ['g2'], explanationKo: 'Nでお願いします 문형이에요.' },
    ],
    application: [
      { id: 'a1', promptKo: '홍차를 하나 주문해 보세요.', hintJa: '紅茶を〜', modelAnswerJa: '紅茶を一つください。', modelReading: 'こうちゃをひとつください。', modelKo: '홍차 하나 주세요.', targetIds: [chunkId('紅茶'), 'g1'] },
      { id: 'a2', promptKo: '점원이 여기서 드실 건지 물었어요. 포장해 달라고 말해 보세요.', hintJa: null, modelAnswerJa: '持ち帰ります。', modelReading: 'もちかえります。', modelKo: '가져갈게요.', targetIds: [chunkId('持ち帰ります')] },
      { id: 'a3', promptKo: '작은 사이즈로 부탁해 보세요.', hintJa: null, modelAnswerJa: '小さいサイズでお願いします。', modelReading: 'ちいさいさいずでおねがいします。', modelKo: '작은 사이즈로 부탁해요.', targetIds: ['g2'] },
    ],
    speaking: [
      { id: 's1', promptKo: '더운 날이에요. 차가운 커피를 주문해 보세요.', targetIds: [chunkId('冷たい'), chunkId('コーヒー'), 'g1'], modelAnswerJa: '冷たいコーヒーをください。', modelReading: 'つめたいこーひーをください。', modelKo: '차가운 커피 주세요.' },
      { id: 's2', promptKo: '홍차를 하나 주문해 보세요.', targetIds: [chunkId('紅茶'), chunkId('一つ')], modelAnswerJa: '紅茶を一つください。', modelReading: 'こうちゃをひとつください。', modelKo: '홍차 하나 주세요.' },
      { id: 's3', promptKo: '가져가겠다고 대답해 보세요.', targetIds: [chunkId('持ち帰ります')], modelAnswerJa: 'いいえ、持ち帰ります。', modelReading: 'いいえ、もちかえります。', modelKo: '아니요, 가져갈게요.' },
    ],
    nextPreview: { titleKo: '주문을 바꾸고 계산하기', teaserKo: '「やっぱり」로 주문을 바꾸고, 계산할 때 쓰는 말을 배워요.' },
  }
}

async function makeLesson(over = {}) {
  const content = fixtureContent()
  const row = await prisma.lesson.create({
    data: { userId: uid, topicId: cafe.id, date: new Date(`${today}T00:00:00Z`), kind: 'NEW', title: content.title, level: 'N5', content, status: 'READY', stageDone: 0, ...over },
    select: { id: true },
  })
  return row.id
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: false })
await ctx.addInitScript(() => {
  const hide = () => {
    const s = document.createElement('style')
    s.textContent = 'nextjs-portal{display:none!important}'
    document.head.appendChild(s)
  }
  if (document.head) hide()
  else document.addEventListener('DOMContentLoaded', hide)
})
await ctx.addCookies([{ name: cookieName, value: cookieValue, url: BASE, httpOnly: true, sameSite: 'Lax' }])
const page = await ctx.newPage()
const consoleLines = []
page.on('console', (m) => consoleLines.push(`${m.type()}: ${m.text()}`))
page.on('pageerror', (e) => consoleLines.push(`pageerror: ${e.message}`))
const writes = []
page.on('request', (r) => {
  const u = r.url()
  if (/\/api\/v1\/lessons\/[^/]+\/(progress|memo|speaking|complete)$/.test(u) && r.method() !== 'GET') writes.push({ url: u.replace(BASE, ''), method: r.method(), at: Date.now() })
})

async function shot(name) {
  await page.screenshot({ path: join(OUT, `${name}.png`) })
}
async function overflow() {
  return page.evaluate(() => {
    const main = document.querySelector('[data-app-shell] main')
    const w = window.innerWidth
    const bad = [...document.querySelectorAll('body *')].filter((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && (r.right > w + 1 || r.left < -1) && getComputedStyle(el).position !== 'fixed'
    })
    return { doc: document.documentElement.scrollWidth - w, main: main ? main.scrollWidth - main.clientWidth : 0, offenders: bad.slice(0, 3).map((e) => `${e.tagName}.${String(e.className).slice(0, 40)}`) }
  })
}
async function engineLeak() {
  return page.evaluate((src) => {
    const re = new RegExp(src, 'i')
    const text = document.body.innerText
    const attrs = [...document.querySelectorAll('*')].flatMap((el) => [...el.attributes].filter((a) => !['class', 'style', 'd', 'viewBox'].includes(a.name)).map((a) => a.value))
    const hit = re.exec(text) ?? attrs.map((a) => re.exec(a)).find(Boolean)
    return hit ? hit[0] : null
  }, ENGINE_RE.source)
}
async function widths(name, fn) {
  const sizes = [
    [360, 780],
    [390, 780],
    [412, 780],
    [360, 892],
    [390, 892],
    [412, 892],
  ]
  let worst = { doc: 0, main: 0, offenders: [] }
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h })
    await sleep(250)
    if (fn) await fn(w, h)
    const o = await overflow()
    if (o.doc > worst.doc || o.main > worst.main) worst = o
    if (h === 892 || w === 390) await shot(`${name}-${w}x${h}`)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  return worst
}
const byRole = (role, name) => page.getByRole(role, { name, exact: false })

async function main() {
  await wipe()
  // "이미 있음"(IN_WORDBOOK) 확인용 — 단어장에 먼저 넣어 둔 단어(끝나면 이 행만 지운다)
  const had = await prisma.wordEntry.findFirst({ where: { userId: uid, surface: '冷たい' }, select: { id: true } })
  if (!had) seededWordId = (await prisma.wordEntry.create({ data: { userId: uid, surface: '冷たい', reading: 'つめたい', meaning: '차가운', source: 'MANUAL' }, select: { id: true } })).id
  // ── 1. 오늘 홈(시작 전) ──────────────────────────────────────
  await page.goto(`${BASE}/study/today`, { waitUntil: 'networkidle' })
  await page.getByText('추천 주제').waitFor({ timeout: 20000 })
  check('1a 오늘 홈: 오늘의 회화 카드(시작 전 — 추천 주제·수업 만들기·주제 고르기)·곧 열려요엔 AI 평가만', (await byRole('button', '수업 만들기, 추천 주제').count()) === 1 && (await page.getByText('곧 열려요').count()) >= 1 && (await page.getByText('주제와 상황을 골라').count()) === 0)
  const firstScreen = []
  for (const [w, h] of [
    [412, 780],
    [390, 800],
    [360, 740],
  ]) {
    await page.setViewportSize({ width: w, height: h })
    await sleep(200)
    const r = await page.evaluate(() => {
      const tab = document.querySelector('nav[aria-label]') ?? document.querySelector('[data-app-shell] > :last-child')
      const tabTop = tab ? tab.getBoundingClientRect().top : window.innerHeight
      const lesson = [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? '').startsWith('수업 만들기'))
      const words = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === '시작하기')
      return { tabTop, lesson: lesson?.getBoundingClientRect().bottom ?? null, words: words?.getBoundingClientRect().bottom ?? null }
    })
    firstScreen.push(`${w}x${h}: 단어 ${r.words === null ? '없음' : Math.round(r.words)} · 수업 ${r.lesson === null ? '없음' : Math.round(r.lesson)} / 탭 ${Math.round(r.tabTop)}`)
  }
  check('1b 첫 화면(412×780·390×800·360×740)에 두 카드 주 버튼 위치 기록', true, firstScreen.join(' | '))
  const o1 = await widths('home-start')
  check('1c 오늘 홈 세 폭×두 높이 가로 넘침 0', o1.doc <= 0 && o1.main <= 0, JSON.stringify(o1))

  // ── 2. 주제 고르기·시트 ──────────────────────────────────────
  await page.getByRole('link', { name: '주제 고르기' }).first().click()
  await page.waitForURL('**/study/today/talk/new')
  await page.getByText('어떤 이야기로 수업할까요?').waitFor()
  const rows = page.locator('ul li button[aria-haspopup="dialog"]')
  await rows.first().waitFor()
  check('2a 주제 목록: 행(아직 수업하지 않았어요)·붙여넣기 카드·탭 바 숨김', (await rows.count()) >= 3 && (await page.getByText('아직 수업하지 않았어요').count()) >= 1 && (await page.getByRole('link', { name: '문장 붙여넣기' }).count()) === 1 && (await page.locator('nav a[href="/study/today"]').count()) === 0)
  const o2 = await widths('topics')
  check('2b 주제 화면 넘침 0', o2.doc <= 0 && o2.main <= 0, JSON.stringify(o2))
  await page.getByText('카페 주문').first().click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  check('2c 주제 시트: 표현 12개·조각 묶음 4종·안내·수업 만들기/닫기', (await dialog.getByText('이 주제의 표현 12개').count()) === 1 && (await dialog.getByText('액션 조각').count()) === 1 && (await dialog.getByRole('button', { name: '수업 만들기' }).count()) === 1)
  const o2s = await widths('topics-sheet')
  check('2d 시트 세 폭 넘침 0', o2s.doc <= 0, JSON.stringify(o2s))
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'detached' })
  check('2e Esc 로 닫힘', (await page.getByRole('dialog').count()) === 0)

  // ── 3. 붙여넣기 ─────────────────────────────────────────────
  await page.getByRole('link', { name: '문장 붙여넣기' }).click()
  await page.waitForURL('**/talk/new/paste')
  const ta = page.locator('textarea#paste')
  await ta.fill('短い文です。')
  check('3a 짧음 안내·글자 수(코드포인트)', (await page.locator('#paste-hint').textContent())?.includes('지금 6자') && (await page.locator('#paste-count').textContent())?.includes('6 / 2,000자'))
  await shot('paste-short-390x844')
  // aria-disabled 버튼(누르면 이유 토스트 — §12-2 C) — Playwright 는 aria-disabled 를 "비활성"으로 봐서 force 로 누른다
  await byRole('button', '이 문장으로 수업 만들기').click({ force: true })
  await sleep(300)
  check('3b 50자 미만 → 요청 없이 토스트', (await page.getByText('50자 이상 넣어 주세요').count()) >= 1 && page.url().includes('/paste'))
  await ta.fill('This is an English sentence and not Japanese at all, so the server should refuse it. '.repeat(1))
  await byRole('button', '이 문장으로 수업 만들기').click()
  await page.getByText('일본어 문장이 너무 적어요.').waitFor({ timeout: 10000 })
  check('3c 일본어 아님 → 서버 400 → 오류 상자', true)
  await shot('paste-noja-390x844')
  const o3 = await widths('paste')
  check('3d 붙여넣기 넘침 0', o3.doc <= 0 && o3.main <= 0, JSON.stringify(o3))
  const src = '昨日、友達と新しいカフェに行きました。店員さんに「ご注文はお決まりですか」と聞かれて、少し緊張しました。私はホットコーヒーを、友達は抹茶ラテを注文しました。窓の外を見ながら、週末の旅行について話しました。'
  await ta.fill(src)
  const genT0 = Date.now()
  await byRole('button', '이 문장으로 수업 만들기').click()
  await page.waitForURL('**/study/today/talk/c*', { timeout: 15000 })
  const genId = page.url().split('/').pop()
  await page.getByText('선생님이 수업을 만들고 있어요').waitFor({ timeout: 15000 })
  check('3e 생성 → 수업 경로(replace)·대기 화면(경과·순서 카드·오늘로 돌아가기)', (await page.getByText('이런 순서로 공부해요').count()) === 1 && (await page.getByText('보통 1~2분 걸려요').count()) >= 1)
  await shot('gen-wait-390x844')
  const o3g = await widths('gen-wait')
  check('3f 대기 화면 넘침 0', o3g.doc <= 0, JSON.stringify(o3g))
  // 실패 또는 준비 — 어느 쪽이든 화면 전환 확인
  const settled = await Promise.race([
    page.getByText('수업을 만들지 못했어요').waitFor({ timeout: REAL_GEN ? 200000 : 60000 }).then(() => 'failed'),
    page.getByText('① 이해 · 듣고 이해하기').waitFor({ timeout: REAL_GEN ? 200000 : 60000 }).then(() => 'ready'),
  ]).catch(() => 'timeout')
  metrics.genSettled = `${settled} ${Math.round((Date.now() - genT0) / 1000)}s`
  if (settled === 'failed') {
    await shot('gen-fail-390x844')
    check('3g 생성 실패 화면: 다시 만들기·다른 주제 고르기, 오류 코드 비노출', (await byRole('button', '다시 만들기').count()) === 1 && (await page.getByText(/ENGINE_|stale/).count()) === 0)
    await page.goto(`${BASE}/study/today`, { waitUntil: 'networkidle' })
    await page.getByText('수업을 만들지 못했어요').waitFor({ timeout: 15000 })
    check('3h 오늘 홈 실패 카드(붙여넣은 문장 · 다시 만들기·주제 고르기)', (await page.getByText('붙여넣은 문장 · 다시 만들면').count()) === 1)
    await shot('home-genfail-390x844')
  } else if (settled === 'ready') {
    await shot('gen-ready-390x844')
    const toastSeen = (await page.getByText('수업이 준비됐어요').count()) >= 1
    const focusedGen = await page.evaluate(() => document.activeElement?.textContent ?? '')
    check('3g 생성 완료 → 5단계 화면으로 전환(토스트 "수업이 준비됐어요"·① h2 초점)', toastSeen && focusedGen.includes('① 이해'), `toast=${toastSeen} focus=${focusedGen.slice(0, 20)}`)
    const og = await widths('gen-ready-l1')
    check('3h 실제 생성 수업 ①(A4 본문) 세 폭×두 높이 넘침 0', og.doc <= 0 && og.main <= 0, JSON.stringify(og))
    const leakG = await engineLeak()
    check('3i 실제 생성 수업 화면 엔진명 0', !leakG, String(leakG))
  } else check('3g 생성 결과 화면', false, settled)
  // 생성 테스트 레슨은 치운다(아래 흐름은 고정 레슨으로)
  await prisma.aiJob.deleteMany({ where: { userId: uid, refId: genId } })
  await prisma.lesson.deleteMany({ where: { id: genId } })

  // ── 4. 준비된 수업 → 5단계 ───────────────────────────────────
  const lessonId = await makeLesson()
  await page.goto(`${BASE}/study/today`, { waitUntil: 'networkidle' })
  await page.getByText('수업이 준비됐어요').waitFor({ timeout: 15000 })
  check('4a 오늘 홈: ★ 준비됨 카드(READY·0단계 — 시작하기)', (await byRole('button', '시작하기').count()) >= 1 && (await page.getByText('카페 주문 · 5단계 · 약 15분').count()) === 1)
  await shot('home-ready-390x844')
  await page.locator('section[aria-labelledby="lesson-card-title"]').getByRole('button', { name: '시작하기' }).click()
  await page.waitForURL(`**/talk/${lessonId}`)
  await page.getByText('① 이해 · 듣고 이해하기').waitFor()
  const steps = page.locator('nav[aria-label^="수업 단계"] button')
  check('4b 수업 틀: 머리(sr 주제)·단계 5칸(지금=1, 3~5 잠김)·탭 바 없음', (await steps.count()) === 5 && (await steps.nth(0).getAttribute('aria-current')) === 'step' && (await steps.nth(2).getAttribute('aria-disabled')) === 'true')
  await steps.nth(3).click({ force: true })
  await page.getByText('앞 단계를 마치면 열려요').waitFor({ timeout: 3000 })
  check('4c 잠긴 단계 → 토스트', true)
  check('4d 느리게 들을 땐 글자 가림(d=B)·글자 보기 버튼·자동 재생 없음(b=B)', (await page.getByText('글자를 가리고 먼저 들어요.').count()) === 1 && (await page.locator('p[lang="ja"]', { hasText: 'いらっしゃいませ' }).count()) === 0)
  await shot('l1-hidden-390x844')
  // 느리게 듣기 — 첫 소리(줄 강조)까지
  const t0 = Date.now()
  await page.getByRole('button', { name: /느리게 듣기/ }).click()
  await page.getByText(/느리게 듣는 중 · 1\/3줄/).waitFor({ timeout: 15000 })
  metrics.firstSoundMs = Date.now() - t0
  await shot('l1-playing-390x844')
  check('4e 탭 → 첫 소리(상태 줄 "느리게 듣는 중 · 1/3줄")', metrics.firstSoundMs <= 4000, `${metrics.firstSoundMs}ms (캐시 miss 포함)`)
  await page.getByText('이번엔 보통 속도로 들어 봐요').waitFor({ timeout: 60000 })
  check('4f 구간 끝까지 → 느리게 ✓·다음은 보통', (await page.getByText('① 느리게 ✓').count()) === 1)
  await page.getByRole('button', { name: /보통 속도로/ }).click()
  await sleep(500)
  check('4g 보통 속도 시작하면 글자가 보인다(대화 줄 + 읽기 줄)', (await page.locator('p[lang="ja"]', { hasText: 'いらっしゃいませ' }).count()) >= 1)
  await page.getByText('이 구간을 다 들었어요').waitFor({ timeout: 60000 })
  check('4h 구간 다 들음 → 들었어요 배지', (await page.getByText('들었어요').count()) >= 1)
  // 메모
  const memo = page.locator('input#memo-in-1')
  await memo.fill('coffee')
  await memo.press('Enter')
  check('4i 메모 비일본어 → 오류', (await page.getByText('일본어로 적어 주세요').count()) === 1)
  for (const w of ['ちゅうもん', 'コーヒー', 'いらっしゃいませ', '冷たい']) {
    await memo.fill(w)
    await memo.press('Enter')
  }
  await memo.fill('コーヒー')
  await memo.press('Enter')
  check('4j 메모 칩 4개·중복 오류', (await page.getByText('4/5').count()) >= 1 && (await page.getByText('이미 적은 단어예요.').count()) === 1)
  await page.getByRole('button', { name: '다음 구간' }).click()
  await page.getByRole('button', { name: /단어장에 넣을까요/ }).click()
  await page.getByText(/단어 제안 \d+개/).waitFor({ timeout: 60000 })
  const cards = page.getByText('단어 제안 · 대화')
  check('4k 메모 → 제안 카드(출처 캡션 "대화 n번째 줄")·메모가 바뀌면 안내 줄', (await cards.count()) >= 1 && (await page.getByText('사전에 싣는 모양으로 바꿨어요').count()) >= 1)
  check('4k2 이미 단어장에 있는 단어 → 제안 대신 "이미 단어장에 있어요" 줄', (await page.getByText('이미 단어장에 있어요').count()) === 1)
  const wordsBefore = await prisma.wordEntry.count({ where: { userId: uid, source: 'LESSON' } })
  check('4l 채택 전 단어장(LESSON) 행 0', wordsBefore === 0)
  await shot('l1-memo-390x844')
  await page.getByRole('button', { name: '단어장에 추가' }).first().click()
  await page.getByText('단어장에 추가했어요').first().waitFor({ timeout: 10000 })
  check('4m [단어장에 추가] → WordEntry(source=LESSON)', (await prisma.wordEntry.count({ where: { userId: uid, source: 'LESSON', sourceRefId: lessonId } })) === 1)
  const memo2 = page.locator('input#memo-in-2')
  await memo2.fill('持ち帰ります')
  await memo2.press('Enter')
  const more = page.getByRole('button', { name: /새로 적은 단어 1개도 제안받기/ })
  await more.waitFor({ timeout: 5000 })
  await Promise.all([page.waitForResponse((r) => /\/memo$/.test(r.url()) && r.request().method() === 'POST', { timeout: 60000 }), more.click()])
  await sleep(500)
  check(
    '4m2 새로 적은 단어만 더 제안받기(대화 6번째 줄 제안 추가·앞 채택 상태 유지)',
    (await page.getByText('단어 제안 · 대화 6번째 줄').count()) === 1 && (await page.getByText('단어장에 추가했어요').count()) >= 1 && (await more.count()) === 0,
  )
  const o4 = await widths('l1')
  check('4n ① 세 폭×두 높이 넘침 0', o4.doc <= 0 && o4.main <= 0, JSON.stringify(o4))
  const leak1 = await engineLeak()
  check('4o ① 화면 엔진명·서명 URL 0', !leak1, String(leak1))
  await page.getByRole('button', { name: '다음 단계 · ② 문법' }).click()
  await page.getByText('② 문법 · 표현과 문형').waitFor()
  const focused = await page.evaluate(() => document.activeElement?.textContent ?? '')
  check('4p 단계 넘김 → ② h2 로 초점·stageDone 1 저장', focused.includes('② 문법') && (await prisma.lesson.findUnique({ where: { id: lessonId } })).stageDone === 1)
  await page.getByRole('button', { name: '예문 듣기' }).first().click()
  await page.getByRole('button', { name: '멈추기' }).first().waitFor({ timeout: 15000 })
  check('4q ② 예문 듣기 → 멈추기로 바뀜', true)
  await shot('l2-390x844')
  const o5 = await widths('l2')
  check('4r ② 넘침 0', o5.doc <= 0 && o5.main <= 0, JSON.stringify(o5))
  await page.getByRole('button', { name: '다음 단계 · ③ 문제' }).click()
  // ③ 문제: q2 만 틀림
  await page.getByText('③ 문제 · 5문제').waitFor()
  const picks = [0, 0, 0, 1, 0]
  for (let i = 0; i < 5; i++) {
    const group = page.getByRole('group', { name: '보기' })
    await group.locator('button').nth(picks[i]).click()
    await page.locator('[role="status"]').filter({ hasText: /맞았어요|틀렸어요/ }).first().waitFor()
    if (i === 1) {
      await shot('l3-wrong-390x844')
      // 앞 답의 쓰기(한 줄 큐 — 느린 DB 에선 늦게 나간다)가 다 나간 뒤에 다시 눌러 본다
      let stable = writes.length
      for (let t = 0; t < 20; t++) {
        await sleep(500)
        if (writes.length === stable && t >= 2) break
        stable = writes.length
      }
      const w0 = writes.length
      await group.locator('button').nth(1).click({ force: true })
      await sleep(1500)
      metrics.quizReclickWrites = writes.length - w0
    }
    await page.getByRole('button', { name: i < 4 ? '다음 문제' : '결과 보기' }).click()
  }
  await page.getByText('5문제 중 4문제 맞혔어요').waitFor()
  // 쓰기는 한 줄 큐(순서대로) — 공유 NAS DB 가 느릴 때(쓰기 1회 0.5~2.5s) 큐가 다 비워질 때까지 기다린다
  let qa = null
  for (let t = 0; t < 40; t++) {
    qa = (await prisma.lesson.findUnique({ where: { id: lessonId } })).progress?.quiz?.answers
    if (JSON.stringify(qa) === JSON.stringify(picks)) break
    await sleep(500)
  }
  check('4s ③ 결과 4/5·첫 답 고정(틀린 뒤 다시 눌러도 요청 0·저장값 그대로)', JSON.stringify(qa) === JSON.stringify(picks) && metrics.quizReclickWrites === 0, `${JSON.stringify(qa)} reclickWrites=${metrics.quizReclickWrites}`)
  await shot('l3-sum-390x844')
  await page.getByRole('button', { name: '다음 단계 · ④ 응용' }).click()
  // ④ 응용
  await page.getByText('④ 응용 · 문장 만들기 3개').waitFor()
  await page.getByRole('button', { name: '모범 답안과 비교하기' }).click({ force: true })
  check('4t ④ 빈 칸 비교 → 토스트', (await page.getByText('먼저 문장을 써 보세요').count()) >= 1)
  await page.locator('textarea#apply-input').fill('紅茶を一つください。')
  await page.getByRole('button', { name: '모범 답안과 비교하기' }).click()
  await page.getByText('채점하지 않아요.').waitFor()
  await shot('l4-compare-390x844')
  const o6 = await widths('l4-compare')
  check('4u ④ 비교(휴대폰 폭 위아래) 넘침 0', o6.doc <= 0 && o6.main <= 0, JSON.stringify(o6))
  await page.getByRole('button', { name: '다음 상황' }).click()
  await page.getByRole('button', { name: /말로 쓰기/ }).click()
  await page.getByText('여기에 알아들은 말이 나와요').waitFor()
  await shot('l4-voice-390x844')
  check('4v ④ 말로 쓰기 모양(인식 상자·누르고 말하기)', (await page.getByRole('button', { name: '누르고 있는 동안 말하기' }).count()) === 1)
  await page.getByRole('button', { name: /글자로 쓰기/ }).click()
  await page.getByRole('button', { name: /모르겠어요/ }).click()
  await page.getByText('(쓰지 않고 봤어요)').waitFor()
  await page.getByRole('button', { name: '다음 상황' }).click()
  await page.locator('textarea#apply-input').fill('小さいサイズでお願いします。')
  await page.getByRole('button', { name: '모범 답안과 비교하기' }).click()
  await page.getByRole('button', { name: '다음 단계 · ⑤ 말하기' }).click()
  // ⑤ 말하기(글자 답)
  await page.getByText('⑤ 말하기 · 과제 3개').waitFor()
  await shot('l5-voice-390x844')
  check('4w ⑤ 음성 바(키보드·72px 누르고 말하기)', (await page.getByRole('button', { name: '글자로 답하기' }).count()) >= 1 && (await page.getByRole('button', { name: /누르고 있는 동안 말하기|소리를 멈추고/ }).count()) === 1)
  await page.getByRole('button', { name: '글자로 답하기' }).first().click()
  const tbox = page.getByRole('textbox', { name: '글자로 답하기' })
  await tbox.fill('冷たいコーヒーをください。')
  await tbox.press('Enter')
  await page.getByText('✓ 목표 표현을 모두 썼어요').waitFor({ timeout: 15000 })
  await shot('l5-ok-390x844')
  check('4x ⑤ 글자 답 → 목표 표현 모두 씀(✓ 썼어요 칩)', (await page.getByText('✓ 썼어요').count()) >= 2)
  await page.getByRole('button', { name: '다음 과제' }).click()
  await tbox.fill('お茶をください。')
  await page.getByRole('button', { name: '확인하기' }).click()
  await page.getByText(/아직 안 쓴 표현/).waitFor({ timeout: 15000 })
  await shot('l5-miss-390x844')
  check('4y ⑤ 목표 표현 없음 → "아직 안 쓴 표현" + 모범 답안', (await page.getByText('· 아직').count()) >= 1)
  await page.getByRole('button', { name: '다음 과제' }).click()
  await page.getByRole('button', { name: '이 과제 건너뛰기' }).click()
  await page.getByText('(건너뛰었어요)').waitFor()
  const o7 = await widths('l5')
  check('4z ⑤ 넘침 0(입력 바 고정)', o7.doc <= 0 && o7.main <= 0, JSON.stringify(o7))
  await page.getByRole('button', { name: '수업 마치기' }).click()
  await page.getByRole('heading', { name: '수업을 마쳤어요' }).first().waitFor({ timeout: 15000 })
  await sleep(300)
  const lessonRow = await prisma.lesson.findUnique({ where: { id: lessonId } })
  check('5a 수업 마치기 → 종료 카드·DONE·점수 80(서버 재채점)', lessonRow.status === 'DONE' && lessonRow.score === 80)
  check('5b 종료 카드: 4/5·만든 문장 2·쓴 표현·다음 시간엔·단어장 1개·이어서 말하기', (await page.getByText('4/5').count()) >= 1 && (await page.getByText('다음 시간엔').count()) === 1 && (await page.getByText('단어장에 넣은 단어 1개').count()) === 1 && (await byRole('button', '이 주제로 선생님과 이어서 말하기').count()) === 1)
  await shot('end-390x844')
  const o8 = await widths('end')
  check('5c 종료 카드 넘침 0', o8.doc <= 0 && o8.main <= 0, JSON.stringify(o8))
  const leak2 = await engineLeak()
  check('5d 종료 카드 엔진명 0', !leak2, String(leak2))
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: '수업을 마쳤어요' }).first().waitFor()
  check('5e 다시 들어와도 종료 카드(#60 재계산 4/5)', (await page.getByText('4/5').count()) >= 1)
  await page.goto(`${BASE}/study/today`, { waitUntil: 'networkidle' })
  await page.getByText('오늘 수업을 끝냈어요').waitFor({ timeout: 15000 })
  const doneLine = await page.getByText(/문제 4\/5 맞힘/).first().textContent()
  check('5f 오늘 홈 완료 카드: 문제 4/5 · 말하기 표현 n/m · 다음 시간엔', /말하기 표현 \d+\/\d+/.test(doneLine ?? '') && (await page.getByText('주문을 바꾸고 계산하기').count()) >= 1, doneLine)
  await shot('home-done-390x844')
  // 끝낸 수업 결과 보기 → 종료 카드 → 이어서 말하기 → 회화방
  await page.getByRole('button', { name: '끝낸 수업 결과 보기' }).click()
  await page.waitForURL(`**/talk/${lessonId}`)
  await page.getByRole('heading', { name: '수업을 마쳤어요' }).first().waitFor({ timeout: 15000 })
  check('5f2 홈 [끝낸 수업 결과 보기] → 종료 카드', true)
  await byRole('button', '이 주제로 선생님과 이어서 말하기').click()
  await page.waitForURL('**/study/ai/talk/**', { timeout: 15000 })
  const talkId = page.url().split('/').pop()
  const talkChat = await prisma.chat.findUnique({ where: { id: talkId } })
  check('5g 이어서 말하기 → 회화방(주제 = 카페 주문)', talkChat?.topicId === cafe.id)
  await prisma.chat.deleteMany({ where: { id: talkId, userId: uid } })

  // ── 6. 재개·다시 보기(쓰기 0) ────────────────────────────────
  const resumeId = await makeLesson({ status: 'IN_PROGRESS', stageDone: 2, progress: { quiz: { answers: [0, null, null, null, null] }, listen: { segmentsDone: [1, 2, 3], memo: [] } } })
  await page.goto(`${BASE}/study/today`, { waitUntil: 'networkidle' })
  await page.getByText('하던 수업이 있어요').waitFor({ timeout: 15000 })
  const progLine = await page.getByText(/5단계 중 2단계 끝냄/).first().textContent()
  check('6a0 오늘 홈: 하던 수업 카드(카페 주문 · 오늘 시작 · 2단계 끝냄 · 다음은 ③ 문제)', (progLine ?? '').includes('카페 주문 · 오늘 시작') && (await page.getByText('다음은 ③ 문제예요').count()) === 1, progLine)
  await shot('home-progress-390x844')
  await page.locator('section[aria-labelledby="lesson-card-title"]').getByRole('button', { name: '이어서 하기' }).click()
  await page.waitForURL(`**/talk/${resumeId}`)
  await page.getByText('③ 문제부터 이어서 해요').waitFor({ timeout: 10000 })
  check('6a 재개 → ③ 부터 + 토스트, 첫 미답 문항(2/5)부터', (await page.getByText('문제 2 / 5').count()) === 1)
  await shot('l-resume-390x844')
  const before = writes.length
  await page.locator('nav[aria-label^="수업 단계"] button').nth(0).click()
  await page.getByText('끝낸 단계를 다시 보는 중이에요').waitFor()
  await sleep(1500)
  check('6b 다시 보기: 안내 줄·[지금 단계로 · ③ 문제]·쓰기 요청 0', (await byRole('button', '지금 단계로 · ③ 문제').count()) === 1 && writes.length === before, `writes +${writes.length - before}`)
  await shot('l-review-390x844')
  await byRole('button', '지금 단계로 · ③ 문제').click()
  await page.getByText('③ 문제 · 5문제').waitFor()

  // ── 7. 자막만(TEXT_ONLY — 이 페이지에서만 가로챔) ────────────────
  const textOnlyId = await makeLesson()
  await ctx.route('**/api/v1/speech/tts/status', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { executionMode: 'TEXT_ONLY', networkStatus: 'ONLINE', serverHealth: 'UNAVAILABLE', fallbackReason: 'SERVER_ERROR', lastUpdatedAt: null }, message: null }) }))
  await ctx.route('**/api/v1/lessons/*/audio', (r) => r.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ success: false, data: { code: 'ENGINE_UNAVAILABLE', details: { reason: 'TTS_UNAVAILABLE' } }, message: '…' }) }))
  const p2 = await ctx.newPage()
  await p2.goto(`${BASE}/study/today/talk/${textOnlyId}`, { waitUntil: 'networkidle' })
  await p2.getByText('지금은 선생님 목소리를 들을 수 없어요(자막만)').waitFor({ timeout: 15000 })
  check('7a 자막만: 듣기 버튼 대신 [읽었어요 · 다음 구간]·글자 처음부터 보임', (await p2.getByRole('button', { name: '읽었어요 · 다음 구간' }).count()) === 1 && (await p2.locator('p[lang="ja"]', { hasText: 'いらっしゃいませ' }).count()) >= 1 && (await p2.getByRole('button', { name: /느리게 듣기/ }).count()) === 0)
  await p2.screenshot({ path: join(OUT, 'l1-textonly-390x844.png') })
  await p2.getByRole('button', { name: '읽었어요 · 다음 구간' }).click()
  let segDone = []
  for (let t = 0; t < 30 && !segDone.includes(1); t++) {
    await sleep(500)
    segDone = (await prisma.lesson.findUnique({ where: { id: textOnlyId } })).progress?.listen?.segmentsDone ?? []
  }
  check('7b 자막만 [읽었어요] → segmentsDone 저장(800ms 모아 보내기)', segDone.includes(1), JSON.stringify(segDone))
  await p2.close()
  await ctx.unroute('**/api/v1/speech/tts/status')
  await ctx.unroute('**/api/v1/lessons/*/audio')

  // ── 8. 없는 수업 ────────────────────────────────────────────
  await page.goto(`${BASE}/study/today/talk/nope000000000000000000000`, { waitUntil: 'networkidle' })
  await page.getByText('이 수업을 찾을 수 없어요.').waitFor({ timeout: 10000 })
  check('8a 없는·남의 수업 → "이 수업을 찾을 수 없어요"', true)
  await shot('l-404-390x844')

  const consoleLeak = consoleLines.filter((l) => ENGINE_RE.test(l) || /\/api\/v1\/speech\/tts\/[A-Za-z0-9_-]{20,}/.test(l))
  const consoleErrors = consoleLines.filter((l) => /^(error|pageerror)/.test(l) && !/Failed to load resource/.test(l))
  check('9a 콘솔 엔진명·서명 URL 0', consoleLeak.length === 0, consoleLeak.slice(0, 2).join(' | '))
  check('9b 콘솔 오류 0(자원 로드 실패 제외)', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))
}

try {
  await main()
} catch (e) {
  check('EXCEPTION', false, e instanceof Error ? e.message.split('\n')[0] : String(e))
  await page.screenshot({ path: join(OUT, 'exception.png') }).catch(() => undefined)
} finally {
  await wipe().catch(() => undefined)
  if (seededWordId) await prisma.wordEntry.deleteMany({ where: { id: seededWordId, userId: uid } }).catch(() => undefined)
  if (dailyBefore === null) await prisma.statsSnapshot.deleteMany({ where: { userId: uid, kind: 'DAILY', periodKey: today } }).catch(() => undefined)
  else await prisma.statsSnapshot.updateMany({ where: { userId: uid, kind: 'DAILY', periodKey: today }, data: { data: dailyBefore.data } }).catch(() => undefined)
  console.log('(QA 데이터 정리: 레슨·잡·제안·LESSON 단어·반복 항목·기록·스냅샷 삭제, 선점 단어 삭제, DAILY 복원)')
  await browser.close()
  await prisma.$disconnect()
  const failed = results.filter((r) => !r.ok)
  console.log(`\n지표: ${JSON.stringify(metrics)}`)
  console.log(`결과: ${results.length - failed.length}/${results.length} PASS${failed.length ? ` — 실패 ${failed.map((f) => f.name.split(' ')[0]).join(', ')}` : ''}`)
  process.exit(failed.length ? 1 : 0)
}
