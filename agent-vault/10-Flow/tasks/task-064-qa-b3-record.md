---
project: TheKaiwa
task: task-064
type: qa-record
role: qa
tags:
  - type/qa
  - domain/ask
---
# task-064 QA-B3 기록 — 질문 방 답 도착 스크롤 위치(§25-5 J, QA64-B2-1 수정) 브라우저 검증 (QA, 2026-10-12 KST)

> 본 이력서: [[task-064-ask-anything-3a]] · 이전 [[task-064-qa-b2-record]] · 규칙 정본 `docs/screens.md` §25-5 J(J-1~J-9) · 구현 [[task-064-dev-scroll-record]] · 감사 [[task-064-rev-scroll-record]] · 결정 이유 [[task-064-designer-scroll-record]].
> 환경: 검증 서버 `127.0.0.1:3011`(PID 1106838, cwd `~/.node-local/thekaiwa-rev064`, BUILD_ID `XRmlTeybODxe689sb7Qlo`, `next start`) · 브라우저 = `playwright-core` + `/usr/bin/google-chrome` 헤드리스(본인이 연 것만 닫음), `isMobile`+`hasTouch`, DSF 2.625, ko-KR, Asia/Seoul, `reducedMotion:'reduce'`, 뷰포트 360×740 / 390×844 / 412×892. **QA2 계정만**(`qa-bot2@thekaiwa.test`). 쿠키·`.env` 값은 기록하지 않는다.
> **실제 AI(Claude CLI) 호출 0회**가 계약 — `POST …/turns` 는 `page.route` 로 SSE 를 모의하고, 모의하지 않은 `turns` POST 는 `route.abort()` 안전망. 시작·끝 `RequestTrace` 숫자가 같아야 한다. 방 생성·삭제 외 비-GET 은 가드(출석 체크인·텍스트 분석은 모의).
> 도구(저장소 밖): scratchpad `q064/b3/*.mjs` · 미러 `~/.node-local/thekaiwa-rev064/qa064/counts.ts`(읽기 전용).
> **상태: 완료 (QA-B4 가 마무리, 2026-10-12 KST)** — 항목 1~3 PASS(B3) · 항목 4~7 PASS(B4 해석) · 항목 8 PASS · 정리 대조 일치(Chat 0/ChatMessage 0/RequestTrace 67) · 실제 AI 호출 0 · 결함 Critical/High/Medium 0, Low 1(QA64-B4-1). 판정표는 맨 아래 「마무리(QA-B4)」.

## ★ 시작 값 (`qa064/counts.ts B3-start`, 2026-10-12 KST) — 맨 위 고정

B2 가 중단돼 지우지 못한 ASK 방 4개가 **포함된** 상태다(B2 시작 값 = 0/0).

| 테이블 | QA2 시작 값 | 끝에 돌아와야 할 값 |
|---|---|---|
| Chat / Chat(ASK) / ChatMessage | **4 / 4 / 12** | **0 / 0 / 0**(B2 시작 값) |
| TutorProposal / Correction(ACCEPTED) | 0 / 0(0) | 0 / 0(0) |
| WordEntry / StudyLog / StatsSnapshot / AiJob / RepetitionItem | 0 / 0 / 0 / 0 / 0 | 같음 |
| LearningObservation | 27 | 27 |
| RequestTrace | **67** | **67**(AI 0회 계약) |
| Profile.level | `N5` | `N5` |

- B2 방 4개 = A1 `cmv5585r9004fw1ezer7t6j9o`(msg 4) · A2 `cmv55ac5d004rw1ezx4nxqci2`(msg 2) · A3 `cmv55cjyu0059w1ezftvbbps3`(msg 4, 되묻기+칩) · A4 `cmv55f6ak0065w1ez0u40kxj9`(msg 2). 합계 메시지 12.
- 정리 대상 = 위 4개 + 이번에 만든 방(앱 `DELETE /api/v1/chats/:id`, 소유자 쿠키).

## 체크포인트

(10턴마다 append)

### 체크포인트 1 (턴 ≈ 28) — 도구·재진입(항목 1·6 일부) 완료 · 실제 AI 0
- **도구**(scratchpad `q064/b3/`): `lib3.mjs`(페이지 안 `fetch` 가 `POST …/chats/*/turns` 를 가로채 SSE `accepted → status → 지연 → done` 을 만들어 낸다 — `cfg` 없으면 로컬 500 반환 + 서버 쪽 `route.abort` 이중 안전망, 프레임(rAF) 기록기 `__qa.frames`, localStorage `kaiwa.ask.scopeNotice.v1=1` 로 범위 시트 건너뜀) · `reentry.mjs`(실제 저장 답 4방·합성 4,000자 GET) · `reentry2.mjs`(GET 응답 가공 변형: 짧은 답·중간 답·대기·실패·질문뿐 등). DB 변경 0.
- **재측정 기준**: `C`=583/687/735 로 가이드와 일치(실측), `pad`=12.
- **재진입 · 마지막이 완성된 답(J-7 표 · 허용 ±2)** — 질문 `<li>` 윗면 − 목록 위(합격 12±2) · 답 `article` 윗면(합격 360 [48,242] · 390 [48,277] · 412 [48,293]) · 이전 빌드(B2 `article.top`)

| 방 | 폭 | 질문 윗면 | article 윗면 | 판정 | 이전 빌드 article.top(B2) |
|---|---|---|---|---|---|
| A2(540자) | 360 | 12 | 151.5 | PASS | −134~−331 대(360 4방) |
| A2 | 390 | 12 | 151.5 | PASS | −181~+3 대(390 4방) |
| A2 | 412 | 12 | 151.5 | PASS | −44~+75 대(412 4방) |
| A1(이어 묻기 2번째 답) | 360 / 390 / 412 | 12.4 / 11.9 / 12.4 | 151.9 / 128.2 / 128.7 | PASS ×3 | 〃 |
| A3(「지난 30일」 답, 긴 답) | 360 / 390 / 412 | 11.8 ×3 | 127 ×3 | PASS ×3 | 〃 |
| A4(표 질문 답, 972px) | 360 / 390 / 412 | 12 ×3 | 151.5 ×3 | PASS ×3 | 〃 |
| 합성 4,000자(L4, article 5,390/5,224/4,855px) | 360 / 390 / 412 | 12.4 / 11.9 / 12.4 | 151.9 / 128.2 / 128.7 | PASS ×3 (이전: 시작이 5,100px 위) | |

  첫 그리기부터 1.8초 동안 150ms 간격 12표본 + 3초 뒤 재측정에서 질문 윗면이 **표본 내내 같은 값**(정렬 오차 0 — 감사 정보 항목 「첫 로드 직후 입력 바 높이 변화로 C 가 달라지면 어긋날 수 있음」은 재현 안 됨, 12표본 모두 동일). 알약 0, 콘솔·페이지 오류 0, 서버로 간 turns 0, 가드 차단 0.
- **재진입 · 짧은 답·칩(변형)**: S1(A2+짧은 답, 목록이 안 넘침 max=0) · M1(중간) 은 `scrollTop=0=max`(안 넘쳐 자명). 넘치는 목록(A1 기반): **S2 짧은 답** 360/390/412 `fromBottom=0` PASS · **M2 중간 답** `fromBottom=0` PASS(질문·답 모두 보임). **A3s(되묻기 답+칩)**: 칩 [이번 주][지난 30일][전체 기간][직접 쓸게요] **4개 전부 보임**(3폭), 목록 안 넘침.
- **재진입 · 이어받은 대기(WAIT2, A1 기반 PENDING·running)**: 390·412 `fromBottom=0` PASS(카드 전체 보임). **360 에서 `fromBottom=14`**(대기 카드 아랫면이 목록 아래 1.7px 넘어감) → 첫 폴링(≈2.6초)에서 0 으로 복구. 프레임 기록: 161ms 에 바닥(st 830)→175ms 한 프레임에 행 높이가 바뀌며(`lastH 166→233`, `sh 1413→1405`) `st=808`. 대기 카드가 한 프레임 안에 커지는 동안 `followContent` 가 따라가지 않음 [가능성 높음 — 폰트 교체로 인한 행 높이 변화, 전체 높이는 줄어 `h > lastHeight` 조건에 안 걸림]. **새 코드 경로가 아니라 기존 default(바닥) 경로**라 이번 변경의 회귀로는 보지 않으나 J-7 표(이어받은 대기 ±1)와 어긋나 아래 결함 후보로 기록(QA64-B3-1 Low).
- **재진입 · 실패 카드(FAIL2)**: 3폭 `fromBottom=0`, [다시 받기] 보임(inView ✓). **내 질문뿐(QONLY2)**: 3폭 `fromBottom=0`, 마지막 행(질문) 보임.
- **남은 일**: 항목 2(SSE 도착 3폭·긴/4,000자/짧은 답·프레임 유지) · 3(폴링) · 4(위로 올림·알약) · 5(키보드·글자 200%) · 7(회귀 TALK/CHAT) · 8 · Q8·SEP·EMPTY 재진입 · 정리.
- **다음 첫 명령**: `cd scratchpad/q064/b3 && node arrive.mjs 360 A2 bottom`(작성 예정).
- **주의점**: 서버 3011 PID 1106838 그대로. 쿠키 `q064/b3/c2`(600). 만든 방 0개(방 가공은 전부 GET 모의). B2 방 4개 삭제 대기. 가공 GET 에 쓴 가짜 id 는 서버로 안 감. 미정리 행·폴더 = B2 방 4개(QA2 ASK) + scratchpad `q064/b3/`.

### 체크포인트 2 (턴 ≈ 46) — 항목 2(SSE 도착)·3(폴링 이어받기) 완료 · 실제 AI 0
- **도구 추가**: `arrive.mjs`(방 A1 에서 입력창으로 보내면 페이지 안 `fetch` 모의가 SSE `accepted→status(PROMPT, 50ms)→status(LLM, 400ms)→done(4초)` 를 내보냄. 실제 답 본문은 B2 방 A1·A2·A4 의 저장 값, L4 = A1 답 반복 합성 3,750자, SHORT 65자, MED 186자(A2 앞 3문단), A3S = 되묻기 답+칩. `done` 순간부터 rAF 100프레임 기록 + 2.3초 뒤 재측정) · `poll.mjs`(방 A1 GET 모의: 대기→3.5초 뒤 DONE, `reloadProposals` 응답을 800ms 늦춰 SET_LEVEL 제안 카드가 뒤늦게 붙게 함).
- **도착 · SSE `done`, 바닥에서 대기 — J-7 표(질문 `<li>` 윗면 − 목록 위 합격 12±2, article 합격 360 [48,242]·390 [48,277]·412 [48,293], 짧은 답은 바닥 ±1)**

| 답 | 폭 | 질문 윗면 | article 윗면 | `done` 직후 → 5·10프레임 → 100프레임·+2.3초 | 판정 |
|---|---|---|---|---|---|
| A2 540자 | 360 / 390 / 412 | 12.3 / 11.8 / 11.7 | 127.6 / 127.1 / 127 | 첫 답 프레임부터 동일, `st` 한 값(1vals) | PASS ×3 |
| A1 548자 | 360 / 390 / 412 | 12.3 / 11.8 / 11.7 | 127.6 / 127.1 / 127 | 동일 | PASS ×3 |
| A4 623자(구조 질문) | 360 / 390 / 412 | 12.3 / 11.8 / 11.7 | 127.6 / 127.1 / 127 | 동일 | PASS ×3 |
| L4 합성 3,750자(스크롤 5,027/4,569/4,354px 남음) | 360 / 390 / 412 | 12.3 / 11.8 / 11.7 | 127.6 / 127.1 / 127 | 동일 | PASS ×3 |
| SHORT 65자 | 360 / 390 / 412 | 271.3 / 375.8 / 423.7 | 386.6 / 491.1 / 539 | `fromBottom=0`(바닥 ±1) | PASS ×3 |
| MED 186자 | 360 / 390 / 412 | 139.3 / 243.8 / 291.7 | 254.6 / 359.1 / 407 | `fromBottom=0` | PASS ×3 |
| A3S 되묻기+칩 | 360 / 390 / 412 | 230.3 / 333.8 / 382.7 | 345.6 / 449.1 / 498 | `fromBottom=0`, 칩 4개(화면 안) | PASS ×3 |

  - **J-6 ① 프레임 유지**: 긴 답 12건 모두 `done` 첫 답 프레임부터 100프레임(≈1.7초)·+2.3초 뒤까지 `scrollTop` 값이 하나(1vals), 질문 윗면 변화 0 — 바닥으로 되돌아가는 프레임 없음. 대기 카드(`preFrame`)에서 답으로 바뀐 첫 프레임이 이미 정렬 위치(깜빡임 없음).
  - SHORT·MED 는 첫 5프레임 안에 `artH` 가 183→158(−25px) 줄며 `st`·`sh` 가 같이 −25(예문 층 자리가 「텍스트 분석 모의 available:false」 로 접힘) — 바닥(`fromBottom=0`) 유지, 정렬 규칙과 무관.
  - 알약 0, 콘솔·페이지 오류 0, 서버로 간 turns 0(`__qa.turnCalls` 1·`blocked` 0·route 누수 0·가드 차단 0).
- **도착 · 폴링 이어받기(대기→DONE, 제안 카드가 800ms 늦게 붙음)**

| 답 | 폭 | 도착 직후 q | 카드 붙은 뒤 q | 변화 | 판정(J-7: ≤2px) |
|---|---|---|---|---|---|
| A2 540자(긴) | 360 | 12.3 | 12.3 | 0 | PASS |
| L4 합성(긴) | 360 | 12.3 | 12.3 | 0 | PASS |
| MED 186자 | 360 | 139.3 | 12.3 | −127 | 해석 필요(아래 A) |
| MED | 390 / 412 | 243.8 / 291.7 | 18.8 / 66.7 | −225 | 해석 필요(아래 A) |
| SHORT | 360 | 271.3 | 46.3 | −225 | 해석 필요(아래 A) |

  - **A. 해석**: 「정렬 뒤 제안 카드 ≤2px」 는 **카드가 질문 정렬 자리 아래에 붙는 긴 답**에서 성립(위 A2·L4 0px). 중간·짧은 답은 도착 때 질문 윗면이 아니라 **바닥**에 맞춰져(`target` 이 `max` 로 clamp) 카드(≈225px)가 붙으면 `realign` 이 `clamp(aTop−lead−pad,0,newMax)` 로 다시 맞춰 **질문+답+카드가 모두 보이는 가장 아래 자리**(`fromBottom=0`)로 감 — 360 은 q=12.3(정확히 정렬), 390 은 18.8(=target 이 새 바닥으로 clamp), 412 는 66.7. 공식대로이며 질문·답 시작·카드 전부 화면 안 → 결함으로 보지 않는다. [가능성 높음 — 가이드 J-7 표 문구는 「긴 답 정렬 뒤 카드」 를 가정, 중간 답 문구는 없음 → 문구 보강 권고(정보)].
  - **만짐**: DONE 폴링 뒤 목록 모서리를 **실제 터치 탭**(+≈330ms, 카드 도착 전)하면 360 MED 에서 최종 q=**−85.7**(untouched 12.3) — 창이 끝나 `follow`(바닥 따라가기)로 돌아간다 = 가이드 J-3 「만지면 기존 followContent 규칙」 대로(질문 윗부분이 85px 잘림 = 기존 동작, 읽던 자리를 되돌리지 않음). 390·412 는 clamp 라 만져도 같음.
  - **[n개 더 보기] × 2초 창**(390, MED 2문단 + 근거 5개, 제안 없음): 도착 +474ms 에 클릭 → q 61.8→**−63.2**, 3.4초 뒤 클릭(창 밖 대조군) → q 61.8→**−63.2** — **결과 동일**: 클릭이 「만짐」으로 쳐져 창 안에서도 realign 으로 끌어올리지 않음(감사 REV-SCROLL-4 권고 반영 확인 PASS).
  - 폴링 도착 모두 알약 0, 콘솔·페이지 오류 0, 서버로 간 turns 0.
- **남은 일**: 항목 4(위로 올림·알약·클릭 후 초점, upvis) · 5(키보드 440/450·글자 200%) · 7(회귀 chat/talk) · 재진입 변형 Q8·SEP·EMPTY — **batch3 가 백그라운드 실행 중**(`q064/b3/batch3.log`) · 8(공용 수정 재확인: 가로 스크롤·44px·금지 요소·불러오기 실패) · 정리.
- **다음 첫 명령**: `cd scratchpad/q064/b3 && cat batch3.log`.
- **주의점**: 서버 3011 그대로(PID 1106838). batch3 가 헤드리스 크롬을 스크립트마다 열고 닫음(본인 것만). 만든 방 0개. B2 방 4개 삭제 대기.

## 마무리(QA-B4) — 완료 (2026-10-12 KST, B3 가 60턴 한도로 끊겨 새로 소환)

### 체크포인트 B4-1 (턴 ≈ 11) — batch3 원자료 읽기·코드 대조
- **완료**: `batch3.log` 28줄 전부 읽음(`BATCH3-DONE` 확인). `pillclick`·`up-noclick`·`upvis`·SHORT·L4 JSON 요약(`sum3.mjs`). 위로 올림 도착 = 3폭 `scrollTop` 0→0(변화 0), 알약 1개 「새 답 ↓」, 클릭 뒤 질문 윗면 12.3/11.8/11.7, `activeElement` = `log:대화 내용`(목록), 알약 사라짐 — 상세 판정표는 최종 절.
- **발견 [확실 — 코드·계산식 대조]**: `hitH=36` 은 **측정 도구 한계**다 — 알약 `::before` 는 `top-1/2 h-11 -translate-y-1/2`(높이 44, 가운데 정렬)인데 `lib3.listStateFn` 의 `hitH` 는 `::before.top < 0` 일 때만 늘려 계산(여기선 top 이 양수라 항상 `r.height`=36). 실제 히트는 `common.mjs`(elementFromPoint 프로브)로 재측정한다.
- **발견 [확실 — `arrivalAlign.ts`]**: WAIT(이어받은 대기) 재진입은 `answerStartPlan → 'default'` → 기존 `p.count===0 → scrollTop=scrollHeight` 경로(새 분기 안 탐).
- **남은 일**: A-3 히트 영역 재측정(ASK + 채팅 방) · A-4 talk 404 요청 URL · A-5 WAIT2 원인 재현 · 항목 8(`common.mjs`) · 정리.
- **다음 첫 명령**: `cd scratchpad/q064/b3 && node common.mjs`.
- **주의점**: 서버 3011 그대로. 만든 방 0개. 쿠키 `q064/b3/c2`(600).

### 체크포인트 B4-2 (턴 ≈ 26) — A-1~A-5·항목 8 측정 완료, 정리 직전 · 실제 AI 0
- **완료**: A-1(위로 올림·알약·클릭 후) · A-2(upvis) · A-3(히트 영역 — ASK `common.mjs` + 채팅 방 `regress2.mjs` 프로브) · A-4(kb·fs200·Q8·SEP·EMPTY·chat/talk 회귀, talk 404 = `GET /api/v1/speech/utterances` 가짜 id) · A-5(WAIT2 반복 6회 ASK vs 채팅) · 항목 8(`common.mjs` + `tabs.mjs` 9화면). 중간 행 수(`counts.ts B4-mid`) = Chat 4/ChatMessage 12/RequestTrace 67/AiJob 0 그대로.
- **남은 일**: 정리(B2 방 4개 삭제 → `counts.ts` 대조 → scratchpad 삭제) · 기록 본문(판정표·결함) 작성 · 맨 위 상태 「완료」.
- **다음 첫 명령**: `cd scratchpad/q064/b3 && node cleanup.mjs`(작성 예정, 앱 DELETE 4회).
- **주의점**: 서버 3011 그대로. 본인이 연 크롬은 스크립트마다 닫힘. `ps` 확인: claude --print 0.

### QA 시각 검증 — 재현 조건 (데모 게이트 §8)
- 구현 가이드 기준 = `docs/screens.md` §25-5 J(J-1~J-9) · 승인 데모 v2(알약 「새 답 ↓」 는 데모에 없고 J-9 에서 Leader 확인 사항). 비교는 **수치 합격선**(J-7)이며 데모 스크린샷 픽셀 비교가 아니다 — 이번 라운드는 스크롤 위치가 대상이라 화면 모양 차이(Reviewer 분류)는 해당 없음.
- 뷰포트 360×740 · 390×844 · 412×892 · DSF 2.625 · `isMobile`+`hasTouch` · Chrome 147.0.7727.101(`playwright-core`, 헤드리스, `--no-sandbox`) · light · ko-KR · Asia/Seoul · `reducedMotion:'reduce'` · 글꼴 로딩은 `networkidle` + 0.7~1.8초 대기 · 네트워크 = 방 GET 은 실서버(3011), `POST …/turns`·출석·텍스트 분석은 모의, 방 가공은 GET 응답 변형 fixture.
- 캡처 범위 = 뷰포트 한 장(상태별), 파일은 scratchpad 에만 두고 판정 후 삭제. 허용 범위 = J-7 ±2px(대기 재진입 ±1, 짧은 답 바닥 ±1).
- 한계 [확실]: 키보드는 **뷰포트 높이 축소 모형**(실제 IME·`visualViewport` 아님), 이동은 `scrollTop` 대입·터치 이벤트 위주(실제 관성 스크롤 아님).

### 판정표 (QA-B4 해석 — `batch3.log` 28줄 + B4 재측정, 실제 AI 0)

**A-1 위로 올려 둔 채 도착(J-2 규칙 2) · 알약 클릭 뒤(J-4)** — 합격: 도착 시 `scrollTop` 변화 0(±1) · 알약 정확히 1개 「새 답 ↓」 · 클릭 뒤 질문 윗면 12±2·`article` 윗면 360 [48,242]·390 [48,277]·412 [48,293] · `activeElement`=목록 · 알약 사라짐 · 짧은 답은 클릭 뒤 바닥(`fromBottom`≈0)

| 시나리오 | 폭 | 도착 전 → 후 `scrollTop`(100프레임 동안 값 수) | 알약(도착 뒤) | 클릭 뒤 q / article / st / fb | 클릭 뒤 알약 · 초점 | 판정 |
|---|---|---|---|---|---|---|
| A2/up(클릭 안 함) | 360 / 390 / 412 | 0→0 / 0→0 / 0→0 (1값) | 「새 답 ↓」 1개 ×3 | — | — | PASS ×3 |
| A2/pillclick | 360 | 0→0 (1값) | 1개 | 12.3 / 127.6 / 2007 / 376 | 0개 · `log:대화 내용` | PASS |
| 〃 | 390 | 0→0 | 1개 | 11.8 / 127.1 / 1911 / 221 | 0개 · 목록 | PASS |
| 〃 | 412 | 0→0 | 1개 | 11.7 / 127.0 / 1808 / 149 | 0개 · 목록 | PASS |
| L4(합성 3,750자)/pillclick | 360 | 0→0 | 1개 | 12.3 / 127.6 / 2007 / 5,027(아래 긴 답 남음) | 0개 · 목록 | PASS |
| SHORT(65자)/pillclick | 360 | 0→0 | 1개 | 271.3 / 386.6 / 1748 / **0** | 0개 · 목록 | PASS(짧은 답은 바닥) |

  첫 답 프레임부터 +2.3초까지 q·`scrollTop` 이 한 값(강제 이동 없음). 알약 폭 64px·높이 36px·바닥에서 12px. `turns` 서버 도달 0·콘솔·페이지 오류 0.

**A-2 답 윗면이 이미 보이는 위치에서 도착(`upvis`)** — 합격: 알약 0 · 위치 변화 0

| 폭 | 도착 전 st / 바닥까지 / 대기 카드 윗면 | 도착 뒤 st / q / article 윗면 | 알약 | 판정 |
|---|---|---|---|---|
| 360 | 1564 / 130 / 534.6 | 1564 / 455.3 / 570.6 | 0 | PASS |
| 412 | 1212 / 130 / 687 | 1212 / 607.7 / 723 | 0 | PASS |

  390 은 돌리지 않음(NOT_RUN — 같은 계산식, 360·412 가 양 끝). [가능성 높음 — 정보] 이 자리는 바닥에서 130px(슬랙 120 바로 밖)이라 답 `article` 윗면이 목록 아래 12px(360: 570.6/583, 412: 723/735)에만 걸려 사실상 안 보이는데 알약은 없다 — J-2 규칙 2 문구(「답 행 윗면이 보이면 알약 없음」)대로이고 사용자가 스크롤하면 읽힌다. 문구 판단은 Leader.

**A-3 알약 히트 영역(가이드 §3-2 C 「보이는 36·히트 44」)** — 결론: **결함 아님, 측정 도구 한계**

| 측정 | 결과 |
|---|---|
| B3 `hitH` 값 | 36(전 시나리오). 원인 [확실]: `lib3.listStateFn` 은 `::before.top < 0` 일 때만 히트를 늘려 계산하는데 알약은 `before:top-1/2 before:h-11 before:-translate-y-1/2`(가운데 정렬 44px)라 `top` 이 양수(17px) → 늘리는 식을 건너뛰고 `height`(36)를 그대로 보고 |
| ASK(`common.mjs`, 3폭) | `::before` 높이 44px · 폭 62px · `elementFromPoint` 알약 윗가장자리 −2·−4 ✓ / −6 ✗, 아랫가장자리 +2 ✓ / +4 ✗(경계 제외) → 히트 세로 44(=36+4+4) ×3폭 |
| 채팅 방 「새 메시지 ↓」(`regress2.mjs chat up`, 3폭) | `::before` 44px(top 17px) · −3 ✓ / −5 ✗ · +3 ✓ / +5 ✗ → **ASK 와 같음** ×3폭. 알약 폭 92px |
| 코드 [확실] | 알약은 `MessageList` 한 곳의 `<button>` 이고 `git show HEAD:…MessageList.tsx` 의 클래스 문자열과 현재가 **글자 단위로 같다**(라벨·onClick 만 분기) |
| 접근성 | `↓` 는 `aria-hidden`(ASK 측정 `ariaHiddenArrow:true`) |

**A-4 키보드·글자 200%·큰 질문·구분선·빈 방·회귀**

| 상태 | 폭 | 측정 | 합격 | 판정 |
|---|---|---|---|---|
| 키보드(뷰포트 440 → C=283, A2) | 360 | 답 `<li>` 윗면 91.6 · q 12.3 · article 보임 155.4px · 프레임 1값 | `<li>` ≤ 12+⌊283/3⌋=106 · article ≥130 | PASS |
| 키보드(뷰포트 450 → C=293, A4 972px) | 360 | `<li>` 91.6 · article 보임 165.4px | ≤109 · ≥130 | PASS |
| 글자 200%(pad=24, C=487) | 360 | q 23.7 · article 보임 232.8px | q = pad±2 | PASS |
| 〃(pad=24, C=639) | 412 | q 23.8 · article 보임 408px | 〃 | PASS |
| Q8(8줄 질문 580px) | 360 / 390 / 412 | 답 `<li>` 윗면 204.8 / 239.8 / 255.8 | 12+⌊C/3⌋ = 206 / 241 / 257 (±2) | PASS ×3(−1.2) |
| SEP(질문·답 사이 날짜 구분선) | 360 / 390 / 412 | 질문 윗면 12 ×3 · 답 145.5(질문 92 + 구분선) | q=12±2 | PASS ×3 |
| EMPTY(빈 방) | 360 / 390 / 412 | `st=0=max` · 예시 칩 4개 전부 화면 안 | 맨 아래·칩 보임 | PASS ×3 |
| 회귀 chat/bottom(가짜 방, 390) | 390 | 열기 fb=0 · 새 메시지 도착 뒤 st 2853 fb=0(바닥 따라감) · 알약 0 · `data-mid` 0개 | 지금과 같음 | PASS |
| 회귀 chat/up | 360 / 390 / 412(알약 측정) · 390(도착) | 위로 올림 st=0 → 도착 뒤 st=0 유지 · 「새 메시지 ↓」 1개 · `data-mid` 0개 | 〃 | PASS |
| 회귀 talk/bottom · talk/up | 390 | chat 과 같은 값(st 2913 fb=0 / st=0 유지 + 「새 메시지 ↓」) · `data-mid` 0개 | 〃 | PASS |

- **콘솔 404 의 출처 [확실]**: 채팅 방 콘솔 0건, talk 방만 404 ×2 — 요청 URL 이 둘 다 `GET /api/v1/speech/utterances`(`page.on('response')` 로 수집). 이 요청은 talk 방이 그 방의 발화 목록을 부르는 것이라 **가짜 id `qa_fake_talk`** 에서만 404 가 난다. ASK 방은 이 요청을 안 보낸다. `git status --short src/components/talk src/app/api/v1/speech` 출력이 비어 있어 이 task 가 만진 파일도 아니다. 실제 회귀 아님.
- **「DOM 차이 0」 전체는 NOT_VERIFIED**: HEAD 빌드가 없어 DOM 전체 diff 를 못 한다. 대신 근거 — 기본 모드 `data-mid` 0개(실측) · 알약 클래스·라벨(「새 메시지 ↓」) 같음(실측) · `git diff HEAD` 에서 기본 모드 JSX 변화는 `tabIndex`·`outline-none`(`focusable` 일 때만)·`data-mid`(`answer-start` 일 때만)뿐 · `ChatRoom` +5줄은 kind=ASK 방을 `/ask/…` 로 보내는 분기.
- **관찰 [확실 — 스크린숏 1장, 기존·task-064 밖]**: 새 브라우저 컨텍스트의 talk 방에서 첫 방문 안내 말풍선(「한국어로 물어보면 일본어로 알려 줘요」 + ✕)이 알약 「새 메시지 ↓」 위를 덮는다(알약 중심 `elementFromPoint` 가 말풍선 `<p>`). 안내를 닫으면 사라지는 일회성이고 talk 파일을 이번에 안 바꿨으므로 결함으로 올리지 않는다 — 실제 talk 방에서 안내를 닫은 뒤 알약 눌림은 NOT_VERIFIED(실제 방 생성이 LLM 예열을 부른다).

**A-5 `WAIT2` 360 `fromBottom=14` — 새 코드 때문인가** — 결론: **새 코드 경로가 아니다 [확실]. 기존 default 경로의 경합이며 Low(정보)**

- **코드 [확실]**: ① `answerStartPlan` 은 마지막 행이 `ASSISTANT·DONE` 이 아니면 `'default'` 를 돌려준다(`arrivalAlign.ts`) → `handled=false` → `p.count===0` 분기의 `scrollTop = scrollHeight`(HEAD 와 같은 줄). ② 내용 따라가기 `ResizeObserver` 는 `h > lastHeight`(증가)일 때만 일하고, 정렬 창이 없으면(`alignRef=null`) `windowGrowthAction` 은 `contentGrowthAction` 과 같은 결과(`hold`→`follow`/`none`)다(`followHold.ts`·`arrivalAlign.ts` 직접 읽음). 줄어드는 방향은 새 코드가 안 건드린다. ③ 목록은 `[overflow-anchor:none]` 이라 브라우저 스크롤 고정도 아니다.
- **재현(반복 6회, A1 방 + GET 가공, `waitcmp.mjs ask 360 6`)**: 0/3/4/5회차는 첫 그리기 ≈220~300ms 에 `st 830/sh 1413 → 808/1405`(fb **14**)로 가서 **첫 폴링(≈2.7초)까지 그대로**였다가 0 으로 복구, 1/2회차는 `832/1479(fb 64) → 822/1405(fb 0)` 로 15ms 안에 복구 → **4/6 에서 약 2.5초 머무는 경합**. 14px = 목록 아래 여백 12px + 대기 카드 아랫면 1.7px 가 가장자리에 걸린 값. B3 의 1회 관찰(첫 폴링에서 복구)과 같다.
- **채팅 방 대비(기본 모드, `waitcmp.mjs chat 360 6`, 대기 행 PENDING·running 가짜 방)**: 6/6 이 15ms 안에 fb 0(중간에 293 까지 튀었다 복귀), 잔류 없음 → **같은 잔류는 채팅에서 재현되지 않았다**. 단 행 구성(대기 카드 높이 20 vs 105 · 이전 답 층 크기)이 달라 같은 조건이 아니라서 「기존 방에서도 일어난다」 는 **입증하지 못했다**. 그래서 결론은 코드 경로 대조(위 ①~③)에 기대며, HEAD 빌드가 없어 같은 ASK 화면의 전후 대조는 NOT_VERIFIED.
- **원인 추정 [가능성 높음]**: QA 모의 `text/annotate → available:false` 가 이전 답의 예문 층을 접어(B3 SHORT/MED 도착에서 `artH` −25px 관찰과 같은 모의) 전체 높이가 줄고(−74), 같은 시점에 대기 카드가 +66 자라는 경합에서 `ResizeObserver` 의 `follow` 가 중간 높이(sh≈1391)에서 한 번 돌고 끝난다(줄어든 뒤에는 증가 이벤트가 없어 재고정 안 함). 실서버 분석은 층을 접지 않고 펼치므로(증가 → follow) 실사용에서 같은 값이 나올지는 모른다 [추측].
- **판정**: J-7 「재진입 · 이어받은 대기 = 맨 아래 ±1」 의 **글자 기준으로는 미충족(14)**, 그러나 대기 카드 98% 이상이 보이고 첫 폴링에 복구되며 새 코드와 무관 → **QA64-B4-1 Low, 수용 권고**(고치려면 `ResizeObserver` 가 줄어든 뒤에도 바닥 근처면 다시 붙이는 한 줄 — 기본 모드 전체 동작이 바뀌므로 별도 task 가 맞다). 390·412 는 6회 외 B3 실행에서 `fromBottom=0`.

### 항목 8 — 공용 수정 재확인 (GET 만, 실제 AI 0)

| 항목 | 360 | 390 | 412 | 판정 |
|---|---|---|---|---|
| 가로 넘침 요소 · `docOverflowX` · 페이지 세로 스크롤 (방 A2·A4, 목록 `/ask`, `/study/ai`, `/study/today`) | 0 · false · false (9화면 + 방 2) | 〃 | 〃 | PASS |
| 스크롤 상자 | 방 = 메시지 목록 1곳(`div.relative` 1025/583·974/687·950/735) + 입력 `textarea`(44/42 — B1 이 이미 기록한 기존 공용 `Composer` 관찰, 이 task 변경 아님) · `/ask` = `main` 1곳 | 〃 | 〃(`/ask` 는 안 넘쳐 0곳) | PASS |
| 44px 미만 터치 대상(`small`) | 0 | 0 | 0 | PASS (알약 제외 측정 — 알약은 A-3 별도: 보이는 36 · 히트 44) |
| 답 영역 `a[href]`·`img`·`script`·`iframe`·`table`·`pre`·`code`·`svg`·`form`·`input` | 전부 0 | 0 | 0 | PASS |
| 방 불러오기 실패(GET 500 모의) [다시 시도] | 높이 44 · 폭 51.5 | 44 · 51.5 | 44 · 51.5 | PASS(QA64-B1-1 수정 확인) |
| 하단 탭 5개 라벨 · 현재 탭 | 「회화·공부·계획표·단어장·질문」 · `/ask`=질문 · `/study/ai`=회화 · `/study/today`=공부 · 탭 높이 56 · 폭 ≥72 · 하단 패딩 10px | 폭 ≥78 | 폭 ≥82 | PASS |
| 진입(HTTP) | `/ask` · `/study/ai` · `/study/today` 모두 200, 리다이렉트 없음 | 〃 | 〃 | PASS |
| 콘솔 오류 · 페이지 오류 | 0 · 0 (9화면) | 〃 | 〃 | PASS |
| (제외한 콘솔 항목) | 불러오기 실패 모의의 `500` 1건/폭(모의가 만든 것) · favicon 404(없음) | | | 제외 사유 명시 |

- 방 안(`/ask/:id`)은 하단 탭이 없다(B1 기록과 같음 — `tabsVisibleInRoom` 0은 설계) — 탭 확인은 목록·탭 화면 3개에서 했다.
- 라이트 모드·모바일 3폭만. 다크·데스크톱 1280 은 이 라운드 대상 아님(스크롤 규칙) → NOT_VERIFIED 로 둔다.

### 결함·권고 (심각도순)

| ID | 심각도 | 내용 | 재현 | 기대 / 실제 | 원인 추정 |
|---|---|---|---|---|---|
| QA64-B4-1 (= B3 후보 QA64-B3-1) | **Low** | 이어받은 대기 재진입(360×740)에서 맨 아래에 안 붙고 14px 위에 머묾(약 2.5초, 첫 폴링에 복구) | `waitcmp.mjs ask 360 6`(A1 방 GET 가공: 마지막 PENDING·running) — 4/6 | J-7 맨 아래 ±1 / 실제 fb=14(카드 아랫면 1.7px 가장자리) | 기존 default 경로의 `ResizeObserver` 가 줄어든 뒤 재고정 안 함 + QA 모의 층 접힘 [가능성 높음]. 새 코드 경로 아님 [확실] |
| 정보-1 | 문구 | J-7 「정렬 뒤 2초 안 제안 카드 붙음 ≤2px」 는 긴 답에서만 성립. 중간·짧은 답은 카드가 붙으면 `realign` 이 질문+답+카드가 다 보이는 가장 아래(`fromBottom=0`)로 감(360 q=12.3 · 390 18.8 · 412 66.7) | B3 체크포인트 2 | 문구 보강 권고 | 공식대로 동작 |
| 정보-2 | 문구 | J-2 규칙 2 「답 윗면이 보이면 알약 없음」 — 바닥에서 130px(슬랙 120 밖)이고 답 `article` 윗면이 목록 아래 12px 에만 걸려도 알약 없음 | A-2 | 설계 의도, 필요하면 임계(가시 높이 ≥ N px) 추가 검토 | — |
| 정보-3 | 도구 | `lib3.listStateFn.hitH` 계산식이 `top-1/2` 형 `::before` 를 못 잼 — 제품 결함 아님 | A-3 | — | 측정 코드 |
| 정보-4 | 기존(task 밖) | talk 방 첫 방문 안내 말풍선이 「새 메시지 ↓」 알약을 가림(닫으면 사라지는 일회성) | `regress3.mjs talk 390 up` + 스크린숏 | 실제 talk 방 확인 필요 | task-056 안내 말풍선 [추측] |

Critical / High / Medium 0건. (QA 판정: 스크롤 규칙 J-1~J-9 PASS, Low 1건 수용 여부는 Leader.)

### 정리 대조 (QA-B4 끝, `qa064/counts.ts B4-end rooms`)

| 테이블 | 시작(B3-start) | 끝 | 기대 | 판정 |
|---|---|---|---|---|
| Chat / Chat(ASK) / ChatMessage | 4 / 4 / 12 | **0 / 0 / 0** | 0 / 0 / 0 | PASS |
| TutorProposal / Correction(ACCEPTED) | 0 / 0(0) | 0 / 0(0) | 같음 | PASS |
| WordEntry / StudyLog / StatsSnapshot / AiJob / RepetitionItem | 0 | 0 | 같음 | PASS |
| LearningObservation | 27 | 27 | 27 | PASS |
| **RequestTrace** | **67** | **67** | **67(AI 0회 계약)** | PASS |
| Profile.level | N5 | N5 | N5 | PASS |

- B2 방 4개(`cmv5585r…`·`cmv55ac5…`·`cmv55cjy…`·`cmv55f6a…`) 앱 `DELETE /api/v1/chats/:id` 200 `{"deleted":true}` ×4, 이어 GET 404 ×4, 목록 ASK 0개. 이번 QA 가 만든 방 0개.
- 실행 중 `ps` 로 `claude --print` 0개를 3회 확인(시작 직후·중간·삭제 뒤). 서버로 간 `turns` 0, 가드 차단 0, 모의하지 않은 비-GET 0.
- **프로세스 정리**: 본인이 연 헤드리스 크롬은 스크립트마다 닫힘(`playwright_chromiumdev_profile` 프로세스 0개). 검증 서버 3011(PID 1106838)은 지시대로 그대로 둠. 다른 포트·dev 서버·복제본을 띄우지 않음.
- **산출물 정리**: scratchpad `q064/b3/` 의 쿠키 `c2`·`shots/`·`*.json`·`*.log`(`batch3.log` 포함 — 해석은 위에 옮김) 삭제, 스크립트(`*.mjs`·`*.sh`)는 재실행용으로 남김. `q064/b2/c2` 등 이전 QA 가 남긴 쿠키 파일은 이번 범위 밖이라 건드리지 않고 Leader 에 보고.

### NOT_VERIFIED (실기기·환경 한계)
- 실기기 TalkBack: 알약 「새 답」 읽기·누른 뒤 초점(목록) 읽기, 도착 알림(`role=status`) 순서.
- 실제 소프트 키보드(IME 높이 변동·`visualViewport`) — 이번은 뷰포트 높이 축소 모형. 소수 DPR·시스템 글자 크기(앱 WebView)와의 조합.
- 실제 AI 답으로 본 도착 정렬(저장된 B2 답을 SSE 모의로 재생했을 뿐), 실제 관성 스크롤·손가락 드래그.
- HEAD 빌드 대비 DOM 전체·같은 ASK 화면 전후 대조(HEAD 빌드 없음), 실제 talk 방에서의 알약 눌림, 다크 모드·데스크톱 1280.
- `A2/upvis` 390 폭(NOT_RUN).

### 마무리 확인 (QA-B4 최종, 정리 뒤)
- `qa064/counts.ts B4-final` 이 `B4-end` 와 같다(Chat 0 · ChatMessage 0 · AiJob 0 · RequestTrace **67** · LearningObservation 27 · Profile N5). 마지막 `ps` 에 보인 `claude --print` 1개는 **BJJ 프로젝트 영상 분석 호출**(프롬프트 「주짓수(BJJ) 전문가」, 부모 PID 가 이 세션과 무관)이고 TheKaiwa 것이 아니다 — QA2 의 `RequestTrace` 가 67 그대로라 이 QA 의 AI 호출은 0.
- 3011 서버(PID 1106838) 그대로, 3012 등 다른 포트 리슨 없음, 저장소 변경 = 이 기록 파일뿐(`src`·`docs`·`tests` 무수정).
