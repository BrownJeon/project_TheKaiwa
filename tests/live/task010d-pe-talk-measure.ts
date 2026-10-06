/**
 * task-010d A1-PE 실측 — A1 역할극 모드(`talkScenario@v1`, `buildTalkRequest({ scenario })`)를 실제 Claude CLI(구독, haiku)로 **직렬** 호출해
 * ① 1차 통과(재시도 0 — ajv·후검증) ② `replyJa` 가 역할을 연기하는가(눈 판정용 출력) ③ 첫마디 반복 여부 ④ 코치 교정 유지(교정이 있으면 `hintKo` 채움·정답 누출 없음·`original` 무수정)
 * ⑤ 턴 지연이 같은 입력의 일반 TALK(코치) 대비 나빠지지 않았는가(첫 조각·전체 ms)를 잰다.
 *
 * 설계: 상황 3개(카페·역·길 잃음) × 대본 학습자 말 4턴. **역할극 호출이 대화를 이끈다**(선생님 답을 이력에 이어 붙인다). 같은 턴에서 같은 이력·같은 말로 일반 TALK(코치, `scenario` 없음)도
 * 한 번 더 부른다 — 호출 순서는 턴마다 번갈아(순서 효과 상쇄). 합성 대본만 쓴다(학습자 데이터 없음).
 * **DB 를 읽지도 쓰지도 않는다**(task-042 측정과 같은 고정 연결 — fast=haiku). orchestrator 처럼 TALK 는 `softExtraCheck` 로 부른다(남은 위반은 결과에 기록, 던지지 않음).
 * 예열 프로세스(warm)는 쓰지 않는다 — 두 팔 모두 같은 조건이라 비교는 유효하고 절대 ms 는 운영(예열)보다 느리다.
 *
 * 한도(429·session limit 등)가 보이면 즉시 멈춘다. 호출마다 OUT 에 덮어쓴다.
 * 실행: cd ~/.node-local/thekaiwa-010d-a && OUT=<결과.json> node --import tsx tests/live/task010d-pe-talk-measure.ts
 * 환경: GAP_MS=1200 · TIMEOUT_MS=30000 · SCENARIOS=<상황 key 쉼표 목록> · ARMS=ROLE,GENERAL(기본 — ROLE 만 주면 역할극 팔만) · DUMP=1
 * SCRIPT_SET=A(기본, 선생님 말에 답하지 않는 대본 — 교정이 몰리는 비협조 학습자) | B(협조적 대본 — 매 턴 맞는 말, 카페 3턴만 조사 오류 1개를 심음 → 오교정·누락 계수) · FLIP0=1(번갈아 순서의 시작을 뒤집는다)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { llm } from '../../src/modules/engine'
import { routerDeps, type ResolvedConnection } from '../../src/modules/engine/router'
import { buildTalkRequest, checkTalkResponse, type TutorResponse } from '../../src/modules/conversation'
import { scenarioPromptParts } from '../../src/modules/conversation/prompts/scenarioInput'

interface FxScenario { level: string; roles: { learner: string; tutor: string }; goalKo: string; successCriteria: string[]; steps: { ko: string }[]; keyExpressions: Record<string, string>[]; completionRule: Record<string, unknown>; opening: string }
const fx = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/scenario-verdict.json'), 'utf8')) as { scenarios: Record<string, FxScenario> }

const SCRIPTS_A: Record<string, string[]> = {
  'cafe-size-temp': ['アイスコーヒーをください。', '大きいサイズをしてください。', 'はい、お願いします。', 'ありがとうございます。'],
  'station-exit': ['すみません、東京タワーはどこですか？', '何番出口ですか？', 'A3出口ですね。ありがとうございます。', 'さようなら。'],
  'lost-recheck': ['道に迷いました。', 'えっと、もう一回言ってください。', 'ゆっくり言ってください。', 'まっすぐ行って、右ですね。'],
}
// B: 협조적 — 선생님 답과 어긋나지 않게 일반적인 맞는 말만(카페 3턴만 「サイズ**を**してください」 조사 오류 1개를 심음). 교정이 붙은 턴 중 심은 곳이 아니면 오교정이다.
const SCRIPTS_B: Record<string, string[]> = {
  'cafe-size-temp': ['アイスコーヒーをください。', '冷たいのでお願いします。', '大きいサイズをしてください。', 'ありがとうございます。'],
  'station-exit': ['すみません、東京タワーはどこですか？', '東京タワーに近い出口は何番出口ですか？', 'わかりました。ありがとうございます。', 'さようなら。'],
  'lost-recheck': ['道に迷いました。', '駅へ行きたいです。', 'すみません、もう一度お願いします。', 'わかりました。ありがとうございました。'],
}
const SCRIPT_SET = (process.env.SCRIPT_SET ?? 'A').toUpperCase() === 'B' ? 'B' : 'A'
const SCRIPTS = SCRIPT_SET === 'B' ? SCRIPTS_B : SCRIPTS_A
const PLANTED = new Set(SCRIPT_SET === 'B' ? ['cafe-size-temp#3'] : [])

const OUT = process.env.OUT ?? '/tmp/kaiwa-task010d-talk-measure.json'
const ARMS = (process.env.ARMS ?? 'ROLE,GENERAL').split(',')
const GAP_MS = Number(process.env.GAP_MS ?? 1200)
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 30_000)
const LIMIT_RE = /429|rate.?limit|usage limit|session limit|hit your|limit reached|한도|overloaded/i
const learner = { displayName: '브라운', teacherName: '유우', level: 'N5', weaknesses: ['PARTICLE(2)'], streakDays: 4 }

routerDeps.loadChain = async () => [
  { id: 'stub', key: 'claude-cli-local', engineId: 'claude-cli', connectionType: 'CLI', connection: {}, runtime: { modelByTier: { fast: 'haiku', balanced: 'sonnet', deep: 'opus' }, concurrency: 1, interactiveLane: true, permissionMode: 'dontAsk', tools: '' }, credentialRef: null } as ResolvedConnection,
]

interface Row {
  id: string
  scenario: string
  turn: number
  arm: 'ROLE' | 'GENERAL'
  text: string
  ok: boolean
  elapsedMs: number
  firstDeltaMs?: number | null
  attempts?: 1 | 2
  promptChars?: number
  replyJa?: string
  replyKo?: string
  sentences?: number
  repeatsOpening?: boolean
  correction?: { original: string; corrected: string; hintKo: string | null; severity: string; originalOk: boolean; hintLeak: boolean } | null
  endOfTopic?: boolean
  grammarPoint?: string | null
  style?: string
  residual?: string[]
  errorName?: string
  error?: string
  limitHit?: boolean
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const pct = (xs: number[], p: number) => {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]
}
const med = (xs: number[]) => pct(xs, 50)
const countSentences = (t: string) => (t.match(/[^。！？!?]+[。！？!?]?/g) ?? []).filter((x) => x.trim()).length

async function call(arm: 'ROLE' | 'GENERAL', key: string, turn: number, text: string, history: { role: 'user' | 'assistant'; content: string }[], scenario: ReturnType<typeof scenarioPromptParts>['talk'], opening: string): Promise<Row> {
  const lv = { ...learner, level: fx.scenarios[key].level }
  const req = arm === 'ROLE'
    ? buildTalkRequest({ todayKst: '2026-10-07', learner: lv, history, text, scenario })
    : buildTalkRequest({ todayKst: '2026-10-07', learner: lv, history, text, correctionMode: 'COACH' })
  const base: Row = { id: `${key}#${turn}-${arm}`, scenario: key, turn, arm, text, ok: false, elapsedMs: 0 }
  const t0 = Date.now()
  try {
    const r = await llm.completeJson<TutorResponse>({ ...req, softExtraCheck: true, timeoutMs: TIMEOUT_MS, onTextDelta: () => {} })
    const d = r.data
    const c = d.correction
    return {
      ...base, ok: true, elapsedMs: r.elapsedMs, firstDeltaMs: r.firstDeltaMs ?? null, attempts: r.attempts, promptChars: r.promptChars,
      replyJa: d.conversation.replyJa, replyKo: d.conversation.replyKo, sentences: countSentences(d.conversation.replyJa),
      repeatsOpening: d.conversation.replyJa.includes(opening.slice(0, 6)),
      correction: c ? { original: c.original, corrected: c.corrected, hintKo: c.hintKo ?? null, severity: c.severity, originalOk: c.original === text, hintLeak: Boolean(c.hintKo && c.corrected && c.hintKo.includes(c.corrected)) } : null,
      endOfTopic: d.endOfTopic, grammarPoint: d.learning.grammarPoint, style: d.speech.style, residual: [...(r.residualViolations ?? []), ...checkTalkResponse(text, d, { maxSentences: 3 })].filter((v, i, a) => a.indexOf(v) === i),
    }
  } catch (err) {
    const er = err as Error & { raw?: string }
    return { ...base, elapsedMs: Date.now() - t0, errorName: er.name, error: er.message.slice(0, 240), limitHit: LIMIT_RE.test(`${er.message} ${er.raw ?? ''}`) }
  }
}

function table(rows: Row[]) {
  console.log('\n## 역할극 TALK 실측 — 출력 전문(눈 판정용)')
  for (const r of rows) {
    if (!r.ok) { console.log(`- ${r.id} FAILED ${r.errorName}: ${r.error}`); continue }
    const c = r.correction
    console.log(`- ${r.id} [${r.elapsedMs}ms/첫조각 ${r.firstDeltaMs ?? '-'}/시도 ${r.attempts}/문장 ${r.sentences}${r.repeatsOpening ? '/첫마디 반복!' : ''}] 学習者「${r.text}」 → 「${r.replyJa}」 / ${r.replyKo} · end=${r.endOfTopic}${c ? ` · 교정 ${c.severity} 「${c.corrected}」 hint=${c.hintKo ?? 'null'}${c.originalOk ? '' : ' [원문변조!]'}${c.hintLeak ? ' [정답누출!]' : ''}` : ''}${r.residual?.length ? ` · 위반 ${r.residual.join(';')}` : ''}`)
  }
  const arm = (a: 'ROLE' | 'GENERAL') => rows.filter((r) => r.arm === a)
  const stat = (a: 'ROLE' | 'GENERAL') => {
    const xs = arm(a)
    const ok = xs.filter((r) => r.ok)
    const ms = ok.map((r) => r.elapsedMs)
    const fd = ok.map((r) => r.firstDeltaMs).filter((v): v is number => typeof v === 'number')
    return { n: xs.length, ok: ok.length, first: ok.filter((r) => r.attempts === 1 && !(r.residual?.length)).length, p50: med(ms), p95: pct(ms, 95), fd50: med(fd), chars: Math.round(ok.reduce((s, r) => s + (r.promptChars ?? 0), 0) / Math.max(1, ok.length)) }
  }
  const R = stat('ROLE')
  const G = stat('GENERAL')
  console.log('\n## 요약')
  console.log(`| 팔 | 호출 | 성공 | 1차 통과(재시도·위반 0) | ms p50 | ms p95 | 첫 조각 p50 | 평균 요청 자수 |`)
  console.log('|---|---|---|---|---|---|---|---|')
  for (const [name, s] of [['역할극', R], ['일반(코치)', G]] as const) console.log(`| ${name} | ${s.n} | ${s.ok} | ${s.first}/${s.ok} | ${Math.round(s.p50)} | ${Math.round(s.p95)} | ${Math.round(s.fd50)} | ${s.chars} |`)
  const role = arm('ROLE').filter((r) => r.ok)
  const corr = role.filter((r) => r.correction)
  console.log(`역할극: 교정 ${corr.length}건 중 hintKo 채움 ${corr.filter((r) => r.correction!.hintKo).length} · 정답 누출 ${corr.filter((r) => r.correction!.hintLeak).length} · 원문 변조 ${corr.filter((r) => !r.correction!.originalOk).length} · 첫마디 반복 ${role.filter((r) => r.repeatsOpening).length}/${role.length} · 문장 수 분포 ${JSON.stringify(role.reduce<Record<number, number>>((m, r) => ({ ...m, [r.sentences!]: (m[r.sentences!] ?? 0) + 1 }), {}))} · endOfTopic true ${role.filter((r) => r.endOfTopic).length}`)
  const g = arm('GENERAL').filter((r) => r.ok)
  console.log(`일반(코치): 교정 ${g.filter((r) => r.correction).length}건 중 hintKo 채움 ${g.filter((r) => r.correction?.hintKo).length} · 문장 수 분포 ${JSON.stringify(g.reduce<Record<number, number>>((m, r) => ({ ...m, [r.sentences!]: (m[r.sentences!] ?? 0) + 1 }), {}))}`)
  if (SCRIPT_SET === 'B') {
    for (const [name, xs] of [['역할극', role], ['일반(코치)', g]] as const) {
      const key = (r: Row) => `${r.scenario}#${r.turn}`
      const fp = xs.filter((r) => r.correction && !PLANTED.has(key(r)))
      const planted = xs.filter((r) => PLANTED.has(key(r)))
      console.log(`B 오교정(${name}): 맞는 말 ${xs.length - planted.length}턴 중 교정이 붙은 ${fp.length}턴 [${fp.map((r) => `${key(r)}:${r.correction!.severity}`).join(', ') || '-'}] · 심은 오류 ${planted.length}턴 중 교정 ${planted.filter((r) => r.correction).length}턴`)
    }
  }
  // 같은 턴 짝 비교(ms 차이 = 역할극 − 일반)
  const diffs: number[] = []
  for (const r of role) {
    const m = g.find((x) => x.scenario === r.scenario && x.turn === r.turn)
    if (m) diffs.push(r.elapsedMs - m.elapsedMs)
  }
  console.log(`짝 비교(역할극 − 일반) n=${diffs.length}: 중앙값 ${Math.round(med(diffs))}ms · 평균 ${Math.round(diffs.reduce((a, b) => a + b, 0) / Math.max(1, diffs.length))}ms · 역할극이 더 느린 짝 ${diffs.filter((d) => d > 0).length}`)
}

async function main() {
  if (process.env.DUMP === '1') { table((JSON.parse(readFileSync(OUT, 'utf8')) as { rows: Row[] }).rows); return }
  const only = (process.env.SCENARIOS ?? '').split(',').filter(Boolean)
  const keys = Object.keys(SCRIPTS).filter((k) => !only.length || only.includes(k))
  const rows: Row[] = []
  let flip = process.env.FLIP0 === '1' ? 1 : 0
  for (const key of keys) {
    const sc = fx.scenarios[key]
    const parts = scenarioPromptParts({ roles: sc.roles, goal: { communicativeGoal_ko: sc.goalKo, successCriteria: sc.successCriteria, steps: sc.steps }, keyExpressions: sc.keyExpressions, completionRule: sc.completionRule, constraints: { opening: { ja: sc.opening, ko: '' } } })
    const history: { role: 'user' | 'assistant'; content: string }[] = [{ role: 'assistant', content: sc.opening }]
    const lines = SCRIPTS[key]
    for (let i = 0; i < lines.length; i++) {
      const order: ('ROLE' | 'GENERAL')[] = flip++ % 2 === 0 ? ['ROLE', 'GENERAL'] : ['GENERAL', 'ROLE']
      let roleReply: string | null = null
      for (const arm of order.filter((a) => ARMS.includes(a))) {
        const row = await call(arm, key, i + 1, lines[i], history, parts.talk, sc.opening)
        rows.push(row)
        writeFileSync(OUT, JSON.stringify({ startedAt: new Date().toISOString(), rows }, null, 1))
        console.log(`${row.ok ? 'OK ' : 'ERR'} ${row.id} ${row.elapsedMs}ms ${row.ok ? `「${row.replyJa}」` : row.error}`)
        if (row.limitHit) { console.log('\n⚠ 한도 신호 — 즉시 중단'); table(rows); process.exit(2) }
        if (arm === 'ROLE' && row.ok) roleReply = row.replyJa!
        await sleep(GAP_MS)
      }
      history.push({ role: 'user', content: lines[i] }, { role: 'assistant', content: roleReply ?? 'そうですか。' })
    }
  }
  table(rows)
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1) })
