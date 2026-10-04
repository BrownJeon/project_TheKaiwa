/**
 * task-026 S2(userTranslation@v1) 실측 — 실제 Claude CLI(구독)로 단건 번역 프롬프트(내 말 번역 재시도)를 순차 호출한다.
 * **운영 DB 를 바꾸지 않는다**(합성 발화만, `tests/prompts/fixtures/user-translation.json` live 10건).
 *
 * 측정: 계약 위반(스키마·재시도 발생)·지연(p50/p95, 첫 호출은 콜드로 따로)·번역 품질(키워드 적중·이중 높임·말투 보존·정리 통과).
 * `engine/router/tasks.ts` 에 `userTranslation` 키가 아직 없으면(developer 인계 전) 이 스크립트가 **메모리에서만** 권고 값(fast·15s·interactive)을 넣는다 — 파일은 안 건드린다.
 *
 * 실행(우분투 개발 미러): cd ~/.node-local/thekaiwa-dev-010b-ui && node --env-file=.env --import tsx tests/live/user-translation-measure.ts
 * 환경변수: RUNS=2  ITEMS=c1,c2(부분)
 * 결과: /tmp/kaiwa-user-translation-measure.json (실행 중 계속 덮어써서 중단돼도 부분 결과가 남는다). 429(사용 한도)가 나오면 즉시 중단.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { llm, LLM_TASKS } from '../../src/modules/engine'
import { buildUserTranslationRequest, checkUserKoNaturalness, sanitizeUserTranslation, USER_TRANSLATION_TASK, type UserTranslationResponse } from '../../src/modules/conversation'

interface Item {
  id: string
  kind: string
  register: 'casual' | 'polite' | 'mixed'
  level: string
  input: string
  expectKoAny: string[]
}
const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/user-translation.json'), 'utf8')) as { live: Item[] }
const RUNS = Number(process.env.RUNS ?? 2)
const ONLY = process.env.ITEMS?.split(',').map((s) => s.trim()).filter(Boolean)
const items = fixture.live.filter((x) => !ONLY || ONLY.includes(x.id))

const tasks = LLM_TASKS as Record<string, unknown>
if (!(USER_TRANSLATION_TASK in tasks)) {
  tasks[USER_TRANSLATION_TASK] = { tier: 'fast', timeoutMs: 15_000, lane: 'interactive' }
  console.log(`(메모리 한정) LLM_TASKS.${USER_TRANSLATION_TASK} = fast·15s·interactive`)
}

/** 번역의 마지막 문장 종결로 말투를 본다(휴리스틱 — 존댓말 종결 요/습니다/니다/세요/까요/죠). */
const POLITE_END = /(요|니다|니까|세요|죠|까요|네요|군요|어요|아요)[\s.?!…~]*$/
function koRegister(ko: string): 'polite' | 'casual' {
  return POLITE_END.test(ko.trim()) ? 'polite' : 'casual'
}

interface Row {
  id: string
  run: number
  ok: boolean
  ms: number
  attempts?: 1 | 2
  promptChars?: number
  warm?: unknown
  raw?: string
  sanitized?: string | null
  kwHit?: boolean
  doubleHonorific?: boolean
  registerKept?: boolean | null
  error?: string
}

async function runOne(it: Item, n: number): Promise<Row> {
  const base: Row = { id: it.id, run: n, ok: false, ms: 0 }
  const req = buildUserTranslationRequest({ text: it.input, level: it.level })
  const t0 = Date.now()
  try {
    const r = await llm.completeJson<UserTranslationResponse>(req)
    const ms = Date.now() - t0
    const san = sanitizeUserTranslation(it.input, r.data)
    return {
      ...base, ok: true, ms, attempts: r.attempts, promptChars: r.promptChars, warm: r.warm,
      raw: r.data.userKo, sanitized: san,
      kwHit: san ? it.expectKoAny.some((k) => san.includes(k)) : undefined,
      doubleHonorific: checkUserKoNaturalness(r.data.userKo).length > 0,
      registerKept: san && it.register !== 'mixed' ? koRegister(san) === it.register : null,
    }
  } catch (e) {
    const err = e as Error
    return { ...base, ms: Date.now() - t0, error: `${err.name}: ${err.message.slice(0, 240)}` }
  }
}

const pctl = (xs: number[], q: number) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * q))] : 0)
const frac = (a: number, b: number) => `${a}/${b}`

function summarize(rows: Row[]) {
  const ok = rows.filter((r) => r.ok)
  const warm = ok.filter((r) => r.run > 1 || r.id !== items[0]?.id)
  const reg = ok.filter((r) => r.registerKept !== null && r.registerKept !== undefined)
  const out = [
    '| 항목 | 값 |',
    '|---|---|',
    `| 호출 | ${rows.length} |`,
    `| 성공 | ${frac(ok.length, rows.length)} |`,
    `| 1차 통과(재시도 0) | ${frac(ok.filter((r) => r.attempts === 1).length, rows.length)} |`,
    `| 정리 통과(sanitize) | ${frac(ok.filter((r) => r.sanitized).length, ok.length)} |`,
    `| 키워드 적중 | ${frac(ok.filter((r) => r.kwHit).length, ok.filter((r) => r.sanitized).length)} |`,
    `| 이중 높임 | ${ok.filter((r) => r.doubleHonorific).length} |`,
    `| 말투 보존(반말·존댓말 항목) | ${frac(reg.filter((r) => r.registerKept).length, reg.length)} |`,
    `| ms p50 / p95 / max (전체) | ${pctl(ok.map((r) => r.ms), 0.5)} / ${pctl(ok.map((r) => r.ms), 0.95)} / ${Math.max(0, ...ok.map((r) => r.ms))} |`,
    `| ms p50 / p95 (첫 호출 제외) | ${pctl(warm.map((r) => r.ms), 0.5)} / ${pctl(warm.map((r) => r.ms), 0.95)} |`,
    `| 첫 호출(콜드) ms | ${ok[0]?.ms ?? '-'} |`,
    `| promptChars 최대 | ${Math.max(0, ...ok.map((r) => r.promptChars ?? 0))} |`,
  ]
  for (const r of rows.filter((x) => !x.ok)) out.push(`- 실패 ${r.id}#${r.run}: ${r.error}`)
  for (const r of ok.filter((x) => x.registerKept === false)) out.push(`- 말투 불일치 ${r.id}#${r.run}: ${r.sanitized}`)
  for (const r of ok.filter((x) => !x.sanitized)) out.push(`- 정리 탈락 ${r.id}#${r.run}: ${JSON.stringify(r.raw)}`)
  return out.join('\n')
}

async function main() {
  console.log(`userTranslation(task-026 S2) 실측 — 항목 ${items.length} × ${RUNS}회 (순차)`)
  const rows: Row[] = []
  const save = () => writeFileSync('/tmp/kaiwa-user-translation-measure.json', JSON.stringify({ at: new Date().toISOString(), runs: RUNS, rows }, null, 1))
  for (let n = 1; n <= RUNS; n++) {
    for (const it of items) {
      const r = await runOne(it, n)
      rows.push(r)
      console.log(JSON.stringify({ id: r.id, run: r.run, ok: r.ok, ms: r.ms, att: r.attempts, warm: r.warm, ko: r.raw, err: r.error }))
      save()
      if (r.error && /429|rate.?limit|usage limit|한도/i.test(r.error)) {
        console.log('429/사용 한도 감지 — 중단')
        console.log(`\n## 요약(중단)\n${summarize(rows)}`)
        return
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
