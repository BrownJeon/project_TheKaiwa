---
task: task-052
role: reviewer
agent: rev-181
tags:
  - type/task-record
  - domain/native
  - domain/lesson
---
# task-052 Reviewer 기록 (REV-181) — 네이티브(dev-N)·브리지·화면(dev-W)

> 이력서 [[task-052-improve-kakao-share-target]] · [[task-052-dev-n-record]] · [[task-052-dev-w-record]]. 읽기 전용 감사 — 코드·문서는 고치지 않았다. 스냅샷 `8e77a6a` → `~/.node-local/thekaiwa-rev181-src`(node_modules 는 share052w 를 `cp -al`).

## Reviewer 기록 (REV-181)

### 중간 체크포인트 1 (약 26턴)
- 재현 확인: tsc rc=0 · 시험(`find src/components src/modules/infra src/modules/learning src/types scripts/seed-build`) 1547 pass / 0 fail · `next build` rc=0(스냅샷, `.env` 없이 DATABASE_URL 만 invalid) · JUnit `SharedTextHolderTest`(단독 javac+JUnitCore 4.13.2) `OK (12 tests)`.
- Capacitor 7.6.9 소스 확인(`~/.node-local/thekaiwa/node_modules/@capacitor/android`): `BridgeActivity.load()` 가 `this.onNewIntent(getIntent())` 를 부른다(콜드 스타트에서 Intent 한 번 더) · `registerPlugin` 은 `bridgeBuilder.addPlugin`(load 가 `addPlugins(initialPlugins)` 뒤 `create()`) · `PluginCall.reject(msg, code, ex, data)` 는 data 를 응답에 싣고 `MessageHandler` 가 `Logger.debug("Sending plugin error: " + data)` — dev-N 의 「reject 하지 않는다」 근거는 맞다.
- 확인함(문제 없음): Manifest 필터 1개(SEND+DEFAULT+text/plain)·기존 LAUNCHER/VIEW/singleTask/exported 유지 · `takeShare` 가 `super.onCreate` 앞에서 Intent 를 비우고 HANDLED 표시 → `load()` 의 두 번째 `onNewIntent` 에서 재처리 없음 · 로그인 딥링크(VIEW)는 `takeShare` 첫 줄에서 SEND 가 아니라 즉시 반환 → 보관 공유를 건드리지 않음 · 서버 `callbackUrl` 검증(`sanitizeNextPath`: 제어문자 거부·같은 출처·`//` 거부)은 변경 없고 새 코드는 상수 `SHARE_LOGIN_HREF` 만 만든다 → 오픈 리다이렉트 신설 없음 · `proxy.ts:87` 이 `?from=share` 를 callbackUrl 에 그대로 잇는다.
- 다음에 볼 것: 병합 Manifest(aapt2) · 변이 시험(Java 2·TS 2) · 번들 영향 · `LessonPasteScreen` 뒤로 가기 시나리오 · fake-capacitor 흉내 · 보관 TTL 안의 오래된 공유가 다시 튀어 나오는지.

### 중간 체크포인트 2 (약 55턴)
- 병합 Manifest(aapt2, dev-N APK `thekaiwa-1.0.3-4.apk` vs 배포본 1.0.2-3): 차이 = versionCode 3→4·versionName 1.0.2→1.0.3 + `SEND`/`DEFAULT`/`mimeType=text/plain` 필터 1개뿐(SEND_MULTIPLE 0건, MainActivity exported=true·singleTask 유지, 새 exported 구성요소 없음, 기존 exported receiver 는 androidx profileinstaller). 활동 라벨 「Lingofy Japanese」(공유 목록에 이 이름). minifyEnabled=false, dex 에 SharedText* 포함.
- 변이 시험(스냅샷·스크래치 복사본에서만): Java 4건(TTL 경계 `>`→`>=`, 코드포인트 절단→char 절단, 빈 공유 보관 제거, `!restoring` 제거) 전부 JUnit 이 잡음(12 중 1 실패씩) · TS 2건(consume 빈 글 정규화 제거, peek `=== true`→`!== false`) 전부 잡음. 원복 확인.
- `listen()` 이동: bridge.ts 에서 지운 함수 본문과 listen.ts 본문이 글자 단위 동일(주석 제외), `ListenerHandle` 타입만 listen.ts 로 이동·bridge 가 import, index 로 새지 않음, 순환 없음.
- Next 16.3.2 소스로 확인: `useRouter()` 는 모듈 상수(`publicAppRouterInstance`) → ShareReceiver effect 는 한 번만 · `window.history.replaceState` 패치는 AppRouter 의 `useEffect` 안(app-router.js:232~277), `!event.state` popstate 는 무시(285~288), HistoryUpdater 는 `useInsertionEffect`(URL 이 passive effect 보다 먼저 바뀜) → dev-W 의 URL 재확인 대책은 타당. 다만 **풀 페이지 로드 경로의 replaceState(null) 문제**를 새로 찾음(아래 M-1).

## 판정 (REV-181)

**PASS-with-fixes** — Critical 0 · High 0 · Medium 1 · Low 4. `native_change: true`.

### 이슈
| # | 심각도 | 위치 | 내용·근거 | 권고 |
|---|---|---|---|---|
| M-1 | Medium | `src/components/lesson/LessonPasteScreen.tsx:136` | `window.history.replaceState(null, '', SHARE_PASTE_PATH)`. **풀 페이지 로드**(D4: 로그인 뒤 `AppDeepLink` 의 `window.location.replace('…/paste?from=share')`, WebView 재로드)에서는 페이지 컴포넌트의 passive effect 가 부모 `AppRouter` 의 history 패치 설치 effect(`next/dist/client/components/app-router.js:232`)보다 **먼저** 돈다(React 는 자식 effect 가 먼저). 그러면 패치되지 않은 네이티브 `replaceState(null)` 이 방금 `HistoryUpdater`(useInsertionEffect)가 써 둔 `__NA`·트리 상태를 지운다. 그 항목으로 돌아오는 기기 뒤로 가기는 `!event.state` 라 **Next 가 무시**(app-router.js:285~288 `return`) → 주소만 바뀌고 화면은 안 바뀐다. 같은 저장소 선례 `ChallengeScreen.tsx:73` 은 `window.history.state` 를 넘긴다(`PlanScreen.tsx:82` 는 null). 클라이언트 이동 경로(콜드 스타트 replace·warm push)는 패치가 이미 설치돼 영향 없음. 브라우저로 직접 확인하지는 못함(서버·DB 금지). | 한 줄 수정 `window.history.replaceState(window.history.state, '', SHARE_PASTE_PATH)`(패치된 경로에서는 Next 가 같은 값을 다시 복사하므로 동작 동일). 수정 후 좁은 재감사. 확신: 순서·결과 [가능성 높음], 브라우저 미확인 |
| L-1 | Low | `MainActivity.java` `forgetShare`(약 108~114행) | 지우는 것은 `EXTRA_TEXT`·ClipData 뿐. `EXTRA_SUBJECT`·`EXTRA_TITLE`·`EXTRA_HTML_TEXT`(메일 앱 등이 본문을 HTML 로도 실음)는 `setIntent` 로 활동 수명 동안 남는다. 읽거나 로그에 찍는 코드는 없음(메모리 한정). [확실: 코드, 추측: 실제 위험] | 선택: 위 키도 `removeExtra`. 급하지 않음 |
| L-2 | Low | `MainActivity.onCreate` | 「되살아난 공유」 방어는 `savedInstanceState != null`·`LAUNCHED_FROM_HISTORY` 두 신호에 의존. (a) 크래시 뒤 시스템이 상태 없이 원래 SEND Intent 로 자동 재시작하는 경로는 막지 못할 수 있음(보관함도 프로세스와 함께 비어 있어 옛 글이 다시 들어올 수 있음), (b) 반대로 프로세스가 죽었는데 최근 앱에 task 가 남은 채 새 공유가 오는 경로는 「onCreate(옛 Intent, 복구) + onNewIntent(새 SEND)」 순서여야 받는다. 둘 다 코드 밖(시스템 동작)이라 확인 불가. [추측] | 실기기 확인 항목으로 둔다(QA·사용자) |
| L-3 | Low | `SharedTextHolder` TTL 30분 | 소비되지 않은 공유는 30분 동안 남아, 로그인 포기 같은 경우 이후 resume·콜드 스타트마다 붙여넣기 화면으로 끌려갈 수 있다. 설계(로그인 왕복 허용)대로이며 30분 상한이 있다. | 현행 유지, 사용자 고지 불필요. 인지만 |
| L-4 | Low | 검증 공백 | `ShareReceiver`·`LessonPasteScreen` 공유 경로는 순수 함수 36건(pasteShare 24·shareTarget·sharedText·nativeBoundary)만 자동 시험이 있고, 마운트 순서·`handledRef`/`consumingRef`·replaceState·뒤로가기·신호/resume 중복은 시험이 없다(dev-W 기록: 브라우저·가짜 브리지 실측 안 함). | QA 가 `tests/live/fake-capacitor.js` 로 아래 시나리오를 반드시 실행 |

### 영역별 결론 (질문 번호)
1 Manifest: 통과(위 aapt2). 2 인텐트 처리: 통과 — 콜드 스타트 `takeShare` 가 `super.onCreate` 앞, `load()` 의 두 번째 `onNewIntent` 는 HANDLED 표시로 재처리 없음(Capacitor 7.6.9 소스 확인), VIEW 딥링크는 SEND 가 아니라 즉시 반환해 보관 공유를 건드리지 않음, 예외 메시지·로그에 본문 없음(L-1·L-2 제외). 3 Holder: 통과(JUnit 12/12 재현, 변이 4/4). 4 Plugin: 통과(reject 근거 맞음, 이벤트 본문 없음, 등록 순서 맞음). 5 오남용: 서버로 자동 전송 없음(`create` 는 `submit` 에서만), 본문은 `<textarea value>` 로만 → HTML 주입 불가, 1MB 상한(Binder)·10,000 코드포인트 절단. 어느 앱이든 붙여넣기 화면으로 사용자를 끌고 와 글을 미리 채울 수 있다는 점은 설계상 수용(자동 전송 없음). 6 APK: 4/1.0.3, `AppRelease`·`/api/app/version`·build-apk.sh·prisma 변경 없음(diff 확인). 7 브리지: 통과. 8 ShareReceiver: SSR 안전(null 반환, 최상위 window 접근 없음), 비앱 첫 줄 종료, effect 1회·정리 있음, 번들은 이미 로그인·셸이 쓰는 bridge 청크(23.7KB/gz 7KB) 재사용 수준. 9 `callbackUrl`: 새 코드는 상수만 만들고 `isShareCallback` 은 표시용(같은 출처 확인 포함), 서버 `sanitizeNextPath` 가 최종 관문 — 오픈 리다이렉트 신설 없음, `proxy.ts:87` 이 쿼리 보존. 10 붙여넣기 화면: 문구 §20-6 과 글자 일치, 코드포인트 기준이 서버 `codePointLength` 와 같음, 자동 포커스 없음, 버튼 `h-[38px]`+`min-h-11` = 44px, aria 있음 — M-1 제외 통과. 11 본문 취급: console·localStorage·fetch·URL 0건, 초안 sessionStorage 외 저장 없음, 엔진명 0건. 12 호환: 구 APK+새 웹 = `typeof p?.peek !== 'function'` 으로 no-op(오류 없음), 새 APK+구 웹 = 공유 목록에는 뜨나 웹이 안 꺼내 가 아무 일 없음(30분 뒤 메모리에서 소멸) → **배포 순서: 웹 먼저, 그다음 APK** 권고 맞음. 13 재현: tsc 0 · 시험 1547/1547 · eslint 0 · `next build` rc=0 · JUnit 12/12.

### 데모 검토 게이트
- `check.mjs check` → `DEMO_GATE_PASSED`(approved v1, hash verified). `evidence.jsonl` 32행: approve v1 10:11:48, 사용자 프롬프트 10:10:56 에 결속(quote_sha256), task 이력서의 승인 문장과 시간 일치. 에이전트가 approve/waive 를 대신했거나 `.claude/state/demo-gate/` 를 쓴 흔적은 발견하지 못함.
- 승인 데모 vs 구현: material 차이 없음. implementation(허용) = 루트 레이아웃 마운트·로그인 `callbackUrl` 직접 변경·`isShareCallback` 같은 출처 확인·`consumingRef`·URL 재확인·공유 글 정리. defect = 없음(M-1 은 동작 결함 후보이지 데모와의 차이가 아님). 3폭 간격·높이는 브라우저 미확인 → QA.

### QA 에 넘기는 high_risk_areas
1. **풀 페이지 로드** `/study/today/talk/new/paste?from=share`(로그인 뒤 D4) → 마운트 뒤 `history.state` 에 `__NA` 가 남는지 · 다른 화면으로 갔다가 기기 뒤로 가기 시 화면이 실제로 돌아오는지(M-1).
2. 콜드 스타트(`__FAKE_CAP_INIT.sharedText`) 로그인됨 → replace → 채움 → 새로고침·뒤로·앞으로에서 재채움·「받지 못했어요」 토스트 없음.
3. 켜진 앱(`__fakeCap.share`)에서 수업·회화·관리자 화면 → push·뒤로 가기, `busy` 중 무시, 신호+resume 중복(`pending`), 이미 붙여넣기 화면일 때 이동 없이 채움.
4. 로그인 전: `/login` 안내 한 줄, 로그인 뒤 같은 화면에서 채움, `expireShare()` → 「받지 못했어요」 1회.
5. 빈 공유 토스트(D5), D2 바꾸고 되돌리기·다시 넣기, D3 자르기·되돌리기(문장 끝, 이모지 서로게이트), 50자 미만, 일본어 아님 오류 상자 — 360/390/412 × 780 가로 넘침·버튼 위치(C2 360 = 771 근처).
6. 구 APK 흉내(`noSharedText`)와 일반 브라우저(`?from=share` 직접 입력)에서 오류·토스트·리스너 없음.
7. **실기기(사용자)**: 카톡 공유 목록에 「Lingofy Japanese」 노출·MIME 이 정확히 `text/plain` 인지 · 콜드/웜 채움 · 최근 앱에서 다시 열어도 예전 공유가 안 되살아나는지 · 프로세스가 죽은 뒤 최근 앱에 task 가 남은 상태에서의 공유(L-2).
8. 배포: 웹 먼저 → APK, deployer 는 origin 기준 재빌드·`AppRelease.versionCode=4`·notes 첫 줄 D6 문구.

### 재순환 요청
- Developer(dev-W): M-1 한 줄 수정 → Reviewer 좁은 재감사(변경 줄·시험 영향) → QA. L-1 은 선택. Critical·High 없음이라 Leader 보고 에스컬레이션 조건(Critical≥1·High≥3)에는 해당하지 않음.

## Reviewer 기록 (REV-182)

> REV-181 수정분(커밋 `51d1b33`, 직전 `8e77a6a`)만 좁게 재감사. 읽기 전용 — 코드·문서 수정 없음. 스냅샷 `git archive 51d1b33` → `~/.node-local/thekaiwa-rev182-src`(node_modules = share052f `cp -al`), gradle 은 `thekaiwa-apk-052f` 를 `cp -a` 한 `~/.node-local/thekaiwa-apk-rev182`(원본 무변경, 소스 5개 snapshot 과 cmp 동일 확인). 작업 트리는 `51d1b33` 과 동일(추적 파일 변경 0, 미추적은 vault 기록뿐). 도구 호출 약 24회.

### 판정 (REV-182): **PASS** — Critical 0 · High 0 · Medium 0 · Low 3(신규, 모두 비차단). `native_change: true`. REV-181 의 **M-1·L-1 종결**. REV-181 의 L-2·L-3·L-4 는 그대로 남음(QA·실기기 항목).

### 확인 결과
1. **M-1 (종결)** — `LessonPasteScreen.tsx:41-43` `dropShareMark(h)` = `h.replaceState(h.state, '', SHARE_PASTE_PATH)`. 호출 `:145` `dropShareMark(window.history)` 는 이전 `replaceState(null, …)` 와 같은 자리(= `handledRef` 확인 뒤, `from=share` 가 주소에 실제로 있을 때만 통과하는 가드 바로 아래, `isNativeApp()` 확인 앞). 8e77a6a 의 `replaceState` 는 이 파일에 1곳(136행)뿐이었고 지금은 헬퍼 안 1곳뿐 — 남은 `replaceState(null…)` 0건(`grep` 확인). `window.history.replaceState` 를 `h.replaceState(…)` 로 메서드 호출하므로 `this` 보존.
   - 변이(스냅샷 안에서만, 매번 원복·`diff -q` 확인): ① `h.state`→`null` → **시험 실패**(pass 1·fail 1) ② 경로에 `?from=share` 덧붙임 → **실패**(0/2) ③ 호출처를 `window.history.replaceState(null,…)` 로 되돌림 → **통과(못 잡음)** ④ 호출처의 `from=share` 가드 제거 → **통과(못 잡음)**. 즉 시험은 헬퍼의 계약(같은 state 참조·표시 없는 경로)을 의미 있게 지키지만 **호출처 연결은 지키지 않는다**(L-A).
2. **L-1 (종결)** — `MainActivity.java` `SHARE_BODY_EXTRAS`(TEXT·HTML_TEXT·SUBJECT·TITLE)를 `forgetShare` 가 돌며 `removeExtra`. 그 뒤 `setClipData(null)`·`HANDLED` 표시·`catch(RuntimeException)` 무로그 경로는 그대로, `takeShare` 는 `finally` 에서 호출(본문 읽기 `getCharSequenceExtra(EXTRA_TEXT)` 가 지우기보다 먼저). `forgetShare` 는 SEND 확인 뒤 `try` 안에서만 도달 → VIEW 딥링크 Intent 는 건드리지 않음. 상수 4개는 `android.content.Intent` 의 실재 필드(API 1·16·16·16, 앱 minSdk 23) — gradle 컴파일이 통과하고 `javap` 로 4개 문자열이 클래스 초기화에 있음을 확인. **gradle `:app:compileReleaseJavaWithJavac :app:testReleaseUnitTest` rc=0, `SharedTextHolderTest` tests=12 failures=0 errors=0** + 기존 `ExampleUnitTest` 1/1 재현(`clean*` 태스크로 결과 지운 뒤 재실행 — dev-W2 의 결과를 복사한 것이 아님). `forgetShare` 자체의 JUnit 이 없다는 dev-W2 의 설명(로컬 JVM android.jar 스텁이 RuntimeException 을 던지고 코드가 삼켜 공허해짐)은 타당하며 Robolectric 신규 의존성은 에스컬레이션 대상이라 넣지 않은 판단에 동의한다.
3. **회귀 재현** — `tsc --noEmit` rc=0 · `eslint`(바꾼 2파일) rc=0 · `DATABASE_URL=invalid node --import tsx --test $(find src/components src/modules/infra -name '*.test.ts')` → tests 1093 / pass 1093 / fail 0(새 시험 2건 포함). 데모 게이트 `check.mjs check` → `DEMO_GATE_PASSED`(approved v1, hash verified). 이 수정은 화면 모양·문구를 바꾸지 않아 데모 대조 차이 없음(implementation 범주도 아님 — 동작 보존 수정).
4. **versionCode 미증가 판단 (동의)** — `git log origin/main..HEAD` 로 task-052 커밋 전부 **미 push**, `origin/main:android/app/build.gradle` 의 `kaiwaVersionCode = 3`. 배포는 origin ref 기준이라 1.0.3(4)은 아직 어디서도 만들어진 적이 없다. 코드·문서 어디에도 `AppRelease` 행/시드로 4 또는 1.0.3 을 넣는 흔적 없음(`AppRelease` 는 deployer 가 `--publish` 출력으로 넣는다고 `build-apk.sh:20`·`deploy-order.md:308` 에 명시). `build-apk.sh` 는 인자 없이 돌면 작업 디렉터리 `out/` 에만 복사하고 `--publish` 일 때만 `DATA_ROOT/releases` 로 복사. [확실: 코드·git, 미확인: DB 의 `AppRelease` 행 — 접속 금지라 보지 않음; 행은 deployer 단독 작성 규칙]

### 이슈
| # | 심각도 | 위치 | 내용·근거 | 권고 |
|---|---|---|---|---|
| L-A | Low | `src/components/lesson/__tests__/pasteShareHistory.test.ts` | 시험이 `dropShareMark` 만 부른다. 변이 ③(호출처를 다시 `replaceState(null,…)` 로)·④(가드 제거)가 모두 통과 → M-1 이 되살아나도 자동으로 안 잡힌다. 컴포넌트 렌더 시험 기반이 없어 구조상 어려움(REV-181 L-4 와 같은 뿌리). [확실: 변이 실측] | QA 항목 1번(풀 페이지 로드 뒤 `history.state.__NA`·뒤로 가기)이 이를 대신 지켜야 한다. 별도 조치 불필요 |
| L-B | Low(정보) | `LessonPasteScreen.tsx:41-43` 주석 | **REV-181 M-1 권고의 근거 문장 「패치된 경로에서는 Next 가 같은 값을 다시 복사하므로 동작 동일」은 부정확했다(내 서술 오류).** Next 16.3.2 `app-router.js:271-273` 의 패치 `replaceState` 는 `data?.__NA` 이면 `return originalReplaceState(...)` 로 **일찍 끝나** `applyUrlFromHistoryPushReplace(url)`(Next 라우터의 canonical URL 갱신 = `usePathname`/`useSearchParams` 반영)을 건너뛴다. 이전 코드(`null`)는 그 경로를 탔다. 따라서 **클라이언트 이동 경로**(패치 설치 뒤)에서는 주소창은 `/paste` 로 바뀌지만 Next 내부 canonical URL 의 검색부는 `?from=share` 로 남는다. 영향 점검: 이 화면·셸에서 그 값을 읽는 곳 없음 — `ShareReceiver`/`decideShareAction` 은 `window.location` 을 읽고(`ShareReceiver.tsx:45`), 붙여넣기 화면은 `useRouter`/`useSearchParams` 를 쓰지 않으며(grep), `fromShare` 는 서버 prop 이고 재확인도 `window.location.search`, 셸 `usePathname` 사용처는 경로부만 본다. 풀 페이지 로드 경로에서는 패치가 아직 없어 이전·이후 모두 동기화가 없었으므로 퇴행 없음. `ChallengeScreen:73` 선례와 같은 동작. [확실: Next 소스·grep, 가능성 높음: 실제 영향 없음 — 브라우저 미확인] | 코드 변경 불필요. 주석의 「동작 변화 없음」 계열 서술(dev-W2 기록 23행 포함)은 「canonical URL 갱신은 생략됨, 읽는 곳 없음」으로 이해할 것. 나중에 이 화면이 `useSearchParams()`·`router.refresh()` 를 쓰게 되면 다시 볼 것 |
| L-C | Low(정보) | 배포 절차 | dev-N 의 로컬 APK `~/.node-local/thekaiwa-apk-052n/out/thekaiwa-1.0.3-4.apk` 는 L-1 수정 **이전** 소스로 빌드된 산출물(extras 3종이 남음). 배포본이 아니다 — deployer 는 push 뒤 origin 기준으로 다시 빌드한다. 만약 이 파일이 수동으로 `DATA_ROOT/releases/thekaiwa-1.0.3.apk` 에 올라가 있으면 `build-apk.sh --publish` 가 sha 불일치로 실패한다(안전장치 `:190-193`). | deployer 사전 확인: `releases/thekaiwa-1.0.3.apk` 가 이미 있으면 덮지 말고 versionCode 5 / 1.0.4 로 올릴 것. 그 로컬 APK 를 사용자 폰 설치에 쓰지 말 것 |

### QA·사용자에 넘기는 것 (REV-181 목록에서 바뀐 점만)
- QA 1번(풀 페이지 로드 뒤 `history.state.__NA` 유지·기기 뒤로 가기)이 **M-1 수정의 유일한 실동작 확인**이 된다(L-A). 추가로 클라이언트 이동 경로(콜드 스타트 replace·웜 push)에서 주소창이 `/paste` 로 바뀌고 뒤로 가기가 정상인지 한 번 본다(L-B 의 정상 쪽 확인).
- L-1 은 단위 시험으로 닫을 수 없다(스텁 한계) — 실기기: 공유(메일 앱처럼 SUBJECT·HTML 을 함께 싣는 앱 포함) 뒤 최근 앱에서 다시 열어도 글이 되살아나지 않는지는 REV-181 의 7번 실기기 항목에 포함.
- 순서 그대로: 웹 먼저 → APK(deployer, origin 기준 재빌드, L-C 사전 확인).
