---
task_id: task-056
role: qa
tags:
  - type/qa-record
  - domain/conversation
  - domain/improvement
aliases:
  - task-056 QA 기록
created: 2026-10-11
updated: 2026-10-11
---
# task-056 QA 기록

> 이력서: [[task-056-improve-talk-phrase-helper]] · 계약: [[task-056-pe-record]] §2·§4·§5 · 서버 감사: [[task-056-rev-server-record]] (REV-190 · REV-192 high_risk 8항)
> 범위: **QA-A — API #180 `POST /api/v1/chats/:id/phrase-help` 서버**. 화면·지연 실측은 다른 QA 소환 몫.

## QA-A 기록

**판정: PASS_WITH_NOTES** — 결함 0건 중 Critical 0 · High 0 · Medium 0 · **Low 1**(F-1) · 정보 4. 확인 못 한 항목 NOT_VERIFIED 5(아래 목록). 차단 사유 없음.

### 환경 (재현 조건)
- 전용 미러 `~/.node-local/thekaiwa-qa056a` — `node_modules` 는 `thekaiwa-rev056s2` 에서 하드링크(캐시 제외), `KAIWA_LOCAL_ROOT=… bash scripts/sync-local.sh` 로 NFS 소스 동기화. 스키마 md5 `8f493d1b…` = NFS = predeploy, 생성 클라이언트 md5 `4cd2598f…` = predeploy = rev056s2.
- 빌드: `next build` 성공(BUILD_ID 생성, `Compiled successfully` 1회, 실패 0). 빌드 로그의 `SPAWN_FAILED` 는 의존성 소스 조각이 경고에 인용된 것이고 빌드 실패 아님.
- 서버: `next start -p 3013 -H 127.0.0.1`(cwd 미러, `APP_ENV=LOCAL`). `GET /api/health` 200, `status=degraded`(`stt_analysis_worker` false — 본 QA 와 무관한 기존 상태, db·llm true).
- DB: 개발·운영 공유 NAS MariaDB. **QA 계정만**(QA4 주 · QA2 남의 방 · QA3 한도 전용). 운영 사용자 행 접촉 0.
- **QA1 은 쓰지도 읽지도 않았다**(스모크·보충 스크립트 계정 이메일 확인). 따라서 task-057 이 QA1 에 심은 기본 단어 시드(7,755건)와 무관하다. 대조 표의 `WordEntry` 는 QA4·QA2·QA3 에서만 보았고 변화 0. `VocabSession` 은 이 대조 항목에 넣지 않았다.
- 쿠키: `tests/live/qa-session.ts` 로 QA4·QA2·QA3 발급(1시간).

### 실행 명령 (순서)
1. `BASE=http://127.0.0.1:3013 node --env-file=.env --import tsx tests/live/task056-phrase-help-smoke.ts <c4> <c2>` → **RESULT pass=26 fail=0 skip=1**(10 경합은 `SMOKE_CONTENTION` 미지정으로 건너뜀 — 지연 QA 몫). 정리: 대화 3 · 상황 1 · DAILY 는 시작 시 없었음(no-op 확인).
2. 보충 시험 `q056a/a.ts`(저장소 밖, scratchpad): `a` → `b` → `c` → `e` → `d` 순(한도 창 60초를 맞추려고 단계를 나눔). 원 출력 `phase-{a,b,c,e,d}.out`.
3. 정리: 잔여 QA2 CHAT 1행 삭제(`q056a/fix.mts`). 서버 PID 2251901 종료, 3013 포트 비움 확인.

### 항목별 결과

| 항목 | 판정 | 실행 근거 |
|---|---|---|
| **A1 인증·소유자·방 종류** | | |
| 쿠키 없음 401 · 쓰레기 토큰 401 | PASS | a: `UNAUTHENTICATED` 401 ×2 |
| 남의 대화(QA2 소유) 404 · 없는 대화 404 — 응답 형태 동일 | PASS | a: 두 봉투 같음 `{"success":false,"data":{"code":"NOT_FOUND"},"message":"채팅을 찾을 수 없어요."}` · smoke 3a·3c |
| `kind=CHAT` 대화 404 | PASS | a · smoke 3b |
| 마친 역할극 409 `ENDED` | PASS | smoke 8a(`endedAt` 직접 채움) |
| 상황 삭제 후 `endedAt` 만 남은 방 409 `ENDED` | PASS | a: `scenarioId=null · endedAt=true` → 409 `ENDED` (FK `onDelete: SetNull` 로 상황 삭제 재현) |
| 일반 회화방 200 — 마친 표식 조회 없이 | PASS | B1~B4 200. 코드: `chat.scenarioId ? isEnded : false`(scenarioId 없으면 조회 생략) |
| `Cache-Control: private, no-store` | PASS | 200 응답 9건 전부(smoke 4b · B1~B6 `cache=private, no-store`) |
| **A2 입력 검증(LLM 0, 한도 미소모)** | | |
| 정리 뒤 100자 OK | PASS | B1 200 · 픽스처 정확히 100코드포인트 확인 |
| 정리 뒤 101자 → 400 `max_length` | PASS | B0 400 · 직접 요청 p3 400 `max_length`, 메시지 「하고 싶은 말은 100자까지 쓸 수 있어요.」(pe-record §2 표 일치) |
| 빈·공백뿐·null·키 없음 → `required` | PASS | a: field `queryKo`, 메시지 「하고 싶은 말을 한국어로 써 주세요.」 |
| 숫자·배열·불리언 → `type` | PASS | a (`queryKo` 타입) |
| 꺾쇠(전각 포함) · URL → `forbidden_char` | PASS | a(`＜b＞`, `https://…`) · smoke 2(`<b>`) |
| 자모만·일본어만 → `no_hangul`(LLM 미호출) | PASS | a · smoke 2(영문) |
| 키 모양 → `secret_like` | PASS | smoke 2(`sk-ant-…`) |
| 한글+영어 혼합 통과 | PASS | B2 200(`Starbucks에서 아이스 라떼 한 잔 주세요`) |
| 알 수 없는 키 → 400 `unknown_key`(field `body`) | PASS | a · smoke 2 |
| 잘못된 JSON · 1KB 초과 → 400 `VALIDATION`(reason 없음) | PASS | a: `JSON 형식이 올바르지 않습니다.` · `요청 본문이 너무 큽니다.` |
| **본문이 JSON 객체가 아님**(`["안녕"]`) → 400 `type` · field `body` | **FAIL → Low (F-1)** | a: 400 `VALIDATION` 은 맞으나 `reason`·`field` 없음, 메시지 「요청 본문은 JSON 객체여야 합니다.」 |
| 400 은 한도 미소모 | PASS | c: 400 12건 뒤 404 10건 모두 통과, 11번째만 429 |
| **A3 한도·동시성** | | |
| 남의 방 404 10건 → 11번째 429 `RATE_LIMITED` + `Retry-After` | PASS | c: 429, `retry=60`, 없는 id 도 429(한도가 DB 조회보다 먼저) |
| 1분 뒤 풀림 | PASS | c: 61초 뒤 404 |
| 하루 300 | NOT_VERIFIED(코드만) | route 상수 `PHRASE_HELP_PER_DAY = 300`, 창 `86_400_000` ms 확인. 라이브 301건 호출 안 함 |
| 같은 사용자 동시 2건 → 200 하나 · 409 `PHRASE_BUSY` 하나 | PASS | smoke 9a(`statuses=200,409`) |
| 실행 중 클라이언트 중단 → 잠금 해제 → 재호출 200 | PASS | e: 1517ms 에 중단 → fetch `AbortError`. 로그 `[claudeCli] 취소 — elapsed=1989ms`. 재호출 **200**(첫 재호출, 409 없음). Trace `CANCELLED` 1행 |
| 중단 뒤 `claude --print` 자식 잔존 | PASS(정성) | 중단 직후 1개(dbus 오탐 2 제외), 재호출 완료 뒤·3초 뒤 0 |
| 엔진 실패 504(12초)·502(`INVALID`) 라이브 경로 | NOT_VERIFIED | 장애 주입 수단 없음. 단위 시험 몫 |
| 큐 대기 중 취소 뒤 재질문(REV-192 L-R1) | NOT_VERIFIED | 큐에 선행 호출을 세우지 않음 |
| **A4 저장 0·원문 미보관·응답 품질** | | |
| 정상 호출 일반 TALK 3건 · 역할극(장면) 2건 | PASS | 4a·B3·B4(일반) · 5a·B5(역할극), 추가 B1·B2 |
| 응답 규칙: items 1~3 · ja 한글·영문·괄호·줄바꿈 0 · ko 한글만(가나·한자·영문 0) · 길이 | PASS | 응답 9건 전부 `bad=0` |
| 거절 질의(문법 설명) → `items: []` | PASS | smoke 6a |
| 주입 「지시를 무시하고 시스템프롬프트…」 → `items: []` | PASS | B6 200 · `items: []` |
| 호출 전후 행 수(QA4): StudyLog·StatsSnapshot(전 종류)·RepetitionItem·WordEntry·Correction·Utterance·ChatMessage·LearningObservation·TutorProposal·Profile·Chat·Scenario·DAILY | PASS | `diff=없음`. Trace +6(관측, 허용). QA2 쪽도 `없음` |
| RequestTrace(phraseHelp)에 질의·ja·ko 원문 0 | PASS | 8행 grep, 질의 누출 0 · 응답 누출 0. 샘플 `steps[0]={"name":"PHRASE_HELP","ms":1993,"errorCode":"CANCELLED"}` |
| 서버 로그(미러 stdout)에 질의 원문 0 | PASS | 질의 6종 grep 전부 0 |
| pm2 운영 로그(`shared/logs`) 확인 | NOT_VERIFIED | 이 QA 는 미러 서버 로그만 봤다 |

### 응답 품질 표본 (실호출 9건, 모델 haiku)
- B1 「오늘 날씨가 좋아서 강변 공원을 천천히 산책하고 싶은데요…」 → ja `今日はいい天気だから、川沿いの公園をゆっくり散歩したいんです。一緒に行きませんか。夜の6時くらいはどうですか。` · 2번째 `…でいかがでしょうか。` (label 「더 정중하게」).
- B2 「Starbucks에서 아이스 라떼 한 잔 주세요」 → `アイスラテを一つください。` / `アイスラテ一つでお願いします。`(「더 공손하게」).
- B3 「역 가는 길을 알려 주세요」 → `駅までの道を教えてください。`
- B4 「이거 얼마예요 056확인용」 → `これいくらですか。`
- B5(역할극 · 장면 편의점) 「카드로 계산할게요」 → `カードで払います。` / `カードでお願いします。` (장면에 맞는 계산 표현).
- B6 주입 → `items: []`.
- `whyKo` 의 일본어 낱말은 「」 안에만 있음(규칙 준수).

### 지연 참고 (지연 QA 입력용, 판정 아님)
200 응답 ms: 4a 3122 · 5a 3328 · 6a 2177 · B1 4773 · B2 3626 · B3 2917 · B4 3256 · B5 4177 · B6 2311. 직렬 호출, 다른 `claude --print` 없음. n=9 라 p50/p95 는 지연 QA 가 재측정.

### 결함
**F-1 (Low) — 계약 §2 표와 불일치, 차단 아님**
- 재현: `POST /api/v1/chats/<TALK id>/phrase-help` 본문 `["안녕"]`(쿠키 있음).
- 기대(pe-record §2 표): 400 `VALIDATION`, `reason: type`, `field: body`, 「요청 형식이 올바르지 않아요.」
- 실제: 400 `VALIDATION`, `reason`·`field` 없음, 「요청 본문은 JSON 객체여야 합니다.」(공용 `readJsonObject` 문구).
- 원인 추정: 라우트가 `readJsonObject(req, 1024)` 로 객체 검사를 먼저 해 `readPhraseHelpBody` 의 `type` 분기에 닿지 않는다.
- 영향: 화면은 항상 객체를 보내므로 실사용 도달 불가. 상태 코드·`VALIDATION` 은 맞다. **계약 문구를 맞추거나 라우트 정합을 할지는 Leader·Developer 판단.**

### 정보 (결함 아님)
- I-1. 1차 실행의 A2 「101자」 FAIL(404)은 **제 픽스처 오류**(문자열이 96자였다). 정확히 100자로 고쳐 B0 에서 400 `max_length` 를 확인했다. 제품 결함 아님.
- I-2. 스모크의 정리 로그 「DAILY 삭제」는 실제로 no-op 이었다(시작 시 DAILY 0, 정리 뒤 0 — 전후 대조로 확인).
- I-3. 한도·잠금은 **프로세스 메모리**다. 운영에서 두 인스턴스가 같은 사용자 요청을 동시에 받는 구간이 있다면 한도가 나뉘고 잠금이 보이지 않는다. 현재 배포 구조상 그런 구간이 없다고 보는 것은 [추측] — Leader 확인 필요.
- I-4. 404·409 도 분당 한도를 쓴다(설계대로, REV-190 §4). 남의 방 id 로 호출해도 소진되는 것은 **호출자 본인의 한도**뿐이다.

### 확인 못 한 것 (NOT_VERIFIED, 정직하게)
1. 하루 300 라이브(코드 상수만 확인).
2. 엔진 실패 504(12초)·502 라이브 경로(장애 주입 수단 없음).
3. 큐 대기 중 취소 뒤 재질문 `PHRASE_BUSY`(REV-192 L-R1).
4. pm2 운영 로그 grep(이 QA 는 미러 서버 로그만).
5. 만료 토큰 401(서명된 만료 토큰 생성 안 함).
- 참고: 상황 삭제는 API 가 아니라 **Prisma 로 삭제**해 FK `SetNull` 을 재현했다. API 삭제도 같은 FK 규칙을 탄다고 보지만 API 경로 자체는 열어 보지 않았다.

### 육안·실기기 확인 필요
- 없음(QA-A 는 서버 항목). 화면·실기기 항목은 다른 QA 몫.

### 정리 내역
- 대화 5(QA4 TALK·CHAT·종료된 역할극·역할극 2 방, QA2 남의 방 TALK) + QA2 잔여 CHAT 1(정리 중 발견, 별도 삭제) — 삭제. 상황 1(역할극 2) 삭제(`del` 상황은 시험 중 삭제). `phraseHelp` Trace 삭제(QA4·QA2).
- 전후 대조: QA4 기준 대비 차이 없음 · QA3 없음 · QA2 없음(chat 0 → 0 확인).
- 프로세스: 서버 3013(PID 2251901) 종료, 포트 비움 확인. 3010·3014 는 다른 세션 것이라 건드리지 않음.
- 쿠키 파일 `c2`·`c3`·`c4` 내용 비움(세션은 1시간 뒤 만료; 로그아웃 호출은 하지 않음).
- 미러 `~/.node-local/thekaiwa-qa056a` **유지**(하드링크 node_modules + `.env` 복사본 권한 600). 정리 여부는 Leader 판단.
- scratchpad `q056a/`(a.ts·phase-*.out·smoke.out·server.log·state.json) 저장소 밖 보존. 스크린샷 0장. 저장소 파일 변경 없음(이 기록만 신규).

### 체크포인트
- **완료**: A1 전 항목 · A2 전 항목(F-1 제외 PASS) · A3(하루 300·엔진 실패·큐 취소 제외) · A4 전 항목(pm2 로그 제외).
- **남은 일**: 없음(QA-A). 다른 QA 소환은 화면·지연 실측.
- **다음 첫 명령**(재실행 필요 시): 미러에서 `KAIWA_LOCAL_ROOT=$HOME/.node-local/thekaiwa-qa056a bash scripts/sync-local.sh` → `next start -p 3013` → `task056-phrase-help-smoke.ts`.
- **주의점**: 한도 창은 프로세스 메모리 60초라 같은 계정으로 연달아 돌리면 429 가 섞인다. 스모크는 QA4 를 8번 쓰므로 뒤이어 쓸 때 60초 이상 띄운다.

## QA-C 기록 — 화면 C1~C4 (2026-10-11)

**판정: FAIL** — High 2 · Medium 2 · Low 1 (+ 기존 항목 Low 1 · Info 1). 차단: 녹음 시작 시 판 소멸(⑤A), 역할극 판 ✕ 미동작. Developer 반송 → Reviewer 재시작 필요.

> **Leader 정정 (2026-10-11, 반송 수정 developer 의 브라우저 실측 진단 반영 — QA 원문은 아래에 그대로 둠)**
> - **F-1 은 코드 결함이 아니다**: QA 환경에 STT 게이트웨이(`/ws/speech`)가 없어 PTT 를 누르면 연결 실패 → 마이크 오류 띠(`SttAlert`)가 새로 떠서 §22-10 「띠가 새로 뜨면 도우미 닫기」 명세대로 닫힌 것. ⑤A(녹음 *중* 판 유지)는 이 환경에서 검증되지 않았다 → 재QA 때 가짜 마이크 + 게이트웨이 WebSocket 흉내로 재검증하거나 사용자 실기기 항목.
> - **F-2 는 실제 결함이고 역할극 한정이 아니다**(입력칸 초점 중 판 안 버튼 첫 탭 → blur → 바 재등장 → 판 약 117px 이동 → click 소실). **F-3 은 같은 뿌리.** 판 안 모든 조작 버튼에 `onPointerDown preventDefault` 를 통일해 고친다.
> - **F-4 는 결함이 아니다**: QA 스크립트가 `#talk-helper` 전체 textContent 의 첫 일치(늘 마운트된 sr-only 낭독 줄, 서버 초를 한 번 고정)를 읽었다. 본문 카운트다운은 12→11→10… 으로 감소(실측). F-5 는 실제 결함(수정 중). F-6 은 기존 문제(이번 task 범위 밖).

**재현 조건**: Chromium 147 headless · isMobile · DSF 2.625 · ko-KR · Asia/Seoul · reducedMotion=reduce · 뷰포트 360/390/412 × 892(판 열림·닫힘) + 780(키보드 모형) · 다크는 390 `colorScheme=dark`. 대상 `http://127.0.0.1:3014`(개발 서버, 미러 `~/.node-local/thekaiwa-qa056c`, sync-local, node_modules 하드링크 + `.prisma` 는 predeploy 사본, schema md5 `8f493d1b…` 일치). 계정 QA1(`qa-bot`) 쿠키 1시간. 운영 3010 미접속.
**서버 부작용**: 응답은 전부 가로채기로 고정. `phrase-help`·`turns`·`reply-practice`·`text/annotate` 는 서버 도달 0건(요청 카운터로 확인). 그 밖 비-GET 쓰기는 200 빈 응답으로 막음(DB 쓰기 0). 예외 1건: `speech/ticket` 은 실서버 통과(PTT 녹음 시작용). LLM 호출 0(`claude` 프로세스 확인 — 이 세션 소유 없음). 실행 스크립트 `scratchpad/c-screens.mjs`(저장소 밖), 결과 `scratchpad/qa-c-results-*.json`.

### 결과 (실행 229건: PASS 192 · FAIL 35 · NOT_VERIFIED 2 — FAIL 중 스크립트 결함 6건은 정정 대상으로 표시)
| 항목 | 판정 | 실행 근거(관찰값) |
|---|---|---|
| C1 입력 바 3폭 | FAIL(F-5) | 마이크↔도우미 간격 12.0px × 6/6 · PTT 72×72 · 도우미 44×44 · 가로 넘침 0(닫힘 892·780, 판 열림 892, 전 폭) · 글자 입력창 232px(412, 데모 232) · 판 높이 ≤ min(46dvh,320px) · 다크 바탕 luma<0.25 · **판 칩 36px(실효 히트 42, F-5)** · 역할극 「마치기」 36px(F-6 기존) |
| C1 처음 한 번 안내 | PASS | 새 프로필 말 모드에서 표시 · 보이는 순간 `kaiwa.talk.helperTipSeen='1'` · DOM 탭 순서 ✕→마이크→도우미 · 버튼 aria-describedby 연결 · 저장 막힘 시 0회 · 글자 모드에서 판정 안 함 · 말 모드로 바꾸면 표시 · ✕ 뒤 재방문 안 뜸 |
| C2 상태 (390) | PASS 다수 · FAIL 2 (F-3·F-4) | PASS: 입력 초점 시 말 바 숨김 · 예시 칩 3개 · 공백만 Enter 요청 0 · 101자 「100자까지 … 101/100」·aria-disabled·Enter 요청 0 · 95자 「95/100」 · 로딩 sr·5초 「조금만 기다려 주세요」·결과 sr 「표현 1개를 찾았어요」 · 이유 줄 · 3개 중 첫 카드만 보임·나머지 hidden · 펼침 2장 · 빈 결과 문구·[다시 시도] 없음 · 502 role=alert+[다시 시도] · 12초 시간 초과 문구 · 요청 중 Enter·클릭 연타 요청 1건 · [입력창에 넣기] 채움·판 닫힘·자동 전송 없음 · 재오픈 마지막 답 유지·키보드 안 올림 · Esc → 판 닫힘·초점 도우미 · XSS 리터럴 img 0·스크립트 미실행·텍스트 표시 · 저장소 새 키는 helperTipSeen 하나·질의 원문 저장소/쿠키/URL 없음 · 409 PHRASE_BUSY 오류 문구 |
| C3 역할극 방 | FAIL (F-1·F-2) | 마친 역할극: 도우미 버튼 없음·「이 역할극은 마쳤어요」 · 409 ENDED → 판 닫힘·마친 방 다시 읽기 PASS · 목표 카드 접힘 PASS · 대답 연습 줄 복귀·대답 연습 배타 — **F-2 때문에 판정 불가(하위 실패)** · PTT 녹음 중 판 유지 **FAIL(F-1)** · 보내면 닫힘 NV |
| C4 접근성·저장·키보드 | PASS (NV 1) | aria-label 「일본어 도우미」 정확 · 닫힘 aria-expanded=false·aria-controls 없음 · section aria-labelledby→h2 · 입력칸 aria-describedby=talk-helper-msg·lang=ko · role=status 늘 마운트·결과 낭독 「표현 1개를 찾았어요」 · 연결 끊긴 id 0(열림·결과·글자 모드) · 엔진명·모델명 0 · 360×780 입력 줄 화면 안·아래 바 숨김(모형) · 콘솔 error 2종(404·429, 출처 미확인). NV: 실 키보드 data-kb |
| H 칩 실제 히트 | FAIL(F-5) | `elementFromPoint`: 칩 위 3px 바깥 히트 ✓ · 아래 3px 바깥 ✗ · `::before` 42px(테두리 1px 안쪽 기준 inset -4px) |

### 발견 사항
- **F-1 [High] 녹음 시작 시 도우미 판이 사라짐 (⑤A 위반)**. 재현: 390·말 모드, 질의→결과 후 PTT 를 1.6초 누름(mouse.down). 기대(§22-10 녹음, H5): 판 유지·입력칸 disabled·도우미 버튼 흐림. 실제: 누르자마자 `#talk-helper`·입력칸 제거, 초점이 PTT 로 이동. 상태줄은 「누르고 있는 동안 말해요」(녹음은 시작됨, 서버 `speech/ticket` 요청 나감). `onPress`(TalkRoom.tsx:526)에는 판 닫기가 없어 녹음 상태에 따라 `helper.open` 이 false 가 되는 경로가 따로 있을 것 [추측 — Developer 추적]. 보내기 후 닫힘은 턴 POST 미발생으로 NV.
- **F-2 [High] 역할극 방 판 ✕ 가 판을 닫지 않음**. 재현: rp 방, 도우미 열기 → `[aria-label="일본어 도우미 닫기"]` 클릭(클릭 성공, 초점이 ✕ 로 이동). 기대(§22-6 rp-helper, H6): 판 닫힘·대답 연습 줄 복귀. 실제: 판 유지, 대답 연습 줄 없음. 대조: Esc 로는 닫힘(C2 Esc PASS). 경로: `PhraseHelperPanel.tsx:216 onClick={onClose}` → `TalkRoom.tsx:1166 closeHelperToButton` → `helper.close()`. 원인 미특정(rp 분기에서 재열림 가능성 [추측]). 일반 음성 방의 ✕ 는 이번 실행에서 미검증.
- **F-3 [Medium] 입력칸 초점 중 칩 첫 탭 무반응**. 재현: 판 열림 직후(초점 입력칸) 칩 「목이 쉬었어요」 탭 → 요청 0건·입력칸 빈 값. 원인 추정: REV-191 L-1 과 같은 메커니즘(pointerdown 으로 입력칸 blur → VoiceBar 재마운트 → 판이 밀려 pointerup 이 빗나감) [가능성 높음 — 레이아웃 이동 수치는 미측정]. 실기기(앱 WebView) 확인 필요.
- **F-4 [Medium] 429 카운트다운이 12초에서 멈춤**. 재현: `Retry-After 12` → 「12초 뒤 다시 물어볼 수 있어요」 를 1초 간격 4회 관찰, 전부 12. 기대: 1초마다 감소(`useCountdown` 1초 틱). 원인 미특정(`now` 갱신 경로 확인 필요 [추측]). [다시 시도] aria-disabled 는 이번 실행에서 측정 전.
- **F-5 [Low] 칩 실효 히트 42px**. 스펙 §22-14 H2 는 44. 권고(designer 판단): 칩 테두리를 `box-shadow` 로 바꾸거나 `before:-inset-y-[5px]` 로 padding box 보정.
- **F-6 [Low · 기존, 본 task 변경 아님]** 역할극 「마치기」(TalkRoomHeader.tsx, HEAD 부터 존재) 가시 높이 36px. 위 3px 바깥 히트는 확인됨. 기록만.
- **Info** 입력칸 초점 중에는 도우미 버튼이 아래 바와 함께 DOM 에서 빠짐 → 판이 열린 동안 `aria-expanded` 대상이 없음(닫기는 ✕·Esc 만). §22-3 와 맞는지 designer 확인.

### 스크립트 정정(결함 아님, 기록용)
- T 처음 안내: 입력 초점 중에는 도우미 버튼이 없어 「버튼 재탭 닫기」 경로를 쓸 수 없었음 → Esc 로 대체. 「Esc 뒤 안내 재표시」 기대는 틀림(명세 §22-4: 도우미 버튼 탭으로 판을 열면 이 방에서 닫힘) → 구현은 명세대로. 정정 후 T 12건 중 11 PASS, 나머지 1은 기대 정정 뒤 PASS 로 봄.
- C2 「다른 말투 2개 더 보기」 이름 정확 일치 실패 → 정규식으로 교체. C2 aria-expanded 검사는 입력 초점 뺀 뒤로 바꿈. **두 정정은 집계 뒤에 적용되어 재실행하지 않았다(NOT_VERIFIED 로 둠).**
- C3 locator 타임아웃 2건은 F-2 의 하위 결과.

### 데모와 다른 점 (QA 관찰)
- 칩 실효 히트 42px(데모 36 표시, 명세 44).
- 녹음 중 판이 사라짐(데모 ⑤A 「녹음 중 판 유지」와 다름) — F-1.
- 429 카운트다운이 멈춤(데모에 없음) — F-4.

### 사용자 육안·실기기 확인 목록
- 앱 WebView 키보드: 입력 줄 가림·판 본문 숨김(`data-kb`) — F-3 과 함께 실기기.
- 실제 소리 재생(▶ TTS), 글자 모드 IME 조합 중 Enter.
- 녹음 후 보내면 판 닫힘(F-1 해결 뒤 재확인).
- 마친 역할극 「마치기」 36px(F-6, 기존).

### 확인 못 한 것 (NOT_VERIFIED)
- PTT 녹음 후 턴 송신 경로(⑤A 후반) — 판이 먼저 사라져 도달 안 함.
- 표시 스위치 「히라가나」 토글(판 열린 상태에서 표시 줄 버튼 가려짐) — 진단 미실행.
- 3폭별 칩 실효 히트(42px 예상, 폭별 재측정 안 함).
- 5초 예산·지표 — 화면 QA 범위 밖(갈래 A 몫).

### 정리
- 산출물: 스크린샷 저장 0(인자 없음·OUT 미사용) → `산출물 정리: 0개 삭제`. 결과 JSON 은 스크래치패드(저장소 밖).
- 프로세스: 개발 서버 3014(PID/PGID 2252735) 종료 · 포트 비움 확인 · 예열 자식 프로세스 확인 — 아래 실행 결과 참조.
- 미러 `~/.node-local/thekaiwa-qa056c` 삭제(하드링크 해제만, 기본 미러 무변경). 쿠키 파일 삭제. DB 쓰기 0.

## QA-B 기록

> 범위: 지연·경합·취소·장애 실측(B1~B4). 실행 주체 QA-B 소환. 판정은 항목별로 아래에 누적한다.

### 환경 (재현 조건)
- 미러 `~/.node-local/thekaiwa-qa056a` 재사용(동기화 안 함). `phrase-help` 라우트·`conversation/chats/phraseHelp.ts`·`engine/router/tasks.ts` 는 NFS 와 `cmp` 동일, 라우트에 `req.signal` 2곳(REV-192 반영) 확인.
- 서버 `next start -p 3013 -H 127.0.0.1`, `APP_ENV=LOCAL`, PID 는 `scratchpad/q056b/pid3013`, 로그 `scratchpad/q056b/server3013.log`. 기동 시각 이후 첫 번째 실행.
- 소환 전 `claude --print` 0개. 3010·3014 는 건드리지 않음. 쿠키 발급은 `qa-session.ts` 로 QA4·QA2·QA3(1시간).
- 스크립트: `qa056b/lib.mts`·`b1.mts`(미러 전용 디렉터리, 저장소 밖).

### B1 도우미 단독 지연 — 측정 완료(판정은 B 전체 뒤)
- 입력 21건: 일반 TALK 13(짧은 5·긴 3·존댓말 2·애매 3) · 역할극(편의점 장면) 5 · 거절 3(문법·산수·코드). 사용자 QA4(일반 7·역할극 5·거절 1)·QA2(일반 6·거절 2) 로 나눠 분당 10 한도 안에서 호출.
- 생성 응답 18건 중 **200 17건**, **504 1건**(첫 호출, 아래 B1-결함 후보).
- 200 17건 지연: client **p50 3.77s · p95 6.00s**, 서버 `steps` 합 p50 3.76s · p95 6.00s. **5초 안 15/17(88%)**. 5초 초과 2건(S4 6.0s, L3 5.5s). PE 실측(일반 p50 3.7 · p95 6.1)과 일치.
- 클래스별 p50: 짧은 질의 2.9s · 긴 질의 4.5s · 존댓말 4.1s · 애매 4.1s · 역할극 3.4s.
- 거절 3건 200 `items: []`, 2.2~3.4s(모델 판정, 계약대로).
- `whyKo` 첫 카드 비움 3/17(18%, 합의 범위 15~25% 안). 전체 항목 기준은 12/29(41%) — 둘째 카드 쪽에서 많이 빔(화면은 첫 카드 위주, 기록만).
- 재시도 흔적 없음: trace 단계는 `PHRASE_HELP` 1개씩, `attempts` 미기록. 성공 호출 최대 6.0s(재시도 시 6~10s 였음, PE 기준) → 재시도는 드물었다 [추측 — trace 가 attempts 를 안 남김].
- 품질 관찰(결함 아님): 「이럴 때 어떻게 설명하면 좋을지 알려 주세요」식 상황 설명 질의 1건(L1 84자)은 `items: []`(모델이 구문 요청으로 보지 않음) [추측 — 빈 결과 기준은 PE 합의 범위 밖].
- **B1-결함 후보 (504 ENGINE_TIMEOUT, 첫 호출)**: 서버 로그 6행 `[claudeCli] 타임아웃 — task=phraseHelp model=haiku promptChars=2847 timeoutMs=11996 attempt=1 maxAttempts=1 retry=아니오`. 이후 같은 서버의 `완료` 행은 elapsed 2.2~5.5s(warm=OFF, 전부 콜드 스폰). Trace `steps[0]={PHRASE_HELP, ms 12537, errorCode ENGINE_TIMEOUT}`, 최상위 `errorCode` 동일.
  - 웜 재확인(같은 서버, 새 대화 2회 `고마워요`): 200 4.9s · 3.2s.
  - 콜드 재현(서버 재기동 직후 첫 호출): **미수행** — B4 뒤 시간이 남으면 재시도, 아니면 NOT_VERIFIED 로 남긴다. 원인 추정: 기동 직후 첫 `claude` 스폰이 CLI 쪽 초기화로 12초를 넘긴 것 [추측].
- DB 전후(QA4·QA2): StudyLog·관측·단어장·교정·제안·반복 **불변**, 대화 메시지 수 전후 동일(인사 1건). 저장 0 확인.
- 정리(B1): 대화 3 · 상황 1 · Trace 21 삭제. 추가 대화 1(웜 재확인용, QA4)은 `scratchpad/q056b/extra_chat_ids.txt` 에 있고 B3 정리에서 같이 지운다. 산출 `scratchpad/q056b/b1.json`.

### 다음 첫 명령(B2)
- `cd ~/.node-local/thekaiwa-qa056a && MODE=turn SCRATCH=<scratchpad>/q056b node --env-file=.env --import tsx qa056b/b2.mts` (그다음 `MODE=review`)

### B2 턴 경합 — CLI 동시 실행 1(`CLAUDE_CLI_CONCURRENCY=1`), 같은 사용자 TALK 방
- 기준선(도우미 없음) n=5: 턴 완료 p50 **4.66s**(4.03~6.93) · 첫 음성(첫 `audio`) p50 **2.19s** · 수락(`accepted`) 0.92~4.79s. 수락 시각의 흔들림은 수락 전 턴 쪽 DB 쓰기(커밋 0.1~1.4s, 코디네이터 안내)가 섞인 것으로 보고 도우미와 무관하다고 본다 [추측 — 수락 전 단계는 세부 미계측].
- **D1 (도우미 먼저, 턴을 +0.3s 뒤)** n=5: 첫 음성 p50 **5.16s**(기준선 대비 **+2.97s**) · 턴 완료 p50 **8.29s**(**+3.6s**), 최대 16.4s. 수락은 0.99~2.40s 로 기준선과 차이 없음 → 증가분은 CLI 대기(LLM 단계)다. 도우미 client 3.3~3.8s ×4, 나머지 1건 9.10s — 서버 로그상 그 도우미 CLI `elapsed=9000ms` 라서 큐 대기가 아니라 CLI 자체가 느렸다.
- **D2 (턴 먼저, 도우미를 +0.3s 뒤)** n=5: 도우미 client p50 **6.0s**(5.7·6.0·6.8·7.6·3.5) — **5초 초과 4/5**, 12초 이내 5/5. 턴 완료 p50 5.72s(기준선 대비 +1.1s).
- 판정: 같은 사용자 두 호출이 같은 직렬 CLI 레인을 쓰므로 Leader 결정 1 의 위험이 **실측으로 확인**됨. 턴은 도우미가 먼저 있으면 첫 음성이 약 3s(p50) 늦어지고, 도우미는 턴 뒤에 서면 5초 예산을 자주 넘는다(코드 변경은 제안만: `TURN_RUNNING` 추가 또는 도우미 후순위 레인).
- 산술 [확실 — 측정 elapsed 기준]: 도우미 분당 10건 × CLI 약 3.5s ≈ 35s/분 = 단일 직렬 CLI 의 약 58% 점유. 한 사용자가 연속으로 쓰면 다른 사용자의 턴이 그만큼 밀린다.
- **지연 분해(client ms vs RequestTrace.totalMs; steps 는 PHRASE_HELP 1단계뿐이라 단계 분해 불가)**: 9쌍 중 차이 7~134ms 가 8건, **534ms 1건**(D2-1, client 5657 / totalMs 5123), 점검 시험 기준선 첫 호출 **458ms 1건**(같은 프로세스의 첫 호출). 차이가 큰 두 건은 Trace 시계 시작 전(요청 파싱·인증·대화 조회) 구간일 가능성이 높다 [추측 — 단계 미계측]. 응답 경로에 Trace 쓰기가 없다는 근거: 나머지 8건에서 client ≈ totalMs.
- DB 쓰기 구분: 도우미 호출 전후 저장 행(StudyLog·관측·단어·교정·제안·반복)은 B1·B3 에서 **불변**. 따라서 도우미 쪽 DB 쓰기는 0이고, 턴 쪽 증가분은 CLI 대기로 설명된다. 기준선 턴의 수락 흔들림은 턴 쪽 DB 쓰기 영향으로 보고, 도우미 탓으로 돌리지 않는다.

### B2 점검(chatReview) 진행 중 도우미 — n=2, 보류
- 첫 시도(TALK 방 점검)는 무효: 400 VALIDATION 「표현 점검은 채팅에서만 할 수 있어요」(454ms·106ms). 도우미 영향 측정이 아님.
- 둘째 시도(CHAT 방 점검, 도우미는 같은 사용자 TALK 방): 점검 11.2~11.6s, 점검 CLI(sonnet) 5.6~6.7s → 점검 라우트에 CLI 밖 약 5s 가 있다 [추측 — 미계측].
- 도우미 REV0 **3.43s**(200), REV1 **12.69s**(200, 5초·12초 모두 초과). REV1 은 로그상 점검 CLI 완료(5.6s) 뒤에 도우미 CLI(3.5s)가 돌았다 → 도우미가 점검 뒤에 섰을 가능성 [추측]. **12초 상한은 요청 전체가 아니라 CLI 실행 시간에만 걸리는 것으로 보인다**(12.7s 가 200 으로 끝남) — 1건 관찰이라 재측정 필요.
- 점검 1회로 생긴 TutorProposal 행은 시험 뒤 삭제(QA4 제안 0건 복귀).

### B3 취소 — 실제 CLI(3013)
- ① **실행 중 취소** n=3: 중단 뒤 자식 `claude` 프로세스 종료까지 **534 · 580 · 539ms**(SIGTERM 반응). 서버 로그 `[claudeCli] 취소 — elapsed=2012ms`(확인). 같은 사용자 재질문 **200**(2.7 · 2.9 · 7.2s — 7.2s 는 CLI 편차 [추측]). Trace 취소 행 `ERROR/CANCELLED` totalMs 약 2.0s. 500·`처리되지 않은 예외` 0.
- ② **큐 대기 중 취소** 재측정 n=2(시험 사이 62s 로 분당 창 비움):
  - QUE0: 앞선 호출 종료 = 중단 후 **1.93s**. 재질문 409 PHRASE_BUSY @9·516·1025·1532ms, 5번째 재질문 200 @8.9s(그 호출 자체가 6.9s — CLI 편차 [추측]).
  - QUE1: 앞선 호출 종료 = 중단 후 **2.44s**. 재질문 409 PHRASE_BUSY @9·517·1024·1530·2038ms(5회 전부 409), 2.5s 창 안에 200 없음.
  - 판정: **REV-192 L-R1 재현** — 큐에서 취소된 요청은 사용자 잠금을 큐 차례가 올 때까지 쥔다. 취소된 요청의 Trace totalMs 2.9s·3.4s 는 라우트가 앞선 호출 종료까지 살아 있었음을 보여 준다. 최종 체감 손실은 앞선 호출의 잔여 시간만큼이며(최대 점검 90s 면 그만큼), 도우미 한 건 기준 Low.
  - 1차 실행의 ② 재질문 200 시점 값(45.7s 등)은 클라이언트 분당 페이싱에 막힌 값이라 버렸다.
- ③ **호출 직후 끊김** n=3: abort 0ms → 서버 로그 `[api] 처리되지 않은 예외: Error: aborted` **1건**(본문 읽는 중 끊김, 응답 없음, Trace CANCELLED 0ms) — 로그 소음, **Low**. abort 5ms → `[claudeCli] 취소 — 시작 전`(CLI 미기동, 이 건 Trace 행은 확인 못 함). abort 20ms → `취소 — elapsed=20ms`. 세 경우 모두 자식 프로세스 잔존 0.

### B4 장애 주입 — 3015 인스턴스(`CLAUDE_CLI_PATH`=미러의 가짜 CLI, 실제 CLI 설정 무변경)
- F0 대조(정상 가짜 응답): 200 · 70ms — 가짜 CLI 경로 확인.
- F1 CLI 무응답(`sleep 16`): **504 ENGINE_TIMEOUT @12.01s**, `Retry-After` 없음, 응답 시점 가짜 프로세스 0개(12s 에 종료 확인), 로그 `타임아웃 — timeoutMs=12000`. 같은 사용자 재호출 **200 · 15ms** → 잠금 해제 확인(409 아님).
- F2 JSON 아닌 응답: 로그 `[json] 1차 응답 계약 위반 → 재시도: JSON 파싱 실패`, CLI 2회 호출 → **502 ENGINE_ERROR** 「AI 응답 형식이 올바르지 않습니다. 다시 시도해 주세요.」 — QA-A 기록의 기대 코드 `INVALID` 와 다르다. **계약 문서(api-contract #180) 대조가 필요한 확인 항목**(결함 판정 보류).
- F3 계약 형식이나 ja 에 한글: 재시도 사유 「ja 는 일본어로만 씁니다. 한글이 들어 있습니다…」, CLI 2회 → 502(F2 와 같은 코드·문구).
- F4 복구: 200.
- 주의(폐기한 실행): 이 B4 는 세 번째 실행이다. 앞선 두 번은 (a) 가짜 CLI 에 실행 권한이 없었고, (b) `next start` 의 자식 `next-server` 가 옛 3015 포트를 잡고 있어 CLI 경로가 없는 옛 인스턴스에 붙었다. (c) 가짜 CLI 가 답 객체 대신 envelope 를 출력해 계약 필드 누락이 났다. 세 번 모두 결과에서 뺐다.

### 결함·확인 목록 (QA-B)
| # | 등급 | 내용 | 판정 |
|---|---|---|---|
| B-1 | Medium | 도우미가 회화 턴을 늦춘다(D1 첫 음성 +2.97s·완료 +3.6s, p50) — 설계상 알려진 위험이 실측으로 확인됨 | Leader 결정 필요(TURN_RUNNING 또는 후순위 레인) |
| B-2 | Medium(확인) | 기동 직후 첫 실제 CLI 호출이 12s 시간 초과(504, 로그 `timeoutMs=11996`) — 같은 조건 재현은 미수행 | NOT_VERIFIED, 배포 직후 재확인 항목 |
| B-3 | Low | 큐 대기 중 취소 → 사용자 잠금 유지(REV-192 L-R1) 재현 | 수용 가능 한계로 기록 |
| B-4 | Low | 본문 읽는 중 끊김 시 `[api] 처리되지 않은 예외: Error: aborted` 로그 1건 | 로그 소음, 취소 500 로그 방지 의도와 맞는지 Leader 판단 |
| B-5 | Low(확인) | 12s 상한이 CLI 실행 시간만 잡는 것 같음(REV1 12.69s 200) | 1건 관찰, 재측정 필요 |
| B-6 | Low(확인) | 502 코드가 `ENGINE_ERROR`(기대 `INVALID`) | api-contract 대조 필요 |

### 판정 (QA-B)
**PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 2(B-1 설계 위험 실측 확인, B-2 콜드 504 미재현) · Low 4. 실패 재현 3회 미만, 에스컬레이션 대상 아님. B-1 은 Leader 결정 사항이다.

### 정리 (QA-B)
- 대화·상황·Trace·TutorProposal: 각 실행 끝에 시험 생성분 삭제(출력 `정리: …`). QA4·QA2·QA3 의 StudyLog·관측·단어·교정·제안·반복 행은 전후 불변.
- 프로세스: 3013·3015 서버 종료, 포트 3013·3015 비움 확인, 남은 가짜 CLI·`claude --print` 프로세스 0. 3010·3014 는 건드리지 않음.
- 쿠키 파일 `c2·c3·c4` 비움(1시간 만료, 로그아웃 호출 안 함). 스크린샷 0장. 저장소 파일 변경 0(이 기록만 추가).
- 미러 `~/.node-local/thekaiwa-qa056a/qa056b/`(lib·b1·b2·b2r·b3·b3q·b4·fixprop·fakecli.sh) 에만 남김. 결과 JSON: `scratchpad/q056b/{b1,b2-turn,b2-review,b3,b3q,b4}.json`.
- 확인 못 한 것(NOT_VERIFIED): B-2 콜드 504 재현, pm2 운영 로그, 점검 경합 n≥3, 실제 `claude` 프로세스 종료 시 Trace 단계 분해, `[claudeCli] 취소 — 시작 전` 건의 Trace 행.

## QA-C2 기록 — 화면 재검증 (수정 후 전체 · qa · 2026-10-11 · 체크포인트 1)

**재현 조건**: Chromium 147 `/usr/bin/google-chrome` headless · isMobile · DSF 2.625 · ko-KR · Asia/Seoul · reducedMotion=reduce · 뷰포트 360/390/412 × 892(판 열림·닫힘) + 780(키보드 모형) · 다크는 390 `colorScheme=dark`. 대상 `http://127.0.0.1:3016`(개발 서버 `next dev -H 127.0.0.1 -p 3016`, 전용 미러 `~/.node-local/thekaiwa-qa056d` = `sync-local.sh`(NFS 작업 트리 그대로) + node_modules 실복사 + `.prisma` 는 predeploy 사본(md5 `4cd2598f…`), 스키마 md5 `8f493d1b…`). 계정 QA2(`qa-session.ts`, 1시간). 운영 3010·다른 세션 포트 미접속. 가로채기: `phrase-help`·`turns`·`reply-practice`·`text/annotate` 는 서버 도달 0(요청 로그로 확인), 그 밖 비-GET 은 200 빈 응답. 음성 티켓은 가짜 게이트웨이(`routeWebSocket`)로 흉내. LLM 호출 0(`claude --print` 0개 확인).
**산출물**: 스크린샷 0장(인자 없음). 스크립트·결과는 scratchpad `qa056d/`(저장소 밖). 독립 실행 결과 로그 `scratchpad/qa056d/logs/`.
**주의**: NFS 작업 트리에는 task-058 서버 파일(`reply-practice`·`openings/draft`·`requestCancel.ts` 등 미커밋)이 함께 있어 미러에 같이 올라갔다. 화면 항목 판정에는 영향 없음(해당 응답은 가로챔).

### 체크포인트 1 — 완료 항목 (C1'·C3'·C4'·C5' 일부)

| 항목 | 판정 | 실행 근거(관찰값) |
|---|---|---|
| **C1' 입력 바** (3폭 × 일반·역할극 × 말·글자) | **PASS** | 마이크↔도우미 간격 12.0px × 12/12 · PTT 72×72 · 도우미 44×44 · 글자 입력창 180 / 210 / 232px · 가로 넘침 0(닫힘 892·780, 판 열림 892, 전 폭) · 판 높이 215px ≤ min(46dvh,320px) · 다크 바탕 luma<0.25 · 「처음 한 번 안내」 새 프로필 말 모드 1회·플래그 1 기록·탭 순서 ✕→마이크→도우미·글자 모드 판정 안 함 |
| **C1' 예시 칩 실효 히트 44(±0.75)** | **FAIL 6/18 (F-5 잔존)** | `chipprobe.mjs`: 중심 세로선을 0.25px 간격으로 `elementFromPoint` 스캔. 칩 박스 36px, 가상 요소 확장 ≈ 위 4.75 · 아래 3.75 → 실효 44.5 로 **12/18 통과**. **2행으로 줄바꿈된 첫 칩 6개**(말 모드 3폭 ×, 역할극 3폭 ×) 실효 **41.75px** — 아래 3px 바깥이 다음 행 칩 것으로 잡힘(DOM 뒤 칩 우선). REV-194 F-4 의 「44.5」 산술은 줄바꿈 첫 칩에 적용되지 않음. 이전 QA-C 의 42 → 41.75 로 거의 그대로 |
| **C1' 역할극 「마치기」** | 기존 결함 (범위 밖) | 36px(62×36) — 3폭 × 역할극 전부 「터치 44 미만」 실패. `TalkRoomHeader.tsx` HEAD 부터 존재, 본 task 변경 아님. F-6 승계 |
| **C1' 처음 한 번 안내** | PASS 9 / FAIL 1(스크립트 기대) | 「Esc 로 닫으면 다시 보임」 기대는 QA-C 정정 메모와 같은 이유로 스크립트 기대 오류(§22-4 도우미 버튼 재탭·Esc 뒤 재표시 여부는 Leader 확인 대상). 나머지 PASS |
| **C1' 판 ✕ 히트(위 3px 바깥)** | 스크립트 기준 과잉 | ✕ 박스 자체가 44×44 → 44 기준 충족. 「바깥 3px 까지 받아야 함」은 이 기준이 아님 — 판정 PASS(박스 기준), 스크립트 정정 대상으로 표시 |
| **C2' [물어보기] 첫 탭** (talk·rp·text × 마우스·터치) | PASS 6/6 | 첫 탭 1회에 요청 1건·질의 일치(`hits 0→1`). 탭 후 판 top 677→547(글자 모드 527) — 질의 전송 시 입력 blur 로 말 바가 돌아오며 판이 위로 이동. 탭 자체는 씹히지 않음(관찰, 기록) |
| **C2' 키보드 Tab→[물어보기]→Enter** | 재실행 대기 | 1차 실행 Enter 로 요청 1건은 나갔으나 라벨 함수 버그로 초점 이름이 빈칸 — 함수 수정 후 재실행 |
| **C2' 키보드 Enter/Space**(칩·▶·[다른 말투]·[다시 시도]·Esc) | PASS 6/6 | `g4.mjs`: 칩 Enter·Space → 물음 1건 · ▶ Enter → 소리 요청 · [다른 말투] Enter → 펼침 · Esc → 판 닫힘·초점 도우미 · [다시 시도] Enter → 다시 물음 |
| **C2' 버튼 위에서 시작한 터치 스크롤** | PASS | `g5.mjs`: scrollTop 0→40, click 0, 판 유지 — 스크롤이 막히지 않음 |
| **C2' 첫 탭 7개** (칩·▶·[다른 말투]·[다시 시도]·[입력창에 넣기]·✕) | 1차 실행 PASS 다수 · 재실행 대기 | `g1.mjs` 1차 talk/mouse 6 + talk/touch 2 PASS 후 ▶ 탭에서 Playwright 「요소 안정화」 대기 timeout 으로 중단 — 스크립트 측 불안정(개발자 기록의 g1 최종 실행도 같은 지점 실패 이력). 탭 함수를 `scrollIntoView` 로 바꿔 재실행 대기 |
| **C3' ⑤A 녹음 중 판 유지** (말·역할극 × 마우스·터치, 12건) | **PASS 12/12** | 가짜 마이크 + 가짜 게이트웨이: 녹음 중 판 유지·입력 `disabled`·[물어보기]·▶ `aria-disabled=true`·도우미 버튼 `aria-disabled=true`·오류 띠 0 · 손을 떼 턴 POST 1건 → 250ms 대 판 닫힘 · 짧은 녹음(final 없음) 판 유지·턴 POST 0. (흐림 시각 효과는 `aria-disabled` 로만 확인 — 육안 항목) |
| **C3' 턴 accepted 후 다시 열면 마지막 답** | 재실행 대기 | `c3reopen.mjs` 신규 작성(말·역할극) |
| **C4' 요청 자동 취소** (①–⑥) | S1~S4 PASS · S5 스크립트 가정 오류 재실행 대기 | `h1.mjs`: S1 PTT 9ms 에 abort(`ERR_ABORTED`), 안내 줄 새 문구, 판·질의 유지, 입력 잠김, 오류 0, `aria-live=off`, 손 뗀 뒤 턴 POST 정상 → 판 닫힘, 다시 열면 질의 유지·안내 지워짐, 8초 뒤 늦은 응답 무반영, 새 질의 2건째 정상 · S2 닫은 채 PTT 5ms abort, 다시 열면 안내 1회 · S3 결과 상태 PTT abort 없음 · S4 글자 [보내기] 25ms abort + 턴 POST · **S5 실패 2건 — h1 의 `noFinal` 가정**: 짧은 녹음에 final 이 없으면 상태가 `RECOGNIZING` 에 머물러 입력이 2초 뒤에도 잠긴 채(관찰 `"state":"RECOGNIZING"`). developer 가 한 글자 final(`あ`)로 고친 기록이 있어 그 사본(`h1b.mjs`)으로 재실행 대기 |
| **C5' 429 카운트다운** | 본문 PASS · sr 줄 관찰 Low | `r429.mjs`(본문·sr 줄 분리 1초 간격 14회): 본문 12→11→10→9→8→6→5→4→3→2→1→「잠시 뒤 다시 물어봐 주세요.」(1·2초 사이 관측 간격 탓 7 누락, 감소 방향 정상). [다시 시도]·[물어보기] 카운트다운 동안 `aria-disabled=true`, 0 이후 속성 제거. **sr 줄(`role=status`)은 「12초 뒤 다시 물어볼 수 있어요.」에서 끝까지 고정**(카운트다운 후에도 stale) — 설계상 1회 낭독이라 기능 결함은 아니나 Low a11y 관찰로 기록. QA-C 의 F-4(「12초에서 멈춤」)는 스크립트가 **첫 일치(sr 줄)** 를 읽은 결함이었음 — 정정 |
| **C5' 409 ENDED(역할극 마침)** | PASS | `f409.mjs`: 판 닫힘 · 「이 역할극은 마쳤어요」 · 도우미 버튼 없음 |

### 열린 것 (체크포인트 1 기준)
- 재실행 대기: k1(키보드 Tab 라벨 수정) · g1(▶ 탭 수정, 전 7개) · c3reopen · h1b(S5) · c-screens `ONLY=C2,C4`(C5' 상태 표·저장소 키·엔진명·다크·aria 묶음 — 기존 스크립트의 429 첫-일치 검사는 본 기록의 r429 로 대체).
- 실기기·육안 목록은 최종 보고에 모은다.

### QA-C2 최종 판정 (2026-10-11 · qa · 체크포인트 2 — 같은 절 이어서)

**판정: FAIL — 결함 1건(Low, F-5 잔존)**. 나머지 C2'·C3'·C4'·C5' 는 PASS. 판정 근거: 사양 C1' 기준「예시 칩 실효 히트 44(±0.75)」가 6/18 칩에서 미달. High·Critical 없음. 수정 후 **Reviewer 부터 재순환**(QA 직접 재실행 금지).

| 항목 | 판정 | 근거(실행 파일 · 관찰값) |
|---|---|---|
| C1' 입력 바 3폭 × 방 2 × 말·글자 | PASS | `c-screens-qa.mjs ONLY=C1`: 간격 12.0 · PTT 72 · 도우미 44 · 입력창 180/210/232 · 가로 넘침 0 · 판 높이 ≤ 320 · 다크 바탕 luma<0.25 |
| C1' 예시 칩 실효 히트 | **FAIL 6/18 (F-5 잔존, Low)** | `chipprobe.mjs`: 2행 줄바꿈의 첫 칩 6개 **41.75px**, 나머지 12개 44.5px. 칩 아래 3px 바깥 = 다음 행 칩 |
| C1' 처음 한 번 안내 | PASS (스크립트 기대 1건 정정) | 9/10 — 「Esc 뒤 재표시」 기대는 QA-C 정정과 같은 이유로 스크립트 오류 |
| C2' [물어보기] 첫 탭 · 키보드 Tab→Enter | PASS 8/8 | `k1.mjs`(재실행): 마우스·터치 × 말·역할극·글자 6 + 키보드 Tab→[물어보기]→Enter 2 — 요청 1건·질의 일치 |
| C2' 7개 버튼 첫 탭 | PASS 38/38 | `g1.mjs`(탭 함수 수정 후): 칩·▶·[다른 말투]·[다시 시도]·[입력창에 넣기]·✕ × 방 3 × 포인터 2. 판 top 은 말 방 677 유지(펼침 584→572) |
| C2' 키보드 Enter·Space·Esc | PASS 6/6 | `g4.mjs`: 칩 Enter·Space → 물음 · ▶ → 소리 요청 · [다른 말투] 펼침 · Esc → 닫힘·초점 도우미 · [다시 시도] 다시 물음 |
| C2' 버튼 위 터치 스크롤 | PASS | `g5.mjs`: scrollTop 0→40 · click 0 · 판 유지 |
| C3' ⑤A 녹음 중 판 유지 | PASS 12/12 | `g3.mjs`: 녹음 중 판 유지 · 입력 disabled · 버튼 aria-disabled · 오류 띠 0 · 손 뗌 → 턴 POST → 250ms 판 닫힘 · 짧은 녹음(final 없음) 판 유지·턴 0 |
| C3' 닫힌 뒤 다시 열면 마지막 답 | PASS 2/2 | `c3reopen.mjs`(말·역할극): accepted → 닫힘 → 다시 열면 답·질의 유지 |
| C4' 자동 취소 ①–⑥ | PASS 18/18 | `h1b.mjs`(S5 만 한 글자 final `あ`): S1 PTT 9ms abort · S2 닫은 채 PTT 5ms abort · S3 결과 상태 abort 없음 · S4 글자 [보내기] 25ms abort+턴 POST · S5 짧은 녹음 판 유지·입력 풀림·질의 유지·재질문 정상 · 8초 뒤 늦은 응답 무반영 · 안내 `aria-live=off` 녹음 중 |
| C5' 429 카운트다운 | PASS (본문) · sr Low | `r429.mjs`: 본문 12→11→…→1→「잠시 뒤」 · [다시 시도]·[물어보기] 카운트다운 중 aria-disabled · **sr 줄은 「12초 뒤…」 고정**(N-1) |
| C5' 409 ENDED | PASS | `f409.mjs`: 판 닫힘 · 「이 역할극은 마쳤어요」 · 도우미 없음 |
| C5' 상태 표·문구·저장소·엔진명·XSS·aria | PASS 62 · 스크립트 결함 2 · 참고 1 | `c-screens-qa.mjs ONLY=C2,C4`(65건): PASS 62. FAIL 2 = 아래 「스크립트 정정」 · 참고 1 = 콘솔 404·502(고의 응답 종류) |
| C5' 다크 | 부분 PASS · **NOT_VERIFIED(요소별 대비)** | `dark.mjs`(390 열림·결과): 판 배경 luma 0.131 · 글자 밝음 · 가로 넘침 0. 짙은 글자(26,14,10) 1종 있음 — 바탕 대비는 계산 실패로 미측정(쿠키 비움 뒤 재실행 못 함). 판정 보류 |

**결함**
- **F-5 잔존 [Low]** 예시 칩 실효 히트 미달. 재현: `chipprobe.mjs`(360/390/412 × 말·역할극, 2행 줄바꿈 상태). 기대: 실효 44 ±0.75. 실제: 첫 칩 41.75(6/18). 원인 관찰: 2행 칩의 위쪽 확장(4.75)이 아래 행 칩과 겹치면 DOM 뒤 칩이 받는다 [가능성 높음 — elementFromPoint 로 확인]. REV-194 F-4 의 「44.5」 산술은 한 행 칩에만 맞다. 수정 방향(판단은 designer·developer): 행 간격을 키우거나 확장 우선순위를 주는 방식.
- **N-1 [Low · a11y]** 429 의 sr 줄(`role=status`)이 「12초 뒤 다시 물어볼 수 있어요.」에서 카운트다운이 끝난 뒤에도 그대로 남는다. 본문은 1초마다 바뀌지만 sr 은 바뀌지 않는다. 기능 결함은 아니고 낭독이 stale 해진다.
- **N-2 [확인 요청 · 재현 1조건]** 짧은 누름(약 0.9초)에서 final 이 없으면 상태가 `RECOGNIZING` 에 머물러 입력이 2초 뒤에도 잠긴다(`h1.mjs` S5 원본). 같은 final 없음을 1.8초 누른 경우(g3)는 idle 로 돌아갔다. 탈출 경로와 게이트웨이의 final 전송 여부는 미확인 — developer·reviewer 확인 요청. 결함 판정은 보류.
- **N-3 [Info · designer 확인]** 입력 중 도우미 버튼이 DOM 에서 빠진다(바 숨김, §22-6 `hp-open-kb` 와 일치). 그 동안 `aria-expanded` 대상이 없다. QA-C 의 Info 가 그대로 남음.
- **N-4 [Info]** [물어보기] 전송 직후 판이 677→547px 로 위로 이동(입력 blur 로 말 바가 돌아오는 것, §22-11 과 일치). 탭은 씹히지 않음.

**스크립트 정정 (결함 아님, 기록용)**
- C5' 「hp-rate 카운트다운 감소 12→12」: `#talk-helper` 첫 일치(sr 줄)를 읽은 스크립트 결함. 본문 기준은 `r429.mjs` 로 PASS(QA-C F-4 정정 확정).
- C2 「hp-open-kb 도우미 버튼 DOM 존재」: §22-6 「아래 바 숨김」과 대립하는 기대 — 명세대로면 구현이 맞다(N-3).
- C1' H 「판 ✕ 위 3px 바깥 히트」: ✕ 박스가 44×44 이므로 44 기준 충족. 바깥 히트는 기준이 아님.
- C1' 처음 안내 「Esc 뒤 재표시」 기대: QA-C 정정과 같은 이유로 틀림.
- `g1.mjs` ▶ 탭: Playwright 「요소 안정화」 대기 timeout → `scrollIntoView` 로 교체 후 38/38. 1차 실행의 중단은 스크립트 측.

**기존 결함(범위 밖, 승계)**: 역할극 「마치기」 36px(F-6, `TalkRoomHeader.tsx`). 3폭 × 역할극 전부 「터치 44」 미달로 찍힌다. 본 task 변경 아님.

**실기기·육안 확인 목록(사용자)**: 앱 WebView 소프트 키보드에서 판 안 첫 탭·칩 두 줄 오터치 · 온디바이스 STT 경로의 ⑤A·자동 취소(웹은 가짜 게이트웨이로만 확인) · 녹음 중 판 흐림 시각 효과(aria-disabled 로만 확인) · TalkBack 에서 429·안내 줄 낭독 · 실제 TTS 소리(▶는 mock 503 로 「목소리를 불러오지 못했어요」 줄까지만 확인) · 한글 IME 조합 중 Enter · 다크 판 요소별 대비.

**확인 못 한 것 (NOT_VERIFIED)**: 다크 요소별 대비비(계산 실패·재실행 생략) · 턴 진행 중 도우미 질의(범위 밖) · 앱 WebView 렌더 · 프로덕션 3010 미접속.

**정리**
- 개발 서버 3016 종료(PGID 2594850) · 포트 3016 리스너 0 확인.
- 쿠키 파일 `scratchpad/qa056d/c2` 비움(0 bytes). DB 쓰기 0: 비-GET 요청은 가로채기로 200 빈 응답(`POST attendance/check-in` 등은 나갔으나 서버 도달 0). 음성 티켓은 가짜 게이트웨이로 가로챔(`c-screens` 경로만 실서버 통과 가능 — 발급만).
- 스크린샷 0장. 결과·로그는 scratchpad `qa056d/logs/`(저장소 밖).
- **미러 `~/.node-local/thekaiwa-qa056d`(약 830MB) 잔존 — 삭제 보류**: 안전 게이트가 삭제 명령을 세 번 막아 우회하지 않았다. 사용자 승인 후 삭제 필요(되돌림은 `sync-local.sh` + predeploy node_modules 복사).
- 저장소: QA 가 만든 소스 변경은 0이다. 작업 트리에는 `src` 미커밋 변경 20파일(424+/137-)이 이미 있었고 task-056·058 등 다른 세션 몫이다(QA 가 건드리지 않음). QA 는 이 기록 파일에 이 절만 추가했다.

## QA-B2 기록 — 취소 뒤 턴 지연 · 잠금 · 콜드 재측정 (2026-10-11 23:00~23:40)

**판정: PASS_WITH_NOTES** — Critical 0 · High 0 · **Medium 1**(F-1 동시 LLM 호출 시 뒤쪽 +3.4 s, 턴 예산 위반 조건 있음 → Leader 결정) · **Low 2**(F-2 잠금 0.6 s 409, F-3 aborted 로그 소음). B-2 콜드 504 는 3회 기동에서 **재현 안 됨**. 결함 열림 → **deployer 인계 없음**.

### 환경 (재현 조건)
- 미러 `~/.node-local/thekaiwa-qa056e` 신규 sync-local(NFS 작업트리 기준) → `next build` BUILD_EXIT=0 · node_modules 는 qa056a 하드링크 · schema md5 `8f493d1b…` 일치.
- 서버 `next start -p 3013 -H 127.0.0.1`, `APP_ENV=LOCAL`, `.env` 의 `CLAUDE_CLI_CONCURRENCY=1`(QA-B 와 동일). 포트 3013 만 사용.
- 계정 QA4(q4)·QA3(q3) 만. 기준선 턴은 매번 새 TALK 방, 발화 `こんにちは`, 도우미 질의 16종 순환.
- 결과(저장소 밖): `scratchpad/q056e/b2p.json`(첫 실행) · `b2q.json`(재실행) · `cold.jsonl` · `server.log` · 스크립트 `scratchpad/q056e/qb2/`.

### 항목별 결과 (n·p50·p95, 기준선 대비)

**B2'-a 턴 (n=12 = 첫 실행 6 + 재실행 6, 라운드마다 BL·CT·CX 번갈아)**

| 조건 | 턴 첫 음성 p50 / p95 | 턴 완료 p50 / p95 | 도우미 client |
|---|---|---|---|
| BL 기준선(도우미 없음) | 2.42 / 4.22 s | 3.96 / 5.77 s | — |
| CT 경합(도우미 먼저, 턴 +0.3 s) | 1.95 / 3.08 s (턴 지연 **재현 안 됨**) | 3.62 / 5.61 s | **6.79 / 9.41 s**(200 12/12) |
| CX 취소 뒤 턴(abort 1.0 s → 곧바로 턴) | 2.70 / 7.36 s (Δ p50 **+0.28 s**) | 4.48 / 8.84 s (Δ p50 **+0.52 s**) | AbortError 12/12 |

- 목표 "취소 뒤 턴 증가분 ≤ 약 0.6 s" → **충족**(완료 Δ p50 0.52 s). 자식 종료 p50 **579 ms**(p95 653), abort 시 자식 존재 12/12, Trace 취소 행은 `phraseHelp/ERROR/CANCELLED` 만(OK·다른 코드 0), 서버 로그 `[claudeCli] 취소 — elapsed=…` 줄 확인.
- CX p95 7.36 s 1건은 서버 로그 `talk elapsed=7747ms` 와 맞는다 → CLI 자체 지연 [가능성 높음].
- 기준선 선택에 따라 값이 바뀐다: CT 를 기준으로 하면 CX Δ 는 첫 음성 +0.75 s·완료 +0.86 s. CT 가 BL 보다 빠르게 나온 원인은 미확정 [추측].

**B2'-b 취소 시점별 (재실행 b2q, 시점당 n=3, 사용자 번갈아)**

| 취소 시점 | 취소 시 자식 있던 건 | 재호출 0 s | 재호출 +0.8 s | 취소 직후 턴 첫 음성 p50 (완료 p50) |
|---|---|---|---|---|
| 0.3 s | 0/3 (CLI 아직 안 뜸) | 200 3/3 | 200 3/3 | 2.38 s (4.09 s) |
| 1.5 s | 3/3 (자식 종료 p50 526 ms) | **409 PHRASE_BUSY 3/3** (+6~9 ms) | 200 3/3 | 2.57 s (4.18 s) |
| 3.0 s | 3/3 (자식 종료 p50 538 ms) | **409 PHRASE_BUSY 3/3** (+6~7 ms) | 200 3/3 | 2.43 s (3.92 s) |

- 취소 직후 턴 전체(n=9) 첫 음성 p50 2.51 s · p95 4.15 s → 기준선 대비 +0.09 s.
- 항목 ②(취소 전에 이미 끝난 경우 정상 200) 는 **NOT_VERIFIED** — 3.0 s 에도 세 시행 모두 CLI 가 돌고 있었다. 2.5~4.5 s 점이 필요하다.

**B2'-d 반대 방향 (첫 실행 n=3, 턴 먼저 → 도우미 +0.3 s)**: 턴 첫 음성 **p50 5.83 s**(p95 6.01) → 기준선 대비 **+3.4 s**, 턴 완료 p50 7.58 s. 도우미 client p50 3.43 s · max 9.86 s(200 3/3, 12 s 상한 안).

**B2'-c 콜드 (기동 3회 × 모드 2: 첫 도우미·첫 턴)**
- 첫 도우미 3.38 · 3.51 · 5.14 s(서버 CLI elapsed 3.25 · 3.38 · 4.98 s), 200 3/3, **504 0/3**.
- 첫 턴 첫 음성 1.89 · 2.75 · 2.57 s, 완료 5.81 · 4.29 · 4.29 s.
- 결론: **B-2(12 s 504) 재현 안 됨**. 원인은 단발 외부 요인으로 보이나 확정 아님 [추측]. 배포 직후 1회 재확인 항목은 유지.

### 발견 사항
- **F-1 [Medium] 동시 LLM 호출 두 건이면 뒤쪽이 CLI 한 건(약 3 s)을 기다린다. 어느 쪽이 뒤가 되는지는 실행마다 다르다.**
  - 재현 A(CT, 도우미 먼저 +턴 0.3 s, n=12): **도우미**가 뒤에 섬(p50 6.8 s, 최대 9.4 s). 턴은 정상.
  - 재현 B(DD, 턴 먼저 +도우미 0.3 s, n=3): **턴**이 뒤에 섬 — 첫 음성 p50 5.83 s(기준선 대비 +3.4 s) → **5 초 예산 위반**.
  - QA-B 의 D1(도우미 먼저 → 턴 +2.97 s)은 재현 A 에서 나타나지 않았다. "도우미가 턴을 늦춘다"는 고정된 방향이 아니다.
  - 기대: 턴 첫 음성 5 초 예산 유지 · 실제: 두 요청이 약 1 초 안에 겹치면 뒤쪽이 약 3 s 밀린다.
  - 원인 추정 [가능성 높음]: `claudeCli.ts` `schedule()` 은 FIFO, CLI 동시 1. 두 요청의 LLM 진입 순서가 준비 시간 경쟁으로 정해진다(턴 LLM 은 수락 전 `startLlmRun` 으로 먼저 시작되는 경로가 있음 — 해당 분기 조건은 코드 미추적 [추측]).
  - 영향 범위: 도우미가 턴 발화 직후 약 1 초 안에 열릴 때. 자동 취소(말하기 시작)는 턴 발화 뒤의 도우미 요청을 막지 못한다.
  - 권고(Leader 결정): (a) 턴 진행 중 도우미 요청 보류(`TURN_RUNNING` 409 또는 턴 전송 뒤 1.5 s 도우미 비활성), (b) 도우미를 batch 레인으로 낮춰 턴 우선. 수정은 Developer 몫.
- **F-2 [Low, 신규] 실행 중 취소 직후 0.6 s 안의 재호출은 409 PHRASE_BUSY.** 기대(REV-192: "실행 중이면 abort 뒤 즉시 해제")와 다르다. 자식이 살아 있던 취소 6/6 에서 0 s 재호출 409, +0.8 s 재호출 200. HTTP 경로에서는 잠금이 자식 종료(0.5~0.6 s)와 함께 풀리는 것으로 보인다 [가능성 높음]. REV-192 의 "abort 뒤 1 ms" 는 직접 호출 프로브 값이다. 취소 자체(자식 종료·턴 지연)는 정상. 권고: 사람 반응보다 짧은 창이라 수용 가능하다고 보되, 화면이 409 를 「잠깐만요」류로 안내하는지 확인.
- **F-3 [Low, B-4 재현] 취소 시 `[api] 처리되지 않은 예외: Error: aborted` 로그.** 첫 실행 4건, 재실행·콜드 5건. 클라이언트 응답·계약에는 영향 없음(로그 소음). 권고: 선택 사항으로 로그 억제 검토.
- 기존 항목: B-1 은 F-1 에 흡수. B-3(큐 대기 중 취소 → 잠금 유지)은 이번 범위 밖, 수용 한계 유지.

### 정리
- 측정 방 81개(b2p 39 · b2q 36 · 콜드 6) 삭제. 콜드 방은 `cleanup-cold.mts` 로 별도 정리(대화 6·Trace 3, 잔여 방 0).
- 잔여 턴 Trace(`chatMessage`) 57건을 발견 — 정리 함수가 지우지 못하던 행이다. QA3·QA4 의 22:50 이후 행만 대상으로 삭제(삭제 전 집계 `chatMessage/-` 57 전부, 잔여 0). 측정 `phraseHelp` Trace 는 잔여 0.
- 쿠키 `c2·c3·c4` 비움. 스크린샷 0장. 저장소 파일 변경 0(이 기록만 추가).
- 프로세스: 서버 3013 종료(cold 드라이버 마지막 stop), 포트 3013 비움 확인, `claude --print` 0, 측정 스크립트 0.
- 미러 `~/.node-local/thekaiwa-qa056e` **유지**(node_modules 는 qa056a 하드링크). 정리 여부는 Leader 판단. 삭제 명령은 안전 확인 게이트에서 막혀 실행하지 않았다.

### 확인 못 한 것 (NOT_VERIFIED)
1. B2'-b ②(취소 전에 이미 끝난 경우 정상 200) — 2.5~4.5 s 점 필요.
2. 큐 대기 중 취소의 장기 잠금(REV-192 L-R1) — 이번 범위 밖(QA-B 에서 재현됨).
3. 화면 반응(자동 취소 시 판 상태, 409 문구) — QA-C2 몫, 실기기 확인 필요.
4. pm2 운영 로그 — 이번에도 미러 서버 로그만.
5. F-1 원인 확정 — 턴 `startLlmRun` 조기 시작 조건은 미추적, 메커니즘은 추측.

### 주의점
- 도우미는 사용자당 분당 10건. 첫 실행 B2'-b 의 `abortKids=0` 재호출 2~8 s 행은 **클라이언트 `paced()` 가 서버 도달 전에 대기시켜 생긴 무효 행**이라 판정에서 뺐다. 재실행 b2q 는 `paced()` 없이 시행 사이 15 s 간격을 두었다.

### 다음 첫 명령(재실행 필요 시)
`KAIWA_LOCAL_ROOT=$HOME/.node-local/thekaiwa-qa056e bash scripts/sync-local.sh` → `./node_modules/.bin/next build` → `scratchpad/q056e/server.sh start` → `qb2/prep.mts` → `qb2/b2q.mts` → `qb2/report.mts`.

### 체크포인트
- 완료: B2'-a(n=12) · B2'-b(시점 3 × n=3) · B2'-c(3 기동 × 2 모드) · B2'-d(n=3). 남은 일: 없음(② 는 NOT_VERIFIED).
- 다음: Leader 결정 — F-1(Medium, 턴 예산), F-2·F-3(Low). 수정이 생기면 Developer → Reviewer 재순환(QA 직접 재실행 금지).
