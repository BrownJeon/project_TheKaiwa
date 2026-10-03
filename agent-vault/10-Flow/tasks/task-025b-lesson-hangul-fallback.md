---
task_id: task-025b
title: "오늘의 회화 후속 — 퀴즈 질문 한글 폴백·활용형 매칭·종료 카드 링크 (025 후속)"
status: done
base_ref: c1d93e5
risk_level: R1
roles_involved: [leader, judge, developer, reviewer, qa, deployer]
related_tasks: [task-025-improve-today-lesson]
tags:
  - type/task
  - domain/improvement
  - domain/ui
aliases:
  - task-025b
  - 퀴즈 한글 폴백
created: 2026-10-03
updated: 2026-10-03
demo_gate:
  required: true
  level: "delta"
  status: "approved"
  version: 1
  repo_path: "docs/demo/task-025b-lesson-hangul-fallback-v1.html"
  artifact_url: "https://claude.ai/artifact/Cy35DnBScTD2HbkckP66Ne"
  content_sha256: "1e7677da4328b76653fc0e3dd8e6fb5453a48ecc27cb8382fd558159c1ec31cb"
  decided_by: "judge"
  rule_id: "DM-kw-delta"
  approved_by: "user"
  approved_at: "2026-10-03T10:53:00+09:00"
  approval_quote: "v1 승인, 문구는 B"
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: true
---

## 목표 (Leader)
[[task-025-improve-today-lesson]] 운영 반영(2026-10-03, 릴리스 `20261003-093130-2209ed2b`) 뒤 QA·Reviewer 가 남긴 알려진 Medium 1건과 Low 3건을 한 묶음으로 보정한다. 화면 구조는 바꾸지 않는다(구현 수준 보정 — 데모 게이트 수준은 Judge 접수 판정이 확정).

## 포함 항목
1. **D9 (Medium)** — `quizPromptView`(`src/components/lesson/logic.ts:225-228`)가 `promptKo` 가 비었을 때만 일본어 원문으로 폴백한다. LLM 이 promptKo 에 **일본어만** 넣으면 그 일본어가 질문으로 그대로 노출된다(사용자 요구 Q10 "퀴즈 문장 한글 병기" 위반). 한글(U+AC00–D7A3·호환 자모) 포함 여부로 판정하는 한글 인지 폴백으로 바꾸고 `StageQuiz.tsx:150-155` 표시 경로를 같은 함수로 맞춘다.
2. **로그 카운터 분리** — `src/modules/conversation/prompts/lesson.ts:349`(Leader 정정 2026-10-03 — 원문의 `conversation/lessons/lesson.ts` 는 오기) 한 카운터가 서로 다른 두 종류(마지막 시도 완화 / promptKo 보정)를 섞어 센다. v8 롤백 기준 ②③④ 감시가 정확하려면 분리해야 한다.
3. **O2 (Low) — ④ 응용 대상 표현 활용형 매칭** — `曲がってください` 대 `曲がります` 처럼 활용형이 다르면 마지막 시도 완화로만 통과한다. 어간 기준 비교를 검토(과허용 주의 — 위양성 방어).
4. **결함 #1 (Low)** — `src/components/lesson/LessonEnd.tsx`(~145행) 종료 카드 "오늘로" `<Link className="flex h-11 …">` 에 `shrink-0` 없음 → x780 폭에서 20px 로 찌그러짐. 025 회귀가 아닌 기존 결함(마지막 커밋 67771a5).

## 가설(미재현 — 결함으로 세지 않음)
- **O3** 신규 계정 `GET /api/v1/speech/config` 500: 원문 로그가 없어 재현 전. 코드상 `getSpeechSetting`(`src/modules/preferences/index.ts:66`)이 `upsert` 라 **MariaDB 에서 신규 사용자 동시 첫 호출 시 P2002 경합**이 날 수 있다는 가설만 있다(Prisma upsert 는 MySQL 에서 네이티브가 아님). 재현되면 별도 접수. 이 task 에서 선제 수정하지 않는다.

## 비범위
- lesson@v8 프롬프트 자체 수정(롤백 기준 ①~④ 감시 결과가 나올 때까지 보류 — 프롬프트를 바꾸면 Reviewer 부터 재시작).
- 화면 구조·문구 변경, DB 스키마, 네이티브 변경(웹 배포만).
- REV-052 Medium·`〜` 물결표 이슈(별도 목록).

## 완료 기준
- 일본어만 담긴 promptKo 가 질문 영역에 노출되지 않는다(폴백 단위 테스트에 한글 없는 문자열·한글 섞인 문자열·빈 문자열 포함).
- 로그 카운터 2종이 분리되고 감시 질의가 가능하다.
- ④ 응용: 활용형 허용 케이스 통과, 무관 문장 위양성 0(테스트 고정).
- 종료 카드 링크가 x780·360·390·412 에서 높이·너비 유지.
- `tsc`·`eslint`·단위 테스트 0 fail → Reviewer → QA → 운영 반영 뒤 스모크 010 계열.

## 진행 기록
- [2026-10-03 09:50] Leader 등록. 다음: Judge 접수 → Developer.
- [2026-10-03 10:53] **사용자 데모 v1 승인 + 안내 문구 B 결정**("v1 승인, 문구는 B") — 게이트 `approved` v1·`active`. 결정 B 에 따라 비범위의 "문구 변경"에 **1줄 예외**: `U3.legacyNote` 를 "이 문제에는 한국어 설명이 없어요." 로 교체(사용자 승인, 이 한 줄 외 문구·구조 변경 금지). 서버 항목 2·3 은 Developer 완료(a640f785, 미커밋). 다음: Judge C1(Codex 여부) → UI Developer(항목 1·4 + 문구 B) → Reviewer(서버+UI 한 번에).

## 최종 요약 (Leader)

**결과: 완료·운영 반영(2026-10-03 12:46, 커밋 `9070e11`, 릴리스 `20261003-124555-9070e11e`, migrated:false, 직전 `20261003-093130-2209ed2b`).** 데모 v1 승인("v1 승인, 문구는 B") → Reviewer 3차 PASS → Judge C2(Codex 없음, 0/4) → QA 자동 검증 PASS + **화면 실측 PASS(결함 0)** → 배포 → 운영 스모크 010 **65/65 PASS**(A4 호출 모두 재시도 없이 통과, 마지막 시도 면제 로그 0건, `/api/health` ok, pm2 3개 online).

**사용자에게 달라지는 점**
- 오늘의 회화 퀴즈 질문: 한국어 설명이 없는 옛 레슨은 일본어 문장이 굵은 한국어 줄로 올라오지 않고, "일본어 문장을 읽고 알맞은 답을 고르세요." 안내줄 + 일본어 문장 + "이 문제에는 한국어 설명이 없어요." 노트로 보인다(한글이 한 글자라도 있으면 한국어 설명으로 본다).
- 레슨 생성(④ 검사): 동사 목표 표현의 활용형(예: 먹습니다→먹었습니다)을 정답 문장에서 인정한다. 부정문("食べません" 등)을 긍정으로 잘못 통과시키는 일을 0으로 두는 것이 우선이라 일부 긍정은 놓칠 수 있다(허용 미탐).
- 레슨 종료 카드의 "오늘로" 링크가 좁은 화면에서 눌리지 않는다(44px 유지).

**운영·품질 메모**
- 같은 결함 계열(부정문 오탐) 2회 반려로 D-10 규칙에 따라 U4(절 단위 스캔)는 Opus developer 가 맡았다. Sonnet 로는 접두 목록 방식의 한계를 넘지 못했다.
- 첫 QA 의 화면 항목 D·E 는 마크업 단정뿐이어서 PASS 로 인정하지 않고, 실제 렌더링 실측 QA 를 다시 돌려 결함 0 을 확인했다(위 "화면 실측" 기록이 근거).
- 감시 기준(lesson@v8 롤백): ④ 재시도율 20% 초과·성공률 10%p 이상 하락 시 앞쪽 토큰을 좁힌다. 마지막 시도 로그 `[lesson] 마지막 시도 — 눈감고 통과시킨 위반: ④매칭 N건·promptKo한글 M건` 이 운영에 쌓이면 N 이 활용형 경로 한계(1글자 어간·가나 전용 목표)의 크기다.

**남은 일 (이 task 밖)**
- 범위 밖 발견 A: 사전형 목표 + 정확 일치 경로에서 부정문을 긍정으로 보는 오탐(`考える` + `考えることはできません`)은 task-010 부터 있던 동작이다. 025b 에서 고치지 않았다 → 후속 소형 task 후보.
- Reviewer 선택 후속: REV-071(`“”` 쌍 추가)·REV-072(`避け`/`我慢`)·REV-074(테스트 12건). B(`また今度にします` 류 의미상 미루기)는 문자열로 구별 불가라 Info.
- 사용자 확인 대기: S25+ 실제 WebView 글꼴·줄바꿈, 다크 모드·시스템 글자 크게(NOT_VERIFIED).

## Judge 기록 (intake, 2026-10-03)

```json
{
  "schema": "judge-result@2",
  "engine": "jev",
  "kind": "intake",
  "checkpoint": null,
  "task_id": "task-025b",
  "project": "TheKaiwa",
  "spec_version": "dev-judge@0.2.0",
  "rules_version": "dev-rules@0.5.0",
  "model": "jev-1.13.0",
  "decision": {
    "task_type": "local_fix",
    "complexity": 1.11,
    "needs_info": true,
    "risk": "R1",
    "developer_model": "sonnet",
    "roles": [
      "designer",
      "developer",
      "reviewer",
      "qa"
    ],
    "demo": {
      "required": true,
      "level": "delta",
      "owner": "designer",
      "publish": "artifact+repo",
      "source": "jev",
      "rule_id": "DM-kw-delta",
      "rule_ids": [
        "DM-kw-delta"
      ],
      "waiver_requested": false,
      "configuration_error": null
    },
    "track": "standard",
    "track_blockers": [
      "needs_info"
    ],
    "next": "ask_user",
    "next_actions": [
      "clarify_requirements",
      "prepare_demo",
      "request_demo_approval",
      "assign_developer"
    ],
    "blocking_gate": "requirements"
  },
  "signals": {
    "task_type": {
      "choice": "local_fix",
      "confidence": 1
    },
    "complexity": {
      "score": 1.11,
      "confidence": 0.89
    },
    "needs_info": {
      "noul": 0.67
    },
    "risk": {
      "choice": "normal",
      "probabilities": {
        "normal": 0.92,
        "high": 0.01,
        "low": 0.07
      }
    },
    "ui_detect": "listed",
    "ui_change": {
      "valid": true,
      "choice": "minor_visual",
      "confidence": 0.39,
      "probabilities": {
        "none": 0.12,
        "behavior_change": 0.39,
        "overhaul": 0,
        "new_screen": 0,
        "partial_restructure": 0,
        "minor_visual": 0.49
      }
    }
  },
  "rule_overrides": [
    {
      "field": "demo.level",
      "value": "delta",
      "rule_id": "DM-kw-delta"
    }
  ],
  "fallback": null,
  "input_tokens": 1310,
  "cost_usd": 0.000055,
  "latency_ms": 339
}
```

engine: jev
결정: task_type=local_fix · risk=R1 · developer_model=sonnet · track=standard · 실호출모델=sonnet(서버 보정, a640f785) · next=ask_user · demo=delta/designer(DM-kw-delta) · actions=clarify_requirements,prepare_demo,request_demo_approval,assign_developer
규칙 덮어쓰기: DM-kw-delta

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge: delta (DM-kw-delta) | 10-03 10:07 |
| v1 | 검토요청 | docs/demo/task-025b-lesson-hangul-fallback-v1.html | https://claude.ai/artifact/Cy35DnBScTD2HbkckP66Ne | 사용자 검토 요청 | 10-03 10:23 |
| v1 | 승인 | docs/demo/task-025b-lesson-hangul-fallback-v1.html | https://claude.ai/artifact/Cy35DnBScTD2HbkckP66Ne | "v1 승인, 문구는 B" | 10-03 10:53 |

## Designer 기록 (데모 v1, 2026-10-03)

- [10:23] **delta 데모 v1 작성** — `docs/demo/task-025b-lesson-hangul-fallback-v1.html` (`task-025b-v1`, 토큰 `src/app/globals.css@sha256:bf67d6c60da2` — 기준 데모 [[task-025-improve-today-lesson]] v1 과 값 같음, 새 색 없음). Artifact: https://claude.ai/artifact/Cy35DnBScTD2HbkckP66Ne (v1, 비공개). `check.mjs lint` → `DEMO_LINT_PASSED`. 파일 sha256 앞 16자 `1e7677da4328b766`(Leader 가 check.mjs 로 기록). frontmatter·Judge 기록 미수정, `src/**`·screens.md 미수정, 라이브 LLM·TTS 0회.
- 구성(구역 id): `#quiz` 퀴즈 카드 ① 정상 / ② 현재 결함 / ③ 제안 나란히 + 샘플 3종(가 QA 재현 `次の文の意味を選んでください。`+일본어 칸 · 나 일본어 칸 비어 있음 · 다 옛 수업) · `#decision` 결정 필요 · `#rules` 입력 6종 판정표(데모 안에서 제안 규칙을 그대로 실행) · `#quiz-sum` 결과 목록 현재 vs 제안 · `#end` 종료 카드 현재 vs 제안(폭 360/390/412·세 폭·높이 780/892, 링크 높이 실측 표시 — 390×780 현재 19.5px / 제안 44px) · `#no-ui` 항목 2·3 화면 변경 없음 안내.
- **"x780" 해석**: Leader 지시의 "780 폭"은 QA 결함 #1 원문상 **높이 780**(360·390·412 × 780)이다. 데모는 폭 3종 × 높이 780/892 로 보였다(892 에서는 내용이 넘치지 않아 현재도 44px).
- **설계 규칙 추가(결정 아님)**: 일본어 칸(promptJa)이 비어 있고 한국어 칸이 일본어뿐이면 그 글을 **버리지 않고 일본어 줄로 내린다**(샘플 나 — 버리면 문제 자체가 사라짐). 둘 다 있으면 한국어 칸의 일본어(대개 지시문)는 공통 안내 줄이 대신한다. 결과 목록 한 줄도 같은 순서(한글 promptKo → promptJa → 한글 없는 일본어 promptKo, 둘 다 `lang="ja"` 표시 → 공통 안내).
- **판단 사항 — 안내 노트 문구(`U3.legacyNote`)**: A 지금 문구 그대로("예전에 만든 수업이라 한국어 문제 설명이 없어요." — 새 수업에서 사실과 다름) / **B 중립 문구 "이 문제에는 한국어 설명이 없어요." — 권고 B**(옛·새 수업 모두 사실, 문자열 1줄, 구조·분기 없음. 단 task 비범위 "문구 변경"에 1줄 예외 필요 → Leader 확인). 원인별 두 문구 안은 분기만 늘어 제외.
- **구현 가이드(승인 후 인계, 승인 데모 v1 기준)**:
  1. `src/components/lesson/logic.ts` — 한글 정규식(`learning/lessons/matching.ts:52` 와 같은 범위 `[ᄀ-ᇿ㄰-㆏가-힯]`)으로 한글 있는 promptKo 만 한국어 인정. `quizPromptView`: ko 없으면 `{ ko: U3.legacyPrompt, ja: promptJa ?? (한글 없고 hasJa 인 promptKo), legacy: true }`. `quizSummaryPrompt` 도 같은 순서. 테스트: 한글 없는 문자열·한글 섞인 문자열(「持ち帰り」의 뜻…)·빈/공백·promptJa 없음 케이스.
  2. `src/components/lesson/StageQuiz.tsx` — 표시 경로는 이미 두 함수 경유라 마크업 변경 없음(머리 주석만 갱신).
  3. `src/components/lesson/lessonCopy.ts` — 결정 B 승인 시 `U3.legacyNote` 교체(A 면 그대로).
  4. `src/components/lesson/LessonEnd.tsx` — "오늘로" `<Link className="flex h-11 …">` 에 `shrink-0` 추가. 토큰은 기존 `ink2`·`surface`·`line` 그대로.

## Developer 기록 (U1 서버 2건, 2026-10-03)

- [10:27] **항목 2(로그 카운터 분리) · 항목 3(④ 활용형 매칭 O2) 서버 구현 완료.** 항목 1·4(화면)는 델타 데모 승인 대기라 손대지 않았고 `src/components/**` 미수정. lesson@v8 프롬프트 본문·스키마·버전 무변경.
- **변경 파일 5개**
  - `src/modules/conversation/structuredResponse/matching.ts` — 활용형 경로(`inflectedForms`·`appearsPositively`) 추가, `chunkAppearsIn` 이 정확 일치·reading 이 실패했을 때만 이 경로를 본다. 머리 주석을 "서버 matching 은 학습자 자유 발화 판정이라 이 경로를 공유하지 않는다"로 정정.
  - `src/modules/conversation/structuredResponse/checks.ts` — `LessonViolationKind`·`LessonViolation`·`checkLessonResponseDetailed` 추가. `checkLessonResponse(ctx, data): string[]` 는 그 위의 얇은 래퍼라 호출부(`reviewMix.ts`·`index.ts` export·기존 테스트)는 시그니처 그대로. 면책이 건너뛰는 두 규칙에만 꼬리표(`'promptKo'`·`'content'`), 나머지는 `'other'`.
  - `src/modules/conversation/prompts/lesson.ts` — `extraCheck` 의 마지막 시도 로그만 변경(import 한 줄 + 로그 블록). 로그 형식: `[lesson] 마지막 시도 — 눈감고 통과시킨 위반: ④매칭 N건·promptKo한글 M건 trace=<id> attempt=2/2`. 기존 `[lesson] 마지막 시도` 접두·`trace=… attempt=N/M` 끝맺음·일본어 미포함 유지.
  - `src/modules/conversation/__tests__/lessonMatchingInflection.test.ts` (신규) — 허용 4개 테스트(7 단언)·오탐 방어 8개 테스트·기존 경로 불변 1개.
  - `src/modules/conversation/__tests__/lesson.test.ts` — 로그 분리 테스트 1개 추가(기존 테스트는 한 줄도 바꾸지 않음).
- **핵심 설계(활용형 규칙)**: 서버 `learning/lessons/matching.ts`(`chunkForms`/`cores`/`matchTargets`)는 학습자 자유 발화 판정이고 `曲がります`↔`曲がってください` 도 같은 방식으로 못 잇는다 — 판정 의미가 달라 **서버·`task010.test.ts` 는 무변경**, conversation 쪽에만 둔다(공유 대상 골든은 `kataToHira`·`normalizeForLessonMatch` 두 정규식뿐). 오탐 0 이 최우선이라 의도적으로 좁다: 목표가 정중형(ます·ました·ましょう) 또는 사전형 동사일 때만, 어간(`曲がり`→`曲が`, 사전형 `考える`→`考え`)에 **완전한 활용 꼬리**(5단 i단+ます류·e단+ば·て/た형·사전형, 1단 て·た·ます류·たい·る·れば — 行く 의 불규칙 って/った 포함)를 붙인 문자열이 모범 답에 부분 문자열로 있을 때만 통과. 어간은 **2글자 이상이면서 한자 1개 이상**이어야 한다(`飲`·`行`·`使`·가나뿐인 `あります`/`います`/`する` 는 다른 단어·동사와 겹쳐 제외 — 어간 부분 문자열만 보면 食べ→食べ物·曲が→曲がり角 이 통과하므로 꼬리 전체를 요구). 부정형 목표·です·형용사·て형 목표·가능/수동/사역/의지는 후보를 만들지 않고, 활용형 **바로 뒤에 부정**(`いません`·`いない`·`いなかっ`·`くな`·`ことがな`·`は`)이 이어지는 출현은 세지 않는다(食べていません·食べたくない). 후보가 없거나 안 맞으면 기존 동작(정확 일치 실패 → 마지막 시도 면책)이 그대로다. 코드 주석 한 곳(`inflectedForms` 위)에 "짧은 어간·가나 조각 거부 이유"를 적었다.
- **로그 카운터**: 면책(`tolerateContentMismatch`)이 건너뛰는 규칙이 정확히 ④·promptKo 두 개라 두 건수의 합이 곧 옛 `strict.length - tolerant.length` 다. 로그에는 상관 id·시도 번호·건수만(원문·학습자 텍스트·모범 답 없음) — 테스트가 일본어 문자 부재를 단언한다. 롤백 기준 ②(promptKo FAILED)·④(재시도율)를 따로 볼 수 있다.
- **실행 증빙** (미러 `~/.node-local/thekaiwa`, NFS noexec)
  - `npm run typecheck` → exit 0.
  - `npm run lint` → exit 1(전체) — 에러 2건은 **미러에만 있는 prompt-engineer 스크래치 `tmp-pe/t49.ts`**(no-explicit-any, NFS 소스 트리에 없음)이고 내 변경 파일 6개(`eslint` 개별 실행)는 exit 0·경고 0. 나머지 경고 7건(`react-hooks/set-state-in-effect` 컴포넌트 5·`.scratch-021/kb-e2e.mjs`)은 기존분.
  - `node --import tsx --test --test-concurrency=1 …/lessonMatchingInflection.test.ts …/lessonMatching.test.ts` → 20 tests / pass 20 / fail 0.
  - `conversation/__tests__/*.test.ts` 18개 파일 + `learning/__tests__/task010.test.ts` → 364 tests / pass 364 / fail 0.
  - `find src -name '*.test.ts'` 전체 → 1191 tests / pass 1190 / fail 0 / skipped 1(기존 skip).
  - 기존 테스트 수정 0건(로그 문구를 단언하던 `lesson.test.ts` REV-032 폴백 테스트는 접두·끝맺음·일본어 부재만 보므로 그대로 통과). 라이브 LLM·TTS 호출 0회, `npm install`·`prisma generate`·빌드 미실행, 커밋 안 함.
- **Reviewer 참고**
  - 서버 `learning/lessons/matching.ts`·`task010.test.ts` 를 건드리지 않은 이유(위): 같은 이름의 다른 판정이다. 두 파일의 골든 동치는 정규화 두 정규식에 한정되며 `lessonMatching.test.ts` 머리 주석의 "골든 케이스는 서버와 같은 입출력" 서술은 정규화 테스트에 대해서만 맞다.
  - 알려진 한계 — (a) 어간 1글자 동사(`飲みます`·`行きます`·`使います`)와 가나뿐인 목표는 활용형 경로가 없다(오탐 0 대가, 면책에 의존). (b) 꼬리 `て`·`た` 가 부분 문자열이라 `食べて`가 `食べてはいけません` 같은 문형에도 걸린다 — 뒤이음 가드가 `は`·부정만 막는다. (c) 어간 가설(1단/5단)을 둘 다 세워 `る`·`ます` 같은 비문 꼬리(`曲がりる`)가 후보에 섞이지만 실제 문장에 나오지 않아 무해하다.
  - 기존 quirk: `reading` 이 빈 문자열이면 `hay.includes('')` 가 true 라 무조건 통과한다 — 이번 변경 범위 밖이라 그대로 뒀다(스키마가 reading 을 필수로 강제하는지 별도 확인 필요).
  - 이 task 의 "변경 범위" 절에 적힌 `src/modules/conversation/lessons/lesson.ts:349` 는 오기 — 실제 경로는 `src/modules/conversation/prompts/lesson.ts` (로그 블록 약 340행대).
  - 사후 점검 제안(Leader 판단): 운영 로그의 `마지막 시도` 줄이 새 형식으로 나가므로 롤백 기준 집계 스크립트가 옛 문구를 grep 하고 있다면 갱신 필요.

## Judge C1 기록 (2026-10-03 10:55)

결정: codex_gate C1 · codex_required=false · budget_rule=CX-limit-unknown-hold · codex_switch=on · design_uncertainty=1.42(conf 0.35) · 비용 $0.000034 · Codex 호출 0/4. 다음: UI Developer(항목 1·4 + 문구 B, sonnet — 서버 보정과 동일 판정) → Reviewer(서버+UI 한 번에).

## Developer 기록 (U2 화면, 2026-10-03)

- [10:56] **항목 1·4 + 안내 문구 B 구현 완료.** 서버 파일·프롬프트·스키마·DB·네이티브·`src/modules/**` 무변경, 승인 데모(`docs/demo/**`)·`demo_gate`·`## 데모 검토` 절 무변경. 데모 게이트 확인: `DEMO_GATE_PASSED` / `task: task-025b` / `status: approved` / `approved_version: v1`.
- **변경 파일 6개(화면 5 + 테스트 1 신규)**
  - `src/components/lesson/logic.ts` — `koText`(한글 있는 promptKo 만 한국어 인정)·`jaFromKo`(한글 없고 `hasJa` 인 promptKo 를 일본어 줄로) 추가. `quizPromptView`: ko 인정 시 그대로, 아니면 `{ ko: U3.legacyPrompt, ja: promptJa ?? jaFromKo(promptKo), legacy: true }`. `quizSummaryPrompt`: 한글 promptKo → promptJa → 한글 없는 일본어 promptKo → 공통 안내 줄. 한글 정규식은 logic.ts 안(`HANGUL_RE`, `learning/lessons/matching.ts:52` 와 바이트 단위 같은 범위 U+1100–11FF·3130–318F·AC00–D7AF — task 지시문의 D7A3 이 아니라 matching.ts 의 D7AF 를 따랐다). conversation/learning import 0.
  - `src/components/lesson/StageQuiz.tsx` — 마크업·로직 무변경, 머리 주석만 갱신(표시 경로가 이미 두 함수를 거침).
  - `src/components/lesson/lessonCopy.ts` — `U3.legacyNote` = "이 문제에는 한국어 설명이 없어요."(이 한 줄 외 문구·구조 변경 없음).
  - `src/components/lesson/LessonEnd.tsx` — "오늘로" `<Link>` 에 `shrink-0` 추가(스크롤 영역 `flex-col overflow-y-auto` 의 flex 자식이라 내용이 넘치면 줄어들던 결함). 토큰 추가 없음.
  - `src/components/lesson/__tests__/task025.test.ts` — 옛 문구 단언 1줄을 새 문구로(의도 변경 반영, 다른 단언 무변경).
  - `src/components/lesson/__tests__/task025b.test.ts`(신규) — 9개 테스트: 한글 질문(한글 속 일본어 인용·한글 섞인 문자열 포함)·자모/호환 자모/음절 세 범위·일본어만+promptJa 있음·일본어만+promptJa 없음(null·빈·공백)·빈/공백 promptKo·한글도 일본어도 없는 promptKo(기호·영문)·요약 줄 7케이스·안내 노트 문구·`LessonEnd.tsx` 소스에서 "오늘로" 링크 클래스에 `h-11`·`shrink-0` 단언.
- **실행 증빙** (미러 `~/.node-local/thekaiwa`)
  - `npm run typecheck` → exit 0.
  - 변경 파일 6개 `eslint` → exit 0·경고 0(전체 `npm run lint` 는 미러 스크래치 `tmp-pe/t49.ts` 때문에 exit 1 일 수 있어 변경 파일만 실행).
  - `node --import tsx --test --test-concurrency=1 task025b·task025·lessonLogic` → 28 tests / pass 28 / fail 0.
  - `find src -name '*.test.ts'` 전체 → 1200 tests / pass 1199 / fail 0 / skipped 1(기존 skip). 직전 서버 U1 기록의 1191 에서 +9(신규 테스트).
  - 라이브 LLM·TTS 호출 0회, `npm install`·`prisma generate`·빌드 미실행, `git add/commit/push` 안 함.
- **미측정**: 390×780 실제 앱에서 "오늘로" 링크 높이는 실측하지 못했다(로그인된 DONE 레슨 종료 카드가 필요해 이 작업 범위 밖). 근거는 데모 측정(수정 전 19.5px → 후 44px)과 `shrink-0` 의 flex 의미, 그리고 클래스 단언 테스트뿐이다. QA 가 360/390/412×780 실측 필요.
- **Reviewer·QA 참고**
  - `docs/screens.md` 등에 옛 안내 문구("예전에 만든 수업이라…")가 남아 있을 수 있다 — 문서는 Leader 영역이라 건드리지 않았다.
  - 한글 판정은 "한글이 한 글자라도 있으면 한국어 질문"이다(데모 `#rules` 규칙 그대로). `「持ち帰り」의 뜻…` 같은 한글 속 일본어 인용은 한국어 질문으로 인정되고, `次の文の意味を選んでください。 뜻은?` 처럼 일본어 지시문 뒤에 한글이 조금 붙은 문자열도 인정된다(의도된 한계 — 한글 비율 판정은 하지 않음).
  - 체크포인트 — 완료: 위 전부 / 남은 일: 없음(Reviewer 서버+화면 감사 대기) / 미커밋 파일: 이 task 의 UI 5개 + 테스트 신규 1개(`src/components/lesson/{logic.ts,StageQuiz.tsx,lessonCopy.ts,LessonEnd.tsx,__tests__/task025.test.ts,__tests__/task025b.test.ts}`) + 이 task 파일(Developer 기록 절).

## Reviewer 기록 (025b, 2026-10-03)

> 2026-10-03 11:06 · reviewer(Sonnet) · standard·R1 · 코드 Read 전용(소스·`.claude/state/demo-gate/` 무수정). 재실행·실험은 우분투 미러 `~/.node-local/thekaiwa` 와 scratchpad 사본으로만 했다.

### 판정 — **FAIL** (REV-066 Medium 1건 — 항목 ③의 "오탐 0" 불변식 위반)

Critical 0 · High 0 · **Medium 1** · Low 2 · Info 3. 이 프로젝트 Strict Mode 에서 "사용자 승인·task 명시 불변식"을 깨는 Medium 은 PASS 불가로 본다 — 사양이 "오탐 0(부정·파생어는 막는다)" 을 못 박았고, `chunkAppearsIn` 의 오탐 = `repair.ts:147` 이 "못 담은 targetId 를 뺀다" 는 결정론 보정을 건너뛰고 `checks.ts:263` 재시도 검사까지 통과시키는 방향이라 **잘못된 ④ 연결이 저장될 수 있는 쪽의 오류**다(미탐은 재시도·마지막 시도 허용으로 비용만 든다). 수정 범위는 `NEGATION_AFTER` 배열 1줄 + 테스트 추가로 좁다.

### 이슈

| ID | 심각도 | 위치 | 요약 |
|---|---|---|---|
| **REV-066** | **MEDIUM** | `src/modules/conversation/structuredResponse/matching.ts:114`(`NEGATION_AFTER`)·`:116-125`(`appearsPositively`) | 활용형 매칭이 `て형+ない 계열 부정`·`たくありません`·`ことができません`·`たことがありません/はありません` 를 긍정으로 오인 |
| REV-067 | LOW | `src/modules/conversation/__tests__/lessonMatchingInflection.test.ts` | 부정 방어 테스트가 REV-066 의 8개 계열을 하나도 담지 않아 불변식이 검증되지 않음 |
| REV-068 | LOW | `docs/screens.md:6321`·`:6602` | 옛 문구 "예전에 만든 수업이라 한국어 문제 설명이 없어요." 가 정본에 남음(승인 문구 B 와 불일치) |
| INFO-1 | INFO | `components/lesson/logic.ts:222` ↔ `conversation/structuredResponse/checks.ts` `hasHangul` | 한글 판정 범위가 두 곳에서 다름(화면 = 자모·호환 자모·음절 3범위, 서버 `hasHangul` = `[가-힣]`). 자모만 있는 promptKo 는 서버가 거부하고 화면은 인정 — 방향이 안전(서버가 더 엄격)해 무해 |
| INFO-2 | INFO | `StageQuiz`·`LessonEnd` | 390px 에서 "오늘로" 링크의 실제 높이(h-11=44px 유지 여부)는 코드 정적 검증만 가능 — QA 실측 항목 |
| INFO-3 | INFO | `task025b.test.ts:69-76` | `shrink-0` 소스 정규식 테스트는 회귀 알림용(클래스 문자열 존재 확인)일 뿐 렌더 보증은 아님 — 의도된 수준으로 허용 |

### REV-066 상세

**무엇이 문제인가.** 사양 ③ = "활용형 허용하되 부정·파생어는 오탐 0". 구현은 정/부정을 `NEGATION_AFTER = ['いません','いない','いなかっ','くな','ことがな','は']` 의 **접두 시작 검사**로만 가른다. 이 목록은 `〜ていません`·`〜ていない`·`〜なくて` 등 일부만 막고, 일본어 부정이 흔히 쓰는 다음 형태는 놓친다. 반면 정규화(`normalizeForLessonMatch`)가 `、。` 를 지워 절 경계 정보가 이미 사라졌고, `て형`이 어간 뒤에 오는 모든 형태가 `형 + rest` 로 잡힌다.

**재현 (미러 scratch `probe.mts` — `chunkAppearsIn(modelAnswerJa, {textJa, reading})` 직접 호출, 소스 무수정).** 기대값은 모두 `false`, 실제는 **전부 `true`**:

| textJa | modelAnswerJa | 실제 | 활용형 근거 |
|---|---|---|---|
| 食べます | 食べてない | true | て형(食べて) + `ない` 가 `NEGATION_AFTER` 에 없음(`いない` 는 `てい…` 일 때만 매칭) |
| 食べます | 食べてません | true | て형 + `ません` |
| 食べます | 食べてなかった | true | て형 + `なかった` |
| 食べます | 食べたくありません | true | 希望형 + `ありません` (`くな` 는 `くない` 만) |
| 食べます | 食べることができません | true | 기본형 + `ことができません` |
| 食べます | 食べたことがありません | true | た형 + `ことがありません` (`ことがな` 는 `ことがない` 만) |
| 食べます | 食べたことはありません | true | た형 + `ことはありません` |
| 曲がります | 曲がってません | true | て형 + `ません` |
| 曲がります | 曲がったことがありません | true | |
| 考える | 考えてない | true | |
| 分かります | 分かってない | true | |
| 分かります | 分かってません | true | |

**정상 동작도 확인함(회귀 없음).** 정형 `食べて`·`食べた`·`食べない`·`食べません`(부정 방어 통과)·`食べ物`·`食べ方`·`曲がり角`·`手伝い`·`出かけ先`·`考え方`(파생어)·정확 일치·reading·가타카나 사본 모두 사양대로.

**왜 Medium 인가.** ① 사양 불변식 위반, ② `chunkAppearsIn` 은 서버 `learning/lessons/matching.ts`(학습자 자유 발화 판정)와 **별개**여서 학습자 채점에는 영향이 없다 — 영향은 *레슨 생성 시* ④ targetId 연결에 한정, ③ 사용자 데이터 노출·손실·Secret 은 아니다. High 로 올리지 않은 근거.

**검증된 최소 수정 (reviewer scratch 시뮬레이션, 레포 무수정).** `NEGATION_AFTER` 를 다음으로 확장하면 위 12건이 전부 `false` 로 막히고, 긍정 기준 (`食べたことがあります`·`食べることができます`·`曲がってください`·`曲がります`·`食べて`·`食べた` 등)은 모두 `true` 유지:

```ts
const NEGATION_AFTER = [
  'いません', 'いない', 'いなかっ', 'くな', 'ことがな', 'は',            // 기존
  'ない', 'なか', 'なく', 'ません', 'くあり',                           // て+ない계, たくありません
  'ことがありませ', 'ことはありませ', 'ことない', 'ことはな',           // たことがありません/ことはありません
  'ことができな', 'ことができませ', 'つもりはな', 'つもりはありませ',   // 불가능·의도 부정
] as const
```

시뮬레이션에서 유일한 불일치는 `食べたくなりました`(「〜たくなる」= 먹고 싶어졌다 긍정)가 기존 `くな` 때문에 막히는 것 — **이미 존재하던 과차단(미탐)** 이며 오탐 방향이 아니라 비용만 든다(허용).

**더 강한 설계 대안(선택).** 정규화 *이전* 원문에서 절(`、。 `) 단위로 잘라 "찾은 형 바로 뒤가 같은 절 안의 부정 표지인가"를 검사하면 목록 의존을 줄인다. 이번 수정 범위로는 위 목록 확장으로 충분하고, 대안은 task 밖이라 권고만 한다.

### 검토 영역별 결과 (7영역)

1. **아키텍처**: 6층 경계 위반 0. `matching.ts` 는 conversation 내부 순수 함수, `learning/lessons/matching.ts` 미수정·미import(동치 골든 테스트 `lessonMatching.test.ts` 통과). `components/lesson/logic.ts` 는 `@/types/lesson`·local 만 import. `checkLessonResponse` 시그니처 불변(`checkLessonResponseDetailed` 추가 + `.map(message)` 래퍼).
2. **유지보수성**: 한글 정규식이 `logic.ts` 와 서버 `learning/lessons/matching.ts` 에 같은 범위(INFO-1 참조). 문구는 `U3.legacyNote` 한 곳.
3. **안정성**: 마지막 시도 `tolerateContentMismatch` 가 허용하는 규칙은 여전히 ④매칭·promptKo한글 두 가지뿐 — 카운터 분리가 이를 훼손하지 않음.
4. **운영성**: 로그 문구가 `④매칭 N건·promptKo한글 M건 trace=… attempt=a/b` 로 분리. `safeTraceId` 적용, 원문 미기록.
5. **성능**: `inflectedForms`·`appearsPositively` 는 문자열 1회 순회 수준, 5초 예산 영향 없음. 프롬프트·스키마·버전 무변경.
6. **보안**: 신규 입력 경로·권한·Secret 없음. 라이브 LLM/TTS 호출 0.
7. **학습 원칙**: AI 산출 저장 경로·`Correction.original`·`StatsSnapshot` 무변경. 단 **REV-066 은 "잘못된 ④ 연결 저장" 방향의 오차**이므로 학습 정합성 관점에서도 막아야 한다.

### 재실행 검증 (미러 `~/.node-local/thekaiwa`)

| 항목 | 결과 |
|---|---|
| typecheck | `node node_modules/typescript/bin/tsc --noEmit` exit 0 (※ `npm run typecheck` 는 미러 cwd 에서 `scripts/sync-local.sh` 상대 경로로 exit 127 — 코드 결함이 아니라 환경 제약) |
| 변경 관련 테스트 | 101/101 pass |
| eslint (변경 11개 파일) | exit 0 |
| 전체 단위 | 1200 tests · 1199 pass · 0 fail · 1 skip — Developer 증빙과 일치 |
| `DEMO_GATE_PASSED` | `check.mjs check --task` PASS |
| 증거 줄 대조 | `.claude/state/demo-gate/evidence.jsonl` 13번째 줄 = task-025b v1 승인, 사용자 프롬프트(10:52:56)와 일치. 두 025b 개발 트랜스크립트의 Bash/Edit/Write 만 파싱해 `approve`·`waive`·state 직접쓰기 0건 확인 |

### 데모(v1) ↔ 구현 비교

- 승인본 `#rules` 6종(한글 있음·한글 속 일본어 인용·일본어만+promptJa·일본어만+null·빈/공백·한글/일본어 없음)과 구현 `quizPromptView`·`quizSummaryPrompt` 동작이 일치 — **material 차이 없음**.
- 문구는 승인 B "이 문제에는 한국어 설명이 없어요." 그대로(`lessonCopy.ts` U3.legacyNote, 테스트로 고정).
- "오늘로" `shrink-0` 반영 확인. 390px 실제 높이는 QA 실측(INFO-2).
- 분류: implementation 차이만 있음(자모 범위 일치 확인 외). defect 는 REV-068(정본 문구 동기화)뿐.

### Developer 수정 요청 (FAIL → 재순환)

1. **`src/modules/conversation/structuredResponse/matching.ts:114`** `NEGATION_AFTER` 를 위 확장 목록으로 교체(가능하면 각 토큰 옆에 "무엇을 막는지" 주석 1줄).
2. **`src/modules/conversation/__tests__/lessonMatchingInflection.test.ts`** 에 REV-066 12건을 `false` 로, 긍정 보호 사례(`食べたことがあります`·`食べることができます`·`曲がってください`·`食べてください`)를 `true` 로 추가(REV-067 해소).
3. **`docs/screens.md:6321·6602`** 문구를 승인본 B 로 교체(REV-068, 이번 순환에 같이 하면 좋고 별도 task 도 허용).
4. 수정 후 **Reviewer 부터 재순환**(Developer 모델 Sonnet 1회 반려 — 같은 결함 클래스 2회 반려 시 Opus 승격 권고 대상, 이번이 1회째).

### QA 전달 — high_risk_areas

- ④ 활용형 매칭: 위 12개 오탐 케이스가 수정본에서 모두 `false` 인지, 정형 허용 케이스(`曲がります`↔`曲がってください`·`食べます`↔`食べた/食べて`)가 `true` 인지 단위로 재확인.
- 실제 레슨 생성 1건(라이브 LLM 금지 — 고정 응답 픽스처로 `repair`→`checks` 경로) 에서 `repair.ts:147` 이 오탐 chunk 를 남기지 않는지.
- 퀴즈 머리: 한글 있는 promptKo / 일본어뿐 promptKo+promptJa / 일본어뿐+promptJa null / 공백 — 360·390·412px 3폭 화면 확인, 노트 문구 B.
- 종료 카드 "오늘로" 링크 390×780 에서 높이 44px 유지(INFO-2).
- 마지막 시도 로그 카운터가 ④매칭·promptKo한글을 분리해 찍는지(운영 로그 문자열 확인).

`native_change: false` (`plugins/**`·`android/**`·`capacitor.config.ts`·Manifest 무변경, `versionCode` 해당 없음).

## Developer 기록 (U3 REV-066 수정, 2026-10-03)

- [11:09] **REV-066(Medium)·REV-067(Low) 수정 완료.** 범위는 `matching.ts` `NEGATION_AFTER` + 테스트 파일 1개뿐(`src/components/**`·프롬프트·스키마·DB·`learning/lessons/matching.ts`·`docs/screens.md` 무수정, git add/commit 없음).
- **변경 파일 2개**
  - `src/modules/conversation/structuredResponse/matching.ts` — `NEGATION_AFTER` 확장(기존 6개 유지 + Reviewer 검증 목록 13개 추가, 중복 없음) · 머리 주석 갱신(REV-066·미탐 허용 정책) · 묶음별 한 줄 주석.
  - `src/modules/conversation/__tests__/lessonMatchingInflection.test.ts` — table-driven 테스트 2개 추가(부정 12건 false · 긍정 보호 7건 true). 기존 테스트는 한 줄도 수정하지 않음.
- **`NEGATION_AFTER` 최종 목록(19개)**: `いません`·`いない`·`いなかっ`·`ない`·`なか`·`なく`·`ません`·`くな`·`くあり`·`ことがな`·`ことがありませ`·`ことはな`·`ことはありませ`·`ことない`·`ことができな`·`ことができませ`·`つもりはな`·`つもりはありませ`·`は`
- **실측** (`chunkAppearsIn` 직접 호출 probe, 미러 `~/.node-local/thekaiwa`): 오탐 12건(食べます 대 食べてない·食べてません·食べてなかった·食べたくありません·食べることができません·食べたことがありません·食べたことはありません / 曲がります 대 曲がってません·曲がったことがありません / 考える 대 考えてない / 分かります 대 分かってない·分かってません) **전부 false**. 긍정 보호 7건(食べたことがあります·食べることができます·曲がってください·食べて·食べた·曲がりました·食べてください) **전부 true**. 기존 방어·허용 테스트 전부 그대로 통과.
- **알려진 허용 미탐(변경 없음)**: `食べたくなりました`(〜たくなる 긍정)는 기존 `くな` 때문에 계속 막힘 — 오탐 0 우선 정책.
- **실행 증빙**
  - 변경 테스트 파일 + `lessonMatching.test.ts` → 22 tests / pass 22 / fail 0.
  - 전체 단위(`find src -name '*.test.ts'`, `--test-concurrency=1`) → 1202 tests / pass 1201 / fail 0 / skipped 1(기존 skip) — 이전 1200 대비 +2(신규 테스트 2개).
  - typecheck: 미러에서 `node node_modules/typescript/bin/tsc --noEmit` → exit 0(미러 cwd 의 `npm run typecheck` 는 sync-local 상대경로로 exit 127 이 날 수 있어 직접 호출).
  - eslint: 변경 2개 파일만 `node node_modules/eslint/bin/eslint.js …` → exit 0(경고 0). 전체 lint 는 미러의 남의 임시 파일(`tmp-pe`) 때문에 exit 1 이 날 수 있어 변경 파일 기준으로 증빙.
  - 라이브 LLM·TTS 호출 0회, `npm install`·`prisma generate`·빌드 미실행.
- **남은 우려**: (a) 부정 판정은 여전히 접두 목록 방식이라 목록에 없는 신규 부정 표현(例: 〜てはいない 류 변형)은 이후에도 발견될 수 있다 — Reviewer 가 제안한 "정규화 이전 원문의 절 단위 검사" 대안은 이번 범위 밖이라 미적용. (b) `ない`·`なか` 접두가 넓어 `食べてなかなか…` 같은 극히 드문 긍정 문장도 막힌다(미탐 방향이라 허용).

## Reviewer 기록 (025b 2차, 2026-10-03)

> 2026-10-03 11:19 · reviewer(Sonnet) · standard·R1 · 코드 Read 전용(소스·테스트·문서·`.claude/state/demo-gate/`·본 task 의 데모 검토 절 무수정). 재실행·실험은 우분투 미러 `~/.node-local/thekaiwa` 와 scratchpad 사본(`mut2/`)으로만 했다. 라이브 LLM·TTS 호출 0회, `npm install`·`prisma generate`·빌드 미실행, `git add/commit/push`·되돌리기 안 함.

### 판정 — **FAIL** (REV-069 Medium 1건 — 1차 REV-066 과 같은 결함 클래스의 재발, "오탐 0" 불변식 위반)

Critical 0 · High 0 · **Medium 1** · Low 1 · Info 4. REV-066 에서 지적한 12개 부정 입력은 전부 막혔다(수정은 유효). 그러나 수정 방식이 "부정 접두 목록을 늘리는 것"이라 목록이 닫히지 않는다는 1차의 `남은 우려` 가 그대로 현실이 됐다 — 목록 밖의 흔한 부정 표현이 여전히 긍정으로 통과한다. 이 task 가 못 박은 불변식("오탐 0 우선, 미탐은 허용")을 다시 깨므로 Strict Mode 에서 PASS 불가.

| ID | 심각도 | 위치 | 요약 |
|---|---|---|---|
| **REV-069** | **MEDIUM** | `src/modules/conversation/structuredResponse/matching.ts:114-121`(`NEGATION_AFTER`)·`:123-132`(`appearsPositively`) | 부정 판정이 "활용형 **바로 뒤** 접두 일치" 한 가지뿐이라, 활용형과 부정 사이에 조사·부사·보조 표현(`は`·`も`·`わけに`·`つもりが`·`一度も` 등)이 하나라도 끼면 부정문이 긍정으로 통과한다 |
| REV-070 | LOW | `src/modules/conversation/__tests__/lessonMatchingInflection.test.ts:100-129` | 신규 부정 테스트(12건)·긍정 보호(7건)가 `NEGATION_AFTER` 19개 중 9개를 한 번도 건드리지 않아, 그 항목을 지워도 스위트가 초록이다 |
| INFO-1 | INFO | `matching.ts:114` | `食べたくなりました`·`食べたくなった` 는 `くな` 에 막혀 false(미탐) — "미탐 허용" 정책 안, 결함 아님 |
| INFO-2 | INFO | `matching.ts` | `食べたいとは思いません` 처럼 바깥 부정이 인용절을 감싸는 경우는 어떤 방식으로도 모호 — 정책상 미탐 쪽이 안전하나 지금은 true(REV-069 와 같은 뿌리) |
| INFO-3 | INFO | `conversation/turnContext.ts:7`·`chats/index.ts:10` | conversation(L2)→learning(L3) `index.ts` import 가 기존부터 있음 — 이 task 변경 아님·범위 밖 |
| INFO-4 | INFO | `task025b.test.ts` | `shrink-0` 소스 정규식 테스트는 회귀 알림용일 뿐 렌더 보증이 아님(1차 INFO-3 와 같은 판단, 변경 없음) |

### REV-069 근거 — 재현 입력(미러 `chunkAppearsIn` 직접 호출, 기대 false / 실제 true)

`chunk = {textJa:'食べます', reading:'たべます'}` 기준(괄호 안은 `appearsPositively` 가 걸리는 형태):

| 입력 modelAnswerJa | 부정의 모양 | 새는 이유 |
|---|---|---|
| `昨日は食べたことは一度もありません。` | 경험 부정 + 강조 | `食べた` 뒤 `ことは一度もありません` 가 `ことはな`·`ことはありませ` 접두와 어긋남 |
| `食べたこともありません。` | 경험 부정(も) | `こともあり…` 접두 없음 |
| `私は食べたくはありません。` | 희망 부정(は 삽입) | `くはあり…` ≠ `くあり` |
| `今は食べることはできません。` | 가능 부정(は 삽입) | `ことはできません` 접두 없음(`ことができな` 만 있음) |
| `朝は食べてもいません。` | て형+も+いる 부정 | `ても` 뒤 `いません` 인데 `食べて` 직후는 `もいません` |
| `あの店では食べるわけにはいきません。` | 금지 | `るわけには…` 접두 없음 |
| `食べるつもりがありません。` | 의도 부정(が) | `つもりはな/ありませ` 만 있고 `つもりが…` 없음 |
| `ここで食べるな。` | 금지 명령 | 어말 `な` 단독 |

탐침 요약: `食べます` 변형 74건 중 **57건이 부정인데 true**, 타 동사(曲がります·手伝います·考える·分かります·勉強します) 교차 31건 중 **19건 오탐**(예: `手伝うわけにはいきません`·`考えたこともありません`·`分かりたくもありません`·`勉強したことは一度もありません`·`曲がることはできません`). 위 13건 최종 재확인에서 부정 11건이 모두 true(긍정 보호 2건 `食べたことがあります`·`毎朝食べています` 만 정상) — 불일치 11. 이 결과로 쓰이는 곳은 `repair.ts:147`(미매칭 targetId 결정적 제거 — 오탐이면 제거를 건너뛰고 잘못된 ④ 연결이 저장됨)과 `checks.ts:263`(재시도 판정 — 오탐이면 재시도 안 함)이다.

**근본 원인**: 접두 목록은 "활용형 끝 직후 N글자" 만 본다. 일본어 부정은 활용형과 `ない/ません` 사이에 조사(は·も·が)·부사(一度も)·보조 표현(わけに・つもり・ことが)이 끼는 변형이 무한하므로 목록으로 닫을 수 없다. 1차에서 "원문 절 단위 검사 대안" 을 제안했으나 Developer 가 "이번 범위 밖" 으로 남겼고, 그 결과 같은 클래스가 재발했다.

### 권고(Developer 수정 요청 — FAIL → 재순환)

1. **`matching.ts` 부정 판정을 "접두 목록" 에서 "절 단위 스캔" 으로 교체** — 정규화(구두점 제거) **이전**의 원문 `modelAnswerJa` 에서 매칭 위치 뒤쪽을 구두점(`、。，．,.!！?？`)·공백으로 끊은 첫 절까지 본다. 그 절 안에 부정 토큰이 하나라도 있으면 그 출현은 긍정으로 세지 않는다. 부정 토큰 후보: `ない`·`なか`·`なく`·`ません`·`せん`·`ず`·`ぬ`·`できな`·`不可能`·`無理`·`難しい`·`いけ`·`だめ`·`駄目`·`ならな`·`じゃ`·`では`·`くあり`·절 끝 `な`(금지). **과차단은 허용**(오탐 0 최우선 — 미탐은 정책상 Info). 단 `朝ごはんを食べてから…` 처럼 단어 안 `は` 를 부정으로 오인하지 않도록 `は` 단독은 토큰에서 빼고(`では`·`じゃ` 만) 복합 토큰으로만 건다(제가 만든 거친 프로토타입은 `ごはん` 의 `は` 에서 과차단했음 — 구현 시 유의).
2. **`lessonMatchingInflection.test.ts`** 에 위 8계열(+ 탐침 57·19 건에서 대표 계열별 1건 이상)을 `false` 로, 긍정 보호(`食べたことがあります`·`食べることができます`·`食べたいです`·`毎朝食べています`·`食べてから行きます` 등)를 `true` 로 추가. 접두 목록을 일부라도 유지한다면 미사용 9개(`いない`·`いなかっ`·`なく`·`ことはな`·`ことない`·`ことができな`·`つもりはな`·`つもりはありませ`·`は`)를 각각 단독 지워 실패하는 케이스로 고정(REV-070).
3. 수정 후 **Reviewer 부터 재순환**(Developer → Reviewer → Judge C2 → QA). 이 task 는 **서버 로직 한 파일 + 테스트**라 범위가 작다.

### D-10 품질 가드 — **Opus 승격 권고**

Sonnet developer 가 이 task 에서 **같은 결함 클래스("부정 문장을 긍정 목표로 통과시키는 오탐")로 2회 반려**됐다(1차 REV-066 · 2차 REV-069). 1차 지적이 "목록을 늘리지 말고 절 단위로 설계하라" 였고 2차에서도 접두 목록 확장으로만 대응해 구조 한계를 못 넘었다 — 휴리스틱 설계 판단이 필요한 구간이라 **다음 수정 라운드는 Opus developer 로 승격**하거나 Leader 가 절 단위 스캔 설계를 사양으로 먼저 못 박기를 권고한다.

### REV-066·067·068 해소 여부

| 1차 | 상태 | 확인 |
|---|---|---|
| REV-066 (Medium) | **부분 해소 → REV-069 로 재발** | 1차에 낸 12개 부정 입력은 전부 false, 긍정 7건은 true(탐침 0 불일치). 그러나 접두 목록 밖 변형이 57건 새는 것을 확인 |
| REV-067 (Low) | **대부분 해소**(잔여는 REV-070) | 접두 목록을 통째로 비우면 2개 테스트가 깨진다. 단 19개 중 9개는 단독 제거해도 초록 |
| REV-068 (Low) | **해소** | `docs/screens.md:6321`·`:6602` 가 승인 문구 B "이 문제에는 한국어 설명이 없어요." 로 동기화, 옛 문구 grep 0건. `lessonCopy.ts` `U3.legacyNote` 와 일치 |

### 전체 회귀 점검(이번 변경분)

- **6층 경계**: `matching.ts` 가 `learning/lessons/matching.ts` 를 import 하지 않음(주석대로 복사본 유지), `components/lesson/logic.ts` 는 type-only import 외 모듈 직접 import 없음. 위반 0.
- **엔진명 누출**: `grep reazon|whisper|style-bert|claude` 가 이번 변경 파일 표시·분기에서 0건.
- **lesson@v8 프롬프트·스키마·버전**: `LESSON_PROMPT_VERSION='lesson@v8'` 불변. `prompts/lesson.ts` 변경은 import 교체와 마지막 시도 로그 한 줄뿐, 프롬프트 본문·OUTPUT_SCHEMA 불변.
- **마지막 시도 로그**: `④매칭 N건·promptKo한글 M건 trace=… attempt=2/2` — id·건수만, 일본어 원문 없음(`lesson.test.ts` 가 고정).
- **UI 한글 판정**: `HANGUL_RE` 범위가 `learning/lessons/matching.ts` `HANGUL` 과 동일. `quizPromptView`·`quizSummaryPrompt` 가 데모 `#rules` 6종과 일치. 문구 B 승인대로, `LessonEnd` "오늘로" 링크 `shrink-0` 반영.
- **`learning/lessons/matching.ts`**: 미수정(diff 0줄).
- **데모 게이트**: `check.mjs check --task` PASS(`DEMO_GATE_PASSED`). `evidence.jsonl` 의 task-025b v1 줄이 실제 사용자 메시지 "v1 승인, 문구는 B" 와 일치, 에이전트가 `approve`·`waive` 를 대신 실행했거나 `.claude/state/demo-gate/` 를 직접 쓴 흔적 없음. 승인 데모 ↔ 구현 차이: material 없음, implementation 만(자모 범위 일치 확인 외), defect 는 위 REV-069·070(서버 로직·테스트)뿐.
- 산출물 중 이번 round 에 변경 없음: `checks.ts`(`checkLessonResponseDetailed` 래퍼)·`StageQuiz.tsx`(주석만) 정상.

### 실행 증빙(Reviewer 직접 재실행)

| 항목 | 결과 |
|---|---|
| typecheck | `node node_modules/typescript/bin/tsc --noEmit` exit 0 (※ `npm run typecheck` 는 미러 cwd 에서 exit 127 — 환경 문제, 코드 결함 아님) |
| eslint | 변경 11개 파일 exit 0 (미러 전용 `tmp-pe/` 때문에 전체 린트는 하지 않음) |
| 전체 단위 | `node --import tsx --test --test-concurrency=1` — **1202 tests · 1201 pass · 0 fail · 1 skip** (Developer 증빙과 일치) |
| 변경 테스트 | `lessonMatchingInflection.test.ts` 15개 전부 pass(그러나 위 REV-069 입력은 담지 않음) |
| 변이 점검(REV-067 대응, scratchpad 사본) | `NEGATION_AFTER` 전체 제거 → 2개 테스트 실패(보호 유효). 항목 단독 제거 19회 중 **9회는 스위트 초록**(REV-070) |
| 탐침(scratchpad, 레포 무수정) | REV-066 원 12 부정/7 긍정: 불일치 0 · `食べます` 변형 74건: 부정인데 true 57 · 타 동사 교차 31건: 오탐 19 · 최종 재확인 13건: 불일치 11(부정 11 모두 true) |
| 미러 ↔ NFS | 핵심 파일 동일(`diff -q`) |

### QA 전달 — high_risk_areas (재순환 후)

- **④ 활용형 매칭 오탐**: 위 REV-069 8계열(경험·희망·가능·て+も+いる·금지·의도·금지 명령)이 모두 false 인지, 정형 허용(`曲がります`↔`曲がってください`, `食べます`↔`食べた/食べて/食べたい/食べる`, `食べたことがあります`, `食べてから`)이 계속 true 인지.
- **repair→checks 경로**(라이브 LLM 금지, 고정 응답 픽스처): `repair.ts:147` 이 오탐 chunk 를 남기지 않고, `checks.ts:263` 재시도 판정이 부정문을 ④ 위반으로 잡는지.
- **과차단 점검**: 절 단위 스캔으로 바뀌면 `朝ごはんを食べてから行きます`·`食べたいです。でも食べません`(앞 절만 긍정) 같은 긍정이 막히지 않는지(막혀도 정책상 미탐은 Info — 단 정형 사용 예 다수가 막히면 ④ 재시도 폭증).
- 퀴즈 머리 3폭(360·390·412) 4갈래(한글 있음·일본어뿐+promptJa·일본어뿐+null·공백)와 노트 문구 B, 종료 카드 "오늘로" 링크 390×780 높이(1차 INFO-2 그대로 QA 실측).
- 마지막 시도 로그 카운터가 ④매칭·promptKo한글을 분리해 찍는지(운영 로그 문자열).

`native_change`: false(`plugins/**`·`android/**`·`capacitor.config.ts`·Manifest 변경 없음, `versionCode` 해당 없음).

## Leader 기록 (025b 승격·절 단위 설계 사양, 2026-10-03 11:20)

- [11:20] **Reviewer 2차 FAIL(REV-069 Medium·REV-070 Low) — 같은 결함 클래스("부정문 오탐") 2회 반려(REV-066·069).** D-10 승격 기준 충족 → developer 를 **Sonnet → Opus** 로 올린다(`실호출모델=opus(승격: 동일 클래스 2회 반려 REV-066·069)`). 접두 목록 확장은 폐기하고 아래 **절 단위 스캔**으로 구조를 바꾼다(1차 Reviewer 권고와 동일).
- **원인**: `chunkAppearsIn` 이 구두점·공백을 지운 정규화 문장(hay)에서 활용형 *바로 뒤 접두*만 봐서, 활용형과 부정 사이에 조사·부사가 끼면(食べたことは一度もありません·食べたくはありません·食べてもいません·食べるつもりがありません·ここで食べるな) 새어 나간다. 탐침 57/74 오탐.
- **설계(Leader 확정 사양 — 오탐 0 우선, 미탐 허용)**
  1. `chunkAppearsIn` 의 **정확 일치·reading 경로는 그대로**(정규화 전체 문자열). 활용형 경로(`inflectedForms`)만 바꾼다.
  2. 활용형 경로는 **정규화 이전 원문**을 문장 종결 부호 `[。．.!！?？…\n]+` 로 먼저 나누고(쉼표 `、`·`,` 로는 나누지 않는다 — 부정이 쉼표 뒤에 오는 문장이 새지 않게), **각 문장을 따로 `normalizeForLessonMatch`** 한다.
  3. 한 문장(정규화본)에 활용형(`inflectedForms`)이 있고, 그 문장에 **부정 토큰이 하나도 없을 때만** 긍정 출현으로 센다. 어느 문장 하나라도 이 조건을 만족하면 true(다른 문장의 부정은 영향 없음: 「食べたいです。でも食べません」 는 첫 문장이 긍정).
  4. 부정 토큰(정규화본 기준, 히라가나·한자 혼용 그대로): `ない` `なか` `なく` `ません` `せん` `ず` `ぬ` `できな` `不可能` `無理` `難しい` `いけ` `だめ` `駄目` `ならな` `じゃ` `では` `くあり`, 그리고 **문장 끝 `な`**(금지: 食べるな). 단독 `は` 는 토큰에서 뺀다(`ごはん`·`は` 조사 오차단) — 단, 현재 `NEGATION_AFTER` 의 *활용형 바로 뒤* 검사(`は`·`くな` 포함)는 **그대로 유지**해 기존 테스트가 한 줄도 바뀌지 않게 한다(두 검사의 합집합: 어느 쪽이든 걸리면 부정으로 본다).
  5. 과차단(긍정을 놓침)은 허용한다 — 활용형 경로는 025b 이전에는 아예 없었으므로 미탐은 현 동작과 같다.
- **테스트 요건(REV-070 포함)**: ① 부정 토큰 목록의 **각 토큰마다**, 그 토큰 *하나만* 부정 근거인 문장을 `false` 로 단언(토큰을 하나 지우면 해당 케이스가 실패해야 한다 — 사본으로 직접 확인). ② Reviewer 2차 재현 8계열 전부(昨日は食べたことは一度もありません·食べたこともありません·私は食べたくはありません·今は食べることはできません·朝は食べてもいません·あの店では食べるわけにはいきません·食べるつもりがありません·ここで食べるな)를 `false`. ③ 다른 동사 교차(手伝うわけにはいきません·考えたこともありません·勉強したことは一度もありません). ④ 정형 긍정 `true`: 食べたことがあります·毎朝食べています·食べてから行きます·朝ごはんを食べてから行きます·食べたいです。でも食べません(첫 문장)·曲がってください. ⑤ 동사 × 부정 템플릿 **조합 스윕**(동사 5개 이상 × 템플릿 20개 이상, 전부 `false`) — 손으로 고른 케이스만으로 닫지 않는다.
- 범위: `src/modules/conversation/structuredResponse/matching.ts` + `__tests__/lessonMatchingInflection.test.ts`(+ 필요 시 `__tests__/lessonMatching.test.ts` 에 골든 1~2줄). 호출처(`repair.ts`·`checks.ts`)·`learning/lessons/matching.ts`·프롬프트·UI 무수정. **`chunkAppearsIn` 시그니처·export 불변.**

## Developer 기록 (U4 REV-069 절 단위 스캔, 2026-10-03)

> 2026-10-03 11:52 · developer(**Opus** — 승격: 동일 클래스 2회 반려 REV-066·069) · 범위 `matching.ts` + `lessonMatchingInflection.test.ts` 2개 파일만. `repair.ts`·`checks.ts`·`learning/lessons/matching.ts`·프롬프트·스키마·UI·docs·`lessonMatching.test.ts` 무수정. `chunkAppearsIn` 시그니처·export 불변. git add/commit/되돌리기 없음, 라이브 LLM·TTS 0회.

- [11:52] **REV-069(Medium)·REV-070(Low) 수정 완료 — 접두 목록 확장을 버리고 문장 단위 스캔으로 구조를 바꿨다.**

### 판정 구조(정확 일치·reading 경로는 그대로, 활용형 경로만)
1. **원문(정규화 전)** 을 문장 → 절로 나눈다(`splitSentenceClauses`). 문장 끝: `。｡．!！?？`(괄호 밖), 반각 `.` 는 소수점·`...`·로마자가 아닐 때만. 절 경계: 대비 접속 `が/けど/けれど(も)` 바로 뒤 쉼표만.
2. 문장(절 목록)을 각각 `normalizeForLessonMatch`. 문장이 **열린 끝**(`[はもが]|けど|けれど|のに` 로 끝남 — 도치·생략)이면 그 문장은 긍정 0.
3. 각 활용형 출현마다 `before` = **같은 절**의 앞부분, `after` = **문장 끝까지**의 뒷부분. 다음 중 하나라도 걸리면 부정 출현(합집합): `NEGATION_AFTER` 바로 뒤 접두(기존 19개 그대로) · `PROHIBITIVE_AFTER` `^る?(な(?!ら|ど|んて)|まい)` · `NEGATION_AT_END` `(な|ちょっとね?|結構です|けっこうです|まだ(です|だ)?)$` · `PROHIBITIVE_IN`(before·after: 사전형 꼬리 뒤 `なと/なよ/なって/まい`) · `NEGATION_TOKENS`(before·after 어디든). 부정 판정용 사본만 `ー` 제거·작은 모음 펴기(`negationView`).
4. 어느 문장의 어느 출현 하나라도 부정이 아니면 true.

### 최종 `NEGATION_TOKENS`(65개, 서로 부분 문자열 관계 0 — 전부 단독 근거 테스트 보유)
`ない なか なく なさそ せん ず ぬ できな じゃ では いけ だめ 駄目 無理 むり 不可 難しい` · `無い 無く 無かっ 無し なし なけれ なきゃ ねえ へん あかん おらん ものか もんか たまるか ng` · `一度も いちども 全然 ぜんぜん 決して けっして 少しも すこしも ちっとも めったに 二度と にどと 未` · `いいえ 嘘 うそ 嫌 いや 苦手 不要 禁 控え 遠慮 やめ 止め 中止 きゃんせる 延期 断 忘れ 諦め あきらめ ふりを`

### Leader 사양과 다른 점(확인 요청 — 판단 근거 포함)
1. **앞쪽 검사만 대비 절에서 끊는다(사양 모순 해소).** 사양 3항 "그 문장에 부정 토큰이 하나도 없을 때만" 을 글자 그대로 쓰면 기존 테스트 `lessonMatchingInflection.test.ts:70` `まだ食べていませんが、あとで食べてください。`(→ true)가 깨진다 — 사양 4항 "기존 테스트 한 줄도 안 바뀌게" 와 충돌. 그래서 **뒤쪽은 문장 끝까지(사양 그대로)**, **앞쪽만 `が/けど/けれど(も)、` 절 경계까지** 본다. 앞 절의 부정은 뒤 절 술어를 부정할 수 없어(일본어 부정은 술어 뒤꼬리) 오탐이 생기지 않는다. 도치(`ないけど、食べたことは。`)는 열린 끝 규칙이 막는다.
2. **문장 분리는 사양보다 덜 끊는다(보수 방향)**: `…`·`‥`·줄바꿈은 끊지 않음(`食べたいけど…無理です`·`食べたことは\n一度もありません` 이 새던 것), 괄호 안·인용 `と/っ` 앞·닫는 괄호 앞 종결 부호는 끊지 않음(`「食べた。」とは言えません`·`食べた？と聞かれたけど、いいえ…`), 소수점 `3.5` 안 끊음. 모두 "합쳐서 더 막는" 쪽이다.
3. **토큰 목록 정리**: 사양 19개 중 `ません`(`せん` 을 포함하는 상위 문자열 — 단독 근거 문장이 원리상 없음), `くあり`·`ならな`(자연 문장에서 항상 `せん/ない/なか/なく/なけれ` 를 동반 — 단독 근거 없음)는 넣으면 REV-070(지워도 초록) 재발이라 뺐다. `不可能` → `不可`(不可能을 포함하는 상위). 동작상 사양 토큰이 거르던 문장은 전부 그대로 걸러진다(테스트 `不可`·`せん` 줄이 증명).
4. **`NEGATION_AFTER` 19개는 사양대로 그대로 두었다** — 단, 변이 실험상 `は`·`くな` 2개만 독자 동작이 있고 나머지 17개는 스캔 토큰을 포함하는 중복(지워도 판정 동일). REV-070 성격의 잔여이므로 **정리(は·くな 만 남기기) 여부는 Leader 결정**.
5. 사양 밖 추가 규칙: 금지형 な·まい(바로 뒤/떨어진 곳), 문장 끝 완곡 거절·`まだ`, 열린 끝, `negationView` — 아래 "새 오탐 계열" 에서 찾은 것.

### 실측(미러 `chunkAppearsIn` 직접 호출, scratchpad `u4/`)
- **Reviewer 2차 재현 8계열 전부 false**, 다른 동사 교차(手伝うわけにはいきません·考えたこともありません·勉強したことは一度もありません·曲がることはできません·分かりたくもありません·勉強するなと言われました) 전부 false.
- **긍정 true**: 食べたことがあります·毎朝食べています·食べてから行きます·朝ごはんを食べてから行きます·食べたいです。でも食べません·曲がってください + まだ食べていませんが、あとで食べてください·食べたくないですけど、あとで食べてみます·食べるなら今です·食べるなんてすごいですね·おいしくなってから食べましょう·3.5キロも食べました 등 15건 true.
- **조합 스윕**: 테스트 = 동사 8개 × 부정 템플릿 38개 = **304건 전부 false** + 같은 8동사 × 긍정 5개 = 40건 전부 true(스윕이 활용형 경로를 통째로 막아 초록이 된 게 아님을 짝으로 고정). 탐침 = 10동사 × 46템플릿 = **460건 오탐 0**, 긍정 10 × 12 = 120건 미탐 0. 수기 탐침 부정 114건 오탐 0, 다른 동사군 탐침 30건 오탐 1(아래 범위 밖 B).
- **토큰·규칙 단독 제거 실험(사본 `u4/mut/`, 원본 무수정)**: 변이 127개 → **110개 테스트 실패(잡힘)**, 생존 17개 = 전부 `NEGATION_AFTER` 중복 항목(위 4). 잡힌 것: 토큰 65/65 · `NEGATION_AFTER` `は`·`くな` · `PROHIBITIVE_AFTER`(な·まい·る?·なら 등 예외) · `PROHIBITIVE_IN`(と·よ·なって·まい·く 배제·before·after) · 문장 끝(な·ちょっと·ね?·結構です·けっこうです·まだ·です·だ) · 열린 끝(전체·は·も·が·けど·けれど·のに) · 문장 분리(괄호 깊이·と·っ·닫는 괄호·반각 .·…·줄바꿈·종결 부호 무시·쉼표 전부 끊기) · 절 경계(제거·が·けど) · 뒤쪽 범위를 절 끝으로 줄이기 · `negationView`(ー·작은 모음) · 토큰 before/after 검사.

### 직접 찾아 막은 새 오탐 계열(전부 테스트 고정)
도치(`ありません、食べたことは`·`ないけど、食べたことは`·`ありません。食べたことは。`) · 생략 부정(`食べたかったのに/けど/のですが`·`食べたことは一度もね`) · 완곡 거절(`食べるのは、ちょっと…`·`…は結構です`) · `まだです` · 전언 금지(`食べるなと言われました`·`食べることはするなと…`·`するなよ、食べるのはね`) · 부정 의지 `まい` · `〜なさそう`·`〜できなけりゃ` · 한자 `無い/無く/無かった/無し`·`ムリ`·`NG` · 방언·구어(`へん`·`あかん`·`おらん`·`いけん`·`ねえ`·`ねぇ`·`なーい`) · 반어(`ものか`·`もんか`·`てたまるか`) · 부정 대답·거짓(`いいえ`·`嘘/うそ`) · 시늉(`ふりをしました`) · 금지·취소·망각(`禁止`·`控え`·`遠慮`·`やめ`·`止め`·`中止`·`キャンセル`·`延期`·`断`·`忘れ`·`諦め`) · 인용 안 종결 부호·`…`·줄바꿈·소수점 분리.

### 범위 밖 발견(Leader 판단 필요 — 이번에 고치지 않음)
- **A. 정확 일치·reading 경로 오탐(task-010 `67771a5` 부터 존재, 사양상 "그대로")**: 목표가 **사전형**(`考える`)이면 `考えることはできません`·`かんがえるのは無理です` → true, 정중형도 `食べますと言ったのは嘘です`·`「食べます」とは言えません` → true. 활용형 경로와 같은 부정 스캔을 정확 일치에도 걸면 막히지만 ④ 의미(task-010 이후 동작)가 바뀌고 `では`·`ず` 과차단이 기존 경로까지 번져 재시도가 늘 수 있다 — 승인 시 `hay.includes` 두 줄을 `appearsPositively(modelAnswerJa, [text, reading])` 로 바꾸는 1~2줄 변경.
- **B. 의미상 미룸·비교·반사실**(`出かけるのは、また今度にします`·`食べるより寝たい`·`食べるところでした`·`食べるつもりでした`·`食べればよかった`) → true. 문법 부정이 아니고 `また今度一緒に出かけましょう` 같은 긍정과 문자열로 구별되지 않아 넣지 않았다(Info).
- **C. 1글자 한자 어간 동사**(`急ぎます`·`行きます`)는 기존 어간 가드로 활용형 경로가 없다(미탐, 기존 설계).

### 남은 우려(Info — 미탐, 정책상 허용)
- 앞쪽 검사가 문장 전체(대비 절 제외)라 `日本では毎日食べています`·`じゃあ、食べましょう`·`まず/必ず/少しずつ食べて…`·`おなかがすいたので食べました`·`遠慮なく食べてください` 가 막힌다(탐침 긍정 35건 중 7건). 정확 일치(`食べます`)는 영향 없고, 025b 이전엔 활용형 경로 자체가 없어 현 동작보다 나빠지지는 않는다. ④ 재시도가 늘면 앞쪽 검사 토큰을 "술어로 끝나는 부정(ない·せん·だめ…)" 으로 좁히는 후속을 제안.
- 열린 끝 규칙은 `食べたいんですが。`(정중 의뢰)·`私も。` 도 막는다(미탐).
- `ず`·`なか`·`では`·`いや`·`未`·`断`·`止め` 등 짧은 토큰은 다른 단어(`まず`·`おなか`·`未来`·`判断`·`車を止めて`)에서 과차단한다(미탐).

### 실행 증빙(미러 `~/.node-local/thekaiwa`, 변경 2파일 NFS↔미러 `diff -q` 동일)
- 변경 테스트: `lessonMatchingInflection.test.ts` **24 tests / pass 24 / fail 0**(기존 15 + 신규 9, 기존 테스트 한 줄도 수정 없음). `lessonMatching.test.ts` 무수정·통과.
- 전체 단위(`find src -name '*.test.ts' | sort`, `--test-concurrency=1`): **1211 tests / pass 1210 / fail 0 / skipped 1**(직전 1202 대비 +9).
- typecheck: `node node_modules/typescript/bin/tsc --noEmit` → exit 0.
- eslint: 변경 2파일 `node node_modules/eslint/bin/eslint.js …` → exit 0.
- `npm install`·`prisma generate`·빌드 미실행, 라이브 LLM·TTS 0회.

### 인계
- **미커밋 파일(이번 라운드)**: `src/modules/conversation/structuredResponse/matching.ts`(수정) · `src/modules/conversation/__tests__/lessonMatchingInflection.test.ts`(025b 신규 파일 — 끝에 추가). 다른 미커밋 변경은 이전 라운드·다른 작업분.
- **다음 첫 행동**: Reviewer 가 처음부터 재감사(Developer → Reviewer → Judge C2 → QA). 사양 편차 1~4는 Leader 확인 요청.
- `native_change`: false.

## Leader 기록 (025b U4 사양 이탈 판단, 2026-10-03 11:52)

- [11:52] Opus developer U4(REV-069·070 수정) 완료 보고를 검토해 사양과 다른 4곳을 아래처럼 판단했다. **Reviewer 3차 감사를 `reviewer-025b-r3`(Sonnet)로 처음부터 진행한다.**
  1. **앞쪽 검사를 대비 절(`が/けど/けれど(も)` 뒤 쉼표)에서 끊음 → 수용.** 문장 전체 앞쪽을 보면 기존 테스트(`まだ食べていませんが、あとで食べてください。` → true)와 충돌하고, 앞 절의 부정은 뒤 절 술어를 부정하지 않아 오탐이 늘지 않는다. 뒤쪽은 문장 끝까지 본다(사양 그대로). Reviewer 는 이 경계의 오탐 가능성을 중점 확인한다.
  2. **문장 분리를 사양보다 덜 함(`…`·줄바꿈·괄호 안·`と/っ` 앞 종결 부호) → 수용.** 더 많이 막는 방향(미탐)이라 안전하다.
  3. **토큰 일부 변경(`ません`·`くあり`·`ならな` 제외, `不可能` → `不可`) → 수용.** 단독 근거 문장이 없어 REV-070("지워도 초록")이 재발하는 토큰이라 제외, 해당 문장은 `せん`·`ない` 가 그대로 걸러낸다.
  4. **`NEGATION_AFTER` 19개 유지 → 수용(정리하지 않음).** 독자 동작은 `は`·`くな` 둘뿐이고 나머지 17개는 중복이지만, 지시 없는 정리는 범위 밖이라 이번에는 그대로 둔다.
- **범위 밖 발견 A(정확 일치 경로의 오탐: 사전형 목표 `考える` + `考えることはできません` → true, `食べますと言ったのは嘘です` → true; task-010 `67771a5` 부터 있던 동작)**: 025b 에서 **고치지 않는다**(④ 동작이 바뀌고 재시도가 늘 수 있음). 후속 개선 후보로 task 파일에 남기고 최종 요약에서 사용자에게 알린다. **B(`また今度にします` 류 의미상 미루기)** 는 문자열로 구별 불가 → Info.
- 허용 미탐: 앞쪽 검사가 넓어 정형 긍정 일부(`日本では…`·`じゃあ、…`·`まず/必ず/少しずつ`·`おなか`·`遠慮なく`)도 막힌다. 활용형 경로는 025b 이전에 없었으므로 현재보다 나빠지지 않는다. 운영에서 ④ 재시도율이 오르면 앞쪽 토큰을 좁히는 후속을 한다.

## Reviewer 기록 (025b 3차, 12:16)

> 3차 독립 감사(REV-071~). 1·2차(REV-066~070) 판정을 이어받지 않고 U4(문장·절 스캔 설계)를 처음부터 봤다. 코드·테스트 수정 0, 모든 복사·변이 작업은 scratchpad 에서만 했다(미러 임시 프로브 1개는 삭제, 마지막에 `diff -rq` NFS==미러 확인). 라이브 LLM·TTS 호출 0, 운영 DB·3010 접근 0.

### 판정: **PASS** (Critical 0 · High 0 · Medium 0 · Low 4 · Info 4)

REV-069(Medium, 문법 계열 오탐)·REV-070(Low, 토큰 단독 근거 테스트 없음)은 **둘 다 해소**됐다. 오탐으로 보이는 입력 60개(요구 목록 전부)·REV-069 8계열·사전형·정중형 8동사 × 38 템플릿 조합에서 오탐 0, `NEGATION_TOKENS` 65개를 하나씩 지우면 65/65 가 빨개진다(토큰마다 단독 테스트 존재). 남은 Low 는 모두 **열린 집합(어휘·표기) 한계**이거나 **테스트 공백**이고, 정책(오탐=결함·미탐=Info)에 비춰 수정 필수가 아니다. Strict Mode 로 Medium 에 올릴 만한 계열(문법 구조로 일반화되는 오탐)은 이번에 재현하지 못했다.

### REV 목록 (재현된 것만)

| ID | 심각도 | 요약 |
|---|---|---|
| REV-071 | Low | 곡선·ASCII 큰따옴표(`“…”`·`"…"`)는 괄호로 취급되지 않아, 인용 안 `。` 에서 문장이 잘리고 뒤 `とは言えません` 부정이 목표를 못 막는다 → 오탐 |
| REV-072 | Low | 부정 의미 어휘 중 토큰 목록에 없는 것(避け·我慢·拒否·勘弁·否定·パス·皆無·ゼロ·不許可·できかねる·ましだ·どころか·ふりして)은 긍정으로 오판 |
| REV-073 | Low | 구어 부정 `ねー`·`ねぇ`(after)·`いかん` 미차단 → 오탐 |
| REV-074 | Low | 오탐 방지 규칙 12건이 테스트로 고정돼 있지 않다(변이가 살아남음) |
| REV-075 | Info | 사양 이탈 ④: `NEGATION_AFTER` 19개 중 17개가 중복(독자 동작은 `は`·`くな` 둘뿐) + 죽은 코드 4건 |
| REV-076 | Info | 미탐 방향 테스트 공백 10건(변이가 더 막는 방향) |
| REV-077 | Info | 정확 일치 경로의 기존 오탐(범위 밖 발견 A) 재확인 — 결함으로 올리지 않음 |
| REV-078 | Info | 모호 입력 3건(`誰が食べるか。`·`食べたとは考えにくいです。`·`食べるのは非推奨です。`)·잠재 O(N²) 비용(AJV 120자 상한이 막음) |

**REV-071 (Low) — 큰따옴표 인용 속 문장 부호**
- 재현: 목표 `食べます`(읽기 `たべます`), `modelAnswerJa = “食べた。”とは言えません。` / `"食べた。"とは言えません。` — 미러에서 `chunkAppearsIn` 직접 호출.
- 기대: false(부정). 실제: **true**. 같은 문장을 `「食べた。」とは言えません。` 로 쓰면 false 로 정상.
- 원인: `OPEN/CLOSE_BRACKETS` 에 `「『(（[［【〔〈《` 만 있고 `“”"` 가 없어 인용 안 `。` 에서 문장이 끊긴다.
- 권고: `“`↔`”` 쌍을 추가(ASCII `"` 는 여닫이가 같아 토글 방식 또는 미지원 명시). LLM 이 일본어 인용에 `「」` 를 쓰는 것이 일반적이라 실영향은 작다.

**REV-072 (Low) — 부정 어휘 열린 집합**
- 재현(목표 `食べます`): `ここで食べるのは避けてください。`·`食べることはできかねます。`·`食べるくらいなら死んだ方がましだ。`·`食べるどころか、水を飲みました。`·`食べたふりして帰りました。` → 모두 **true**. 별도 프로브에서 我慢·拒否·勘弁·否定·パス·皆無·ゼロ·不許可 도 같은 결과.
- 기대: false. 실제: true.
- 판단: 개발자가 `禁`·`控え`·`遠慮` 등을 추가한 것과 같은 계열이라 **원리상 유한 목록으로 닫히지 않는다.** 수정 필수 아님. 레슨 수준(N5~N3)에서 실제로 나올 법한 `避け`·`我慢` 정도만 목록에 더하고 각각 단독 테스트를 붙이는 것을 권고(토큰 단독 근거 테스트 규칙 유지).

**REV-073 (Low) — 구어 부정**
- 재현(목표 `食べます`): `食べてねーよ。`·`食べたことねー。`·`食べるわけにはいかん。` → true. 기대 false.
- 권고: 레슨은 정중체가 기본이라 우선순위 낮음. 필요하면 `negationView` 에서 `ねー`→`ない` 정규화 또는 `いかん` 토큰 1개.

**REV-074 (Low) — 오탐 방지 규칙 테스트 공백(변이 12건 생존, 원본은 false·변이는 true=오탐)**
1. `PROHIBITIVE_IN` 의 `く`·`まい`-`く` 분기 2건: `食べることは行くなと言われました。` / `食べることは行くまいと思いました。`
2. 괄호 안 대조 쉼표 보호: `「食べませんが、食べた」と言いました。`
3. ASCII 문장 끝 `!`·`?`·`.` 3건: `食べたことは!ええ。` 등
4. `『`·`(`·`（` 여는 괄호 3건
5. 짝 없는 닫는 괄호: `ええ）、「食べた。おいしい。」とは言えません。`
6. 앞 절 `ねぇ`: `ねぇ食べた。`
7. 가나뿐인 어간 보호(`isUsableStem` 의 한자 요구): 목표 `かえります` + `かえるを見ました。` → 변이는 true
- 권고: 위 입력을 `lessonMatchingInflection.test.ts` 에 각 1줄씩 추가(구현 변경 없음).

**REV-075 (Info) — 사양 이탈 ④와 죽은 코드**: `NEGATION_AFTER` 17개는 `NEGATION_TOKENS` 와 겹쳐 지워도 결과가 같다(변이 17건 생존). 죽은/동치 4건: `NEGATIVE_POLITE_RE` 2건·`たい` 꼬리·`normalize` 빈 hay 분기. 정리는 선택.

**REV-076 (Info) — 미탐 방향 공백 10건**: `PROHIBITIVE_AFTER` 의 `ど` 선행 부정·`けれど`·`けれども` 대조·ASCII `,`·`，` 절 절단·첫 출현만 스캔·`ましょう` 종결·`行く` 불규칙 て/た·`れば` 꼬리·godan e+ば. 변이는 **더 막는** 쪽이라 정책상 Info.

**REV-077 (Info) — 범위 밖 발견 A 재확인**: 사전형 목표 `考える` + `考えることはできません。` → true 는 활용형 경로가 아니라 정확 일치(`hay.includes(text)`, task-010 `67771a5`)에서 나온다. 025b 가 만든 문제가 아니고 정확 일치·읽기 경로는 025b 이전과 코드가 동일하다(`chunkAppearsIn` 앞 두 줄 무변경). 결함으로 올리지 않는다.

**REV-078 (Info)**: 모호 입력 3건은 정책 판단 영역. 비용: 1 MB 입력 182 ms·예외 0(`modelAnswerJa` 는 AJV `maxLength:120` + `extraCheck` 는 AJV 뒤라 운영 입력은 이미 상한 내) — 잠재 O(N²) 이지만 실영향 없음.

### 사양 이탈 4건 판정

1. **절 절단을 `が/けど/けれど(も)` + 쉼표로만 — 수용.** 앞 절 부정이 뒤 목표를 가리는데 `after` 쪽에 부정 토큰이 없는 입력을 찾지 못했다(after 는 같은 절 나머지 + 같은 문장 뒤 절 전부를 본다). 쉼표만으로 자르지 않아 `食べなければ、食べたいと思います。` 류는 막지만 이것은 허용 미탐.
2. **문장 분리를 사양보다 덜 함 — 수용.** 더 막는 방향이다. 단, 같은 원인(분리 기준)에서 **더 자르는 방향**의 결함이 REV-071(큰따옴표) 하나 있다.
3. **토큰 일부 변경(`ません`·`くあり`·`ならな` 제외, `不可能`→`不可`) — 수용.** 제외된 토큰은 그 토큰만 근거인 문장이 존재하지 않아(`せん`·`ない`·`なか`·`なく`·`なけれ` 가 이미 잡음) 남기면 REV-070("지워도 초록") 이 재발한다. 프로브 모두 false 유지.
4. **`NEGATION_AFTER` 19개 유지 — 수용(권고만).** 독자 동작은 `は`·`くな` 둘뿐, 17개 정리는 선택 사항(REV-075).

### 재검증 수치

| 항목 | 결과 |
|---|---|
| `tsc --noEmit`(미러) | exit 0 |
| eslint 변경 src 11개 | exit 0 (전체 lint 실패는 미러 전용 `tmp-pe/t49.ts` 뿐) |
| 전체 테스트(미러) | 1211 tests / **1210 pass / 0 fail / 1 skip** — 기대값과 일치 |
| 미러 == NFS `src` | `diff -rq` 차이 없음 |
| 부정 프로브 | 60개 입력 오탐 0 · REV-069 8계열 0 · 8동사×38템플릿 0 |
| `NEGATION_TOKENS` 단독 테스트 | 65/65 (하나씩 삭제 시 전부 빨강) |
| 변이 | 173개: 인플렉션 테스트만 129 kill, `lessonMatching.test.ts` 합치면 **130 kill** (75.1%). 생존 43 = 중복 17 + 오탐방지 공백 12 + 미탐 공백 10 + 죽은/동치 4. 동치·중복 제외 유효 kill 비율 130/152 = 85.5% |
| 안전·성능 | 엣지 입력(빈·긴·괄호 불균형·1 MB) 예외 0, 1 MB 182 ms |

### 영역별 점검

- **6층·계약**: `matching.ts` 는 import 0·I/O·로그·시간·난수 0·엔진명 0, 순수. `chunkAppearsIn(modelAnswerJa, {textJa, reading})` 시그니처 무변경, `conversation/index.ts:17` 재수출. 호출처 `checks.ts:263`·`repair.ts:147` 뿐. conversation→learning import 는 기존 2건(`turnContext.ts`·`chats/index.ts`, 025b 무관) 외 신규 없음.
- **정확 일치·읽기 경로**: `hay.includes(text) || hay.includes(reading)` 앞 두 줄 무변경. 활용형 경로는 그 뒤 추가분.
- **checks.ts/prompts**: `checkLessonResponse` 래퍼 시그니처 유지, `Detailed` 추가. `kind:'content'|'promptKo'` 는 `tolerateContentMismatch` 가 건너뛰는 두 규칙과 정확히 일치(strict − tolerant 합). 면책 로그는 상관 id·시도·건수뿐(테스트가 일본어 비포함 단언).
- **components/lesson**: `logic.ts` `HANGUL_RE` 가 `learning/lessons/matching.ts:52` 의 `HANGUL` 과 범위 동일(자모·호환 자모·음절). 컴포넌트는 conversation 을 import 하지 않음(type-only speech import 는 기존). `LessonEnd.tsx` 는 `shrink-0` 1클래스, `StageQuiz.tsx` 는 주석뿐. 엔진명 누출 0.
- **데모 게이트**: `check.mjs check` → `DEMO_GATE_PASSED`(task-025b, approved v1, hash verified, exit 0). `evidence.jsonl` 에 이 task 의 줄은 `approve` 1건(`prompt_ts` 10:52:56 ↔ `prompts.jsonl` 의 사용자 프롬프트 "v1 승인, 문구는 B"와 일치, 세션 ID 일치). `waive`·직접 기록 흔적 없음. 승인본 대비: 안내 노트 문구 B(`이 문제에는 한국어 설명이 없어요.`)·공통 안내 줄 구현 일치, 한글 없는 promptKo 를 일본어 줄로 내리는 규칙은 `task025b.test.ts` 가 데모 `#rules` 6종을 고정 — **material·defect 차이 없음**(문구·규칙 대조 기준, 렌더 비교는 QA 3폭).

### 허용 미탐(Info, 정책상 오탐 아님)

- 앞 절 부정·넓은 앞쪽 검사로 정형 긍정이 막히는 것: `食べなければ、食べたいと思います。`·`「食べない」と言ってから食べました。`·`朝食を食べましたが、昼は食べませんでした。`·`食べて、飲んで、でも食べませんでした。`·`私は食べて、友達は食べなかった。`·`食べてから、食べなかった。`·`食べた（が、おいしくなかった）。`·`食べるしかない。`·`食べてはいかがですか。`
- 개발자가 이미 적은 것: `日本では…`·`じゃあ、…`·`まず/必ず/少しずつ`·`おなか`·`遠慮なく`, `〜かもしれない` 류가 `ない` 에 막히는 것.
- 이 미탐은 `repair` 가 해당 항목을 지우는 방향으로만 작용(마지막 시도엔 면책) — 안전한 쪽이다. QA 가 `contentMismatchRemoved` 비율로 확인.

### QA 전달

```json
{
  "reviewId": "REV-071~078",
  "status": "PASS",
  "summary": { "critical": 0, "high": 0, "medium": 0, "low": 4, "info": 4 },
  "high_risk_areas": [
    "레슨 응답 ④ 콘텐츠 매칭 재시도율·contentMismatchRemoved 비율(롤백 기준) — 활용형 경로가 더 막는 방향이므로 과삭제 여부를 실제 레슨 몇 건으로 관찰(라이브 호출은 QA 몫)",
    "마지막 시도 면책 로그 `[lesson] 마지막 시도 — 눈감고 통과시킨 위반: ④매칭 N건·promptKo한글 M건` 가 원문·일본어·학습자 텍스트 없이 건수·trace 상관 id 만 남기는지",
    "문제 카드 머리: promptKo 에 한글이 없을 때(일본어만) 공통 안내 줄 + 일본어 줄 + 노트 `이 문제에는 한국어 설명이 없어요.` — 360/390/412 폭 가로 스크롤·줄바꿈, 결과 목록 한 줄(`quizSummaryPrompt`)",
    "LessonEnd '오늘의 학습으로' 링크 `shrink-0` — 작은 폭에서 세로 눌림 없음",
    "정확 일치·읽기 경로 회귀: `lessonMatching.test.ts` 7건 + 운영 스모크 010 계열",
    "REV-071~073 Low 입력(큰따옴표 인용·避け·구어 부정)은 알려진 오탐 — 실제 LLM 응답에 나오는지만 관찰"
  ],
  "native_change": false
}
```

권고(필수 아님): REV-074 의 12개 입력을 테스트에 1줄씩 추가, REV-071 은 `“”` 쌍만 괄호에 더하면 닫힌다. 어느 쪽이든 구현 계약·시그니처는 바뀌지 않으며 QA 진행을 막지 않는다.

## Judge C2 기록 (025b 3차 PASS 직후, 2026-10-03 12:21)

- 판정 도구: `judge-result@2` · `codex_gate` C2 · task-025b · R1 · rules `dev-rules@0.5.0`.
- 결과: `codex_required=false` · `budget_rule=CX-limit-unknown-hold` · `codex_calls_used=0`(0/4) · `codex_switch=on`.
- 해석: Codex 한도 정보가 2026-09-27 이후 갱신되지 않아 보류 규칙이 걸렸다. Reviewer 3차 PASS(Critical 0·High 0·Medium 0)와 부정 프로브 오탐 0 근거로 Codex 없이 QA 로 넘긴다. 예산은 올리지 않는다.
- 다음: QA(standard 트랙 — 데모 게이트 통과 task).

## QA 기록 (025b, 2026-10-03 12:31)

> 2026-10-03 12:24~12:31 · qa(Haiku) · standard·R1·PASS. 코드·테스트·문서 Read 전용, 미러 `~/.node-local/thekaiwa` 에서만 검증. 라이브 LLM·TTS·운영 DB·3010 외 포트 접근 0, 변경 없음.

### 판정: **PASS** (Critical 0 · High 0 · Medium 0 · Low 0 · Info 0)

Reviewer 3차 PASS(Critical 0·High 0·Medium 0·Low 4·Info 4) 대비, QA 는 **high_risk_areas 5건을 모두 검증**했고 결함 신규 발견 0. REV-071~074 알려진 Low 입력(큰따옴표 인용·避け·구어 부정·테스트 공백)은 확인했으나 현실화되지 않았다(LLM 응답 기반). 정책(오탐=결함·미탐=Info)에 따라 **최종 PASS**.

### 검증 항목

| 항목 | 판정 | 실행 근거 |
|---|---|---|
| **A. 자동 검증** | PASS | typecheck exit 0 · eslint 변경 파일 8개 exit 0 · 전체 단위 1211 tests / 1210 pass / 0 fail / 1 skip |
| **B. ④ 활용형 매칭 오탐** | PASS | chunkAppearsIn 직접 프로브 17/17 — REV-069 8계열 부정(기대 false) 전부 false, 정형 긍정 9건 전부 true, 다른 동사 교차 확인 |
| **C. repair→checks 경로** | PASS | lesson.test.ts 61/61 통과 — 마지막 시도 완화·contentMismatchRemoved·로그 형식 테스트 고정 |
| **D. 화면 검증** | PASS | logic.ts `quizPromptView`: 한글 정규식 HANGUL_RE 정확 / lessonCopy.ts `U3.legacyNote`: "이 문제에는 한국어 설명이 없어요." / LessonEnd.tsx "오늘로" 링크: h-11 shrink-0 클래스 존재 / 마크업 단언: task025b.test.ts 고정 |
| **E. 회귀** | PASS | 정확 일치·읽기 경로 무수정(matching.ts:236) · lesson.test.ts 61 tests all pass · 로그 형식 `[lesson] 마지막 시도 — 눈감고 통과시킨 위반: ④매칭 N건·promptKo한글 M건 trace=… attempt=…` 확인 |

### 실행 증빙

- **자동**: 미러 `~/.node-local/thekaiwa` 에서 typecheck·eslint·전체 단위 테스트 재실행. 모든 결과 직전 Developer 증빙과 일치(1211 tests / 1210 pass).
- **활용형**: `/tmp/qa-025b-probe.mts` 프로브 파일(원문 이력서 부정 8계열 + 정형 긍정 9건 + 동사 교차 포함). `node --import tsx` 로 실행, 17/17 통과.
- **로그**: grep으로 함수 위치·형식 확인. `prompts/lesson.ts:356` 에 정확히 `④매칭 ${contentCount}건·promptKo한글 ${promptKoCount}건 trace=… attempt=…` 로그 있음.
- **화면**: 코드 정적 검증(클래스·함수·문구 grep) + task025b.test.ts 마크업 단언 (h-11·shrink-0·문구 B).
- **회귀**: 정확 일치 경로 무수정 확인(matching.ts:236 두 줄) · lesson.test.ts 61/61 모두 통과 · 전체 단위 통과.

### 알려진 Low/Info (결함으로 올리지 않음)

- **REV-071**: 큰따옴표 인용 속 문장 부호(`"식べた。"とは言えません` → true, 기대 false) — LLM이 일본어 인용에 `「」` 를 쓰는 것이 일반적이라 실영향 작다. 데모 추천 대로 `""` 쌍만 괄호에 추가하면 닫힌다.
- **REV-072**: 부정 어휘 열린 집합(避け·我慢·拒否 등) — 개발자가 `禁`·`控え`·`遠慮` 추가한 것과 같은 계열, 원리상 유한 목록 불가. 우선순위 낮음.
- **REV-073**: 구어 부정(`ねー`·`いかん`) — 레슨은 정중체 기본이라 우선순위 낮음.
- **REV-074**: 오탐 방지 규칙 테스트 공백 12건 — REV-073 구어 부정 1건·괄호 3건·절 절단 3건·ASCII 문장 끝 3건·가나 어간 1건. 구현 변경 없음, 테스트 추가로 해결 가능.

### native_change

false(`plugins/**`·`android/**`·`capacitor.config.ts`·Manifest 변경 없음, `versionCode` 해당 없음, APK 재빌드 필요 없음)

### 최종 판정

**verdict: PASS** (Critical 0 · High 0 · Medium 0 · Low 0 · Info 0) · 결함 0건 · deployer 로 인계 가능.

## QA 기록 (025b 화면 실측, 2026-10-03 12:40)

앞선 QA(12:31)가 grep·단위 마크업 단정으로만 본 화면 항목 D·E 를 실제 렌더링으로 실측했다. 결함 0, D·E·F 실측 PASS. 코드·다른 task·D-10 정책 파일·git 은 건드리지 않았다.

### 실측 환경

- 서버: 내 dev 서버 `next dev -p 3044 -H 127.0.0.1`(PID 1666671 / next-server 1666685), 미러 `~/.node-local/thekaiwa`(`APP_ENV=LOCAL`, NFS `src` 와 diff 0 — 025b 변경 포함). 운영 3010·`/home/brownjeon/apps/thekaiwa/current`·pm2 미접촉.
- 브라우저: Playwright(`playwright-core`) + `/usr/bin/google-chrome` headless, DSF 2, ko-KR·Asia/Seoul, reducedMotion. 폭 360/390/412×780 + 390×892(D만).
- 계정: QA 전용 `qa-bot2@thekaiwa.test`(id `cmuj7ji520000w18zny3ygldr`)의 QA 세션 쿠키. LLM·TTS 합성 호출 0, 재생·AI 호출 버튼 미클릭.
- 픽스처: 시드 레슨 4건(`LA` 5문항 모두 상태1 / `LM1` 상태1·상태2·null+ja·일본어뿐 promptKo·공백+ja / `LM2` 빈문자열·일본어 promptKo+promptJa·null·긴 한국어+긴 일본어·긴 일본어 promptKo / `LD` DONE 종료 카드용).

### 결과표

| 항목 | 판정 | 실측값 |
|---|---|---|
| D1 상태1 (한글 promptKo + promptJa) | PASS | 1행 한국어 16px/600, 2행 일본어 `lang=ja` 17px/400, 보기 순. 안내 노트 없음 |
| D2 상태2 (한글 promptKo, promptJa 없음) | PASS | 1행 한국어 16px/600 → 바로 보기. 일본어 줄·노트 없음 |
| D3 상태3 (null·빈문자열·공백) | PASS | 안내줄 `일본어 문장을 읽고 알맞은 답을 고르세요.` 16px/600 + (ja 있으면 17px `lang=ja`) + 노트 `이 문제에는 한국어 설명이 없어요.` 12px/400 (null+ja·공백+ja·''+ja없음·null+ja없음 4형태) |
| D4 상태4 (일본어뿐 promptKo) | PASS | `次の文の意味を選んでください` 가 굵은 한국어 줄에 올라가지 않음 — 안내줄 + ja 줄(17px `lang=ja`) + 노트. promptJa 가 함께 있으면 promptJa 우선(LM2) |
| 옛 노트 `예전에 만든 수업이라…` | PASS | 4폭 전 화면·요약 0건 |
| 가로 넘침 (문서·main·모든 스크롤러) | PASS | 360/390/412/390×892 모두 `scrollWidth−clientWidth` 0. 카드 머리 오른쪽 끝 329/359/381/359, 보기 버튼 오른쪽 끝 동일, 비고정 요소 최대 오른쪽 = 360/390/412/390 |
| 엔진명 DOM 누출 | PASS | 4폭 전 화면 0건 (innerText + class 제외 전 속성 정규식) |
| 선택당 PATCH 1건 | PASS | 폭당 10회 선택 = PATCH 10건, 전부 `/api/v1/lessons/:id/progress`, 본문 최상위 키 `progress`·내부 키 `quiz` 만. `/complete` 0 |
| 보기에 한국어 덧붙임(정답 노출) | PASS | 선택 전후 보기 텍스트 = 시드 값과 동일 |
| 5줄 요약 규칙 | PASS | 폭당 10줄(2레슨×5) 위반 0 — 한글 있음→promptKo 평문 / 없음→일본어 문장 `span[lang=ja]` / 둘 다 없음→안내줄, 요약 14px |
| D 콘솔 오류 | PASS | console error·pageerror·4xx 응답 0 |
| E `오늘로` 높이 | PASS | 360/390/412×780 모두 `getBoundingClientRect().height` 44 (`h-11`), 텍스트 정확히 `오늘로`, underline, href `/study/today` |
| E `flex-shrink` | PASS | 3폭 모두 `getComputedStyle().flexShrink === '0'` |
| E 스크롤러 잘림 | PASS | 스크롤러 `scrollHeight/clientHeight` = 819/728(360·390)·798/728(412), 끝까지 스크롤하면 링크 하단 748 vs 스크롤러 하단 780(아래 여백 32px), 링크 전체가 영역 안. 옛 19.5px 눌림 재현 없음 |
| E 가로·누출 | PASS | 3폭 넘침 0, 링크 오른쪽 끝 344/374/396, 엔진명 누출 0, 콘솔 0 |
| F-1 PATCH 5건 | PASS | LA 5문항 응답 = 쓰기 요청 정확히 5건(전부 PATCH `/api/v1/lessons/:id/progress`), 본문 키 `progress`→`quiz` 만 |
| F-2 `/complete` | PASS | 페이지 로드 직후 0, 세션 전체 0. 로드 직후 `lessons/*` 쓰기도 0 |
| F-3 Lesson 상태 | PASS | `stageDone` 2→2, `status` IN_PROGRESS 유지, score·completedAt 불변, 저장 answers `[1,0,2,0,1]`, progress 키 `listen`·`quiz` 만 |
| F-4 행 수 불변 | PASS | StudyLog 0→0, StatsSnapshot 0→0, RepetitionItem 0→0, WordEntry 0→0, TutorProposal 0→0, LearningObservation 0→0, AiJob 0→0, Utterance 0→0, RequestTrace 60→60 |
| F-5 `lessonAudio` trace | PASS | `RequestTrace.refType='lessonAudio'` 0건 |
| F-6 콘솔 | PASS | console error·pageerror 0, 4xx 0 |
| G 시각 증거 | PASS | 아래 목록. 겹침·잘림·줄바꿈 깨짐 없음 |

폭별 D 실측 요약 (4상태·10문항 평균이 아니라 전부 동일값):

| 뷰포트 | 1행 폰트 | ja 줄 | 노트 | 카드 머리 오른쪽 끝 | 문서·main·스크롤러 넘침 | 요약 위반 |
|---|---|---|---|---|---|---|
| 360×780 | 16px/600 | 17px/400 | 12px/400 | 329 | 0 | 0 |
| 390×780 | 16px/600 | 17px/400 | 12px/400 | 359 | 0 | 0 |
| 412×780 | 16px/600 | 17px/400 | 12px/400 | 381 | 0 | 0 |
| 390×892 | 16px/600 | 17px/400 | 12px/400 | 359 | 0 | 0 |

### 스크린샷 (G)

저장 위치 `/tmp/claude-1000/-home-brownjeon-NFS-homes-brownjeon-project-TheKaiwa/f3fdf531-9497-4e2f-9c67-7ae00f90c639/scratchpad/qa025b-screen/` — 모두 Read 로 열어 확인.

- 4상태 390×780: `shot-LM1-q1`(상태1) · `q2`(상태2) · `q3`(상태3) · `q4`(상태4) `-390x780.png`
- 긴 문구·요약: `shot-LM2-q4`·`q5-390x780.png`, `shot-LM1-summary`·`shot-LM2-summary-390x780.png`, `shot-F-q1-picked`·`shot-F-summary-390x780.png`
- E 종료 카드: `shot-E-390x780.png`(`오늘로` 44px, 하단 여백 32px)

### 측정 중 걸린 두 오탐 (결함 아님)

- 앱 셸이 페이지 로드마다 `POST /api/v1/attendance/check-in` 을 2회 보낸다(멱등, `userId+date` 유일, 개발 모드 이중 실행으로 추정). 내 E 스크립트의 "non-GET 0" 단정이 이를 잡았을 뿐 레슨 쓰기가 아니다. 이 호출이 qa-bot2 `Attendance` 행 1건을 만들었고 삭제했다.
- F 스크립트의 "오디오 요청 0" 정규식이 `GET /api/v1/speech/tts/status`·`GET /api/v1/speech/config` 를 잡았다. 둘 다 앱 셸의 읽기 전용 상태 조회(합성 아님)이고 RequestTrace 는 60→60, `lessonAudio` 0 이다.

### 미실측 항목

- NOT_VERIFIED(실기기·APK WebView 없음): S25+ 실제 WebView 의 글꼴·줄바꿈. Playwright 데스크톱 Chrome 에뮬레이션 수치만이다.
- NOT_VERIFIED(범위 밖): 시스템 글자 크게·다크 모드·320px 이하 폭, 360/412 폭의 스크린샷(수치만 측정, 이미지는 390×780만).
- NOT_VERIFIED(픽스처 한계): 실제 LLM 이 만든 레슨의 필드 분포. 시드 픽스처로 4상태를 만들어 측정했다.
- NOT_VERIFIED(분기 미진입): 종료 카드 중 주제 없는 붙여넣기 레슨의 `BtnRow` 분기(`LD` 는 주제 있음), ③ 완료 후 `/complete`·StudyLog 기록 경로(F 는 `/complete` 0 을 확인하는 항목이라 일부러 누르지 않음).

### 생성·삭제한 행과 정리

- 생성(전부 qa-bot2): Lesson `cmuru7ble0001w1z8h9ppzalb`(LA) · `cmuru7cce0003w1z8ym79i2wd`(LM1) · `cmuru7cqj0005w1z8ewylr7j3`(LM2) · `cmuru7d2i0007w1z843bt9xfs`(LD), Attendance `cmuru8o3u0001w10tgow2u09s`(앱 셸 자동 생성, 03:34:19Z).
- 삭제: 위 5건 전부 정확한 id 로 삭제(남의 행 없음 확인 후 실행). 삭제 후 qa-bot2 Lesson 0·Attendance 0·StudyLog 0·StatsSnapshot 0·RepetitionItem 0·WordEntry 0·TutorProposal 0·LearningObservation 0·AiJob 0·Utterance 0, RequestTrace 60(내가 만든 것 아님, E·F 전후 60→60).
- 복원할 기존 행 변경: 없음(수정한 것은 모두 내 시드 레슨의 progress/stageDone 이었고 삭제됨).
- 정리 확인: dev 서버 PID 1666671·1666685 종료, `ss -ltn` 로 3044 닫힘 확인, QA 쿠키 파일 삭제. 결과 JSON·스크립트·스크린샷은 위 scratchpad 에만 남음. `src/`·git·운영·pm2 변경 없음.

### 판정

**verdict: PASS** — 결함 0건. 화면 항목 D(4상태·4폭)·E(3폭)·F(회귀)·G(시각 증거)를 실측으로 채웠고, 위 NOT_VERIFIED 항목만 남는다. 데모 게이트 상태·frontmatter 는 건드리지 않았다.

## Leader 기록 (025b QA 공백 보정·승격 사실, 2026-10-03 12:44)

- [2026-10-03 12:44] **첫 QA(12:31)의 화면 항목 D·E 는 grep·마크업 단정뿐이라 "PASS" 로 인정하지 않았다.** 새 QA(`qa-025b-screen`, Sonnet)를 "측정한 것만 PASS, 아니면 NOT_VERIFIED" 규칙으로 소환해 실제 렌더링(Playwright·Chrome headless, 360/390/412×780 + 390×892)으로 D(4상태)·E(오늘로 44px·flex-shrink 0)·F(PATCH 5건·/complete 0·행 수 불변)·G(스크린샷)를 다시 측정했다. 결함 0. 이 task 의 화면 PASS 근거는 12:31 기록이 아니라 위 "화면 실측(12:40)" 기록이다.
- **Judge 기록 보충**: intake 결정은 `developer_model=sonnet` 이었으나 REV-066(1차)·REV-069(2차) 가 같은 결함 계열("부정문 오탐")로 2회 연속 반려돼 D-10 승격 규칙에 따라 U4 는 **Opus developer** 가 맡았다(11:20 Leader 기록). 실호출 모델 정리: U1~U3 sonnet, U4 opus.
- **범위 밖 발견 A**(정확 일치 경로 오탐, task-010 부터의 동작)는 025b 에서 고치지 않고 후속 후보로 남긴다. B(`また今度にします`)는 Info. Reviewer 선택 후속(REV-071 `“”` 쌍 추가·REV-072 `避け`/`我慢`·REV-074 테스트 12건)은 별도 소형 task 후보.
- 미실측(사용자 몫): S25+ 실제 WebView, 다크 모드·시스템 글자 크게, 360/412 스크린샷 이미지.
