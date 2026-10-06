/**
 * task-010d A3a 라이브 스모크 — 상황 목록·상세·만들기·고치기·지우기(#161~#165)를 **실제 개발 서버(localhost)·실제 DB** 로 친다. LLM 호출 없음.
 *
 * 계정: QA4 `qa-bot4@thekaiwa.test`(상황 역할극 레인) = 주 계정 · QA2 `qa-bot2@thekaiwa.test` = 남의 것(IDOR).
 * 흐름: 1 목록(시드 + 내 것만 · 추천 ≤3 ⊆ 목록 · 쿼리 400) → 2 만들기 201(서버가 정한 표현 id e1… · DB userId QA4·isSeed false) · 잘못된 본문 400 problems·행 0
 *   → 3 상세 200 · QA2 의 상세·고치기·지우기 404(행 변화 0) → 4 고치기(보낸 칸만·표현 id 유지·새 표현 다음 번호) → 5 시드 고치기·지우기 404 SEED(시드가 있을 때)
 *   → 6 지우기 ARCHIVED·멱등 · 지운 뒤 상세 404 ARCHIVED · 목록 제외 · 고치기 409 ARCHIVED → 7 다른 표(StudyLog·RepetitionItem·관측·AiJob·RequestTrace) 행 증가 0 · 엔진명 0.
 * 정리: 이 실행이 만든 상황만 지운다(제목 접두 MARK + QA4, ScenarioTopic 은 cascade). 시드는 만들지도 지우지도 않는다.
 *
 * 가드: `SMOKE_ENV`(없으면 `APP_ENV`)가 PRODUCTION 이면 거부 · BASE 는 localhost 만, 포트 3010(운영) 거부.
 * 실행(우분투 미러, 개발 서버는 따로 — 예 `PORT=3029`):
 *   QA_ACCOUNT=4 node --env-file=.env --import tsx tests/live/qa-session.ts /tmp/q4 && QA_ACCOUNT=2 node --env-file=.env --import tsx tests/live/qa-session.ts /tmp/q2
 *   BASE=http://127.0.0.1:3029 node --env-file=.env --import tsx tests/live/task010d-a3a-smoke.ts /tmp/q4 /tmp/q2 ; rm /tmp/q4 /tmp/q2
 * 끝 줄 `RESULT pass=N fail=M`, 실패가 있으면 종료 코드 1.
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../../src/modules/infra/db'

const SMOKE_ENV = (process.env.SMOKE_ENV ?? process.env.APP_ENV ?? 'LOCAL').toUpperCase()
if (SMOKE_ENV === 'PRODUCTION') throw new Error('PRODUCTION 에서는 실행하지 않는다(새 API — 개발 서버 전용)')
const BASE = process.env.BASE ?? 'http://127.0.0.1:3029'
const url = new URL(BASE)
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || Number(url.port) === 3010) throw new Error('BASE 는 localhost(운영 포트 3010 제외)만 허용')
const [c4file, c2file] = process.argv.slice(2)
if (!c4file || !c2file) throw new Error('사용: task010d-a3a-smoke.ts <QA4 쿠키 파일> <QA2 쿠키 파일>')
const COOKIE4 = readFileSync(c4file, 'utf8').trim()
const COOKIE2 = readFileSync(c2file, 'utf8').trim()
if (!COOKIE4 || !COOKIE2) throw new Error('QA 쿠키 파일이 비어 있다 — qa-session.ts 결과를 확인')

const MARK = `smkA3a-${Date.now().toString(36)}`
const LEAK = /claude|haiku|sonnet|opus|qwen|toolLog|home-m4|reazon|whisper|style-?bert|sbv2|traceId/i
let leakHits = 0
const results: { id: string; ok: boolean; note: string }[] = []
function check(id: string, ok: boolean, note = ''): void {
  results.push({ id, ok, note })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}

type Json = Record<string, unknown>
async function api(cookie: string, method: string, path: string, body?: unknown): Promise<{ status: number; data: Json }> {
  const r = await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text()
  if (LEAK.test(text)) {
    leakHits++
    console.log(`  ! 누출 의심 ${method} ${path}`)
  }
  let data: Json = {}
  try {
    data = ((JSON.parse(text) as { data?: Json }).data ?? {}) as Json
  } catch {
    data = {}
  }
  return { status: r.status, data }
}
const details = (d: Json) => (d.details ?? {}) as Json
const ids = (v: unknown) => (Array.isArray(v) ? v.map((x) => (x as Json).id as string) : [])

async function otherTableCounts(userId: string) {
  const [log, rep, obs, job, trace] = await Promise.all([
    prisma.studyLog.count({ where: { userId } }),
    prisma.repetitionItem.count({ where: { userId } }),
    prisma.learningObservation.count({ where: { userId } }),
    prisma.aiJob.count({ where: { userId } }),
    prisma.requestTrace.count({ where: { userId } }),
  ])
  return { log, rep, obs, job, trace }
}

async function main(): Promise<void> {
  const qa4 = await prisma.user.findUnique({ where: { email: 'qa-bot4@thekaiwa.test' }, select: { id: true, provider: true } })
  const qa2 = await prisma.user.findUnique({ where: { email: 'qa-bot2@thekaiwa.test' }, select: { id: true, provider: true } })
  if (!qa4 || !qa2 || qa4.provider !== 'test' || qa2.provider !== 'test') throw new Error('QA4·QA2 계정이 없다 — qa-session.ts(QA_ACCOUNT=4·2)를 먼저 실행')
  const U = qa4.id
  const before = await otherTableCounts(U)
  console.log(`[task010d-a3a-smoke] env=${SMOKE_ENV} base=${BASE} run=${MARK}`)
  try {
    // 1 목록
    const list = await api(COOKIE4, 'GET', '/api/v1/scenarios')
    const items = (list.data.items ?? []) as Json[]
    check('1a #161 목록 200', list.status === 200, `items=${items.length}`)
    const rows = await prisma.scenario.findMany({ where: { id: { in: ids(items) } }, select: { id: true, userId: true, isSeed: true, status: true } })
    const byId = new Map(rows.map((r) => [r.id, r]))
    check('1b 목록 = 시드(userId null·isSeed) 또는 QA4 것, 모두 ACTIVE', items.every((i) => {
      const r = byId.get(i.id as string)
      return !!r && r.status === 'ACTIVE' && ((r.userId === null && r.isSeed) || (r.userId === U && i.isMine === true))
    }))
    const reco = (list.data.recommendedIds ?? []) as string[]
    check('1c 추천 ≤3 · 목록 안 · recommended 표시와 일치', reco.length <= 3 && reco.every((id) => ids(items).includes(id)) && items.filter((i) => i.recommended).length === reco.length, `reco=${reco.join(',')}`)
    check('1d 쿼리 오류 400', (await api(COOKIE4, 'GET', '/api/v1/scenarios?sort=new')).status === 400 && (await api(COOKIE4, 'GET', '/api/v1/scenarios?level=N9')).status === 400)
    const seedItem = items.find((i) => i.isMine === false)

    // 2 만들기
    const topics = await api(COOKIE4, 'GET', '/api/v1/topics')
    const topicId = ((topics.data.items ?? []) as Json[])[0]?.id as string | undefined
    const body = {
      title: `${MARK} 편의점 계산`,
      titleJa: 'コンビニで会計する',
      level: 'N5',
      roles: { learner: '손님', tutor: '점원' },
      goal: { communicativeGoalKo: '봉투와 포인트 카드를 묻고 답해요', successCriteria: ['봉투 필요 여부 답하기'] },
      steps: [{ ko: '인사하기' }, { ko: '봉투 묻기' }, { ko: '계산하기' }],
      keyExpressions: [{ id: 'client', ja: '袋はいりません', ko: '봉투는 필요 없어요' }, { ja: 'カードで', reading: 'かーどで', ko: '카드로' }],
      opening: { ja: 'いらっしゃいませ。', ko: '어서 오세요.' },
      ...(topicId ? { topicIds: [topicId] } : {}),
    }
    const countMine = () => prisma.scenario.count({ where: { userId: U, title: { startsWith: MARK } } })
    const bad = await api(COOKIE4, 'POST', '/api/v1/scenarios', { ...body, title: '<b>x</b>', steps: [{ ko: '하나' }] })
    check('2a 잘못된 본문 400 + problems[] · 행 0', bad.status === 400 && Array.isArray(details(bad.data).problems) && (details(bad.data).problems as unknown[]).length >= 2 && (await countMine()) === 0, JSON.stringify(details(bad.data).field))
    const made = await api(COOKIE4, 'POST', '/api/v1/scenarios', body)
    const sid = made.data.id as string
    check('2b #163 만들기 201 · isMine · 표현 id e1·e2(클라이언트 id 무시)', made.status === 201 && made.data.isMine === true && ids(made.data.keyExpressions).join(',') === 'e1,e2', `status=${made.status}`)
    const row = sid ? await prisma.scenario.findUnique({ where: { id: sid }, select: { userId: true, isSeed: true, status: true, constraints: true, topics: { select: { topicId: true } } } }) : null
    check('2c DB: userId QA4 · isSeed false · ACTIVE · constraints.steps 3 · 주제 연결', !!row && row.userId === U && !row.isSeed && row.status === 'ACTIVE' && ((row.constraints as Json)?.steps as unknown[])?.length === 3 && row.topics.length === (topicId ? 1 : 0))

    // 3 상세·IDOR
    const det = await api(COOKIE4, 'GET', `/api/v1/scenarios/${sid}`)
    check('3a #162 상세 200 · 단계·첫마디·필수 수', det.status === 200 && (det.data.steps as unknown[])?.length === 3 && (det.data.opening as Json)?.ja === 'いらっしゃいませ。' && det.data.requiredExpressions === 2)
    const snap = JSON.stringify(await prisma.scenario.findUnique({ where: { id: sid } }))
    const g2 = await api(COOKIE2, 'GET', `/api/v1/scenarios/${sid}`)
    const p2 = await api(COOKIE2, 'PATCH', `/api/v1/scenarios/${sid}`, { title: '남이 고침' })
    const d2 = await api(COOKIE2, 'DELETE', `/api/v1/scenarios/${sid}`)
    check('3b QA2 → QA4 상황 상세·고치기·지우기 404(세부 없음) · 행 변화 0', [g2, p2, d2].every((r) => r.status === 404 && r.data.details === undefined) && JSON.stringify(await prisma.scenario.findUnique({ where: { id: sid } })) === snap)
    const l2 = await api(COOKIE2, 'GET', '/api/v1/scenarios?mine=0')
    check('3c QA2 목록에 QA4 상황 없음', !ids(l2.data.items).includes(sid))

    // 4 고치기
    const up = await api(COOKIE4, 'PATCH', `/api/v1/scenarios/${sid}`, { title: `${MARK} 고친 제목`, keyExpressions: [{ id: 'e1', ja: '袋はいりません', ko: '봉투는 필요 없어요' }, { ja: 'ポイントカード', ko: '포인트 카드' }] })
    check('4a #164 고치기 200 · 보낸 칸만 · 표현 id 유지(e1) + 새 표현 e3', up.status === 200 && up.data.title === `${MARK} 고친 제목` && ids(up.data.keyExpressions).join(',') === 'e1,e3' && (up.data.steps as unknown[])?.length === 3)
    check('4b 고치기 검사 400(필수 수 범위)', (await api(COOKIE4, 'PATCH', `/api/v1/scenarios/${sid}`, { requiredExpressions: 9 })).status === 400)

    // 5 시드
    if (seedItem) {
      const ps = await api(COOKIE4, 'PATCH', `/api/v1/scenarios/${seedItem.id}`, { title: '시드 고치기' })
      const ds = await api(COOKIE4, 'DELETE', `/api/v1/scenarios/${seedItem.id}`)
      check('5a 시드 고치기·지우기 404 SEED', ps.status === 404 && details(ps.data).reason === 'SEED' && ds.status === 404 && details(ds.data).reason === 'SEED')
    } else check('5a 시드 없음(시드 미적재) — 건너뜀', true, 'seed-data/scenarios.json 적재 뒤 다시')

    // 6 지우기
    const del = await api(COOKIE4, 'DELETE', `/api/v1/scenarios/${sid}`)
    const again = await api(COOKIE4, 'DELETE', `/api/v1/scenarios/${sid}`)
    check('6a #165 지우기 ARCHIVED · 멱등', del.status === 200 && del.data.alreadyArchived === false && again.status === 200 && again.data.alreadyArchived === true)
    const gone = await api(COOKIE4, 'GET', `/api/v1/scenarios/${sid}`)
    const pg = await api(COOKIE4, 'PATCH', `/api/v1/scenarios/${sid}`, { title: '되살리기' })
    const after = await api(COOKIE4, 'GET', '/api/v1/scenarios?mine=1')
    check('6b 지운 뒤 상세 404 ARCHIVED · 고치기 409 ARCHIVED · 목록 제외', gone.status === 404 && details(gone.data).reason === 'ARCHIVED' && pg.status === 409 && details(pg.data).reason === 'ARCHIVED' && !ids(after.data.items).includes(sid))

    // 7 다른 표·누출
    const now = await otherTableCounts(U)
    check('7a StudyLog·RepetitionItem·관측·AiJob·RequestTrace 행 증가 0', JSON.stringify(now) === JSON.stringify(before), JSON.stringify({ before, now }))
    check('7b 응답 엔진명·traceId 0', leakHits === 0, `hits=${leakHits}`)
  } finally {
    const r = await prisma.scenario.deleteMany({ where: { userId: U, title: { startsWith: MARK } } })
    console.log(`[cleanup] 이 실행이 만든 상황 ${r.count}행 삭제(ScenarioTopic cascade)`)
  }
}

main()
  .catch((e) => {
    check('실행', false, e instanceof Error ? e.message : String(e))
  })
  .finally(async () => {
    await prisma.$disconnect()
    const fail = results.filter((r) => !r.ok).length
    console.log(`RESULT pass=${results.length - fail} fail=${fail}`)
    if (fail) process.exitCode = 1
  })
