---
task_id: task-078
role: designer
tags:
  - type/task-record
  - domain/challenge
  - domain/learning
aliases:
  - task-078 designer 가이드 기록
created: 2026-10-19
updated: 2026-10-19
---

# task-078 — Designer 기록 (구현 가이드 확정, `designer-078-guide`)

> 본 이력서 [[task-078-improve-topic-words-level-yield]] 의 designer 가이드 확정 기록. 데모 작성 기록은 [[task-078-designer-record]].
> 승인 데모 `docs/demo/task-078-challenge-level-hint-v1.html` (v1, sha256 `16e5a4622423d30f…` — 이번에 다시 계산해 같음, **수정하지 않음**). 게이트 상태(`check.mjs`)는 건드리지 않았다 — Leader 가 가이드 확인 뒤 `activate`.
> 산출물: `docs/screens.md` §35 (64줄 → 183줄, 14472~14654행. 1~14471행은 소환 전 사본과 바이트 같음 — 다른 절 수정 0).

## 체크포인트
- [23:33] 착수 — 이력서(확정 결정·«데모 v1 사용자 승인»·L1~L5) · 승인 데모 전체(질문·표시 규칙·문구·낭독 표·개발 메모·스크립트 규칙 `noteFor`/`expectShown`) · §35 초안 · §33·§34 형식 읽음. 스크래치 폴더 `designer-078-guide`(새로 만듦).
- [23:34] 코드 읽기(수정 없음): `ChallengeCreateScreen.tsx` `GoalStep`(:316~410, 난이도 fieldset :347~357, `InfoBox` import :53) · `parts.tsx` `InfoBox`(:74) · `logic.ts` `selectedLevel`·`levelRank`·`levelHint`·`levelHintText`(:777~800) · `challengeCopy.ts` `CREATE`(:140~222) · `createParts.tsx` `LevelCompareLine`(:85, `mt-2`) · 시험 `level076.test.ts`·`level076View.test.ts`·`copyNoSeyo.test.ts` · `package.json` test 스크립트(`find src -name '*.test.ts'` — 새 시험 파일 자동 포함).
- [23:35] 데모 자체 시험을 헤드리스 Chrome 으로 재실행(스크래치 사본, file://): 2,220칸 · ★ 실패 0 · 규칙 불일치 0 · 최소 대비 12.14 · 세 폭 × 두 글꼴 표를 QA 대조표 기대값으로 옮김(390·412 값은 이번에 처음 적음 — 카드 윗변 383/618 · 130% 494/617).
- [23:36] §35 확정본 작성 → 사본 대조 후 끼워 넣음.

## 확정한 것
- 머리: «⏳ 사용자 승인 전 초안» → «✅ 승인 데모 v1», 첫 줄 `승인 데모: docs/demo/task-078-challenge-level-hint-v1.html (v1)` + 승인 발화·게이트·sha·확정 조합(질문 1 C2 · 2 a · 3 b · 4 a)·브리핑과 다르게 그린 곳 승인 포함.
- 35-1 확정표 + «검토했으나 채택 안 함» 한 줄(질문 1 A·B·C1 · 2 b·c · 3 a · 4 b·c · `role="note"`) — 채택 안 한 안의 문구·키·표시 규칙은 가이드에서 뺐다.
- 35-2 표시 규칙(★ C2 열만, 측정 근거 포함) · 35-3 문구 1개 `CREATE.wordsNoteHigh`(45자, 자리 = `levelLow` 다음, 문자열 상수) · 35-4 `wordsLevelNote(sel, topicLevel): { steps } | null` + 25칸 손으로 적은 기대값 표 · 35-5 `GoalStep` 지금/바꾼 뒤 마크업(감싸개 클래스 없음, `const wordsNote`, `InfoBox className="mt-2"`) · 35-6 안 바뀌는 것(서버 개선과 배포 순서 의존 없음 포함) · 35-7 낭독 표 · 35-8 파일·시험 ①~④ · 35-9 QA 대조표(데모 상태 10개 → 앱 재현 · 기대값 6줄 · 통과 기준) · 35-10 실기기 6항목 · 35-11 순서 · 35-12 주의·정정.

## 정정 (데모는 고치지 않음 — 가이드가 우선)
1. **상자 요소**: 데모 `<p class="wn">` 한 겹 ↔ 실제 `InfoBox` = `div > div`(p 없음). 보이는 값은 같다(rounded-xl 12 · py-3 px-3.5 · 13px · surface2 · ink · break-keep + anywhere). 시험은 글·클래스로 찾게 적었다.
2. **반환 형태**: 데모 개발 메모 `{ dir: 'up', steps } | null` → `{ steps } | null`(질문 2 a 라 방향이 하나 — `dir` 은 채택 안 한 b 의 흔적).
3. **시험 경계**: 데모 개발 메모 «+1·0·−1·−4 → null» 에 −2·−3 누락 → 25칸 전수.
4. **시험 파일**: 초안 «`logic.test.ts` 에 추가» → 새 `level078.test.ts`. 그리고 **초안이 놓친 것**: 감싸개로 `aria-live` 를 옮기면 기존 시험 두 곳이 깨진다 — `level076.test.ts:269`(소스 정규식 `<p aria-live="polite"…>`) · `level076View.test.ts:56`(`hintText` 정규식). 두 곳의 정규식 갱신을 35-8 에 넣었다(기대 글은 그대로).
- 일치 확인(정정 없음): `CREATE.levelQ`·`levelBody`·`levelHigh`·`levelLow`·`wordsBody`·`q3Title` 글, 여백(기존 줄 `mt-1` = 4px · 비교 줄 `mt-2` · 상자 `mt-2` = 8px), `globals.css` sha256 앞 12자 `a314f18f1807` = 데모 메타, 본문 줄 높이 1.5. 새 문구는 `level076.test.ts` 난이도 이름 가드·`copyNoSeyo.test.ts` 와 충돌 없음(확인).

## developer 가 알아야 할 주의
- **task-076 시험 두 곳이 먼저 깨진다**(위 정정 4) — 고치는 것은 정규식뿐, 기대값은 손대지 않는다.
- `role="status"` 를 쓰지 않는다 — 암묵 `aria-atomic="true"` 라 기존 줄만 바뀔 때(고급 → 최상급) 상자까지 다시 읽어 승인 낭독 표와 달라진다. `aria-atomic`·`role="note"`·`hidden`/`display` 토글도 금지, 넣고 빼기는 조건부 렌더만.
- 조건에 `goal.words`·`wordsBlocked`·내 수준을 넣지 않는다(질문 3 b · 2 a). 쉬운 쪽 분기·방향 필드를 만들지 않는다.
- 130% 판정은 «px130» 모형으로(rem 만 키우면 `text-[13px]` 상자가 안 커져 63px 로 나옴) — QA 에도 같은 말을 적었다.

## 디자인 스킬
- 디자인 스킬: ui-accessibility-reviewer · ui-design-reviewer(가이드 확정 전 점검 — 레이아웃 설계 절은 데모 단계 page-layout-designer 결과를 승인 조합으로 정리) / 자체 점검 P0 0·P1 0·P2 2, a11y Critical 0·Major 0·Minor 2.
  - P2-1 상자 글 13px(InfoBox 값) vs 위 두 줄 12.5px — 재사용을 택한 데모 결정 그대로.
  - P2-2 130% 에서 「오늘의 단어」 카드는 첫 화면에 윗부분만(519/617 · 494/617) — 지금도 스크롤해 보는 자리.
  - a11y Minor-1 합친 live 영역의 TalkBack 실제 낭독은 실기기 미확인(35-10 ①~③).
  - a11y Minor-2 `?again=` 로 처음부터 보이는 상자는 live 로 읽히지 않음(첫 렌더) — 쓸어 넘기면 읽힘, 허용으로 적음.
  - 예방(가이드에 금지로 넣음): `role="status"`(암묵 atomic) 사용 시 Major 가 될 낭독 중복.

## 알려진 한계
- 기대 높이는 데모 모형(합성 글꼴·«글자만 ×1.3»)의 값이다. 실기기 글꼴에서 상자가 3줄이 되면 결함이 아니라 기록 대상으로 적었다.
- QA 대조표의 «주제 N2 × 내 수준 N3» 조합은 앱 주제 목록에 없을 수 있다 — 시험 계정 프로필 변경 또는 정적 렌더 시험으로 대신하도록 적었다.
