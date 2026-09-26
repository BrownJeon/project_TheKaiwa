/**
 * QA 전용 테스트 계정 세션 — 서버 **127.0.0.1:3010** 에서 인증 API 를 검증할 때만 쓴다(운영 도메인·실사용자 계정 아님).
 * 토큰은 `qa:true`·1시간 짜리이며 nginx 를 거친 요청에서는 서버가 거부한다. 쓴 뒤에는 쿠키 파일을 지운다.
 * 계정: `qa-bot@thekaiwa.test`(provider `test`, role USER, 비밀번호 없음 — Google 로그인으로는 닿지 않는다).
 * 쿠키 헤더를 권한 600 파일에 쓰고 화면에는 출력하지 않는다. 실행: `node --env-file=.env --import tsx tests/live/qa-session.ts <out>`
 */
import { chmodSync, writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import { SESSION_COOKIE_NAME } from '../../src/modules/infra/jwt'

const prisma = new PrismaClient()
async function main() {
  if ((process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 환경에서는 QA 세션을 만들지 않는다')
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET 없음 — node --env-file=.env 로 실행')
  const out = process.argv[2] ?? '/tmp/kaiwa-qa-cookie'
  const user = await prisma.user.upsert({
    where: { email: 'qa-bot@thekaiwa.test' },
    update: {},
    create: { email: 'qa-bot@thekaiwa.test', name: 'QA', provider: 'test', oauthId: 'qa-bot', role: 'USER' },
  })
  // qa:true + 1시간 — 서버는 localhost 직접 요청에서만 이 토큰을 세션으로 인정한다(infra/jwt isQaTokenAllowed).
  const token = jwt.sign({ userId: user.id, email: user.email, qa: true }, secret, { expiresIn: '1h' })
  writeFileSync(out, `${SESSION_COOKIE_NAME}=${token}`)
  chmodSync(out, 0o600)
  console.log(`[qa-session] user=${user.id} cookie → ${out}`)
}
main().finally(() => prisma.$disconnect())
