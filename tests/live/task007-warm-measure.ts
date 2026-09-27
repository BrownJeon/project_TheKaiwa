/**
 * task-007 예열 A/B(어댑터 수준) — 같은 TALK 요청 모양(실제 `buildTalkRequest` 페르소나·지시)으로 cold spawn 과 예열 프로세스를 번갈아
 * N 회씩 불러 "보낸 뒤 첫 텍스트 조각"·"결과까지" 를 잰다. 설정(DB connection)을 바꾸지 않고 비교하려고 engine 어댑터를 직접 쓴다.
 * 실행(우분투 미러): `node --env-file=.env --import tsx tests/live/task007-warm-measure.ts [N=3]` — Claude CLI 2N 회. 학습자 데이터 없음(가짜 헤더).
 */
import { callClaudeDetailed, drainWarmPool, prewarmClaude } from '../../src/modules/engine/adapters/llm/claudeCli'
import { withJsonOnly } from '../../src/modules/engine/json/schemaValidate'
import { renderTranscript } from '../../src/modules/engine/llm'
import { buildTalkRequest } from '../../src/modules/conversation/prompts/talk'

const N = Number(process.argv[2] ?? 3)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const pct = (xs: number[], p: number) => {
  const v = [...xs].sort((a, b) => a - b)
  return v.length ? v[Math.min(v.length - 1, Math.ceil((p / 100) * v.length) - 1)] : NaN
}

async function main(): Promise<void> {
  const texts = ['昨日映画を見に行くました', '週末は友達と公園に行きます', '日本語の勉強は楽しいです', '朝ごはんにパンを食べました', '来週旅行に行く予定です', '雨が降っているので家にいます']
  const rows: { mode: string; firstMs: number; totalMs: number; warm: string }[] = []
  for (let i = 0; i < N * 2; i++) {
    const req = buildTalkRequest({ todayKst: '2026-09-28', learner: { level: 'N5', displayName: '学習者' }, history: [], text: texts[i % texts.length] })
    const prompt = renderTranscript(withJsonOnly(req.system, req.jsonSchema), req.messages)
    const opts = { model: 'haiku', systemPrompt: req.persona!.prompt, thinking: false, timeoutMs: 30_000, maxAttempts: 1 }
    const warm = i % 2 === 1
    drainWarmPool()
    if (warm) {
      prewarmClaude(opts)
      await sleep(4_000)
    }
    const t0 = performance.now()
    let first: number | null = null
    const r = await callClaudeDetailed(prompt, { ...opts, onTextDelta: () => (first ??= performance.now() - t0) })
    rows.push({ mode: warm ? 'warm' : 'cold', firstMs: Math.round(first ?? NaN), totalMs: Math.round(performance.now() - t0), warm: r.warm })
    console.log(`#${i + 1} ${warm ? 'warm' : 'cold'}(${r.warm}) first=${Math.round(first ?? NaN)}ms total=${Math.round(performance.now() - t0)}ms`)
    drainWarmPool()
    await sleep(1_000)
  }
  for (const mode of ['cold', 'warm']) {
    const r = rows.filter((x) => x.mode === mode)
    console.log(`${mode}: n=${r.length} first p50=${pct(r.map((x) => x.firstMs), 50)}ms total p50=${pct(r.map((x) => x.totalMs), 50)}ms`)
  }
}

main()
  .catch((e) => console.error('예외:', e instanceof Error ? `${e.name}: ${e.message.slice(0, 200)}` : String(e)))
  .finally(() => {
    drainWarmPool()
    setTimeout(() => process.exit(0), 500)
  })
