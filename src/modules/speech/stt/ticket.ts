/**
 * #20 WS 티켓(api-contract §0-3·#20) — `{sub:userId, chatId?, purpose:TURN|MIC_TEST, aud:"ws-speech", jti, iat, exp:+60s}`, HS256·`JWT_SECRET`.
 * 1회 사용 판정(jti 소각)은 gateway 몫이다. 티켓에는 세션 클레임(userId·email)이 없어 쿠키로 쓰일 수 없다(infra/scopedToken).
 * gateway 경로를 쓸 수 없으면 발급하지 않는다(422) — 화면이 WS 연결 실패 대신 "서버 준비 중" 을 바로 보여 준다.
 */
import { ApiError, signScopedToken } from '@/modules/infra'
import { stt } from '@/modules/engine'
import { assessGateway, type GatewayUnavailableReason } from './gateway'

export const WS_TICKET_AUDIENCE = 'ws-speech'
export const WS_TICKET_TTL_SEC = 60
export const STT_SAMPLE_RATE = 16_000
export const STT_FRAME_MS = 40
/** M1(Leader 2026-09-28): MIC_TEST 티켓이면 gateway 가 wav 저장·internal 콜백을 건너뛴다(점검 발화는 남기지 않음). 기본 TURN. */
export const TICKET_PURPOSES = ['TURN', 'MIC_TEST'] as const
export type TicketPurpose = (typeof TICKET_PURPOSES)[number]

export interface TicketRequest {
  chatId: string | null
  purpose: TicketPurpose
}

export interface SpeechTicket {
  ticket: string
  expiresAt: string
  wsPath: string
  sampleRate: number
  frameMs: number
  /** 개발 서버에서만 — gateway 에 직접 붙는 loopback 주소. 운영 응답에는 키 자체가 없다. */
  wsUrl?: string
}

export class SttUnavailableError extends Error {
  readonly userMessage = '음성 인식 서버가 준비 중이에요. 잠시 후 다시 시도해 주세요.'
  constructor(readonly reason: GatewayUnavailableReason) {
    super(`실시간 인식 서버 경로를 쓸 수 없습니다(${reason})`)
    this.name = 'SttUnavailableError'
  }
}

const ID = /^[A-Za-z0-9_-]{1,40}$/

export function parseTicketRequest(body: Record<string, unknown>): TicketRequest {
  const { chatId, purpose } = body
  if (chatId !== undefined && chatId !== null && (typeof chatId !== 'string' || !ID.test(chatId))) {
    throw new ApiError('VALIDATION', '대화 id 형식이 올바르지 않아요.', { field: 'chatId' })
  }
  if (purpose !== undefined && purpose !== null && !(TICKET_PURPOSES as readonly unknown[]).includes(purpose)) {
    throw new ApiError('VALIDATION', '지원하지 않는 용도예요.', { field: 'purpose' })
  }
  return { chatId: (chatId as string | null | undefined) ?? null, purpose: (purpose as TicketPurpose | null | undefined) ?? 'TURN' }
}

/** 호출 전에 라우트가 chatId 소유를 확인한다(conversation 소유 테이블 — speech 는 모른다). */
export async function issueSpeechTicket(userId: string, req: TicketRequest): Promise<SpeechTicket> {
  const a = await assessGateway({ allowProbe: true, probeBudgetMs: 2_500 })
  if (!a.available || !a.target) throw new SttUnavailableError(a.reason ?? 'UNAVAILABLE')
  const runtime = await stt.publicRuntime(a.target)
  const claims: Record<string, string> = { purpose: req.purpose }
  if (req.chatId) claims.chatId = req.chatId
  const t = await signScopedToken({ sub: userId, aud: WS_TICKET_AUDIENCE, ttlSec: WS_TICKET_TTL_SEC, claims })
  const out: SpeechTicket = { ticket: t.token, expiresAt: t.expiresAt.toISOString(), wsPath: runtime.wsPath, sampleRate: STT_SAMPLE_RATE, frameMs: STT_FRAME_MS }
  const dev = await stt.devWsUrl(a.target)
  if (dev) out.wsUrl = dev
  return out
}
