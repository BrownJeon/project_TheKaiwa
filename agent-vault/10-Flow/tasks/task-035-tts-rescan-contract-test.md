---
task_id: task-035
title: "TTS 어댑터 재검색 규칙 계약 테스트 + 034 정리(죽은 코드·주석)"
status: done
base_ref: e695d32
risk_level: "R1"
roles_involved: [leader, judge, developer, reviewer, qa]
related_tasks: [task-034-tts-lexicon-compound-guard, task-032-lexicon-to-reading, task-003d-tts-p0]
tags:
  - type/task
  - domain/speech
  - domain/tts
aliases:
  - TTS 재검색 계약 테스트
  - task-035
created: 2026-10-05
updated: 2026-10-05
demo_gate:
  required: false
  level: "none"
  status: "not_required"
  version: 0
  repo_path: ""
  artifact_url: ""
  content_sha256: ""
  decided_by: "judge"
  rule_id: ""
  approved_by: ""
  approved_at: ""
  approval_quote: ""
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: false
---

## 목표 (Leader)
[[task-034-tts-lexicon-compound-guard]] 의 REV-106 지적 중 비차단 후속 정리.

1. **M-1 계약 테스트(핵심)**: 엔진 어댑터 `substituteReadings`(`engine/adapters/tts/styleBertHttp.ts`)가 hint 표기를 **위치 없이 다시 찾는** 규칙을 L4 `rescanHintSurfaces`(`speech/tts/lexicon.ts`)가 손으로 복사해 두었고(`prepareSegments` 가 이 복사본으로 어댑터 동작을 예측해 hint 를 걸러낸다), 둘을 묶는 영구 테스트가 없다. 누가 어댑터를 바꾸면(정렬·위치 기반 치환 등) `明日香`→アシタ香 류가 조용히 되살아나도 테스트는 전부 초록이다. → **입력 → 기대 치환 표를 JSON 픽스처 하나로 두고, L4 테스트(`rescanHintSurfaces` 로 재구성)와 어댑터 테스트(`substituteReadings`)가 같은 파일을 읽어 동시에 검증**한다(층 방향 위반 없이 — import 가 아니라 파일 읽기).
2. **L-2 죽은 코드 제거**: `renderingPlan.ts` 의 `const lead = raw.length - raw.trimStart().length` 는 정규화기 WHITESPACE 규칙이 양끝 공백을 이미 지워 항상 0 이다(변이 M11 이 살아남음). 제거하거나 동작 동치를 증명.
3. **주석 정정**: `speech/reading/lexiconOverlay.ts:5` "표시와 소리가 같은 항목을 고른다" → TTS 는 한자 이웃 규칙(task-034), 화면은 분석기 판정이라 경계 사례에서 갈릴 수 있음을 반영.

범위 밖(이번에 하지 않음): 위치 기반 치환(엔진 계약 변경)·한자 이름+접미어 허용(M-2)·관리자 `notHitText` 문구(designer)·`ヶ` 클래스.

## 예상 변경 경로
- 신규 픽스처(예: `src/modules/speech/tts/__tests__/fixtures/hintRescanCases.json`) — 두 테스트가 `fs` 로 읽는다(교차 모듈 상대 import 금지 ESLint 규칙 때문에 JSON import 대신 파일 읽기)
- `src/modules/speech/tts/__tests__/lexiconCompoundGuard.test.ts`(L4 쪽이 픽스처를 읽도록) · `src/modules/engine/__tests__/ttsAdapter.test.ts`(어댑터 쪽)
- `src/modules/speech/tts/renderingPlan.ts`(L-2, 1~3줄) · `src/modules/speech/reading/lexiconOverlay.ts`(주석 1줄)
- 어댑터 본문·화면·DB·네이티브·프롬프트 변경 없음. 동작 변경 없음(테스트·죽은 코드·주석).

## 픽스처 사례 지침(Leader)
`日本橋駅と日本橋`(최장 일치) · hint 없음 · 표기 중복 제거 · 앞 일치 뒤로 건너뛰기 · `明日香さんは明日来ます`(표기 `明日` 하나 → 재검색이 `明日香` 안도 잡는 현재 동작 = L4 가 보정하는 이유를 기록) · `東京都庁と京都`(`東京都` hint 없이 `京都` hint 만 있으면 어댑터는 `東京都` 안의 `京都` 도 잡는다 — 현재 동작 그대로 고정) · 서로 접두 관계인 표기(`今日`·`今日明日`) · 같은 시작 위치 다른 길이 · 서러게이트 페어 표기(`𠮷`). 기대값은 **현재 어댑터가 내는 값**을 정답으로 고정(어댑터 규칙이 바뀌면 이 표를 같이 고치게 하는 것이 목적 — 의도적 변경 때 두 쪽이 함께 갱신되어야 한다).

## 관련 과거 이력 요약
- [[task-034-tts-lexicon-compound-guard]]: REV-106 M-1·L-2·L-1(주석) 원문, 개발자 17문장 실 어댑터 대조·reviewer 퍼저 30만 건 불일치 0 은 일회성이었음.
- [[task-032-lexicon-to-reading]]: `lexiconOverlay` 규칙·주석.
- 승인된 교훈: 없음(`/이슈기록 관련` 0건).

## Judge 판정

- [2026-10-05 16:56] intake (Leader 가 `judge.mjs --input /tmp/judge-task-035-intake.json` 직접 실행 ×3, 결과 `/tmp/judge-task-035-intake.result.json`, `judge-result@2`·engine=jev·fallback 없음) → task_type=**None**(분류 실패 3회 모두) · complexity=1.16~1.17 · risk=R1 · developer_model=opus(`MD-judge-failed-opus` — 분류 실패 시 opus 안전값) · track=standard · demo=none(not_required) · next=assign · roles=[] (비어 있음).
- **Leader 판단**: judge 가 유형을 못 정해 안전값(opus·standard)으로 나왔다. 복잡도는 낮지만(1.17<2.0) 규칙대로 **judge 값 그대로 따른다**(`실호출모델=opus`, 임의 하향 안 함). 역할은 standard 기본 흐름 developer → reviewer → qa(데모 게이트 없음). 유형 분류 실패 원인은 요약이 "테스트 계약·죽은 코드·주석" 같은 비기능 정리라 규칙 키워드에 걸리지 않은 것으로 추정 — 반복되면 judge 규칙 보강 후보로 `/이슈기록`.
- `check.mjs init` → `not_required` 기록 완료.

## 판단 기록 (judge) — C2

- [2026-10-05 17:45] codex_gate C2 (Leader 가 `judge.mjs --input /tmp/judge-task-035-c2.json` 직접 실행, 결과 `/tmp/judge-task-035-c2.result.json`, `judge-result@2`·engine=jev·fallback 없음) → `codex_required: false` · `wanted_before_budget: false` · `budget_rule: CX-limit-unknown-hold` · `codex_calls_used: 0` · `codex_switch: on`. Codex 는 애초에 필요 없다고 봤다(동작 변경 없는 테스트·주석 정리). 입력 요약에 코드·diff·사용자 데이터 없음. override 없음.
- **Leader 판단(REV-107 반영 분류)**: M-1(서러게이트 사례)·L-1(픽스처 안 엔진 유래 파일명)·L-2(방어 주석 인과)는 `dev-035b` 로 반영 완료(18사례·변이 2건 killed·renderingPlan 주석 2줄만) — Leader 가 diff·사례 수·엔진명 grep 직접 확인(reviewer 가 이미 같은 사례·변이를 검증했으므로 좁은 재감사는 생략). Leader 결정 (b): REV-106 L-2 의 `lead` 제거는 전제("항상 0")가 공백으로 시작하는 표기(`validateLexiconEntry` 는 trim 후 빈 값만 거름 — 관리 입력·CSV·미리듣기·시드는 차단)에서 깨져 **제거하지 않고 주석만**. 후속 후보: `validateLexiconEntry` 공백 시작 표기 거부(별도 task). QA 는 런타임 동작 불변 중심의 가벼운 범위(`qa-035`).

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 해당없음 | - | - | judge: none | 10-05 16:56 |

## Developer 기록

- [17:05] 체크포인트 1 — M-1 계약 테스트
  - 완료: 계약표 `src/modules/speech/tts/__tests__/fixtures/hintRescanCases.json`(17사례, `_note` 에 "어댑터 규칙을 바꾸면 이 표와 rescanHintSurfaces 를 함께 고친다", 사례마다 `why`). expected 는 미러에서 현재 `substituteReadings` 를 먼저 돌려 얻은 값. 두 테스트가 같은 파일을 `readFileSync(join(__dirname, …))` 로 읽는다(speech 테스트의 기존 fixtures 관례 — reading.test.ts·readingLexicon.test.ts): L4 `lexiconCompoundGuard.test.ts` 새 test「계약표(hintRescanCases.json): rescanHintSurfaces 재구성이…」, 어댑터 `ttsAdapter.test.ts` 기존 test 를 계약표 구동으로 교체(옛 단일 예시 2건은 표의 `longest-match`·`no-hints` 로 흡수). 어댑터 테스트는 speech 를 import 하지 않는다(파일 읽기만).
  - L4 `substituted()` 헬퍼: 같은 표기의 읽기를 `hints.find`(첫 번째) → 표기 키 Map(마지막, 어댑터와 같음)으로 바꿈 — 계약표 `duplicate-surface-different-reading` 사례 때문. 운영 영향 없음(사전이 표기 키 Map 이라 L4 는 한 표기에 다른 읽기를 보내지 않는다).
  - 변이(미러 사본, 원복 후 NFS 와 cmp 일치 확인): M1 어댑터 정렬 제거 → killed(`longest-match`) · M2 어댑터 건너뛰기 제거(`i++`) → killed · M3 L4 rescan 정렬 제거 → killed(`longest-match`) · **M4 L4 rescan 중복 제거(Set) 제거 → 생존 = 등가 변이**(`find` 는 같은 문자열 중 첫 것을 돌려줘 중복이 출력에 영향 없음 — 어떤 사례로도 못 잡는다; L4 의 Set 은 최적화일 뿐, 읽기 선택은 헬퍼 쪽이며 M8 로 잡힘) · 추가 M5 어댑터 Map 중복 제거 제거 → killed(`duplicate-surface-different-reading`) · M6 어댑터를 표기별 순차 replaceAll 로 → killed(`skip-after-match-overlap`) · M7 어댑터 빈 표기 가드 제거 → killed(RangeError) · M8 헬퍼 읽기 첫 번째 선택 → killed(`duplicate-surface-different-reading`).
  - 남은 일: L-2(`renderingPlan.ts` lead 제거 + 동치 확인), 주석 정정(`lexiconOverlay.ts`), 실행 증빙.
  - 다음 첫 행동: renderingPlan.ts L-2 편집 → 미러에서 옛/새 prepareSegments 퍼저 비교.
  - 주의점: `lead` 는 "항상 0" 이 **사전 표기에 공백이 없을 때만** 성립(관리 입력 `lexiconRules` BAD_SURFACE_CHAR 가 막음). 읽기 경로 필터 `validateLexiconEntry` 는 공백 시작 표기를 안 막는다 — 퍼저로 영향 범위 확인 예정.
  - 미커밋 파일: `src/modules/speech/tts/__tests__/fixtures/hintRescanCases.json`(신규) · `src/modules/speech/tts/__tests__/lexiconCompoundGuard.test.ts` · `src/modules/engine/__tests__/ttsAdapter.test.ts` · 이 이력서
- [17:10] 체크포인트 2 — L-2·주석·증빙 (구현 완료, Reviewer 인계)
  - 완료: ([17:13] 정정 — 아래 renderingPlan 제거는 Leader 결정 (b)로 **원복됨**, 체크포인트 3) `renderingPlan.ts` `surfacesRescannedElsewhere` 에서 `raw += text.slice(pos)`·`const lead = …` 제거, `at - lead` → `at`, WHY 주석 3줄(raw 는 공백으로 시작하지 않는 근거 = WHITESPACE 규칙 + 관리 입력 BAD_SURFACE_CHAR, 손상 스냅샷이면 hint 가 더 빠질 뿐). `lexiconOverlay.ts` 머리 주석 정정(후보는 같은 `findLexiconMatches`, 거르는 기준은 TTS=`guardCompoundMatches`·화면=분석기 판정 → 복합어 경계에서 표시와 소리가 갈릴 수 있음) — 코드 변경 0.
  - L-2 동치 근거 → **[17:13] 정정: 제거하지 않음**(근거: 공백으로 시작하는 표기 경로 — `validateLexiconEntry` 가 통과시키면 lead≠0, 아래 'Leader 판단 필요' 항목·체크포인트 3). 이하는 공백 없는 표기 한정 분석 기록: ① 원문 앞 공백 run 은 WHITESPACE 규칙이 `''` 로 차지한다(맨 앞이라 prev 없음). 그 run 을 먼저 차지할 수 있는 것은 공백으로 시작하는 보호 구간뿐(다른 규칙은 숫자·기호로 시작하거나 물결표 범위 규칙처럼 앞 글자 lookbehind 필요) ② `''` 로 지워지는 토큰(공백·물결표·이모지·`"`·말줄임) 뒤 공백이 `' '` 가 되려면 앞 글자가 영숫자여야 하는데 영숫자를 `''` 로 지우는 규칙이 없다 ③ 규칙 치환값은 공백으로 시작하지 않는다 → 표기에 공백이 없으면 raw(= normalizeJapanese 의 out) 는 공백으로 시작하지 않아 lead ≡ 0. **퍼저(미러, 옛 HEAD 사본 vs 새)**: 유효 표기(공백 없음) 10만 건 single + 10만 건 split(앞 공백 문장 각 3.67만) diff 0.
  - **Leader 판단 필요(전제 일부 불성립)**: "lead 는 항상 0" 은 사전 표기에 공백이 없을 때만 참이다. 관리 입력(`lexiconRules.parseEntryInput` — normalizeSurface trim + BAD_SURFACE_CHAR)·CSV·미리듣기 draft·시드(lexicon.json 6건 공백 0)는 모두 막지만, **스냅샷 읽기 필터 `validateLexiconEntry`(lexicon.ts:57)는 `trim().length===0` 만 보므로 공백으로 시작하는 표기(` 明日`)가 DB 손상·수동 편집으로 들어오면 통과**한다. 그 경우 옛 코드와 결과가 다르다 — 예 `' 明日京都'`(표기 ` 明日`·`京都`): 옛 hint [京都] → 새 [] . 편향 퍼저 5만 건 중 1.17만 건 차이, **전부 새 쪽이 hint 를 더 빼는 방향(엔진 기본 읽기)**, 새 쪽이 옛 쪽보다 hint 를 더 남긴 경우 0. 선택지: (a) 현 상태 유지(도달 불가 입력·안전 방향) (b) `lead` 3줄 원복 + 공백 표기 사례 테스트로 "죽은 코드 아님" 고정 (c) 별도 task 로 `validateLexiconEntry` 에 공백 거부 추가(lexicon.ts 로직 — 이번 범위 밖). 개발자 권고는 (a)+(c).
  - 선행 공백 고정 테스트: 새 test「앞 공백·지워지는 기호로 시작해도 보호 구간 좌표 = normalizedText 좌표(…task-035 L-2)」— 8입력(` 明日、10時`·`　明日は京都`·`\n明日は京都`·`\t 明日香さんは明日来ます`·`😀 明日は`·`" 明日は東京都と京都`·`〜 明日`·` 東京都庁と京都 `)의 `prepareSegments` 전체 결과(text·normalizedText·hints·rulesApplied)를 deepEqual 로 고정. 기대값은 옛 코드(HEAD 사본)로 먼저 뽑아 새 코드와 같음 확인. 기존「어댑터 재검색 일관성: 정규화가 숫자를 한자로…」의 ` 明日、10時` 단언도 그대로 통과.
  - 실행 증빙(미러 `~/.node-local/thekaiwa`, sync-local 후):
    - `npm run typecheck` → exit 0
    - `eslint src/modules/speech src/modules/engine` → exit 0, 0 problems · `eslint src` → exit 0(경고 5 = 기존 components/settings·admin/trace, 이번 변경 무관)
    - 참고 `npm run lint`(eslint .) → exit 1: 오류 2건은 **미러에만 있는 남의 임시 파일** `tmp-pe/t49.ts`(NFS 저장소에 없음)·경고 `.scratch-021/kb-e2e.mjs` — 이번 변경 무관, 건드리지 않음
    - 관련 단위 `node --import tsx --test` lexiconCompoundGuard·ttsAdapter·ttsLexiconPlan·reading·readingLexicon → 60/60 pass
    - 전체 `npm test` → tests 1468 · pass 1467 · fail 0 · skip 1 (직전 1466 → +2: L4 계약표 test·앞 공백 고정 test, 어댑터 test 는 교체)
    - 변이 재실행(최종 상태): M1·M2·M3·M5·M6·M7·M8 killed, M4(L4 Set 중복 제거 제거) 생존 = 등가 변이. 원복 후 미러↔NFS cmp 일치.
  - 재현 스크립트(저장소 밖): `/tmp/claude-1000/-home-brownjeon-NFS-homes-brownjeon-project-TheKaiwa/729e3300-9a56-4bdf-bda2-ca7f7603c97f/scratchpad/scratch-035/{mutate.mjs,fuzz.ts,corner.ts,leadpin.ts,probe.ts}` — fuzz·corner·leadpin 은 `git show HEAD:src/modules/speech/tts/renderingPlan.ts > ~/.node-local/thekaiwa/src/modules/speech/tts/renderingPlanOld035.ts` 로 옛 사본을 미러에 둔 뒤 미러 아래로 복사해 `node --import tsx` 실행(다음 sync 가 사본을 지운다).
  - 남은 일: 없음(Reviewer). 커밋·푸시 안 함.
  - 주의점: 시작 시 `git status` 는 이 이력서만 untracked 였는데, 작업 중 `CLAUDE.md`·`agent-vault/10-Flow/board.md` 수정이 다른 세션에서 생겼다 — 이 task 와 무관, 건드리지 않음.
  - 미커밋 파일(이 task): `src/modules/speech/tts/__tests__/fixtures/hintRescanCases.json`(신규) · `src/modules/speech/tts/__tests__/lexiconCompoundGuard.test.ts` · `src/modules/engine/__tests__/ttsAdapter.test.ts` · `src/modules/speech/tts/renderingPlan.ts` · `src/modules/speech/reading/lexiconOverlay.ts` · 이 이력서
- [17:13] 체크포인트 3 — L-2 원복(Leader 결정 b)
  - 사유(Leader): `lead` 는 공백으로 시작하는 표기가 손상 스냅샷으로 들어오면 "항상 0" 이 아니고(`validateLexiconEntry` 는 trim 후 빈 값만 거름), 제거 이득(3줄)이 비영 위험보다 작다.
  - 완료: `renderingPlan.ts` `surfacesRescannedElsewhere` 를 HEAD 코드로 되돌림(`raw += text.slice(pos)`·`const lead = …`·`at - lead` 두 곳 복원) + "방어 코드" 주석 2줄. `git diff -- src/modules/speech/tts/renderingPlan.ts` = 주석 2줄 추가뿐(코드 동작 HEAD 와 동일).
  - 새 test「방어(lead): 공백으로 시작하는 표기가 손상 스냅샷으로 들어와도 뒤 hint 좌표가 어긋나지 않는다(task-035 L-2)」— `selectEntries` 를 거치지 않은 직접 만든 Map 사전(` 明日`=アシタ·`京都`=キョート)으로 `' 明日京都'`·`' 明日は京都'` 의 `prepareSegments` 전체 결과를 deepEqual 고정(기대값 HEAD 코드로 산출: hints [京都], rulesApplied 1). **변이 M11(`lead = 0`) → 이 test 로 killed**(미러 사본, 원복 후 cmp 일치). M11 은 "방어 코드, 의도적 유지" 로 기록.
  - 선행 공백 8사례 test 는 이름만「앞 공백·지워지는 기호로 시작하는 문장: prepareSegments 결과 고정(task-035 L-2)」으로 바꿈(기대값 옛 코드 산출 그대로 → 원복 후 통과).
  - 유지: 계약표 17사례·두 테스트·`substituted()` 마지막 읽기 선택·`lexiconOverlay.ts` 주석 정정.
  - 실행 증빙(미러, sync 후): `npm run typecheck` exit 0 · `eslint src/modules/speech src/modules/engine` exit 0(0 problems) · 관련 단위(lexiconCompoundGuard·ttsAdapter·ttsLexiconPlan·reading·readingLexicon) 61/61 pass · 전체 `npm test` tests 1469 · pass 1468 · fail 0 · skip 1(직전 1466 → +3: 계약표·앞 공백 8사례·방어 lead test).
  - 남은 일: 없음(Reviewer). 후속 후보: `validateLexiconEntry` 공백 거부(별도 task, Leader 판단). 커밋·푸시 안 함.
  - 미커밋 파일(이 task): `src/modules/speech/tts/__tests__/fixtures/hintRescanCases.json`(신규) · `src/modules/speech/tts/__tests__/lexiconCompoundGuard.test.ts` · `src/modules/engine/__tests__/ttsAdapter.test.ts` · `src/modules/speech/tts/renderingPlan.ts`(주석 2줄만) · `src/modules/speech/reading/lexiconOverlay.ts`(주석만) · 이 이력서 · `agent-vault/20-Log/2026-10-05.md`(1줄)
- [17:27] 체크포인트 4 — REV-107 지적 반영(신규 소환 developer, 수정 2파일)
  - 완료: **M-1** 픽스처에 `surrogate-pair-inner-surface`(`𠮷田と田`, hints `𠮷田`=ヨシダ·`田`=タ, expected `ヨシダとタ`) 추가 → 18사례. 먼저 미러에서 실제 `substituteReadings` 실행 = `ヨシダとタ`(권고값과 같음), L4 `rescanHintSurfaces` = `[0:𠮷田, 4:田]` → 테스트 헬퍼 재구성도 `ヨシダとタ`. **L-1** `_note` 의 `engine/adapters/tts/styleBertHttp.ts` → `engine/adapters/tts`(픽스처 안 다른 엔진 유래 이름 grep 0, `src/modules/speech/**` 의 `styleBert`/`style-bert` 0건). **L-2** `renderingPlan.ts` 방어 주석 2줄 문구 교체 — 이유를 "정규화기 WHITESPACE 규칙(normalizer.ts 212~217행, `prev===undefined` → `''`)이 앞 공백을 지워 보통 lead=0, 공백으로 시작하는 표기가 손상 스냅샷으로 오면 보호 구간이 앞 공백을 차지해(보호 구간은 normalizer.ts 239~240행에서 원문 그대로 먼저 claim) 0 이 아님" 으로. `git show HEAD:… | diff - 작업본` = `59a60,61` 주석 2줄뿐(코드 줄 변경 0).
  - 사례 수 단언: 두 테스트 모두 `HINT_RESCAN_CASES.length >= 10`(정확 개수 단언 없음) → 테스트 파일 변경 0.
  - 변이(미러 사본 1건씩 → NFS 원본 cp 원복 → `cmp` 일치 확인): **V12** `lexicon.ts` `i += s.length` → `i += [...s].length` ⇒ 두 테스트 22건 중 21 pass/1 fail, L4 계약표 test 가 `surrogate-pair-inner-surface` 에서 실패(actual `ヨシダタとタ`) → **killed**. **V11** 어댑터 `i += h.surface.length` → `i += [...h.surface].length` ⇒ 21 pass/1 fail, 어댑터 계약표 test 실패(사례 루프가 첫 실패 `surrogate-pair-surface` 에서 멈춤 — 새 사례도 단독 probe 로 실출력 `ヨシダタとタ` ≠ 기대 확인) → **killed**. 원복 후 `lexicon.ts`·`styleBertHttp.ts`·픽스처·`renderingPlan.ts` 4개 `cmp` 일치.
  - 실행 증빙(미러 `~/.node-local/thekaiwa`, `bash scripts/sync-local.sh` 후 6개 파일 `cmp` 동일):
    - `npm run typecheck` → exit 0
    - `npx eslint src/modules/speech src/modules/engine` → exit 0(출력 없음, 0 problems)
    - 관련 단위 `node --import tsx --test --test-concurrency=1` ttsAdapter·readingLexicon·reading·ttsLexiconPlan·lexiconCompoundGuard → tests 61 · pass 61 · fail 0
    - 계약 테스트 2개만(미변이) → tests 22 · pass 22
    - 전체 `npm test` → tests 1469 · pass 1468 · fail 0 · skipped 1(`#9 실제 배포 manifest` — 미러에 저장소 speech/models 없음, 기존 skip) · exit 0. 직전과 같은 수치 — 새 사례는 기존 계약표 test 루프 안에서 돈다(새 `test` 케이스 아님).
  - 주의점: 세션 스크래치패드를 다른 에이전트와 공유해 같은 이름 로그(`full.log`)를 쓰면 중간에 섞일 수 있다 — 최종 수치는 내 백그라운드 작업 완료 후 다시 읽은 값. `CLAUDE.md`·`board.md` 변경은 다른 세션 것, 무접촉.
  - 남은 일: 없음(Reviewer 재확인). 커밋·푸시 안 함.
  - 미커밋 파일(이 task): 위 체크포인트 3 목록과 같음(이번에 바뀐 것은 `hintRescanCases.json`·`renderingPlan.ts`(주석) · 이 이력서 · `agent-vault/20-Log/2026-10-05.md`(1줄))

## Reviewer 기록 (REV-107, 2026-10-05, standard 트랙 · Read 전용)

**판정: PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 1 · Low 2 · Info 4. `native_change: false`(plugins·android·capacitor·Manifest 무변경). 어댑터 본문(`engine/adapters/tts/styleBertHttp.ts`)·`lexicon.ts`·화면·DB·프롬프트 **무변경 확인**(`git diff --stat -- src/` = 테스트 2 + 주석 2 파일, 신규 픽스처 1). 데모 게이트는 화면 변경 0 이라 N/A(`demo_gate: not_required`). Medium 이하 전부 **비차단 후속** — QA 진행 가능, Developer 재수정 필수 없음.

### 점검 중점 결과
| # | 결론 |
|---|---|
| 1 계약의 실효성 | **충족(1축만 보강 권고, M-1).** 17사례를 미러에서 실제 `substituteReadings` 로 전수 재실행 → **17/17 기대값 일치**. 축 대응: 최장 일치(`longest-match`·`same-start-different-length`)·건너뛰기(`skip-after-match-overlap`·`skip-after-match-repeat`)·중복 제거(`duplicate-surface-*`)·접두 관계(`prefix-surfaces`)·서러게이트(`surrogate-pair-*`)·빈 hint(`no-hints`)·빈 표기 가드(`empty-surface-ignored`)·같은 표기 다른 읽기(`duplicate-surface-different-reading`)·재검색 현재 동작(`asuka-rescan`·`tokyoto-inner-surface`)·출력 재검색 금지(`no-rescan-of-output`). 정렬 비교 기준(UTF-16 vs 코드포인트)은 같은 위치에서 맞는 표기끼리 접두 관계라 **관찰 불가(동치)** — 사례 부족 아님. 서러게이트 축의 L4 쪽 전진 폭만 미고정(M-1). 추가로 **독립 퍼저 300,000건**(표기 11종 알파벳에 서러게이트·빈 표기·공백, hint 0~4개)으로 어댑터 출력 vs `rescanHintSurfaces` 재구성(테스트 헬퍼와 동일 조립) **불일치 0**. |
| 2 두 테스트가 서로 다른 구현을 같은 표로 | **충족.** L4 `substituted()`(lexiconCompoundGuard.test.ts:32-42)는 `rescanHintSurfaces` 를, 어댑터 테스트(ttsAdapter.test.ts:74-79)는 `substituteReadings` 를 호출. 경로: 어댑터 쪽 `join(__dirname,'..','..','speech','tts','__tests__','fixtures',…)` = L4 쪽 `join(__dirname,'fixtures',…)` — 같은 파일(`src/modules/speech/tts/__tests__/fixtures/hintRescanCases.json`, 두 테스트 모두 실제 17건을 읽어 통과 확인). 사례 수 단언 `>= 10` 있어 빈 파일이면 실패(`.cases` 없으면 TypeError 로도 실패). `substituted()` 의 "같은 표기 → 마지막 읽기" 는 어댑터 `new Map(hints.map(h=>[h.surface,h]))` 의미(값은 마지막, 순서는 첫 삽입)와 같고 `duplicate-surface-different-reading` 으로 변이 V8 이 잡힌다 — **타당**. 운영 영향 없음(L4 는 표기 키 Map 사전이라 한 표기에 다른 읽기를 보내지 않음). |
| 3 변이 재현 | **요구 4건 전부 killed**(아래 표). 개발자의 L4 `Set` 제거 = 등가 판정 **확인**(`sorted` 는 `.find` 에만 쓰여 중복이 결과에 영향 없음 — 변이 V7 생존). 추가 변이 중 **V12 생존 = M-1**. |
| 4 L-2 원복 정확성 | **정확.** `git diff -- renderingPlan.ts` = 주석 2줄 추가뿐, `git show HEAD:… \| diff - 작업본` = `59a60,61` 주석 2줄 외 0(코드 줄 바이트 동일). 주석 사실 확인: `validateLexiconEntry`(lexicon.ts:57)는 `trim().length===0`·40자 상한만 거름 → ` 明日` 통과 ✓, 관리 입력은 `lexiconRules.ts:50,113` `BAD_SURFACE_CHAR`(`\s` 포함)가 차단 ✓, `normalizer.ts:268` `out.trim()` ✓. 따라서 **REV-106 L-2("항상 0")는 공백 시작 표기(손상 스냅샷)에서 전제가 틀렸고 Leader 결정 (b) 가 옳다**(I-3). 새 "방어(lead)" 테스트는 `selectEntries` 를 거치지 않고 `new Map([[' 明日',E(' 明日','アシタ')],['京都',E('京都','キョート')]])` 를 직접 넣는데 `findLexiconMatches` 는 Map 만 읽으므로 우회 타당, 전역 상태·DB·시간 의존 0(순수 함수) → 오염·불안정 요소 없음. 변이 V4(`lead=0`) 가 이 test **하나만** 실패시킴(앞 공백 8사례 test 는 lead=0 이라 초록 — 기대대로). 주석 문구 정확성 → L-2. |
| 5 주석 정확성 | **정확.** `lexiconOverlay.ts:73` 는 `findLexiconMatches` 만 쓰고 `guardCompoundMatches` 를 부르지 않음(grep: 가드 호출은 `renderingPlan.ts:29` 뿐) ✓, "규칙 3 복합어 유지" 는 같은 주석 3번 항목과 일치 ✓. "갈릴 수 있다" 도 사실(분석기가 東京/都 로 끊으면 화면은 `東京` 적용, TTS 가드는 `都` 이웃으로 버림). 코드 변경 0(헤더 주석 한 줄→두 줄). |
| 6 경계·품질 | **이상 없음.** 어댑터 테스트는 `speech/**` import 0(`node:fs`·`node:path` 만, `git diff \| grep speech` 는 경로 문자열·주석뿐), ESLint 교차 모듈 규칙 위반 0. 새 테스트 어디에도 DB·네트워크·운영 경로(`/home/brownjeon/apps/thekaiwa`)·`process.env` 없음(기존 테스트의 prisma 위임 교체는 이번 변경 밖). 픽스처에 사용자 데이터·Secret 0(일본어 예시 단어·읽기 뿐). 엔진명 grep: 새 파일의 `style-bert`·`reazon`·`whisper`·`claude`·`model_id`·`speaker_id` **0건**, 단 파일명 `styleBertHttp.ts` 가 `_note` 에 있음 → L-1. |

### 지적 표
| # | 심각도 | 위치 | 분류 | 재현·근거 | 권고 |
|---|---|---|---|---|---|
| M-1 | MEDIUM | `hintRescanCases.json`(`surrogate-pair-surface`·`surrogate-pair-neighbor`) ↔ `speech/tts/lexicon.ts:175`(`i += s.length`) | 계약 사례 부족(L4 복사본 드리프트 1축 미고정) | 미러에서 `rescanHintSurfaces` 의 전진 폭을 UTF-16 → 코드포인트(`i += [...s].length`)로 바꿔도 두 테스트 **22/22 통과(변이 V12 생존)**. 어댑터 쪽 같은 변이(V11)는 `surrogate-pair-surface` 에 잡히는데 L4 쪽은 두 사례 모두 "매치한 서러게이트 표기의 꼬리에서 다시 시작해도 걸리는 hint 가 없어" 출력이 같다. 이런 "UTF-16 → 코드포인트" 수정은 실제로 나올 만하다(`validateLexiconEntry` 가 이미 `[...s].length` 를 씀). 이 task 의 목적(L4 복사본 드리프트 포착)에 속하는 축이고 Leader 지침에도 서러게이트가 명시돼 있다. | 사례 1건 추가: `{"id":"surrogate-pair-inner-surface","text":"𠮷田と田","hints":[{"surface":"𠮷田","reading":"ヨシダ"},{"surface":"田","reading":"タ"}],"expected":"ヨシダとタ"}` — **검증함**: 어댑터 실출력 `ヨシダとタ`(미변이 22/22 통과), V12 적용 시 L4 계약표 test 실패(21 pass/1 fail). |
| L-1 | LOW | `hintRescanCases.json:2`(`_note`) | 엔진명 표기 위생 | L4 트리(`src/modules/speech/**`)의 파일에 엔진 유래 파일명 `engine/adapters/tts/styleBertHttp.ts` 가 들어 있다. 테스트 자산이고 번들에 안 들어가며 CLAUDE.md grep 패턴(`style-bert`)에도 안 걸려 기계적 위반은 아니다(`speech/` 의 다른 `styleBert` 언급 0건, `lexicon.ts` JSDoc 은 `engine/adapters/tts` 만 씀). | `_note` 를 `engine/adapters/tts 의 substituteReadings` 로(파일명 생략). |
| L-2 | LOW | `renderingPlan.ts:60-61`(방어 주석) | 주석 오도 | "normalizedText = raw.trim() 이라 보통 lead=0" — 인과가 틀렸다: `trim` 이 있다고 `lead` 가 0 인 게 아니다(0 이 아닌 값이 곧 trim 이 지운 양). 실제 이유는 `normalizer.ts:212-217` WHITESPACE 규칙이 앞 공백(`prev===undefined`)을 `''` 로 지워서다. 이 이유가 빠져 있어 다음 독자가 REV-106 L-2 처럼 다시 "죽은 코드" 로 오판해 지울 수 있다(방어 test 가 막아 주긴 함). | "정규화기 WHITESPACE 규칙이 앞 공백을 이미 지워 보통 lead=0 이지만 …" 로 문구 교체(동작 영향 0). |
| I-1 | INFO | `ttsAdapter.test.ts:75`·`lexiconCompoundGuard.test.ts:162` `assert.ok(HINT_RESCAN_CASES.length >= 10)` | 하한 단언 | 17건 중 7건을 지워도 통과(V1 은 `prefix-surfaces`·`same-start-different-length` 로도 잡히는 중복이 있어 지금은 영향 작음). | 선택: `=== 17` 이나 필수 id 목록 단언. |
| I-2 | INFO | 개발자 보고 "M4 = L4 Set 제거 = 등가" | 확인 | V7(Set 제거) 22/22 통과 — `find` 가 첫 일치를 돌려줘 중복이 출력에 영향 없음. 등가 판정 맞음. | 조치 불요. |
| I-3 | INFO | REV-106 L-2 · task-034 | 선행 리뷰 정정 | REV-106 L-2 의 "lead 는 항상 0" 은 공백으로 시작하는 표기가 `validateLexiconEntry` 를 통과하는 손상 스냅샷에서 성립하지 않는다(새 방어 test 로 재현: hints [京都], `lead=0` 이면 hint 소실). 결정 (b) 유지가 맞다. 후속 후보(별도 task, Leader 판단): `validateLexiconEntry` 에 공백·제어문자 거부(관리 입력 `BAD_SURFACE_CHAR` 와 같은 규칙) — 도달 불가에 가깝고 안전 방향이라 급하지 않음. | 조치 불요. |
| I-4 | INFO | V10 (어댑터 빈 표기 가드 제거) | 변이 종료 방식 | 개발자 기록은 `RangeError` 로 killed 인데, 힙 400MB 상한 미러에서는 `i+=0` 무한 루프로 ttsAdapter 테스트 **파일 전체가 프로세스 크래시**(개별 assertion 실패가 아님)로 종료. 기본 힙에서는 시간이 더 걸릴 수 있다(동기 루프라 `node:test` timeout 으로 못 끊음). 테스트 결함 아님 — 사례(`empty-surface-ignored`)는 유효. | 조치 불요(정보). |

### 변이 결과(미러 `~/.node-local/thekaiwa` 에서 1건씩 → NFS 원본 cp 로 원복 → `cmp` 일치 확인, 운영·pm2·운영 포트 무접촉)
| 변이 | 대상 | 결과 |
|---|---|---|
| V1 어댑터 정렬 제거(**요구**) | `styleBertHttp.ts` `.sort(...)` | **killed**(어댑터 계약표 test 1 FAIL) |
| V2 어댑터 건너뛰기 제거(`i++`, **요구**) | `styleBertHttp.ts` | **killed**(2 FAIL: 계약표·합성 요청) |
| V3 `rescanHintSurfaces` 정렬 제거(**요구**) | `lexicon.ts` | **killed**(L4 계약표 test 1 FAIL) |
| V4 `lead = 0`(개발자 M11, **요구**) | `renderingPlan.ts` | **killed — 새 "방어(lead)" test 1건만 FAIL**(앞 공백 8사례 test 는 초록) |
| V5 L4 건너뛰기 `i += 1` | `lexicon.ts` | killed(3 FAIL) |
| V6 어댑터 Map 중복 제거 제거 | `styleBertHttp.ts` | killed(계약표) |
| V7 L4 `Set` 제거 | `lexicon.ts` | **survived = 등가**(I-2) |
| V8 헬퍼 "첫 읽기" 선택 | test `substituted()` | killed(L4 계약표) |
| V9 어댑터 "읽기당 1회만 치환" | `styleBertHttp.ts` | killed(2 FAIL) |
| V10 어댑터 빈 표기 가드 제거(힙 400MB 상한) | `styleBertHttp.ts` | killed(파일 크래시, I-4) |
| V11 어댑터 전진 폭 코드포인트 | `styleBertHttp.ts` | killed(계약표 `surrogate-pair-surface`) |
| V12 L4 전진 폭 코드포인트 | `lexicon.ts` | **survived = 사례 부족(M-1)** — 권고 사례 추가 시 killed 확인 |

12건 중 **10 killed · 생존 2(V7 등가, V12 = M-1)**. 요구 4건(V1·V2·V3·V4) 모두 killed.

### 재실행(개발 미러, `bash scripts/sync-local.sh` 후 7개 파일 `cmp` 동일)
- `npm run typecheck`(NFS 루트에서 실행 → sync 후 미러 `tsc --noEmit`) → exit 0, 출력 0줄.
- `eslint src/modules/speech src/modules/engine` → exit 0, 0줄 · `eslint src` → exit 0(경고 5 = 기존 `components/settings`·`admin/trace`, 이번 변경 무관).
- 관련 단위(`lexiconCompoundGuard`·`ttsAdapter`·`ttsLexiconPlan`·`reading`·`readingLexicon`) → **61/61 pass · fail 0**(개발자 보고와 동일; 새 test 4건: 어댑터 계약표 · 앞 공백 8사례 · 방어(lead) · L4 계약표 모두 실행 확인).
- 전체 `npm test` → **tests 1469 · pass 1468 · fail 0 · skipped 1**, exit 0(개발자 보고와 동일).
- 참고 `npm run lint`(`eslint .`) → exit 1: 오류 2건은 **미러에만 있는 임시 파일** `tmp-pe/t49.ts`(`no-explicit-any`), 경고에 `.scratch-021/kb-e2e.mjs` — 이번 변경 무관(NFS 저장소에 없음).
- 독립 퍼저 300,000건 어댑터 vs L4 재구성 **불일치 0**. 임시 파일(`scratch-rev107/`)·변이는 전부 정리·원복(미러↔NFS `cmp` 일치, NFS `src/` 는 한 줄도 건드리지 않음).

### QA 로 넘기는 high_risk_areas (이번 변경은 테스트·주석뿐 — 런타임 코드 동작 변경 0)
1. **픽스처 untracked** — `src/modules/speech/tts/__tests__/fixtures/hintRescanCases.json` 은 아직 미추적(`git status`: `?? …/fixtures/`, `.gitignore` 에는 안 걸림). 커밋에서 빠지면 깨끗한 체크아웃에서 두 계약 테스트가 ENOENT 로 실패한다 — 커밋 시 함께 포함 확인.
2. **런타임 동작 불변 회귀** — `renderingPlan.ts`·`lexiconOverlay.ts` 는 코드 줄 HEAD 와 바이트 동일(주석만). QA 는 전체 `npm test`(1469/1468/0/1)와 034 회귀(`ttsLexiconPlan`·`lexiconCompoundGuard`)만 재확인하면 충분 — 운영 합성 경로 재점검·배포 필요성은 Leader 판단(번들 동작 변경 0).
3. **M-1 사례 추가 시** — 사례를 더하면 L4·어댑터 두 테스트가 같이 통과하는지(기대 `ヨシダとタ`) 재실행.
4. **방어(lead) test 의 보호** — 이후 `renderingPlan.ts` 정리 때 `lead` 를 다시 지우면 이 test 가 막는지(변이 V4 로 확인함).
5. 화면·네이티브·DB·프롬프트 무변경 — 3폭·실기기·APK 대상 아님.

> 후속(비차단) 권고 요약: M-1 서러게이트 사례 1건 추가(검증된 입력·기대값 위 표), L-1 `_note` 의 어댑터 파일명 제거, L-2 방어 주석 인과 문구 교체, I-1 하한 단언 강화(선택), I-3 `validateLexiconEntry` 공백 거부는 별도 task 후보.

## QA 시각 검증

**해당 없음(N/A)** — 이 task 는 화면(UI) 변경 0(`git diff --name-only -- src/components src/app` = 0줄, 네이티브·DB·프롬프트도 0줄). viewport·DPR·브라우저 재현 조건·스크린샷·3폭(360/390/412)·터치 44px·실기기 항목은 대상이 아니라 **수행하지 않았다**(PASS 로 적지 않고 N/A). 데모 게이트: `node ../.claude/tools/demo-gate/check.mjs check --task …/task-035-….md` → `DEMO_GATE_PASSED · status: not_required · demo: 필요 없음(judge 판정 none)`.

## QA 기록 (QA, 2026-10-05, standard 트랙 · 코드 수정 0)

**판정: PASS (Critical 0 · High 0 · Medium 0 · Low 0 — 결함 0건)** · 비차단 관찰 3건(O-1~O-3) · 런타임 동작 변경 0(주석·테스트·픽스처뿐 — 아래 2 에서 실증) · 화면 변경 0 → 3폭·실기기·APK N/A · dev 서버·M4·DB 쓰기·브라우저 미사용(오프라인 단위만), 운영 `/home/brownjeon/apps/thekaiwa`·pm2·3010·8100 무접촉 · 자동 테스트는 외부 서비스 없이 mock/fixture 만으로 통과.

### 환경·재현 조건
- 코드 = NFS `src/` 미커밋 변경(`ttsAdapter.test.ts`·`lexiconOverlay.ts`(주석)·`lexiconCompoundGuard.test.ts`·`renderingPlan.ts`(주석 2줄) + 신규 `tts/__tests__/fixtures/hintRescanCases.json`) → `bash scripts/sync-local.sh` → 개발 미러 `~/.node-local/thekaiwa`(`diff -rq NFS/src 미러/src` exit 0).
- **변이·클린 체크아웃 시뮬레이션은 격리 사본 `~/.node-local/thekaiwa-qa035`**(src 실복사 · node_modules 하드링크 · `.env` 미복사)에서만 했다 — 다른 에이전트(dev-035·rev-035 등)가 쓰는 미러를 변이하지 않기 위해서다. 사본 기준선 22/22 통과 확인 후 시작. 변이는 NFS 원본을 읽어 사본에 쓰고 매번 NFS 원본으로 복원 + `cmp`.
- 점검 스크립트(저장소 밖 scratchpad `…/scratchpad/qa035/`): `diff035.ts`(HEAD 대비 차분) · `mutate035.mjs`(변이) · `strip.cjs`(주석 제거 비교) — 커밋 대상 아님.

### 항목별 판정

| # | 항목 | 판정 | 근거(핵심) |
|---|---|---|---|
| 1 | 정적·단위 | **PASS** | typecheck exit 0 · eslint(speech·engine) exit 0·0줄 · 관련 5파일 **61/61** · 전체 `npm test` **tests 1469 · pass 1468 · fail 0 · skipped 1**(Developer·Reviewer 보고와 일치, skip = `#9 실제 배포 manifest` — 미러에 `speech/models` 없음, 기존). `npm run lint` exit 1 = 미러 전용 `tmp-pe/t49.ts` 오류 2건(NFS 저장소에 없음)뿐 — 이번 변경 무관 |
| 2a | 런타임 동작 불변(코드 줄) | **PASS** | `git diff -U0` 변경 줄 전부 주석(`//`·` *`), 비주석 변경 줄 **0**. `ts.transpileModule(removeComments)` 해시 HEAD=작업본 두 파일 모두 동일(`renderingPlan.ts` 1f2944547e75aca8 · `lexiconOverlay.ts` 9e8a7f08f3b337f2) |
| 2b | 런타임 동작 불변(차분) | **PASS** | 미러에서 HEAD 사본 vs 작업본 `prepareSegments` **240,648건 비교 차이 0**(고정 54문장 × 사전 4종(시드 6·시드+확장 15·공백 표기 손상 Map·빈) × 옵션 3종 + 무작위 80,000문장 × 옵션 3종, hint ≥1 인 입력 19,572건). 비교 대상은 `text·normalizedText·hints·rulesApplied` 전체(JSON 직렬화). 가드가 실제로 도는 입력(`明日香さん`→hints `["明日香"]`(확장 사전)·`[]`(시드·손상))도 포함 |
| 3 | 계약 테스트 독립 재현(변이) | **PASS** | 요구 3건 + 추가 5건 **8/8 killed**, 매번 `cmp` 원복 일치. (i) 어댑터 정렬 제거 → 어댑터 계약표 FAIL · (ii) L4 `i += [...s].length` → L4 계약표 FAIL(expected `ヨシダとタ` actual `ヨシダタとタ` = `surrogate-pair-inner-surface`) · (iii) `lead = 0` → 새 "방어(lead)" test **하나만** FAIL |
| 4a | 커밋 누락 방지 — 무시 규칙 | **PASS(커밋 필요, O-1)** | `git check-ignore -v` exit 1(안 걸림) · `ls-files --others --exclude-standard` 에 표시 · `git add -n` 이 추가 대상으로 표시. **아직 untracked** — 커밋에 포함해야 한다 |
| 4b | 클린 체크아웃 경로 독립 | **PASS** | `git archive HEAD src` + 변경 4파일 + 픽스처를 **다른 깊이의 경로**(`…/chk-elsewhere/deep/er/checkout`)에 풀어 두 테스트 파일 실행 → **22/22 통과**. 대조: 픽스처만 빼면 두 파일 모두 로드 단계 `ENOENT`(tests 2 · fail 2) — 조용히 통과하지 않고 크게 실패 |
| 5 | 경계 | **PASS** | `ttsAdapter.test.ts` import 8줄 중 speech 경로 import **0**(`node:fs`·`node:path` 추가뿐, 픽스처는 `join(__dirname,…)` 파일 읽기) · ESLint 교차 모듈 경계 위반 0(항목 1 eslint exit 0) · `src/modules/speech/**` 변경 `+` 줄과 픽스처의 엔진 유래 이름(`style-bert`·`styleBert`·`sbv2`·`reazon`·`whisper`·`sherpa`·`model_id`·`speaker_id`·`claude`·`qwen`·`zipformer`) **0건**, `speech/**` 전체 grep 건수 HEAD 30 = 작업본 30(증가 0) |
| 어설션 | 완화 여부 | **PASS** | 기존 L4·어댑터 단일 예시 2건(`日本橋駅と日本橋` 최장 일치·`そのまま`)은 픽스처 `longest-match`·`no-hints` 로 **같은 기대값** 그대로 흡수. 픽스처 18사례(id 중복 0, 필수 키 5종 전 사례 존재, `surrogate-pair-inner-surface` 포함) · `_note` 에 엔진 파일명 없음 |
| 화면 | 3폭·터치·safe-area·XSS·엔진명 노출 | **N/A** | UI 변경 0(위 "QA 시각 검증") |
| 실기기 | STT·TTS 재생·APK | **N/A** | 네이티브·앱 무변경 |
| 지표 | p50/p95·세트 소요·기록률 | **N/A** | 런타임 변경 0 — 측정 대상 아님 |

### 결함
**0건.**

### 비차단 관찰
- **O-1 픽스처 untracked**: `src/modules/speech/tts/__tests__/fixtures/hintRescanCases.json` 은 지금 `??` 상태. 커밋에서 빠지면 깨끗한 체크아웃에서 두 계약 테스트 **파일 전체**(어댑터 테스트 15건·L4 테스트 포함)가 `ENOENT` 로 로드 실패한다(4b 대조 실증). → 커밋 시 이 파일을 반드시 포함(Leader·Deployer 인계 메모).
- **O-2 사례 수 하한 단언 `>= 10`**(Reviewer I-1 과 동일): 18사례 중 8건까지 지워도 통과한다. 결함 아님(변이 8/8 은 하한 위에서 모두 killed), 선택 보강.
- **O-3 `npm run lint` 잡음**: 미러에만 있는 남의 임시 파일 `tmp-pe/t49.ts`(`no-explicit-any` 오류 2·경고 1)·`.scratch-021/kb-e2e.mjs`(경고 1) + 기존 `src/components` 경고 5(`react-hooks/set-state-in-effect`) — 모두 이번 변경 무관, 이 변경 파일은 0건. 미러 정리는 Leader 판단.

### NOT_VERIFIED
- 없음(요구 5개 항목 전부 실행). 요구 밖이라 QA 가 재현하지 않은 것: Reviewer 변이 V8(헬퍼 "첫 읽기" 선택)·V9·V10(빈 표기 가드 제거 — 힙 상한 미러에서 무한 루프 크래시 위험이라 일부러 안 돌림). 라이브 M4·실서비스·화면·실기기는 이 task 범위 밖(N/A).

### 정리 확인
- **산출물 정리: 스크린샷·브라우저 산출물 0개(만든 적 없음, 삭제 0개).**
- **프로세스 정리**: dev 서버·gateway·Playwright 를 띄우지 않음. `ss -ltn` → 3010·8100 만 LISTEN(기존 운영), 3011·3012·8197 비어 있음.
- 미러 임시물: `src/modules/speech/tts/_qa035head/`·`tests/_qa035/` 삭제(잔존 0). 격리 사본 `~/.node-local/thekaiwa-qa035`(체크아웃 시뮬레이션 포함) 삭제 → `ls -d ~/.node-local/thekaiwa*` 에 `-qa035` 없음, 미러 `node_modules` 엔트리 394→394 · `tsx`·`tsc` 정상(삭제 후 `lexiconCompoundGuard` 15/15).
- 원복: 변이 8/8 `cmp` 일치 + 사본 `diff -rq NFS/src 사본/src` exit 0 + NFS `git status` 변경 집합이 QA 시작 시와 동일(QA 가 쓴 파일 = 이 이력서와 `20-Log/2026-10-05.md` 1줄뿐). `src/**`·`prisma/**`·`speech/**`·`plugins/**` 수정 0.

### 실행 명령과 원 출력

**1. 정적·단위**
```
$ bash scripts/sync-local.sh ; (cd ~/.node-local/thekaiwa && diff -rq <NFS>/src src)
sync exit=0
diff -rq src exit=0

$ npm run typecheck > typecheck.log 2>&1; echo "typecheck exit=$?"
> thekaiwa@0.1.0 typecheck
> bash scripts/sync-local.sh && cd $HOME/.node-local/thekaiwa && node node_modules/typescript/bin/tsc --noEmit

typecheck exit=0

$ node node_modules/eslint/bin/eslint.js src/modules/speech src/modules/engine ; echo "eslint exit=$?" ; wc -l eslint.log
eslint exit=0
0 eslint.log

$ node --import tsx --test --test-concurrency=1 src/modules/speech/tts/__tests__/lexiconCompoundGuard.test.ts src/modules/engine/__tests__/ttsAdapter.test.ts src/modules/speech/__tests__/{ttsLexiconPlan,reading,readingLexicon}.test.ts
related exit=0
# tests 61   # suites 0   # pass 61   # fail 0   # cancelled 0   # skipped 0   # todo 0   # duration_ms 1624.113708
ok 1 - 플랫폼 치환(방식 A 강등): 계약표(hintRescanCases.json) — 표기 → 가타카나 읽기, 최장 일치·건너뛰기·중복 제거
ok 54 - 앞 공백·지워지는 기호로 시작하는 문장: prepareSegments 결과 고정(task-035 L-2)
ok 55 - 방어(lead): 공백으로 시작하는 표기가 손상 스냅샷으로 들어와도 뒤 hint 좌표가 어긋나지 않는다(task-035 L-2)
ok 56 - 계약표(hintRescanCases.json): rescanHintSurfaces 재구성이 어댑터 substituteReadings 와 같은 문장을 낸다

$ npm test > npm-test.log 2>&1   (bash scripts/sync-local.sh && node --import tsx --test --test-concurrency=1 $(find src -name '*.test.ts' | sort))
npm test exit=0
# tests 1469   # suites 0   # pass 1468   # fail 0   # cancelled 0   # skipped 1   # todo 0   # duration_ms 45351.745139
ok 1273 - \#9 실제 배포 manifest(speech/models/reazonspeech-int8) 통과 — 저장소가 보이는 곳에서만(미러는 THEKAIWA_REPO) # SKIP 저장소 speech/models 가 없는 실행 위치(미러) — …

$ npm run lint > lint.log 2>&1 ; echo "lint exit=$?"
lint exit=1
.../.scratch-021/kb-e2e.mjs            17:3  warning  Expected an assignment or function call and instead saw an expression
.../src/components/admin/trace/DiagnosticsScreen.tsx        137:10 warning (react-hooks/set-state-in-effect)
.../src/components/settings/{LearningSettings 106:10, OnDeviceDiagnosticsCard 71:10, SpeechSettings 59:10, VoiceSettings 80:10}.tsx  warning (같은 규칙)
.../tmp-pe/t49.ts   3:7 warning 'fx' is assigned a value but never used · 4:12 error Unexpected any · 7:140 error Unexpected any
✖ 9 problems (2 errors, 7 warnings)
$ ls tmp-pe   (NFS 저장소)   →   ls: cannot access 'tmp-pe': No such file or directory
```

**2a. 런타임 코드 줄 불변**
```
$ git -c safe.directory=$PWD diff -U0 -- src/modules/speech/tts/renderingPlan.ts src/modules/speech/reading/lexiconOverlay.ts | grep -E '^(diff|@@|\+|-)'
diff --git a/src/modules/speech/reading/lexiconOverlay.ts b/src/modules/speech/reading/lexiconOverlay.ts
@@ -5 +5,2 @@
- * 읽기 요청에는 레슨·주제 문맥이 없다. 매칭은 TTS 와 같은 최장 일치(`findLexiconMatches`)라 표시와 소리가 같은 항목을 고른다.
+ * 읽기 요청에는 레슨·주제 문맥이 없다. 후보 일치는 TTS 와 같은 최장 일치(`findLexiconMatches`)지만 거르는 기준이 다르다 — TTS 는 한자 이웃
+ * 규칙(`guardCompoundMatches`, task-034), 화면은 아래 분석기 판정(규칙 3 복합어 유지 등)이다. 그래서 복합어 경계 사례에서는 표시와 소리가 갈릴 수 있다.
diff --git a/src/modules/speech/tts/renderingPlan.ts b/src/modules/speech/tts/renderingPlan.ts
@@ -59,0 +60,2 @@ function surfacesRescannedElsewhere(text: string, n: NormalizationResult, matche
+  // 방어 코드: 정규화기 WHITESPACE 규칙이 원문 앞 공백을 이미 지워 보통 raw 는 공백으로 시작하지 않고 lead=0 이지만, 공백으로 시작하는 표기가
+  // 손상 스냅샷으로 들어오면(validateLexiconEntry 는 trim 후 빈 값만 거른다) 보호 구간이 앞 공백을 차지해 0 이 아니다 — 빼면 그 입력에서 hint 가 더 빠진다(task-035, REV-106 L-2).
non-comment changed lines count: 0
$ node strip.cjs HEAD사본 작업본   (ts.transpileModule, removeComments)
renderingPlan.ts HEAD 1f2944547e75aca8 5938 | WORK 1f2944547e75aca8 5938 | IDENTICAL (comments removed)
lexiconOverlay.ts HEAD 9e8a7f08f3b337f2 3474 | WORK 9e8a7f08f3b337f2 3474 | IDENTICAL (comments removed)
```

**2b. HEAD 사본 vs 작업본 `prepareSegments` 차분**(HEAD 의 `renderingPlan.ts` 를 `git show HEAD:` 로 미러 임시 하위 폴더에 복원, import `./`→`../` 만 치환, 실행 뒤 삭제)
```
$ node --import tsx tests/_qa035/diff035.ts
sentences(fixed)=54 dicts=4 option sets=3
fixed comparisons=648 fuzz comparisons=240000 (fuzz inputs with >=1 hint: 19572)
total compared=240648 differences=0
  [seed6+extra] "明日香さん" → ["明日香"] | [damaged] []
  [seed6+extra] "明日香さんは明日来ます" → ["明日香"] | [damaged] []
  [seed6+extra] "東京都庁と京都" → [] | [damaged] []
  [seed6+extra] " 明日京都" → ["明日","京都"] | [damaged] ["京都"]
exit=0
```
고정 문장 54개에는 요구한 `明日香さん`·`明日香さんは明日来ます`·`東京都庁と京都`·`今日明日`·`明日は晴れです`·`日本橋駅と日本橋`·`𠮷田と田`·`' 明日、10時'`·`3ヶ月`·`愚か`·빈 문자열과 앞 공백·전각 공백·개행·탭·이모지·따옴표·물결표·말줄임 시작 문장, 옵션은 `single:true`·기본 분할·`maxChars 8 + splitAtComma` 3종.

**3. 변이(격리 사본, 매번 NFS 원본 복원 + `cmp`)**
```
$ node mutate035.mjs
M-i   어댑터 substituteReadings 정렬 제거 (요구 i)
  exit=1 tests=22 pass=21 fail=1 → KILLED
  not ok: 플랫폼 치환(방식 A 강등): 계약표(hintRescanCases.json) — …
  restore: cmp exit=0 (원본과 일치)
M-ii  L4 rescanHintSurfaces 전진폭 i += s.length → [...s].length (요구 ii)
  exit=1 tests=22 pass=21 fail=1 → KILLED
  not ok: 계약표(hintRescanCases.json): rescanHintSurfaces 재구성이 어댑터 substituteReadings 와 같은 문장을 낸다
  restore: cmp exit=0 (원본과 일치)
M-iii renderingPlan lead = 0 (요구 iii)
  exit=1 tests=22 pass=21 fail=1 → KILLED
  not ok: 방어(lead): 공백으로 시작하는 표기가 손상 스냅샷으로 들어와도 뒤 hint 좌표가 어긋나지 않는다(task-035 L-2)
  restore: cmp exit=0 (원본과 일치)
M-iv  어댑터 전진폭 코드포인트                  → exit=1 pass=21 fail=1 KILLED (어댑터 계약표) · cmp 일치
M-v   L4 rescan 정렬 제거                       → exit=1 pass=21 fail=1 KILLED (L4 계약표)    · cmp 일치
M-vi  어댑터 건너뛰기 제거(i += 1)              → exit=1 pass=20 fail=2 KILLED (어댑터 계약표·합성 요청) · cmp 일치
M-vii L4 rescan 건너뛰기 제거(i += 1)           → exit=1 pass=19 fail=3 KILLED (L4 계약표·재검색 일관성·앞 공백 8사례) · cmp 일치
M-viii 어댑터 표기 중복 제거(Map) 제거          → exit=1 pass=21 fail=1 KILLED (어댑터 계약표) · cmp 일치

$ RAW=1 node mutate035.mjs M-ii   (단언 상세)
  expected: 'ヨシダとタ'      ← surrogate-pair-inner-surface 의 기대값
  actual: 'ヨシダタとタ'      ← L4 가 𠮷田 뒤 田 를 한 번 더 잡음
$ RAW=1 node mutate035.mjs M-iv
  expected: 'ヨシノヤとヨシ田'  actual: 'ヨシノヤ家とヨシ\udfb7田'   ← 서러게이트 쌍이 쪼개짐(surrogate-pair-surface)
$ RAW=1 node mutate035.mjs M-iii
  operator: 'deepStrictEqual'   (방어(lead) test 1건만 FAIL — 앞 공백 8사례 test 는 초록, lead 가 0 인 입력이라 기대대로)
```
8건 모두 변이 전 격리 사본 기준선 `tests 22 · pass 22 · fail 0`.

**4. 커밋 누락 방지**
```
$ git -c safe.directory=$PWD check-ignore -v src/modules/speech/tts/__tests__/fixtures/hintRescanCases.json ; echo "exit=$?"
check-ignore exit=1 (1 = 무시 규칙에 안 걸림)
$ git ls-files --others --exclude-standard -- src/
src/modules/speech/tts/__tests__/fixtures/hintRescanCases.json
$ git add -n -- src/modules/speech/tts/__tests__/fixtures/hintRescanCases.json      (dry-run, 인덱스 무변경)
add 'src/modules/speech/tts/__tests__/fixtures/hintRescanCases.json'
(core.excludesfile 없음, .gitignore 에 fixtures·*.json·__tests__ 줄 없음; 같은 관례의 추적 픽스처: src/modules/speech/__tests__/fixtures/{normalizerGolden.ts,particleBoundary.json,readingLexiconSegments.json})

$ (HEAD 아카이브 + 변경 4파일 + 픽스처 → ~/.node-local/thekaiwa-qa035/chk-elsewhere/deep/er/checkout)
overlay: src/modules/engine/__tests__/ttsAdapter.test.ts · src/modules/speech/reading/lexiconOverlay.ts · src/modules/speech/tts/__tests__/lexiconCompoundGuard.test.ts · src/modules/speech/tts/renderingPlan.ts · src/modules/speech/tts/__tests__/fixtures/hintRescanCases.json
$ node --import tsx --test --test-concurrency=1 src/modules/speech/tts/__tests__/lexiconCompoundGuard.test.ts src/modules/engine/__tests__/ttsAdapter.test.ts   (픽스처 포함)
exit=0   # tests 22   # pass 22   # fail 0
ok 1 - 플랫폼 치환(방식 A 강등): 계약표(hintRescanCases.json) — …
ok 17 - 계약표(hintRescanCases.json): rescanHintSurfaces 재구성이 어댑터 substituteReadings 와 같은 문장을 낸다
$ (같은 명령, 픽스처 제거 — 커밋 누락 시나리오)
exit=1   # tests 2   # pass 0   # fail 2
      2 #   code: 'ENOENT',
      2 # Error: ENOENT: no such file or directory, open '…/chk-elsewhere/deep/er/checkout/src/modules/speech/tts/__tests__/fixtures/hintRescanCases.json'
$ node -e (픽스처 파싱)
cases= 18 unique ids= 18 · keys per case ok= true · has surrogate-pair-inner-surface= true
```

**5. 경계**
```
$ grep -nE "^import|from '" src/modules/engine/__tests__/ttsAdapter.test.ts
1:import { test } from 'node:test'   2:import assert from 'node:assert/strict'   3:import { readFileSync } from 'node:fs'   4:import { join } from 'node:path'
5:import { styleBertVits2Provider } from '../adapters/tts/styleBertVits2.provider'   6:import { substituteReadings, synthesizeHttp } from '../adapters/tts/styleBertHttp'
7:import type { ConnectionProfile, TtsSegmentInput } from '../registry/types'   8:import { TtsEngineError } from '../tts/errors'
$ grep -cE "^import .*(speech|@/modules/speech)" …/ttsAdapter.test.ts  →  count=0
$ speech 문자열 줄: 17(speechProfile 필드)·66(주석)·69(파일 읽기 경로 join(__dirname,'..','..','speech','tts','__tests__','fixtures',…)) — import 아님
$ git diff -U0 -- src/modules/speech | grep '^+' | grep -iE 'style-?bert|styleBert|sbv2|reazon|whisper|sherpa|model_id|speaker_id|claude|qwen|zipformer'   →  added-lines match count=0
$ grep -ciE (같은 패턴) …/hintRescanCases.json  →  fixture match count=0
$ src/modules/speech/** 전체 엔진명 grep 건수   →  working=30 HEAD=30
$ git diff --name-only -- src/components src/app  →  ui-diff-lines=0
$ git diff --name-only -- android plugins prisma capacitor.config.ts .claude/agents src/modules/conversation/prompts  →  0 · git status --short -- android plugins prisma capacitor.config.ts → 0
```

### 인계
- **PASS · 결함 0건** → 배포 인계 여부는 Leader 판단(런타임 번들 동작 변경 0 이라 운영 재배포 필요성 낮음 — REV-107 high_risk_areas 2번과 같은 판단). 커밋 시 **`src/modules/speech/tts/__tests__/fixtures/hintRescanCases.json`(untracked) 포함 필수**(O-1). `native_change: false`.

## 최종 요약 (Leader, 2026-10-05)

**한 일** — 방금 배포한 TTS 복합어 가드(task-034)가 조용히 깨지지 않게 하는 안전망을 놓았다. 어댑터 `substituteReadings`(엔진 경계 층)가 hint 표기를 위치 없이 다시 찾는 규칙을 L4 `rescanHintSurfaces` 가 손으로 복사해 쓰는데 둘을 묶는 영구 테스트가 없었다(REV-106 M-1). **입력 → 기대 치환 JSON 픽스처 하나(18사례)를 L4 테스트와 어댑터 테스트가 같이 읽어** 검증한다(import 가 아니라 파일 읽기라 6층 경계 규칙 유지). 어댑터나 L4 한쪽 규칙(정렬·건너뛰기·중복 제거·서러게이트 처리)이 바뀌면 해당 테스트가 FAIL 한다. 겸해서 `lexiconOverlay.ts` 주석(표시와 소리가 같은 항목을 고른다 → 판정식이 달라 경계 사례에서 갈릴 수 있음)을 정정했다. **동작 변경 없음.**

**사용자 결정** — 없음(후속 정리). Leader 판단 2건: ① REV-106 L-2 의 `lead` "죽은 코드" 제거는 **원복하고 주석만**(developer 가 "항상 0" 전제가 공백으로 시작하는 표기에서 깨짐을 찾음 — `validateLexiconEntry` 는 trim 후 빈 값만 거름, 관리 입력·CSV·미리듣기·시드는 차단. 제거 시 달라지는 방향은 hint 가 더 빠지는 쪽뿐이지만 이득(3줄)이 비영 위험보다 작음), 새 "방어(lead)" 테스트로 고정 ② judge 가 유형 분류에 3회 실패(task_type None·complexity 1.17)해 안전값 opus·standard 로 나왔고 규칙대로 그 값을 따름.

**검증** — judge intake standard·opus·데모 none(demo_gate `not_required`) → Developer(Opus) 구현 → **REV-107 PASS_WITH_NOTES**(Medium 1 서러게이트 사례 누락·Low 2 주석 인과·픽스처 엔진 유래 이름 — 모두 `dev-035b` 로 반영, 18사례·변이 2건 killed) → judge C2 Codex 불필요(`wanted_before_budget:false`) → **QA PASS**(결함 0): 정적·전체 테스트 1468/1469(skip 1 기존), HEAD 대비 `prepareSegments` 240,648건 차이 0, 변이 8건 모두 killed, 픽스처 무시 규칙 미해당·클린 체크아웃 시뮬레이션 22/22(픽스처 빠지면 ENOENT 로 크게 실패), 엔진 유래 이름 0. 화면·DB·네이티브·프롬프트·어댑터 본문 무변경(native_change false).

**알려진 한계·후속(정리 backlog 에 기록)** — `validateLexiconEntry` 가 공백으로 시작하는 표기를 거부하도록(별도 task) · 계약 테스트 사례 수 하한 단언이 `>= 10` 이라 사례를 지워도 통과(REV-107 I-1·QA O-2 — 정확 수 단언으로) · 개발 미러에 다른 세션 임시 파일(`tmp-pe/t49.ts`·`.scratch-021/`)이 남아 `npm run lint` 노이즈. 이전 task-034 의 M-2(한자 이름+접미어 꺼짐)·미리듣기 안내 문구는 그대로 남음.

**배포 상태** — 운영 영향 0(런타임 번들 동작 변경 없음 — 테스트·주석뿐). 로컬 커밋만 두고 push(=webhook 재배포로 pm2 재시작)는 사용자 확인 대기.
