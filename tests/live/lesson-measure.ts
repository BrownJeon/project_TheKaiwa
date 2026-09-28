/**
 * task-010 실측 — 실제 Claude CLI(구독)로 A4(LESSON, `buildLessonRequest`)를 돌려 지연·JSON 계약 준수·응답 크기·
 * (v2부터) `repairLessonResponse` 보정 건수를 잰다. **운영 DB 를 바꾸지 않는다**(connection 은 읽기만, 결과는
 * stdout·/tmp 파일). 픽스처는 합성 데이터뿐이다(`tests/prompts/fixtures/lesson.json`).
 *
 * 비용 상한: 기본은 주제 경로 1회 + sourceText 경로 1회 = 총 2회(lesson@v1 실측). `--runs-topic`·`--runs-source`
 * 로 반복 횟수를 늘릴 수 있다 — lesson@v2 신뢰도 보강 검증은 Leader 지시로 주제 경로 5회·sourceText 경로 2회
 * (`--runs-topic 5 --runs-source 2`) 총 7회를 돌려 "7회 모두 레슨 생성 성공(재시도 포함)"을 확인한다.
 *
 * 실행(우분투 미러): cd ~/.node-local/thekaiwa && node --env-file=.env --import tsx tests/live/lesson-measure.ts [--runs-topic 5] [--runs-source 2]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { llm } from '../../src/modules/engine'
import { buildLessonRequest, checkLessonResponse, type LessonResponse, type LessonTopicInput } from '../../src/modules/conversation'

interface Fixture {
  topic: LessonTopicInput
  sourceText: string
  acceptedCorrections: { original: string; corrected: string }[]
  previousTitles: string[]
  previousNextPreview: { titleKo: string; teaserKo: string }
}
const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/lesson.json'), 'utf8')) as Fixture
const learner = { displayName: '브라운', teacherName: '유우', level: 'N4', weaknesses: ['CONJUGATION(3)', 'PARTICLE(2)'], streakDays: 4 }

const args = process.argv.slice(2)
const arg = (k: string, d: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : d)
const runsTopic = Number(arg('--runs-topic', '1'))
const runsSource = Number(arg('--runs-source', '1'))

interface RunRow {
  label: string
  ok: boolean
  ms: number
  attempts?: 1 | 2
  model?: string
  promptChars?: number
  resultChars?: number
  violations: number
  error?: string
  counts?: { dialogue: number; chunks: number; chunksNew: number; grammar: number; quiz: number; application: number; speaking: number }
}

async function runTopic(label: string): Promise<RunRow> {
  const req = buildLessonRequest({
    todayKst: '2026-09-28', learner, topic: fixture.topic,
    acceptedCorrections: fixture.acceptedCorrections, previousTitles: fixture.previousTitles, previousNextPreview: fixture.previousNextPreview,
  })
  const t0 = Date.now()
  try {
    const r = await llm.completeJson<LessonResponse>({ ...req, timeoutMs: 180_000 })
    const ms = Date.now() - t0
    const violations = checkLessonResponse({ allowedChunkIds: req.allowedChunkIds }, r.data)
    return {
      label, ok: true, ms, attempts: r.attempts, model: r.model, promptChars: r.promptChars, resultChars: JSON.stringify(r.data).length, violations: violations.length,
      counts: {
        dialogue: r.data.dialogue.length, chunks: r.data.chunks.length, chunksNew: r.data.chunks.filter((c) => c.isNew).length,
        grammar: r.data.grammar.length, quiz: r.data.quiz.length, application: r.data.application.length, speaking: r.data.speaking.length,
      },
    }
  } catch (e) {
    const err = e as Error
    return { label, ok: false, ms: Date.now() - t0, violations: -1, error: `${err.name}: ${err.message.slice(0, 200)}` }
  }
}

async function runSourceText(label: string): Promise<RunRow> {
  const req = buildLessonRequest({
    todayKst: '2026-09-28', learner, sourceText: fixture.sourceText,
    acceptedCorrections: fixture.acceptedCorrections, previousTitles: fixture.previousTitles,
  })
  const t0 = Date.now()
  try {
    const r = await llm.completeJson<LessonResponse>({ ...req, timeoutMs: 180_000 })
    const ms = Date.now() - t0
    const violations = checkLessonResponse({ allowedChunkIds: req.allowedChunkIds }, r.data)
    return {
      label, ok: true, ms, attempts: r.attempts, model: r.model, promptChars: r.promptChars, resultChars: JSON.stringify(r.data).length, violations: violations.length,
      counts: {
        dialogue: r.data.dialogue.length, chunks: r.data.chunks.length, chunksNew: r.data.chunks.filter((c) => c.isNew).length,
        grammar: r.data.grammar.length, quiz: r.data.quiz.length, application: r.data.application.length, speaking: r.data.speaking.length,
      },
    }
  } catch (e) {
    const err = e as Error
    return { label, ok: false, ms: Date.now() - t0, violations: -1, error: `${err.name}: ${err.message.slice(0, 200)}` }
  }
}

async function main() {
  console.log(`lesson(A4) 실측(v2 신뢰도 보강 검증) — 주제 경로 ${runsTopic}회 + sourceText 경로 ${runsSource}회`)
  const rows: RunRow[] = []
  for (let i = 1; i <= runsTopic; i++) {
    const row = await runTopic(`topic#${i}`)
    rows.push(row)
    console.log(JSON.stringify(row))
  }
  for (let i = 1; i <= runsSource; i++) {
    const row = await runSourceText(`sourceText#${i}`)
    rows.push(row)
    console.log(JSON.stringify(row))
  }
  const succeeded = rows.filter((r) => r.ok)
  console.log(`\n## 요약 — n=${rows.length} 성공=${succeeded.length} 실패=${rows.length - succeeded.length}`)
  console.log(`| run | 성공 | ms | attempts | 위반 | dialogue | chunks(new) | quiz | app | speaking |`)
  console.log(`|---|---|---|---|---|---|---|---|---|---|`)
  for (const r of rows) {
    if (!r.ok) {
      console.log(`| ${r.label} | FAILED | ${r.ms} | - | - | - | - | - | - | - | ${r.error} |`)
      continue
    }
    console.log(
      `| ${r.label} | OK | ${r.ms} | ${r.attempts} | ${r.violations} | ${r.counts!.dialogue} | ${r.counts!.chunks}(${r.counts!.chunksNew}) | ${r.counts!.quiz} | ${r.counts!.application} | ${r.counts!.speaking} |`,
    )
  }
  writeFileSync('/tmp/kaiwa-lesson-measure-v2.json', JSON.stringify({ at: new Date().toISOString(), rows }, null, 1))
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
