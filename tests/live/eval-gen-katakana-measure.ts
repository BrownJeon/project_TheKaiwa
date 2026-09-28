/**
 * task-011 회귀 실측(evalGen@v3) — Leader 지시: developer 스모크에서 A6 TALK 출제가 4회 중 3회 재시도·1회 FAILED
 * 했던 원인(`LISTEN_RESPOND`/`SITUATION_RESPOND` 의 `expected.modelReading` 이 히라가나만 허용해 외래어(コーヒー 등)
 * 표기에서 위반)을 `EVAL_SENTENCE_READING_PATTERN`(히라가나+가타카나)으로 고친 뒤 **TALK 4회 + WORDS 1회** 를 독립
 * 호출로 돌려 성공률·attempts 를 다시 잰다. 목표: TALK 4/4. **운영 DB 를 바꾸지 않는다**(읽기 전용).
 *
 * 실행(우분투 미러): cd ~/.node-local/thekaiwa && node --env-file=.env --import tsx tests/live/eval-gen-katakana-measure.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { llm } from '../../src/modules/engine'
import { buildEvalGenRequest, checkEvalGenResponse, type EvalGenInput, type EvalGenResponse, type EvalGenWordCandidate, type EvalKind } from '../../src/modules/conversation'

interface Fixture {
  level: string
  topic: { title: string; titleJa: string }
  materials: EvalGenWordCandidate[]
}
const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/evalGen.json'), 'utf8')) as Fixture

interface RunRow {
  label: string
  ok: boolean
  ms: number
  attempts?: 1 | 2
  violations: number
  error?: string
}

async function runOnce(label: string, kind: EvalKind): Promise<RunRow> {
  const req = buildEvalGenRequest({
    todayKst: '2026-09-28', kind, level: fixture.level as EvalGenInput['level'],
    topic: kind === 'TALK' ? fixture.topic : null,
    materials: fixture.materials, recentHashes: [],
  })
  const t0 = Date.now()
  try {
    const r = await llm.completeJson<EvalGenResponse>({ ...req, timeoutMs: 120_000 })
    const ms = Date.now() - t0
    const candidateSurfaces = fixture.materials.map((m) => m.surface)
    const violations = checkEvalGenResponse({ kind, candidateSurfaces, recentHashes: new Set() }, r.data)
    return { label, ok: true, ms, attempts: r.attempts, violations: violations.length }
  } catch (e) {
    const err = e as Error
    return { label, ok: false, ms: Date.now() - t0, violations: -1, error: `${err.name}: ${err.message.slice(0, 300)}` }
  }
}

async function main() {
  console.log('eval-gen(A6) evalGen@v3 회귀 실측 — TALK 4회 + WORDS 1회(독립, 서로 dedup 안 함)')
  const rows: RunRow[] = []
  for (let i = 1; i <= 4; i++) {
    const row = await runOnce(`TALK#${i}`, 'TALK')
    rows.push(row)
    console.log(JSON.stringify(row))
  }
  const wordsRow = await runOnce('WORDS#1', 'WORDS')
  rows.push(wordsRow)
  console.log(JSON.stringify(wordsRow))

  const talkRows = rows.filter((r) => r.label.startsWith('TALK'))
  const talkOk = talkRows.filter((r) => r.ok).length
  console.log(`\n## 요약 — TALK ${talkOk}/${talkRows.length} 성공, WORDS ${wordsRow.ok ? 1 : 0}/1 성공`)
  console.log('| run | 성공 | ms | attempts | 위반 |')
  console.log('|---|---|---|---|---|')
  for (const r of rows) {
    if (!r.ok) {
      console.log(`| ${r.label} | FAILED | ${r.ms} | - | - | ${r.error} |`)
      continue
    }
    console.log(`| ${r.label} | OK | ${r.ms} | ${r.attempts} | ${r.violations} |`)
  }
  writeFileSync('/tmp/kaiwa-eval-gen-katakana-measure.json', JSON.stringify({ at: new Date().toISOString(), rows }, null, 1))
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
