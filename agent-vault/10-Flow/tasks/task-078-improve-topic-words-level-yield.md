---
task_id: task-078
title: "챌린지 주제 AI 새 단어(A12) 개선 — 두 단계 이상 차이에서 통과 0~2장 진단·프롬프트 개선(IMP-0052) + 난이도 차이 안내 문구"
status: doing
waiting: ""
base_ref: 69ecd6e
risk_level: "R1"
roles_involved: [leader, judge, designer, prompt-engineer, developer, reviewer, qa]
related_tasks: [task-076-improve-challenge-level-generation, task-042-topic-words-b2, task-049-topic-word-examples, task-041-challenge-core]
tags:
  - type/task
  - domain/learning
  - domain/prompt
  - domain/challenge
  - domain/improvement
aliases:
  - A12 수준 개선
  - task-078
created: 2026-10-19
updated: 2026-10-19
demo_gate:
  required: true
  level: "delta"
  status: "drafting"
  version: 0
  repo_path: ""
  artifact_url: ""
  content_sha256: ""
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

# task-078 — 챌린지 주제 AI 새 단어(A12) 개선 (IMP-0052)

## 사용자 요청 (원문)

> IMP-0052 착수해줘. (2026-10-19)

배경: task-076 QA 에서 «주제 N4 + 챌린지 N2(두 단계 위)» 가 3회 시도 모두 새 단어 0·2·0장만 통과([[task-076-qa-a12-record]]). 폴백(주제 기본 표현)이 채워 막히지는 않지만 사용자가 고른 난이도의 새 단어를 거의 못 받는다. 한 단계 차이(N3·N5)도 단어 난이도가 실제로 움직였는지 불분명. 항목: [[IMP-0052-a12-high-level-gap-new-words]].

## judge 접수 (2026-10-19)

- 입력 요약(171자) = 서버(진단·프롬프트) + 화면(난이도 두 단계 이상 차이일 때 조건부 안내 영역·새 문구), DB 변경 없음. 결과 `judge-result@2`(스크래치 `judge-078-intake-r4.result.json`): **standard · R1 · 복잡도 1.79 · developer `opus`(판정) · 데모 `delta`(규칙 `JV-ui_change`, 담당 designer, `ui_change` = behavior_change 0.59) · next `demo_first`**. `task_type` 은 null(판정 불가 — 원인 미확인 조사형).
- 앞선 접수 3회(서버만 → none·opus 2.01 / UI 한 줄 요약 → none·sonnet / 480자 요약 → 모델 단계 누락) 는 **요약이 UI 변경을 한 줄로만 적었거나 300자를 넘어서** 생긴 입력 문제였다. 마지막 입력이 변경 내용을 정확히 서술한 것이고, 이 결과를 따른다.

## 관련 과거 이력 요약 (Leader 큐레이션)

- [[task-042-topic-words-b2]]: A12 신설. 실측(haiku 직렬 33호출) 1차 ajv 33/33·항목 통과 95.4%. 그때 약점 두 개(깊은 체인 제외 목록 무시·`jlpt` 문자열 "null")만 프롬프트에 반영. **수준 창(±1)은 «주제 수준 = 단어 수준» 가정으로 설계됐다**(챌린지 난이도가 주제와 다를 수 있다는 전제가 없었다).
- [[task-049-topic-word-examples]]: v2(예문 exampleJa·exampleKo) — 출력 ≈40% 증가, 합격선 대비 측정 하네스 `tests/live/task049-topicwords-ab.ts`(DB 접촉 0·엔진 직접 호출·교대 실행) 확립.
- [[task-076-improve-challenge-level-generation]]: 챌린지 난이도 선택·`topicWordsLevel`(챌린지 주제면 챌린지 난이도). A12 `[수준]` 이 챌린지 난이도로 들어가면서 이번 문제가 드러남 — 규칙은 의도대로이고 프롬프트·검사 문제.
- 승인된 교훈(`/이슈기록 관련`): 없음(레지스트리 교훈 0건).

## 현재 코드 사실 (Leader 재확인 2026-10-19 — 직접 읽음)

- `prompts/topicWords.ts:239` 지시문: «jlpt: [수준]과 같거나 한 단계 위·아래 난이도만 냅니다(예: N5 → N5·N4). **그보다 어려운 단어는 내지 않습니다.**» · `:242` 예문도 «[수준]과 같거나 한 단계 위·아래만». `:231` «그 주제의 일상 회화에서 한국인 일본어 학습자가 **실제로 쓰는** 단어» · `:232` «주제 밖 단어·시험 문법 용어·급수 설명은 내지 않습니다» — 주제의 쉬운 일상 단어로 끌리는 지시.
- `:500` 검사 ⑤: `jlpt !== null && !window.has(jlpt)` → `JLPT_WINDOW` 탈락. 창 = `topicWordsLevelWindow(ctx.level)` ±1(`:175`). **`jlpt` 가 null 이면 통과**(`:460`).
- `sessions.ts:477` `topicWordsLevel(topic, challenge)` = 챌린지 주제면 챌린지 난이도, 아니면 주제 수준(= `[수준]`·창 중심).
- 통과 장수 → `classifyTopicWordsResult`: 0장 = `TOPIC`·`INVALID`, 일부 = `MIXED`·`SHORT`. 응답에 **탈락 사유 필드가 없어** 실제 탈락이 `JLPT_WINDOW` 인지 표기·읽기·중복인지는 **한 번도 측정되지 않았다**(QA 도 «확인 못 함» — `task-076-qa-a12-record.md` 81행).
- 외부 급수 기준: 공용 기본 단어 `WordEntry`(userId null) 7,757개 — N5 678 · N4 629 · N3 1,649 · N2 1,767 · N1 3,034 (읽기 전용 집계 확인). **DB 없이 쓸 수 있는 원본** = `prisma/seed-data/jlpt/n1~n5.json`(surface·reading·meaning·…, N5 676개 — DB 678 과 2개 차이는 `words-n5.json` 보강분 추정).
- 측정 도구: `tests/live/task049-topicwords-ab.ts`(교대 A/B)·`task042-topicwords-measure.ts`·`tests/prompts/fixtures/topic-words.json`. API 로는 사용자당 하루 3회·성공 뒤 재생성 불가라 **엔진 직접 호출 하네스**로 잰다.

## 확정 결정 (사용자 답, 2026-10-19 — AskUserQuestion)

1. **순서 = 진단 → 프롬프트 → (필요 시) 검사 규칙** (Leader 권고 채택). 창(⑤)을 먼저 풀면 수준에 안 맞는 단어가 통과할 수 있어 마지막 수단.
2. **합격선 = 두 단계 차이 통과 ≥ 목표 장수의 80%(세트 평균) · 한 단계 차이 난이도 이동 +15%p** (Leader 제안값 채택 — 근거 수치 없음). 난이도 이동은 모델 자기 신고가 아니라 **기본 단어 사전(급수)으로 대조한 단어만** 잰다.
3. **안내 문구 = 이번에 포함**(Leader 권고 «후속»과 다른 선택). 그래서 **designer 데모 → 사용자 승인 → 구현** 순서가 추가된다.
4. **측정 예산 = 최소(약 40회)** · **부수 관찰(어색한 한국어 뜻·예문 빈 카드·외래어 읽기 혼재)은 별도 IMP** 로만 접수(이번 변경 밖).

### Leader 가 짚은 긴장 두 가지 (결정을 바꾸지 않고 보고 — 규칙 7)
- **① 합격선 ↔ 예산**: 합격선 선택지가 «표본 조건당 10세트 이상» 이었는데 예산이 40회라 조건 넷(N2·N3·N5·대조)을 각각 10세트로 못 채운다. → 배분: 진단 15회(N2×6·N3×3·N5×3·대조×3, 개선 전 기준선 겸 탈락 사유 측정) + 개선 후 25회(**N2×10**·N3×6·N5×6·대조×3). **두 단계 합격 판정은 N2×10세트로**, 한 단계(+15%p)는 세트 6개씩이라 **방향 확인(보조)** 으로만 읽고 표본 부족을 보고에 명시한다. 더 확실한 판정이 필요하면 사용자가 예산을 늘린다.
- **② 안내 문구 ↔ 개선 성공**: 프롬프트 개선으로 두 단계 차이 통과율이 합격선을 넘으면 «새 단어가 적게 나올 수 있어요» 안내는 실제와 어긋난다. → designer 데모가 **표시 조건·문구 변형**(항상 두 단계 이상일 때 / 개선 뒤 측정 통과율이 낮은 경우만 / 중립 문구)을 보여 주고 사용자가 데모에서 고른다.

## 구현 계획

1. **진단(PE, 약 15회)** — 하네스 `tests/prompts/topic-words-level-live.ts`(task049 하네스 변형·DB 접촉 0): 주제 N4 × 챌린지 N2(6)·N3(3)·N5(3)·대조 N4(3). 측정: `droppedByReason`·모델이 단 `jlpt` 분포·통과 장수·사전 대조(급수 일치율·매칭률). **원인이 `JLPT_WINDOW` 인지 먼저 확정**한다. 서버 코드 변경 없음.
2. **designer 데모 v1(delta)** — 챌린지 만들기(`/plan/challenge/new`) 난이도 선택 아래 조건부 안내 영역. 진단과 병행(파일 겹침 없음).
3. **PE 개선** — 진단 결과로 프롬프트 변경(예: 목표 수준 어휘를 주제 안에서 고르게 하는 지시·금지 수준). 개선 후 25회 측정 → 합격선 판정. 모자라면 사용자에게 검사 규칙(⑤ 창·사전 보정) 변경을 따로 묻는다.
4. **[Judge C1]** 설계 확정 직후 → 필요 시 Codex.
5. **developer** — 승인 데모·확정 프롬프트 반영(`topicWords.ts`·시험·화면 안내). 프롬프트 버전 `topicWords@v3`(회귀 시험 포함).
6. **reviewer → QA** — 재순환 규칙 그대로. QA 는 라이브 호출을 최소로(예산 40회 안에서 PE 측정으로 대체 가능한 부분은 QA 가 반복하지 않는다).
7. **배포는 사용자 승인 뒤**(커밋·푸시 = 서버 코드 변경이라 웹훅 재배포 대상).

## 완료 기준

1. 진단 결과 문서화: 탈락 사유 분포·`jlpt` 분포·사전 매칭률 — 원인이 확정돼 있다.
2. **두 단계 차이(N4 주제 + N2)** 개선 후 N2×10세트 평균 통과 ≥ 목표 장수(10)의 80%.
3. **한 단계 차이(N3·N5)** 사전 대조 «방향 일치율» +15%p(보조 — 표본 6세트, 매칭률 낮으면 그 사실을 명시).
4. 안내 문구: 승인된 데모 대로 구현, 표시 조건·문구 사용자 결정 반영.
5. tsc 0 · eslint 0 · 전체 시험 · build 0 · reviewer PASS · QA PASS · 사용자 승인 뒤 배포.

## 상태 로그

- 2026-10-19 사용자 「IMP-0052 착수해줘」 → Leader 재확인(프롬프트 239·242행·검사 ⑤ 코드 확인, 급수 사전 7,757개 확인) → IMP-0052 `triaged` → judge 접수 4회(요약 정정) → 결과 delta 데모·standard·R1 → AskUserQuestion 4개 → 사용자 답(위 «확정 결정»). 다음: 게이트 `init` → IMP `planned` → 부수 관찰 3건 별도 IMP 접수 → 미러 생성 → PE 진단·designer 데모 병행 소환.
- [23:15][prompt-engineer] 진단 완료(라이브 15회, 서버 코드 변경 0) — N2 통과 평균 2.5/10, 탈락 72/72 = `JLPT_WINDOW`(모델 급수 N2·N1 0/78), 사전 대조로도 탈락 단어 82.8% 가 N5·N4, 한 단계(N3)도 90%·난이도 이동 ≈0 → [[task-078-pe-diag-record]]

## 최종 요약 (사용자용 — 작성 전)

(작업 완료 시 Leader 가 작성)

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge: delta (JV-ui_change) | 10-19 22:59 |
