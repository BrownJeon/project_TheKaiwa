'use client'

/**
 * 설치 방법 시트(screens §11-2 G `AppUpdateSheet`) — 바뀐 점·4단계·[업데이트 받기]. 받기는 Chrome(Custom Tabs)으로만 연다
 * (WebView 는 파일 다운로드를 처리하지 못한다 — `fetch`·`<a download>` 금지). 바뀐 점은 글자로만 그린다.
 */
import { useEffect, useRef, useState } from 'react'
import Sheet from '@/components/common/Sheet'
import { Btn } from '@/components/common/ui'
import { formatMB } from '@/components/common/format'
import { openExternal } from '@/modules/infra/native'
import { APP_UPDATE_COPY as C, publishedLabel } from './appUpdateCopy'
import type { AppUpdateSnapshot } from './useAppUpdate'

export async function openApkDownload(url: string): Promise<boolean> {
  if (await openExternal(url)) return true
  try {
    // 플러그인이 없을 때만 — 앱의 DownloadListener 가 시스템 브라우저로 넘긴다(developer A).
    window.location.href = url
    return true
  } catch {
    return false
  }
}

export default function AppUpdateSheet({ open, onClose, snapshot }: { open: boolean; onClose: () => void; snapshot: AppUpdateSnapshot }) {
  const [opening, setOpening] = useState(false)
  const [failed, setFailed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const { mine, latest, state } = snapshot
  if (!latest || !mine) return null

  const download = async () => {
    if (opening) return
    setFailed(false)
    setOpening(true)
    const ok = await openApkDownload(latest.url)
    if (!ok) {
      setOpening(false)
      setFailed(true)
      return
    }
    // 두 번 받기 방지 — 3초 동안 "받는 중" 으로 두었다가 되돌린다.
    timer.current = setTimeout(() => setOpening(false), 3000)
  }

  const meta = C.sheetMeta(publishedLabel(latest.publishedAt), latest.bytes ? formatMB(latest.bytes) : null)

  return (
    <Sheet open={open} title={C.sheetTitle} onClose={onClose}>
      <p className="text-[15px] font-semibold text-ink tabular-nums">{C.sheetHead(mine.name, latest.name)}</p>
      {meta ? <p className="mt-0.5 text-[13px] text-ink2">{meta}</p> : null}
      {latest.notes ? (
        <>
          <h3 className="mt-4 text-[13px] font-semibold text-ink2">{C.notesTitle}</h3>
          <p className="mt-1 whitespace-pre-wrap break-keep text-[15px] text-ink [overflow-wrap:anywhere]">{latest.notes}</p>
        </>
      ) : null}
      <h3 className="mt-4 text-[13px] font-semibold text-ink2">{C.stepsTitle}</h3>
      <ol className="mt-2 flex flex-col gap-2.5">
        {C.steps.map((step, i) => (
          <li key={i} className="flex min-w-0 items-start gap-2.5 text-[14px] leading-6 text-ink">
            <span aria-hidden className="grid h-6 w-6 flex-none place-items-center rounded-full bg-surface2 text-[13px] text-ink">
              {i + 1}
            </span>
            <span className="min-w-0 break-keep">{step}</span>
          </li>
        ))}
      </ol>
      <Btn className="mt-4 w-full" onClick={download} disabled={opening}>
        {opening ? C.gettingUpdate : C.getUpdate}
      </Btn>
      {failed ? (
        <p role="alert" className="mt-2 break-keep text-[13px] text-bad">
          {C.openFail}
        </p>
      ) : null}
      <p className="mt-2 break-keep text-[12px] text-ink2">{C.installFail}</p>
      {state === 'recommended' ? (
        <Btn variant="ghost" className="mt-2 w-full" onClick={onClose}>
          {C.later}
        </Btn>
      ) : null}
    </Sheet>
  )
}
