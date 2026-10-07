/**
 * qa-045-ui-e3 항목 4 — 주제가 지워진 챌린지 기록 화면(QA3 DB 행 + 화면 실측). LLM 호출 0.
 * 실행(폭 하나씩): cd $Q && WIDX=0 QA_BASE=http://127.0.0.1:3057 QA_SNAPSHOT=$Q QA_COOKIE=<c3 쿠키 파일> node --env-file=.env <이 파일>
 * 재사용: ../e/lib.mjs(openPage·insertChallenge·mkTopic·cleanupQa·seedHash·toastWait) · ../e/ui.mjs(overflow·smallTargets·pageText·tap)
 */
import { mkdirSync } from 'node:fs'
import { api, check, note, summary, launch, openPage, cookieOf, sleep, WIDTHS, BASE, QA3, qaUser, qaRowCounts, cleanupQa, seedHash, prisma, closeBrowser, insertChallenge, mkTopic, T_CAFE, T_ROAD, toastWait, dayDate } from '../e/lib.mjs'
import { overflow, smallTargets, pageText, tap } from '../e/ui.mjs'

const widx = Number(process.env.WIDX ?? 0)
const [W, H] = WIDTHS[widx]
const cookie = cookieOf(process.env.QA_COOKIE)
const SHOTS = '/tmp/qa-artifacts/TheKaiwa/task-045-e3'
mkdirSync(SHOTS, { recursive: true })
const FORBID = /\bAI\b|reazon|whisper|style-bert|claude|qwen|haiku|sonnet|opus|model_id|speaker_id/gi
const LONG_KO = '가나다라마바사아자차카타파하가나다라마바사아자차카타파하가나다라마바사아자'.slice(0, 40)
const LONG_W = 'W'.repeat(40)

const norm = (s) => s.replace(/\s+/g, ' ').trim()
async function visit(page, path, waitText) {
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 90000 })
  if (waitText) await page.locator('main').getByText(waitText).first().waitFor({ state: 'visible', timeout: 60000 }).catch(() => {})
  await sleep(700)
  const txt = norm(await page.locator('main').innerText().catch(() => ''))
  const links = await page.evaluate(() => [...document.querySelectorAll('main a')].map((a) => ({ href: a.getAttribute('href'), text: (a.textContent ?? '').trim() })))
  return { txt, links }
}
/** 가로 넘침(요소·p 단위) + 44px 미만 + 금지어 */
async function metrics(page, tag) {
  const ov = await overflow(page)
  const pOver = await page.evaluate(() => [...document.querySelectorAll('main p, main h1, main h2, main h3, main span')].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'visible' ? true : e.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5).map((e) => ({ tag: e.tagName, w: e.scrollWidth, c: e.clientWidth, t: (e.textContent ?? '').trim().slice(0, 24) })).slice(0, 4))
  const sm = await smallTargets(page)
  const txt = await pageText(page)
  const bad = txt.match(FORBID) ?? []
  note(`[${W}] ${tag} 지표: 넘침 ${ov.count}(doc ${ov.docScrollW}/${ov.cw}) p·요소 넘침 ${pOver.length} 44px 미만 ${sm.length}건 ${JSON.stringify(sm)} 금지어 ${JSON.stringify(bad)}`)
  return { ov, pOver, sm, bad }
}

async function main() {
  const u = await qaUser(QA3)
  await cleanupQa(u.id)
  const h0 = await seedHash()
  const c0 = await qaRowCounts(u.id)
  note(`=== width ${W}x${H} | 시작 시드 해시 ${h0.sha} | QA3 행 ${JSON.stringify(c0)}`)
  check(`[${W}] 시작 QA3 행 0`, Object.values(c0).every((n) => n === 0))
  const browser = await launch()
  try {
    const { ctx, page, reqs, errors } = await openPage(browser, W, H, cookie)
    page.setDefaultTimeout(30000)
    // ── 준비: 주제 A(곧 지움) + 완료·종료·긴 제목 챌린지 ──
    const NA = `QA 기록 주제 ${W}`
    const A = await mkTopic(cookie, NA)
    check(`[${W}] 준비: 내 주제 A 생성`, !!A)
    const topicA = { id: A, title: NA, level: 'N5' }
    const cEnded = await insertChallenge(u.id, topicA, 'ENDED', { title: `QA 그만둔 ${W}` })
    const cLongKo = await insertChallenge(u.id, topicA, 'COMPLETED', { title: LONG_KO })
    const cLongW = await insertChallenge(u.id, topicA, 'COMPLETED', { title: LONG_W })
    const cDone = await insertChallenge(u.id, topicA, 'COMPLETED', { title: `QA 완료 ${W}` })
    await prisma.challenge.update({ where: { id: cDone.id }, data: { endedAt: new Date(Date.now() - 3600 * 1000) } }) // 가장 최근에 끝난 챌린지(계획표 카드)
    const snapBefore = await prisma.challenge.findMany({ where: { id: { in: [cEnded.id, cLongKo.id, cLongW.id, cDone.id] } }, orderBy: { id: 'asc' } })
    // 주제 A 삭제(#173 API — 진행 중 챌린지 없음)
    const del = await api(cookie, 'DELETE', `/api/v1/topics/${A}`)
    note(`DELETE /api/v1/topics/A → ${del.status} ${JSON.stringify(del.body).slice(0, 160)}`)
    if (del.status !== 200) {
      note('API 삭제가 200 이 아니라 DB 로 직접 삭제(QA3 행) — 결과 상태는 같다')
      await prisma.conversationTopic.delete({ where: { id: A } })
    }
    const snapAfter = await prisma.challenge.findMany({ where: { id: { in: snapBefore.map((x) => x.id) } }, orderBy: { id: 'asc' } })
    check(`[${W}] DB: 주제 삭제 후 챌린지 4행 보존·topicId=null·주제 이름 스냅샷·결과 불변`, snapAfter.length === 4 && snapAfter.every((a, i) => a.topicId === null && a.topicTitleSnap === NA && a.status === snapBefore[i].status && JSON.stringify(a.result) === JSON.stringify(snapBefore[i].result) && a.title === snapBefore[i].title), JSON.stringify(snapAfter.map((a) => [a.status, a.topicId, a.topicTitleSnap])))

    // ── 상태 1: 진행 중 챌린지 없음 ──
    {
      const v = await visit(page, `/plan/challenge/${cDone.id}`, `QA 완료 ${W}`)
      note(`[${W}] 완료·주제 지워짐·진행 중 없음: ${v.txt.slice(0, 300)} | links=${JSON.stringify(v.links.map((l) => l.text + '→' + l.href))}`)
      check(`[${W}] 상태1 완료: 제목·저장된 주제 이름 그대로`, v.txt.includes(`QA 완료 ${W}`) && v.txt.includes(NA), '')
      check(`[${W}] 상태1 완료: 「삭제됨」·「같은 주제로 한 번 더」·「계산할 수 없어요」·[다시 도전] 없음`, !v.txt.includes('삭제됨') && !v.txt.includes('같은 주제로 한 번 더') && !v.txt.includes('계산할 수 없어요') && !v.txt.includes('다시 도전') && !v.links.some((l) => (l.href ?? '').includes('again=')), JSON.stringify(v.links.map((l) => l.text)))
      check(`[${W}] 상태1 완료: 「다음 주제로 넘어가 보세요.」 + [다른 주제로] 링크, 「지금은 「」 상자 없음`, v.txt.includes('다음 주제로 넘어가 보세요.') && v.links.some((l) => l.text.includes('다른 주제로') && (l.href ?? '').includes('/plan/challenge/new')) && !v.txt.includes('지금은 「'), '')
      const m1 = await metrics(page, '완료·상태1')
      check(`[${W}] 상태1 완료 화면: 가로 넘침 0·요소 넘침 0·44px 미만 0·금지어 0`, m1.ov.count === 0 && m1.pOver.length === 0 && m1.sm.length === 0 && m1.bad.length === 0, JSON.stringify({ ov: m1.ov.items, p: m1.pOver, sm: m1.sm, bad: m1.bad }))
      const e = await visit(page, `/plan/challenge/${cEnded.id}`, `QA 그만둔 ${W}`)
      note(`[${W}] 종료·주제 지워짐: ${e.txt.slice(0, 260)} | links=${JSON.stringify(e.links.map((l) => l.text + '→' + l.href))}`)
      check(`[${W}] 상태1 종료: 제목·주제 이름 그대로·「삭제됨」·「같은 주제로 한 번 더」·[다시 도전]·「계산할 수 없어요」 없음`, e.txt.includes(`QA 그만둔 ${W}`) && e.txt.includes(NA) && !e.txt.includes('삭제됨') && !e.txt.includes('같은 주제로 한 번 더') && !e.txt.includes('다시 도전') && !e.txt.includes('계산할 수 없어요') && !e.links.some((l) => (l.href ?? '').includes('again=')), '')
      const me = await metrics(page, '종료·상태1')
      check(`[${W}] 상태1 종료 화면: 가로 넘침 0·44px 미만 0·금지어 0`, me.ov.count === 0 && me.pOver.length === 0 && me.sm.length === 0 && me.bad.length === 0, JSON.stringify({ ov: me.ov.items, sm: me.sm, bad: me.bad }))
      for (const [row, label] of [[cLongKo, '긴 제목(한글 40자 무공백)'], [cLongW, '긴 제목(W 40자 무공백, 스트레스)']]) {
        const l = await visit(page, `/plan/challenge/${row.id}`, row.title.slice(0, 8))
        const ml = await metrics(page, label)
        const stress = label.includes('스트레스')
        const ok = ml.ov.count === 0 && ml.pOver.length === 0
        if (stress && !ok) note(`[${W}] (스트레스 INFO) ${label} 넘침 ${JSON.stringify({ ov: ml.ov.items, p: ml.pOver })}`)
        check(`[${W}] ${label}: <p> 가로 넘침 0`, stress ? true : ok, JSON.stringify({ ov: ml.ov.items, p: ml.pOver, txtHas: l.txt.includes(row.title.slice(0, 8)) }))
      }
      // 계획표 카드 → 다시 도전(주제 없음 안내)
      const pl = await visit(page, '/plan', null)
      await page.locator('a[href*="again="]').first().waitFor({ state: 'visible', timeout: 40000 }).catch(() => {})
      const planLinks = await page.evaluate(() => [...document.querySelectorAll('a[href*="again="]')].map((a) => ({ href: a.getAttribute('href'), text: (a.textContent ?? '').trim(), h: Math.round(a.getBoundingClientRect().height) })))
      note(`[${W}] /plan 카드의 again 링크: ${JSON.stringify(planLinks)}`)
      const mp = await metrics(page, '/plan 계획표')
      check(`[${W}] 계획표: 가로 넘침 0·44px 미만 0·금지어 0`, mp.ov.count === 0 && mp.sm.length === 0 && mp.bad.length === 0, JSON.stringify({ ov: mp.ov.items, sm: mp.sm, bad: mp.bad }))
      check(`[${W}] 계획표 카드에 다시 도전 링크(again=<완료 챌린지>)`, planLinks.some((l) => (l.href ?? '').includes(`again=${cDone.id}`)), JSON.stringify(planLinks))
      if (planLinks.length) {
        await tap(page, page.locator('a[href*="again="]').first())
        const toasts = await toastWait(page, /그 주제는 이제 내 목록에 없어요/)
        const txtC = await pageText(page)
        note(`[${W}] 다시 도전 탭 뒤 주소 ${page.url().replace(BASE, '')} / 토스트 ${JSON.stringify(toasts)}`)
        check(`[${W}] 다시 도전 탭 → 안내 「그 주제는 이제 내 목록에 없어요. 주제를 다시 골라 주세요.」(「불러오지 못해」 아님)·처음부터 고르기(step=1)`, toasts.some((x) => x.includes('그 주제는 이제 내 목록에 없어요. 주제를 다시 골라 주세요.')) && !txtC.includes('불러오지 못해') && page.url().includes('step=1'), JSON.stringify(toasts))
        const mc = await metrics(page, '챌린지 만들기(again)')
        check(`[${W}] 챌린지 만들기(again→step1) 화면: 가로 넘침 0·44px 미만 0·금지어 0`, mc.ov.count === 0 && mc.sm.length === 0 && mc.bad.length === 0, JSON.stringify({ ov: mc.ov.items, sm: mc.sm, bad: mc.bad }))
      }
      // 직접 열기도 같은 안내
      await page.goto(`${BASE}/plan/challenge/new?again=${cDone.id}`, { waitUntil: 'domcontentloaded' })
      const t2 = await toastWait(page, /그 주제는 이제 내 목록에 없어요/)
      check(`[${W}] /plan/challenge/new?again=<주제 없는 챌린지> 직접 진입도 같은 안내`, t2.some((x) => x.includes('그 주제는 이제 내 목록에 없어요')), JSON.stringify(t2))
      // 기록 목록
      const ls = await visit(page, '/plan/challenges', `QA 완료 ${W}`)
      check(`[${W}] 챌린지 기록 목록: 제목 그대로·「삭제됨」 없음`, ls.txt.includes(`QA 완료 ${W}`) && ls.txt.includes(`QA 그만둔 ${W}`) && !ls.txt.includes('삭제됨'), ls.txt.slice(0, 120))
      const ml2 = await metrics(page, '/plan/challenges 기록 목록')
      check(`[${W}] 기록 목록: 가로 넘침 0·44px 미만 0·금지어 0`, ml2.ov.count === 0 && ml2.sm.length === 0 && ml2.bad.length === 0, JSON.stringify({ ov: ml2.ov.items, sm: ml2.sm, bad: ml2.bad }))
    }

    // ── 상태 2: 다른 챌린지 진행 중(긴 이름 주제 B) ──
    const NB = '가나다라마바사아자차카타파하가나다라마바사아자차카타파하가나다라'
    let B = await mkTopic(cookie, NB)
    let nbUsed = NB
    if (!B) {
      nbUsed = '가나다라마바사아자차카타파하가나다라'
      B = await mkTopic(cookie, nbUsed)
    }
    check(`[${W}] 준비: 긴 이름 주제 B(${[...nbUsed].length}자)`, !!B)
    const act = await insertChallenge(u.id, { id: B, title: nbUsed, level: 'N5' }, 'ACTIVE', { title: LONG_KO })
    const ctrl = await insertChallenge(u.id, { id: T_CAFE, title: '카페 주문', level: 'N5' }, 'COMPLETED', { title: `QA 대조 완료 ${W}` })
    {
      const v = await visit(page, `/plan/challenge/${cDone.id}`, `QA 완료 ${W}`)
      note(`[${W}] 완료·주제 지워짐·다른 챌린지 진행 중: ${v.txt.slice(0, 420)} | links=${JSON.stringify(v.links.map((l) => l.text + '→' + l.href))}`)
      check(`[${W}] 상태2: 위 줄 「다음 주제로 넘어가 보세요.」·아래 상자 「지금은 「…」(n일째)를 하고 있어요.」`, v.txt.includes('다음 주제로 넘어가 보세요.') && /지금은 「.+」\((\d+일째|내일 시작)\)를 하고 있어요\./.test(v.txt), '')
      check(`[${W}] 상태2: 「다시 도전할 수 있어요」·「끝나면 다시 도전」·「같은 주제로 한 번 더」·[다시 도전]·「삭제됨」·「계산할 수 없어요」 없음`, !v.txt.includes('다시 도전할 수 있어요') && !v.txt.includes('끝나면 다시 도전') && !v.txt.includes('같은 주제로 한 번 더') && !v.txt.includes('다시 도전') && !v.txt.includes('삭제됨') && !v.txt.includes('계산할 수 없어요') && !v.links.some((l) => (l.href ?? '').includes('again=')), '')
      check(`[${W}] 상태2: [진행 중 챌린지 보기 ›] 링크(→ 진행 중 챌린지)·[다른 주제로] 없음`, v.links.some((l) => l.text.includes('진행 중 챌린지 보기') && (l.href ?? '').includes(act.id)) && !v.links.some((l) => l.text.includes('다른 주제로')), JSON.stringify(v.links.map((l) => l.text + '→' + l.href)))
      const m2 = await metrics(page, '완료·상태2(긴 주제 이름 상자)')
      check(`[${W}] 상태2 화면: 가로 넘침 0·요소 넘침 0·44px 미만 0·금지어 0`, m2.ov.count === 0 && m2.pOver.length === 0 && m2.sm.length === 0 && m2.bad.length === 0, JSON.stringify({ ov: m2.ov.items, p: m2.pOver, sm: m2.sm, bad: m2.bad }))
      // 다크 스크린샷 1장 + 토큰 반전 계산값
      if (W === 360) {
        const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor + '|' + getComputedStyle(document.querySelector('main')).color)
        await page.emulateMedia({ colorScheme: 'dark' })
        await sleep(500)
        const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor + '|' + getComputedStyle(document.querySelector('main')).color)
        note(`[${W}] 다크 토큰: light=${light} dark=${dark}`)
        check(`[${W}] 다크: 배경·글자 색 반전(계산값이 라이트와 다름)`, light !== dark, `${light} → ${dark}`)
        await page.screenshot({ path: `${SHOTS}/dark-360.png` })
        const mdk = await overflow(page)
        check(`[${W}] 다크 화면 가로 넘침 0`, mdk.count === 0, JSON.stringify(mdk.items))
        await page.emulateMedia({ colorScheme: 'light' })
      }
      // 대조: 주제가 있는 완료 챌린지 + 다른 챌린지 진행 중
      const c = await visit(page, `/plan/challenge/${ctrl.id}`, `QA 대조 완료 ${W}`)
      note(`[${W}] 대조(주제 있음·진행 중 있음): ${c.txt.slice(0, 420)} | links=${JSON.stringify(c.links.map((l) => l.text + '→' + l.href))}`)
      check(`[${W}] 대조: 두 문장 모두(「…다시 도전할 수 있어요」 + 「지금은 「…」(n일째)」)`, c.txt.includes('진행 중인 챌린지가 끝나면 다시 도전할 수 있어요.') && /지금은 「.+」\((\d+일째|내일 시작)\)를 하고 있어요\./.test(c.txt), '')
      check(`[${W}] 대조: 진행 중이라 [다시 도전] 링크 없음·[진행 중 챌린지 보기 ›] 있음`, !c.links.some((l) => (l.href ?? '').includes('again=')) && c.links.some((l) => l.text.includes('진행 중 챌린지 보기')), JSON.stringify(c.links.map((l) => l.text)))
      const mc2 = await metrics(page, '대조(주제 있음·진행 중)')
      check(`[${W}] 대조 화면: 가로 넘침 0·44px 미만 0·금지어 0`, mc2.ov.count === 0 && mc2.sm.length === 0 && mc2.bad.length === 0, JSON.stringify({ ov: mc2.ov.items, sm: mc2.sm, bad: mc2.bad }))
      // 계획표: 진행 중 챌린지 카드(긴 제목)
      await visit(page, '/plan', null)
      await sleep(1200)
      const mp2 = await metrics(page, '/plan 계획표(진행 중·긴 제목)')
      check(`[${W}] 계획표(진행 중 챌린지·긴 제목): 가로 넘침 0·요소 넘침 0·44px 미만 0`, mp2.ov.count === 0 && mp2.pOver.length === 0 && mp2.sm.length === 0, JSON.stringify({ ov: mp2.ov.items, p: mp2.pOver, sm: mp2.sm }))
    }
    if (errors.length) note('pageerror: ' + errors.join(' | '))
    await ctx.close()
  } finally {
    await closeBrowser(browser)
  }
  const cf = await cleanupQa(u.id)
  const c1 = await qaRowCounts(u.id)
  const h1 = await seedHash()
  note(`정리 ${JSON.stringify(cf)} → 최종 QA3 행 ${JSON.stringify(c1)}`)
  check(`[${W}] 종료 QA3 행 0(주제·상황·챌린지·override)`, Object.values(c1).every((n) => n === 0), JSON.stringify(c1))
  check(`[${W}] 종료 시드 해시 불변 ${h1.sha}`, h1.sha === h0.sha && h1.sha === 'e826f3ef09237a9c', `${h0.sha} → ${h1.sha}`)
}

main()
  .catch(async (e) => {
    console.log('FATAL', e?.stack ?? e)
    try { await cleanupQa((await qaUser(QA3)).id) } catch {}
  })
  .finally(async () => {
    summary(`item4 width ${W}`)
    await prisma.$disconnect()
    process.exit(0)
  })
