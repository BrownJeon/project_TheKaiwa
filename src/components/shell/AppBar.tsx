import Link from 'next/link'

/**
 * 화면 상단 바. 프로필·설정은 하단 탭이 아니라 **상단 아바타**로 들어간다(설계안 §11). 터치 영역은 44px(아바타 원은 32px).
 */
export default function AppBar({
  title,
  subtitle,
  right,
}: {
  title: string
  subtitle?: string
  right?: React.ReactNode
}) {
  return (
    // `sticky` 인 이유: 앱 셸이 <main> 하나만 스크롤시키고 AppBar 는 각 페이지가 그 안에
    // 렌더한다. 그대로 두면 달력처럼 긴 화면에서 **상단 바가 함께 밀려 올라가** 월 이동
    // 버튼이 사라진다(Phase 1 [dev-ui] 보고). 스크롤 컨테이너 안에서 sticky 는 데모의
    // 고정 앱바와 같은 결과를 주면서 5개 탭 구조를 건드리지 않는다.
    // `mb-2.5`(10px)는 장식이 아니다 — **앱바와 첫 내용 사이가 0px 이었다**(2026-09-13
    // 실기기 피드백: *"상단 바메뉴와 메인화면의 간격이 좀 타이트하다"*). 섹션끼리는
    // `Section` 이 18px 을 띄우는데 앱바 바로 아래만 아무 간격이 없어, 제목과 첫 카드가
    // 붙어 보였다. **각 화면의 `px-4 pb-*` 에 `pt` 를 더하는 방식은 쓰지 않는다** —
    // 그러면 화면 6곳 + 새로 생기는 화면마다 같은 값을 기억해야 한다. 헤더가 자기 아래
    // 여백을 갖는 편이 한 곳에서 끝난다.
    //
    // 스크롤하면 이 여백은 내용과 함께 올라가 헤더 아래로 사라진다(sticky 의 정상 동작).
    <header className="sticky top-0 z-10 mb-2.5 flex h-[52px] flex-none items-center gap-2 bg-surface pl-4 pr-3">
      <h1 className="min-w-0 flex-1 truncate text-xl font-bold">
        {title}
        {subtitle ? <span className="ml-2 text-sm font-light text-ink3">{subtitle}</span> : null}
      </h1>
      {right}
      {/* 기획서 "5. 프로필" 은 하단 탭이 아니라 상단 아바타 → 설정 허브(/settings, 설계안 §11). */}
      <Link
        href="/settings"
        aria-label="설정"
        className="grid h-11 w-11 flex-none place-items-center rounded-full"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-good text-[13px] font-semibold text-white">나</span>
      </Link>
    </header>
  )
}
