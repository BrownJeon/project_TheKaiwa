/** 항목 1 ①②③⑤⑥ — 주제 사본(#174)·상황 사본(#175) 순차 시나리오. QA 계정 3 전용. */
import { api, check, cleanupQa, code, cookieOf, data, details, prisma, qaRowCounts, qaUser, QA2, QA3, seedHash, summary } from './common'

const stable = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x))
const T_CAFE = 'cmuihjozt000dw1dgeo2on2uf'
const T_INTRO = 'cmuihjn7b0000w1dgjabrm9wh'
const T_ROAD = 'cmuihjs9h000qw1dgthvl3fxn'

async function main() {
  const c3 = cookieOf(process.env.QA_COOKIE!)
  const c2 = cookieOf(process.env.QA_COOKIE2!)
  const u3 = await qaUser(QA3)
  console.log('pre-clean', JSON.stringify(await cleanupQa(u3.id)))
  const h0 = await seedHash()
  console.log('seedHash start', JSON.stringify(h0))

  const list = await api(c3, 'GET', '/api/v1/topics?level=all')
  const seedList = data(list).items as any[]
  const byId = (id: string) => seedList.find((t) => t.id === id)

  // ① 빈 본문 fork(주제) — 본문 `{}` 와 본문 없음 두 가지
  const r1 = await api(c3, 'POST', `/api/v1/topics/${T_CAFE}/fork`, {})
  const d1 = data(r1)
  check('①-T1 topic fork {} → 201', r1.status === 201, `status=${r1.status}`)
  check('①-T1 응답 키 topic·warnings·seedId·copyId·relinkedScenarioIds', ['topic', 'warnings', 'seedId', 'copyId', 'relinkedScenarioIds'].every((k) => k in (d1 ?? {})), Object.keys(d1 ?? {}).join(','))
  check('①-T1 seedId=요청 시드·topic.id=copyId·isSeed=false', d1?.seedId === T_CAFE && d1?.topic?.id === d1?.copyId && d1?.topic?.isSeed === false)
  const copy1 = await prisma.conversationTopic.findUnique({ where: { id: d1?.copyId ?? 'x' }, include: { chunks: { orderBy: { order: 'asc' } } } })
  const seed1 = await prisma.conversationTopic.findUnique({ where: { id: T_CAFE }, include: { chunks: { orderBy: { order: 'asc' } } } })
  check('①-T1 사본 소유=QA3·isSeed=false·시드와 다른 id', copy1?.userId === u3.id && copy1?.isSeed === false && copy1?.id !== T_CAFE)
  check('①-T1 제목·일본어 제목·수준·설명 동일', copy1?.title === seed1?.title && copy1?.titleJa === seed1?.titleJa && copy1?.level === seed1?.level && copy1?.description === seed1?.description, `${copy1?.title}|${seed1?.title}`)
  const sig = (cs: any[]) => cs.map((x) => [x.chunkType, x.textJa, x.reading, x.meaningKo, x.order, x.note ?? null])
  check('①-T1 조각 12개·내용 동일(읽기·뜻·유형·순서)', copy1?.chunks.length === 12 && stable(sig(copy1.chunks)) === stable(sig(seed1!.chunks)), `copy=${copy1?.chunks.length}`)
  const seedChunkIds = new Set(seed1!.chunks.map((x) => x.id))
  check('①-T1 조각 id 전부 새 id(시드 조각 id 와 겹침 0)', !!copy1 && copy1.chunks.every((x) => !seedChunkIds.has(x.id)) && new Set(copy1.chunks.map((x) => x.id)).size === 12)
  const ov1 = await prisma.userSeedOverride.findMany({ where: { userId: u3.id, kind: 'TOPIC', seedId: T_CAFE } })
  check('①-T1 override 1행 {TOPIC, seedId, copyId=사본}', ov1.length === 1 && ov1[0].copyId === d1?.copyId)
  const l2 = data(await api(c3, 'GET', '/api/v1/topics?level=all')).items as any[]
  check('①-T1 QA3 #56: 시드 사라지고 사본 보임', !l2.some((t) => t.id === T_CAFE) && l2.some((t) => t.id === d1?.copyId))
  const l2b = data(await api(c2, 'GET', '/api/v1/topics?level=all')).items as any[]
  check('①-T1 QA2 #56: 시드 그대로·QA3 사본 안 보임', l2b.some((t) => t.id === T_CAFE) && !l2b.some((t) => t.id === d1?.copyId))

  // ① 본문 없음(요청 본문 0바이트)
  const r1b = await api(c3, 'POST', `/api/v1/topics/${T_ROAD}/fork`, undefined, '')
  check('①-T2 topic fork 본문 없음 → 201(시드 그대로 복사)', r1b.status === 201, `status=${r1b.status} code=${code(r1b)}`)
  const copy1b = await prisma.conversationTopic.findUnique({ where: { id: data(r1b)?.copyId ?? 'x' }, include: { chunks: { orderBy: { order: 'asc' } } } })
  const seed1b = await prisma.conversationTopic.findUnique({ where: { id: T_ROAD }, include: { chunks: { orderBy: { order: 'asc' } } } })
  check('①-T2 내용 동일(조각 12)', copy1b?.chunks.length === 12 && stable(sig(copy1b.chunks)) === stable(sig(seed1b!.chunks)))

  // ② 편집한 본문 fork(주제)
  const intro = byId(T_INTRO)
  const chunks = intro.chunks.slice(0, 8).map((x: any, i: number) => ({ chunkType: x.chunkType, textJa: x.textJa, reading: x.reading, meaningKo: i === 0 ? 'QA수정뜻' : x.meaningKo }))
  const body2 = { title: 'QA 자기소개 사본', titleJa: intro.titleJa, level: intro.level, description: 'QA 가 고친 설명', chunks }
  const r2 = await api(c3, 'POST', `/api/v1/topics/${T_INTRO}/fork`, body2)
  check('②-T topic fork 편집 본문 → 201', r2.status === 201, `status=${r2.status} code=${code(r2)} ${JSON.stringify(details(r2))?.slice(0, 200)}`)
  const copy2 = await prisma.conversationTopic.findUnique({ where: { id: data(r2)?.copyId ?? 'x' }, include: { chunks: { orderBy: { order: 'asc' } } } })
  check('②-T 사본: 고친 제목·설명·조각 8개·첫 뜻 수정', copy2?.title === 'QA 자기소개 사본' && copy2?.description === 'QA 가 고친 설명' && copy2?.chunks.length === 8 && copy2?.chunks[0].meaningKo === 'QA수정뜻', `chunks=${copy2?.chunks.length}`)
  check('②-T 응답 topic 이 DB 사본과 일치(제목·조각 수)', data(r2)?.topic?.title === copy2?.title && data(r2)?.topic?.chunks?.length === 8)
  const seedIntroAfter = await prisma.conversationTopic.findUnique({ where: { id: T_INTRO }, include: { chunks: true } })
  check('②-T 시드 자기소개 조각 12 그대로·제목 그대로', seedIntroAfter?.chunks.length === 12 && seedIntroAfter?.title === '자기소개')

  // ③ 같은 시드 다시 fork → 409
  const before = await qaRowCounts(u3.id)
  const r3 = await api(c3, 'POST', `/api/v1/topics/${T_CAFE}/fork`, {})
  check('③-T 같은 시드 재 fork {} → 409 ALREADY_COPIED·state=COPIED', r3.status === 409 && details(r3)?.reason === 'ALREADY_COPIED' && details(r3)?.state === 'COPIED', `status=${r3.status} code=${code(r3)} details=${JSON.stringify(details(r3))}`)
  check('③-T 오류 code=CONFLICT', code(r3) === 'CONFLICT', `code=${code(r3)}`)
  const r3b = await api(c3, 'POST', `/api/v1/topics/${T_INTRO}/fork`, body2)
  check('③-T 같은 시드 재 fork(본문 있음) → 409 ALREADY_COPIED', r3b.status === 409 && details(r3b)?.reason === 'ALREADY_COPIED', `status=${r3b.status}`)
  const after = await qaRowCounts(u3.id)
  check('③-T 409 는 행을 만들지 않음(주제·override 수 불변)', before.topics === after.topics && before.overrides === after.overrides, `${before.topics}/${before.overrides} → ${after.topics}/${after.overrides}`)
  const r3c = await api(c3, 'POST', `/api/v1/topics/${data(r1)?.copyId}/fork`, {})
  check('③-T 내 사본 id 를 fork → 404 SEED_NOT_FOUND', r3c.status === 404 && details(r3c)?.reason === 'SEED_NOT_FOUND', `status=${r3c.status} details=${JSON.stringify(details(r3c))}`)
  const r3d = await api(c3, 'POST', `/api/v1/topics/does_not_exist_1/fork`, {})
  check('③-T 없는 id fork → 404 SEED_NOT_FOUND', r3d.status === 404 && details(r3d)?.reason === 'SEED_NOT_FOUND', `status=${r3d.status} ${JSON.stringify(details(r3d))}`)
  const r3e = await api(null, 'POST', `/api/v1/topics/${T_CAFE}/fork`, {})
  check('③-T 쿠키 없음 → 401', r3e.status === 401, `status=${r3e.status}`)

  // 상황 사본 ① 빈 본문
  const SC1 = 'scn_directions-station-exit'
  const s1 = await api(c3, 'POST', `/api/v1/scenarios/${SC1}/fork`, {})
  check('①-S1 scenario fork {} → 201', s1.status === 201, `status=${s1.status} code=${code(s1)} ${JSON.stringify(details(s1))?.slice(0, 200)}`)
  const sd1 = data(s1)
  check('①-S1 응답=#162 상세(isMine=true·새 id)', sd1?.isMine === true && typeof sd1?.id === 'string' && sd1.id !== SC1, `id=${sd1?.id} isMine=${sd1?.isMine}`)
  const sc1copy = await prisma.scenario.findUnique({ where: { id: sd1?.id ?? 'x' }, include: { topics: true } })
  const sc1seed = await prisma.scenario.findUnique({ where: { id: SC1 }, include: { topics: true } })
  check('①-S1 사본 소유=QA3·isSeed=false·ACTIVE', sc1copy?.userId === u3.id && sc1copy?.isSeed === false && sc1copy?.status === 'ACTIVE')
  const same = (k: keyof NonNullable<typeof sc1seed>) => stable((sc1copy as any)?.[k]) === stable((sc1seed as any)?.[k])
  check('①-S1 title·titleJa·description·level·difficulty·roles·goal·completionRule 동일', ['title', 'titleJa', 'description', 'level', 'difficulty', 'roles', 'goal', 'completionRule'].every((k) => same(k as any)))
  check('①-S1 keyExpressions(id e1..e5 포함) 그대로', same('keyExpressions') && Array.isArray(sc1seed?.keyExpressions) && (sc1seed!.keyExpressions as any[]).every((e) => typeof e.id === 'string'), `ids=${((sc1copy?.keyExpressions as any[]) ?? []).map((e) => e.id).join(',')}`)
  const seq = (s: any) => s?.constraints?.exprSeq ?? null
  check('①-S1 constraints.exprSeq 유지(비어 있지 않고 동일)', seq(sc1seed) !== null && stable(seq(sc1copy)) === stable(seq(sc1seed)) && stable(sc1copy?.constraints) === stable(sc1seed?.constraints), `seedSeq=${stable(seq(sc1seed))?.slice(0, 80)}`)
  console.log('INFO ①-S1 장소 연결(사본):', JSON.stringify(sc1copy?.topics), '| 시드:', JSON.stringify(sc1seed?.topics), '| 길묻기 사본 id =', data(r1b)?.copyId)
  const ovS1 = await prisma.userSeedOverride.findMany({ where: { userId: u3.id, kind: 'SCENARIO', seedId: SC1 } })
  check('①-S1 override 1행 {SCENARIO, seedId, copyId=사본}', ovS1.length === 1 && ovS1[0].copyId === sd1?.id)

  // 상황 사본 ② 편집 본문
  const SC2 = 'scn_weekend-plan-tell'
  const s2 = await api(c3, 'POST', `/api/v1/scenarios/${SC2}/fork`, { title: 'QA 변형 제목', description: 'QA 가 고친 상황 설명' })
  check('②-S scenario fork 편집 본문 → 201', s2.status === 201, `status=${s2.status} code=${code(s2)} ${JSON.stringify(details(s2))?.slice(0, 200)}`)
  const sc2copy = await prisma.scenario.findUnique({ where: { id: data(s2)?.id ?? 'x' } })
  const sc2seed = await prisma.scenario.findUnique({ where: { id: SC2 } })
  check('②-S 사본 제목·설명 수정됨·시드는 그대로', sc2copy?.title === 'QA 변형 제목' && sc2copy?.description === 'QA 가 고친 상황 설명' && sc2seed?.title === '주말 계획 이야기하기', `seedTitle=${sc2seed?.title}`)
  check('②-S 고치지 않은 칸(keyExpressions id·exprSeq·roles)은 시드 그대로', stable(sc2copy?.keyExpressions) === stable(sc2seed?.keyExpressions) && stable(sc2copy?.constraints) === stable(sc2seed?.constraints) && stable(sc2copy?.roles) === stable(sc2seed?.roles))

  // 상황 사본 ③ 재 fork
  const bs = await qaRowCounts(u3.id)
  const s3 = await api(c3, 'POST', `/api/v1/scenarios/${SC1}/fork`, {})
  check('③-S 같은 시드 재 fork → 409 ALREADY_COPIED(state COPIED)', s3.status === 409 && details(s3)?.reason === 'ALREADY_COPIED' && details(s3)?.state === 'COPIED', `status=${s3.status} details=${JSON.stringify(details(s3))}`)
  const as = await qaRowCounts(u3.id)
  check('③-S 409 는 행을 만들지 않음', bs.scenarios === as.scenarios && bs.overrides === as.overrides, `${bs.scenarios}/${bs.overrides} → ${as.scenarios}/${as.overrides}`)
  const s3c = await api(c3, 'POST', `/api/v1/scenarios/${sd1?.id}/fork`, {})
  check('③-S 내 사본 id 를 fork → 404 SEED_NOT_FOUND', s3c.status === 404 && details(s3c)?.reason === 'SEED_NOT_FOUND', `status=${s3c.status} ${JSON.stringify(details(s3c))}`)
  const s3d = await api(c3, 'POST', `/api/v1/scenarios/${SC2}/fork`, { bogusKey: 1 })
  check('⑥-S 모르는 키 본문(이미 사본 있는 시드) → 400 unknown_key(한도 미소모, 상태 검사보다 앞)', s3d.status === 400 && details(s3d)?.reason === 'unknown_key', `status=${s3d.status} ${JSON.stringify(details(s3d))?.slice(0, 160)}`)
  const s3e = await api(null, 'POST', `/api/v1/scenarios/${SC1}/fork`, {})
  check('⑥-S 쿠키 없음 → 401', s3e.status === 401)
  const s3f = await api(c3, 'POST', `/api/v1/scenarios/nope_x/fork`, {})
  check('⑥-S 없는 id → 404 SEED_NOT_FOUND', s3f.status === 404 && details(s3f)?.reason === 'SEED_NOT_FOUND', `status=${s3f.status} ${JSON.stringify(details(s3f))}`)

  // ⑥ 주제 쪽 400 모양(한도 미소모) — 잘못된 본문 한 건
  const t400 = await api(c3, 'POST', `/api/v1/topics/${T_CAFE}/fork`, { title: 'x', level: 'N5', chunks: [] })
  check('⑥-T 잘못된 본문 → 400 VALIDATION {field, reason, problems[]}', t400.status === 400 && code(t400) === 'VALIDATION' && typeof details(t400)?.field === 'string' && Array.isArray(details(t400)?.problems), `status=${t400.status} ${JSON.stringify(details(t400))?.slice(0, 160)}`)

  const h1 = await seedHash()
  check('⑤ 시드 행 내용 해시 불변(주제 5·조각 60·상황 10·연결 10)', h0.sha === h1.sha && h0.topics === h1.topics && h0.chunks === h1.chunks && h0.scenarios === h1.scenarios && h0.links === h1.links, `${h0.sha} → ${h1.sha}`)
  console.log('QA3 rows before cleanup', JSON.stringify(await qaRowCounts(u3.id)))
  console.log('cleanup', JSON.stringify(await cleanupQa(u3.id)))
  console.log('QA3 rows after cleanup', JSON.stringify(await qaRowCounts(u3.id)))
  void QA2
  summary('item1a')
}
main().catch((e) => { console.error('SCRIPT ERROR', e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
