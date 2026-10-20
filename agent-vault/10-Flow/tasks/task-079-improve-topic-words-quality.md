---
task_id: task-079
title: "AI 새 단어(A12) 품질 정리 — 어색한 보조 뜻(IMP-0055)·예문 null 기록(IMP-0056)·가타카나 읽기 정규화(IMP-0057)·간체자 차단(IMP-0058)"
status: doing
waiting: "deploy_approval"
base_ref: 725007c
risk_level: "R1"
roles_involved: [leader, judge, prompt-engineer, developer, reviewer]
related_tasks: [task-078-improve-topic-words-level-yield, task-076-improve-challenge-level-generation, task-049-topic-word-examples, task-042-topic-words-b2]
tags:
  - type/task
  - domain/learning
  - domain/prompt
  - domain/improvement
aliases:
  - A12 품질 정리
  - task-079
created: 2026-10-20
updated: 2026-10-20
demo_gate:
  required: false
  level: "none"
  status: "not_required"
  version: 0
  repo_path: ""
  artifact_url: ""
  content_sha256: ""
  decided_by: "judge"
  rule_id: "DM-light-waive"
  approved_by: ""
  approved_at: ""
  approval_quote: ""
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: false
---

# task-079 — AI 새 단어(A12) 품질 정리 (IMP-0055·0056·0057·0058)

## 사용자 요청 (원문)

> 1번작업 먼저 진행 후에 2번작업은 데모화면 만드는 작업부터 진행하자 (2026-10-20, «다음 작업 후보» 중 1번 = A12 새 단어 품질 정리)

보조 결정(AskUserQuestion 2026-10-20): IMP-0055(어색하거나 틀린 보조 뜻) = **「프롬프트 개선 + 측정 (Recommended)」** — 보조 뜻은 정확할 때만 쓰게 프롬프트를 고치고(`topicWords@v4`) 라이브 호출로 재측정한다(호출 예산 **하드 상한 40회**). 나머지 셋(예문 기록·읽기 정규화·간체자 차단)은 LLM 호출 없이 진행.

## 빈도 측정 (Leader 2026-10-20, 읽기 전용 SELECT — 쓰기·라이브 호출 0)

표본이 작다: 저장된 AI 새 단어 57개(`VocabAttempt.refType='AiWord'`, 2일치), A12 트레이스 10회. 사용자 대화·개인정보 없음(AI 가 만든 단어만).

| IMP | 측정 | 판단 |
|---|---|---|
| 0056 예문 없음 | **0/57** | 재현 안 됨. 지금은 `exampleNulled` 통계가 트레이스에 안 남는다 → 기록만 추가(측정 수단) |
| 0057 읽기 가나 혼용 | 가타카나 표기 11개 중 **3개가 히라가나 읽기**(27%). 기본 사전 SEED 는 가타카나 표기 528/528 이 가타카나 읽기 | 재현됨 → 사전 규칙에 맞춰 서버 정규화(LLM 불필요) |
| 0058 간체자 | 0건(Leader 후보 목록이 5건을 잡았으나 전부 일본어 한자 — 記念品·体験·点滴·商品·品質 — 오탐). 트레이스 10회에 NOT_VALID·SURFACE_CHARS 0 | 증거는 PE 때 본 1건(`怎样ですか`)뿐. 검사 ② 에 간체자 전용 문자 차단만 추가(프롬프트 불변) |
| 0055 어색한 뜻 | **7/57 ≈ 12%** — 쉼표 뒤 보조 뜻이 어색하거나 틀림: 領収書→영수서 · 受付→수접 · 試着室→시착실 · 宿泊→묵음 · 移動→**이사** · 在庫→**품절** · 点滴→점액주사. 첫 뜻은 거의 맞음 | 가장 심각(틀린 뜻을 가르침) → 프롬프트 v4 + 측정. 한국어 판정은 Leader 눈이라 사용자 확인 필요 |
| 트레이스 | 10회: 받은 124·남긴 87, 버린 이유 `JLPT_WINDOW` 36·`READING_MISMATCH` 1 | `RequestTrace` steps 의 A12 단계에 `dropped` 가 이미 있다(`topicSet.ts:544`). `exampleNulled` 만 없음 |

## judge 접수 (2026-10-20)

- 입력 요약(약 190자). 결과 `judge-result@2`(스크래치 `judge-079-intake.result.json`): **local_fix · light · R1 · 복잡도 1.56 · developer=sonnet · roles developer+reviewer · demo none**.
- **Leader 조정(기록)**: 범위에 **프롬프트 변경(IMP-0055)** 이 있어 judge 가 모르는 prompt-engineer 단계를 추가한다. light 트랙(QA 면제)은 유지하되, 프롬프트 변경은 task-078 의 «경계 합격(N2 평균 8.1)» 을 깰 수 있으므로 **회귀 가드를 측정 합격선에 넣는다**(아래). 화면·DB·API 계약 변경 없음 → 데모 게이트 면제.

## 관련 과거 이력 요약

- [[task-078-improve-topic-words-level-yield]]: `topicWords@v3` — N2 새 단어 통과 평균 8.10/10(합격선 8.0, **경계 합격**, 신뢰구간 약 6.2~10.0). 프롬프트를 또 바꾸면 이 수준을 깰 수 있다 → v4 는 N2 가드 필수. 하네스 `tests/prompts/topic-words-level-live.ts`(`main()` 가드 있음, import 부작용 라이브 호출 사고 이력 — 2회 초과 소모).
- [[task-049-topic-word-examples]]: v2 예문 계약·`checkTopicExample`·`exampleNulled` 통계(단어는 버리지 않음).
- IMP-0055~0058 원문: `agent-vault/10-Flow/improvements/items/` (task-076 QA·task-078 PE 부수 관찰, 접수만 해 둔 상태였음).
- 승인된 교훈(`/이슈기록 관련`): 없음.

## 구현 계획 (두 갈래, 병행)

### 갈래 A — developer (sonnet, 미러 `dev079`): 코드 3건, LLM 호출 0
파일: `src/modules/conversation/prompts/topicWords.ts` 의 **검사·조립 코드만**(SYSTEM_PROMPT·버전 상수·지시문은 건드리지 않는다 — 갈래 B 소유), `src/modules/learning/vocab/topicSet.ts`(트레이스 단계), **새** 시험 파일(`topicWords.test.ts` 는 건드리지 않는다 — 갈래 B 소유).
1. **트레이스 기록(IMP-0056)**: A12 단계에 예문 null 통계를 `dropped` 와 같은 형식의 고정 코드 문자열(예: `exampleNulled`: 개수 + `EXAMPLE_JA_LEN=1,…` 120자 이내)로 추가. 단어·예문 원문·사용자 데이터 기록 금지(코드와 숫자만).
2. **가타카나 읽기 정규화(IMP-0057)**: 표기(`textJa`)가 전부 가타카나(+`ー`·`・`)인 항목은 `reading` 을 가타카나로 정규화(기본 사전 SEED 규칙 528/528 과 일치). 히라가나·한자 섞인 표기는 불변. 읽기 검사(`readingMatchesSurface`)·중복 키·후속 소비처(`recheckTopicWords`·한글 읽기 변환·TTS 입력)를 확인해 깨지지 않게 하고 시험으로 못박는다.
3. **간체자 차단(IMP-0058)**: 검사 ② 확장 — 중국 간체 **전용** 문자(일본어 한자·신자체·구자체에 없는 것)가 `textJa` 에 있으면 새 고정 사유 코드(예: `SURFACE_SIMPLIFIED`)로 버린다(`droppedByReason`·`dropped` 문자열에 그대로 나옴). **오탐 금지**가 핵심: 차단 목록은 큐레이션하되 시험으로 ① `prisma/seed-data`·시드 빌드의 JLPT 시드 표기 전부(7,755개)가 통과 ② 흔한 일본어 한자(예: 記念品·体験·点滴·商品·品質·点·体·品)가 통과 ③ 대표 간체자 포함 표기(怎样ですか 등)가 차단 — 를 못박는다. 예문(`checkTopicExample`)에도 같은 문자 검사를 넣을지는 developer 가 판단해 근거와 함께 보고(넣으면 예문만 null, 단어는 유지).
- 산출 기록: `agent-vault/10-Flow/tasks/task-079-dev-record.md`.

### 갈래 B — prompt-engineer (sonnet, 미러 `pe079`): IMP-0055 프롬프트 v4 + 측정
- 대상: `topicWords.ts` 의 `meaningKo` 지시(`:236` 근처 «한국어 뜻을 짧게»)·관련 시험 `topicWords.test.ts`. **측정은 PE 미러에서 하고, 합격하면 마지막에 NFS 에 `Edit` 로 자기 블록(SYSTEM_PROMPT 지시 줄·`TOPIC_WORDS_PROMPT_VERSION`·`topicWords.test.ts`)만 적용**한다(developer 가 같은 파일의 검사 코드를 고치는 중 — 겹치는 줄 편집 금지, 편집 직전에 다시 읽기).
- 목표: 보조 뜻(쉼표 뒤)은 «가장 흔한 한국어 낱말이고 첫 뜻과 다른 뜻일 때만», 한자음 뒤집기·다른 낱말로 바꿔치기(受付→수접, 在庫→품절, 移動→이사) 금지. 보조 뜻의 가치(定食→정식, 한 끼 식사)는 유지.
- **라이브 호출 하드 상한 40회** — 하네스가 호출 수를 세어 상한에서 중단(import 부작용 호출 금지, 이전 task 에서 2회 초과 사고). 설계(**실행 전 고정**): ① v3 기준 arm 10회 + v4 arm 10회 — **같은 입력**(주제·수준·제외 목록) 교차 실행 ② **N2 가드** 10회 — 주제 N4 `weekend-plan` + 챌린지 N2, v4 로(v3 기준값 = task-078 측정 평균 8.10) ③ 예비 10회(재실행용, 쓰지 않으면 쓰지 않는다).
- 판정은 **눈가림**: PE 가 arm 이름을 숨기고 섞은 표(`blind-words.md`: id·표기·뜻)와 열쇠(`key.json`)를 분리해 만들면, Leader 가 열쇠를 보기 전에 각 뜻을 «맞음/어색/틀림» 으로 판정한다. 판정 대상은 뜻이 2개 이상인 단어의 **모든 뜻**.
- **합격선(고정)**: (a) v4 의 «어색+틀림» 비율 ≤ v3 arm 비율의 절반이고 절대 6% 이하 (b) N2 가드 평균 ≥ **7.6**(8.10 − 0.5) (c) 검사 통과율(남김/받음)이 v3 arm 보다 5%p 넘게 낮지 않음 (d) 출력 길이·지연이 v3 대비 +15% 이내. 하나라도 못 넘으면 **NFS 에 적용하지 않고** 원인·대안을 보고(Leader 가 사용자와 결정).
- 산출 기록: `agent-vault/10-Flow/tasks/task-079-pe-record.md` + `agent-vault/10-Flow/tasks/task-079-pe-data/`(blind-words.md·key.json·calls.json — 개인정보 없음).

### 이후
갈래 A·B 완료 → **reviewer(sonnet)** 가 코드·프롬프트·측정 독립 감사(특히 차단 목록 오탐·정규화 소비처·N2 가드) → Leader 가 미러에서 시험·타입체크·린트 실행 → **사용자 배포 승인 요청**(푸시 = 웹훅 재배포) → 배포·운영 확인 → 사용자 확인 항목 정리.

## 완료 기준
- 시험 전체 통과·타입체크·eslint 0, 차단 목록 오탐 0(시드 7,755개 전부 통과), 프롬프트 변경 시 합격선 4개 충족, reviewer PASS(_WITH_NOTES), DB·화면·API 계약 변경 없음.
- 한계는 숨기지 않는다: 표본(57개·10회)이 작고, 뜻 판정자는 AI(Leader) 한 명이다 — 사용자 표본 확인 권고.

## 상태 로그

- 2026-10-20 사용자 「1번작업 먼저 진행 후에 2번작업은 데모화면 만드는 작업부터 진행하자」 → Leader 빈도 측정(위 표)·AskUserQuestion(IMP-0055 = 프롬프트 개선 + 측정)·judge 접수(light·sonnet·demo none) → 이력서 작성, 갈래 A·B 병행 소환 예정.

- 2026-10-20 **갈래 A 완료**(`dev-079-code`): 새 시험 14개 통과, 전체 4,551 중 4,548 통과·실패 0·건너뜀 3, tsc 0, 변경 파일 eslint 0, LLM 호출 0. 간체자 차단 목록 2,275자(GB2312 한자 − 일본어 문자표준 JIS X 0208/0212/0213·CP932 확장)·표기+예문 모두 차단·시드 7,755 전수 통과·변이 3종 포착. 가타카나 읽기 정규화·트레이스 `exampleNulled`/`exampleNulledBy` 추가. 기록 [[task-079-dev-record]].
- 2026-10-20 **갈래 B 완료**(`pe-079-meaning`): v4 = `meaningKo` 줄 하나(+153자). 호출 31/40(짝 20·가드 10·예비 1). 객관 지표 (b) N2 가드 7.8(합격선 7.6, 얇은 합격·처음 실행 7.56·실패를 0으로 세면 6.8)·(c) 통과율 95.4→96.9%·(d) 길이 0.98배·지연 0.95배. 기록 [[task-079-pe-record]].
- 2026-10-20 **Leader 눈가림 판정**(열쇠 열기 전, 200단어): v3 불량 단어 27/100 → v4 13/100(p=0.02), 뜻 단위 19.3→11.8%. **gate (a) 불합격**(상대 기준 통과·절대 6% 미달 — 6% 는 느슨한 기준 12% 에서 잡은 사전 등록 실수). 같은 뜻 반복 3건(`업무, 업무`)은 v4 부작용. 메모 `task-079-pe-data/leader-judging-note.md`.
- 2026-10-20 **사용자 결정(AskUserQuestion)**: 「v4 적용 + 중복 접기 (Recommended)」 — 절대 6% 선을 면제하고 v4 적용, 같은 뜻 반복은 코드로 접는다. 위험(N2 새 단어 소폭 감소 가능)은 배포 후 트레이스로 지켜보고 8.0 미만이면 v3 로 되돌린다. reviewer(`rev-079-audit`)가 갈래 A 감사 중이라 v4·중복 접기 적용은 감사 결과 뒤에 한 번에 한다.

- 2026-10-20 **REV-079 PASS_WITH_NOTES**(`rev-079-audit`, Critical 0·High 0·Medium 0·Low 4·Info 4, 직접 재실행: 새 시험 14/14·전체 4,548/4,551·tsc 0·eslint 0, 변이 8종 중 7종 포착) — 간체자 목록 오탐 0 을 독립 재현(Python 재계산 2,275자 일치·Node TextDecoder 교집합 0·시드 문자열 55,423개 차단 글자 0). Low: F-1 JIS X 0213 전용 한자를 시험이 못 막음(`丏` 교체 변이 생존) / F-2·F-3 주석 사실 오류 / F-4 `schemas.ts` 재내보내기가 conversation 공개 API 에 상수를 올림. Info: F-5 `enrich.ts` 와 «일본어 밖 한자» 정의 2개 / F-6 가타카나 정규화의 사용자 가시 효과(새 AI 가타카나 카드 [읽기] 버튼 비활성·기본 단어와 같은 가타카나는 «이미 있음») — 폰 확인 항목 / F-7 트레이스 칸 사소한 성질 / F-8 범위 밖 같은 구멍(`topicDraftSchemas.ts`·A12 `meaningKo` 한자 혼입) — IMP 후보. 조건부 의견: v4 diff 는 N2 통과를 해칠 구조적 경로 없음, 그러나 비교 기준이 시간이 다른 task-078 표본. 기록 [[task-079-reviewer-record]].
- 2026-10-20 **2차 구현 소환**(`dev-079-apply`, sonnet, 미러 dev079b): v4 패치 적용(문구 바이트 동일 확인)·같은 뜻 반복 접기·F-1/F-2/F-3 보강. 끝나면 좁은 재감사 → Leader 전체 시험 → 사용자 배포 승인.

- 2026-10-20 **2차 구현 완료**(`dev-079-apply`, 미러 dev079b): v4 패치 적용(`meaningKo` 줄 PE 측정본과 바이트 동일, sha256 앞 16자 `12280867bf191889`)·`foldRepeatedMeanings`(접기를 ④·⑦ 앞에 — `업무, 업무` 키가 `업무업무` 라 DUP_MEANING 을 새던 문제)·F-1(JIS X 0213 대표 글자 단언 + 목록 크기 2,275·정렬 목록 sha256 고정)·F-2/F-3 주석 정정. 전체 4,562 중 통과 4,559·실패 0·건너뜀 3, tsc 0, 변경 파일 eslint 0, 변이 8종 포착. 기록 [[task-079-dev2-record]].
- 2026-10-20 **REV-079-R2 PASS_WITH_NOTES**(`rev-079-r2`, Critical 0·High 0·Medium 0·Low 1(F-4 이월)·Info 5): v4 문구 PE 측정본과 바이트 동일·런타임 system 2,096자 해시 동일, 접기 전후 ④·⑦·`exampleNulled`·반환 모양 줄 단위 불변, 새 미러 `rev079b` 재실행 4,559/0/3·tsc 0·eslint 0·변이 8종 중 동작 변경 7종 중 6종 포착. Info: I-2 전각 쉼표(`，`·`、`)는 접지 않는다는 결정이 시험으로 고정되지 않음(변이 생존) / 빈 토큰이면 접은 뒤 끝 쉼표가 남을 수 있음(`숙제,,숙제`→`숙제,`) / «읽기 불일치가 안전망» 괄호 과함(`开始/かいし` 통과) / 접기 빈도는 트레이스에 안 남음. 기록 [[task-079-reviewer-r2-record]]. **Leader 결정**: I-2·끝 쉼표는 영향이 작고(PE 표본에 전각 쉼표 없음) 이번엔 고치지 않고 알려진 한계로 남긴다.
- 2026-10-20 **Leader 게이트**(전용 미러 `lead079`, 작업트리와 src·tests·prisma 동일 확인): tsc 0·변경 파일 eslint 0·전체 시험 4,562 중 통과 4,559·실패 0·건너뜀 3. `meaningKo` 줄이 PE 측정 미러와 동일(diff 없음). **judge C2**: `codex_required:false`·`wanted_before_budget:true`(`CX-limit-unknown-hold`) — task-078 과 같이 Codex 검토 보류. 설계 문서 갱신(`docs/design-spec.md` A12 행·`docs/design/challenge.md` v4 절)·하네스 주석 v3→v4.
- 2026-10-20 **다음: 사용자 배포 승인 요청** (푸시 = 웹훅 재배포). 배포 후 폰 확인: 새 AI 가타카나 카드 [읽기] 버튼 비활성·「이미 있음」 표시(F-6), 뜻 줄의 `X, X` 반복 사라짐. 운영 관찰: A12 트레이스 `promptVersion` 별 `kept/target` — **레벨 칸이 트레이스에 없어 N2 만 따로 못 가르는 한계**.

## 최종 요약 (사용자용 — 작성 전)

(작업 완료 시 Leader 가 작성 — 양식 정본 docs/user-report-format.md §3)

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 해당없음 | - | - | judge: none (DM-light-waive) | 10-20 10:18 |
