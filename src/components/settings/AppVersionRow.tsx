'use client'

/**
 * 설정 맨 아래 앱 버전 줄(screens §11-2 G `AppVersionRow`) — 앱에서만. 띠를 닫은 뒤에도 설치 방법 시트로 가는 길이고,
 * 실기기 확인 때 "지금 깔린 APK 번호"를 보는 자리다. 버전을 모르면(`getAppInfo()` 없음) 그리지 않는다.
 */
import { useState } from 'react'
import { Card, Section } from '@/components/common/ui'
import { useNativeEnv } from '@/components/common/useNativeEnv'
import AppUpdateSheet from '@/components/shell/AppUpdateSheet'
import { APP_UPDATE_COPY as C } from '@/components/shell/appUpdateCopy'
import { useAppUpdate } from '@/components/shell/useAppUpdate'

export default function AppVersionRow() {
  const { native, ready } = useNativeEnv()
  if (!ready || !native) return null
  return <Row />
}

function Row() {
  const snap = useAppUpdate()
  const [open, setOpen] = useState(false)
  if (!snap.mine) return null
  const mine = snap.mine.name
  return (
    <Section>
      <Card className="flex min-h-[56px] min-w-0 items-center justify-between gap-3">
        <span className="text-[14px] text-ink">{C.versionLabel}</span>
        {snap.state === 'hidden' || !snap.latest ? (
          <span className="min-w-0 truncate text-[14px] text-ink2 tabular-nums">{C.versionLatest(mine)}</span>
        ) : (
          <button
            type="button"
            data-app-version-row
            onClick={() => setOpen(true)}
            className={`inline-flex h-11 min-w-0 items-center truncate text-[14px] font-semibold tabular-nums ${snap.state === 'forced' ? 'text-bad' : 'text-accent'}`}
          >
            {snap.state === 'forced' ? C.versionForced(mine) : C.versionNew(mine, snap.latest.name)}
          </button>
        )}
      </Card>
      <AppUpdateSheet open={open} onClose={() => setOpen(false)} snapshot={snap} />
    </Section>
  )
}
