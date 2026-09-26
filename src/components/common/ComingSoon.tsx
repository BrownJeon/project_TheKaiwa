/**
 * Phase 0 자리표시 화면 — 탭 구조·라우팅·인증 가드를 먼저 검증하기 위한 빈 화면이다.
 * 각 기능 task 가 이 컴포넌트를 실제 화면으로 교체한다(설계안 §15). 가로 넘침이 없도록
 * 텍스트는 `break-keep` + 최소폭 0 으로 둔다(360px 검증 대상).
 */
export default function ComingSoon({ title, items, phase }: { title: string; items: string[]; phase: string }) {
  return (
    <section className="mx-4 mb-6 min-w-0 rounded-[var(--radius)] border border-line bg-surface p-4">
      <p className="text-[13px] font-semibold text-accent">{phase}</p>
      <h2 className="mt-1 break-keep text-[17px] font-bold text-ink">{title}</h2>
      <ul className="mt-3 space-y-1.5 text-[14px] leading-6 text-ink2">
        {items.map((it) => (
          <li key={it} className="break-keep">· {it}</li>
        ))}
      </ul>
    </section>
  )
}
