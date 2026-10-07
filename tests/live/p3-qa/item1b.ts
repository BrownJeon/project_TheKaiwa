/** 항목 1 ④ — 같은 시드를 두 요청이 동시에 fork(HTTP, Promise.all 20회). 분당 20 한도(topic-write·scenario-write)를 지키려고 10회마다 62초 쉰다. QA 계정 3. */
import { api, check, cleanupQa, code, cookieOf, data, details, prisma, qaUser, QA3, seedHash, sleep, summary } from './common'
const T_CAFE = 'cmuihjozt000dw1dgeo2on2uf'
const SC = 'scn_cafe-order-drink'
async function main() {
  const c3 = cookieOf(process.env.QA_COOKIE!)
  const u3 = await qaUser(QA3)
  await cleanupQa(u3.id)
  const h0 = await seedHash()
  console.log('seedHash start', JSON.stringify(h0))
  const tally = { topicOk: 0, scnOk: 0, five00: 0, other: [] as string[] }
  for (let i = 1; i <= 20; i++) {
    if (i === 11) { console.log('-- 한도 창 대기 62s'); await sleep(62_000) }
    await cleanupQa(u3.id)
    const [t1, t2, s1, s2] = await Promise.all([
      api(c3, 'POST', `/api/v1/topics/${T_CAFE}/fork`, {}),
      api(c3, 'POST', `/api/v1/topics/${T_CAFE}/fork`, {}),
      api(c3, 'POST', `/api/v1/scenarios/${SC}/fork`, {}),
      api(c3, 'POST', `/api/v1/scenarios/${SC}/fork`, {}),
    ])
    const ts = [t1.status, t2.status].sort(), ss = [s1.status, s2.status].sort()
    const all = [t1, t2, s1, s2]
    if (all.some((r) => r.status >= 500)) tally.five00++
    const topicOk = ts[0] === 201 && ts[1] === 409
    const scnOk = ss[0] === 201 && ss[1] === 409
    const loser = (a: any, b: any) => (a.status === 409 ? a : b)
    const reasonOk = details(loser(t1, t2))?.reason === 'ALREADY_COPIED' && details(loser(s1, s2))?.reason === 'ALREADY_COPIED'
    const dbTopics = await prisma.conversationTopic.count({ where: { userId: u3.id } })
    const dbScn = await prisma.scenario.count({ where: { userId: u3.id } })
    const ovT = await prisma.userSeedOverride.count({ where: { userId: u3.id, kind: 'TOPIC', seedId: T_CAFE } })
    const ovS = await prisma.userSeedOverride.count({ where: { userId: u3.id, kind: 'SCENARIO', seedId: SC } })
    const chunkRows = await prisma.topicChunk.count({ where: { topic: { userId: u3.id } } })
    const ok = topicOk && scnOk && reasonOk && dbTopics === 1 && dbScn === 1 && ovT === 1 && ovS === 1 && chunkRows === 12
    if (topicOk) tally.topicOk++
    if (scnOk) tally.scnOk++
    if (!ok) tally.other.push(`iter${i}: topic=${ts} scn=${ss} reasonOk=${reasonOk} db t/s/oT/oS/chunks=${dbTopics}/${dbScn}/${ovT}/${ovS}/${chunkRows} codes=${all.map((r) => code(r)).join('|')}`)
    process.stdout.write(ok ? '.' : 'X')
  }
  console.log('')
  check('④ 20회 모두: 주제 fork 동시 2건 = 201 1 + 409 1', tally.topicOk === 20, `ok=${tally.topicOk}/20`)
  check('④ 20회 모두: 상황 fork 동시 2건 = 201 1 + 409 1', tally.scnOk === 20, `ok=${tally.scnOk}/20`)
  check('④ 500 응답 0건(P2002 가 500 으로 새지 않음)', tally.five00 === 0, `5xx iterations=${tally.five00}`)
  check('④ 매회 DB: 사본 주제 1·사본 상황 1·override 각 1·조각 12, 409 사유 ALREADY_COPIED', tally.other.length === 0, tally.other.slice(0, 3).join(' ;; '))
  const h1 = await seedHash()
  check('⑤ 시드 해시 불변', h0.sha === h1.sha, `${h0.sha} → ${h1.sha}`)
  console.log('cleanup', JSON.stringify(await cleanupQa(u3.id)))
  summary('item1b')
}
main().catch((e) => { console.error('SCRIPT ERROR', e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
