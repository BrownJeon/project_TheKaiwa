/**
 * task-010b 실측 — 실제 Claude CLI(구독)로 A5(REVIEW_MIX, `buildReviewMixRequest`)를 돌려 지연·JSON 계약 준수·
 * `repairLessonResponse` 보정 건수를 잰다(A4 재사용 확인). **운영 DB 를 바꾸지 않는다**.
 *
 * 지시(task-010b): 2회. 픽스처 `tests/prompts/fixtures/review-mix.json`(6항목) 1회 + 세션이 작을 때(3항목, new-N
 * 예외 규칙이 실제로 필요한지 확인) 1회.
 *
 * 실행(우분투 미러): cd ~/.node-local/thekaiwa && node --env-file=.env --import tsx tests/live/review-mix-measure.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { llm } from '../../src/modules/engine'
import { buildReviewMixRequest, checkLessonResponse, type LessonResponse, type ReviewMixItemInput } from '../../src/modules/conversation'

interface Fixture {
  items: ReviewMixItemInput[]
  mixNoteKo: string
}
const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/review-mix.json'), 'utf8')) as Fixture
const learner = { displayName: '브라운', teacherName: '유우', level: 'N4', weaknesses: ['CONJUGATION(3)', 'PARTICLE(2)'], streakDays: 4 }

interface RunRow {
  label: string
  ok: boolean
  ms: number
  attempts?: 1 | 2
  model?: string
  promptChars?: number
  resultChars?: number
  itemCount: number
  violations?: number
  error?: string
  counts?: { dialogue: number; chunks: number; chunksNew: number; grammar: number }
}

async function runOnce(label: string, items: ReviewMixItemInput[], mixNoteKo?: string): Promise<RunRow> {
  const req = buildReviewMixRequest({ todayKst: '2026-09-28', learner, level: 'N4', items, mixNoteKo })
  const t0 = Date.now()
  try {
    const r = await llm.completeJson<LessonResponse>({ ...req, timeoutMs: 150_000 })
    const ms = Date.now() - t0
    const violations = checkLessonResponse({ allowedChunkIds: req.allowedChunkIds }, r.data)
    return {
      label, ok: true, ms, attempts: r.attempts, model: r.model, promptChars: r.promptChars, resultChars: JSON.stringify(r.data).length,
      itemCount: items.length, violations: violations.length,
      counts: { dialogue: r.data.dialogue.length, chunks: r.data.chunks.length, chunksNew: r.data.chunks.filter((c) => c.isNew).length, grammar: r.data.grammar.length },
    }
  } catch (e) {
    const err = e as Error
    return { label, ok: false, ms: Date.now() - t0, itemCount: items.length, error: `${err.name}: ${err.message.slice(0, 200)}` }
  }
}

async function main() {
  console.log('reviewMix(A5) 실측 — 픽스처(6항목) 1회 + 소규모(3항목) 1회')
  const rows: RunRow[] = []
  rows.push(await runOnce('fixture-6items', fixture.items, fixture.mixNoteKo))
  console.log(JSON.stringify(rows[rows.length - 1]))
  rows.push(await runOnce('small-3items', fixture.items.slice(0, 3)))
  console.log(JSON.stringify(rows[rows.length - 1]))

  console.log(`\n## 요약 — n=${rows.length} 성공=${rows.filter((r) => r.ok).length}`)
  console.log('| run | 성공 | ms | attempts | 재료 | 위반 | dialogue | chunks(new) | grammar |')
  console.log('|---|---|---|---|---|---|---|---|---|')
  for (const r of rows) {
    if (!r.ok) {
      console.log(`| ${r.label} | FAILED | ${r.ms} | - | ${r.itemCount} | - | - | - | - | ${r.error} |`)
      continue
    }
    console.log(`| ${r.label} | OK | ${r.ms} | ${r.attempts} | ${r.itemCount} | ${r.violations} | ${r.counts!.dialogue} | ${r.counts!.chunks}(${r.counts!.chunksNew}) | ${r.counts!.grammar} |`)
  }
  writeFileSync('/tmp/kaiwa-review-mix-measure.json', JSON.stringify({ at: new Date().toISOString(), rows }, null, 1))
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
