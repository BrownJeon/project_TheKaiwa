/**
 * qa-045-ui-d 공용 도우미(주제 고치기 S7) — lib.mjs 위에 얹는다. LLM 호출 0.
 */
import { prisma, api, data, j, sleep, BASE, check, note, openPage, mainScrollTop, toastWait } from './lib.mjs'

/** 시드 「자기소개」 앞 10개 표현으로 내 주제(#57) 만들기. 반환 { id, chunks: 서버가 준 표현[] }. */
export async function mkTopic10(cookie, title, level = 'N5') {
  const intro = (data(await api(cookie, 'GET', '/api/v1/topics?level=all'))?.items ?? []).find((t) => t.isSeed && t.title === '자기소개')
  const chunks = intro.chunks.slice(0, 10).map((x) => ({ chunkType: x.chunkType, textJa: x.textJa, reading: x.reading, meaningKo: x.meaningKo }))
  let r = await api(cookie, 'POST', '/api/v1/topics', { title, titleJa: '自己紹介', level, description: 'QA 주제 고치기 시험용', chunks })
  if (r.status === 429) {
    note('429 — 62초 대기 후 재시도')
    await sleep(62000)
    r = await api(cookie, 'POST', '/api/v1/topics', { title, titleJa: '自己紹介', level, description: 'QA 주제 고치기 시험용', chunks })
  }
  if (r.status !== 201) {
    note('mkTopic10 FAIL ' + r.status + ' ' + j(r.body).slice(0, 300))
    return null
  }
  const t = data(r).topic
  return { id: t.id, chunks: t.chunks }
}

/** DB 표현 행(순서대로). */
export async function readChunks(topicId) {
  return prisma.topicChunk.findMany({ where: { topicId }, orderBy: [{ order: 'asc' }, { id: 'asc' }] })
}
export async function readTopic(topicId) {
  return prisma.conversationTopic.findUnique({ where: { id: topicId } })
}
export const ids = (rows) => rows.map((c) => c.id)
export const nonGet = (reqs, from = 0) => reqs.slice(from).filter((r) => r.m !== 'GET')

export const editUrl = (id) => `${BASE}/settings/scenarios/topics/${id}/edit`
export const viewPath = (id) => `/settings/scenarios/topics/${id}`

/** 고치기 화면을 열고 준비(이름 칸)까지 기다린다. */
export async function openEdit(page, id) {
  await page.goto(editUrl(id), { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#tp-title', { timeout: 20000 })
  await sleep(250)
}

export const saveBtn = (page) => page.getByRole('button', { name: /^(저장|내 버전으로 저장|주제를 저장하고 있어요…)$/ })
export const backBtn = (page) => page.locator('header:has(h1)').first().locator('button').first()

/** 터치로 누르기 — 화면 안으로 스크롤한 뒤 중앙 좌표를 탭(실제 손가락과 같은 경로). */
export async function tapEl(page, loc) {
  await loc.evaluate((el) => el.scrollIntoView({ block: 'center' })) // sticky 머리 밑에 가려지지 않게 가운데로(시험의 스크롤 — 앱 동작 아님)
  await sleep(60)
  const b = await loc.boundingBox()
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
}
export async function doubleTapEl(page, loc) {
  await loc.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await sleep(60)
  const b = await loc.boundingBox()
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
}

export const rowOf = (page, textJa) => page.locator('li', { has: page.locator(`button[aria-label="${textJa} 표현 메뉴"]`) })

/** 표현 행 ⋯ → 메뉴 항목(고치기·위로·아래로·지우기). */
export async function menuAction(page, textJa, label) {
  await tapEl(page, page.locator(`button[aria-label="${textJa} 표현 메뉴"]`))
  const dlg = page.getByRole('dialog')
  await dlg.waitFor({ state: 'visible', timeout: 5000 })
  await sleep(150)
  await dlg.getByRole('button', { name: label, exact: true }).tap()
  await dlg.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
  await sleep(200)
}

/** 펼친 편집기(행 안) 칸 3개 — 일본어·읽기·뜻. */
export const editorInputs = (page, textJa) => rowOf(page, textJa).locator('input[type=text]')

export async function applyEdit(page, textJa) {
  await rowOf(page, textJa).getByRole('button', { name: '바꾸기', exact: true }).tap()
  await sleep(250)
}

/** 일본어 글 안내(role=note) 가 화면 어디에 몇 개, 어느 행에 있는지. */
export async function retextNotes(page) {
  return page.evaluate(() => {
    const NOTE = '일본어 글을 바꾸면 이 표현의 연습 기록이 처음부터 다시 시작돼요.'
    const els = [...document.querySelectorAll('[role=note]')].filter((e) => (e.textContent ?? '').includes(NOTE))
    return els.map((e) => {
      const li = e.closest('li')
      const vis = getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().height > 0
      return { vis, inRow: !!li, rowText: li ? (li.querySelector('p[lang=ja]')?.textContent ?? '').trim() : null, text: (e.textContent ?? '').trim() }
    })
  })
}

/** 화면에서 저장 뒤 S6 도착(경로+토스트+머리 제목 초점). */
export async function afterSave(page, id, tPat = /저장했어요/) {
  await page.waitForURL((u) => u.pathname === viewPath(id), { timeout: 15000 })
  const toasts = await toastWait(page, tPat)
  await sleep(500)
  const active = await page.evaluate(() => {
    const a = document.activeElement
    return { tag: a?.tagName ?? null, text: (a?.textContent ?? '').trim().slice(0, 30) }
  })
  return { url: new URL(page.url()), toasts, active }
}

export * from './lib.mjs'
