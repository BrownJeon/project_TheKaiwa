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

- [12:46] **구현(표의 모든 자리)**: 이름·부제 정본 = 새 `src/components/common/brand.ts`(`APP_NAME` "Lingofy Japanese"·`APP_TAGLINE`). 로그인 h1 "Lingofy **Japanese**"(강조색, `break-keep` — 360/390/412 에서 두 줄, 단어 사이에서만 줄바꿈) + 소개 1줄째 부제(semibold ink)·2줄째 "AI 선생님과 회화 · 교정 · 단어 · 평가" · `layout.tsx` title/description/appleWebApp · `manifest.webmanifest` name·short_name "Lingofy Japanese"·description 부제 · `app-shell/index.html` title·로고 "Lingofy **Japanese**"+부제 · `strings.xml` app_name·title_activity_main · `capacitor.config.ts` appName · `sttCopy.APP_LABEL = APP_NAME` · `appUpdateCopy`(아래) · `AppVersionRow` 왼쪽 "Lingofy Japanese v{mine}" + 12px 부제, 오른쪽 "최신"/"새 버전 {x} ›"/"업데이트 필요 ›" · 받는 파일 이름 `apkDownloadName()` = `LingofyJapanese-{versionName}.apk`(infra appRelease, versionName 형식이 다르면 번호 없이 — 헤더 주입 방지, 저장 이름 `thekaiwa-*.apk` 그대로) · persona 폴백 "Lingofy Japanese 일본어 선생님" · **versionCode 2 / versionName 1.0.1**. 기술 식별자(appId·패키지·`thekaiwa://`·쿠키·pm2·도메인·저장소·APK 저장 이름) 변경 0.
- [12:46] **업데이트 띠 문구(표와 다르게 한 것)**: 권장 띠 제목은 `truncate` 한 줄이라 "Lingofy Japanese 새 버전이 있어요 · v1.1.0" 을 넣으면 360 폭에서 버전이 말줄임으로 잘린다 → 제목 **"Lingofy Japanese v{latest}"**, 둘째 줄 "새 버전이 나왔어요 · 눌러서 설치 방법 보기". 강제 띠 "Lingofy Japanese를 업데이트해 주세요", 시트 제목 "Lingofy Japanese 업데이트".
- [12:46] **검증**: tsc 0 · lint 0 error(경고 5 = 기존) · test **492(491 pass·1 skip 기존)** — 새 `brand.test.ts`(이름·부제 값, 빌드 밖 자산 4곳 = strings.xml·capacitor·manifest·app-shell 이 같은 이름이고 옛 이름 0, appId·applicationId·`thekaiwa` 스킴 그대로·versionCode 2/1.0.1, 띠·시트·버전 줄 문구) + `infra/__tests__/task003h.test.ts`(받는 파일 이름·따옴표 주입 방지) · **격리 build exit 0**(`~/.node-local/thekaiwa-buildcheck-003h` 에 미러 사본 + `npm install` + `NODE_ENV=production next build`, 끝나고 그 사본 디렉터리는 치움 — 미러 `.next` 무접촉) · grep: `src`·`public`·`android/app/src/main`·`capacitor.config.ts` 에 남은 "TheKaiwa" 는 **코드 주석 10건뿐**(어댑터·auth 주석·MainActivity 주석 — 사용자에게 안 보임), "일본어교육" 0.
- [12:46] **실 Chrome 확인**(`~/node_modules/playwright-core` 1.58.2 + `/usr/bin/google-chrome`, 미러 `next dev -H 127.0.0.1 -p 3011`, 저장소 밖 임시 스크립트) **31/31 PASS**: 로그아웃 로그인 360/390/412 — h1 "Lingofy Japanese" 2줄·"Japanese" 강조색 rgb(200,71,31)·h1 오른쪽 끝 332/362/384px(화면 안)·가로 넘침 0·부제·탭 제목·옛 이름 0 / 웹 설정(가짜 없음) 앱 버전 줄·띠 DOM 0 / 앱 모드(`tests/live/fake-capacitor.js` + `/api/app/version` 가짜 1.1.0) 3폭 — 권장 띠 "Lingofy Japanese v1.1.0" 제목 말줄임 없음·넘침 0, 시트 dialog 이름 "Lingofy Japanese 업데이트", 설정 버전 줄 "Lingofy Japanese v1.0.0"+부제+"새 버전 1.1.0 ›"·넘침 0 / 앱 360 로그인 강제 띠 "Lingofy Japanese를 업데이트해 주세요"·넘침 0 / 연결 실패 화면 360(file://) 제목·로고·부제·넘침 0. `curl -I /app/download/latest.apk`(dev, 운영 AppRelease v1) → `content-disposition: attachment; filename="LingofyJapanese-1.0.0.apk"`, manifest 응답 name "Lingofy Japanese". dev 서버는 PID 로 종료, 3011~3019 비어 있음 확인(3010 = pm2 운영), QA 쿠키 파일 폐기.
- [12:46] **APK**(`bash scripts/build-apk.sh --test`, rc=0, **`--publish` 안 함**): 플러그인 단위 67/67 · `~/.node-local/thekaiwa-apk/out/thekaiwa-1.0.1-2.apk` **35,216,069 B** · **sha256 `ee8cd0b5b30d132d419c1f2ae260e812d810ddbf3059070792a3f76c1dbaccee`** · `aapt2 dump badging`: `package: name='com.miraclepenguin.kaiwa' versionCode='2' versionName='1.0.1'`, **`application-label:'Lingofy Japanese'`**, launchable-activity label 'Lingofy Japanese', debuggable 없음, native-code arm64-v8a · 서명 SHA-256 `a4c23dca…9e47`(1.0.0 과 같은 키 → 덮어 설치 가능) · assets `capacitor.config.json` appName·`public/index.html` title·부제 확인.
- [12:46] **문서**: `CLAUDE.md` 머리에 제품 이름·부제 한 줄(기술 식별자 그대로 명시, 정본 brand.ts) · `docs/screens.md` §11-11 ⑤ 결정 갱신 + §11-2 G(띠·시트·앱 버전 줄)·H(연결 실패 화면)·§11-8 ⓗⓙ 문구·변경 이력.
- **QA 인계(내 파일 아님 — tests/live)**: `tests/live/task003f-ui-e2e.mjs` 기대 문구가 바뀜 → `'새 앱 버전이 있어요 · v1.1.0'` → `'Lingofy Japanese v1.1.0'`(버튼 이름 정규식도), dialog `'앱 업데이트'` → `'Lingofy Japanese 업데이트'`, `'1.0.0 · 새 버전 1.1.0 ›'` → `'새 버전 1.1.0 ›'`(줄 제목 `'Lingofy Japanese v1.0.0'`), `'앱을 업데이트해 주세요'` → `'Lingofy Japanese를 업데이트해 주세요'`, 웹 DOM 0 검사의 `'앱 버전'` 포함 여부 → `'Lingofy Japanese v'` 로. `fake-capacitor.js` 의 `App.getInfo().name:'TheKaiwa'` 는 화면에 안 쓰이지만 실제 앱 값은 이제 'Lingofy Japanese'.
- **Leader 확인 1건**: `.claude/agents/tutor.md` frontmatter description 이 "TheKaiwa 의 …" 로 시작한다(런타임 `--agents` 설명·persona description 원천). 화면 문자열은 아니지만 LLM 이 앱 이름을 말할 때 옛 이름을 쓸 여지 — prompt-engineer 영역이라 손대지 않음.

- [12:48] **e2e 기대 문구 갱신(Leader 후속 지시)**: `tests/live/task003f-ui-e2e.mjs` — 권장 띠 `'Lingofy Japanese v1.1.0'`+`'새 버전이 나왔어요'`(버튼 이름 정규식 `/Lingofy Japanese v1\.1\.0/`), 시트 dialog `'Lingofy Japanese 업데이트'`, 설정 버전 줄 `'Lingofy Japanese v1.0.0'` + `[data-app-version-row]` 에 `'새 버전 1.1.0 ›'`, 강제 띠 `'Lingofy Japanese를 업데이트해 주세요'`, 웹 DOM 0 검사 `'앱 버전'` → `'Lingofy Japanese v'`. `tests/live/fake-capacitor.js` `App.getInfo().name` → 'Lingofy Japanese'(실제 앱 값과 같게). **실행**: 미러 `SPEECH_MODELS_DIR=<repo>/speech/models next dev -H 127.0.0.1 -p 3011` + QA 쿠키(`QA_ACCOUNT=1`·`admin`) + `NODE_PATH=$HOME/node_modules node --env-file=.env --import tsx tests/live/task003f-ui-e2e.mjs --base http://127.0.0.1:3011 --user … --admin …` → **77/77 PASS**(rc 0, 직전에 같은 계정으로 다른 라이브 테스트 없음). 끝나고 dev 서버 PID 종료(자식 없음)·3011~3019 비어 있음 확인·쿠키 2개 폐기.

## Reviewer 기록

## QA 기록

## 최종 요약
