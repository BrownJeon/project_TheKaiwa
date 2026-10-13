'use client'

/**
 * 제목 바꾸기 칸(#30) — ⋯ 메뉴(`ChatMenuSheet`)와 질문 탭 「지난 질문」 시트 행 ⋯ 이 같이 쓴다(task-067 §27-3 A).
 * - `default`(회화·채팅): 옮기기 전 `ChatMenuSheet` rename 본문과 **마크업·동작이 같다**(id 고정·글자 수·안내 줄·Enter·자동 초점 없음 — 시험 T16).
 * - `ask`(질문): 글자 수 「n / 100」 · 안내 줄 · 빈 값/초과 칸 표시 · Enter 저장 · 열리면 입력칸에 초점 · 실패는 데모 원문 하나.
 * 검사는 코드포인트 1~100, 앞뒤 공백을 뺀 값(#30 불변) — 걸리면 요청을 보내지 않는다.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { apiPatch } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import { cpLength } from '@/components/common/format'
import { Btn, BtnRow, Field } from '@/components/common/ui'
import { ASK_COPY } from '@/components/ask/askCopy'
import { actionErrorText } from './labels'

export type RenameVariant = 'default' | 'ask'
export const RENAME_MAX = 100

const INPUT = 'h-11 w-full min-w-0 rounded-xl border bg-surface px-3 text-[16px] text-ink'

export type RenameCheck = { ok: true; title: string } | { ok: false; reason: 'empty' | 'over' }

export function renameCheck(v: string): RenameCheck {
  const t = v.trim()
  const n = cpLength(t)
  if (n < 1) return { ok: false, reason: 'empty' }
  if (n > RENAME_MAX) return { ok: false, reason: 'over' }
  return { ok: true, title: t }
}

function checkText(reason: 'empty' | 'over', variant: RenameVariant): string {
  if (variant === 'ask') return reason === 'empty' ? ASK_COPY.rename.empty : ASK_COPY.rename.over
  return reason === 'empty' ? '제목을 적어 주세요' : '제목은 100자까지 쓸 수 있어요'
}

export type RenameResult = { ok: true; title: string } | { ok: false; error: string; invalid: boolean }

/** 검사 → (통과하면) `onStart` → PATCH #30. 화면 상태와 떨어진 저장 한 번(시험 대상). */
export async function saveRename(o: {
  chatId: string
  value: string
  variant: RenameVariant
  patch: (url: string, body: { title: string }) => Promise<unknown>
  onStart?: () => void
}): Promise<RenameResult> {
  const c = renameCheck(o.value)
  if (!c.ok) return { ok: false, error: checkText(c.reason, o.variant), invalid: true }
  o.onStart?.()
  try {
    await o.patch(`/api/v1/chats/${encodeURIComponent(o.chatId)}`, { title: c.title })
    return { ok: true, title: c.title }
  } catch (e) {
    return { ok: false, error: o.variant === 'ask' ? ASK_COPY.rename.fail : actionErrorText(toErr(e)), invalid: false }
  }
}

/** 저장 중에는 두 번째 저장을 요청으로 만들지 않는다(`null`). 가드를 요청을 만드는 쪽에 두어 시험이 「요청 0」으로 잠근다. */
export async function saveRenameUnlessBusy(busy: boolean, o: Parameters<typeof saveRename>[0]): Promise<RenameResult | null> {
  if (busy) return null
  return saveRename(o)
}

/**
 * 입력이 바뀔 때의 오류 표시. 질문(`ask`)은 빈 값/초과 안내(`invalid`)만 지운다 — 승인 데모는 입력하면 안내 줄·테두리가 처음으로 돌아간다.
 * 저장 실패(`invalid` 아님)는 남기고, 회화·채팅(`default`)은 옮기기 전처럼 그대로 둔다(시험 T16).
 */
export function renameErrorAfterInput(
  variant: RenameVariant,
  cur: { error: string | null; invalid: boolean },
): { error: string | null; invalid: boolean } {
  return variant === 'ask' && cur.invalid ? { error: null, invalid: false } : cur
}

/** [취소] 가 먹는가 — 질문은 저장 중엔 못 취소(§27-3), 회화·채팅은 옮기기 전 `ChatMenuSheet` 처럼 저장 중에도 메뉴로 돌아간다. */
export function renameCancelAllowed(variant: RenameVariant, busy: boolean): boolean {
  return variant === 'default' || !busy
}

/** 칸 그리기만(상태 없음) — 저장 중·오류 마크업을 시험이 직접 그려 본다. */
export function ChatRenameFields({
  variant,
  inputId,
  hintId,
  value,
  error,
  invalid,
  busy,
  inputRef,
  onChange,
  onKeyDown,
  onSave,
  onCancel,
}: {
  variant: RenameVariant
  inputId: string
  hintId: string
  value: string
  error: string | null
  invalid: boolean
  busy: boolean
  inputRef?: React.Ref<HTMLInputElement>
  onChange: (v: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onSave: () => void
  onCancel: () => void
}) {
  const ask = variant === 'ask'
  const n = cpLength(value)
  return (
    <div className="flex flex-col gap-2">
      <Field label="제목" htmlFor={ask ? inputId : 'chatRename'}>
        {ask ? (
          <input
            ref={inputRef}
            id={inputId}
            autoComplete="off"
            enterKeyHint="done"
            aria-describedby={hintId}
            aria-invalid={invalid || undefined}
            readOnly={busy}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            className={`${INPUT} ${invalid ? 'border-bad shadow-[0_0_0_1px_var(--color-bad)]' : 'border-line'}`}
          />
        ) : (
          <input
            id="chatRename"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-[16px] text-ink"
          />
        )}
      </Field>
      {ask ? (
        <>
          <p aria-hidden="true" className={`text-right text-[12px] tabular-nums ${n > RENAME_MAX ? 'font-semibold text-bad' : 'text-ink2'}`}>
            {ASK_COPY.rename.count(n)}
          </p>
          {error ? (
            <p id={hintId} role="alert" className="text-[12.5px] font-semibold text-bad break-keep">
              {error}
            </p>
          ) : (
            <p id={hintId} className="text-[12.5px] text-ink2 break-keep">
              {ASK_COPY.rename.hint}
            </p>
          )}
        </>
      ) : error ? (
        <p role="alert" className="text-[12px] text-bad break-keep">
          {error}
        </p>
      ) : null}
      <BtnRow>
        <Btn onClick={onSave} aria-disabled={busy || undefined} aria-busy={busy || undefined}>
          {busy ? '저장 중…' : '저장'}
        </Btn>
        <Btn variant="ghost" onClick={onCancel} aria-disabled={busy || undefined}>
          취소
        </Btn>
      </BtnRow>
    </div>
  )
}

export default function ChatRenameForm({
  chatId,
  initial,
  variant = 'default',
  onSaved,
  onCancel,
  onBusyChange,
}: {
  chatId: string
  initial: string
  variant?: RenameVariant
  /** 저장 성공(앞뒤 공백을 뺀 제목) — 닫기·토스트·화면 갱신은 부모가 */
  onSaved: (title: string) => void
  onCancel: () => void
  /** 저장 중 — 부모 시트가 바깥·Esc·✕ 로 닫히지 않게(`dismissible={false}`) */
  onBusyChange?: (busy: boolean) => void
}) {
  const ask = variant === 'ask'
  const [value, setValue] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const hintId = useId()

  // 공용 Sheet 는 열릴 때 제목에 초점을 준다 — 같은 커밋에서 옮기면 씻기므로 다음 프레임 뒤에(§26 의 같은 교훈).
  useEffect(() => {
    if (!ask) return
    window.requestAnimationFrame(() => window.setTimeout(() => inputRef.current?.focus(), 0))
  }, [ask])

  const busyTo = (b: boolean) => {
    setBusy(b)
    onBusyChange?.(b)
  }

  const save = async () => {
    const r = await saveRenameUnlessBusy(busy, {
      chatId,
      value,
      variant,
      patch: apiPatch,
      onStart: () => {
        busyTo(true)
        setError(null)
        setInvalid(false)
      },
    })
    if (!r) return
    if (r.ok) {
      busyTo(false)
      onSaved(r.title)
      return
    }
    setError(r.error)
    setInvalid(r.invalid)
    if (!r.invalid) busyTo(false)
  }

  const onInput = (v: string) => {
    setValue(v)
    const next = renameErrorAfterInput(variant, { error, invalid })
    setError(next.error)
    setInvalid(next.invalid)
  }

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
    e.preventDefault()
    void save()
  }

  return (
    <ChatRenameFields
      variant={variant}
      inputId={inputId}
      hintId={hintId}
      value={value}
      error={error}
      invalid={invalid}
      busy={busy}
      inputRef={inputRef}
      onChange={onInput}
      onKeyDown={ask ? onKey : undefined}
      onSave={() => void save()}
      onCancel={() => {
        if (renameCancelAllowed(variant, busy)) onCancel()
      }}
    />
  )
}
