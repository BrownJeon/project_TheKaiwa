---
task_id: task-003h
title: "앱 이름 Lingofy Japanese · 부제 「일본어가 자연스러워지는 AI 회화」 적용 (웹 + 앱 1.0.1)"
status: in-progress
base_ref: 360a404
risk_level: R1
roles_involved: [leader, developer, reviewer, qa]
related_tasks: [task-003f-android-ondevice-stt]
native_change: true
tags:
  - type/task
  - domain/app
  - domain/ui
aliases:
  - 앱 이름 변경
  - Lingofy Japanese
created: 2026-09-28
updated: 2026-09-28
---

## 목표 (Leader)
사용자 지시(2026-09-28): **앱 이름은 "Lingofy Japanese", 부제는 "일본어가 자연스러워지는 AI 회화"** — 위치에 알맞게 바꾸고 앱 안에서의 이름으로도 쓴다. 기술 식별자(저장소·도메인 `kaiwa.미라클펭귄.com`·appId `com.miraclepenguin.kaiwa`·패키지·딥링크 `thekaiwa://`·쿠키 `thekaiwa_session`·pm2·DB·로그 키)는 **바꾸지 않는다**(appId 를 바꾸면 다른 앱이 되어 1.0.0 위에 덮어 설치가 안 된다).

## 관련 과거 이력 요약
- [[task-003f-android-ondevice-stt]]: 앱 1.0.0(versionCode 1) 배포본·AppRelease v1, §11-11 ⑤ 에서 앱 이름을 임시로 "TheKaiwa" 로 정했음(`APP_LABEL`·`strings.xml`·capacitor `appName`). 아이콘은 말풍선 「あ」(098dd0d) — 유지.

## Leader's Plan — 자리별 적용 (정본: 이 표)
| 자리 | 파일 | 바꿀 값 |
|---|---|---|
| 로그인 로고·소개 | `src/app/(auth)/login/page.tsx` | h1 = `Lingofy` + 강조색 `Japanese`(360/390/412 에서 한 줄에 안 들어가면 두 줄 — 가로 넘침 0), 소개 1줄째 = **일본어가 자연스러워지는 AI 회화**, 2줄째 = `AI 선생님과 회화 · 교정 · 단어 · 평가` |
| 브라우저 탭·메타 | `src/app/layout.tsx` | `title` "Lingofy Japanese", `description` "일본어가 자연스러워지는 AI 회화 — AI 일본어 선생님과 매일 회화·교정·단어·평가", `appleWebApp.title` "Lingofy Japanese" |
| 웹 앱 매니페스트 | `public/manifest.webmanifest` | `name` "Lingofy Japanese", `short_name` "Lingofy Japanese", `description` = 부제 |
| 오프라인 화면(APK 포함) | `public/app-shell/index.html` | `<title>`·로고 "Lingofy Japanese" + 부제 한 줄 |
| 안드로이드 런처·작업 이름 | `android/app/src/main/res/values/strings.xml`(`app_name`·`title_activity_main`), `capacitor.config.ts` `appName` | "Lingofy Japanese" |
| 권한 안내 문구의 앱 이름 | `src/components/speech/sttCopy.ts` `APP_LABEL` | "Lingofy Japanese"(안드로이드 설정 목록 이름 = `app_name` 과 같아야 함) |
| 설정 앱 버전 줄(앱에서만) | 설정 앱 버전 줄 컴포넌트 | "Lingofy Japanese v{버전}" + 아래 작은 글씨 부제 |
| 업데이트 띠·시트 | `src/components/shell/appUpdateCopy.ts` | "Lingofy Japanese 새 버전이 있어요 · v{x}" 류로(길이·3폭 확인) |
| 설치본 받은 파일 이름 | `src/app/app/download/[file]/route.ts`(Content-Disposition) | `LingofyJapanese-{versionName}.apk`(저장 파일 이름 `thekaiwa-*.apk` 규약은 유지) |
| 페르소나 기본 설명(내부) | `src/modules/conversation/persona/loader.ts` 폴백 문자열 | "Lingofy Japanese 일본어 선생님" |
| 문서 | `CLAUDE.md`(TheKaiwa) 머리·`docs/screens.md` §11-11 ⑤ 결정 갱신 | 제품 이름·부제 한 줄(기술 식별자는 TheKaiwa 유지 명시) |

- **네이티브 변경** — `strings.xml`·`capacitor.config.ts`·app-shell 이 APK 에 들어간다 → **versionCode 2 / versionName 1.0.1**, `build-apk.sh --test` 후 `--publish`, AppRelease v2(minSupported 1 — 1.0.0 도 계속 동작, 권장 업데이트 띠만).
- 엔진명 비노출·화면당 가로 넘침 0·터치 44px 규칙 그대로.

## 완료 기준
1. tsc·lint·test 통과, 격리 build exit 0, APK `--test` 성공(versionCode 2·debuggable no·런처 이름 "Lingofy Japanese" — `aapt2 dump badging` 의 `application-label`).
2. 위 표의 모든 자리에서 사용자에게 보이는 "TheKaiwa"/"일본어교육" 0(기술 식별자 제외), 로그인 화면 360/390/412 넘침 0.
3. 1.0.0 위에 1.0.1 덮어 설치 가능(같은 appId·서명, versionCode 증가) — 실기기 확인은 사용자.

## 판단 기록 (judge)
- (소규모 표시 변경 — judge·Codex 생략, Leader 판단: 보안·데이터 경로 변경 없음, R1)

## Developer 기록

## Reviewer 기록

## QA 기록

## 최종 요약
