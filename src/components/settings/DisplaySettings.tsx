'use client'

/**
 * 설정 › 일본어 표시(task-026, screens §15-4-8) — 히라가나·한글·번역 스위치 3개. 누르면 바로 저장(학습 설정 [저장]과 별개)하고,
 * 표시 바·수업·단어장 도구 줄과 같은 저장소(`useDisplayPrefs`)라 어디서 바꿔도 같은 값이다. 미리 보기는 실제 분석 결과로 그린다.
 * 저장 실패 토스트는 앱 셸이 띄운다(이 화면을 떠난 뒤 실패해도 보이게, REV-096 #2).
 */
import { useEffect } from 'react'
import Toast, { useToast } from '@/components/common/Toast'
import { Card, ErrorBlock, LoadingBlock, Section, SectionHeader } from '@/components/common/ui'
import { useAnnotation } from '@/components/common/japanese/annotations'
import { DISPLAY_COPY, DISPLAY_TOAST_MS, TOGGLE_KEY, useDisplayPrefs } from '@/components/common/japanese/displayPrefs'
import { HangulLine, JaText, useClearSuccessOnSaveFail } from '@/components/common/japanese/JapaneseText'

const C = DISPLAY_COPY.settings

export default function DisplaySettings() {
  const prefs = useDisplayPrefs()
  const toast = useToast()
  const markShown = useClearSuccessOnSaveFail(toast.show)
  const preview = useAnnotation(C.previewJa)

  // 다른 기기에서 바꾼 값을 반영하려고 설정 화면 진입 때 한 번 더 읽는다(§15-3 B).
  useEffect(() => {
    void prefs.reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 때 한 번
  }, [])

  let body: React.ReactNode
  if (!prefs.loaded) body = <LoadingBlock />
  else if (prefs.error) body = <ErrorBlock message={C.loadFailed} onRetry={() => void prefs.reload()} />
  else
    body = (
      <Card>
        {C.rows.map(([k, title, desc], i) => {
          const key = TOGGLE_KEY[k]
          const on = prefs[key]
          return (
            <button
              key={k}
              type="button"
              role="switch"
              aria-checked={on}
              onClick={() => {
                prefs.set(key, !on)
                toast.show(DISPLAY_COPY.toast[k][on ? 0 : 1], DISPLAY_TOAST_MS)
                markShown()
              }}
              className={`flex min-h-14 w-full items-center gap-3 py-1.5 text-left text-ink ${i > 0 ? 'border-t border-line' : ''}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">{title}</span>
                <span className="block text-[13px] text-ink2 break-keep">{desc}</span>
              </span>
              <span aria-hidden="true" className={`relative h-7 w-12 flex-none rounded-full transition-colors ${on ? 'bg-accent' : 'bg-surface2 ring-1 ring-line'}`}>
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-surface shadow transition-[left] ${on ? 'left-6' : 'left-1'}`} />
              </span>
            </button>
          )
        })}
        <div className="mt-0.5 flex flex-col gap-0.5 text-[12.5px] text-ink2 break-keep">
          {C.help.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <div className="mt-3 rounded-xl bg-surface2 px-3 py-2.5">
          <p className="text-[12.5px] text-ink2">{C.previewCaption}</p>
          <JaText text={C.previewJa} state={preview} className="text-[17px] leading-[1.7] text-ink" />
          <HangulLine state={preview} onTint />
          {prefs.showTranslation ? <p className="text-[13px] text-ink2 break-keep">{C.previewKo}</p> : null}
          {!prefs.showFurigana && !prefs.showHangul ? <p className="mt-1 text-[12.5px] text-ink2">{C.previewHidden}</p> : null}
        </div>
      </Card>
    )

  return (
    <Section>
      <SectionHeader title={C.title} />
      {body}
      <Toast message={toast.message} />
    </Section>
  )
}
