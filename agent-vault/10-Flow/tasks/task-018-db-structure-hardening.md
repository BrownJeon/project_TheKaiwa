---
task_id: task-018
title: "DB 구조 보강 3건 — 발화 1개=메시지 1개 제약·감사 범위 LEXICON·사전 버전 rollbackOf (db push + 코드)"
status: in-progress
base_ref: 878717f
risk_level: R2
roles_involved: [leader, developer, reviewer, qa, deployer]
related_tasks: [task-007-talk-voice-web, task-003g-lexicon-admin, task-009-release-cutover]
tags:
  - type/task
  - domain/db
  - domain/speech
  - domain/admin
aliases:
  - DB 구조 보강
  - task-018
created: 2026-09-28
updated: 2026-09-28
---

## 목표 (Leader)
사용자 지시(2026-09-28): **"db구조 변경도 진행해줘"** — Leader 가 설명한 3건(모두 추가만 하는 변경, 사용자 승인 = 공유 DB `prisma db push` 승인)을 적용한다.

| # | 변경 | 지금(코드로만 막음) | 적용 후 |
|---|---|---|---|
| ① | `Utterance.chatId String?`(+인덱스) · `Utterance.chatMessageId @unique` | task-007 C1-2: 수락 전 `chatMessageId IS NULL`·10분·조건부 updateMany·사용자당 턴 락. 티켓의 chatId 는 저장 안 함 | DB 가 "녹음 1개 = 메시지 1개" 를 보장(unique), 발화가 만들어진 대화방(chatId)을 저장해 턴 연결 시 **같은 방인지** 검증 |
| ② | `enum ConfigScope` 에 `LEXICON` 추가 | task-003g ⑯: 사전 감사 `AuditLog.scope=null` + `action='lexicon.*'` | 사전 감사 `scope=LEXICON` — 콘솔 변경 이력에서 범위로 필터 |
| ③ | `PronunciationLexiconVersion.rollbackOf Int?` | task-003g ⑮: 되돌림은 `changeSummary` 문장("v7 로 되돌림: 이유")으로만 | 되돌림 원본 버전 번호를 칸으로 — 버전 화면에서 "v7 로 되돌림" 링크 |

## 관련 과거 이력 요약
- [[task-007-talk-voice-web]] C1-2 판정·K6: `speech/utterances/turn.ts`(수락 전 검사·조건부 연결), 턴 라우트 훅, gateway internal 콜백 본문 `chatId?`(파싱만 하고 저장 안 함), #21 업로드(온디바이스 — 003f `OnDeviceSttClient` 가 wav 업로드), domain-model §8 #17 제안.
- [[task-003g-lexicon-admin]] ⑮⑯: `speech/tts/lexiconStore.ts`·`admin/speech/lexicon.ts` 감사·버전, 버전 화면(`VersionRow`·`VersionDetailSheet` — `changeSummary` 파싱 없이 표시), 스냅샷 무결성(Codex C2).
- [[task-009-release-cutover]]: 운영은 blue/green 릴리스·`APP_ENV=PRODUCTION`. **DB 는 개발·운영 공유** — `db push` 는 즉시 운영에 반영된다. 순서는 **백업 → db push(추가만) → 코드 배포**(옛 코드는 새 칸을 모르고도 동작: 칸 추가·nullable·enum 값 추가. ② 는 새 코드가 LEXICON 을 쓰기 시작하기 전까지 옛 코드가 그 값을 읽을 일이 없다 — 배포 뒤에만 기록됨).

## Leader's Plan
1. **백업(Leader)**: `mysqldump`(`DATABASE_URL` 에서 접속 정보 — 값 출력 금지) → `DATA_ROOT/backups/thekaiwa-<ts>-pre-task018.sql.gz`(600). 복원 명령 기록.
2. **사전 점검(developer)**: ① unique 를 걸기 전 `chatMessageId` 중복(비 null) 0건 확인, ② 기존 enum 값·행 영향, ③ 기존 버전 행 영향.
3. **스키마(developer)**: `prisma/schema.prisma` 3건 + 주석(domain-model §8 #17 해소 표시), `domain-model.md`·`api-contract`(필요 시) 갱신. **`prisma db push` 는 Leader 가 백업 확인 뒤 실행**(developer 는 `prisma validate` 와 `prisma migrate diff --from-url <DB> --to-schema-datamodel prisma/schema.prisma --script` 로 적용될 SQL 을 미리 보여 줄 것 — 파괴적 변경 0 확인, 접속 문자열 출력 금지).
4. **코드(developer)**:
   - ① 발화 생성(internal 콜백 = gateway TURN 티켓의 chatId, #21 업로드 = 요청의 chatId 필드 — 온디바이스 클라가 보낼 수 있게 계약 확인·추가) 시 `chatId` 저장(소유자 검사된 방만), 턴 연결 시 `utterance.chatId` 가 있으면 **턴의 chatId 와 같아야** 함(다르면 409 `UTTERANCE_OTHER_CHAT` 또는 404 — 정본에 정하고 기록), unique 위반(P2002)은 `UTTERANCE_USED` 로 수렴. chatId 가 없는 옛 발화(null)는 기존 규칙대로.
   - ② 사전 감사 `scope=LEXICON`, 콘솔 History 범위 필터에 LEXICON(라벨 "발음 사전") 추가.
   - ③ Rollback 시 `rollbackOf = 대상 버전 번호`, 버전 목록·상세에 "v{n} 로 되돌림" 표시(값 있을 때), `changeSummary` 는 그대로 유지.
   - 단위 테스트, 기존 스모크(task007·003g) 회귀.
5. **배포(Leader)**: Reviewer PASS → db push(백업 뒤) → QA → push → 운영 배포 → 운영 확인.

## 완료 기준
1. 백업 파일 존재(600)·복원 절차 기록, `db push` 로그에 추가 변경만(데이터 손실 경고 0).
2. ① unique 인덱스·chatId 칼럼, 다른 방 발화로 턴 → 거절, 같은 발화 두 번 → 409, 기존 스모크 통과.
3. ② 사전 변경 → AuditLog.scope=LEXICON, 콘솔 이력 필터 동작.
4. ③ Rollback → rollbackOf 기록·화면 표시.
5. tsc·lint·test, 운영 배포 ok·health ok.

## Developer 기록

## Reviewer 기록

## QA 기록

## Deployer 기록

## 최종 요약
