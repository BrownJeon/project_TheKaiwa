'use client'

import { useState } from 'react'

/** POST /api/auth/logout(멱등) 후 로그인 화면으로. GET 로그아웃은 CSRF 표면이라 두지 않는다. */
export default function LogoutButton() {
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          await fetch('/api/auth/logout', { method: 'POST' })
        } finally {
          // 전체 새로고침으로 이동한다 — 클라이언트 라우터 캐시에 남은 로그인 상태 화면을 버리기 위해서다.
          window.location.replace('/login')
        }
      }}
      className="mt-3 min-h-[44px] w-full rounded-xl border border-line text-[15px] font-semibold text-ink2 disabled:opacity-60"
    >
      {busy ? '로그아웃 중…' : '로그아웃'}
    </button>
  )
}
