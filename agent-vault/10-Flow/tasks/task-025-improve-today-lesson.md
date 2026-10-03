---
task_id: task-025
title: "개선 — 오늘의 회화: 이해 문장별 재생·표현 재생·문제 한국어 표기·응용 차이 비교 (IMP-0012·0013·0014·0016)"
status: doing
base_ref: 055dbcf
risk_level: R2
roles_involved: [leader, judge, designer, prompt-engineer, developer, reviewer, qa, deployer]
related_tasks: [task-010-today-lesson, task-010b-repetition-learning, task-003d-tts-p0]
tags:
  - type/task
  - domain/improvement
  - domain/lesson
aliases:
  - 오늘의 회화 개선
  - task-025
created: 2026-09-30
updated: 2026-10-01
demo_gate:
  required: true
  level: "delta"
  status: "approved"
  version: 1
  repo_path: "docs/demo/task-025-improve-today-lesson-v1.html"
  artifact_url: "https://claude.ai/artifact/F9ZREEMa89dVx6FJLrH8ih"
  content_sha256: "3554de3a69ebfa5b94a60e1b1818ccfd7384eee84e5465d61809172acd53a0ad"
  decided_by: "judge"
  rule_id: "DM-low-confidence"
  approved_by: "user"
  approved_at: "2026-10-01T08:17:29+09:00"
  approval_quote: "대기 중인 데모 전부 권고안대로 승인"
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: true
---

## 목표 (Leader)
오늘의 회화(5단계 레슨) 화면의 사용성 개선 4건을 한 묶음으로 처리한다.
- [[IMP-0012-오늘의회화-이해-문장별재생]] — 이해 단계에서 문장별로 다시 듣기.
- [[IMP-0013-오늘의회화-오늘의표현-재생]] — '오늘의 표현'(조각) 항목 소리 재생.
- [[IMP-0014-오늘의회화-문제-한국어표기]] — 문제(퀴즈) 문장에 한국어 뜻 표기.
- [[IMP-0016-오늘의회화-응용-차이비교]] — 응용 단계에서 내 답과 정답의 차이를 보여 주기.

## 사용자 결정 (2026-09-30, Q10)
- **Q10 "모든 단계"** → 한국어 표기(IMP-0014)는 퀴즈 단계만이 아니라 **레슨의 모든 단계(이해·문법·퀴즈·응용 등)의 문제 문장**에 적용한다.

## 포함 항목
- [[IMP-0012-오늘의회화-이해-문장별재생]] (P3) · [[IMP-0013-오늘의회화-오늘의표현-재생]] (P3) · [[IMP-0014-오늘의회화-문제-한국어표기]] (P3) · [[IMP-0016-오늘의회화-응용-차이비교]] (P3)

## 범위
1. **이해 문장별 재생(IMP-0012)** — `StageUnderstand.tsx` 에서 문장 단위 재생 버튼. 기존 `useLessonPlayback` 재사용. **다시 듣기는 진행 기록·완료 판정에 영향을 주지 않는다**(`StudyLog` 를 만들지 않음).
2. **오늘의 표현 재생(IMP-0013)** — `StageGrammar.tsx`(ExprChip). 조각 오디오는 `lessons/content.ts` 의 `AUDIO_KINDS`·`app/api/v1/lessons/[id]/audio/route.ts` 가 다루는 종류에 없다 → ① `AUDIO_KINDS` 확장(소유자 검사·캐시 유지) ② 범용 TTS 재사용 중 **developer 가 소유자 검사·캐시·비용 관점에서 선택**하고 Reviewer 가 감사.
3. **문제 한국어 표기(IMP-0014)** — `StageQuiz.tsx` L145 의 `q.promptKo ?? ja` 폴백을 없애려면 A4 스키마 `quiz.promptKo`(nullable, `schemas.ts` L293/400)를 **필수로 올리는 A4 v8** 스키마 변경이 필요하다. `prompts/reviewMix.ts` 등 문제 생성 경로도 함께. **이미 저장된 레슨의 `promptKo` null** 은 안전한 대체 표기(designer 결정)로 처리하고 재생성은 하지 않는다. prompt-engineer 가 A4 v8 프롬프트·픽스처·JSON 계약 통과율을 검증한다(붙여넣기 레슨 신뢰도 이력 있음 — 신뢰도 하락 시 롤백 기준을 사전에 정한다).
4. **응용 차이 비교(IMP-0016)** — `StageApply.tsx` L150~ 에서 `chat/diff.ts` 의 `diffCodepoints` 를 재사용해 내 답과 정답의 다른 부분을 표시. 색만이 아니라 **밑줄·굵기 등 비색 신호**도 함께. **채점이 아니라 비교 표시**(정오 판정·기록 변경 없음).
5. **문서** — `docs/screens.md` §3(레슨 5단계), 필요 시 api-contract(A4 v8·오디오 종류).

## 비범위
- 퀴즈 문항 수·난이도 변경, 채점 방식 변경, 레슨 재생성, 한글 발음 표기([[task-026-improve-hangul-reading]] 이 별도로 다룬다).

## 데모 게이트
- 레슨 화면 구조에 소리 버튼·한국어 줄·차이 표시가 들어가므로 judge intake 로 판정(예상: **delta**). 승인 전 화면 코드 금지. A4 v8 스키마·프롬프트 작업은 prompt-engineer 가 데모와 병행 가능.

## 완료 기준
- 각 개선 4건이 화면에서 동작(실기기 확인은 사용자), A4 v8 회귀 픽스처 통과율이 v7 이상, 저장된 옛 레슨이 깨지지 않음, 다시 듣기가 기록을 만들지 않음(QA 행 수 대조), 360/390/412 폭 검증.
- `tsc`·`eslint`·단위 테스트·QA 스모크(010 회귀 포함) 0 fail.

## 판단 기록 (judge)

### 2026-09-30 접수 판정 (engine=jev, dev-judge@0.2.0/dev-rules@0.4.0, fallback=None)
- 유형 feature · 복잡도 2.01 · 위험 R1 · developer 모델 **opus** · needs_info false
- 권장 역할: designer, prompt-engineer?, developer, reviewer, qa
- 데모: **delta** (required=true, rule=DM-low-confidence) · 다음 = `demo_first` · 막힌 관문 demo
- 규칙 오버라이드: 없음
- 비고: 데모 수준 판정 규칙이 `DM-low-confidence`(신뢰도 낮음 → delta). 실제 화면 영향 범위가 넓어 designer 가 데모 v1 범위를 정할 때 사용자에게 전체 데모(full) 필요 여부를 확인한다.

- [2026-10-01 13:25] codex_gate/C2 engine=jev → codex_required=true · mode=adversarial-review · focus=security · budget_rule=CX-limit-unknown-r2 | overrides=- | fallback=- | tokens=1151

## Designer 기록

- [22:35] **delta 데모 v1 작성 — `docs/demo/task-025-improve-today-lesson-v1.html`** (`task-025-v1`, `check.mjs lint` → `DEMO_LINT_PASSED`, 토큰 `src/app/globals.css@sha256:22f382529f92` — 값은 task-010 v2 와 같음, 새 색 없음). 기준 = 승인 데모 `task-010-today-lesson-v2.html` 틀·합성 카페 수업 그대로. 상태 29개(주소 `#id`), 폭 360/390/412/세 폭·높이 780/892·테마·“바뀐 곳” 점선 표시 토글, 단계마다 **현재 vs 제안** 비교 프리셋. 하단 = 결정 필요 A/B 4건 · Q10 단계별 한국어 표기 표 · 판정 수준 의견. 헤드리스 크롬으로 29개 상태 렌더·콘솔 오류 0·클릭 흐름(줄 재생·구간 중단·칩 재생/실패·옛 문제 번역·직접 써서 비교)·좁은 폭 가로 넘침 없음 확인. `src/**`·screens.md·frontmatter 는 건드리지 않음.
- 핵심 결정(데모에 반영, 가이드에서 확정)
  - **① 줄 다시 듣기(IMP-0012)**: 대화 줄마다 오른쪽 ▶(보이는 원 32px·누르는 범위 44px, 줄 그리드 `26px | 1fr | 44px`). 재생 줄 `accent-soft` 배경 + ■, 상태 줄 “N번째 줄 · 속도 · 다시 듣는 중”(`role=status`). 글자 가림 중에도 ▶ 보임(가림은 풀지 않음). 구간 재생 중 누르면 구간 재생 중단 → “느리게/보통 ✓” 미기록(현 `breakPending` 규칙). 기록과 무관함은 구간 안 한 줄 안내 “줄 옆 ▶ 는 그 줄만 다시 들려줘요. ‘들었어요’는 아래 구간 듣기(느리게 → 보통)로만 채워져요.”로 표시. 자막만이면 숨김, 다시 보기에서는 듣기만.
  - **② 표현 소리(IMP-0013)**: 재생 중 ■+테두리+배경, 불러오는 중 스피너, 실패는 기존 `LESSON.ttsError` 토스트만(엔진명 없음), 자막만이면 글자 칩으로 복귀. ④⑤의 같은 칩은 이번에 바꾸지 않음.
  - **③ 한국어 표기(IMP-0014·Q10)**: 새 수업(A4 v8)은 지금 모양 그대로(한국어 질문 굵게 → 일본어 문장 17px). 보기(답)에는 한국어 안 붙임(답 노출). 결과 목록은 `promptKo ?? promptJa` 유지. Q10 점검 결과 한국어가 빠질 수 있는 곳은 ③ 문제뿐(①은 문제 없음·번역 토글, ②④⑤는 이미 한국어 필수) — 표로 정리.
  - **④ 글자 비교(IMP-0016)**: `diffCodepoints` 재사용, 다른 글자 = **굵게 + 밑줄**(내 문장에만 = 점선, 모범 답안에만 = 실선), 색은 `ink` 글자 + `surface` 바탕만(빨강·초록·취소선 금지). 상자 위 “글자가 다른 곳에 밑줄을 쳤어요 · 채점이 아니에요”, 같으면 “＝ 모범 답안과 글자가 같아요.”(초록·✓ 금지). 문장부호·공백만 다른 글자는 표시 제외(글자별 판정, 원문 이어 붙이기 불변식 유지). 화면 읽기용 sr-only 요약 줄. 모르겠어요·200자 초과는 표시 없음.
- **결정 필요 A/B (데모 하단 패널, designer 권고는 모두 A)**
  - (a) 줄 다시 듣기 속도 — A 구간 듣기 순서를 따라감(보통 듣기 전 느리게, 뒤 보통) / B 늘 보통 속도
  - (b) 오늘의 표현 소리 — A 칩 전체가 버튼(칩 앞 ▶, 높이 44px) / B 칩 옆 ▶ 버튼
  - (c) 옛 수업 `promptKo` null 대체 표기 — A 공통 한국어 안내 줄 “일본어 문장을 읽고 알맞은 답을 고르세요.” + “예전에 만든 수업이라 한국어 문제 설명이 없어요.” / B [한국어로 보기] 눌러 옮기기(**새 서버 요청 필요 → B 선택 시 Leader 범위 재판단**). 줄 생략 안은 요청과 맞지 않아 뺌.
  - (d) ① 이해 대화 한국어 뜻 — A 지금처럼 [번역] 끈 채로 시작(v2 승인 유지) / B 켠 채로 시작(글자 가림 규칙은 유지)
- **판정 수준 의견: delta 유지(full 불필요)** — 새 화면·주소·단계 순서·저장 흐름 변경 없음, 5단계 틀 안 요소 추가뿐. 영향 단계가 넓은 대신 단계별 현재 vs 제안 + 영향 상태(재생 중·실패·자막만·다시 보기·옛/새 수업·같음/다름/건너뜀)와 360·412 경계 폭을 이 데모에 넣었다. 단 (c)=B 면 서버 범위가 늘어 재판정 필요.
- [22:37] Leader 추가 요청 반영(검토 요청 전 `drafting` 상태라 같은 v1 파일 수정): **결정 필요 (e) 빈칸형 문제의 한국어 줄** 추가 — A 번역 그대로(학습 힌트 허용, 예 “차가운 것을 부탁해요.” → ‘것’이 정답 の 를 드러냄) / **B 빈칸형은 할 일만 한국어로(“빈칸에 들어갈 알맞은 말을 고르세요.”, 정답 비노출) — 권고 B**(PE A4 v8 실측 5문항 중 1건 노출). 상태 `#l3-blank` 추가(총 30개), Q10 표 ③ 행 “결정 c·e”. 결정 필요는 **5건**(a·b·c·d 권고 A, e 권고 B). 최종 파일 sha256 `3554de3a69eb…`, lint PASS — **v1 파일 최종 수정 완료**(이후 변경은 v2 새 파일로).
- 인계 메모(가이드 때 반영): 줄 ▶ 키 `line:{idx}` 는 `playLines(key, [{kind:'dialogue', idx, pace}])` 에 `onComplete` 없이(=StudyLog·progress 쓰기 0). 상태 줄은 `pb.lineOf` 가 아니라 활성 key 로 줄 재생 문구를 따로 그려야 함. 표현 소리 경로(AUDIO_KINDS 확장 vs 범용 TTS)는 developer 선택 — 화면은 어느 쪽이든 같음.

## Prompt-Engineer 기록

- [22:34] **IMP-0014 A4 v8 스키마·프롬프트 단계 완료(prompt-engineer, Q10 "모든 단계")** — `lesson@v7` → **`lesson@v8`**, `reviewMix@v1` → **`reviewMix@v2`**. 화면·라우트·`learning` 모듈은 손대지 않음(개발자 이관 항목은 아래 "Developer 인계 사양").
- [22:34] **변경 파일**: `src/modules/conversation/structuredResponse/schemas.ts`(A4 영역만 — `LessonQuizItem.promptKo: string`, `LESSON_SCHEMA.quiz[].promptKo = {type:'string', minLength:1, maxLength:160}`, `required` 목록은 원래부터 promptKo 포함이라 불변) · `structuredResponse/checks.ts`(quiz 부분만 — "promptKo·promptJa 둘 다 비어 있다" 검사를 `quiz[i].promptKo 에 한글이 없다` 로 교체, 재시도 소진 시 `tolerateContentMismatch` 로 눈감는 대상에 포함) · `prompts/lesson.ts`(버전·이력 주석·quiz 지시 재작성) · `prompts/reviewMix.ts`(quiz 지시에 promptKo 필수) · `__tests__/lesson.test.ts`·`__tests__/reviewMix.test.ts` · 신규 `tests/live/lesson-promptko-measure.ts`(실측 스크립트).
- [22:34] **"문제 문장" 필드 전수 조사(모든 단계)** — 사용자에게 문제로 제시되는 문장: `quiz[].promptKo`(v7 nullable → **v8 필수·비어 있지 않은 한국어**), `quiz[].promptJa`(nullable 유지 — 일본어 문장·표현을 화면에 보여 줄 때만 채움), `application[].promptKo`(이미 필수·minLength 1), `speaking[].promptKo`(이미 필수·minLength 1). 이해(dialogue)·문법(grammar)은 문제 문장이 아니라 제시 자료(`lines[].ko`·`gloss` 등은 이미 필수)라 변경 없음. `hintJa` 는 힌트이지 문제 문장이 아니다. 결론: 스키마 변경 대상은 **quiz.promptKo 한 필드**뿐이다.
- [22:34] **프롬프트 지시(lesson.ts quiz 줄)**: "모든 문제(q1~q5)의 promptKo 에 한국어 뜻을 반드시 채웁니다(null·빈 값 금지, 160자 이내) — 일본어 문장이 나오는 문제는 그 한국어 뜻을, 뜻·형태를 고르는 문제는 무엇을 고르라는 지시를 씁니다(예: …). 정답이 되는 뜻·표현은 promptKo 에 미리 쓰지 않습니다. promptJa 는 일본어 문장을 보여 줄 때만(120자 이내) 채우고 아니면 null." 예산 회귀 테스트(`LESSON_USER_PROMPT_CAP` 9,500)의 최악 조합이 지시 초안에서 9,503자로 넘어 **문구를 41자 압축**해 통과(상한은 올리지 않음). v8 은 v7 대비 프롬프트 +약 180~270자(실측 promptChars 아래 표).
- [22:34] **실측(미러, 실제 Claude CLI, 붙여넣기 3 + 주제 3 + 픽스처 sourceText 2 = 버전당 8회, v8 은 품질 표본 1회 추가)** — 같은 스크립트를 같은 입력으로 v7(변경 전 코드)·v8 에 각각 돌림.

| | v7 | v8 |
|---|---|---|
| 최종 성공 | 8/8 | **8/8**(+품질 표본 1/1 = 9/9) |
| 재시도(attempts=2) | 0/8 | 1/8 (paste#2 — 원인은 `application[0].modelAnswerJa` 콘텐츠 매칭④ = §12 에도 있던 기존 원인, promptKo 와 무관) |
| 평균 지연(성공만) | 31,913 ms | 36,393 ms (재시도 1건 제외 시 31,868 ms — 사실상 동일) |
| quiz promptKo null·빈 값 | **13/40 (32.5%)** — 화면이 `q.promptKo ?? ja` 일본어 폴백에 기대던 비율 | **0/45 (0%)** |
| 프롬프트 자수(paste/topic/fixtureSource) | 10,918 / 11,505~11,590 / 11,094 | 11,186 / 11,773 / 11,277 |

  v8 표본에서 promptKo 필수·한글 검사 때문에 발생한 1차 위반은 **0건**, 최종 FAILED 도 0건. 표본이 작아 통과율의 통계적 동등성을 주장하지는 않는다(§11-3 과 같은 절제). 원자료: `/tmp/kaiwa-lesson-promptko-v7.json`·`-v8.json`·`-v8-sample.json`(미러 임시, 커밋 안 함).
- [22:34] **품질 표본 5문항 육안 점검(v8, 픽스처 sourceText)** — promptKo 가 모두 자연스러운 한국어. 번역형("'도시락을 샀습니다'는 일본어로?")·빈칸형("빈칸에 알맞은 말은? (비가 내리고 있어서 …)") 둘 다 나옴. **관찰(설계 결정 필요)**: 빈칸형에서 promptKo 가 문장 전체의 한국어 번역이라 **빈칸 자리의 뜻이 함께 노출**된다("비가 내리고 있어서" ↔ 정답 「雨が降っていたので」). 지시문의 "정답이 되는 뜻·표현은 미리 쓰지 않는다" 를 모델이 빈칸형에서는 따르지 않았다. 학습 관점에서는 "뜻 힌트를 주고 일본어 형태를 고르게 하는" 표준 패턴이라 수용 가능하지만, 뜻 자체를 맞히게 하려는 문항이라면 약점이다. 지금은 바꾸지 않는다(문구를 더 조이면 재측정이 필요하고 통과율 우선) — Leader/designer 가 "뜻 노출을 허용"으로 확정하면 지시문의 해당 문장을 "빈칸형은 문장 번역을 그대로 써도 된다"로 정정만 하면 된다.
- [22:34] **롤백 기준(v8 결과 기록 전에 정한 것)** — 아래 중 하나라도 해당하면 `lesson@v7`·`reviewMix@v1` 로 되돌린다(schemas.ts quiz.promptKo·lesson.ts 지시/버전·checks.ts 한글 줄·reviewMix.ts 한 줄 — 4개 파일 한 세트 revert): ① 같은 픽스처에서 v8 최종 성공률이 v7 보다 10%p 이상 낮음 ② 붙여넣기 경로에서 promptKo 필수·한글 검사 위반이 원인인 최종 FAILED 1건이라도 ③ ajv 재시도 후에도 promptKo 누락·공백 데이터가 저장됨 ④ 재시도율·지연이 눈에 띄게 악화(재시도율 20% 초과). **v8 실측은 ①~④ 모두 미해당**이므로 롤백 불필요. 운영 반영 후에는 `Lesson.promptVersion` 이 `lesson@v8` 인 행의 생성 실패율(`/api/v1/lessons` 5xx·`LlmJsonViolation`)을 QA 가 운영 스모크(010 65/65)와 함께 확인한다.
- [22:34] **옛 레슨 호환 규칙(재생성 없음)** — 이미 저장된 `lesson@v7` 이하 레슨의 `quiz[].promptKo` 는 null 일 수 있다. 저장 JSON 은 절대 다시 만들지 않으며, **소비자(화면·읽기 경로)가 null·빈 값을 대체 표기로 처리**한다(designer 결정). `Lesson.promptVersion` 으로 v8 이전 레슨을 식별할 수 있다. 스키마 `required` 는 원래부터 promptKo 를 포함했고(null 을 허용했을 뿐) 저장물은 스키마로 다시 검증하지 않으므로 옛 행이 깨지지 않는다.
- [22:34] **Developer 인계 사양** —
  1. **타입 결합(현재 `tsc` 유일 오류)**: `src/app/api/v1/lessons/route.ts(46,45)` `LessonRequest` ↔ `LlmJsonRequest<LessonGenOutput>` 비호환. 원인은 `src/modules/learning/lessons/content.ts` 의 `LessonGenOutput.quiz[].promptKo: string | null`(L12 부근)이 `LessonResponse`(v8: `string`)와 `extraCheck` 매개변수 반공변으로 충돌하는 것. 권장: **생성 출력 타입은 `promptKo: string`**, **저장·읽기 타입(`StoredLessonContent`, `src/types/lesson.ts` L116~117)은 `string | null` 유지**(옛 레슨). `src/modules/learning/lessons/generate.ts` L77·`route.ts` L46 은 생성 타입 변경만 따라가면 된다.
  2. **테스트 픽스처**: `src/modules/learning/__tests__/task010.test.ts` L44 의 q3 `promptKo: null` 은 "옛 레슨 읽기 경로" 케이스로 남기거나, 생성 타입용이면 문자열로 바꾼다(생성 경로 픽스처에 null 이 있으면 타입 오류). 내 쪽 픽스처(`lesson.test.ts`·`reviewMix.test.ts`)는 v8 로 갱신·통과(단위 전체 848 중 847 pass·0 fail·1 skip, tsc 위 1건 외 0, eslint 변경 파일 0).
  3. **화면**: `StageQuiz.tsx` L92·L145~148 의 `q.promptKo ?? ja` 폴백은 옛 레슨용으로만 남기고, 신규 레슨(promptKo 항상 채워짐)에서는 promptKo 를 주 표기로. 표기 방식은 designer 데모를 따른다.
  4. **Prompt Registry**: A4·A5 시스템 프롬프트 문구와 A4 스키마가 바뀌었으므로 **`npm run prompts:sync` 필요**(SOURCE_CODE 버전 상승). Console 에서 만든 CONSOLE 버전이 A4/A5 에 ACTIVE 인지 Leader 가 확인해 충돌 시 어느 쪽을 ACTIVE 로 둘지 정한다(sync 는 developer 구현 명령 — 나는 사양만 전달).
  5. **회귀 픽스처**: 신규 테스트 6건(lesson 5 + reviewMix 1) — promptKo null·''·161자·누락 거부 / promptJa 전부 null 허용 / 위반 경로에 promptKo 포함 / 한글 없는 promptKo 검사 / 재시도 소진 시 눈감음(단, targetIds 위반은 여전히 검출) / 지시문에 promptKo·반드시·null 포함 및 v7 문구("중 최소 하나") 부재. `tests/prompts/fixtures/lesson.json` 은 무변경.
  6. **A5 주의**: reviewMix 의 `extraCheck` 는 마지막 시도 눈감기가 **없다** — v8 한글 검사가 A5 에서는 엄격 적용된다(재시도 1회 후 실패 가능). A5 라이브 통과율은 이번에 측정하지 않았다(A5 는 010b 운영 경로) — QA 가 운영 스모크에서 A5 1~2회 확인 권장. 부수 관찰: reviewMix 의 읽기 지시(히라가나만)가 lesson@v3+ 스키마의 가타카나 허용과 어긋난다(이번 범위 밖, 후속 후보).
- [22:34] **사고 기록** — 22:22:58 KST 경 task-020 QA 에이전트가 공유 작업 트리에서 미커밋 변경을 되돌리는 checkout 명령을 `src/modules/conversation/` 에 실행해 **내 미커밋 v8 편집(4개 소스 파일)과 pe-024(talk) 의 편집이 함께 되돌려졌다.** 내 편집은 스크립트로 재적용·diff 로 검증했다(현재 6개 파일 diff 확인). pe-024 의 `talk.ts` 는 되살아났지만 `checks.ts` 의 talk 쪽 변경이 있었다면 그쪽 담당자가 재확인해야 한다. **공유 트리에서 QA·리뷰어가 checkout·restore 류 되돌리기를 쓰지 않도록 Leader 가 지시 필요**(재발 방지).
- [22:34] **남은 위험** — ① developer 의 `LessonGenOutput` 타입 변경 전까지 `tsc` 1건 실패(빌드 차단) ② `prompts:sync`·CONSOLE 충돌 확인 미완 ③ 빈칸형 문항의 뜻 노출(위 관찰) ④ 표본 n=8(+1)이라 운영 첫날 통과율은 QA 스모크로 재확인 ⑤ A5 라이브 미측정.

- [09:38] **(e)=B 빈칸 문제 promptKo "할 일만" — 프롬프트·테스트 단계 완료, 라이브 A/B 는 Claude CLI 구독 세션 한도(429, 13:10 KST 해제)로 부분 실측만(prompt-engineer)** — 버전은 올리지 않았다: `lesson@v8`·`reviewMix@v2` 는 아직 운영·커밋 전(src·tests 어느 커밋에도 `lesson@v8` 없음, HEAD 는 v7) → 두 파일의 v8/v2 이력 주석에 (e)=B 문단만 추가.
- [09:38] **변경 파일(PE 소유만)** — `prompts/lesson.ts`(quiz 지시: "**단 빈칸 문제는 promptKo 에 할 일만 씁니다**(예: "빈칸에 들어갈 알맞은 말을 고르세요.") — 번역·정답의 뜻은 쓰지 않고, 빈 문장은 promptJa 에 ＿＿ 로 비워 반드시 채웁니다". 옛 예시 `(예: promptJa "コーヒーを ＿＿。" → promptKo "빈칸에 알맞은 말은? (커피를 ＿＿.)")` 는 번역을 부추기는 예시라 삭제) · `prompts/reviewMix.ts`(A5 도 같은 스키마·검사를 써서 같은 규칙 한 줄 정렬) · `structuredResponse/checks.ts`(**로직 무변경, 한글 검사 위반 안내문만** — 아래 "재시도 안내문" 참고) · `__tests__/lesson.test.ts`·`reviewMix.test.ts`(지시문 단언·픽스처 q2 promptKo 를 할 일 문장으로) · `tests/live/lesson-promptko-measure.ts`(`--variant new|old`, 빈칸형 문항 표, **INFRA 실패 분류·중단**). 화면·라우트·`learning` 무수정.
- [09:38] **코드 검사는 추가하지 않았다(판정 근거)** — "빈칸형 promptKo 가 정답의 한국어 뜻을 노출했는가"는 코드로 가릴 수 없다: 선택지에 한국어 뜻(gloss)이 없어 promptKo 와 정답을 대조할 기준이 없고, 길이·괄호·인용부호 휴리스틱은 정상 문항까지 위반으로 잡아 생성 실패율만 올린다(v8 롤백 ④). 그래서 지시문 + 단위 테스트(지시문 단언) + 라이브 육안 집계로만 확인한다.
- [09:38] **예산** — `LESSON_USER_PROMPT_CAP` 9,500 유지. 처음 쓴 문구는 주제 경로 최악 9,591자로 캡 초과 → 일반 문장("정답이 되는 뜻·표현은 … 미리 쓰지 않습니다")과 promptJa 예시 쌍을 빈칸 절 안으로 접어 **주제 최악 9,480 / sourceText 최악 7,149**. 여유 20자라 이 줄을 더 늘릴 수 없다.
- [09:38] **재시도 안내문(checks.ts, 문구만)** — 옛 안내 "문제 문장의 한국어 뜻(또는 무엇을 고르라는 한국어 지시)을 써야 한다" 는 재시도 때 빈칸 문제를 다시 번역으로 쓰게 만들 수 있어, "일본어 문장이 나오는 문제는 그 뜻, 뜻·형태를 고르는 문제는 고르라는 지시, 빈칸 문제는 뜻을 쓰지 말고 "빈칸에 들어갈 알맞은 말을 고르세요."처럼 할 일만"으로 바꿨다. 단위 테스트에 문구 단언 추가(재시도 안내가 번역 쪽으로 되돌아가지 않게).
- [09:38] **라이브 실측(미러, 실제 Claude CLI, 같은 입력 붙여넣기 3 + 주제 3 + 픽스처 2, 순차)** — `variant=new` 8회 중 **붙여넣기 2회만 모델에 닿았고 6회는 1.6~1.9초 만에 `ClaudeCliExecError exit=1`** 이었다. 원인은 프롬프트가 아니라 `claude --print` 가 `429 "You've hit your session limit · resets 1:10pm (Asia/Seoul)"` 를 돌려주는 것(직접 호출로 확인) — 같은 구독을 쓰는 다른 백그라운드 에이전트와 한도를 공유한다. `variant=old`(변경 전 문구)는 0회 유효 → 결과 파일을 `/tmp/kaiwa-lesson-promptko-e-old.INVALID-429.*` 로 격리. 측정 스크립트가 이 상황을 "성공 2/실패 6" 으로 오집계했으므로, 이제 CLI 실패가 검증 한 번 없이 8초 안에 끝나면 `infra:true` 로 분류해 분모에서 빼고 이후 호출을 건너뛴다(한도 걸린 상태로 프로브해 동작 확인).

| (e)=B 수정 후, 유효 2회 | 값 | 비교 기준(v8 기존 실측, 같은 입력) |
|---|---|---|
| 최종 성공 | 2/2 | 8/8 |
| 재시도(attempts=2) | 1/2 — paste#2, 원인 `quiz[0]·quiz[4].promptKo` 한글 없음(v8 한글 검사) | 1/8, 원인 `modelAnswerJa` 콘텐츠 매칭 |
| 지연 | 38,760 ms / 77,029 ms(재시도 포함) | 평균 36,393 ms |
| 사용자 프롬프트 자수 | 11,204(paste#1) | 11,186 — +18 |
| quiz promptKo 공백 | 0/10 | 0/45 |
| 빈칸형 문항의 정답 노출 | **0/4**(promptKo 4/4 가 "빈칸에 들어갈 알맞은 말을 고르세요."·빈 문장 4/4 가 promptJa 에 ＿＿) | 변경 전 표본(`/tmp/kaiwa-lesson-promptko-v8-sample.json`) **2/2** — "빈칸에 알맞은 말은? (비가 내리고 있어서 우산을…)"·"…의 밑줄 부분으로 알맞은 것은?" 둘 다 번역이 정답을 담음 |

  **정정**: 위 "품질 표본 5문항 육안 점검" 줄의 "③ 빈칸형 문항의 뜻 노출" 은 5문항 중 1건처럼 읽히나, 다시 센 결과 **빈칸·밑줄형 2문항이 모두 노출**이었다(2/2).
- [09:38] **새로 본 위험 — 같은 종류의 노출이 "뜻 고르기"(일본어 문장 → 한국어 보기) 문항에서도 난다(범위 밖이라 손대지 않음)** — 재시도한 paste#2 의 뜻 고르기 문항 2개가 promptKo 에 정답의 한국어 뜻을 거의 그대로 썼다("다음 문장의 뜻을 고르세요: 점원이 '주문은 정하셨나요'라고 물어서 조금 긴장했다는 내용의 일본어 문장이에요." ↔ 정답 "점원이 주문을 정했는지 물어서 조금 긴장했다", q5 도 같은 꼴). 뜻 고르기 4문항 중 2건(둘 다 재시도 뒤 응답)이다. 추정 원인은 두 가지: ① v8 지시의 "일본어 문장이 나오는 문제는 그 한국어 뜻을" 이 한국어 보기 문항에서는 곧 정답이고 ② 옛 재시도 안내문이 "문제 문장의 한국어 뜻"을 먼저 요구했다(② 는 이번에 문구를 고쳤고 ① 은 그대로). **제안(Leader 판단 필요)**: 빈칸 절을 "promptKo 에 정답(보기)의 뜻을 미리 쓰지 않는다 — 빈칸 문제는 할 일만, 일본어 문장의 뜻을 한국어 보기에서 고르는 문제는 "이 문장의 뜻을 고르세요."처럼"으로 일반화하는 것. 단 예산 여유가 20자라 다른 문구를 줄여야 하고, 한국어 문장 → 일본어 보기(번역형) 문항은 지금처럼 한국어 문장을 써야 하므로 라이브 재측정 없이는 넣지 않는다.
- [09:38] **v8 롤백 기준 판정(작성해 둔 ①~④)** — ① 최종 성공률 v7 대비 -10%p 이상: **판정 불가**(유효 2회, 2/2) · ② 붙여넣기 경로 최종 FAILED(promptKo 필수·한글 검사 원인): 0건(n=2) · ③ 재시도 뒤 promptKo 누락·공백 저장: 0건 · ④ 재시도율 20% 초과·지연 악화: 1/2 로 문자 그대로는 초과이나 n=2 라 **판정 불가**, 다만 원인이 v8 한글 검사라는 점이 걸린다(v8 기존 9회에서는 이 원인 0건). **롤백은 하지 않지만 확정도 아니다 — 재측정 전까지 (e)=B 는 "단위 테스트 통과·라이브 부분 확인" 상태.**
- [09:38] **검증** — 미러 `~/.node-local/thekaiwa`: conversation 단위 테스트 **300건 pass 300 / fail 0**(lesson·reviewMix 73건 포함, 예산 테스트 3건 포함) · `tsc --noEmit` 오류 0 · eslint(변경 파일 5개) 0. 커밋·푸시·배포·DB 변경 없음.
- [09:38] **남은 위험·다음 단계** — ① 라이브 A/B 미완: 한도 해제(13:10 KST) 뒤 TheKaiwa 저장소에서 `bash scripts/sync-local.sh` 후 `cd ~/.node-local/thekaiwa && node --env-file=.env --import tsx tests/live/lesson-promptko-measure.ts --variant new --out /tmp/e-new.json`, 이어서 `--variant old --out /tmp/e-old.json`(각 8회 순차, 약 6분)을 돌려 위 표를 채운다 — 다른 에이전트가 같은 구독을 쓰는 시간대는 피한다 ② 뜻 고르기 문항 노출(위) 일반화 여부 결정 ③ `prompts:sync` 는 개발자 이관 — A4·A5 시스템 프롬프트 문구가 또 바뀌었으니 v8/v2 SOURCE_CODE 버전 갱신 필요, CONSOLE 버전이 A4/A5 에 ACTIVE 인지 Leader 확인 ④ 한도 걸린 상태에서는 `INFRA` 로 표시되고 중단되므로 결과를 성공률로 읽지 말 것.
- [14:21] **(e)=B 라이브 A/B 재측정 완료 — 한도 해제 후(13:13~14:20, 동시 호출 2개 이하, 429 INFRA 0건)** — 최종 문구 결론: 빈칸·밑줄형·뜻 고르기 모두 promptKo 정답 노출 0건, 한글 없는 promptKo 0건, 최종 실패 0건. 결과 파일 `/tmp/kaiwa-e2~e7-*.json`. 아래는 중간 판 포함 전 과정.
- [14:21] **중간 회귀의 원인(내가 만든 것)** — 첫 (e)=B 초안이 예산을 아끼려고 v8 일반 문장 "정답이 되는 뜻·표현은 promptKo 에 미리 쓰지 않습니다."를 빈칸 절에 흡수해 지웠다. 그러자 남은 절 "일본어 문장이 나오는 문제는 그 한국어 뜻을"이 **뜻 고르기 문항**(일본어 문장 → 한국어 뜻 선택지)에서 충돌 → 모델이 ⓐ 일본어 문장을 promptKo 에 복사(한글 없음 → v8 한글 검사 재시도, 마지막 시도엔 완화돼 일본어만 저장) 또는 ⓑ 정답의 한국어 번역을 promptKo 에 씀. `noHangulQuiz`(시도별 한글 없는 quiz 문항 포획)로 확인. 재시도 안내문(checks.ts)의 "일본어 문장이 나오는 문제는 그 뜻" 도 같은 방향으로 밀었다.
- [14:21] **최종 수정(같은 v8/v2, 길이 상한 유지)** — ① 일반 문장 "정답이 되는 뜻·표현은 promptKo 에 미리 쓰지 않습니다." 복원(다른 군더더기 제거로 예산 확보) ② "일본어 문장이 나오는 문제는 그 한국어 뜻을 쓴다" 절 삭제 → "**일본어 문장은 promptJa 에만 두고, promptKo 에는 무엇을 고르라는 한국어 지시(예: "문장의 뜻을 고르세요.")를 씁니다**" ③ checks.ts 재시도 안내문(문구만, 로직 무변경)을 같은 방향으로 ④ reviewMix(A5)의 "일본어 문장이 나오면 그 한국어 뜻을 함께 적되 …" 절도 같은 문구로 정렬(같은 모순). 단위 테스트 단언 갱신. **의도적 이탈**: (e)=B 지시 "번역형·뜻/형태 고르기 지시는 그대로"를 이 한 줄에 한해 바꿨다 — 되돌리려면 옛 절 "일본어 문장이 나오는 문제는 그 한국어 뜻을, 뜻·형태를 고르는 문제는 무엇을 고르라는 지시를 씁니다"로 복원(단 뜻 고르기 정답 노출이 돌아온다).
- [14:21] **실측 표(A4 lesson@v8, 실제 Claude CLI, 미러)** — 최종 문구 `new`: 붙여넣기 10 + 주제 4 + 픽스처 sourceText 4 = **유효 18회, 18/18 성공, 재시도 3/18(17%)**, 한글 없는 quiz 문항 0, 최종 실패 0, 재시도 원인은 choices 중복·4개 초과 2건 + JSON 파싱 1건(promptKo 무관). 지연 재시도 없는 회차 평균 붙여넣기 36.8초·주제/소스 33.2초. 변경 전 문구 `old`(같은 시간대 붙여넣기 10회): 10/10 성공, 재시도 3/10(원인 modelAnswerJa 내용 불일치 2 + JSON 1), 재시도 없는 평균 34.0초. 문항 분류(최종 문구 new, 전체 18회 90문항): **빈칸형(promptJa 에 ＿＿) 43개 → 전부 할 일만**("빈칸에 들어갈 알맞은 말을 고르세요."/"…알맞은 조사를 고르세요." 4건), 번역·정답 뜻 0건 · **뜻 고르기·밑줄 의미형 39개 → promptKo 는 "문장의 뜻을 고르세요." 류 지시만, 정답 노출 0건** (밑줄형은 "밑줄 친 …을 고르세요." 지시만). `old`: 빈칸형 24개 **24개 전부 문장 번역**(정답 뜻 포함 다수) · 뜻 고르기 4개 중 2개는 promptKo 에 일본어 문장을 괄호로 복사(정답 노출은 없었다 — old 표본에서 뜻 고르기 노출은 발견 못함). 중간 판 누적(참고): e3 에 "…라는 뜻이 되도록 빈칸을 채우세요." 1건(정답 뜻 노출 1건)·마지막 시도 일본어-only promptKo 저장 2건 → 최종 문구에선 0.
- [14:21] **reviewMix(A5) 정렬 후 확인** — 미러에서 `buildReviewMixRequest`(픽스처 6항목)를 실제 CLI 로 4회: 4/4 성공(재시도 1: choicesNote 필드 허용 안 됨 — promptKo 무관), 20문항 전부 빈칸=할 일만·뜻 고르기="문장의 뜻을 고르세요." 류, 정답 노출 0. 표본이 작아 참고 수준(스크립트는 일회성 scratchpad, 저장소에 두지 않음).
- [14:21] **롤백 기준 ①~④ 재판정(표본 수 포함, 최종 문구)** — ① 최종 성공률 v7 대비 -10%p 이상: 18/18(100%) vs old 10/10 → **하락 없음** · ② 붙여넣기 경로 최종 FAILED(promptKo·한글 검사 원인): **0/10** · ③ 재시도 뒤 promptKo 누락·공백·일본어-only 저장: **0/18**(중간 판 e3·e6 에서 2건 있었으나 최종 문구에서 사라짐) · ④ 재시도율 20% 초과·지연 악화: new 3/18(17%)·붙여넣기 3/10(30%) 이지만 **같은 시간대 old 도 3/10(30%)** 이고 원인이 서로 다르며 promptKo 와 무관 → v8 로 인한 악화 아님(앞선 "old 1/14" 는 한도 전 한가한 시간대 표본). 지연 악화 없음(재시도 없는 회차 33~37초 vs old 34초). **롤백 기준 미충족 — v8 유지.** 단 표본은 18회/10회라 작다 — 운영 `lesson` 실패율·재시도율(toolLog)은 배포 후 Leader/QA 가 계속 본다.
- [14:21] **예산·검증** — `LESSON_USER_PROMPT_CAP` 9,500 유지, 주제 경로 최악 **9,490**(소스 경로 더 낮음). 미러에서 conversation 단위 테스트 **321 pass / 0 fail**(lesson·reviewMix 73건 포함) · `tsc --noEmit` 오류 0 · eslint(변경 6개 파일) 0. 변경 파일: `prompts/lesson.ts`·`prompts/reviewMix.ts`·`structuredResponse/checks.ts`(문구만)·`__tests__/lesson.test.ts`·`__tests__/reviewMix.test.ts`·`tests/live/lesson-promptko-measure.ts`(신규, `KO_NOW/NEW_SEG` 를 최종 문구에 맞춤). 커밋·푸시·배포·DB 변경 없음. 버전은 `lesson@v8`·`reviewMix@v2` 유지.
- [14:21] **재발 가능한 함정(기록)** — ⓐ 예산 압박으로 "일반 규칙 한 문장"을 "특수 규칙 괄호"에 흡수하면, 일반 규칙이 막고 있던 인접 유형(뜻 고르기)이 조용히 무너진다 — 프롬프트 한 줄 단축은 반드시 인접 유형 문항을 포함해 실측할 것 ⓑ 재시도 안내문(검사 위반 문구)도 프롬프트다 — 안내문의 예시가 곧 모델이 다음에 쓰는 형태 ⓒ 한글 검사 위반은 마지막 시도에서 완화되므로 "최종 성공"이어도 일본어-only promptKo 가 저장될 수 있다 → 측정은 시도별 `noHangulQuiz` 로 볼 것 ⓓ 같은 구독을 다른 에이전트가 쓰면 429 가 오며(CLI exit 1·1~2초), 성공률 분모에서 빼야 한다(`infra`).
- [14:21] **다음 단계(개발자·Leader)** — ① `prompts:sync`: A4·A5 시스템 프롬프트 문구가 바뀌었으니 `lesson@v8`·`reviewMix@v2` SOURCE_CODE 버전 갱신, CONSOLE 버전이 A4/A5 에 ACTIVE 인지 Leader 확인(충돌 시 합의) ② 위 [09:38] "남은 위험·다음 단계"의 ① 라이브 A/B 미완 항목은 **해소**, ② 뜻 고르기 노출 일반화는 **이번 수정으로 반영** ③ 코드 쪽 후속 제안(선택, developer): 마지막 시도에서 완화돼 한글 없는 promptKo 가 저장될 때 화면이 `promptKo ?? promptJa` 로 안전하게 보이는지 확인(저장 사례는 최종 문구에서 0건이라 시급하지 않음) ④ 미측정: A5 는 4회 표본뿐, 붙여넣기 외 경로의 장기 통과율은 운영 지표로.

## Developer 기록

- [08:18] **서버·타입 정리(화면 파일 무수정)** — lesson@v8 로 생긴 `tsc` 1건(`src/app/api/v1/lessons/route.ts(46,45)` `LessonRequest` ↔ `LlmJsonRequest<LessonGenOutput>`, `extraCheck` 매개변수 반공변 충돌) 해소.
  - `src/modules/learning/lessons/content.ts` — 생성 출력 `LessonGenOutput.quiz[].promptKo: string`. 저장·읽기용 `StoredQuizItem`(promptKo `string | null`)을 두고 `StoredLessonContent` 가 `quiz` 를 그것으로 덮는다(v7 이하 저장 레슨의 null 을 그대로 받음). `toStoredContent`·`readStoredContent` 동작은 그대로, 저장 JSON 재생성 없음. `src/types/lesson.ts` `LessonQuiz.promptKo: string | null` 무변경.
  - `src/modules/learning/__tests__/task010.test.ts` — `gen()` 은 생성 타입이라 q3 promptKo 를 문자열로 바꾸고, 옛 레슨 읽기 케이스(저장 JSON 의 promptKo null → `readStoredContent` 통과·null 보존·채점 정상) 1건 추가.
  - `checks.ts`(`REPLY_SENTENCE_HARD_CAP` 주석)·`schemas.ts`(머리 주석) — "2문장 상한" 서술을 "기본 3(CHAT·sceneCap 없는 호출) / TALK 는 sceneCap+허용치"로 사실에 맞게 고침. **주석만**, 로직·talk sceneCap 무변경.
  - 검증(미러 `~/.node-local/thekaiwa`): `tsc --noEmit` **오류 0** · eslint(변경 4파일) **0건** · 단위 테스트 전체 **900건 — pass 899 / fail 0 / skip 1**(기존 skip). 커밋·배포·DB 변경 없음.
- [13:14] **화면·소비자 쪽 구현 완료(데모 v1 승인본 기준, 결정 a·b·c·d=A, e=B)** — `check.mjs check` → `DEMO_GATE_PASSED` / `task: task-025`. 021 의 lesson 파일 변경(LessonScreen·StageSpeak KeyboardInset)은 건드리지 않고 그 위에 얹음. prompt-engineer 의 prompts·schemas·checks 무수정.
  - **① 줄 다시 듣기(IMP-0012)** `StageUnderstand.tsx` — 줄 그리드 `26px | 1fr | 44px`, `LineReplayButton`(누르는 범위 44·원 32, 재생 중 ■·받는 중 스피너), 가림 줄에도 표시(가림 유지), 재생 줄 `accent-soft`, 상태 줄은 `pb.lineOf` 가 아니라 큐 스냅샷 `line:{idx}`(`activeLineReplay`)로, 막히면 "▶ 눌러서 듣기". 속도 `lineReplayPace`(보통 끝까지 전 slow·뒤 normal·다시 보기 normal). `playLineReplay` = `playLines('line:{idx}', [{dialogue, idx, pace}])` **onComplete 없음**. 자막만이면 버튼·안내 줄 숨김.
  - **② 표현 소리(IMP-0013)** `StageGrammar.tsx`·`parts.tsx ExprPlayChip` — 칩 전체 버튼(min-h 44, ▶ 원 30), 재생 중 ring+accent-soft+■, 받는 중 스피너, 실패는 기존 `LESSON.ttsError` 토스트(큐 onPartError 그대로), 자막만이면 글자 칩. ④⑤ 칩 무변경. 키 `expr:{idx}`, onComplete 없음.
  - **오디오 경로 선택 = ① `AUDIO_KINDS` 확장(`chunk`)** — 이유: (소유자) #62c 는 `getLessonAudioSource` 가 userId 소유 레슨만(타인 404)·본문 있는 상태만 보고 **문장을 서버가 본문에서 고른다**(클라이언트 글자 없음 → `text` 키는 `unknown_key` 400) — #23 범용 합성은 클라이언트가 임의 글자를 보내는 경로라 레슨 소유와 무관. (캐시·품질) 같은 `synthesizeLessonClips` → `LEARNING_NORMAL`·Resolver `LESSON_READ`·**이 레슨/주제 발음 사전 범위**·12요소 캐시 그대로(#23 은 레슨 사전 범위가 안 붙음). (비용) 칩 ≤8개(`LESSON_CHUNKS_MAX`), 첫 탭 1회 합성 뒤 캐시 HIT, 분당 60(`tts:{userId}`, #23 과 공유) 그대로. 서버 변경은 `content.ts` `AUDIO_KINDS`+`audioText` 한 분기·`types/lesson.ts AudioKind`·라우트 주석뿐(라우트 로직 무변경). 조각 앞 `〜` 는 정규화기가 지운다(`normalizer.ts` 장음 물결표 규칙).
  - **③ 문제 한국어 표기(IMP-0014)** `StageQuiz.tsx` — `quizPromptView`: promptKo(공백 제외) 있으면 한국어 질문 → 일본어 문장 17px, 없으면(옛 v7 null·빈 문자열) 공통 안내 줄 + 일본어 문장 + ⓘ "예전에 만든 수업이라…"(서버 요청 없음). 결과 목록 `quizSummaryPrompt` = `promptKo ?? promptJa`(공통 안내 줄 안 넣음). 보기 무변경.
  - **④ 글자 비교(IMP-0016)** 신규 `compare.ts compareAnswer` — `diffCodepoints` 재사용 + 문장부호·공백(`/^[\s\p{P}]$/u`)은 **글자 하나씩** 같음으로(섞인 조각도 부호만 빠짐, 이어 붙이기 불변식 유지). `StageApply.tsx` — `<mark>` 굵게+밑줄(내 문장 점선 2.5px·모범 실선 2px), ink 글자·surface 바탕만, 머리 줄 범례, 안내 "글자가 다른 곳에 밑줄을 쳤어요 · 채점이 아니에요"/"＝ 모범 답안과 글자가 같아요.", sr-only 요약, 모르겠어요·200 초과는 표시 없음. 저장·정오 무변경.
  - 그 밖: `useLessonPlayback` 에 `loading(key)`(큐 `waiting` 또는 손잡이 전), `lessonCopy` 문구(U1 줄·U2 표현·U3 옛 수업·U4 비교), 문서 `docs/screens.md` §12 F·G·H·I·12-3 C·12-5·12-8·변경 이력, `api-contract.md` #62c(`chunk`·서버가 문장 선택·다시 듣기는 #61/StudyLog 없음).
  - **데모와 달라진 점(의미 동일)**: ① 구간 재생 중 숨긴 줄도 재생 줄 배경을 받는다(데모와 같음 — 기존 코드는 가림 줄에 강조가 없었다). ② ④ "모르겠어요"·200자 초과일 때 아래 안내 문구는 **기존 문구**를 그대로 둔다(데모는 그때도 새 문구 "밑줄은…"을 띄우지만 designer 설명 `#l4-skip` "지금과 같아요"에 맞춤 — 밑줄이 없는데 밑줄 설명을 보이지 않게). ③ 일본어 문제 줄에 `leading-[1.7]`(데모 `.qja` 값).
  - **검증(미러)**: `tsc` 0 · eslint(lesson 전체·변경 파일) 0 · 단위 전체 **1058 — pass 1056 / fail 1 / skip 1**, fail 1 = `brand.test.ts` versionCode(task-021 의 `build.gradle` 3 올림 — 이 task 무관). 신규 단위 `src/components/lesson/__tests__/task025.test.ts`(11건: 재생 키·onComplete 없음·속도·스냅샷 판정·문구·문제 표기·비교 불변식/부호/200자) + `src/modules/learning/__tests__/task025.test.ts`(2건: chunk 문장 선택·본문 검사) 전부 pass.
  - **헤드리스 화면 확인(개발자 자체, DB 쓰기 0)**: 합성 레슨을 `GET /api/v1/lessons/:id` 가로채기로 주고 `/api/**` 쓰기는 503, 오디오는 가짜 WAV(스크립트는 scratchpad, 커밋 안 함). 다른 에이전트의 미러 dev(3012, `localhost`)에서 **97 PASS / 3 FAIL** — FAIL 3 은 전부 `GET /api/v1/speech/config` 429(1분에 페이지 20여 번 연 하네스 탓, 레슨 코드 무관). 확인: 3폭 ①②③④ 가로 넘침 0, 줄 ▶·칩 44px, 줄 재생 상태 줄 "2번째 줄 · 느리게 다시 듣는 중"→끝나면 원래대로, **줄 다시 듣기·구간 중단·표현 재생 뒤 #61 PATCH 0**(대조: 구간을 끝까지 들으면 PATCH 발생), 오디오 본문 `{dialogue,1,slow}`·`{chunk,2,normal}`, 실패 토스트·칩 복귀·엔진명 0, 자막만 버튼 0, 다시 보기 보통 속도, 옛 수업 안내 줄(null·빈 문자열), 결과 목록 일본어 유지, 비교 밑줄 실선/점선·ink 색·`、` 제외·같음 문구·sr 요약·모르겠어요 표시 없음.
  - **남은 위험**: (1) 실기기(S25+) 소리·탭 감각은 미확인(F6). (2) 칩 글자가 `〜てください` 처럼 물결표로 시작하면 정규화기가 지워 "てください"로 읽힌다(의미 손실 작음). (3) 옛 레슨 판정은 promptVersion 이 아니라 promptKo 값으로 한다(v8 이후 레슨에 빈 promptKo 가 저장될 일은 스키마 minLength 1 로 막힘). (4) 줄 다시 듣기 속도는 재생 시점이 아니라 그릴 때 다시 계산한다(재생 중 구간 상태가 바뀔 수 없어 같음).
  - **Reviewer high-risk 영역**: ⓐ `logic.ts playLineReplay/playExpr` 가 onComplete 를 넘기지 않는지·`StageUnderstand` 의 `play()`(구간) 경로만 `st.update` 하는지(진행·StudyLog 무결) ⓑ `content.ts audioText('chunk')`·`parseAudioBody` — 클라이언트 글자 미수용·소유자 404·idx 범위 ⓒ `compare.ts settle` — 조각 이어 붙이기 = 원문 불변식, 정오·저장 무영향 ⓓ 엔진명 비노출(문구·DOM) ⓔ 6층: 컴포넌트는 `@/modules/speech/tts/client` 타입만 import(기존과 같음), `preferences` import 없음.

## 작업 기록

### 2026-09-30 Leader — 착수
- Q10 "모든 단계" 반영. A4 v8 은 운영 레슨 생성에 영향을 주므로 배포 전 운영 스모크(010 65/65)와 롤백 기준을 QA 가 확인한다.

## 최종 요약 (Leader)

## Codex 검토

### 2026-10-01 13:32 C2 adversarial-review focus=security — done
- judge 판정: §67 codex_gate/C2 engine=jev (2026-10-01 13:25) / 호출 차수: 1/4
- 대상: repo=/home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa base=055dbcf(task_file) snapshot=f7af49f0
- 지적 **0건** — Codex 보안 집중 검토 결과 구체적으로 재현 가능한 보안 결함 발견 없음
  - 오디오 API: 사용자·레슨 소유자 결속·클라이언트 임의 텍스트 거부·요청 크기·키·인덱스·호출 빈도 제한·서명 URL HMAC 결속 확인
  - LLM 산출(promptKo): React 텍스트 노드만·TTS 입력이나 경로·HTML 사용 경로 없음·신규 TTS 입력에 사용되지 않음
  - 구버전(promptKo null): 안전한 폴백 유지
- 검토하지 못한 범위: 
  - task-025 허용 범위 밖의 동일 커밋 구간 변경 (task-010b·010c·010d·011·012·021·023 등)
  - 운영 Prompt Registry의 실제 ACTIVE 버전과 prompts:sync 실행 결과 (배포 후 확인)
  - 운영 환경의 다중 프로세스 rate-limit 실효성 및 라이브 TTS 스모크 (배포 후 운영)
- 원본: /home/brownjeon/NFS/homes/brownjeon/project/.claude/state/codex-review/runs/20261001T043232Z-task-025-C2/raw.txt

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge: delta (DM-low-confidence) | 09-30 22:14 |
| v1 | 검토요청 | docs/demo/task-025-improve-today-lesson-v1.html | https://claude.ai/artifact/F9ZREEMa89dVx6FJLrH8ih | 사용자 검토 요청 | 09-30 22:39 |
| v1 | 승인 | docs/demo/task-025-improve-today-lesson-v1.html | https://claude.ai/artifact/F9ZREEMa89dVx6FJLrH8ih | "대기 중인 데모 전부 권고안대로 승인" | 10-01 08:17 |

## Reviewer 기록 (오늘의 회화 화면)

### REV-052 — task-025 구현 독립 감사 (2026-10-01, Read 전용)

- **판정: PASS** (Critical 0 · High 0 · Medium 2 · Low 4). 7영역 전부 검토. 코드·공유 트리·공유 미러·`.env`·DB·운영은 건드리지 않았다. 실행은 격리 미러 `~/.node-local/thekaiwa-rev-025`(node_modules 는 공유 미러 심볼릭 링크)에서만 했다.
- **데모 게이트**: `node ../.claude/tools/demo-gate/check.mjs check --task <task.md>` → `DEMO_GATE_PASSED` / `task: task-025` / `status: approved` / `approved_version: v1` / `hash: verified`. 필요조건 통과. `evidence.jsonl` 의 승인 줄(task-025·v1·세션 f3fdf531)은 사용자 프롬프트("대기 중인 데모 전부 권고안대로 승인", 10-01 08:17)에서 훅이 기록한 것이고, 에이전트가 `approve`·`waive` 를 실행했거나 `.claude/state/demo-gate/` 를 직접 쓴 흔적은 events 에 없다.
- **데모 v1 대비 구현 차이 분류**: material 0 · defect 0 · implementation 전부. 정보구조·문구 의미·네비게이션·CTA 동작·단계 구성·크기 우선순위가 승인본과 같다(결정 a·b·c·d=A, e=B 반영). 개발자가 보고한 "모르겠어요"/200자 초과 시 옛 안내 유지는 디자이너 기록(§l4-skip 설명)과 일치하므로 implementation 으로 허용한다(데모 HTML 의 L772~773 은 `d` 가 null 일 때도 새 안내를 보이는 모순이 있으나 같은 데모의 설명과 어긋나는 쪽이 데모 쪽이라 구현이 정답이다). 구두점 집합이 데모 `PUNCT` 보다 넓은 `\p{P}` 인 것도 렌더링·내부 구현 차이다. 데모 v2 재승인 요청 불필요.

#### 개발자 지정 고위험 4건 검증

| # | 항목 | 결과 | 근거 |
|---|---|---|---|
| 1 | 줄·표현 다시 듣기에 완료 콜백·진행 저장·StudyLog·StatsSnapshot 없음 | 이상 없음 | `logic.ts` `playLineReplay`·`playExpr` 는 `pb.playLines(key, [...])` 만 호출(onComplete 인자 없음) → `useLessonPlayback.ts` L155 `fn: onComplete ?? null`. 진행을 쓰는 곳은 구간 `play()` 의 `st.update(withPlayed)`(키 `seg:{k}:{pace}`) 하나뿐이고 복습 중에는 건너뛴다. 재생 시작 시 `breakPending()`(L140)이 직전 구간의 완료를 무효화해 구간 재생 중 줄 다시 듣기를 눌러도 진행이 쓰이지 않는다. 숨김 줄에도 버튼이 있지만 textOnly 에서는 숨김. |
| 2 | `chunk` 오디오 경로 | 이상 없음 | 라우트: `requireSession()` → `rateLimit('tts:'+userId,60)`(#23 과 공유) → `parseAudioBody(readJsonObject(req,2KB))` → `getLessonAudioSource(userId,id,body)`. 클라이언트 `text` 키는 `onlyKeys(['kind','idx','pace'])` 로 400 `unknown_key`; `idx` 정수 0..20 검증 + `content.chunks[idx]` 범위 검사(없으면 400 `out_of_range`); 문장은 `prisma.lesson.findFirst({where:{id,userId}})`(타인 404)로 얻은 소유자 레슨 본문의 `chunks[idx].textJa` 에서 서버가 고른다. 합성은 `synthesizeLessonClips` → `synthesizeSentence`(contextMode `LESSON_READ`, scope lessonId·topicId, LEARNING_SLOW/NORMAL) → 12요소 캐시 키·레슨 범위 발음 사전 동일. 응답은 서명 URL(#24)뿐, 엔진명·캐시 키 없음. |
| 3 | `compare.ts` 표시 전용 | 이상 없음 | 세그먼트를 이어 붙이면 원문이 그대로 복원되는 불변식 테스트(11건 통과). 정오 판정·저장 코드(`StageApply` 의 `saved`·제출 경로)는 변경 없음, 비교는 렌더링 시점 파생값. 빈 값·200 코드포인트 초과는 `none`(옛 안내 유지), "모르겠어요" 는 `d` 없음으로 옛 안내. `<mark>` 는 React 텍스트 노드(`dangerouslySetInnerHTML` 없음 → XSS 안전). 색 외 신호(굵기·점선/실선 밑줄)와 `SrList` 로 접근성 확보. |
| 4 | 엔진명 비노출·6층 | 이상 없음 | `reazon|whisper|style-bert|claude` 를 `src/components/lesson`·`src/app/(app)/study/today` 에서 grep → 0건. components 가 `@/modules/*/client` 외 import 없음, preferences·engine import 없음. `lessonCopy.ts` U1~U4 문구에 엔진명·model_id 없음. |

#### 추가 확인

- **구버전 레슨(promptKo 비어 있음)**: `StoredQuizItem.promptKo: string | null` 유지, `quizPromptView(q)` 가 null/공백이면 `U3.legacyPrompt` + ⓘ 안내로 폴백, 결과 목록은 `quizSummaryPrompt`. 새 레슨(lesson@v8)은 항상 한국어 질문(굵게 16px) → 일본어 문장(17px) 순.
- **빈칸형 promptKo 정답 비노출((e)=B)**: `lesson.ts` 의 "빈칸형은 할 일만" 규칙 + `checks.ts` 재시도 안내문. 화면은 promptKo 를 그대로 보일 뿐 뒤집거나 정답을 덧붙이지 않는다. 한계: 이 규칙은 LLM 준수 의존이라 서버가 정답 노출을 검사하지는 못한다(M1 참조 — 실측 n=2).
- **360/390/412px**: 줄 행 `grid-cols-[26px_minmax(0,1fr)_44px]`, 다시 듣기 버튼 44px 히트 영역(32px 원), 표현 칩 전체가 버튼 `min-h-11`, `min-w-0` 유지 → 코드상 가로 스크롤 유발 요소 없음. 실기기·3폭 렌더는 QA 영역.
- **접근성**: 버튼 aria-label(재생/정지/받는 중), 칩 `sr-only` 라벨, 스피너·정지 상태 구분.
- **프롬프트 쪽(2차 범위, 계약 일관성만)**: `schemas.ts` `promptKo {minLength 1,maxLength 160}`·`LessonQuizItem.promptKo: string`, `checks.ts` 한글 포함 검사는 A4 마지막 시도(`tolerateContentMismatch`)에서만 면제, `lesson@v8`·`reviewMix@v2` 버전 상승, 재시도 안내문 존재. 계약은 일관.
- **7영역**: 아키텍처(6층·API 계약·네임스페이스) 이상 없음 / 유지보수성(재구현 없음, `compare.ts` 단일 모듈) 이상 없음 / 안정성(재생 완료 판정 `breakPending`·`observe`, 트랜잭션 변경 없음) 이상 없음 / 운영성(RequestTrace refType `lessonAudio`, Secret 없음) 이상 없음 / 성능(조각 ≤4, 캐시 재사용, N+1 없음) 이상 없음 / 보안(소유자·rate limit·화이트리스트 키·서명 URL) 이상 없음 / 학습 원칙(재생·비교는 StudyLog·StatsSnapshot 비생성, Correction.original 무수정) 이상 없음.

#### 격리 미러 실행 결과

- `tsc --noEmit` 0 오류, `eslint` 0 오류, 단위 테스트 1075건 중 1건 실패(아래).
- 실패 1건 = `src/components/common/__tests__/brand.test.ts` 3번째 케이스(`android/app/build.gradle` 의 `def kaiwaVersionCode = 2\b` 하드코딩 기대). 공유 트리의 task-021(미커밋)이 `kaiwaVersionCode = 3`/`1.0.2` 로 올렸기 때문이며 task-025 코드와 무관하다 — 개발자 귀속(1056/1058) 확인. (2번째 케이스는 내 미러에 `public/manifest.webmanifest` 가 없는 산물이라 무관.) task-025 신규 테스트(components 11 + modules 2 + reviewMix@v2) 전부 통과.

#### 이슈

```json
{
  "reviewId": "REV-052",
  "status": "PASS",
  "issues": [
    {
      "issue": "A5 reviewMix 가 신규 promptKo 한글 검사를 마지막 시도 완화 없이 항상 엄격 적용 — 생성 통과율 미실측",
      "severity": "MEDIUM",
      "component": "src/modules/conversation/prompts/reviewMix.ts:extraCheck → structuredResponse/checks.ts:checkLessonResponse",
      "risk": "운영 010b 복습 믹스 경로에서 필수 promptKo(한글 포함) 위반이 재시도 후에도 실패하면 레슨 생성 실패(사용자 가시)로 이어질 수 있고, 새 규칙 도입 직후라 통과율 수치가 없다.",
      "evidence": "reviewMix.ts 의 extraCheck 는 info/tolerateContentMismatch 없이 checkLessonResponse({allowedChunkIds}, data) 호출(A4 와 달리 마지막 시도 면제 없음). 개발자·PE 기록상 (e)=B 라이브 A/B 는 n=2(429 로 중단), 롤백 기준은 '판정 불가'.",
      "recommendation": "배포 전 운영 스모크 010(65/65)에서 reviewMix 생성 1~2회 포함 확인 + 실패 시 즉시 롤백 기준(경로 실패율)을 task 기록에 수치로 명시. 필요하면 reviewMix 도 마지막 시도 완화 도입을 prompt-engineer 와 협의."
    },
    {
      "issue": "배포 전제 미완료 — 프롬프트 sync 와 CONSOLE ACTIVE 충돌 확인",
      "severity": "MEDIUM",
      "component": "src/modules/conversation/prompts/lesson.ts(lesson@v8), reviewMix.ts(reviewMix@v2)",
      "risk": "prompts:sync 가 없으면 운영은 lesson@v7 으로 남고 새 화면은 promptKo 폴백만 보인다. CONSOLE 이 ACTIVE 로 덮어쓰고 있으면 v8 이 적용되지 않거나 반대로 의도치 않게 교체된다.",
      "evidence": "PE 기록에 prompts:sync·ACTIVE 충돌 확인이 미완료 항목으로 남아 있음. 코드는 v8·v2 로 상승했으나 DB 의 활성 버전 확인 흔적 없음.",
      "recommendation": "deployer 가 배포 시 prompts:sync 실행 후 Console 에서 lesson·reviewMix 활성 버전을 확인하고 task 에 기록."
    },
    {
      "issue": "작업 트리에 task-021·011·012·023·평가 프롬프트의 미커밋 변경이 섞여 025 커밋 경계가 불분명",
      "severity": "LOW",
      "component": "git status (android/app/build.gradle, capacitor.config.ts, MainActivity.java, docs/design/api-contract.md, docs/screens.md 등)",
      "risk": "025 만 커밋·배포하려 할 때 타 task 변경(특히 네이티브 versionCode 3)이 함께 나가거나 누락되어 고지 의무(native_change)가 흐려질 수 있다.",
      "evidence": "git status 의 M 목록에 task-021 네이티브 파일과 011·012·023 파일 포함. api-contract·screens 의 diff 도 여러 task 합산.",
      "recommendation": "Leader 가 025 커밋 파일 목록을 명시적으로 지정(git add 개별 파일). 네이티브 변경은 021 소유."
    },
    {
      "issue": "brand.test.ts 가 versionCode 2 를 하드코딩해 task-021 변경 이후 빨강",
      "severity": "LOW",
      "component": "src/components/common/__tests__/brand.test.ts:(versionCode 정규식 `def kaiwaVersionCode = 2\\b`)",
      "risk": "025 와 무관하지만 통합 배포 전 단위 테스트 1건이 실패 상태로 남아 CI·QA 신호를 흐린다.",
      "evidence": "격리 미러 재현: build.gradle 은 `def kaiwaVersionCode = 3 // 1.0.2 — task-021`, 테스트는 2 기대.",
      "recommendation": "task-021 소유자가 커밋 전 brand.test.ts 를 갱신(025 범위 아님)."
    },
    {
      "issue": "빈칸형 결과 목록에서 한국어 지시문만 보이고 일본어 문장이 없을 수 있음",
      "severity": "LOW",
      "component": "src/components/lesson/logic.ts:quizSummaryPrompt, StageQuiz.tsx 결과 목록",
      "risk": "정답 비노출 설계의 부수 효과로 결과 화면에서 어떤 빈칸 문제였는지 구분이 약해질 수 있다(정확성 영향 없음).",
      "evidence": "e=B 규칙상 blank 유형 promptKo 는 '할 일만' 서술. 결과 목록은 quizSummaryPrompt 가 promptKo 를 우선 사용.",
      "recommendation": "QA 가 blank 유형 결과 화면을 육안 확인. 문제 없으면 종결."
    },
    {
      "issue": "chunk 오디오에서 선두 '〜' 가 정규화기에 의해 제거됨",
      "severity": "LOW",
      "component": "src/modules/learning/lessons/content.ts:audioText(chunk) → speech/tts 정규화",
      "risk": "'〜を' 같은 표현 조각은 선두 기호가 낭독에서 빠진다(의미 영향 없음, 개발자 공개 사항).",
      "evidence": "Developer 기록에 공개된 알려진 한계.",
      "recommendation": "조치 불필요. 실기기 청취 시 어색하면 별도 개선작업(IMP)으로."
    }
  ],
  "summary": { "critical": 0, "high": 0, "medium": 2, "low": 4 },
  "high_risk_areas": [
    "줄 다시 듣기·표현 소리가 진행·StudyLog·StatsSnapshot 행을 만들지 않는지(재생 전후 DB 행 수 대조, 구간 재생 중 줄 재생 포함)",
    "POST /api/v1/lessons/:id/audio kind=chunk — 타인 레슨 404, idx 범위·타입 400, text 키 400 unknown_key, 분당 60 초과 429, 응답에 엔진명 없음",
    "새 레슨(lesson@v8) promptKo 한국어 표기·빈칸형 정답 비노출((e)=B), 구버전 레슨(promptKo null) 폴백",
    "A5 reviewMix 생성 1~2회 운영 스모크(010 65/65)와 prompts:sync·CONSOLE ACTIVE 충돌 확인",
    "360/390/412px 이해·문법·퀴즈·응용 4단계 44px 터치·가로 스크롤 0, 숨김 줄 버튼, textOnly 모드",
    "응용 글자 비교 — 200자 초과·빈 값·'모르겠어요'·구두점·공백 혼합 입력, 저장·정오 판정 불변",
    "커밋 경계(021 네이티브 versionCode 3·brand.test.ts 갱신)"
  ],
  "native_change": false
}
```

- native_change 는 task-025 자체로는 false. 작업 트리의 task-021 네이티브 변경(versionCode 3 / 1.0.2)은 021 소유이며 고지는 021 쪽에서 한다.
- 에스컬레이션 조건(Critical ≥1 · High ≥3 · 네이티브 미고지) 해당 없음. QA 진행 가능, Medium 2건은 배포 전 조건으로 Leader·deployer 에 전달.

## Reviewer 기록 (025 (e)=B 프롬프트 수정 재감사, REV-060)

> 범위: PE 의 A4 `lesson@v8`(같은 v8, 지시문 한 줄 변경) · A5 `reviewMix@v2` 정렬 · `checks.ts` 재시도 안내 문구 · 예산 회귀 테스트 · `tests/live/lesson-promptko-measure.ts`. 프롬프트 전용 변경이라 화면 파일·데모 게이트 재실행 대상 아님(REV-052 DEMO_GATE_PASSED 유지). 다만 승인 데모 v1(`docs/demo/task-025-improve-today-lesson-v1.html` `QZ_NEW`)과의 동작 비교는 Q1 에서 했다.
> 방법: 읽기 전용 + 격리 미러(`~/.node-local/thekaiwa-rev-025`)에서만 단위 테스트·변이. **라이브 LLM 호출 0회**(QA 가 같은 구독 쿼터 사용 중) — PE 측정치는 "재현하지 않음"으로 인용. 공유 작업 트리에 git 되돌림 명령 0회, 소스 수정 0건, 미러 임시 파일 삭제 완료.

### 판정: **PASS (Medium 3 · Low 5 — Critical 0 · High 0)**

REV-052 이후 지시문 이탈 1건은 **배포 차단 사유가 아니다.** 단 Medium 3건은 Leader 가 아래 "배포 전 조건"으로 인지·수용을 task 에 남겨야 한다.

```json
{
  "reviewId": "REV-060",
  "status": "PASS",
  "issues": [
    {"severity":"MEDIUM","component":"src/modules/conversation/prompts/lesson.ts:255 · prompts/reviewMix.ts:101","issue":"번역형(한국어 문장→일본어 고르기) 문제의 promptKo 규칙이 지시문에 없다 — 일본어는 promptJa 에만·정답 뜻은 미리 쓰지 않는다만 남아 허용도 금지도 아니다(PE 의 의도적 이탈이 Leader 사양 '번역형·뜻/형태형 지시는 그대로' 와 어긋남)","risk":"승인 데모 v1 QZ_NEW q1·q5 의 번역형 동작이 모델 즉흥에 맡겨진다","evidence":"PE e7 최종 표본 90문항 중 번역형 성격 3건('주문했어요' 해당 표현·'주문했다'라는 뜻의 일본어·'기대됩니다'라는 뜻의 표현)은 한국어 단어를 지시문에 인용해 처리 — 한국어 문장 전체형 0건. 테스트가 이 줄을 고정하지 않음","recommendation":"Leader 가 '의도적 이탈' 수용을 task 에 명시하거나, 예산 여유(10자) 안에서 한 구절 복원(예: '한국어 문장을 일본어로 고르는 문제는 그 한국어 문장을 씁니다'는 +20자 내외라 CAP 초과 — 다른 군더더기를 줄여 상쇄)"},
    {"severity":"MEDIUM","component":"src/modules/conversation/structuredResponse/checks.ts:230 · src/components/lesson/logic.ts:225,232 · src/components/lesson/StageQuiz.tsx:150","issue":"마지막 시도 완화로 일본어-only promptKo 가 저장될 수 있는 잔여 위험","risk":"화면은 비어 있지 않은 promptKo 를 '한국어 질문(굵게)'으로 그대로 그리고(StageQuiz.tsx:150 lang=ja 없음) promptJa 와 중복·빈칸형 정답 노출 가능","evidence":"quizPromptView 는 ko 가 비었을 때만 legacy 폴백(logic.ts:225-228), 한글 유무는 보지 않음. 마지막 시도 로그가 ④·한글 위반을 한 숫자로 합침(lesson.ts:349). PE 측정: 최종 문구 18회 중 0건(재현하지 않음)","recommendation":"배포 차단 아님. 후속 Developer 코드(별도 task): hangul 인지 폴백(일본어-only 면 공통 안내 줄, '예전에 만든 수업' 문구 제외) + 마지막 시도 로그 카운터 분리"},
    {"severity":"MEDIUM","component":"src/modules/conversation/prompts/reviewMix.ts:101 (extraCheck 완화 없음)","issue":"A5 reviewMix@v2 는 라이브 측정 0회이고 strict(마지막 시도 완화 없음) — REV-052 Medium 1 지속","risk":"복습 세션 생성 실패율이 A4 보다 높을 수 있음(한글 없는 promptKo 하나로 전체 실패)","evidence":"PE 이력서 [14:21] 측정은 A4 만. reviewMix.test.ts 는 문구 존재만 검증","recommendation":"배포 후 QA 운영 스모크에서 A5 생성 1~2회(PE 인계와 일치) 확인, 실패율 높으면 A5 도 마지막 시도 완화 검토"},
    {"severity":"LOW","component":"src/modules/conversation/__tests__/lesson.test.ts:194-218 · prompts/lesson.ts:117-118","issue":"예산 회귀 테스트가 진짜 최악 조합이 아님 + CAP 주석 8,418자는 낡음","evidence":"테스트 학습자(displayName 30·teacherName 10·header 567) 기준 9,490(여유 10자). 실제 DB 한도(displayName 40·teacherName 30)와 goal 로 header 600 을 채우면 주제 경로 9,523 = CAP +23(미러에서 계산). CAP 은 설계 예산이며 런타임 강제 없음, 엔진 JSON_ONLY·페르소나·재시도 접미는 측정 제외","recommendation":"테스트 학습자를 실제 한도 최대로 올리거나 CAP 문구를 '정상~준최악 상한'으로 정정, 주석 수치 갱신"},
    {"severity":"LOW","component":"src/modules/conversation/__tests__/reviewMix.test.ts:45-55","issue":"A5 일반 문장 '정답이 되는 뜻은 미리 쓰지 않습니다'가 테스트로 보호되지 않음","evidence":"미러 변이 M6(해당 구절 삭제) 생존","recommendation":"reviewMix 테스트에 해당 구절 단언 추가(A4 쪽은 이미 보호)"},
    {"severity":"LOW","component":"tests/live/lesson-promptko-measure.ts:44","issue":"기본 --out 이 /tmp 고정","evidence":"형제 스크립트(lesson-paste-diagnose.ts:147 등)와 같은 관행. Secret·절대 홈 경로·DB 접근·실사용자 행 접근 없음(합성 학습자·픽스처, engine llm 은 trace 를 DB 에 쓰지 않음)","recommendation":"커밋 안전. 필요 시 --out 필수화는 선택"},
    {"severity":"LOW","component":"src/modules/conversation/prompts/lesson.ts:255 · __tests__/lesson.test.ts:80,reviewMix.test.ts:138","issue":"promptKo 안에 일본어 따옴표 인용을 지시문은 '일본어 문장은 promptJa 에만'으로 막지만 검사는 한글 유무만 본다","evidence":"PE e7 표본 1/90('밑줄 친 표현과 바꿔 쓸 수 있는 말을 고르세요: '旅行について話しました''), 테스트 픽스처도 「…」의 뜻은? 형태","recommendation":"허용하려면 지시문 문구 보정, 아니면 현행 유지 — 기능 영향 없음"},
    {"severity":"LOW","component":"src/modules/conversation/prompts/lesson.ts:349","issue":"마지막 시도 로그의 위반 건수가 ④와 한글 검사를 합산","evidence":"문구 '콘텐츠 매칭(④)·quiz.promptKo 한글 검사 위반 N건' 단일 숫자","recommendation":"카운터 분리(위 Medium 2 후속과 동일 task)"}
  ],
  "summary": {"critical": 0, "high": 0, "medium": 3, "low": 5},
  "high_risk_areas": [
    "새 lesson@v8 quiz.promptKo 4유형(뜻 고르기·빈칸·밑줄·번역형) 육안 점검 — 360/390/412px, 빈칸형 정답 비노출",
    "promptKo 가 일본어뿐인 문항이 저장되는지(굵은 '질문' 줄에 일본어 문장) — 마지막 시도 완화 경로",
    "A5 reviewMix 라이브 1~2회 생성(성공·재시도 횟수·실패율) — 운영 스모크 010 65/65 와 함께",
    "lesson@v8 생성 실패율·attempts=2 비율(운영 로그 [lesson] 마지막 시도 줄)",
    "구버전 레슨(promptKo null) 폴백·'예전에 만든 수업' 문구 유지"
  ],
  "native_change": false
}
```

### 항목별 결과 (Q1~Q8)

| # | 질문 | 결과 | 근거 |
|---|---|---|---|
| 1 | 지시문 이탈이 Q10·데모 v1 과 맞는가 | **Medium** — 위반은 아니나 번역형 규칙 공백 | 아래 유형별 표 |
| 2 | 재시도 안내(checks.ts) | **OK** — 로직 무변경 | `checks.ts:229-233` 조건식 `!ctx.tolerateContentMismatch && !hasHangul(q.promptKo)` 그대로, 마지막 시도 완화 범위 불변(`:241` ④ 건너뜀, `lesson.ts:341-345`). 예시가 "문장의 뜻을 고르세요."·"빈칸에 들어갈 알맞은 말을 고르세요." — 번역을 부추기지 않음("정답의 뜻은 쓰지 않는다" 명시). A5 는 완화 없음(strict) — PE 인계와 일치 |
| 3 | A5 정렬 | **OK**(Medium 3 은 별도) | `reviewMix.ts:101` 같은 규칙, `chunks ⊆ mixSpec` 검사 무변경, `LESSON_CHUNKS_MIN = 4`(schemas.ts:264) 무변경, 읽기 지시 악화 없음. 미러 reviewMix 14/14 |
| 4 | 예산 회귀 테스트 | **Low** | 통과(미러 lesson 59/59). 진짜 최악(실제 DB 한도) 9,523 > 9,500 — 테스트 학습자가 극단이 아니라 통과. 한 글자(여유 10자 초과 +11자)면 테스트가 크게 깨짐을 확인. CAP 은 설계 예산·런타임 강제 없음 |
| 5 | 테스트 정확도(변이) | **PASS(1건 생존)** | 변이 7종(미러 한정, 모두 NFS 에서 `cmp` 로 원복 확인): M1~M5·M7b·M7c 검출, **M6 생존**(reviewMix 일반 문장 삭제). M7 은 첫 치환이 주석(lesson.ts:97)이라 `rfind` 로 M7b 재수행. 번역 허용 구절 삭제류(M7b)는 예산·문구 단언에만 걸리고 의도 단언은 없음 |
| 6 | 마지막 시도 잔여 위험 | **Medium, 배포 차단 아님** | 위 JSON Medium 2. 후속은 **Developer 코드**(문서화만으로 불충분) |
| 7 | 기타 회귀 | **OK** | 프롬프트·힌트 문구에 엔진·모델명 신규 0(`lesson.ts:3`·`checks.ts:45` 는 기존/타 task 주석). 엔진이 JSON_ONLY 지시를 덧붙이는 구조 불변, 6층 경계 위반 없음(변경 4파일 모두 conversation 층 내부). 측정 스크립트: Secret 0·절대 홈 경로 0·DB 접근 0·`/tmp` 기본값은 형제 스크립트와 동일 관행 → **커밋 안전**. tsc 해당 파일 0 오류 |
| 8 | 배포 영향 | **OK** | `PromptVersion` 로더 코드 없음(스키마·seed 키 예약만) → `prompts:sync` SOURCE_CODE/CONSOLE 충돌은 **현재 해당 없음**(010c REV-058 "PromptVersion 0행"과 같은 결론). Registry 로더 도입·CONSOLE ACTIVE 행 생성 시 A4/A5 재확인. 4파일(schemas.ts·lesson.ts·checks.ts·reviewMix.ts) 롤백 가능: v8 로 저장된 레슨은 v7 코드에서도 읽힘(`StoredQuizItem.promptKo: string \| null`). 현재 전부 미커밋 — 커밋 뒤에는 `git revert`, 테스트 2종도 함께 되돌릴 것. task-024 의 checks.ts·schemas.ts 주석 전용 헝크도 같이 되돌려지나 무해 |

### Q1 유형별 표 (승인 데모 v1 대비)

| 유형 | promptKo (새 지시문) | promptJa | 데모 v1 대비 | 판정 |
|---|---|---|---|---|
| 뜻 고르기(일본어 문장→한국어 뜻) | "문장의 뜻을 고르세요." 류 한국어 지시 | 일본어 문장 | 데모 QZ_NEW q2~q4 는 한국어 질문(굵게)+일본어 문장 — 일치 | OK |
| 빈칸 | "빈칸에 들어갈 알맞은 말을 고르세요."(할 일만) | `＿＿` 로 비운 문장 | (e)=B 사용자 승인대로 | OK — PE e7 표본 43건 전부 이 형태(내 재분류 동일, 재현 아님) |
| 밑줄(의미·바꿔 쓰기) | "밑줄 친 부분의 뜻으로…" 류 | 일본어 문장 | 일치 | OK(Low: 표본 1/90 에서 일본어 따옴표 인용) |
| 번역형(한국어 문장→일본어 고르기) | **규칙 없음**(허용도 금지도 아님) | null | 데모 QZ_NEW q1·q5 는 한국어 문장이 질문 — 동작은 데모와 같이 나와야 함 | **미정의(Medium)** — 모델이 한국어 단어를 지시문에 인용해 즉흥 처리(3/90), 한국어 문장 전체형은 표본 0 |

의도 이탈 분류: Q10("모든 학습 단계 퀴즈 문제 문장에 한국어")은 **충족**(promptKo 필수·한글 검사 유지). 번역형 줄은 **implementation(허용) + 문구 보강 권고** 로 보며 material(재승인)은 아니다 — 승인 화면(굵은 한국어 질문 위 일본어 문장·보기)은 지시문 문구와 무관하게 `StageQuiz.tsx:150-155` 가 그리기 때문이다. 단 PE 가 Leader 사양을 스스로 바꾼 이력이므로 Leader 가 이 이탈을 task 에 기록해야 한다.

### 배포 전 조건 (Leader·deployer)
1. Medium 1(번역형 공백): Leader 가 "수용" 한 줄을 남기거나 PE 에 문구 복원 지시(예산 +20자 내외는 CAP 초과이므로 다른 군더더기 삭감 필요). 둘 다 배포 차단은 아님.
2. Medium 2(일본어-only 저장 잔여): 후속 Developer task 등록(hangul 인지 폴백·로그 카운터 분리). 배포 후 QA 가 육안 점검.
3. Medium 3(A5 미측정): 운영 배포 직후 A5 생성 1~2회 스모크, 실패율을 PE 에 회신.

### QA 전달
- `high_risk_areas` 는 위 JSON. 운영 스모크: 새 레슨 4유형 육안·빈칸형 정답 비노출·일본어-only promptKo 폴백·A5 라이브 1~2회·`lesson@v8` 마지막 시도 로그 빈도.
- 사용자 실기기 항목: 360/390/412px 에서 새 레슨 ③ 문제 머리(굵은 한국어 질문 → 일본어 문장)가 한 줄 안에 읽히는지, 빈칸형 문제에서 정답이 한국어로 노출되지 않는지, 구버전 레슨 "예전에 만든 수업" 문구 유지.
- QA 금기 재강조: 공유 작업 트리에 `git checkout/restore/reset/stash/clean` 금지(PE 수정 소실 이력).

### 남은 위험
- A5 라이브 미측정(Medium 3)·마지막 시도 완화 경로(Medium 2)는 운영에서만 실측 가능. PE 측정(A4 18회 중 일본어-only 저장 0건)은 이번 감사에서 **재현하지 않았다**.
- 예산 CAP 은 런타임 강제가 없다 — 학습자 이름·목표가 극단이면 9,523 자까지 나가지만 120s 배치 잡이라 5초 예산과 무관.
- 에스컬레이션 조건(Critical ≥1 · High ≥3 · 네이티브 미고지) 해당 없음. QA 진행 가능.

## Leader 기록 (REV-060 판단, 2026-10-01 15:05)

REV-060 PASS(Critical 0·High 0·Medium 3·Low 5) 에 대한 Leader 판단:
- **Medium 1(번역형 promptKo 규칙 공백) — 수용(implementation 이탈).** PE 의 "번역형·뜻/형태형 지시는 그대로" 사양 이탈을 인지·수용한다. 근거: 승인 화면(굵은 한국어 질문 + 일본어 문장·보기)은 지시문 문구가 아니라 `StageQuiz.tsx:150-155` 가 그리며, 표본 90 중 번역형 성격 3건도 한국어 단어를 지시문에 인용해 정상 처리됐다. 데모 재승인 대상 아님. QA 육안 점검(번역형 q1·q5)으로 확인한다.
- **Medium 2(마지막 시도 완화로 일본어-only promptKo 저장 가능) — 후속 Developer 작업으로 등록(`task-025b`, 배포 비차단).** 내용: `quizPromptView` 한글 인지 폴백(일본어-only 면 공통 안내 줄로 대체)·`lesson.ts:349` 로그 카운터 분리(④/한글 검사). 근거: PE 측정 최종 문구 18회 중 0건·마지막 시도 완화는 실패 레슨(FAILED) 회피용 안전판. 배포 후 `[lesson]` 마지막 시도 로그 빈도와 QA 육안 점검으로 모니터링하며, 실제로 노출되면 우선순위를 올린다.
- **Medium 3(A5 라이브 미측정) — QA 에서 A5 라이브 1~2회 + 운영 스모크로 실측.** 실패율이 높으면 PE 가 A5 마지막 시도 완화를 검토.
- **Low 5건 중 테스트 보강(예산 테스트 현실화·CAP 주석·A5 일반 문장 단언)은 PE 에게 테스트·주석 전용으로 지시**(프롬프트 문구 무변경 — 측정 유효성 유지). 나머지 Low(측정 스크립트 --out 기본값·일본어 인용 1/90)는 유지.
- 다음: Judge C2(025 재감사 범위) → 010c QA 종료 후 025 QA(구독 쿼터·QA 계정 공유로 직렬).

## Judge 기록 (C2 — REV-060 이후, 2026-10-01)

engine: jev | fallback: -
결정: codex_required=true / mode=adversarial-review / focus=design_assumption / budget_rule=CX-limit-unknown-r2 / codex_switch=on
규칙 덮어쓰기: CX-r2-post-review

```json
{
  "schema": "judge-result@2",
  "engine": "jev",
  "kind": "codex_gate",
  "checkpoint": "C2",
  "task_id": "task-025",
  "project": "TheKaiwa",
  "spec_version": "dev-judge@0.2.0",
  "rules_version": "dev-rules@0.4.0",
  "model": "jev-1.13.0",
  "decision": {
    "codex_required": true,
    "wanted_before_budget": true,
    "mode": "adversarial-review",
    "focus": "design_assumption",
    "budget_rule": "CX-limit-unknown-r2",
    "codex_calls_used": 1,
    "codex_switch": "on"
  },
  "signals": {
    "codex_calls_used": 1,
    "focus": {
      "choice": "design_assumption",
      "confidence": 0.69
    },
    "high_risk_change": {
      "noul": 0.08
    },
    "reviewer_doubt": {
      "noul": 0.47
    }
  },
  "rule_overrides": [
    {
      "field": "codex_required",
      "value": true,
      "rule_id": "CX-r2-post-review"
    }
  ],
  "fallback": null,
  "input_tokens": 1010,
  "cost_usd": 0.000042,
  "latency_ms": 288
}
```

## Prompt-Engineer 기록 (REV-060 Low 후속, 2026-10-01)

> 범위: REV-060 Low 3건(예산 테스트 현실화·CAP 주석 정정·A5 일반 문장 단언) — **테스트·주석 전용**. 프롬프트 지시문 텍스트·`LESSON_USER_PROMPT_CAP`(9,500) 값·소스 로직 무변경(직전 18~90문항 라이브 측정 유효). 라이브 LLM 호출 0회. 공유 작업 트리 되돌림 git 명령 0회, commit 0회.

- [14:37] 변경 3파일: `src/modules/conversation/__tests__/lesson.test.ts`(예산 테스트 (a)/(b) 분리) · `src/modules/conversation/__tests__/reviewMix.test.ts`(A5 일반 문장 단언 1줄) · `src/modules/conversation/prompts/lesson.ts`(CAP 주석 113-121행만).
- [14:37] **1. 예산 테스트**: (a) 기존 두 테스트(주제·sourceText 경로)를 이름만 "정상~준최악 … ≤ LESSON_USER_PROMPT_CAP" 으로 정정(단언·입력 불변, 주제 경로 9,490자). (b) 신규 `예산 (b)` — 실제 DB 한도(displayName 40·teacherName 30)·헤더가 상한 600 에 정확히 닿도록 goal 길이를 테스트 안에서 보정(goal 350자)한 학습자의 주제 경로 길이를 계산해 `t.diagnostic` 로 출력하고 천장 `LESSON_REAL_LIMIT_WORST_CEILING = 9_540`(측정 9,523 + 여유 17)으로 단언, CAP(9,500) 초과 사실은 테스트 상단·JSDoc 주석으로 명시. 같은 학습자의 sourceText 경로(7,192자)는 ≤ CAP 로 단언. 함정: 헤더 렌더는 상한 초과 시 약점→복습→출석→목표 순으로 덜어 내므로 goal 이 길다고 최악이 아니다(goal 350 → 헤더 600·9,523자가 최대, goal ≥ 429 면 선택 칸이 전부 빠져 헤더 166·9,089자).
- [14:37] **2. CAP 주석**: 낡은 8,418/6,087/2,836자 서술을 현재 사실로 교체 — 설계 예산·런타임 강제 없음·정상~준최악 9,490·실제 한도 최악 9,523(CAP+23)·sourceText 7,192·정상 입력 4,055. **주석 외 변경 없음 확인**: 독립 사본 `~/.node-local/thekaiwa/src/modules/conversation/prompts/lesson.ts`(수정 전 상태)와 `diff` → 차이는 114-118행 주석 hunk 1개뿐(코드 줄 변경 0).
- [14:37] **3. A5 단언**: `reviewMix.test.ts` 의 (e)=B 테스트에 `quizLine.includes('정답이 되는 뜻은 미리 쓰지 않습니다')` 추가(A4 lesson.test.ts:436 의 짝).
- [14:37] **검증(미러 `~/.node-local/thekaiwa-rev-025`, 3파일만 cp)**: `node --import tsx --test lesson.test.ts reviewMix.test.ts` → **74 tests / pass 74 / fail 0**(수정 전 73 → 신규 (b) 1개 추가; lesson 60 + reviewMix 14). `tsc --noEmit` 전체 exit 0·오류 0건. (b) 출력: `실제 DB 한도 최대 학습자 주제 경로 최악 길이 9523자 (CAP 9500, 천장 9540)` · `sourceText 경로 최악 길이 7192자`.
- [14:37] **변이(미러 한정, 모두 NFS 와 `cmp` 로 원복 확인)**: M6(`reviewMix.ts` 의 "정답이 되는 뜻은 미리 쓰지 않습니다" 삭제) → reviewMix **13 pass / 1 fail**(`정답 뜻 일반 금지 문장 유지`) — 이제 검출됨, 원복 후 14/14. 천장 민감도: `lesson.ts` quiz 지시문 끝에 +17자 → (b) 9,540자 통과(경계)·(a) 실패, +18자 → (b) 9,541자 **실패**(+(a) 실패) — 지시문 증가가 (b) 에서 잡힌다. 최종 `cmp` 4파일(lesson.test·reviewMix.test·lesson.ts·reviewMix.ts) 미러==NFS 일치.
- [14:37] 후속 메모: (b) 천장·CAP 주석은 지시문을 의도적으로 늘리거나 줄일 때 함께 갱신(테스트 실패 메시지에 명시). 남은 Low(측정 스크립트 `--out` 기본값·일본어 따옴표 인용 1/90)는 Leader 판단대로 유지.

### 2026-10-01 14:39 C2 adversarial-review focus=design_assumption — done
- judge 판정: §395 judge 기록/C2 engine=jev (2026-10-01 13:25, CX-r2-post-review override) / 호출 차수: 2/4
- 대상: repo=/home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa base=055dbcf(task_file) snapshot=d15f01ff
- 지적 **0건** — Codex 설계 가정 적대적 검토 결과 Q1~Q3의 잔여 위험은 모두 REV-052·060의 기존 지적과 일치, 새로운 설계 가정 위반 없음
  - Q1(promptKo 필수·한글 검사 전제): 지시문·검사·폴백 세 부분의 정합성 → REV-060 Medium 1·2와 동일
  - Q2(유형별 정답 비노출 일관성): 빈칸·뜻 고르기·밑줄·번역형 유형 분리 → REV-060 Q1 표 기록과 일치
  - Q3(마지막 시도 완화 잔여 위험): 일본어-only promptKo 저장·화면 폴백 → REV-060 Medium 2와 동일
- 검토하지 못한 범위:
  - task-025 허용 범위 밖의 동일 커밋 구간 변경 (task-021·011·012·023 등 미커밋)
  - 운영 Prompt Registry의 실제 ACTIVE 버전과 prompts:sync 실행 결과 (배포 후 deployer)
  - 라이브 LLM 출력 품질·A5 reviewMix 생성 성공률 (배포 후 운영·QA)
  - 실기기 360/390/412px 렌더링·TTS 스모크·rate-limit 동작 (배포 후 운영·QA)
- 원본: /home/brownjeon/NFS/homes/brownjeon/project/.claude/state/codex-review/runs/20261001T053904Z-task-025-C2/raw.txt

## Leader 기록 (Codex C2 결과·PE 후속 확인, 2026-10-01 17:50)

- **Codex C2(호출 차수 2/4): 지적 0건**(Q1~Q3 설계 가정 새 위반 없음, 잔여 위험 = REV-060 Medium 3·Low 5 와 일치). 검토하지 못한 범위: 운영 Prompt Registry ACTIVE·`prompts:sync` 결과, 라이브 LLM 품질·A5 성공률, 실기기 렌더링·TTS·rate-limit → QA·배포 후 스모크에서 확인.
- **PE 후속(Low 3건) 직접 확인**: NFS↔미러 4파일 `cmp` 일치, `node --import tsx --test lesson.test.ts reviewMix.test.ts` **74/74 pass·0 fail**(Leader 직접 실행). 프롬프트 지시문 무변경.
- 상태: 구현·Reviewer(REV-052·REV-060)·Judge C2·Codex 완료 → **QA 대기**(구독 쿼터·QA 계정 공유로 010c QA 종료 후 직렬). 후속 `task-025b`(Hangul 인지 `quizPromptView` 폴백·로그 카운터 분리)는 배포 비차단 별도 작업.

## QA 시각 검증 (025 — 재현 조건)

데모 게이트: `check.mjs check --task task-025` → `DEMO_GATE_PASSED status: approved approved_version: v1 demo: docs/demo/task-025-improve-today-lesson-v1.html hash: verified`. 판정 기준은 데모 v1(`#l2`·`#l2-playing`·`#l3-new`·`#l3-old`·`#l3-sum` 등)의 **수치**(글자 크기·터치 44px·넘침 0)를 DOM 계산값으로 대조한 것이다. 픽셀 스크린샷 비교는 하지 않았다(스크린샷을 저장하지 않음).

| 항목 | 값 |
|---|---|
| 브라우저 | headless Google Chrome 147.0.7727.101 (`/usr/bin/google-chrome`) + playwright-core 1.58.2, 플래그 `--autoplay-policy=no-user-gesture-required` |
| viewport(폭x높이) | 360x780 · 360x892 · 390x780 · 390x892(대표) · 412x780 · 412x892. 경계 360·412 모두 실행 |
| deviceScaleFactor | 2.625 |
| 테마 | light 전 구간. dark 는 ② 문법 칩(IDLE/PLAY)·d10 S2 응용 비교 두 곳만 실측(390x780) |
| locale / timezone | ko-KR / Asia/Seoul |
| 글꼴·대기 | networkidle 후 500~700ms 대기. 페이지 로드 간 3.5초 간격(speech-config 30/min 한도 회피) |
| 애니메이션 | `reducedMotion: 'reduce'`, Next dev 오버레이 숨김 |
| 네트워크 fixture | 합성 READY 레슨 9건(직접 DB 시드, 정확한 id 로 삭제 완료) + 오디오 API 목(TEXT_ONLY·502·429·503 스텁)은 D5·D6·E12 UI 일부에만. 실 M4·실 Claude CLI 는 E12·E13 에서만 |
| 캡처 범위 | 스크린샷 없음. 상태별 DOM 실측(요소 rect·computed style·스크롤 크기·요청 로그·콘솔) |
| 허용 범위 | 가로 넘침 0(`right > clientWidth` 요소 0)·페이지 세로 스크롤 0·터치 타겟 ≥44px·글자 크기 정확 일치(질문 16px 굵게·일본어 17px)·콘솔 오류 0·엔진명 DOM 0 |

## QA 기록 (025 — REV-060 이후, 2026-10-03 09:23)

판정: **PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 0 · Low 1(기존 코드, 025 diff 밖) · 관찰 10. FAIL 없음이므로 Reviewer 재순환 불필요. 결함 0건이 아니므로(Low 1) deployer 자동 인계는 하지 않고 Leader 판단을 받는다.

### 1. 실행 환경

- 미러 `~/.node-local/thekaiwa-dev-010b`(NFS 대비 025 대상 24파일 `cmp` 전부 동일), dev 서버 3042 한 곳(PID 1212910, 종료 완료). 운영 3010·gateway 8100·3041·3043·타 미러 미접촉.
- 쓰기 계정은 qa-bot2 만(qa-bot 은 읽기·거부 확인용). 삭제는 정확한 id 로만 했고 사용자 전체 wipe 는 쓰지 않았다.
- 자동 테스트는 전부 mock/fixture. 실 Claude CLI(E12·E13)와 실 M4 TTS 는 별도 "실서비스" 항목으로 분리했다.

### 2. 체크리스트 (14항목)

| # | 항목 | 판정 | 실행 근거(원문 요약) |
|---|---|---|---|
| A1 | 미러 단위 테스트·타입·린트 | PASS | `node --import tsx --test` — lesson.test 60/60 + reviewMix.test 14/14 = `# tests 74 # pass 74 # fail 0`, task025.test 11/11, lessonLogic 8/8, lessonMatching 7/7, lessonFencing 6/6. `tsc --noEmit` exit 0(12.5s). `eslint`(components/lesson·prompts lesson/reviewMix·checks.ts·learning/lessons·api/v1/lessons) exit 0·출력 없음. 앞 구간 1차 실행 74/74·11/11·2/2·22/22 도 전부 통과(마지막 재실행으로 갱신) |
| B2-3 | 진행 기록 무결성·다시 듣기가 onComplete 를 건드리지 않음 | PASS | 13/13(앞 구간 실행). 진행 기록 무결성 + 다시 듣기·재생·칩 소리가 `onComplete`(`/complete`)를 호출하지 않음. 5단계 흐름의 PATCH 순서·`/complete` 0회는 D11-B 에서 별도 확인 |
| C4 | 오디오 API #62c | PASS | chunk 성공 후 같은 키 재요청 캐시 HIT, 400 계열(키 누락·타입), `unknown_key`, 404(타인·없는 레슨)·401(쿠키 없음), 응답 본문에 엔진명 없음, `tts:{userId}` 60/min 한도 429 확인. 신규 합성은 M4 합계 8회에 포함 |
| D5 | ① 이해 — 줄 다시 듣기(IMP-0012) | PASS | `d5` 계열 48/48(6 viewport x 8항목: 줄 ▶ 3개·터치 44x44(보이는 원 32)·넘침 0·CTA 첫 화면 노출·▶→스피너→■ 전환·상태 줄 "N번째 줄 · 느리게 다시 듣는 중"→구간 안내 복귀·요청 `{dialogue, idx, slow}` 만 PATCH 0·엔진명 0) + 부가 10/10(TEXT_ONLY 줄 ▶ 0개·자막만 안내·재생 차단 후 상태 불변·신규 합성 0). 첫 실행 1회가 시간 초과로 중단돼 `d5b`·`d5c` 로 이어 실행(`d5b` 의 `D5i 390x780 예외 — browser has been closed` 1건은 하네스 중단이며 `d5c` 에서 같은 항목 PASS) |
| D6 | ② 문법 — 오늘의 표현 칩 소리(IMP-0013) | PASS | `d6` 36/36(3폭 x 칩 재생·로딩·중지·문형 예문 듣기·TEXT_ONLY 글자 칩·502/429 폴백·④ 대상 칩은 버튼 아님 `insideButton=0 audioReq=0`·전 구간 후 기록 키 불변·신규 합성 0). dark 토큰 반전: IDLE `rgb(238,240,234)`→`rgb(38,45,41)`, PLAY 배경 `rgb(251,233,227)`→`rgb(58,36,30)`, ring `rgb(200,71,31)`→`rgb(240,106,69)` |
| D7 | ③ 문제 4유형·한국어 질문(IMP-0014) | PASS | 합성 `d7b` 128/128(첫 `d7` 은 저장 병합 하네스 오탐 29건이라 폐기, 재실행 PASS). 실 레슨은 E12 UI 44/44. 질문 16px 굵게 → 일본어 17px → 보기 순서·보기 높이 ≥44·정답 글자 비노출·결과 목록 5줄이 promptKo 그대로 |
| D8 | 옛 레슨(promptKo null/'') | PASS | `d7b` — 공통 안내 줄 + "예전에 만든 수업…" 노트·넘침 0·기록 키 불변·오디오 호출 0 |
| D9 | promptKo 가 일본어만("次の文の意味を選んでください") | 관찰(알려진 이슈) | task-025b Medium 로 이미 접수된 건. 360/390/412 모두 재현(한글 인지 `quizPromptView` 가 한글 없는 문자열을 질문으로 인정). FAIL 로 세지 않고 025b 로 이관 |
| D10 | ④ 응용 — 글자 비교(IMP-0016) | PASS | `d10` 71/71, FAIL 0, 429 `[]`, 콘솔 오류 `[]`. 기록 키(StudyLog·StatsSnapshot·RepetitionItem·WordEntry·AiJob·Utterance·Proposal·Observation) 불변, M4·오디오 호출 0(TtsCache 578→578) |
| D11 | 오늘 홈·5단계 흐름·종료 카드 회귀 | PASS(Low 1 별도) | A 오늘 홈 PASS x6. B 5단계 흐름 3폭 PASS(PATCH `stageDone` 순서 [1,2,3,4], `/complete` 0). C 종료 카드: 제목·통계 3칸·"다음 시간엔"·"오늘로"·로드 시 변경성 요청 0 PASS, L8 진행 해시 `07ee985479`·updatedAt 불변, 부수 행 diff `{}`. 단 합성 항목("넘침·엔진명·콘솔·429·터치≥44") 이 x780 세 폭에서만 FAIL — "오늘로" 링크 높이 20px → 결함 #1 |
| E12 | 실 A4 lesson@v8 생성 | PASS | 아래 3절 표. READY 74초, AiJob DONE, 5문항 전부 promptKo 한글 포함·정답 글자 비포함. 단 ④ 내용 매칭은 마지막 시도 완화로 통과(관찰 O2) |
| E13 | review-mix 실측 | PASS | 아래 4절 표. 2/2 성공·위반 0 |
| F14 | 커밋 경계 | 수집 완료 | 5절 목록(읽기 전용 git) |

### 3. E12 — 실 A4 lesson@v8 생성(레슨 `cmurmz1th00cxw1x2p5zu5dj0`, 주제 길 묻기 N5)

POST `{"status":"GENERATING","reused":false}` → 66초까지 GENERATING → `FINAL 74s READY error=null`, `promptVersion=lesson@v8`, 제목 "道をたずねる". 표현 8·대화 8줄·문법 3·응용 3. CLI 시도 2회(37.7s + 27.2s), AiJob `attempts=1`. 로그에 "마지막 시도 — 콘텐츠 매칭(④)·quiz.promptKo 한글 검사 위반 N건을 눈감고 통과시킴" 한 줄(④ 응용 3번의 대상 표현이 활용형 `曲がってください` 로 쓰여 원형 `曲がります` 리터럴 매칭 실패).

| Q | promptKo | promptJa | 정답 |
|---|---|---|---|
| 1 | 문장의 뜻을 고르세요. | 駅は遠いですか。 | 역은 먼가요? |
| 2 | 빈칸에 들어갈 알맞은 말을 고르세요. | すみません、駅まで＿＿行ってください。 | まっすぐ |
| 3 | 문장의 뜻을 고르세요. | 次の信号で右に曲がってください。 | 다음 신호에서 오른쪽으로 도세요. |
| 4 | 빈칸에 들어갈 알맞은 말을 고르세요. | 道がわからないので、＿＿。 | 教えてください |
| 5 | 문장의 뜻을 고르세요. | 銀行は出口の前にあります。 | 은행은 출구 앞에 있습니다. |

5/5 한글 포함, 정답 글자 비포함. 이 레슨에서 E12 UI 44/44 PASS(③ 3폭, 결과 목록 5줄 = promptKo, 오디오 요청 0, 콘솔 오류 없음).

### 4. E13 — review-mix(A5) 실측

| run | 성공 | ms | attempts | 재료 | 위반 | dialogue | chunks(new) | grammar |
|---|---|---|---|---|---|---|---|---|
| fixture-6items | OK | 33286 | 1 | 6 | 0 | 8 | 6(0) | 3 |
| small-3items | OK | 63800 | 2 | 3 | 0 | 8 | 4(1) | 3 |

small-3items 1차 응답은 `/application/0..2: 필수 필드 'targetIds' 누락` 으로 계약 위반 → 1회 재시도에서 성공(재시도 설계대로 동작).

### 5. F14 — 커밋 경계(025 대상, 읽기 전용)

- 025 단독: `src/app/api/v1/lessons/[id]/audio/route.ts`(2줄) · `src/components/lesson/{LessonScreen,StageApply,StageGrammar,StageQuiz,StageUnderstand,lessonCopy,logic,parts,useLessonPlayback}.tsx|ts` · `src/modules/conversation/prompts/lesson.ts`·`__tests__/lesson.test.ts` · `src/modules/learning/lessons/{content,generate,index,rows,today}.ts` · `src/types/lesson.ts` · 신규 `src/components/lesson/__tests__/task025.test.ts`·`src/components/lesson/compare.ts`·`src/modules/learning/lessons/observations.ts`·`tests/live/lesson-promptko-measure.ts`
- 타 task 와 섞인 파일(분리 커밋 필요): `StageSpeak.tsx`(task-021 한 줄), `api/v1/lessons/[id]/complete/route.ts`·`api/v1/lessons/today/route.ts`·`lessons/lifecycle.ts`(010b 가 대부분), `structuredResponse/{checks,schemas}.ts`(task-024 와 공유 — promptKo 부분만 025), `prompts/reviewMix.ts`(promptKo 한 줄), `docs/screens.md`·`docs/design/api-contract.md`
- 작업 트리의 evalGen/evalGrade/talk/corrections/chats·010b/010c/012c/021 live 스크립트 수정은 025 가 아니다. 025 영역 diff 합계 22파일 +634/-123.

### 6. 결함

[결함 #1] [Low · 기존 코드, 025 diff 밖] `src/components/lesson/LessonEnd.tsx` 144행 / 실행: 합성 DONE 레슨 L8 종료 카드를 390x780 에서 로드(Playwright, `d11c`) / 실제: "오늘로" 링크가 스크롤 영역 안에서 shrink 되어 높이 19.5px, 위치 top=795(780 viewport 밖), 스크롤러 client 728 / scroll 795. 360·412 도 x780 에서 동일. 390x892 에서는 44px 로 정상 / 기대: 터치 타겟 ≥44px, 첫 화면 안 / 원인 추정: `<Link className="flex h-11 items-center … ">` 가 `flex flex-col overflow-y-auto` 컨테이너의 자식이라 `flex-shrink:1`. `shrink-0` 부재. `LessonEnd.tsx` 는 025 에서 수정되지 않았고 마지막 커밋은 67771a5(task-010). 상단 BackBar 뒤로가기로 우회 가능. 별도 개선 건으로 접수 권장.

### 7. 관찰(결함 아님)

- O1 D9: 일본어만 있는 promptKo 재현 — task-025b Medium 로 기등록.
- O2 검증기 리터럴 매칭이 활용형 대상 표현을 거부 — E12 에서 마지막 시도 완화(`tolerateContentMismatch`)로만 통과. PE/Developer 후속에서 활용형 인지 매칭 검토 권장(025b 후보).
- O3 `GET /api/v1/speech/config` 가 방금 만든 신규 계정에서 500(Low, 025 diff 밖). 앞 구간에서 확인, 원문 로그는 보존하지 않아 재확인 필요.
- O4 짧은 간격 재로드 시 speech/config 429 는 기존 `speech-config:{userId}` 30/min 한도(제품 결함 아님).
- O5 실 생성 1건에는 4유형 중 2유형(뜻 고르기·빈칸)만 나옴 — 4유형 전체는 합성 레슨(d7b)에서만 검증.
- O6 E13 은 `repairLessonResponse` 수선 건수를 출력하지 않는다(위반 0 만 확인).
- O7 E13 스크립트가 공용 `/tmp/kaiwa-review-mix-measure.json`(9월 28일 측정본)을 덮어썼다.
- O8 M4 TTS 신규 합성 8회로 예산 6 초과(TtsCache 행 +8 로 일치). 사전 협의 없이 초과 — 사유 기록.
- O9 하네스 이슈(제품 결함 아님): `d7` 저장 병합 오탐 29건·`d5b` 중단 1건·Playwright 가 aria-disabled 를 disabled 로 취급해 `click({force:true})` 사용·출석 check-in 이 쓰기로 집계되던 것을 제외 처리.
- O10 dark 는 ② 칩·S2 응용 두 곳만 확인 — 나머지 단계 dark 는 NOT_VERIFIED.

### 8. 호출 횟수·지표

- LLM(논리 호출): 3/4 — E12 x1(CLI 내부 시도 2회: 37.7s·27.2s, 벽시계 74s)·E13 x2(33.3s / 63.8s·CLI 33.0s+30.8s). CLI 실제 기동 약 5회. 429 없음, 예비 1회 미사용.
- M4 TTS: 8회(예산 6, 2회 초과 — O8).
- 5초·3분 지표는 025 범위 밖(회화 30턴 p50/p95·단어 세트 소요 측정하지 않음).

### 9. 부수 행·정리 기록

qa-bot2 기준 정확한 id 삭제(합성 레슨 9건 + 그 종속 행). 삭제 대상 id 는 scratchpad `ids.json`(합성 8 + E12 1) 기준이며 삭제 후 `lesson.count({id in …})=0` 으로 확인.

| 항목 | 시작 기준선 | 삭제 직전 | 삭제 후 |
|---|---|---|---|
| Lesson | 0 | 9(합성 8 + E12 1) | 0 |
| RequestTrace(qa-bot2) | 60 | 175 | 60 |
| AiJob | 0 | 1(E12 LESSON_GEN) | 0 |
| Attendance | 0 | 1(첫 페이지 로드가 만든 APP_OPEN) | 0 |
| StudyLog·StatsSnapshot·RepetitionItem·WordEntry·Utterance·TutorProposal·LearningObservation | 0 | 0 | 0 |
| TtsCache(전역 공유) 행 / hits | 570 / 940 | 578 / 1108 | 578 / 1108(잔류) |

삭제 결과 `{"trace":115,"aiJob":1,"lesson":9,"attendance":1}` — 지정 id 외 행 0. TtsCache 는 전역·내용 주소 캐시라 삭제하지 않았다(행 +8·hits +168 잔류, 사용자 행 아님).

프로세스·파일 정리: dev 3042(PID 1212910, 자식 next-server 1212950 포함) 종료 — `ss -ltn` 에서 3042·3041·3043 없음. 3010(운영)·8100(gateway)·9343(19일 전 기동된 타인 headless Chrome, PID 735168)은 내 것이 아니라 건드리지 않았다. 내가 만든 미러 복제본 없음(`~/.node-local/thekaiwa-dev-010b` 는 Developer 의 기존 미러). 쿠키 파일 2개 삭제. **산출물 정리: 0개 삭제**(스크린샷을 만들지 않아 `/tmp/qa-artifacts/TheKaiwa/task-025/` 없음).

### 10. 육안 확인 필요(NOT_VERIFIED)

- 실 M4 음성의 귀로 듣는 품질 — 줄 느리게 다시 듣기 속도감, 단어 한 조각(駅 등) 칩 발음·끊김. QA 는 요청·캐시·상태 전환만 실측했고 소리는 듣지 못했다.
- 실기기(S25+ APK) 5항목(로그인 유지·키보드 입력창 가림·상태바 겹침·딥링크 복귀·마이크 권한 거부 안내)과 온디바이스 STT — 이번 변경은 웹만(네이티브 변경 없음, `reinstall_required=false` 로 보임).
- dark 모드 ①③④⑤ 단계 화면(O10).
- 운영(`kaiwa.미라클펭귄.com`) 배포 후 스모크는 deployer 영역.

### 11. 인계

- verdict=PASS_WITH_NOTES → Leader 에게 보고. deployer 자동 기동 안 함(결함 0건 조건 불충족).
- 배포 시 `post_deploy_checks` 권장: 360/390/412 세 폭 확인, `/api/health` 본문 `status=ok`, `SMOKE_ENV=PRODUCTION` 스모크(010 계열), lesson@v8 Prompt Registry ACTIVE 확인, `reinstall_required=false`·`migration_required=false`(스키마 변경 없음 — Developer 기록과 대조 필요).
- 후속 후보: 결함 #1(`shrink-0`) 별도 개선 접수, task-025b(D9·O2), O3 신규 계정 speech/config 500.

## Leader 기록 (QA PASS_WITH_NOTES 수용, 2026-10-03 09:26)

QA 원문(`## QA 기록 (025 — REV-060 이후, 2026-10-03 09:23)`)을 직접 읽고 대조했다. 판정 PASS_WITH_NOTES(C0 H0 M0 L1·관찰 10)를 **수용**한다. Reviewer 재순환 없음.

**직접 확인한 것**
- 14항목 중 12 PASS · D9(알려진 Medium → 025b)·F14(수집) · FAIL 0. 실행 근거가 조건·수치·원문 로그 단위로 적혀 있고(6 viewport·dark 토큰 값·E12 실 생성 5문항 표·E13 2회), 하네스 오탐(d7 29건·d5b 중단)은 폐기·재실행으로 처리됨.
- 결함 #1 은 코드로 재확인: `src/components/lesson/LessonEnd.tsx` 의 "오늘로" `<Link className="flex h-11 …">` 에 `shrink-0` 없음. 이 파일은 025 에서 수정되지 않았고 마지막 커밋은 67771a5(task-010) → **025 회귀가 아닌 기존 결함**.

**결정**
1. 결함 #1(Low, x780 종료 카드 "오늘로" 링크 20px 로 shrink): **025 에서 고치지 않는다.** 025 diff 밖·상단 BackBar 로 우회 가능·한 토큰짜리 수정이므로 **task-025b 묶음**(Developer → Reviewer → QA)에 포함한다. 025 배포를 막지 않는다.
2. task-025b 등록 범위: ① `quizPromptView`(`src/components/lesson/logic.ts:225-228`)·`StageQuiz.tsx:150-155` 한글 인지 폴백(D9·일본어만 promptKo) ② `lesson.ts` 로그 카운터 분리 ③ ④ 응용 대상 표현 활용형 매칭(O2: `曲がってください` vs `曲がります` 가 마지막 시도 완화로만 통과) ④ 결함 #1 `shrink-0`. 025b 도 화면 구조 변경이 아니므로 데모 게이트 대상 아님(구현 수준 보정).
3. O3(신규 계정 `GET /api/v1/speech/config` 500): QA 가 원문 로그를 남기지 않아 **재현 전엔 결함으로 세지 않는다.** 배포 후 신규 계정 1건에서 재확인하고 재현되면 별도 접수.
4. O8(M4 TTS 신규 합성 8회 — 예산 6 초과): 사전 협의 없는 초과였으나 TtsCache 행 +8 과 일치·429 없음·사용자 행 영향 없음 → **수용**(재발 방지: 다음 QA 프롬프트에 총 호출 상한을 명시). TtsCache 잔류(+8 행·+168 hits)는 전역 내용 주소 캐시라 삭제 안 함.
5. O7(공용 `/tmp/kaiwa-review-mix-measure.json` 덮어씀): 9월 28일 측정본이 사라졌으나 재현 가능한 측정 스크립트가 남아 있어 **수용**.
6. NOT_VERIFIED(M4 음성 청취 품질·실기기 5항목·dark ①③④⑤·운영 스모크)는 사용자 실기기 확인·배포 후 스모크 몫.

**상태**: 025 모든 검증 축 통과 → **배포 대기**(웹만, 네이티브 변경 없음, `reinstall_required=false`·`migration_required=false` — Developer 기록과 일치). 배포 게이트: lesson@v8 롤백 기준 ①~④ 모니터링(lesson@v8 마지막 시도 완화 로그 빈도 확인·A5 live 1~2회).
