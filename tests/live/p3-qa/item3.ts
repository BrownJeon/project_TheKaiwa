/**
 * 항목 3 — 내 버전(사본) 주제의 삭제(#172 delete 미리보기 ↔ #173) vs 되돌리기(#172 restore 미리보기 ↔ #176). QA 계정 3 전용, LLM 0회.
 * A: 삭제 경로(상황 2개) · B: 되돌리기 경로(같은 구성) · C: 진행 중·완료·그만둔 챌린지가 사본 주제에 있을 때 삭제·되돌리기 양쪽.
 */
import { api, check, cleanupQa, code, cookieOf, data, details, prisma, qaRowCounts, qaUser, QA3, seedHash, sleep, summary } from './common'
const T_CAFE = 'cmuihjozt000dw1dgeo2on2uf'
const T_ROAD = 'cmuihjs9h000qw1dgthvl3fxn'
const SEED_SC = 'scn_cafe-order-drink'
const refIds = (a: any) => (Array.isArray(a) ? a.map((x: any) => x.id).sort() : null)
const j = (v: unknown) => JSON.stringify(v)
const todayKst = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
const dayDate = (offset: number) => { const d = new Date(todayKst() + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + offset); return d }

async function main() {
  const c3 = cookieOf(process.env.QA_COOKIE!)
  const u3 = await qaUser(QA3)
  await cleanupQa(u3.id)
  const h0 = await seedHash()
  console.log('seedHash start', j(h0))
  const base = data(await api(c3, 'GET', `/api/v1/scenarios/${SEED_SC}`))
  const mkScenario = async (title: string, topicIds: string[]) => {
    const r = await api(c3, 'POST', '/api/v1/scenarios', {
      title, titleJa: base.titleJa, description: 'QA 상황', level: base.level, difficulty: base.difficulty, roles: base.roles,
      goal: { communicativeGoalKo: base.goal.communicativeGoalKo, successCriteria: base.goal.successCriteria },
      steps: base.steps.map((s: any) => ({ ko: s.ko })), keyExpressions: base.keyExpressions.map((e: any) => ({ ja: e.ja, reading: e.reading, ko: e.ko })),
      requiredExpressions: base.requiredExpressions, ...(base.opening ? { opening: base.opening } : {}), topicIds,
    })
    if (r.status !== 201) console.log('mkScenario FAIL', r.status, j(r.body).slice(0, 300))
    return data(r)?.id as string
  }
  const forkTopic = async () => { const r = await api(c3, 'POST', `/api/v1/topics/${T_CAFE}/fork`, {}); if (r.status !== 201) console.log('fork FAIL', r.status, j(r.body).slice(0, 300)); return data(r)?.copyId as string }
  const links = async (scId: string) => (await prisma.scenarioTopic.findMany({ where: { scenarioId: scId } })).map((x) => x.topicId).sort()

  // ───────── A. 삭제 경로 ─────────
  const C = await forkTopic()
  const A = await mkScenario('QA 상황 A(사본 주제에만)', [C])
  const B = await mkScenario('QA 상황 B(사본+길 묻기)', [C, T_ROAD])
  check('A-준비: 사본 주제·내 상황 2개 저장(장소는 사본 id, #163)', !!C && !!A && !!B && j(await links(A)) === j([C]) && j(await links(B)) === j([C, T_ROAD].sort()), `C=${!!C} A=${!!A} B=${!!B} linksA=${j(await links(A))} linksB=${j(await links(B))}`)
  const pv = await api(c3, 'GET', `/api/v1/topics/${C}/removal`)
  const p = data(pv)
  console.log('INFO removal preview(A) =', j(p).slice(0, 1400))
  check('A-#172 미리보기 200·isSeedCopy·ack=none·진행 챌린지 없음', pv.status === 200 && p?.isSeedCopy === true && p?.ack === 'none' && p?.activeChallenge === null && p?.isSeed === false, `status=${pv.status}`)
  check('A-#172 delete: 보관될 상황 = [A]·연결만 끊길 상황 = [B]·되돌려 붙을 상황 0', j(refIds(p?.delete?.scenariosArchived)) === j([A]) && j(refIds(p?.delete?.scenariosUnlinked)) === j([B]) && (p?.delete?.scenariosRelinked ?? []).length === 0, `archived=${j(refIds(p?.delete?.scenariosArchived))} unlinked=${j(refIds(p?.delete?.scenariosUnlinked))} relinked=${j(refIds(p?.delete?.scenariosRelinked))}`)
  check('A-#172 맨 위 값 = delete 와 같음, restore 칸은 존재(내 버전)', j(refIds(p?.scenariosArchived)) === j(refIds(p?.delete?.scenariosArchived)) && j(refIds(p?.scenariosUnlinked)) === j(refIds(p?.delete?.scenariosUnlinked)) && p?.restore !== null, `restore=${p?.restore === null ? 'null' : 'obj'}`)
  const pvOther = await api(c3, 'GET', `/api/v1/topics/${T_CAFE}/removal`)
  check('A-#172 시드 id 미리보기: isSeed=true·목록 전부 빈 배열·restore null', pvOther.status === 200 && data(pvOther)?.isSeed === true && (data(pvOther)?.scenariosArchived ?? []).length === 0 && data(pvOther)?.restore === null, `status=${pvOther.status}`)
  const pv404 = await api(c3, 'GET', `/api/v1/topics/does_not_exist_9/removal`)
  check('A-#172 없는 id → 404 TOPIC_GONE', pv404.status === 404 && details(pv404)?.reason === 'TOPIC_GONE', `status=${pv404.status} ${j(details(pv404))}`)
  const delNo = await api(c3, 'DELETE', `/api/v1/topics/${C}`)
  check('A-#173 ack 없음 → 409', delNo.status === 409, `status=${delNo.status} code=${code(delNo)} ${j(details(delNo))?.slice(0, 120)}`)
  const delBadFmt = await api(c3, 'DELETE', `/api/v1/topics/${C}?ack=${encodeURIComponent('<x>')}`)
  check('A-#173 ack 형식 오류 → 400 field=ack', delBadFmt.status === 400 && details(delBadFmt)?.field === 'ack', `status=${delBadFmt.status} ${j(details(delBadFmt))}`)
  const delWrong = await api(c3, 'DELETE', `/api/v1/topics/${C}?ack=ckzzzzzzzzzzzzzzzzzzzzzzz`)
  check('A-#173 ack 가 서버 판단과 다름(없는 챌린지 id) → 409 IMPACT_CHANGED + details.preview', delWrong.status === 409 && details(delWrong)?.reason === 'IMPACT_CHANGED' && !!details(delWrong)?.preview, `status=${delWrong.status} reason=${details(delWrong)?.reason} preview=${!!details(delWrong)?.preview}`)
  const mid = await qaRowCounts(u3.id)
  check('A-#173 409·400 뒤 주제 사본·상황·연결 그대로(쓰기 0)', (await prisma.conversationTopic.count({ where: { id: C } })) === 1 && (await prisma.scenario.count({ where: { id: A, status: 'ACTIVE' } })) === 1 && j(await links(B)) === j([C, T_ROAD].sort()), j(mid))
  const del = await api(c3, 'DELETE', `/api/v1/topics/${C}?ack=none`)
  const dd = data(del)
  console.log('INFO delete result =', j(dd))
  check('A-#173 ack=none → 200 REMOVED·mode DELETE·seedId=시드·챌린지 삭제 없음', del.status === 200 && dd?.result === 'REMOVED' && dd?.mode === 'DELETE' && dd?.seedId === T_CAFE && dd?.challengeDeleted === false && dd?.deletedChallengeId === null, `status=${del.status}`)
  check('A-미리보기 ↔ 실제 일치: 보관 1·끊김 1·되돌려 붙음 0', dd?.scenariosArchived === (p?.delete?.scenariosArchived ?? []).length && dd?.scenariosUnlinked === (p?.delete?.scenariosUnlinked ?? []).length && dd?.scenariosRelinked === 0, `preview ${(p?.delete?.scenariosArchived ?? []).length}/${(p?.delete?.scenariosUnlinked ?? []).length} actual ${dd?.scenariosArchived}/${dd?.scenariosUnlinked}/${dd?.scenariosRelinked}`)
  const aRow = await prisma.scenario.findUnique({ where: { id: A } })
  const bRow = await prisma.scenario.findUnique({ where: { id: B } })
  check('A-DB: 사본에만 붙은 A = ARCHIVED, B = ACTIVE 유지', aRow?.status === 'ARCHIVED' && bRow?.status === 'ACTIVE', `A=${aRow?.status} B=${bRow?.status}`)
  check('A-DB: B 의 연결만 끊김 — (B,사본) 제거·(B,길 묻기) 유지, A 연결 0, 사본 주제·조각 삭제', j(await links(B)) === j([T_ROAD]) && (await links(A)).length === 0 && (await prisma.conversationTopic.count({ where: { id: C } })) === 0 && (await prisma.topicChunk.count({ where: { topicId: C } })) === 0, `linksB=${j(await links(B))}`)
  const ovA = await prisma.userSeedOverride.findMany({ where: { userId: u3.id, kind: 'TOPIC' } })
  check('A-DB: override copyId=null 로 남아 시드는 숨김 유지', ovA.length === 1 && ovA[0].seedId === T_CAFE && ovA[0].copyId === null, j(ovA.map((o) => [o.seedId, o.copyId])))
  const listA = data(await api(c3, 'GET', '/api/v1/topics?level=all'))?.items.map((t: any) => t.id)
  check('A-QA3 #56: 시드·사본 모두 목록에 없음(시드 숨김 유지)', !listA.includes(T_CAFE) && !listA.includes(C), `ids=${listA.length}`)
  const ovList = data(await api(c3, 'GET', '/api/v1/seed-overrides?kind=TOPIC'))?.items ?? []
  check('A-#179: HIDDEN·copyId null·orphan false', ovList.length === 1 && ovList[0].state === 'HIDDEN' && ovList[0].copyId === null && ovList[0].orphan === false, j(ovList))
  const del2 = await api(c3, 'DELETE', `/api/v1/topics/${C}?ack=none`)
  check('A-같은 삭제 두 번째 → 404 TOPIC_GONE(멱등)', del2.status === 404 && details(del2)?.reason === 'TOPIC_GONE', `status=${del2.status} ${j(details(del2))}`)
  const detB = await api(c3, 'GET', `/api/v1/scenarios/${B}`)
  check('A-상황 B 상세의 장소 = [길 묻기]뿐', j((data(detB)?.topics ?? []).map((t: any) => t.id)) === j([T_ROAD]), j((data(detB)?.topics ?? []).map((t: any) => t.id)))

  // ───────── B. 되돌리기 경로 ─────────
  const rs0 = await api(c3, 'POST', '/api/v1/seed-overrides/restore', { kind: 'TOPIC', seedId: T_CAFE })
  check('B-준비: 숨김 해제(HIDDEN 경로) 200', rs0.status === 200 && data(rs0)?.path === 'HIDDEN', `status=${rs0.status}`)
  const C2 = await forkTopic()
  const A2 = await mkScenario('QA 상황 A2(사본 주제에만)', [C2])
  const B2 = await mkScenario('QA 상황 B2(사본+길 묻기)', [C2, T_ROAD])
  check('B-준비: 새 사본·내 상황 2개', !!C2 && !!A2 && !!B2 && C2 !== C, `C2=${!!C2}`)
  const pv2 = await api(c3, 'GET', `/api/v1/topics/${C2}/removal`)
  const p2 = data(pv2)
  console.log('INFO removal preview(B).restore =', j(p2?.restore).slice(0, 700))
  check('B-#172 restore: 보관 0·되돌려 붙을 상황 = [A2, B2](사본에만 붙은 것·사본+다른 장소 모두 시드 주제로 이동)', (p2?.restore?.scenariosArchived ?? []).length === 0 && j(refIds(p2?.restore?.scenariosRelinked)) === j([A2, B2].sort()), `archived=${j(refIds(p2?.restore?.scenariosArchived))} relinked=${j(refIds(p2?.restore?.scenariosRelinked))} unlinked=${j(refIds(p2?.restore?.scenariosUnlinked))}`)
  const rNo = await api(c3, 'POST', '/api/v1/seed-overrides/restore', { kind: 'TOPIC', seedId: T_CAFE })
  check('B-#176 ack 없음(내 버전) → 409', rNo.status === 409, `status=${rNo.status} ${j(details(rNo))?.slice(0, 160)}`)
  const rBad = await api(c3, 'POST', '/api/v1/seed-overrides/restore', { kind: 'TOPIC', seedId: T_CAFE, ack: 'ckzzzzzzzzzzzzzzzzzzzzzzz' })
  check('B-#176 ack 불일치 → 409 IMPACT_CHANGED + details.preview.restore', rBad.status === 409 && details(rBad)?.reason === 'IMPACT_CHANGED' && !!details(rBad)?.preview?.restore, `status=${rBad.status} reason=${details(rBad)?.reason} preview.restore=${!!details(rBad)?.preview?.restore}`)
  check('B-#176 409 뒤 쓰기 0(사본·override 그대로)', (await prisma.conversationTopic.count({ where: { id: C2 } })) === 1 && (await prisma.userSeedOverride.count({ where: { userId: u3.id, kind: 'TOPIC', copyId: C2 } })) === 1)
  const rOk = await api(c3, 'POST', '/api/v1/seed-overrides/restore', { kind: 'TOPIC', seedId: T_CAFE, ack: 'none' })
  const rd = data(rOk)
  console.log('INFO restore result =', j(rd))
  check('B-#176 ack=none → 200 path=COPY·removal.mode=RESTORE·seedId·copyId', rOk.status === 200 && rd?.path === 'COPY' && rd?.copyId === C2 && rd?.removal?.mode === 'RESTORE' && rd?.removal?.seedId === T_CAFE, `status=${rOk.status}`)
  check('B-미리보기 ↔ 실제 일치: 보관 0·되돌려 붙음 2·끊김 수 같음', rd?.removal?.scenariosArchived === 0 && rd?.removal?.scenariosRelinked === (p2?.restore?.scenariosRelinked ?? []).length && rd?.removal?.scenariosUnlinked === (p2?.restore?.scenariosUnlinked ?? []).length, `actual ${rd?.removal?.scenariosArchived}/${rd?.removal?.scenariosRelinked}/${rd?.removal?.scenariosUnlinked} preview ${(p2?.restore?.scenariosArchived ?? []).length}/${(p2?.restore?.scenariosRelinked ?? []).length}/${(p2?.restore?.scenariosUnlinked ?? []).length}`)
  const a2 = await prisma.scenario.findUnique({ where: { id: A2 } })
  const b2 = await prisma.scenario.findUnique({ where: { id: B2 } })
  check('B-DB: 내 상황 A2·B2 = ACTIVE(보관되지 않음)', a2?.status === 'ACTIVE' && b2?.status === 'ACTIVE', `A2=${a2?.status} B2=${b2?.status}`)
  check('B-DB: A2 → 시드 주제, B2 → 시드 주제+길 묻기(사본 연결은 시드로 교체)', j(await links(A2)) === j([T_CAFE]) && j(await links(B2)) === j([T_CAFE, T_ROAD].sort()), `A2=${j(await links(A2))} B2=${j(await links(B2))}`)
  check('B-DB: 사본 주제·조각 삭제·override 0행', (await prisma.conversationTopic.count({ where: { id: C2 } })) === 0 && (await prisma.topicChunk.count({ where: { topicId: C2 } })) === 0 && (await prisma.userSeedOverride.count({ where: { userId: u3.id } })) === 0)
  const listB = data(await api(c3, 'GET', '/api/v1/topics?level=all'))?.items.map((t: any) => t.id)
  check('B-QA3 #56: 시드 다시 보임(5개)·사본 없음', listB.includes(T_CAFE) && !listB.includes(C2) && listB.length === 5, `ids=${listB.length}`)
  const rAgain = await api(c3, 'POST', '/api/v1/seed-overrides/restore', { kind: 'TOPIC', seedId: T_CAFE, ack: 'none' })
  check('B-되돌리기 두 번째 → 404 NOT_OVERRIDDEN', rAgain.status === 404 && details(rAgain)?.reason === 'NOT_OVERRIDDEN', `status=${rAgain.status} ${j(details(rAgain))}`)
  const detA2 = await api(c3, 'GET', `/api/v1/scenarios/${A2}`)
  check('B-상황 A2 상세 장소 = [시드 주제]', j((data(detA2)?.topics ?? []).map((t: any) => t.id)) === j([T_CAFE]))

  console.log('-- 한도 창 대기 62s'); await sleep(62_000)
  // ───────── C. 챌린지 ─────────
  const goal = { lesson: true, words: false, wordCount: null, wordsMinAnswered: null, countSkipped: false, ruleVersion: 1 }
  const mkCh = async (topicId: string, status: 'ACTIVE' | 'COMPLETED' | 'ENDED', title: string) => {
    const ended = status !== 'ACTIVE'
    const row = await prisma.challenge.create({
      data: {
        userId: u3.id, title, topicId, topicTitleSnap: '카페 주문', level: 'N5', lengthDays: 7,
        startDate: dayDate(ended ? -9 : 0), endDate: dayDate(ended ? -3 : 6), dailyGoal: goal, status,
        activeKey: ended ? null : u3.id, endedAt: ended ? new Date() : null,
        result: ended ? { ruleVersion: 1, endReason: status === 'ENDED' ? 'USER' : null, metDays: 3, partialDays: 0, missedDays: 4, stoppedDays: 0, elapsedDays: 7, rate: 0.43, longestStreak: 3, lessonsDone: 3, wordSets: 0, wordsCorrect: 0, days: [] } : undefined,
      },
    })
    return row.id
  }
  for (const mode of ['DELETE', 'RESTORE'] as const) {
    const tag = `C-${mode}`
    if (mode === 'RESTORE') { /* 직전 DELETE 로 시드가 숨김이므로 먼저 해제 */ await api(c3, 'POST', '/api/v1/seed-overrides/restore', { kind: 'TOPIC', seedId: T_CAFE }) }
    const Cx = await forkTopic()
    const active = await mkCh(Cx, 'ACTIVE', `QA 진행 중(${mode})`)
    const done = await mkCh(Cx, 'COMPLETED', `QA 완료(${mode})`)
    const ended = await mkCh(Cx, 'ENDED', `QA 그만둠(${mode})`)
    const endedBefore = await prisma.challenge.findUnique({ where: { id: ended } })
    const doneBefore = await prisma.challenge.findUnique({ where: { id: done } })
    const pvc = await api(c3, 'GET', `/api/v1/topics/${Cx}/removal`)
    const pc = data(pvc)
    console.log(`INFO ${tag} preview.activeChallenge =`, j(pc?.activeChallenge), 'finished=', pc?.finishedChallenges, 'ack=', pc?.ack)
    check(`${tag}-#172 진행 중 챌린지 = 그 챌린지·끝난 것 2·ack = 챌린지 id`, pc?.activeChallenge?.id === active && pc?.finishedChallenges === 2 && pc?.ack === active, `active=${pc?.activeChallenge?.id === active} finished=${pc?.finishedChallenges} ack=${pc?.ack === active}`)
    const call = (ack: string | null) =>
      mode === 'DELETE'
        ? api(c3, 'DELETE', `/api/v1/topics/${Cx}${ack === null ? '' : `?ack=${ack}`}`)
        : api(c3, 'POST', '/api/v1/seed-overrides/restore', { kind: 'TOPIC', seedId: T_CAFE, ...(ack === null ? {} : { ack }) })
    const noAck = await call(null)
    check(`${tag} ack 없음 → 409`, noAck.status === 409, `status=${noAck.status} ${j(details(noAck))?.slice(0, 100)}`)
    const none = await call('none')
    check(`${tag} ack=none(진행 중 챌린지가 있는데) → 409 IMPACT_CHANGED·details.preview.activeChallenge.id`, none.status === 409 && details(none)?.reason === 'IMPACT_CHANGED' && details(none)?.preview?.activeChallenge?.id === active, `status=${none.status} reason=${details(none)?.reason} active=${details(none)?.preview?.activeChallenge?.id === active}`)
    const wrongDone = await call(done)
    check(`${tag} ack=완료된 챌린지 id → 409`, wrongDone.status === 409, `status=${wrongDone.status}`)
    check(`${tag} 409 3번 뒤 챌린지 3행·사본 주제 그대로`, (await prisma.challenge.count({ where: { userId: u3.id, topicId: Cx } })) === 3 && (await prisma.conversationTopic.count({ where: { id: Cx } })) === 1)
    const ok = await call(active)
    const od = mode === 'DELETE' ? data(ok) : data(ok)?.removal
    console.log(`INFO ${tag} result =`, j(data(ok)).slice(0, 400))
    check(`${tag} ack=챌린지 id → 200·challengeDeleted=true·deletedChallengeId=진행 중 챌린지`, ok.status === 200 && od?.challengeDeleted === true && od?.deletedChallengeId === active && od?.mode === mode, `status=${ok.status} deleted=${od?.deletedChallengeId === active} mode=${od?.mode}`)
    const afterActive = await prisma.challenge.findUnique({ where: { id: active } })
    const afterDone = await prisma.challenge.findUnique({ where: { id: done } })
    const afterEnded = await prisma.challenge.findUnique({ where: { id: ended } })
    check(`${tag}-DB 진행 중 챌린지 행 삭제`, afterActive === null)
    check(`${tag}-DB 완료(COMPLETED)·그만둔(ENDED) 챌린지는 남고 topicId=null, 상태·결과 불변`, afterDone?.status === 'COMPLETED' && afterEnded?.status === 'ENDED' && afterDone?.topicId === null && afterEnded?.topicId === null && j(afterDone?.result) === j(doneBefore?.result) && j(afterEnded?.result) === j(endedBefore?.result) && afterDone?.topicTitleSnap === '카페 주문', `done=${afterDone?.status}/${afterDone?.topicId} ended=${afterEnded?.status}/${afterEnded?.topicId}`)
    check(`${tag}-DB 사용자 진행 중 챌린지 0(activeKey 해제)`, (await prisma.challenge.count({ where: { userId: u3.id, status: 'ACTIVE' } })) === 0)
    const ovRows = await prisma.userSeedOverride.findMany({ where: { userId: u3.id, kind: 'TOPIC' } })
    check(`${tag}-DB override: ${mode === 'DELETE' ? 'copyId=null(시드 숨김 유지)' : '삭제(시드 다시 보임)'}`, mode === 'DELETE' ? ovRows.length === 1 && ovRows[0].copyId === null : ovRows.length === 0, j(ovRows.map((o) => o.copyId)))
    await prisma.challenge.deleteMany({ where: { userId: u3.id } })
  }
  // 시작 전 확인: 챌린지 정리 후 행 수
  const h1 = await seedHash()
  check('⑥ 시드 행 내용 해시 불변', h0.sha === h1.sha && h0.chunks === h1.chunks && h0.links === h1.links, `${h0.sha} → ${h1.sha}`)
  console.log('cleanup', j(await cleanupQa(u3.id)), 'rows', j(await qaRowCounts(u3.id)))
  void SEED_SC
  summary('item3')
}
main().catch((e) => { console.error('SCRIPT ERROR', e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
