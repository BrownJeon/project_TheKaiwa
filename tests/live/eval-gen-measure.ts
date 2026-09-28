/**
 * task-011 실측 — 실제 Claude CLI(구독)로 A6(EVAL_GEN, `buildEvalGenRequest`)를 WORDS 2회·TALK 2회 돌려 지연·JSON
 * 계약 준수(개수·분배·재료 비율·엔진명)·14일 해시 중복 회피가 실제로 작동하는지 잰다. **운영 DB 를 바꾸지 않는다**
 * (읽기 전용, 결과는 stdout·/tmp 파일). 픽스처는 합성 데이터뿐이다(`tests/prompts/fixtures/evalGen.json`).
 *
 * 각 kind 2회 중 **두 번째 호출에는 첫 번째 호출 결과의 해시를 `recentHashes` 로 넘겨** 14일 중복 회피 검사가 실제
 * 재시도를 유발하는지도 함께 본다(같은 15개 재료를 그대로 재사용하는 최악 조건).
 *
 * 실행(우분투 미러): cd ~/.node-local/thekaiwa && node --env-file=.env --import tsx tests/live/eval-gen-measure.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { llm } from '../../src/modules/engine'
import { buildEvalGenRequest, checkEvalGenResponse, computeEvalItemHash, type EvalGenInput, type EvalGenResponse, type EvalGenWordCandidate, type EvalKind } from '../../src/modules/conversation'

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
  model?: string
  promptChars?: number
  violations: number
  materialRatio?: number
  counts?: Record<string, number>
  error?: string
}

async function runOnce(label: string, kind: EvalKind, recentHashes: string[]): Promise<{ row: RunRow; hashes: string[] }> {
  const req = buildEvalGenRequest({
    todayKst: '2026-09-28', kind, level: fixture.level as EvalGenInput['level'],
    topic: kind === 'TALK' ? fixture.topic : null,
    materials: fixture.materials, recentHashes,
  })
  const t0 = Date.now()
  try {
    const r = await llm.completeJson<EvalGenResponse>({ ...req, timeoutMs: 120_000 })
    const ms = Date.now() - t0
    const candidateSurfaces = fixture.materials.map((m) => m.surface)
    const violations = checkEvalGenResponse({ kind, candidateSurfaces, recentHashes: new Set(recentHashes) }, r.data)
    const counts: Record<string, number> = {}
    for (const it of r.data.items) counts[it.kind] = (counts[it.kind] ?? 0) + 1
    const linked = r.data.items.filter((it) => it.wordSurface && candidateSurfaces.includes(it.wordSurface)).length
    const hashes = r.data.items.map((it) => computeEvalItemHash(it))
    return {
      row: { label, ok: true, ms, attempts: r.attempts, model: r.model, promptChars: r.promptChars, violations: violations.length, materialRatio: linked / r.data.items.length, counts },
      hashes,
    }
  } catch (e) {
    const err = e as Error
    return { row: { label, ok: false, ms: Date.now() - t0, violations: -1, error: `${err.name}: ${err.message.slice(0, 300)}` }, hashes: [] }
  }
}

async function main() {
  console.log('eval-gen(A6) 실측 — WORDS 2회 + TALK 2회(두 번째는 첫 번째 해시로 14일 중복 회피 확인)')
  const rows: RunRow[] = []

  const w1 = await runOnce('WORDS#1', 'WORDS', [])
  rows.push(w1.row)
  console.log(JSON.stringify(w1.row))
  const w2 = await runOnce('WORDS#2(dedup)', 'WORDS', w1.hashes)
  rows.push(w2.row)
  console.log(JSON.stringify(w2.row))

  const t1 = await runOnce('TALK#1', 'TALK', [])
  rows.push(t1.row)
  console.log(JSON.stringify(t1.row))
  const t2 = await runOnce('TALK#2(dedup)', 'TALK', t1.hashes)
  rows.push(t2.row)
  console.log(JSON.stringify(t2.row))

  const succeeded = rows.filter((r) => r.ok)
  console.log(`\n## 요약 — n=${rows.length} 성공=${succeeded.length} 실패=${rows.length - succeeded.length}`)
  console.log('| run | 성공 | ms | attempts | 위반 | 재료비율 |')
  console.log('|---|---|---|---|---|---|')
  for (const r of rows) {
    if (!r.ok) {
      console.log(`| ${r.label} | FAILED | ${r.ms} | - | - | - | ${r.error} |`)
      continue
    }
    console.log(`| ${r.label} | OK | ${r.ms} | ${r.attempts} | ${r.violations} | ${((r.materialRatio ?? 0) * 100).toFixed(0)}% |`)
  }
  writeFileSync('/tmp/kaiwa-eval-gen-measure.json', JSON.stringify({ at: new Date().toISOString(), rows }, null, 1))
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
