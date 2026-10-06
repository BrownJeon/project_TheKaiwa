'use client'

/**
 * 핵심 표현 편집(가이드 §3-H). 행 = 일본어(`JaText`+`HangulLine`, 앱 표시 설정 그대로) + 뜻 + ⋯ 44(고치기·지우기).
 * [＋ 표현 더하기]·[고치기] 는 행 자리에 입력 2칸 [일본어][뜻] + [넣기|바꾸기][취소]. 일본어를 바꾸면 저장된 읽기는 버린다(어긋난 읽기를 남기지 않게).
 * 필수 표현 수는 서버 규칙이라 화면에서 바꾸지 않고 문구로만 보인다. 개수 한도는 서버 값. 초점 id: 행 `dr-expr-<i>`, 목록 `dr-expr`.
 * 폼·메뉴는 행 순번이 아니라 행 키(`logic.withRowKeys`)를 가리킨다 — 폼을 연 채 다른 행을 지워도 고치던 행이 바뀌지 않고, 그 행이 사라지면 폼을 닫는다.
 */
import { useMemo, useRef, useState } from 'react'
import Sheet from '@/components/common/Sheet'
import { Btn } from '@/components/common/ui'
import { HangulLine, JaText } from '@/components/common/japanese/JapaneseText'
import { useAnnotations } from '@/components/common/japanese/annotations'
import { IconDots } from '@/components/plan/parts'
import { SCENARIO_LIMITS as L } from '@/types/scenario'
import {
  addExpression,
  editExpression,
  editingAfterRemove,
  editingTarget,
  newRowKey,
  NEW_EXPRESSION,
  oneLine,
  removeExpression,
  requiredOf,
  withRowKeys,
  type DraftExpression,
  type ExpressionEditing,
} from './logic'
import { DRAFT } from './scenarioCopy'

const inputCls = 'h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-[16px] text-ink'

function ExprForm({ init, applyLabel, onApply, onCancel }: { init: { ja: string; ko: string }; applyLabel: string; onApply: (v: { ja: string; ko: string }) => void; onCancel: () => void }) {
  const [ja, setJa] = useState(init.ja)
  const [ko, setKo] = useState(init.ko)
  const ready = !!oneLine(ja) && !!oneLine(ko)
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl bg-surface2 p-2.5">
      <input lang="ja" autoFocus aria-label={DRAFT.exprJa} placeholder={DRAFT.exprJa} value={ja} onChange={(e) => setJa(e.target.value)} className={inputCls} />
      <input aria-label={DRAFT.exprKo} placeholder={DRAFT.exprKo} value={ko} onChange={(e) => setKo(e.target.value)} className={inputCls} />
      <div className="flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
        <Btn size="sm" className="h-11 aria-disabled:opacity-40" aria-disabled={!ready || undefined} onClick={() => ready && onApply({ ja, ko })}>
          {applyLabel}
        </Btn>
        <Btn size="sm" variant="ghost" className="h-11" onClick={onCancel}>
          {DRAFT.cancel}
        </Btn>
      </div>
    </div>
  )
}

export default function ExpressionEditor({
  items,
  onChange,
  errors,
  storedRequired,
  disabled = false,
}: {
  items: DraftExpression[]
  onChange: (next: DraftExpression[]) => void
  errors: Record<string, string>
  storedRequired: number | null
  disabled?: boolean
}) {
  const rows = useMemo(() => withRowKeys(items), [items])
  const [editingState, setEditing] = useState<ExpressionEditing>(null)
  const [menuKey, setMenuKey] = useState<string | null>(null)
  // 이 편집기가 준 새 행 키의 다음 수 — 지운 행의 키를 다시 쓰지 않아 닫힌 폼이 새 행에 되살아나지 않는다.
  const seq = useRef(0)
  const editing = editingTarget(rows, editingState)
  // 행이 밖에서 사라진 폼 상태는 바로 비운다(같은 키가 다시 나타나도 폼이 되살아나지 않게).
  if (editingState !== null && editing === null) setEditing(null)
  const ann = useAnnotations(rows.map((e) => e.ja))
  const full = rows.length >= L.expressionsMax
  const listErr = errors.expr
  const atIndex = menuKey === null ? -1 : rows.findIndex((e) => e.rowKey === menuKey)
  const at = atIndex >= 0 ? rows[atIndex] : null
  const m = requiredOf(rows.length, storedRequired)

  const apply = (target: string, v: { ja: string; ko: string }) => {
    if (target === NEW_EXPRESSION) {
      const key = newRowKey(rows, seq.current)
      seq.current = Number(key.slice(1)) + 1
      onChange(addExpression(rows, v, key))
    } else {
      const next = editExpression(rows, target, v)
      if (next !== rows) onChange(next)
    }
    setEditing(null)
  }
  const remove = (key: string) => {
    const next = removeExpression(rows, key)
    if (next === rows) return
    onChange(next)
    setEditing((cur) => editingAfterRemove(cur, key))
    setMenuKey(null)
  }

  return (
    <fieldset className="min-w-0" disabled={disabled}>
      <legend className="text-[12.5px] font-medium text-ink2">{DRAFT.fExpressions}</legend>
      <ul id="dr-expr" tabIndex={-1} aria-describedby={listErr ? 'dr-expr-err' : undefined} className="mt-1 outline-none">
        {rows.map((e, i) => {
          const err = errors[`expr[${i}]`]
          return (
            <li key={e.rowKey} id={`dr-expr-${i}`} tabIndex={-1} className="min-w-0 border-t border-line py-2 outline-none first:border-t-0" aria-describedby={err ? `dr-expr-${i}-err` : undefined}>
              {editing === e.rowKey ? (
                <ExprForm init={{ ja: e.ja, ko: e.ko }} applyLabel={DRAFT.exprApply} onApply={(v) => apply(e.rowKey, v)} onCancel={() => setEditing(null)} />
              ) : (
                <div className="flex min-w-0 items-start gap-2">
                  <div className="min-w-0 flex-1">
                    {e.ja ? <JaText text={e.ja} state={ann[i]} className="text-[16px] [overflow-wrap:anywhere]" rt={11} leading={2.1} /> : null}
                    <HangulLine state={ann[i]} size={12} />
                    <p className="text-[13px] text-ink2 break-keep">{e.ko}</p>
                  </div>
                  <button type="button" aria-label={DRAFT.exprMenu(i + 1)} aria-haspopup="dialog" onClick={() => setMenuKey(e.rowKey)} className="grid h-11 w-11 flex-none place-items-center rounded-full text-ink2">
                    <IconDots />
                  </button>
                </div>
              )}
              {err ? (
                <p id={`dr-expr-${i}-err`} className="mt-1 text-[12px] text-bad break-keep">
                  {err}
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>
      {listErr ? (
        <p id="dr-expr-err" className="mt-1 text-[12px] text-bad break-keep">
          {listErr}
        </p>
      ) : null}
      {editing === NEW_EXPRESSION ? (
        <div className="mt-2">
          <ExprForm init={{ ja: '', ko: '' }} applyLabel={DRAFT.exprInsert} onApply={(v) => apply(NEW_EXPRESSION, v)} onCancel={() => setEditing(null)} />
        </div>
      ) : (
        <button
          type="button"
          aria-disabled={full || undefined}
          aria-describedby={full ? 'dr-expr-full' : undefined}
          onClick={() => !full && setEditing(NEW_EXPRESSION)}
          className="mt-2 inline-flex h-11 items-center rounded-xl border border-line bg-surface px-3.5 text-[14px] font-semibold aria-disabled:opacity-40"
        >
          {DRAFT.exprAdd}
        </button>
      )}
      {full ? (
        <p id="dr-expr-full" className="mt-1 text-[12px] text-ink2">
          {DRAFT.exprMax}
        </p>
      ) : null}
      {rows.length ? <p className="mt-1 text-[12px] text-ink2 break-keep">{DRAFT.exprNote(m)}</p> : null}

      <Sheet open={at !== null} title={at !== null ? DRAFT.menuTitle(DRAFT.fExpressions, atIndex + 1) : DRAFT.fExpressions} onClose={() => setMenuKey(null)}>
        {at !== null ? (
          <div className="flex flex-col gap-2 pb-2">
            <Btn
              variant="ghost"
              className="w-full"
              onClick={() => {
                setEditing(at.rowKey)
                setMenuKey(null)
              }}
            >
              {DRAFT.exprEdit}
            </Btn>
            <Btn
              variant="danger"
              className="w-full aria-disabled:opacity-40"
              aria-disabled={rows.length <= L.expressionsMin || undefined}
              aria-describedby={rows.length <= L.expressionsMin ? 'dr-expr-min' : undefined}
              onClick={() => remove(at.rowKey)}
            >
              {DRAFT.remove}
            </Btn>
            {rows.length <= L.expressionsMin ? (
              <p id="dr-expr-min" className="text-[12px] text-ink2 break-keep">
                {DRAFT.exprMin}
              </p>
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </fieldset>
  )
}
