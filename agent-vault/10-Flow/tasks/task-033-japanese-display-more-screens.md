---
task_id: task-033
title: "일본어 표시(히라가나·한글) 확장 — AI 평가·단어 카드 뒷면·복습 카드"
status: doing
base_ref: 26b6322
risk_level: "R1"
roles_involved: [leader, judge, designer, developer, reviewer, qa, deployer]
related_tasks: [task-026-improve-hangul-reading, task-030-japanese-display-followup, task-011-ai-evaluation, task-010b-repetition, task-008-vocab-today-words]
tags:
  - type/task
  - domain/ui
  - domain/improvement
aliases:
  - 일본어 표시 확장
  - task-033
created: 2026-10-05
updated: 2026-10-05
demo_gate:
  required: true
  level: "delta"
  status: "approved"
  version: 1
  repo_path: "docs/demo/task-033-japanese-display-more-screens-v1.html"
  artifact_url: "https://claude.ai/artifact/5JrrcmCY9u7N4QepQLoj1u"
  content_sha256: "d84e9574a90d1d1ff2ee2ee3b58cb9084a87391502ad549cd370ea4c5b1b5192"
  decided_by: "judge"
  rule_id: "JV-ui_change"
  approved_by: "user"
  approved_at: "2026-10-05T08:37:38+09:00"
  approval_quote: "task-033 데모 v1 승인"
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: true
---

## 목표 (Leader)
[[task-026-improve-hangul-reading]] 에서 회화방·채팅·오늘의 회화·단어 카드 앞면에 넣은 일본어 표시(한자 위 히라가나·아래 한글 줄·설정의 표시 3칸)를, 범위 밖으로 남겨 둔 화면에도 같은 규칙으로 넣는다.

대상 화면(후보 — 데모에서 확정):
- AI 평가(`src/components/eval/**` — 문항·결과·기록)
- 단어 카드 뒷면(`src/components/vocab/VocabCardFace.tsx` 뒷면·상세)
- 복습 카드(`src/components/lesson/review/**` — 오늘 홈 복습 카드·복습 레슨 문항)

원칙: 공용 `src/components/common/japanese/JapaneseText.tsx`·`displayPrefs.ts` 재사용(새 표시 규칙 만들지 않음), 정답 미노출(평가·카드 앞뒤 정답 노출 규칙 유지 — 읽기 줄이 정답을 흘리면 안 됨), 3폭 360/390/412 잘림 0, 터치 44px.

## 예상 변경 경로
- `src/components/eval/**` · `src/components/vocab/**` · `src/components/lesson/review/**`
- (필요 시) 읽기 분석 요청 대상 확장 — 서버 라우트 #24r 재사용

## 관련 과거 이력 요약
- [[task-026-improve-hangul-reading]]: 데모 v4 승인(F1=A), 표시 설정 Profile 3칸, 읽기 분석은 조각 단위 요청·429 재시도, 화면 A·B 파일 목록.
- [[task-030-japanese-display-followup]]: 토글 44px·말풍선 높이·저장 실패 알림 역할.
- [[task-011-ai-evaluation]]·[[task-008-vocab-today-words]]: 정답 미노출·`textRevealedAt`.
- 승인된 교훈: 없음.

## Judge 판정

```json
{
  "schema": "judge-result@2",
  "engine": "jev",
  "kind": "intake",
  "task_id": "task-033",
  "project": "TheKaiwa",
  "spec_version": "dev-judge@0.2.0",
  "rules_version": "dev-rules@0.5.0",
  "model": "jev-1.13.0",
  "decision": {
    "task_type": "feature",
    "complexity": 1.85,
    "risk": "R1",
    "developer_model": "sonnet",
    "track": "light",
    "demo": {
      "required": false,
      "level": "none",
      "owner": null,
      "rule_id": "DM-light-waive",
      "waived_level": "delta"
    },
    "next": "assign",
    "next_actions": ["assign_developer"],
    "roles": ["developer", "reviewer"]
  },
  "rule_overrides": [
    {"rule_id": "DM-kw-risky-cta"},
    {"rule_id": "TR-light"},
    {"rule_id": "DM-light-waive"}
  ],
  "fallback": null,
  "input_tokens": 1430,
  "cost_usd": 0.00006
}
```

engine: jev
결정: task_type=feature · risk=R1 · developer_model=sonnet · track=light · demo=none/(DM-light-waive) · next=assign
규칙 덮어쓰기: DM-kw-risky-cta, TR-light, DM-light-waive

## Leader 기록 (접수 판정 검토, 2026-10-05)
- judge 판정: light · sonnet · demo none(DM-light-waive, waived_level delta).
- **사용자 결정(2026-10-05 AskUserQuestion)**: "delta 데모 후 구현 (Recommended)" → **standard 로 올림**(데모 delta·designer·QA 복원). 사유: 여러 화면에 표시 줄 신설 + 평가·카드에서 읽기 줄이 정답을 흘릴 위험. override 판정 파일 `/tmp/judge-task-033-intake.leader.json` 으로 `check.mjs init`(drafting·delta·JV-ui_change). developer_model 은 judge 값 sonnet 유지(승격 규칙 적용).
- 착수 순서: 031 → 032 → 033.

## Designer 기록
- [01:13] 데모 v1 작성 — `docs/demo/task-033-japanese-display-more-screens-v1.html`(delta, 토큰 `globals.css@sha256:bf67d6c60da2`, 표시 규칙은 승인 데모 task-026 v4·task-030 v1 그대로, 새 규칙·새 색 없음). `check.mjs lint` **DEMO_LINT_PASSED**.
- [01:13] 상태(18화면, 주소 `#id`, 각각 현재 vs 제안): 평가 푸는 중 `#e-meaning`·`#e-reading`(정답 보호)·`#e-usage`(교차 보호)·`#e-chunk`(한자 없는 말)·`#e-listen`(문장 숨김·내가 한 말)·`#e-listen-rv`(글자로 본 뒤)·`#e-assemble`·`#e-spot` / 평가 결과 `#e-result-w`·`#e-result-t` / 카드 `#c-back`(4지선다 답한 뒤)·`#c-flip`(뒤집기 [뜻 보기])·`#c-long`(긴 뜻·예문 최악)·`#c-result`(세트 결과 목록) / 복습 `#r-home`([자세히] 칩)·`#r-gen`·`#r-items`(① 이번 복습 항목)·`#r-end`(다음 복습·쓴 표현). 조작: 폭 360/390/412 · 높이 780/892 · 표시 3칸 on/off · 읽기 분석 완료/기다리는 중/실패 · 테마. 아래 패널 = 적용 범위 표 + 정답 노출 요약 + 결정 6건(고르면 데모가 그 안으로 다시 그려짐).
- [01:13] 정답 노출 검토(화면마다 오른쪽 "정답 노출 검토" 표): 읽기 쓰기 단어 = 제출 전 히라가나·한글 없음(설정 무관) + 안내 1줄 ★"읽기를 묻는 문항이라 히라가나·한글은 제출한 뒤에 보여 줘요." · 같은 평가 다른 문항 속 그 단어 = 제출 전 그 한자 히라가나 빼고 그 문장 [한글] 숨김(교차 보호, 화면이 가진 문항 목록으로 판단 — 서버 변경 0) · 듣고 답하기 문장 = 제출 전 글자·층 없음(지금 그대로), [글자로 보기] 뒤 표시 · 문장 조립 = 조각 히라가나만(문장 소리 = 순서 힌트, 조각 단독 소리는 조사 소리가 틀릴 수 있음) · 용법 빈칸 문장 = 히라가나만(빈칸 소리 규칙 없음 — 애매하면 숨김) · 평가 번역 층 없음 · 뜻 고르기 [한글]의 가타카나 외래어 뜻 짐작은 그대로(카드 앞면과 같은 정보) · 카드 뒷면 = 답한 뒤에만 보이는 면이라 해당 없음 · 복습 ① 항목 = 문제 전 학습 카드(지금도 뜻 보임)라 새 노출 없음, ③ 읽기 문제 보호 그대로.
- [01:13] 결정 필요(권고 = A 전부): **E1** 평가 푸는 동안 — A 앱 설정 + 정답 보호 / B 제출 전 새 층 없음 · **E2** 평가 도구 줄 — A 문항 카드 위 [히라가나][한글] / B 없음 · **C1** 카드 뒷면 표제어 히라가나 — A 늘 보임(지금 뒷면 읽기처럼) / B 앱 설정 따름 · **C2** 카드 뒷면 예문 [한글] — A 1줄 말줄임 + 자리가 없으면 그 줄만 뺌(번역 우선) / B 예문 히라가나만 · **R1** 복습 칩 — A 수업 표현 칩과 같게(히라가나 + [한글] 12 인라인) / B 히라가나만 · **S1** 범위 경계 — A 세트 결과 단어 목록·복습 종료 "쓴 표현" 칩까지(파일 2개 추가) / B 후보 3화면만. 넣지 않는 곳: 문항 줄 제목 태그·평가 기록 목록(일본어 없음)·한국어 문장 속 「」·입력칸·녹음 중 자막·수업 제목·범위 밖 목록(데모 적용 범위 표 끝 줄).
- [01:13] 검증(헤드리스 Chrome, playwright-core): 18화면 × 360/390/412 × 780/892 = 108 조합 현재·제안 모두 가로 넘침 0 · JS 오류 0 · 외부 요청 0 · 휴대폰 안 엔진명·모델명·task 번호·'후리가나' 0. 변형 108 조합(히라가나 끔·둘 다 끔·기다리는 중·실패·결정 B 전부·다크 360) 가로 넘침 0. 카드 안 잘림: C2-A 기본 배치는 `#c-long` 360×780 에서만 4px(번역 줄) → 자리 없음 처리로 예문 [한글]을 빼서 0, 나머지 조합 0.
- [01:13] 디자인 스킬: layout·component(project-ui-system 미적용 — 학습 앱) / 자체 점검 P0 0·P1 0·P2 3(루비가 한자보다 넓을 때 글자 사이 벌어짐 — 026 과 같은 브라우저 동작 · R1-A 칩이 2줄로 커짐 — 결정 항목으로 · 용법 보기 중 보호된 보기만 층이 없어 모양이 다름 — 정답과는 무관), a11y Critical 0·Major 0·Minor 1(평가 "내가 한 말" 상자가 지금처럼 aria-hidden — 층 추가와 무관, 현행 유지).
- [08:46] 구현 가이드 완료 — `docs/screens.md` **§15-11**(승인 데모 v1, 결정 E1~S1 = A). 절: 15-11-0 레이아웃 설계 · 15-11-1 결정 · 15-11-2 평가 푸는 중(정답 보호 P1~P4 구현 정의 · 교차 보호 키 = READING_INPUT `prompt.surface` 의 마지막 한자까지 어간 · E2 도구 줄 위치·모양 · ★ 문구 `ITEM.readingGuardNote`) · 15-11-3 카드 뒷면(C1 `rubyAlways`·C2 ResizeObserver+useLayoutEffect 1회 측정, 드래그 중 0)·세트 결과 목록 · 15-11-4 복습 칩(R1)·항목 카드·`LessonEnd` 표현 칩(S1) · 15-11-5 평가 결과(모범 답 읽기 줄 삭제·고친 곳 줄 ranges) · 15-11-6 파일·서브태스크 A 평가 6 / B 카드·결과 3 / C 복습 4(공용 `common/japanese` 수정 0) · 15-11-7 데모와 다른 점 ⓐ~ⓕ + Leader 확인 2건 · 15-11-8 QA 14항목. §15-4-6·§15-7 에 §15-11 지시 한 줄씩.
- [08:46] 디자인 스킬: page-layout-designer(레이아웃 설계 절) / 가이드 단계라 데모 자체 점검 수치는 데모 v1 기록 그대로(P0 0·P1 0·P2 3, a11y Critical 0·Major 0·Minor 1)
- [09:12] B 미결(뜻 3줄 꽉 카드 780 번역 11.8px 잘림) 판단: **회귀** — HEAD 구조 같은 내용 합 242.2px, 780 카드 안쪽 ≈280px 에서 ≈38px 여유(잘림 없음). 이번 층이 +71.6px. 결정: C2-A "번역을 지킨다" 안의 측정 대체 규칙으로 **2단계 = 표제어 `[한글]` 줄도 뺌**(C1-A 로 표제어 히라가나는 늘 보여 읽기 정보 유지, −21.5px → ≈9.7px 여유). 예문 1줄·예문 히라가나 빼기·줄간격 축소는 기각. 가이드 `docs/screens.md` §15-11-3 B5(데모 "긴 뜻" 실제 2줄로 정정)·B6 추가, §15-11-8 QA 6 에 2단계 항목. 사용자 확인 불필요로 판단(결정 C1·C2 그대로, 데모 밖 극단 카드에서만) — 최종 보고 한 줄 고지 권고.

## Leader 기록 (데모 승인, 2026-10-05 08:37)
- 사용자 원문 "task-033 데모 v1 승인" → `check.mjs approve` 기록(sha256 d84e9574…). 결정 6건은 데모 기본값 = **권고 A 전부**: E1-A(설정 따름+정답 보호) · E2-A(평가 도구 줄) · C1-A(뒷면 표제어 히라가나 늘) · C2-A(예문 한글 1줄, 자리 없으면 뺌) · R1-A(복습 칩 = 표현 칩 규칙) · S1-A(세트 결과 목록·종료 표현 칩 포함).
- 다음: designer 구현 가이드(`docs/screens.md`) → `check.mjs activate` → developer(judge 값 sonnet, 실호출모델 기록) → reviewer → judge C2 → QA(sonnet) → 배포.

## Leader 기록 (가이드 수용·구현 착수, 2026-10-05)
- designer 가이드 `docs/screens.md` §15-11 수용. 데모와 다른 점 §15-11-7 ⓐ **교차 보호 어간 일치**(마지막 한자까지 — 활용형도 숨김, 숨김 방향만 넓어짐) = 승인 원칙 "정답 노출 0"의 보수적 적용이라 **Leader 채택**(사용자 보고). ⓑ~ⓕ 렌더링 세부 수용.
- "내가 한 말" 상자 스크린리더 비노출은 기존 동작·범위 밖 → 후속 후보.
- `check.mjs activate`. developer 3명 병렬(judge 값 sonnet, 실호출모델=sonnet): A 평가 / B 카드·결과 / C 복습 — 파일 겹침 없음.

## Developer 기록 (C 복습)

- [09:05] demo-gate check `DEMO_GATE_PASSED` / `task: task-033 · status: approved` 확인 후 착수. 실호출모델 = sonnet(judge 값).
- **완료**: 가이드 §15-11-4 R1-A·S1-A. `lesson/review/TeacherWhy.tsx`(`ReviewChips` — `useAnnotations` 한 번, 칩 `min-h-8`·`flex-wrap`·`items-baseline`·`py-1`, `truncate` 제거, 집중 점 `flex self-center` 감쌈, `JaText as="span" leading 2.1` + `HangulLine inline 12`, "외 N개" 칩 `h-8` 그대로) · `review/NextReviewCard.tsx`(모든 묶음 칩 문장을 `Set` 으로 모아 `useAnnotations` 1회, FALLBACK·대기·모름 상태는 목록 비어 요청 0) · `review/ReviewItemsCard.tsx`(`useAnnotations` 1회 — 접힘이어도 요청, 행 `JaText block 17` + `HangulLine as=span 13`, 한자·히라가나 켬·분석 중/완료일 때만 종류 뱃지 `mt-2`, 아니면 `mt-[5px]`, 머리 주석 갱신) · `LessonEnd.tsx`(쓴·써 볼 표현 `useAnnotations` 1회 → `ExprChip ann`; 일반 수업 종료도 함께). 신규 테스트 `lesson/review/__tests__/reviewDisplay.test.ts`(5건).
- **주의점(함정)**: `FocusDot` 를 `<span className="self-center">` 로 감싸면 안쪽 7px 점(인라인 span)이 크기를 잃어 **점이 사라진다** — 실화면 캡처에서 발견, `flex self-center` 로 고치고 테스트 고정. 공용 `common/japanese/**`·서버·modules·api·prisma 변경 0, 화면 코드에 `kanaToHangul`·`pronLine` 0(테스트로 고정).
- **실행 증빙**(전용 미러 `~/.node-local/thekaiwa-dev-033c` = `thekaiwa-dev-030` `cp -al` + `git archive HEAD src` + 내 4파일·테스트 오버레이 — 다른 developer 의 eval/·vocab/ 작업 중 파일은 섞지 않음, 운영 3010·8100 무접촉):
  - `tsc --noEmit --incremental false` **exit 0** · `eslint src/components/lesson` **exit 0**(경고 0).
  - 관련 테스트 `review/__tests__/*.test.ts` + `lesson/__tests__/display.test.ts` **44/44 pass**(신규 5 포함, 회귀 0).
  - 전체 `node --import tsx --test --test-concurrency=1 $(find src -name '*.test.ts')`(집중 점 수정 전 실행) **# tests 1418 · pass 1415 · fail 0 · skipped 3**(skip 3 = 기존). 수정 뒤 관련 44건 재실행 통과.
  - **화면 실측**: dev 앱 `next dev -H 127.0.0.1 -p 3025`(미러, `SPEECH_GATEWAY_URL` = dev venv gateway 127.0.0.1:8197, 난수 내부 시크릿) · QA_ACCOUNT=1 쿠키 · Playwright + google-chrome(isMobile, DSF 2.625). 데이터는 `page.route` 픽스처(#58 오늘·#60 수업 4종(GENERATING·READY·DONE 복습·DONE 새 수업)·#55·표시 설정 GET/PUT) — 읽기 분석(#24r)만 실 gateway. 화면 5종 = 오늘 홈 복습 카드 [자세히] 칩 · 복습 만들기(GENERATING) 칩 · 복습 수업 ① 이번 복습 항목 · 복습 종료(쓴 표현 + 다음 복습 묶음 칩) · 일반 수업 종료(쓴 표현 칩) × 360/390/412 × 높이 780/892 × (히라가나·한글) 켬·켬 / 끔·끔, 390×892 는 켬·끔 / 끔·켬 포함 = **70 회차: 페이지 가로 넘침 0 · 칩 화면 밖 0 · text-overflow ellipsis 0 · 가로 스크롤 상자 0 · 페이지/콘솔 오류 0**. 대표 수치(390×892 켬·켬): 홈 칩 높이 32~96(긴 문장 2줄) · ① 행 109~176; 끔·끔은 홈 칩 전부 32(truncate 없이 min-h-8), 긴 칩만 줄바꿈. 스크린샷 육안 확인: 루비·`[한글]` 12 인라인·집중 점·"외 1개"·종류 뱃지 정렬·다음 복습 묶음 칩 모두 데모 `#r-*` 와 같은 모양.
  - 부수 효과: 홈 진입 시 앱 출석 체크인 POST 가 QA 계정에 1건 쓰임(기존 동작). 그 밖 DB 쓰기 0.
- **정리**: dev 3025·gateway 8197 listener 0 · 쿠키·내부 시크릿·미러 `.env` shred · 임시 스크립트 삭제(스크래치패드 `c033/` 에 스크립트·결과 JSON·스크린샷만 남음, 프로젝트 밖). 미러 `thekaiwa-dev-033c` 는 보존.
- **미커밋 파일(내 것)**: `src/components/lesson/LessonEnd.tsx` · `lesson/review/{TeacherWhy,NextReviewCard,ReviewItemsCard}.tsx` · `lesson/review/__tests__/reviewDisplay.test.ts`(신규). 이 task 의 다른 파일(eval/·vocab/)은 다른 developer 소유.
- **reviewer 중점**: (1) `NextReviewCard` 훅 위치 — 조기 반환 없이 최상단에서 `useAnnotations`, 칩이 안 그려지는 상태는 빈 배열(요청 0) (2) 집중 점 감싸기 `flex self-center` (3) `ReviewItemsCard` 종류 뱃지 `mt-2` 예약 조건이 `JaText` 예약 조건과 어긋날 수 있는 경우 — 분석 `ready` 인데 읽기 조각이 없는 한자 문장(가이드 문구 그대로 loading·ready 로 구현, 어긋나면 뱃지가 3px 낮게 보일 뿐) (4) 칩 높이가 `min-h-8` 이라 단일 줄·루비 없음에서 위쪽 정렬(가이드 ⓕ와 같음).

## Developer 기록 (B 카드·결과)
- [실호출모델 sonnet] 데모 게이트 `check.mjs check` = `DEMO_GATE_PASSED` / task: task-033 (approved v1). commit·push 안 함. 서버·DB·API·네이티브·공용 `common/**` 변경 0.
- **완료(서브태스크 B)**: `vocab/VocabDeck.tsx` — `useWordLayersList` 를 카드 [읽기]와 무관하게 늘 부르고(한글 끔이면 훅이 요청 안 함) `useAnnotations(예문 전부)` 한 번 → `backHangul`·`exampleAnn` props. `vocab/VocabCardFace.tsx` — 뒷면 머리 = `JaText rubyAlways leading=2 rt=11`(C1-A, 앱 히라가나 끔이어도 저장 읽기 루비 보임) + `HangulLine 13`(옆 읽기 칸 삭제) · 예문 `JaText 2.15` + `HangulLine 13 line-clamp-1!` · C2-A 측정(`bodyRef` + 측정 키(카드·면·예문·분석 상태·답·뜻·번역·히라가나 설정·카드 상자 크기·글꼴 틱) 변경 시 `useLayoutEffect` 한 번 → 넘치면 예문 `[한글]` 줄만 뺌, 카드 상자 크기는 `ResizeObserver`, 드래그 이벤트에 건 것 없음) · 순수 판정 `overflowsBody` export. `vocab/WordResultList.tsx` — 목록이 `useWordLayersList` 한 번 → `Row` 에 `ruby`·`hangul`, 옆 읽기 칸 삭제. 테스트 신규 `vocab/__tests__/cardFace.test.ts`(5건).
- **트러블슈팅 기록**: `line-clamp-1` 만 쓰면 `HangulLine` 의 기본 `block` 이 이겨 clamp 가 안 걸린다(computed display `block`, 긴 예문 한글이 2줄로 번져 카드를 넘침 → 불필요하게 줄을 뺌). `[display:-webkit-box]` 도 `block` 을 못 이김 → Tailwind v4 중요 표시 `line-clamp-1!` 로 해결(computed `flow-root`, 1줄 확인).
- **실행 증빙**(전용 미러 `~/.node-local/thekaiwa-dev-033b`, `cp -al` 복제 + src rsync, dev 서버 127.0.0.1:3033 은 끝에 종료·QA 쿠키 삭제, 운영 미러·릴리스 무접촉):
  - `tsc --noEmit` = exit 0 · `eslint src/components/vocab` = exit 0 · 전체 단위 `node --test`(미러 `find src -name '*.test.ts'`, 변경 전 코드 1회) 1423건 pass 1420 / fail 0 / skip 3 · 최종 코드 `src/components` 455건 pass 453 / fail 0 / skip 2 · 신규 `cardFace.test.ts` 5/5.
  - 실화면(실 Chrome, 세션 GET·attempts·표시 설정만 route 가짜 응답 → DB 변경 0, 분석은 실서버 200): 카드 뒷면 4조합(히라가나·한글 = 켬켬/끔끔/켬끔/끔켬) × 360/390/412 × 780/892 × 카드 2장 = 48 측정 전부 PASS — 카드 안 잘림 0(데모 같은 긴 뜻·긴 예문 `#c-long` 조건 포함: 360×780 에서 예문 `[한글]` 만 빠지고 번역 줄 잘림 0, 390·412×780 은 안 빼도 −5.2px 여유, 892 는 전부 보임) · 가로 넘침 0 · 한글 끔 = 표제어·예문 `[한글]` 0 · 히라가나 끔이어도 뒷면 표제어 루비 보임(C1-A) · 옆 읽기 칸 0 · **드래그 중 측정 호출 0**(부분 드래그 앞·중·뒤 `getBoundingClientRect` 카운터 6→6→6). 세트 결과 목록 4조합 × 360×780·390×892·412×892 = 12 측정 PASS — 행 높이 둘 다 켬 96~97px(데모 `#c-result` 제안 96~97 과 같음, 가이드 "약 80" 은 근사치) · 히라가나 끔 = 루비 0 · 한글 끔 = `[한글]` 0 · 행마다 일본어 칸 1개 · 가로 넘침 0 · annotate 전부 200. 스크린샷 확인(360×780 `#c-long` 뒷면 정상).
- **Leader 확인 요청(사양 밖 극단값)**: 뜻이 3줄 clamp 까지 꽉 차고(≈60자) 예문이 2줄·번역 있는 극단 카드는 **780 높이에서 예문 `[한글]` 을 빼도 번역 줄이 11.8px 잘린다**(360/390/412 공통, 892 는 −10.7px 여유로 0). 데모 `#c-long` 의 뜻은 실제로 2줄(57px)이라 4px 시나리오가 통과하지만 3줄이면 한계 초과 — 가이드의 "예문 `[한글]` 줄만 뺀다" 이상의 완화(예: 2단계로 예문 줄수 축소)는 디자인 결정이라 구현하지 않았다. designer 판단 필요.
- 미커밋 파일: `src/components/vocab/{VocabDeck,VocabCardFace,WordResultList}.tsx` · `src/components/vocab/__tests__/cardFace.test.ts`(신규) · 이 task 파일.

## Developer 기록 (B6 — 카드 뒷면 2단계)
- [09:22] 데모 게이트 `check.mjs check` = `DEMO_GATE_PASSED` / task-033 approved v1. commit·push 안 함. 변경 파일: `src/components/vocab/VocabCardFace.tsx` · `src/components/vocab/__tests__/cardFace.test.ts`(B 가 만든 것에 테스트 3건 추가). eval/·lesson/·common/japanese/** 무수정, 서버·네이티브·마이그레이션 0.
- **구현**: 순수 함수 `nextDropLevel(level, overflow)`(올리기만·2 에서 멈춤)·`pickDropLevel(overflowAt[])`(측정값 열 → 0/1/2) export. 컴포넌트는 `drop:{key,level}` 상태 하나 — `dropLevel = wantMeasure && drop.key===measureKey ? drop.level : 0`(키가 바뀌면 0 으로 돌아가 다시 잼). `useLayoutEffect([measureKey, dropLevel])` 안에서 재고 넘치면 `setDrop` → 단계가 바뀌어 효과가 한 번 더 돌고(같은 페인트 전 → 깜박임 0) 안 넘치거나 2 면 멈춘다. 1단계 = 예문 `[한글]` 줄 뺌, 2단계 = 표제어 `[한글]` 도 뺌(`dropLevel >= 1/2 ? null`). 드래그 이벤트·스크롤에 건 것 없음(측정 키·단계만).
- **실행 증빙**(전용 미러 `~/.node-local/thekaiwa-dev-033b` = NFS src rsync, dev 127.0.0.1:3033 은 종료·QA 쿠키 shred 삭제, 운영 미러·릴리스 무접촉):
  - `tsc --noEmit --incremental false` exit **0** · `eslint src/components/vocab` exit **0** · `cardFace.test.ts` **8/8**(기존 5 + 단계 선택 / 올라가기만 / 정적 경계 3) · 전체 단위 `node --import tsx --test --test-concurrency=1 $(find src -name '*.test.ts')` **tests 1452 · pass 1449 · fail 0 · skipped 3**(skip 3 = 기존).
  - 실 Chrome(playwright, 세션 GET·attempts·표시 설정만 route 가짜 → DB 변경 0, 분석은 실서버 200) — 뜻 3줄 꽉(≈60자) + 예문 2줄(루비) + 번역 카드, 히라가나·한글 켬켬:
    - **CHOICE × 360/390/412 × 780 → 2단계**(예문·표제어 `[한글]` 둘 다 빠짐, 번역 여유 **−9.7px = 잘림 0**, 표제어 히라가나 루비 `引{ひ}受{う}` 보임, 가이드 값 ≈9.7px 와 같음) · **CHOICE × 360/390/412 × 892 → 1단계만**(예문 `[한글]` 만 빠짐, 표제어 `[한글]` 보임, 번역 여유 −10.7px, 2단계 0 = 가이드와 같음).
    - **FLIP**(뜻 보기로 뒤집은 뒷면) × 6 조합: 모두 0단계 — FLIP 뒷면은 결과 띠가 없고(자기 채점 전) 카드 상자가 340px 라 같은 최악 내용도 번역 여유 −24.7px 로 안 넘친다(잘림 0·`[한글]` 둘 다 보임). FLIP 에서는 2단계가 필요한 높이가 없어 FLIP 만으로 2단계를 재현하지 못함(작은 높이 680~720 로도 카드 상자가 340px 고정이라 0단계).
    - 중간 사례(뜻 2줄 = 데모 `#c-long` 값): 360×780 만 1단계(2단계로 넘어가지 않음 — 과도 제거 없음 확인), 390/412×780·892 전부 0단계.
    - **기존 회귀**: `ui033b.mjs` 전체(카드 뒷면 48 측정 + 세트 결과 목록 12 측정) = **UI PASS · FAIL 0**(카드 안 잘림 0·가로 넘침 0·C1-A 루비 보임·한글 끔 `[한글]` 0·옆 읽기 칸 0·드래그 중 측정 호출 0). 신규 스크립트 CHOICE 390 부분 드래그 중 `getBoundingClientRect` 22→22(증가 0).
  - 스크린샷 육안(CHOICE 360×780 2단계·390×892 1단계) 확인.
- **관찰(사양 밖, designer 판단)**: CHOICE 360×780 극단 카드(2단계)에서 번역 줄 바로 위에 **숨겨진 3번째 예문 줄의 루비 윗조각**이 번역 줄 위에 잘려 비친다(`line-clamp-2` 가 둘째 줄 아래를 자르는데 3번째 줄 `rt` 가 clamp 상자 밖 여백에 걸림). 번역은 읽을 수 있고 잘림 0 이지만 시각적 잡음. 예문이 3줄 이상으로 넘는 극단 카드에서만 보이며 B 구현 때부터 있던 것(B6 변경과 무관). 필요하면 designer 가 예문 `line-clamp-2` 의 아래 여백/루비 처리 결정.
- 미커밋 파일(B6): `src/components/vocab/VocabCardFace.tsx` · `src/components/vocab/__tests__/cardFace.test.ts`.

## Developer 기록 (A 평가)
- [09:10] 데모 게이트 `check.mjs check` → `DEMO_GATE_PASSED` · `status: approved` (v1). 변경 파일 6개(공용 `common/japanese/**`·서버·modules·api·prisma 수정 0): `eval/displayGuard.ts`(신규) · `eval/__tests__/displayGuard.test.ts`(신규) · `EvalItems.tsx` · `EvalRunner.tsx` · `EvalResult.tsx` · `evalCopy.ts`(`ITEM.readingGuardNote` 문구 1개 — 가이드 원문 그대로). 네이티브·마이그레이션·신규 의존성 0.
- **구현 요점**: `readingGuardKeys`(마지막 한자까지 어간, ⓐ) → `EvalRunner` 가 `detail.items` 로 한 번 계산해 `guard` 를 문항에 전달. P1 `PlainWordBox`(층 부품·분석 없음)+안내 `showReadingGuardNote` · P2 `GJa`(히트 있으면 `guardedRuby`)·`WordBox`(`guardWordRuby`)·`[한글]` 은 `hits.length ? null :` 로 생략 · P3 숨긴 듣기 문장은 분석 목록에 없음 · P4 조립 조각은 히라가나만(한자 없는 조각은 분석 안 함) · 평가에 번역 층 없음. 도구 줄(E2-A)은 시간 초과 띠 다음·문항 카드 바로 위 `DisplayToggles keys=['fu','hg']`. 입장 시 `collectEvalTexts` 로 `useAnnotations` 캐시 데우기(푸는 화면·결과 각 1회). 결과는 보호 없이 히라가나+`[한글]` 13, 고친 곳 줄은 `fixLineRanges`+`ranges`, 모범 답 아래 읽기 줄 삭제.
- **가이드와 다른/보강한 점**: ① 용법 빈칸 앞뒤·조립 조각은 한자 없는 글을 분석 요청에서 뺐다(어차피 그릴 층이 없는데 한글 켬이면 조각마다 요청이 나가는 것을 막음 — 층 결과는 동일). ② `spotSegmentRuby` 에 선택 인자 `hits` 추가(가이드 표 "틀린 곳 찾기 = P2" 를 적용하려면 필요). ③ `guardedRuby` 는 분석 결과에 읽기가 하나도 없거나 조각을 이은 글이 본문과 다르면 null(범위를 믿을 수 없을 때 숨김). ④ `[한글]` 위 여백은 가이드 `mt-0`/`mt-1.5` 대신 기존 선례(`StageSpeak`)대로 `!mt-0`/`!mt-1.5`(HangulLine 기본 `mt-0.5` 를 확실히 이기게). ⑤ 결과 화면 `[한글]` 기다리는 막대는 내 답·정답 상자(색 바탕)에서 `onTint`.
- **실행 증빙**(전용 미러 `~/.node-local/thekaiwa-dev-033a` = `thekaiwa-dev-030` `cp -al` + NFS src/tests rsync, 운영 미러·릴리스 무접촉):
  - `tsc --noEmit --incremental false` → exit **0**
  - `eslint src/components/eval` → exit **0**(출력 없음)
  - `node --import tsx --test src/components/eval/__tests__/displayGuard.test.ts` → **26/26**(순수 24 + 정적 2), 기존 `evalLogic.test.ts` 포함 38/38
  - 전체 `node --import tsx --test --test-concurrency=1 $(find src -name '*.test.ts')` → **# tests 1449 · pass 1446 · fail 0 · skipped 3**(skip 3 = 기존; 동시 작업자의 B·C 테스트 포함 시점)
  - **변이 검사 10건 전부 테스트가 잡음**(미러 사본에서만 적용 후 원복, NFS 무수정): maskPieces 무력화(4개 실패) · 어간→표기 전체(2) · 읽기 쓰기 단어를 분석 목록에(1) · 안내 항상 표시(1) · 숨긴 듣기 문장 목록에(1) · spot 교차 보호 해제(1) · guardHits 항상 빈 배열(6) · 단어 상자 `[한글]` 보호 해제(정적 1) · 조립 조각에 `[한글]` 추가(정적 1) · 읽기 쓰기에 층 부품 사용(정적 1).
  - **실화면**(미러 `next dev -H 127.0.0.1 -p 3043`, QA 계정 쿠키, 네트워크는 `page.route` 로 평가 상세·표시 설정·`/api/v1/text/annotate` 만 fixture — DB 쓰기 0, 헤드리스 Chrome playwright-core, deviceScaleFactor 2.625·isMobile): 푸는 화면 10문항 × (히라가나·한글 4조합 @390×892 + 360/412×892 켬·켬/끔·끔 + 360/390/412×780 켬·켬) = 11조건, **658 체크 · 실패 0** — 읽기 쓰기 단어 층 0 + 안내(둘 다 끔이면 없음)·교차 보호(어간 `注文書`/`注文します`/`注文をお願い`: 그 한자 히라가나 0·그 블록 `[한글]` 0·같은 블록 다른 한자 히라가나 유지)·듣기 문장 글자·층 0·조립 `[한글]` 0·용법 빈칸 `[한글]` 0·일본어 보기 높이 ≈80·780 높이 뜻 고르기 보기 4개 첫 화면 안·도구 줄 알약 32 카드 위·가로 넘침 0·입장 분석 요청 ≤2·문항 이동 재요청 0·두 층 끔 요청 0·읽기 쓰기 단어 단독 분석 요청 0. 결과 화면 8조건 **104 체크 · 실패 0**(한글 줄 켬 시 10줄↑·끔 0, 모범 답 아래 읽기 줄 0, 문항 줄 제목 층 0, 고친 곳 취소선·밑줄, 용법 채운 말 밑줄, 번역 0, 가로 넘침 0). 스크린샷으로 q1·q3·q7·결과 육안 확인.
  - 정리: dev 3043 종료·쿠키·미러 `.env` shred·스크린샷은 scratchpad(프로젝트 밖). 미러 `thekaiwa-dev-033a` 는 보존.
- **reviewer 중점**: ① 읽기 쓰기 단어가 정답 노출 없이 처리되는지(PlainWordBox·분석 목록 제외) ② 교차 보호 어간 키의 과/소 보호(짧은 한 글자 키는 그 글자가 나오는 모든 블록 층을 숨김 — 의도) ③ `GJa` 가 히트 없을 때 공용 경로 그대로인지 ④ 조각 경계 읽기 자르기(`spotSegmentRuby`)와 조각 `aria-label` 원문 유지 ⑤ 결과 `fixLineRanges` 의 `[한글]` 이 고친 문장 분석인지 ⑥ 정적 테스트(보호 분기 되돌리기 방지) 실효성.
- **미커밋 파일(A)**: `src/components/eval/{displayGuard.ts,EvalItems.tsx,EvalRunner.tsx,EvalResult.tsx,evalCopy.ts,__tests__/displayGuard.test.ts}`.

## Developer 기록 (M-1)

- [09:32] REV-104 M-1 수정 — 테스트만 보강(제품 코드 무변경). 변경: `src/components/eval/__tests__/displayGuard.test.ts` 에 ① `guardHits` 글 끝·글 전체가 키인 경계 테스트 1건 ② 정적 테스트 1건(EvalItems.tsx 의 `guardHits(` 호출부 6곳이 전부 `guardHits(글, guard)` — 빈 배열·인자 제거 금지, 함수별 본문 대조 + `spotSegmentRuby(..., sentenceHits)` 전달 확인).
- **변이 검사**(전용 미러 `~/.node-local/thekaiwa-dev-033a`, src rsync 후 변이는 미러 사본에만, 매번 NFS 원본으로 원복·`diff -r` SAME 확인):
  - 변이1 `displayGuard.ts` `i + k.length <= chars.length` → `<` : `not ok 5 guardHits 글 끝 경계` → pass 27 / fail 1
  - 변이2 `UsageSentence` `hits={guardHits(blocks[i], guard)}` → `hits={[]}` : `not ok 28 정적 호출부 6곳` → pass 27 / fail 1
  - 변이3 `JaBlock`·`JaChoice` `guardHits(text, guard)` → `guardHits(text, [])`(2곳) : `not ok 28` → pass 27 / fail 1
  - 원복 후 `displayGuard.test.ts` 28/28.
- **실행 증빙**(미러): `tsc --noEmit --incremental false` exit 0 · `eslint src/components/eval` exit 0(출력 0) · 전체 `node --import tsx --test --test-concurrency=1 $(find src -name '*.test.ts')` tests 1454 · pass 1451 · fail 0 · skipped 3(환경 차 skip, 기존과 동일).
- 미커밋 파일: `src/components/eval/__tests__/displayGuard.test.ts`(task-033 기존 미커밋 파일들과 함께).

## Reviewer 기록 (REV-104, 2026-10-05, standard 트랙 · Read 전용)

**판정: CONDITIONAL_PASS** · Critical 0 · High 0 · Medium 1 · Low 3 · native_change false. 7영역 검토 완료. 코드 수정 없음(변이 검사는 개발 미러 `~/.node-local/thekaiwa` 사본에서만 하고 전부 원복·diff 일치 확인, NFS 무수정).

**재실행(미러 `bash scripts/sync-local.sh` 후)**: `tsc --noEmit --incremental false` exit 0 · `eslint src/components/eval src/components/vocab src/components/lesson` exit 0(출력 0) · 전체 `node --import tsx --test --test-concurrency=1 $(find src -name '*.test.ts')` → tests 1452 · pass 1451 · fail 0 · skipped 1(Developer 증빙 1452/1449/skip 3 과 총수 일치, skip 은 환경 차) · `displayGuard.test.ts` 26/26.
**데모 게이트**: `check.mjs check` = `DEMO_GATE_PASSED`(approved v1, hash verified). `evidence.jsonl` 16행 approve 가 `prompts.jsonl` 109행 사용자 발화 "task-033 데모 v1 승인"(08:37:29)과 같은 세션·시각으로 대조됨 — 에이전트 대리 승인·`.claude/state/demo-gate/` 직접 쓰기 흔적 없음.
**범위**: `git status` 변경 = `src/components/{eval,vocab,lesson}/**` + `docs/screens.md` + vault 뿐. `src/components/common/japanese/**`·`src/modules`·`src/app/api`·`prisma`·`android`·`plugins` 무변경 → 서버·API·DB·네이티브 무변경 확인(`versionCode` 해당 없음).

### 1. 정답 노출 0 — 결함 없음(보호 경로 전수 대조)
- 읽기 쓰기 단어: `ReadingItem` → `PlainWordBox`(층 부품·분석 없음, `EvalItems.tsx:ReadingItem`), 안내 1줄은 `showReadingGuardNote`(둘 다 끔·설정 로드 전이면 없음). `collectEvalTexts` 가 제출 전 목록에서 READING_INPUT·숨긴 듣기 문장을 뺌. 서버 `rows.ts publicPrompt` 가 듣기 `textJa` 를 제출 전에 아예 주지 않으므로(`textHidden:true`) 듣기 문장은 화면·네트워크 어디서도 새지 않음(`textRevealedAt` 이 있을 때만 `textJa` 포함 — 글자로 보기 뒤).
- 교차 보호: 키 = 마지막 한자까지 어간(`guardStem`) — 가나 단어는 키 없음(글자 그대로가 소리라 흘릴 것 없음), 활용형·여러 번 출현·겹침 병합 모두 `guardHits` 가 처리, 겹친 조각 전체 읽기 제거(`maskPieces`, 반쪽 읽기 없음), 분석 결과가 본문과 어긋나면 읽기 자체를 안 그림(`guardedRuby` null = 숨김 방향). 히트가 있는 블록은 `[한글]` 4곳 전부 `hits.length ? null :` 로 생략(정적 테스트가 4줄 고정). 틀린 곳 찾기는 문장 전체 `sentenceHits` 로 조각 루비(`spotSegmentRuby`)와 `[한글]` 둘 다 가림. 조립 조각은 히라가나만·한글 없음. 평가 어디에도 번역 층 없음(정적 테스트).
- 결과 화면(DONE)만 전부 표시: `EvalResult` 는 `readingGuardKeys` 미사용, `modelReading`·`prompt.reading` 글자 그리기 0 — `WordBox` 의 `prompt.reading` 은 `alignWordRuby` 입력으로만 쓰이고(저장 읽기 루비, 뜻 고르기 문항의 정상 층) 읽기 쓰기 단어와 같은 단어면 히트로 지워짐. 화면 코드에 `kanaToHangul`·`pronLine` 호출 0(grep 0 + 정적 테스트).
- 알려둘 구조적 사실(결함 아님): ① 교차 보호는 **화면 층 보호**다 — 보호 블록 문장도 분석 요청은 나가 응답 JSON 에 읽기가 있고(가이드 A-6 이 명시한 수용 사항), 같은 단어가 뜻 고르기 문항이면 #66 payload 의 `prompt.reading` 이 이미 그 읽기다(서버 계약 기존 동작). 개발자 도구를 열어 보는 자기 부정 행위는 범위 밖. ② 수업 복습 ① "이번 복습 항목"에 히라가나가 생겨도 ③ 읽기 문제는 단계 내부 보호(§15-9 ②)가 그대로이고 ① 이해 단계가 이미 026 부터 읽기를 보이던 구조라 새 범주의 노출이 아니다.

### 2. 데모·가이드 일치 — 차이 분류
- 가이드 ⓐ 어간 키(데모는 표기 전체 포함 검사): **implementation**(숨김 방향으로만 넓어짐, Leader 채택 기록 있음 — 정답 노출 0 원칙의 보수적 적용). ⓑ~ⓕ 렌더링 세부: implementation. Developer A 보강 ①~⑤(한자 없는 글 분석 제외·`spotSegmentRuby` 선택 인자·불일치 시 null·`!mt-0`·`onTint`): 층 결과 동일/숨김 방향 — implementation.
- **B6 2단계(표제어 `[한글]` 도 뺌)**: 승인 결정 C2-A "자리가 없으면 그 줄만 뺌(번역 우선)" 의 **측정 대체 규칙**이고 C1-A(표제어 히라가나 늘 보임)가 읽기 정보를 지킨다. 데모에 없는 극단 카드(뜻 3줄 꽉+예문 2줄+번역, 780 높이)에서만 발동하며, 회귀 판정(HEAD 242.2px vs +71.6px) 수치 근거가 있다. 분류 = **implementation(승인 범위 안)**. material 로 올리지 않는다. 단 사용자에게 보이는 줄이 하나 더 빠지는 동작이므로 Leader 의 최종 보고 한 줄 고지(designer 권고)는 유지.
- 지운 요소 5곳 확인: 평가 읽기 15px 줄(`WordBox`)·모범 답 읽기 줄(`EvalResult`, `modelReading` 0)·카드 뒷면 옆 읽기·세트 결과 목록 옆 읽기·`ReviewChips` 말줄임(`truncate` 제거) 모두 diff 로 삭제 확인. `modelReading`·`prompt.reading` 을 화면 글자로 그리는 곳 0.

### 3. 카드 뒷면 — 결함 없음
- C1 늘 보임 예외: 뒷면 표제어 `rubyAlways` + 저장 읽기 `alignWordRuby`(앱 히라가나 끔이어도 보임), 앞면은 기존 `showReading` 규칙 그대로(읽기 퀴즈 모드는 `VocabMode='CHOICE'|'FLIP'` 뿐이라 뒷면 읽기가 문제 정답이 되지 않음).
- C2·B6: 측정은 `useLayoutEffect([measureKey, dropLevel])` 안에서만, 키는 카드·면·예문·분석 상태·정답·뜻·번역·히라가나 설정·`ResizeObserver` 상자·글꼴 틱 — 드래그/스크롤/포인터 이벤트에 건 것 없음(정적으로 확인). `nextDropLevel` 이 올리기 전용·2에서 정지(되돌림 없음), 같은 레이아웃 단계에서 재측정이라 페인트 전 완료(깜박임 없음), 키가 바뀌면 0 으로 돌아가 재측정. 새 분석 응답은 `exampleAnn.s` 문자열만 키에 넣어 객체 정체성 변화로는 재측정되지 않음. `line-clamp-1!`(Tailwind v4 중요 표시)는 `HangulLine` 기본 `block` 을 이기기 위한 필요한 우회로 타당(트러블슈팅 기록 있음).

### 4. 요청 비용 — 결함 없음
`annotationClient` 는 묶음 ≤64문장·클라이언트당 동시 1개·캐시 2,000·중복/진행 중 거름·실패 재시도 상한 2. `VocabDeck` 의 `useWordLayersList`+`useAnnotations(예문)` 는 덱 진입 시 한 요청(10장 ≈ 20문장), `WordResultList` 세 목록·`NextReviewCard`·`ReviewItemsCard`·`LessonEnd` 는 같은 표기 캐시 적중, 평가 입장은 한 묶음(WORDS ≈ 50문장 = 1요청)·결과 1요청. 두 층 끔이면 훅이 요청 0(`needsAnnotation`). 사용자당 60/분 한도에 닿을 구조 아님.

### 5. 6층·훅·접근성 — 결함 없음
엔진명·`speaker_id`·`fetch(`·`Capacitor`·spawn 추가 0(diff grep), 공용 `common/japanese/**` 무수정, 화면 → `@/modules/speech/reading/client` 순수 변환만 사용(기존 공용 부품과 같은 경로), 평가→수업 import 없음. 훅은 전부 조기 반환 앞(`NextReviewCard` 최상단·`WordResultList`·`ReviewItemsCard`·`LessonEnd`, `eslint react-hooks` exit 0). 터치: 조립 조각 `min-h-11`·보기 `min-h-[52px]`·도구 줄 기존 `DisplayToggles` 46px 유지, 칩은 비조작 요소. 일본어 보기는 버튼 안이라 `span` 만 사용, 입력칸·`aria-label` 원문 유지, 조각 `aria-label` 이 원문 문자열.

### 지적
```json
{
  "reviewId": "REV-104",
  "status": "CONDITIONAL_PASS",
  "issues": [
    {
      "issue": "M-1 정답 보호 연결부·경계 변이가 테스트를 통과함(보호 회귀를 못 잡는 테스트 공백)",
      "severity": "MEDIUM",
      "component": "src/components/eval/__tests__/displayGuard.test.ts · EvalItems.tsx:93,133,173,535 · displayGuard.ts:48",
      "risk": "최우선 원칙(정답 노출 0)의 회귀 방어선이 얇다. 누군가 보호 인자를 지우거나 경계를 어긋나게 해도 CI 가 초록이라 읽기 쓰기 정답이 다시 새도 잡히지 않는다",
      "evidence": "개발 미러 사본에서 변이 3건을 넣고 `displayGuard.test.ts` 실행 → 전부 26/26 pass(survived): (a) `guardHits` 의 `i + k.length <= chars.length` → `<` (키가 글 끝에 오면 못 찾음 — 뜻 고르기 단어 상자처럼 글 전체가 키인 가장 흔한 경우, 기존 `guardHits` 테스트의 히트는 전부 글 끝이 아님) · (b) `UsageSentence` 의 `hits={guardHits(blocks[i], guard)}` → `hits={[]}` (용법 빈칸 문장 교차 보호 해제) · (c) `JaBlock`·`JaChoice` 의 `guardHits(text, guard)` → `guardHits(text, [])` (듣기 글자·내가 한 말·옛 틀린 곳·일본어 보기 교차 보호 해제). 반면 Developer 가 보고한 10건은 잡힘(maskPieces 무력화 등은 내 변이 2건 `maskPieces` 경계·`guardedRuby` 본문 일치 검사 제거에서도 실패 2·1건으로 확인) — 즉 순수 함수는 단단하고 **호출부 연결·글 끝 경계**가 비어 있다. 실제 구현은 현재 올바름(결함 아님, 테스트 공백)",
      "recommendation": "코드 변경 없이 테스트만: ① `guardHits('注文', ['注文'])`·`guardHits('勉強を注文', ['注文'])` 처럼 키가 글 끝/글 전체인 케이스 추가 ② 정적 테스트에 호출부 인자 고정 — `JaBlock`·`JaChoice`·`UsageSentence`·`pieceJa`·`WordBox`·`SpotItem` 의 `guardHits(` 첫 인자·둘째 인자(`guard`)가 그대로 쓰이는지(정규식으로 `guardHits(…, guard)` 6곳, `guardHits(…, [])` 0곳) ③ 가능하면 `react-dom/server` `renderToStaticMarkup` 로 ready 상태 + 키 포함 문장에서 `<rt>` 가 없는지 1건. 보강 뒤 reviewer 가 변이 3건 재확인 1회(QA 와 병행 가능)"
    },
    {
      "issue": "L-1 교차 보호 키의 두 가지 구조적 한계(과소 보호 방향, 정답 전체 노출은 아님)",
      "severity": "LOW",
      "component": "displayGuard.ts:41-67 · EvalItems.tsx:535(pieceJa)",
      "risk": "① 읽기 쓰기 단어가 복합어(`注文書`)이고 같은 평가 다른 문항에 그 부분어(`注文`)만 있으면 어간 키 `注文書` 에 안 걸려 `ちゅうもん` 이 보임(정답 `ちゅうもんしょ` 의 대부분). ② 문장 조립 조각은 조각마다 따로 `guardHits` 라 키가 조각 경계에 걸치면(`お`|`願いします`, 키 `お願`) 못 막음",
      "evidence": "① `guardStem('注文書')='注文書'` 이고 `guardHits('注文を', ['注文書'])=[]`. ② `pieceJa` 가 `guardHits(pieces[k], guard)` 로 조각 문자열만 검사(문장 전체 검사 아님 — `SpotItem` 은 문장 전체라 안전). 출제 단어가 복합어이면서 부분어가 같은 평가에 나올 확률·조각이 단어를 쪼개는 확률은 낮음",
      "recommendation": "비차단. 후속 IMP 로: ① 정답 보호 키를 어간 외에 ‘표기 안의 한자 2자 이상 부분열’ 까지 넓힐지 설계 판단(과보호 비용 대비) ② 조립은 `guardHits(pieces.join(''))` 의 범위를 조각 위치로 환산해 검사. 이번 수정 불필요"
    },
    {
      "issue": "L-2 카드 뒷면 극단 카드에서 숨겨진 3번째 예문 줄의 루비 윗조각이 번역 줄 위로 비침(알려진 관찰)",
      "severity": "LOW",
      "component": "src/components/vocab/VocabCardFace.tsx 뒷면 예문 `line-clamp-2`(JaText leading 2.15)",
      "risk": "시각 잡음 — 360×780 에서 뜻 3줄 꽉+예문 3줄 이상+번역인 최악 카드의 2단계에서만. 번역은 읽을 수 있고 잘림 0, 정답·정보 손상 없음. 이번 task 가 예문에 루비를 넣어서 새로 생긴 현상(HEAD 는 루비 없음)",
      "evidence": "Developer B6 기록 관찰 + 가이드 B 6 의 같은 극단 카드. 코드 구조상 `line-clamp-2` 박스 밖의 3번째 줄 `rt` 가 clamp 상자 여백에 걸리는 브라우저 동작으로 판단(실브라우저 재현은 하지 않음 — Read 전용·QA 3폭 확인 항목)",
      "recommendation": "이번 수정에 넣지 않는다(발동 조건이 데모 밖 극단값, 읽기·번역 손상 0). QA 가 360×780 극단 카드를 육안 확인하고 거슬리면 designer 가 후속 IMP 로 예문 상자 높이 고정(`max-height`+`overflow:hidden` 의 루비 여유) 결정. 승인 데모와 다른 동작이 아니라 데모에 없던 극단 입력의 렌더링 잡음 = implementation"
    },
    {
      "issue": "L-3 문서·주석 수치 불일치 두 건(코드 영향 없음)",
      "severity": "LOW",
      "component": "docs/screens.md §15-11-3 C(결과 목록 행 높이 '약 80px') · lesson/review/ReviewItemsCard.tsx(종류 뱃지 `mt-2` 예약 조건)",
      "risk": "QA 체크리스트 기준값이 실측(96~97px)과 어긋나 불필요한 결함 보고를 낳을 수 있음. 뱃지 정렬은 분석 `ready` 인데 읽기 조각이 없는 한자 문장에서 3px 낮게 보일 수 있음(Developer 자체 인지)",
      "evidence": "Developer B 실측: 세트 결과 행 둘 다 켬 96~97px(데모 `#c-result` 제안과 같음), 가이드 값 '약 80' 은 근사치. Developer C 중점 (3)",
      "recommendation": "designer 가 §15-11-3 C 의 행 높이를 96~97 로 정정(문서만). 뱃지 3px 는 허용"
    }
  ],
  "summary": { "critical": 0, "high": 0, "medium": 1, "low": 3 },
  "high_risk_areas": [
    "평가 푸는 화면 정답 노출 0 — 읽기 쓰기 단어(P1) 제출 전 히라가나·[한글]·분석 요청 0, 같은 단어가 뜻 고르기·조각 분류·용법 보기·용법 빈칸·내가 한 말·글자로 본 듣기·옛 틀린 곳·틀린 곳 조각에 있을 때 히라가나·[한글] 0(활용형·글 전체가 키인 경우 포함 — M-1 의 글 끝 경계), 숨긴 듣기 문장 제출 전 글자·층·네트워크 0, 조립 조각 [한글] 0",
    "평가 결과 화면만 전부 표시 — 제출 뒤에 히라가나+[한글] 켜짐, 모범 답 아래 읽기 줄·문항 줄 제목 층 없음, 고친 곳 줄 취소선·밑줄",
    "카드 뒷면 C1(앱 히라가나 끔이어도 표제어 루비 보임)·C2/B6 단계(드래그 중 측정 0, 뜻 3줄 꽉+예문+번역 카드 360/390/412×780 번역 잘림 0·892 는 1단계, 되돌림·깜박임 없음) + 360×780 극단 카드 루비 윗조각(L-2) 육안",
    "복습 칩·종료 표현 칩(두 층 끔이어도 말줄임 없이 줄바꿈, 집중 점 보임, 칩 화면 밖 0)·① 이번 복습 항목(접힘이어도 분석)·복습 종료 다음 복습 묶음 칩 요청 1회",
    "세트 결과 목록 3종·평가 입장 요청 수(annotate ≤ 한두 번, 429 0)·3폭 360/390/412 가로 넘침 0·옆 읽기 칸 삭제 후 일본어 칸 1개",
    "일반 수업 종료 화면의 표현 칩도 같이 바뀐 점(S1-A 승인 단점 항목) 회귀 없음"
  ],
  "native_change": false
}
```

**Developer 모델 품질 가드**: judge `developer_model` sonnet 구현물. 이번이 첫 감사라 반려 0회, 승격 권고 없음.
**Leader 전달**: M-1 은 테스트만 보강하는 소규모 수정(코드 무변경)이라 Developer(sonnet 가능) 1회 후 reviewer 변이 3건 재확인 → judge C2 → QA 순. L-1·L-2·L-3 은 비차단(후속 IMP·문서 정정).

## Reviewer 기록 (REV-105 — REV-104 M-1 재검증, 2026-10-05, Read 전용)

**판정: PASS** · Critical 0 · High 0 · Medium 0(M-1 해소) · Low 0 신규(REV-104 L-1~L-3 유효·비차단) · native_change false. 코드 수정 없음(변이는 개발 미러 `~/.node-local/thekaiwa-dev-033a` 사본에서만, 전부 원복·`diff -r` SAME).
- **제품 무변경**: `src/components/eval/` 제품 파일 최종 수정 08:51~08:55(`displayGuard.ts`·`evalCopy.ts`·`EvalItems.tsx`·`EvalRunner.tsx`·`EvalResult.tsx`), REV-104 판정 09:30 이전. 이후 변경은 `__tests__/displayGuard.test.ts`(09:31) 하나뿐. 미러와 NFS `src` `diff -r` 일치 후 시작.
- **변이 3건 직접 재현(전부 killed)**: ① `displayGuard.ts:48` `<=`→`<` → `not ok 5 guardHits 글 끝 경계` (27/28) · ② `UsageSentence` `hits={guardHits(blocks[i], guard)}`→`hits={[]}` → `not ok 28 정적 호출부 6곳` (27/28) · ③ `JaBlock`·`JaChoice` `guardHits(text, guard)`→`guardHits(text, [])` 2곳 → `not ok 28` (27/28). 추가 변이 3건(`WordBox` `guardHits(word, [])` · `pieceJa` 인자 `''` · `sentenceHits` `[]`)도 전부 `not ok 28` 로 killed. 원복 후 28/28.
- **정적 테스트 취약성 의견**: 호출부 줄 단위 + 함수 본문(`between`) 정규식이라 포맷(줄바꿈·prettier)이나 변수명 `guard` 변경에는 깨진다 — 그러나 제품 코드가 한 줄 JSX 관례이고 실패 메시지가 줄을 지목하므로 *의도적인 리팩터 때 테스트를 같이 고치게 하는 수준*의 허용 가능한 취약성이다. 오탐이 아니라 보호 연결 고정 목적에 부합. 한계: `[^,()]+` 가 인자 안 괄호를 막아 `guardHits(f(x), guard)` 형태 도입 시 거짓 실패 가능(안전 방향). 렌더링(`renderToStaticMarkup`) 방식 보강은 비차단 후속 제안.
- **재실행**: `tsc --noEmit --incremental false` exit 0 · `eslint src/components/eval` exit 0 · `displayGuard.test.ts` tests 28 pass 28 fail 0 · 전체 단위 tests 1454 · pass 1451 · fail 0 · skipped 3(환경 차, Developer 증빙과 일치).
- REV-104 high_risk_areas·L-1~L-3 그대로 QA 로 전달(재감사 없음).

## QA 기록 (QA, 2026-10-05, standard 트랙 · 코드 수정 0)

**판정: PASS** · Critical 0 · High 0 · Medium 0 · Low 3(신규 0 — REV-104 L-1~L-3 재확인 + 문서 수치 1건) · 정보 1건. `NOT_VERIFIED` 항목은 맨 아래 목록.

### 환경·실행 (전부 직접 실행, 운영 3010·8100·`/home/brownjeon/apps/thekaiwa` 무접촉)
- 전용 미러 `~/.node-local/thekaiwa-dev-033q`(= `thekaiwa-dev-033a` `cp -al` + NFS `src·tests·public·prisma` rsync, `diff -rq` 0) · dev `next dev -H 127.0.0.1 -p 3033` + 개발 venv gateway `127.0.0.1:8197`(`run_dev` 규칙, 난수 내부 시크릿) · `APP_ENV=LOCAL` · 쿠키 `QA_ACCOUNT=1`. 화면 데이터는 `page.route` fixture, **읽기 분석(#24r)은 실 gateway(실 `/api/v1/text/annotate`)**. 표시 설정은 설정 GET 만 3칸 덮고 PUT 은 echo(DB 쓰기 0).
- 단위: `tsc --noEmit --incremental false` **exit 0** · `eslint src/components/eval src/components/vocab src/components/lesson` **exit 0**(출력 0) · 전체 `node --import tsx --test --test-concurrency=1 $(find src -name '*.test.ts')` → `# tests 1454 · # pass 1451 · # fail 0 · # skipped 3`(Developer·REV-105 와 일치).
- 데모 게이트 `check.mjs check` = `DEMO_GATE_PASSED` · `status: approved` · `approved_version: v1` · `hash: verified`(승인 데모 v1 = 가이드 §15-11 = 비교 기준).
- **실서버 생성 평가**(QA 계정 단어 10개 시드 → 실 A6): WORDS 14.9s READY 10문항(뜻4·읽기 2(`締切`·`忘れる`)·용법2·분류2) / TALK 18.3s READY 6문항. 끝나고 단어 10·평가 2·AiJob(EVAL_GEN)·Trace 삭제 — QA1·QA2 잔여 단어 0·평가 0·`q033` 단어 0, Profile 표시 3칸 `true/true/false`·updatedAt 불변(DB 쓰기 0 확인). 단어 POST 가 만든 부수 행(출석 등)은 미확인 — 기존 CHAT_REVIEW AiJob 3건·StatsSnapshot 2건은 이번 이전 것.

### 1. 평가 정답 노출 0 — **PASS** (푸는 화면 11조건 975 검사 + 결과 10조건 170 검사 + 실서버 26 검사 + 분석 상태 17 검사)
fixture(합성 17문항: 읽기 쓰기 `注文`·`片付ける`·`締切`·`緊張` + 뜻 고르기·용법·조각 분류·조립·틀린 곳·듣기 숨김/글자로 본 뒤/내가 한 말·상황). 조건 = (켬·켬) 360/390/412 × 780/892(6) + (끔·끔) 390·360·412×892 + (켬·끔)·(끔·켬) 390×892. 문항마다 DOM `ruby`·`[lang=ko]`(한글 발음 sr-only 가진 것)·`innerText`·`aria-label` 수집.
- 읽기 쓰기 4문항: ruby 0 · `[한글]` 0 · 안내 "읽기를 묻는 문항이라 히라가나·한글은 제출한 뒤에 보여 줘요." 원문 일치, **(켬·켬)(켬·끔)(끔·켬) 에서 있음 / (끔·끔) 에서 없음**(11조건 전부). `緊張`(다른 문항에 없는 읽기 쓰기 단어) **분석 요청 본문에 0**(원 출력: 입장 annotate 1회 18문장 `["注文","片付ける","経験","部屋を","片付けた",…]` + 글자로 보기 1회 `["昨日の経験を話してください。"]` — `緊張`·`締切` 단독 문장 없음).
- 교차 보호: 뜻 고르기 단어 상자(`注文`·`片付ける`) ruby 0·한글 0 / 용법 보기 `片付けた`·`注文` ruby 0·**[한글] 보호 아닌 보기만 2개**(`hangul=2`) / 조각 분류 `注文をお願いします` → `注文` ruby 0·`[한글]` 0 이고 같은 칩의 `願{ねが}` 는 보임 / 조립 `注文を` 조각 ruby 0·`店員{てんいん}`·`願{ねが}` 보임·`[한글]` 0 / 틀린 곳 `私{わたし}` 만 보이고 `注文` 0·`[한글]` 0 / 내가 한 말 `昨日{きのう}`·`願{ねが}` 보이고 `注文` 0·`[한글]` 0 / 글자로 본 문장 `決{き}` 만 / 상황 내 답 `締切` 0·`守{まも}` 보임(활용형 어간 키 `片付` 로 `片付けた` 도 보호됨 확인).
- 듣기 문장: 제출 전 일본어 3자 이상 글자 0 · ruby 0 · 한글 0 · 분석 요청 0(실서버 TALK 도 `textHidden:true`, 응답에 `textJa` 없음, annotate 본문 `["部屋を","今から","片付けます","昨日、宿題を忘れましたました。"]` — 듣기 문장 없음). [글자로 보기](소리 500 fixture → 오류 상자 → 버튼) 뒤 `昨日{きのう}の経験{けいけん}を話{はな}して…` + `[키노-노 케-껭오 하나시떼 쿠다사이.]` 보임(대조 층 정상).
- 조립 조각 히라가나만·`[한글]` 0(11조건), 평가 전 화면 번역 층 0(번역 켬 포함), 엔진명·`후리가나` 0.
- 저장 본문(#67): 읽기 `{"answerText":"ちゅうもん"}` · 용법 `{"answerText":"経験"}`·`"壊した"` · 조립 `{"pieceOrder":[0,1,2,3]}` · 틀린 곳 `{"answerText":"おねがい → お願い","spotIndex":1}` — 층 글자·`한글 발음` 혼입 0.
- 결과 화면(9행 전부 펼침, 10조건): 내 답·정답·모범 답·들려준 말·문장에 히라가나+`[한글]` 13 보임(`[츄-몽]`·`[카따즈께루]` ×2·`[하이, 오네가이 시마스.]`), 모범 답 아래 별도 읽기 줄 0(`おねがいします`·`ていしゅつ` 평문 0), 행 제목 태그(`注文` 등) ruby 0, 번역 켬이어도 층 0, 끔·끔 ruby·한글 0 / 한글 끔 한글 0 / 히라가나 끔 ruby 0, 틀린 곳 고친 줄 `私わたしは注文ちゅうもんをおねがい お願ねがいしました。`+`[한글]` 1줄.
- **분석 지연·장애**(문항 8 용법 390×892): `available:false`·429 모두 ruby 0·`[한글]` 0·오류 문구 0·요청 1회(폭주 0)·읽기 쓰기 안내 그대로 / 지연 3.5s: 막대(`animate` 2) → 채워진 뒤 카드 높이 **475→479(+4px)**.
- 요청 수: 입장 annotate **1회**(≤2), 17문항 이동 재요청 **0**(글자로 보기 1회만 추가), 결과 입장 1회, 두 층 끔 **0회**, 읽기 쓰기 단어 `緊張` 단독 0.

### 2. 도구 줄(E2-A) — PASS
문항 이동 줄 아래·문항 카드 위(`aboveCard`·`belowNav`) · `히라가나`·`한글` 2개(번역 없음) · `aria-pressed` = 설정값(켬=`✓`) · 알약 높이 32, **유효 터치(elementFromPoint 로 잰 pseudo 영역) 44px**(위 6 + 32 + 아래 6) · 누르면 즉시 반영(히라가나 끔 → ruby 1→0, 토스트 "히라가나를 숨겼어요 · 모든 화면에 적용돼요") · 780 뜻 고르기 보기 4개 하단 버튼줄 위(`choiceBottom ≤ footerTop`, 3폭). 보기 높이: 뜻 고르기 52 / 일본어 보기 80(켬·켬 가이드 ≈80, 보호된 보기만 58) / 조립·틀린 곳 조각 44.

### 3. 카드 뒷면 — PASS (L-2 육안 의견은 아래)
fixture CHOICE/FLIP 세션 `QAVS1`·`QAVS2`(worst 카드 `引き受ける` 뜻 ≈60자 3줄 꽉 + 예문 `彼は難しい仕事を快く引き受けて…`(2줄) + 번역). 뒷면 번역 줄 아래 여유(px)·`[한글]` 줄 수 실측:
| 조건(켬·켬) | 360×780 | 390×780 | 412×780 | 360×892 | 390×892 | 412×892 |
|---|---|---|---|---|---|---|
| CHOICE | `[한글]` 0줄(**2단계**) 여유 9.7 | 0줄 9.7 | 0줄 9.7 | 1줄(**1단계**) 10.8 | 1줄 10.8 | 1줄 10.8 |
| FLIP | 2줄(0단계) 24.8 | 2줄 24.8 | 2줄 24.8 | 2줄 24.8 | 2줄 24.8 | 2줄 24.8 |
→ 번역 줄 잘림 0(여유 ≥8.8px 전 조합), 892 는 표제어 `[한글]` 보임·예문만 뺌, 780 CHOICE 만 2단계(가이드 B6 와 일치). 뜻 2줄 카드(780): 3폭 모두 1단계·여유 16.7 / 360×892 0단계 17.8. 같은 세트 다음 카드로 넘기면 `[한글]` 2줄·여유 68~80 로 **다시 판정**(c2·c4). (한글 끔 조합: `[한글]` 0·여유 30~135 / 히라가나 끔·한글 켬 390×892 2줄 9.9, 360×780 1줄 8.8.)
- **C1**: 앱 히라가나 끔(끔·끔·끔·켬 조합)에서도 뒷면 표제어 루비 `引{ひ}受{う}` 보임, 카드 [읽기] 끔 상태에서 답하면 뒷면에 루비 2 + `[한글]` 1 보임(앞면은 [읽기] 끄면 ruby 0·한글 0, 켜면 2·1 — 회귀 0). 옆 읽기 칸 평문(`ひきうける`) 0.
- **드래그 중 측정 0**: 카드 안 `getBoundingClientRect` 호출 카운터(`addInitScript` 래핑) 드래그 전·중·더 끌기·놓은 뒤 = `102,102,102,102`(360×780 CHOICE) · `91,91,91,91`(FLIP) · `100,100,100,100`(390×892) — 증가 0.
- 분석 장애(`available:false`·429): 뒷면 저장 읽기 루비 2 유지·`[한글]` 0·오류 문구 0·요청 2회.
- **L-2 육안(스크린샷 360×780 CHOICE 극단 카드 + 뜻 2줄 카드 360×780)**: 예문 2줄째 아래 3번째 줄 `rt` 윗조각이 번역 줄 윗선에 걸려 작은 점·획으로 비친다(루비-번역 겹침 카운트 1, 360폭·780높이에서만 — 390/412 는 0, 한글 끔 360×780 도 1). 번역 글자는 온전히 읽히고 잘림 0 — **거슬림은 낮음**(작은 얼룩 2~3개), 후속 IMP 로 두어도 무방(Low, 발동: 360폭+780높이+예문 3줄 이상).
- 세트 결과 목록(DONE 6조합 + 끔·끔·켬·끔·끔·켬): 행마다 일본어 칸 1개 · 옆 읽기 평문 0 · 행 높이 **96/138/160/97/86/96**(켬·켬; 끔·끔 65~, 가이드 "약 80" 은 근사 — REV-104 L-3 확인) · 최소 56 이상 · 같은 표기 중복 요청 0(annotate 1회·4문장) · 가로 넘침 0.

### 4. 복습 — PASS (907 검사 = 6폭높이 × (켬·켬/끔·끔) × 5화면 + 390×892 (켬·끔)(끔·켬) × 5 + 홈 닫힘)
fixture(홈 #58 복습 카드·GENERATING·① 항목·복습 종료(다음 복습 묶음)·일반 수업 종료, 실 gateway 분석). 홈 [자세히] 칩 7 + "외 1개"·복습 만들기 칩 8·① 항목 8행·복습 종료 칩 12·일반 수업 종료 칩 3: 칩 화면 밖 0 · 말줄임·글자 잘림 0(sr-only 제외) · 두 층 끔에서 ruby 0·한글 0·칩 높이 ≥32 · 긴 칩 `本日はご来店いただき…` 줄바꿈(끔·끔 360 에서 53, 켬·켬 114~118) · **집중 점 7px 보임(`ご予約`·`注文` 칩, 끔·끔 포함)** · ① 별도 읽기 줄(평문) 0 · 접기·펼치기 재요청 0 · annotate 요청 홈 [자세히] 닫힘 **0회**, 열면·gen·items·end·endnew 각 **1회**(중복 문장 0), 두 층 끔 0회. 복습 종료 "다음 복습" 묶음 칩(3일 뒤·5일 뒤)에 루비+`[한글]` 12 인라인+집중 뱃지, 일반 수업 종료 표현 칩에 층(S1-A 의도된 변경) — 회귀 0.

### 5. 3폭×2높이 공통 — PASS
평가 푸는 화면 17문항·결과·카드 뒷면·결과 목록·복습 5화면 모두 360/390/412 × 780/892: `scrollWidth ≤ clientWidth`·`right > clientWidth` 요소 0·페이지 세로 스크롤 0. 터치 44px: 도구 줄 44(유효) · 조립 조각 44 · 틀린 곳 조각 44 · 뜻 고르기 52 · 결과 행 ≥60. 콘솔·페이지 오류 0(소리 fixture 500 리소스 로그 제외) · annotate 전부 200(분석 상태 시험 제외). 다크(390×892): 본문 배경 `rgb(20,24,22)`·평가 문항 8·결과 — 루비·`[한글]` 대비 6.77~7.68(≥4.5)·가로 넘침 0.

### 결함·권고
- **I-1 (정보 · 신규 아님, REV-104 "구조적 사실 ①" 실데이터 재현)**: 교차 보호는 화면 층 보호라 같은 단어가 다른 문항에 나오면 그 문장의 분석 요청은 나가고 응답에 읽기가 있다. **실 A6 WORDS 평가**에서 읽기 쓰기 `締切` 가 용법 보기에도 출제 → annotate 본문에 `"締切"` 포함 → 응답에 `シメキリ`(화면엔 ruby 0·한글 0 — 확인). 가이드 §15-11-8 1항 "네트워크 탭·화면·스크린리더 모두" 문구와는 다름 → **문서에 "교차 보호는 화면 층만, 응답엔 읽기 존재" 수용을 명시하거나**(권고) 보호 문장은 분석 요청에서 빼는 후속 IMP. 차단 아님(자기 부정 행위 범위).
- L-1(문서): §15-11-8 2항 "유효 터치 46" → 실측 **44**(기준 ≥44 충족). L-3(문서, REV-104 재확인): 결과 목록 행 약 80 → 96~97. L-2(디자인 후속 선택): 위 육안.
- 가이드와 차이 없음으로 확인: 읽기 쓰기 안내 문구, 2단계 규칙, 보기 높이, 칩 높이.

### NOT_VERIFIED (실행 못 함 + 사유)
- 실기기·앱 WebView(스크린리더 실제 음성 낭독, 길게 눌러 복사·저장 §15-11-8 12 의 "복사", `prefers-reduced-motion` 막대 멈춤) — 헤드리스 Chrome 에뮬레이션만 했다. 사용자 육안 확인 필요.
- 평가 **실제 제출·채점(A7)·DONE 결과**는 fixture 로만 본다(서버 변경 0 이라 task-011 스모크 범위, 이번 미실행). 결과 화면 `ASSEMBLE` 내 답은 fixture 에서 `answerText:null` 이라 "답하지 않았어요" 로 나옴 — fixture 한계(실서버는 `displayAnswer` 로 채움).
- 평가 소리·M4 TTS·STT·APK(네이티브 변경 0 이라 해당 없음).
- Reviewer 가 짚은 정적 취약성(테스트 정규식)은 재감사하지 않음(Reviewer 소관).

### 정리
- dev 3033·gateway 8197 종료 → `ss -ltn` 3033·8197 비움(운영 3010·8100 은 내 것이 아니며 그대로) · 쿠키 `c1`·`c2`·미러 `.env`·`scratch-*.mts` 삭제 · 미러 `thekaiwa-dev-033q` 삭제 · `/tmp/qa-artifacts/TheKaiwa/task-033` 스크린샷 삭제(정리 개수는 최종 보고). 주의: 미러 준비 중 `cp package.json next.config.ts tsconfig.json eslint.config.mjs` 가 하드링크된 `thekaiwa-dev-033a` 의 같은 이름 4개 설정 파일을 NFS 최신본으로 덮었다(내용은 NFS 와 동일해지는 방향, 코드 무관).

## QA 시각 검증 (재현 조건)
- 브라우저: `/usr/bin/google-chrome`(헤드리스) + `playwright-core`(`~/node_modules`) · viewport 360×780/360×892/390×780/390×892/412×780/412×892 · `deviceScaleFactor 2.625`·`isMobile`·`hasTouch` · `locale ko-KR`·`timezoneId Asia/Seoul` · `reducedMotion: reduce`(애니메이션 비활성) · `colorScheme` light(대표) + dark(390×892 평가) · `document.fonts.ready` + networkidle + 700~1800ms 대기 후 측정 · 네트워크: 평가·세션·수업 데이터는 `page.route` fixture, 설정 GET 3칸 덮기(PUT echo), 읽기 분석은 실 개발 gateway · 캡처 범위: 뷰포트 단위(상태별), 판정 근거는 스크린샷이 아니라 DOM 측정값(위 수치) · 허용 범위: 승인 데모 v1 대비 줄 수·높이 ±4px(분석 채움), 보호 문항은 층 0 이 정답, 그 밖 차이는 Reviewer 분류 기준(implementation) 따름.

## 데모 검토 (demo gate)

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge light → 사용자 결정 delta (JV-ui_change) | 10-05 |
| — | — | — | — | — | — |
| - | 작성중 | - | - | judge: delta (JV-ui_change) | 10-04 23:41 |
| v1 | 검토요청 | docs/demo/task-033-japanese-display-more-screens-v1.html | https://claude.ai/artifact/5JrrcmCY9u7N4QepQLoj1u | 사용자 검토 요청 | 10-05 01:15 |
| v1 | 승인 | docs/demo/task-033-japanese-display-more-screens-v1.html | https://claude.ai/artifact/5JrrcmCY9u7N4QepQLoj1u | "task-033 데모 v1 승인" | 10-05 08:37 |

## 최종 요약


## 판단 기록 (judge) — C2

- [2026-10-05 09:35] codex_gate/C2 engine=jev → codex_required=false · focus=security · reviewer_doubt=0.51 | overrides=- | fallback=- | tokens=1068

## Deployer 기록 (2026-10-05 10:23:57)

배포 상태: ✅ **완료**

| 항목 | 값 |
|------|------|
| **릴리스** | `20261005-102357-c99e0144` |
| **커밋** | `c99e0144852b47b2ef633f7b574cb52d58248a70` (task-033 코드+문서) |
| **이전 릴리스** | `20261005-102315-c99e0144` (웹훅 시작, 미완료) → `20261005-102315-c99e0144` 롤백 불필요 |
| **마이그레이션** | 없음 (`--with-migrate` 미사용, DB 변경 0) |

**Post-Deploy Checks**:
- ✅ `/api/health` → HTTP 200, `data.env="PRODUCTION"`, `status="ok"`, `degraded=[]`
- ✅ pm2 상태: `thekaiwa` / `thekaiwa-speech-gateway` / `thekaiwa-speech-worker` 모두 online, cwd 정상
- ✅ 운영 화면 상태: HTTP 307 (로그인 리다이렉트) 정상
- ⏳ Smoke test: task006-smoke.sh 실행 중 (백그라운드)

**비고**:
- 웹훅이 c99e014 push 에서 배포를 시작했으나 미완료(TypeScript 단계에서 로그 중단)
- 배포자가 수동으로 `scripts/deploy.sh TheKaiwa --yes` 실행해 완료
- 변경 파일: `src/components/{eval,vocab,lesson}/**` + `docs/screens.md` + vault 문서
- 서버/DB/음성 gateway/M4/네이티브 변경 0
- APK 배포 불필요 (네이티브 변경 0)
