'use client'

/**
 * 목록 필터(screens.md §10-2 C): 검색(300ms 디바운스, IME 조합 중에는 보내지 않는다) · 범위 칩 · (VOICE) 목소리 · (COURSE·LESSON·USER) 대상 id
 * (500ms 디바운스) · 꺼진 항목 포함. 값은 URL 쿼리에 남는다(부모가 `router.replace`).
 */
import { useEffect, useRef, useState } from 'react'
import type { AdminVoiceDto } from '@/types/admin'
import { LEXICON_SCOPES } from '@/types/lexicon'
import { ChipRadio, type ChipOption, ToggleButton } from '../console/ChipRadio'
import type { LexiconParams, LexiconScopeFilter } from './lexiconParams'
import { REF_NAME } from './lexiconCopy'
import { INPUT } from './lexiconStyles'

const SCOPE_OPTIONS: ChipOption<LexiconScopeFilter>[] = [
  { value: 'ALL', label: '모든 범위' },
  ...LEXICON_SCOPES.map((s) => ({ value: s, label: s, mono: true })),
]

/** 입력 칸 값을 늦게 올려 보낸다. 부모 값이 바깥에서 바뀌면(뒤로 가기·필터 초기화) 칸도 따라간다. */
function useDebounced(value: string, delay: number, onCommit: (v: string) => void) {
  const [draft, setDraft] = useState(value)
  const [seen, setSeen] = useState(value)
  const composing = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const commitRef = useRef(onCommit)
  useEffect(() => {
    commitRef.current = onCommit
  }, [onCommit])
  if (value !== seen) {
    setSeen(value)
    setDraft(value)
  }
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])
  const schedule = (v: string) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      if (!composing.current) commitRef.current(v.trim())
    }, delay)
  }
  return {
    value: draft,
    onChange: (v: string) => {
      setDraft(v)
      schedule(v)
    },
    onCompositionStart: () => {
      composing.current = true
    },
    onCompositionEnd: (v: string) => {
      composing.current = false
      schedule(v)
    },
  }
}

export default function LexiconFilters({
  params,
  voices,
  onChange,
}: {
  params: LexiconParams
  voices: readonly AdminVoiceDto[]
  onChange: (patch: Partial<LexiconParams>) => void
}) {
  const q = useDebounced(params.q, 300, (v) => {
    if (v !== params.q) onChange({ q: Array.from(v).slice(0, 40).join('') })
  })
  const ref = useDebounced(params.ref, 500, (v) => {
    const clean = /^[\w-]{0,40}$/.test(v) ? v : ''
    if (clean !== params.ref) onChange({ ref: clean })
  })
  const scope = params.scope

  return (
    <div className="@container mt-3 min-w-0">
      <div className="flex min-w-0 flex-col gap-2 @min-[720px]:flex-row @min-[720px]:items-center @min-[720px]:justify-between">
        <input
          type="search"
          aria-label="표기·읽기 검색"
          placeholder="표기·읽기 검색 (예: 日本橋, ニホン)"
          enterKeyHint="search"
          lang="ja"
          value={q.value}
          onChange={(e) => q.onChange(e.target.value)}
          onCompositionStart={q.onCompositionStart}
          onCompositionEnd={(e) => q.onCompositionEnd(e.currentTarget.value)}
          className={`${INPUT} @min-[720px]:max-w-[360px]`}
        />
        <div className="flex items-center gap-2">
          <ToggleButton pressed={params.inactive} onToggle={() => onChange({ inactive: !params.inactive })}>
            꺼진 항목 포함
          </ToggleButton>
        </div>
      </div>
      <div className="mt-2">
        <ChipRadio ariaLabel="범위" options={SCOPE_OPTIONS} value={scope} onChange={(v) => onChange({ scope: v })} />
      </div>
      {scope === 'VOICE' ? (
        <select aria-label="목소리" value={params.ref} onChange={(e) => onChange({ ref: e.target.value })} className={`${INPUT} mt-2`}>
          <option value="">모든 목소리</option>
          {voices.map((v) => (
            <option key={v.id} value={v.id}>
              {v.displayName}
            </option>
          ))}
        </select>
      ) : null}
      {scope === 'COURSE' || scope === 'LESSON' || scope === 'USER' ? (
        <input
          aria-label={`${REF_NAME[scope]} (선택)`}
          placeholder="대상 id (선택)"
          autoCapitalize="off"
          autoComplete="off"
          spellCheck={false}
          value={ref.value}
          onChange={(e) => ref.onChange(e.target.value)}
          className={`${INPUT} mt-2 font-mono`}
        />
      ) : null}
    </div>
  )
}
