---
task_id: task-073
title: "task-073 Developer 기록 — W-2 단어 추가 「말로 쓰기」 안내 문구(일본어 발음 예시 + 인식 직후 확인 안내)"
role: developer
track: light
created: 2026-10-16
tags:
  - type/dev-record
  - domain/vocab
  - domain/speech
aliases:
  - task-073 dev-record
---

# task-073 Developer 기록 (W-2, IMP-0047)

이력서: [[task-073-improve-word-add-copy]] · 백로그: [[IMP-0047-word-add-mic-hint-copy]] · 앞선 구현: [[task-069-dev-record]] · W-3(판정 이유 프롬프트)은 prompt-engineer 몫이라 `src/modules/conversation/**` 는 건드리지 않았다.

## 변경 파일 (코드 6 + 시험 2 = 8개, 12개 한도 안)

| 파일 | 구분 | 내용 |
|---|---|---|
| `src/components/vocab/labels.ts` | 수정 | `WORD_MIC_COPY.hint.surface` = 「일본어 발음으로 말해 주세요 (예: インパクト). 칸에 들어간 뒤 고칠 수 있어요.」 · `hint.example` = 「일본어 발음으로 말해 주세요. 예문 끝에 이어 붙고, 칸에 들어간 뒤 고칠 수 있어요.」(예시는 표현 칸만) · 새 `checkNotice` = 「잘못 알아들었을 수 있어요. 확인하고 고쳐 주세요.」 |
| `src/components/vocab/wordMic.ts` | 수정 | 안내 상태 전이를 **순수 함수**로: `MicNotices`(칸별 불리언)·`MIC_NOTICES_INIT`·`micNoticeStep`(applied·edited·speak·leave)·`micNoticeAfterFinal`(칸에 **들어간** 결과에만). `WordMic` 에 `notice`·`edited` 추가 |
| `src/components/vocab/useWordMic.ts` | 수정 | `notice` 상태 하나. `onFinal`(빈 결과·무시 return 뒤)에서 `micNoticeAfterFinal`, `toggle`(칸을 새로 열 때) `speak`, `close` `leave`, `edited` 콜백 노출 |
| `src/components/vocab/WordMicField.tsx` | 수정 | 글자 모드(입력 칸이 보일 때)에서 입력 칸 바로 아래에 `<p role="status" class="text-[12px] text-ink2 break-keep">` 한 줄. 말로 쓰는 중에는 안 그린다 |
| `src/components/vocab/WordForm.tsx` | 수정 | `change()` 래퍼 — 표현·예문 입력에서 사용자가 직접 고치면 `mic?.edited(f)` 후 기존 `onChange`. `text()`·`area()` 의 `onChange` 두 곳만 `change` 로 |
| `src/components/vocab/WordAddSheet.tsx` | 수정 | 1단계 표현 입력의 `onChange` 에 `mic.edited('surface')` 한 줄(폼 단계는 `WordForm` 이 맡음). `onResult` 는 **그대로** |
| `src/components/vocab/__tests__/wordMic.test.ts` | 시험 | 순수 전이 6개 추가 |
| `src/components/vocab/__tests__/wordMicField.test.ts` | 시험 | 문구 단정 2곳 갱신 + 화면 6개 + 배선 스캔 3개 추가 + 기존 REV069-4 시험의 `toggle` 정규식 1곳 갱신(구조가 `step` 지역 변수로 바뀜) |

네이티브·API·DB·환경변수·의존성 변경 없음. `WordDetailSheet`(수정 시트)·`src/modules/**` 변경 없음. 엔진명 grep(`reazon|whisper|style-bert|claude|sherpa`) 변경 파일에서 0건.

## 설계 결정

1. **상태 전이는 순수 함수** — 훅은 `micNoticeAfterFinal`/`micNoticeStep` 을 부르기만 한다. 안내가 붙는 조건(`apply` 만 — 빈 결과·무시 결과 제외)과 거두는 조건(고침·다시 말하려고 열기·단계 변화)이 모두 `wordMic.ts` 에 있어 시험이 규칙을 직접 본다.
2. **칸별 안내** — 표현과 예문이 각각 불리언이다. 둘 다 켜질 수 있다(표현에 말하고 → 예문에 말하면 표현 안내는 그대로). 표현을 고치면 표현 것만, 예문 칸을 다시 열면 예문 것만 꺼진다.
3. **「고쳤다」를 값 비교가 아니라 입력 이벤트로** — 인식 결과가 들어가는 길(`onResult` → `set`)과 사용자가 치는 길(`onChange`)이 같은 `set` 이라 값 비교는 「들어간 값」을 훅이 알아야 해서 배선이 늘고, 고쳤다가 되돌리면 되살아나는 문제가 있다. 그래서 사용자가 치는 입력 세 곳(폼의 `text`·`area`, 시트 1단계 입력)만 `edited` 를 부르고 `onResult` 는 안 부른다(시험이 `onResult` 블록에 `edited(` 가 없음을 지킨다 — 부르면 안내가 붙자마자 지워진다).
4. **거두는 시점** — ① 사용자가 그 칸을 고침(`edited`) ② 그 칸을 다시 말하려고 열음(`toggle` → `speak`) ③ `mic.close()`: [뜻 채우기] 시작·[직접 입력하기]·[저장] 검증 통과·예문 접기·오류 포커스(`focusField`)가 모두 `close` 를 거치므로 같은 규칙으로 거둔다(단계가 넘어가면 확인이 끝난 것이라 안내가 남아 있으면 오히려 틀린 안내) ④ 시트 닫힘: `WordsScreen` 이 `hydrated && sheet?.kind === 'add' ? <WordAddSheet/>` 로 조건부 렌더라 닫히면 언마운트 → 훅 상태가 사라진다(코드 변경 없음, 단위 시험으로는 못 본다).
5. **다시 말하기의 기준은 칸을 여는 순간** — 누르기(`press`)까지 기다리지 않는다. 열고 그냥 닫으면 안내가 사라진 채 값은 그대로인데, 다시 말하려는 의도로 보는 것이 안전하다고 판단했다. `press` 에서도 지우면 `toggle` 로만 도달 가능해 같은 효과라 넣지 않았다.
6. **알림** — `role="status"` 한 번 읽힘(Leader 지시). 화면 읽기용 `알아들은 말: …` 영역(상시 존재)은 그대로 두었다.

## 사양과 달라지거나 해석한 점 (Leader 확인)

1. **파일이 사양 목록보다 2개 늘었다**(`WordForm.tsx`·`WordAddSheet.tsx`, 합 8개). 사용자 직접 편집을 감지하려면 입력 `onChange` 쪽에 신호가 필요한데 그 입력이 두 파일에 있다. 값 비교로 풀면 두 파일은 안 건드리지만 위 결정 3의 이유로 택하지 않았다.
2. **L1 「한국어·영어식 발음은 잘못 받아 적힐 수 있다는 점이 한 줄 안에 드러나게」** — 안내 한 줄에 억지로 넣으면 `칸에 들어간 뒤 고칠 수 있어요` 를 빼야 해서(요약 지시의 문구와 어긋남) **「일본어 발음으로」 + 인식 직후 「잘못 알아들었을 수 있어요」** 두 곳으로 나눠 전달했다. 한 줄에 「영어·한국어 발음은 틀리게 적힐 수 있어요」까지 넣기를 원하면 `labels.ts` 한 줄 변경이다.
3. **예문 안내 말투** — 「일본어 발음으로 말해 주세요. 예문 끝에 이어 붙고, 칸에 들어간 뒤 고칠 수 있어요.」(이력서 예시 「일본어로 말하면 예문 끝에 이어 붙어요 …」보다 표현 칸 말투에 맞췄다).
4. **표현 안내에서 「표현이 바뀌어요」가 빠졌다**(새 문구가 사용자 승인 문구). 두 번 말하면 바꿔 들어가는 동작 자체는 불변이다.
5. 기존 시험의 `toggle` 정규식(REV069-4)은 `retarget(micToggle(...))` 한 줄 형태를 보고 있었는데 `step` 지역 변수로 풀어서 `conststep=micToggle(...)if(!retarget(step))return` 으로 고쳤다(같은 의미).

## 증빙 (미러 `~/.node-local/thekaiwa-dev073-dev` — `thekaiwa-dev071` 을 `cp -al` 후 저장소 `src`·`tests`·`package.json` rsync, `UserWordState` 724건 확인)

| 명령 | 결과 |
|---|---|
| `./node_modules/.bin/tsc --noEmit` | 종료 코드 0 |
| `./node_modules/.bin/eslint src/components/vocab` | 종료 코드 0, 출력 없음 |
| 마이크 시험 2개(`wordMic.test.ts`·`wordMicField.test.ts`) | tests 50 · pass 50 · fail 0 (이전 35 → +15) |
| vocab 전체(`find src/components/vocab -name '*.test.ts'`) | tests 282 · pass 282 · fail 0 |
| 전체(`find src scripts/seed-build -name '*.test.ts'`) | tests 4152 · pass 4149 · **fail 1** · skipped 2 — 실패 1건은 `modules/conversation/__tests__/wordEnrichChunk.test.ts`(baseline `wordEnrich@v2` vs `@v3`), **prompt-engineer 의 W-3 작업 중 상태**(저장소의 `wordEnrich.ts` 가 v3 로 바뀌는 중)이며 내 변경과 무관 |
| `DATABASE_URL=<가짜> ./node_modules/.bin/next build > /tmp/claude-1000/dev073-dev-build.log 2>&1` | 종료 코드 0 (타입 검사 통과) |

## 변이 점검 18개 (미러에서 한 번에 하나만 깨고 마이크 시험 2개 실행 → `rsync --delete` 로 원복, 마지막 `diff -rq src` 일치) — 전부 시험이 실패로 잡음, 생존 0

| # | 깬 곳 | 결과 | 잡은 시험 |
|---|---|---|---|
| M1 | 결과가 들어가도 안내를 안 붙임(훅 `onFinal`) | 잡힘 | 훅 배선 스캔 |
| M2 | 빈·무시 결과에도 안내가 붙음(`micNoticeAfterFinal`) | 잡힘 | 「칸에 들어간 결과에만 붙는다」 |
| M3a | 고쳐도 안 사라짐(`edited` 가 아무것도 안 함) | 잡힘(2) | 고침·흐름 시험 |
| M3b | 훅 `edited` 가 빈 함수 | 잡힘 | 훅 배선 스캔 |
| M4 | `close` 가 안내를 안 거둠(단계 전환 후 남음) | 잡힘 | 훅 배선 스캔 |
| M5 | `leave(only)` 가 두 칸 다 지움 | 잡힘(2) | 「only 가 있으면 그 칸만」 · 「같은 객체」 |
| M6 | 표현 칸에만 뜸(예문엔 안 뜸) | 잡힘(3) | 칸마다 따로 · 폼 · 칸 스캔 |
| M7 | 표현 안내가 예문 칸에도 뜸 | 잡힘(3) | 칸마다 따로 · 폼 · 칸 스캔 |
| M8 | 다시 말하려고 열어도 안 사라짐(`toggle` 의 `speak` 제거) | 잡힘 | 훅 배선 스캔 |
| M9 | `speak` 가 안 지움(순수) | 잡힘(3) | 고치거나 다시 열면 · 같은 객체 · 흐름 |
| M10 | 말로 쓰는 중인 칸에도 안내가 뜸 | 잡힘 | 「말로 쓰는 중인 칸에는 없다」 |
| M11 | 인식 결과 길(`onResult`)이 `edited` 를 불러 곧바로 지움 | 잡힘 | 폼·시트 배선 스캔 |
| M12 | 예문 직접 입력이 안내를 안 거둠(`area` 의 `change`→`onChange`) | 잡힘 | 폼·시트 배선 스캔 |
| M13 | 1단계 표현 직접 입력이 안내를 안 거둠(시트) | 잡힘 | 폼·시트 배선 스캔 |
| M14 | 안내의 `role="status"` 제거 | 잡힘(2) | 안내 마크업 · 칸 스캔 |
| M15 | 안내 문구가 바뀜 | 잡힘(4) | 문구 정본 외 |
| M16 | 표현 안내에 예시(インパクト) 없음 | 잡힘 | 열린 칸 시험 |
| M17 | 예문 안내에도 예시가 붙음 | 잡힘 | 열린 칸 시험 |
| M18 | 한 칸에 안내가 붙을 때 두 칸이 다 켜짐 | 잡힘(2) | 칸에 붙는다 · 들어간 결과에만 |

변이 점검 방식 참고: 미러는 `cp -al` 하드링크라 제자리 쓰기를 하면 다른 미러가 오염된다 — 변이는 임시 파일에 쓰고 `os.replace` 로 바꿔 새 inode 가 되게 했고, 원복은 `rsync --delete`(임시 파일 후 rename). 안내 동기화 스크립트의 `package.json` 도 `cp` 대신 `rsync -a` 로 바꿨다(처음 한 번 `cp` 로 썼지만 저장소와 내용이 같아 영향 없음을 `diff -q` 로 확인).

## 알려진 한계

- **훅·컴포넌트가 실제로 실행되는 시험은 없다**(DOM 환경 없음, task-069 와 같은 한계). 상태 전이는 순수 함수 시험이, 배선은 소스 스캔이 지킨다. 실제로 안내가 칸 아래에 뜨고 고치면 사라지는지는 사용자 폰 확인 몫이다.
- 360px 에서 줄 수·가로 넘침은 **측정하지 못했다**(브라우저 미사용). 안내는 28자 `break-keep` 한 줄~두 줄, 표현 힌트는 44자로 두 줄 예상 — 기존 힌트와 같은 클래스(`text-[12px] text-ink2 break-keep`)라 넘침 위험은 낮지만 폰에서 봐야 한다.
- `role="status"` 로 **새로 끼워 넣는** 요소는 화면 읽기 프로그램에 따라 읽히지 않을 수 있다(상시 존재하는 영역의 글자가 바뀌는 방식이 가장 확실). 이미 같은 순간 `알아들은 말: …` 영역이 읽히므로 치명적이진 않다. 더 확실히 하려면 상시 영역에 안내 문장을 합치는 방법이 있다(시각 안내는 `aria-hidden`).
- 거두는 시점 중 ④ 시트 닫힘은 언마운트에 의존해 단위 시험으로 못 본다. `focusField`(오류로 포커스가 감)·`save`·`enrich` 가 안내를 지우는 것은 의도이나 사양 문구(고침·다시 말하기·닫힘)에는 없는 확장이다.
- 인식기가 한국어·영어식 발음을 잘못 받아 적는 문제 자체는 이 task 범위 밖이다(인식은 안 바꾸고 안내만).

## reviewer 가 볼 곳

1. `wordMic.ts` `micNoticeStep` — 같은 객체 반환(불필요한 상태 갱신 없음), `leave` 의 `only` 분기. `micNoticeAfterFinal` 이 `apply` 에서만 켜는지.
2. `useWordMic.ts` — `onFinal` 에서 `micNoticeAfterFinal` 이 빈 결과·무시 return **뒤**에 있는지, `toggle` 의 `speak` 가 칸을 **여는** 경우(`step.target !== null`)에만 가는지, `close` 가 `retarget` 의 early return 과 무관하게 `leave` 를 보내는지.
3. `WordForm.tsx`/`WordAddSheet.tsx` — `edited` 호출이 **사용자 입력 세 곳**뿐이고 `onResult` 에는 없는 것. 읽기·뜻·분류·예문 뜻·메모의 `onChange` 는 그대로, `mic` 없는 수정 시트는 `mic?.edited` 가 no-op.
4. `WordMicField.tsx` — 안내가 글자 모드 분기 안에만 있는지(말로 쓰는 중 중복 없음).
5. 재실행: 위 증빙 명령 + 변이는 `dev073-mutate.py`(임시, 필요하면 요청).
6. 사용자 폰 확인(light, QA 없음): ① 「말로 쓰기」를 열면 표현 칸 안내가 「일본어 발음으로 말해 주세요 (예: インパクト)…」 ② 말하고 나면 칸 아래에 「잘못 알아들었을 수 있어요…」 ③ 그 칸을 한 글자 고치면 사라짐 ④ 다시 「말로 쓰기」를 열면 사라짐 ⑤ 예문 칸도 같음(예시 없음) ⑥ 빈 결과(아무 말 안 함)에는 안 뜸 ⑦ 360/390px 줄바꿈·가로 넘침 없음 ⑧ [뜻 채우기]·[저장] 뒤에는 안 남음.

## 승인 후 보완 라운드(DP1·DP2·Low①)

2026-10-17. 사용자 데모 v1 「승인」(★ 전부 + designer 제안 DP1·DP2 포함, Leader 해석) 뒤의 작은 수정 3건. W-2/W-3 의 이미 구현된 부분(문구·전이·훅 동작·`WordForm`·`WordAddSheet`·`src/modules/**`)은 건드리지 않았다. 데모 게이트: `check.mjs check` → `DEMO_GATE_PASSED` · `status: approved` · `approved_version: v1` · `hash: verified`(편집 뒤에 실행 — 승인은 이미 기록돼 있었다).

### 변경 파일 (코드 2 + 시험 1 = 3개, 한도 5개 안)

| 파일 | 내용 |
|---|---|
| `src/components/vocab/labels.ts` | `WORD_MIC_COPY.hint.surface` 를 한 문자열에서 `[앞, 'インパクト', 뒤]` 세 조각으로 — 이어 붙이면 보이는 문구는 그대로(「일본어 발음으로 말해 주세요 (예: インパクト). 칸에 들어간 뒤 고칠 수 있어요.」). `hint.example` 은 예시가 없어 문자열 그대로 |
| `src/components/vocab/WordMicField.tsx` | ① 힌트 `<p>`: 문자열이면 그대로, 조각이면 가운데만 `<span lang="ja">` (DP1) ② 글자 모드의 눈에 보이는 확인 안내 `<p role="status" …>` → `<p aria-hidden="true" …>` — 자기 `role` 제거, 위치·클래스·문구·표시 조건(`mic.notice[target]`) 그대로 (DP2) ③ 늘 마운트된 `sr-only role="status"` 줄의 글: 확인 안내가 켜진 채 들어온 결과면 「알아들은 말: インペクト. 잘못 알아들었을 수 있어요. 확인하고 고쳐 주세요.」, 아니면 평소의 「알아들은 말: …」 (DP2·REV073-2) |
| `src/components/vocab/__tests__/wordMicField.test.ts` | 기존 단정 3곳 갱신(힌트 span·안내 마크업·칸 스캔) + 새 시험 5개(읽기용 줄 4·힌트 스캔 1) + Low① 단정을 기존 훅 스캔 시험에 보강 |

네이티브·API·DB·환경변수·의존성 변경 없음. 엔진명 grep(`reazon|whisper|style-bert|claude|sherpa`) 변경 파일 0건(기존 시험이 같은 grep 을 돈다).

### 결정 (사양과 달라진 점 1건 포함)

1. **읽기용 줄의 「합칠지」는 결과가 들어온 순간에 한 번 정해 얼린다 — 사양 문구(안내 상태를 따라 글이 바뀜)와 다른 점.** 단순히 `mic.notice[target] ? 합친 글 : 평소 글` 로 하면, 사용자가 칸을 한 글자 고치거나(E3) 다시 말하려고 칸을 열 때 안내가 거두어지며 줄의 글이 「알아들은 말: インペクト」로 **되돌아가 같은 말이 화면 읽기기에 다시 읽힌다**(`announce` 는 새 결과 전까지 남아 있어 글이 바뀌는 것 자체가 낭독 사건). 그래서 `WordMicField` 안에 `srCheck = {n, on}` 상태를 두고 **새 결과(`announce.n`)를 처음 볼 때 한 번만** `mic.notice[target]` 을 베껴 두며(렌더 중 조건부 `setState` — React 문서 패턴, 마운트 때도 같은 값으로 시작), 줄의 글은 얼린 `srCheck.on` 만 본다. 실제 흐름에서는 결과가 안내와 같은 렌더에 들어오므로 `on` 은 늘 true 이고, 안내가 켜지지 않은 평소 낭독은 (a) 단계가 넘어가 칸이 다시 그려질 때 안내는 이미 거두어진 채 마운트되는 경우, (b) 안내 없이 `announce` 만 주어진 시험에서만 나온다. 보이는 안내가 사라지는 시점(E3)은 `mic.notice` 를 따르므로 그대로이고, 줄의 글은 그때 바뀌지 않는다(낭독 없음).
2. **보이는 안내의 `role="status"` 제거 → `aria-hidden="true"`**: `<p role="status" class="text-[12px] text-ink2 break-keep">` → `<p aria-hidden="true" class="text-[12px] text-ink2 break-keep">`. 보이는 모습·위치(입력 칸 바로 아래)·클래스·표시 조건(글자 모드 + `mic.notice[target]`)은 그대로.
3. **DP1 은 labels 를 나누는 쪽**을 택했다(`WordMicField` 에서 예시를 끼우는 쪽 대신). 문구 정본이 `labels.ts` 한 곳에 남고, 시험이 `surface.join('')` 로 보이는 문구를, `surface[1]` 로 예시 조각을 지킨다. 낭독·글꼴이 필요한 일본어 조각은 이 한 곳(예시)뿐이다.

### 증빙 (미러 `~/.node-local/thekaiwa-dev073b` — `thekaiwa-rev073` 을 `cp -al`, `UserWordState` 724건 확인, 저장소 `src`·`tests`·`package.json` rsync)

| 명령 | 결과 |
|---|---|
| `./node_modules/.bin/tsc --noEmit` | 종료 코드 0 |
| `./node_modules/.bin/eslint src/components/vocab` | 종료 코드 0, 출력 없음 |
| 마이크 시험 2개(`wordMic.test.ts`·`wordMicField.test.ts`) | tests 55 · pass 55 · fail 0 (이전 50 → +5) |
| vocab 전체 | tests 287 · pass 287 · fail 0 (이전 282 → +5) |
| 전체(`find src scripts/seed-build -name '*.test.ts'`, `--test-concurrency=1`) | tests **4,157** · pass **4,155** · fail **0** · skipped 2 (기준 4,152 → +5) |
| `DATABASE_URL=<가짜> ./node_modules/.bin/next build > /tmp/claude-1000/dev073b-build.log 2>&1` | 종료 코드 0 |

참고: 전체 시험·빌드를 돌리는 동안 저장소의 `src/modules/conversation/{prompts,structuredResponse}/phraseHelp.ts` 가 다른 작업(task-072, 이 작업 소관 아님)으로 바뀌었다 — 미러에는 그 변경이 들어오기 전 내용이 있다. 내 변경은 `src/components/vocab/**` 3개뿐이고 두 영역은 import 로 이어지지 않는다.

### 변이 점검 15개 (별도 미러 `thekaiwa-dev073bm` — 임시 파일 후 `os.replace` 로 하드링크 오염 방지, 한 번에 하나만 깨고 마이크 시험 2개 실행 → 즉시 원복, 끝난 뒤 `diff -rq src` 일치) — 전부 시험이 실패로 잡음, 생존 0

| # | 깬 곳 | 결과 | 잡은 시험 |
|---|---|---|---|
| L1 | **훅 빈 결과 분기에 안내 켜기 (REV073-1 생존 변이)** | 잡힘(1) | 훅 스캔 — 빈 결과 분기가 `{setHint(…)return}` 그대로여야 함 |
| L2 | 훅 무시(`ignore`) 결과 분기에 안내 켜기 | 잡힘(2) | 훅 스캔 — `ignore` 첫 줄 `return`·`setNotice(` 는 한 곳뿐 |
| D1 | 안내 직후 읽기용 줄 글이 안 바뀜(확인 안내 합치기 제거) | 잡힘(3) | 읽기용 줄 시험 3개 |
| D2 | 보이는 안내가 자기 `role="status"` 를 다시 가짐(`aria-hidden` 은 유지) | 잡힘(3) | 안내 마크업 · 읽기용 줄 · 칸 스캔 |
| D3 | 보이는 안내의 `aria-hidden` 누락(이중 낭독) | 잡힘(3) | 안내 마크업 · 읽기용 줄 · 칸 스캔 |
| D4 | 읽기용 줄이 지금의 `mic.notice` 를 직접 봄(얼림 해제 → 거둘 때 되돌아가 재낭독) | 잡힘(1) | 얼림 배선 스캔 |
| D5 | 얼린 값이 새 결과마다 갱신되지 않음(렌더 중 갱신 줄 제거) | 잡힘(1) | 얼림 배선 스캔 |
| D6 | 얼린 값이 항상 true(안내 없이도 합침) | 잡힘(1) | 얼림 배선 스캔 |
| D7 | 예시 `<span>` 의 `lang="ja"` 누락 (DP1) | 잡힘(2) | 열린 칸 시험 · 힌트 스캔 |
| D8 | 예시를 `<span>` 으로 안 감쌈, 평문 (DP1) | 잡힘(2) | 열린 칸 시험 · 힌트 스캔 |
| D9 | 읽기용 줄이 다른 칸의 결과도 읽음(`announce` 의 `target` 거름 제거) | 잡힘(2) | 「그 칸만」 · 읽기용 줄 시험 |
| E1 | E3 깨짐 — 고쳐도 안내가 안 거두어짐(순수 `edited` 무동작) | 잡힘(2) | 고침 · 한 번 말하고 고치고 다시 말하는 흐름 |
| E2 | E3 깨짐 — 단계가 넘어가도(`close`) 안내가 안 거두어짐(훅) | 잡힘(1) | 훅 스캔 |
| E3 | E3 깨짐 — 다시 말하려고 열어도 안 거두어짐(훅 `speak` 제거) | 잡힘(1) | 훅 스캔 |
| H1 | 보이는 힌트 문구가 한 글자 바뀜 | 잡힘(2) | 열린 칸 시험 · 힌트 스캔 |

Low①(L1)은 이번 라운드 전에는 살아남던 변이다. 원인은 기존 스캔이 「`setNotice(micNoticeAfterFinal…)` 가 `empty` 표지보다 뒤에 있다」만 봐서, `empty` 분기 안에 `setNotice` 를 끼워도 같은 순서가 유지돼 통과한 것. 이제 빈 결과 분기 구간을 통째로 `if(action.kind==='empty'){setHint(STT_HINT_COPY.EMPTY_RESULT)return}` 와 비교하고, `onFinal` 안 `setNotice(` 가 정확히 한 번이며 `refs.current=next`·`setAnnounce(` 뒤에 있음을 단정한다(줄 번호 의존 없음 — `squash` 로 공백·주석을 지운 뒤 표지로 구간을 자르는 task-069 방식).

### 남은 한계

- **훅·컴포넌트가 실제로 다시 그려지는 시험은 없다**(DOM 환경 없음). 얼림(D4~D6)의 「새 결과에서만 갱신」 동작은 정적 마크업 한 번 렌더(마운트 값)와 소스 스캔으로만 고정된다 — 실제로 안내가 거두어질 때 줄의 글이 그대로인지, 두 번째 결과에서 다시 합쳐 읽히는지는 TalkBack 실기기 확인 몫이다(폰 확인 항목 ⑨).
- 보이는 안내가 `aria-hidden` 이라 **가장 최근에 결과가 들어온 칸의 읽기용 줄에만** 확인 안내가 글로 남는다. 표현→예문 순서로 둘 다 말하면 표현 칸의 안내는 보이지만(눈) 읽기용 줄은 예문 것으로 바뀌어, 표현 칸으로 되돌아간 화면 읽기 사용자는 표현 쪽 경고를 듣지 못한다(그 순간에는 한 번 읽혔다). 이전에는 `role="status"` 문단이 DOM 에 남아 탐색 모드로 읽을 수 있었다. 설계 제안 DP2 가 받아들인 대가이며, 막으려면 칸마다 읽기용 줄을 따로 두어야 한다.
- 합친 읽기용 줄의 글은 안내가 거두어진 뒤에도 DOM 에 남는다(낭독은 안 됨, 탐색 모드로 읽으면 「잘못 알아들었을 수 있어요」가 같이 읽힘). 얼림을 택한 대가로 알려진 한계.
- 결과 문장이 `。` 로 끝나면 읽기용 줄은 「…あった。. 잘못 …」 처럼 구두점이 겹친다(낭독에는 영향 없음, 사양의 `. ` 구분자 그대로).
- 사용자 폰 확인 추가: ⑨ TalkBack 으로 말한 뒤 「알아들은 말: …. 잘못 알아들었을 수 있어요. …」가 **한 번** 읽히고, 그 칸을 고쳐도 같은 말이 다시 읽히지 않음 / ⑩ 표현 힌트의 「インパクト」가 일본어로 읽힘.
