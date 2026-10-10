'use client'

/**
 * 단어 폼(추가·수정 공용, screens.md §4-2 B WordForm). 카운터·출처·보관은 폼에 없다(읽기 전용).
 * 길이는 코드포인트로 검사하고 `maxLength` 는 쓰지 않는다(IME 조합 중 잘림). 오류는 입력 아래 12px `bad` + `aria-invalid`/`aria-describedby`.
 * 입력 id 는 `${idPrefix}_${field}` — 부모가 첫 오류 필드로 포커스를 옮길 때 쓴다.
 */
import { useLayoutEffect, useRef } from 'react'
import type { WordField, WordFormValues } from './validate'
import { JLPT_LEVELS, levelLabel, POS_OPTIONS } from './labels'

export const INPUT = 'h-11 w-full min-w-0 rounded-xl border bg-surface px-3 text-[16px] text-ink placeholder:text-ink3'

/** 5줄까지 늘어나고 그 뒤로는 안에서 스크롤(16px × 1.5 × 5 + 위아래 패딩·테두리). */
const TEXTAREA_MAX_PX = 142

function AutoTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const h = Math.min(el.scrollHeight + 2, TEXTAREA_MAX_PX)
    el.style.height = `${h}px`
    el.style.overflowY = el.scrollHeight + 2 > TEXTAREA_MAX_PX ? 'auto' : 'hidden'
  }, [props.value])
  return <textarea ref={ref} rows={2} {...props} />
}

function Label({ htmlFor, text, required }: { htmlFor: string; text: string; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="text-[12.5px] font-medium text-ink2">
      {text}
      {required ? <span aria-hidden="true">*</span> : null}
    </label>
  )
}

function ErrorLine({ id, text }: { id: string; text: string | undefined }) {
  if (!text) return null
  return (
    <p id={id} className="text-[12px] text-bad break-keep">
      {text}
    </p>
  )
}

export default function WordForm({
  values,
  errors,
  onChange,
  categories,
  expandExtras,
  onToggleExtras,
  idPrefix,
  surfaceNote,
}: {
  values: WordFormValues
  errors: Partial<Record<WordField, string>>
  onChange: <K extends keyof WordFormValues>(field: K, v: WordFormValues[K]) => void
  categories: readonly string[]
  expandExtras: boolean
  onToggleExtras: () => void
  idPrefix: string
  /** 표현 아래 추가 안내(중복 409 → [그 단어 보기]) */
  surfaceNote?: React.ReactNode
}) {
  const id = (f: WordField) => `${idPrefix}_${f}`
  const errId = (f: WordField) => `${idPrefix}_${f}_err`
  const invalid = (f: WordField) => (errors[f] ? { 'aria-invalid': true as const, 'aria-describedby': errId(f) } : {})
  const border = (f: WordField) => (errors[f] ? 'border-bad' : 'border-line')
  const listId = `${idPrefix}_categories`

  const text = (f: 'surface' | 'reading' | 'meaning' | 'category', label: string, opts: { ja?: boolean; placeholder?: string; required?: boolean } = {}) => (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id(f)} text={label} required={opts.required} />
      <input
        id={id(f)}
        lang={opts.ja ? 'ja' : undefined}
        value={values[f]}
        placeholder={opts.placeholder}
        aria-required={opts.required || undefined}
        list={f === 'category' ? listId : undefined}
        autoComplete="off"
        onChange={(e) => onChange(f, e.target.value)}
        {...invalid(f)}
        className={`${INPUT} ${border(f)}`}
      />
      <ErrorLine id={errId(f)} text={errors[f]} />
      {f === 'surface' ? surfaceNote : null}
    </div>
  )

  const area = (f: 'example' | 'exampleKo' | 'note', label: string, opts: { ja?: boolean; placeholder?: string } = {}) => (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id(f)} text={label} />
      <AutoTextarea
        id={id(f)}
        lang={opts.ja ? 'ja' : undefined}
        value={values[f]}
        placeholder={opts.placeholder}
        onChange={(e) => onChange(f, e.target.value)}
        {...invalid(f)}
        className={`w-full min-w-0 resize-none rounded-xl border bg-surface px-3 py-2.5 text-[16px] leading-normal text-ink placeholder:text-ink3 ${border(f)}`}
      />
      <ErrorLine id={errId(f)} text={errors[f]} />
    </div>
  )

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {text('surface', '표현', { ja: true, required: true })}
      {text('reading', '읽기', { ja: true, placeholder: '히라가나 (선택)' })}
      {text('meaning', '뜻', { placeholder: '한국어 뜻 (예: 영화)', required: true })}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={id('partOfSpeech')} text="품사" />
          <select
            id={id('partOfSpeech')}
            value={values.partOfSpeech}
            onChange={(e) => onChange('partOfSpeech', e.target.value as WordFormValues['partOfSpeech'])}
            className={`${INPUT} border-line`}
          >
            {POS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={id('jlpt')} text="수준" />
          <select
            id={id('jlpt')}
            value={values.jlpt}
            onChange={(e) => onChange('jlpt', e.target.value as WordFormValues['jlpt'])}
            className={`${INPUT} border-line`}
          >
            <option value="">선택 안 함</option>
            {JLPT_LEVELS.map((l) => (
              <option key={l} value={l}>
                {levelLabel(l)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {text('category', '분류', { placeholder: '예: 일상, 여행 (선택)' })}
      <datalist id={listId}>
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <button
        type="button"
        aria-expanded={expandExtras}
        aria-controls={expandExtras ? `${idPrefix}_extras` : undefined}
        onClick={onToggleExtras}
        className="flex min-h-[44px] items-center gap-1 self-start text-[14px] font-medium text-ink"
      >
        예문·메모 더 쓰기
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className={expandExtras ? 'rotate-180' : ''}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {/* 접힌 동안은 그리지 않는다 — 숨긴 textarea 는 높이를 잴 수 없어 펼쳤을 때 2px 로 남는다. 값은 폼 상태에 그대로 있다. */}
      {expandExtras ? (
        <div id={`${idPrefix}_extras`} className="flex min-w-0 flex-col gap-3">
          {area('example', '예문', { ja: true })}
          {area('exampleKo', '예문 뜻')}
          {area('note', '메모', { placeholder: '외우는 요령 등 (선택)' })}
        </div>
      ) : null}
    </div>
  )
}
