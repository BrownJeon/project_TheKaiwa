---
task_id: task-008
title: "단어장 최소판 + 오늘의 단어"
status: in-progress
base_ref: 4cac3de
risk_level: R2
roles_involved: [leader, judge, designer, prompt-engineer, developer, reviewer, qa, codex]
related_tasks: [task-006-chat-correction, task-005-settings-attendance, task-002-phase0-scaffolding]
tags:
  - type/task
  - domain/vocab
  - domain/ui
aliases:
  - 단어장
  - 오늘의 단어
created: 2026-09-27
updated: 2026-09-27
---

## 목표 (Leader)
design-spec §15 task-008: 단어장 최소판(CRUD·보관·카테고리·검색·정렬, A10 단어 보강 draft, 기본 단어 팩) + 오늘의 단어(세트 생성 — 정답 미노출·CHOICE 기본·FLIP 옵션·가중 샘플링, 카드 attempt 즉시 저장, `finish` 단일 트랜잭션, 세트 보관·다시 풀기, 통계).
완료 기준(§15): CRUD·보관·카테고리, 세트 생성(정답 미노출)·CHOICE·finish 트랜잭션, 10장 3분, 삭제 후 집계 불변, 풀<4 FLIP.
정본: `docs/design-spec.md` §7-2, `docs/design/api-contract.md` §2-9 단어장 #40~#46·§2-10 오늘의 단어 #47~#54, `domain-model.md`(WordEntry·VocabSession·VocabAttempt·StudyLog·StatsSnapshot, 시드 §3 "시드 팩 추가 CTA"), `module-dependency.md` L3 `learning/vocab`(setGenerator·distractors·grading·stats·words)·§4-4(L3 의 LLM 프롬프트는 라우트가 넘김).

## 관련 과거 이력 요약
- [[task-006-chat-correction]]: `learning/vocab/words.createWord`(검증 한도·같은 surface **JS 바이트 일치** 중복 409 — DB unicode_ci 가 は/ぱ·히라/가타를 같게 봄), `learning/snapshots.bumpDailySnapshot`(INSERT…ON DUPLICATE → FOR UPDATE → 병합, DAILY `words:{sessions,correct,wrong}` 키 있음), `learning/studyLog.recordStudyLog`, `infra/tx.withTransaction`·`lockUserRow`(사용자 행 → 대상 행 잠금 순서), `infra/{text,pagination,http}`, QA 계정 2개(`tests/live/qa-session.ts`)·dev 서버 3011 스모크 패턴. 교정 채택 시 단어장 추가 시트가 이미 `WordEntry(source=CORRECTION)` 를 만든다.
- [[task-005-settings-attendance]]: `Profile.dailyWordCount`(5~30) — 세트 기본 장수.
- **운영 주의(task-006 교훈)**: 미러 `~/.node-local/thekaiwa` 에서 `npm run build` 금지(운영 pm2 의 `.next` 를 덮어씀, 재시작은 사용자 권한). 검증은 `next dev -p 3011`(Next 16 dev = `.next/dev`).

## Leader's Plan (2026-09-27)

### 요구사항 해석 (정본 인용)
- §7-2: 풀 = `archived=false` − 오늘 DONE 세션 단어, `count = min(요청(기본 dailyWordCount), 풀)`, 풀 0 → 빈 상태 CTA, 풀<4 → FLIP 강등. 가중치 `w = clamp(1 + 2·wrong − 0.5·correct, 0.25, 8) × recency(미노출 2.0 / 7일↑ 1.5 / 1~7일 1.0 / 24h 내 0.3)`, 가중 비복원 샘플링(seed 저장) → Fisher-Yates → CHOICE 보기 = 정답 + 같은 품사 오답 3. **정답은 응답에 싣지 않는다**(채점은 서버). 카드당 ≤12s × 10장 ≈ 3분. attempt 즉시 저장 → `finish` 단일 트랜잭션(카운터·`lastSeenAt`·`StudyLog(WORDS,DIRECT)`·`StatsSnapshot(VOCAB_SESSION)`+DAILY). 보관 두 층위(세트 `keptAt` → 다시 풀기 / 카드 `flagged`). bjj 덱 이식(탭 10px·위 −80·좌우 ±60·3장 스택·`touchAction:none`·`touchend preventDefault`) — 위=flag, 좌=답한 뒤에만 다음, 우=이전 카드 읽기 전용, 키보드 1~4.
- api-contract #40~#54 그대로. #41 `enrich` 는 **draft 만 반환하고 저장하지 않는다**(사용자 확인 후 다시 POST).

### 범위 결정 (Leader — 정본 공백 메움)
- **E1 기본 단어 팩**: 신규 `POST /api/v1/words/seed-pack` `{pack:'N5'}` → `{added, skipped}`. 원본은 `prisma/seed-data/words-n5.json` **단일 출처**(복사본 금지), `source=SEED, category='N5 기초', jlpt=N5`, 이미 있는 표현(JS 바이트 일치)은 건너뜀, 사용자 행 잠금으로 동시 실행 중복 방지. 사용자의 직접 행위(CTA)라 채택 규칙과 무관. → api-contract §2-9 에 #46b 로 추가.
- **E2 flag 전용 요청**: #50 에 `{order, flagged}` 만 보내면(답 필드 없음) **표시만 바꾼다** — 답 멱등 규칙과 별개, `IN_PROGRESS` 에서만(DONE 이면 409). 답과 함께 온 `flagged` 도 반영.
- **E3 이전 날짜 IN_PROGRESS 세트**: 자동 처리하지 않는다. 새 세트 생성은 `409 {sessionId}` 이고 화면이 **[이어서 풀기] / [여기서 끝내기(finish)]** 를 준다. 기록 날짜는 세션 `date`(시작한 날). `ABANDONED` 는 Phase 1 에서 쓰지 않는다.
- **E4 다시 풀기**: 원 세트의 단어 목록·순서 재셔플, 원 모드 유지. 단 **삭제된 단어가 하나라도 있으면 세트 전체를 FLIP**(`downgraded:true`, 삭제 단어 카드는 `*Snap` 으로). 오늘 DONE 제외 규칙은 적용하지 않는다.
- **E5 SKIPPED**: finish 시 미답 카드 = SKIPPED. 단어 카운터(`correct/wrongCount`)는 CORRECT/WRONG 만 증가, SKIPPED 는 `lastSeenAt`·`lastResult=SKIPPED` 만.
- **E6 보기(distractors)**: 사용자 단어의 **뜻 문자열**에서 정답과 다른 것 3개(같은 품사 우선 → 부족하면 다른 품사). 뜻이 서로 다른 후보가 4개 미만이면 세트 전체 FLIP 강등. 보기 순서도 시드 셔플(정답 위치 고정 금지).
- **E7 동시성**: 사용자당 IN_PROGRESS 세트 1 — 생성·replay 는 `lockUserRow` 후 확인. attempt 는 `(sessionId, order)` 행에 `answer IS NULL` 조건부 갱신(두 번째 요청은 첫 결과 반환). finish 는 세션 행 잠금 + 상태 확인으로 **이중 finish 시 스냅샷·카운터 이중 증가 0**(두 번째는 같은 응답 재전송).
- **E8 A10 단어 보강**: 프롬프트는 `conversation/prompts/wordEnrich.ts`(prompt-engineer), 실행은 `learning/vocab/enrich`(`engine.llm.completeJson`, task `wordEnrich` 20s, 프로세스 메모리 캐시 surface 키), **라우트가 conversation 에서 요청을 만들어 learning 에 넘긴다**(module-dependency §4-4 — L3 는 L2 를 import 하지 않음). 사용자당 분당 20회 429. 응답·오류에 엔진명 0.
- **E9 TTS 버튼**: task-003 전이라 카드·단어 화면에 소리 버튼을 **두지 않는다**(자리만 설계).
- **E10 통계 #54**: `StatsSnapshot(VOCAB_SESSION)` 만 읽는다(원본 삭제와 무관). `streakDays` = 단어 세트를 끝낸 연속 일수(스냅샷 날짜 기준).

### 구현 전략 (6층)
- **L3 learning/vocab**: `words`(목록·검색(`surface/reading/meaning` 부분 일치 ≤40자)·정렬 recent|wrong|surface·total·상세+stats·수정(카운터·source 불가, surface 변경 시 중복 검사)·삭제(SetNull+Snap 유지, `snapshotKept:true`)·보관 토글·카테고리 집계) · `seedPack` · `enrich` · `setGenerator`(가중치·시드 PRNG·비복원 샘플링·Fisher-Yates) · `distractors` · `sessions`(생성·조회(미답 정답 숨김)·attempt·finish·keep·replay·목록) · `stats`. 쓰기는 전부 `infra/tx.withTransaction` + 사용자 행 잠금 순서(task-006 과 동일).
- **L2 conversation**: `prompts/wordEnrich.ts` + 스키마(prompt-engineer). 그 외 변경 없음.
- **app 라우트**(얇게): `/api/v1/words`(GET·POST) · `words/[id]`(GET·PATCH·DELETE) · `words/[id]/archive|unarchive` · `words/categories` · `words/seed-pack` · `/api/v1/vocab/sessions`(GET·POST) · `vocab/sessions/[id]`(GET) · `[id]/attempts|finish|keep|replay` · `vocab/stats`.
- **화면**: designer 가이드(`docs/screens.md` 단어장·오늘의 단어 절)대로 `/drawer/words`(목록·검색·카테고리·정렬·보관함 토글·추가 시트(표현 → [뜻 채우기] draft → 확인 저장)·상세/수정/보관/삭제·빈 상태 + 기본 단어 팩 CTA), `/study/today`(오늘의 단어 카드: 장수·모드·카테고리 → 시작 / 진행 중 세트 이어 풀기·끝내기 / 보관한 세트·다시 풀기 / 최근 통계), `/study/today/words/[sessionId]`(스와이프 덱·CHOICE 4버튼·FLIP 뒤집기·답 피드백·결과 화면·보관). 덱 화면은 탭바 숨김. 레슨·평가 자리는 "곧 열려요"(Phase/task 번호 비노출).
- 이식 출처: `../bjj-trainning/web/src/components/SwipeCardDeck.jsx`(제스처 임계·스택 transform).

### 작업 분배
| 역할 | 담당 | 순서 |
|---|---|---|
| designer | `docs/screens.md` 에 §4 단어장 · §5 오늘의 단어(덱·결과·보관함) 절 추가(기존 §1~§3 수정 금지, 토큰 재사용) | 1 (PE 병렬) |
| prompt-engineer | `conversation/prompts/wordEnrich.ts`+스키마+`index.ts` export, 픽스처(한자어·가나만·동사 활용형·가타카나·다의어·일본어 아닌 입력 등 10~12개) + haiku 실측(지연·JSON 재시도·품질) + 단위 테스트 | 1 (병렬) |
| judge | C1·C2 codex_gate | 2, 5 |
| developer A (Opus) | L3 vocab 전부·라우트 17개·단위 테스트·`tests/live/task008-smoke.sh` | 3 (B 병렬) |
| developer B (Opus) | `components/vocab/**`·`(app)/study/today/**`·`(app)/drawer/words/**`·클라이언트 DTO `src/types/vocab.ts`·탭바 숨김 경로 추가 | 3 (A 병렬) |
| reviewer | 정답 누출·트랜잭션·멱등·동시성·삭제 후 집계 불변·6층·엔진명 | 4 |
| qa | 아래 완료 기준 (dev 서버 3011) | 6 |

### 완료 기준 (qa 실행 확인)
1. tsc 0 · lint 에러 0 · 단위 테스트 전부 통과(**build 는 하지 않음** — 운영 반영은 사용자).
2. 단어 CRUD: 추가(완전 본문 즉시 저장 / `enrich` → draft 만, DB 행 0) · 같은 표현 `409 {existingId}` · 수정(카운터·source 변경 불가) · 검색·카테고리·정렬 3종·보관 토글(보관 단어 목록 분리) · 카테고리 집계 · 기본 단어 팩 50개 추가 후 재실행 시 `added 0`.
3. **정답 미노출(CHOICE 세트, F1)**: #47·#49(IN_PROGRESS) 응답 어디에도 미답 카드의 정답 문자열·정답 위치 힌트 없음(보기 4개 중 정답 위치가 세트마다 분산 — 20세트 표본에서 한 자리 고정 아님).
4. CHOICE 채점 서버: 맞힘/틀림 판정, `chosenText ∉ choices` 400, 같은 `order` 재전송은 첫 결과 그대로, `responseMs` 범위 밖 400, DONE 세트에 attempt 409. flag 전용 요청(E2).
5. 풀<4(뜻이 다른 단어 <4) → FLIP 강등 `downgraded:true`, 풀 0 → `empty.reason=NO_WORDS`. 오늘 DONE 세트 단어는 새 세트에서 제외. 진행 중 세트 있으면 409 `{sessionId}`.
6. **finish 단일 트랜잭션**: 미답 → SKIPPED, 세션 카운터·`durationSec`, WordEntry 카운터(E5), StudyLog(WORDS, DIRECT, refId) 1행, StatsSnapshot(VOCAB_SESSION) 1행 + DAILY `words` 증가. **동시 finish 2회 → 스냅샷·카운터 한 번만**, 재호출은 같은 응답.
7. **삭제 후 집계 불변**: 세트 끝낸 뒤 그 단어를 삭제 → #54 통계·StatsSnapshot 값 변화 0, VocabAttempt 는 `wordId=null` + Snap 유지, #49 결과 화면 정상.
8. keep/replay: DONE 만 keep(아니면 409), replay 는 같은 단어 목록 새 세트(`replayOfId`), 삭제 단어 포함 시 FLIP(E4).
9. **IDOR**: 두 번째 QA 계정으로 단어·세트·attempt·finish·keep·replay 전부 404.
10. **10장 3분**: API 기준 세트 생성 + attempt 10 + finish 총 서버 시간 측정(각 attempt p50 기록) — 사용자 조작 12s/장 가정 시 3분 안에 끝나는지 계산.
11. A10 enrich: draft 필드(reading·meaning·partOfSpeech·jlpt·example·exampleKo) 채워짐, 응답·오류에 엔진명 0, 분당 21번째 429.
12. 화면 360/390/412(dev 서버, 하이드레이션 가능한 환경이면): 가로 넘침 0·터치 ≥44px·카드 덱 조작·키보드 1~4. 하이드레이션 불가면 NOT_VERIFIED + 사용자 폰 확인 항목.

### 네이티브 변경 / APK 재설치
없음(웹만).

### 설계 확정 (Leader, designer §5-11 확인 10건 — F1~F10)
- **F1 FLIP 뒷면**: FLIP 세트 카드는 `meaning`·`example`·`exampleKo` 를 #47·#49 에 처음부터 싣는다(자기 채점). **정답 미노출은 CHOICE 세트에만** — 완료 기준 3 을 "CHOICE 세트"로 좁힌다. 다시 풀기로 FLIP 강등된 세트도 동일.
- **F2 답 0장 끝내기**: 답한 카드 0장이면 finish 가 `ABANDONED`(StudyLog·스냅샷·카운터·연속 기록 변화 0). 1장 이상이면 기존 finish(미답 SKIPPED).
- **F3 #48**: 정렬 `startedAt desc`, `status` 필터(IN_PROGRESS 등)·항목 `answeredCount`·`startedAt` 추가.
- **F4 #49 DONE**: 세션에 `correct/wrong/skippedCount·durationSec·keptAt·replayOfId`, 답한 카드에 `exampleKo`.
- **F5 빈 풀 사유**: `NO_WORDS | ALL_DONE_TODAY | NO_WORDS_IN_CATEGORY`.
- **F6 #46**: `count` = 보관 제외, `archivedCount` = 보관. "분류 없음" 칩은 두지 않는다(designer 안 채택).
- **F7 #53**: 보관한 DONE 세트만 다시 풀기(아니면 409).
- **F8 #41 비일본어**: `200 { draft:{valid:false, invalidReason}, saved:false }`(400 아님).
- **F9 E2 표시 전용 응답**: `{order, flagged}` 만(미답 카드 정답 미포함).
- **F10 공용 변경**: TabBar `HIDDEN_PREFIXES` 에 `/study/today/words/` 추가 승인, 오늘 탭 앱바 제목 "오늘의 공부" 승인. vocab 이 `components/chat/{format,errors,storage}` 를 직접 import 하지 말고 **공용 헬퍼를 `components/common/` 으로 옮겨** 두 기능이 함께 쓴다(chat 동작 불변 — 기존 chat 단위 테스트가 그대로 통과해야 함).
→ api-contract #41·#47·#48·#49·#51·#53 개정(2026-09-27).

## 판단 기록 (judge)
- [2026-09-27 14:34] intake engine=jev → task_type=feature / risk=R2 / developer_model=opus / next=ask_user | overrides=- | fallback=- | tokens=1156
  - (신호) complexity 2.92(conf 0.92) · needs_info 0.63 · risk high 0.69
  - **override**(Leader): `next=ask_user` 를 따르지 않는다 — needs_info 신호는 300자 요약의 압축 탓이며, 판단 대상 사항(세트 크기·모드·가중치·보기 구성·강등·멱등·finish 트랜잭션·보관/다시 풀기·통계·A10 draft·시드 팩)은 정본 design-spec §7-2·api-contract #40~#54·domain-model 시드 §3 에 모두 정해져 있어 사용자에게 물을 미결정이 없다. 정본에 없는 소규모 결정(시드 팩 엔드포인트 등)은 Leader 가 사양에 명시한다. risk=R2 채택(`StatsSnapshot` 트랜잭션·삭제 후 집계 불변 = leader.md R2 보강 기준과 일치).

## Codex 검토

## Designer 기록
- [14:58] 2026-09-27 구현 가이드 작성 → `docs/screens.md` §4 단어장·§5 오늘의 단어 추가, §2 표의 오늘·서랍장 행 갱신(§1·§3 무수정). 목업 Artifact 는 만들지 않음(task-006 과 같은 방식, 필요하면 Leader 요청으로 별도).
- [14:58] 단어장: `/drawer/words` 한 경로, 상세·수정·추가는 바텀시트(`?word=`·`?add=1` 진입 후 replace). 추가 = 표현 → [뜻 채우기](A10 초안, 저장 안 됨, `valid:false` 는 표현 단계에 머묾) → 확인·수정 → [저장]. 409 는 [그 단어 보기]로 안내. 삭제 확인 "지난 기록과 통계는 그대로 남아요". 빈 단어장 + [기본 단어 50개 넣기](#46b, 추가 시트에서도 항상 가능).
- [14:58] 오늘 홈: 오늘의 단어 카드 5상태(준비·풀던 세트(E3)·빈 단어장·오늘 풀 단어 없음·오류) + 최근 30일(streak·7일 칸·byCount) + 보관한 세트(다시 풀기) + "곧 열려요"(Phase 번호 없음). 덱·결과는 같은 경로 `/study/today/words/[id]`(DONE 이면 결과), 탭 바 숨김.
- [14:58] 덱: 제스처 영역(가운데 80%·3장 스택)에는 카드 면만 두고, 보기·버튼은 영역 밖에 둔다(`touchend preventDefault` 가 영역 안 click·유령 클릭을 죽이기 때문). 위=★ 표시 토글(카드는 넘어가지 않음), 왼쪽=답한 뒤에만 다음(아니면 저항 ×0.25 + 안내), 오른쪽=이전(읽기 전용). 키 1~4·Space/Enter·←/→·F·R·S. bjj 힌트 문구의 방향이 반대인 것을 바로잡음.
- [14:58] 채점은 #50 응답으로만 그린다(보기는 "확인 중…" → ✓/✗). #50·#51 은 세션당 직렬 큐(finish 가 마지막 답보다 먼저 가지 않게), responseMs 는 보이는 동안만 세고 60,000 에서 자름. 조작 수: CHOICE 2번/장, FLIP 2번/장(자기 채점 후 자동 다음). 덱에서는 하단 Toast 대신 힌트 줄·알림 줄을 쓴다.
- [14:58] Leader 확인 요청(§5-11): ① **FLIP 뒷면 데이터 계약 공백** — FLIP 세트 카드에만 `meaning`(+예문) 포함 권장, 미확정이면 "자기 채점 → 뒷면" 대체 흐름(화면은 둘 다 지원) ② 답 0장 진행 중 세트를 ABANDONED 로 닫는 경로 ③ #48 정렬·`status` 필터/`answeredCount` ④ #49 DONE 세션에 개수·durationSec·keptAt·replayOfId, 카드에 exampleKo ⑤ #47 빈 풀 사유 세분화(선택) ⑥ #46 count 의미·분류 없음 필터 ⑦ #53 은 보관 세트만인지 ⑧ #41 `valid:false` 응답 모양 ⑨ E2 표시 전용 응답 ⑩ 전역 변경(TabBar 숨김 경로, chat 유틸 import, 오늘 앱바 제목).
- [14:58] 20-Log 한 줄은 Leader 지시("다른 파일 수정 금지")에 따라 남기지 않음. Leader 가 합칠 때 기록 바람.

## Prompt-Engineer 기록

- [14:55] **A10 요청 빌더**(`src/modules/conversation/prompts/wordEnrich.ts`, 신규) — `buildWordEnrichRequest({ surface, level? }): LlmJsonRequest<WordEnrichResponse>`(`task:'wordEnrich'`, 이미 `router/tasks.ts` 에 등록돼 있던 tier=fast·20s). `surface` 는 앞뒤 공백만 trim, 빈 문자열이면 `WordEnrichInputError`(둘 다 export). **페르소나(tutor.md)를 쓰지 않는다** — A10 은 대화 턴이 아니라 사전 조회 1회라 절 필터를 최소로 줘도 "저는 선생님입니다" 류 정체성 문장이 새거나 톤이 섞일 위험만 있고 얻는 게 없어서(A1 실측이 페르소나 유무와 지연이 무관함을 이미 보여줬다). 대신 짧은 자체 `LlmPersona` 리터럴(`WORD_ENRICH_PERSONA`, ~110자)을 `persona` 필드에 넣어 `--system-prompt` 가 실리게 해서 Claude Code 기본 코딩 에이전트 시스템 프롬프트가 안 섞이게 했다(engine/llm/index.ts `callOnce` — `req.persona` 있을 때만 `systemPrompt` 전달). `learning/vocab/enrich`(developer A) 는 이 함수가 만든 요청 객체를 **값으로만** 받아 `engine.llm.completeJson` 을 부르면 된다(module-dependency §4-4, L3 는 L2 를 import 하지 않음) — **응답 타입 `WordEnrichResponse` 는 learning 쪽에서 import 하지 말고, 같은 필드를 갖는 자체 로컬 타입을 구조적으로 맞춰 쓰길 권한다**(cross-layer type import 도 boundary 위반이라 eslint `no-restricted-imports` 에 걸린다 — `learning(L3) 은 conversation·speech 를 import 하지 않는다` 규칙, 확인차 실제로 `learning/**` 에서 `@/modules/conversation` 을 import 하는 임시 파일로 lint 걸어 봄, error 로 잡힘).
- [14:55] **출력 필드**(`structuredResponse/schemas.ts` 끝에 추가, 기존 스키마는 안 건드림) — `WORD_ENRICH_SCHEMA`/`WordEnrichResponse`/`PART_OF_SPEECH`(`PartOfSpeech` 타입, domain-model `PartOfSpeech` enum 그대로: NOUN·VERB·ADJ_I·ADJ_NA·ADVERB·PARTICLE·EXPRESSION·OTHER)가 카멜케이스(`reading/meaning/partOfSpeech/jlpt/example/exampleKo`)라 `WordEntry` 필드명과 1:1 — developer 가 draft 매핑에 변환 계층이 필요 없다. `valid:boolean`+`invalidReason:string|null` 로 "일본어 단어가 아님" 판정을 표현한다(한국어·영어·오타·의미 없는 문자열 → `valid:false`). 길이 한도는 domain-model 한도 이내: `reading` ≤120(`WordEntry.reading`), `meaning` 1~200(`WordEntry.meaning`), `example`/`exampleKo` 는 도메인이 `@db.Text`(≤2,000 지침)지만 A10 이 "단어 1개"만 다루는 동기·저지연 지점이라 200자로 더 좁혔다(짧은 예문 1개면 충분, 큰 상한은 지연·재시도 비용만 늘어난다). `jlpt` 는 valid 여도 모르면 null 허용(강제 안 함). api-contract #41 의 `{draft:{...}, saved:false}` 래핑은 이 스키마 바깥(route 몫) — 여기는 LLM 계약 필드만.
- [14:55] **후검증**(`structuredResponse/checks.ts` 끝에 `checkWordEnrich` 추가) — ① `valid` 와 나머지 필드 일관성(valid=true 인데 invalidReason 있음 / valid=false 인데 invalidReason 없음) ② `reading` 이 히라가나+장음부호(ー)만인지(정규식 `/^[ぁ-ゖー]+$/`) ③ `example` 이 `surface` 를 포함하는지. **jlpt 일치는 검사하지 않는다**(모르면 null 이 정답이라 강제할 게 없음), valid=false 일 때 다른 필드가 null 인지도 강제하지 않는다(route 가 버리므로 검사 비용 대비 재시도만 늘어남) — "과도한 검사로 재시도가 잦아지지 않게" 지시를 따랐다.
- [14:55] **함정 기록 1(재발 가능) — 활용형 예외, 처음엔 "없음"으로 갔다가 실측으로 뒤집음**: 최초 설계는 "surface 자체가 사전형이든 활용형(行きました)이든 example 은 표기 그대로 리터럴 포함만 보면 된다"였다(형태소 분석보다 훨씬 싸다는 이유). 그런데 haiku 로 픽스처 12건 1패스 실측(1차)에서 VERB `かける`(다의어, w08)가 **재시도 1회 후에도 계속 드롭**됐다(위반율 1/12 ≈ 8.3% > 목표 5%). `softExtraCheck` 로 raw 후보를 까 보니 원인은 표기 이탈(한자 바꿔치기)이 아니라 — 모델이 자연스러움을 위해 사전형 대신 활용형(`かけました`/`かけて`)으로 예문을 쓰기 때문이었다. 프롬프트 지시를 아무리 강하게("표기를 절대 바꾸지 마라") 다시 써도(2차 실측, 여전히 1/12 드롭) 이 자체는 안 고쳐졌다 — **왜냐하면 활용은 "표기를 바꾸는" 게 아니라 일본어 문법상 당연한 것**이라 지시와 모델의 자연스러운 문장 생성이 근본적으로 충돌했다. 최종 결정: 검사 쪽을 바꿨다 — `VERB`·`ADJ_I` 는 **어간(표기 마지막 1글자를 뺀 나머지)**이 리터럴로 들어 있으면 통과(`surface.length>=2` 가드로 1글자 표기의 빈 문자열 통과 구멍 방지). `NOUN`·`ADJ_NA`·`EXPRESSION` 등 활용 없는 품사는 여전히 리터럴 전체 일치만 인정(안 그러면 한자→가나 이탈 같은 진짜 위반을 놓친다). 프롬프트도 "활용형으로 써도 되지만 어간은 유지" 로 다시 썼다. **재발 시 확인할 곳**: `checks.ts` 의 `exampleCoversSurface`(비export, 내부 함수) 와 `wordEnrich.ts` 의 example 지시문 두 곳을 같이 봐야 한다 — 검사만 풀고 프롬프트를 그대로 두면 haiku 가 계속 활용형을 우선시하므로 무의미하지 않지만, 프롬프트도 명시적으로 "활용 가능"이라고 알려 주는 편이 모델이 헷갈리지 않는다(재시도 자체가 아예 없어짐 — 최종 검증에서 attempts 전부 1).
- [14:55] **함정 기록 2 — 가타카나 외래어 reading 정규화**: `コーヒー`(w07) 실측에서 모델이 `reading` 에 가타카나 원표기를 그대로 넣는 이탈은 **관찰되지 않았다**(전부 `こーひー` 로 정규화해서 냄, 4/4 실측 통과) — 다만 `checks.ts` 주석에 정규식(`/^[ぁ-ゖー]+$/`)을 미리 넣어 뒀으니 재발하면(다른 모델·tier 교체 시) 여기서 잡힌다. 재시도 유발 없이 통과했다는 뜻은 이 방어가 "보험"으로 남아 있어도 비용이 없다는 것.
- [14:55] **실측(최종, 수정 반영 후) 요약** — 우분투 미러, Claude CLI 2.1.222, haiku, `tests/live/word-enrich-measure.ts`(픽스처 `tests/prompts/fixtures/word-enrich.json` 12건: 유효 9·무효 3): n=15(전체 12패스 + `かける` 반복 3) 기준 **dropped=0/15(0%, 목표 ≤5% 충족)** · 재시도=0/15 · p50=2,795ms · p95=8,559ms(1건 이상치, 그 외 전부 2.6~3.4s) · max=8,559ms(20s 예산 안, 12s 회화 예산과 비교해도 여유) · `valid` 판정 일치 15/15 · `reading` 정확 일치 12/12 · `partOfSpeech` 일치 12/12 · `meaning` 키워드 포함 12/12 · 엔진명 누출 0. `jlpt` 일치는 8/12(다의어 `かける` 반복에서 N3/N4 를 섞어 답함 — **계약 위반 아님**, jlpt 는 "모르면 null" 이지 강제 일치 대상이 아니라서 fixture 의 `expectedJlpt:null` 기대와 어긋난 것뿐이고 checks.ts 도 검사하지 않는다). **총 호출 수는 계획한 18회를 넘겼다**(1차 18 + 2차 12 + 디버그 1 + 최종 15 = 46회) — 1차 실측에서 목표(≤5%) 초과 결함을 발견해 원인 진단(디버그 1콜)·프롬프트 재작성·검사 로직 수정·재검증까지 거쳤기 때문. 재검증 없이 넘겼으면 8% 위반율이 그대로 developer 인계본에 들어갔을 것이라 판단상 필요한 초과였다고 본다.
- [14:55] **프롬프트 길이**: A1(TALK) 3,000자 상한과 별개로 A10 은 대화가 아니라 훨씬 짧다 — 실측 `promptChars`(engine 이 재는 system+messages+persona 합) 는 학습자 수준 유무에 따라 1,969~2,750자(픽스처 12건 전부 ≤1,500자 단위테스트로 회귀 고정, `wordEnrich.test.ts` "프롬프트 총 길이" — 단, 그 테스트는 `renderTranscript` 결과 기준이라 engine 이 리포트하는 `promptChars`(대화 이력 렌더링 방식이 달라 페르소나 별도 합산)와 정확히 같은 수치는 아니고 상한 취지만 같다).
- [14:55] **테스트**: `src/modules/conversation/__tests__/wordEnrich.test.ts`(신규, 11개) — 픽스처 개수·요청 빌더 형태·level 생략·공백 trim/빈 문자열 에러·프롬프트 길이·스키마 통과/위반·`checkWordEnrich` 정상/위반(활용형 허용·1글자 가드 포함)·valid=false 관용도·픽스처 9건 합성 응답 스키마+후검증 회귀. `npm run typecheck`·`npm run lint`(0 에러, 기존 4개 경고는 무관 파일) ·`npm test`(93/93 통과) 확인 완료.
- [14:55] **모델 매트릭스 갱신 보류**: `docs/design-spec.md` §8 A10 행("home-m4/haiku·20s·동기·캐시")은 아직 안 고쳤다 — editable_files 지침대로 Leader 사전 협의 후 반영 요망. 제안 문구: "A10 | 단어 보강 | surface | reading, meaning_ko, part_of_speech, jlpt, example_ja, example_ko | haiku(실측, home-m4 미검증) | 20s | 동기·캐시, 프롬프트 ≈2,000~2,750자, 위반율 0%(n=15, 2026-09-27)". home-m4(qwen)는 이번 실측에서 라우터가 매번 `home-m4-lan 실패 → 다음 후보`로 넘어가 claude-cli 로만 응답했다(로컬 개발 환경에 home-m4 커넥션 자체가 없어서로 보임 — thekaiwa 전용 `HOME_M4_API_KEY` 부재는 task-004 결정 기록에도 이미 남아 있다) — qwen 비교는 그 키가 생긴 뒤 별도 실측 필요.

## Developer 기록

## Reviewer 기록

## QA 기록

## 최종 요약
