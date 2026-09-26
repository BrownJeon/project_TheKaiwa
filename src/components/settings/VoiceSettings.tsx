'use client'

import { useCallback, useEffect, useState } from 'react'
import { ApiError, apiGet, apiPost, apiPut, errorMessage } from '@/components/common/api'
import Segmented from '@/components/common/Segmented'
import Toast, { useToast } from '@/components/common/Toast'
import { Btn, BtnRow, Card, ErrorBlock, Field, LoadingBlock, Section, SectionHeader } from '@/components/common/ui'

interface Voice {
  id: string
  name: string
  description: string | null
  styles: { name: string; label: string }[]
}
type SpeechProfile = 'NATIVE' | 'LEARNING_NORMAL' | 'LEARNING_SLOW'
interface VoiceSetting {
  voiceProfileId: string | null
  style: string
  styleWeight: number | null
  speed: number
  pitch: number
  intonation: number
  speechProfile: SpeechProfile | 'PRONUNCIATION' | 'SHADOWING'
}

function Slider({ id, label, value, min, max, onChange }: { id: string; label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <Field label={`${label} ${value.toFixed(2)}×`} htmlFor={id}>
      {/* 기본 range 의 손잡이는 작다 — 트랙 높이 44px 로 터치 영역을 확보한다. */}
      <input id={id} type="range" min={min} max={max} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-11 w-full accent-[var(--accent)]" aria-valuetext={`${value.toFixed(2)}배`} />
    </Field>
  )
}

/**
 * 설정 허브 · AI 선생님(api-contract #13·#14·#17·#18). 목소리 이름·설명만 보이고 엔진·모델명은 보이지 않는다.
 * 미리듣기는 **저장 전 draft** 로 요청한다. TTS 연결(task-003) 전에는 서버가 "준비 중" 을 돌려준다.
 */
export default function VoiceSettings() {
  const [voices, setVoices] = useState<Voice[] | null>(null)
  const [s, setS] = useState<VoiceSetting | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'save' | 'preview' | null>(null)
  const toast = useToast()

  const load = useCallback(async () => {
    setError(null)
    try {
      const [v, setting] = await Promise.all([apiGet<Voice[]>('/api/v1/voices'), apiGet<VoiceSetting>('/api/v1/settings/voice')])
      setVoices(v)
      setS({ ...setting, voiceProfileId: setting.voiceProfileId ?? v[0]?.id ?? null })
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  if (error) return <ErrorBlock message={error} onRetry={load} />
  if (!voices || !s) return <LoadingBlock />
  if (voices.length === 0) return <Section><SectionHeader title="AI 선생님" /><Card>선택할 수 있는 목소리가 아직 없어요.</Card></Section>

  const current = voices.find((v) => v.id === s.voiceProfileId) ?? voices[0]
  const draft = { voiceProfileId: current.id, style: s.style, styleWeight: s.styleWeight, speed: s.speed, pitch: s.pitch, intonation: s.intonation }
  const profileValue: SpeechProfile = s.speechProfile === 'LEARNING_NORMAL' || s.speechProfile === 'LEARNING_SLOW' ? s.speechProfile : 'NATIVE'

  const preview = async () => {
    setBusy('preview')
    try {
      await apiPost('/api/v1/voices/preview', draft)
    } catch (e) {
      toast.show(e instanceof ApiError && e.code === 'ENGINE_UNAVAILABLE' ? e.message : errorMessage(e))
    } finally {
      setBusy(null)
    }
  }
  const save = async () => {
    setBusy('save')
    try {
      const saved = await apiPut<VoiceSetting>('/api/v1/settings/voice', { ...draft, speechProfile: profileValue })
      setS(saved)
      toast.show('선생님 목소리 설정을 저장했어요')
    } catch (e) {
      toast.show(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Section>
      <SectionHeader title="AI 선생님 목소리" />
      <Card className="flex flex-col gap-3.5">
        <div role="radiogroup" aria-label="목소리" className="flex flex-col gap-2">
          {voices.map((v) => {
            const on = v.id === current.id
            return (
              <button key={v.id} type="button" role="radio" aria-checked={on} onClick={() => setS({ ...s, voiceProfileId: v.id, style: 'AUTO' })}
                className={`min-h-[52px] rounded-xl border px-3.5 py-2.5 text-left ${on ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}>
                <span className="block text-[15px] font-semibold text-ink">{v.name}</span>
                {v.description ? <span className="block text-[13px] text-ink2">{v.description}</span> : null}
              </button>
            )
          })}
        </div>
        <Field label="말투">
          <Segmented ariaLabel="말투" options={[{ value: 'AUTO', label: '자동' }, ...current.styles.map((st) => ({ value: st.name, label: st.label }))]} value={s.style} onChange={(v) => setS({ ...s, style: v })} />
        </Field>
        <Field label="들려주는 방식">
          <Segmented ariaLabel="들려주는 방식" options={[{ value: 'NATIVE', label: '자연 속도' }, { value: 'LEARNING_NORMAL', label: '학습 속도' }, { value: 'LEARNING_SLOW', label: '천천히' }] as const} value={profileValue} onChange={(v) => setS({ ...s, speechProfile: v })} />
        </Field>
        <Slider id="speed" label="속도" value={s.speed} min={0.6} max={1.2} onChange={(v) => setS({ ...s, speed: v })} />
        <Slider id="pitch" label="높낮이" value={s.pitch} min={0.8} max={1.2} onChange={(v) => setS({ ...s, pitch: v })} />
        <Slider id="intonation" label="억양" value={s.intonation} min={0.8} max={1.2} onChange={(v) => setS({ ...s, intonation: v })} />
        <BtnRow>
          <Btn variant="ghost" onClick={preview} disabled={busy !== null}>{busy === 'preview' ? '준비 중…' : '▶ 미리듣기'}</Btn>
          <Btn onClick={save} disabled={busy !== null}>{busy === 'save' ? '저장 중…' : '저장'}</Btn>
        </BtnRow>
      </Card>
      <Toast message={toast.message} />
    </Section>
  )
}
