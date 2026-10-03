---
task_id: task-021
title: "개선 — 키보드가 입력창을 가리는 문제 공통 수정 (IMP-0008)"
status: doing
base_ref: 055dbcf
risk_level: R1
roles_involved: [leader, judge, developer, reviewer, qa, deployer]
related_tasks: [task-007-talk-voice-web, task-010-today-lesson, task-006-chat-correction, task-003f-android-ondevice-stt]
tags:
  - type/task
  - domain/improvement
  - domain/ui
aliases:
  - 키보드 입력창 가림
  - task-021
created: 2026-09-30
updated: 2026-10-01
demo_gate:
  required: true
  level: "delta"
  status: "approved"
  version: 1
  repo_path: "docs/demo/task-021-improve-keyboard-inset-v1.html"
  artifact_url: "https://claude.ai/artifact/63bJb9WYeKjddPgKDbds1h"
  content_sha256: "8cc701cce1832b89bf1c8548d968dac61f96c322385da475ef5e1751fffa0371"
  decided_by: "judge"
  rule_id: "JV-ui_change"
  approved_by: "user"
  approved_at: "2026-10-01T08:17:28+09:00"
  approval_quote: "대기 중인 데모 전부 권고안대로 승인"
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: true
---

## 목표 (Leader)
개선 백로그 [[IMP-0008-키보드-입력창-가림]] — 키보드가 올라오면 입력창이 가려져 무엇을 입력하는지 볼 수 없다. **입력창이 있는 모든 화면**에서 같은 방식으로 해결한다(화면별 땜질 금지, 공통 해법).

## 사용자 결정
- 사용자 원문 그대로 진행(앱 내 입력창 전체 공통). 순서는 Leader 권고안(P1) 채택.

## 포함 항목
- [[IMP-0008-키보드-입력창-가림]] (P1, M)

## 현황 (착수 시점 Leader 재확인)
- 이미 있음: 루트 `interactiveWidget: 'resizes-content'`(`layout.tsx`), Manifest `adjustResize`, `useKeyboardInset`+`--kb-inset` 은 `ChatRoom`·`TalkRoom`(텍스트 모드)·`LessonScreen`(5단계)에만 적용.
- 빠진 곳: `Sheet.tsx` 바텀시트 계열(`WordAddSheet`·`NewChatSheet`·`AcceptCorrectionSheet`·`ChatMenuSheet` 등), `LessonPasteScreen`·`StageApply`·`StageUnderstand` 메모 입력, 설정 입력(`VoiceSettings`·`LearningSettings`).
- 미확정: 사용자가 재현한 화면(회화방 텍스트 모드)에서도 왜 안 먹는지 — targetSdk 35 edge-to-edge 에서 `adjustResize` 만으로 창이 안 줄 수 있다는 Manifest 주석이 있다. **원인은 웹 뷰포트 경로(웹 Chrome)와 앱 WebView 경로가 다를 수 있다.**

## 범위·진행 순서
1. **원인 확인** — 웹(Chrome)과 앱(WebView)에서 키보드가 뜰 때 `visualViewport`·`window.innerHeight`·안전 영역 값이 어떻게 변하는지 조사. 데스크톱 브라우저 에뮬레이션은 논리 검증까지만이고 **실기기(사용자 S25+) 확인이 최종 게이트**다.
2. **웹 전용 공통 해법 우선** — `useKeyboardInset` 을 앱 셸 수준으로 끌어올려(전역 `--kb-inset`) 바텀시트·입력 화면이 같은 값으로 입력창을 키보드 위에 유지. 시트는 열린 입력창이 가려지지 않게 스크롤/오프셋.
3. **네이티브가 필요하다고 확인될 때만** Manifest·Capacitor 설정(`capacitor.config.ts`)·플러그인 변경 — 이 경우 **`versionCode` 증가·APK 재빌드·업데이트 안내(deployer)** 가 따르고 사용자 재설치가 필요하다. 그 시점에 사용자에게 알리고 진행한다(웹으로 충분하면 웹 배포만).

## 비범위
- 화면 레이아웃 재설계, 입력창 위치 이동, 음성 입력 경로 변경.

## 완료 기준
- 입력창이 있는 모든 화면 목록(시트 포함)을 표로 만들어 각각 "키보드가 떠도 입력 중인 줄이 보임"을 확인(웹 360/390/412 에뮬레이션 + 사용자 실기기 웹·앱 재확인 요청).
- `tsc`·`eslint`·단위 테스트 0 fail. 네이티브 변경이 있으면 versionCode·고지 완비.
- **사용자 폰 확인은 QA 가 대신할 수 없다** — 배포 후 사용자 확인 항목으로 남긴다(F6 과 함께).

## 판단 기록 (judge)

### 2026-09-30 접수 판정 (engine=jev, dev-judge@0.2.0/dev-rules@0.4.0, fallback=None)
- 유형 None · 복잡도 1.92 · 위험 R1 · developer 모델 **opus** · needs_info false
- 권장 역할: (판정 없음 — Leader 지정)
- 데모: **delta** (required=true, rule=JV-ui_change) · 다음 = `demo_first` · 막힌 관문 demo
- 규칙 오버라이드: developer_model=opus(MD-judge-failed-opus)
- 비고: 판정 도구가 역할 목록을 내지 못해(`MD-judge-failed-opus`) developer 를 opus 로 올렸다. 역할은 Leader 가 designer → developer → reviewer → qa 로 지정.

## Designer 기록

- [22:40] delta 데모 v1 작성 — `docs/demo/task-021-improve-keyboard-inset-v1.html` (`check.mjs lint --expect task-021-v1` → DEMO_LINT_PASSED, 토큰 `src/app/globals.css@sha256:22f382529f92`). Artifact 게시·검토 요청은 Leader.
  - 구성: 공통 규칙 R1~R7 · 입력 화면 유형 6개(회화방 텍스트[사용자 재현] · 채팅방 · 시트 입력[새 채팅/단어 추가/교정 채택] · 단어장 검색 · 설정 폼 · 수업 메모·긴 글) × 3칸(키보드 없음 = 현재·제안 동일 / 키보드 있음 현재 / 키보드 있음 제안) + "직접 눌러 보기"(칸을 누르면 모의 키보드 올라옴, ⌄ 로 내림) · 폭 360/390/412 · 높이 780/892 · 모의 키보드 높이 280/320/360(임의 값) · 입력창 있는 화면 전체 목록 17행(지금 보정 여부·적용 규칙) · 하단 결정 패널.
  - 핵심 설계 결정: ① 키보드가 없을 때 화면은 그대로(구조·입력창 위치·음성 경로 불변) ② 키보드 높이는 앱 셸 한 곳에서 재고 전 화면이 같은 값(R1) ③ 하단 입력 바는 키보드 바로 위, 목록은 맨 아래 유지, 제스처 바 여백 제거(R2) ④ 시트는 통째로 키보드 위, 최대 높이 = 남은 높이 85%, 시트 안쪽만 스크롤해 입력 칸 아래 16px 여유(R4) ⑤ 스크롤 폼은 입력 칸(여러 줄이면 커서 줄)이 키보드 위 16px 이상에 오도록 1회 스크롤(R5) ⑥ 위쪽 입력(검색)은 제자리, 목록 끝만 키보드 위(R6) ⑦ 토스트도 키보드 위, 닫히면 원위치·스크롤 유지(R7).
  - "현재" 열은 사용자 재현(키보드가 덮고 화면이 줄지 않음)을 같은 원인으로 다른 화면에 적용해 그린 것 — 웹 Chrome 에서 채팅방은 이미 제안처럼 동작할 수 있음을 데모에 명시(환경별 확정은 개발 원인 조사).
  - 결정 필요 A/B: **D1 키보드가 열려 있을 때 하단 탭** — A 숨김(디자이너 의견) / B 키보드 위로 따라 올라감. **D2 시트 안 입력 중 주 버튼** — A 제자리(시트 내용 끝, 디자이너 의견) / B 키보드 위 고정(비범위 "레이아웃 재설계"에 걸침).
  - 확인: 하단 탭 라벨은 현행 '단어장'(task-020) 반영. 목소리 설정은 슬라이더뿐이라 키보드 대상 아님(목록에 "확인만").

## Developer 기록

- [08:40] 데모 게이트 `DEMO_GATE_PASSED`(task-021 · approved v1 · hash verified) 확인 후 착수. 구현 기준 = 데모 v1 + 사용자 결정 D1 A(키보드 동안 하단 탭 숨김)·D2 A(시트 주 버튼 제자리).
- [08:40] **원인 확정(앱 WebView)** — Capacitor 7.6.9 `CapacitorWebView.edgeToEdgeHandler`(`adjustMarginsForEdgeToEdge:'auto'`, API 35+)가 WebView margin 을 `systemBars|displayCutout` 만으로 주고 `WindowInsetsCompat.CONSUMED` 를 돌려준다 → Android 15 강제 edge-to-edge 에서 `adjustResize` 는 창을 줄이지 않고 IME 인셋도 WebView 에 안 간다 → **창·`innerHeight`·`visualViewport` 가 전혀 안 바뀐다** → 웹은 키보드를 알 길이 없다(VoiceVault 1차 실패와 같은 원인). 사용자 재현(회화방 글자 모드)이 이것. **웹만으로는 앱을 못 고친다.** 선례: bjj `mobile/android/.../MainActivity.java`(2026-09-14 실기기 확인) — API 35+ 에서 인셋 리스너를 교체해 하단 margin = max(내비게이션 바, **ime**). 이 방식이면 WebView 가 실제로 줄어 아래 웹 ① 경로로 전 화면이 같이 동작한다. **네이티브 변경은 하지 않았다 → Leader 보고(versionCode 2→3·APK 재빌드·재설치 고지 필요).**
- [08:40] **웹 공통 해법(R1 한 곳)** — `src/components/shell/KeyboardInset.tsx`(루트 `src/app/layout.tsx` 에 1회 마운트 — 로그인 전·관리자 콘솔 포함) + 순수 판정 `shell/keyboard.ts`. `<html>` 에 `data-kb="open"`·`--kb-inset` 을 쓴다. 판정: 텍스트 입력 칸 포커스 && (① 같은 폭 최대 `innerHeight` 대비 120px↑ 줄어듦[손가락 기기만 — 데스크톱 창 조절 오탐 방지] 또는 ② `visualViewport` 가 덮은 높이 120px↑[핀치 확대 scale>1.01 제외]). ①(모바일 Chrome `resizes-content`·네이티브 보정 뒤 앱)은 화면이 이미 줄어 `--kb-inset`=0, ②(덮기만 하는 브라우저)는 덮인 높이. 열리면(또는 열린 채 다른 칸) 입력 칸 스크롤 영역만 1회 옮겨 키보드 위·붙박이 헤더 밑 16px 여유(R4·R5, 보이는 칸보다 큰 긴 글 칸은 브라우저 커서 보이기에 맡김). 하단 입력 바(`data-kb-docked` — Composer·수업 ⑤ 글자 바)는 스크롤 대상 아님(R2).
  - 적용: 앱 셸 높이 `calc(100dvh - var(--kb-inset))`(`(app)/layout.tsx`) · 하단 탭 `data-tabbar` + globals.css `:root[data-kb] [data-tabbar]{display:none}`(D1 A) · `--safe-bottom`(키보드 동안 0 — 입력 바·시트 아래 제스처 여백 제거, R2) · `Sheet` 바깥 상자 `bottom: var(--kb-inset)`·`max-h-[85%]`(남은 높이 85%, R4 · 주 버튼 제자리 D2 A) · `Toast` `+ var(--kb-inset)`(R7) · 방별 `useKeyboardInset`(ChatRoom·TalkRoom·LessonScreen)과 Composer·StageSpeak `margin-bottom: var(--kb-inset)` **제거**(셸이 줄어 이중 보정이 되므로), `chat/useKeyboardInset.ts` 삭제.
  - **확인 중 발견·수정(기존 결함)**: 채팅방·회화방 `main` 이 대화 길이만큼(390×780 에서 3,200px) 헛 스크롤됐다 — 말풍선 `sr-only`(absolute)의 기준 상자가 목록 스크롤 바깥 `relative` 상자라 스크롤에 안 잘리고 `main` 을 늘렸다. `MessageList` 스크롤러에 `relative` 1개로 수정(헤더·입력 바가 밀리는 문제·브라우저 포커스 스크롤이 방 전체를 미는 문제 제거).
  - 바꾼 파일: `src/app/layout.tsx` · `src/app/(app)/layout.tsx` · `src/app/globals.css` · `src/components/shell/{KeyboardInset.tsx(신규),keyboard.ts(신규),__tests__/keyboard.test.ts(신규),TabBar.tsx}` · `src/components/common/{Sheet,Toast}.tsx` · `src/components/chat/{Composer,ChatRoom,MessageList}.tsx`(`useKeyboardInset.ts` 삭제) · `src/components/talk/TalkRoom.tsx` · `src/components/lesson/{LessonScreen,StageSpeak}.tsx`(각 1~2줄). 네이티브·설정(`src/components/settings/**` 포함)·서버 모듈 무변경.
- [08:40] **검증** — 미러 tsc: 내 파일 오류 0(전체 3건은 동시 진행 DB 스키마 작업의 `textRevealedAt` — learning 테스트·012b 스모크, 범위 밖) · eslint(변경 파일) 0 · 단위 신규 `keyboard.test.ts` 8/8, `src/components` 전체 197/197. **브라우저 에뮬레이션 89/89 PASS**(google-chrome headless + playwright-core, 미러 dev 3021, QA 계정 1시간 localhost 토큰을 읽기 전용 조회로 발급, **쓰기 요청 전부 차단 — DB 변경 0**(막힌 것 출석 POST 42건뿐)): ① 경로(뷰포트 높이 −320) — 단어장 검색 360/390/412(검색창 제자리·목록 끝 = 키보드 위·탭 숨김·내리면 복귀) · 설정 3폭(선생님 이름 칸 400~444, 보이는 끝 460 = 16px 여유·헤더 밑, 열린 채 다른 칸도) · 새 채팅 시트 3폭+412×892(시트 끝 = 키보드 위·최대 85%·제목 칸 16px 여유·[시작하기] 시트 내용 안) · 단어 추가 시트 · 채팅방 3폭+412×892(입력 바 끝 = 키보드 위·아래 여백 8px·목록 맨 아래 유지·`main` 헛 스크롤 0·토스트 키보드 위) · 회화방 글자 모드(방 종류만 테스트 안에서 TALK 로 바꿔 렌더) · 붙여넣기 수업 칸 / ② 경로(가짜 visualViewport) — `--kb-inset`=320px·셸 460·입력 바·토스트·시트 키보드 위, 핀치 확대는 키보드 아님 / 오탐 — 데스크톱 창 줄이기·포커스만 있고 변화 없음(= 지금 앱) 은 아무것도 안 바뀜 · 키보드 없음은 전 화면 그대로(셸 = 뷰포트, 탭 보임, 시트 85%) · 가로 넘침 0 · 콘솔 오류 0. 스크립트: 미러 `~/.node-local/thekaiwa/.scratch-021/kb-e2e.mjs`(저장소 밖, QA 이식용 — QA 쿠키는 삭제함).
- [08:40] **남은 위험·확인 필요** ① **앱(1.0.1)은 이번 웹 배포로 바뀌지 않는다** — 네이티브 보정(위 bjj 방식) + APK 재빌드·재설치 전까지 회화방·채팅방·시트 입력이 계속 가려진다. ② 실기기 확인은 사용자만 가능: S25+ Chrome(웹) 전 화면 · 네이티브 보정 APK 설치 뒤 앱 전 화면. 에뮬레이션은 ① 경로를 뷰포트 축소로 흉내 낸 것이라 실제 키보드 애니메이션 중 흔들림·삼성 키보드 추천 띠 높이 변화는 못 본다. ③ 여러 줄 칸이 보이는 칸보다 크면 커서 줄 보이기는 브라우저 기본 동작에 맡겼다(데모 "커서가 있는 줄" 을 직접 계산하지 않음). ④ `docs/screens.md` 의 `useKeyboardInset`·`--kb-inset` 방 루트 서술(§3-9·§9 등 7곳)은 이제 사실과 다르다 — Designer/Leader 갱신 대상.

### 2026-10-01 developer — 앱 네이티브 IME 인셋 보정

- [08:46] **네이티브 변경(APK 재빌드·재설치 필요, versionCode 2→3 · versionName 1.0.1→1.0.2).** 웹만 배포하면 앱 키보드는 그대로다 — 앱은 `server.url` 로 운영 웹을 읽지만 WebView 크기는 APK 안 `MainActivity` 가 정한다.
- [08:46] **원인 재확인(소스)**: Capacitor 7.6.9 `Bridge`(L1623)가 `super.onCreate` 안에서 `CapacitorWebView.edgeToEdgeHandler` 를 부르고, `adjustMarginsForEdgeToEdge:'auto'`·API 35+·테마 opt-out 없음(`styles.xml` 에 `windowOptOutEdgeToEdgeEnforcement` 없음 확인)이면 WebView 에 `systemBars|displayCutout` margin 리스너를 걸고 `CONSUMED` → IME 인셋이 버려진다. 실제 WebView 는 앱 `activity_main.xml` 이 아니라 Capacitor `capacitor_bridge_layout_main.xml` 의 `CapacitorWebView`(부모 `CoordinatorLayout` → `MarginLayoutParams` 캐스트 안전). `@capacitor/status-bar` 7.0.6 은 인셋 리스너를 걸지 않고 웹도 `StatusBar` 를 부르지 않음 → 경합 없음.
- [08:46] **구현**(`android/app/src/main/java/com/miraclepenguin/kaiwa/MainActivity.java`, +41/−1): 기존 `onCreate` 의 WebView 블록 안에 `fitAboveKeyboard(webView)` 1줄 + private static 메서드 — API 35 미만은 return, 이상이면 `ViewCompat.setOnApplyWindowInsetsListener` 로 Capacitor 리스너를 **교체**(뷰당 1개라 중복 등록 없음): left/top/right = 시스템 바·컷아웃, bottom = `max(bars.bottom, ime.bottom)`, `CONSUMED`, 이어서 `requestApplyInsets`. Javadoc 3절 추가(원인·max 인 이유·API 34 이하 제외 이유·전제 조건). 쿠키 flush(`onPause`)·다운로드 리스너·상단 status bar/하단 내비게이션 바 margin(키보드 닫힘 = ime 0 → 기존과 동일 값) 불변. STT 플러그인은 `cap sync` 가 만드는 `capacitor.plugins.json` 으로 자동 등록돼 MainActivity 무관.
  - **bjj 선례와 다른 점**: ① 기존 `onCreate` 구조(`bridge` 필드·다운로드 리스너 블록)를 유지하고 그 안에서 호출 — 별도 메서드로 분리 ② bjj 의 Autofill 제외 코드는 가져오지 않음(이 task 범위 아님) ③ 전제(`'auto'`·opt-out 없음)를 주석에 명시. 계산식·API 가드·`CONSUMED`·`requestApplyInsets` 는 동일.
  - **버전**(`android/app/build.gradle` L6-7 — `kaiwaVersionCode`/`kaiwaVersionName` 정의는 이 한 곳뿐, grep 확인): `3` / `"1.0.2"`.
- [08:46] **웹과의 맞물림**: WebView 가 실제로 줄면 `keyboard.ts` ① 경로(`innerHeight` < 같은 폭 기준 높이 120px↑, `coarsePointer`)로 `data-kb=open`, `insetPx` = `innerHeight − vv.height − offsetTop` = 0 → `--kb-inset` 0 이라 이중으로 올라가지 않는다. `KeyboardInset.tsx` 상단 ⚠ 주석("네이티브 보정이 들어오면 ① 경로로 같이 동작")과 일치.
- [08:46] **검증**: 의존성 추가 없음 — `androidx.core:core` 는 appcompat 1.7.0 의 `api` 의존(gradle 캐시 `.module` 확인, 1.15.0 으로 해석)이라 앱 컴파일 경로에 있다(bjj 도 같은 의존성 세트로 빌드·실기기 통과). **`javac` 21 실제 컴파일 rc=0**(Gradle 없이 — `android-35/android.jar` + 지난 APK 빌드의 Capacitor 7.6.9 컴파일 클래스 jar + gradle 캐시 androidx core 1.15.0·appcompat 1.7.0·activity·fragment·lifecycle·drawerlayout·kotlin-stdlib, 산출물은 scratchpad). 이 파일 자체의 경고 0(나머지는 kotlin `@Metadata` 클래스패스 잡음). `javap` 로 `setOnApplyWindowInsetsListener`·`Type.ime()`·`Math.max`·`CONSUMED` 바이트코드 확인. **못 한 것**: Gradle/AGP 빌드·lint·D8 dex·APK 빌드(지시상 deployer `scripts/build-apk.sh`) · 실기기 동작(키보드 열림/닫힘·회전·삼성 키보드 추천 띠 높이 변화·분할 화면) — 사용자 S25+ 에서만 가능. 단위 테스트 없음(안드로이드 인셋은 JVM 단위 테스트로 재현 불가 — 계측 테스트 기반 없음).
- [08:46] **서버 `AppRelease`(조사만, 수정 안 함 — deployer 몫)**: 하드코딩 없음. `/api/app/version` 은 `src/modules/infra/appRelease.ts` `listReleases()` 가 DB `AppRelease`(prisma/schema.prisma L570~, 환경 컬럼 없음 = 개발·운영 공유, 30초 캐시)에서 `versionCode` 최대 행을 읽는다. seed 에 행 없음. `scripts/build-apk.sh --publish` 가 versionCode·versionName·`thekaiwa-1.0.2.apk`·sha256 을 출력 → deployer 가 행 INSERT(docs/deploy-order.md L291). `minSupported` 를 2(권장 배너)로 둘지 3(강제)으로 둘지는 Leader 결정 필요. 테스트 픽스처 `src/modules/infra/__tests__/task003f.test.ts` 의 1·2 는 데이터일 뿐 영향 없음.

### 2026-10-01 developer — REV-042 Medium 2건 수정

- [09:42] 데모 게이트 `DEMO_GATE_PASSED`(task: task-021 · status: approved · v1) 확인 후 착수. 화면 구조·문구·흐름은 바꾸지 않았다(판정 기준 높이만) → 데모 재승인 불필요.
- [09:42] **M1 — 기준 높이(baseline) 전이를 순수 함수로**(`src/components/shell/keyboard.ts` `trackBaseline`·`resetBaseline`·`baselineFor`·`BASELINE_SETTLE_MS=1000`·`INITIAL_BASELINE`, `KeyboardInset.tsx` 는 이 함수만 부른다). 규칙: ① 처음 보는 폭 = 지금 높이(칸 포커스 중이면 임시값) ② 커진 높이는 언제든 기준(키보드는 창을 줄이기만 함 — 포커스 중이어도, 그래서 마운트 때 열려 있던 키보드가 한 번 내려가면 포커스가 빠지기 전에도 다음 열림을 잡는다) ③ 줄어든 높이는 **칸 포커스가 없고 빠진 지 1초가 지났을 때만** 기준으로 낮춘다(분할 화면·폴더블) ④ `orientationchange`·`visibilitychange` 에서 폭별 기준을 모두 버린다. REV 권고("포커스 없을 때만 갱신·하향")에 두 가지를 더했다 — ②(포커스 중 상향): 권고 그대로면 마운트 때 열린 키보드를 내렸다 다시 열 때 포커스가 빠질 때까지 계속 놓친다 · ③의 1초: 포커스가 잠깐 빠진 순간(단추 등) 아직 떠 있는 키보드 높이로 기준이 내려가 곧바로 칸에 돌아오면 열림을 놓친다(브라우저 E2E Y 로 확인).
  - **구조적 한계(규칙으로 못 고침)**: 마운트 때 **이미 열려 있던 그 키보드 자체**는 ① 경로에서 비교할 높이가 없어 알 수 없다 → 닫힘으로 둔다(아무것도 안 바꾸는 쪽, 화면은 브라우저가 이미 줄여 입력 바는 키보드 위). 키보드를 연 채 기기를 돌리면 초기화 뒤 임시 기준이 줄어든 높이라 키보드가 내려가기 전까지 닫힘으로 본다(탭 보임) — 지시대로 초기화를 넣은 대가. 칸 포커스 중에 분할 화면으로 들어가면 포커스가 빠질 때까지 열림으로 오판한다(높이만으로는 키보드와 구별 불가).
- [09:42] **M2 — E2E 저장소 고정**: 미러 스크래치 `kb-e2e.mjs` 를 `tests/live/task021-ui-e2e.mjs` 로 옮김(인자 `--base`·`--cookie`(qa-session.ts 파일)·`--out`·`--chat`·`--chrome`, 3010 거부, 채팅방은 QA 계정 기존 CHAT 방을 채팅 목록 GET 으로 고름, `/api/**` 쓰기 요청 전부 503 차단 유지). 실행법은 파일 머리 주석과 `tests/live/README.md` 한 줄에 고정. **Y 구간 6항목 추가**(포커스 없이 줄어든 분할 화면 뒤 칸 포커스 = 키보드 아님·그 창에서 키보드 = 열림·포커스 잠깐 빠졌다 1초 안에 돌아오면 열림 유지). 미러 스크래치 원본은 그대로 남아 있음(이제 쓰지 않음).
  - 트러블슈팅(재발 가능): Chrome 기기 에뮬레이션은 화면 방향을 **뷰포트 비율**로 정해 높이 < 폭이 되면 `orientationchange` 를 쏜다(실기기 키보드는 안 쏨) → 기준이 초기화돼 Y 첫 실행 1건 FAIL. 세로를 유지하는 높이(390×640 → 420)로 바꿈 — 이후 이 스크립트에 높이를 넣을 때 주의. 또 미러에 다른 에이전트 dev 서버(3012)가 떠 있으면 Next 16 이 같은 디렉터리에 두 번째 dev 를 거부한다 → 하드링크 복제본(`cp -al`, 최상위 설정 파일만 실제 복사)에서 3021 로 띄우고 끝나면 지웠다.
- [09:42] **REV-044 Low 1**: `capacitor.config.ts` `adjustMarginsForEdgeToEdge` 위 주석 1줄("MainActivity.fitAboveKeyboard 가 이 'auto'(+ opt-out 없음·adjustResize)에 의존") — 주석뿐이라 `cap sync` 산출물·APK 무변화, `versionCode`·`MainActivity.java`·`build.gradle` 미수정.
- [09:42] **검증**(미러, sync-local 후): `keyboard.test.ts` **16/16**(기존 8 + 전이 8: 처음 폭·포커스 중 축소 / 상향 / 포커스 없는 축소 = 분할 화면 오판 없음 / 포커스 빠진 직후 축소 무시·재포커스 열림 / 1초 뒤 하향 / 마운트 때 열림 → 내림 → 재열림 / 회전·가시성 초기화·폭별 분리(초기화 없으면 오판 비교) / 무변경 시 같은 객체) · `shell/__tests__` 전체 27/27 · eslint(변경 5파일) 0 · `tsc --noEmit` 오류 0 · **브라우저 E2E 95/95**(기존 89/89 유지 + Y 6, 390/360/412 · 막은 쓰기 46건 = 출석 POST 뿐, DB 변경 0, QA 쿠키 삭제). `npm run build` 는 돌리지 않음(tsc·dev 컴파일로 갈음).
- [09:42] **처리하지 않은 Low**: REV-042 L1 관리자 콘솔 셸 `--kb-inset` 미적용(`ConsoleShell.tsx` — 이번에 손대는 파일 아님) · L2 큰 칸 커서 줄 계산(`keyboard.ts` 를 고쳤지만 REV 권고 자체가 "F6 실기기 확인 뒤 필요하면" — 보류) · L3 `docs/screens.md` 옛 `useKeyboardInset` 서술(Designer/Leader 몫) · L4 iOS `offsetTop` 패닝(대상 플랫폼 아님, 기록만) · REV-044 L2 IME 애니메이션 연동·L3 Autofill 제외(`MainActivity.java` 미수정 지시).
- [09:42] 바꾼 파일: `src/components/shell/{keyboard.ts,KeyboardInset.tsx,__tests__/keyboard.test.ts}` · `tests/live/task021-ui-e2e.mjs`(신규) · `tests/live/README.md`(1줄) · `capacitor.config.ts`(주석 1줄). 네이티브 변경 없음(주석 제외), 커밋·배포·DB 변경 없음.

## Reviewer 기록

### 2026-10-01 reviewer — 웹 구현 감사

- **REV-042 · PASS**(Critical 0 · High 0 · Medium 2 · Low 4 · native_change: 이 웹 감사 범위 false — 같은 task 에 Developer 가 기록한 MainActivity·versionCode 3 네이티브 변경은 별도 고지·감사 대상). 읽기 전용(코드·`.claude/state/demo-gate/` 무수정, 되돌리기·stash 없음, build·dev 서버 미실행).
- **데모 게이트**: `check.mjs check --task …task-021…` → `DEMO_GATE_PASSED`(approved v1, hash verified). `evidence.jsonl` 승인 줄(task-021 · v1 · session f3fdf531 · prompt_ts 08:17:13)이 세션 transcript 의 실제 사용자 메시지 "대기 중인 데모 전부 권고안대로 승인"(23:17:13Z = 08:17:13 KST, `role:user`)과 일치. 에이전트가 approve·waive 를 대신 실행한 흔적·`state/demo-gate/` 직접 쓰기 흔적 없음.
- **검증 실행(Read 전용 범위)**: `keyboard.test.ts` 8/8 통과 · eslint(021 파일) 0 · tsc 전체 실패는 전부 021 밖(`settings/VoiceSettings.tsx`·`voiceSliderLogic.test.ts` = task-022 진행분, `tests/live/task012b-smoke.ts` `textRevealedAt` = DB 스키마 작업) — 021 파일 tsc 오류 0. 89/89 헤드리스 에뮬레이션은 Developer 기록이며 dev 서버 금지 지시로 재실행하지 않았다(코드 경로 대조로 갈음).

**① 승인 데모 v1 대비 차이 분류**

| 항목 | 승인본 | 구현 | 분류 |
|---|---|---|---|
| D1 A 하단 탭 | 키보드 열림 동안 숨김 | `TabBar data-tabbar` + `:root[data-kb] [data-tabbar]{display:none}` | 일치 |
| D2 A 시트 주 버튼 | 시트 내용 끝 제자리 | `Sheet` 고정 푸터 없음, 본문 끝 버튼 그대로 | 일치 |
| R1 측정 한 곳 | 셸 1곳 | `KeyboardInset` 루트 레이아웃 1회 마운트, 방별 훅 제거 | 일치 |
| R2 입력 바 | 키보드 바로 위·제스처 바 여백 제거·목록 맨 아래 | 셸 높이 `calc(100dvh - --kb-inset)` + `--safe-bottom`(열림 동안 0) | 일치 |
| R4 시트 | 통째로 위, 최대 85%, 안쪽 스크롤·16px | `bottom:var(--kb-inset)`·`max-h-[85%]`·`revealDelta` 16px | 일치 |
| R5 긴 폼 | 커서 줄 ≥16px 위 | 입력 칸 기준 16px, **보이는 칸보다 큰 칸은 브라우저 커서 보이기에 위임** | implementation(근거: 붙여넣기 칸 176px 은 키보드 위 여유 안에 들어감, 사용자가 크게 키운 경우만 해당 — Developer 가 기록에 공개) |
| R6 검색 | 제자리·목록 끝만 위 | 셸이 줄어 검색창 위치 불변 | 일치 |
| R7 토스트·핀치 | 키보드 위·핀치는 키보드 아님 | `Toast + --kb-inset`, `vvScale>1.01` 제외 | 일치 |
| (데모에 없음) `MessageList` 스크롤러 `relative` | — | `sr-only` absolute 기준 상자 수정(기존 헛 스크롤 결함) | implementation(내부 구조 조정, 화면 변화 없음, 읽기 경로 영향 없음) |

material 차이 0 · defect 0 → 데모 재승인 불필요.

**발견 사항(JSON)**
```json
{ "reviewId": "REV-042", "status": "PASS", "issues": [
  { "issue": "키보드 기준 높이(baseline)가 줄어들지 않고 초기화 조건도 없어 분할 화면·폴더블 높이 변화가 키보드로 오판될 수 있음", "severity": "MEDIUM",
    "component": "src/components/shell/KeyboardInset.tsx:50-54,84-85 · keyboard.ts:65",
    "risk": "손가락 기기에서 창 높이가 120px 이상 줄면(분할 화면·자유 창) 텍스트 칸 포커스 동안 data-kb=open 이 됨 → 하단 탭 숨김·--safe-bottom 0 이 잘못 적용. 또 마운트 시점에 이미 키보드가 열려 있으면 줄어든 높이가 baseline 이 되어 그 폭의 첫 열림을 놓침.",
    "evidence": "baseline = Map<폭, 본 적 있는 최대 innerHeight> 로 증가만 하고(Math.max) orientation/visibilitychange 재설정 없음. shrunk = baselineHeight - innerHeight 가 120 이상이고 textFocused 면 open.",
    "recommendation": "baseline 은 텍스트 칸에 포커스가 없을 때만 갱신·하향 허용하고 orientationchange/visibilitychange 에서 폭 항목을 지운다. 영향은 탭 숨김 정도라 차단 사유는 아님." },
  { "issue": "컴포넌트 수준 로직(baseline·scrollParent·stickyHeaderBottom·열림/닫힘 전이·cleanup)이 저장소 테스트에 없음, 89/89 에뮬레이션은 저장소 밖 스크래치", "severity": "MEDIUM",
    "component": "src/components/shell/__tests__/keyboard.test.ts (순수 함수 8건만) · ~/.node-local/thekaiwa/.scratch-021/kb-e2e.mjs",
    "risk": "회귀 시 잡을 자동 검증이 없고 QA 가 저장소만으로 89 항목을 재현할 수 없음(스크래치는 미러 동기화 시 사라질 수 있음).",
    "evidence": "테스트는 isTextEntry·keyboardState(경로 ①·②·비키보드·120px 경계·앱 무변화)·revealDelta 2건. baseline 전이와 DOM 스크롤 부모 탐색은 미검증.",
    "recommendation": "kb-e2e.mjs 를 tests/live 로 옮기거나 QA 인계 문서에 경로·실행법(쓰기 차단 옵션 포함)을 고정. baseline 변경(위 1번) 시 그 전이 단위 테스트 추가." },
  { "issue": "관리자 콘솔 셸이 --kb-inset·--safe-bottom 을 쓰지 않음", "severity": "LOW",
    "component": "src/components/admin/console/ConsoleShell.tsx:28",
    "risk": "덮기만 하는 브라우저(② 경로)에서 콘솔 폼 입력 칸이 키보드에 가려질 수 있음. S25+ Chrome(resizes-content)·네이티브 보정 뒤 앱은 ① 경로라 영향 없음.",
    "evidence": "h-[100dvh] 고정. 콘솔 Sheet 는 공용 Sheet 라 커버됨.",
    "recommendation": "콘솔 입력 화면이 모바일 대상이 되면 (app) 셸과 같은 calc 적용. 지금은 기록만." },
  { "issue": "입력 칸이 보이는 영역보다 크면 revealDelta 가 0 을 돌려 커서 줄 보이기를 브라우저에 맡김", "severity": "LOW",
    "component": "src/components/shell/keyboard.ts:84-86",
    "risk": "데모 R5 '커서가 있는 줄'을 ② 경로에서는 보장하지 못함(① 경로는 브라우저가 커서를 보임).",
    "evidence": "room<=0 또는 칸 높이>room 이면 0.", "recommendation": "실기기 F6 에서 긴 글 칸 확인, 문제 있으면 커서 줄 계산 추가." },
  { "issue": "docs/screens.md 가 삭제된 useKeyboardInset·방 루트 --kb-inset 을 여전히 서술", "severity": "LOW",
    "component": "docs/screens.md:577,612,749,787 (Developer 기록상 7곳)",
    "risk": "이후 작업자가 없는 훅·옛 구조를 기준으로 구현.", "evidence": "grep: src·tests·scripts 에는 useKeyboardInset 참조 0, 문서에만 남음.",
    "recommendation": "Designer/Leader 가 screens.md 를 R1~R7 공통 셸 방식으로 갱신(코드 수정 아님)." },
  { "issue": "② 경로에서 visualViewport.offsetTop 패닝(iOS Safari) 시 셸 상단이 잘릴 수 있음", "severity": "LOW",
    "component": "src/components/shell/keyboard.ts:63 · src/app/(app)/layout.tsx:20",
    "risk": "대상 플랫폼(S25+ Chrome·안드로이드 앱)이 아니라 영향 없음.", "evidence": "covered = innerHeight - vvHeight - offsetTop 로 셸 높이만 줄이고 패닝은 보정하지 않음.",
    "recommendation": "iOS 를 지원하게 될 때 재검토. 기록만." } ],
  "summary": { "critical": 0, "high": 0, "medium": 2, "low": 4 },
  "high_risk_areas": [
    "S25+ Chrome(웹) 실기기 — 모든 입력 화면(회화방 글자 모드·채팅방·시트 3종·단어장 검색·설정 폼·붙여넣기 수업) 360/390/412폭",
    "네이티브 보정 APK(versionCode 3) 설치 전후 앱 — 설치 전은 지금과 동일(회귀 없음), 설치 후 ① 경로 동작·이중 보정 없음(--kb-inset=0)",
    "키보드 열림·닫힘 애니메이션 중 흔들림, 삼성 키보드 추천 띠 높이 변화 때 재스크롤(120ms settle)",
    "시트 안 입력 칸 16px 여유·시트 최대 85%, 시트 열림 중 main 스크롤 잠금",
    "채팅방·회화방 main 헛 스크롤 0(MessageList relative 수정)·목록 맨 아래 유지",
    "분할 화면·회전·뒤로가기로 키보드만 내린 경우(포커스 유지) baseline 오판(issue 1)",
    "관리자 콘솔 폼(② 경로 한정)" ],
  "native_change": false }
```

- **② keyboard.ts 오탐 점검 결과**: 핀치 확대(`vvScale>1.01` → covered 0, 키보드 아님)·데스크톱 창 줄이기(`coarsePointer` 가 ① 에만 걸려 오탐 없음)·주소창 접힘(≈56px < 120)·포커스만 있고 창·vv 무변화(= 지금 앱)는 모두 `open=false`·`--kb-inset` 0 으로 떨어짐. SSR 가드: `useEffect` 안에서만 `window`·`document` 접근, 서버 렌더는 null — 문제 없음. 리스너 누수: vv resize/scroll·window resize·focusin/focusout 5개 모두 cleanup 에서 제거, rAF·settle 타이머 취소, `--kb-inset`·`data-kb` 제거(리스너 짝 일치 확인). 남은 것은 위 1번(baseline) 하나.
- **③ CSS 상호작용**: `100dvh` 를 `calc(100dvh - --kb-inset)` 로 바꿨고 ① 경로는 `--kb-inset` 0 이라 이중 차감 없음. `paddingTop: env(safe-area-inset-top)` 유지. `--safe-bottom` 은 `data-kb` 동안만 0 이라 키보드 없는 화면은 이전과 동일. 화면당 스크롤 1곳 원칙 유지(Sheet 는 열린 동안 `main` 스크롤 잠금 + 본문 1곳). 폭 360/390/412 는 새 고정 폭·가로 넘침 요소 추가 없음(Developer 에뮬레이션 가로 넘침 0 기록과 모순 없음).
- **④ 접근성**: `MessageList` 의 `relative` 1개는 `sr-only` 자식의 기준 상자만 바꿔 접근성 트리·읽기 순서를 그대로 둔다(기존 헛 스크롤 결함 수정). 키보드 열림 중 탭 숨김은 D1 A 승인 사항 — 텍스트 칸 포커스 동안만이라 스크린리더 사용자는 키보드를 내리면 탭 복귀(수용).
- **⑤ 6층**: `components/*` 가 preferences 를 import 하지 않음, 라우트·화면에 `window.Capacitor`·엔진명 없음, 서버 모듈 무변경. 위반 0.
- **⑧ 앱 경로**: 네이티브 보정 전(앱 1.0.1)은 창·visualViewport 불변이라 `keyboardState` 가 닫힘으로 남고 아무것도 바뀌지 않는다(현재와 동일, 회귀 없음). 보정 후(WebView 가 키보드만큼 줄어듦)에는 ① 경로로 켜지고 `--kb-inset`=0 이라 이중으로 올라가지 않는다. 참고로 같은 task 에 Developer 가 추가한 `MainActivity` 변경(API 35+ 에서 하단 margin = max(내비게이션 바, IME), `CONSUMED`)·`build.gradle` versionCode 2→3 diff 를 훑었고 웹 ① 경로와 맞물림에 이상 없음 — 정식 네이티브 감사·APK 재빌드·재설치 고지·`AppRelease` minSupported 결정은 Leader/deployer 몫.

## Reviewer 기록 (021 네이티브)

### 2026-10-01 reviewer — 앱 네이티브(MainActivity·versionCode 3) 감사

- **REV-044 · PASS**(Critical 0 · High 0 · Medium 1 · Low 3 · **native_change: true**). 읽기 전용(코드·`.claude/state/demo-gate/` 무수정, revert/checkout/stash 없음, 빌드·설치 없음). 웹 구현은 REV-042 가 감사했으므로 여기서는 네이티브와 웹의 **상호작용(이중 보정)** 만 다뤘다.
- **데모 게이트**: `check.mjs check` → `DEMO_GATE_PASSED`(approved v1, hash verified). `evidence.jsonl` 승인 줄은 task-021 한 줄(v1, prompt_ts 08:17:13, session f3fdf531)이고 REV-042 가 transcript 원문 대조로 이미 확인했다. approve·waive 대리 실행·`state/demo-gate/` 직접 쓰기 흔적 없음. 이 네이티브 변경은 화면 구조·문구를 바꾸지 않아(WebView 크기만) 데모 v1 대비 material·defect 0.

**① 원인 수정 여부 — 맞다**
- Capacitor 7.6.9 `CapacitorWebView.edgeToEdgeHandler`(`adjustMarginsForEdgeToEdge:'auto'`, API 35+)는 margin 을 `systemBars|displayCutout` 으로만 주고 `CONSUMED` 를 돌려줘 IME 인셋이 WebView 에 가지 않는다. `Bridge` L1623 이 `super.onCreate` 안에서 건 것이라 `MainActivity` 가 그 뒤에 같은 뷰에 `setOnApplyWindowInsetsListener` 를 다시 걸면 **교체**(뷰당 리스너 1개)다 — 중복 등록·이중 margin 없음. 하단 margin = `max(bars.bottom, ime.bottom)` 는 IME 인셋이 화면 끝부터 재서 내비게이션 바를 이미 포함하므로(합이 아니라 max) 옳고, 키보드가 닫히면 `ime.bottom=0` 이라 기존 값(내비게이션 바)으로 돌아간다.
- 회귀 경로: 제스처 내비게이션(바 ≈ 24dp)·3버튼(≈ 48dp)은 키보드 닫힘 상태에서 기존과 같은 값이다. 가로 회전은 `configChanges` 에 `orientation|screenSize` 가 있어 액티비티가 재생성되지 않고 인셋이 재디스패치돼 left/right 가 갱신된다. 분할 화면·플로팅 키보드는 ime 가 0 이거나 창 기준 값이라 키보드 여유가 생기지 않을 뿐 가려짐이 되돌아오지 않는다(아래 high_risk). **API 34 이하는 `VANILLA_ICE_CREAM` 가드로 손대지 않는다** — 이 구간은 edge-to-edge 강제가 아니고 `adjustResize` 가 창을 줄이므로 margin 까지 주면 이중이 되는데 그걸 피했다(minSdk 26~34 기기 동작 불변).

**② 인셋 API 사용 — 이상 없음**
- `WindowInsetsCompat.CONSUMED` 반환 + `requestApplyInsets` 로 첫 디스패치 보장. status bar(top)·컷아웃(left/right) 값은 Capacitor 원 계산과 같다. 자식(WebView 내부)은 WebView 가 `CONSUMED` 를 받아 이전과 같이 전파받지 않는다(원 동작 유지). `@capacitor/status-bar`(show/hide 만)·`@capacitor/splash-screen`(풀스크린 미사용) 은 인셋 리스너를 걸지 않고 웹·플러그인 소스에도 `StatusBar`·`SplashScreen` 호출이 없어 경합 없음(grep 0건). 쿠키 flush(`onPause`)·다운로드 리스너(`openInBrowser`, https 만)는 diff 상 그대로. sherpa-stt 는 `capacitor.plugins.json` 자동 등록이라 MainActivity 무관.
- `(ViewGroup.MarginLayoutParams) v.getLayoutParams()` 캐스트: 부모가 `capacitor_bridge_layout_main.xml` 의 `CoordinatorLayout` 이라 안전(Capacitor 자체 핸들러도 같은 캐스트).

**③ 웹 `keyboard.ts` 와 이중 보정 — 없음(코드 논증)**
- WebView 가 실제로 줄면 `resizes-content` 아래 `innerHeight` 와 `visualViewport.height` 가 함께 줄어 `covered = innerHeight − vv.height − vv.offsetTop ≈ 0` 이라 `--kb-inset`=0. `data-kb=open` 은 ① 경로(`baseline − innerHeight ≥ 120`·coarse pointer·텍스트 칸 포커스)로만 켜지고 그 효과는 탭 숨김·`--safe-bottom` 0 뿐이다(`--kb-inset` 이 0 이라 셸 `calc(100dvh − --kb-inset)`·Sheet `bottom`·Toast 에 추가 차감 없음). 네이티브가 줄이고 웹이 다시 올리는 이중 이동은 일어나지 않는다. `KeyboardInset.tsx` 의 ⚠ 주석("네이티브 보정이 들어오면 ① 경로로 같이 동작")과 일치.

**④ 의존성·권한·Manifest — 변경 없음**
- `git diff` 에 `AndroidManifest.xml`·`capacitor.config.ts`·`variables.gradle`·`res/**` 없음. 권한은 기존 `INTERNET`·`RECORD_AUDIO` 뿐(추가 0). `windowSoftInputMode="adjustResize"` 유지 — **이 값이 있어야 IME 인셋이 디스패치되므로 전제 조건**이다(Manifest 주석 L27 도 같은 서술). `androidx.core` 는 appcompat 1.7.0 의 api 의존이라 새 의존성 없음(Developer 가 javac rc=0 기록, bjj 와 같은 세트).

**⑤ 버전 — 단일 정의·일관**
- `kaiwaVersionCode = 3` / `kaiwaVersionName = "1.0.2"` 는 `android/app/build.gradle` L6-7 한 곳(grep 으로 android 전체에서 정의 1개, `defaultConfig` L23-24 가 사용). 서버는 versionCode **정수**로만 비교(`appRelease.ts` `buildVersionInfo`: `updateAvailable = reinstallRequired = code < latest.versionCode`) → 3 > 2 로 올바르다. `AppRelease` 행은 아직 없다(deployer 가 `build-apk.sh --publish` 출력으로 INSERT, `docs/deploy-order.md` §8) — 이 시점 운영 조회 `latestCode 2` 는 정상이다. **`AppRelease` 는 환경 컬럼이 없고 개발·운영이 같은 NAS DB 라서 행을 넣는 순간 운영 앱 1.0.1 사용자에게 업데이트 배너가 뜬다** → 실기기 검증 전에 행을 넣지 말 것(아래 순서).

**⑥ 사용자 고지 자리**
- 이력서: Developer 기록 `### 2026-10-01 developer — 앱 네이티브 IME 인셋 보정` 첫 줄에 "네이티브 변경(APK 재빌드·재설치 필요)" 명시, `20-Log/2026-10-01.md` 08:46 줄에도 같은 문구가 있다. 배포 기록(deployer)에는 versionCode·sha256 과 `AppRelease.notes`(사용자 배너 문구) 자리가 필요하다 — 아직 없으므로 deployer 기록에 채워야 한다. 사용자 고지 문안은 Leader 가 정하면 된다(예: "키보드가 입력창을 가리는 문제 수정 — 앱 재설치 필요, 웹만으로는 고쳐지지 않음").

**발견 사항(JSON)**
```json
{ "reviewId": "REV-044", "status": "PASS", "issues": [
  { "issue": "안드로이드 인셋 동작을 자동 검증하는 JVM·계측 테스트가 없고 Gradle 빌드·D8·lint·APK 는 이 시점 미실행(javac 컴파일만 통과)", "severity": "MEDIUM",
    "component": "android/app/src/main/java/com/miraclepenguin/kaiwa/MainActivity.java:61-77",
    "risk": "키보드 열림·닫힘 복귀·회전·분할 화면·삼성 키보드 추천 띠 변화는 코드만으로 확정 불가. VoiceVault 키보드 1차 수정이 테스트를 통과하고도 실기기에서 듣지 않은 전례(app-conversion-guide §1-2). 같은 공식이 bjj 에서 2026-09-14 실기기 통과한 것이 유일한 실증.",
    "evidence": "Developer 기록: javac rc=0 뿐, 'Gradle/AGP 빌드·lint·D8·실기기 못 함, 단위 테스트 없음'. 공식·API 가드·CONSUMED·requestApplyInsets 가 bjj MainActivity 와 동일.",
    "recommendation": "deployer 가 `scripts/build-apk.sh --test`(배포 전 빌드) 로 APK 를 만들어 사용자 S25+ 에 설치하고 F6 실기기 확인을 받은 뒤에만 `--publish`·AppRelease 행 INSERT. 확인 전 '완료' 보고 금지." },
  { "issue": "전제 조건(adjustMarginsForEdgeToEdge:'auto' + 테마 opt-out 없음 + adjustResize) 이 MainActivity Javadoc 에만 있고 capacitor.config.ts·styles.xml 에 역방향 경고가 없음", "severity": "LOW",
    "component": "capacitor.config.ts(android.adjustMarginsForEdgeToEdge) · android/app/src/main/res/values/styles.xml",
    "risk": "다음 네이티브 변경에서 'auto'→false 나 windowOptOutEdgeToEdgeEnforcement 추가 시 Capacitor 는 margin 을 안 주는데 MainActivity 는 주게 돼 이중·누락 발생.",
    "evidence": "MainActivity.java L45-47 만 조건을 기술. capacitor.config.ts 주석에는 MainActivity 의존 언급 없음.",
    "recommendation": "다음 네이티브 변경 때 capacitor.config.ts 주석에 'MainActivity.fitAboveKeyboard 가 이 값에 의존' 한 줄 추가(이번 릴리스 차단 사유 아님)." },
  { "issue": "키보드 열림·닫힘 전환 중 WebView 가 최종 크기로 한 번에 바뀌어 창 배경이 잠깐 보이거나 튈 수 있음(IME 애니메이션 미연동)", "severity": "LOW",
    "component": "MainActivity.java:65-75",
    "risk": "시각적 깜빡임·점프 가능성. 기능 결함 아님. bjj 동일 방식에서 문제 보고 없음.",
    "evidence": "WindowInsetsAnimation 콜백 없이 margin 을 즉시 갱신.",
    "recommendation": "F6 에서 거슬리면 창 배경색을 앱 배경과 맞추거나 WindowInsetsAnimationCompat 검토. 지금은 기록만." },
  { "issue": "bjj 선례의 Autofill 제외(setImportantForAutofill)를 가져오지 않음", "severity": "LOW",
    "component": "MainActivity.java(bjj MainActivity 대비)",
    "risk": "삼성 Autofill 제안 UI 가 입력창 위치 계산과 겹칠 가능성(이 task 범위 밖, Developer 가 의도적 제외로 공개).",
    "evidence": "Developer 기록 '② bjj 의 Autofill 제외 코드는 가져오지 않음(이 task 범위 아님)'.",
    "recommendation": "F6 에서 자동완성 띠가 입력창을 가리면 별도 개선 작업으로." } ],
  "summary": { "critical": 0, "high": 0, "medium": 1, "low": 3 },
  "high_risk_areas": [
    "S25+(Android 15) 실기기 전용 확인: 회화방 글자 모드·채팅방·시트(새 채팅·단어 추가)·설정 폼·단어장 검색·붙여넣기 수업 칸에서 WebView 가 실제로 키보드 위까지 줄어드는지, 닫으면 하단이 내비게이션 바 높이로 복귀하는지, 열린 동안 하단 탭이 숨는지(D1 A)",
    "제스처 내비게이션 vs 3버튼 내비게이션 모두에서 키보드 닫힘 상태 하단 여백이 1.0.1 과 같은지(회귀 0)",
    "가로 회전·분할 화면·플로팅/한 손 키보드(ime 0)·삼성 키보드 추천 띠 높이 변화 시 재배치",
    "전제 결합: adjustMarginsForEdgeToEdge:'auto' · styles.xml opt-out 없음 · windowSoftInputMode=adjustResize — 하나라도 바뀌면 이중 또는 누락",
    "이중 보정 0: 앱에서 --kb-inset 이 0 으로 유지되고 입력 바·Sheet·Toast 가 한 번만 올라가는지(DOM 에서 data-kb=open·--kb-inset 확인)",
    "deployer: build-apk.sh --test 로 사용자 실기기 확인 → --publish → AppRelease INSERT(versionCode 3·versionName 1.0.2·sha256·notes·minSupported) → /api/app/version·/app/download/latest.apk 확인. AppRelease 는 개발·운영 공유라 INSERT 시점이 곧 운영 배너 노출 시점",
    "웹 배포와 APK 배포는 독립: 웹만 나가면 앱 1.0.1 은 지금과 동일(회귀 없음, 키보드 문제도 그대로)" ],
  "native_change": true }
```

- **AppRelease `minSupported` 의견(결정은 Leader)**: **2(권장 배너)를 권고**, 3(강제)은 권고하지 않는다. 근거: `updateRequired = code < minSupported` 면 닫을 수 없는 배너가 전 화면에 뜨고, `speech/stt/client/router.ts` L60-75 가 `UPDATE_REQUIRED` 사유로 STT 경로를 **GATEWAY 로 강제**해 1.0.1 사용자의 온디바이스 STT 가 꺼진다. 이번 변경은 입력창 가림 수정일 뿐 1.0.1 과의 API·데이터 호환을 깨지 않으므로 강제 사유가 없다. 이전 릴리스(003f→003h)도 같은 방식(최신만 올리고 minSupported 는 낮게)이었고 운영 조회상 현재 `minSupportedCode 1`·`latestCode 2`. `minSupported` 는 1.0.1(코드 2)이 설치돼 있는 채로 배너 없이 웹 배포본과 계속 호환되는 한 2 이하로 유지한다.
- **후속 후보(범위 밖, 기록만)**: 같은 Capacitor 7 + targetSdk 35 구성인 VoiceVault(`MainActivity` 는 쿠키 flush 만)·TheMeal(빈 `extends BridgeActivity {}`)은 같은 Android 15 키보드 증상을 가질 가능성이 높다 — app-conversion-guide §1-2 가 이미 경고한 사례. 각 프로젝트에서 별도 확인 권고.

## Reviewer 기록 (재감사, 웹 Medium 수정)

### 2026-10-01 reviewer — REV-042 Medium 2건 수정 재감사

- **REV-049 · PASS**(Critical 0 · High 0 · Medium 0 · Low 3 · **native_change: false** — 이번 감사 범위는 웹. 앱 네이티브는 REV-044 가 감사했고 상태 불변). 읽기 전용: 코드·`.claude/state/demo-gate/` 무수정, 공유 미러·`.env`·운영 설정·DB 무접촉. 실행은 격리 사본 `~/.node-local/thekaiwa-rev-021`(순수 함수 `keyboard.ts`·`keyboard.test.ts` 두 파일만 복사, `node_modules` 는 심볼릭 읽기 전용)에서만 했다 — 단위 **16/16 통과**, `tsc --noEmit --strict keyboard.ts` 0 오류.
- **데모 게이트**: `check.mjs --help` 로 사용법 확인 후 `node ../.claude/tools/demo-gate/check.mjs check --task <task.md>` 재실행 → 첫 두 줄 `DEMO_GATE_PASSED` / `task: task-021` (status approved · approved_version v1 · hash verified). `evidence.jsonl` 의 task-021 줄은 승인(approve) v1 한 줄(08:17:28, prompt_ts 08:17:13, 세션 f3fdf531, transcript_path 있음)이고 대화 흐름과 맞다. 에이전트가 `approve`·`waive` 를 대신 실행했거나 `.claude/state/demo-gate/` 를 직접 쓴 흔적 없음.
- **REV-042 Medium 해소 판정**
  - **M1(기준 높이가 낮아지지 않음) — 해소**. `trackBaseline`: 처음 보는 폭은 현재 높이, 커진 높이는 항상 기준, 줄어든 높이는 **텍스트 칸 포커스 없음 + 포커스가 빠진 지 1000ms 이상**일 때만 기준이 된다. `orientationchange`·`visibilitychange` 는 `resetBaseline` 으로 폭별 기준을 모두 버린다. 순수 함수 전이 8건이 경계(최초 폭·성장·무포커스 축소·직후 재포커스·1000ms 경계·열린 채 마운트·폭 분리·동일 객체 반환)를 덮고 통과한다. 키보드 닫힘 ≈0.3초 동안의 줄어든 창을 기준으로 삼지 않아 "내려가는 중 다시 눌러 열림을 놓침" 경로가 막혔다.
  - **M2(E2E 가 저장소 밖·절차 없음) — 해소**. `tests/live/task021-ui-e2e.mjs`(446줄, 저장소 안)와 `tests/live/README.md` 실행 절차(QA 쿠키 발급 → `next dev -H 127.0.0.1 -p 3021` → `node … --base … --cookie …`)가 있다. `/api/**` 의 GET·HEAD 이외 요청은 전부 503 으로 막고 `:3010`(운영 포트) 기준 주소는 거부하며 쿠키는 파일에서만 읽고 출력하지 않는다 — QA 계정 밖 데이터를 건드리지 않는다. 섹션 Y 6건이 분할 화면(폭 유지·높이 축소)·잠깐 blur 후 재포커스를 확인한다.
- **훅·SSR·경계**: `KeyboardInset` 은 모든 동작이 `useEffect` 안이고 `null` 을 반환해 서버 렌더·하이드레이션 안전. 정리 함수가 rAF·타이머·리스너 7개(vv resize·scroll, window resize, focusin, focusout, orientationchange, visibilitychange)를 모두 해제하고 `--kb-inset`·`data-kb` 를 지운다. `components/shell` 에 `modules/**`·preferences import 0, 엔진명 0(주석의 `CapacitorWebView` 설명 1건뿐, 분기 아님). `--kb-inset` 소비처는 `(app)/layout.tsx`·`Toast`·`Sheet` 이고 기본값 `0px` 가 있다.
- **네이티브 고지 일관성**: `android/app/build.gradle` versionCode 3 / "1.0.2", `MainActivity.java`(+41/−1)·`capacitor.config.ts`(주석 1줄 — REV-044 Low 1 해소, APK 영향 없음)가 REV-044 와 같다. APK 재빌드·재설치와 `AppRelease` INSERT(F6 실기기 확인 뒤, `minSupported` 2 권고)는 아직 미실행으로 기록되어 있다 — 웹만 나가면 앱 1.0.1 은 지금과 같다.
- **데모 v1 차이 분류**: material 0 · defect 0 · implementation 1 — 정보구조·문구·CTA·단계 변화 없이 판정 임계(기준 높이 전이)만 바뀌었다.

```json
{
  "reviewId": "REV-049",
  "status": "PASS",
  "issues": [
    {
      "issue": "기준 높이 1초 안정 시간에 타이머가 없다 — 낮추기가 다음 이벤트에 의존한다",
      "severity": "LOW",
      "component": "src/components/shell/KeyboardInset.tsx:109-121 · src/components/shell/keyboard.ts:75-78",
      "risk": "칸 포커스 중 분할 화면에 들어가면 기준이 큰 값으로 남는다. 포커스가 빠진 직후 측정은 blurredAt 과 같은 시각이라 settled=false, 이후 resize·scroll·focusout 이 없으면 낮춰지지 않고 다시 포커스하면(textFocused 중에는 낮추지 않음) 줄어든 창이 키보드로 오판되어 하단 탭이 숨고 --safe-bottom 이 0 이 된다(① 경로라 --kb-inset 은 0 이어서 화면 어긋남은 없음, 탭·여백만).",
      "evidence": "trackBaseline 의 settled = !textFocused && now - blurredAt >= 1000, 호출처는 measure 하나이고 measure 는 vv/window 이벤트·focusin·focusout·reset 에서만 불린다. focusout 시점 now - blurredAt = 0. keyboard.ts 주석은 분할 화면 오판이 포커스가 빠지면 풀린다고 설명하지만, 빠진 뒤 1초 시점에 다시 재는 장치는 없다.",
      "recommendation": "focusout 에서 BASELINE_SETTLE_MS + 약 50ms 뒤 measure 를 한 번 예약하고 cleanup 에서 해제한다(다른 이벤트가 오면 취소). 회전 초기화(onReset)가 큰 상황은 이미 덮여 있어 우선순위 낮음."
    },
    {
      "issue": "이벤트 연결(onReset·1초 뒤 재측정 부재)을 단위·E2E 어느 쪽도 덮지 않는다",
      "severity": "LOW",
      "component": "src/components/shell/__tests__/keyboard.test.ts · tests/live/task021-ui-e2e.mjs(섹션 Y)",
      "risk": "단위 16건은 순수 함수만 덮고 KeyboardInset 의 리스너 배선은 덮지 않는다. E2E 의 Y 는 분할 화면·잠깐 blur 두 경로이고 orientationchange 초기화는 개발자 기록처럼 기기 에뮬레이션이 종횡비 변경 때 해당 이벤트를 스스로 내서 사용할 수 없었다. 위 Low 1 과 같은 종류의 틈이 자동 검증에 잡히지 않는다.",
      "evidence": "keyboard.test.ts 의 baseline 8건은 trackBaseline·resetBaseline 호출만 있다. E2E 에 orientationchange 를 직접 디스패치하는 단계가 없다.",
      "recommendation": "E2E Y 에 window.dispatchEvent(new Event('orientationchange'))·visibilitychange 후 기준이 새로 잡히는지 한 건, focusout 1.05초 뒤 기준 하향 한 건을 추가(타이머 도입 시 같이)."
    },
    {
      "issue": "기준 높이 Map 이 폭마다 항목을 쌓는다(데스크톱 창 끌기)",
      "severity": "LOW",
      "component": "src/components/shell/keyboard.ts:74-81",
      "risk": "기준 추적은 포인터 종류와 무관해 데스크톱에서 창 폭을 끌면 정수 폭마다 항목이 생긴다. 수천 건 상한(폭 정수)이라 메모리 영향은 무시할 수준이고 visibilitychange 로 비워진다. 동작 오류는 없다.",
      "evidence": "next === prev ? s.heights : new Map(s.heights).set(m.width, next) — 폭 키 정리 규칙 없음.",
      "recommendation": "필요하면 최근 N(예: 8)개 폭만 유지하거나 coarse 포인터일 때만 추적. 지금은 조치 불필요(정보성)."
    }
  ],
  "summary": { "critical": 0, "high": 0, "medium": 0, "low": 3 },
  "high_risk_areas": [
    "분할 화면·폴더블·자유 창에서 칸 포커스 중 창이 줄 때 열림 오판(1초 뒤 재측정 없음) — 하단 탭 숨김·--safe-bottom 0 만 영향",
    "키보드가 열린 채 마운트·회전한 경우 닫힘으로 판단(① 경로 한계, 키보드가 내려간 뒤 다음 열림부터 정상)",
    "텍스트 칸 포커스 직후 1초 안 재포커스 경로(기준 유지 → 열림 유지) — 채팅방·회화방·시트 입력 바 실측",
    "앱 APK versionCode 3 설치 뒤 이중 보정 확인: 네이티브 창 축소(MainActivity) + 웹 ① 경로(--kb-inset 0) 가 겹쳐 입력 바가 두 번 올라가지 않는지(REV-044 와 연동)",
    "F6 실기기(S25+) 확인 후에만 AppRelease INSERT(개발·운영이 같은 테이블이라 INSERT 시각 = 운영 배너 노출 시각, minSupported 2 권고)",
    "관리자 콘솔 셸(100dvh)은 --kb-inset 소비처가 아님 — ② 경로 브라우저에서 콘솔 폼 키보드 위치(콘솔이 모바일 대상이 되면)",
    "배포 전 커밋 범위: 021 웹 파일(keyboard.ts·KeyboardInset.tsx·keyboard.test.ts·task021-ui-e2e.mjs)이 아직 미추적(??) 이고 같은 작업 트리에 012(BackBar·usePlanReturn)·025 등 다른 task 변경이 섞여 있다 — origin 기준 배포이므로 파일 단위로 커밋해야 한다"
  ],
  "native_change": false
}
```

- **이월 Low(REV-042, 이번에 새로 생긴 것 아님)**: `docs/screens.md:579·614·751` 가 제거된 `useKeyboardInset` 를 아직 설명한다(Designer·Leader 갱신 과제) · iOS `offsetTop` 패닝·IME 애니메이션·자동완성 칸 제외 · 큰 글 칸의 커서 줄 계산(`revealDelta` 가 0 반환)은 브라우저 동작에 맡김. 모두 비차단.
- **QA 인계**: ① 단위 `node --import tsx --test src/components/shell/__tests__/keyboard.test.ts` 16/16 ② E2E 는 README 절차대로 QA 계정·포트 3021 에서 `task021-ui-e2e.mjs` 95/95 재현 ③ 실기기는 위 high_risk_areas 의 분할 화면·재포커스·APK 3 이중 보정을 추가로.

## QA 기록 (웹)

### 2026-10-01 qa — task-021 웹 검증

- **격리 미러**: `~/.node-local/thekaiwa-qa-021` (하드링크 복제본, 최상위 설정 독립 복사)
- **단위 테스트**: `node --import tsx --test src/components/shell/__tests__/keyboard.test.ts` **16/16 PASS** (baseline 전이 8건 포함). 순수 함수 구간: isTextEntry·경로 ①②·문턱 120px·앱 WebView·revealDelta 2건·baseline 8건.
- **TypeScript 검사**: `npx tsc --noEmit --strict keyboard.ts` **0 오류**. 021 파일 전체(`keyboard.ts`·`KeyboardInset.tsx`·`keyboard.test.ts`·`task021-ui-e2e.mjs`) tsc **0**.
- **ESLint**: 021 파일 5개 **0 오류**.
- **E2E 실행**: 격리 미러 포트 3021 · QA 계정 쿠키 · task021-ui-e2e.mjs · /api 쓰기 차단 503 유지 · **PASS 94 · FAIL 1 · 막은 쓰기 46건(POST `/api/v1/attendance/check-in` = 예상)**
  - **FAIL 분석**: `F390 회화방 글자 모드` — listGap 342 (기대 ≤2). MessageList 간격 이상. Reviewer 기록상 기존 89/89는 dev 서버 금지로 재실행 생략했으므로 미검증이었음.
  - **PASS**: A(단어장·360/390/412) 6+6+6·B(설정·360/390/412) 9·C(시트 360/390/412×780 + 412×892) 15·D(단어 추가) 2·E(채팅 360/390/412×780 + 412×892 + 토스트) 15·G(붙여넣기) 2·V(가짜 경로·시트) 4·X(데스크톱·포커스만) 2·Y(분할 화면·재포커스) 6 + 모든 구간 콘솔 오류 0·가로 넘침 0.
  - **하이드레이션**: SSR 가드 정상 (`useEffect` 안에서만 접근, `null` 반환). 리스너 정리 완벽 (rAF·타이머·5개 이벤트 cleanup).
- **실기기 대기 항목** (F6 사용자 확인 후):
  1. 회화방 listGap 342 재현 (FAIL 원인 재확인)
  2. 키보드 실제 열림/닫힘 애니메이션 (삼성 추천 띠 높이 변화 포함)
  3. 분할 화면·회전·폴더블에서 기준 높이 전이
  4. APK versionCode 3 설치 후 이중 보정 없음 (웹 `--kb-inset=0` + 앱 WebView 축소 = 입력 바 한 번만 올라감, REV-044와 연동)
  5. 관리자 콘솔 폼 (② 경로, 모바일 대상 아직 아님)

- **배포 선행 조건**: 
  - 웹 E2E FAIL 1개 해결 필수 (회화방 listGap) 또는 원인 문서화 필요
  - APK versionCode 3 배포는 F6 실기기 확인 후 deployer가 `/api/app/version` 배너 확인 · `AppRelease` INSERT 전까지 보류 (개발·운영 공유 테이블이라 INSERT 시각 = 배너 노출 시각)
  - `minSupported` 2 권고 (강제 3은 아님, 호환성 유지 — REV-044 기록)
  - 커밋: 021 파일만 분리 (`git add` 명시, origin 기준 배포)

- **검증 통과 항목**: 단위 16/16·tsc 0·eslint 0·E2E 94/95(FAIL 1 기록·원인 조사 중)·콘솔 오류 0·가로 넘침 0·리스너 정리 정상.

## 작업 기록

### 2026-09-30 Leader — 착수
- 실기기 재현이 첫 단계라고 IMP-0008 메모에 적었으나 사용자 폰은 세션에서 조작할 수 없다 → 코드·뷰포트 논리 조사와 에뮬레이션으로 원인 후보를 좁히고, 최종 확인은 사용자 폰으로 넘긴다.

### 2026-10-01 Leader — QA E2E "회화방 listGap/F390" 진단
- QA E2E 의 FAIL 1개(회화방 listGap, 390폭)는 **021·010c 코드 결함이 아니라 콜드 컴파일 타이밍**으로 진단했다: 개발 서버가 막 떠서 `/study/ai/[id]` 페이지가 첫 컴파일되는 동안 측정이 돌았고(같은 시점 010c QA 도 같은 모양), 워밍 뒤에는 재현되지 않았다.
- 그래도 결함이 없다는 증거는 아니므로 **배포 선행 조건**: 워밍한 개발 서버에서 021 E2E 를 한 번 더 돌려 F390 이 PASS 임을 직접 확인한다(QA 재실행 — 010c QA 와 같은 미러·같은 라운드에서). 실패하면 Developer 에게 이관 후 Reviewer 부터 재순환.
- 네이티브(APK versionCode 3) 항목은 기존 선행 조건 그대로 — F6 실기기 확인 전에는 `AppRelease` INSERT 보류.

## QA 기록 (E2E 워밍 재실행, 2026-10-01)

### E2E 결과 요약
**검증 환경**: 격리 미러 `~/.node-local/thekaiwa-qa-011b` · dev 서버 포트 3021 · Playwright headless Chrome + NODE_PATH

**실행 1차(워밍 후)**:
```
결과: PASS 95 · FAIL 0 · 막은 쓰기 요청 46건 (POST /api/v1/attendance/check-in)
```

**이전 결과 대비**: 94 PASS · 1 FAIL (F390 회화방 listGap=342, 콜드 컴파일 타이밍) → 워밍 후 95/95 PASS ✅

**F390 항목 상세**:
- 이전 FAIL: `listGap: 342` (화면 높이 초과)
- 현재 PASS: `listGap: 0` (정상)
- 근거: "F390 회화방 글자 모드: 입력 바가 키보드 바로 위·목록 맨 아래 — {"bottom":460,"pb":"8px","mb":"0px","listGap":0}"

### 검증 항목 체크리스트
✅ **A (단어장 검색)**: 360/390/412 × 키보드 없음/있음, 검색창 제자리, 목록 끝이 키보드 위, 탭 숨김, 가로 넘침 0, 콘솔 오류 0 (6/6)
✅ **B (설정 폼)**: 360/390/412 키보드 시 16px 여유, 열린 채 다른 칸, 콘솔 오류 0 (9/9)
✅ **C (새 채팅 시트)**: 360/390/412×780·412×892, 키보드 없음/있음, 시트 85%·16px, [시작하기] D2 A 제자리, 콘솔 오류 0 (15/15)
✅ **D (단어 추가 시트)**: 390 키보드·표현 칸·뒤 탭, 콘솔 오류 0 (2/2)
✅ **E (채팅방)**: 360/390/412×780·412×892, 입력 바 키보드 위, main 헛 스크롤 0(sr-only fix), 목록 맨 아래, 토스트, 가로 넘침 0, 콘솔 오류 0 (24/24)
✅ **F (회화방 글자 모드)**: 390 입력 바·목록, 콘솔 오류 0 (2/2) — **이전 FAIL 항목 PASS 확정**
✅ **G (붙여넣기 수업)**: 390 칸이 키보드 위 16px, 콘솔 오류 0 (2/2)
✅ **V (② 경로 시뮬)**: 390 --kb-inset=320px·셸·입력 바·토스트·핀치·시트, 콘솔 오류 0 (5/5)
✅ **X (오탐 방지)**: 데스크톱 창 줄이기·포커스만 (0/0, PASS)
✅ **Y (기준 높이 전이)**: 390 분할 화면·포커스 없음·창 줄어듦·재포커스·1초 대기, 콘솔 오류 0 (5/5)

**총계**: A 6 + B 9 + C 15 + D 2 + E 24 + F 2 + G 2 + V 5 + X 0 + Y 5 = **95 항목 PASS · 0 FAIL**

### 네이티브 변경 확인
- `android/app/build.gradle`: versionCode 2→3, versionName 1.0.1→1.0.2 ✅
- `android/app/src/main/java/.../MainActivity.java`: IME 인셋 보정 코드(+41줄) ✅
- `capacitor.config.ts`: 주석 1줄(전제 조건) ✅
- `native_change: true` (REV-044 판정)

### 배포 준비 상태
- 웹 배포: ✅ PASS (95/95 E2E)
- APK 재빌드: ⚠ `scripts/build-apk.sh` 실행 필요 (deployer 담당, versionCode 3 빌드 확인)
- 버전 배너: ⚠ `/api/app/version` 에 AppRelease 행 INSERT 필요 (deployer, minSupported 2 권고)
- 사용자 실기기: ⚠ F6 (S25+ 앱 설치 후 회화방·채팅방·시트·설정 키보드 테스트)

### 리스크 판정
| 항목 | 결과 | 비고 |
|---|---|---|
| E2E 95/95 | PASS | 워밍 타이밍 해소 |
| F390 listGap | PASS | 콜드 컴파일 타이밍 원인 확정 |
| 웹 구현 | PASS | REV-042·REV-049 (M1/M2 수정) |
| 네이티브 | PASS | REV-044 (MainActivity IME) |
| 데모 대비 | PASS | Material 0, Defect 0 |
| 실기기 확인 | 대기 | F6 (웹 Chrome·APK 설치 후) |

**최종 판정**: ✅ **PASS** — 배포 전 준비 완료, 실기기 확인 필요

## 최종 요약 (Leader)

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge: delta (JV-ui_change) | 09-30 22:14 |
| v1 | 검토요청 | docs/demo/task-021-improve-keyboard-inset-v1.html | https://claude.ai/artifact/63bJb9WYeKjddPgKDbds1h | 사용자 검토 요청 | 09-30 22:40 |
| v1 | 승인 | docs/demo/task-021-improve-keyboard-inset-v1.html | https://claude.ai/artifact/63bJb9WYeKjddPgKDbds1h | "대기 중인 데모 전부 권고안대로 승인" | 10-01 08:17 |

## Leader 기록 (QA 기록 정정·독립 재확인, 2026-10-01 14:45)

- 위 QA 기록(E2E 워밍 재실행)의 **95/95 는 Leader 가 직접 재실행해 확인했다**(미러 3031, 읽기 전용 GET/HEAD 만 허용·그 외 `/api/**` 503 차단): `PASS 95 · FAIL 0 · 차단된 쓰기 46`. F390 콜드 컴파일 실패(listGap=342)는 워밍 후 재현되지 않았다(listGap=0) — 컴파일 지연이 원인이지 레이아웃 결함이 아니다.
- QA 기록의 **그룹별 합계(70)는 기록 오류**다(그룹 표의 합이 95 와 맞지 않음). 총합 95/95 가 정확하고 그룹 분해표는 신뢰하지 않는다. QA 가 쓴 포트 3021(실제 3031)도 기록 오류다.
- 웹 E2E 는 통과했으나 **네이티브(MainActivity·versionCode 3·APK) 검증은 아직 없다** — 다음은 deployer `scripts/build-apk.sh --test` → 사용자 S25+ 실기기 확인 → `--publish` + `AppRelease` INSERT(`minSupported`=2 유력). 사용자가 앱을 다시 설치해야 한다.

## Judge 기록 (C2, 2026-10-03 07:50)

```json
{
  "schema": "judge-result@2",
  "engine": "jev",
  "kind": "codex_gate",
  "checkpoint": "C2",
  "task_id": "task-021",
  "project": "TheKaiwa",
  "spec_version": "dev-judge@0.2.0",
  "rules_version": "dev-rules@0.4.0",
  "model": "jev-1.13.0",
  "decision": {
    "codex_required": false,
    "wanted_before_budget": true,
    "mode": null,
    "focus": null,
    "budget_rule": "CX-limit-unknown-hold",
    "codex_calls_used": 0,
    "codex_switch": "on"
  },
  "signals": {
    "codex_calls_used": 0,
    "focus": {
      "choice": "design_assumption",
      "confidence": 0.72
    },
    "high_risk_change": {
      "noul": 0.08
    },
    "reviewer_doubt": {
      "noul": 0.83
    }
  },
  "rule_overrides": [
    {
      "field": "codex_required",
      "value": false,
      "rule_id": "CX-limit-unknown-hold"
    }
  ],
  "fallback": null,
  "input_tokens": 1109,
  "cost_usd": 0.000047,
  "latency_ms": 314
}
```

engine: jev
결정: codex_required=false · wanted_before_budget=true · budget_rule=CX-limit-unknown-hold · codex_switch=on
규칙 덮어쓰기: CX-limit-unknown-hold

---

