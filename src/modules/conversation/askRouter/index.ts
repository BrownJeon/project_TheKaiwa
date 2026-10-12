/**
 * L2 `conversation/askRouter` — ASK(무엇이든 물어보세요) 3a 의 의도 분류(규칙만)와 기록 조회 묶음(api-contract §2-18-A 3·5·6항).
 *
 * orchestrator(ASK 턴)가 쓰는 순서: `c = classifyIntent(질문, {prevUserText, scopeKey})` → (`c.needsScope` 면 조회 없이 되묻기)
 * → `retrieveAskRecords(세션 userId, c, classifiedQuestion(c, 질문, prevUserText))` → 결과 `items`(외부 전송 DTO)만 프롬프트로,
 * 모델의 `sourceKeys` 는 learning `resolveSourceKeys(결과, keys)` 로만 `sources[]` 로 푼다.
 * 칩 답·기간만 쓴 짧은 답이면 `c.basedOnPrev` — 「분류에 쓴 질문」은 직전 USER 질문이다(검색어도 그 질문에서 뽑는다).
 */
import { retrieveRecords, type AskIntent, type AskScope, type RetrievalDb, type RetrievalResult } from '@/modules/learning'
import type { Tx } from '@/modules/infra'
import { extractSearchTerms } from './classify'
import { askCorrectionReader, askRolePlayReader, createAskCorrectionReader, createAskRolePlayReader } from './readers'

export { classifyIntent, classifiedQuestion, extractSearchTerms } from './classify'
export type { AskClassification, ClassifyContext } from './classify'
export { askCorrectionReader, askRolePlayReader, createAskCorrectionReader, createAskRolePlayReader } from './readers'

export interface RetrieveAskRecordsOptions {
  /** 시험용 — 조회 표 + 교정·대화 표를 가진 가짜 DB. 주면 두 읽기 함수도 이 DB 로 만든다. */
  db?: RetrievalDb & Pick<Tx, 'correction' | 'chat'>
  now?: () => Date
}

/** 본인 기록 조회 — 채택 교정·역할극 방 읽기(L2)와 질문에서 뽑은 검색어를 채워 learning `retrieveRecords` 를 부른다. `userId` 는 세션에서만. */
export function retrieveAskRecords(userId: string, classification: { intent: AskIntent; scope: AskScope | null }, questionText: string, opts: RetrieveAskRecordsOptions = {}): Promise<RetrievalResult> {
  return retrieveRecords(userId, classification.intent, classification.scope, {
    terms: classification.intent === 'GENERAL' ? [] : extractSearchTerms(questionText),
    corrections: opts.db ? createAskCorrectionReader(opts.db) : askCorrectionReader,
    rolePlays: opts.db ? createAskRolePlayReader(opts.db) : askRolePlayReader,
    db: opts.db,
    now: opts.now,
  })
}
