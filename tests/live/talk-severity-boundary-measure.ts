/**
 * task-010c 실측(Leader 후속 지시, 2026-09-28) — 유창성 모드는 orchestrator 가 `severity` 로 즉시 표시(MAJOR)/
 * 모아두기(MINOR)를 가르므로 severity 정확도가 기능의 핵심이다. `tests/prompts/fixtures/talk-severity-boundary.json`
 * (조사 3·활용 3·어휘 오선택 2·어순 1·정중함 1, 각 기대 severity)을 FLUENCY 모드로 실제 Claude CLI 에 돌려 일치율을
 * 잰다. 목표 ≥80% 일치, 특히 "뜻 통함 → MINOR" 과대 MAJOR 판정 감소. **운영 DB 를 바꾸지 않는다**.
 *
 * 실행(우분투 미러): cd ~/.node-local/thekaiwa && node --env-file=.env --import tsx tests/live/talk-severity-boundary-measure.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { llm } from '../../src/modules/engine'
import { buildTalkRequest, checkTalkResponse, type TutorResponse } from '../../src/modules/conversation'

interface Item {
  id: string
  category: string
  input: string
  expectedSeverity: 'MINOR' | 'MAJOR'
  note: string
}
const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/talk-severity-boundary.json'), 'utf8')) as { items: Item[] }
const learner = { displayName: '브라운', teacherName: '유우', level: 'N4', weaknesses: ['CONJUGATION(3)', 'PARTICLE(2)'], streakDays: 4 }

interface RunRow {
  id: string
  category: string
  expected: 'MINOR' | 'MAJOR'
  ok: boolean
  ms: number
  detected: boolean
  actual: 'MINOR' | 'MAJOR' | null
  match: boolean
  violations?: number
  error?: string
}

async function run(it: Item): Promise<RunRow> {
  const req = buildTalkRequest({ todayKst: '2026-09-28', learner, history: [], text: it.input, correctionMode: 'FLUENCY' })
  const t0 = Date.now()
  try {
    const r = await llm.completeJson<TutorResponse>({ ...req, timeoutMs: 20_000 })
    const ms = Date.now() - t0
    const v = checkTalkResponse(it.input, r.data)
    const c = r.data.correction
    const actual = c?.severity ?? null
    return { id: it.id, category: it.category, expected: it.expectedSeverity, ok: true, ms, detected: Boolean(c), actual, match: actual === it.expectedSeverity, violations: v.length }
  } catch (e) {
    const err = e as Error
    return { id: it.id, category: it.category, expected: it.expectedSeverity, ok: false, ms: Date.now() - t0, detected: false, actual: null, match: false, error: `${err.name}: ${err.message.slice(0, 200)}` }
  }
}

async function main() {
  console.log(`talk severity 경계(task-010c Leader 후속) 실측 — FLUENCY ${fixture.items.length}문장`)
  const rows: RunRow[] = []
  for (const it of fixture.items) {
    rows.push(await run(it))
    console.log(JSON.stringify(rows[rows.length - 1]))
  }

  console.log(`\n## 요약 — n=${rows.length}`)
  console.log('| id | category | expected | actual | detected | match | ms | 위반 |')
  console.log('|---|---|---|---|---|---|---|---|')
  for (const r of rows) {
    if (!r.ok) {
      console.log(`| ${r.id} | ${r.category} | ${r.expected} | FAILED | - | - | ${r.ms} | - | ${r.error} |`)
      continue
    }
    console.log(`| ${r.id} | ${r.category} | ${r.expected} | ${r.actual ?? 'null'} | ${r.detected} | ${r.match ? 'OK' : 'MISS'} | ${r.ms} | ${r.violations} |`)
  }
  const matched = rows.filter((r) => r.match).length
  const rate = (matched / rows.length) * 100
  console.log(`\n일치율 ${matched}/${rows.length} = ${rate.toFixed(1)}% (목표 ≥80%)`)
  const minorRows = rows.filter((r) => r.expected === 'MINOR')
  const minorOverMajor = minorRows.filter((r) => r.actual === 'MAJOR').length
  console.log(`"뜻 통함(MINOR 기대)" 과대 MAJOR 판정: ${minorOverMajor}/${minorRows.length}`)
  const majorRows = rows.filter((r) => r.expected === 'MAJOR')
  const majorUnderMinor = majorRows.filter((r) => r.actual === 'MINOR').length
  console.log(`"뜻 안 통함(MAJOR 기대)" 과소 MINOR 판정: ${majorUnderMinor}/${majorRows.length}`)
  writeFileSync('/tmp/kaiwa-talk-severity-boundary-measure.json', JSON.stringify({ at: new Date().toISOString(), rows, rate }, null, 1))
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
