import { PrismaClient } from '@prisma/client'

declare global {
  // `declare global` 안에서는 `var`만 전역에 붙는다 — `let`/`const`로 쓰면 모듈 스코프에
  // 남아 개발 중 HMR 재실행마다 새 PrismaClient가 생성된다(커넥션 누수,
  // VoiceVault·TheThinker에서 동일하게 확인된 패턴).
  var __prisma: PrismaClient | undefined
}

export const prisma =
  globalThis.__prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['error'] : [] })

if (process.env.NODE_ENV !== 'production') globalThis.__prisma = prisma
