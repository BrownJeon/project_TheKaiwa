---
task_id: task-006
title: "AI 채팅 + 표현 점검 + 교정 채택"
status: done-deploy-pending
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

### 구현 중 Leader 판단 (2026-09-27, developer A 질의 5건)
- **L1** 턴 `done` 은 StatsSnapshot 을 바꾸지 않는다(완료 기준 6 우선). `chatTurns`/`talkTurns`·`corrections.proposed` 는 ADD_STUDY_LOG 채택, `corrections.accepted` 는 교정 채택이 증가 → domain-model DAILY 설명 개정.
- **L2** D1 재실행 대상 PENDING 은 **180초 지난 것만**(blue/green 에서 타 인스턴스 메모리 락 불가시 → 이중 LLM 방지) → api-contract #32 개정.
- **L3** 턴(A1·A2)에도 soft 후검증: 재시도 뒤 남은 위반은 CHAT 교정 null·TALK 원문 불일치 교정만 버리고 `status{warning:CORRECTION_ORIGINAL_MISMATCH}`·문장 수 초과는 수용(턴 실패보다 낫다) — 계약과 일치, 승인. prompt-engineer 는 task-007 회화 실측 때 경고 빈도를 본다.
- **L4** `utteranceId`·`lessonId`·`scenarioId` 는 `400 FEATURE_NOT_READY`(task-007·Phase 2 에서 연다) — 승인.
- **L5** 점검 Trace `kind=TURN, refType='chatReview'`, #29 `learning` 은 `toolLog.meta` 에 저장(응답에는 `learning` 만 노출, toolLog 비노출) — 승인. TraceKind 에 REVIEW 추가는 task-005b 콘솔에서 판단.

- **L6** (REV-007 L2 종결) developer A "정본과 다르게 한 것" ①~⑬ 전부 승인: ①=L1 ②=L2 ③ CHAT 기본 제목 "새 채팅"(api-contract #28 개정) ④⑤=L4 ⑥⑧=L5 ⑦ toolLog 키 `connection`+`totalMs`·`meta` 를 정본으로 채택(domain-model 개정 — REV-007 M1 해소, task-005b 콘솔은 이 키를 읽는다) ⑨ `messageCount` 는 수락 tx 에서 +2(실패 턴도 두 행 유지) ⑩ #37 `chatId` 지정 시 limit 100 ⑪ 턴 저장 tx 내부 순서 ⑫ 분당 12턴은 거절 요청도 센다 ⑬ 단어 중복은 JS 바이트 일치(unicode_ci 가 は/ぱ·히라/가타를 같게 봐서). domain-model 의 stale 기준도 180초로 개정.
- REV-007 L1(메모리 rateLimit 이 blue/green 전환 창에서 최대 ~24/분)은 알려진 한계로 수용 — Redis 도입 논의 때 재검토.

## 판단 기록 (judge)
- [2026-09-27] intake engine=jev(jev-1.13.0, 첫 실제 호출) → task_type=feature(conf 1.00) / complexity=2.97(conf 0.97, 4단계 중 Hard) / needs_info=0.38(아님) / risk=R2(high 0.96) / developer_model=**opus** / next=assign | overrides=- | fallback=- | tokens=1031($0.000043), 325ms
  - Leader 해석: R2 는 Jev 판정(규칙 경로 매칭 없음) — 교정 원문 무수정·채택 전 저장 0·IDOR·턴 잠금이 데이터 무결성·권한 영역이라 타당. `leader.md` R2 보강 기준(`Correction.original`)과도 일치. → C2 에서 규칙상 Codex 개입(R2), 한도 미기록이어도 R2 는 허용.
- [2026-09-27 10:58] codex_gate/C1 engine=jev → codex_required=true(concurrency 0.94) / mode=adversarial-review / budget=CX-limit-unknown-r2 | overrides=- | fallback=- | tokens=1102
- [2026-09-27 11:58] codex_gate/C2 engine=jev → codex_required=true(concurrency 포커스) / mode=adversarial-review / budget=CX-limit-unknown-r2 | overrides=- | fallback=- | tokens=1142
  - **override**(Leader, 11:59): Codex 미호출 — 사용자 지시 "Codex 토큰 사용량이 없어 실패했을 수도 있다, 충전되면 한 번 더 확인". C1 재실행 + C2 는 한도 충전 후 재확인 대기(호출 차수 1/4 사용, 남은 3회). REV-007 이 동시성 Q1~Q3 을 코드 추적으로 확인(반례 없음)한 상태로 QA 진행.

## Codex 검토
### [2026-09-27 11:32] C1 adversarial-review focus=concurrency — 실패(Codex CLI 문법)
- judge 판정: 2026-09-27 10:58 codex_gate/C1 engine=jev → codex_required=true(concurrency 0.94) / 호출 차수: 1/4
- 대상: repo=/home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa base=77aead82(<task_file>) snapshot=cda3ea5e(<workflow_gen>)
- 실패 사유: Codex CLI 버전 또는 문법 불일치 — `codex exec review --commit <SHA>` 와 stdin(`-`)을 함께 사용할 수 없다는 오류 (exit_code=2, codex_exit_2). wrapper 커맨드 라인: `codex exec review -c sandbox_mode="read-only" --ephemeral --commit cda3ea5e… -o output.txt -` (stderr: "the argument '--commit <SHA>' cannot be used with '[PROMPT]'")
- 미검토 범위: **설계 전체 미검토** — Q1 동시성 턴 락·메모리 락·180초 stale 정리·blue/green 경합, Q2 resumePending 재실행·이중 LLM·폴링 경합, Q3 표현 점검 트랜잭션·채택 동시성·스냅샷 증가 검증 불가
- 재시도 조건: Codex CLI 버전 확인 및 래퍼 문법 수정 필요 (사용자 또는 infrastructure 담당)
- 기록 파일: `/home/brownjeon/NFS/homes/brownjeon/project/.claude/state/codex-review/runs/20260927T020209Z-task-006-C1/stderr.txt`
- Leader(11:40): 원인은 codex-cli 0.128.0 의 `exec review` 가 `--commit` 과 표준입력 프롬프트를 함께 받지 않는 것(0단계 미확인 항목). README 0단계 3항대로 워크스페이스 `.claude/tools/codex-review/config.env` 기본 모드를 **exec** 로 바꿨다(exec 모드 프롬프트가 `git diff base snapshot` 을 안내). 실패 정책(Q-A4)대로 C1 은 재실행하지 않고 구현으로 진행 — C1 재실행 여부는 사용자 결정. 동시성 질문 Q1~Q3 은 reviewer 감사 초점과 C2 Codex 인계 묶음에 그대로 넘긴다.
- Leader(11:50) **사용자 지시**: "지금 Codex 토큰 사용량이 없어 실패했을 수도 있다 — 토큰이 충전되면 한 번 더 확인하는 형태로 진행". → 이번 task 의 Codex 검토(C1 재실행 + C2)는 **한도 충전 후 재확인 대기**로 둔다. C2 에서 judge 가 `codex_required: true` 를 내도 호출하지 않고 `override: 사용자 지시(Codex 한도 소진, 충전 후 재확인)` 를 판단 기록에 남긴다. 참고: C1 실패 자체는 stderr 상 인자 오류(exit 2, 0초)라 한도 문제는 아직 드러나지 않았고, 설정은 exec 로 고쳐 두었다 — 재확인 때 한도와 exec 모드를 함께 검증한다.

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

### B(화면)
- [11:30] **파일**(커밋 `c6ff765`, 신규 41 · 수정 5 — task 이력서·20-Log 는 Leader 커밋 몫이라 제외). 신규: `src/types/chat.ts`(계약 DTO 미러) · `src/components/chat/`{`StudyAiHome`·`TalkComingSoon`·`ChatList`·`ChatListItem`·`PendingCorrectionsCard`·`NewChatSheet`·`ChatRoom`·`ChatRoomHeader`·`ReviewDoneBar`·`MessageList`·`MessageBubble`(User·Tutor·Pending·Failed·FailedLine·CorrectionChip)·`RoomIntro`·`ReviewNudge`·`TurnNotice`·`Composer`·`ChatMenuSheet`·`ChatReview`·`ReviewParts`(Intro·Progress·Summary)·`CorrectionCard`·`AcceptCorrectionSheet`·`ProposalCard`·`useChatTurn`·`useKeyboardInset`·`useNow`·`sse`·`diff`·`format`·`labels`·`messages`·`errors`·`storage`} + `__tests__/{sse,diff,format,messages,labels}.test.ts` · `src/components/common/Sheet.tsx` · `src/components/shell/BackBar.tsx` · `src/app/(app)/study/ai/chat/[chatId]/page.tsx`(auth + `getProfile().teacherName`) · `…/[chatId]/review/page.tsx`. 수정: `src/app/(app)/study/ai/page.tsx`(ComingSoon → AppBar "AI와 공부하기" + `StudyAiHome`, `searchParams` 로 탭) · `api.ts` · `TabBar.tsx` · `layout.tsx` · `globals.css`.
- [11:30] **전역 변경 4건(D7) 적용**: ① `layout.tsx` viewport `interactiveWidget:'resizes-content'` — **설정 화면 키보드도 QA 3폭 확인 대상** ② `globals.css` `:lang(ja)`(일본어 글꼴·`line-break:strict`) + `.no-scrollbar` ③ `TabBar` `HIDDEN_PREFIXES=['/study/ai/chat/']` 에서 null ④ `api.ts` `apiStream(path, body, {signal})` — 헤더·401 로그인 이동·봉투 오류 해석을 `send()` 와 공유하고 SSE 본문 스트림만 돌려준다(파싱은 `chat/sse.ts` — common→chat 의존 방지). 같이 `ApiError` 에 `details`·`retryAfterSec` 선택 필드 추가(생성자 뒤 인자 기본값 null, 기존 호출·동작 불변) — 409 `existingId`/`status`·429 초 분기용.
- [11:30] **가이드와 달라진 점(사유)**: ① DTO 는 가이드 `chat/types.ts` 대신 Leader 지시대로 `src/types/chat.ts` ② "남은 교정" 필터에서 **이번 방문에 처리한 카드는 남겨 둔다**(바로 사라지면 "채택했어요" 결과를 못 봄, 필터를 다시 누르면 정리) ③ 스트리밍 중 화면이 가려졌다 돌아오면 스트림을 버리고 폴링으로 전환(§3-3 표의 visibilitychange 행을 이렇게 구현 — 백그라운드에서 연결이 조용히 죽는 경우 대비) ④ 429 대기 기본 10초(`details.retryAfterSec`·`Retry-After` 둘 다 없을 때) ⑤ 점검 잡 폴링 상한 10분(가이드 미정) → 초과 시 "점검 상태를 확인하지 못했어요 [다시 확인]" ⑥ 재시도(resume) 성공은 `messageCount` 를 올리지 않음(새 행 아님) ⑦ 교정 카드 PROPOSED 에도 "선생님 제안이에요. 채택해야 저장돼요." 한 줄(§3-0 6 "모든 교정·제안 카드") ⑧ 제안 채택 후 토스트 추가 ⑨ `ChatReview` 는 선생님 이름을 쓰지 않아 review page 가 profile 을 읽지 않음 ⑩ 방·결과의 폴링 루프는 세대 토큰으로 중복 실행(개발 모드 이중 effect·[다시 확인] 반복)을 막음.
- [11:30] **원칙 점검**: 교정 원문은 trim·정규화 없이 그대로, diff 강조는 `<span>` 분할만(`diff.test` 가 "조각을 이으면 원문과 같다"를 이모지·줄바꿈·공백 포함 6케이스로 보증) · 채택/거절은 응답 후에만 반영(낙관적 갱신 없음) · 오류 문구는 `labels.ts` 표(400 만 서버 문구 — `labels.test` 가 422/502/504 등에서 서버 문구 "AI 엔진…" 이 새지 않음을 확인) · `traceId`·SSE `error.message` 는 렌더하지 않음 · 렌더 문구 grep(`claude|haiku|sonnet|opus|qwen|엔진|모델|trace|Phase|task-`) 0건(주석·식별자 제외) · 일본어 요소 전부 `lang="ja"`, 일본어 블록 `break-keep` 없음 · 터치 44px(읽기/번역 토글·칩·알약·점검 버튼은 `before:` 히트영역) · Badge 는 neutral/good/bad 만.
- [11:30] **검증**: `npm run typecheck` 0 · `npm run lint` 에러 0(내 파일 경고 0 — 남은 경고 6건은 기존 settings·login·A 의 `infra/text.ts`) · 단위 테스트 `src/components/chat/__tests__` 24/24(sse 7·diff 5·format 5·messages 4·labels 3, 미러에서 `node --import tsx --test`). `next build`·`dev` 는 지시대로 실행 안 함.
- [11:30] **확인 못 한 것(NOT_VERIFIED)**: 실제 렌더·360/390/412 가로 넘침·교정 카드 컨테이너 쿼리 전환(코드상 카드 내용폭 360→298·390→328·412→350, 기준 320)·44px 실측 — QA 헤드리스 확인 필요 / 실기기 키보드(`resizes-content`·visualViewport 보정·Gboard 일본어 IME 확정 Enter·보내기 후 키보드 유지·앱 WebView) / A 서버와의 실제 SSE 연동·폴링 / `prefers-reduced-motion`.
- [11:30] **A 와 합칠 때 확인할 계약 가정**: ① #32 성공은 `Content-Type: text/event-stream`(charset 붙어도 됨), `data:` 는 JSON 한 줄. 400/404/409/429/422/5xx 거절은 **스트림 열기 전 봉투** — SSE `error` 는 `accepted` 이후 실패만 온다고 가정(그 전에 오면 화면은 원문 복원 + #29 재조회) ② `done` 의 `assistantMessageId`·`conversation.{replyJa,replyReading,replyKo}`·`learning`·`endOfTopic`·`proposals[]`(`messageId` 없으면 이번 강사 메시지에 붙임) ③ resumePending 의 `accepted.assistantMessageId` = 실패 행 id 재사용(D1). 다르면 화면이 실패 행을 새 PENDING 으로 교체. 대상 없음 409 → 화면은 idle + 재조회 ④ 429 초는 `details.retryAfterSec` 또는 `Retry-After` ⑤ #29 `?limit=50`(after 없음 → 최근 50 오름차순 + 이전 `nextCursor`)·`?after=&limit=50`(폴링·visible 동기화)·`?cursor=&limit=50`(이전 메시지), 사용자 메시지에 `corrections[]` ⑥ #33 동기 `items[].correctionId`·`explanation`(또는 `explanationKo`)·`summaryKo/strengths/focus/skippedMessages/reviewedAt`, 잡 `{jobId}`. 409 는 "이미 점검됨/진행 중" 둘 다 — 화면이 #29 `reviewedAt` 으로 구분, 사용자 메시지 0 → 400 message 를 안내에 표시 ⑦ #34 `chatId` 필터는 메시지 순(D5), `status=PROPOSED` 항목에 `chat{id,title,kind}` ⑧ #35 409 `details.existingId`(단어 중복, 시트 유지) vs 그 외 409(처리됨, 재조회), 400 `details.field`(`addWord.meaning` 이든 `meaning` 이든 마지막 조각으로 매핑) ⑨ #37 `?chatId=`(상태 필터 없음 = 전부, EXPIRED 는 읽기 시 반영)·`?chatId=&kind=ADD_STUDY_LOG` payload `{messageCount, correctionCount, summaryKo, strengths, focus, skippedMessages}`(D4) ⑩ #38·#39 409 `details.status`(EXPIRED/ACCEPTED/REJECTED), ADD_WORD 단어 중복 409 `details.existingId`, `payloadOverride:{meaning}` ⑪ #55 `status`·`progress`, 404 → 채팅 상태로 판단 ⑫ `FEATURE_NOT_READY`·`ALREADY_REVIEWED` 는 `src/types/api.ts` `ApiErrorCode` 에 없다 — 화면은 HTTP status 로만 분기해 영향 없음(공유 타입이라 손대지 않음, 추가는 A/Leader 판단).

### A(서버)
- [11:43] **파일**(커밋 `0b124b7`, 51개 — task 이력서·20-Log 제외). 라우트 13개: `src/app/api/v1/chats/route.ts`(#27·#28) · `chats/[id]/route.ts`(#29·#30·#31) · `chats/[id]/turns/route.ts`(#32 SSE) · `chats/[id]/review/route.ts`(#33) · `corrections/route.ts`(#34) · `corrections/[id]/{accept,reject}` · `proposals/route.ts`(#37) · `proposals/[id]/{accept,reject}` · `jobs/[id]`(#55) + `src/instrumentation.ts`. conversation 신규: `chats/{index,validate}` · `orchestrator/{index,locks,shape,stream}` · `review/{index,filter}` · `corrections/{index,serialize}` · `proposals/index` · `turnContext.ts` (+`index.ts` export). learning 신규: `vocab/words`(createWord·parseWordInput) · `learningHistory`(recordErrorStat·getErrorStats) · `snapshots`(DAILY 병합·증가) · `studyLog`(recordStudyLog·recordAcceptedChatLog·recordCorrectionAccepted) · `topics`(getTopicRef 읽기). engine: `trace/index`(newTraceId·recordTrace) 신규, `llm/index`·`json/schemaValidate`(softExtraCheck) 수정. infra 신규: `tx`(withTransaction·lockUserRow) · `text`(코드포인트·제어문자·그래핌 자르기) · `pagination` · `sse` · `jobs`, `http`(FEATURE_NOT_READY·ALREADY_REVIEWED·classifyError·429 Retry-After) 수정. `src/types/api.ts` ApiErrorCode 2개 추가(Leader 허락). 테스트: `src/modules/{infra,engine,conversation,learning}/__tests__/` 4파일 + `tests/live/{task006-smoke.ts,task006-smoke.sh,qa-session.ts(QA_ACCOUNT=2),README.md}`. 기존 `prompts/**`·`structuredResponse/**`·`window/`·`persona/` 는 **수정 안 함**.
- [11:43] **D11 구현**: `LlmJsonRequest.softExtraCheck`(기본 false — 기존 호출 동작 불변, 단위 테스트 2건으로 고정). true 면 `runJsonWithRetry` 가 extraCheck 위반 시 **1회만** 재시도하고, 남은 위반은 던지지 않고 `residualViolations` + 스키마를 통과한 시도 전부 `candidates` 를 돌려준다(재시도 호출이 실패하거나 스키마를 어기면 1차 응답으로 복귀 — 정상 항목 유실 없음, 스키마·파싱 위반은 기존처럼 JsonSchemaError). 점검은 `review/filter.mergeReviewCandidates`: 마지막 시도 항목을 하나씩 — `message_id` 가 점검 대상(최근 구간 kept) 밖·`isVerbatimQuote` 불일치·`corrected===original` 이면 그 항목만 버리고 `dropped`++; 앞선 시도의 정상 항목 중 마지막 시도가 다루지 않은 (메시지, 원문)은 살림; **저장 original = `serverOriginal()`(메시지 전체 또는 `splitJaSentences` 로 찾은 서버 쪽 문장)**; 메시지 순서로 정렬해 저장(D5). 턴(A1·A2)도 softExtraCheck — 남은 위반은 `orchestrator/shape`: CHAT 교정은 서버가 null, TALK 원문 불일치 교정은 버리고 `status{stage:PARSE, warning:CORRECTION_ORIGINAL_MISMATCH}`, **문장 수 3 초과는 그대로 받음**(이전 동작은 턴 실패 — prompt-engineer 확인 요청).
- [11:43] **트랜잭션 조합(방식 ①)**: 라우트가 `infra.withTransaction`(READ COMMITTED·maxWait 5s·timeout 15s·P2034 교착 2회 재시도)으로 tx 를 열어 `conversation.acceptCorrection/acceptProposal(…, tx)`(상태 전이만) → `learning.createWord/recordErrorStat/recordCorrectionAccepted/recordAcceptedChatLog(…, tx)` 순서로 넘긴다. conversation 은 learning **쓰기 함수를 import 하지 않고**(읽기 `getErrorStats`·`getTopicRef` 만), 라우트는 prisma 를 import 하지 않는다. **ESLint 허용 목록 변경 없음.** 원문 보존: 교정 UPDATE 는 `corrections/index.ts` 의 `updateCorrections()` 한 곳뿐이고 데이터 타입이 `Omit<…, 'original'>` 이라 `original` 을 넣으면 컴파일 오류(`@ts-expect-error` 테스트 + 저장소 전체에서 `.correction.update*(` 가 그 파일에만 있는지 보는 테스트). DAILY 증가는 `INSERT … ON DUPLICATE KEY UPDATE id=id` → `SELECT … FOR UPDATE` → 병합 UPDATE(호출자 tx), 오류 통계는 `ON DUPLICATE KEY UPDATE count=count+1` 한 문장.
- [11:43] **동시성 자기 점검(Q1~Q3) 결론**: 모든 쓰기 트랜잭션은 **사용자 행 `FOR UPDATE` 를 먼저** 잡는다(수락·턴 저장·점검 점유·점검 저장·교정/제안 채택·단어 저장 — 잠금 순서 사용자→채팅→행으로 통일해 교착 고리 제거, 남는 교착은 P2034 재시도).
  - Q1 서로 다른 채팅 동시 턴: 같은 프로세스는 메모리 락(userId 키, globalThis — 라우트 번들이 달라도 하나)이 즉시 409. **두 프로세스(blue/green)** 는 둘 다 메모리 락을 통과하지만 수락 tx 의 사용자 행 잠금에서 직렬화 → 뒤쪽이 앞쪽의 PENDING(커밋됨, 젊음)을 보고 409 `{runningMessageId}`. 채팅 행 잠금만으로는 채팅이 다르면 둘 다 통과하는 반례가 있어 사용자 행 잠금을 추가했다. stale 경계: PENDING 은 180초 초과 **그리고** 이 프로세스가 돌리지 않을 때만 FAILED — 턴 예산(CHAT 20s·TALK 12s)상 살아 있는 턴은 180초를 넘지 못하므로 다른 인스턴스 턴을 죽이지 않는다. 기동 정리도 같은 나이 조건. 만에 하나 늦게 끝난 턴은 저장이 `(id, status=PENDING, createdAt=pendingSince)` 조건부라 FAILED/재실행된 행을 덮지 못하고 SSE `error{CONFLICT}` 로 끝난다.
  - Q2 resumePending: 살아 있는 PENDING(이 프로세스 실행 중이거나 180초 이내)은 사용자 단위 PENDING 확인에서 409 — **D1 의 "PENDING(락 없음)" 을 "180초 넘은 PENDING" 으로 좁혔다**(다른 인스턴스의 메모리 락은 보이지 않아 즉시 재실행하면 LLM 이중 실행·이중 저장 위험). 재실행은 같은 강사 행을 `PENDING` + `createdAt=now`(새 pendingSince = 이번 실행 표식)로 되돌리고 사용자 행·messageCount 는 그대로. 동시 resume 두 건은 메모리 락/사용자 행 잠금으로 하나만. 폴링(GET)의 지연 정리는 180초 초과만 건드려 재실행 행과 경합하지 않는다.
  - Q3 점검: 채팅 행 `FOR UPDATE` tx 에서 reviewedAt·진행 중 잡을 확인하고 AiJob 을 만든다 — **동기 경로도 잡 행(RUNNING)을 만들어** 프로세스가 달라도 두 번째 요청이 409 `{jobId}`. 저장은 `updateMany(where reviewedAt IS NULL)` 가 먼저라 어떤 경합에서도 교정 묶음·ADD_STUDY_LOG 는 한 번만. 채택 동시 요청: `updateMany where status=PROPOSED` 한 건만 이기고 진 쪽 tx 는 통째로 롤백(단어·오류 통계·스냅샷 없음). 스냅샷 이중 증가: 증가는 전이에 이긴 tx 안에서만, 교착 재시도는 전이까지 함께 재실행되므로 이중 증가 없음. → 라이브 재확인(아래) 4항목 PASS.
- [11:43] **스모크 결과**(`bash tests/live/task006-smoke.sh 3011`, 미러 `next dev -p 3011`, QA 계정 2개): **41/41 PASS**. 항목: 2 SSE 순서 `accepted→status(PROMPT|LLM|PARSE)→done` ×10·DB USER/ASSISTANT DONE·messageCount 20·preview·lastMessageAt ✅ / 3 다른 채팅 동시 턴 409 `runningMessageId` 일치·13번째 429·Retry-After 헤더+details ✅ / 4 accepted 직후 끊어도 running=false·강사 DONE ✅ / 5 점검 동기 items=5·dropped=0·**original 바이트 일치(SQL 대조)**·reviewedAt·재점검 409 ALREADY_REVIEWED·메시지 0 → 400·잡 경로(21건) `{jobId}`·진행 중 재요청 409 `{jobId}`·잡 DONE 후 #34·ADD_STUDY_LOG payload D4 키 ✅ / 6 턴·점검 전후 WordEntry·StudyLog·StatsSnapshot·LearnerErrorStat 0→0 ✅ / 7 addWord 채택 → WordEntry(CORRECTION, sourceRefId)·savedWordId·LearnerErrorStat +1·재채택 409·같은 표현 409 `{existingId}`(교정 PROPOSED 롤백)·거절·재거절 409·**채택·거절 전후 original 동일**·400 `details.field=addWord.meaning` ✅ / 8 ADD_STUDY_LOG → StudyLog(ACCEPTED, CHAT)+DAILY chatTurns·재채택 409·ADD_WORD → WordEntry(TUTOR, payloadOverride)·만료 409 `{status:EXPIRED}`·SET_LEVEL 400 FEATURE_NOT_READY ✅ / 9 IDOR 13경로(조회·수정·삭제·턴·resume·점검·교정 목록·교정 채택/거절·제안 목록·제안 채택/거절·잡) 전부 404·두 번째 계정 행 0 ✅ / 10 이모지 제목·턴 바이트 동일·preview 120 코드포인트·깨진 서로게이트 0 ✅ / 11 빈·공백/제어문자만·1,001자·utteranceId 없는 REALTIME_STT 400·ASK 400 FEATURE_NOT_READY·제목 101 → 400 ✅ / 12 JSON·SSE 전체에서 엔진·모델명·toolLog 0건 ✅ / TALK 교정 PROPOSED·original=서버 text 바이트 일치 ✅ / D1 DONE 이면 409·FAILED 면 같은 행 재사용 ✅. 사용자 행 잠금 추가 **후** 재확인(스크래치, 커밋 안 함): 다른 채팅 동시 턴 200/409 · 같은 교정 동시 채택 200/409·단어 1·오류통계 +1 · 같은 채팅 동시 점검 200/409·ADD_STUDY_LOG 1건 · ADD_STUDY_LOG 동시 채택 200/409·StudyLog 1·DAILY +1 한 번 — 전부 PASS. 스모크·재확인 데이터는 QA 계정 소유만, 끝에 정리. Claude CLI 총 19회(확인 1·스모크 16·재확인 2), JSON 재시도 0.
- [11:43] **턴 p50**: CHAT 10회 **5,318ms**(max 6,942ms, 예산 20s) — dev 서버 측정. CLI 자체 3.4~4.6s, 나머지 ~1.2s 는 서버측(수락 tx·컨텍스트(프로필·오류통계·이력)·저장 tx 의 NAS DB 왕복). TALK 5초 예산(task-007) 전에 줄여야 할 몫.
- [11:43] **검증**: `npm run typecheck` 0 · `npm run lint` 에러 0(경고 4건은 기존 settings·login 컴포넌트, 내 파일 0 — B 가 말한 `infra/text.ts` 경고는 불필요한 disable 주석 제거로 해소) · `npm test` 83/83 · 엔진명 grep(새 코드, 테스트 제외) 0건. `next build`·pm2 재시작 안 함, 3011 dev 서버는 종료.
- [11:43] **정본과 다르게 한 것·Leader 판단 요청**: ① domain-model §9-3 은 "`talkTurns` 는 턴 done 이 증가" 인데 완료 기준 6(턴 전후 StatsSnapshot 변화 0)과 충돌 → **완료 기준 우선**: 턴 done 은 스냅샷을 건드리지 않고, ADD_STUDY_LOG 채택 때 `chatTurns|talkTurns += 사용자 메시지 수`·`corrections.proposed += 교정 수`, 교정 채택 때 `corrections.accepted += 1`(§9-3 그대로) — 정본 정정 여부 결정 필요 ② D1 PENDING 재실행은 180초 초과만(위 Q2) ③ #28 기본 제목 CHAT = "새 채팅"(계약 문구 "새 회화" 는 TALK) ④ #28 `lessonId`·`scenarioId` 는 Chat 컬럼이 없어 non-null 이면 400 FEATURE_NOT_READY ⑤ #32 `utteranceId` 는 발화 API(task-007, speech 층) 전이라 400 FEATURE_NOT_READY ⑥ #29 `learning` 은 컬럼이 없어 `toolLog.meta` 에 두고 꺼내 준다(toolLog 는 미노출), `audio`·`utteranceId` 없음 ⑦ toolLog 키는 `connection`(connection key) — 계약 `connectionId` 와 이름만 다름 ⑧ 점검 trace 는 TraceKind 에 REVIEW 가 없어 `kind=TURN, refType='chatReview'` — 콘솔 턴 지표는 `refType='chatMessage'` 만 세야 함 ⑨ `messageCount` 는 수락 tx 에서 +2(실패 턴도 두 행이 남음, 재실행 +0), `lastMessageAt/preview` 는 수락(사용자 말)·done(강사 말) 두 번 ⑩ #37 `chatId` 지정 시 기본 limit 100 ⑪ 턴 저장은 한 tx 안에서 조건부 강사 DONE(가드)을 먼저 쓰고 교정·제안·Chat 순 — 외부에서 관찰되는 순서는 없음 ⑫ 분당 12턴 제한은 수락 전 거절(409 포함)도 센다 ⑬ 단어 중복은 **바이트 일치**(DB 콜레이션 unicode_ci 가 は/ぱ·히라/가타를 같게 봐서 후보만 DB 로, 판정은 JS).
- [11:43] **알려진 한계**: Claude CLI 는 프로세스당 직렬 큐라 동기 점검(sonnet 8~18s) 중에는 다른 채팅 턴이 기다린다(데드라인에 큐 대기 포함 — 잡 경로는 batch 레인) · 잡은 같은 프로세스 백그라운드라 재시작 시 진행 중 잡은 5분 뒤 stale → FAILED · 두 프로세스 실경합(blue/green)은 코드 경로·단일 프로세스 경합으로만 확인 · `instrumentation.ts` 기동 정리는 실행 여부를 따로 확인하지 못했다(dev 기동 로그에 오류는 없으나 정리 대상 0건이면 로그를 남기지 않음 — build·pm2 재시작 후 QA 가 오래된 PENDING 1건으로 확인 권장) · C1 Codex 가 못 본 Q1~Q3 은 위 결론으로 reviewer·C2 에 넘김.

## Reviewer 기록

### REV-007 (2026-09-27, 커밋 b5fa603 기준, base 77aead8)

**판정: PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 1 · Low 2.

**실행 검증**: `npm run typecheck` 0 · `npm run lint` 0 error(경고 4건은 task-006 무관 기존 파일) · `npm test` 83/83 pass(chat 컴포넌트 24건 포함) · `eslint.config.mjs` diff 없음(허용 목록 변경 없음, Developer 주장과 일치).

**동시성(최우선 검토, Q1~Q3 코드 추적)** — `orchestrator/index.ts`·`locks.ts`·`infra/tx.ts`·`review/index.ts`·`learning/snapshots/index.ts` 를 라인 단위로 추적한 결과, Developer A 의 Q1~Q3 결론을 **확인함**(반례 없음):
- 잠금 순서가 사용자(`lockUserRow` raw `SELECT…FOR UPDATE`) → 채팅(raw `FOR UPDATE`) → 행으로 모든 쓰기 트랜잭션(`acceptTurn`·`saveTurn`·`claimReview`·저장 tx·`acceptCorrection`·`acceptProposal`·`createWord`·`bumpDailySnapshot`)에 일관 적용되어 교착 없이 전역 직렬화 지점이 된다. 사용자 행 락은 트랜잭션 커밋까지 유지되므로, blue/green 두 프로세스가 동시에 같은 사용자의 서로 다른 채팅에 턴을 걸어도 두 번째 `acceptTurn` tx 는 첫 번째가 커밋할 때까지 대기했다가 READ COMMITTED 로 방금 커밋된 PENDING 을 보고 `409 {runningMessageId}` 를 받는다(반례 탐색: 채팅 행 락만으로는 서로 다른 채팅이 통과하는 반례가 실제로 존재해 사용자 행 락 추가가 필요했다는 Developer 주장이 코드로 확인됨).
- `resumePending`(D1/L2, 180초 조건)은 `acceptTurn` 의 "사용자 전체 PENDING" 선검사(라이브 PENDING 이 있으면 즉시 409)가 먼저 걸리므로, 살아 있는 다른 인스턴스의 턴을 리줌으로 덮어쓸 경로가 없다. stale sweep(`updateMany where status=PENDING`)과 리줌 판정이 **같은 트랜잭션** 안에서 일어나 자기 쓰기 가시성으로 정확히 맞물린다.
- `review/index.ts` Q3: `claimReview` 가 채팅 행 FOR UPDATE 를 잡은 채로 `reviewedAt`·`AiJob` 활성 여부를 확인·생성하므로, 두 프로세스가 동시에 점검을 걸어도 뒤쪽은 채팅 행 잠금 대기 → 커밋된 RUNNING AiJob 을 보고 409. 저장은 `updateMany(where reviewedAt IS NULL)` 선행이라 경합에서 진 쪽은 전체 롤백.
- `learning/snapshots/index.ts` `bumpDailySnapshot` 은 `INSERT…ON DUPLICATE KEY UPDATE id=id` → `SELECT…FOR UPDATE` → 병합 패턴으로, ADD_STUDY_LOG 채택과 교정 채택이 같은 날짜 행을 동시에 건드려도(서로 다른 제안/교정 id) 손실 갱신이 없음을 확인(각 tx 는 사용자 행 잠금까지 먼저 거치므로 이중 직렬화).
- `instrumentation.ts` 는 `NEXT_RUNTIME!=='nodejs'` 조기 반환으로 Edge/빌드 단계에서 DB 를 건드리지 않음을 확인. 기동 정리와 조회 시 지연 정리(`sweepStalePending`)가 같은 180초 기준을 공유해 정리 누락이 없다.

**원문 불변** — `corrections/index.ts` 의 `CorrectionUpdate = Omit<Prisma.CorrectionUncheckedUpdateManyInput, 'original'|'id'|'userId'|'chatId'|'messageId'>` 타입으로 컴파일 타임에 `original` UPDATE 를 막고, 저장소 전체에서 `.correction.update*(` 호출이 `updateCorrections()` 한 곳뿐임을 grep 으로 확인(raw SQL UPDATE 도 없음). `orchestrator/shape.ts`·`review/filter.ts` 모두 `original` 저장값을 모델 출력이 아니라 서버가 가진 원문(`serverOriginal()`/서버 `text`)에서만 취함을 확인. D11 소프트 재시도(`schemaValidate.ts runJsonSoft`)는 재시도 실패·예외 시 스키마를 통과한 1차 응답으로 안전 복귀함을 코드로 확인(기존 `completeJson` 기본 경로는 `softExtraCheck` 미지정 시 그대로 — 회귀 없음, 단위 테스트 `softExtraCheck.test.ts` 로도 고정).

**채택 전 행 0 / IDOR** — 라이브 스모크(`tests/live/task006-smoke.ts`)를 직접 읽어 주장을 검증: 5a 항목이 실제로 `Buffer.from(...).equals(...)` 로 DB `original` 과 서버 원문을 바이트 비교하고, 9번 항목이 두 번째 QA 계정으로 13개 엔드포인트(조회·수정·삭제·턴·재시도·점검·교정 목록/채택/거절·제안 목록/채택/거절·잡 조회)를 실제로 호출해 전부 404 및 `u2rows===0` 을 확인한다(코드만 읽고 신뢰한 것이 아니라 테스트 본문을 대조함). 13개 라우트 전부 `requireSession()` 뒤 `userId` 스코프 쿼리/`getOwnedChat` 을 거치는 것도 개별 확인.

**6층 경계** — `module-dependency.md` §3-1 행렬 대조: conversation→infra(prisma 직접 포함) 는 허용(✓, app 행만 제한), conversation→learning 은 쓰기 함수 import 없이 `getErrorStats`/`getTopicRef` 읽기만(확인: `conversation/index.ts`·`turnContext.ts`·grep 으로 learning 쓰기 함수 import 없음), 라우트는 `withTransaction` 을 통해서만 tx 를 열고 prisma 를 직접 import 하지 않음(라우트 11개 전수 확인). speech 참조 없음. `eslint.config.mjs` 무변경.

**엔진명 누출** — `src/app`·`src/components` 전체에 `claude|haiku|sonnet|opus|qwen|reazon|whisper|style-bert|home-m4` grep 0건(테스트·주석의 `CLAUDE.md` 문서명 언급 제외), `toolLog` 는 사용자 응답(JSON·SSE) 어디에도 직렬화되지 않음(`getChatDetail`/`serializeMessage` 가 `learningFrom()` 으로 필요한 필드만 추출). `labels.ts` 가 400 외 모든 상태코드에서 서버 `message` 를 화면에 노출하지 않게 차단.

**입력 안전** — `infra/text.ts`(`sanitizeText`·`codePointLength`·`truncateCodePoints`)가 D10 대로 제어문자 제거 시 `\n`·`\t` 보존, 짝 없는 서로게이트 치환, 그래핌 경계 자르기를 구현. `chats/validate.ts`(`parseTurnBody`·`parseTitle`)가 저장 전 항상 이 경로를 거치며, 저장된 `content` 가 이후 모든 바이트 비교의 기준이 되는 구조를 확인.

**SSE·화면** — `infra/sse.ts` 가 `X-Accel-Buffering: no`·15초 `: ping`·연결 취소와 무관한 처리 지속을 구현(턴 처리는 `startTurn` 이 스트림 생성 전에 이미 백그라운드로 분리돼 있어 SSE `cancel()` 이 처리를 막지 못함). 클라이언트 `chat/sse.ts` 파서는 `TextDecoder` 스트림 모드 + 라인 버퍼로 청크 경계(멀티바이트 문자·`\r\n` 분리)를 안전하게 처리(단위테스트 7건). `diff.ts` 는 표시 전용이며 조각을 이으면 원문과 동일함을 테스트가 보증.

**이슈**

| # | 심각도 | 내용 | 근거 | 권고 |
|---|---|---|---|---|
| M1 | Medium | `toolLog` 의 connection 키 이름이 정본과 다름 — domain-model.md `ChatMessage` 주석은 `{traceId, model, **connectionId**, sttMs, llmMs, ttsMs, ttsStartMs, promptChars, attempt}` 인데 구현(`orchestrator/index.ts:124` `saveTurn`)은 `connection`(+ `totalMs`·`meta` 추가 필드)을 씀. 현재는 `toolLog` 가 사용자 응답에 노출되지 않아 기능·보안 영향은 없지만, task-005b Admin Console 이 이 필드를 그대로 읽으면 어긋난다. | `docs/design/domain-model.md` ChatMessage 주석 vs `src/modules/conversation/orchestrator/index.ts:124-133` | Leader 가 정본 필드명을 `connection` 으로 개정하거나 구현을 `connectionId` 로 맞추는 결정을 task-005b 착수 전에 확정하고 domain-model.md 를 갱신 |
| L1 | Low | `infra/http.ts rateLimit` 이 프로세스 메모리 버킷이라 blue/green 롤링 배포 전환 중(두 프로세스 동시 기동) 사용자당 분당 12턴 상한이 사실상 최대 ~24/분까지 완화될 수 있음(전환 창에서만, 소프트 어뷰징 가드) | `src/modules/infra/http.ts:122-135` | 배포 계약서(정본)에 이미 알려진 한계로 기록되어 있으면 그대로 두되, Redis 등 공유 저장소 도입 논의 시 재검토 항목에 추가 권고 |
| L2 | Low | Developer A 가 남긴 "정본과 다르게 한 것·Leader 판단 요청" 13개 항목(2026-09-27 11:43 기록) 중 도메인 모델 텍스트 개정이 반영된 것(①)과 별개로, toolLog 키(⑦)·trace kind 매핑(⑧) 등 일부가 아직 Leader 의 명시적 승인 기록 없이 남아 있음(L1~L5 는 승인됨, 이후 ①~⑬ 목록은 미승인) | task 이력서 "Developer 기록 > A(서버)" 마지막 항목 | Leader 가 최종 요약 전에 ①~⑬ 를 검토·승인 기록으로 닫을 것을 권고(기능 결함은 아님) |

**QA 인계 high_risk_areas**:
1. blue/green 실제 2-프로세스 동시성은 코드 추적·단일 프로세스 재현으로만 검증됨(Q1~Q3) — 실제 두 pm2 인스턴스로 동시 턴 유발 테스트 가능하면 우선 권장.
2. 화면 360/390/412 실제 렌더·교정 카드 컨테이너 쿼리 전환·44px 터치 타겟은 Developer B 가 NOT_VERIFIED 로 명시(코드상 폭 계산만) — 헤드리스 확인 필요.
3. 실기기 키보드(`resizes-content`·Gboard 일본어 IME 확정 Enter·앱 WebView)는 NOT_VERIFIED.
4. A(서버)·B(화면)가 명세 가정으로 개발되어 실제 통합 배선(dev 서버 기동 후 브라우저로 SSE 스트림 수신) 미검증 — Developer B 가 "A 와 합칠 때 확인할 계약 가정" 12건을 남김, QA 가 실통합에서 확인 권고.
5. `src/instrumentation.ts` 기동 정리 로직은 실행 자체를 관찰하지 못함(정리 대상 0건이면 무로그) — pm2 재기동 후 오래된 PENDING 1건으로 실측 권고(Developer A 도 동일 권고).

**native_change**: false (android/·plugins/·capacitor.config.ts 변경 없음, 웹만).

## QA 기록

### QA-011 (2026-09-27, 커밋 b5fa603 기준, 미러 dev :3011)

**종합 판정: PASS(결함 0건)** — 기준 1~12·14·D1 전부 PASS(라이브 실행), high_risk (a)(b) 실측 PASS(코드 추적을 넘어 실프로세스로 재현), (c) 스모크 기준 4 로 겸함. 기준 13 은 화면 **레이아웃 레벨(정적 셸)만 PASS**, 하이드레이션 이후 상태(채팅 목록·메시지·교정 카드 등)는 이 세션의 Turbopack dev HMR 문제로 **NOT_VERIFIED**(아래 상세, task-006 코드 결함 아님 — 재현·근거 포함).

**실행 명령·수치**:
- `npm run typecheck` exit 0 / `npm run lint` exit 0(에러 0, 경고 4건 — 기존 settings 파일, Developer 보고와 일치) / `npm test` 83/83 pass, 0 fail (`node --import tsx --test`, 16개 `*.test.ts`).
- `bash tests/live/task006-smoke.sh 3011`(QA 계정 2개, 실 Claude CLI) → **41/41 PASS**, 턴 p50=5993ms·max=7375ms(예산 20s).

**기준별 대응표**(스모크 스크립트 본문 대조, `tests/live/task006-smoke.ts` 라인 참조):
| 기준 | 스모크 항목 ID | 결과 |
|---|---|---|
| 1 | (별도, npm run 3종) | PASS |
| 2 | `2 SSE 순서…`·`2 DB USER DONE…messageCount=20`·`2 목록 preview·lastMessageAt 갱신` | PASS |
| 3 | `3a 다른 채팅 동시 턴 409`·`3b 13번째 429`·`3c Retry-After` | PASS (+ high-risk b 실프로세스 재현) |
| 4 | `4 끊겨도 서버가 끝까지 처리` | PASS (+ high-risk c) |
| 5 | `5a~5f`(원문 바이트 SQL 대조·reviewedAt·409 ALREADY_REVIEWED·메시지 0→400·잡 경로 21건·ADD_STUDY_LOG payload) | PASS |
| 6 | `6a 턴 전후`·`6b 점검 전후` 행수 0 | PASS |
| 7 | `7a~7f`(WordEntry CORRECTION·재채택 409·중복 409 existingId·거절·original 불변·400 field) | PASS |
| 8 | `8a~8e`(StudyLog ACCEPTED+DAILY·재채택 409·ADD_WORD TUTOR·만료 409·미지원 kind 400) | PASS |
| 9 | `9 IDOR 13경로 전부 404` | PASS |
| 10 | `10a~10c`(이모지 제목·턴·preview 코드포인트) | PASS |
| 11 | `11 빈·공백/제어문자·1001자·REALTIME_STT·ASK·제목101` | PASS |
| 12 | `12 엔진·모델명·toolLog 0건`(leakHits, 스모크 전체 41건 대상 정규식 스캔) | PASS |
| 13 | (별도, 브라우저) | 부분 PASS·부분 NOT_VERIFIED — 아래 |
| 14 | `14 CHAT 턴 10회 p50` | PASS(p50 5993ms, 예산 20s) |
| D1 | `D1 마지막 강사 DONE→409`·`D1 FAILED→재사용` | PASS |

**high_risk 실측**(Reviewer REV-007 QA 인계 1~4번 대응):
- **(a) instrumentation.ts 기동 정리**: QA 계정에 180초보다 오래된(200초) PENDING 강사 메시지를 두 건 직접 생성(각각 lazy·startup 용 채팅). ① lazy: 서버 재기동 없이 `GET /api/v1/chats/:id` 한 번으로 해당 메시지가 `FAILED` 로 지연 정리됨을 확인(응답에 `status:"FAILED"`). ② startup: 어떤 라우트도 건드리지 않고 dev 서버(3011)를 kill 후 재기동 → 콘솔에 `[startup] stale 정리 — 강사 메시지 1건, 잡 0건` 출력, 재기동 직후(라우트 호출 전) Prisma 로 직접 조회해 해당 행이 이미 `FAILED` 임을 확인 — **기동 정리가 실제로 동작**함을 로그+DB 이중으로 검증(라우트 지연 정리와 섞이지 않게 분리). **PASS**.
- **(b) 두 프로세스 실경합**: `~/.node-local/thekaiwa` 를 하드링크로 복제한 `~/.node-local/thekaiwa-qa2`(node_modules 는 `cp -al`, Turbopack 이 프로젝트 루트 밖 심볼릭 링크를 거부해 심볼릭 링크는 실패함을 먼저 확인)에서 같은 `.env`(같은 NAS DB) 로 `next dev -p 3012` 를 **별도 프로세스**로 기동. 같은 QA 계정으로 서로 다른 두 채팅에 `curl` 두 개를 동시에(3011·3012 각각) 발사 → 3011 이 `200`+`accepted→…→done`(완료), 3012 는 즉시 `409 CONFLICT {"runningMessageId":"<3011 의 assistantMessageId 와 일치>"}`. Reviewer 는 코드 추적으로만 결론 냈던 것을 **실제 두 OS 프로세스**로 재현해 확인 — **PASS**(blue/green 실경합 검증 완료, QA 인계 1번 해소). 테스트 후 3012 프로세스·`thekaiwa-qa2` 미러 삭제 완료.
- **(c) SSE 끊김 후 처리 지속**: 스모크 기준 4(실 네트워크 abort, 코드 아님 — `AbortController` 로 `accepted` 직후 실제 연결 종료 후 폴링)로 겸함 — **PASS**. 별도 재실행은 Claude CLI 호출 절약을 위해 생략(스모크 자체가 이미 실사용자 시나리오로 검증).

**기준 13(화면 360/390/412) — 상세**:
- 도구 가용성 실측: `chrome-devtools-mcp`(headful) 는 이 세션에 X서버 없음(`Missing X server`) → 사용 불가 확인. `playwright` MCP(headless) 는 사용 가능 확인, `httpOnly` 세션 쿠키는 `page.context().addCookies()`(CDP 레벨, page JS 아님)로 주입 성공(서버 사이드 `auth()` 통과 확인 — /login 리다이렉트 없이 목표 라우트 그대로 진입).
- **환경 차단 발견**: Next 16 Turbopack dev 서버가 이 세션에서 클라이언트 하이드레이션을 완료하지 못함 — 부트스트랩 청크 2개(`node_modules_next_dist_20wefz_._.js`, `_1dhpc-u._.js`)가 최초 `<script>` 로드에서 간헐적 403, HMR WebSocket 핸드셰이크가 전부 `net::ERR_INVALID_HTTP_RESPONSE` 로 실패해 "재컴파일 완료" 신호를 못 받음 → 화면이 SSR 로딩 스켈레톤("불러오는 중…")에 영구 정체. **task-006 코드 결함이 아님을 3중 확인**: ① 동일 청크 URL 을 `curl`/`fetch` 로 직접 요청하면 항상 200 ② 실패한 `<script>` 를 나중에 DOM 재주입하면 로드는 성공하나(onload) 그래도 하이드레이션 미완료(WS 알림 부재가 원인, 바이트 문제 아님) ③ **task-006 과 무관한 기존 화면 `/settings` 에서도 완전히 동일한 증상 재현**(같은 두 청크 403, 같은 WS 실패, 같은 무한 로딩) — 이번 task 가 만든 회귀가 아니라 이 세션의 dev 서버/헤드리스 브라우저 조합 환경 이슈로 결론.
- **정적(SSR) 셸에서 실측 가능했던 항목**(360/390/412 세 폭 × 홈·채팅방·점검 결과·설정 4화면):
  - 가로 스크롤 0(`scrollWidth === clientWidth`) 전 조합 — **PASS**
  - 렌더된 텍스트에 엔진명(`claude|haiku|sonnet|opus|qwen|reazon|whisper|style-bert`) 0건 — **PASS**
  - D7 TabBar 숨김: 채팅방·결과 화면 본문에 탭 라벨(회화/오늘/계획표/서랍장/질문) 없음, 홈·설정에는 있음 — **PASS**
  - `BackBar` `←` 링크 정확히 44×44px(`getBoundingClientRect`) — **PASS**
  - `Segmented`(회화/채팅 탭) 알약은 보이는 높이 36px 이지만 `::before` 히트영역이 `getComputedStyle(el,'::before')` 로 44px·`position:absolute`·수직 중앙 확인 — 문서화된 "보이는 크기≠누르는 크기" 패턴이 실제로 44px 를 만족(최초 bounding-box 스캔에서 36px 로 오탐했던 것을 `::before` 계산값 확인 후 정정) — **PASS**(기존 공용 컴포넌트, task-006 신규 아님)
  - 다크/라이트 토큰 반전: `body` 배경 계산값 라이트 `rgb(246,247,244)` / 다크 `rgb(20,24,22)`(`prefers-color-scheme`) — **PASS**
- **NOT_VERIFIED**(하이드레이션 필요, 위 환경 차단으로 이 세션에서 불가): 채팅 목록·메시지 버블·RoomIntro 빈 상태 렌더 / 교정 카드 컨테이너 쿼리 전환(360 위아래 vs 390·412 나란히) / Composer·보내기 버튼 44×44 실측 / 읽기·번역 토글·가로 칩·새 메시지 알약 등 동적 요소 터치 타겟 / IME 확정 Enter·`useKeyboardInset`·`interactive-widget` 실동작 / 교정문 XSS 리터럴 렌더 확인(교정 카드가 마운트돼야 가능) / `/settings` 키보드 회귀(레이아웃 개형 외 실동작).
- **권고**: 이 화면 항목들은 실기기(S25+ Chrome) 또는 이 헤드리스 문제가 없는 세션에서 재확인, 또는 배포 후 실제 운영 빌드(Turbopack dev 가 아닌 production build)에서 `post_deploy_checks` 의 360/390/412 확인으로 커버.

**실기기 확인 필요(NOT_VERIFIED, 사용자 폰)**: Gboard 일본어 IME 확정 Enter 미전송, 보내기 후 키보드 유지, `resizes-content`+`visualViewport` 보정 실동작, 앱 WebView(Capacitor, task-003 이후) 키보드 동작 — app-conversion-guide §4 항목과 겹침, task-007/003 이후 함께 재확인 권고.

**QA 데이터 정리**: 스모크 자체 생성분(자동 정리, cleanup() 로그 확인) + 제가 만든 화면용 픽스처 채팅 1건(교정 2·제안 1 포함) + high-risk (a) 용 stale 테스트 채팅 2건 + high-risk (b) 용 race 테스트 채팅 2건 + 스크립트 시행착오로 남은 채팅 3건 = 총 **8건 채팅 삭제**, `qa-bot`·`qa-bot2` 모두 `chats:0`(WordEntry·StudyLog·StatsSnapshot·LearnerErrorStat·AiJob 0 유지) 재확인 완료. `~/.node-local/thekaiwa-qa2`(2차 dev 서버 미러) 삭제, 3011·3012 dev 서버 모두 종료. 산출물 정리: Playwright 스냅샷·콘솔로그 22개 삭제(스크린샷 이미지는 없음 — `filename`/`filePath` 미사용).

**Claude CLI 사용**: 스모크 41항목 내 약 17~19회 + 제 프로세스 경합 실측 1회(승자 턴 완료) = 총 20회 내외(상한 30 이내).

## 최종 요약

### 최종 요약 (Leader, 사용자용 — 2026-09-27)
**무엇이 생겼나**: 하단 "회화" 탭에 **AI 채팅**이 생겼습니다. 채팅을 만들어 일본어로 대화하면 선생님이 일본어로 답합니다(읽기·한국어 번역 포함, 대화 중에는 교정 없음). 대화를 마치고 **[표현 점검]** 을 누르면 선생님이 틀린 문장을 한 번에 짚어 주고(원문 | 교정 나란히, 설명·오류 유형), 카드마다 **채택/무시**를 고를 수 있습니다. 채택할 때 단어장에 넣을지 고를 수 있고, 점검이 끝나면 "오늘 공부 기록 남기기" 제안이 하나 뜹니다. **AI 가 만든 것은 채택해야만 저장**됩니다. 회화(음성) 탭은 task-007 전까지 준비 중 안내입니다.

**검증**: reviewer REV-007 PASS_WITH_NOTES(Critical·High 0, Medium 1 은 정본 개정으로 해소) → QA-011 **PASS(결함 0)** — 단위 테스트 83/83, 라이브 스모크 41/41, 교정 원문 바이트 일치·채택 전 다른 테이블 행 0·타인 리소스 13경로 404·이모지 저장 정상·응답에 엔진명 0건, **실제 두 서버 프로세스 동시 턴 경합**(한쪽만 수락·다른 쪽 409)과 **재기동 시 멈춘 응답 정리**까지 실증. 채팅 턴 응답 p50 **약 5~6초**(예산 20초), 표현 점검 p50 약 16초.

**⚠ 운영 반영 대기(사용자 결정)**: 통합 빌드는 성공했지만 **`pm2 restart thekaiwa` 가 권한 정책(운영 배포)으로 거부**됐습니다. 빌드가 운영 프로세스가 쓰는 미러 `.next` 를 이미 덮어써서, 재시작 전까지 운영 화면이 어긋난 상태일 수 있습니다(확인 불가). 커밋 3건 이상이 origin 에 push 되지 않았습니다.

**⚠ Codex 검토 실패·보류 내역**: C1(설계) — Codex CLI 0.128.0 의 `exec review` 가 `--commit` 과 표준입력 지시를 함께 받지 않아 0초 만에 실패(인자 오류) → 워크스페이스 래퍼 기본 모드를 exec 로 수정. C2(리뷰 후) — judge 가 Codex 필요로 판정했으나 **사용자 지시로 한도 충전 후 재확인 대기**(override). 검토하지 못한 범위: 동시성 설계·구현 전체(대신 reviewer 코드 추적 + QA 실프로세스 경합으로 확인). 호출 차수 1/4 사용.

**남은 확인(사용자)**: 실기기(S25+) 채팅 화면 — Gboard 일본어 IME 확정 Enter 가 전송되지 않는지, 보내기 후 키보드 유지, 키보드가 입력창을 가리지 않는지, 360/390/412 실제 렌더(헤드리스 dev 서버에서 하이드레이션이 안 돼 정적 셸만 확인됨 — 운영 빌드 반영 후 재확인 권장).

**범위 밖 발견(backlog)**: `infra/http.ts` 기본 오류 문구 "AI 엔진…", 공용 `Badge` warn·accent·`ink3` 라이트 명암비 미달, `ComingSoon` 의 Phase/task 번호 노출(설정·오늘 등 기존 화면).
