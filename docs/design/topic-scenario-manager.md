# 주제·상황 관리 — 구현 계약 (task-045 · IMP-0026)

> **상태: v1 (2026-10-07, Leader).** 사용자가 데모 v2 를 승인("v2로 진행, D5=A, 변형=A, 위치=A, 화면=A, 재생성=A")했다. 이 문서는 `api-contract.md`·`domain-model.md`·`challenge.md` 를 **보완하는 구현 계약**이며, 충돌하면 이 문서가 task-045 에 한해 우선한다(구현 뒤 세 정본에 반영). 화면은 데모 v2 `docs/demo/task-045-improve-topic-scenario-manager-v2.html` 과 이력서 `## Designer 기록`의 v2 가이드가 정본이다. 근거 조사: 이력서 `## Leader 기록 (설계 조사 판정` (developer 설계 조사 dev-045-spec).

## 0. 결정 요약 (사용자 · Leader)

| # | 내용 | 출처 |
|---|---|---|
| 1 | 사용자는 **주제 한 줄(+수준)만 입력** → AI 가 주제 설명·기본 표현·시나리오 초안 → 사용자가 검토·수정·**저장해야 확정**(AI 는 제안만, 초안 단계 DB 행 없음) | 사용자 |
| 2 | 진입점 = **설정 허브 "내 상황·주제 관리"**(계정 카드 바로 아래, 위치=A) + 회화 탭 '시나리오' 편집 진입 유지, 같은 편집 화면 공유 | 사용자 |
| 3 | **변형 연출 = A**: 원본에서 조건·상대 성격·분기를 바꾼 **새 상황 초안**을 AI 가 만들고 검토·저장(DB 변경 0). B(시작 전 옵션)는 이번에 만들지 않는다 → `Chat.scenarioVariant` **미승인·불필요** | 사용자 |
| 4 | **기본 시드·사용자가 바꾼 시드 모두 사용자별로 따로 관리**: 시드를 고치면 그 사용자의 "내 버전"(사본)이 생기고 원본은 그 사용자 목록에서 숨는다. 시드 "삭제"도 그 사용자 목록에서만 숨김. "기본으로 되돌리기" 가능 | 사용자 |
| 5 | 주제 삭제 = 연결 상황 제거(다른 주제 연결이 남은 상황은 연결만 끊음)·**진행 중 챌린지 행 삭제**·**완료·그만둔 챌린지 유지**(주제 이름은 저장된 이름 그대로 보이고 **"삭제됨" 표기 없음**)·삭제 확인 창에 진행 중 챌린지 안내 | 사용자·Leader |
| 6 | 주제 AI 는 **Claude CLI**(`engine/adapters/llm/claudeCli` 유일 경로), `topicDraft@v2`·`balanced`·40s | 사용자·PE |
| 7 | 첫마디: 입력은 **한국어**, 일본어는 편집 때 AI 가 한 번 만들어 `{ja, ko}` 로 저장(D5=A), 회화는 저장된 일본어를 그대로 말한다. 새 API #178 | 사용자·Leader |
| 8 | 한도: 내 주제 ≤30 · 주제 저장 하루 10 · 주제 초안 분당 6·하루 20 · 첫마디 제안 분당 10·하루 60 [추측 — PE 실측으로 조정] · 기존 내 상황 50·하루 30 유지 | Leader |
| 9 | 시드 숨김에서 진행 중 챌린지는 계속 · 내 버전 되돌리기/삭제 = 주제 삭제와 같은 규칙 · 사본 주제의 "주제 표현 진행"은 0부터 | Leader |

## 1. DB — **새 표 1개만 승인됨**(`UserSeedOverride`)

사용자 승인 원문(2026-10-07): "시드 편집에 대하여 기본 시드 및 사용자가 변경한 시드의 경우 사용자별로 별도로 관리할 수 있도록 구조를 변경해줘." 이 외의 칸·표·enum 은 **미승인**. `prisma db push` 는 백업 뒤 T1 구현 단계에서만(`--with-migrate` 아님, 개발=운영 같은 NAS DB).

```prisma
/// task-045 — 시드(공유 행)를 사용자별로 따로 관리. 시드 행은 절대 수정하지 않는다.
/// copyId 있음 = 그 사용자가 고쳐 만든 "내 버전"(사용자 소유 행)이 원본을 대신한다. copyId null = 그 사용자 목록에서 시드를 숨김.
model UserSeedOverride {
  id        String   @id @default(cuid())
  userId    String
  /// 'TOPIC' | 'SCENARIO'
  kind      String   @db.VarChar(10)
  seedId    String   @db.VarChar(40)
  copyId    String?  @db.VarChar(40)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, kind, seedId])
  @@index([userId, kind])
}
```
- `User` 모델에 `seedOverrides UserSeedOverride[]` 역관계 한 줄. **FK 없음**(`seedId`·`copyId` 는 문자열): 시드·사본 행 삭제와 override 정합은 서비스의 한 트랜잭션이 보증한다. 백필 없음. 롤백 = 표 삭제(사본은 일반 내 행으로 남고 시드가 다시 보인다).
- 사본은 일반 사용자 소유 행이다: 상황 `userId=U·isSeed=false`, 주제 `userId=U·isSeed=false`. 시드 로더(`seed-scenarios.ts`·`seed-topics.ts`)는 시드 행만 갱신하므로 사본에 영향이 없다(되돌림 문제 해소).

## 2. 가시성 규칙 (목록·시작에서만 — id 로 직접 읽기는 막지 않는다)

한 사용자 U 에게 보이는 시드 = **U 의 `UserSeedOverride`(kind, seedId) 행이 없는 시드**. 보이는 내 행 = `userId=U` 전부(사본 포함). 숨긴 시드의 과거 기록(`Chat.scenarioId`·`Lesson.*Id`·`LearningObservation.scenarioId`·`RepetitionItem(SCENARIO)`·챌린지/`VocabSession` `topicId`)은 id 로 계속 읽힌다.
- 목록 필터를 고칠 곳(6): `learning/topics/index.ts` `listTopics`(:100)·`pickFewestLessonTopic`(:153) · `learning/scenarios/catalog.ts`(:177-187 목록) / **숨긴 시드로 새로 시작을 막을 곳**: `scenarios/start.ts` `resolveScenarioChatStart` · `challenges/service.ts`(:68 주제 확인) · `lessons/generate.ts`.
- **장소 연결 해석(열린 설계 — developer T1 이 정하고 reviewer·Codex 가 점검)**: 시드 상황은 시드 주제에 붙어 있고(`ScenarioTopic`) 사용자가 그 주제를 사본으로 바꾸면 시드 상황의 장소가 "숨은 주제"를 가리킨다. 권고 = 읽을 때 사용자의 override 로 **주제 id 를 사본 id 로 치환해 보여 주고**(저장 변경 없음), 사용자 소유 상황은 `fork` 때 연결을 사본 주제로 옮긴다.

## 3. API (번호는 `api-contract.md` 최신 이후 **#170 부터**; #57 은 예약 번호 사용; #161~#169(010d)는 api-contract 에 없던 **문서 부채**였고 2026-10-07 `api-contract.md` §1-5 에 #170~#179 와 함께 채웠다 — #168 은 라우트가 없다. 요청·오류 코드의 정본은 코드(라우트 JSDoc), 아래 표는 요지)

| # | 메서드·경로 | 요지 | 오류·한도 |
|---|---|---|---|
| 56(변경) | `GET /topics?level=all` | 관리 화면용 전체 수준 조회(`mine` 과 조합) | 기존 `level` 규칙 유지 |
| 57 | `POST /topics` | 주제+기본 표현 저장(한 트랜잭션). 본문 = `{title, titleJa?, level, description, chunks[{chunkType,textJa,reading,meaningKo}]}`; `checkTopicChunkFields`·`detectUnsafeTopicText`(이모지 접합 문자 허용 변형)로 재검사 | 내 주제 ≤30·저장 하루 10(429 `DAILY_LIMIT`)·409 `TOPIC_LIMIT`·400 필드 이유 |
| 170 | `POST /topics/drafts` | `topicDraft@v2` 초안(**행 없음**, 사용자당 동시 1건 409 `DRAFT_BUSY`) | 분당 6·하루 20·`NOT_A_TOPIC`/`UNSAFE`→422 같은 문구·엔진 오류 502 |
| 171 | `PATCH /topics/:id` | 내 주제 고치기(조각 diff — 기존 조각 id 유지). 시드 id 에는 `fork` 를 쓴다 | 404 남의 것·400 |
| 172 | `GET /topics/:id/removal` | 삭제 확인 창 사전 조회 `{activeChallenge:{id,title,day,lengthDays}\|null, finishedChallenges:n, scenariosArchived[], scenariosUnlinked[], doneLessons:n, chunks:n, isSeed:bool}` | 읽기 전용 |
| 173 | `DELETE /topics/:id?ack=<activeChallengeId\|none>` | 내 주제 삭제(§4 트랜잭션). **시드 id 에 대한 DELETE = 그 사용자 목록에서만 숨김**(override `copyId=null`). 서버 판단과 `ack` 가 다르면 409 `IMPACT_CHANGED` | 404·409 |
| 174 | `POST /topics/:id/fork` | 시드 주제를 **저장 시점에 복사**(본문 = 전체 입력): 사용자 락 → 시드 조각 복사(새 조각 id) → 병합 → override. 편집을 취소하면 사본이 남지 않는다 | 이미 사본 있음 409 |
| 175 | `POST /scenarios/:id/fork` | 시드 상황 사본(본문 = 전체 입력). `keyExpressions` id·`constraints.exprSeq` 를 그대로 복사한 뒤 `mergeScenarioFields` | 상한 50(409 `SCENARIO_LIMIT`)·하루 30 공유 |
| 176 | `POST /seed-overrides/restore` `{kind, seedId}` | "기본으로 되돌리기"·숨긴 시드 다시 보기. 사본이 있으면 **삭제와 같은 규칙**(주제면 §4, `ack` 필요) | 404 |
| 177 | `POST /scenarios/:id/variants/drafts` | **변형 A** — 기준 상황 + `axes{persona?, twist?, flow?, level?}`·`note?`(코드 열거 한 곳 — 화면 칩 목록과 공유)로 새 상황 초안(행 없음) → 저장은 #163 | **변형 초안 분당 6**(`scenario-variant`), **하루 한도는 #166 과 공유하는 `scenario-draft-day` 40**(저장 한도 하루 30·상황 50 과는 별개) · 422 `NO_VARIATION`(바꿀 점 없음, 한도 미소모)·`NOT_A_VARIANT` · 409 `DRAFT_BUSY` |
| 178 | `POST /scenarios/openings/draft` | 한국어 첫마디 → 일본어 첫마디 제안(`openingDraft`, 행 없음, `reading` 은 확인용 비저장) | 분당 10·하루 60·`NOT_AN_UTTERANCE`/`UNSAFE`→422·502 |
| 166(변경) | `POST /scenarios/drafts` | 본문에 `topic:{title,titleJa}` 인라인 허용(additive) — 저장 전 새 주제의 상황 초안 | 기존 |
| 165(변경) | `DELETE /scenarios/:id` | 시드 id 면 그 사용자만 숨김(override) | 기존 의미 유지 |

공통: 모든 쓰기는 소유자·capability 검사·`lockUserRow`·한 트랜잭션. 응답·로그·Trace 에 원문·엔진명 없음. 새 오류 코드는 `api-contract.md` 오류 표에 추가.

## 4. 주제 삭제 트랜잭션 (결정 5 — 한 트랜잭션, 실패하면 아무것도 지워지지 않음)

순서: `lockUserRow` → 주제 재조회(내 것·시드 아님; 시드면 숨김 경로) → **진행 중(`ACTIVE`) 챌린지 행 삭제**(완료·그만둔 `ENDED`·`COMPLETED` 는 유지, FK `onDelete SetNull` 로 `topicId=null`, 화면은 저장된 `topicTitleSnap` 을 평소 그대로 표시·"삭제됨" 표기 없음) → 이 주제에 걸린 상황 중 **다른 주제 연결이 없는 것만 `ARCHIVED`**(하드 삭제 안 함 — `Chat.scenarioId` 보존; #165 의미 재사용), 나머지는 `ScenarioTopic` 연결만 끊음 → 주제 하드 삭제(`TopicChunk`·`ScenarioTopic` Cascade; `Chat`·`Lesson`·`Evaluation`·`VocabSession` `topicId` SetNull). FK 없음(`RepetitionItem.refId`·`VocabAttempt.refId`·발음 사전 COURSE)은 끊어진 참조 허용(스냅샷으로 읽힘). 소프트 삭제 없음.
- **기존 동시성 결함 수정(필수)**: `createChallenge` 가 주제를 트랜잭션 밖에서 확인(`service.ts:68`) + infra 에 FK 위반(P2003) 변환 0건 → 삭제와 겹치면 500. **트랜잭션 안에서 주제를 다시 확인**하고 P2003 을 404 `TOPIC_GONE` 으로 변환. 수업 생성(#59)·주제 단어 세트(#47)도 같은 패턴인지 점검(NOT_VERIFIED).
- 삭제 확인 창: #172 응답으로 문구를 만든다(진행 중 챌린지가 있으면 그 사실·제목·며칠째, 연결 상황 수, 완료 챌린지 기록은 그대로 남음). 서버 판단이 바뀌었으면 409 `IMPACT_CHANGED` 로 창을 다시 연다.
- **정본 개정**: `challenge.md` §3-3:253·schema 주석 "진행 중 챌린지가 쓰는 주제는 삭제 409" → 위 규칙(진행 중 챌린지 제거)으로 바꾼다. **`challenge.md` 는 2026-10-07 개정 완료**(schema 주석 `prisma/schema.prisma` Challenge 는 T1 때 함께).
- **Codex C1 반영(2026-10-07, High 2·Medium 1 — 채택)**: ⓐ **#59 수업 생성**(`lessons/generate.ts:99`) — `loadLessonMaterials` 가 트랜잭션 밖에서 주제를 읽고 `claimLessonTx` 잠금 뒤 재조회 없이 INSERT → **잠금 뒤 주제 재조회 + P2003→404 `TOPIC_GONE`** ⓑ **#47 주제 단어 세트**(`vocab/sessions.ts:459`) — 잠금 전 주제 읽음 → 긴 AI 호출 → 삭제 중인 주제에 세트 저장 가능 → **저장 직전 잠금 안에서 주제·override 재확인 + P2003 변환**(AI 호출 뒤에 주제가 사라졌으면 세트를 만들지 않고 `TOPIC_GONE`) ⓒ 위 둘과 `createChallenge`(:68)를 **같은 공용 헬퍼**(`assertTopicVisible(tx, userId, topicId)` — 잠금 안에서 존재·소유·숨김 확인)로 모아 T3 에서 한꺼번에 고치고 경합 시험으로 고정.
- **시드 override 알고리즘과 종료 불변식(Codex Medium — 채택)**: 모든 쓰기는 `lockUserRow` 아래 한 트랜잭션. 불변식 = 사용자·종류·시드 한 쌍마다 **override 행이 없거나**, `copyId` 가 **존재하는 그 사용자 소유 행**을 가리키거나, `copyId=null`(숨김). 연산: **fork**(override 있음 → 409 `ALREADY_COPIED`; 없음 → 사본 생성+override 한 번에) · **hide**(override 있음 → 이미 숨김/사본 있음이므로 무변경 200; 없음 → `copyId=null` 행) · **restore**(override 없음 → 404; `copyId=null` → 행 삭제; `copyId` 있음 → 사본에 **삭제 규칙(주제면 위 트랜잭션·`ack`)** 적용 + override 삭제를 같은 트랜잭션) · **고아 처리**: 가시성 판정은 `copyId` 가 가리키는 행이 없으면 "숨김(copyId=null)"으로 읽고, restore 가 이를 정리한다. 경합 시험(두 탭 동시 fork → 하나 409·행 1개, fork×hide, restore×fork, restore×주제 삭제, 시드 로더 실행 중 fork)을 T1 완료 기준에 넣는다.
- **상황 삭제(#165)의 잠금 트랜잭션 규칙(Codex C2 반영, 2026-10-07)**: 각 경로가 사용자 행 잠금(`lockUserRow`) 아래 **자기 한 트랜잭션**에서 끝난다 — **시드 id** = 그 사용자 목록에서 숨김(override `copyId=null`, 시드 행 불변, 멱등 `alreadyHidden`, 응답 `result:'HIDDEN'`) · **내 시드 사본 id** = `detachCopy`(사본 `ARCHIVED` + override 를 숨김으로 정리해 고아를 남기지 않음) · **일반 내 상황** = `ARCHIVED`(멱등 `alreadyArchived`, 응답 `result:'ARCHIVED'`). 지운 상황으로 **역할극 시작(#28)·상황 수업 생성(#59)** 은 같은 잠금 아래 **첫 쓰기 직전에 상황을 다시 확인**(`assertScenarioStartableTx`)한다 — `ARCHIVED` 상황 409 `ARCHIVED`, 없음·남의 것·가린 시드 404. 지우기가 먼저면 시작이 거절되고, 시작이 먼저면 지우기가 그 뒤에 끝난다(이미 열린 역할극·기록은 그대로).

## 5. AI 작업 (모두 Claude CLI · 제안만 · JSON 하나 · ajv + 1회 재시도)

| 작업 | 상태 | 계약 위치 |
|---|---|---|
| `topicDraft@v2` | 구현 완료·로컬 커밋 `e74fe57`, `LLM_TASKS.topicDraft {balanced, 40_000, interactive}` 는 developer | 이력서 PE 기록(topicDraft·보완), REV-147·148 |
| `openingDraft@v2` | 구현 완료·로컬 커밋 `8cc224d`(프롬프트)·`9e961e5`(서비스·라우트), `LLM_TASKS.openingDraft {balanced, 25_000, interactive}`, 라우트 #178 연결 | 이력서 PE 기록(openingDraft) · `conversation/prompts/openingDraft.ts` |
| 변형 상황 초안(A) `scenarioVariant@v2` | 구현 완료·로컬 커밋 `8979415`(프롬프트)·`9e961e5`(서비스·라우트), `LLM_TASKS.scenarioVariant {balanced, 40_000, interactive}`, 라우트 #177 연결(#166 `scenarioDraft` 재사용이 아니라 **별도 프롬프트**, 입력 `axes`) | `conversation/prompts/scenarioVariant.ts` |
| 시나리오 초안(#166) | 기존. 본문 `topic` 인라인만 추가 | 010d 이력서 |
- 한자 읽기는 기계가 검증하지 못한다 → 검토 화면에 **읽기를 반드시 보이고** 「읽기가 틀릴 수 있어요」 안내. `warnings`(`CHUNKS_SHORT`·`TYPE_THIN_*`·`DESCRIPTION_MISSING`·`TITLE_JA_MISSING`·**`TITLE_TRUNCATED` 신규**)는 저장을 막지 않는다. 사용자 편집 저장 검증은 이모지 접합 문자(U+FE0F·U+200D) 허용, 꺾쇠·URL·비밀 모양·제어문자는 금지.

## 6. 화면 규칙 (데모 v2·designer v2 가이드가 정본 — 여기는 구현 필수 규칙만)

- **R1~R6 스크롤 유지**: 체크·칩·메뉴 토글은 **그 줄만 바뀌고** 스크롤 컨테이너(`main`) 위치·포커스 유지. `key` 변경·로딩 상태로 되돌림·`router.replace` 기본 스크롤·`scrollIntoView`·`scrollTo` 금지, 높이가 변하는 것은 누른 줄 아래에만. QA: 토글 전후 `scrollTop` 차 0px·포커스 유지(360/390/412).
- 첫마디: 한국어 주 입력 + 일본어 AI 제안 읽기 칸 + [일본어로 만들기]/[다시 만들기]; 한국어를 고치면 일본어가 오래됨 → **맞출 때까지 저장 불가**; 한국어를 비우면 첫마디 없이 저장(역할극 「먼저 말을 걸어 보세요」). 시드·기존 상황은 한국어가 주 입력, 일본어는 저장값 표시. **회화 탭 '시나리오'의 기존 편집 화면도 같은 방식으로 바뀐다(공유 편집기 — 승인된 material 변화)**.
- 완료 챌린지에는 「주제가 지워져 이 챌린지 기록을 계산할 수 없어요」(`removed` 문구)를 표시하지 않는다.
- 로딩은 가짜 빈 상태를 그리지 않는다(같은 높이 자리표시 — IMP-0027 원칙, 이번 task 의 새 화면에만 적용).

## 7. 구현 task 분할 (한 developer task ≤ ~15파일·≤ 60턴, `.claude/agents/leader.md` `<agent_dispatch>` 규칙)

| task | 범위 | 선행 | 위험 |
|---|---|---|---|
| T0 | PE `topicDraft`(완료)·`openingDraft`(진행 중) | — | 낮음 |
| T1 | `UserSeedOverride` 표 + override 모듈 + 가시성 6곳 + #174~176 | **DB 백업·`db push`(표 1개만)**, judge C1·Codex | 높음 |
| T2 | #57·#170·#171·`LLM_TASKS.topicDraft`·`level=all` | T0 | 중 |
| T3 | #172·#173 + **`assertTopicVisible` 공용 헬퍼로 `createChallenge`·#59 수업 생성·#47 주제 단어 세트의 경쟁 재확인(Codex C1)** + P2003→`TOPIC_GONE` + (`challenge.md` §3-3 개정 ✅ 완료) | — | **최고** |
| T4 | #177 변형 A·#166 `topic` 인라인·#178 `openingDraft` 연결 | T0 | 중 |
| T5 | 화면: 설정 행·관리 화면·주제 편집·삭제 확인·시드 편집/되돌리기·변형·공유 편집기 첫마디 | 데모 v2 승인 ✅ + 위 API | 중 |

순환: Developer → Reviewer → [judge C2 → Codex(R2 필수)] → QA(라이브·LLM 슬롯 직렬·qa 계정 분리) → Leader. 위험 큰 순서 T3 > T1 > T4 > T2 > T5.

## 8. 열린 항목 (구현 중 확정 — 확정되면 이 절에 반영)

① §2 장소 연결 해석 ② 사본 주제로 바꾼 뒤 진행 중 챌린지가 가리키는 원본 주제의 "시작" 차단 범위(챌린지는 계속, 새 시작만 사본으로) ③ `#164 PATCH opening:null` 동작(첫마디 지우기) ④ ~~수업 생성(#59)·주제 단어 세트(#47)의 삭제 경쟁~~ → Codex C1 이 둘 다 **실제 결함으로 확인**(§4 Codex C1 반영, T3 에서 수정) ⑤ A11 이 숨긴·보관 상황의 `RepetitionItem(SCENARIO)` 를 복습으로 고르는지 ⑥ 사용자 주제가 발음 사전 COURSE 대상이 될 수 있는지 ⑦ 운영 DB 의 기존 사용자 주제 수(쓰기 경로가 없었으니 0 이 유력 — 미확인) ⑧ ~~api-contract #161~#169 문서화~~ → 2026-10-07 `api-contract.md` §1-5 에 반영(#168 은 라우트 없음 — 확인 필요).

**알려진 한계 (task-045 구현 시점, 2026-10-07 — 수정 전까지 유지)**
- 주제 저장 하루 한도(10)는 **오늘 만든 내 주제 행 수**로 센다 — 만든 뒤 하드 삭제하면 그 행이 빠져 한도를 우회할 수 있다(내 주제 30개 상한은 그대로 막는다).
- 삭제 확인 `ack` 는 **진행 중 챌린지 id(또는 `none`)만** 덮는다 — 확인 창을 연 뒤 보관·연결 해제될 상황의 개수·목록이 바뀌어도 409 `IMPACT_CHANGED` 가 나지 않는다.
- #28 역할극 시작은 시작 직전 재확인(`assertScenarioStartableTx`)이 **상황만** 보고 주제는 보지 않는다 — 주제 확인(`resolveStart`)은 잠금 밖이라, 그 사이 주제가 지워지면 오류 코드가 일관되지 않을 수 있다.
- `scenarioVariant@v2`(#177)는 JSON **1차 응답이 한도를 어기는 경우가 남는다**(QA 실측 4/34 → PE v2 재측정 1/14; 성공 조건 3개 초과는 해소, 항목 40자 초과는 `flow=suggest` 에서 잔존). 엔진 재시도 1회로 회복돼 사용자에겐 200 이지만 그 경우 응답 시간이 약 2배(p95 ≈ 21s, 한도 40s 안)다.
- `DRAFT_BUSY` 409 거절도 분당·하루 한도를 소모한다(한도 검사가 서비스의 동시 1건 확인보다 앞) — 화면은 만드는 중 버튼을 비활성화해 더블탭을 막는다.
- #178 첫마디 일본어 제안은 **학습자의 질문·자기소개 같은 글도 선생님 첫마디로 받아 일본어로 옮길 수 있다**(QA 실측 2/2, 코드가 막지 못함) — 화면이 제안 아래에 확인 문구를 둔다. 서버 400 메시지에는 「을(를)」 같은 조사 병기가 들어 있어(13개 파일의 기존 스타일) 화면 고정 문구로 바꿔 쓴다.
- 학습자 글의 **13자리 이상 숫자열 거절**(3자리 이상 숫자 묶음이 공백·하이픈 한 칸으로 이어진 합계, 카드번호 모양)은 카드번호가 아닌 긴 숫자(전화번호 외 일련번호 등)도 막을 수 있다. 연도·한국 전화번호(11자리)·날짜 범위·번지는 통과.
