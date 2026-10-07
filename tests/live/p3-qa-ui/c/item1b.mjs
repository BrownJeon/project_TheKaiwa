/**
 * 항목 1B+3 도착 — 실제 Claude 호출 흐름(390×844 한 번만). QA4 전용.
 * P1 「ㅁㄴㅇㄹ」 동기 더블클릭 · P2 「오늘 날씨 어때」 레이아웃 이동형 더블탭 + 422 · P3 취소(800ms 잠금·취소·409) · P4 「병원 진료」 N4 정상 + 자동 #166 1회.
 * 끝에 sessionStorage 보관본을 SNAP_FILE 로 저장(항목 2·3·4 와 360/412 재현에 재사용).
 */
import { tapAt, BASE, NEW_PATH, STORE_KEY, SNAP_FILE, SSDIR, activeInfo, check, claudeCalls, closeBrowser, cookieOf, docScrollMetrics, globalCounts, launch, mainText, note, openPage, overflowInfo, prisma, qaRowCounts, qaUser, QA4, readStore, saveJson, seedHash, sleep, smallTargets, summary, j } from './lib.mjs'

const c4 = cookieOf(process.env.QA_COOKIE)
const u4 = await qaUser(QA4)
const h0 = await seedHash()
note('seedHash start ' + j(h0))
const base4 = await qaRowCounts(u4.id)
const g0 = await globalCounts()
note('QA4 base ' + j(base4) + ' global ' + j(g0))
const calls0 = claudeCalls()
note('claude calls at start ' + j(calls0))

const browser = await launch()
const { ctx, page, reqs, errors } = await openPage(browser, 390, 844, c4)
page.setDefaultTimeout(60000)
const d170 = () => reqs.filter((r) => r.m === 'POST' && r.p === '/api/v1/topics/drafts')
const d166 = () => reqs.filter((r) => r.m === 'POST' && r.p === '/api/v1/scenarios/drafts')
const submit = () => page.getByRole('button', { name: '초안 만들기', exact: true })
const cancelBtn = () => page.getByRole('button', { name: '그만두기' })
const genCard = () => page.locator('[role=status]', { hasText: '선생님이 주제 초안을 만들고 있어요' })
const input = () => page.locator('#tp-ask')
const apiMsg = (e) => {
  try { return JSON.parse(e.resp)?.error?.message ?? JSON.parse(e.resp)?.message ?? null } catch { return null }
}
async function waitIdle(ms = 90000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    if ((await genCard().count()) === 0) return Date.now() - t0
    await sleep(200)
  }
  return -1
}
try {
  await page.goto(BASE + NEW_PATH, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await input().waitFor({ state: 'visible' })
  await sleep(600)

  // ═════ P1 「ㅁㄴㅇㄹ」 동기 더블클릭 ═════
  await input().fill('ㅁㄴㅇㄹ')
  await sleep(150)
  const c1a = claudeCalls()
  await submit().evaluate((b) => { b.click(); b.click() })
  const w1 = await waitIdle()
  await sleep(500)
  const e1 = d170()
  note(`P1 요청 ${e1.length}건 ${j(e1.map((e) => [e.status, e.dt, e.resp?.slice(0, 260)]))}`)
  const t1 = await mainText(page)
  const a1 = await activeInfo(page)
  check('1B-「ㅁㄴㅇㄹ」 동기 더블클릭 → #170 요청 1건', e1.length === 1, `n=${e1.length}`)
  check('1B-「ㅁㄴㅇㄹ」 → 거절 응답 400/422 + 화면에 거절 문구(고정 문구)·입력 상태 유지', [400, 422].includes(e1[0]?.status) && /만들기 어려워요|다시 적어|적어 주세요|쓸 수 없는/.test(t1), `status=${e1[0]?.status} idle=${w1}ms text=${t1.slice(0, 260)}`)
  check('1B-「ㅁㄴㅇㄹ」 거절 → 입력칸에 초점', a1?.id === 'tp-ask', j(a1))
  check('1B-「ㅁㄴㅇㄹ」 거절 → 서버 message 원문이 화면에 그대로 나오지 않음 + 「을(를)」 병기 0', !(apiMsg(e1[0]) && t1.includes(apiMsg(e1[0])) && !/이 글로는 주제를 만들기 어려워요/.test(apiMsg(e1[0]))) && !t1.includes('을(를)') && !t1.includes('(를)'), `serverMsg=${apiMsg(e1[0])}`)
  note(`P1 reason: ${(() => { try { return j(JSON.parse(e1[0].resp)?.error?.details ?? JSON.parse(e1[0].resp)?.details) } catch { return null } })()} · claude calls delta ${j(claudeCalls().done)} (before ${j(c1a.done)})`)

  // ═════ P2 「오늘 날씨 어때」 레이아웃 이동형 더블탭 ═════
  await input().fill('오늘 날씨 어때')
  await sleep(150)
  const n2 = d170().length
  const bb = await submit().boundingBox()
  const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2
  const tt = Date.now()
  await page.touchscreen.tap(cx, cy)
  await sleep(60)
  await page.touchscreen.tap(cx, cy)
  await sleep(1300)
  const stillGen = (await genCard().count()) > 0
  const n2b = d170().length - n2
  const lockTxt = await mainText(page)
  check('1B-「오늘 날씨 어때」 같은 자리 더블탭 → #170 요청 1건·만드는 중 유지(두 번째 탭이 [그만두기]를 눌러도 취소 안 됨)', n2b === 1 && stillGen, `requests=${n2b} generating=${stillGen}`)
  const statusRole = await genCard().first().getAttribute('role').catch(() => null)
  const formBusy = await page.locator('section[aria-busy=true]').count()
  const btnBusy = await submit().getAttribute('aria-busy')
  check('1B-만드는 중: role=status 카드·폼 aria-busy·버튼 aria-busy/aria-disabled·입력 읽기 전용', statusRole === 'status' && formBusy >= 1 && btnBusy === 'true' && (await submit().getAttribute('aria-disabled')) === 'true' && (await input().getAttribute('readonly')) !== null, `status=${statusRole} formBusy=${formBusy} btnBusy=${btnBusy}`)
  const w2 = await waitIdle()
  await sleep(400)
  const e2 = d170().slice(n2)
  const t2 = await mainText(page)
  const a2 = await activeInfo(page)
  note(`P2 요청 ${e2.length}건 ${j(e2.map((e) => [e.status, e.dt, e.resp?.slice(0, 300)]))} 탭후 idle ${w2}ms`)
  check('1B-「오늘 날씨 어때」 → 422 NOT_A_TOPIC + 고정 문구 + 입력칸 초점 + 입력 유지', e2[0]?.status === 422 && t2.includes('이 글로는 주제를 만들기 어려워요. 장소·상황·활동 이름을 적어 주세요(예: 병원 진료, 공항 체크인).') && a2?.id === 'tp-ask' && (await input().inputValue()) === '오늘 날씨 어때', `status=${e2[0]?.status} active=${j(a2)}`)
  check('1B-422 문구에 「을(를)」·「(를)」 병기 0', !t2.includes('을(를)') && !t2.includes('(를)'))
  const calls2 = claudeCalls()
  note(`P2 후 claude 완료 ${j(calls2.done)} 시작관측 ${j(calls2.any)}`)
  const envelope422 = e2[0]?.resp
  saveJson(`${SSDIR}/envelope422.json`, { resp: envelope422 })

  // ═════ P3 취소: 800ms 잠금·취소·409 ═════
  await tapAt(page, page.locator('main button', { hasText: '미용실 예약하기' }))
  await sleep(150)
  check('1B-칩 「미용실 예약하기」 탭 → 입력 채움', (await input().inputValue()) === '미용실 예약하기')
  const n3 = d170().length
  const t0 = Date.now()
  await tapAt(page, submit())
  await genCard().waitFor({ state: 'visible', timeout: 10000 })
  // 잠금 안 [그만두기]
  const early = Date.now() - t0
  const cb1 = await cancelBtn().boundingBox()
  await page.touchscreen.tap(cb1.x + cb1.width / 2, cb1.y + cb1.height / 2)
  const earlyAt = Date.now() - t0
  const ariaEarly = await cancelBtn().getAttribute('aria-disabled').catch(() => 'gone')
  await sleep(250)
  const stillGen3 = (await genCard().count()) > 0
  check(`1B-시작 ${earlyAt}ms(<800ms) 안 [그만두기]는 안 듣는다(만드는 중 유지·요청 안 끊김)`, stillGen3 && d170().length - n3 === 1 && d170()[n3]?.status !== 'FAILED', `earlyAt=${earlyAt}ms (status card seen at ${early}ms) aria-disabled(before)=${ariaEarly} stillGen=${stillGen3}`)
  // 잠금 뒤
  while (Date.now() - t0 < 1300) await sleep(50)
  const ariaLate = await cancelBtn().getAttribute('aria-disabled').catch(() => 'gone')
  const cb2 = await cancelBtn().boundingBox()
  await page.touchscreen.tap(cb2.x + cb2.width / 2, cb2.y + cb2.height / 2)
  const lateAt = Date.now() - t0
  await sleep(500)
  const t3 = await mainText(page)
  check(`1B-시작 ${lateAt}ms 뒤 [그만두기] → 요청 끊김(FAILED)·입력 상태로 복귀·입력값 유지·「그만뒀어요」 안내`, (await genCard().count()) === 0 && d170()[n3]?.status === 'FAILED' && (await input().inputValue()) === '미용실 예약하기' && t3.includes('초안 만들기를 그만뒀어요. 적은 주제는 그대로 있어요.'), `reqStatus=${d170()[n3]?.status} aria-disabled(late, before tap)=${ariaLate} value=${await input().inputValue()}`)
  // 곧바로 다시 → 409
  await tapAt(page, submit())
  const w3 = await waitIdle(30000)
  await sleep(500)
  const e3b = d170()[n3 + 1]
  const t3b = await mainText(page)
  note(`P3 재요청 ${j([e3b?.status, e3b?.dt, e3b?.resp?.slice(0, 300)])}`)
  check('1B-취소 직후 다시 누르면 서버가 아직 돌고 있어 409 DRAFT_BUSY → 고정 문구 「다른 화면에서 주제 초안을 만드는 중이에요…」', e3b?.status === 409 && t3b.includes('다른 화면에서 주제 초안을 만드는 중이에요. 끝난 뒤 다시 눌러 주세요.'), `status=${e3b?.status} text=${t3b.slice(0, 220)}`)
  check('1B-409 문구에 서버 message 원문(「주제 초안을 만드는 중이에요.」 단독) 대신 고정 문구만 나옴·「을(를)」 0', !t3b.includes('을(를)'), `serverMsg=${apiMsg(e3b)}`)
  // 서버의 취소된 작업이 끝날 때까지 기다림(Claude 호출 완료 로그)
  const cb = claudeCalls().done.topicDraft ?? 0
  for (let i = 0; i < 80; i++) {
    if ((claudeCalls().done.topicDraft ?? 0) > (calls2.done.topicDraft ?? 0)) break
    await sleep(750)
  }
  note(`P3 서버 취소 작업 완료 대기 후 claude 완료 ${j(claudeCalls().done)} (P2 후 ${j(calls2.done)})`)
  await sleep(1500)

  // ═════ P4 정상: 「병원 진료」 N4 레이아웃 이동형 더블탭 → 도착 → 자동 #166 ═════
  await input().fill('병원 진료')
  await page.getByRole('radio', { name: 'N4' }).tap()
  await sleep(200)
  check('1B-수준 칩 N4 선택(aria-checked)', (await page.getByRole('radio', { name: 'N4' }).getAttribute('aria-checked')) === 'true')
  const n4 = d170().length
  const before = { q4: await qaRowCounts(u4.id), g: await globalCounts() }
  const bb4 = await submit().boundingBox()
  const t4 = Date.now()
  await page.touchscreen.tap(bb4.x + bb4.width / 2, bb4.y + bb4.height / 2)
  await sleep(60)
  await page.touchscreen.tap(bb4.x + bb4.width / 2, bb4.y + bb4.height / 2)
  await sleep(1300)
  check('1B-「병원 진료」 N4 더블탭 → #170 요청 1건·만드는 중', d170().length - n4 === 1 && (await genCard().count()) > 0, `n=${d170().length - n4}`)
  const body4 = d170()[n4]?.body
  check('1B-#170 요청 본문 = {title:「병원 진료」, level:「N4」}만(note 칸 없음)', (() => { try { const b = JSON.parse(body4); return b.title === '병원 진료' && b.level === 'N4' && Object.keys(b).sort().join() === 'level,title' } catch { return false } })(), body4)
  // 만드는 중 접근성
  const statusTxt = await genCard().first().innerText()
  note('P4 만드는 중 카드: ' + statusTxt.replace(/\s+/g, ' '))
  // 도착 대기
  await page.getByText('초안이 왔어요').first().waitFor({ state: 'visible', timeout: 90000 })
  const arrivedMs = Date.now() - t4
  const a4 = await activeInfo(page)
  const after = { q4: await qaRowCounts(u4.id), g: await globalCounts() }
  const e4 = d170()[n4]
  note(`P4 도착 ${arrivedMs}ms(요청 ${e4?.dt}ms) active=${j(a4)}`)
  check('1B-정상 초안 도착 → 200 · 안내 제목 「초안이 왔어요」에 초점(tabIndex=-1 머리)', e4?.status === 200 && /초안이 왔어요/.test(a4?.txt ?? ''), `status=${e4?.status} active=${j(a4)}`)
  check('1B-도착 직후 DB: QA4 ConversationTopic·TopicChunk·Scenario 행 호출 전후 동일(저장 전 0)', j(before.q4) === j(after.q4) && after.q4.topics === 0 && after.q4.chunks === 0 && after.q4.scenarios === 0, `before=${j(before.q4)} after=${j(after.q4)} global before=${j(before.g)} after=${j(after.g)}`)
  // 자동 #166 1회 관찰
  await sleep(2500)
  const early166 = d166().length
  note(`P4 도착 +2.5s #166 요청 ${early166}건`)
  const sc0 = await page.getByText('상황 초안').first().isVisible().catch(() => false)
  const placeholder = await page.locator('[role=status]', { hasText: '선생님이 이 주제로 상황 초안을 만들고 있어요' }).count()
  note(`P4 자리 카드(role=status) 수 ${placeholder}`)
  // 상황 카드 도착 대기(최대 70s)
  const tc = Date.now()
  while (Date.now() - tc < 70000) {
    if ((await page.getByRole('checkbox').count()) > 0 || (await page.getByText('상황 초안은 만들지 못했어요').count()) > 0) break
    await sleep(500)
  }
  await sleep(1500)
  const done166 = d166()
  note(`P4 #166 ${done166.length}건 ${j(done166.map((e) => [e.status, e.dt]))} 카드 도착까지 ${Date.now() - t4}ms(도착 후)`)
  check('1B/3-도착 직후 자동 #166 정확히 1회(응답 200)', done166.length === 1 && done166[0].status === 200, `n=${done166.length} status=${done166[0]?.status}`)
  const b166 = (() => { try { return JSON.parse(done166[0]?.body) } catch { return null } })()
  note('P4 #166 본문 키: ' + j(b166 && { keys: Object.keys(b166), topic: b166.topic, level: b166.level, descLen: (b166.description ?? '').length, hasTopicId: 'topicId' in b166 }))
  check('3-#166 본문: topic 인라인(title·titleJa?)·topicId 없음·level=N4·description 5자 이상', !!b166 && !('topicId' in b166) && !!b166.topic?.title && b166.level === 'N4' && (b166.description ?? '').length >= 5, j(b166))
  // 저장 snapshot
  const raw = await readStore(page)
  saveJson(SNAP_FILE, { raw })
  note(`snapshot 저장 ${raw?.length}B keys=${raw ? Object.keys(JSON.parse(raw)).join(',') : null}`)
  // S4 레이아웃(390)
  const ov = await overflowInfo(page)
  const ds = await docScrollMetrics(page)
  const small = await smallTargets(page)
  check('1B-S4(390) 가로 넘침 0·문서 scrollWidth=clientWidth', ov.count === 0 && ds.scrollWidth === ds.clientWidth, j({ ov: ov.count, items: ov.items, ds }))
  check('1B-S4(390) 터치 44px 미만 0', small.length === 0, j(small))
  await page.screenshot({ path: `${SSDIR}/item1b-s4-390.png` })
  check('1B-페이지 오류 0', errors.length === 0, errors.join('|'))
  const h1 = await seedHash()
  check('1B-시드 해시 불변(e826f3ef09237a9c)', h1.sha === 'e826f3ef09237a9c' && h1.sha === h0.sha, j(h1))
  note('claude calls 최종 ' + j(claudeCalls()))
} catch (e) {
  check('1B-스크립트 오류', false, String(e).slice(0, 400))
  try { await page.screenshot({ path: `${SSDIR}/item1b-error.png` }) } catch {}
} finally {
  note('reqs all: ' + j(reqs.map((r) => [r.m, r.p, r.status])))
  await ctx.close()
}
await closeBrowser(browser)
summary('항목 1B')
await prisma.$disconnect()
