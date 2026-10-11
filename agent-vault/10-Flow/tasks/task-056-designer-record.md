---
task_id: task-056
role: designer
tags:
  - type/designer-record
  - domain/conversation
  - domain/improvement
aliases:
  - task-056 designer 기록
created: 2026-10-11
updated: 2026-10-11
---

# task-056 — Designer 기록 (회화방 일본어 도우미)

> 본 이력서 [[task-056-improve-talk-phrase-helper]] 의 designer 작업 기록. 이 파일만 designer 가 쓴다(이력서 본문·코드는 수정하지 않음).
> **데모 v1 사용자 승인(2026-10-11 17:58) — 아래 「구현 가이드 — 확정」이 developer 인계본이다(Leader 경유).** 화면 가이드 정본은 `docs/screens.md` **§22** 이고, 둘이 다르면 §22 가 이긴다. 상태 표·문구 표·확인표는 §22 에만 있다(여기에 다시 적지 않음).

## 체크포인트
- [17:11] 기존 파악 완료 — task-056 이력서·[[IMP-0030-회화-한국어질의-일본어도우미]], `TalkRoom.tsx`(입력 영역 1060~1121행: strip → `PracticeDock` → `RolePlayEndedBar`|`VoiceBar`|`Composer`, `composerRef.fill`), `VoiceBar.tsx`(상태 줄 h-6 + `grid-cols-[44px_minmax(0,1fr)_44px]` = ⌨44·PTT72·■44/빈칸), `Composer.tsx`(`[🎤44][textarea][↑44]`, `data-kb-docked`, `fill` 은 글자 채우고 포커스), `PracticeDock.tsx`(입력 바 위 판·`max-h-[min(46dvh,320px)]`·`KB_HIDE`·판 안 마이크 없음 D-8·`Skeleton [17,17]`·5초 「조금만 기다려 주세요」), `useRolePlay.ts:151`(대답 연습은 IDLE·SPEAKING 에만 보임 — 녹음 중 사라짐), `PushToTalkButton`(72px), `RolePlayGoalCard`, `DisplayBar`·`DISPLAY_COPY`, `talkCopy`·`scenarioCopy PRACTICE`, `globals.css`(`:root[data-kb]`·`--safe-bottom`, sha256 `a314f18f1807`), api-contract #169(reply-practice 선례: 저장 없음·fast 12s·429 분당 10)·§2-18(ASK = 채팅 kind, 전용 엔드포인트 없음)·#24r(annotate), screens §1·§9-0~9-2·§15, task-010d 가이드 §3-D·§3-E. 디자인 스킬 page-layout-designer·ui-component-builder 읽음.
- [17:14] Leader 전달: 사용자 결정 「글자 입력으로 시작하자」 — 질의 입력은 한국어 글자 입력 확정. 한국어 음성 입력은 선택지에서 빼고 「범위 밖(필요하면 별도 판단)」 한 줄 메모로만. 음성 입력 UI 는 그리지 않음(그리기 전이라 걷어낼 것 없음).
- [17:25] 데모 v1 초안 — `docs/demo/task-056-talk-phrase-helper-v1.html`(상태 25개·현재 vs 제안·일반 회화방/역할극·말/글자 모드·결정 7건이 화면을 바꿈·키보드 모형 300px·실측 패널·「입력 바 세 폭」 18칸). lint `DEMO_LINT_PASSED`(첫 실행에서 클래스 이름 `gtag` 가 분석 스크립트 패턴에 걸려 `goal-tg` 로 바꿈).
- [17:30] 브라우저 검증(헤드리스 Chrome, 데모 파일만 로컬 http 로 열람, 운영·개발 서버 접속 없음): 상태 24(당시) × 폭 360/390/412 × 판 A/B × 버튼 A/B(1차 288칸) + 폭 360/412 × 방 2 × 모드 2(2차 768칸) + 결과·펼침 상태 × 후보·이유 결정 × 3폭(3차 96칸) — **휴대폰 안 가로 넘침 0·44px 미만 터치 0·실측 갱신 누락 0**, 데모 페이지 390 폭 가로 스크롤 0, 콘솔 오류 0(favicon 404 만). 흐름 확인: 버튼 → 판 열림·입력칸 초점·키보드 → 빈 Enter 안내 → 입력·Enter → 로딩 → 결과 → [입력창에 넣기](입력창 채움·초점·판 닫힘) → 다시 열기(마지막 답·키보드 안 올림) → 마이크 누름(판 유지·버튼 aria-disabled·입력칸 disabled) → 뗌(판 닫힘·토스트) → Esc(닫힘·초점 도우미 버튼). 고친 것 3건: ① 결정 ② B(3개 모두 펼침)가 판 안을 361~491px 넘겨야 해서 **「첫 카드 + [다른 말투 n개 더 보기]」 접힘**으로 바꿈 ② 말 모드 판 안 「고른 표현을…말해 보세요」 줄은 바로 아래 상태 줄과 중복 → 판(A)에서 빼고 시트(B)에만 ③ 버튼 B 안내 말풍선이 상태 줄을 가림 → 입력 바 위로 올림.
- [17:32] 디자인 스킬: layout·component·design-reviewer·a11y-reviewer(project-ui-system 미적용 — 학습 앱) / 자체 점검 P0 0·P1 0·P2 3, a11y Critical 0·Major 0·Minor 3. lint 최종 `DEMO_LINT_PASSED`, 파일 sha256 앞 16자 `704e8d58cb2a5067`(106,228 B — 정본 해시는 Leader 의 `status` 가 기록).
- [17:58] (Leader 기록) 사용자 승인 「4번만 'B안'으로 하고 나머지는 권고안대로 진행해줘」 → ①A ②B ③A **④B** ⑤A ⑥A ⑦A.
- [18:10] 승인 반영 — 승인 정본 sha256 `704e8d58…8319c` 무변경 확인. ④B 구체화를 위해 다시 읽음: 데모 `.hbB`·`.tip`·`ctx().tip`·`tip-x`·`hp-toggle`(P.tip=false), `common/storage.ts`(readStore/writeStore 전부 try/catch — 쓰기 실패를 알리지 않음), `shell/KeyboardInset.tsx`(`data-kb-docked`·앱 WebView ⚠ 키보드 인셋 없음), `(app)/layout.tsx`(`--kb-inset` 로 셸 높이 줄임), `globals.css` `:root[data-kb]{--safe-bottom:0}`, `PushToTalkButton`(녹음 중 `scale-105` + `-inset-1.5` 링 6px), `useRolePlay`(목표 카드↔대답 연습 한 `panel` 상태, `toggleGoal`·`closePractice`·`goalOpen`·`practiceOpen` 노출), `TalkRoom` 토스트 `VOICE_TOAST_BOTTOM=136`, `roomRender.test.ts:145`(입구 부제는 상수 참조 — ⑦A 로 시험 수정 불필요). 앱 아이콘 버튼은 `title` 을 쓰지 않음(⌨·🎤·■) 확인.
- [18:15] 가이드 확정·`docs/screens.md` 반영(§2 회화방 행 끝에 한 구절 · §9-2 F 끝에 「일본어 도우미 자리」 블록 · §9-4 표 끝에 #180 참조 행 · §9-9 확인 한 줄 · 새 §22 = 22-0~22-15). §21(task-055) 뒤에 붙임 — §21 본문·§2 의 task-055 행(90~91행)은 건드리지 않음. §21 머리의 「TalkRoom.tsx 는 task-056 소유」 경계와 맞음(055 는 TalkRoom·TalkRoomHeader 를 고치지 않음). 승인 데모 sha256 재확인 무변경.
- 디자인 스킬: ui-accessibility-reviewer·ui-design-reviewer(확정값 기준 재점검, page-layout·component 는 데모 단계에서 읽음) / 자체 점검 P0 0·P1 0·P2 3, a11y Critical 0·Major 0·Minor 3(아래).

## 결정 — 최종값 (데모 v1 승인 2026-10-11 17:58)

| # | 질문 | **확정** | 채택 안 함 |
|---|---|---|---|
| — | 질의 입력 | 한국어 **글자** 입력(키보드) | 한국어 음성 — 범위 밖(별도 판단) |
| ① | 판 형태 | **A 입력 바 위 판**(대답 연습 판과 같은 자리·`max-h min(46dvh,320px)`) | 바텀시트 |
| ② | 후보 개수 | **B 최대 3개 — 첫 카드만, 나머지 [다른 말투 n개 더 보기]로 접음** | 1개 |
| ③ | 자연스러운 이유 한 줄 | **A 있음** | 없음 |
| ④ | 버튼 모양 | **B 둥근 아이콘만 44px + 처음 한 번 안내 말풍선** | 아이콘+글씨 56×56 |
| ⑤ | 녹음 동안 판 | **A 그대로 보임**(보내면 닫고 마지막 답 기억) | 녹음 시작 때 사라짐 |
| ⑥ | 한국어 뜻 줄 | **A 늘 보임**(「번역」 스위치와 무관) | 「번역」 스위치 따름 |
| ⑦ | 역할극 구분 문구 | **A 대답 연습 입구 부제도 「선생님 말에 맞는 대답 예시를 봐요」로**(문구만) + 도우미 「하고 싶은 말을 한국어로 물어보세요」 | 도우미 쪽만 |

## 구현 가이드 — 확정 (developer 인계 가능 — Leader 경유)

승인 데모: `docs/demo/task-056-talk-phrase-helper-v1.html` (v1)

> 정본 `docs/screens.md` §22. 적용 토큰 이름(새 색 없음): `ground` `surface` `surface2` `ink` `ink2` `ink3`(placeholder 만) `line` `accent` `accent-soft` `on-accent` `bad` · `--safe-bottom` · `:root[data-kb]` · `--kb-inset`(셸이 처리).

### 0. 레이아웃 설계 (page-layout-designer)
1. **목표**: 회화 중 말이 막힐 때 한국어로 써서 물으면 일본어 표현을 보여 주고, 그 표현을 보면서 바로 말(또는 입력창에 넣어 고쳐 보내기)하게 한다. 저장하지 않는다.
2. **위계**: ① 마이크(주 행동, 72px 가운데 그대로) ② 도우미 버튼(보조 — 흰 원 44px, 마이크보다 약함) ③ 판: 머리 → 입력 줄 → 첫 카드(일본어 17px) → [다른 말투].
3. **영역**: 머리 · (역할극: 목표 카드) · 표시 줄 · 대화 목록(유일한 세로 스크롤) · 띠 · [대답 연습 줄·판 | 도우미 판] 중 하나 · 입력 바. 판 안 스크롤은 대답 연습 판과 같은 예외.
4. **컴포넌트**: 새 `PhraseHelperButton` · `PhraseHelperTip` · `PhraseHelperPanel` · `PhraseHelperCard` · `usePhraseHelper` · `helperCopy.ts` · `phraseHelperLogic.ts` / 재사용 `JaText`·`HangulLine`·`useAnnotations`·`Skeleton`(challenge/parts)·`Badge`·`useKeyedSound`·`soundText`·`SOUND_MSG`·`composerRef.fill`·`notify`.
5. **상태**: 닫힘 / 처음 한 번 안내 / 열림(예시 칩) / 입력 중(키보드) / 빈 입력 / 100자 넘음 / 로딩(0~5초) / 느림(5초~) / 결과(접힘·펼침) / 듣는 중 / 녹음 중 / 빈 결과 / 오류 / 시간 초과(12초) / 429 / 자막만 / 글자 모드 넣은 뒤 — 데모 id 대응은 §22-6.
6. **행동**: 주 = 물어보기 → 말하기(아래 마이크) / 보조 = ▶ 듣기 · [입력창에 넣기](글자 모드) · [다른 말투 더 보기] · ✕/Esc / 위험 동작 없음.
7. **반응형**: 360/390/412 같은 구조, 줄어드는 것은 글자 모드 입력창 폭(180/210/232px)뿐. 높이 780 에서 판 최대 320px, 키보드가 열리면 판은 머리+입력 줄만.

### 1. 화면 개요
- 진입: 회화방 `/study/ai/talk/[chatId]` 입력 바 — 말 모드 마이크 오른쪽, 글자 모드 🎤 오른쪽. 일반 회화방·역할극 방 공통, **마친 역할극(`RolePlayEndedBar`)에는 없음**.
- 역할별 가시성: 로그인 사용자 전원(소유자 방). 관리자 전용 요소 없음. 엔진명·모델명·추적 값은 화면·DOM·콘솔에 싣지 않음.
- 앱/웹 분기: 없음(웹 배포만, 네이티브 변경 없음). 앱 WebView 키보드는 확인 항목(§22-15 D).

### 2. UI 구조 (데모 상태 id 인용)
```
TalkRoom (기존)
  … MessageList
  strip                         ← 그대로. 띠가 새로 뜨면 도우미 판을 닫는다(결과 기억 — 대답 연습과 같은 규칙)
  helper.open ? null : PracticeDock     ← 역할극만 그려짐. 도우미가 열려 있는 동안 그리지 않음(#rp-helper) — PracticeDock 자체는 수정 없음
  helper.open && <PhraseHelperPanel/>   ← #hp-open-kb · #hp-result · #hp-more · #hp-rec …(⑤A: 녹음 중에도 그대로)
  ended ? RolePlayEndedBar
        : mode==='voice' ? <div relative flex-none>{tipShown && <PhraseHelperTip/>}<VoiceBar trailing={<PhraseHelperButton/>}/></div>
        : <Composer leading={<>🎤 <PhraseHelperButton/></>}/>
```
- **VoiceBar** 변경(선택 prop `trailing?: ReactNode` 하나): 가운데 칸 `flex justify-center` → `grid min-w-0 grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)] items-center` 로 바꾸고 PTT 는 둘째 칸, `trailing` 은 셋째 칸 `ml-3 justify-self-start`(없으면 빈 span). ⌨ 칸·■ 칸(44)은 그대로 → **마이크 위치 불변**(#hp-closed ↔ #hp-speaking). `trailing` 이 없으면 지금과 같은 화면. 실측(데모 「입력 바 세 폭」 버튼 B 말 모드 행): 마이크↔도우미 12px(세 폭 같음) · 도우미↔■ 28/43/54px(360/390/412) · 넘침 0.
- **글자 모드**: Composer `leading` 에 🎤(기존) + 도우미(`flex items-end gap-2` 그대로) → 입력창 폭 180/210/232px(지금 232/262/284, 「세 폭」 버튼 B 글자 모드 행).

#### 2-1. `PhraseHelperButton` — ④B 둥근 아이콘 44px (데모 #hp-closed·#hp-speaking + 결정 ④ B, 「세 폭」 버튼 B 두 행)
- props `{ open: boolean; locked: boolean; tipId?: string; onToggle(): void; onLocked(): void }`.
- 닫힘: `grid h-11 w-11 flex-none place-items-center rounded-full border border-line bg-surface text-ink` + 글리프 `<span aria-hidden className="whitespace-nowrap text-[14px] font-bold leading-none tracking-[-0.5px]">가<span lang="ja" className="text-accent">あ</span></span>`.
- 열림: `border-transparent bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--color-accent)]` + `aria-expanded=true`. 다시 누르면 닫힘(초점은 버튼에 그대로).
- 잠김(RECORDING·RECOGNIZING): `opacity-40` + `aria-disabled=true`(`disabled` 속성은 쓰지 않음 — 눌러서 이유를 들음) → 토스트 「말하는 중에는 열 수 없어요」(기존 `notify`, 녹음 중이면 끝난 뒤). THINKING·QUEUED·SPEAKING 에는 잠기지 않는다.
- 초점: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`.
- **접근성 이름** `aria-label="일본어 도우미"` · `aria-expanded` · `aria-controls="talk-helper"`(판이 있을 때만) · 안내가 보이는 동안 `aria-describedby="talk-helper-tip"`. 글리프는 그림 취급(aria-hidden) — 열림 상태 `accent`/`accent-soft` 4.08:1 은 비텍스트 3:1 기준 충족.
- **툴팁**: hover `title` 은 달지 않는다(터치에서 안 보이고, 앱의 다른 아이콘 버튼 ⌨·🎤·■ 도 쓰지 않음). 뜻은 ① 이름 ② 처음 한 번 안내 말풍선 ③ 판 머리 제목·부제가 알린다. 말풍선 문구가 사실상 툴팁 문구: 「한국어로 물어보면 일본어로 알려 줘요」.

#### 2-2. `PhraseHelperTip` — ④B 처음 한 번 안내 (데모 #hp-closed·#hp-speaking·#rp-closed + 결정 ④ B 에서 보이는 `.tip`)
- **문구**: 본문 「한국어로 물어보면 일본어로 알려 줘요」 · 닫기 버튼 `aria-label` 「안내 닫기」.
- **저장 위치(1비트 플래그)**: `localStorage` 키 `kaiwa.talk.helperTipSeen` = `'1'` — 기존 `common/storage.ts` `readStore`/`writeStore`(전부 try/catch). **질의·답 원문은 어디에도 저장하지 않는다** — 이 키가 이 기능이 저장소에 남기는 유일한 값이다(원문 미보관 원칙과 충돌 없음, reviewer 확인 대상).
- **판정(순수 함수 `claimHelperTip()` — `phraseHelperLogic.ts`, 단위 시험)**:
  ```ts
  export const HELPER_TIP_KEY = 'kaiwa.talk.helperTipSeen'
  export function claimHelperTip(read = readStore, write = writeStore): boolean {
    if (read('local', HELPER_TIP_KEY) !== null) return false   // 이미 봄
    write('local', HELPER_TIP_KEY, '1')                         // 보이는 순간 = 본 것으로 기록
    return read('local', HELPER_TIP_KEY) === '1'                // 쓰기가 막힌 환경(사생활·차단·WebView 설정) → false = 한 번도 안 보임
  }
  ```
  `writeStore` 는 실패를 알리지 않으므로 **써 보고 다시 읽어** 저장 가능 여부를 가린다 — 저장이 안 되는 환경에서 방마다 매번 뜨는 일이 없다.
- **표시 조건**: 말 모드 VoiceBar 에 도우미 버튼이 처음 그려진 뒤의 `useEffect` 에서 한 번 `claimHelperTip()` → 참이면 이 방에 있는 동안 `tipOpen=true`(**방 한 번 방문 동안만** — 무시하고 지나가도 다음 방부터 안 뜸). 서버 렌더·첫 렌더는 늘 숨김(hydration 차이 없음). 방 로딩 중·마친 역할극·**글자 모드에서는 판정하지 않는다**(데모도 말 모드만 그림 — 글자 모드로 들어왔다가 말 모드로 바꾸면 그때 판정).
- **잠깐 숨김**(닫지 않음 — 이 방에서 조건이 풀리면 다시 보임): 도우미 판 열림 · RECORDING·RECOGNIZING · 띠(strip) 있음 · 대답 연습 판 펼침 · 토스트 떠 있음(`VOICE_TOAST_BOTTOM` 136px 와 겹침).
  `tipShown = tipOpen && !helper.open && !locked && !strip && !rp.practiceOpen && !toast.message`
- **닫힘**(이 방에서 다시 안 보임): ✕ 탭 · 도우미 버튼 탭(판이 열리며 닫힘) · 방을 나감. 말풍선 본문 탭은 아무 일도 하지 않는다(데모와 같음 — 아래 요소로 새지 않음).
- **모양**(데모 `.tip` 값): VoiceBar 를 감싼 `relative flex-none` 상자 기준
  `absolute bottom-[calc(100%+8px)] right-[calc((100%-192px)/2+4px)] z-[5] flex w-[196px] items-start gap-0.5 rounded-[10px] bg-ink py-2 pl-3 pr-0.5 text-[12.5px] leading-[1.45] text-surface break-keep shadow-[0_6px_16px_rgba(0,0,0,.18)]`
  · 본문 `<p className="min-w-0 flex-1">` · ✕ `relative grid h-7 w-7 flex-none place-items-center rounded-full text-surface before:absolute before:-inset-2`(보이는 28px·히트 44px, 아이콘 14px) · 꼬리 `absolute right-[15px] top-full border-[7px] border-transparent border-t-ink`(aria-hidden) — 도우미 버튼 가운데를 가리킴.
  위치 공식 = 바 오른쪽 끝에서 도우미 오른쪽 가장자리까지(16 + 44 + (가운데 칸 폭 − 56) = (바 폭 − 192)/2 + 4). VoiceBar 의 `px-4`·44 칸·72 마이크·`ml-3`·44 버튼 중 하나라도 바뀌면 같이 고친다. 360 실측: 말풍선 76~272px(왼쪽 여백 ≥16), 꼬리 = 도우미 가운데.
- 다크 테마: `bg-ink`/`text-surface` 가 자동으로 뒤집힌다(대비 = §1-1 ink/surface, 12:1 이상).
- **접근성**: `<div id="talk-helper-tip" role="note">` — 나타날 때 낭독하지 않는다(녹음 직전 소리와 섞이지 않게). 보이는 동안 도우미 버튼 `aria-describedby` 로 이어져 버튼 초점 때 「일본어 도우미, 한국어로 물어보면 일본어로 알려 줘요」. DOM 순서상 VoiceBar 앞이라 Tab 은 ✕ → ⌨ → 마이크 → 도우미. 나타날 때 애니메이션 없음.
- 역할극 방: 말풍선이 「대답 연습」 접힌 줄 오른쪽 부분을 잠깐 가린다(데모 #rp-closed + ④B 그림 그대로) — 한 번뿐이고 ✕ 로 바로 닫혀 받아들인다.

#### 2-3. `PhraseHelperPanel` (①A·②B·③A·⑥A)
`<section id="talk-helper" aria-labelledby="talk-helper-title" data-kb-docked class="max-h-[min(46dvh,320px)] flex-none overflow-y-auto overscroll-contain border-t border-line bg-surface px-4 pb-3">` — 입력 중(아래 바가 숨은 때) 아래 여백 `max(12px, var(--safe-bottom))`.
- 머리 `min-h-11`: h2 `#talk-helper-title` 14px semibold 「일본어 도우미」 + p 12 ink2 truncate 「하고 싶은 말을 한국어로 물어보세요」 + ✕ 44(`-mr-2`, 「일본어 도우미 닫기」).
- 입력 줄 `<form noValidate>`: sr `<label for="talk-helper-q">` 「한국어로 물어볼 말」 · `<input id="talk-helper-q" type=text lang=ko enterKeyHint=search autoComplete=off spellCheck=false aria-describedby="talk-helper-msg" class="h-11 min-w-0 flex-1 rounded-xl border border-line px-3 text-[16px]">` placeholder 일반 「예: 목이 쉬었어요」/역할극 「예: 얼음 적게 해 주세요」, 녹음·인식 중 `disabled` · [물어보기] `h-11 rounded-xl bg-accent px-3.5 text-[14px] font-semibold text-on-accent`, **`onPointerDown preventDefault`**(초점·키보드 유지), 빈칸·100자 초과·요청 중·녹음 중·429 대기 → `aria-disabled` + `opacity-40`(눌러도 안 보내고 안내 줄). 보낼 때 input `blur()`(키보드 내림).
- 안내 줄 `<p id="talk-helper-msg" role="status" class="mt-1 text-[12px] break-keep">` — 늘 마운트(`display:none` 금지): 빈 제출 「물어볼 말을 한국어로 써 주세요」(bad) · 90자~ 「n/100」(ink2, 오른쪽) · 초과 「100자까지 물어볼 수 있어요 · n/100」(bad). 글자 수는 코드포인트. IME 조합 중 Enter 무시(`isComposing`·keyCode 229).
- 결과 낭독용 sr 상태 줄 하나(`role=status`, 판 안 늘 마운트): 「표현 n개를 찾았어요」·빈 결과·429 문장을 넣는다(녹음 중이면 끝난 뒤 넣음).
- 본문(`[:root[data-kb]_&]:hidden`, `mt-2.5`): 처음 = 「이렇게 물어보세요」 12 ink2 + 칩 3개(h-9 rounded-full, `before:` 히트 44, 누르면 그 말로 바로 물음) · 로딩 = `Skeleton heights={[120, 120]} label="일본어 표현을 찾는 중…"`, 5초부터 12 ink2 「조금만 기다려 주세요」 · 결과 = `<ul aria-label="일본어 표현">` 첫 카드 + (2개 이상) 행 버튼 `h-11` 「다른 말투 n개 더 보기」 + 나머지 꼬리표 요약 12 ink2 truncate + ▾ (`aria-expanded`·`aria-controls="talk-helper-alts"`) → `<ul id="talk-helper-alts" aria-label="다른 말투" hidden={!more}>`(늘 마운트) · 실패 = §22-6.
- 판 안에 마이크·보내기·저장 버튼 없음(D-8). 말 모드 판에는 「말해 보세요」 줄을 두지 않는다(바로 아래 상태 줄이 알려 줌).

#### 2-4. `PhraseHelperCard` (②B·③A·⑥A)
`<li class="flex min-w-0 gap-0.5 rounded-[14px] border border-line bg-surface py-2.5 pl-3 pr-1">`
- 왼쪽 `min-w-0 flex-1`: (후보 2개 이상 + `labelKo` 있음) `Badge neutral` · `JaText` 17px(rt 11, leading 2.1, `[overflow-wrap:anywhere]`) · `HangulLine` 13 · **뜻 13 ink2 `break-keep` 늘 보임(⑥A)** · **이유 13 ink `mt-1.5 border-l-2 border-line pl-2 break-keep`(③A, `whyKo` 있을 때)** — 「」 안 일본어는 `lang=ja` span · 글자 모드만 [입력창에 넣기] `GHOST mt-2`(PracticeDock 의 `GHOST` 와 같은 클래스).
- 오른쪽 ▶ 44 원형(자막만·`soundText` 없음이면 없음), 재생 중 ■ + `bg-accent text-on-accent`, `aria-label` 「{일본어} 듣기 / 멈추기」. 소리 실패는 그 카드 아래 `SOUND_MSG`. 녹음 중 카드 버튼 `aria-disabled`.

#### 2-5. 키보드
- 도우미 입력칸 초점 동안 방 상태 `helperTyping=true` → VoiceBar(+안내 상자)·Composer·대답 연습 줄 숨김(초점 기반 — `data-kb` 없는 앱 WebView 에서도 동작). 판 본문 숨김만 `data-kb` 에 기댄다.
- 판 `data-kb-docked` = KeyboardInset 이 판 안 입력칸을 스크롤로 옮기지 않게(Composer 와 같음). 셸 높이가 `--kb-inset` 만큼 줄어 판이 키보드 위에 온다.
- 실측 360×780(키보드 모형 300): 대화 목록 약 280px(역할극 약 230px).

### 3. API 호출 계획 — #180 (계약 확정은 prompt-engineer 기록 참조, 번호·api-contract 반영은 Leader)
| # | 엔드포인트 | 메서드 | 요청 | 화면이 쓰는 칸 | 실패 처리 |
|---|---|---|---|---|---|
| 180 | `/api/v1/chats/:id/phrase-help` | POST | `{ queryKo }`(trim 1~100 코드포인트 — 화면이 먼저 막음) | `items[1..3].{ ja, ko, labelKo?, whyKo? }` — 첫 항목 = 가장 흔한 말 | 400 → 입력 안내(보통 안 옴) · 404 → 오류 문구 · 409 `ENDED` → 판 닫고 기존 마친 방 처리 · 409 `TURN_RUNNING`(계약이 막기로 하면만) → ★「선생님 말이 끝나면 다시 물어봐 주세요.」 · 429 → 카운트다운 · 502·504·0·12초 → 시간 초과/오류 문구 · `items` 0개 → 빈 결과 |
| 24r | `/api/v1/text/annotate` | POST | `items[].ja` | 루비·한글 줄 | 실패해도 일본어 글자는 보임(기존 `JaText`) |
| — | 기존 소리 경로(`useKeyedSound`) | — | `ja` | — | 기존 `SOUND_MSG` |
- 위 요청·응답 모양은 화면 가정이다 — 계약이 달라지면 Leader 가 알려 주고 「쓰는 칸」만 맞춘다. 맥락(마지막 선생님 말·역할극 역할)은 화면이 보내지 않는다(서버·프롬프트 판단). 저장 없음(#169 선례), 질의·답 원문을 `RequestTrace`·로그·저장소에 남기지 않음.

### 4. 상태 관리 (`usePhraseHelper(chatId, roomKind)`)
- `{ open, query, phase:'idle'|'loading'|'slow'|'result'|'none'|'error'|'timeout'|'rate'|'busy', items, more, playingKey, rateUntil, hint }` — **메모리만**(방을 나가면 사라짐). 질의 초안도 sessionStorage 에 두지 않음.
- 열기: 이전 결과 없음 → 입력칸 초점(같은 사용자 동작 안 — 판 마운트 직후 `useLayoutEffect` 한 번) / 있음 → 결과 그대로, 키보드 안 올림. 닫기(✕·Esc·버튼 재탭): 초점 → 도우미 버튼. Esc 는 초점이 판 안이거나 버튼일 때만.
- 물어보기: `AbortController` + 12초 끊기, 5초에 `slow`. 요청 중 재요청 금지. 새 질의는 `more=false`·소리 정지·input blur.
- 서로 배타: 도우미 열기 → `rp.closePractice()` + `rp.goalOpen` 이면 `rp.toggleGoal()` / 목표 카드·대답 연습이 **새로** 펼쳐지면(false→true) 도우미 닫기 / 띠가 새로 뜨면 도우미 닫기(결과 기억).
- 녹음(⑤A): 판 유지·입력 disabled·[물어보기]·카드 버튼 aria-disabled([다른 말투] 펼침은 허용). 턴 `onAccepted`(말·글자 모두) → 판 닫기(결과 기억). 녹음이 짧아 보내지 않으면 판 유지.
- 소리: `useKeyedSound` 키 `helper:{index}` — ▶ 누르면 `playback.stop()` + `rp.stopSound()` 먼저, 마이크 누름(onPress 에 추가)·방 소리 시작·판 닫힘이면 멈춤(한 번에 하나).
- 안내 말풍선: `tipOpen`(방 상태, §2-2).

### 5. 생성/수정 파일 (src/components 만 — 서버 라우트·conversation 모듈은 Leader 사양)
- 새: `src/components/talk/{PhraseHelperButton,PhraseHelperTip,PhraseHelperPanel,PhraseHelperCard}.tsx` · `usePhraseHelper.ts` · `helperCopy.ts`(문구 단일 출처 + `HELPER_MAX=100`) · `phraseHelperLogic.ts`(순수: 글자 수·잠김 이유·실패→문구·`claimHelperTip`·`HELPER_TIP_KEY`) · `__tests__/phraseHelper.test.ts`.
- 수정: `talk/TalkRoom.tsx`(자리·배타·helperTyping·띠 닫기·onAccepted 닫기·소리·안내 상자) · `talk/VoiceBar.tsx`(`trailing` 슬롯) · `scenario/scenarioCopy.ts`(⑦A `PRACTICE.entrySub` 한 줄 — 시험은 상수를 참조해 수정 불필요, `roomRender.test.ts:145`). 응답 타입 위치는 developer 판단(`src/types/chat.ts` 는 지금 다른 작업이 수정 중).

### 6. 구현 순서
1. `helperCopy.ts`·`phraseHelperLogic.ts` + 순수 함수 시험(글자 수·잠김·실패 매핑·`claimHelperTip` 세 경우: 처음/이미 봄/저장 막힘) → 2. `VoiceBar trailing`(없으면 무변화 확인) → 3. Button·Tip·Card·Panel(가짜 데이터) → 4. `usePhraseHelper`(API 연결은 계약 확정 뒤) → 5. TalkRoom 배치·배타·helperTyping·띠·onAccepted·소리 → 6. ⑦A 문구 → 7. 3폭(360/390/412)·780/892·키보드·다크·엔진명 점검.

### 7. 주의사항
- 엔진명·모델명 0. 저장 버튼 없음. 판 안에 마이크·보내기 없음(D-8). 저장소에 남는 것은 `kaiwa.talk.helperTipSeen='1'` 하나.
- `role=status`/`alert` 요소는 내용 바뀌기 전부터 마운트(안내 줄·결과 sr 줄). 오류·시간 초과는 `role=alert` 상자(새로 그려도 읽힘).
- VoiceBar 치수를 바꾸면 안내 말풍선 위치 공식도 같이 고친다.
- 대답 연습(`PracticeDock`)·목표 카드 동작은 바꾸지 않는다 — TalkRoom 이 그리기 여부만 정한다. ⑦A 는 문구 한 줄.

## 자체 점검 (ui-design-reviewer · ui-accessibility-reviewer — 확정값 기준, 18:15)
- 디자인 P0 0 · P1 0 · **P2 3**: ① ②B+③A 에서 [다른 말투] 줄이 판 아래로 말 모드 약 20px·글자 모드 약 73px 밀림(데모 결정 패널에 공개된 값 — 판 안 스크롤로 닿음) ② 붙은 한자 루비(氷少)가 글자 사이를 벌림 — 앱 `JaText` 공통 현상 ③ (새) 역할극 첫 방문 때 안내 말풍선이 「대답 연습」 접힌 줄 오른쪽을 가림 — 한 번뿐·✕ 로 닫힘. (데모 때 P2 ③ 「버튼 A 글자 모드 11px」은 ④B 라 사라짐.)
- 접근성 Critical 0 · Major 0 · **Minor 3**: ① [물어보기] 비활성이 흐림+`aria-disabled` 뿐(누르면 안내 줄로 보완 — Composer 보내기와 같은 방식) ② ▶ 이름에 일본어가 섞여 한국어 음성으로 읽힘(기존 대답 연습·표현 칩과 같은 패턴) ③ (새) 보이는 글리프 「가あ」 와 접근성 이름 「일본어 도우미」 가 다름(WCAG 2.5.3 — 글리프를 아이콘으로 보아 Minor, 음성 명령 사용자는 「일본어 도우미」로 부름). 데모 때 Minor ③ 「안내 말풍선이 낭독되지 않음」은 `aria-describedby` 연결로 보완.

## 확인 못 한 것
- 실기기 키보드 높이(모형 300px)와 앱 WebView 키보드 — `KeyboardInset` 주석상 앱(Android 15 edge-to-edge)은 키보드 인셋을 받지 않아 `data-kb` 가 켜지지 않는다 [가능성 높음]. 그 경우 판 본문이 키보드 위에서 숨지 않고, 입력 줄이 키보드에 가려지는지는 Composer 와 같은 기존 한계 — 실기기 확인.
- 실제 답 길이(이유 줄 1~2줄 가정)·5초 안 응답 비율 — prompt-engineer 픽스처·라이브 측정 필요.
- 글자 모드 입력창 placeholder 가 180px 에서 더 많이 잘리는 정도(지금도 360 에서 다 보이지 않음 [가능성 높음]) — QA 확인.
- 데모 글꼴은 이 서버의 시스템 글꼴 — 실기기(Noto Sans CJK)와 1~2px 차이 가능.
