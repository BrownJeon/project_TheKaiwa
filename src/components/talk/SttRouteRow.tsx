'use client'

/**
 * 회화방 ⋯ 메뉴의 "알아듣는 곳" 읽기 전용 한 줄(screens §11-2 D) — 앱에서만. 여기서 경로를 바꾸지 않는다(방식은 설정에서).
 * 엔진·모델 이름 없이 "휴대폰에서 / 서버에서"와 이유 짧은 꼴만.
 */
import Link from 'next/link'
import type { SttRoute } from '@/modules/speech/stt/client'
import { routeReasonShort, STT_ROUTE_ROW } from '@/components/speech/sttCopy'

export default function SttRouteRow({ route }: { route: SttRoute }) {
  const reason = routeReasonShort(route)
  return (
    <div className="mt-2 min-w-0 border-t border-line pt-2">
      <div className="flex min-h-[44px] min-w-0 items-center justify-between gap-3">
        <span className="text-[13px] text-ink2">{STT_ROUTE_ROW.label}</span>
        <span className="text-[15px] text-ink">{route.kind === 'ONDEVICE' ? STT_ROUTE_ROW.onDevice : STT_ROUTE_ROW.server}</span>
      </div>
      {reason ? <p className="break-keep text-[12px] text-ink2">{reason}</p> : null}
      <Link href="/settings#ondevice-card" className="inline-flex h-11 items-center text-[13px] font-semibold underline underline-offset-4">
        {STT_ROUTE_ROW.link}
      </Link>
    </div>
  )
}
