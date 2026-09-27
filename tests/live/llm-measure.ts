/**
 * task-004 실측 — 실제 Claude CLI(구독)로 TALK 경로를 돌려 지연·계약 준수·교정 품질을 잰다. **운영 DB 를 바꾸지 않는다**
 * (connection 은 읽기만, 결과는 stdout·/tmp 파일). 픽스처는 합성 문장뿐이다.
 *
 * 실행(우분투 미러): cd ~/.node-local/thekaiwa && node --import tsx tests/live/llm-measure.ts [--runs-baseline 3] [--variant flag|noflag|both]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { callClaude } from '../../src/modules/engine/adapters/llm/claudeCli'
import { llm } from '../../src/modules/engine'
import { buildTalkRequest, splitJaSentences, type TutorResponse } from '../../src/modules/conversation'

type Item = { id: string; level: string; input: string; hasError: boolean; expectedCorrected?: string; errorType?: string }
const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/talk-corrections.json'), 'utf8')) as { items: Item[] }
const args = process.argv.slice(2)
const arg = (k: string, d: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : d)
const variant = arg('--variant', 'both')
const baselineRuns = Number(arg('--runs-baseline', '3'))
const only = arg('--only', '').split(',').filter(Boolean)
const learner = { displayName: '브라운', teacherName: '유우', level: 'N5', weaknesses: ['CONJUGATION(3)', 'PARTICLE(2)'], streakDays: 4 }

const pct = (xs: number[], p: number) => {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]
}
const norm = (s: string) => s.replace(/[\s、。！？!?]/g, '')

async function baseline() {
  const out: number[] = []
  for (let i = 0; i < baselineRuns; i++) {
    const t = Date.now()
    await callClaude('「OK」とだけ答えてください。', { model: 'haiku', systemPrompt: 'あなたは日本語の先生です。', timeoutMs: 60_000, maxAttempts: 1 })
    out.push(Date.now() - t)
  }
  return out
}

async function runTalk(label: string) {
  const rows: Record<string, unknown>[] = []
  for (const it of fixture.items.filter((x) => only.length === 0 || only.includes(x.id))) {
    const req = buildTalkRequest({ todayKst: '2026-09-27', learner, history: [], text: it.input })
    const t = Date.now()
    try {
      // 12s fail-fast 가 운영 값이지만 분포를 보려고 실측은 60s 까지 허용하고, 12s 초과 건수를 따로 센다.
      const r = await llm.completeJson<TutorResponse>({ ...req, timeoutMs: 60_000 })
      const c = r.data.correction
      // task-007 K4-4: JSON.parse 는 소스 텍스트의 키 순서로 프로퍼티를 넣는다(extractAndValidate 가 재구성 없이
      // parsed 를 그대로 돌려준다) — 그래서 Object.keys(r.data) 가 모델이 실제로 낸 키 순서다(가공 아님).
      const topOrder = Object.keys(r.data as object)
      const convOrder = Object.keys(r.data.conversation as object)
      const topOrderOk = topOrder.includes('speech') && topOrder.includes('conversation') && topOrder.indexOf('speech') < topOrder.indexOf('conversation')
      const convOrderOk = convOrder[0] === 'replyJa'
      const sentences = splitJaSentences(r.data.conversation.replyJa)
      rows.push({
        id: it.id, ms: r.elapsedMs, attempts: r.attempts, model: r.model, promptChars: r.promptChars,
        hasError: it.hasError, detected: Boolean(c), errorType: c?.errorType ?? null, expectedType: it.errorType ?? null,
        correctedMatch: c && it.expectedCorrected ? norm(c.corrected) === norm(it.expectedCorrected) : null,
        replyJa: r.data.conversation.replyJa, corrected: c?.corrected ?? null,
        topOrder, convOrder, topOrderOk, convOrderOk,
        sentenceCount: sentences.length, firstSentenceChars: sentences[0]?.length ?? 0,
      })
    } catch (e) {
      rows.push({ id: it.id, ms: Date.now() - t, error: (e as Error).name + ': ' + (e as Error).message.slice(0, 160) })
    }
    process.stdout.write('.')
  }
  process.stdout.write('\n')
  const ok = rows.filter((r) => !r.error)
  const ms = ok.map((r) => r.ms as number)
  const errs = ok.filter((r) => r.hasError)
  const clean = ok.filter((r) => !r.hasError)
  const firstSentenceChars = ok.map((r) => r.firstSentenceChars as number)
  return {
    label,
    n: rows.length,
    failures: rows.length - ok.length,
    retried: ok.filter((r) => r.attempts === 2).length,
    p50: pct(ms, 50), p95: pct(ms, 95), max: Math.max(...ms), over12s: ms.filter((x) => x > 12_000).length,
    detectRate: `${errs.filter((r) => r.detected).length}/${errs.length}`,
    falsePositive: `${clean.filter((r) => r.detected).length}/${clean.length}`,
    typeMatch: `${errs.filter((r) => r.errorType === r.expectedType).length}/${errs.length}`,
    correctedExact: `${errs.filter((r) => r.correctedMatch === true).length}/${errs.length}`,
    // task-007 K4-4: 키 순서 준수율 — top: speech 가 conversation 보다 앞, conv: replyJa 가 conversation 의 첫 키.
    topOrderRate: `${ok.filter((r) => r.topOrderOk).length}/${ok.length}`,
    convOrderRate: `${ok.filter((r) => r.convOrderOk).length}/${ok.length}`,
    bothOrderRate: `${ok.filter((r) => r.topOrderOk && r.convOrderOk).length}/${ok.length}`,
    // pct(xs, 0) 은 기존 헬퍼의 인덱스 계산이 -1 이 되는 경계 버그가 있어(p=0 미사용) min 은 직접 구한다.
    firstSentenceChars: {
      min: firstSentenceChars.length ? Math.min(...firstSentenceChars) : NaN,
      p50: pct(firstSentenceChars, 50),
      p90: pct(firstSentenceChars, 90),
      max: firstSentenceChars.length ? Math.max(...firstSentenceChars) : NaN,
    },
    rows,
  }
}

async function main() {
  const b = await baseline()
  console.log(`baseline haiku 'OK' ms: ${b.join(', ')} (p50 ${pct(b, 50)})`)
  const results = []
  if (variant === 'noflag' || variant === 'both') {
    process.env.KAIWA_LLM_JSON_SCHEMA_FLAG = '0'
    results.push(await runTalk('--json-schema OFF(프롬프트 스키마, 기본)'))
  }
  if (variant === 'flag' || variant === 'both') {
    process.env.KAIWA_LLM_JSON_SCHEMA_FLAG = '1'
    results.push(await runTalk('--json-schema ON'))
  }
  for (const r of results) {
    console.log(`\n## ${r.label}\nn=${r.n} 실패=${r.failures} 재시도=${r.retried} p50=${r.p50}ms p95=${r.p95}ms max=${r.max}ms 12s초과=${r.over12s}`)
    console.log(`오류 검출 ${r.detectRate} · 오탐(정답 문장 교정) ${r.falsePositive} · 유형 일치 ${r.typeMatch} · 교정문 정확 일치 ${r.correctedExact}`)
    console.log(`키 순서 준수 — top(speech<conversation) ${r.topOrderRate} · conv(replyJa 첫키) ${r.convOrderRate} · 둘 다 ${r.bothOrderRate}`)
    console.log(`replyJa 첫 문장 글자 수 — min ${r.firstSentenceChars.min} p50 ${r.firstSentenceChars.p50} p90 ${r.firstSentenceChars.p90} max ${r.firstSentenceChars.max}`)
    for (const row of r.rows) console.log(JSON.stringify(row))
  }
  writeFileSync('/tmp/kaiwa-llm-measure.json', JSON.stringify({ at: new Date().toISOString(), baseline: b, results }, null, 1))
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
