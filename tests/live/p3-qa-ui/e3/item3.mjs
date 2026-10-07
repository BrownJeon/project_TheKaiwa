/**
 * qa-045-ui-e3 항목 3 — 변형 상황 만들기 A(#177 모의) 화면 실측. LLM 호출 0(#177 은 page.route 모의), DB 쓰기는 QA3 계정 행만.
 * 실행(폭 하나씩): cd $Q && WIDX=0 QA_BASE=http://127.0.0.1:3057 QA_SNAPSHOT=$Q QA_COOKIE=<c3 쿠키 파일> node --env-file=.env <이 파일>
 * 재사용: ../e/lib.mjs(launch·openPage·check·cleanupQa·seedHash) · ../e/ui.mjs(env·errEnv·draftFromSeed·mockPost·tap·dbl·overflow·smallTargets)
 */
import { mkdirSync } from 'node:fs'
import { api, data, check, note, summary, launch, openPage, cookieOf, sleep, WIDTHS, BASE, SEED_SC, QA3, qaUser, qaRowCounts, cleanupQa, seedHash, prisma, closeBrowser } from '../e/lib.mjs'
import { env, errEnv, SRV_MSG, draftFromSeed, mockPost, tap, dbl, overflow, smallTargets, pageText } from '../e/ui.mjs'

const widx = Number(process.env.WIDX ?? 0)
const [W, H] = WIDTHS[widx]
const cookie = cookieOf(process.env.QA_COOKIE)
const SHOTS = '/tmp/qa-artifacts/TheKaiwa/task-045-e3'
mkdirSync(SHOTS, { recursive: true })
const TAG = `QA3E3-${W}`
const DRAFTS = '**/api/v1/scenarios/*/variants/drafts'
const LV = ['N5', 'N4', 'N3', 'N2', 'N1']
const up = (l) => LV[Math.min(4, LV.indexOf(l) + 1)]

const T = {
  noChange: '바꿀 점을 하나 이상 골라 주세요.',
  unfit: '이 내용으로는 변형 상황을 만들기 어려워요. 바꿀 점을 다르게 적어 주세요.',
  busy: '다른 화면에서 변형 초안을 만드는 중이에요. 끝난 뒤 다시 눌러 주세요.',
  rate: '변형 초안은 1분에 6번까지 만들 수 있어요. 30초 뒤 다시 눌러 주세요.',
  fail: '잠시 문제가 생겼어요. 다시 만들어 볼까요?',
  daily: '오늘은 상황 초안을 모두 만들었어요. 상황 초안과 변형 초안을 합쳐 하루 40번까지예요.',
  gone: '원본 상황을 찾을 수 없어요. 지웠거나 내 목록에서 숨긴 상황이에요.',
  gen: '선생님이 변형 상황 초안을 만들고 있어요',
  genSub: '보통 10~20초 걸려요.',
  genLong: '조금 더 걸리고 있어요',
  review: '변형 초안이 왔어요',
  levelTop: '이미 가장 높은 수준이라 올릴 수 없어요.',
  discard: '초안을 버릴까요?',
}
const LABELS = {
  persona: ['상대 성격', ['그대로', '친절해요', '바빠서 말이 빨라요', '꼼꼼히 되물어요']],
  twist: ['돌발 상황', ['없음', '원하는 게 안 돼요', '말을 잘못 알아들어요', '문제가 생겨요']],
  flow: ['대화 흐름', ['그대로', '상대가 다른 걸 권해요', '내가 한 번 바꿔 말해요']],
  level: ['표현 수준', null],
}

const btnByText = (page, t) => page.locator('button', { hasText: t }).first()
const chip = (page, axis, v) => page.locator(`label:has(input[name="va-${axis}"][value="${v}"])`).first()
const checkedOf = (page, axis) => page.evaluate((a) => document.querySelector(`input[name="va-${a}"]:checked`)?.value ?? null, axis)
const inner = () => document.querySelector('div.relative.min-h-0.flex-1.overflow-y-auto')
const tops = (page) =>
  page.evaluate(() => {
    const i = document.querySelector('div.relative.min-h-0.flex-1.overflow-y-auto')
    const m = document.querySelector('main')
    return { main: m ? m.scrollTop : -1, mainMax: m ? m.scrollHeight - m.clientHeight : -1, inner: i ? Math.round(i.scrollTop * 10) / 10 : -1, innerMax: i ? i.scrollHeight - i.clientHeight : -1, headerTop: Math.round((document.querySelector('header')?.getBoundingClientRect().top ?? -99) * 10) / 10 }
  })
const active = (page) => page.evaluate(() => ({ tag: document.activeElement?.tagName, id: document.activeElement?.id, name: document.activeElement?.getAttribute('name'), value: document.activeElement?.getAttribute('value'), text: (document.activeElement?.textContent ?? '').trim().slice(0, 30) }))
async function waitText(page, pat, ms = 6000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    if (pat.test(await pageText(page))) return true
    await sleep(120)
  }
  return false
}
const submitState = (page, t = '변형 초안 만들기') =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent ?? '').includes(t))
    if (!b) return null
    return { aria: b.getAttribute('aria-disabled'), why: b.getAttribute('aria-describedby'), whyText: b.getAttribute('aria-describedby') ? (document.getElementById(b.getAttribute('aria-describedby'))?.textContent ?? '').trim() : null, h: Math.round(b.getBoundingClientRect().height * 10) / 10 }
  }, t)
const reqCount = (reqs, re, m = 'POST') => reqs.filter((r) => r.m === m && re.test(r.p)).length
async function goto(page, path) {
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 90000 })
}
async function waitPick(page) {
  await page.getByText('무엇을 바꿔 볼까요?').first().waitFor({ timeout: 90000 })
  await sleep(300)
}
async function pickAll(page, p, t, f, l) {
  for (const [a, v] of [['persona', p], ['twist', t], ['flow', f], ['level', l]]) if (v) await tap(page, chip(page, a, v))
}
/** 모의 응답(#177 모양) — 시드 상세 기반, 제목·역할·대화 순서·수준을 바꿔 changedFields 와 1:1 */
function mkMock(base, extra = {}) {
  const d = structuredClone(base.draft)
  const lvl = up(base.detail.level)
  d.title = `${base.detail.title} · ${TAG}`
  d.roles = { learner: d.roles.learner, tutor: d.roles.tutor + '2' }
  d.steps = [...d.steps, { ko: '바쁜 점원이 빠르게 되묻는다' }]
  d.level = lvl
  return { draft: d, changedFields: ['title', 'roles', 'steps', 'level'], axes: { persona: 'busy', twist: 'unavailable', flow: 'suggest', level: 'up' }, ...extra }
}
const overlapJs = () =>
  [...document.querySelectorAll('span.sr-only')]
    .filter((s) => (s.textContent ?? '').trim() === '원본에서 바뀌었어요')
    .map((sr) => {
      const tag = sr.parentElement
      const wrap = tag.parentElement
      const tr = tag.getBoundingClientRect()
      const label = [...wrap.textContent.replace(tag.textContent, '').trim().split('\n')][0].slice(0, 22)
      let worst = 0
      const walker = document.createTreeWalker(wrap, NodeFilter.SHOW_TEXT)
      let n
      while ((n = walker.nextNode())) {
        if (tag.contains(n) || !(n.textContent ?? '').trim()) continue
        const range = document.createRange()
        range.selectNodeContents(n)
        for (const r of range.getClientRects()) {
          const ox = Math.min(tr.right, r.right) - Math.max(tr.left, r.left)
          const oy = Math.min(tr.bottom, r.bottom) - Math.max(tr.top, r.top)
          if (ox > 0.5 && oy > 0.5) worst = Math.max(worst, Math.round(ox * 10) / 10)
        }
      }
      return { label, overlapPx: worst, tagW: Math.round(tr.width), tagH: Math.round(tr.height), right: Math.round(tr.right) }
    })

async function main() {
  const u = await qaUser(QA3)
  const h0 = await seedHash()
  const c0 = await qaRowCounts(u.id)
  note(`=== width ${W}x${H} | 시작 시드 해시 ${h0.sha} (${JSON.stringify(h0)}) | QA3 행 ${JSON.stringify(c0)}`)
  check(`[${W}] 시작 QA3 행 0`, Object.values(c0).every((n) => n === 0), JSON.stringify(c0))
  const base = await draftFromSeed(cookie, SEED_SC)
  const L = base.detail.level
  note(`시드 기준 ${base.detail.title} / ${L} / roles ${JSON.stringify(base.detail.roles)} / opening=${base.detail.opening ? 'yes' : 'no'} / topics ${base.detail.topics.map((t) => t.id).join(',')}`)
  const browser = await launch()
  try {
    // ───────── F1: 선택 화면 정적·행동 ─────────
    {
      const { ctx, page, reqs, errors } = await openPage(browser, W, H, cookie)
      const st = await mockPost(page, DRAFTS, async () => ({ delay: 200, status: 502, json: errEnv('ENGINE_ERROR', {}, SRV_MSG) }))
      await goto(page, `/study/ai/scenario/${SEED_SC}/variant`)
      await waitPick(page)
      const txt = await pageText(page)
      check(`[${W}] 원본 요약(제목·역할·수준)`, txt.includes(base.detail.title) && txt.includes('원본 상황') && txt.includes(`나 ${base.detail.roles.learner} · 선생님 ${base.detail.roles.tutor} · ${L}`), txt.slice(0, 160).replace(/\n/g, '/'))
      const fs = await page.evaluate(() => [...document.querySelectorAll('fieldset[role=radiogroup]')].map((f) => ({ legend: f.querySelector('legend')?.textContent?.trim(), chips: [...f.querySelectorAll('label')].map((l) => l.textContent.trim().replace(/^✓\s*/, '')), radios: f.querySelectorAll('input[type=radio]').length })))
      check(`[${W}] 축 4개 fieldset/legend`, fs.length === 4 && ['상대 성격', '돌발 상황', '대화 흐름', '표현 수준'].every((x, i) => fs[i].legend === x), JSON.stringify(fs.map((x) => x.legend)))
      const chipOk = ['persona', 'twist', 'flow'].every((k, i) => JSON.stringify(fs[i].chips) === JSON.stringify(LABELS[k][1]))
      check(`[${W}] 칩 라벨 = 단일 출처`, chipOk && JSON.stringify(fs[3].chips) === JSON.stringify([`그대로(${L})`, `한 단계 위(${up(L)})`]), JSON.stringify(fs.map((x) => x.chips)))
      const t0 = await tops(page)
      note(`스크롤러 초기: ${JSON.stringify(t0)}`)
      check(`[${W}] main 은 스크롤러 아님(여분 0)·안쪽 상자 스크롤 가능 여부 기록`, t0.main === 0 && t0.mainMax <= 1, JSON.stringify(t0))
      // 아무것도 안 고름 → aria-disabled + 이유 연결 + 요청 0
      const s0 = await submitState(page)
      check(`[${W}] 미선택 [만들기] aria-disabled + 이유 연결`, s0?.aria === 'true' && s0.whyText === T.noChange, JSON.stringify(s0))
      await tap(page, btnByText(page, '변형 초안 만들기'))
      await sleep(500)
      note(`통제: 막힌 [만들기] 탭 직후 초점 ${JSON.stringify(await active(page))}`)
      check(`[${W}] 미선택 탭 → #177 요청 0`, reqCount(reqs, /variants\/drafts/) === 0)
      // 직접 적기만 → 여전히 막힘, 요청 0
      await page.fill('#va-note', '손님이 바빠요 · 직접 적기')
      await tap(page, btnByText(page, '변형 초안 만들기'))
      await sleep(500)
      const s1 = await submitState(page)
      check(`[${W}] 직접 적기만 → 막힘·요청 0`, s1?.aria === 'true' && reqCount(reqs, /variants\/drafts/) === 0, JSON.stringify(s1))
      // 글자 수 카운터·101자
      const cnt = await page.locator('#va-note-count').innerText()
      check(`[${W}] 카운터 n/100`, /^\d+\/100$/.test(cnt), cnt)
      await page.fill('#va-note', 'ㄱ'.repeat(101))
      const over = await page.evaluate(() => ({ c: document.getElementById('va-note-count').textContent, cls: document.getElementById('va-note-count').className, inv: document.getElementById('va-note').getAttribute('aria-invalid') }))
      await tap(page, chip(page, 'persona', 'kind'))
      const s2 = await submitState(page)
      check(`[${W}] 101자 → 카운터 bad·aria-invalid·막힘+이유`, over.c === '101/100' && /text-bad/.test(over.cls) && over.inv === 'true' && s2?.aria === 'true' && /100자/.test(s2.whyText ?? ''), JSON.stringify({ over, s2 }))
      await tap(page, btnByText(page, '변형 초안 만들기'))
      await sleep(400)
      check(`[${W}] 101자 탭 → 요청 0`, reqCount(reqs, /variants\/drafts/) === 0)
      await page.fill('#va-note', '')
      // 화살표 키 이동 + 스크롤 차 + 초점 유지
      await page.evaluate(() => { const i = document.querySelector('div.relative.min-h-0.flex-1.overflow-y-auto'); if (i) i.scrollTop = 60 })
      await page.locator('input[name="va-twist"][value="none"]').focus()
      const before = await tops(page)
      await page.keyboard.press('ArrowRight')
      await sleep(250)
      const afterK = await tops(page)
      const act = await active(page)
      const tv = await checkedOf(page, 'twist')
      check(`[${W}] 화살표 키 → 다음 칩 선택·초점 유지`, tv === 'unavailable' && act.name === 'va-twist' && act.value === 'unavailable', JSON.stringify({ tv, act }))
      check(`[${W}] 화살표 키 scrollTop 차 0px(main·안쪽)`, before.main === afterK.main && Math.abs(before.inner - afterK.inner) < 1, JSON.stringify({ before, afterK }))
      await page.keyboard.press('ArrowLeft')
      // 탭으로 선택 — 보이는 칩을 탭할 때 스크롤 차
      const flowChip = chip(page, 'flow', 'rephrase')
      await flowChip.scrollIntoViewIfNeeded()
      const b2 = await tops(page)
      await tap(page, flowChip, { scroll: false })
      await sleep(250)
      const a2 = await tops(page)
      const act2 = await active(page)
      check(`[${W}] 칩 탭 → 선택됨·scrollTop 차 0px(main·안쪽)`, (await checkedOf(page, 'flow')) === 'rephrase' && b2.main === a2.main && Math.abs(b2.inner - a2.inner) < 1, JSON.stringify({ b2, a2 }))
      check(`[${W}] 탭 뒤 초점 = 누른 칩`, act2.name === 'va-flow' && act2.value === 'rephrase', JSON.stringify(act2))
      // 가로 넘침·44px
      const ov = await overflow(page)
      check(`[${W}] 선택 화면 가로 넘침 0`, ov.count === 0 && ov.docScrollW <= ov.cw, JSON.stringify(ov))
      const sm = await smallTargets(page)
      note(`선택 화면 44px 미만 터치 요소 ${sm.length}건: ${JSON.stringify(sm)}`)
      check(`[${W}] 선택 화면 터치 44px 미만 0건`, sm.length === 0, JSON.stringify(sm))
      // 더블탭 + 취소 잠금: 지연 모의
      await page.unroute(DRAFTS)
      const st2 = await mockPost(page, DRAFTS, async () => ({ delay: 3500, json: env(mkMock(base)) }))
      await pickAll(page, 'busy', 'unavailable', 'suggest', 'up')
      await page.fill('#va-note', '손님이 바빠요')
      await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('변형 초안 만들기')); b.dataset.qa = 'orig' })
      const nBefore = reqs.length
      await dbl(page, 'button:has-text("변형 초안 만들기")')
      await sleep(450)
      const gen1 = await page.evaluate(() => ({ status: [...document.querySelectorAll('[role=status]')].map((e) => e.textContent.trim()).filter((t) => t.includes('변형 상황 초안')), btn: (() => { const b = [...document.querySelectorAll('button')].find((x) => x.dataset.qa === 'orig'); return b ? { text: b.textContent.trim(), aria: b.getAttribute('aria-disabled') } : null })() }))
      check(`[${W}] 더블탭 → #177 1건`, st2.calls.length === 1 && reqCount(reqs.slice(nBefore), /variants\/drafts/) === 1, `calls=${st2.calls.length}`)
      check(`[${W}] 시작 450ms: 같은 버튼이 [그만두기]·aria-disabled(취소 잠금)·만드는 중 유지`, gen1.status.length === 1 && gen1.btn?.text === '그만두기' && gen1.btn.aria === 'true', JSON.stringify(gen1))
      const g = await page.evaluate(() => {
        const s = [...document.querySelectorAll('[role=status]')].find((e) => e.textContent.includes('변형 상황 초안'))
        const b = [...document.querySelectorAll('button')].find((x) => x.dataset.qa === 'orig')
        return { sBottom: Math.round(s.getBoundingClientRect().bottom), bTop: Math.round(b.getBoundingClientRect().top), text: s.textContent.trim(), active: document.activeElement === b, act: document.activeElement?.tagName + ':' + (document.activeElement?.textContent ?? '').trim().slice(0, 16) }
      })
      check(`[${W}] 만드는 중 표시가 버튼 바로 위·문구·초점 유지`, g.sBottom <= g.bTop && g.text.includes(T.gen) && g.text.includes(T.genSub) && g.active, JSON.stringify(g))
      await sleep(700) // 시작 후 ≥1.15s → 잠금 해제
      const sub = await submitState(page, '그만두기')
      check(`[${W}] 800ms 이후 [그만두기] 활성(aria-disabled 해제)`, sub && sub.aria === null, JSON.stringify(sub))
      await tap(page, btnByText(page, '그만두기'))
      await sleep(500)
      const after = await page.evaluate(() => ({ idle: [...document.querySelectorAll('button')].some((x) => x.textContent.includes('변형 초안 만들기')), status: [...document.querySelectorAll('[role=status]')].some((e) => e.textContent.includes('변형 상황 초안')) }))
      check(`[${W}] 취소 → 선택 화면 복귀`, after.idle && !after.status, JSON.stringify(after))
      await sleep(3200)
      check(`[${W}] 취소한 응답이 늦게 와도 검토 화면 안 열림`, !(await pageText(page)).includes(T.review))
      // 22초 지연 → 20초에 「조금 더 걸리고 있어요」
      await page.unroute(DRAFTS)
      const mockObj = mkMock(base)
      const st3 = await mockPost(page, DRAFTS, async () => ({ delay: 22000, json: env(mockObj) }))
      await tap(page, btnByText(page, '변형 초안 만들기'))
      const tStart = Date.now()
      await sleep(18500)
      const long18 = (await pageText(page)).includes(T.genLong)
      await sleep(Math.max(0, 21000 - (Date.now() - tStart)))
      const t21 = Date.now() - tStart
      const long21 = (await pageText(page)).includes(T.genLong)
      check(`[${W}] 18.5초: 「조금 더 걸리고 있어요」 없음`, long18 === false)
      check(`[${W}] ~${(t21 / 1000).toFixed(1)}초: 「조금 더 걸리고 있어요」 한 줄 추가(방법: 실제 대기)`, long21 === true)
      const body3 = JSON.parse(st3.calls[0].body)
      check(`[${W}] 요청 본문 = {axes(고른 축만), note}`, JSON.stringify(Object.keys(body3).sort()) === '["axes","note"]' && JSON.stringify(body3.axes) === JSON.stringify({ persona: 'busy', twist: 'unavailable', flow: 'suggest', level: 'up' }) && body3.note === '손님이 바빠요', JSON.stringify(body3))
      await page.waitForSelector(`text=${T.review}`, { timeout: 8000 }).catch(() => {})
      // ───── 검토 ─────
      const act3 = await active(page)
      check(`[${W}] 검토 진입 시 초점 = 안내 제목`, act3.tag === 'H2' && act3.text === T.review, JSON.stringify(act3))
      const note3 = await page.evaluate(() => document.querySelector('[role=note] p')?.textContent?.trim())
      const exp = `바꾼 것 · 바빠서 말이 빨라요 · 원하는 게 안 돼요 · 상대가 다른 걸 권해요 · 한 단계 위(${up(L)}). 「바뀜」 칸을 확인하고 [새 상황으로 저장]해야 생겨요. 원본은 그대로예요.`
      check(`[${W}] 검토 안내문(축 순서 성격·돌발·흐름·수준)`, note3 === exp, note3)
      check(`[${W}] 직접 적은 글이 화면 어디에도 안 보임`, !(await pageText(page)).includes('손님이 바빠요'))
      const tags = await page.evaluate(overlapJs)
      const want = ['제목', '역할', '대화 순서', '수준']
      check(`[${W}] 「바뀜」 꼬리표 1:1(집합 비교 — changedFields=title·roles·steps·level → ${want.join('·')}; 화면 순서 ${tags.map((t) => t.label.slice(0, 4)).join('/')})`, tags.length === 4 && want.every((w) => tags.some((t) => t.label.startsWith(w))), JSON.stringify(tags.map((t) => t.label)))
      const srOk = await page.evaluate(() => [...document.querySelectorAll('span.sr-only')].filter((s) => s.textContent.trim() === '원본에서 바뀌었어요').length)
      check(`[${W}] 스크린리더용 「원본에서 바뀌었어요」 ${srOk}건 = 4`, srOk === 4)
      const noDesc = await page.evaluate(() => !/설명/.test(document.querySelector('[class*="flex-col gap-"]')?.textContent ?? '') || true)
      check(`[${W}] 꼬리표·라벨 겹침 0px(getBoundingClientRect)`, tags.every((t) => t.overlapPx === 0), JSON.stringify(tags))
      if (W === 360) await page.screenshot({ path: `${SHOTS}/rev-360.png` })
      const ovR = await overflow(page)
      check(`[${W}] 검토 화면 가로 넘침 0`, ovR.count === 0 && ovR.docScrollW <= ovR.cw, JSON.stringify(ovR))
      const smR = await smallTargets(page)
      note(`검토 화면 44px 미만 ${smR.length}건: ${JSON.stringify(smR)}`)
      check(`[${W}] 검토 화면 터치 44px 미만 0건`, smR.length === 0, JSON.stringify(smR))
      // 초안 편집(수정) → 다시 만들기 확인 상자·나가기 확인
      // 저장 막힘(필수 칸 비움) → 초점 이동 때 main.scrollTop 0·BackBar top 0
      await page.evaluate(() => { const i = document.querySelector('div.relative.min-h-0.flex-1.overflow-y-auto'); if (i) i.scrollTop = i.scrollHeight })
      const preB = await tops(page)
      await page.fill('#dr-title', '')
      await tap(page, btnByText(page, '새 상황으로 저장'))
      await sleep(900)
      const postB = await tops(page)
      const actB = await active(page)
      note(`저장 막힘 전 ${JSON.stringify(preB)} → 후 ${JSON.stringify(postB)} / 초점 ${JSON.stringify(actB)}`)
      check(`[${W}] 저장 막힘 → 초점 #dr-title`, actB.id === 'dr-title', JSON.stringify(actB))
      check(`[${W}] 저장 막힘 뒤 main.scrollTop 0·BackBar top 0(이중 스크롤 수정 검증)`, postB.main === 0 && postB.headerTop === 0 && preB.main === 0, JSON.stringify({ preB, postB }))
      check(`[${W}] 저장 막힘 때 #163 요청 0`, reqCount(reqs, /\/api\/v1\/scenarios$/) === 0)
      // 나가기 확인(검토 단계): ← → 시트 → 계속 고치기
      await page.fill('#dr-title', base.detail.title + ' · ' + TAG)
      await tap(page, page.locator('header a, header button').first())
      await sleep(400)
      const dlg = await page.evaluate(() => ({ open: !!document.querySelector('[role=dialog]'), text: (document.querySelector('[role=dialog]')?.textContent ?? '').slice(0, 40) }))
      check(`[${W}] 검토 단계 ← → 나가기 확인 시트`, dlg.open && dlg.text.includes(T.discard), JSON.stringify(dlg))
      await tap(page, page.locator('[role=dialog] button', { hasText: '계속 고치기' }))
      await sleep(400)
      check(`[${W}] 계속 고치기 → 시트 닫힘·같은 화면`, !(await page.evaluate(() => !!document.querySelector('[role=dialog]'))) && page.url().includes('/variant'))
      // 저장 (#163)
      const nB = reqs.length
      await tap(page, btnByText(page, '새 상황으로 저장'))
      await page.waitForURL((url) => url.searchParams.get('saved') === '1', { timeout: 20000 }).catch(() => {})
      await sleep(1200)
      const saves = reqs.slice(nB).filter((r) => r.m === 'POST' && /\/api\/v1\/scenarios$/.test(r.p))
      check(`[${W}] 저장 = #163 정확히 1회`, saves.length === 1, JSON.stringify(saves.map((s) => s.status)))
      const sb = saves[0] ? JSON.parse(saves[0].body) : {}
      const link = new URL(page.url())
      const newId = link.searchParams.get('sc')
      check(`[${W}] 저장 뒤 주소 ?sc=<새 id>&saved=1`, !!newId && link.searchParams.get('saved') === '1' && newId !== SEED_SC, page.url().replace(BASE, ''))
      check(`[${W}] 저장 본문에 note 없음`, !('note' in sb) && !JSON.stringify(sb).includes('손님이 바빠요'), Object.keys(sb).join(','))
      check(`[${W}] 저장 본문 topicIds = 원본 장소`, JSON.stringify([...(sb.topicIds ?? [])].sort()) === JSON.stringify(base.detail.topics.map((t) => t.id).sort()), JSON.stringify(sb.topicIds))
      const exOp = base.detail.opening ? { ko: base.detail.opening.ko, ja: base.detail.opening.ja } : null
      check(`[${W}] 저장 본문 opening 규칙`, exOp ? sb.opening && sb.opening.ko === exOp.ko && sb.opening.ja === exOp.ja && !('koAtJa' in sb.opening) : !sb.opening, JSON.stringify(sb.opening ?? null))
      const rows = await prisma.scenario.findMany({ where: { userId: u.id }, include: { topics: true } })
      const mine = rows.filter((r) => r.title.includes(TAG))
      check(`[${W}] DB 새 상황 정확히 1행(QA3)`, mine.length === 1 && mine[0].id === newId, `rows=${rows.length} mine=${mine.length}`)
      if (mine[0]) check(`[${W}] DB 새 행: 수준=${up(L)}·역할 반영·장소 연결 = 원본`, mine[0].level === up(L) && JSON.stringify(mine[0].topics.map((t) => t.topicId).sort()) === JSON.stringify(base.detail.topics.map((t) => t.id).sort()), `level=${mine[0].level}`)
      const hMid = await seedHash()
      check(`[${W}] 원본(시드) 해시 불변`, hMid.sha === h0.sha, `${h0.sha} → ${hMid.sha}`)
      const dlg2 = await page.evaluate(() => ({ open: !!document.querySelector('[role=dialog]'), text: (document.querySelector('[role=dialog]')?.textContent ?? '').slice(0, 80) }))
      check(`[${W}] 저장 뒤 새 상황 시트가 열림(제목 표시)`, dlg2.open && dlg2.text.includes(TAG), JSON.stringify(dlg2))
      if (errors.length) note('pageerror: ' + errors.join(' | '))
      await ctx.close()
    }
    await cleanupQa(u.id)

    // ───────── F2: 오류 모의 ─────────
    {
      const { ctx, page, reqs } = await openPage(browser, W, H, cookie)
      let mode = 'noVar'
      const MODES = {
        noVar: { status: 422, json: errEnv('UNPROCESSABLE', { reason: 'NO_VARIATION' }, SRV_MSG) },
        unsafe: { status: 422, json: errEnv('UNPROCESSABLE', { reason: 'UNSAFE' }, SRV_MSG) },
        busy: { status: 409, json: errEnv('CONFLICT', { reason: 'DRAFT_BUSY' }, SRV_MSG) },
        rate: { status: 429, json: errEnv('RATE_LIMITED', { retryAfterSec: 30 }, SRV_MSG) },
        e502: { status: 502, json: errEnv('ENGINE_ERROR', {}, SRV_MSG) },
        daily: { status: 429, json: errEnv('RATE_LIMITED', { retryAfterSec: 3600, reason: 'DAILY_LIMIT' }, SRV_MSG) },
        gone: { status: 404, json: errEnv('NOT_FOUND', {}, SRV_MSG) },
      }
      const st = await mockPost(page, DRAFTS, async () => ({ delay: 200, ...MODES[mode] }))
      await goto(page, `/study/ai/scenario/${SEED_SC}/variant`)
      await waitPick(page)
      await tap(page, chip(page, 'persona', 'kind'))
      for (const [m, key, label] of [['noVar', 'noChange', '422 NO_VARIATION'], ['unsafe', 'unfit', '422 UNSAFE'], ['busy', 'busy', '409 DRAFT_BUSY'], ['rate', 'rate', '429 분당'], ['e502', 'fail', '502']]) {
        mode = m
        const n0 = st.calls.length
        await tap(page, btnByText(page, '변형 초안 만들기'))
        const ok = await waitText(page, new RegExp(T[key].slice(0, 14).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 5000)
        const txt = await pageText(page)
        check(`[${W}] ${label} → 고정 문구`, ok && txt.includes(T[key]) && !txt.includes('SECRET-MSG') && st.calls.length === n0 + 1, ok ? '' : txt.slice(0, 200).replace(/\n/g, '/'))
        const b = JSON.parse(st.calls[st.calls.length - 1].body)
        if (m === 'noVar') check(`[${W}] 요청 본문 = {axes:{persona}}만(바꾸지 않은 축 키 생략·note 생략)`, JSON.stringify(b) === '{"axes":{"persona":"kind"}}', JSON.stringify(b))
        if (m === 'e502') {
          const retryBtn = await btnByText(page, '다시 만들기').count()
          check(`[${W}] 502 → [다시 만들기] 버튼`, retryBtn === 1)
        }
      }
      // 다시 만들기 누르면 같은 요청이 다시 나감(5xx 재시도)
      const n1 = st.calls.length
      await tap(page, btnByText(page, '다시 만들기'))
      await sleep(900)
      check(`[${W}] [다시 만들기] → #177 재요청 1건`, st.calls.length === n1 + 1)
      mode = 'daily'
      await tap(page, btnByText(page, '다시 만들기'))
      await waitText(page, /하루 40번/, 4000)
      const daily = await submitState(page)
      const txtD = await pageText(page)
      check(`[${W}] 429 일일 → 문구·[만들기] 막힘`, txtD.includes(T.daily) && daily?.aria === 'true' && !txtD.includes('SECRET-MSG'), JSON.stringify(daily))
      const n2 = st.calls.length
      await tap(page, btnByText(page, '변형 초안 만들기'))
      await sleep(500)
      check(`[${W}] 일일 한도 막힘 탭 → 요청 0`, st.calls.length === n2)
      const ovE = await overflow(page)
      check(`[${W}] 오류 상태 가로 넘침 0`, ovE.count === 0, JSON.stringify(ovE))
      // 404(원본 없음) — POST 404 → 같은 화면에서 원본 없음 문구
      await page.unroute(DRAFTS)
      mode = 'gone'
      await mockPost(page, DRAFTS, async () => ({ delay: 100, ...MODES.gone }))
      await goto(page, `/study/ai/scenario/${SEED_SC}/variant`)
      await waitPick(page)
      await tap(page, chip(page, 'persona', 'busy'))
      await tap(page, btnByText(page, '변형 초안 만들기'))
      await waitText(page, /원본 상황을 찾을 수 없어요/, 5000)
      const txtG = await pageText(page)
      const backG = await page.evaluate(() => [...document.querySelectorAll('a')].map((a) => ({ t: a.textContent.trim(), h: a.getAttribute('href') })).filter((x) => x.t))
      check(`[${W}] POST 404 → 「원본 상황을 찾을 수 없어요…」 고정 문구·서버 message 0`, txtG.includes(T.gone) && !txtG.includes('SECRET-MSG'), JSON.stringify(backG).slice(0, 200))
      // 진짜 404 — 삭제한 내 상황으로 진입
      const mk = await api(cookie, 'POST', '/api/v1/scenarios', {
        title: `${TAG}-gone`, titleJa: base.detail.titleJa ?? undefined, description: 'QA', level: base.detail.level, difficulty: base.detail.difficulty, roles: base.detail.roles,
        goal: { communicativeGoalKo: base.detail.goal.communicativeGoalKo, successCriteria: base.detail.goal.successCriteria }, steps: base.detail.steps.map((s) => ({ ko: s.ko })),
        keyExpressions: base.detail.keyExpressions.map((e) => ({ ja: e.ja, reading: e.reading, ko: e.ko })), requiredExpressions: base.detail.requiredExpressions, topicIds: base.detail.topics.map((t) => t.id),
      })
      const goneId = data(mk)?.id
      note(`삭제 시험용 상황 생성 ${mk.status} id=${goneId}`)
      if (goneId) await prisma.scenario.delete({ where: { id: goneId } })
      const p2 = await openPage(browser, W, H, cookie)
      await goto(p2.page, `/study/ai/scenario/${goneId ?? 'cmqa0000000000000000000000'}/variant?from=manage`)
      await p2.page.waitForFunction(() => document.body.innerText.includes('원본 상황을 찾을 수 없어요'), null, { timeout: 60000 }).catch(() => {})
      const txt404 = await pageText(p2.page)
      const back404 = await p2.page.evaluate(() => [...document.querySelectorAll('a')].map((a) => ({ t: a.textContent.trim(), h: a.getAttribute('href') })).filter((x) => x.t))
      check(`[${W}] 삭제된 원본으로 진입 → 고정 문구 + 돌아가기 링크(manage 목록)`, txt404.includes(T.gone) && back404.some((x) => /\/settings\/scenarios\?tab=scenarios/.test(x.h ?? '')), JSON.stringify(back404))
      const ov404 = await overflow(p2.page)
      check(`[${W}] 원본 없음 화면 가로 넘침 0`, ov404.count === 0)
      await p2.ctx.close()
      await ctx.close()
    }
    await cleanupQa(u.id)

    // ───────── F3: N1 기준 + from=manage ─────────
    {
      const mk = await api(cookie, 'POST', '/api/v1/scenarios', {
        title: `${TAG}-N1`, titleJa: base.detail.titleJa ?? undefined, description: 'QA N1', level: base.detail.level, difficulty: base.detail.difficulty, roles: base.detail.roles,
        goal: { communicativeGoalKo: base.detail.goal.communicativeGoalKo, successCriteria: base.detail.goal.successCriteria }, steps: base.detail.steps.map((s) => ({ ko: s.ko })),
        keyExpressions: base.detail.keyExpressions.map((e) => ({ ja: e.ja, reading: e.reading, ko: e.ko })), requiredExpressions: base.detail.requiredExpressions, topicIds: base.detail.topics.map((t) => t.id),
      })
      const n1Id = data(mk)?.id
      if (n1Id) await prisma.scenario.update({ where: { id: n1Id }, data: { level: 'N1' } }) // QA3 행만 DB 로 N1 지정(#163 은 N5~N3 만 받을 수 있어서)
      note(`N1 기준 QA 상황 생성 status=${mk.status} id=${n1Id} ${mk.status === 201 ? '' : JSON.stringify(mk.body).slice(0, 200)}`)
      check(`[${W}] N1 QA 상황 생성(#163 N1)`, mk.status === 201 && !!n1Id)
      if (n1Id) {
        const n1 = await draftFromSeed(cookie, n1Id)
        const { ctx, page, reqs } = await openPage(browser, W, H, cookie)
        const urls = []
        page.on('framenavigated', (f) => urls.push(f.url().replace(BASE, '')))
        const mockN1 = { draft: { ...structuredClone(n1.draft), title: `${TAG}-N1 변형`, steps: [...n1.draft.steps, { ko: '친절하게 한 번 더 묻는다' }] }, changedFields: ['title', 'steps'], axes: { persona: 'kind', twist: 'none', flow: 'same', level: 'same' } }
        const st = await mockPost(page, DRAFTS, async () => ({ delay: 250, json: env(mockN1) }))
        await goto(page, `/study/ai/scenario/${n1Id}/variant?from=manage`)
        await waitPick(page)
        const lv = await page.evaluate(() => {
          const up = document.querySelector('input[name="va-level"][value="up"]')
          const why = document.getElementById(up?.getAttribute('aria-describedby') ?? '')
          return { aria: up?.getAttribute('aria-disabled'), why: why?.textContent?.trim() ?? null, chips: [...document.querySelectorAll('fieldset')].pop().textContent.replace(/\s+/g, ' ').trim(), opacity: getComputedStyle(up.closest('label')).opacity }
        })
        check(`[${W}] N1: 「한 단계 위」 비활성 + 이유 연결`, lv.aria === 'true' && lv.why === T.levelTop && /그대로\(N1\)/.test(lv.chips), JSON.stringify(lv))
        await tap(page, chip(page, 'level', 'up'))
        await sleep(300)
        const lv2 = await checkedOf(page, 'level')
        const s = await submitState(page)
        check(`[${W}] N1: 「한 단계 위」 탭해도 선택 안 됨·[만들기] 막힘·요청 0`, lv2 === 'same' && s?.aria === 'true' && st.calls.length === 0, JSON.stringify({ lv2, s }))
        const backInfo = await page.evaluate(() => { const h = document.querySelector('header'); const a = h?.querySelector('a'); return { href: a?.getAttribute('href'), label: (a?.getAttribute('aria-label') ?? '') + '|' + (h?.textContent ?? '').trim().slice(0, 40) } })
        note(`from=manage 선택 단계 BackBar 뒤로: ${JSON.stringify(backInfo)}`)
        check(`[${W}] from=manage BackBar 뒤로 = 관리 화면(상황 탭)`, /\/settings\/scenarios\?tab=scenarios/.test(backInfo.href ?? ''), JSON.stringify(backInfo))
        await tap(page, chip(page, 'persona', 'kind'))
        await tap(page, btnByText(page, '변형 초안 만들기'))
        await page.waitForSelector(`text=${T.review}`, { timeout: 8000 }).catch(() => {})
        const msg = await page.evaluate(() => document.querySelector('[role=note] p')?.textContent?.trim())
        check(`[${W}] N1: 검토 안내에 수준 없음(성격만)`, msg === '바꾼 것 · 친절해요. 「바뀜」 칸을 확인하고 [새 상황으로 저장]해야 생겨요. 원본은 그대로예요.', msg)
        const body = JSON.parse(st.calls[0].body)
        check(`[${W}] N1: 요청 본문 {axes:{persona:'kind'}}`, JSON.stringify(body) === '{"axes":{"persona":"kind"}}', JSON.stringify(body))
        const tg = await page.evaluate(overlapJs)
        check(`[${W}] N1: 꼬리표 2개(제목·대화 순서)·겹침 0`, tg.length === 2 && tg[0].label.startsWith('제목') && tg[1].label.startsWith('대화 순서') && tg.every((t) => t.overlapPx === 0), JSON.stringify(tg))
        const nS = reqs.length
        await tap(page, btnByText(page, '새 상황으로 저장'))
        await page.waitForURL((url) => url.pathname === '/settings/scenarios', { timeout: 20000 }).catch(() => {})
        await sleep(1500)
        const lk = new URL(page.url())
        const sawSaved = urls.some((x) => /sc=[^&]+&saved=1/.test(x))
        const toastSaved = (await pageText(page)).includes('내 상황에 저장했어요')
        note(`from=manage 저장 뒤 주소 이력: ${JSON.stringify(urls.slice(-4))} / 토스트·시트 「내 상황에 저장했어요」 ${toastSaved}`)
        check(`[${W}] from=manage 저장 → /settings/scenarios?tab=scenarios&sc=<새 id>&saved=1(문서화: 한 번 보이고 주소에서 지움 → 이력·토스트로 확인)`, lk.pathname === '/settings/scenarios' && lk.searchParams.get('tab') === 'scenarios' && !!lk.searchParams.get('sc') && lk.searchParams.get('sc') !== n1Id && (sawSaved || toastSaved), page.url().replace(BASE, ''))
        check(`[${W}] N1 저장 #163 1회`, reqs.slice(nS).filter((r) => r.m === 'POST' && /\/api\/v1\/scenarios$/.test(r.p)).length === 1)
        await ctx.close()
      }
    }
    await cleanupQa(u.id)

    // ───────── F4: 버리기 확인 → 나가기, 선택 단계 ← 는 확인 없음 ─────────
    {
      const { ctx, page, reqs } = await openPage(browser, W, H, cookie)
      const st = await mockPost(page, DRAFTS, async () => ({ delay: 200, json: env(mkMock(base, { changedFields: ['title'], axes: { persona: 'kind', twist: 'none', flow: 'same', level: 'same' } })) }))
      await goto(page, `/study/ai/scenario/${SEED_SC}/variant?from=manage`)
      await waitPick(page)
      await tap(page, chip(page, 'persona', 'kind'))
      await tap(page, btnByText(page, '변형 초안 만들기'))
      await page.waitForSelector(`text=${T.review}`, { timeout: 8000 }).catch(() => {})
      await tap(page, page.locator('header a, header button').first())
      await sleep(400)
      await tap(page, page.locator('[role=dialog] button', { hasText: '버리기' }))
      await page.waitForURL((url) => url.pathname === '/settings/scenarios', { timeout: 20000 }).catch(() => {})
      const lk = new URL(page.url())
      check(`[${W}] 버리기 → 관리 화면 상황 탭 + 그 상황 시트(?sc=원본)`, lk.pathname === '/settings/scenarios' && lk.searchParams.get('sc') === SEED_SC, page.url().replace(BASE, ''))
      check(`[${W}] 버리기 → #163 요청 0·DB 새 행 0`, reqCount(reqs, /\/api\/v1\/scenarios$/) === 0 && (await prisma.scenario.count({ where: { userId: u.id } })) === 0)
      await ctx.close()
    }
    {
      // 선택 단계 ← = 확인 없이 바로 이동
      const { ctx, page } = await openPage(browser, W, H, cookie)
      await goto(page, `/study/ai/scenario/${SEED_SC}/variant`)
      await waitPick(page)
      await tap(page, page.locator('header a, header button').first())
      await sleep(900)
      const noDlg = !(await page.evaluate(() => !!document.querySelector('[role=dialog][aria-label*="초안"], [role=dialog] h2')))
      check(`[${W}] 선택 단계 ← = 버리기 확인 없음·바로 이동`, !page.url().includes('/variant'), page.url().replace(BASE, ''))
      await ctx.close()
    }

    // ───────── F5: 상황 시트 [변형 만들기] 링크 ─────────
    for (const [path, expHref, label] of [[`/study/ai?tab=scenario&sc=${SEED_SC}`, `/study/ai/scenario/${SEED_SC}/variant`, '회화 탭 시트'], [`/settings/scenarios?tab=scenarios&sc=${SEED_SC}`, `/study/ai/scenario/${SEED_SC}/variant?from=manage`, '관리 화면 시트']]) {
      const { ctx, page } = await openPage(browser, W, H, cookie)
      await goto(page, path)
      const found = await page.waitForSelector('a:has-text("변형 만들기")', { timeout: 60000 }).then(() => true).catch(() => false)
      const href = found ? await page.locator('a:has-text("변형 만들기")').first().getAttribute('href') : null
      check(`[${W}] ${label} [변형 만들기] 링크 href`, href === expHref, String(href))
      if (found) {
        const hh = await page.evaluate(() => Math.round(document.querySelector('a[href*="/variant"]')?.getBoundingClientRect().height ?? -1))
        note(`${label} [변형 만들기] 링크 높이 ${hh}px`)
        await tap(page, page.locator('a:has-text("변형 만들기")').first())
        await page.waitForURL((url) => url.pathname.endsWith('/variant'), { timeout: 30000 }).catch(() => {})
        check(`[${W}] ${label} 링크 탭 → 변형 화면 도착`, page.url().replace(BASE, '') === expHref, page.url().replace(BASE, ''))
      }
      await ctx.close()
    }
  } finally {
    await closeBrowser(browser)
  }
  const cf = await cleanupQa(u.id)
  const c1 = await qaRowCounts(u.id)
  const h1 = await seedHash()
  note(`정리 ${JSON.stringify(cf)} → 최종 QA3 행 ${JSON.stringify(c1)}`)
  check(`[${W}] 종료 QA3 행 0`, Object.values(c1).every((n) => n === 0), JSON.stringify(c1))
  check(`[${W}] 종료 시드 해시 불변 ${h1.sha}`, h1.sha === h0.sha && h1.sha === 'e826f3ef09237a9c', `${h0.sha} → ${h1.sha}`)
}

main()
  .catch(async (e) => {
    console.log('FATAL', e?.stack ?? e)
    try { await cleanupQa((await qaUser(QA3)).id) } catch {}
  })
  .finally(async () => {
    summary(`item3 width ${W}`)
    await prisma.$disconnect()
    process.exit(0)
  })
