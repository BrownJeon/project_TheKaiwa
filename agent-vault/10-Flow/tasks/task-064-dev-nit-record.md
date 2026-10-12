---
tags:
  - type/task-record
  - domain/ask
aliases:
  - task-064 dev-nit
---
# task-064 감사 Low 3건(dev-nit) — Developer 기록

> 상위: [[task-064-ask-anything-3a]]. 근거: 레인 감사 REV-lane L-1·L-2, 스크롤 감사 REV-SCROLL-4. 전용 미러 `~/.node-local/thekaiwa-dev064s`(`.env` 없음 — 착수 때 `diff -rq src tests` 로 작업 트리와 동일함을 확인, 이후 `rsync -a --delete src/ tests/` 로만 맞춤). 변이 시험은 미러의 파일 **사본**에만 적용하고 끝날 때마다 원복·`diff -rq` 확인(NFS 원본은 건드리지 않음).

## 수정한 파일 목록 (미커밋 · `git add` 없음)

| 구분 | 파일 | 변경 |
|---|---|---|
| 소스(문자열만) | `src/modules/engine/adapters/llm/claudeCli.provider.ts` | `runtime.concurrency` 의 `description` 한 줄(줄 54). 기본값 1·min 1/max 4·editability `RESTART_REQUIRED`·`envAlias`·`sourceCodeLayer` 값 1(`#pump`) **그대로** |
| 예시 파일 | `.env.example` | `CLAUDE_CLI_CONCURRENCY=1` 줄(24행) 뒤 인라인 주석 추가. 값 1 그대로 |
| 시험 | `src/modules/engine/__tests__/claudeCliAskLane.test.ts` | (f) 의 `askLimits.ts` 엔진 이름 검사 예외 1줄 제거 |
| 소스 1곳 | `src/components/chat/MessageList.tsx` | 만짐 이벤트 배열에 `'click'` 추가(줄 ~354) + 이유 주석 1줄(줄 347) |
| 시험 | `src/components/chat/__tests__/arrivalAlignWiring.test.ts` | ④ 기존 시험의 이벤트 배열 단언을 5종(click 포함)으로 맞춤 + 새 시험 1건(REV-SCROLL-4) |
| 기록 | `agent-vault/10-Flow/tasks/task-064-dev-nit-record.md` | 이 파일 |

건드리지 않음: `docs/**`, `askLimits.ts`(Leader 가 이미 정리), prisma, prompts, 설정 키 정의의 값·제약.

## Developer 기록

- [착수] 읽음: `claudeCli.provider.ts`·`claudeCli.ts` 큐 구현(공용 슬롯 1 + ASK 슬롯 1, `pump`)·`.env.example`·`MessageList.tsx` 만짐 효과·`arrivalAlignWiring.test.ts`·`claudeCliAskLane.test.ts`(f)·`sourceCode.ts`(readCode 는 **주석을 걷은** 소스). 기준선(대상 시험 2개 파일) 23건 통과.
- [체크포인트 1] 3건 구현·시험 수정 완료, 변이 확인까지 끝. 남은 일: 전체 게이트(tsc·eslint·4개 디렉터리 단위 시험) → 기록 마감.
- [체크포인트 2] 게이트 전부 통과, 기록 마감. 남은 일 없음(아래 「남은 위험」은 Leader 판단용).

## 1) REV-lane L-1 — 「동시 실행 수 1」 표시를 사실에 맞춤

- **무엇이 사실인가** [확실]: `claudeCli.ts` 줄 685~707 — `SHARED_SLOT_CONCURRENCY = 1`(interactive·batch 공용) + `ASK_SLOT_CONCURRENCY = 1`(ASK 전용), 둘 다 **코드 상수**이고 `runtime.concurrency`/`CLAUDE_CLI_CONCURRENCY` 는 큐에 연결돼 있지 않다(줄 682~683 주석이 이미 그렇게 적음). 즉 실행 중 CLI 프로세스는 최대 2개(예열 대기 프로세스 별도). 옛 설명 「동시 실행 수(구독 rate limit 을 6개 프로젝트가 공유)」는 이 키를 바꾸면 동시성이 바뀌는 것처럼 읽혔다.
- **설명 문자열** (`claudeCli.provider.ts`): `공용 큐 동시 실행 수(현재 코드 고정 1 — 이 키는 큐에 연결돼 있지 않다). 질문(ASK) 전용 슬롯 1개가 별도로 있어 AI 프로세스는 최대 2개 동시에 돈다` — 두 문장. 옛 문구의 「구독 rate limit 을 6개 프로젝트가 공유」는 지시가 정한 문장 수(한두 문장)에 맞춰 뺐다(근거는 `claudeCli.ts` 줄 672~684 코드 주석에 그대로 있음).
- **`.env.example` 24행**: `CLAUDE_CLI_CONCURRENCY=1                    # 공용 큐 동시 실행 수 — 현재 코드 고정 1, 이 값은 큐에 연결돼 있지 않다(바꿔도 효과 없음). 질문(ASK) 전용 슬롯 1개가 별도라 AI 프로세스는 최대 2개 동시에 돈다`. 값은 그대로 1.
- **시험**: 이 설명 문자열·`.env.example` 을 단언하는 시험·스냅샷은 **없다**(`grep` — `src`·`tests`·`scripts` 에서 `동시 실행 수`·`.env.example` 참조 0건, `runtime.concurrency` 를 보는 곳은 `tests/live/task012c-smoke.ts` 의 키 존재·`lock === 'RESTART_REQUIRED'` 단언뿐 — 설명을 보지 않음). 그래서 고친 시험 없음, 단언 약화 없음.
- **영향** [확실]: 설명은 관리자 콘솔 설정 화면의 키 설명(`admin/engines` 의 `schemaDto` → `configuration/keys.ts` 줄 129 `description: k.description`)으로 표시되는 문자열이다. `configuration/diff.ts` 의 `candidateHash`·`summaryHash` 는 scope·targetId·environment·후보 저장값·변경 행(key·저장 전·후)만 입력으로 삼아 `description` 은 해시 입력이 아니므로, 기존 `ConfigurationVersion`·승인 해시에 영향이 없다.

## 2) REV-lane L-2 — 시험의 불필요한 예외 제거

- `claudeCliAskLane.test.ts` (f) 에서 `if (!/askLimits\.ts$/.test(f)) assert.equal(…엔진·모델 이름…)` → 조건 없이 `assert.equal(/claude|anthropic|sonnet|haiku|opus/i.test(src), false, …)` 로. 같은 줄 위의 설명 주석(「옛 주석은 이 task 이전부터…」)도 함께 삭제(예외가 없어졌으니 거짓 주석이 됨).
- `askLimits.ts` 에는 현재 `claude|anthropic|sonnet|haiku|opus`·`priority`·`lane` 이 한 번도 안 나온다 → 예외 없이 통과(대상 시험 24건 중 24 통과).
- **변이(미러 사본에서 `askLimits.ts` 맨 앞에 주석 한 줄 삽입 → 시험 → 원복)**:

| 변이 | 새 시험 | 비고 |
|---|---|---|
| F1 `// CLAUDE_CLI_CONCURRENCY 로 조절` | **실패**(9번 (f)) | 이번 L-2 가 막으려는 회귀 |
| F2 `// sonnet 으로 답한다` | 실패 | 모델 이름 |
| F3 `// lane 선택` | 실패 | 기존 priority/lane 검사 |
| 대조: **옛 예외가 있는 시험** + F1 | **통과(9건 중 9)** — 회귀를 못 잡음 | 예외 제거가 실제로 구멍을 막는다는 증거 |

## 3) REV-SCROLL-4 — 「만짐」 판정에 `click` 추가

- `MessageList.tsx` 만짐 효과(`alignAnswerStart` 일 때만 등록): `['pointerdown', 'touchstart', 'wheel', 'keydown']` → `[…, 'keydown', 'click']`. 등록(`addEventListener(name, touched, { passive: true })`)·해제(`removeEventListener(name, touched)`)는 **같은 `events` 배열을 도는 반복문 하나씩**이라 click 도 자동으로 짝이 맞는다. 효과 맨 앞의 `if (!alignAnswerStart || !el) return` 가드·의존성 `[alignAnswerStart]` 그대로 → 기본 `'bottom'` 방(회화·채팅·역할극)은 리스너를 하나도 등록하지 않는 현재 보장 유지.
- **왜 click 인가** [가능성 높음]: 일반 탭·마우스는 `pointerdown`/`touchstart` 가 먼저 와서 이미 `touched` 가 선다. TalkBack 의 「두 번 탭해서 활성화」는 포인터 이벤트 없이 `click` 만 낼 수 있다 → 도착 직후 2초 창 안에 [n개 더 보기] 등을 열면 `windowGrowthAction` 이 `touched === false` 로 보고 `realign` 해 사용자를 끌어올린다. (실기기 TalkBack 으로는 확인하지 못했다 — 코드·이벤트 모델 추론이다.)
- **시험** `arrivalAlignWiring.test.ts`:
  - ④ 기존 시험: 이벤트 배열 literal 단언을 5종(`…'keydown', 'click'`)으로 갱신, 제목 「4종」→「5종」. 단언을 약화하지 않고 대상만 늘렸다.
  - **새 시험 1건**(④ REV-SCROLL-4): 만짐 효과 구간만 잘라(`events` 선언을 품은 `useEffect` ~ `showPill` 직전; `LIST` 는 주석 제거본이라 주석 속 `click` 은 세지 않음) ① `events` 에 `click` 포함 + 정확히 5종 ② `addEventListener(`·`removeEventListener(` 호출이 각 1번(따로 붙인 리스너가 해제 없이 남지 않게)이고 반복문 모양 그대로 ③ `if (!alignAnswerStart || !el) return` 가 `addEventListener` 보다 앞 ④ 의존성 `[alignAnswerStart]`.
- **변이 결과**(미러 사본, 시험 파일 15건 기준 · 기준 15/15):

| 변이 | 결과 | 잡은 시험 |
|---|---|---|
| M1 `'click'` 제거 | 실패 2 | ④ 기존 + ④ 새 |
| M2 해제 반복문 제거 | 실패 2 | ④ 기존 + 새 |
| M3 `'click'` 을 주석으로만 | 실패 2 | ④ 기존 + 새 (주석 제거본이라 안 센다) |
| M4 가드에서 `!alignAnswerStart` 제거(bottom 방에서도 등록) | 실패 1 | **새 시험만**(기존 시험은 못 잡던 구멍) |
| M5 `el.addEventListener("click", touched)` 를 해제 없이 따로 추가 | 실패 1 | **새 시험만** — 첫 보강 전 시험은 이 변이에 생존했다 → 호출 개수 단언으로 보강 |
| M6 해제에서 click 만 제외 | 실패 2 | ④ 기존 + 새 |
| M7 click 을 `touched` 가 아닌 빈 핸들러에 연결 | 실패 2 | ④ 기존 + 새 |

## 게이트 (전용 미러 `~/.node-local/thekaiwa-dev064s`, NFS 원본 `rsync` 직후 `diff -rq src tests` 동일 확인 · `.orig` 잔재 0)

- `node node_modules/typescript/bin/tsc --noEmit --incremental false` → **exit 0**
- `node node_modules/eslint/bin/eslint.js <변경 4개 파일>` → **exit 0**(4개 파일 · 오류 0 · 경고 0 — `-f json` 으로 실제 대상 파일 수 확인)
- 단위 시험 `DATABASE_URL=가짜 node --import tsx --test --test-concurrency=1 $(find <디렉터리> -name '*.test.ts')`:

| 디렉터리 | 파일 | 건수 | 통과 | 실패 | 건너뜀 |
|---|---|---|---|---|---|
| `src/modules/engine` | 17 | 189 | 189 | 0 | 0 |
| `src/components/chat` | 12 | 130 | 130 | 0 | 0 |
| `src/components/ask` | 7 | 98 | 98 | 0 | 0 |
| `src/modules/conversation` | 56 | 1,141 | 1,141 | 0 | 0 |

- 기준선 → 변경: 대상 2개 파일(`claudeCliAskLane` 9건 + `arrivalAlignWiring` 14건 = 23건) → 24건(새 시험 +1). 이 4개 디렉터리에 `*.test.tsx`·`*.spec.ts` 는 없음.
- 실제 `claude` 실행 0회 · `npm run build`/`dev` 0회 · 3010·3002·3011·3012·3070대 포트 사용 0 · `~/.node-local/thekaiwa-rev064` 접근 0 · `git add/commit/stash/checkout/restore` 0회.

## 남은 위험

- **L-1**: 설명 문자열만 바꿨으므로 키 값·동작은 그대로다. 단 `runtime.concurrency` 가 큐와 연결돼 있지 않다는 **사실 자체**(관리자가 값을 바꿔도 효과 없음)는 이번에 고치지 않았다 — 키 삭제·연결은 설정 키 의미·버전 이력에 영향이 있어 범위 밖(Leader 결정 사항). 설명이 미래에 큐 상수를 바꾸면 틀려질 수 있고, 이를 지키는 시험은 없다(요청 범위 밖이라 추가하지 않음).
- **SCROLL-4**: 소스 문자열 단언이라 실제 TalkBack 의 이벤트 순서(`click` 만 오는지)는 브라우저·실기기에서 확인하지 못했다 [추측 → 코드 모델 기준]. `click` 은 `pointerdown` 뒤에도 오므로 일반 탭 경로의 동작은 바뀌지 않는다(이미 `touched` 가 선 상태에 같은 값을 다시 쓸 뿐).
- **SCROLL-4 부수**: 목록 안에서 일어난 모든 `click`(예: 프로그램이 낸 `.click()`)이 2초 창을 끝낸다 — 창은 도착 직후 2초뿐이고 `scrollToBottom`/`alignAndWatch` 가 창을 새로 만들기 때문에 의도치 않은 영향은 없다고 본다 [가능성 높음].
