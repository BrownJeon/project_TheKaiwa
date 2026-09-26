/**
 * Capacitor 설정 (설계안 §12).
 *
 * ── **앱은 껍데기고 내용물은 서버에 있다** ─────────────────────────────────
 * `server.url` 이 운영 도메인을 가리키므로 WebView 가 **항상 최신 웹**을 로드한다.
 * 그래서 **배포 = 웹 배포**이고, 화면을 고쳤다고 APK 를 다시 만들 필요가 없다.
 * `webDir` 는 Capacitor 가 요구해서 두는 자리표시일 뿐이다(`public/app-shell`) —
 * 서버에 닿지 못했을 때만 잠깐 보인다.
 *
 * ── `androidScheme: 'https'` 인 이유 ──────────────────────────────────────
 * 기본값(`http`)이면 WebView 출처가 `http://localhost` 가 되어 **쿠키의 `Secure` 속성과
 * 어긋난다.** 이 앱의 세션은 httpOnly + Secure 쿠키라, 스킴이 https 가 아니면 로그인
 * 상태가 유지되지 않는다.
 *
 * ── 서명 ──────────────────────────────────────────────────────────────────
 * Play 스토어에 올리지 않고 **디버그 서명 APK 를 사이드로드**한다(§12). 릴리스 키스토어를
 * 만들 이유가 없고, 만들면 그 파일을 어디에 둘지가 새 문제가 된다.
 */
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.miraclepenguin.kaiwa',
  appName: 'TheKaiwa',
  webDir: 'public/app-shell',
  server: {
    // 퓨니코드로 적는다 — 한글 도메인(`kaiwa.미라클펭귄.com`)을 그대로 두면 플랫폼마다
    // 정규화가 달라 WebView 가 못 여는 경우가 있다.
    url: 'https://kaiwa.xn--lh0b87pnudm10a4vd.com',
    androidScheme: 'https',
    // 운영 서버는 정식 인증서를 쓴다 — 평문 트래픽을 허용할 이유가 없다.
    cleartext: false,
  },
  android: {
    // 디버그 서명 APK 를 사이드로드하는 전제(§12).
    buildOptions: {},
  },
}

export default config
