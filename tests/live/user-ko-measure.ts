/**
 * task-026(talk@v7·chat@v2) 실측 — 실제 Claude CLI(구독)로 A1 TALK 의 `userKo`(학습자 말 번역) 추가 전후를 비교한다.
 * **운영 DB 를 바꾸지 않는다**(합성 발화만, `tests/prompts/fixtures/talk-userko.json` live 12건).
 *
 * - arm `v6` = v7 요청에서 userKo 지시 줄·순서 문구·골격 끝을 되돌리고 스키마에서 userKo 를 뺀 기준선(= talk@v6 출력 계약).
 * - arm `v7` = `buildTalkRequest` 그대로.
 * - arm `chat` = `buildChatRequest`(chat@v2) 점검용(항목 앞 `CHAT_ITEMS` 개, 지연 비교 아님 — 계약 위반·번역 존재만 본다).
 * 순차 실행(지연 측정 왜곡 방지)·두 팔을 교차. 429(사용 한도)가 나오면 즉시 중단한다.
 *
 * 실행(우분투 개발 미러): cd ~/.node-local/thekaiwa-dev-010b-ui && node --env-file=.env --import tsx tests/live/user-ko-measure.ts
 * 환경변수: RUNS=2  ITEMS=u01,u02(부분)  ARMS=v6,v7,chat  CHAT_ITEMS=4
 * 결과: /tmp/kaiwa-user-ko-measure.json (실행 중 계속 덮어써서 중단돼도 부분 결과가 남는다)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { llm } from '../../src/modules/engine'
import { buildChatRequest, buildTalkRequest, countJaSentences, sanitizeUserKo, TALK_SCHEMA, checkUserKoNaturalness, type TutorResponse } from '../../src/modules/conversation'
import { USER_KO_INSTRUCTION_LINE } from '../../src/modules/conversation/prompts/talk'

interface Item {
  id: string
  level: string
  input: string
  history: { role: 'user' | 'assistant'; content: string }[]
  expectKoAny: string[]
}
const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/talk-userko.json'), 'utf8')) as { live: Item[] }
const RUNS = Number(process.env.RUNS ?? 2)
const CHAT_ITEMS = Number(process.env.CHAT_ITEMS ?? 4)
const ONLY = process.env.ITEMS?.split(',').map((s) => s.trim()).filter(Boolean)
const ARMS = (process.env.ARMS ?? 'v6,v7,chat').split(',').map((s) => s.trim()) as Arm[]
const items = fixture.live.filter((x) => !ONLY || ONLY.includes(x.id))
const learnerBase = { displayName: '브라운', teacherName: '유우', weaknesses: ['CONJUGATION(3)', 'PARTICLE(2)'], streakDays: 4 }
type Arm = 'v6' | 'v7' | 'chat'

// v6 기준선 스키마 — TALK_SCHEMA 에서 userKo 만 뺀다(required·properties).
const { userKo: _drop, ...v6Props } = TALK_SCHEMA.properties as Record<string, unknown>
void _drop
const V6_SCHEMA = { ...TALK_SCHEMA, required: (TALK_SCHEMA.required as readonly string[]).filter((k) => k !== 'userKo'), properties: v6Props }

function buildFor(arm: Arm, it: Item) {
  const input = { todayKst: '2026-10-04', learner: { ...learnerBase, level: it.level }, history: it.history, text: it.input }
  if (arm === 'chat') return buildChatRequest(input)
  const req = buildTalkRequest({ ...input, sceneCap: 2 })
  if (arm === 'v7') return req
  const system = req.system
    .split('\n')
    .filter((l) => l !== USER_KO_INSTRUCTION_LINE)
    .join('\n')
    .replace('proposals → userKo.', 'proposals.')
    .replace(',"userKo":"<...>"}', '}')
  if (system.includes('userKo')) throw new Error('v6 기준선에 userKo 가 남았다')
  return { ...req, system, jsonSchema: V6_SCHEMA }
}

interface Row {
  arm: Arm
  id: string
  run: number
  ok: boolean
  ms: number
  firstDeltaMs?: number | null
  attempts?: 1 | 2
  promptChars?: number
  outChars?: number
  userKo?: string | null
  userKoRaw?: string
  sanitized?: string | null
  kwHit?: boolean
  doubleHonorific?: boolean
  replySentences?: number
  error?: string
}

async function run(arm: Arm, it: Item, n: number): Promise<Row> {
  const base: Row = { arm, id: it.id, run: n, ok: false, ms: 0 }
  const req = buildFor(arm, it)
  const t0 = Date.now()
  try {
    const r = await llm.completeJson<TutorResponse>({ ...(req as Parameters<typeof llm.completeJson<TutorResponse>>[0]), timeoutMs: 25_000 })
    const ms = Date.now() - t0
    const raw = r.data.userKo
    const san = arm === 'v6' ? undefined : sanitizeUserKo(it.input, raw)
    return {
      ...base, ok: true, ms, firstDeltaMs: r.firstDeltaMs ?? null, attempts: r.attempts, promptChars: r.promptChars,
      outChars: JSON.stringify(r.data).length, userKoRaw: raw ?? undefined, sanitized: san,
      kwHit: san ? it.expectKoAny.some((k) => san.includes(k)) : undefined,
      doubleHonorific: raw ? checkUserKoNaturalness(raw).length > 0 : undefined,
      replySentences: countJaSentences(r.data.conversation.replyJa),
    }
  } catch (e) {
    const err = e as Error
    return { ...base, ms: Date.now() - t0, error: `${err.name}: ${err.message.slice(0, 240)}` }
  }
}

const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(0)}% (${a}/${b})` : '-')
const pctl = (xs: number[], q: number) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * q))] : 0)
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

function summarize(rows: Row[]) {
  const out: string[] = ['| arm | n | 성공 | 1차 통과 | 재시도 | ms p50 | ms p95 | 첫조각 p50 | 출력JSON 평균자 | userKo 정리 통과 | 키워드 | 이중높임 | userKo 최대자 | promptChars 최대 |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|']
  for (const arm of ARMS) {
    const a = rows.filter((r) => r.arm === arm)
    if (!a.length) continue
    const ok = a.filter((r) => r.ok)
    const first = ok.filter((r) => r.attempts === 1)
    const withKo = arm === 'v6' ? [] : ok
    out.push(
      `| ${arm} | ${a.length} | ${pct(ok.length, a.length)} | ${pct(first.length, a.length)} | ${ok.filter((r) => r.attempts === 2).length} | ${pctl(ok.map((r) => r.ms), 0.5)} | ${pctl(ok.map((r) => r.ms), 0.95)} | ${pctl(ok.map((r) => r.firstDeltaMs ?? 0).filter(Boolean), 0.5)} | ${mean(ok.map((r) => r.outChars ?? 0)).toFixed(0)} | ${arm === 'v6' ? '-' : pct(withKo.filter((r) => r.sanitized).length, withKo.length)} | ${arm === 'v6' ? '-' : pct(withKo.filter((r) => r.kwHit).length, withKo.filter((r) => r.sanitized).length)} | ${arm === 'v6' ? '-' : withKo.filter((r) => r.doubleHonorific).length} | ${arm === 'v6' ? '-' : Math.max(0, ...withKo.map((r) => r.userKoRaw?.length ?? 0))} | ${Math.max(0, ...ok.map((r) => r.promptChars ?? 0))} |`,
    )
  }
  // REV-086 M3 — userKo 는 스키마 선택이라 모델이 빼먹는 비율을 직접 본다(누락·빈 값 = userKoRaw 가 없거나 공백뿐).
  for (const arm of ARMS) {
    if (arm === 'v6') continue
    const ok = rows.filter((r) => r.arm === arm && r.ok)
    if (ok.length) out.push(`- ${arm} userKo 누락·빈 값: ${ok.filter((r) => !r.userKoRaw?.trim()).length}/${ok.length}`)
  }
  for (const r of rows.filter((x) => !x.ok)) out.push(`- 실패 ${r.arm}/${r.id}#${r.run}: ${r.error}`)
  return out.join('\n')
}

async function main() {
  console.log(`userKo(task-026) 실측 — 항목 ${items.length} × 팔 ${ARMS.join('/')} × ${RUNS}회 (순차, chat 은 앞 ${CHAT_ITEMS}개 × 1회)`)
  const rows: Row[] = []
  const save = () => writeFileSync('/tmp/kaiwa-user-ko-measure.json', JSON.stringify({ at: new Date().toISOString(), runs: RUNS, rows }, null, 1))
  for (let n = 1; n <= RUNS; n++) {
    for (const [i, it] of items.entries()) {
      for (const arm of ARMS) {
        if (arm === 'chat' && (n > 1 || i >= CHAT_ITEMS)) continue
        const r = await run(arm, it, n)
        rows.push(r)
        console.log(JSON.stringify({ arm: r.arm, id: r.id, run: r.run, ok: r.ok, ms: r.ms, fd: r.firstDeltaMs, att: r.attempts, out: r.outChars, ko: r.userKoRaw, err: r.error }))
        save()
        if (r.error && /429|rate.?limit|usage limit|한도/i.test(r.error)) {
          console.log('429/사용 한도 감지 — 중단')
          console.log(`\n## 요약(중단)\n${summarize(rows)}`)
          return
        }
      }
    }
  }
  console.log(`\n## 요약\n${summarize(rows)}`)
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
