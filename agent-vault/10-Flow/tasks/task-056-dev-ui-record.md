---
task_id: task-056
role: developer
tags:
  - type/dev-record
  - domain/conversation
  - domain/improvement
aliases:
  - task-056 developer(화면) 기록
created: 2026-10-11
updated: 2026-10-11
---

# task-056 — Developer(화면) 기록 (회화방 일본어 도우미 UI)

> 본 이력서 [[task-056-improve-talk-phrase-helper]] · 확정 가이드 [[task-056-designer-record]] + `docs/screens.md` §22(정본) · 계약 [[task-056-pe-record]] §2·§4 · 서버는 [[task-056-dev-server-record]](다른 developer). 이 파일은 화면 developer 만 쓴다.

## Developer 기록
- [착수] 읽음: 이력서(사용자 결정 ①~⑦·Leader 결정 7항)·designer 기록 §0~§7·screens §22-0~22-15·pe-record §2·§4·api-contract #180 행. 화면 매핑 결정: 409 `PHRASE_BUSY` → `hp-error`(pe-record §4), `TURN_RUNNING` 은 계약에 없음(★busy 는 매핑만 두고 도달 안 함), 400 → 안내 줄에 서버 message.
- 파일 경계(화면): 새 `src/components/talk/{PhraseHelperButton,PhraseHelperTip,PhraseHelperPanel,PhraseHelperCard}.tsx`·`usePhraseHelper.ts`·`helperCopy.ts`·`phraseHelperLogic.ts`·`__tests__/phraseHelper*.test.ts`·`src/types/phraseHelp.ts` / 수정 `talk/TalkRoom.tsx`·`talk/VoiceBar.tsx`·`scenario/scenarioCopy.ts`(⑦A 한 줄). 서버·`src/types/chat.ts`·문서·타 task 파일 미접촉.
- 전용 미러: `~/.node-local/thekaiwa-dev056u`.
- [체크포인트 1] 완료: `src/types/phraseHelp.ts`(응답 타입 복제) · `talk/helperCopy.ts` · `talk/phraseHelperLogic.ts`(claimHelperTip·잠김·막힘 이유·안내 줄·응답 읽기·실패 매핑·settle·낭독 문장) · `talk/usePhraseHelper.ts` · `talk/PhraseHelper{Button,Tip,Card,Panel}.tsx` · `talk/VoiceBar.tsx`(`trailing` — 없으면 기존 `flex justify-center` DOM 그대로, 있으면 grid) · `scenario/scenarioCopy.ts` ⑦A.
  - 남은 일: TalkRoom 배치(자리·배타·typing·띠·onAccepted·소리·안내 상자) → 시험(순수·렌더) → 미러 lint/tsc/test.
  - 주의: `tests/live/task010d-b2-screens.ts`·`tests/live/p2c-qa/{b2x,b2-extra}-screens.ts` 가 옛 부제 「무엇을 말할지 막히면 눌러요」를 글자로 기대한다(qa 영역 — 수정하지 않음, Leader 보고 대상).
- [체크포인트 2] TalkRoom 배치 완료(도우미 훅·버튼·판·안내·배타·typing·onAccepted 닫기·onPress 소리 정지). 전용 미러 tsc: 내 파일 0건(전체 42건은 미러 Prisma 클라이언트가 낡아 생기는 서버 파일 오류 — `endedAt`·`userSeedOverride`, 무관). eslint(talk·scenarioCopy·types) 0.
  - 함정: React 컴파일러 `react-hooks/purity` 가 `tipVisible({ helperOpen: helper.open, practiceOpen: rp.practiceOpen, … })` 처럼 **훅 반환 값을 import 함수에 넘기는 렌더 중 호출**이 생기면 기존 `onFinal` 의 `Date.now()`(TalkRoom 488행)를 렌더 중 호출로 오탐해 error 를 낸다(이분 탐색으로 확인). → 식을 TalkRoom 안에 인라인하고 `tipVisible` 은 지웠다. `set-state-in-effect` 는 조건을 ref 값에서 읽게 바꿔 경고 0.
  - 다음 첫 행동: 시험 작성(`__tests__/phraseHelperLogic.test.ts`·`phraseHelperRender.test.ts`) → 미러 실행.
- [체크포인트 3 — 2번째 소환(신규), 마무리·검증] 앞 소환 결과물 확인: 시험 2파일은 끝까지 쓰여 있었다(렌더 시험 317행 완결, 미완 구간 없음). 전용 미러 `.prisma` 는 25개 미러가 공유하는 하드링크였다 → 내 미러에서만 `mv node_modules/.prisma node_modules/.prisma-old-hardlinked` 후 `thekaiwa-predeploy` 에서 실복사(생성 스키마와 `prisma/schema.prisma` 는 공백만 다름 — `diff -w` 0). 기본 미러·predeploy 무변경. 그 뒤 tsc **0건**(미러 전체) · eslint(talk·scenario·types) **0** · talk+scenario 시험 **228/228**.
  - 다음 첫 행동: 라이브 시험 3파일 옛 부제 문자열 교체 → 시험 보강(엔진명 DOM 스캔·녹음 중 판 유지·초점) → HEAD VoiceBar 바이트 대조 → `next build`.
- [체크포인트 4] 라이브 시험 3파일 옛 부제 → 새 부제 교체(파일마다 4곳, 전부 `expect` 배열 안 같은 문자열 — 그 밖 줄 무변경, 실행 안 함). 저장소 전체 `src`·`tests` 에 옛 문구 0(남은 곳은 데모 HTML·문서·vault 기록 — 고치지 않음). 렌더 시험 2개 추가(모든 상태 DOM 엔진명 0 · 녹음 중 판 유지/초점/입력 중 판정/ENDED 소스 잠금) → phraseHelper 시험 **35/35**. HEAD `VoiceBar` 와 `trailing` 없는 새 `VoiceBar` 정적 렌더 6변형(IDLE·SPEAKING+■·RECORDING × 미터 null/-30, `trailing` undefined·null) **바이트 동일**(일회 대조, 미러 임시 파일 → 스크래치로 이동). 변이 5건(빈 trailing 격자화·판에 녹음 조건·안내 쓰기 믿기·뜻 줄 삭제·sr 줄 조건 마운트) 모두 시험 실패로 잡힘 → 원복 35/35. `next build` 진행 중.
- [최종] **DONE** — 화면 구현·시험·빌드 확인 완료. 다음 첫 행동: 없음(reviewer 인계). 아래 「인계」 참조.

## 인계 (reviewer·Leader 용)

### 데모 게이트
`node ../.claude/tools/demo-gate/check.mjs check --task agent-vault/10-Flow/tasks/task-056-improve-talk-phrase-helper.md` → `DEMO_GATE_PASSED` / `task: task-056` (approved v1, `docs/demo/task-056-talk-phrase-helper-v1.html` 무변경).

### 변경·신규 파일 (전부 미커밋 — 커밋은 Leader 가 pathspec 로)
| 파일 | 내용 |
|---|---|
| `src/types/phraseHelp.ts` (신규) | #180 요청·응답 화면용 타입 복제(Leader 결정 3) |
| `src/components/talk/helperCopy.ts` (신규) | §22-7 문구 단일 출처 + `HELPER_MAX=100`·`HELPER_COUNT_FROM=90` |
| `src/components/talk/phraseHelperLogic.ts` (신규) | `claimHelperTip`(쓰고 다시 읽기)·`helperLocked`·`askBlockOf`·`helperMsgOf`·`readPhraseHelp`·`altSummary`·`helperFailureOf`·`settleHelper`·`helperAnnounceOf` |
| `src/components/talk/usePhraseHelper.ts` (신규) | 메모리 전용 상태·요청 1건·12s 끊기/5s slow·닫아도 결과 기억·녹음 중 낭독 미룸·소리 키 `helper:{i}` |
| `src/components/talk/PhraseHelper{Button,Tip,Panel,Card}.tsx` (신규 4) | §22-3·22-4·22-5 |
| `src/components/talk/TalkRoom.tsx` | 도우미 훅·버튼(말/글자 모드)·판·안내 상자·배타·`helper.typing` 초점 기반 바 숨김·`onAccepted` 닫기·`onPress` 소리 정지·ENDED → `rp.reload()` |
| `src/components/talk/VoiceBar.tsx` | 선택 prop `trailing` — 없으면 기존 DOM 그대로(HEAD 와 바이트 동일 확인) |
| `src/components/scenario/scenarioCopy.ts` | ⑦A `PRACTICE.entrySub` 한 줄 |
| `src/components/talk/__tests__/phraseHelperLogic.test.ts` (신규, 17) · `phraseHelperRender.test.ts` (신규, 18) | 아래 「시험이 잠근 것」 |
| `tests/live/task010d-b2-screens.ts` · `tests/live/p2c-qa/b2x-screens.ts` · `tests/live/p2c-qa/b2-extra-screens.ts` | 옛 부제 기대 문자열만 새 부제로(파일마다 4곳, `expect` 배열 안). **실행 안 함**(QA 영역) |

손대지 않음: 서버(`src/app/api/**`·`src/modules/**`)·`src/types/chat.ts`(task-055)·shell/vocab/drawer·문서·데모·ACTIVE/board/roadmap/20-Log·기본 미러·`thekaiwa-predeploy`.

### 실행 증빙 (전용 미러 `~/.node-local/thekaiwa-dev056u`, `KAIWA_LOCAL_ROOT=… bash scripts/sync-local.sh` 후)
- 미러 준비: `.prisma` 가 25개 미러 공유 하드링크였음 → 내 미러에서만 `mv node_modules/.prisma node_modules/.prisma-old-hardlinked` + `cp -r ../thekaiwa-predeploy/node_modules/.prisma node_modules/`(생성 스키마 vs `prisma/schema.prisma` `diff -w` 0). 기본 미러·predeploy 무변경(기본 미러 링크 수 27 그대로).
- `./node_modules/.bin/tsc --noEmit -p .` → **0건**(미러 전체).
- `./node_modules/.bin/eslint src/components/talk src/components/scenario src/types tests/live/task010d-b2-screens.ts tests/live/p2c-qa/b2x-screens.ts tests/live/p2c-qa/b2-extra-screens.ts` → **0**.
- `node --import tsx --test --test-concurrency=1 src/components/talk/__tests__/phraseHelper*.test.ts` → **35/35**.
- `node --import tsx --test --test-concurrency=1 src/components/talk/__tests__/*.test.ts src/components/scenario/__tests__/*.test.ts` → **230/230**.
- `node --import tsx --test --test-concurrency=4 $(find src/components -name '*.test.ts' | sort)` → **1,168/1,168**(작업 트리 전체 — task-055 화면 파일 포함).
- `flock ~/.node-local/thekaiwa-build.lock node node_modules/next/dist/bin/next build > log; echo $?` → **build_rc=0**(경고 3건은 기존 페르소나 파일 stat·CLI spawn 의 동적 파일 접근 — 이 task 와 무관).
- 일회 대조: HEAD `VoiceBar` vs 새 `VoiceBar`(trailing 없음/null) 정적 렌더 6변형 **바이트 동일**.
- 변이 5건(미러 사본, 원복 확인): ① 빈 trailing 도 격자 → 2 실패 ② 판 표시에 녹음 조건 → 1 실패 ③ `claimHelperTip` 이 쓰기를 믿음 → 1 실패 ④ 카드 뜻 줄 삭제 → 1 실패 ⑤ 낭독 sr 줄 조건부 → 1 실패. 원복 35/35.

### 시험이 잠근 것
안내 플래그(처음 true + 키 하나 `'1'` / 이미 봄 false·쓰기 없음 / 저장 막힘 → 한 번도 안 보임) · 잠김 RECORDING·RECOGNIZING 만 · 막힘 이유(빈칸·공백·100 코드포인트·이모지·요청 중·녹음·429) · 안내 줄(89 없음·90~100 n/100·101 bad·빈 제출·서버 400 문구 우선) · 응답 읽기(최대 3·빈 꼬리표/이유 칸 제거·빈 배열=못 찾음·모양 틀림=오류) · 실패 매핑(12s/504 시간 초과·429 대기 초·409 ENDED/TURN_RUNNING/PHRASE_BUSY·400 VALIDATION·0/404/422/5xx) · 결말(늦은 응답·취소 버림·끊김=시간 초과) · 낭독 문장 · 문구 표·엔진명 0 · ⑦A 부제 · VoiceBar trailing 유무 DOM · 버튼(이름·aria-expanded·판 있을 때만 aria-controls·aria-disabled·title 없음·describedby) · 안내(role=note·위치 공식·✕ 히트 44·꼬리) · 판 뼈대(section·data-kb-docked·높이 상한·sr 라벨·늘 마운트 status 2개·본문 data-kb 숨김·마이크/저장 없음) · 상태별 DOM(처음 칩·빈 제출·90/101자·로딩 120×2·slow·결과 1개/3개·펼침·글자 모드 [입력창에 넣기]·자막만 ▶ 없음·녹음 중 disabled/aria-disabled·[다른 말투]는 녹음 중 허용·빈 결과·오류/시간 초과/busy alert·429 대기 흐림) · 소리 실패 줄·재생 중 ■ · 모든 상태 DOM 엔진명 0 · TalkRoom 배치(배타·마친 역할극 없음·보내면 닫힘·마이크 누르면 소리 정지·입력 중 바 숨김·안내 숨김 조건·판정 조건·녹음 중 판 유지·초점 복귀·ENDED 다시 읽기) · 저장(도우미 파일에 localStorage·sessionStorage·console 0).

### 가이드(§22)와 다르게 쓴 곳 (모양·의미 불변)
1. **VoiceBar `trailing` 이 없을 때** 가이드 뼈대는 가운데 칸을 격자 + 빈 span 으로 바꾸지만, 구현은 **기존 `flex justify-center` 를 그대로** 둔다(Leader 지시 「비었을 때 기존과 바이트 동일」 우선, 가이드 같은 절 「넘기지 않으면 지금 화면과 같다」와도 일치). TalkRoom 은 말 모드에서 늘 넘기므로 보이는 화면은 가이드와 같다.
2. **`hp-none` 상자에 `role=status` 를 달지 않았다** — §22-6 표는 「role=status 상자」지만 §22-11·§22-13 은 「결과·빈 결과는 늘 마운트된 sr status 로, 상태가 바뀔 때 새 라이브 영역을 마운트하지 않는다(alert 만 예외)」. 둘이 겹치면 두 번 읽힐 수 있어 §22-13 을 따름. 빈 결과 문장은 sr 줄이 읽는다.
3. **소리 실패 줄 위치**: 가이드는 「카드 아래」 — `<ul>` 안에 `<li>` 아닌 형제를 둘 수 없어 카드(`li`) 안 아래 줄로 둠(보이는 위치 같음).
4. 칩·안내 ✕ 의 `before:` 에 `before:content-['']` 를 더함(Tailwind v4 는 자동이지만 명시 — 모양 불변).
5. 429 첫 프레임: `useCountdown` 첫 틱(setTimeout 0) 전 한 프레임은 「잠시 뒤 다시 물어봐 주세요.」 가 보일 수 있다 — `PracticeDock` 과 같은 방식이라 맞춤(낭독 줄은 처음부터 「n초 뒤」).

### 열린 질문 (Leader)
- **ENDED 가 일반 회화방에서 오는 경우**(서버 기록 (c): 상황 삭제로 `scenarioId` 가 null 이 된 방에 `endedAt` 이 남음) — 화면은 판을 닫고 `rp.reload()` 만 한다. 일반 회화방에서 `rp.reload()` 가 마친 방 표시로 이어지는지는 확인하지 않았다 — `[추측]` 판만 닫히고 마친 방 표시로는 바뀌지 않을 수 있다. 드문 경로라 기록만.
- 가이드 §22-6 `rp-practice` 의 「대답 연습 줄을 누르면 도우미 닫힘」은 도우미가 열린 동안 대답 연습 줄을 그리지 않으므로(§22-10) 도달하지 않는다 — 목표 카드 펼침만 도우미를 닫는다. 가이드 문장 정리 대상(designer) `[가능성 높음]`.

### 실기기에서만 확인할 것
- 앱 WebView 키보드: `data-kb` 가 켜지지 않으면 판 본문(예시·결과)이 키보드 위에서 숨지 않는다(§22-15 D). 아래 바 숨김은 초점 기반이라 동작해야 한다. 입력 줄이 키보드에 가려지는지.
- 화면 높이: 판 `min(46dvh,320px)` — 360×780·412×892 에서 [다른 말투] 줄이 판 아래로 밀리는 양(가이드 실측 20/73px)과 판 안 스크롤.
- 소리: 카드 ▶ 재생 → 선생님 소리·대답 연습 소리 먼저 멈춤 · 마이크 누름·방 재생 시작·판 닫힘에 멈춤 · 한 번에 하나.
- 안내 말풍선 위치 공식 `(바 폭 − 192)/2 + 4` 는 VoiceBar 치수(px-4·44·72·ml-3·44)에 의존 — 360/390/412 에서 꼬리가 도우미 가운데, 왼쪽 여백 ≥16.
- 녹음 중 마이크 1.05배 링과 도우미 사이 약 2px(가이드 §22-2 수용) — 실제 누름 오인 없는지.
- 처음 한 번 안내: 새 기기에서 한 번, 사이트 데이터 차단 WebView 에서는 안 보임.

### 미커밋 파일
위 표의 14개(신규 10 + 수정 3 + 라이브 시험 3 — 신규 10 = 타입 1·문구/로직/훅 3·부품 4·시험 2). 미러 `~/.node-local/thekaiwa-dev056u` 에 `node_modules/.prisma-old-hardlinked`(옮겨 둔 원래 링크)·`.next` 가 남아 있다 — 전용 미러라 정리하지 않음.

## REV-191 보완 (화면 developer 3회차 · 신규 소환 · 2026-10-11)

- [착수] 근거: [[task-056-rev-ui-record]] 「REV-191 최종 판정」(M-1·M-2·L-3·I-1·시험 보강 권고 5건). 데모 게이트 `check` → `DEMO_GATE_PASSED` / `task: task-056`(approved v1). 전용 미러 `~/.node-local/thekaiwa-fix056u` = 기본 미러 `cp -al` → 그 미러 안에서만 `.next` 치움·최상위 파일 하드링크 끊음(실복사)·`.prisma` 는 `thekaiwa-predeploy` 실복사(스키마 md5 `8f493d1b…` NFS·미러·predeploy 동일). 기본 미러·predeploy 무변경. 기준선 talk+scenario **230/230**.
  - 계획: ① M-1 정규식 → 콜백 잘라 단언 ② M-2 `phraseHelperLogic.createHelperRequester`(순수 컨트롤러 — 요청 1건·5s slow·12s 끊기·dispose·늦은 응답 버림, `settleHelper` 그대로) + 훅 위임 + `mock.timers` 시험 ③ `isImeEnter` 순수 함수 · [물어보기] pointerdown 소스 시험 · 카드 잠금 직접 호출 시험 ④ L-3 칩 `truncate` → 안쪽 span ⑤ I-1 안내 `aria-describedby` 를 안내가 실제 그려질 때만.
- [체크포인트 1] 구현·시험 작성 완료. 변경: `phraseHelperLogic.ts`(+`createHelperRequester`·`isImeEnter`) · `usePhraseHelper.ts`(수명주기 → 컨트롤러 위임) · `PhraseHelperPanel.tsx`(`isImeEnter` 호출·칩 `truncate` 안쪽 span) · `TalkRoom.tsx`(`tipShown` 끝에 `&& mode === 'voice'` 한 조건) · `__tests__/phraseHelperRender.test.ts`(M-1 교체·칩 기대 문자열 `</span></button>`·새 시험 5) · 신규 `__tests__/phraseHelperRequester.test.ts`(6). 미러 eslint(변경 6파일) 0 · tsc 0 · phraseHelper 시험 **46/46**(35 → +11).
  - L-3 실측(headless Chrome 147, 합성 HTML · Tailwind 값 손으로 옮김): 옛(버튼 truncate) vs 새(안쪽 span) — 상자 101×36·328×36 동일, 글자 위치(버튼 기준 top +10.3·left 29) 동일, 위아래 2px `elementFromPoint` 옛 = 버튼 아님 / 새 = 버튼(히트 44), 긴 글자 말줄임 둘 다 동작(폭 328 상한).
  - 다음 첫 행동: 변이 재현(미러 파일만, tmp+rename 으로 하드링크 보호) → talk·scenario·components 전체 시험 → `next build`.
  - 미커밋 파일: 위 6개 + 앞 소환 14개(그대로).

### 고친 것 (동작 불변 — 눈에 보이는 변화는 L-3 히트 영역뿐)
| 지적 | 파일 | 내용 |
|---|---|---|
| M-1 | `__tests__/phraseHelperRender.test.ts` | 「onAccepted 에서 닫음」: 파일 전체 게으른 정규식 → `queue.startTurn(aid)` 부터 그 뒤 첫 `onAudio:` 까지 잘라(400자 미만 확인) 그 안에서 `pauseStatus(true)` 시작·`helper.close()` 단언 |
| M-2 | `phraseHelperLogic.ts` | 새 `createHelperRequester()` → `{ pending, start(request, {onSlow, settle}), dispose }`. 옛 훅의 `Live`·`NO_LIVE`·12초/5초 타이머·`settleHelper` 호출·`finally` 정리·언마운트 정리를 **문장 그대로** 옮김. `start` 는 받는 중이면 null(방어 — 지금 흐름에선 `askBlockOf` 가 먼저 막아 도달 안 함). `dispose` 는 영구 정지가 아니다(옛 언마운트처럼 비우기만 — StrictMode 두 번 마운트에서도 그대로 동작) |
| M-2 | `usePhraseHelper.ts` | `const [req] = useState(createHelperRequester)` · 막힘 이유 `pending: req.pending()` · 언마운트 `useEffect(() => () => req.dispose(), [req])` · 요청 `void req.start((signal) => apiPost(…, { signal }), { onSlow: () => setPhase(p => p==='loading'?'slow':p), settle })`. 응답 매핑(`settle`)·문구·상태 이름·`settleHelper` 사용 무변경. 훅에서 `AbortController`·`setTimeout`·`clearTimeout`·`settleHelper` 0 |
| MU5 | `phraseHelperLogic.ts` · `PhraseHelperPanel.tsx` | `isImeEnter({key,keyCode,nativeEvent:{isComposing}})` 로 판정만 빼고 판은 `if (isImeEnter(e)) e.preventDefault()` |
| MU6 | 시험만 | [물어보기] 여는 태그(`type="submit"` ~ `{HELPER.ask}`)를 잘라 `onPointerDown={(e) => e.preventDefault()}` 단언 |
| MU7 | 시험만 | `PhraseHelperCard(props)` 를 직접 불러 요소 트리에서 ▶·[입력창에 넣기]를 찾아 `onClick()` — locked 면 `onPlay`·`onFill` 0회, 풀리면 각 1회(공허 방지 대조군) |
| L-3 | `PhraseHelperPanel.tsx` | 예시 칩 `truncate` → 안쪽 `<span className="block truncate">`. 버튼은 `relative … before:-inset-y-1` 그대로(overflow 없음) |
| I-1 | `TalkRoom.tsx` | `tipShown` 끝에 `&& mode === 'voice'` 한 조건(+주석 1줄). 말풍선은 원래 말 모드 가지에서만 그려지므로 그려지는 결과는 같고, 글자 모드에서 버튼 `aria-describedby` 가 사라짐 |

### 실행 증빙 (전용 미러 `~/.node-local/thekaiwa-fix056u`, `KAIWA_LOCAL_ROOT=… bash scripts/sync-local.sh` 후)
- `./node_modules/.bin/eslint` 변경 6파일(`phraseHelperLogic.ts`·`usePhraseHelper.ts`·`PhraseHelperPanel.tsx`·`TalkRoom.tsx`·`__tests__/phraseHelperRender.test.ts`·`__tests__/phraseHelperRequester.test.ts`) → **rc 0, 출력 없음**.
- `./node_modules/.bin/tsc --noEmit -p .` → **rc 0, 오류 0**(미러 전체).
- `node --import tsx --test --test-concurrency=1 src/components/talk/__tests__/phraseHelper*.test.ts` → **46/46**(앞 35 + 새 11: 렌더 파일 +5, 신규 `phraseHelperRequester.test.ts` 6).
- talk+scenario `--test-concurrency=4` → **241/241**(기준선 230 + 11).
- `find src/components -name '*.test.ts'` 전체 `--test-concurrency=4` → **1,179/1,179**(앞 기록 1,168 + 11).
- `flock ~/.node-local/thekaiwa-build.lock node node_modules/next/dist/bin/next build > log; echo $?` → **build_rc=0**(정적 21/21, 경고는 기존 페르소나 파일 stat·CLI spawn 동적 접근 — 이 task 무관). 기본 미러 `.next`(10-10)·predeploy 무변경.
- [최종] **DONE** — 다음 첫 행동: 없음(reviewer 재감사 인계). 미러에 일회 퍼즈 파일 `scratch-fix056u/equiv.test.ts`·`node_modules/.prisma-old-hardlinked`·`.next` 가 남아 있다(전용 미러, 정리 안 함). 미커밋 파일(이번): `src/components/talk/{phraseHelperLogic.ts,usePhraseHelper.ts,PhraseHelperPanel.tsx,TalkRoom.tsx}` · `src/components/talk/__tests__/phraseHelperRender.test.ts` · 신규 `src/components/talk/__tests__/phraseHelperRequester.test.ts`.

### 변이 재현 (미러 파일만 — 임시 파일+rename 으로 바꿔 하드링크 공유 inode 무변경, 매번 NFS 원본으로 되돌린 뒤 `cmp` 동일 확인 · 대상 시험 phraseHelper 3파일 46개)
| 변이 | 결과 |
|---|---|
| MU1a 훅 `askBlockOf` 의 `pending` 을 늘 false | 잡힘(1 실패 — 위임 배선 소스 시험) |
| MU1b 컨트롤러 `start` 의 받는 중 거부 제거 | 잡힘(2) |
| MU2a 컨트롤러 `dispose` 의 abort 제거 | 잡힘(2) |
| MU2b 컨트롤러 `dispose` 의 타이머 정리 제거 | 잡힘(1 — clearTimeout 엿보기) |
| MU2c 훅 언마운트 `req.dispose()` 제거 | 잡힘(1) |
| MU4 `TalkRoom` onAccepted 의 `helper.close()` 제거 | **잡힘(1 — M-1 해소)** |
| MU5a 판 onKeyDown IME 가드 제거 · MU5b `isImeEnter` 늘 false | 잡힘(1) · 잡힘(1) |
| MU6 [물어보기] `onPointerDown` 제거 | 잡힘(1) |
| MU7a 카드 ▶ 잠금 제거 · MU7b [입력창에 넣기] 잠금 제거 | 잡힘(1) · 잡힘(1) |
| L3 칩 옛 구조(버튼 truncate·span 없음) · L3b 버튼에 truncate 만 추가 | 잡힘(2) · 잡힘(1) |
| I1 `tipShown` 의 모드 조건 제거 | 잡힘(1) |
| X1 onSlow 호출 제거 · X2 `finally` 의 live 확인 제거 · X3 12초 → 120초 | 잡힘(2) · 잡힘(1) · 잡힘(2) |
→ 17/17 잡힘, 17/17 원복 `cmp` 동일. 감사 생존 변이 MU1·MU2·MU4·MU5·MU6·MU7 전부 이제 잡힌다.

### 컨트롤러 이동이 동작 불변인 근거
1. **기존 시험 전부 통과**: 앞 소환의 phraseHelper 35개(렌더 시험의 칩 기대 문자열 `>{ex}</button>` → `>{ex}</span></button>` 2줄만 L-3 구조 변경에 맞춰 바꿈, M-1 단언 교체) · talk+scenario 230 · components 1,168 그대로 통과.
2. **차등 퍼즈(일회, 미러 `scratch-fix056u/equiv.test.ts` — 저장소에 넣지 않음)**: 옮기기 전 훅의 수명주기 코드(134~170행·85~94행 원문, ref 만 객체로)와 새 `askBlockOf + createHelperRequester` 경로를 같은 무작위 조작열(물어보기·언마운트·시계 1ms~13s·응답/빈 결과/모양 틀림/네트워크 오류/AbortError, 서버가 신호를 따르는지 무작위) **3,000개**에 돌려 사건 기록(요청·abort·phase 변화·결말·매 조작 뒤 pending) **56,671건 동일**. 도달 분포: abort 3,888 · slow 1,935 · 결말 timeout 748 · error 376 · items 399 · 받는 중 거부 4,304. 민감도 대조: 컨트롤러 `finally` 의 live 확인을 지운 변이에서는 seed 11 에서 어긋남(→ 원복 `cmp` 동일).
3. **순서**: 옛 `ask` 는 타이머 생성·`live` 지정 → 상태 setter → `settleHelper`, 새 `ask` 는 상태 setter → `start`(타이머·`live`·`settleHelper`). 사이에 비동기 경계가 없고 setter 는 `live` 를 읽지 않으며 타이머 콜백은 그 뒤에야 돈다. `request` 가 동기로 던져도 결말이 `setPhase('loading')` 뒤에 오는 순서는 옛것과 같다(그래서 `start` 를 setter 앞으로 당기지 않았다).

### L-3 확인 (headless Chrome 147, 합성 HTML 에 Tailwind 값 손으로 옮김 — 실 앱 렌더 아님)
옛(버튼 truncate) vs 새(안쪽 span): 상자 101×36·328×36 동일 · 버튼 기준 글자 위치(top +10.3, left 29) 동일 · 칩 가운데 위/아래 2px `elementFromPoint` 옛 = 버튼 아님 / 새 = 버튼(히트 36 → 44) · 긴 글자 말줄임 둘 다 동작(폭 328 상한). 덧붙임 관찰(변경 안 함): 칩이 두 줄로 감기면 세로 gap 6px 에 위아래 확장 4px+4px 가 겹쳐 2px 띠는 아래 칩이 받는다 — 가이드 §22-11 의 「히트 44 + gap 6」 자체의 성질(designer 참고).

### 이탈·미실행
- **「새 질의가 이전 요청을 abort」 시험은 만들지 않았다** — 지금 동작은 그 반대다: 받는 중에는 새 질의가 `askBlockOf` → `'pending'` 으로 **거부**되고 앞 요청은 끊기지 않는다(시험 「동시에 하나(MU1)」가 이 동작을 잠금). 「새 질의가 앞 요청을 끊고 대체」하려면 동작 변경이라 「기계적 이동」 원칙에 어긋난다. 대신 앞 요청이 버려진 뒤(dispose) 새 요청이 앞 요청의 늦은 응답·오류·`finally` 에 흔들리지 않음을 시험했다.
- 실기기·실 브라우저 렌더 미확인(L-3 은 합성 HTML 실측만). L-1·L-2·L-4·서버·문서는 지시대로 손대지 않음.
- 판 `retryBtn`·`submit` 분기 순수 함수화(감사 권고 2의 후반)는 지시 범위 밖이라 하지 않음.

### 열린 질문 (Leader)
- 위 「새 질의가 이전 요청을 abort」 — 지시문 표현이 지금 동작(거부)과 다르다. 지금 동작을 유지하는 것으로 읽었다 `[가능성 높음]`. 대체 동작이 의도였다면 별도 결정(동작 변경·designer 확인) 필요.
- `docs/screens.md` §22-11·§22-14 H2 「칩 히트 44」 문구는 이제 구현과 맞다. 승인 데모 HTML(`.chip{overflow:hidden}`)은 그대로 36px 이다(데모 파일은 수정 금지라 손대지 않음) — 데모와 구현이 이 한 점에서 다르다는 사실만 기록.

## QA-C 반송 수정 (화면 developer 4회차 · 신규 소환 · 2026-10-11)

- [착수 21:40] 근거: [[task-056-qa-record]] 「QA-C 기록」(F-1~F-6). 데모 게이트 `check` → `DEMO_GATE_PASSED` / `task: task-056`(approved v1). 전용 미러 `~/.node-local/thekaiwa-fix056u2` = `thekaiwa-fix056u` 에서 `rsync --link-dest`(`.next`·scratch 제외) + 최상위 파일·`tutor.md` 하드링크 끊음(실복사) + `sync-local.sh`. `.prisma` 는 predeploy 와 같은 md5(`4cd2598f…`)·NFS 스키마 md5 `8f493d1b…`. 개발 서버 `next dev -p 3016`(PID 파일 scratchpad `f056u2/dev.pid`), QA2 쿠키. 브라우저는 `/usr/bin/google-chrome` 147 + playwright-core 1.58(저장소 밖 스크립트 `scratchpad/f056u2/*.mjs`). 응답은 QA-C 와 같이 가로채기로 고정(phrase-help·turns·reply-practice·annotate 서버 도달 0).
- [원인 확정 — 재현·진단 4건, 브라우저 실측]
  - **F-1 = 코드 결함이 아니다 [확실]**. QA-C 가 본 「판 소멸」은 **STT 게이트웨이 부재로 뜬 오류 띠**가 원인이다. 이 환경(우분투 개발 미러)에는 `/ws/speech` 게이트웨이가 없어 PTT 를 누르면 티켓 뒤 WebSocket 연결이 실패 → `SttAlert` 띠(`role=alert` 「음성 인식 서버에 연결하지 못했어요 …」, `TalkRoom.tsx:1047`)가 새로 뜨고 → `blocked` false→true → `PhraseHelperPanel` 효과가 `onDismiss`(=`helper.close()`) — **§22-10 「띠가 새로 뜨면 도우미 닫기(결과 기억)」 명세대로**다. 진단 1(`diag1.mjs`): 누른 지 250ms 에 alerts=[「음성 인식 서버에 연결하지 못했어요…」], `panel:false`. 또 QA 가 녹음 상태의 증거로 본 상태줄 「누르고 있는 동안 말해요」는 **PTT 의 대기(IDLE) 라벨**이라 누르기 전(`before-press`)에도 같은 글이다 — 녹음 중 라벨은 「듣고 있어요 · 0:00 — 손을 떼면 …」. 진단 2(`diag2.mjs`, Playwright `routeWebSocket` 으로 가짜 게이트웨이: `start`→`ready`, `stop`→`final`): **띠 없이 진짜 녹음 상태**가 되면 hold 300~1800ms 내내 `panel:true`·`qDisabled:true`·도우미 버튼 `aria-disabled=true`·alerts [], 손을 떼면 `turns` POST → `accepted` → 500ms 안에 `panel:false` — **⑤A 전부 명세대로**. → 앞선 화면 시험이 소스 정규식 위주라 못 잡은 게 아니라 동작은 맞았고, 반송 사유가 환경 때문이었다. 그래도 요청대로 렌더 조건을 순수 함수로 빼 상태 조합 시험을 더한다(아래).
  - **F-2 = 역할극 한정이 아니다 — 입력칸 초점 중 ✕ 를 누르면 일반 음성 방도 같다 [확실]**. 진단 3(`diag3.mjs`, 마우스): 판이 열린 직후(입력칸 초점) ✕ 위에서 mousedown → `focusout:input#talk-helper-q` → `onBlur → setTyping(false)` → 입력 중에 숨겼던 아래 VoiceBar 가 다시 그려져 **판이 y 677 → 560 (−117px) 로 밀리고 ✕ 도 같이 이동**, mouseup 은 옛 좌표(이제 다른 요소)에 내려앉아 `pointerup:div`·`click:section#talk-helper` — click 이 ✕ 가 아니라 공통 조상에 떨어져 `onClick` 이 안 불린다(이벤트열 `pointerdown:path, mousedown:path, focusout:input, focusin:button[닫기], pointerup:div, mouseup:div, click:section`). 입력칸을 먼저 blur 한 상태(`FOCUS_FIRST=0`)에서는 ✕ 가 정상(`click:path` 뒤 `panel:false`, 초점 도우미 버튼). Esc 는 포인터가 없어 정상. 원인 위치: `PhraseHelperPanel.tsx` 입력칸 `onBlur={() => h.setTyping(false)}`(249행) + `TalkRoom.tsx` `helper.typing ? null : <VoiceBar …/>`(1180행 근처) — 사전에 추측한 「닫은 뒤 재열림 효과」는 없다. 재열림 후보(대답 연습 배타·`practiceShown`·`focusHelperBtnRef`·`helperTyping`)는 `helper.open` 을 true 로 만드는 곳이 `toggleHelper` 뿐이라 닫기 직후 열릴 수 없음을 코드로 확인.
  - **F-3 = F-2 와 같은 뿌리 [확실, 같은 메커니즘 — 고치지 않음]**: 입력칸 초점 중 칩/▶/[다른 말투]/[다시 시도]/[입력창에 넣기] 의 첫 탭은 같은 blur → 바 재등장 → 판 이동 → click 소실(REV-191 L-1). 이번 F-2 수정은 ✕ 한 곳이고 나머지 판 안 버튼은 지시대로 그대로 둔다(아래 「F-3 관찰」).
  - **F-4 = 실제 결함이 아니다 — QA 스크립트가 읽은 글이 달랐다 [확실]**. QA 정규식 `/(\d+)초 뒤 다시 물어볼 수 있어요/` 를 `#talk-helper` **전체 textContent** 에 걸었는데, DOM 순서상 본문 앞에 있는 `p.sr-only[role=status]`(늘 마운트된 결과 낭독 줄, 429 때 서버 초 「12초 뒤 다시 물어볼 수 있어요.」 한 번 고정)가 먼저 걸린다. 진단 4(`diag4.mjs`, 본문 `#talk-helper > div:last-child` 와 sr 줄을 따로 읽음): 본문 12 → 12 → 11 → 10 → 10 → 9 → 9 → 8 → 8 → 7 → 7 → 6 → 6 → 5 → 5 → 4 (500ms 간격, 8초) — 1초마다 줄고 [다시 시도] `aria-disabled=true` 유지. sr 줄은 낭독 한 번용이라 고정이 맞다(§22-13). 헤드리스 타이머 스로틀도 아니다(`document.visibilityState=visible`). → 코드 변경 없음.

### 마무리 (화면 developer 5회차 · 신규 소환 · 2026-10-11 22:0x~)

- [점검 22:00] 앞선 소환(80턴 끊김)이 남긴 상태: ✕ 한 곳만 `onPointerDown={keepInputFocus}`(F-2) + 칩 `::before` inset `-inset-y-[5px]`(F-5) + 새 시험 `phraseHelperBehavior.test.ts`. 칩·카드 ▶·[입력창에 넣기]·[다른 말투]·[다시 시도]는 **미적용**(F-3 그대로). 미러(`thekaiwa-fix056u2`)와 NFS 소스는 동일, 개발 서버 3016 살아 있음 → 재사용.
- [사전 확인 22:05] Chrome 147 합성 페이지(`focus-probe.mjs`): `pointerdown.preventDefault()` 는 **마우스·터치(Playwright touchscreen.tap) 모두** 입력칸 blur 를 막고 click 은 그대로 온다(`pd.click`, active=q). `mousedown` 취소와 같은 결과.
- [기준선 22:08] 새 스크립트 `g1.mjs`(입력칸 초점 상태에서 판 안 버튼 첫 탭 × 방 3종[일반 음성·역할극·글자 모드] × 포인터 2종[마우스·터치], 응답은 가로채기): **수정 전 12/38 통과** — ✕ 만 통과, 칩·[다른 말투]·▶·[다시 시도]·[입력창에 넣기] 전부 첫 탭 소실(판 −117px[글자 모드 −85px]). 즉 **F-3 은 5개 버튼 모두 재현**.
- [수정 22:15] **F-3 (F-2 와 같은 뿌리) — 판 안 나머지 버튼 5개에 `onPointerDown={keepInputFocus}` 통일**: 예시 칩·[다른 말투 n개 더 보기]·[다시 시도](`PhraseHelperPanel.tsx`) · 카드 ▶·[입력창에 넣기](`PhraseHelperCard.tsx`). 판 안 `<button>` 은 이제 전부 7개(✕·[물어보기] 포함)가 같은 방식. 키보드(Tab/Enter/Space)·Esc·스크린리더는 pointer 가 아니라 영향 없음(아래 g4).
  - **부수 수정 2건(부작용 확인 중 나온 것)**: ① 새 질의는 입력칸을 내린다(`screens §22-10` 「새 질의는 `more=false`·소리 정지·input `blur()`」) — [물어보기]만 blur 하고 칩·[다시 시도]는 안 했던 것을 `askNow(q?)` 한 길로 모음(`ask` 가 막혀 있으면 초점 유지). 칩을 눌러도 키보드가 계속 열려 있는 일이 없다(키보드 내림 = §22-10 의도 그대로). ② **[입력창에 넣기]**: 입력칸 초점을 지키면 누르는 순간 글자 모드 입력창(`hidden={helper.typing}`)이 아직 숨겨져 있어 `fill()` 안의 `focus()` 가 먹지 않는다(§22-12 `hp-text-filled` 「초점(키보드)」 위반) → `TalkRoom.tsx` 에 `focusComposerRef` + 별도 효과(`!helper.open && !helper.typing` 일 때 `composerRef.focus()`)를 둬 ✕ 의 `focusHelperBtnRef` 와 같은 패턴으로 다시 그려진 뒤 초점. 브라우저 실측: 판 닫힘·`textarea.value='声がかれています'`·`activeElement=TEXTAREA`.
  - F-5 는 앞선 소환의 `before:-inset-y-[5px]` 가 맞다 — 이번에 수치로 확인(아래).
- [시험 22:30] `phraseHelperBehavior.test.ts` 개편: 옛 「`onPointerDown` 이 2개」 세기 시험을 **버튼별** 시험으로 교체 — 두 파일의 `<button` 조각을 전부 훑어 개수(5+2)가 목록과 다르면 실패하고, 각 버튼(단서 문자열로 식별)이 `onPointerDown={keepInputFocus}` 를 가졌는지 본다(새 버튼이 생기면 여기서 걸림) + 카드 `PhraseHelperCard` 를 함수로 직접 불러(훅 없음) 요소 트리에서 ▶·[입력창에 넣기]를 찾아 `onPointerDown`→`preventDefault` 1회·잠기면 click 무동작 + `askNow` 길(칩·[다시 시도] blur). `phraseHelperRender.test.ts` 한 곳(`onFill` 정규식)에 `focusComposerRef` 줄 반영.
- [브라우저 전후 22:40] 환경: 전용 미러 `~/.node-local/thekaiwa-fix056u2`·개발 서버 3016·QA2 쿠키·`/usr/bin/google-chrome` 147 + playwright-core 1.58(isMobile·DSF 2.625·390×892). `phrase-help`·`turns`·`text/annotate`·`reply-practice` 등 비-GET 전부 가로채기 → 서버 도달·DB 쓰기·LLM 0. 스크립트는 저장소 밖 scratchpad `f056u2/{g1,g3,g4,g5,f5,diag3}.mjs`.
  - **F-2·F-3 (g1.mjs)**: 입력칸 초점 상태에서 판 안 버튼 첫 탭 × 방 3종(일반 음성·역할극·글자 모드) × 포인터 2종(마우스·터치) — **수정 전 12/38 통과(✕ 만) → 수정 후 38/38**. 칩 hits 0→1(질의 일치), [다른 말투] `aria-expanded` false→true, ▶ TTS 요청 0→1, [다시 시도] hits 1→2, [입력창에 넣기] 판 닫힘·`textarea.value`·`activeElement=TEXTAREA`. 수정 전 판 이동: 음성 방 y 584→467(−117px), 글자 모드 572→487(−85px) → 수정 후 [다른 말투] 타고 펼쳐도 572→572(밀림 없음). ✕ 마우스(`diag3.mjs`): mousedown 중 판 y 677·✕ y 678 고정, 이벤트열 `pointerdown:path, pointerup:path, click:path`(수정 전 `click:section#talk-helper`), 닫힌 뒤 초점 도우미 버튼.
  - **F-5 (f5.mjs, 3폭×2방)**: 첫 줄 칩 위 확장 + 마지막 줄 칩 아래 확장 = 수정 전(`-inset-y-1`) `::before` 42px · 실효 3.75+2.75+36 = **42.5** → 수정 후(`-inset-y-[5px]`) `::before` 44px · 4.75+3.75+36 = **44.5**(DSF 2.625 장치 픽셀 맞춤으로 ±0.75 — 공칭 44). 칩이 두 줄로 감기면 세로 gap 6px 에 위·아래 확장 4+4px 가 겹쳐 2px 띠는 DOM 뒤 칩이 받는다(가이드 §22-11 「히트 44 + gap 6」 성질 — QA-C 「아래 3px 바깥 ✗」는 이 띠를 첫 줄 칩 기준으로 본 것). QA-C 「판 ✕ 위 3px 바깥」 FAIL 은 ✕ 가 이미 44×44 이고 바깥 확장을 두지 않아서다(스크립트 기대 문제, 결함 아님).
  - **⑤A (g3.mjs, 가짜 STT 게이트웨이)**: `page.routeWebSocket(/\/ws\/speech/)` 로 `start→ready`, `stop→final`, `speech/ticket` 가로채기, Chrome `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`, 마우스·CDP 터치(`Input.dispatchTouchEvent`)로 PTT 누름 유지 → **12/12**(음성 방·역할극 × 마우스·터치 × [긴 녹음→보냄 / final 없음]). 녹음 중(상태줄 「듣고 있어요 · 0:01 — 손을 떼면 보내…」) 350ms 간격 5번 표본 전부 `#talk-helper` 존재 · 입력칸 `disabled` · 도우미 버튼·카드 ▶·[물어보기] `aria-disabled=true` · `[role=alert]` 0건. 손을 떼면 `POST chats/:id/turns` → accepted 뒤 **250ms 안에 판 닫힘**. final 이 없으면(인식 0) 판 유지·턴 POST 0. **이전 소환 `diag2.mjs` 와 같은 결론이고 이번엔 카드 버튼 잠김·터치·역할극까지 확인.**
  - **키보드 (g4.mjs 6/6)**: Tab→칩 Enter/Space 질의, Tab→▶ Enter 소리 요청, Tab→[다른 말투] Enter 펼침, Tab→[다시 시도] Enter 재질의, Esc 닫힘·초점 → 도우미 버튼 — `keepInputFocus` 는 pointer 에만 작용.
  - **터치 스크롤 부작용 (g5.mjs)**: 글자 모드 판(카드+[다른 말투]가 320px 를 넘어 세로 스크롤)에서 [입력창에 넣기] 위에서 시작해 위로 끄는 터치 → `scrollTop` 0→40(끝까지), 새는 click 0, 판 유지, 입력창 안 채워짐 — `pointerdown.preventDefault()` 가 스크롤·탭 구분을 깨지 않는다.
  - **부작용 관찰(기록)**: ① 칩·[다시 시도]를 누르면 질의 후 입력칸이 내려가고(키보드 내림) 아래 바가 돌아온다 = [물어보기]와 같은 길 — 의도(§22-10 「새 질의는 input blur()」). ② ▶·[다른 말투] 는 질의가 아니므로 입력칸 초점을 그대로 둔다 → 초점이 입력칸에 있던 동안은 아래 바(마이크)가 숨은 채 남는다(초점 기반 규칙 그대로). 실제 폰에서 이 상태가 되려면 입력칸을 눌러 키보드를 올렸다가 뒤로가기로 내리는 경우뿐(키보드가 올라 있으면 본문이 숨어 버튼을 누를 수 없다) — 드문 경로라 고치지 않고 아래 열린 질문에 올림. ③ [입력창에 넣기]: 판 닫힘 → 입력창이 다시 그려진 뒤 초점(효과) — 위 22:15 항목. ④ 앱 WebView 처럼 `data-kb` 가 없는 환경에서는 칩이 키보드 위에 보이므로 칩 첫 탭이 곧 이 수정의 핵심 경로다.
- [실행 증빙 22:55] (전용 미러, 출력은 scratchpad 파일)
  - `node --import tsx --test --test-concurrency=1 src/components/talk/__tests__/*.test.ts` → **89/89** 통과(이전 86 → 새 시험 3 추가: 버튼별 keepInputFocus·카드 요소 트리·askNow/blur 길). `find src/components -name '*.test.ts'` 전체(talk·scenario·chat·vocab …) → **1191/1191**, 실패 0.
  - `eslint src/components/talk src/components/scenario` rc 0 · `tsc --noEmit`(전체) rc 0 · 전용 미러 `next build > build.log` rc **0**.
  - **변이 13건 전부 사망**(미러 사본에서만 바꾸고 NFS 원본으로 복원, `cmp` 동일 확인): 카드 ▶/[입력창에 넣기]/칩/[다른 말투]/[다시 시도]/판 머리 ✕/[물어보기] 각각의 `keepInputFocus` 제거(7) · 칩 inset 옛 값 · 칩이 `askNow` 건너뜀 · [다시 시도] blur 제거 · `focusComposerRef` 표시 제거 · 입력창 초점 효과 제거 · Esc 가 ✕ 와 다른 길(6). 스크립트 `scratchpad/f056u2/mut056.py`.
- [트러블슈팅 — 재발 가능] 브라우저 시험이 도는 동안 `sync-local.sh` 를 다시 돌리면, 변이 시험의 `cp` 로 mtime 이 달라진 파일을 rsync 가 같은 내용으로 다시 복사해 Next 개발 서버가 Fast Refresh/전체 새로고침 → 진행 중이던 시험이 한 번 깨졌다(`▶` 요소를 못 찾아 30s 타임아웃, g1 [rp/touch]). 코드 문제가 아니라 시험 중 동기화 탓 — 조용한 상태에서 같은 구간을 다시 돌려 26/26. 시험 중에는 미러를 건드리지 않는다.
- [정리] 3016 개발 서버(PID 2305321) 종료·포트 비움 확인 · 이번 소환이 띄운 Chrome 은 스크립트가 모두 닫음(`ps` 로 남은 것은 26일 전 다른 작업의 bjj 헤드리스 크롬뿐 — 건드리지 않음) · QA2 쿠키 파일 삭제 · 방·DB 쓰기 0(응답 가로채기) · 전용 미러 `thekaiwa-fix056u2`는 그대로 둠(`.next` 에 이번 `next build` 결과).
- [열린 질문 / 사용자 실기기 확인]
  1. **실기기 확인 항목**(이 환경에서 못 하는 것): 앱 WebView(APK)·실제 소프트 키보드로 판 안 버튼 첫 탭(특히 칩·[입력창에 넣기])과 키보드 높이 변화에서 판 위치 · **온디바이스 STT(sherpa 플러그인) 경로에서의 ⑤A**(이번 검증은 웹=gateway 경로의 가짜 서버였고, 방 상태 기계는 경로와 무관하지만 플러그인 쪽 상태 전이는 못 봤다) · 실제 TTS 소리(▶ 는 요청 발생까지만 확인, 목소리는 503 으로 막음) · 글자 모드 IME 조합 중 Enter.
  2. (designer 참고) ▶·[다른 말투] 뒤 입력칸 초점이 남아 아래 바가 숨은 채인 드문 경로를 질의처럼 blur 할지 — 지금은 「초점 기반」 규칙 그대로 둠. QA-C Info(입력칸 초점 중 도우미 버튼이 DOM 에 없어 `aria-expanded` 대상이 없음)도 designer 몫.
  3. (Leader) `docs/screens.md` §22 에는 「[물어보기]는 `onPointerDown preventDefault`」 한 줄뿐 — 이제 판 안 모든 버튼이 같은 방식이고 칩·[다시 시도]도 질의 후 blur 한다는 한 줄과, [입력창에 넣기]의 초점이 다시 그려진 뒤 효과라는 점을 보태는 것을 제안(문서는 건드리지 않음). QA-C 기록의 F-4 정정은 Leader 처리.
- [체크포인트 — 완료] 완료: F-2/F-3 판 안 버튼 7개 통일·askNow·입력창 초점 효과·시험 개편·브라우저 전후·⑤A·키보드·스크롤·빌드 / 남은 일: Reviewer 재시작(QA-C 반송 수정이므로 Reviewer 부터 재순환) / 미커밋 변경(내가 이번 소환에서 만지거나 만든 것): `src/components/talk/{PhraseHelperPanel,PhraseHelperCard,TalkRoom}.tsx`, `src/components/talk/__tests__/{phraseHelperBehavior,phraseHelperRender}.test.ts` (그 외 task-056 화면 파일은 앞선 소환 몫이며 모두 미커밋).

## 도우미 요청 자동 취소 (화면 developer 6회차 · 신규 소환 · 2026-10-11)

- [착수] 근거: 사용자 결정 「말하기를 시작하면 대기 중인 도우미 요청을 자동 취소」(QA-B 실측: 도우미가 먼저 돌면 회화 턴 첫 음성 p50 2.19→5.16초) + `docs/screens.md` §22 `hp-rec` 행·§22-10 「녹음(⑤A)」. 데모 게이트 `check` → `DEMO_GATE_PASSED` / `task: task-056`(approved v1). judge: feature·1.4·R1·developer=sonnet. 서버 변경 없음(#180 `CANCELLED` 는 이미 `req.signal` 로 약 0.5초). 전용 미러 `~/.node-local/thekaiwa-fix056u3` = `thekaiwa-fix056u2` 를 `rsync --link-dest`(`.next`·scratch 제외) 후 `sync-local.sh`.
- [체크포인트 1 — 구현 완료, 시험 전] 
  - 완료: `phraseHelperLogic.ts` — `createHelperRequester().cancelPending(): boolean`(받는 중·결말 전·12초 안 지난 요청만 신호 끊기+타이머 정리+`live` 해제, 아니면 false; `settled` 표시 추가) · `helperMsgOf({cancelled})`(우선순위: 서버 400 > 빈 제출 > 100자 초과 > **멈춤 안내** > 90자 글자 수) · `CancelNote`(`null|'unseen'|'seen'`)·`cancelNoteOnCancel(panelShown)`·`cancelNoteOnOpen(note)` / `usePhraseHelper.ts` — `cancelPending`(멈췄으면 `phase='idle'`·질의 유지·안내 표시, 판이 그려져 있었으면 `seen` 아니면 `unseen`) · `ask` 가 안내를 지움 · 판 열기(`setOpen(true)`)가 `cancelNoteOnOpen` 적용(이미 본 안내는 지우고 못 본 안내는 이번에 보임) · 반환에 `cancelled`·`cancelPending` / `helperCopy.ts` `HELPER.cancelled` / `PhraseHelperPanel.tsx` 안내 줄에 `cancelled` 전달 + 안내 줄 `aria-live` 를 말하는 동안(`locked`) `off` / `TalkRoom.tsx` — `onPress`(`helper.stopSound()` 바로 뒤)에서 `helper.cancelPending()` · 모든 턴 시작 길 `sendOutgoing` 첫 줄에서 `cancelHelperRef.current()`.
  - **함정(재발 가능)**: `sendOutgoing` 은 `onFinal` → `useRealtimeStt` 로 이어지는 STT 콜백이 닿는 함수라, 그 안에서 `helper.*`(어느 멤버든 — `close`·`stopSound` 도 같다, 이분 탐색 4건)를 직접 부르면 컴파일러 린트 `react-hooks/purity` 가 `onFinal` 의 기존 `Date.now()` 를 렌더 중 호출로 오탐해 error 를 낸다(도우미 훅은 STT 훅보다 뒤에 만들어지는 forward 참조). → `cancelHelperRef`(최신 `helper.cancelPending` 을 효과로 옮겨 둠)를 `sendOutgoing` 이 읽는다. `onAccepted`(useChatTurn 콜백)·`onPress`(VoiceBar prop)에서는 `helper.*` 직접 호출이 통과한다. 또 훅 안에서 `d.recording` 전이 효과로 `cancelPending()` 을 부르면 `react-hooks/set-state-in-effect` 경고(0 이어야 함) → 녹음 시작 취소는 효과 대신 사건 처리기 `onPress` 로 둔다(녹음을 시작하는 길이 `onPress` 하나뿐임을 grep 으로 확인: `stt.press` 호출처 TalkRoom 536행 하나).
  - 남은 일: 시험(컨트롤러·안내 상태기계·안내 줄 우선순위·연결) → 변이 → 전용 미러 eslint/tsc/test/build → 브라우저 확인 → 마무리 기록.
  - 다음 첫 행동: `phraseHelperRequester.test.ts` 에 `cancelPending` 시험 추가.
  - 미커밋(이번 소환이 만지거나 만들 것): `src/components/talk/{phraseHelperLogic.ts,usePhraseHelper.ts,helperCopy.ts,PhraseHelperPanel.tsx,TalkRoom.tsx}` + 시험 파일(`__tests__/phraseHelperRequester.test.ts` 등). 그 밖 task-056 화면 파일은 앞선 소환 몫(모두 미커밋).
- [체크포인트 2 — 시험·변이 완료] 시험 추가: `__tests__/phraseHelperRequester.test.ts` +3(cancelPending: 로딩·slow 취소 / 끝난 상태 무동작·결말 도중·12초 끊김 / 취소 직후 새 요청·늦은 응답·거절 무오염) · 신규 `__tests__/phraseHelperCancel.test.ts` 11(문구·안내 줄 우선순위·`CancelNote` 상태기계와 시나리오 A/B/C/D·판 렌더 `aria-live`·훅 `cancelPending`/`ask`/`openPanel`/`close` 배선·방 `onPress`/`sendOutgoing`/ref 동기화 — 소스는 모두 **해당 콜백 범위로 잘라** 본다, `between()`). 전용 미러 eslint(talk·scenario) rc 0 · tsc rc 0 · `src/components` 전체 시험 **1,205/1,205**(앞 1,191 + 14). 변이 22건 전부 사망·원복 `cmp` 동일(아래 「변이」). 남은 일: `next build` 확인(백그라운드 중) · 브라우저 확인 · 마무리 기록. 다음 첫 행동: 개발 서버(3016~3019 중 빈 포트) + 가짜 STT 게이트웨이로 `phrase-help` 지연 응답 → PTT 누름 시나리오.
- [체크포인트 3 — 완료] 브라우저 확인·`next build`·정리까지 끝. 아래 「요지」「실행 증빙」「변이」「브라우저」「열린 질문」.

### 요지 (서버 변경 없음 · 판 모양 불변 · 새 문구 한 줄)
| 파일 | 내용 |
|---|---|
| `src/components/talk/phraseHelperLogic.ts` | `createHelperRequester().cancelPending(): boolean` — 받는 중이고 결말 전(`settled` 새 표시)이며 12초에 끊기지 않은 요청만: `live` 해제 → 신호 끊기 → 타이머 정리 → true. 아니면 무동작 false. 그 요청의 응답·거절은 `settleHelper` 의 `live()` 검사로 버려져 **오류·시간 초과로 알리지 않는다** · 취소 직후 새 `start` 가능 / `helperMsgOf({cancelled?})` 우선순위 서버 400 > 빈 제출 > 100자 초과 > **멈춤 안내** > 글자 수 / `CancelNote`(`null\|'unseen'\|'seen'`)·`cancelNoteOnCancel`·`cancelNoteOnOpen` |
| `src/components/talk/usePhraseHelper.ts` | `cancelPending`(컨트롤러가 실제로 취소했을 때만 `phase='idle'`·안내 표시 — 질의·결과 그대로, 판이 그려져 있었으면 `seen` 아니면 `unseen`) · `ask` 가 막힘 검사 뒤 안내를 지움 · 판 열기(`setOpen: openPanel`)가 `cancelNoteOnOpen` 적용 · `close` 는 불변 · 반환 `cancelled`·`cancelPending` |
| `src/components/talk/helperCopy.ts` | `HELPER.cancelled` = 「말하는 동안 도우미를 멈췄어요. 끝나면 다시 물어봐 주세요.」 |
| `src/components/talk/PhraseHelperPanel.tsx` | 안내 줄에 `cancelled` 전달 · 안내 줄 `aria-live` 를 말하는 동안(`locked`) `off`(아래 열린 질문 2) |
| `src/components/talk/TalkRoom.tsx` | `onPress`(`helper.stopSound()` 바로 뒤, `stt.press()` 전)에서 `helper.cancelPending()` · `sendOutgoing` 본문 첫 줄에서 `cancelHelperRef.current()`(글자 전송·다시 보내기·밀려 있던 말·말 최종 — 모든 턴 시작이 지나는 길) · `cancelHelperRef` 를 최신 `helper.cancelPending` 으로 동기화하는 효과 |
| 시험 | `__tests__/phraseHelperRequester.test.ts` +3 · 신규 `__tests__/phraseHelperCancel.test.ts` 11 |

- **호출 시점 결정(사양 대비)**: 사양 「view.state 가 RECORDING 으로 바뀔 때」는 **마이크를 누르는 사건(`onPress`)** 으로 구현했다 — 방에서 녹음을 시작하는 길이 `onPress` 하나(`stt.press` 호출처 1곳)이고, 훅 안 효과(`if (d.recording) cancelPending()`)로 하면 `react-hooks/set-state-in-effect` 경고가 나 효과를 쓰지 않았다. 마이크를 눌렀는데 권한 거부 등으로 녹음이 안 열리는 경우에도 취소·안내는 남는다(`view.state` 도 `starting` 을 RECORDING 으로 읽으므로 상태 전이 방식과 같은 결과).
- **글자 전송 경로 확대**: 사양의 「글자 전송」 하나가 아니라 `sendOutgoing`(모든 턴 시작)에 걸었다 — 다시 보내기·밀려 있던 말(QUEUED 가 풀려 나가는 말)도 같은 문제(도우미 요청과 AI 호출 줄을 나눔)라서. 말로 보낼 때는 마이크 누름에서 이미 멈췄으므로 보통 무동작.
- **안내 지우는 때(사양 문장 해석)**: 「다음 질의를 보내거나 판을 다시 열 때 지운다. 닫혀 있을 때 취소됐다면 다시 열었을 때 이 줄이 보이고 질의가 남아 있다」 두 문장을 함께 만족시키려고 `seen`/`unseen` 으로 나눴다 — 판이 열려 있을 때 멈추면(`seen`, 녹음 내내 보임) 다시 열 때 지움 / 닫혀 있을 때 멈추면(`unseen`) 다시 열었을 때 한 번 보이고 그다음 열 때 지움 / 새 질의(`ask`, 막힘 검사 통과 후)는 어느 쪽이든 지움.
- **함정(재발 가능, 위 체크포인트 1 에도 적음)**: `sendOutgoing`(STT 콜백이 닿는 함수)에서 `helper.*` 를 직접 부르면 `react-hooks/purity` 오탐 → `cancelHelperRef` 로 우회. 이 우회가 깨지지 않게 시험이 「`sendOutgoing` 본문에 `helper.` 없음」을 잠근다.

### 실행 증빙 (전용 미러 `~/.node-local/thekaiwa-fix056u3`, `KAIWA_LOCAL_ROOT=… bash scripts/sync-local.sh` 후; NFS 원본과 `cmp` 동일 확인)
- `eslint src/components/talk src/components/scenario` → **rc 0, 출력 없음**(경고 0).
- `tsc --noEmit -p .`(미러 전체) → **rc 0**.
- `node --import tsx --test --test-concurrency=1 src/components/talk/__tests__/phraseHelper*.test.ts` → 변이 기준선 fail 0.
- `node --import tsx --test --test-concurrency=4 $(find src/components -name '*.test.ts' | sort)` → **1,205/1,205**(앞 기록 1,191 + 14), 실패 0.
- `flock ~/.node-local/thekaiwa-build.lock node node_modules/next/dist/bin/next build > build.log; echo $? > build.rc` → **build_rc=0**(출력은 scratchpad 파일, 경고는 기존 페르소나 파일 stat·CLI spawn 동적 접근).

### 변이 (미러 사본에서만 바꾸고 NFS 원본으로 되돌린 뒤 `cmp` 동일 확인, 대상 시험 phraseHelper 5파일) — 22건 전부 사망
녹음 시작 호출 제거(M1, 1) · 턴 시작 호출 제거(M2, 1) · 최신 함수 동기화 제거(M2b, 1) · 턴 시작 호출 위치를 `turn.send` 뒤로(M2c, 1) · `cancelPending` 의 abort 제거(M3, 2) · 타이머 정리 제거(M3b, 1) · `live` 해제 제거=요청 1건 제한 안 풀림(M3c, 2) · 결말 낸 요청도 취소(`settled` 검사 제거, M4a, 1) · 12초에 끊긴 요청도 취소(M4b, 1) · **받는 중이 아니어도 true=끝난 상태에서도 취소 표시를 남김(M4c, 2)** · 훅이 컨트롤러 결과를 안 보고 표시(M4d, 1) · `settled` 표시 안 함(M5, 1) · `ask` 가 안내를 안 지움(M6, 1) · 판 열기가 안내를 정리 안 함(M7, 1) · 안내 줄이 `cancelled` 무시(M8, 2) · `aria-live=off` 제거(M9, 1) · `cancelNoteOnCancel` 항상 seen(M10a, 2)·`cancelNoteOnOpen` 항상 지움(M10b, 2) · 취소가 질의를 비움(M11, 1) · 문구 바꿈(M12, 1) · 취소를 `error` 로 표시(M13, 1) · 안내 우선순위 뒤바꿈(M14, 1). 스크립트 `scratchpad/f056u3/mut.py`.
- 정직한 한계: 훅의 상태 배선(M4d·M6·M7·M11·M13)은 이 프로젝트에 jsdom·react 렌더러가 없어 **해당 콜백 범위로 자른 소스 검사**로 잠근다(REV-191 M-1 방식). 같은 배선의 실제 동작은 아래 브라우저 확인이 본다.

### 브라우저 확인 (헤드리스 Chrome 147 + playwright-core 1.58, 390×892·DSF 2.625·모바일, 개발 서버 `next dev -H 127.0.0.1 -p 3016` ← 전용 미러, QA2 쿠키)
`phrase-help` 응답을 **8초 지연**시킨 채(가로채기), 가짜 STT 게이트웨이(`routeWebSocket`)·`window.fetch` 래퍼(abort 기록)·`MutationObserver`(안내 줄 글자·`aria-live` 시간선)·`requestfailed` 로 관찰. `phrase-help`·`turns`·`text/annotate` 등 비-GET 전부 가로채기 → 서버 도달·DB 쓰기·LLM 0.
| 장면 | 결과 |
|---|---|
| S1 판 열림·로딩 중 PTT | 누른 지 **8ms** 에 요청 abort(`requestfailed net::ERR_ABORTED`, fetch `AbortError`) · 안내 줄 = 새 문구 · 판·질의 「목이 쉬었어요」 유지 · 입력 잠김 · 스켈레톤→예시 칩(idle) · `[role=alert]` 0 · 안내 줄 `aria-live=off` · 손을 떼면 `POST chats/f_t1/turns` 정상 → 250ms 대 판 닫힘 · 다시 열면 질의 유지·안내 지워짐 · 8초 뒤 지연 응답이 와도 상태 불변(요청 총 1건) · 이어서 새 질의 정상(요청 2건째) → 결과 카드 |
| S2 판 닫은 채(요청 살아 있음 — 닫아도 abort 없음) PTT | **5ms** 에 abort · 다시 열면 안내 보임(`aria-live` 없음)·질의 유지·오류 없음 · 한 번 더 열면 지워짐 |
| S3 결과가 이미 보이는 상태 PTT | abort 없음·결과 그대로·안내 줄 빔 |
| S4 글자 모드: 판 열림·로딩 중 [보내기] | **39ms** 에 abort · 회화 턴 POST · 안내 줄에 문구가 나타남(`live=null`) · 보낸 뒤 다시 열면 질의 유지·안내 지워짐 |
| S5 한 글자 인식(너무 짧아 보내지 않음) | 판 유지·안내 보임(읽기 복귀)·입력 풀림·질의 유지·턴 POST 0 → 다시 물어보기 정상·안내 지워짐 |
→ 18/18. 회귀: 앞 소환의 ⑤A 스크립트(`f056u2/g3.mjs`, 녹음 중 판 유지·잠김·보내면 닫힘·짧은 녹음 유지 × 말/역할극 × 마우스/터치) **12/12**. (처음 S5 는 `noFinal` 이라 상태가 RECOGNIZING 에 머문 스크립트 가정 오류로 2 FAIL → 한 글자 최종(`finalText:'あ'`)으로 고쳐 통과 — 코드 문제 아님.) 실패 원인 하나: 처음 개발 서버를 `-H` 없이 띄워 `Blocked cross-origin request to /_next/hmr from 127.0.0.1`(Next 16 `allowedDevOrigins`)로 화면이 안 떠 180초 타임아웃 → `-H 127.0.0.1` 로 재기동.
- 정리: 3016 개발 서버 종료·포트 비움 확인, 쿠키 파일 삭제, 남은 헤드리스 Chrome 0, 방·DB 쓰기 0(가로채기). 전용 미러 `thekaiwa-fix056u3` 는 그대로(`.next`·`next build` 산출).

### 열린 질문 (Leader)
1. **`docs/screens.md`** (내가 문서를 고치지 않음): ① §22-7 문구 표에 `cancelled` 행 없음 — 사양 문장은 `hp-rec` 행·§22-10 에만 있다. ② §22-10 「안내를 지우는 때」는 위 `seen`/`unseen` 해석으로 구현했는데 의도와 다르면 알려 달라(`cancelNoteOnOpen` 한 줄). ③ 호출 시점 문장(「view.state 가 RECORDING 으로 바뀔 때」)을 「마이크를 누를 때(`onPress`) · 모든 턴 시작(`sendOutgoing`)」으로 맞추는 것을 제안. ④ 위 「판 안 모든 버튼 pointerdown」 제안(앞 소환 열린 질문 3)은 그대로 남아 있다.
2. **요청에 없던 추가 1건 — 안내 줄 `aria-live=off`(말하는 동안만)**: 녹음 시작과 함께 뜨는 안내를 스크린리더가 읽으면 그 소리가 마이크에 섞이고, §22-10 「결과 낭독은 녹음이 끝난 뒤로 미룬다(§9-0 ⑨)」 정신과도 어긋나서 속성 하나와 시험 1개를 더했다. 원치 않으면 `PhraseHelperPanel.tsx` 해당 속성과 `phraseHelperCancel.test.ts` 의 「판 안내 줄: 말하는 동안(locked)은 aria-live=off …」 시험을 빼면 된다(다른 곳에 영향 없음). 대신 녹음 중 시각 사용자가 아닌 쪽은 이 안내를 못 듣는다 — 판이 닫히면(보내기) 어차피 의미가 없고, 안 보내고 판이 남으면 글자는 남아 있다. `[추측]` 실제 TalkBack 동작은 실기기 확인 대상.
3. **훅 상태 배선을 진짜 React 로 돌려 보는 시험은 없다**(jsdom·react 렌더러 없음, 위 한계). 신규 의존성(예: `@testing-library/react`+`jsdom`)을 들이면 가능 — 승인 사항이라 하지 않았다.
4. **범위 밖 관찰**: 도우미를 **턴이 진행 중일 때**(생각·선생님 말) 물으면 이번 규칙으로는 취소되지 않는다(턴이 먼저라 도우미가 뒤에서 기다림 — QA-B 의 경합 방향과 반대). 요청대로 하지 않았다.
5. 실기기에서만 볼 것: 온디바이스 STT 플러그인 경로(앱)에서 마이크를 누를 때 같은 `onPress` 를 지나므로 취소는 같다고 보지만 이번 브라우저 확인은 웹(gateway) 경로의 가짜 서버였다. `[가능성 높음]`

### 미커밋 파일 (이번 소환이 만지거나 만든 것)
수정: `src/components/talk/{phraseHelperLogic.ts,usePhraseHelper.ts,helperCopy.ts,PhraseHelperPanel.tsx,TalkRoom.tsx}` · 신규 시험: `src/components/talk/__tests__/phraseHelperCancel.test.ts` · 수정 시험: `src/components/talk/__tests__/phraseHelperRequester.test.ts`. (그 밖 task-056 화면 파일은 앞선 소환 몫이며 모두 미커밋 — 커밋은 Leader 가 pathspec 로.) 기록 파일은 이 파일 하나.

## REV-194 시험 보강 (소스 검사 시험이 주석 처리된 코드를 통과시키던 약점 — 시험만, 앱 소스 변경 0 · developer(화면) · 2026-10-11)

- [착수] **착수**: 근거 [[task-056-rev-ui-record]] 「REV-194 재감사」 F-1·F-2(변이 M5·M11·M15)와 「REV-193 재감사」 F-1. 데모 게이트 `check` → `DEMO_GATE_PASSED` / `task: task-056` approved v1 (이번은 시험 파일만 만져 화면 파일 변경 없음). 전용 미러 `~/.node-local/thekaiwa-fix056t` = 기본 미러 `cp -al` → 그 미러 안에서만 `node_modules/.prisma` 를 `.prisma-old-hardlinked` 로 옮기고 `thekaiwa-predeploy` 에서 실복사(생성 스키마 vs `prisma/schema.prisma` `diff -w` 0, NFS 스키마 md5 `8f493d1b…`), 낡은 `.next` 는 `.next-aside-fix056t` 로 이름만 바꿔 치움(삭제 없음). 기본 미러·predeploy 무변경, 포트 3010~3019 미사용, `git add`·커밋·push 0. 기준선: 대상 6파일 **82/82**.
- [완료 23:00] **완료** — 아래 요지·전수 점검·변이·실행 증빙.

### 원인 한 줄
소스 검사 시험이 원문(또는 **행 맨 앞 `//`·`*` 만 걷는** 정규식 `code()`/`stripComments()`)에서 호출·속성을 찾아서, **JSX 여는 태그 안의 `// onPointerDown={…}`**(컴파일되므로 속성이 빠진 채 빌드됨) · JSX 주석 · 줄 끝/인라인 주석으로 막은 코드가 그대로 통과했다. 같은 정규식이 시험 3파일에 따로 복사돼 있었다(`phraseHelperCancel` `code()` · `phraseHelperRender` `stripComments()` · 인라인 `.replace(/^\s*(\/\/|\*|\/\*).*$/gm,'')` 3곳).

### 변경 파일 (전부 시험 — 앱 소스 0)
| 파일 | 내용 |
|---|---|
| **신규** `src/components/__tests__/sourceCode.ts` | 공용 도구 `commentRanges`·`stripComments(src, fileName)`·`readCode(path)`. **TypeScript 파서**(`typescript` — 이미 devDependency, 신규 의존성 아님)로 토큰 사이 주석 trivia 만 찾아 걷는다 → 한 줄 `//`(줄 전체·줄 끝)·블록 `/* */`(여러 줄·인라인)·JSX 중괄호 주석·여는 태그 안 주석을 모두 걷고, 문자열·템플릿·정규식·JSX 글자(`http://…`)·JSDoc 안의 `//` 는 건드리지 않는다. 주석만 있는 줄은 줄째, 코드 옆은 그 부분만, 양옆이 붙으면 공백 하나(`{/* c */}` → `{ }`) |
| **신규** `src/components/__tests__/sourceCode.test.ts` | 도구 자체 시험 5개: 주석 종류별 제거(원문엔 있고 걷으면 없음·걷은 뒤 주석 0·멱등) / 걷는 모양 / 주석 아닌 슬래시 불변(문자열·템플릿·정규식·JSX 글자·URL 속성·나눗셈) / `.ts` 의 `<T,>`·`<number>` 는 JSX 아님 / **talk·scenario 의 실제 화면 소스 전부(비시험 파일)에서 코드 토큰 열이 원문과 같고 주석 0·길이 감소만** (토큰 동일성 = 도구가 주석 외에는 한 글자도 안 건드린다는 증거) |
| `talk/__tests__/phraseHelperBehavior.test.ts` | `talkSrc` 를 `readCode` 로(파일 맨 위로 옮김, 중복 정의 없음). F-3 「판 안 모든 버튼 keepInputFocus」 가 주석을 걷은 소스에서 `<button` 조각을 자른다 + 같은 시험 파일의 raw `readFileSync` 2곳(✕·Esc 한 길 개수 / `closeHelperToButton`)과 인라인 strip 1곳 정리 |
| `talk/__tests__/phraseHelperCancel.test.ts` | 자체 `code()` 삭제 → `read` 가 `readCode`. **F-2**: `assertUnconditional(callback, call)` 신설 — 콜백 본문 시작부터 호출 직전까지(`before`)에 ① `if/else/switch/case/for/while/do/try/catch/return/throw`·`&&`·`\|\|`·`??`·삼항`?`·`=>`·`helper\|rp .open/shown/typing/ended` 없음 ② 중괄호·괄호 개수 같음(블록·인자·화살표 안에 안 들어 있음) ③ 호출이 한 줄 전체 문장. `onPress` 의 `helper.cancelPending()` 에 적용(옛 「자기 줄에 있다」 정규식은 ③으로 흡수), `sendOutgoing` 의 `cancelHelperRef.current()` 에도 같이 적용(옛 `startsWith` 첫 줄 단언은 그대로 둠) |
| `talk/__tests__/phraseHelperRender.test.ts` | `read` 가 `readCode`; 자체 `stripComments`·인라인 strip 2곳 삭제. **REV-193 F-1(`// helper.close()`)도 같이 닫힘**(onAccepted 조각을 주석 걷은 소스에서 자르므로) |
| `scenario/__tests__/roomRender.test.ts` | 「TalkRoom 삽입 줄은 모두 역할극 조건 안」의 `src` 를 `readCode`(양성 단언 `must` 13개·개수 2개). 음성 단언(`TalkTutorBubble`·`useTalkPlayback`·`VoiceBar` 가 역할극을 모른다)은 **원문 그대로** — 부정 단언은 주석 처리로 우회되지 않고 오히려 원문이 더 엄격 |

### 전수 점검 — 소스를 읽는 단언 (대상: `phraseHelper*.test.ts` 5파일 + `roomRender.test.ts`)
`readFileSync` 로 소스를 읽는 곳은 4파일뿐이다(`phraseHelperLogic`·`phraseHelperRequester` 는 소스를 읽지 않는 동작/순수 시험이라 해당 없음 — grep 확인).
| 위치(수정 후 줄) | 읽는 소스 · 단언 | 판정 |
|---|---|---|
| Behavior 166 `buttonBlocks` + F-3 시험 | PhraseHelperPanel/Card 의 `<button>` 7개 각각 `onPointerDown={keepInputFocus}` | **취약(F-1) → 수정** |
| Behavior 156 · 160 | Panel `<PhraseHelperHead onClose=…/>`·`onKeyDown={closeOnEscape(onClose)}` 각 1개(개수) / Room `onClose={closeHelperToButton}`·정의 | **취약(주석 복사본이 개수·존재를 채움) → 수정** |
| Behavior 242 | Panel `askNow` 정의·`submit`·칩 `onClick`·`[다시 시도]` blur / `h.ask(ex)` 없음(이 줄만 옛 strip) | 약한 strip → 수정 |
| Cancel 164 · 176 · 192 · 205 · 224 | 훅 `cancelPending`/`ask`/`openPanel`/`close` 범위, 방 `onPress`·`sendOutgoing`·최신 함수 동기화 | 옛 `code()` 는 **JSX 중괄호·줄 끝·인라인 주석을 못 걷음** → 공용 도구로 교체. `onPress`(F-2)·`sendOutgoing` 은 `assertUnconditional` 추가 |
| Render 299 (+`accepted` 조각) | TalkRoom 배치 7개 정규식, `onAccepted` 의 `helper.close()` | **취약(REV-193 F-1) → 수정** |
| Render 324 · 338 · 343 | 훅·판·방 연결 정규식(`closeHelperToButton`·`fresh`·`close` 본문·`onFocus/onBlur`·`helperDismissOf`·Esc …) | 주석 걷은 소스로 교체 |
| Render 359 · 362 | `phraseHelperLogic`/훅 `writeStore`·`readStore` 개수 0 / `write('local', HELPER_TIP_KEY, '1')` 존재 | 존재 단언은 취약 → 수정 |
| Render 368 · 377 | 훅 위임(`useState(createHelperRequester)`·`askBlockOf`·`dispose`·`req.start` 모양) / 판 `isImeEnter`·`[물어보기]` `onPointerDown` | 옛 약한 `stripComments` / raw → 수정 |
| Render 450 | `tipShown` 모드 조건·`describedBy`·`<PhraseHelperTip` 개수 1 | **취약(개수·존재) → 수정** |
| Render 350-357 `저장·엔진명` | 도우미 파일 7개에 `localStorage·console·엔진명` 없음 | 부정 단언 — 옛 strip 도 있었음. 공용 도구로 교체(더 정확) |
| roomRender 257-276 | TalkRoom 삽입 13줄 `includes` · `useRolePlay(`/`<PracticeDock ` 개수 1 | **취약 → 수정** |
| roomRender 279 | 3개 부품에 `scenario\|rolePlay\|RolePlay` 없음 | 부정 단언 — **원문 유지(해당 없음)** |
- 단언 의미는 바꾸지 않았다(읽는 소스만 주석 걷은 쪽으로). 새로 더한 것은 `assertUnconditional`(F-2) 하나 + `sendOutgoing` 에 같은 도구 적용. 전부 기존 값으로 통과.
- **이번 범위 밖에서 같은 약점이 의심되는 시험(미변경, Leader 판단)**: `scenario/__tests__/qaP2cAFixes.test.ts:189`(TalkRoom 원문 양성 단언 3개) · `roomFlow.test.ts:270-317`(`read()` 원문 양성 단언 다수, 302행만 정규식 strip) · `resultWiring.test.ts:17,32,92`(원문) · `resultLogic.test.ts:193-200`(원문, 대부분 부정 단언 + `useKeyedResource` 존재) · `variant.test.ts:302`·`variantButtonStable.test.ts:14`·`variantStatusOrder.test.ts:10`·`variantHeldKey.test.ts:42`(자체 정규식 strip — 줄 끝·블록은 걷지만 문자열을 모름). 같은 `readCode` 로 바꾸는 기계적 후속 작업이라 한 task 로 묶을 만하다.

### 변이 (전용 미러 사본에서만 — 임시 파일 + `os.replace`(새 inode, 하드링크 미러 보호) 후 매번 NFS 원본 바이트로 복원, 끝에 전 파일 비교 동일 확인) — 대상 6파일 82개
옛 시험(수정 전 4파일을 같은 미러에 끼움)과 새 시험을 번갈아 돌려 어느 쪽이 잡는지 봤다. 스크립트 `scratchpad/f056t/mut.py`(저장소 밖).
| 변이 | 옛 시험 | 새 시험 |
|---|---|---|
| **M5** 예시 칩 `onPointerDown` 줄 `//` 주석 (REV-194) | 생존 | **사망**(F-3 판 안 모든 버튼) |
| **M15** [물어보기] `onPointerDown` 줄 `//` 주석 (REV-194) | 생존 | **사망**(F-3 + MU5·MU6 시험, 2건) |
| **M11** `onPress` 윗줄 `if (helper.open)` (REV-194 F-2) | 생존 | **사망**(방 onPress) |
| **MU4b** `onAccepted` 의 `// helper.close()` (REV-193 F-1) | 생존 | **사망**(TalkRoom 배치) |
| N1 [다른 말투] `onPointerDown` 줄 `//` | 생존 | **사망**(F-3) |
| N2 ✕ 한 줄 태그 안 인라인 `/* onPointerDown… */` | 사망(요소 트리 시험) | 사망(F-2 ✕ + F-3, 2건) |
| N3 TalkRoom `{/* <RolePlayGoalCard rp={rp} /> */}` (JSX 주석) | 생존 | **사망**(roomRender 삽입 줄) |
| N4 훅 `void 0 /* setPhase('idle') */` (줄 끝 인라인) | 생존 | **사망**(훅 cancelPending) |
| N5 `onPress` 의 호출을 맨 블록 `{ … }` 안으로 | 생존 | **사망**(방 onPress) |
| N6 `sendOutgoing` 첫 줄 `cancelHelperRef.current() && false` | 생존 | **사망**(방 sendOutgoing) |
| N7 `helper.open && helper.cancelPending()` (같은 줄 단락) | 사망(옛 「자기 줄」 정규식) | 사망 |
→ 11건 중 **옛 시험 생존 9 / 새 시험 생존 0**. 기준선(변이 없음)은 옛·새 모두 82/82 통과.

### 실행 증빙 (전용 미러 `~/.node-local/thekaiwa-fix056t`, `KAIWA_LOCAL_ROOT=… bash scripts/sync-local.sh` 후; `diff -rq NFS/src 미러/src` 무차이 확인)
- `eslint src/components/__tests__ src/components/talk/__tests__ src/components/scenario/__tests__/roomRender.test.ts` → **rc 0, 출력 없음**.
- `tsc --noEmit -p .`(미러 전체) → **rc 0, 출력 0바이트**.
- `node --import tsx --test --test-concurrency=4 src/components/__tests__/sourceCode.test.ts src/components/talk/__tests__/phraseHelper*.test.ts src/components/scenario/__tests__/roomRender.test.ts` → **87/87**(수정 전 82 + 도구 시험 5), fail 0·cancelled 0.
- `node --import tsx --test --test-concurrency=4 $(find src/components -name '*.test.ts' | sort)`(talk·scenario 포함 components 전체) → **1,210/1,210**(앞 기록 1,205 + 5), fail 0·cancelled 0·skipped 0, 약 26초.
- 앱 소스 변경 0: `git status` 의 `TalkRoom.tsx`·`VoiceBar.tsx`·`scenarioCopy.ts` 수정은 이번 소환 이전부터 있던 task-056 미커밋분. 이번 소환의 변경은 시험 4개 수정 + 신규 2개뿐. 변이 작업 중 NFS 파일에는 쓰지 않았다(미러 사본만).

### 주의점
- 도구는 파서 기반이라 시험 파일 하나가 `typescript` 모듈(약 수백 ms 적재)을 불러온다 — 시험 파일이 프로세스 단위라 5개 파일이 각각 적재. components 전체 26초 안에서 체감 차이 없음.
- `stripComments` 는 코드 토큰을 안 바꾸지만 **공백/줄은 바꾼다**(주석 줄 삭제, `{/* */}` → `{ }`). 단언은 `\s*`·`indexOf` 위주라 영향 없었다. 새 소스 검사 단언을 쓸 때 **공백 정확 일치**(`'a\n  b'` 식)는 피하고 `\s*` 로 쓸 것.
- 이 보강으로도 막지 못하는 것: 주석이 아닌 우회(예: 속성을 다른 요소로 옮기기, 죽은 분기 안의 호출). 소스 모양 검사의 한계이며, 훅 상태 배선을 진짜 React 로 돌려 보는 시험은 여전히 없다(REV-194 열린 질문 3 — `@testing-library/react`+`jsdom` 도입은 승인 사항).

### 미커밋 파일 (이번 소환이 만지거나 만든 것)
신규: `src/components/__tests__/sourceCode.ts` · `src/components/__tests__/sourceCode.test.ts`. 수정: `src/components/talk/__tests__/{phraseHelperBehavior,phraseHelperCancel,phraseHelperRender}.test.ts` · `src/components/scenario/__tests__/roomRender.test.ts`. (task-056 의 나머지 화면·서버 파일은 앞선 소환 몫이며 미커밋 — 커밋은 Leader 가 pathspec 로. 기록 파일은 이 파일 하나.)

## 생각 중 도우미 잠금 (QUEUED·THINKING — 사용자 결정 2026-10-11, QA-B2 재측정 · developer(화면, sonnet) · 2026-10-11)

- [착수 23:25] 근거: 도우미와 회화 턴이 같은 AI 호출 줄(동시 1건)을 쓴다 — 턴을 보낸 직후 약 1초 안에 도우미를 부르면 턴 첫 음성이 p50 2.42→5.83초(5초 예산 초과). 사양 = `docs/screens.md` §22-6 잠김 행(열 수 있는 상태는 IDLE·SPEAKING 뿐)·§22-7 `lockedTurn`(Leader 반영본, 읽기만). 데모 게이트 `check` → `DEMO_GATE_PASSED` / `task: task-056` approved v1 (의미가 바뀌지 않는 작은 보완 — 판 모양 불변, 토스트 문구 한 줄 추가).
- 전용 미러 `~/.node-local/thekaiwa-fix056v` = 기본 미러 `cp -al` → 그 미러 안에서만 `node_modules/.prisma` 를 `.prisma-old-hardlinked` 로 옮기고 `thekaiwa-predeploy` 에서 실복사(생성 스키마 vs `prisma/schema.prisma` `diff -w` 0, NFS 스키마 md5 `8f493d1b…`), 하드링크 공유 inode 를 in-place 로 쓰는 `tsconfig.tsbuildinfo`·`next-env.d.ts` 는 실복사로 끊고, 낡은 `.next` 는 `.next-aside-fix056v` 로 이름만 바꿔 치움. 기본 미러·predeploy 무변경.

### 구현 요지 (화면만 — 서버·`src/types/chat.ts`·`scenario/**`·`docs/**` 무변경)
- `phraseHelperLogic.ts`: 이유를 구분하는 순수 함수 `helperLockReason(talkState): 'voice' | 'turn' | null`(RECORDING·RECOGNIZING = voice, QUEUED·THINKING = turn, IDLE·SPEAKING = null) 추가. `helperLocked` 는 `helperLockReason(...) !== null` 로 다시 정의(시그니처 불변 — 기존 호출·import 안 깨짐, 주석 「생각·대기·선생님 말 중에는 열 수 있다」 삭제). 토스트 문구 선택 `helperLockToast(reason)`(`turn` → `HELPER.lockedTurn`, 그 밖 → 기존 `HELPER.locked`).
- `helperCopy.ts`: `lockedTurn: '선생님이 답하는 중에는 열 수 없어요'`(§22-7 문구 그대로).
- `TalkRoom.tsx`: `const helperLockWhy = helperLockReason(view.state)` · `const helperLock = helperLockWhy !== null`(이유 하나가 근거 — 이 값이 훅 `recording`·판 `locked`·버튼 `locked`·안내 말풍선 숨김에 그대로 쓰인다 = 기존 `recording: helperLock` 경로 재사용) · 버튼 `onLocked={() => notify(helperLockToast(helperLockWhy))}`. 방이 더는 `HELPER` 를 안 써서 import 제거. 렌더 중에는 `view.state`(문자열)만 순수 함수에 넘긴다(훅 반환 값을 import 함수에 넘기지 않음 — `react-hooks/purity` 오류 없음).
- 그대로: `cancelPending`(마이크 누름·모든 턴 시작), 판 표시 조건(`helper.shown` — 잠김은 판 안 입력·버튼만 막는다), `PracticeDock`·`scenario/**`. 안내 말풍선은 이미 `!helperLock` 이라 THINKING 동안 숨는다(확인).
- 주석만 고친 파일(동작 0): `usePhraseHelper.ts`(`recording` 의미)·`PhraseHelperButton.tsx`·`PhraseHelperPanel.tsx`·`PhraseHelperCard.tsx`(「녹음·인식 중」→ 잠긴 상태).

### 바뀐 기존 시험과 사유 (의도 변경 — 사용자 결정 2026-10-11, QA-B2)
| 시험 | 예전 단언 | 지금 | 사유 |
|---|---|---|---|
| `phraseHelperLogic.test.ts` 「helperLocked …」 | 녹음·인식만 true, `IDLE·QUEUED·THINKING·SPEAKING` false | 삭제 후 `helperLockReason·helperLocked`(6상태 전수, `Record<TalkState,…>` 라 상태가 늘면 타입 오류) + `helperLockToast` 로 교체 | 열 수 있는 상태가 IDLE·SPEAKING 뿐으로 바뀜 |
| `phraseHelperBehavior.test.ts` F-1 「판 표시」 | `['IDLE','QUEUED','THINKING','SPEAKING']` 잠기지 않음 | QUEUED·THINKING 잠김(판은 그대로 그려짐) / IDLE·SPEAKING 열림 | 같음 |
| 같은 파일 F-1 시나리오 | 보냄(accepted) 뒤 `[shown, locked] = [false, false]` | `[false, true]`(THINKING 동안 계속 잠김) + SPEAKING 에서 풀림 한 줄 추가 | 같음 — 예전엔 accepted 에서 풀렸다 |
| `phraseHelperRender.test.ts` TalkRoom 배치 | `onLocked={() => notify(HELPER.locked)}` | `onLocked={() => notify(helperLockToast(helperLockWhy))}` | 이유별 토스트 |

### 신규 시험 — `talk/__tests__/phraseHelperTurnLock.test.ts` 7개 + `phraseHelperLogic.test.ts` +1(교체 포함)
실제 입력(`deriveTalkState`) 16행 → 상태·열림/잠김·토스트(판단 순서: 말하는 중 > 보내기 대기 > 선생님 말 > 생각; 재생+스트림 동시는 SPEAKING = 열림; 소리 준비 waiting 은 THINKING = 잠김) · `lockedTurn` 정확한 문구·엔진명 없음 · 잠긴 상태의 `askBlockOf` · 버튼(`PhraseHelperButton` 을 직접 호출해 `onClick` 실행: 열림 상태는 `onToggle`, 잠긴 네 상태는 `onLocked` 만·`aria-disabled`·`opacity-40`·`disabled` 속성 없음) · TalkRoom 소스(`readCode`, 버튼/훅/판 호출 범위만 잘라 `locked=`·`recording:`·`onLocked`·`helperLockToast`·`!helperLock` 확인, `helperLocked`·`notify(HELPER.` 가 방에 없음) · 취소 경로가 잠김에 기대지 않음.

### 실행 증빙 (전용 미러 `~/.node-local/thekaiwa-fix056v`, `KAIWA_LOCAL_ROOT=… bash scripts/sync-local.sh` 후 `diff -rq NFS/src 미러/src` 무차이)
- `eslint src/components/talk src/components/__tests__ src/components/scenario/__tests__/roomRender.test.ts` → **rc 0, 출력 없음**.
- `tsc --noEmit -p .` → **rc 0, 출력 0바이트**(17.6초).
- `node --import tsx --test --test-concurrency=4 src/components/talk/__tests__/phraseHelper*.test.ts src/components/__tests__/sourceCode.test.ts` → **85/85**(fail 0·cancelled 0·skipped 0).
- `node --import tsx --test --test-concurrency=4 $(find src/components -name '*.test.ts' | sort)`(talk·scenario 포함 components 전체) → **1,257/1,257**, 21초.
- `next build`(`node node_modules/next/dist/bin/next build`, 출력은 파일) → **rc 0**, CSS 경고 0. (첫 시도는 rc 1 — 아래 「주의점」 Tailwind 스캔.)

### 변이 (미러 사본에서만 — 임시 파일 + `os.replace`(새 inode, 하드링크 미러 보호) 후 매번 NFS 원본 바이트로 복원, 끝에 `RESTORE_DIFF []`·`diff -rq` 무차이) — 대상 7개 시험 파일 85개, 스크립트 `scratchpad/f056v/mut.py`(저장소 밖)
**14건 모두 사망(생존 0)**: M1 THINKING 만 해제(7건 실패) · M2 QUEUED 만 해제(6건) · M3a 이유 구분 제거(logic, 3건) · M3b 이유 구분 제거(TalkRoom `helperLockToast('voice')`, 2건) · M4 `lockedTurn` 오타 「열수」(2건) · **M5 주석 처리: turn 잠금 줄을 `//`(7건)** · **M5b 주석 처리: 버튼 `onLocked` 속성을 JSX 여는 태그 안에서 `//`(2건)** · M6 훅 `recording` 을 voice 만으로(1건) · M7 버튼 `locked` voice 만(1건) · M8 판 `locked` voice 만(2건) · M9 안내 말풍선 `!helperLock` 제거(2건) · M10 `helperLocked` voice 만(6건) · M11 SPEAKING 과잠금(6건) · M12 `onPress` 취소가 잠김에 기댐(2건) · M13 버튼에 `disabled` 속성(2건).

### 브라우저 확인 (헤드리스 Chrome 147 + playwright-core, 390×892·DSF 2.625·모바일·터치, 개발 서버 `next dev -H 127.0.0.1 -p 3017` ← 전용 미러, QA2 쿠키) — **17/17 통과**
스크립트 `scratchpad/f056v/{lib.mjs,lock.mjs}`(저장소 밖; 앞선 소환의 `f056u2/lib.mjs` 에 턴 응답 지연 `delayMs` 한 곳 추가). `phrase-help`·`turns`·`text/annotate`·`reply-practice`·chat GET 전부 가로채기 → 서버 도달·DB 쓰기·LLM 0, 가짜 STT 게이트웨이(`page.routeWebSocket`). 회화 턴 POST 응답을 4.5초 지연시켜 THINKING 유지.
- **일반 방·역할극 방 각각**: 대기(IDLE) 버튼 안 잠김 → 마이크로 보낸 직후 `data-talk-state=THINKING`: 버튼 `aria-disabled="true"`·`opacity-40`·`disabled` 속성 없음 → 탭: **판 안 열림 + 토스트 「선생님이 답하는 중에는 열 수 없어요」**(말하는 중 문구 아님) → 턴이 끝나 IDLE: 잠김 풀림 → 탭: 판 열림.
- **판이 열린 채 THINKING(드문 경우)**: 결과가 보이는 열린 판에서 보냄 → 판 유지·입력 `disabled`·▶·[물어보기]·도우미 버튼 `aria-disabled="true"` → 도우미 버튼 탭: 판 그대로 + 같은 토스트 → accepted 에서 판 닫힘(기존 규칙) → 끝난 뒤 탭: 마지막 답 기억한 채 다시 열림.
- **말하는 중 토스트 그대로**: 녹음 중 탭 → 지금은 안 보이고(§9-0 ⑨ 미룸) 놓은 뒤 「말하는 중에는 열 수 없어요」.
- 하네스 관찰: Playwright 는 `aria-disabled="true"` 를 「비활성」으로 보고 풀릴 때까지 기다린다(첫 실행은 이 때문에 턴이 끝난 뒤 탭이 눌려 A2 가 실패 — `tap({ force: true })` 로 실제 사용자 탭을 흉내냈다). 앱 결함 아님.
- 정리: 3017 개발 서버 종료·포트 3016~3019 비움 확인, QA2 쿠키 파일 삭제, 헤드리스 Chrome 잔여 0, 방·DB 쓰기 0(응답 가로채기 — 쿠키 발급 도구가 이미 있는 QA2 행을 upsert 만 함).

### 주의점 (재발 가능 문제)
- **Tailwind v4 는 프로젝트 루트를 통째로 스캔한다** — 전용 미러 안에 옛 `.next`(바이너리 청크)를 이름만 바꿔 두면(`.next-aside-*`) `next build` 가 `Found 23 warnings while optimizing generated CSS` 뒤 `Failed to compile`(rc 1, `turbopack-node/transforms/postcss.ts`)로 죽는다. 치울 곳은 **미러 루트 밖**(`~/.node-local/thekaiwa-fix056v-aside/`, 이름만 변경·삭제 없음)이어야 한다. 앞선 소환 기록의 「`.next-aside-*` 로 이름만 바꿔 치움」 방식은 빌드를 돌리지 않는 경우에만 안전하다.
- `cp -al` 미러는 `rsync` 가 안 건드린 파일의 inode 를 기본 미러와 공유한다 — 변이·편집은 항상 새 inode(`os.replace`), 컴파일러가 in-place 로 쓰는 `tsconfig.tsbuildinfo`·`next-env.d.ts` 는 실복사로 끊었다.
- scratchpad 의 `eslint.log`·`tsc.log`·`t1.log`·`tall.log`·`sync.log` 는 이 소환이 같은 이름으로 덮어썼다(앞선 소환의 동명 로그가 있었다면 내용이 바뀜 — 산출물 아님, 기록은 이 파일이 정본).

### 열린 질문 (Leader)
1. **`docs/screens.md`** (내가 고치지 않음): ① **낡은 문장이 남아 있다 `[확실]`(grep 확인)** — `docs/screens.md` 9852행 「THINKING·QUEUED·SPEAKING 에는 잠기지 않는다 — 도우미는 턴과 따로 부르는 요청이다」는 바로 위 9849행 잠김 행과 정면으로 모순(THINKING·QUEUED 는 이제 잠김, SPEAKING 만 열림)이고, 10083행 열린 질문 「A. 턴 진행 중 호출 — 화면은 막지 않는 것을 가정 … 버튼 잠김 구간은 바꾸지 않는다」도 이번 결정(막기로 함, `busy` 409 가 아니라 화면 잠금)으로 닫혀야 한다. §22-14 확인표에는 THINKING 잠김 행(H5 옆 `H5b`)이 없다 — 위 브라우저 확인 A·B 가 후보 체크 항목. ② 토스트 문구는 **누른 때의 이유**로 정해진다: 녹음 중에 눌러서 미뤄진 토스트(§9-0 ⑨)가 놓은 뒤(RECOGNIZING·THINKING)에 떠도 「말하는 중에는 열 수 없어요」다(브라우저 C2 에서 확인) — 의도와 다르면 알려 달라(`notify` 인자를 지연 시점에 다시 계산하는 큰 변경이라 지금은 안 했다).
2. **SPEAKING 허용의 틈 `[추측]`**: `deriveTalkState` 판정 순서상 `playbackPhase==='playing'` 이 `turnPhase streaming` 보다 위라, 첫 청크가 재생되는 동안 SSE 가 아직 열려 있어도 SPEAKING = 열림이다. 서버가 AI 호출을 `done` 앞에서 끝낸다는 전제(사양 문장 「AI 호출이 이미 끝났으니」)에 기댄 결정이라 코드로는 막지 않았다. 턴 뒤에 서버가 AI 호출을 더 한다면(교정 분석 등) 그 구간은 도우미와 줄을 같이 쓸 수 있으나, 첫 음성 지연(5초 예산)에는 영향이 없다.
3. **THINKING 중 선생님 소리가 나오기 전 구간(`waiting`)**: 상태는 THINKING = 잠김이다(위 표). 소리 합성은 M4 TTS 라 AI 호출 줄과 무관하지만, 상태 유도를 건드리지 않고 사양대로 따랐다.
4. **재QA 항목(브라우저로 못 한 것)**: SPEAKING 상태의 실제 열림(헤드리스에서 TTS 가 503 으로 가로채져 재생 상태를 못 만듦 — 단위 시험은 `deriveTalkState(playing)` 입력으로 확인) · 실기기(TalkBack 에서 잠긴 버튼 낭독 「…사용 불가」 + 토스트) · 앱 WebView 온디바이스 STT 경로(같은 `onPress`→`sendOutgoing`) `[가능성 높음]`.
5. 훅 상태 배선(`recording` 으로 [물어보기] 막힘·낭독 미룸)을 진짜 React 로 돌려 보는 시험은 여전히 없다(앞 소환 열린 질문 3과 같음) — 이번엔 소스 검사 + 순수 함수 조합 + 브라우저(B1: 입력 disabled·▶·[물어보기] aria-disabled)로 덮었다.

### 미커밋 파일 (이번 소환이 만지거나 만든 것)
수정: `src/components/talk/{helperCopy.ts,phraseHelperLogic.ts,TalkRoom.tsx,usePhraseHelper.ts,PhraseHelperButton.tsx,PhraseHelperPanel.tsx,PhraseHelperCard.tsx}` · 시험 수정: `src/components/talk/__tests__/{phraseHelperLogic,phraseHelperBehavior,phraseHelperRender}.test.ts` · 시험 신규: `src/components/talk/__tests__/phraseHelperTurnLock.test.ts`. (task-056 의 나머지 화면·서버 파일은 앞선 소환 몫이며 모두 미커밋 — 커밋은 Leader 가 pathspec 로. 기록 파일은 이 파일 하나, 맨 아래 이 절만 추가.) 네이티브 변경 없음.
