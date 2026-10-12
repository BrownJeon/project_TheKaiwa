---
project: TheKaiwa
task: task-064
type: qa-record
role: qa
tags:
  - type/qa
  - domain/ask
---
# task-064 QA-B1 기록 — /ask 화면 검증 1차 (모의 응답 기반) (QA, 2026-10-12 19:25~ KST)

> 본 이력서: [[task-064-ask-anything-3a]] · 구현 가이드 `docs/screens.md` §25 · 승인 데모 `docs/demo/task-064-ask-anything-v2.html`(v2) · 계약 `docs/design/api-contract.md` §2-18-A.
> 환경: 검증 서버 `127.0.0.1:3011`(PID 789803, cwd `~/.node-local/thekaiwa-rev064`, `next start`, Leader 준비) · 브라우저 = `playwright-core` + `/usr/bin/google-chrome` 헤드리스, `isMobile`+`hasTouch`, DSF 2.625, ko-KR, Asia/Seoul, `reducedMotion:'reduce'`. **QA2 계정만**(`qa-bot2@thekaiwa.test`). 쿠키·`.env` 값은 기록하지 않는다.
> **실제 AI(LLM) 호출 0건이 원칙**: 답은 전부 `page.route` 로 `POST /api/v1/chats/*/turns` SSE 를 흉내 내고, 모의하지 않은 `.../turns` POST 는 `route.abort()` 안전망. 방 생성(`POST /api/v1/chats {kind:"ASK"}`)·목록·상세는 진짜 서버(LLM 없음).
> 도구(저장소 밖): scratchpad `q064/b1/*.mjs` · 미러 `~/.node-local/thekaiwa-rev064/qa064/counts.ts`.

## ★ 심은 것·정리 방법 (맨 위 고정)

- 지우는 대상은 **QA2(`qa-bot2@thekaiwa.test`) userId 한정 `kind=ASK` Chat**. 시작 값 = 아래 표. 되돌리는 조건 = `qa064/counts.ts` 출력이 시작 값과 같아질 때.
- 심기: QA2 가 `POST /api/v1/chats {kind:"ASK", title}` 로 만드는 방(메시지 0개)과, 시험이 `POST .../turns` 를 안전망으로 막아 새로 생기지 않는 `ChatMessage`. 제안(`TutorProposal`)·단어·기록은 **만들지 않는다**(제안 카드는 가짜 id 의 모의 응답만, 채택/거절 요청은 브라우저에서 가로채 서버에 도달하지 않음).
- 정리: QA2 쿠키로 `DELETE /api/v1/chats/:id`(앱 API) → `qa064/counts.ts` 로 시작 값 대조 → 쿠키 `scratchpad/q064/b1/c2` 삭제.

## 시작 값 (심기 전, `qa064/counts.ts start`, 2026-10-12 19:29 KST)

| 테이블 | QA2 |
|---|---|
| Chat / Chat(ASK) / ChatMessage | **0 / 0 / 0** |
| TutorProposal / Correction(ACCEPTED) | **0 / 0(0)** |
| WordEntry / StudyLog / StatsSnapshot / AiJob / RepetitionItem | **0 / 0 / 0 / 0 / 0** |
| LearningObservation / RequestTrace | 27 / 61 (기존 값 — 변하면 안 됨, 특히 RequestTrace 가 늘면 서버로 턴이 샌 것) |
| Profile.level | `N5` |

- 시작 전 `claude --print` 프로세스 = **0**.

## 체크포인트

(아래에 항목 끝날 때마다 append)

### 체크포인트 1 (19:55 KST) — 항목 1(목록)·2(보내는 범위 시트) 완료
- **완료**: 
  - 항목1 목록 `/ask` 3폭 PASS — 빈 목록(예시 4칩 wrap·「이렇게 물어볼 수 있어요」·칩 44·입력카드·탭 5개 「회화·공부·계획표·단어장·질문」, 「질문」 `aria-current=page`·탭 높이 56)·방 7개(행 67.5~69.5·긴 한국어/일본어 제목 말줄임 실제 잘림·「답 만드는 중」 뱃지 행·「새 답」 점 행·둘째 줄 preview·[이전 질문 더 보기]→+2행)·폴링(running→false 0.5초 안에 토스트 「답이 도착했어요」 1번 + 「새 답」)·로딩 자리표시(입력 카드 실제·`role=status`「불러오고 있어요」·보이는 「불러오는 중」 0·입력카드/예시/지난질문/첫행 위쪽 점프 0px)·첫 쪽 실패(오류 상자 문구 일치·[다시 시도] 44·입력 카드 유지). 가로 넘침 0·페이지 세로 스크롤 0·세로 스크롤 상자 = `main` 1곳(목록 많을 때), 44px 미만 터치 대상 0. 예시 칩 → 입력창 채움+초점, 요청 0.
  - 항목2 시트 3폭 PASS — 첫 질문 시 시트(제목 초점, 문구 = §25-5 I·승인 데모 문구와 글자 일치), 확인 전 `POST /api/v1/chats` 0, [취소]·Esc·배경 탭 모두 글 유지·방 0·초점 [물어보기]로 복귀, [알겠어요, 보내기] 후 `localStorage kaiwa.ask.scopeNotice.v1='1'`, 방 생성(서버 제목 = 첫 질문 정리본)·`sessionStorage kaiwa.ask.pending.<id>` 기록 후 방 마운트에서 삭제, 같은 기기 두 번째 질문엔 시트 없음, 저장소 키 삭제 후 다시 뜸. 버튼 44/48.
- **Leader 지시문과 승인 데모의 차이(결함 아님, 확인 요청)**: 지시문은 시트에 「설명/역할극 표현/단어장은 포함되지 않는다」가 적혀 있어야 한다고 했으나, 승인 데모 v2(`task-064-ask-anything-v2.html` 1089~1096행)·§25-5 I(L-5 정정 후)·구현(`askCopy.scope`)은 「보내지 않는 것」 3줄(이메일·계정 정보 / 내부 번호(id) / 다른 회화·채팅의 대화 내용)뿐이다. 구현 = 승인 데모와 일치.
- **QA 도구가 한 일(부작용 방지)**: 셸이 페이지마다 부르는 `POST /api/v1/attendance/check-in` 은 DB 를 바꾸므로 브라우저에서 가로채 성공으로 모의(서버 0건). 모든 비-GET 은 허용 목록(방 생성·삭제·제목 수정·`text/annotate`) 밖이면 abort.
- **심은 행**: QA2 ASK 방 — 수동 1(QA 시험 방 하나) + 시험 실행 3폭 × 2 = 7개(전부 메시지 0). `POST .../turns` 서버 도달 0(모의) — leaks=[].
- **남은 일**: 항목3~9(방 렌더·XSS, 근거 카드, 되묻기 칩, 제안, 오류/대기/복원, 레이아웃·접근성, 회귀) → 정리.
- **다음 첫 명령**: `cd scratchpad/q064/b1 && node t3-room.mjs` (없으면 lib.mjs 재작성 필요 — lib 는 scratchpad 에 있음).
- **주의점**: 서버 3011 PID 789803 건드리지 않음. 쿠키 `q064/b1/c2`. 정리 = QA2 쿠키로 `DELETE /api/v1/chats/:id`(QA2 ASK 방 전부), `qa064/counts.ts` 대조.

### 체크포인트 2 (19:52 KST) — 항목 3~9 완료 · 정리 완료 (최종)
- 도구: `scratchpad/q064/b1/{lib,t1-list,t2-scope,t3-room,t4-err,t5-pending,t6-misc,t7-lock}.mjs`(재실행 가능). 뷰포트 360×740·390×844·412×892(DSF 2.625, `isMobile`+`hasTouch`, 모바일 UA, ko-KR, Asia/Seoul, `reducedMotion:reduce`, Chrome 헤드리스 playwright-core 1.58). 다크는 390 한 폭(목록·방 2화면)만.
- **재현 조건(데모 게이트 §8)**: 위 뷰포트·DSF·locale·timezone, 애니메이션 비활성(reduce), 폰트는 시스템 글꼴(헤드리스 — 높이 수치는 순위 비교용, 데모와 동일 조건), 네트워크 fixture = `page.route`·브라우저 안 `fetch` 가로채기(턴·방 상세·목록·제안), 캡처 범위 = 상태별 뷰포트(전체 페이지 아님). 허용 범위는 Reviewer 차이 분류 기준을 따른다.

#### 판정표 (3폭 모두 같은 결과 — 다른 값은 별도 표기)
| # | 항목 | 판정 | 실행 근거 |
|---|---|---|---|
| 1 | 목록(빈·여러 개·로딩·오류·폴링·새 답) | PASS | 위 체크포인트 1 |
| 2 | 보내는 범위 시트 | PASS(지시문-데모 차이 1건 확인 요청) | 체크포인트 1 |
| 3 | 방 렌더(문단·목록·굵게·기울임·번호 목록·예문 블록 두 형식·긴 일본어 줄바꿈) | PASS | 답 `article` 안 `a/img/script/iframe/button` 0, 예문 4블록(뜻 줄 `>→` / 기호 없는 줄 둘 다 인식)·일본어 17px·본문 15px/24.75·예문 오른쪽 끝 ≤ 뷰포트−16(359/329/381)·넘침 0, ▶ 듣기 0, 표시 바 토글 2개(히라가나·한글, 번역 없음) |
| 3 | 링크·이미지·HTML 주입 | PASS | 합성 `answerMd`(`<script>`·`[x](https://…)`·`![](data:…)`·`<img onerror>`·`<iframe>`·`<a href=javascript:>`·`<https://…>`·맨 URL·`www.`·`javascript:`·`data:`·`vbscript:`)에서 `a/script/img/iframe/[onerror]` 0, `window.__xssFired` 0, 화면 글에 `https?:`·`www.`·`javascript:`·`data:` 0(링크 글자 「링크글자」·「눌러」·「html앵커」는 남음, `<script>` 안 글은 평문으로 남음 — 계약상 허용). 방 제목·내 말풍선·목록 제목·미리보기에 `<img onerror>`/`<script>` 를 넣어도 글자로만 보이고 `img` 0 |
| 3 | 대기 상태 「나가서 기다리기」 없음 | PASS | 대기 카드 안 버튼·링크 0, 본문 전체에 「나가서 기다리기」 0, 취소·중단 글 0 |
| 4 | 근거 카드 | PASS | 7장 → 3장 + 「4개 더 보기 ▾」(`aria-expanded`, 펼친 뒤 초점 그 버튼·이름 「접기」)·「접기」→3장. 머리 줄 「교정 · 10월 10일」, 링크 카드 이름 = 카드 글, 높이 56/77. `id:null` 집계: `STUDY_LOG`→`/plan`·`REVIEW`→`/study/today` 링크(계약 3항), `CORRECTION id:null`·모르는 유형·`SCENARIO id` 없음 → 누를 수 없는 `<div>`(초점 안 감). 수업 카드 → `/study/today/talk/les1`, `kaiwa.askReturn` 기록, 머리 「질문으로」 → 같은 방 복귀 후 기록 삭제. 교정 카드 → `/drawer/corrections`(`kaiwa.askReturn` 없음), 휴대폰 뒤로 → 같은 방 |
| 5 | 되묻기 칩 | PASS | 칩 3개 + [직접 쓸게요], 보이는 40·터치 44(`::before`), `role=group` 「기간 고르기」·캡션 「눌러서 답하기」. 누르면 `{text:"지난 30일",inputSource:"TEXT",scope:{key:"LAST_30D"}}`, 내 말풍선 「지난 30일」, 새 질문 뒤 칩 사라짐, 초점은 목록(`tabindex=-1`). [직접 쓸게요] → 입력창 초점 + 「기간을 적어 주세요 (예: 9월, 지난 2주)」. 안내 확인 전 칩 → 시트, [취소] 시 요청 0·칩 유지 |
| 6 | 제안 카드 | PASS(서버 반영은 이 갈래 밖) | ADD_WORD·ADD_STUDY_LOG(ask 문구)·SET_LEVEL(N5→N4) 3장, **ADD_TOPIC·SCHEDULE_REVIEW 안 그림**, 버튼 48(「✎ 뜻 고쳐서 추가」 44). 채택 요청 `POST /api/v1/proposals/p3/accept {}` 가로채기: 1회 abort → 카드 그대로·완료 줄 없음, 2회째 브라우저 안 모의 성공 → 「✓ 레벨을 N4로 바꿨어요 · 설정에서 언제든 되돌릴 수 있어요」, 「남기지 않기」→「기록하지 않았어요」. **서버 도달 0**(가짜 id) |
| 7 | 429 문구 | PASS | `ASK_RATE` 20초→「…20초 뒤에 보낼 수 있어요.」(1초마다 줄어 18초 확인), 120초→「2분」, `ASK_DAILY`(40000초)·reason 없이 5000초→「오늘은 더 보낼 수 없어요 — 내일 다시 물어봐 주세요.」, reason 없이 30초→「30초」, `ASK_BUSY` 15초→「지금 질문이 몰려 있어요. 15초 뒤에 다시 물어봐 주세요.」(카운트다운 확인). 남은 횟수·한도 숫자 0, 입력 글 복원, 안내 줄 45/56px, 잠긴 [보내기] 탭 시 토스트(「40초 뒤에 보낼 수 있어요」·대기 중 「답을 받은 뒤 보낼 수 있어요」) |
| 7 | 409·네트워크·시간 초과·답 불가·LOW·기록 없음·복원 | PASS | 409=「선생님이 다른 메시지에 답하는 중이에요. 답이 끝나면 다시 보내 주세요.」+글 복원, 네트워크=「보내지 못했어요. 인터넷 연결을 확인하고 다시 보내 주세요.」+글 복원, `ENGINE_TIMEOUT` 카드 「답이 너무 오래 걸려 멈췄어요」+[다시 받기] 44 → 본문 `{resumePending:true}`·새 말풍선 0·카드 사라지고 답, `ENGINE_ERROR` 카드 「선생님이 지금 답할 수 없어요」. LOW+근거 / LOW+근거 없음 두 문구, 「관련 기록을 못 찾았어요 — 일반 설명으로 답할게요.」(PROGRESS·count 0만, GENERAL·HIGH 은 줄 없음). 대기 중 새로고침 → 대기 카드 복원(질문 시각부터 42초·「답 쓰기」·30초 안내, 버튼 0)·폴링으로 답 도착 후 대기 카드 제거. 404 카드(질문 방을 찾을 수 없어요, [질문 목록으로] 44, 탭 숨김) |
| 7 | 대기 3단계·초·안내(스트림 모의, 실시간) | PASS | PROMPT→「질문 살펴보기」●, LLM→✓/「답 쓰기」●, PARSE→✓✓/「정리하기」●. 4초엔 초 없음, 7초에 「· 7초」(`aria-hidden`), 카드 높이 130.3(30초 전)→196.8(안내 2문장), 90초대 「거의 다 됐어요. 2분이 지나면 멈추고 알려 드려요.」+「다른 화면으로 가도 …」. 도착 알림 `role=status.sr-only` 「선생님 답이 도착했어요 · 근거 2개 · 제안 1개」, 목록 `aria-live=off`, 입력 중이던 글 유지·초점 입력창. (29/30·89/90초 경계는 단위 시험 몫 — 37초·91초 시점만 실측) |
| 8 | 레이아웃 | PASS | 목록·방·시트·오류·대기·제안·근거 모든 상태 가로 넘침 0·페이지 세로 스크롤 0, 세로 스크롤 상자 = 목록 `main`/방 `MessageList` 각 1곳, 44px 미만 터치 대상 0(칩·근거 카드·버튼·탭 56), 글자 11~20px(본문 15·예문 17·입력 16·정보 줄 13.5, 11px 미만 0), 대비(라이트): 본문 15.8·정보 줄 13.8·근거 유형 6.2·시각 5.8·「더 보기」 머리 5.8 / (다크 390) 본문 13.8·정보 12.1·근거 유형 7.7, 다크 토큰 반전(배경 `rgb(20,24,22)`·글 `rgb(236,239,233)`)·넘침 0 |
| 8 | 키보드 | PASS(축소 모의)·NOT_VERIFIED(실기기) | 뷰포트 높이 −330(410/514/562)에서 방 입력 바 `bottom` 402/506/554 ≤ 높이, 목록 253/357/405로만 줄어듦, 머리 고정, 목록 카드 `bottom` 200·버튼 252 가림 없음. **하단 탭 숨김(`data-kb`)은 헤드리스에서 발동하지 않음 → 실기기 확인 필요**, safe-area 하단도 실기기 |
| 8 | 초점 순서·이름 | PASS | 방 Tab 순서 = 질문 목록으로 → 질문 방 메뉴 → 히라가나 → 한글 → 근거 링크 → 제안 버튼 → 질문 입력 → 보내기(D7 순서). 메뉴 시트 [제목 바꾸기·보내는 범위 보기·질문 방 삭제], 「보내는 범위 보기」(again, 닫기 버튼만)→닫으면 초점 ⋯ 로, 삭제 확인 문구 §25-5 H 와 일치 |
| 9 | 회귀 | PASS | `/study/ai`·`/study/today`·`/plan` 하단 탭 「회화·공부·계획표·단어장·질문」, 해당 탭 `aria-current`, 높이 56, 넘침 0, 콘솔 오류 0(QA 가 막은 요청 제외). `/ask` = 목록(탭 있음, 「질문」 선택), `/ask/:id` = 탭 없음. `/ask` 계열 콘솔 오류 0 |

#### 결함·관찰 (심각도순)
- **[QA64-B1-1] Low — `/ask/:id` 「질문 방을 불러오지 못했어요.」 [다시 시도] 높이 20px(터치 44 미만)**: 재현 = 방 상세 `GET /api/v1/chats/:id` 가 500 인 상태로 방 열기(360/390/412 동일, 모의 500), `ErrorBlock` 의 버튼 `getBoundingClientRect().height=20`. 기대 = §25-9 「터치 44px」 — 목록 오류 상자는 §25-4 F 대로 44, 방 오류만 공용 `ErrorBlock` 그대로(가이드가 방 쪽엔 44 처리를 적지 않아 **가이드 공백**이기도 함). 스크린숏 판독: 없음(`q064/b1/shots` 삭제 — 측정값이 근거). 
- **[QA64-B1-2] Low(정보) — 429 잠금 시 [보내기] `aria-label`·토스트가 초(秒) 원값**: `ASK_DAILY` 40000초면 안내 줄은 「오늘은 더 보낼 수 없어요 — 내일 다시…」인데 버튼 이름은 「40000초 뒤에 보낼 수 있어요」, 120초는 줄 「2분」/버튼 「120초」. §25-5 G 가 「기존 문구」를 쓰라고 해서 **가이드대로**이지만 낭독 사용자에겐 어색 — 후속 후보.
- **[QA64-B1-3] Low(정보) — 알 수 없는 유형 근거 카드의 글리프 원이 빈 회색 원**: `sources[].type` 계약 밖 값이면 라벨만 그리지만 표식 칸은 비어 있음(정적 카드, 초점 없음).
- **관찰(이 task 변경 아님·기존 공용)**: ① 방 입력 바 `textarea` `scrollHeight 44 / clientHeight 42`(내부 2px 스크롤 가능성, 공용 `Composer`) ② 하단 탭 비활성 라벨 대비 3.13:1 @11px(라이트, 다크 4.3) — 공용 `TabBar` [추측: 기존 값].
- **데모·가이드와 다른 점(「데모 이탈」)**: ⓐ `noneLine`(「관련 기록을 못 찾았어요」)은 `needsScope` 가 있으면 그리지 않음(구현 `askAnswerView`) — §25-5 B 의 수식(`needsScope` 조건 없음)과 다르나 코드 주석(「조회 전 되묻기」)대로 합리적 → Leader/designer 가이드 정정 요청 ⓑ 지시문의 「시트에 설명·역할극 표현·단어장 제외 문구」는 승인 데모 v2·§25-5 I·구현 어디에도 없음(구현=데모 일치) ⓒ 「답 만드는 중」 행 높이 69.5(뱃지 줄 68.5 와 1px 차) — 무시 가능.

#### 미실시·NOT_VERIFIED (이유)
- 실제 AI 답·SSE 증분·서버가 연결이 끊겨도 끝까지 만드는지·서버 살균·A9 응답 품질·지연 영향: 이 갈래는 모의 응답(LLM 0) — 다른 갈래/실서버 몫.
- 제안 **채택의 서버 반영·행 수**(`WordEntry`/`StudyLog`/레벨): 요청을 막았으므로 미검증(가짜 id).
- 키보드 열림 시 하단 탭 숨김·safe-area·TalkBack 낭독·앱 WebView·실제 폰트 높이: 실기기.
- 표시 바 토글 후 후리가나(`ruby`) 제거: 토글이 `PUT /api/v1/settings/profile` 을 보내는데 QA 가드가 막아 상태가 되돌아감 → NOT_VERIFIED(공용 `DisplayBar`).
- 다크는 390 한 폭만, 360/412 다크 미실시. 목록 폴링 200초 상한·`LOST` 경로·`ASK_BUSY` 잠금 토스트 개별 확인(같은 `Composer` 경로)·30초/90초 경계 정확값은 미실시.

#### 정리·대조 (19:51 KST)
- 만든 방: QA2 ASK 방 7개(수동 1 + t2 실행 6) 전부 앱 `DELETE /api/v1/chats/:id` 로 삭제(7×200, 삭제 뒤 목록 `items:[]`).
- 끝 값(`qa064/counts.ts end`) = 시작 값과 동일: Chat 0/ChatASK 0/ChatMessage 0/TutorProposal 0/Correction 0(ACCEPTED 0)/WordEntry 0/StudyLog 0/StatsSnapshot 0/AiJob 0/RepetitionItem 0, LearningObservation 27, **RequestTrace 61(불변)**, Profile.level N5.
- **실제 AI 호출 수(이 갈래) = 0**: 모든 `/turns` POST 가 브라우저 안에서 모의(서버 도달 `leaks` 0), QA2 `RequestTrace` 61→61·`ChatMessage` 0→0·`AiJob` 0. 참고: 19:50 에 서버 3011 의 자식 `claude --print`(PID 834520)가 보였으나 같은 시각 최신 `RequestTrace` 는 `qa-bot3`·`qa-bot4`(다른 갈래) 것이라 이 갈래와 무관.
- 삭제: `scratchpad/q064/b1/shots/*.png` 101개 + 폴더, 쿠키 `c2`. 남긴 것: 스크립트·JSON 결과(비밀 없음)·미러 `qa064/{counts,who}.ts`(읽기 전용).
- 프로세스: 내 Chrome 은 스크립트마다 종료(`playwright_chromiumdev_profile` 프로세스 0), 서버 3011(PID 789803)·3010 그대로(내가 끄지 않음), 3012 비어 있음.
