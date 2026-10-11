---
task_id: task-052
role: developer (dev-N — 네이티브·브리지)
tags:
  - type/task-record
  - domain/native
---
# task-052 dev-N 기록 — 네이티브(안드로이드)·브리지

> 이력서: [[task-052-improve-kakao-share-target]] 「Leader 결정 — 구현 계약」. 이 파일만 dev-N 이 쓴다(이력서 본문 수정 금지).

## 네이티브 변경 고지
- **APK 재설치 필요** — `android/**`(Manifest intent-filter·MainActivity·새 Java 클래스 2개)·`android/app/build.gradle` versionCode 3→4(1.0.3). 서버 `AppRelease`·`/api/app/version` 은 손대지 않음(deployer).

## 체크포인트
- [10:20] 착수 — 읽음: 이력서(계약·설계·하지 않는 것), MainActivity.java·AndroidManifest.xml·app/build.gradle(kaiwaVersionCode 3)·capacitor.config.ts·infra/native/{bridge,appLogin,index}.ts·nativeBoundary.test.ts(② `window.Capacitor` 읽는 곳은 bridge.ts 하나 — sharedText.ts 는 `getBridge()` 경유로 써야 함)·tests/live/fake-capacitor.js·scripts/build-apk.sh(인자 없이 돌리면 `$WORK/out/` 로컬 복사만, `--publish` 때만 DATA_ROOT/releases 복사, AppRelease 는 스크립트가 넣지 않음). docs/screens.md 에는 아직 공유 수신 가이드 없음(designer 작업 전).
- [10:45] 구현 1차 — Java: `SharedTextHolder`(순수 Java, 인스턴스+시계 주입, 정적 싱글턴은 `SharedTextPlugin.HOLDER`=elapsedRealtime) · `SharedTextPlugin`(`peek`/`consume`/이벤트 `sharedText` 본문 없음, reject 없음) · `MainActivity`(super.onCreate 앞 registerPlugin + 콜드 스타트 Intent 처리, onNewIntent 는 super 전에 처리) · Manifest SEND/text/plain 필터 · versionCode 4/1.0.3 · JUnit `SharedTextHolderTest`. TS: `infra/native/sharedText.ts`(3함수)·`listen.ts`(bridge.ts 의 내부 `listen` 을 옮김 — index 로 안 나감)·bridge.ts `Plugins.SharedText` 타입·index.ts 공개·`__tests__/sharedText.test.ts`. fake-capacitor.js SharedText 흉내(`share`·`expireShare`·`noSharedText`·INIT `sharedText`) — node 스모크 통과.
  - 주의(설계 근거): `BridgeActivity.load()` 가 super.onCreate 안에서 `this.onNewIntent(getIntent())` 를 부른다(Capacitor 7.6.9 소스 확인) → 콜드 스타트 Intent 를 super.onCreate 전에 처리하고 Intent 에 「처리함」 extra + EXTRA_TEXT·ClipData 제거. Bridge 생성 때 Cordova 설정이 `getIntent().getExtras()` 를 읽으므로(Bridge.java 1593) 본문이 그 전에 지워지는 게 맞다.
  - 미커밋 파일: android/app/src/main/AndroidManifest.xml · android/app/build.gradle · android/app/src/main/java/com/miraclepenguin/kaiwa/{MainActivity,SharedTextHolder,SharedTextPlugin}.java · android/app/src/test/java/com/miraclepenguin/kaiwa/SharedTextHolderTest.java · src/modules/infra/native/{bridge,index,sharedText,listen}.ts · src/modules/infra/__tests__/sharedText.test.ts · tests/live/fake-capacitor.js
  - 다음 첫 행동: 전용 미러 `~/.node-local/thekaiwa-share052n` 동기화 → tsc·eslint·시험 → APK 전용 작업 디렉터리 `~/.node-local/thekaiwa-apk-052n` 로 build-apk.sh(인자 없음 — `--publish` 금지) + `:app:testReleaseUnitTest`.
- [10:40] Leader 계약 보완 반영(D5): `ACTION_SEND`+`text/plain` 인데 EXTRA_TEXT 없음·빈 문자열·공백뿐(전각 공백·NBSP 포함)이어도 「도착함」으로 보관 → peek true · consume `{text:'', truncated:false}` 1회 · 두 번째 null. 네이티브 `SharedTextHolder.put` 이 null/공백 → "" 로 보관, TS `consumeSharedText` 도 공백뿐이면 `''` 로 한 번 더 맞춤. 본문 있는 경우(10,000 코드포인트·truncated)·다른 MIME·SEND_MULTIPLE 무시는 그대로. SSR·루트 레이아웃 안전 시험 추가(window 없이 import·호출 → 전역 생성 없음, Capacitor 없는 브라우저 no-op).

## 실행 증빙 (2026-10-11, 전용 미러 `~/.node-local/thekaiwa-share052n` · APK 작업 디렉터리 `~/.node-local/thekaiwa-apk-052n`)
- `tsc --noEmit` → rc=0 (출력 없음)
- `eslint src/modules/infra/native src/modules/infra/__tests__/sharedText.test.ts tests/live/fake-capacitor.js` → rc=0 (출력 없음)
- `node --import tsx --test sharedText.test.ts nativeBoundary.test.ts sttClientBoundary.test.ts` (DATABASE_URL=invalid) → `# tests 14 · # pass 14 · # fail 0` — 「② window.Capacitor 를 읽는 곳은 bridge 하나」 ok(sharedText.ts 는 getBridge 경유).
- JUnit `SharedTextHolderTest`: ① 단독 `javac`+JUnitCore 4.13.2 → `OK (12 tests)` ② gradle `:app:testReleaseUnitTest` → `testsuite com.miraclepenguin.kaiwa.SharedTextHolderTest tests="12" failures="0" errors="0"`, BUILD SUCCESSFUL.
- APK: `THEKAIWA_APK_WORK=~/.node-local/thekaiwa-apk-052n bash scripts/build-apk.sh`(인자 없음 — `--publish` 안 씀, DATA_ROOT·AppRelease 손대지 않음, 운영 작업 디렉터리 `thekaiwa-apk` 도 안 건드림) → rc=0
  ```
  APK        : ~/.node-local/thekaiwa-apk-052n/out/thekaiwa-1.0.3-4.apk
  versionCode: 4  versionName: 1.0.3  abi: 'arm64-v8a'
  size       : 35216161 bytes
  sha256     : f7e04e6ded264b62b6044c7774f90e1f9846a44b67842b6bd7a6fb0e4e21acfc
  signer     : SHA-256 a4c23dca02f56db088b93a310913ffc639ced8a915ee4be3588abf07d9da9e47
  debuggable : no
  ```
  (이 sha256 은 로컬 미커밋 상태 산출물 — 배포본이 아니다. deployer 가 origin 기준으로 다시 빌드한다.)
- 병합 Manifest(`aapt2 dump xmltree --file AndroidManifest.xml`) — MainActivity(exported=true, launchMode=2=singleTask) 필터 3개: MAIN/LAUNCHER · VIEW/DEFAULT/BROWSABLE `thekaiwa://auth/callback` · **`android.intent.action.SEND` + `android.intent.category.DEFAULT` + `mimeType="text/plain"`**. `SEND_MULTIPLE` 0건. `aapt2 dump badging` → `versionCode='4' versionName='1.0.3'`, label 'Lingofy Japanese'.
- classes.dex 에 `SharedTextHolder`·`SharedTextHolder$Clock`·`SharedTextHolder$Shared`·`SharedTextPlugin` 포함 확인. (`capacitor.plugins.json` 에는 없음 — npm 플러그인이 아니라 MainActivity.registerPlugin 등록이라 정상.)
- 기기: 서버에 에뮬레이터 없음(SDK 에 `emulator/` 없음)·`adb devices` 연결 기기 0 → 실기기 동작은 미확인(확인 뒤 adb 서버 종료).

## 설계-코드 차이
- **빈 공유 보관**(Leader 지시 원문 「EXTRA_TEXT 가 문자열일 때만 보관」 → 계약 보완으로 변경): 위 [10:40]. EXTRA_TEXT 가 문자열이 아닌 경우도 「빈 공유」로 본다(getCharSequenceExtra 가 null).
- 보관함은 「정적 클래스」 대신 **인스턴스 + 정적 싱글턴**(`SharedTextPlugin.HOLDER`) — 시계 주입·시험 격리 때문. 메모리만인 점은 같다.
- `listen()` 헬퍼를 bridge.ts 에서 내부 모듈 `infra/native/listen.ts` 로 옮김(동작 동일) — sharedText.ts 가 같이 쓰되 index.ts 공개 API 로 새지 않게.
- consume 응답에 본문이 없을 때 네이티브는 `{}` 를 resolve(null 을 resolve 할 수 없음) → TS 가 null 로 바꾼다. 네이티브는 reject 하지 않는다(Capacitor 는 오류 응답 data 를 debug 로그에 찍음).
- 활동 재생성 대책: `savedInstanceState != null`(프로세스 복구)·`FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY`(최근 앱에서 다시 열기 — 시스템이 처음 SEND Intent 를 되살려 줌)면 받지 않음 + 처리한 Intent 는 EXTRA_TEXT·ClipData 제거·「처리함」 extra. 회전은 Manifest configChanges 로 원래 재생성되지 않음.

## 보안 확인
- 본문 경로: Intent → `SharedTextHolder`(메모리) → `consume` resolve 값 → TS 반환값. 로그 호출 0(Java·TS 모두 `Log`/`console` 없음), 디스크·SharedPreferences·URL 없음, `Shared.toString` 미정의(시험으로 본문 미노출 확인). 예외는 삼키되 메시지를 남기지 않음.
- Capacitor: 성공 응답 data 는 로그에 안 찍히고 오류 응답만 debug 로그 — 플러그인은 reject 하지 않음. 운영 설정 `loggingBehavior:'none'` 이라 호출 기록도 없음(capacitor.config.ts 확인).
- 콜드 스타트 Intent 를 `super.onCreate` 전에 비워 Bridge·Cordova 설정(`getIntent().getExtras()`)·다른 플러그인(`handleOnNewIntent`)이 본문을 보지 않음. onNewIntent 도 super 호출 전에 비움.
- 이벤트 `sharedText` 는 빈 객체 — 본문은 consume 으로만.

## dev-W 참고
- `import { peekSharedText, consumeSharedText, onSharedText, SHARED_TEXT_MAX_CODE_POINTS } from '@/modules/infra/native'`. 비앱·SSR·예전 APK(1.0.2 이하, 플러그인 없음)에서 false/null/빈 해제 — import 만으로 부작용 없음.
- `consumeSharedText()` 결과 `text === ''` = 빈 공유(D5 토스트). `truncated: true` = 1만 자 초과로 잘림(2,000자 초과 [자르기] 와는 별개).
- 앱이 켜진 채 공유가 오면 네이티브는 `onNewIntent` → `sharedText` 신호를 보내고, 이어서 App `resume` 도 온다 — 둘 다 peek 으로 처리하면 중복 이동만 막으면 된다(consume 은 네이티브가 1회만 줌).
- QA 흉내: `tests/live/fake-capacitor.js` — 콜드 스타트 `__FAKE_CAP_INIT={sharedText:'…'}`, 켜진 앱 `__fakeCap.share('…',{signal:false?, truncated?})`, 만료 `__fakeCap.expireShare()`, 예전 APK `__FAKE_CAP_INIT={noSharedText:true}`, 오류 `__fakeCap.failNext(code)`.

## 미확인 (실기기 필요)
- 카톡 「공유」 목록에 Lingofy 노출 · 콜드/웜 두 경로에서 붙여넣기 화면 채움 · 로그인 왕복(Custom Tab) 사이 프로세스가 죽으면 보관함이 사라지는 빈도 · 최근 앱에서 다시 열 때 예전 공유가 되살아나지 않는지 · 카톡이 넘기는 MIME 이 정확히 `text/plain` 인지.
- [10:55] 전체 단위 시험(전용 미러, `find src scripts/seed-build -name '*.test.ts'`, DATABASE_URL=invalid) → `# tests 2962 · # pass 2961 · # fail 0 · # skipped 1` rc=0. ※ 이 전체 실행은 D5 보완 직전 상태에서 시작(bridge.ts `listen` 이동 영향 확인용) — 보완 뒤 바뀐 sharedText.ts·시험은 위 14/14 대상 실행·tsc 0 으로 다시 확인. 상태: **DONE(dev-N 범위)** — 커밋 안 함(Leader). 실기기 확인은 「미확인」 절.
