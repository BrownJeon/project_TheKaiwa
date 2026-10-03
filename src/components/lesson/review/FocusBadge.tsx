/**
 * ● 집중 뱃지(screens §14-5) — 홈 요약·① 항목·② 칩·다음 복습 묶음 공용. 색만으로 구분하지 않게 늘 글자("집중 …")를 함께 둔다.
 * 공용 `Badge` 톤 표는 건드리지 않는다(§14-10). `accent-soft` 위 글자는 `ink`, `accent` 는 점·테두리(비텍스트)만.
 */
export function FocusBadge({ children, small = false }: { children: React.ReactNode; small?: boolean }) {
  return (
    <span
      className={`inline-flex flex-none items-center gap-1 rounded-md bg-accent-soft px-2 text-[11.5px] font-semibold text-ink ring-1 ring-accent ring-inset ${
        small ? 'h-5' : 'h-[22px]'
      }`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 flex-none rounded-full bg-accent" />
      {children}
    </span>
  )
}

/** 칩 앞 7px 점 + 화면 읽기용 "집중, ". */
export function FocusDot({ srLabel }: { srLabel: string }) {
  return (
    <>
      <span aria-hidden="true" className="h-[7px] w-[7px] flex-none rounded-full bg-accent" />
      <span className="sr-only">{srLabel}</span>
    </>
  )
}
