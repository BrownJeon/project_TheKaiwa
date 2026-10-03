/**
 * task-011 실측(evalGen@v4) — CORRECTION_SPOT `prompt.segments`(틀린 곳 찾기 탭 조각)를 **모델이 내게 할지·코드가 끊을지·혼합할지**
 * 결정하기 위한 A6 TALK 실호출 측정. Leader 지시: 실 Claude CLI A6 호출 ≥8회, 난이도 다양, 계약 준수율·재시도율·조각 품질(조사만 조각·
 * 1글자 조각·wrongSpan 정렬)을 잰다. 5초/12초 예산은 적용하지 않는다(A6 는 배치 120s). **운영 DB 를 바꾸지 않는다**(읽기 전용, 호출만).
 *
 * 측정 방법 — `buildEvalGenRequest` 가 돌려준 `extraCheck` 를 감싸, 시도(attempt)마다 repair **전** 모델 원본 조각을 깊은 복사로 잡는다:
 *   - 모델 원본: 계약 통과율(join·3~12·조사만·wrongSpan run ≤2·남는 조각 ≥1), 조사만 조각·1글자 조각 수, 조각 수 분포, 없음(undefined) 비율
 *   - 코드 분절기 단독: 같은 문장을 `splitSentenceIntoSegments` 로 끊었을 때 계약 통과율(모델이 쓴 문장 기준 — 히라가나 위주 문장이 문제)
 *   - 혼합(운영 경로): repair 결과 kept / derived / unresolved, 최종 성공(completeJson 성공)·attempts
 *   - 예시 문장 복사 여부(프롬프트 예시 「私は毎日学校に行くます。」)
 *
 * 실행(우분투 미러): cd ~/.node-local/thekaiwa && node --env-file=.env --import tsx tests/live/eval-gen-segments-measure.ts
 *   환경변수 RUNS(기본 12) · CONCURRENCY(기본 1). 결과 JSON: /tmp/kaiwa-eval-gen-segments-measure.json
 * 429(사용량 한도)가 나면 BLOCKED 로 기록하고 멈춘다 — 추정값을 쓰지 않는다.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { llm } from '../../src/modules/engine'
import { buildEvalGenRequest, type EvalGenInput, type EvalGenResponse, type EvalGenWordCandidate } from '../../src/modules/conversation'
import {
  analyzeCorrectionSegments,
  checkCorrectionSpotSegments,
  splitSentenceIntoSegments,
  type CorrectionSegmentStats,
} from '../../src/modules/conversation/structuredResponse/evalChecks'

interface Fixture {
  level: string
  topic: { title: string; titleJa: string }
  materials: EvalGenWordCandidate[]
}
const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/evalGen.json'), 'utf8')) as Fixture

const EXAMPLE_SENTENCE = '私は毎日学校に行くます。'
const RUNS = Number(process.env.RUNS ?? 12)
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY ?? 1))

/** 난이도·주제 조합 — N5~N1 고르게, 주제도 바꿔 문장이 한 곳에 쏠리지 않게 한다. */
const MATRIX: Array<{ level: EvalGenInput['level']; topic: { title: string; titleJa: string } }> = [
  { level: 'N5' as EvalGenInput['level'], topic: fixture.topic },
  { level: 'N5' as EvalGenInput['level'], topic: { title: '역에서 길 묻기', titleJa: '駅で道を聞く' } },
  { level: 'N5' as EvalGenInput['level'], topic: { title: '자기소개', titleJa: '自己紹介' } },
  { level: 'N4' as EvalGenInput['level'], topic: fixture.topic },
  { level: 'N4' as EvalGenInput['level'], topic: { title: '병원에서 증상 말하기', titleJa: '病院で症状を伝える' } },
  { level: 'N4' as EvalGenInput['level'], topic: { title: '주말 계획 이야기', titleJa: '週末の予定を話す' } },
  { level: 'N3' as EvalGenInput['level'], topic: fixture.topic },
  { level: 'N3' as EvalGenInput['level'], topic: { title: '회사에서 일정 조정', titleJa: '職場でスケジュールを調整する' } },
  { level: 'N2' as EvalGenInput['level'], topic: { title: '뉴스 이야기', titleJa: 'ニュースについて話す' } },
  { level: 'N2' as EvalGenInput['level'], topic: fixture.topic },
  { level: 'N1' as EvalGenInput['level'], topic: { title: '사회 문제 토론', titleJa: '社会問題について意見を述べる' } },
  { level: 'N5' as EvalGenInput['level'], topic: { title: '가게에서 쇼핑', titleJa: '店で買い物をする' } },
]

interface AttemptSample {
  attempt: number
  sentenceJa: string
  wrongSpan: string
  /** 모델 원본 조각(repair 전). undefined → null. */
  rawSegments: string[] | null
  rawStats: CorrectionSegmentStats | null
  rawViolations: string[]
  rawPass: boolean
  /** 혼합 경로 결과. */
  repair: 'kept' | 'derived' | 'unresolved'
  finalSegments: string[] | null
  /** 같은 문장을 코드 분절기만으로 끊었을 때. */
  codeOnly: { segments: string[]; pass: boolean; violations: string[]; stats: CorrectionSegmentStats }
  copiedExample: boolean
  /** 이 시도의 extraCheck 위반 전체(다른 종류 포함) — 재시도 원인 파악용. */
  allViolations: string[]
}

interface RunRow {
  label: string
  level: string
  topic: string
  ok: boolean
  ms: number
  attempts?: 1 | 2
  samples: AttemptSample[]
  error?: string
  blocked429?: boolean
}

function snapshotSpot(data: EvalGenResponse): { sentenceJa: string; wrongSpan: string; segments: string[] | null } | null {
  for (const it of data.items) {
    if (it.kind !== 'CORRECTION_SPOT') continue
    return {
      sentenceJa: it.prompt.sentenceJa,
      wrongSpan: it.expected.wrongSpan,
      segments: Array.isArray(it.prompt.segments) ? [...it.prompt.segments] : null,
    }
  }
  return null
}

async function runOnce(label: string, level: EvalGenInput['level'], topic: { title: string; titleJa: string }): Promise<RunRow> {
  const req = buildEvalGenRequest({
    todayKst: '2026-10-01', kind: 'TALK', level, topic, materials: fixture.materials, recentHashes: [],
  })
  const orig = req.extraCheck
  if (!orig) throw new Error('extraCheck 가 없다 — buildEvalGenRequest 구조가 바뀌었다')
  const samples: AttemptSample[] = []
  let attemptNo = 0
  req.extraCheck = (data, info) => {
    attemptNo++
    const raw = snapshotSpot(data) // repair 전 모델 원본(깊은 복사)
    const violations = orig(data, info)
    if (raw) {
      const rawSegs = raw.segments
      const rawViolations = checkCorrectionSpotSegments(raw.sentenceJa, rawSegs ?? undefined, raw.wrongSpan)
      const after = snapshotSpot(data)
      const repair: AttemptSample['repair'] = rawViolations.length === 0 ? 'kept' : after?.segments ? 'derived' : 'unresolved'
      const codeSegs = splitSentenceIntoSegments(raw.sentenceJa)
      const codeViolations = checkCorrectionSpotSegments(raw.sentenceJa, codeSegs, raw.wrongSpan)
      samples.push({
        attempt: attemptNo,
        sentenceJa: raw.sentenceJa,
        wrongSpan: raw.wrongSpan,
        rawSegments: rawSegs,
        rawStats: rawSegs ? analyzeCorrectionSegments(raw.sentenceJa, rawSegs, raw.wrongSpan) : null,
        rawViolations,
        rawPass: rawViolations.length === 0,
        repair,
        finalSegments: after?.segments ?? null,
        codeOnly: { segments: codeSegs, pass: codeViolations.length === 0, violations: codeViolations, stats: analyzeCorrectionSegments(raw.sentenceJa, codeSegs, raw.wrongSpan) },
        copiedExample: raw.sentenceJa === EXAMPLE_SENTENCE,
        allViolations: violations,
      })
    } else {
      samples.push({
        attempt: attemptNo, sentenceJa: '', wrongSpan: '', rawSegments: null, rawStats: null, rawViolations: ['CORRECTION_SPOT 문항 없음'], rawPass: false,
        repair: 'unresolved', finalSegments: null,
        codeOnly: { segments: [], pass: false, violations: ['문항 없음'], stats: analyzeCorrectionSegments('', [], '') }, copiedExample: false, allViolations: violations,
      })
    }
    return violations
  }
  const t0 = Date.now()
  try {
    const r = await llm.completeJson<EvalGenResponse>({ ...req, timeoutMs: 180_000 })
    return { label, level, topic: topic.titleJa, ok: true, ms: Date.now() - t0, attempts: r.attempts, samples }
  } catch (e) {
    const err = e as Error
    const msg = `${err.name}: ${err.message.slice(0, 400)}`
    return { label, level, topic: topic.titleJa, ok: false, ms: Date.now() - t0, samples, error: msg, blocked429: /429|rate.?limit|usage limit|limit reached/i.test(msg) }
  }
}

const pct = (n: number, d: number): string => (d === 0 ? 'n/a' : `${((n / d) * 100).toFixed(0)}% (${n}/${d})`)

async function main() {
  console.log(`eval-gen(A6) evalGen@v4 CORRECTION_SPOT segments 실측 — TALK ${RUNS}회(동시 ${CONCURRENCY}), 난이도·주제 교차`)
  const rows: RunRow[] = []
  let blocked = false
  const queue = Array.from({ length: RUNS }, (_, i) => i)
  async function worker() {
    while (queue.length > 0 && !blocked) {
      const i = queue.shift() as number
      const m = MATRIX[i % MATRIX.length]
      const row = await runOnce(`TALK#${i + 1}`, m.level, m.topic)
      rows.push(row)
      const head = `${row.label} ${row.level} ${row.topic} ok=${row.ok} attempts=${row.attempts ?? '-'} ${row.ms}ms`
      console.log(head)
      for (const s of row.samples) {
        console.log(`   #${s.attempt} 「${s.sentenceJa}」 wrong=「${s.wrongSpan}」 raw=${s.rawSegments ? s.rawSegments.join('|') : '(없음)'} rawPass=${s.rawPass} repair=${s.repair} code=${s.codeOnly.segments.join('|')} codePass=${s.codeOnly.pass}`)
        if (!s.rawPass) console.log(`      raw 위반: ${s.rawViolations.join(' ; ')}`)
        if (s.allViolations.length > 0) console.log(`      시도 위반 전체: ${s.allViolations.join(' ; ').slice(0, 400)}`)
      }
      if (!row.ok) console.log(`   FAILED: ${row.error}`)
      if (row.blocked429) {
        blocked = true
        console.log('BLOCKED: 429/사용량 한도 — 여기서 멈춘다(추정 없음)')
      }
      writeFileSync('/tmp/kaiwa-eval-gen-segments-measure.json', JSON.stringify({ at: new Date().toISOString(), blocked, rows }, null, 1))
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

  rows.sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }))
  const samples = rows.flatMap((r) => r.samples)
  const withSpot = samples.filter((s) => s.sentenceJa !== '')
  const okRows = rows.filter((r) => r.ok)
  const retried = rows.filter((r) => r.attempts === 2)
  const n = withSpot.length
  const rawPresent = withSpot.filter((s) => s.rawSegments !== null)
  const particleOnlyPieces = rawPresent.reduce((a, s) => a + (s.rawStats?.particleOnly ?? 0), 0)
  const singleCharPieces = rawPresent.reduce((a, s) => a + (s.rawStats?.singleChar ?? 0), 0)
  const totalPieces = rawPresent.reduce((a, s) => a + (s.rawStats?.count ?? 0), 0)
  const joinEqual = rawPresent.filter((s) => s.rawStats?.joinEqual).length
  const inRange = rawPresent.filter((s) => s.rawStats && s.rawStats.count >= 3 && s.rawStats.count <= 12).length
  const runOk = rawPresent.filter((s) => s.rawStats && s.rawStats.runLength >= 1 && s.rawStats.runLength <= 2).length
  const countDist: Record<string, number> = {}
  for (const s of rawPresent) countDist[String(s.rawStats?.count)] = (countDist[String(s.rawStats?.count)] ?? 0) + 1
  const runDist: Record<string, number> = {}
  for (const s of rawPresent) runDist[String(s.rawStats?.runLength)] = (runDist[String(s.rawStats?.runLength)] ?? 0) + 1
  const repairCount = { kept: 0, derived: 0, unresolved: 0 }
  for (const s of withSpot) repairCount[s.repair]++
  const segViolationRetried = retried.filter((r) => r.samples[0]?.allViolations.some((v) => v.includes('prompt.segments'))).length
  const otherRetried = retried.length - segViolationRetried
  const codePass = withSpot.filter((s) => s.codeOnly.pass).length
  const hiraganaOnlyWrong = withSpot.filter((s) => !/[一-鿿゠-ヿ]/.test(s.sentenceJa)).length
  const copied = withSpot.filter((s) => s.copiedExample).length

  console.log('\n## 요약')
  console.log(`- 호출 ${rows.length}회: 성공 ${okRows.length}, 실패 ${rows.length - okRows.length}, 재시도(attempts=2) ${retried.length} (segments 때문 ${segViolationRetried}, 다른 위반 ${otherRetried}) · 평균 ${rows.length ? Math.round(rows.reduce((a, r) => a + r.ms, 0) / rows.length) : 0}ms`)
  console.log(`- CORRECTION_SPOT 표본(시도 단위) ${n}개 — 문장이 히라가나뿐(한자·가타카나 없음) ${hiraganaOnlyWrong}개 · 예시 문장 복사 ${copied}개`)
  console.log(`- 모델 원본 segments 존재 ${pct(rawPresent.length, n)} · join 일치 ${pct(joinEqual, rawPresent.length)} · 3~12개 ${pct(inRange, rawPresent.length)} · wrongSpan run 1~2 ${pct(runOk, rawPresent.length)}`)
  console.log(`- 모델 원본 계약 전체 통과 ${pct(withSpot.filter((s) => s.rawPass).length, n)}`)
  console.log(`- 조각 품질(모델 원본) 조사만 조각 ${particleOnlyPieces}/${totalPieces} · 1글자 조각 ${singleCharPieces}/${totalPieces}`)
  console.log(`- 조각 수 분포 ${JSON.stringify(countDist)} · wrongSpan run 분포 ${JSON.stringify(runDist)}`)
  console.log(`- 코드 분절기 단독 계약 통과 ${pct(codePass, n)} (모델이 쓴 문장 기준)`)
  console.log(`- 혼합 경로(운영) kept ${repairCount.kept} / derived ${repairCount.derived} / unresolved ${repairCount.unresolved} (시도 ${n}개 기준)`)
  console.log(`- 최종 출제 성공률 ${pct(okRows.length, rows.length)}`)
  writeFileSync('/tmp/kaiwa-eval-gen-segments-measure.json', JSON.stringify({ at: new Date().toISOString(), blocked, rows }, null, 1))
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
