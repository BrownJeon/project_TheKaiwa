'use client'

/**
 * 회화 메뉴의 "교정 방식"(task-010c 결정 c=B) — 설정 → 기본정보·학습의 같은 값(#12 `correctionMode`). "들려주는 방식"처럼 고르면 바로
 * 저장하고 토스트 "다음 말부터 … 방식으로 교정해요". #12 는 보낸 키만 바꾸므로 이 값 하나만 보낸다. 실패면 원래 값으로 되돌린다.
 * 이미 받은(모아 둔) 교정은 그대로다.
 */
import { useEffect, useState } from 'react'
import { apiGet, apiPut } from '@/components/common/api'
import { CORRECTION_MODE_COPY, type CorrectionModeValue } from './talkCopy'

const ROW = 'flex h-[52px] w-full min-w-0 items-center justify-between gap-3 rounded-xl px-1 text-left text-[15px]'
const MODES: CorrectionModeValue[] = ['FLUENCY', 'COACH']

export default function CorrectionModeMenu({ onToast }: { onToast: (msg: string) => void }) {
  const [value, setValue] = useState<CorrectionModeValue | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    apiGet<{ correctionMode?: CorrectionModeValue }>('/api/v1/settings/profile')
      .then((p) => {
        if (alive) setValue(p.correctionMode === 'COACH' ? 'COACH' : 'FLUENCY')
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  const choose = async (mode: CorrectionModeValue) => {
    if (saving || value === null || mode === value) return
    const before = value
    setValue(mode)
    setSaving(true)
    try {
      await apiPut('/api/v1/settings/profile', { correctionMode: mode })
      onToast(CORRECTION_MODE_COPY.saved(CORRECTION_MODE_COPY.name[mode]))
    } catch {
      setValue(before)
      onToast(CORRECTION_MODE_COPY.failed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="py-2">
      <p id="talkCorrectionMode" className="px-1 pb-1 text-[13px] text-ink2">
        {CORRECTION_MODE_COPY.label}
      </p>
      <div role="radiogroup" aria-labelledby="talkCorrectionMode" aria-describedby="talkCorrectionModeDesc" className="flex flex-col">
        {MODES.map((m) => {
          const on = value === m
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={on}
              aria-disabled={saving || value === null || undefined}
              onClick={() => void choose(m)}
              className={`${ROW} ${saving ? 'opacity-60' : ''}`}
            >
              <span className="min-w-0 truncate">{CORRECTION_MODE_COPY.name[m]}</span>
              <span aria-hidden="true" className={`grid h-5 w-5 flex-none place-items-center rounded-full border-2 ${on ? 'border-accent' : 'border-line'}`}>
                {on ? <span className="h-2.5 w-2.5 rounded-full bg-accent" /> : null}
              </span>
            </button>
          )
        })}
      </div>
      {value ? (
        <p id="talkCorrectionModeDesc" className="px-1 pt-1 text-[12px] text-ink2 break-keep">
          {CORRECTION_MODE_COPY.desc[value]}
        </p>
      ) : null}
    </div>
  )
}
