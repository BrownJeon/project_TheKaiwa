'use client'

/**
 * 교정 카드의 접이식 "시험 문법" 줄(task-039 데모 v1 — D2-A 늘 접힘 · D3-A 이름 · D4-A 회화방에도 같은 줄). 채팅 표현 점검·회화방
 * 카드·모아 둔 교정 시트가 이 한 컴포넌트를 `CorrectionCard` 를 통해 같이 쓴다.
 *  - 값이 없으면(null·빈 문자열·공백뿐 — 옛 교정 포함) 줄 자체를 그리지 않는다.
 *  - 글은 서버가 정리해 보낸 그대로 그린다(자르기·다시 거르기 없음). 「…」 조각과 「」 밖 일본어 구간(「〜たら(N4): 동사 た형+ら」 의 〜たら·た·ら)에
 *    `lang="ja"`(REV-115 M-1 — 실제 출력은 문형 머리말이 「」 밖에 있다). 히라가나·한글 없음(§15-1 F). 일본어 조각의 `word-break:normal` 은 상자 클래스가 맡는다(개발 메모 ③).
 *  - 펼침 상태는 카드 로컬 — 서버·저장소에 남기지 않아 다시 들어오면 접혀 있다.
 *  - 펼칠 때 회화방 목록이 바닥으로 따라가 누른 줄을 밀지 않게 따라가기를 한 번 멈추고(`FollowHoldContext`), 펼친 상자가 화면 밖이면
 *    가장 가까운 만큼만 스크롤한다(개발 메모 ⑧). 재생·녹음 상태는 건드리지 않는다.
 */
import { useContext, useEffect, useRef, useState, type Ref } from 'react'
import { JaRuns } from '@/components/common/japanese/JaRuns'
import { FollowHoldContext } from './followHold'
import { EXTRA_NOTE_LABEL } from './labels'

/** 그릴 글이 있는가 — 공백뿐인 값도 "없음"으로 본다(글 자체는 바꾸지 않는다). */
export function hasExtraNote(text: string | null | undefined): text is string {
  return typeof text === 'string' && text.trim().length > 0
}

/** 펼친 상자 id — 버튼 `aria-controls` 가 가리킨다. 카드 id(`cr_{id}`)와 같은 규칙이라 한 화면에서 겹치지 않는다. */
export const extraNoteBoxId = (correctionId: string) => `cr_${correctionId}_xn`

/** 모양만(상태 없음) — 접힘·펼침 두 모양을 단위 테스트가 그대로 그려 본다. */
export function ExtraNoteView({
  boxId,
  text,
  open,
  describedBy,
  onToggle,
  wrapRef,
}: {
  boxId: string
  text: string
  open: boolean
  describedBy?: string
  onToggle?: () => void
  wrapRef?: Ref<HTMLDivElement>
}) {
  return (
    <div ref={wrapRef} className="mt-0.5 min-w-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={boxId}
        aria-describedby={describedBy}
        onClick={onToggle}
        className="flex min-h-11 w-full min-w-0 items-center gap-1 rounded-[10px] px-0.5 text-left text-[13px] font-semibold text-ink2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span>{open ? EXTRA_NOTE_LABEL.less : EXTRA_NOTE_LABEL.more}</span>
        <span aria-hidden="true" className="text-[12px]">
          {open ? '▴' : '▾'}
        </span>
      </button>
      <div
        id={boxId}
        hidden={!open}
        className="mb-1.5 ml-0.5 min-w-0 border-l-2 border-line py-0.5 pl-3 text-[14px] leading-[1.6] text-ink2 break-keep [overflow-wrap:anywhere] motion-safe:animate-[extra-note-in_160ms_ease-out] [&_[lang=ja]]:[word-break:normal]"
      >
        <p>
          <JaRuns text={text} />
        </p>
      </div>
    </div>
  )
}

export default function ExtraNoteLine({
  correctionId,
  text,
  describedBy,
}: {
  correctionId: string
  text: string | null | undefined
  /** 같은 이름의 버튼이 한 화면에 여럿일 때(표현 점검) 어느 카드의 줄인지 알려 줄 머리줄 id. */
  describedBy?: string
}) {
  const [open, setOpen] = useState(false)
  const hold = useContext(FollowHoldContext)
  const wrapRef = useRef<HTMLDivElement>(null)
  const revealRef = useRef(false)

  useEffect(() => {
    if (!open || !revealRef.current) return
    revealRef.current = false
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    wrapRef.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
  }, [open])

  if (!hasExtraNote(text)) return null

  const toggle = () => {
    if (!open) {
      hold?.()
      revealRef.current = true
    }
    setOpen((v) => !v)
  }

  return <ExtraNoteView boxId={extraNoteBoxId(correctionId)} text={text} open={open} describedBy={describedBy} onToggle={toggle} wrapRef={wrapRef} />
}
