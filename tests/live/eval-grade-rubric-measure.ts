/**
 * task-011 완료 기준 "첫 평가 20건 루브릭 조정 라운드" — 실제 Claude CLI(구독)로 A7(EVAL_GRADE,
 * `buildEvalGradeRequest`)를 `tests/prompts/fixtures/eval-grade-rubric.json` 의 20건(N5~N4, 좋은 답·부분 답·틀린
 * 답·빈 답·엉뚱한 언어, 각 기대 점수 범위)에 돌려 편차 표를 낸다. **운영 DB 를 바꾸지 않는다**(읽기 전용).
 *
 * 한 건 = 서술형 문항 1개짜리 독립 평가(실제 서비스에서는 TALK 평가 한 번에 서술형 최대 5개를 한 번에 채점하지만,
 * 루브릭 조정 라운드는 "이 답 하나에 이 점수가 합리적인가"를 캘리브레이션하는 것이 목적이라 항목을 섞지 않고
 * 하나씩 고립해 돌린다 — Leader's Plan L3 범위 안에서 prompt-engineer 가 정한 측정 방법, task 이력서에 기록).
 *
 * 실행(우분투 미러): cd ~/.node-local/thekaiwa && node --env-file=.env --import tsx tests/live/eval-grade-rubric-measure.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { llm } from '../../src/modules/engine'
import { buildEvalGradeRequest, finalizeEvalGradeItems, type EvalGradeInput, type EvalGradeResponse, type EvalGradeSubjectiveItem } from '../../src/modules/conversation'

interface FixtureCase {
  id: string
  level: string
  kind: EvalGradeSubjectiveItem['kind']
  prompt: EvalGradeSubjectiveItem['prompt']
  expected: EvalGradeSubjectiveItem['expected']
  answerText: string
  expectedScoreRange: [number, number]
  category?: string
  note?: string
}
const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/eval-grade-rubric.json'), 'utf8')) as { cases: FixtureCase[] }

interface RunRow {
  id: string
  category?: string
  ok: boolean
  ms: number
  attempts?: 1 | 2
  score?: number
  expectedRange?: [number, number]
  inRange?: boolean
  feedback?: string
  error?: string
}

async function runCase(c: FixtureCase): Promise<RunRow> {
  const item: EvalGradeSubjectiveItem = { order: 0, kind: c.kind, prompt: c.prompt, expected: c.expected, answerText: c.answerText }
  const req = buildEvalGradeRequest({ evalKind: 'TALK', level: c.level as EvalGradeInput['level'], objectiveSummary: [], subjectiveItems: [item] })
  const t0 = Date.now()
  try {
    const r = await llm.completeJson<EvalGradeResponse>({ ...req, timeoutMs: 150_000 })
    const ms = Date.now() - t0
    const [final] = finalizeEvalGradeItems({ allowedOrders: [0] }, r.data)
    const inRange = final.score >= c.expectedScoreRange[0] && final.score <= c.expectedScoreRange[1]
    return { id: c.id, category: c.category, ok: true, ms, attempts: r.attempts, score: final.score, expectedRange: c.expectedScoreRange, inRange, feedback: final.feedback_ko }
  } catch (e) {
    const err = e as Error
    return { id: c.id, category: c.category, ok: false, ms: Date.now() - t0, error: `${err.name}: ${err.message.slice(0, 300)}` }
  }
}

async function main() {
  // ONLY=g21,g22 (쉼표 구분 id 또는 id 앞부분 g2) · REPEAT=3 (같은 케이스 반복 — 점수 편차 확인). 기본은 전체 1회.
  const only = (process.env.ONLY ?? '').split(',').map((x) => x.trim()).filter(Boolean)
  const repeat = Math.max(1, Number(process.env.REPEAT ?? '1') || 1)
  const cases = only.length ? fixture.cases.filter((c) => only.some((o) => c.id === o || c.id.startsWith(o))) : fixture.cases
  console.log(`eval-grade(A7) 루브릭 조정 라운드 — ${cases.length}건${repeat > 1 ? ` × ${repeat}회` : ''}`)
  const rows: RunRow[] = []
  for (const c of cases) {
    for (let k = 0; k < repeat; k++) {
      const row = await runCase(c)
      rows.push(row)
      console.log(JSON.stringify(row))
    }
  }
  const succeeded = rows.filter((r) => r.ok)
  const inRange = rows.filter((r) => r.ok && r.inRange)
  console.log(`\n## 요약 — n=${rows.length} 성공=${succeeded.length} 실패=${rows.length - succeeded.length} 범위내=${inRange.length}/${succeeded.length}`)
  console.log('| id | 종류 | 실제점수 | 기대범위 | 범위내 | ms | attempts |')
  console.log('|---|---|---|---|---|---|---|')
  for (const r of rows) {
    if (!r.ok) {
      console.log(`| ${r.id} | ${r.category} | FAILED | - | - | ${r.ms} | - | ${r.error} |`)
      continue
    }
    console.log(`| ${r.id} | ${r.category} | ${r.score} | [${r.expectedRange![0]},${r.expectedRange![1]}] | ${r.inRange ? 'O' : 'X'} | ${r.ms} | ${r.attempts} |`)
  }
  if (repeat > 1) {
    console.log('\n## 케이스별 반복 요약 (점수 목록 · 범위내 횟수)')
    for (const c of cases) {
      const rs = rows.filter((r) => r.id === c.id && r.ok)
      console.log(`- ${c.id} ${c.category ?? ''} [${c.expectedScoreRange[0]},${c.expectedScoreRange[1]}]: ${rs.map((r) => r.score).join(',')} → 범위내 ${rs.filter((r) => r.inRange).length}/${rs.length}`)
    }
  }
  writeFileSync('/tmp/kaiwa-eval-grade-rubric-measure.json', JSON.stringify({ at: new Date().toISOString(), rows }, null, 1))
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
