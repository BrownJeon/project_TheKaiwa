/**
 * RequestTrace 최소판(task-006 범위결정 7, domain-model 규칙 7) — traceId 발급과 1행 기록만. 콘솔 조회·단계별 스트리밍 기록은 task-005b.
 *
 * 기록하는 것: 단계명·지연(ms)·connection 키·모델·시도 수·프롬프트 길이·상태·오류 코드. **원문·응답 전문·대화 텍스트는 넣지 않는다.**
 * 기록 실패가 사용자 요청을 실패시키지 않게 예외를 삼킨다(로그만).
 */
import { randomBytes } from 'node:crypto'
import type { Prisma, TraceKind, TraceStatus } from '@prisma/client'
import { prisma } from '@/modules/infra'
import { currentEnvironment } from '../router'

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

/** `t_` + base62 20자 = 22자(api-contract §0-5). 사용자 식별 정보를 담지 않는 순수 난수. */
export function newTraceId(): string {
  // 256 을 62 로 나눈 나머지 편향을 없애려고 248(=62×4) 이상은 버린다.
  let out = ''
  while (out.length < 20) {
    for (const b of randomBytes(32)) {
      if (b >= 248) continue
      out += BASE62[b % 62]
      if (out.length === 20) break
    }
  }
  return `t_${out}`
}

export interface TraceStep {
  name: string
  ms: number
  /** 선택 메타 — 숫자·짧은 식별자만(원문 금지). */
  [key: string]: string | number | boolean | null | undefined
}

export interface TraceRecord {
  traceId: string
  kind: TraceKind
  userId?: string | null
  status: TraceStatus
  steps: TraceStep[]
  totalMs?: number | null
  errorCode?: string | null
  refType?: string | null
  refId?: string | null
}

export async function recordTrace(t: TraceRecord): Promise<void> {
  try {
    await prisma.requestTrace.create({
      data: {
        traceId: t.traceId,
        environment: currentEnvironment(),
        userId: t.userId ?? null,
        kind: t.kind,
        status: t.status,
        steps: t.steps as unknown as Prisma.InputJsonValue,
        totalMs: t.totalMs ?? null,
        errorCode: t.errorCode ? t.errorCode.slice(0, 40) : null,
        refType: t.refType ? t.refType.slice(0, 30) : null,
        refId: t.refId ? t.refId.slice(0, 40) : null,
      },
    })
  } catch (e) {
    console.warn('[trace] 기록 실패:', e instanceof Error ? e.message : String(e))
  }
}
