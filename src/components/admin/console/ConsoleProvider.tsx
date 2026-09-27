'use client'

/**
 * 콘솔 클라이언트 컨텍스트(screens.md §6-3). layout(서버)이 매 요청 DB 역할로 채운 값을 내려 준다.
 * `useCan` 은 **숨김용**이다 — 서버가 매 요청 다시 검사한다. capability 를 브라우저 저장소에 두지 않는다.
 */
import { createContext, useCallback, useContext, useMemo } from 'react'
import Toast, { useToast } from '@/components/common/Toast'
import type { AdminEnvironment, AdminMenuItem, AdminRole, Capability } from '@/types/admin'

/** 서버 → 클라이언트로 넘기는 최소 정보(이메일·IP·사용자 id 는 싣지 않는다). */
export interface ClientConsoleAccess {
  role: AdminRole
  capabilities: Capability[]
  environment: AdminEnvironment
  appVersion: string | null
  menu: AdminMenuItem[]
}

interface ConsoleCtx {
  access: ClientConsoleAccess
  toast: (msg: string) => void
}

const Ctx = createContext<ConsoleCtx | null>(null)

export function ConsoleProvider({ access, children }: { access: ClientConsoleAccess; children: React.ReactNode }) {
  const { message, show } = useToast()
  const value = useMemo(() => ({ access, toast: show }), [access, show])
  return (
    <Ctx.Provider value={value}>
      {children}
      <Toast message={message} />
    </Ctx.Provider>
  )
}

function useConsoleCtx(): ConsoleCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('ConsoleProvider 밖에서 콘솔 컴포넌트를 썼습니다')
  return v
}

/** `can('health.run')` — 권한 없는 버튼은 렌더하지 않는다(비활성으로 남기지 않는다). */
export function useCan(): (cap: Capability) => boolean {
  const { access } = useConsoleCtx()
  const set = useMemo(() => new Set(access.capabilities), [access.capabilities])
  return useCallback((cap: Capability) => set.has(cap), [set])
}

export function useConsoleAccess(): ClientConsoleAccess {
  return useConsoleCtx().access
}

export function useConsoleEnv(): AdminEnvironment {
  return useConsoleCtx().access.environment
}

export function useConsoleToast(): (msg: string) => void {
  return useConsoleCtx().toast
}
