/**
 * task-006 실측 — 실제 Claude CLI(구독)로 A3(REVIEW, `buildChatReviewRequest`)를 돌려 지연·검출률·오탐·
 * 인용 규칙(`isVerbatimQuote`) 준수·계약 위반(dropped) 을 잰다. **운영 DB 를 바꾸지 않는다**(connection 은
 * 읽기만, 결과는 stdout·/tmp 파일). 픽스처는 합성 채팅 1건뿐이다(`tests/prompts/fixtures/chat-review.json`).
 *
 * 비용 상한: A3 호출은 총 6회 이내(task-006 지시). 기본 --runs 3.
 *
 * 실행(우분투 미러): cd ~/.node-local/thekaiwa && node --env-file=.env --import tsx tests/live/chat-review-measure.ts [--runs 3]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { llm } from '../../src/modules/engine'
import { buildChatReviewRequest, isVerbatimQuote, type ChatReviewResponse } from '../../src/modules/conversation'

type Fixture = {
  messages: { id: string; text: string }[]
  expectedFindings: { messageId: string; sentenceOriginal: string; errorType: string; expectedCorrected: string }[]
  cleanMessageIds: string[]
}
const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/chat-review.json'), 'utf8')) as Fixture
const byId = new Map(fixture.messages.map((m) => [m.id, m.text]))

const args = process.argv.slice(2)
const arg = (k: string, d: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : d)
const runs = Number(arg('--runs', '3'))
const learner = { displayName: '브라운', teacherName: '유우', level: 'N4', weaknesses: ['PARTICLE(4)', 'CONJUGATION(2)'], streakDays: 6 }

const pct = (xs: number[], p: number) => {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]
}
// 엔진명·모델명이 사용자 화면에 새면 안 된다(design-spec 금기) — summary_ko·explanation_ko·strengths·focus 전부 검사.
const ENGINE_LEAK = /claude|haiku|sonnet|opus|qwen|anthropic/i

function scanEngineLeak(data: ChatReviewResponse): string[] {
  const hay = [data.summary_ko, ...data.strengths, ...data.focus, ...data.items.flatMap((it) => [it.explanation_ko, it.original, it.corrected])]
  return hay.filter((s) => ENGINE_LEAK.test(s))
}

interface RunOk {
  label: string
  ok: true
  ms: number
  attempts?: 1 | 2
  model: string
  promptChars: number
  connectionKey: string
  itemCount: number
  detectRate: string
  errorTypeMatch: string
  falsePositives: number
  falsePositiveIds: string[]
  quoteViolations: number
  noOpCorrections: number
  unknownIds: number
  engineLeaks: number
  summaryKo: string
  detected: { messageId: string; found: boolean; errorTypeMatch: boolean; corrected: string | null }[]
}
interface RunFail {
  label: string
  ok: false
  ms: number
  name?: string
  message: string
  violations?: string[]
}
type RunResult = RunOk | RunFail

async function runOnce(label: string): Promise<RunResult> {
  const req = buildChatReviewRequest({ todayKst: '2026-09-27', learner, messages: fixture.messages })
  const t0 = Date.now()
  try {
    const r = await llm.completeJson<ChatReviewResponse>({ ...req, timeoutMs: 100_000 })
    const ms = Date.now() - t0
    const data = r.data

    // 검출률: expectedFindings 각각에 대해 같은 message_id 로 잡았고, original 이 그 문장(또는 메시지 전체)과 바이트
    // 일치하는 항목이 있는지 — errorType 은 참고용(분류 기준 차이는 오분류로 세지 않는다, task-004 실측과 같은 기준).
    const detected = fixture.expectedFindings.map((exp) => {
      const hit = data.items.find((it) => it.message_id === exp.messageId && isVerbatimQuote(byId.get(exp.messageId) ?? '', it.original))
      return { messageId: exp.messageId, found: Boolean(hit), errorTypeMatch: Boolean(hit && hit.error_type === exp.errorType), corrected: hit?.corrected ?? null }
    })
    // 오탐: cleanMessageIds 인데 items 에 등장.
    const falsePositives = fixture.cleanMessageIds.filter((id) => data.items.some((it) => it.message_id === id))
    // 인용 규칙: 모든 item 의 original 이 해당 메시지 전체 또는 그 안의 문장 하나 전체와 바이트 일치하는지.
    const quoteViolations = data.items.filter((it) => {
      const text = byId.get(it.message_id)
      return text === undefined || !isVerbatimQuote(text, it.original)
    })
    // corrected 가 original 과 같은 무의미 교정.
    const noOpCorrections = data.items.filter((it) => it.corrected === it.original)
    const unknownIds = data.items.filter((it) => !byId.has(it.message_id))
    const leaks = scanEngineLeak(data)

    return {
      label, ok: true, ms, attempts: r.attempts, model: r.model, promptChars: r.promptChars, connectionKey: r.connectionKey,
      itemCount: data.items.length,
      detectRate: `${detected.filter((d) => d.found).length}/${detected.length}`,
      errorTypeMatch: `${detected.filter((d) => d.errorTypeMatch).length}/${detected.length}`,
      falsePositives: falsePositives.length, falsePositiveIds: falsePositives,
      quoteViolations: quoteViolations.length,
      noOpCorrections: noOpCorrections.length,
      unknownIds: unknownIds.length,
      engineLeaks: leaks.length,
      summaryKo: data.summary_ko,
      detected,
    }
  } catch (e) {
    const err = e as Error & { violations?: string[] }
    return { label, ok: false, ms: Date.now() - t0, name: err.name, message: err.message.slice(0, 300), violations: err.violations?.slice(0, 5) }
  }
}

async function main() {
  console.log(`chat-review(A3) 실측 — 메시지 ${fixture.messages.length}건(오류 기대 ${fixture.expectedFindings.length}·정답 ${fixture.cleanMessageIds.length}), ${runs}회`)
  const rows: RunResult[] = []
  for (let i = 0; i < runs; i++) {
    const row = await runOnce(`run${i + 1}`)
    rows.push(row)
    console.log(JSON.stringify(row, null, 1))
  }
  const ok = rows.filter((r): r is RunOk => r.ok)
  const dropped = rows.length - ok.length
  const ms = ok.map((r) => r.ms)
  console.log('\n## 요약')
  console.log(`n=${rows.length} dropped(계약 위반 최종 실패)=${dropped} p50=${pct(ms, 50)}ms max=${Math.max(...ms, 0)}ms over90s=${ms.filter((x) => x > 90_000).length}`)
  console.log(`검출률(런별): ${ok.map((r) => r.detectRate).join(', ')}`)
  console.log(`오탐 합계: ${ok.reduce((n, r) => n + r.falsePositives, 0)} · 인용 위반 합계: ${ok.reduce((n, r) => n + r.quoteViolations, 0)} · no-op 교정 합계: ${ok.reduce((n, r) => n + r.noOpCorrections, 0)} · 엔진명 누출 합계: ${ok.reduce((n, r) => n + r.engineLeaks, 0)}`)
  writeFileSync('/tmp/kaiwa-chat-review-measure.json', JSON.stringify({ at: new Date().toISOString(), runs: rows }, null, 1))
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
