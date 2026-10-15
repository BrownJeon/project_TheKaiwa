'use client'

/**
 * 단어 폼(추가·수정 공용, screens.md §4-2 B WordForm). 카운터·출처·보관은 폼에 없다(읽기 전용).
 * 길이는 코드포인트로 검사하고 `maxLength` 는 쓰지 않는다(IME 조합 중 잘림). 오류는 입력 아래 12px `bad` + `aria-invalid`/`aria-describedby`.
 * 입력 id 는 `${idPrefix}_${field}` — 부모가 첫 오류 필드로 포커스를 옮길 때 쓴다.
 * task-068(§28-4 A): 「수준」 칸을 지우고 조각을 꼭 고른다(`WordChunkPicker`) — 칸 순서 표현·읽기·뜻·품사·조각·분류·[예문·메모].
 * task-069: `mic` 를 주면 일본어 칸 표현·예문에 「말로 쓰기」가 붙는다(추가 시트만). 안 주면 지금 DOM 그대로 — 수정 시트에는 마이크가 없다.
 */
import { useLayoutEffect, useRef } from 'react'
import type { WordField, WordFormValues } from './validate'
import { POS_OPTIONS } from './labels'
import WordChunkPicker from './WordChunkPicker'
import WordMicField from './WordMicField'
import type { WordMic, WordMicTarget } from './wordMic'

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
  surfaceNoteId,
  chunkNote,
  mic,
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
  /** `surfaceNote` 의 id — 주면 표현 칸이 빨간 테두리 + `aria-invalid`·`aria-describedby` 로 그 안내를 가리킨다(중복 409, §28-4 E). */
  surfaceNoteId?: string
  /** 조각 칸 아래 선생님 초안 안내(§28-4 D) */
  chunkNote?: string | null
  /** 말로 쓰기(추가 시트만, task-069) — 표현·예문 칸에만 붙는다. 없으면(수정 시트) 마이크가 없다. */
  mic?: WordMic
}) {
  const id = (f: WordField) => `${idPrefix}_${f}`
  const errId = (f: WordField) => `${idPrefix}_${f}_err`
  const noted = (f: WordField) => f === 'surface' && !errors[f] && !!surfaceNoteId
  const invalid = (f: WordField) =>
    errors[f] ? { 'aria-invalid': true as const, 'aria-describedby': errId(f) } : noted(f) ? { 'aria-invalid': true as const, 'aria-describedby': surfaceNoteId } : {}
  const border = (f: WordField) => (errors[f] || noted(f) ? 'border-bad' : 'border-line')
  const listId = `${idPrefix}_categories`

  /** 마이크를 붙이는 칸이면 라벨 줄에 전환 버튼 + 말로 쓰는 동안 입력 칸 자리에 누르고 말하기. 아니면 라벨·입력 그대로. */
  const withMic = (target: WordMicTarget | undefined, label: React.ReactNode, input: React.ReactNode) =>
    mic && target ? (
      <WordMicField mic={mic} target={target} idPrefix={idPrefix} value={values[target]} label={label}>
        {input}
      </WordMicField>
    ) : (
      <>
        {label}
        {input}
      </>
    )

  const text = (
    f: 'surface' | 'reading' | 'meaning' | 'category',
    label: string,
    opts: { ja?: boolean; placeholder?: string; required?: boolean; mic?: 'surface' } = {},
  ) => (
    <div className="flex min-w-0 flex-col gap-1.5">
      {withMic(
        opts.mic,
        <Label htmlFor={id(f)} text={label} required={opts.required} />,
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
        />,
      )}
      <ErrorLine id={errId(f)} text={errors[f]} />
      {f === 'surface' ? surfaceNote : null}
    </div>
  )

  const area = (f: 'example' | 'exampleKo' | 'note', label: string, opts: { ja?: boolean; placeholder?: string; mic?: 'example' } = {}) => (
    <div className="flex min-w-0 flex-col gap-1.5">
      {withMic(
        opts.mic,
        <Label htmlFor={id(f)} text={label} />,
        <AutoTextarea
          id={id(f)}
          lang={opts.ja ? 'ja' : undefined}
          value={values[f]}
          placeholder={opts.placeholder}
          onChange={(e) => onChange(f, e.target.value)}
          {...invalid(f)}
          className={`w-full min-w-0 resize-none rounded-xl border bg-surface px-3 py-2.5 text-[16px] leading-normal text-ink placeholder:text-ink3 ${border(f)}`}
        />,
      )}
      <ErrorLine id={errId(f)} text={errors[f]} />
    </div>
  )

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {text('surface', '표현', { ja: true, required: true, mic: 'surface' })}
      {text('reading', '읽기', { ja: true, placeholder: '히라가나 (선택)' })}
      {text('meaning', '뜻', { placeholder: '한국어 뜻 (예: 영화)', required: true })}
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
      <WordChunkPicker value={values.chunkType} error={errors.chunkType} note={chunkNote} idPrefix={idPrefix} onChange={(v) => onChange('chunkType', v)} />
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
          {area('example', '예문', { ja: true, mic: 'example' })}
          {area('exampleKo', '예문 뜻')}
          {area('note', '메모', { placeholder: '외우는 요령 등 (선택)' })}
        </div>
      ) : null}
    </div>
  )
}
