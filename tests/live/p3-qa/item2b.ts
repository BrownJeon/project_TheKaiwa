/** 항목 2 ⑤ 보충 — 같은 계정·같은 시드를 숨김↔되돌리기로 토글하며 #28 시작이 막혔다 풀리는지(양성 대조). QA 계정 3, LLM 0회(채팅 만들기만). */
import { api, check, cleanupQa, code, cookieOf, data, prisma, qaRowCounts, qaUser, QA3, seedHash, summary } from './common'
const T_CAFE = 'cmuihjozt000dw1dgeo2on2uf'
const SC = 'scn_cafe-order-drink'
async function main() {
  const c3 = cookieOf(process.env.QA_COOKIE!)
  const u3 = await qaUser(QA3)
  await cleanupQa(u3.id)
  const h0 = await seedHash()
  const made: string[] = []
  const start = async (body: unknown) => { const r = await api(c3, 'POST', '/api/v1/chats', body); if (data(r)?.id) made.push(data(r).id); return r }

  const a = await start({ kind: 'TALK', topicId: T_CAFE })
  check('대조 1: 숨기기 전 #28(시드 주제) → 200', a.status === 200, `status=${a.status} code=${code(a)}`)
  const b = await start({ kind: 'TALK', scenarioId: SC })
  check('대조 2: 숨기기 전 역할극(시드 상황) → 200', b.status === 200, `status=${b.status} code=${code(b)}`)
  await api(c3, 'DELETE', `/api/v1/topics/${T_CAFE}`)
  await api(c3, 'DELETE', `/api/v1/scenarios/${SC}`)
  const c = await start({ kind: 'TALK', topicId: T_CAFE })
  const d = await start({ kind: 'TALK', scenarioId: SC })
  check('숨긴 뒤 #28(시드 주제) → 404', c.status === 404, `status=${c.status}`)
  check('숨긴 뒤 역할극(시드 상황) → 404', d.status === 404, `status=${d.status}`)
  await api(c3, 'POST', '/api/v1/seed-overrides/restore', { kind: 'TOPIC', seedId: T_CAFE })
  await api(c3, 'POST', '/api/v1/seed-overrides/restore', { kind: 'SCENARIO', seedId: SC })
  const e = await start({ kind: 'TALK', topicId: T_CAFE })
  const f = await start({ kind: 'TALK', scenarioId: SC })
  check('되돌린 뒤 #28(시드 주제) → 200', e.status === 200, `status=${e.status}`)
  check('되돌린 뒤 역할극(시드 상황) → 200', f.status === 200, `status=${f.status}`)
  console.log('chat rows made', made.length)
  console.log('chat delete', JSON.stringify(await prisma.chat.deleteMany({ where: { id: { in: made }, userId: u3.id } })))
  const h1 = await seedHash()
  check('시드 해시 불변', h0.sha === h1.sha, `${h0.sha} → ${h1.sha}`)
  console.log('cleanup', JSON.stringify(await cleanupQa(u3.id)), 'rows', JSON.stringify(await qaRowCounts(u3.id)))
  summary('item2b')
}
main().catch((e) => { console.error('SCRIPT ERROR', e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
