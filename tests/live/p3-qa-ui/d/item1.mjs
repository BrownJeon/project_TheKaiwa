/**
 * qa-045-ui-d 항목 1 — 내 주제 고치기(#171): chunks[].id 보존·글 바뀜·요청 본문·DB 대조·저장 중·나가기. LLM 호출 0.
 * 실행: cd $HOME/.node-local/thekaiwa-qa045ui-d && QA_COOKIE=<c1 쿠키> node --env-file=.env <이 파일>
 */
import {
  afterSave, applyEdit, backBtn, check, cookieOf, doubleTapEl, editorInputs, ids, launch, menuAction, mkTopic10, nonGet, note, openEdit, openPage, prisma, qaRowCounts, qaUser, QA1,
  readChunks, readTopic, retextNotes, rowOf, saveBtn, seedHash, sleep, summary, tapEl, viewPath, WIDTHS, cleanupQa, closeBrowser,
} from './h.mjs'

const cookie = cookieOf(process.env.QA_COOKIE)
const u = await qaUser(QA1)
const seed0 = await seedHash()
note('시드 해시 시작 ' + JSON.stringify(seed0))
const ALLOWED_CHUNK_KEYS = new Set(['chunkType', 'textJa', 'reading', 'meaningKo', 'id'])
const browser = await launch()

for (const [w, h] of WIDTHS) {
  const tag = `[${w}]`
  const created = await mkTopic10(cookie, `QA 고치기 ${w}`)
  if (!created) {
    check(`${tag} 준비: 내 주제 만들기`, false)
    continue
  }
  const T = created.id
  const base = await readChunks(T)
  check(`${tag} 준비: 표현 10개·서버 id 10개`, base.length === 10 && new Set(ids(base)).size === 10)
  const { ctx, page, reqs, errors } = await openPage(browser, w, h, cookie)
  try {
    // ── ⑤ 바뀐 게 없으면 [저장] 요청 0
    await openEdit(page, T)
    let n0 = reqs.length
    await tapEl(page, saveBtn(page))
    await page.waitForURL((x) => x.pathname === viewPath(T), { timeout: 10000 })
    await sleep(500)
    check(`${tag} ⑤ 바뀐 게 없으면 저장 → 쓰기 요청 0건(PATCH {} 없음)·S6 이동`, nonGet(reqs, n0).length === 0, `nonGet=${nonGet(reqs, n0).length}`)
    const t5 = await readTopic(T)
    check(`${tag} ⑤ DB 불변(제목)`, t5.title === `QA 고치기 ${w}`)

    // ── ⑧ 고치지 않았으면 ← 는 시트 없이 이동
    await openEdit(page, T)
    n0 = reqs.length
    await tapEl(page, backBtn(page))
    await page.waitForURL((x) => x.pathname === viewPath(T), { timeout: 10000 })
    const dlgCount = await page.getByRole('dialog').count()
    check(`${tag} ⑧ 고치지 않고 ← → 시트 없이 S6`, dlgCount === 0 && nonGet(reqs, n0).length === 0, `dialogs=${dlgCount}`)

    // ── ⑧ 고친 값이 있으면 나가기 시트·계속 고치기·나가기
    await openEdit(page, T)
    n0 = reqs.length
    const before8 = { t: await readTopic(T), c: await readChunks(T) }
    await page.locator('#tp-title').fill('QA 나갈 값')
    await tapEl(page, backBtn(page))
    const dlg = page.getByRole('dialog')
    await dlg.waitFor({ state: 'visible', timeout: 5000 })
    const dlgText = ((await dlg.innerText()) ?? '').replace(/\s+/g, ' ')
    check(`${tag} ⑧ 고친 뒤 ← → 나가기 시트(제목·본문)`, /나갈까요\?/.test(dlgText) && /나가면 고친 내용은 저장되지 않아요\./.test(dlgText), dlgText.slice(0, 80))
    await dlg.getByRole('button', { name: '계속 고치기', exact: true }).tap()
    await sleep(300)
    check(`${tag} ⑧ [계속 고치기] → 시트 닫힘·고친 값 유지·화면 그대로`, (await page.getByRole('dialog').count()) === 0 && (await page.locator('#tp-title').inputValue()) === 'QA 나갈 값' && page.url().includes('/edit'))
    await tapEl(page, backBtn(page))
    await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 5000 })
    await page.getByRole('dialog').getByRole('button', { name: '나가기', exact: true }).tap()
    await page.waitForURL((x) => x.pathname === viewPath(T), { timeout: 10000 })
    await sleep(500)
    const after8 = { t: await readTopic(T), c: await readChunks(T) }
    check(`${tag} ⑧ [나가기] → 서버 쓰기 0·DB 불변`, nonGet(reqs, n0).length === 0 && after8.t.title === before8.t.title && JSON.stringify(ids(after8.c)) === JSON.stringify(ids(before8.c)) && after8.t.updatedAt.getTime() === before8.t.updatedAt.getTime(), `nonGet=${nonGet(reqs, n0).length} updatedAt 동일=${after8.t.updatedAt.getTime() === before8.t.updatedAt.getTime()}`)

    // ── ① 이름·설명만 고침 → PATCH 본문 title/description 만 · ⑦ 저장 중 ← 비활성·더블탭 1건
    await openEdit(page, T)
    n0 = reqs.length
    await page.route(`**/api/v1/topics/${T}`, async (route) => {
      if (route.request().method() === 'PATCH') await sleep(1500)
      await route.continue()
    })
    await page.locator('#tp-title').fill(`QA 고침 ${w}`)
    await page.locator('#tp-description').fill('QA 설명을 고쳤어요')
    await doubleTapEl(page, saveBtn(page))
    await sleep(500)
    const savingState = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')]
      const save = btns.find((b) => /저장하고 있어요/.test(b.textContent ?? ''))
      const back = document.querySelector('header button')
      return {
        saveBusy: save?.getAttribute('aria-busy') ?? null,
        backDisabled: back?.getAttribute('aria-disabled') ?? null,
        titleRO: document.querySelector('#tp-title')?.hasAttribute('readonly') ?? null,
      }
    })
    check(`${tag} ⑦ 저장 중: [저장] aria-busy·← aria-disabled·이름 칸 잠금`, savingState.saveBusy === 'true' && savingState.backDisabled === 'true' && savingState.titleRO === true, JSON.stringify(savingState))
    await tapEl(page, backBtn(page))
    await sleep(300)
    check(`${tag} ⑦ 저장 중 ← 누름 → 시트·이동 없음`, (await page.getByRole('dialog').count()) === 0 && page.url().includes('/edit'))
    const r1 = await afterSave(page, T)
    await page.unroute(`**/api/v1/topics/${T}`)
    const patches = nonGet(reqs, n0)
    check(`${tag} ⑦ 더블탭 → PATCH 정확히 1건`, patches.length === 1 && patches[0].m === 'PATCH', `n=${patches.length} ${patches.map((p) => p.m).join(',')}`)
    const body1 = patches[0] ? JSON.parse(patches[0].body ?? '{}') : {}
    const keys1 = Object.keys(body1).sort()
    check(`${tag} ① 본문 = 바뀐 칸만(title·description), chunks 없음`, JSON.stringify(keys1) === JSON.stringify(['description', 'title']), `keys=${keys1.join(',')} body=${JSON.stringify(body1).slice(0, 120)}`)
    check(`${tag} ① PATCH 200`, patches[0]?.status === 200, `status=${patches[0]?.status}`)
    const t1 = await readTopic(T)
    const c1 = await readChunks(T)
    check(`${tag} ① DB: 이름·설명 바뀜·표현 id 10개 불변`, t1.title === `QA 고침 ${w}` && t1.description === 'QA 설명을 고쳤어요' && JSON.stringify(ids(c1)) === JSON.stringify(ids(base)))
    check(`${tag} ⑥ 저장 뒤 S6(주소)·토스트·머리 제목 초점`, r1.url.pathname === viewPath(T) && r1.toasts.some((x) => /저장했어요/.test(x)) && r1.active.tag === 'H2' && r1.active.text === `QA 고침 ${w}`, `toasts=${JSON.stringify(r1.toasts)} active=${JSON.stringify(r1.active)} search=${r1.url.search}`)

    // ── ② 뜻만 고친 표현 1개 → chunks 새 전체 목록·id 서버 그대로
    await openEdit(page, T)
    n0 = reqs.length
    await menuAction(page, '学生', '고치기')
    let inp = editorInputs(page, '学生')
    check(`${tag} ② 고치기 펼침: 일본어/읽기/뜻 칸 3개`, (await inp.count()) === 3)
    await inp.nth(2).fill('대학생')
    check(`${tag} ② 뜻만 바꾸면 연습 기록 안내 없음`, (await retextNotes(page)).length === 0)
    await applyEdit(page, '学生')
    await tapEl(page, saveBtn(page))
    const r2 = await afterSave(page, T)
    const p2 = nonGet(reqs, n0)
    const b2 = p2[0] ? JSON.parse(p2[0].body ?? '{}') : {}
    const c2 = await readChunks(T)
    check(`${tag} ② PATCH 1건·본문 키 = chunks 만`, p2.length === 1 && p2[0].m === 'PATCH' && JSON.stringify(Object.keys(b2)) === '["chunks"]', `n=${p2.length} keys=${Object.keys(b2)}`)
    const chunkKeysOk = Array.isArray(b2.chunks) && b2.chunks.every((c) => Object.keys(c).every((k) => ALLOWED_CHUNK_KEYS.has(k)))
    check(`${tag} ② 본문 chunks = 새 전체 목록 10개·`+'`order` 키 없음·허용 키만', Array.isArray(b2.chunks) && b2.chunks.length === 10 && chunkKeysOk, `len=${b2.chunks?.length} keys=${[...new Set((b2.chunks ?? []).flatMap((c) => Object.keys(c)))].join(',')}`)
    const bodyIds = (b2.chunks ?? []).map((c) => c.id)
    check(`${tag} ② 본문 모든 표현 id = 서버가 준 원래 id(순서 그대로)`, JSON.stringify(bodyIds) === JSON.stringify(ids(c1)), `bodyIds==dbBefore=${JSON.stringify(bodyIds) === JSON.stringify(ids(c1))}`)
    const gaku = (b2.chunks ?? []).find((c) => c.textJa === '学生')
    check(`${tag} ② 고친 표현: 뜻 '대학생'·id 유지`, gaku?.meaningKo === '대학생' && gaku?.id === c1.find((x) => x.textJa === '学生')?.id)
    check(`${tag} ② DB: 표현 id 목록 저장 전후 동일·뜻만 바뀜`, JSON.stringify(ids(c2)) === JSON.stringify(ids(c1)) && c2.find((x) => x.textJa === '学生')?.meaningKo === '대학생' && c2.filter((x, i) => x.meaningKo !== c1[i].meaningKo).length === 1)
    check(`${tag} ② 저장 성공 → S6`, r2.url.pathname === viewPath(T) && r2.toasts.some((x) => /저장했어요/.test(x)))

    // ── ③ 일본어 글 바꿈 안내
    await openEdit(page, T)
    n0 = reqs.length
    // 새 표현 편집기에도 안내가 없어야 한다(편집기는 한 번에 하나라 행 편집기를 열기 전에 먼저 본다)
    await page.getByRole('button', { name: '＋ 표현 더하기', exact: true }).tap()
    await sleep(250)
    const newEditor = page.locator('section[aria-labelledby=tp-chunks-h] > div.rounded-xl input[type=text]')
    const newCount = await newEditor.count()
    if (newCount === 3) {
      await newEditor.nth(0).fill('先生です')
      const notesNew = await retextNotes(page)
      check(`${tag} ③ 새로 더한 표현엔 안내 없음(글을 입력해도)`, notesNew.length === 0, `notes=${notesNew.length}`)
      await page.locator('section[aria-labelledby=tp-chunks-h] > div.rounded-xl').getByRole('button', { name: '취소', exact: true }).tap()
      await sleep(250)
    } else {
      check(`${tag} ③ 새 표현 편집기 찾기`, false, `inputs=${newCount}`)
    }
    await menuAction(page, '勉強しています', '고치기')
    inp = editorInputs(page, '勉強しています')
    check(`${tag} ③ 펼친 직후(글 그대로) 안내 없음`, (await retextNotes(page)).length === 0)
    await inp.nth(0).fill('運動しています')
    let notes = await retextNotes(page)
    check(`${tag} ③ 글을 바꾸면 그 표현 펼침 안에만 안내 1개(role=note)`, notes.length === 1 && notes[0].vis && notes[0].inRow && notes[0].text.includes('일본어 글을 바꾸면 이 표현의 연습 기록이 처음부터 다시 시작돼요.'), JSON.stringify(notes))
    const described = await page.evaluate(() => {
      const el = [...document.querySelectorAll('li input[type=text]')].find((i) => i.value === '運動しています')
      const d = el?.getAttribute('aria-describedby') ?? ''
      return { d, ok: d.split(' ').some((id) => document.getElementById(id)?.getAttribute('role') === 'note') }
    })
    check(`${tag} ③ 일본어 칸 aria-describedby 가 안내(role=note)를 가리킴`, described.ok, described.d)
    await inp.nth(0).fill('勉強しています')
    check(`${tag} ③ 원래 글로 되돌리면 안내 사라짐`, (await retextNotes(page)).length === 0)
    await inp.nth(0).fill('勉強しています ') // 공백만 추가 — 정규화 기준 같은 글
    check(`${tag} ③ 공백만 달라도 안내 없음(서버와 같은 정규화)`, (await retextNotes(page)).length === 0)
    await inp.nth(0).fill('勉強しています')
    await inp.nth(1).fill('べんきょうしています。')
    await inp.nth(2).fill('공부하는 중이에요')
    await rowOf(page, '勉強しています').getByRole('radio', { name: '느낌', exact: false }).tap().catch(() => {})
    check(`${tag} ③ 읽기·뜻·종류만 바꾸면 안내 없음`, (await retextNotes(page)).length === 0)
    await rowOf(page, '勉強しています').getByRole('radio', { name: '액션', exact: false }).tap().catch(() => {})
    // 관찰: 행 편집기에 값을 적던 중 [＋ 표현 더하기] 를 누르면 그 편집기가 말없이 닫히는지
    await inp.nth(0).fill('運動しています')
    await page.getByRole('button', { name: '＋ 표현 더하기', exact: true }).tap()
    await sleep(250)
    const rowEditorStill = await editorInputs(page, '勉強しています').count()
    note(`${tag} 관찰: 고치던 행 편집기에서 [＋ 표현 더하기] → 행 편집기 입력칸 ${rowEditorStill}개 남음(0이면 말없이 닫힘·적던 값 폐기)`)
    await page.locator('section[aria-labelledby=tp-chunks-h] > div.rounded-xl').getByRole('button', { name: '취소', exact: true }).tap()
    await sleep(250)
    await menuAction(page, '勉強しています', '고치기')
    inp = editorInputs(page, '勉強しています')
    // 글 바꿔 저장 → 옛 행 삭제 + 새 id
    await inp.nth(0).fill('運動しています')
    await inp.nth(1).fill('うんどうしています')
    await inp.nth(2).fill('운동하고 있어요')
    await applyEdit(page, '勉強しています')
    await tapEl(page, saveBtn(page))
    const r3 = await afterSave(page, T)
    const p3 = nonGet(reqs, n0)
    const b3 = p3[0] ? JSON.parse(p3[0].body ?? '{}') : {}
    const c3 = await readChunks(T)
    const oldId = c2.find((x) => x.textJa === '勉強しています').id
    const kept = c2.filter((x) => x.textJa !== '勉強しています').map((x) => x.id)
    const bodyWithOld = (b3.chunks ?? []).find((c) => c.textJa === '運動しています')
    check(`${tag} ③ 본문: 글 바꾼 표현도 옛 id 를 싣고 간다(서버가 새 id 결정)`, p3.length === 1 && bodyWithOld?.id === oldId, `bodyId==old=${bodyWithOld?.id === oldId}`)
    const newRow = c3.find((x) => x.textJa === '運動しています')
    check(`${tag} ③ DB: 글 바뀐 표현 = 옛 행 삭제 + 새 id`, !!newRow && newRow.id !== oldId && !c3.some((x) => x.id === oldId) && newRow.meaningKo === '운동하고 있어요')
    check(`${tag} ③ DB: 나머지 9개 id 유지`, kept.every((k) => c3.some((x) => x.id === k)) && c3.length === 10, `kept=${kept.filter((k) => c3.some((x) => x.id === k)).length}/9 total=${c3.length}`)
    check(`${tag} ③ 저장 성공 → S6`, r3.url.pathname === viewPath(T))

    // ── ④ 지우기·순서(위로)·새 표현 더하기
    await openEdit(page, T)
    n0 = reqs.length
    const pre4 = await readChunks(T)
    await menuAction(page, '好きです', '지우기')
    await menuAction(page, '会社員', '위로')
    await page.getByRole('button', { name: '＋ 표현 더하기', exact: true }).tap()
    await sleep(250)
    const addBox = page.locator('section[aria-labelledby=tp-chunks-h] > div.rounded-xl')
    const ai = addBox.locator('input[type=text]')
    await ai.nth(0).fill('先生')
    await ai.nth(1).fill('せんせい')
    await ai.nth(2).fill('선생님')
    await addBox.getByRole('button', { name: '바꾸기', exact: true }).tap()
    await sleep(250)
    await tapEl(page, saveBtn(page))
    const r4 = await afterSave(page, T)
    const p4 = nonGet(reqs, n0)
    const b4 = p4[0] ? JSON.parse(p4[0].body ?? '{}') : {}
    const c4 = await readChunks(T)
    // 기대 배열: pre4 에서 好きです 제거, 会社員 을 같은 종류 바로 앞(学生)과 자리 바꿈, 끝에 새 표현
    const exp = pre4.filter((x) => x.textJa !== '好きです')
    const iK = exp.findIndex((x) => x.textJa === '会社員')
    const iPrev = (() => {
      for (let k = iK - 1; k >= 0; k--) if (exp[k].chunkType === exp[iK].chunkType) return k
      return -1
    })()
    if (iPrev >= 0) [exp[iPrev], exp[iK]] = [exp[iK], exp[iPrev]]
    const expIds = [...ids(exp), undefined]
    const bIds = (b4.chunks ?? []).map((c) => c.id)
    check(`${tag} ④ 본문: PATCH 1건·chunks 만·order 키 없음`, p4.length === 1 && JSON.stringify(Object.keys(b4)) === '["chunks"]' && (b4.chunks ?? []).every((c) => Object.keys(c).every((k) => ALLOWED_CHUNK_KEYS.has(k))), `n=${p4.length} keys=${Object.keys(b4)}`)
    check(`${tag} ④ 본문 id 열 = [남은 기존 9개(순서 바뀜 반영)] + 새 표현(id 없음)`, JSON.stringify(bIds) === JSON.stringify(expIds), `body=${bIds.length} exp=${expIds.length} 같음=${JSON.stringify(bIds) === JSON.stringify(expIds)}`)
    check(`${tag} ④ 본문에 지운 표현(好きです) id 없음`, !(b4.chunks ?? []).some((c) => c.id === pre4.find((x) => x.textJa === '好きです').id))
    const newBody = (b4.chunks ?? []).find((c) => c.textJa === '先生')
    check(`${tag} ④ 새 표현은 id 키 자체가 없음`, !!newBody && !('id' in newBody))
    check(`${tag} ④ DB: 지운 표현 삭제·새 표현 1행·남은 9개 id 유지`, !c4.some((x) => x.textJa === '好きです') && c4.some((x) => x.textJa === '先生') && exp.every((x) => c4.some((y) => y.id === x.id)) && c4.length === 10, `len=${c4.length}`)
    check(`${tag} ④ DB 순서 = 본문 배열 순서(order 열)`, JSON.stringify(c4.map((x) => x.textJa)) === JSON.stringify((b4.chunks ?? []).map((c) => c.textJa)), c4.map((x) => x.textJa).join('|').slice(0, 80))
    check(`${tag} ④ 저장 성공 → S6`, r4.url.pathname === viewPath(T))
  } catch (e) {
    check(`${tag} 시나리오 예외 없음`, false, String(e).slice(0, 300))
  } finally {
    check(`${tag} 페이지 오류 0`, errors.length === 0, errors.join(' / ').slice(0, 200))
    await ctx.close().catch(() => {})
    await prisma.conversationTopic.deleteMany({ where: { id: T, userId: u.id } })
  }
}

await closeBrowser(browser)
const seed1 = await seedHash()
check('시드 해시 불변', seed1.sha === seed0.sha && seed1.sha === 'e826f3ef09237a9c', `${seed0.sha} → ${seed1.sha}`)
const left = await qaRowCounts(u.id)
check('QA1 task-045 행 0(정리)', left.topics === 0 && left.overrides === 0 && left.scenarios === 0 && left.challenges === 0, JSON.stringify(left))
summary('item1')
await prisma.$disconnect()
