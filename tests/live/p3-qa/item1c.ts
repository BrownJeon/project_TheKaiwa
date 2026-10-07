/**
 * 항목 1 ④ 보충 — 실 MariaDB 에서 P2002→409 변환. 사용자 행 잠금이 같은 사용자 요청을 직렬화하므로 HTTP 경로로는 P2002 에 닿지 않는다.
 * 서비스를 직접 불러 `lockUser` 를 no-op 으로 바꿔(= 잠금 없는 경쟁) 유니크 위반을 일부러 만든다. QA 계정 3. 시드는 읽기만.
 */
import { forkSeedScenario, forkSeedTopic, hideSeed } from '@/modules/learning/seedOverride'
import { check, cleanupQa, prisma, qaUser, QA3, seedHash, summary } from './common'
const T_CAFE = 'cmuihjozt000dw1dgeo2on2uf'
const SC = 'scn_cafe-order-drink'
const noLock = { lockUser: async () => true }
const brief = (e: any) => (e ? `${e?.constructor?.name}:${e?.code ?? ''}:${e?.details?.reason ?? e?.meta?.target ?? ''}` : 'ok')
async function main() {
  const u3 = await qaUser(QA3)
  await cleanupQa(u3.id)
  const h0 = await seedHash()
  // (a) 원시 prisma — 유니크 위반 코드가 실 DB 에서 P2002 인가
  await prisma.userSeedOverride.create({ data: { userId: u3.id, kind: 'TOPIC', seedId: 'qa_dup_probe', copyId: null } })
  let dupErr: any = null
  try { await prisma.userSeedOverride.create({ data: { userId: u3.id, kind: 'TOPIC', seedId: 'qa_dup_probe', copyId: null } }) } catch (e) { dupErr = e }
  check('(a) 실 DB 에서 같은 (userId,kind,seedId) 두 번째 INSERT → code P2002', dupErr?.code === 'P2002', `code=${dupErr?.code} meta=${JSON.stringify(dupErr?.meta)?.slice(0, 120)}`)
  await prisma.userSeedOverride.deleteMany({ where: { userId: u3.id, seedId: 'qa_dup_probe' } })

  const runs: Array<[string, () => Promise<unknown>]> = [
    ['forkSeedTopic', () => forkSeedTopic(u3.id, T_CAFE, {}, noLock)],
    ['forkSeedScenario', () => forkSeedScenario(u3.id, SC, {}, noLock)],
    ['hideSeed(TOPIC)', () => hideSeed(u3.id, 'TOPIC', T_CAFE, noLock)],
  ]
  for (const [name, fn] of runs) {
    const tally = { ok1: 0, conflict: 0, other: [] as string[], dbBad: [] as string[], bothOk: 0 }
    const N = 20
    for (let i = 1; i <= N; i++) {
      await cleanupQa(u3.id)
      const rs = await Promise.allSettled([fn(), fn()])
      const fulfilled = rs.filter((r) => r.status === 'fulfilled').length
      const errs = rs.filter((r): r is PromiseRejectedResult => r.status === 'rejected').map((r) => r.reason)
      const conflicts = errs.filter((e) => e?.code === 'CONFLICT' && e?.details?.reason === 'ALREADY_COPIED')
      const others = errs.filter((e) => !(e?.code === 'CONFLICT' && e?.details?.reason === 'ALREADY_COPIED'))
      if (fulfilled === 1 && conflicts.length === 1) tally.ok1++
      else if (fulfilled === 2) tally.bothOk++ // hide 는 멱등이라 둘 다 성공 가능
      else tally.other.push(`iter${i}: fulfilled=${fulfilled} errs=${errs.map(brief).join(',')}`)
      if (conflicts.length) tally.conflict++
      if (others.length) tally.other.push(`iter${i} other=${others.map(brief).join(',')}`)
      const ov = await prisma.userSeedOverride.count({ where: { userId: u3.id } })
      const tp = await prisma.conversationTopic.count({ where: { userId: u3.id } })
      const sc = await prisma.scenario.count({ where: { userId: u3.id } })
      const ch = await prisma.topicChunk.count({ where: { topic: { userId: u3.id } } })
      const wantTopic = name === 'forkSeedTopic' ? 1 : 0, wantScn = name === 'forkSeedScenario' ? 1 : 0
      if (ov !== 1 || tp !== wantTopic || sc !== wantScn || ch !== wantTopic * 12) tally.dbBad.push(`iter${i}: override=${ov} topics=${tp} scn=${sc} chunks=${ch}`)
    }
    console.log(`${name}: 정확히 1성공+1ALREADY_COPIED=${tally.ok1}/${N} · 409 발생 반복=${tally.conflict} · 둘 다 성공=${tally.bothOk} · 기타=${tally.other.length}`)
    if (tally.other.length) console.log('  other sample:', tally.other.slice(0, 3).join(' ;; '))
    if (name === 'hideSeed(TOPIC)') check(`(b) ${name} 잠금 없이 동시 2회 ×${N}: 실패가 있다면 ALREADY_COPIED 뿐, override 항상 1행`, tally.other.length === 0 && tally.dbBad.length === 0, `ok1=${tally.ok1} bothOk=${tally.bothOk} dbBad=${tally.dbBad.length}`)
    else check(`(b) ${name} 잠금 없이 동시 2회 ×${N}: 매번 1성공 + 1 ALREADY_COPIED(P2002→409), 사본·override 각 1행, 고아 조각 0`, tally.ok1 === N && tally.other.length === 0 && tally.dbBad.length === 0, `ok1=${tally.ok1}/${N} other=${tally.other.length} dbBad=${tally.dbBad.slice(0, 2).join('|')}`)
  }
  const h1 = await seedHash()
  check('⑤ 시드 해시 불변', h0.sha === h1.sha, `${h0.sha} → ${h1.sha}`)
  console.log('cleanup', JSON.stringify(await cleanupQa(u3.id)))
  summary('item1c')
}
main().catch((e) => { console.error('SCRIPT ERROR', e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
