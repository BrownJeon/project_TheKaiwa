---
tags:
  - type/plan
aliases:
  - Phase 2 일괄 계획
  - phase2-batch
created: 2026-10-06
updated: 2026-10-06
base_ref: 5c3a701
---

# Phase 2 일괄 계획 (2026-10-06, 계획 담당 — 코드·정본 변경 없음)

> 사용자 지시 원문(2026-10-06, Leader 전달): **"지금부터 페이즈2작업에 전체 작업을 데모화면 승인없이 한번에 진행해주고 결과를 정리해서 알려줘"**
> 사용자 답(AskUserQuestion, Leader 전달 — 이 문서 작성자는 원문 대화를 보지 못함): **DB 전부 승인**(챌린지 D1·D2·D4·D5 + TTS 관측 `EngineMetricsDaily` 컬럼 확장 + task-039 `Correction.extraNoteKo` — 모두 추가만, 백업 후 한 번에 `prisma db push`) · **운영 배포는 모든 작업이 끝난 뒤 한 번에**(git push = webhook) · **M4 설치·배포 포함**(012b-4: narabas·torch 설치, tts-service 배포) · **챌린지는 U3=B2(오늘의 단어 LLM 생성), 나머지 설계서 권고**.
> **데모 게이트**: 위 지시 문장은 `check.mjs waive` 정규식에 걸리지 않아 **게이트 기록이 없다**(waived 아님). 편집 전 훅은 warn 단계라 막지 않지만 경고가 쌓인다. 각 task 이력서에는 지시 원문만 인용하고 `waived` 로 적지 않는다.
> 근거 표기: `파일:줄`(코드 `5c3a701` + 미커밋 작업 트리, 2026-10-06 21:30 확인) · `[확실]` 이번에 직접 읽음 · `[가능성 높음]` · `[추측]`.

---

## 0. 먼저 볼 것 — 계획 전제에 걸리는 사실 8가지

1. **"Phase 2 전체"에는 지시받은 WP 목록 밖의 일이 두 개 더 남아 있다.** `docs/design-spec.md:384-385` 의 **012c-2**(Prompt Registry·Playground·Voice 관리 — 데모 게이트, 스키마 없음)와 **012c-3**(TTS Quality·대시보드 — **DB 추가 U-C3**)이다. 012c 이력서 최종 요약도 후속으로 둘을 적어 두었다([[task-012c-console-p2]] 1241행). [확실] → 012c-3 의 표(`TtsQualityRun`·`TtsQualityResult`·`TtsAbCompare`)는 **이번 DB 승인 목록에 없다**(위 사용자 답의 3묶음뿐). 둘을 이번 일괄에 넣을지 사용자에게 한 번 확인해야 한다(§8 U-P1). 이 계획은 둘을 **"범위 확인 대기" WP 로만** 둔다.
2. **승인 목록 밖 DB 변경이 생길 수 있는 지점이 다섯 곳이다** — 챌린지 B2 를 비동기 잡으로 만들면 `JobKind` 값 추가 · B2 로 "여러 날 쓰는 단어 은행"을 두면 새 칸·표 · 챌린지 T6(역할극 완료 인정)의 `SnapshotKind` 값 추가(`docs/design/challenge.md:694`) · 010d 카드에 장소/상황 구분 칸(`challenge.md:662`) · 012b-3 에서 `TraceKind TTS` 추가([[task-012b-speech-p2]] 53행). **기존 enum 에 값을 더하는 변경은 공유 NAS DB 에서 특히 위험하다** — push 뒤 개발 쪽이 새 값의 행을 만들면, 아직 배포 전인 운영 구 Prisma client 가 그 행을 읽다 알 수 없는 enum 값으로 실패할 수 있다 [가능성 높음]. 이 계획은 다섯 곳 모두 **스키마 없이 가는 안을 기본**으로 두고(§1 각 WP), 그래도 필요하면 사용자 추가 승인 후 별도 push 한다.
3. **통합 `db push` 는 "맨 끝"이 아니라 웨이브 0 끝을 권고한다.** 승인된 변경은 전부 설계서에 모양이 이미 있다(`challenge.md:168-235` · `16-tts-productization-layer.md` §7.3 · `prisma/schema.prisma:759-760`). 끝에 push 하면 039·T1·T2·012b-3 의 **라이브 QA 가 전부 끝까지 밀려** 마지막에 직렬로 쌓인다. 추가만 하는 변경(새 enum 은 새 표 전용)이라 운영 구 코드에 영향이 없다 [가능성 높음 — task-018·010b 선례]. 절차는 그대로: 단일 작성자 → Reviewer PASS → 백업 → `migrate diff` 로 SQL 확인 → push(§4).
4. **마지막 한 번 배포는 롤백 단위가 "Phase 2 전체"가 된다.** 웹 롤백(`scripts/deploy.sh TheKaiwa --rollback`)은 039·챌린지·010d·012b 화면을 함께 되돌린다(DB 는 추가만이라 남아도 무해). 사용자가 정한 방식이라 따르되, 배포 전 **운영 모드 통합 검증**(빌드 복제본에서 `next build`+`next start`)을 필수로 넣었다(§7).
5. **전용 미러는 소스를 격리하지 않는다.** `scripts/sync-local.sh:23-37` 은 NFS `src/`·`prisma/`·`tests/` 를 `rsync -a --delete` 로 통째로 미러에 복사한다 — 미러가 몇 개든 **모든 WP 의 미완성 변경이 서로의 미러에 들어간다** [확실]. 미러가 막아 주는 것은 `node_modules`·`.next`·dev 포트·`prisma generate` 결과뿐이다. 그래서 충돌 방지는 **파일 소유 규칙(§2)** 이 전부이고, 다른 WP 의 반쯤 고친 파일 때문에 내 `tsc` 가 깨질 수 있다(§3 규칙 4).
6. **`cp -al` 하드링크 복제는 쓰기가 원본 미러로 새어 나갈 수 있다.** `next dev` 의 `.next/` 쓰기·`node_modules/.cache`·`node_modules/.prisma` 재생성이 기존 파일을 제자리에서 덮으면(O_TRUNC) 같은 inode 를 공유하는 메인 미러 파일도 바뀐다 [가능성 높음 — Node `writeFile` 기본 동작, 이 저장소에서 실측한 적 없음]. §3 의 복제 절차는 이 세 경로를 하드링크에서 뺀다.
7. **010d 카드 목록 캡처 없이 간다.** [[IMP-0017-scenario-card-menu]] 의 캡처 9장은 전부 대화방이다(카드 목록 화면 없음). 목록 화면은 IMP-0017 본문("장소와 상황에 대한 목록들이 있는 카드")과 승인된 010d 데모 v1 의 주제→상황 구조로 대신한다 — 사용자가 본 amiko 카드와 모양이 다를 수 있다(§8 U-P4).
8. **A1(회화 턴) 요청 천장이 사실상 꽉 찼다.** task-039 작업본 기준 최악 조합 2,991/3,000(마진 9자), TALK persona 2,765/2,800(마진 35자) — [[task-039-improve-tutor-explanation]] 141행 [확실]. 010d 의 `[상황]` 헤더·답장 연습 제안은 이 천장 안에 들어갈 자리가 없다. 상황 모드에서 다른 블록을 빼는 설계(PE) 또는 천장 규칙(`CLAUDE.md:70` "A1 프롬프트 ≤3,000자") 변경 결정이 010d-A1-PE 착수 전에 필요하다(§8 L-2).

---

## 1. 작업 패키지 (WP)

### 1-1. 요약 표

| WP | 범위 요약 | 역할 | DB 소유 | risk | 트랙 추정 | 선행 | 에이전트 호출(추정) |
|---|---|---|---|---|---|---|---|
| **WP-039** | dev-039c 재감사 → (DB0 push 뒤) QA 라이브·3폭 → A3 v3 20회 보충 측정 → 로컬 커밋 | reviewer·judge(C2 재판정)·qa·prompt-engineer | `Correction.extraNoteKo`(이미 작업 트리 — push 는 DB0 가 함께) | R2 | standard(진행 중) | — | 3~5 |
| **WP-DB0** | 승인 스키마 **단일 작성**(D1·D2·D4·D5 + EMD 6칸) + 스텁 barrel + QA 계정 3·4 → 통합 push | developer(1)·reviewer(1)·Leader | **전부(단일 작성자)** | R2 | standard·demo none | 챌린지 v2.3 의 DB 목록 확인 | 2 + Leader |
| **WP-041 (T1)** | 챌린지 서버 코어 `learning/challenges/**`·#155~#159·#58·#62 응답·#70·#71 | developer·reviewer·judge C2·codex?·qa | 없음(DB0) | R2 | standard·none | DB0 | 4~6 |
| **WP-042 (T2+T5, B2)** | 주제 단어 세트 서버 + **A12 LLM 생성(B2)**·#47·#51·#53·세션 DTO | prompt-engineer·developer·reviewer·C2·qa | 없음(**B2 를 동기로**) | R2 | standard·none | DB0 · v2.3 · PE A12 | 6~8 |
| **WP-043 (T3)** | 계획표·챌린지 화면 S1~S5·S8 | designer(가이드)·developer·reviewer·qa | 없음 | R1 | standard(신규 화면) | 041 | 4~5 |
| **WP-044 (T4)** | 오늘 탭 연동·주제 단어 화면 S6·S7 | designer·developer·reviewer·qa | 없음 | R1 | standard | 041·042 | 4~5 |
| **WP-045 (T6)** | 챌린지 × 시나리오(하루 과제 역할극 1회) | — | `SnapshotKind` 값 가능(**승인 밖**) | R2 | — | 010d 전부·043·044 | **보류 권고**(U-P2) |
| **WP-010d-A** | 서버·프롬프트: A1-서버(대화 생성·종료 트랜잭션, 라우트 가드 유지) → 시드 10+steps·AI 초안 생성(동기) → A1-PE(상황 헤더·종료 판정·답장 연습 제안) → A2(상황 수업) → A3(목록·상세·추천·#58·가드 해제) | prompt-engineer·developer×2~3·reviewer·judge C1·C2·codex·qa | 없음 권고(§1-2) | R2 | standard | 039 로컬 커밋(A1-PE·A2) · 041(today.ts) · L-2 천장 결정 | 12~16 |
| **WP-010d-B** | 화면: 회화 탭 '시나리오' 항목·카드 목록·상황 확인·역할극 회화방(목표 카드·표현 체크·코치)·**답장 연습 3모드**·결과 카드·레슨 종료 연결·초안 만들기/고치기 | designer·developer×2·reviewer·qa | 없음 | R2 | standard | 010d-A · 012b-2(TalkRoom) | 7~9 |
| **WP-012b-2** | 재확인 2안 카드(회화방·채팅방) · 내 발화 기록 · 평가 결과 인식 텍스트 표기 | designer·developer·reviewer·qa | 없음 | R1~R2 | standard | 039 커밋(MessageList) | 5~6 |
| **WP-012b-3** | `EngineMetricsDaily` 물화(읽을 때 지연 물화 권고)·TTS 컬럼·`GET /api/admin/v1/tts/metrics`·캐시 예열/정리 | developer·reviewer·qa | EMD 6칸(작성은 DB0) | R1~R2 | standard(마이그레이션 동반 → light 불가) | DB0 | 3~4 |
| **WP-012b-4** | narabas 스파이크(A 강제정렬 vs B duration) → M4 tts-service timing 후처리 → `TtsCache.timing` 부착·#24 JSON → 자막·섀도잉 강조 화면 → M4 배포 | developer(M4·앱)·designer·reviewer·qa·deployer | 없음(칸 이미 있음 — `schema.prisma:1404-1407`) | R2(M4 운영 서비스·공유 venv) | standard | 스파이크 → 012b-3(같은 `speech/tts` 파일) | 8~10 |
| WP-012c-2 | (범위 확인 대기) Prompt Registry·Playground·Voice | — | 없음 | R2 | — | U-P1 | (8~12) |
| WP-012c-3 | (범위 확인 대기) TTS Quality·대시보드 | — | **U-C3 미승인** | R2 | — | U-P1 + 012b-3 | (8~10) |

- 트랙: 모든 WP 가 **light 불가**로 추정한다 — light 차단 조건(파일 12개 초과·신규 화면·마이그레이션·인증/권한, `.claude/agents/leader.md` `<agent_dispatch>` §4) 중 하나 이상에 걸린다. 최종은 judge.
- developer 모델은 judge `developer_model` 이 정한다(추정: R2 서버 = opus, R1 화면 = sonnet 가능).
- **task 번호 후보(챌린지)**: task-041(T1) · task-042(T2+T5) · task-043(T3) · task-044(T4) · task-045(T6, 보류). 이력서는 design-040f 의 v2.3 이 끝난 뒤 Leader 가 만든다. 012b 후속은 이번에 [[task-012b-2-analysis-result-ui]] · [[task-012b-3-tts-observability]] · [[task-012b-4-tts-timing-m4]] 로 만들었다.

### 1-2. WP 별 상세

**WP-039 마무리** — [[task-039-improve-tutor-explanation]]
- 지금: REV-115 PASS_WITH_NOTES(H-1 운영 게이트·M-1·M-2·L-1~6) → Codex C2(20:23) → dev-039c 가 L-1·M-1 수정(20:46). **남은 것**: reviewer 재감사(dev-039c 변경만) → judge C2 재판정 여부 → DB0 push 뒤 QA → A3 `chatReview@v3` 20회 위반율(구독 한도 리셋 뒤, PE) → 로컬 커밋(pathspec — 039 파일만).
- 완료 기준: REV-115 high_risk 1~6 실행 확인(교정 저장 왕복 실 DB·`original` 바이트 불변·`task007-latency` p95·3폭·스크롤 따라가기). 커밋은 **로컬만**(push 금지 — 마지막 일괄).
- 이 WP 의 로컬 커밋이 010d-A1-PE·010d-A2·012b-2 화면의 선행이다(같은 파일, §2).

**WP-DB0 스키마 단일 작성 + 통합 push** (기록 위치: task-041 이력서 "스키마" 절 + [[task-012b-3-tts-observability]] 교차 기록)
- 범위: `prisma/schema.prisma` 에 `challenge.md:170-235` 그대로(enum `ChallengeStatus` · model `Challenge` · `VocabSession.topicId`+관계+`@@index([userId, topicId, date])` · `VocabAttempt.refType`·`refId` · 역방향 관계 `User.challenges`·`ConversationTopic.{challenges, vocabSessions}`) + `EngineMetricsDaily` 6칸(`p99Ms Int?`·`ttfaP50Ms Int?`·`ttfaP95Ms Int?`·`rtfAvg Float?`·`cacheHitRate Float?`·`byVoice Json?` — `16-tts-productization-layer.md` §7.3) + 기존 `extraNoteKo` 유지.
- 덤(충돌 제거용 스캐폴딩): `src/modules/learning/{challenges,scenarios}/index.ts` 빈 모듈 + `src/modules/learning/index.ts` export 2줄 · `tests/live/qa-session.ts` 에 QA 계정 3·4(provider `test` — 레인별 계정 분리, §6).
- 완료 기준: `prisma validate`·`generate` 통과 · `prisma migrate diff --from-url … --to-schema-datamodel prisma/schema.prisma --script` 출력이 **승인 목록의 문장만**(표 1·enum 1·칸 2+1+2+6·인덱스·FK) — 그 밖(예: task-018 이 남긴 옛 인덱스 삭제 문장)이 나오면 push 하지 않고 Leader 판단(`challenge.md:275-278` 절차).
- B2 가 스키마를 요구하는지(v2.3)를 먼저 확인한다 — 요구하면 사용자 추가 승인 전에는 그 줄을 넣지 않는다.

**WP-041 (T1) 챌린지 서버 코어** — 정본 범위 `challenge.md:920`. 완료 기준·테스트는 그 행과 §6-4 확인 표 1~14, §5-4 null 조건 목록 그대로. QA 라이브: 동시 #156 두 개 → 하나 409 · 끝낸 뒤 새로 만들기 · 타인 404 · 삭제 전후 지표 동일 · 23:59/00:01 경계 · **챌린지 때문에 더 생긴 LLM 호출·Trace·AiJob 0**(결정적) · "진입 직후·끝낸 직후 회화 TTFA" 참고치 30턴(LLM 직렬 슬롯, §6).

**WP-042 (T2+T5) 주제 단어 세트 서버 — U3=B2** — 설계서 v2.2 는 B1 권고라 **v2.3 반영 필요**. v2.3 이 정해야 할 것(계획 담당 제안):
- ① 생성 시점 = 오늘 카드 [시작하기] 때 동기 생성(LLM 은 트랜잭션 밖, 결과 검증 후 세트 트랜잭션) — 비동기 잡이면 `JobKind` 값(승인 밖, §0-2) ② 저장 = **세트 카드 스냅샷에만**(`VocabAttempt.surfaceSnap/readingSnap/meaningSnap` + D5 `refType='Expr'`, `refId`=`repetitionRefId(textJa)` — 수업 표현과 같은 키 규칙, `challenge.md:316`) — "단어 은행" 표는 만들지 않음 ③ 중복 회피 = 같은 주제 최근 세트의 카드 표기 목록을 A12 입력 "이미 있는 표기"로(`challenge.md:340` P2 입력 그대로) ④ 검증 = A10 수준 `valid`·가나 읽기·수준 창 ⑤ 실패 시 = B1 풀(주제 기본 표현) 세트로 대체하고 화면에 그 사실 표시(B3 와 비슷해지므로 사용자 원문 "AI 가 매일 새 단어"와의 차이를 문구로 밝힘) ⑥ 5초 예산 = 생성 호출은 batch 레인, 사용자가 기다리는 중이라 레슨 C3+ 와 같은 노출(`challenge.md:377`) — "세트 시작 직후 회화 첫 턴" 참고치 측정 추가 ⑦ 세션 DTO `lessonCardCount` 문구("지난 수업 표현 n개 포함")는 B2 에서 의미가 바뀜 — 데모 v2 의 U3 카드 B2 문구("오늘 처음 보는 「카페 주문」 단어 10장")로 가이드 교체.
- 파일: PE `src/modules/conversation/prompts/topicWords.ts`(신규 — **스키마도 이 파일 안에**, `structuredResponse/schemas.ts` 는 건드리지 않음) + 픽스처 · developer `learning/topics/pool.ts`·`learning/vocab/{sessions,distractors}.ts`·`app/api/v1/vocab/sessions/**`(finish 라우트의 `challenge?` 조합 포함 — T1 머지 뒤)·`types/vocab.ts`.
- QA 라이브: 정답 미노출(#47 응답에 `meaningSnap`·`refId` 없음) · 키 동일성(수업 완료 뒤 같은 표현 카드가 같은 `RepetitionItem` 행) · 생성 실패 폴백 · 삭제 후 #54 불변 · 생성 지연 p50/p95 · 오늘 제외 = 같은 주제 답한 카드만.

**WP-043 (T3) / WP-044 (T4)** — `challenge.md:922-923`. designer 는 **승인 안 된 데모 v2**(`docs/demo/task-040-improve-challenge-design-v2.html`)와 v2.3 차이를 구현 가이드로 낸다(B2 문구·U3 카드 제거). QA: 3폭×2높이, 44px, 화면당 스크롤 1곳, 엔진명 0, `challengeProgressAfter` null 일 때 줄·토스트 없음, 다른 주제 수업이 끝났거나 열린 날의 회화 카드 주인(S6).

**WP-010d-A 서버·프롬프트** — [[task-010d-scenario-roleplay]] "Phase 2 일괄" 절 참고. 순서와 DB 없는 설계:
- A1-서버(지금 가능): `conversation/chats/**` 대화 생성 서비스(가드 `chats/validate.ts:63-64` 유지 = G1, `challenge.md:681-688`) · `learning/scenarios/**` 종료 트랜잭션(S1 = `StudyLog(TALK, DIRECT)`+`RepetitionItem(SCENARIO)`+`LearningObservation(SCENARIO_COMPLETED)` — 관측 매핑 이미 있음 `learning/observations/index.ts:26`) · 정본 정리 #21·#22(`domain-model.md:2531-2532`, Leader).
- 시드·초안(PE 직렬 슬롯): `prisma/seed-data/scenarios.json` 10개 + `steps[]`(IMP-0021 — `goal`/`constraints` JSON 안, 스키마 없음) · **AI 초안 생성 프롬프트(신규 파일)** — 사용자가 상황을 말하면 단계 포함 초안 → 응답으로만 돌려주고, 사용자가 고쳐 [저장]할 때만 `Scenario(userId)` 행 생성(제안→채택, `Scenario.userId` 이미 있음 `schema.prisma:975`). **동기 요청**(잡 없음 → `JobKind` 불필요).
- 장소/상황 구분: **장소 = 주제(`ConversationTopic`), 상황 = `Scenario`, 연결 = `ScenarioTopic`**(이미 N:M) — 카드 구분 칸 없이 표현 [추측 — 캡처가 오면 다를 수 있음].
- A1-PE(039 로컬 커밋 + L-2 천장 결정 뒤): `[상황]` 헤더(stdin 쪽 — `--system-prompt` 안정성, 010d 이력서 61행) · 종료 판정 `learning.scenario` · **답장 연습 제안의 공급 방식 결정**: (a) 상황 모드 TALK 응답에 `practice{…}` 칸 추가(출력 토큰·`done` 지연 증가, 조기 추출 순서 뒤에 둬야 함) vs (b) [탭하여 답장 연습]을 누를 때 별도 짧은 호출(턴 지연 무관, 호출 1회 추가) — PE 실측 후 Leader 결정(L-3). 권고 (b) [추측 — 턴 5초 예산 보호가 우선].
- A2(039 커밋 뒤): #59 `{scenarioId}` 상황 수업(A4 `[상황]` 블록 — `conversation/prompts/lesson.ts` 는 039 수정 파일) · 상황 수업 `Lesson.topicId` 채움 규칙(챌린지 인정과 연결 — `challenge.md:661,674`).
- A3(041 머지 뒤): `learning/scenarios` 목록·상세·추천 · `GET /api/v1/scenarios` · #58 `recommendedScenarios[]`(`learning/lessons/today.ts` — 041 과 같은 파일) · 가드 해제(`validate.ts:63-64`) · orchestrator 가 `learning.scenario` 를 종료 함수에 넘김.
- QA 라이브(LLM 직렬 슬롯): 시드 10 상황 × 역할극 1회씩 종료 판정 · 코치 모드 강제(`talkDelivery.ts:23-24`) · 종료 한 트랜잭션 행 수 대조 · 초안 생성 → 고쳐 저장 → 내 상황 목록 · 타인 404 · **회화 TTFA·턴 p50 회귀 없음**(A1 천장 변경 시 필수) · 엔진명 0.

**WP-010d-B 화면** — 범위는 IMP-0017 사용자 결정 3개(`IMP-0017` "사용자 결정 2026-10-03") + IMP-0021(단계 진행·AI 초안) + 승인된 v1 데모의 역할극 회화방·결과 카드. **제외**: 배경 스토리 카드·듣기 모드·⋮ 설정 메뉴(사용자 결정 ②). 오늘 탭 "주제→상황 2단 선택"(v1 데모)은 진입점이 회화 탭 '시나리오'로 바뀌어(사용자 결정 ①) **오늘 탭에는 넣지 않기를 권고** — T4 와 같은 파일(`TodayLessonCard`·`LessonTopicsScreen`)을 피한다 [추측 — designer 가 가이드에서 확정]. QA: 3폭·답장 연습 3모드(선택·말해보기·따라 읽기) 각 경로·푸시투토크 ≥64px·코치 힌트·결과 카드·레슨 종료 → 역할극.

**WP-012b-2 / 012b-3 / 012b-4** — 각 이력서에 상세. 요지: 012b-2 는 conversation DTO(#29·`types/chat.ts`)를 건드리지 않고 **speech 쪽 새 목록 API** 로 카드를 그린다(파일 경계) · 012b-3 은 **crontab 없이** 관리자 지표 요청 때 지난 날을 지연 물화(인프라 변경 = 승인 밖) · 012b-4 는 **M4 공유 venv 를 건드리기 전에 별도 venv 스파이크**.

---

## 2. 파일 소유 · 충돌 지도

| # | 파일/영역 | 건드리는 WP | 규칙(소유자 · 순서) |
|---|---|---|---|
| **C1** | `prisma/schema.prisma` | 039(이미) · DB0 · (조건부) 042·045·010d·012b-3 | **단일 작성자 = DB0 developer**. 다른 WP 는 수정 금지. `db push` 는 파일 전체를 반영하므로 push 직전 `git diff` + `migrate diff --script` 로 승인 범위만인지 확인(`challenge.md:275-278`). 추가 스키마가 생기면 사용자 승인 → DB0 작성자 재소환 → 2차 push |
| **C2** | `conversation/prompts/talk.ts` · `structuredResponse/{schemas,checks}.ts` · `orchestrator/{index,shape}.ts` · `.claude/agents/tutor.md` | 039(미커밋) · 010d-A1-PE · 042(A12) | **039 로컬 커밋 전 아무도 손대지 않는다.** A12 는 새 파일 `prompts/topicWords.ts` 에 스키마 동봉(schemas.ts 무수정). 010d 초안 프롬프트도 새 파일. **PE 는 1명이 직렬로**(A12 → 010d 시드·초안 → A1-PE). A1 마진 9자·persona 마진 35자(task-039:141) — 010d `[상황]` 헤더 전 L-2 결정 |
| C3 | `conversation/prompts/lesson.ts` | 039(lesson@v9) · 010d-A2 · (챌린지 P1 — 하지 않음, `challenge.md:290` "실측 없이 넣지 않는다") | 039 커밋 뒤 010d-A2 만 |
| **C4** | `learning/lessons/today.ts` | 041(#58 `CHALLENGE`) · 010d-A3(#58 `recommendedScenarios[]`) | 041 먼저, 010d-A3 는 041 로컬 커밋 뒤 |
| C5 | `learning/index.ts`(barrel) | 041 · 042 · 010d | DB0 가 `./challenges`·`./scenarios` export 를 미리 넣음 → 이후 각자 하위 `index.ts` 만 |
| C6 | `learning/vocab/{sessions,distractors}.ts` · `app/api/v1/vocab/sessions/**`(finish 포함) · `types/vocab.ts` | 042 | 042 단독. finish 라우트의 `challenge?` 조합은 041 의 `challengeProgressAfter` 로컬 커밋 뒤(`challenge.md:921`) |
| C7 | `app/api/v1/lessons/[id]/complete/route.ts` · `learning/studyLog/calendar.ts` · `app/api/v1/challenges/**` · `types/challenge.ts` | 041 | 041 단독 |
| C8 | `components/vocab/**` · `components/lesson/{TodayLessonCard,logic}.tsx/ts` · `app/(app)/study/today/**` | 044 · (010d-B 는 피함) · 012b-4(레슨 듣기) | 044 소유. 012b-4 는 `components/lesson/{StageUnderstand.tsx,useLessonPlayback.ts}` 만, 010d-B 는 `components/lesson/LessonEnd.tsx` 만 |
| C9 | `components/plan/**` · `app/(app)/plan/**` · `components/shell/routes.ts` | 043 · 010d-B(새 경로 등록) | 043 먼저. `routes.ts` 는 010d-B 가 043 커밋 뒤 줄 추가 |
| **C10** | `components/talk/**` | 012b-2(사용자 말풍선 재확인 카드 삽입) · 012b-4(자막 강조) · 010d-B(역할극 모드·답장 연습) | `TalkTutorBubble.tsx`·`useTalkPlayback.ts` = **012b-4 소유**. `TalkRoom.tsx` 는 012b-2 → 010d-B 순서. 010d-B 의 새 부품은 `components/scenario/**`(신규)에 |
| **C11** | `components/chat/**` | 039(미커밋: `CorrectionCard`·`MessageList`·`messages`·`labels`·`ChatReview`·`ExtraNoteLine`) · 012b-2(채팅방 카드 삽입) · 010d-B(`StudyAiHome`·`NewChatSheet` '시나리오' 항목) | 012b-2 는 039 커밋 뒤에만 `MessageList`/`MessageBubble` 을 만진다. 010d-B 는 `StudyAiHome`·`NewChatSheet` 만 |
| C12 | `src/types/chat.ts` · `conversation/chats/**` | 039 · 010d | 039 커밋 뒤 010d. **012b-2 는 둘 다 건드리지 않는다**(speech 목록 API 로 우회) |
| C13 | `speech/tts/{cache,metrics,synthesize,index}.ts` | 012b-3(예열·정리 잡) · 012b-4(timing 부착·`TTS_TIMING` step 화이트리스트 — `metrics.ts:9-17` 에 아직 없음) | 012b-3 먼저, 012b-4 앱 부분은 012b-3 로컬 커밋 뒤 |
| C14 | `speech/tts-service/**`(M4) | 012b-4 | 단독. M4 venv 는 공유 운영 자원 — 스파이크는 별도 venv |
| C15 | `engine/trace/**`·(신규) 지표 모듈 · `app/api/admin/v1/tts/**` | 012b-3 (나중 012c-3 이 읽음) | 단독 |
| C16 | `speech/utterances/**` · `app/api/v1/speech/utterances/**` · `components/eval/**` · `components/speech/UtteranceReviewCard.tsx`(신규) | 012b-2 | 단독 |
| C17 | `docs/design/{domain-model,api-contract,module-dependency}.md` · `design-spec.md` · `learning-personalization-and-llm-data.md` | 전 WP(039 는 이미 미커밋 변경 3개) | **Leader 단독**, WP 마다 Reviewer PASS 뒤 순서대로 반영 |
| C18 | `docs/screens.md` | 전 화면 WP | designer 1명. 가이드 본문은 먼저 각 task 이력서 `## Designer 기록`(vault — 충돌 없음)에 쓰고 웨이브 끝에 한 번에 `screens.md` 로 |
| C19 | `tests/live/qa-session.ts` · `tests/live/README.md` | DB0 · 전 QA | `qa-session.ts` 는 DB0 만. README 행 추가는 통합 QA 때 1명 |
| C20 | `prisma/seed-data/scenarios.json` · `prisma/seed.ts`(+신규 `seed-scenarios.ts`) | 010d | 010d 단독(PE = JSON, developer = 로더) |

**충돌 핵심 3개**: ① **C1 `schema.prisma`** — `db push` 가 파일 전체를 반영하므로 단일 작성자·1회 push 외에는 방법이 없다 ② **C2 TALK 프롬프트 군** — 039 미커밋 + 천장 마진 9자: 010d-A1-PE 는 039 커밋과 천장 결정 둘 다 기다린다 ③ **C10·C11 회화방·채팅방 부품** — 039·012b-2·012b-4·010d-B 네 WP 가 같은 방 화면을 만진다 → 파일 단위 소유 + 순서(039 → 012b-2 → 010d-B, 012b-4 는 말풍선·재생 파일만). 그다음이 C4 `today.ts`(041 → 010d-A3).

---

## 3. 병렬 developer 전용 미러 규칙

`scripts/sync-local.sh:18` 이 `KAIWA_LOCAL_ROOT` 를 받는다(작업 트리 미커밋 변경 — Leader). 메인 미러 `~/.node-local/thekaiwa`(2.2GB)는 Leader·리뷰어 재실행용으로 남긴다.

**복제 절차(권고 — `cp -al` 통째 복제 대신, §0-6 쓰기 전파 회피)**:

```bash
WP=041   # 미러 이름 = thekaiwa-<WP>
M="$HOME/.node-local/thekaiwa-$WP"
mkdir -p "$M/node_modules"
# node_modules 만 하드링크로(용량 0에 가깝게), 제자리 쓰기가 일어나는 캐시·Prisma 생성물은 빼고 복제
rsync -a --link-dest="$HOME/.node-local/thekaiwa/node_modules/" \
  --exclude '.cache/' --exclude '.prisma/' \
  "$HOME/.node-local/thekaiwa/node_modules/" "$M/node_modules/"
cp "$HOME/.node-local/thekaiwa/package-lock.json" "$M/"          # sync-local 은 lock 을 복사하지 않는다(:82-89)
KAIWA_LOCAL_ROOT="$M" bash scripts/sync-local.sh                   # src·prisma·tests·설정·.env(600) 반영
cd "$M" && ./node_modules/.bin/prisma generate                     # 이 미러 전용 .prisma 생성
PORT=30xx ./node_modules/.bin/next dev -p 30xx                     # dev 가 필요할 때만, 포트는 아래 표
```

Leader 지시대로 `cp -al ~/.node-local/thekaiwa ~/.node-local/thekaiwa-<wp>` 를 쓰면 `.next/`·`node_modules/.cache/`·`node_modules/.prisma/` 가 메인 미러와 inode 를 공유한다 — 이 경우 복제 직후 이 셋을 하드링크가 아닌 상태로 바꿔야 한다(이름 바꾸기 `mv` 뒤 재생성; `rm -rf` 는 훅이 막을 수 있어 정리는 사용자 몫 — ACTIVE `~/.node-local/thekaiwa-pre037/` 선례).

| 규칙 | 내용 |
|---|---|
| 1. 이름·포트 | `thekaiwa-p2db` · `-041`(3021) · `-042`(3022) · `-012b3`(3023) · `-010d-a`(3024) · `-043`(3025) · `-044`(3026) · `-012b2`(3027) · `-012b4`(3028) · `-010d-b`(3029). 3021~3029 는 2026-10-06 21:35 `ss -ltn` 기준 비어 있음. 3010(운영)·3011/3012(기존 dev) 사용 금지 |
| 2. 소스 편집 | **NFS 만** 편집(미러 편집 금지). 편집 뒤 자기 미러로 `KAIWA_LOCAL_ROOT=… bash scripts/sync-local.sh` |
| 3. Prisma | DB0 push 뒤 **모든 미러에서 `prisma generate` 1회**. 스키마는 DB0 만 바꾸므로 미러 간 생성물이 같다 |
| 4. 남의 미완성 변경 | 미러에 다른 WP 의 반쯤 고친 파일이 들어온다(§0-5). `tsc` 오류가 **내 소유 밖 파일**이면 고치지 말고 이력서에 기록 → Leader 가 소유자에게. 각 developer 는 체크포인트마다 **자기 파일이 컴파일되는 상태**로 둔다 |
| 5. 테스트 범위 | 단위는 자기 디렉터리(`node --test` 경로 지정) + 전체 `tsc`·`eslint`(변경 파일). 라이브는 §6 계정·슬롯 규칙 |
| 6. 빌드 | 미러 `npm run build` 허용(개발 전용). 운영 모드 통합 검증은 §7 의 빌드 복제본에서만 |
| 7. 정리 | WP 종료 시 dev 서버 종료·포트 확인(`ss -ltn`) — QA 가 dev 서버를 남긴 선례(ACTIVE 33행). 미러 디렉터리 삭제는 사용자 몫 |
| 8. 대안(충돌이 잦아지면) | WP 별 git worktree(소스 격리) + 그 worktree 에서 `sync-local.sh` → 미러. 병합 충돌이 조용한 덮어쓰기 대신 merge 때 드러난다. 대가: `.env` 를 worktree 에 따로 둬야 하고(`sync-local.sh:77-80` 은 PROJECT_ROOT 의 `.env` 만 복사), Leader 가 브랜치를 합쳐야 한다. 지금은 파일 소유 규칙으로 충분하다고 본다 [추측] |

---

## 4. DB — 단일 작성자 · 통합 push 절차

1. **작성**(WP-DB0 developer, 미러 `thekaiwa-p2db`): §1-2 범위만. `prisma format`·`validate`·`generate`. `migrate diff --script` 를 scratchpad 로 저장(읽기 전용 — DB 를 바꾸지 않음; 이 저장소에서 써 본 기록 없음 `challenge.md:277` [추측] — 안 되면 `git diff` 만).
2. **Reviewer**(스키마 전용 감사): 승인 목록과 1:1 대조 · 관계 `onDelete`(Challenge→User Cascade, topic SetNull) · 새 enum 이 새 표 전용인지(기존 enum 값 추가 0) · `activeKey @unique` · 인덱스 · `extraNoteKo` 2줄 외 변화 없음.
3. **Leader**: 백업(`…/backups/…-pre-phase2.sql.gz`, task-018 방식) → `migrate diff` SQL 을 이력서에 붙임(문장마다 소속 task 표시: 039/041·042/012b-3) → `prisma db push`(추가만 → `--accept-data-loss` 불필요) → 메인 미러 `prisma generate` → 운영 health 확인(구 코드 영향 없음 재확인) → 각 이력서·20-Log 기록.
4. **2차 push 가 필요해지면**(B2 비동기·T6·010d 카드 칸·TraceKind): 사용자 추가 승인 → 같은 절차. **기존 enum 값 추가**는 push 와 운영 배포 사이에 그 값의 행을 만들지 않도록 개발·QA 를 막는다(§0-2).

`challenge.md:278` 은 039 를 먼저 push 하라고 권고했지만, 사용자가 "한 번에"로 정했다 → 한 번에 하되 SQL 문장별 소속 task 를 남겨 승인 기록이 task 마다 추적되게 한다.

---

## 5. 웨이브 순서

```mermaid
flowchart TB
  subgraph W0["웨이브 0 (지금)"]
    R039["039 재감사"] --> Q039["039 QA·A3 20회 → 로컬 커밋"]
    V23["챌린지 v2.3 (design-040f)"] --> DB0["DB0 스키마 단일 작성 → 리뷰 → 백업·migrate diff·push"]
    DB0 --> Q039
    SP["012b-4 narabas 스파이크 (M4 별도 venv)"]
    DG["designer 가이드 ① 012b-2 ② 012b-4 ③ 010d-B ④ T3·T4"]
  end
  subgraph W1["웨이브 1 (DB0 push 뒤 병렬)"]
    T1["041 T1"]
    PE1["PE: A12 → 010d 시드·초안"] --> T2["042 T2+B2"]
    M3["012b-3"]
    A1S["010d-A1-서버"]
  end
  subgraph W2["웨이브 2"]
    T3["043 T3"]
    T4["044 T4"]
    B2UI["012b-2 서버+화면"]
    A1P["PE: 010d-A1-PE (039 커밋 + 천장 결정 뒤)"]
    A23["010d-A2·A3 서버"]
    M4A["012b-4 M4 서비스 + 앱"]
  end
  subgraph W3["웨이브 3"]
    DB["010d-B 화면"]
    M4U["012b-4 화면"]
  end
  subgraph W4["웨이브 4 통합"]
    IQ["통합 QA(운영 모드 빌드) → 커밋 정리 → M4 배포 → push(webhook) → 운영 스모크"]
  end
  Q039 --> W1
  DB0 --> W1
  T1 --> T3 & T4 & A23
  T2 --> T4
  M3 --> M4A
  Q039 --> B2UI & A1P & A23
  A1S --> A1P --> A23 --> DB
  B2UI --> DB
  SP --> M4A --> M4U
  W3 --> W4
  T3 & T4 --> W4
```

| 웨이브 | 병렬 묶음 | 소유 파일(요지) | 웨이브 사이 지점 |
|---|---|---|---|
| **0** | 039 재감사·QA · DB0 · 012b-4 스파이크 · designer 가이드(012b-2·012b-4 먼저 — v2.3 불필요) · judge intake 4건 | DB0 = C1·C5·C19 / 스파이크 = M4 별도 venv + scratchpad(저장소 변경 0) / designer = vault 이력서만 | **DB0 Reviewer PASS → push**. 039 judge C2 재판정(dev-039c 변경이 C2 이후라서) |
| **1** | 041 · (PE A12 →) 042 · 012b-3 · 010d-A1-서버 · PE 010d 시드·초안 | C7 · C6+`topics/pool.ts` · C13·C15 · `conversation/chats/**`·`learning/scenarios/**` | 각 WP Reviewer PASS → judge C2(R2 전부) → Codex(판정 시) → QA → **로컬 커밋(pathspec)** |
| **2** | 043 · 044 · 012b-2 · PE 010d-A1-PE · 010d-A2/A3 · 012b-4 M4 서비스+앱 | C9 · C8 · C16+C10(`TalkRoom` 삽입)·C11(039 커밋 뒤) · C2·C3 · C4·C12·C20 · C13·C14 | 010d-A1-PE 는 **C1 판정(judge codex_gate)** 대상 — 턴 경로 설계 |
| **3** | 010d-B · 012b-4 화면 | `components/scenario/**`·`TalkRoom`·`StudyAiHome`·`NewChatSheet`·`LessonEnd`·`routes.ts` / `TalkTutorBubble`·`useTalkPlayback`·`StageUnderstand`·`useLessonPlayback` | designer `screens.md` 일괄 반영(C18) |
| **4** | 통합 | — | §7 |

- 동시에 도는 developer 는 **최대 4명**(워크스페이스 규칙 "팀원 3~5명", 리뷰·QA 병목). 웨이브 1 = 4명(041·042·012b-3·010d-A1-서버) + PE 1 + designer 1.
- 리뷰는 WP 마다 따로(리뷰 범위 분리). judge C2 는 R2 WP 전부, Codex 는 판정 + 한도(`CX-limit-unknown` 이면 R2 만).

---

## 6. QA 라이브 · LLM 직렬화

| 규칙 | 이유·근거 |
|---|---|
| **LLM 을 쓰는 라이브는 한 번에 하나**(슬롯 1개): PE 측정 · 회화 TTFA/턴 p50 · A12·초안·역할극 스모크 · 039 A3 20회 · 006/007 회귀 | Claude CLI 는 프로세스마다 동시성 1 직렬 큐(`claudeCli.ts:660-702`, `challenge.md:371`)이고, 미러가 여러 개면 프로세스가 여러 개라 **구독 한도를 동시에 깎고 지연 측정이 서로 오염**된다. task-039 PE 가 구독 세션 한도로 측정을 못 끝냈다(20-Log 17:03). 운영 앱도 같은 계정을 쓸 가능성 [가능성 높음] |
| 슬롯 순서(권고) | 039 QA·A3 20회 → 041 TTFA 참고치 → PE A12 → 042 스모크 → PE 010d 시드·초안 → PE A1 상황 모드 → 010d 스모크·TTFA → 통합 회귀 |
| LLM 없는 라이브는 병렬 가능 | 041 API(#155~#159)·012b-3 지표·012b-2 목록 API·T3/T4 화면(데이터 고정) |
| **QA 계정 분리** | 지금 계정은 `qa-bot`·`qa-bot2` 뿐(`tests/live/qa-session.ts:17-18`). 006 스모크는 QA 계정의 스냅샷 행 수를 센다(6a·6b, task-038) — 챌린지·단어 세트 라이브가 같은 계정에 행을 만들면 다른 스모크가 깨진다. DB0 가 계정 3·4 추가 → **3 = 챌린지 레인, 4 = 010d 레인**, 1·2 = 기존 회귀·IDOR |
| 사용자당 1개 규칙 | 진행 중 챌린지 1개(`activeKey`)·풀던 세트 409·사용자 행 잠금 — 같은 계정으로 두 레인이 돌면 서로 409 |
| 개발 = 공유 DB | 라이브는 QA 계정만, 만든 행 정리 방법을 이력서에 남긴다(012b 선례) |

---

## 7. 마지막 커밋 · push · 배포 순서

1. **로컬 커밋**: WP 마다 QA PASS 직후 pathspec 커밋(작업 트리에 다른 WP 미커밋 변경이 있으므로 `git add -- <소유 파일>`). 커밋은 `git -c safe.directory=$PWD -c user.name=brownjeon -c user.email=ifries8611@gmail.com commit`(ACTIVE 43행). 038 로컬 커밋(`5fae350`)도 함께 나간다.
2. **운영 모드 통합 검증**(필수): `~/.node-local/thekaiwa-buildcheck` 복제(ACTIVE 40행 방식) → `next build` → `next start`(빈 포트) → 회귀 스모크 직렬(006·007·008·010·010b·011·012·012b·012c + 새 039·041~044·012b-2·012b-3·012b-4·010d) → 3폭 화면 E2E. 실패 시 해당 WP Reviewer 부터 재순환.
3. **M4 배포 먼저**(웹 push 전): `speech/tts-service/scripts/deploy-from-ubuntu.sh <sha>`(SSH push → M4 ff-merge → 핀 대조 → restart → smoke, 실패 시 직전 SHA 롤백 — `speech/tts-service/README.md:16`, `SETUP-M4.md:159`). timing 은 선택 파라미터라 구 앱과 호환이어야 한다(012b-4 완료 기준). `docs/deploy-order.md:98` 은 "git push 웹훅"이라 적었지만 README 기준 실제 경로는 이 스크립트다 [가능성 높음 — deploy-order 문구가 낡음].
4. **web push 1회**(= webhook 배포): DB 는 이미 push 됨 → `migrated:false` 기대. deployer: `RELEASE_RESULT ok`·health·pm2 3개 online.
5. **운영 스모크**(`SMOKE_ENV=PRODUCTION`, 포트 3010, LLM 슬롯 직렬): 007·006·010·011·012 회귀 + 새 WP 핵심 경로. admin 계열은 운영 세션 불가(ACTIVE 32행) → 012b-3 지표 API 는 사용자 SUPER_ADMIN 확인 항목.
6. **APK**: 네이티브 변경 예정 없음(전 WP 웹만) — 어느 WP 든 플러그인·Manifest·Capacitor 설정을 건드리면 그 WP 가 고지하고 deployer 재빌드.
7. 롤백: 웹 `--rollback`(전체) · M4 직전 SHA 재배포 · DB 는 추가만이라 유지.

---

## 8. 사용자 입력이 필요한 것 · 위험 · 확인 못 한 것

### 8-1. 사용자에게 물을 것(Leader)

| # | 항목 | 권고 | 막는 범위 |
|---|---|---|---|
| **U-P1** | 012c-2·012c-3 을 이번 "Phase 2 전체"에 넣을지 + 012c-3 DB(U-C3: `TtsQualityRun`·`TtsQualityResult`·`TtsAbCompare`) 승인 | 012c-2 는 포함(스키마 없음, 데모 생략 지시 적용) / 012c-3 는 DB 승인을 받을 때만 — 받지 못하면 Phase 2 잔여로 보고 | 012c-2·3 |
| **U-P2** | 챌린지 T6(역할극을 하루 과제로) — `SnapshotKind` 값 추가(기존 enum)가 필요할 수 있음 | **보류**(설계서도 "2단계" — `challenge.md:676`). 넣으려면 v2.3 이 스키마 없는 안(관측 `SCENARIO_COMPLETED` 행 읽기 등)을 찾거나 추가 승인 | T6 |
| U-P3 | (선택) 데모 게이트 기록 — 도구가 알아듣는 문장(예: "task-041 데모는 생략해줘")을 사용자가 한 번 입력하면 `check.mjs waive` 로 정식 기록 가능 | 받으면 기록, 아니면 원문 인용만(warn 경고 감수) | 없음(warn) |
| U-P4 | 010d 카드 캡처 없이 진행 — 나중에 캡처를 받으면 모양 차이는 IMP 로 되돌림 | 진행(사용자 "한번에" 지시) | 없음 |
| U-P5 | (정보) 발화 기록 위치(012b U3 의 위치 부분) — 권고안 "설정 › 음성 인식 › 내 발화 기록"으로 Leader 가 정하고 최종 보고에 명시 | 권고안 | 없음 |

### 8-2. Leader 결정(사용자 결정 아님)

| # | 결정 | 권고 | 시점 |
|---|---|---|---|
| L-1 | DB0 push 를 웨이브 0 끝에(§0-3) | 웨이브 0 끝 | 지금 |
| L-2 | A1 천장 — 상황 모드에서 `[상황]` 헤더 자리를 만드는 법: (a) 상황 모드에서 다른 블록(주제 블록·창 길이) 축소 (b) 천장 3,000 을 상황 모드만 상향(`CLAUDE.md:70` 규칙 변경 — 5초 지표 재측정 필수) | (a) 먼저 PE 실측, 안 되면 (b) 를 사용자에게 | 010d-A1-PE 전 |
| L-3 | 답장 연습 제안 공급: TALK 응답 칸(a) vs 탭할 때 별도 호출(b) | (b) | 010d-A1-PE C1 |
| L-4 | 012b-3 물화 실행 방식: 우분투 crontab(인프라 변경 = 승인 필요) vs **지표 요청 때 지난 날 지연 물화**(+워커 claim 편승 하루 1회, D-B9 선례) | 지연 물화 | 012b-3 착수 |
| L-5 | 010d G1(라우트 가드 유지)·S1(종료 스냅샷 없음) | G1·S1(`challenge.md:688,698`) | 010d-A1-서버 착수 |
| L-6 | B2 생성 = 동기(잡 없음) | 동기 | v2.3 확인 |

### 8-3. 위험

| 위험 | 확신 | 조치 |
|---|---|---|
| 구독 한도로 PE·QA 라이브가 중간에 멈춤(039 선례) | [확실] 선례 / [추측] 빈도 | LLM 슬롯 1개·순서(§6), 측정 표본을 WP 마다 미리 정함, 한도 걸리면 그 WP 만 대기하고 LLM 없는 일 진행 |
| M4 venv 에 narabas 를 넣다 SBV2 핀(transformers 4.57.6·numpy 1.26.4·torch 2.14 — `SETUP-M4.md:57`)이 바뀌어 운영 TTS 가 깨짐 | [가능성 높음] | 스파이크는 **별도 venv**, 본 설치는 `pip install -c <핀 고정 파일>`, 배포 스크립트의 핀 대조가 2차 방어 |
| M4 SSH 접근 | [확인 못 함] | 문서상 경로 = 우분투에서 `ssh -o BatchMode=yes brownjeon@192.168.219.100`(키 인증, `deploy-from-ubuntu.sh:10,25`), 기록된 마지막 사용은 2026-09-27(task-003d). 012b 배포 기록에 "우분투 SSH 타임아웃"(2026-10-01, 대상 불명확) — 착수 첫 단계에서 `ssh … true` 로 확인, 안 되면 사용자에게(맥 앞에서 `SETUP-M4.md` 대화형 실행) |
| 큰 단일 배포의 회귀 탐지 지연 | [확실] | §7-2 운영 모드 통합 검증 필수 |
| 010d 답장 연습·상황 헤더가 회화 TTFA 를 늘림 | [가능성 높음] | L-2·L-3 + 010d QA 에 TTFA 30턴 전후 비교 필수 |
| 남의 미완성 파일로 `tsc` 깨짐(§0-5) | [가능성 높음] | §3 규칙 4 |
| 챌린지 v2.3 이 늦어짐 | [추측] | 웨이브 0 은 v2.3 없이 가능한 일(039·스파이크·012b-2/4 가이드·012b-3 이력서)부터. DB0 는 D1·D2·D4·D5 가 B2 와 무관하다고 보고 v2.3 초안의 DB 절만 확인되면 착수 [가능성 높음] |

### 8-4. 확인한 것 · 못 한 것

- **010d 현재 코드 [확실]**: 스키마는 적용됨(`schema.prisma:689-719` `Chat.scenarioId/lessonId`, `:972-1018` `Scenario`·`ScenarioTopic`, `:1021-1058` `Lesson.scenarioId`). `src/modules/learning/scenarios/` 없음 · `src/app/api/v1/scenarios/` 없음 · `prisma/seed-data/scenarios.json` 없음 · `#28` 은 `chats/validate.ts:63-64` 에서 `lessonId`·`scenarioId` 를 400 `FEATURE_NOT_READY` · 코치 강제(`corrections/talkDelivery.ts:23-24`)·관측 매핑(`observations/index.ts:26`)·`RepetitionItemType SCENARIO` 는 이미 있음. 운영 DB 반영은 기록만 확인(`challenge.md:1059`).
- **012b 현황 [확실]**: 분석 워커 운영 중(2026-10-01 이후) — 012b-2 카드에 쓸 실데이터가 쌓이는 중. `EngineMetricsDaily` 에 TTS 칸 없음(`schema.prisma:1753-1768`), 물화 스케줄러 없음(`src/` 에 cron·주기 잡 0 — `setInterval` 은 클라 타이머뿐), `RequestTrace` 보존 정리(90일)도 미구현. TTS 단계는 `TURN`·`PREVIEW` Trace 에 기록(`speech/tts/synthesize.ts:339`, `metrics.ts:9-17`). `TtsCache.timing`·`timingVersion` 칸 있음.
- **못 한 것**: M4 SSH 실접속(금지 범위) · narabas 설치 방법·MPS 지원(`[추측]`) · 운영 confidence 분포(012b-2 문구 근거 — 착수 때 집계만) · 챌린지 v2.3 내용(작성 중) · `prisma migrate diff` 동작 · 운영 앱과 개발이 같은 Claude 구독을 쓰는지(`[가능성 높음]`).

---

## 9. 규모 추정 · 우선순위 · 중간 완료 지점

| 구분 | 추정 |
|---|---|
| 에이전트 호출 | 지시 WP(039·DB0·041~044·010d A/B·012b-2/3/4) 약 **60~80회**(judge·codex 포함), 012c-2/3 넣으면 +16~22 [추측] |
| 벽시계 | 레인 3~4개 병렬 + LLM 슬롯 직렬 기준 **2~4일** [추측 — 구독 한도가 가장 큰 변수] |
| 병목 | ① LLM 슬롯(PE 4건·라이브 QA) ② 리뷰(WP 13개) ③ 010d(가장 큼, 천장·캡처 불확실) |

**우선순위(가치·위험·의존)**: ① **039 마무리**(거의 끝, C2·C3 의 선행) → ② **DB0**(4개 WP 의 라이브를 연다) → ③ **챌린지 041·042**(사용자가 가장 최근에 직접 요청, 설계 완료) → ④ **012b-3**(작고 서버만, 012b-4·012c-3 선행) ⑤ **010d-A1-서버**(039 와 무관한 부분) → ⑥ 043·044·012b-2(사용자 화면 가치) → ⑦ 010d-A 나머지·010d-B(가장 크고 불확실) → ⑧ 012b-4(M4 인프라 위험, 체감은 자막 강조). 012b-4 스파이크만은 저장소와 무관해 웨이브 0 에 끼운다(위험을 일찍 드러냄).

**한도 등으로 중단될 때 의미 있는 중간 완료 지점**(사용자 지시는 "끝에 한 번 배포"이므로 중단 시 Leader 가 사용자에게 선택지로 제시):
- **M1(웨이브 0 끝)**: 039 QA PASS + 모든 승인 칸 DB push 완료 — 039 만 배포해도 완결.
- **M2(웨이브 1 끝)**: 서버 묶음(041·042·012b-3·010d-A1-서버) 로컬 커밋 — 화면이 없어 배포해도 사용자 노출 0(챌린지 API 는 호출처 없음, 010d 라우트 가드 유지). 012b-3 지표는 관리자 API 로 즉시 가치.
- **M3(웨이브 2 끝)**: 챌린지 사용자 기능 완성(043·044) + 012b-2 — **사용자 체감 첫 단위**. 010d 는 서버만 들어가고 가드 유지.
- **M4(웨이브 3)**: 010d 화면·012b-4 화면 — 나머지 전부.

---

## 10. Leader 가 바로 실행할 디스패치 목록

> 공통: 각 지시에 task 이력서 경로 · 이 계획서 경로(§2 소유 파일 · §3 미러 · §6 슬롯) · `run_in_background: true` · `name` · developer 는 judge `developer_model` 을 `model` 로. 수정 파일 ≈15개·60턴 이하로 쪼갠다(`<agent_dispatch>` §1).

### 웨이브 0 (지금)

1. **reviewer `rev-039-r3`** — 입력: [[task-039-improve-tutor-explanation]] `### dev-039c` 절(371행~)·REV-115. 범위: dev-039c 변경만(`structuredResponse/checks.ts` `sanitizeExtraNoteKo` 의 `\p{Cf}`·NEL·C1·NFKC 비교 / `components/common/japanese/JaRuns.tsx`·`ExtraNoteLine.tsx`). 메인 미러 재실행. 쓰기 = 이력서 Reviewer 절만.
2. **judge `judge-039-c2b`** (1 이 PASS 면) — `codex_gate` C2 재판정(dev-039c 가 Codex C2 이후 변경이라). Codex 예산·한도 확인.
3. **judge intake ×3(병렬)** — [[task-012b-2-analysis-result-ui]] · [[task-012b-3-tts-observability]] · [[task-012b-4-tts-timing-m4]]. 입력: 이력서 목표 300자 요약 + 예상 변경 경로 + `waiver_quote` 로 사용자 지시 원문(도구가 waive 로 인식하지 못해도 기록용). 결과 JSON 저장 → `check.mjs init`.
4. **judge intake — 010d 재접수** — [[task-010d-scenario-roleplay]] "Phase 2 일괄" 절 요약(A/B 분할·IMP-0017·0021·데모 생략 지시). 주의: 010d `demo_gate` 는 v1 approved 상태라 `init` 재실행 대상이 아니다(도구 규칙 "drafting·not_required 에서만") — 상태는 그대로 두고 이력서에 "승인 v1 과 다른 구현(IMP-0017)을 데모 승인 없이 진행"을 기록.
5. **developer `dev-012b4-spike`**(judge 012b-4 결과 모델) — 미러 불필요. 입력: [[task-012b-4-tts-timing-m4]] "스파이크" 절. ① `ssh -o BatchMode=yes brownjeon@192.168.219.100 true` 로 접근 확인(실패 시 즉시 보고) ② M4 에 **별도 venv**(`~/kaiwa-tts-spike`)로 narabas·torch(MPS)·pyopenjtalk 설치(사용자 승인 범위 — 운영 venv `~/kaiwa-tts-run` 무변경) ③ 고정 20문장(합성 wav 는 운영 :8200 에서 받아 저장)으로 A 강제정렬 시간·오차, B duration 추출 가능 여부 ④ 결과는 이력서 Developer 기록에(저장소 파일 변경 0, 스크립트는 scratchpad). 8200 재시작·운영 venv 설치 금지.
6. **designer `designer-p2-guide-1`** — 입력: [[task-012b-2-analysis-result-ui]] · [[task-012b-4-tts-timing-m4]] · 이 계획서 C10·C11·C16. 산출: 각 이력서 `## Designer 기록` 에 구현 가이드(데모 승인 생략 지시 — 승인용 데모 대신 가이드, 데모 HTML 필요 시 참고용 v1 만 만들고 승인 요청 안 함). `docs/screens.md` 는 아직 쓰지 않음. 순서 012b-2 → 012b-4 → (이어서 같은 에이전트 또는 신규) 010d-B.
7. **(design-040f 의 v2.3 도착 뒤) Leader** — task-041·042·043·044 이력서 생성(v2.3 §11 기준, 045 는 보류 표기) → judge intake ×4 → `check.mjs init`.
8. **developer `dev-p2-schema`**(DB0, judge 041 결과 모델 — 예상 opus·R2) — 미러 `thekaiwa-p2db`. 소유: `prisma/schema.prisma` · `src/modules/learning/{challenges,scenarios}/index.ts`(빈 모듈) · `src/modules/learning/index.ts`(export 2줄) · `tests/live/qa-session.ts`(계정 3·4). 입력: `challenge.md:170-235`·§3-5 · `16-tts-productization-layer.md` §7.3 · 이 계획서 §4. 산출: `validate`·`generate`·`migrate diff --script` SQL(scratchpad) · push 금지.
9. **reviewer `rev-p2-schema`** — 8 의 diff·SQL 을 승인 목록과 1:1 대조(§4-2).
10. **Leader** — 백업 → `migrate diff` 확인 → `db push` → 메인 미러 `generate` → 운영 health → 기록(039·041·042·012b-3 이력서, 20-Log).
11. **qa `qa-039`**(LLM 슬롯 1번) — REV-115 high_risk 1~6 + dev-039c 범위. 이어서 **prompt-engineer `pe-039e`** A3 v3 20회(슬롯 2번, 한도 리셋 뒤) → PASS 면 Leader 로컬 커밋(039 파일 pathspec).

### 웨이브 1 (10 이 끝나면 병렬, developer 최대 4)

12. **developer `dev-041-core`** — 미러 `thekaiwa-041`(포트 3021) · QA 계정 3. 소유 C7 + `learning/challenges/**` + `learning/lessons/today.ts`(#58 `CHALLENGE`). 범위 `challenge.md:920`(push 제외 — DB0 가 함). finish 라우트는 042 소유(§2 C6).
13. **prompt-engineer `pe-042-a12`** — A12 `topicWords`(B2) — 새 파일 `conversation/prompts/topicWords.ts`(스키마 동봉) + 픽스처, LLM 슬롯 3번. **schemas.ts·talk.ts 금지**(C2).
14. **developer `dev-042-words`** — 미러 `thekaiwa-042`(3022) · QA 계정 3(041 과 시간 나눔 또는 계정 1 의 IDOR 만). 소유 C6 + `learning/topics/pool.ts`. A12 가 오기 전 B1 풀·DTO·D5 등록·#53 부터, A12 뒤 생성 연결(동기, L-6).
15. **developer `dev-012b3`** — 미러 `thekaiwa-012b3`(3023). 소유 C15 + C13 의 예열·정리 부분. [[task-012b-3-tts-observability]] 범위. L-4(지연 물화) 확정 뒤.
16. **developer `dev-010d-a1srv`** — 미러 `thekaiwa-010d-a`(3024) · QA 계정 4. 소유 `conversation/chats/**`(validate.ts 63-64 유지)·`learning/scenarios/**`. **금지**: C2 전부·`types/chat.ts`(039 커밋 전). L-5(G1·S1) 확정 뒤.
17. **prompt-engineer `pe-010d-seed`**(13 다음, 같은 PE 슬롯) — `prisma/seed-data/scenarios.json` 10개 + `steps[]` + `completionRule`·`goal` 키 통일(`domain-model.md:2531-2532`) + AI 초안 생성 프롬프트(새 파일). TALK 계열 파일 금지.
18. 각 WP: Reviewer PASS → **judge `codex_gate` C2** → (판정 시) codex → QA → Leader 로컬 커밋 → 정본 반영(C17). 다음 웨이브 디스패치는 §5 표의 선행이 커밋된 WP 부터.

## 11. Leader 결정 확정 (2026-10-06 22:30)

| # | 결정 |
|---|---|
| L-1 | DB0 push 는 웨이브 0 끝(Reviewer PASS 뒤 백업 → `migrate diff` 재확인 → 1회 push) |
| L-2 | A1 천장: (a) 먼저 — 상황 모드에서 다른 블록 축소를 PE 가 실측, 안 되면 (b)는 사용자에게 |
| L-3 | 답장 연습 제안 = (b) 탭할 때 별도 호출 |
| L-4 | 012b-3 물화 = 지표 요청 때 지연 물화(crontab·인프라 변경 없음) |
| L-5 | 010d G1(라우트 가드 유지)·S1(종료 별도 스냅샷 없음) |
| L-6 | B2 생성 = 동기(잡 없음) |
| 권한 | TTS 지표 API 권한 = `trace.read`(정본 role-permission.md:49 — 16 문서 정정) |
| 012b-4 | **B(합성 중 VITS 정렬 추출) 채택 — narabas 설치 안 함**, timing 은 응답 헤더로 |
| 012c-2·3 | 사용자 지시 목록에 없어 이번 일괄에서 **제외**(최종 보고에서 포함 여부 질문) — 012c-3 은 DB 승인 밖 |
| T6 | 보류(후속) |

| 데모 게이트 | **2026-10-06 23:43 사용자 입력 "데모 생략하고 진행해줘" 로 정식 waive 기록**(`check.mjs waive` — task-040·041·043·044·012b-2·012b-4 `DEMO_GATE_WAIVED`). task-010d 는 v1 approved 상태(IMP-0017 로 v1 과 material 차이가 있는 구현 — 이력서에 사실 기록), task-039 는 v1 approved, task-042·012b-3 은 데모 불필요. |

## 클린 체크아웃 검증 (2026-10-07)

> developer(신규 소환, judge standard·R2) — 운영 배포(`deploy.yml` build: `npm ci --no-audit --no-fund` → `prisma generate` → `next build`)와 같은 방식으로 **HEAD `b7843ee`** 를 깨끗한 폴더에서 빌드. 커밋·푸시·DB 쓰기·운영 3010 접촉 없음. `.env` 없이 빌드됨(복사 안 함 — `SIGNUP_INVITE_CODE` 미설정 경고만).

- [중간 체크포인트] 완료: 클린 재현 2종(A 홈 경로·B 홈 밖 격리) · 원인 확정 · (a)/(b) 실측 비교 · NFS `tsconfig.json` exclude 1줄 수정 · 새 격리 사본(C)에서 전 단계 rc=0 재확인. 남은 일: 단위 시험 비교 · 기록 마무리. 미커밋 파일: `tsconfig.json`(이 절 포함 vault 파일 별도).

### 1. 클린 재현 — 단계별 결과 (HEAD `b7843ee`, 수정 전)

빌드 위치를 둘로 나눴다. **이유**: `/home/brownjeon/node_modules` 에 n8n 의 전이 의존성으로 `playwright-core@1.58.2` 가 있다(`npm ls`: n8n → @n8n/n8n-nodes-langchain → @langchain/community → playwright → playwright-core). Node·TypeScript 는 상위 폴더의 `node_modules` 를 거슬러 찾으므로 **`/home/brownjeon` 아래 폴더는 어디서 빌드해도 이 패키지를 찾는다** — 개발 미러(`~/.node-local/thekaiwa`)도, 운영 릴리스(`/home/brownjeon/apps/thekaiwa/releases/<id>`)도 같다.

| 사본 | 위치 | npm ci | prisma generate | tsc --noEmit | next build |
|---|---|---|---|---|---|
| A (운영과 같은 조건) | `~/.node-local/thekaiwa-buildcheck-c2` | rc=0 · 7s | rc=0 · 1s | rc=0 · 16s · **0 오류** | rc=0 · 25s |
| B (홈 밖 격리) | `<scratchpad>/kc2/r/app` (`../../NFS` 링크) | rc=0 · 7s | rc=0 · 1s | rc=2 · 16s · **25 오류** | **rc=1** · 23s — `Running TypeScript` 에서 같은 25 오류 → `Failed to type check.` |

- [확인] 25 오류의 내용은 **TS2307 6건**(`playwright-core` 없음) + **TS7006 19건**(타입이 any 가 된 `page.evaluate` 콜백 매개변수의 암묵 any). 파일: `tests/live/{task010d-b1,task010d-b2,task010d-b3,task043}-screens.ts`·`tests/live/p2a-qa/{challenge-live-ui,task043-screens-x}.ts` 6개. `task012b2`·`task044-screens`·`p2a-qa/task044-screens-x` 는 문자열 변수로 동적 import 하므로 오류 없음. `p2b-qa/`·`p2c-qa/` 는 미추적이라 HEAD 사본에 없다.
- [확인] **`next build` 의 타입 검사는 tsconfig `include` 전체를 본다** — `tests/live` 오류로 빌드가 실패한다(B). 리뷰어 우려가 맞았다. 다만 운영 릴리스 경로는 A 와 같은 조건이라 **지금 운영 배포는 우연히 통과한다**. n8n 업그레이드·삭제로 그 전이 의존성이 바뀌면 그날부터 운영 배포가 `build_failed` 가 된다.
- [확인] `.env` 없이 A·B·C 모두 컴파일·정적 페이지 생성 18/18 성공(`SIGNUP_INVITE_CODE` 미설정 경고만). `.env` 복사본은 만들지 않았다.
- [확인] `npm ci` 는 NFS lock(=HEAD lock)만 썼다. 미러 lock·package.json 은 NFS 와 바이트 동일(`cmp`), 최상위 `node_modules` 394개로 미러와 같다.

### 2. `playwright-core` 해법 — 3안 비교와 선택

| 안 | 실측 | 판단 |
|---|---|---|
| (a) `tsconfig.json` `exclude` 에 `tests/live` | A·B tsc rc=0·0 오류. B `next build` rc=0. eslint 결과 A 기준선과 동일(7건 같은 줄), `tests/live` 파일도 계속 린트됨(무시 경고 없음). tsx 4.23.15 는 exclude 된 `tests/live/**` 에서도 `@/` 별칭을 푼다(탐침 스크립트·`task010d-a1-smoke.ts` 로드 확인 — DB 접속 단계까지 진행). `src` 시험이 import 하는 `tests/live/task039-style-classify.ts` 는 import 그래프로 계속 타입 검사됨(`--listFilesOnly`). | **채택** |
| (b) `tests/live/_playwright-core.d.ts` (`declare module 'playwright-core'`) | A·B 모두 **41 오류**(TS7006 19 + `Cannot use namespace 'Page'/'BrowserContext'/'Route' as a type` TS2709 22). A(미러 조건)는 0 → 41 로 **악화**. 이유: TypeScript 는 앰비언트 모듈 선언을 실제 패키지보다 먼저 쓰므로, 진짜 타입이 있는 곳에서도 짧은 선언이 전부 any 로 덮는다. | 기각 — 개발 미러를 깬다 |
| (c) devDependency 로 `playwright-core` 추가 | 실행 안 함 | 기각 — 새 의존성은 `/신규도입` 거버넌스 대상(지시). 장기적으로는 가장 정직한 해법이라 Leader 판단 거리로 남긴다 |

- 수정: **`tsconfig.json` 1줄** — `"exclude": ["node_modules"]` → `"exclude": ["node_modules", "tests/live"]`. 보이지 않는 문자 0건. `next build` 가 tsconfig 를 다시 쓰지 않음(빌드 후 `cmp` 동일).
- 재검증(새 격리 사본 C = HEAD + 수정한 NFS `tsconfig.json`, 캐시 없음): `npm ci` rc=0 · 6s → `prisma generate` rc=0 · 2s → `tsc --noEmit` rc=0 · 14s · **0 오류** → `next build` rc=0 · 24s(TypeScript 15.2s, 정적 18/18).
- 대가: `tests/live/**`(추적 100개 .ts + 미추적 p2b/p2c-qa) 는 `npm run typecheck`·`next build` 의 타입 검사에서 빠진다. 실행은 tsx(타입 검사 안 함)라 동작은 같다. 팀 문서(`.claude/agents/*.md`·`tests/live/README.md`·`docs/deploy-order.md`)에 tests/live 를 tsc 로 검사한다는 약속은 없다(grep 0).

### 3. 그 밖의 클린 빌드 차이

- [확인] 홈 밖 격리 사본(B·C)에서 `src`·설정 파일의 선언 안 된 bare import 0건(스캔 + C 빌드 성공으로 이중 확인). **`/home/brownjeon/node_modules` 가 선언 누락을 가리는 구조**라 미러·운영 경로의 빌드 성공만으로는 이걸 증명할 수 없다 — 이번 C 가 그 증명.
- [확인] `src`·`public`·`prisma`·`next.config.ts`·`.claude/agents/tutor.md`·`speech/speech.config.yml` 에 미추적·ignore 파일 없음(`git status --ignored` 0). `next-env.d.ts` 는 ignore 대상이지만 빌드가 만든다. `@thekaiwa/sherpa-stt`(file:) 설치 정상. `@workspace/auth-oauth` 는 lock 의 `file:../../NFS/...` 상대경로라 사본 깊이가 2단계여야 한다(운영은 `apps/thekaiwa/NFS` 링크 존재 확인).
- [확인] `npm run lint` 해당 사항(배포 빌드 단계 아님): 클린 사본 `eslint .` 은 **rc=1 — `ecosystem.config.js` 의 `require()` 2건(@typescript-eslint/no-require-imports)** + 기존 경고 5건. 미러에는 `ecosystem.config.js` 가 동기화되지 않아 보이지 않던 오류다. 수정 안 함(소유 범위 한 가지 원칙) — `eslint.config.mjs` `globalIgnores` 에 넣거나 파일에 disable 주석, Leader 판단.

### 4. 단위 시험 — 클린 격리 사본 C

- 명령: `DATABASE_URL="mysql://invalid:invalid@127.0.0.1:1/invalid" node --import tsx --test --test-concurrency=1 $(find src -name '*.test.ts' | sort)` (`.env` 없음).
- 결과: 파일 187 · **tests 2227 · pass 2227 · fail 0 · skipped 0** · 101s.
- 개발 미러 대비(최근 2,195 · 실패 0 · skip 1~3): 수는 그 뒤 추가 시험 몫. skip 0 인 이유 — 미러 skip 은 `docs/`·`speech/models`·`android/`·seed 파일이 없을 때 건너뛰는 조건부 시험(`permissions.test.ts`·`modelPackage.test.ts`·`brand.test.ts`·`seedScenarios.test.ts`)이고, 클린 사본에는 저장소 전체가 있어 다 돌았다. **클린에서만 실패하는 시험 없음.**

### 5. 남은 위험 · Leader 판단 거리

1. **상위 `node_modules` 의존**: 미러·운영 모두 `/home/brownjeon/node_modules`(n8n) 위에서 빌드·실행된다. 선언 안 된 패키지를 쓰는 코드가 들어와도 미러·운영 빌드는 통과하고 n8n 이 바뀌는 날 깨진다. 제안 — 푸시 전 점검에 **홈 밖 격리 클린 빌드**(이 절 B/C 방식)를 넣는다(스크립트화는 별도 task).
2. `tests/live` QA 스크립트의 타입 검사가 빠졌다. 원하면 `tests/live/tsconfig.json`(루트 extends, 개발 전용 `tsc -p tests/live`)로 되살릴 수 있다 — 새 파일이라 이번 범위 밖.
3. (c) `playwright-core` devDependency 정식 선언은 `/신규도입` 거쳐 결정.
4. `ecosystem.config.js` eslint 오류 2건(위 3).
5. 이 수정은 미러에 아직 동기화되지 않았다(다음 `sync-local` 때 `tsconfig.json` 이 복사됨 — 떠 있는 `next dev` 가 tsconfig 변경을 감지할 수 있다).

- 재현 폴더(사용자 정리 대상, 지우지 않음): `~/.node-local/thekaiwa-buildcheck-c2`(A) · `/tmp/claude-1000/-home-brownjeon-NFS-homes-brownjeon-project-TheKaiwa/729e3300-9a56-4bdf-bda2-ca7f7603c97f/scratchpad/{kc2,kc3}`(B·C, 안의 `NFS` 는 심볼릭 링크). 로그 `scratchpad/{A,B,C}-*.log`.
- 미커밋 파일: `tsconfig.json`(1줄) · 이 절 · `20-Log/2026-10-07.md` 1줄.
