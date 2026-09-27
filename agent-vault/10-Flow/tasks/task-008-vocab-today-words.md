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

### 구현 중 Leader 판단 (2026-09-27)
- **L1** developer A 예외: #42 교정 목록은 conversation 에 읽기 전용 `listCorrectionRefsByWord(userId, wordId)` 를 추가해 라우트가 조합(learning 이 Correction 을 직접 읽지 않음 — 각 층 자기 테이블 원칙).
- **L2** developer A "정본과 다르게 한 것" 1~7 승인: ① `VocabSession.seed` 첫 글자 = 요청 모드(C|F)로 강등 재계산(스키마 변경 대신 — domain-model 주석 개정) ② VOCAB_SESSION 스냅샷 `data.date` 추가 ③ `durationSec` 3600 상한 ④ streak 은 오늘 세트가 없으면 어제부터 ⑤ #42 `attempts` = CORRECT+WRONG ⑥ 응답 필드 추가(삭제 없음) ⑦ PATCH `partOfSpeech:null` → OTHER. 표시 전용 요청은 답한 카드에도 허용(E2 확장, IN_PROGRESS 한정 유지).
- **L3** developer B: 지시 목록 밖 `useNow` 도 `components/common/` 으로 이동 승인(vocab→chat import 제거 목적, chat 은 import 경로만 변경·테스트 통과).

## 판단 기록 (judge)
- [2026-09-27 14:34] intake engine=jev → task_type=feature / risk=R2 / developer_model=opus / next=ask_user | overrides=- | fallback=- | tokens=1156
  - (신호) complexity 2.92(conf 0.92) · needs_info 0.63 · risk high 0.69
  - **override**(Leader): `next=ask_user` 를 따르지 않는다 — needs_info 신호는 300자 요약의 압축 탓이며, 판단 대상 사항(세트 크기·모드·가중치·보기 구성·강등·멱등·finish 트랜잭션·보관/다시 풀기·통계·A10 draft·시드 팩)은 정본 design-spec §7-2·api-contract #40~#54·domain-model 시드 §3 에 모두 정해져 있어 사용자에게 물을 미결정이 없다. 정본에 없는 소규모 결정(시드 팩 엔드포인트 등)은 Leader 가 사양에 명시한다. risk=R2 채택(`StatsSnapshot` 트랜잭션·삭제 후 집계 불변 = leader.md R2 보강 기준과 일치).
- [2026-09-27 14:39] codex_gate/C1 engine=jev → codex_required=true / mode=adversarial-review / focus=concurrency / budget_rule=CX-limit-unknown-r2 | overrides=- | fallback=- | tokens=953
  - **override**(Leader): Codex 미호출 — 2026-09-27 사용자 지시 "Codex 토큰 사용량이 없다, 충전되면 한 번 더 확인"(task-006 과 같은 사유). 한도 충전 후 재확인 대기. 동시성 초점(세트 생성·attempt 멱등·이중 finish·seed-pack)은 reviewer 감사 최우선 항목과 QA 실경합으로 대신한다.

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
### A(서버)
- [15:29] 구현 완료 — 커밋 `6b27a97`(자기 파일만 경로 지정). tsc 0 · lint 0 error(기존 경고 4, 무관 파일) · 단위 테스트 전체 통과(learning `task008.test.ts` 20개 + conversation `correctionRefs.test.ts` 1개) · 라이브 스모크 `tests/live/task008-smoke.sh 3011` **69/69 PASS 두 번**(dev 3011 은 끝나고 종료, build·pm2 미사용).
- **변경 파일**: `src/modules/learning/vocab/{words(확장),seedPack,enrich,setGenerator,distractors,sessions,stats}.ts` · `learning/snapshots/index.ts`(+`createVocabSessionSnapshot`) · `learning/index.ts` · `learning/__tests__/task008.test.ts` · 라우트 13파일/17핸들러 `src/app/api/v1/words/{route,[id]/route,[id]/archive,[id]/unarchive,categories,seed-pack}` · `src/app/api/v1/vocab/{sessions/route,sessions/[id]/route,[id]/attempts,[id]/finish,[id]/keep,[id]/replay,stats}` · `infra/text.ts`+`infra/index.ts`(`escapeLike` 추가만) · `tests/live/task008-smoke.{sh,ts}`·`README.md`.
- **Leader 승인 예외(conversation 2파일)**: #42 `corrections:[{id,chatId}]` 는 Correction(L2 소유)을 읽어야 해서, `conversation/corrections/index.ts` 에 읽기 전용 `listCorrectionRefsByWord(userId, wordId)`(userId·savedWordId 필터, 최대 20, 기존 함수·UPDATE 경로 무변경)를 추가하고 `conversation/index.ts` 에 export 한 줄. #42 라우트가 `learning.getWordDetail` 결과와 조합. 테스트 `conversation/__tests__/correctionRefs.test.ts`(가짜 DB 로 where 에 userId 가 실리는지·잘못된 id 는 DB 미호출).
- **E·F 구현 방식**
  - E1 seed-pack: `prisma/seed-data/words-n5.json` **정적 import**(`seedPack.ts`) — 번들러가 서버 청크에 넣으므로 cwd 무관. dev(Turbopack) 실측 OK, `next build` 는 금지라 빌드 산출물 포함 여부는 미실측(정적 import 라 포함되는 게 정상). 모듈 로드 시 형태 검증(품사·조각 enum). 사용자 행 잠금 → 후보를 DB(콜레이션)로 좁히고 JS `Set`(바이트 일치)로 판정 → `createMany`.
  - E2·F9 flag 전용: 답 필드 없이 `{order, flagged}` → IN_PROGRESS 에서만(아니면 409), 응답 `{order, flagged}` 2키. 답과 함께 온 `flagged` 는 첫 답 저장 때만 반영(재전송은 변경 없음).
  - E3: 이전 날짜 IN_PROGRESS 도 새 세트 409 `{sessionId}`, 기록 날짜 = 세션 `date`(StudyLog·DAILY·스냅샷 `data.date`).
  - E4·F7 replay: 보관한 DONE 만(409), 사용자 행 잠금 → 진행 중 409 → 원 세트 카드 순서대로 현재 단어(있으면 최신 값)/삭제 단어는 `*Snap` → 새 시드로 셔플 → 삭제 단어 하나라도 있으면 전체 FLIP. CHOICE 유지 시 보기는 현재 보관 안 한 단어 뜻에서 새로 뽑음.
  - E5: finish 에서 미답 → SKIPPED, 단어 카운터는 CORRECT/WRONG 만 +1, SKIPPED 는 `lastSeenAt`·`lastResult` 만(자동 SKIPPED 포함 — 정본 문구대로).
  - E6 보기: `distractors.pickChoices` — 사용자 **보관 안 한** 단어 뜻(카테고리·오늘 DONE 무관) 중 정답과 다른 문자열(바이트), 같은 품사 우선 → 부족분 다른 품사, 4개를 시드 셔플. 강등 조건 = 풀 <4 **또는** 서로 다른 뜻 <4(또는 어떤 카드든 보기 3개를 못 채움).
  - E7 동시성: 아래 "동시성 자기 점검".
  - E8·F8 enrich: 라우트가 `conversation.buildWordEnrichRequest({surface, level=Profile.level})` 로 요청을 만들어 `learning.enrichWord(input, request)` 에 값으로 넘김. learning 은 conversation 타입을 import 하지 않고 로컬 구조 타입 `WordEnrichOutput`. 순서: 본문 검증(400) → `rateLimit(enrich:<userId>, 20/분)`(429) → 같은 표현 있으면 409 `{existingId}`(LLM 호출 전) → 메모리 캐시(키=[surface, level], 500개·24h, LRU 근사) → `engine.llm.completeJson`. `valid:false` → `200 {draft:{valid:false, invalidReason, 나머지 null}, saved:false}`. 저장 0.
  - F1: FLIP 카드는 #47·#49 에 `meaning`(Snap)·`example`·`exampleKo`(현재 단어, 삭제면 null). CHOICE 미답 카드 키 = `order·wordId·surface·reading·choices·flagged·answered` 뿐(단위 테스트로 키 목록 고정).
  - F2: 답(사용자가 답·건너뛰기 한 카드) 0장 finish → ABANDONED(`finishedAt` 만), StudyLog·스냅샷·카운터 0, `studyLogId:null`.
  - F3 #48: `startedAt desc,id desc` 키셋 커서, `kept=0|1`·`status` 필터, `answeredCount` = `answeredAt` 있는 카드 수(끝낼 때 자동 SKIPPED 제외).
  - F4 #49: 세션에 개수·`durationSec`·`keptAt`·`replayOfId`·`finishedAt`, 답한 카드·끝난 세트(DONE·ABANDONED)는 `answer·correctText·chosenText·example·exampleKo·answeredAt`.
  - F5: `NO_WORDS`(보관 안 한 단어 0) → `NO_WORDS_IN_CATEGORY` → `ALL_DONE_TODAY` 순 판정, `cta` 는 각각 `[ADD_WORD,SEED_PACK]`·`[ALL_CATEGORIES,ADD_WORD]`·`[]`.
  - F6 #46: `groupBy(category, archived)` → `count`(보관 제외)·`archivedCount`, null 분류는 끝.
  - 가중 샘플링: `w = clamp(1+2·wrong−0.5·correct, 0.25, 8) × recency(null 2.0 / ≥7일 1.5 / ≥1일 1.0 / <24h 0.3)`, PRNG = cyrb128→sfc32(시드 문자열 전체), 후보를 id 로 정렬 → Efraimidis–Spirakis(key=ln(u)/w 상위 k) → Fisher-Yates. 같은 시드·같은 후보 → 같은 결과(입력 순서 무관)를 단위 테스트로 보장.
- **동시성 자기 점검(Codex 보류 대체, 결론)** — 잠금 순서: 생성·replay·finish·단어 수정·삭제·seed-pack = **사용자 행 → (세트 행) → 대상 행**, 답 = 세트 행 → 카드 행, 보관/keep = 단일 조건부 UPDATE.
  1. 동시 세트 생성 2회: 둘 다 사용자 행 대기 → 두 번째는 READ COMMITTED 로 첫 번째가 커밋한 IN_PROGRESS 를 봄 → 409 `{sessionId}`. 실측 200/409·DB 진행 중 1.
  2. 같은 order 동시 답: 세트 행 `FOR UPDATE` 로 직렬 + `answer IS NULL` 조건부 갱신 → 두 번째 이후는 첫 결과 반환. 실측 5동시 → 결과 1개·DB 일치.
  3. 동시 finish: 사용자 행 → 세트 행 잠금 후 상태 확인 → 두 번째 이후는 DONE 을 보고 같은 응답(`finishResult` 한 함수로 재구성). VOCAB_SESSION 은 `@@unique(userId,kind,periodKey)` 가 최종 보증. 실측 3동시 → 응답 바이트 동일·StudyLog 1·스냅샷 1·카운터 1회·DAILY 1회분.
  4. finish ↔ 답 겹침: 같은 세트 행을 잡으므로 (답 먼저 → 집계 포함) 또는 (finish 먼저 → 답 409). 답은 사용자 행을 잡지 않지만 finish 가 사용자→세트 순, 답이 세트만이라 순환 없음. 실측 두 실행에서 두 순서 모두 관찰(409/correct=1, 200/correct=2), 스냅샷=세션 카운터.
  5. 동시 seed-pack: 사용자 행 직렬 → 두 번째 added 0. 실측 50/0·SEED 행 50.
  6. 단어 삭제 ↔ finish: 둘 다 사용자 행 먼저 → 직렬. 삭제가 먼저면 finish 는 `wordId=null` 카드의 카운터를 건너뜀(Snap 유지), finish 가 먼저면 카운터 갱신 후 삭제. FK SET NULL(카드 행 X 잠금)과 finish 의 카드 UPDATE 가 역순으로 잠글 여지는 사용자 행 선점으로 제거. 실측 둘 다 200·스냅샷 3/0/2 일치.
  7. 반례 검토(문제 없음으로 결론): 삭제 ↔ 답(답은 wordId 를 바꾸지 않아 FK 부모 잠금 없음, 순환 없음) · 보관(archive, 잠금 없음) ↔ 세트 생성(카드 INSERT 가 부모 S 잠금 → archive 단일 문장 끝나길 기다릴 뿐) · keep ↔ finish(keep 은 DONE 조건부 UPDATE, IN_PROGRESS 면 409) · replay ↔ 원 세트 삭제 불가(세트 삭제 API 없음). P2034(교착) 가 나더라도 `withTransaction` 이 전체 재시도.
- **스모크 결과(완료 기준별)**: 2 CRUD·중복 409·히라/가타 비중복·수정 read_only·표현 변경 409·seed-pack 50→0·목록/커서/검색(`%` 글자 그대로)/카테고리/정렬/보관/집계 ✅ · 3 CHOICE 미답 키 7개만(#47·#49)·정답 위치 45장 12/11/10/12 ✅ · 4 채점·∉choices 400·재전송 첫 결과·responseMs 60,001 400·DONE 409·flag 전용 ✅ · 5 FLIP 강등(풀 1·풀 3)·NO_WORDS·NO_WORDS_IN_CATEGORY·ALL_DONE_TODAY·오늘 DONE 제외·진행 중 409 ✅ · 6 finish 전 항목·동시 3회·ABANDONED ✅ · 7 삭제 후 #54·스냅샷 바이트 동일·Snap·#49 정상·streak ✅ · 8 keep/replay(F7 409·keptAt 유지·삭제 단어 → FLIP·CHOICE 유지 replay) ✅ · 9 IDOR 11종 404·원본 불변·무세션 401 ✅ · 10 아래 ✅ · 11 enrich draft·F8·캐시·분당 21번째 429 ✅ · 엔진명 0 ✅. Claude CLI 실호출 6회(스모크 2회 × 3).
- **기준 10(10장 3분)**: 세트 생성 607~686ms · attempt p50 **604~618ms**(max 892ms) · finish 1.76~2.42s · 서버 합계 8.6~9.8s → 12s/장 가정 사용자 총 **128.6~129.8s ≤ 180s**. 지연 원인 실측: 쿼리는 전부 0~2ms 인데 **쓰기 트랜잭션 COMMIT 이 400~530ms**(NAS MariaDB 디스크 동기화) — 모듈 직접 호출에서도 attempt ≈120~530ms 중 COMMIT 이 대부분. 코드로 줄일 수 있는 건 왕복 몇 ms 뿐이라 손대지 않음(화면의 "확인 중…" 상태로 흡수, 운영도 같은 NAS).
- **정본과 다르게 / 정본 공백을 메운 것**
  1. `VocabSession.seed` 첫 글자 = 요청 모드(`C`/`F`) + 30hex — 스키마에 요청 모드 컬럼이 없어 #49 가 `downgraded` 를 다시 계산하려고. PRNG 는 문자열 전체를 시드로 씀(재현성 유지).
  2. VOCAB_SESSION 스냅샷 `data` 에 `date`(세션 KST 날짜) 추가 — #54 `daily` 를 스냅샷만으로 만들려고(정본 형태의 확장, 기존 키 유지).
  3. `durationSec` = 벽시계(finishedAt−startedAt) 초, **3,600 에서 자름**(떠났다가 며칠 뒤 끝낸 세트가 통계를 망가뜨리지 않게).
  4. `streakDays`: 오늘 세트가 없으면 어제부터 셈(오늘 풀면 이어지는 연속 기록). ABANDONED 는 스냅샷이 없어 영향 0.
  5. #42 `stats.attempts`·`last7d` 는 CORRECT/WRONG 만 셈(SKIPPED 제외), `corrections` 는 위 conversation 예외 함수.
  6. 응답에 계약보다 **추가된 필드**(삭제 없음): WordEntry `archivedAt` · 세션 `finishedAt` 항상 · #51 `wrongWords[].reading` · #54 `byCount/daily[].sessions·skipped` · draft `surface` · #47 empty `cta` 사유별.
  7. #43 `partOfSpeech:null` → `OTHER`(컬럼 NOT NULL), 빈 PATCH `{}` 는 현재 값 200. #50 `responseMs` 는 선택(없으면 null).
- **트러블슈팅(재발 가능)**: ① Prisma `contains` 는 `%`·`_` 를 이스케이프하지 않는다(`contains:'%'` 가 전 행 일치 실측) → `infra.escapeLike` 로 `\` 이스케이프. ② NAS MariaDB 쓰기 COMMIT ≈0.4~0.5s — 쓰기 API p50 의 바닥값. ③ Next dev 는 소스 동기화(HMR) 때 모듈을 다시 평가해 enrich 메모리 캐시가 비워진다(운영 `next start` 에는 해당 없음). ④ Fact-Forcing 훅이 `rm -rf` 가 든 Bash 를 막는다 — 임시 파일은 `rm -f` + `rmdir` 로.
- **알려진 한계**: enrich 캐시·분당 제한은 프로세스 메모리(blue/green 두 프로세스면 최대 40/분·캐시 분리). 오늘 DONE 제외는 세트 `date`(시작일) 기준이라 자정 넘어 끝낸 세트는 "시작한 날" 단어로 제외된다. `listCategories` 는 DB 콜레이션으로 묶어 대소문자·가나만 다른 분류는 한 칩(대표 표기 하나). 삭제된 단어 카드의 예문은 재생 시 없음(Snap 에 예문 컬럼이 없음).
- [15:47] **REV-008 수정** — 커밋 `10b770e`. H1: `toCardDto` 공개 조건 `answered || status === 'DONE'`(ABANDONED 는 진행 중과 같이 미답 CHOICE 정답·예문 숨김, FLIP 뜻은 F1 그대로). grep 결과 정답을 `status !== 'IN_PROGRESS'` 로 여는 곳은 이 한 줄뿐(#48 은 카드 없음, #53 은 새 세트를 IN_PROGRESS 로 직렬화, finish ABANDONED 응답의 wrongWords 는 0개). L1: `keepVocabSession` 을 사용자 행 → 세트 행 잠금 트랜잭션으로(다시 풀기와 직렬화). 단위 테스트에 `toCardDto('CHOICE'|'FLIP','ABANDONED', 미답)` 추가, 스모크에 6h′(ABANDONED #49 재조회)·6h″(ABANDONED keep 409)·8e′(keep 해제·재보관 동시) 추가. tsc 0·lint 0 error·test 146/146·스모크 **72/72 PASS**(attempt p50 628ms, 10장 사용자 총 129.2s). dev 3011 종료.

### B(화면)
- [15:31] 구현 완료 — 커밋 `e06796c`(자기 파일만 경로 지정, 65파일). `npm run typecheck` 0 · `npm run lint` 0 error(경고 4 = 기존 settings·login 파일, vocab 0) · `npm test` 146/146(내 테스트 4파일 + 기존 chat 테스트 전부 통과). build·dev·pm2 미사용. 서버 코드는 열지 않고 계약(api-contract §2-9·§2-10)과 위 A 기록만 보고 맞췄다.
- **파일**: 신규 `src/types/vocab.ts` · `src/components/vocab/`{`WordsScreen`,`WordSearchBar`,`CategoryChips`,`ArchiveToggle`,`WordRow`,`WordsEmpty`,`WordAddSheet`,`WordForm`,`WordDetailSheet`,`TodayHome`,`TodayWordsCard`,`VocabStatsCard`(WeekStrip 포함),`KeptSets`,`TodayComingSoon`,`FinishConfirmSheet`,`VocabSessionScreen`,`VocabDeck`,`DeckProgress`,`DeckNotice`,`SwipeCardStack`,`VocabCardFace`,`ChoiceList`,`FlipControls`,`DeckToolbar`,`GestureHint`,`VocabResult`,`WordResultList`}`.tsx` · {`useVocabDeck`,`useAttemptQueue`,`useCardTimer`,`hooks`,`deck`,`format`,`labels`,`validate`}`.ts` · `__tests__/{deck,format,validate,labels}.test.ts` · `src/app/(app)/study/today/words/[sessionId]/page.tsx`. 수정 `src/app/(app)/study/today/page.tsx`(앱바 "오늘의 공부" + `dailyWordCount`) · `src/app/(app)/drawer/words/page.tsx`(`?word=`·`?add=1` → props) · `src/components/shell/TabBar.tsx`(`HIDDEN_PREFIXES` 에 `/study/today/words/`).
- **F10 공용 헬퍼 이동**(git mv, 채팅 동작 불변): `chat/errors.ts` → `common/errors.ts`(그대로) · `chat/format.ts` → `common/format.ts`(KST·`cpLength`, `toDate` export 추가) — 채팅 전용 `GROUP_GAP_MS`·`withinGroupGap` 은 `chat/format.ts` 에 남김 · `chat/storage.ts` → `common/storage.ts`(`readStore`·`writeStore`) — 채팅 저장 키 `KEYS` 는 `chat/storageKeys.ts` · **`chat/useNow.ts` → `common/useNow.ts`**(지시 3종 밖이지만 같은 이유 — 추가 시트의 진행 초·429 카운트다운이 필요해 vocab 이 chat 을 import 하지 않게 함께 옮김). chat 14파일은 import 경로만 바뀜, `chat/__tests__/format.test.ts` 도 import 만.
- **가이드와 달라진 점(사유)**
  1. F1 확정에 따라 FLIP 은 "앞면 → [뜻 보기]/탭/Space → 뒷면 → [알았어요]/[몰랐어요] → 0.4초 뒤 자동 다음". §5-2 D 대체 흐름(뜻 없음)은 `card.meaning` 이 비었을 때만 쓰는 방어로 남김.
  2. F2 반영: 끝내기 시트는 답 0장이면 제목 "이 세트를 그만둘까요?"·본문 "지금 그만두면 기록 없이 세트가 닫혀요"·버튼 [그만두기]. #51 이 `ABANDONED` 면 덱은 오늘 홈으로 `replace` + 토스트 "답한 카드가 없어서 기록 없이 세트를 닫았어요.", 오늘 홈 [여기서 끝내기]는 제자리 토스트 + 다시 읽기. `ABANDONED` 세트 주소로 직접 오면 "기록 없이 닫은 세트예요" 안내 + [오늘로].
  3. F3·F5 반영: 풀던 세트는 #48 `?limit=10` 의 `IN_PROGRESS`(항상 가장 최근 세트)에서 `answeredCount` 로 바로 그림(#49 추가 호출은 `answeredCount` 가 없을 때만). 빈 풀은 서버 사유 사용 — `NO_WORDS` → 빈 단어장 상태, `NO_WORDS_IN_CATEGORY` 또는 분류 선택 중 → "‘분류’에서 오늘 풀 단어가 없어요", 그 외 → "오늘 풀 단어를 모두 풀었어요".
  4. 분류 칩 "전체 n" = 기준 개수 **전부의 합(분류 없음 포함)** — 가이드는 "보이는 칩의 합"이지만 분류 없는 단어도 "전체"에 나오므로 숫자와 목록이 맞게 함.
  5. 덱 → 오늘 홈 안내는 `sessionStorage kaiwa.vocab.flash`(문구 1개) 하나로 통일 — 떠남("풀던 세트는 저장했어요…")·기록 없이 닫힘·다시 풀기 409("풀던 세트를 먼저 끝내 주세요") 세 경우. 가이드의 `kaiwa.vocab.left = sessionId` 대신.
  6. 저장 선택값(정렬·방식·분류·읽기)은 `useSyncExternalStore` + 메모리 사본(`hooks.ts useStoredPref`) — 서버 렌더는 기본값, 하이드레이션 뒤 저장값으로 바뀌어 불일치 경고가 없고, 저장소가 막혀도 이번 방문 동안 고른 값이 유지됨. `?word=`/`?add=1` 시트도 `useHydrated()` 뒤에 연다(포털 하이드레이션 불일치 방지).
  7. 결과 띠 FLIP "✓ 알았어요"/"✗ 몰랐어요"는 good/bad 톤(§5-2 D 흐름 문구 기준 — §5-2 B 표는 중립으로 읽힐 여지가 있음). 건너뜀만 중립.
  8. 추가 시트 [뜻 채우기]: 빈 표현이면 `aria-disabled` + "표현을 적으면 누를 수 있어요", 80자 초과는 입력 아래에 바로 표시. 폼의 예문·메모 칸은 접힌 동안 그리지 않는다(숨긴 textarea 는 자동 높이를 잴 수 없음 — 값은 폼 상태에 유지).
  9. 카드 드래그의 세로 이동은 위쪽만 따라온다(표시 제스처 힌트) — bjj 는 아래로도 따라옴.
- **확인 못 한 것(NOT_VERIFIED)**: 이번 지시로 `next dev`·build 를 돌리지 않아 **화면 실렌더 0회** — 360/390/412 가로 넘침·덱 높이(412×780·390×800 스크롤 없음)·실기기 제스처(탭/밀기 임계·touchend 유령 클릭·두 손가락·touchcancel)·Gboard 검색 조합·키보드 초점 이동은 QA(dev 3011)·사용자 폰 확인 항목. 제스처 판정·키 매핑·요청 큐 순서·타이머는 단위 테스트로만 확인.
- **A 와 합칠 때 확인할 계약 가정**
  1. #42 응답은 평평한 `WordEntry + stats + corrections` 라고 보고, `{word, stats, corrections}` 로 감싸 와도 받게 정규화(`validate.normalizeWordDetail`).
  2. #46 응답은 배열(`{items}` 로 감싸도 받음), 항목 `count`(보관 제외)·`archivedCount`.
  3. #41 enrich 응답 `{draft:{…}, saved:false}`, `valid:false` 면 `invalidReason` 을 표현 아래에 그대로 보인다(선생님 설명 — 엔진 용어가 없어야 함). 409 `details.existingId` 는 enrich·저장 둘 다 [그 단어 보기]로 처리. 429 는 `details.retryAfterSec` → `Retry-After` → 10초 순.
  4. #43 은 바뀐 필드만, 비운 선택값 `null`(`jlpt:null` 포함). `partOfSpeech` 는 늘 enum 값을 보낸다. 응답은 `WordEntry`.
  5. #45 응답은 `archived`(+`archivedAt`) — 전체 WordEntry 여도 병합. #44 는 응답 본문을 쓰지 않음(404 도 삭제로 취급).
  6. #47·#53 `session.downgraded`, 빈 풀 `{session:null, empty:{reason}}`. 덱은 #47 카드를 쓰지 않고 늘 #49 로 다시 읽음.
  7. #49 카드: `answered`/`answer` 둘 중 하나라도 있으면 답한 카드. CHOICE 정답 표시는 **#50 응답 `correctText` 와 문자열이 같은 보기**. FLIP 카드는 `meaning`(+예문)을 처음부터 가진다고 가정(F1) — 없으면 대체 흐름.
  8. #50 CHOICE 본문에 `flagged`(현재 로컬 값)를 함께 보냄, 표시 전용은 `{order, flagged}` 만(F9 응답은 쓰지 않음 — 실패 시에만 되돌림). `responseMs` 는 0~60,000 으로 잘라 보냄, 건너뛰기에는 없음. 409 → #49 다시 읽기(DONE 이면 결과 + "이미 끝난 세트예요"), 400 → #49 다시 읽기.
  9. #51 `session.status==='ABANDONED'` 로 F2 판별. DONE 이면 #49 를 한 번 더 읽어 카드 정답·예문을 채움(실패하면 #51 개수·시간만).
  10. #52 응답에서 `keptAt` 만 사용. #53 은 보관 세트에서만 버튼을 보인다(F7), 409 → 오늘 홈 + 안내.
  11. #48 `?kept=1&limit=5` 는 DONE 만 걸러 보인다(방어). #54 `byCount` 가 비면 통계 섹션 숨김, `daily[].date` 로 최근 7일 칸.
  12. 결과 행 링크는 `/drawer/words?word=<wordId>`, `wordId:null`(지운 단어)은 링크 없이 "지운 단어" 뱃지.

## Reviewer 기록

### REV-008 (2026-09-27) — task-008 단어장·오늘의 단어, 커밋 be82a63·6b27a97·e06796c 감사

**범위**: `git diff 4cac3de..54ec31f -- src tests eslint.config.mjs`(102 files, +8778/-155). `npm run typecheck`(0 error)·`npm run lint`(0 error, 기존 무관 경고 4)·`npm test`(146/146 PASS) 재실행으로 Developer 보고와 일치 확인. `build`·`dev`·pm2·DB 쓰기·Claude CLI 호출은 지시대로 실행하지 않음.

**판정**: **CONDITIONAL_PASS** (Critical 0 · High 1 · Medium 0 · Low 1)

**Critical**: 없음.

**High (1건)**

| # | 이슈 | 컴포넌트 | 심각도 |
|---|---|---|---|
| H1 | **ABANDONED 세트의 CHOICE 카드가 한 번도 답하지 않았는데 GET #49 에서 정답(`correctText`)이 그대로 노출된다** | `src/modules/learning/vocab/sessions.ts:128-145`(`toCardDto`) + `src/modules/learning/vocab/sessions.ts:462-511`(`finishVocabSession` ABANDONED 분기) | HIGH |

- **조건**: `toCardDto` 의 공개 조건이 `const reveal = answered || status !== 'IN_PROGRESS'`(line 132)다. api-contract #49 원문은 "**status=DONE 이면** 전체 카드 정답 포함"이라고만 하는데, 구현은 `IN_PROGRESS 가 아니면 전부`(즉 DONE **과 ABANDONED 모두**)를 reveal 조건으로 잡았다.
- **재현**: ① `POST /vocab/sessions`(CHOICE, 아무 장수) ② 카드에 한 번도 답하지 않고 곧바로 `POST /vocab/sessions/:id/finish` → `finishVocabSession`(line 469)이 "답한 카드 0장" 분기로 들어가 세션을 `ABANDONED` 로만 닫고(`finishedAt` 만 갱신) **`VocabAttempt.answer` 를 SKIPPED 로 바꾸는 `updateMany` 를 타지 않는다**(그 줄은 469번 이후, 이 분기는 그 전에 `return`) → 모든 카드가 `answer=null` 로 영구히 남는다. ③ `GET /vocab/sessions/:id`(#49) 호출 → `getVocabSession` 이 `toCardDto(s.mode='CHOICE', s.status='ABANDONED', attempt)` 를 부른다 → `answered=false` 이지만 `status !== 'IN_PROGRESS'` 가 참이라 `reveal=true` → 응답에 `correctText`(=`meaningSnap`, 실제 정답 뜻)·`example`·`exampleKo` 가 **한 번도 답하지 않은 카드에도** 그대로 실린다.
- **영향**: "정답 미노출"은 이 task 의 완료 기준 3·F1·checklist 1순위로 명시된 핵심 계약이다. 이 경로로는 사용자가 세트를 만들고 바로 0장으로 끝낸(=`ABANDONED`) 뒤 그 세트를 다시 읽기만 하면 방금 뽑힌 단어 전부의 뜻을 힌트 없이 확인할 수 있다 — 오늘 DONE 제외 규칙도 ABANDONED 에는 적용되지 않으므로 같은 단어가 다음 세트에도 다시 나올 수 있어 반복 악용이 가능하다. 프런트(B)는 `session.status==='ABANDONED'` 를 보면 덱을 그리지 않고 안내 화면으로 돌린다고 기록했지만(개발자 B 기록 §확인 못 한 것 위, "ABANDONED 세트 주소로 직접 오면…" 문구), 이는 **참조 클라이언트의 선택**일 뿐 서버 계약 자체가 새고 있어 다른 클라이언트(추후 API 재사용·Export·직접 호출)에는 방어가 없다.
- **증거**: `src/modules/learning/__tests__/task008.test.ts:112-133` 의 `toCardDto` 단위 테스트는 `'IN_PROGRESS'`·`'DONE'` 두 상태만 검사하고 `'ABANDONED'` 는 다루지 않는다. `tests/live/task008-smoke.ts:290-294` 의 F2 스모크도 `finish` 응답(`session.status/studyLogId`)만 확인하고 그 뒤 `GET #49` 를 다시 호출해 카드 내용을 보지 않는다 — 그래서 69/69 PASS 로도 이 결함이 드러나지 않았다.
- **권고**: `toCardDto` 의 reveal 조건을 계약 문구 그대로 `status === 'DONE'` 로 좁힌다(`const reveal = answered || status === 'DONE'`). 이렇게 하면 ABANDONED 세트는 IN_PROGRESS 와 같은 수준으로 미답 카드를 계속 숨긴다(F2 가 요구하는 "기록·스냅샷·카운터 변화 0" 과도 자연스럽게 맞는다 — ABANDONED 는애초에 "본 적 없는 것으로 친다"는 취지). 회귀 테스트로 `toCardDto('CHOICE','ABANDONED', {..답 없음..})` 이 `correctText`/`example`/`exampleKo` 를 갖지 않는지 단위 테스트에 추가하고, `task008-smoke.ts` 의 F2 케이스(6h) 뒤에 `GET #49` 를 한 번 더 호출해 카드가 여전히 숨겨져 있는지 확인하는 스텝을 추가할 것을 권한다.

**Low (1건, 비차단)**

| # | 이슈 | 컴포넌트 | 비고 |
|---|---|---|---|
| L1 | `keepVocabSession`(#52)은 사용자 행 잠금 없이 조건부 `updateMany` 하나로 끝나고, `replayVocabSession`(#53)은 `lockUserRow` 로 자기 자신끼리는 직렬화되지만 **동시 `keep(false)` 호출과는 어떤 잠금도 공유하지 않는다**. 이론상 "보관 해제"와 "다시 풀기"가 동시에 오면 방금 해제된 세트가 그대로 replay 될 수 있다(데이터 손상·이중 반영은 없음 — replay 시점에 `keptAt` 이 아직 non-null 이면 정상 케이스로만 진행되고, 최악의 경우도 사용자가 막 해제하려던 세트 하나가 한 번 더 복제되는 수준). Developer 기록의 "반례 검토" 목록에는 이 조합이 빠져 있다. | `src/modules/learning/vocab/sessions.ts:522-531`(`keepVocabSession`)·`537-562`(`replayVocabSession`) | 기록만, 수정 필수 아님 |

**확인됨(문제 없음, 근거 포함)**

- **동시성 — 핵심 시나리오 6종 코드 추적 결과 Developer 자기 점검과 일치**: 동시 세트 생성 2회(사용자 행 직렬 → 두 번째 409), 같은 `order` 동시 답(세트 행 `FOR UPDATE` + `answer IS NULL` 조건부 갱신, `sessions.ts:402-429`), 동시 finish 3회(사용자 행 → 세트 행 → 상태 확인 후 멱등 재응답, `sessions.ts:462-511`), 답↔finish 겹침(둘 다 세트 행을 잡아 순서만 갈릴 뿐 순환 없음), 단어 삭제↔finish(둘 다 사용자 행을 먼저 잡아 직렬, `words.ts:323-331`), 동시 seed-pack(사용자 행 직렬, `seedPack.ts:65-84`) — 잠금 순서(사용자 행 → 세트 행 → 카드/단어 행)가 모든 쓰기 경로에서 일관되고 `withTransaction` 의 READ COMMITTED(`infra/tx.ts`)와 맞물려 교착·이중 반영 여지를 찾지 못했다.
- **finish 멱등·트랜잭션**: `finishVocabSession` 하나의 `withTransaction` 안에 카드 SKIPPED 확정 → 세션 카운터 → 단어 카운터(E5, `correctCount/wrongCount` 만 증가·SKIPPED 는 `lastSeenAt/lastResult` 만) → `recordStudyLog` → `createVocabSessionSnapshot` → `bumpDailySnapshot` 이 전부 들어 있다(`sessions.ts:462-511`). 이미 DONE/ABANDONED 면 재호출 시 같은 `finishResult()` 를 재구성해 돌려주고 부작용이 없다. F2(답 0장 → ABANDONED, 기록·스냅샷·카운터 변화 0)도 코드로 확인.
- **삭제 후 집계 불변**: `deleteWord` 는 `WordEntry` 행만 지우고(`words.ts:323-331`) `StatsSnapshot` 을 전혀 건드리지 않는다. `#54`(`stats.ts`)는 `StatsSnapshot(VOCAB_SESSION)` 만 읽으므로 원본 삭제와 무관하게 값이 불변임을 코드로 확인. `VocabAttempt.wordId` 는 스키마 `onDelete: SetNull`(`prisma/schema.prisma:863`)이고 `*Snap` 컬럼이 이력을 보존한다.
- **6층 경계**: `learning/**` 전체(신규 `vocab/{words,seedPack,enrich,sessions,setGenerator,distractors,stats}.ts` 포함)에 `@/modules/conversation` import 없음(grep 확인). `#42` 의 교정 참조는 Leader 승인 예외대로 라우트(`words/[id]/route.ts`)가 `conversation.listCorrectionRefsByWord`(읽기 전용, `userId` 스코프)와 `learning.getWordDetail` 을 조합하는 방식으로 구현돼 있다. `learning/vocab/enrich.ts` 는 `conversation` 의 `WordEnrichResponse` 타입을 import 하지 않고 구조적으로 같은 필드의 로컬 타입(`WordEnrichOutput`)을 쓴다(module-dependency §4-4 그대로). `eslint.config.mjs` 는 이번 diff 에서 변경되지 않았고 기존 경계 규칙(`no-restricted-imports`)이 그대로 이 파일들에 적용된 채로 lint 0 error.
- **components/common 이동(F10)**: `chat/{errors,storage,useNow}.ts` → `common/`, `chat/format.ts` 의 공용부(`toDate` 포함)만 `common/format.ts` 로 이동하고 채팅 전용 `GROUP_GAP_MS`/`withinGroupGap` 은 `chat/format.ts` 에 남아 있음을 diff 로 확인. 14개 chat 컴포넌트는 import 경로만 바뀌었고 `chat/__tests__/format.test.ts` 포함 기존 chat 테스트 전부(146/146 안에 포함) 통과.
- **IDOR**: 신규 라우트 17개 전부 `requireSession()` 뒤 서비스 함수에 `userId` 를 넘기고, 서비스 함수는 전부 `where:{id,userId}` 로 걸러 없거나 남의 것이면 `notFound()`(404)를 던진다(`words.ts`·`sessions.ts` 전체 확인). `lockSession` 의 원시 SQL(`sessions.ts:221-226`)도 `WHERE id=… AND userId=… FOR UPDATE` 로 소유자 조건이 잠금 자체에 들어있다.
- **A10(E8·F8)**: `buildWordEnrichRequest`(`conversation/prompts/wordEnrich.ts`)가 `INJECTION_GUARD` 를 포함하고, `--json-schema`(`WORD_ENRICH_SCHEMA`) + `checkWordEnrich` 후검증 + 캐시(`enrich.ts`)가 정상 연결. 라우트(`words/route.ts`)는 본문 검증 → `rateLimit('enrich:<userId>', 20)`(분당 20) → 표현 중복 409(LLM 호출 전) → `enrichWord` 순서로, `valid:false` 응답은 `saved:false` 유지(DB 행 0). 진단 diff·소스 전체에 `claude|haiku|sonnet|opus|qwen|home-m4|reazon|whisper` 등 엔진 식별자가 `src/` 실제 코드(주석 포함)에는 나타나지 않고, 테스트·실측 스크립트의 `LEAK` 정규식 안에만 있음을 grep 으로 확인.
- **seed-pack 정적 import**: `prisma/seed-data/words-n5.json` 을 `learning/vocab/seedPack.ts` 가 상대 경로로 정적 import. `tsconfig.json` 의 `resolveJsonModule:true` 와 Next.js(webpack/Turbopack) 의 표준 JSON 모듈 인라인 동작, `next.config.ts` 에 JSON/외부화 관련 예외 설정이 없는 점으로 미루어 서버 청크에 포함될 구조로 판단(코드 근거 판단, `build` 미실행이라 완전 확정은 아님 — QA 인계).
- **화면 통합 가정(B 12개) 대조**: #41(`{draft,saved:false}`+409 `existingId`)·#43(부분 갱신·`null` 허용)·#45(archived 토글)·#46(배열+count/archivedCount)·#47/#53(`session.downgraded`+빈 풀 `{session:null,empty}`)·#48(`answeredCount` 포함)·#49(F1 FLIP 상시 `meaning`)·#50(`{order,flagged}` 표시 전용·`chosenText` 검증)·#51(`ABANDONED` 판별)·#52(`keptAt`)·#54(`byCount`/`daily`) 전부 A 쪽 실제 응답 필드와 어긋남 없음을 코드 대조로 확인. H1 은 #49 의 "미답 카드 정답 숨김" 가정이 ABANDONED 상태에서만 깨지는 경우라 이 목록에는 없던 사각지대다.

**QA 인계**

- `high_risk_areas`: ① **H1 수정 후 재검증 필수** — GET #49 on ABANDONED session, 특히 "세트 생성 → 즉시 finish(0장) → GET" 시나리오. ② finish/attempt/replay 동시성(코드 추적만 했고 실경합 재현은 Developer 스모크 6종에 의존 — QA 가 별도 재현하면 더 좋음). ③ seed-pack JSON 이 실제 프로덕션 빌드 산출물에 포함되는지는 이번 리뷰가 `build` 를 실행하지 않아 코드 근거 판단만 했다(운영 배포 전 반드시 실측 필요, 단 QA 도 `next dev` 만 쓰므로 `next build` 실측은 deployer 단계가 될 수 있음). ④ 화면 실렌더(360/390/412·스와이프 제스처·Gboard)는 B 가 전혀 실행하지 못했다(NOT_VERIFIED) — dev 서버 하이드레이션 가능한 환경에서 QA 가 처음 확인.
- `native_change`: **false**(웹만, APK 재빌드 불필요).

→ [[task-008-vocab-today-words]]

### REV-008 재검증 (2026-09-27) — 커밋 `10b770e`

**범위**: `git diff 54ec31f..10b770e -- src tests eslint.config.mjs`(3 files, +29/-11 — `sessions.ts`·`task008.test.ts`·`task008-smoke.ts` 뿐). `npm run typecheck`(0 error)·`npm run lint`(0 error, 기존 무관 경고 4 그대로)·`npm test`(146/146 PASS) 재실행.

**판정**: **PASS** (Critical 0 · High 0 · Medium 0 · Low 0)

- **H1 수정 확인**: `toCardDto` 의 `reveal` 이 `answered || status === 'DONE'` 로 좁혀짐(`sessions.ts:126`). 경로별 확인 — **#47/#53**(`insertSession`)은 `status` 인자를 항상 리터럴 `'IN_PROGRESS'` 로 넘겨 애초에 이 조건의 영향을 받지 않음(수정 전후 동일, 새 세트는 늘 진행 중으로 시작하므로 맞다) · **#49**(`getVocabSession`)은 실제 `s.status` 를 넘기므로 ABANDONED 에서 이제 `reveal=false`(미답 카드는 IN_PROGRESS 와 동일하게 숨김) · **#50 flag 전용**(`kind==='flag'` 분기)은 애초에 `toCardDto` 를 호출하지 않고 `{order,flagged}` 만 반환하므로 이번 버그와 무관(전후 동일) · **#51**(`finishResult`)도 `toCardDto` 를 쓰지 않고(세션 요약 + `wrongWords` 뿐), ABANDONED 의 `wrongWords` 는 `answer:'WRONG'` 조건 매치가 원천적으로 0건이라 안전. `grep -n "reveal\|!== 'IN_PROGRESS'" src/modules/learning/vocab/sessions.ts` 로 다른 사본 로직이 없음을 재확인.
- **DONE·FLIP 비회귀 확인**: `status==='DONE'` 조건은 명시적으로 유지되어 결과 화면(전 카드 정답)은 그대로 동작. FLIP 은 `mode==='FLIP'` 이 `reveal` 과 독립적으로 `card.meaning`/`example`/`exampleKo` 를 항상 채우는 라인이라(수정 대상 밖) ABANDONED+FLIP 에서도 F1 대로 뜻이 보이는지 새 테스트(`abandonedFlip`)로 확인, `correctText`/`answer` 는 여전히 미노출(둘을 구분하는 것이 맞음 — "뜻은 보여도 채점 여부는 아직 모른다"). 단위 테스트(`task008.test.ts:112-133`)와 라이브 스모크(6h′: GET 재조회로 5장 전부 `choiceCardHides` 통과, 6h″: ABANDONED `keep` → 409) 모두 이 경계를 코드로 재확인.
- **L1 수정 확인**: `keepVocabSession` 이 `withTransaction` + `lockUserRow` → `lockSession`(세트 행 `FOR UPDATE`, 소유자 조건 포함) 순서로 바뀜 — `replayVocabSession`·`finishVocabSession`·`createVocabSession`·`deleteWord`·`updateWord`·`addSeedPack` 이 전부 쓰는 "사용자 행 → 세트/대상 행" 순서와 일치해 새 교착 경로가 생기지 않음(세트 행을 사용자 행보다 먼저 잡는 함수가 없음을 재확인). `kept === !!s.keptAt` 단락으로 같은 상태 재요청은 추가 쓰기 없이 그대로 반환 — 8b(멱등 유지) 회귀 없음. 스모크 8e′(동시 해제/재보관 2건 → 둘 다 200, 이후 강제로 `kept:true` 재설정해 뒤 흐름과 격리)로 직렬화·무결성 확인.
- **회귀 없음**: 변경 파일이 이 3개뿐이라 6층 경계·IDOR·A10·seed-pack 등 나머지 항목은 REV-008 1차 결과가 그대로 유효.

**QA 인계 갱신**: 이전 `high_risk_areas` ①(H1 재검증)은 해소로 종료. ②~④(동시성 실경합·seed-pack build 포함 여부·화면 3폭 실렌더)는 그대로 유효. `native_change: false` 불변.

→ [[task-008-vocab-today-words]]

## QA 기록

## 최종 요약
