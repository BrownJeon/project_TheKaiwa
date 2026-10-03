/**
 * Capacitor 설정 (설계안 §12, task-003f).
 *
 * ── **앱은 껍데기고 내용물은 서버에 있다** ─────────────────────────────────
 * `server.url` 이 운영 도메인을 가리키므로 WebView 가 **항상 최신 웹**을 로드한다.
 * 그래서 **배포 = 웹 배포**이고, 화면을 고쳤다고 APK 를 다시 만들 필요가 없다.
 * `webDir`(`public/app-shell`) 의 `index.html` 은 `server.errorPath` 로 지정해 **운영 웹을 불러오지 못했을 때만**
 * 보이는 연결 실패 화면으로 쓴다(docs/screens.md §11-2 H — Capacitor 7 `BridgeWebViewClient` 가 메인 프레임 오류 때
 * APK 안 assets 에서 로드한다).
 * **이 파일을 바꾸는 것은 네이티브 변경이다** — APK 재빌드 + `versionCode` 증가(android/app/build.gradle).
 *
 * ── `androidScheme: 'https'` 인 이유 ──────────────────────────────────────
 * 기본값(`http`)이면 WebView 출처가 `http://localhost` 가 되어 **쿠키의 `Secure` 속성과
 * 어긋난다.** 이 앱의 세션은 httpOnly + Secure 쿠키라, 스킴이 https 가 아니면 로그인
 * 상태가 유지되지 않는다.
 *
 * ── 탐색 제한(task-003f C1-4) ─────────────────────────────────────────────
 * `allowNavigation` 을 **두지 않는다.** 그러면 WebView 안에 남는 것은 `server.url` 과 같은 스킴·호스트뿐이고,
 * 다른 호스트로 가는 링크·`target=_blank`·302 는 Capacitor `Bridge.launchIntent` 가 시스템 브라우저로 넘긴다.
 * 플러그인 브리지(`androidBridge`)와 주입 스크립트도 `server.url` origin(+ allowNavigation) 문서의 **메인 프레임**
 * 에만 허용된다(Capacitor 7.6 `MessageHandler`·`addDocumentStartJavaScript` 허용 origin 규칙) — 외부 문서가
 * `window.Capacitor` 로 플러그인을 부를 길이 없다. 호스트를 여기에 더하면 그 호스트도 플러그인을 부를 수 있게 된다.
 *
 * ── 서명·디버깅(task-003f C1-2) ───────────────────────────────────────────
 * Play 스토어에 올리지 않고 **`~/.android/debug.keystore` 로 서명한 release 빌드**를 사이드로드한다(§12).
 * release 는 `debuggable=false` 이고 WebView 원격 디버깅도 끈다(`webContentsDebuggingEnabled:false`) —
 * 사이드로드 APK 라도 chrome://inspect 로 쿠키·화면을 읽을 수 없게.
 */
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.miraclepenguin.kaiwa',
  // 사용자에게 보이는 이름(task-003h). appId·딥링크 스킴·도메인은 기술 식별자라 그대로 둔다(바꾸면 다른 앱이 된다).
  appName: 'Lingofy Japanese',
  webDir: 'public/app-shell',
  // release 빌드에서 플러그인 호출·인식 결과가 logcat 에 남지 않게 한다.
  loggingBehavior: 'none',
  server: {
    // 퓨니코드로 적는다 — 한글 도메인(`kaiwa.미라클펭귄.com`)을 그대로 두면 플랫폼마다
    // 정규화가 달라 WebView 가 못 열거나 "앱 내부 주소" 판정이 어긋난다.
    url: 'https://kaiwa.xn--lh0b87pnudm10a4vd.com',
    androidScheme: 'https',
    // 운영 서버는 정식 인증서를 쓴다 — 평문 트래픽을 허용할 이유가 없다.
    cleartext: false,
    errorPath: 'index.html',
  },
  android: {
    // Android 15(targetSdk 35) edge-to-edge 강제로 WebView 가 상태바·내비게이션바 밑까지 그려지는데, 이 WebView 는
    // CSS `env(safe-area-inset-*)` 를 0 으로 준다 → 'auto' 가 API 35+ 에서 시스템 바·컷아웃만큼 네이티브 margin 을 준다
    // (app-conversion-guide §1-3, VoiceVault·bjj 실기기).
    // ⚠ MainActivity.fitAboveKeyboard(task-021)가 이 'auto'(+ styles.xml opt-out 없음·adjustResize)에 의존해 Capacitor 의 margin 리스너를 교체한다 — 바꾸면 거기도 같이 고친다.
    adjustMarginsForEdgeToEdge: 'auto',
    webContentsDebuggingEnabled: false,
    allowMixedContent: false,
  },
}

export default config
