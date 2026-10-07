/**
 * qa-045-ui-d 항목 4 — S7 스크롤·접근성·넘침: scrollTop 차·초점·size=sm 44px·긴 글 가로 넘침·lang/16px/aria·404·XSS·엔진명. #170 은 모의(LLM 호출 0).
 * 실행: cd $HOME/.node-local/thekaiwa-qa045ui-d && QA_COOKIE=<c1 쿠키> node --env-file=.env <이 파일>
 */
import {
  check, cleanupQa, closeBrowser, cookieOf, docScrollMetrics, editorInputs, launch, mainScrollTop, menuAction, mkTopic10, note, openEdit, openPage, overflowInfo, prisma, qaRowCounts, qaUser, QA1,
  rowOf, saveBtn, seedHash, sleep, summary, tapEl, viewPath, WIDTHS, BASE,
} from './h.mjs'

const cookie = cookieOf(process.env.QA_COOKIE)
const u = await qaUser(QA1)
const seed0 = await seedHash()
const browser = await launch()
const bodyText = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
const chip = (page, lv) => page.getByRole('radiogroup', { name: '수준' }).getByRole('radio', { name: lv, exact: true })
const ENGINE = /reazon|whisper|style-?bert|model_?id|speaker_?id|claude|sherpa|\bAI\b|에이아이/i

/** 스크롤 없이 현재 위치 그대로 탭. */
async function tapAt(page, loc) {
  const b = await loc.boundingBox()
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
}
const setScroll = (page, y) => page.evaluate((y) => { document.querySelector('main').scrollTop = y }, y)
const centerEl = (loc) => loc.evaluate((el) => el.scrollIntoView({ block: 'center' }))
/** 버튼 전수: 높이 <44 목록(라디오는 따로). */
const smallButtons = (page) =>
  page.evaluate(() => {
    const out = []
    const radios = []
    for (const b of document.querySelectorAll('main button, header button, [role=dialog] button')) {
      const cs = getComputedStyle(b)
      if (cs.visibility === 'hidden' || cs.display === 'none') continue
      const r = b.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const rec = { t: (b.getAttribute('aria-label') ?? b.textContent ?? '').trim().slice(0, 24), h: Math.round(r.height * 10) / 10, w: Math.round(r.width) }
      if (b.getAttribute('role') === 'radio') {
        // 보이는 높이는 32~36 이어도 ::before 44px 히트 영역 — 위쪽 5px 밖 점이 같은 버튼을 가리키는지
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top - 5)
        radios.push({ ...rec, hit44: hit === b || b.contains(hit) })
      } else if (r.height < 43.5) out.push(rec)
    }
    return { small: out, radios }
  })
const inputsInfo = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('main input[type=text], main textarea')].map((i) => ({
      id: i.id, lang: i.getAttribute('lang'), fs: parseFloat(getComputedStyle(i).fontSize), h: Math.round(i.getBoundingClientRect().height),
    })),
  )
const longOverflow = async (page) => {
  const m = await page.evaluate(() => {
    const el = document.querySelector('main')
    return { mainSW: el.scrollWidth, mainCW: el.clientWidth }
  })
  const d = await docScrollMetrics(page)
  const ov = await overflowInfo(page, null)
  return { ...m, docSW: d.scrollWidth, docCW: d.clientWidth, elems: ov.count, items: ov.items }
}

for (const [w, h] of WIDTHS) {
  const tag = `[${w}]`
  await cleanupQa(u.id)
  const pages = []
  try {
    const F = await mkTopic10(cookie, `QA 접근성 ${w}`, 'N5')
    const P = await openPage(browser, w, h, cookie)
    pages.push(P)
    const { page } = P
    let drafts = 'slow'
    await page.route('**/api/v1/topics/drafts', async (route) => {
      if (drafts === 'slow') await sleep(2500)
      try {
        await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ success: false, data: { code: 'INTERNAL', details: {} }, message: '서버메시지-표식-XYZ' }) })
      } catch {}
    })
    await openEdit(page, F.id)
    const texts = []
    texts.push(await bodyText(page))

    // ── 기본 상태: 버튼·입력칸
    let sb = await smallButtons(page)
    check(`${tag} 기본 상태 버튼 전수: 높이 <44px 0개(라디오 제외)`, sb.small.length === 0, JSON.stringify(sb.small))
    check(`${tag} 기본 상태 라디오(수준·종류) 히트 영역 44px(::before)`, sb.radios.length >= 1 && sb.radios.every((r) => r.hit44), JSON.stringify(sb.radios.map((r) => `${r.t}:${r.h}:${r.hit44}`)).slice(0, 160))
    const inp = await inputsInfo(page)
    check(`${tag} 입력칸 전부 글자 16px↑·일본어 이름 lang=ja`, inp.length >= 3 && inp.every((i) => i.fs >= 16) && inp.find((i) => i.id === 'tp-titleJa')?.lang === 'ja', JSON.stringify(inp.map((i) => `${i.id}:${i.fs}:${i.lang}`)))
    const counters = await page.evaluate(() => ['title', 'titleJa', 'description'].map((k) => document.getElementById(`tp-${k}-count`)?.textContent?.trim()))
    check(`${tag} 글자 수 카운터(n/20·n/20·n/120)`, /^\d+\/20$/.test(counters[0]) && /^\d+\/20$/.test(counters[1]) && /^\d+\/120$/.test(counters[2]), JSON.stringify(counters))

    // ── 수준 칩: scrollTop 차·초점·상자 표시
    await setScroll(page, 120)
    await sleep(150)
    const sc0 = await mainScrollTop(page)
    await tapAt(page, chip(page, 'N4'))
    await sleep(500)
    const sc1 = await mainScrollTop(page)
    const f1 = await page.evaluate(() => ({ role: document.activeElement?.getAttribute('role'), checked: document.activeElement?.getAttribute('aria-checked'), t: (document.activeElement?.textContent ?? '').trim() }))
    check(`${tag} 수준 칩 바꾸기: main.scrollTop 차 0px(${sc0}→${sc1})·초점 = 누른 칩`, sc0 > 0 && sc1 === sc0 && f1.role === 'radio' && f1.checked === 'true' && f1.t === 'N4', JSON.stringify(f1))
    texts.push(await bodyText(page))
    sb = await smallButtons(page)
    check(`${tag} 묻기 상자 표시 상태 버튼 <44px 0개`, sb.small.length === 0, JSON.stringify(sb.small))
    // 받는 중(2.5초 지연) → 실패
    await tapAt(page, page.getByRole('button', { name: '표현 다시 받기', exact: true }))
    await sleep(500)
    const sc2 = await mainScrollTop(page)
    texts.push(await bodyText(page))
    sb = await smallButtons(page)
    check(`${tag} 받는 중 상태: scrollTop 차 0px(${sc1}→${sc2})·버튼 <44px 0개`, sc2 === sc1 && sb.small.length === 0, JSON.stringify(sb.small))
    await sleep(2600)
    texts.push(await bodyText(page))
    sb = await smallButtons(page)
    const sc3 = await mainScrollTop(page)
    check(`${tag} 실패 상태: scrollTop 차 0px(${sc1}→${sc3})·버튼 <44px 0개`, sc3 === sc1 && sb.small.length === 0, JSON.stringify(sb.small))
    await tapAt(page, page.getByRole('button', { name: '지금 표현 두기', exact: true }))
    await sleep(500)
    const sc4 = await mainScrollTop(page)
    const f4 = await page.evaluate(() => ({ role: document.activeElement?.getAttribute('role'), checked: document.activeElement?.getAttribute('aria-checked'), t: (document.activeElement?.textContent ?? '').trim() }))
    const gone = await page.locator('[role=status]').filter({ hasText: '표현 다시 받기' }).count()
    check(`${tag} 상자 사라짐([지금 표현 두기]): scrollTop 차 0px(${sc3}→${sc4})·상자 0개·초점 = 수준 칩`, sc4 === sc3 && gone === 0 && f4.role === 'radio' && f4.t === 'N4', JSON.stringify(f4))
    await tapAt(page, chip(page, 'N5'))
    await sleep(300)

    // ── ⋯ 메뉴 열기/닫기 + 고치기 펼침
    const rowBtn = page.locator('button[aria-label="学生 표현 메뉴"]')
    await centerEl(rowBtn)
    await sleep(150)
    const m0 = await mainScrollTop(page)
    await tapAt(page, rowBtn)
    await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 5000 })
    await sleep(300)
    const m1 = await mainScrollTop(page)
    texts.push(await bodyText(page))
    sb = await smallButtons(page)
    check(`${tag} ⋯ 메뉴 열기: scrollTop 차 0px(${m0}→${m1})·시트 안 버튼 <44px 0개`, m0 > 0 && m1 === m0 && sb.small.length === 0, JSON.stringify(sb.small))
    await page.keyboard.press('Escape')
    await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 5000 })
    await sleep(300)
    const m2 = await mainScrollTop(page)
    const f2 = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))
    check(`${tag} ⋯ 메뉴 닫기(Esc): scrollTop 차 0px(${m0}→${m2})·초점 = 그 ⋯ 버튼`, m2 === m0 && f2 === '学生 표현 메뉴', String(f2))
    await tapAt(page, rowBtn)
    await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 5000 })
    await sleep(250)
    const e0 = await mainScrollTop(page)
    await page.getByRole('dialog').getByRole('button', { name: '고치기', exact: true }).tap()
    await sleep(600)
    const e1 = await mainScrollTop(page)
    const f3 = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.id ?? document.activeElement?.tagName)
    check(`${tag} 행 고치기 펼침: scrollTop 차 0px(${e0}→${e1})·편집기 입력칸 3개`, e1 === e0 && (await editorInputs(page, '学生').count()) === 3, `focus=${f3}`)
    sb = await smallButtons(page)
    check(`${tag} 행 편집기 펼침 상태 버튼 <44px 0개([바꾸기]·[취소])·종류 라디오 히트 44px`, sb.small.length === 0 && sb.radios.every((r) => r.hit44), JSON.stringify({ small: sb.small, radios: sb.radios.length }))
    const inpE = await inputsInfo(page)
    const edIn = inpE.filter((i) => i.id.startsWith('tp-chunk-'))
    check(`${tag} 표현 편집기 입력칸: 글자 16px↑·일본어·읽기 lang=ja·뜻은 lang 없음`, edIn.length === 3 && edIn.every((i) => i.fs >= 16) && edIn[0].lang === 'ja' && edIn[1].lang === 'ja' && edIn[2].lang === null, JSON.stringify(edIn.map((i) => `${i.id}:${i.fs}:${i.lang}`)))
    texts.push(await bodyText(page))

    // ── 긴 글(공백 없는 한글 100자) 가로 넘침
    const long100 = '가'.repeat(100)
    await editorInputs(page, '学生').nth(2).fill(long100)
    const ovEdit = await longOverflow(page)
    check(`${tag} 긴 뜻(100자) 입력 중: main·문서 가로 넘침 0`, ovEdit.mainSW <= ovEdit.mainCW && ovEdit.docSW <= ovEdit.docCW && ovEdit.elems === 0, JSON.stringify(ovEdit))
    await rowOf(page, '学生').getByRole('button', { name: '바꾸기', exact: true }).tap()
    await sleep(350)
    const stillOpen = await editorInputs(page, '学生').count()
    if (stillOpen) {
      note(`${tag} 뜻 100자는 [바꾸기]가 막음(편집기 그대로 열림 — 글자 수 한도 검사). 한도 안 40자로 다시 시도`)
      await editorInputs(page, '学生').nth(2).fill('나'.repeat(40))
      await rowOf(page, '学生').getByRole('button', { name: '바꾸기', exact: true }).tap()
      await sleep(350)
    }
    await page.locator('#tp-description').fill('다'.repeat(100))
    await page.locator('#tp-title').fill('라'.repeat(20))
    await page.locator('#tp-titleJa').fill('あ'.repeat(20))
    const ovLong = await longOverflow(page)
    check(`${tag} 긴 글(제목 20·일본어 이름 20·설명 100·뜻 긴 값) 적용 뒤: main·문서 가로 넘침 0`, ovLong.mainSW <= ovLong.mainCW && ovLong.docSW <= ovLong.docCW && ovLong.elems === 0, JSON.stringify(ovLong))
    const pageV = await page.evaluate(() => ({ docScrollH: document.documentElement.scrollHeight, innerH: window.innerHeight }))
    check(`${tag} 페이지 레벨 세로 스크롤 0(문서 높이 ≤ 창 높이)`, pageV.docScrollH <= pageV.innerH + 1, JSON.stringify(pageV))

    // ── 입력 오류 접근성(aria-invalid·describedby·카운터) — 제목 비우고 저장
    await page.locator('#tp-title').fill('')
    await tapEl(page, saveBtn(page))
    await sleep(500)
    const inv = await page.evaluate(() => {
      const el = document.getElementById('tp-title')
      const d = (el?.getAttribute('aria-describedby') ?? '').split(' ')
      return { invalid: el?.getAttribute('aria-invalid'), d, allExist: d.every((i) => !!document.getElementById(i)), err: document.getElementById('tp-title-err')?.textContent?.trim() ?? null, count: document.getElementById('tp-title-count')?.textContent?.trim(), focused: document.activeElement === el }
    })
    check(`${tag} 제목 비우고 저장: aria-invalid=true·describedby(카운터+오류) 실제 존재·카운터 0/20·초점 그 칸`, inv.invalid === 'true' && inv.allExist && inv.d.length === 2 && inv.count === '0/20' && !!inv.err && inv.focused, JSON.stringify(inv))
    const over = '마'.repeat(21)
    await page.locator('#tp-title').fill(over)
    const ov21 = await page.evaluate(() => ({ invalid: document.getElementById('tp-title')?.getAttribute('aria-invalid'), count: document.getElementById('tp-title-count')?.textContent?.trim() }))
    check(`${tag} 제목 21자: 카운터 21/20·aria-invalid=true`, ov21.count === '21/20' && ov21.invalid === 'true', JSON.stringify(ov21))

    // ── XSS 문자열 저장 → 텍스트로만
    const XT = '<img src=x onerror=>'
    await page.locator('#tp-title').fill(XT)
    await page.locator('#tp-description').fill('<script>window.__x=1</script>')
    const x0 = P.reqs.length
    await tapEl(page, saveBtn(page))
    await sleep(1500)
    const xs = await page.evaluate(() => ({ imgs: document.querySelectorAll('main img, header img').length, scripts: document.querySelectorAll('main script, header script').length, flag: window.__x ?? null, path: location.pathname }))
    const xsReq = P.reqs.slice(x0).filter((r) => r.m !== 'GET')
    const xText = await bodyText(page)
    note(`${tag} XSS 저장 결과: 요청=${xsReq.map((r) => r.m + ' ' + r.status).join(',') || '없음'} path=${xs.path} 문구=${xText.includes('고칠 곳') ? '입력 검사가 막음' : '저장됨'}`)
    check(`${tag} XSS 문자열(이름 <img…>·설명 <script…>): img/script 요소 0·실행 흔적 없음`, xs.imgs === 0 && xs.scripts === 0 && xs.flag === null, JSON.stringify(xs))
    if (xsReq.length === 1 && xsReq[0].status === 200) {
      await page.waitForURL((x) => x.pathname === viewPath(F.id), { timeout: 10000 })
      await sleep(500)
      const h2 = await page.evaluate(() => document.querySelector('main h2')?.textContent)
      check(`${tag} XSS 저장됨 → S6 머리 제목에 문자 그대로(텍스트)`, h2 === XT, String(h2))
    }
    texts.push(await bodyText(page))

    // ── 엔진명·모델명·AI 0
    const hits = texts.filter((t) => ENGINE.test(t))
    check(`${tag} 화면 텍스트(기본·묻기·받는 중·실패·메뉴·편집기·결과) 엔진·모델명·「AI」 0건`, hits.length === 0, hits.map((t) => (ENGINE.exec(t) ?? [''])[0]).join(','))

    // ── 404: 없는 id·지운 id·남의 id
    const NF = '이 주제를 찾을 수 없어요'
    const probe = async (id, label) => {
      const q = await openPage(browser, w, h, cookie)
      pages.push(q)
      await q.page.goto(`${BASE}/settings/scenarios/topics/${id}/edit`, { waitUntil: 'domcontentloaded' })
      await q.page.waitForFunction((t) => document.body.innerText.includes(t), NF, { timeout: 15000 }).catch(() => {})
      const t = await bodyText(q.page)
      const btn = await q.page.getByRole('link', { name: '내 상황·주제로' }).count()
      check(`${tag} 404 화면(${label}): 「${NF}」·[내 상황·주제로]·입력칸 0`, t.includes(NF) && btn >= 1 && (await q.page.locator('#tp-title').count()) === 0, t.slice(0, 80))
    }
    await probe('cnonexistent00000000000000', '없는 id')
    const tmp = await mkTopic10(cookie, `QA 지움 ${w}`, 'N5')
    await prisma.conversationTopic.deleteMany({ where: { id: tmp.id, userId: u.id } })
    await probe(tmp.id, '지운 id')
    const other = await prisma.conversationTopic.findFirst({ where: { userId: { not: null, notIn: [u.id] }, isSeed: false }, select: { id: true } })
    if (other) await probe(other.id, '남의 주제 id')
    else note(`${tag} 남의 주제 id: 지금 DB 에 다른 사용자의 비시드 주제 행이 없어 NOT_VERIFIED(다른 QA 계정 행을 만들지 않는다는 레인 규칙)`)
    await prisma.conversationTopic.deleteMany({ where: { id: F.id, userId: u.id } })
  } catch (e) {
    check(`${tag} 시나리오 예외 없음`, false, String(e).slice(0, 400))
  } finally {
    for (const p of pages) {
      check(`${tag} 페이지 오류 0`, p.errors.length === 0, p.errors.join(' / ').slice(0, 200))
      await p.ctx.close().catch(() => {})
    }
    note(`${tag} 정리 ${JSON.stringify(await cleanupQa(u.id))}`)
  }
}

await closeBrowser(browser)
const seed1 = await seedHash()
check('시드 해시 불변', seed1.sha === seed0.sha && seed1.sha === 'e826f3ef09237a9c', `${seed0.sha} → ${seed1.sha}`)
const left = await qaRowCounts(u.id)
check('QA1 task-045 행 0(정리)', left.topics + left.overrides + left.scenarios + left.challenges === 0, JSON.stringify(left))
summary('item4')
await prisma.$disconnect()
