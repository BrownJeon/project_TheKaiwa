---
task_id: task-069
title: "task-069 Reviewer 기록 — 단어 추가 시트 말로 쓰기 (REV-069)"
role: reviewer
track: light
verdict: PASS_WITH_NOTES
created: 2026-10-15
tags:
  - type/rev-record
  - domain/vocab
  - domain/speech
aliases:
  - task-069 rev-record
  - REV-069
---

# task-069 Reviewer 기록 (REV-069)

이력서: [[task-069-improve-word-add-mic]] · developer 기록: [[task-069-dev-record]] · 백로그: [[IMP-0043-words-add-mic-input]]

## 판정: PASS_WITH_NOTES

- **Critical 0 · High 0 · Medium 1 · Low 4.** 오늘 코드에서 기능이 틀린 곳은 읽기·렌더·변이로 찾지 못했다. 다만 훅과 시트 배선 층에는 시험이 거의 없어, 이 층이 깨져도 시험이 전부 통과한다(Medium 1건). 차단 사유는 아니고 커밋 전 보강을 권고한다.
- light 트랙 유지(승격 불필요) · 데모 게이트 `DEMO_GATE_PASSED`(status `not_required`, judge none) · 네이티브 변경 없음(`native_change: false`).
- 이 task 는 QA 가 없으므로 이 기록의 재실행 증빙 + 사용자 폰 확인이 실행 검증의 전부다.

## 증빙 재실행 (미러 `~/.node-local/thekaiwa-rev069` — dev069 미러를 `cp -al` 후 저장소 `src/`·`tests/`·`scripts/`·`package.json` 을 `rsync -a --delete`, `src` diff 0 확인)

| 명령 | 이번 결과 | developer 보고 | 대조 |
|---|---|---|---|
| `./node_modules/.bin/tsc --noEmit` | 종료 코드 0 (18초) | 0 | 일치 |
| `./node_modules/.bin/eslint src/components/vocab` | 종료 코드 0, 출력 없음(경고도 0) | 0 | 일치 |
| `node --import tsx --test --test-concurrency=1 …/wordMic.test.ts …/wordMicField.test.ts` | tests 24 · pass 24 · fail 0 | 24/24 | 일치 |
| vocab 전체(`find src/components/vocab -name '*.test.ts'`) | tests 249 · pass 249 · fail 0 | (미기재) | — |
| 전체 `find src scripts/seed-build -name '*.test.ts'` | tests 4090 · pass 4087 · fail 1 · skipped 2 | 4090 · pass 4088 · skipped 2 | **차이 1건 = 내 임시 파일 때문(아래)** |
| `DATABASE_URL=<가짜> ./node_modules/.bin/next build > /tmp/claude-1000/rev069-build.log 2>&1` | `BUILD_EXIT=0`, `Compiled successfully in 6.3s`, 경고 3건(전부 `persona/loader.ts:102` 동적 파일 접근 — 기존) | 0 | 일치 |

- 전체 시험의 실패 1건(`scrollBoxPosition.test.ts` #1085 「소스 스캔: 규칙이 못 덮는 모양…」)은 **내가** `WordForm` DOM 대조용으로 HEAD 사본 `src/components/vocab/WordFormOld.tsx` 를 미러 `src` 에 두었는데 그 소스 스캔이 그 파일의 인라인 `overflowY` 를 잡은 것이다(실패 메시지가 `WordFormOld.tsx` 를 가리킴). 파일을 지우고 같은 파일을 다시 돌리니 8/8 통과. 저장소에는 그 파일이 없다. 따라서 실질 결과는 4090 중 4088 통과·건너뜀 2 — developer 보고와 같다.
- 렌더 확인: `renderToStaticMarkup` 로 WordMicField 의 6상태(대기·열림·녹음 중·마이크 거부 오류 띠·거부 막힘·서버 꺼짐 막힘)를 직접 출력해 눈으로 확인했다(임시 시험 파일, 확인 후 삭제). 막힘 상태는 `aria-disabled="true"` + `aria-describedby` 가 이유 줄을 가리키고 `<input>` 은 그대로 남아 있다. 열린 상태는 `h-[72px] w-[72px]` 누르고 말하기 + `type="button"` 으로, 폼 안에서 실수로 제출되지 않는다.
- `WordForm` 꺼진 경로 DOM 대조: HEAD 버전 `WordForm` 과 작업본 `WordForm`(mic 없음)을 값 3가지(오류 없음 / 모든 오류+예문 펼침 / 빈 값+`surfaceNote`+`chunkNote`)로 `renderToStaticMarkup` 한 문자열이 **바이트 동일**(길이 4521 · 6128 · 5852). 수정 시트 DOM 불변이 실측으로 확인됐다.

## 체크리스트 1~11

| # | 항목 | 결과 | 근거 |
|---|---|---|---|
| 1 | 음성 비저장 | **PASS** | `useWordMic.ts:44` `purpose: 'MIC_TEST'` 고정, `chatId`·`TURN`·`utteranceId` 없음. gateway 는 MIC_TEST 에서 wav·콜백·Utterance 행을 만들지 않고(`speech/gateway/README.md:24`), 휴대폰 경로는 `saveWav:false`(`OnDeviceSttClient.ts:11`). 인식 문장은 `announce` 상태·칸 값·`role=status` DOM 에만(`useWordMic.ts:40`). 새 3파일에 `fetch/apiPost/localStorage/console./spawn` 0(시험 `wordMicField.test.ts:164-173` + 내 grep). `onResult`(`WordAddSheet.tsx:139-147`)는 `applyMicResult`·`set`·`setErrors` 만 부르고 `apiPost`·`enrich`·`save` 호출 없음 |
| 2 | 6층·엔진명 | **PASS** | 새 3파일·`labels.ts` 신규 문구에 `reazon/whisper/style-bert/claude/sherpa/speaker_id/model_id/gateway` 0건(grep). 모듈 접근은 `@/modules/speech/stt/client` index 의 타입 하나뿐(`wordMic.ts:9`). `useSpeechConfig` 를 `@/components/lesson/useLessonVoice` 에서 가져오는 것(`useWordMic.ts:9`)은 `useAskInput.tsx:19`·`EvalRunner.tsx:27` 과 같은 기존 방식 — 컴포넌트끼리라 6층 위반 아님(번들에 수업 재생 코드가 따라오는 비용만 있음, 기존 선례) |
| 3 | 범위(L1·L6) | **PASS** | 마이크는 `WordForm.tsx` 의 `text('surface',…,{mic:'surface'})`·`area('example',…,{mic:'example'})` 두 곳뿐. 읽기·뜻·예문 뜻·메모·분류 없음(시험 `wordMicField.test.ts:133-136` 이 aria-label 개수로 고정). `git status src`: `WordDetailSheet`·lesson·ask·talk 무변경(변경은 `WordAddSheet`·`WordForm`·`labels` 3개 + 신규). 꺼진 경로 DOM 바이트 동일(위) |
| 4 | 결과 반영(L3) | **PASS** | `wordMic.ts:20-25` 표현=`replace`(줄바꿈 제거)·예문=`append`(빈/공백 칸이면 그대로)·빈 결과 null·자르지 않음. 시험 `wordMic.test.ts:15-49` 가 81자 표현·2,001자 예문이 `validateWord` 기존 문구를 내는 것까지 확인. 빈 결과 안내 `useWordMic.ts:32-34`. 코드포인트 길이는 기존 `validateWord` 몫(`Array.from` 길이 비교를 시험이 사용). **단 시트 쪽 배선**(`applyMicResult(target, form[target], text)`·한도 안내 `WordAddSheet.tsx:141-145`)은 시험이 못 본다 → REV069-1 |
| 5 | 상태 누수·레이스 | **PASS(주의 2)** | 닫는 5곳 확인: `enrich()` 시작(`:168`) · 1단계 빈 표현 오류(`:163`) · [직접 입력하기](`:363`) · 예문 접기(`:404`) · `save()` 통과 직후(`:233`) · `focusField`(`:152`) — 모두 코드에 있음. 늦은 결과: **`sttUiReducer` 의 ABORT 는 `recording` 일 때만 취소하고 `finishing` 에선 아무것도 안 한다**(`sttUiState.ts:145-148`) → 손 뗀 뒤 칸을 옮기거나 닫아도 final 은 도착한다. 이를 `micFinalAction`(`wordMic.ts:30-34`)이 「누른 칸과 지금 칸이 다르면 무시」로 막고, 훅은 `pressedRef`/`targetRef` 를 그 함수에 넘긴다(`useWordMic.ts:30,73`). 코드는 맞다. 언마운트는 `useRealtimeStt` 정리(`dispose`)가 담당. 오래된 값: `optsRef` 를 layout effect 로 매 렌더 갱신(`useWordMic.ts:25-27`), `useRealtimeStt` 의 `onFinalRef` 도 같은 방식 — stale 없음. 주의: 이 훅·배선 층은 시험이 없다(REV069-1), 1단계 포커스(REV069-3) |
| 6 | 불가 환경(L5) | **PASS** | 서버 인식 꺼짐 → `micPreflight.ts:14` `SERVER_UNAVAILABLE` → 「음성 인식 서버가 준비 중이에요.」, 비보안 → 「이 주소에서는 마이크를 쓸 수 없어요.」, 거부 → 「마이크 사용이 막혀 있어요. 주소창 왼쪽 아이콘… 다시 눌러 주세요.」(렌더로 확인). 버튼은 `aria-disabled`·`opacity-40`·이유 줄 연결, 입력 칸은 `children` 으로 그대로(`WordMicField.tsx:127-129`). `enrich`·`save` 는 `mic.blocked` 를 읽지 않아 단어 추가가 막히지 않는다. 열린 칸은 막혀도 글자로 복귀(`off = !open && …`, `:55`) |
| 7 | 접근성·모바일 UI | **PASS(주의 1)** | 전환 버튼 `h-11`(44px), 누르고 말하기 72px(≥64). aria-label 이 보이는 글자를 포함(「표현 말로 쓰기」 ⊃ 「말로 쓰기」), `aria-describedby`, `lang="ja"`, 방금 넣은 말 `role=status aria-live=polite`. 색은 전부 토큰(`text-ink`·`border-line`·`text-ink2`·`bg-bad-soft`), 하드코딩 색 0. 가로 넘침 방어 `min-w-0`·`break-keep`·`[overflow-wrap:anywhere]`·`truncate`. 포커스: REV069-2. 실제 360/390/412px 렌더·실기기는 이 감사에서 보지 못했다(클래스·마크업 판독만) → 폰 확인 몫. 「칸마다 +26px」(라벨 줄 18→44px)은 계산이 맞다 — 디자인 판단이라 결함으로 세지 않고 Leader 를 통해 designer 에 넘긴다(아래 9-2) |
| 8 | 기존 동작 불변 | **PASS** | `WordAddSheet` diff 를 줄 단위로 확인: 추가·감싸기뿐이고 409(`duplicateOf`)·429 잠금·조각 필수(`validateWord` 경로)·`enrich` 요청/응답 처리·`presetSurface`/`presetChunk`(`emptyForm(...)`) 코드는 변경 0. 기존 vocab 시험 249/249 통과 |
| 9 | 사양과 달라진 점 4개 | **4개 모두 수용** | 아래 별도 표 |
| 10 | light 승격 조건 | **PASS** | 변경 8파일(수정 3 + 신규 코드 3 + 신규 시험 2) ≤ 12 · 신규 화면 없음(기존 시트에 컨트롤 추가) · 마이그레이션·네이티브·인증·Secret 변경 없음. `check.mjs check` → `DEMO_GATE_PASSED` / `not_required`. 디자인 가이드 없이 화면이 달라지는 점은 judge 가 `DM-light-waive` 로 승인한 범위 |
| 11 | 시험 품질 | **주의(Medium)** | 아래 변이 표. 순수 규칙(`wordMic.ts`)과 컴포넌트 마크업은 잘 잡히지만 훅·시트 배선은 생존 변이가 많다 |

## 사양과 달라진 점 4개 판정

| # | 내용 | 판정 | 이유 |
|---|---|---|---|
| 9-1 | 시험 러너 `node:test` + tsx (사양의 vitest 표기와 다름) | **수용** | `package.json:10` `test` 스크립트가 `node --import tsx --test`, 저장소 전 시험이 같은 방식. 사양의 vitest 표기가 오기 |
| 9-2 | 전환 버튼을 라벨 줄 오른쪽에(수업은 입력 아래), 칸마다 약 26px 늘어남 | **수용 + Leader 전달** | 기능상 문제 없음(칸이 점선 상자로 바뀌어도 버튼 자리 고정, 44px 충족). 늘어난 높이는 디자인 판단이라 폰에서 답답하면 designer 가 정한다. 바꾸게 되면 `WordMicField` 한 곳 |
| 9-3 | 마이크 거부(`MIC_DENIED`)도 비활성, 열린 칸은 글자 복귀 가능, [앱 설정 열기]는 열린 칸 오류 띠에만 | **수용** | L5 「마이크 거부이면 비활성+이유 한 줄」 그대로. 복귀 보장은 `off = !open && …`(변이 R5 로 시험이 지킴을 확인). 한 번 거부한 뒤의 복구는 권한 변경 감지(웹 Permissions API `change` / 앱 resume 재조회, `micPreflight.ts:54-83`)에 의존 — Permissions API 가 없는 브라우저는 시트를 다시 열 때까지 막힌다(dev 기록 「알려진 한계」에 있음, 키보드 영향 없음) |
| 9-4 | 휴대폰→서버 전환 토스트(`STT_SWITCH_TOAST`) 미부착 | **수용** | 전환은 말을 잃지 않는 자동 동작이고 단어 시트에는 토스트 자리가 없다. 전환 뒤 실패하면 `switched` 가 오류 띠에 실린다. 추가로 dev 가 넣은 화면 읽기용 `role=status` 알림·칸 안 힌트 한 줄도 수용 |

## 변이 점검 (reviewer 가 직접, 별도 미러에서 한 번에 하나씩 → 시험 실행 → 원복, 마지막에 `diff -rq` 로 원복 확인)

기준선: `wordMic.test.ts`·`wordMicField.test.ts`·`labels.test.ts`·`components/__tests__/sourceCode.test.ts` = 40 pass. developer 의 12개와 겹치지 않는 영역을 골랐다.

| ID | 깬 곳 | 영역 | 결과 |
|---|---|---|---|
| R1 | `save()` 의 `mic.close()` 제거 | 시트 배선 | **생존**(40 pass) |
| R2 | [직접 입력하기]의 `mic.close()` 제거 | 시트 배선 | **생존** |
| R3 | `applyMicResult(target, form[target], text)` → 현재값 자리에 `""` (예문이 이어 붙지 않고 덮어씀) | 시트 배선 | **생존** |
| R4 | 훅 `micFinalAction(pressedRef.current, …)` → `targetRef.current` (늦은 결과 무시 가드 무력화) | 훅 | **생존** |
| R5 | `off = !open && …` → `off = …` (열린 칸이 글자로 못 돌아옴) | 화면 | 잡힘(`이미 열린 칸은 막혀도 글자로 돌아갈 수 있다`) |
| R6 | 예문 힌트 문구에 엔진명 `whisper` | 문구 | 잡힘(힌트 문구 일치 시험 — 엔진명 시험이 아니라 문구 비교로 우연히) |
| R7 | 결과 뒤 `setTarget(null)` 제거(글자 모드로 안 돌아옴) | 훅 | **생존** |
| R8 | `press` 에서 `pressedRef.current = targetRef.current` 제거 → **모든 인식 결과가 무시됨(기능 전체 불능)** | 훅 | **생존** |
| R9 | 한도 초과 안내(`if (over) setErrors(...)`) 제거 | 시트 배선 | **생존** |
| R10 | `focusField` 의 `mic.close(f)` 제거 | 시트 배선 | 잡힘(소스 스캔 정규식) |
| R11 | 폼에 `mic={mic}` 전달 제거 | 시트 배선 | 잡힘(소스 스캔 `mic={mic}` 2개) |

→ 11개 중 4개만 잡고 7개 생존. developer 의 12개는 순수 규칙·화면 마크업·소스 스캔이 닿는 곳이라 전부 잡혔지만, 훅 내부(ref 기록·결과 후 닫기)와 시트의 일부 호출은 시험 밖이다.

## 결함 목록

### REV069-1 · Medium · 훅·시트 배선 층의 시험 구멍
- 위치: `src/components/vocab/useWordMic.ts:30,36-40,73` · `WordAddSheet.tsx:141,144-145,233,363` · 시험 `__tests__/wordMicField.test.ts:151-162`
- 근거: 위 변이 R1·R2·R3·R4·R7·R8·R9 가 시험 40개 전부 통과. 특히 R8(인식 결과가 한 번도 칸에 안 들어감)·R3(예문 이어 붙이기가 덮어쓰기로 바뀜)이 시험을 통과한다. dev 기록은 이를 「훅은 DOM 이 필요해 순수 규칙과 소스 스캔으로만 잠갔다」 로 인정하고 있다. jsdom/@testing-library 는 이 저장소에 없다(`package.json` 확인).
- 위험: 이 task 는 light 라 QA 가 없고 실행 검증은 사용자 폰 확인뿐이다. 이후 누가 이 파일을 건드려 위 변이와 같은 회귀가 생겨도 시험이 알려 주지 않는다. 지금 코드가 틀린 것은 아니다.
- 권고(차단 아님, 커밋 전 보강): 저장소 관례인 소스 스캔 고정을 `wordMicField.test.ts` 에 몇 줄 추가 — (a) `useWordMic.ts` 에 `pressedRef.current = targetRef.current` 와 `micFinalAction(pressedRef.current, targetRef.current` 와 onFinal 안 `setTarget(null)`; (b) `WordAddSheet.tsx` 에 `applyMicResult(target, form[target], text)` · `validateWord({ ...form, [target]: value })` · `mic.close()` 를 3곳 이상(enrich·직접 입력하기·save). 더 나아가려면 훅의 press/final/close ref 로직을 `wordMic.ts` 순수 함수로 한 단계 더 빼 단위 시험.

### REV069-2 · Low · 결과 반영 뒤 포커스가 사라짐
- 위치: `src/components/vocab/useWordMic.ts:36-40` · `WordMicField.tsx:112,121`
- 근거: 인식 결과가 오면 훅이 칸을 닫아(`setTarget(null)`) 누르고 말하기 버튼(그리고 오류 띠 안의 「글자로 쓰기」, `:112`)이 DOM 에서 사라진다. 포커스를 되돌려 주는 코드가 어디에도 없다(`focus(` 호출 0). 단, 수업 「말로 쓰기」(`StageApply.tsx`)도 포커스 처리가 없어 이 task 가 만든 회귀는 아니다. 공용 `Sheet` 에 포커스 트랩이 없는 것(ACTIVE 의 「공용 Sheet Tab 포커스 누출」)과 겹친다.
- 위험: 키보드·스크린리더 사용자는 결과가 들어간 뒤 포커스가 문서 처음으로 떨어진다. 터치 전용이면 보이지 않음.
- 권고: 항상 마운트돼 있는 전환 버튼에 ref 를 달아 결과 반영 뒤(`afterCommit`) 거기로 포커스를 옮긴다.

### REV069-3 · Low · 1단계에서 빈 표현으로 [뜻 채우기]를 누르면 포커스가 입력 칸으로 가지 않음
- 위치: `src/components/vocab/WordAddSheet.tsx:162-165`
- 근거: 말로 쓰는 중이면 입력 칸은 DOM 에 없다(`WordMicField.tsx:86-129`: 열린 분기가 `children` 대신 그려짐). `mic.close('surface')` 는 상태만 바꾸고 다음 렌더에서야 입력이 생기므로 바로 뒤의 `surfaceRef.current?.focus()` 는 `null` 에 호출된다. 오류 문구는 보이지만 포커스는 [뜻 채우기] 버튼에 남는다. dev 기록의 「close('surface') 후 기존처럼 포커스」는 말로 쓰는 중에는 사실과 다르다.
- 위험: 작다(오류 줄은 보임). 마우스·터치 사용자는 영향 없음.
- 권고: 이 가지도 `focusField('surface')`(`setTimeout` 로 `getElementById` 포커스, `:149-154`)를 쓰면 한 줄로 해결.

### REV069-4 · Low · 오류 상태가 칸마다 구분되지 않음
- 위치: `src/components/vocab/useWordMic.ts:79,94` · `WordMicField.tsx:60`
- 근거: `error`·`dismissed` 가 훅 하나의 전역 값이고 `err = open ? v.error : null` 로 열린 칸이 그대로 받는다. 표현 칸에서 난 오류(예: 연결 실패)를 오류 띠 밖의 「글자로 쓰기」 토글로 닫은 뒤 예문 칸을 열면 같은 오류 띠가 먼저 보인다. 지워지는 때는 다음 누름(`sttUiState.ts` PRESS 가 `error: null`)뿐이다.
- 위험: 안내가 한 번 어긋남. 데이터에는 영향 없음.
- 권고: `toggle` 에서 칸이 바뀔 때 현재 `ui.error` 를 `dismissed` 로 넣는다.

### REV069-5 · Low · 불필요 번들 결합 (참고)
- 위치: `useWordMic.ts:9`
- `useSpeechConfig` 하나를 가져오려고 `@/components/lesson/useLessonVoice`(수업 재생 큐 포함)를 단어 시트 번들에 끌고 온다. `useAskInput`·`EvalRunner` 와 같은 기존 방식이라 이번에 고칠 일은 아니고, 나중에 `useSpeechConfig` 를 `components/speech/` 로 옮기면 정리된다.

## 발견 없음으로 확인한 영역
- 인증·소유자·capability·Secret: 이 task 는 새 API·DB·환경변수를 만들지 않는다 → 해당 없음, 발견 없음.
- LLM 계약·제안→채택·`StatsSnapshot`·`ConfigurationVersion`: 건드리지 않음 → 발견 없음.
- 엔진명 노출: 화면·라벨·aria 문구에 0(렌더 출력 6상태 전체 확인).

## 사용자 폰 확인 때 볼 것 (QA 대신)
1. 표현 칸 「말로 쓰기」 → 일본어 한 마디 → 칸에 들어간 값에 문장부호(。)가 붙어 오는지 [추측 — 코드로는 확인 못 함, 붙어 오면 표현 칸에서는 지우는 규칙을 후속으로 검토].
2. 앱(온디바이스)에서 첫 누름은 권한 대화상자만 → 「한 번 더 눌러 주세요」류 안내가 단어 시트에서도 맞게 나오는지.
3. 손을 뗀 직후 다른 칸의 「말로 쓰기」를 누르면 앞 결과는 버려지는 것이 설계다(`micFinalAction`) — 놀라지 않는지.
4. 마이크 거부 상태에서 버튼이 막히고 이유 한 줄이 보이며 키보드로는 추가되는지.
5. 360px(큰 글꼴 포함)에서 라벨 줄·점선 상자·오류 띠가 가로로 넘치지 않는지, 칸마다 +26px 이 답답하지 않은지(답답하면 designer 판단).

## 요약 JSON

```json
{
  "reviewId": "REV-069",
  "status": "PASS_WITH_NOTES",
  "issues": [
    { "id": "REV069-1", "severity": "MEDIUM", "component": "src/components/vocab/useWordMic.ts:30,36-40,73 · WordAddSheet.tsx:141,144-145,233,363", "risk": "훅·시트 배선이 깨져도 시험이 통과한다(light 트랙은 QA 없음)", "evidence": "변이 11개 중 7개 생존: R1 R2 R3 R4 R7 R8 R9", "recommendation": "소스 스캔 고정 추가 또는 훅 ref 로직을 순수 함수로 추출" },
    { "id": "REV069-2", "severity": "LOW", "component": "useWordMic.ts:36-40, WordMicField.tsx:112,121", "risk": "결과 반영 뒤 포커스 소실", "evidence": "focus( 호출 0, 버튼 언마운트", "recommendation": "전환 버튼으로 포커스 복귀" },
    { "id": "REV069-3", "severity": "LOW", "component": "WordAddSheet.tsx:162-165", "risk": "말로 쓰는 중 빈 표현 오류 시 포커스 이동 실패", "evidence": "surfaceRef.current 가 null", "recommendation": "focusField('surface') 사용" },
    { "id": "REV069-4", "severity": "LOW", "component": "useWordMic.ts:79,94", "risk": "이전 칸의 오류 띠가 다른 칸에 먼저 보임", "evidence": "전역 error/dismissed", "recommendation": "칸 전환 시 dismiss" },
    { "id": "REV069-5", "severity": "LOW", "component": "useWordMic.ts:9", "risk": "수업 재생 코드가 단어 시트 번들에 딸려 옴", "evidence": "기존 선례(useAskInput, EvalRunner)", "recommendation": "useSpeechConfig 를 speech 폴더로 이동(후속)" }
  ],
  "summary": { "critical": 0, "high": 0, "medium": 1, "low": 4 },
  "high_risk_areas": ["온디바이스 첫 누름 권한 대화상자 안내", "손 뗀 직후 칸 전환 시 결과 무시(설계)", "마이크 거부 상태 버튼 비활성+키보드 입력", "360px 큰 글꼴 가로 넘침"],
  "native_change": false
}
```

## 재감사 (수정 라운드)

> 2026-10-15 11:5x · reviewer(light) · 범위 = REV069-1~4 수정(REV069-5 는 후속으로 미룬 상태 그대로). 미러 `~/.node-local/thekaiwa-rev069b` (dev069b 를 `cp -al` 후 `.next`·`tsconfig.tsbuildinfo` 만 지우고 저장소 `src/`·`tests/`·`scripts/`·`package.json` 을 `rsync -a --delete`, `src` diff 0). 변이·임시 파일은 미러 안에서만 만들고 지웠다(마지막 `diff -rq src` 0, dev069b `src` 도 그대로).

### 판정: PASS_WITH_NOTES

- **Critical 0 · High 0 · Medium 0 · Low 2(신규) + 후속 1(REV069-5, 그대로)**. REV069-1(Medium)·-2·-3·-4 는 모두 해소됐다. 리팩터(훅 ref 로직 → `wordMic.ts` 순수 함수)는 옛 인라인 로직과 **의미가 같다** — 길이 5 이하의 모든 이벤트열 271,453개에서 로그·상태 동일(아래). 요구한 변이 7개는 변형을 포함해 전부 시험이 잡았다.
- light 트랙 유지 — 변경 코드·시험 8파일(수정 3 + 신규 5, 1차 감사 이후 달라진 파일은 6개: `wordMic.ts`·`useWordMic.ts`·`WordMicField.tsx`·`WordAddSheet.tsx` + 시험 2) ≤ 12, 신규 화면·마이그레이션·네이티브·인증·Secret·API 변경 없음. `check.mjs check` → `DEMO_GATE_PASSED` / `not_required`. `native_change: false`.
- 이 task 는 QA 가 없다. 훅·effect 의 실제 실행(포커스가 버튼에 앉는지, 결과가 칸에 들어가는지)은 jsdom/@testing-library 가 없어 **사용자 폰 확인 몫**이다 — 소스 스캔과 순수 함수 시험은 「호출이 제자리에 있다 / 규칙 결과가 맞다」까지만 보장한다.

### 증빙 재실행 (미러 rev069b)

| 명령 | 이번 결과 | developer 보고 | 대조 |
|---|---|---|---|
| `./node_modules/.bin/tsc --noEmit` | 종료 코드 0 (`TSC_EXIT=0`) | 0 | 일치 |
| `./node_modules/.bin/eslint src/components/vocab` | 종료 코드 0, 출력 없음 | 0 | 일치 |
| `node --import tsx --test --test-concurrency=1 …/wordMic.test.ts …/wordMicField.test.ts` | tests 35 · pass 35 · fail 0 | 35/35 | 일치 |
| vocab 전체(`find src/components/vocab -name '*.test.ts'`) | tests 260 · pass 260 · fail 0 | 260/260 | 일치 |
| 전체 `find src scripts/seed-build -name '*.test.ts'` | tests 4101 · pass 4099 · fail 0 · skipped 2 | 4101 · 4099 · 건너뜀 2 · 실패 0 | 일치(이번에는 임시 파일을 두지 않은 상태로 돌려 실패 0 — 1차 때의 1건 차이 같은 것 없음) |
| `DATABASE_URL=<가짜> ./node_modules/.bin/next build > /tmp/claude-1000/rev069b-build.log 2>&1` | `BUILD_EXIT=0`, `Compiled successfully in 6.1s`, TypeScript 19.1s, 경고 3건(전부 `persona/loader.ts:102` 동적 파일 접근 — 기존) | 0 | 일치 |

### REV069-1~4 해소 여부

| ID | 등급 | 해소 | 근거 |
|---|---|---|---|
| REV069-1 시험 구멍 | Medium | **해소** | 1차에서 생존한 변이 7개(R1·R2·R3·R4·R7·R8·R9)에 해당하는 이번 변이 M1~M7·X8·X9 **전부 잡힘**(아래 변이 표). 의미가 바뀌는 변이는 순수 함수 시험이, 호출이 빠지는 변이는 소스 스캔이 잡는다. 스캔은 주석·공백을 지운 소스에서 「앞뒤 표지로 자른 구간 안의 호출」을 보므로 줄 번호에 의존하지 않는다 |
| REV069-2 포커스 소실 | Low | **해소(실행 확인은 폰)** | `WordMicField.tsx:65-71` 전환 버튼 `ref`, `useEffect([announce])` 가 `micResultFocus(seenN.current, announce)` 일 때만 `toggleRef.current?.focus()`. `seenN` 을 마운트 때의 `announce?.n` 으로 시작해 단계 전환으로 새로 그려진 칸(이미 본 결과)과 다른 칸의 결과(announce 가 null)에서는 옮기지 않는다 — 순수 시험 `micResultFocus` 5경우 + 변이 X5 잡힘. 오류 띠 「글자로 쓰기」(`:122-126`)는 `mic.close(target)` 뒤 같은 버튼으로 포커스(버튼은 항상 마운트돼 있어 같은 DOM 노드). effect 는 구독·타이머가 없어 정리(cleanup) 불필요, 언마운트 뒤에는 `toggleRef.current` 가 null 이라 `?.` 로 안전 |
| REV069-3 1단계 포커스 | Low | **해소** | `WordAddSheet.tsx:160-165` 빈 표현 오류 가지가 두 단계 공통으로 `focusField('surface')` — `mic.close('surface')` 후 `setTimeout(0)` 으로 `getElementById('wadd_surface')`. 1단계 입력(`:316`)과 폼 입력(`WordForm` `${idPrefix}_surface`, idPrefix=`wadd`)의 id 가 같다. 호출이 클릭/제출 핸들러의 동기 구간(첫 `await` 앞)이라 React 가 핸들러가 끝날 때 입력 칸을 그린 뒤 `setTimeout(0)` 이 돈다. 변이 X1(옛 `surfaceRef.current?.focus()` 가지 복원) 잡힘. 마이크가 닫힌 상태에서는 옛 코드와 같은 칸에 포커스가 간다(시점만 `setTimeout` 로 한 틱 늦음) |
| REV069-4 오류 누출 | Low | **해소(부작용 없음 확인)** | `useWordMic.ts` `retarget()` 가 칸이 바뀔 때(열기·옮기기·닫기) 보이던 `ui.error` 를 `dismissed` 로 넘긴다. **새 오류가 숨겨지는 경우는 없다**: `sttUiState.ts` 의 모든 오류는 이벤트마다 새 객체(`{ code: … }` 를 만들어 넣음, `:141,:190,:160,:201,:215`)이고 `PRESS` 가 `error: null`(`:128`)로 지우므로 닫기 직후 같은 칸을 다시 열어 누르면 새 오류는 `dismissed` 와 다른 객체라 `visibleMicError` 가 그대로 보인다(시험 `칸이 바뀌면…` 마지막 부분이 이 경우를 고정). 막힘(`blocked`)은 `dismissed` 를 보지 않아 이유 줄은 그대로. 사전 점검 오류는 모두 `blocking:true`(`micPreflight.ts`)라 열리지 않는 칸이고, 열려 있는 칸에 새로 도착한 점검/권한 오류도 새 객체라 보인다. 보이던 오류를 가리는 유일한 경우는 「이미 본 같은 오류 객체가 칸을 닫았다 다시 열 때」뿐인데 이것이 의도다 |

### 리팩터 동등성 (옛 인라인 ref 로직 ≡ 새 순수 함수 위임)

코드 대조(1차 미러 `useWordMic.ts` ↔ 현재)와 **차분 시험**(임시 파일, 확인 후 삭제: 옛 `targetRef`/`pressedRef` 인라인 로직과 새 `refs`+`micPress`/`micFinalStep`/`retarget` 위임을 같은 입력으로 돌려 로그(`abort`·`setTarget`·`hintNull`·`hintEmpty`·`announce`·`onResult`)와 두 ref 값을 비교) — 이벤트 12종(`toggle`×{표현·예문}×{막힘 아님·막힘}, `close`×{전체·표현·예문}, `press`, `final`×{빈 문자열·공백·`映画`·` 散歩に行きます。 `}) 길이 0~5 **271,453개 열 전부 동일**.

| 경우 | 옛 동작 | 새 동작 | 같은가 |
|---|---|---|---|
| 정상 final (누른 칸 = 열린 칸) | 두 ref 비움 → `setTarget(null)` → announce → `onResult` | `micFinalStep` 이 `apply` + `MIC_REFS_INIT` → `refs.current=next` → `setTarget(null)` → announce → `onResult` | 같음(차분 시험) |
| 손 뗀 직후 다른 칸으로 전환 | `pressed≠current` → ignore, ref 그대로 | `micFinalStep` 이 `micFinalAction(r.pressed, r.target…)` → ignore, `refs` 그대로 | 같음(M2a·M2b 가 이 규칙을 시험이 지킴을 확인) |
| 빈 결과 | `setHint(EMPTY_RESULT)`, 칸·ref 그대로 | 같음 | 같음 |
| 시트·단계 전환 중 늦게 온 결과 | `mic.close()` 가 `targetRef=null` → ignore | `retarget` 가 `refs.current.target=null`(pressed 보존) → ignore | 같음. 단 `pressed` 는 두 버전 모두 닫은 뒤에도 남는다(아래 참고) |
| 표현 = 바꿔 넣기 | `applyMicResult(target, form[target], text)` | `applyMicToForm(form, …)` 안에서 같은 호출 | 같음(순수 시험 `결과를 폼 값으로`) |
| 예문 = 이어 붙이기 / 빈 칸 | 같음 | 같음 | 같음(M1a·M1b 잡힘) |
| 한도 초과 | 자르지 않고 `validateWord({...form,[target]:value})[target]` 를 `setErrors` | `applyMicToForm` 이 같은 식의 `error` 를 돌려주고 시트가 `if (over) setErrors` | 같음(81자 표현 `표현은 80자까지…`·2,001자 예문 `예문은 2,000자까지…` 시험) |
| `toggle` | 목표가 바뀌면 `setHint(null)` | `if (retarget(...)) setHint(null)` | 같음. **추가된 동작은 `setDismissed` 뿐**(REV069-4 의도) |
| `close` | `setTarget` 만(힌트 안 건드림) | `retarget(...)`, 힌트 안 건드림 + `setDismissed` | 같음 + 의도된 추가 |
| `press` | `pressedRef=targetRef`, `setHint(null)`, `sttPress()` | `refs.current=micPress(refs.current)`, 같은 두 호출 | 같음 |

- 참고(옛 버전도 같음, 이번 수정이 만든 것 아님): 칸을 닫아도 `pressed` 는 남는다. 누르고 → 떼고 → `finishing` 중 칸을 껐다 같은 칸을 다시 켜면 그 늦은 결과가 들어간다 — 같은 칸·같은 사용자의 말이라 무해해서 결함으로 세지 않는다.
- `close`/`toggle` 의 식별자가 `error` 에 따라 바뀌지만(`retarget` 의존성) `mic.close`/`mic.toggle` 은 이벤트 핸들러에서만 쓰이고 effect·memo 의존성에 들어간 곳이 없다(`WordAddSheet`·`WordMicField` grep).

### 변이 점검 (reviewer 가 직접, 미러에서 한 번에 하나씩 → 마이크 시험 2개 파일 실행 → `os.replace` 로 원복, 마지막 `diff -rq src` 0)

기준선 35 pass. 파일 쓰기는 임시 파일 + rename 으로 해서 dev069b 와 하드링크된 파일을 제자리에서 건드리지 않았다.

| ID | 깬 곳 | 결과 | 잡은 시험 |
|---|---|---|---|
| **M1a** | `applyMicToForm` 의 `form[target]` → `''` (예문 이어 붙이기 → 덮어쓰기) | **잡힘**(1 fail) | `결과를 폼 값으로(R3·R9)` |
| **M1b** | `applyMicResult` 이어 붙이기 → `return said` | **잡힘**(3 fail) | `예문은 끝에 이어 붙인다`·`한도를 넘어도…`·`결과를 폼 값으로` |
| **M2a** | `micFinalStep` 의 `micFinalAction(r.pressed, …)` → `(r.target, r.target, …)` | **잡힘**(1 fail) | `결과 도착(R4·R7)` |
| **M2b** | `micFinalAction` 의 `pressed !== current` 조건 제거 | **잡힘**(2 fail) | `손을 뗀 뒤 결과…`·`결과 도착` |
| **M3a** | 훅 final 뒤 `setTarget(next.target)` 제거 | **잡힘** | `훅 — 누르면 누른 칸을 기록하고(R8)…` 스캔 |
| **M3b** | 훅 final 뒤 `refs.current = next` 제거 | **잡힘** | 같은 스캔 |
| **M4** | `enrich` 의 `mic.close()` 제거 | **잡힘**(2 fail) | `추가 시트 배선…`·`단계가 바뀌거나 칸이 사라지는 곳마다…(R1·R2)` |
| **M5** | `retarget` 의 `setDismissed(…)` 제거 | **잡힘** | `훅 — 칸이 바뀔 때…(REV069-4)` 스캔 |
| **M6a** | 결과 뒤 effect 의 `toggleRef.current?.focus()` 제거 | **잡힘** | `전환 버튼 — …(REV069-2)` 스캔 |
| **M6b** | 오류 띠 「글자로 쓰기」 뒤 `toggleRef.current?.focus()` 제거 | **잡힘** | 같은 스캔 |
| **M7** | `set(target, r.value)` (인식 결과를 칸에 반영하는 줄) 제거 | **잡힘** | `추가 시트 — 인식 결과는 폼의 지금 값에 합쳐 칸에 넣고…` 스캔 |
| X1 | REV069-3 되돌림(`surfaceRef.current?.focus()` 가지 복원) | 잡힘 | `1단계에서 빈 표현 오류가 나도…(REV069-3)` |
| X5 | `seenN` 초기값을 `null` 로(마운트 때 포커스 훔침) | 잡힘 | `전환 버튼…` 스캔 |
| X6 | 한도 초과 `setErrors` 제거 | 잡힘 | `추가 시트 — 인식 결과는…` 스캔 |
| X7 | `visibleMicError` 가림 제거 | 잡힘 | `칸이 바뀌면…(REV069-4)` 순수 시험 |
| X8 | `save` 의 `mic.close()` 제거 | 잡힘 | `…마다 말로 쓰기를 닫는다(R1·R2)` |
| X9 | `press` 의 누름 기록(`micPress`) 제거 | 잡힘 | 훅 스캔 |
| **X2** | 빈 결과 안내 `setHint(STT_HINT_COPY.EMPTY_RESULT)` 제거 | **생존** | — |
| **X3** | `toggle` 의 `setHint(null)` 제거 | **생존** | — |
| **X4** | `dismissError: () => setDismissed(error)` → `() => undefined` (오류 띠 닫기 버튼 무력화) | **생존** | — |

→ 요구한 7개(M1~M7)와 1차 생존 7개는 **모두 잡힘**. 못 잡은 것은 X2·X3·X4 세 개뿐이고 전부 이번 수정 범위 밖의 기존 훅 분기다(아래 REV069-7).

### 불변 재확인 (회귀 점검만)

| 항목 | 결과 | 근거 |
|---|---|---|
| L1 마이크 칸 = 표현·예문만 | 유지 | `WordForm.tsx`·`labels.ts` 는 1차 감사 이후 **바이트 변경 0**(`diff -rq` 로 달라진 파일은 위 6개뿐). 시험 `폼 — 표현·예문 칸에만 붙고…` 통과 |
| L4 `MIC_TEST`·자동 저장/자동 뜻 채우기 없음 | 유지 | `useWordMic.ts` 의 `purpose` 는 `'MIC_TEST'` 하나, `'TURN'`·`chatId`·`utteranceId` 0. 새·고친 3파일에서 엔진명·`fetch(`·`apiPost`·`localStorage`·`console.` 등 grep 0건(주석 제외). `onResult` 블록에 `enrich`·`save`·`apiPost`·`onSaved` 0 |
| L6 수정 시트 `WordForm` mic 꺼진 경로 DOM | 유지 | `WordForm.tsx` 가 안 바뀌었음을 확인한 뒤에도 HEAD 와 다시 대조: `renderToStaticMarkup` 3가지 값(오류 없음 / 모든 오류+예문 펼침+메모 / 빈 값+`surfaceNote`+`chunkNote`)에서 HEAD 버전과 **바이트 동일**(길이 4467 · 6319 · 5702; 임시 `WordFormOld.tsx`·시험은 확인 직후 삭제, 이후 전체 시험은 다시 돌리지 않음 — 1차 때 이것이 전체 시험 실패 1건의 원인이었다) |
| 엔진명 비노출 | 유지 | 위 grep + 화면 문구 시험 통과 |
| 수업·질문·회화·`WordDetailSheet` 무변경 | 확인 | `git status` 로 `src/components/{lesson,ask,talk,speech}`·`vocab/WordDetailSheet.tsx` 변경 0건, `android`·`plugins`·`capacitor.config.ts`·`prisma`·`src/app`·`src/modules`·`package.json` 변경 0건 |

### 새 결함

#### REV069-6 · Low · 결과 반영 뒤 포커스 이동이 사용자가 다른 입력 칸으로 옮겼어도 일어난다
- 위치: `src/components/vocab/WordMicField.tsx:65-71`(effect)
- 근거: 손을 뗀 뒤 인식기가 `finishing` 인 동안(약 1초 안팎)은 칸이 열려 있고 결과가 반드시 반영된다(`micFinalAction` 은 열린 칸만 본다). 그 사이 사용자가 뜻 같은 다른 입력 칸을 탭해 포커스를 옮기면, 결과가 도착해 `toggleRef.current?.focus()` 가 그 입력의 포커스를 빼앗아 전환 버튼으로 옮긴다. 옛 코드는 포커스를 건드리지 않아 이 일이 없었다(이번 수정이 만든 작은 회귀). 모바일에서는 키보드가 닫히고 커서를 잃는다.
- 위험: 작다(드문 타이밍, 데이터 영향 없음, 다시 탭하면 됨).
- 권고(차단 아님): effect 에서 `document.activeElement` 가 `body` 이거나 이 칸(누르고 말하기 버튼 포함) 안일 때만 옮기고, 다른 입력에 포커스가 있으면 그대로 둔다. 손대지 않고 폰 확인에서 거슬리면 그때 고쳐도 된다.

#### REV069-7 · Low · 훅에 소스 스캔이 닿지 않는 분기 3개(참고)
- 위치: `useWordMic.ts` — ① `onFinal` 의 빈 결과 가지 `setHint(STT_HINT_COPY.EMPTY_RESULT)`(X2) ② `toggle` 의 `setHint(null)`(X3) ③ `dismissError: () => setDismissed(error)`(X4)
- 근거: 위 변이 X2·X3·X4 가 시험 35개 전부 통과. 순수 시험은 빈 결과가 `{kind:'empty'}` 로 분류되는 것까지만 보고 훅의 안내 설정은 안 본다. ③ 은 오류 띠의 「닫기」 버튼이 아무 일도 안 하게 되는 회귀다.
- 위험: 지금 코드는 맞다. 이후 수정에서 안내 문구가 안 나오거나 닫기 버튼이 죽어도 시험이 모른다(UI 만 영향, 데이터 무관).
- 권고(차단 아님, 선택): `wordMicField.test.ts` 소스 스캔 두 줄 추가 — `onFinal` 구간에 `setHint(STT_HINT_COPY.EMPTY_RESULT)`, 훅 소스에 `dismissError:()=>setDismissed(error)`. 이번 라운드에 필요한 보강은 아니다.

#### REV069-5 (후속, 변동 없음)
- `useSpeechConfig` 를 위한 `@/components/lesson/useLessonVoice` 번들 결합 — developer 가 미룸. 동의한다(기존 선례, 이번 task 의 범위 밖).

### 요약 JSON

```json
{
  "reviewId": "REV-069-R2",
  "status": "PASS_WITH_NOTES",
  "resolved": ["REV069-1", "REV069-2", "REV069-3", "REV069-4"],
  "issues": [
    { "id": "REV069-6", "severity": "LOW", "component": "src/components/vocab/WordMicField.tsx:65-71", "risk": "손 뗀 뒤 결과가 오기 전 다른 입력 칸으로 옮겼다면 포커스를 빼앗김", "evidence": "effect 가 activeElement 를 보지 않고 toggleRef.focus()", "recommendation": "activeElement 가 body 이거나 이 칸 안일 때만 이동(선택)" },
    { "id": "REV069-7", "severity": "LOW", "component": "src/components/vocab/useWordMic.ts (onFinal empty / toggle setHint / dismissError)", "risk": "훅 분기 3개가 시험 밖", "evidence": "변이 X2·X3·X4 생존", "recommendation": "소스 스캔 두 줄(선택)" },
    { "id": "REV069-5", "severity": "LOW", "component": "useWordMic.ts:9", "risk": "수업 재생 코드가 단어 시트 번들에 딸려 옴", "evidence": "기존 선례, 후속", "recommendation": "useSpeechConfig 를 speech 폴더로 이동(후속)" }
  ],
  "summary": { "critical": 0, "high": 0, "medium": 0, "low": 3 },
  "high_risk_areas": ["결과 반영 뒤 전환 버튼 포커스(실기기·TalkBack)", "1단계 빈 표현 [뜻 채우기] 후 입력 칸 포커스(말로 쓰는 중)", "표현→예문 칸 전환 시 이전 오류 띠가 안 새는지", "손 뗀 직후 칸 전환 시 앞 결과 무시(설계)", "온디바이스 첫 누름 권한 대화상자 안내", "360px 큰 글꼴 가로 넘침"],
  "native_change": false
}
```

### 사용자 폰 확인 때 볼 것 (이번 수정분 추가)
1. 표현 칸에서 말하고 손을 떼면 값이 들어가고 포커스가 「표현 말로 쓰기」 버튼으로 오는지(TalkBack 켠 상태에서 「알아들은 말: …」 뒤에 그 버튼이 읽히는지). 손을 뗀 직후 뜻 칸을 탭하면 포커스가 뺏기는지(REV069-6).
2. 1단계에서 마이크를 연 채 표현이 빈 상태로 [뜻 채우기] → 오류 문구와 함께 입력 칸이 나타나고 포커스가 가는지.
3. 표현 칸에서 연결 실패 등으로 오류 띠가 뜬 뒤 [글자로 쓰기] → 예문 「말로 쓰기」를 열었을 때 같은 오류 띠가 먼저 보이지 않고, 누르고 다시 실패하면 새 오류 띠가 보이는지.
4. 1차 때의 항목(온디바이스 첫 누름 안내·마이크 거부·360px)은 그대로 유효하다.
