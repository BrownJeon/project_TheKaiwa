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

### REV-024 (2026-09-28, c43a4b8 + b4d2f88)

**판정: PASS** (Critical 0 · High 0 · Medium 0 · Low 1)

대상: `git show --stat c43a4b8 b4d2f88`(20 파일, 표시 문자열·versionCode/Name·brand.ts 정본화·테스트만 — API·DB·권한 로직 무변경). Read 전용 감사 + 독립 재실행(빌드 안 함, 이미 만들어진 산출물 재검증만).

**1. 기술 식별자 무변경 — 확인**
- diff 전수 확인: `capacitor.config.ts`(`appId` 그대로, `appName`만), `android/app/build.gradle`(`applicationId` 줄 무변경, `kaiwaVersionCode/Name`만), `strings.xml`(`package_name`·`custom_url_scheme` 그대로, `app_name`/`title_activity_main`만), `health/route.ts`·`AndroidManifest.xml`(`android:scheme="thekaiwa"`)·쿠키·pm2·`scripts/build-apk.sh`(저장 파일명 `thekaiwa-<versionName>[-<code>].apk` 로직 무변경, 이번 커밋 diff 밖) — 전부 미변경.
- **독립 재검증(aapt2/apksigner, 이미 만들어진 `~/.node-local/thekaiwa-apk/out/thekaiwa-1.0.1-2.apk` 대상, 재빌드 없음)**: `package: name='com.miraclepenguin.kaiwa' versionCode='2' versionName='1.0.1'`, `application-label:'Lingofy Japanese'`(전체 로케일 동일, 옛 이름 0), `launchable-activity label='Lingofy Japanese'`, `debuggable` 라인 0건(꺼짐), `native-code: arm64-v8a`. sha256 `ee8cd0b5b3…dbaccee` 파일 실측과 개발 기록 값 일치. `apksigner verify --print-certs`: 1.0.0/1.0.1 두 APK의 서명 SHA-256 `a4c23dca…9e47` 동일 확인 — appId·서명 동일 + versionCode 1→2 증가로 덮어 설치 가능 조건 충족(실기기 설치 자체는 완료 기준대로 사용자 몫).

**2. 사용자 표시 전면 교체 — 확인**
- `grep -rn "TheKaiwa" src public android/app/src/main capacitor.config.ts` → 12건 전부 코드 주석·경로 문자열·테스트 어서션(브랜드 회귀 테스트가 옛 이름 부재를 검사하는 정규식 자체 포함)뿐, 화면 문자열 0. `일본어교육` 은 `brand.test.ts` 의 부재 검사 정규식 1건뿐. 완료 기준 2 충족.
- `layout.tsx`·로그인 h1·매니페스트·app-shell·strings.xml·capacitor appName·`sttCopy.APP_LABEL`·`AppVersionRow`·`appUpdateCopy`·`persona/loader.ts` 폴백·`apkDownloadName` 전부 diff 확인, 값 일치.

**3. brand.ts 단일 출처 + 6층 경계 — 확인(추가 발견)**
- `grep -rln "components/common/brand" src` → `src/app/layout.tsx`·`src/app/(auth)/login/page.tsx`·`src/components/shell/appUpdateCopy.ts`·`src/components/speech/sttCopy.ts` 4곳뿐. `src/modules/*`(6층 플랫폼) 은 **아무도 brand.ts 를 import 하지 않는다** — `persona/loader.ts` 폴백과 `appRelease.ts` 의 `apkDownloadName` 은 리터럴 문자열을 직접 박아 뒀다. 이는 하위/평행 층(conversation·infra)이 UI 층(components/common)을 참조하는 역방향 import 를 피하기 위한 의도적 선택으로 읽히고(module-dependency 6층 방향 위반 없음), 대신 두 값이 갈라질 위험이 생기는데 `brand.test.ts`(4곳 값 일치 검사)로 그 위험을 막아 뒀다 — 좋은 절충. `brand.test.ts` 가 실제로 불일치를 잡는지: assertion 이 강한 문자열 상수 비교(`assert.equal`/`assert.match`)라 값이 하나라도 어긋나면 실패한다 — **실효성 있음**.

**4. Content-Disposition·apkDownloadName — 확인**
- `NAME = /^\d{1,4}(\.\d{1,4}){0,3}$/`(숫자·점만, 시작/끝 앵커) → `apkDownloadName` 이 이 정규식을 통과 못 하면 번호 없이 `LingofyJapanese.apk` 로 폴백. 따옴표·CRLF·세미콜론 등은 애초에 정규식을 통과할 수 없어 헤더 인젝션 경로 자체가 없다 — `task003h.test.ts` 의 `'1.0.1"; x=y'` 케이스로 회귀 고정. `route.ts` 변경은 `d.fileName`(서버 저장 이름) 대신 `apkDownloadName(d.release)`(표시 이름)로 바꾼 것뿐이고 `resolveReleaseDownload`/`releaseFilePath`(경로 검증)는 무변경 — 다운로드 인가·경로 로직에 영향 없음.

**5. versionCode/Name·네이티브 고지 — 확인**
- `build.gradle`: `kaiwaVersionCode 1→2`, `kaiwaVersionName "1.0.0"→"1.0.1"`, `applicationId`·서명 설정 블록·`debuggable false` 줄은 diff 밖(무변경) 확인. 이력서에 네이티브 변경 고지 있음(`native_change: true`, "네이티브 변경" 절 명시). `--publish` 는 실행하지 않음(개발 기록 명시) — 운영 반영은 deployer 몫으로 남겨 둔 것이 맞다(임의 반영 없음).

**6. 회귀 재실행 — 독립 실행, 개발 보고와 일치**
- `git diff --stat b4d2f88 41e8936`(현재 HEAD, 다음 커밋) → `agent-vault/**` 2 파일만, 소스 동일 확인 후 프로젝트 스크립트로 직접 재실행(스크래치 아카이브는 만들었다가 미사용 확인 후 삭제):
  - `npm run typecheck` exit 0.
  - `npm run lint` → **0 error, 5 warning**(전부 `settings/OnDeviceDiagnosticsCard.tsx`·`SpeechSettings.tsx`·`VoiceSettings.tsx` 의 기존 `react-hooks/set-state-in-effect` — 이번 커밋과 무관한 파일).
  - `npm run test` → **492 tests, pass 491, fail 0, skipped 1** — 개발 기록과 정확히 일치.
- 로그인 h1 360/390/412 두 줄·넘침 0 은 실 Chrome 재실행으로 재검증하지 않았다(정적 분석만 — 44px bold 두 단어 합 폭이 `px-7` 내부 여백을 넘어 `break-keep` 로 줄바꿈되는 것이 CSS 상 타당, dev 보고 수치도 `screen−28px` 산식과 들어맞음). 근거는 타당하나 실기기 재확인은 QA 단계에서 한 번 더 훑을 것.

**7. tutor.md frontmatter description — Leader 판단에 대한 의견**
- `persona/loader.ts:153` 가 `description: c.description`(frontmatter 원문)을 `LoadedPersona.description` 으로 그대로 돌려주고, `claudeCli.ts` 는 이를 `--agents '{"tutor":{description,prompt}}'` JSON 에 실어 CLI 인자로 넘긴다. 다만 TheKaiwa 는 `--tools ""`(도구 전부 비활성 — Agent/Task 류 위임 도구 없음) + `--agent tutor`(메인 스레드를 처음부터 이 페르소나로 강제 실행, 위임 판단 자체가 없음) 조합이라, description 이 모델에게 "고를 대상 목록"으로 노출될 경로가 현재 없다. **Leader 판단(화면 문자열 아님·prompt-engineer 후속)에 동의.** 다만 CLI 동작이 바뀌거나 Admin 진단 화면이 이 값을 노출하게 되면 재검토가 필요하니 LOW 로 남긴다.

**지적사항**
| # | 심각도 | 내용 | 근거 | 권고 |
|---|---|---|---|---|
| 1 | LOW | `.claude/agents/tutor.md` frontmatter `description` 이 여전히 "TheKaiwa 의 …"로 시작 | 위 7항 — 현재 모델 노출 경로 없음, 그러나 값 자체는 옛 이름 | prompt-engineer 후속 작업(다음 tutor.md 갱신 때 같이) — 이번 task 완료 기준과 무관, 재순환 불필요 |

**high_risk_areas (QA 인계)**: 로그인 화면 360/390/412 실기기(또는 실 브라우저) 재확인(h1 두 줄·넘침 0, 특히 갤럭시 S25+ 실기기), 1.0.0 → 1.0.1 실기기 덮어 설치, 안드로이드 설정 → 애플리케이션 목록 이름 "Lingofy Japanese" 육안 확인(`sttCopy.APP_LABEL` 문구와 일치), `/app/download/latest.apk` 실제 curl 로 `Content-Disposition` 확인(dev 보고엔 있었음, 운영 반영 전 재확인 권장), 업데이트 띠/시트 3폭 육안(특히 360 에서 버전 안 잘림).

**native_change**: true (versionCode 1→2, versionName 1.0.1 — `--publish` 는 아직 안 함, deployer 대기)

```json
{ "reviewId": "REV-024", "status": "PASS", "issues": [ { "issue": "tutor.md frontmatter description 에 옛 이름 잔존", "severity": "LOW", "component": ".claude/agents/tutor.md:frontmatter", "risk": "현재는 --tools \"\" + --agent 강제 실행이라 모델 노출 경로 없음, 향후 CLI/진단 화면 변경 시 재검토 필요", "evidence": "persona/loader.ts:153 description 그대로 반환 → claudeCli.ts --agents JSON 인자화, 그러나 위임(Task) 도구 자체가 비활성", "recommendation": "prompt-engineer 다음 tutor.md 갱신 때 description 값 정정(블로킹 아님)" } ], "summary": { "critical": 0, "high": 0, "medium": 0, "low": 1 }, "high_risk_areas": ["로그인 360/390/412 실기기 재확인", "1.0.0→1.0.1 실기기 덮어 설치", "안드로이드 설정 앱 목록 이름 육안 확인", "/app/download/latest.apk Content-Disposition 재확인", "업데이트 띠/시트 3폭 육안"], "native_change": true }
```

## QA 기록

## 최종 요약
