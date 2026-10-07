/**
 * qa-p2c-B 항목 E — 012b-2 "음성 답을 직접 고쳐 채점"(D-B7) 실흐름 1건(A6 출제 1회 + A7 채점 1회, LLM 직렬): QA1
 *   TALK 평가 출제 → 상황 문항에 발화(DB 고정 행: 실시간 안·분석 안 다름·확인 대기) 연결(#67) → #21a `choice:USER` 로 직접 고침 → 제출(A7) → #66
 *   기대: 채점에 쓰인 답 = 고친 말(item.answerText·inputSource TEXT) · voiced:true · 발화 원문(realtimeText) 불변 · Evaluation DONE ↔ StudyLog(EVALUATION)·StatsSnapshot(EVALUATION) 1:1 · 응답에 엔진 문자열 0
 * 사용: BASE=http://127.0.0.1:3034 SERVER_PID=<pid> node --env-file=.env --import tsx tests/live/p2c-qa/b-eval-voice.ts <QA1 쿠키> <QA2 쿠키>
 */
import { prisma } from '../../../src/modules/infra/db'
import { api, check, cookieOf, details, num, obj, reason, sleep, stats, summary, type Json } from './b-lib'

const C1 = cookieOf(process.argv[2])
const C2 = cookieOf(process.argv[3])
const TAG = 'p2cB-fixture'
const REALTIME = 'ホットでごねがいします' // 일부러 틀리게 들린 실시간 안
const ANALYSIS = 'ホットで下さい'
const FIXED = 'ホットでお願いします。ミルクは少なめでお願いします。' // 학습자가 직접 고친 말(원 안에 없는 꼬리말 → 채점 입력 구분용)

async function poll(cookie: string, jobId: string, timeoutMs = 160_000): Promise<{ status: string; ms: number }> {
  const t = Date.now()
  for (;;) {
    const r = await api(cookie, 'GET', `/api/v1/jobs/${jobId}`)
    const st = String(r.data.status ?? '')
    if (st === 'DONE' || st === 'FAILED' || r.status !== 200) return { status: r.status === 200 ? st : `HTTP${r.status}`, ms: Date.now() - t }
    if (Date.now() - t > timeoutMs) return { status: 'TIMEOUT', ms: Date.now() - t }
    await sleep(1500)
  }
}

async function main(): Promise<void> {
  const u1 = (await prisma.user.findFirstOrThrow({ where: { email: 'qa-bot@thekaiwa.test', provider: 'test' }, select: { id: true } })).id
  const since = new Date()
  const before = { evDone: await prisma.evaluation.count({ where: { userId: u1, status: 'DONE' } }), snap: await prisma.statsSnapshot.count({ where: { userId: u1, kind: 'EVALUATION' } }), logs: await prisma.studyLog.count({ where: { userId: u1, type: 'EVALUATION' } }) }
  console.log(`[b-eval-voice] since=${since.toISOString()} before=${JSON.stringify(before)}`)
  // 회화 평가는 단어장 4개 이상이 필요(NOT_ENOUGH_WORDS) — QA1 에 임시 단어 5개(카테고리 p2cB단어, 끝에 삭제)
  const words: [string, string, string][] = [['駅', 'えき', '역'], ['出口', 'でぐち', '출구'], ['注文', 'ちゅうもん', '주문'], ['右', 'みぎ', '오른쪽'], ['左', 'ひだり', '왼쪽']]
  let made = 0
  for (const [surface, reading, meaning] of words) {
    const w = await api(C1, 'POST', '/api/v1/words', { surface, reading, meaning, category: 'p2cB단어' })
    if (w.status < 300) made++
  }
  check('E0 임시 단어 5개 등록(회화 평가 최소 4)', made >= 4, `made=${made}`)
  const topic = await prisma.conversationTopic.findFirst({ where: { isSeed: true, userId: null }, orderBy: { createdAt: 'asc' }, select: { id: true } })

  // 1 출제(A6)
  const created = await api(C1, 'POST', '/api/v1/evaluations', { kind: 'TALK', topicId: topic?.id ?? null })
  const EV = String(created.data.evaluationId ?? '')
  const job = await poll(C1, String(created.data.jobId ?? ''))
  check('E1 TALK 출제(A6) 잡 DONE', created.status < 300 && !!EV && job.status === 'DONE', `status=${created.status} job=${job.status} ${job.ms}ms`)
  if (!EV || job.status !== 'DONE') return
  const items = await prisma.evaluationItem.findMany({ where: { evaluationId: EV }, orderBy: { order: 'asc' }, select: { id: true, kind: true, order: true } })
  const sit = items.find((i) => i.kind === 'SITUATION_RESPOND')
  check('E2 말하기 문항(SITUATION_RESPOND) 존재', !!sit, items.map((i) => i.kind).join(','))
  if (!sit) return

  // 2 발화 고정 행 → 문항 연결(#67)
  const utt = await prisma.utterance.create({
    data: { realtimeEngine: TAG, userId: u1, durationMs: 2600, sampleRate: 16000, realtimeText: REALTIME, analysisText: ANALYSIS, transcriptConfidence: 0.55, requiresReview: true, status: 'ANALYZED', finalSource: 'REALTIME', createdAt: new Date() },
    select: { id: true },
  })
  const link = await api(C1, 'POST', `/api/v1/evaluations/${EV}/items/${sit.id}/answer`, { inputSource: 'REALTIME_STT', utteranceId: utt.id })
  check('E3 #67 발화 연결 200 · answerText = 실시간 안 · inputSource REALTIME_STT', link.status === 200 && link.data.answerText === REALTIME && link.data.inputSource === 'REALTIME_STT' && link.data.utteranceId === utt.id, `status=${link.status} ${JSON.stringify(details(link.data)).slice(0, 100)}`)

  // 3 #21a 직접 고침(USER)
  const patch = await api(C1, 'PATCH', `/api/v1/speech/utterances/${utt.id}`, { choice: 'USER', text: FIXED })
  const uRow = await prisma.utterance.findUnique({ where: { id: utt.id }, select: { realtimeText: true, analysisText: true, finalText: true, finalSource: true, requiresReview: true } })
  check('E4 #21a USER 확정 200 · finalText = 고친 말 · finalSource USER · 실시간·분석 원문 불변', patch.status === 200 && uRow?.finalText === FIXED && uRow.finalSource === 'USER' && uRow.realtimeText === REALTIME && uRow.analysisText === ANALYSIS, `status=${patch.status} final=${uRow?.finalSource}`)
  const idor = await api(C2, 'PATCH', `/api/v1/speech/utterances/${utt.id}`, { choice: 'REALTIME' })
  check('E5 IDOR: QA2 가 이 발화 확정 시도 → 404 · 행 불변', idor.status === 404 && (await prisma.utterance.findUnique({ where: { id: utt.id }, select: { finalText: true } }))?.finalText === FIXED, `status=${idor.status}`)

  // 4 제출(A7)
  const sub = await api(C1, 'POST', `/api/v1/evaluations/${EV}/submit`, {})
  const gj = await poll(C1, String(sub.data.jobId ?? ''))
  check('E6 제출 → 채점 잡 DONE(A7)', sub.status < 300 && gj.status === 'DONE', `status=${sub.status} job=${gj.status} ${gj.ms}ms`)
  if (gj.status !== 'DONE') return

  // 5 #66 + DB
  const res = await api(C1, 'GET', `/api/v1/evaluations/${EV}`)
  const its = (Array.isArray(res.data.items) ? res.data.items : []) as Json[]
  const it = its.find((x) => x.id === sit.id) ?? {}
  check('E7 #66 DONE · 해당 문항 voiced:true · inputSource TEXT(직접 고침) · answerText = 고친 말', res.data.status === 'DONE' && it.voiced === true && it.inputSource === 'TEXT' && it.answerText === FIXED, `status=${String(res.data.status)} voiced=${String(it.voiced)} src=${String(it.inputSource)} ans=${String(it.answerText).slice(0, 24)} score=${String(it.score)}`)
  const dbItem = await prisma.evaluationItem.findUnique({ where: { id: sit.id }, select: { answerText: true, inputSource: true, score: true, feedback: true } })
  check('E8 DB: 채점에 쓴 답 = 고친 말(TEXT) · 점수·피드백 있음', dbItem?.answerText === FIXED && dbItem.inputSource === 'TEXT' && typeof dbItem.score === 'number' && !!dbItem.feedback, `score=${String(dbItem?.score)} src=${String(dbItem?.inputSource)}`)
  const others = its.filter((x) => x.id !== sit.id)
  check('E9 미답 문항 voiced 칸 false/없음(음성 답 아님)', others.every((x) => x.voiced !== true), `n=${others.length}`)
  const after = { evDone: await prisma.evaluation.count({ where: { userId: u1, status: 'DONE' } }), snap: await prisma.statsSnapshot.count({ where: { userId: u1, kind: 'EVALUATION' } }), logs: await prisma.studyLog.count({ where: { userId: u1, type: 'EVALUATION' } }) }
  check('E10 기록률: Evaluation DONE +1 = StatsSnapshot(EVALUATION) +1 = StudyLog(EVALUATION) +1', after.evDone - before.evDone === 1 && after.snap - before.snap === 1 && after.logs - before.logs === 1 && after.evDone === after.snap, `before=${JSON.stringify(before)} after=${JSON.stringify(after)}`)
  check('E11 #66 응답에 엔진·신뢰도 문자열 0', !/reazon|whisper|style-?bert|sherpa|transcriptConfidence|engineVersions|claude|haiku|sonnet|opus/i.test(res.raw), `bytes=${res.raw.length}`)
  const again = await api(C2, 'GET', `/api/v1/evaluations/${EV}`)
  check('E12 IDOR: QA2 의 #66 → 404', again.status === 404, `status=${again.status}`)
  const uAfter = await prisma.utterance.findUnique({ where: { id: utt.id }, select: { realtimeText: true, finalText: true, evaluationItemId: true } })
  check('E13 발화 원문 보존 · 문항 연결 유지', uAfter?.realtimeText === REALTIME && uAfter.evaluationItemId === sit.id)
  check('E14 응답·SSE 엔진명 0(API 호출 전체)', stats.leak === 0, `hits=${stats.leak}`)
  void num; void obj; void reason
}

main().catch((e) => check('run', false, String(e))).finally(async () => {
  const u = await prisma.user.findFirst({ where: { email: 'qa-bot@thekaiwa.test', provider: 'test' }, select: { id: true } })
  if (u) console.log(`(임시 단어 삭제 ${(await prisma.wordEntry.deleteMany({ where: { userId: u.id, category: 'p2cB단어' } })).count}건)`)
  await prisma.$disconnect(); summary()
})
