/**
 * qa-045-ui-f 항목 4 — 마무리 회귀 샘플: 화면 전부 가로 넘침 0·터치 44px 미만 목록·엔진/모델명 0건, 편집기 저장 막힘 뒤 main.scrollTop 0·BackBar top 0,
 * S6 긴 한글(QA3 주제)이 실제로 그려지는지, 편집기 표현 뜻 긴 한글(fixture) 넘침. LLM 호출 0(#166 은 page.route 모의). QA3 행(주제 1·챌린지 2)은 끝에 모두 지운다.
 * 실행: cd $Q && QA_BASE=http://127.0.0.1:3059 QA_SNAPSHOT=$Q QA_COOKIE=<c3 쿠키 파일> node --env-file=.env <이 파일>
 */
import { api, data, check, note, summary, launch, openPage, cookieOf, sleep, WIDTHS, BASE, SEED_SC, QA3, qaUser, qaRowCounts, cleanupQa, seedHash, prisma, closeBrowser, insertChallenge, T_CAFE, T_ROAD } from '../e/lib.mjs'
import { env, draftFromSeed, mockPost, tap, overflow, smallTargets } from '../e/ui.mjs'

const cookie = cookieOf(process.env.QA_COOKIE)
const SEED_SHA = 'e826f3ef09237a9c'
const ENGINE_RE = /claude|haiku|sonnet|opus|reazon|whisper|style-bert|model_id|speaker_id|qwen|ollama|sherpa/i
const HG = '가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허고노도로모보소오조초코토포호구누두루무부수우주추쿠투푸후'
const visibleText = (page) => page.evaluate(() => `${document.body.innerText}\n${[...document.querySelectorAll('[aria-label],[title],[alt],[placeholder]')].map((e) => [e.getAttribute('aria-label'), e.getAttribute('title'), e.getAttribute('alt'), e.getAttribute('placeholder')].filter(Boolean).join(' ')).join('\n')}`)
const mainDims = (page) => page.evaluate(() => { const m = document.querySelector('main'); return { sw: m.scrollWidth, cw: m.clientWidth, docSW: document.documentElement.scrollWidth, pageV: document.documentElement.scrollHeight > innerHeight + 1 } })
const smallLog = []

async function measure(page, W, name, extra) {
  const md = await mainDims(page)
  const ov = await overflow(page)
  const sm = await smallTargets(page)
  const txt = await visibleText(page)
  const eng = txt.match(ENGINE_RE)?.[0] ?? null
  smallLog.push({ W, name, sm })
  note(`[${W}] ${name}: main ${md.sw}/${md.cw} doc ${md.docSW} 넘친 요소 ${ov.count} ${JSON.stringify(ov.items.slice(0, 2))} · 44px 미만 ${sm.length}건 ${JSON.stringify(sm.slice(0, 5))} · 엔진명 ${eng ?? '없음'}${extra ? ' · ' + extra : ''}`)
  check(`[${W}] ${name}: 가로 넘침 0(main.scrollWidth ≤ clientWidth·넘친 요소 0)`, md.sw <= md.cw && md.docSW <= W && ov.count === 0, `main ${md.sw}/${md.cw} doc ${md.docSW} els ${ov.count} ${JSON.stringify(ov.items.slice(0, 2))}`)
  check(`[${W}] ${name}: 엔진·모델명(claude|haiku|sonnet|opus|reazon|whisper|style-bert|model_id|speaker_id|qwen|ollama|sherpa) 0건`, eng === null, String(eng))
  return { md, ov, sm }
}

async function main() {
  const u = await qaUser(QA3)
  await cleanupQa(u.id)
  const h0 = await seedHash()
  const c0 = await qaRowCounts(u.id)
  check('시작: 시드 해시 = e826f3ef09237a9c', h0.sha === SEED_SHA, h0.sha)
  check('시작: QA3 행 0', Object.values(c0).every((n) => n === 0), JSON.stringify(c0))
  const seed = (data(await api(cookie, 'GET', '/api/v1/topics?level=all'))?.items ?? []).find((t) => t.isSeed && t.title === '자기소개')
  // QA3 긴 한글 주제(#57)
  const longDesc = '설명이길어서공백이하나도없는한글문장입니다'.repeat(6).slice(0, 100)
  const chunks = seed.chunks.slice(0, 8).map((x, i) => ({ chunkType: x.chunkType, textJa: x.textJa, reading: x.reading, meaningKo: HG.slice(i * 3, i * 3 + 30) }))
  let rs = await api(cookie, 'POST', '/api/v1/topics', { title: '긴제목한글공백없이이십자채우기시험', titleJa: '自己紹介', level: 'N5', description: longDesc, chunks })
  if (rs.status === 429) { await sleep(62000); rs = await api(cookie, 'POST', '/api/v1/topics', { title: '긴제목한글공백없이이십자채우기시험', titleJa: '自己紹介', level: 'N5', description: longDesc, chunks }) }
  const longId = data(rs)?.topic?.id
  check('준비: QA3 긴 한글 주제 #57 201', rs.status === 201 && !!longId, JSON.stringify(rs.body).slice(0, 160))
  const act = await insertChallenge(u.id, { id: T_ROAD, title: '길 묻기', level: 'N5' }, 'ACTIVE', { title: 'QA 진행 챌린지' })
  const done = await insertChallenge(u.id, { id: T_CAFE, title: '카페 주문', level: 'N5' }, 'COMPLETED', { title: 'QA 완료 챌린지' })
  const base = await draftFromSeed(cookie, SEED_SC)
  const browser = await launch()
  try {
    for (const [W, H] of WIDTHS) {
      // ── 정적 화면들 ──
      const { ctx, page } = await openPage(browser, W, H, cookie)
      page.setDefaultTimeout(60000)
      const screens = [
        ['S2 주제 탭', '/settings/scenarios?tab=topics', 'a[data-topic-id]'],
        ['S2 상황 탭', '/settings/scenarios?tab=scenarios', 'main ul li'],
        ['S6 시드 주제', `/settings/scenarios/topics/${seed.id}`, '#tp-chunks'],
        ['S6 긴 한글 주제(QA3)', `/settings/scenarios/topics/${longId}`, '#tp-chunks'],
        ['S7 주제 고치기', `/settings/scenarios/topics/${longId}/edit`, 'main input'],
        ['변형 선택 단계', `/study/ai/scenario/${SEED_SC}/variant`, 'text=무엇을 바꿔 볼까요?'],
        ['챌린지 만들기 1단계(진행 중 있음)', '/plan/challenge/new', 'main'],
        ['챌린지 진행 중', `/plan/challenge/${act.id}`, 'main h2'],
        ['챌린지 완료 결과', `/plan/challenge/${done.id}`, 'main h2'],
        ['계획표', '/plan', 'main'],
        ['챌린지 기록', '/plan/challenges', 'main'],
      ]
      for (const [name, path, sel] of screens) {
        await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 90000 })
        await page.waitForSelector(sel, { timeout: 45000 }).catch(() => {})
        await sleep(1000)
        let extra = ''
        if (name.startsWith('S6 긴 한글')) {
          const t = await page.locator('main').innerText()
          const okText = t.includes(longDesc.slice(0, 12)) && t.includes(HG.slice(0, 10)) && t.includes('긴제목한글')
          extra = `S6 본문에 설명·표현 뜻 글자 ${okText ? '있음' : '없음'}`
          check(`[${W}] S6 긴 한글 주제가 실제로 그려짐(설명 100자·표현 뜻 30자×8 문자열이 본문에 있음)`, okText, t.slice(0, 80).replace(/\n/g, '/'))
        }
        await measure(page, W, name, extra)
      }
      await ctx.close()

      // ── 변형 검토 단계(모의 #177) ──
      {
        const { ctx: c2, page: p2 } = await openPage(browser, W, H, cookie)
        p2.setDefaultTimeout(60000)
        const d = structuredClone(base.draft)
        d.title = `${base.detail.title} · QA3F`
        d.steps = [...d.steps, { ko: '바쁜 점원이 빠르게 되묻는다' }]
        await mockPost(p2, '**/api/v1/scenarios/*/variants/drafts', async () => ({ delay: 300, json: env({ draft: d, changedFields: ['title', 'steps'], axes: { persona: 'busy', twist: 'none', flow: 'same', level: 'same' } }) }))
        await p2.goto(`${BASE}/study/ai/scenario/${SEED_SC}/variant`, { waitUntil: 'domcontentloaded', timeout: 90000 })
        await p2.getByText('무엇을 바꿔 볼까요?').first().waitFor({ timeout: 60000 })
        await sleep(300)
        await tap(p2, p2.locator('label:has(input[name="va-persona"][value="busy"])').first())
        await tap(p2, p2.locator('button', { hasText: '변형 초안 만들기' }).first())
        await p2.waitForSelector('text=변형 초안이 왔어요', { timeout: 15000 }).catch(() => {})
        await sleep(700)
        await measure(p2, W, '변형 검토 단계(모의)', '')
        await c2.close()
      }

      // ── 편집기(새 상황): 초안 → 긴 한글 표현 뜻(fixture) → 저장 막힘 ──
      {
        const { ctx: c3, page: p3, reqs } = await openPage(browser, W, H, cookie)
        p3.setDefaultTimeout(60000)
        const dd = structuredClone(base.draft)
        dd.title = `QA-F ${W}`
        delete dd.opening
        dd.keyExpressions[0].ko = '긴한글뜻을공백없이이어쓰면줄바꿈이안되어가로로넘칠수있는지확인하는시험문장입니다'
        await mockPost(p3, '**/api/v1/scenarios/drafts', async () => ({ delay: 300, json: env({ draft: dd, warnings: [] }) }))
        await p3.goto(`${BASE}/study/ai/scenario/new`, { waitUntil: 'domcontentloaded', timeout: 90000 })
        await p3.waitForSelector('#dr-description', { timeout: 30000 })
        await measure(p3, W, '편집기(새 상황) 1단계', '')
        await p3.locator('#dr-description').fill('편의점에서 계산하기 연습하고 싶어요')
        await tap(p3, p3.getByRole('button', { name: '초안 만들기', exact: true }))
        await p3.waitForSelector('#dr-title', { timeout: 15000 })
        await sleep(600)
        const longKoShown = await p3.evaluate((ko) => [...document.querySelectorAll('main p')].some((e) => e.textContent.trim() === ko), dd.keyExpressions[0].ko)
        await measure(p3, W, '편집기(새 상황) 초안 단계', `긴 표현 뜻(fixture 40자 무공백) 화면에 ${longKoShown ? '있음' : '없음(표시 위치 불명)'}`)
        // 저장 막힘 — 첫마디 한국어만 입력(일본어 없음)
        await p3.locator('#dr-openingKo').scrollIntoViewIfNeeded()
        await p3.locator('#dr-openingKo').fill('아메리카노 한 잔 주세요.')
        const inner = () => p3.evaluate(() => { const i = document.querySelector('div.relative.min-h-0.flex-1.overflow-y-auto'); return i ? Math.round(i.scrollTop) : -1 })
        const pre = { main: await p3.evaluate(() => document.querySelector('main').scrollTop), inner: await inner() }
        const n163 = () => reqs.filter((r) => r.m === 'POST' && /\/api\/v1\/scenarios$/.test(r.p)).length
        await tap(p3, p3.getByRole('button', { name: '저장', exact: true }))
        await sleep(900)
        const post = await p3.evaluate(() => ({ main: document.querySelector('main').scrollTop, header: Math.round((document.querySelector('header')?.getBoundingClientRect().top ?? -99) * 10) / 10, active: document.activeElement?.id ?? document.activeElement?.tagName }))
        note(`[${W}] 편집기 저장 막힘 전 ${JSON.stringify(pre)} → 후 ${JSON.stringify(post)}`)
        check(`[${W}] 편집기 저장 막힘 뒤 main.scrollTop 0·BackBar top 0(237d721 수정 유지)·초점 #dr-opening`, post.main === 0 && post.header === 0 && post.active === 'dr-opening', JSON.stringify({ pre, post }))
        check(`[${W}] 편집기 저장 막힘 때 #163 요청 0`, n163() === 0)
        await c3.close()
      }
    }
  } finally {
    await closeBrowser(browser)
    const cf = await cleanupQa(u.id)
    const c1 = await qaRowCounts(u.id)
    const h1 = await seedHash()
    note(`정리 ${JSON.stringify(cf)} → QA3 행 ${JSON.stringify(c1)}`)
    const flat = smallLog.filter((x) => x.sm.length)
    note(`44px 미만 터치 요소 보유 화면 ${flat.length}곳: ${JSON.stringify(flat.map((x) => ({ W: x.W, name: x.name, sm: x.sm.map((s) => `${s.tag}:${s.text}:${s.h}x${s.w}`) })))}`)
    check('종료: QA3 행 0', Object.values(c1).every((n) => n === 0), JSON.stringify(c1))
    check(`종료: 시드 해시 불변 ${h1.sha}`, h1.sha === SEED_SHA, `${h0.sha} → ${h1.sha}`)
  }
}

main()
  .catch(async (e) => {
    console.log('FATAL', e?.stack ?? e)
    try { await cleanupQa((await qaUser(QA3)).id) } catch {}
  })
  .finally(async () => {
    summary('qa-045-ui-f item4')
    await prisma.$disconnect()
    process.exit(0)
  })
