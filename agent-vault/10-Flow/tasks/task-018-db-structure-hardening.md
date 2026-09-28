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
demo_gate:
  required: false
  level: "none"
  status: "not_required"
  version: 0
  repo_path: ""
  artifact_url: ""
  content_sha256: ""
  decided_by: "judge"
  rule_id: ""
  approved_by: ""
  approved_at: ""
  approval_quote: ""
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: false
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

## 판단 기록 (judge)
- [2026-09-28 14:45] intake engine=jev → task_type=structural · risk=R2 · developer_model=opus · next=assign | demo=none | overrides=- | fallback=- | tokens=1471
## Developer 기록
- [14:05] **사전 점검(읽기 전용 SELECT, 접속 정보 미출력)**: `Utterance` 0행(연결 0) → `chatMessageId` 비 null 중복 그룹 **0**, `chatId` 칼럼 없음, 인덱스 `Utterance_chatMessageId_idx`(비고유)·FK 보조 인덱스들. `AuditLog` 103행 전부 `scope=null`(그중 `lexicon.*` 75행 — 전부 LOCAL: create 25·import 15·update 15·disable 10·rollback 10). `ConfigurationVersion`·`RuntimeOverride` 0행. 세 테이블 `scope` 칼럼 = `enum('ENGINE_CONNECTION','FALLBACK_POLICY','PROMPT','APP_SETTING','VOICE_PROFILE','PRESET')`. `PronunciationLexiconVersion` LOCAL v1 ACTIVE 1·PRODUCTION v1 ACTIVE 1(되돌림 버전 0 — "되돌림" changeSummary 0행), `rollbackOf` 칼럼 없음.
- [14:15] **스키마**(schema.prisma = domain-model §3 블록 동시 수정, 기존 문서 차이 2줄 외 일치): ① `Utterance.chatId String?` + `chat Chat? @relation(onDelete: SetNull)` + `@@index([chatId])`, `chatMessageId @unique`(기존 `@@index([chatMessageId])` 는 unique 가 덮어 선언에서 뺌), `ChatMessage.utterances Utterance[]` → `utterance Utterance?`(1:1 — 코드 사용처 0), `Chat.utterances Utterance[]` ② `enum ConfigScope` 끝에 `LEXICON`(AuditLog 전용 주석) ③ `PronunciationLexiconVersion.rollbackOf Int?`. `prisma validate` OK, 미러 `prisma generate` OK(운영은 릴리스 디렉터리라 무관 — pm2 cwd 확인).
- [14:16] **적용될 SQL**(`prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` — URL 을 명령줄에 싣지 않고 .env 로):
  ```sql
  ALTER TABLE `AuditLog` MODIFY `scope` ENUM('ENGINE_CONNECTION','FALLBACK_POLICY','PROMPT','APP_SETTING','VOICE_PROFILE','PRESET','LEXICON') NULL;
  ALTER TABLE `ConfigurationVersion` MODIFY `scope` ENUM(… ,'LEXICON') NOT NULL;
  ALTER TABLE `PronunciationLexiconVersion` ADD COLUMN `rollbackOf` INTEGER NULL;
  ALTER TABLE `RuntimeOverride` MODIFY `scope` ENUM(… ,'LEXICON') NOT NULL;
  ALTER TABLE `Utterance` ADD COLUMN `chatId` VARCHAR(191) NULL;
  CREATE UNIQUE INDEX `Utterance_chatMessageId_key` ON `Utterance`(`chatMessageId`);
  CREATE INDEX `Utterance_chatId_idx` ON `Utterance`(`chatId`);
  ALTER TABLE `Utterance` ADD CONSTRAINT `Utterance_chatId_fkey` FOREIGN KEY (`chatId`) REFERENCES `Chat`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
  ```
  **파괴적 변경 0**: DROP 0·타입 축소 0·NOT NULL 신규 0(ConfigurationVersion/RuntimeOverride 의 NOT NULL 은 원래 값 재진술, enum 은 끝에 값 추가만). 옛 비고유 `Utterance_chatMessageId_idx` 는 diff 가 지우지 않는다(FK 보조로 남음, 무해 — domain-model §8 #17 에 기록). ⚠ **Leader 참고**: Prisma `db push` 는 unique 추가에 "If there are existing duplicate values, this will fail" 경고를 내며 비대화식이면 `--accept-data-loss` 를 요구할 수 있다 — 중복 0(행 0) 확인됐으니 데이터 손실이 아니라 그 경고다. push 직전 중복 0 재확인 SQL: `SELECT COUNT(*) FROM (SELECT chatMessageId FROM Utterance WHERE chatMessageId IS NOT NULL GROUP BY chatMessageId HAVING COUNT(*)>1) d;`
- [14:30] **코드 ①**: `speech/utterances/store.ts`(신규 — `utteranceDb` 진입점: 단위 테스트가 바꿔 끼움, Prisma 위임 객체는 mock.method 불가 실측) · `turn.ts` — `turnUtteranceProblem`(순수, 순서 USED → **OTHER_CHAT** → EXPIRED)·`checkUtteranceForTurn(userId, utteranceId, chatId)`·`linkUtteranceToMessage` P2002 → `{linked:false, warning:'UTTERANCE_USED'}`(count 0 = `UTTERANCE_LINK_SKIPPED`) · `index.ts` — #21·gateway 등록 모두 `chatId` 저장, P2003(방·사용자 사라짐) → 404(#21 은 wav 도 삭제) · 라우트: #21 소유 확인을 `getChatDetail`(stale 정리 쓰기 포함) → `getOwnedChat`(읽기 1회), internal 콜백에 `getOwnedChat(input.userId, input.chatId)`(아니면 404 → gateway 4xx 재시도 없음·`_orphan`·클라 글자 턴 — gateway README §4 에 한 줄), #32 가 `id` 를 넘기고 Trace `UTTERANCE_LINK.warning` = 결과 warning. 온디바이스 클라(`OnDeviceSttClient`·`onDeviceUpload`)는 이미 현재 방 `chatId` 를 보내고 있어 변경 없음(확인).
- [14:32] **코드 ②③**: `admin/speech/lexicon.ts` — `lexiconAuditEntry()`(scope `'LEXICON'`, 순수 함수로 추출) · `lexiconStore.writeLexicon` 새 버전 `rollbackOf = op.kind==='ROLLBACK' ? 대상 : null`, `LexiconVersionRow.rollbackOf` · DTO `LexiconVersionDto.rollbackOf`(칸 값) + `restoredFrom` = `rollbackOf ?? 감사 after.restoredFrom`(호환) · `src/types/admin.ts` `ConfigScopeName` 미러에 LEXICON + `AUDIT_SCOPE_LABELS = { LEXICON: '발음 사전' }`. **콘솔 History 화면·#137 감사 API 는 아직 없다**(menu `history` phase 2) — 범위 필터는 화면이 생길 때 이 라벨을 쓰고, `scope=LEXICON` 이 옛 행(`scope=null`+`lexicon.*`)도 잡아야 한다는 규칙을 api-contract #137 에 적음(감사 행은 append-only 라 backfill 하지 않음). Effective/Configuration 엔드포인트는 SCOPES 목록에 LEXICON 이 없어 400(계약 §2-23 한 줄).
- [14:35] **문서**: domain-model(§3 블록·§4 Utterance/AuditLog/LexiconVersion 행·§6 Chat 삭제 SetNull·§8 #5 보강·**#17 해소**) · api-contract(#21 chatId·#32 utteranceId OTHER_CHAT·P2002·§2-23 LEXICON 400·#137 LEXICON 필터 규칙·사전 감사 scope·LexiconVersionDto rollbackOf·Rollback 결과) · module-dependency §4-1(라우트가 getOwnedChat 조합) · gateway README §4.
- [14:38] **테스트**: 신규 `speech/__tests__/task018.test.ts` 6건(방 판정·순서·수락 전 검사 404/409·연결 P2002 수렴·gateway/#21 chatId 저장·P2003 404+wav 삭제 — 보존 정리는 `__kaiwaUtterancePurgeAt` 로 막아 실 DB 무접촉) + `admin/__tests__/lexicon.test.ts` LEXICON 감사 행 1건 + `lexiconAdmin.test.ts` 버전 전이에 `rollbackOf` 단언(일반 null·되돌림 1). `integrity.test.ts` 픽스처에 `rollbackOf:null`. **npm run test 503(502 pass·1 skip·0 fail) · typecheck 0 · lint 0 error**(경고 5 = 기존 settings/diagnostics 화면, 이번 변경 무관) · 엔진명 diff grep 0.
- [14:40] 🚫 **화면 파일 BLOCK(데모 검토 게이트)** — `node ../.claude/tools/demo-gate/check.mjs check --task agent-vault/10-Flow/tasks/task-018-db-structure-hardening.md` → `DEMO_GATE_BLOCKED` / `reason: task frontmatter 에 demo_gate 가 없습니다. Leader 가 judge intake 결과로 check.mjs init 을 먼저 실행해야 합니다.` → `src/components/**` 4파일을 **고치지 않았다**. 적용할 변경은 패치로 준비·검증만(미러에 적용해 tsc 0·eslint 0·lexicon 화면 테스트 33 pass 확인 후 미러 원복): `…/scratchpad/screen-patch/task018-screens.patch`(62줄) — ① `talkCopy.ts` `UnsentReason` 에 `'utteranceOtherChat'` + 문구 1줄 「다른 대화에서 녹음한 말이라 목소리는 붙이지 못해요. 다시 보내면 글자로 보내져요.」, `TalkRoom.tsx` 409 `UTTERANCE_OTHER_CHAT` 를 USED/EXPIRED 와 같은 띠로(발화 id 없이 글자 턴) ③ `VersionRow.tsx` 상태 배지 옆 「v{n} 로 되돌림」 텍스트, `VersionDetailSheet.tsx` KeyValue 「되돌림: v{n} 로 되돌림」(값 있을 때, changeSummary 유지). 링크(원본 버전 열기)는 행 전체가 버튼이라 중첩 불가 — 필요하면 designer 판단. **게이트 전 영향**: 서버가 409 `UTTERANCE_OTHER_CHAT` 을 내도 지금 클라는 모르는 사유라 "선생님이 아직 답하는 중" 띠 + 같은 발화 id 재전송(다시 409)이 된다 — 정상 UI 에서는 방을 옮기면 녹음 컴포넌트가 내려가 도달하기 어려운 경로.
- [14:42] **라이브 스모크(db push 뒤, Leader)**: `tests/live/task007-smoke.ts` 에 **K 절** 추가(K1 #21 chatId 저장·K2 다른 방 발화 409 `UTTERANCE_OTHER_CHAT`·행 0·K3 타인 방 chatId 업로드 404·K4 internal 콜백 chatId 저장·K5 타인 방 콜백 404·K6 같은 방 발화 턴 연결·K7 DB unique P2002, Claude CLI +1회). 실행: dev 서버를 미러에서 `node node_modules/next/dist/bin/next dev -H 127.0.0.1 -p 3011` → `bash tests/live/task007-smoke.sh 3011`(기존 A~I 회귀 + K). **task003g**: `bash tests/live/task003g-smoke.sh` 로 회귀(3r 은 restoredFrom 로 그대로 PASS 예상) + 수동 확인 2건 — `SELECT scope, action FROM AuditLog WHERE action LIKE 'lexicon.%' AND createdAt >= <스모크 시작>` 전부 `LEXICON`, 되돌림으로 만든 버전 `SELECT version, rollbackOf, changeSummary FROM PronunciationLexiconVersion WHERE environment='LOCAL' ORDER BY version DESC LIMIT 3` → 되돌림 행 `rollbackOf` = 대상 번호·나머지 null(003g 스모크는 끝에 QA 버전을 지운다 — 확인은 스모크 중 또는 `/lexicon/versions` 응답 `rollbackOf`). task003e-smoke D 절(internal 콜백, chatId:null) 회귀 PASS 예상.
- [14:47] 커밋 **f96bf42**(21파일, push 안 함 — webhook 운영 배포 방지). 이력서·20-Log 는 미커밋(Leader 백업 기록과 함께 Leader 가 커밋). 남은 것: Leader `check.mjs init`(judge intake) → 통과 시 화면 패치 적용·재검증(별도 커밋), db push(백업 뒤, unique 경고 → `--accept-data-loss` 필요할 수 있음), push 뒤 라이브 스모크 K 절.

- [14:48] **데모 게이트 재확인** `check.mjs check --task …task-018…` → `DEMO_GATE_PASSED` / `status: not_required` / `demo: 필요 없음(judge 판정 none)`. 준비한 화면 패치를 NFS 에 적용(dry-run 통과 뒤) + 화면 단위 테스트 2건(`integrity.test.ts` 되돌림 표시 행·머리, 신규 `talk/__tests__/unsentCopy.test.ts` OTHER_CHAT 문구) → 커밋 **b8c506e**(6파일).
- [14:50] **라이브 스모크(미러 dev `next dev -H 127.0.0.1 -p 3011`, APP_ENV=LOCAL, SMOKE_ENV 미설정)**: `bash tests/live/task007-smoke.sh 3011`(DEV_PID·DEV_LOG 지정) → **46/46 PASS**(A~I 회귀 + K1~K7: #21 chatId 저장·다른 방 409 UTTERANCE_OTHER_CHAT·타인 방 404·internal 콜백 chatId 저장·타인 방 콜백 404·같은 방 연결·DB P2002). 정리 확인: QA 계정 Utterance 0·Chat 0.
- [14:52] `bash tests/live/task003g-smoke.sh 3011` 1차 **52/53 — FAIL 3b**: 스모크가 옛 계약 `a1.scope === null` 을 단언(003g 당시 규칙) — task-018 ② 의 **의도된 변경**이라 기대값을 `'LEXICON'` 으로 갱신하고 3r(`rollbackOf` = 대상)·3r2(DB 칸: 되돌림 버전만 값)·3s(이번 감사 전부 LEXICON) 추가(tests/** 는 QA 영역이지만 계약 변경에 따른 기대값 갱신이라 함께 — 커밋 **44e9d3e**). 30초+ 뒤 2차 **54/54 PASS**. 원복 확인(LOCAL 버전 1·항목 6).
- [14:52] **수동 확인 2건**(읽기 전용): ② 1차 스모크 시작 뒤 `lexicon.*` 감사 8행 전부 `scope=LEXICON`(create 3·update 1·disable 1·import 2·rollback 1 = 기대 8). ③ 스모크가 끝에 QA 버전을 지우므로 도는 동안 250ms 폴링 기록: v2~v8 `rollbackOf=null`, **v9 `rollbackOf=1`**(「v1 로 되돌림: QA 되돌림」, changeSummary 유지). 2차 스모크 3r2 가 같은 내용을 자동 단언.
- [14:53] dev 서버 PID 3074939(자식 next-server 3078994) 종료 확인 — **3011 비어 있음**, 운영 3010 무관. 미러의 임시 확인 스크립트는 scratchpad 로 옮김. **npm run test 505(504 pass·1 skip·0 fail) · typecheck 0 · lint 0 error(경고 5 기존)**. push 안 함.

## Reviewer 기록

### REV-026 (2026-09-28, f96bf42 + b8c506e + 44e9d3e)

**판정: PASS** (Critical 0 · High 0 · Medium 0 · Low 2) — push(=운영 배포) 전 **반드시 고칠 것 없음**. 7영역 전부 검토, DB 는 읽기 전용으로 실측 대조(스키마=DB 상태 대조 §1) 포함.

**① 스키마=DB 실제 상태 일치(실측, 읽기 전용)** — 미러에서 `information_schema` 직접 조회: `Utterance.chatId` varchar(191) NULL·`chatMessageId` varchar(191) NULL 확인, 인덱스 `Utterance_chatId_idx`(비고유)·`Utterance_chatMessageId_key`(UNIQUE, NON_UNIQUE=0)·옛 `Utterance_chatMessageId_idx`(비고유, 잔존 — Deployer 기록과 일치, 무해) 3개 모두 존재, FK `Utterance_chatId_fkey → Chat` DELETE_RULE=`SET NULL`(schema.prisma 와 일치), `AuditLog`·`ConfigurationVersion`·`RuntimeOverride`.scope enum 셋 다 끝에 `LEXICON` 추가만(값 제거·타입 축소 0), `PronunciationLexiconVersion.rollbackOf` int NULL, 중복 `chatMessageId` 그룹 **0**(unique 적용 안전). Deployer 기록의 SQL 미리보기·적용 결과와 완전히 일치. 파괴적 변경 없음.

**② 보안·정합(발화↔방)** — `#21`(`src/app/api/v1/speech/utterances/route.ts`)·internal 콜백(`src/app/api/internal/speech/utterances/route.ts`) 둘 다 저장 전 `conversation.getOwnedChat(userId, chatId)`(index-only import, module-dependency 위반 없음)로 소유 확인 후 저장 — 타인 방이면 두 경로 모두 404, 단위 테스트(`task018.test.ts` P2003 케이스)·라이브 스모크 K3·K5 로 실측 확인. internal 콜백의 `chatId` 는 gateway 가 WS 티켓 클레임에서 꺼내 보내는 값인데, gateway 쪽(`speech/gateway/kaiwa_gateway/connection.py:177`)이 애초에 "start 메시지의 chatId ≠ 티켓의 chatId" 를 4401 로 거절하고 콜백 본문(`connection.py:379`)도 `self.claims.chat_id`(검증된 티켓 클레임)만 쓰므로, 앱 쪽 `getOwnedChat` 재확인은 신뢰 사슬 위의 방어 심화(defense-in-depth)이지 클라이언트 입력을 그대로 믿는 구조가 아니다 — 안전. 턴 판정 순서(`turnUtteranceProblem`: USED → OTHER_CHAT → EXPIRED)는 코드·`task018.test.ts`·api-contract 문서가 정확히 일치. `linkUtteranceToMessage` 의 count-0(경합)·P2002(unique 위반) 모두 턴은 계속하고 Trace 경고만 남기는 설계는 K7(라이브, DB 레벨 P2002 실제 재현)·단위 테스트로 검증됨 — 이 경로는 messageId 가 매 턴 새로 생성돼 실사용에서는 사실상 도달 불가능한 방어 코드이므로 "묵살" 이 아니라 적절한 선택. `#21`P2003(방 삭제 경합) → wav 삭제 후 404(`removeDataFile` 먼저, `isFkMissing` 뒤 판정) 코드·테스트 일치.

**③ 옛 코드 호환(배포 순서)** — 두 우려 모두 확인:
  - *unique 제약과 옛 `linkUtteranceToMessage`(try/catch 없음)*: `conversation/orchestrator/index.ts:325~328` 의 `onAccepted` 훅 호출이 이미 `.catch(e => ...HOOK_FAILED 경고로 강등)` 로 감싸여 있다 — 이 코드는 task-018 커밋 범위 밖(최근 수정 `6d8b3b1`, task-007, 2026-09-28 03:29 — task-018 14:44 보다 먼저, 즉 지금 운영 중인 옛 코드에 이미 포함). 따라서 unique 위반이 옛 코드에서 발생해도(현실적으로 messageId 가 매 턴 새로 생성돼 거의 불가능) 터짐 없이 경고로 흡수된다 — 위험 낮음, 실측 확인 완료.
  - *Chat 삭제 SetNull*: FK 규칙이 DB 레벨(`ON DELETE SET NULL`)이라 옛 Prisma 클라이언트가 실행하는 `deleteChat`(`DELETE ... WHERE id AND userId`)도 코드 변경 없이 그대로 안전 — 엔진이 처리, ORM 버전 무관.
  - *LEXICON enum 롤백 위험(Low 2 참고)*: 새 코드 배포 뒤 LEXICON 행이 쌓인 상태에서 task-018 이전 릴리스로 롤백하면, 그 옛 Prisma 클라이언트가 `scope` 칼럼을 폭넓게 select 하는 쿼리를 실행할 때 런타임 예외 가능성이 있다(Prisma 쿼리 엔진이 알 수 없는 enum 값을 만나는 경우). 그러나 **현재 코드 경로에는 그런 쿼리가 없다** — `findAuditsByTargets`(`src/modules/infra/audit.ts:65`)는 `scope` 를 select 에서 제외하고, `#137` 감사 목록 API 자체가 아직 구현되지 않았다(Phase 2). 지금 당장 막을 것은 없고, Low 로 기록.

**④ LEXICON 감사·rollbackOf** — `lexiconAuditEntry()`(scope 'LEXICON' 고정) 분리·테스트, `writeLexicon` 의 `rollbackOf: op.kind==='ROLLBACK' ? op.targetVersion : null` 코드·버전 전이 테스트(`lexiconAdmin.test.ts` — v2~v4 null, ROLLBACK v5 만 1) 일치. DTO `rollbackOf` 신설 + `restoredFrom` 호환 필드(`rollbackOf ?? 감사 after.restoredFrom`) 로 task-018 이전 되돌림 버전도 깨지지 않음. api-contract #137 에 "LEXICON 필터는 옛 scope=null 행도 함께 잡아야 한다" 규칙을 문서화했으나 History 화면·API 자체가 Phase 2 라 지금은 코드로 강제할 대상이 없음(문서만 있고 실제로 어기는 코드 없음 — 정상).

**⑤ 화면 패치(b8c506e)·데모 게이트** — `TalkRoom.tsx`/`talkCopy.ts` 는 `UTTERANCE_OTHER_CHAT` 을 기존 USED/EXPIRED 와 같은 "글자 턴으로 재전송" 띠에 자연스럽게 편입, `VersionRow`/`VersionDetailSheet` 는 `rollbackOf` 있을 때만 "v{n} 로 되돌림" 표시(changeSummary 유지) — 엔진명·model_id·speaker_id 노출 0(`878717f..HEAD` 전체 diff grep 재확인, engine/adapters·seed 밖 0건). 데모 게이트 독립 재실행: `node ../.claude/tools/demo-gate/check.mjs check --task TheKaiwa/agent-vault/10-Flow/tasks/task-018-db-structure-hardening.md` → `DEMO_GATE_PASSED`(status not_required, judge demo=none) — frontmatter 와 일치. `.claude/state/demo-gate/evidence.jsonl`·`prompts.jsonl` 에 task-018 관련 행이 전혀 없음을 확인했는데, 이는 정상이다(`gate.mjs` 주석: evidence.jsonl 은 approve·waive 성공 매칭만 기록 — not_required 판정은애초에 승인·유예 절차를 타지 않는다). 에이전트가 `.claude/state/demo-gate/` 를 직접 쓴 흔적 없음.

**⑥ 003g 스모크 기대값 개정(44e9d3e) 정당성** — 세 군데 모두 완화가 아니라 **강화**: 3b 는 `a1.scope === null`(옛 계약) → `=== 'LEXICON'`(새 계약, 더 엄격한 정확값 단언으로 교체, 느슨화 아님), 3r 은 기존 `restoredFrom` 단언에 `rollbackOf` 단언을 **추가**, 3r2 는 DB 칼럼 직접 대조를 **신설**(되돌림 버전만 값·나머지 null), 3s 는 기존 1:1 대조에 `scope === 'LEXICON'` 조건을 **추가**. task-018 ②의 의도된 계약 변경에 스모크를 맞춘 것이며 구현에 맞춰 느슨하게 바꾼 사례는 없음.

**⑦ 회귀 독립 재현** — `git archive 44e9d3e` 를 스크래치(`/tmp/.../scratchpad/rev026-44e9d3e`)에 풀고 `~/.node-local/thekaiwa/node_modules` 심볼릭 링크로 연결해 독립 실행(끝에 삭제):
  - `tsc --noEmit` → 0 에러(Developer 기록과 일치).
  - `eslint .` → 2 에러 + 5 경고로 처음 나왔으나, 2 에러는 `ecosystem.config.js`(require() 스타일 import) 였다 — 대조 결과 **이 파일은 `npm run lint` 가 항상 거치는 `sync-local.sh` 동기화 대상에 원래 없다**(`~/.node-local/thekaiwa` 미러에 이 파일 자체가 없음, `diff` 로 확인) — `git archive` 가 저장소 전체를 푼 내 스크래치에서만 나타난 아티팩트이고 task-018 커밋 3건 어디도 이 파일을 건드리지 않았다. 미러에서 그대로 `eslint .` 재실행 → 0 에러·5 경고(모두 `react-hooks/set-state-in-effect`, `eslint.config.mjs` 주석에 문서화된 기존·의도적 warn 등급 — task-018 과 무관한 기존 5건과 동일 파일·라인). Developer "lint 0 error(경고 5 기존)" 주장과 정확히 일치.
  - `npm run test` 상당 명령(70개 `*.test.ts`, `--test-concurrency=1`) → **505/505 pass, 0 fail, 0 skip**. Developer/Deployer 로그의 "504 pass·1 skip" 과 총합(505)은 같으나 skip 유무가 다른데, 원인은 `modelPackage.test.ts:91` 의 `t.skip(...)` 가 "저장소 `speech/models` 가 없는 실행 위치(미러)" 조건부라서다 — 미러(`~/.node-local/thekaiwa`)에는 이 디렉터리가 없어 스킵되지만, `git archive` 로 저장소 전체를 그대로 푼 내 스크래치에는 존재해 실제로 돌고 통과했다. task-018 커밋은 이 파일을 건드리지 않았고, 실패 0 은 두 환경 다 동일 — 회귀 없음 확인.

**Low findings (비차단, push 막지 않음)**
- L1 — `linkUtteranceToMessage` 의 P2002(unique 위반) 를 Trace 경고 `UTTERANCE_USED` 로 수렴시킨 것은 의미가 살짝 어긋난다("이 발화를 이미 보냄" 이 아니라 "이 메시지에 이미 다른 발화가 연결됨"). 사용자에게는 노출되지 않고(턴은 계속 진행) 실무적으로 거의 도달 불가능한 경로라 지금 막을 필요는 없지만, 다음에 이 파일을 손댈 때 별도 라벨(예: `UTTERANCE_LINK_CONFLICT`)로 분리 권고.
- L2 — §③ 서술한 LEXICON enum 롤백 시나리오. 지금 코드 경로엔 노출이 없으나, Phase 2 `#137` 감사 이력 API 를 구현할 사람이 `scope` 를 폭넓게 select 하기 전에 한 번 더 고려하도록 `domain-model.md` 미해결 표에 짧게 남겨두길 권고(선택 사항, 이번 task 완료 기준 밖).

**QA 인계 (high_risk_areas)**
- `#32` 턴에서 다른 방 발화 재전송 시 409 `UTTERANCE_OTHER_CHAT` 띠·문구(360/390/412 세 폭에서 줄바꿈·터치 영역 확인)
- 발음 사전 버전 목록/상세의 "v{n} 로 되돌림" 표시(행·머리 둘 다, changeSummary 와 중복 정보 아닌지 시각 확인)
- 배포 직후 pm2 `thekaiwa` 로그에서 `HOOK_FAILED`·`UTTERANCE_USED`(Trace) 스파이크가 없는지 짧게 확인(옛 코드 구간은 이미 지나갔을 가능성이 높지만, 배포 타이밍에 따라 여전히 남아있을 수 있음)
- 라이브 스모크 K1~K7·003g 3b/3r/3r2/3s 는 팀이 이미 실행해 46/46·54/54 로 PASS 했음 — QA 는 체크리스트 상 재확인만 권고(필수 재실행은 아님)

**native_change: false**

## QA 기록

## Deployer 기록
- [14:47] (Leader) **`prisma db push --accept-data-loss`**(경고는 unique 인덱스 추가 안내뿐 — 사전 재확인 중복 0·Utterance 0행) → 31s 적용·`prisma generate`. 확인: `AuditLog/ConfigurationVersion/RuntimeOverride.scope` +LEXICON, `PronunciationLexiconVersion.rollbackOf int NULL`, `Utterance.chatId varchar(191) NULL`, 인덱스 `Utterance_chatMessageId_key UNIQUE`·`Utterance_chatId_idx`(+ 옛 non-unique `_chatMessageId_idx` 잔존 — 무해). 운영(옛 코드) health `PRODUCTION ok []` — 코드 push 전 DB 먼저 원칙대로. 데모 게이트: judge intake(demo none) → `check.mjs init` → `not_required`, `check` PASS.
- [14:30] (Leader, Plan 1) **백업**: `mysqldump --single-transaction --routines --triggers --hex-blob thekaiwa`(접속 정보는 `.env` DATABASE_URL 에서 임시 600 옵션 파일 → 즉시 삭제, 값 미출력) → `/home/brownjeon/NFS/homes/brownjeon/project/files/thekaiwa/backups/thekaiwa-20260928-142959-pre-task018.sql.gz`(600, 53,782B, CREATE TABLE 50, "Dump completed"). **복원**(필요 시, 사용자 확인 후): `zcat <파일> | mysql --defaults-extra-file=<옵션 파일> thekaiwa` — 공유 DB 전체를 이 시점으로 되돌리므로 그 뒤 데이터(운영 사용자 기록)가 사라진다 → 먼저 새 칸만 되돌리는 방법(칼럼·인덱스 DROP)을 검토.

## 최종 요약

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 해당없음 | - | - | judge: none | 09-28 14:48 |
