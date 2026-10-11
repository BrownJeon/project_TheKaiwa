---
task: task-052
role: qa-C (도착·덮어쓰기·경계·로그인 전·빈 공유 화면)
tags:
  - type/record
  - domain/native
---
# task-052 QA 레인 C 기록 — 공유 수신 화면 (screens.md §20, 승인 데모 v1 D1~D6 A)

> 이력서 본문: [[task-052-improve-kakao-share-target]]. 이 파일만 append. 대상 커밋 `51d1b33`. 레인 D(QA4)·E 는 별도.

## QA 시각 검증 — 재현 조건 (데모 게이트 §8)
- 서버: `git archive 51d1b33` → `~/.node-local/thekaiwa-qa052c`(node_modules = `thekaiwa-share052w` 하드링크 복사, package.json·schema.prisma 동일 확인, `.env` 복사 600), `next build` exit 0 → `APP_ENV=LOCAL CLAUDE_CLI_PATH=/bin/false next start -H 127.0.0.1 -p 3011`(LLM 호출 불가로 부작용 차단). PID 파일 scratchpad `q052c/server.pid`(=1160402). 헬스 `degraded: stt_analysis_worker` 만(이번 항목과 무관).
- 브라우저: playwright-core + `/usr/bin/google-chrome` headless **147.0.7727.101**. viewport **360×780 · 390×780 · 412×780**, DSF 2.625, isMobile+hasTouch, locale ko-KR, timezone Asia/Seoul, reducedMotion reduce, light(다크 미검증), 이동 `domcontentloaded` + 하이드레이션 대기 0.9초. 캡처 범위 = 뷰포트(상태별 소수). 허용 범위: 가로넘침 0·페이지 세로스크롤 0·터치 ≥44px·문구 원문 일치·하단 위치는 §20-9 수치와 비교.
- 가짜 브리지: `tests/live/fake-capacitor.js`(+ Playwright `addInitScript`). 콜드 스타트 초기값은 같은 탭 `sessionStorage.__qa_init`(하네스 전용)으로 넣고 기본 `appBuild 4·appVersion 1.0.3`(업데이트 띠가 상단에 끼어 높이가 달라지는 것을 막음 — 첫 측정은 appBuild 1 이라 띠가 떠서 하단이 +74px 였음, 하네스 조건 정정). 가짜 보관함은 문서 재로드에서 처음 상태로 돌아가므로, consume/expire 했으면 `sessionStorage.__qa_consumed` 표시로 다음 문서에서 다시 비운다(진짜 네이티브 보관함이 WebView 재로드를 건너 남는 규칙 흉내). 토스트 표시 횟수는 `MutationObserver` 로 센다.
- 계정: **QA1**(`qa-bot@thekaiwa.test`, userId `cmuizv0yk0000w12dh0b5p7b2`). 시작 전 QA1 행: AiJob 14·Profile 1·UserVoiceSetting 1·UserSpeechSetting 1·Chat 3·ChatMessage 64·Correction 5·TutorProposal 8·LearningObservation 453·Attendance 8·StatsSnapshot 3·LearnerErrorStat 2·RequestTrace 281.
- 스크립트: scratchpad `q052c/{lib,c1,c2}.cjs`(프로젝트 밖), 원 출력 `q052c/out/*.log`. 스크린샷은 `/tmp/qa-artifacts/TheKaiwa/task-052/`(끝에 삭제). 격리 복제본 안 `qa052c-rows.mts`(복제본과 함께 삭제).
- 사전 확인: `ps` 에 `claude --print` 0건. 다른 서버 3010 은 건드리지 않음(포트 3010·3011 외 미사용).

## 체크포인트 C-1 — 도착·덮어쓰기·경계 (콜드 스타트 `__FAKE_CAP_INIT`, 3폭 × 시나리오)
- **판정: PASS** (결함 0). 자동 점검 336/336 + 추가 경계 8/8 PASS. 시나리오: A 정상 도착 · B1 이 화면에 있는 동안 도착(쓰던 글 있음) · B2 다른 화면(오늘 홈)에서 도착 · B3 콜드 스타트+초안 · C1 50자 미만 · C2 2,000자 초과 · C2direct 직접 붙여넣은 긴 글·경계값 · C3 한국어 글 · X1 1만 자 상한(truncated) 공유.
- **A 정상 도착**(3폭): 콜드 스타트(`/` → 오늘 홈 → `router.replace`) → 붙여넣기 화면, 주소 `search=''`(`?from=share` 지워짐), `history.state` 유지(REV-181 M-1 — null 아님), 입력칸 = 공유 글(CRLF→LF·앞뒤 공백 정리: 원문 93자 → 84자 일치), 띠 문구 §20-4 ⑤ 원문과 일치·`role=status`·띠 안 버튼 0, `document.activeElement` = body(입력칸 자동 포커스 없음), 글자 수 `84 / 2,000자`·안내 `3~8줄이 알맞아요`·버튼 활성(aria-disabled 없음) 기존 그대로, 초안 sessionStorage = 공유 글, 브리지 호출 `peek`·`consume` 1회, 토스트 0. 새로고침 뒤 띠 없음·초안 유지·consume 0·토스트 0, BackBar 로 나갔다가 뒤로 가기 뒤에도 토스트 0·consume 0·`?from` 없음.
- **B 덮어쓰기**: B1(입력칸에 쓰던 글 71자 입력 → blur → `share()`) 공유 글로 교체·띠 `replaced(71자)`·[쓰던 글로 되돌리기] 높이 44px → 누르면 원래 글 복원·띠 `restored(84자)`·초점이 같은 버튼에 남음(글만 `공유한 글 다시 넣기` 로 바뀜) → 다시 누르면 공유 글·`replaced(71자)` 왕복 OK, 입력해도 띠 유지. **쓰던 글(alt)이 sessionStorage·localStorage 어디에도 없음**(표지 문자열 검색 0). B2(초안이 sessionStorage 에 있는 채 `/study/today` 에서 `share()` → `router.push`) 초안 복원 직후 도착해도 `replaced(71자)` — `textRef` 순서 정상, 기기 뒤로 가기 후 `/study/today` 로 복귀. B3(콜드 스타트+초안) 도 `replaced`.
- **C1 50자 미만**(16자): 채워짐·띠 arrived·기존 안내 `50자 이상 넣어 주세요 · 지금 16자`·자르기 줄 0·버튼 `aria-disabled=true`·눌러도 기존 이유 토스트만(레슨 생성 POST 0, 앱 열림 출석 ping `attendance/check-in` 만).
- **C2 2,000자 초과**(2,271자): 전부 채움(자르지 않음)·기존 빨간 안내(`2,000자까지 넣을 수 있어요`·글자 수 빨강 `2,271 / 2,000자`)·자르기 줄 문구 원문(`뒷부분 288자는 빠져요`)·버튼 높이 44px·`aria-disabled=true`. 자르기 → 결과 1,983자(문장 끝 `。` 에서, 독립 오라클 trimToLimit 과 바이트 일치)·줄이 「뒷부분 288자를 뺐어요 / 되돌리기」로 바뀌고 초점이 그 버튼에·버튼 활성 → 되돌리기 → 원문 2,271자 전체 복원·줄 복귀. 자른 뒤 입력하면 되돌리기 줄 사라짐. **직접 붙여넣은 긴 글에도 같은 줄**: 2,000자 정확히=줄 없음 · 2,001자 · 2,500자(문장 끝 없음 → 정확히 2,000, r=500) · 이모지 코드포인트 2,100(→ 2,000 코드포인트·`isWellFormed()` true) · 문장 있는 긴 글 — 전부 오라클 일치(앱 모드 3폭 + 웹(Capacitor 없음) 390 에서 2,100자 줄 확인). X1: 네이티브 1만 자 상한으로 잘린 공유(10,000자) → 별도 잘림 문구 없이 띠 arrived + 자르기 줄(`뒷부분 8,017자`) → 자르면 1,983자.
- **C3 한국어 글**(77자): 그대로 채워지고(띠 arrived·버튼 활성) → [수업 만들기] → `POST /api/v1/lessons` **400**(메시지 「일본어 문장을 붙여 넣어 주세요.」, LLM 전 거절 — `CLAUDE_CLI_PATH=/bin/false` 라 호출됐어도 실패였을 것이며 QA1 AiJob 14→14·RequestTrace 281→281 불변) → 오류 상자(`role=alert`) 「일본어 문장이 너무 적어요. / 일본어가 들어간 문장을 붙여넣어 주세요.」 원문 일치·입력칸·띠·화면 그대로. 오류 상자 뒤에도 가로넘침 0.
- **3폭 공통 레이아웃**: 모든 시나리오·상태(띠·자르기 줄·오류 상자 포함)에서 `right > clientWidth` 요소 0·`documentElement.scrollWidth == clientWidth`·페이지 레벨 세로 스크롤 0(`scrollHeight == clientHeight == 780`)·터치 대상(button·a·textarea) 44px 미만 0(띠·자르기 줄 버튼 44px, [수업 만들기] 48px).
- **[수업 만들기] 하단 y(viewport 780, 스크롤 0, 실측)** vs §20-9: A·C1·C3 = 360 **623**(문서 651, −28) · 390 **602**(630, −28) · 412 **602**(630, −28) / B(replaced) 360 **675**(703, −28) · 390·412 **636**(문서 값 없음) / C2 360 **743**(771, −28) · 390 **722** · 412 **688**(문서 값 없음). 모든 값 ≤780(첫 화면 안). **문서와 전 상태 일정하게 −28px** — 데모 폰 프레임의 상태바 높이로 추정[추측]; 앱 WebView 는 상태바 inset 이 더해질 것이라 실기기에서 문서 값에 가까워질 가능성[추측] → 실기기 확인 항목.
- **네트워크 누출 점검**: 모든 시나리오에서 (수업 만들기 누르기 전) 요청 URL·본문(`postData`)·콘솔에 공유 본문 표지 문자열(원문·`encodeURIComponent`) 0건(요청 35개 안팎/시나리오). 저장소에는 초안 키 `kaiwa.lesson.pasteDraft` 만(공유 글, 허용), 쓰던 글 alt 없음.
- 정정 기록: 첫 측정은 가짜 브리지 기본 `appBuild 1` 때문에 상단 앱 업데이트 띠가 떠 하단이 +74px 였음 → `appBuild 4·1.0.3`(= 새 APK 설치본)으로 하네스 정정 후 재측정(위 값). C1 첫 실행은 `aria-disabled` 버튼을 Playwright 가 click 하지 못해 시간 초과 → `force` 로 정정, 출석 ping 이 「POST 없음」 점검에 걸려 정정(하네스 문제, 앱 결함 아님).
- **남은 일**: C-2 결과 기록 → 정리. **미정리**: QA1 Attendance 오늘자 1행(`cmv36e7po0001w1deww74apce`, 내 화면 열기로 생김), 서버 3011(PID 파일), 격리 복제본, 스크린샷 5장.

## 체크포인트 C-2 — 로그인 전·만료·빈 공유
- **판정: PASS**(관찰 1건 Low). 자동 점검 159건 중 156 PASS + 3건(D1 `consume 1회` 엄격 점검 ×3폭)은 아래 O-C1 으로 재분류 — 같은 문서에서 `consume` 이 두 번 호출되고 두 번째는 null(화면 영향 0).
- **D 로그인 전 콜드 스타트**(`/` → 로그인): 세션 없이 공유가 먼저 오면 `/login?callbackUrl=%2Fstudy%2Ftoday%2Ftalk%2Fnew%2Fpaste%3Ffrom%3Dshare` 로 바뀜(callbackUrl 디코딩 = `/study/today/talk/new/paste?from=share`)·로그인 화면 한 줄 안내 「공유한 글은 로그인하면 붙여넣기 화면에 넣어 드려요.」 원문 일치·`<p role=status>`·**Google 버튼 바로 위**(note.bottom ≤ button.top)·로그인 화면에서는 본문을 꺼내지 않음(consume 0, peek 만)·3폭 가로넘침 0·페이지 세로스크롤 0·터치 44px 미만 0. 로그인 완료 흉내(쿠키 부여 후 `window.location.replace(callbackUrl)`, 실제 OAuth 는 미수행) → 같은 붙여넣기 화면·`?from` 지워짐·글 채움(84자)·띠 arrived·토스트 0. 일반 로그인·`from=other`·`from` 없음·`//evil.example…?from=share`·`https://evil.example…?from=share` 는 안내 0, 정상 공유 callbackUrl 만 안내(Dplain 9/9, `isShareCallback` 이 외부 출처 거부).
- **D 받지 못함**: 로그인 화면에서 `expireShare()`(30분 TTL 지남) → 로그인 복귀 → 토스트 「공유한 글을 받지 못했어요. 다시 공유해 주세요.」 **정확히 1회**(MutationObserver 로그 1건)·보이는 동안 opacity 1·4.6초 뒤 opacity 0·더 뜨지 않음·입력칸 빈칸(초안 없음)·띠 없음·`?from` 지워짐·consume 1회(null). 새로고침 후 토스트 다시 안 뜸(consume 0). **쓰던 글 있음 + 받지 못함**: 토스트 1회·쓰던 글 그대로·띠 없음. **브라우저(Capacitor 없음)에서 `?from=share` 직접 입력**: 토스트·띠 없음·표시만 지워짐·초안 유지·브리지 호출 없음.
- **E 빈 공유**: 이 화면에서 `share('')` → 토스트 「공유한 내용에 글이 없어요. 글을 골라 공유해 주세요.」 원문 1회·쓰던 글(71자) 그대로·띠 없음·이동 없음·입력칸 초점 없음 / 공백뿐(`'   \n\t　 '`)도 같은 토스트 한 번 더 / 이미 arrived 띠가 있을 때 빈 공유 → 띠·글 그대로+토스트 / 다른 화면(오늘 홈)에서 빈 공유 → 붙여넣기 화면이 열리고(`?from` 지워짐) 토스트 1회·초안 그대로 / 콜드 스타트 빈 공유 → 붙여넣기 화면+토스트·빈 입력칸·버튼 `aria-disabled=true`(기존)·서버 POST 0(출석 ping 제외). 3폭 레이아웃 전부 PASS.
- **서버로 공유 본문이 나가지 않음**: D·D 받지 못함·E 전 상태에서 요청 URL·`postData`·콘솔에 본문 표지 0건.
- **[관찰 O-C1 · Low · 결함으로 세지 않음]** 파일 `src/components/shell/ShareReceiver.tsx` 의 `check` / `src/components/lesson/LessonPasteScreen.tsx` 이벤트 effect / 실행: D1 흐름(로그인 복귀 `location.replace(.../paste?from=share)` — 새 문서가 `?from=share` 로 바로 뜸) / 실제: 브리지 호출 순서 `peek → consume(93) → App.getInfo → consume(null)` — `consume` 이 같은 문서에서 **두 번**(두 번째는 null → 조용히 끝, 토스트·화면 변화 0, 이어서 오는 새 공유도 정상 교체 확인) / 기대(§20-9 「consume 은 붙여넣기 화면 한 곳에서 한 번」): 1회 / 원인 추정: `ShareReceiver` 가 `peek` 를 `await` 한 **뒤에** `window.location` 을 읽는데, 그 사이 붙여넣기 화면 마운트 effect 가 주소의 `from=share` 를 이미 지워 `decideShareAction` 이 `stay` 가 아니라 `signal` 로 판정 → `SHARE_EVENT` → `onShare` 가 두 번째 consume. 콜드 스타트(A) 경로(`router.replace` 이동)에서는 재현되지 않음. 영향: 네이티브 호출 1회 낭비뿐. 제안(Developer 판단): `check` 안에서 주소를 `await` **전에** 읽거나, 화면이 마운트 consume 중/직후(`handledRef`)에는 `SHARE_EVENT` 를 무시.
- **남은 일**: 정리 → 최종 보고. **주의점**: 서버 3011(PID 파일 scratchpad `q052c/server.pid`).

## 최종 판정 (QA 레인 C) — 화면 360/390/412
| 항목 | 판정 | 근거 |
|---|---|---|
| C-1 도착·덮어쓰기·경계 | **PASS** | 336/336 + 경계 8/8. 띠·자르기 줄·토스트 문구 §20 원문 일치, 자동 포커스 없음, `?from` 지움(`history.state` 유지), 쓰던 글 왕복(저장소에 alt 없음), 2,000자 자르기 오라클 일치(직접 붙여넣기·이모지·문장 끝 없음 포함), 한국어 → 서버 400, 하단 y 는 문서 −28 일정 |
| C-2 로그인 전·만료·빈 공유 | **PASS**(관찰 O-C1 Low) | 159건 중 156 PASS + 3건 O-C1 재분류. 로그인 한 줄 안내·복귀 후 채움, 만료 토스트 1회, 빈 공유 토스트·쓰던 글 보존 |
| 서버로 공유 본문 나감 | **0건** | 전 시나리오 요청 URL·postData·콘솔 검색(수업 만들기 누르기 전), C3 만 누른 뒤 `POST /api/v1/lessons` 400 |
- 결함: **Critical 0 · High 0 · Medium 0 · Low 0**, 관찰 Low 1(O-C1 consume 이중 호출), Info 2: ① 하단 y 가 §20-9 와 전 상태 −28px(실기기 확인) ② 2,000자 초과·50자 미만에서도 [수업 만들기] 가 채움색 그대로(`aria-disabled` 만 — 기존 동작, 변경 범위 밖).
- **NOT_VERIFIED(사용자 육안·실기기 S25+ 필요)**: ① 카톡 「공유」 목록에 Lingofy 노출·MIME `text/plain` ② 앱이 꺼진 상태 콜드 스타트·켜진 상태 `onNewIntent` 실제 동작과 콜드 스타트 뒤 기기 뒤로 가기(앱 종료·카톡 복귀) ③ 실제 OAuth 왕복(Custom Tab) 뒤 복귀와 그 사이 프로세스가 죽어 보관함이 사라질 때의 「받지 못했어요」 빈도 — 이번엔 쿠키 부여 + `location.replace` 흉내 ④ 최근 앱에서 다시 열 때 예전 공유가 되살아나지 않는지 ⑤ 키보드가 열렸을 때 띠·자르기 줄·버튼 가림, 실제 상태바 inset 포함 [수업 만들기] 위치 ⑥ TalkBack 의 `role=status` 읽기 ⑦ 다크 모드 ⑧ 네이티브 보관함(Java)은 이 레인에서 fake-capacitor 모사로만 확인(JUnit 은 dev-N 기록).
- **정리**: QA1 Attendance 오늘자 1행(`cmv36e7po0001w1deww74apce`) id 지정 삭제(후보 1건 확인 후) → QA1 행 수 시작 전과 동일(AiJob 14·Chat 3·ChatMessage 64·Correction 5·TutorProposal 8·LearningObservation 453·Attendance 8·StatsSnapshot 3·LearnerErrorStat 2·RequestTrace 281·Profile/설정 1씩). 다른 계정 행 미사용. LLM 호출 0(`CLAUDE_CLI_PATH=/bin/false`, `claude --print` 프로세스 0건 확인).
- **프로세스·산출물 정리(최종)**: 3011 서버를 PID 파일(1160402)로만 종료 → `ss -ltn` 3011 비어 있음(3010 은 기존 서버라 그대로). 격리 복제본 `~/.node-local/thekaiwa-qa052c` 삭제(`ls -d` 없음 확인, 원본 `thekaiwa-share052w/node_modules` 항목 394→394 그대로). 스크린샷 5개(`/tmp/qa-artifacts/TheKaiwa/task-052`) 삭제 — 증빙은 위 측정값 글로 대체. 쿠키·PID·서버 로그 삭제. `/tmp/qa-artifacts/` 루트의 다른 세션 파일 6개는 내 것이 아니라 그대로 둠. 재현 스크립트 `lib·c1·c2·c3.cjs`·`out/*.log` 는 scratchpad `q052c/`(프로젝트 밖)에 보관.
