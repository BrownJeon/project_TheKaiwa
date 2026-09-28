'use client'

/**
 * APK 업데이트 띠(screens §11-2 G) — 앱 셸 맨 위 한 줄. 웹·해당 없음이면 null(행 높이 0, #8 요청도 없음).
 *  - 권장(56px): 글자 → 설치 방법 시트, [받기] → Chrome 으로 바로, ✕ → 그날(KST) 숨김. 집중 화면에서는 숨긴다.
 *  - 강제: 닫기 없음·빨강 톤·모든 화면(로그인 포함). 버튼은 바로 받기가 아니라 시트(설치 방법을 먼저 보게).
 * `forcedOnly` = 로그인 화면(권장 띠는 셸에서만), `insetTop` = 셸 밖이라 상태바 여백을 스스로 가진다.
 */
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Btn } from '@/components/common/ui'
import { useNativeEnv } from '@/components/common/useNativeEnv'
import AppUpdateSheet, { openApkDownload } from './AppUpdateSheet'
import { APP_UPDATE_COPY as C } from './appUpdateCopy'
import { isFocusRoute } from './routes'
import { useAppUpdate } from './useAppUpdate'

export default function AppUpdateBanner({ forcedOnly = false, insetTop = false }: { forcedOnly?: boolean; insetTop?: boolean }) {
  const { native, ready } = useNativeEnv()
  if (!ready || !native) return null
  return <Banner forcedOnly={forcedOnly} insetTop={insetTop} />
}

function Banner({ forcedOnly, insetTop }: { forcedOnly: boolean; insetTop: boolean }) {
  const snap = useAppUpdate()
  const pathname = usePathname() ?? ''
  const [sheet, setSheet] = useState(false)
  const { state, mine, latest } = snap
  if (!mine || !latest || state === 'hidden') return null

  const top = insetTop ? 'pt-[max(env(safe-area-inset-top),24px)]' : ''

  if (state === 'forced') {
    return (
      <>
        <div data-app-update="forced" role="alert" className={`flex min-w-0 items-center gap-3 border-b border-bad bg-bad-soft px-4 py-2.5 ${top}`}>
          <div className="min-w-0 flex-1 break-keep text-bad">
            <p className="text-[14px] font-semibold">{C.forcedTitle}</p>
            <p className="text-[13px]">{C.forcedBody(mine.name)}</p>
          </div>
          <Btn className="flex-none" onClick={() => setSheet(true)}>
            {C.forcedButton}
          </Btn>
        </div>
        <AppUpdateSheet open={sheet} onClose={() => setSheet(false)} snapshot={snap} />
      </>
    )
  }

  if (forcedOnly || snap.dismissedToday || isFocusRoute(pathname)) return null

  return (
    <>
      <div data-app-update="recommended" role="status" className={`flex min-h-14 min-w-0 items-center gap-1 border-b border-line bg-surface pl-4 pr-1 ${top}`}>
        <span aria-hidden className="h-8 w-[3px] flex-none rounded-full bg-accent" />
        <button type="button" className="min-h-11 min-w-0 flex-1 py-1.5 pl-2 text-left" onClick={() => setSheet(true)}>
          <span className="block truncate text-[14px] font-semibold text-ink">{C.recommendedTitle(latest.name)}</span>
          <span className="block truncate text-[12px] text-ink2">{C.recommendedSub}</span>
        </button>
        <Btn size="sm" className="relative flex-none before:absolute before:inset-x-0 before:-inset-y-1.5" onClick={() => void openApkDownload(latest.url)}>
          {C.download}
        </Btn>
        <button type="button" aria-label={C.dismissLabel} className="grid h-11 w-11 flex-none place-items-center text-ink2" onClick={snap.dismiss}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <AppUpdateSheet open={sheet} onClose={() => setSheet(false)} snapshot={snap} />
    </>
  )
}
