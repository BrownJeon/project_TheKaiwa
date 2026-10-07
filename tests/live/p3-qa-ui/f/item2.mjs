/**
 * qa-045-ui-f 항목 2 — 변형 화면 버튼 안 밀림 재측정(HEAD 30a9a94, 754dd04·30a9a94 수정). LLM 호출 0(#177 은 page.route 모의), DB 쓰기는 QA3 행만(이 스크립트는 쓰기 없음 — 저장도 막힘까지만).
 * 실행: cd $Q && QA_BASE=http://127.0.0.1:3059 QA_SNAPSHOT=$Q QA_COOKIE=<c3 쿠키 파일> node --env-file=.env <이 파일>   (세 폭 모두 한 번에)
 * 재사용: ../e/lib.mjs · ../e/ui.mjs (e3/item3.mjs 의 선택자·모의 방식)
 */
import { check, note, summary, launch, openPage, cookieOf, sleep, WIDTHS, BASE, SEED_SC, QA3, qaUser, qaRowCounts, cleanupQa, seedHash, prisma, closeBrowser } from '../e/lib.mjs'
import { env, errEnv, draftFromSeed, mockPost, tap, dbl, pageText } from '../e/ui.mjs'

const cookie = cookieOf(process.env.QA_COOKIE)
const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean)
const run = (k) => ONLY.length === 0 || ONLY.includes(k)
const WONLY = process.env.WIDX === undefined ? WIDTHS : [WIDTHS[Number(process.env.WIDX)]]
const SEED_SHA = 'e826f3ef09237a9c'
const DRAFTS = '**/api/v1/scenarios/*/variants/drafts'
const LV = ['N5', 'N4', 'N3', 'N2', 'N1']
const up = (l) => LV[Math.min(4, LV.indexOf(l) + 1)]
const SUBMIT = '변형 초안 만들기'
const GENTXT = '선생님이 변형 상황 초안을 만들고 있어요'

const btnByText = (page, t) => page.locator('button', { hasText: t }).first()
const chip = (page, axis, v) => page.locator(`label:has(input[name="va-${axis}"][value="${v}"])`).first()
const innerSel = 'div.relative.min-h-0.flex-1.overflow-y-auto'
async function goto(page, path) { await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 90000 }) }
async function waitPick(page) { await page.getByText('무엇을 바꿔 볼까요?').first().waitFor({ timeout: 90000 }); await sleep(300) }
const mark = (page, loc, id) => loc.evaluate((e, id) => e.setAttribute('data-qa', id), id)
const snap = (page, ids) =>
  page.evaluate(([ids, innerSel]) => {
    const rd = (n) => Math.round(n * 10) / 10
    const r = (id) => { const e = document.querySelector(`[data-qa="${id}"]`); if (!e) return null; const b = e.getBoundingClientRect(); return { top: rd(b.top), h: rd(b.height), bottom: rd(b.bottom), text: e.textContent.trim().slice(0, 14), aria: e.getAttribute('aria-disabled') } }
    const st = [...document.querySelectorAll('[role=status]')].find((e) => e.textContent.includes('변형 상황 초안'))
    const sb = st ? st.getBoundingClientRect() : null
    const alerts = [...document.querySelectorAll('main [role=alert]')].map((e) => { const b = e.getBoundingClientRect(); return { text: e.textContent.trim().slice(0, 24), top: rd(b.top), bottom: rd(b.bottom) } })
    const i = document.querySelector(innerSel)
    return { els: Object.fromEntries(ids.map((id) => [id, r(id)])), status: sb ? { top: rd(sb.top), bottom: rd(sb.bottom), long: st.textContent.includes('조금 더 걸리고 있어요') } : null, alerts, inner: i ? rd(i.scrollTop) : -1, main: document.querySelector('main').scrollTop, ih: innerHeight }
  }, [ids, innerSel])
const tops = (page) =>
  page.evaluate((innerSel) => {
    const i = document.querySelector(innerSel)
    const m = document.querySelector('main')
    return { main: m ? m.scrollTop : -1, inner: i ? Math.round(i.scrollTop * 10) / 10 : -1, headerTop: Math.round((document.querySelector('header')?.getBoundingClientRect().top ?? -99) * 10) / 10 }
  }, innerSel)
const active = (page) => page.evaluate(() => ({ tag: document.activeElement?.tagName, id: document.activeElement?.id }))

function mkMock(base, extra = {}) {
  const d = structuredClone(base.draft)
  d.title = `${base.detail.title} · QA3F`
  d.roles = { learner: d.roles.learner, tutor: d.roles.tutor + '2' }
  d.steps = [...d.steps, { ko: '바쁜 점원이 빠르게 되묻는다' }]
  d.level = up(base.detail.level)
  return { draft: d, changedFields: ['title', 'roles', 'steps', 'level'], axes: { persona: 'busy', twist: 'unavailable', flow: 'suggest', level: 'up' }, ...extra }
}
const overlapJs = () =>
  [...document.querySelectorAll('span.sr-only')]
    .filter((s) => (s.textContent ?? '').trim() === '원본에서 바뀌었어요')
    .map((sr) => { const wrap = sr.parentElement.parentElement; return { label: [...wrap.textContent.replace(sr.parentElement.textContent, '').trim().split('\n')][0].slice(0, 22) } })

/** t0 기준 ms 시각까지 대기 */
const until = async (t0, ms) => { const d = t0 + ms - Date.now(); if (d > 0) await sleep(d) }

async function main() {
  const u = await qaUser(QA3)
  const h0 = await seedHash()
  const c0 = await qaRowCounts(u.id)
  check('시작: 시드 해시 = e826f3ef09237a9c', h0.sha === SEED_SHA, h0.sha)
  check('시작: QA3 행 0', Object.values(c0).every((n) => n === 0), JSON.stringify(c0))
  const base = await draftFromSeed(cookie, SEED_SC)
  const browser = await launch()
  try {
    for (const [W, H] of WONLY) {
      const TAG = `[${W}]`
      // ───────── F1: 선택 단계 — 만드는 중(22초 지연) ─────────
      if (run('F1')) {
        const { ctx, page } = await openPage(browser, W, H, cookie)
        const st = await mockPost(page, DRAFTS, async () => ({ delay: 22000, json: env(mkMock(base)) }))
        await goto(page, `/study/ai/scenario/${SEED_SC}/variant`)
        await waitPick(page)
        await tap(page, chip(page, 'persona', 'kind'))
        const sb = btnByText(page, SUBMIT)
        await sb.scrollIntoViewIfNeeded()
        await mark(page, sb, 'b')
        const S0 = await snap(page, ['b'])
        await sleep(200)
        const t0 = Date.now()
        await tap(page, page.locator('[data-qa="b"]'), { scroll: false })
        const samples = {}
        for (const ms of [80, 450, 1200, 3000, 19000, 21000]) { await until(t0, ms); samples[ms] = await snap(page, ['b']) }
        const b0 = S0.els.b
        note(`${TAG} F1 시작 전 버튼 ${JSON.stringify(b0)} innerHeight=${S0.ih} inner=${S0.inner}`)
        for (const ms of Object.keys(samples)) { const s = samples[ms]; note(`${TAG} F1 +${ms}ms 버튼 ${JSON.stringify(s.els.b)} status=${JSON.stringify(s.status)} inner=${s.inner} main=${s.main}`) }
        const worst = Math.max(...Object.values(samples).map((s) => Math.abs((s.els.b?.top ?? 1e9) - b0.top)))
        check(`${TAG} F1 선택 단계: 시작 전·후 모든 시점 버튼 top 차 0px(이전 +88)`, worst <= 0.5, `최대 차 ${worst}px (80/450/1200/3000/19000/21000ms)`)
        check(`${TAG} F1 만드는 중 표시(role=status)가 버튼 아래`, samples[450].status && samples[450].status.top >= samples[450].els.b.bottom - 0.5 && (await pageText(page)).includes(GENTXT), JSON.stringify({ status: samples[450].status, btn: samples[450].els.b }))
        check(`${TAG} F1 같은 버튼이 [그만두기]로 바뀜(450ms: aria-disabled=true 잠금)`, samples[450].els.b.text === '그만두기' && samples[450].els.b.aria === 'true', JSON.stringify(samples[450].els.b))
        check(`${TAG} F1 800ms 이후(1200ms) [그만두기] 활성`, samples[1200].els.b.text === '그만두기' && samples[1200].els.b.aria === null, JSON.stringify(samples[1200].els.b))
        check(`${TAG} F1 20초 안내 「조금 더 걸리고 있어요」: 19s 없음·21s 추가`, samples[19000].status?.long === false && samples[21000].status?.long === true, `19s=${samples[19000].status?.long} 21s=${samples[21000].status?.long}`)
        check(`${TAG} F1 [그만두기]가 화면 안(top+height ≤ innerHeight) — 모든 시점(이전 412 에서 완전히 가려짐)`, Object.values(samples).every((s) => s.els.b.top + s.els.b.h <= s.ih + 0.5 && s.els.b.top >= 0), `bottom ${Object.values(samples).map((s) => s.els.b.bottom).join('/')} ih ${S0.ih}`)
        check(`${TAG} F1 안쪽 스크롤·main 스크롤 불변`, Object.values(samples).every((s) => s.inner === S0.inner && s.main === 0), `inner ${S0.inner}→${Object.values(samples).map((s) => s.inner).join('/')}`)
        // 취소
        await tap(page, btnByText(page, '그만두기'), { scroll: false })
        await sleep(500)
        const after = await snap(page, ['b'])
        check(`${TAG} F1 [그만두기] 탭 → 선택 화면 복귀·같은 버튼 top 불변`, after.els.b?.text === SUBMIT && Math.abs(after.els.b.top - b0.top) <= 0.5 && !after.status, JSON.stringify(after.els.b))
        check(`${TAG} F1 요청 1건`, st.calls.length === 1)
        await ctx.close()
      }

      // ───────── F2: 검토 단계 — [다시 만들기] ─────────
      if (run('F2')) {
        const { ctx, page, reqs } = await openPage(browser, W, H, cookie)
        let mode = 'first'
        const st = await mockPost(page, DRAFTS, async () => {
          if (mode === 'first') return { delay: 300, json: env(mkMock(base)) }
          if (mode === 'slow') return { delay: 22000, json: env(mkMock(base)) }
          return { delay: 700, status: 502, json: errEnv('ENGINE_ERROR', {}, 'SRV') }
        })
        await goto(page, `/study/ai/scenario/${SEED_SC}/variant`)
        await waitPick(page)
        await tap(page, chip(page, 'persona', 'busy'))
        await tap(page, chip(page, 'twist', 'unavailable'))
        await tap(page, chip(page, 'flow', 'suggest'))
        await tap(page, chip(page, 'level', 'up'))
        await tap(page, btnByText(page, SUBMIT))
        await page.waitForSelector('text=변형 초안이 왔어요', { timeout: 10000 }).catch(() => {})
        await sleep(500)
        // 「바뀜」 꼬리표 1:1 (이전 통과 샘플)
        const tags = await page.evaluate(overlapJs)
        const want = ['제목', '역할', '대화 순서', '수준']
        check(`${TAG} F2 「바뀜」 꼬리표 1:1 (제목·역할·대화 순서·수준)`, tags.length === 4 && want.every((w) => tags.some((t) => t.label.startsWith(w))), JSON.stringify(tags.map((t) => t.label)))
        // 아래로 스크롤해 [저장]·[다시 만들기] 를 화면에
        await page.evaluate((s) => { const i = document.querySelector(s); if (i) i.scrollTop = i.scrollHeight }, innerSel)
        await sleep(300)
        const saveBtn = btnByText(page, '새 상황으로 저장')
        const regenBtn = page.locator('button', { hasText: /^다시 만들기$/ }).first()
        await mark(page, saveBtn, 'save')
        await mark(page, regenBtn, 'regen')
        const R0 = await snap(page, ['save', 'regen'])
        note(`${TAG} F2 시작 전 save=${JSON.stringify(R0.els.save)} regen=${JSON.stringify(R0.els.regen)} ih=${R0.ih} inner=${R0.inner}`)
        check(`${TAG} F2 검토 단계 [저장]·[다시 만들기]가 화면 안`, R0.els.save.bottom <= R0.ih + 0.5 && R0.els.regen.bottom <= R0.ih + 0.5, `save.bottom ${R0.els.save.bottom} regen.bottom ${R0.els.regen.bottom} ih ${R0.ih}`)
        // ② 느린 재요청
        mode = 'slow'
        await sleep(100)
        const t0 = Date.now()
        await tap(page, page.locator('[data-qa="regen"]'), { scroll: false })
        const sm = {}
        for (const ms of [80, 450, 1200, 3000, 19000, 21000]) { await until(t0, ms); sm[ms] = await snap(page, ['save', 'regen']) }
        for (const ms of Object.keys(sm)) { const s = sm[ms]; note(`${TAG} F2 다시 만들기 +${ms}ms save=${JSON.stringify(s.els.save)} regen=${JSON.stringify(s.els.regen)} status=${JSON.stringify(s.status)} inner=${s.inner}`) }
        const wSave = Math.max(...Object.values(sm).map((s) => Math.abs((s.els.save?.top ?? 1e9) - R0.els.save.top)))
        const wRegen = Math.max(...Object.values(sm).map((s) => Math.abs((s.els.regen?.top ?? 1e9) - R0.els.regen.top)))
        check(`${TAG} F2 [다시 만들기] 시작: [저장] top 변화 0px (80~21000ms)`, wSave <= 0.5, `최대 ${wSave}px`)
        check(`${TAG} F2 [다시 만들기] 시작: [다시 만들기](→[그만두기]) top 변화 0px (80~21000ms)`, wRegen <= 0.5, `최대 ${wRegen}px`)
        check(`${TAG} F2 만드는 중 표시가 [다시 만들기] 아래`, sm[450].status && sm[450].status.top >= sm[450].els.regen.bottom - 0.5, JSON.stringify({ status: sm[450].status, regen: sm[450].els.regen }))
        check(`${TAG} F2 20초 안내 추가(19s 없음·21s 있음)·그때도 top 0px`, sm[19000].status?.long === false && sm[21000].status?.long === true && Math.abs(sm[21000].els.regen.top - R0.els.regen.top) <= 0.5 && Math.abs(sm[21000].els.save.top - R0.els.save.top) <= 0.5, `19s=${sm[19000].status?.long} 21s=${sm[21000].status?.long}`)
        check(`${TAG} F2 안쪽 스크롤 불변·[그만두기] 화면 안`, Object.values(sm).every((s) => s.inner === R0.inner && s.els.regen.bottom <= s.ih + 0.5), `inner ${R0.inner}→${Object.values(sm).map((s) => s.inner).join('/')}`)
        // 취소 후 → 실패 전환 시험(502)
        await sleep(100)
        await tap(page, page.locator('[data-qa="regen"]'), { scroll: false })
        await sleep(500)
        const afterC = await snap(page, ['save', 'regen'])
        check(`${TAG} F2 [그만두기] → 같은 자리 [다시 만들기] 복귀(top 불변)`, afterC.els.regen.text === '다시 만들기' && Math.abs(afterC.els.regen.top - R0.els.regen.top) <= 0.5 && Math.abs(afterC.els.save.top - R0.els.save.top) <= 0.5, JSON.stringify(afterC.els))
        mode = 'fail'
        const t1 = Date.now()
        await tap(page, page.locator('[data-qa="regen"]'), { scroll: false })
        const sf = {}
        for (const ms of [80, 450, 1500, 2500]) { await until(t1, ms); sf[ms] = await snap(page, ['save', 'regen']) }
        for (const ms of Object.keys(sf)) { const s = sf[ms]; note(`${TAG} F2 실패 전환 +${ms}ms save=${JSON.stringify(s.els.save)} regen=${JSON.stringify(s.els.regen)} status=${s.status ? 'yes' : 'no'} alerts=${JSON.stringify(s.alerts)}`) }
        const wFail = Math.max(...Object.values(sf).flatMap((s) => [Math.abs(s.els.save.top - R0.els.save.top), Math.abs(s.els.regen.top - R0.els.regen.top)]))
        check(`${TAG} F2 시작→실패 전환 때 [저장]·[다시 만들기] top 변화 0px`, wFail <= 0.5, `최대 ${wFail}px`)
        check(`${TAG} F2 실패 상자가 [다시 만들기] 아래`, sf[1500].alerts.length >= 1 && sf[1500].alerts.every((a) => a.top >= sf[1500].els.regen.bottom - 0.5), JSON.stringify({ alerts: sf[1500].alerts, regen: sf[1500].els.regen }))
        // 저장 막힘 → main.scrollTop 0·BackBar top 0 (이전 통과 샘플)
        await page.evaluate((s) => { const i = document.querySelector(s); if (i) i.scrollTop = i.scrollHeight }, innerSel)
        const preB = await tops(page)
        await page.fill('#dr-title', '')
        await tap(page, btnByText(page, '새 상황으로 저장'))
        await sleep(900)
        const postB = await tops(page)
        const actB = await active(page)
        check(`${TAG} F2 저장 막힘 → 초점 #dr-title·main.scrollTop 0·BackBar top 0`, actB.id === 'dr-title' && postB.main === 0 && postB.headerTop === 0 && preB.main === 0, JSON.stringify({ preB, postB, actB }))
        check(`${TAG} F2 저장 막힘 때 #163 요청 0`, reqs.filter((r) => r.m === 'POST' && /\/api\/v1\/scenarios$/.test(r.p)).length === 0)
        await ctx.close()
      }

      // ───────── F3: 선택 단계 재시도 — 모의 502 → 실패 상자가 버튼 아래 → 다시 탭 ─────────
      if (run('F3')) {
        const { ctx, page } = await openPage(browser, W, H, cookie)
        let mode = 'fail'
        const st = await mockPost(page, DRAFTS, async () => (mode === 'fail' ? { delay: 300, status: 502, json: errEnv('ENGINE_ERROR', {}, 'SRV') } : { delay: 3000, json: env(mkMock(base)) }))
        await goto(page, `/study/ai/scenario/${SEED_SC}/variant`)
        await waitPick(page)
        await tap(page, chip(page, 'persona', 'kind'))
        const sb = btnByText(page, SUBMIT)
        await sb.scrollIntoViewIfNeeded()
        await mark(page, sb, 'b')
        const P0 = await snap(page, ['b'])
        await tap(page, page.locator('[data-qa="b"]'), { scroll: false })
        await sleep(1200)
        const P1 = await snap(page, ['b'])
        note(`${TAG} F3 실패 뒤 버튼 ${JSON.stringify(P1.els.b)} 상자 ${JSON.stringify(P1.alerts)}`)
        check(`${TAG} F3 모의 502 → 실패 상자가 버튼 아래`, P1.alerts.length === 1 && P1.alerts[0].top >= P1.els.b.bottom - 0.5 && Math.abs(P1.els.b.top - P0.els.b.top) <= 0.5, JSON.stringify({ alerts: P1.alerts, b: P1.els.b, b0: P0.els.b }))
        mode = 'slow'
        const t0 = Date.now()
        await tap(page, page.locator('[data-qa="b"]'), { scroll: false })
        const q = {}
        for (const ms of [80, 450, 1200, 2500]) { await until(t0, ms); q[ms] = await snap(page, ['b']) }
        note(`${TAG} F3 재시도 +450 버튼 ${JSON.stringify(q[450].els.b)} alerts=${JSON.stringify(q[450].alerts)} status=${JSON.stringify(q[450].status)}`)
        const w3 = Math.max(...Object.values(q).map((s) => Math.abs(s.els.b.top - P0.els.b.top)))
        check(`${TAG} F3 다시 탭 → 실패 상자 사라져도 버튼 top 변화 0px(이전: 상자만큼 올라감)`, w3 <= 0.5 && q[450].alerts.length === 0, `최대 ${w3}px 상자 ${q[450].alerts.length}`)
        check(`${TAG} F3 재시도 중 표시가 버튼 아래·[그만두기] 화면 안`, q[450].status && q[450].status.top >= q[450].els.b.bottom - 0.5 && q[450].els.b.bottom <= q[450].ih + 0.5, JSON.stringify({ status: q[450].status, b: q[450].els.b }))
        check(`${TAG} F3 요청 2건`, st.calls.length === 2, String(st.calls.length))
        await ctx.close()
      }

      // ───────── F4: 축 위 실패(422 NOT_A_VARIANT·NO_VARIATION) holdFailure ─────────
      for (const [reason, label, expectText] of [['NOT_A_VARIANT', '422 NOT_A_VARIANT', '변형 상황을 만들기 어려워요'], ['NO_VARIATION', '422 NO_VARIATION', '바꿀 점을 하나 이상 골라']]) {
        if (!run('F4')) break
        const { ctx, page } = await openPage(browser, W, H, cookie)
        let mode = 'fail'
        const st = await mockPost(page, DRAFTS, async () => (mode === 'fail' ? { delay: 250, status: 422, json: errEnv('UNPROCESSABLE', { reason }, 'SRV') } : { delay: 3000, json: env(mkMock(base)) }))
        await goto(page, `/study/ai/scenario/${SEED_SC}/variant`)
        await waitPick(page)
        await tap(page, chip(page, 'persona', 'kind'))
        const sb = btnByText(page, SUBMIT)
        await tap(page, sb)
        await sleep(900)
        await sb.scrollIntoViewIfNeeded()
        await mark(page, sb, 'b')
        const A0 = await snap(page, ['b'])
        const boxAbove = A0.alerts.length === 1 && A0.alerts[0].bottom <= A0.els.b.top + 0.5 && A0.alerts[0].text.includes(expectText.slice(0, 8))
        check(`${TAG} F4 ${label}: 실패 상자가 축 위(버튼 위)에 뜸`, boxAbove, JSON.stringify({ alerts: A0.alerts, b: A0.els.b }))
        // 다시 만드는 동안(느린 응답) 상자 유지·버튼 top 0px
        mode = 'slow'
        const t0 = Date.now()
        await tap(page, page.locator('[data-qa="b"]'), { scroll: false })
        await until(t0, 450)
        const A1 = await snap(page, ['b'])
        await until(t0, 1200)
        const A1b = await snap(page, ['b'])
        check(`${TAG} F4 ${label}: 다시 만드는 동안 상자 유지·버튼 top 0px`, A1.alerts.length === 1 && A1b.alerts.length === 1 && Math.abs(A1.els.b.top - A0.els.b.top) <= 0.5 && Math.abs(A1b.els.b.top - A0.els.b.top) <= 0.5, JSON.stringify({ A1: A1.alerts, b1: A1.els.b.top, b1b: A1b.els.b.top, b0: A0.els.b.top }))
        // 취소 → 입력 그대로 → 상자 유지
        await tap(page, page.locator('[data-qa="b"]'), { scroll: false })
        await sleep(600)
        const A2 = await snap(page, ['b'])
        check(`${TAG} F4 ${label}: 취소 뒤(입력 그대로) 상자 유지·버튼 top 0px`, A2.els.b.text === SUBMIT && A2.alerts.length === 1 && Math.abs(A2.els.b.top - A0.els.b.top) <= 0.5, JSON.stringify({ alerts: A2.alerts, b: A2.els.b.top, b0: A0.els.b.top }))
        // 직접 적은 글을 바꿔도 해제(서명 = 축 + 글)
        await tap(page, chip(page, 'persona', 'busy'))
        await sleep(400)
        const A3 = await snap(page, ['b'])
        check(`${TAG} F4 ${label}: 축 칩을 바꾸면 상자 해제(오래된 실패를 붙잡지 않음)`, A3.alerts.length === 0, JSON.stringify(A3.alerts))
        // 다시 같은 실패를 만든 뒤 글만 바꿔도 해제되는지
        mode = 'fail'
        await tap(page, chip(page, 'persona', 'kind'))
        await tap(page, btnByText(page, SUBMIT))
        await sleep(900)
        const B0 = await snap(page, ['b'])
        await page.fill('#va-note', '손님이 바빠요')
        await sleep(300)
        const B1 = await snap(page, ['b'])
        note(`${TAG} F4 ${label}: 같은 실패 재현 후 상자 ${B0.alerts.length}개 → 글 입력 뒤 ${B1.alerts.length}개`)
        check(`${TAG} F4 ${label}: 직접 적은 글을 바꿔도 해제(서명에 글 포함)`, B0.alerts.length === 1 && B1.alerts.length === 0, `${B0.alerts.length}→${B1.alerts.length}`)
        check(`${TAG} F4 ${label}: 요청 수 = 3(실패 1 + 느린 응답 1(취소) + 재현 실패 1; 첫 실행 기대값 4 는 시험 계산 실수)`, st.calls.length === 3, String(st.calls.length))
        await ctx.close()
      }

      // ───────── F5: 더블탭 #177 1건·800ms 잠금(이전 통과 샘플) ─────────
      if (run('F5')) {
        const { ctx, page } = await openPage(browser, W, H, cookie)
        const st = await mockPost(page, DRAFTS, async () => ({ delay: 3500, json: env(mkMock(base)) }))
        await goto(page, `/study/ai/scenario/${SEED_SC}/variant`)
        await waitPick(page)
        await tap(page, chip(page, 'persona', 'busy'))
        await page.locator(`button:has-text("${SUBMIT}")`).first().scrollIntoViewIfNeeded()
        await dbl(page, `button:has-text("${SUBMIT}")`)
        await sleep(450)
        const g = await page.evaluate(() => ({ btn: [...document.querySelectorAll('button')].some((x) => x.textContent.includes('그만두기')), status: !![...document.querySelectorAll('[role=status]')].find((e) => e.textContent.includes('변형 상황 초안')) }))
        check(`${TAG} F5 더블탭 → #177 1건·만드는 중 유지(두 번째 탭이 잠긴 [그만두기]에 닿아도 취소 안 됨)`, st.calls.length === 1 && g.btn && g.status, JSON.stringify({ calls: st.calls.length, g }))
        await ctx.close()
      }
      // 폭마다 QA3 행 확인
      const cW = await qaRowCounts(u.id)
      check(`${TAG} 폭 종료 QA3 행 0(저장 안 했음)`, Object.values(cW).every((n) => n === 0), JSON.stringify(cW))
    }
  } finally {
    await closeBrowser(browser)
  }
  const cf = await cleanupQa(u.id)
  const c1 = await qaRowCounts(u.id)
  const h1 = await seedHash()
  note(`정리 ${JSON.stringify(cf)} → 최종 QA3 행 ${JSON.stringify(c1)}`)
  check('종료: QA3 행 0', Object.values(c1).every((n) => n === 0), JSON.stringify(c1))
  check(`종료: 시드 해시 불변 ${h1.sha}`, h1.sha === SEED_SHA, `${h0.sha} → ${h1.sha}`)
}

main()
  .catch(async (e) => {
    console.log('FATAL', e?.stack ?? e)
    try { await cleanupQa((await qaUser(QA3)).id) } catch {}
  })
  .finally(async () => {
    summary('qa-045-ui-f item2')
    await prisma.$disconnect()
    process.exit(0)
  })
