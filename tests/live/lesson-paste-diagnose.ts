/**
 * task-010 운영 후속(11b 붙여넣기 레슨 실패) 진단 — Claude CLI 구독으로 A4(LESSON, `buildLessonRequest`)의
 * **붙여넣기(sourceText) 경로**를 운영 스모크와 바이트 단위로 같은 입력(`tests/live/task010-smoke.ts` 의 `src`)으로
 * 반복 호출해, 실패한 시도가 **어느 검사(코드·메시지)에 걸렸는지**를 회차별로 남긴다. 운영 DB·3010 을 건드리지
 * 않는다(connection 해석은 읽기만, 결과는 stdout·/tmp 파일) — `lesson-measure.ts` 와 같은 원칙.
 *
 * `buildLessonRequest` 가 반환하는 `req.extraCheck`(= repairLessonResponse 먼저 → checkLessonResponse) 를
 * **감싸기만** 해서(behavior 변경 없음) 매 시도(1차·재시도)마다 그 시도가 낸 위반 목록을 기록한다 — 최종 실패의
 * `JsonSchemaError.violations` 는 마지막 시도(2차)의 위반만 담고 1차 위반은 `console.warn` 으로만 잘려 나가므로,
 * 이 스크립트가 그 틈을 메운다.
 *
 * 실행(우분투 미러): cd ~/.node-local/thekaiwa && node --env-file=.env --import tsx tests/live/lesson-paste-diagnose.ts
 *   [--runs-paste 8] [--runs-topic 2]
 */
import { writeFileSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { llm } from '../../src/modules/engine'
import { buildLessonRequest, type LessonResponse, type LessonTopicInput } from '../../src/modules/conversation'

/** 운영 스모크(`tests/live/task010-smoke.ts:388`)와 바이트 단위로 같은 입력. */
const PASTE_TEXT =
  '昨日、友達と新しいカフェに行きました。店員さんに「ご注文はお決まりですか」と聞かれて、少し緊張しました。私はホットコーヒーを、友達は抹茶ラテを注文しました。窓の外を見ながら、週末の旅行について話しました。とても楽しい時間でした。'

const learner = { displayName: '브라운', teacherName: '유우', level: 'N4', weaknesses: ['CONJUGATION(3)', 'PARTICLE(2)'], streakDays: 4 }

const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/lesson.json'), 'utf8')) as {
  topic: LessonTopicInput
  acceptedCorrections: { original: string; corrected: string }[]
  previousTitles: string[]
  previousNextPreview: { titleKo: string; teaserKo: string }
}

const args = process.argv.slice(2)
const arg = (k: string, d: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : d)
const runsPaste = Number(arg('--runs-paste', '8'))
const runsTopic = Number(arg('--runs-topic', '2'))

interface AttemptRow {
  attempt: number
  violations: string[]
  repairLog: string[]
}

interface RunRow {
  label: string
  ok: boolean
  ms: number
  attempts?: 1 | 2
  finalErrorName?: string
  finalViolations?: string[]
  attemptDetail: AttemptRow[]
}

/** `req.extraCheck` 를 감싸 시도마다(1차·재시도) 위반·repair 로그를 기록한다 — 동작은 바꾸지 않는다(같은 함수 호출). */
function instrument(req: ReturnType<typeof buildLessonRequest>): AttemptRow[] {
  const rows: AttemptRow[] = []
  const original = req.extraCheck!
  let n = 0
  // 엔진이 넘기는 시도 정보({attempt, maxAttempts}, REV-032)를 그대로 전달한다 — 버리면 마지막 시도 ④ 완화가 꺼져 운영보다 엄격하게 잰다.
  req.extraCheck = (data: LessonResponse, info?: Parameters<typeof original>[1]) => {
    n++
    const infoLogs: string[] = []
    const origInfo = console.info
    console.info = (...a: unknown[]) => {
      infoLogs.push(a.map(String).join(' '))
      origInfo(...a)
    }
    let violations: string[]
    try {
      violations = original(data, info)
    } finally {
      console.info = origInfo
    }
    rows.push({ attempt: n, violations, repairLog: infoLogs })
    return violations
  }
  return rows
}

async function runPaste(label: string): Promise<RunRow> {
  const req = buildLessonRequest({ todayKst: '2026-09-28', learner, sourceText: PASTE_TEXT, acceptedCorrections: [], previousTitles: [] })
  const attemptDetail = instrument(req)
  const t0 = Date.now()
  try {
    const r = await llm.completeJson<LessonResponse>({ ...req, timeoutMs: 180_000 })
    return { label, ok: true, ms: Date.now() - t0, attempts: r.attempts, attemptDetail }
  } catch (e) {
    const ms = Date.now() - t0
    if (e instanceof llm.JsonSchemaError) {
      return { label, ok: false, ms, finalErrorName: e.name, finalViolations: e.violations, attemptDetail }
    }
    const err = e as Error
    return { label, ok: false, ms, finalErrorName: err.name, finalViolations: [err.message.slice(0, 300)], attemptDetail }
  }
}

async function runTopic(label: string): Promise<RunRow> {
  const req = buildLessonRequest({
    todayKst: '2026-09-28',
    learner,
    topic: fixture.topic,
    acceptedCorrections: fixture.acceptedCorrections,
    previousTitles: fixture.previousTitles,
    previousNextPreview: fixture.previousNextPreview,
  })
  const attemptDetail = instrument(req)
  const t0 = Date.now()
  try {
    const r = await llm.completeJson<LessonResponse>({ ...req, timeoutMs: 180_000 })
    return { label, ok: true, ms: Date.now() - t0, attempts: r.attempts, attemptDetail }
  } catch (e) {
    const ms = Date.now() - t0
    if (e instanceof llm.JsonSchemaError) {
      return { label, ok: false, ms, finalErrorName: e.name, finalViolations: e.violations, attemptDetail }
    }
    const err = e as Error
    return { label, ok: false, ms, finalErrorName: err.name, finalViolations: [err.message.slice(0, 300)], attemptDetail }
  }
}

async function main() {
  console.log(`lesson(A4) 붙여넣기 신뢰도 진단(운영 11b 후속) — 붙여넣기 ${runsPaste}회 + 주제 ${runsTopic}회(대조)`)
  console.log(`sourceText(${PASTE_TEXT.length}자): ${PASTE_TEXT}`)
  const rows: RunRow[] = []
  for (let i = 1; i <= runsPaste; i++) {
    const row = await runPaste(`paste#${i}`)
    rows.push(row)
    console.log(JSON.stringify(row))
  }
  for (let i = 1; i <= runsTopic; i++) {
    const row = await runTopic(`topic#${i}`)
    rows.push(row)
    console.log(JSON.stringify(row))
  }
  const ok = rows.filter((r) => r.ok)
  console.log(`\n## 요약 — n=${rows.length} 성공=${ok.length} 실패=${rows.length - ok.length}`)
  console.log('| run | 성공 | ms | attempts | 1차 위반 | 2차(최종) 위반 |')
  console.log('|---|---|---|---|---|---|')
  for (const r of rows) {
    const a1 = r.attemptDetail[0]
    const a2 = r.attemptDetail[1]
    const v1 = a1 ? (a1.violations.length === 0 ? '0' : a1.violations.join(' / ')) : '-'
    const v2 = r.ok ? (a2 ? (a2.violations.length === 0 ? '0(재시도로 회복)' : a2.violations.join(' / ')) : '-') : (r.finalViolations ?? []).join(' / ')
    console.log(`| ${r.label} | ${r.ok ? 'OK' : 'FAILED'} | ${r.ms} | ${r.attempts ?? '-'} | ${v1} | ${v2} |`)
  }
  writeFileSync('/tmp/kaiwa-lesson-paste-diagnose.json', JSON.stringify({ at: new Date().toISOString(), rows }, null, 1))
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
