/**
 * task-024(IMP-0010) 실측 — 실제 Claude CLI(구독)로 A1 TALK 응답 길이 v3(고정 2문장) vs v4(`sceneCap` 상황별 상한)를 비교한다.
 * **운영 DB 를 바꾸지 않는다**(합성 발화만, `tests/prompts/fixtures/talk-length.json`).
 *
 * - v3 기준선 = v4 요청에서 replyJa 지시 줄을 v3 원문으로 되돌리고, persona 는 `git show HEAD:.claude/agents/tutor.md`(v3 문구)로 로드,
 *   후검증은 v3 기본(문장 수 3 초과에서만 재시도).
 * - v4 = `buildTalkRequest({ sceneCap })` 그대로.
 * - 항목별 RUNS(기본 3)회, 두 팔을 교차 실행해 시간대 편향을 줄인다. 순차 실행(지연 측정 왜곡 방지).
 *
 * 실행(우분투 미러): cd ~/.node-local/thekaiwa && node --env-file=.env --import tsx tests/live/talk-length-measure.ts
 * 환경변수: RUNS=3  ITEMS=s01,x01(부분 실행)  ARMS=v3,v4  KAIWA_SRC_REPO=<v3 persona 를 꺼낼 git 저장소, 기본 NFS 원본>
 * 결과: /tmp/kaiwa-talk-length-measure.json (실행 중 계속 덮어써서 중단돼도 부분 결과가 남는다)
 *
 * ⚠ task-036(talk@v8) 이후 **재실행 비권장(재현 불가)**: 아래 `V3_REPLYJA_LINE`(v3 원문 상수)은 당시 응답 계약의 히라가나 읽기 줄 필드 문구를 포함하지만, 그 필드는
 *   talk@v8·chat@v3 에서 스키마·지시 줄에서 빠졌다 — v3 팔이 스키마에 없는 필드를 지시하게 돼 기준선이 오염된다. 이 파일은 task-024 측정의 기록으로 남긴다
 *   (읽기 줄 제거의 A/B 는 `task036-reading-ab.ts`).
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { llm } from '../../src/modules/engine'
import { buildTalkRequest, checkTalkResponse, countJaSentences, resetPersonaCacheForMeasure, type TutorResponse } from './talkLengthHelpers'

interface Item {
  id: string
  scene: 'SHORT' | 'EXPLAIN' | 'ASK_BACK' | 'CORRECTION'
  level: string
  sceneCap: number
  input: string
  history: { role: 'user' | 'assistant'; content: string }[]
  hasError: boolean
  expectedCorrected?: string
  expect: { sentences: { min: number; max: number }; hasQuestion?: boolean; correctionRequired?: boolean }
}
const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/talk-length.json'), 'utf8')) as { items: Item[] }
const RUNS = Number(process.env.RUNS ?? 3)
const ONLY = process.env.ITEMS?.split(',').map((s) => s.trim()).filter(Boolean)
const ARMS = (process.env.ARMS ?? 'v3,v4').split(',').map((s) => s.trim()) as ('v3' | 'v4')[]
const items = fixture.items.filter((x) => !ONLY || ONLY.includes(x.id))
const learnerBase = { displayName: '브라운', teacherName: '유우', weaknesses: ['CONJUGATION(3)', 'PARTICLE(2)'], streakDays: 4 }

// v3 persona = HEAD 의 tutor.md. 미러에는 sync-local 이 v4 persona 를 복사해 뒀으므로 임시 파일로 꺼내 TUTOR_PERSONA_PATH 로 덮는다.
const v3PersonaPath = join(mkdtempSync(join(tmpdir(), 'kaiwa-v3-persona-')), 'tutor.md')
// 미러(~/.node-local/thekaiwa)는 git 저장소가 아니다 — 원본 저장소(NFS)에서 꺼낸다. 커밋 전이면 HEAD = v3 persona.
const SRC_REPO = process.env.KAIWA_SRC_REPO ?? '/home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa'
writeFileSync(v3PersonaPath, execFileSync('git', ['-C', SRC_REPO, 'show', 'HEAD:.claude/agents/tutor.md'], { encoding: 'utf8', maxBuffer: 4_000_000 }))
const V3_REPLYJA_LINE =
  '- conversation.replyJa: 학습자 수준 안의 자연스러운 일본어 **최대 2문장** — ① 「そうですね。」「いいですね！」처럼 아주 짧은 맞장구 한 마디 ② 대화를 잇는 반응·질문 한 문장. 교정 설명·「〜ではなく」 같은 고쳐 말하기는 replyJa 에 넣지 않습니다(그건 correction 에만). replyReading 은 replyJa 전체의 히라가나 읽기, replyKo 는 한국어 번역.'

type Arm = 'v3' | 'v4'
function buildFor(arm: Arm, it: Item) {
  const input = { todayKst: '2026-09-30', learner: { ...learnerBase, level: it.level }, history: it.history, text: it.input }
  if (arm === 'v4') {
    delete process.env.TUTOR_PERSONA_PATH
    resetPersonaCacheForMeasure()
    return buildTalkRequest({ ...input, sceneCap: it.sceneCap })
  }
  process.env.TUTOR_PERSONA_PATH = v3PersonaPath
  resetPersonaCacheForMeasure()
  const req = buildTalkRequest({ ...input, sceneCap: 2 })
  const v4Line = req.system.split('\n').find((l) => l.startsWith('- conversation.replyJa'))
  if (!v4Line) throw new Error('replyJa 줄을 찾지 못함')
  const persona = req.persona // 이미 v3 문구로 로드됨
  delete process.env.TUTOR_PERSONA_PATH
  resetPersonaCacheForMeasure()
  return { ...req, persona, system: req.system.replace(v4Line, V3_REPLYJA_LINE), extraCheck: (data: TutorResponse) => checkTalkResponse(it.input, data) }
}

interface Row {
  arm: Arm
  id: string
  scene: Item['scene']
  run: number
  cap: number
  ok: boolean
  ms: number
  attempts?: 1 | 2
  promptChars?: number
  personaChars?: number
  sentences?: number
  replyChars?: number
  hasQuestion?: boolean
  inRange?: boolean
  overCap?: boolean
  overCapPlus1?: boolean
  correctionPresent?: boolean
  originalExact?: boolean
  correctedMatchesExpected?: boolean
  explanationInReply?: boolean
  replyJa?: string
  error?: string
}
const EXPLAIN_RE = /ではなく|正しくは|間違い|誤り|ではありません/

async function run(arm: Arm, it: Item, n: number): Promise<Row> {
  const cap = arm === 'v4' ? it.sceneCap : 2
  const base: Row = { arm, id: it.id, scene: it.scene, run: n, cap, ok: false, ms: 0 }
  const req = buildFor(arm, it)
  const t0 = Date.now()
  try {
    const r = await llm.completeJson<TutorResponse>({ ...req, timeoutMs: 25_000 })
    const ms = Date.now() - t0
    const reply = r.data.conversation.replyJa
    const sentences = countJaSentences(reply)
    const c = r.data.correction
    return {
      ...base, ok: true, ms, attempts: r.attempts, promptChars: r.promptChars, personaChars: req.persona?.prompt.length,
      sentences, replyChars: reply.length, hasQuestion: /[？?]/.test(reply),
      inRange: sentences >= it.expect.sentences.min && sentences <= it.expect.sentences.max,
      overCap: sentences > it.sceneCap, overCapPlus1: sentences > it.sceneCap + 1,
      correctionPresent: Boolean(c && c.required !== false), originalExact: c ? c.original === it.input : undefined,
      correctedMatchesExpected: c && it.expectedCorrected ? c.corrected === it.expectedCorrected : undefined,
      explanationInReply: EXPLAIN_RE.test(reply), replyJa: reply,
    }
  } catch (e) {
    const err = e as Error
    return { ...base, ms: Date.now() - t0, error: `${err.name}: ${err.message.slice(0, 240)}` }
  }
}

const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(0)}% (${a}/${b})` : '-')
const p95 = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * 0.95))] : 0)
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

function summarize(rows: Row[]) {
  const out: string[] = []
  for (const arm of ARMS) {
    const a = rows.filter((r) => r.arm === arm)
    const ok = a.filter((r) => r.ok)
    out.push(`\n### ${arm} — n=${a.length} 성공 ${pct(ok.length, a.length)} · 1회차 통과 ${pct(ok.filter((r) => r.attempts === 1).length, a.length)} · 재시도 ${ok.filter((r) => r.attempts === 2).length}`)
    out.push('| 장면 | n | 문장수 분포(1/2/3/4/5+) | 평균 | 기대범위 | 상한초과 | 상한+2초과 | 물음표 | ms 평균/p95 | replyJa 최대자 | promptChars 최대 |')
    out.push('|---|---|---|---|---|---|---|---|---|---|---|')
    for (const sc of ['SHORT', 'EXPLAIN', 'ASK_BACK', 'CORRECTION'] as const) {
      const s = ok.filter((r) => r.scene === sc)
      if (!s.length) continue
      const h = [1, 2, 3, 4].map((k) => s.filter((r) => r.sentences === k).length)
      h.push(s.filter((r) => (r.sentences ?? 0) >= 5).length)
      const qn = s.filter((r) => items.find((i) => i.id === r.id)?.expect.hasQuestion)
      out.push(
        `| ${sc} | ${s.length} | ${h.join('/')} | ${mean(s.map((r) => r.sentences ?? 0)).toFixed(2)} | ${pct(s.filter((r) => r.inRange).length, s.length)} | ${pct(s.filter((r) => r.overCap).length, s.length)} | ${pct(s.filter((r) => r.overCapPlus1).length, s.length)} | ${qn.length ? pct(qn.filter((r) => r.hasQuestion).length, qn.length) : '-'} | ${mean(s.map((r) => r.ms)).toFixed(0)}/${p95(s.map((r) => r.ms))} | ${Math.max(...s.map((r) => r.replyChars ?? 0))} | ${Math.max(...s.map((r) => r.promptChars ?? 0))} |`,
      )
    }
    const cs = ok.filter((r) => r.scene === 'CORRECTION')
    if (cs.length) {
      out.push(`- CORRECTION: correction 채움 ${pct(cs.filter((r) => r.correctionPresent).length, cs.length)} · original 바이트 일치 ${pct(cs.filter((r) => r.originalExact).length, cs.filter((r) => r.originalExact !== undefined).length)} · corrected=기대 ${pct(cs.filter((r) => r.correctedMatchesExpected).length, cs.length)} · replyJa 교정 설명 혼입 ${pct(cs.filter((r) => r.explanationInReply).length, cs.length)}`)
    }
    const nc = ok.filter((r) => r.scene !== 'CORRECTION')
    out.push(`- 비교정 장면: 오류 없는 발화에 correction 를 채운 비율 ${pct(nc.filter((r) => r.correctionPresent).length, nc.length)}`)
    const bad = a.filter((r) => !r.ok)
    for (const r of bad) out.push(`- 실패 ${r.id}#${r.run}: ${r.error}`)
  }
  return out.join('\n')
}

async function main() {
  console.log(`talk 길이(task-024) 실측 — 항목 ${items.length} × 팔 ${ARMS.join('/')} × ${RUNS}회 (순차)`)
  const rows: Row[] = []
  for (let n = 1; n <= RUNS; n++) {
    for (const it of items) {
      for (const arm of ARMS) {
        const r = await run(arm, it, n)
        rows.push(r)
        console.log(JSON.stringify({ arm: r.arm, id: r.id, run: r.run, ok: r.ok, ms: r.ms, att: r.attempts, s: r.sentences, chars: r.replyChars, q: r.hasQuestion, reply: r.replyJa, err: r.error }))
        writeFileSync('/tmp/kaiwa-talk-length-measure.json', JSON.stringify({ at: new Date().toISOString(), runs: RUNS, rows }, null, 1))
      }
    }
  }
  console.log(`\n## 요약${summarize(rows)}`)
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
