/** qa-045-b2 — #177 오류 계약(LLM 0) + #166 인라인 주제·가린 시드 거절 + fix3(상황 삭제 멱등·ARCHIVED). 직렬.
 *  사용법: SP=<scratchpad> node item5-b2.mjs <cookie1> <cookie4> <log>   (계정 1 이 쓰고, 계정 4 는 남의 id 404 확인용만)
 *  정리: 끝에 만든 상황·채팅·(숨긴 주제 되돌리기)를 지운다. 만든 id 는 출력한다. */
import { readFileSync } from 'node:fs'
import { api, cookieOf, makePacer, check, summary, pct, claudeProcs, errCode, reason, sleep } from './lib.mjs'
const [, , f1, f4, log] = process.argv
const c1 = cookieOf(f1)
const c4 = cookieOf(f4)
const DEV = `${process.env.SP}/qa045b-dev.log`
const nCalls = () => (readFileSync(DEV, 'utf8').match(/claudeCli\] 완료/g) ?? []).length
const j = (x) => JSON.stringify(x)
const det = (r) => r.json?.data?.details ?? r.json?.details ?? null
const created = { scenarios: [], chats: [], hiddenTopics: [] }
const pace = makePacer(6)

async function main() {
  const start = nCalls()
  console.log('calls at start', start, 'claude procs', claudeProcs())

  // ── 준비: 계정 1 이 N1 내 상황 1개 저장(#163, 시드 카페를 바탕으로 레벨만 N1)
  const baseR = await api(c1, 'GET', '/api/v1/scenarios/scn_cafe-order-drink')
  const base = baseR.json.data
  const mk = async (title, level) => {
    const r = await api(c1, 'POST', '/api/v1/scenarios', {
      title, titleJa: base.titleJa, description: 'QA b2 상황', level, difficulty: base.difficulty, roles: base.roles,
      goal: { communicativeGoalKo: base.goal.communicativeGoalKo, successCriteria: base.goal.successCriteria },
      steps: base.steps.map((s) => ({ ko: s.ko })), keyExpressions: base.keyExpressions.map((e) => ({ ja: e.ja, reading: e.reading, ko: e.ko })),
      requiredExpressions: base.requiredExpressions, ...(base.opening ? { opening: base.opening } : {}), topicIds: (base.topics ?? []).map((t) => t.id),
    })
    if (r.status !== 201) console.log('mk FAIL', r.status, r.raw.slice(0, 300))
    else created.scenarios.push(r.json.data.id)
    return r
  }
  const rN1 = await mk('QA b2 상황 N1', 'N1')
  const S = rN1.json?.data?.id
  check('준비: 내 상황(N1) 저장 201', rN1.status === 201 && !!S, `status=${rN1.status} level=${rN1.json?.data?.level} id=${S}`)
  if (!S) return

  // ── 1. #177 오류 계약 — LLM 0회여야 한다
  const callsA = nCalls()
  const V = `/api/v1/scenarios/${S}/variants/drafts`
  const cases = [
    ['E1 axes 비어 있음', c1, V, { axes: {} }, 422, 'NO_VARIATION'],
    ['E2 전부 same/none', c1, V, { axes: { persona: 'same', twist: 'none', flow: 'same', level: 'same' } }, 422, 'NO_VARIATION'],
    ['E3 N1 에서 level=up 단독', c1, V, { axes: { level: 'up' } }, 422, 'NO_VARIATION'],
    ['E4 본문 비어 있음 {}', c1, V, {}, 400, null],
    ['E5 열거 밖 값 persona=zzz', c1, V, { axes: { persona: 'zzz' } }, 400, null],
    ['E6 그 밖 키 foo', c1, V, { axes: { twist: 'trouble' }, foo: 1 }, 400, null],
    ['E7 note 101자', c1, V, { axes: { twist: 'trouble' }, note: 'ㄱ'.repeat(101) }, 400, null],
    ['E8 note 꺾쇠', c1, V, { axes: { twist: 'trouble' }, note: '<img src=x onerror=alert(1)>' }, 400, null],
    ['E9 본문이 배열', c1, V, [1], 400, null],
    ['E10 없는 상황 id', c1, '/api/v1/scenarios/scn_nope-xyz/variants/drafts', { axes: { twist: 'trouble' } }, 404, null],
    ['E11 남의 상황 id(계정 4 → 계정 1 의 상황)', c4, V, { axes: { twist: 'trouble' } }, 404, null],
  ]
  for (const [id, ck, path, body, st, why] of cases) {
    const r = await api(ck, 'POST', path, body, { log })
    check(`#177 ${id} → ${st}${why ? ' ' + why : ''}`, r.status === st && (!why || reason(r) === why || errCode(r) === why || r.raw.includes(why)), `status=${r.status} code=${errCode(r)} reason=${reason(r)} details=${j(det(r))} msg=${r.json?.message}`)
  }
  const rNo = await fetch(`http://127.0.0.1:3046${V}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: j({ axes: { twist: 'trouble' } }) })
  check('#177 E12 쿠키 없음 → 401', rNo.status === 401, `status=${rNo.status}`)
  check('#177 오류 11+1건이 Claude 를 부르지 않음', nCalls() === callsA, `calls ${callsA} -> ${nCalls()}`)

  // ── 2. fix3 — 역할극 시작(저장된 opening, LLM 0) → 상황 삭제 멱등 → ARCHIVED
  const rp = await api(c1, 'POST', '/api/v1/chats', { kind: 'TALK', scenarioId: S }, { log })
  const chatId = rp.json?.data?.id ?? rp.json?.data?.chat?.id
  if (chatId) created.chats.push(chatId)
  check('fix3 역할극 시작(TALK+scenarioId) 201·LLM 0', (rp.status === 201 || rp.status === 200) && !!chatId && nCalls() === callsA, `status=${rp.status} id=${chatId} calls=${nCalls()} keys=${Object.keys(rp.json?.data ?? {}).join()}`)
  const del1 = await api(c1, 'DELETE', `/api/v1/scenarios/${S}`, undefined, { log })
  check('fix3 삭제 1번째 200(alreadyArchived 아님)', del1.status === 200 && !del1.json?.data?.alreadyArchived, `status=${del1.status} ${del1.raw.slice(0, 200)}`)
  const rp2 = await api(c1, 'POST', '/api/v1/chats', { kind: 'TALK', scenarioId: S }, { log })
  if (rp2.json?.data?.id) created.chats.push(rp2.json.data.id)
  check('fix3 지운 상황으로 역할극 시작 → 409 ARCHIVED', rp2.status === 409 && (reason(rp2) === 'ARCHIVED' || errCode(rp2) === 'ARCHIVED'), `status=${rp2.status} code=${errCode(rp2)} reason=${reason(rp2)} ${rp2.raw.slice(0, 200)}`)
  const del2 = await api(c1, 'DELETE', `/api/v1/scenarios/${S}`, undefined, { log })
  check('fix3 삭제 2번째 → 200 alreadyArchived:true(404 아님)', del2.status === 200 && del2.json?.data?.alreadyArchived === true, `status=${del2.status} ${del2.raw.slice(0, 200)}`)
  const callsB = nCalls()
  const les = await api(c1, 'POST', '/api/v1/lessons', { scenarioId: S }, { log })
  check('fix3 상황 수업 #59 지운 상황 → 409 ARCHIVED·LLM 전 거절', les.status === 409 && (reason(les) === 'ARCHIVED' || errCode(les) === 'ARCHIVED') && nCalls() === callsB, `status=${les.status} code=${errCode(les)} reason=${reason(les)} calls=${callsB}->${nCalls()} ${les.raw.slice(0, 200)}`)
  const g = await api(c1, 'GET', `/api/v1/scenarios/${S}`)
  check('fix3 지운 상황 상세(GET) → 404', g.status === 404, `status=${g.status} code=${errCode(g)} reason=${reason(g)}`)
  const vv = await api(c1, 'POST', V, { axes: { twist: 'trouble' } }, { log })
  check('#177 지운 상황을 기준으로 → 404·LLM 0', vv.status === 404 && nCalls() === callsB, `status=${vv.status} code=${errCode(vv)} reason=${reason(vv)} calls=${nCalls()}`)

  // ── 3. ④ 일반 TALK/CHAT(상황 없이) 채팅 생성
  const callsC = nCalls()
  for (const kind of ['TALK', 'CHAT']) {
    const r = await api(c1, 'POST', '/api/v1/chats', { kind }, { log })
    const id = r.json?.data?.id ?? r.json?.data?.chat?.id
    if (id) created.chats.push(id)
    check(`④ 일반 ${kind} 채팅 생성 201`, (r.status === 201 || r.status === 200) && !!id, `status=${r.status} id=${id} ${r.raw.slice(0, 160)}`)
  }
  await sleep(1500)
  check('④ 채팅 생성만으로 Claude 호출 0(또는 보고)', nCalls() === callsC, `calls ${callsC} -> ${nCalls()} procs=${claudeProcs()}`)

  // ── 4. #166 인라인 주제·가린 시드 거절
  const d1 = nCalls()
  const bad = await api(c1, 'POST', '/api/v1/scenarios/drafts', { description: '병원에서 접수하고 증상을 설명하는 상황', level: 'N4', topic: { title: '병원 진료', titleJa: '病院' }, topicId: 'cmx' }, { log })
  check('#166 topic+topicId 동시 → 400 topic/conflict·LLM 0', bad.status === 400 && det(bad)?.field === 'topic' && det(bad)?.reason === 'conflict' && nCalls() === d1, `status=${bad.status} ${j(det(bad))}`)
  await pace()
  const inl = await api(c1, 'POST', '/api/v1/scenarios/drafts', { description: '병원에서 접수하고 증상을 설명하는 상황', level: 'N4', topic: { title: '병원 진료', titleJa: '病院' } }, { log })
  const dr = inl.json?.data?.draft
  check('#166 인라인 주제 「병원 진료」 → 200 초안', inl.status === 200 && !!dr, `status=${inl.status} ${inl.ms}ms code=${errCode(inl)}`)
  if (dr) {
    console.log(`  166 draft title=${dr.title}/${dr.titleJa} level=${dr.level} roles=${dr.roles.learner}/${dr.roles.tutor} topicIds=${j(dr.topicIds)} opening=${dr.opening?.ja}`)
    console.log(`  166 steps=${dr.steps.map((s) => s.ko).join(' | ')} expr=${dr.keyExpressions.map((e) => e.ja).join(' ; ')}`)
    check('#166 초안에 표현 id·엔진명 없음·인라인 주제는 topicIds 로 새지 않음', dr.keyExpressions.every((e) => e.id === undefined) && !/claude|sonnet|haiku|systemSha/i.test(inl.raw) && (dr.topicIds ?? []).length === 0, `topicIds=${j(dr.topicIds)}`)
  }
  const tl = await api(c1, 'GET', '/api/v1/topics?level=all')
  const seed = (tl.json?.data?.items ?? []).find((t) => t.isSeed ?? t.seed ?? !t.mine) ?? (tl.json?.data?.items ?? [])[0]
  console.log('  seed topic pick', j({ id: seed?.id, title: seed?.title, keys: Object.keys(seed ?? {}) }))
  const SID = seed?.id
  const hid = await api(c1, 'DELETE', `/api/v1/topics/${SID}?ack=none`, undefined, { log })
  if (hid.status === 200) created.hiddenTopics.push(SID)
  check('#166 준비: 계정 1 이 시드 주제를 가림(DELETE) 200', hid.status === 200, `status=${hid.status} ${hid.raw.slice(0, 300)}`)
  const d2 = nCalls()
  const ns = await api(c1, 'POST', '/api/v1/scenarios/drafts', { description: '카페에서 음료를 주문하는 상황', level: 'N5', topicId: SID }, { log })
  check('#166 가린 시드 id → 400 topicId/not_linked·LLM 전 거절(호출 수 불변)', ns.status === 400 && det(ns)?.field === 'topicId' && det(ns)?.reason === 'not_linked' && nCalls() === d2, `status=${ns.status} ${j(det(ns))} calls ${d2}->${nCalls()}`)
  const rs = await api(c1, 'POST', '/api/v1/seed-overrides/restore', { kind: 'TOPIC', seedId: SID }, { log })
  if (rs.status === 200) created.hiddenTopics = created.hiddenTopics.filter((x) => x !== SID)
  check('#166 되돌리기(restore) 200', rs.status === 200, `status=${rs.status} ${rs.raw.slice(0, 200)}`)
  await pace()
  const ok2 = await api(c1, 'POST', '/api/v1/scenarios/drafts', { description: '카페에서 음료를 주문하는 상황', level: 'N5', topicId: SID }, { log })
  check('#166 되돌린 뒤 같은 topicId → 200 초안', ok2.status === 200 && !!ok2.json?.data?.draft, `status=${ok2.status} ${ok2.ms}ms code=${errCode(ok2)} reason=${reason(ok2)} topicIds=${j(ok2.json?.data?.draft?.topicIds)}`)

  // ── 정리
  for (const id of created.chats) { const r = await api(c1, 'DELETE', `/api/v1/chats/${id}`); console.log('cleanup chat', id, r.status) }
  for (const id of created.hiddenTopics) { const r = await api(c1, 'POST', '/api/v1/seed-overrides/restore', { kind: 'TOPIC', seedId: id }); console.log('cleanup restore', id, r.status) }
  console.log('CREATED', j(created), 'calls total new in this script =', nCalls() - start)
}
await main().catch((e) => { console.log('SCRIPT ERROR', e?.stack ?? e); console.log('CREATED(on error)', j(created)) })
summary()
