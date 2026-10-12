'use client'

/**
 * 목록 맨 위 질문 입력 카드(screens.md §25-4 B, 3a = 마이크 없는 모양). 제어 컴포넌트 — 글·보내는 중 상태는 부르는 쪽이 든다.
 * 버튼은 `disabled` 대신 `aria-disabled` — 빈 글에서 눌러도 부르는 쪽이 토스트로 이유를 알린다.
 * 입력창은 한국어 질문이라 `lang` 을 달지 않는다(일본어 글꼴로 한글을 그리지 않게). 글자 수는 코드포인트(`maxLength` 없음).
 */
import { useId } from 'react'
import { cpLength } from '@/components/common/format'
import { ASK_COPY } from './askCopy'
import { askCountLine, isEnterSubmit } from './homeLogic'

export default function AskComposerCard({
  value,
  busy,
  onChange,
  onSubmit,
  onScopeInfo,
  inputRef,
  scopeInfoRef,
}: {
  value: string
  busy: boolean
  onChange: (text: string) => void
  onSubmit: () => void
  onScopeInfo: () => void
  inputRef?: React.Ref<HTMLTextAreaElement>
  scopeInfoRef?: React.Ref<HTMLButtonElement>
}) {
  const id = useId()
  const empty = value.trim() === ''
  const count = askCountLine(cpLength(value))
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className="flex min-w-0 flex-col gap-2 rounded-[14px] border border-line bg-surface p-3"
    >
      <label htmlFor={id} className="text-[15px] font-semibold">
        {ASK_COPY.composerLabel}
      </label>
      <textarea
        id={id}
        ref={inputRef}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (isEnterSubmit({ key: e.key, shiftKey: e.shiftKey, isComposing: e.nativeEvent.isComposing, keyCode: e.keyCode }, window.matchMedia('(pointer: fine)').matches)) {
            e.preventDefault()
            onSubmit()
          }
        }}
        placeholder={ASK_COPY.composerPlaceholder}
        className="block min-h-[76px] w-full min-w-0 resize-none rounded-xl border border-line bg-surface px-3 py-2.5 text-[16px] leading-6 text-ink placeholder:text-ink3 focus:border-accent focus:ring-1 focus:ring-accent"
      />
      {count ? (
        <p aria-live="polite" className={`-mt-1 text-right text-[12px] ${count.over ? 'text-bad' : 'text-ink2'}`}>
          {count.text}
        </p>
      ) : null}
      <div className="flex min-w-0 items-center justify-end gap-2">
        <button
          type="submit"
          aria-disabled={empty || busy || undefined}
          aria-busy={busy || undefined}
          className={`inline-flex h-11 flex-none items-center justify-center whitespace-nowrap rounded-xl bg-accent px-[18px] text-[14.5px] font-semibold text-on-accent${empty ? ' opacity-40' : ''}`}
        >
          {busy ? ASK_COPY.asking : ASK_COPY.ask}
        </button>
      </div>
      <button
        type="button"
        ref={scopeInfoRef}
        onClick={onScopeInfo}
        className="inline-flex min-h-11 items-center gap-1 self-start text-[13px] text-ink2 underline underline-offset-[3px]"
      >
        <span
          aria-hidden="true"
          className="inline-grid h-[18px] w-[18px] flex-none place-items-center rounded-full border-[1.5px] border-current text-[11px] font-bold no-underline"
        >
          i
        </span>
        {ASK_COPY.scopeLink}
      </button>
    </form>
  )
}
