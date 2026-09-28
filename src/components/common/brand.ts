/**
 * 제품 이름·부제(task-003h, 사용자 결정 2026-09-28) — 사용자에게 보이는 자리는 전부 여기서 가져간다.
 *
 * 기술 식별자는 바꾸지 않는다: 저장소·도메인·appId `com.miraclepenguin.kaiwa`·딥링크 `thekaiwa://`·쿠키 `thekaiwa_session`·
 * pm2·APK 저장 이름 `thekaiwa-*.apk` 는 그대로(appId 를 바꾸면 다른 앱이 되어 기존 설치 위에 덮어 깔리지 않는다).
 * 안드로이드 런처 이름(`android/app/src/main/res/values/strings.xml` `app_name`)·`capacitor.config.ts` `appName`·
 * `public/manifest.webmanifest`·`public/app-shell/index.html` 은 빌드 밖 자산이라 같은 값을 직접 적는다 — 함께 바꾼다.
 */
export const APP_NAME = 'Lingofy Japanese'
export const APP_TAGLINE = '일본어가 자연스러워지는 AI 회화'
