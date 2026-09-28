/**
 * A11 복습 판단(REVIEW_DECISION) 후검증 — **재시도를 일으키는** 위반만 여기 둔다(스키마로 못 거르는 규칙 중
 * "모델이 반드시 다시 써야 하는" 것). 3~7 클램프·FOCUS 상한·id 폐기·누락 폴백처럼 코드가 항상 결정적으로 고칠 수
 * 있는 것은 재시도 없이 `reviewRepair.ts` 의 `normalizeReviewDecision` 이 맡는다(같은 파일에 두지 않는 이유는
 * "재시도용 검사"와 "결정적 보정"의 책임을 코드로도 분리해 두기 위해서 — lesson.ts 가 `checkLessonResponse`(재시도)와
 * `repairLessonResponse`(보정)를 나눈 것과 같은 이유).
 */
import { llm } from '@/modules/engine'
import type { ReviewDecisionResponse } from './reviewSchemas'

export function checkReviewDecisionResponse(data: ReviewDecisionResponse): string[] {
  const v: string[] = []
  const texts = [
    data.rationale_ko,
    data.sessionPlan.mixNote_ko,
    ...data.decisions.map((d) => d.reason_ko),
  ]
  if (texts.some((t) => llm.mentionsEngineIdentity(t))) v.push('응답 어딘가에 엔진·모델 이름이 노출됐다')
  return v
}
