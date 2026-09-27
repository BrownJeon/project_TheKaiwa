'use client'

/**
 * 회화 메뉴의 "들려주는 방식"(screens §9-2 H, §9-11 ⑩) — 설정 → AI 선생님 목소리의 같은 값이다.
 * #14 에 부분 PUT 이 없으므로 고를 때마다 #13 을 **새로** 읽고 `speechProfile` 만 바꿔 전체를 PUT 한다(그 사이 다른 화면이 바꾼 값을 덮지 않게).
 * 저장 중엔 radio `aria-disabled`, 실패면 원래 값으로 되돌리고 토스트.
 */
import { useEffect, useState } from 'react'
import { apiGet, apiPut } from '@/components/common/api'
import { SPEECH_PROFILE_DEFAULTS, TALK_TOAST } from './talkCopy'

interface VoiceSettingDto {
  voiceProfileId: string | null
  style: string
  styleWeight: number | null
  speed: number
  pitch: number
  intonation: number
  speechProfile: string
  voice?: { id: string } | null
}

export interface ProfileLabel {
  id: string
  label: string
}

const ROW = 'flex h-[52px] w-full min-w-0 items-center justify-between gap-3 rounded-xl px-1 text-left text-[15px]'

export default function SpeechProfileMenu({ labels, onToast }: { labels: readonly ProfileLabel[] | null; onToast: (msg: string) => void }) {
  const options = SPEECH_PROFILE_DEFAULTS.map((d) => ({ id: d.id as string, label: labels?.find((l) => l.id === d.id)?.label || d.label }))
  const [value, setValue] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    apiGet<VoiceSettingDto>('/api/v1/settings/voice')
      .then((s) => {
        if (alive) setValue(s.speechProfile)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  const choose = async (id: string) => {
    if (saving || id === value) return
    const before = value
    setValue(id)
    setSaving(true)
    try {
      const s = await apiGet<VoiceSettingDto>('/api/v1/settings/voice')
      await apiPut('/api/v1/settings/voice', {
        voiceProfileId: s.voiceProfileId ?? s.voice?.id ?? null,
        style: s.style,
        styleWeight: s.styleWeight,
        speed: s.speed,
        pitch: s.pitch,
        intonation: s.intonation,
        speechProfile: id,
      })
      onToast(TALK_TOAST.profileSaved(options.find((o) => o.id === id)?.label ?? ''))
    } catch {
      setValue(before)
      onToast(TALK_TOAST.profileFailed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="py-2">
      <p id="talkSpeechProfile" className="px-1 pb-1 text-[13px] text-ink2">
        들려주는 방식
      </p>
      <div role="radiogroup" aria-labelledby="talkSpeechProfile" className="flex flex-col">
        {options.map((o) => {
          const on = value === o.id
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-disabled={saving || undefined}
              onClick={() => void choose(o.id)}
              className={`${ROW} ${saving ? 'opacity-60' : ''}`}
            >
              <span className="min-w-0 truncate">{o.label}</span>
              <span aria-hidden="true" className={`grid h-5 w-5 flex-none place-items-center rounded-full border-2 ${on ? 'border-accent' : 'border-line'}`}>
                {on ? <span className="h-2.5 w-2.5 rounded-full bg-accent" /> : null}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
