/**
 * 교정 응답 객체(api-contract #29 의 교정 + #34 의 `savedWordId`·`chat`). 모듈 안 여러 곳이 같은 모양을 쓴다.
 * `extraNoteKo`(task-039): 추가 설명(저장 전 정리를 거친 값). 옛 행·추가 설명이 없는 교정은 null — 화면은 줄을 그리지 않는다.
 */
import type { Prisma } from '@prisma/client'

export const CORRECTION_SELECT = {
  id: true, messageId: true, chatId: true, status: true, original: true, corrected: true, explanation: true, extraNoteKo: true, errorType: true,
  severity: true, chunkType: true, savedWordId: true, createdAt: true, resolvedAt: true,
} as const

export type CorrectionRow = Prisma.CorrectionGetPayload<{ select: typeof CORRECTION_SELECT }>

export function serializeCorrection(c: CorrectionRow, chat?: { id: string; title: string; kind: string } | null) {
  return {
    id: c.id,
    messageId: c.messageId,
    status: c.status,
    original: c.original,
    corrected: c.corrected,
    explanation: c.explanation,
    extraNoteKo: c.extraNoteKo ?? null,
    errorType: c.errorType,
    severity: c.severity,
    chunkType: c.chunkType,
    savedWordId: c.savedWordId,
    createdAt: c.createdAt.toISOString(),
    resolvedAt: c.resolvedAt ? c.resolvedAt.toISOString() : null,
    ...(chat !== undefined ? { chat } : {}),
  }
}

export type CorrectionDto = ReturnType<typeof serializeCorrection>
