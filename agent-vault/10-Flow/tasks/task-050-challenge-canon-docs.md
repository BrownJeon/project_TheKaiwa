---
task_id: task-050
title: "챌린지 정본 문서 반영 — domain-model·api-contract·module-dependency(+role-permission·configuration-resolution 대조)를 실제 코드·스키마에 맞춤 (문서 전용)"
status: done
base_ref: e25b024
risk_level: "R1"
roles_involved: [leader, developer, reviewer]
related_tasks: [task-041-challenge-core, task-042-topic-words-b2, task-043-challenge-screens, task-044-today-integration, task-040-improve-challenge-design, task-012b-2-analysis-result-ui]
tags:
  - type/task
  - domain/docs
  - domain/challenge
aliases:
  - 챌린지 정본 문서
  - task-050
created: 2026-10-10
updated: 2026-10-10
demo_gate:
  required: false
  level: "none"
  status: "not_required"
  version: 0
  repo_path: ""
  artifact_url: ""
  content_sha256: ""
  decided_by: "leader"
  rule_id: "DOCS-only"
  approved_by: ""
  approved_at: ""
  approval_quote: ""
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: false
---

# task-050 — 챌린지 정본 문서 반영 (문서 전용)

## 사용자 요청 (원문)
- 2026-10-10 「챌린지 정본 문서 작업 진행해줘」 — 직전 vault 상태 정리(감사 2건)에서 드러난 문서 부채: 「챌린지 정본 5종 미반영」([[task-050-challenge-canon-docs]] 가 해소). 상태 정리 승인 시 사용자 선택지 중 이 작업을 지정.

## 배경 (사실 — 2026-10-10 Leader 가 grep 으로 확인)
- 챌린지는 Phase 2 에서 구현·운영 반영(릴리스 `20261007-104449-61044b91`)됐다: 스키마 `enum ChallengeStatus`(274행)·`model Challenge`(1315행), API 라우트 4파일(`src/app/api/v1/challenges/{route,today/route,[id]/route,[id]/end/route}.ts`), 모듈 `src/modules/learning/challenges/{index,metrics,progress,service,settle,store,topicProgress,validate,view}.ts`.
- 그러나 task-041~044 가 정본 반영을 「C17 Leader 단독」으로 미뤘고 추적 항목이 없어: `domain-model.md` 에 `Challenge` 엔티티 정의 없음(언급 몇 줄은 다른 표 안) · `api-contract.md` 에 챌린지 엔드포인트(코드 주석의 #155~#159) 없음 · `module-dependency.md` 에 `learning/challenges` 없음. 설계서 `docs/design/challenge.md` 는 **설계 정본**이며 이번 작업은 **구현된 사실(as-built)** 을 정본 5종에 반영하는 것이다.
- 같은 정본에 남은 이월 항목(012b-2 감사 M-1): `api-contract.md` 의 `#21c`(발화 목록)·`#66 voiced` 미반영.

## 범위
정본 5종(`docs/design/{domain-model,api-contract,module-dependency,configuration-resolution,role-permission}.md`)을 **코드와 스키마를 기준으로** 대조해, 챌린지(와 위 두 이월 항목) 관련 누락·불일치를 고친다. **코드·스키마·설계서(`challenge.md`)는 수정하지 않는다.** 코드와 설계서가 다르면 정본에는 **코드(as-built)** 를 적고 차이를 이력서에 표로 남긴다(설계 변경 판단은 하지 않음).

## 완료 기준
1. `domain-model.md`: `Challenge` 엔티티(필드·타입·기본값·`@unique`·인덱스·관계·삭제 정책·소유 층·누가 쓰는지·불변식)와 `ChallengeStatus`, 그리고 DB0 로 들어온 `VocabSession.topicId`·`VocabAttempt.refType/refId`·(오늘 추가) `VocabAttempt.exampleSnap/exampleKoSnap` 가 스키마와 일치.
2. `api-contract.md`: 챌린지 엔드포인트(번호·메서드·경로·요청·응답·오류 코드·한도·소유자 검사)가 라우트 코드와 1:1. `#21c`·`#66 voiced` 반영. 번호 충돌·빈 번호 없음.
3. `module-dependency.md`: `learning/challenges` 행(공개 API·소유 테이블·import 규칙·라우트 조합)이 `index.ts` 와 실제 import 와 일치.
4. `role-permission.md`·`configuration-resolution.md`: 챌린지/예문/역할극 `endedAt` 관련 capability·설정 키 누락 대조(없으면 「변경 없음」 확인을 이력서에 기록).
5. 감사(Reviewer)가 문서 ↔ 코드를 독립 대조해 PASS. 보이지 않는 문자 0.

## 상태 로그
- [2026-10-10] Leader — 이력서 작성. 다음: developer(문서 전용) 작성 → reviewer 대조 감사 → Leader 커밋.

## Developer 기록 (task-050 — 정본 반영)
- [체크포인트 1 — D1 domain-model.md 완료] 완료: `docs/design/domain-model.md` — §2-2 ER(Challenge 박스·관계 3줄) · §1 L3 소유 표 `Challenge` · §3 Prisma 블록(enum `ChallengeStatus`·`User.challenges`·`VocabSession.topicId`+관계+인덱스·`VocabAttempt.refType/refId/exampleSnap/exampleKoSnap`·`ConversationTopic.challenges/vocabSessions`·`model Challenge`·`EngineMetricsDaily` 6칸 — schema.prisma 에서 그대로 옮김) · §4-3 `Challenge` 행 신설 + `VocabSession`/`VocabAttempt` 행 보강 · §4-5 `EngineMetricsDaily` 행 · §5-9 `ChallengeStatus` 전이 행 · §6 `Challenge` 삭제 행 · §9-3 `StatsSnapshot.data(VOCAB_SESSION)` 에 `date`·`topicId?` + `Challenge.dailyGoal`·`Challenge.result` 행. 남은 일: D2 api-contract · D3 module-dependency · D4 대조 · 이력서 정리(표·미확인·발견). 다음 첫 행동: api-contract §1-5 에 #155~#159 행 + §2 상세 절. 주의점: `Chat.endedAt` 은 이미 반영돼 있음(확인만). 미커밋 파일: domain-model.md.
- [체크포인트 2 — D2 api-contract.md 완료] 완료: `docs/design/api-contract.md` — §1-5 도입 문단(#155~#159 반영·#160 미사용 명시) · 신규 §1-5a 총람 5행(#155~#159) · §1-2 에 #21c 행 신설·#66 행에 `items[].voiced` · §2-10 #47 아래 주제 단어 세트·카드 예문 규칙 불릿 2개 + #50 포인터 · §2-14 #66 `voiced` 불릿 · 신규 §2-31(#155~#159 상세·`ChallengeSummary`/`ChallengeDetail` 요약·#62/#51 `challenge`·#58 `CHALLENGE`·#70/#71 챌린지 칸). 남은 일: D3 module-dependency · D4 대조 · 최종 이력서 정리(표·미확인·발견). 다음 첫 행동: module-dependency §10 표에 `learning/challenges` 행 + L3 절 3행(서브디렉토리·소유 테이블·공개 API) + 비고. 주의점: #47 의 `session.topic`/`generation` DTO 모양과 #58 응답 전체 모양은 코드로 재확인하지 않아 쓰지 않음(미확인). 미커밋 파일: domain-model.md · api-contract.md.
- [체크포인트 3 — D3·D4 완료, 문서 작업 종료] 남은 일: Reviewer 대조 감사(문서 ↔ 코드)·Leader 경로 지정 커밋. 코드·스키마·설계서(`challenge.md`)·테스트는 건드리지 않았다. 보이지 않는 문자 diff 0건.

### ① 변경 파일 (줄 번호는 2026-10-10 작업 직후 기준)
| 파일 | 위치 | 변경 |
|---|---|---|
| `docs/design/domain-model.md` | §1 L3 행(24) · §2-2 ER(관계 3줄·`Challenge` 박스) · §3 Prisma(697 `enum ChallengeStatus` · User `challenges` · VocabSession `topicId`+관계+인덱스 · VocabAttempt `refType/refId/exampleSnap/exampleKoSnap` · ConversationTopic `challenges/vocabSessions` · 1741 `model Challenge` · EngineMetricsDaily 6칸) · §4-3 `Challenge` 행 신설 + `VocabSession`/`VocabAttempt` 행 · §4-5 `EngineMetricsDaily` 행 · §5-9 `ChallengeStatus` · §6 `Challenge` 행 · §9-3 `StatsSnapshot.data(VOCAB_SESSION)` + `Challenge.dailyGoal`·`Challenge.result` | `prisma/schema.prisma` 의 해당 블록을 그대로 옮김(정본 §0 규칙) |
| `docs/design/api-contract.md` | §1-2 143행 `#21c` 신설 · #66 행 `voiced` · §1-5 도입 문단(#155~#159 반영·#160 미사용) · 신규 §1-5a(348행, #155~#159 5행) · §2-10 #47 아래 불릿 2개(주제 세트·카드 예문 규칙)·#50 포인터(937·952행) · §2-14 #66 `voiced`(1211행) · 신규 §2-31(1878행, #155~#159 상세 + #62/#51/#58/#70/#71 챌린지 칸) | 번호 #155~#159 는 비었고 겹침 없음(코드 주석·라우트 주석이 정한 번호 그대로, #160 은 코드에 없음) |
| `docs/design/module-dependency.md` | §2 L3 서브디렉토리(141)·소유 테이블·공개 API 3행 · §10 표 `learning/challenges` 행(577) · §10 불릿 2개(586 import 규칙, 587 라우트 조합 시퀀스) | `index.ts` export 목록 13줄 그대로 |
| `docs/design/role-permission.md`·`configuration-resolution.md` | 변경 없음 | ⑤ 참조 |

### ② 설계서(`challenge.md` v2.3)와 코드가 다른 곳 — 정본에는 코드를 적었다
| # | 설계서 | 코드 사실 | 정본에 적은 것 |
|---|---|---|---|
| 1 | §9-1 #156 오류 「404(주제 없음·남의 주제)」 (§3-3 소유자 검사는 `getTopicRef`) | `createChallenge` 가 주제를 직접 조회하고 잠금 안 `assertTopicVisible` 로 재확인. 404 `NOT_FOUND` + `details.reason='TOPIC_GONE'`, **이 사용자가 가린 시드도 같은 404**(task-045, 새 챌린지는 가린 시드 예외 없음) | api-contract §2-31 #156 |
| 2 | §9-1 에 `Cache-Control` 언급 없음 | #155·#157·#158 은 `private, no-store`, #156·#159 는 헤더 없음 | §1-5a·§2-31 |
| 3 | §9-1 #158 `recentlyEnded: {id, status, title, result요약}` | `{id, status, title, endedAt, result:{lengthDays, metDays, elapsedDays, rate, longestStreak, endReason}}` — `endedAt` 포함 | §2-31 #158 |
| 4 | §9-1 #156 429 「사용자당 하루 20회」 | `RATE_LIMITED` + `details.retryAfterSec`(다음 KST 자정까지) + `Retry-After` 헤더 | §2-31 #156 |
| 5 | §9-1 #156 `WORD_COUNT_OVER_POOL {poolSize}` | `details = {field:'dailyGoal.wordCount', reason, poolSize}`, **고를 수 있는 선택지가 없을 때(`wordCount=null`)도 같은 400** | §2-31 #156 |
| 6 | §3-2·§5-5 `result` 에 계산불가 처리 언급 없음 | `dailyGoal` 형태가 깨진 행은 `result` 없이(NULL) 상태만 끝낸다(진행 중 1개 칸을 풀기 위해, 로그만) · 끝난 행이 깨져 있으면 #155·#158 에서 그 행만 뺀다 | domain-model §9-3 `Challenge.result`·api-contract §2-31 #155 |
| 7 | §5-5 ENDED `endedAt` = 「지금」 | 사용자 행 잠금을 **얻은 뒤** 잡은 시각(REV-124) — 모순 아닌 구체화 | domain-model §5-9 |
| 8 | §3-2 `wordsMinAnswered = ceil(4×wordCount/5)` | `Math.floor((4n+4)/5)` — 5·10·15 → 4·8·12 로 동치(정수식) | 두 문서 모두 `ceil(4×n/5)`(정수식 표기) 유지 |
이 8건 중 의미가 바뀌는 것은 1·4·5·6(오류·응답 세부), 나머지는 표기·구체화다. 코드나 설계서는 고치지 않았다.

### ③ 「미확인」 — 쓰지 않았다
- #47 응답의 `session.topic{id,title,lessonCardCount,aiCardCount}`·`generation{source,generatedNow,reason}` 의 실제 모양과 #47 `generate` 기본값·`topicId`+`category` 동시 400 규칙(설계서 §9-2 에만 있음, 이번에 `vocab/sessions.ts` 응답 DTO 를 끝까지 읽지 않음).
- #48·#49·#51·#53 의 세션 DTO `topic` 칸, #51 `wrongWords[].source`, #53 다시 풀기의 주제 세트 복사 상세(예문 스냅샷 복사만 코드로 확인).
- #58 `lessons/today` 응답 전체 모양(추천 `reason:'CHALLENGE'` 값만 확인).
- 운영 반영 릴리스·날짜(이력서 배경 문장의 `20261007-104449-61044b91`)는 코드로 확인하지 못해 정본에 쓰지 않았다.
- `VocabAttempt.exampleSnap` 이 `refType='AiWord'` 카드에만 쌓이는지: `insertSession` 은 `wordId=null` 인 카드 중 예문 쌍이 있으면 저장하고 `refType` 조건은 없다(풀 카드는 `example:null` 로 들어와 실제로는 새 단어만) — 정본에는 「새 단어(AiWord) 카드의 …스냅샷, 풀 카드·옛 행은 NULL」로 적었다.

### ④ 「발견」 — 고치지 않았다
- **F1 (모듈 소유)** `learning/topics/remove.ts:170` 이 `tx.challenge.deleteMany`(진행 중 행)를 쓰고 `topics/visible.ts:43` 이 `db.challenge` 를 읽는다 — 다른 층이 아니라 같은 L3 안이라 층 규칙 위반은 아니나 `challenges` 모듈이 `Challenge` 쓰기를 독점하지 않는다(정본에 예외로 적음). `seedOverride/topicRemoval.ts:13` 은 `challenges/settle` 을 직접 import(index 에 없는 `settleExpiredTx`).
- **F2 (index 우회)** `challenges/service.ts`·`topicProgress.ts` 는 `../topics/pool`·`../topics/visible` 을 파일 단위로 import(`../topics` index 아님). 같은 모듈(`learning`) 안이라 ESLint 규칙(§3, `@/modules/*/*` 금지) 밖이지만 정본에 서브모듈 간 import 규칙이 없다.
- **F3 (코드 주석 낡음)** `settle.ts` 머리·`src/types/challenge.ts` 의 `ChallengeEndReason` 주석은 `TOPIC_REMOVED` 를 「1단계 도달 불가 — 주제를 지우는 경로가 없다」로 적었으나 task-045 에서 #173 이 생겼다(진행 중 행을 삭제하므로 정상 경로로는 여전히 도달 불가 — 「지우는 경로가 없다」 문구만 낡음). `challenges/index.ts` 머리 import 목록에 `../topics/visible` 이 빠져 있다.
- **F4 (계약)** `src/types/speech.ts` `UtteranceContextKind` 에 `'DELETED'` 가 있으나 `speech/utterances/list.ts` `contextOfRow` 는 5종(`TALK`·`LESSON`·`EVALUATION`·`ROOM_ONLY`·`UNSENT`)만 만든다 — api-contract #21c 에는 5종만 적었다.
- **F5 (문서 부채, 범위 밖)** `module-dependency.md` §2 L3 「소유 테이블」 행에 `RepetitionItem`·`Scenario`·`ScenarioTopic`·`UserSeedOverride` 가 없다(domain-model §1 에는 있음) — 이번에 건드리지 않았다.
- **F6 (해석)** `Challenge` 스키마 주석은 「규칙 1 의 DIRECT 행위」라 하지만 만들기·그만두기는 `StudyLog`·`StatsSnapshot` 을 쓰지 않는다(challenge.md §3-4 의도, 서비스 머리 주석 「쓰기는 Challenge 만」). 정본 §4-3 행에 명시했다 — Reviewer 가 규칙 1 문구와 어긋나지 않는지 확인.

### ⑤ D4 변경 없음 + 근거
- `role-permission.md:161` 「사용자 API(`/api/v1/*`)는 인증 + 소유자 검사(타인 리소스 404)만이고 capability 는 `settings.*`·`voices.read` 두 계열만 관여한다」 — 챌린지 4개 라우트는 `requireSession()` + `where {id, userId}` 만 쓴다(`grep requireSession|can(` 결과 4파일 모두 requireSession 뿐, capability 호출 0). 역할극 종료(#167)·예문 관련 capability 도 문서에 없고 코드에도 없다.
- `configuration-resolution.md`: 챌린지·`vocab/sessions`·예문·역할극 키워드 grep 0건. 챌린지 모듈은 `AppSetting`·`ConfigurationVersion`·설정 해석을 쓰지 않는다(`grep AppSetting|ConfigurationVersion` 0건) — 상한·허용값은 코드 상수(`CHALLENGE_CREATE_PER_DAY=20`, 7·14·30, 5·10·15), 하루 단어 수 기본값은 `Profile.dailyWordCount`(`preferences.getProfile`)다.

## Reviewer 기록 (REV-178) — 중간 (체크포인트)
- [CP1 항목1 domain-model] 확인 완료: Prisma 블록(ChallengeStatus·Challenge·VocabSession·VocabAttempt·ConversationTopic·EngineMetricsDaily)을 schema.prisma 와 awk 추출 diff → Challenge/VocabAttempt/ConversationTopic/EngineMetricsDaily 동일, VocabSession 은 `seed` 주석만 문서가 더 길다(이번 커밋 밖 기존 차이, schema.prisma 쪽이 낡음). §5-9·§4-3·§9-3(VOCAB_SESSION data·dailyGoal·result)·§6 행은 settle.ts/service.ts/metrics.ts/snapshots/index.ts 와 일치. 지적 후보는 아직 없음. 다음: 항목2(라우트·에러 코드)·3·4.
- [CP2 항목2·3·4 일부] #155~#159 라우트·서비스·validate·settle·view·progress 와 §1-5a/§2-31 를 줄 단위 대조 → 응답 모양·상태 코드·에러 details·Cache-Control·Retry-After(http.ts:51)·recentlyEnded.endedAt·#160 미사용(`/api/internal` 에 challenges 없음) 일치. #62(complete/route.ts:26 NEW 만)·#51(finish/route.ts:23 DONE∧topic)·#70·#71(calendar.ts:50-56,188)·#58(today.ts) 챌린지 칸 일치. import 서술은 challengeService.test.ts:478-495 가 검사하는 규칙과 일치. 불일치(문서 줄): api-contract 1051(#58 `reason ∈ CONTINUE|NEXT_TOPIC|START` 에 CHALLENGE 없음) · §1 총람 #47/#51/#62/#70/#71 행(172,176,187,201,202)이 additive 필드를 반영 안 함 · #48/#49/#51/#53 `topic`·#47 `generation`·#51 `wrongWords[].source` 누락(코드 sessions.ts:72-96,179,579,709 로 확인됨).

## Reviewer 기록 (REV-178)
(위 「중간」 블록을 이어 완성. 읽기 전용 감사 — 문서·코드·스키마 무수정, 빌드·서버·DB 접속 없음.)

**판정: PASS-with-fixes** — Critical 0 · High 0 · Medium 4 · Low 4. 챌린지 본체(Challenge/ChallengeStatus 스키마, #155~#159, `learning/challenges` import 서술)는 코드·스키마와 일치한다. 고칠 곳은 모두 **인접 엔드포인트 스펙의 누락·낡은 enum·"읽기만" 한 줄**이며, 챌린지 구현자가 오구현할 만한 오류는 찾지 못했다. 보이지 않는 문자 0, 표 열 수 불일치 0(변경 추가 행 전수 검사).

### 항목별 결과
| # | 항목 | 결과 | 근거 |
|---|---|---|---|
| 1 | domain-model | 일치 | Prisma 블록 6개를 schema.prisma 와 추출 diff: Challenge·VocabAttempt·ConversationTopic·EngineMetricsDaily 동일, `enum ChallengeStatus` 동일(schema:274, awk 가 머리 주석에 걸려 오탐했으나 본문 4줄 일치), VocabSession 은 `seed` 주석만 문서가 더 긺(이번 커밋 밖 기존 차이). §5-9 전이는 `settle.ts:25-64`·`service.ts:131-143`, §4-3 `createChallenge` 순서는 `service.ts:65-129`, §9-3 `dailyGoal`/`result` 는 `metrics.ts:34-47,341-363`, VOCAB_SESSION `data{date,topicId?}` 는 `snapshots/index.ts:140-150`, §6 삭제 행은 `topics/remove.ts:170`·FK SetNull 과 일치. `wordsMinAnswered` 정수식 `floor((4n+4)/5)` = ceil(4n/5) 동치(5·10·15→4·8·12). |
| 2 | #155~#159·#160 | 일치 | 라우트 4파일: 메서드·경로·본문 상한(4KB/1KB)·`Cache-Control`(#155·#157·#158 만 `private, no-store`)·`requireSession`만(capability 0). `validate.ts`(unknown_key·NO_TASK·status·limit 1~50·cursor 400), `service.ts`(TOPIC_GONE 404·ACTIVE_EXISTS 409 `challengeId`·429 `retryAfterSec`+`Retry-After`=`http.ts:51-52`·WORD_COUNT_OVER_POOL `poolSize`·NOT_ACTIVE `status`·`recentlyEnded.endedAt` 어제 00:00 KST 이후), `finishedViewOrSkip`(깨진 dailyGoal 행 제외) 전부 일치. #160: `src/app/api/internal` 에 `speech` 만 있고 `challenges/prepare` 없음 → "쓰지 않음" 맞음. |
| 3 | #21c·#66·#47/#50·#62/#51/#58/#70/#71 | 일치 + 누락 | #21c 13필드·쿼리 키·reviewable 조건·`private,no-store`·60/분 = `speech/utterances/list.ts`·`route.ts` 일치(`DELETED` 는 타입에만 있고 `contextOfRow` 는 5종 — 문서의 5종이 맞음). #66 `voiced` = `_lib/evaluationVoiced.ts`(대조 실패 시 칸 제거, 문항 최대 50 = `speech/utterances/evaluation.ts:64`). CHOICE 정합성: `toCardDto`(sessions.ts:212-232) — CHOICE 미답 카드는 `example` 키 자체가 없고 답한 카드·DONE 에서만 공개, FLIP 은 처음부터, `exampleOf` 우선순위 단어장>스냅샷>null(199-201) = 문서와 일치. #62(`complete/route.ts:26` NEW 만)·#51(`finish/route.ts:23` DONE∧topic)·#70/#71(`calendar.ts:50-56,187-188`)·#58(`today.ts:48,87-97`) 일치. 누락·낡은 곳은 아래 M-1~M-3. |
| 4 | module-dependency | 일치 + 1건 | `index.ts` export 13줄 = 문서 목록 전부. 실제 import(`store.ts`·`service.ts`·`topicProgress.ts`) = 문서 서술, `lessons/vocab/studyLog/conversation/engine/speech/admin` import 0 (`challengeService.test.ts:478-495` 가 같은 규칙을 단언). 쓰기 독점 예외 = `remove.ts:170` 1곳(그 외 `Challenge` 쓰기는 `settle.ts:37`·`service.ts:101`뿐) 정확. 외부 호출자 = `calendar.ts:17`·`today.ts:17`·`generate.ts:21`(전부 `../challenges` index)·`topicRemoval.ts:13`(`../challenges/settle` 직접). §10 표·L3 항목·조합 bullet 상호 모순 없음. M-4 만 부정확. |
| 5 | 내부 일관성 | 일치 + 1건 | #155~#159·#21c 번호 겹침/빈 번호 없음, §1-5a·§2-31 앵커·`challenge.md` 링크 유효, 총람 건수 문구 없음. `role-permission.md:161` 주장 맞음(챌린지 라우트 `can(`·`AppSetting`·`ConfigurationVersion` grep 0, `configuration-resolution`·`role-permission` 에 challenge 언급 0 → 변경 불필요 승인). 모순 1건 = M-1. |
| 6 | 보이지 않는 문자·표 | 통과 | 변경 추가 라인 전수 유니코드 범주(Cf/Cc/Zs≠space) 검사 0건, 추가 표 행의 비이스케이프 `|` 개수 = 각 표 머리 열 수 (domain-model·api-contract·module-dependency). |
| 7 | 미확인 5건 | 해소 4 / 유지 1 | 아래 「7번 해소」. |

### 지적 목록
- **M-1 (Med)** api-contract.md:1051 — #58 `recommendation` 의 `reason ∈ CONTINUE|NEXT_TOPIC|START` 가 낡았다. 같은 문서 §2-31(1920행)은 `CHALLENGE` 를 추가했다고 쓰므로 정본 안에서 모순. 코드: `lessons/today.ts:48` `'CONTINUE'|'NEXT_TOPIC'|'START'|'CHALLENGE'`. [확실] 권고: 1051행을 `reason ∈ CONTINUE|NEXT_TOPIC|START|CHALLENGE`(CHALLENGE = 진행 중 챌린지 주제 최우선, §2-31)로 고친다.
- **M-2 (Med)** api-contract.md §1 총람 #47(172)·#51(176)·#62(187)·#70(201)·#71(202) 행이 additive 칸을 반영하지 않았다 — #47 요청이 아직 `{count?,mode?,category?}`, #51 응답 "집계", #62 응답 `{lesson,studyLogId,…,result}`, #70 `{days[]}`, #71 `{date,logs[],attended}`. 정보는 §2-10 bullet·§2-31 끝에만 있다. 코드: `vocab/sessions/route.ts:45`(topicId·generate), `finish/route.ts:24`·`complete/route.ts:27`(`challenge`), `calendar.ts:50-56,187-188`. [확실] 권고: 각 행에 `topicId?·generate?` / `challenge` / `days[].challenge` 를 한 구절씩 덧붙인다(상세는 §2-31 포인터).
- **M-3 (Med)** api-contract.md §2-10 #47~#53 — 작성자가 「미확인」으로 뺀 항목이 코드로 확정됐는데 정본에 없다: ① 세션 DTO `topic: {id,title,lessonCardCount,aiCardCount}|null`(#47·#48 items·#49·#51·#52·#53 공통, `sessions.ts:72-96,179,623,635`) ② #47 `generation: {source:'AI'|'MIXED'|'TOPIC', generatedNow:boolean, reason:null|'SHORT'|'NEW_DONE'|'TIMEOUT'|'FAILED'|'INVALID'|'LIMIT'|'SKIPPED'}`(주제 세트 #47 응답에만, 저장 안 함 — `sessions.ts:118-121,579`·`topicSet.ts:44-52`) ③ 빈 상태 `empty.reason` 에 `TOPIC_EMPTY`·`TOPIC_ALL_DONE_TODAY` 추가(933행은 아직 3종 — `sessions.ts:64,569`) ④ #47 400: `topicId`+`category` 동시 → `reason:'with_topicId'`, `generate` 가 `topicId` 없이 오면 `reason:'topicId_required'`, 기본 `generate=true`(`sessions.ts:253-277`) ⑤ #51 `wrongWords[].source:'WORD'|'TOPIC'`(`sessions.ts:709,722`). [확실] 권고: §2-10 의 새 bullet 에 ①~⑤ 를 추가(위 enum 그대로).
- **M-4 (Med)** module-dependency.md:586 — "#158 은 … 생성 잡 상태(`infra.jobs.findActiveJob`)를 **읽기만** 한다"는 사실과 다르다. `findActiveJob` 은 오래된 QUEUED/RUNNING `AiJob` 행을 `FAILED('stale')` 로 닫는 쓰기를 한다(`infra/jobs.ts:98-113`), 코드 머리(`service.ts:1-8`)도 이 예외를 직접 적었다. 같은 취지로 api-contract §1-5a 머리 "DB 만"·§2-31 #158 "DB 만 읽는다"도 보강 필요. [확실] 권고: "`findActiveJob` 으로 생성 잡을 확인한다(이 함수는 오래된 QUEUED·RUNNING 잡 행을 `FAILED('stale')` 로 닫는 infra 기존 동작을 탄다 — 챌린지 쪽 쓰기는 아님, #58·#59 와 같은 함수)".
- **L-1 (Low)** api-contract.md §2-31 #156 — `wordCount` 생략 기본값 서술 불완전: 하루 단어 수 이하 선택지가 하나도 없으면 가장 작은 선택지(5)를 쓴다(`service.ts:56-61` `under.length ? … : fit[0]`). [확실]
- **L-2 (Low)** module-dependency.md:586 — 같은 `learning` 안의 형제 모듈 상대 경로 import(`../topics/pool`)는 ESLint §3(`@/modules/*/*` 금지) 대상이 아님(작성자 F2)을 한 줄 덧붙이고, `topics/pool.ts:10-13` 이 `../lessons/content`·`../repetition` 파일을 직접 쓰므로 "lessons 와 단방향"은 직접 import 기준임을 명시하면 오해가 없다. [확실]
- **L-3 (Low)** api-contract.md §2-31 #158 — 끝난 행의 `dailyGoal` 이 깨졌을 때 `recentlyEnded` 에서도 그 행을 뺀다(`service.ts:45-55,262` `finishedViewOrSkip`). 작성자 표 ⑥은 「#155·#158」이라 했으나 문서에는 #155 만 있다. [확실]
- **L-4 (Low)** domain-model.md Challenge Prisma 주석 「규칙 1 의 DIRECT 행위」 vs §4-3 「StudyLog·StatsSnapshot 을 쓰지 않는다」(작성자 F6) — §4-3 이 이유(challenge.md §3-4)까지 적어 모순은 아니다. Prisma 주석은 schema.prisma 와 바이트 일치가 정본 규칙이라 문서만 고치지 말고, 바꾸려면 두 곳 주석을 함께(Leader 결정). 조치 불요 가능. [가능성 높음]

범위 밖 확인(작성자 발견 대조): F1(`remove.ts:170`·`visible.ts:43`·`topicRemoval.ts:13`) · F2 · F3(`settle.ts:6` 「주제를 지우는 경로가 없다」 낡음, `challenges/index.ts:4` import 목록에 `../topics/visible` 누락) · F4(`types/speech.ts:19` `DELETED` ↔ `list.ts` 5종) · F5(module-dependency L3 「소유 테이블」에 `RepetitionItem`·`Scenario`·`ScenarioTopic`·`UserSeedOverride` 없음) 모두 코드/문서에서 **재확인됨**. 기존 차이 FYI: domain-model.md `VocabSession.seed` 주석이 schema.prisma 보다 길고 `User.seedOverrides` 위치가 다름(schema.prisma 가 뒤처짐, 이번 커밋 밖).

### 7번 해소
1. #47 `session.topic`·`generation`·`generate` 기본값·`topicId`+`category` 400 — **해소**(M-3 ①②④, 코드 인용 위).
2. #48/#49/#51/#53 `topic` — **해소**: #48 items = 세션 DTO(+`answeredCount`, `sessions.ts:623`)라 `topic` 포함, #49 `toSessionDto(s, topicCardCounts(attempts))`(635), #51 `wrongWords[].source`(722) · #53 은 주제 세트 스냅샷(`exampleSnap`)을 새 카드로 복사하고 세션 DTO 에 카운트를 싣는다(844, 872).
3. #58 응답 전체 형태 — **부분 해소만**: `recommendation` 객체 `{topicId,topicTitle,level,reason,nextPreview}`(`today.ts:97`)와 `reason` enum(M-1)은 확인, 응답 전체(`resume`·`todayLessons[]` 등)는 이번에도 끝까지 대조하지 않았다 → 미확인으로 유지.
4. 릴리스 id — **해소(코드 아님, vault)**: Phase 2 릴리스 `20261007-104449-61044b91` 이 task-041~044 를 포함한다(task-040:582·012b-2:666·012b-3:421·010d:2451). 정본에는 쓸 필요 없음.
5. 예문 스냅샷 refType — **해소**: 저장 조건은 `wordId == null`(`sessions.ts:376`)이지 `refType` 가 아니며, 풀 카드는 `example:null`(`topicSet.ts:358`)이라 실제로 `AiWord` 카드에만 쌓인다. 문서의 「새 단어(AiWord) 카드」 서술은 동작과 일치(조건이 refType 가 아님을 한 줄 덧붙이면 더 정확).

### QA 전달
문서 전용 task 라 `high_risk_areas` 없음, `native_change=false`. 수정(M-1~M-4, 선택 L-1~L-3) 뒤에는 변경 줄만 재대조하면 된다.

## Leader 처리 — REV-178 지적 반영 (커밋 `5123822`)
- **반영**: M-1(#58 `reason` 에 `CHALLENGE`) · M-2(§1 총람 #47·#51·#62·#70·#71 additive 칸) · M-3(§2-10 주제 세트 보강 — 400 규칙 `with_topicId`·`boolean`·`topicId_required`, `generation`, 세션 `topic`, 빈 상태 `TOPIC_EMPTY`·`TOPIC_ALL_DONE_TODAY`+CTA `MY_WORDS`, #51 `wrongWords[].source`·`reading`·`wordId` null) · M-4(`findActiveJob` 의 `FAILED('stale')` 쓰기 예외 — api-contract §1-5a 머리·#158, module-dependency 라우트 조합 bullet) · L-1(#156 `wordCount` 기본값 폴백) · L-2(형제 모듈 파일 경로 import 와 「단방향」 범위) · L-3(#158 `recentlyEnded` 깨진 `dailyGoal` 행 제외) · F5(module-dependency L3 소유 테이블에 `Scenario`·`ScenarioTopic`·`UserSeedOverride`·`RepetitionItem` 추가 — domain-model §1 과 맞춤).
- **검증 방법**: 리뷰어 권고문을 그대로 붙이지 않고 Leader 가 근거 코드 줄을 직접 읽고 썼다 — `lessons/today.ts:48`, `infra/jobs.ts:98-113`, `challenges/service.ts:45-62`·`262`, `vocab/sessions.ts:64·253-277·485·569·709·720·845`, `topics/pool.ts:15-16`. 초안에서 `generate=false` 의미를 잘못 적을 뻔해 `sessions.ts:485`(`reason='SKIPPED'`)로 문장을 고쳤고, `TOPIC_EMPTY`/`TOPIC_ALL_DONE_TODAY` 발생 조건은 `sessions.ts:567-569` 에서 읽어 적었다. 수정분의 보이지 않는 문자 0건, 변경 표 행 열 수 일치(9열 5행·2열 1행).
- **재감사 생략 이유**: 문서 전용·코드 변경 0 이고, 수정 문장은 REV-178 이 제시한 근거 줄과 같다. 리뷰어 문장 밖의 내용(`generate=false`·빈 상태 조건·`cta`)은 Leader 가 코드로 확인했다. 이 범위를 넘는 변경이 생기면 변경 줄만 다시 대조한다.
- **조치하지 않음**: **L-4** — `Challenge` Prisma 주석의 「규칙 1 의 DIRECT 행위」 문구는 `schema.prisma` 와 문서 Prisma 블록이 바이트 일치해야 하는 규칙이라 문서만 고치면 어긋난다. §4-3 이 「`StudyLog`·`StatsSnapshot` 을 쓰지 않는다」와 이유를 적어 모순은 아니다 → 스키마 주석 문구 정리는 다음에 스키마를 만질 때 같이(DB 변경 없음). **#58 응답 전체 형태**(`resume`·`todayLessons[]` 등)는 대조하지 못해 정본에 추가하지 않았다. **F3**(`settle.ts` 머리·`src/types/challenge.ts`·`challenges/index.ts` 머리 주석 낡음)·**F4**(`UtteranceContextKind 'DELETED'` 타입 vs `contextOfRow` 5종)는 코드 쪽이라 이번 범위 밖 → 백로그.

## 최종 요약 (사용자용)
- **무엇을 했나**: 구현된 챌린지가 정본 문서에 없던 문제를 메웠다. `domain-model.md` 에 `Challenge` 모델·`ChallengeStatus`·상태 전이·삭제 정책·예문 스냅샷 칸, `api-contract.md` 에 챌린지 API 5개(#155~#159)와 발화 목록(#21c)·평가 `voiced`(#66)·주제 단어 예문 규칙, `module-dependency.md` 에 `learning/challenges` 모듈 규칙을 코드 기준으로 적었다. `role-permission.md`·`configuration-resolution.md` 는 챌린지가 권한 항목·설정 해석을 쓰지 않아 바꿀 곳이 없음을 코드로 확인했다.
- **설계서와 코드가 달랐던 곳**: 코드가 정답이라 정본에는 코드 사실을 적었다 — 주제 404(사용자가 가린 시드 주제 포함), 429 `retryAfterSec`+`Retry-After`, 단어 장수가 주제 풀보다 클 때의 400 `WORD_COUNT_OVER_POOL`, 깨진 `dailyGoal` 행은 목록에서 제외, `Cache-Control: private, no-store` 등.
- **독립 감사(REV-178)**: 판정 PASS-with-fixes(High 0). 챌린지 본체는 코드·스키마와 일치했고, 인접 엔드포인트의 누락 8건을 반영했다. 코드·스키마·DB·운영은 건드리지 않았다.
- **커밋**: `ed94702`(작성) · `5123822`(감사 반영) — 둘 다 로컬이고 미 push. 문서·vault 만이라 push 해도 재배포는 일어나지 않는다.
- **남은 것(결정 아님, 백로그)**: 코드 주석 낡음(F3)·`UtteranceContextKind 'DELETED'` 계약 불일치(F4)·#58 응답 전체 형태 대조·`Challenge` 스키마 주석 문구(L-4).
