'use client'

/**
 * 로그인 버튼 자리 — 앱에서만 상태가 생긴다(screens §11-2 E·§11-3 F). 웹은 기존 `<a>` 그대로.
 *
 *  idle → (탭) opening "Chrome 창을 여는 중…" → waiting 대기 카드([Chrome 창 다시 열기] = 같은 주소·같은 verifier)
 *       → 딥링크 수신 exchanging 덮개 "로그인 마무리 중…"(문서 이동까지 유지)
 *  waiting 중 Custom Tab 이 닫히고 1.5초 안에 딥링크가 없으면 closed "로그인 창이 닫혔어요. 다시 눌러 주세요."
 * 대기에는 시간 제한이 없다(계정 선택·2단계 인증). 콜드 스타트(앱이 꺼진 채 딥링크로 깨어남)는 대기 없이 바로 exchanging.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNativeEnv } from '@/components/common/useNativeEnv'
import { buildGoogleAuthHref } from '@/modules/infra/auth/oauth/next-path'
import { onBrowserFinished, openAppLogin, prepareAppLogin } from '@/modules/infra/native'
import AppDeepLink from './AppDeepLink.client'
import GoogleLoginButton from './GoogleLoginButton.client'

type Phase = 'idle' | 'opening' | 'waiting' | 'exchanging'

export const APP_LOGIN_COPY = {
  waitingTitle: 'Chrome 창에서 로그인하고 있어요',
  waitingBody: '로그인이 끝나면 이 화면으로 자동으로 돌아와요.',
  reopen: 'Chrome 창 다시 열기',
  exchanging: '로그인 마무리 중…',
  closed: '로그인 창이 닫혔어요. 다시 눌러 주세요.',
} as const

const CLOSED_GRACE_MS = 1500

export default function AppLoginArea({ callbackUrl }: { callbackUrl: string | null }) {
  const { native } = useNativeEnv()
  const [phase, setPhase] = useState<Phase>('idle')
  const [closed, setClosed] = useState(false)
  const hrefRef = useRef<string | null>(null)
  const phaseRef = useRef<Phase>('idle')
  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  const open = useCallback(async (href: string) => {
    setPhase('opening')
    if (await openAppLogin(href)) {
      setPhase('waiting')
      return
    }
    // Browser 플러그인이 없는 셸 — 일반 이동으로 폴백한다(지금까지의 동작).
    setPhase('idle')
    window.location.href = buildGoogleAuthHref(callbackUrl, 'web')
  }, [callbackUrl])

  const start = useCallback(async () => {
    setClosed(false)
    setPhase('opening')
    const href = await prepareAppLogin(callbackUrl)
    if (!href) {
      setPhase('idle')
      window.location.href = buildGoogleAuthHref(callbackUrl, 'web')
      return
    }
    hrefRef.current = href
    await open(href)
  }, [callbackUrl, open])

  // Custom Tab 이 닫혔는데(사용자가 그냥 닫음) 딥링크가 오지 않으면 대기를 푼다. closeExternal() 로 닫힌 경우는 이미 exchanging.
  useEffect(() => {
    if (!native) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const off = onBrowserFinished(() => {
      if (phaseRef.current !== 'waiting') return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        if (phaseRef.current !== 'waiting') return
        setPhase('idle')
        setClosed(true)
      }, CLOSED_GRACE_MS)
    })
    return () => {
      off()
      if (timer) clearTimeout(timer)
    }
  }, [native])

  return (
    <>
      <AppDeepLink callbackUrl={callbackUrl} onExchanging={() => setPhase('exchanging')} />
      {closed && phase === 'idle' ? (
        <p role="status" className="text-[13px] text-ink2">
          {APP_LOGIN_COPY.closed}
        </p>
      ) : null}
      {phase === 'waiting' && native ? (
        <div role="status" data-app-login="waiting" className="rounded-[14px] border border-line bg-surface p-3.5">
          <div className="flex min-w-0 items-center gap-2">
            <span aria-hidden className="h-4 w-4 flex-none animate-spin rounded-full border-2 border-line border-t-accent motion-reduce:animate-none" />
            <p className="min-w-0 text-[15px] font-semibold text-ink">{APP_LOGIN_COPY.waitingTitle}</p>
          </div>
          <p className="mt-1 break-keep text-[13px] text-ink2">{APP_LOGIN_COPY.waitingBody}</p>
          <button
            type="button"
            onClick={() => hrefRef.current && void open(hrefRef.current)}
            className="mt-3 flex h-12 w-full items-center justify-center rounded-xl border border-line bg-surface text-[15px] font-semibold"
          >
            {APP_LOGIN_COPY.reopen}
          </button>
        </div>
      ) : (
        <GoogleLoginButton callbackUrl={callbackUrl} native={native} opening={phase === 'opening'} onAppLogin={() => void start()} />
      )}
      {phase === 'exchanging' ? (
        <div role="status" data-app-login="exchanging" className="fixed inset-0 z-50 grid place-items-center bg-ground">
          <div className="flex items-center gap-2.5 text-[15px] text-ink">
            <span aria-hidden className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent motion-reduce:animate-none" />
            {APP_LOGIN_COPY.exchanging}
          </div>
        </div>
      ) : null}
    </>
  )
}

/** 하단 안내 둘째 줄 — 앱에서만(웹에서는 뜻 없는 말). */
export function AppOnlyLoginNote() {
  const { native } = useNativeEnv()
  if (!native) return null
  return (
    <>
      <br />
      앱에서는 Chrome 창에서 로그인한 뒤 자동으로 돌아와요.
    </>
  )
}
