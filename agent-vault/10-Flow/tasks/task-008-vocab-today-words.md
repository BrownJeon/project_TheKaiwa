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
3. **정답 미노출**: #47·#49(IN_PROGRESS) 응답 어디에도 미답 카드의 정답 문자열·정답 위치 힌트 없음(보기 4개 중 정답 위치가 세트마다 분산 — 20세트 표본에서 한 자리 고정 아님).
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

## 판단 기록 (judge)
- [2026-09-27 14:34] intake engine=jev → task_type=feature / risk=R2 / developer_model=opus / next=ask_user | overrides=- | fallback=- | tokens=1156
  - (신호) complexity 2.92(conf 0.92) · needs_info 0.63 · risk high 0.69
  - **override**(Leader): `next=ask_user` 를 따르지 않는다 — needs_info 신호는 300자 요약의 압축 탓이며, 판단 대상 사항(세트 크기·모드·가중치·보기 구성·강등·멱등·finish 트랜잭션·보관/다시 풀기·통계·A10 draft·시드 팩)은 정본 design-spec §7-2·api-contract #40~#54·domain-model 시드 §3 에 모두 정해져 있어 사용자에게 물을 미결정이 없다. 정본에 없는 소규모 결정(시드 팩 엔드포인트 등)은 Leader 가 사양에 명시한다. risk=R2 채택(`StatsSnapshot` 트랜잭션·삭제 후 집계 불변 = leader.md R2 보강 기준과 일치).

## Codex 검토

## Designer 기록

## Prompt-Engineer 기록

## Developer 기록

## Reviewer 기록

## QA 기록

## 최종 요약
