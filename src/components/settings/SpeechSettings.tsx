'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPut, errorMessage } from '@/components/common/api'
import Toast, { useToast } from '@/components/common/Toast'
import { Card, ErrorBlock, LoadingBlock, Section, SectionHeader } from '@/components/common/ui'
import { isNativeApp } from '@/modules/infra/native'

type Mode = 'AUTO' | 'FAST' | 'ACCURATE' | 'OFFLINE'
interface SpeechSetting {
  recognitionMode: Mode
}

const MODES: { value: Mode; label: string; desc: string; appOnly?: boolean }[] = [
  { value: 'AUTO', label: '자동(권장)', desc: '기기와 연결 상태를 보고 알맞게 골라요' },
  { value: 'FAST', label: '빠르게', desc: '휴대폰에서 바로 알아들어요' },
  { value: 'ACCURATE', label: '정확하게', desc: '서버에서 한 번 더 확인해요(조금 느려요)' },
  { value: 'OFFLINE', label: '오프라인', desc: '인터넷 없이 휴대폰에서만 알아들어요', appOnly: true },
]

/** 설정 허브 · 음성 인식 모드(api-contract #15·#16). 웹에서는 오프라인을 고를 수 없다. */
export default function SpeechSettings() {
  const [s, setS] = useState<SpeechSetting | null>(null)
  const [native, setNative] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  const load = useCallback(async () => {
    setError(null)
    try {
      setS(await apiGet<SpeechSetting>('/api/v1/settings/speech'))
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [])
  useEffect(() => {
    void load()
    setNative(isNativeApp())
  }, [load])

  if (error) return <ErrorBlock message={error} onRetry={load} />
  if (!s) return <LoadingBlock />

  const choose = async (mode: Mode) => {
    const prev = s
    setS({ recognitionMode: mode })
    try {
      setS(await apiPut<SpeechSetting>('/api/v1/settings/speech', { recognitionMode: mode }))
      toast.show('음성 인식 방식을 바꿨어요')
    } catch (e) {
      setS(prev)
      toast.show(errorMessage(e))
    }
  }

  return (
    <Section>
      <SectionHeader title="음성 인식" />
      <Card>
        <div role="radiogroup" aria-label="음성 인식 방식" className="flex flex-col gap-2">
          {MODES.map((m) => {
            const on = s.recognitionMode === m.value
            const disabled = m.appOnly && !native
            return (
              <button key={m.value} type="button" role="radio" aria-checked={on} aria-disabled={disabled} disabled={disabled} onClick={() => choose(m.value)}
                className={`min-h-[52px] rounded-xl border px-3.5 py-2.5 text-left disabled:opacity-50 ${on ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}>
                <span className="block text-[15px] font-semibold text-ink">{m.label}</span>
                <span className="block text-[13px] text-ink2">{disabled ? '앱에서만 쓸 수 있어요' : m.desc}</span>
              </button>
            )
          })}
        </div>
      </Card>
      <Toast message={toast.message} />
    </Section>
  )
}
