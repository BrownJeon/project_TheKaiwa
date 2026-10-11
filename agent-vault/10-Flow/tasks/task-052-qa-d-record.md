---
task: task-052
role: qa-D (뒤로가기·새로고침·중복 이동·호환성·루트 레이아웃 안전)
tags:
  - type/record
  - domain/native
---
# task-052 QA 레인 D 기록 — D-1 뒤로가기·새로고침·중복 / D-2 호환성·루트 레이아웃 (screens.md §20)

> 이력서 본문: [[task-052-improve-kakao-share-target]]. 이 파일만 append. 대상 커밋 `51d1b33`(REV-181 M-1·L-1 반영).

## QA 시각 검증 — 재현 조건 (데모 게이트 §8)
- 서버: `git archive 51d1b33` → `~/.node-local/thekaiwa-qa052d`(node_modules = `thekaiwa-share052w` 하드링크 — package.json·lock·prisma 스키마가 46efd74→51d1b33 사이 무변경, `.env` 복사 600). 빌드 `flock ~/.node-local/thekaiwa-build.lock ./node_modules/.bin/next build > 로그 2>&1; echo $?`(레인 C 가 같은 시각 빌드 중이라 flock 으로 직렬화). 서버 `APP_ENV=LOCAL CLAUDE_CLI_PATH=/bin/false next start -H 127.0.0.1 -p 3012`(LLM 호출 불가로 부작용 차단).
- 브라우저: playwright-core 1.58.2 + `/usr/bin/google-chrome` headless **147.0.7727.101**, locale ko-KR, timezone Asia/Seoul, reducedMotion reduce, light(다크 미검증). 이동 `networkidle` + 대기. 네트워크 fixture 미사용(실서버·실 DB), 앱 모드는 `tests/live/fake-capacitor.js` 를 `addInitScript` 로 주입(실 WebView 아님).
- 계정: **QA4**(`qa-bot4@thekaiwa.test`), 관리자 콘솔 화면 확인 때만 `qa-admin`(읽기 전용 이동, 전후 행 수 대조·정리).
- 스크립트: 클론 루트 `qa052d-*.mts`(클론과 함께 삭제), 원 출력 scratchpad `q052d/*.log`.
- 허용 범위: 이 레인은 동작 검증이라 픽셀 비교 없음 — 판정 기준은 URL·`history.state`·`history.length`·DOM 텍스트·콘솔·네트워크 목록.

## 체크포인트 0 — 환경
- 시작 전 확인: `claude --print` 프로세스 0, 3012 비어 있음(3010 = pm2 운영, 3009·3008… = 다른 프로젝트), 다른 레인(C)이 `thekaiwa-qa052c` 에서 next build 중.
- 클론 생성·빌드 시작. **다음 첫 명령**: 빌드 rc 확인 → `next start` 3012 → QA4 쿠키 발급.

## 체크포인트 D-1 — 뒤로가기·새로고침·중복 이동 (REV-181 M-1 실증)
- **환경 확정**: 빌드 `next build` exit 0, 서버 `next start` 127.0.0.1:3012(PID 파일 scratchpad `q052d/server.pid`=1171187), QA4 쿠키 발급(1시간). 시작 전 행 수: QA4 = Profile 1·UserVoiceSetting 1·UserSpeechSetting 1·Attendance 3·RequestTrace 73 / qa-admin = Profile 1·…·Attendance 1·RequestTrace 23 (= task-051 레인 B 종료 때와 같음).
- **가짜 브리지 보정**: `fake-capacitor.js` 는 페이지를 새로 열 때마다 `__FAKE_CAP_INIT` 을 다시 적용 → 새로고침이 공유 글을 다시 주는 비현실 동작이 된다. 실제 네이티브는 consume 뒤 비므로 **첫 문서 로드에만** 공유 글을 주는 init 스크립트(`window.name` 표식, `about:blank` 초기 문서는 제외)를 앞에 붙임(`qa052d-lib.mjs`). 이 보정 전 첫 시도가 거짓 실패("이동 안 함")를 냈다 — 내 하네스 결함이었고 앱 결함 아님.
- **판정: PASS**(관찰 1건 Low) — `qa052d-d1.mjs` 98개 조건(그중 4개는 아래 대조군·내 과엄격 단언) → 앱 대상 **전부 PASS**.
- **① 새로고침 PASS**: 콜드 스타트(`/`) 공유 → `/study/today/talk/new/paste`(주소에 `from=share` 없음), 입력칸 = 공유 본문, 띠 「공유한 글을 넣어 두었어요」. **새로고침 후** 입력칸 = 초안(sessionStorage) 그대로, 띠 없음, 5초간(0.25초 간격 20회) 「받지 못했어요」·「글이 없어요」 토스트 **0**, consume 호출 0(calls = peek·getInfo 뿐). 글을 고친 뒤(`추記テスト`) 새로고침 → 고친 글 유지(공유 글로 덮이지 않음). 풀 로드 `…/paste?from=share` 경로에서도 같은 결과. 콘솔 오류/경고·pageerror 0.
- **② 뒤로가기 PASS**: 
  - 콜드 스타트 경로와 **풀 페이지 로드 `?from=share` 경로 둘 다** — 채운 직후 `history.state` 키 = `["__NA","__PRIVATE_NEXTJS_INTERNALS_TREE"]`(Next 내부 키 보존). 붙여넣기 → (BackBar 링크) 주제 고르기 → (탭) 오늘 홈 → 뒤로 → 주제 고르기 → 뒤로 → **붙여넣기 화면 복귀(h=「문장으로 수업 만들기」, 입력칸 = 초안 본문)**, 같은 문서(표식 `window.__qaMarker` 유지 = 하드 리로드 아님), 복귀 후 `history.state` 에 `__NA`·트리 키 있음, 재채움·토스트·띠 없음, 앞으로 → 주제 고르기(화면 바뀜).
  - **대조군(의도된 실패)**: 풀 로드 후 raw `history.replaceState(null,…)`(옛 방식 흉내, 내 SPY 가 잡아 둔 원본 함수) → `history.state=null` → 같은 이동 뒤 뒤로가기 시 **주소는 `/study/today/talk/new/paste` 인데 화면은 「주제 고르기」 그대로, 입력칸 없음** — REV-181 M-1 이 말한 「URL 만 바뀌고 화면이 안 바뀌는 증상」을 그대로 재현. 즉 이 점검식이 결함을 잡아내는 식이고, 51d1b33 의 `dropShareMark`(현재 state 를 그대로 넘김)는 그 증상이 **없음**.
- **③ 중복 이동 PASS**: 오늘·회화(`/study/ai`)·주제 고르기 3화면에서 `share()`+`emit('resume')` 동시 → 매번 `pushState` **정확히 1회**, `history.length` +1, consume 1회, 뒤로 1회 = 원래 화면(붙여넣기 화면이 또 나오지 않음), 콘솔 0. 신호→resume 간격 5·15·30·60·120·250·500·1000ms(8종), resume→신호 0·30·150ms(3종), resume 만, 신호 만 — **전 15 조합 push=1·consume=1**.
- **④ 이미 붙여넣기 화면 PASS**: 빈 입력칸 + 신호 → 이동 없음(pushΔ 0·history.lengthΔ 0)·채움·띠 「공유한 글을 넣어 두었어요」; 쓰던 글(59자) + 신호(또는 신호+resume) → 이동 없음·띠 「공유한 글로 바꿔 넣었어요 / 쓰던 글(59자)은 …」+ [쓰던 글로 되돌리기] 동작(→ 쓰던 글 복원).
- **[관찰 QA-052D-O1 Low]** 풀 페이지 로드 `?from=share`(= 앱 로그인 뒤 `window.location.replace` 경로)에서 **`consume` 이 2번 불린다**(콜드 스타트 `/` 경로는 1번). 원인 추정 [가능성 높음 — 디버그 로그로 두 호출 모두 이미 주소가 지워진 뒤임을 확인]: `ShareReceiver.check` 가 `await peekSharedText()` **뒤에** `window.location` 을 읽는데, 그 사이 붙여넣기 화면 마운트 effect 의 `dropShareMark` 가 `from=share` 를 지워 놓아 `decideShareAction` 이 `stay` 가 아니라 `signal` 로 판정 → `SHARE_EVENT` 발행 → 화면 `onShare` 가 두 번째 consume. 두 번째는 네이티브에서 null(이미 비움) → 조용히 끝나므로 **사용자에게 보이는 증상 없음**(토스트·띠·글 변화 0, 위 PASS 근거). 다만 설계서 §20-3 의 `stay` 분기(「화면이 마운트 때 직접 받는 중」)가 이 경로에서는 실효가 없고, 첫 consume 이 끝나기 전 두 번째가 시작되는 타이밍은 `consumingRef` 가 막는다(실기기 브리지는 비동기라 이쪽이 더 흔함). 수정 후보(Developer 판단): 위치를 `await` 앞에서 읽거나 `stay` 판정에 화면 쪽 `handledRef` 신호를 쓰는 방식.
- **남은 일**: D-2(①~⑤) → 정리. **다음 첫 명령**: `cd ~/.node-local/thekaiwa-qa052d && node qa052d-d2.mjs`. **주의점**: 서버 3012 실행 중(PID 1171187)·쿠키 1시간(만료 시 `QA_ACCOUNT=4 node --env-file=.env --import tsx tests/live/qa-session.ts <scratchpad>/q052d/cookie4`)·`qa-admin` 쿠키도 발급됨. **미정리**: 서버·클론 `~/.node-local/thekaiwa-qa052d`·scratchpad 쿠키·`/tmp/qa-artifacts`(스크린샷은 안 찍음, 0개).

## 체크포인트 D-2 — 호환성·루트 레이아웃 안전 (qa052d-d2.mjs 42조건 + d2b 2조건)
- **판정: PASS(결함 1건 Low — 아래 #1)**. 서버는 이 체크포인트 직전까지 커밋 `51d1b33` 격리 빌드(3012).
- **① 일반 브라우저 PASS**: 가짜 브리지 없음(`window.Capacitor` 읽기만 하고 항상 undefined) — 로그인 QA4 8화면(오늘·회화·계획표·단어장·질문·설정·주제 고르기·붙여넣기)과 로그아웃 3화면(로그인·공유 callbackUrl 로그인·초대)에서 콘솔 오류/경고·pageerror **0**, `kaiwa:shared-text` 리스너 **0**(window.addEventListener 스파이), `?from=share` 직접 입력 → 주소가 `/study/today/talk/new/paste` 로 정리되고 5초(20회 표본) 토스트 0·띠 0·입력칸 비어 있음·`history.state` 에 Next 키 유지.
  - **「변경 전과 같다」 실증**: task-052 착수 직전 커밋 `f049bbc` 를 따로 빌드(`next build` exit 0)해 같은 13개 화면의 정규화 DOM(스크립트·CSS 링크·useId·정적 자원 해시 제거)을 대조 — **12개 완전 일치**(오늘·회화·계획표·단어장·질문·설정·주제 고르기·붙여넣기 2종(`?from=share` 포함)·로그인 2종·초대), **다른 1개는 설계된 차이만**: 공유 callbackUrl 로그인 화면의 안내 `<p role="status">공유한 글은 로그인하면 …</p>` 한 줄 삽입(2,339→2,865자). 일반 callbackUrl 로그인은 변경 전과 동일.
- **② 구 APK(`noSharedText`) PASS**: 5개 화면(`/`·회화·설정·단어장·붙여넣기)에서 `SharedText` 플러그인 없음·SharedText 호출 0·토스트 0·콘솔 0. `share()`·`resume`·`sharedText` 신호를 보내도 이동·오류 없음(pushΔ 0). [관찰] 구 APK 에서 사용자가 `?from=share` 를 손으로 치면 「받지 못했어요」 토스트가 뜬다 — 정상 흐름(셸이 `from=share` 를 만든다)에서는 구 APK 가 이 주소를 만들지 않으므로 설계상 허용으로 판단.
- **③ failNext PASS**: (a) 콜드 스타트 첫 peek 실패 → 오늘 홈 정상·토스트 0·오류 0, **이어서 resume → 복구되어 붙여넣기 화면에 채움**(실패가 공유를 잃게 하지 않음) (c) 붙여넣기 화면에서 peek 실패 → 입력칸·화면 그대로, 다음 resume 에서 채움+「쓰던 글로 되돌리기」 띠 (d) 신호 뒤 consume 실패 → 조용히 끝(입력칸 그대로·토스트 0). (b) consume 실패(풀 로드 `?from=share`)는 **결함 #1 과 얽힘** — 첫 시도(peek 뒤 실패 장전)는 두 번째 consume 이 실패를 맞아 거짓 PASS/FAIL 이 됐고, 첫 consume 만 실패시키는 하네스(`failFirstConsume`)로 재측정: 「받지 못했어요」 토스트 **그리고** 같은 화면에 「공유한 글을 넣어 두었어요」 띠+공유 글이 동시에 보임(결함 #1). 초안이 있는 상태의 같은 실패(2b)는 초안 그대로·안내만 → PASS.
- **④ 루트 레이아웃 PASS**: 앱 모드(가짜 브리지) QA4 `/settings`·`/drawer/words`·`/ask`·`/plan` 200·콘솔 0, `/admin`·`/admin/dashboard` **404**(USER — capability 없음 계약), 404 응답의 「Failed to load resource」 1건만(예상). `qa-admin`(읽기 전용 이동) `/admin`·`/admin/dashboard`·`/admin/configuration` 200·콘솔 0·하이드레이션 경고 0(프로덕션 빌드라 minified 코드 `#418·#419·#422·#423·#425` 와 `hydrat` 문구를 정규식으로 검사). 관리자 콘솔(`/admin`)에서 `share()+resume` → 붙여넣기 화면으로 **push 1회**·채움. 로그인 전 콜드 스타트 공유 → `/login?callbackUrl=%2Fstudy%2Ftoday%2Ftalk%2Fnew%2Fpaste%3Ffrom%3Dshare` + 안내 한 줄·오류 0, `/invite` 에서는 아무 일도 없음(이동 없음).
  - **XSS**: 공유 본문 `<img src=x onerror=alert(1)><img src=x onerror="window.__qaXss=1"> 日本語…` → 입력칸 값이 본문과 **바이트 그대로**(텍스트), 화면 `img` 요소 **0**, `img[src="x"]` 0, `window.__qaXss` 미설정, `dialog` 0, 띠 문구에 본문 없음(제목만 「공유한 글을 넣어 두었어요」), `body.innerHTML` 에 `<img src=x` 없음.
- **⑤ 본문 비누출 PASS**(수업 만들기 누르기 전): 고유 표식이 든 본문으로 — `location.href`·`document.referrer`·`history.state`·`document.title`·`document.cookie`·`localStorage`(키 0개)·콘솔 메시지 전부·네트워크 요청 34건(URL+본문+헤더)·`performance` 리소스/내비게이션·`framenavigated` URL 목록 모두 **0건 포함**. 새로고침 뒤 새 요청 14건에도 0건. `sessionStorage` 는 설계상 허용된 `kaiwa.lesson.pasteDraft` **한 키만** 본문 포함(다른 키 `kaiwa.checkin.2026-10-11` 은 기존 기능).
- **[결함 #1] [Low] `src/components/shell/ShareReceiver.tsx` 40–46행 + `src/components/lesson/LessonPasteScreen.tsx` 145·149·162행 / 재현: 앱 모드(가짜 브리지) `…/study/today/talk/new/paste?from=share` 를 **풀 페이지 로드**(앱 로그인 뒤 `window.location.replace` 와 같은 경로)로 열고 `calls` 확인 / 실제: `SharedText.consume` 이 **2번** 불림(콜드 스타트 `/` 경로·웜 push 경로는 1번). 첫 consume 이 실패(reject)하면 「공유한 글을 받지 못했어요」 토스트가 뜨는데 두 번째 consume 이 성공해 입력칸에 공유 글+띠 「공유한 글을 넣어 두었어요」가 함께 보임(모순된 두 안내). 첫 consume 이 성공하면 두 번째는 null 로 조용히 끝나 사용자 증상 없음 / 기대: 설계서 §20-3·20-9 — consume 은 붙여넣기 화면 한 곳에서 **한 번만**, 풀 로드의 `from=share` 는 셸이 `stay`(건드리지 않음) / 원인 추정 [가능성 높음 — 로그로 두 consume 모두 주소가 이미 지워진 뒤임을 확인]: `ShareReceiver.check` 가 `await peekSharedText()` **뒤에** `window.location` 을 읽고(45행), 그 사이 화면 마운트 effect 의 `dropShareMark`(145행)가 `?from=share` 를 지워서 `decideShareAction`(shareTarget.ts 39행)이 `stay` 대신 `signal` → `SHARE_EVENT` 발행 → 화면 `onShare`(162행)가 두 번째 consume. 첫 consume 이 아직 진행 중이면 `consumingRef` 가 막지만, 끝난 뒤면 못 막음. 수정 후보(Developer 판단): `decideShareAction` 입력(경로·쿼리)을 `await` 앞에서 읽거나, 화면이 이미 처리 중임을 알리는 신호(예: `handledRef` 를 모듈 수준 플래그로)를 `stay` 판정에 쓴다.**

## 최종 판정 (QA 레인 D) — 뒤로가기·새로고침·중복 이동·호환성·루트 레이아웃
| 항목 | 판정 | 핵심 근거 |
|---|---|---|
| D-1 ① 새로고침 | **PASS** | 새로고침 후 초안만 남음·토스트 5초 0·consume 0, 고친 글 유지 |
| D-1 ② 뒤로가기(M-1 실증) | **PASS** | 콜드/풀 로드 모두 `history.state=["__NA","__PRIVATE_NEXTJS_INTERNALS_TREE"]`, 뒤로 2단→붙여넣기 복귀(화면까지)·앞으로 정상, 하드 리로드 아님. 대조군(raw `replaceState(null)`)은 「주소만 바뀌고 화면 그대로」 증상 재현 |
| D-1 ③ 중복 이동 | **PASS** | 3화면×(동시/8종 간격/역순 3종/단독 2종) 전 15조합 push=1·consume=1·뒤로 1회=원래 화면 |
| D-1 ④ 붙여넣기 화면에서 새 공유 | **PASS** | 이동 0·history 증가 0·채움·되돌리기 띠/동작 |
| D-2 ① 일반 브라우저 | **PASS** | 콘솔 0·리스너 0·변경 전 빌드(f049bbc)와 DOM 12/13 일치(나머지 1은 설계된 안내 줄) |
| D-2 ② 구 APK | **PASS** | 오류·토스트 0, 기능만 빠짐 |
| D-2 ③ failNext | **PASS**(결함 #1 동반) | 4경로 안전 복귀, 풀 로드 consume 실패 시 모순 안내(#1, Low) |
| D-2 ④ 루트 레이아웃·XSS | **PASS** | 로그인·초대·설정·단어장·관리자 콘솔(+USER 404) 콘솔·하이드레이션 0, XSS img 0·onerror 미실행 |
| D-2 ⑤ 본문 비누출 | **PASS** | URL·state·localStorage·콘솔·요청 34건·성능 항목 0건 |
- **결함**: Critical 0 · High 0 · Medium 0 · **Low 1(#1)**. 관찰: O1 = 결함 #1 로 승격(위), 구 APK 의 손입력 `?from=share` 토스트(설계상 허용).
- **NOT_VERIFIED / 사용자 육안(실기기 S25+)**: ① 실제 카카오톡 「공유」 목록·콜드/웜 두 경로 ② 실 WebView 에서 `history`·기기 뒤로 가기 버튼(Chrome 헤드리스의 `page.goBack` 은 브라우저 뒤로가기이지 안드로이드 하드웨어 뒤로가기가 아님; 특히 `singleTask` 콜드 스타트 뒤 뒤로 → 카톡 복귀) ③ `onNewIntent`+`resume` 이중 신호의 실제 도착 순서·간격(내 간격 표는 가짜 브리지 기준) ④ 진행 중인 **수업·회화 세션 화면**(소리·마이크 정리) — LLM 호출이 필요해 만들지 않음, 대신 같은 규칙(`decideShareAction` 의 기본값 `go`)이 적용되는 오늘·회화 홈·주제 고르기·관리자 콘솔로 갈음 ⑤ 로그인 왕복(Custom Tab)에서 프로세스가 죽어 보관함이 사라지는 빈도 ⑥ 다크 모드·360/412 폭 화면(이 레인은 동작 검증이라 미수행 — 레인 C·E 범위) ⑦ 카톡이 넘기는 MIME 이 정확히 `text/plain` 인지.
- **qa-admin 사용 고지**: 지시는 「QA4 계정」이었으나 D-2 ④ 의 「콘솔 `/admin`」 실제 화면은 USER 계정이 404 라 `qa-admin` 읽기 전용 이동을 했다(task-051 레인 B 선례). 그 결과 qa-admin `Attendance` 가 오늘자 APP_OPEN 1행(id `cmv36o46f0029w1oz3qzgenq1`, 2026-10-11) 늘었고 **「QA4 userId 한정 삭제」 지시 때문에 지우지 않고 남김** — Leader 가 허용하면 id 한정 삭제 한 줄이면 된다.
- **정리(최종)**: QA4 오늘자 Attendance 1행(id `cmv36cxsy0001w1ozh40568hc`, 대상 행 수 1 출력 후 userId·id 한정 삭제) → QA4 행 수 시작 전과 **동일**(Profile 1·UserVoiceSetting 1·UserSpeechSetting 1·Attendance 3·RequestTrace 73). qa-admin = Profile 1·…·RequestTrace 23·**Attendance 2(시작 전 1, 위 고지)**. LLM 호출 0(`CLAUDE_CLI_PATH=/bin/false`, 시작·끝 `claude --print` 프로세스 0). 프로세스: 3012 서버 2대(51d1b33 빌드 PID 1171187, 기준선 f049bbc 빌드 PID 1200526 — 기준선은 `nohup … &` 래퍼 PID 를 PID 파일에 적어 첫 종료가 빗나가 `ss` 로 PID 를 확인하고 cwd 가 내 기준선 폴더임을 확인한 뒤 그 PID 로만 종료) 모두 종료 → `ss -ltn` 3012 **비어 있음**. 클론 `~/.node-local/thekaiwa-qa052d`·`…-base` 삭제(`ls -d` 없음 확인, 원본 `thekaiwa-share052w/node_modules` 394개 그대로). 쿠키·PID 파일 삭제. 스크린샷은 찍지 않음(`/tmp/qa-artifacts/TheKaiwa/task-052` 없음, 산출물 정리: 0개 삭제). `/tmp/qa-artifacts/` 루트의 `console-…`·`element-…png` 는 10-10 다른 세션 파일이라 그대로 둠(24시간 청소 훅 대상). 재현 스크립트 11개와 원 출력은 scratchpad `q052d/`(프로젝트 밖). 참고: 저장소 `git status` 에 `M  android/gradlew`(스테이징됨)가 보이나 내가 만든 변경이 아님.
