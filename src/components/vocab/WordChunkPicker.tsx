'use client'

/**
 * 폼의 조각 고르기(task-068 D5 A · screens.md §28-4 B) — 추가·내 단어 수정 공용. 5유형 라디오 칩(**줄바꿈** — 360 에서도 다섯 개가
 * 다 보인다) + 고른 조각의 뜻 한 줄 + 선생님 초안 안내(`note`).
 *
 * - 라벨은 `<label>` 이 아니라 `span` + `aria-labelledby`(라디오 묶음이라 — 데모 a11y Major 를 고친 방식).
 * - 첫 칩 id = `${idPrefix}_chunkType` — 부모의 `focusField('chunkType')` 가 그대로 첫 칩에 초점을 준다(안 고르고 저장).
 * - 화살표 키 이동(roving tabindex)은 넣지 않는다 — 단어장 조각 칩 줄과 같은 방식(Tab 으로 칩마다).
 */
import { WORD_CHUNK_TYPES, type WordChunkType } from '@/types/vocab'
import { CHUNK_CHIP_LABEL, CHUNK_DEF, CHUNK_FIELD_LABEL, CHUNK_PICK_HINT } from './labels'

/** 단어장 조각 칩(`ChunkChips`)과 같은 칩 — 보이는 36 · 세로로만 44 히트영역. 줄바꿈 줄 사이 `gap-2`(8) = 넘침 4 + 4 라 겹치지 않는다. */
export const PICKER_CHIP =
  "relative h-9 min-w-[44px] flex-none whitespace-nowrap rounded-full border px-3 text-[13px] before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-['']"

export default function WordChunkPicker({
  value,
  error,
  note,
  idPrefix,
  onChange,
}: {
  value: WordChunkType | ''
  error?: string
  /** 선생님 초안이 고른 조각일 때의 안내(「선생님이 고른 조각이에요 · 바꿀 수 있어요」) — 사용자가 바꾸면 부모가 지운다. */
  note?: string | null
  idPrefix: string
  onChange: (v: WordChunkType) => void
}) {
  const p = idPrefix
  const labelId = `${p}_chunkType_label`
  const errId = `${p}_chunkType_err`
  const hintId = `${p}_chunkType_hint`
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span id={labelId} className="text-[12.5px] font-medium text-ink2">
        {CHUNK_FIELD_LABEL}
        <span aria-hidden="true">*</span>
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-required="true"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : hintId}
        className="flex min-w-0 flex-wrap gap-2 py-1"
      >
        {WORD_CHUNK_TYPES.map((t, i) => {
          const on = value === t
          const tone = on ? 'border-accent bg-accent font-semibold text-on-accent' : error ? 'border-bad bg-surface text-ink' : 'border-line bg-surface text-ink'
          return (
            <button key={t} type="button" role="radio" aria-checked={on} id={i === 0 ? `${p}_chunkType` : undefined} onClick={() => onChange(t)} className={`${PICKER_CHIP} ${tone}`}>
              {CHUNK_CHIP_LABEL[t]}
            </button>
          )
        })}
      </div>
      {error ? (
        <p id={errId} role="alert" className="text-[12px] text-bad break-keep">
          {error}
        </p>
      ) : null}
      {value ? (
        <p id={hintId} className="text-[12.5px] text-ink2 break-keep">
          <b className="font-semibold text-ink">{CHUNK_CHIP_LABEL[value]}</b> — {CHUNK_DEF[value].def} <span lang="ja">{CHUNK_DEF[value].ex}</span>
        </p>
      ) : error ? null : (
        <p id={hintId} className="text-[12.5px] text-ink2 break-keep">
          {CHUNK_PICK_HINT}
        </p>
      )}
      {note ? <p className="rounded-xl bg-accent-soft p-2.5 text-[13px] text-ink break-keep">{note}</p> : null}
    </div>
  )
}
