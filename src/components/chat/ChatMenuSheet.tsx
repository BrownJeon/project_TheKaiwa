'use client'

/**
 * 채팅방 ⋯ 메뉴(screens.md §3-2 C ChatMenuSheet): 제목 바꾸기(#30) · 채팅 삭제(#31, 확인 단계).
 * "읽기 항상 펼치기" 줄은 없앴다(task-026 F1-A — 히라가나·한글·번역은 앱 전체 표시 설정: 방의 표시 바·설정 › 일본어 표시).
 * 회화방(task-007 §9-2 H)은 `chat.kind` 로 문구·삭제 뒤 경로만 바뀌고, `extra` 슬롯에 "들려주는 방식"을 넣는다.
 */
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { apiDelete, apiPatch } from '@/components/common/api'
import Sheet from '@/components/common/Sheet'
import { Btn, BtnRow, Field } from '@/components/common/ui'
import type { ChatInfo } from '@/types/chat'
import { toErr } from '@/components/common/errors'
import { cpLength } from '@/components/common/format'
import { actionErrorText } from './labels'

type Mode = 'menu' | 'rename' | 'confirmDelete'

const ROW = 'flex h-[52px] w-full min-w-0 items-center justify-between gap-3 rounded-xl px-1 text-left text-[15px]'

export default function ChatMenuSheet({
  open,
  chat,
  turnBusy,
  onClose,
  onRenamed,
  onToast,
  extra,
}: {
  open: boolean
  chat: ChatInfo
  turnBusy: boolean
  onClose: () => void
  onRenamed: (title: string) => void
  onToast: (msg: string) => void
  extra?: React.ReactNode
}) {
  const talk = chat.kind === 'TALK'
  const noun = talk ? '회화' : '채팅'
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('menu')
  const [title, setTitle] = useState(chat.title)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    if (busy) return
    setMode('menu')
    setError(null)
    onClose()
  }

  const rename = async () => {
    if (busy) return
    const t = title.trim()
    const n = cpLength(t)
    if (n < 1 || n > 100) {
      setError(n < 1 ? '제목을 적어 주세요' : '제목은 100자까지 쓸 수 있어요')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await apiPatch(`/api/v1/chats/${encodeURIComponent(chat.id)}`, { title: t })
      onRenamed(t)
      setBusy(false)
      setMode('menu')
      onClose()
      onToast('제목을 바꿨어요')
    } catch (e) {
      const err = toErr(e)
      setError(actionErrorText(err))
      setBusy(false)
    }
  }

  const remove = async () => {
    if (busy) return
    if (turnBusy) {
      onToast('답을 받는 중에는 지울 수 없어요')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await apiDelete(`/api/v1/chats/${encodeURIComponent(chat.id)}`)
      router.replace(talk ? '/study/ai?tab=talk' : '/study/ai?tab=chat')
    } catch (e) {
      setError(actionErrorText(toErr(e)))
      setBusy(false)
    }
  }

  const sheetTitle = mode === 'rename' ? '제목 바꾸기' : mode === 'confirmDelete' ? `${noun} 삭제` : `${noun} 메뉴`

  return (
    <Sheet open={open} title={sheetTitle} onClose={close} dismissible={!busy}>
      {mode === 'menu' ? (
        <div className="flex flex-col divide-y divide-line">
          {talk ? <p className="truncate pb-2 text-[15px] font-semibold">{chat.title}</p> : null}
          <button
            type="button"
            className={ROW}
            onClick={() => {
              setTitle(chat.title)
              setError(null)
              setMode('rename')
            }}
          >
            제목 바꾸기 <span aria-hidden="true" className="text-ink2">›</span>
          </button>
          {extra}
          <button
            type="button"
            aria-disabled={turnBusy || undefined}
            className={`${ROW} text-bad ${turnBusy ? 'opacity-50' : ''}`}
            onClick={() => {
              if (turnBusy) onToast('답을 받는 중에는 지울 수 없어요')
              else {
                setError(null)
                setMode('confirmDelete')
              }
            }}
          >
            {noun} 삭제
          </button>
        </div>
      ) : mode === 'rename' ? (
        <div className="flex flex-col gap-2">
          <Field label="제목" htmlFor="chatRename">
            <input
              id="chatRename"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-[16px] text-ink"
            />
          </Field>
          {error ? (
            <p role="alert" className="text-[12px] text-bad break-keep">
              {error}
            </p>
          ) : null}
          <BtnRow>
            <Btn onClick={rename} aria-disabled={busy || undefined} aria-busy={busy || undefined}>
              {busy ? '저장 중…' : '저장'}
            </Btn>
            <Btn variant="ghost" onClick={() => setMode('menu')} aria-disabled={busy || undefined}>
              취소
            </Btn>
          </BtnRow>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-[15px] font-semibold break-keep">{talk ? '이 회화를 삭제할까요?' : '이 채팅을 삭제할까요?'}</p>
          <p className="text-[14px] text-ink2 break-keep">메시지와 교정·제안이 함께 지워져요. 이미 남긴 공부 기록은 그대로 남아요.</p>
          {error ? (
            <p role="alert" className="mt-1 text-[12px] text-bad break-keep">
              {error}
            </p>
          ) : null}
          <BtnRow>
            <Btn variant="danger" onClick={remove} aria-disabled={busy || undefined} aria-busy={busy || undefined}>
              {busy ? '삭제 중…' : '삭제'}
            </Btn>
            <Btn variant="ghost" onClick={() => setMode('menu')} aria-disabled={busy || undefined}>
              취소
            </Btn>
          </BtnRow>
        </div>
      )}
    </Sheet>
  )
}
