---
project: TheKaiwa
task: task-039
type: qa-record
tags:
  - type/qa-record
  - domain/qa
updated: 2026-10-11
---
# task-039 QA 기록 — 운영 `task006-smoke` 1회 (완료 기준 4)

> 이력서 본문 [[task-039-improve-tutor-explanation]] 은 수정하지 않는다. 이 파일에만 적는다.
> 승인: 사용자 2026-10-11, QA 계정 1·2번 쓰기 **정확히 1회**. 재실행하지 않았다.

## 판정

**완료 기준 4 중 「운영 스모크 006 유지」 = PASS (42/42).** 누출 0건, 서버 오류 0건, 행 수 전부 원복.
(기준 4의 나머지 「007 유지」·「새 필드가 로그·Trace·Export 에 학습자 원문을 새로 싣지 않음」은 이 1회의 범위가 아니다 — 실행하지 않았고 판정하지 않는다. `NOT_VERIFIED`.)

## 실행

- 위치 `~/.node-local/thekaiwa-predeploy`(`.env` APP_ENV=LOCAL → `qa-session.ts` 동작), 대상 `http://127.0.0.1:3010`(운영 pm2 `thekaiwa`, APP_ENV=PRODUCTION, 릴리스 `20261011-121420-0250368d`). `tests/live/task006-smoke.ts`·`qa-session.ts` 는 작업 트리와 diff 0.
- 쿠키: `QA_ACCOUNT` 1·2 만(권한 600, 값 미출력). 역할·소유자 계정 미사용.
- 명령: `BASE=http://127.0.0.1:3010 SMOKE_ENV=PRODUCTION node --env-file=.env --import tsx tests/live/task006-smoke.ts <쿠키1> <쿠키2> > smoke.log 2>&1` (백그라운드, 출력 파이프 없음).
- LLM 슬롯: 시작 시 운영 next-server 자식 `claude --print`(haiku) 1개가 7분 넘게 실행 중이어서 러너가 비어질 때까지 대기 → 135초 뒤 0개 확인 후 **2026-10-11 16:08:22 시작 → 16:12:39 종료(4분 17초)**, `exit=0`.

## 결과 원문 요약

`결과: 42/42 PASS · 턴 p50=4346ms` — FAIL 0건. 동시성 타이밍 검사 10c·3a·3b 도 이번엔 모두 PASS(흔들림 없음).

- 입력 검증 11(빈·공백·1,001자·REALTIME_STT utteranceId 없음 → 400 ×4, ASK 400, 제목 101자 400), 10a·10b 이모지 바이트 동일, D9.
- 턴: 2(SSE `accepted→status(PROMPT|LLM|PARSE)→done` ×10, messageCount 20), 14(**CHAT 턴 10회 p50=4,346ms · max 8,437ms**, 예산 20s), 4(accepted 직후 끊어도 서버가 끝까지 처리).
- 점검·교정: 5a(items=5, original 바이트 일치), 5b·5c(409)·5d, 5e(21건 → AiJob, 진행 중 재요청 409)·5f(잡 DONE, 교정 2·ADD_STUDY_LOG payload 키), 7a~7f(채택 시 WordEntry(CORRECTION)·LearnerErrorStat +1, 재채택·중복 409, 거절, original 불변, addWord 검증 400).
- 학습 원칙: 6a·6b(턴·점검 전후 WordEntry/StudyLog/StatsSnapshot/LearnerErrorStat 변화 0 — 오늘 DAILY 행 제외 규칙은 스크립트 내장), 8a~8f(ADD_STUDY_LOG 채택 → StudyLog(ACCEPTED), ADD_WORD, 만료 409, SET_LEVEL N5→N4 채택·값 이상 400).
- 보안: 9(타인 채팅·턴·재시도·점검·교정/제안 채택·거절·잡 13건 전부 404, QA2 행 0), 12(응답 JSON·SSE 에 엔진·모델명·`toolLog` **0건**, 누출 의심 줄 없음).
- TALK 턴 교정 PROPOSED·원문 바이트 일치, TALK 점검 400, D1 resumePending(409·FAILED 재사용), 3a~3c(동시 턴 409 runningMessageId 일치·13번째 429 + Retry-After).

## 서버 로그(pm2 `thekaiwa`, 16:08~16:13 창)

- 오류·예외 0건. `pm2-err.log` 에 1줄: `16:09:29 [json] 1차 응답 계약 위반 → 재시도(soft): conversation.replyJa 는 3문장 이내여야 한다` — 계약 위반 소프트 재시도로 다음 호출이 정상 완료(기존 동작, 신규 오류 아님).
- `[claudeCli]` 완료 17건: chat(haiku) 3.1~5.8s, chatReview(sonnet) 20.3s·12.4s, talk(haiku) 4.7s — 모두 attempt=1.
- 비밀 값 출력 없음.

## 행 수 전후 (QA1 `qa-bot` / QA2 `qa-bot2`)

`userId` 컬럼이 있는 전 모델 + `Profile.level` + LearnerErrorStat 합 + DAILY 스냅샷 data 로 비교.

| 시점 | 결과 |
|---|---|
| 실행 전 | QA1: AiJob 14 · Chat 3 · ChatMessage 64 · Correction 5 · TutorProposal 8 · LearningObservation 453 · Attendance 8 · StatsSnapshot 3 · LearnerErrorStat 2 · RequestTrace 281 (WordEntry·StudyLog·RepetitionItem 0), level N5. QA2: LearningObservation 27 · Attendance 2 · RequestTrace 61, level N5 |
| 스크립트 자체 정리 직후 | 차이: **QA1 LearningObservation +10, RepetitionItem +1** (나머지 전부 원복, level N5 복원, 오늘 DAILY 행 없음) |
| 수동 정리 후 | **전 모델 차이 0**, level N5/N5, LearnerErrorStat 합 3/0, DAILY 스냅샷 data 동일 → **원복 확인** |

- **수동 정리 내용**: 스크립트의 cleanup 목록(TutorProposal·Chat·WordEntry·StudyLog·StatsSnapshot·LearnerErrorStat·AiJob·RequestTrace)에 없는 두 표가 남았다. `userId` 가 QA1·QA2 이고 실행 창(`2026-10-11T07:08:22Z ~ 07:12:44Z`)에 생성된 행만 조건으로 삭제하되, 삭제 전에 대상을 열거해 창 내 10건(모두 QA1, `CORRECTION_PROPOSED/ACCEPTED/IGNORED`·GRAMMAR_PARTICLE)·1건(QA1, `EXPRESSION`/`Correction`)임을 확인했다 → `LearningObservation 10`, `RepetitionItem 1` 삭제. 다른 사용자 행에 닿는 조건 없음.
- `Profile` 행은 SET_LEVEL 시험으로 `updatedAt` 만 바뀌었고 level 은 N5 로 복원됨(값 비교로 확인).

## 후속 제안 (Leader 판단)

- `tests/live/task006-smoke.ts` `cleanup()` 에 `learningObservation`(`occurredAt`)·`repetitionItem`(`createdAt`) 정리를 더하면 수동 정리가 필요 없다. 교정 제안/채택/무시가 학습 관찰·반복 항목을 만드는 경로가 task-006 이후 추가돼 생긴 간극이다. 운영 스모크를 다시 돌릴 때 같은 잔여가 생기므로, 이번에 고치지 않았다(범위 밖·재실행 승인 없음).

## 정리 확인

- 쿠키 임시 파일 2개: 러너 트랩이 삭제, 디렉터리 확인 결과 0개. 스크래치 폴더(`before/after*.json`·`smoke.log`·`pm2win.txt`·스크립트) 기록 후 삭제.
- 띄운 서버·프로세스: 없음(3011·3012 비어 있음, 러너·대기 프로세스 종료). 운영 포트 3010 접속은 이 1회뿐. `pm2` 조작 없음(`pm2 logs --nostream` 읽기만).
- 코드·설정 수정 없음.
