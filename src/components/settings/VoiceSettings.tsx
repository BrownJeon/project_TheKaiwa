'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPut, errorMessage } from '@/components/common/api'
import Segmented from '@/components/common/Segmented'
import TeacherAvatar from '@/components/common/TeacherAvatar'
import Toast, { useToast } from '@/components/common/Toast'
import { Btn, Card, ErrorBlock, Field, LoadingBlock, Section, SectionHeader } from '@/components/common/ui'
import TtsRuntimeStatusIndicator from '@/components/speech/TtsRuntimeStatusIndicator'
import VoicePreviewButton from '@/components/speech/VoicePreviewButton'
import { useTtsRuntimeStatus } from '@/components/speech/useTtsRuntimeStatus'
import { useVoicePreview } from '@/components/speech/useVoicePreview'

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

const PROFILE_OPTIONS = [
  { value: 'NATIVE', label: '자연 속도' },
  { value: 'LEARNING_NORMAL', label: '학습 속도' },
  { value: 'LEARNING_SLOW', label: '천천히' },
] as const

function Slider({ id, label, value, min, max, onChange }: { id: string; label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <Field label={`${label} ${value.toFixed(2)}×`} htmlFor={id}>
      {/* 기본 range 의 손잡이는 작다 — 트랙 높이 44px 로 터치 영역을 확보한다. */}
      <input id={id} type="range" min={min} max={max} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-11 w-full accent-[var(--accent)]" aria-valuetext={`${value.toFixed(2)}배`} />
    </Field>
  )
}

/**
 * 설정 허브 · AI 선생님(api-contract #13·#14·#17·#18, screens §7). 목소리 이름·설명만 보이고 엔진·모델명은 보이지 않는다.
 * 머리에 선생님 아바타·이름과 **실행 상태 표시등**. 미리듣기는 통합 버튼 1개 — **저장 전 draft**(들려주는 방식 포함)로 합성해 바로 재생하고,
 * 설정을 바꾸면 재생을 멈추고 대기 중 결과를 버린다. 미리듣기 결과는 표시등의 복귀·장애 신호가 된다.
 */
export default function VoiceSettings({ teacherName }: { teacherName: string }) {
  const [voices, setVoices] = useState<Voice[] | null>(null)
  const [s, setS] = useState<VoiceSetting | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const showToast = toast.show
  const status = useTtsRuntimeStatus()
  const preview = useVoicePreview({ onError: showToast, onSignal: status.reportSynthesis })
  const announce = useCallback((msg: string) => showToast(msg, 4000), [showToast])

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

  const head = (
    <div className="flex min-w-0 items-center gap-3">
      <TeacherAvatar name={teacherName} size="md" />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <p className="w-full truncate text-[15px] font-semibold text-ink">{teacherName}</p>
        <TtsRuntimeStatusIndicator onAnnounce={announce} />
      </div>
    </div>
  )

  if (voices.length === 0) {
    return (
      <Section>
        <SectionHeader title="AI 선생님 목소리" />
        <Card className="flex flex-col gap-3.5">
          {head}
          <p className="text-[14px] text-ink2">선택할 수 있는 목소리가 아직 없어요.</p>
        </Card>
        <Toast message={toast.message} />
      </Section>
    )
  }

  const current = voices.find((v) => v.id === s.voiceProfileId) ?? voices[0]
  const profileValue: SpeechProfile = s.speechProfile === 'LEARNING_NORMAL' || s.speechProfile === 'LEARNING_SLOW' ? s.speechProfile : 'NATIVE'
  const draft = { voiceProfileId: current.id, style: s.style, styleWeight: s.styleWeight, speed: s.speed, pitch: s.pitch, intonation: s.intonation, speechProfile: profileValue }
  const change = (next: VoiceSetting) => {
    preview.invalidate()
    setS(next)
  }
  const online = status.snapshot.networkOnline
  const styleLabel = s.style === 'AUTO' ? '자동' : (current.styles.find((st) => st.name === s.style)?.label ?? s.style)
  const profileLabel = PROFILE_OPTIONS.find((o) => o.value === profileValue)?.label ?? ''
  const hint = !online
    ? '인터넷에 연결되면 들을 수 있어요.'
    : status.snapshot.state === 'TEXT_ONLY'
      ? '지금은 선생님 목소리를 들을 수 없어요(자막만). 눌러 보면 다시 확인해요.'
      : `${current.name} · ${styleLabel} · ${profileLabel} — 저장하지 않은 설정도 그대로 들려드려요`

  const save = async () => {
    setSaving(true)
    try {
      const saved = await apiPut<VoiceSetting>('/api/v1/settings/voice', draft)
      setS(saved)
      toast.show('선생님 목소리 설정을 저장했어요')
    } catch (e) {
      toast.show(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section>
      <SectionHeader title="AI 선생님 목소리" />
      <Card className="flex flex-col gap-3.5">
        {head}
        <hr className="border-line" />
        <div role="radiogroup" aria-label="목소리" className="flex flex-col gap-2">
          {voices.map((v) => {
            const on = v.id === current.id
            return (
              <button key={v.id} type="button" role="radio" aria-checked={on} onClick={() => change({ ...s, voiceProfileId: v.id, style: 'AUTO' })}
                className={`min-h-[52px] rounded-xl border px-3.5 py-2.5 text-left ${on ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}>
                <span className="block text-[15px] font-semibold text-ink">{v.name}</span>
                {v.description ? <span className="block text-[13px] text-ink2">{v.description}</span> : null}
              </button>
            )
          })}
        </div>
        <Field label="말투">
          <Segmented ariaLabel="말투" options={[{ value: 'AUTO', label: '자동' }, ...current.styles.map((st) => ({ value: st.name, label: st.label }))]} value={s.style} onChange={(v) => change({ ...s, style: v })} />
        </Field>
        <Field label="들려주는 방식">
          <Segmented ariaLabel="들려주는 방식" options={PROFILE_OPTIONS} value={profileValue} onChange={(v) => change({ ...s, speechProfile: v })} />
        </Field>
        <Slider id="speed" label="속도" value={s.speed} min={0.6} max={1.2} onChange={(v) => change({ ...s, speed: v })} />
        <Slider id="pitch" label="높낮이" value={s.pitch} min={0.8} max={1.2} onChange={(v) => change({ ...s, pitch: v })} />
        <Slider id="intonation" label="억양" value={s.intonation} min={0.8} max={1.2} onChange={(v) => change({ ...s, intonation: v })} />
        <div className="flex flex-col gap-1.5">
          <VoicePreviewButton phase={preview.phase} cooldownSec={preview.cooldownSec} disabled={!online || saving} onClick={() => preview.toggle(draft)} describedBy="voice-preview-hint" />
          <p id="voice-preview-hint" className="text-[12px] text-ink2 break-keep">{hint}</p>
        </div>
        <Btn className="w-full" onClick={save} disabled={saving}>{saving ? '저장 중…' : '저장'}</Btn>
      </Card>
      <Toast message={toast.message} />
    </Section>
  )
}
