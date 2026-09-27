/**
 * 관리자 라우트·서버 컴포넌트 가드(role-permission.md §5, admin-console/02 §5).
 *
 * - 역할은 **매 요청 DB 에서** 읽는다: `infra.auth()` 가 JWT 의 userId 로 `User.role` 을 조회한다(JWT 에 role 이 없다 — 위조·힌트 불신).
 *   capability 결과를 캐시하지 않는다(역할 변경 즉시 반영, 부정 캐시 금지).
 * - 세션 없음 → 401 · `console.access` 없음(USER) → **404**(콘솔 존재 비노출, 힌트 없음) · capability 부족 → 403 `data.details.missing`.
 * - `/api/admin/v1/*` 라우트는 핸들러 첫 줄에서 `requireCapability` 를 부른다(reviewer 체크리스트).
 */
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { ApiError, auth } from '@/modules/infra'
import { currentEnvironment } from '@/modules/engine'
import type { AdminEnvironment, AdminRole, Capability, ConsolePageAccess, ConsoleViewer } from '@/types/admin'
import { menuFor } from '../console/menu'
import { can, capabilitiesOf, type CanContext } from './can'
import { isRole } from './matrix'

export interface AdminActor {
  id: string
  email: string
  name: string | null
  role: AdminRole
  capabilities: Capability[]
  /** 요청을 처리하는 프로세스의 APP_ENV. */
  environment: AdminEnvironment
  /** 감사용(X-Real-IP → X-Forwarded-For 첫 값). 응답에 싣지 않는다. */
  ip: string | null
}

const ENVIRONMENTS: readonly AdminEnvironment[] = ['LOCAL', 'DEVELOPMENT', 'STAGING', 'PRODUCTION']

/** 존재를 숨기는 404 — 사용자 API 의 "타인 리소스 404" 와 같은 문구·같은 모양(details 없음). */
export function hiddenNotFound(): ApiError {
  return new ApiError('NOT_FOUND', '요청한 항목을 찾을 수 없습니다.')
}

function forbidden(missing: Capability[]): ApiError {
  return new ApiError('FORBIDDEN', '이 기능을 쓸 권한이 없습니다.', { missing })
}

async function clientIp(): Promise<string | null> {
  try {
    const h = await headers()
    const ip = h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    return ip ? ip.slice(0, 64) : null
  } catch {
    return null
  }
}

type Session = Awaited<ReturnType<typeof auth>>

async function actorFrom(session: Session): Promise<AdminActor | null> {
  if (!session || !isRole(session.user.role)) return null
  const role = session.user.role
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role,
    capabilities: capabilitiesOf(role),
    environment: currentEnvironment(),
    ip: await clientIp(),
  }
}

/**
 * API 가드. 통과하면 actor, 아니면 `ApiError`(401/404/403)를 던진다 — `withApi` 가 봉투로 바꾼다.
 * `ctx.targetEnvironment` 는 **대상 행의 environment** 를 넘긴다(PRODUCTION 이면 §6 추가 capability).
 */
export async function requireCapability(capability: Capability, ctx: Omit<CanContext, 'environment'> = {}): Promise<AdminActor> {
  const session = await auth()
  if (!session) throw new ApiError('UNAUTHENTICATED', '로그인이 필요합니다.')
  const actor = await actorFrom(session)
  if (!actor || !can(actor.role, 'console.access').allowed) throw hiddenNotFound()
  const r = can(actor.role, capability, { ...ctx, environment: actor.environment })
  if (!r.allowed) throw forbidden(r.missing)
  return actor
}

/** 이미 통과한 actor 로 추가 capability 를 확인(예: #90 `includeSchema` 는 config.raw.read). 부족하면 403. */
export function assertCapability(actor: AdminActor, capability: Capability, ctx: Omit<CanContext, 'environment'> = {}): void {
  const r = can(actor.role, capability, { ...ctx, environment: actor.environment })
  if (!r.allowed) throw forbidden(r.missing)
}

export function hasCapability(actor: AdminActor, capability: Capability): boolean {
  return can(actor.role, capability, { environment: actor.environment }).allowed
}

/**
 * 조회 대상 환경(api-contract §2-19): 기본은 프로세스 APP_ENV. `?environment=` 로 다른 환경 행을 보는 것은
 * SUPER_ADMIN 만(`environment.policy`) — 아니면 403. 잘못된 값은 400.
 */
export function viewEnvironment(actor: AdminActor, raw: string | null): AdminEnvironment {
  if (raw == null || raw === '') return actor.environment
  const v = raw.toUpperCase() as AdminEnvironment
  if (!ENVIRONMENTS.includes(v)) throw new ApiError('VALIDATION', 'environment 값이 올바르지 않습니다.', { field: 'environment' })
  if (v !== actor.environment) assertCapability(actor, 'environment.policy')
  return v
}

/** 서버 컴포넌트용 — 세션·console.access 가 있으면 viewer(메뉴 포함), 없으면 null. 캐시 없음(매 요청 DB 역할). */
export async function getConsoleAccess(): Promise<ConsoleViewer | null> {
  const actor = await actorFrom(await auth())
  if (!actor || !can(actor.role, 'console.access').allowed) return null
  return viewerOf(actor)
}

function viewerOf(actor: AdminActor): ConsoleViewer {
  return { id: actor.id, email: actor.email, name: actor.name, role: actor.role, environment: actor.environment, capabilities: actor.capabilities, menu: menuFor(actor) }
}

/**
 * `(admin)` 페이지·레이아웃 가드 — 렌더 전에 호출한다. 세션 없음 → `/login?callbackUrl=`, console.access 없음 → `notFound()`(404),
 * capability 부족 → `{allowed:false, missing}`(콘솔 안 403 화면, 메뉴 유지). capability 생략 = 콘솔 진입만 확인.
 */
export async function requireConsolePage(capability?: Capability, opts: { path?: string } = {}): Promise<ConsolePageAccess> {
  const session = await auth()
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent(opts.path && opts.path.startsWith('/admin') ? opts.path : '/admin/dashboard')}`)
  const actor = await actorFrom(session)
  if (!actor || !can(actor.role, 'console.access').allowed) notFound()
  const viewer = viewerOf(actor)
  if (!capability) return { viewer, allowed: true, missing: [] }
  const r = can(actor.role, capability, { environment: actor.environment })
  return { viewer, allowed: r.allowed, missing: r.missing }
}

/** 현재 세션 사용자가 capability 를 가졌는가(예: 설정 화면의 "관리자 › AI Engine Console" 행 = `userCan('engine.read')`). 세션 없으면 false. */
export async function userCan(capability: Capability): Promise<boolean> {
  const actor = await actorFrom(await auth())
  return Boolean(actor && can(actor.role, capability, { environment: actor.environment }).allowed)
}
