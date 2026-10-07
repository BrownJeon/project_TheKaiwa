/** 항목 4 — 한도(하루 10·내 주제 30)·입력 거절·400 한도 미소모·PATCH 조각 id·level=all. QA 계정 3(주)·2(한도 사용자 분리). LLM 0회. */
import { api, check, cleanupQa, code, cookieOf, data, details, prisma, qaRowCounts, qaUser, QA2, QA3, seedHash, sleep, summary } from './common'
const T_INTRO = 'cmuihjn7b0000w1dgjabrm9wh'
const T_ROAD = 'cmuihjs9h000qw1dgthvl3fxn'
const j = (v: unknown) => JSON.stringify(v)

async function main() {
  const c3 = cookieOf(process.env.QA_COOKIE!)
  const c2 = cookieOf(process.env.QA_COOKIE2!)
  const u3 = await qaUser(QA3)
  const u2 = await qaUser(QA2)
  await cleanupQa(u3.id); await cleanupQa(u2.id)
  const h0 = await seedHash()
  console.log('seedHash start', j(h0))
  const seedList = data(await api(c3, 'GET', '/api/v1/topics?level=all')).items as any[]
  const intro = seedList.find((t) => t.id === T_INTRO)
  const toChunk = (x: any) => ({ chunkType: x.chunkType, textJa: x.textJa, reading: x.reading, meaningKo: x.meaningKo })
  const chunks8 = intro.chunks.slice(0, 8).map(toChunk)
  const body = (over: Record<string, unknown> = {}) => ({ title: 'QA 정상 주제', titleJa: '自己紹介', level: 'N5', description: 'QA 한도 시험용 주제', chunks: chunks8, ...over })

  // ───── S1: 입력 거절(400)·한도 미소모·정상 저장·이모지·PATCH·level=all ─────
  const bad: Array<[string, any, string[]]> = [
    ['title 꺾쇠 <', body({ title: '여행 <b>' }), ['forbidden_char']],
    ['title 전각 꺾쇠 ＜＞', body({ title: '여행 ＜b＞' }), ['forbidden_char']],
    ['title XSS 리터럴', body({ title: '"><img src=x onerror=alert(1)>' }), ['forbidden_char']],
    ['description URL', body({ description: 'https://evil.example.com/steal' }), ['forbidden_char']],
    ['title 13자리 숫자열', body({ title: '1234567890123' }), ['secret_like']],
    ['title 카드번호 모양(공백 구분)', body({ title: '카드 4111 1111 1111 1111' }), ['secret_like']],
    ['chunks[0].id 포함', body({ chunks: [{ id: 'abc', ...chunks8[0] }, ...chunks8.slice(1)] }), ['unknown_key']],
    ['모르는 최상위 키', body({ foo: 1 }), ['unknown_key']],
    ['조각의 모르는 키', body({ chunks: [{ ...chunks8[0], foo: 'x' }, ...chunks8.slice(1)] }), ['unknown_key']],
    ['조각 읽기 빈 글', body({ chunks: [{ ...chunks8[0], reading: '' }, ...chunks8.slice(1)] }), ['required']],
    ['조각 7개', body({ chunks: chunks8.slice(0, 7) }), ['count']],
    ['조각 21개', body({ chunks: Array.from({ length: 21 }, (_, i) => chunks8[i % 8]) }), ['count']],
    ['title 비어 있음', body({ title: '' }), ['required']],
    ['title 21자', body({ title: '가'.repeat(21) }), ['max_length']],
    ['level 열거 밖', body({ level: 'N9' }), ['enum']],
    ['조각 표기에 한글', body({ chunks: [{ ...chunks8[0], textJa: '이름' }, ...chunks8.slice(1)] }), ['chars', 'max_length', 'reading']],
    ['조각 뜻에 비밀 모양', body({ chunks: [{ ...chunks8[0], meaningKo: 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789' }, ...chunks8.slice(1)] }), ['secret_like', 'forbidden_char', 'chars']],
    ['제어문자(U+0007)', body({ title: '여행\u0007' }), ['forbidden_char']],
  ]
  let n400 = 0
  const miss: string[] = []
  for (let round = 0; round < 2; round++) {
    for (const [name, b, reasons] of bad) {
      const r = await api(c3, 'POST', '/api/v1/topics', b)
      const okk = r.status === 400 && code(r) === 'VALIDATION' && reasons.includes(details(r)?.reason)
      if (r.status === 400) n400++
      if (!okk && round === 0) miss.push(`${name}: status=${r.status} reason=${details(r)?.reason}`)
    }
  }
  const arr = await api(c3, 'POST', '/api/v1/topics', undefined, '[]')
  const nonJson = await api(c3, 'POST', '/api/v1/topics', undefined, '{oops')
  if (arr.status === 400) n400++
  if (nonJson.status === 400) n400++
  check('③ 입력 거절 18종 모두 400 VALIDATION(꺾쇠·전각 꺾쇠·XSS·URL·13자리 숫자열·카드번호 모양·chunks[].id·모르는 키·읽기 빈 글·조각 7/21개·빈 제목·긴 제목·열거 밖·한글 표기·비밀 모양·제어문자) 이유 일치', miss.length === 0, miss.join(' | '))
  check('③ 배열 본문·깨진 JSON → 400', arr.status === 400 && nonJson.status === 400, `array=${arr.status} broken=${nonJson.status}`)
  check('④ 400 응답 총 ≥ 38회(분당 한도 20 초과) 보냈고 DB 에 행 0', n400 >= 38 && (await prisma.conversationTopic.count({ where: { userId: u3.id } })) === 0, `n400=${n400} rows=${await prisma.conversationTopic.count({ where: { userId: u3.id } })}`)
  const ok1 = await api(c3, 'POST', '/api/v1/topics', body())
  check('④ 400 38회 뒤 정상 요청 → 201(분당 한도 `topic-write` 미소모)', ok1.status === 201, `status=${ok1.status} code=${code(ok1)}`)
  check('① POST /topics 정상 본문 → 201 {topic,warnings}·조각 8개·전부 id 있음', Array.isArray(data(ok1)?.warnings) && data(ok1)?.topic?.chunks?.length === 8 && data(ok1).topic.chunks.every((x: any) => typeof x.id === 'string') && data(ok1).topic.isSeed === false, `chunks=${data(ok1)?.topic?.chunks?.length}`)
  const t1 = data(ok1)?.topic?.id as string
  const dbT1 = await prisma.conversationTopic.findUnique({ where: { id: t1 }, include: { chunks: { orderBy: { order: 'asc' } } } })
  check('① DB: 내 주제 1행(userId=QA3·isSeed=false)·조각 8행·순서 0..7', dbT1?.userId === u3.id && dbT1?.isSeed === false && dbT1?.chunks.length === 8 && dbT1.chunks.every((x, i) => x.order === i))
  // 이모지
  const emoji = await api(c3, 'POST', '/api/v1/topics', body({ title: '여행 ✈️' }))
  check('③ 이모지 제목(`여행 ✈️`) → 201·제목에 이모지 보존', emoji.status === 201 && (data(emoji)?.topic?.title ?? '').includes('✈'), `status=${emoji.status} title=${j(data(emoji)?.topic?.title)} code=${code(emoji)} ${j(details(emoji))?.slice(0, 120)}`)
  // 수준 N3·N2·N1
  const lv: Record<string, string> = {}
  for (const L of ['N3', 'N2', 'N1']) { const r = await api(c3, 'POST', '/api/v1/topics', body({ title: `QA ${L} 주제`, level: L })); lv[L] = data(r)?.topic?.id; if (r.status !== 201) console.log('level create FAIL', L, r.status, j(details(r))) }
  const dflt = await api(c3, 'GET', '/api/v1/topics')
  const all = await api(c3, 'GET', '/api/v1/topics?level=all')
  const allIds = (data(all)?.items ?? []).map((x: any) => x.id)
  check('⑤ GET /topics?level=all → level 배열 다섯 수준 전부', j(data(all)?.level) === j(['N5', 'N4', 'N3', 'N2', 'N1']), j(data(all)?.level))
  check('⑤ level=all 이 N3·N2·N1 내 주제까지 포함(시드 5 + 내 주제 5)', allIds.length === 10 && ['N3', 'N2', 'N1'].every((L) => allIds.includes(lv[L])), `n=${allIds.length}`)
  check('⑤ 수준 지정 없는 기본 조회는 학습자 수준 ±1 만(N1 주제 제외)·level 배열이 다섯 아님', !(data(dflt)?.items ?? []).some((x: any) => x.id === lv.N1) && (data(dflt)?.level ?? []).length < 5, `level=${j(data(dflt)?.level)} n=${(data(dflt)?.items ?? []).length}`)
  const mineAll = await api(c3, 'GET', '/api/v1/topics?level=all&mine=1')
  check('⑤ level=all&mine=1 → 내 주제 5개만(시드 0)', (data(mineAll)?.items ?? []).length === 5 && (data(mineAll)?.items ?? []).every((x: any) => x.isSeed === false), `n=${(data(mineAll)?.items ?? []).length}`)
  const lvBad = await api(c3, 'GET', '/api/v1/topics?level=N9')
  check('⑤ level=N9 → 400', lvBad.status === 400, `status=${lvBad.status}`)
  // PATCH — 읽기만 수정은 id 유지, 글을 바꾼 조각은 새 id
  const oldIds = (dbT1?.chunks ?? []).map((x) => x.id)
  const patchChunks = (data(ok1).topic.chunks as any[]).map((x, i) => ({ id: x.id, ...toChunk(x), ...(i === 0 ? { reading: 'めいぜん' } : {}), ...(i === 1 ? { textJa: '教室', reading: 'きょうしつ', meaningKo: '교실' } : {}) }))
  const pr = await api(c3, 'PATCH', `/api/v1/topics/${t1}`, { chunks: patchChunks })
  check('③ PATCH(읽기 1개 수정 + 글 1개 교체) → 200', pr.status === 200, `status=${pr.status} code=${code(pr)} ${j(details(pr))?.slice(0, 200)}`)
  const after = await prisma.chunkOrder(t1)
  const nowIds = after.map((x) => x.id)
  check('③ PATCH 읽기만 바꾼 조각 → 기존 id 유지·읽기 갱신', nowIds[0] === oldIds[0] && after[0].reading === 'めいぜん', `same=${nowIds[0] === oldIds[0]} reading=${after[0]?.reading}`)
  check('③ PATCH 글을 바꾼 조각 → 새 id(옛 id 는 사라짐)', nowIds[1] !== oldIds[1] && !nowIds.includes(oldIds[1]) && after[1].textJa === '教室', `new=${nowIds[1] !== oldIds[1]} gone=${!nowIds.includes(oldIds[1])}`)
  check('③ PATCH 나머지 6개 조각 id 그대로·총 8개', after.length === 8 && j(nowIds.slice(2)) === j(oldIds.slice(2)), `n=${after.length}`)
  const prDesc = await api(c3, 'PATCH', `/api/v1/topics/${t1}`, { description: 'QA 설명만 수정' })
  const afterDesc = (await prisma.chunkOrder(t1)).map((x) => x.id)
  check('③ PATCH 설명만 → 조각 id 8개 전부 불변', prDesc.status === 200 && j(afterDesc) === j(nowIds), `status=${prDesc.status}`)
  const prForeign = await api(c3, 'PATCH', `/api/v1/topics/${t1}`, { chunks: [{ id: intro.chunks[0].id, ...chunks8[0] }, ...patchChunks.slice(1)] })
  check('③ PATCH 다른 주제(시드)의 조각 id → 400 chunks[0].id not_found', prForeign.status === 400 && /id/.test(details(prForeign)?.field ?? '') , `status=${prForeign.status} ${j(details(prForeign))?.slice(0, 160)}`)
  const prSeed = await api(c3, 'PATCH', `/api/v1/topics/${T_INTRO}`, { description: 'x' })
  check('③ PATCH 시드 id → 409 USE_FORK', prSeed.status === 409 && details(prSeed)?.reason === 'USE_FORK', `status=${prSeed.status} ${j(details(prSeed))}`)
  const prGone = await api(c3, 'PATCH', `/api/v1/topics/nope_nope_1`, { description: 'x' })
  check('③ PATCH 없는 id → 404 TOPIC_GONE', prGone.status === 404 && details(prGone)?.reason === 'TOPIC_GONE', `status=${prGone.status} ${j(details(prGone))}`)
  const prEmpty = await api(c3, 'PATCH', `/api/v1/topics/${t1}`, {})
  check('③ PATCH 빈 본문 → 400', prEmpty.status === 400, `status=${prEmpty.status}`)
  // 남의 주제 PATCH: QA2 가 QA3 의 주제를 고치려 함
  const prIdor = await api(c2, 'PATCH', `/api/v1/topics/${t1}`, { description: 'QA2 가 건드림' })
  const stillDesc = (await prisma.conversationTopic.findUnique({ where: { id: t1 } }))?.description
  check('③ QA2 가 QA3 의 주제 PATCH → 404 TOPIC_GONE·내용 불변', prIdor.status === 404 && stillDesc === 'QA 설명만 수정', `status=${prIdor.status} desc=${stillDesc}`)

  console.log('-- 한도 창 대기 62s'); await sleep(62_000)
  // ───── S2: 하루 10 한도 ─────
  await cleanupQa(u3.id)
  const created: string[] = []
  const statuses: number[] = []
  for (let i = 1; i <= 10; i++) { const r = await api(c3, 'POST', '/api/v1/topics', body({ title: `QA 한도 ${i}` })); statuses.push(r.status); if (data(r)?.topic?.id) created.push(data(r).topic.id) }
  check('① 하루 10번째까지 저장 201(10/10)', statuses.every((s) => s === 201), j(statuses))
  const r11 = await api(c3, 'POST', '/api/v1/topics', body({ title: 'QA 한도 11' }))
  const nowMs = Date.now()
  const kstNext = new Date(new Date(nowMs + 9 * 3600e3).toISOString().slice(0, 10) + 'T00:00:00+09:00').getTime() + 86_400_000
  const expectSec = Math.ceil((kstNext - nowMs) / 1000)
  console.log('INFO 11번째 응답 =', r11.status, code(r11), j(details(r11)), 'Retry-After 헤더=', r11.headers.get('retry-after'), 'KST 자정까지 ≈', expectSec)
  check('① 11번째 → 429 RATE_LIMITED·reason DAILY_LIMIT·limit 10·retryAfterSec 정수', r11.status === 429 && code(r11) === 'RATE_LIMITED' && details(r11)?.reason === 'DAILY_LIMIT' && details(r11)?.limit === 10 && Number.isInteger(details(r11)?.retryAfterSec), `status=${r11.status} code=${code(r11)} details=${j(details(r11))}`)
  check('① retryAfterSec ≈ KST 자정까지 남은 초(±10초)', Math.abs((details(r11)?.retryAfterSec ?? -999) - expectSec) <= 10, `got=${details(r11)?.retryAfterSec} expect≈${expectSec}`)
  check('① 11번째는 행을 만들지 않음(내 주제 정확히 10)', (await prisma.conversationTopic.count({ where: { userId: u3.id } })) === 10)
  const q2 = await api(c2, 'POST', '/api/v1/topics', body({ title: 'QA2 정상' }))
  check('① 한도는 사용자별 — QA2 의 같은 요청 → 201', q2.status === 201, `status=${q2.status}`)
  const forkDaily = await api(c3, 'POST', `/api/v1/topics/${T_ROAD}/fork`, {})
  check('① #174 fork 도 같은 하루 한도 공유 → 429 DAILY_LIMIT(시드 사본이 11번째)', forkDaily.status === 429 && details(forkDaily)?.reason === 'DAILY_LIMIT', `status=${forkDaily.status} ${j(details(forkDaily))}`)
  // 관찰: 하루 한도는 "오늘 만든 행 수" — 지우면 다시 저장 가능한가
  const delOne = await api(c3, 'DELETE', `/api/v1/topics/${created[0]}?ack=none`)
  const r11b = await api(c3, 'POST', '/api/v1/topics', body({ title: 'QA 한도 11b' }))
  console.log('INFO 삭제 1건 뒤 재저장 =', delOne.status, r11b.status)
  check('(관찰) 하루 한도 = 오늘 만든 행 수(삭제하면 같은 날 다시 저장 가능)', delOne.status === 200 && r11b.status === 201, `delete=${delOne.status} resave=${r11b.status}`)
  await cleanupQa(u2.id)

  // ───── S3: 내 주제 30 한도 ─────
  await cleanupQa(u3.id)
  const old = new Date(Date.now() - 3 * 86_400_000)
  await prisma.conversationTopic.createMany({ data: Array.from({ length: 29 }, (_, i) => ({ userId: u3.id, title: `QA 옛 주제 ${i + 1}`, level: 'N5' as const, isSeed: false, createdAt: old })) })
  check('② (준비) QA3 옛 주제 29개 직접 삽입(어제 이전 createdAt)', (await prisma.conversationTopic.count({ where: { userId: u3.id } })) === 29)
  const r30 = await api(c3, 'POST', '/api/v1/topics', body({ title: 'QA 서른번째' }))
  check('② 29개 + API 1개 → 201(30번째)', r30.status === 201, `status=${r30.status} code=${code(r30)} ${j(details(r30))}`)
  const r31 = await api(c3, 'POST', '/api/v1/topics', body({ title: 'QA 서른한번째' }))
  check('② 31번째 → 409 CONFLICT·reason TOPIC_LIMIT·limit 30', r31.status === 409 && code(r31) === 'CONFLICT' && details(r31)?.reason === 'TOPIC_LIMIT' && details(r31)?.limit === 30, `status=${r31.status} code=${code(r31)} ${j(details(r31))}`)
  const f31 = await api(c3, 'POST', `/api/v1/topics/${T_ROAD}/fork`, {})
  check('② #174 fork 도 내 주제 30 한도 공유 → 409 TOPIC_LIMIT', f31.status === 409 && details(f31)?.reason === 'TOPIC_LIMIT', `status=${f31.status} ${j(details(f31))}`)
  check('② 409 뒤에도 내 주제 정확히 30·override 0', (await prisma.conversationTopic.count({ where: { userId: u3.id } })) === 30 && (await prisma.userSeedOverride.count({ where: { userId: u3.id } })) === 0)

  const h1 = await seedHash()
  check('⑥ 시드 행 내용 해시 불변', h0.sha === h1.sha, `${h0.sha} → ${h1.sha}`)
  console.log('cleanup qa3', j(await cleanupQa(u3.id)), 'qa2', j(await cleanupQa(u2.id)))
  console.log('rows after', j(await qaRowCounts(u3.id)), j(await qaRowCounts(u2.id)))
  summary('item4')
}
// prisma 에 조각 순서 조회 도우미를 붙인다(스크립트 안 지역 확장)
;(prisma as any).chunkOrder = (topicId: string) => prisma.topicChunk.findMany({ where: { topicId }, orderBy: { order: 'asc' } })
declare module '@prisma/client' { interface PrismaClient { chunkOrder(topicId: string): Promise<Array<{ id: string; order: number; textJa: string; reading: string | null; meaningKo: string }>> } }
main().catch((e) => { console.error('SCRIPT ERROR', e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
