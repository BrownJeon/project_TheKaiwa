/**
 * 평가 잡 세대 펜싱(task-010 Codex C2-1 과 같은 결함 패턴 — 레슨 `lessons/generate.ts` 와 같은 방식).
 *
 * 출제(EVAL_GEN)는 실패 행을 되살려 같은 평가 행을 다시 쓰고, 채점(EVAL_GRADE)은 GRADING 에 남은 평가를 새 잡으로 다시 채점한다.
 * 나이로 죽었다고 판정된 옛 잡 A 가 실제로는 살아 있다가(배포 전환·시스템 지연) 늦게 끝나면 새 잡 B 의 평가를 덮거나(A 의 결과로 READY/DONE),
 * B 가 돌고 있는 평가에 실패 흔적(FAILED·error)을 남길 수 있다. 그래서 저장·실패 기록은 **사용자 행 잠금(점유와 같은 잠금) 뒤 자기 잡이
 * 아직 이 평가의 현재 세대일 때만**(`jobs.isCurrentJob` — 진행 중이고 같은 평가에 더 새 잡이 없음) 평가를 바꾸고, 아니면 결과를 버린다.
 */
import type { Tx } from '@/modules/infra'
import { jobs, lockUserRow } from '@/modules/infra'

/** 이 잡이 더는 평가의 현재 세대가 아니다(되살린·다시 채점한 새 잡이 있거나 stale 로 닫힘) — 결과를 버린다. */
export class EvaluationJobSuperseded extends Error {
  constructor() {
    super('evaluation job superseded')
    this.name = 'EvaluationJobSuperseded'
  }
}

export interface EvalJobClaim {
  evaluationId: string
  jobId: string
  traceId: string
}

export async function assertCurrentEvalJob(tx: Tx, userId: string, kind: 'EVAL_GEN' | 'EVAL_GRADE', c: EvalJobClaim): Promise<void> {
  await lockUserRow(tx, userId)
  if (!(await jobs.isCurrentJob({ id: c.jobId, userId, kind, refId: c.evaluationId }, tx))) throw new EvaluationJobSuperseded()
}

export function logSuperseded(kind: 'EVAL_GEN' | 'EVAL_GRADE', c: EvalJobClaim, phase: 'save' | 'fail'): void {
  console.warn(`[evaluation] 세대가 바뀌어 ${phase === 'save' ? '결과' : '실패 기록'}를 버림 — ${kind} job=${c.jobId} evaluation=${c.evaluationId}`)
}
