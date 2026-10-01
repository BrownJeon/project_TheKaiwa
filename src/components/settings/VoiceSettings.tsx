'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet, apiPut, errorMessage } from '@/components/common/api'
import Segmented from '@/components/common/Segmented'
import TeacherAvatar from '@/components/common/TeacherAvatar'
import Toast, { useToast } from '@/components/common/Toast'
import { Btn, Card, ErrorBlock, Field, LoadingBlock, Section, SectionHeader } from '@/components/common/ui'
import TtsRuntimeStatusIndicator from '@/components/speech/TtsRuntimeStatusIndicator'
import VoicePreviewButton from '@/components/speech/VoicePreviewButton'
import { useTtsRuntimeStatus } from '@/components/speech/useTtsRuntimeStatus'
import { useVoicePreview } from '@/components/speech/useVoicePreview'
import VoiceSlider, { VoiceNote } from './VoiceSlider'
import {
  comboNote,
  effectiveStyle,
  hasChangedFromDefault,
  rangeNote,
  resetVoiceValues,
  styleWeightNote,
  voiceBaseValues,
  type VoiceBaselines,
  type VoiceRanges,
} from './voiceSliderLogic'

interface Voice {
  id: string
  name: string
  description: string | null
  defaults?: { style?: string; styleWeight?: number; speed?: number; pitch?: number; intonation?: number }
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

/**
 * 설정 허브 · AI 선생님(api-contract #13·#14·#17·#18, screens §7). 목소리 이름·설명만 보이고 엔진·모델명은 보이지 않는다.
 * 머리에 선생님 아바타·이름과 **실행 상태 표시등**. 미리듣기는 통합 버튼 1개 — **저장 전 draft**(들려주는 방식 포함)로 합성해 바로 재생하고,
 * 설정을 바꾸면 재생을 멈추고 대기 중 결과를 버린다. 미리듣기 결과는 표시등의 복귀·장애 신호가 된다.
 * 슬라이더 범위(`ranges`)는 서버 검증과 같은 정본을 라우트가 넘긴다(task-022). 저장된 값은 범위를 넓히기 전 값도 그대로 읽는다.
 * 슬라이더의 "기본"(눈금·방향 말·되돌리기 판정·되돌리기 값)은 목소리 기본값(`baselines`, 라우트가 넘김 — 없으면 #17 defaults)을 서버 Resolver 순서로 푼 값이다.
 */
export default function VoiceSettings({ teacherName, ranges, baselines }: { teacherName: string; ranges: VoiceRanges; baselines: VoiceBaselines }) {
  const [voices, setVoices] = useState<Voice[] | null>(null)
  const [s, setS] = useState<VoiceSetting | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const showToast = toast.show
  const status = useTtsRuntimeStatus()
  const preview = useVoicePreview({ onError: showToast, onSignal: status.reportSynthesis })
  const announce = useCallback((msg: string) => showToast(msg, 4000), [showToast])
  const intonationRef = useRef<HTMLInputElement>(null)

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
  const baseline = baselines[current.id] ?? current.defaults
  const voiceDefaultStyle = baseline?.style
  const base = voiceBaseValues(baseline, effectiveStyle(s.style, current.styles, voiceDefaultStyle), ranges)
  // 말투 세기 null = 목소리·말투 기본값을 따른다(Resolver 2순위 이하) — 슬라이더는 실제로 들리는 값을 보여 준다.
  const weight = s.styleWeight ?? base.styleWeight
  const weightNote = styleWeightNote({ style: s.style, styles: current.styles, voiceDefaultStyle, weight })
  const combo = comboNote(s.pitch, s.intonation)
  const resetValues = () => {
    change({ ...s, ...resetVoiceValues(base) })
    // 누른 버튼은 바로 사라진다 — 키보드·스크린리더 포커스가 body 로 떨어지지 않게 바로 위 슬라이더로 옮긴다(REV-040).
    intonationRef.current?.focus()
    toast.show('속도·높낮이·억양·세기를 기본값으로 되돌렸어요(아직 저장 전)')
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
        <VoiceSlider id="voice-style-weight" axis="styleWeight" label="말투 세기" value={weight} range={ranges.styleWeight} base={base.styleWeight} note={weightNote} onChange={(v) => change({ ...s, styleWeight: v })} />
        <Field label="들려주는 방식">
          <Segmented ariaLabel="들려주는 방식" options={PROFILE_OPTIONS} value={profileValue} onChange={(v) => change({ ...s, speechProfile: v })} />
        </Field>
        <div className="flex min-w-0 flex-col gap-3.5">
          <VoiceSlider id="voice-speed" axis="speed" label="속도" value={s.speed} range={ranges.speed} base={base.speed} note={rangeNote('speed', s.speed)} onChange={(v) => change({ ...s, speed: v })} />
          <VoiceSlider id="voice-pitch" axis="pitch" label="높낮이" value={s.pitch} range={ranges.pitch} base={base.pitch} note={rangeNote('pitch', s.pitch)} onChange={(v) => change({ ...s, pitch: v })} />
          <VoiceSlider id="voice-intonation" axis="intonation" label="억양" value={s.intonation} range={ranges.intonation} base={base.intonation} note={rangeNote('intonation', s.intonation)} inputRef={intonationRef} onChange={(v) => change({ ...s, intonation: v })} />
          {combo ? <VoiceNote boxed>{combo}</VoiceNote> : null}
        </div>
        {hasChangedFromDefault(s, base) ? (
          <button type="button" onClick={resetValues} className="min-h-11 self-start text-[13px] font-semibold text-accent">
            ↺ 기본값으로 되돌리기(속도·높낮이·억양·세기)
          </button>
        ) : null}
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
