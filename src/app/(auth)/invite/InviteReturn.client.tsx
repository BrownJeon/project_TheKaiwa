'use client'

/**
 * 초대코드 가입 뒤 "앱으로 돌아가기"(screens §11-2 E) — 이 페이지는 앱이 아니라 **Chrome 창(Custom Tab)** 에 뜬다.
 * 가입 응답의 1회용 딥링크(60초)로 이미 넘겼지만, 앱이 열리지 않았을 때를 위해 같은 주소 버튼을 둔다. 0.3초 뒤에 보인다(이미 앱으로 넘어갔으면 보이지 않는다).
 */
import { useEffect, useState } from 'react'

export default function InviteReturn({ appRedirect }: { appRedirect: string }) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 300)
    return () => clearTimeout(t)
  }, [])
  if (!shown) return null
  return (
    <div role="status" data-invite-return className="flex min-w-0 flex-col gap-2">
      <p className="flex items-center gap-2 text-[15px] text-ink">
        <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent motion-reduce:animate-none" />
        앱으로 돌아가는 중…
      </p>
      <p className="break-keep text-[13px] text-ink2">앱이 열리지 않으면 아래 버튼을 눌러 주세요.</p>
      <a href={appRedirect} className="flex min-h-[48px] items-center justify-center rounded-[12px] bg-accent px-4 text-[15px] font-semibold text-on-accent">
        앱으로 돌아가기
      </a>
      <p className="break-keep text-[12px] text-ink2">1분이 지나면 이 창을 닫고 앱에서 다시 로그인해 주세요.</p>
    </div>
  )
}
