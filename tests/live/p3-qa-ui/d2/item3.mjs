/**
 * qa-045-ui-d2 항목 3 — 수준 바꿈 표현 다시 받기(D4-A). #170 은 page.route 모의(LLM 호출 0).
 * d/item3.mjs 와 같은 시나리오(F1 본선·F2 실패 4종·F3 열어 둔 편집기·F4 받는 중 ←)이되, 이전 FAIL 3종의 분류를 위해 아래 두 가지를 바꿨다.
 *  (1) 「서버 쓰기」 정의를 둘로 나눈다 — 저장 API(PATCH /topics/:id · POST /topics · POST /topics/:id/fork · DELETE) 호출 수 단언과,
 *      그 밖의 non-GET(#170 모의 제외 — 화면 열 때 나가는 요청 등)은 목록만 INFO 로 출력.
 *  (2) F 구간마다 try/catch — 한 구간의 예외(30초 locator 타임아웃)가 뒤 구간 검사를 숨기지 않게 하고, 기본 대기를 10초로 줄이고, 막히면 화면 상태를 덤프한다.
 * 실행: cd $HOME/.node-local/thekaiwa-qa045ui-d2 && QA_BASE=http://127.0.0.1:3058 QA_SNAPSHOT=$PWD QA_COOKIE=<쿠키 파일> node --env-file=.env <이 파일>
 */
import {
  applyEdit, backBtn, check, cleanupQa, closeBrowser, cookieOf, doubleTapEl, ids, launch, mkTopic10, nonGet, note, openEdit, openPage, prisma, qaRowCounts, qaUser, QA1,
  readChunks, readTopic, saveBtn, seedHash, sleep, summary, tapEl, viewPath, WIDTHS,
} from '../d/h.mjs'

const cookie = cookieOf(process.env.QA_COOKIE)
const u = await qaUser(QA1)
const seed0 = await seedHash()
const left0 = await qaRowCounts(u.id)
note(`시작 QA1 task-045 행 ${JSON.stringify(left0)} · 시드 ${seed0.sha}`)
const SENT = '서버메시지-표식-XYZ'
const DRAFTS = '**/api/v1/topics/drafts'
const browser = await launch()
const bodyText = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
const draftReqs = (reqs) => reqs.filter((r) => r.p === '/api/v1/topics/drafts')

/** 저장 API 호출(주제 쓰기) — 이것만 「서버 쓰기」. */
const isSave = (r) => {
  const p = r.p.split('?')[0]
  return (r.m === 'PATCH' && /^\/api\/v1\/topics\/[^/]+$/.test(p)) || (r.m === 'POST' && /^\/api\/v1\/topics\/[^/]+\/fork$/.test(p)) || (r.m === 'POST' && p === '/api/v1/topics') || r.m === 'DELETE'
}
const saves = (reqs, from = 0) => nonGet(reqs, from).filter(isSave)
/** #170(모의)도 저장 API 도 아닌 non-GET. */
const others = (reqs, from = 0) => nonGet(reqs, from).filter((r) => !isSave(r) && r.p !== '/api/v1/topics/drafts')
const fmt = (rs) => JSON.stringify(rs.map((r) => `${r.m} ${r.p} ${r.status}`))

const KJ = ['表現', '言葉', '文', '話', '人', '本', '道', '店', '朝', '夜', '春', '秋']
const KN = ['ひょうげん', 'ことば', 'ぶん', 'はなし', 'ひと', 'ほん', 'みち', 'みせ', 'あさ', 'よる', 'はる', 'あき']
const HG = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타']
const newChunks = (n) => Array.from({ length: n }, (_, i) => ({ chunkType: ['NAME', 'ACTION', 'FEELING', 'MODIFIER'][i % 4], textJa: `新しい${KJ[i]}`, reading: `あたらしい${KN[i]}`, meaningKo: `새 표현 ${HG[i]}` }))
const okBody = (title, level, desc) => JSON.stringify({ success: true, data: { draft: { title, titleJa: '自己紹介', level, description: desc, chunks: newChunks(12) }, warnings: [] } })
const errBody = (code, details) => JSON.stringify({ success: false, data: { code, details }, message: SENT })

const chip = (page, lv) => page.getByRole('radiogroup', { name: '수준' }).getByRole('radio', { name: lv, exact: true })
const layerInfo = (page) =>
  page.evaluate(() => {
    const box = [...document.querySelectorAll('[role=status]')].find((e) => (e.textContent ?? '').includes('표현 다시 받기'))
    if (!box) return null
    const layers = [...box.children]
    const vis = layers.map((l) => getComputedStyle(l).visibility !== 'hidden')
    const idx = vis.indexOf(true)
    const L = layers[idx]
    return {
      layer: ['ask', 'busy', 'fail'][idx] ?? null,
      text: (L?.innerText ?? '').replace(/\s+/g, ' ').trim(),
      buttons: [...(L?.querySelectorAll('button') ?? [])].map((b) => ({ t: (b.textContent ?? '').trim(), h: Math.round(b.getBoundingClientRect().height), dis: b.getAttribute('aria-disabled') })),
      boxH: Math.round(box.getBoundingClientRect().height),
    }
  })
const lockState = (page) =>
  page.evaluate(() => ({
    titleRO: document.querySelector('#tp-title')?.hasAttribute('readonly'),
    titleJaRO: document.querySelector('#tp-titleJa')?.hasAttribute('readonly'),
    descRO: document.querySelector('#tp-description')?.hasAttribute('readonly'),
    menuDisabled: [...document.querySelectorAll('li button[aria-haspopup=dialog]')].map((b) => b.getAttribute('aria-disabled')),
    addDisabled: [...document.querySelectorAll('button')].find((b) => /표현 더하기/.test(b.textContent ?? ''))?.getAttribute('aria-disabled'),
    saveDisabled: [...document.querySelectorAll('button')].find((b) => /^저장$|저장하고 있어요/.test((b.textContent ?? '').trim()))?.getAttribute('aria-disabled'),
  }))
const chunkRows = (page) => page.locator('section[aria-labelledby=tp-chunks-h] li').count()
const levelOn = (page) => page.getByRole('radiogroup', { name: '수준' }).locator('[aria-checked=true]').innerText()

async function sect(tag, name, fn) {
  try {
    await fn()
  } catch (e) {
    check(`${tag} ${name} 시나리오 예외 없음`, false, String(e).slice(0, 260))
  }
}

for (const [w, h] of WIDTHS) {
  const tag = `[${w}]`
  await cleanupQa(u.id)
  const pages = []
  const mk = async (id) => {
    const P = await openPage(browser, w, h, cookie)
    P.page.setDefaultTimeout(10000)
    pages.push(P)
    return P
  }
  try {
    // ═══ F1: 본선(이전 로그와 같은 재실행)
    await sect(tag, 'F1', async () => {
      const f1 = await mkTopic10(cookie, `QA 재생성 ${w}`, 'N5')
      const base = await readChunks(f1.id)
      const topic0 = await readTopic(f1.id)
      const P = await mk()
      const { page, reqs } = P
      await page.route(DRAFTS, async (route) => {
        const body = JSON.parse(route.request().postData() ?? '{}')
        await sleep(3000)
        try {
          await route.fulfill({ status: 200, contentType: 'application/json', body: okBody(body.title, body.level, '재생성된 설명(쓰이지 않아야 함)') })
        } catch {}
      })
      await openEdit(page, f1.id)
      await tapEl(page, chip(page, 'N4'))
      await sleep(250)
      const ask = await layerInfo(page)
      check(`${tag} F1 수준 칩 N4 → role=status 상자(묻기)+[표현 다시 받기][지금 표현 두기]`, ask?.layer === 'ask' && /수준을 바꿨어요 \(N5 → N4\)\. 기본 표현도 새 수준에 맞게 다시 받을까요\?/.test(ask.text) && ask.buttons.map((b) => b.t).join('|') === '표현 다시 받기|지금 표현 두기', JSON.stringify(ask)?.slice(0, 160))
      const boxH = ask.boxH
      const r0 = reqs.length
      await tapEl(page, page.getByRole('button', { name: '표현 다시 받기', exact: true }))
      await sleep(300)
      const busy1 = await layerInfo(page)
      const lock = await lockState(page)
      check(`${tag} F1 받는 중: 겹=busy·[그만두기]만·상자 높이 불변(${boxH}→${busy1?.boxH})`, busy1?.layer === 'busy' && /선생님이 새 수준에 맞는 표현을 만들고 있어요/.test(busy1.text) && busy1.buttons.length === 1 && busy1.buttons[0].t === '그만두기' && busy1.boxH === boxH, JSON.stringify(busy1)?.slice(0, 160))
      check(`${tag} F1 받는 중 잠금(이름·일본어 이름·설명 readonly, ⋯ 10개·더하기·저장 aria-disabled)`, lock.titleRO && lock.titleJaRO && lock.descRO && lock.menuDisabled.length === 10 && lock.menuDisabled.every((x) => x === 'true') && lock.addDisabled === 'true' && lock.saveDisabled === 'true', JSON.stringify(lock))
      check(`${tag} F1 [그만두기] 시작 300ms 시점 aria-disabled(800ms 잠금)`, busy1.buttons[0].dis === 'true')
      await tapEl(page, page.getByRole('button', { name: '그만두기', exact: true }))
      await sleep(250)
      check(`${tag} F1 800ms 안 [그만두기] 무시 → 아직 받는 중·요청 안 끊김`, (await layerInfo(page))?.layer === 'busy' && draftReqs(reqs.slice(r0)).length === 1 && draftReqs(reqs.slice(r0))[0].status !== 'FAILED')
      await sleep(700)
      await tapEl(page, page.getByRole('button', { name: '그만두기', exact: true }))
      await sleep(500)
      const after = await layerInfo(page)
      const dr1 = draftReqs(reqs.slice(r0))
      check(`${tag} F1 [그만두기] → 요청 끊김(status=FAILED 가 기대값)·묻기로 복귀·표현 10·수준 N4`, dr1[0].status === 'FAILED' && after?.layer === 'ask' && (await chunkRows(page)) === 10 && (await levelOn(page)) === 'N4', `status=${dr1[0].status} layer=${after?.layer}`)
      const r1 = reqs.length
      await doubleTapEl(page, page.getByRole('button', { name: '표현 다시 받기', exact: true }))
      await sleep(500)
      check(`${tag} F1 더블탭 → #170 요청 정확히 1건`, draftReqs(reqs.slice(r1)).length === 1, `n=${draftReqs(reqs.slice(r1)).length}`)
      await sleep(3500)
      const rowsNow = await chunkRows(page)
      check(`${tag} F1 도착 → 표현만 12개로 교체·이름/설명 그대로·수준 N4·상자 사라짐`, rowsNow === 12 && (await page.locator('#tp-description').inputValue()) === 'QA 주제 고치기 시험용' && (await levelOn(page)) === 'N4' && (await page.locator('[role=status]').filter({ hasText: '표현 다시 받기' }).count()) === 0, `rows=${rowsNow}`)
      const topicMid = await readTopic(f1.id)
      const midChunks = await readChunks(f1.id)
      check(`${tag} F1 저장 전 저장 API 0건·DB 불변(수준 N5·옛 id 10개 동일)`, saves(reqs, r0).length === 0 && topicMid.level === 'N5' && JSON.stringify(ids(midChunks)) === JSON.stringify(ids(base)) && topicMid.updatedAt.getTime() === topic0.updatedAt.getTime(), `saves=${saves(reqs, r0).length}`)
      const s0 = reqs.length
      await tapEl(page, saveBtn(page))
      await page.waitForURL((x) => x.pathname === viewPath(f1.id), { timeout: 15000 })
      await sleep(500)
      const pt = saves(reqs, s0)
      const pb = pt[0] ? JSON.parse(pt[0].body ?? '{}') : {}
      check(`${tag} F1 저장 → PATCH 1건(키 level·chunks)·12개·옛 id 키 0`, pt.length === 1 && pt[0].m === 'PATCH' && JSON.stringify(Object.keys(pb).sort()) === '["chunks","level"]' && pb.chunks.length === 12 && pb.chunks.every((c) => !('id' in c)) && pb.level === 'N4', `n=${pt.length}`)
      const end = await readChunks(f1.id)
      const endTopic = await readTopic(f1.id)
      check(`${tag} F1 DB: 옛 표현 10개 전부 삭제·새 12행·수준 N4`, end.length === 12 && !end.some((c) => ids(base).includes(c.id)) && endTopic.level === 'N4', `rows=${end.length} level=${endTopic.level}`)
      await prisma.conversationTopic.deleteMany({ where: { id: f1.id, userId: u.id } })
    })

    // ═══ F2: 실패 4종 — 「서버 쓰기」 정의 분리
    await sect(tag, 'F2', async () => {
      const f2 = await mkTopic10(cookie, `QA 재생성실패 ${w}`, 'N5')
      const topic0 = await readTopic(f2.id)
      const Q = await mk()
      const sims = [
        { name: '502', status: 502, body: errBody('INTERNAL', {}), block: false },
        { name: '422 NOT_A_TOPIC', status: 422, body: errBody('UNPROCESSABLE', { reason: 'NOT_A_TOPIC' }), block: false },
        { name: '409 DRAFT_BUSY', status: 409, body: errBody('CONFLICT', { reason: 'DRAFT_BUSY' }), block: false },
        { name: '429 retryAfterSec 3600', status: 429, body: errBody('RATE_LIMITED', { reason: 'DAILY_LIMIT', retryAfterSec: 3600 }), block: true },
      ]
      let cur = sims[0]
      await Q.page.route(DRAFTS, (route) => route.fulfill({ status: cur.status, contentType: 'application/json', body: cur.body }))
      await openEdit(Q.page, f2.id)
      const loadWrites = others(Q.reqs)
      note(`${tag} F2 화면 열기 직후 non-GET(#170·저장 API 제외) = ${fmt(loadWrites)}`)
      for (const s of sims) {
        cur = s
        try {
          if (s === sims[0]) {
            await tapEl(Q.page, chip(Q.page, 'N4'))
            await sleep(200)
          }
          await tapEl(Q.page, Q.page.getByRole('button', { name: '표현 다시 받기', exact: true }))
        } catch (e) {
          const dump = await Q.page.evaluate(() => [...document.querySelectorAll('button')].map((b) => `${(b.textContent ?? '').trim().slice(0, 14)}|vis=${getComputedStyle(b).visibility}|dis=${b.getAttribute('aria-disabled')}`).slice(0, 30))
          check(`${tag} F2 ${s.name}: [표현 다시 받기] 누르기`, false, `${String(e).slice(0, 100)} | layer=${JSON.stringify(await layerInfo(Q.page))?.slice(0, 160)} | buttons=${JSON.stringify(dump).slice(0, 400)}`)
          break
        }
        await sleep(600)
        const f = await layerInfo(Q.page)
        const t = await bodyText(Q.page)
        check(`${tag} F2 ${s.name}: 겹=fail·고정 문구·[다시 받기]/[지금 표현 두기]·버튼 ≥44px·표현 10개·서버 message 표식 0`, f?.layer === 'fail' && /표현을 받지 못했어요\. 지금 표현은 그대로 있어요\./.test(f.text) && f.buttons.map((b) => b.t).join('|') === '표현 다시 받기|지금 표현 두기' && f.buttons.every((b) => b.h >= 44) && (await chunkRows(Q.page)) === 10 && !t.includes(SENT), (f?.text ?? '').slice(0, 100))
        if (s.block) check(`${tag} F2 429: 「약 1시간 뒤」·[표현 다시 받기] aria-disabled`, /약 1시간 뒤/.test(f.text) && f.buttons[0].dis === 'true', `dis=${f.buttons[0].dis}`)
        if (s.status === 409) check(`${tag} F2 409: 전용 안내 「다른 화면에서 주제 초안을 만드는 중이에요」`, /다른 화면에서 주제 초안을 만드는 중이에요/.test(f.text))
        if (s.status === 422) check(`${tag} F2 422: 전용 안내 「이 글로는 주제를 만들기 어려워요」`, /이 글로는 주제를 만들기 어려워요/.test(f.text))
      }
      check(`${tag} F2 실패 4종 동안 **저장 API(PATCH/POST/DELETE 주제) 호출 0건**`, saves(Q.reqs).length === 0, `saves=${fmt(saves(Q.reqs))} · #170=${draftReqs(Q.reqs).length}건`)
      const nowT = await readTopic(f2.id)
      check(`${tag} F2 DB 불변(표현 10행·수준 N5·updatedAt 동일)`, (await readChunks(f2.id)).length === 10 && nowT.level === 'N5' && nowT.updatedAt.getTime() === topic0.updatedAt.getTime())
      note(`${tag} F2 전체 non-GET(#170 제외·저장 API 제외) = ${fmt(others(Q.reqs))}`)
      await prisma.conversationTopic.deleteMany({ where: { id: f2.id, userId: u.id } })
    })

    // ═══ F3: 열어 둔 [＋ 표현 더하기] 편집기가 있는 채 도착(M-2)
    await sect(tag, 'F3', async () => {
      const f3 = await mkTopic10(cookie, `QA 재생성추가 ${w}`, 'N5')
      const R = await mk()
      await R.page.route(DRAFTS, async (route) => {
        const body = JSON.parse(route.request().postData() ?? '{}')
        await sleep(1800)
        try {
          await route.fulfill({ status: 200, contentType: 'application/json', body: okBody(body.title, body.level, 'x') })
        } catch {}
      })
      await openEdit(R.page, f3.id)
      await R.page.getByRole('button', { name: '＋ 표현 더하기', exact: true }).tap()
      await sleep(250)
      const addBox = R.page.locator('section[aria-labelledby=tp-chunks-h] > div.rounded-xl')
      const ai = addBox.locator('input[type=text]')
      await ai.nth(0).fill('追加表現')
      await ai.nth(1).fill('ついかひょうげん')
      await ai.nth(2).fill('추가 표현')
      await tapEl(R.page, chip(R.page, 'N4'))
      await sleep(200)
      await tapEl(R.page, R.page.getByRole('button', { name: '표현 다시 받기', exact: true }))
      await sleep(300)
      await addBox.getByRole('button', { name: '바꾸기', exact: true }).tap({ force: true }).catch(() => {})
      await sleep(300)
      check(`${tag} F3 받는 중 열어 둔 편집기 [바꾸기] 눌러도 목록 안 바뀜(10개)`, (await chunkRows(R.page)) === 10, `rows=${await chunkRows(R.page)}`)
      await sleep(2200)
      check(`${tag} F3 도착 → 12개 교체·열어 둔 편집기 입력값 유지`, (await chunkRows(R.page)) === 12 && (await ai.nth(0).inputValue()) === '追加表現', `rows=${await chunkRows(R.page)}`)
      await addBox.getByRole('button', { name: '바꾸기', exact: true }).tap()
      await sleep(300)
      check(`${tag} F3 도착 뒤 [바꾸기] → 덮어쓰기 아닌 추가(12→13개)`, (await chunkRows(R.page)) === 13 && /追加表現/.test(await bodyText(R.page)) && /新しい表現/.test(await bodyText(R.page)), `rows=${await chunkRows(R.page)}`)
      await prisma.conversationTopic.deleteMany({ where: { id: f3.id, userId: u.id } })
    })

    // ═══ F4: 받는 중 ← 허용(나가면 요청 중단) — 단언 정의 분리
    await sect(tag, 'F4', async () => {
      const f4 = await mkTopic10(cookie, `QA 재생성나가기 ${w}`, 'N5')
      const topic0 = await readTopic(f4.id)
      const S4 = await mk()
      await S4.page.route(DRAFTS, async (route) => {
        await sleep(4000)
        try {
          await route.fulfill({ status: 200, contentType: 'application/json', body: okBody('x', 'N4', 'x') })
        } catch {}
      })
      await openEdit(S4.page, f4.id)
      await tapEl(S4.page, chip(S4.page, 'N4'))
      await sleep(200)
      await tapEl(S4.page, S4.page.getByRole('button', { name: '표현 다시 받기', exact: true }))
      await sleep(400)
      await tapEl(S4.page, backBtn(S4.page))
      await S4.page.getByRole('dialog').waitFor({ state: 'visible', timeout: 5000 })
      await S4.page.getByRole('dialog').getByRole('button', { name: '나가기', exact: true }).tap()
      await S4.page.waitForURL((x) => x.pathname === viewPath(f4.id), { timeout: 10000 })
      await sleep(500)
      const d4 = draftReqs(S4.reqs)
      check(`${tag} F4 받는 중 ← 허용(시트→나가기) → S6 도착·#170 요청 1건이 중단됨(status=FAILED 가 기대값)`, d4.length === 1 && d4[0].status === 'FAILED', `n=${d4.length} status=${d4[0]?.status}`)
      check(`${tag} F4 **저장 API 호출 0건**`, saves(S4.reqs).length === 0, `saves=${fmt(saves(S4.reqs))}`)
      const nowT = await readTopic(f4.id)
      check(`${tag} F4 DB 불변(수준 N5·표현 10행·updatedAt 동일)`, nowT.level === 'N5' && (await readChunks(f4.id)).length === 10 && nowT.updatedAt.getTime() === topic0.updatedAt.getTime())
      note(`${tag} F4 전체 non-GET(#170 제외·저장 API 제외) = ${fmt(others(S4.reqs))}`)
      await prisma.conversationTopic.deleteMany({ where: { id: f4.id, userId: u.id } })
    })
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
summary('d2-item3')
await prisma.$disconnect()
