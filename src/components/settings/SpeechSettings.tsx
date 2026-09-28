'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPut, errorMessage } from '@/components/common/api'
import Toast, { useToast } from '@/components/common/Toast'
import { Card, ErrorBlock, LoadingBlock, Section, SectionHeader } from '@/components/common/ui'
import { useNativeEnv } from '@/components/common/useNativeEnv'
import MicTestCard from '@/components/speech/MicTestCard'
import OnDeviceModelCard from '@/components/speech/OnDeviceModelCard'
import { modeDescription, type RecognitionMode } from '@/components/speech/modelCopy'
import { useOnDeviceModel } from '@/components/speech/useOnDeviceModel'
import type { SttClientConfig } from '@/modules/speech/stt/client'

type Mode = RecognitionMode
interface SpeechSetting {
  recognitionMode: Mode
  explainLang: 'ko' | 'ja' | 'en'
}

const MODES: { value: Mode; label: string }[] = [
  { value: 'AUTO', label: '자동(권장)' },
  { value: 'FAST', label: '빠르게' },
  { value: 'ACCURATE', label: '정확하게' },
  { value: 'OFFLINE', label: '오프라인' },
]

/**
 * 설정 허브 · 음성 인식 모드(api-contract #15·#16). 웹에서는 오프라인을 고를 수 없다.
 * task-003e: 모드 카드 아래 마이크 테스트 카드(screens §8-2 A) — 모드 조회가 실패하거나 로딩 중이어도 테스트 카드는 보인다.
 * task-003f(screens §11-2 A·B): 방식 카드와 마이크 테스트 사이에 **휴대폰에서 알아듣기 카드**(앱 + 플러그인만). 방식 설명은 앱/웹·파일 유무로
 * 고르고(§11-8 ⓓ), 앱의 오프라인 방식은 휴대폰 인식 파일이 있어야 고를 수 있다. #19 는 여기서 한 번 받아 카드·마이크 테스트가 같이 쓴다.
 */
export default function SpeechSettings() {
  const [s, setS] = useState<SpeechSetting | null>(null)
  const { native } = useNativeEnv()
  const [error, setError] = useState<string | null>(null)
  const [config, setConfig] = useState<SttClientConfig | null>(null)
  const [micBusy, setMicBusy] = useState(false)
  const toast = useToast()
  const model = useOnDeviceModel(config)

  const loadConfig = useCallback(async () => {
    try {
      setConfig(await apiGet<SttClientConfig>('/api/v1/speech/config'))
    } catch {
      // 설정이 없어도 마이크 테스트는 서버 경로로 동작한다(카드는 확인 중으로 남는다)
    }
  }, [])

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
    void loadConfig()
  }, [load, loadConfig])

  const choose = async (mode: Mode) => {
    if (!s) return
    const prev = s
    setS({ ...s, recognitionMode: mode })
    try {
      // PUT 은 전체 치환 — 설명 언어도 함께 보낸다.
      setS(await apiPut<SpeechSetting>('/api/v1/settings/speech', { recognitionMode: mode, explainLang: s.explainLang }))
      toast.show('음성 인식 방식을 바꿨어요')
      // 방식이 바뀌면 경로(onDevice.enabled·gateway.enabled)가 바뀐다 — 다음 누름에 맞게 설정을 다시 받는다.
      void loadConfig()
    } catch (e) {
      setS(prev)
      toast.show(errorMessage(e))
    }
  }

  const onDevice = native && model.snap.phase !== 'unsupported' && !!config?.onDevice && 'model' in (config.onDevice ?? {})

  return (
    <Section>
      <SectionHeader title="음성 인식" />
      {error ? (
        <ErrorBlock message={error} onRetry={load} />
      ) : !s ? (
        <LoadingBlock />
      ) : (
        <Card>
          <div role="radiogroup" aria-label="음성 인식 방식" className="flex flex-col gap-2">
            {MODES.map((m) => {
              const on = s.recognitionMode === m.value
              const d = modeDescription(m.value, { native, onDevice, installed: model.snap.installed })
              // 이미 고른 방식은 막지 않는다(파일이 손상돼 없어진 오프라인 — 카드 오류가 이유를 말한다).
              const disabled = d.disabled && !on
              return (
                <button key={m.value} type="button" role="radio" aria-checked={on} aria-disabled={disabled} disabled={disabled} onClick={() => choose(m.value)}
                  className={`min-h-[52px] rounded-xl border px-3.5 py-2.5 text-left disabled:opacity-50 ${on ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}>
                  <span className="block text-[15px] font-semibold text-ink">{m.label}</span>
                  <span className="block text-[13px] text-ink2">{d.desc}</span>
                </button>
              )
            })}
          </div>
        </Card>
      )}
      <OnDeviceModelCard config={config} recognitionMode={s?.recognitionMode ?? null} micBusy={micBusy} onToast={toast.show} />
      <MicTestCard config={config} onBusy={setMicBusy} />
      <Toast message={toast.message} />
    </Section>
  )
}
