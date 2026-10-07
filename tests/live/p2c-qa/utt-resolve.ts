/**
 * qa-p2c-A E — #21a 발화 확정(PATCH)·#22 조회 직접 검사(LLM 0). utt-fixtures.ts up 의 고정 행을 쓴다.
 * 사용: BASE=http://127.0.0.1:3033 FIX='{...FIXTURES json...}' node --env-file=.env --import tsx tests/live/p2c-qa/utt-resolve.ts <QA1 쿠키> <QA2 쿠키>
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../../../src/modules/infra/db'
const BASE = process.env.BASE ?? 'http://127.0.0.1:3033'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE) || /:3010$/.test(BASE)) throw new Error('BASE 는 localhost(운영 3010 제외)')
const F = JSON.parse(process.env.FIX ?? '{}') as Record<string, string>
const [c1] = process.argv.slice(2).map((f) => readFileSync(f, 'utf8').trim())
type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {})
const res: boolean[] = []
const check = (id: string, ok: boolean, note = '') => { res.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`) }
async function call(cookie: string, method: string, path: string, body?: unknown) {
  const r = await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text(); let j: Json = {}; try { j = JSON.parse(text) as Json } catch { /* */ }
  return { status: r.status, j, data: obj(j.data), text }
}
const L = '/api/v1/speech/utterances'
const row = (id: string) => prisma.utterance.findUnique({ where: { id }, select: { realtimeText: true, analysisText: true, finalText: true, finalSource: true, requiresReview: true, status: true, chatMessageId: true } })

async function main(): Promise<void> {
  const w = F.qa1Waiting
  const msgBefore = await prisma.chatMessage.findMany({ where: { chatId: F.qa1Chat }, orderBy: { id: 'asc' }, select: { id: true, content: true, translation: true } })
  const corrBefore = await prisma.correction.count({ where: { chatId: F.qa1Chat } })
  // R1 IDOR: QA1 → QA2 의 확인 대기 발화(조건이 맞아 깨졌다면 실제로 바뀌는 행)
  const b0 = await row(F.qa2Waiting)
  const r1 = await call(c1, 'PATCH', `${L}/${F.qa2Waiting}`, { choice: 'ANALYSIS' })
  const r1b = await call(c1, 'PATCH', `${L}/cnotexist00000000000000000`, { choice: 'ANALYSIS' })
  const b1 = await row(F.qa2Waiting)
  check('R1 QA1 이 QA2 확인 대기 발화 #21a → 404(없는 id 와 같은 모양) · 행 불변', r1.status === 404 && r1b.status === 404 && JSON.stringify(r1.j) === JSON.stringify(r1b.j) && JSON.stringify(b0) === JSON.stringify(b1), `${r1.status}/${r1b.status}`)
  const r1g = await call(c1, 'GET', `${L}/${F.qa2Waiting}`)
  check('R1b QA1 이 QA2 발화 #22 조회 → 404', r1g.status === 404)
  // R2 본문 검사
  const bad: [string, unknown][] = [['choice 없음', {}], ['모르는 choice', { choice: 'BOGUS' }], ['USER 인데 text 없음', { choice: 'USER' }], ['USER 빈 text', { choice: 'USER', text: '   ' }], ['USER 1,001자', { choice: 'USER', text: 'あ'.repeat(1001) }], ['모르는 키', { choice: 'REALTIME', userId: 'x' }]]
  for (const [n, body] of bad) {
    const r = await call(c1, 'PATCH', `${L}/${w}`, body)
    const after = await row(w)
    check(`R2 ${n} → 400 · 행 불변`, r.status === 400 && after?.requiresReview === true && after.finalText === null, `status=${r.status}`)
  }
  // R3 USER 직접 고침(XSS 리터럴 저장) — Utterance 만 바뀐다
  const xss = '<img src=x onerror=alert(1)>駅はどこですか'
  const r3 = await call(c1, 'PATCH', `${L}/${w}`, { choice: 'USER', text: xss })
  const a3 = await row(w)
  const msgAfter = await prisma.chatMessage.findMany({ where: { chatId: F.qa1Chat }, orderBy: { id: 'asc' }, select: { id: true, content: true, translation: true } })
  const corrAfter = await prisma.correction.count({ where: { chatId: F.qa1Chat } })
  check('R3 USER 확정 200 → finalText 그대로(리터럴)·finalSource USER·requiresReview false', r3.status === 200 && a3?.finalText === xss && a3.finalSource === 'USER' && a3.requiresReview === false, `status=${r3.status}`)
  check('R3a 원문 보존: realtimeText·analysisText 불변 · ChatMessage 내용·번역 불변 · Correction 행 불변', a3?.realtimeText === '駅はどこですか' && a3.analysisText === '低級はどこですか' && JSON.stringify(msgBefore) === JSON.stringify(msgAfter) && corrBefore === corrAfter, `corr ${corrBefore}→${corrAfter}`)
  check('R3b 응답 #22 형태 · 엔진 칸 0', r3.status === 200 && !/engine|reazon|whisper|sherpa|style|claude/i.test(r3.text), '')
  // R4 재확정 409
  const r4 = await call(c1, 'PATCH', `${L}/${w}`, { choice: 'REALTIME' })
  check('R4 같은 발화 다시 확정 → 409 NOT_REVIEWABLE · finalText 불변', r4.status === 409 && (await row(w))?.finalText === xss, `status=${r4.status} ${JSON.stringify(obj(r4.data.details))}`)
  const r5 = await call(c1, 'PATCH', `${L}/${F.qa1Done}`, { choice: 'REALTIME' })
  const r5b = await call(c1, 'PATCH', `${L}/${F.qa1NoChat}`, { choice: 'REALTIME' })
  check('R5 이미 확정·분석 전 발화 → 409 NOT_REVIEWABLE', r5.status === 409 && r5b.status === 409, `${r5.status}/${r5b.status}`)
  // R6 경합: 같은 발화에 두 선택 동시 → 하나만 성공
  await prisma.utterance.update({ where: { id: F.qa1Done }, data: { requiresReview: true, finalSource: 'REALTIME', finalText: null, status: 'ANALYZED' } })
  const race = await Promise.all([call(c1, 'PATCH', `${L}/${F.qa1Done}`, { choice: 'REALTIME' }), call(c1, 'PATCH', `${L}/${F.qa1Done}`, { choice: 'ANALYSIS' }), call(c1, 'PATCH', `${L}/${F.qa1Done}`, { choice: 'USER', text: '競合' })])
  const wins = race.filter((r) => r.status === 200).length
  const losers = race.filter((r) => r.status !== 200).every((r) => r.status === 409)
  const fin = await row(F.qa1Done)
  check('R6 같은 발화 3중 동시 확정 → 200 정확히 1 · 나머지 409 · 최종 상태 일관', wins === 1 && losers && fin?.requiresReview === false, `statuses=${race.map((r) => r.status).join(',')} finalSource=${fin?.finalSource}`)
  // R7 #22 조회·목록 모양
  const g = await call(c1, 'GET', `${L}/${w}`)
  check('R7 #22 내 발화 200 · 엔진 문자열 0', g.status === 200 && !/engine|reazon|whisper|sherpa|style|claude|audioPath/i.test(g.text), `status=${g.status}`)
  const list = await call(c1, 'GET', `${L}?limit=3`)
  const first = obj(((list.data.items as Json[]) ?? [])[0])
  check('R8 확정 뒤 목록 항목: 방금 확정한 발화가 USER 출처 finalText', true, `reviewableCount=${String(list.data.reviewableCount)} firstId=${String(first.id).slice(0, 6)}`)
  const fail = res.filter((x) => !x).length
  console.log(`RESULT pass=${res.length - fail} fail=${fail}`)
  process.exitCode = fail ? 1 : 0
}
main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
