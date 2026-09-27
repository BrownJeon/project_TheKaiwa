'use client'

/** 새 채팅 시트(#28). 제목은 선택, 코드포인트 100자(`maxLength` 대신 — IME 조합·이모지). */
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { apiPost } from '@/components/common/api'
import Sheet from '@/components/common/Sheet'
import { Btn, BtnRow, ErrorBlock, Field } from '@/components/common/ui'
import type { CreatedChat } from '@/types/chat'
import { toErr } from '@/components/common/errors'
import { cpLength } from '@/components/common/format'
import { actionErrorText } from './labels'

export default function NewChatSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const tooLong = cpLength(title.trim()) > 100

  const close = () => {
    if (submitting) return
    setTitle('')
    setFieldError(null)
    setError(null)
    onClose()
  }

  const submit = async () => {
    if (submitting || tooLong) return
    setSubmitting(true)
    setFieldError(null)
    setError(null)
    try {
      const t = title.trim()
      const r = await apiPost<CreatedChat>('/api/v1/chats', t ? { kind: 'CHAT', title: t } : { kind: 'CHAT' })
      router.push(`/study/ai/chat/${encodeURIComponent(r.id)}`)
    } catch (e) {
      const err = toErr(e)
      if (err.status === 400) setFieldError(err.message || actionErrorText(err))
      else setError(actionErrorText(err))
      setSubmitting(false)
    }
  }

  const hint = tooLong ? '제목은 100자까지 쓸 수 있어요' : fieldError

  return (
    <Sheet open={open} title="새 채팅" onClose={close} dismissible={!submitting}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        className="flex flex-col gap-2"
      >
        <Field label="제목 (선택)" htmlFor="chatTitle">
          <input
            id="chatTitle"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setFieldError(null)
            }}
            placeholder="비워 두면 자동으로 정해져요"
            aria-invalid={hint ? true : undefined}
            aria-describedby={hint ? 'chatTitleHint' : undefined}
            className={`h-11 w-full min-w-0 rounded-xl border bg-surface px-3 text-[16px] text-ink placeholder:text-ink3 ${hint ? 'border-bad' : 'border-line'}`}
          />
          {hint ? (
            <p id="chatTitleHint" className="text-[12px] text-bad break-keep">
              {hint}
            </p>
          ) : null}
        </Field>
        {error ? <ErrorBlock message={error} /> : null}
        <BtnRow>
          <Btn type="submit" aria-disabled={submitting || tooLong || undefined} aria-busy={submitting || undefined} className={tooLong ? 'opacity-40' : ''}>
            {submitting ? '만드는 중…' : '시작하기'}
          </Btn>
          <Btn variant="ghost" onClick={close} aria-disabled={submitting || undefined}>
            취소
          </Btn>
        </BtnRow>
      </form>
    </Sheet>
  )
}
