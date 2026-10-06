/**
 * task-010d PE-2b 실측 — 수업 A4 `[상황]` 블록(`lessonScenario@v1`)이 지연·1차 통과·`checkLessonResponse` 위반·상황 반영에 주는 영향을 잰다.
 * 같은 모양의 요청을 ① 일반(상황 없음 — 기준선) ② 주제+상황 ③ 상황 단독 으로 **직렬** 호출한다. 합성 입력만 쓴다(학습자 데이터 없음).
 *
 * **DB 를 읽지도 쓰지도 않는다** — `routerDeps.loadChain` 을 시드 모양 고정 연결로 바꿔 끼운다. 요청은 운영과 같은 `buildLessonRequest`(extraCheck·repair·strip 포함), 태스크는 실제 `lesson`(balanced·120s).
 * 한도 신호(429 등)가 보이면 **즉시 멈춘다**.
 *
 * 재는 것: 1차 통과(attempts 1) · 최종 실패 · 지연 · `checkLessonResponse` 최종 위반(0 이어야 한다) · 응답 크기 · **상황 반영**: 상황 핵심 표현(≤5) 중 chunks 표기에 들어간 수 ·
 * dialogue 에 들어간 수 · rolesKo.A/B 가 상황 역할 이름인가 · application/speaking 과제 문구가 상황의 장면을 다루는가(핵심어 포함 — 눈 판정 보조).
 *
 * 실행(개발 미러, 한 번에 하나): cd ~/.node-local/thekaiwa-010d-pe2 && DATABASE_URL=mysql://invalid:invalid@127.0.0.1:1/invalid OUT=<결과.json> RUNS="plain:1,topic:3,only:2" node --import tsx tests/live/task010d-pe-lesson-measure.ts
 * 환경: RUNS=<종류:횟수 쉼표 목록 — plain·topic·only> · GAP_MS=1500 · RESUME=1 · DUMP=1(결과 파일만 읽어 표 출력)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { llm } from '../../src/modules/engine'
import { routerDeps, type ResolvedConnection } from '../../src/modules/engine/router'
import { LESSON_PROMPT_VERSION, LESSON_SCENARIO_PROMPT_VERSION, buildLessonRequest, lessonPromptVersion, type LessonInput, type LessonScenarioInput, type LessonTopicInput } from '../../src/modules/conversation/prompts/lesson'
import { checkLessonResponse } from '../../src/modules/conversation/structuredResponse/checks'
import type { LessonResponse } from '../../src/modules/conversation/structuredResponse/schemas'

const OUT = process.env.OUT ?? '/tmp/kaiwa-task010d-lesson-measure.json'
const GAP_MS = Number(process.env.GAP_MS ?? 1500)
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

const learner = { displayName: '브라운', teacherName: '유우', level: 'N5', weaknesses: ['PARTICLE(2)'], streakDays: 4 }
const topic: LessonTopicInput = {
  title: '카페 주문',
  titleJa: 'カフェで注文',
  level: 'N5',
  chunks: [
    { id: 'cafe-01', chunkType: 'NAME', textJa: 'アイスコーヒー', reading: 'あいすこーひー', meaningKo: '아이스커피' },
    { id: 'cafe-02', chunkType: 'NAME', textJa: 'ホットコーヒー', reading: 'ほっとこーひー', meaningKo: '뜨거운 커피' },
    { id: 'cafe-03', chunkType: 'NAME', textJa: 'サイズ', reading: 'さいず', meaningKo: '사이즈' },
    { id: 'cafe-04', chunkType: 'ACTION', textJa: '注文します', reading: 'ちゅうもんします', meaningKo: '주문해요' },
    { id: 'cafe-05', chunkType: 'ACTION', textJa: 'お願いします', reading: 'おねがいします', meaningKo: '부탁해요' },
    { id: 'cafe-06', chunkType: 'ACTION', textJa: '変えてください', reading: 'かえてください', meaningKo: '바꿔 주세요' },
    { id: 'cafe-07', chunkType: 'FEELING', textJa: 'ちょうどいいです', reading: 'ちょうどいいです', meaningKo: '딱 좋아요' },
    { id: 'cafe-08', chunkType: 'MODIFIER', textJa: '大きい', reading: 'おおきい', meaningKo: '큰' },
    { id: 'cafe-09', chunkType: 'MODIFIER', textJa: '小さい', reading: 'ちいさい', meaningKo: '작은' },
    { id: 'cafe-10', chunkType: 'MODIFIER', textJa: '持ち帰り', reading: 'もちかえり', meaningKo: '포장' },
  ],
}
const scenario: LessonScenarioInput = {
  title: '카페에서 주문 바꾸기',
  titleJa: 'カフェで注文を変える',
  level: 'N5',
  roles: { learner: '손님', tutor: '점원' },
  goalKo: '주문한 음료의 사이즈와 온도를 바꿔 다시 주문한다',
  steps: [{ ko: '인사하고 음료 말하기' }, { ko: '사이즈 바꾸기' }, { ko: '뜨겁게 또는 차갑게 바꾸기' }, { ko: '포장 여부 답하기' }, { ko: '계산하고 인사하기' }],
  expressions: [
    { ja: 'サイズを変えてください', ko: '사이즈를 바꿔 주세요' },
    { ja: 'ホットにしてください', ko: '따뜻한 걸로 해 주세요' },
    { ja: '持ち帰りでお願いします', ko: '포장으로 부탁해요' },
    { ja: 'もう一度お願いします', ko: '다시 한번 부탁해요' },
    { ja: 'カードで払います', ko: '카드로 낼게요' },
  ],
}

type Kind = 'plain' | 'topic' | 'only'
const INPUTS: Record<Kind, LessonInput> = {
  plain: { todayKst: '2026-10-07', learner, topic },
  topic: { todayKst: '2026-10-07', learner, topic, scenario },
  only: { todayKst: '2026-10-07', learner, scenario },
}

interface Row {
  id: string
  kind: Kind
  ok: boolean
  ms: number
  version: string
  attempts?: 1 | 2
  promptChars?: number
  resultChars?: number
  violations?: number
  violationList?: string[]
  chunks?: number
  exprInChunks?: number
  exprInDialogue?: number
  rolesOk?: boolean
  rolesKo?: { A: string; B: string }
  sample?: { title: string; dialogue: string[]; speaking: string[]; application: string[] }
  error?: string
  limitHit?: boolean
}
interface Saved { startedAt: string; rows: Row[] }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const pct = (xs: number[], p: number) => {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]
}
const norm = (s: string) => s.normalize('NFKC').replace(/[\s、。，．,.!！?？・「」『』〜～]/g, '')
const save = (rows: Row[], startedAt: string) => writeFileSync(OUT, JSON.stringify({ startedAt, rows } satisfies Saved, null, 1))

async function runOne(kind: Kind, n: number): Promise<Row> {
  const input = INPUTS[kind]
  const req = buildLessonRequest(input)
  const base: Row = { id: `${kind}#${n}`, kind, ok: false, ms: 0, version: lessonPromptVersion(input) }
  const t0 = Date.now()
  try {
    const r = await llm.completeJson<LessonResponse>({ ...req, timeoutMs: 150_000 })
    const violations = checkLessonResponse({ allowedChunkIds: req.allowedChunkIds }, r.data)
    const chunkText = r.data.chunks.map((c) => norm(c.textJa)).join('|')
    const dlg = r.data.dialogue.map((d) => norm(d.ja)).join('|')
    const exprs = scenario.expressions.map((e) => norm(e.ja).replace(/^〜/, ''))
    const row: Row = {
      ...base, ok: true, ms: r.elapsedMs, attempts: r.attempts, promptChars: r.promptChars, resultChars: JSON.stringify(r.data).length,
      violations: violations.length, violationList: violations.map((v) => String(v).slice(0, 120)),
      chunks: r.data.chunks.length,
      exprInChunks: exprs.filter((e) => chunkText.includes(e)).length,
      exprInDialogue: exprs.filter((e) => dlg.includes(e)).length,
      rolesKo: { A: r.data.rolesKo.A, B: r.data.rolesKo.B },
      rolesOk: [r.data.rolesKo.A, r.data.rolesKo.B].some((x) => x.includes(scenario.roles.learner)) && [r.data.rolesKo.A, r.data.rolesKo.B].some((x) => x.includes('점원')),
      sample: { title: `${r.data.title} / ${r.data.titleKo}`, dialogue: r.data.dialogue.map((d) => `${d.speaker}: ${d.ja}`), speaking: r.data.speaking.map((s) => s.promptKo), application: r.data.application.map((a) => a.promptKo) },
    }
    return row
  } catch (e) {
    const er = e as Error & { raw?: string }
    return { ...base, ms: Date.now() - t0, error: `${er.name}: ${er.message.slice(0, 200)}`, limitHit: LIMIT_RE.test(`${er.message} ${er.raw ?? ''}`) }
  }
}

function table(rows: Row[]) {
  console.log(`\n## A4 [상황] 블록 — ${LESSON_PROMPT_VERSION} (일반) / ${LESSON_SCENARIO_PROMPT_VERSION} (상황) · 호출 ${rows.length}`)
  console.log('| 호출 | ms | 시도 | 요청 자수 | 응답 자수 | 최종 위반 | 청크 | 표현→chunks | 표현→대화 | rolesKo(A/B) 역할 반영 |')
  console.log('|---|---|---|---|---|---|---|---|---|---|')
  for (const r of rows) {
    if (!r.ok) { console.log(`| ${r.id} | ${r.ms} | - | FAILED ${r.error} |`); continue }
    console.log(`| ${r.id} | ${r.ms} | ${r.attempts} | ${r.promptChars} | ${r.resultChars} | ${r.violations} | ${r.chunks} | ${r.exprInChunks}/5 | ${r.exprInDialogue}/5 | ${r.rolesKo!.A}/${r.rolesKo!.B} ${r.rolesOk ? 'O' : 'X'} |`)
  }
  for (const kind of ['plain', 'topic', 'only'] as Kind[]) {
    const rs = rows.filter((r) => r.kind === kind)
    if (!rs.length) continue
    const ok = rs.filter((r) => r.ok)
    const ms = ok.map((r) => r.ms)
    console.log(`${kind}: 호출 ${rs.length} · 성공 ${ok.length} · 1차 통과 ${ok.filter((r) => r.attempts === 1).length}/${ok.length} · 최종 위반 합계 ${ok.reduce((a, r) => a + (r.violations ?? 0), 0)} · 지연 평균 ${Math.round(ms.reduce((a, b) => a + b, 0) / Math.max(1, ms.length))}ms · p50 ${pct(ms, 50)} · max ${Math.max(...ms, 0)} · 요청 ${ok.map((r) => r.promptChars).join('/')}`)
    if (kind !== 'plain') console.log(`   상황 반영: 표현→chunks 평균 ${(ok.reduce((a, r) => a + (r.exprInChunks ?? 0), 0) / Math.max(1, ok.length)).toFixed(1)}/5 · 표현→대화 ${(ok.reduce((a, r) => a + (r.exprInDialogue ?? 0), 0) / Math.max(1, ok.length)).toFixed(1)}/5 · rolesKo 반영 ${ok.filter((r) => r.rolesOk).length}/${ok.length}`)
  }
}

function show(rows: Row[]) {
  for (const r of rows.filter((x) => x.ok && x.kind !== 'plain')) {
    console.log(`\n### ${r.id} (${r.ms}ms) ${r.sample!.title} · rolesKo ${r.rolesKo!.A}/${r.rolesKo!.B}`)
    r.sample!.dialogue.forEach((d) => console.log(`  ${d}`))
    console.log(`  application: ${r.sample!.application.join(' | ')}`)
    console.log(`  speaking: ${r.sample!.speaking.join(' | ')}`)
    if (r.violationList?.length) console.log(`  위반: ${r.violationList.join(' ; ')}`)
  }
}

async function main() {
  if (process.env.DUMP === '1') { const s = JSON.parse(readFileSync(OUT, 'utf8')) as Saved; table(s.rows); if (process.env.SHOW === '1') show(s.rows); return }
  const plan = (process.env.RUNS ?? 'plain:1,topic:3,only:2').split(',').map((x) => x.split(':') as [Kind, string])
  const startedAt = new Date().toISOString()
  const prior: Row[] = process.env.RESUME === '1' && existsSync(OUT) ? (JSON.parse(readFileSync(OUT, 'utf8')) as Saved).rows : []
  const rows: Row[] = [...prior]
  const done = new Set(prior.filter((r) => r.ok).map((r) => r.id))
  for (const [kind, count] of plan) {
    for (let n = 1; n <= Number(count); n++) {
      const id = `${kind}#${n}`
      if (done.has(id)) continue
      const row = await runOne(kind, n)
      const idx = rows.findIndex((r) => r.id === id)
      if (idx >= 0) rows[idx] = row
      else rows.push(row)
      save(rows, startedAt)
      console.log(`${row.ok ? 'OK ' : 'ERR'} ${id} ${row.ms}ms ${row.ok ? `attempts=${row.attempts} violations=${row.violations} chars=${row.promptChars}` : row.error}`)
      if (row.limitHit) { console.log('\n⚠ 한도 신호 — 즉시 중단(추정값을 쓰지 않는다)'); table(rows); process.exit(2) }
      await sleep(GAP_MS)
    }
  }
  table(rows)
  show(rows)
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1) })
