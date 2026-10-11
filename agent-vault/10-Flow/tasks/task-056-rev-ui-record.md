---
project: TheKaiwa
task: task-056
type: reviewer-record
tags:
  - type/review
  - domain/conversation
  - domain/improvement
aliases:
  - REV-191
  - task-056 reviewer(화면) 기록
created: 2026-10-11
updated: 2026-10-11
---
# task-056 Reviewer(화면) 기록 (REV-191)

> 대상: 회화방 일본어 도우미 화면(IMP-0030) — 새 `talk/{PhraseHelperButton,PhraseHelperCard,PhraseHelperPanel,PhraseHelperTip}.tsx`·`usePhraseHelper.ts`·`phraseHelperLogic.ts`·`helperCopy.ts`·`types/phraseHelp.ts`·시험 2개 / 수정 `TalkRoom.tsx`·`VoiceBar.tsx`·`scenarioCopy.ts`·라이브 시험 문자열 3개. 서버(#180)는 REV-190([[task-056-rev-server-record]]).
> 이 기록은 Read 전용 감사다. 전용 미러 `~/.node-local/thekaiwa-rev056u`(기본 미러·`thekaiwa-predeploy` 무변경, `.prisma` 만 predeploy 에서 복사).

## 중간 기록 (약 45턴 시점 — 최종 판정 때 이어서 완성)

### 확인 끝난 것
- 정본 대조: 이력서(확정 ①~⑦·Leader 결정 7항)·designer 기록·`docs/screens.md` §22-0~22-15·승인 데모 상태(`rp-helper`·`rp-practice` 문장과 데모 JS 417~771행)·dev-ui 기록·pe-record §2·§4.
- 소스 정독: 새 9개 파일 전부 + `TalkRoom.tsx` 도우미 hunk 전부(+132/−30) + `VoiceBar.tsx`·`scenarioCopy.ts` diff + 라이브 시험 3개 diff(각 4곳, 옛 부제 → 새 부제 문자열만 바뀜, `git diff --stat` 8줄씩).
- 재현: 전용 미러 `tsc --noEmit -p .` **rc=0** · `eslint`(talk·scenario·types·라이브 시험 3) **rc=0 출력 없음** · talk+scenario 시험 **230/230**.
- 직접 재현 1: HEAD `VoiceBar` 와 새 `VoiceBar`(`trailing` undefined·null) 정적 렌더 6변형(IDLE·SPEAKING+■·RECORDING db-30/null·RECOGNIZING·THINKING) **바이트 동일**(임시 시험 `rev191-voicebar.test.ts`, 미러에서만).
- 직접 재현 2: 변이 10건(미러 사본, 원복 `cmp` 확인) — 아래 표.

### 변이 재현 (phraseHelper 시험 35개 대상)
| # | 변이 | 결과 |
|---|---|---|
| MU1 | `usePhraseHelper.ask` 요청 중 재요청 허용(`pending:false`) | **생존** |
| MU2 | 언마운트 때 `ac.abort()` 제거 | **생존** |
| MU3 | `settleHelper` 의 늦은 응답 버림(`live()` 검사) 제거 | 잡힘 |
| MU4 | `TalkRoom` `onAccepted` 의 `helper.close()` 제거 | **생존** (시험 정규식이 뒤쪽 다른 `helper.close()` 에 걸림 — 공허) |
| MU5 | 한글 IME 조합 중 Enter 방지 제거 | **생존** |
| MU6 | [물어보기] `onPointerDown preventDefault` 제거 | **생존** |
| MU7 | 카드 ▶ 녹음 중 잠금(`if (!locked)`) 제거 | **생존** |
| MU8 | 화면 총 상한 12s → 120s | 잡힘 |
| MU9 | 409 `PHRASE_BUSY` 를 `ended` 로 처리 | 잡힘 |
| MU10 | 글자 모드 입력 중 Composer 숨김(`hidden`) 제거 | 잡힘 |

### 발견 (임시)
- (Medium) 시험 공허: `phraseHelperRender.test.ts` 의 「onAccepted 에서 닫음」 정규식 `/queue\.startTurn\(aid\)\s*pauseStatus\(true\)[^]*?helper\.close\(\)/` 의 게으른 `[^]*?` 가 파일 뒤쪽 `toggleHelper`·`onFill` 의 `helper.close()` 에 걸려 MU4 가 살아남는다. 동작 자체는 맞다.
- (Medium) 훅 상태 기계(요청 1건·타이머·언마운트 취소·늦은 응답 무시의 배선)는 실행되는 시험이 없다 — `settleHelper` 순수 함수만 잠겨 있고 `usePhraseHelper`·`TalkRoom` 상호작용은 정적 렌더 + 소스 정규식뿐(MU1·MU2·MU5·MU6·MU7 생존).
- 확인 대기: 입력 초점 중 판 안 다른 버튼의 첫 탭이 「바 재등장 → 판 이동」으로 먹히는지(실기기), 앱 WebView 키보드.

(최종 판정은 이 블록 아래에 이어서 씀)

## REV-191 최종 판정 (신규 소환 2회차 · 2026-10-11 · Read 전용, 앞선 중간 기록 이어서 완성)

**판정: PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 2(둘 다 시험 보강) · Low 4 · Info 2. QA 진행 가능(차단 없음). 아래 Medium 은 동작 결함이 아니라 **회귀 방어가 비어 있는 곳**이고, Low 는 실기기 확인이 필요한 곳이다.

### 이번 소환에서 확인한 것 (앞선 소환과 겹치지 않음)
- **원문 미보관 [확실]**: 새 파일 전부 + `TalkRoom.tsx` 도우미 hunk 에서 `localStorage|sessionStorage|document.cookie|console.|location|history|router|URLSearchParams` 0건. 저장소 접근은 `phraseHelperLogic.claimHelperTip()` 의 `readStore/writeStore('local','kaiwa.talk.helperTipSeen','1')` 뿐이고 `usePhraseHelper.ts` 는 `readStore|writeStore` 를 import 하지 않는다. 질의·결과는 훅 메모리(`useState`)만. 소리는 `useKeyedSound` 에 `helper:{index}` 키와 `ja` 문장만 넘김(저장소 사용 0). 안내 플래그: 보이는 순간 쓰고 다시 읽어 `'1'` 이어야 보인다 — 저장 막힌 환경은 한 번도 안 보임(설계대로), 말 모드 입력 바가 처음 그려질 때 방(마운트)마다 1회 판정, 글자 모드면 말 모드로 바꿀 때까지 보류, 같은 브라우저 프로필·앱 설치 단위 1회.
- **경계·계약 [확실]**: 도우미 클라이언트 파일에 `@/modules/*`·`@/app/*` import 0(타입은 `src/types/phraseHelp.ts` 복제), `fetch(`·`Capacitor`·`spawn` 0, 요청은 `apiPost('/api/v1/chats/${encodeURIComponent(chatId)}/phrase-help', {queryKo})`(선례 헬퍼, `signal` 전달), 엔진·모델명 0(코드·문구·`aria-*`, 시험이 이중 잠금). `Skeleton` 은 `PracticeDock`·`ScenarioHome` 등 선례와 같은 `challenge/parts` import. 오류 매핑을 `helperFailureOf` 와 pe-record §4 대조 — 400 `VALIDATION`→안내 줄(서버 message) · 404/0/5xx/기타→error · 409 `ENDED`·`ROLEPLAY_ENDED`→ended · 409 `PHRASE_BUSY`→error(designer 지정 `hp-error`) · 409 `TURN_RUNNING`→busy(서버는 안 냄, 선택 분기) · 429→rate(`details.retryAfterSec`→`Retry-After`→10초) · 504 또는 화면 12초→timeout · 5초 `slow`. **409 `CONFLICT {reason:'CANCELLED'}` 는 일반 오류(+[다시 시도])로 읽힌다 — 비치명** (서버가 `req.signal` 로만 내므로 화면이 이미 끊은 뒤라 정상 경로에선 화면이 응답을 읽지 않는다).
- **범위 이탈 없음 [확실]**: `TalkRoom.tsx` hunk 10개(import 3 · 말 보내면 닫기 · `onPress` 소리 정지 · 훅 블록 · 토글/버튼 · 판↔`PracticeDock` 교체 · 입력 바 래핑 3) 전부 도우미 관련. `PracticeDock.tsx`·`useRolePlay.ts`·`usePractice.ts`·`src/types/chat.ts` 변경 없음(`git status`/`git diff --stat` 로 확인 — `chat.ts` 는 HEAD 와 동일), `scenarioCopy.ts` 는 `PRACTICE.entrySub` 한 줄(⑦A). `PracticeDock` 상태는 `useRolePlay`(방 수준) 에 있어 도우미 열림 동안 언마운트돼도 잃는 값은 `wrong/right/hint` 지역값뿐이고 도우미를 여는 순간 `closePractice` 로 접히므로 동작 변화 없음. `conversation/index.ts` +7줄은 서버 export(UI 아님).
- **승인 대조 ①~⑦ [확실]**: ① 입력 바 위 판(`PracticeDock` 과 한 자리·동시에 안 그림) ② 첫 카드만 + 「다른 말투 n개 더 보기」(`<ul hidden={!more}>` 늘 마운트, Tailwind v4 preflight `[hidden]{display:none!important}` 가 `flex` 를 이김) ③ `whyKo` 줄(없으면 칸 생략) ④ 둥근 아이콘 44px + 1회 안내(`role=note`, 버튼 `aria-describedby`) ⑤ 녹음 중 판 유지·입력 `disabled`·버튼 `aria-disabled`, 보내면 `queue.startTurn` 직후 `helper.close()` ⑥ 한국어 뜻 줄 번역 스위치와 무관하게 항상 ⑦ 부제 문구만. 데모 게이트 `check` 재실행 `DEMO_GATE_PASSED`(v1 approved·hash verified), `evidence.jsonl` 34행은 `kind:approve`·`prompt_ts` 가 17초 앞선 사용자 발화와 맞고 `waive` 흔적·`.claude/state/demo-gate` 직접 편집 흔적 없음.
- **접근성·모바일 [확실, 코드]**: 버튼 `aria-label="일본어 도우미"`+`aria-expanded`+`aria-controls`(열렸을 때만), 입력 `aria-describedby=talk-helper-msg`, `role=status` 두 줄(안내·낭독)이 판 마운트 시 빈 채로 먼저 생기고 이후 채워짐, 오류·시간 초과만 `role=alert` 새로 그림, 일본어 17px(`rt` 11)·입력 16px, 터치: 버튼·✕·카드 ▶·[다른 말투]·[입력창에 넣기]·[다시 시도]·[물어보기] 모두 `h-11`/`w-11`, 푸시투토크 72px 칸 불변, 토큰만 사용(`bg-surface/border-line/text-ink/text-bad/bg-accent`, 안내 말풍선은 `bg-ink text-surface` 반전)이라 다크 자동 대응. 안내 위치 산술 확인: 가운데 칸 `W−32−88`, 양옆 `(W−192)/2`, 도우미는 오른쪽 칸 왼쪽 끝 +12px·폭 44 → 바 오른쪽 끝에서 오른쪽 가장자리까지 `(W−192)/2+4` — `PhraseHelperTip` 식과 일치(360 에서 양옆 84px ≥ 56 이라 겹침 없음).
- **dev 가 보고한 가이드 이탈 4건 판정**: ① `trailing` 없을 때 `flex justify-center` 유지 — **타당**(앞선 소환의 바이트 동일 재현이 근거). ② 빈 결과 상자에 `role=status` 없음 — **타당, 문서 쪽 오류**: 가이드 §22-6 `hp-none` 행(role=status 상자)이 §22-10·§22-13(상태가 바뀔 때 live region 새로 마운트 금지)과 모순이고, 새로 그린 live region 은 낭독이 불확실해 늘 마운트된 sr 줄(`helperAnnounceOf`→`HELPER.none`)이 읽는 구현이 맞다 → `docs/screens.md` §22-6 `hp-none` 행의 「`role=status` 상자」 문구를 「일반 상자 + 늘 마운트 sr 줄이 낭독」으로 고치라고 Leader/designer 에 권고(문서 정정, 코드 변경 없음). ③ 소리 실패 한 줄을 `<li>` 안 맨 아래 — **타당**: 가이드 트리는 `</li>` 뒤에 `<p>` 를 둬 `<ul>` 직계 `<p>` 가 되어 무효 HTML 이다. ④ 429 첫 틱 전 「잠시 뒤」 한 프레임 — **허용**(`useCountdown` 이 첫 렌더에 `null` 을 돌려줌). 단 L-4 참조.

### 발견 사항
| # | 심각도 | 위치 | 내용 · 근거 · 권고 |
|---|---|---|---|
| M-1 | Medium (시험 부채) | `talk/__tests__/phraseHelperRender.test.ts:302` | 「onAccepted 에서 닫음」 정규식 `/queue\.startTurn\(aid\)\s*pauseStatus\(true\)[^]*?helper\.close\(\)/` 의 게으른 `[^]*?` 가 파일 뒤쪽 `toggleHelper`(`TalkRoom.tsx:1106`)·`onFill`(`:1168`)의 `helper.close()` 에 걸려 **변이 MU4(보내도 판 안 닫힘, ⑤A 위반)가 생존**. 현재 동작은 맞다(`TalkRoom.tsx:386` `helper.close()`). 권고: 해당 콜백만 잘라서 단언 — `const body = src.slice(src.indexOf('queue.startTurn(aid)'), src.indexOf('onAudio:'))` 뒤 `assert.match(body, /helper\.close\(\)/)`. 근본 해결은 M-2. |
| M-2 | Medium (시험 부채) | `usePhraseHelper.ts:134-170`·`:85-94`, `PhraseHelperPanel.tsx:245-258`, `PhraseHelperCard.tsx:99-102` | **훅·핸들러 수명주기를 실행하는 시험이 없다** — 변이 MU1·MU2·MU5·MU6·MU7 생존(상세 아래 §생존 변이 판정). `settleHelper`(순수)만 잠겨 있어서 「요청 1건 · 타이머 정리 · 언마운트 취소 · 늦은 응답 무시의 배선」은 소스 정규식 수준. 권고는 아래 §시험 보강 권고. |
| L-1 | Low (실기기) | `PhraseHelperPanel.tsx:249-250`+`TalkRoom.tsx:1180`(`helper.typing ? null : <VoiceBar>`) | 입력칸 초점 중 판 안 **다른 버튼**(예시 칩·카드 ▶·[다른 말투]·[다시 시도])의 첫 탭이 소실될 수 있다 — 탭 시작(pointerdown)에 입력 `blur`→`typing=false`→VoiceBar 재등장으로 판이 위로 밀려 pointerup 이 다른 요소에 닿는다. [물어보기]만 `onPointerDown preventDefault` 로 보호됨. `:root[data-kb]` 가 있는 브라우저에서는 본문이 숨어 거의 안 보이지만 **`data-kb` 없는 앱 WebView 는 본문이 그대로 보이므로** 거기서 재현 가능 [가능성 높음, 코드 추론 — 실기기 미확인]. 권고(수정 아님): 판 안 버튼에도 입력 초점 중엔 `onPointerDown={e => e.preventDefault()}`(초점 유지)를 주거나, `typing=false` 를 한 프레임 미뤄 레이아웃 이동을 click 뒤로 보낸다. QA 실기기 확인 항목. |
| L-2 | Low | `useRolePlay.ts:100`→`logic.ts:938` `reloadRolePlay`, `TalkRoom.tsx:775` | 409 `ENDED` 가 오는데 **`chat.scenario` 가 null** 인 방(역할극을 마친 뒤 상황이 삭제돼 `Chat.scenarioId` 가 SetNull — 스키마 `prisma/schema.prisma:723`, 서버는 `chat.endedAt` 만으로 ENDED 판정 `phraseHelp.ts:98`)에서는 `reloadRolePlay` 가 `if (r.chat.scenario) set(...)` 이라 **아무것도 안 바뀐다** → 판만 조용히 닫히고 방은 마친 방으로 안 바뀌며, 다시 열어 물으면 같은 일이 반복된다(dev 추측 **확인됨 [확실, 코드]**). 같은 한계가 기존 대답 연습(`practiceLogic.ts:98`)·턴(409 `ROLEPLAY_ENDED`)에도 이미 있어 이 task 가 새로 만든 결함은 아니다(서버 409 는 REV-190 이 의도된 동작으로 판정). 권고: `onEnded` 에서 다시 읽기 뒤에도 안 바뀌면 토스트 한 줄(「이미 마친 대화예요」류)을 띄우거나 별도 개선 항목(IMP)으로 분리. |
| L-3 | Low (디자인·접근성 계약) | `PhraseHelperPanel.tsx:118` | 예시 칩의 **히트 44px 가 실제로는 36px**. 칩이 `truncate`(=`overflow:hidden`)와 `relative before:absolute before:-inset-y-1` 을 같은 요소에 가져서 확장 히트 영역이 잘린다. **Chromium 합성 HTML 실측 [확실]**: `overflow:hidden` 칩은 위·아래 2px 지점의 `elementFromPoint` 가 `BODY`, 대조군(overflow 없음)은 버튼 자신. 승인 데모 CSS(`task-056-talk-phrase-helper-v1.html:263` `.chip{overflow:hidden…}` + `:264` `::before{top:-4px;bottom:-4px}`)도 같은 구조라 **구현은 승인본과 동일** — 가이드 §22-11·§22-14 H2 의 「칩 히트 44」 주장이 틀린 것. material 이탈 아님. 권고(디자인 판단은 designer): `truncate` 를 안쪽 `<span className="block truncate">` 로 옮기고 `before:` 는 바깥 버튼에 둔다. 칩이 가로로 붙지 않고 세로 gap 6px 이라 세로 확장은 이웃 칩과 겹치지 않는다. |
| L-4 | Low | `usePhraseHelper.ts:123-127`+`common/useNow.ts:25-41` | `useCountdown` 의 `now` 가 마지막 틱 값을 유지해서, **두 번째** 429 에서는 새 `rateUntil` 과 오래된 `now` 로 계산한 큰 초(예: 수백 초)가 한 프레임 보일 수 있다(첫 번째 429 는 `now===0`→`null`→「잠시 뒤」). 낭독은 `helperAnnounceOf` 의 서버 초라 정확하다. 기존 공용 훅의 성질이고 시각적 한 프레임이라 비차단. |
| I-1 | Info | `TalkRoom.tsx:1119` | 말 모드에서 안내가 떠 있다가 글자 모드로 바꾸면 `tipShown` 이 참인 채 버튼 `aria-describedby=talk-helper-tip` 가 DOM 에 없는 id 를 가리킨다(무시됨, 부작용 없음). |
| I-2 | Info | `usePhraseHelper.ts:134` | 요청 하나 취소 직후(12초 화면 상한 뒤) 즉시 [다시 시도]하면 서버가 아직 잠금을 풀기 전일 수 있어 409 `PHRASE_BUSY`→일반 오류로 한 번 보일 수 있다(재탭 시 정상). 서버는 `finally` 로 즉시 풀므로 드문 경합. |

### 생존 변이 5건 위험도 판정 (미러 사본에서 재현한 결과를 코드 경로로 해석)
| 변이 | 실제 결함이 되는 모습 | 현재 코드 | QA 가 잡나 | 단위 시험 보강 |
|---|---|---|---|---|
| MU1 요청 중 재요청 허용 | 로딩 중 Enter(`submit()` 은 `block` 과 무관하게 항상 `h.ask()` 호출 — 방어선은 `ask` 안의 `live.current.ac !== null` 한 줄뿐)→2번째 요청이 서버에서 409 `PHRASE_BUSY`→1번째 성공 응답은 `live()` 거짓으로 버려져 **성공을 오류로 보여 줌** + 서버 슬롯 낭비 | 정상 | 「로딩 중 Enter」를 QA 단계로 넣으면 잡힘 | **필요**(M-2) |
| MU2 언마운트 abort 제거 | 방을 나가도 요청이 최대 12초 서버 CLI 슬롯과 사용자 동시 1건 잠금을 쥠→다른 방에서 곧바로 물으면 spurious `PHRASE_BUSY` | 정상 | 거의 못 잡음(사용자 체감 낮음) | **필요**(M-2) |
| MU4 보내도 판 안 닫힘 | ⑤A 위반(보낸 뒤 판이 대화를 가림) | 정상 | **QA 즉시 잡음**(H5) | 정규식 교체(M-1) |
| MU5 IME 조합 중 Enter 보냄 | 한글 마지막 글자 확정 Enter 가 미완성 질의를 전송 — 기기·IME 의존 | 가드 있음(`:247`) | 갤럭시 키보드 실기기에서만 | 핸들러를 순수 함수로 빼서 시험 |
| MU6 [물어보기] pointerdown 방어 제거 | 탭이 입력 blur→VoiceBar 재등장→레이아웃 이동으로 **click 소실/키보드 깜빡임**(L-1 과 같은 메커니즘) | 가드 있음(`:256`) | 실기기에서 잡힘 | 소스 정규식 한 줄로 충분 |
| MU7 카드 ▶ 녹음 중 잠금 제거 | 마이크 누른 채 다른 손가락으로 ▶ → 녹음 중 도우미 소리가 마이크에 들어감(STT 오염) + 방 소리 정지 부작용 | 가드 있음(`PhraseHelperCard.tsx:99-102`) | 다중 터치라 거의 안 잡힘 | **필요**(저비용) |
→ 어느 변이도 현재 코드의 결함이 아니다(**동작은 맞고 방어가 비어 있을 뿐**) — 그래서 Critical/High 가 아니라 Medium(시험 부채)로 둔다.

### 시험 보강 권고 (fix 아님 — 파일:줄 지정)
1. **요청 수명주기 컨트롤러 분리 (M-2 핵심)**: `usePhraseHelper.ts:134-170`(`ask`)·`:85-94`(언마운트)를 React 없이 시험하도록 `phraseHelperLogic.ts` 에 `createHelperRun({ request, setTimer, clearTimer, onSettle, onSlow })` 같은 순수 컨트롤러를 두고 훅은 얇게 감싼다. `node:test` 의 `mock.timers` 로 단언: ① 요청 중 `start()` 두 번째는 `'pending'` 으로 거부(MU1) ② `dispose()` 가 `AbortController.abort()` 를 부르고 타이머를 지우고 이후 응답을 버림(MU2) ③ 5초에 `slow`, 12초에 `timeout` ④ 새 요청이 이전 요청의 늦은 응답을 버림(이미 `settleHelper` 가 시험하는 부분과 합침). 기존 `phraseHelperLogic.test.ts` 의 `settleHelper` 시험을 그대로 재사용하면 된다.
2. **`PhraseHelperCard` 잠금 시험 (MU7)**: `PhraseHelperCard` 는 훅이 없으므로 함수로 직접 호출해 반환 요소 트리에서 `aria-disabled` 버튼을 찾아 `onClick()` 을 불러 `onPlay`/`onFill` 이 호출되지 않음을 단언(DOM 불필요). 같은 방식으로 Panel 은 훅이 있어 어렵지만 `retryBtn`·`submit` 분기를 순수 함수로 빼면 가능.
3. **IME Enter (MU5)**: `onKeyDown` 판정을 `isImeEnter(e: {key:string; nativeEvent:{isComposing:boolean}; keyCode:number})` 로 `phraseHelperLogic.ts` 에 빼서 `Enter+composing`/`keyCode 229`/일반 Enter 3행 시험.
4. **`PhraseHelperPanel.tsx:256`**: 소스 정규식 `assert.match(pnl, /type="submit"[^]*?onPointerDown=\{\(e\) => e\.preventDefault\(\)\}/)` 한 줄(MU6) — 이 정도의 소스 모양 시험이면 충분.
5. **`phraseHelperRender.test.ts:302`**: M-1 의 잘라서 단언하는 방식으로 교체. 같은 파일의 소스 정규식들(`:300-353`)도 게으른 `[^]*?` 를 쓰는 곳은 앵커 경계를 두는 것이 안전.

### QA 에 넘길 high_risk_areas
1. **실기기 키보드·초점**: 앱 WebView 에 `:root[data-kb]` 가 오는지(없으면 입력 초점 중 판 본문이 보임), 키보드가 입력 줄을 가리지 않는지(판이 `--kb-inset` 만큼 줄어든 셸 위에 오는지), **입력 초점 중 판 안 첫 탭**(예시 칩·▶·[다른 말투]·[다시 시도])이 먹히는지 — L-1.
2. **소리 배타**: ▶ 가 선생님 소리·대답 연습 소리를 먼저 끊는지, 마이크 누름 시 도우미 소리가 멈추는지, 방 소리 시작 시 멈추는지, 녹음 중 카드 ▶ 가 안 울리는지(MU7, 다중 터치 포함).
3. **안내 말풍선 위치**: 식이 VoiceBar 치수(px-4·44 칸·72 마이크·`ml-3`·44 버튼)에 의존 — 360/390/412 에서 도우미 버튼 바로 위·오른쪽 정렬, 다크에서 반전색, 닫기 ✕ 터치.
4. **녹음 링↔도우미 버튼 약 2px 오터치**: 마이크 링이 커질 때 도우미 버튼 쪽 탭이 마이크로 가지 않는지(반대도).
5. **한글 IME**: 갤럭시 키보드로 「목이 쉬었어요」 조합 중 Enter/검색 키.
6. **로딩 중 Enter 재전송**(MU1)·**언마운트(방 이탈) 직후 다른 방 질의**(MU2)·**마이크 전송 직후 판 닫힘**(⑤A)·**너무 짧은 녹음이면 판 유지**.
7. **5초 예산**: 도우미 진행 중 마이크 전송 시 회화 턴 지연(Leader 결정 1) 측정, 도우미 p50/p95.
8. **마친 역할극**: 도우미 없음·열린 판이 있다가 마치면 사라짐, 상황이 삭제된 마친 방(L-2) 동작.
9. **표시 스위치**: 히라가나·한글 꺼짐 반영, 번역 꺼도 카드 뜻 줄 유지, 「자막만」에서 ▶ 없음; 360/390/412 가로 스크롤 0·다크 카드 테두리.
10. 예시 칩 실제 히트 높이(L-3), 글자 모드에서 입력 중 Composer 숨김·[입력창에 넣기] 후 초점.

### 확인 못 한 것
- 실제 브라우저·WebView 렌더(레이아웃 픽셀, 키보드 상호작용, 소리 재생, 다크 색)는 보지 못함 — 위 L-1·안내 위치는 코드·산술 추론이고 L-3 만 합성 HTML 로 Chromium 실측.
- 이번 소환은 `tsc`/`eslint`/시험을 재실행하지 않고 앞선 소환의 결과(rc=0 · 230/230)를 그대로 인용. `next build` 미실행.
- `useAnnotations` 의 호출 빈도·`#24r` 서버 부하, `useKeyedSound` 내부의 TTS 요청 형태(기존 코드, 이번 task 변경 아님)는 읽지 않음.
- 서버(#180)는 REV-190 소관이라 다시 보지 않음(화면 쪽 오류 매핑 대조만).

## REV-193 재감사 (REV-191 화면 보완 + REV-192 서버 Low 2건 — 좁은 재감사 · reviewer · 2026-10-11 · Read 전용)

**판정: PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 0 · Low 1 · Info 4. 컨트롤러 이동은 기계적 이동이 맞고(차분 퍼즈 재실행 56,671건 일치), REV-191 M-1·M-2·L-3·I-1·MU5~7 과 REV-192 L-R1·L-R2 가 모두 닫혔다. QA 차단 사항 없음.

### 발견 사항
| # | 심각도 | 위치 | 내용 · 근거 |
|---|---|---|---|
| F-1 | **Low** | `src/components/talk/__tests__/phraseHelperRender.test.ts:302-307` | M-1 교체 단언이 **주석 처리된 호출을 통과시킨다.** 변이 MU4b — `TalkRoom.tsx` onAccepted 의 `helper.close()` 를 `// helper.close()` 로 바꿈 → 46/46 그대로 통과(생존). 실제 줄 삭제(MU4)는 잡힌다(`TalkRoom: …보내면 닫히고` 실패). 잘라 낸 `accepted` 에 `/\bhelper\.close\(\)/` 를 걸어 주석 속 문자열도 맞는다. 권고: `stripComments(accepted)` 에 걸기(같은 파일 360행에 이미 있는 헬퍼 — 쓰는 시험 위로 올리면 안전). 동작 결함 아님, 시험이 약한 한 점. |
| F-2 | Info | `task056PhraseHelp.test.ts` (L-R2) | 변이 S2 — `signal?.aborted === true && isAbortError(e)` 에서 이름 검사를 빼고 `signal?.aborted === true` 만 남김 → 52/52 통과(생존). 「신호는 끊겼는데 AbortError 가 아닌 엔진 오류」가 기존 매핑(504/502)으로 가는 것을 잠그는 시험이 없다. 실영향 없음(손님이 이미 없다). 필요하면 한 건 추가. |
| F-3 | Info | `phraseHelperLogic.ts` slow 타이머의 `if (live === l)` | 변이로 가드를 빼도 통과 — 등가 변이(타이머가 dispose·finally 에서 항상 지워져 가드는 중복 방어). 조치 불필요. |
| F-4 | Info | 칩 두 줄 줄바꿈 | gap 6px 에 위아래 4px 히트 확장이 겹쳐 **2px 띠**(아래 칩이 받음). 손가락 접촉 오차(수 mm) 대비 1px 이하 편향이라 실제 오터치 위험으로 보지 않는다. 가이드 §22-11 「히트 44 + gap 6」 자체의 성질. 조치 불필요. |
| F-5 | Info | 브리프 대상 `phraseHelperLogic.test.ts` | REV-191 첫 소환 시점(20:16) 이후 **바뀌지 않았다**(`diff -rq` 무차이). 변경 대상 아님. |

### 감사 항목별 결과
1. **동작 불변 [확실]** — 옛 훅(`~/.node-local/thekaiwa-rev056u` 의 `usePhraseHelper.ts`, 보완 전 원본)과 새 `usePhraseHelper.ts`·`createHelperRequester` 를 `diff -u` 로 나란히 대조: `Live`/`NO_LIVE`·12초 `timedOut+abort`·5초 `onSlow`(`live===l` 가드)·`settleHelper` 호출(request/live/timedOut/settle 네 인자)·`finally` 의 `live!==l` 확인 뒤 타이머 정리·언마운트(abort+타이머 정리+`NO_LIVE`)가 **문장 단위로 같다.** 바뀐 것은 ref → 클로저 변수, `ask` 안 순서(setter 들 → `req.start`; 옛 순서는 타이머·live 지정 → setter 들)뿐인데 그 사이에 비동기 경계가 없고 setter 는 `live` 를 읽지 않는다. 새 경합·stale closure 없음: `settle`·`onSlow` 는 옛 코드와 같이 `ask` 시점 렌더의 클로저이고 안에서 쓰는 값은 setter(안정)·`depsRef`·`say`(안정 `useCallback`) 뿐. `req` 는 `useState` 지연 초기화 한 번(StrictMode 의 두 번 마운트에서도 `dispose` 가 빈 컨트롤러에 무해하고 컨트롤러는 영구 정지되지 않는다 — 옛 `useRef` 와 같은 수명). 언마운트 뒤: 타이머 둘 다 정리 + `settleHelper` 가 `live()` 거짓이라 `settle` 미호출 + `.finally` 가드 → `setState` 0(시험 MU2·「늦은 응답 무시」가 잠금). 컨트롤러 `start` 가 null 을 돌려주는 경우는 `askBlockOf` 가 먼저 `pending` 으로 막아 도달하지 않는다(방어).
   - **퍼즈 재실행 [확실]**: 전용 미러 `thekaiwa-fix056u/scratch-fix056u/equiv.test.ts` 가 남아 있어 내 미러 `thekaiwa-rev056v/scratch-rev056v/` 로 복사해 재실행 → **3,000개 무작위 연산열, `EQUIV events=56671` {abort 3888 · slow 1935 · settle-timeout 748 · settle-error 376 · blocked 4304 · settle-items 399} 전부 동일**(developer 주장과 수치까지 같음). 퍼즈의 「옛」 구현이 실제 옛 코드와 같은지도 위 diff 와 대조했다(같음).
2. **React 규칙 [확실]** — eslint(변경 10파일) rc 0 · 출력 없음. `--print-config` 로 `react-hooks` 7.1.1 의 `purity`·`set-state-in-effect`·`refs`·`immutability`·`set-state-in-render` 가 켜져 있음을 확인. 컨트롤러 생성은 `useState(createHelperRequester)` 지연 초기화이며 생성자에 부작용이 없다(클로저 변수만). 렌더 중 ref 읽기·쓰기 없음(`req.pending()` 은 `ask` 이벤트 핸들러 안).
3. **시험 품질 [확실]** — 미러 사본에서 임시 파일+rename 으로 변이 후 매번 NFS 원본으로 복원, `cmp` 동일 확인. 대상 phraseHelper 3파일 46개:
   - MU1 컨트롤러 거부 제거 → 잡힘(2) · MU1a 훅 `pending:false` → 잡힘(1) · MU2 `dispose` abort 제거 → 잡힘(2) · MU2b 타이머 정리 제거 → 잡힘(1) · MU2c 훅 언마운트 `dispose` 제거 → 잡힘(1)
   - MU4 onAccepted `helper.close()` 줄 삭제 → 잡힘(1) · **MU4b 주석 처리 → 생존(F-1)**
   - MU5 `isImeEnter` 항상 false → 잡힘 · MU5c keyCode 229 제거 → 잡힘 · MU6 `onPointerDown` 제거 → 잡힘
   - MU7a 카드 ▶ 잠금 제거 → 잡힘 · MU7b [입력창에 넣기] 잠금 제거 → 잡힘
   - L3 칩 `truncate` 를 버튼으로 되돌림 → 잡힘 · I1 `tipShown` 의 모드 조건 제거 → 잡힘 · 12s→120s → 잡힘 · `finally` 정리 제거 → 잡힘 · `finally` 의 live 확인 제거 → 잡힘 · `onSlow` 제거 → 잡힘(2)
   - **서버** S1 `signal?.aborted === true &&` 제거 → 잡힘(신규 L-R2 시험 1건) · S3 `inFlight.delete` 제거 → 잡힘(14) · S2 이름 검사 제거 → 생존(F-2)
   - 합계 24건 중 생존 3건(F-1·F-2·F-3 — F-3 은 등가). 공허한 단언·항상 참인 정규식은 발견하지 못했다(M-1 의 새 단언은 길이 상한 400 + 시작 고정 + 호출 존재 3겹).
4. **L-3 [가능성 높음 — 실제 렌더 미확인]** — 소스 구조: 버튼 `relative h-9 max-w-full rounded-full border px-3 … before:absolute before:inset-x-0 before:-inset-y-1`(overflow 없음) + 안쪽 `<span class="block truncate">`. 보이는 상자는 버튼의 `h-9`·`px-3`·`max-w-full` 이 그대로 정하고 글자만 안쪽으로 내려갔으므로 모양 변화 없음. 버튼 `overflow: visible`(기본, 프리플라이트가 건드리지 않음)이라 `::before` 의 위아래 4px 가 더는 잘리지 않아 히트 44. `max-w-full` 이 버튼 폭 상한을 정하므로(플렉스 항목 자동 최소폭은 `max-width` 로 눌림) 긴 글자는 span 에서 말줄임 — developer 의 합성 HTML 실측(101×36·328×36 동일, 글자 위치 동일)과 모순 없음. 승인 데모 HTML 의 `.chip{overflow:hidden}` 은 자기 `::before{top:-4px;bottom:-4px}` 를 스스로 잘라 먹는 **데모 쪽 결함**이고, `docs/screens.md` H2 는 「칩·안내 ✕ 는 히트 44」로 명시돼 있어 구현이 가이드 문구에 맞게 됐다 → 데모 대조 분류 **implementation**(보이는 변화 없음, 재승인 불필요). 2px 띠는 F-4.
5. **Info 안내 연결 [확실]** — `tipShown = … && mode === 'voice'` 한 조건. `tipShown` 사용처는 두 곳뿐(`describedBy={tipShown ? HELPER_TIP_ID : undefined}` · 말 모드 가지의 `{tipShown ? <PhraseHelperTip/> : null}`), 말풍선은 말 모드 가지에만 있으므로 글자 모드에서 `aria-describedby` 가 없는 id 를 가리키던 것만 사라졌다. 처음 1회 판정(`claimHelperTip`, `voiceBarReady` 의존)과 닫기(`setTipOpen(false)`)는 건드리지 않았고, 글자 모드에서 말 모드로 돌아오면 안내가 다시 보이는 동작도 옛과 같다(옛에도 글자 모드에서는 말풍선이 그려지지 않았다). `helperButton` 은 말 모드 VoiceBar(`trailing`)와 글자 모드 Composer 두 곳에서만 쓰인다.
6. **서버 L-R2 [확실]** — 정상 취소(신호 abort + `ClaudeCliAbortedError`, 이름 `AbortError`)는 409 `CANCELLED` 그대로(기존 취소 시험 2건 + 신규 ① 통과). 신호가 살아 있는 `AbortError` → `classifyError` 가 모르는 예외라 `INTERNAL`, `engineFailure` 도 그대로 돌려 500 + `withApi` 오류 로그 1회. **developer 판단(500 이 맞다)에 동의한다**: 어댑터 자체 타임아웃은 `ClaudeCliTimeoutError`(이름이 `AbortError` 아님)라 정상 504 경로를 건드리지 않고(`claudeCli.ts:108-112` 에서 `AbortError` 는 `signal` 취소 전용 클래스), 라우터도 이름이 `AbortError`/`Timeout` 이면 즉시 올리므로 살아 있는 신호의 `AbortError` 는 「있어서는 안 되는 어댑터 결함」이다 — 그걸 로그 없는 409 로 숨기지 않는 게 하드닝의 목적이고 화면은 5xx 를 모두 `error` 로 같게 보인다(사용자 영향 동일, 502 로 맞추려면 `classifyError` 변경이라 범위 밖). 잠금: `inFlight.add` 직후부터 `try…finally{delete}` 이고 그 앞 `has`→`add` 사이에 `await` 가 없다 → 모든 경로에서 풀림(S3 변이 14건 실패, 신규 시험 말미 「잠금 해제」). 주석 사실 확인: `claudeCli.ts:756-760` 큐 대기 중 작업은 **자기 차례에 와서야** `signal.aborted` 를 보고 `ClaudeCliAbortedError` 를 던진다 → 「큐 대기 중이면 차례가 올 때」 정확. 라우트 주석도 같은 문장.
7. **범위 [확실]** — `diff -rq src` (REV-192 시점 미러 `thekaiwa-rev056s2` 대비): 서버 3(`phraseHelp.ts`·`route.ts`·`task056PhraseHelp.test.ts`) + 화면 `phraseHelperLogic.ts`·`usePhraseHelper.ts`·`PhraseHelperPanel.tsx`·`TalkRoom.tsx`·`__tests__/phraseHelperRender.test.ts` + 신규 `__tests__/phraseHelperRequester.test.ts` — 브리프 대상과 정확히 일치. 서버 diff 는 주석 3곳 + 조건 한 줄 + 시험뿐(응답 형식·한도·오류 매핑·문구 무변경). `src/types/chat.ts`·`src/components/scenario/PracticeDock.tsx` `git status` 무변경.
8. **developer 질문 3건**
   - ① 「새 질의가 이전 요청을 abort」: **현재 동작(요청 중 재요청 거부) 유지가 맞다.** `docs/screens.md` §22-10(10018행)에 「`AbortController` + 12초 끊기, 5초에 slow. **요청 중 재요청 금지**」가 확정 문구이고, 서버의 `PHRASE_BUSY` 동시 1건 잠금·단일 CLI 슬롯과도 짝이다(앞 요청을 끊고 새로 보내면, 큐 대기 중이던 앞 호출의 잠금이 차례가 올 때까지 안 풀려 새 요청이 오히려 409 `PHRASE_BUSY` 를 받는다 — 서버 L-R1 한계와 같은 이유). 지시문 표현이 사양과 달랐을 뿐 [확실].
   - ② 데모 36px ↔ 구현 히트 44: **수용.** 위 4 — 데모 자체의 `::before` 가 `overflow:hidden` 에 잘리던 결함이고 가이드 H2 는 처음부터 44. 보이는 크기·모양 불변이라 데모 재승인 사유(material) 아님.
   - ③ 2px 띠: F-4, 조치 불필요.

### 재현 수치
- 전용 미러 `~/.node-local/thekaiwa-rev056v` (기본 미러 `cp -al` → `.prisma` 는 `thekaiwa-predeploy` 실복사, 낡은 것은 같은 미러 안 `.prisma-old-hardlinked` 로 이름만 바꿔 치움, 스키마 md5 `8f493d1b…` NFS·predeploy 동일; `sync-local.sh` 로 NFS 소스 동기화; 기본 미러·predeploy 수정 없음, 포트 3011·3012 미사용, `git add`·커밋·push 0).
- `eslint`(변경 10파일: 화면 7 + 서버 3) → **rc 0** · `tsc --noEmit -p .` → **rc 0**.
- phraseHelper 3파일 **46/46** · talk+scenario **241/241** · `src/components` 전체 **1,179/1,179** · conversation+engine+`app/api` **1,170/1,170**(75파일) · 새 서버 시험 3파일 **52/52**. fail 0·cancelled 0.
- `next build`(전용 미러, 출력은 파일) → **rc 0**(변이 없는 상태에서 재실행; 첫 실행은 변이 작업과 겹쳐 신뢰하지 않았고 같은 rc 0). 경고는 기존 `SPAWN_FAILED` 동적 접근 관련 한 건(이 task 무관).
- 변이 24건 중 생존 3건(F-1 Low · F-2 Info · F-3 등가). 변이 파일 전부 원복 후 `cmp` 동일(NFS 원본과 미러 6파일 재확인).

### QA 에 넘길 high_risk_areas
1. **라이브(서버 REV-192 §6 승계)**: 큐 앞 긴 호출 → 3~5초 abort → 곧바로 재질문이 큐가 빌 때까지 409 `PHRASE_BUSY` 인 것은 **수용한 설계**(큐 대기 중 취소는 차례가 올 때 풀림).
2. 실기기 도우미: 요청 중 [물어보기]·칩 연타(거부, 요청 1건) · 요청 중 방 이탈(언마운트)해도 다른 방 질의에 앞 답이 안 섞임 · 5초 「조금만 기다려 주세요」 · 12초 시간 초과 문구 · 한국어 IME 조합 중 Enter.
3. **칩 실제 히트 영역(L-3)** 실기기: 칩 위/아래 가장자리 2~4px 밖을 눌러도 눌리는지, 두 줄로 감길 때 인접 칩 오터치가 체감되는지(F-4 평가는 산술·합성 HTML 기준).
4. 글자 모드에서 도우미 버튼의 접근성 설명(TalkBack)이 안내를 읽지 않고, 말 모드로 돌아오면 안내가 다시 뜨는지.

### 확인 못 한 것
- 실제 브라우저·WebView 렌더(칩 히트 44 의 실측, 말줄임 모양, IME)는 보지 못했다 — L-3 평가는 소스 구조 + developer 의 합성 HTML 실측 인용.
- React 렌더 시험 도구가 없어 훅의 마운트·언마운트·StrictMode 동작은 소스 대조 + 컨트롤러 단위 시험 + 배선 소스 시험으로만 확인했다(훅 자체를 렌더해 보지 않음).
- 서버는 가짜 엔진 시험까지만 — 실제 `claude` CLI 에서 살아 있는 신호로 `AbortError` 가 새는 경로가 정말 없는지는 코드(`claudeCli.ts`·`router`)로 추론했을 뿐 라이브 프로브 아님.
- 이 소환은 변경분만 감사했다 — REV-190/191/192 본건(서버 본체·화면 본체)은 다시 읽지 않았다.

## REV-194 재감사 (QA-C 반송 수정 F-2/F-3/F-5 + 도우미 요청 자동 취소 — 화면 변경분 · reviewer · 2026-10-11 · Read 전용)

**판정: PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 0 · Low 2 · Info 5. 판 안 `<button>` 7개 전부에 `keepInputFocus` 가 있고(소스 전수), 자동 취소는 `loading`/`slow` 에서만 abort 하며 취소로 생긴 거절은 오류·시간 초과로 표시되지 않는다. 다른 턴 시작 경로는 없다(`turn.send` 호출처 1곳 = `sendOutgoing`). 시험이 약한 곳이 Low 2건(주석 처리 변이 생존). QA 차단 사항 없음.

### 발견 사항
| # | 심각도 | 위치 | 내용 · 근거 |
|---|---|---|---|
| F-1 | **Low** | `src/components/talk/__tests__/phraseHelperBehavior.test.ts:162-163,172-196` | F-3 「버튼별 keepInputFocus」 시험이 **원문 소스를 `split('<button')` 해 `includes('onPointerDown={keepInputFocus}')` 로 본다 — 주석 처리된 속성도 통과**한다. 변이 M5(칩의 `onPointerDown` 줄을 `// onPointerDown={keepInputFocus}` 로) · M15(`[물어보기]` 동일) → **267/267 통과(생존)**. JSX 여는 태그 안의 `//` 주석은 컴파일되므로 실제로 속성이 없어진 채 빌드된다. ✕·카드 ▶·[입력창에 넣기]는 요소 트리를 직접 불러 보는 동작 시험이라 안전하고, 칩·[다른 말투]·[다시 시도]·[물어보기]만 원문 검사다. 줄 삭제(M4·M9)는 잡힌다(`F-3 판 안 모든 버튼…` 실패). REV-193 F-1 과 같은 종류(주석 통과). 권고: `buttonBlocks` 가 소스에서 주석을 걷어낸 뒤 자르게(같은 디렉터리 `phraseHelperCancel.test.ts` 의 `code()` 헬퍼 재사용 — 그쪽은 주석 처리 변이 M6·M7·M16 을 잡았다). 동작 결함 아님. |
| F-2 | **Low** | `phraseHelperCancel.test.ts:176-177` | 「열림 여부 조건 없이 부른다 — 호출 줄이 if 에 걸려 있지 않다」 주석과 달리 정규식 `/\n\s*helper\.cancelPending\(\)\n/` 은 **호출이 자기 줄에 있는지만** 본다. 변이 M11(`if (helper.open)` 를 **윗줄에** 두고 `helper.cancelPending()` 은 다음 줄) → 267/267 생존. 같은 줄 `if (…) helper.cancelPending()` 는 잡힌다. 이 변이는 「판이 닫혀 있어도 요청은 살아 있다」는 사용자 결정(닫은 채 말하기 시작해도 취소)을 깨는데, prettier 가 괄호 없는 `if` 를 윗줄로 내려 쓰는 일은 드물어 실위험은 낮다. 권고: 호출 줄 바로 앞 비주석 줄이 `stopSound()` 호출인지 확인하거나 `onPress` 본문에 `if (` 가 없음을 단언. |
| F-3 | Info | `usePhraseHelper.ts` `fresh: phase === 'idle'` | 취소하면 `phase='idle'` 이라 **다시 열 때 `fresh`=true → 입력칸 초점(키보드)이 올라온다**(결과가 있던 판은 키보드 안 올림, QA-C 통과 항목). screens §22-6 `hp-open-kb`(이전 답 없음 → 판+초점) 와 일치하고 질의가 남아 있어 [물어보기]만 누르면 되므로 결함으로 보지 않는다. QA·designer 가 의도 확인용으로 한 번 볼 것. |
| F-4 | Info | 칩 두 줄 줄바꿈 | gap 6px 에 위·아래 4px 확장이 겹쳐 2px 띠가 생긴다(DOM 뒤 칩이 받음). 합성 Chrome 으로 박스 산술 재현: `-inset-y-1`→ 보이는 36 + 3.75 + 2.75 = 42.5, `-inset-y-[5px]`→ 36 + 4.75 + 3.75 = **44.5**(DSF 2.625 반올림 ±0.75). 보이는 모양은 `::before`(배경·테두리 없음)이라 변화 없음. 가이드 H2(44) 충족, 오터치 편향 1px 이하 — 조치 불필요. |
| F-5 | Info | `PhraseHelperPanel.tsx:280` `aria-live={locked ? 'off' : undefined}` | developer 가 요청 밖으로 더한 것. **타당하다고 본다**: 녹음 시작과 함께 뜨는 안내를 스크린리더가 읽으면 마이크에 섞이고 §22-10 「낭독은 녹음이 끝난 뒤」 정신과 맞다. Leader 가 screens §22-7 `cancelled` 행에 이미 반영(`docs/screens.md` 9991행). 대가: 녹음 중 스크린리더 사용자는 이 한 줄을 못 듣는다(글자는 남고, 보내면 판이 닫힘). 실제 TalkBack 동작은 미확인 `[추측]`. |
| F-6 | Info | 범위 | 직전 감사 미러(`thekaiwa-rev056v`) 대비 `src` 차이에 **task-058 서버 파일**(`reply-practice/route.ts`·`openings/draft/route.ts`·`openingDraftRun.ts`·`replyPractice.ts`·신규 `requestCancel.ts`·`task058Cancel*.test.ts`)이 섞여 있다 — 이 감사 범위 밖(다른 task, REV 별도). task-056 화면 변경은 talk 6파일 + 시험 4파일(그중 신규 2)뿐이고 `src/components/scenario/`·`PracticeDock`·`useRolePlay` 는 **차이 0** `[확실]`. |
| F-7 | Info | 확인 못 함 | 앱(Next 개발 서버)에서의 브라우저 재현은 못 했다 — developer 가 QA2 쿠키 파일을 정리했고 세션 쿠키를 새로 발급하는 절차는 이 소환 예산 밖. 대신 합성 페이지 Chrome 147 로 핵심 브라우저 주장을 직접 재현(아래). |

### 감사 항목별 결과
1. **판 안 버튼 전수 [확실]** — `PhraseHelperPanel.tsx`·`PhraseHelperCard.tsx` 의 `<button` 은 7개(✕ 65행·[다시 시도] 121·예시 칩 146·[다른 말투] 178·[물어보기] 270 / 카드 ▶ 92·[입력창에 넣기] 69), 전부 `onPointerDown={keepInputFocus}`. `grep` 으로 `onClick`/`role="button"`/`<a`/`<summary` 추가 조작 요소 없음(카드가 쓰는 `JaText`·`HangulLine`·`JaQuoted` 는 버튼을 그리지 않는다 — `JapaneseText.tsx:181` 의 `<button` 은 표시 줄 `DisplayToggles` 이고 판이 렌더하지 않는다). 판 밖의 도우미 토글(`PhraseHelperButton`)은 대상 아님.
2. **preventDefault 부작용 [확실 — 합성 Chrome 147, 앱 WebView 는 같은 엔진이나 미실측]** — 같은 입력칸/버튼 페이지에서: 마우스·터치 탭 모두 입력칸 `blur` 0·`click` 1회·활성 요소 입력칸 유지. 키보드 Tab→Enter→Space: `blur` 발생·버튼에 초점 이동·`click` 2회(영향 없음). 스크롤 상자 안 버튼에서 시작한 터치 드래그(CDP `Input.dispatchTouchEvent`): `scrollTop` 0→59, `click` 0. 칩/▶ 를 눌러도 키보드가 계속 열려 있는 것은 §22-10(질의 보내는 칩·[다시 시도]는 보낼 때 `blur`, ▶·[다른 말투]·✕ 는 초점 유지)과 일치.
3. **askNow 한 길 [확실]** — [물어보기]·Enter(`submit`→`askNow()`)·칩(`askNow(ex)`)이 같은 식 `askBlockOf(...) === null` 일 때만 `blur()` 후 `h.ask(q)`. [다시 시도]는 `waiting || locked` 면 return, 아니면 `blur()`+`h.retry()`(재시도는 막힘 사유가 이 둘뿐 — `pending` 이면 오류 상자가 안 그려짐). 막혀 있으면 초점 유지.
4. **[입력창에 넣기] 초점 [확실]** — `onFill`: `composerRef.fill` → `focusComposerRef=true` → `helper.close()`. 효과는 `[helper.open, helper.typing]` 가 둘 다 false 가 된 커밋에서 한 번 `composerRef.focus()` 후 플래그 해제. `focusHelperBtnRef`(✕/Esc 경로) 효과와 플래그가 달라 서로 간섭 없음(`onFill` 은 `closeHelperToButton` 이 아닌 `helper.close()` 직접). eslint(`react-hooks` 7.1.1: purity·refs·set-state-in-effect) rc 0.
5. **cancelPending [확실]** — 컨트롤러: `l.ac===null||l.settled||l.timedOut` 이면 false, 아니면 `live=NO_LIVE`(먼저) → `abort` → `stopTimers` → true. 먼저 `live` 를 풀기 때문에 abort 로 생기는 거절은 `settleHelper` 의 `!fx.live()` 에서 걸러져 **error/timeout 어느 쪽으로도 표시되지 않고**, 취소 직후 `start` 가 막히지 않으며(`live.ac===null`) 옛 요청의 `.finally` 는 `live!==l` 로 새 요청 상태를 지우지 않는다. `result/none/error/timeout/rate` 는 컨트롤러가 받는 중이 아니라 false → 훅이 아무것도 안 바꿈. 경합: 취소는 이벤트 핸들러(매크로태스크), 응답 처리는 마이크로태스크 연속이라 **중간에 끼어들 수 없다** — 둘 중 먼저 온 쪽이 이긴다(응답 먼저: `settled=true` → 취소 false / 취소 먼저: 늦은 응답 버림). 5초 `onSlow` 는 `setPhase(p => p==='loading' ? 'slow' : p)` 라 취소 뒤 울려도 idle 유지(타이머는 이미 지워짐).
6. **호출 위치 [확실]** — `turn.send(` 호출처는 `TalkRoom.tsx:471` 한 곳(`sendOutgoing` 안), `sendOutgoing(` 호출 4곳(글자 전송 987·다시 보내기 999·말 최종 498·밀려 있던 말 449 setTimeout), `stt.press()` 1곳(540). `onPress` 에서 `helper.stopSound()` → `helper.cancelPending()` → `queue.interrupt` … `stt.press()` 순. 판 열림 조건 없이 호출(훅의 `openRef` 는 안내 seen/unseen 판정에만 쓰임). `cancelHelperRef` 는 `useCallback([req])` 로 안정된 함수를 효과 한 번에 옮기고, 그 함수가 읽는 값은 모두 ref(`openRef`·`depsRef`) → stale 참조 없음.
7. **안내 줄** — 우선순위·`seen/unseen` 상태기계는 순수 함수 시험(동작)으로 잠겨 있고 `ask` 가 막힘 검사 뒤에서만 지움, `openPanel` 이 `cancelNoteOnOpen`, `close` 는 불변. 오류 색 아님(`bad:false`). 
8. **회귀·경계 [확실]** — 요청 1건·5초 slow·12초·언마운트(`dispose` 무변경)·429·`PHRASE_BUSY`→error 매핑 코드 차이 없음(diff 로 확인), `onAccepted` 닫힘·⑤A 코드 무변경, `TalkRoom.tsx` 의 도우미 외 변경 없음(hunk 6개 전부 도우미). 저장소/콘솔/URL 사용 0(`localStorage` 는 `usePhraseHelper.ts` 주석 1줄뿐, `kaiwa.talk.helperTipSeen` 1비트는 `phraseHelperLogic.ts:12` 의 기존 키), 서버 모듈 import 0, 엔진명·모델명 0.

### 재현 수치
- 전용 미러 `~/.node-local/thekaiwa-rev056w`(`thekaiwa-rev056v` 에서 `rsync --link-dest`, 최상위 파일 하드링크 끊음, `sync-local.sh`; 스키마 md5 `8f493d1b…`; 다른 미러·포트 3010~3019 미사용, `git add`·커밋 없음).
- `eslint src/components/talk src/components/scenario` → **rc 0·출력 0** · `tsc --noEmit -p .` → **rc 0** · `next build`(출력은 파일) → **rc 0**.
- 시험 `src/components` 전체 **1,205/1,205**(실패 0·취소 0) · talk+scenario 267/267.
- 변이 16건(미러 사본, 임시 파일+rename 후 매번 `cmp` 원복 확인) — **사망 13 / 생존 3**:
  - 사망: M1 `onPress` 취소 줄 삭제 · M2 `sendOutgoing` 취소 줄 삭제 · M3 `cancelPending` 의 `abort` 제거(2건 실패) · M4 칩 `keepInputFocus` 삭제 · M8 `askNow` 의 `blur` 제거 · M9 [다른 말투] 삭제 · M10 카드 ▶ 삭제(2건) · M12 `openRef` 항상 false · M13 입력창 초점 효과 제거 · M14 [다시 시도] `blur` 제거 · **주석 처리 변이**: M6 `// helper.cancelPending()` · M7 `// cancelHelperRef.current()` · M16 `// cancelHelperRef.current = …`(동기화 효과) — 이 셋은 `code()` 로 주석을 걷어서 잡힌다.
  - **생존 3: M5(칩 `onPointerDown` 주석 처리) · M15([물어보기] `onPointerDown` 주석 처리) → F-1 / M11(윗줄 `if (helper.open)`) → F-2.** 공허한 단언·항상 참인 정규식은 못 찾았다.
- 합성 Chrome 147: 포커스 유지·키보드 무영향·터치 스크롤 무영향·칩 히트 산술(42.5→44.5) 위 2·F-4. 스크립트 `scratchpad/r194/{probe,hit}.mjs`.

### developer 열린 질문 5건에 대한 의견
1. screens 문서 보완 제안 → Leader 가 §22-6·22-7·22-10 에 이미 반영한 것을 확인(코드 `onPress`·`sendOutgoing`·`aria-live=off` 설명 일치). `seen/unseen`(안내 지우는 때) 문장은 문서에서 못 찾았다 — 구현 의도를 한 줄 더하면 좋다(차단 아님).
2. `aria-live=off` 요청 밖 추가 → **유지 권고**(F-5).
3. 훅 상태 배선을 진짜 React 로 도는 시험 없음 → 소스 검사 + 컨트롤러 동작 시험 + 브라우저 18/18 의 조합으로 받아들일 만하다. 의존성(`@testing-library/react`+`jsdom`) 도입은 사용자 승인 사항이라 이번 task 에서 요구하지 않는다. F-1 정도의 주석 처리 구멍은 `code()` 로 메운다.
4. 턴 진행 중(생각·선생님 말) 도우미 질의는 취소 안 됨 → **범위 밖으로 둔 판단 동의** — 사용자 결정이 「말하기 시작·턴 시작」으로 한정돼 있고, 반대 방향 경합은 QA-B 에서 별도 측정됐다. 필요하면 후속 판단.
5. 앱(온디바이스 STT) 경로: `onPress` 하나를 지나는 구조라 같다고 본다 `[가능성 높음]` — 실기기 확인 대상.

### QA 에 넘길 high_risk_areas
1. **실기기(WebView) 첫 탭**: 입력칸에 초점이 있는 상태(키보드 올림 → 뒤로가기로 내린 경우 포함)에서 칩·[다시 시도]·▶·[다른 말투]·[입력창에 넣기]·✕ 첫 탭이 먹는지, 판이 밀리지 않는지. 칩 두 줄일 때 이웃 칩 오터치.
2. **자동 취소 실측 시나리오**: ① 판 열림·로딩 중 마이크 누름 ② 판 닫은 채 요청 중 마이크 누름 → 다시 열면 안내 한 번 ③ 결과 카드 보이는 상태 마이크 → 그대로 ④ 글자 모드 로딩 중 [보내기] ⑤ 한 글자 인식(보내지 않음) → 판 유지·안내·질의 유지 ⑥ 취소 직후 곧바로 재질문 — 큐가 비기 전이면 409 `PHRASE_BUSY`(수용된 설계, REV-192 §6·REV-193 high_risk 1 승계).
3. 취소 후 다시 열면 키보드가 올라오는 것(F-3) 이 어색하지 않은지.
4. 녹음 중 안내 줄이 읽히지 않는 것(F-5) — TalkBack 실제 동작.
5. 앱 온디바이스 STT 경로의 `onPress` 취소(웹 gateway 가짜 서버로만 확인됨).

### 확인 못 한 것
- 앱·실기기·WebView 렌더(프로젝트 개발 서버+QA 쿠키 경로) — 위 F-7. `pointerdown.preventDefault()` 효과는 합성 페이지(Chrome 147)로만 확인.
- 훅의 마운트·언마운트·StrictMode 동작을 진짜 React 로 돌려 보지 못함(렌더러 없음). 컨트롤러 단위 동작 + 소스 배선 시험 + developer 의 브라우저 18/18·12/12 인용.
- 서버 쪽 `CANCELLED`(#180)·task-058 변경은 이 감사 범위가 아니다.

## REV-195 최종 게이트 (생각 중 도우미 잠금 + 소스 검사 도구 + 커밋 전 전체 점검 · reviewer · 2026-10-11 · Read 전용)

**판정: PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 0 · Low 1 · Info 5. 잠금은 6개 상태 전수에서 사양(§22-6)대로이고 잠금 해제·판 유지·`accepted` 닫힘·자동 취소와 충돌하는 틈을 못 찾았다. `sourceCode.ts` 는 앱 소스 1,288개로 독립 검증해 주석 외 한 글자도 안 바꾼다. 변이 10건 전부 사망(주석 처리 3종 포함). 전체 작업 트리 게이트 tsc 0·시험 2,440/2,440·build 0. **task-056 만 담은 HEAD 도 tsc 0·시험 2,388/2,388** — 단독 커밋이 가능하다. Low 1 건은 코드가 아니라 **공유 파일 5개의 hunk 분리 위생**(아래 커밋 계획).

### 발견 사항
| # | 심각도 | 위치 | 내용 · 근거 |
|---|---|---|---|
| F-1 | **Low** | 공유 파일 `docs/screens.md`·`docs/design/api-contract.md`·`agent-vault/20-Log/2026-10-11.md` | 세 task(056·058·059)의 hunk 가 한 파일에 섞여 있고 일부는 **한 hunk 안에서 맞붙어** 있다(screens.md `@@ -9768,0 +9780,786` = §22(056) 9780~10088 + §23(059) 10089~10565 한 덩어리 / 20-Log 의 `23:16 QA-B2`(056) 가 `23:12`·`23:16 Dev-H`(059) 줄과 연속). `git add <파일>` 하면 남의 줄이 섞여 나간다 — 이미 task-055 때 한 번 오스테이징됐다(ACTIVE 메모). 블롭 구성 또는 `git apply --cached` 로 hunk 단위 스테이징 필요. 표는 아래. |
| F-2 | Info | `TalkRoom.tsx` 가 고르는 토스트(`notify(helperLockToast(helperLockWhy))`) | 녹음 중 눌러 미뤄진 토스트(§9-0 ⑨)는 **누른 시점의 이유**(voice)로 문구가 정해져 놓은 뒤 THINKING 에서 떠도 「말하는 중에는 열 수 없어요」다(developer 열린 질문 1). 타당하다고 본다: 그 탭은 말하던 중에 거절됐고 문구는 그 사실을 말한다. 이유를 지연 시점에 다시 계산하면 `notify` 구조를 바꾸는 큰 변경이라 이득이 작다. 바꾸지 말 것. |
| F-3 | Info | developer 열린 질문 2 / 사양 §22-6 9852행 (SPEAKING 허용) | developer 기록은 「AI 호출이 이미 끝났으니」라 했지만 **코드는 다르다**: 회화 턴은 `completeJson({onTextDelta})` 스트리밍(`orchestrator/index.ts:489-494`, `TurnAudio early:true`)이라 첫 음성이 나올 때 **턴의 AI 호출이 아직 돌고 있을 수 있다**. 그래도 결론은 맞다: 엔진은 동시성 1·interactive 레인 FIFO(`claudeCli.ts` `pump`/`workerBusy`)이고 `retryOnTimeout`+`onTextDelta` 는 같이 못 써서(`claudeCli.ts:747`) 스트리밍 턴 호출은 큐 꼬리로 되돌아가지 않으며 다른 재시도는 슬롯을 쥔 채 task 안에서 돈다. 따라서 SPEAKING 중 도우미 호출은 **턴 호출 뒤에서 기다릴 뿐 턴을 앞지르지 못한다** — 위험 없음. 부작용은 도우미 응답이 그만큼 늦는 것뿐이다(12s 타임아웃은 프로세스 시작 뒤부터라 큐 대기는 포함되지 않는다 — 코드 추적으로 본 것이며 라이브 확인은 못 함). 사양 §22-6 문장(「이미 시작됐으니 … 뒤에서 기다릴 뿐」)은 정확하다. developer 기록의 「끝났으니」는 부정확하지만 코드·사양에는 없다. |
| F-4 | Info | `phraseHelperLogic.ts:36` `helperLockReason(talkState: string)` | 인자가 `TalkState` 가 아니라 `string` 이다(렌더 중 훅 반환 값을 import 함수에 넘기면 컴파일러 순수성 검사가 오탐해서 `view.state` 문자열을 받게 했다는 설명). 상태 철자 오타는 컴파일에서 못 잡지만 시험이 `Record<TalkState,…>` 로 6상태를 전수해 대신 잡는다(M1·M2·M8 사망). 허용. |
| F-5 | Info | 범위 밖 시험 약점 (developer 인용, **직접 확인 못 함**) | developer 가 같은 약점(원문 소스 양성 단언)이 남아 있을 수 있다고 적은 `scenario/__tests__/qaP2cAFixes.test.ts:189`·`roomFlow.test.ts`·`resultWiring.test.ts`·`resultLogic.test.ts`·`variant*.test.ts` 는 이 task 변경 파일이 아니다. 후속으로 `readCode` 로 바꾸는 기계적 작업을 권고(우선순위 낮음). |
| F-6 | Info | eslint `src tests` rc=1 | **오류 54건 전부 `tests/live/p3-qa/*.ts` 9개 파일의 `no-explicit-any`** — 추적 중이고 이번 변경에서 만지지 않은 파일이다. `src` 오류 0, 경고 5(기존 `react-hooks/set-state-in-effect`, 다른 화면). task-056 파일은 오류·경고 0. 배포 게이트가 `eslint src` 만 보는지 `tests` 까지 보는지는 확인 못 함(task-055 게이트 기록은 「eslint 오류 0」). |

### 감사 항목별 결과
**A-1 잠금 로직** — `helperLockReason`: RECORDING·RECOGNIZING → `voice`, QUEUED·THINKING → `turn`, IDLE·SPEAKING → `null`(`phraseHelperLogic.ts:34-40`). `helperLocked = reason!==null`(시그니처 불변, src 비시험 호출처 0). `helperLockToast(null|voice)=HELPER.locked`, `turn=HELPER.lockedTurn`. 버튼은 `aria-disabled={locked||undefined}` 뿐, `disabled` 속성 없음(`PhraseHelperButton.tsx:36-37`, M13 급 변이를 developer 시험이 잡음). 입력만 `disabled={locked}`(`Panel:259`), [물어보기]·카드 ▶·[입력창에 넣기] 는 `aria-disabled`+no-op. `askBlockOf` 가 `recording`(=잠김)이면 `'recording'` 을 먼저 돌려 요청이 시작되지 않는다. 호출부 하나: `TalkRoom.tsx:773-777`(`helperLockWhy`→`helperLock`→훅 `recording`·판 `locked`·버튼 `locked`·`tipShown` 의 `!helperLock`).
**A-2 상태 전이** — 잠금은 **저장하지 않고 `view.state` 에서 매 렌더 유도**하므로 풀림이 자동이고 stuck 이 없다(`failed` 턴 단계는 `deriveTalkState` 에서 IDLE → 풀림, `detached` 폴링은 200초 상한 `useChatTurn` 이라 잠금도 상한이 있다). 판이 열린 채 잠기는 경로(말로 보냄: 녹음 `voice`→인식→`turn`, 잠금 이유만 바뀌고 끊김 없음; 글자 모드는 판이 열리면 입력창이 숨는다)에서 판은 유지되고 입력·버튼만 잠기며 `accepted` 에서 `helper.close()`(`TalkRoom.tsx:387`) → 결과·질의 기억. 보내기 거절(accepted 전 실패)이면 판이 열린 채 IDLE 로 풀린다. 자동 취소 순서는 **취소(`sendOutgoing` 첫 줄 `cancelHelperRef.current()` / `onPress`) → 잠금(THINKING) → 닫힘(accepted)** 이라 잠금이 취소에 기대지 않는다(M12 급, developer 시험 `phraseHelperTurnLock` 이 확인). 잠금 중에는 새 도우미 요청이 시작될 수 없어 턴 중 요청 경합이 없다. 안내 말풍선은 `!helperLock` 으로 THINKING 동안 숨는다. `d.recording` 이 풀릴 때 미뤄 둔 낭독(`pendingAnnounce`)이 나가는 것도 같은 경로를 재사용한다.
**A-3 `sourceCode.ts`** — TS 파서 trivia 로 주석만 걷는다. **독립 검증(내 스크립트, 저장소 밖)**: 미러 `src` 의 `.ts/.tsx` **1,288개**(주석 있는 파일 1,246)에 `stripComments` 를 적용해 `ts.createPrinter({removeComments:true})` 출력을 전후 비교 → **AST 차이 0건**, 걷은 뒤 재파싱 시 남은 주석 **0건**. 문자열·템플릿·정규식·JSX 글자 속 `//` 는 보존된다(developer 시험 5개 + 이 전수). `typescript` 는 `devDependencies`(`^5`)이고 앱 코드가 import 하지 않아 번들 제외(`next build` rc 0, 라우트에 미포함), `__tests__` 위치라 tsc(포함)·eslint(오류 0)·build 모두 통과.
**A-4 시험 품질(변이 직접 재현 10건 — 전용 미러 사본 `thekaiwa-rev056y`, 임시 파일+`os.replace`, 매번 NFS 원본 바이트로 복원, 끝에 `RESTORED_OK`)** — 대상 8파일 95개:
| 변이 | 결과 |
|---|---|
| M1 THINKING 만 해제 | **사망** 7 |
| M2 QUEUED 만 해제 | **사망** 6 |
| M3 이유 구분 제거(토스트가 늘 「말하는 중」) | **사망** 3 |
| M4 `turn` 줄을 `//` 한 줄 주석 | **사망** 7 |
| M10 `turn` 줄을 `/* */` 블록 주석 | **사망** 7 |
| M5 방 `helperLock` 이 voice 만 | **사망** 1 |
| M6 방 훅 `recording` 이 voice 만 | **사망** 1 |
| **M7 JSX 여는 태그 안 `// onLocked={…}` 주석 처리(컴파일되는 형태)** | **사망** 2 (소스 검사 도구가 잡음) |
| M8 SPEAKING 과잠금 | **사망** 6 |
| M9 방이 토스트 이유를 `'voice'` 로 고정 | **사망** 2 |
→ 생존 0. 이전 REV-194 가 지적한 「주석 처리가 통과」 약점은 닫혔다. 직전 감사들의 회귀(판 안 버튼 7개 `keepInputFocus`·자동 취소 호출 위치·⑤A 녹음 중 판 유지)는 전체 시험에서 그대로 통과.
**A-5 서버 연동 확인** — 도우미 호출은 `lane:'interactive'`(`router/tasks.ts` `phraseHelp`) → 화면이 QUEUED·THINKING 에서 막는 것이 턴 앞지르기를 막는 유일한 장치다(서버 `TURN_RUNNING` 409 는 없음, 사용자 결정 2026-10-11). 화면 우회 경로(다른 탭·콘솔에서 직접 호출)는 이 잠금이 못 막지만 사용자 본인 요청 1건에 한정되고 이전 REV 들이 본 분당/하루 한도·사용자당 동시 1건이 그대로라 새 위험이 아니다.

### 최종 게이트 (전용 미러 `~/.node-local/thekaiwa-rev056x` = 기본 미러 `cp -al` 후 부가 폴더 7개는 미러 밖으로 이동, `KAIWA_LOCAL_ROOT=… bash scripts/sync-local.sh`, 낡은 `.prisma` 는 `thekaiwa-predeploy` 의 것으로 교체(생성 스키마 vs `prisma/schema.prisma` `diff -w` 0, NFS 스키마 md5 `8f493d1b…`), 낡은 `.next` 는 미러 **밖** `~/.node-local/thekaiwa-rev056x-aside/` 로 치움; `diff -rq NFS/src 미러/src` 무차이로 시작)
| 항목 | 결과 |
|---|---|
| `tsc --noEmit -p .` | **rc 0, 출력 0바이트** |
| `eslint src tests` | rc 1 — 140건(오류 54·경고 86). **`src` 오류 0**·경고 5(기존). 오류 54 는 전부 `tests/live/p3-qa/*.ts` 9개(기존·미변경, F-6) |
| 시험 `src/components`+`src/app/api` | **1,324/1,324**, fail 0·cancelled 0·skipped 0 (31초) |
| 시험 `src/modules/conversation`+`src/modules/engine` | **1,116/1,116**, fail 0·cancelled 0·skipped 0 |
| `next build` (출력 파일로) | **rc 0** (Turbopack 추적 경고 3건 = `persona/loader.ts`·`claudeCli.ts` 기존, 새 경고 0). 라우트 `/api/v1/chats/[id]/phrase-help` 포함 |

### 커밋 계획 검증 (읽기 전용 — 이 소환은 add·commit·push 안 함)
**전체 작업 트리 106항목**(`git status --short -uall`): task-056 = 코드·시험 37 + 문서·vault 10 (= 통째 add 47) / task-058 = 코드·시험 7 + vault 3 / task-059 = 코드·시험 33 + vault 7 / 공유 문서 4(screens·api-contract·board·20-Log, hunk 분리) / 기타 = `.obsidian/` 5 (47+10+40+4+5 = 106).

**(1) task-056 소속 — 통째로 add 가능한 파일 47개** (경로 pathspec 로)
- 수정(M) 11: `src/components/scenario/__tests__/roomRender.test.ts` · `src/components/scenario/scenarioCopy.ts` · `src/components/talk/TalkRoom.tsx` · `src/components/talk/VoiceBar.tsx` · `src/modules/conversation/__tests__/prompts.test.ts` · `src/modules/conversation/index.ts` · `src/modules/engine/__tests__/additionalPropertiesStrip.test.ts` · `src/modules/engine/router/tasks.ts` · `tests/live/p2c-qa/b2-extra-screens.ts` · `tests/live/p2c-qa/b2x-screens.ts` · `tests/live/task010d-b2-screens.ts`
- 신규(??) 코드·시험 26: `src/app/api/v1/__tests__/task056PhraseHelpRoute.test.ts` · `src/app/api/v1/chats/[id]/phrase-help/route.ts` · `src/components/__tests__/{sourceCode.ts,sourceCode.test.ts}` · `src/components/talk/{PhraseHelperButton,PhraseHelperCard,PhraseHelperPanel,PhraseHelperTip}.tsx` · `src/components/talk/{helperCopy,phraseHelperLogic,usePhraseHelper}.ts` · `src/components/talk/__tests__/phraseHelper{Behavior,Cancel,Logic,Render,Requester,TurnLock}.test.ts` · `src/modules/conversation/__tests__/{phraseHelp,task056PhraseHelp}.test.ts` · `src/modules/conversation/chats/phraseHelp.ts` · `src/modules/conversation/prompts/phraseHelp.ts` · `src/modules/conversation/structuredResponse/phraseHelp.ts` · `src/types/phraseHelp.ts` · `tests/live/task056-pe-phrase-measure.ts` · `tests/live/task056-phrase-help-smoke.ts` · `tests/prompts/fixtures/phrase-help.json`
- 신규 문서·vault 10: `docs/demo/task-056-talk-phrase-helper-v1.html` · `agent-vault/10-Flow/improvements/items/IMP-0030-*.md`(경로에 한글, glob) · `agent-vault/10-Flow/tasks/task-056-{improve-talk-phrase-helper,designer-record,dev-server-record,dev-ui-record,pe-record,qa-record,rev-server-record,rev-ui-record}.md`
- `IMP-0029` 는 변경 없음(추적·미수정). `agent-vault/00-Context/ACTIVE.md`·`roadmap.md` 는 이 작업 트리에서 미수정 — 커밋 후 Leader 가 갱신.
- 비밀·내부 주소 스캔(위 47개): 토큰·키·쿠키 값 0. 더미 접속 문자열 `mysql://invalid:invalid@127.0.0.1:1/invalid`(PE 실측 스크립트 안내, 2곳)뿐 — 무해.

**(2) 공유 파일 hunk 소유 (이 5개는 통째 add 금지)**
| 파일 | hunk | 소유 |
|---|---|---|
| `src/modules/conversation/index.ts` | `+7` 줄 전부(phraseHelp export, `@@ -88,0 +88,7`) | **task-056 전부** — 통째 add 가능(task-058 export 줄 0: `requestCancel.ts` 는 index 에서 export 안 함) |
| `docs/screens.md` | `@@ -81` (§2 「회화」 행에 도우미 문구) | 056 |
| | `@@ -1301,0 +1302,2` ~ `@@ -1960` (21개, §5 오늘의 단어 줄·`[task-059 → §23-x]`) | 059 (줄에 056 언급 0, 059 표시 22) |
| | `@@ -3855,0 +3858,7` (도우미 자리 7줄) · `@@ -4049,0 +4059` (#180 표 행) · `@@ -4219,0 +4230` (체크리스트 한 줄) | 056 |
| | `@@ -9768,0 +9780,786` = **한 덩어리** | **9780~10088 (§22) = 056 / 10089~10565 (§23) = 059** — 줄 범위로 분리 |
| `docs/design/api-contract.md` | 172(#47 행) · 926~991 (#47 절·카드 우선 세트 예시·#49·#53 문구) | 059 |
| | 323(제목 `#161~#180`) · 347(#180 행 신규) | 056 (#180 행에 task-058 언급 0) |
| | 336(#169 행) · 345(#178 행) — `CANCELLED` | 058 |
| `agent-vault/10-Flow/board.md` | `+1` (Doing 에 task-056 줄) | 056 전부 — 통째 add 가능 |
| `agent-vault/20-Log/2026-10-11.md` | `+4` 줄: `21:31 [qa] task-056 QA-A` · `23:16 QA-B2(task-056 …)` | 056 (2줄) |
| | `23:12 [developer] task-059 Dev-D` · `23:16 [developer] task-059 Dev-H` | 059 (2줄) — **056 의 `23:16 QA-B2` 줄이 059 두 줄과 한 hunk 로 이어져 있다** |
스테이징 방법 권고: 이전 task-055 때처럼 `git show HEAD:<파일>` 에 자기 줄만 끼운 블롭을 `git hash-object -w` + `git update-index --cacheinfo`, 또는 hunk 별 patch 를 `git apply --cached`. 스테이징된 내용에서 `task-058`·`task-059`·`§23`·`CANCELLED`(#169/#178 외) 표지를 grep 해 확인할 것(task-055 오스테이징 교훈). 공유 인덱스라 다른 세션과 겹치지 않게 한 번에.

**(3) task-058 소속 (task-056 커밋에 넣지 말 것)** — M: `src/app/api/v1/chats/[id]/reply-practice/route.ts` · `src/app/api/v1/scenarios/openings/draft/route.ts` · `src/modules/conversation/chats/openingDraftRun.ts` · `src/modules/conversation/chats/replyPractice.ts` / ??: `src/modules/conversation/chats/requestCancel.ts` · `src/modules/conversation/__tests__/task058Cancel.test.ts` · `src/app/api/v1/__tests__/task058CancelRoute.test.ts` · `agent-vault/10-Flow/tasks/task-058-{cancel-signal-169-178,dev-record,rev-record}.md` · api-contract 336·345 hunk.
**(4) task-059 소속** — `src/components/vocab/**` 수정 24 + 신규 `cardFirst.ts`·`DeckListenRow.tsx`·`__tests__/{cardFirst,cardFirstHome}.test.ts`, `src/modules/learning/vocab/sessions.ts`·`src/modules/learning/__tests__/{task008,task042}.test.ts`(M)·`task059CardFirst.test.ts`(??), `src/app/api/v1/vocab/sessions/route.ts`, `agent-vault/10-Flow/tasks/task-059-*`(M 1 + ?? 6), screens.md §5·§23 hunk, api-contract 172·926~991 hunk, 20-Log 059 두 줄.
**(5) 커밋 금지** — `.obsidian/`(5개, 로컬 Obsidian 작업 공간 상태 — 루트에서 vault 를 연 흔적, 미무시 상태라 `git add .` 계열이면 딸려 나감). 그 밖에 비밀(`.env` 는 ignore 됨 `!!`)·로그·큰 파일(최대 `phrase-help.json` 35KB, 데모 html 106KB)·scratch 는 task-056 목록에 없음.

**(6) task-056 단독 커밋의 빌드 가능성 — 실제로 만들어 확인** `~/.node-local/thekaiwa-rev056z`(미러 복사 후 `src`·`tests` 만 `git archive HEAD` 로 교체 + 위 task-056 47개 중 코드·시험 37개를 작업 트리에서 덮어씀; task-058/059 파일은 HEAD 상태):
- `grep`: task-056 코드·시험이 `requestCancel.ts`(058)·`vocab/**`(059)를 import 하는 곳 **0**. `chats/phraseHelp.ts` 는 취소 판정을 자기 파일에 따로 둔다(`requestCancel.ts` 머리 주석에도 명시). 반대로 059 시험은 `sourceCode.ts`(056)를 쓰지 않는다 — 두 방향 의존 없음.
- `phraseHelp.ts` 가 import 하는 `./replyPractice` 의 `engineFailure`·`readPracticeChat`·`PracticeChatRow` 는 **HEAD 에 이미 export** 되어 있다(task-058 수정 전 파일). `conversation/index.ts` 의 task-056 export 7줄이 가리키는 4개 파일은 전부 task-056 목록에 있다.
- 결과: `tsc --noEmit` **rc 0** · 시험(components+app/api+conversation+engine) **2,388/2,388** pass(fail 0·cancelled 0·skipped 0; 전체 트리 2,440 과의 차 52 = 058/059 시험) · `next build` **rc 0**(추적 경고 3건 기존).

### high_risk_areas (QA 에 — 이미 QA-B2 가 라이브로 본 항목은 재확인만)
1. 실기기 TalkBack: 잠긴 버튼 낭독 「…사용 불가」 + 토스트 문구 두 가지, 판이 열린 채 THINKING 이 되는 드문 경로.
2. 앱 WebView 온디바이스 STT 경로의 `onPress`→`sendOutgoing`(취소→잠금→닫힘 순서), 세 폭(360/390/412) 가로 스크롤 0.
3. SPEAKING 중 도우미를 열었을 때 도우미 응답 지연(턴 호출 뒤 대기, F-3) — 사용자가 체감하는 느림이 허용 범위인지.
4. 잠금 직후 턴 첫 음성 p50 재측정(QA-B2 5.83s → 2.4s 근방 회복) — 이 잠금의 존재 이유라 수치로 닫을 것.

### 확인 못 한 것
- 앱/브라우저 실재현(개발 서버·QA 쿠키 경로) — developer 의 브라우저 17/17 인용만. SPEAKING 상태의 실제 열림은 헤드리스에서 TTS 가 막혀 못 만들었다고 developer 가 적었고 나도 못 했다(`deriveTalkState(playing)` 입력 단위 시험으로만 확인).
- 12s 타임아웃이 큐 대기를 포함하는지의 라이브 확인(코드 추적으로는 프로세스 시작 뒤부터 `[가능성 높음]`).
- 진짜 React 렌더(훅 상태 배선) — 프로젝트에 jsdom·렌더러가 없어 소스 검사+순수 함수+developer 브라우저 확인에 의존.
- `qaP2cAFixes`·`roomFlow` 등 범위 밖 시험의 주석 우회 가능성(F-5)은 열어 보지 않았다.
- 내 변이는 미러 사본에서만 했다. 종료 시 NFS 소스·문서·vault(이 기록 파일 제외) 무변경: 변이 스크립트는 NFS 를 읽기만 했고 `RESTORED_OK`.
