'use client'

/**
 * 「쪽으로 이동」 시트(task-068 §28-1 E · J11, 데모 B·jump · B·jumpErr). 쪽 줄 가운데 「n / N」을 누르면 열린다.
 * 숫자 칸 · [처음 쪽] · [마지막 쪽] · [이동]. 잘못된 번호면 칸 아래 안내(`role=alert`)와 함께 칸에 초점이 남고, 고치면 안내가 바로 사라진다.
 * 같은 쪽으로 가면 닫기만 한다(읽지 않음 — 초점은 공용 `Sheet` 가 가운데 단추로 돌려준다).
 * 본문(`WordsJumpBody`)은 상태 없는 부품이라 서버 렌더로 시험한다(공용 `Sheet` 는 포털이라 렌더되지 않는다 — 결정은 `jumpDecision`).
 */
import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react'
import Sheet from '@/components/common/Sheet'
import { Btn, BtnRow } from '@/components/common/ui'
import { WORDS_PAGE_COPY as P } from './labels'
import { INPUT } from './WordForm'
import { jumpDecision, parseJumpPage } from './wordsPaging'

const INPUT_ID = 'wjump'
const ERR_ID = 'wjump_err'

export function WordsJumpBody({
  page,
  pages,
  value,
  error,
  inputRef,
  onValue,
  onSubmit,
  onFirst,
  onLast,
}: {
  page: number
  pages: number
  value: string
  error: boolean
  inputRef?: RefObject<HTMLInputElement | null>
  onValue: (v: string) => void
  onSubmit: () => void
  onFirst: () => void
  onLast: () => void
}) {
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit()
  }
  return (
    <>
      <p className="text-[12.5px] text-ink2">{P.jumpNow(page + 1, pages)}</p>
      <form noValidate onSubmit={submit} className="mt-3 flex min-w-0 flex-col gap-1.5">
        <label htmlFor={INPUT_ID} className="text-[12.5px] font-medium text-ink2">
          {P.jumpLabel}
        </label>
        <input
          id={INPUT_ID}
          ref={inputRef}
          inputMode="numeric"
          enterKeyHint="go"
          autoComplete="off"
          placeholder={P.jumpPlaceholder(pages)}
          value={value}
          onChange={(e) => onValue(e.target.value)}
          aria-invalid={error || undefined}
          aria-describedby={error ? ERR_ID : undefined}
          className={`${INPUT} ${error ? 'border-bad' : 'border-line'}`}
        />
        {error ? (
          <p id={ERR_ID} role="alert" className="text-[12px] text-bad break-keep">
            {P.jumpError(pages)}
          </p>
        ) : null}
      </form>
      <BtnRow>
        <Btn variant="ghost" onClick={onFirst}>
          {P.jumpFirst}
        </Btn>
        <Btn variant="ghost" onClick={onLast}>
          {P.jumpLast}
        </Btn>
      </BtnRow>
      <Btn className="mt-2 w-full" onClick={onSubmit}>
        {P.jumpGo}
      </Btn>
    </>
  )
}

export default function WordsJumpSheet({ page, pages, onClose, onGo }: { page: number; pages: number; onClose: () => void; onGo: (page0: number) => void }) {
  const [v, setV] = useState('')
  const [err, setErr] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // 공용 `Sheet` 가 제목에 초점을 준 **뒤에** 숫자 칸으로(자식 effect 가 시트 effect 보다 먼저 돈다 — WordAddSheet 와 같은 방식).
  useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [])

  const jump = (target: number | null) => {
    const d = jumpDecision(target, page)
    if (d.kind === 'invalid') {
      setErr(true)
      inputRef.current?.focus()
      return
    }
    onClose()
    if (d.kind === 'go') onGo(d.page)
  }

  return (
    <Sheet open title={P.jumpTitle} onClose={onClose}>
      <WordsJumpBody
        page={page}
        pages={pages}
        value={v}
        error={err}
        inputRef={inputRef}
        onValue={(x) => {
          setV(x)
          setErr(false)
        }}
        onSubmit={() => jump(parseJumpPage(v, pages))}
        onFirst={() => jump(0)}
        onLast={() => jump(pages - 1)}
      />
    </Sheet>
  )
}
