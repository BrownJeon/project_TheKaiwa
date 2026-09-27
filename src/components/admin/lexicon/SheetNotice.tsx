/** 시트 안 쓰기 실패 알림(screens.md §10-2 D·§10-8 ⓓ) — 확정 버튼 위, `role="alert"`, 보조 버튼 하나(선택). */
export interface SheetNoticeValue {
  text: string
  action?: { label: string; onClick: () => void }
}

export default function SheetNotice({ notice }: { notice: SheetNoticeValue }) {
  return (
    <div role="alert" className="mt-3 rounded-xl border border-bad-soft bg-bad-soft px-3.5 py-2.5 text-[13px] text-bad">
      <p className="break-keep">{notice.text}</p>
      {notice.action ? (
        <button type="button" onClick={notice.action.onClick} className="-mb-2 -ml-1 inline-flex h-11 items-center px-1 font-semibold underline">
          {notice.action.label}
        </button>
      ) : null}
    </div>
  )
}
