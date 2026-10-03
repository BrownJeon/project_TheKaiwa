/**
 * 교정 사건의 learning 쪽 기록(task-010b L3·L8) — Correction 은 L2 소유라 learning 은 값만 받는다(라우트·훅이 같은 트랜잭션으로 조합,
 * module-dependency §4·행렬 판독 규칙 2). 모두 **호출자 tx 안에서, 사용자 행 잠금 뒤**.
 *
 *  - 제안 생성(턴 저장·A3 점검) → `CORRECTION_PROPOSED`(MAJOR = FAIL · MINOR = PARTIAL — 학습자 문장에 오류가 있었다는 관측).
 *  - 채택 → `CORRECTION_ACCEPTED`(SUCCESS) + 반복 항목 `EXPRESSION`(refType `Correction`, refId = sha1(교정문), textJa = 교정문,
 *    meaningKo = 설명 첫 문장 앞부분, 피드백 +1 — 같은 표현을 다시 채택하면 같은 항목이 피드백 +1 → 3회면 FOCUS). 채택은 "공부"가 아니라
 *    `studiedCount`·`lastStudiedAt` 은 그대로(새 항목은 0·null — 화면 "처음 복습해요").
 *  - 거절 → `CORRECTION_IGNORED`(SKIPPED).
 *  축은 오류 유형으로 정한다(`correctionSkill`). 신뢰도는 입력 경로만 안다(턴 경로엔 STT 신뢰도가 없다 — 1.0, `meta.input`).
 */
import type { ErrorType, Severity } from '@prisma/client'
import type { Tx } from '@/modules/infra'
import { correctionMeaningSnap, registerRepetitionItems, repetitionRefId, type RegisteredItem } from '../repetition'
import { correctionSkill, recordObservations, type ObservationInput } from './index'

export interface CorrectionEventInput {
  id: string
  errorType: ErrorType | string
  severity: Severity | string
  /** 교정이 달린 사용자 메시지의 입력 경로(턴 경로만). */
  inputSource?: 'TEXT' | 'REALTIME_STT' | 'SERVER_STT' | string | null
}

function meta(c: CorrectionEventInput): Record<string, string | null> {
  const input = c.inputSource == null ? null : c.inputSource === 'TEXT' ? 'TEXT' : 'VOICE'
  return { errorType: String(c.errorType).slice(0, 20), severity: String(c.severity).slice(0, 10), ...(c.inputSource !== undefined ? { input } : {}) }
}

export function correctionProposedObservation(c: CorrectionEventInput): ObservationInput {
  return {
    kind: 'CORRECTION_PROPOSED',
    outcome: c.severity === 'MAJOR' ? 'FAIL' : 'PARTIAL',
    skill: correctionSkill(c.errorType),
    refType: 'Correction',
    refId: c.id,
    confidence: 1,
    meta: meta(c),
  }
}

/** 교정 제안 생성 관측 — 턴 저장(TurnHooks)·A3 점검 저장 트랜잭션 안에서. 반환 = 쓴 관측 수. */
export async function recordCorrectionsProposed(userId: string, rows: readonly CorrectionEventInput[], tx: Tx): Promise<number> {
  return recordObservations(userId, rows.map(correctionProposedObservation), tx)
}

export interface AcceptedCorrectionInput extends CorrectionEventInput {
  corrected: string
  explanation: string | null
}

/**
 * 교정 채택(#35) — 반복 항목(EXPRESSION, 피드백 +1) + `CORRECTION_ACCEPTED` 관측. 반환 = 등록·갱신한 항목.
 * 교정문이 비어 있으면(그럴 일은 없지만) 항목은 만들지 않고 관측만 남긴다.
 */
export async function registerAcceptedCorrection(userId: string, c: AcceptedCorrectionInput, tx: Tx, opts: { today?: string; now?: Date } = {}): Promise<RegisteredItem | null> {
  const text = c.corrected.trim()
  const [item] = text
    ? await registerRepetitionItems(
        userId,
        [{ itemType: 'EXPRESSION', refType: 'Correction', refId: repetitionRefId(text), textJa: text, meaningKo: correctionMeaningSnap(c.explanation), feedback: 1, studied: false }],
        tx,
        opts,
      )
    : [null]
  await recordObservations(userId, [{ kind: 'CORRECTION_ACCEPTED', outcome: 'SUCCESS', skill: correctionSkill(c.errorType), refType: 'Correction', refId: c.id, confidence: 1, meta: meta(c) }], tx)
  return item ?? null
}

/** 교정 거절(#36) — `CORRECTION_IGNORED` 관측만. */
export async function recordCorrectionIgnored(userId: string, c: CorrectionEventInput, tx: Tx): Promise<void> {
  await recordObservations(userId, [{ kind: 'CORRECTION_IGNORED', outcome: 'SKIPPED', skill: correctionSkill(c.errorType), refType: 'Correction', refId: c.id, confidence: 1, meta: meta(c) }], tx)
}
