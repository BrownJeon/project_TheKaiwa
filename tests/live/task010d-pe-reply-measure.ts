/**
 * task-010d PE-2b 실측 — 대답 연습 제안 `replyPractice@v1` 을 실제 Claude CLI(구독)로 **직렬** 호출해 계약·보정 후 유효율·지연을 잰다.
 * 합성 입력만 쓴다(`tests/prompts/fixtures/reply-practice.json` — 시드급 상황 3종 × 대화 단계 변형 + 인젝션 1건, 학습자 데이터 없음).
 *
 * 재는 것: ① 1차 통과율(재시도 없이 ajv·extraCheck 통과 = attempts 1) · 최종 실패 ② 지연 p50/p95/max(목표 p50 ≤4s·p95 ≤8s, 12s fail-fast)
 * ③ 보정 후 유효율 — 고르기 세트(blank·choices·answerIndex)가 남은 비율과 버려진 이유 · 힌트가 남은 비율(누설로 버려진 수) ④ 불변식 — `checkReplyPracticeShape` 위반 0
 * ⑤ 자동 휴리스틱 — 대답이 한 문장인가 · 핵심 표현을 쓴 비율 · 선생님 말을 그대로 따라 한 건수 ⑥ 눈 판정 재료 — 모든 응답을 표로 찍는다(정답이 하나뿐인지·어색한 일본어는 사람이 읽는다).
 *
 * **DB 를 읽지도 쓰지도 않는다** — `routerDeps.loadChain` 을 시드 모양 고정 연결로 바꿔 끼운다. `replyPractice` task 가 아직 `LLM_TASKS` 에 없어 같은 모양인 `wordEnrich`(interactive)
 * 로 부르되 tier·timeout 은 덮어쓴다(`TIMEOUT_MS` 기본 12,000 = 운영 fail-fast). 한도 신호(429 등)가 보이면 **즉시 멈춘다**.
 *
 * 실행(개발 미러, 한 번에 하나): cd ~/.node-local/thekaiwa-010d-pe2 && DATABASE_URL=mysql://invalid:invalid@127.0.0.1:1/invalid OUT=<결과.json> TIER=fast REPEAT=2 node --import tsx tests/live/task010d-pe-reply-measure.ts
 * 환경: TIER=fast|balanced(기본 fast) · REPEAT(기본 2) · GAP_MS=1000 · TIMEOUT_MS=12000 · ONLY=<case id 접두 쉼표 목록> · RESUME=1 · DUMP=1(결과 파일만 읽어 표 출력) · REFINAL=1(DUMP 와 함께 — 저장된 모델 응답을 **현재 코드**로 다시 보정·검증해 표를 낸다)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { llm } from '../../src/modules/engine'
import { routerDeps, type ResolvedConnection } from '../../src/modules/engine/router'
import { REPLY_PRACTICE_PROMPT_VERSION, buildReplyPracticeRequest, finalizeReplyPracticeResponse, type ReplyPracticeInput } from '../../src/modules/conversation/prompts/replyPractice'
import { checkReplyPracticeShape, replyPracticeViolations, type ReplyPracticeFinal, type ReplyPracticeModel } from '../../src/modules/conversation/structuredResponse/replyPractice'

interface FxScenario { level: string; roles: { learner: string; tutor: string }; goalKo: string; steps: string[]; expressions: { ja: string; ko: string }[] }
interface FxCase { id: string; scenario: string; stepIndex: number; lastTutorJa: string; recent: { role: 'learner' | 'tutor'; text: string }[] }
const fx = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/reply-practice.json'), 'utf8')) as { scenarios: Record<string, FxScenario>; cases: FxCase[] }

const OUT = process.env.OUT ?? '/tmp/kaiwa-task010d-reply-measure.json'
const TIER = (process.env.TIER ?? 'fast') as 'fast' | 'balanced'
const REPEAT = Number(process.env.REPEAT ?? 2)
const GAP_MS = Number(process.env.GAP_MS ?? 1000)
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 12_000)
const LIMIT_RE = /429|rate.?limit|usage limit|session limit|hit your|limit reached|한도|overloaded/i

const STUB_CONNECTION: ResolvedConnection = {
  id: 'stub-claude-cli-local',
  key: 'claude-cli-local',
  engineId: 'claude-cli',
  connectionType: 'CLI',
  connection: {},
  runtime: { modelByTier: { fast: 'haiku', balanced: 'sonnet', deep: 'opus' }, concurrency: 1, interactiveLane: true, permissionMode: 'dontAsk', tools: '' },
  credentialRef: null,
}
routerDeps.loadChain = async () => [STUB_CONNECTION]

interface Row {
  id: string
  case: string
  rep: number
  tier: string
  ok: boolean
  elapsedMs: number
  attempts?: 1 | 2
  model?: string
  promptChars?: number
  response?: ReplyPracticeModel
  final?: ReplyPracticeFinal
  shapeViolations?: string[]
  /** 현재 코드의 `extraCheck` 위반 수 — 0 이 아니면 그 응답은 지금 코드에서는 재시도(attempts 2)를 탔을 것이다. */
  violations?: number
  oneSentence?: boolean
  usedExpression?: boolean
  echoedTutor?: boolean
  errorName?: string
  error?: string
  limitHit?: boolean
}
interface Saved { startedAt: string; version: string; tier: string; rows: Row[] }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const pct = (xs: number[], p: number) => {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]
}
const round = (n: number, d = 1) => (Number.isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : NaN)
const save = (rows: Row[], startedAt: string) => writeFileSync(OUT, JSON.stringify({ startedAt, version: REPLY_PRACTICE_PROMPT_VERSION, tier: TIER, rows } satisfies Saved, null, 1))
const norm = (s: string) => s.normalize('NFKC').replace(/[\s、。，．,.!！?？・「」『』〜～]/g, '')

function inputFor(c: FxCase): ReplyPracticeInput {
  const s = fx.scenarios[c.scenario]
  return { level: s.level, scenario: { roles: s.roles, goalKo: s.goalKo, steps: s.steps.map((ko) => ({ ko })), stepIndex: c.stepIndex, expressions: s.expressions }, lastTutorJa: c.lastTutorJa, recent: c.recent }
}

/** 모델 응답(`response`)에서 계산되는 칸을 채운다 — 호출 직후와 `REFINAL=1` 다시 계산이 같은 경로를 쓴다(코드가 바뀐 뒤 저장된 응답을 현재 코드로 다시 보려고). */
function derive(row: Row, c: FxCase): Row {
  const data = row.response!
  const final = finalizeReplyPracticeResponse(data)
  const out: Row = { ...row, final, violations: replyPracticeViolations(data).length }
  if (final.ok && final.suggestion) {
    out.shapeViolations = checkReplyPracticeShape(final.suggestion)
    out.oneSentence = (final.suggestion.ja.match(/[。！？!?]/g) ?? []).length <= 1
    const sc = fx.scenarios[c.scenario]
    out.usedExpression = sc.expressions.some((e) => norm(final.suggestion!.ja).includes(norm(e.ja).replace(/^[〜~]/, '')))
    out.echoedTutor = norm(final.suggestion.ja) === norm(c.lastTutorJa)
  }
  return out
}

async function runCall(c: FxCase, rep: number): Promise<Row> {
  const input = inputFor(c)
  const req = buildReplyPracticeRequest(input)
  const base: Row = { id: `${c.id}#${rep}`, case: c.id, rep, tier: TIER, ok: false, elapsedMs: 0 }
  const t0 = Date.now()
  try {
    const r = await llm.completeJson<ReplyPracticeModel>({ ...req, task: 'wordEnrich', tier: TIER, timeoutMs: TIMEOUT_MS })
    return derive({ ...base, ok: true, elapsedMs: r.elapsedMs, attempts: r.attempts, model: r.model, promptChars: r.promptChars, response: r.data }, c)
  } catch (err) {
    const er = err as Error & { raw?: string }
    const text = `${er.message} ${er.raw ?? ''}`
    return { ...base, elapsedMs: Date.now() - t0, errorName: er.name, error: er.message.slice(0, 240), limitHit: LIMIT_RE.test(text) }
  }
}

function table(rows: Row[]) {
  const ok = rows.filter((r) => r.ok)
  const ms = ok.map((r) => r.elapsedMs)
  console.log(`\n## ${REPLY_PRACTICE_PROMPT_VERSION} · tier=${TIER} · 호출 ${rows.length} · 성공 ${ok.length} · 실패 ${rows.length - ok.length}`)
  console.log('| 호출 | ms | 시도 | 유효 | 고르기 세트 | 힌트 | 대답(ja) / 뜻 | 빈칸 → 보기(정답 *) | 힌트 |')
  console.log('|---|---|---|---|---|---|---|---|---|')
  for (const r of rows) {
    if (!r.ok) { console.log(`| ${r.id} | ${r.elapsedMs} | - | FAILED ${r.errorName}: ${r.error} |`); continue }
    const f = r.final!
    const s = f.suggestion
    const choices = s?.choices ? s.choices.map((c, i) => (i === s.answerIndex ? `*${c}` : c)).join(' / ') : `(버림: ${f.choiceSetDropped})`
    console.log(`| ${r.id} | ${r.elapsedMs} | ${r.attempts} | ${f.ok ? 'O' : 'X'} | ${f.choiceSetDropped ?? 'OK'} | ${f.hintDropped ?? 'OK'} | ${s?.ja ?? '-'} / ${s?.ko ?? '-'} | ${s?.blank ? `[${s.blank.start},${s.blank.end}) ` : ''}${choices} | ${s?.hintKo ?? '-'} |`)
  }
  const valid = ok.filter((r) => r.final!.ok)
  const sets = valid.filter((r) => r.final!.suggestion!.choices)
  const reasons = new Map<string, number>()
  for (const r of valid) if (r.final!.choiceSetDropped) reasons.set(r.final!.choiceSetDropped, (reasons.get(r.final!.choiceSetDropped) ?? 0) + 1)
  console.log(`\n1차 통과(attempts 1) ${ok.filter((r) => r.attempts === 1).length}/${ok.length} · 최종 실패 ${rows.filter((r) => !r.ok).length}`)
  console.log(`지연 p50 ${round(pct(ms, 50), 0)}ms · p95 ${round(pct(ms, 95), 0)}ms · max ${Math.max(...ms, 0)}ms · >8s ${ok.filter((r) => r.elapsedMs > 8_000).length} · >12s(실패 포함) ${rows.filter((r) => r.elapsedMs > 12_000).length}`)
  console.log(`보정 후 유효 ${valid.length}/${ok.length} · 고르기 세트 유효 ${sets.length}/${valid.length} · 힌트 유효 ${valid.filter((r) => r.final!.suggestion!.hintKo).length}/${valid.length} · 버려진 이유 ${[...reasons.entries()].map(([k, v]) => `${k}×${v}`).join(', ') || '-'} · 힌트 누설 버림 ${valid.filter((r) => r.final!.hintDropped === 'HINT_LEAK').length}`)
  console.log(`현재 코드 extraCheck 위반 응답 ${ok.filter((r) => (r.violations ?? 0) > 0).length}건(0 이 아니면 재시도 대상)`)
  console.log(`불변식 위반 ${valid.filter((r) => r.shapeViolations?.length).length} · 한 문장 ${valid.filter((r) => r.oneSentence).length}/${valid.length} · 핵심 표현 사용 ${valid.filter((r) => r.usedExpression).length}/${valid.length} · 선생님 말 따라 하기 ${valid.filter((r) => r.echoedTutor).length}`)
  const pos = [0, 1, 2].map((i) => sets.filter((r) => r.final!.suggestion!.answerIndex === i).length)
  console.log(`정답 위치 분포 ${pos.join('/')}`)
}

async function main() {
  if (process.env.DUMP === '1') { const s = JSON.parse(readFileSync(OUT, 'utf8')) as Saved; if (process.env.REFINAL === '1') s.rows = s.rows.map((r) => (r.ok && r.response ? derive(r, fx.cases.find((c) => c.id === r.case)!) : r)); table(s.rows); return }
  const only = (process.env.ONLY ?? '').split(',').filter(Boolean)
  const cases = fx.cases.filter((c) => !only.length || only.some((o) => c.id.startsWith(o)))
  const startedAt = new Date().toISOString()
  const prior: Row[] = process.env.RESUME === '1' && existsSync(OUT) ? (JSON.parse(readFileSync(OUT, 'utf8')) as Saved).rows : []
  const rows: Row[] = [...prior]
  const done = new Set(prior.filter((r) => r.ok).map((r) => r.id))
  for (let rep = 1; rep <= REPEAT; rep++) {
    for (const c of cases) {
      const id = `${c.id}#${rep}`
      if (done.has(id)) continue
      const row = await runCall(c, rep)
      const idx = rows.findIndex((r) => r.id === id)
      if (idx >= 0) rows[idx] = row
      else rows.push(row)
      save(rows, startedAt)
      console.log(`${row.ok ? 'OK ' : 'ERR'} ${id} ${row.elapsedMs}ms ${row.ok ? `valid=${row.final!.ok} set=${row.final!.choiceSetDropped ?? 'OK'} attempts=${row.attempts}` : row.error}`)
      if (row.limitHit) { console.log('\n⚠ 한도 신호 — 즉시 중단(추정값을 쓰지 않는다)'); table(rows); process.exit(2) }
      await sleep(GAP_MS)
    }
  }
  table(rows)
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1) })
