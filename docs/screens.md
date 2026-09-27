# TheKaiwa 화면 설계 (screens.md)

> 소유: designer · 구현: developer · 감사: reviewer/qa
> 이 문서는 **화면 구현 가이드의 단일 출처**다. API 요청/응답은 `docs/design/api-contract.md` 를 인용만 하고 다시 정의하지 않는다(#번호로 표기).
> 새 화면이 생기면 §2 목록에 한 줄 추가하고, 화면별 절(§3~)을 덧붙인다.
>
> 변경 이력: 2026-09-27 신규 — §1 토큰·§2 목록·§3 AI 채팅(task-006)

---

## 1. 디자인 토큰

아직 TheKaiwa 전용 데모(`docs/demo/thekaiwa-demo.html`)는 없다. **현행 토큰 = `src/app/globals.css`**(TheMeal 데모에서 이식, task-002)이며 이 절은 그 값을 기준으로 사용 규칙만 정한다. 새 색은 Leader 합의 후에만 추가한다.

### 1-1. 색 — 글자에 써도 되는 조합 (2026-09-27 WCAG 명암비 실측)

| 조합(글자 / 배경) | 라이트 | 다크 | 글자 사용 |
|---|---|---|---|
| `ink` / `surface`·`ground`·`accent-soft` | 13+ | 12+ | 본문 ✅ |
| `ink2` / `ground`·`surface2` | 5.81 / 5.44 | 8.61 / 6.77 | 보조 글·시각·캡션 ✅ |
| `good` / `good-soft` | 5.27 | 5.59 | 뱃지 ✅ |
| `bad` / `bad-soft` | 5.32 | 6.23 | 뱃지·오류 ✅ |
| `on-accent` / `accent` | 4.80 | 6.17 | 주 버튼 ✅ |
| `accent` / `surface` | 4.80 | — | 링크·강조 글 ✅ |
| `accent` / `accent-soft` (Badge `accent`) | **4.08** | 4.72 | ❌ 글자 금지(라이트 미달) |
| `warn` / `warn-soft` (Badge `warn`) | **2.60** | 6.20 | ❌ 글자 금지(라이트 미달) |
| `ink3` / `surface`·`ground` | **3.13 / 2.91** | 4.30 / 4.82 | ❌ 읽어야 하는 글 금지 — placeholder·비활성·장식만 |

- 채팅 화면(§3)은 **`good`·`bad`·`neutral` 뱃지만** 쓰고, 시각·캡션은 `ink2` 로 쓴다. 강조가 필요하면 글자는 `ink`, 색은 점·테두리(비텍스트 3:1)로 준다.
- 기존 공용 `Badge` 의 `warn`·`accent` 톤과 `ink3` 글자(EmptyBlock·LoadingBlock 등)의 라이트 명암비 미달은 **전역 이슈로 Leader 에 보고**(§3-11). 채팅 task 에서 공용 컴포넌트를 고치지는 않는다.
- `--carb/--protein/--fat(-soft)` 는 TheMeal 차트 3색이다 — Phase 3 분석 차트에서 재검토, 그 전엔 쓰지 않는다. `--media-ar` 는 사용 계획이 없다(다음에 globals.css 를 만지는 task 가 지운다).

### 1-2. 타이포

| 용도 | 크기 / 줄간격 | 비고 |
|---|---|---|
| 앱바 제목 | 20px bold (`AppBar`) | 하위 화면 헤더는 17px semibold |
| 한국어 본문 | 14~15px / 1.5 | 설명·총평 15px |
| **일본어 본문**(말풍선·교정문) | **17px / 1.7** (최소 16px) | 학습 대상 글이라 한국어보다 한 단계 크게 |
| 일본어 읽기(히라가나 줄) | 14px / 1.6, `ink2` | 후리가나 역할(§1-3) |
| 캡션·시각·카운터 | 12px(최소 11px), `ink2` | 11px 미만 금지 |
| 입력창 글자 | 16px | 모바일 확대 방지 겸 |

**일본어 글자 규칙(필수)**
- 루트가 `<html lang="ko">` 라 일본어 한자가 **한국식 자형**으로 그려진다(直·骨·化 등). 일본어가 들어가는 요소에는 **반드시 `lang="ja"`** 를 붙인다(말풍선·교정 원문/교정문·단어·읽기·미리보기·입력창).
- `globals.css` 에 한 번만 추가한다(웹폰트 없이 시스템 폰트 — 안드로이드에는 Noto Sans CJK JP 가 기본 탑재):
  ```css
  :lang(ja) {
    font-family: "Noto Sans JP", "Noto Sans CJK JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", Meiryo, sans-serif;
    line-break: strict;          /* 행두 금칙: 작은 가나·구두점이 줄 맨 앞에 오지 않게 */
  }
  ```
- 일본어 블록에 **`break-keep`(word-break: keep-all) 금지** — CJK 사이 줄바꿈이 막혀 가로로 넘친다. 한국어 설명 블록에만 `break-keep` 을 쓴다.
- 긴 글·이모지·URL 대비: 말풍선·교정문은 `whitespace-pre-wrap [overflow-wrap:anywhere] min-w-0`.
- 한국어 폰트는 당분간 시스템 기본(추가 웹폰트 없음). 데모 합의 때 재검토한다.

### 1-3. 읽기(후리가나) 표시 규칙

- 서버가 주는 읽기(`reading`, A2 `replyReading`)는 **문장 전체의 히라가나 한 줄**이다(한자별 ruby 정렬 정보 없음). 그래서 `<ruby>` 대신 **본문 바로 아래 한 줄**로 보여 준다.
- 말풍선마다 `읽기` 토글(펼침/접힘). 기본값은 사용자 선호(`localStorage kaiwa.chat.readingDefault`, 없으면 **펼침**)를 따르고, 채팅방 ⋯ 메뉴의 "읽기 항상 펼치기"로 바꾼다.
- 한국어 번역(`translation`)은 **기본 접힘** — 일본어를 먼저 읽게 한다.
- 읽기 값이 없거나 본문과 같으면(히라가나만의 문장) 토글을 숨긴다.

### 1-4. 간격·크기·폭

- 페이지 좌우 16px(`px-4`), 카드 `rounded-[14px] p-3.5`, 섹션 간 18px(`Section`).
- 터치 영역 ≥44px. 보이는 크기가 작으면 `before:` 히트영역으로 넓힌다(`Segmented` 방식). 목록 행 ≥56px.
- 360 / 390 / 412 세 폭 검증. 최상위 그리드 `minmax(0,1fr)`, 줄어들 flex 자식엔 `min-w-0`.
- 카드 안의 "나란히 ↔ 위아래" 전환은 뷰포트 미디어쿼리가 아니라 **컨테이너 쿼리**(`@container` + `@min-[320px]:`)로 한다 — 카드 폭 기준이라 WebView 390px·패딩 변화에 강하다.
- 화면당 세로 스크롤 1곳. 예외: 바텀시트 내부(모달)·자동 높이 입력창(최대 5줄 후 내부 스크롤).

---

## 2. 화면 목록 · 네비게이션 · 역할별 가시성

| 탭/진입 | 경로 | 화면 | 가시성 | 하단 탭 | 상태 |
|---|---|---|---|---|---|
| 회화 | `/study/ai?tab=chat\|talk` | AI와 공부하기 홈(회화·채팅 전환, 채팅 목록) | 로그인 사용자 | 보임 | **task-006(§3)** |
| 회화 | `/study/ai/chat/[chatId]` | 채팅방 | 소유자(타인 404) | **숨김** | **task-006(§3)** |
| 회화 | `/study/ai/chat/[chatId]/review` | 표현 점검 결과 | 소유자 | **숨김** | **task-006(§3)** |
| 회화 | `/study/ai/talk/[chatId]` | 음성 회화방 | 소유자 | 숨김 | task-007 |
| 오늘 | `/study/today` → `words/[sessionId]` … | 오늘의 공부 | 로그인 | 보임 | task-008 / Phase 2 |
| 계획표 | `/plan` | 달력·분석·성장 | 로그인 | 보임 | Phase 2~3 |
| 서랍장 | `/drawer/words`, `/drawer/corrections` | 단어장·채택 교정 | 로그인 | 보임 | task-008 / Phase 3 |
| 질문 | `/ask` | 무엇이든 물어보세요 | 로그인 | 보임 | Phase 3 |
| 상단 아바타 | `/settings` | 설정 허브 | 로그인(Advanced 는 capability) | 보임 | task-005 ✅ |
| 콘솔 | `(admin)/admin/*` | 관리자 콘솔 | capability 없으면 404 | 별도 레이아웃 | task-005b |

- **하위 화면(대화방·결과 화면)은 하단 탭을 숨기고 `←` 헤더로 돌아간다.** 키보드가 올라온 뒤 대화가 보이는 높이를 확보하기 위해서다(412×892 에서 키보드 ≈330px → 남는 ≈560px 중 탭 바 66px 는 12%).
- 사용자 화면 전체에서 엔진·모델·호스트 이름(`claude|haiku|sonnet|opus|qwen|reazon|whisper|style-bert`)·`traceId`·"AI 엔진" 같은 구현 용어는 0건이다.

---

## 3. AI 채팅 (task-006)

### 3-0. 한눈에 보는 결정

1. 경로 3개: 홈 `/study/ai?tab=chat` → 방 `/study/ai/chat/[chatId]` → 점검 결과 `/study/ai/chat/[chatId]/review`. 방·결과 화면은 하단 탭을 숨긴다.
2. 채팅은 **대화 중엔 고치지 않는다**(A2). 빈 방 안내·입력창 문구로 "대화 뒤 표현 점검에서 한꺼번에 고쳐 준다"를 먼저 알린다.
3. 턴 상태기계 `idle → sending → streaming → (detached) → idle | failed`. 끊김은 오류가 아니다 — 폴링(2.5s→5s, 최대 200s)으로 이어 붙인다. 재시도는 언제나 `{resumePending:true}` 하나.
4. 점검은 **결과 화면이 소유**한다: 방의 "표현 점검" → 결과 화면의 안내(한 번만 가능) → [점검 받기] → 진행(동기 ≤90s / 잡 폴링) → 결과. 새로고침·재방문에도 같은 결과를 복원한다.
5. 교정 카드 = 원문 | 교정 나란히(카드 폭 <320px 이면 위아래) + 바뀐 글자 강조 + 설명 + 유형·심각도 한국어 라벨 + 채택/무시. 채택은 시트에서 "단어장에 넣고 채택" 또는 "단어장 없이 채택".
6. 제안 카드 2종: `ADD_WORD`(방, 해당 강사 말풍선 아래) · `ADD_STUDY_LOG`(결과 화면 상단). 모든 교정·제안 카드에 **"채택해야 저장돼요"** 문구.
7. 오류 문구는 화면이 **코드별 표(§3-8)** 로 정한다. 서버 `message` 는 400 VALIDATION 에서만 그대로 보인다(엔진 용어 누출 차단).
8. 키보드: 루트 viewport `interactive-widget=resizes-content`(1차) + 방 전용 visualViewport 보정(2차). 앱 WebView 는 실기기 확인 항목.

### 3-1. 화면 개요

| 항목 | 내용 |
|---|---|
| 목적 | 일본어로 텍스트 대화(A2) → 대화 뒤 표현 점검(A3) → 문장별 교정 카드에서 **내가 고른 것만** 저장 |
| 진입 | 하단 탭 "회화" → `/study/ai`(기본 `tab=chat` — task-007 이 음성 회화를 열면 기본값을 `talk` 로 바꾼다) |
| 역할별 가시성 | 로그인 사용자 전원. 관리자 전용 요소 없음. 타인 채팅은 404 화면 |
| 앱/웹 분기 | 없음(텍스트 전용). 키보드 처리만 실기기 차이(§3-9) |
| TTS 상태 표시등 | 채팅은 음성이 없어 **두지 않는다**(회화방 task-007 에서) |
| 음성 듣기 버튼 | 두지 않는다(TTS 는 task-003 이후 검토) |

### 3-2. UI 구조 (의사코드, 390px 기준)

#### A. 홈 `/study/ai` — `StudyAiHome`

```
AppBar title="AI와 공부하기"                       ← 기존 AppBar(설정 아바타 포함)
<div className="px-4 pb-8">
  Segmented ariaLabel="공부 방식" [회화 | 채팅]      ← router.replace(`?tab=`) · scroll:false
  tab === 'talk' → TalkComingSoon
      카드: "음성 회화는 곧 열려요"
            "말하면 선생님이 대답하고, 틀린 표현은 그 자리에서 짚어 줘요."
            "지금은 채팅으로 연습해 보세요."   [채팅으로 연습하기] → tab=chat
      (사용자 화면에 Phase·task 번호를 쓰지 않는다)
  tab === 'chat' →
    Btn primary full "＋ 새 채팅"  → NewChatSheet
    PendingCorrectionsCard        ← 채택 대기 교정이 있을 때만(기획서 /study/ai "최근 교정 요약")
    Section "채팅"
      loading → LoadingBlock / error → ErrorBlock(onRetry)
      items.length === 0 → ChatEmpty
      ul → ChatListItem × n
      nextCursor → Btn ghost full "이전 채팅 더 보기"
</div>
```

`ChatListItem`(행 전체가 `Link` → 방, 최소 높이 64px, `min-w-0`):
```
┌────────────────────────────────────────────┐
│ 카페에서 주문하기                     14:02 │  15px semibold truncate · 시각 12px ink2
│ すみません、コーヒーを…        [점검 완료] │  lang=ja 14px ink2 truncate · 뱃지 flex-none
└────────────────────────────────────────────┘
```
- 시각(KST): 오늘 `HH:mm` · 어제 `어제` · 올해 `M월 D일` · 그 외 `YYYY.M.D`. `lastMessageAt` 이 없으면 시각 자리 비움.
- 미리보기: `preview`, 없으면 "아직 메시지가 없어요"(한국어, `lang` 없음).
- 뱃지(둘 다면 `running` 만): `running` → neutral 뱃지 "답하는 중" + 앞에 `accent` 점(8px, `aria-hidden`) · `reviewedAt` → good "점검 완료".
- `aria-label` = `"{title}, {시각}, {상태}"`.

`ChatEmpty`(EmptyBlock 톤이되 글자는 `ink2`):
> **아직 채팅이 없어요**
> 일본어로 하고 싶은 말을 써 보세요. 틀려도 괜찮아요 — 대화를 마치면 선생님이 문장마다 고쳐 줘요.
> [첫 채팅 시작하기] → NewChatSheet

`PendingCorrectionsCard`(#34 `status=PROPOSED&limit=3`, 0건이면 렌더하지 않음):
```
채택을 기다리는 교정                          ← SectionHeader
┌──────────────────────────────────────────┐
│ 昨日映画を見に行きました          (lang=ja) │ 1줄 truncate
│ 카페에서 주문하기 · 결과 보기 ›             │ 12px ink2 → /study/ai/chat/{chat.id}/review
├──────────────────────────────────────────┤ (최대 3행, 각 행 ≥56px Link)
│ nextCursor 있으면: "더 있어요 — 채팅별 점검 결과에서 확인해요" 12px ink2
└──────────────────────────────────────────┘
```
- 행의 링크 대상: `chat.kind === 'CHAT'` → `…/chat/{id}/review`, `TALK` → task-007 방(그 전엔 CHAT 만 나온다).

#### B. 새 채팅 시트 — `NewChatSheet`

```
Sheet title="새 채팅"
  Field label="제목 (선택)"  input id="chatTitle" 16px
        placeholder="비워 두면 자동으로 정해져요"
        helper: 100자 초과 시 "제목은 100자까지 쓸 수 있어요" (bad 12px)
  BtnRow [시작하기(primary)] [취소(ghost)]
```
- 길이는 **코드포인트**(`Array.from(s).length`)로 검사하고 `maxLength` 속성은 쓰지 않는다(IME 조합 중 잘림·이모지 2칸 계산 방지).
- 제출: #28 `{ kind:'CHAT', title: trimmed || undefined }` → `router.push('/study/ai/chat/' + id)`. 제출 중 버튼 "만드는 중…" + 시트 닫기 막음.
- 400 → 입력 아래 서버 문구 / 그 외 → 시트 안 ErrorBlock(§3-8).

#### C. 채팅방 `/study/ai/chat/[chatId]` — `ChatRoom`

레이아웃(앱 셸 `main` 안에서 **정확히 100%** 를 채워 `main` 은 스크롤되지 않고 목록만 스크롤된다):
```
<div ref=roomRef className="flex h-full min-h-0 flex-col bg-ground" style={{'--kb-inset': …}}>
  ChatRoomHeader           flex-none  52px
  ReviewDoneBar?           flex-none  (reviewedAt 있을 때)
  MessageList              flex-1 min-h-0 overflow-y-auto overscroll-contain   ← 유일한 스크롤
  ReviewNudge?             flex-none  (조건 §아래)
  TurnNotice?              flex-none  (409·429·네트워크 안내 한 줄, 닫기 가능)
  Composer                 flex-none  padding-bottom: max(8px, env(safe-area-inset-bottom)); margin-bottom: var(--kb-inset,0px)
</div>
```

와이어프레임(390px):
```
┌──────────────────────────────────────┐
│ ←  카페에서 주문하기      [표현 점검] ⋯ │ ChatRoomHeader
│    채팅 · 선생님                       │ (부제 12px ink2)
├──────────────────────────────────────┤
│ ✓ 점검을 마친 채팅이에요 · 남은 교정 3  › │ ReviewDoneBar(44px, 탭 → 결과)
├──────────────────────────────────────┤
│          ── 9월 27일 (일) ──           │ 날짜 구분(12px ink2)
│ (선) 선생님                            │ 강사 그룹 첫 말풍선만 아바타·이름
│ ┌───────────────────────────┐         │
│ │ こんにちは！今日は何を       │ 17px ja │
│ │ しましたか？                │         │
│ │ こんにちは！きょうは なにを… │ 14px ink2 (읽기 펼침)
│ └───────────────────────────┘         │
│ [읽기 ▴] [번역 ▾]  ·動詞の過去形  14:02 │ 토글 칩(44px 히트) · 문법 칩 · 시각
│ ┌ 단어 제안 ────────────────┐         │ ProposalCard(ADD_WORD, 해당 메시지 아래)
│ │ 映画 えいが · 영화          │         │
│ │ [단어장에 추가] [괜찮아요]   │         │
│ └───────────────────────────┘         │
│                 ┌──────────────────┐  │
│                 │ 今日は😀楽しかった🎉│  │ 사용자 말풍선(accent-soft, ink)
│                 └──────────────────┘  │
│                    14:03 · [교정 1 ›]  │ 점검 후에만 교정 칩(→ 결과#cr_id)
│ (선) ● ● ●                            │ PendingBubble
│      선생님이 답을 쓰는 중이에요 · 6초   │ role=status
├──────────────────────────────────────┤
│ 대화를 꽤 나눴어요. 표현 점검을 받아 볼까요? [점검 받기] ✕ │ ReviewNudge
├──────────────────────────────────────┤
│ ┌───────────────────────────────┐ (↑)│ Composer: textarea 16px + 보내기 44px
│ │ 일본어로 써 보세요               │    │
│ └───────────────────────────────┘    │
└──────────────────────────────────────┘ safe-area-bottom
```

**ChatRoomHeader**(`BackBar` 공용 컴포넌트 사용):
- 왼쪽 `←` 44×44 `Link href="/study/ai?tab=chat"` `aria-label="채팅 목록으로"`.
- 가운데 제목(17px semibold truncate) + 부제 `채팅 · {teacherName}`(12px ink2). `min-w-0 flex-1`.
- 오른쪽 `ReviewButton`(sm 모양 + 44px 히트):
  | 조건 | 모양 | 동작 |
  |---|---|---|
  | `reviewedAt` 있음 | "점검 결과" ghost | → 결과 화면 |
  | 턴 진행 중(`sending/streaming/detached`) | "표현 점검" `aria-disabled` | 토스트 "선생님 답을 받은 뒤 점검할 수 있어요" |
  | 사용자 메시지 0(`messageCount === 0` 또는 로드된 USER 0) | "표현 점검" `aria-disabled` | 토스트 "먼저 대화를 나눠 보세요" |
  | 그 외 | "표현 점검" soft | → 결과 화면(안내 상태) |
  `disabled` 속성이 아니라 `aria-disabled` + 토스트로 이유를 알린다(눌러도 아무 반응 없는 버튼 금지).
- ⋯ 44×44 `aria-label="채팅 메뉴"` → `ChatMenuSheet`.

**ReviewDoneBar**(`reviewedAt` 있을 때, 44px 행 전체 Link → 결과):
- "✓ 점검을 마친 채팅이에요" + 남은 교정(로드된 USER 메시지 `corrections` 중 PROPOSED 수) > 0 이면 " · 남은 교정 {n}" + `pendingProposals > 0` 이면 " · 제안 {m}" + `›`. `bg-good-soft text-good`(5.27).

**MessageList**:
- `role="log" aria-label="대화 내용" aria-live="polite" aria-relevant="additions"`, `px-4 py-3`, `[overflow-anchor:none]`(스크롤은 코드가 관리).
- 맨 위: 이전 메시지 커서가 있으면 [이전 메시지 보기](ghost sm, 44px) — 누르면 앞에 붙이고 스크롤 위치 유지(붙이기 전 `scrollHeight` 차이만큼 `scrollTop` 보정). 커서 규약은 §3-11 ②.
- 빈 방(메시지 0) → `RoomIntro`:
  ```
  (선) {teacherName}에게 일본어로 말을 걸어 보세요.
  채팅에서는 바로 고치지 않아요. 대화를 마치고 '표현 점검'을 누르면 문장마다 고쳐 줘요.
  [こんにちは。はじめまして。] [今日はいい天気ですね。] [週末に映画を見ました。]   ← 가로 칩, overflow-x:auto 숨김 스크롤바, 칩 높이 44px, lang=ja
  ```
  칩을 누르면 입력창을 채운다(자동 전송하지 않음).
- 날짜 구분: KST 날짜가 바뀌는 메시지 앞에 `── 9월 27일 (일) ──`.
- 말풍선 그룹: 같은 역할이 5분 안에 이어지면 한 그룹 — 강사 아바타·이름은 그룹 첫 말풍선에만, 시각은 그룹 마지막 말풍선에만(12px `ink2`).
- 자동 스크롤: 첫 로드 → 맨 아래. 새 메시지 → 사용자가 바닥에서 120px 안에 있을 때만 따라 내려간다. 아니면 목록 아래 가운데에 "새 메시지 ↓" 알약(보이는 36px, 히트 44px) → 누르면 맨 아래.
- `ResizeObserver`(목록 컨테이너): 높이가 줄 때(키보드 열림) 바닥에 붙어 있었으면 계속 바닥 유지.

**말풍선**(`MessageBubble.tsx`):

| 컴포넌트 | 조건 | 모양·내용 |
|---|---|---|
| `UserBubble` | `role=USER` | 오른쪽 정렬, `max-w-[80%] min-w-0 rounded-2xl rounded-br-md bg-accent-soft px-3.5 py-2.5 text-ink`, 본문 `lang="ja"` 17px `whitespace-pre-wrap [overflow-wrap:anywhere]`. 아래 줄: 시각 · 로컬 `SENDING` 이면 "보내는 중…" · 교정이 있으면 `CorrectionChip` |
| `CorrectionChip` | 점검 후 `corrections.length>0` | PROPOSED 남음 → neutral 뱃지 "교정 {n} ›" / 전부 처리 → good "교정 확인함 ›". Link → `…/review#cr_{첫 교정 id}` |
| `TutorBubble` | `role=ASSISTANT, status=DONE` | 왼쪽, `max-w-[85%] min-w-0 rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-2.5`. 본문 17px ja. 읽기 펼침이면 아래 14px ink2 ja. 번역 펼침이면 구분선 아래 한국어 15px ink2 `break-keep`. 말풍선 아래 줄: `[읽기 ▴/▾]` `[번역 ▾/▴]`(텍스트 버튼, `aria-expanded`, 높이 44px) · `learning.grammarPoint` 가 있으면 neutral 칩(ja 12px) · 시각 |
| `PendingBubble` | 턴 `streaming/detached` 이거나 마지막이 `status=PENDING` | 왼쪽 점 3개 애니메이션(`prefers-reduced-motion` 이면 정지) + 단계 문구(§3-8 ⓑ). 5초부터 경과 초 표시, 12초부터 "조금 오래 걸리고 있어요". `role="status"` |
| `FailedBubble` | 마지막 강사 메시지 `status=FAILED` (또는 폴링 종료 후에도 PENDING) | `bg-bad-soft text-bad` 박스: 문구(§3-8 ⓒ) + [다시 받기](retryable 일 때) → `resume()` |
| `FailedLine` | FAILED 이지만 마지막이 아님 | 한 줄 12px ink2 "답을 받지 못한 메시지예요"(재시도 버튼 없음 — 뒤에 대화가 이어졌다) |

- 강사 아바타: 28px 원 `bg-accent-soft text-ink`, `teacherName` 첫 글자(`Array.from(name)[0]`). 이름 12px ink2.
- 스크린리더: 각 말풍선 앞에 `sr-only` "나:" / "{teacherName}:".
- `ADD_WORD` 제안은 `proposal.messageId` 가 같은 `TutorBubble` 바로 아래에 `ProposalCard` 로 붙인다(§G).

**ReviewNudge**(입력창 바로 위 한 줄, 44px): 조건 = `!reviewedAt && 턴 idle && (USER 메시지 ≥ 5 || 직전 done.endOfTopic) && 이 방에서 닫지 않음(sessionStorage kaiwa.chat.nudge.{id})`.
"대화를 꽤 나눴어요. 표현 점검을 받아 볼까요?" [점검 받기](→ 결과 화면) [✕](`aria-label="닫기"`).

**Composer**:
```
<form onSubmit={send} className="flex items-end gap-2 border-t border-line bg-surface px-3 pt-2">
  <textarea lang="ja" rows=1 enterKeyHint="send" spellCheck={false} autoComplete="off"
            aria-label="메시지 입력" placeholder={placeholder}
            className="min-w-0 flex-1 resize-none rounded-xl border border-line bg-surface px-3 py-2.5 text-[16px] leading-6"
            style={{ maxHeight: 5줄(≈136px) }}  ← 입력에 맞춰 자동 높이, 넘치면 내부 스크롤 />
  <button type="submit" aria-label="보내기" onPointerDown={e => e.preventDefault()}
          className="grid h-11 w-11 flex-none place-items-center rounded-full bg-accent text-on-accent" />
</form>
{count ≥ 900 && <p className="px-3 text-[12px]">{count}/1000</p>}   ← 1000 초과 시 bad 색 + "1,000자까지 보낼 수 있어요"
```
- 보내기 버튼 `onPointerDown preventDefault` — 버튼을 눌러도 입력창 포커스가 유지되어 **키보드가 내려가지 않는다**.
- 보내기 불가 조건: `text.trim()===''` · 코드포인트 >1000 · 턴 진행 중 · 429 카운트다운 중. 불가일 때 버튼은 `aria-disabled` + 흐리게(`opacity-40`), 입력창은 계속 쓸 수 있다(다음 말 미리 쓰기).
- Enter: 포인터가 정밀한 기기(`matchMedia('(pointer: fine)')`, 데스크톱)에서만 Enter=보내기·Shift+Enter=줄바꿈. **`e.nativeEvent.isComposing` 또는 `keyCode===229` 이면 무시**(일본어 IME 변환 확정 Enter 로 보내지는 사고 방지). 모바일은 Enter=줄바꿈, 보내기는 버튼만.
- placeholder: 기본 "일본어로 써 보세요" / 점검 후 "계속 대화할 수 있어요 (새 메시지는 점검되지 않아요)" / 턴 진행 중에도 동일.
- 초안 보존: `sessionStorage kaiwa.chat.draft.{chatId}`(입력 300ms 디바운스 저장, 마운트 시 복원, `accepted` 후 삭제). 저장소가 막혀도 동작해야 한다(try/catch).
- 글자 수는 코드포인트 기준, 서버와 같은 1~1,000. 줄바꿈은 그대로 보낸다(§3-11 ⑩).

**TurnNotice**(입력창 위 한 줄, 닫기 가능, `role="alert"`): 409·429·보내기 전 네트워크 실패 문구(§3-8 ⓐ). 429 는 남은 초를 1초마다 줄이고 0 이 되면 자동으로 사라진다.

**ChatMenuSheet**(⋯):
```
Sheet title="채팅 메뉴"
  [제목 바꾸기]          → 같은 시트 안에서 input(현재 제목) + [저장][취소] → #30
  [읽기 항상 펼치기]      role=switch aria-checked  → localStorage kaiwa.chat.readingDefault
  [채팅 삭제] (danger)   → 같은 시트 안에서 확인 단계:
      "이 채팅을 삭제할까요?"
      "메시지와 교정·제안이 함께 지워져요. 이미 남긴 공부 기록은 그대로 남아요."
      BtnRow [삭제(danger)] [취소]  → #31 → router.replace('/study/ai?tab=chat')
```
- 턴 진행 중에는 [채팅 삭제] `aria-disabled` + 토스트 "답을 받는 중에는 지울 수 없어요".

#### D. 점검 결과 `/study/ai/chat/[chatId]/review` — `ChatReview`

```
BackBar  ← (→ 방)  title="표현 점검"  subtitle={chat.title}
<div className="px-4 pb-8">
  switch (state)
    'loading' → LoadingBlock
    'notFound' → ErrorBlock "채팅을 찾을 수 없어요" + [채팅 목록으로]
    'notChat' → 안내 "표현 점검은 채팅에서만 할 수 있어요" (TALK 는 대화 중에 바로 교정)
    'intro'   → ReviewIntro
    'running' → ReviewProgress
    'error'   → ErrorBlock(§3-8 ⓓ) + [다시 점검하기]
    'result'  → ReviewResult
</div>
```

`ReviewIntro`:
```
Card
  "지금까지의 대화를 점검할까요?"                      17px semibold
  "메시지 {chat.messageCount}개가 오간 대화예요. 내가 쓴 문장을 하나씩 보고 틀린 곳을 고쳐 줘요."
  ⓘ "점검은 채팅마다 한 번만 할 수 있어요. 점검 뒤에 이어서 쓴 메시지는 점검되지 않아요."   (bg-surface2 ink2 13px)
  [점검 받기] primary full
  [대화로 돌아가기] ghost full
사용자 메시지 0 → [점검 받기] aria-disabled, 안내 "먼저 대화를 나눠 보세요" + [대화로 돌아가기]
```

`ReviewProgress`:
```
Card  role=status aria-live=polite
  점 3개 애니메이션 + "선생님이 문장을 하나씩 살펴보고 있어요"
  경과 "{n}초"  · (잡 progress > 0 이면 막대 h-1.5 rounded bg-surface2 / 채움 bg-accent, aria-valuenow)
  n ≥ 30 → "메시지가 많으면 1분 넘게 걸릴 수 있어요"
  "화면을 나가도 점검은 계속돼요. 나중에 이 채팅에서 결과를 볼 수 있어요."   ← §3-11 ③ 확정 시에만. 아니면 "점검이 끝날 때까지 이 화면에 있어 주세요"
```

`ReviewResult`:
```
p.caption  "선생님의 교정은 제안이에요. 채택한 것만 내 기록과 단어장에 남아요."   (13px ink2)
ReviewSummary
  Card
    "총평"  summaryKo (15px break-keep)
    잘한 점  strengths[] → ul, 각 행 앞 good 점    (값 없으면 이 블록 숨김)
    집중할 점 focus[]   → ul, 각 행 앞 bad 점      (값 없으면 숨김)
    카운트 줄 "교정 {total}건 · 채택 {a} · 무시 {r} · 남음 {p}"  12px ink2
    skippedMessages > 0 → "메시지가 많아 오래된 메시지 {k}개는 점검하지 않았어요."  12px ink2
ProposalCard kind=ADD_STUDY_LOG          ← 있으면 요약 바로 아래(스크롤 끝에서 놓치지 않게)
total === 0 →
    EmptyBlock(ink2) "고칠 곳을 찾지 못했어요. 자연스럽게 잘 썼어요!"
else →
    Segmented ariaLabel="교정 보기" [남은 교정 {p} | 전체 {total}]   ← 기본: p>0 ? 남은 : 전체
    ul → CorrectionCard × n  (id="cr_{id}", 해시로 들어오면 그 카드로 스크롤 + 2초 테두리 강조)
[대화로 돌아가기] ghost full
```
- 카드 순서 = 메시지 순서(§3-11 ⑤). 번호 "1/12"(12px ink2)를 카드 왼쪽 위에.
- `dropped`(원문 불일치로 버린 수)는 **표시하지 않는다**(내부 품질 지표).

#### E. 교정 카드 — `CorrectionCard`

```
<li id="cr_{id}" className="@container min-w-0 rounded-[14px] border border-line bg-surface p-3.5">
  머리줄: [조사](neutral) [중요](bad, MAJOR만) · 꾸밈 조각(12px ink2)        상태 뱃지(오른쪽): 채택함(good)/무시함(neutral)/기한 지남(neutral)
  본문 grid: grid-cols-1 gap-2.5 @min-[320px]:grid-cols-2
    ┌ 내 문장 ────────────┐ ┌ 이렇게 고쳐요 ───────┐   라벨 12px: ink2 / good
    │ 昨日映画を見に行くま │ │ 昨日映画を見に行きま │   17px lang=ja, pre-wrap, overflow-wrap:anywhere
    │ した  (くま 강조)    │ │ した  (きま 강조)    │
    └────────────────────┘ └────────────────────┘   상자: bg-surface2 rounded-xl p-2.5
  설명: explanation  15px ink2 break-keep
  PROPOSED → BtnRow [채택(primary)] [무시(ghost)]   (md 48px — 44px 미달 sm 금지)
  ACCEPTED → "채택했어요" + (savedWordId ? " · 단어장에 저장했어요" : "")   13px good
  REJECTED → "무시했어요 · 기록에 남지 않았어요"  13px ink2
</li>
```
- **바뀐 글자 강조**(`diff.ts`): 원문·교정문 모두 ≤200 코드포인트일 때만 코드포인트 LCS 로 구한다. 원문에서 빠진 글자 = `bg-bad-soft text-bad line-through decoration-1`, 교정문에서 새 글자 = `bg-good-soft text-good underline decoration-2 underline-offset-4`. 색 + 선 모양 두 가지로 구분(색만 쓰지 않음). 표시만 바꾸며 **문자열 자체는 한 글자도 바꾸지 않는다**(원문 무수정 원칙). 200 초과·계산 실패면 강조 없이 그대로 보여 준다.
- 라벨(§3-8 ⓔ). 심각도 MINOR 는 뱃지를 달지 않는다(시끄럽지 않게), MAJOR 만 "중요".
- 카드 폭 <320px(= 뷰포트 360) → 위아래, 390·412 → 나란히.
- 처리 중(채택 시트 제출·무시 요청)엔 두 버튼 모두 `aria-disabled`.
- [무시] 는 확인 없이 바로 #36 → 토스트 "무시했어요 · 기록에 남지 않아요".

#### F. 교정 채택 시트 — `AcceptCorrectionSheet`

```
Sheet title="교정 채택"
  "이렇게 고쳐요"(12px good)  corrected (17px ja, bg-surface2 rounded-xl p-2.5)
  "채택하면 선생님이 내가 자주 틀리는 부분으로 기억해요."            13px ink2
  hr
  "단어장에도 넣을까요? (선택)"                                    15px semibold
  Field "표현"   input lang=ja  기본값 = corrected(≤80 코드포인트일 때), 아니면 ''
  Field "읽기"   input lang=ja  기본값 '' placeholder "히라가나 (선택)"
  Field "뜻"     input          기본값 '' placeholder "한국어 뜻 (예: 어제 영화를 보러 갔어요)"
  Field "분류"   input          기본값 "교정"
  [단어장에 넣고 채택]   primary full  — 표현 1~80 · 뜻 1~200 · 읽기 ≤120 · 분류 ≤40 을 만족할 때만 활성
  [단어장 없이 채택만]   ghost full
  (취소 = 시트 머리 ✕ 또는 배경 탭 — 제출 중엔 닫기 막음)
```
- 제출 본문(#35):
  - 단어장 포함: `{ addWord: { surface, reading: reading||undefined, meaning, category: category||undefined, partOfSpeech: surface===corrected ? 'EXPRESSION' : undefined, chunkType: correction.chunkType ?? undefined } }`
  - 단어장 없이: `{}`
- 성공 → 시트 닫기, 카드 `ACCEPTED`(+`savedWordId`), 토스트 "채택했어요" / "채택하고 단어장에 넣었어요".
- 409 + `details.existingId` → 시트 유지, "표현" 아래 bad 문구 "단어장에 같은 표현이 이미 있어요" + [단어장 없이 채택만] 을 강조(primary 로 승격).
- 409(그 외) → 시트 닫기, 토스트 "이미 처리된 교정이에요", 교정 목록 다시 읽기.
- 400 → `details.field` 에 맞는 입력 아래 서버 문구.
- 첫 입력(표현)에 자동 포커스하지 않는다(키보드가 시트를 가리지 않게) — 사용자가 누를 때만.

#### G. 제안 카드 — `ProposalCard`

**ADD_WORD**(방, 해당 강사 말풍선 아래 · 왼쪽 정렬 · `max-w-[85%]`):
```
Card flat=false
  머리: "단어 제안" (12px ink2)
  surface (18px semibold ja)  reading (14px ink2 ja)
  meaning (15px)
  "선생님 제안이에요. 추가를 눌러야 단어장에 저장돼요."   12px ink2
  PROPOSED → BtnRow [단어장에 추가(primary)] [괜찮아요(ghost)]
             [✎ 뜻 고쳐서 추가] 텍스트 버튼(44px) → 뜻 input(기본값 meaning) 펼침 → 추가 시 payloadOverride:{meaning}
  ACCEPTED → 한 줄 "✓ 단어장에 추가했어요 · {surface}"  (good 13px)
  REJECTED → 한 줄 "건너뛴 단어 제안 · {surface}"  (ink2 12px)
  EXPIRED  → 한 줄 "기한이 지난 제안 · {surface}"  (ink2 12px)
```

**ADD_STUDY_LOG**(결과 화면):
```
Card
  "공부 기록 남기기"   15px semibold
  "이 채팅을 공부 기록으로 남길까요?"
  "메시지 {payload.messageCount}개 · 교정 {payload.correctionCount}건"   (값 없으면 줄 생략)
  "남기면 달력과 통계에 기록돼요. 선생님 제안이라 남기기를 눌러야 저장돼요."   12px ink2
  PROPOSED → BtnRow [기록 남기기(primary)] [남기지 않기(ghost)]
  ACCEPTED → "✓ 공부 기록에 남겼어요"(good)   REJECTED → "기록하지 않았어요"(ink2)   EXPIRED → "기한이 지난 제안이에요"(ink2)
```
- 채택 #38, 거절 #39. 결과 반영 후 카드 상태만 바꾼다(목록 전체 재조회 불필요).
- 409 → `details.status==='EXPIRED'` 이면 "기한(30일)이 지난 제안이라 채택할 수 없어요", 그 외 "이미 처리된 제안이에요" → 제안 다시 읽기. ADD_WORD 의 409 + `details.existingId` → "단어장에 이미 있는 단어예요" (카드는 PROPOSED 유지, [괜찮아요]로 닫을 수 있음).

#### H. 공용 바텀시트 — `Sheet`(`src/components/common/Sheet.tsx`)

- `role="dialog" aria-modal="true" aria-labelledby`, 배경 `bg-ink/40` 탭 닫기(`dismissible=false` 면 막음), Esc 닫기, 열릴 때 시트 제목에 포커스, 닫힐 때 여는 버튼으로 포커스 복귀.
- 시트: `fixed inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl bg-surface`, 내용 `overflow-y-auto`, `padding-bottom: max(16px, env(safe-area-inset-bottom))`, 폭 ≥900px 이면 가운데 480px.
- 머리: 제목 17px semibold + ✕ 44×44 `aria-label="닫기"`.
- 열려 있는 동안 뒤 목록 스크롤 잠금(`roomRef`/`main` 에 `overflow:hidden`).

### 3-3. 상태 관리

#### 턴 — `useChatTurn(chatId)` (참고: bjj `web/src/contexts/MasterContext.jsx` 의 `idle|streaming|detached` 와 `MasterPanel.jsx` 의 resumePending 재시도)

```
phase: 'idle' | 'sending' | 'streaming' | 'detached' | 'failed'
stage: 'PROMPT'|'LLM'|'PARSE'|'TTS'|null ; startedAt ; notice: {kind, text, retryAfterSec?} | null
```

| 현재 | 사건 | 다음 | 화면 처리 |
|---|---|---|---|
| idle/failed | `send(text)` | sending | 임시 사용자 말풍선(`tmp_…`, 로컬 `SENDING`) 추가, 입력창 비움 |
| sending | 봉투 응답(비 SSE, 4xx/5xx) | idle | 임시 말풍선 제거, **입력창이 비어 있을 때만** 원문 복원, TurnNotice(§3-8 ⓐ) |
| sending | fetch 예외(네트워크) | idle | 위와 같음, "보내지 못했어요…" |
| sending | `accepted` | streaming | 임시 id → `userMessageId`, `PENDING` 강사 말풍선(`assistantMessageId`) 추가, 초안 삭제 |
| streaming | `status` | streaming | `stage` 갱신(`warning` 필드는 CHAT 에선 무시) |
| streaming | `done` | idle | PENDING 말풍선을 `done` 값으로 교체(`content=conversation.replyJa, reading=replyReading, translation=replyKo, learning, status=DONE`), `proposals` 를 그 메시지에 붙임, `endOfTopic` 기억(Nudge), `chat.messageCount += 2` |
| streaming | `error` | failed | 강사 말풍선 `FAILED` + 코드별 문구·`retryable` |
| streaming | 스트림이 `done/error` 없이 끝남 / reader 예외 / `visibilitychange→hidden` 후 복귀 시 끊김 | detached | 폴링 시작 |
| detached | 폴링 응답 `running=false` | idle 또는 failed | 이번 턴 메시지들을 서버 값으로 upsert. 마지막 강사 `DONE` → idle + #37 재조회(제안) / `FAILED`·`PENDING` → failed |
| detached | 폴링 200초 초과 | failed | "답을 확인하지 못했어요" + [다시 받기] |
| failed | `resume()` | sending | `{resumePending:true}` — **임시 사용자 말풍선을 만들지 않는다**. `accepted` 에서 실패 말풍선을 새 PENDING 으로 교체 |

- **방에 들어왔을 때** `chat.running === true` → 곧바로 detached(폴링). 마지막 강사 메시지가 `FAILED`(또는 `running=false` 인데 `PENDING`) → failed 로 시작(자동 재시도하지 않는다 — 사용자가 [다시 받기]).
- 폴링: `GET #29 ?after={turnBaseId}&limit=50`(`turnBaseId` = 이번 사용자 메시지 직전 메시지 id, 첫 턴이면 `after` 없이). 간격 2.5s(처음 30초) → 5s, 응답마다 id 기준 upsert. `document.visibilityState` 가 visible 로 바뀌면 즉시 한 번 더 부른다. 방을 떠나면(언마운트) 타이머 정리.
- SSE 요청은 `EventSource` 가 아니라 `fetch` POST + `ReadableStream` 파싱(`sse.ts`). `Content-Type` 이 `text/event-stream` 이 아니면 봉투로 읽어 `ApiError` 로 던진다. `: ping` 주석 줄은 무시. 언마운트 시 `AbortController.abort()` — 서버는 끝까지 처리하므로 돌아오면 폴링으로 이어 붙는다.
- 429: `ApiError.details.retryAfterSec`(또는 `Retry-After` 헤더) 동안 보내기 막음 + 카운트다운.
- `traceId` 는 상태에 둘 수는 있지만 **DOM·토스트·콘솔에 출력하지 않는다.**

#### 방 데이터 — `ChatRoom`

- 첫 로드 병렬: #29 `?limit=50` + #37 `?chatId={id}`(상태 필터 없음 = 전부). 제안은 `kind=ADD_WORD` 를 `messageId` 로 말풍선에 붙이고, `ADD_STUDY_LOG` 는 방에서 그리지 않는다(`pendingProposals` 수만 ReviewDoneBar 에).
- 읽기 기본값: `localStorage kaiwa.chat.readingDefault`(try/catch, 기본 'on'). 말풍선별 펼침은 컴포넌트 로컬 상태.
- 탭이 다시 보일 때(visible) 턴이 idle 이면 `#29 ?after={마지막 id}` 로 새 메시지만 당겨 온다(다른 기기에서 쓴 경우).
- 404 → 방 대신 "채팅을 찾을 수 없어요. 삭제되었을 수 있어요." + [채팅 목록으로].

#### 점검 — `ChatReview`

```
state: 'loading'|'notFound'|'notChat'|'intro'|'running'|'result'|'error'
run: { mode: 'sync'|'job'|'waiting', jobId?, startedAt, progress? }
```
1. `loading`: #29 `?limit=1`(제목·`kind`·`reviewedAt`·`messageCount`) + `sessionStorage kaiwa.review.job.{chatId}` 확인.
2. `kind≠CHAT` → notChat. `reviewedAt` 있음 → `loadResult()`. 저장된 jobId 있음 → running(job). 아니면 intro.
3. [점검 받기] → running(sync) → #33 POST(중단하지 않는다):
   - `items` 응답 → result(응답으로 바로 그리고, #37 `?chatId=&kind=ADD_STUDY_LOG` 로 제안 카드만 추가 조회).
   - `jobId` 응답 → sessionStorage 저장 → running(job) → #55 폴링 2s → 5s. `DONE` → `loadResult()` + jobId 삭제 / `FAILED` → error + jobId 삭제.
   - `409` → #29 재조회: `reviewedAt` 있으면 `loadResult()`, 없으면 running(waiting) → 3초마다 #29 로 `reviewedAt` 확인(최대 180초, 초과 시 error "점검 상태를 확인하지 못했어요" + [다시 확인]).
   - 네트워크 예외 → 서버가 계속 처리 중일 수 있으므로 `409` 와 같은 waiting 경로(최대 120초).
   - `400` → intro 로 돌아가 서버 문구 표시. `422/502/504` → error + [다시 점검하기](`reviewedAt` 이 없으니 다시 POST 가능).
4. `loadResult()`: #34 `?chatId={id}&limit=100` 를 `nextCursor` 가 없을 때까지(최대 3쪽) + #37 `?chatId={id}&kind=ADD_STUDY_LOG`. 요약(`summaryKo·focus·strengths·skippedMessages`)은 동기 응답이 있으면 그것, 재방문·잡 경로면 ADD_STUDY_LOG `payload` 에서 읽는다(없는 값의 블록은 숨김).
5. 결과 화면의 카드 상태 변경은 로컬로만 반영(재조회 없음). 409 때만 해당 목록을 다시 읽는다.
6. 동기 응답 필드 정규화: `correctionId → id`, `explanation`/`explanationKo` → `explanation`.

#### 홈

- `initialTab` 은 서버 `searchParams` 에서 받아 props 로 넘긴다(`useSearchParams` Suspense 경계 불필요). 전환은 `router.replace`.
- 목록 #27 과 교정 요약 #34 병렬. 목록은 마운트·visible 복귀 때만 새로 읽는다(자동 폴링 없음).

### 3-4. API 호출 계획

| # | 엔드포인트 | 메서드 | 화면 동작 | 파라미터 | 사용 필드 | 오류 처리 |
|---|---|---|---|---|---|---|
| 27 | `/api/v1/chats` | GET | 홈 채팅 목록·더 보기 | `kind=CHAT&limit=20&cursor=` | `items[].{id,title,preview,lastMessageAt,messageCount,reviewedAt,running}`, `nextCursor` | ErrorBlock + 다시 시도 |
| 28 | `/api/v1/chats` | POST | 새 채팅 시트 | `{kind:'CHAT', title?}` | `id` | 400 입력 아래 / 그 외 시트 안 ErrorBlock |
| 29 | `/api/v1/chats/:id` | GET | 방 로드·턴 폴링·visible 동기화·점검 화면 상태 | `limit=50`, `after=`(폴링) | `chat.{title,kind,running,reviewedAt,messageCount}`, `messages[]`(+`corrections`, `learning`), `pendingProposals`, `nextCursor` | 404 → 찾을 수 없음 화면 |
| 30 | `/api/v1/chats/:id` | PATCH | 메뉴 제목 바꾸기 | `{title}`(1~100 코드포인트) | `title` | 400 입력 아래 |
| 31 | `/api/v1/chats/:id` | DELETE | 메뉴 채팅 삭제 | — | `deleted` | 토스트 |
| 32 | `/api/v1/chats/:id/turns` | POST(SSE) | 보내기·다시 받기 | `{text, inputSource:'TEXT'}` / `{resumePending:true}` | `accepted`·`status`·`done`(conversation·learning·proposals·endOfTopic)·`error`(code·retryable) | §3-3 표 + §3-8 ⓐⓒ |
| 33 | `/api/v1/chats/:id/review` | POST | [점검 받기] | — | `items[]`·`summaryKo`·`strengths`·`focus`·`skippedMessages`·`reviewedAt` 또는 `jobId` | §3-3 점검 3 |
| 34 | `/api/v1/corrections` | GET | 홈 교정 요약 / 결과 화면 카드 | `status=PROPOSED&limit=3` / `chatId=&limit=100&cursor=` | `id,status,original,corrected,explanation,errorType,severity,chunkType,savedWordId,chat{id,title,kind}` | 홈: 조용히 숨김 / 결과: ErrorBlock |
| 35 | `/api/v1/corrections/:id/accept` | POST | 채택 시트 | `{addWord?}` | `correction.{status,savedWordId}` | 409(existingId / 처리됨)·400 §F |
| 36 | `/api/v1/corrections/:id/reject` | POST | [무시] | — | `status` | 409 → 재조회 |
| 37 | `/api/v1/proposals` | GET | 방(단어 제안) / 결과(공부 기록 제안) | `chatId=` / `chatId=&kind=ADD_STUDY_LOG` | `id,kind,payload,status,messageId` | 조용히 빈 목록 |
| 38 | `/api/v1/proposals/:id/accept` | POST | [단어장에 추가]·[기록 남기기] | `{payloadOverride?:{meaning}}` | `proposal.{status,result}` | 409 §G |
| 39 | `/api/v1/proposals/:id/reject` | POST | [괜찮아요]·[남기지 않기] | — | `status` | 409 → 재조회 |
| 55 | `/api/v1/jobs/:id` | GET | 점검 잡 진행 | — | `status,progress,stage` | 404 → jobId 지우고 #29 로 상태 확인 |
| 11 | (서버 컴포넌트) `preferences.getProfile` | — | 방·결과 페이지가 `teacherName` 을 props 로 | — | `teacherName`(없으면 "선생님") | — |

- 일반 호출은 `src/components/common/api.ts` 의 `apiGet/apiPost/apiPatch/apiDelete`. SSE 는 같은 파일에 **`apiStream(path, body, {signal})`** 을 추가해 헤더(`X-Client-Platform`)·401 로그인 이동·봉투 오류 해석을 공유한다(§3-6).
- 화면 분기는 **HTTP status 우선**, `ApiError.code` 는 보조. 서버가 새 코드(`FEATURE_NOT_READY` 등)를 더하면 `src/types/api.ts` 의 `ApiErrorCode` 에 추가한다.

### 3-5. 컴포넌트 분해 (`src/components/chat/*`)

| 컴포넌트/모듈 | 종류 | props | 상태 |
|---|---|---|---|
| `StudyAiHome` | client | `{ initialTab: 'chat'\|'talk' }` | `tab` |
| `TalkComingSoon` | client | `{ onGoChat(): void }` | — |
| `ChatList` | client | `{ kind: 'CHAT'\|'TALK' }`(task-007 재사용) | `items, nextCursor, loading, loadingMore, error` |
| `ChatListItem` | client | `{ chat: ChatSummary; href: string }` | — |
| `PendingCorrectionsCard` | client | — | `items, hasMore`(오류 시 숨김) |
| `NewChatSheet` | client | `{ open; onClose() }` | `title, submitting, error` |
| `ChatRoom` | client | `{ chatId: string; teacherName: string }` | `chat, messages, proposals, olderCursor, loadError, readingDefault, sheet` + `useChatTurn` |
| `ChatRoomHeader` | client | `{ title; subtitle; reviewState: 'none'\|'done'; turnBusy; userMessageCount; chatId; onMenu() }` | — |
| `ReviewDoneBar` | client | `{ chatId; remaining: number; pendingProposals: number }` | — |
| `MessageList` | client | `{ messages; proposals; teacherName; readingDefault; turn; olderCursor; onLoadOlder(); onRetry(); onProposalChange(p) }` | `atBottom, showNewPill` |
| `MessageBubble`(UserBubble·TutorBubble·PendingBubble·FailedBubble·FailedLine·CorrectionChip) | client | 메시지 1개 + 필요한 콜백 | `showReading, showTranslation`(TutorBubble) |
| `RoomIntro` | client | `{ teacherName; onPick(text) }` | — |
| `ReviewNudge` | client | `{ chatId; onDismiss() }` | — |
| `TurnNotice` | client | `{ notice; onClose() }` | 429 카운트다운 |
| `Composer` | client | `{ chatId; busy: boolean; blockedUntil?: number; placeholder; onSend(text): void; fillRef }` | `text`(초안 복원·저장) |
| `ChatMenuSheet` | client | `{ open; chat; turnBusy; readingDefault; onClose(); onRenamed(title); onReadingDefault(v) }` | `mode: 'menu'\|'rename'\|'confirmDelete', busy, error` |
| `ChatReview` | client | `{ chatId: string; teacherName: string }` | §3-3 점검 상태 |
| `ReviewIntro` · `ReviewProgress` · `ReviewSummary` | client | 표시 전용 | 경과 초 타이머(Progress) |
| `CorrectionCard` | client | `{ correction; index; total; onAccept(c); onReject(c); busy }` | — |
| `AcceptCorrectionSheet` | client | `{ correction \| null; onClose(); onDone(updated) }` | `form{surface,reading,meaning,category}, submitting, fieldError, duplicate` |
| `ProposalCard` | client | `{ proposal; onChange(updated) }` | `busy, editMeaning, meaning` |
| `useChatTurn` | hook | `(chatId, { onMessages, onProposals })` | §3-3 턴 |
| `useKeyboardInset` | hook | `(ref)` | `--kb-inset` 을 방 루트에만 기록 |
| `sse.ts` | 순수 | `readSse(stream, onEvent)` | — |
| `diff.ts` | 순수 | `diffCodepoints(a, b, max=200)` → `{ a: Seg[], b: Seg[] } \| null` | — |
| `labels.ts` | 순수 | 오류유형·심각도·조각·상태·단계·오류 문구 표(§3-8) | — |
| `format.ts` | 순수 | `formatListTime(iso)`, `formatDateDivider(iso)`, `cpLength(s)` (KST, `Intl` `timeZone:'Asia/Seoul'`) | — |
| `types.ts` | 타입 | `ChatSummary, ChatDetail, ChatMessage(+localStatus), Correction, Proposal, TurnEvent` | — |

공용(채팅 밖):
- `src/components/common/Sheet.tsx` — §H.
- `src/components/shell/BackBar.tsx` — `{ backHref; backLabel; title; subtitle?; right? }`, 52px, `bg-surface`, 흐름 배치(방은 flex 칼럼의 첫 줄, 결과 화면은 `sticky top-0`). task-008 하위 화면에서도 쓴다.

### 3-6. 생성/수정 파일 목록

신규
- `src/app/(app)/study/ai/chat/[chatId]/page.tsx` — 서버: `params`(Promise) → `auth()` + `getProfile(userId).teacherName` → `<ChatRoom chatId teacherName />`
- `src/app/(app)/study/ai/chat/[chatId]/review/page.tsx` — 같은 방식 → `<ChatReview … />`
- `src/components/chat/` — §3-5 전부
- `src/components/chat/__tests__/{sse,diff,format}.test.ts` — 순수 함수(node test runner, `*.test.ts`)
- `src/components/common/Sheet.tsx`, `src/components/shell/BackBar.tsx`

수정
- `src/app/(app)/study/ai/page.tsx` — `ComingSoon` → `AppBar title="AI와 공부하기"` + `<StudyAiHome initialTab />`(`searchParams` 사용)
- `src/components/shell/TabBar.tsx` — `HIDDEN_PREFIXES = ['/study/ai/chat/']` 에서 `null` 반환
- `src/components/common/api.ts` — `apiStream()` 추가(기존 함수 시그니처 불변)
- `src/app/globals.css` — `:lang(ja)` 규칙(§1-2), 가로 칩용 `.no-scrollbar`(없으면)
- `src/app/layout.tsx` — `viewport.interactiveWidget = 'resizes-content'` (**전역 — Leader 확인 §3-11 ⑦**)
- `src/types/api.ts` — 서버가 새 오류 코드를 쓰면 추가

### 3-7. 구현 순서

1. 순수 모듈: `types.ts`·`labels.ts`·`format.ts`·`sse.ts`·`diff.ts` + 단위 테스트.
2. 공용: `Sheet`·`BackBar`·`api.ts apiStream`·TabBar 숨김·`:lang(ja)`.
3. 홈: `StudyAiHome`·`ChatList(Item)`·`NewChatSheet`·`TalkComingSoon`·`PendingCorrectionsCard`.
4. 방 골격: `ChatRoom` 로드(#29·#37)·`MessageList`·말풍선(읽기·번역 토글)·`Composer`(IME·포커스 유지·초안).
5. 턴: `useChatTurn`(SSE → 상태기계 → 폴링 → 재시도)·`TurnNotice`·429 카운트다운.
6. 키보드: viewport `interactive-widget` + `useKeyboardInset` → 360/390/412 + 실기기 Chrome 확인.
7. 메뉴: 제목 바꾸기·읽기 기본값·삭제.
8. 점검: `ChatReview` 상태기계(동기·잡·409·재방문)·`ReviewSummary`.
9. `CorrectionCard`(diff 강조·컨테이너 쿼리)·`AcceptCorrectionSheet`·`ProposalCard` 2종·`ReviewDoneBar`·`CorrectionChip`·`ReviewNudge`.
10. §3-9 체크리스트 자체 점검 → reviewer 인계.

### 3-8. 한국어 UI 문구

ⓐ **보내기·턴(봉투 오류, 입력창 위 TurnNotice)** — 서버 `message` 대신 이 표를 쓴다(400 만 예외)

| 상황 | 문구 |
|---|---|
| 400 VALIDATION | 서버 문구 그대로(예: 길이·빈 입력 안내) |
| 404 | 이 채팅을 찾을 수 없어요. 삭제되었을 수 있어요. [채팅 목록으로] |
| 409 CONFLICT(다른 턴 진행 중) | 선생님이 다른 메시지에 답하는 중이에요. 답이 끝나면 다시 보내 주세요. |
| 429 | 메시지를 너무 빨리 보냈어요. {n}초 뒤에 다시 보내 주세요. |
| 422 | 지금은 선생님이 답할 수 없어요. 잠시 후 다시 시도해 주세요. |
| 502 | 선생님 답을 받지 못했어요. 다시 시도해 주세요. |
| 504 | 답이 너무 오래 걸려 멈췄어요. 다시 시도해 주세요. |
| 보내기 전 네트워크 실패 | 보내지 못했어요. 네트워크를 확인해 주세요. |
| 보내기 불가 안내(버튼 aria-label) | 보내기 / 선생님 답을 기다리는 중이에요 / {n}초 뒤에 보낼 수 있어요 / 1,000자까지 보낼 수 있어요 |

ⓑ **진행 단계(PendingBubble)**

| 시점 | 문구 |
|---|---|
| `accepted` 직후(단계 없음) | 선생님이 읽고 있어요 |
| `PROMPT` | 선생님이 대화를 읽고 있어요 |
| `LLM` | 선생님이 답을 쓰는 중이에요 |
| `PARSE` | 답을 정리하고 있어요 |
| `TTS` | 목소리를 준비하고 있어요 |
| 5초~ | (위 문구) · {n}초 |
| 12초~ | 조금 오래 걸리고 있어요 · {n}초 |
| detached(폴링) | 연결이 잠시 끊겼어요. 선생님 답을 확인하는 중이에요… |
| 로컬 SENDING(사용자 말풍선 아래) | 보내는 중… |

ⓒ **실패 말풍선(FailedBubble)**

| 상황 | 문구 | 버튼 |
|---|---|---|
| SSE `error` retryable | 선생님 답을 받지 못했어요. | 다시 받기 |
| SSE `error` 422 / retryable=false | 지금은 선생님이 답할 수 없어요. 잠시 후 다시 시도해 주세요. | (없음) |
| SSE `error` 504 | 답이 너무 오래 걸려 멈췄어요. | 다시 받기 |
| 폴링 200초 초과 / 방 진입 시 FAILED | 답을 받지 못했어요. | 다시 받기 |
| 이전 실패(마지막 아님) | 답을 받지 못한 메시지예요 | — |

ⓓ **표현 점검**

| 상황 | 문구 |
|---|---|
| 안내 제목 | 지금까지의 대화를 점검할까요? |
| 안내 본문 | 메시지 {n}개가 오간 대화예요. 내가 쓴 문장을 하나씩 보고 틀린 곳을 고쳐 줘요. |
| 한 번만 | 점검은 채팅마다 한 번만 할 수 있어요. 점검 뒤에 이어서 쓴 메시지는 점검되지 않아요. |
| 버튼 | 점검 받기 / 대화로 돌아가기 / 다시 점검하기 / 다시 확인 |
| 메시지 0 | 먼저 대화를 나눠 보세요 |
| 진행 | 선생님이 문장을 하나씩 살펴보고 있어요 · {n}초 |
| 진행 30초~ | 메시지가 많으면 1분 넘게 걸릴 수 있어요 |
| 진행 중 이탈 | 화면을 나가도 점검은 계속돼요. 나중에 이 채팅에서 결과를 볼 수 있어요. (§3-11 ③ 확정 전엔: 점검이 끝날 때까지 이 화면에 있어 주세요) |
| 다른 점검 진행 중(409) | 이미 점검이 진행 중이에요. 끝나면 결과가 여기에 보여요. |
| 실패(422/502/504·잡 FAILED) | 점검을 끝내지 못했어요. 잠시 후 다시 시도해 주세요. |
| 상태 확인 실패 | 점검 상태를 확인하지 못했어요. |
| 결과 머리 캡션 | 선생님의 교정은 제안이에요. 채택한 것만 내 기록과 단어장에 남아요. |
| 요약 제목 | 총평 / 잘한 점 / 집중할 점 |
| 카운트 | 교정 {t}건 · 채택 {a} · 무시 {r} · 남음 {p} |
| 건너뜀 | 메시지가 많아 오래된 메시지 {k}개는 점검하지 않았어요. |
| 교정 0건 | 고칠 곳을 찾지 못했어요. 자연스럽게 잘 썼어요! |
| 필터 | 남은 교정 {p} / 전체 {t} |
| TALK 채팅 | 표현 점검은 채팅에서만 할 수 있어요. |

ⓔ **라벨**

| 값 | 라벨 | 뱃지 톤 |
|---|---|---|
| ErrorType `GRAMMAR`/`PARTICLE`/`CONJUGATION`/`VOCABULARY`/`POLITENESS`/`NATURALNESS`/`WORD_ORDER`/`OTHER` | 문법 / 조사 / 활용 / 어휘 / 존댓말 / 자연스러움 / 어순 / 기타 | neutral |
| ErrorType `PRONUNCIATION`(교정엔 안 나옴, 방어용) | 발음 | neutral |
| Severity `MAJOR` / `MINOR` | 중요 / (표시 안 함) | bad / — |
| ChunkType `NAME`/`ACTION`/`FEELING`/`MODIFIER` | 이름 조각 / 액션 조각 / 느낌 조각 / 꾸밈 조각 | 12px ink2 글자 |
| Correction·Proposal `ACCEPTED`/`REJECTED`/`EXPIRED` | 채택함 / 무시함 / 기한 지남 | good / neutral / neutral |
| 목록 뱃지 | 답하는 중 / 점검 완료 | neutral+accent 점 / good |

ⓕ **교정 카드·채택 시트·제안**

| 자리 | 문구 |
|---|---|
| 카드 라벨 | 내 문장 / 이렇게 고쳐요 |
| 카드 버튼 | 채택 / 무시 |
| 처리 후 | 채택했어요 · 단어장에 저장했어요 / 무시했어요 · 기록에 남지 않았어요 |
| 무시 토스트 | 무시했어요 · 기록에 남지 않아요 |
| 시트 제목·안내 | 교정 채택 / 채택하면 선생님이 내가 자주 틀리는 부분으로 기억해요. / 단어장에도 넣을까요? (선택) |
| 시트 필드 | 표현 / 읽기(placeholder: 히라가나 (선택)) / 뜻(placeholder: 한국어 뜻 (예: 어제 영화를 보러 갔어요)) / 분류 |
| 시트 버튼 | 단어장에 넣고 채택 / 단어장 없이 채택만 |
| 시트 검증 | 표현을 적어 주세요 (80자 이내) / 뜻을 적어 주세요 (200자 이내) / 읽기는 120자까지 쓸 수 있어요 / 분류는 40자까지 쓸 수 있어요 |
| 성공 토스트 | 채택했어요 / 채택하고 단어장에 넣었어요 |
| 409 | 이미 처리된 교정이에요 / 단어장에 같은 표현이 이미 있어요 |
| 단어 제안 | 단어 제안 / 선생님 제안이에요. 추가를 눌러야 단어장에 저장돼요. / 단어장에 추가 / 괜찮아요 / ✎ 뜻 고쳐서 추가 |
| 단어 제안 처리 후 | ✓ 단어장에 추가했어요 · {surface} / 건너뛴 단어 제안 · {surface} / 기한이 지난 제안 · {surface} |
| 공부 기록 제안 | 공부 기록 남기기 / 이 채팅을 공부 기록으로 남길까요? / 메시지 {n}개 · 교정 {m}건 / 남기면 달력과 통계에 기록돼요. 선생님 제안이라 남기기를 눌러야 저장돼요. / 기록 남기기 / 남기지 않기 |
| 공부 기록 처리 후 | ✓ 공부 기록에 남겼어요 / 기록하지 않았어요 / 기한이 지난 제안이에요 |
| 제안 409 | 이미 처리된 제안이에요 / 기한(30일)이 지난 제안이라 채택할 수 없어요 / 단어장에 이미 있는 단어예요 |

ⓖ **홈·방·메뉴**

| 자리 | 문구 |
|---|---|
| 앱바 / 전환 | AI와 공부하기 / 회화 · 채팅 |
| 회화 준비 중 | 음성 회화는 곧 열려요 / 말하면 선생님이 대답하고, 틀린 표현은 그 자리에서 짚어 줘요. / 지금은 채팅으로 연습해 보세요. / 채팅으로 연습하기 |
| 새 채팅 | ＋ 새 채팅 / 새 채팅 / 제목 (선택) / 비워 두면 자동으로 정해져요 / 시작하기 / 만드는 중… / 제목은 100자까지 쓸 수 있어요 |
| 빈 목록 | 아직 채팅이 없어요 / 일본어로 하고 싶은 말을 써 보세요. 틀려도 괜찮아요 — 대화를 마치면 선생님이 문장마다 고쳐 줘요. / 첫 채팅 시작하기 |
| 목록 | 아직 메시지가 없어요 / 이전 채팅 더 보기 / 어제 |
| 교정 요약 | 채택을 기다리는 교정 / 결과 보기 / 더 있어요 — 채팅별 점검 결과에서 확인해요 |
| 방 헤더 | 채팅 · {teacherName} / 표현 점검 / 점검 결과 / (aria) 채팅 목록으로 · 채팅 메뉴 |
| 방 헤더 토스트 | 먼저 대화를 나눠 보세요 / 선생님 답을 받은 뒤 점검할 수 있어요 |
| 빈 방 | {teacherName}에게 일본어로 말을 걸어 보세요. / 채팅에서는 바로 고치지 않아요. 대화를 마치고 '표현 점검'을 누르면 문장마다 고쳐 줘요. |
| 입력창 | 일본어로 써 보세요 / 계속 대화할 수 있어요 (새 메시지는 점검되지 않아요) / (aria) 메시지 입력 |
| 말풍선 | 읽기 / 번역 / 교정 {n} / 교정 확인함 / 새 메시지 / 이전 메시지 보기 |
| 점검 완료 바 | ✓ 점검을 마친 채팅이에요 · 남은 교정 {n} · 제안 {m} |
| 점검 권유 | 대화를 꽤 나눴어요. 표현 점검을 받아 볼까요? / 점검 받기 |
| 메뉴 | 채팅 메뉴 / 제목 바꾸기 / 저장 / 읽기 항상 펼치기 / 채팅 삭제 |
| 삭제 확인 | 이 채팅을 삭제할까요? / 메시지와 교정·제안이 함께 지워져요. 이미 남긴 공부 기록은 그대로 남아요. / 삭제 / 취소 |
| 삭제 불가 | 답을 받는 중에는 지울 수 없어요 |
| 로딩·공통 | 불러오는 중… / 다시 시도 / 처리하지 못했어요. 다시 시도해 주세요. |

### 3-9. 360/390/412 · 키보드 · 접근성 체크리스트

폭·배치
- [ ] 세 폭에서 가로 스크롤 0(`document.documentElement.scrollWidth === innerWidth`). 긴 일본어 한 덩어리(공백 없는 80자)·이모지 연속·긴 URL 을 말풍선·교정문·제목에 넣고 확인.
- [ ] 방: 스크롤 영역은 `MessageList` 하나(`main` 은 스크롤 없음). 결과 화면: `main` 하나.
- [ ] 교정 카드: 360 → 위아래, 390·412 → 나란히(컨테이너 쿼리 `@min-[320px]`).
- [ ] 방 헤더 360px 에서 제목 말줄임, 버튼 3개(← · 표현 점검 · ⋯) 겹침 없음.
- [ ] 일본어 요소 전부 `lang="ja"`, 일본어 블록에 `break-keep` 없음.

터치·글자
- [ ] 모든 버튼·토글·칩·행 ≥44px(읽기/번역 토글, 가로 칩, 새 메시지 알약 포함). 보내기 44×44.
- [ ] 일본어 본문 17px(최소 16px), 캡션 ≥11px, 읽어야 하는 글에 `ink3`·`warn`·`accent` 뱃지 글자 없음(§1-1).

키보드
- [ ] 루트 viewport 에 `interactive-widget=resizes-content` → 모바일 Chrome 에서 키보드가 열리면 `100dvh` 가 줄어 입력창이 키보드 바로 위에 붙는다.
- [ ] 2차 보정 `useKeyboardInset(roomRef)`: `visualViewport` 의 `innerHeight - vv.height - vv.offsetTop` 이 1px 넘으면 방 루트에 `--kb-inset` 기록 → Composer `margin-bottom`. `resizes-content` 가 먹는 환경에선 0 이라 이중 보정 없음. `document` 전체가 아니라 **방 루트에만** 쓴다(VoiceVault `KeyboardInset` 의 body 여백 방식은 폼 화면용이라 채팅엔 쓰지 않는다).
- [ ] 보내기 후 키보드 유지(포커스 유지), 키보드 열릴 때 바닥 유지.
- [ ] 일본어 IME(Gboard 일본어) 변환 확정 Enter 로 전송되지 않음.
- [ ] 앱 WebView(Capacitor, task-003 이후)는 **실기기 확인 항목** — 두 경로 모두 안 먹으면 Capacitor Keyboard 플러그인(네이티브·APK) 판단을 Leader 에 올린다(완료 기준 13 의 NOT_VERIFIED 허용 범위).

접근성
- [ ] `MessageList role=log aria-live=polite`, PendingBubble·ReviewProgress `role=status`, TurnNotice `role=alert`.
- [ ] 토글 `aria-expanded`/`aria-pressed`, 스위치 `role=switch aria-checked`, 시트 `role=dialog aria-modal` + 포커스 복귀 + Esc.
- [ ] 비활성은 `aria-disabled` + 이유 토스트/라벨.
- [ ] 강조는 색 + 선 모양(취소선·밑줄) 둘 다, 상태 뱃지는 글자로.
- [ ] `prefers-reduced-motion` 에서 점 애니메이션·스크롤 smooth 끔.
- [ ] 포커스 링: 기본 outline 을 지우지 않는다(`focus-visible:outline-2 outline-accent`).

엔진명 비노출
- [ ] 렌더된 DOM·토스트에 `claude|haiku|sonnet|opus|qwen|엔진|모델|trace` 0건(qa 가 세 화면 `document.body.innerText` 로 grep).

### 3-10. 주의사항

- **빈 상태**: 목록 0 · 방 메시지 0(RoomIntro) · 점검 교정 0(칭찬) · 채택 대기 교정 0(카드 숨김) 네 가지를 모두 구현한다. 빈 칸은 버그로 읽힌다.
- **로딩**: 목록·방 첫 로드는 `LoadingBlock`, 버튼 작업은 버튼 문구 변경("만드는 중…") + `aria-busy`.
- **권한 거부**: 타인 채팅 URL → 404 화면(존재 여부를 드러내지 않는 문구 "찾을 수 없어요"). 401 은 `api.ts`/`apiStream` 이 로그인으로 보낸다.
- **오프라인**: 보내기 전 실패는 원문 복원, `accepted` 후 끊김은 detached 폴링(오류 아님). 폴링 중 네트워크 오류는 다음 간격에 재시도(연속 실패만으로 failed 로 가지 않고 200초 상한만 적용).
- **원문 무수정**: 교정 카드는 `original` 을 그대로 렌더한다(trim·정규화·잘라내기 금지). diff 강조는 `<span>` 분할만.
- **AI 는 제안만**: 채택 전 화면 어디에서도 "저장됨·추가됨"을 미리 보이지 않는다(낙관적 갱신 금지 — 채택·거절은 응답 후 반영).
- **엔진명**: `traceId`·`toolLog`·모델명은 렌더하지 않는다. 서버 기본 오류 문구에 "AI 엔진"이 있으므로(§3-11 ⑧) 422/502/504 는 반드시 §3-8 표 문구.
- **중복 전송**: 보내기 버튼 연타는 phase 가 `sending` 이 되는 즉시 막힌다. 서버 409 가 최종 보증.
- **저장소 차단**: `localStorage`/`sessionStorage` 는 모두 try/catch, 실패해도 기본값으로 동작.

### 3-11. Leader 확인 요청 (계약 해석·전역 변경·발견 이슈)

| # | 항목 | 화면이 가정한 것 | 틀리면 |
|---|---|---|---|
| ① | `resumePending` 대상 | 마지막 USER 메시지의 강사 답이 **FAILED** 여도 재개한다(bjj 2026-09-09 결정과 같음 — 사용자 메시지를 새로 만들지 않음) | 재시도를 "같은 글 새 턴"으로 바꾸고 실패 말풍선 처리 수정 |
| ② | #29 `after` 없을 때 | **최근 50개를 오름차순**으로 주고, 더 오래된 메시지용 커서를 준다(화면의 "이전 메시지 보기") | 커서가 없으면 버튼을 숨긴다(50개 초과 대화는 앞부분이 안 보임) |
| ③ | 동기 점검 중 클라이언트 이탈 | 턴처럼 **서버가 끝까지 처리·저장**한다 | "나가도 계속돼요" 문구를 "이 화면에 있어 주세요"로 교체 |
| ④ | ADD_STUDY_LOG `payload` | 키 `messageCount, correctionCount, summaryKo, focus` + **`strengths, skippedMessages` 추가 요청**(재방문 결과 복원용) | 재방문 시 잘한 점·건너뜀 줄을 숨긴다 |
| ⑤ | #34 `chatId` 정렬 | 메시지 순서 오름차순 | 카드 번호가 메시지 흐름과 어긋남 |
| ⑥ | 409 구분 정보 | 교정 채택 중복 단어 = `details.existingId`, 제안 만료 = `details.status:'EXPIRED'`, 점검 409 는 화면이 #29 재조회로 구분 | 문구를 "이미 처리됨" 하나로 뭉뚱그린다 |
| ⑦ | 전역 변경 4건 | 루트 viewport `interactiveWidget:'resizes-content'`(설정 화면도 영향 — 회귀 확인) · `:lang(ja)` 폰트 규칙 · TabBar 하위 화면 숨김 · `api.ts apiStream` 추가 | 대안: 키보드는 `useKeyboardInset` 만, 탭은 유지 |
| ⑧ | **발견 이슈**(이번 task 밖) | `infra/http.ts` 기본 문구 "AI 엔진을 지금 사용할 수 없습니다."가 사용자에게 보일 수 있음 → 채팅은 코드별 문구로 덮지만, 기본 문구 자체를 "지금은 선생님이 답할 수 없어요"류로 바꾸기 권장 · 공용 `Badge` `warn`(2.60)·`accent`(4.08) 톤과 `ink3` 글자(2.91~3.13)가 라이트 모드 4.5:1 미달 · `ComingSoon` 이 사용자에게 "Phase·task" 를 보여 줌 | 별도 task 로 정리 |
| ⑨ | 빈 채팅 정렬 | 메시지 0 채팅(`lastMessageAt=null`)은 목록 **맨 아래**로 간다(MariaDB DESC 의 NULL) → `COALESCE(lastMessageAt, createdAt) desc` 권장 | 방금 만든 빈 채팅이 목록 끝에 숨는다 |
| ⑩ | 줄바꿈 | 서버의 "제어문자 제거"가 `\n`(`\r\n`)을 **남긴다**(여러 줄 입력) | 여러 줄 메시지가 한 줄로 붙는다 |
