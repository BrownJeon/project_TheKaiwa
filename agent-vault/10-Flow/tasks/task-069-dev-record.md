---
task_id: task-069
title: "task-069 Developer 기록 — 단어 추가 시트 말로 쓰기"
role: developer
track: light
created: 2026-10-15
tags:
  - type/dev-record
  - domain/vocab
  - domain/speech
aliases:
  - task-069 dev-record
---

# task-069 Developer 기록 (단어 추가 시트 말로 쓰기, IMP-0043)

이력서: [[task-069-improve-word-add-mic]] · 백로그: [[IMP-0043-words-add-mic-input]] · 선례: 수업 ④ 「말로 쓰기」, 질문 탭 말 모드([[task-066-ask-chatbot-voice]])

## 변경 파일 (코드 7 + 시험 2 = 9개, 12개 한도 안)

| 파일 | 구분 | 내용 |
|---|---|---|
| `src/components/vocab/wordMic.ts` | 신규 | 순수 규칙 — `applyMicResult`(표현 바꿔 넣기·예문 이어 붙이기·빈 결과 null·자르지 않음·표현 줄바꿈 제거), `micFinalAction`(누른 칸을 떠났으면 무시), `micToggle`/`micClose`(칸 전환·막힘일 때 열지 않기), `micBlockedCode`(막힘 판정), `wordMicStatusText`(상태 줄), `WordMic` 타입 |
| `src/components/vocab/useWordMic.ts` | 신규 | 얇은 훅 — `useSpeechConfig`(#19 한 번 읽기) + `useRealtimeStt({ purpose:'MIC_TEST', maxSec:30 })`. 열린 칸·누른 칸 ref, 결과를 `onResult(target,text)` 로 넘기고 글자 모드로 복귀 |
| `src/components/vocab/WordMicField.tsx` | 신규 | 칸 하나의 「글자로/말로」 — 라벨 줄 오른쪽 전환 버튼, 말로 쓰는 동안 입력 칸 자리에 점선 상자 + 오류 띠(`SttAlert`) + `PushToTalkButton` + 레벨 미터 + 상태 줄, 막힘이면 버튼 비활성 + 이유 한 줄, 화면 읽기용 알림 |
| `src/components/vocab/WordForm.tsx` | 수정 | 옵션 prop `mic?: WordMic`(기본 꺼짐). 표현·예문 칸만 `withMic` 로 감싼다. `mic` 없으면 Fragment 로 지금과 같은 DOM |
| `src/components/vocab/WordAddSheet.tsx` | 수정 | `useWordMic` 하나, 1단계 표현 칸·폼에 연결, `onResult` 는 `applyMicResult` → `set` → 한도 초과면 기존 검증 문구. 닫는 지점 5곳(아래) |
| `src/components/vocab/labels.ts` | 수정 | `WORD_MIC_COPY`(버튼·상자·힌트 문구) |
| `src/components/vocab/__tests__/wordMic.test.ts` | 신규 시험 | 순수 규칙 11개 |
| `src/components/vocab/__tests__/wordMicField.test.ts` | 신규 시험 | 화면 배선 13개(`renderToStaticMarkup` + 소스 스캔) |

네이티브 변경 없음 · 새 API/DB/환경변수/의존성 없음 · 수업·질문·회화·`WordDetailSheet` 파일은 한 줄도 바꾸지 않았다.

## 설계 결정

**재사용한 조각** (복사하지 않고 그대로 import)
- `useRealtimeStt`(`purpose:'MIC_TEST'` 고정 → 서버·휴대폰 모두 원음 저장 없음, 대화 id 없음), `useSpeechConfig`(수업 훅 파일에서; 질문 탭 `useAskInput` 도 같은 선례), `PushToTalkButton`(72px), `MicLevelMeter`, `SttAlert`(오류 띠 — 앱 설정 열기·모델 설정 링크 포함), `sttErrorCopy`/`STT_*_COPY`/`MIC_TEST_COPY`(문구), `micPreflight` 결과(훅 안 `ui.error`/`phase:'unavailable'`)
- `validateWord`·`WORD_LIMITS`(한도 문구), `set()`/`errors`(시트 상태)

**새로 만든 조각**
- `useWordMic`: 수업 `useLessonVoice` 는 재생 큐(`pb`)·토스트에 묶여 있어 쓰지 않았다(지시 1항). 상태 줄 우선순위만 `wordMicStatusText` 로 옮김(시험으로 수업과 같은 순서 고정).
- 칸 전환·막힘·결과 처리를 훅 밖 **순수 함수**로 빼서(`micToggle`·`micClose`·`micFinalAction`·`micBlockedCode`) 훅이 얇고 시험 가능하게 했다.

**L1~L7 대응**
- L1 표현(1단계 + 폼) · 예문만. 읽기·뜻·예문 뜻·메모·분류 없음 — 시험이 폼 안 전환 버튼 aria-label 을 센다(펼침 시 2개, 접힘 1개).
- L2 수업과 같은 「글자로 쓰기/말로 쓰기」 문구 + 말로 쓰는 동안 칸이 점선 상자 + 누르고 말하기로 바뀜. 키보드는 끄지 않는다(글자 모드가 기본, 막힘이어도 입력 칸 그대로).
- L3 표현 바꿔 넣기 / 예문 이어 붙이기(빈 칸·공백뿐이면 그대로). 자르지 않고 한도 초과면 `validateWord` 문구를 바로 `errors` 에 올린다. 빈 결과는 `EMPTY_RESULT` 안내(수업과 같은 문구).
- L4 `MIC_TEST` 고정, 알아들은 말은 `useState`(announce)·칸 값에만. 새 `fetch`/저장/로그 없음(소스 스캔 시험). 자동 저장·자동 [뜻 채우기] 없음 — `onResult` 블록에 `enrich(`/`save(`/`apiPost` 가 없음을 시험이 지킨다.
- L5 막힘(`phase:'unavailable'` = 비보안 주소·지원 안 함·서버 인식 꺼짐·오프라인·휴대폰 파일 없음, 또는 `MIC_DENIED`)이면 「말로 쓰기」 버튼을 `aria-disabled` + 이유 한 줄(`sttErrorCopy` 제목, 마이크 거부는 행동 문구까지). 앱/웹 경로는 기존 `useRealtimeStt` 가 고른다.
- L6 `WordForm` 의 `mic` 는 옵션(기본 꺼짐), `WordDetailSheet` 는 건드리지 않음(시험 + 변이 M12).
- L7 중복 409·조각 필수·429 잠금·`enrich` 흐름 코드는 그대로(`git diff` 에서 해당 블록 변경 없음). 터치: 전환 버튼 `h-11`(44px), 누르고 말하기 72px(≥64), 상자 `min-w-0`·`break-keep`·`[overflow-wrap:anywhere]`.

**말로 쓰기를 닫는 지점 5곳(`WordAddSheet`)** — 입력 칸이 사라지거나 단계가 바뀌는 때
`enrich()` 시작(검증 통과 뒤) · [직접 입력하기] · 예문 펼침 접기(`close('example')`) · `save()` 검증 통과 뒤 · `focusField(f)`(오류 포커스가 갈 칸이 말로 쓰는 중이면 글자로 돌림, 표현/예문만). 1단계에서 빈 표현으로 [뜻 채우기]를 눌러 오류가 나면 `close('surface')` 후 기존처럼 포커스.

**손 뗀 뒤 결과가 늦게 올 때** — 누른 칸(`pressedRef`)과 지금 열린 칸이 다르면 무시한다. 알아듣는 동안 사용자가 글자 모드로 가거나 다른 칸을 열어도 엉뚱한 칸에 말이 들어가지 않는다(`micFinalAction`, 변이 M4).

## 사양과 달라지거나 해석한 점 (Leader 확인)

1. **시험 러너는 vitest 가 아니라 `node:test` + tsx** (`package.json` 의 `test` 스크립트). 지시문의 `vitest run` 은 쓰지 못했고 저장소 관례대로 `node --import tsx --test` 로 돌렸다.
2. **전환 버튼 위치 = 라벨 줄 오른쪽**(수업은 입력 아래). 칸이 점선 상자로 바뀌어도 버튼 자리가 움직이지 않게 하려는 선택. 대가: 라벨 줄이 44px 이라 칸마다 약 26px 늘어난다(표현·예문 둘). designer 가이드가 없는 light 트랙이라 수업 모양을 최대한 따르되 이 위치만 다르다 — 어색하면 입력 아래로 옮기는 건 `WordMicField` 안 한 곳 변경.
3. **마이크 거부(`MIC_DENIED`)도 비활성**(L5 그대로). 단 이미 열린 칸은 막혀도 글자로 돌아갈 수 있다. 앱에서 영구 거부일 때 [앱 설정 열기] 버튼은 열린 칸의 오류 띠(`SttAlert`)에만 있고, 비활성 이유 줄에는 경로 문구만 둔다(한 줄 원칙).
4. **휴대폰 → 서버 전환 토스트(`STT_SWITCH_TOAST`)는 붙이지 않았다** — 단어 시트에 토스트 자리가 없고, 같은 내용이 `ENGINE_ERROR` 오류 띠(`switched`)에 이미 있다.
5. 사양에 없던 추가: 방금 넣은 말을 화면 읽기용 `role="status"` 로 알린다(MIC_TEST_COPY.announcePrefix 재사용), 칸 안에 힌트 한 줄(표현은 바꿔 넣고 예문은 이어 붙는다는 동작을 알림).

## 증빙 (미러 `~/.node-local/thekaiwa-dev069`, 저장소 `src`/`scripts`/`package.json` rsync 후)

| 명령 | 결과 |
|---|---|
| `./node_modules/.bin/tsc --noEmit` | 종료 코드 0 (시험 파일 포함 — 첫 `next build` 가 시험 파일 타입 오류를 잡아 고친 뒤 재실행) |
| `./node_modules/.bin/eslint src/components/vocab` | 종료 코드 0 |
| `node --import tsx --test --test-concurrency=1 src/components/vocab/__tests__/wordMic.test.ts …/wordMicField.test.ts` | tests 24 · pass 24 · fail 0 |
| 전체 `node --import tsx --test --test-concurrency=1 $(find src scripts/seed-build -name '*.test.ts' \| sort)` | tests 4090 · pass 4088 · fail 0 · skipped 2 (이전 4,066 + 24, 건너뜀 2는 기존) |
| `./node_modules/.bin/eslint .` (전체) | 이 task 파일 오류 0. 전체는 종료 코드 1(오류 54·경고 86) — **오류는 전부 `tests/live/**`(손대지 않은 파일)**, `src` 쪽은 경고뿐이고 그 중 5개(`admin/trace/DiagnosticsScreen`·`settings/{LearningSettings,OnDeviceDiagnosticsCard,SpeechSettings,VoiceSettings}`)는 기준 미러(`rev068`)에서도 같은 경고 |
| `DATABASE_URL=<가짜> ./node_modules/.bin/next build > /tmp/claude-1000/dev069-build.log 2>&1; echo $?` | 종료 코드 0 (Compiled successfully, 타입 검사 통과; persona/loader.ts 동적 파일 접근 경고 3건은 기존) |

**변이 점검 12개** (미러에서 한 번에 하나만 깨고 시험 실행 → 매번 NFS 원본으로 복원, 마지막 `diff -rq` 일치) — 전부 시험이 실패로 잡음:
M1 `MIC_TEST`→`TURN`(시험 24) · M2 예문 이어 붙이기→바꿔 넣기(시험 3·5) · M3 빈 결과를 null 로 안 돌려줌(시험 4) · M4 누른 칸 확인 제거(시험 6) · M5 막힘일 때 열기 허용(시험 8) · M6 읽기 칸에도 마이크(시험 20) · M7 비활성 표시 제거(시험 15) · M8 결과 반영 직후 자동 `enrich()`(시험 23) · M9 마이크 거부를 막힘으로 안 봄(시험 10) · M10 2,000자로 자름(시험 5) · M11 표현 줄바꿈 제거 삭제(시험 2) · M12 수정 시트 폼에 `mic` 전달(시험 22).

## 알려진 한계

- **실제 녹음·권한 팝업·휴대폰(온디바이스)·서버 경로는 단위 시험으로 못 본다** — 훅(`useWordMic`)은 DOM 이 필요해 순수 규칙과 소스 스캔으로만 잠갔다. 사용자 폰 확인(light 트랙, QA 없음) 항목: ① 표현 칸에서 말로 쓰기 → 칸에 일본어가 들어오고 고쳐서 [뜻 채우기]/저장 ② 폼 단계 표현 바꿔 넣기 ③ 예문 이어 붙이기 ④ 마이크 거부 상태에서 버튼이 막히고 이유가 보임 ⑤ 읽기·뜻 칸과 단어 수정 시트에 마이크 없음 ⑥ 360/390px 에서 가로 넘침·버튼 가림 없음.
- 시트를 열 때마다 `#19` 설정 읽기 1회 + 인식기 준비(권한은 조회만, 묻지 않음)가 따라온다 — 마이크를 안 써도 발생한다(질문 탭과 같은 비용).
- Permissions API 가 없는 브라우저에서 한 번 마이크를 거부하면 시트를 다시 열 때까지 「말로 쓰기」가 막혀 있다(권한 변경 이벤트가 안 와서). 키보드는 영향 없음.
- 말로 쓰는 칸은 입력 칸이 없어 긴 예문은 상자에 3줄까지만 보인다(전체는 글자 모드에서). 녹음을 중간에 취소한 뒤 같은 칸을 다시 열면 「녹음이 중간에 멈췄어요」 힌트가 한 번 남아 있다(수업 「말로 쓰기」와 같은 동작).
- 라벨 줄 44px 로 폼이 약 52px 길어진다(표현·예문). 시트 안 스크롤은 기존 그대로.

## reviewer 가 볼 곳

1. `useWordMic.ts` — `onFinal` 의 `pressedRef`/`targetRef` 처리와 `purpose:'MIC_TEST'`·`chatId` 없음.
2. `WordMicField.tsx` — `off`(막힘이고 안 열림) 판정, 열린 칸의 글자로 복귀 가능, 접근 이름("표현 말로 쓰기"가 보이는 글자 포함).
3. `WordForm.tsx` — `mic` 없을 때 DOM 이 이전과 같은가(`git diff` 의 `withMic` Fragment), 읽기·뜻·예문 뜻·메모·분류에 마이크가 없는가.
4. `WordAddSheet.tsx` — `mic.close` 호출 5곳, `onResult` 가 `enrich`/`save` 를 부르지 않는 것, 기존 409/429/조각 필수 흐름 불변.
5. 재실행: 위 증빙 명령(미러 `thekaiwa-dev069` 를 `cp -al` 로 새로 만들어 쓰면 됨).

## REV069 수정 라운드 (2026-10-15 11:34, 미러 `~/.node-local/thekaiwa-dev069b` — dev069 를 `cp -al` 후 저장소 `src`/`tests`/`scripts`/`package.json` rsync)

범위: 감사 [[task-069-rev-record]] 의 REV069-1(Medium)·-2·-3·-4(Low)만. REV069-5(번들 결합)는 후속이라 건드리지 않았고, 마이크를 읽기·한국어 칸·수정 시트에 늘리거나 표현 끝 마침표 규칙 같은 새 규칙은 넣지 않았다. 변경은 `src/components/vocab/` 안 6개(코드 4 + 시험 2)이며 공용 `Sheet` 등 밖으로 퍼지지 않았다. 네이티브·API·DB·환경변수·의존성 변경 없음. 파일 수는 이전과 같다(신규 파일 없이 기존 시험에 추가).

### 수정 4건

| 항목 | 변경 파일 | 내용 |
|---|---|---|
| **REV069-1** 배선 시험 구멍 | `wordMic.ts` · `useWordMic.ts` · `WordAddSheet.tsx` · 시험 `wordMic.test.ts` · `wordMicField.test.ts` | ① 훅의 press/final/close ref 갱신 규칙과 시트의 결과 합치기를 `wordMic.ts` 순수 함수로 한 단계 더 뺐다 — `MicRefs`·`micPress`(누른 칸 기록)·`micFinalStep`(결과 도착 시 반영하면 두 값 비움·무시/빈 결과는 그대로)·`applyMicToForm`(폼 지금 값에 합치기 + 한도 초과 시 검증 문구). 훅은 `refs` 하나(`MicRefs`)로 이 함수들을 부르기만 하고(동작 불변), 시트 `onResult` 는 `applyMicToForm(form, target, text)` 한 줄이 규칙을 가진다. ② 순수 규칙 시험 5개 추가(누름·결과 도착 6가지 경우·폼 합치기·한도·오류 넘김·포커스 판정) ③ 소스 스캔 6개 추가(`wordMicField.test.ts`, 주석·공백을 모두 지운 소스에서 「제자리에 있는 호출」 확인 — 훅 press/onFinal/retarget, 시트 onResult/닫는 5곳/빈 표현 포커스, 전환 버튼 포커스). 줄 번호 의존 없음 |
| **REV069-3** 1단계 빈 표현 포커스 | `WordAddSheet.tsx` (`enrich()` 의 `if (bad)` 가지) | `if (step === 'surface') { mic.close('surface'); surfaceRef.current?.focus() } else focusField('surface')` → `focusField('surface')` 하나. 말로 쓰는 중이면 입력 칸이 DOM 에 없어 ref 가 null 이던 것을, 글자로 돌린 뒤 `setTimeout` 으로 `getElementById` 포커스(두 단계 공통, id 는 `wadd_surface` 로 같다) |
| **REV069-4** 오류가 칸 사이로 샘 | `wordMic.ts`(`dismissedAfterRetarget`·`visibleMicError`) · `useWordMic.ts`(`retarget`) | 열린 칸이 바뀔 때(열기·옮기기·닫기) 그때 보이던 `ui.error` 를 `dismissed` 로 넣는다. 감사 권고는 `toggle` 만 말했지만 `close()`(뜻 채우기 시작·직접 입력하기·저장·예문 접기·오류 포커스)도 같은 경로로 칸을 닫아 같은 누출이 나므로, 훅 안 `retarget()` 하나를 `toggle`/`close` 가 같이 쓰게 했다(칸이 그대로면 아무것도 안 함 — 동작 불변). 이후 새로 난 오류는 다른 객체라 그대로 보이고, 막힘 판정(`blocked`)은 `dismissed` 를 보지 않아 막힘 이유 줄은 그대로 남는다 |
| **REV069-2** 결과 반영 뒤 포커스 소실 | `WordMicField.tsx` · `wordMic.ts`(`micResultFocus`) | 전환 버튼에 `ref`. `mic.announce`(결과마다 `n` 증가)가 이 칸의 새 결과가 되면 effect 에서 그 버튼으로 포커스(`seenN` 을 마운트 때의 `n` 으로 시작해 단계 전환으로 새로 그려진 칸이 포커스를 훔치지 않는다 — `micResultFocus(seenN, announce)`). 오류 띠의 「글자로 쓰기」(`onTextMode`)도 `mic.close(target)` 뒤 같은 버튼으로 포커스(버튼은 항상 마운트돼 있어 바로 가능). 입력 칸이 아니라 버튼으로 가는 것은 감사 권고대로 — 모바일에서 소프트 키보드가 갑자기 뜨지 않는다 |

### 변이 재점검 (미러에서 한 번에 하나만 깨고 시험 실행 → `sync.sh`(rsync --delete)로 원복, 마지막에 `diff -rq` 로 `src` 일치 확인)

기준선: 마이크 시험 2개 파일 35 pass(이전 24). 감사의 변이는 훅이 `refs` 로 바뀐 뒤의 코드에 맞춰 옮겼고, 소스 스캔(호출이 빠짐)과 순수 함수(의미가 바뀜) 두 방향 모두 깼다.

| 감사 ID | 이전 | 깬 곳 (이번) | 이번 결과 | 잡은 시험 |
|---|---|---|---|---|
| R1 | 생존 | `save()` 의 `mic.close()` 제거 | **잡힘** | 시트 닫는 곳 스캔(`if(first){…return}mic.close()setSubmitting(true)`) |
| R2 | 생존 | [직접 입력하기]의 `mic.close()` 제거 | **잡힘** | 시트 닫는 곳 스캔(`mic.close()setFromDraft(false)`) |
| R3 | 생존 | 현재값 자리에 `''` — ⓐ `applyMicToForm` 안 `form[target]`→`''` ⓑ 시트 호출 `applyMicToForm(form,…)`→`({...form,[target]:''},…)` | **잡힘 ⓐⓑ** | ⓐ `결과를 폼 값으로`(예문 이어 붙이기 값) ⓑ 시트 onResult 스캔 |
| R4 | 생존 | 누른 칸 가드 무력화 — ⓐ `micFinalStep` 의 `micFinalAction(r.pressed,…)`→`r.target` ⓑ 훅이 `pressed` 를 `target` 으로 덮어서 넘김 | **잡힘 ⓐⓑ** | ⓐ `결과 도착`(칸을 옮긴 뒤 늦은 결과 무시) ⓑ 훅 onFinal 스캔 |
| R7 | 생존 | 결과 뒤 글자 모드 복귀 제거 — ⓐ 훅 `setTarget(next.target)` 제거 ⓑ `micFinalStep` 이 반영 후에도 `refs` 를 안 비움 | **잡힘 ⓐⓑ** | ⓐ 훅 onFinal 스캔 ⓑ `결과 도착`(반영 뒤 `MIC_REFS_INIT`, 늦은 중복 무시) |
| R8 | 생존(기능 전체 불능) | 누름 기록 제거 — ⓐ 훅 press 의 `refs.current = micPress(…)` 제거 ⓑ `micPress` 가 `pressed` 를 안 바꿈 | **잡힘 ⓐⓑ** | ⓐ 훅 press 스캔 ⓑ `누름` + `결과 도착` 2개 |
| R9 | 생존 | 한도 초과 안내 제거 — ⓐ 시트의 `if (over) setErrors(…)` 제거 ⓑ `applyMicToForm` 이 `error: undefined` 만 돌려줌 | **잡힘 ⓐⓑ** | ⓐ 시트 onResult 스캔 ⓑ `결과를 폼 값으로`(81자 표현·2,001자 예문 문구) |
| (신규) N3 | — | REV069-3 되돌림(`enrich` 의 `surfaceRef.current?.focus()` 가지 복원) | 잡힘 | `1단계에서 빈 표현 오류…`(`surfaceRef.current` 없음) |
| (신규) N4 | — | REV069-4 — ⓐ 훅 `setDismissed(…)` 제거 ⓑ `dismissedAfterRetarget` 이 항상 `dismissed` | 잡힘 ⓐⓑ | ⓐ 훅 retarget 스캔 ⓑ `칸이 바뀌면…`(오류 띠 가림) |
| (신규) N2 | — | REV069-2 — ⓐ effect 의 `toggleRef.current?.focus()` 제거 ⓑ `ref={toggleRef}` 제거 ⓒ `micResultFocus` 가 마운트 때도 true ⓓ 오류 띠 「글자로」 뒤 포커스 제거 | 잡힘 ⓐⓑⓒⓓ | `전환 버튼…` 스캔 ⓐⓑⓓ · `micResultFocus` 순수 시험 ⓒ |

→ 감사에서 살아남은 7개(R1·R2·R3·R4·R7·R8·R9) **모두 이번에 잡힘**, 신규 4개 영역(N2~N4) 포함 변이 19개 전부 시험 실패. 소스 스캔으로 못 잡는 것은 없었다(의미가 바뀌는 변이는 순수 함수로 내려서 시험이 직접 본다). 생존 0.

### 증빙 (미러 `~/.node-local/thekaiwa-dev069b`, 저장소 `src` 와 `diff -rq` 동일 확인)

| 명령 | 결과 |
|---|---|
| `./node_modules/.bin/tsc --noEmit` | 종료 코드 0 |
| `./node_modules/.bin/eslint src/components/vocab` | 종료 코드 0, 출력 없음 |
| `node --import tsx --test --test-concurrency=1 …/wordMic.test.ts …/wordMicField.test.ts` | tests 35 · pass 35 · fail 0 (이전 24 → +11: 순수 5 + 소스 스캔 6) |
| vocab 전체(`find src/components/vocab -name '*.test.ts'`) | tests 260 · pass 260 · fail 0 (감사 때 249) |
| 전체 `find src scripts/seed-build -name '*.test.ts'` | tests 4101 · pass 4099 · fail 0 · skipped 2 (감사 때 4090 → +11, 건너뜀 2는 기존) |
| `DATABASE_URL=<가짜> ./node_modules/.bin/next build > /tmp/claude-1000/dev069b-build.log 2>&1` | 종료 코드 0 (Compiled successfully, 타입 검사 통과, `persona/loader.ts` 동적 파일 접근 경고 3건은 기존) |

### 남은 한계

- 훅·`WordMicField` 의 effect 는 DOM 이 없어 **실제로 실행하는 시험이 없다**(이 저장소에는 jsdom/@testing-library 가 없다). 대신 규칙은 순수 함수로 내려 의미를 직접 시험하고, 훅·컴포넌트에는 「그 호출이 제자리에 있다」는 소스 스캔만 걸었다. 따라서 스캔이 보장하는 것은 배선이 빠지거나 인자가 바뀌지 않는 것까지이고, 포커스가 실제로 버튼에 앉는지·결과가 실제 칸에 들어가는지는 사용자 폰 확인 몫이다. 소스 스캔은 표지 문자열(`constretarget=useCallback` 등)에 묶여 있어 훅·시트의 변수명을 바꾸면 시험도 같이 고쳐야 한다.
- 결과 반영 뒤 포커스는 **전환 버튼**으로 간다(감사 권고). 키보드 사용자가 곧바로 고치려면 Tab 한 번이 더 든다. 입력 칸으로 보내는 쪽이 낫다고 판단되면 `WordMicField` 의 effect 한 곳(+ 모바일 소프트 키보드가 갑자기 뜨는 부작용 검토)이다.
- `retarget` 이 칸을 닫을 때 보이던 오류를 넘기므로, 오류 띠를 본 뒤 칸을 닫고 같은 칸을 다시 열면 띠가 먼저 보이지 않는다(다시 누르면 새 오류는 보인다). 의도된 동작이다.
- 위 외의 한계(실기기·온디바이스·권한 팝업, Permissions API 없는 브라우저, 긴 예문 3줄 표시)는 앞 절 「알려진 한계」 그대로.
