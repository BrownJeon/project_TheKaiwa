import AppUpdateBanner from '@/components/shell/AppUpdateBanner'
import AttendancePing from '@/components/shell/AttendancePing'
import NativeFlag from '@/components/shell/NativeFlag'
import TabBar from '@/components/shell/TabBar'

/**
 * 앱 셸 — 화면당 세로 스크롤은 **한 곳(main)** 뿐이다(모바일 UI 원칙).
 * 높이는 `100dvh`(globals.css), 최상위 그리드는 `minmax(0,1fr)` 로 잡아 min-content
 * 아래로도 줄어들게 한다 — `1fr` 로 두면 긴 요소 하나가 페이지 전체를 뷰포트보다
 * 넓게 만들어 오른쪽이 잘린다(데모에서 실기기로 재현·수정, mobile-viewport-checklist).
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-app-shell
      className="grid h-[100dvh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-surface"
      style={{
        // ── 상태바(시계·배터리) 아래로 화면이 파고드는 것을 여기서 막는다 ──────────
        //
        // 증상(2026-09-13 실기기 APK): 홈 화면의 `오늘 9월 13일 일` 이 `SKT 5:18` 위에
        // 겹쳐 그려졌다. 웹 브라우저에서는 브라우저 UI 가 위에 있어 드러나지 않던 것이,
        // **`targetSdk 35`(Android 15)가 edge-to-edge 를 강제**하면서 WebView 가 상태바
        // 아래까지 차지해 나타났다.
        //
        // **스크롤 컨테이너가 아니라 그 바깥에 넣는 이유**: `<main>` 에 padding 을 주면
        // `position: sticky; top: 0` 인 헤더 8곳이 **패딩 박스 기준**으로 붙어 결국 다시
        // 상태바 아래로 들어간다(스크롤하면 그 자리로 올라온다). 바깥 상자를 줄이면
        // 스크롤 영역 자체가 상태바 아래에서 시작하므로 **각 화면이 아무것도 안 해도 된다.**
        // 헤더를 8곳 각각 고치는 방식은 새 화면이 생길 때마다 또 빠뜨린다.
        //
        // `box-sizing: border-box`(Tailwind preflight)라 `h-[100dvh]` 는 그대로 유지되고
        // 안쪽 높이만 인셋만큼 줄어든다 — 하단 탭이 화면 밖으로 밀리지 않는다.
        //
        // `bg-surface` 는 그렇게 비워진 상태바 자리를 **앱바와 같은 색**으로 채운다.
        // 비워 두면 `--ground` 가 비쳐 색이 한 줄 달라 보인다.
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <NativeFlag />
      <AttendancePing />
      {/* APK 업데이트 띠(screens §11-2 G). 감싼 div 는 늘 있어 그리드 첫 행을 지킨다 — 띠가 null 일 때 main 이 auto 행으로
          밀려 올라가 스크롤 한 곳 규칙이 깨지지 않게(웹·해당 없음이면 높이 0). 그리는 것이 없는 위 둘은 DOM 이 없어 행을 차지하지 않는다. */}
      <div className="min-w-0">
        <AppUpdateBanner />
      </div>
      <main className="min-h-0 min-w-0 overflow-y-auto bg-ground">{children}</main>
      <TabBar />
    </div>
  )
}
