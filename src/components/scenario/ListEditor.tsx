'use client'

/**
 * 글 목록 편집(가이드 §3-H — 대화 순서 2~8 · 성공 조건 1~3 공용). 행 = 번호 원 24 + 자동 높이 입력칸 + ⋯ 44(작은 시트: 위로·아래로·지우기).
 * 개수 한도는 서버 값(`SCENARIO_LIMITS`). 막힌 동작은 native disabled 대신 `aria-disabled` + 이유 한 줄(눌러도 이유가 들리게).
 * 칸 문제는 칸 아래 12px 글 + `aria-invalid`·`aria-describedby`. 초점 id: 행 `dr-<base>-<i>`, 목록 `dr-<base>`.
 */
import { useState } from 'react'
import Sheet from '@/components/common/Sheet'
import { Btn } from '@/components/common/ui'
import { IconDots } from '@/components/plan/parts'
import { DRAFT } from './scenarioCopy'

export interface ListEditorProps {
  base: 'steps' | 'criteria'
  label: string
  items: string[]
  onChange: (next: string[]) => void
  min: number
  max: number
  addLabel: string
  maxNote: string
  minNote: string
  menuLabel: (n: number) => string
  /** 화면 칸 열쇠(`steps`·`steps[2]` …) → 문구. */
  errors: Record<string, string>
  disabled?: boolean
}

export default function ListEditor({ base, label, items, onChange, min, max, addLabel, maxNote, minNote, menuLabel, errors, disabled = false }: ListEditorProps) {
  const [menuAt, setMenuAt] = useState<number | null>(null)
  const listId = `dr-${base}`
  const full = items.length >= max
  const listErr = errors[base]
  const at = menuAt !== null && menuAt < items.length ? menuAt : null

  const add = () => {
    if (full || disabled) return
    onChange([...items, ''])
    const next = `${listId}-${items.length}`
    requestAnimationFrame(() => document.getElementById(next)?.focus())
  }
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
    setMenuAt(null)
  }
  const remove = (i: number) => {
    if (items.length <= min) return
    onChange(items.filter((_, k) => k !== i))
    setMenuAt(null)
  }

  return (
    <fieldset className="min-w-0" disabled={disabled}>
      <legend className="text-[12.5px] font-medium text-ink2">{label}</legend>
      <ol id={listId} tabIndex={-1} aria-describedby={listErr ? `${listId}-err` : undefined} className="mt-1.5 flex flex-col gap-2 outline-none">
        {items.map((v, i) => {
          const fid = `${listId}-${i}`
          const err = errors[`${base}[${i}]`]
          return (
            <li key={i} className="min-w-0">
              <div className="flex min-w-0 items-start gap-2">
                <span aria-hidden="true" className="mt-2.5 grid h-6 w-6 flex-none place-items-center rounded-full bg-surface2 text-[12px] font-semibold text-ink2">
                  {i + 1}
                </span>
                <textarea
                  id={fid}
                  rows={1}
                  value={v}
                  aria-label={`${label} ${i + 1}`}
                  aria-invalid={err ? true : undefined}
                  aria-describedby={err ? `${fid}-err` : undefined}
                  onChange={(e) => onChange(items.map((x, k) => (k === i ? e.target.value : x)))}
                  className={`min-h-11 min-w-0 flex-1 resize-none rounded-xl border bg-surface px-3 py-2.5 text-[16px] leading-snug text-ink [field-sizing:content] ${err ? 'border-bad' : 'border-line'}`}
                />
                <button type="button" aria-label={menuLabel(i + 1)} aria-haspopup="dialog" onClick={() => setMenuAt(i)} className="grid h-11 w-11 flex-none place-items-center rounded-full text-ink2">
                  <IconDots />
                </button>
              </div>
              {err ? (
                <p id={`${fid}-err`} className="mt-1 pl-8 text-[12px] text-bad break-keep">
                  {err}
                </p>
              ) : null}
            </li>
          )
        })}
      </ol>
      {listErr ? (
        <p id={`${listId}-err`} className="mt-1 text-[12px] text-bad break-keep">
          {listErr}
        </p>
      ) : null}
      <button
        type="button"
        aria-disabled={full || undefined}
        aria-describedby={full ? `${listId}-full` : undefined}
        onClick={add}
        className="mt-2 inline-flex h-11 items-center rounded-xl border border-line bg-surface px-3.5 text-[14px] font-semibold aria-disabled:opacity-40"
      >
        {addLabel}
      </button>
      {full ? (
        <p id={`${listId}-full`} className="mt-1 text-[12px] text-ink2">
          {maxNote}
        </p>
      ) : null}

      <Sheet open={at !== null} title={at !== null ? DRAFT.menuTitle(label, at + 1) : label} onClose={() => setMenuAt(null)}>
        {at !== null ? (
          <div className="flex flex-col gap-2 pb-2">
            <Btn variant="ghost" className="w-full aria-disabled:opacity-40" aria-disabled={at === 0 || undefined} onClick={() => move(at, -1)}>
              {DRAFT.moveUp}
            </Btn>
            <Btn variant="ghost" className="w-full aria-disabled:opacity-40" aria-disabled={at === items.length - 1 || undefined} onClick={() => move(at, 1)}>
              {DRAFT.moveDown}
            </Btn>
            <Btn
              variant="danger"
              className="w-full aria-disabled:opacity-40"
              aria-disabled={items.length <= min || undefined}
              aria-describedby={items.length <= min ? `${listId}-min` : undefined}
              onClick={() => remove(at)}
            >
              {DRAFT.remove}
            </Btn>
            {items.length <= min ? (
              <p id={`${listId}-min`} className="text-[12px] text-ink2 break-keep">
                {minNote}
              </p>
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </fieldset>
  )
}
