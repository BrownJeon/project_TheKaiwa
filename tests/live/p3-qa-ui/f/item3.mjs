/**
 * qa-045-ui-f 항목 3 — 긴 챌린지 제목 넘침(754dd04) + 공용 InfoBox/ErrorBox/CheckCard 회귀(overflow-wrap:anywhere 추가가 일반 문장에 영향이 없는지).
 * 회귀 방법: 같은 화면에서 `overflow-wrap:anywhere` 인 요소를 인라인 `normal` 로 바꿨다 되돌리며 상자·글 요소의 폭·높이를 비교(수정 전 값과 같은지의 대용 — 같은 DOM·같은 폭에서의 A/B).
 * QA3 DB 행(챌린지 2개)만 만들고 끝에 지운다. LLM 호출 0. 챌린지 만들기 흐름은 [다음] 까지만 탭하고 #156(만들기)은 부르지 않는다.
 * 실행: cd $Q && QA_BASE=http://127.0.0.1:3059 QA_SNAPSHOT=$Q QA_COOKIE=<c3 쿠키 파일> node --env-file=.env <이 파일>
 */
import { api, data, check, note, summary, launch, openPage, cookieOf, sleep, WIDTHS, BASE, QA3, qaUser, qaRowCounts, cleanupQa, seedHash, prisma, closeBrowser, insertChallenge, T_CAFE, T_ROAD } from '../e/lib.mjs'
import { tap } from '../e/ui.mjs'

const cookie = cookieOf(process.env.QA_COOKIE)
const SEED_SHA = 'e826f3ef09237a9c'
const LONG = '가나다라마바사아자차카타파하가나다라마바사아자차카타파하가나다라마바사아자'.slice(0, 40)
const SPACED = '가나다라마바 사아자차카타 파하가나다라 마바사아자차 카타파하가나'

/** 글 노드 단위(Range) 뷰포트 밖 + 「지금은」 문단의 글 right vs 박스 right */
const textOverflow = () => {
  const cw = document.documentElement.clientWidth
  const out = []
  for (const el of document.querySelectorAll('main *')) {
    if (el.closest('.sr-only')) continue
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !(n.textContent ?? '').trim()) continue
      const r = document.createRange()
      r.selectNodeContents(n)
      for (const q of r.getClientRects()) if (q.right > cw + 0.5 || q.left < -0.5) out.push({ tag: el.tagName, txt: n.textContent.trim().slice(0, 24), right: Math.round(q.right) })
    }
  }
  const p = [...document.querySelectorAll('main p')].find((e) => /지금은/.test(e.textContent))
  let now = null
  if (p) {
    const rg = document.createRange()
    rg.selectNodeContents(p)
    const rs = [...rg.getClientRects()]
    const box = p.closest('[class*="rounded"]')
    now = { pRight: Math.round(p.getBoundingClientRect().right), glyphRight: Math.round(Math.max(...rs.map((q) => q.right))), boxRight: box ? Math.round(box.getBoundingClientRect().right) : null, lines: new Set(rs.map((q) => Math.round(q.top))).size, text: p.textContent.slice(0, 30) }
  }
  const m = document.querySelector('main')
  return { out: out.slice(0, 4), n: out.length, now, mainSW: m.scrollWidth, mainCW: m.clientWidth, docSW: document.documentElement.scrollWidth }
}

/** A/B — overflow-wrap:anywhere 요소를 normal 로 바꿔 상자·요소 크기를 비교하고 되돌린다. 부모 폭 대비 상자 폭 비율도 기록. */
const abTest = () => {
  const els = [...document.querySelectorAll('main *')].filter((e) => getComputedStyle(e).overflowWrap === 'anywhere' && !e.closest('.sr-only') && (e.textContent ?? '').trim() && e.getBoundingClientRect().width > 0)
  const measure = (e) => {
    const r = e.getBoundingClientRect()
    const box = e.closest('[class*="rounded"]') ?? e
    const br = box.getBoundingClientRect()
    const bp = box.parentElement
    const ps = getComputedStyle(bp)
    const pw = bp.clientWidth - parseFloat(ps.paddingLeft) - parseFloat(ps.paddingRight)
    return { w: r.width, h: r.height, bw: br.width, bh: br.height, ratio: pw > 0 ? br.width / pw : null, pd: ps.display, lines: Math.round(r.height / (parseFloat(getComputedStyle(e).lineHeight) || 1)) }
  }
  const A = els.map(measure)
  els.forEach((e) => { e.style.overflowWrap = 'normal' })
  void document.body.offsetHeight
  const B = els.map(measure)
  els.forEach((e) => { e.style.overflowWrap = '' })
  const rows = els.map((e, i) => ({ t: e.textContent.trim().slice(0, 16), dw: Math.abs(A[i].w - B[i].w), dh: Math.abs(A[i].h - B[i].h), dbw: Math.abs(A[i].bw - B[i].bw), dbh: Math.abs(A[i].bh - B[i].bh), ratio: A[i].ratio, pd: A[i].pd, w: Math.round(A[i].w), h: Math.round(A[i].h) }))
  const mx = (k) => Math.round(Math.max(0, ...rows.map((r) => r[k])) * 100) / 100
  const ratios = rows.map((r) => r.ratio).filter((x) => x !== null)
  return { n: rows.length, dw: mx('dw'), dh: mx('dh'), dbw: mx('dbw'), dbh: mx('dbh'), minRatio: ratios.length ? Math.round(Math.min(...ratios) * 1000) / 1000 : null, flexParents: rows.filter((r) => /flex/.test(r.pd)).length, sample: rows.slice(0, 3) }
}

async function main() {
  const u = await qaUser(QA3)
  await cleanupQa(u.id) // 시작 전 QA3 행 0 보장(이전 QA 잔여가 있으면 지움 — QA 계정만)
  const h0 = await seedHash()
  const c0 = await qaRowCounts(u.id)
  check('시작: 시드 해시 = e826f3ef09237a9c', h0.sha === SEED_SHA, h0.sha)
  check('시작: QA3 행 0', Object.values(c0).every((n) => n === 0), JSON.stringify(c0))
  const seedTopic = (data(await api(cookie, 'GET', '/api/v1/topics?level=all'))?.items ?? []).find((t) => t.isSeed && t.title === '자기소개')
  const browser = await launch()
  try {
    // ───── B1: 챌린지 만들기 흐름(활성 챌린지 0) — InfoBox·CheckCard A/B ─────
    for (const [W, H] of WIDTHS) {
      const { ctx, page } = await openPage(browser, W, H, cookie)
      page.setDefaultTimeout(40000)
      const res = {}
      await page.goto(`${BASE}/plan/challenge/new`, { waitUntil: 'domcontentloaded', timeout: 90000 })
      await page.waitForSelector('main input[type=radio], main [role=radio]', { timeout: 60000 }).catch(() => {})
      await sleep(600)
      res.step1 = await page.evaluate(abTest)
      const radio = page.locator('main label:has(input[type=radio]), main [role=radio]').first()
      await tap(page, radio)
      for (const step of [2, 3, 4]) {
        await tap(page, page.locator('main button', { hasText: /^다음$/ }).first())
        await sleep(700)
        res['step' + step] = await page.evaluate(abTest)
        res['step' + step].url = page.url().replace(BASE, '')
      }
      note(`[${W}] 챌린지 만들기 A/B: ${JSON.stringify(Object.fromEntries(Object.entries(res).map(([k, v]) => [k, { n: v.n, dw: v.dw, dh: v.dh, dbw: v.dbw, dbh: v.dbh, minRatio: v.minRatio, flex: v.flexParents, url: v.url }])))}`)
      const all = Object.values(res)
      check(`[${W}] 챌린지 만들기 4단계: overflow-wrap anywhere 요소 수(검사 대상)>0 — step3 CheckCard 포함`, all.reduce((a, v) => a + v.n, 0) > 0 && res.step3.n > 0, `n=${all.map((v) => v.n).join('/')} step3 url=${res.step3.url}`)
      check(`[${W}] 챌린지 만들기: anywhere ↔ normal 요소·상자 폭·높이 차 0 (일반 문장 회귀 없음)`, all.every((v) => v.dw <= 0.5 && v.dh <= 0.5 && v.dbw <= 0.5 && v.dbh <= 0.5), JSON.stringify(all.map((v) => [v.dw, v.dh, v.dbw, v.dbh])))
      check(`[${W}] 챌린지 만들기: 상자 폭 / 부모 폭 비율 ≥0.99(flex 부모 안에서 줄지 않음)`, all.every((v) => v.minRatio === null || v.minRatio >= 0.99), `min=${all.map((v) => v.minRatio).join('/')} flexParents=${all.map((v) => v.flexParents).join('/')}`)
      await ctx.close()
    }

    // ───── B2: S6 InfoBox(「기본 주제예요」)·S2 오류 상자 A/B ─────
    for (const [W, H] of WIDTHS) {
      const { ctx, page } = await openPage(browser, W, H, cookie)
      page.setDefaultTimeout(40000)
      await page.goto(`${BASE}/settings/scenarios/topics/${seedTopic.id}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
      await page.getByText('기본 주제예요').first().waitFor({ timeout: 40000 }).catch(() => {})
      await sleep(500)
      const s6 = await page.evaluate(abTest)
      const info = await page.evaluate(() => { const e = [...document.querySelectorAll('main *')].find((x) => x.children.length === 0 && /기본 주제예요/.test(x.textContent)); const box = e?.closest('[class*="rounded"]'); const r = box?.getBoundingClientRect(); const pp = box?.parentElement; return r ? { w: Math.round(r.width), h: Math.round(r.height), parentW: pp.clientWidth, text: e.textContent.trim().slice(0, 30) } : null })
      note(`[${W}] S6 InfoBox 「기본 주제예요」 박스 ${JSON.stringify(info)} A/B ${JSON.stringify({ n: s6.n, dw: s6.dw, dh: s6.dh, dbw: s6.dbw, dbh: s6.dbh, minRatio: s6.minRatio })}`)
      check(`[${W}] S6 「기본 주제예요」 InfoBox: anywhere ↔ normal 차 0·박스 폭 = 부모 폭(비율 ≥0.99)`, !!info && s6.n > 0 && s6.dw <= 0.5 && s6.dh <= 0.5 && s6.dbw <= 0.5 && s6.dbh <= 0.5 && s6.minRatio >= 0.99, JSON.stringify({ info, s6: { n: s6.n, dw: s6.dw, dh: s6.dh, dbw: s6.dbw, dbh: s6.dbh, minRatio: s6.minRatio } }))
      await page.close()
      // S2 오류 상자(#56 abort)
      const p2 = await ctx.newPage()
      p2.setDefaultTimeout(40000)
      await p2.route((x) => x.pathname === '/api/v1/topics', (r) => r.abort())
      await p2.goto(`${BASE}/settings/scenarios?tab=topics`, { waitUntil: 'networkidle' })
      await sleep(700)
      const er = await p2.evaluate(abTest)
      const box = await p2.evaluate(() => { const a = document.querySelector('main [role=alert]'); const r = a?.getBoundingClientRect(); const pp = a?.parentElement; return r ? { w: Math.round(r.width), h: Math.round(r.height), parentW: pp.clientWidth, text: a.textContent.slice(0, 40) } : null })
      note(`[${W}] S2 ErrorBox 박스 ${JSON.stringify(box)} A/B ${JSON.stringify({ n: er.n, dw: er.dw, dh: er.dh, dbw: er.dbw, dbh: er.dbh, minRatio: er.minRatio })}`)
      check(`[${W}] S2 오류 상자(ErrorBox): anywhere ↔ normal 차 0·박스 폭 = 부모 폭`, !!box && er.n > 0 && er.dw <= 0.5 && er.dh <= 0.5 && er.dbw <= 0.5 && er.dbh <= 0.5 && er.minRatio >= 0.99, JSON.stringify({ box, er: { n: er.n, dw: er.dw, dh: er.dh, dbw: er.dbw, dbh: er.dbh, minRatio: er.minRatio } }))
      await ctx.close()
    }

    // ───── A: 긴 챌린지 제목(QA3 챌린지 2개) ─────
    const act = await insertChallenge(u.id, { id: T_ROAD, title: '길 묻기', level: 'N5' }, 'ACTIVE', { title: LONG })
    const done = await insertChallenge(u.id, { id: T_CAFE, title: '카페 주문', level: 'N5' }, 'COMPLETED', { title: 'QA 완료 긴제목 시험' })
    for (const [W, H] of WIDTHS) {
      const { ctx, page } = await openPage(browser, W, H, cookie)
      page.setDefaultTimeout(60000)
      for (const [label, title] of [['무공백 40자', LONG], ['공백 있는 40자(대조)', SPACED]]) {
        await prisma.challenge.update({ where: { id: act.id }, data: { title } })
        for (const [name, path] of [['완료 결과 화면(「지금은 「…」」 문단)', `/plan/challenge/${done.id}`], ['진행 중 챌린지 화면', `/plan/challenge/${act.id}`], ['계획표', '/plan'], ['챌린지 기록 목록', '/plan/challenges']]) {
          await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 90000 })
          await page.locator('main').getByText(title.slice(0, 6)).first().waitFor({ state: 'visible', timeout: 40000 }).catch(() => {})
          await sleep(700)
          const o = await page.evaluate(textOverflow)
          const hasText = await page.locator('main').getByText(title.slice(0, 6)).count()
          note(`[${W}] ${label} · ${name}: 제목 표시 ${hasText}곳 · 글자 밖 ${o.n}건 ${JSON.stringify(o.out.slice(0, 2))} · main ${o.mainSW}/${o.mainCW} doc ${o.docSW} · 지금은 문단 ${JSON.stringify(o.now)}`)
          check(`[${W}] ${label} · ${name}: main.scrollWidth ≤ clientWidth(이전 499)·글자 right ≤ 뷰포트`, o.mainSW <= o.mainCW && o.docSW <= W && o.n === 0, `main ${o.mainSW}/${o.mainCW} 글자 밖 ${o.n}`)
          if (o.now) check(`[${W}] ${label} · ${name}: 「지금은」 글자 right ≤ 박스 right(이전 499 vs 330/360/382)`, o.now.glyphRight <= (o.now.boxRight ?? o.now.pRight) + 0.5, JSON.stringify(o.now))
          if (name.startsWith('완료') ) check(`[${W}] ${label} · ${name}: 「지금은 「…」」 문단이 화면에 있음(시험 조건 성립)`, !!o.now && o.now.text.includes('지금은'), JSON.stringify(o.now))
        }
      }
      await ctx.close()
    }
  } finally {
    await closeBrowser(browser)
    const cf = await cleanupQa(u.id)
    const c1 = await qaRowCounts(u.id)
    const h1 = await seedHash()
    note(`정리 ${JSON.stringify(cf)} → QA3 행 ${JSON.stringify(c1)}`)
    check('종료: QA3 행 0(task-045 행·챌린지 행)', Object.values(c1).every((n) => n === 0), JSON.stringify(c1))
    check(`종료: 시드 해시 불변 ${h1.sha}`, h1.sha === SEED_SHA, `${h0.sha} → ${h1.sha}`)
  }
}

main()
  .catch(async (e) => {
    console.log('FATAL', e?.stack ?? e)
    try { await cleanupQa((await qaUser(QA3)).id) } catch {}
  })
  .finally(async () => {
    summary('qa-045-ui-f item3')
    await prisma.$disconnect()
    process.exit(0)
  })
