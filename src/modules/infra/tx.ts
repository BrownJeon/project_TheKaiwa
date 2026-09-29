/**
 * 트랜잭션 헬퍼 — 여러 층의 쓰기를 한 트랜잭션으로 묶을 때 라우트가 쓴다(module-dependency L6 `withTransaction`).
 * 라우트는 Prisma 를 직접 import 하지 않고 이 함수로 tx 를 열어 각 모듈의 `(…, tx)` 함수에 넘긴다.
 *
 * - 격리 수준은 READ COMMITTED: 잠금(`FOR UPDATE`) 뒤의 일반 SELECT 가 **잠금을 기다리는 동안 커밋된 행**을 보게 한다
 *   (REPEATABLE READ 의 스냅샷은 첫 일반 SELECT 시점에 고정돼, 잠금 순서가 조금만 어긋나도 옛 행을 본다).
 * - 교착·쓰기 충돌(Prisma P2034)은 트랜잭션 전체를 다시 돈다 — 콜백 안의 쓰기는 전부 롤백되므로 재실행이 안전하다.
 *   `$queryRaw`(`SELECT … FOR UPDATE`) 안에서 난 교착은 Prisma 가 P2034 가 아니라 P2010(meta.code 1213)으로 올리므로 같이 재시도한다
 *   (task-012c 실측 — 잠금 순서를 어긴 쓰기와 만나면 여기서 난다).
 */
import { Prisma } from '@prisma/client'
import { prisma } from './db'

export type Tx = Prisma.TransactionClient

export interface TxOptions {
  /** 교착(P2034) 재시도 횟수. 기본 2. */
  retries?: number
  /** 트랜잭션 전체 상한(ms). 기본 15초. */
  timeoutMs?: number
}

export function isRetryableTxError(e: unknown): boolean {
  const err = e as { code?: string; meta?: { code?: unknown } } | null
  if (err?.code === 'P2034') return true
  return err?.code === 'P2010' && String(err.meta?.code ?? '') === '1213'
}

export async function withTransaction<T>(fn: (tx: Tx) => Promise<T>, opts: TxOptions = {}): Promise<T> {
  const retries = opts.retries ?? 2
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5_000,
        timeout: opts.timeoutMs ?? 15_000,
      })
    } catch (e) {
      if (attempt < retries && isRetryableTxError(e)) continue
      throw e
    }
  }
}

/**
 * 사용자 행 잠금(`SELECT … FOR UPDATE`) — **사용자 단위 직렬화 지점**이다. 사용자당 턴 1(여러 채팅·blue/green 두 프로세스)과
 * 단어장 같은 표현 중복 검사처럼 "행이 아직 없어서 잠글 대상이 없는" 검사를 프로세스 사이에서도 원자적으로 만든다.
 * User 는 infra 소유 테이블이라 잠금도 여기서만 건다. 행이 없으면 false.
 */
export async function lockUserRow(tx: Tx, userId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM \`User\` WHERE id = ${userId} FOR UPDATE`
  return rows.length > 0
}
