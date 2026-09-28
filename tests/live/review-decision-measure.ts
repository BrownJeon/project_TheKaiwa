/**
 * task-010b 실측 — 실제 Claude CLI(구독)로 A11(REVIEW_DECISION, `buildReviewDecisionRequest`)을 돌려 지연·JSON 계약
 * 준수·`normalizeReviewDecision` 보정/폴백 건수를 잰다. **운영 DB 를 바꾸지 않는다**(결과는 stdout·/tmp 파일).
 *
 * 지시(task-010b): 3회 — 정상 / FOCUS 많음 / 항목 1개.
 *
 * 실행(우분투 미러): cd ~/.node-local/thekaiwa && node --env-file=.env --import tsx tests/live/review-decision-measure.ts
 */
import { writeFileSync } from 'node:fs'
import { llm } from '../../src/modules/engine'
import {
  buildReviewDecisionRequest,
  normalizeReviewDecision,
  type ReviewDecisionCandidateInput,
  type ReviewDecisionResponse,
} from '../../src/modules/conversation'

const learner = { displayName: '브라운', teacherName: '유우', level: 'N4', weaknesses: ['CONJUGATION(3)', 'PARTICLE(2)'], streakDays: 4 }

const normalCandidates: ReviewDecisionCandidateInput[] = [
  { itemId: 'rep-01', itemType: 'EXPRESSION', textJa: 'よろしくお願いします', meaningKo: '잘 부탁합니다', studiedCount: 4, correctCount: 2, wrongCount: 2, feedbackCount: 1, lastStudiedAt: '2026-09-20', intervalDays: 3, priority: 'NORMAL' },
  { itemId: 'rep-02', itemType: 'GRAMMAR', textJa: '〜てもいいですか', meaningKo: '~해도 되나요?', studiedCount: 6, correctCount: 5, wrongCount: 1, feedbackCount: 0, lastStudiedAt: '2026-09-22', intervalDays: 5, priority: 'NORMAL' },
  { itemId: 'rep-03', itemType: 'WORD', textJa: '緊張しています', meaningKo: '긴장하고 있습니다', studiedCount: 2, correctCount: 0, wrongCount: 2, feedbackCount: 3, lastStudiedAt: '2026-09-24', intervalDays: 3, priority: 'FOCUS' },
  { itemId: 'rep-04', itemType: 'CHUNK', textJa: '会社員です', meaningKo: '회사원입니다', studiedCount: 8, correctCount: 8, wrongCount: 0, feedbackCount: 0, lastStudiedAt: '2026-09-18', intervalDays: 7, priority: 'NORMAL' },
  { itemId: 'rep-05', itemType: 'EXPRESSION', textJa: '韓国から来ました', meaningKo: '한국에서 왔습니다', studiedCount: 1, correctCount: 0, wrongCount: 1, feedbackCount: 1, lastStudiedAt: null, intervalDays: 3, priority: 'NORMAL' },
  { itemId: 'rep-06', itemType: 'WORD', textJa: '楽しみです', meaningKo: '기대됩니다', studiedCount: 3, correctCount: 2, wrongCount: 1, feedbackCount: 0, lastStudiedAt: '2026-09-25', intervalDays: 4, priority: 'NORMAL' },
]

const focusHeavyCandidates: ReviewDecisionCandidateInput[] = [
  { itemId: 'f-01', itemType: 'GRAMMAR', textJa: '〜んですけど', meaningKo: '~인데요', studiedCount: 5, correctCount: 1, wrongCount: 4, feedbackCount: 5, lastStudiedAt: '2026-09-23', intervalDays: 3, priority: 'FOCUS' },
  { itemId: 'f-02', itemType: 'EXPRESSION', textJa: 'すみません、もう一度お願いします', meaningKo: '죄송해요, 다시 한번 부탁해요', studiedCount: 6, correctCount: 1, wrongCount: 5, feedbackCount: 6, lastStudiedAt: '2026-09-24', intervalDays: 3, priority: 'FOCUS' },
  { itemId: 'f-03', itemType: 'WORD', textJa: '緊張' , meaningKo: '긴장', studiedCount: 4, correctCount: 0, wrongCount: 4, feedbackCount: 4, lastStudiedAt: '2026-09-22', intervalDays: 3, priority: 'FOCUS' },
  { itemId: 'f-04', itemType: 'CHUNK', textJa: '会社員です', meaningKo: '회사원입니다', studiedCount: 7, correctCount: 7, wrongCount: 0, feedbackCount: 0, lastStudiedAt: '2026-09-15', intervalDays: 7, priority: 'NORMAL' },
  { itemId: 'f-05', itemType: 'GRAMMAR', textJa: '〜させていただきます', meaningKo: '~하겠습니다(겸양)', studiedCount: 3, correctCount: 0, wrongCount: 3, feedbackCount: 4, lastStudiedAt: '2026-09-25', intervalDays: 3, priority: 'FOCUS' },
]

const singleCandidate: ReviewDecisionCandidateInput[] = [
  { itemId: 'solo-01', itemType: 'EXPRESSION', textJa: 'はじめまして', meaningKo: '처음 뵙겠습니다', studiedCount: 1, correctCount: 1, wrongCount: 0, feedbackCount: 0, lastStudiedAt: '2026-09-27', intervalDays: 3, priority: 'NORMAL' },
]

interface RunRow {
  label: string
  ok: boolean
  ms: number
  attempts?: 1 | 2
  model?: string
  promptChars?: number
  resultChars?: number
  candidateCount: number
  decisionsReturned?: number
  normalize?: { clamped: number; discarded: number; fallback: number; sessionPlanPruned: number }
  error?: string
}

async function run(label: string, candidates: ReviewDecisionCandidateInput[]): Promise<RunRow> {
  const req = buildReviewDecisionRequest({ todayKst: '2026-09-28', learner, candidates })
  const t0 = Date.now()
  try {
    const r = await llm.completeJson<ReviewDecisionResponse>({ ...req, timeoutMs: 90_000 })
    const ms = Date.now() - t0
    const normalized = normalizeReviewDecision({ candidates: candidates.map((c) => ({ itemId: c.itemId, intervalDays: c.intervalDays, priority: c.priority })) }, r.data)
    return {
      label, ok: true, ms, attempts: r.attempts, model: r.model, promptChars: r.promptChars, resultChars: JSON.stringify(r.data).length,
      candidateCount: candidates.length, decisionsReturned: r.data.decisions.length, normalize: normalized.counts,
    }
  } catch (e) {
    const err = e as Error
    return { label, ok: false, ms: Date.now() - t0, candidateCount: candidates.length, error: `${err.name}: ${err.message.slice(0, 200)}` }
  }
}

async function main() {
  console.log('reviewDecision(A11) 실측 — 정상 1회 · FOCUS 많음 1회 · 항목 1개 1회')
  const rows: RunRow[] = []
  rows.push(await run('normal', normalCandidates))
  console.log(JSON.stringify(rows[rows.length - 1]))
  rows.push(await run('focus-heavy', focusHeavyCandidates))
  console.log(JSON.stringify(rows[rows.length - 1]))
  rows.push(await run('single-item', singleCandidate))
  console.log(JSON.stringify(rows[rows.length - 1]))

  console.log(`\n## 요약 — n=${rows.length} 성공=${rows.filter((r) => r.ok).length}`)
  console.log('| run | 성공 | ms | attempts | 후보 | decisions | clamped | discarded | fallback | planPruned |')
  console.log('|---|---|---|---|---|---|---|---|---|---|')
  for (const r of rows) {
    if (!r.ok) {
      console.log(`| ${r.label} | FAILED | ${r.ms} | - | ${r.candidateCount} | - | - | - | - | - | ${r.error} |`)
      continue
    }
    const n = r.normalize!
    console.log(`| ${r.label} | OK | ${r.ms} | ${r.attempts} | ${r.candidateCount} | ${r.decisionsReturned} | ${n.clamped} | ${n.discarded} | ${n.fallback} | ${n.sessionPlanPruned} |`)
  }
  writeFileSync('/tmp/kaiwa-review-decision-measure.json', JSON.stringify({ at: new Date().toISOString(), rows }, null, 1))
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
