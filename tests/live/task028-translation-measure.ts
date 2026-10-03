/**
 * task-028 실측 — 실제 Claude CLI(구독)로 A1 TALK(`talk@v6`, `buildTalkRequest`)의 ① replyKo(번역) 이중 높임 유무
 * ② explanationKo 수준별(N5 vs N1) 쉬운 한국어 반영을 확인한다. **운영 DB 를 바꾸지 않는다**(합성 발화만).
 *
 * 실행(우분투 미러): cd ~/.node-local/thekaiwa && node --env-file=.env --import tsx tests/live/task028-translation-measure.ts
 */
import { llm } from '../../src/modules/engine'
import { buildTalkRequest, checkTalkResponse, checkReplyKoNaturalness, type TutorResponse } from '../../src/modules/conversation'

const learner = { displayName: '브라운', teacherName: '유우', level: 'N5', weaknesses: ['CONJUGATION(3)', 'PARTICLE(2)'], streakDays: 4 }

// 재현(traceId t_rApoXn51DLgsUlR4OfBD)과 비슷한 수여·응대 발화 — お付けします 계열이 나오기 쉬운 가게 장면.
const TRANSLATION_ITEMS = ['ビニール袋お願いします', 'これ、プレゼント用に包んでもらえますか', '荷物を預かってもらえますか']
// explanationKo 수준 비교 — 교정이 반드시 걸리도록 오류 문장(e01~e03, 조사·활용 계열) 재사용.
const LEVEL_ITEMS = [
  { id: 'e01', input: '昨日映画を見に行くました' },
  { id: 'e03', input: '昨日友だちを会いました' },
]

async function runTranslation(text: string) {
  const req = buildTalkRequest({ todayKst: '2026-10-03', learner, history: [], text })
  const t0 = Date.now()
  try {
    const r = await llm.completeJson<TutorResponse>({ ...req, timeoutMs: 20_000 })
    const ms = Date.now() - t0
    const dh = checkReplyKoNaturalness(r.data.conversation.replyKo)
    console.log(`[translation] "${text}" → replyJa="${r.data.conversation.replyJa}" replyKo="${r.data.conversation.replyKo}" 이중높임=${dh.length > 0} ms=${ms} attempts=${r.attempts}`)
  } catch (e) {
    console.log(`[translation] "${text}" ERROR ${(e as Error).message.slice(0, 200)}`)
  }
}

async function runLevel(input: string, level: string) {
  const req = buildTalkRequest({ todayKst: '2026-10-03', learner: { ...learner, level }, history: [], text: input })
  const t0 = Date.now()
  try {
    const r = await llm.completeJson<TutorResponse>({ ...req, timeoutMs: 20_000 })
    const ms = Date.now() - t0
    const v = checkTalkResponse(input, r.data)
    const c = r.data.correction
    console.log(`[level=${level}] "${input}" → explanationKo="${c?.explanationKo ?? null}" ms=${ms} attempts=${r.attempts} violations=${v.length}`)
  } catch (e) {
    console.log(`[level=${level}] "${input}" ERROR ${(e as Error).message.slice(0, 200)}`)
  }
}

async function main() {
  for (const t of TRANSLATION_ITEMS) await runTranslation(t)
  for (const it of LEVEL_ITEMS) {
    await runLevel(it.input, 'N5')
    await runLevel(it.input, 'N1')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
