/**
 * task-010c 실측 — 실제 Claude CLI(구독)로 A1 TALK(`talk@v3`, `buildTalkRequest`)의 교정 방식(correctionMode)을
 * 돌려 지연·JSON 계약·`hintKo` 품질·severity 분포를 잰다. **운영 DB 를 바꾸지 않는다**.
 *
 * 지시(task-010c): 유창성 3턴·코치 3턴 — 같은 오류 문장 3개(`tests/prompts/fixtures/talk-corrections.json` 의
 * e01~e03, 조사·활용·존댓말 계열)를 두 모드로 각각 돌려 A/B 비교한다(총 6회).
 *
 * 실행(우분투 미러): cd ~/.node-local/thekaiwa && node --env-file=.env --import tsx tests/live/talk-correction-mode-measure.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { llm } from '../../src/modules/engine'
import { buildTalkRequest, checkTalkResponse, type TutorResponse } from '../../src/modules/conversation'

interface Item {
  id: string
  level: string
  input: string
  hasError: boolean
  expectedCorrected?: string
  errorType?: string
}
const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/talk-corrections.json'), 'utf8')) as { items: Item[] }
const items = fixture.items.filter((x) => ['e01', 'e02', 'e03'].includes(x.id))
const learner = { displayName: '브라운', teacherName: '유우', level: 'N5', weaknesses: ['CONJUGATION(3)', 'PARTICLE(2)'], streakDays: 4 }

interface RunRow {
  id: string
  mode: 'FLUENCY' | 'COACH'
  ok: boolean
  ms: number
  attempts?: 1 | 2
  promptChars?: number
  severity?: string | null
  hintKo?: string | null
  hintLeaksCorrected?: boolean
  violations?: number
  error?: string
}

async function run(it: Item, mode: 'FLUENCY' | 'COACH'): Promise<RunRow> {
  const req = buildTalkRequest({ todayKst: '2026-09-28', learner, history: [], text: it.input, correctionMode: mode })
  const t0 = Date.now()
  try {
    const r = await llm.completeJson<TutorResponse>({ ...req, timeoutMs: 20_000 })
    const ms = Date.now() - t0
    const v = checkTalkResponse(it.input, r.data)
    const c = r.data.correction
    return {
      id: it.id, mode, ok: true, ms, attempts: r.attempts, promptChars: r.promptChars,
      severity: c?.severity ?? null, hintKo: c?.hintKo ?? null,
      hintLeaksCorrected: Boolean(c?.hintKo && c.corrected && c.hintKo.includes(c.corrected)),
      violations: v.length,
    }
  } catch (e) {
    const err = e as Error
    return { id: it.id, mode, ok: false, ms: Date.now() - t0, error: `${err.name}: ${err.message.slice(0, 200)}` }
  }
}

async function main() {
  console.log(`talk correctionMode(task-010c) 실측 — FLUENCY 3턴 + COACH 3턴 (${items.map((i) => i.id).join(',')})`)
  const rows: RunRow[] = []
  for (const it of items) {
    rows.push(await run(it, 'FLUENCY'))
    console.log(JSON.stringify(rows[rows.length - 1]))
  }
  for (const it of items) {
    rows.push(await run(it, 'COACH'))
    console.log(JSON.stringify(rows[rows.length - 1]))
  }

  console.log(`\n## 요약 — n=${rows.length} 성공=${rows.filter((r) => r.ok).length}`)
  console.log('| id | mode | 성공 | ms | attempts | severity | hintKo | 정답누출 | 위반 |')
  console.log('|---|---|---|---|---|---|---|---|---|')
  for (const r of rows) {
    if (!r.ok) {
      console.log(`| ${r.id} | ${r.mode} | FAILED | ${r.ms} | - | - | - | - | - | ${r.error} |`)
      continue
    }
    console.log(`| ${r.id} | ${r.mode} | OK | ${r.ms} | ${r.attempts} | ${r.severity} | ${r.hintKo ?? 'null'} | ${r.hintLeaksCorrected} | ${r.violations} |`)
  }
  const coach = rows.filter((r) => r.mode === 'COACH' && r.ok)
  console.log(`\nCOACH hintKo 채움 ${coach.filter((r) => r.hintKo).length}/${coach.length}, 정답 누출 ${coach.filter((r) => r.hintLeaksCorrected).length}/${coach.length}`)
  const fluency = rows.filter((r) => r.mode === 'FLUENCY' && r.ok)
  console.log(`FLUENCY hintKo=null 준수 ${fluency.filter((r) => r.hintKo === null).length}/${fluency.length}`)
  writeFileSync('/tmp/kaiwa-talk-correction-mode-measure.json', JSON.stringify({ at: new Date().toISOString(), rows }, null, 1))
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
