/**
 * qa-045-ui-d2 항목 4 — (1) 수준 칩·종류 라디오 44px 히트 영역을 **실제 touchscreen.tap** 으로 측정(이전 d/item4 의 판정식 `top-5px` 가
 * 36px 칩의 ::before 확장(위아래 4px)보다 바깥이라 오판했는지) (2) 공백 없는 100자 한글(설명·표현 뜻)·20자 제목 가로 넘침을 S6·S7 에서 재실행(HEAD 237d721 — ui-a-fix [overflow-wrap:anywhere] 반영).
 * LLM 호출 0. QA1 행만 만들고 끝에 전부 지운다.
 * 실행: cd $HOME/.node-local/thekaiwa-qa045ui-d2 && QA_BASE=http://127.0.0.1:3058 QA_SNAPSHOT=$PWD QA_COOKIE=<쿠키 파일> node --env-file=.env <이 파일>
 */
import {
  api, BASE, check, cleanupQa, closeBrowser, cookieOf, data, docScrollMetrics, j, launch, menuAction, mkTopic10, note, openEdit, openPage, overflowInfo, prisma, qaRowCounts, qaUser, QA1,
  editorInputs, rowOf, seedHash, sleep, summary, WIDTHS,
} from '../d/h.mjs'

const cookie = cookieOf(process.env.QA_COOKIE)
const u = await qaUser(QA1)
const seed0 = await seedHash()
note(`시작 QA1 task-045 행 ${j(await qaRowCounts(u.id))} · 시드 ${seed0.sha}`)
const browser = await launch()

/** 요소를 화면 가운데로 스크롤한 뒤 가장자리 바깥 off(px) 점이 이 요소(또는 후손·의사 요소)를 가리키는지. */
async function hitAt(loc, side, off) {
  await loc.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await sleep(120)
  return loc.evaluate((el, a) => {
    const r = el.getBoundingClientRect()
    const y = a.side === 'top' ? r.top - a.off : r.bottom + a.off
    const hit = document.elementFromPoint(r.left + r.width / 2, y)
    return !!hit && (hit === el || el.contains(hit))
  }, { side, off })
}
const boxOf = async (loc) => loc.evaluate((el) => { const r = el.getBoundingClientRect(); return { h: Math.round(r.height * 10) / 10, w: Math.round(r.width), cs: getComputedStyle(el, '::before').height } })
/** 실제 손가락 탭 — 가장자리 바깥 off(px) 점. */
async function tapEdge(page, loc, side, off) {
  await loc.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await sleep(150)
  const p = await loc.evaluate((el, a) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: a.side === 'top' ? r.top - a.off : r.bottom + a.off } }, { side, off })
  await page.touchscreen.tap(p.x, p.y)
  await sleep(250)
}
const checked = (loc) => loc.getAttribute('aria-checked')
const levelGroup = (page) => page.getByRole('radiogroup', { name: '수준' })

/** 한 그룹의 라디오 전부 — 높이·::before 높이·±(ext-0.5)px 안쪽 히트·±5px(이전 시험 판정식) 히트·±(ext+1)px 바깥 히트. */
async function probeGroup(page, tag, label, group) {
  const radios = group.getByRole('radio')
  const n = await radios.count()
  const rows = []
  for (let i = 0; i < n; i++) {
    const r = radios.nth(i)
    const b = await boxOf(r)
    const ext = (44 - b.h) / 2
    const inside = ext - 0.5
    const outside = ext + 1
    rows.push({
      t: ((await r.textContent()) ?? '').trim().slice(0, 8), h: b.h, before: b.cs, ext,
      topIn: await hitAt(r, 'top', inside), botIn: await hitAt(r, 'bottom', inside), top5: await hitAt(r, 'top', 5), topOut: await hitAt(r, 'top', outside), botOut: await hitAt(r, 'bottom', outside),
    })
  }
  note(`${tag} ${label} 라디오 ${n}개: ${j(rows.map((x) => `${x.t}:h${x.h}:before${x.before}:ext${x.ext}:안쪽(상/하)=${x.topIn}/${x.botIn}:이전판정식(-5)=${x.top5}:바깥(상/하)=${x.topOut}/${x.botOut}`))}`)
  check(`${tag} ${label}: 칩 ${n}개 모두 위·아래 가장자리 안쪽(보이는 높이 밖, 44px 이내) 점이 칩을 가리킴(실효 눌림 44px)`, n >= 2 && rows.every((x) => x.topIn && x.botIn && Math.abs(x.h + 2 * x.ext - 44) < 0.6), j(rows.map((x) => `${x.t}:${x.h}+${x.ext * 2}`)))
  return rows
}

async function mkLongTopic(title) {
  const intro = (data(await api(cookie, 'GET', '/api/v1/topics?level=all'))?.items ?? []).find((t) => t.isSeed && t.title === '자기소개')
  const L100 = '가나다라마바사아자차'.repeat(3) // 서버 한도: 표현 뜻 ≤30자(MEANING_CHARS) — 100자는 저장 불가라 저장 가능한 최대 30자 공백 없음
  const chunks = intro.chunks.slice(0, 8).map((x, i) => ({ chunkType: x.chunkType, textJa: x.textJa, reading: x.reading, meaningKo: L100.slice(0, 29) + '가나다라마바사아'[i] })) // 같은 뜻 중복은 서버가 막으므로 끝 1글자만 다르게
  let r = await api(cookie, 'POST', '/api/v1/topics', { title, titleJa: 'あ'.repeat(20), level: 'N5', description: '다'.repeat(100), chunks })
  if (r.status === 429) {
    await sleep(62000)
    r = await api(cookie, 'POST', '/api/v1/topics', { title, titleJa: 'あ'.repeat(20), level: 'N5', description: '다'.repeat(100), chunks })
  }
  if (r.status !== 201) note('mkLongTopic FAIL ' + r.status + ' ' + j(r.body).slice(0, 250))
  return data(r)?.topic?.id
}

/** main·문서 가로 넘침 + 긴 글 요소의 오른쪽 끝(≤ 문서 폭). */
async function overflowMetrics(page, needle) {
  const m = await page.evaluate((needle) => {
    const main = document.querySelector('main')
    const cw = document.documentElement.clientWidth
    const els = [...document.querySelectorAll('main p, main span, main li, main textarea, main input')].filter((e) => (e.textContent ?? '').includes(needle) || ((e.value ?? '').includes?.(needle)))
    // 가장 안쪽(후손에 같은 글이 없는) 요소만
    const leaf = els.filter((e) => ![...e.children].some((c) => (c.textContent ?? '').includes(needle)))
    return {
      mainSW: main?.scrollWidth ?? -1, mainCW: main?.clientWidth ?? -1, cw,
      longEls: leaf.length, maxRight: Math.round(Math.max(0, ...leaf.map((e) => e.getBoundingClientRect().right))),
      lines: leaf.slice(0, 3).map((e) => Math.round(e.getBoundingClientRect().height / (parseFloat(getComputedStyle(e).lineHeight) || parseFloat(getComputedStyle(e).fontSize) * 1.5))),
    }
  }, needle)
  const d = await docScrollMetrics(page)
  const ov = await overflowInfo(page, null)
  return { ...m, docSW: d.scrollWidth, docCW: d.clientWidth, elems: ov.count, items: ov.items }
}

for (const [w, h] of WIDTHS) {
  const tag = `[${w}]`
  await cleanupQa(u.id)
  const pages = []
  const mk = async () => {
    const P = await openPage(browser, w, h, cookie)
    P.page.setDefaultTimeout(10000)
    pages.push(P)
    return P
  }
  try {
    const A = await mkTopic10(cookie, `QA 히트 ${w}`, 'N5')
    const P = await mk()
    const { page } = P
    // ── ① S7 수준 칩(md, 36px) — 요소 검사
    await openEdit(page, A.id)
    const lv = await probeGroup(page, tag, 'S7 수준 칩(Segmented md)', levelGroup(page))
    check(`${tag} 이전 시험 판정식 재현: 36px 칩은 위 5px 점이 ::before(4px) 밖 → 이전 FAIL 의 원인(칩 높이 36·::before 확장 4px)`, lv.every((x) => x.h === 36 && x.ext === 4 && x.top5 === false && x.topOut === false), j(lv.map((x) => `${x.t}:top5=${x.top5}`)))
    // ── 실제 탭: 수준 칩 위쪽 끝(보이는 36px 밖 3.5px) → 선택이 바뀌는가
    await openEdit(page, A.id)
    const n4 = levelGroup(page).getByRole('radio', { name: 'N4', exact: true })
    await tapEdge(page, n4, 'top', 3.5)
    check(`${tag} 실제 touchscreen.tap: N4 칩 보이는 윗변 바깥 3.5px 점 → N4 선택됨(눌림 44px 실효)`, (await checked(n4)) === 'true', `aria-checked=${await checked(n4)}`)
    await openEdit(page, A.id)
    const n3 = levelGroup(page).getByRole('radio', { name: 'N3', exact: true })
    await tapEdge(page, n3, 'bottom', 3.5)
    check(`${tag} 실제 touchscreen.tap: N3 칩 보이는 아랫변 바깥 3.5px 점 → N3 선택됨`, (await checked(n3)) === 'true', `aria-checked=${await checked(n3)}`)
    await openEdit(page, A.id)
    const n4b = levelGroup(page).getByRole('radio', { name: 'N4', exact: true })
    await tapEdge(page, n4b, 'top', 5)
    note(`${tag} (참고·판정 아님) N4 칩 윗변 바깥 5px(= 44px ::before 밖 1px, elementFromPoint 는 false) 실탭 → aria-checked=${await checked(n4b)} — 모바일 Chrome 의 터치 보정(touch adjustment)이 가까운 누를 곳으로 끌어가므로 실탭은 정확한 경계 증거가 못 됨. 경계는 elementFromPoint 로 판정`)
    // ── 종류 라디오(sm, 32px) — 행 편집기
    await openEdit(page, A.id)
    await menuAction(page, '学生', '고치기')
    const grp = rowOf(page, '学生').getByRole('radiogroup')
    const ty = await probeGroup(page, tag, 'S7 행 편집기 종류 라디오(Segmented sm)', grp)
    check(`${tag} 이전 시험 판정식(-5px)이 32px 칩(::before 6px)은 통과 → 이전 FAIL 7개 중 실패는 수준 칩 3개뿐`, ty.length === 4 && ty.every((x) => x.h === 32 && x.top5 === true), j(ty.map((x) => `${x.t}:top5=${x.top5}`)))
    const radios = grp.getByRole('radio')
    let idx = -1
    for (let i = 0; i < (await radios.count()); i++) if ((await checked(radios.nth(i))) === 'false') { idx = i; break }
    const tgt = radios.nth(idx)
    await tapEdge(page, tgt, 'top', 5.5)
    check(`${tag} 실제 touchscreen.tap: 종류 칩(32px) 윗변 바깥 5.5px 점 → 선택됨`, (await checked(tgt)) === 'true', `idx=${idx} aria-checked=${await checked(tgt)}`)
    // ── S3 같은 Segmented 비교
    await page.goto(`${BASE}/settings/scenarios/topics/new`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[role=radiogroup]', { timeout: 20000 })
    await sleep(300)
    const s3 = await probeGroup(page, tag, 'S3 TopicAskForm 수준 칩(Segmented md)', page.getByRole('radiogroup').first())
    note(`${tag} S3 칩 이전 시험 판정식(-5px) 결과 ${j(s3.map((x) => `${x.t}:${x.top5}`))} — S7 과 같은 부품이라 같은 값이어야 함`)
    check(`${tag} S3·S7 같은 Segmented md(h36·::before 44px) — 두 화면 모두 칩 높이 36, 실효 눌림 44`, s3.every((x) => x.h === 36) && lv.every((x) => x.h === 36) && s3.every((x) => x.top5 === lv[0].top5), `S3 top5=${j(s3.map((x) => x.top5))} S7 top5=${j(lv.map((x) => x.top5))}`)

    // ── ② 긴 한글(공백 없는 100자) 가로 넘침 S6·S7 (HEAD 237d721)
    const LID = await mkLongTopic(`${'가'.repeat(20)}`)
    check(`${tag} 긴 글 주제 준비(제목 20자·일본어 이름 20자·설명 100자·표현 8개 뜻 30자 공백 없음=서버 최대)`, !!LID)
    if (LID) {
      const V = await mk()
      await V.page.goto(`${BASE}/settings/scenarios/topics/${LID}`, { waitUntil: 'domcontentloaded' })
      await V.page.waitForFunction((t) => document.body.innerText.includes(t), '가나다라마바사아자차', { timeout: 20000 }).catch(() => {})
      await sleep(400)
      const m6 = await overflowMetrics(V.page, '가나다라마바사아자차')
      note(`${tag} S6 측정 ${j(m6)}`)
      check(`${tag} S6 주제 보기: 공백 없는 100자 뜻(${m6.longEls}개, 30자=저장 최대)·설명 100자 → main·문서 가로 넘침 0·긴 글 오른쪽 끝 ≤ 폭(${m6.maxRight}≤${m6.cw})`, m6.longEls >= 1 && m6.mainSW <= m6.mainCW && m6.docSW <= m6.docCW && m6.elems === 0 && m6.maxRight <= m6.cw, j(m6).slice(0, 300))
      const d6 = await overflowMetrics(V.page, '다다다다다다다다다다')
      check(`${tag} S6 설명 100자('다'×100): 문서 가로 넘침 0·오른쪽 끝 ≤ 폭·여러 줄로 꺾임(줄 수 ${j(d6.lines)})`, d6.longEls >= 1 && d6.docSW <= d6.docCW && d6.maxRight <= d6.cw && d6.lines.every((n) => n >= 2), j(d6).slice(0, 300))
      const E = await mk()
      await openEdit(E.page, LID)
      await sleep(300)
      const m7 = await overflowMetrics(E.page, '가나다라마바사아자차')
      note(`${tag} S7 측정(표현 목록의 뜻) ${j(m7)}`)
      check(`${tag} S7 주제 고치기: 표현 목록 뜻 30자(${m7.longEls}개)·이름·설명 입력 → main·문서 가로 넘침 0·오른쪽 끝 ≤ 폭`, m7.mainSW <= m7.mainCW && m7.docSW <= m7.docCW && m7.elems === 0 && m7.maxRight <= m7.cw, j(m7).slice(0, 300))
      // 입력칸에 공백 없는 100자 한글을 직접 넣는 경우(저장은 한도가 막음 — 입력 중 화면)
      const first = (await E.page.locator('section[aria-labelledby=tp-chunks-h] li p[lang=ja]').first().innerText()).trim()
      await menuAction(E.page, first, '고치기')
      await editorInputs(E.page, first).nth(2).fill('가'.repeat(100))
      await E.page.locator('#tp-description').fill('다'.repeat(100))
      await sleep(250)
      const m7t = await overflowMetrics(E.page, '가가가가가가가가가가')
      check(`${tag} S7 입력 중 공백 없는 100자(뜻 입력칸·설명 입력칸): main·문서 가로 넘침 0`, m7t.mainSW <= m7t.mainCW && m7t.docSW <= m7t.docCW && m7t.elems === 0, j(m7t).slice(0, 300))
    }
  } catch (e) {
    check(`${tag} 시나리오 예외 없음`, false, String(e).slice(0, 300))
  } finally {
    for (const p of pages) {
      check(`${tag} 페이지 오류 0`, p.errors.length === 0, p.errors.join(' / ').slice(0, 200))
      await p.ctx.close().catch(() => {})
    }
    note(`${tag} 정리 ${j(await cleanupQa(u.id))}`)
  }
}

await closeBrowser(browser)
const seed1 = await seedHash()
check('시드 해시 불변', seed1.sha === seed0.sha && seed1.sha === 'e826f3ef09237a9c', `${seed0.sha} → ${seed1.sha}`)
const left = await qaRowCounts(u.id)
check('QA1 task-045 행 0(정리)', left.topics + left.overrides + left.scenarios + left.challenges === 0, j(left))
summary('d2-item4')
await prisma.$disconnect()
