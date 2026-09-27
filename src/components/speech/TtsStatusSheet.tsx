'use client'

/**
 * 사유 시트(screens §7-2 C) — 지금 상태·이유·인터넷·목소리 서버·마지막 확인·자동 확인 + [지금 다시 확인].
 * executionMode 원문·연결 키·traceId·URL 은 없다. 다시 확인은 5초에 1회, 오프라인이면 막는다.
 */
import { useEffect, useState } from 'react'
import Sheet from '@/components/common/Sheet'
import { Btn } from '@/components/common/ui'
import { useNow } from '@/components/common/useNow'
import { HEALTH_TEXT, REASON_TEXT, ROW_LABEL, SHEET_TITLE, STATE_DESCRIPTION, STATE_LABEL } from './ttsStatusCopy'
import { POLL_HEALTHY_MS, type TtsStatusSnapshot } from './ttsStatusStore'
import { DOT_CLASS, LABEL_CLASS } from './ttsStatusStyle'

const RECHECK_GAP_MS = 5_000

function lastCheckText(iso: string | null, now: number): string {
  if (!iso) return '아직 확인 전'
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return '아직 확인 전'
  const d = new Date(t)
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const min = now ? Math.floor((now - t) / 60_000) : 0
  return min < 1 ? `방금 (${hhmm})` : `${min}분 전 (${hhmm})`
}

export default function TtsStatusSheet({ open, onClose, snapshot, onRecheck }: { open: boolean; onClose: () => void; snapshot: TtsStatusSnapshot; onRecheck: () => void }) {
  const now = useNow(open, 30_000)
  const [cooling, setCooling] = useState(false)
  useEffect(() => {
    if (!cooling) return
    const t = setTimeout(() => setCooling(false), RECHECK_GAP_MS)
    return () => clearTimeout(t)
  }, [cooling])
  const s = snapshot
  const showReason = s.state === 'TEXT_ONLY' || s.state === 'SWITCHING' || s.state === 'ON_DEVICE'
  const reason = REASON_TEXT[s.reason ?? 'NONE']
  const recheckDisabled = s.checking || !s.networkOnline || cooling
  return (
    <Sheet open={open} title={SHEET_TITLE} onClose={onClose}>
      <div className="flex min-w-0 flex-col gap-4 px-4 pb-4 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden className={DOT_CLASS[s.state]} />
          <span className={`text-[17px] font-semibold ${LABEL_CLASS[s.state] === 'text-bad' ? 'text-bad' : 'text-ink'}`}>{STATE_LABEL[s.state]}</span>
        </div>
        <p className="text-[15px] leading-relaxed text-ink break-keep">{STATE_DESCRIPTION[s.state]}</p>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3">
          {showReason ? (
            <>
              <dt className="text-[13px] text-ink2">{ROW_LABEL.why}</dt>
              <dd className="text-[15px] text-ink break-keep">{reason.why}</dd>
              <dt className="text-[13px] text-ink2">{ROW_LABEL.tip}</dt>
              <dd className="text-[15px] text-ink break-keep">{reason.tip}</dd>
            </>
          ) : null}
          <dt className="text-[13px] text-ink2">{ROW_LABEL.network}</dt>
          <dd className="text-[15px] text-ink">{s.networkOnline ? '연결됨' : '끊김'}</dd>
          <dt className="text-[13px] text-ink2">{ROW_LABEL.server}</dt>
          <dd className="text-[15px] text-ink">{HEALTH_TEXT[s.serverHealth ?? 'UNKNOWN']}</dd>
          <dt className="text-[13px] text-ink2">{ROW_LABEL.last}</dt>
          <dd className="text-[15px] text-ink">{lastCheckText(s.lastUpdatedAt, now)}</dd>
          <dt className="text-[13px] text-ink2">{ROW_LABEL.poll}</dt>
          <dd className="text-[15px] text-ink">{s.pollMs >= POLL_HEALTHY_MS ? '5분마다' : '30초마다'}</dd>
        </dl>
        <Btn
          variant="ghost"
          className="w-full"
          disabled={recheckDisabled}
          onClick={() => {
            setCooling(true)
            onRecheck()
          }}
        >
          {!s.networkOnline ? '인터넷에 연결되면 바로 확인해요' : s.checking ? '확인하는 중…' : '지금 다시 확인'}
        </Btn>
      </div>
    </Sheet>
  )
}
