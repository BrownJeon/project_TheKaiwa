/** 항목 2 — 숨김·되돌리기·#179·사용자 간 분리·숨긴 시드 새 시작 거절. QA 계정 3(주 실험)·2(분리 확인). LLM 불가(CLAUDE_CLI_PATH=/bin/false). */
import { api, check, cleanupQa, code, cookieOf, data, details, prisma, qaRowCounts, qaUser, QA2, QA3, seedHash, summary } from './common'
const T_CAFE = 'cmuihjozt000dw1dgeo2on2uf'
const SC = 'scn_cafe-order-drink'
const ids = (r: any, key = 'items') => (data(r)?.[key] ?? []).map((t: any) => t.id)
async function main() {
  const c3 = cookieOf(process.env.QA_COOKIE!)
  const c2 = cookieOf(process.env.QA_COOKIE2!)
  const u3 = await qaUser(QA3)
  const u2 = await qaUser(QA2)
  await cleanupQa(u3.id)
  await cleanupQa(u2.id)
  const h0 = await seedHash()
  const base3 = await qaRowCounts(u3.id)
  console.log('seedHash start', JSON.stringify(h0), 'qa3 rows', JSON.stringify(base3))

  // ① 시드 주제 DELETE → HIDDEN
  const d1 = await api(c3, 'DELETE', `/api/v1/topics/${T_CAFE}`)
  check('①-T DELETE 시드 주제 → 200 result=HIDDEN', d1.status === 200 && data(d1)?.result === 'HIDDEN', `status=${d1.status} data=${JSON.stringify(data(d1))?.slice(0, 220)}`)
  const l3 = await api(c3, 'GET', '/api/v1/topics?level=all')
  check('①-T QA3 #56 목록에서 시드 사라짐', !ids(l3).includes(T_CAFE) && ids(l3).length === 4, `items=${ids(l3).length}`)
  const l2 = await api(c2, 'GET', '/api/v1/topics?level=all')
  check('①-T 다른 계정(QA2) #56 목록은 그대로(시드 5개)', ids(l2).includes(T_CAFE) && ids(l2).length === 5, `items=${ids(l2).length}`)
  const lmine3 = await api(c3, 'GET', '/api/v1/topics?level=N5')
  check('①-T 수준 필터 조회(level=N5)에서도 QA3 는 시드 숨김', !ids(lmine3).includes(T_CAFE), `ids=${ids(lmine3).length}`)
  const ov = await prisma.userSeedOverride.findMany({ where: { userId: u3.id } })
  check('①-T override 1행 {TOPIC, seedId, copyId=null}', ov.length === 1 && ov[0].kind === 'TOPIC' && ov[0].seedId === T_CAFE && ov[0].copyId === null)
  const d1b = await api(c3, 'DELETE', `/api/v1/topics/${T_CAFE}`)
  check('①-T 같은 시드 DELETE 다시 → 200·HIDDEN(멱등)·override 여전히 1행', d1b.status === 200 && data(d1b)?.result === 'HIDDEN' && (await prisma.userSeedOverride.count({ where: { userId: u3.id } })) === 1, `status=${d1b.status}`)
  check('①-T QA2 override 0행(남의 숨김이 번지지 않음)', (await prisma.userSeedOverride.count({ where: { userId: u2.id } })) === 0)

  // ② 시드 상황 DELETE → HIDDEN
  const d2 = await api(c3, 'DELETE', `/api/v1/scenarios/${SC}`)
  check('②-S DELETE 시드 상황 → 200 {result:HIDDEN}', d2.status === 200 && data(d2)?.result === 'HIDDEN', `status=${d2.status} data=${JSON.stringify(data(d2))}`)
  const sl3 = await api(c3, 'GET', '/api/v1/scenarios')
  const sl2 = await api(c2, 'GET', '/api/v1/scenarios')
  check('②-S QA3 #161 상황 목록에서 사라짐·QA2 는 그대로', !ids(sl3).includes(SC) && ids(sl2).includes(SC), `qa3=${ids(sl3).length} qa2=${ids(sl2).length}`)
  const d2b = await api(c3, 'DELETE', `/api/v1/scenarios/${SC}`)
  check('②-S 다시 DELETE → 200 HIDDEN·alreadyHidden=true', d2b.status === 200 && data(d2b)?.result === 'HIDDEN' && data(d2b)?.alreadyHidden === true, `data=${JSON.stringify(data(d2b))}`)

  // ③ #179 본인 것만·seedTitle
  const o3 = await api(c3, 'GET', '/api/v1/seed-overrides')
  const items3 = data(o3)?.items ?? []
  const iT = items3.find((x: any) => x.kind === 'TOPIC'), iS = items3.find((x: any) => x.kind === 'SCENARIO')
  check('③ #179 QA3: 항목 2(TOPIC·SCENARIO)·state HIDDEN·copyId null·orphan false', items3.length === 2 && iT?.state === 'HIDDEN' && iS?.state === 'HIDDEN' && iT?.copyId === null && iS?.copyId === null && iT?.orphan === false, JSON.stringify(items3).slice(0, 300))
  check('③ #179 seedTitle = 시드 제목(주제 「카페 주문」·상황 「음료의 온도·크기 정해서 주문하기」)', iT?.seedTitle === '카페 주문' && iS?.seedTitle === '음료의 온도·크기 정해서 주문하기', `topic=${iT?.seedTitle} scn=${iS?.seedTitle}`)
  check('③ #179 응답 키 = kind,seedId,seedTitle,state,copyId,orphan,updatedAt 뿐(내부 값 없음)', items3.every((x: any) => Object.keys(x).sort().join() === ['copyId', 'kind', 'orphan', 'seedId', 'seedTitle', 'state', 'updatedAt'].sort().join()), Object.keys(items3[0] ?? {}).join(','))
  // QA2: 같은 시드를 내 버전으로 바꾸고(제목 `QA2비밀제목`), 그 시드 상황은 숨김
  const body2 = (await api(c2, 'GET', '/api/v1/topics?level=all')).body.data.items.find((t: any) => t.id === T_CAFE)
  const f2 = await api(c2, 'POST', `/api/v1/topics/${T_CAFE}/fork`, { title: 'QA2비밀제목', titleJa: body2.titleJa, level: body2.level, description: 'QA2 설명', chunks: body2.chunks.slice(0, 9).map((x: any) => ({ chunkType: x.chunkType, textJa: x.textJa, reading: x.reading, meaningKo: x.meaningKo })) })
  check('③ (준비) QA2 가 같은 시드 주제를 제목 「QA2비밀제목」 내 버전으로 fork → 201', f2.status === 201, `status=${f2.status} ${JSON.stringify(details(f2))?.slice(0, 160)}`)
  const o3b = await api(c3, 'GET', '/api/v1/seed-overrides')
  const raw3 = JSON.stringify(o3b.body)
  check('③ #179 QA3 응답에 QA2 사본 제목·id 가 없음', !raw3.includes('QA2비밀제목') && !raw3.includes(data(f2)?.copyId ?? 'zzz') && (data(o3b)?.items ?? []).length === 2 && (data(o3b)?.items ?? []).find((x: any) => x.kind === 'TOPIC')?.seedTitle === '카페 주문')
  const o2 = await api(c2, 'GET', '/api/v1/seed-overrides')
  const i2 = (data(o2)?.items ?? []).find((x: any) => x.kind === 'TOPIC')
  check('③ #179 QA2: 자기 항목만(1건)·state COPIED·copyId=QA2 사본·seedTitle=시드 제목(사본 제목 아님)', (data(o2)?.items ?? []).length === 1 && i2?.state === 'COPIED' && i2?.copyId === data(f2)?.copyId && i2?.seedTitle === '카페 주문', JSON.stringify(data(o2)).slice(0, 260))
  const oK = await api(c3, 'GET', '/api/v1/seed-overrides?kind=TOPIC')
  check('③ #179 ?kind=TOPIC → 주제 항목만', (data(oK)?.items ?? []).length === 1 && data(oK).items[0].kind === 'TOPIC', `n=${(data(oK)?.items ?? []).length}`)
  const oBad = await api(c3, 'GET', '/api/v1/seed-overrides?kind=bogus')
  check('③ #179 ?kind=bogus → 400 field=kind', oBad.status === 400 && details(oBad)?.field === 'kind', `status=${oBad.status} ${JSON.stringify(details(oBad))}`)
  const o401 = await api(null, 'GET', '/api/v1/seed-overrides')
  check('③ #179 쿠키 없음 → 401', o401.status === 401)

  // ⑤ 숨긴 시드로 새 시작 거절(QA3) — LLM 호출 전에 404 여야 함
  const pre = await qaRowCounts(u3.id)
  const rej: Array<[string, string, string, any]> = [
    ['#28 채팅(TALK, 숨긴 시드 주제)', 'POST', '/api/v1/chats', { kind: 'TALK', topicId: T_CAFE }],
    ['#28 채팅(CHAT, 숨긴 시드 주제)', 'POST', '/api/v1/chats', { kind: 'CHAT', topicId: T_CAFE }],
    ['#156 챌린지 만들기', 'POST', '/api/v1/challenges', { topicId: T_CAFE, lengthDays: 7, start: 'TODAY', dailyGoal: { lesson: true, words: true, wordCount: 5 } }],
    ['#47 주제 단어 세트', 'POST', '/api/v1/vocab/sessions', { topicId: T_CAFE, count: 5 }],
    ['#65 평가 출제(WORDS)', 'POST', '/api/v1/evaluations', { kind: 'WORDS', topicId: T_CAFE }],
    ['#65 평가 출제(TALK)', 'POST', '/api/v1/evaluations', { kind: 'TALK', topicId: T_CAFE }],
    ['#59 주제 수업', 'POST', '/api/v1/lessons', { topicId: T_CAFE }],
    ['#28 역할극(숨긴 시드 상황)', 'POST', '/api/v1/chats', { kind: 'TALK', scenarioId: SC }],
    ['#59 상황 수업(숨긴 시드 상황)', 'POST', '/api/v1/lessons', { scenarioId: SC }],
  ]
  for (const [name, m, p, b] of rej) {
    const t0 = Date.now()
    const r = await api(c3, m, p, b)
    const isTopic = !name.includes('상황')
    const reasonOk = name.startsWith('#28 채팅') ? true : isTopic ? details(r)?.reason === 'TOPIC_GONE' : true
    check(`⑤ ${name} → 404${isTopic && !name.startsWith('#28') ? ' TOPIC_GONE' : ''} (LLM 전)`, r.status === 404 && reasonOk, `status=${r.status} code=${code(r)} details=${JSON.stringify(details(r))} ${Date.now() - t0}ms`)
  }
  const post = await qaRowCounts(u3.id)
  check('⑤ 거절 9건 뒤 QA3 의 채팅·수업·평가·세트·챌린지 행 0건 증가', JSON.stringify(pre) === JSON.stringify(post), `${JSON.stringify(pre)} → ${JSON.stringify(post)}`)
  // 양성 대조: QA2 는 숨기지 않았으니 시작 가능(채팅 만들기는 LLM 0회)
  const ctl = await api(c2, 'POST', '/api/v1/chats', { kind: 'TALK', topicId: T_CAFE })
  check('⑤ (대조) 숨기지 않은 QA2 의 같은 #28 요청 → 200(숨김 때문에 막힌 것임을 확인)', ctl.status === 200, `status=${ctl.status} code=${code(ctl)}`)
  if (data(ctl)?.id) await prisma.chat.deleteMany({ where: { id: data(ctl).id, userId: u2.id } })
  // 사본이 생기면 시드 id 가 아니라 사본 id 로 시작은 가능(QA2 의 사본)
  const ctl2 = await api(c2, 'POST', '/api/v1/chats', { kind: 'TALK', topicId: data(f2)?.copyId })
  check('⑤ (대조) QA2 는 내 버전 주제 id 로 #28 가능 → 200', ctl2.status === 200, `status=${ctl2.status}`)
  if (data(ctl2)?.id) await prisma.chat.deleteMany({ where: { id: data(ctl2).id, userId: u2.id } })
  const ctlSeedHiddenByCopy = await api(c2, 'POST', '/api/v1/chats', { kind: 'TALK', topicId: T_CAFE })
  check('⑤ QA2 는 시드 주제를 내 버전으로 바꾼 뒤 시드 id 로는 #28 시작 불가 → 404', ctlSeedHiddenByCopy.status === 404, `status=${ctlSeedHiddenByCopy.status}`)

  // ④ restore — HIDDEN 해제
  const rs = await api(c3, 'POST', '/api/v1/seed-overrides/restore', { kind: 'TOPIC', seedId: T_CAFE })
  check('④-T restore {TOPIC} → 200 path=HIDDEN·copyId null·removal null', rs.status === 200 && data(rs)?.path === 'HIDDEN' && data(rs)?.copyId === null && data(rs)?.removal === null, `status=${rs.status} data=${JSON.stringify(data(rs))?.slice(0, 200)}`)
  const lr = await api(c3, 'GET', '/api/v1/topics?level=all')
  check('④-T restore 뒤 QA3 목록에 시드 다시 보임(5개)·override 0행', ids(lr).includes(T_CAFE) && ids(lr).length === 5 && (await prisma.userSeedOverride.count({ where: { userId: u3.id, kind: 'TOPIC' } })) === 0)
  const rs2 = await api(c3, 'POST', '/api/v1/seed-overrides/restore', { kind: 'SCENARIO', seedId: SC })
  check('④-S restore {SCENARIO} → 200 path=HIDDEN', rs2.status === 200 && data(rs2)?.path === 'HIDDEN', `status=${rs2.status} data=${JSON.stringify(data(rs2))?.slice(0, 200)}`)
  const slr = await api(c3, 'GET', '/api/v1/scenarios')
  check('④-S restore 뒤 QA3 상황 목록에 다시 보임', ids(slr).includes(SC))
  const rs3 = await api(c3, 'POST', '/api/v1/seed-overrides/restore', { kind: 'TOPIC', seedId: T_CAFE })
  check('④ override 없는 시드 restore → 404 NOT_OVERRIDDEN', rs3.status === 404 && details(rs3)?.reason === 'NOT_OVERRIDDEN', `status=${rs3.status} ${JSON.stringify(details(rs3))}`)
  const rsBad = await api(c3, 'POST', '/api/v1/seed-overrides/restore', { kind: 'bogus', seedId: T_CAFE })
  check('④ kind 가 열거 밖 → 400 field=kind', rsBad.status === 400 && details(rsBad)?.field === 'kind', `status=${rsBad.status} ${JSON.stringify(details(rsBad))}`)
  const rsRaw = await api(c3, 'POST', '/api/v1/seed-overrides/restore', undefined, '{not json')
  check('④ 잘못된 JSON → 400', rsRaw.status === 400, `status=${rsRaw.status} code=${code(rsRaw)}`)
  const rsOther = await api(c3, 'POST', '/api/v1/seed-overrides/restore', { kind: 'TOPIC', seedId: T_CAFE })
  check('④ QA3 가 QA2 만 가진 override 를 건드리지 못함(404)·QA2 override 그대로', rsOther.status === 404 && (await prisma.userSeedOverride.count({ where: { userId: u2.id, kind: 'TOPIC', seedId: T_CAFE } })) === 1)
  // 세션 id 만 사용 — 본문에 userId 를 실어도 무시(QA3 쿠키로 QA2 의 것을 되돌려 달라고 해 본다)
  const rsIdor = await api(c3, 'POST', '/api/v1/seed-overrides/restore', { kind: 'TOPIC', seedId: T_CAFE, userId: u2.id })
  check('④ 본문에 userId(타인)를 실어도 404·QA2 override 그대로', rsIdor.status === 404 && (await prisma.userSeedOverride.count({ where: { userId: u2.id } })) === 1, `status=${rsIdor.status}`)
  const o401r = await api(null, 'POST', '/api/v1/seed-overrides/restore', { kind: 'TOPIC', seedId: T_CAFE })
  check('④ restore 쿠키 없음 → 401', o401r.status === 401)

  const h1 = await seedHash()
  check('⑥ 시드 행 내용 해시 불변', h0.sha === h1.sha && h0.chunks === h1.chunks && h0.links === h1.links, `${h0.sha} → ${h1.sha}`)
  console.log('cleanup qa3', JSON.stringify(await cleanupQa(u3.id)), 'qa2', JSON.stringify(await cleanupQa(u2.id)))
  console.log('rows after', JSON.stringify(await qaRowCounts(u3.id)), JSON.stringify(await qaRowCounts(u2.id)))
  summary('item2')
}
main().catch((e) => { console.error('SCRIPT ERROR', e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
