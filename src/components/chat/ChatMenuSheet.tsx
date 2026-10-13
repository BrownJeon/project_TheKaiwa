'use client'

/**
 * 채팅방 ⋯ 메뉴(screens.md §3-2 C ChatMenuSheet): 제목 바꾸기(#30) · 채팅 삭제(#31, 확인 단계).
 * "읽기 항상 펼치기" 줄은 없앴다(task-026 F1-A — 히라가나·한글·번역은 앱 전체 표시 설정: 방의 표시 바·설정 › 일본어 표시).
 * 회화방(task-007 §9-2 H)은 `chat.kind` 로 문구·삭제 뒤 경로만 바뀌고, `extra` 슬롯에 "들려주는 방식"을 넣는다.
 * 질문(task-064 §25-5 H → task-066 §26-9)도 `kind === 'ASK'` 로 문구·삭제 실패 한 줄·삭제 뒤 경로(+ 토스트 표지)만 바뀌고,
 * `extraTop` 슬롯(제목 바꾸기 줄 위 — 기본 없음)에 새 질문·보내는 범위·표시·알아듣는 곳을 넣는다.
 * 제목 칸은 공용 `ChatRenameForm`(task-067 §27-3 A — 질문 탭 시트 행 ⋯ 과 같이 씀), `startMode='rename'` 이면 메뉴를 거치지 않고 칸으로 연다(질문 머리 제목 줄).
 */
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { apiDelete } from '@/components/common/api'
import Sheet from '@/components/common/Sheet'
import { Btn, BtnRow } from '@/components/common/ui'
import type { ChatInfo } from '@/types/chat'
import { toErr } from '@/components/common/errors'
import ChatRenameForm from './ChatRenameForm'
import { actionErrorText } from './labels'
import { writeStore } from '@/components/common/storage'
import { ASK_COPY } from '@/components/ask/askCopy'
import { ASK_KEYS } from '@/components/ask/logic'

type Mode = 'menu' | 'rename' | 'confirmDelete'
export type MenuStartMode = 'menu' | 'rename'

/** 제목 칸의 [취소] — 칸으로 바로 열었으면(머리 제목 줄) 시트를 닫고, 메뉴에서 왔으면 메뉴로. */
export function renameCancelTarget(startMode: MenuStartMode | undefined): 'close' | 'menu' {
  return startMode === 'rename' ? 'close' : 'menu'
}

const ROW = 'flex h-[52px] w-full min-w-0 items-center justify-between gap-3 rounded-xl px-1 text-left text-[15px]'

export default function ChatMenuSheet({
  open,
  chat,
  turnBusy,
  onClose,
  onRenamed,
  onToast,
  extra,
  extraTop,
  startMode = 'menu',
}: {
  open: boolean
  chat: ChatInfo
  turnBusy: boolean
  onClose: () => void
  onRenamed: (title: string) => void
  onToast: (msg: string) => void
  extra?: React.ReactNode
  /** 제목 바꾸기 줄 **위**에 놓을 줄(질문 메뉴 1~4 줄, task-066 §26-9). 기본 없음 = 지금 순서. */
  extraTop?: React.ReactNode
  /** 열 때 처음 화면(task-067 §27-3 B). 기본 `menu` = 지금. */
  startMode?: MenuStartMode
}) {
  const talk = chat.kind === 'TALK'
  const ask = chat.kind === 'ASK'
  const noun = ask ? ASK_COPY.menu.noun : talk ? '회화' : '채팅'
  const router = useRouter()
  const [mode, setMode] = useState<Mode>(open ? startMode : 'menu')
  const [seenOpen, setSeenOpen] = useState(open)
  const [busy, setBusy] = useState(false)
  const [renameBusy, setRenameBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 여는 렌더에서 처음 화면을 맞춘다(효과로 하면 한 번 메뉴가 그려진다).
  if (open !== seenOpen) {
    setSeenOpen(open)
    if (open) {
      setMode(startMode)
      setError(null)
    }
  }

  const close = () => {
    if (busy || renameBusy) return
    setMode('menu')
    setError(null)
    onClose()
  }


  const remove = async () => {
    if (busy) return
    if (turnBusy) {
      onToast(ask ? ASK_COPY.menu.deleteBusy : '답을 받는 중에는 지울 수 없어요')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await apiDelete(`/api/v1/chats/${encodeURIComponent(chat.id)}`)
      if (ask) {
        writeStore('session', ASK_KEYS.flash, 'deleted')
        router.replace('/ask')
      } else router.replace(talk ? '/study/ai?tab=talk' : '/study/ai?tab=chat')
    } catch (e) {
      setError(ask ? ASK_COPY.menu.deleteFail : actionErrorText(toErr(e)))
      setBusy(false)
    }
  }

  const removeLabel = ask ? ASK_COPY.menu.delete : `${noun} 삭제`
  const sheetTitle = mode === 'rename' ? '제목 바꾸기' : mode === 'confirmDelete' ? removeLabel : ask ? ASK_COPY.menu.title : `${noun} 메뉴`

  return (
    <Sheet open={open} title={sheetTitle} onClose={close} dismissible={!busy && !renameBusy}>
      {mode === 'menu' ? (
        <div className="flex flex-col divide-y divide-line">
          {talk || ask ? <p className="truncate pb-2 text-[15px] font-semibold">{chat.title}</p> : null}
          {extraTop}
          {ask ? <p className="pt-3 pb-1 text-[12px] font-semibold text-ink2">{ASK_COPY.menu.convHead}</p> : null}
          <button
            type="button"
            className={ROW}
            onClick={() => {
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
              if (turnBusy) onToast(ask ? ASK_COPY.menu.deleteBusy : '답을 받는 중에는 지울 수 없어요')
              else {
                setError(null)
                setMode('confirmDelete')
              }
            }}
          >
            {removeLabel}
          </button>
        </div>
      ) : mode === 'rename' ? (
        <ChatRenameForm
          chatId={chat.id}
          initial={chat.title}
          variant={ask ? 'ask' : 'default'}
          onBusyChange={setRenameBusy}
          onSaved={(t) => {
            onRenamed(t)
            setMode('menu')
            onClose()
            onToast('제목을 바꿨어요')
          }}
          onCancel={() => {
            if (renameCancelTarget(startMode) === 'close') close()
            else setMode('menu')
          }}
        />
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-[15px] font-semibold break-keep">{ask ? ASK_COPY.menu.confirmTitle : talk ? '이 회화를 삭제할까요?' : '이 채팅을 삭제할까요?'}</p>
          <p className="text-[14px] text-ink2 break-keep">
            {ask ? ASK_COPY.menu.confirmBody : '메시지와 교정·제안이 함께 지워져요. 이미 남긴 공부 기록은 그대로 남아요.'}
          </p>
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
