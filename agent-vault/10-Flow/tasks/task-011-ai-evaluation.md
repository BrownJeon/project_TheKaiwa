---
task_id: task-011
title: "AI 평가 — A6 출제·코드/A7 채점·10분 제한·기록률 100% 트랜잭션·결과·이력"
status: doing
base_ref: 98d8cac
risk_level: R2
roles_involved: [leader, judge, designer, prompt-engineer, developer, reviewer, codex, qa, deployer]
related_tasks: [task-008-vocab-today-words, task-010-today-lesson, task-007-talk-voice-web]
tags:
  - type/task
  - domain/evaluation
  - domain/prompt
  - domain/ui
aliases:
  - AI 평가
  - task-011
created: 2026-09-28
updated: 2026-09-28
demo_gate:
  required: true
  level: "full"
  status: "review_requested"
  version: 1
  repo_path: "docs/demo/task-011-ai-evaluation-v1.html"
  artifact_url: "https://claude.ai/artifact/2b6HjEwsxQkioKHxx7oiiq"
  content_sha256: "dd8154faae46e50460fdfda198599834ab268602bddbe1c830038ca1ff2bc11d"
  decided_by: "judge"
  rule_id: "JV-ui_change"
  approved_by: ""
  approved_at: ""
  approval_quote: ""
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: false
---

## 목표 (Leader)
오늘 탭의 "AI 평가"를 연다. 내 단어장(≥60%)과 강사 생성 문항으로 **WORDS 10문항**(뜻 고르기 4·읽기 쓰기 2·용법 고르기 2·조각 분류 2) 또는 **TALK 6문항**(듣고 답하기 2·문장 조립 1·상황 응답 2·틀린 곳 찾기 1)을 10분 안에 풀고, 객관식은 코드가, 서술형은 강사(A7)가 루브릭 5차원(정확성·어휘·문법·자연스러움·조각 조립)으로 채점한다. 제출 결과는 **기록률 100%** — 한 트랜잭션(`Evaluation DONE + StudyLog(EVALUATION,DIRECT) + StatsSnapshot(EVALUATION) + DAILY`).

완료 기준(design-spec §7-5 · §15 011 · api-contract §2-14 #65~#69):
- #65 출제(A6 sonnet 60s 잡, 진행 중 평가 있으면 409, 재료 단어장 ≥60%·오답 우선, 최근 14일 출제 해시 중복 금지) · #66 상세(READY/IN_PROGRESS 에서 정답·점수·피드백 숨김) · #67 답 저장(객관식 즉시 코드 채점, 정답은 제출 후 공개, 재답 덮어쓰기) · #68 제출(A7 120s 잡, 미답 0점, 마지막 단일 트랜잭션, 실패 시 GRADING 잔류·다시 채점) · #69 이력
- 등급 ≥90 EXCELLENT / ≥75 GOOD / ≥60 FAIR / <60 NEEDS_WORK, `total = Σscore/Σmax×100`
- 같은 레벨 ≥90 2회 연속 → `TutorProposal(SET_LEVEL, PROPOSED)`(채택해야 `Profile.level` 변경)
- **첫 평가 20건 루브릭 조정 라운드**: PE 가 A7 채점 픽스처 20건(합성 답안, 점수 기대 범위)으로 채점 편차를 측정·조정해 결정 기록에 남김
- 10분 제한(초과 제출 허용·표시만), 타 사용자 404, 엔진명 0, 3폭 잘림 0

## 사용자 지시
- 2026-09-28: "사용자의 승인이나 명령어 실행이 필요하기 전까지 현재 페이즈2를 전체로 이어서 진행해줘". 스키마 변경 없음(`Evaluation`·`EvaluationItem`·`EvalItemKind` 8종·`InputSource` 이미 정본대로).

## 관련 과거 이력 요약
- [[task-008-vocab-today-words]]: 정답 미노출·서버 채점·finish 단일 트랜잭션·가중 샘플링(오답 우선)·삭제 후 집계 불변 패턴. `TodayComingSoon` 의 "AI 평가" 카드가 이 task 로 실제가 된다(task-010 이 오늘의 회화 카드를 이미 뺌).
- [[task-010-today-lesson]]: 잡+폴링 생성 화면·A4 신뢰도 교훈(결정적 보정·"서브셋 ⊆ 입력" 공통 규칙 — [[llm-japanese-quality]] §8), 레슨 오디오 서명 URL(#62c) 패턴 → LISTEN_RESPOND 오디오.
- [[task-007-talk-voice-web]]: 푸시투토크·발화 저장(#21, `utteranceId`)·STT 최종 텍스트.
- [[task-010b-repetition]]: `LearningObservation` 테이블(승인 후) — 평가 문항 관측(`VOCAB_RECOGNITION`·`VOCAB_PRODUCTION`·`LISTEN_RESPOND`·`SENTENCE_PRODUCTION`)은 010b 테이블이 생긴 뒤 연결(없으면 건너뜀, 이 task 는 훅만).

## Leader's Plan (2026-09-28)
- **L1 말하기 문항 텍스트**: 정본은 "분석 STT(whisper) 텍스트"지만 분석 STT 는 012b. 이 task 는 **실시간 STT 최종 텍스트(`Utterance.finalText`)** 로 채점하고 `inputSource=REALTIME_STT` 로 남긴다. 012b 가 분석 텍스트가 있으면 그것을 쓰도록 바꾼다(계약 유지).
- **L2 문항 생성·채점 분담**: A6 는 `items[{kind,prompt,expected,dims,chunkType?,wordSurface?}]` — 코드가 개수·종류 배분·재료 비율·14일 해시(`sha1(kind|정규화 prompt 핵심)`) 검사, 위반 시 1회 재시도, 단어장 재료는 **코드가 골라 A6 에 넘긴다**(≤15, 오답 우선 가중). 객관식 보기·정답은 A6 가 만들되 코드가 보기 4개·정답 포함·중복 없음을 검사. LISTEN_RESPOND 는 TTS 오디오(`textHidden`), 문장 조립(ASSEMBLE)은 조각 순서 코드 채점.
- **L3 A7 채점**: 서술형만(LISTEN_RESPOND·SITUATION_RESPOND·CORRECTION_SPOT 의 설명형), 문항 0~10 + 루브릭 5차원 0~5 + comment_ko + next_focus. 코드가 범위 클램프·누락 문항 0점 처리·총점 재계산(LLM total 신뢰 안 함).
- **L4 오늘 홈 AI 평가 카드**: 시작 전(WORDS/TALK·레벨·최근 결과 한 줄) / 진행 중(남은 시간·이어서) / 채점 중 / 결과 보기. 평가 화면 라우트 `/study/today/eval/[evaluationId]`(screens.md §라우트 표).
- **L5 SET_LEVEL 제안**: 채점 트랜잭션 뒤(같은 트랜잭션 X), 조건 충족 시 conversation/proposals 로 제안 생성(라우트/잡 조합), 결과 화면에 제안 카드.
- 화면(데모 full): 오늘 홈 카드 상태 전부, 평가 시작(종류·레벨), 출제 대기, 문항 8종 UI(객관식·입력·듣고 답하기(PTT)·조립·상황·틀린 곳), 10분 타이머(초과 표시), 제출 확인(미답 경고), 채점 대기·실패(다시 채점), 결과(총점·등급·5차원·문항별 피드백·정답 공개·next focus·SET_LEVEL 제안), 이력 목록, 빈/오류/TEXT_ONLY.
- 파일 경계: PE `conversation/prompts/{evalGen,evalGrade}.ts`·스키마·checks·보정·20건 루브릭 픽스처 / developer `learning/evaluation/**`·`api/v1/evaluations/**`·잡·`components/eval/**`·오늘 홈 카드(데모 승인 뒤). push 금지.

## 데모 검토 (demo gate)

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge: full (JV-ui_change) | 09-28 18:07 |
| v1 | 검토요청 | docs/demo/task-011-ai-evaluation-v1.html | https://claude.ai/artifact/2b6HjEwsxQkioKHxx7oiiq | 사용자 검토 요청 | 09-28 20:30 |

## 작업 기록

### 2026-09-28 19:40 Leader — judge intake
- `judge-result@2`(engine jev, needs_info=false): risk R2 · developer opus · demo **full(JV-ui_change)** · `next=demo_first` → `check.mjs init`. 데모는 Phase 2 나머지 task 와 **한 번에 사용자 검토 요청**(승인 요청 횟수 최소화), 스키마 push 승인도 같은 메시지로.

### 2026-09-28 20:15 prompt-engineer — A6·A7
**산출물**: `src/modules/conversation/structuredResponse/{evalSchemas,evalChecks}.ts`(신규, `schemas.ts`·`checks.ts` 는 건드리지 않음 — task-010b 가 동시에 A11 로 그 두 파일을 쓰고 있어서), `src/modules/conversation/prompts/{evalGen,evalGrade}.ts`(신규), `conversation/index.ts` export 추가만, `.claude/agents/tutor.md` §6 EVAL_GRADE 행 1줄 수정(아래), 테스트 `src/modules/conversation/__tests__/{evalGen,evalGrade}.test.ts`(+35건), 픽스처 `tests/prompts/fixtures/{evalGen,eval-grade-rubric}.json`, 실측 스크립트 `tests/live/{eval-gen-measure,eval-grade-rubric-measure}.ts`.

**확정 계약(문항 종류 8개 — developer·designer 가 그대로 쓴다, `evalSchemas.ts` 상단 주석에 표로도 있음)**

| kind | prompt | expected | 채점 |
|---|---|---|---|
| MEANING_CHOICE | `{surface, reading, choices[4]}` | `{answer 0~3}` | 코드 |
| READING_INPUT | `{surface}` | `{reading, accepted[1~5]}`(accepted 는 reading 포함 필수) | 코드 |
| USAGE_CHOICE | `{sentenceJa(빈칸="___"), choices[4]}` | `{answer 0~3}` | 코드 |
| CHUNK_CLASSIFY | `{textJa, reading\|null}` | `{chunkType}`(top-level 과 같은 값 — **v2, 아래 실측 참고: 빈 객체는 생략 사고 100% 재현으로 폐기**) | 코드 — 권위값은 top-level `chunkType`, 어긋나면 `repairEvalGenChunkTypeSync` 가 동기화 |
| LISTEN_RESPOND | `{textJa, instructionKo}` | `{expectedGistKo, modelAnswerJa, modelReading}` | A7 |
| ASSEMBLE | `{promptKo, pieces[3~7]}` | `{order[3~7]}`(pieces 와 같은 다중집합) | 코드 |
| SITUATION_RESPOND | `{situationKo}` | `{expectedGistKo, modelAnswerJa, modelReading}` | A7 |
| CORRECTION_SPOT | `{sentenceJa}` | `{wrongSpan(리터럴 부분 문자열), correctedJa, explanationKo}` | A7 |

공통 top-level: `kind·dims(1~3, accuracy·vocabulary·grammar·naturalness·assembly)·wordSurface(재료 링크, null 가능)·chunkType(CHUNK_CLASSIFY 만, 그 외 null)`. **중요(developer 인계)**: `EvaluationItem.prompt`/`.expected` 는 A6 원본을 **그대로** 저장한다 — `LISTEN_RESPOND.prompt.textJa` 를 `{audioUrl,textHidden:true}` 로 바꾸는 것은 `GET /evaluations/:id` 직렬화 단계일 뿐, DB 컬럼을 고치면 14일 중복 해시(`computeEvalItemHash`)를 다시 계산할 수 없다.

**후검증 규칙(스키마가 못 잡는 것, `evalChecks.ts`)**: ① kind 별 정확한 개수(WORDS 4·2·2·2, TALK 2·1·2·1 — ajv draft-07 이라 `minContains` 불가라 코드가 센다) ② READING_INPUT accepted⊇{reading} ③ USAGE_CHOICE 빈칸 표시 ④ ASSEMBLE pieces/order 다중집합 동일 ⑤ CORRECTION_SPOT wrongSpan 이 sentenceJa 의 리터럴 부분 문자열 ⑥ **재료 사용 ≥60%**(`wordSurface` 가 [재료] 후보에 있는 것만 카운트, 미달 시 위반→재시도) ⑦ **14일 중복**(`computeEvalItemHash = sha1(kind|정규화 핵심)`, `recentHashes` 는 developer 가 과거 `EvaluationItem` 을 같은 함수로 복원해 넘김 — 해시는 프롬프트에 노출하지 않는다, 모델이 읽고 피할 수 있는 정보가 아니라서) ⑧ 엔진명 누출. **결정적 보정** `repairEvalGenWordLinks` — MEANING_CHOICE/READING_INPUT/CHUNK_CLASSIFY 의 표기가 [재료]와 글자 그대로 같은데 `wordSurface` 를 안 채웠을 때만 채운다(LLM 재호출 없음, lesson@v2 repair.ts 와 같은 원칙). USAGE_CHOICE·서술형은 손대지 않는다(결정적으로 판별 불가).

A7: `checkEvalGradeResponse` 는 order⊆입력·중복 없음·엔진명만 본다(**개수 미달은 위반이 아니다** — Leader's Plan L3 "누락 문항 0점"). `finalizeEvalGradeItems` 가 `allowedOrders` 전부에 대해 정확히 1건씩(누락 0점, 점수 0~10 클램프, feedback 빈 값은 기본 문구)으로 마무리 — developer 는 이 함수 결과 + 객관식 코드 채점(#67) 을 합쳐 `total=Σscore/Σmax×100` 을 계산한다(**LLM `total` 은 스키마에 아예 없다** — additionalProperties:false 라 모델이 붙여도 버려짐, 그래서 tutor.md §6 EVAL_GRADE 행의 "total 0~100" 문구도 지웠다: 페르소나가 모델에게 "total 을 내라"고 잘못 가르치면 스키마 위반→불필요한 재시도가 생기기 때문). `clampRubric` 은 방어적 클램프(softExtraCheck 경로 대비).

A7 은 design-spec 표의 "서술형 문항·답" 입력을 **`objectiveSummary`(코드가 이미 채점한 객관식 kind 별 정답/전체) 로 확장**했다 — WORDS 평가는 서술형이 0개라 이게 없으면 루브릭 5차원 근거가 사라진다(#66 result 예시가 WORDS 에도 rubric 을 요구). 이 판단은 이번 task 범위 안에서 prompt-engineer 가 했고, Leader's Plan 과 충돌하지 않는다(입력을 넓힌 것이지 출력 계약을 바꾼 게 아님).

**예산**: `EVAL_GEN_USER_PROMPT_CAP=4,500`(재료 15개+주제 최악 조합 실측 통과), `EVAL_GRADE_USER_PROMPT_CAP=8,000`(서술형 5개(TALK 최대: LISTEN_RESPOND2+SITUATION_RESPOND2+CORRECTION_SPOT1, ASSEMBLE 은 코드 채점이라 제외)+답 2,000자→600자로 렌더 절단 최악 조합 실측 통과). 둘 다 A1(3,000)보다 크다 — 60s/120s 배치 잡이라 5초 예산이 아니다.

**단위 테스트**: 35건 전부 PASS(스키마 통과·8종 후검증 위반 케이스·재료 보정·해시 정규화·예산 회귀). 전체 회귀 655건(654 PASS·1 skip, 무관) — `npm run typecheck` 0 에러.

**⚠ 실측 BLOCKED(20:00 KST) → 재개·완료(20:22~20:36 KST)** — Claude CLI 세션 한도(429, 리셋 20:20 KST)로 1차 시도가 막혔다가 Leader 알림으로 재개했다. **전체 과정·표·수치는 `[[llm-japanese-quality]]` §9 에 있다** — 여기는 요약만:

- **A6**(`eval-gen-measure.ts`, WORDS×2·TALK×2): 1차 4건 중 2건 FAILED(CHUNK_CLASSIFY `expected` 빈 객체를 모델이 통째로 생략 100% 재현 + 14일 dedup 재시도가 "어떤 단어인지" 안 밝혀 같은 단어 재선택) → **`evalGen@v1`→`v2`**(CHUNK_CLASSIFY `expected:{chunkType}` 로 변경 + 결정적 보정 `repairEvalGenChunkTypeSync` 신설, dedup 위반 문구에 충돌 단어/문장 직접 인용) → 재측정 **4/4 성공**, 최종 위반 0, 재료비율 100%, ms 11,700~19,800, attempts 1~2.
- **A7 루브릭 20건**(`eval-grade-rubric-measure.ts`): 1차 JSON 계약 위반 0/20, 범위내 18/20(90%) — 한국어 답에 후한 점수(g05)·CORRECTION_SPOT 이 고친 문장 없이도 거의 만점(g18) 두 건 발견 → **`evalGrade@v1`→`v2`**(일본어 아니면 0~2점 / CORRECTION_SPOT 은 짚기+고치기 둘 다 있어야 완성, 고친 문장 없으면 0~5 로 명시) → 재측정 **범위내 19/20(95%)**, 남은 1건(g10)은 경계 1점 차(픽스처가 낙관적으로 잡은 것에 가까움, 5%는 QA 관찰 사항으로 남기고 추가 프롬프트 변경은 보류 — 20건 과적합 방지).
- 프롬프트 길이 실측(비최악): evalGen WORDS 1,953자·TALK 2,208자(캡 4,500) / evalGrade 1문항 2,060~2,300자(캡 8,000, 서비스 최대 5문항 최악 조합은 `evalGrade.test.ts` 로 커버).
- 회귀: `evalGen.test.ts` +2(CHUNK_CLASSIFY 계약 갱신 + 신규 동기화 보정 2건) → 37건. 전체 662건(661 PASS·1 skip) 무관.

**재발 가능한 함정**: ① 페르소나(tutor.md) §6 모드 표 문구가 실제 스키마와 어긋나면(이번 EVAL_GRADE 의 `total`처럼) 모델이 스키마에 없는 필드를 만들려다 `additionalProperties:false` 로 막혀 불필요한 재시도가 생긴다 — 스키마 바꿀 때 tutor.md §6 그 행도 같이 확인할 것. ② 14일 중복 회피처럼 "과거 데이터"가 필요한 검사는 **해시만** 넘기고 사람이 읽는 목록을 프롬프트에 넣지 않되, **위반 문구에는 충돌한 실제 값을 인용**한다(모델이 "무엇을 피해야 하는지" 구체적으로 알아야 재시도가 실제로 고쳐진다 — 추상적 "겹친다"만으로는 [재료] 의 "오답 우선" 지시를 못 이긴다). ③ **LLM 에게 "빈 객체를 채우라"고 요구하지 않는다** — 정답이 없어 보이는 필드는 생략하는 경향이 있다(CHUNK_CLASSIFY `expected:{}` 2/2 재현). 다른 곳에 이미 있는 값이라도 **자연스럽게 복제**해서 채우게 하고, 어긋날 가능성은 결정적 보정으로 흡수한다. ④ 채점 프롬프트가 엄격도(언어 자체가 틀렸을 때 감점 폭, "부분 답"의 완성 기준)를 구체적 예시 없이 두면 모델은 "의도 전달"만으로 후하게 채점한다.

**developer 인계**: `buildEvalGenRequest`/`buildEvalGradeRequest` 는 `LlmJsonRequest<T>` 를 그대로 반환하니 `llm.completeJson()` 에 넘기면 된다. A6 재료 선별(오답 우선 ≤15)·14일 해시 목록 복원(`computeEvalItemHash` 재사용)·A7 `objectiveSummary` 집계·`finalizeEvalGradeItems` 호출·총점 계산은 전부 route/job(learning/evaluation) 몫이다. `EVAL_GEN_MATERIAL_RATIO_MIN`(0.6)·`EVAL_GRADE_ANSWER_RENDER_MAX`(600) 등 상수는 `conversation` export 로 공개돼 있다. CHUNK_CLASSIFY 저장 시 `EvaluationItem.chunkType` 은 top-level `chunkType`(이미 `expected.chunkType` 과 동기화됨)을 그대로 쓰면 된다.

### 2026-09-28 20:38 prompt-engineer — A6·A7 실측 완료
Leader 알림으로 재개(한도 리셋). A6 4/4 성공·A7 루브릭 19/20(95%) — 상세는 위 절 갱신 + `[[llm-japanese-quality]]` §9. `evalGen@v2`·`evalGrade@v2` 로 버전 올림(둘 다 실측으로 발견한 결함을 고친 것이라 계약 버전을 올렸다). 추가 코드 변경은 `evalSchemas.ts`(CHUNK_CLASSIFY `expected` 모양)·`evalChecks.ts`(`repairEvalGenChunkTypeSync` 신설, dedup 위반 문구 개선)·`evalGen.ts`/`evalGrade.ts`(지시문 보강) 뿐 — 다른 PE 가 동시에 쓰는 `schemas.ts`·`checks.ts`·`tutor.md` 는 이번 라운드에서 추가로 건드리지 않았다. developer 는 최신 계약(위 표 CHUNK_CLASSIFY 행)으로 구현하면 된다.

### 2026-09-28 20:28 designer — 데모 v1
- [20:28] 파일 `docs/demo/task-011-ai-evaluation-v1.html`(meta `task-011-v1`) — `check.mjs lint --expect task-011-v1` **DEMO_LINT_PASSED**. 틀·디자인 언어는 승인된 [[task-010-today-lesson]] v2 그대로(실제 폭·높이 배치 후 같은 배율 축소, 360/390/412 · 780/892, 테마, `#상태id` 주소). 토큰 값은 v2 와 동일 — `globals.css` 작업 사본 해시가 `22f382529f92` 로 바뀐 건 미커밋 `@keyframes lesson-indet` 추가뿐(토큰 변화 없음), meta 는 현재 파일 해시로 적음.
- [20:28] 범위(상태 56개): 오늘 홈 현재 vs 제안(곧 열려요 → 실제 카드, 오늘의 회화 카드 바로 아래) + 카드 13상태 / 평가 시작(종류·레벨·주제·규칙, 단어 부족, 자막만) / 문제 만들기(대기·오래 걸림·실패) / 준비됨 / 문항 8종 전부 / 10분 타이머(1분 남음·시간 지남 +표시·그래도 제출) / 제출 확인(모두 답함·안 푼 2개 0점·실패·나가기) / 채점(대기·실패→다시 채점) / 결과(총점·등급·5차원 0~5 막대+숫자·문항별 내 답/정답·피드백·다음에 집중할 것·레벨 올리기 제안 채택/그대로/실패) / 평가 기록(목록·필터·더 보기·빈·로딩·오류) / 공통(로딩·오류·찾을 수 없음). 답해도 “저장했어요”만(정답 색은 결과에서만), 답함 표시는 진한 칸(초록 X).
- [20:28] **합성 데이터 모양 = prompt-engineer 확정 계약**(`evalSchemas.ts` 머리 표): READING_INPUT 은 `surface` 만(뜻 힌트 없음), USAGE_CHOICE 는 `___` 빈칸 문장+일본어 보기 4, CHUNK_CLASSIFY 정답 = `chunkType`(이름·액션·느낌·꾸밈 순), LISTEN/SITUATION 결과 = `modelAnswerJa`+`modelReading`+`expectedGistKo`(“이런 뜻이면 돼요”), ASSEMBLE `order` 문자열, 객관식은 해설 없음(내 답·정답만), A7 은 문항별 `score`+`feedback_ko` 만(차원 점수 없음 → 문항 `dims` 는 “이 문항이 재는 것” 이름만), WORDS 도 루브릭 5차원 전부 숫자.
- [20:28] 결정 필요 A/B 6건(권고): (a) 문항 이동 — **B 번호로 자유 이동** / (b) 자막만일 때 듣고 답하기 — **B 회화 평가 시작 막기**(도중 끊김은 그 문항만 [글자로 보기]·결과 표시) / (c) 등급 문구 — **B 레벨 기준형**(이 레벨은 충분해요·거의 다 왔어요·기본은 잡혔어요·이 레벨을 더 다져요) / (d) 10분 타이머 시작 — **B [시작하기] 누를 때**(준비 화면) / (e) 다시 듣기 — **B 2번까지** / (f) 틀린 곳 찾기 답하는 방식 — **A 조각을 눌러 고르기**.
- [20:28] **Leader 확인 요청(계약 공백)**: ① (d)=B 면 시작 시각 기록 요청 1개 필요(#67 은 “첫 답에서 IN_PROGRESS”) ② (f)=A 면 A6 CORRECTION_SPOT 에 `segments[]`(join = sentenceJa, wrongSpan ∈ segments) 추가 필요 — B 면 계약 그대로 ③ “글자로 봤어요”(듣기 문항 글자 공개) 표시 필드가 #66/#67 에 없음 ④ 이력 목록·시작 화면 라우트(`/study/today/eval`, `/study/today/eval/new` 제안)가 screens.md 표에 없음 ⑤ 출제 실패 시 평가 상태(다시 만들기 = 새 #65 인데 진행 중 409 와 충돌하지 않게 종료 상태 필요) ⑥ 단어 부족 기준(데모는 WORDS 6개 = 60%×10 으로 표시) ⑦ 레벨 제안 근거 문구(“9월 26일 92점 · 오늘 90점”)에 이전 평가 점수·날짜가 제안 payload 에 필요.
- [20:28] 검증: 헤드리스 Chrome 412×892 창에서 상태 56개 × 폭 360/390/412 × 높이 780/892 + 세 폭 + 결정 전부 A 로 재방문 — 페이지 가로 넘침 0 · 휴대폰 틀 안 넘침 0 · 11px 미만 글자 0 · JS 오류 0. 흐름 실측(시작 → 만들기 → 준비 → 답 채우기 → 제출 → 채점 → 83점 결과, 푸시투토크 저장, 타이머 0 통과 시 안내 표시, 조립 자동 저장, 틀린 곳 A/B 저장) 통과. 엔진명·모델명·작업 번호 0건, 외부 URL 0. v1 은 검토 전이라 이후 수정은 v2 새 파일로.

### 2026-09-28 21:13 developer — 서버
- [21:13] **범위**: 서버만(화면 파일 0 — 데모 v1 승인 대기). 스키마 변경·db push·commit 없음.
- [21:13] **산출물**: `src/modules/learning/evaluation/{validate,scoring,materials,rows,generate,answer,grade,read,index}.ts`(신규) · 라우트 `src/app/api/v1/evaluations/{route.ts, [id]/route.ts, [id]/start, [id]/submit, [id]/items/[itemId]/{answer,audio}}`(신규) · speech `utterances/evaluation.ts`(`linkUtteranceToEvaluationItem`)·`tts/evalAudio.ts`(`synthesizeEvaluationClips`) 신규 · Edit: `learning/index.ts`(export 1줄)·`learning/snapshots`(`createEvaluationSnapshot`)·`conversation/proposals`(SET_LEVEL 채택 + `createLevelProposal`·`findEvaluationLevelProposal`)·`conversation/index.ts`(export 2줄)·`preferences`(`setProfileLevel(tx)`)·`api/v1/proposals/[id]/accept`(SET_LEVEL 분기)·`speech/index.ts`·`speech/utterances/index.ts`·`speech/tts/index.ts`·`infra/jobs.ts`(EVAL_GEN·EVAL_GRADE stale 5분)·`infra/__tests__/task006.test.ts`(기본 10분 예시를 PLAN_ANALYSIS 로) · `docs/design/api-contract.md` §2-14 전면 갱신 + 표 #65~#69·#67a·#67b + #21 `evaluationItemId`·#38 SET_LEVEL 문구 · 테스트 `learning/__tests__/task011.test.ts`(13)·`speech/__tests__/task011.test.ts`(1) · 라이브 `tests/live/task011-smoke.{sh,ts}` + README 행.
- [21:13] **층 조합**: A6 요청은 라우트가 `buildEvalGenRequest` 로 만들어 **값**으로, A7 은 제출 시점 문항·답으로 잡 안에서 만들어야 해서 `build`·`finalize`·`onLevelUp` **함수**로 learning 에 넘김(§4-4 확장 — learning 은 conversation·speech import 0, eslint 경계 통과). 14일 해시는 learning 이 과거 문항을 A6 원본 모양으로 돌려주고 라우트가 `computeEvalItemHash`.
- [21:13] **구현 판단(Leader 확인 요청)**: ① #67 응답에 `score` 없음(`graded` 만, 데모 의미 우선 — 계약 수정) ② ASSEMBLE 답 = `pieceOrder`(조각 번호 순열, 같은 조각이 둘이어도 순서 확정 — `answerText` 대신, 계약 추가) ③ 저장 전 **보기 4개·조립 조각 순서를 코드가 섞음**(시드 = 평가 id|순번, 정답 번호 따라 옮김 — 모델의 앞쪽 정답 편중 제거, 14일 해시는 순서를 안 써 영향 없음) ④ #66 LISTEN_RESPOND 는 종전 `audioUrl` 대신 **#67a 오디오 라우트 신설**(레슨 #62c 패턴, LEARNING_NORMAL·문맥 EVAL) ⑤ 단어 부족 `need` = WORDS 6·**TALK 4**(60%×6 — TALK 도 재료 비율 후검증이 있어 모자라면 반드시 실패) ⑥ 출제 실패 FAILED 행은 다음 #65 가 **되살림**, #69 에서 제외 ⑦ **잡 DONE 은 레벨 제안 단계 뒤**(트랜잭션 안에서 잡을 끝내면 폴링이 제안 생성보다 먼저 DONE 을 봐 결과 화면 제안 카드가 빠질 수 있음 — 평가 DONE·기록·스냅샷·DAILY 는 여전히 단일 트랜잭션) ⑧ 미답 서술형은 A7 점수와 무관하게 0 ⑨ SET_LEVEL 조건 = 가장 최근 DONE 2건·같은 레벨·그 레벨 = 지금 Profile.level·둘 다 ≥90·위 단계 있음, 근거 평가가 이미 다른 SET_LEVEL 근거면 만들지 않음(거절 뒤엔 새로 두 번), payload `{level, fromLevel, source, evaluationId, basis[{evaluationId,kind,totalScore,date}×2]}` → #66 `result.levelProposal`(계약 공백 7) ⑩ `SET_LEVEL` 채택(#38) 개통 → `Profile.level`.
- [21:13] **보류(사용자 결정 대기 — 훅만)**: (d) `POST /evaluations/:id/start`(#67b) 구현·화면 미사용 주석 — 현 계약은 #67 첫 답에서 IN_PROGRESS·startedAt / (f) CORRECTION_SPOT 은 현 계약(sentenceJa → 서술형 A7) 그대로, `segments[]` 는 결정 후 PE.
- [21:13] **"글자로 봤어요"(계약 공백 3) — 미구현·제안**: 스키마 변경 없이 공개 여부를 남길 칸이 없다(`answerText`·`inputSource` 는 답의 속성, `prompt`·`expected`·`dims` 는 쓰지 않기로). 제안: `POST …/items/:itemId/reveal → {textJa}` + `EvaluationItem.textRevealedAt DateTime?`(다음 db push 묶음) → 결과 `items[].textRevealed`.
- [21:13] **domain-model·module-dependency 와 다른 점(Leader 반영 요청)**: §5-4 `LearnerErrorStat 증가`는 A7 이 오류 유형을 내지 않아 미구현 · `GRADING → FAILED(maxAttempts)` 없음(실패는 GRADING 잔류 + `error`, 다시 제출) · L3 evaluation 공개 API 이름(`answerEvaluationItem` → `lockEvaluationItemForAnswer`+`saveEvaluationAnswer`, `listEvaluations`·`startEvaluation`·`getEvaluationListenSource` 추가).
- [21:13] **검증**: tsc 0 · eslint 0(변경 경로) · 단위 전체 687(686 PASS·1 skip) — 신규 14건(본문 검증·답 정리·객관식 채점(가타카나·중복 조각)·총점·등급 경계·섞기 불변식·SET_LEVEL 조건·재료 가중·A6→행·채점 마무리·정답 숨김 DTO·상태 409·발화 연결 조건) · 라이브 `task011-smoke.sh 3015` **1회차 55/60**(스모크의 #21 업로드 키를 임의 값으로 넣은 스모크 버그 — 수정) → **2회차 60/60**. 지표(2회차): A6 WORDS 13.1s(attempts 1)·TALK 21.5s(1) / A7 WORDS 23.4s(LLM 6.0s)·TALK 20.4s(LLM 8.1s) / 답 저장 p50 1.5s(1회차 0.7s) / 듣기 소리 1.1s. TALK 1회차는 A6 attempts 2(27s). 트랜잭션 롤백(스냅샷 선점) → GRADING 잔류·StudyLog 0·DAILY 불변 → 다시 채점 새 잡 → 행 1:1, `count(DONE)==count(EVALUATION 스냅샷)`, 엔진명 누출 0.
- [21:13] **관찰(QA 참고)**: A7 잡 총시간 중 LLM 밖 시간이 10~17s(2회차) — NAS MariaDB 쓰기 지연으로 보임(1회차는 3s). 답 저장 p50 도 0.7→1.5s 로 흔들림. 120s 예산 안이지만 NAS fsync 완화 뒤 재측정 권장.
- [21:13] **트러블슈팅(재발 가능)**: ① 미러 dev 는 다른 에이전트의 sync-local 로 재시작돼 백그라운드 잡이 죽는다 → task-010 과 같이 **복제본** `~/.node-local/thekaiwa-t011`(node_modules 만 `--link-dest` 하드링크, 나머지 실제 복사 — 새 디렉터리라 삭제 명령 불필요)에서 `next dev -H 127.0.0.1 -p 3015`. ② 복제 순간 다른 에이전트가 `schemas.ts`·`repair.ts` 를 고치는 중이면 Turbopack 이 instrumentation 컴파일 오류를 캐시해 **dev 재시작이 필요**(소스 재복사만으로는 안 풀림). ③ `nohup … &` 의 `$!` 는 래퍼 pid 라 kill 해도 next-server 가 포트를 쥔다 — `ss -ltnp` 로 실제 pid 확인. ④ 스모크 #21 업로드는 `EngineConnection(REALTIME_STT).id` 를 키로 써야 한다(임의 문자열은 400 CONNECTION_INVALID). ⑤ 1회차 단어 정리 누락(#41 응답이 `{word:{id}}`) → 분류 표식으로도 지우게 수정, 남은 QA 단어 8개 삭제 확인. dev 서버 종료 확인(3015 닫힘). 복제본 디렉터리는 남겨 둠(지워도 무방).

### 2026-09-28 21:50 Leader — developer 서버 판정
- 승인(8건): #67 응답에 score 없음(`graded`만, 데모 의미) · 조립 답 `pieceOrder` · 보기·조각 순서 코드 셔플(해시 무관) · 듣기 오디오 #67a(레슨 #62c 방식) · 최소 재료 WORDS 6·TALK 4 · 출제 실패 행 되살리기(#69 비노출) · 채점 잡 완료 표시는 SET_LEVEL 제안 뒤(평가 DONE·StudyLog·스냅샷·DAILY 는 한 트랜잭션 유지) · SET_LEVEL 채택 시 `Profile.level` 변경, payload 에 근거 평가 2건.
- 보류: (d) `POST …/start`(#67b) 훅만 — 사용자 결정 후 화면 연결 · (f) segments — 결정 후 PE.
- **스키마 추가 요청(사용자 승인 묶음에 포함)**: `EvaluationItem.textRevealedAt DateTime?` + `POST …/items/:itemId/reveal` — "글자로 봤어요" 기록. 승인 전에는 미구현.
- 정본 정리(Leader, 011 마무리 때): module-dependency L3 evaluation 공개 함수 이름·`GRADING→FAILED` 전이 없음(실패 시 GRADING+error)·A7 이 오류 유형을 내지 않아 `LearnerErrorStat` 증가 없음.
- 관찰: 2회차 A7 잡의 LLM 외 시간 10~17s·답 저장 p50 1.5s — NAS DB 쓰기 지연 추정(사용자 별도 세션 fsync 완화 대기).

### 2026-09-28 21:56 developer — 후속 2건(세대 펜싱·task006 8e)
- [21:56] **1. 평가 잡 세대 펜싱**(task-010 Codex C2-1 과 같은 패턴): 신규 `learning/evaluation/fencing.ts`(`EvaluationJobSuperseded`·`assertCurrentEvalJob` = 사용자 행 잠금 + `jobs.isCurrentJob`). **출제**(`generate.ts`): `saveGeneratedEvaluation`(세대 확인 → READY → 문항 → `completeJob` false 면 Superseded 로 되돌림)·`failGeneratedEvaluation`(세대 확인 → FAILED → `failJob(tx)`), 러너는 Superseded 면 결과·실패 기록을 버리고 로그만. **채점(EVAL_GRADE) 재채점 경로에도 같은 위험 있음 → 같이 수정**: 옛 잡 A 가 stale 로 닫힌 뒤 "다시 채점" 잡 B 가 돌 때 A 의 늦은 성공이 B 대신 DONE·StudyLog·스냅샷을 쓰거나(평가는 아직 GRADING 이라 막히지 않았음), A 의 늦은 실패가 B 가 도는 평가에 `error` 를 남겨 화면이 "다시 채점" 을 띄울 수 있었다. `grade.ts`: `saveGradedEvaluation`(세대 확인 → 평가 잠금·GRADING → 기록 트랜잭션 → 끝에서 `jobs.markJobStage(95,'SAVED',tx)` false 면 Superseded 로 되돌림 — 채점 잡 DONE 은 레벨 제안 뒤라 `completeJob` 대신 이 확인을 트랜잭션 안에 둠)·`failGradedEvaluation`(세대 확인 → error → `failJob(tx)`), 트랜잭션 뒤 `completeJob` false 면 로그만(평가는 이미 DONE, 화면은 #66 status). infra `jobs.markJobStage(id, progress, stage, tx): boolean` 신설(Edit). api-contract #68 에 펜싱 한 줄.
- [21:56] **2. task006 스모크 8e**: SET_LEVEL 채택 → 200 `result.level`·`Profile.level` 변경 기대로 바꿈(목표 = 지금 N4 면 N3, 아니면 N4) + 8f 레벨 값 이상(N9) → 400·제안 PROPOSED·레벨 그대로. 채택 전 레벨을 적어 두고 `cleanup()` 에서 되돌림. README 행 갱신.
- [21:56] **검증**: tsc 0 · eslint 0 · 단위 전체 703(702 PASS·1 skip) — 신규 `learning/__tests__/evaluationFencing.test.ts` 7건(출제: 되살린 뒤 옛 잡 늦은 성공 버림·문항 0 → 새 잡 저장 / 늦은 실패가 새 세대 FAILED 안 만듦 / 세대 역전 / 현재 세대 정상 / 잠금 밖 stale → 되돌림 · 채점: 다시 채점 뒤 옛 잡 늦은 성공이 DONE·StudyLog·스냅샷 안 씀 → 새 잡 저장·SAVED / 늦은 실패가 error 안 남김·현재 세대 실패는 GRADING+error+잡 FAILED / 저장 끝 stale → 되돌림·GRADING 아니면 409). 라이브(포트 3015, 복제본): **task011 60/60**(3회차는 TALK A6 가 두 번 모두 `modelReading` 가타카나로 스키마 위반 → 39/42, 스모크에 출제 실패 시 TALK 단계 건너뛰기 가드 추가 후 4회차 60/60 — 다시 채점 8a~8g 포함) · **task006 42/42**(8e N5→N4 채택, 8f 400, 끝에 N5 복원 확인). QA 잔여 0(평가·SET_LEVEL 제안·평가 잡·스모크 단어 0, 두 계정 레벨 N5). dev 서버 종료·복제본 삭제 완료.
- [21:56] **위험(PE·Leader 확인)**: A6 TALK `LISTEN_RESPOND/SITUATION_RESPOND.expected.modelReading` 이 `KANA_READING_PATTERN`(히라가나만)이라 외래어가 든 모범 답(コーヒー 등)을 모델이 가타카나로 쓰면 스키마 위반 — 이번 4회 중 TALK 출제 attempts 2 가 3회, 1회는 재시도·다시 만들기 둘 다 실패. task-010 A4 의 `LESSON_READING_PATTERN`(히라가나+가타카나)과 같은 조치가 `evalSchemas.ts` 에 필요해 보임(PE 영역 — 손대지 않음).

### 2026-09-28 22:05 prompt-engineer — evalGen@v3(modelReading 가타카나 허용)
Leader 지시로 developer 위험 보고 해결. `evalSchemas.ts` 에 평가 전용 상수 `EVAL_SENTENCE_READING_PATTERN`(히라가나+가타카나, `LESSON_READING_PATTERN` 과 같은 문자 범위) 신설 → `LISTEN_RESPOND`·`SITUATION_RESPOND` 의 `expected.modelReading` 에만 적용. `KANA_READING_PATTERN`(schemas.ts, 다른 PE 의 A11/talk@v3 가 같이 씀)은 **안 바꿈**. `READING_INPUT.expected.reading/accepted`(단어 하나의 읽기 문항)는 히라가나만 **유지**(A10 규칙·"읽기 능력 평가" 목적과 일치, 판단 근거는 상수 옆 주석 + `[[llm-japanese-quality]]` §10 에 기록) — 대신 지시문에 "surface 가 가타카나 외래어여도 reading 은 항상 히라가나로" 문구 보강.

**실측**(`tests/live/eval-gen-katakana-measure.ts`, TALK 4회+WORDS 1회 독립 호출): **TALK 4/4 성공**(목표 달성), WORDS 1/1 성공, reading 패턴 위반 0/5(TALK#1 재시도 1건은 JSON 파싱 실패로 패턴과 무관). ms 10,000~29,300(재시도 없으면 ~11,000~12,700), attempts 1(4건)·2(1건).

**변경 파일**: `evalSchemas.ts`(`EVAL_SENTENCE_READING_PATTERN` 신설 + LISTEN_RESPOND/SITUATION_RESPOND modelReading 적용 + 계약 표 갱신)·`evalGen.ts`(지시문 보강, `EVAL_GEN_PROMPT_VERSION` → `evalGen@v3`)·`index.ts`(export 1개 추가)·`evalGen.test.ts`(+3, 가타카나 허용/한자·로마자·한글 금지/READING_INPUT 히라가나 유지)·신규 `tests/live/eval-gen-katakana-measure.ts`. `checks.ts`·`schemas.ts`·`tutor.md`·`reviewSchemas.ts` 등 다른 PE 파일은 건드리지 않음. 회귀 706건(705 PASS·1 skip)·tsc 0·eslint 0. 상세 원인 분석·판단 근거·실측 표는 `[[llm-japanese-quality]]` §10.

**developer 확인 사항**: 계약(prompt/expected 모양)은 안 바뀌었다 — `modelReading` 필드에 담기는 **문자 종류**만 넓어졌다(저장·직렬화 로직 변경 불필요). 재배포 없이 다음 A6 TALK 호출부터 바로 적용된다.

### 2026-09-28 22:28 reviewer — REV-031

**판정: PASS** (Critical 0 · High 0 · Medium 0 · Low 1 — 아래). 범위: `learning/evaluation/**`(validate·materials·rows·generate·answer·grade·scoring·fencing·read·index)·`api/v1/evaluations/**`·`speech/utterances/evaluation.ts`·`speech/tts/evalAudio.ts`·`conversation/proposals`(SET_LEVEL)·`api/v1/proposals/[id]/accept`·`preferences.setProfileLevel`·`infra/jobs.ts`(`markJobStage`)·`conversation/prompts/{evalGen,evalGrade}.ts`·`structuredResponse/{evalSchemas,evalChecks}.ts`.

- **#66/#67 정답 비노출**: `rows.ts toItemDto`/`toEvaluationDto` — `reveal = row.status==='DONE'` 아니면 `expected`·`score`·`correct`·`feedback`·`dims` 전부 `null`, `LISTEN_RESPOND` 는 `publicPrompt` 가 `textJa` 자체를 빼고 `textHidden:true` 만 준다. `answer.ts saveEvaluationAnswer` 의 `EvaluationAnswerResult` 에도 `score`·`expected` 필드 자체가 없다(`expectedShown:false` 만). `listEvaluations` 도 `status!=='DONE'` 이면 `totalScore`/`grade` null. 코드로 직접 확인 — 문서·구현 일치.
- **기록률 100% 단일 트랜잭션**: `grade.ts saveGradedEvaluation` — 세대 확인(`assertCurrentEvalJob`, 사용자 행 잠금) → 평가 잠금(`lockEvaluation`, GRADING 확인) → 문항 점수·피드백 갱신 → `recordStudyLog(EVALUATION,DIRECT)` → `Evaluation DONE`(`studyLogId` 연결) → `createEvaluationSnapshot` → `bumpDailySnapshot(evals:1)` → 끝에서 `jobs.markJobStage(...,tx)` 확인(실패하면 `EvaluationJobSuperseded` 로 트랜잭션 전체 롤백) — 요구된 5개 산출물이 정확히 한 트랜잭션 안에 있다.
- **재채점 idempotent·세대 펜싱**: `claimGrading` — `GRADING` + 살아 있는 채점 잡이면 `reused:true` 로 같은 잡을 돌려주고 새 잡을 만들지 않음(멱등) · `GRADING` + 잡 없음(이전 실패)이면 새 잡("다시 채점"). `fencing.ts assertCurrentEvalJob`(`jobs.isCurrentJob` — 자기 잡이 QUEUED/RUNNING 이고 같은 대상에 더 새 잡이 없음)이 출제·채점 저장·실패 기록 전부를 감싸 옛 잡의 늦은 성공/실패가 새 세대를 덮어쓰지 못하게 함. `saveGradedEvaluation` 끝의 `markJobStage` 재확인까지 — task-010 Codex C2-1 과 동일한 결함을 선제적으로 막은 설계, 신규 회귀 테스트 `evaluationFencing.test.ts` 7건으로 커버.
- **SET_LEVEL 채택 무결성**: 사용자가 `SET_LEVEL` 제안을 직접 만들 수 있는 라우트는 없음(`createLevelProposal` 은 `submit/route.ts` 의 `onLevelUp` 콜백에서만 채점 트랜잭션 **뒤** 서버가 호출). `acceptProposal`(`proposals/index.ts`)은 `payload.level` 을 `JLPT_LEVELS` 화이트리스트로 재검증하고 `OVERRIDE_KEYS.SET_LEVEL=[]` 라 `payloadOverride` 로 레벨을 바꿔치기할 수 없다. `preferences.setProfileLevel` 은 채택 트랜잭션 안에서만 호출. 레벨 조작 경로 없음 확인.
- **발화 소유·용도 배타**: `linkUtteranceToEvaluationItem` — `where:{id,userId}` 로 소유 확인(404) 후 `evaluationUtteranceProblem` 이 채팅·레슨·다른 문항 사용·10분 만료를 전부 409 로 막고, 연결은 `updateMany({where:{...evaluationItemId:null, lessonId:null, chatId:null, chatMessageId:null}})` 조건부라 경합에서 지면 409(원자적 claim). `assertAnswerTakesUtterance` 가 객관식에 `utteranceId` 붙이는 것도 막음.
- **14일 해시**: `evalChecks.ts computeEvalItemHash` 가 sha1 해시만 만들고 프롬프트에는 해시조차 안 싣는다(재시도 위반 문구에만 원문 일부 인용) — 정본(§9 실측 기록)과 일치. `renderTopic`/`renderMaterials`(evalGen.ts) 가 topic 제목·재료를 각각 60/40/40자로 clip 해 토픽 제목 길이에 의한 예산 폭주 가능성 없음(확인차 검토, 실제 위험 아님).
- **A7 총점**: `finalizeEvalGradeItems`(코드가 문항별 0~10 클램프+누락 0점) + `gradeObjective`(객관식 코드 채점) → `computeTotal`(Σscore/Σmax×100) — LLM 이 낸 `total` 은 `EvalGradeResponse` 스키마 자체에 없어 애초에 못 들어옴(`tutor.md` §6 EVAL_GRADE 행도 "total" 문구 제거 확인). 코드 계산 원칙 그대로 구현됨.
- **`markJobStage`/`completeJob`/`failJob` 시그니처 변경**(`infra/jobs.ts`) — `completeJob`/`markJobStage` 가 `boolean` 반환으로 바뀌었지만 기존 호출부(void 로 쓰던 곳)는 하위 호환(반환값 무시 가능), `tsc`·`eslint`·전체 테스트로 회귀 없음 확인. `STALE_AFTER_MS` 에 `LESSON_GEN`(task-010 job kind) 항목이 같이 추가된 것도 확인했다 — 10분 기본값보다 짧은 5분(LLM 120s 예산 대비 2.5배 여유)로 더 보수적으로 조인 것이라 task-010 쪽 회귀 아님(전체 706건 포함 task-010 테스트도 pass).
- (LOW) `evalGen`/`evalGrade` 의 프롬프트 상한(`EVAL_GEN_USER_PROMPT_CAP=4,500`·`EVAL_GRADE_USER_PROMPT_CAP=8,000`)은 talk.ts 처럼 런타임에서 동적으로 자르는 방어 코드가 없고 회귀 테스트로만 보증된다 — 배치 잡(60s/120s)이라 입력이 이미 유한(재료 ≤15·서술형 ≤5·답 600자 clip)해 실사용 위험은 낮지만, 향후 재료 상한이 커지면 같은 함정(talk@v2 의 `WINDOW_ROOM_SLACK` 과소추정)이 재발할 수 있다 — 참고만, 이번 릴리스를 막을 사유 아님.
- 실행 검증: `tsc` 0 · `eslint` 0 errors · 단위 706건 705 pass/1 skip/0 fail(`task011.test.ts` 13·`evaluationFencing.test.ts` 7·`evalGen.test.ts`/`evalGrade.test.ts` 포함) · `next build` 클린 성공(`/api/v1/evaluations` 전 6 라우트 생성 확인).
- **릴리스 동반 가능**: 예.


### 2026-09-28 23:05 Leader — 운영 반영(서버)·정본 정리
- 서버·A6/A7 은 통합 릴리스 `67771a5` 로 운영 반영, 운영 스모크 `SMOKE_ENV=PRODUCTION bash tests/live/task011-smoke.sh 3010` **61/61 PASS**. 화면은 데모 v1 사용자 승인 대기.
- 정본 정리(21:13 요청분): `module-dependency.md` L3 evaluation 공개 API 를 실제 export 로(`startEvaluation`·`lockEvaluationItemForAnswer`+`saveEvaluationAnswer`·`getEvaluationListenSource`·`listEvaluations`) · `domain-model.md` §5-4 — `GRADING → FAILED` 행 삭제(실패는 GRADING 잔류 + error, 재제출로 복구) · DONE 전이에서 `LearnerErrorStat` 증가 삭제(A7 errorType 없음, 도입 시 A7 계약 선행).
