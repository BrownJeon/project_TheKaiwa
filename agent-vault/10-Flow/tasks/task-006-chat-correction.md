---
task_id: task-006
title: "AI 채팅 + 표현 점검 + 교정 채택"
status: in-progress
base_ref: 77aead8
risk_level: R2
roles_involved: [leader, judge, designer, prompt-engineer, developer, reviewer, qa, codex]
related_tasks: [task-004-ai-client-persona, task-005-settings-attendance, task-017-dev-env-judge-codex]
tags:
  - type/task
  - domain/conversation
  - domain/ui
created: 2026-09-27
updated: 2026-09-27
---

## 목표 (Leader)
design-spec §15 task-006: AI 채팅(텍스트) 화면과 SSE 턴 처리, 사용자 일본어 문장의 표현 점검 → 교정 제안(`PROPOSED`) 표시 → 사용자가 채택할 때만 저장.
완료 기준(§15): SSE 턴·락·폴링, `Correction.original` 바이트 일치, 채택 전 타 테이블 행 0, 타인 채팅·교정 IDOR 404, 이모지 입력 500 없음.
정본: `docs/design/api-contract.md` §2-6 대화 `/api/v1/chats`·§2-7 교정 `/api/v1/corrections`, `domain-model.md`(Chat·Message·Correction·TutorProposal), `module-dependency.md`(conversation L2, 턴은 app 층 조합).

**새 운용 첫 task** — [[task-017-dev-env-judge-codex]] 절차(judge 접수·C1/C2·codex)를 처음 실제로 적용한다. Jev 실제 호출 검증을 겸한다.

## 관련 과거 이력 요약
- [[task-004-ai-client-persona]]: engine router·Claude CLI 어댑터(설정/MCP 생략·thinking 끔)·페르소나 로더·프롬프트 3종, 회화 턴 p50 5.1s. `NoEngineAvailableError` 이름 규약.
- [[task-005-settings-attendance]]: `infra/http.ts`(봉투·오류 코드·withApi·requireSession·readJsonObject·rateLimit) — 채팅 API 도 이 패턴을 쓴다.

## Leader's Plan (2026-09-27, Linux 세션)

### 요구사항 해석 (정본 인용)
- design-spec §7-1 채팅: 텍스트 턴(A2, 교정 없음) → 대화 뒤 `POST /chats/:id/review`(A3, ≤20건 동기·초과 잡) → 문장별 교정 카드(`original` 바이트 일치) → 채택 시 단어장 추가 시트 → 종료 시 `ADD_STUDY_LOG` 제안 카드.
- api-contract #27~#39 + #55(`/api/v1/jobs/:id`), 공통 §0-2 봉투·§0-4 타인 404·§0-5 오류 코드·§0-9 SSE(15s `: ping`, 끊김은 오류 아님 → 폴링 2.5s→5s).
- module-dependency L2: 턴·락·SSE·pending 정리 = `conversation/orchestrator`, **쓰기(WordEntry·StudyLog·스냅샷·LearnerErrorStat)는 conversation 이 하지 않고 라우트가 learning 에 위임**(행렬 판독 규칙 2). conversation 은 learning 의 **읽기**(`getErrorStats` 등)만 import.
- §15 완료 기준: SSE 턴·락·폴링, `original` 바이트 일치, 채택 전 타 테이블 행 0, IDOR 404, 이모지 500 없음.

### 범위 결정 (Leader)
1. **CHAT 이 주 대상.** 오케스트레이터는 TALK 도 같은 경로로 처리(텍스트 턴, `correction` PROPOSED 저장·바이트 검사 포함)하되 `audio` 이벤트·TTS·회화 화면은 task-007. ASK 는 `400 FEATURE_NOT_READY`(생성·턴 모두).
2. **제안 채택 종류**: `ADD_WORD`(→ WordEntry source=TUTOR)·`ADD_STUDY_LOG`(→ StudyLog origin=ACCEPTED + StatsSnapshot DAILY, 한 트랜잭션)만. 나머지 kind 채택은 `400 FEATURE_NOT_READY`. 30일 지난 제안은 읽기/채택 시 `EXPIRED`(채택 `409`).
3. **ADD_STUDY_LOG 제안**은 LLM 이 아니라 **코드가** 표현 점검 완료 시 1건 만든다(payload: 채팅 id·메시지 수·교정 수·`summaryKo`·`focus` — 점검 총평을 잡 경로에서도 잃지 않게 여기 보관).
4. **A3 >20건 잡**: 별도 워커 없음 → `infra/jobs` 최소판(AiJob 생성·상태 전이·조회) + **같은 Node 프로세스 백그라운드 실행**. 기동 시 오래된 `RUNNING`/`QUEUED` → `FAILED`. 한 채팅에 진행 중 점검(메모리 락 또는 QUEUED/RUNNING 잡)이 있으면 `409`.
5. **점검 입력 상한 초과**(40건·8,000자): 예외 대신 **오래된 메시지부터 빼고 최근 것만 점검**, 응답에 `skippedMessages` 표시(prompt-engineer 가 `buildChatReviewRequest` 조정).
6. **stale PENDING**: 기동 시(`src/instrumentation.ts` `register`, nodejs 런타임) + 조회 시 지연 정리 — **180초보다 오래되고 메모리 락이 없는** `PENDING` 강사 메시지만 `FAILED`(blue/green 전환 중 다른 인스턴스 턴을 죽이지 않게 시간 조건 필수).
7. **Trace 최소판**: `engine/trace` 에 `newTraceId()`(`t_`+base62, 22자)·`recordTrace()`(RequestTrace 1행, 단계 ms 만, 원문·응답 전문 없음). 콘솔 연동은 task-005b.
8. **교정 채택 단어장 추가**: learning `vocab/words.createWord(userId, input, tx?)` 최소판(#41 검증 한도·같은 surface `409 {existingId}`)만 이번에 만든다. 단어장 화면·목록 API 는 task-008.

### 구현 전략 (6층)
- **L2 conversation**: `chats/`(create·list·get(running=PENDING 존재)·messages(after·limit)·update·delete, 소유자 아니면 NotFound) · `orchestrator/`(runTurn·resumePending·사용자당 턴 1 = 메모리 락 + 트랜잭션 안 `Chat` `SELECT … FOR UPDATE` 후 사용자 PENDING 확인·sweep) · `turnContext`(preferences 프로필 + learning `getErrorStats` top3 → `LearnerHeader`, 창은 기존 `window`) · `review/`(A3 동기/잡, Correction PROPOSED + `reviewedAt` + ADD_STUDY_LOG 제안 **한 트랜잭션**) · `corrections/`·`proposals/`(상태 전이만: `updateMany where status=PROPOSED` → 0행이면 409, **`original` 은 어떤 UPDATE 에도 넣지 않음**).
  - **Correction.original 저장값 = 서버가 가진 원문**(TALK: 이번 `text` / REVIEW: 메시지 전체 또는 `splitJaSentences` 로 찾은 서버 쪽 문장) — 모델 문자열을 그대로 쓰지 않는다.
- **L3 learning**: `vocab/words.createWord` · `learningHistory.recordErrorStat/getErrorStats`(pattern = `chunk:<chunkType>` 또는 `general`) · `studyLog.recordStudyLog(…, tx)` · `snapshots` DAILY 증가(출석이 쓰는 DAILY 형식과 합치기).
- **트랜잭션 조합**: 채택은 한 트랜잭션(Correction ACCEPTED + 선택 WordEntry + `savedWordId` + LearnerErrorStat). 방식은 developer 재량 — ① 라우트가 infra 트랜잭션 헬퍼로 tx 를 열어 두 모듈에 전달 ② conversation 이 콜백으로 learning 쓰기를 받음. 단 **conversation 이 learning 쓰기 함수를 import 하지 않고, 라우트가 prisma 를 직접 import 하지 않는다**(ESLint 허용 목록 변경 시 Developer 기록에 명시).
- **L5 engine**: `trace` 최소판(위 7). LLM 은 기존 `llm.completeJson` 만.
- **L6 infra**: `jobs`(AiJob 최소판·백그라운드 실행·기동 정리), 필요 시 트랜잭션 헬퍼·SSE 헬퍼(`: ping` 15s, `X-Accel-Buffering: no`).
- **app 라우트**(얇게): `/api/v1/chats`(GET·POST) · `chats/[id]`(GET·PATCH·DELETE) · `chats/[id]/turns`(POST SSE, 요청 끊겨도 처리 계속) · `chats/[id]/review` · `corrections`(GET) · `corrections/[id]/{accept,reject}` · `proposals`(GET) · `proposals/[id]/{accept,reject}` · `jobs/[id]`. 턴 분당 12회 `429`.
- **화면**: designer 가이드(`docs/screens.md` AI 채팅 절)대로 `/study/ai` 채팅 목록·채팅방·점검 결과·교정 카드(원문|교정 나란히, 채택/무시)·단어 추가 시트·제안 카드. 회화 탭은 task-007 전까지 준비 중 안내. SSE 는 `fetch` 스트림 파싱(EventSource 는 POST 불가), 끊기면 `GET /chats/:id` 폴링.
- **입력 안전**: 길이는 코드포인트 기준(`Array.from`), 제어문자 제거 후 공백만이면 400, `preview`(120)·`title`(100) 자를 때 서로게이트 쌍을 깨지 않게. 이모지는 그대로 저장(utf8mb4).
- **응답에 엔진명·모델명·toolLog 없음**(개발자는 traceId 로). 오류는 기존 `toErrorResponse` 매핑 재사용.

### 작업 분배
| 역할 | 담당 파일/기능 | 순서 |
|---|---|---|
| designer | `docs/screens.md`(신규) — AI 채팅 절: 경로·목록·채팅방·입력창·진행/실패/끊김 상태·점검 결과·교정 카드·단어 추가 시트·제안 카드·빈 상태, 360/390/412 규칙·문구 | 1 (PE 와 병렬) |
| prompt-engineer | `src/modules/conversation/prompts/chatReview.ts`(상한 초과 시 최근분만 + skipped 수), 점검 픽스처(여러 문장·이모지·오류 없는 메시지 섞인 8~12건) + Claude CLI 실측(지연·dropped·오탐) → 필요 시 A3/A2 문구 조정, 단위 테스트 갱신 | 1 (병렬) |
| judge | C1(설계 확정 직후)·C2(reviewer PASS 직후) codex_gate | 2, 5 |
| developer (**Opus**, judge intake) | 위 L2·L3·L5·L6·라우트·화면 전부 + 단위 테스트 + `tests/live/task006-smoke.sh`(QA 계정 2개로 IDOR 포함) | 3 |
| reviewer | 6층 경계·IDOR·락·트랜잭션·original 불변·엔진명 누출·SSE 끊김 처리 감사 | 4 |
| codex | C2 판정 시(R2 → 개입 예정) 읽기 전용 외부 검토 | 5 |
| qa | 아래 완료 기준 실행 검증 | 6 |

### 완료 기준 (qa 실행 확인)
1. tsc 0 · lint 에러 0 · 단위 테스트 전부 통과 · build 0.
2. CHAT 턴 SSE 이벤트 순서 `accepted → status… → done`, DB 에 USER DONE + ASSISTANT DONE, `Chat.messageCount` +2·`lastMessageAt`·`preview` 갱신.
3. 같은 사용자 동시 턴 2개 → 하나는 `409 CONFLICT {runningMessageId}`. 1분에 13번째 턴 → `429`.
4. `accepted` 직후 클라이언트가 끊어도 서버가 끝까지 처리 → `GET /chats/:id` 가 `running=false`·강사 메시지 DONE.
5. 점검: 오류 섞인 메시지 → Correction PROPOSED 생성, **모든 `original` 이 해당 메시지 전체 또는 그 문장 하나와 바이트 일치**(SQL 대조), `reviewedAt` 설정, 두 번째 점검 `409 ALREADY_REVIEWED`, 사용자 메시지 0 이면 400.
6. **채택 전 행 0**: 턴·점검 전후 `WordEntry`·`StudyLog`·`StatsSnapshot`·`LearnerErrorStat` 행 수 변화 0.
7. 교정 채택(addWord 포함) → WordEntry(source=CORRECTION, sourceRefId=교정 id) 1행 + LearnerErrorStat +1, 재채택 `409`, 거절 → REJECTED, **채택·거절 전후 `original` 동일**.
8. ADD_STUDY_LOG 채택 → StudyLog(origin=ACCEPTED) 1행 + DAILY 스냅샷 갱신, 재채택 `409`. ADD_WORD 채택 → WordEntry(source=TUTOR).
9. **IDOR**: 두 번째 QA 계정으로 첫 계정의 채팅 조회·수정·삭제·턴·점검·교정/제안 채택·거절·잡 조회 → 전부 `404`.
10. **이모지**: `今日は😀楽しかった🎉` 턴·이모지 제목 → 500 없음, 저장값 바이트 동일, preview 자르기에서 깨진 문자 없음.
11. 검증: 빈 문자열·공백/제어문자만·1,001자 → 400, ASK 생성 → `400 FEATURE_NOT_READY`, `utteranceId` 없는 `REALTIME_STT` → 400.
12. 사용자 응답(JSON·SSE)에 엔진·모델명(`claude|haiku|sonnet|opus|qwen`)·`toolLog` 0건.
13. 화면 360/390/412: 가로 넘침 0, 터치 ≥44px, 입력창·전송 버튼 가시(실기기 키보드는 NOT_VERIFIED 허용 — 사용자 폰 확인 항목).
14. CHAT 턴 10회 지연 p50 기록(예산 20s).

### 네이티브 변경 / APK 재설치
없음(웹만). APK 재설치 불필요.

### 설계 확정 (Leader, 2026-09-27 — designer §3-11 확인 10건 + PE 발견 1건)
- **D1 resumePending**: 마지막 강사 메시지가 `PENDING`(락 없음) **또는 `FAILED`** 면 그 앞 사용자 메시지로 재실행한다(강사 행을 `PENDING` 으로 되돌려 재사용, 사용자 행은 새로 만들지 않음). 둘 다 아니면 `409`. → api-contract #32 갱신.
- **D2 #29 페이지**: `after` 없으면 **최근 `limit`(기본 50)건을 오름차순**으로 주고 `nextCursor` = 그보다 오래된 쪽 커서(`?cursor=` 로 이전 메시지). `after` 있으면 그 id 이후 오름차순. → api-contract #29 갱신.
- **D3** 동기 점검은 클라이언트가 떠나도 서버가 끝까지 처리·저장한다(재방문 시 #34 + ADD_STUDY_LOG payload 로 복원).
- **D4** ADD_STUDY_LOG payload 에 `strengths`·`skippedMessages` 도 넣는다(`summaryKo`·`focus`·메시지 수·교정 수와 함께).
- **D5** #34 `chatId` 필터 시 정렬 = 메시지 순서(메시지 createdAt asc → 교정 createdAt asc). `chatId` 없으면 `createdAt desc`.
- **D6** 409 details: 단어 중복 `{existingId}`, 만료 제안 `{status:'EXPIRED'}`, 이미 처리 `{status:'ACCEPTED'|'REJECTED'}`.
- **D7 전역 변경 4건 승인**: viewport `interactiveWidget: 'resizes-content'`, `:lang(ja)` 규칙, 채팅 하위 경로 TabBar 숨김, `api.ts apiStream`. 단 viewport 변경은 **기존 설정 화면 키보드 동작도 QA 3폭 확인 대상**에 넣는다.
- **D8 범위 밖 발견**(이번에 고치지 않음, backlog): `infra/http.ts` 기본 문구 "AI 엔진…"(채팅 화면은 코드별 문구표로 차단), `Badge` warn·accent·`ink3` 라이트 명암비 미달, `ComingSoon` 의 Phase/task 번호 노출.
- **D9 빈 채팅 정렬**: `createChat` 이 `lastMessageAt = createdAt` 으로 채운다(목록 정렬 `lastMessageAt desc` 그대로, NULL 정렬 문제 제거).
- **D10** 서버 제어문자 제거는 `\n`·`\t` 를 보존한다(그 외 C0/C1·DEL 제거). 저장된 `content` 가 이후 모든 바이트 비교의 기준.
- **D11 점검 항목별 드롭(PE 발견)**: `checkChatReview` 를 `extraCheck` 로 그대로 쓰면 위반 1건에 **응답 전체가 유실**된다 → 금지. 규칙: 위반이 있으면 **1회만** 재시도하고, 재시도 뒤에도 남은 위반 항목만 버린다(`dropped` 카운트). 정상 항목은 반드시 남긴다. 구현(예: `completeJson` 에 "재시도 후 남은 extraCheck 위반은 던지지 않고 마지막 데이터와 위반 목록을 돌려주는" 옵션, 또는 라우트 쪽 항목 필터 + 1회 재호출)은 developer 재량, reviewer 확인. 저장 `original` 은 D-원칙대로 서버 원문.

## 판단 기록 (judge)
- [2026-09-27] intake engine=jev(jev-1.13.0, 첫 실제 호출) → task_type=feature(conf 1.00) / complexity=2.97(conf 0.97, 4단계 중 Hard) / needs_info=0.38(아님) / risk=R2(high 0.96) / developer_model=**opus** / next=assign | overrides=- | fallback=- | tokens=1031($0.000043), 325ms
  - Leader 해석: R2 는 Jev 판정(규칙 경로 매칭 없음) — 교정 원문 무수정·채택 전 저장 0·IDOR·턴 잠금이 데이터 무결성·권한 영역이라 타당. `leader.md` R2 보강 기준(`Correction.original`)과도 일치. → C2 에서 규칙상 Codex 개입(R2), 한도 미기록이어도 R2 는 허용.
- [2026-09-27 10:58] codex_gate/C1 engine=jev → codex_required=true(concurrency 0.94) / mode=adversarial-review / budget=CX-limit-unknown-r2 | overrides=- | fallback=- | tokens=1102

## Codex 검토

## Designer 기록
- [10:51] 2026-09-27 AI 채팅 구현 가이드 작성 → `docs/screens.md`(신규: §1 토큰·명암비 실측 / §2 화면 목록 / §3 AI 채팅). 목업 Artifact 는 만들지 않음(TheKaiwa 데모 없음 — 필요 시 Leader 요청으로 별도).
- [10:51] 경로: 홈 `/study/ai?tab=chat`(회화 탭은 task-007 전 "곧 열려요") → 방 `/study/ai/chat/[chatId]` → 결과 `/study/ai/chat/[chatId]/review`. 방·결과는 하단 탭 숨김 + `BackBar`, 방은 목록만 스크롤(flex 칼럼 `h-full`).
- [10:51] 턴 상태기계 `idle→sending→streaming→(detached)→idle|failed`, SSE 는 `api.ts apiStream`(fetch 스트림), 끊김은 #29 `after=` 폴링 2.5s→5s·200s 상한, 재시도는 항상 `{resumePending:true}`(bjj MasterPanel 방식). 보내기 버튼 `onPointerDown preventDefault`(키보드 유지)·IME `isComposing` Enter 무시.
- [10:51] 점검은 결과 화면이 소유(안내→점검 받기→동기/잡 폴링/409 재조회→결과), 재방문은 #34+ADD_STUDY_LOG payload 로 복원. 교정 카드 = 원문|교정 컨테이너 쿼리(카드 <320px 위아래)+코드포인트 diff 강조(표시만, 원문 무수정)+채택 시트(단어장에 넣고 채택 / 단어장 없이 채택만).
- [10:51] 오류 문구는 화면의 코드별 표로(서버 message 는 400 만) — `infra/http.ts` 기본 문구 "AI 엔진…" 누출 차단. 일본어 요소 전부 `lang="ja"` + `:lang(ja)` 폰트·`line-break:strict`, 일본어 블록 `break-keep` 금지.
- [10:51] Leader 확인 요청 10건(§3-11): resumePending 이 FAILED 포함인지 · #29 최근 50개+이전 커서 · 동기 점검 이탈 시 계속 처리 · ADD_STUDY_LOG payload 에 strengths·skippedMessages 추가 · #34 chatId 정렬 · 409 details · 전역 변경 4건(viewport interactive-widget·:lang(ja)·TabBar 숨김·apiStream) · 발견 이슈(http.ts 문구, Badge warn 2.60·accent 4.08·ink3 2.91 명암비 미달, ComingSoon 의 Phase 노출) · 빈 채팅 정렬 · 줄바꿈 보존.
- [10:51] 20-Log 한 줄은 Leader 지시("다른 파일 수정 금지")에 따라 남기지 않음 — Leader 가 합칠 때 기록 바람.

## Prompt-Engineer 기록

- [11:20] **A3 입력 상한**(`src/modules/conversation/prompts/chatReview.ts`): `ReviewTooLargeError` 던지던 것을 제거하지 않고 **방어용으로만** 남기고, 정상 경로는 `trimToBudget()`(최근 메시지부터 채우고 넘치면 오래된 것부터 뺌, `window.buildWindow` 와 같은 방향)로 바꿨다. `buildChatReviewRequest(input): ChatReviewRequest`(= 기존 `LlmJsonRequest<ChatReviewResponse>` 를 그대로 확장 + `skippedMessages: number` 필드 1개 추가) — **래퍼로 감싸지 않았다**. 그래서 developer 는 기존 호출 관례 그대로 `const req = buildChatReviewRequest(input); const r = await llm.completeJson(req)` 를 쓰면서 `req.skippedMessages` 로 몇 건이 빠졌는지 읽으면 된다(응답 JSON 에 넣을지·로그만 남길지는 route 재량). 시스템 프롬프트도 "메시지 전부입니다" 로 거짓말하지 않게, `skippedMessages>0` 이면 "가장 최근 N건입니다(오래된 M건은 분량 상한으로 제외)" 로 바뀐다. `ReviewTooLargeError` 는 `kept.length===0 && messages.length>0`(메시지 1건조차 담을 수 없을 때)에만 던지는데, route 의 메시지 1건 길이 검증(≤1,000자)이 있는 한 정상 경로에서 도달하지 않는다 — export 이름은 유지했으므로 `src/modules/infra/http.ts` 의 `VALIDATION_ERRORS` 매핑은 그대로 유효(수정 안 함). `index.ts` 는 `ChatReviewMessage`·`ChatReviewRequest` 타입 export 만 추가.
- [11:20] **함정 기록(재발 가능)**: `checkChatReview` 를 `llm.completeJson` 의 `extraCheck` 로 넘기면, 항목 하나라도 인용 위반이면 **응답 전체**가 재시도되고 재시도 후에도 남으면 **`JsonSchemaError` 로 전체가 버려진다**(정상 항목까지 전부 유실). api-contract #33 이 말하는 "인용 불일치 항목만 버리고 dropped 카운트에 반영"(개별 항목만 드롭)은 이 경로로는 안 나온다 — developer 가 라우트에서 개별 항목 드롭을 구현하려면 `extraCheck` 를 더 관대하게 하거나(예: 스키마/파싱만 체크) 완료 후 라우트가 `isVerbatimQuote` 로 항목별로 걸러내는 방식이 필요하다. `structuredResponse/checks.ts`·`schemas.ts` 는 건드리지 않았고, 이 문단으로 developer/reviewer 에 판단만 넘긴다.
- [11:20] **픽스처**: `tests/prompts/fixtures/chat-review.json` — 합성 채팅 1건, 학습자 메시지 10건(cuid 모양 id, 오류 5·정답 5), 여러 문장짜리 메시지 2건(오류가 첫/둘째 문장에 각각 있는 경우), 이모지 메시지(`今日は😀楽しかったです🎉`, 정치가 확실하도록 です 포함), 조사·활용·경어 오류 섞음. `expectedFindings`(messageId·sentenceOriginal·errorType·expectedCorrected)·`cleanMessageIds` 로 검출률·오탐을 계산할 수 있게 함.
- [11:20] **실측**(`tests/live/chat-review-measure.ts`, 우분투 미러, connection `claude-cli-local`/sonnet, 3회 — 6회 상한 안): 실패 0, 지연 p50 **15,975ms** / max **16,852ms**(90s 예산 대비 여유 큼), 검출률 **5/5·5/5·5/5**(100%), errorType 일치 5/5·5/5·4/5(1건은 GRAMMAR 기대 대비 다른 분류 — 교정 자체는 정확, task-004 와 같은 "분류 기준 차이"), **오탐 0·인용 위반 0·no-op 교정 0·엔진명 누출 0** 전 런. 원문(`tests/prompts/fixtures/chat-review.json`)이 강력해서 **프롬프트 문구 조정 불필요**(90s 근접·검출 저조·오탐 없어 재설계 트리거 미해당). 원본 로그 `/tmp/kaiwa-chat-review-measure.json`.
- [11:20] A2(`chat.ts`) 이모지 1회 확인(스크래치 스크립트, 커밋 안 함): `今日は😀楽しかった🎉` → attempts=1(재시도 없음)·haiku·3.3s·JSON 정상·`correction:null` 유지. 문제 없어 **손대지 않음**.
- [11:20] 단위 테스트 `src/modules/conversation/__tests__/prompts.test.ts` 에 6건 추가(총 13건 chatReview/chat 관련 포함 conversation 스위트 17→ 전체 conversation 모듈 29 테스트 그린): 픽스처 sanity, 개수 상한(55건→40건, skipped 15), 문자 상한(20×500자→일부만, kept 는 연속 구간), 방어용 예외(단일 메시지 8,100자), 상수 회귀 가드. `npm test`(미러 `node --import tsx --test`) 29/29 pass, `tsc --noEmit` 0, eslint 0.

## Developer 기록

## Reviewer 기록

## QA 기록

## 최종 요약
