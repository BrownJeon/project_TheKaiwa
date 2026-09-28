'use client'

/**
 * 초대코드 입력 폼. 제출은 `POST /api/auth/complete` 한 곳뿐이고, 그 라우트가 통과시켜야만
 * 계정이 만들어진다 — 이 화면은 표시·입력만 담당한다.
 *
 * 앱(Custom Tabs) 가입이면 서버가 세션 쿠키 대신 `appRedirect`(60초·1회용 딥링크)를 준다.
 * 이 탭은 앱 WebView가 아니므로 쿠키를 받아도 앱은 로그아웃 상태다 — 딥링크로 앱에
 * 제어를 넘겨야 한다(설계안 §5-2).
 */
import { useEffect, useRef, useState } from 'react'
import { DEFAULT_NEXT_PATH } from '@/modules/infra/auth/oauth/next-path'
import InviteReturn from './InviteReturn.client'

interface CompleteResponse {
  success?: boolean
  message?: string | null
  data?: { next?: string; appRedirect?: string | null } | null
}

export default function InviteForm({ inviteRequired }: { inviteRequired: boolean }) {
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [appRedirect, setAppRedirect] = useState<string | null>(null)
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inviteRequired) codeRef.current?.focus()
  }, [inviteRequired])

  const canSubmit = (!inviteRequired || inviteCode.trim().length > 0) && !busy

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: inviteRequired ? inviteCode : undefined }),
      })
      const body = (await res.json().catch(() => ({}))) as CompleteResponse
      if (!res.ok || body.success !== true) {
        setError(body.message ?? `가입하지 못했습니다 (HTTP ${res.status})`)
        setBusy(false)
        return
      }

      const redirect = body.data?.appRedirect
      if (typeof redirect === 'string' && redirect.length > 0) {
        // 앱(Custom Tab) 가입 — 딥링크로 앱에 넘기고, 앱이 안 열리면 누를 수 있게 같은 주소 버튼으로 바꾼다(§11-2 E).
        setAppRedirect(redirect)
        window.location.href = redirect
        return
      }
      // `next`는 서명된 대기 토큰에서 나오며 서버가 `sanitizeNextPath`를 이미 통과시켰다.
      const next = body.data?.next
      window.location.replace(typeof next === 'string' && next.startsWith('/') ? next : DEFAULT_NEXT_PATH)
    } catch {
      setError('네트워크 오류 — 다시 시도하세요')
      setBusy(false)
    }
  }

  if (appRedirect) return <InviteReturn appRedirect={appRedirect} />

  return (
    <form onSubmit={onSubmit} className="flex min-w-0 flex-col gap-3">
      {inviteRequired && (
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="invite" className="text-[13px] font-medium text-ink2">
            초대코드
          </label>
          <input
            id="invite"
            ref={codeRef}
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="초대코드를 입력하세요"
            aria-invalid={error ? true : undefined}
            aria-describedby="invite-error"
            className="min-h-[48px] w-full min-w-0 rounded-[10px] border border-line bg-surface px-3 font-mono text-[15px] tracking-wider text-ink outline-none focus:border-accent"
          />
        </div>
      )}

      <div id="invite-error" role="alert" className="min-h-[18px] text-[13px] text-bad">
        {error ?? ''}
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="min-h-[48px] rounded-[12px] bg-accent px-4 text-[15px] font-semibold text-on-accent disabled:opacity-50"
      >
        {busy ? '가입 처리 중…' : '가입 완료'}
      </button>
    </form>
  )
}
