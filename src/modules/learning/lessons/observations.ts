/**
 * 레슨 완료 관측(task-010b L3) — 순수 함수. 완료 트랜잭션(#62)이 `recordObservations` 로 같은 tx 에 쓴다.
 *
 *  - quiz 문항마다 1건: 대상(targetIds)에 문법(grammar id)이 하나라도 있으면 `GRAMMAR_USE`, 아니면 `VOCAB_RECOGNITION`.
 *    정답 SUCCESS · 오답 FAIL · 미답 SKIPPED. 탭 답이라 신뢰도 1.0.
 *  - 말하기 과제마다 1건 `SENTENCE_PRODUCTION`: 판정 가능한 목표를 모두 썼으면 SUCCESS · 일부 PARTIAL · 하나도 못 썼으면 FAIL · 시도 안 함 SKIPPED.
 *    판정할 수 있는 목표가 없는 과제를 말했으면 PARTIAL(`meta.unjudged`). 발화로 답했으면 신뢰도 = 그 발화의 STT 신뢰도(라우트가 speech 에서
 *    읽어 넘긴다 — 없으면 1.0), 글자로 답했으면 1.0.
 *  원문은 싣지 않는다(refType `Lesson`·refId = 레슨 id, meta = 문항·과제 id).
 *
 * task-081(§37-13 ⑤): 새 수업은 문항이 없다(`content.quiz` = []) → 문항 관측(`GRAMMAR_USE`·`VOCAB_RECOGNITION`) 0건, 말하기 관측만 남는다.
 * `quizTargetTally` 도 빈 Map 이라 복습 레슨은 `studiedCount+1` 만 — 레슨 완료로 `wrongCount` 가 늘지 않는다. 옛 수업은 그대로.
 */
import type { ObservationInput } from '../observations'
import type { QuizOutcome, StoredLessonContent } from './content'
import type { SpeakingEntry } from './progress'

/** quiz 결과를 대상 id(레슨 안 id)별 정답·오답 수로(문항 단위 — 한 문항이 같은 대상을 두 번 세지 않는다). */
export function quizTargetTally(quiz: readonly { targetIds: readonly string[] }[], outcomes: readonly QuizOutcome[]): Map<string, { correct: number; wrong: number }> {
  const tally = new Map<string, { correct: number; wrong: number }>()
  quiz.forEach((q, i) => {
    const o = outcomes[i]
    if (!o) return
    for (const id of new Set(q.targetIds)) {
      const t = tally.get(id) ?? { correct: 0, wrong: 0 }
      if (o === 'CORRECT') t.correct++
      else t.wrong++
      tally.set(id, t)
    }
  })
  return tally
}

export function lessonObservations(
  lessonId: string,
  content: Pick<StoredLessonContent, 'grammar' | 'quiz' | 'speaking'>,
  outcomes: readonly QuizOutcome[],
  speaking: readonly Pick<SpeakingEntry, 'itemId' | 'matchedIds' | 'missedIds' | 'utteranceId'>[],
  confidence: ReadonlyMap<string, number> = new Map(),
): ObservationInput[] {
  const grammarIds = new Set(content.grammar.map((g) => g.id))
  const out: ObservationInput[] = content.quiz.map((q, i) => {
    const o = outcomes[i]
    return {
      kind: q.targetIds.some((t) => grammarIds.has(t)) ? 'GRAMMAR_USE' : 'VOCAB_RECOGNITION',
      outcome: o === 'CORRECT' ? 'SUCCESS' : o === 'WRONG' ? 'FAIL' : 'SKIPPED',
      refType: 'Lesson',
      refId: lessonId,
      confidence: 1,
      meta: { item: q.id.slice(0, 20), stage: 'quiz' },
    }
  })
  const bySpeaking = new Map(speaking.map((s) => [s.itemId, s]))
  for (const task of content.speaking) {
    const rec = bySpeaking.get(task.id)
    if (!rec) {
      out.push({ kind: 'SENTENCE_PRODUCTION', outcome: 'SKIPPED', refType: 'Lesson', refId: lessonId, confidence: 1, meta: { item: task.id.slice(0, 20), stage: 'speaking' } })
      continue
    }
    const used = rec.matchedIds.length
    const missed = rec.missedIds.length
    const unjudged = used === 0 && missed === 0
    out.push({
      kind: 'SENTENCE_PRODUCTION',
      outcome: unjudged ? 'PARTIAL' : missed === 0 ? 'SUCCESS' : used > 0 ? 'PARTIAL' : 'FAIL',
      refType: 'Lesson',
      refId: lessonId,
      confidence: rec.utteranceId ? (confidence.get(rec.utteranceId) ?? 1) : 1,
      meta: { item: task.id.slice(0, 20), stage: 'speaking', voice: !!rec.utteranceId, ...(unjudged ? { unjudged: true } : {}) },
    })
  }
  return out
}
