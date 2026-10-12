/**
 * #29 ASK 답의 `ask` 객체(api-contract §2-18-A 4항) — 저장된 `ChatMessage.toolLog.ask` 를 orchestrator 의 `askMetaFromToolLog`
 * (S2a — 직전 되묻기 판정과 같은 모양 검사 한 곳)로 읽어 **허용 필드만**(`sources`·`confidence`·`needsScope`·`records`) 내보낸다.
 * `toolLog` 의 나머지(측정 숫자·traceId·모델)는 계속 숨긴다(#29 "toolLog 는 사용자 응답에 싣지 않는다").
 * 그 밖 종류(TALK·CHAT)와 USER 메시지에는 `ask` 키 자체가 없다.
 */
import type { ChatKind, Prisma } from '@prisma/client'
import { askMetaFromToolLog, type AskMetaDto } from '../orchestrator/ask'

/** #29 메시지에 더할 칸 — ASK 의 ASSISTANT 만 `{ask}`(끝난 답만 값, 진행 중·실패는 null), 나머지는 `{}`. */
export function messageAskField(kind: ChatKind, role: 'USER' | 'ASSISTANT', status: 'PENDING' | 'DONE' | 'FAILED', toolLog: Prisma.JsonValue | null | undefined): { ask?: AskMetaDto | null } {
  if (kind !== 'ASK' || role !== 'ASSISTANT') return {}
  return { ask: status === 'DONE' ? askMetaFromToolLog(toolLog) : null }
}
