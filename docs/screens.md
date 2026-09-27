# TheKaiwa 화면 설계 (screens.md)

> 소유: designer · 구현: developer · 감사: reviewer/qa
> 이 문서는 **화면 구현 가이드의 단일 출처**다. API 요청/응답은 `docs/design/api-contract.md` 를 인용만 하고 다시 정의하지 않는다(#번호로 표기).
> 새 화면이 생기면 §2 목록에 한 줄 추가하고, 화면별 절(§3~)을 덧붙인다.
>
> 변경 이력: 2026-09-27 신규 — §1 토큰·§2 목록·§3 AI 채팅(task-006) · 2026-09-27 §4 단어장·§5 오늘의 단어 추가, §2 오늘·서랍장 행 갱신(task-008)

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
| 오늘 | `/study/today` | 오늘의 공부 홈(오늘의 단어 카드·최근 기록·보관한 세트, 회화·평가 "곧 열려요") | 로그인 | 보임 | **task-008(§5)** |
| 오늘 | `/study/today/words/[sessionId]` | 단어 카드 덱 · 세트 결과(같은 경로, 세트 상태로 분기) | 소유자(타인 404) | **숨김** | **task-008(§5)** |
| 오늘 | `/study/today/talk/[lessonId]`, `eval/[evaluationId]` | 오늘의 회화 · AI 평가 | 소유자 | 숨김 | Phase 2 |
| 계획표 | `/plan` | 달력·분석·성장 | 로그인 | 보임 | Phase 2~3 |
| 서랍장 | `/drawer/words` (`?word=<id>` 상세 시트 · `?add=1` 추가 시트) | 단어장 | 로그인(자기 단어만) | 보임 | **task-008(§4)** |
| 서랍장 | `/drawer/corrections` | 채택 교정 모음 | 로그인 | 보임 | Phase 3 |
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

---

## 4. 단어장 (task-008)

### 4-0. 한눈에 보는 결정

1. 경로는 `/drawer/words` 하나. 상세·수정·추가는 **바텀시트**로 열고 페이지를 옮기지 않는다. 다른 화면에서 들어올 때는 `?word=<id>`(상세)·`?add=1`(추가)를 쓰고, 시트를 연 뒤 `router.replace` 로 쿼리를 지운다. 하단 탭은 보인다.
2. 목록 위 조작 3줄: 검색(디바운스 300ms, IME 조합 중엔 보내지 않음, 40자 이하) · 분류 칩(가로 스크롤) · 정렬 3종과 [보관함] 토글. 총개수는 목록 머리 한 줄에 보인다.
3. 추가는 **표현 한 칸부터** 시작한다. [뜻 채우기]를 누르면 선생님이 채운 초안이 온다(A10 — **저장되지 않음**). 사용자가 확인·수정한 뒤 [저장]한다. [직접 입력하기]는 같은 폼을 빈 채로 연다. 초안 위에는 "저장해야 단어장에 들어가요"를 고정으로 둔다.
4. 카운터(맞힘·틀림·푼 횟수)와 출처는 **읽기 전용**이라 폼에 없다. 교정에서 온 단어는 상세에서 그 채팅의 점검 결과로 이어 준다.
5. 삭제는 시트 안 확인 단계를 거친다("지난 기록과 통계는 그대로 남아요"). 보관은 확인 없이 토글하고 토스트로 알린다("오늘의 단어에 나오지 않아요").
6. 409 중복은 오류로 보이지 않고 **그 단어로 안내**한다. 입력 아래 문구와 [그 단어 보기]를 두고, 누르면 추가 시트를 닫고 상세 시트를 연다.
7. 빈 단어장에는 [기본 단어 50개 넣기](#46b)와 [직접 추가]를 둔다. 기본 단어 넣기는 추가 시트 맨 아래에서 언제든 할 수 있다(이미 있는 표현은 서버가 건너뜀).
8. 오류 문구는 §4-8 표를 쓴다(서버 `message` 는 400 에만). "AI"·엔진 용어 없이 "선생님이 채워 줘요"라고 쓴다. 소리 버튼은 두지 않는다(E9 — 자리만 §4-2 C).

### 4-1. 화면 개요

| 항목 | 내용 |
|---|---|
| 목적 | 내가 모은 단어(직접·기본 팩·교정 채택·선생님 제안 채택)를 찾아보고 고치고, 오늘의 단어에 나올 단어를 **보관**으로 조절한다 |
| 진입 | 하단 탭 "서랍장" → `/drawer/words`. 오늘 화면 빈 상태 CTA → `?add=1`. 세트 결과의 틀린 단어 → `?word=<id>` |
| 역할별 가시성 | 로그인 사용자 전원, 자기 단어만. 타인 단어 id → #42 404 → "찾을 수 없어요" |
| 앱/웹 분기 | 없음 |
| 하단 탭 | 보임(시트가 열려 있는 동안에도 탭 바는 그대로 — 시트가 위를 덮는다) |
| 음성 | 소리 버튼 없음(E9). 자리는 상세 시트의 표현 오른쪽(§4-2 C) |

### 4-2. UI 구조 (의사코드, 390px 기준)

#### A. 목록 — `WordsScreen`

```
AppBar title="단어장" right={<AddButton/>}         ← "＋ 추가": h-11 rounded-xl bg-surface2 px-3 text-[14px] font-semibold, aria-label="단어 추가"
<div className="px-4 pb-8">
  WordSearchBar                                     ← 44px
  CategoryChips  className="mt-2.5"                  ← #46 실패·0개면 줄을 그리지 않는다
  <div className="mt-2.5 flex items-center gap-2">
     <div className="min-w-0 flex-1"><Segmented size="sm" ariaLabel="정렬" [최근 추가 | 많이 틀린 | 가나다순] /></div>
     ArchiveToggle "보관함"  aria-pressed             ← flex-none
  </div>
  archived && <p className="mt-2.5 rounded-xl bg-surface2 p-2.5 text-[13px] text-ink2">보관한 단어는 오늘의 단어에 나오지 않아요.</p>
  ListHeader  12px ink2 mt-3 mb-1.5  aria-live="polite"  ← "단어 57개" / "보관한 단어 2개" / "‘映画’ 검색 결과 3개"(검색어 span lang=ja)
  switch
    첫 로드 → LoadingBlock
    오류 → ErrorBlock(§4-8 ⓐ, onRetry)
    items.length === 0 → WordsEmpty(variant)       ← 아래 표
    <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface"> WordRow × n </ul>
  nextCursor → Btn ghost full "단어 더 보기"(mt-3) — 불러오는 동안 "불러오는 중…" + aria-busy
</div>
WordAddSheet · WordDetailSheet · Toast
```

와이어프레임(390px):
```
┌──────────────────────────────────────┐
│ 단어장                    [＋ 추가] (나) │ AppBar
├──────────────────────────────────────┤
│ ┌ ⌕ 표현·읽기·뜻으로 검색           ✕ ┐ │ 44px
│ [전체 57][N5 기초 50][교정 5][일상 2] → │ 칩 36px(히트 44)
│ [최근 추가|많이 틀린|가나다순]  [보관함] │
│ 단어 57개                              │ 12px ink2
│ ┌──────────────────────────────────┐ │
│ │ 映画  えいが               [교정] │ │ WordRow ≥64px
│ │ 영화                 맞힘 3 · 틀림 1 │ │
│ ├──────────────────────────────────┤ │
│ │ 食べる  たべる          [기본 단어] │ │
│ │ 먹다                              │ │
│ └──────────────────────────────────┘ │
│ [            단어 더 보기            ] │
└──────────────────────────────────────┘
```

**WordSearchBar**
```
<div role="search" className="relative">
  <input type="search" enterKeyHint="search" aria-label="단어 검색" placeholder="표현·읽기·뜻으로 검색"
         className={INPUT + ' pl-10 pr-11'} />          ← 16px(확대 방지), lang 없음(한국어 뜻·일본어 표현 혼용)
  돋보기 아이콘 left-3 (aria-hidden)
  값이 있으면 ✕ 버튼 44×44 right-0 aria-label="검색어 지우기" → 비우고 즉시 조회
</div>
40자 초과 → 아래 12px bad "검색어는 40자까지예요" (요청은 보내지 않는다)
```
- 조합(IME) 중에는 보내지 않는다: `onCompositionStart` → `composing=true`, `onCompositionEnd` → `composing=false` + 디바운스 다시 예약. 조합 중의 `onChange` 는 입력값만 바꾼다.
- 디바운스 300ms 뒤 `trim()` 한 값을 적용한다. 빈 값이면 `q` 를 빼고 조회한다. Enter(검색 키) → 디바운스 무시하고 즉시 조회 + `blur()`(키보드 내림).
- 새 조회를 시작하면 이전 요청은 `AbortController.abort()` 로 끊는다. 늦게 온 옛 응답이 새 목록을 덮어쓰면 안 된다.

**CategoryChips** (§5 오늘의 단어 카드도 같은 컴포넌트)
```
<div role="radiogroup" aria-label="분류" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
  [전체 {합}] [{category} {n}] …                     ← #46 응답 순서 그대로
</div>
```
- 칩: `relative h-9 min-w-[44px] flex-none rounded-full border px-3 text-[13px] before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-['']`. 히트영역은 **세로로만** 44px 로 넓힌다. 칩이 가로로 붙어 있어 좌우로 넓히면 옆 칩 클릭을 가로챈다(`Segmented` 주석과 같은 이유).
- 선택된 칩은 `bg-accent text-on-accent border-accent`(4.80), 나머지는 `bg-surface text-ink border-line`. `role="radio" aria-checked`. 분류 이름은 사용자가 정한 글이라 `lang` 을 두지 않는다.
- 기본 모드에서는 `count > 0` 인 분류만 보이고 숫자도 `count` 다. 보관함 모드에서는 `archivedCount > 0` 인 분류만 보이고 숫자도 `archivedCount` 다. "전체" 숫자는 보이는 칩들의 합이다.
- `category: null`(분류 없음) 칩은 만들지 않는다. 계약에 "분류 없음" 필터가 없어서다(§5-11 ⑥). 분류 없는 단어는 "전체"에 나온다.
- 선택한 칩이 사라지면(마지막 단어 삭제·보관) 전체로 돌아간다. 선택한 칩이 화면 밖에 있으면 `scrollIntoView({ inline: 'nearest', block: 'nearest' })`.

**정렬** `Segmented size="sm"` — `recent`(최근 추가) · `wrong`(많이 틀린) · `surface`(가나다순). 기본은 `recent` 이고, 마지막 선택은 `localStorage kaiwa.words.sort` 에 저장한다(try/catch).

**ArchiveToggle** — `relative h-8 flex-none rounded-[9px] px-3 text-[13px] font-medium` 에 `before:` 로 세로 히트 44px, `aria-pressed`. 켜짐은 `bg-accent-soft text-ink ring-1 ring-accent`, 꺼짐은 `bg-surface2 text-ink2`. 라벨은 늘 "보관함"이고 상태는 `aria-pressed` 와 모양으로 알린다. 켜면 `archived=1`, 칩은 보관 기준, 커서는 초기화한다.

**WordRow**(행 전체가 버튼 → 상세 시트)
```
<li>
 <button type="button" className="flex min-h-[64px] w-full min-w-0 flex-col justify-center gap-0.5 px-3.5 py-2.5 text-left">
   <span className="flex min-w-0 items-baseline gap-2">
     <span lang="ja" className="min-w-0 truncate text-[18px] font-semibold">{surface}</span>
     {reading && reading !== surface
       ? <span lang="ja" className="min-w-0 flex-1 truncate text-[13px] text-ink2">{reading}</span>
       : <span className="flex-1" />}
     {source !== 'MANUAL' && <Badge tone="neutral">{SOURCE_BADGE[source]}</Badge>}
   </span>
   <span className="flex min-w-0 items-baseline gap-2">
     <span className="min-w-0 flex-1 truncate text-[14px] text-ink2">{meaning}</span>
     {sort === 'wrong' && wrongCount > 0
       ? <Badge tone="bad">틀림 {wrongCount}</Badge>
       : correctCount + wrongCount > 0 && <span className="flex-none text-[12px] text-ink2">맞힘 {c} · 틀림 {w}</span>}
   </span>
 </button>
</li>
```
- 버튼 안 글이 곧 접근 가능한 이름이다(`aria-label` 불필요). 표현이 80자여도 말줄임하고, 전체 글은 상세에서 본다.
- 누르면 행 값으로 상세 시트를 **바로** 그리고, #42 로 기록·출처를 채운다(§C).

**WordsEmpty**(빈 칸은 버그로 읽힌다 — 경우마다 다른 안내). 모양은 `Card` + 가운데 정렬 + 제목 15px semibold `ink` + 본문 13px `ink2 break-keep`. `EmptyBlock` 은 글자가 `ink3`(명암비 미달, §1-1)라 쓰지 않는다.

| 조건 | 제목 / 본문 | 버튼 |
|---|---|---|
| 단어 0(#46 의 `count+archivedCount` 합 0, 검색·칩·보관함 모두 기본) | 단어장이 비어 있어요 / 기본 단어 50개(N5)로 바로 시작하거나, 아는 단어를 직접 넣어 보세요. 채팅에서 채택한 표현도 여기에 모여요. | [기본 단어 50개 넣기](primary full) [직접 추가](ghost full) |
| 보관 안 한 단어 0, 보관 단어 있음 | 보관하지 않은 단어가 없어요 / 보관함에서 꺼내거나 새 단어를 넣어 보세요. | [보관함 보기] [단어 추가] |
| 검색 결과 0 | ‘{q}’에 맞는 단어가 없어요 | [‘{q}’ 추가하기](ghost) → 추가 시트(표현 = q, q 가 80자 이하일 때만 버튼 표시) |
| 칩 선택 결과 0 | 이 분류에 단어가 없어요 | [전체 보기] |
| 보관함 0 | 보관한 단어가 없어요 / 오늘의 단어에서 빼고 싶은 단어는 눌러서 보관할 수 있어요. | — |

#### B. 추가 시트 — `WordAddSheet`

```
Sheet title="단어 추가" dismissible={!busy}
 step 'surface':
   Field "표현"  input#wordSurface lang=ja 16px  placeholder="예: 映画, 食べる, よろしくお願いします"   ← 이 단계만 자동 포커스
       아래: 80자 초과 → bad "표현은 80자까지 쓸 수 있어요"
             409 → bad "단어장에 같은 표현이 이미 있어요" + [그 단어 보기](텍스트 버튼 44px)
             429 → bad "뜻 채우기를 너무 자주 눌렀어요. {n}초 뒤에 다시 해 주세요."(1초마다 줄어듦)
   [뜻 채우기]  primary full   ← 표현 1~80자이고 429 대기 중이 아닐 때만 활성(아니면 aria-disabled + 이유 문구)
   p 12px ink2  "선생님이 읽기·뜻·예문을 채워 줘요. 확인하고 저장해야 단어장에 들어가요."
   [직접 입력하기]  ghost full  → step 'form'(빈 폼, 표현은 유지)
   hr (mt-4)
   SeedPackLink  "기본 단어 50개(N5) 한 번에 넣기 ›"  텍스트 버튼 44px 13px accent  → #46b (시트 유지, 결과는 토스트)
 step 'enriching':
   <p lang=ja className="text-[20px] font-semibold">{surface}</p>
   Card flat role=status aria-live=polite:
       점 3개 애니메이션 + "선생님이 뜻을 찾고 있어요 · {n}초"   (8초부터 "조금 오래 걸리고 있어요 · {n}초")
   [그만두기] ghost full → abort → step 'surface'(입력 유지)
 step 'form':
   fromDraft && <p className="rounded-xl bg-accent-soft p-2.5 text-[13px] text-ink">
                  선생님이 채운 초안이에요. 틀린 곳은 고쳐 주세요. 저장해야 단어장에 들어가요.</p>
   draftEmpty && <p className="... bg-surface2 text-ink2">뜻을 찾지 못했어요. 직접 입력해 주세요.</p>
   WordForm
   BtnRow [저장](primary) [취소](ghost → 시트 닫기)
   fromDraft && [다시 채우기] 텍스트 버튼 44px → step 'enriching'
```
- 뜻 채우기: #41 `{ surface, enrich: true }` → `{ draft, saved: false }` → 폼 값은 `{ surface, ...draft, category: 목록에서 선택한 칩(보관함 모드가 아닐 때) ?? '' }`. 이 시점에 DB 행은 없다.
- 저장: #41 `{ surface, meaning, partOfSpeech, reading?, jlpt?, example?, exampleKo?, note?, category? }`(비어 있는 선택값은 보내지 않음, `enrich` 없음) → `{ word, saved: true }` → 시트 닫기, 토스트 "단어장에 넣었어요", 목록 첫 쪽과 #46 다시 읽기.
- **일본어가 아닌 입력**(A10 `valid:false` — prompt-engineer 스키마 `WordEnrichResponse.valid/invalidReason`): 'surface' 단계에 머문다. 표현 아래에 bad "일본어 단어로 보기 어려워요. 표현을 확인해 주세요."를 보이고, `invalidReason` 이 있으면 그 아래 13px ink2 로 보인다(선생님 설명이라 교정 설명과 같은 급으로 다룬다. 엔진 용어가 없어야 함). [직접 입력하기]는 그대로 쓸 수 있다. 라우트가 이 경우를 400 으로 돌려주면 서버 문구를 같은 자리에 보인다(§5-11 ⑧).
- 초안의 `meaning` 이 비어 있으면(`valid:true` 인데 비는 경우 방어) 폼 단계로 가서 "뜻을 찾지 못했어요. 직접 입력해 주세요."를 보인다. `jlpt` 는 비어 있어도 정상이다(모르면 null).
- 제출 중(뜻 채우기·저장)에는 시트를 닫을 수 없다(`dismissible=false`). 단 'enriching' 단계에서는 [그만두기]로 끊을 수 있다.
- 칩 대상 표현을 누르고 들어온 경우(`presetSurface`)에는 표현을 채운 채 'surface' 단계로 연다.

**WordForm**(추가·수정 공용)
```
Field 표현*   input lang=ja 16px                                1~80
Field 읽기    input lang=ja placeholder="히라가나 (선택)"          ≤120
Field 뜻*     input placeholder="한국어 뜻 (예: 영화)"              1~200
<div className="grid grid-cols-2 gap-2.5">                        ← 360 에서도 2열(각 ≥150px)
  Field 품사   select(명사·동사·い형용사·な형용사·부사·조사·표현·기타)  기본 '기타'
  Field 수준   select(선택 안 함·N5·N4·N3·N2·N1)
</div>
Field 분류    input list="word-categories" placeholder="예: 일상, 여행 (선택)"   ≤40   ← <datalist> = #46 분류 이름
[예문·메모 더 쓰기 ▾]  텍스트 버튼 44px aria-expanded                        ← 직접 입력은 접힘, 초안에 예문이 있거나 수정 모드에서 값이 있으면 펼침
  Field 예문     textarea lang=ja rows=2(자동 높이, 최대 5줄 후 내부 스크롤)   ≤2,000
  Field 예문 뜻  textarea rows=2                                             ≤2,000
  Field 메모     textarea rows=2 placeholder="외우는 요령 등 (선택)"           ≤500
```
- 입력창 클래스는 `AcceptCorrectionSheet` 의 `INPUT` 과 같다(`h-11 … text-[16px] … placeholder:text-ink3` — placeholder 의 ink3 는 §1-1 에서 허용). `select` 도 같은 높이와 테두리를 쓴다.
- 필수 표시는 라벨 뒤 `<span aria-hidden="true">*</span>` 와 입력의 `aria-required` 로 한다.
- 길이는 **코드포인트**(`cpLength`)로 센다. `maxLength` 속성은 쓰지 않는다(IME 조합 중 잘림·이모지 2칸 문제, §3 NewChatSheet 와 같은 이유). 오류는 입력 아래 12px `bad` 로 보이고 `aria-invalid`·`aria-describedby` 를 단다.
- [저장]은 늘 누를 수 있게 둔다. 틀린 필드가 있으면 요청을 보내지 않고 **첫 오류 필드로 포커스를 옮긴 뒤** 문구를 보인다(눌러도 반응 없는 버튼 금지).
- 품사 `select` 의 값은 enum 문자열, 라벨은 §4-8 ⓔ.

#### C. 상세 시트 — `WordDetailSheet` (mode: `'view' | 'edit' | 'confirmDelete'`)

view:
```
Sheet title="단어"
  <div className="flex items-start gap-3">
    <div className="min-w-0 flex-1">
      <p lang=ja className="text-[28px] font-semibold leading-tight [overflow-wrap:anywhere]">{surface}</p>
      {reading && reading !== surface && <p lang=ja className="mt-1 text-[15px] text-ink2">{reading}</p>}
    </div>
    {/* 소리 버튼 자리(44×44) — task-003 이후. 지금은 렌더하지 않는다(E9) */}
  </div>
  <p className="mt-2 break-keep text-[17px] font-medium">{meaning}</p>
  <div className="mt-2 flex flex-wrap gap-1.5">   Badge neutral: 품사 · jlpt · category · chunkType 라벨 · (archived) "보관함"
  example && Card flat mt-3:
      <p lang=ja className="whitespace-pre-wrap text-[16px] leading-[1.7] [overflow-wrap:anywhere]">{example}</p>
      exampleKo && <p className="mt-1 break-keep text-[14px] text-ink2">{exampleKo}</p>
  note && <><p className="mt-3 text-[12px] text-ink2">메모</p><p className="whitespace-pre-wrap text-[14px]">{note}</p></>
  <h3 className="mt-4 text-[13px] font-semibold text-ink2">기록</h3>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[14px]">
        맞힘 {correctCount} · 틀림 {wrongCount} · 최근 7일 맞힘 {last7d.correct} · 틀림 {last7d.wrong}
        · 푼 횟수 {stats.attempts} · 마지막 {lastSeenAt 날짜}({lastResult 라벨}) · (evalAppearances > 0) 평가에 나온 횟수 {n}
      </dl>
      (correctCount + wrongCount === 0 && !lastSeenAt) → "아직 오늘의 단어에서 풀지 않았어요"  13px ink2
      #42 기다리는 동안 이 칸만 "불러오는 중…"(ink2)
  <h3 className="mt-4 …">출처</h3>
      SourceLine(§4-8 ⓔ)
      source === 'CORRECTION' && corrections[0] → [점검 결과 보기 ›] Link 44px → /study/ai/chat/{chatId}/review#cr_{id}
      "추가한 날 {createdAt 날짜}"  12px ink2
  BtnRow [수정](ghost) [보관하기 | 보관 풀기](ghost)
  [삭제] 텍스트 버튼 44px text-bad 가운데 → mode 'confirmDelete'
```
edit:
```
WordForm(현재 값)
p 12px ink2 "맞힘·틀림 기록과 출처는 바꿀 수 없어요."
BtnRow [저장](primary) [취소](ghost → view)
```
confirmDelete:
```
<p className="text-[17px] font-semibold">이 단어를 삭제할까요?</p>
<p className="mt-1 break-keep text-[14px] text-ink2">‘<span lang=ja>{surface}</span>’를 단어장에서 지워요. 지난 기록과 통계는 그대로 남아요.</p>
BtnRow [삭제](danger) [취소](ghost → view)
```
- 보관 토글: #45 → 시트는 view 로 남기고 뱃지를 바꾼다. 토스트 "보관했어요 · 오늘의 단어에 나오지 않아요" / "보관을 풀었어요 · 오늘의 단어에 다시 나와요". 목록에서 그 행을 빼고(현재 모드와 반대가 됐으므로) #46 을 다시 읽는다.
- 삭제: #44 → 시트 닫기, 토스트 "삭제했어요 · 지난 기록은 그대로 남아요", 행 제거, total −1, #46 다시 읽기.
- 수정 저장: #43 에 **바뀐 필드만** 보낸다(비운 선택 필드는 `null`) → view 로 돌아가고 목록 행을 새 값으로 바꾼다. 표현을 바꿨다가 409 가 나면 표현 아래에 중복 문구와 [그 단어 보기]를 보인다.
- 처리 중에는 버튼 전부 `aria-disabled` + `aria-busy`, 시트 닫기 막음.

#### D. 다른 화면에서 들어오기

| 쿼리 | 동작 |
|---|---|
| `?add=1` | 마운트 후 추가 시트를 연다(`presetSurface` 없음) → `router.replace('/drawer/words', { scroll: false })` |
| `?word=<id>` | 목록과 상관없이 상세 시트를 열고 #42 로 채운다 → replace. 404 → 시트 대신 토스트 "단어를 찾을 수 없어요. 삭제되었을 수 있어요." |

쿼리는 서버 페이지가 `searchParams` 로 받아 `initialWordId`·`initialAdd` props 로 넘긴다(§3 홈의 `initialTab` 과 같은 방식 — `useSearchParams` Suspense 경계 불필요).

### 4-3. 상태 관리

`WordsScreen`
```
qInput: string            // 입력창 값(조합 중 포함)
query: { q: string; category: string | null; sort: 'recent'|'wrong'|'surface'; archived: boolean }   // 실제 조회 조건
list: { items: WordEntry[]; nextCursor: string | null; total: number | null;
        status: 'loading'|'ready'|'error'; loadingMore: boolean; error: string | null }
categories: CategoryCount[] | null      // 실패하면 null → 칩 줄 숨김
sheet: { kind: 'add'; presetSurface?: string } | { kind: 'detail'; id: string; preview?: WordEntry } | null
abortRef, composingRef, debounceRef
```
- `query` 가 바뀌면 커서를 지우고 첫 쪽(`limit=30`)을 읽는다. 이전 요청은 abort 한다.
- 마운트할 때와 `visibilitychange → visible` 때 첫 쪽과 #46 을 읽는다. 자동 폴링은 없다.
- 더 보기는 `cursor=nextCursor` 결과를 뒤에 붙이고 `id` 가 겹치면 뺀다.
- 추가·수정·보관·삭제는 **서버 응답을 받은 뒤** 반영한다. 추가·수정은 목록 첫 쪽과 #46 을 다시 읽는다(정렬·필터 규칙을 화면이 흉내 내지 않는다). 보관·삭제는 응답 직후 그 행을 빼고, 조용히 첫 쪽을 다시 읽는다.
- 빈 상태 판정: `items.length === 0` 일 때 `q`·`category`·`archived` 와 #46 합계로 §4-2 A 표의 변형을 고른다.

`WordAddSheet`
```
step: 'surface' | 'enriching' | 'form'
form: WordFormValues ; fromDraft: boolean ; draftEmpty: boolean
errors: Partial<Record<WordField, string>> ; dup: { existingId: string } | null
submitting: boolean ; enrichStartedAt: number | null ; blockedUntil: number | null   // 429
abortRef
```
- 'enriching' 은 20초 넘게 걸리지 않는다(서버 A10 20s). 화면은 따로 제한 시간을 두지 않고 서버 504 를 기다린다. [그만두기]는 abort 다.
- 409 `details.existingId` → `dup` 을 두고 [그 단어 보기] → `onOpenWord(existingId)`(부모가 추가 시트를 닫고 상세 시트를 연다).

`WordDetailSheet`
```
mode: 'view' | 'edit' | 'confirmDelete'
word: WordEntry (preview 로 시작 → #42 로 교체) ; stats | null ; corrections: {id, chatId}[]
loading ; busy ; errors ; dup
```

### 4-4. API 호출 계획

| # | 엔드포인트 | 메서드 | 화면 동작 | 파라미터 | 사용 필드 | 오류 처리 |
|---|---|---|---|---|---|---|
| 40 | `/api/v1/words` | GET | 목록·검색·칩·정렬·보관함·더 보기 | `q`(≤40 코드포인트, 비면 생략) `category` `archived=0\|1` `sort=recent\|wrong\|surface` `limit=30` `cursor` | `items[].{id,surface,reading,meaning,source,correctCount,wrongCount,archived,category}` · `nextCursor` · `total` | ErrorBlock + 다시 시도 · 400 → 검색창 아래 서버 문구 |
| 41 | `/api/v1/words` | POST | [뜻 채우기] | `{ surface, enrich: true }` | `draft.{reading,meaning,partOfSpeech,jlpt,example,exampleKo}` · `saved:false` | §4-8 ⓑ(409·400·422·429·502·504·네트워크) |
| 41 | `/api/v1/words` | POST | [저장] | `{ surface, meaning, partOfSpeech, reading?, jlpt?, example?, exampleKo?, note?, category? }` | `word` · `saved:true` | 409 `details.existingId` → [그 단어 보기] · 400 `details.field` 입력 아래 |
| 42 | `/api/v1/words/:id` | GET | 상세 시트 | — | `WordEntry` 전부 + `stats.{attempts,last7d,evalAppearances}` + `corrections[].{id,chatId}` | 404 → 시트 닫기 + 토스트 + 목록 다시 읽기 |
| 43 | `/api/v1/words/:id` | PATCH | 수정 저장 | 바뀐 필드만(비운 선택값 `null`). `correctCount`·`wrongCount`·`source` 는 보내지 않는다 | `WordEntry` | 409 existingId · 400 field · 404 |
| 44 | `/api/v1/words/:id` | DELETE | 삭제 확인 | — | `deleted` · `snapshotKept` | 404 → 이미 없는 것으로 보고 목록에서 제거 |
| 45 | `/api/v1/words/:id/archive` · `/unarchive` | POST | 보관하기·보관 풀기 | — | `archived` · `archivedAt` | 404 · 그 외 토스트 |
| 46 | `/api/v1/words/categories` | GET | 칩·폼 datalist·빈 상태 판정 | — | `[{category,count,archivedCount}]` | 실패 → 칩 줄 숨김(조용히) |
| 46b | `/api/v1/words/seed-pack` | POST | [기본 단어 50개 넣기] | `{ pack: 'N5' }` | `added` · `skipped` | 토스트(§4-8 ⓓ) |

- 호출은 전부 `src/components/common/api.ts` 의 `apiGet/apiPost/apiPatch/apiDelete`, 오류는 `@/components/chat/errors` 의 `toErr`·`retryAfterOf`·`detailString` 으로 푼다. 화면 분기는 **HTTP status 먼저**, 같은 status 안의 갈래만 `details` 로 본다(§3-4 와 같음).
- 모든 요청 경로에 사용자 입력을 붙일 때는 `URLSearchParams`/`encodeURIComponent` 를 쓴다.

### 4-5. 컴포넌트 분해 (`src/components/vocab/*`)

| 컴포넌트/모듈 | 종류 | props | 상태 |
|---|---|---|---|
| `WordsScreen` | client | `{ initialWordId?: string; initialAdd?: boolean }` | §4-3 |
| `WordSearchBar` | client | `{ value; onInput(v); onCommit(v); onClear() }` | 조합 여부 |
| `CategoryChips` | client | `{ items: CategoryCount[]; value: string \| null; onChange(v); basis: 'active' \| 'archived' }` | — |
| `ArchiveToggle` | client | `{ pressed; onToggle() }` | — |
| `WordRow` | client | `{ word: WordEntry; sort; onOpen(word) }` | — |
| `WordsEmpty` | client | `{ variant: 'noWords'\|'allArchived'\|'noSearch'\|'noCategory'\|'noArchived'; q?; onSeed(); onAdd(preset?); onShowArchive(); onShowAll() ; seeding }` | — |
| `WordAddSheet` | client | `{ open; presetSurface?; defaultCategory?; categories: string[]; onClose(); onSaved(word); onOpenWord(id); onToast(msg) }` | §4-3 |
| `WordForm` | client | `{ values; errors; onChange(field, v); categories: string[]; expandExtras: boolean; idPrefix }` | 더 쓰기 펼침 |
| `WordDetailSheet` | client | `{ wordId: string \| null; preview?: WordEntry; categories: string[]; onClose(); onChanged(word); onRemoved(id); onArchivedChange(word); onOpenWord(id); onToast(msg) }` | §4-3 |
| `useSeedPack` | hook | `() → { seed(): Promise<{added,skipped}>, seeding }` | §5 오늘 화면도 사용 |
| `validate.ts` | 순수 | `validateWord(values) → errors` · `diffPatch(before, after) → body` · `WORD_LIMITS` | — |
| `labels.ts` | 순수 | 품사·출처·수준·보관·오류 문구(§4-8), §5 문구도 여기 | — |
| `src/types/vocab.ts` | 타입 | `WordEntry, WordDetail, WordDraft(valid·invalidReason·reading·meaning·partOfSpeech·jlpt·example·exampleKo — 전부 nullable), CategoryCount, WordListPage` (+ §5 타입) | — |

재사용: `Sheet`·`Toast/useToast`·`Segmented`·`ui.tsx`(`Card`·`Btn`·`BtnRow`·`Field`·`Badge`·`LoadingBlock`·`ErrorBlock`)·`AppBar`, `@/components/chat/format`(`cpLength`·`kstDateKey`)·`@/components/chat/errors`·`@/components/chat/storage`(`readStore`·`writeStore`, 키는 vocab 쪽에 따로 정의).

### 4-6. 생성/수정 파일 목록

신규
- `src/types/vocab.ts` — 클라이언트 DTO(§4-5·§5-5), 서버 모듈을 import 하지 않는다
- `src/components/vocab/{WordsScreen,WordSearchBar,CategoryChips,ArchiveToggle,WordRow,WordsEmpty,WordAddSheet,WordForm,WordDetailSheet}.tsx`
- `src/components/vocab/{useSeedPack,validate,labels}.ts`
- `src/components/vocab/__tests__/{validate,labels}.test.ts`

수정
- `src/app/(app)/drawer/words/page.tsx` — `ComingSoon` 을 걷어 내고 서버에서 `searchParams`(`word`,`add`)를 읽어 `<WordsScreen initialWordId initialAdd />`(`AppBar` 는 `WordsScreen` 안에서 렌더 — 오른쪽 [＋ 추가]가 클라이언트 상태를 쓰기 때문)

### 4-7. 구현 순서

1. `types/vocab.ts`·`labels.ts`·`validate.ts` + 단위 테스트(코드포인트 한도, `diffPatch` 의 `null` 처리).
2. `WordsScreen` 골격: #40 첫 쪽·더 보기·`WordRow`·로딩/오류.
3. 검색(디바운스·IME·abort)·칩(#46)·정렬·보관함 토글·ListHeader.
4. `WordsEmpty` 다섯 변형 + `useSeedPack`(#46b).
5. `WordAddSheet`(surface → enriching → form, 409·429·abort) + `WordForm`.
6. `WordDetailSheet`(view·edit·confirmDelete, #42~#45).
7. `?add=1`·`?word=` 진입 + replace.
8. §4-9 체크리스트 자체 점검.

### 4-8. 한국어 UI 문구

ⓐ **목록·검색**

| 자리 | 문구 |
|---|---|
| 앱바 / 버튼 | 단어장 / ＋ 추가 (aria: 단어 추가) |
| 검색 | 표현·읽기·뜻으로 검색 / (aria) 단어 검색 · 검색어 지우기 / 검색어는 40자까지예요 |
| 정렬 | 최근 추가 · 많이 틀린 · 가나다순 (aria: 정렬) |
| 보관함 | 보관함 / 보관한 단어는 오늘의 단어에 나오지 않아요. |
| 목록 머리 | 단어 {n}개 / 보관한 단어 {n}개 / ‘{q}’ 검색 결과 {n}개 |
| 칩 | 전체 {n} / {분류} {n} (aria: 분류) |
| 행 | 맞힘 {c} · 틀림 {w} / 틀림 {w}(많이 틀린 순 뱃지) |
| 더 보기 | 단어 더 보기 / 불러오는 중… |
| 목록 오류 | 단어장을 불러오지 못했어요. [다시 시도] |
| 네트워크 | 연결하지 못했어요. 네트워크를 확인해 주세요. |

ⓑ **추가·뜻 채우기**(서버 `message` 대신 이 표, 400 만 서버 문구)

| 상황 | 문구 |
|---|---|
| 시트 제목 | 단어 추가 |
| 표현 입력 | 표현 / 예: 映画, 食べる, よろしくお願いします |
| 버튼 | 뜻 채우기 / 직접 입력하기 / 다시 채우기 / 그만두기 / 저장 / 취소 |
| 안내 | 선생님이 읽기·뜻·예문을 채워 줘요. 확인하고 저장해야 단어장에 들어가요. |
| 진행 | 선생님이 뜻을 찾고 있어요 · {n}초 / (8초~) 조금 오래 걸리고 있어요 · {n}초 |
| 초안 머리 | 선생님이 채운 초안이에요. 틀린 곳은 고쳐 주세요. 저장해야 단어장에 들어가요. |
| 초안 비었음 | 뜻을 찾지 못했어요. 직접 입력해 주세요. |
| 일본어 아님(`valid:false`) | 일본어 단어로 보기 어려워요. 표현을 확인해 주세요. (+ `invalidReason` 13px ink2) |
| 409 | 단어장에 같은 표현이 이미 있어요 · [그 단어 보기] |
| 422 | 지금은 뜻을 채울 수 없어요. 직접 입력해 주세요. |
| 502 | 뜻을 채우지 못했어요. 다시 시도하거나 직접 입력해 주세요. |
| 504 | 시간이 오래 걸려 멈췄어요. 다시 시도하거나 직접 입력해 주세요. |
| 429 | 뜻 채우기를 너무 자주 눌렀어요. {n}초 뒤에 다시 해 주세요. |
| 저장 성공 | 단어장에 넣었어요 |
| 그 외 실패 | 처리하지 못했어요. 다시 시도해 주세요. |

ⓒ **폼 필드·검증**

| 필드 | 라벨 / placeholder | 검증 문구 |
|---|---|---|
| surface | 표현* | 표현을 적어 주세요 / 표현은 80자까지 쓸 수 있어요 |
| reading | 읽기 / 히라가나 (선택) | 읽기는 120자까지 쓸 수 있어요 |
| meaning | 뜻* / 한국어 뜻 (예: 영화) | 뜻을 적어 주세요 / 뜻은 200자까지 쓸 수 있어요 |
| partOfSpeech | 품사 | — |
| jlpt | 수준 / 선택 안 함 | — |
| category | 분류 / 예: 일상, 여행 (선택) | 분류는 40자까지 쓸 수 있어요 |
| example | 예문 | 예문은 2,000자까지 쓸 수 있어요 |
| exampleKo | 예문 뜻 | 예문 뜻은 2,000자까지 쓸 수 있어요 |
| note | 메모 / 외우는 요령 등 (선택) | 메모는 500자까지 쓸 수 있어요 |
| 펼치기 | 예문·메모 더 쓰기 | — |

ⓓ **상세·수정·보관·삭제·기본 단어**

| 자리 | 문구 |
|---|---|
| 시트 제목 | 단어 |
| 기록 | 기록 / 맞힘 {c} · 틀림 {w} / 최근 7일 맞힘 {c} · 틀림 {w} / 푼 횟수 {n} / 마지막 {M월 D일}({맞힘\|틀림\|건너뜀}) / 평가에 나온 횟수 {n} / 아직 오늘의 단어에서 풀지 않았어요 |
| 출처 | 출처 / 추가한 날 {M월 D일} / 점검 결과 보기 |
| 버튼 | 수정 / 보관하기 / 보관 풀기 / 삭제 |
| 수정 안내 | 맞힘·틀림 기록과 출처는 바꿀 수 없어요. |
| 보관 토스트 | 보관했어요 · 오늘의 단어에 나오지 않아요 / 보관을 풀었어요 · 오늘의 단어에 다시 나와요 |
| 삭제 확인 | 이 단어를 삭제할까요? / ‘{surface}’를 단어장에서 지워요. 지난 기록과 통계는 그대로 남아요. / 삭제 / 취소 |
| 삭제 토스트 | 삭제했어요 · 지난 기록은 그대로 남아요 |
| 수정 토스트 | 고쳤어요 |
| 404 | 단어를 찾을 수 없어요. 삭제되었을 수 있어요. |
| 기본 단어 | 기본 단어 50개 넣기 / 기본 단어 50개(N5) 한 번에 넣기 / 넣는 중… |
| 기본 단어 결과 | 기본 단어 {added}개를 넣었어요 / 기본 단어 {added}개를 넣었어요 · 이미 있는 {skipped}개는 건너뛰었어요 / 기본 단어가 이미 모두 들어 있어요 |
| 빈 상태 | §4-2 A `WordsEmpty` 표 |

ⓔ **라벨**

| 값 | 라벨 |
|---|---|
| PartOfSpeech `NOUN`/`VERB`/`ADJ_I`/`ADJ_NA`/`ADVERB`/`PARTICLE`/`EXPRESSION`/`OTHER` | 명사 / 동사 / い형용사 / な형용사 / 부사 / 조사 / 표현 / 기타 |
| JlptLevel `N5`~`N1` | N5 ~ N1 |
| WordSource 뱃지(목록) `MANUAL`/`CORRECTION`/`SEED`/`TUTOR`/`LESSON`/`EVALUATION` | (없음) / 교정 / 기본 단어 / 선생님 제안 / 레슨 / 평가 — neutral 톤 |
| WordSource 문장(상세) | 직접 넣은 단어예요 / 채팅 교정에서 채택한 표현이에요 / 기본 단어(N5) 팩에서 넣었어요 / 선생님 제안을 채택한 단어예요 / 레슨에서 넣은 단어예요 / 평가에서 넣은 단어예요 |
| ChunkType | §3-8 ⓔ 와 같음(이름 조각 · 액션 조각 · 느낌 조각 · 꾸밈 조각) |
| lastResult `CORRECT`/`WRONG`/`SKIPPED` | 맞힘 / 틀림 / 건너뜀 |

### 4-9. 360/390/412 · 접근성 체크리스트

폭·배치
- [ ] 세 폭에서 가로 스크롤 0. 긴 표현(공백 없는 80자 일본어)·긴 뜻(200자)·긴 분류(40자)·이모지를 넣고 행·칩·시트·상세를 확인한다.
- [ ] 360px 에서 정렬 Segmented 3칸 + [보관함] 한 줄, 라벨 말줄임만 있고 겹침 없음.
- [ ] 스크롤 영역은 `main` 하나(시트 내부 스크롤은 예외). 칩 줄은 가로 스크롤만 있고 스크롤바가 보이지 않는다.
- [ ] 폼 2열(품사·수준)이 360 에서 각 ≥150px.

터치·글자
- [ ] 행 ≥64px, 칩·정렬·보관함·✕·텍스트 버튼 히트 ≥44px(칩·정렬은 세로 `::before`).
- [ ] 일본어 요소(표현·읽기·예문·검색어 인용) 전부 `lang="ja"`, 일본어 블록에 `break-keep` 없음. 표현 18px(목록)·28px(상세), 예문 16px.
- [ ] 읽어야 하는 글에 `ink3`·`warn`·`accent` 뱃지 글자 없음(§1-1). 빈 상태에 `EmptyBlock` 을 쓰지 않는다.

키보드·입력
- [ ] Gboard 일본어로 검색할 때 조합 중에 요청이 나가지 않는다(네트워크 탭 확인). Enter 로 바로 검색하고 키보드가 내려간다.
- [ ] 추가 시트를 열면 표현 입력에 포커스가 가고, 키보드가 올라와도 [뜻 채우기]가 보인다(`interactive-widget=resizes-content`).

접근성
- [ ] 칩 `role=radio aria-checked`, 보관함 `aria-pressed`, 펼치기 `aria-expanded`, 오류 `aria-invalid`+`aria-describedby`.
- [ ] ListHeader·enriching 진행은 `aria-live="polite"`.
- [ ] 시트: `role=dialog aria-modal` + 제목 포커스 + 닫으면 연 버튼으로 포커스 복귀 + Esc.

엔진명 비노출
- [ ] 목록·시트·토스트·오류의 렌더 텍스트에 `claude|haiku|sonnet|opus|qwen|엔진|모델|trace` 0건(422/502/504 를 강제로 만들어 확인).

### 4-10. 주의사항

- **초안은 저장이 아니다.** 뜻 채우기 뒤에 목록을 다시 읽거나 "추가됨"을 보이지 않는다. 사용자가 [저장]을 눌러야 행이 생긴다(E8·#41).
- **읽기 전용**: 카운터·출처·`sourceRefId`·`archived` 는 폼에 없다. PATCH 본문에 넣지 않는다.
- **삭제 후 기록**: 삭제해도 세트 결과·통계는 그대로다(Snap·StatsSnapshot). 문구가 이 사실을 약속하므로 서버 계약(#44 `snapshotKept`)과 어긋나면 안 된다.
- **동시 조회**: 검색·칩·정렬을 빠르게 바꾸면 요청이 겹친다. 마지막 조건의 응답만 반영한다(abort + 요청 번호 비교 둘 다).
- **오프라인**: 목록 오류는 ErrorBlock + 다시 시도, 시트 제출 실패는 시트를 열어 둔 채 입력값을 지키고 문구만 보인다.
- **권한**: 타인 단어 id(`?word=`)는 404 → "찾을 수 없어요" 토스트. 존재 여부를 드러내는 문구를 쓰지 않는다.
- **엔진명**: 뜻 채우기 실패 문구는 반드시 §4-8 ⓑ(서버 기본 문구에 "AI 엔진"이 있을 수 있다, §3-11 ⑧).
- **저장소 차단**: `kaiwa.words.sort` 읽기·쓰기는 try/catch, 실패해도 `recent` 로 동작한다.

---

## 5. 오늘의 단어 (task-008)

### 5-0. 한눈에 보는 결정

1. 경로 2개: 오늘 홈 `/study/today` → 덱·결과 `/study/today/words/[sessionId]`. 결과는 **같은 경로**에서 세트 상태(`DONE`)로 갈라 그린다(§11 의 `(+result)` 를 경로로 나누지 않는다 — 새로고침·재방문·보관 세트 열기가 한 곳에서 끝난다). 덱·결과 화면은 하단 탭을 숨기고 `BackBar` 를 쓴다.
2. 오늘 홈의 "오늘의 단어" 카드는 상태 5가지다. **준비**(장수·방식·분류 → [시작하기]) / **풀던 세트 있음**(E3: [이어서 풀기]·[여기서 끝내기]) / **빈 단어장**([기본 단어 50개 넣기]·[단어 직접 추가]) / **오늘 풀 단어 없음** / 오류. 레슨·평가는 "곧 열려요" 카드이고 Phase·task 번호는 보이지 않는다.
3. **정답은 서버만 안다.** 덱은 답을 보낸 뒤 #50 응답(`answer`·`correctText`·예문)으로만 정답·오답을 그린다. 미리 표시하거나 낙관적으로 채점하지 않는다. 보기 버튼은 누르는 순간 "확인 중"이 되고, 응답(보통 0.1~0.3초)이 오면 뒤집힌다.
4. 덱 구조: 제스처 영역(가운데 80%, 3장 스택)은 **카드 면만** 담는다. 보기 4버튼·알았어요/몰랐어요·도구 줄은 **제스처 영역 밖**에 둔다. `touchend preventDefault` 가 그 영역 안의 버튼 click 을 죽이고, 뒤집힌 직후 새로 생긴 버튼에 떨어지는 유령 클릭도 막기 때문이다.
5. 제스처(bjj 이식): 탭 10px 미만 / 위로 −80px = **다시 볼 카드 표시 토글**(카드는 넘어가지 않는다) / 왼쪽 60px = 다음(**답한 뒤에만**, 안 답했으면 튕겨 돌아오고 안내) / 오른쪽 60px = 이전 카드(읽기 전용). 모든 제스처는 버튼·키보드로도 할 수 있다(1~4·Space·Enter·←/→·F).
6. 조작 수(12초/장): CHOICE 는 보기 1탭 + [다음 카드] 1탭(또는 왼쪽 밀기). FLIP 은 카드 탭(뒤집기) + [알았어요/몰랐어요] 1탭이고, 응답이 오면 **다음 카드로 자동으로 넘어간다**(뒷면을 이미 봤기 때문). 10장이면 조작 약 20번.
7. 카드 뒷면 = 표현·읽기 + 결과 띠(맞았어요/틀렸어요/건너뛴 카드) + 정답 뜻 + 예문(+번역). 카드 영역은 스크롤할 수 없으므로(`touch-action:none`) 예문은 2줄·번역 1줄로 자르고, 전체는 결과 화면·단어 상세에서 본다.
8. 결과 화면: 맞힘/틀림/건너뜀·걸린 시간·다시 볼 카드 수 → [이 세트 보관]·(보관 세트면 [다시 풀기]) → 틀린 단어·다시 볼 카드 목록(→ 단어 상세) → [오늘로]. 진행 중에 나가도 답한 카드는 이미 저장돼 있다. 오늘 홈이 "풀던 세트는 저장했어요" 토스트와 이어 풀기 카드로 안내한다.
9. **FLIP 뒷면 데이터는 계약 공백이다**(§5-11 ①). 권장안(FLIP 세트 카드에 뜻·예문 포함)이 확정되기 전에는 카드에 `meaning` 이 있을 때만 "뒤집기 → 자기 채점"으로 동작하고, 없으면 "자기 채점 → 뒷면"으로 동작하게 만든다(§5-2 D).

### 5-1. 화면 개요

| 항목 | 내용 |
|---|---|
| 목적 | 내 단어장에서 틀린 단어일수록 자주 나오는 세트(기본 10장, 약 3분)를 카드로 풀고, 결과를 남기고, 마음에 드는 세트는 보관해 다시 푼다 |
| 진입 | 하단 탭 "오늘" → `/study/today`(앱 로그인 착지도 여기, api-contract §0-3) → [시작하기]·[이어서 풀기]·[다시 풀기] → `/study/today/words/[id]` |
| 역할별 가시성 | 로그인 사용자 전원. 타인 세트 id → #49 404 → "세트를 찾을 수 없어요" |
| 앱/웹 분기 | 없음 |
| 하단 탭 | 오늘 홈은 보임. 덱·결과(`/study/today/words/`)는 **숨김**(TabBar `HIDDEN_PREFIXES` 추가) |
| 음성 | 소리 버튼 없음(E9). 자리는 덱 도구 줄의 [읽기]와 [표시] 사이, 결과 화면 단어 행 오른쪽(렌더하지 않음) |
| TTS 상태 표시등 | 없음(강사 아바타가 없는 화면) |

### 5-2. UI 구조 (의사코드, 390px 기준)

#### A. 오늘 홈 `/study/today` — `TodayHome`

```
AppBar title="오늘의 공부"
<div className="px-4 pb-8">
  TodayWordsCard                                  ← 첫 화면(≈780px) 안에 [시작하기]까지 들어와야 한다
  VocabStatsCard?      (#54 byCount 가 있을 때만)
  KeptSets?            (#48 kept=1 결과가 있을 때만)
  TodayComingSoon      (오늘의 회화 · AI 평가)
</div>
FinishConfirmSheet · Toast
```

와이어프레임(390px, 준비 상태):
```
┌──────────────────────────────────────┐
│ 오늘의 공부                        (나) │ AppBar
├──────────────────────────────────────┤
│ ┌ 오늘의 단어 ─────────────── 약 3분 ┐ │ 15px semibold · 12px ink2
│ │ 카드를 넘기며 뜻을 맞혀요.            │ │ 13px ink2
│ │ 틀린 단어일수록 자주 나와요.           │ │
│ │ 오늘 1세트를 끝냈어요 · 맞힘 8/10      │ │ (오늘 끝낸 세트가 있을 때) 12px ink2
│ │ 장수 [5장|10장|15장|20장|30장]        │ │ Segmented sm
│ │ 방식 [4지선다 | 뒤집기 카드]           │ │ Segmented sm
│ │ 분류 [전체][N5 기초][교정] →          │ │ CategoryChips(active)
│ │ [           시작하기           ]     │ │ primary full 48px
│ └──────────────────────────────────┘ │
│ 최근 30일                              │
│ ┌──────────────────────────────────┐ │
│ │ 5일 연속          월 화 수 목 금 토 일 │ │
│ │ 단어 세트를 끝낸   ✓  ✓  ·  ✓  ✓  ✓ ✓ │ │
│ │ 날이 이어졌어요                      │ │
│ │ 10장 세트 12번 · 맞힘 84 · 틀림 28 · 75% │
│ └──────────────────────────────────┘ │
│ 보관한 세트                     더 보기 │
│ ┌──────────────────────────────────┐ │
│ │ 9월 25일 · 10장 · 4지선다 [다시 풀기] │ │ 행 ≥64px
│ │ 맞힘 7 · 틀림 2 · 건너뜀 1            │ │
│ └──────────────────────────────────┘ │
│ 곧 열려요                              │
│ │ 오늘의 회화   주제·상황으로 1:1 수업   │ │
│ │ AI 평가      내 단어로 실력 점검       │ │
└──────────────────────────────────────┘
```

**TodayWordsCard** — `Card` 하나, 상태(§5-3 B)에 따라 안을 바꾼다. 머리줄은 모든 상태에서 같다: `h2 "오늘의 단어"`(15px semibold) + 오른쪽 `약 {m}분`(12px ink2, 준비 상태에서만, `estimateMinutes(count)`).

| 상태 | 내용 |
|---|---|
| `loading` | 머리줄 + "불러오는 중…"(ink2, `role=status`) |
| `ready` | 설명 2줄 · (오늘 끝낸 세트 ≥1) "오늘 {n}세트를 끝냈어요 · 맞힘 {Σc}/{Σ장}" · 라벨 "장수"(12.5px ink2) + `Segmented sm` `[5,10,15,20,30] ∪ {dailyWordCount}` 오름차순, 기본 `dailyWordCount` · 라벨 "방식" + `Segmented sm` `[4지선다 CHOICE \| 뒤집기 카드 FLIP]` · 라벨 "분류" + `CategoryChips basis=active`(분류가 1개 이하면 줄 생략) · [시작하기] primary full(요청 중 "만드는 중…" + `aria-busy`) · 400 이면 버튼 아래 12px bad 서버 문구 |
| `inProgress` | "풀던 세트가 있어요"(15px semibold) · "{오늘\|M월 D일} 시작 · {mode 라벨} · {cardCount}장 중 {answered}장 답함"(13px ink2) · "답한 카드는 저장돼 있어요."(12px ink2) · (시작일 ≠ 오늘) "지난 날 시작한 세트예요. 끝내면 그날 기록으로 남아요."(12px ink2) · 버튼: `answered < cardCount` → BtnRow [이어서 풀기](primary) [여기서 끝내기](ghost) / `answered === cardCount` → [결과 보기](primary full, #51) |
| `empty` (단어 0) | "단어장이 비어 있어요" · "오늘의 단어는 내 단어장에서 골라요. 기본 단어로 바로 시작해 볼까요?" · [기본 단어 50개 넣기](primary full, `useSeedPack`) · [단어 직접 추가](ghost full → `/drawer/words?add=1`) · (보관 단어 > 0) "보관한 단어 {n}개는 오늘의 단어에 나오지 않아요 · 단어장에서 보기 ›"(Link 44px) |
| `poolEmpty` | #47 가 `empty` 를 준 경우. 변형은 아래 |
| `error` | ErrorBlock(§5-8 ⓐ) + 다시 시도 |

`poolEmpty` 변형(서버 사유는 `NO_WORDS` 하나 → 화면이 #46 합계와 선택 분류로 가른다, §5-11 ⑤):

| 조건 | 문구 | 버튼 |
|---|---|---|
| 보관 안 한 단어 0 | (= `empty` 상태로 전환) | — |
| 분류 선택 중 | ‘{분류}’에서 오늘 풀 단어가 없어요. 오늘 끝낸 세트의 단어는 내일 다시 나와요. | [전체로 풀기](primary → 분류 null 로 #47) [분류 바꾸기](ghost → ready) |
| 분류 전체 | 오늘 풀 단어를 모두 풀었어요. 오늘 끝낸 세트의 단어는 내일 다시 나와요. | [보관한 세트 보기](보관 세트가 있으면, 그 섹션으로 스크롤) [단어 추가하기](→ `/drawer/words?add=1`) |

- [시작하기] → #47 `{ count, mode, category }`:
  - `session` → `sessionStorage kaiwa.vocab.notice.{id}` 에 `{ downgraded: session.downgraded ? 'few' : null }` 저장 → `router.push('/study/today/words/' + id)`.
  - `empty` → `poolEmpty`.
  - 409 `details.sessionId` → #49 로 그 세트를 읽어 `inProgress` + 토스트 "풀던 세트가 있어요. 이어서 풀거나 끝내 주세요."
- [여기서 끝내기] → `FinishConfirmSheet`(§5-2 F) → #51 → `router.push('/study/today/words/' + id)`(DONE 이라 결과 화면).
- 방식·분류의 마지막 선택은 `localStorage kaiwa.vocab.mode`·`kaiwa.vocab.category` 에 저장한다(분류가 사라졌으면 전체). 장수는 저장하지 않고 늘 `dailyWordCount` 에서 시작한다(설정이 기준).

**VocabStatsCard**(#54 `?days=30`, `byCount` 가 비면 섹션을 그리지 않는다)
```
SectionHeader "최근 30일"
Card flat
  <div className="flex items-start justify-between gap-3">
    <div>  <p className="text-[22px] font-semibold tabular-nums">{streakDays}일 연속</p>
           <p className="text-[12px] text-ink2 break-keep">단어 세트를 끝낸 날이 이어졌어요</p> </div>
    WeekStrip — 최근 7일(KST, 오늘이 맨 오른쪽)
  </div>
  byCount 상위 3줄(sessions 내림차순): "{cardCount}장 세트 {sessions}번 · 맞힘 {c} · 틀림 {w} · {정답률}%"  13px ink2
```
- `streakDays === 0` 이면 "오늘 한 세트 풀면 연속 기록이 시작돼요"(15px).
- WeekStrip: 7칸, 각 칸은 요일(12px ink2) + 원 24px. 푼 날(`daily` 에 그 날짜가 있음)은 `bg-good-soft text-good` "✓", 안 푼 날은 `bg-surface2 text-ink2` "·", 오늘 칸은 `ring-1 ring-accent`. 칸마다 `aria-label="9월 21일 월요일, 맞힘 7 틀림 2"` / `"… 안 풀었어요"`. 색만으로 구분하지 않는다(✓·· 글자 병행).
- 정답률 = `round(c / (c + w) × 100)`(건너뜀 제외), `c + w = 0` 이면 "—".
- 차트가 아니라 요약 숫자다. 막대·선 그래프는 Phase 3 성장기록에서 만든다.

**KeptSets**(#48 `?kept=1&limit=5`, 0개면 섹션 없음)
```
SectionHeader "보관한 세트"  right={nextCursor ? <button 44px>더 보기</button> : null}   ← 더 보기는 제자리에 이어 붙인다
<ul className="divide-y divide-line rounded-[14px] border border-line bg-surface">
  <li className="flex min-h-[64px] items-center gap-2 px-3.5 py-2">
     <Link href={`/study/today/words/${id}`} className="min-w-0 flex-1 py-1">      ← 결과 화면
        <p className="truncate text-[15px]">{M월 D일} · {cardCount}장 · {mode 라벨}</p>
        <p className="text-[12px] text-ink2">맞힘 {c} · 틀림 {w} · 건너뜀 {s}</p>
     </Link>
     <Btn variant="soft" className="flex-none px-3 text-[14px]">다시 풀기</Btn>   ← md 48px
  </li>
</ul>
```
- [다시 풀기] → #53 → `kaiwa.vocab.notice.{newId}` 에 `{ downgraded: session.downgraded ? 'deleted' : null }` → push 새 덱. 409 → 토스트 "풀던 세트를 먼저 끝내 주세요" + #49 로 `inProgress` 전환 + 카드로 스크롤.

**TodayComingSoon**
```
SectionHeader "곧 열려요"
Card flat ×2 (각 행: 제목 15px semibold + 설명 13px ink2 break-keep + Badge neutral "곧 열려요")
  오늘의 회화 — 주제와 상황을 골라 선생님과 1:1 수업을 해요.
  AI 평가 — 내 단어와 표현으로 지금 실력을 점검해요.
```
Phase·task 번호, 날짜 약속은 쓰지 않는다. 버튼·링크 없음(눌러도 반응 없는 요소를 만들지 않는다).

#### B. 덱 `/study/today/words/[sessionId]` — `VocabSessionScreen` → `VocabDeck`

레이아웃(앱 셸 `main` 을 정확히 채운다 — 채팅방과 같은 방식, 스크롤은 기본적으로 생기지 않는다):
```
<div className="mx-auto flex h-full min-h-[600px] w-full max-w-[520px] min-w-0 flex-col bg-ground">
  BackBar backHref="/study/today" backLabel="오늘로" title="오늘의 단어"
          subtitle="{mode 라벨} · {cardCount}장" right={<EndButton/>}      ← [끝내기] 텍스트 버튼 44px ink2
  DeckProgress           flex-none px-4 pt-3
  DeckNotice?            flex-none px-4 pt-2          (§아래 — 한 줄, 닫기 ✕)
  DeckStage              min-h-0 flex-1 grid place-items-center px-4 py-3
     SwipeCardStack      className="relative h-full max-h-[340px] min-h-[200px] w-[80%] max-w-[340px]"
  GestureHint            flex-none text-center 12px ink2 (또는 안내·경고 한 줄, role=status)
  DeckControls           flex-none px-4 pt-2           (CHOICE 보기 4 / FLIP 버튼)
  DeckToolbar            flex-none px-4 pt-2  style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
</div>
```
- `min-h-[600px]` 는 가로 모드·아주 낮은 화면에서만 `main` 스크롤을 허용하는 바닥값이다. 412×780·390×800 에서는 스크롤이 생기지 않아야 한다(높이 예산: 52 + 44 + 카드 ≥220 + 18 + 보기 232 + 도구 56 + 여백 ≈ 640).
- 데스크톱 ≥900px 은 `max-w-[520px] mx-auto` 로 가운데에 둔다.

와이어프레임 — CHOICE, 답하기 전(390px):
```
┌──────────────────────────────────────┐
│ ←  오늘의 단어                 [끝내기] │ BackBar
│    4지선다 · 10장                       │
├──────────────────────────────────────┤
│ 3 / 10                   남은 7장 · ★1 │ DeckProgress
│ ▰▰▱▱▱▱▱▱▱▱                            │ 세그먼트 막대 h-1.5
│                                        │
│      ┌────────────────────────┐        │ 스택(뒤 2장은 빈 카드, 8px씩 아래)
│      │ ★                      │        │ ★ = 다시 볼 카드(표시됐을 때만)
│      │          映画           │        │ 40px ja
│      │          えいが          │        │ 17px ink2 ja (읽기 켜짐)
│      └────────────────────────┘        │
│   ← 밀어 다음 · → 밀어 이전 · ↑ 밀어 표시 │ GestureHint
│ ┌ ① 영화                             ┐ │ 보기 52px ×4
│ ┌ ② 음악                             ┐ │
│ ┌ ③ 사진                             ┐ │
│ ┌ ④ 여행                             ┐ │
│ [‹ 이전] [가 읽기] [☆ 표시] [건너뛰기]  │ DeckToolbar 44px
└──────────────────────────────────────┘ safe-area-bottom
```

CHOICE, 답한 뒤(틀림):
```
│      ┌────────────────────────┐        │
│      │ 映画  えいが          ★ │        │ 22px + 14px
│      │ ✗ 틀렸어요              │        │ 결과 띠 bad-soft/bad
│      │ 영화                    │        │ 19px semibold
│      │ 昨日映画を見ました。      │        │ 16px ja, 2줄 자름
│      │ 어제 영화를 봤습니다.     │        │ 14px ink2, 1줄 자름
│      └────────────────────────┘        │
│ ┌ ① 영화                   ✓ 정답 ┐ │ good-soft/good
│ ┌ ② 음악                   ✗ 내 답 ┐ │ bad-soft/bad
│ ┌ ③ 사진                          ┐ │ ink2
│ ┌ ④ 여행                          ┐ │
│ [‹ 이전] [☆ 표시] [    다음 카드 ›    ] │ 다음 = primary flex-1
```

FLIP:
```
앞면  카드: 映画 / えいが + 아래 "탭하면 뜻이 보여요"(12px ink2)
      컨트롤: [뜻 보기] primary full 52px
뒷면  카드: 뒷면 구성(결과 띠 없음)
      컨트롤: BtnRow [알았어요](primary 52px) [몰랐어요](ghost 52px)   ← (pointer:fine) 이면 라벨 뒤 "1"·"2" 작은 키 표시
      → 응답이 오면 결과 띠("알았어요"=good / "몰랐어요"=bad)를 0.4초 보인 뒤 자동으로 다음 카드
도구 줄  [‹ 이전] [가 읽기] [☆ 표시] [건너뛰기]
```

**DeckProgress**
```
<div className="flex items-baseline justify-between">
  <p className="text-[15px] font-semibold tabular-nums">{view + 1} / {cardCount}</p>
  <p className="text-[12px] text-ink2">{viewing past ? '지난 카드 보는 중 · ' : ''}남은 {remaining}장{flagged > 0 ? ` · ★ ${flagged}` : ''}</p>
</div>
<div role="progressbar" aria-valuemin=0 aria-valuemax={cardCount} aria-valuenow={answeredCount}
     aria-valuetext="{cardCount}장 중 {answered}장 답함, 맞힘 {c} 틀림 {w}" className="mt-1.5 flex gap-[2px]">
  세그먼트 × cardCount: h-1.5 flex-1 rounded-full
    CORRECT bg-good · WRONG bg-bad · SKIPPED bg-ink3 · 지금 카드 bg-accent · 남은 카드 bg-surface2
    지난 카드를 보는 중이면 그 칸에 ring-2 ring-accent ring-offset-1
</div>
```
- `remaining = cardCount − answeredCount`. 30장이어도 칸 폭 ≈9px(360 기준)이라 그대로 쓴다.
- 세그먼트 색은 비텍스트 3:1 기준이고, 숫자·aria 로 같은 정보를 준다.

**DeckNotice**(한 줄, `bg-surface2 text-ink2 13px rounded-xl px-3 py-2` + ✕ 44px, `role=status`). 우선순위대로 하나만 보인다.

| 조건 | 문구 |
|---|---|
| sessionStorage notice `downgraded:'few'` | 뜻이 서로 다른 단어가 4개보다 적어서 이번엔 뒤집기 카드로 풀어요. |
| notice `downgraded:'deleted'` | 지운 단어가 있어서 이번엔 뒤집기 카드로 풀어요. |
| `cardCount < requestedCount` 이고 답한 카드 0 | 풀 수 있는 단어가 {cardCount}개라 {cardCount}장으로 만들었어요. |
| 들어왔을 때 이미 답한 카드 ≥1 | 이어서 풀어요 · {k}장은 이미 답했어요. (4초 뒤 자동으로 사라짐) |
| 시작일 ≠ 오늘 | {M월 D일}에 시작한 세트예요. 끝내면 그날 기록으로 남아요. |

notice 는 읽은 즉시 sessionStorage 에서 지운다(새로고침하면 다시 안 보임 — 괜찮다).

**VocabCardFace**(`memo`, 앞면·뒷면)
```
<div className="absolute inset-0 flex flex-col rounded-[18px] border border-line bg-surface p-4 shadow-sm">
  앞면:
    머리 줄 h-6: 왼쪽 비움 / 오른쪽 flagged ? ★(accent, aria-hidden) + sr-only "다시 볼 카드" : 없음
    가운데(flex-1 grid place-items-center text-center):
      <p lang=ja className={surfaceSize(surface) + ' font-semibold leading-tight [overflow-wrap:anywhere] line-clamp-3'}>{surface}</p>
      showReading && reading && reading !== surface → <p lang=ja className="mt-2 text-[17px] text-ink2">{reading}</p>
    아래: FLIP 이고 뒤집을 수 있으면 "탭하면 뜻이 보여요" 12px ink2
  뒷면:
    <p className="flex items-baseline gap-2"><span lang=ja className="text-[22px] font-semibold">{surface}</span>
       <span lang=ja className="min-w-0 truncate text-[14px] text-ink2">{reading}</span></p>   + 오른쪽 ★
    결과 띠(답했을 때): rounded-lg px-2.5 py-1 text-[13px] font-semibold
       CORRECT(CHOICE) "✓ 맞았어요" / WRONG(CHOICE) "✗ 틀렸어요" → good-soft/good · bad-soft/bad
       CORRECT(FLIP) "✓ 알았어요" / WRONG(FLIP) "✗ 몰랐어요" / SKIPPED "건너뛴 카드" → neutral(surface2/ink2)
    <p className="mt-2 text-[19px] font-semibold break-keep line-clamp-3">{correctText ?? meaning}</p>
    example → <p lang=ja className="mt-2 text-[16px] leading-[1.6] line-clamp-2 [overflow-wrap:anywhere]">{example}</p>
    exampleKo → <p className="text-[14px] text-ink2 line-clamp-1 break-keep">{exampleKo}</p>
</div>
```
- `surfaceSize`(순수 함수, 코드포인트 기준): ≤3 → `text-[40px]` · ≤6 → `text-[34px]` · ≤10 → `text-[28px]` · 그 외 `text-[22px]`. 최소 22px(일본어 16px 기준보다 크게).
- 카드 안에는 **버튼을 두지 않는다**(제스처 영역). 읽기·표시·뒤집기는 모두 탭/밀기 또는 영역 밖 버튼으로 한다.
- 뒤 2장(스택)은 빈 카드 껍데기만 그린다(`aria-hidden`, 내용 없음 — 다음 표현이 비쳐 보이지 않게).

**DeckControls — CHOICE `ChoiceList`**
```
<ol className="grid gap-2" aria-label="보기">
  <li><button type="button" data-choice={i}
       className="flex min-h-[52px] w-full min-w-0 items-center gap-3 rounded-xl border px-3 py-2 text-left text-[16px] leading-snug"
       aria-disabled={answered || pending} aria-label="{i+1}번, {choice}{상태}">
     <span aria-hidden className="grid h-6 w-6 flex-none place-items-center rounded-full bg-surface2 text-[12px] text-ink2">{i+1}</span>
     <span className="line-clamp-2 min-w-0 flex-1 break-keep">{choice}</span>
     <span className="flex-none text-[13px] font-semibold">{✓ 정답 | ✗ 내 답 | 확인 중…}</span>
  </button></li> × 4
</ol>
```

| 보기 상태 | 모양 |
|---|---|
| 기본 | `border-line bg-surface text-ink` |
| 누른 뒤 응답 대기(`pending`) | 누른 보기만 `border-accent` + 오른쪽 "확인 중…"(ink2), 나머지 `aria-disabled` |
| 정답(= `correctText`) | `border-good bg-good-soft text-good` + "✓ 정답" |
| 내가 고른 오답 | `border-bad bg-bad-soft text-bad` + "✗ 내 답" |
| 그 외(답한 뒤) | `border-line bg-surface text-ink2` — **`opacity` 로 흐리게 하지 않는다**(명암비가 무너진다) |

- 보기 글(한국어 뜻)은 `lang` 없음, 2줄에서 자른다. 전체 글은 `aria-label` 에 넣는다.
- 정답 보기는 응답의 `correctText` 와 문자열이 같은 보기다(E6 로 보기 4개의 뜻은 서로 다르다).

**DeckControls — FLIP `FlipControls`**: 앞면 [뜻 보기](primary full 52px) · 뒷면 미답 BtnRow [알았어요][몰랐어요](각 52px, `h-[52px]` 로 덮어씀) · 응답 대기 중엔 두 버튼 `aria-disabled` + 누른 버튼 "기록 중…". 답한 카드(이전 카드 보기)에서는 버튼 대신 한 줄 "{알았어요|몰랐어요|건너뛴 카드}로 기록했어요"(13px ink2).

**DeckToolbar**(`grid gap-2`, 버튼은 아이콘 + 12px 라벨 세로 배치 44px 이상, `ink` 글자)

| 카드 상태 | 칸 |
|---|---|
| 지금 카드, 안 답함 | [‹ 이전] [가 읽기](`aria-pressed`) [☆ 표시](`aria-pressed`) [건너뛰기] — `grid-cols-4` |
| 지금 카드, 답함 | [‹ 이전] [☆ 표시] [다음 카드 ›](primary, `col-span-2`) — 마지막 카드면 [결과 보기 ›] |
| 지난 카드 보는 중 | [‹ 이전] [☆ 표시] [다음 카드 ›](primary, `col-span-2`) |
| 첫 카드 | [‹ 이전]은 `aria-disabled` + 누르면 안내 "첫 카드예요" |

- [가 읽기]는 읽기 값이 없거나 표현과 같으면 `aria-disabled`(이유: "이 카드는 읽기가 따로 없어요").
- [☆ 표시]: 켜짐은 채운 별(accent) + 라벨 "표시됨", 꺼짐은 빈 별 + "표시".
- [건너뛰기] → #50 `{ order, skipped: true }` → 뒷면(결과 띠 "건너뛴 카드") + [다음 카드].
- 소리 버튼 자리는 [가 읽기]와 [☆ 표시] 사이다(E9 — 지금은 그리지 않고 `grid-cols-4` 유지).

**GestureHint**(12px ink2, 한 줄, `aria-hidden` — 스크린리더에는 버튼이 같은 기능을 한다)
- 터치(`matchMedia('(pointer: coarse)')`): `← 밀어 다음 · → 밀어 이전 · ↑ 밀어 표시`(화살표 = 손가락 방향).
- 정밀 포인터: `1~4 고르기 · → 다음 · ← 이전 · F 표시`(FLIP 은 `Space 뒤집기 · 1 알았어요 · 2 몰랐어요 · → 다음`).
- 막힌 동작이 있으면 이 줄을 2초 동안 안내로 바꾼다(`role=status`): "먼저 답을 골라 주세요" / "알았어요·몰랐어요를 먼저 골라 주세요" / "첫 카드예요" / "다시 볼 카드로 표시했어요" / "표시를 뺐어요".
- **bjj 힌트 문구를 복사하지 않는다.** bjj 는 `← 이전 · 다음 →` 로 적혀 있지만 실제로는 왼쪽으로 밀면 다음이다(문구와 동작이 반대).
- 덱 화면은 하단 `Toast`(bottom 84px)를 쓰지 않는다. 보기·도구 줄을 가리기 때문이다. 알림은 이 줄과 DeckNotice 로만 한다.

#### C. 제스처 이식 — `SwipeCardStack` (출처 `bjj-trainning/web/src/components/SwipeCardDeck.jsx`)

그대로 옮기는 것
| # | bjj 규칙 | TheKaiwa 적용 |
|---|---|---|
| 1 | 드래그 시작 좌표 `startRef`, 진행 여부 `activeRef`(state 가 아니라 ref — 이벤트 핸들러의 stale closure 방지), 이동량 `drag {x,y,active}` state | 같다 |
| 2 | 끝낼 때 `total = abs(dx) + abs(dy)` → `< 10` 탭 → `dy < −80` 위 → `abs(dx) > 60` 좌우(**이 순서**) | 같다. 순수 함수 `classifyGesture(dx, dy)` 로 떼어 단위 테스트 |
| 3 | 3장 스택: `[i+2, i+1, i]` 순서로 그리고 `offset = 2 − stackPos`, 뒤 카드 `scale(1 − 0.04·offset) translateY(8·offset px)`, 맨 위 `translateX(x) translateY(y) rotate(0.05·x deg)` | 같다(i = `view`). 뒤 카드 `pointer-events:none`·`aria-hidden`·빈 껍데기 |
| 4 | 드래그 중 `transition: none`, 그 외 `transform .3s ease, opacity .3s ease` | 같다 |
| 5 | 제스처 영역 `width: 80%`(가운데), `touchAction: 'none'`, `userSelect: 'none'` — 좌우 10% 는 페이지 스크롤용 | `w-[80%] max-w-[340px]`, `touch-action:none`, `select-none` |
| 6 | `touchend` 에서 `if (e.cancelable) e.preventDefault()` 후 `changedTouches[0]` 로 끝냄 — 호환 mouse/click 이벤트가 뒤따라 새로 그려진 요소(모달 오버레이)에 떨어지는 사고를 막는다 | 같다. TheKaiwa 에서는 **뒤집기 직후 새로 생긴 [알았어요] 버튼**에 유령 클릭이 떨어지는 것을 막는다 |
| 7 | 마우스: `mousedown`(preventDefault + 시작) · `mousemove` · `mouseup` · `mouseleave`(드래그 중이면 끝냄) | 같다 |
| 8 | 애니메이션 중(`picking`)에는 드래그 시작 무시 | `animating`(넘기기 180ms) 또는 답 응답 대기 중이면 무시 |

바꾸는 것
| bjj | TheKaiwa |
|---|---|
| 탭 → 상세 열기 | 탭 → FLIP 앞면이면 뒤집기, CHOICE 앞면이면 읽기 토글, 뒷면이면 아무것도 안 함 |
| 위 −80 → 카드를 위로 날리고(`translateY(-120%)`) 다음 카드 | 위 −80 → **표시(flagged) 토글만**. 카드는 넘어가지 않고 16px 위로 튀었다 돌아온다(160ms). ★ 가 켜지거나 꺼진다 |
| 왼쪽 → 다음(`min(i+1, n−1)`) | 왼쪽 → `canNext` 일 때만 다음. 카드가 왼쪽으로 날아가고(`translateX(-120%) rotate(-8deg)`, opacity 0, 180ms) `view+1`. 안 되면 튕겨 돌아오고 GestureHint 안내 |
| 오른쪽 → 이전 | 오른쪽 → `view > 0` 이면 이전(읽기 전용). 새 카드는 opacity 120ms 로 나타난다 |
| 제한 없음 | **저항**: 움직일 수 없는 방향(안 답한 카드의 왼쪽, 첫 카드의 오른쪽)으로 끌면 `x × 0.25` 만 따라온다 |
| 없음 | `touchcancel` → 아무 동작 없이 원위치. 손가락 2개(`touches.length > 1`) → 드래그 취소 |
| 카드마다 드래그 중 setState 로 전체 재렌더 | setState 는 그대로 두되 `VocabCardFace` 를 `memo` 로 감싸 드래그 중에는 transform 만 바뀌게 한다 |
| 진행 표시 `index+1 / n` | DeckProgress(§B) |
| 힌트 `← 이전 · 다음 →` | GestureHint(§B, 방향 바로잡음) |

- React 의 `onTouchStart`·`onTouchMove` 는 passive 로 붙는다 — 거기서는 `preventDefault` 를 하지 않는다(스크롤은 `touch-action:none` 이 막는다). `onTouchEnd` 는 passive 가 아니라 `preventDefault` 가 먹는다.
- `prefers-reduced-motion: reduce` → 회전·날아가기·튀기 없음, opacity 120ms 전환만.
- 스택 영역: `role="group" aria-roledescription="카드" aria-label="{view+1}번째 카드, 모두 {n}장"`. 카드가 바뀌면 sr-only live 영역(`aria-live=polite`)에 "{n}번째 카드, {surface}"(surface 는 `lang=ja` span), 답 응답이 오면 "맞았어요. 정답 {correctText}" / "틀렸어요. 정답 {correctText}" 를 알린다.

키보드(document `keydown`, `VocabDeck` 마운트 동안)
| 키 | CHOICE | FLIP |
|---|---|---|
| `1`~`4` | 지금 카드·안 답함 → 그 보기 선택 | `1` 알았어요 · `2` 몰랐어요(뒷면일 때) |
| `Space`·`Enter` | 답한 카드 → 다음(마지막이면 결과 보기) | 앞면 → 뒤집기 / 답한 카드 → 다음 |
| `→` | 다음(`canNext` 일 때) | 같음 |
| `←` | 이전 | 같음 |
| `F`·`↑` | 표시 토글 | 같음 |
| `R` | 읽기 토글 | 같음 |
| `S` | 건너뛰기(안 답함) | 같음 |

무시 조건: 대상이 `input/textarea/select/[contenteditable]` · 시트가 열림 · `e.isComposing` · `ctrl/meta/alt` · `e.repeat` · 초점이 `button`/`a` 인데 `Space`/`Enter`(버튼 자신의 클릭과 이중 실행 방지).
초점: 답 응답 후 [다음 카드]로, 새 카드가 되면 첫 보기(CHOICE) 또는 [뜻 보기](FLIP)로 `focus({ preventScroll: true })`. 포커스 링은 `focus-visible` 에서만 보이므로 터치 사용자에게는 보이지 않는다.

#### D. 한 장의 흐름 (두 모드)

```
CHOICE:  앞면 ──(보기 탭 / 1~4)──▶ pending ──#50──▶ 뒷면(결과 띠·정답 뜻·예문) + 보기 표시 ──(다음 / ← 밀기 / →키)──▶ 다음 카드
                                      └─ 실패 → 보기 원상태 + GestureHint "저장하지 못했어요. 다시 눌러 주세요"
FLIP(권장안, 카드에 meaning 있음):
         앞면 ──(탭 / [뜻 보기] / Space)──▶ 뒷면 ──([알았어요]/[몰랐어요] / 1·2)──▶ pending ──#50──▶ 결과 띠 0.4초 ──▶ 자동 다음 카드
FLIP(대체, 카드에 meaning 없음):
         앞면(힌트 "알았어요·몰랐어요를 누르면 뜻이 보여요", [뜻 보기] 없음) ──([알았어요]/[몰랐어요])──▶ pending ──#50──▶ 뒷면(응답의 correctText·예문) + [다음 카드]
건너뛰기(두 모드): 안 답한 카드 ──[건너뛰기]/S──▶ #50 {skipped:true} ──▶ 뒷면("건너뛴 카드") + [다음 카드]
```
- 대체 흐름에서는 탭이 뒤집기가 아니라 읽기 토글이다. 어느 흐름인지는 `card.meaning != null`(세트 전체가 같다)로 정한다.
- `responseMs` = 그 카드가 **지금 카드로 보인 시각부터** 답을 누른 시각까지(`document.hidden` 인 동안·지난 카드를 보는 동안은 멈춤), `min(60000, round(ms))`. 서버 범위 0~60,000 밖은 400 이라 반드시 자른다. 건너뛰기에는 보내지 않는다.

#### E. 결과 화면 — `VocabResult` (세트가 `DONE`)

```
BackBar backHref="/study/today" backLabel="오늘로" title="세트 결과" subtitle="{M월 D일} · {mode 라벨} · {cardCount}장" sticky
<div className="px-4 pb-8">
  ResultSummary  Card
     <p className="text-[22px] font-semibold">{cardCount}장 중 {c}장 맞혔어요</p>           ← FLIP 이면 "{cardCount}장 중 {c}장 알았어요"
     <div className="mt-3 grid grid-cols-3 gap-2">  StatTile ×3
          맞힘 {c}(위 테두리 good) · 틀림 {w}(bad) · 건너뜀 {s}(ink3)   — 숫자 22px ink, 라벨 12px ink2
     <p className="mt-2 text-[13px] text-ink2">걸린 시간 {m분 s초} · 다시 볼 카드 {f}장</p>   ← durationSec 없으면 시간 조각 생략
     replayOfId && <p className="text-[12px] text-ink2">보관한 세트를 다시 푼 결과예요.</p>
  KeepCard  Card flat mt-3
     keptAt 없음: [☆ 이 세트 보관](ghost full) + "보관하면 오늘 탭에서 같은 단어로 다시 풀 수 있어요."(12px ink2)
     keptAt 있음: "★ 보관한 세트예요"(15px) + BtnRow [다시 풀기](primary) [보관 풀기](ghost)
  WordResultList title="틀린 단어 {n}"    (n > 0)
  WordResultList title="다시 볼 카드 {n}"  (n > 0)
  <details className="mt-4"> <summary className="flex min-h-[44px] items-center …">전체 카드 {cardCount}장 보기</summary> WordResultList(all) </details>
  BtnRow [오늘로](primary → /study/today) [단어장 보기](ghost → /drawer/words)
</div>
Toast
```
`WordResultList` 행(≥56px):
```
wordId ? <Link href={`/drawer/words?word=${wordId}`}> : <div>          ← 지운 단어는 링크 없이 Badge neutral "지운 단어"
  <span lang=ja className="text-[17px] font-semibold">{surface}</span> <span lang=ja className="text-[13px] text-ink2">{reading}</span>
  <p className="text-[14px] break-keep">정답 {correctText}{chosenText && answer==='WRONG' ? ` · 내 답 ${chosenText}` : ''}</p>
  오른쪽: 결과 Badge(맞힘 good / 틀림 bad / 건너뜀 neutral)(전체 목록에서만) + ★(flagged) + ›
```
- 보관: #52 `{ kept: true|false }` → 토스트 "보관했어요 · 오늘 탭 ‘보관한 세트’에서 다시 풀 수 있어요" / "보관을 풀었어요". 409 → 토스트 "끝난 세트만 보관할 수 있어요" + #49 다시 읽기.
- [다시 풀기](보관 세트만 — §5-11 ⑦) → #53 → notice 저장 → `router.push` 새 덱. 409 → 토스트 "풀던 세트를 먼저 끝내 주세요" → `/study/today`.
- 결과 화면은 `main` 이 스크롤된다(BackBar sticky). 여기서는 하단 `Toast` 를 써도 된다(탭 바가 없고, 아래 버튼은 고정이 아니다).

#### F. 끝내기 확인 — `FinishConfirmSheet`(오늘 홈 [여기서 끝내기]·덱 [끝내기] 공용)

```
Sheet title="여기서 끝낼까요?" dismissible={!busy}
  <p className="break-keep text-[14px] text-ink2">
     {unanswered > 0 ? `답하지 않은 ${unanswered}장은 건너뛴 것으로 기록돼요.` : '모든 카드에 답했어요.'} 끝내면 결과가 기록에 남아요.</p>
  BtnRow [끝내기](primary, 요청 중 "끝내는 중…") [계속 풀기](ghost)
```
- 답한 카드가 0장이면 제목을 "이 세트를 그만둘까요?", 본문을 "아직 답한 카드가 없어요. 끝내면 모두 건너뛴 세트로 기록돼요."로 바꾼다(§5-11 ② 결정에 따라 바뀔 수 있음).
- 덱의 ← 는 확인 없이 `/study/today` 로 간다(답한 카드는 이미 저장됨). 떠날 때 `sessionStorage kaiwa.vocab.left = sessionId` → 오늘 홈이 마운트 때 읽고 토스트 "풀던 세트는 저장했어요. 이어서 풀 수 있어요."를 띄운 뒤 지운다. 안드로이드 뒤로가기·브라우저 뒤로가기도 같은 결과다(막지 않는다).

### 5-3. 상태 관리

#### A. 덱 — `useVocabDeck(sessionId)`

```
phase: 'loading' | 'playing' | 'finishing' | 'result' | 'notFound' | 'error'
session: VocabSessionInfo
cards: DeckCard[]      // VocabCard + { local: { pending?: 'answer'|'flag'; chosen?: string; flipped?: boolean } }
view: number           // 지금 보고 있는 카드
frontier: number       // 첫 안 답한 카드(모두 답했으면 cardCount)
showReading: boolean   // localStorage kaiwa.vocab.readingDefault, 기본 true
animating: boolean ; hint: string | null ; notice: DeckNoticeKind | null
result: FinishResult | null
```
- `answered(i) = cards[i].answer != null`. `canNext = answered(view) && view + 1 < cardCount`. 마지막 카드(`view === cardCount − 1`)를 답하면 [결과 보기]가 된다.
- 답은 늘 `frontier` 카드에서만 받는다(`view === frontier`). 앞 카드가 다 답해진 상태로만 다음으로 갈 수 있어서, 답한 카드는 언제나 앞쪽에 모인다.

| 현재 | 사건 | 다음 | 처리 |
|---|---|---|---|
| loading | #49 `IN_PROGRESS` | playing | `frontier` = 첫 미답(없으면 cardCount), `view = min(frontier, cardCount−1)`, notice 계산(§5-2 B) |
| loading | #49 `DONE` | result | 결과 화면(#49 카드 전부 정답 포함) |
| loading | 404 | notFound | "세트를 찾을 수 없어요" + [오늘로] |
| playing | `choose(text)`(view===frontier, 미답, pending 아님) | playing | 그 카드 `pending='answer'`, `chosen=text` → 큐에 #50 `{order, chosenText, responseMs, flagged}` |
| playing | #50 응답 | playing | 카드에 `answer·correctText·chosenText·example·exampleKo` 저장, `frontier+1`, 타이머 정지, 초점 → [다음 카드]. FLIP(권장) → 0.4초 뒤 `next()` |
| playing | #50 실패 0·5xx | playing | pending 해제(보기 원상태), hint "저장하지 못했어요. 다시 눌러 주세요" — 같은 `order` 재전송은 서버가 첫 결과를 돌려주므로 안전 |
| playing | #50 409 | loading | #49 다시 읽기(대개 다른 기기에서 끝남 → result) |
| playing | #50 400 | loading | #49 다시 읽기(보기 스냅샷 불일치 방어) |
| playing | `flip()`(FLIP, 앞면, meaning 있음) | playing | `flipped=true` |
| playing | `skip()` | playing | #50 `{order, skipped:true}` → 응답 처리는 답과 같음 |
| playing | `toggleFlag(i)`(어느 카드든) | playing | 즉시 ★ 반전(사용자 직접 행위라 먼저 그린다) → 큐에 #50 `{order, flagged}` → 실패하면 되돌리고 hint "표시를 저장하지 못했어요" |
| playing | `next()` | playing | `canNext` 아니면 hint + 튕김. 맞으면 날아가기 180ms → `view+1`, 새 지금 카드면 타이머 시작 |
| playing | `prev()` | playing | `view>0` 이면 `view−1`(지난 카드 = 읽기 전용, 보기·버튼 `aria-disabled`, 타이머 정지) |
| playing | [결과 보기] / 확인 시트 [끝내기] | finishing | 큐가 빌 때까지 기다린 뒤 #51 |
| finishing | #51 응답 | result | `result` 저장 → #49 한 번 더 읽어 카드 전체(정답·예문) 확보 |
| finishing | #51 실패 | playing | hint/시트 안 문구 "결과를 저장하지 못했어요. 다시 시도해 주세요." — #51 은 멱등이라 다시 눌러도 된다 |

- **요청 큐** `useAttemptQueue(sessionId)`: #50·#51 을 세션당 한 줄로 순서대로 보낸다(`promise chain`). 표시 토글과 답이 섞여도 서버에 도착하는 순서가 누른 순서와 같다. finish 는 큐 맨 뒤에 붙는다(앞선 답이 모두 저장된 뒤 끝냄).
- 언마운트해도 큐에 남은 요청은 끝까지 보낸다(abort 하지 않음 — 답 저장이 목적). 화면 갱신만 막는다.
- `visibilitychange → visible` 이면 #49 를 조용히 다시 읽어 서버 상태와 맞춘다(다른 기기에서 풀었거나 끝낸 경우). 로컬 pending 이 있으면 건너뛴다.
- 타이머 `useCardTimer`: 지금 카드가 보이는 동안만 누적(`visibilitychange` 로 멈춤·재개), 지난 카드를 보는 동안은 멈춘다.
- 읽기 토글은 세트 전체에 적용되고 `localStorage kaiwa.vocab.readingDefault`('on'|'off')에 저장한다(try/catch).

#### B. 오늘 홈 — `TodayHome`

```
words: 'loading' | 'ready' | 'starting' | 'inProgress' | 'empty' | 'seeding' | 'poolEmpty' | 'error'
count: number (기본 dailyWordCount) ; mode: 'CHOICE'|'FLIP' ; category: string | null
categories: CategoryCount[] | null ; recent: SessionSummary[] ; kept: Paged<SessionSummary> | null ; stats: VocabStats | null
inProgress: { session: VocabSessionInfo; answered: number } | null ; poolEmptyKind ; startError: string | null
```
1. 마운트: #46 · #48 `?limit=10` · #48 `?kept=1&limit=5` · #54 `?days=30` 를 병렬로 부른다. 네 개 중 #46·#48(최근) 실패만 `error` 이고, 보관 세트·통계 실패는 그 섹션을 조용히 숨긴다.
2. 최근 목록에 `status === 'IN_PROGRESS'` 가 있으면 #49 로 답한 수를 세고 `inProgress`. 아니면 #46 의 `Σcount === 0` → `empty`, 그 외 `ready`.
3. 오늘 끝낸 세트: 최근 목록 중 `date === 오늘(KST)`·`DONE` 의 개수와 합계(표시용, 서버 날짜 기준 값을 그대로 비교).
4. `sessionStorage kaiwa.vocab.left` 가 있으면 토스트 1회 후 지운다.
5. 다시 보일 때(`visible`) 1~2를 다시 한다. 자동 폴링은 없다.

### 5-4. API 호출 계획

| # | 엔드포인트 | 메서드 | 화면 동작 | 파라미터 | 사용 필드 | 오류 처리 |
|---|---|---|---|---|---|---|
| 11 | (서버 컴포넌트) `preferences.getProfile` | — | 오늘 홈 기본 장수 | — | `dailyWordCount`(5~30, 기본 10) | — |
| 46 | `/api/v1/words/categories` | GET | 분류 칩·빈 단어장 판정·poolEmpty 구분 | — | `category,count,archivedCount` | 오늘 홈 `error` |
| 46b | `/api/v1/words/seed-pack` | POST | 빈 상태 [기본 단어 50개 넣기] | `{pack:'N5'}` | `added,skipped` | 카드 안 ErrorBlock |
| 47 | `/api/v1/vocab/sessions` | POST | [시작하기]·[전체로 풀기] | `{count, mode, category}`(`category` 는 `null` = 전체) | `session.{id,downgraded,cardCount,requestedCount}` / `empty.reason` | 409 `details.sessionId` → inProgress · 400 서버 문구 · 그 외 §5-8 ⓐ |
| 48 | `/api/v1/vocab/sessions` | GET | 진행 중 찾기·오늘 끝낸 수 / 보관한 세트·더 보기 | `limit=10` / `kept=1&limit=5&cursor=` | `items[].{id,date,mode,cardCount,correctCount,wrongCount,skippedCount,status,keptAt,replayOfId}` · `nextCursor` | 최근: `error` / 보관: 섹션 숨김 |
| 49 | `/api/v1/vocab/sessions/:id` | GET | 덱 로드·이어 풀기·결과·홈의 답한 수 | — | `session`, `cards[].{order,wordId,surface,reading,choices,flagged,answered,answer,correctText,chosenText,example,exampleKo?,meaning?}` | 404 → notFound 화면 |
| 50 | `/api/v1/vocab/sessions/:id/attempts` | POST | 보기·알았어요/몰랐어요·건너뛰기·표시 | CHOICE `{order, chosenText, responseMs, flagged}` · FLIP `{order, selfResult:'CORRECT'\|'WRONG', responseMs}` · `{order, skipped:true}` · 표시 `{order, flagged}` | `answer,correctText,chosenText,example,exampleKo,answeredAt` / 표시: `flagged` | §5-3 A 표 |
| 51 | `/api/v1/vocab/sessions/:id/finish` | POST | [결과 보기]·[끝내기]·홈 [여기서 끝내기] | — | `session.{correctCount,wrongCount,skippedCount,durationSec}` · `wrongWords[]` · `flaggedCount` | 멱등 — 실패 시 다시 시도 |
| 52 | `/api/v1/vocab/sessions/:id/keep` | POST | [이 세트 보관]·[보관 풀기] | `{kept}` | `keptAt` | 409 토스트 |
| 53 | `/api/v1/vocab/sessions/:id/replay` | POST | [다시 풀기](홈·결과) | — | #47 형태 | 409 → 풀던 세트 안내 |
| 54 | `/api/v1/vocab/stats` | GET | 최근 30일 카드 | `days=30` | `byCount[]`, `daily[]`, `streakDays` | 섹션 숨김 |

- 덱은 #47 응답의 카드를 넘겨받지 않고 **늘 #49 로 다시 읽는다**(새로고침·이어 풀기·다른 기기와 같은 경로, 추가 비용 GET 1회).
- 결과 화면은 #51 응답(개수·걸린 시간)을 먼저 그리고, 카드 목록은 #49(DONE → 전 카드 정답 포함)로 채운다. 재방문이면 #49 만 쓴다(§5-11 ④).
- 오류는 `toErr` → **status 먼저**. 서버 `message` 는 400 에서만 보인다.

### 5-5. 컴포넌트 분해 (`src/components/vocab/*`)

| 컴포넌트/모듈 | 종류 | props | 상태 |
|---|---|---|---|
| `TodayHome` | client | `{ dailyWordCount: number }` | §5-3 B |
| `TodayWordsCard` | client | `{ state; count; mode; category; categories; todayDone; inProgress; poolEmptyKind; startError; onCount(n); onMode(m); onCategory(c); onStart(); onResume(); onFinish(); onSeed(); onShowKept() }` | — |
| `VocabStatsCard` | client | `{ stats: VocabStats }` | — |
| `WeekStrip` | client | `{ daily: VocabStats['daily']; today: string }` | — |
| `KeptSets` | client | `{ initial: Paged<SessionSummary>; onReplay(id); busyId }` | `items, nextCursor, loadingMore` |
| `TodayComingSoon` | server/client | — | — |
| `FinishConfirmSheet` | client | `{ open; unanswered: number; answered: number; busy; error; onConfirm(); onClose() }` | — |
| `VocabSessionScreen` | client | `{ sessionId: string }` | `useVocabDeck` → phase 로 Deck/Result/NotFound 분기 |
| `VocabDeck` | client | `{ deck: ReturnType<typeof useVocabDeck> }` | 키보드 리스너, 끝내기 시트 열림 |
| `DeckProgress` | client | `{ cards; view; frontier }` | — |
| `DeckNotice` | client | `{ kind; params; onClose() }` | 4초 자동 닫힘(이어 풀기) |
| `SwipeCardStack` | client | `{ count; view; renderTop(): ReactNode; canNext; canPrev; locked; onTap(); onUp(); onLeft(); onRight(); onBlocked(dir) }` | `drag`, `animating`, refs(§5-2 C) |
| `VocabCardFace` | client(memo) | `{ card; side: 'front'\|'back'; mode; showReading; canPeek }` | — |
| `ChoiceList` | client | `{ card; locked; onChoose(text) }` | — |
| `FlipControls` | client | `{ card; flipped; canPeek; locked; onFlip(); onSelf(r) }` | — |
| `DeckToolbar` | client | `{ card; isCurrent; isFirst; isLast; flagged; showReading; readingAvailable; onPrev(); onReading(); onFlag(); onSkip(); onNext() }` | — |
| `GestureHint` | client | `{ mode; hint: string \| null }` | `(pointer: coarse)` 판정 |
| `VocabResult` | client | `{ session; cards; finish?: FinishResult; onKeep(k); onReplay() }` | `keeping, replaying` + Toast |
| `WordResultList` | client | `{ title; cards; showResult: boolean }` | — |
| `useVocabDeck` | hook | `(sessionId)` | §5-3 A |
| `useAttemptQueue` | hook | `(sessionId)` → `{ send(body), finish() }` | 직렬 큐 |
| `useCardTimer` | hook | `(active: boolean)` → `{ elapsed(): number, reset() }` | 누적 ms |
| `deck.ts` | 순수 | `classifyGesture(dx,dy)`, `frontierOf(cards)`, `canNext`, `keyAction(e, ctx)`, `surfaceSize(s)`, `clampResponseMs(ms)`, `markChoice(choice, card)`, `estimateMinutes(n) = Math.round((n × 12 + 30) / 60)`(카드 12초 + 결과 30초, §7-2), `countOptions(daily)` = `[5,10,15,20,30] ∪ {daily}` 오름차순 | — |
| `format.ts`(vocab) | 순수 | `formatDuration(sec)`("2분 36초"), `formatSessionDate(date, today)`("오늘"·"9월 25일"), `weekDays(today)` | — |

`src/types/vocab.ts`(§4 타입에 더해): `VocabMode`, `VocabAnswer`, `VocabSessionStatus`, `VocabSessionInfo`(#47 `session` + DONE 일 때 개수·`durationSec`·`keptAt`·`replayOfId` 선택), `VocabCard`, `CreateSessionResult`(`{session, cards} | {session:null, empty:{reason, cta}}`), `AttemptResult`, `FinishResult`, `SessionSummary`(#48 항목), `VocabStats`.

### 5-6. 생성/수정 파일 목록

신규
- `src/app/(app)/study/today/words/[sessionId]/page.tsx` — 서버: `params`(Promise) → `auth()`(없으면 로그인으로) → `<VocabSessionScreen sessionId />`. 소유 확인·데이터는 화면이 #49 로 한다(타인 404 화면).
- `src/components/vocab/{TodayHome,TodayWordsCard,VocabStatsCard,WeekStrip,KeptSets,TodayComingSoon,FinishConfirmSheet}.tsx`
- `src/components/vocab/{VocabSessionScreen,VocabDeck,DeckProgress,DeckNotice,SwipeCardStack,VocabCardFace,ChoiceList,FlipControls,DeckToolbar,GestureHint,VocabResult,WordResultList}.tsx`
- `src/components/vocab/{useVocabDeck,useAttemptQueue,useCardTimer,deck,format}.ts`
- `src/components/vocab/__tests__/{deck,format}.test.ts` — `classifyGesture` 경계(9/10px·−79/−80·59/60·대각선 위 우선), `keyAction` 무시 조건, `surfaceSize`, `clampResponseMs`(음수·60,001), `estimateMinutes`(5→2·10→3·30→7), `frontierOf`(부분 답·전부 답)

수정
- `src/app/(app)/study/today/page.tsx` — `ComingSoon` 을 걷어 내고 서버에서 `auth()` + `getProfile(userId).dailyWordCount` → `<AppBar title="오늘의 공부" />` + `<TodayHome dailyWordCount />`
- `src/components/shell/TabBar.tsx` — `HIDDEN_PREFIXES` 에 `'/study/today/words/'` 추가(**전역 — §5-11 ⑩**)

### 5-7. 구현 순서 (§4 와 합쳐 developer B 한 사람 기준)

1. 공용 순수 모듈: `types/vocab.ts`·`labels.ts`·`validate.ts`·`deck.ts`·`format.ts` + 단위 테스트.
2. §4 단어장(§4-7 2~7단계) — 오늘 홈의 빈 상태·칩이 이것에 기댄다.
3. TabBar 숨김 경로 + 덱 서버 페이지 + `VocabSessionScreen` 로드(#49)·notFound.
4. `SwipeCardStack` 단독 이식(가짜 카드 3장으로 제스처·스택·저항·튕김·reduced-motion 확인) → 실기기 Chrome 에서 탭/밀기 임계 확인.
5. `useVocabDeck`·`useAttemptQueue`·`useCardTimer` + CHOICE(`ChoiceList`·`VocabCardFace` 앞/뒤·`DeckToolbar`·`DeckProgress`·`GestureHint`).
6. FLIP(권장 흐름 + 대체 흐름), 건너뛰기, 표시 토글(위 밀기·버튼·F), 이전 카드 보기.
7. 키보드 단축키·초점 이동·live 영역.
8. finish(#51)·`FinishConfirmSheet`·`VocabResult`·보관(#52)·다시 풀기(#53)·DeckNotice.
9. 오늘 홈: `TodayWordsCard` 5상태 + `poolEmpty` 변형 + `KeptSets` + `VocabStatsCard`/`WeekStrip` + `TodayComingSoon` + 떠남 토스트.
10. §5-9 체크리스트 자체 점검 → reviewer 인계.

### 5-8. 한국어 UI 문구

ⓐ **오늘 홈**

| 자리 | 문구 |
|---|---|
| 앱바 | 오늘의 공부 |
| 카드 머리 | 오늘의 단어 / 약 {m}분 |
| 설명 | 카드를 넘기며 뜻을 맞혀요. 틀린 단어일수록 자주 나와요. |
| 오늘 끝냄 | 오늘 {n}세트를 끝냈어요 · 맞힘 {c}/{t} |
| 라벨 | 장수 / 방식 / 분류 |
| 장수 | {n}장 (aria: 카드 장수) |
| 방식 | 4지선다 / 뒤집기 카드 (aria: 푸는 방식) |
| 시작 | 시작하기 / 만드는 중… |
| 풀던 세트 | 풀던 세트가 있어요 / {오늘\|M월 D일} 시작 · {방식} · {N}장 중 {k}장 답함 / 답한 카드는 저장돼 있어요. / 지난 날 시작한 세트예요. 끝내면 그날 기록으로 남아요. / 이어서 풀기 / 여기서 끝내기 / 결과 보기 |
| 409(시작) | 풀던 세트가 있어요. 이어서 풀거나 끝내 주세요. |
| 빈 단어장 | 단어장이 비어 있어요 / 오늘의 단어는 내 단어장에서 골라요. 기본 단어로 바로 시작해 볼까요? / 기본 단어 50개 넣기 / 넣는 중… / 단어 직접 추가 / 보관한 단어 {n}개는 오늘의 단어에 나오지 않아요 · 단어장에서 보기 |
| 기본 단어 결과 | §4-8 ⓓ 와 같음 |
| 오늘 풀 단어 없음 | 오늘 풀 단어를 모두 풀었어요. 오늘 끝낸 세트의 단어는 내일 다시 나와요. / 보관한 세트 보기 / 단어 추가하기 |
| 분류에 없음 | ‘{분류}’에서 오늘 풀 단어가 없어요. 오늘 끝낸 세트의 단어는 내일 다시 나와요. / 전체로 풀기 / 분류 바꾸기 |
| 떠난 뒤 | 풀던 세트는 저장했어요. 이어서 풀 수 있어요. |
| 통계 | 최근 30일 / {n}일 연속 / 단어 세트를 끝낸 날이 이어졌어요 / 오늘 한 세트 풀면 연속 기록이 시작돼요 / {N}장 세트 {s}번 · 맞힘 {c} · 틀림 {w} · {p}% / (aria) {M월 D일} {요일}, 맞힘 {c} 틀림 {w} · {M월 D일} {요일}, 안 풀었어요 |
| 보관한 세트 | 보관한 세트 / 더 보기 / {M월 D일} · {N}장 · {방식} / 맞힘 {c} · 틀림 {w} · 건너뜀 {s} / 다시 풀기 |
| 409(다시 풀기) | 풀던 세트를 먼저 끝내 주세요 |
| 곧 열려요 | 곧 열려요 / 오늘의 회화 — 주제와 상황을 골라 선생님과 1:1 수업을 해요. / AI 평가 — 내 단어와 표현으로 지금 실력을 점검해요. |
| 오류 | 오늘의 단어를 불러오지 못했어요. [다시 시도] / 세트를 만들지 못했어요. 다시 시도해 주세요. / 연결하지 못했어요. 네트워크를 확인해 주세요. |

ⓑ **덱**

| 자리 | 문구 |
|---|---|
| 헤더 | 오늘의 단어 / {방식} · {N}장 / 끝내기 / (aria) 오늘로 |
| 진행 | {i} / {N} / 남은 {r}장 · ★ {f} / 지난 카드 보는 중 · |
| 진행 막대(aria) | {N}장 중 {k}장 답함, 맞힘 {c} 틀림 {w} |
| 카드 | 탭하면 뜻이 보여요 / 알았어요·몰랐어요를 누르면 뜻이 보여요(대체 흐름) / (sr) 다시 볼 카드 |
| 결과 띠 | ✓ 맞았어요 / ✗ 틀렸어요 / ✓ 알았어요 / ✗ 몰랐어요 / 건너뛴 카드 |
| 보기 | ✓ 정답 / ✗ 내 답 / 확인 중… / (aria) {i}번, {보기}{, 정답 \| , 내 답 틀림} |
| FLIP 버튼 | 뜻 보기 / 알았어요 / 몰랐어요 / 기록 중… / {알았어요\|몰랐어요\|건너뛴 카드}로 기록했어요 |
| 도구 줄 | 이전 / 읽기 / 표시 · 표시됨 / 건너뛰기 / 다음 카드 / 결과 보기 |
| 제스처 힌트(터치) | ← 밀어 다음 · → 밀어 이전 · ↑ 밀어 표시 |
| 키 힌트(정밀) | 1~4 고르기 · → 다음 · ← 이전 · F 표시 / Space 뒤집기 · 1 알았어요 · 2 몰랐어요 · → 다음 |
| 막힘 안내 | 먼저 답을 골라 주세요 / 알았어요·몰랐어요를 먼저 골라 주세요 / 첫 카드예요 / 이 카드는 읽기가 따로 없어요 |
| 표시 | 다시 볼 카드로 표시했어요 / 표시를 뺐어요 / 표시를 저장하지 못했어요 |
| 저장 실패 | 저장하지 못했어요. 다시 눌러 주세요 |
| 알림 줄 | §5-2 B DeckNotice 표 |
| live(sr) | {n}번째 카드, {surface} / 맞았어요. 정답 {뜻} / 틀렸어요. 정답 {뜻} |
| 끝내기 시트 | 여기서 끝낼까요? / 답하지 않은 {k}장은 건너뛴 것으로 기록돼요. 끝내면 결과가 기록에 남아요. / 모든 카드에 답했어요. 끝내면 결과가 기록에 남아요. / 이 세트를 그만둘까요? / 아직 답한 카드가 없어요. 끝내면 모두 건너뛴 세트로 기록돼요. / 끝내기 / 끝내는 중… / 계속 풀기 |
| 끝내기 실패 | 결과를 저장하지 못했어요. 다시 시도해 주세요. |
| 404 | 세트를 찾을 수 없어요. / 오늘로 |
| 409(끝난 세트) | 이미 끝난 세트예요. 결과를 보여 드릴게요. |

ⓒ **결과**

| 자리 | 문구 |
|---|---|
| 헤더 | 세트 결과 / {M월 D일} · {방식} · {N}장 |
| 요약 | {N}장 중 {c}장 맞혔어요 / {N}장 중 {c}장 알았어요(FLIP) / 맞힘 · 틀림 · 건너뜀 / 걸린 시간 {m}분 {s}초 · 다시 볼 카드 {f}장 / 보관한 세트를 다시 푼 결과예요. |
| 보관 | ☆ 이 세트 보관 / 보관하면 오늘 탭에서 같은 단어로 다시 풀 수 있어요. / ★ 보관한 세트예요 / 다시 풀기 / 보관 풀기 |
| 보관 토스트 | 보관했어요 · 오늘 탭 ‘보관한 세트’에서 다시 풀 수 있어요 / 보관을 풀었어요 / 끝난 세트만 보관할 수 있어요 |
| 목록 | 틀린 단어 {n} / 다시 볼 카드 {n} / 전체 카드 {N}장 보기 / 정답 {뜻} · 내 답 {보기} / 지운 단어 / 맞힘 · 틀림 · 건너뜀 |
| 아래 | 오늘로 / 단어장 보기 |

ⓓ **라벨**

| 값 | 라벨 |
|---|---|
| VocabMode `CHOICE` / `FLIP` | 4지선다 / 뒤집기 카드 |
| VocabAnswer `CORRECT` / `WRONG` / `SKIPPED` | 맞힘 / 틀림 / 건너뜀 (뱃지 good / bad / neutral) |
| 날짜 | 오늘 / 어제 / M월 D일 (KST) |
| 걸린 시간 | {s}초 / {m}분 {s}초 |

### 5-9. 360/390/412 · 제스처 · 접근성 체크리스트

폭·높이
- [ ] 세 폭에서 가로 스크롤 0. 긴 표현(80자)·긴 뜻(200자 보기)·긴 예문(2,000자)을 넣은 세트로 카드 앞/뒤·보기·결과 목록을 확인한다(카드는 자르고, 넘치지 않는다).
- [ ] 412×780(주소창 보임)·390×800(WebView)에서 덱 화면에 스크롤이 없고 도구 줄이 safe-area 위에 보인다. 오늘 홈은 [시작하기]가 780px 안에 있다.
- [ ] 360 에서 도구 줄 4칸이 겹치지 않는다(각 ≥76px). 결과 StatTile 3칸 한 줄.
- [ ] 덱·결과에서 하단 탭이 숨겨지고, 오늘 홈에서는 보인다.

제스처(실기기 Chrome — 헤드리스 불가면 NOT_VERIFIED + 사용자 폰 확인 항목)
- [ ] 탭(10px 미만) = FLIP 뒤집기 / CHOICE 읽기 토글, 위로 80px 넘게 = 표시 토글(카드는 그대로), 왼쪽 60px 넘게 = 답한 뒤에만 다음, 오른쪽 = 이전.
- [ ] 안 답한 카드를 왼쪽으로 밀면 저항(×0.25) 후 튕겨 돌아오고 "먼저 답을 골라 주세요".
- [ ] 카드 탭으로 뒤집은 직후 [알았어요]가 **저절로 눌리지 않는다**(touchend preventDefault).
- [ ] 카드 좌우 바깥 10% 에서 세로로 밀면 페이지가 움직일 수 있다(카드 위에서는 페이지가 움직이지 않는다).
- [ ] 손가락 두 개·`touchcancel`(알림 끌어내리기 등)에서 동작 없이 원위치.
- [ ] `prefers-reduced-motion` 에서 회전·날아가기 없음.

채점·기록
- [ ] 보기를 누르기 전 DOM·네트워크 응답 어디에도 정답이 없다(#47/#49 CHOICE 카드에 `meaning`·`correctText` 없음). 보기 누른 뒤에만 ✓/✗.
- [ ] `responseMs` 가 0~60,000 안에서만 나간다(탭을 1분 넘게 숨겼다 돌아와도).
- [ ] 보기를 빠르게 두 번 눌러도 요청은 한 번(pending 잠금), 네트워크를 끊고 누르면 원상태 + 다시 누를 수 있음.
- [ ] 표시 토글 → 새로고침 → ★ 유지. 중간에 나갔다가 [이어서 풀기] → 답한 카드 다음부터, 지난 카드는 결과가 보인다.
- [ ] 마지막 카드 → [결과 보기] → 결과 화면. 결과 화면 새로고침·보관 세트에서 열기 → 같은 결과.

키보드(데스크톱)
- [ ] 1~4·Space·Enter·←/→·F·↑·R·S 동작, 입력창·시트가 열려 있을 때는 무시, 버튼에 초점이 있을 때 Space 로 두 번 실행되지 않는다.
- [ ] 포커스 링 보임(`focus-visible`), 답 후 초점이 [다음 카드]로 간다.

접근성
- [ ] 스택 `role=group aria-roledescription="카드"`, 카드 바뀜·채점 결과가 live 영역으로 읽힌다(표현은 `lang=ja`).
- [ ] 진행 막대 `role=progressbar` + `aria-valuetext`, 보기 `aria-label` 에 상태 포함, 표시·읽기 `aria-pressed`.
- [ ] 모든 제스처가 버튼으로도 된다(이전·다음·표시·읽기·건너뛰기·뒤집기).
- [ ] 결과 색(✓/✗, 세그먼트, WeekStrip)은 글자·기호와 함께 쓴다. 보기의 "그 외" 상태는 `opacity` 가 아니라 `ink2`.
- [ ] 일본어(표현·읽기·예문) 전부 `lang="ja"`, 표현 ≥22px·예문 16px·읽기 14~17px, 캡션 ≥11px.

엔진명 비노출
- [ ] 오늘 홈·덱·결과의 렌더 텍스트와 토스트에 `claude|haiku|sonnet|opus|qwen|엔진|모델|trace|Phase|task-` 0건.

### 5-10. 주의사항

- **정답 미노출**: 화면은 정답을 계산하지 않는다. 보기 순서·정답 위치를 로컬에 저장하거나 추측하지 않는다. 채점 결과는 #50 응답에서만 온다(E6·완료 기준 3).
- **낙관적 처리 범위**: 표시(★)·읽기 토글만 먼저 그린다(사용자 직접 행위, 실패 시 되돌림). 채점·끝내기·보관·다시 풀기는 응답 뒤에 반영한다.
- **요청 순서**: #50·#51 은 한 줄 큐로 보낸다. finish 를 답 요청보다 먼저 보내면 마지막 답이 SKIPPED 로 굳는다.
- **이탈**: 답은 누를 때마다 저장된다. 떠나는 것을 막지 않는다(뒤로가기 가로채기 금지). 대신 오늘 홈이 이어 풀기를 안내한다.
- **삭제된 단어**: 카드·결과의 `wordId` 가 `null` 일 수 있다(Snap 으로 표시). 링크를 만들지 말고 "지운 단어" 뱃지를 단다.
- **날짜**: "오늘"은 서버가 정한 `session.date` 를 따른다. 화면의 KST 계산은 "오늘/어제" 라벨과 WeekStrip 표시에만 쓴다.
- **빈 상태**: 단어 0 · 오늘 다 풂 · 분류에 없음 · 보관 세트 0(섹션 숨김) · 통계 0(섹션 숨김)을 모두 구현한다.
- **엔진명**: 오류 문구는 §5-8 표만 쓴다. `traceId` 는 렌더·콘솔에 남기지 않는다.
- **저장소 차단**: `kaiwa.vocab.*` 키는 전부 try/catch. 실패하면 기본값(CHOICE·전체·읽기 켬·notice 없음)으로 동작한다.
- **12초 리듬**: 카드마다 타이머·재촉 문구를 보이지 않는다(부담을 주지 않는다). 리듬은 조작 수(카드당 2번)로 맞춘다.

### 5-11. Leader 확인 요청 (§4·§5 공통 — 계약 공백·해석·전역 변경)

| # | 항목 | 화면이 가정한 것 / 요청 | 틀리면 |
|---|---|---|---|
| ① | **FLIP 뒷면 데이터(계약 공백)** | FLIP 은 자기 채점이라 뜻을 숨길 이유가 없다 → **FLIP 세트의 카드에만** #47·#49 에 `meaning`(+`example`·`exampleKo`)을 싣는다. CHOICE 세트에는 계속 없음(완료 기준 3 문구를 "CHOICE 세트"로). 재생(#53)이 삭제 단어로 FLIP 이 된 경우도 같다(Snap 값) | 대체 흐름 "먼저 알았어요/몰랐어요 → 응답으로 뒷면"(§5-2 D). 화면은 두 흐름을 `card.meaning` 유무로 모두 지원 |
| ② | 답 0장인 진행 중 세트 | 끝내면 전부 SKIPPED 인 세트가 StudyLog·VOCAB_SESSION 스냅샷·연속 기록에 남는다 → **답 0장일 때만** `ABANDONED`(기록 없음)로 닫는 경로 허용 여부 | 화면은 #51 로 끝내고 "모두 건너뛴 세트로 기록돼요"라고 알린다(§5-2 F) |
| ③ | #48 정렬·필터 | 기본 정렬 `startedAt desc` 가정. 진행 중 세트를 찾으려고 최근 10개를 읽고 #49 를 한 번 더 부른다 → `status=IN_PROGRESS` 필터 또는 항목에 `answeredCount` 가 있으면 한 번으로 끝난다 | 진행 중 세트가 최근 10개 밖이면 못 찾는다 → [시작하기]의 409 로만 알게 됨 |
| ④ | #49 DONE 세션 필드 | `session` 에 `correctCount·wrongCount·skippedCount·durationSec·keptAt·replayOfId·finishedAt`, 답한 카드에 `exampleKo` 포함 | 재방문 결과에서 개수는 카드로 계산하고 걸린 시간·보관 여부를 모른다(보관 버튼 상태 틀림) |
| ⑤ | #47 빈 풀 사유 | `NO_WORDS` 하나 → 화면이 #46 합계와 선택 분류로 "단어 0 / 오늘 다 풂 / 분류에 없음"을 가른다. 서버가 `ALL_DONE_TODAY`·`CATEGORY_EMPTY` 를 주면 그걸 쓴다(선택) | 가르는 규칙이 서버 풀 규칙(보관·오늘 DONE)과 어긋날 수 있음 |
| ⑥ | #46 개수 의미·분류 없음 | `count` = 보관 제외 개수, `archivedCount` = 보관 개수. `category:null` 필터 방법이 계약에 없어 "분류 없음" 칩은 두지 않는다 | 칩 숫자가 틀린다 / 분류 없는 단어만 따로 볼 수 없다 |
| ⑦ | #53 대상 | 보관한 세트(`keptAt` 있음)만 다시 풀 수 있다고 가정 → 결과 화면 [다시 풀기]는 보관 세트에서만 보임 | 보관 안 한 세트에도 버튼을 둔다 |
| ⑧ | #41 일본어 아닌 입력 | A10 이 `valid:false`+`invalidReason`(prompt-engineer 스키마)을 내므로 #41 은 `{ draft: { valid:false, invalidReason }, saved:false }` 로 돌려준다고 가정. 화면은 400 + 서버 문구도 같은 자리에서 처리한다(§4-2 B) | `valid` 가 응답에서 빠지면 화면이 일본어 아님을 알 수 없어 빈 폼으로 넘어간다 |
| ⑨ | E2 표시 전용 응답 | `{order, flagged}` 만 돌려주고 미답 카드의 정답 필드는 없다 | 정답 누출(완료 기준 3 위반) |
| ⑩ | 전역·공용 변경 | TabBar `HIDDEN_PREFIXES` 에 `/study/today/words/` 추가 · vocab 이 `@/components/chat/{format,errors,storage}` 를 import(공용 폴더로 옮기는 정리는 별도) · 오늘 앱바 제목 "오늘" → "오늘의 공부" | 탭을 유지하면 덱 높이 예산(≈640px)이 66px 줄어 412×780 에서 스크롤이 생긴다 |
