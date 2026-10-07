'use client'

import { useState } from 'react'
import { writeStore } from '@/components/common/storage'
import { TOPIC_DRAFT_STORE_KEY } from '@/components/topic/logic'

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
          // 이 탭에 남은 「고치던 주제 초안」을 지운다(`writeStore` 가 접근 오류를 삼킨다) — 같은 탭에서 다른 계정으로 로그인해도 남의 초안이 보이지 않게(REV-162 M-1).
          writeStore('session', TOPIC_DRAFT_STORE_KEY, null)
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
