'use client'

/**
 * 설정 → 음성 인식 → 마이크 테스트(docs/screens.md §8-2 B). 누르고 있는 동안 말하면 알아들은 말이 바로 보인다(점검용).
 * 티켓 용도 MIC_TEST(Leader M1) — 서버는 이 발화를 저장하지 않는다. 결과는 이 카드 state 에만 있다.
 * 마운트 때 권한을 묻지 않는다. #19 설정이 늦거나 실패해도 버튼은 누를 수 있다(티켓 응답으로 충분).
 */
import { useEffect, useId, useState } from 'react'
import { apiGet } from '@/components/common/api'
import { Card } from '@/components/common/ui'
import { isNativeApp } from '@/modules/infra/native'
import type { SttClientConfig } from '@/modules/speech/stt/client'
import MicLevelMeter from './MicLevelMeter'
import PushToTalkButton from './PushToTalkButton'
import { MIC_TEST_COPY, pathCaption, recordingStatus, STT_HINT_COPY, STT_STATUS_COPY, sttErrorCopy } from './sttCopy'
import { elapsedSec, showAskPermission, transcriptParts, type SttUiState } from './sttUiState'
import { useRealtimeStt } from './useRealtimeStt'

function statusLine(ui: SttUiState): string {
  switch (ui.phase) {
    case 'starting':
      return showAskPermission(ui) ? STT_STATUS_COPY.askPermission : ''
    case 'recording':
      if (ui.slow) return STT_STATUS_COPY.slowConnect
      if (ui.hint === 'TOO_QUIET') return STT_HINT_COPY.TOO_QUIET
      return recordingStatus(elapsedSec(ui))
    case 'finishing':
      return STT_STATUS_COPY.finishing
    case 'unavailable':
      return STT_STATUS_COPY.unavailable
    default:
      if (ui.hint) return STT_HINT_COPY[ui.hint]
      return ui.hadResult ? STT_STATUS_COPY.idleAfterResult : STT_STATUS_COPY.idle
  }
}

export default function MicTestCard() {
  const [config, setConfig] = useState<SttClientConfig | null>(null)
  // 초기 렌더에 쓰이지 않는 값(오류 문구에만) — 수화 불일치 없음.
  const [native] = useState(() => typeof window !== 'undefined' && isNativeApp())
  const { ui, kind, press, release, abort } = useRealtimeStt({ purpose: 'MIC_TEST', config })
  const statusId = useId()

  useEffect(() => {
    let alive = true
    apiGet<SttClientConfig>('/api/v1/speech/config')
      .then((c) => alive && setConfig(c))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  const { committed, partial } = transcriptParts(ui)
  const empty = !committed && !partial
  const err = ui.error ? sttErrorCopy(ui.error.code, { native, retryAfterSec: ui.error.retryAfterSec, mountCheck: ui.error.mountCheck }) : null

  return (
    <Card className="mt-3 flex flex-col gap-3">
      <div className="min-w-0">
        <h4 className="text-[15px] font-semibold text-ink">{MIC_TEST_COPY.title}</h4>
        <p className="mt-1 break-keep text-[13px] text-ink2">{MIC_TEST_COPY.desc}</p>
        <p className="mt-1 break-keep text-[12px] text-ink2">{pathCaption(kind)}</p>
      </div>

      <div className="min-h-[96px] min-w-0 rounded-xl bg-surface2 p-3">
        {empty ? (
          <p className="break-keep text-[13px] text-ink3">
            {MIC_TEST_COPY.placeholderLead}
            <span lang="ja">{MIC_TEST_COPY.placeholderJa}</span>
          </p>
        ) : (
          <p lang="ja" className="min-w-0 whitespace-pre-wrap text-[17px] leading-[1.7] text-ink [overflow-wrap:anywhere]">
            {committed}
            {committed && partial ? '\n' : ''}
            {partial ? (
              <span className="text-ink2">
                {partial}
                <span aria-hidden>…</span>
              </span>
            ) : null}
          </p>
        )}
      </div>

      <div className="flex flex-col items-center gap-2 pt-1">
        <PushToTalkButton phase={ui.phase} label={MIC_TEST_COPY.buttonLabel} describedBy={statusId} onPress={press} onRelease={release} onAbort={abort} />
        <p id={statusId} className="min-h-5 break-keep text-center text-[13px] text-ink2">
          {statusLine(ui)}
        </p>
        <MicLevelMeter db={ui.db} active={ui.phase === 'recording'} />
      </div>

      {err ? (
        <div role="alert" className="break-keep rounded-xl bg-bad-soft px-3.5 py-3 text-[13px] text-bad">
          <p className="font-semibold">{err.title}</p>
          <p className="mt-0.5">{err.action}</p>
        </div>
      ) : null}

      <p className="break-keep text-[12px] text-ink2">{MIC_TEST_COPY.storage}</p>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {ui.announce ? (
          <>
            {MIC_TEST_COPY.announcePrefix}
            <span lang="ja">{ui.announce.text}</span>
          </>
        ) : null}
      </p>
    </Card>
  )
}
