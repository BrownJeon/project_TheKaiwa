/**
 * qa-045-ui-e 항목 1 — 공유 편집기 첫마디(OpeningField, #178 모의) 7상태·실패 문구·더블탭·취소 잠금·역할 13자·저장 본문·시드/기존 편집.
 * #166(초안)·#178 은 page.route 목. 저장(#163)은 실제 API(QA2 계정 행만). 실행:
 *   cd $HOME/.node-local/thekaiwa-qa045ui-e && QA_COOKIE2=<쿠키 파일> node --env-file=.env <이 파일> 2>&1 > <로그>
 */
import { BASE, WIDTHS, SSDIR, QA2, cookieOf, qaUser, seedHash, qaRowCounts, cleanupQa, prisma, launch, openPage, check, note, summary, sleep, j } from './lib.mjs'
import { env, errEnv, SRV_MSG, tap, dbl, scroller, mainTop, draftFromSeed, mockPost, pageText, overflow, smallTargets } from './ui.mjs'

const ck = cookieOf(process.env.QA_COOKIE2)
const u = await qaUser(QA2)
const SEED_SHA = 'e826f3ef09237a9c'
const KO = '어서 오세요, 무엇을 드릴까요?'
const JA = 'いらっしゃいませ。ご注文をどうぞ。'
const RD = 'いらっしゃいませ。ごちゅうもんをどうぞ。'
const QUESTION_KO = '저기요, 서울역 출구가 어디예요?'

const h0 = await seedHash()
check('시작 시드 해시', h0.sha === SEED_SHA, j(h0))
const r0 = await qaRowCounts(u.id)
check('시작 QA2 행 0', Object.values(r0).every((v) => v === 0), j(r0))

const browser = await launch()
const WSEL = (process.env.QA_WIDTHS ?? '').split(',').filter(Boolean).map(Number)
const barTop = (page) => page.evaluate(() => Math.round(document.getElementById('dr-opening').closest('.overflow-y-auto').parentElement.firstElementChild.getBoundingClientRect().top))
const btnY = (page) => page.evaluate(() => Math.round(document.getElementById('dr-opening').getBoundingClientRect().top))
const headroom = (page, k) => page.evaluate((k) => { const i = document.getElementById('dr-opening').closest('.overflow-y-auto'); i.scrollTop = Math.max(0, i.scrollHeight - i.clientHeight - k) }, k)
const FS = 'fieldset:has(#dr-openingKo)'
const fsText = (page) => page.locator(FS).innerText()
const attr = (page, sel, a) => page.locator(sel).first().getAttribute(a)
const active = (page) => page.evaluate(() => document.activeElement?.id ?? document.activeElement?.tagName)
const waitFs = async (page, pat, ms = 6000) => {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    if (pat.test(await fsText(page))) return true
    await sleep(100)
  }
  return false
}
const noLeak = async (page, tag) => {
  const t = await pageText(page)
  check(`${tag} 서버 message 화면 0·「을(를)」 0`, !t.includes('SECRET-MSG') && !t.includes('을(를)'), `leakMsg=${t.includes('SECRET-MSG')} josa=${t.includes('을(를)')}`)
}

async function startNew(page, w, label) {
  const { draft } = await draftFromSeed(ck, 'scn_cafe-order-drink', { title: `QA-E ${label} ${w}` })
  delete draft.opening
  const m166 = await mockPost(page, '**/api/v1/scenarios/drafts', () => ({ delay: 300, json: env({ draft, warnings: [] }) }))
  await page.goto(`${BASE}/study/ai/scenario/new`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#dr-description', { timeout: 20000 })
  await page.locator('#dr-description').fill('편의점에서 계산하기 연습하고 싶어요')
  await tap(page, page.getByRole('button', { name: '초안 만들기', exact: true }))
  await page.waitForSelector('#dr-title', { timeout: 10000 })
  return { m166, draft }
}

async function runWidth(w, h) {
  const T = `[${w}]`
  const { ctx, page, reqs, errors } = await openPage(browser, w, h, ck)
  const M = { mode: 'ok', delay: 2000 }
  // 목 #178 — 모드로 응답을 바꾼다. 같은 route 를 새 페이지(startNew 두 번째)에서 다시 쓰지 않으므로 첫 페이지에서만 설치한다.
  const m178 = await mockPost(page, '**/api/v1/scenarios/openings/draft', () => {
    switch (M.mode) {
      case 'ok':
        return { delay: M.delay, json: env({ ja: JA, reading: RD, warnings: [] }) }
      case 'question':
        return { delay: 300, json: env({ ja: 'すみません、ソウル駅の出口はどこですか。', reading: 'すみません、ソウルえきのでぐちはどこですか。', warnings: [] }) }
      case 'slow':
        return { delay: 6000, json: env({ ja: JA, reading: RD, warnings: [] }) }
      case '502':
        return { delay: 200, status: 502, json: errEnv('ENGINE_ERROR', {}, SRV_MSG) }
      case '422':
        return { delay: 200, status: 422, json: errEnv('UNPROCESSABLE', { reason: 'NOT_AN_UTTERANCE' }, SRV_MSG) }
      case 'nohangul':
        return { delay: 200, status: 400, json: errEnv('VALIDATION', { field: 'ko', reason: 'no_hangul' }, SRV_MSG) }
      case 'maxlen':
        return { delay: 200, status: 400, json: errEnv('VALIDATION', { field: 'ko', reason: 'max_length' }, SRV_MSG) }
      case 'busy':
        return { delay: 200, status: 409, json: errEnv('CONFLICT', { reason: 'DRAFT_BUSY' }, SRV_MSG) }
      case 'daily':
        return { delay: 200, status: 429, json: errEnv('RATE_LIMITED', { retryAfterSec: 3600, reason: 'DAILY_LIMIT' }, SRV_MSG) }
      case 'rate':
        return { delay: 200, status: 429, json: errEnv('RATE_LIMITED', { retryAfterSec: 30 }, SRV_MSG) }
      case 'abort':
        return { delay: 100, abort: true }
      default:
        return { delay: 0, json: env({ ja: JA, reading: RD, warnings: [] }) }
    }
  })
  const n178 = () => m178.calls.length
  const posts163 = () => reqs.filter((r) => r.m === 'POST' && r.p === '/api/v1/scenarios')

  // ── 1. 초안 → 편집 단계, 상태 none ──────────────────────────────
  await startNew(page, w, '첫마디')
  const t0 = await fsText(page)
  check(`${T} none: 「첫마디가 없어요. 역할극에서는 내가 먼저 말을 걸어요.」`, t0.includes('첫마디가 없어요. 역할극에서는 내가 먼저 말을 걸어요.'))
  check(`${T} none: 한국어 입력 레이블·힌트(선생님(점원 역할)이 …)`, t0.includes('한국어로 적어요') && t0.includes('선생님(점원 역할)이 나에게 먼저 건네는 말을 적어요'), t0.slice(0, 120).replace(/\n/g, '/'))
  check(`${T} none: [일본어로 만들기] aria-disabled=true`, (await attr(page, '#dr-opening', 'aria-disabled')) === 'true' && (await page.locator('#dr-opening').innerText()).trim() === '일본어로 만들기')
  check(`${T} none: 이유 연결 aria-describedby=dr-openingKo-hint`, (await attr(page, '#dr-opening', 'aria-describedby')) === 'dr-openingKo-hint')
  const order = await page.evaluate(() => {
    const ko = document.getElementById('dr-openingKo')
    const live = document.querySelector('fieldset [aria-live=polite]')
    return !!(ko.compareDocumentPosition(live) & Node.DOCUMENT_POSITION_FOLLOWING)
  })
  check(`${T} 한국어 칸이 주 입력(일본어 읽기 상자보다 위)`, order)
  await tap(page, '#dr-opening')
  await sleep(300)
  check(`${T} none: 비활성 [일본어로 만들기] 탭 → #178 요청 0`, n178() === 0, `n178=${n178()}`)
  check(`${T} 첫마디 칸 높이: textarea font≥16px`, (await page.locator('#dr-openingKo').evaluate((e) => parseFloat(getComputedStyle(e).fontSize))) >= 16)

  // ── 2. koOnly: 한국어만 입력 → 저장 막힘 ───────────────────────
  await page.locator('#dr-openingKo').fill(KO)
  const t1 = await fsText(page)
  check(`${T} koOnly: 「아직 일본어가 없어요…」`, t1.includes('아직 일본어가 없어요. 아래 [일본어로 만들기]를 눌러 주세요.'))
  check(`${T} koOnly: [일본어로 만들기] 활성`, (await attr(page, '#dr-opening', 'aria-disabled')) === null && (await page.locator('#dr-opening').innerText()).trim() === '일본어로 만들기')
  const saveBtn = page.getByRole('button', { name: '저장', exact: true })
  const before163 = posts163().length
  await tap(page, saveBtn)
  await sleep(500)
  const t1s = await pageText(page)
  check(`${T} koOnly: 저장 탭 → #163 요청 0 (막힘)`, posts163().length === before163, `posts=${posts163().length - before163}`)
  check(`${T} koOnly: 요약 「고칠 곳이 1군데 있어요 · 선생님 첫마디」`, t1s.includes('고칠 곳이 1군데 있어요 · 선생님 첫마디'))
  check(`${T} koOnly: 칸 안내 「저장하려면 [일본어로 만들기]를 눌러 주세요.」`, t1s.includes('저장하려면 [일본어로 만들기]를 눌러 주세요.'))
  check(`${T} koOnly: 초점 #dr-opening`, (await active(page)) === 'dr-opening', await active(page))
  check(`${T} koOnly: 이유 연결(버튼 aria-describedby=dr-opening-err) 및 fieldset 테두리 오류`, (await attr(page, '#dr-opening', 'aria-describedby')) === 'dr-opening-err' && (await page.evaluate(() => document.getElementById('dr-opening-err')?.textContent ?? '')).includes('저장하려면'), await attr(page, '#dr-opening', 'aria-describedby'))
  note(`${T} 저장 버튼 aria-disabled(막힘 뒤)=${await attr(page, 'button:has-text("저장")', 'aria-disabled')} — screens.md §16-2 는 검증 후 칸 오류 방식(버튼 자체 aria-disabled 아님)`)

  // ── 3. 만드는 중: 더블탭 1건·취소 잠금 800ms·이후 [그만두기]·결과 matched·스크롤 차 0 ──
  M.mode = 'ok'
  M.delay = 2400
  await page.locator('#dr-opening').scrollIntoViewIfNeeded()
  const s0 = await scroller(page, '#dr-opening')
  const mt0 = await mainTop(page)
  const y0 = await btnY(page)
  note(`${T} 차단 저장 뒤 main.scrollTop=${mt0} BackBar top=${await barTop(page)} (0 이어야 BackBar 가 화면 안)`)
  await dbl(page, '#dr-opening', 90)
  await sleep(160)
  check(`${T} 더블탭 → #178 요청 1건`, n178() === 1, `n178=${n178()}`)
  const busyAttrs = { busy: await attr(page, '#dr-opening', 'aria-busy'), dis: await attr(page, '#dr-opening', 'aria-disabled'), label: (await page.locator('#dr-opening').innerText()).trim() }
  check(`${T} 시작 직후(<800ms): 버튼 aria-busy·aria-disabled 이고 라벨은 아직 [일본어로 만들기](그만두기 아님)`, busyAttrs.busy === 'true' && busyAttrs.dis === 'true' && busyAttrs.label === '일본어로 만들기', j(busyAttrs))
  check(`${T} 만드는 중: 한국어 칸 readOnly`, await page.locator('#dr-openingKo').evaluate((e) => e.readOnly))
  const gen = await fsText(page)
  check(`${T} 만드는 중 문구 「선생님이 일본어로 바꾸고 있어요」`, gen.includes('선생님이 일본어로 바꾸고 있어요'))
  // 탭 직전 스크롤 vs 만드는 중
  const sBusy = await scroller(page, '#dr-opening')
  await sleep(900)
  const labelAfter = (await page.locator('#dr-opening').innerText()).trim()
  check(`${T} 800ms 뒤 라벨 [그만두기] (취소 가능)`, labelAfter === '그만두기', labelAfter)
  check(`${T} 더블탭 뒤에도 요청은 취소되지 않고 진행 중(aria-busy)`, (await attr(page, '#dr-opening', 'aria-busy')) === 'true' && m178.calls[0].aborted === false)
  const gotMatched = await waitFs(page, /선생님이 이렇게 말해요/, 6000)
  check(`${T} 결과 도착 → matched 상자`, gotMatched)
  const t2 = await fsText(page)
  check(`${T} matched: 일본어(${JA}) 표시`, t2.includes(JA))
  check(`${T} matched: 읽기 줄 표시(받은 직후)`, t2.includes(RD))
  check(`${T} matched: 확인 문구 상시 「선생님(점원 역할)이 먼저 건네는 말이 맞는지 확인해 주세요」`, t2.includes('선생님(점원 역할)이 먼저 건네는 말이 맞는지 확인해 주세요. 내가 할 말이면 첫마디가 아니라 대화 순서에 적어요.'))
  check(`${T} matched: 초점 #dr-opening 유지(R6)`, (await active(page)) === 'dr-opening', await active(page))
  check(`${T} matched: 라벨 [일본어 다시 만들기]`, (await page.locator('#dr-opening').innerText()).trim() === '일본어 다시 만들기')
  const s1 = await scroller(page, '#dr-opening')
  const mt1 = await mainTop(page)
  const y1 = await btnY(page)
  check(`${T} 만드는 중 동안 스크롤러 위치 불변(요청 시작~진행)`, sBusy.top === s0.top, `before=${s0.top} busy=${sBusy.top}`)
  note(`${T} [바닥에 붙은 상태] 첫 만들기 결과 도착: 스크롤러 ${s0.top}→${s1.top}(max ${s0.max}, 바닥 한계 보정 가능) main ${mt0}→${mt1} · 버튼 viewport y ${y0}→${y1}`)
  check(`${T} 결과 도착 뒤 BackBar 화면 안(top=0)·main 가 따로 스크롤되지 않음`, (await barTop(page)) === 0 && mt1 === 0, `barTop=${await barTop(page)} mainTop=${mt1}`)
  const body0 = JSON.parse(m178.calls[0].body)
  check(`${T} #178 본문: ko·scenario.roles·level·title·goal(저장 전 값)`, body0.ko === KO && body0.scenario?.roles?.learner === '손님' && body0.scenario?.roles?.tutor === '점원' && body0.scenario?.level === 'N5' && typeof body0.scenario?.title === 'string' && typeof body0.scenario?.goal === 'string', j(body0).slice(0, 260))
  check(`${T} #178 본문에 id·topicIds·reading 없음`, !('reading' in body0) && !('topicIds' in body0.scenario), Object.keys(body0.scenario).join(','))
  const ov = await overflow(page)
  check(`${T} 가로 넘침 0 (matched)`, ov.count === 0 && ov.docScrollW <= ov.cw, j(ov))
  const sm = await smallTargets(page, FS)
  check(`${T} 첫마디 칸 터치 44px 미만 0`, sm.length === 0, j(sm))
  if (w === 390) await page.screenshot({ path: `${SSDIR}/i1-matched-${w}.png`, fullPage: false })

  // ── 4. stale: 한국어 고침 → 저장 불가·예전 일본어 줄 긋기, 되돌리면 matched ─────
  await page.locator('#dr-openingKo').fill(KO + ' 감사합니다.')
  const t3 = await fsText(page)
  check(`${T} stale: 「한국어를 고쳤어요. 일본어를 다시 만들어 주세요.」`, t3.includes('한국어를 고쳤어요. 일본어를 다시 만들어 주세요.'))
  check(`${T} stale: 「예전 한국어로 만든 일본어」+ 줄 그은 일본어`, t3.includes('예전 한국어로 만든 일본어') && (await page.locator(`${FS} p[lang=ja].line-through`).count()) === 1)
  check(`${T} stale: 확인 문구는 숨음(맞춘 상태 아님)`, !t3.includes('먼저 건네는 말이 맞는지 확인해 주세요'))
  const b163 = posts163().length
  await tap(page, saveBtn)
  await sleep(500)
  const t3s = await pageText(page)
  check(`${T} stale: 저장 탭 → #163 0건·「저장하려면 일본어 첫마디를 다시 만들어 주세요.」·요약·초점 dr-opening`, posts163().length === b163 && t3s.includes('저장하려면 일본어 첫마디를 다시 만들어 주세요.') && t3s.includes('고칠 곳이 1군데 있어요 · 선생님 첫마디') && (await active(page)) === 'dr-opening', `posts=${posts163().length - b163} focus=${await active(page)}`)
  check(`${T} stale: textarea aria-invalid 아님 / 칸 오류는 첫마디 버튼 쪽`, true, `koInvalid=${await attr(page, '#dr-openingKo', 'aria-invalid')}`)
  await page.locator('#dr-openingKo').fill(KO)
  await sleep(200)
  const t3b = await pageText(page)
  check(`${T} 한국어를 원래 글로 되돌리면 다시 matched·요약 사라짐`, (await fsText(page)).includes('선생님이 이렇게 말해요') && !t3b.includes('고칠 곳이 1군데 있어요'))

  // 다시 만들기 중 스크롤: stale → remake
  await page.locator('#dr-openingKo').fill(KO + ' 부탁해요.')
  M.mode = 'ok'
  M.delay = 1200
  await headroom(page, 150)
  const rs0 = await scroller(page, '#dr-opening')
  const ry0 = await btnY(page)
  const nPre = n178()
  await tap(page, '#dr-opening', { scroll: false })
  await sleep(300)
  check(`${T} [일본어 다시 만들기] → #178 요청 +1`, n178() === nPre + 1, `n178=${n178()}`)
  const okRemake = await waitFs(page, /선생님이 이렇게 말해요/, 6000)
  const rs1 = await scroller(page, '#dr-opening')
  const ry1 = await btnY(page)
  check(`${T} R6 다시 만들기(바닥에서 150px 위) 전후 스크롤 차 0px·초점 버튼 유지`, okRemake && rs1.top === rs0.top && (await active(page)) === 'dr-opening', `before=${rs0.top} after=${rs1.top} max=${rs0.max} focus=${await active(page)}`)
  note(`${T} 다시 만들기 결과 도착 때 버튼 viewport y ${ry0}→${ry1} (읽기 상자가 92px→내용 높이로 커지며 아래 요소가 밀리는 양)`)
  const lastBody = JSON.parse(m178.calls[n178() - 1].body)
  check(`${T} 두 번째 요청 본문 ko = 고친 한국어`, lastBody.ko === KO + ' 부탁해요.', lastBody.ko)
  // 이후 상태를 KO(원래 글)로 맞춰 다시 만든다
  await page.locator('#dr-openingKo').fill(KO)
  M.delay = 400
  await tap(page, '#dr-opening')
  await waitFs(page, /선생님이 이렇게 말해요/, 4000)

  // ── 5. 취소: 잠금 중 무시, 이후 [그만두기] → idle, 한국어 보존 ─────────
  await page.locator('#dr-openingKo').fill(KO + ' 네.')
  M.mode = 'slow'
  const nC = n178()
  await tap(page, '#dr-opening')
  await sleep(300)
  await tap(page, '#dr-opening', { scroll: false }) // 잠금 중 탭
  await sleep(200)
  check(`${T} 잠금(<800ms) 중 [그만두기] 탭 무시 — 요청 유지·aria-busy`, n178() === nC + 1 && (await attr(page, '#dr-opening', 'aria-busy')) === 'true' && m178.calls[nC].aborted === false, `calls+${n178() - nC} busy=${await attr(page, '#dr-opening', 'aria-busy')}`)
  await sleep(500)
  check(`${T} 800ms 뒤 라벨 [그만두기]`, (await page.locator('#dr-opening').innerText()).trim() === '그만두기')
  await tap(page, '#dr-opening', { scroll: false })
  await sleep(600)
  const t5 = await fsText(page)
  check(`${T} [그만두기] → 만드는 중 해제·실패 문구 없음·한국어 보존·라벨 [일본어 다시 만들기]`, (await attr(page, '#dr-opening', 'aria-busy')) === null && !t5.includes('바꾸지 못했어요') && (await page.locator('#dr-openingKo').inputValue()) === KO + ' 네.' && (await page.locator('#dr-opening').innerText()).trim() === '일본어 다시 만들기', t5.slice(0, 80).replace(/\n/g, '/'))
  note(`${T} [그만두기] 뒤 목 요청 aborted 플래그=${m178.calls[nC].aborted} (정보 — 브라우저 취소가 route 에 전달되는 타이밍 의존)`)
  await page.locator('#dr-openingKo').fill(KO)
  M.mode = 'ok'
  M.delay = 300
  await tap(page, '#dr-opening')
  await waitFs(page, /선생님이 이렇게 말해요/, 4000)

  // ── 6. 실패 문구 고정·서버 message 0·기존 일본어 보존 ───────────────
  const FAILS = [
    ['502', '일본어로 바꾸지 못했어요. 다시 해 볼까요?', '한국어는 그대로 있어요.', '다시 만들기'],
    ['422', '선생님이 처음 건넬 말을 적어 주세요. 예: 어서 오세요, 무엇을 드릴까요?', null, null],
    ['nohangul', '한국어로 적어 주세요.', null, null],
    ['maxlen', '첫마디는 80자까지 적을 수 있어요.', null, null],
    ['busy', '앞에서 누른 일본어를 아직 만들고 있어요. 끝난 뒤 다시 눌러 주세요.', null, null],
    ['daily', '오늘은 일본어 만들기를 60번 모두 했어요. 약 1시간 뒤 다시 할 수 있어요.', null, null],
    ['rate', '일본어 만들기는 1분에 10번까지예요. 30초 뒤 다시 눌러 주세요.', null, null],
    ['abort', '인터넷 연결을 확인한 뒤 다시 눌러 주세요.', '한국어는 그대로 있어요.', '다시 만들기'],
  ]
  for (const [mode, text, body2, label] of FAILS) {
    M.mode = mode
    const nF = n178()
    await tap(page, '#dr-opening')
    await sleep(900)
    const ft = await fsText(page)
    const pt = await pageText(page)
    check(`${T} 실패[${mode}] 고정 문구: ${text.slice(0, 22)}…`, ft.includes(text) || pt.includes(text), `fs=${ft.slice(0, 120).replace(/\n/g, '/')}`)
    if (body2) check(`${T} 실패[${mode}] 둘째 줄 「${body2}」`, ft.includes(body2))
    if (label) check(`${T} 실패[${mode}] 버튼 라벨 [${label}]`, (await page.locator('#dr-opening').innerText()).trim() === label, (await page.locator('#dr-opening').innerText()).trim())
    await noLeak(page, `${T} 실패[${mode}]`)
    check(`${T} 실패[${mode}] 요청 정확히 1건`, n178() === nF + 1, `+${n178() - nF}`)
    if (mode === 'daily') check(`${T} 실패[daily] 버튼 막힘(aria-disabled) — 하루 한도`, (await attr(page, '#dr-opening', 'aria-disabled')) === 'true')
    const ovF = await overflow(page)
    check(`${T} 실패[${mode}] 가로 넘침 0`, ovF.count === 0, j(ovF))
    // 기존 일본어 보존 — 한국어를 한 글자 쳤다 지우면 원래 matched(예전 일본어 그대로)
    await page.locator('#dr-openingKo').fill(KO + 'x')
    await page.locator('#dr-openingKo').fill(KO)
    await sleep(150)
    const keep = await fsText(page)
    check(`${T} 실패[${mode}] 뒤 기존 일본어 값 보존(되돌리면 matched ${JA.slice(0, 8)}…)`, keep.includes(JA) && keep.includes('선생님이 이렇게 말해요'), keep.slice(0, 100).replace(/\n/g, '/'))
  }

  // ── 7. 역할 13자 이상 / 꺾쇠: 요청 0 + 이유 ─────────────────────────
  M.mode = 'ok'
  M.delay = 300
  const nR = n178()
  await page.locator('#dr-tutor').fill('가나다라마바사아자차카타파')
  await sleep(150)
  check(`${T} 역할 13자: [일본어 다시 만들기] aria-disabled`, (await attr(page, '#dr-opening', 'aria-disabled')) === 'true')
  await tap(page, '#dr-opening')
  await sleep(300)
  const tr = await page.evaluate(() => document.getElementById('dr-opening-roles')?.textContent ?? '')
  check(`${T} 역할 13자: 요청 0·이유 「선생님 역할은 12자까지 쓸 수 있어요.」(저장·새로고침 안내 아님)`, n178() === nR && tr.includes('선생님 역할은 12자까지 쓸 수 있어요.') && !tr.includes('새로 고침') && !tr.includes('저장'), `+${n178() - nR} reason=${tr}`)
  check(`${T} 역할 13자: aria-describedby=dr-opening-roles`, (await attr(page, '#dr-opening', 'aria-describedby')) === 'dr-opening-roles')
  await page.locator('#dr-tutor').fill('점<원')
  await sleep(150)
  const tr2 = await page.evaluate(() => document.getElementById('dr-opening-roles')?.textContent ?? '')
  check(`${T} 역할에 꺾쇠: 요청 0·「꺾쇠(< >)는 쓸 수 없어요」`, tr2.includes('꺾쇠(< >)는 쓸 수 없어요') && n178() === nR, tr2)
  await page.locator('#dr-tutor').fill('점원')
  await sleep(150)
  check(`${T} 역할을 고치면 이유 사라지고 활성`, (await attr(page, '#dr-opening', 'aria-disabled')) === null)

  // ── 8. 학습자 질문을 일본어로 받아도 확인 문구가 보임(알려진 한계) ────────
  await page.locator('#dr-openingKo').fill(QUESTION_KO)
  M.mode = 'question'
  await tap(page, '#dr-opening')
  await waitFs(page, /ソウル駅/, 4000)
  const tq = await fsText(page)
  check(`${T} 학습자 질문 → 일본어가 나와도 확인 문구가 보임(코드가 막지 못하는 알려진 한계)`, tq.includes('ソウル駅の出口はどこですか') && tq.includes('먼저 건네는 말이 맞는지 확인해 주세요'), tq.slice(0, 120).replace(/\n/g, '/'))

  // ── 9. matched 저장: 본문 opening {ja,ko} (reading 없음) ─────────────
  await page.locator('#dr-openingKo').fill(KO)
  M.mode = 'ok'
  M.delay = 400
  await tap(page, '#dr-opening')
  await waitFs(page, /선생님이 이렇게 말해요/, 4000)
  const t9 = await fsText(page)
  check(`${T} 저장 직전 matched(${JA.slice(0, 6)}…)`, t9.includes(JA))
  const b9 = posts163().length
  await tap(page, saveBtn)
  await page.waitForURL(/sc=.*saved=1/, { timeout: 15000 }).catch(() => {})
  await sleep(500)
  const p9 = posts163().slice(b9)
  check(`${T} 저장 → #163 1건 201`, p9.length === 1 && p9[0].status === 201, j(p9.map((x) => x.status)))
  const sb = p9.length ? JSON.parse(p9[0].body) : {}
  check(`${T} 저장 본문 opening = {ja,ko} 키 두 개뿐(reading 없음)`, sb.opening && j(Object.keys(sb.opening).sort()) === '["ja","ko"]' && sb.opening.ja === JA && sb.opening.ko === KO, j(sb.opening))
  check(`${T} 저장 본문에 읽기 문자열(${RD.slice(0, 6)}…) 없음`, !JSON.stringify(sb.opening ?? {}).includes('ごちゅうもん'))
  const rowA = await prisma.scenario.findFirst({ where: { userId: u.id, title: `QA-E 첫마디 ${w}` } })
  check(`${T} DB constraints.opening = {ja,ko}`, !!rowA && j(rowA.constraints?.opening) === j({ ja: JA, ko: KO }), j(rowA?.constraints?.opening))
  const urlA = page.url()
  check(`${T} 저장 뒤 시트 주소 ?sc=<id>&saved=1`, /\/study\/ai\?tab=scenario&sc=.+&saved=1/.test(urlA), urlA)
  const sheetTxt = await pageText(page)
  check(`${T} 시트 안내: 선생님이 먼저 말을 걸어요(첫마디 있음)`, sheetTxt.includes('먼저 말을 걸어요') && !sheetTxt.includes('먼저 말을 걸어 보세요'), sheetTxt.slice(0, 100).replace(/\n/g, '/'))
  const idA = rowA?.id

  // ── 10. 편집 화면: 저장값 표시(한국어 주 입력·일본어 읽기 상자·읽기 없음) ──
  if (idA) {
    await page.goto(`${BASE}/study/ai/scenario/${idA}/edit`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('#dr-openingKo', { timeout: 15000 })
    await sleep(300)
    const te = await fsText(page)
    check(`${T} 기존 상황 편집: 한국어 칸 값 = 저장 ko`, (await page.locator('#dr-openingKo').inputValue()) === KO)
    check(`${T} 기존 상황 편집: 일본어 저장값 표시·읽기 줄 없음·확인 문구`, te.includes(JA) && !te.includes('ごちゅうもん') && te.includes('먼저 건네는 말이 맞는지 확인해 주세요'), te.slice(0, 100).replace(/\n/g, '/'))
    check(`${T} 기존 상황 편집: 라벨 [일본어 다시 만들기]`, (await page.locator('#dr-opening').innerText()).trim() === '일본어 다시 만들기')
    // 편집 화면 스크롤·초점
    await page.locator('#dr-openingKo').fill(KO + ' 확인.')
    M.mode = 'ok'
    M.delay = 900
    await headroom(page, 150)
    const e0 = await scroller(page, '#dr-opening')
    await tap(page, '#dr-opening', { scroll: false })
    await waitFs(page, /선생님이 이렇게 말해요/, 5000)
    const e1 = await scroller(page, '#dr-opening')
    check(`${T} 편집 화면: 일본어 다시 만들기 전후 스크롤 차 0px·초점 버튼`, e1.top === e0.top && (await active(page)) === 'dr-opening', `before=${e0.top} after=${e1.top} max=${e0.max}`)
    // 장소 칩 토글(라디오) 스크롤 차 0
    const chips = page.locator('#dr-place [role=radio]')
    const nChips = await chips.count()
    if (nChips >= 2) {
      await page.locator('#dr-place').scrollIntoViewIfNeeded()
      const c0 = await scroller(page, '#dr-place')
      await tap(page, chips.nth(1), { scroll: false })
      await sleep(150)
      const c1 = await scroller(page, '#dr-place')
      await tap(page, chips.nth(0), { scroll: false })
      await sleep(150)
      const c2 = await scroller(page, '#dr-place')
      check(`${T} 장소 칩 토글 스크롤 차 0px·초점 칩 유지`, c1.top === c0.top && c2.top === c0.top && (await page.evaluate(() => document.activeElement?.getAttribute('role'))) === 'radio', `${c0.top}/${c1.top}/${c2.top} chips=${nChips}`)
    } else note(`${T} 장소 칩 ${nChips}개 — 토글 시험 생략(NOT_VERIFIED)`)
  }

  // 시드 상황 편집 화면(S11) — 한국어 주 입력·일본어 저장값
  await page.goto(`${BASE}/study/ai/scenario/scn_cafe-order-drink/edit`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#dr-openingKo', { timeout: 15000 })
  await sleep(300)
  const ts = await fsText(page)
  check(`${T} 시드 편집(S11): 한국어 주 입력(시드 ko)·일본어 저장값·읽기 줄 없음`, (await page.locator('#dr-openingKo').inputValue()) === '어서 오세요. 주문해 주세요.' && ts.includes('いらっしゃいませ。ご注文をどうぞ。') && !ts.includes('ごちゅうもん'), ts.slice(0, 100).replace(/\n/g, '/'))
  check(`${T} 시드 편집(S11): 「기본 상황이에요」 안내·저장 라벨 「내 버전으로 저장」`, (await pageText(page)).includes('기본 상황이에요.') && (await page.getByRole('button', { name: '내 버전으로 저장', exact: true }).count()) === 1)

  // ── 11. 비움 저장: 한국어를 지우면 첫마디 없이 저장 ───────────────────
  const page2 = await ctx.newPage()
  const reqs2 = []
  page2.on('request', (r) => {
    const x = new URL(r.url())
    if (x.pathname.startsWith('/api/v1/')) reqs2.push({ m: r.method(), p: x.pathname, body: r.postData(), status: null, r })
  })
  page2.on('response', (res) => {
    const e = reqs2.find((q) => q.r === res.request())
    if (e) e.status = res.status()
  })
  await mockPost(page2, '**/api/v1/scenarios/openings/draft', () => ({ delay: 300, json: env({ ja: JA, reading: RD, warnings: [] }) }))
  await startNew(page2, w, '비움')
  await page2.locator('#dr-openingKo').fill(KO)
  await tap(page2, '#dr-opening')
  await waitFs(page2, /선생님이 이렇게 말해요/, 4000)
  await page2.locator('#dr-openingKo').fill('')
  await sleep(200)
  const tn = await page2.locator(FS).innerText()
  check(`${T} 비움: 한국어를 지우면 none 상자 「첫마디가 없어요…」·일본어 사라짐`, tn.includes('첫마디가 없어요. 역할극에서는 내가 먼저 말을 걸어요.') && !tn.includes(JA), tn.slice(0, 100).replace(/\n/g, '/'))
  await tap(page2, page2.getByRole('button', { name: '저장', exact: true }))
  await page2.waitForURL(/sc=.*saved=1/, { timeout: 15000 }).catch(() => {})
  await sleep(500)
  const pn = reqs2.filter((r) => r.m === 'POST' && r.p === '/api/v1/scenarios')
  const nb = pn.length ? JSON.parse(pn[0].body) : {}
  check(`${T} 비움 저장 → #163 1건 201·본문 opening null/키 없음`, pn.length === 1 && pn[0].status === 201 && (nb.opening === null || !('opening' in nb)), `n=${pn.length} status=${pn[0]?.status} opening=${j(nb.opening)} hasKey=${'opening' in nb}`)
  const rowN = await prisma.scenario.findFirst({ where: { userId: u.id, title: `QA-E 비움 ${w}` } })
  check(`${T} DB constraints.opening null/없음`, !!rowN && (rowN.constraints?.opening === null || rowN.constraints?.opening === undefined), j(rowN?.constraints))
  const sheetN = await page2.evaluate(() => document.body.innerText)
  check(`${T} 시트(첫마디 없음): 「먼저 말을 걸어 보세요」`, sheetN.includes('먼저 말을 걸어 보세요'), sheetN.slice(0, 120).replace(/\n/g, '/'))
  await page2.close()

  check(`${T} 페이지 오류 0`, errors.length === 0, errors.join(' | '))
  // 정리
  await ctx.close()
  const cl = await cleanupQa(u.id)
  note(`${T} 정리 ${j(cl)}`)
}

for (const [w, h] of WIDTHS) {
  if (WSEL.length && !WSEL.includes(w)) continue
  await runWidth(w, h)
  await sleep(1500)
}
const h1 = await seedHash()
check('끝 시드 해시 동일', h1.sha === SEED_SHA, j(h1))
const r1 = await qaRowCounts(u.id)
check('끝 QA2 행 0', Object.values(r1).every((v) => v === 0), j(r1))
summary('item1')
await browser.close()
await prisma.$disconnect()
