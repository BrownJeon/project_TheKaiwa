/**
 * task-008 실측 — 실제 Claude CLI(구독)로 A10(WORD_ENRICH, `buildWordEnrichRequest`)를 돌려 지연·JSON 계약 준수·
 * valid 판정 정확도·품질(뜻·품사·읽기)을 잰다. **운영 DB 를 바꾸지 않는다**(connection 은 읽기만, 결과는
 * stdout·/tmp 파일). 픽스처는 합성 표현 12건뿐이다(`tests/prompts/fixtures/word-enrich.json`).
 *
 * 비용 상한(Leader 지시, task-008): 픽스처 전체 1회 + 대표 3개 반복 2회 = 총 18회 이내.
 * 기본 실행은 그 계획 그대로: 전체 12건 1패스 + `--repeat` 로 고른 3개(기본 w01·w04·w07 — 한자어·활용형·가타카나
 * 외래어, 검증하려는 함정이 실제로 걸리는 항목들)를 2회 더.
 *
 * 실행(우분투 미러): cd ~/.node-local/thekaiwa && node --env-file=.env --import tsx tests/live/word-enrich-measure.ts [--repeat-ids w01,w04,w07] [--repeat-runs 2]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { llm } from '../../src/modules/engine'
import { buildWordEnrichRequest, type WordEnrichResponse } from '../../src/modules/conversation'

interface FixtureItem {
  id: string
  surface: string
  level: string | null
  valid: boolean
  expectedPartOfSpeech?: string
  expectedJlpt?: string | null
  expectedReading?: string
  meaningKeywords?: string[]
}
const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/word-enrich.json'), 'utf8')) as { items: FixtureItem[] }

const args = process.argv.slice(2)
const arg = (k: string, d: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : d)
const repeatIds = arg('--repeat-ids', 'w01,w04,w07').split(',').filter(Boolean)
const repeatRuns = Number(arg('--repeat-runs', '2'))

const pct = (xs: number[], p: number) => {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]
}
// 엔진명·모델명이 사용자 화면(단어장 draft)에 새면 안 된다 — meaning·example·exampleKo·invalidReason 전부 검사.
const ENGINE_LEAK = /claude|haiku|sonnet|opus|qwen|anthropic|home-m4/i
function scanEngineLeak(d: WordEnrichResponse): string[] {
  const hay = [d.meaning, d.example, d.exampleKo, d.invalidReason].filter((s): s is string => Boolean(s))
  return hay.filter((s) => ENGINE_LEAK.test(s))
}

interface RunOk {
  id: string
  ok: true
  ms: number
  attempts?: 1 | 2
  model: string
  promptChars: number
  data: WordEnrichResponse
  validMatch: boolean
  readingExactMatch: boolean | null
  posMatch: boolean | null
  jlptMatch: boolean | null
  meaningKeywordHit: boolean | null
  exampleContainsSurface: boolean | null
  engineLeaks: number
}
interface RunFail {
  id: string
  ok: false
  ms: number
  name?: string
  message: string
  violations?: string[]
}
type RunResult = RunOk | RunFail

async function runOnce(it: FixtureItem): Promise<RunResult> {
  const req = buildWordEnrichRequest({ surface: it.surface, level: it.level })
  const t0 = Date.now()
  try {
    // 운영 예산은 20s(LLM_TASKS.wordEnrich) — 분포를 보려고 실측은 40s 까지 허용하고, 20s 초과는 결과에서 따로 센다.
    // completeJson 이 이미 checkWordEnrich(어간 근사 포함, VERB·ADJ_I 는 활용형 허용)로 재시도·드롭을 처리했으므로,
    // 여기까지 온 데이터는 그 검사를 통과한 것이다 — `dropped` 카운트가 실제 계약 위반율의 근거다.
    const r = await llm.completeJson<WordEnrichResponse>({ ...req, timeoutMs: 40_000 })
    const d = r.data
    const meaningHit = it.valid && it.meaningKeywords ? it.meaningKeywords.some((k) => (d.meaning ?? '').includes(k)) : null
    return {
      id: it.id, ok: true, ms: Date.now() - t0, attempts: r.attempts, model: r.model, promptChars: r.promptChars, data: d,
      validMatch: d.valid === it.valid,
      readingExactMatch: it.valid && it.expectedReading ? d.reading === it.expectedReading : null,
      posMatch: it.valid && it.expectedPartOfSpeech ? d.partOfSpeech === it.expectedPartOfSpeech : null,
      jlptMatch: it.valid && it.expectedJlpt !== undefined ? d.jlpt === it.expectedJlpt : null,
      meaningKeywordHit: meaningHit,
      // 주의: 이건 **리터럴 전체 일치**만 본다(정보용 지표). 실제 통과 기준(VERB·ADJ_I 어간 근사)은
      // `checkWordEnrich`/`exampleCoversSurface`(conversation/structuredResponse/checks.ts, export 안 됨)가
      // completeJson 안에서 이미 적용했다 — 그래서 false 라도 `dropped` 에는 안 잡힐 수 있다(활용형으로 통과한 경우).
      exampleContainsSurface: it.valid ? Boolean(d.example && d.example.includes(it.surface)) : null,
      engineLeaks: scanEngineLeak(d).length,
    }
  } catch (e) {
    const err = e as Error & { violations?: string[] }
    return { id: it.id, ok: false, ms: Date.now() - t0, name: err.name, message: err.message.slice(0, 300), violations: err.violations?.slice(0, 5) }
  }
}

async function main() {
  console.log(`word-enrich(A10) 실측 — 픽스처 ${fixture.items.length}건(유효 ${fixture.items.filter((x) => x.valid).length}·무효 ${fixture.items.filter((x) => !x.valid).length}) 1패스 + 대표 ${repeatIds.join(',')} ${repeatRuns}회 반복`)
  const rows: RunResult[] = []
  for (const it of fixture.items) {
    const row = await runOnce(it)
    rows.push(row)
    console.log(JSON.stringify(row))
  }
  const repeatRows: RunResult[] = []
  for (const id of repeatIds) {
    const it = fixture.items.find((x) => x.id === id)
    if (!it) continue
    for (let i = 0; i < repeatRuns; i++) {
      const row = await runOnce(it)
      repeatRows.push(row)
      console.log(JSON.stringify({ ...row, repeatRun: i + 1 }))
    }
  }
  const all = [...rows, ...repeatRows]
  const ok = all.filter((r): r is RunOk => r.ok)
  const dropped = all.length - ok.length
  const ms = ok.map((r) => r.ms)
  console.log(`\n## 요약 (n=${all.length}, 1패스=${rows.length} + 반복=${repeatRows.length})`)
  console.log(`dropped(JSON 계약 최종 실패)=${dropped} 재시도=${ok.filter((r) => r.attempts === 2).length} p50=${pct(ms, 50)}ms p95=${pct(ms, 95)}ms max=${Math.max(...ms, 0)}ms 20s초과=${ms.filter((x) => x > 20_000).length}`)
  console.log(`valid 판정 일치 ${ok.filter((r) => r.validMatch).length}/${ok.length}`)
  const withReading = ok.filter((r) => r.readingExactMatch !== null)
  console.log(`reading 정확 일치 ${withReading.filter((r) => r.readingExactMatch).length}/${withReading.length}`)
  const withPos = ok.filter((r) => r.posMatch !== null)
  console.log(`partOfSpeech 일치 ${withPos.filter((r) => r.posMatch).length}/${withPos.length}`)
  const withJlpt = ok.filter((r) => r.jlptMatch !== null)
  console.log(`jlpt 일치 ${withJlpt.filter((r) => r.jlptMatch).length}/${withJlpt.length}`)
  const withMeaning = ok.filter((r) => r.meaningKeywordHit !== null)
  console.log(`meaning 키워드 포함 ${withMeaning.filter((r) => r.meaningKeywordHit).length}/${withMeaning.length}`)
  const withExample = ok.filter((r) => r.exampleContainsSurface !== null)
  console.log(`example surface 포함 ${withExample.filter((r) => r.exampleContainsSurface).length}/${withExample.length}`)
  console.log(`엔진명 누출 합계: ${ok.reduce((n, r) => n + r.engineLeaks, 0)}`)
  writeFileSync('/tmp/kaiwa-word-enrich-measure.json', JSON.stringify({ at: new Date().toISOString(), rows: all }, null, 1))
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
