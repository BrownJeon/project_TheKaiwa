/**
 * QA 전용 테스트 계정 세션 — 서버 **127.0.0.1:3010** 에서 인증 API 를 검증할 때만 쓴다(운영 도메인·실사용자 계정 아님).
 * 계정: `qa-bot@thekaiwa.test`(provider `test`, role USER, 비밀번호 없음 — Google 로그인으로는 닿지 않는다).
 * 쿠키 헤더를 권한 600 파일에 쓰고 화면에는 출력하지 않는다. 실행: `node --env-file=.env --import tsx tests/live/qa-session.ts <out>`
 */
import { chmodSync, writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { SESSION_COOKIE_NAME } from '../../src/modules/infra/jwt'
import { signJwt } from '../../src/modules/infra/session'

const prisma = new PrismaClient()
async function main() {
  const out = process.argv[2] ?? '/tmp/kaiwa-qa-cookie'
  const user = await prisma.user.upsert({
    where: { email: 'qa-bot@thekaiwa.test' },
    update: {},
    create: { email: 'qa-bot@thekaiwa.test', name: 'QA', provider: 'test', oauthId: 'qa-bot', role: 'USER' },
  })
  writeFileSync(out, `${SESSION_COOKIE_NAME}=${signJwt({ userId: user.id, email: user.email })}`)
  chmodSync(out, 0o600)
  console.log(`[qa-session] user=${user.id} cookie → ${out}`)
}
main().finally(() => prisma.$disconnect())
