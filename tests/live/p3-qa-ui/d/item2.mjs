/**
 * qa-045-ui-d 항목 2 — 기본 주제 「내 버전으로 저장」(#174)·두 탭 경쟁(ALREADY_COPIED)·USE_FORK 모의·하루 10 한도(429 DAILY_LIMIT). LLM 호출 0.
 * 실행: cd $HOME/.node-local/thekaiwa-qa045ui-d && QA_COOKIE=<c1 쿠키> node --env-file=.env <이 파일>   (백그라운드 권장 — 폭 사이 40초 쉼)
 */
import {
  api, applyEdit, check, cleanupQa, closeBrowser, cookieOf, data, editorInputs, launch, menuAction, mkTopic10, nonGet, note, openEdit, openPage, prisma, qaRowCounts, qaUser, QA1,
  readChunks, saveBtn, seedHash, sleep, summary, tapEl, toastWait, viewPath, WIDTHS,
} from './h.mjs'

const cookie = cookieOf(process.env.QA_COOKIE)
const u = await qaUser(QA1)
const SEED = 'cmuihjn7b0000w1dgjabrm9wh' // 시드 「자기소개」
const seed0 = await seedHash()
note('시드 해시 시작 ' + JSON.stringify(seed0))
const base0 = await qaRowCounts(u.id)
check('시작: QA1 task-045 행 0', base0.topics + base0.overrides + base0.scenarios + base0.challenges === 0, JSON.stringify(base0))
const seedChunkIds = new Set((await readChunks(SEED)).map((c) => c.id))
const ALLOWED_TOP = new Set(['title', 'titleJa', 'level', 'description', 'chunks'])
const ALLOWED_CH = new Set(['chunkType', 'textJa', 'reading', 'meaningKo'])
const browser = await launch()
const bodyText = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))

let first = true
for (const [w, h] of WIDTHS) {
  const tag = `[${w}]`
  if (!first) {
    note('분당 쓰기 한도(20)를 피하려고 40초 쉼')
    await sleep(40000)
  }
  first = false
  await cleanupQa(u.id)
  const pages = []
  try {
    // ── A. 기본 주제 고치기 → #174 1회 → 사본 S6
    const A = await openPage(browser, w, h, cookie)
    pages.push(A)
    await openEdit(A.page, SEED)
    const txt = await bodyText(A.page)
    check(`${tag} A 시드 S7: 기본 주제 안내 InfoBox·저장 버튼 「내 버전으로 저장」`, /기본 주제예요/.test(txt) && /내 버전/.test(txt) && (await saveBtn(A.page).innerText()).trim() === '내 버전으로 저장', txt.slice(0, 0))
    await A.page.locator('#tp-title').fill('자기소개 QA 내버전')
    await menuAction(A.page, '名前', '고치기')
    await editorInputs(A.page, '名前').nth(2).fill('이름(QA수정)')
    await applyEdit(A.page, '名前')
    const n0 = A.reqs.length
    await tapEl(A.page, saveBtn(A.page))
    const ov = await (async () => {
      for (let i = 0; i < 40; i++) {
        const o = await prisma.userSeedOverride.findFirst({ where: { userId: u.id, kind: 'TOPIC', seedId: SEED } })
        if (o?.copyId) return o
        await sleep(250)
      }
      return null
    })()
    const copyId = ov?.copyId
    await A.page.waitForURL((x) => copyId && x.pathname === viewPath(copyId), { timeout: 15000 }).catch(() => {})
    await toastWait(A.page, /내 버전으로 저장했어요/)
    await sleep(400)
    const posts = nonGet(A.reqs, n0)
    check(`${tag} A 저장 → 쓰기 요청 정확히 1건(POST …/fork)·PATCH 없음`, posts.length === 1 && posts[0].m === 'POST' && posts[0].p === `/api/v1/topics/${SEED}/fork`, posts.map((p) => p.m + ' ' + p.p).join(','))
    const fb = posts[0] ? JSON.parse(posts[0].body ?? '{}') : {}
    const keysOk = Object.keys(fb).every((k) => ALLOWED_TOP.has(k)) && Array.isArray(fb.chunks) && fb.chunks.every((c) => Object.keys(c).every((k) => ALLOWED_CH.has(k)))
    check(`${tag} A #174 본문 = 전체 입력(title·titleJa·level·description·chunks 12개, 표현 id 없음)`, keysOk && fb.chunks.length === 12 && fb.title === '자기소개 QA 내버전', `top=${Object.keys(fb)} chunk=${[...new Set((fb.chunks ?? []).flatMap((c) => Object.keys(c)))]}`)
    check(`${tag} A 201`, posts[0]?.status === 201, `status=${posts[0]?.status}`)
    const url = new URL(A.page.url())
    const act = await A.page.evaluate(() => ({ tag: document.activeElement?.tagName, text: (document.activeElement?.textContent ?? '').trim().slice(0, 30) }))
    const t6 = await bodyText(A.page)
    const toasts = await toastWait(A.page, /./)
    check(`${tag} A 사본 id 의 S6 으로 이동·「✎ 내 버전이에요」·머리 제목 초점`, !!copyId && url.pathname === viewPath(copyId) && /✎ 내 버전이에요/.test(t6) && act.tag === 'H2', `path=${url.pathname} act=${JSON.stringify(act)}`)
    check(`${tag} A 토스트 「내 버전으로 저장했어요」`, toasts.some((x) => /내 버전으로 저장했어요/.test(x)), JSON.stringify(toasts))
    const copy = copyId ? await prisma.conversationTopic.findUnique({ where: { id: copyId } }) : null
    const cc = copyId ? await readChunks(copyId) : []
    const ovCount = await prisma.userSeedOverride.count({ where: { userId: u.id } })
    const mine = await prisma.conversationTopic.count({ where: { userId: u.id } })
    check(`${tag} A DB: 사본 1행(내 주제·시드 아님)·표현 12개 모두 새 id·수정한 뜻 반영·override 1행`, !!copy && copy.userId === u.id && copy.isSeed === false && copy.title === '자기소개 QA 내버전' && cc.length === 12 && cc.every((c) => !seedChunkIds.has(c.id)) && cc.some((c) => c.meaningKo === '이름(QA수정)') && ovCount === 1 && mine === 1, `mine=${mine} ov=${ovCount} chunks=${cc.length}`)
    check(`${tag} A 시드 행 해시 불변`, (await seedHash()).sha === seed0.sha)
    await A.ctx.close()

    // ── B. 두 탭 경쟁
    await cleanupQa(u.id)
    const P1 = await openPage(browser, w, h, cookie)
    const P2 = await openPage(browser, w, h, cookie)
    pages.push(P1, P2)
    await openEdit(P1.page, SEED)
    await openEdit(P2.page, SEED)
    await P1.page.locator('#tp-title').fill('A탭 내 버전')
    await P2.page.locator('#tp-title').fill('B탭 내 버전')
    await tapEl(P1.page, saveBtn(P1.page))
    let ov1 = null
    for (let i = 0; i < 40 && !ov1?.copyId; i++) {
      ov1 = await prisma.userSeedOverride.findFirst({ where: { userId: u.id, kind: 'TOPIC', seedId: SEED } })
      await sleep(250)
    }
    await P1.page.waitForURL((x) => x.pathname === viewPath(ov1.copyId), { timeout: 15000 })
    const m0 = P2.reqs.length
    await tapEl(P2.page, saveBtn(P2.page))
    await P2.page.waitForSelector('#tp-edit-copied', { timeout: 10000 })
    await sleep(500)
    const rq2 = nonGet(P2.reqs, m0)
    check(`${tag} B 두 번째 탭: POST 1건 → 409`, rq2.length === 1 && rq2[0].status === 409, rq2.map((r) => r.m + ' ' + r.status).join(','))
    const box = await P2.page.evaluate(() => {
      const b = document.getElementById('tp-edit-copied')
      const save = [...document.querySelectorAll('button')].find((x) => /내 버전으로 저장/.test(x.textContent ?? ''))
      return { text: (b?.textContent ?? '').replace(/\s+/g, ' ').trim(), focused: document.activeElement === b, role: b?.getAttribute('role'), saveDisabled: save?.getAttribute('aria-disabled'), btnH: Math.round(b?.querySelector('button')?.getBoundingClientRect().height ?? 0) }
    })
    check(`${tag} B 안내 문구 「다른 화면에서 이미 내 버전을 만들었어요…」+[내 버전 열기]·role=alert·초점·[저장] 막힘`, /다른 화면에서 이미 내 버전을 만들었어요\. 여기서 고친 내용은 저장되지 않았어요\./.test(box.text) && /내 버전 열기/.test(box.text) && box.role === 'alert' && box.focused && box.saveDisabled === 'true', JSON.stringify(box))
    check(`${tag} B [내 버전 열기] 버튼 높이 ≥44px`, box.btnH >= 44, `h=${box.btnH}`)
    const t2 = await bodyText(P2.page)
    check(`${tag} B 서버 message(「이미 …」 원문 계열) 화면 노출 0`, !/ALREADY_COPIED|already/i.test(t2))
    await P2.page.getByRole('button', { name: '내 버전 열기', exact: true }).tap()
    await P2.page.waitForURL((x) => x.pathname === viewPath(ov1.copyId), { timeout: 10000 })
    check(`${tag} B [내 버전 열기] → 이미 있는 사본의 S6`, new URL(P2.page.url()).pathname === viewPath(ov1.copyId))
    const mineB = await prisma.conversationTopic.count({ where: { userId: u.id } })
    const ovB = await prisma.userSeedOverride.count({ where: { userId: u.id } })
    const copyRow = await prisma.conversationTopic.findUnique({ where: { id: ov1.copyId } })
    check(`${tag} B DB: 사본 1행·override 1행 유지(첫 탭 내용 'A탭 내 버전')`, mineB === 1 && ovB === 1 && copyRow?.title === 'A탭 내 버전', `mine=${mineB} ov=${ovB} title=${copyRow?.title}`)
    await P1.ctx.close()
    await P2.ctx.close()

    // ── C. USE_FORK 모의(내 주제 PATCH 가 USE_FORK 409 로 응답한다고 가정) — 실제 응답 본문을 서버에서 얻어 그대로 쓰되 message 는 표식으로 바꾼다
    await cleanupQa(u.id)
    const real = await api(cookie, 'PATCH', `/api/v1/topics/${SEED}`, { title: 'x' })
    note(`${tag} 실제 시드 PATCH 응답: ${real.status} ${JSON.stringify(real.body).slice(0, 200)}`)
    const mk = await mkTopic10(cookie, `QA forkmock ${w}`)
    const C = await openPage(browser, w, h, cookie)
    pages.push(C)
    const SENT = '서버메시지-표식-XYZ'
    const mocked = JSON.parse(JSON.stringify(real.body))
    const walk = (o) => {
      if (o && typeof o === 'object') for (const k of Object.keys(o)) (k === 'message' && typeof o[k] === 'string') ? (o[k] = SENT) : walk(o[k])
    }
    walk(mocked)
    await C.page.route(`**/api/v1/topics/${mk.id}`, (route) => (route.request().method() === 'PATCH' ? route.fulfill({ status: real.status, contentType: 'application/json', body: JSON.stringify(mocked) }) : route.continue()))
    await openEdit(C.page, mk.id)
    const preTxt = await bodyText(C.page)
    check(`${tag} C 내 주제 S7: 기본 주제 안내 없음·저장 버튼 「저장」`, !/기본 주제예요/.test(preTxt) && (await saveBtn(C.page).innerText()).trim() === '저장')
    await C.page.locator('#tp-title').fill('QA forkmock 고침')
    const c0 = C.reqs.length
    await tapEl(C.page, saveBtn(C.page))
    await sleep(900)
    const ct = await bodyText(C.page)
    check(`${tag} C USE_FORK 409 → 「기본 주제라 내 버전으로 저장돼요. 다시 눌러 주세요.」·서버 message 표식 노출 0`, real.status === 409 && /기본 주제라 내 버전으로 저장돼요\. 다시 눌러 주세요\./.test(ct) && !ct.includes(SENT) && !/기본 주제는 바로 고칠 수 없어요/.test(ct), `real=${real.status}`)
    check(`${tag} C 이후 화면이 기본 주제 모드(InfoBox·「내 버전으로 저장」)로 바뀜·PATCH 1건뿐`, /기본 주제예요/.test(ct) && (await saveBtn(C.page).innerText()).trim() === '내 버전으로 저장' && nonGet(C.reqs, c0).filter((r) => r.m === 'PATCH').length === 1)
    await C.ctx.close()

    // ── D. 하루 10 한도(내 버전 포함): 오늘 만든 내 주제 행 10개 → 화면 저장 429
    await cleanupQa(u.id)
    const todayRows = await prisma.conversationTopic.count({ where: { userId: u.id, isSeed: false } })
    check(`${tag} D 시작: QA1 오늘 만든 주제 행 0`, todayRows === 0)
    let made = 0
    for (let i = 0; i < 10; i++) if (await mkTopic10(cookie, `QA 채움 ${w}-${i}`)) made++
    const rows10 = await prisma.conversationTopic.count({ where: { userId: u.id, isSeed: false } })
    check(`${tag} D 채움: 주제 행 10개(한도 도달)`, made === 10 && rows10 === 10, `made=${made} rows=${rows10}`)
    const realD = await api(cookie, 'POST', '/api/v1/topics', { title: 'x', level: 'N5', chunks: [] })
    note(`${tag} 실제 429(참고 — 본문 검사 전 한도 판정이라면 429): ${realD.status} ${JSON.stringify(realD.body).slice(0, 220)}`)
    const D = await openPage(browser, w, h, cookie)
    pages.push(D)
    await openEdit(D.page, SEED)
    await D.page.locator('#tp-title').fill('한도 시험')
    const d0 = D.reqs.length
    await tapEl(D.page, saveBtn(D.page))
    await sleep(1200)
    const dt = await bodyText(D.page)
    const reqD = nonGet(D.reqs, d0)
    const dailyCopy = '오늘은 주제를 10번 저장했어요(내 버전 만들기 포함). 내일 다시 저장할 수 있어요.'
    const serverMsg = '오늘은 주제를 더 저장할 수 없어요. 내일 다시 저장해 주세요.'
    check(`${tag} D 화면 저장 → POST 1건 429`, reqD.length === 1 && reqD[0].status === 429, reqD.map((r) => r.m + ' ' + r.status).join(','))
    check(`${tag} D 고정 문구 「${dailyCopy.slice(0, 20)}…」 노출·서버 message 노출 0`, dt.includes(dailyCopy) && !dt.includes(serverMsg), '')
    const blocked = await D.page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /내 버전으로 저장/.test(b.textContent ?? ''))?.getAttribute('aria-disabled'))
    const overD = await prisma.userSeedOverride.count({ where: { userId: u.id } })
    check(`${tag} D 저장 버튼 막힘(aria-disabled)·DB 사본·override 0 증가 없음`, blocked === 'true' && overD === 0 && (await prisma.conversationTopic.count({ where: { userId: u.id } })) === 10, `blocked=${blocked} ov=${overD}`)
    note(`${tag} D 참고: 화면 고정 문구에 「시간 안내」(약 N시간 뒤)는 없다 — 코드 FAIL.topicSave.dailyFork 는 「내일 다시 저장할 수 있어요」`)
    await D.ctx.close()
  } catch (e) {
    check(`${tag} 시나리오 예외 없음`, false, String(e).slice(0, 300))
  } finally {
    for (const p of pages) {
      check(`${tag} 페이지 오류 0`, p.errors.length === 0, p.errors.join(' / ').slice(0, 200))
      await p.ctx.close().catch(() => {})
    }
    const gone = await cleanupQa(u.id)
    note(`${tag} 정리 ${JSON.stringify(gone)}`)
  }
}

await closeBrowser(browser)
const seed1 = await seedHash()
check('시드 해시 불변', seed1.sha === seed0.sha && seed1.sha === 'e826f3ef09237a9c', `${seed0.sha} → ${seed1.sha}`)
const left = await qaRowCounts(u.id)
check('QA1 task-045 행 0(정리)', left.topics + left.overrides + left.scenarios + left.challenges === 0, JSON.stringify(left))
summary('item2')
await prisma.$disconnect()
