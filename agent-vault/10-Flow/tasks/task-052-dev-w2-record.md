---
task: task-052
role: developer
agent: dev-W2
tags:
  - type/task-record
  - domain/native
---
# task-052 Developer 기록 — dev-W2 (REV-181 M-1·L-1 수정)

[[task-052-improve-kakao-share-target]] · 감사 [[task-052-rev-record]] (REV-181) · 기준 커밋 `8e77a6a` · **미커밋**

## Developer 기록
- [10:46] 데모 게이트 확인(화면 파일 수정 전) — `node ../.claude/tools/demo-gate/check.mjs check --task agent-vault/10-Flow/tasks/task-052-improve-kakao-share-target.md`
  ```
  DEMO_GATE_PASSED
  task: task-052
  status: approved
  approved_version: v1
  demo: docs/demo/task-052-share-target-v1.html
  ```
- [10:47] **M-1** `src/components/lesson/LessonPasteScreen.tsx`
  - 순수 함수 `dropShareMark(h: Pick<History,'state'|'replaceState'>)` 추가(export) — `h.replaceState(h.state, '', SHARE_PASTE_PATH)`. 주석에 이유(풀 페이지 로드에서 화면 effect 가 Next history 패치 설치보다 먼저 → `null` 이면 `__NA`·트리 상태가 지워져 기기 뒤로 가기 무시, `ChallengeScreen` 과 같은 방식).
  - 마운트 effect 의 `window.history.replaceState(null, '', SHARE_PASTE_PATH)` → `dropShareMark(window.history)`. 이 파일의 `replaceState` 는 이 한 곳뿐이었다.
  - 동작 변화 없음(클라이언트 이동 경로에서는 패치된 `replaceState` 가 같은 값을 다시 복사).
- [10:47] **L-1** `android/app/src/main/java/com/miraclepenguin/kaiwa/MainActivity.java`
  - 상수 `SHARE_BODY_EXTRAS = { EXTRA_TEXT, EXTRA_HTML_TEXT, EXTRA_SUBJECT, EXTRA_TITLE }` 추가, `forgetShare` 가 이 배열을 돌며 `removeExtra`. ClipData 제거·`SHARE_HANDLED` 표시·예외 경로(본문/메시지 로그 없음)는 그대로.
  - 상수 존재 확인: 컴파일된 `MainActivity.class` 의 `javap -constants` 에 `android.intent.extra.TEXT`·`HTML_TEXT`·`SUBJECT`·`TITLE` 4개(아래).
  - **네이티브 변경** — 1.0.3(versionCode 4)이 아직 배포 전이고 같은 task 안의 수정이라 versionCode 는 올리지 않았다(이미 3→4 로 올라가 있음). 배포본이 나간 뒤라면 올려야 한다 — Leader 판단.
- [10:47] 시험 추가 `src/components/lesson/__tests__/pasteShareHistory.test.ts` (2건): ① 지금 `history.state` 객체를 **같은 참조**로 넘기고 주소는 `SHARE_PASTE_PATH`(`from=share` 없음) ② state 가 `null` 이면 `null` 그대로.
  - 변이 확인: 미러에서 `h.state` → `null` 로 바꾸면 ① 실패(`# pass 1 · # fail 1`), 원복 후 통과.

## 실행 증빙 (2026-10-11, 전용 미러 `~/.node-local/thekaiwa-share052f`, node_modules = `cp -al ~/.node-local/thekaiwa-share052w/node_modules`)
- `KAIWA_LOCAL_ROOT=$HOME/.node-local/thekaiwa-share052f bash scripts/sync-local.sh` → rc=0
- `./node_modules/.bin/tsc --noEmit` → `tsc rc=0` (출력 없음)
- `./node_modules/.bin/eslint src/components/lesson/LessonPasteScreen.tsx src/components/lesson/__tests__/pasteShareHistory.test.ts` → `eslint rc=0` (출력 없음)
- `DATABASE_URL="mysql://invalid:invalid@127.0.0.1:1/invalid" node --import tsx --test <src/components/{lesson,shell}·src/modules/infra 아래 *.test.ts 26개>` →
  ```
  test rc=0
  # tests 205
  # suites 0
  # pass 205
  # fail 0
  # cancelled 0
  # skipped 0
  ok 37 - dropShareMark — 지금 history.state 를 같은 객체로 넘기고 주소만 표시 없는 경로로(REV-181 M-1)
  ok 38 - dropShareMark — state 가 null 이면 null 그대로(새로 만들지 않는다)
  ```
- Java 컴파일 + JUnit — 전용 gradle 작업 디렉터리 `~/.node-local/thekaiwa-apk-052f`(dev-N 의 `thekaiwa-apk-052n` 에서 android·plugins·public·AAR 은 `cp -a`, node_modules 는 `cp -al` 후 그 안의 android `build/` 5개만 실제 복사로 분리 — 052n 원본 무변경). 수정한 `MainActivity.java` 를 덮어쓰고 `./gradlew :app:compileReleaseJavaWithJavac :app:testReleaseUnitTest --no-daemon -PsherpaOnnxAar=…` (JDK 21) →
  ```
  gradle rc=0
  > Task :app:compileReleaseJavaWithJavac
  > Task :app:testReleaseUnitTest
  BUILD SUCCESSFUL in 14s
  testsuite name="com.miraclepenguin.kaiwa.SharedTextHolderTest" tests="12" skipped="0" failures="0" errors="0"
  testsuite name="com.getcapacitor.myapp.ExampleUnitTest" tests="1" skipped="0" failures="0" errors="0"
  ```
  `javap -p -c -constants MainActivity.class` → `private static final java.lang.String[] SHARE_BODY_EXTRAS;` 초기화에 `android.intent.extra.TEXT`·`HTML_TEXT`·`SUBJECT`·`TITLE`.
- 단독 `javac`(dev-N ①)은 `SharedTextHolder` 순수 Java 용이라 Capacitor·androidx 를 참조하는 `MainActivity` 에는 쓰지 않았다 — gradle `compileReleaseJavaWithJavac` 로 대신 확인.
- `npm run build`·`npm run dev`·포트·DB 접속·APK 빌드(assembleRelease)는 하지 않음.

## 못 한 것·남긴 것
- **L-1 JUnit 없음** — `forgetShare` 는 `android.content.Intent` 를 다루는데, 로컬 JVM 시험의 android.jar 는 스텁(`Stub!` RuntimeException)이고 `forgetShare` 가 RuntimeException 을 삼키므로 시험이 공허하게 통과한다. Robolectric 은 의존성에 없고, 들이면 신규 의존성(에스컬레이션 대상)이다. 상수 배열 내용만 확인하는 시험은 코드를 그대로 옮겨 적는 것이라 넣지 않았다.
- **M-1 브라우저 확인 없음** — 풀 페이지 로드 뒤 `history.state.__NA` 유지·기기 뒤로 가기 복귀는 서버·브라우저 금지 범위라 미확인(QA 항목: rev-record 「QA 에 넘길 것」 1번).
- **범위 밖, 고치지 않음**: 같은 `replaceState(null, …)` 패턴이 `src/components/plan/PlanScreen.tsx` 에 2곳 있음(82행·118행).
- 실기기 동작(L-1) 미확인 — 기기 없음.

## 미커밋 파일
- `src/components/lesson/LessonPasteScreen.tsx` (M)
- `android/app/src/main/java/com/miraclepenguin/kaiwa/MainActivity.java` (M)
- `src/components/lesson/__tests__/pasteShareHistory.test.ts` (신규)
- `agent-vault/10-Flow/tasks/task-052-dev-w2-record.md` (이 파일, 신규)
