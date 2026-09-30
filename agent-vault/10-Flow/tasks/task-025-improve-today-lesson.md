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
updated: 2026-09-30
demo_gate:
  required: true
  level: "delta"
  status: "review_requested"
  version: 1
  repo_path: "docs/demo/task-025-improve-today-lesson-v1.html"
  artifact_url: "https://claude.ai/artifact/F9ZREEMa89dVx6FJLrH8ih"
  content_sha256: "3554de3a69ebfa5b94a60e1b1818ccfd7384eee84e5465d61809172acd53a0ad"
  decided_by: "judge"
  rule_id: "DM-low-confidence"
  approved_by: ""
  approved_at: ""
  approval_quote: ""
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: false
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

## Developer 기록

## 작업 기록

### 2026-09-30 Leader — 착수
- Q10 "모든 단계" 반영. A4 v8 은 운영 레슨 생성에 영향을 주므로 배포 전 운영 스모크(010 65/65)와 롤백 기준을 QA 가 확인한다.

## 최종 요약 (Leader)

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge: delta (DM-low-confidence) | 09-30 22:14 |
| v1 | 검토요청 | docs/demo/task-025-improve-today-lesson-v1.html | https://claude.ai/artifact/F9ZREEMa89dVx6FJLrH8ih | 사용자 검토 요청 | 09-30 22:39 |
