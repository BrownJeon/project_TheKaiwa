# TheKaiwa 화면 설계 (screens.md)

> 소유: designer · 구현: developer · 감사: reviewer/qa
> 이 문서는 **화면 구현 가이드의 단일 출처**다. API 요청/응답은 `docs/design/api-contract.md` 를 인용만 하고 다시 정의하지 않는다(#번호로 표기).
> 새 화면이 생기면 §2 목록에 한 줄 추가하고, 화면별 절(§3~)을 덧붙인다.
>
> 변경 이력: 2026-09-27 신규 — §1 토큰·§2 목록·§3 AI 채팅(task-006) · 2026-09-27 §4 단어장·§5 오늘의 단어 추가, §2 오늘·서랍장 행 갱신(task-008) · 2026-09-27 §6 Admin Console Phase 1 추가, §2 설정·콘솔 행 갱신(task-005b) · 2026-09-27 §7 음성(TTS) 상태 표시등·미리듣기 추가, §2 설정·음성 회화방 행 갱신(task-003d) · 2026-09-28 §8 음성 인식 마이크 테스트 추가, §2 설정·음성 회화방 행 갱신(task-003e) · 2026-09-28 §9 AI 회화(음성) 회화방 추가, §2 회화 행·§3 "회화 준비 중" 문구·§7-3 A 폴링 멈춤 범위·§8-2 C 재생 중 버튼 메모(→ barge-in) 갱신(task-007) · 2026-09-28 §10 관리자 콘솔 — 발음 사전(목록·항목 시트·적용 전/후 미리듣기·가져오기/내보내기·버전 기록·되돌리기) 추가, §2 콘솔 행·§6 머리말·§6-1 메뉴 행·§6-2 E·§6-10 발음 사전 문구 갱신(task-003g)

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
| 회화 | `/study/ai?tab=talk\|chat` (기본 `talk`) | AI와 공부하기 홈(회화·채팅 전환 · 회화 목록/채팅 목록 · 채택 대기 교정 요약) | 로그인 사용자 | 보임 | **task-006(§3)** · 회화 탭 **task-007(§9-2 A)** |
| 회화 | `/study/ai/chat/[chatId]` | 채팅방 | 소유자(타인 404) | **숨김** | **task-006(§3)** |
| 회화 | `/study/ai/chat/[chatId]/review` | 표현 점검 결과 | 소유자 | **숨김** | **task-006(§3)** |
| 회화 | `/study/ai/talk/[chatId]` (`#cr_{교정 id}` 로 카드 위치) | 음성 회화방(머리 = 선생님 아바타·이름 + TTS 상태 표시등(§7) · 푸시투토크 72px(§8) + 글자 입력 전환 · 문장별 점진 표시·재생·barge-in · 교정 카드 즉시) | 소유자(타인 404) | **숨김** | **task-007(§9)** |
| 오늘 | `/study/today` | 오늘의 공부 홈(오늘의 단어 카드·최근 기록·보관한 세트, 회화·평가 "곧 열려요") | 로그인 | 보임 | **task-008(§5)** |
| 오늘 | `/study/today/words/[sessionId]` | 단어 카드 덱 · 세트 결과(같은 경로, 세트 상태로 분기) | 소유자(타인 404) | **숨김** | **task-008(§5)** |
| 오늘 | `/study/today/talk/[lessonId]`, `eval/[evaluationId]` | 오늘의 회화 · AI 평가 | 소유자 | 숨김 | Phase 2 |
| 계획표 | `/plan` | 달력·분석·성장 | 로그인 | 보임 | Phase 2~3 |
| 서랍장 | `/drawer/words` (`?word=<id>` 상세 시트 · `?add=1` 추가 시트) | 단어장 | 로그인(자기 단어만) | 보임 | **task-008(§4)** |
| 서랍장 | `/drawer/corrections` | 채택 교정 모음 | 로그인 | 보임 | Phase 3 |
| 질문 | `/ask` | 무엇이든 물어보세요 | 로그인 | 보임 | Phase 3 |
| 상단 아바타 | `/settings` | 설정 허브 · 맨 아래 "관리자 › AI Engine Console" 행 | 로그인(관리자 행은 `engine.read` 보유자만 — 서버 컴포넌트) | 보임 | task-005 ✅ · 관리자 행 **task-005b(§6-2 K)** · 목소리 카드 머리 **상태 표시등·미리듣기 재생 task-003d(§7)** · 음성 인식 절 **마이크 테스트 task-003e(§8)** |
| 콘솔 | `/admin` → `/admin/dashboard` | 대시보드(역할별 엔진·연결·모델·상태, 30초 갱신) | `console.access` 없으면 **앱 공통 404** | **별도 셸**(환경 띠·콘솔 바, 탭 없음) | **task-005b(§6)** |
| 콘솔 | `/admin/speech/{realtime,analysis,tts}` · `/admin/llm` | 역할 페이지(지금 쓰는 연결·Health/기능 테스트·예비 순서·설정값 요약) | `engine.read` | 별도 셸 | **task-005b(§6)** |
| 콘솔 | `/admin/voices` | 목소리 목록(읽기) | `voices.read` | 별도 셸 | **task-005b(§6)** |
| 콘솔 | `/admin/connections` · `/admin/connections/[id]` | 연결 목록·상세(Health/기능 테스트·최근 결과·시크릿 참조 시트) | `engine.read`(시크릿 시트 `secrets.read_ref`) | 별도 셸 | **task-005b(§6)** |
| 콘솔 | `/admin/plugins` · `/admin/plugins/[id]` | 플러그인 로드 상태·스키마 | `plugins.read`(DEVELOPER+, 없으면 콘솔 403) | 별도 셸 | **task-005b(§6)** |
| 콘솔 | `/admin/configuration` | 설정값 Effective(키·값·Source 배지) — Effective 탭만 | `config.effective.read` | 별도 셸 | **task-005b(§6)** |
| 콘솔 | `/admin/diagnostics` (`?tab=health\|traces`) · `/admin/diagnostics/traces/[traceId]` | Health 기록 · 요청 Trace 목록/상세 | `engine.read` / Trace 는 `trace.read` | 별도 셸 | **task-005b(§6)** |
| 콘솔 | `/admin/speech/tts/lexicon` (`?q=&scope=&ref=&inactive=1&page=`) · `/admin/speech/tts/lexicon/versions` (`?v=` 버전 상세 시트) | 발음 사전(검색·범위 필터·항목 추가/수정/끄기/다시 켜기 시트·적용 전/후 미리듣기·가져오기 dryRun→적용·내보내기) · 버전 기록(상세 diff·되돌리기) — 메뉴 "엔진 › 발음 사전" · TTS 역할 페이지 링크 카드 | `voices.read`(보기·내보내기·버전 보기) / `voices.manage`(쓰기·미리듣기) · PRODUCTION 쓰기 = SUPER_ADMIN + 확인 문구 | 별도 셸 | **task-003g(§10)** |
| 콘솔 | `/admin/{prompts,playground,history}` 등 | 편집·버전·Playground·이력 | — | 메뉴 없음 | Phase 2+ |

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
| 진입 | 하단 탭 "회화" → `/study/ai`(기본 `tab=talk` — task-007 부터, §9-2 A) → [채팅] 탭 |
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
  tab === 'talk' → 회화 탭(§9-2 A — ＋ 새 회화 · 교정 요약 · 회화 목록). task-006 의 `TalkComingSoon`("음성 회화는 곧 열려요")은 task-007 에서 삭제
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
- 행의 링크 대상: `chat.kind === 'CHAT'` → `…/chat/{id}/review#cr_{crId}`, `TALK` → `/study/ai/talk/{id}#cr_{crId}`(보조 줄 "{제목} · 회화에서 보기 ›", §9-2 A). 카드는 회화·채팅 두 탭 모두에 보인다.

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
| ~~`TalkComingSoon`~~ | — | task-007 에서 삭제(회화 탭은 §9-2 A) | — |
| `ChatList` | client | `{ kind: 'CHAT'\|'TALK' }` — kind 별 섹션 제목·빈 상태·행 링크(§9-2 A) | `items, nextCursor, loading, loadingMore, error` |
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
| ~~회화 준비 중~~ | task-007 에서 삭제 — 회화 탭 문구는 §9-8 ⓕ |
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

---

## 6. Admin Console — Phase 1 (task-005b)

> 정본: IA `docs/design/admin-console/01`(메뉴·진입·레이아웃·404/403) · 권한 `docs/design/role-permission.md` §3·§4 · API `docs/design/api-contract.md`(§6-4 의 #번호) · Source `configuration-resolution.md` §2·`admin-console/04`·`05` · Trace `admin-console/13` · 환경 `admin-console/16` · Health/기능 테스트 `speech-platform/09`·`10`·`14`.
> 이 절은 **Phase 1 화면만** 다룬다. 편집·Version·Rollback·Prompts·Playground·History 는 없다 — 메뉴에도 그리지 않는다. 발음 사전(G1 이월)은 task-003g 에서 **§10** 으로 추가됐다(메뉴 1행·TTS 역할 페이지 링크, 쓰기·버전·되돌리기는 사전 자체 버전 규칙).

### 6-0. 한눈에 보는 결정

1. **별도 셸** `src/app/(admin)/layout.tsx`. 학습 앱 하단 탭이 없다. 위에서부터 **환경 띠(32px, 숨길 수 없음)** → **콘솔 바(52px: ☰ · 제목 · ↩ 앱으로)** → 본문. 세로 스크롤은 `main` 한 곳. ≥1024px 는 왼쪽 사이드바(232px) + 본문(최대 960px).
2. **메뉴**: 모바일은 ☰ → 공용 `Sheet`(아래에서 올라오는 메뉴), 데스크톱은 사이드바. 둘 다 서버가 capability·Phase 로 거른 같은 목록(`menu.ts`)을 쓴다. 권한 없는 메뉴·버튼은 **렌더하지 않는다**(비활성·툴팁 아님).
3. **환경 띠**: `PRODUCTION` = 빨간 띠(`bg-bad text-surface`) + "운영 환경 — 변경은 확인 절차를 거칩니다". `LOCAL` = 회색 띠. 앱 버전은 오른쪽 끝.
4. **404 / 403**: `console.access` 가 없으면(USER) 앱의 **아무 없는 주소와 똑같은** 404 다(콘솔 전용 not-found 를 만들지 않는다). 콘솔 사용자인데 화면 capability 가 부족하면 콘솔 안 **403 카드**(메뉴·띠 유지, 필요한 권한 이름 표시). 콘솔 안에서 id 가 없으면 콘솔 안 "찾을 수 없어요" 카드.
5. **표 대신 카드**: 목록은 카드·행 목록, 키·값은 `dl`(카드 폭 <420px 이면 위아래로). 가로 스크롤 0. 긴 키·URL·ref 는 모노 글꼴 + `[overflow-wrap:anywhere]`.
6. **Health·기능 테스트 = 한 패널**(`EngineTestPanel`): [상태 확인] [기능 테스트] → 진행(경과 초) → 결과 카드(상태·사유·지연·traceId). **서비스가 꺼져 있는 것은 오류가 아니다** — 결과 카드는 회색 바탕 + "응답 없음" 뱃지 + 사유 + "서비스가 꺼져 있으면 정상적인 결과예요". 빨간 ErrorBlock 은 HTTP 실패(500·네트워크)에만 쓴다.
7. **429**: 버튼 자리에서 카운트다운("{n}초 뒤 다시"). LLM 기능 테스트는 끝난 직후 30초를 화면이 먼저 잠근다(G4 와 같은 값 — 헛 429 방지).
8. **Source 배지** = 층 번호 + 이름(`4 ENVIRONMENT`). 강조는 둘만 — `ENVIRONMENT`(굵은 윤곽: "env 가 덮었다"), `RUNTIME_OVERRIDE`(빨강 바탕). 나머지는 회색. DEVELOPER 이상은 행을 펼쳐 층별 값·`sourceRef` 를 본다(서버가 `layers` 를 줄 때만 펼침 표시).
9. **엔진명은 보여 주고, 비밀·서버 경로는 안 보여 준다**(G6): 엔진·모델·baseUrl·connection key 는 표시. `credentialRef` 는 이름만(🔒). 값이 의심되는 키는 `•••`, `/` 로 시작하는 경로 값은 "서버 경로 · 표시하지 않음". 시크릿 **존재 여부는 [시크릿 참조] 시트를 열 때만** 조회한다(조회마다 감사 로그 1행 — 페이지 진입만으로는 부르지 않는다).
10. **갱신**: 대시보드만 30초 폴링(보이는 동안만, G5). 나머지는 진입·[다시 불러오기]·테스트 직후에만 읽는다.
11. **`/settings` 진입**: 맨 아래 "관리자" 섹션에 한 줄 "AI Engine Console ›"(`engine.read` 보유자만). 서버 컴포넌트라 USER 의 DOM·번들에 문자열이 없다. 역할 상태 요약 행(speech-platform 14 §7 미결 1)은 두지 않는다.

### 6-1. 화면 개요 · 메뉴

| 항목 | 내용 |
|---|---|
| 목적 | 관리자·개발자가 역할(실시간 인식·분석 인식·음성 합성·LLM)별로 **지금 어떤 엔진·연결·모델이 어떤 상태로 쓰이는지** 보고, Health·기능 테스트를 직접 돌리고, 설정값이 **어느 층에서 왔는지**(Source)와 요청 Trace 를 확인한다. Phase 1 은 **읽기 + 테스트 실행**만(쓰기 0, G2) |
| 진입 | `/settings` 맨 아래 "관리자 › AI Engine Console" → `/admin/dashboard`. `/admin` 은 `/admin/dashboard` 로 redirect. 딥링크 없음 |
| 역할별 가시성 | USER: `/admin/**` 전부 404, `/settings` 관리자 행 없음 · ADMIN: 메뉴 9개(Plugins 없음), Diagnostics 는 Health 기록만, Effective 는 값+Source 이름만 · DEVELOPER·SUPER_ADMIN: 메뉴 10개 + Trace 탭 + Effective 층 펼치기 |
| 앱/웹 분기 | 없음. 앱 WebView(≈390px)에서도 같은 화면. ONDEVICE 연결의 기기 테스트 버튼은 음성 Phase 4(이번엔 안내 문구만) |
| 하단 탭 | 없음(별도 셸). 돌아가기는 콘솔 바 [↩ 앱으로] = `/settings` |
| 음성 | 기능 테스트 결과에 `detail.audioUrl` 이 있을 때만 `<audio controls>`(TTS — task-003 뒤에 실제로 생김) |

**메뉴 상수 값** — `src/modules/admin/console/menu.ts`(developer A 소유). 화면은 layout 이 걸러 준 목록을 props 로만 받는다(클라이언트가 `@/modules/admin` 을 import 하지 않는다).

| 순서 | group | path | label(바 제목) | sub(메뉴 설명) | capability | 비고 |
|---|---|---|---|---|---|---|
| 1 | 개요 | `/admin/dashboard` | Dashboard | 역할별 엔진·상태 한눈에 | `engine.read` | |
| 2 | 엔진 | `/admin/speech/realtime` | Realtime STT | 실시간 음성 인식 | `engine.read` | |
| 3 | 엔진 | `/admin/speech/analysis` | Analysis STT | 분석용 음성 인식 | `engine.read` | |
| 4 | 엔진 | `/admin/speech/tts` | TTS | 선생님 목소리 합성 | `engine.read` | |
| 4a | 엔진 | `/admin/speech/tts/lexicon` | 발음 사전 | 읽기·악센트 고치기·버전 | `voices.read` | **task-003g(§10)** — id `speech-tts-lexicon`, 구현 라벨(한국어) 기준 |
| 5 | 엔진 | `/admin/llm` | LLM | 대답·교정·레슨 생성 | `engine.read` | |
| 6 | 자원 | `/admin/voices` | Voices | 목소리 목록 | `voices.read` | §6-11 ③ |
| 7 | 자원 | `/admin/connections` | Connections | 연결·Health·기능 테스트 | `engine.read` | |
| 8 | 자원 | `/admin/plugins` | Plugins | 엔진 플러그인 로드 상태 | `plugins.read` | DEVELOPER+ |
| 9 | 설정·진단 | `/admin/configuration` | Configuration | 실제 적용값과 출처 | `config.effective.read` | Effective 탭만 |
| 10 | 설정·진단 | `/admin/diagnostics` | Diagnostics | Health 기록·요청 Trace | `engine.read` | Trace 탭 `trace.read` |

- 바 제목은 `pathname` 을 메뉴 `path` 의 **가장 긴 접두사**로 찾는다(`/admin/connections/abc` → "Connections"). 상세 화면의 항목 이름은 본문 `h2` 로 쓴다(`h1` 은 바 제목 하나).
- Phase 2+ 메뉴(Prompts·Playground·History·Voices › Versions·TTS Quality)는 상수에 두더라도 `phase > 1` 이면 거른다. Pronunciation Dictionary 는 task-003g 에서 `phase: 1` 로 열렸다(4a 행, §10-1).

### 6-2. UI 구조 (의사코드, 390px 기준)

#### A. 셸 — `src/app/(admin)/layout.tsx`(서버) + `ConsoleShell`(클라이언트)

```tsx
// src/app/(admin)/layout.tsx — export const dynamic = 'force-dynamic'
const access = await getConsoleAccess()      // @/modules/admin(developer A): 세션 → User(DB) → role·capabilities(console.access 파생 포함)
                                             //   + environment{environment, appVersion, services}(#81 과 같은 값) + menu(§6-1, capability·phase 로 거름)
if (!access) redirect('/login?callbackUrl=/admin/dashboard')     // 미인증(proxy 가 먼저 막지만 이중)
if (!access.capabilities.includes('console.access')) notFound()  // USER → 앱 공통 404. 이보다 먼저 콘솔 데이터를 읽지 않는다
return <ConsoleShell access={toClientAccess(access)}>{children}</ConsoleShell>
```

```tsx
// ConsoleShell (client) — ConsoleProvider 로 {role, capabilities, environment} 를 내려 준다(useCan)
<ConsoleProvider value={…}>
  <div data-app-shell className="grid h-[100dvh] grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden bg-surface"
       style={{ paddingTop: 'env(safe-area-inset-top)' }}>
    <NativeFlag />                                        ← @/components/shell/NativeFlag 재사용(앱 상태바 최소 24px 규칙). null 을 렌더
    <EnvStrip environment appVersion />                   ← 32px. main 밖이라 늘 보인다
    <ConsoleBar menu onOpenMenu />                        ← 52px
    <div className="grid min-h-0 min-w-0 lg:grid-cols-[232px_minmax(0,1fr)]">
      <ConsoleSidebar menu className="hidden lg:flex" />  ← ≥1024 만. 자체 overflow-y-auto(데스크톱 예외)
      <main className="min-h-0 min-w-0 overflow-y-auto bg-ground">
        <div className="mx-auto w-full max-w-[960px] px-4 pt-3 lg:px-6"
             style={{ paddingBottom: 'max(40px, calc(16px + env(safe-area-inset-bottom)))' }}>
          {children}
        </div>
      </main>
    </div>
    <ConsoleMenuSheet open menu onClose />                ← 공용 Sheet(제목 "콘솔 메뉴") — body 포털
  </div>
</ConsoleProvider>
```
- `data-app-shell` + `main` 구조를 그대로 두는 이유: 공용 `Sheet` 가 `[data-app-shell] main` 의 스크롤을 잠그고, `globals.css` 의 앱 상태바 안전장치(`[data-native] [data-app-shell]`)가 그대로 걸린다.

와이어프레임(390px, PRODUCTION):
```
┌──────────────────────────────────────┐
│▌PRODUCTION▐ 운영 환경 — 변경은 확…  v0.4.2│ EnvStrip 32px  bg-bad text-surface
├──────────────────────────────────────┤
│ ☰  AI Engine Console · 자원      ↩ 앱으로│ ConsoleBar 52px
│    Connections                          │   12px ink2 / 17px semibold
├──────────────────────────────────────┤
│ (main — 이 화면의 유일한 세로 스크롤)       │
└──────────────────────────────────────┘
```

데스크톱(≥1024):
```
┌ EnvStrip ──────────────────────────────────────────────────────────────┐
├ ConsoleBar (☰ 숨김) ────────────────────────────────────────────────────┤
│ 사이드바 232px             │ main (가운데, 최대 960px, 카드 2열)              │
│ 개요                       │                                              │
│  ▌Dashboard               │                                              │
│ 엔진                       │                                              │
│  Realtime STT …           │                                              │
│ ────────                  │                                              │
│ ↩ 학습 앱으로 돌아가기        │                                              │
│ 내 역할 DEVELOPER          │                                              │
└───────────────────────────┴──────────────────────────────────────────────┘
```

**EnvStrip**
```
<div role="note" aria-label="환경: {ENV_KO[env]}({env}). {ENV_MESSAGE[env]}"
     className="flex min-h-8 min-w-0 items-center gap-2 px-4 text-[12px] {STRIP[env]}">
  <span className="flex-none rounded px-1.5 py-px font-mono text-[11.5px] font-bold tracking-wide {PILL[env]}">{env}</span>
  <span className="min-w-0 flex-1 truncate">{ENV_MESSAGE[env]}</span>
  {appVersion && <span className="flex-none tabular-nums">v{appVersion}</span>}
</div>
```

| env | 띠(STRIP) | 알약(PILL) | 문구 |
|---|---|---|---|
| `PRODUCTION` | `bg-bad text-surface`(라이트·다크 ≈6.6:1) | `bg-surface text-bad` | 운영 환경 — 변경은 확인 절차를 거칩니다 |
| `LOCAL` | `bg-surface2 text-ink2` | `border border-ink2 text-ink` | 개발 환경 — 운영과 분리된 설정 행을 봐요 |
| `DEVELOPMENT`·`STAGING` | `bg-surface2 text-ink` | `border border-ink text-ink` | {env} 환경 |

- 01 §5 의 "슬롯 = 파랑"은 토큰이 없어 회색 윤곽으로 대신한다(슬롯은 지금 쓰지 않음, §6-11 ⑬). 01 §5 의 Override 켜짐·개수는 Override 가 Phase 4 라 이번엔 띠에 넣지 않는다(§6-11 ④).
- 360px 에서 문구가 길면 말줄임한다. 전체 문구는 `aria-label` 과 메뉴 시트 머리에 한 번 더 보인다.

**ConsoleBar**
```
<header className="flex h-[52px] min-w-0 items-center gap-1 border-b border-line bg-surface pl-1 pr-1 lg:pl-4">
  <button type="button" aria-label="콘솔 메뉴 열기" aria-haspopup="dialog"
          className="grid h-11 w-11 flex-none place-items-center rounded-full lg:hidden">☰(svg)</button>
  <div className="min-w-0 flex-1">
    <p className="truncate text-[12px] leading-tight text-ink2">AI Engine Console · {group}</p>
    <h1 className="truncate text-[17px] font-semibold leading-tight">{label}</h1>
  </div>
  <Link href="/settings" aria-label="학습 앱으로 돌아가기"
        className="flex h-11 flex-none items-center gap-1 rounded-xl px-3 text-[13px] font-medium text-ink2">↩ 앱으로</Link>
</header>
```

**ConsoleNavList**(메뉴 시트·사이드바 공용)
```
<nav aria-label="콘솔 메뉴">
  (시트에서만) <p className="mb-2 rounded-xl bg-surface2 px-3 py-2 text-[12px] text-ink2">{env} · {ENV_MESSAGE}</p>
  for group:
    <p className="mt-3 px-3 text-[12px] font-medium text-ink2">{group}</p>
    <Link href={path} aria-current={active ? 'page' : undefined} onClick={onNavigate}
          className="flex min-h-[52px] min-w-0 flex-col justify-center rounded-xl px-3 {active ? 'bg-accent-soft ring-1 ring-accent font-semibold' : ''}">
      <span className="truncate text-[15px] text-ink">{label}</span>
      <span className="truncate text-[12px] font-normal text-ink2">{sub}</span>
    </Link>
  <hr className="my-3 border-line" />
  <Link href="/settings" className="flex min-h-[52px] items-center rounded-xl px-3 text-[15px] text-ink">↩ 학습 앱으로 돌아가기</Link>
  <p className="px-3 pb-2 text-[12px] text-ink2">내 역할 {role}</p>
</nav>
```
- 활성 판정은 바 제목과 같은 "가장 긴 접두사". 링크를 누르면 시트를 닫는다(pathname 변경 effect 로도 닫는다).

#### B. 가드 · 403 · 콘솔 안 404

`layout` 은 클라이언트 이동 때 다시 실행되지 않는다. 그래서 **모든 `page.tsx`(서버)가 첫 줄에서 화면 capability 를 다시 검사**한다.

```tsx
// 예: src/app/(admin)/admin/plugins/page.tsx
const g = await requireConsolePage('plugins.read')     // @/modules/admin: console.access 가 없으면 안에서 notFound()
if (!g.ok) return <ConsoleForbidden missing={g.missing} role={g.role} />
return <PluginsScreen />
```

| 화면 | 페이지 capability |
|---|---|
| dashboard · speech/* · llm · connections(+[id]) · diagnostics | `engine.read` |
| voices | `voices.read` |
| plugins(+[id]) | `plugins.read` |
| configuration | `config.effective.read` |
| diagnostics/traces/[traceId] | `trace.read` |

**ConsoleForbidden**(콘솔 안 403 — 메뉴·환경 띠는 그대로)
```
<Card className="mt-6 text-center">
  자물쇠 아이콘 40px text-ink2 (aria-hidden)
  <h2 className="mt-2 text-[17px] font-semibold">이 화면을 볼 권한이 없어요</h2>
  <p className="mt-1 text-[14px] text-ink2 [overflow-wrap:anywhere]">필요한 권한 <code className="font-mono text-ink">{missing.join(', ')}</code> · 내 역할 {role}</p>
  <p className="mt-1 text-[13px] text-ink2">역할은 소유자(SUPER_ADMIN)가 바꿀 수 있어요.</p>
  <Link href="/admin/dashboard" className="(Btn ghost 모양) mt-4 w-full">대시보드로</Link>
</Card>
```
- 같은 카드를 클라이언트가 API **403** 을 받았을 때도 쓴다(`details.missing` → 없으면 `[details.requiredCapability]`, §6-11 ①).

**ConsoleNotFound**(콘솔 사용자 + 없는 id — `/admin/connections/zzz`·`/admin/plugins/zzz`·`/admin/diagnostics/traces/zzz`)
```
<Card className="mt-6 text-center">
  <h2 className="text-[17px] font-semibold">찾을 수 없어요</h2>
  <p className="mt-1 text-[14px] text-ink2">지웠거나 다른 환경의 항목일 수 있어요. 지금 환경은 {env} 이에요.</p>
  <Link href={backHref} className="(Btn ghost) mt-4 w-full">{backLabel}</Link>
</Card>
```
- `notFound()` 를 쓰지 않는다 — 화면이 API 404 를 받아 이 카드를 그린다(콘솔 전용 not-found 경계를 만들지 않기 위해, §6-0 ④).

#### C. 공용 조각 (`src/components/admin/console/*`)

**StatusBadge** — `EngineStatus` 와 테스트 결과를 한 뱃지로. 점은 장식(`aria-hidden`), 뜻은 글자가 진다.

| 값 | 클래스 | 글자 |
|---|---|---|
| `HEALTHY` | `bg-good-soft text-good` + 점 `bg-good` | 정상 |
| `DEGRADED` | `bg-warn-soft text-ink` + 점 `bg-warn` | 저하 |
| `UNAVAILABLE` | `bg-bad-soft text-bad` + 점 `bg-bad` | 응답 없음 |
| `MISCONFIGURED` | `border border-bad bg-surface text-bad` | 설정 오류 |
| `DISABLED` | `bg-surface2 text-ink2` | 꺼짐 |
| `UNKNOWN` | `border border-dashed border-ink2 bg-surface text-ink2` | 미확인 |
| 결과 `PASSED`(기능 테스트 ok) | `bg-good-soft text-good` | 통과 |
| 결과 `FAILED`(기능 테스트 실패, 서비스는 응답함) | `bg-bad-soft text-bad` | 실패 |
| 결과 `TIMEOUT` | `bg-bad-soft text-bad` | 시간 초과 |
| 결과 `SKIPPED` | `bg-surface2 text-ink2` | 건너뜀 |

```
<span aria-label="상태: {글자}({값})" className="inline-flex h-[22px] flex-none items-center gap-1 rounded-md px-2 text-[11.5px] font-semibold {tone}">
  {dot && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full {dotTone}" />}{글자}
</span>
```
- `warn` 글자·`accent` 뱃지 글자·`ink3` 글자는 쓰지 않는다(§1-1). 14 §3.5 의 "MISCONFIGURED = 보라"는 토큰이 없어 **빨강 윤곽**으로 대신한다(보라는 금지 미학이기도 하다).

**SourceBadge** — `{층 번호} {ConfigSource}`
```
<span aria-label="출처 {n}층 {SOURCE}, {SOURCE_KO}" className="inline-flex h-[22px] max-w-full min-w-0 items-center gap-1 rounded-md px-1.5 font-mono text-[11px] {tone}">
  <span className="tabular-nums">{n}</span><span className="truncate">{SOURCE}</span>
</span>
```

| Source | 층 | 톤 |
|---|---|---|
| `DEFAULT` · `SOURCE_CODE` · `APPLICATION_CONFIG` · `DATABASE` · `CONNECTION_PROFILE` · `USER_SETTING` | 1·2·3·5·6·7 | `bg-surface2 text-ink2` |
| `ENVIRONMENT` | 4 | `border border-ink bg-surface font-semibold text-ink` |
| `RUNTIME_OVERRIDE` | 8 | `bg-bad-soft text-bad` |

**EditabilityText** — 뱃지가 아니라 12px `text-ink2` 글자: 읽기 전용 · 즉시 반영 · 재시작 필요 · 재배포 필요 · 시크릿(참조만). `restartRequired:true` 면 "재시작 필요".

**KeyValueList**
```
<dl className="@container grid min-w-0 gap-y-2">
  each → <div className="grid min-w-0 gap-0.5 @min-[420px]:grid-cols-[minmax(0,9rem)_minmax(0,1fr)] @min-[420px]:gap-3">
    <dt className="min-w-0 text-[12.5px] text-ink2 [overflow-wrap:anywhere] {mono ? 'font-mono' : ''}">{label ?? key}</dt>
    <dd className="min-w-0 text-[14px] text-ink [overflow-wrap:anywhere] {mono ? 'font-mono text-[13px]' : ''}">{displayValue(key, value)}</dd>
  </div>
</dl>
```
**`displayValue(key, value)`**(`console/format.ts`, 순수 — 단위 테스트 대상)
1. `null`·`undefined` → "없음"(ink2)
2. boolean → "예" / "아니요"
3. 배열 → `, ` 로 잇기(요소가 객체면 JSON 한 줄)
4. 객체 → `JSON.stringify` 한 줄(모노, 줄바꿈 허용)
5. 문자열이 `/` 로 시작하고 (키가 `/(path|dir|file)$/i` 로 끝나거나 스키마 타입이 `PATH`) → **"서버 경로 · 표시하지 않음"**
6. 키가 `/(token|secret|password|passwd|api[-_]?key)/i` 에 맞고 `credentialRef` 가 아니면 → "•••(숨김)"
7. 값이 `"***"` → "•••(숨김)"
8. 나머지는 그대로.
- 5·6 은 **방어선**일 뿐이다 — 서버 응답에 애초에 없어야 한다(§6-11 ⑦).

**MonoId + CopyButton** — `traceId`·connection key·ref 이름: `font-mono text-[13px] [overflow-wrap:anywhere]` + 44×44 복사 버튼(`aria-label="{이름} 복사"`, `navigator.clipboard.writeText` try/catch → 토스트 "복사했어요" / "복사하지 못했어요"). 링크 안(카드 전체가 링크)에서는 복사 버튼을 두지 않는다.

**RefreshLine**
```
<div className="flex min-w-0 items-center gap-2 text-[12px] text-ink2">
  <span className="min-w-0 flex-1 truncate">마지막 갱신 {HH:mm:ss}{polling && ' · 30초마다 새로 고침'}</span>
  <button type="button" aria-busy={reloading} className="h-11 flex-none px-2 text-[13px] font-medium text-ink">{reloading ? '불러오는 중…' : '다시 불러오기'}</button>
</div>
```

**ChipRadio** — 가로 칩 줄(대상 연결·필터). §4 `CategoryChips` 와 같은 규칙: `no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4`, 칩 `relative h-9 min-w-[44px] flex-none rounded-full border px-3 text-[13px]` + 세로만 `before:` 히트 44px, `role="radio" aria-checked`, 선택 `bg-accent text-on-accent border-accent`, 나머지 `bg-surface text-ink border-line`, 선택 칩이 화면 밖이면 `scrollIntoView({inline:'nearest', block:'nearest'})`. admin 은 `(app)` 컴포넌트를 import 하지 않으므로 admin 안에 따로 둔다.

**ConsoleLoading** — 첫 로드 자리. `<p role="status" className="py-8 text-center text-[13px] text-ink2">불러오는 중…</p>`(공용 `LoadingBlock` 은 `ink3` 글자라 쓰지 않는다, §1-1).

**ToggleButton** — `aria-pressed` 알약(§4 ArchiveToggle 과 같은 모양·히트영역). Voices 의 "보관 포함"에 쓴다.

**EngineTestPanel**(역할 페이지·연결 상세 공용)
```
props: { connection: { id, key, role, connectionType, enabled }, onDone(result | null) }
if (!can('health.run') && !can('functional_test.run')) return null

<Card>
  {!connection.enabled
    ? <p className="text-[13px] text-ink2">꺼져 있는 연결이에요 — 켜기는 다음 단계(편집)에서 할 수 있어요.</p>
    : <div className="flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
        {can('health.run') && <Btn variant="ghost" onClick={() => start('HEALTH')} disabled={busy || cooling('HEALTH')} aria-busy={run?.kind === 'HEALTH'}>
            {run?.kind === 'HEALTH' ? '확인 중…' : cooling('HEALTH') ? `${n}초 뒤 다시` : '상태 확인'}</Btn>}
        {can('functional_test.run') && connection.connectionType !== 'ONDEVICE' &&
          <Btn variant="ghost" …>{run?.kind === 'FUNCTIONAL' ? '테스트 중…' : cooling('FUNCTIONAL') ? `${n}초 뒤 다시` : '기능 테스트'}</Btn>}
      </div>}
  <p className="mt-2 text-[12px] text-ink2 break-keep">{PANEL_HELP[connectionType][role]}</p>   ← §6-8 ⓑ
  <div aria-live="polite" className="min-w-0">
    {run    && <p role="status" className="mt-3 text-[13px] text-ink2">{KIND_KO[run.kind]} 중… {elapsed}초</p>}
    {notice && <p className="mt-3 text-[13px] text-ink break-keep">{notice}</p>}              ← 409·429·403·404 안내(카드 아님)
    {error  && <div className="mt-3"><ErrorBlock message={error} /></div>}                     ← 500·네트워크만
    {result && <TestResultCard kind={result.kind} result={result.body} receivedAt={result.receivedAt} />}
  </div>
</Card>
```
- 같은 연결에서는 한 번에 하나만 돌린다(`busy` 동안 두 버튼 다 잠금). 결과가 오면 `onDone` → 부모가 연결(#91a)·기록(#95a)을 다시 읽는다.
- ONDEVICE 연결은 [기능 테스트] 버튼이 없다(서버가 NOT_APPLICABLE 을 돌려줄 뿐이라 헛 요청). 도움말 줄이 이유를 말한다.
- 버튼은 둘 다 `ghost`. 주 버튼(accent)으로 만들지 않는다 — LLM 기능 테스트는 비용이 드는 호출이다.

**TestResultCard**
```
<div role="group" aria-label="{KIND_KO[kind]} 결과" className="mt-3 min-w-0 rounded-xl border border-line bg-surface2 p-3">
  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
    <StatusBadge value={view.badge} /> <span className="text-[13px] font-semibold">{KIND_KO[kind]}</span>
    <span className="ml-auto text-[12px] tabular-nums text-ink2">{formatMs(latencyMs)} · {formatAgo(checkedAt ?? receivedAt)}</span>
  </div>
  {view.reason && <p className="mt-1.5 text-[14px] text-ink break-keep">{view.reason}</p>}
  {view.hint && <p className="mt-1 text-[12.5px] text-ink2 break-keep">{view.hint}</p>}
  {detail.message && <p className="mt-1 font-mono text-[12px] text-ink2 [overflow-wrap:anywhere]">{detail.message}</p>}   ← 서버가 ≤200자로 자른 값
  {view.chips.length > 0 && <ul className="mt-2 flex flex-wrap gap-1.5">
      {view.chips.map(([k, v]) => <li className="max-w-full rounded-md bg-surface px-2 py-0.5 font-mono text-[12px] text-ink2 [overflow-wrap:anywhere]">{k} {v}</li>)}</ul>}
  {detail.transcript && <p lang="ja" className="mt-2 text-[16px] leading-[1.7] [overflow-wrap:anywhere]">{detail.transcript}</p>}
  {detail.audioUrl && <audio controls preload="none" src={detail.audioUrl} className="mt-2 w-full" />}
  {traceId && <TraceRef traceId />}          ← MonoId + 복사 + (trace.read 일 때만) "Trace 보기 ›" → /admin/diagnostics/traces/{traceId}
  {connectionStatus && <p className="mt-2 text-[12px] text-ink2">연결 상태를 {STATUS_KO[connectionStatus]}(으)로 바꿨어요</p>}
</div>
```
- 결과 카드는 **언제나 회색 바탕**(`bg-surface2`)이다. 상태는 뱃지와 사유 글로만 말한다(응답 없음 = 빨간 카드가 아니다).

**`resultView(kind, r)`**(`console/resultView.ts`, 순수 — 단위 테스트 대상)
```
skipped = r.ok === null || r.status === 'NOT_APPLICABLE' || r.status === 'SKIPPED'
          || r.detail?.skipped === true || code === 'E_TEST_INPUT_MISSING'            // code = r.detail?.errorCode ?? r.errorCode
badge   = skipped                    ? 'SKIPPED'
        : kind === 'HEALTH'          ? r.status                                        // HEALTHY | DEGRADED | UNAVAILABLE | MISCONFIGURED
        : r.ok                       ? 'PASSED'
        : r.status === 'UNAVAILABLE' || r.status === 'MISCONFIGURED' ? r.status
        : code === 'E_TEST_TIMEOUT'  ? 'TIMEOUT' : 'FAILED'
reason  = code ? (ERROR_CODE_TEXT[code] ?? `실패했어요 (${code})`) : (r.ok || skipped ? null : '실패했어요 (코드 없음)')
hint    = badge === 'UNAVAILABLE' ? '서비스가 꺼져 있으면 정상적인 결과예요. 서비스를 켠 뒤 다시 확인해 주세요.'
        : badge === 'SKIPPED'     ? (r.hint ?? SKIP_TEXT[r.detail?.reason ?? code ?? 'ONDEVICE'])
        : null
chips   = 화이트리스트 키만: version · models · memoryMb · serviceEnv · model · schemaValid · outputChars · audioBytes · durationMs · cer · expectedSimilarity · httpStatus · timeoutMs
```
- 모르는 `detail` 키는 그리지 않는다(예상 밖 필드 노출 방지).

**HealthHistoryList**(#95a)
```
<SectionHeader title="최근 결과" right={<div className="w-[220px] min-w-0"><Segmented size="sm" ariaLabel="결과 종류" [전체|상태 확인|기능 테스트] /></div>} />
<ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
  <li> (row.traceId && can('trace.read') ? <Link href=/admin/diagnostics/traces/{id}> : <div>)
    className="flex min-h-[56px] min-w-0 flex-col justify-center gap-0.5 px-3.5 py-2"
    1줄: <StatusBadge value={resultView(row.kind, row).badge} /> <span className="text-[13px]">{KIND_KO[row.kind]}</span>
         <span className="ml-auto text-[12px] tabular-nums text-ink2">{formatAgo(row.checkedAt)}</span>
    2줄: <span className="truncate text-[12px] text-ink2">{formatMs(row.latencyMs)} · {view.reason ?? '문제 없음'}{row.traceId && ' · trace'}</span>
  </li>
</ul>
빈 목록 → <p className="rounded-[14px] border border-dashed border-line px-4 py-6 text-center text-[13px] text-ink2">아직 실행한 기록이 없어요. [상태 확인]을 눌러 보세요.</p>
```
- 360px 에서 SectionHeader 제목과 Segmented 가 한 줄에 안 들어가면 Segmented 를 제목 아래 줄로 내린다(`flex-wrap`). 빈 상태에 `EmptyBlock`(ink3 글자)을 쓰지 않는다(§1-1).

#### D. Dashboard — `/admin/dashboard` · `DashboardScreen`

```
<RefreshLine polling />
{can('health.run') && <Btn variant="ghost" size="sm" className="mt-1 w-full">{bulk ? `상태 확인 중 ${done}/${total}…` : '주 연결 상태 확인'}</Btn>}
   ↑ overview.roles[].connection.id 로 #95 를 **순서대로**(병렬 금지) 호출 → 끝나면 #80 다시. 실패가 있으면 토스트 "{k}개는 실행하지 못했어요", 없으면 "{n}개 연결을 확인했어요"
<ServiceEnvWarning />   ← environment.services[*].env 가 현재 env 와 다를 때만(16 §3): <Card> ⚠(aria-hidden) "음성 서비스 {svc} 가 {env1} 환경으로 보고했어요. 이 콘솔은 {env2} 이에요." (ink 글자)
<Section> <SectionHeader title="엔진 역할" />
  <div className="@container"><div className="grid gap-2.5 @min-[640px]:grid-cols-2">  RoleCard × 4 (REALTIME_STT → ANALYSIS_STT → TTS → LLM 고정 순서) </div></div>
{can('voices.read') && <Section> <SectionHeader title="목소리" />
  <Link href="/admin/voices" className="Card flex min-h-[56px] items-center …">사용 가능 {a} · 꺼짐 {d} · 가져오는 중 {i} <span aria-hidden className="ml-auto">›</span></Link>}
{can('trace.read') && overview.traces24h && <Section> <SectionHeader title="요청 기록 (24시간)" />
  <Link href="/admin/diagnostics?tab=traces" className="Card …">회화 턴 {turns} · 오류 {errors} · p50 {formatMs} · p95 {formatMs} ›</Link>}
```

**RoleCard** — 카드 전체가 역할 페이지 링크. 안에 버튼을 두지 않는다(중첩 대화형 금지 — 실행은 역할 페이지에서).
```
<Link href={ROLE_PATH[role]} className="block min-h-[56px] min-w-0 rounded-[14px] border border-line bg-surface p-3.5">
  <div className="flex min-w-0 items-center gap-2">
    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{ROLE_LABEL[role]} <span className="font-normal text-ink2">· {ROLE_KO[role]}</span></span>
    <StatusBadge value={status} />
  </div>
  <p className="mt-1 truncate text-[14px]">{engine.displayName ?? engine.id}</p>
  <p className="truncate text-[13px] text-ink2">{connection.name} · <span className="font-mono">{connection.key}</span>{fallbacks > 0 && ` · 예비 ${fallbacks}`}</p>
  {model && <p className="truncate text-[13px] text-ink2">모델 <span className="font-mono">{model}</span></p>}
  {role === 'LLM' && llm?.tiers && <p className="font-mono text-[12.5px] text-ink2 [overflow-wrap:anywhere]">talk {t} · review {r} · analysis {a}</p>}
  <p className="mt-1 flex min-w-0 gap-2 text-[12px] text-ink2">
    <span className="min-w-0 flex-1 truncate">{lastHealthAt ? `상태 확인 ${formatAgo(lastHealthAt)}` : '아직 상태 확인 안 함'}{statusReason && ` · ${statusReason}`}</span>
    <span aria-hidden="true">›</span>
  </p>
</Link>
```
- 역할에 연결이 없으면 같은 자리에 회색 카드 "이 역할에 연결이 없어요"(링크 유지).
- `UNAVAILABLE` 카드도 **바탕은 그대로**다. 뱃지·사유 한 줄로만 알린다.

와이어프레임(390px, LOCAL):
```
┌──────────────────────────────────────┐
│ LOCAL  개발 환경 — 운영과 분리된…  v0.1.0 │
│ ☰  AI Engine Console · 개요    ↩ 앱으로 │
│    Dashboard                           │
├──────────────────────────────────────┤
│ 마지막 갱신 16:32:05 · 30초마다… [다시 불러오기]│
│ [          주 연결 상태 확인           ] │
│ 엔진 역할                              │
│ ┌ Realtime STT · 실시간 음성 인식 ●정상┐ │
│ │ ReazonSpeech (sherpa-onnx)         │ │
│ │ 온디바이스 ReazonSpeech · reazon-o… │ │
│ │ 모델 zipformer-ja-reazonspeech-…    │ │
│ │ 상태 확인 3분 전                  › │ │
│ └────────────────────────────────────┘ │
│ ┌ TTS · 선생님 목소리 합성  ●응답 없음 ┐ │
│ │ Style-Bert-VITS2                   │ │
│ │ Style-Bert-VITS2 (맥 M4) · style-b… │ │
│ │ 상태 확인 5분 전 · connection refu… › │ │
│ └────────────────────────────────────┘ │
│  … Analysis STT · LLM                  │
│ 목소리                                 │
│ ┌ 사용 가능 3 · 꺼짐 0 · 가져오는 중 0 ›┐ │
└──────────────────────────────────────┘
```

#### E. 역할 페이지 — `/admin/speech/{realtime,analysis,tts}` · `/admin/llm` · `RoleScreen({ role })`

```
<p className="text-[13px] text-ink2 break-keep">{ROLE_DESC[role]}</p>
<RefreshLine />
<Section> <SectionHeader title="지금 쓰는 연결" right={<Link href={`/admin/connections/${primary.id}`} className="-my-2 inline-flex h-11 flex-none items-center text-[13px] font-medium text-accent">연결 상세 ›</Link>} />   ← SectionHeader 의 href 링크는 높이가 44px 가 안 돼 right 로 넣는다
  <Card>  (#91a)
    <div className="flex min-w-0 items-center gap-2"><h2 className="min-w-0 flex-1 truncate text-[16px] font-semibold">{name}</h2><StatusBadge value={enabled ? status : 'DISABLED'} /></div>
    <MonoId value={key} copy />
    <KeyValueList className="mt-2" items=[
      엔진 {engineName(engineId)} · 방식 {CONN_TYPE_KO[connectionType]} · 모델 {modelLabel(runtime)}(mono)
      · 주소 {connection.baseUrl ?? connection.binPath ?? connection.manifestUrl}(mono, displayValue 규칙)
      · 마지막 확인 {formatAgo(lastHealthAt) || '없음'} · 마지막 기능 테스트 {formatAgo(lastFunctionalAt) || '없음'} · 상태 사유 {statusReason}(있을 때만) ] />
  </Card>
  <EngineTestPanel connection={primary} onDone={reloadAll} />
<Section> <SectionHeader title="예비 연결 순서" />  (#99a)
  <ol className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
    each(순서 i, conn): <li><Link href=/admin/connections/{id} className="flex min-h-[56px] min-w-0 items-center gap-3 px-3.5 py-2">
       <span className="w-5 flex-none text-center font-mono text-[13px] text-ink2">{i}</span>
       <span className="min-w-0 flex-1"><span className="block truncate text-[14px]">{name}{i === 1 && ' (기본)'}</span><span className="block truncate font-mono text-[12px] text-ink2">{key}</span></span>
       <StatusBadge value={status} /> <span aria-hidden>›</span></Link></li>
  </ol>
  fallbacks 가 비면 목록 아래: <p className="mt-2 text-[12px] text-ink2">예비 연결 없음 — 이 연결이 안 되면 이 기능을 쓸 수 없어요</p>
  <p className="mt-1 text-[12px] text-ink2">{retryOnce ? '실패하면 다음 연결로 한 번 다시 시도해요' : '실패해도 다른 연결로 넘기지 않아요'}{!policy.enabled && ' · 정책 꺼짐'}</p>
{others.length > 0 && <Section> <SectionHeader title="정책 밖 연결" />   ← #91?role= 결과 중 primary·fallbacks 에 없는 것(예: LLM 의 home-m4-lan)
  같은 행 모양 + 2줄에 12px ink2 {runtime.allowedTasks ? `특정 작업에만 쓰여요: ${tasks}` : '라우터가 고르지 않아요'}(runtime 은 #91 에 없으면 생략)}
{can('config.effective.read') && primary.effectiveSummary && <Section> <SectionHeader title="설정값 요약" />
  <Card> <p className="text-[14px]">설정 {keys}개</p>
    <div className="mt-2 flex flex-wrap gap-1.5">{층 번호 순, 0 인 층 빼고: <span className="inline-flex items-center gap-1"><SourceBadge source /> <span className="text-[12px] tabular-nums text-ink2">{n}</span></span>}</div>
    <Link href={`/admin/configuration?target=${encodeURIComponent(primary.key)}`} className="mt-2 flex h-11 items-center justify-end text-[14px] font-medium text-accent">설정값 전체 보기 ›</Link>
  </Card>}
{role === 'TTS' && can('voices.read') && <Section> "목소리" — Dashboard 의 목소리 링크 카드와 같은 모양(#82 한 번 읽어 상태별로 센다)}
{role === 'LLM' && primary.runtime?.modelByTier && <Section> "모델 단계" — <Card><KeyValueList items={Object.entries(modelByTier)} mono /></Card>}
```
- `modelLabel(runtime)`: `model` → `defaultModel` → `modelVersion` → `modelByTier` 값들을 ` / ` 로 → 없으면 "—"(서버가 `modelLabel` 을 주면 그걸 쓴다, §6-11 ⑨).
- 정책(#99a)이 404 면 "지금 쓰는 연결" 자리에 회색 카드 "이 역할에 정책이 없어요" + 이 역할의 연결 목록(#91?role=)을 "정책 밖 연결" 모양으로 보인다.
- Engine 선택·Fallback 편집·연결 설정 폼(14 §3.2~§3.3)은 Phase 2 — 그리지 않는다.
- TTS 역할 페이지는 "목소리" 섹션 바로 아래에 "발음 사전" 링크 카드를 둔다(`voices.read`, 요청 추가 없음) — §10-2 J(task-003g).

와이어프레임(390px, Realtime STT):
```
│ ☰  AI Engine Console · 엔진     ↩ 앱으로 │
│    Realtime STT                        │
├──────────────────────────────────────┤
│ 회화 중 학습자의 말을 바로 글자로 바꿔요. │
│ 기본은 휴대폰 안에서, 안 되면 서버에서.   │
│ 마지막 갱신 16:32:05     [다시 불러오기] │
│ 지금 쓰는 연결              연결 상세 › │
│ ┌──────────────────────────────────┐ │
│ │ 온디바이스 ReazonSpeech      ●정상 │ │
│ │ reazon-ondevice               [⧉] │ │
│ │ 엔진                              │ │
│ │ ReazonSpeech (sherpa-onnx)        │ │
│ │ 방식                              │ │
│ │ 휴대폰(ONDEVICE)                  │ │
│ │ 모델                              │ │
│ │ zipformer-ja-reazonspeech-2024-…  │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ [            상태 확인            ] │ │
│ │ 상태 확인은 서버에 있는 기기용 모델   │ │
│ │ 파일 목록을 봐요. 기능 테스트는 휴대폰 │ │
│ │ 안에서만 할 수 있어요(…)             │ │
│ │ ┌ ●정상 상태 확인     38ms · 방금 ┐ │ │
│ │ │ [version zipformer-…]           │ │ │
│ │ └────────────────────────────────┘ │ │
│ └──────────────────────────────────┘ │
│ 예비 연결 순서                          │
│ ┌ 1 온디바이스 ReazonSpeech (기본) ●정상›┐│
│ │ 2 ReazonSpeech gateway(폴백) ●응답 없음›││
│ └──────────────────────────────────┘ │
│ 실패하면 다음 연결로 한 번 다시 시도해요   │
│ 설정값 요약                            │
│ ┌ 설정 14개                           ┐ │
│ │ [1 DEFAULT] 9  [3 APPLICATION_CONFIG] 5│
│ │                  설정값 전체 보기 › │ │
│ └──────────────────────────────────┘ │
```

#### F. Voices — `/admin/voices` · `VoicesScreen`(읽기 전용)

```
<RefreshLine />
<div className="flex min-w-0 items-center gap-2">
  <div className="min-w-0 flex-1"><ChipRadio ariaLabel="목소리 상태" [전체 {n}|사용 가능 {n}|꺼짐 {n}|오류 {n}] /></div>   ← 받은 목록을 화면에서 거른다
  <ToggleButton pressed={includeArchived}>보관 포함</ToggleButton>                                                     ← 바꾸면 #82 ?includeArchived=1 로 다시 읽기
</div>
<div className="@container mt-3"><ul className="grid gap-2.5 @min-[640px]:grid-cols-2"> VoiceCard × n (sortOrder 순 — 서버 순서 그대로) </ul></div>
빈 목록 → 점선 안내 "등록된 목소리가 없어요."
```
**VoiceCard** — 버튼 없음(미리듣기 #89a·재동기화 #88·활성화 #85 는 Phase 2).
```
<li className="Card">
  <div className="flex min-w-0 items-center gap-2"><span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{displayName}</span><VoiceStatusBadge status enabled /></div>
  <MonoId value={id} copy />
  <KeyValueList items=[ 모델 {model.id}{model.version && ` v${model.version}`}(mono) · 화자 {speaker} · 스타일 {styles.map(s => s.label).join(' · ') || '없음'} · 쓰는 사용자 {usage.users}명 · 상태 사유 {statusReason}(있을 때만) ] />
</li>
```

| VoiceStatus | 톤 | 글자 |
|---|---|---|
| `AVAILABLE` + enabled | good | 사용 가능 |
| `AVAILABLE` + enabled=false · `DISABLED` | neutral | 꺼짐 |
| `ERROR` | bad | 오류 |
| `IMPORTING` · `VALIDATING` | 점선 neutral | 가져오는 중 · 검증 중 |
| `DELETING` · `ARCHIVED` | neutral | 삭제 중 · 보관됨 |

#### G. Plugins — `/admin/plugins` · `/admin/plugins/[id]`(DEVELOPER+)

목록(#121)
```
<div className="@container"><ul className="grid gap-2.5 @min-[640px]:grid-cols-2">
 <li><Link href={`/admin/plugins/${encodeURIComponent(id)}`} className="block min-h-[56px] min-w-0 rounded-[14px] border border-line bg-surface p-3.5">
   1줄 <span className="min-w-0 flex-1 truncate font-mono text-[15px] font-semibold">{id}</span> <LoadedBadge loaded /> {orphan && <Badge tone="neutral">등록 불일치</Badge>}
   2줄 13px ink2 truncate: {type} · v{version} · 역할 {roles.join(', ')} · 연결 {connections}개
   3줄 13px ink2 truncate: 방식 {connectionTypes.join(', ')}
   {initError && <p className="mt-1 line-clamp-2 text-[13px] text-bad [overflow-wrap:anywhere]">{initError}</p>}
 </Link></li>
</ul></div>
```
`LoadedBadge`: `loaded` → good "로드됨" / 아니면 bad "로드 실패".

상세(#122)
```
<Link href="/admin/plugins" className="inline-flex h-11 items-center text-[14px] text-ink2">← 플러그인 목록</Link>
<div className="flex min-w-0 items-center gap-2"><h2 className="min-w-0 flex-1 font-mono text-[18px] font-semibold [overflow-wrap:anywhere]">{id}</h2><LoadedBadge loaded /></div>
<Section "정보"> <Card><KeyValueList items=[ 표시 이름 · 종류 · 버전 · 구현 클래스(providerClass, mono) · 역할 · 연결 방식 · 스키마 버전 · 소스 파일(sourcePath — 저장소 상대 경로만, `/` 로 시작하면 숨김) ] /></Card>
<Section "기능(capabilities)"> <div className="flex flex-wrap gap-1.5">{capabilities.map(c => <Badge tone="neutral"><span className="font-mono">{c}</span></Badge>)}</div>
{initError && <Section "초기화 오류"> <p className="rounded-xl bg-bad-soft p-3 font-mono text-[12.5px] text-bad [overflow-wrap:anywhere]">{initError}</p>}
<Section "설정 키 ({n})">
  <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
    each key: <li className="min-w-0 px-3.5 py-2.5">
      1줄 <span className="font-mono text-[13px] [overflow-wrap:anywhere]">{key}</span> <span className="text-[12px] text-ink2">{type}</span>
      2줄 13px: 기본값 <span className="font-mono">{displayValue(key, default)}</span>{min/max 있으면 ` · ${min}~${max}`}{enum 있으면 ` · ${enum.join(' / ')}`}
      3줄 12px ink2: {EditabilityText}{productionSensitive && ' · 운영 민감'}
      {description && <p className="mt-0.5 text-[13px] text-ink2 break-keep">{description}</p>}
    </li>
  </ul>
<Section "기본 설정 문서">
  <details className="rounded-[14px] border border-line bg-surface"><summary className="flex h-11 cursor-pointer items-center px-3.5 text-[14px] font-medium">펼쳐 보기</summary>
    <pre className="whitespace-pre-wrap px-3.5 pb-3 font-mono text-[12.5px] [overflow-wrap:anywhere]">{JSON.stringify(defaultConfiguration, null, 2)}</pre></details>
```
- 404 → `ConsoleNotFound backHref="/admin/plugins" backLabel="플러그인 목록으로"`.

#### H. Connections — `/admin/connections` · `/admin/connections/[id]`

목록(#91 전체 1회)
```
<RefreshLine />
<div className="mt-1 flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
  {can('health.run') && <Btn variant="ghost" size="sm">{bulk ? `확인 중 ${done}/${total}…` : '모두 상태 확인'}</Btn>}   ← enabled 인 연결마다 #95 를 순서대로 → 끝나면 #91 다시
  {can('secrets.read_ref') && <Btn variant="ghost" size="sm">시크릿 참조</Btn>}                                     ← SecretsSheet 열기
</div>
<div className="mt-2.5"><ChipRadio ariaLabel="역할" [전체 {n}|Realtime STT {n}|Analysis STT {n}|TTS {n}|LLM {n}] /></div>   ← 화면에서 거른다
<div className="@container mt-3"><ul className="grid gap-2.5 @min-[640px]:grid-cols-2"> ConnectionCard × n (역할 순 → key 순) </ul></div>
```
**ConnectionCard**(카드 전체 링크 → 상세)
```
1줄 <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{name}</span> <StatusBadge value={enabled ? status : 'DISABLED'} />
2줄 <span className="block truncate font-mono text-[13px] text-ink2">{key}</span>
3줄 13px ink2 truncate: {ROLE_LABEL[role]} · {engineName(engineId)} · {CONN_TYPE_KO[connectionType]}
4줄 12px ink2 truncate: {fallbackRole.primaryOf.length ? `${ROLE_LABEL} 기본` : fallbackRole.fallbackOf.length ? `${ROLE_LABEL} 예비` : '정책 밖'} · {lastHealthAt ? `확인 ${formatAgo}` : '확인 안 함'}  ›
```

**SecretsSheet**(#101 — **시트를 열 때 한 번** 조회. 페이지 진입만으로는 부르지 않는다)
```
<Sheet open title="시크릿 참조" onClose>
  <p className="text-[13px] text-ink2 break-keep">값은 보이지 않아요. 참조 이름·있는지·마지막 사용만 보여 줘요. 열 때마다 조회 기록(감사 로그)이 남아요.</p>
  loading → LoadingBlock 대신 13px ink2 "불러오는 중…"(ink3 금지) · error → ErrorBlock + 다시 시도
  <ul className="mt-3 divide-y divide-line">
    each: <li className="min-w-0 py-2.5 {ref === highlightRef ? 'rounded-xl bg-accent-soft px-2' : ''}">
      1줄 <span className="min-w-0 flex-1 font-mono text-[13px] [overflow-wrap:anywhere]">{ref}</span> {exists ? <Badge tone="good">있음</Badge> : <Badge tone="bad">없음</Badge>}
      2줄 12px ink2: {source === 'file' ? '파일' : '환경 변수'} · 사용 연결 {usedBy.map(idToKey).join(', ') || '없음'}(mono) · {lastUsedAt ? `마지막 사용 ${formatAgo}` : '사용 기록 없음'}
    </li>
  </ul>
  빈 목록 → "연결에 걸린 시크릿 참조가 없어요."
</Sheet>
```
- `usedBy` 는 connection id 다 → 목록(#91)에서 key 로 바꿔 보인다(못 찾으면 id 그대로).

상세(#91a + #95a)
```
<Link href="/admin/connections" className="inline-flex h-11 items-center text-[14px] text-ink2">← 연결 목록</Link>
<Card>
  <div className="flex min-w-0 items-center gap-2"><h2 className="min-w-0 flex-1 text-[17px] font-semibold [overflow-wrap:anywhere]">{name}</h2><StatusBadge value={enabled ? status : 'DISABLED'} /></div>
  <MonoId value={key} copy />
  <p className="mt-1 text-[12px] text-ink2 [overflow-wrap:anywhere]">{ROLE_LABEL[role]} · {engineName(engineId)} · {CONN_TYPE_KO[connectionType]} · {environment} · 설정 v{version ?? '—'}</p>
  <p className="text-[12px] text-ink2">{primaryOf.length ? `${ROLE_LABEL}의 기본 연결` : fallbackOf.length ? `${ROLE_LABEL}의 예비 연결` : '정책 밖 연결'}</p>
  {statusReason && <p className="mt-1 text-[13px] text-ink [overflow-wrap:anywhere]">{statusReason}</p>}
  {!enabled && <p className="mt-1 text-[12px] text-ink2">꺼진 연결 — 라우터가 고르지 않아요</p>}
</Card>
<EngineTestPanel connection onDone={() => { conn.reload(); setHistoryKey(k => k + 1) }} />
<Section "연결 정보"> <Card>
  <KeyValueList mono items={flattenDot(connection)} />                       ← baseUrl·wsPath·timeoutMs·retry·binPath(displayValue 규칙)·manifestUrl …
  credentialRef 행: credentialRef
     ? <><span className="font-mono">{credentialRef}</span> 🔒(aria-label 시크릿 참조)
         {can('secrets.read_ref') && <button className="ml-1 h-11 px-2 text-[13px] font-medium text-accent">있는지 확인</button>}</>   ← SecretsSheet(highlightRef)
     : "없음"
</Card>
<Section "실행 설정 (runtime)"> <Card><KeyValueList mono items={[...flattenDot(runtime), ['로그 레벨', logLevel]]} /></Card>   ← 중첩 객체는 `vad.model` 처럼 점 표기
{can('config.effective.read') && effectiveSummary && <Section "설정값 요약"> (E 와 같은 카드)}
<HealthHistoryList connectionId={id} limit={20} reloadKey={historyKey} />
```
- 404 → `ConsoleNotFound backHref="/admin/connections" backLabel="연결 목록으로"`.

#### I. Configuration — `/admin/configuration` · `EffectiveScreen`(Effective 탭만)

```
<SectionHeader title="대상 연결" />
<ChipRadio ariaLabel="대상 연결" options={#91 전체, 역할 순, 라벨 = key(mono)} value={target} />   ← ?target=<key> 로 시작(없으면 첫 연결), 바꾸면 router.replace
<Card flat className="mt-2.5">
  <p className="text-[13px] [overflow-wrap:anywhere]">{name} · {ROLE_LABEL[role]} · <span className="font-mono">{engineId}</span> 스키마 v{schemaVersion}</p>
  <p className="text-[12px] text-ink2">해석 {HH:mm:ss}{cacheHit && ' (캐시)'} · {environment}</p>
</Card>
<details className="mt-2"><summary className="flex h-11 cursor-pointer items-center text-[13px] font-medium">출처 8층이란?</summary><SourceLegend /></details>
<input type="search" aria-label="설정 키 검색" placeholder="키 검색 (예: timeout)" className="(§4 입력 모양, 16px) mt-1" />   ← 화면 안에서 바로 거른다(요청 없음)
<div className="mt-2.5"><ChipRadio ariaLabel="출처" [전체 {n} | 있는 층만 "{n층} {SOURCE} {개수}"] /></div>
for (prefix, rows) of groupByPrefix(filtered):                  // 'connection' · 'runtime' · 'logging' · 그 외 첫 마디
  <p className="mb-1.5 mt-4 font-mono text-[12px] text-ink2">{prefix}.*</p>
  <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface"> EffectiveRow × n </ul>
빈 결과 → 점선 안내 "조건에 맞는 키가 없어요."
```
**EffectiveRow**
```
<li>
  <{expandable ? 'button' : 'div'} aria-expanded={expandable ? expanded : undefined} onClick={toggle}
     className="flex min-h-[56px] w-full min-w-0 flex-col gap-1 px-3.5 py-2.5 text-left">
    1줄 <span className="flex min-w-0 items-start gap-2">
          <span className="min-w-0 flex-1 font-mono text-[13px] text-ink2 [overflow-wrap:anywhere]">{key}</span>
          {secret && <span aria-label="시크릿 참조">🔒</span>}
          {shadowed && <span className="flex-none text-[12px] text-ink">⚠ 가려진 값</span>}
        </span>
    2줄 <span className="font-mono text-[15px] text-ink [overflow-wrap:anywhere]">{secret ? refName(value) : displayValue(key, value)}</span>
    3줄 <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <SourceBadge source /> <EditabilityText editability restartRequired />
          {source === 'ENVIRONMENT' && <span className="text-[12px] text-ink2">env 가 덮고 있어요</span>}
          {expandable && <span aria-hidden="true" className="ml-auto text-ink2">{expanded ? '˄' : '˅'}</span>}
        </span>
  </…>
  {expanded && <ol className="mx-3.5 mb-3 border-l-2 border-line pl-3">   ← layers, 낮은 층 → 높은 층
     each(layer, i): <li className="py-1 text-[12px]">
        <span className="flex min-w-0 flex-wrap items-center gap-2"><SourceBadge source={layer.source} /><span className="font-mono text-ink [overflow-wrap:anywhere]">{displayValue(key, layer.value)}</span>{i === last && <span className="text-ink2">← 사용 중</span>}</span>
        {layer.sourceRef && <span className="block font-mono text-[11.5px] text-ink2 [overflow-wrap:anywhere]">{layer.sourceRef}</span>}
     </li></ol>}
</li>
```
- `expandable = Array.isArray(row.layers) && row.layers.length > 0`. ADMIN 응답에는 `layers`·`sourceRef` 가 없으므로(#102 "ADMIN 은 값+Source 이름만") 펼침 표시 자체가 없다.
- `shadowed = row.shadowed ?? (layers 에 마지막과 다른 값이 있음)`. ADMIN 은 서버가 `shadowed` 를 줘야만 보인다(§6-11 ⑥).
- 시크릿 키: 값 칸에 ref 이름만. 서버가 값 대신 객체(`{credentialRef, exists}`)를 주면 `credentialRef` 만 쓰고 **`exists` 는 그리지 않는다**(존재 여부는 `secrets.read_ref` + 감사 경로로만).
- Form·Raw JSON·Diff·Presets·Export·Overrides 탭은 없다(Phase 2~4). 탭 줄 자체를 그리지 않는다.
- `SourceLegend`: 1→8 순서로 `<SourceBadge/> {한국어 뜻}` 한 줄씩 + 끝에 "위 층이 아래 층을 키 하나씩 덮어요. USER_SETTING·RUNTIME_OVERRIDE 는 이 화면(관리 설정)에는 보통 나오지 않아요."

와이어프레임(390px, DEVELOPER):
```
│    Configuration                       │
├──────────────────────────────────────┤
│ 대상 연결                               │
│ [reazon-ondevice][reazon-gateway][whi→ │
│ ┌ ReazonSpeech gateway(폴백) · Realtime┐│
│ │ STT · sherpa-onnx-reazon 스키마 v1    ││
│ │ 해석 16:32:05 · LOCAL               ││
│ └────────────────────────────────────┘│
│ 출처 8층이란?                      ˅   │
│ ┌ ⌕ 키 검색 (예: timeout)            ┐ │
│ [전체 14][1 DEFAULT 6][3 APPLICATION_C→ │
│ connection.*                           │
│ ┌──────────────────────────────────┐ │
│ │ connection.baseUrl                │ │
│ │ http://127.0.0.1:8100             │ │
│ │ [4 ENVIRONMENT] 재시작 필요         │ │
│ │ env 가 덮고 있어요               ˅ │ │
│ ├──────────────────────────────────┤ │
│ │ connection.timeoutMs              │ │
│ │ 15000                             │ │
│ │ [3 APPLICATION_CONFIG] 즉시 반영   ˅ │ │
│ └──────────────────────────────────┘ │
│ runtime.*                              │
│ ┌──────────────────────────────────┐ │
│ │ runtime.numThreads      ⚠ 가려진 값 │ │
│ │ 4                                 │ │
│ │ [4 ENVIRONMENT] 재시작 필요       ˄ │ │
│ │ ┊ [1 DEFAULT] 2                    │ │
│ │ ┊ schema:sherpa-onnx-reazon@1#…    │ │
│ │ ┊ [3 APPLICATION_CONFIG] 4          │ │
│ │ ┊ file:speech.config.yml#connect…  │ │
│ │ ┊ [4 ENVIRONMENT] 4 ← 사용 중        │ │
│ │ ┊ env:KAIWA_CONN_REAZON_GATEWAY_RU…│ │
│ └──────────────────────────────────┘ │
```

#### J. Diagnostics — `/admin/diagnostics` · `DiagnosticsScreen` / `/admin/diagnostics/traces/[traceId]` · `TraceDetailScreen`

```
{can('trace.read') && <Segmented ariaLabel="진단 보기" [Health 기록 | 요청 Trace] value={tab} />}   ← ?tab=health|traces(router.replace). trace.read 가 없으면 Segmented 없이 Health 기록만, ?tab=traces 는 무시
tab = health:
  <div className="mt-2.5"><ChipRadio ariaLabel="연결" options={#91, 라벨 key(mono)} value={connectionId} /></div>
     ← ?connection=<id>. 없으면 status 가 HEALTHY 가 아닌 첫 연결 → 없으면 첫 연결
  <HealthHistoryList connectionId limit={50} />      ← 실행 버튼은 두지 않는다(실행은 역할·연결 화면에서)
tab = traces:
  <Segmented size="sm" ariaLabel="기간" [24시간|7일|30일] />                          ← from = now - 기간(ISO), to 생략
  <div className="mt-2"><ChipRadio ariaLabel="종류" [전체|회화 턴|기능 테스트|미리듣기|플레이그라운드|E2E] /></div>
  <div className="mt-2"><Segmented size="sm" ariaLabel="결과" [전체|정상|일부 실패|실패] /></div>
  <p className="mb-1.5 mt-3 text-[12px] text-ink2" aria-live="polite">{items.length}건{nextCursor && ' 이상'} · 보관 90일</p>
  <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface"> TraceRow × n </ul>
  {nextCursor && <Btn variant="ghost" className="mt-3 w-full" aria-busy={loadingMore}>{loadingMore ? '불러오는 중…' : '더 보기'}</Btn>}
  빈 목록 → 점선 안내 "이 조건의 기록이 없어요."
```
**TraceRow**(행 전체 링크 → 상세, ≥56px)
```
<Link href={`/admin/diagnostics/traces/${encodeURIComponent(traceId)}`} className="flex min-h-[56px] min-w-0 flex-col justify-center gap-0.5 px-3.5 py-2">
  1줄 <Badge tone="neutral">{TRACE_KIND_KO[kind]}</Badge> <TraceStatusBadge status /> <span className="ml-auto text-[12px] tabular-nums text-ink2">{formatMs(totalMs)} · {formatAgo(createdAt)}</span>
  2줄 <span className="truncate font-mono text-[12px] text-ink2">{stepNames.join(' › ')}{errorCode && ` · ${errorCode}`}</span>
</Link>
```
`TraceStatusBadge`: `OK` good "정상" · `PARTIAL` `border border-bad bg-surface text-bad` "일부 실패" · `ERROR` bad "실패".

**TraceDetailScreen**(#129)
```
<Link href="/admin/diagnostics?tab=traces" className="inline-flex h-11 items-center text-[14px] text-ink2">← Trace 목록</Link>
<Card>
  <h2 className="sr-only">Trace 상세</h2>
  <MonoId value={traceId} copy />
  <div className="mt-2 flex flex-wrap items-center gap-2"><Badge tone="neutral">{TRACE_KIND_KO[kind]}</Badge><TraceStatusBadge status /><span className="text-[13px] tabular-nums">{formatMs(totalMs)}</span></div>
  <KeyValueList className="mt-2" items=[ 환경 {environment} · 시각 {M월 D일 HH:mm:ss} · 대상 {refType} {refId}(mono, 링크 없음) · 디버그 세션 {debugSessionId ?? '없음'} · 사용자 {userId ?? '—'}(서버가 마스킹한 그대로) ] />
</Card>
<Section> <SectionHeader title={`단계 (${steps.length})`} />
  <ol className="grid gap-2"> StepCard × n </ol>
```
**StepCard**
```
<li className="Card">
  <div className="flex min-w-0 items-center gap-2"><span className="min-w-0 flex-1 truncate font-mono text-[14px] font-semibold">{name}</span><StepStatusBadge status /><span className="flex-none text-[13px] tabular-nums">{formatMs(latencyMs)}</span></div>
  <div aria-hidden="true" className="mt-2 h-1.5 rounded-full bg-surface2"><div className="h-full rounded-full {BAR[status]}" style={{ width: `${Math.max(2, Math.min(100, latencyMs / totalMs * 100))}%` }} /></div>
  <p className="mt-2 text-[12.5px] text-ink2 [overflow-wrap:anywhere]">{engineId}{connectionKey && ` · ${connectionKey}`}{model && ` · 모델 ${model}`}{attempt > 1 && ` · ${attempt}번째 시도`}{fallbackFrom && ` · ${fallbackFrom} 에서 넘어옴`}{cache && ` · 캐시 ${cache}`}{client && ` · ${client}`}</p>
  {sizes·meta 가 있으면 <ul className="mt-1.5 flex flex-wrap gap-1.5">{k v 칩 — neutral 12px 모노, 값이 객체면 JSON 한 줄}</ul>}
  {errorCode && <p className="mt-1.5 text-[13px] font-semibold text-bad">{errorCode}</p>}
  {errorMessage && <p className="font-mono text-[12px] text-ink2 [overflow-wrap:anywhere]">{errorMessage}</p>}
</li>
```
- 막대 색 `BAR`: `OK` `bg-ink2` · `FAILED`·`TIMEOUT` `bg-bad` · `FALLBACK` `bg-warn` · `SKIPPED` 채우지 않음. 막대는 장식이고 상태는 뱃지 글자가 진다. TTS 문장 단계처럼 겹쳐 도는 단계도 "전체 대비 비율"로만 그린다.
- `captured`(Debug 캡처, Phase 3)는 그리지 않는다. Trace 에는 본문이 없으므로 "본문 보기" 자리도 없다.
- 404 → `ConsoleNotFound backHref="/admin/diagnostics?tab=traces" backLabel="Trace 목록으로"` · 403 → `ConsoleForbidden`.

#### K. `/settings` 진입 행 — `AdminConsoleEntry`

위치: `src/app/(app)/settings/page.tsx` 의 `<SpeechSettings />` **바로 아래**(설정 허브 맨 끝).
```tsx
// settings/page.tsx(서버) — 추가 두 줄
const showConsole = user ? await userCan(user.id, 'engine.read') : false   // @/modules/admin(developer A). 결과를 캐시하지 않는다
…
<SpeechSettings />
{showConsole && <AdminConsoleEntry />}
```
```tsx
// src/components/settings/AdminConsoleEntry.tsx — 서버 컴포넌트('use client' 금지: 문자열이 USER 번들·DOM 에 들어가지 않게)
<Section>
  <SectionHeader title="관리자" />
  <Link href="/admin/dashboard" className="flex min-h-[56px] min-w-0 items-center gap-3 rounded-[14px] border border-line bg-surface px-3.5 py-2.5">
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[15px] font-semibold text-ink">AI Engine Console</span>
      <span className="block truncate text-[13px] text-ink2">엔진·연결 상태를 보고 테스트해요</span>
    </span>
    <svg chevron 20px aria-hidden="true" />
  </Link>
</Section>
```
```
│ 음성 인식                                │
│ ┌ … (기존) ┐                             │
│ 관리자                                   │
│ ┌──────────────────────────────────┐   │
│ │ AI Engine Console              › │   │ 56px
│ │ 엔진·연결 상태를 보고 테스트해요       │   │
│ └──────────────────────────────────┘   │
```

### 6-3. 상태 관리

`useAdminResource<T>(path: string | null, opts?: { pollMs?: number })` (`console/useAdminResource.ts`)
```
state: { status: 'loading'|'ready'|'error'; data: T | null; err: Err | null; loadedAt: number | null; reloading: boolean }
reload(): 이전 요청 abort → apiGet(path, { signal }) → ready(data, loadedAt = Date.now()) | error(toErr(e))  (AbortError 는 무시)
path 변경 → data 비우고 즉시 reload · path = null → 아무것도 안 함
pollMs → setInterval(reload), document.visibilityState === 'visible' 일 때만.
         visibilitychange → visible 이면 loadedAt 이 pollMs 보다 오래됐을 때 즉시 reload
reload 중에는 이전 data 를 유지한다(깜박임 없음). RefreshLine 만 "불러오는 중…"
```
- 오류 분기(HTTP status 먼저): 401 = `api.ts` 가 로그인으로 보냄 · 403 = `ConsoleForbidden(details.missing)` · 404 = 상세 화면은 `ConsoleNotFound`, 목록 화면은 ErrorBlock "콘솔에 들어갈 권한이 바뀌었을 수 있어요" + [설정으로] · 그 외 = ErrorBlock(§6-8 ⓐ) + 다시 시도.

`EngineTestPanel`
```
run: { kind: 'HEALTH'|'FUNCTIONAL'; startedAt: number } | null
result: { kind; body: HealthResultDto | FunctionalResultDto; receivedAt: number } | null
notice: string | null                         // 409·429·403·404 안내(카드 아님)
error: string | null                          // 500·네트워크
cooldownUntil: { HEALTH?: number; FUNCTIONAL?: number }   // useCountdown 으로 남은 초
aliveRef                                      // 언마운트 뒤 결과는 버린다. 요청은 끊지 않는다(서버는 끝까지 기록한다)
```

| 응답 | 처리 |
|---|---|
| 200 | `result` 교체(notice·error 비움) → `onDone(body)`. LLM 역할의 FUNCTIONAL 이면 `cooldownUntil.FUNCTIONAL = now + 30s` |
| 409 `E_TEST_IN_FLIGHT` | notice "이미 실행 중이에요. 끝나면 아래 기록에 나타나요." → 5초 뒤 `onDone(null)`(기록만 다시 읽기) |
| 409 `E_HEALTH_NOT_ENABLED` · `E_TEST_NOT_ENABLED` | notice "꺼져 있는 연결이라 실행하지 않았어요." |
| 429 | `cooldownUntil[kind] = now + retryAfterOf(err) * 1000`, 버튼 글자 "{n}초 뒤 다시", notice "{n}초에 한 번만 실행할 수 있어요." |
| 403 | notice "이 실행 권한이 없어요 ({missing})" — 버튼은 그대로 둔다(서버가 진실) |
| 404 | notice "연결을 찾을 수 없어요. 목록을 다시 불러와 주세요." |
| 504 | `result` = 시간 초과 카드(`badge TIMEOUT`, `details.traceId` 가 있으면 표시) |
| 502 | `result` = 실패 카드(`badge FAILED`, `details.traceId`) |
| 500 · 네트워크(0) | `error` → ErrorBlock "실행하지 못했어요. 잠시 뒤 다시 눌러 주세요." (다시 누를 수 있음) |

화면별
- `DashboardScreen`: `overview = useAdminResource('/api/admin/v1/overview', { pollMs: 30_000 })` · `bulk: { done; total; failed } | null`(도는 동안 폴링 reload 는 건너뛴다).
- `RoleScreen`: `policy`(#99a) → `primary`(#91a, policy 가 온 뒤 id 로) · `conns`(#91 `?role=`) · 목소리(#82, TTS 만) · 엔진 이름(`useEngineNames`). 테스트 뒤 `primary`·`policy` 다시 읽기 + 기록 `reloadKey++`.
- `ConnectionsScreen`: `list`(#91) · `roleFilter` · `bulk` · `secrets: { open; highlightRef? }`.
- `ConnectionDetailScreen`: `conn`(#91a) · `historyKey` · `secrets`.
- `EffectiveScreen`: `targets`(#91) · `target`(URL `?target=` → 없으면 첫 연결 key) · `eff`(#102) · `q` · `sourceFilter` · `expanded: Set<string>`(대상을 바꾸면 비운다) — 대상 칩을 빨리 바꾸면 이전 요청 abort.
- `DiagnosticsScreen`: `tab` · `connectionId`(URL) · `period: '24h'|'7d'|'30d'` · `kind` · `status` · `traces: { items; nextCursor; loadingMore; reqNo }` — 필터가 바뀌면 커서 초기화·abort·요청 번호 비교(늦게 온 옛 응답 버림). 필터는 URL 에 넣지 않는다(탭·연결만).
- `TraceDetailScreen`: `trace`(#129).
- `ConsoleProvider`: layout 이 서버에서 채운 `{ role, capabilities: string[], environment: { environment, appVersion?, services? } }` → `useCan()(cap)`, `useConsoleEnv()`. **클라이언트는 capability 를 저장하지 않는다**(localStorage·sessionStorage 금지).
- `useEngineNames`: #90 을 모듈 변수 Promise 로 한 번만 읽어 `engineId → displayName` 을 준다(콘솔 세션 동안 재사용, 실패하면 `engineId` 그대로).
- 상대 시각: `useNow(true, 30_000)` 한 번으로 "3분 전"을 갱신한다.

### 6-4. API 호출 계획

모두 `apiGet`/`apiPost`(`@/components/common/api`) + `toErr`/`retryAfterOf`/`detailString`(`@/components/common/errors`). 경로에 넣는 id·key 는 `encodeURIComponent`, 쿼리는 `URLSearchParams`.

| # | 엔드포인트 | 메서드 | capability | 화면 | 파라미터 | 사용 필드 | 오류 처리 |
|---|---|---|---|---|---|---|---|
| 80 | `/api/admin/v1/overview` | GET | engine.read | Dashboard(30초 폴링) | — | `environment` · `roles[].{role, engine{id,displayName}, connection{id,key,name}, status, statusReason?, lastHealthAt, fallbacks, model}` · `voices.{available,disabled,importing}` · `llm.tiers` · `traces24h`(trace.read 일 때만 그림) | ErrorBlock + 다시 시도, 폴링은 계속 |
| 81 | `/api/admin/v1/environment` | GET | console.access | **layout(서버)** — 모듈 함수로 같은 값을 받는다(fetch 안 함) | — | `environment` · `appVersion` · `services.*.env` | 실패해도 셸은 그린다(띠에 env 만, 버전 생략) |
| 82 | `/api/admin/v1/voices` | GET | voices.read | Voices · TTS 역할 목소리 요약 · (Dashboard 는 #80 `voices`) | `includeArchived=0\|1` | `id, displayName, status, statusReason, enabled, speaker, model{id,version,status}, styles[].label, usage.users` | ErrorBlock |
| 90 | `/api/admin/v1/engines` | GET | engine.read | 엔진 표시 이름 맵 | (includeSchema 안 씀) | `engine.{id, displayName, type}` | 조용히 `engineId` 로 대신 |
| 91 | `/api/admin/v1/engine-connections` | GET | engine.read | Connections 목록 · Configuration 대상 칩 · Diagnostics 연결 칩 · 역할 "정책 밖 연결" | `role=`(역할 화면만) | `id, key, name, engineId, role, connectionType, enabled, status, statusReason, lastHealthAt, fallbackRole{primaryOf,fallbackOf}` | ErrorBlock |
| 91a | `/api/admin/v1/engine-connections/:id` | GET | engine.read | 연결 상세 · 역할 "지금 쓰는 연결" | — | 위 + `connection{…}, runtime{…}, credentialRef, logLevel, environment, version, lastFunctionalAt, effectiveSummary` | 404 → ConsoleNotFound |
| 95 | `/api/admin/v1/engine-connections/:id/health` | POST | health.run | [상태 확인] · "주 연결 상태 확인" · "모두 상태 확인" | — | `kind, ok, status, latencyMs, detail{화이트리스트 + errorCode, message}, checkedAt, connectionStatus` | §6-3 표 |
| 95a | `/api/admin/v1/engine-connections/:id/health` | GET | engine.read | 최근 결과 · Diagnostics Health 기록 | `kind=HEALTH\|FUNCTIONAL`(전체면 생략) `limit=20\|50` | `EngineHealth[]` — `id, kind, ok, status, latencyMs, detail, traceId, checkedAt` | 목록 자리 ErrorBlock |
| 96 | `/api/admin/v1/engine-connections/:id/test` | POST | functional_test.run | [기능 테스트] | `{}`(overrideRuntime 안 씀) | `ok, status, latencyMs, traceId, detail{…}, hint?` | §6-3 표 |
| 99a | `/api/admin/v1/fallback-policies/:role` | GET | engine.read | 역할 페이지 예비 순서 | — | `primary{id,key,name,status}, fallbacks[], retryOnce, enabled` | 404 → "이 역할에 정책이 없어요" |
| 101 | `/api/admin/v1/secrets` | GET | secrets.read_ref | SecretsSheet(**연 때만**, 감사 1행) | — | `ref, source, exists, usedBy, lastUsedAt` | 시트 안 ErrorBlock |
| 102 | `/api/admin/v1/config/effective` | GET | config.effective.read | Configuration | `scope=ENGINE_CONNECTION&targetId={key}` | `environment, targetKey, engineId, schemaVersion, resolvedAt, cacheHit, keys[].{key, value, source, sourceRef?, editability, restartRequired, secret, layers?, shadowed?}` | 404 → "대상을 찾을 수 없어요" · ErrorBlock |
| 121 | `/api/admin/v1/plugins` | GET | plugins.read | Plugins 목록 | — | `id, version, type, roles, connectionTypes, loaded, initError, connections, orphan` | 403 → ConsoleForbidden |
| 122 | `/api/admin/v1/plugins/:id` | GET | plugins.read | Plugin 상세 | — | descriptor · `capabilities[]` · `schema.keys[]` · `defaultConfiguration` · `loaded, initError` · `sourcePath` | 404 → ConsoleNotFound |
| 128 | `/api/admin/v1/traces` | GET | trace.read | Diagnostics 요청 Trace | `from`(ISO) `kind` `status` `limit=50` `cursor` | `items[].{traceId, kind, status, totalMs, errorCode, stepNames, createdAt}, nextCursor` | ErrorBlock |
| 129 | `/api/admin/v1/traces/:traceId` | GET | trace.read | Trace 상세 | — | `traceId, environment, kind, status, totalMs, refType, refId, debugSessionId, userId, createdAt, steps[]` | 404 · 403 카드 |
| 137b | `/api/admin/v1/me/capabilities` | GET | console.access | **화면은 부르지 않는다**(layout 이 서버에서 같은 값을 준다). QA 가 API 로 대조할 때만 | — | — | — |

- Phase 1 표에 있지만 화면이 쓰지 않는 것: #99(전체 정책 — 역할 화면은 #99a, 대시보드는 #80) · #103(스키마 — `config.raw.read` 전용, 플러그인 상세는 #122 에 포함) · #82a(목소리 상세 화면 없음).
- 서버 `message` 는 콘솔에서 400·409·422 에 한해 보조 줄(12px ink2)로 보여 줘도 된다(콘솔은 엔진 용어 허용). 제목 문구는 §6-8.

### 6-5. 컴포넌트 분해

폴더는 01 §7 목록을 지킨다: `src/components/admin/console/*`(셸·공용·엔진 화면) · `configEditor/*`(Effective) · `trace/*`(진단·Trace). `(app)` 컴포넌트(`chat`·`vocab`·`settings`…)는 import 하지 않는다 — 공용은 `components/common`(+ 셸 인프라 `shell/NativeFlag` 하나).

| 컴포넌트/모듈 | 종류 | props | 상태 |
|---|---|---|---|
| `ConsoleShell` | client | `{ access: ClientConsoleAccess; children }` | 메뉴 시트 열림 |
| `ConsoleProvider` · `useCan` · `useConsoleEnv` | client ctx | `{ value: { role, capabilities, environment } }` | — |
| `EnvStrip` | client | `{ environment: Environment; appVersion?: string }` | — |
| `ConsoleBar` | client | `{ menu: MenuItem[]; onOpenMenu() }` | pathname |
| `ConsoleNavList` | client | `{ menu; role; environment; inSheet?: boolean; onNavigate?() }` | — |
| `ConsoleSidebar` · `ConsoleMenuSheet` | client | `{ menu; role; environment }` · `+ { open; onClose() }` | — |
| `ConsoleForbidden` | client | `{ missing: string[]; role?: string }` | — |
| `ConsoleNotFound` | client | `{ backHref: string; backLabel: string }` | — |
| `StatusBadge` · `VoiceStatusBadge` · `TraceStatusBadge` · `StepStatusBadge` · `LoadedBadge` | client | `{ value }`(Voice 는 `+ enabled`) | — |
| `KeyValueList` | client | `{ items: { key: string; label?: string; value: unknown; mono?: boolean }[]; className? }` | — |
| `MonoId` · `CopyButton` | client | `{ value: string; copy?: boolean; label?: string }` | 토스트 |
| `ConsoleLoading` | client | `{ label?: string }` | — |
| `RefreshLine` | client | `{ loadedAt: number \| null; reloading: boolean; polling?: boolean; onReload() }` | — |
| `ChipRadio` · `ToggleButton` | client | `{ options; value; onChange; ariaLabel }` · `{ pressed; onToggle; children }` | — |
| `EngineTestPanel` | client | `{ connection: { id; key; role; connectionType; enabled }; onDone(r: TestResultDto \| null) }` | §6-3 |
| `TestResultCard` · `TraceRef` | client | `{ kind: HealthKind; result: TestResultDto; receivedAt: number }` · `{ traceId }` | — |
| `HealthHistoryList` | client | `{ connectionId: string; limit?: number; reloadKey?: number }` | kind 필터·목록 |
| `SecretsSheet` | client | `{ open; highlightRef?: string; connections: ConnectionDto[]; onClose() }` | 목록·로딩 |
| `DashboardScreen` · `RoleCard` · `ServiceEnvWarning` | client | `{}` · `{ item: OverviewRoleDto; llm?: OverviewDto['llm'] }` · `{}` | §6-3 |
| `RoleScreen` | client | `{ role: EngineRole }` | §6-3 |
| `VoicesScreen` · `VoiceCard` | client | `{}` · `{ voice: VoiceAdminDto }` | 필터·보관 포함 |
| `PluginsScreen` · `PluginDetailScreen` | client | `{}` · `{ id: string }` | — |
| `ConnectionsScreen` · `ConnectionCard` · `ConnectionDetailScreen` | client | `{}` · `{ conn: ConnectionDto }` · `{ id: string }` | §6-3 |
| `useAdminResource` | hook | `(path: string \| null, { pollMs? })` | §6-3 |
| `useEngineNames` | hook | `() → (engineId: string) => string` | 모듈 캐시 |
| `labels.ts` | 순수 | 역할·연결 방식·상태·Source·Editability·Trace·Voice·HealthKind 라벨, `ERROR_CODE_TEXT`·`SKIP_TEXT`·`PANEL_HELP`·`ENV_MESSAGE`(§6-8) | — |
| `format.ts` | 순수 | `formatAgo(iso, now)` · `formatMs(ms)` · `displayValue(key, v, type?)` · `flattenDot(obj)` · `modelLabel(runtime)` · `groupByPrefix(rows)` · `refName(v)` | — |
| `resultView.ts` | 순수 | `resultView(kind, r) → { badge; reason; hint; chips }` | — |
| `configEditor/EffectiveScreen` · `EffectiveRow` · `SourceBadge` · `SourceLegend` | client | `{}` · `{ row: EffectiveKeyDto; expanded; onToggle() }` · `{ source: ConfigSource }` · `{}` | §6-3 |
| `trace/DiagnosticsScreen` · `TraceRow` · `TraceDetailScreen` · `StepCard` | client | `{}` · `{ item: TraceListItemDto }` · `{ traceId: string }` · `{ step: TraceStepDto; totalMs: number }` | §6-3 |
| `settings/AdminConsoleEntry` | **server** | `{}` | — |
| `src/types/admin.ts` | 타입 | `Capability`(string) · `ClientConsoleAccess` · `MenuItem{path,label,sub,group}` · `OverviewDto`/`OverviewRoleDto` · `ConnectionDto`/`ConnectionDetailDto` · `HealthResultDto`/`FunctionalResultDto`/`TestResultDto` · `EngineHealthDto` · `FallbackPolicyDto` · `SecretRefDto` · `EffectiveDto`/`EffectiveKeyDto`/`EffectiveLayerDto` · `PluginDto`/`PluginDetailDto` · `VoiceAdminDto` · `TraceListItemDto`/`TraceDto`/`TraceStepDto` · 유니온 `EngineRole`·`EngineStatus`·`ConnectionType`·`ConfigSource`·`Editability`·`HealthKind`·`TraceKind`·`TraceStatus`·`VoiceStatus`·`Environment` | — |

재사용: `Sheet`·`Toast/useToast`·`Segmented`·`ui.tsx`(`Card`·`Btn`·`Badge`·`Section`·`SectionHeader`·`Field`·`ErrorBlock`)·`common/format`(`formatClock`·`formatListTime`)·`common/useNow`(`useNow`·`useCountdown`)·`common/errors`·`common/api`. `EmptyBlock`·`LoadingBlock`(ink3 글자)은 쓰지 않는다.

### 6-6. 생성/수정 파일 목록 (developer B)

신규
- `src/types/admin.ts` — 클라이언트 DTO(§6-5). 서버 모듈을 import 하지 않는다(소유 §6-11 ⑪)
- `src/app/(admin)/layout.tsx` — 서버, `dynamic = 'force-dynamic'`, `getConsoleAccess()` → `redirect`/`notFound()`/`ConsoleShell`
- `src/app/(admin)/admin/page.tsx` — `redirect('/admin/dashboard')`
- `src/app/(admin)/admin/{dashboard,llm,voices,plugins,connections,configuration,diagnostics}/page.tsx`
- `src/app/(admin)/admin/speech/{realtime,analysis,tts}/page.tsx` — `<RoleScreen role="REALTIME_STT" | "ANALYSIS_STT" | "TTS" />`(llm 은 `"LLM"`)
- `src/app/(admin)/admin/plugins/[id]/page.tsx` · `connections/[id]/page.tsx` · `diagnostics/traces/[traceId]/page.tsx`
- `src/components/admin/console/{ConsoleShell,ConsoleProvider,EnvStrip,ConsoleBar,ConsoleNavList,ConsoleSidebar,ConsoleMenuSheet,ConsoleForbidden,ConsoleNotFound,ConsoleLoading,StatusBadge,KeyValueList,MonoId,RefreshLine,ChipRadio,ToggleButton,EngineTestPanel,TestResultCard,HealthHistoryList,SecretsSheet,DashboardScreen,RoleCard,ServiceEnvWarning,RoleScreen,VoicesScreen,VoiceCard,PluginsScreen,PluginDetailScreen,ConnectionsScreen,ConnectionCard,ConnectionDetailScreen}.tsx`
- `src/components/admin/console/{useAdminResource,useEngineNames,labels,format,resultView}.ts`
- `src/components/admin/configEditor/{EffectiveScreen,EffectiveRow,SourceBadge,SourceLegend}.tsx`
- `src/components/admin/trace/{DiagnosticsScreen,TraceRow,TraceDetailScreen,StepCard}.tsx`
- `src/components/admin/console/__tests__/{format,resultView,labels}.test.ts`
- `src/components/settings/AdminConsoleEntry.tsx`

수정
- `src/app/(app)/settings/page.tsx` — `userCan(user.id, 'engine.read')` + `<AdminConsoleEntry />`(맨 아래)

화면이 기대는 developer A 의 공개 API(`@/modules/admin`): `getConsoleAccess()` · `requireConsolePage(cap)` · `userCan(userId, cap)` · `menu.ts` 값(§6-1). 이름이 달라지면 A 의 이름을 따른다.

### 6-7. 구현 순서

1. `types/admin.ts` · `labels.ts` · `format.ts` · `resultView.ts` + 단위 테스트(`displayValue` 의 경로·시크릿 가림, `resultView` 의 SKIPPED·UNAVAILABLE·TIMEOUT·PASSED 갈래, `formatAgo`·`formatMs`).
2. 셸: layout(A 의 `getConsoleAccess` 가 아직 없으면 같은 모양의 임시 스텁) · `ConsoleShell`·`Provider`·`EnvStrip`·`ConsoleBar`·`NavList`·`Sidebar`·`MenuSheet` · `/admin` redirect · `ConsoleForbidden`·`ConsoleNotFound`.
3. 공용: `useAdminResource` · 뱃지 류 · `KeyValueList` · `MonoId`/`CopyButton` · `RefreshLine` · `ChipRadio` · `ToggleButton`.
4. Connections 목록·상세 + `EngineTestPanel`·`TestResultCard`·`HealthHistoryList` + `SecretsSheet`(조각을 가장 많이 쓰는 화면부터).
5. `RoleScreen`(경로 4개) → Dashboard(폴링·주 연결 상태 확인).
6. Configuration(Effective).
7. Diagnostics(Health 기록·Trace 목록) + Trace 상세.
8. Voices · Plugins 목록·상세.
9. `/settings` 진입 행.
10. §6-9 자체 점검 — dev `localhost:3011`, USER·ADMIN·DEVELOPER·SUPER_ADMIN QA 계정 4개(G7).

### 6-8. 한국어 UI 문구

ⓐ 셸·권한·공통

| 자리 | 문구 |
|---|---|
| 콘솔 바 | AI Engine Console · {group} / {label} / ↩ 앱으로 (aria: 학습 앱으로 돌아가기) / (aria) 콘솔 메뉴 열기 |
| 메뉴 | 콘솔 메뉴(시트 제목) / 개요 · 엔진 · 자원 · 설정·진단 / ↩ 학습 앱으로 돌아가기 / 내 역할 {role} |
| 환경 띠 | 운영 환경 — 변경은 확인 절차를 거칩니다 / 개발 환경 — 운영과 분리된 설정 행을 봐요 / {env} 환경 |
| 403 | 이 화면을 볼 권한이 없어요 / 필요한 권한 {caps} · 내 역할 {role} / 역할은 소유자(SUPER_ADMIN)가 바꿀 수 있어요. / 대시보드로 |
| 콘솔 안 404 | 찾을 수 없어요 / 지웠거나 다른 환경의 항목일 수 있어요. 지금 환경은 {env} 이에요. / 연결 목록으로 · 플러그인 목록으로 · Trace 목록으로 |
| 목록 404 | 콘솔에 들어갈 권한이 바뀌었을 수 있어요. [설정으로] |
| 갱신 | 마지막 갱신 {HH:mm:ss} · 30초마다 새로 고침 / 다시 불러오기 / 불러오는 중… |
| 불러오기 실패 | {화면 이름} 정보를 불러오지 못했어요. [다시 시도] |
| 네트워크 | 연결하지 못했어요. 네트워크를 확인해 주세요. |
| 복사 | (aria) {이름} 복사 / 복사했어요 / 복사하지 못했어요 |
| 빈 값·가림 | 없음 / — / •••(숨김) / 서버 경로 · 표시하지 않음 |

ⓑ 상태 확인·기능 테스트

| 자리 | 문구 |
|---|---|
| 버튼 | 상태 확인 / 기능 테스트 / 확인 중… / 테스트 중… / {n}초 뒤 다시 |
| 도움말 HTTP | 상태 확인은 서비스가 응답하는지만 봐요(최대 5초). 기능 테스트는 실제로 한 번 실행해요(최대 30초). |
| 도움말 CLI(LLM) | 상태 확인은 실행 파일이 뜨는지 봐요. 기능 테스트는 짧은 JSON 질문을 한 번 보내요(30초에 한 번). |
| 도움말 ONDEVICE | 상태 확인은 서버에 있는 기기용 모델 파일 목록을 봐요. 기능 테스트는 휴대폰 안에서만 할 수 있어요(앱 기기 테스트는 나중에 열려요). |
| 꺼진 연결 | 꺼져 있는 연결이에요 — 켜기는 다음 단계(편집)에서 할 수 있어요. |
| 진행 | 상태 확인 중… {n}초 / 기능 테스트 중… {n}초 |
| 결과 머리 | {뱃지} 상태 확인 · {지연} · {방금} / {뱃지} 기능 테스트 · {지연} · {방금} |
| 응답 없음 안내 | 서비스가 꺼져 있으면 정상적인 결과예요. 서비스를 켠 뒤 다시 확인해 주세요. |
| 건너뜀 안내(`SKIP_TEXT`) | ONDEVICE: 휴대폰 안에서 도는 연결이라 서버에서는 테스트하지 않아요. / TEST_ASSET_PENDING·`E_TEST_INPUT_MISSING`: 테스트 자료가 아직 준비되지 않아 건너뛰었어요. / SERVICE_UNAVAILABLE: 서비스가 꺼져 있어 기능 테스트를 건너뛰었어요. |
| 연결 상태 갱신 | 연결 상태를 {상태}(으)로 바꿨어요 |
| Trace | trace {id} / Trace 보기 › |
| 409 진행 중 | 이미 실행 중이에요. 끝나면 아래 기록에 나타나요. |
| 409 꺼짐 | 꺼져 있는 연결이라 실행하지 않았어요. |
| 429 | {n}초에 한 번만 실행할 수 있어요. |
| 403 | 이 실행 권한이 없어요 ({caps}) |
| 404 | 연결을 찾을 수 없어요. 목록을 다시 불러와 주세요. |
| 500·네트워크 | 실행하지 못했어요. 잠시 뒤 다시 눌러 주세요. |
| 일괄 | 주 연결 상태 확인 / 모두 상태 확인 / 상태 확인 중 {i}/{n}… / {n}개 연결을 확인했어요 / {k}개는 실행하지 못했어요 |
| 기록 | 최근 결과 / 전체 · 상태 확인 · 기능 테스트 / 아직 실행한 기록이 없어요. [상태 확인]을 눌러 보세요. / 문제 없음 |

오류 코드 → 사유(`ERROR_CODE_TEXT` — 모르는 코드는 "실패했어요 ({code})")

| 코드 | 사유 |
|---|---|
| `E_HEALTH_CONNECTION_REFUSED` · `ECONNREFUSED` | 서비스에 연결할 수 없어요(연결 거부) |
| `E_HEALTH_TIMEOUT` · `E_TEST_TIMEOUT` · `ETIMEDOUT` | 응답이 없어요(시간 초과{detail.timeoutMs 있으면 ` ${초}초`}) |
| `E_HEALTH_HTTP_STATUS` | 서비스가 오류로 응답했어요(HTTP {httpStatus}) |
| `E_HEALTH_AUTH` · `E_TEST_AUTH` | 인증에 실패했어요 — 시크릿 참조를 확인하세요 |
| `E_HEALTH_CREDENTIAL_MISSING` | 시크릿 참조를 찾을 수 없어요 |
| `E_HEALTH_MODEL_NOT_LOADED` | 서비스는 켜졌지만 모델이 아직 올라오지 않았어요 |
| `E_HEALTH_MANIFEST_MISSING` · `E_HEALTH_MANIFEST_VERSION` | 기기용 모델 파일 목록이 없거나 버전이 달라요 |
| `ENOENT` | 실행 파일을 찾을 수 없어요 |
| `E_TEST_UPSTREAM` | 서비스 호출이 실패했어요 |
| `E_TEST_OUTPUT_INVALID` | 결과 형식이 기준에 맞지 않아요 |
| `E_TEST_ACCURACY` | 결과가 기준에 못 미쳐요{detail.cer 있으면 ` (CER ${cer})`} |
| `E_TEST_NOT_APPLICABLE` · `NOT_APPLICABLE` | (건너뜀) 휴대폰 안에서 도는 연결이라 서버에서는 테스트하지 않아요 |
| `E_TEST_INPUT_MISSING` | (건너뜀) 테스트 자료가 아직 준비되지 않았어요 |

ⓒ 화면별

| 화면 | 문구 |
|---|---|
| Dashboard | 엔진 역할 / 목소리 / 요청 기록 (24시간) / 사용 가능 {a} · 꺼짐 {d} · 가져오는 중 {i} / 회화 턴 {n} · 오류 {e} · p50 {s} · p95 {s} / 아직 상태 확인 안 함 / 상태 확인 {ago} / 예비 {n} / 모델 {m} / 이 역할에 연결이 없어요 / 음성 서비스 {svc} 가 {env1} 환경으로 보고했어요. 이 콘솔은 {env2} 이에요. |
| 역할 | 지금 쓰는 연결 / 연결 상세 › / 엔진 · 방식 · 모델 · 주소 · 마지막 확인 · 마지막 기능 테스트 · 상태 사유 / 예비 연결 순서 / (기본) / 예비 연결 없음 — 이 연결이 안 되면 이 기능을 쓸 수 없어요 / 실패하면 다음 연결로 한 번 다시 시도해요 / 실패해도 다른 연결로 넘기지 않아요 / 정책 꺼짐 / 정책 밖 연결 / 특정 작업에만 쓰여요: {tasks} / 라우터가 고르지 않아요 / 설정값 요약 / 설정 {n}개 / 설정값 전체 보기 › / 모델 단계 / 이 역할에 정책이 없어요 |
| Voices | (aria) 목소리 상태: 전체 · 사용 가능 · 꺼짐 · 오류 / 보관 포함 / 모델 · 화자 · 스타일 · 쓰는 사용자 {n}명 · 상태 사유 / 등록된 목소리가 없어요. |
| Plugins | 로드됨 / 로드 실패 / 등록 불일치 / 역할 · 연결 {n}개 · 방식 / ← 플러그인 목록 / 정보 · 기능(capabilities) · 초기화 오류 · 설정 키 ({n}) · 기본 설정 문서 · 펼쳐 보기 / 표시 이름 · 종류 · 버전 · 구현 클래스 · 연결 방식 · 스키마 버전 · 소스 파일 / 기본값 · 운영 민감 |
| Connections | 모두 상태 확인 / 시크릿 참조 / (aria) 역할 / {역할} 기본 · {역할} 예비 · 정책 밖 / 확인 {ago} · 확인 안 함 / ← 연결 목록 / 연결 정보 · 실행 설정 (runtime) · 로그 레벨 / 있는지 확인 / 꺼진 연결 — 라우터가 고르지 않아요 / {역할}의 기본 연결 · {역할}의 예비 연결 · 정책 밖 연결 / 설정 v{n} |
| 시크릿 시트 | 시크릿 참조 / 값은 보이지 않아요. 참조 이름·있는지·마지막 사용만 보여 줘요. 열 때마다 조회 기록(감사 로그)이 남아요. / 파일 · 환경 변수 / 있음 · 없음 / 사용 연결 {keys} / 마지막 사용 {ago} · 사용 기록 없음 / 연결에 걸린 시크릿 참조가 없어요. |
| Configuration | 대상 연결 / 스키마 v{n} / 해석 {HH:mm:ss} (캐시) / 출처 8층이란? / 키 검색 (예: timeout) (aria: 설정 키 검색) / (aria) 출처 / ⚠ 가려진 값 / env 가 덮고 있어요 / ← 사용 중 / 조건에 맞는 키가 없어요. / 대상을 찾을 수 없어요. / 위 층이 아래 층을 키 하나씩 덮어요. USER_SETTING·RUNTIME_OVERRIDE 는 이 화면(관리 설정)에는 보통 나오지 않아요. |
| Diagnostics | (aria) 진단 보기: Health 기록 · 요청 Trace / (aria) 연결 / (aria) 기간: 24시간 · 7일 · 30일 / (aria) 종류: 전체 · 회화 턴 · 기능 테스트 · 미리듣기 · 플레이그라운드 · E2E / (aria) 결과: 전체 · 정상 · 일부 실패 · 실패 / {n}건 · {n}건 이상 · 보관 90일 / 더 보기 / 이 조건의 기록이 없어요. |
| Trace 상세 | ← Trace 목록 / 환경 · 시각 · 대상 · 디버그 세션 · 사용자 / 단계 ({n}) / 모델 {m} / {n}번째 시도 / {from} 에서 넘어옴 / 캐시 {HIT\|MISS} |
| /settings | 관리자 / AI Engine Console / 엔진·연결 상태를 보고 테스트해요 |

ⓓ 라벨

| 값 | 라벨 |
|---|---|
| EngineRole `REALTIME_STT` / `ANALYSIS_STT` / `TTS` / `LLM` | Realtime STT · 실시간 음성 인식 / Analysis STT · 분석용 음성 인식 / TTS · 선생님 목소리 합성 / LLM · 대답·교정·레슨 생성 |
| 역할 설명 `ROLE_DESC` | 회화 중 학습자의 말을 바로 글자로 바꿔요. 기본은 휴대폰 안에서, 안 되면 서버에서. / 대화가 끝난 뒤 녹음을 다시 정확하게 받아 적어요(발음·교정 분석용). / 선생님 목소리로 문장을 읽어 줘요. / 선생님의 대답·교정·레슨·평가를 만들어요. |
| ConnectionType `ONDEVICE` / `HTTP` / `CLI` / `LOCAL` | 휴대폰(ONDEVICE) / HTTP 서비스 / 명령줄(CLI) / 로컬 작업자(LOCAL) |
| ConfigSource 1~8 | DEFAULT 스키마 기본값 · SOURCE_CODE 코드 상수 · APPLICATION_CONFIG 설정 파일(yml) · ENVIRONMENT 환경 변수 · DATABASE 콘솔 적용값 · CONNECTION_PROFILE 연결 프로필 · USER_SETTING 사용자 설정 · RUNTIME_OVERRIDE 임시 덮어쓰기 |
| Editability | READ_ONLY 읽기 전용 · RUNTIME_EDITABLE 즉시 반영 · RESTART_REQUIRED 재시작 필요 · REDEPLOY_REQUIRED 재배포 필요 · SECRET 시크릿(참조만) |
| HealthKind | HEALTH 상태 확인 · FUNCTIONAL 기능 테스트 |
| TraceKind | TURN 회화 턴 · PREVIEW 미리듣기 · PLAYGROUND 플레이그라운드 · E2E E2E · FUNCTIONAL_TEST 기능 테스트 |
| TraceStatus / 단계 status | OK 정상 · PARTIAL 일부 실패 · ERROR 실패 / OK 정상 · FAILED 실패 · TIMEOUT 시간 초과 · SKIPPED 건너뜀 · FALLBACK 예비로 넘김 |
| Environment | PRODUCTION 운영 · LOCAL 개발 · DEVELOPMENT 개발 서버 · STAGING 스테이징 |

### 6-9. 360/390/412 · 데스크톱 · 접근성 체크리스트

폭·배치
- [ ] 360·390·412 세 폭, 모든 콘솔 화면에서 가로 스크롤 0. 긴 값으로 확인: 64자 connection key, 긴 baseUrl, `env:KAIWA_CONN_…` sourceRef, 300자 initError, traceId, `6 CONNECTION_PROFILE` 배지, 긴 `runtime.allowedTasks`.
- [ ] 세로 스크롤은 `main` 하나(메뉴·시크릿 시트 안은 예외). 칩 줄은 가로 스크롤만, 스크롤바 숨김.
- [ ] 환경 띠·콘솔 바는 스크롤해도 늘 보인다(`main` 밖). 360 에서 띠 문구는 말줄임, 환경 이름·버전은 남는다.
- [ ] `KeyValueList` 가 카드 폭 <420 에서 위아래, ≥420 에서 두 칸.
- [ ] ≥1024: 사이드바 + 본문(최대 960px), ☰ 숨김. 카드 목록은 컨테이너 ≥640 에서 2열.
- [ ] 앱 WebView(≈390)에서 띠가 상태바 아래로 들어가지 않는다(`NativeFlag` + `[data-app-shell]` 24px 규칙).

터치·글자
- [ ] 행 링크 ≥56px, 버튼·칩·복사·☰·↩앱으로·펼침·"있는지 확인" 히트 ≥44px(칩·Segmented 는 세로 `::before`).
- [ ] 읽어야 하는 글에 `ink3`·`warn` 글자·`accent` 뱃지 글자 없음. DEGRADED 뱃지는 `text-ink`. 빈 상태에 `EmptyBlock`·`LoadingBlock` 을 쓰지 않는다.
- [ ] PRODUCTION 띠 글자(`text-surface` on `bg-bad`) 라이트·다크 ≥4.5:1.
- [ ] 일본어가 나오는 곳(기능 테스트 인식 결과)만 `lang="ja"`. 키·값·ref 는 모노 + `[overflow-wrap:anywhere]`, `break-keep` 은 한국어 문장에만.

권한·노출
- [ ] USER: `/admin`·`/admin/dashboard`·`/admin/plugins/x` 가 **없는 주소(`/zzz`)와 같은** 404(상태 코드·본문). `/settings` 에 "관리자" 섹션 없음(DOM·RSC 응답·JS 번들에 "AI Engine Console" 0건).
- [ ] ADMIN: 메뉴 9개(Plugins 없음), Diagnostics 에 Segmented 없음, `/admin/plugins` 직접 입력 → 콘솔 403 카드(메뉴·띠 유지), `/admin/diagnostics/traces/x` → 403 카드, Configuration 행에 펼침 없음, 결과 카드에 "Trace 보기" 없음.
- [ ] DEVELOPER·SUPER_ADMIN: 메뉴 10개, Trace 탭, Effective 층 펼침·`sourceRef`.
- [ ] 권한 없는 버튼은 DOM 에 없다(비활성으로 남지 않는다).
- [ ] 화면 렌더 텍스트와 콘솔 API 응답 전체에서 Secret 값 0 · 서버 절대 경로 0(`/home/`·`/Users/`·`/root/`) — `.env` 의 실제 비밀값 문자열로 grep(완료 기준 4).

동작
- [ ] 꺼진 서비스 연결(gateway :8100·M4 :8200)에서 [상태 확인] → 회색 결과 카드 + "응답 없음" 뱃지 + 안내. 빨간 ErrorBlock 아님, 500 없음.
- [ ] LLM [기능 테스트] 직후 30초 카운트다운. 강제로 429 를 만들면 `Retry-After` 초로 카운트다운.
- [ ] ONDEVICE 연결에 [기능 테스트] 버튼 없음 + 도움말 문구.
- [ ] 대시보드 폴링: 탭을 가린 동안 요청 0, 돌아오면 바로 갱신.
- [ ] 시크릿 시트를 열 때만 #101 이 나간다(목록·상세 진입만으로는 0건) → 열 때마다 AuditLog 1행(완료 기준 6).
- [ ] "모두 상태 확인"은 요청이 하나씩 순서대로 나간다(네트워크 탭에서 겹침 0).

접근성
- [ ] 메뉴 시트: `role=dialog aria-modal`, 제목 포커스, 닫으면 ☰ 로 포커스 복귀, Esc. 활성 메뉴 `aria-current="page"`.
- [ ] 뱃지는 글자로 뜻을 전한다(점 `aria-hidden`, `aria-label="상태: 정상(HEALTHY)"`).
- [ ] 테스트 진행·결과 `aria-live="polite"`, 실행 중 버튼 `aria-busy`. 칩 `role=radio aria-checked`, 보관 포함 `aria-pressed`, 펼침 `aria-expanded`.
- [ ] 포커스 링이 보인다(outline 제거 금지).

### 6-10. 주의사항

- **쓰기 0**(G2): 콘솔 화면에서 나가는 쓰기 요청은 #95·#96 두 가지뿐이다. 편집 폼·토글·저장 버튼을 "나중을 위해" 미리 그리지 않는다.
- **존재 비노출**: USER 가 보는 404 는 앱의 아무 없는 주소와 같아야 한다. `(admin)` 전용 `not-found.tsx`·전용 문구를 만들지 않고, layout 에서 `notFound()` 를 부르기 **전에** 콘솔 데이터(메뉴·환경)를 읽거나 렌더하지 않는다.
- **capability 는 서버가 진실**: `useCan` 은 숨김용이다. layout 은 클라이언트 이동 때 다시 돌지 않으므로 **페이지마다** `requireConsolePage` 를 부른다. capability 를 브라우저 저장소에 두지 않는다.
- **비밀·경로**: `credentialRef` 는 이름만, 존재 여부는 시크릿 시트(감사 기록)에서만. `detail`·`meta`·`sizes` 는 화이트리스트/표시 규칙을 거친다. 응답 전체를 덤프하는 "디버그 보기"를 만들지 않는다(플러그인 `defaultConfiguration` 은 스키마 기본값뿐이라 예외). `dangerouslySetInnerHTML` 금지.
- **엔진명**: 콘솔 안에서는 보여 준다. 대신 콘솔 컴포넌트를 `(app)` 화면에서 import 하지 않고(번들 분리), `/settings` 진입 행은 **서버 컴포넌트**로 둔다.
- **꺼진 서비스 = 정상 결과**: UNAVAILABLE 을 빨간 카드·오류 토스트로 만들지 않는다. 대시보드 카드 바탕도 바꾸지 않는다.
- **동시 요청**: 필터·대상 칩을 빨리 바꾸면 요청이 겹친다 — abort + 요청 번호 비교. 일괄 상태 확인은 **순서대로**(CLI spawn·M4 부하 — 병렬 금지).
- **PRODUCTION**: 띠는 어떤 화면에서도 숨기지 않는다. Phase 1 은 설정 쓰기가 없지만 PRODUCTION 에서 누른 테스트도 운영 `EngineHealth`·`RequestTrace` 에 남는다.
- **발음 사전**(01 표 P0)은 task-005b 에서는 G1 로 범위 밖이었고, task-003g 에서 §10 으로 열렸다(메뉴 "엔진 › 발음 사전" · TTS 역할 페이지 링크). 사전 화면만은 콘솔 안이어도 엔진·모델 이름을 쓰지 않는다(§10-0 ⑬).
- **오프라인**: 목록은 ErrorBlock + 다시 시도, 폴링은 다음 주기에 다시 시도한다. 테스트 실행 중 끊기면 ErrorBlock 이고, 결과는 나중에 "최근 결과"에서 확인된다.

### 6-11. Leader 확인 요청 (계약 불일치·해석·공백)

| # | 항목 | 화면이 가정한 것 | 틀리면 |
|---|---|---|---|
| ① | 403 본문 키 | role-permission §5·api-contract §2-19 대로 `data.details.missing: string[]`. 02 §5 의 `requiredCapability` 는 `missing` 이 없을 때만 대체로 읽는다 | 403 카드의 "필요한 권한"이 빈다 |
| ② | `secrets.read_ref` 보유 역할 | 정본 매트릭스(role-permission §3)대로 **ADMIN 이상**. admin-console/02 §3 표("SUPER_ADMIN 만")와 어긋남 → 정본을 따른다 | ADMIN 에게 [시크릿 참조]가 보였다가 403 |
| ③ | Voices 메뉴 capability | 01 §3·api-contract #82 대로 `voices.read`. role-permission §4-1·§4-2 는 `voices.manage` 로 적혀 있다(콘솔 사용자는 둘 다 가지므로 Phase 1 동작 차이는 없음) | 정본 한쪽 정리 필요. 화면은 `menu.ts` 값만 따른다 |
| ④ | #81 응답 모양 | api-contract 모양(`environment, appVersion, nodeEnv, protection, services`)을 쓴다. 16 §3 의 `policies/activeOverrides/pendingRestart` 는 안 쓴다. 01 §5 의 "Override 켜짐·개수"는 Override 가 Phase 4 라 띠에서 뺐다 | 띠에 Override 정보를 추가 |
| ⑤ | **SKIPPED 표현** | `EngineStatus` 에 SKIPPED 가 없다. 화면은 `ok:null` · `status:'NOT_APPLICABLE'\|'SKIPPED'` · `detail.skipped:true` · `E_TEST_INPUT_MISSING` 을 모두 SKIPPED 로 본다 → developer A 가 하나로 정하길 권장: `{ ok:null, status:'NOT_APPLICABLE', detail:{ reason:'ONDEVICE'\|'TEST_ASSET_PENDING'\|'SERVICE_UNAVAILABLE' } }`(speech-platform 10 §3.4 확장) | STT·TTS 테스트 자료가 없는 것이 "실패"로 보인다 |
| ⑥ | #102 모양 | api-contract 의 `keys[]`(04 의 `entries[]` 아님). **요청**: 모든 역할에 `shadowed: boolean` 을 실어 달라(ADMIN 은 `layers` 가 없어 화면이 계산 못 함 — 값·출처 이름뿐이라 민감하지 않음) | ADMIN 화면에 "⚠ 가려진 값"이 안 보인다 |
| ⑦ | **서버 경로 누출** | seed `claude-cli-local.connection.binPath = '$CLAUDE_CLI_PATH'` 를 resolver 가 env 로 풀면 **절대 경로가 #91a·#102 응답에 실린다** → `PATH` 타입 키는 값 대신 ref(`$CLAUDE_CLI_PATH`·`env:…`)만 응답하게(developer A·reviewer 확인). 화면은 `/` 로 시작하는 경로 값을 가리지만 방어선일 뿐 | 완료 기준 4 식 응답 grep 에서 `/home/…` 검출 |
| ⑧ | `effectiveSummary`(#91a) 모양 | `{ keys: number, bySource: Partial<Record<ConfigSource, number>> }` 가정 | 필드명만 맞추면 된다 |
| ⑨ | 모델 표시 | #91a 에 `model` 이 없어 화면이 `runtime.model → defaultModel → modelVersion → modelByTier` 순으로 고른다. A 가 `modelLabel` 을 주면 그걸 쓴다 | 연결마다 모델 표기가 들쭉날쭉 |
| ⑩ | #80 `traces24h` | ADMIN(`trace.read` 없음)에게는 화면이 숨긴다 → 서버도 빼 주기 권장(02 §4: 메트릭은 `trace.read`) | 응답에만 남는 경미한 권한 누수 |
| ⑪ | 화면↔서버 경계 | A 가 `@/modules/admin` 에 `getConsoleAccess()`(role·capabilities·environment·거른 menu) · `requireConsolePage(cap)`(console.access 없으면 notFound, 부족하면 `{ok:false, missing, role}`) · `userCan(userId, cap)` 를 공개. 응답 DTO 타입은 B 가 `src/types/admin.ts` 에 쓰고 A 의 응답이 맞춘다(병렬 작업 충돌 방지) | 소유자만 정해 주면 된다 — 이름은 A 기준으로 B 가 맞춤 |
| ⑫ | 모바일 메뉴 | 01 §7 "햄버거 드로어"를 **공용 `Sheet`(아래에서 올라옴)** 로 구현 — 한 손 조작·코드 재사용 | 왼쪽 드로어를 새로 만든다 |
| ⑬ | 슬롯 환경 색 | `DEVELOPMENT`·`STAGING` 의 "파랑"은 토큰이 없어 회색 윤곽(지금 쓰지 않는 슬롯). 새 색은 쓰일 때 합의 | — |
| ⑭ | `/settings` 요약 행 | speech-platform 14 §7 미결 1 → **콘솔 링크 한 줄만**(학습자 화면이 admin API 를 부르지 않게) | 요약을 원하면 서버 컴포넌트로 #80 일부를 읽어 추가 |
| ⑮ | 404 화면 | USER 의 `/admin` 404 = Next 기본 404(루트 `not-found.tsx` 없음, 영문). 존재 비노출에는 문제없다. 한국어 루트 404 는 앱 전체에 걸리므로 **별도 task** 제안 | — |
| ⑯ | 일괄 상태 확인 | 새 API 없이 #95 를 순서대로 N번(대시보드 = 역할 주 연결 4개, 연결 목록 = enabled 전부). 완료 기준 5(seed 전부 실행)를 화면에서도 할 수 있게 | 버튼을 뺀다 |
| ⑰ | IA 추가 경로 | `/admin/diagnostics/traces/[traceId]`(01 에 없음 — `diagnostics/[connectionId]` 는 Phase 3) · `/admin` → dashboard redirect. 01 §3 표 갱신 필요 | 경로를 `?trace=` 시트로 바꾼다 |
| ⑱ | Health 결과의 traceId | #95 응답 예시에 `traceId` 가 없다(#96 만 있음). Health 는 Trace 줄 없이 그린다 | Health 도 Trace 를 남긴다면 싣기만 하면 화면이 그린다 |

---

## 7. 음성(TTS) — 상태 표시등 · 미리듣기 (task-003d)

> 정본: `speech-platform/16` §5·§12 · `design-spec.md` §14 "TTS 실행 상태 표시등" · `api-contract.md` #18·§7 보완(`GET /api/v1/speech/tts/status`) · `speech-platform/04` §1(통합 미리듣기). 새 색 없음(§1-1 토큰만).

### 7-0. 한눈에 보는 결정

1. **표시등은 이번 task 에서 설정 → "AI 선생님 목소리" 카드 머리에 붙는다**(선생님 아바타 옆, 이름 아래 줄). 회화 화면(task-007)은 **같은 컴포넌트·같은 스토어를 그대로 쓴다** — 앱 전체에 상태 스토어는 하나다.
2. 5상태 = 점(10px) + **라벨 상시** + `role="status"` + `aria-label`. 색만으로 구분하지 않는다. Phase 1 의 빨간불은 **"자막만"(TEXT_ONLY) 하나**다. "온디바이스 모드"는 코드·문구만 두고 P2 까지 나오지 않는다.
3. 판정은 클라가 한다: `navigator.onLine` + `GET /api/v1/speech/tts/status` + 합성 결과 신호(미리듣기·task-007 의 SSE `audio`). 서버 응답의 `networkStatus` 는 쓰지 않는다(서버는 폰의 네트워크를 모른다).
4. 폴링: 온라인·정상 **5분**, 느림(DEGRADED)·자막만 **30초**. 화면이 가려지면 멈추고, 다시 보이면 주기가 지났을 때만 바로 확인. `offline` 이벤트는 즉시 "자막만", `online` 이벤트는 즉시 재확인("전환 중").
5. **토스트는 설정된 상태가 바뀔 때 1회**(온라인 ↔ 자막만). 첫 확인 결과(확인 중 → X)에는 토스트가 없다. 토스트는 스토어가 전환 1건당 한 번만 내보낸다.
6. 점을 누르면 **사유 시트** — 지금 상태·이유(사유 코드별 한국어)·인터넷·목소리 서버·마지막 확인 시각·[지금 다시 확인]. 엔진명·호스트·포트·연결 키는 **어디에도** 없다.
7. 미리듣기는 **통합 버튼 1개**("▶ 현재 설정으로 미리듣기", `speech-platform/04` §1 — 옵션·카드마다 버튼을 두지 않는다). 세 목소리는 카드를 골라 같은 버튼으로 듣는다. **다시 누르면 정지**, 설정을 바꾸면 재생을 멈추고 대기 중 결과를 버린다.
8. 오디오는 **탭 핸들러 안에서 동기로 `AudioContext` 를 깨운 뒤**(자동재생 정책) 받은 wav 를 재생한다. 응답은 `Accept: audio/wav` 본문으로 받는다(캐시 URL #24 에 의존하지 않음 — §7-11 ③).

### 7-1. 화면 개요

| 항목 | 내용 |
|---|---|
| 목적 | ① 선생님 목소리를 지금 들을 수 있는지(서버 음성 / 자막만)를 한눈에 ② 저장 전 설정으로 목소리를 들어 보고 고른다 |
| 진입 | 상단 아바타 → `/settings` → "AI 선생님 목소리" 섹션(§2 설정 행) |
| 역할별 가시성 | 로그인 사용자 전원. 관리자라도 이 화면엔 엔진 정보가 없다(엔진 상태는 콘솔 `/admin/speech/tts`) |
| 앱/웹 분기 | 없음. 네트워크 판정은 둘 다 `navigator.onLine` + `online`/`offline` 이벤트(WebView 도 동작) |
| 재사용 | task-007 회화방 헤더 `[←] (아바타) 이름 / ● 온라인` — 같은 `TtsRuntimeStatusIndicator` 를 두고 SSE `audio` 결과를 `reportSynthesis` 로 넣는다 |

### 7-2. UI 구조 (의사코드, 390px 기준)

#### A. 목소리 카드 머리 — `VoiceCardHead`(VoiceSettings 안)

```
Section
  SectionHeader "AI 선생님 목소리"                     ← 기존
  Card flex-col gap-3.5
    ┌ VoiceCardHead ─────────────────────────────┐
    │ (유)  유우                                   │  TeacherAvatar md(40px, accent-soft, 첫 글자) · 이름 15px semibold truncate
    │       ● 온라인 ›                              │  TtsRuntimeStatusIndicator (점 10px + 라벨 12px + › ink3)
    └──────────────────────────────────────────────┘
    <hr border-line>
    목소리 radiogroup · 말투 · 들려주는 방식 · 속도/높낮이/억양    ← 기존 그대로
    VoicePreviewButton   (w-full h-12, ghost)  "▶ 현재 설정으로 미리듣기"
    <p 12px ink2 id=preview-hint>  "Sakura · 친근 · 천천히 — 저장하지 않은 설정도 그대로 들려드려요"
    Btn primary w-full "저장"                                    ← 기존(BtnRow 두 칸 → 세로 두 줄)
  Toast (기존 useToast 하나 — 미리듣기 오류와 상태 전환 안내가 같은 자리를 쓴다)
```

- 이름은 `teacherName`(설정 #11, 비우면 "선생님") — `page.tsx`(서버)가 채팅방과 같은 방식(`getProfile().teacherName?.trim() || '선생님'`)으로 읽어 `VoiceSettings teacherName` prop 으로 넘긴다. 학습 설정에서 이름을 저장하면 `router.refresh()` 로 머리 이름이 바로 바뀐다(클라 상태는 유지됨).
- 미리듣기를 한 줄 전체 폭으로 내린 이유: "현재 설정으로 미리듣기"가 BtnRow 반 칸(360px 에서 ≈145px)에 들어가지 않는다.
- 목소리 목록 로딩 중엔 머리(표시등 포함)를 그리지 않는다(기존 `LoadingBlock`). 목소리 0개면 머리 + 기존 빈 문구.

#### B. 표시등 — `TtsRuntimeStatusIndicator`

```tsx
<button type="button" onClick={open} aria-haspopup="dialog"
  aria-label={`선생님 목소리 상태: ${label}. 눌러서 자세히 보기`}
  className="relative inline-flex max-w-full items-center gap-1.5 rounded text-[12px] leading-4
             before:absolute before:-inset-x-2 before:-inset-y-3.5 before:content-['']   /* 히트 44px */
             focus-visible:outline-2 focus-visible:outline-accent">
  <span aria-hidden className={DOT[state]} />                 {/* h-2.5 w-2.5 rounded-full flex-none */}
  <span role="status" className={LABEL[state]}>{label}</span>
  <span aria-hidden className="text-ink3">›</span>
</button>
<TtsStatusSheet open={…} … />
```

| 상태 | 점(`DOT`) | 라벨 색(`LABEL`) |
|---|---|---|
| ONLINE | `bg-good` | `text-ink2` |
| TEXT_ONLY | `bg-bad` | `text-bad`(라이트 ≈6.5:1 · 다크 ≈6.7:1) |
| ON_DEVICE (P2) | `bg-bad` | `text-bad` |
| SWITCHING | `bg-warn motion-safe:animate-pulse` | `text-ink2` |
| CHECKING | 속 빈 원 `border-2 border-ink3` (색·모양 모두 다름) | `text-ink2` |

- 점은 `aria-hidden` 보조 표시이고 뜻은 라벨이 전한다(warn 점 / surface 2.95:1 이어도 라벨이 있어 허용).
- 라벨·›는 `flex-none`(줄지 않음), 이름 줄만 `truncate`. 히트영역 `before:` 는 위(이름 줄 — 비대화형)와 아래(구분선까지 ≥14px)로만 나간다.

#### C. 사유 시트 — `TtsStatusSheet`(공용 `Sheet`, 제목 "선생님 목소리 상태")

```
● 자막만                                         ← 점 + 라벨 17px semibold
지금은 목소리를 만들 수 없어 자막만 보여 드려요.     ← 상태 설명(§7-8 ⓐ) 15px ink
복구되면 자동으로 다시 들려드려요.

<dl> (행 간격 12px, 라벨 13px ink2 / 값 15px ink)
  이유              목소리 서버에 연결할 수 없어요.      ← fallbackReason(§7-8 ⓑ) — TEXT_ONLY·SWITCHING 일 때만
  이렇게 해 보세요   서버가 점검 중일 수 있어요. 자동으로 다시 확인해요.
  인터넷            연결됨 | 끊김                         ← navigator.onLine
  목소리 서버        정상 | 느림 | 사용할 수 없음 | 확인 전 ← serverHealth
  마지막 확인        3분 전 (21:48) | 아직 확인 전         ← lastUpdatedAt (useNow 30초 틱)
  자동 확인         5분마다 | 30초마다
</dl>
[ 지금 다시 확인 ]   Btn ghost w-full h-12 — 확인 중엔 "확인하는 중…" disabled, 5초에 1회까지
```

- 시트엔 `executionMode` 원문·`connectionKey`·traceId·URL 이 없다. 오프라인이면 [지금 다시 확인]은 disabled + "인터넷에 연결되면 바로 확인해요".

#### D. 미리듣기 — `VoicePreviewButton`

| phase | 버튼 | 비고 |
|---|---|---|
| `idle` | ▶ 현재 설정으로 미리듣기 | 기본 |
| `loading` | (스피너) 목소리 만드는 중… · `disabled` `aria-busy` | 동시 1건(04 `E_PREVIEW_IN_FLIGHT`) |
| `playing` | ■ 정지 (`aria-label="미리듣기 정지"`) | 다시 누르면 정지 → idle |
| `blocked` | ▶ 눌러서 듣기 | 받은 소리를 브라우저가 막았을 때(`NotAllowedError`) — 이번 탭으로 바로 재생 |
| `cooldown` | ▶ {n}초 뒤에 다시 들을 수 있어요 · `disabled` | 429 `retryAfterSec`(`useCountdown`) |
| 오프라인 / 저장 중 | idle 문구 · `disabled` | 힌트 줄이 이유를 말한다(§7-8 ⓓ) |

- 저장 중엔 미리듣기만 막고, 재생 중에도 [저장]은 누를 수 있다(지금의 `busy` 하나를 `saving` 과 preview phase 로 나눈다).
- 힌트 줄(`aria-describedby`): "{목소리} · {말투 라벨} · {방식 라벨} — 저장하지 않은 설정도 그대로 들려드려요". 자막만 상태면 "지금은 선생님 목소리를 들을 수 없어요(자막만). 눌러 보면 다시 확인해요." — 버튼은 막지 않는다(누르면 재확인 신호가 된다).

### 7-3. 상태 관리

#### A. 상태 스토어 — `createTtsStatusStore(deps)` + 싱글턴 + `useTtsRuntimeStatus()`

- **앱 전체 1개**(모듈 싱글턴, `useSyncExternalStore`). 구독자가 생기면 시작, 0 이 되면 타이머 정지. 화면을 옮겨도 마지막 상태를 기억한다.
- 테스트 가능하게 팩토리 `deps = { fetchStatus(signal), isOnline(), now(), setTimer/clearTimer }` 로 만들고 싱글턴은 그 인스턴스 하나.
- 스냅샷: `{ state, reason, serverHealth, networkOnline, lastUpdatedAt, checking: boolean, pollMs }`

**판정 `derive()`**

| 입력 | 결과 state | reason |
|---|---|---|
| `isOnline() === false` | TEXT_ONLY (P2: 온디바이스 있으면 ON_DEVICE) | OFFLINE |
| 기억한 상태 없음 + 첫 조회 진행 중 | CHECKING (≤3s) | — |
| `executionMode = SERVER` | ONLINE (`serverHealth=DEGRADED` 면 폴링 30초) | — |
| `executionMode = TEXT_ONLY` | TEXT_ONLY | `fallbackReason ?? 'NO_CONNECTION'` |
| `executionMode = ON_DEVICE` | ON_DEVICE (Phase 1 서버는 보내지 않음 — 방어용) | `fallbackReason` |
| 상태 조회 자체 실패(네트워크·5xx·3초 타임아웃) | **1회째는 직전 상태 유지** + 30초 뒤 재시도(CHECKING 중이면 3초 뒤 1회), **연속 2회째** TEXT_ONLY | NO_CONNECTION |

**트리거**

| 사건 | 동작 |
|---|---|
| 첫 구독 | 기억한 상태가 없으면 CHECKING + 조회. 있으면 그대로 보이고, 주기가 지났으면 조용히 조회 |
| 폴링 타이머 | 조용히 조회("전환 중"을 띄우지 않음). 결과가 다르면 바로 새 상태 + 토스트 |
| `visibilitychange` | hidden → 타이머 정지 · visible → 주기 지났으면 조용히 조회, 아니면 남은 시간으로 예약 |
| `offline` | 즉시 TEXT_ONLY(OFFLINE) + (직전 ONLINE 이면) 토스트 |
| `online` | **SWITCHING** + 즉시 조회 |
| `recheck()`(시트 버튼·아래 합성 신호) | **SWITCHING** + 즉시 조회 |
| `reportSynthesis({ok:true, cacheHit:false})` | 실패 카운터 0. 현재 TEXT_ONLY 면 `recheck()` |
| `reportSynthesis({ok:true, cacheHit:true})` | 변화 없음(캐시 재생은 상태를 바꾸지 않는다 — 16 §12.2) |
| `reportSynthesis({ok:false, status:422})` | 즉시 `recheck()`(서버가 "지금 합성 불가"라고 답함) |
| `reportSynthesis({ok:false, status:502\|504\|0})` | 카운터+1, **연속 2회**면 `recheck()`(16 §12.2 히스테리시스) |
| 429 · 400 | 무시(상태와 무관) |

- **SWITCHING 표시**: 최소 600ms(깜빡임 방지) ~ 조회가 끝날 때까지(3초 타임아웃 → 조회 실패 규칙).
- **토스트**: 설정된 상태가 {ONLINE, TEXT_ONLY, ON_DEVICE} 사이에서 바뀔 때만 스토어가 `announce(message)` 를 1회 낸다(`transitionSeq` + 처리 표시 — 표시등이 둘 붙어도 한 번). CHECKING → X 는 조용하다. 지속 4초(`onAnnounce` 로 화면의 `toast.show(msg, 4000)`).
- 대화 중(task-007)에는 합성 결과가 곧 신호이므로 회화방이 **턴 진행 중에만** `pause(true)` 로 폴링을 멈추고(턴이 끝나면 `pause(false)` — 방에 머무는 동안 복구도 폴링으로 잡는다) SSE `audio{status, runtime.executionMode}` 를 `reportSynthesis` 로 넣는다(`TEXT_ONLY` 는 422 신호 → 재확인). 매핑 표는 §9-3 F.

#### B. 미리듣기 — `useVoicePreview({ onError, onSignal })`

```
toggle(draft)   ← 반드시 onClick 안에서 동기로 호출
  playing  → stop() → idle
  blocked  → playPending()  (이번 탭 제스처로 재생)
  idle     → unlockTtsAudio()               ← 동기! 첫 await 앞에서
             phase=loading, key=draftKey(draft), ac=new AbortController(10s)
             res = await apiPostAudio('/api/v1/voices/preview', draft, {signal})
             if (key !== 현재 draftKey) → 버리고 idle      (그 사이 설정을 바꿈)
             onSignal({ok:true, cacheHit: res.cache === 'HIT'})
             try playWav(res.data) → playing, ended → idle
             catch NotAllowedError → blocked(버퍼 보관) · 그 외 → onError(재생 실패) → idle
  오류: ApiError.status 로 분기(§7-8 ⓔ) · 429 → cooldownUntil = now + retryAfterSec·1000
        422/502/504/0 → onSignal({ok:false, status})
invalidate()  ← draft 가 바뀌는 모든 onChange 에서: 재생 정지 + 대기 중 요청 abort + blocked 버퍼 폐기
unmount · visibilitychange(hidden) → stop()
```

- `ttsAudio.ts`: 싱글턴 `AudioContext`. `unlockTtsAudio()` = 없으면 생성, `suspended` 면 `resume()` — **탭 핸들러 안 동기 호출**이 핵심(Chrome 자동재생 정책·안드로이드 WebView `mediaPlaybackRequiresUserGesture` 둘 다 제스처 안에서 깨운 컨텍스트는 이후 재생 허용; 실기기 WebView 확인은 003f/007). `playWav(buf)` = `decodeAudioData` → `BufferSource.start()`, 반환 `{ stop(), ended }`, 컨텍스트가 `running` 이 아니면 `NotAllowedError`. `AudioContext` 가 없는 환경만 `HTMLAudioElement` + `URL.createObjectURL`(정지·종료 시 `revokeObjectURL`). task-007 `TtsPlaybackQueue` 가 같은 컨텍스트를 쓴다(청크 사이 gap 을 정확히 줄 수 있음).
- `useEffect`·타이머에서 처음 재생을 시작하지 않는다(제스처 밖이라 WebView 에서 막힌다).

### 7-4. API 호출 계획

| # | 엔드포인트 | 메서드 | 파라미터 | 사용 필드 | 에러 처리 |
|---|---|---|---|---|---|
| 11 | (서버 컴포넌트) `getProfile(userId)` | — | — | `teacherName` | 없음 → "선생님" |
| 17·13·14 | `/api/v1/voices` · `/api/v1/settings/voice` | GET·PUT | 기존 | 기존 | 기존(task-005) |
| 18 | `/api/v1/voices/preview` | POST, **`Accept: audio/wav`** | draft `{voiceProfileId, style, styleWeight, speed, pitch, intonation}` (+`speechProfile` — §7-11 ①) | 본문 wav(ArrayBuffer) · 헤더 `X-Tts-Cache: HIT\|MISS`(§7-11 ③) | 422·429(`details.retryAfterSec` → `Retry-After`)·502·504·0 → §7-8 ⓔ + 상태 신호 |
| §7 보완 | `/api/v1/speech/tts/status` | GET | — | `executionMode`·`serverHealth`·`fallbackReason`·`lastUpdatedAt` (`networkStatus` 무시) | 3초 타임아웃, 실패 규칙 §7-3 A. 401 → api.ts 로그인 이동 |

- `common/api.ts` 에 `apiPostAudio(path, body, opts)` 추가 → `{ data: ArrayBuffer, cache: 'HIT'|'MISS'|null }`. 2xx 가 아니면 **기존 `send` 의 봉투 파싱·`ApiError` 생성을 그대로 재사용**(함수로 추출), `X-Client-Platform` 헤더도 동일.
- 응답 DTO 타입 `TtsStatusResponse` 는 `src/types/tts.ts` 에 두고 서버 라우트와 공유한다(`components/**` 는 `@/modules/speech` 를 import 하지 않는다 — 서버 코드가 번들에 들어온다).

### 7-5. 컴포넌트 분해 (`src/components/speech/*`)

| 이름 | 종류 | props / 반환 | 상태 |
|---|---|---|---|
| `TtsRuntimeStatusIndicator` | 컴포넌트 | `{ onAnnounce?: (msg: string) => void; className?: string }` | 시트 열림 |
| `TtsStatusSheet` | 컴포넌트 | `{ open; onClose; snapshot; onRecheck }` | 없음(스냅샷 표시만) |
| `useTtsRuntimeStatus` | 훅 | → `{ snapshot, recheck(), reportSynthesis(r), pause(b) }` | 스토어 구독 |
| `ttsStatusStore.ts` | 로직 | `createTtsStatusStore(deps)`·`ttsStatusStore`(싱글턴)·`derive()` | 상태기계 |
| `ttsStatusCopy.ts` | 문구 | 상태 라벨·설명·사유·토스트(§7-8) — task-007 재사용 | — |
| `VoicePreviewButton` | 컴포넌트 | `{ phase; cooldownSec; disabled; onClick; describedBy }` | 없음 |
| `useVoicePreview` | 훅 | `{ onError, onSignal }` → `{ phase, cooldownSec, toggle(draft), stop(), invalidate() }` | phase·버퍼·AbortController |
| `ttsAudio.ts` | 로직 | `unlockTtsAudio()`·`playWav(buf)`·`stopAllTts()` | 싱글턴 AudioContext |
| `common/TeacherAvatar` | 컴포넌트 | `{ name; size?: 'sm'(28) \| 'md'(40) }` — 채팅 `MessageBubble` 의 것을 옮김 | — |

### 7-6. 생성/수정 파일 목록

| 구분 | 파일 |
|---|---|
| 생성 | `src/components/speech/{TtsRuntimeStatusIndicator.tsx, TtsStatusSheet.tsx, ttsStatusStore.ts, ttsStatusCopy.ts, VoicePreviewButton.tsx, useVoicePreview.ts, ttsAudio.ts}` |
| 생성 | `src/components/speech/__tests__/ttsStatusStore.test.ts` — derive 표 전 행 · 조회 실패 1회 유지/2회 TEXT_ONLY · 502 연속 2회 → recheck · 캐시 HIT 무변화 · 토스트 전환당 1회(CHECKING→X 는 0회) · 폴링 주기 5분/30초 선택 |
| 생성 | `src/components/common/TeacherAvatar.tsx` · `src/types/tts.ts` |
| 수정 | `src/components/settings/VoiceSettings.tsx`(머리·미리듣기 훅·busy 분리·`teacherName` prop·onChange 마다 `invalidate()`) · `src/app/(app)/settings/page.tsx`(teacherName) · `src/components/settings/LearningSettings.tsx`(저장 성공 후 `router.refresh()`) |
| 수정 | `src/components/common/api.ts`(`apiPostAudio`) · `src/components/common/Toast.tsx`(`show(msg, ms?)` 선택 인자, 기본 2600 유지) · `src/components/chat/MessageBubble.tsx`(`TeacherAvatar` import 로 교체, 모양 동일) |

### 7-7. 구현 순서

1. 공용: `TeacherAvatar` 이동 · `Toast` 지속시간 인자 · `apiPostAudio` · `types/tts.ts`.
2. `ttsStatusCopy` → `ttsStatusStore`(+테스트) → `useTtsRuntimeStatus`.
3. `TtsRuntimeStatusIndicator` + `TtsStatusSheet` — 서버 라우트가 아직이면 단위 테스트의 가짜 `fetchStatus` 로 5상태를 확인한다(화면에 개발용 쿼리 파라미터·스위치를 만들지 않는다).
4. `ttsAudio` → `useVoicePreview` → `VoicePreviewButton`.
5. `VoiceSettings` 결합 · `page.tsx` · `LearningSettings`.
6. 실서버: M4 정상 🟢 → M4 중지 후 미리듣기 2회 또는 30초 폴링 → 🔴 자막만 + 토스트 1회 → M4 재기동 → 🟢 + "다시 연결" 토스트(완료 기준 8). 세 목소리 소리 확인·11회째 429(완료 기준 7).

### 7-8. 한국어 UI 문구

ⓐ **상태 라벨 · 시트 설명**

| 상태 | 라벨(점 옆·`aria-label`) | 시트 설명 |
|---|---|---|
| ONLINE | 온라인 | 선생님 목소리를 서버에서 만들어 들려드리고 있어요. |
| TEXT_ONLY | 자막만 | 지금은 목소리를 만들 수 없어 자막만 보여 드려요. 복구되면 자동으로 다시 들려드려요. |
| ON_DEVICE (P2) | 온디바이스 모드 | 서버 대신 이 기기에서 목소리를 만들고 있어요. 서버 음성과 조금 다르게 들릴 수 있어요. |
| SWITCHING | 전환 중 | 연결 상태가 바뀌어 확인하고 있어요. 잠시만 기다려 주세요. |
| CHECKING | 상태 확인 중 | 선생님 목소리를 쓸 수 있는지 확인하고 있어요. |
| (aria-label) | 선생님 목소리 상태: {라벨}. 눌러서 자세히 보기 | |

ⓑ **사유 코드**(TEXT_ONLY·SWITCHING 일 때 "이유" / "이렇게 해 보세요")

| 코드 | 이유 | 이렇게 해 보세요 |
|---|---|---|
| `SERVER_ERROR` | 목소리 서버에서 오류가 났어요. | 자동으로 다시 확인하고 있어요. 대화는 자막으로 계속할 수 있어요. |
| `SERVER_TIMEOUT` | 목소리 서버의 응답이 너무 늦어요. | 잠시 뒤 자동으로 다시 확인해요. |
| `NO_CONNECTION` | 목소리 서버에 연결할 수 없어요. | 서버가 점검 중일 수 있어요. 자동으로 다시 확인해요. |
| `OFFLINE` | 인터넷에 연결되어 있지 않아요. | Wi-Fi 나 모바일 데이터를 확인해 주세요. 연결되면 바로 다시 확인해요. |
| (없음) | 지금은 목소리를 만들 수 없어요. | 자동으로 다시 확인해요. |

ⓒ **시트 행 · 토스트**

| 자리 | 문구 |
|---|---|
| 행 라벨 | 이유 · 이렇게 해 보세요 · 인터넷 · 목소리 서버 · 마지막 확인 · 자동 확인 |
| 값 | 연결됨 / 끊김 · 정상 / 느림 / 사용할 수 없음 / 확인 전 · 방금 / {n}분 전 ({HH:mm}) / 아직 확인 전 · 5분마다 / 30초마다 |
| 버튼 | 지금 다시 확인 / 확인하는 중… / (오프라인) 인터넷에 연결되면 바로 확인해요 |
| 토스트 → 자막만 | 서버 연결이 원활하지 않아 지금은 자막만 표시합니다. 음성은 복구되면 다시 재생돼요. |
| 토스트 → 온라인 | 서버 음성으로 다시 연결되었습니다. |
| 토스트 → 온디바이스(P2) | 서버 연결이 원활하지 않아 온디바이스 모드로 전환했습니다. |

ⓓ **미리듣기 버튼 · 힌트** — 버튼은 §7-2 D 표. 힌트: 기본 "{목소리} · {말투} · {방식} — 저장하지 않은 설정도 그대로 들려드려요" · 자막만 "지금은 선생님 목소리를 들을 수 없어요(자막만). 눌러 보면 다시 확인해요." · 오프라인 "인터넷에 연결되면 들을 수 있어요."

ⓔ **미리듣기 오류(토스트, HTTP status 로 분기 — 서버 `message` 는 400 에만)**

| status | 문구 |
|---|---|
| 422 | 선생님 목소리 서버가 준비 중이에요. 잠시 후 다시 들어 보세요. |
| 429 | 미리듣기는 1분에 10번까지예요. {n}초 뒤에 다시 들어 보세요. |
| 502 | 목소리를 만들다가 문제가 생겼어요. 다시 눌러 주세요. |
| 504 | 목소리 서버 응답이 늦어요. 잠시 후 다시 눌러 주세요. |
| 0 | 연결하지 못했어요. 네트워크를 확인해 주세요. |
| 재생 실패(디코드 등) | 소리를 재생하지 못했어요. 다시 눌러 주세요. |

### 7-9. 360/390/412 · 접근성 체크리스트

- [ ] 360: 머리 행 = 아바타 40 + 간격 12 + 이름 열(truncate). 가장 긴 라벨 "온디바이스 모드 ›"·"상태 확인 중 ›"가 한 줄, 잘리지 않음.
- [ ] 표시등 히트 44px(`before:`), 아래 목소리 카드와 겹치지 않음(구분선까지 ≥14px). 포커스 링 보임, Enter/Space 로 시트, Esc 로 닫고 포커스가 표시등으로 돌아옴(공용 `Sheet`).
- [ ] 흑백 화면에서도 5상태가 라벨·모양(속 빈 원 = 확인 중, 깜빡임 = 전환 중)으로 구분됨.
- [ ] `prefers-reduced-motion`: 전환 중 깜빡임·버튼 스피너 멈춤("…" 정적).
- [ ] 미리듣기 버튼 h-12 전폭, 360 에서 "▶ 현재 설정으로 미리듣기" 한 줄. 힌트는 `aria-describedby`.
- [ ] 시트 하단 safe-area(공용 `Sheet`), 스크롤은 시트 내부 한 곳(내용이 짧아 보통 없음).
- [ ] 화면 세로 스크롤 1곳 유지(설정 페이지 `main`), 토스트가 하단 탭에 가리지 않음(기존 위치).
- [ ] 다크 모드: `text-bad`·`bg-good`·`bg-warn`·`border-ink3` 토큰만 — 하드코딩 색 0.

### 7-10. 주의사항

- **엔진명 0**: 화면·`aria-label`·토스트·콘솔 로그에 `style-bert`·`M4`·호스트·포트·`:8200`·`connectionKey`·traceId 를 싣지 않는다. #23·SSE `audio` 의 `runtime.connectionKey` 는 **읽지도 저장하지도 않는다**(§7-11 ⑤).
- **자동재생**: 첫 재생은 반드시 탭 제스처 안에서 `unlockTtsAudio()` 후. 막히면 `blocked` 로 한 번 더 누르게 한다(오류 토스트 아님).
- **draft 불일치 금지**: 소리가 나는 동안 설정을 바꾸면 즉시 정지. 늦게 온 응답이 바뀐 설정 뒤에 재생되면 사용자는 새 설정 소리로 착각한다.
- **요청 절약**: 폴링은 표시등이 떠 있는 동안에만(구독 0 이면 정지). 미리듣기는 10/분이라 카드 선택만으로 재생하지 않는다.
- **pitch/intonation 미지원 판명 시**(16 §16 ①): 해당 슬라이더를 숨긴다 — 서버가 알려 줄 자리가 필요하면 Leader 판단.
- 저장하지 않고 떠나도 경고하지 않는다(기존 동작 유지).

### 7-11. Leader 확인 요청

| # | 항목 | 화면이 가정한 것 | 틀리면 |
|---|---|---|---|
| ① | **미리듣기에 "들려주는 방식" 반영** | #18 body 에 `speechProfile`(NATIVE·LEARNING_NORMAL·LEARNING_SLOW) 추가, 서버가 적용(캐시 키 12요소에 이미 포함). 현 라우트는 주석으로 무시 중. LEARNING_SLOW 속도는 저장된 `learningSpeed`(없으면 0.8) | 힌트에서 방식을 빼고 "들려주는 방식은 회화에서 적용돼요" 한 줄 — "천천히"를 골라도 미리듣기가 빠른 이유를 설명해야 한다 |
| ② | 카드별 ▶ | 정본 `speech-platform/04` §1("옵션마다 버튼을 두지 않는다")·designer 원칙 6 에 따라 **통합 버튼 1개**. 세 목소리 = 카드 선택 → 같은 버튼(완료 기준 7 도 이 동작으로 확인) | 카드별 ▶ 가 꼭 필요하면 "그 카드 선택 + 같은 draft 재생"으로만 추가(별도 샘플 개념 없이) |
| ③ | 미리듣기 응답 경로 · 헤더 | `Accept: audio/wav` 본문 사용 → #24 캐시 URL 불필요(Codex C1 3번째 지적과 무관하게 동작). **`X-Tts-Cache: HIT\|MISS` 헤더**를 실어 달라(04 에는 있고 #18 에는 없음) | 헤더가 없으면 미리듣기 성공을 복귀 신호로 못 써서 복귀가 폴링(30초)에만 의존 |
| ④ | 422 코드 이름 | #23 은 `TTS_UNAVAILABLE`, `ApiErrorCode` 엔 `ENGINE_UNAVAILABLE` 만 있다. 화면은 **HTTP status 로만** 분기하므로 동작 무관 | 정본 표기 통일만 |
| ⑤ | **사용자 응답의 `runtime.connectionKey`** | #23 JSON·SSE `audio` 예시의 `"connectionKey": "style-bert-m4"` 는 엔진명이 사용자 응답에 실리는 것 → 완료 기준 10 위반. 사용자 라우트에선 빼거나(권장) 불투명 값으로 | QA 응답 grep 에서 `style-bert` 검출 |
| ⑥ | 공용 변경 3건 | `Toast` 지속시간 선택 인자(정본 ≤4s, 현 2.6s 고정) · `TeacherAvatar` 를 chat → common 이동 · `LearningSettings` 저장 후 `router.refresh()` | 각각 토스트가 짧게 사라짐 · 아바타 중복 코드 · 이름 변경이 새로고침 전까지 안 보임 |
| ⑦ | 상태 조회 실패의 표현 | 앱 서버 자체 불통(상태 조회 연속 2회 실패)도 "자막만(NO_CONNECTION)" | 별도 상태가 필요하면 정본 5상태 밖이라 사용자 합의 |

---

## 8. 음성 인식 — 마이크 테스트 (task-003e)

> 정본: `api-contract.md` #19·#20·§2-29(#142 `/ws/speech` `v:1`)·§0-3(WS 티켓) · `module-dependency.md` §2 L4(speech/stt 클라 export)·§3-1 규칙 5 · `design-spec.md` §9·§11(푸시투토크 ≥64px). 새 색 없음(§1-1 토큰만). 톤은 §7 과 같다(라벨 상시·색만으로 구분하지 않음·엔진명 0).

### 8-0. 한눈에 보는 결정

1. **위치**: 설정 → "음성 인식" 절의 모드 카드 **아래 두 번째 카드 "마이크 테스트"**. 점검용이다. task-007 회화 화면은 **같은 `PushToTalkButton`·`useRealtimeStt`·`sttCopy`**와 같은 `createRealtimeSttClient` 를 그대로 쓴다(화면 배치만 다름).
2. **입력 = 푸시투토크(누르고 있는 동안 녹음) 하나, 72px 원형 버튼.** 이유: ① task-007 회화와 같은 손동작을 여기서 미리 익힌다 ② 발화 끝 = 손 뗌 = WS `stop`(#142 "푸시투토크 놓음")이라 끝이 분명하고 자동 정지 타이머·끝점 대기가 필요 없다 ③ 정지를 잊어 마이크가 켜진 채 남는 일이 없다(개인정보·서버 저장). 누르는 동안 동작하는 것이 기능의 본질이라 WCAG 2.5.2 예외(무전기형)에 해당한다. 탭 시작/정지의 장점(권한 프롬프트와 안 겹침)은 아래 ③ 규칙으로 대신 얻는다.
3. **첫 누름 = 권한만**: 권한이 아직 없으면 그 누름은 권한 요청만 하고 녹음하지 않는다(프롬프트가 떠 있는 동안 손을 떼므로). 허용 뒤 "이제 누른 채로 말해 보세요". 설정 화면에 들어오는 것만으로는 권한을 묻지 않는다(마운트 시 `getUserMedia` 금지).
4. **누르는 즉시 녹음**: 연결(티켓·WS) 전 프레임은 클라가 최대 3초 버퍼했다가 `start` 직후 보낸다 — 첫 음절을 잃지 않는다. 연결은 1.5초를 넘길 때만 상태 줄에 보인다.
5. **결과**: partial = `text-ink2`(회색, 5.4:1) + 끝 "…", final = `text-ink`. 일본어 17px/1.7 `lang="ja"`. 누를 때마다 비우고 새로 쓴다. 저장·목록 없음(메모리에만, 카드를 떠나면 사라짐).
6. **레벨 미터 채택**(5칸, `aria-hidden`): "마이크가 소리를 받는가"를 서버와 따로 보여 주는 것이 점검의 핵심이다. 녹음 중 3초 넘게 거의 무음이면 힌트.
7. **오류는 카드 안 인라인 `role="alert"`**(권한 거부처럼 따라 해야 하는 안내가 길어 토스트 부적합). 가벼운 힌트는 상태 줄(빨강 아님).
8. **`aria-live` 는 final 만 낭독**. partial·"듣고 있어요" 는 낭독하지 않는다 — 녹음 중 스크린리더 음성이 마이크로 들어간다.
9. **엔진명·서버 주소 0**: 클라이언트가 `ready.engine/model`·`final.engine`·`traceId`·`sessionId` 를 이벤트로 올리지 않고 버린다. 경로 안내는 모드 카드와 같은 말("서버에서 / 휴대폰에서 바로 알아들어요").
10. **점검 발화 저장 여부는 Leader 확인**(§8-11 ①). 화면 문구는 결정에 따라 A/B 한 줄만 바뀐다.

### 8-1. 화면 개요

| 항목 | 내용 |
|---|---|
| 목적 | 마이크 권한·입력 소리·서버 인식이 되는지 말해 보고 바로 확인한다(인식 결과는 점검용) |
| 진입 | 상단 아바타 → `/settings` → "음성 인식" 절(§2 설정 행) |
| 역할별 가시성 | 로그인 사용자 전원, 관리자도 같은 화면(엔진 상태는 콘솔 `/admin/speech/realtime`) |
| 앱/웹 분기 | 웹 = 항상 서버 경로(`kind:'GATEWAY'`). 앱(003f) = `createRealtimeSttClient` 가 온디바이스를 고르면 `kind:'ONDEVICE'` — 화면은 경로 안내 한 줄·권한 거부 조치 줄만 달라진다 |
| 재사용 | task-007 회화방 입력 바: `PushToTalkButton`(같은 크기·제스처) + `useRealtimeStt({purpose:'TURN', chatId, onFinal})`, partial 은 목록 꼬리의 부분 인식 말풍선으로(§9-2 E) |

### 8-2. UI 구조 (의사코드, 390px 기준)

#### A. 카드 배치 — `SpeechSettings` 안

```
Section
  SectionHeader "음성 인식"                               ← 기존
  (모드 로딩/오류/Card radiogroup)                        ← 기존. early return 을 이 블록 안으로 옮겨
  MicTestCard                                              ← 모드 조회가 실패해도 테스트 카드는 보이게
```

#### B. `MicTestCard` (Card, `mt-3 flex flex-col gap-3`)

```
h4  "마이크 테스트"                                        15px semibold ink
p   "버튼을 누른 채로 일본어로 말해 보세요. …"              13px ink2 break-keep
p   "지금은 서버에서 알아들어요."                            12px ink2 ← pathCaption(kind)
div TranscriptBox  rounded-xl bg-surface2 p-3 min-h-[96px]
      비었을 때: "여기에 알아들은 말이 나와요 · 예) <span lang=ja>こんにちは</span>"   13px ink3(placeholder 전용)
      있을 때:  <p lang="ja" class="text-[17px] leading-[1.7] whitespace-pre-wrap [overflow-wrap:anywhere] min-w-0">
                  {committed 들(줄바꿈)}<span class="text-ink2">{partial 세그먼트 이어붙임}<span aria-hidden>…</span></span>
div flex-col items-center gap-2 pt-1
  PushToTalkButton                                       72×72
  p#mic-status  13px ink2 min-h-5 text-center              ← 상태 줄 · 힌트(§8-8 ⓑⓒ)
  MicLevelMeter  h-6                                      ← 녹음 중에만 보임(invisible), 자리는 항상 차지 — 흔들림 0
MicTestAlert (오류 때만)  role=alert rounded-xl bg-bad-soft px-3.5 py-3 13px text-bad break-keep
      1줄 무엇 · 2줄 어떻게(§8-8 ⓐ)
p   저장 안내(§8-8 ⓓ)                                      12px ink2
p.sr-only aria-live="polite" aria-atomic                  ← final 낭독 전용
```

#### C. `PushToTalkButton`

```tsx
<button type="button" aria-label="누르고 있는 동안 말하기" aria-pressed={phase === 'recording'}
  aria-busy={phase === 'starting' || phase === 'finishing'} aria-describedby={describedBy}
  disabled={disabled || phase === 'finishing'} data-rec={phase === 'recording'}
  onPointerDown={(e) => { if (e.button !== 0 || !e.isPrimary) return; e.currentTarget.setPointerCapture(e.pointerId); onPress() }}
  onPointerUp={onRelease} onPointerCancel={onAbort}
  onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); onPress() } }}
  onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') onRelease() }}
  onBlur={() => phase === 'recording' && onAbort()} onContextMenu={(e) => e.preventDefault()}
  className="group relative grid h-[72px] w-[72px] flex-none place-items-center rounded-full bg-accent text-on-accent
             touch-none select-none [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent]
             transition-transform focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent
             disabled:opacity-40 data-[rec=true]:scale-105 motion-reduce:transition-none motion-reduce:data-[rec=true]:scale-100">
  <span aria-hidden className="absolute -inset-1.5 rounded-full ring-[6px] ring-accent-soft opacity-0
        group-data-[rec=true]:opacity-100 motion-safe:group-data-[rec=true]:animate-pulse" />   {/* 링만 깜빡임 */}
  {starting|finishing ? <Spinner 24 /> : <MicIcon 28 aria-hidden />}
</button>
```

| phase | 모양 (색 외 단서 포함) | 상태 줄 |
|---|---|---|
| `idle` | accent 원 · 마이크 | 누르고 있는 동안 말해요 |
| `starting` | 원 안 스피너 | (권한을 묻는 중이면) 마이크 사용을 허용해 주세요 |
| `recording` | **1.05배 + 바깥 링**(accent-soft, 링만 펄스) · `aria-pressed=true` | 듣고 있어요 · 0:03 — 손을 떼면 끝나요 |
| `finishing` | 원 안 스피너 · disabled | 알아듣는 중… |
| `unavailable` | opacity 40 · disabled | 지금은 쓸 수 없어요 (사유는 alert) |

- 포인터 캡처: 손가락이 버튼 밖으로 미끄러져도 녹음은 이어지고, 어디서 떼든 끝난다. 두 번째 손가락·오른쪽 버튼은 무시.
- 누르면 먼저 `stopAllTts()`(§7 `ttsAudio`) — 미리듣기 소리가 마이크로 들어가지 않게. (task-007 회화방은 TTS 재생 중에도 버튼을 막지 않는다 — **누르면 선생님 말을 즉시 멈추고 녹음(barge-in, Leader K8)**. 재생 큐를 먼저 멈추는 순서는 §9-3 C. 생각 중(턴 진행·소리 전)에만 `disabled`.)

#### D. `MicLevelMeter` — 5칸 막대(폭 4px·간격 3px·높이 8/12/16/20/24px), 켜진 칸 `bg-accent`, 꺼진 칸 `bg-line`. 기준 dBFS −50/−40/−32/−25/−18. `aria-hidden`.

### 8-3. 상태 관리

#### A. 화면이 기대하는 클라이언트 계약 (developer B — `@/modules/speech/stt/client`, §8-11 ④)

```ts
createRealtimeSttClient(config: SpeechConfig | null): RealtimeSttClient
interface RealtimeSttClient {
  readonly kind: 'GATEWAY' | 'ONDEVICE'
  begin(o: { purpose: 'MIC_TEST' | 'TALK'; chatId?: string }): Promise<void> // 마이크 열기+캡처 시작에 resolve(연결은 병행·프레임 버퍼), 실패는 reject(SttError{code})
  end(): void        // stop → final 대기
  cancel(): void     // 발화 폐기(final 없음)
  dispose(): void    // 트랙·AudioContext·WS 정리
  subscribe(fn: (e: SttEvent) => void): () => void
}
type SttEvent =
  | { type: 'level'; db: number }                              // ≈10Hz
  | { type: 'connecting'; slow: boolean }                      // ready 전, 1.5s 넘으면 slow
  | { type: 'partial'; segIdx: number; text: string }
  | { type: 'final'; text: string; durationMs: number; utteranceId: string | null }
  | { type: 'error'; code: SttErrorCode; retryAfterSec?: number }
type SttErrorCode = 'INSECURE' | 'UNSUPPORTED' | 'MIC_DENIED' | 'MIC_NOT_FOUND' | 'MIC_BUSY' | 'OFFLINE'
  | 'SERVER_UNAVAILABLE' | 'CONNECT_FAILED' | 'CONNECTION_LOST' | 'TICKET' | 'REPLACED' | 'BUSY' | 'ENGINE_ERROR' | 'TIMEOUT'
```

- 서버 코드·close 코드 → `SttErrorCode` 정규화는 **클라이언트가 끝낸다**(§8-8 ⓐ "원인" 열). 화면은 서버 원문 `message` 를 쓰지 않는다.
- **마이크는 누를 때만 연다.** `end()`/`cancel()` 즉시 트랙 stop(브라우저 녹음 표시가 손 뗀 순간 꺼짐). WS 는 다음 누름을 위해 유휴 60초까지 유지(새 티켓 불필요), 카드 언마운트·`visibilitychange:hidden`·`offline` 이면 `dispose()`.
- 캡처 `AudioContext` 는 재생용 `ttsAudio` 컨텍스트와 분리하고, `begin()` 을 누름 핸들러 안에서 동기로 호출해 제스처 안에서 깨운다.

#### B. `useRealtimeStt({ purpose, chatId? })` + 순수 `sttUiReducer`

반환 `{ phase, transcript: { committed: string[]; segs: Record<number,string> }, db, elapsedSec, hint, error, kind, press(), release(), abort() }`

| 지금 | 사건 | 다음 | 부수 |
|---|---|---|---|
| `idle` | `press` | `starting` | transcript·hint·error 비움 · `stopAllTts()` · `permBefore` = Permissions API(`'prompt'\|'granted'\|'denied'\|'unknown'`) · `t0` · `begin()` |
| `starting` | `begin` 성공 · 아직 누름 | `recording` | 30초 타이머 · 경과초 |
| `starting` | `begin` 성공 · 이미 뗌 | `idle` | `cancel()` · hint = `permBefore==='prompt'` 또는 (`unknown` 이고 begin ≥600ms) ? **권한 허용** : **짧게 누름** |
| `starting` | `begin` 실패 | `idle` | error(code) |
| `recording` | `release`, 누른 지 <300ms | `idle` | `cancel()` · hint 짧게 누름 |
| `recording` | `release` | `finishing` | `end()` · 8초 타이머 |
| `recording` | 30초 | `finishing` | `end()` · hint 자동 멈춤 |
| `recording` | `abort`(pointercancel·blur·hidden) | `idle` | `cancel()` · hint 녹음 끊김 |
| `recording`·`finishing` | `partial` | 그대로 | `segs[segIdx]=text` |
| `recording` | `final`(끝점 — 누르는 중에도 올 수 있음) | 그대로 | `committed.push(text)` · segs 비움 |
| `finishing` | `final` | `idle` | 위와 같음 + 낭독 · text 가 비면 hint 빈 결과 |
| `finishing` | 8초 | `idle` | `cancel()` · error TIMEOUT |
| 어디서든 | `error` | `idle`(unavailable 계열은 `unavailable`) | `cancel()` · error |
| 어디서든 | `offline` / `online` | `unavailable(OFFLINE)` / `idle` | `cancel()` |

- 녹음 중 최근 3초 최댓값 < −50 dBFS → hint 소리 작음(녹음은 계속).
- `starting` 의 "마이크 사용을 허용해 주세요" 는 `permBefore==='prompt'` 이거나 400ms 를 넘길 때만(허용된 기기에서 깜빡임 방지).

#### C. 마운트 시 사전 점검 `micPreflight()` (권한을 묻지 않는다)

| 조건 | 결과 |
|---|---|
| `!window.isSecureContext` | `unavailable(INSECURE)` |
| `navigator.mediaDevices?.getUserMedia`·`AudioWorkletNode`·`WebSocket` 중 없음 (`kind==='GATEWAY'` 일 때) | `unavailable(UNSUPPORTED)` |
| `!navigator.onLine` | `unavailable(OFFLINE)` |
| #19 `gateway.enabled === false` 이고 `kind==='GATEWAY'` | `unavailable(SERVER_UNAVAILABLE)` |
| `permissions.query({name:'microphone'})` = `denied` | error `MIC_DENIED` 표시, **버튼은 누를 수 있음**. `onchange` 로 `granted` 가 되면 error 지움 |

### 8-4. API 호출 계획

| # | 엔드포인트 | 시점 | 파라미터 | 사용 필드 | 에러 처리 |
|---|---|---|---|---|---|
| 19 | `GET /api/v1/speech/config` | 카드 마운트 1회 | — | `gateway.enabled`·`gateway.{wsPath,sampleRate,frameMs}`·(앱) `onDevice.enabled`. `connectionKey`·`model` 은 화면·state 에 안 씀 | 실패 → `config=null` 로 클라 생성(티켓 응답 값 사용), 버튼 막지 않음 |
| 20 | `POST /api/v1/speech/ticket` | 누름 때 열린 WS 가 없을 때만(클라 내부) | `{ purpose: 'MIC_TEST' }`(§8-11 ①), `chatId` 없음 | `ticket`·`wsPath`·`sampleRate`·`frameMs` | 422 → SERVER_UNAVAILABLE · 429 → BUSY(`Retry-After`) · 401 → `api.ts` 로그인 이동 · 5xx/0 → CONNECT_FAILED |
| 142 | WS `wss://{location.host}{wsPath}` | 티켓 직후 | 보냄 `start{v:1,sampleRate:16000,ticket,partial:true,clientPlatform:'web'}` · binary PCM16 40ms · `stop` · `cancel` · 유휴 15s `ping` | 받음 `ready`(연결 확인만) · `partial{segIdx,text}` · `final{text,durationMs,utteranceId}` · `error{code}` · `pong`. `vad` 는 이 화면에서 안 씀 | close·error 코드 → §8-8 ⓐ |

### 8-5. 컴포넌트 분해 (`src/components/speech/*`)

| 이름 | 종류 | props / 반환 | 상태 |
|---|---|---|---|
| `MicTestCard` | 컴포넌트 | 없음 | `useRealtimeStt({purpose:'MIC_TEST'})` · preflight · #19 |
| `PushToTalkButton` | 컴포넌트 (007 재사용) | `{ phase; disabled?; onPress; onRelease; onAbort; describedBy }` | 없음(판정은 훅) |
| `MicLevelMeter` | 컴포넌트 | `{ db: number \| null; active: boolean }` | 없음 |
| `useRealtimeStt` | 훅 (007 재사용) | `{ purpose; chatId?; config }` → §8-3 B | 클라 인스턴스·타이머 |
| `sttUiState.ts` | 순수 로직 | `sttUiReducer`·`initialSttUi`·`transcriptText()` | 상태기계(§8-3 B 표) |
| `sttCopy.ts` | 문구 (007 재사용) | 오류(웹/앱 두 벌 조치 줄)·상태 줄·힌트·경로 안내·저장 안내 | — |
| `micPreflight.ts` | 로직 | `micPreflight(kind, config)`·`watchMicPermission(cb)` | — |

### 8-6. 생성/수정 파일 목록

| 구분 | 파일 |
|---|---|
| 생성 | `src/components/speech/{MicTestCard.tsx, PushToTalkButton.tsx, MicLevelMeter.tsx, useRealtimeStt.ts, sttUiState.ts, sttCopy.ts, micPreflight.ts}` |
| 생성 | `src/components/speech/__tests__/sttUiState.test.ts` — §8-3 B 표 전 행 · 첫 누름=권한만(녹음 0) · 300ms 미만 취소 · 누르는 중 final 누적 · 8초 TIMEOUT · 빈 final 힌트 · error 후 idle · 소리 작음 힌트 |
| 수정 | `src/components/settings/SpeechSettings.tsx` — early return 을 모드 블록 안으로, 그 아래 `<MicTestCard />` |
| (범위 밖·참고) | 클라이언트 `src/modules/speech/stt/client/*`(Leader's Plan developer B) — 이 문서는 인터페이스만 §8-3 A 로 고정 |

### 8-7. 구현 순서

1. `sttCopy` → `sttUiState`(+테스트) — 클라이언트 없이 가능.
2. `micPreflight` · `PushToTalkButton` · `MicLevelMeter`.
3. 클라이언트 계약(§8-3 A)의 가짜 구현(단위 테스트 전용, 화면에 개발용 스위치 금지)으로 `useRealtimeStt` → `MicTestCard`.
4. `SpeechSettings` 결합 → 실 클라이언트 연결.
5. 실서버(완료 기준 5): Playwright Chromium `--use-fake-device-for-media-stream --use-file-for-fake-audio-capture=<테스트 wav>` + 마이크 권한 부여 → `mouse.down()` 3~5초 `mouse.up()` → partial(회색)→final(검정). 권한 미부여 컨텍스트 → MIC_DENIED 문구. gateway 중지 → SERVER_UNAVAILABLE 또는 CONNECT_FAILED 문구. 360/390/412 스크린샷.

### 8-8. 한국어 UI 문구 (`sttCopy.ts`)

ⓐ **오류** — `MicTestAlert` 1줄(무엇) + 2줄(어떻게)

| 코드 | 원인 (클라가 정규화) | 1줄 | 2줄 | 버튼 |
|---|---|---|---|---|
| INSECURE | `isSecureContext=false`(http 주소) | 이 주소에서는 마이크를 쓸 수 없어요. | https:// 로 시작하는 주소로 열어 주세요. | 막힘 |
| UNSUPPORTED | `mediaDevices`·`AudioWorkletNode`·`WebSocket` 없음 | 이 브라우저에서는 음성 인식을 쓸 수 없어요. | 최신 Chrome 으로 열어 주세요. | 막힘 |
| MIC_DENIED | `NotAllowedError`·`SecurityError`·권한 `denied` | 마이크 사용이 막혀 있어요. | 웹: 주소창 왼쪽 아이콘(사이트 정보) → 권한 → 마이크 → 허용으로 바꾼 뒤 다시 눌러 주세요. / 앱(003f): 휴대폰 설정 → 애플리케이션 → 일본어교육 → 권한 → 마이크 → 허용 | 누를 수 있음 |
| MIC_NOT_FOUND | `NotFoundError`·`OverconstrainedError` | 마이크를 찾지 못했어요. | 마이크나 이어폰이 연결되어 있는지 확인해 주세요. | 누를 수 있음 |
| MIC_BUSY | `NotReadableError`·`AbortError` | 다른 앱이 마이크를 쓰고 있어요. | 통화·녹음 앱을 닫고 다시 눌러 주세요. | 누를 수 있음 |
| OFFLINE | `navigator.onLine=false` | 인터넷에 연결되어 있지 않아요. | 연결되면 바로 쓸 수 있어요. | 막힘 |
| SERVER_UNAVAILABLE | #19 `gateway.enabled=false` · #20 `422` · `error ENGINE_UNAVAILABLE` · close `4422` | 음성 인식 서버가 준비 중이에요. | 잠시 후 다시 시도해 주세요. | 마운트 판정이면 막힘, 누름 결과면 누를 수 있음 |
| CONNECT_FAILED | #20 5xx/0 · `ready` 전에 닫힘(`1006`·`1011`) | 음성 인식 서버에 연결하지 못했어요. | 잠시 후 다시 눌러 주세요. | 누를 수 있음 |
| CONNECTION_LOST | 녹음·결과 대기 중 close `1006`·`4408`·`1011` | 연결이 끊겨 방금 한 말을 놓쳤어요. | 다시 눌러 말해 주세요. | 누를 수 있음 |
| TICKET | close `4401`·`4403`·`error UNAUTHENTICATED`(README `TICKET_INVALID`·`TICKET_USED`) — **1회는 새 티켓으로 조용히 재시도**(버퍼 유지), 그래도 실패하면 표시 | 연결 준비에 실패했어요. | 화면을 새로 고친 뒤 다시 눌러 주세요. | 누를 수 있음 |
| REPLACED | close `4409`(다른 창이 새 세션을 염) | 다른 창에서 음성 인식을 시작해 이 창의 연결을 닫았어요. | 다시 누르면 이 창에서 쓸 수 있어요. | 누를 수 있음 |
| BUSY | #20 `429` · `error RATE_LIMITED` · close `4429`(README `SESSION_LIMIT`) | 지금은 음성 인식을 쓰기 어려워요. | {n}초 뒤에 다시 눌러 주세요. (n 없으면 "잠시 후") | 누를 수 있음 |
| ENGINE_ERROR | `error ENGINE_ERROR`·`VALIDATION`(README `AUDIO_FORMAT`) · close `4413` | 알아듣다가 문제가 생겼어요. | 다시 눌러 말해 주세요. | 누를 수 있음 |
| TIMEOUT | 손 뗀 뒤 8초 안에 `final` 없음 | 결과가 너무 늦어지고 있어요. | 다시 눌러 말해 주세요. | 누를 수 있음 |
| (표시 안 함) | `error CALLBACK_FAILED`(README — `final` 텍스트는 옴) | — 결과만 보여 준다 | | |

ⓑ **상태 줄** — §8-2 C 표. 결과를 받은 뒤 `idle` 은 "다시 해 보려면 또 누르고 말해요". 연결이 느리면(`connecting.slow`) 녹음 중 줄을 "연결하는 중… 계속 말해도 돼요".

ⓒ **힌트**(상태 줄 자리, 다음 누름에 지움)

| 자리 | 문구 |
|---|---|
| 짧게 누름(<300ms) | 버튼을 누른 채로 말하고, 다 말하면 손을 떼세요. |
| 권한 허용 직후 | 마이크를 허용했어요. 이제 버튼을 누른 채로 말해 보세요. |
| 빈 결과 | 말소리를 알아듣지 못했어요. 조금 더 크고 또렷하게 말해 보세요. |
| 30초 도달 | 30초가 지나 자동으로 멈췄어요. |
| 녹음 중 무음 3초 | 소리가 거의 들리지 않아요. 마이크 가까이에서 말해 보세요. |
| 녹음 끊김 | 녹음이 중간에 멈췄어요. 다시 눌러 주세요. |

ⓓ **카드 고정 문구 · 낭독**

| 자리 | 문구 |
|---|---|
| 제목 / 설명 | 마이크 테스트 / 버튼을 누른 채로 일본어로 말해 보세요. 알아들은 말이 바로 보여요. |
| 경로 안내 | `GATEWAY` 지금은 서버에서 알아들어요. · `ONDEVICE`(003f) 지금은 휴대폰에서 바로 알아들어요. |
| 빈 결과 자리 | 여기에 알아들은 말이 나와요 · 예) こんにちは |
| 버튼 `aria-label` | 누르고 있는 동안 말하기 |
| 낭독(final) | 알아들은 말: {text} ← text 는 `<span lang="ja">` |
| 저장 안내 A(권장) | 점검용이라 목소리와 알아들은 말을 저장하지 않아요. |
| 저장 안내 B | 알아들은 말은 학습 기록에 남지 않아요. 녹음은 인식 품질 확인용으로 30일 보관 뒤 자동 삭제돼요. |

### 8-9. 360/390/412 · 접근성 체크리스트

- [ ] 360: 카드 안쪽 폭 ≈298px 에서 가로 넘침 0. alert·설명(한국어)은 `break-keep`, 결과(일본어)는 `break-keep` 금지 + `[overflow-wrap:anywhere]`.
- [ ] 버튼 72×72(≥64). 그 밖의 터치 대상 ≥44px. 레벨 미터 자리가 항상 있어 녹음 시작·끝에 카드 높이가 바뀌지 않음.
- [ ] 누른 채 손가락을 버튼 밖으로 옮겨도 녹음 유지, 떼면 끝. 녹음 중 페이지가 스크롤되지 않음(`touch-none`). 길게 눌러도 텍스트 선택·컨텍스트 메뉴·확대 없음(Chrome Android).
- [ ] 손 뗀 즉시 브라우저 녹음 표시(주소창 마이크 아이콘)가 꺼짐. 설정 화면 진입만으로 권한 프롬프트가 뜨지 않음.
- [ ] 키보드: 포커스 링 보임, Space/Enter 를 누르고 있는 동안 녹음, 떼면 끝, 포커스 이탈 시 취소.
- [ ] TalkBack: "누르고 있는 동안 말하기" + 눌림 상태(`aria-pressed`) 낭독, 두 번 탭하고 길게 누르기로 녹음, final 만 한 번 낭독(일본어 음성). 오류는 `role=alert` 로 즉시 낭독.
- [ ] 흑백에서도 녹음 중이 구분됨(확대·링·상태 줄 "듣고 있어요"). `prefers-reduced-motion`: 링 펄스·확대·스피너 회전 없음.
- [ ] partial(`ink2`)·final(`ink`)·alert(`bad`/`bad-soft`) 명암비 ≥4.5:1(§1-1), 다크 모드 토큰만.

### 8-10. 주의사항

- **엔진명·주소 0**: 화면·`aria-label`·alert·`console` 에 `reazon`·`sherpa`·`gateway`·호스트·포트·`:8100`·`wsPath`·`connectionKey`·`traceId` 를 싣지 않는다. WS URL 은 `location.host` + `wsPath` 로 만들고 표시하지 않는다.
- **텍스트·오디오 비보존**: 인식 결과는 React state 에만. `console.log`·`localStorage`·분석 이벤트에 전사 텍스트·PCM 을 남기지 않는다.
- **제스처 밖에서 녹음 시작 금지**: `useEffect`·타이머에서 `begin()` 을 부르지 않는다(AudioContext 가 `suspended` 로 남고 WebView 에서 막힘).
- **빈 상태·로딩**: #19 로딩 중에도 카드는 그리고 버튼은 누를 수 있다(설정 값은 티켓 응답으로 충분). 모드 조회 실패와 테스트 카드는 서로 막지 않는다.
- **권한 거부 상태를 저장하지 않는다**(브라우저가 기억). 거부 뒤 사용자가 설정을 바꾸면 `permission.onchange` 로 alert 가 사라진다 — 지원하지 않는 브라우저는 다음 누름에서 확인.
- **오프라인 전환 중 녹음** → 즉시 취소 + OFFLINE. 다시 온라인이면 alert 를 지우고 `idle`.
- 30초 상한은 이 카드의 점검용 값이다(서버 상한 60초). task-007 은 `maxSec` 옵션으로 정한다.

### 8-11. Leader 확인 요청

| # | 항목 | 화면이 가정한 것 | 틀리면 |
|---|---|---|---|
| ① | **점검 발화 저장 여부** | **A(권장)**: #20 body `purpose:"MIC_TEST"` → 티켓 claim → gateway 가 wav·`Utterance`·internal 콜백·`SpeechJob` 을 **건너뛰고** `final.utteranceId:null`. 이유: 점검 발화가 30일 보관·(P2) 분석 큐에 섞이지 않고, "저장하지 않아요" 를 그대로 말할 수 있다. 완료 기준 4(wav+Utterance)는 `purpose` 없는 티켓(스크립트)으로 검증 | **B**: 현 계약대로 저장 → 저장 안내를 B 문구로(§8-8 ⓓ). 화면 동작은 같음 |
| ② | **WS 응답의 엔진명** | `ready.engine/model`·`final.engine`(= `reazon-gateway`·`reazonspeech-int8@…`)은 사용자에게 가는 프레임 → 완료 기준 6 "사용자 응답 엔진명 0" 과 충돌(§7-11 ⑤ 와 같은 문제). 권장: gateway 가 사용자 WS 에서 빼고 internal 콜백·trace 에만. 클라이언트는 어느 쪽이든 버린다 | 남기면 QA 가 WS 프레임 grep 에서 검출 |
| ③ | **gateway README ↔ api-contract 불일치** | 화면은 계약(§2-29) 기준 + README 코드도 매핑(§8-8 ⓐ 원인 열). 불일치: 티켓 `aud` `speech-ws`↔`ws-speech` · 오류 코드(`TICKET_INVALID/TICKET_USED/SESSION_LIMIT/AUDIO_FORMAT/CALLBACK_FAILED`) · `stop` 후 세션 종료↔10분 유지 · close `4429`↔`4409` | 어느 쪽이 정본인지 developer A 에 확정 필요(화면은 둘 다 견딤) |
| ④ | 클라이언트 진입점 | components 는 서버 코드 없는 진입점 `@/modules/speech/stt/client` 만 import(`@/modules/infra/native` 와 같은 방식, module-dependency §3-1 규칙 5) | 경로가 다르면 import 한 줄만 바뀜 |

---

## 9. AI 회화(음성) — 회화방 (task-007)

> 정본: `api-contract.md` #19·#20·#21b·#23·#24·#27~#39·§0-9(SSE)·§2-29(#142)·§7-1(SSE `audio{chunkIndex…}`) · `speech-platform/16` §5(Speech Profile)·§6.3(TtsPlaybackQueue)·§6.4(TTFA)·§12(표시등) · `design-spec.md` §8(A1·5초 예산)·§11 · task-007 Leader's Plan K3·K5·K6·K7·K8. 재사용: §3(채팅 목록·말풍선·교정·제안·턴 훅)·§7(표시등·`ttsAudio`)·§8(푸시투토크·`useRealtimeStt`·`sttCopy`). 새 색 없음(§1-1 토큰만). 서버 계약이 비어 있거나 모호한 곳은 §9-11 에 가정과 함께 적었다.

### 9-0. 한눈에 보는 결정

1. **경로 2개**: 홈 `/study/ai`(**기본 탭을 `talk` 로**) → 회화방 `/study/ai/talk/[chatId]`. 방은 하단 탭을 숨기고, 머리는 `TalkRoomHeader`(← · 선생님 아바타 40px·이름 · **TTS 표시등**(§7 컴포넌트 그대로) · ⋯), 56px.
2. **음성 우선 입력**: 입력 바 가운데 **푸시투토크 72px**(§8 `PushToTalkButton` 그대로), 왼쪽 ⌨(글자로 입력) 44px, 오른쪽 ■(선생님 말 멈추기 — 말하는 중에만) 44px. 글자 모드는 채팅 `Composer` 재사용 + 왼쪽 🎤(말로 입력) 44px. 텍스트 폴백은 언제나 한 번의 탭 거리다.
3. **턴 상태 6개** = 대기 → 녹음 → 인식 중 → (보내기 대기) → 선생님 생각 중 → 말하는 중 → 대기. 화면 상태를 따로 저장하지 않고 **STT·턴·재생 세 상태에서 순수 함수 `deriveTalkState` 로 유도**한다(§9-3 A) — 셋이 어긋나 버튼이 잠기는 사고를 막고 단위 테스트로 고정한다.
4. **자동 전송**: 손을 떼고 `final` 이 오면 확인·편집 단계 없이 곧바로 #32(5초 예산). trim 뒤 코드포인트 **≤1자면 보내지 않고** 상태 줄 힌트. 고쳐서 보내려면 글자 모드(또는 보내지 못한 말의 [글자로 고치기]).
5. **선생님 말풍선 점진 표시**: SSE `audio` 가 올 때마다 **chunkIndex 0 부터 빈틈없이 이어진 앞부분만** 문장 단위로 드러내고(늦게 온 앞 청크를 기다림), 지금 재생 중인 문장을 `bg-accent-soft` 로 강조. `done` 에서 본문을 `replyJa` 로 확정하고 읽기(§1-3)·번역·문법 칩·▶ 를 붙인다. `audio` 없이 `done`(자막만)이면 그때 전체를 한 번에 보이고 표시등에 신호를 넣는다.
6. **재생 = `TtsPlaybackQueue`**(`chunkIndex` 순·도착 즉시 받아 두기·청크 간격). **barge-in**: 재생 중 푸시투토크를 누르면 소리를 즉시 멈추고 녹음한다 — §8-2 C 의 "007 은 재생 중 버튼을 막는다" 메모를 **이 절이 대체**한다(Leader K8, §9-11 ①). 다시 듣기 2종(선생님 ▶ · 내 목소리 ▶). 자동재생이 막히면 입력 바 위 "눌러서 듣기" 띠 한 번.
7. **교정 카드는 대화 중 즉시**: `done.correction` 을 해당 사용자 말풍선 **바로 아래** `CorrectionCard`(원문 | 교정 나란히, 전체형)로 붙인다. 채팅은 대화 뒤 점검 결과 화면에서 한꺼번에 — 이것이 두 화면의 가장 큰 차이다. 채택 시트·단어 제안 카드는 채팅 것 그대로.
8. **보내지 못한 말은 사라지지 않는다**: 턴이 거절되면(409·429·네트워크·422·400) 인식한 문장을 입력 바 위 `UnsentBar` 에 남기고 [다시 보내기]·[글자로 고치기]·✕ 를 준다(음성 모드엔 되돌릴 입력창이 없다).
9. **aria-live**: 녹음 중(starting·recording) 대화 목록 `aria-live="off"`, 부분 인식 말풍선 `aria-hidden`, 생성 중인 선생님 말풍선 `aria-busy="true"` → `done` 에 한 번만 낭독. 토스트는 녹음이 끝난 뒤로 미룬다. 스크린리더 음성이 마이크로 들어가지 않게 하는 규칙이다.
10. **엔진명 0**: `audio.runtime.connectionKey`(오더라도)·`cacheKey`·`url`(서명 토큰)·`traceId`·`ttfaMs` 는 화면·DOM 속성·콘솔에 싣지 않는다. 경로 안내·오류 문구는 §8 과 같은 말만 쓴다.

### 9-1. 화면 개요

| 항목 | 내용 |
|---|---|
| 목적 | 일본어로 **말로** 대화(A1) — 선생님이 문장 단위로 바로 소리 내어 답하고, 틀린 표현은 그 자리에서 교정 카드로 보여 주며, 내가 채택한 것만 저장한다 |
| 진입 | 하단 탭 "회화" → `/study/ai`(기본 `tab=talk`) → 목록 행 또는 [＋ 새 회화] · 홈 "채택을 기다리는 교정" 의 회화 행 → `/study/ai/talk/{id}#cr_{교정 id}` |
| 역할별 가시성 | 로그인 사용자 전원. 관리자 전용 요소 없음(엔진 상태는 콘솔 `/admin/speech/*`). 타인 회화는 404 화면 |
| 앱/웹 분기 | 이번 task = **웹 경로만**(`kind:'GATEWAY'`). 앱(003f)은 `createRealtimeSttClient` 가 온디바이스를 고르고, 화면 차이는 권한 거부 조치 줄(§8-8 ⓐ `native`) 하나다. 자동재생 규칙은 WebView(`mediaPlaybackRequiresUserGesture`)도 같은 코드로 견딘다(실기기 확인 003f) |
| 재사용 | §3 `ChatList`·`NewChatSheet`·`MessageList`·`MessageBubble`·`CorrectionCard`·`AcceptCorrectionSheet`·`ProposalCard`·`useChatTurn`·`Composer`·`ChatMenuSheet`·`TurnNotice` · §7 `TtsRuntimeStatusIndicator`·`ttsAudio` · §8 `PushToTalkButton`·`useRealtimeStt`·`sttCopy`·`MicLevelMeter`·`micPreflight` |
| 새 것 | `src/components/talk/*`(방·머리·입력 바·띠·재생 훅·상태 유도) · 클라 재생 큐 `@/modules/speech/tts/client`(module-dependency L4 `TtsPlaybackQueue` 자리) |

### 9-2. UI 구조 (의사코드, 390px 기준)

#### A. 홈 `/study/ai` — `StudyAiHome`(회화 탭)

```
AppBar title="AI와 공부하기"
<div className="px-4 pb-8">
  Segmented ariaLabel="공부 방식" [회화 | 채팅]         ← 기본 talk (page.tsx: tab==='chat' ? 'chat' : 'talk')
  tab === 'talk' →
    Btn primary full "＋ 새 회화"   → NewChatSheet kind='TALK'
    PendingCorrectionsCard           ← 두 탭 모두. 행 링크: CHAT → …/chat/{id}/review#cr_{crId} · TALK → /study/ai/talk/{id}#cr_{crId}
    ChatList kind="TALK"             ← 섹션 제목 "회화", 행 링크 /study/ai/talk/{id}, 빈 상태 = 회화용 문구(§9-8 ⓕ)
  tab === 'chat' → 지금 그대로(§3-2 A)
</div>
```
- `TalkComingSoon` 은 삭제한다(§3-5 행 갱신).
- 목록 행(`ChatListItem`)은 그대로 쓴다. TALK 은 `reviewedAt` 이 늘 null 이라 "점검 완료" 뱃지가 없고, `running` 이면 "답하는 중".
- `PendingCorrectionsCard` 의 행 보조 줄: CHAT "{제목} · 결과 보기 ›" / TALK "{제목} · 회화에서 보기 ›". 지금 `kind==='CHAT'` 만 거르는 필터를 TALK 까지 넓힌다(ASK 는 교정이 없다).

#### B. 새 회화 시트 — `NewChatSheet kind='TALK'`

§3-2 B 와 같다. 차이: 시트 제목 "새 회화", 제출 `{ kind:'TALK', title? }`(비우면 서버가 "새 회화"), 성공 시 `router.push('/study/ai/talk/' + id)`. 주제 선택(`topicId`)은 Phase 2.

#### C. 회화방 `/study/ai/talk/[chatId]` — `TalkRoom`

레이아웃(앱 셸 `main` 안을 **정확히 100%** 채운다 — `main` 은 스크롤되지 않고 목록만 스크롤):
```
<div ref=roomRef data-talk-state={state} className="flex h-full min-h-0 min-w-0 flex-col bg-ground" style={{'--kb-inset': …}}>
  TalkRoomHeader     flex-none  56px
  MessageList        flex-1 min-h-0 overflow-y-auto overscroll-contain   ← 유일한 스크롤(§3 컴포넌트 + 슬롯, §9-2 E)
  StripSlot          flex-none  (띠는 한 번에 하나 — 우선순위 §9-2 G)
  VoiceBar | TextBar flex-none  padding-bottom: max(8px, env(safe-area-inset-bottom)); TextBar 만 margin-bottom: var(--kb-inset,0px)
</div>
```
- `data-talk-state`(IDLE·RECORDING·RECOGNIZING·QUEUED·THINKING·SPEAKING)는 QA 자동화용 속성이다. 엔진·추적 값은 싣지 않는다.

와이어프레임(390px, 말하는 중):
```
┌──────────────────────────────────────┐
│ ←  (유)  유우                       ⋯ │ TalkRoomHeader 56px
│          ● 온라인 ›                    │ 표시등(§7-2 B), 히트 44px
├──────────────────────────────────────┤
│          ── 9월 28일 (월) ──            │
│                 ┌───────────────────┐ │
│                 │ 昨日映画を見に行く  │ │ 사용자 말풍선 = 인식 텍스트(17px ja)
│                 │ ました              │ │
│                 └───────────────────┘ │
│              [▶ 내 목소리]  14:02      │ 44px 히트, 12px ink2 시각
│ ┌ 활용 ───────────────────────────┐   │ CorrectionCard 전체형(즉시)
│ │ 내 문장          │ 이렇게 고쳐요     │ │ 390·412 나란히 / 360 위아래
│ │ …行くました      │ …行きました       │ │
│ │ 「行くました」가 아니라 「行きました」… │ │
│ │ 선생님 제안이에요. 채택해야 저장돼요.   │ │
│ │ [ 채택 ]            [ 무시 ]          │ │
│ └──────────────────────────────────────┘ │
│ (유) 유우 · ▮▮▮ 말하는 중                │ 이름 줄(그룹 첫 말풍선)
│ ┌───────────────────────────┐          │
│ │ ░そうですか。░ 何を見ました │          │ 재생 중 문장 bg-accent-soft
│ │ か？ …                     │          │ 뒤따를 문장이 있으면 끝에 "…"(aria-hidden)
│ └───────────────────────────┘          │
│ [■ 멈춤]  14:02                         │ done 전: 읽기·번역 없음
├──────────────────────────────────────┤
│    ▮▮ 선생님이 말하는 중 · 누르면 멈추고 말해요 │ 상태 줄 h-6, 13px ink2
│  [⌨]            ( 🎤 )             [■] │ 44 · 72 · 44
└──────────────────────────────────────┘ safe-area
```

#### D. 머리 — `TalkRoomHeader`

```
<header className="flex h-14 min-w-0 flex-none items-center gap-1 border-b border-line bg-surface px-1">
  <Link href="/study/ai?tab=talk" aria-label="회화 목록으로" className="grid h-11 w-11 flex-none place-items-center">←</Link>
  <TeacherAvatar name={teacherName} size="md" />              ← 40px, aria-hidden(이름이 옆에 있다)
  <div className="min-w-0 flex-1 pl-1.5">
    <h1 className="truncate text-[16px] font-semibold leading-5">{teacherName}<span className="sr-only">, 회화: {title}</span></h1>
    <TtsRuntimeStatusIndicator onAnnounce={announce} />         ← §7-2 B 그대로(점 10px + 라벨 12px + ›)
  </div>
  <button aria-label="회화 메뉴" className="grid h-11 w-11 flex-none place-items-center">⋯</button>
</header>
```
- 회화 제목은 머리에 보이지 않는다(360 에서 이름·표시등과 세 줄 경쟁). 제목은 목록·메뉴 시트 첫 줄·`sr-only` 로.
- 56px 인 이유: 표시등 히트영역(`before:-inset-y-3.5`)이 목록 첫 버튼("이전 메시지 보기")과 겹치지 않게(§7-9 "구분선까지 ≥14px" 와 같은 규칙).
- `announce(msg)`: 녹음 중(RECORDING)이면 보류했다가 녹음이 끝나면 `toast.show(msg, 4000)` — §9-0 ⑨.

#### E. 대화 목록 — `MessageList`(§3 컴포넌트 + 슬롯)

§3-2 C MessageList 의 스크롤 규칙(첫 로드 맨 아래 · 바닥 120px 안이면 따라감 · "새 메시지 ↓" · 이전 메시지 보기 · ResizeObserver)을 그대로 쓰고, **선택 슬롯**만 더한다(채팅은 넘기지 않으니 동작이 같다):

| 슬롯 | 회화방이 넘기는 것 |
|---|---|
| `renderUser(m)` | `UserBubble`(`correctionChip={false}`, `actions`=내 목소리 ▶) + 그 아래 교정 카드들 |
| `renderTutor(m)` | 완료(`DONE`) 선생님 말풍선 = `TalkTutorBubble mode="done"` |
| `renderPending(m)` | 청크가 1개 이상 드러났으면 `TalkTutorBubble mode="streaming"`, 아니면 기존 `PendingBubble` |
| `intro` | `TalkIntro`(빈 방) |
| `tail` | `LiveUtteranceBubble`(녹음·인식 중·보내기 대기) |
| `liveOff` | `state === 'RECORDING'` 이면 `aria-live="off"` |

**사용자 말풍선**(`UserBubble` + 회화 슬롯):
```
                 ┌───────────────────┐
                 │ 昨日映画を見に行く  │   17px ja, accent-soft (그대로)
                 └───────────────────┘
          [▶ 내 목소리] · 14:02 · 보내는 중…      ← 한 줄(12px ink2), ▶ 는 13px 텍스트 버튼 h-11
<ul className="mt-1.5 w-full"><CorrectionCard showCounter={false} … /></ul>   ← m.corrections 마다(TALK 은 0~1건)
```
- ▶ 내 목소리는 `inputSource==='REALTIME_STT'` 이고 `utteranceId` 가 있을 때만(글자로 보낸 말·새로고침 뒤 id 가 없는 말엔 없다 — §9-11 ⑥). 재생 중엔 "■ 멈춤". 404(30일 지남)면 토스트 후 그 메시지의 버튼을 숨긴다.
- 채팅의 `CorrectionChip`(점검 결과로 가는 링크)은 회화에서 쓰지 않는다 — 결과 화면이 없다.
- 교정 카드: §3-2 E 그대로(원문 | 교정 나란히 · diff 강조 · 유형/중요 뱃지 · 채택/무시 · 처리 후 한 줄). 회화에선 카드마다 1건이라 "1/1" 카운터를 숨긴다(`showCounter={false}`). 카드 폭은 목록 전체(`w-full`) — 360 에서 카드 안쪽 <320px 이라 위아래.
- 카드는 `done` 에서 붙는다. 그때 바닥에 붙어 있었으면 바닥을 유지하므로 선생님 말풍선은 제자리에 있고 카드가 위에서 밀고 들어온다.

**선생님 말풍선**(`TalkTutorBubble`, 안쪽은 §3 `TutorRow`·`TutorBubble` 재사용):

| mode | 조건 | 모양 |
|---|---|---|
| (생각 중) | `PENDING`, 드러난 청크 0 | 기존 `PendingBubble`(점 3개 + 단계 문구 §3-8 ⓑ · 5초부터 초 · 12초부터 "조금 오래…") |
| `streaming` | `PENDING`, 드러난 청크 ≥1 | 흰 말풍선에 드러난 문장들을 `<span>` 으로 이어 붙임(17px ja). 재생 중 문장 `rounded-sm bg-accent-soft`(글자 `ink`, 13:1). 아직 올 청크가 있으면 끝에 `…`(ink2, aria-hidden). 말풍선 `aria-busy="true"`. 아래 줄: [■ 멈춤](이 메시지가 재생 중일 때만) |
| `done` | `DONE` | `TutorBubble` 그대로(읽기·번역 토글·문법 칩·시각) + `body` 슬롯(청크 문장을 이은 것이 `content` 와 **정확히 같을 때만** 문장 `<span>` 분할 — 다시 듣기 중 강조용, 아니면 `content` 통째) + `actions` 슬롯 맨 앞 [▶ 다시 듣기] |
| 실패 | `FAILED` | 마지막이면 `FailedBubble`(§3-8 ⓒ, [다시 받기] = `resume()`), 아니면 `FailedLine` |

- 이름 줄(그룹 첫 말풍선): 이 메시지가 재생 중이면 `{teacherName} · ▮▮▮ 말하는 중`(막대 3개 12px `bg-accent`, `motion-safe` 에서만 움직임, 글자 `ink2`). 막대는 `aria-hidden`, "말하는 중" 은 글자라 색 없이도 보인다.
- 강조는 색만이 아니다: 재생 중 문장은 배경 + 말풍선의 [■ 멈춤] 버튼 + 이름 줄 "말하는 중" 세 단서.
- 드러내기 규칙(`visiblePrefix`): 받은 청크를 `chunkIndex` 로 정렬해 0 부터 이어진 것까지만. FAILED 청크도 **글자는 드러낸다**(소리만 없다). `AUDIO_TEXT_MISMATCH` 경고를 받으면 드러낸 문장을 모두 거두고 `PendingBubble`("답을 정리하고 있어요")로 돌아가 `done` 을 기다린다(§9-3 B).
- `done` 뒤 본문은 언제나 `replyJa`(서버 저장값)다. 청크 문장과 달라도 `replyJa` 가 이긴다.
- 단어 제안(`ADD_WORD`)은 채팅과 같이 해당 선생님 말풍선 아래 `ProposalCard`(§3-2 G).

**부분 인식 말풍선**(`LiveUtteranceBubble`, 목록 꼬리 — 오른쪽 정렬):

| 때 | 모양 | 접근성 |
|---|---|---|
| 녹음 중, partial 없음 | 점선 테두리(`border border-dashed border-line bg-surface`) 안 "듣고 있어요…"(14px ink2, 한국어) | `aria-hidden` |
| 녹음·인식 중, partial 있음 | 점선 테두리 안 partial(17px ja **`ink2`** 5.4:1) + `…` | `aria-hidden` |
| 보내기 대기(QUEUED) | 실선 `bg-accent-soft` 말풍선(final, `ink`) + 아래 12px ink2 "선생님 말이 끝나면 바로 보낼게요" | 보통(마이크가 닫힌 뒤라 낭독 가능) |

- `final` 로 보내는 순간 같은 렌더에서 임시 사용자 말풍선(`보내는 중…`)이 나타나고 이 꼬리는 사라진다(깜빡임 없음).

**빈 방** — `TalkIntro`(§3 `RoomIntro` 톤):
```
(유) 유우에게 일본어로 말을 걸어 보세요.
     아래 버튼을 누른 채로 말하고, 다 말하면 손을 떼세요. 바로 보내져요.
     틀린 표현은 선생님이 그 자리에서 고쳐 줘요.
     이렇게 시작해 보세요: こんにちは。はじめまして。 · 今日は何をしましたか。   ← lang=ja 15px ink2, 누르는 기능 없음(말로 해 보는 예)
```

#### F. 입력 바

**VoiceBar**(음성 모드, 기본):
```
<div className="border-t border-line bg-surface px-4 pt-2" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
  <p id="talk-status" className="flex h-6 items-center justify-center gap-2 text-[13px] text-ink2 break-keep">
    <MicLevelMeter db active={state==='RECORDING'} />   ← 녹음 중에만 보임(invisible 로 자리 유지 — 흔들림 0)
    {statusText}                                         ← §9-3 A 표 · 힌트가 있으면 힌트
  </p>
  <div className="mt-1 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center">
    <IconButton aria-label="글자로 입력하기" onClick={toText} ⌨ />          ← 녹음·인식 중 aria-disabled
    <div className="flex justify-center"><PushToTalkButton … describedBy="talk-status" /></div>
    {speaking ? <IconButton aria-label="선생님 말 멈추기" onClick={stop} ■ /> : <span aria-hidden className="h-11 w-11" />}
  </div>
</div>
```
- 높이 ≈ 8 + 24 + 4 + 72 + 8 = 116px(+safe-area). 412×892(주소창 포함 ≈780)에서 목록 ≈ 600px.
- `PushToTalkButton` 은 고치지 않는다: `phase`=STT 단계, `disabled`=§9-3 A 표, `label`=상태별 aria-label. 누름·뗌·취소 핸들러는 방이 감싼다(§9-3 C barge-in 순서).

**TextBar**(글자 모드): §3 `Composer` + `leading` 슬롯의 🎤(`aria-label="말로 입력하기"`, 44×44).
```
[🎤] [ 일본어로 써 보세요 — 보내면 선생님이 말로 대답해요 ] [↑]
```
- 보내기 = `send(text, { inputSource:'TEXT', clientTimings })`. IME·Enter·포커스 유지·초안·1,000자 규칙은 §3-2 C 그대로(초안 키도 `kaiwa.chat.draft.{chatId}` 공유).
- 모드 전환: 음성→글자는 입력창에 포커스(키보드가 뜨는 것은 사용자가 고른 동작), 글자→음성은 입력창 blur(키보드 내림). 녹음·인식 중엔 전환 버튼 `aria-disabled` + 토스트 "말하는 중에는 바꿀 수 없어요".
- 모드는 `sessionStorage kaiwa.talk.inputMode`(`voice|text`, 기본 voice) — "지금은 말하기 어려운 곳" 은 그때그때라 브라우저 세션 동안만 기억한다.
- 글자 모드에서 선생님 말 멈추기는 말풍선의 [■ 멈춤] 으로(새로 보내도 멈춘다).

#### G. 입력 바 위 띠(StripSlot, 한 번에 하나 — 위 칸이 이긴다)

| 우선 | 띠 | 언제 | 모양 · 동작 |
|---|---|---|---|
| 1 | `SttAlert` | STT 오류(§8-8 ⓐ 코드) | `role="alert"` `rounded-xl bg-bad-soft px-3.5 py-3 text-[13px] text-bad break-keep` — 1줄 무엇 + 2줄 어떻게(`sttErrorCopy(code,{native})`). 막힘 계열(INSECURE·UNSUPPORTED·OFFLINE·SERVER_UNAVAILABLE)과 MIC_DENIED·CONNECT_FAILED 엔 [글자로 대화하기](44px 밑줄 텍스트 버튼). 막힘 아닌 것엔 ✕(44) |
| 2 | `UnsentBar` | 자동 전송·다시 보내기가 `accepted` 전에 거절됨 | `role="alert"` 테두리 카드: 1줄 이유(13px ink2, §9-8 ⓒ) · 2줄 「{text}」(15px ja, 2줄 말줄임) · [다시 보내기](primary, 44) [글자로 고치기](ghost) [✕ 버리기](44, `aria-label="보내지 않고 버리기"`). 429 면 [다시 보내기] 가 "{n}초 뒤" `aria-disabled` 카운트다운 |
| 3 | `AutoplayBar` | 자동재생이 막힘(큐 `blocked`) | `role="status"` 전폭 버튼 h-12 `bg-accent-soft text-ink`: "▶ 눌러서 선생님 말 듣기" + 12px ink2 "브라우저가 소리를 막았어요". 탭 → 같은 핸들러 안에서 `unlockTtsAudio()` → `queue.resumeBlocked()` |
| 4 | `TurnNotice` | 글자 모드의 봉투 오류·다시 받기 거절(§3 그대로) | §3-2 C |
| 5 | `TopicEndNudge` | 직전 `done.endOfTopic` · 대기 · 이 메시지에서 닫지 않음 | 44px 한 줄 "이 이야기는 여기까지 한 것 같아요. 새 회화로 넘어갈까요?" [새 회화](→ `NewChatSheet kind='TALK'`) [✕]. 닫음 = `sessionStorage kaiwa.talk.topicEnd.{chatId}` = 그 메시지 id |

#### H. 메뉴 — `ChatMenuSheet`(kind 로 문구만 바뀜) + "들려주는 방식"

```
Sheet title="회화 메뉴"
  (첫 줄) {title} 15px semibold truncate
  [제목 바꾸기]                  → #30 (§3 그대로)
  [읽기 항상 펼치기]  role=switch  → localStorage kaiwa.chat.readingDefault(채팅과 공유)
  들려주는 방식  role=radiogroup  (자연 속도 | 학습 속도 | 천천히)   ← 라벨은 #19 tts.speechProfiles[].label, 없으면 이 기본 문구
      선택 즉시 #13 GET → speechProfile 만 바꿔 #14 PUT(나머지 값 그대로) → 토스트 "다음 대답부터 {라벨}로 들려드려요"
      저장 중엔 radio aria-disabled · 실패면 원래 값으로 되돌리고 토스트(§9-8 ⓔ)
  [회화 삭제] (danger)          → 확인 단계 "이 회화를 삭제할까요?" … → #31 → router.replace('/study/ai?tab=talk')
```
- 턴 진행 중에는 [회화 삭제] `aria-disabled` + 토스트 "답을 받는 중에는 지울 수 없어요"(§3 과 같음).
- 들려주는 방식은 설정 → AI 선생님 목소리 카드의 같은 값이다(§7). 메뉴에서 바꾸면 설정 화면에도 반영된다(§9-11 ⑩).

### 9-3. 상태 관리

#### A. 화면 상태 — `deriveTalkState(input)` (순수, `talkState.ts`)

입력: `stt.phase`(§8 `idle|starting|recording|finishing|unavailable`) · `turn.phase`(§3 `idle|sending|streaming|detached|failed`) · `playback.phase`(`idle|waiting|playing|blocked`)·`playback.source`(`turn|replay|mine`) · `queued`(보내기 대기 발화 있음) · `blockedUntil`(429) · `mode`(`voice|text`) · `sttError`.

판정 순서(위가 이긴다): ① stt `starting|recording` → **RECORDING** ② stt `finishing` → **RECOGNIZING** ③ `queued` → **QUEUED** ④ playback `playing` → **SPEAKING** ⑤ turn `sending|streaming|detached` → **THINKING** ⑥ 그 밖 → **IDLE**(하위 표시: `unavailable`·`rateLimited`).

| 상태 | 푸시투토크(`phase` · `disabled` · `aria-label`) | 상태 줄(`#talk-status`) | 목록 | ⌨ / ■ | 다음 |
|---|---|---|---|---|---|
| **IDLE** 대기 | idle · 누를 수 있음 · "누르고 있는 동안 말하기" | 누르고 있는 동안 말해요 (힌트·오류 있으면 그것) | — | ⌨ 보임 / ■ 숨김 | 누름 → RECORDING(첫 누름이 권한 프롬프트면 권한만 — §8-0 ③) |
| IDLE·rateLimited | idle · **disabled** | {n}초 뒤에 말할 수 있어요 | — | ⌨ 보임 | 카운트다운 0 → IDLE |
| IDLE·unavailable | unavailable(opacity 40) · disabled | 지금은 말로 할 수 없어요 · 글자로 대화해 보세요 | — | ⌨ 보임 + SttAlert | 온라인 복귀·권한 허용 → IDLE |
| **RECORDING** 녹음 | recording(1.05배 + 바깥 링)/starting(스피너) · `aria-pressed=true` · "누르고 있는 동안 말하기" | 듣고 있어요 · 0:03 — 손을 떼면 보내요 · (권한) 마이크 사용을 허용해 주세요 · (연결 느림) 연결하는 중… 계속 말해도 돼요 · 레벨 미터 | 꼬리에 부분 인식 말풍선 · 목록 `aria-live=off` | ⌨ aria-disabled / ■ 숨김 | 뗌 → RECOGNIZING · 300ms 미만 → IDLE(힌트) · 30초 → RECOGNIZING(자동) · 오류 → IDLE(SttAlert) |
| **RECOGNIZING** 인식 중 | finishing(스피너) · disabled(`aria-busy`) | 알아듣는 중… | 꼬리 유지(마지막 partial) | ⌨ aria-disabled | `final` 비었음 → IDLE(힌트 빈 결과) · ≤1자 → IDLE(힌트 너무 짧음) · 그 밖 → 앞 턴이 끝났으면 **즉시 #32**(THINKING), 진행 중이면 QUEUED · 8초 → IDLE(TIMEOUT) |
| **QUEUED** 보내기 대기 | idle 모양 · disabled | 선생님 답이 끝나면 바로 보낼게요 | 꼬리 = 보낼 말(실선) | ⌨ aria-disabled | 앞 턴 `done`/`error` → #32(THINKING) · 앞 턴이 detached → UnsentBar(IDLE) |
| **THINKING** 선생님 생각 중 | idle 모양 · **disabled** | 선생님이 생각하고 있어요 · (detached) 연결을 다시 확인하고 있어요 | 임시 사용자 말풍선 "보내는 중…" → `PendingBubble` → 청크가 드러나면 streaming 말풍선 | ⌨ 보임 / ■ 숨김 | 첫 청크 재생 → SPEAKING · `done`(소리 없음) → IDLE · `error` → IDLE(FailedBubble) · 청크 사이 받기 대기 중이면 계속 THINKING |
| **SPEAKING** 말하는 중 | idle 모양 · **누를 수 있음** · "누르면 선생님 말을 멈추고 말하기" | 선생님이 말하는 중 · 누르면 멈추고 말해요 (다시 듣기 중) 다시 듣는 중 · 누르면 멈추고 말해요 (내 목소리) 내 목소리를 듣는 중 | 재생 중 문장 강조 · 이름 줄 "말하는 중" | ⌨ 보임 / **■ 보임** | 마지막 청크 끝 → (턴 진행 중이면 THINKING, 아니면) IDLE · 누름 → **barge-in** → RECORDING · ■ → IDLE |

- THINKING 에서 버튼을 `disabled` 로 두는 이유: 서버는 사용자당 턴 1개(409)라 지금 말해도 보낼 수 없다. 이유는 `aria-describedby` 로 연결된 상태 줄이 늘 보여 준다(눌러도 반응 없는 버튼 금지 원칙 충족).
- SPEAKING 인데 턴이 아직 `streaming`(뒤 청크 합성 중)일 때 barge-in 하면, 인식이 끝났을 때 QUEUED 로 가서 `done` 을 기다린다 — 턴 락이 풀리기 전에 보내 409 를 맞지 않게.
- 순수 함수라 표 전 행을 `__tests__/talkState.test.ts` 로 고정한다.

#### B. 한 턴의 흐름 (음성, 정상 경로)

```
t0 손 뗌  ── useRealtimeStt.release() → END → WS stop                 (releasedAt = performance.now())
t1 final  ── onFinal{text, utteranceId, durationMs}                    (stop→final p50 63ms, task-003e)
            trim·코드포인트 ≤1 검사 → turn.send(text, { inputSource:'REALTIME_STT', utteranceId, clientTimings })
            (utteranceId 가 null 이면 inputSource:'TEXT' — §9-11 ②) · queue.startTurn() 은 accepted 에서
t2 accepted ── 임시 말풍선 → userMessageId · PENDING 선생님 말풍선 · 표시등 pause(true) · queue.startTurn(assistantMessageId)
   status{PROMPT|LLM|PARSE|TTS} ── PendingBubble 단계 문구
t3 audio{chunkIndex:0, text, url, status:'OK', last:false} ── queue.push → 받기(#24) → 자동재생
            말풍선이 문장 0 을 드러냄 · 재생 문장 강조 · reportSynthesis(ok) · SPEAKING
   audio{1…} ── 도착 즉시 받기, 0 이 끝나면 간격 뒤 1 재생
   status{warning:'AUDIO_TEXT_MISMATCH'} ── queue.abortTurn(): 소리 즉시 정지 · 남은 청크 버림 · 드러낸 문장 거둠 → PendingBubble
t4 done   ── 본문 replyJa 확정 · 읽기/번역/문법/▶ · correction → 사용자 말풍선 아래 교정 카드 · 제안 카드 · queue.endTurn()
            표시등 pause(false) · audio 0건이면 표시등 신호(§9-3 F) · 보내기 대기 발화가 있으면 이제 보냄
t5 마지막 청크 끝 ── IDLE
```
- 5초 예산: t0→t3(첫 `audio` 수신) p50 ≤4.0s 가 서버 목표(완료 기준 7), 화면이 더하는 것은 받기+재생 시작 지연(≤150ms, 16 §6.4)뿐이다. **t1 과 #32 사이에 아무 대기도 두지 않는다**(디바운스·확인·애니메이션 금지).
- 끊김(`accepted` 뒤): §3 그대로 detached 폴링. 폴링으로 받은 답에는 청크가 없으므로 **자동재생하지 않는다**(제스처 밖 재생·늦은 소리 방지) — 말풍선의 ▶ 로 듣는다.
- `error`(accepted 뒤): 선생님 말풍선 FAILED + [다시 받기](`resume()`, 청크는 새로 온다). 이미 드러난 청크는 거둔다.

#### C. 방이 엮는 것 — `TalkRoom`

**STT**: `useRealtimeStt({ purpose:'TURN', chatId, config, maxSec:30, onFinal })`. 훅 확장(B): `SttEvent.final` 의 `utteranceId`·`durationMs` 를 버리지 않고 `onFinal({ text, utteranceId, durationMs, releasedAt, finalAt })` 로 올린다(`finishing` 에서 받은 final 만 — 30초 상한이라 녹음 중 강제 final 은 오지 않는다). 마이크 테스트는 `onFinal` 을 넘기지 않으니 그대로다.

**누름·뗌 핸들러(순서가 중요)**:
```
onPress  = () => { queue.interrupt('BARGE_IN'); unlockTtsAudio(); setTalkHint(null); stt.press() }   // 모두 동기, 첫 await 앞
onRelease = () => { unlockTtsAudio(); stt.release() }       // 터치에선 pointerup 이 사용자 활성화를 준다(pointerdown 은 아님)
onAbort   = () => stt.abort()
```
- `queue.interrupt` 를 `stt.press()`(내부 `stopAllTts`) 보다 **먼저** 부른다: `stopAllTts` 만 부르면 큐가 "청크가 끝났다"로 알고 다음 청크를 재생한다.
- `unlockTtsAudio()` 를 누름과 뗌 **둘 다에서** 부른다: 모바일 Chrome 은 `pointerdown`(터치)을 사용자 활성화로 치지 않고 `pointerup` 을 친다. 새로고침으로 방에 바로 들어와 첫 동작이 푸시투토크여도 뗌에서 오디오 컨텍스트가 깨어 답을 자동재생한다.

**턴**: `useChatTurn` 확장(B, 채팅은 새 옵션을 넘기지 않아 동작 불변):
- `send(text, opts?: { inputSource?: InputSource; utteranceId?: string; clientTimings?: ClientTimings })` → 본문 `{ text, inputSource: opts?.inputSource ?? 'TEXT', utteranceId?, clientTimings? }`. 임시 말풍선에 `inputSource`·`utteranceId` 를 싣는다(▶ 내 목소리가 곧바로 보이게).
- `TurnDeps` 선택 콜백: `onAccepted(a)` · `onAudio(ev: TurnAudioEvent, assistantMessageId)` · `onWarning(warning, assistantMessageId)` · `onDone(dn)` · `onSettled(kind: 'done'|'error'|'detached'|'rejected')`.
- SSE 파서: `event: audio` → `parseEventData<TurnAudioEvent>` → `accepted` 뒤에만 `onAudio`. `status.warning` → `onWarning`(CHAT 은 지금처럼 무시).
- `done`: `dn.correction` 이 있으면 `{ id, status, original, corrected, explanation: explanationKo, errorType, severity, chunkType }` 로 바꿔 **사용자 메시지(`userMessageId`)의 `corrections`** 에 넣는다. `required` 는 쓰지 않는다(#29 로 다시 읽으면 없는 값 — 새로고침 전후 모양을 같게). CHAT 은 늘 null 이라 영향 없음.
- `restoreText(text)`: 음성으로 보낸 턴이면 `UnsentBar`(text + utteranceId + 이유), 글자 모드면 지금처럼 입력창 복원.

**보내기 대기(QUEUED)**: `final` 이 왔는데 `turn.phase ∈ {sending, streaming}` 이면 `queued = { text, utteranceId, sttMs }` 로 두고, `onSettled('done'|'error')` 에서 보낸다. `onSettled('detached')` 면 보내지 않고 `UnsentBar`("선생님 답을 확인한 뒤 다시 보내 주세요")로 옮긴다. 대기는 최대 1개(QUEUED 에선 버튼이 막힌다).

**보내지 못한 말(`UnsentBar`)**: [다시 보내기] = 같은 `text`·`utteranceId`·`REALTIME_STT` 로 `send` · [글자로 고치기] = 글자 모드로 바꾸고 입력창을 그 문장으로 채움 + `pendingUtteranceId` 기억 → 보낼 때 `{ text: 고친 글, utteranceId, inputSource:'REALTIME_STT' }`(서버가 `finalSource=USER` 로 갱신 — K6) · [✕] = 버림(발화 wav 는 연결되지 않은 채 30일 뒤 정리). 글자 모드에서 입력창을 비우거나 다른 글을 보내면 `pendingUtteranceId` 를 버린다.

#### D. 재생 큐 — `TtsPlaybackQueue`(`@/modules/speech/tts/client`, 클라 전용·DOM 비의존)

```ts
interface PlaybackDeps {
  fetchAudio(url: string, signal: AbortSignal): Promise<ArrayBuffer>   // components 가 apiGetAudio(#24) 로 주입
  play(buf: ArrayBuffer): Promise<TtsPlayback>                         // components/speech/ttsAudio.playWav
  onSignal?(s: SynthesisSignal): void                                  // 받기 실패 등 → 표시등
  now(): number; setTimer(fn: () => void, ms: number): unknown; clearTimer(h: unknown): void
}
type PlaybackSource = 'turn' | 'replay' | 'mine'
interface PlaybackSnapshot { phase: 'idle' | 'waiting' | 'playing' | 'blocked'; source: PlaybackSource | null; messageId: string | null; chunkIndex: number | null }

createTtsPlaybackQueue(deps) → {
  startTurn(assistantMessageId): void          // 새 턴 — 앞 턴·다시 듣기 정지, 대기 청크 비움
  push(messageId, c: { chunkIndex: number; url?: string; status: 'OK' | 'FAILED'; last: boolean; pauseBeforeMs?: number }): void
  endTurn(messageId): void                      // done/error — 더 올 청크 없음(비어 있는 index 는 건너뜀)
  abortTurn(messageId): void                    // AUDIO_TEXT_MISMATCH — 즉시 정지 + 남은 청크 재생 안 함
  interrupt(reason: 'BARGE_IN' | 'USER_STOP' | 'HIDDEN' | 'NEW_TURN'): void   // 지금 소리 정지. 그 턴의 청크는 계속 받아 두되 자동재생하지 않음
  playParts(source, messageId, parts: Array<() => Promise<ArrayBuffer>>): void  // 다시 듣기(버퍼·#23·#21b) — 앞 소리 정지
  resumeBlocked(): void                         // 자동재생 차단 뒤 탭(탭 핸들러 안에서 unlockTtsAudio() 다음에)
  buffersOf(messageId): ArrayBuffer[] | null    // 다시 듣기용 보관본 — 최근 20 메시지·총 8MB LRU
  timingsOf(messageId): { firstAudioEventAt?: number; firstPlayAt?: number; autoplayed: boolean }
  subscribe(fn): () => void; getSnapshot(): PlaybackSnapshot; dispose(): void
}
```
- **재생 순서** = `chunkIndex` 0,1,2… 다음 index 가 아직 없으면 `waiting`. `FAILED` 청크·받기 실패 청크는 건너뛴다. `endTurn` 뒤엔 빈 index 도 건너뛰고 끝낸다.
- **받기** = `push` 즉시(동시 2). 재생만 순서대로. 받은 wav 는 다시 듣기용으로 보관(디코드는 재생할 때 — `playWav` 가 한다).
- **간격** = `pauseBeforeMs ?? 0`(§9-11 ③ — 없으면 NATIVE 기준 0).
- `play()` 가 `NotAllowedError` → `blocked`(그 청크에서 멈춤) → `AutoplayBar`. 다음 푸시투토크 뗌에서도 컨텍스트가 깨므로 다음 턴부터는 자동재생된다.
- 새 턴의 첫 소리가 오면 다시 듣기(`replay`·`mine`)를 멈추고 턴이 이긴다. 다시 듣기를 누르면 턴 자동재생을 멈춘다(`interrupt('NEW_TURN')` 과 같은 효과 — 그 턴 청크는 계속 받아 둠).
- `visibilitychange: hidden`·언마운트 → `interrupt('HIDDEN')` + 받기 abort. 돌아와도 이어서 재생하지 않는다(16 §6.3 "화면 이탈 시 큐 비움").
- 위치 이유: module-dependency L4 공개 API 의 클라 `TtsPlaybackQueue` 자리. 오디오 컨텍스트(`ttsAudio`)는 components 에 있으므로 **주입**받는다(하위 층이 상위 층을 import 하지 않게). 진입점 `@/modules/speech/tts/client/index.ts` 는 `createTtsPlaybackQueue` 와 순수 `splitSentences`(`../sentences`)만 내보내고, 서버 코드 유입은 경계 테스트로 막는다(stt/client 와 같은 방식).

#### E. 다시 듣기

| 버튼 | 소스(앞이 이긴다) | 비고 |
|---|---|---|
| 선생님 ▶ 다시 듣기 | ① `queue.buffersOf(id)` 가 청크 수만큼 있으면 그것 ② 없으면 `splitSentences(content, { maxChars: 100 })` 문장마다 #23 `POST /api/v1/speech/tts`(`Accept: audio/wav`, `{ text, chatMessageId: id, context: { sentenceIdx: i } }`) — 차례로, 다음 문장 1개 미리 받기 | 서명 URL(#24)은 10분 만료라 다시 쓰지 않는다. 새로고침 뒤 첫 회는 캐시 MISS 일 수 있다(§9-11 ⑥) |
| 내 목소리 ▶ | #21b `GET /api/v1/speech/utterances/{utteranceId}/audio` | 404 = 30일 지남·없음 → 토스트 + 그 메시지 버튼 숨김(메모리 Set) |

- 버튼 상태: `idle` "▶ 다시 듣기"/"▶ 내 목소리" → `loading` "불러오는 중…"(`aria-busy`) → `playing` "■ 멈춤"(다시 누르면 `interrupt('USER_STOP')`). 44px 히트, 13px `ink2` 글자.
- RECORDING·RECOGNIZING 중엔 `aria-disabled` + 토스트 "말하는 중에는 들을 수 없어요". THINKING 중엔 들을 수 있다(새 턴 소리가 오면 그쪽이 이긴다).
- 다시 듣기의 `#23` 결과는 미리듣기(§7-3 B)와 같은 규칙으로 표시등에 신호를 넣는다.
- 탭 핸들러 안에서 `unlockTtsAudio()` 를 먼저 부른다(동기).

#### F. 표시등 신호 (§7 스토어 재사용)

| 사건 | 호출 |
|---|---|
| 방 마운트 | 머리의 `TtsRuntimeStatusIndicator` 가 구독(첫 조회·폴링 시작) |
| 턴 시작(`accepted`) / 끝(`onSettled`) | `pause(true)` / `pause(false)` — **턴 진행 중에만** 폴링을 멈춘다(§7-3 A 마지막 줄을 좁힘, §9-11 ⑨) |
| `audio.status==='OK'` | `reportSynthesis({ ok: true, cacheHit: ev.cached === true })` |
| `audio.status==='FAILED'` · 청크 받기 실패(404·0) | `reportSynthesis({ ok: false, status: 502 })` (받기 실패는 status 그대로) |
| `audio.runtime?.executionMode === 'TEXT_ONLY'` · 또는 TALK `done` 인데 이 턴 `audio` 0건 | 턴당 1회 `reportSynthesis({ ok: false, status: 422 })` → 스토어가 재확인 → 자막만(🔴) + 토스트 1회 |
| `runtime.connectionKey` | **읽지도 저장하지도 않는다**(U5) |

#### G. `clientTimings`(다음 턴 요청에 싣는다, K7)

방이 턴마다 `{ assistantMessageId, origin: 'release' | 'send', originAt, finalAt? }` 를 기억하고, 큐의 `timingsOf(id)` 와 합쳐 **다음 `send` 에** 싣는다(`performance.now()` 차이, 정수 ms, 0~120,000 밖이면 뺀다, 글자 없음):

| 필드 | 뜻 | 빼는 경우 |
|---|---|---|
| `sttMs` | **이번 턴** 손 뗌(30초 자동 멈춤이면 그 시각) → `final` | 글자로 보낸 턴 |
| `prevMessageId` | 직전 턴 `assistantMessageId` | 방에서 첫 턴·새로고침 뒤 첫 턴 |
| `firstAudioAtMs` | 직전 턴 기준점(손 뗌·글자면 보내기) → 첫 청크 **실제 재생 시작** | 자동재생 안 됨(차단·barge-in 이 먼저·자막만·폴링 복구) |
| `playbackStartDelayMs` | 직전 턴 첫 `audio` 수신 → 첫 재생 시작 | 위와 같음 |
| `releaseToFirstAudioEventMs` | 직전 턴 손 뗌 → 첫 `audio` 수신(완료 기준 7 의 클라 관측치) | 글자 턴·`audio` 0건 |

- 계약(#32 예시)에는 앞 3필드만 있다. 추가 2필드와 `firstAudioAtMs` 기준점은 §9-11 ⑤ — 계약이 정해지면 이름만 맞춘다.

#### H. 방 데이터

- 첫 로드 병렬: #29 `?limit=50` · #37 `?chatId=` · #19(실패 → `config=null`, 버튼을 막지 않음). #29 가 서버 예열 트리거다(K2) — 화면은 따로 예열 요청을 만들지 않는다.
- `chat.kind !== 'TALK'` → `router.replace('/study/ai/chat/' + id)`. 반대로 `ChatRoom` 은 `kind === 'TALK'` 면 `/study/ai/talk/{id}` 로 replace(목록 밖 링크·북마크 대비).
- `running` → detached 폴링, 마지막 강사 답 FAILED → [다시 받기] 상태(§3-3 방 데이터와 같음, 자동 재시도 없음).
- `location.hash` 가 `#cr_…` 면 첫 렌더 뒤 그 카드로 `scrollIntoView({ block: 'center' })` + `highlighted` 2초. 로드한 50개 안에 없으면 맨 아래.
- 입력 모드 초기값: `sessionStorage kaiwa.talk.inputMode`(기본 voice). 단, 웹에서 #19 `gateway.enabled === false` 이거나 사전 점검이 막힘(INSECURE·UNSUPPORTED)이면 **글자 모드로 시작** + SttAlert(한 번).
- 읽기 기본값·visible 복귀 동기화(`?after=`)는 §3 과 같다.
- 떠날 때: 큐 `dispose` · STT 훅 정리(마이크·WS) · 턴 abort(서버는 끝까지 처리 — 돌아오면 폴링).

### 9-4. API 호출 계획

| # | 엔드포인트 | 메서드 | 화면 동작 | 파라미터 | 사용 필드 | 오류 처리 |
|---|---|---|---|---|---|---|
| 27 | `/api/v1/chats` | GET | 회화 목록·더 보기 | `kind=TALK&limit=20&cursor=` | `items[].{id,title,preview,lastMessageAt,messageCount,running}`, `nextCursor` | ErrorBlock + 다시 시도 |
| 28 | `/api/v1/chats` | POST | 새 회화 시트 | `{kind:'TALK', title?}` | `id` | 400 입력 아래 / 그 외 시트 안 ErrorBlock |
| 29 | `/api/v1/chats/:id` | GET | 방 로드·턴 폴링·visible 동기화·이전 메시지 | `limit=50` · `after=` · `cursor=` | `chat.{kind,title,running,messageCount}` · `messages[]`(`inputSource`, USER `utteranceId`·`corrections`, ASSISTANT `reading/translation/learning`) · `pendingProposals` · `nextCursor` | 404 → 찾을 수 없음 화면 |
| 30·31 | `/api/v1/chats/:id` | PATCH·DELETE | 메뉴 | `{title}` / — | `title` / `deleted` | §3 과 같음 |
| 32 | `/api/v1/chats/:id/turns` | POST(SSE) | 자동 전송·다시 보내기·글자 보내기·다시 받기 | `{text, inputSource:'REALTIME_STT', utteranceId, clientTimings?}` · `{text, inputSource:'TEXT', clientTimings?}` · `{resumePending:true}` | `accepted` · `status{stage,warning}` · `audio{chunkIndex,text,url,durationMs,last,status,runtime.executionMode}`(+ `cached`·`pauseBeforeMs` §9-11 ③) · `done{conversation,correction,learning,proposals,endOfTopic,audioCount}` · `error{code,retryable}` | 봉투 → UnsentBar(음성)/TurnNotice(글자) · SSE error → FailedBubble · 끊김 → 폴링 |
| 34 | `/api/v1/corrections` | GET | 홈 교정 요약(두 탭) | `status=PROPOSED&limit=3` | `id,original,chat{id,title,kind}` | 조용히 숨김 |
| 35·36 | `/api/v1/corrections/:id/accept`·`reject` | POST | 교정 카드 채택·무시 | §3-2 F | §3-2 F | §3-2 F |
| 37·38·39 | `/api/v1/proposals` … | GET·POST | 단어 제안 카드 | `chatId=` | §3-2 G | §3-2 G |
| 19 | `/api/v1/speech/config` | GET | 방 마운트 1회 | — | `gateway.enabled` · `tts.speechProfiles[].label` · `tts.sentenceMaxChars`. `connectionKey`·`model` 은 state 에 두지 않음 | 실패 → null |
| 20 | `/api/v1/speech/ticket` | POST | 누를 때 열린 연결이 없으면(클라 내부) | `{purpose:'TURN', chatId}` | `ticket`… | §8-4 |
| 142 | WS `/ws/speech` | — | 녹음(클라 내부) | `start{v:1,…,chatId}` | `partial{segIdx,text}` · `final{text,utteranceId,durationMs}` | §8-8 ⓐ |
| 24 | `audio.url`(= `/api/v1/speech/tts/<서명 토큰>`) | GET | 큐의 청크 받기 | — | `audio/wav` | 404(만료·변조·타인 모두 같음)·0 → 그 청크 건너뜀 + 신호 · 401 → 로그인 |
| 23 | `/api/v1/speech/tts` | POST, `Accept: audio/wav` | 선생님 ▶(보관본 없을 때) | `{text(문장 ≤100), chatMessageId, context:{sentenceIdx}}` | 본문 wav · `X-Tts-Cache` | §9-8 ⓔ + 신호 |
| 21b | `/api/v1/speech/utterances/:id/audio` | GET | 내 목소리 ▶ | — | `audio/wav` | 404 → "녹음이 없어요" + 버튼 숨김 |
| §7-1 | `/api/v1/speech/tts/status` | GET | 표시등(스토어) | — | §7-4 | §7-3 A |
| 13·14 | `/api/v1/settings/voice` | GET·PUT | 메뉴 "들려주는 방식" | GET 값에서 `speechProfile` 만 바꿔 PUT | `speechProfile` | 400·422·0 → 되돌림 + 토스트 |

- `common/api.ts` 에 **`apiGetAudio(path, { signal })`** 추가 → `ArrayBuffer`. 실패는 `apiPostAudio` 와 같은 규칙(401 로그인 이동·봉투 → `ApiError`·취소는 AbortError). 큐는 `audio.url` 이 **`/api/v1/speech/tts/` 로 시작할 때만** 받는다(그 밖 URL 은 버림 — 서버 응답을 그대로 fetch 대상으로 쓰지 않는다).
- 타입(`src/types/chat.ts`): `TurnAudioEvent{chunkIndex,text,url?,durationMs?,last,status,runtime?:{executionMode},cached?,pauseBeforeMs?}` · `TurnCorrection`(done 의 교정) · `ClientTimings` · `ChatMessage.utteranceId?` 추가. `cacheKey`·`ttfaMs`·`timing`·`connectionKey` 는 타입에 두지 않는다(쓰지 않는 값을 받지 않는다).

### 9-5. 컴포넌트 분해

`src/components/talk/*`

| 이름 | 종류 | props / 반환 | 상태 |
|---|---|---|---|
| `TalkRoom` | 컴포넌트 | `{ chatId: string; teacherName: string }` | `load, chat, messages, proposals, chunks: Record<msgId, AudioChunkView[]>, olderCursor, config, mode, queued, unsent, pendingUtteranceId, talkHint, gone: Set<msgId>, menuOpen, newOpen` + `useChatTurn` + `useRealtimeStt` + `useTalkPlayback` |
| `TalkRoomHeader` | 컴포넌트 | `{ teacherName; title; onMenu(); onAnnounce(msg) }` | — |
| `TalkTutorBubble` | 컴포넌트 | `{ message; chunks; mode: 'streaming'\|'done'; teacherName; showHeader; showTime; readingDefault; playing: {chunkIndex}\|null; replay: ReplayState; onReplay(); onStop() }` | — (읽기·번역 펼침은 `TutorBubble` 내부) |
| `TalkUserActions` | 컴포넌트 | `{ message; replay: ReplayState; hidden: boolean; onPlay(); onStop() }` | — |
| `LiveUtteranceBubble` | 컴포넌트 | `{ kind: 'listening'\|'recognizing'\|'queued'; partial: string; text?: string }` | — |
| `TalkIntro` | 컴포넌트 | `{ teacherName }` | — |
| `VoiceBar` | 컴포넌트 | `{ view: TalkView; sttPhase; db; onPress; onRelease; onAbort; onKeyboard(); onStop() }` | — |
| `SttAlert` · `UnsentBar` · `AutoplayBar` · `TopicEndNudge` | 컴포넌트 | 각 §9-2 G | UnsentBar: 429 카운트다운(`useCountdown`) |
| `ReplayButton` | 컴포넌트 | `{ state: 'idle'\|'loading'\|'playing'; idleLabel; ariaLabel; disabled?; onClick() }` | — |
| `SpeakingBars` | 표시 | 막대 3개(`aria-hidden`, `motion-safe` 애니메이션) | — |
| `useTalkPlayback` | 훅 | `(deps: { onSignal }) → { snapshot, queue, replayTutor(msg), replayMine(msg), stop() }` — 큐 싱글턴(방 단위)·`apiGetAudio`/`playWav` 주입·visibility 처리 | 큐 인스턴스 |
| `talkState.ts` | 순수 | `deriveTalkState(input) → TalkView{ state, ptt:{disabled,label}, statusText, showStop, keyboardDisabled }` | 상태표(§9-3 A) |
| `revealChunks.ts` | 순수 | `visiblePrefix(chunks)` · `sentenceSpans(content, chunks) → string[] \| null` | — |
| `timings.ts` | 순수 | `buildClientTimings(prev, current, queueTimings)` | — |
| `talkCopy.ts` | 문구 | §9-8 전부(상태 줄·힌트·띠·버튼·토스트·낭독) | — |

클라 모듈 `src/modules/speech/tts/client/*`

| 이름 | 종류 | 내용 |
|---|---|---|
| `index.ts` | 진입점 | `createTtsPlaybackQueue`, 타입, `splitSentences`(re-export) — 서버 import 0 |
| `playbackQueue.ts` | 로직 | §9-3 D |

기존 것 확장(모두 **추가 prop·기본값 = 지금 동작**)

| 파일 | 바꿈 |
|---|---|
| `chat/MessageList.tsx` | 슬롯 `renderUser`·`renderTutor`·`renderPending`·`intro`·`tail`·`liveOff` |
| `chat/MessageBubble.tsx` | `TutorRow` export · `TutorBubble` 에 `body?`·`actions?`·`headerExtra?` · `UserBubble` 에 `actions?`·`correctionChip?`(기본 true) |
| `chat/CorrectionCard.tsx` | `showCounter?`(기본 true) — 목록 밖에서 쓸 때를 위해 `<li>` 는 그대로 두고 회화는 `<ul>` 로 감싼다 |
| `chat/useChatTurn.ts` | `send(text, opts?)` · `onAccepted/onAudio/onWarning/onDone/onSettled` · done 교정 붙이기 |
| `chat/Composer.tsx` | `leading?` 슬롯 |
| `chat/ChatMenuSheet.tsx` | `chat.kind` 로 문구·삭제 뒤 경로 · `extra?` 슬롯(들려주는 방식) |
| `chat/NewChatSheet.tsx` | `kind?: 'CHAT'\|'TALK'`(기본 CHAT) |
| `chat/ChatList.tsx` | kind 별 섹션 제목·빈 상태·행 링크 |
| `chat/PendingCorrectionsCard.tsx` | TALK 행 포함 + 링크·보조 줄 분기 |
| `chat/StudyAiHome.tsx` | 회화 탭 = 새 회화 버튼·교정 요약·회화 목록 |
| `chat/ChatRoom.tsx` | `kind==='TALK'` → talk 경로로 replace |
| `speech/useRealtimeStt.ts` · `speech/sttUiState.ts` | `onFinal` 옵션 · FINAL 사건에 `utteranceId`·`durationMs`(리듀서는 무시, 훅이 전달) |

### 9-6. 생성/수정 파일 목록 (developer B)

신규
- `src/app/(app)/study/ai/talk/[chatId]/page.tsx` — 서버: `params`(Promise) → `auth()`(없으면 `/login?callbackUrl=…`) + `getProfile(userId).teacherName?.trim() || '선생님'` → `<TalkRoom chatId teacherName />`
- `src/components/talk/{TalkRoom, TalkRoomHeader, TalkTutorBubble, TalkUserActions, LiveUtteranceBubble, TalkIntro, VoiceBar, SttAlert, UnsentBar, AutoplayBar, TopicEndNudge, ReplayButton, SpeakingBars}.tsx`
- `src/components/talk/{useTalkPlayback, talkState, revealChunks, timings, talkCopy}.ts`
- `src/components/talk/__tests__/{talkState, revealChunks, timings}.test.ts` — 상태표 전 행 · 드러내기(순서 뒤바뀜·FAILED·빈틈) · 문장 분할 일치/불일치 · clientTimings 빼는 경우
- `src/modules/speech/tts/client/{index, playbackQueue}.ts` + `src/modules/speech/__tests__/{ttsPlaybackQueue, ttsClientBoundary}.test.ts` — 순서 재생·HIT 먼저 도착·FAILED 건너뜀·endTurn 뒤 빈틈·abortTurn·interrupt 뒤 자동재생 안 함·blocked→resume·새 턴이 다시 듣기를 이김·LRU / 진입점이 서버 모듈을 끌어오지 않음

수정
- `src/app/(app)/study/ai/page.tsx` — 기본 탭 `talk`(`tab==='chat' ? 'chat' : 'talk'`), 주석 갱신
- `src/components/shell/TabBar.tsx` — `HIDDEN_PREFIXES` 에 `'/study/ai/talk/'`
- `src/components/common/api.ts` — `apiGetAudio()`(기존 함수 시그니처 불변)
- `src/types/chat.ts` — §9-4 타입
- §9-5 "기존 것 확장" 표의 chat·speech 파일들
- 삭제: `src/components/chat/TalkComingSoon.tsx`

### 9-7. 구현 순서

1. 순수: `types/chat.ts` 추가 → `talkState`·`revealChunks`·`timings` + 테스트 → `modules/speech/tts/client` 큐 + 테스트(가짜 `fetchAudio`·`play`).
2. 채팅 확장(동작 불변): `useChatTurn`(send opts·audio·warning·교정 붙이기)·`MessageList`/`MessageBubble` 슬롯·`CorrectionCard showCounter`·`Composer leading`·`ChatMenuSheet`·`NewChatSheet`·`ChatList`·`PendingCorrectionsCard`·`ChatRoom` kind 검사·`api.ts apiGetAudio`·`TabBar`. **채팅 회귀**: 기존 단위 테스트 전부 + 채팅방 보내기·점검 스모크.
3. `useRealtimeStt` `onFinal`(utteranceId) — 마이크 테스트 회귀 확인.
4. 홈: `StudyAiHome` 회화 탭·기본 탭 talk·`TalkComingSoon` 삭제.
5. 방 골격: `page.tsx`·`TalkRoom` 로드(#29·#37·#19)·`TalkRoomHeader`(표시등)·목록 슬롯·`TalkIntro`·`VoiceBar`/`TextBar` 전환·모드 기억.
6. 턴: final → 자동 전송 · ≤1자 · QUEUED · `UnsentBar` · `clientTimings`.
7. 재생: `useTalkPlayback`(#24 받기)·점진 표시·강조·`AutoplayBar`·barge-in·■·표시등 신호·hidden 처리.
8. 교정·제안 즉시 표시·채택 시트·hash 스크롤·`TopicEndNudge`.
9. 다시 듣기 2종(#23·#21b)·메뉴 "들려주는 방식".
10. 오류·빈 상태 전부 → §9-9 자체 점검 → Playwright(Chromium `--use-fake-device-for-media-stream --use-file-for-fake-audio-capture=<wav>` + 마이크 권한): PTT `mouse.down` 3초 `up` → 사용자 말풍선 → `data-talk-state` THINKING→SPEAKING → 문장 순서 드러남 → 교정 카드 → 재생 중 다시 `mouse.down` 하면 SPEAKING→RECORDING(barge-in) · 권한 미부여 컨텍스트 → MIC_DENIED 문구 · gateway 중지 → 서버 문구 · TTS 불가 모의 → 텍스트 + "자막만" · 360/390/412 스크린샷(완료 기준 9) → reviewer.

### 9-8. 한국어 UI 문구 (`talkCopy.ts` — §3-8·§7-8·§8-8 에 있는 것은 그 표를 쓴다)

ⓐ **상태 줄**(`#talk-status`, 13px ink2)

| 상태 | 문구 |
|---|---|
| IDLE | 누르고 있는 동안 말해요 |
| IDLE·rateLimited | {n}초 뒤에 말할 수 있어요 |
| IDLE·unavailable | 지금은 말로 할 수 없어요 · 글자로 대화해 보세요 |
| RECORDING | 듣고 있어요 · {m}:{ss} — 손을 떼면 보내요 |
| RECORDING(권한 대기) | 마이크 사용을 허용해 주세요 |
| RECORDING(연결 느림) | 연결하는 중… 계속 말해도 돼요 |
| RECOGNIZING | 알아듣는 중… |
| QUEUED | 선생님 답이 끝나면 바로 보낼게요 |
| THINKING | 선생님이 생각하고 있어요 |
| THINKING(detached) | 연결을 다시 확인하고 있어요 |
| SPEAKING(턴) | 선생님이 말하는 중 · 누르면 멈추고 말해요 |
| SPEAKING(다시 듣기) | 다시 듣는 중 · 누르면 멈추고 말해요 |
| SPEAKING(내 목소리) | 내 목소리를 듣는 중 · 누르면 멈추고 말해요 |

ⓑ **힌트**(상태 줄 자리, 다음 누름에 지움) — §8-8 ⓒ 를 쓰되 회화용 두 줄을 더한다

| 자리 | 문구 |
|---|---|
| 짧게 누름 · 권한 허용 직후 · 빈 결과 · 녹음 끊김 · 소리 작음 | §8-8 ⓒ 그대로 |
| 30초 도달(회화) | 30초가 지나 자동으로 멈추고 보냈어요. |
| 1자 이하(회화) | 너무 짧아서 보내지 않았어요. 한 번 더 말해 보세요. |

ⓒ **띠**

| 띠 | 상황 | 문구 | 버튼 |
|---|---|---|---|
| SttAlert | STT 오류 | §8-8 ⓐ 1줄·2줄(MIC_DENIED 는 웹/앱 두 벌) | 글자로 대화하기 · ✕ |
| UnsentBar | 409 | 선생님이 아직 답하는 중이라 보내지 못했어요. | 다시 보내기 · 글자로 고치기 · ✕ |
| UnsentBar | 429 | 너무 빨리 말했어요. {n}초 뒤에 다시 보낼 수 있어요. | 다시 보내기({n}초) · 글자로 고치기 · ✕ |
| UnsentBar | 네트워크(0) | 보내지 못했어요. 네트워크를 확인해 주세요. | 같음 |
| UnsentBar | 422 | 지금은 선생님이 답할 수 없어요. 잠시 후 다시 보내 주세요. | 같음 |
| UnsentBar | 400 | 서버 문구 그대로(400 만) | 글자로 고치기 · ✕ |
| UnsentBar | 앞 턴 연결 끊김(QUEUED 중 detached) | 선생님 답을 확인한 뒤 다시 보내 주세요. | 다시 보내기 · 글자로 고치기 · ✕ |
| AutoplayBar | 자동재생 차단 | ▶ 눌러서 선생님 말 듣기 / 브라우저가 소리를 막았어요 | (띠 전체) |
| TopicEndNudge | endOfTopic | 이 이야기는 여기까지 한 것 같아요. 새 회화로 넘어갈까요? | 새 회화 · ✕ |
| TurnNotice(글자 모드) | 봉투 오류 | §3-8 ⓐ | — |

ⓓ **턴 실패·진행**(말풍선) — §3-8 ⓑⓒ 그대로. 회화에서만 쓰는 줄: `AUDIO_TEXT_MISMATCH` 뒤 PendingBubble "답을 정리하고 있어요"(ⓑ PARSE 문구 재사용 — 따로 알리지 않는다).

ⓔ **다시 듣기·메뉴 토스트**(HTTP status 로 분기)

| 상황 | 문구 |
|---|---|
| #23 422 | 지금은 선생님 목소리를 들을 수 없어요(자막만). |
| #23 429 | 다시 듣기를 너무 자주 눌렀어요. {n}초 뒤에 다시 눌러 주세요. |
| #23 502 | 목소리를 만들다가 문제가 생겼어요. 다시 눌러 주세요. |
| #23 504 | 목소리 서버 응답이 늦어요. 잠시 후 다시 눌러 주세요. |
| 0 | 연결하지 못했어요. 네트워크를 확인해 주세요. |
| 재생 실패(디코드) | 소리를 재생하지 못했어요. 다시 눌러 주세요. |
| #21b 404 | 녹음이 없어요. 내 목소리는 30일 동안만 보관해요. |
| 녹음 중 다시 듣기 | 말하는 중에는 들을 수 없어요 |
| 녹음 중 모드 전환 | 말하는 중에는 바꿀 수 없어요 |
| 들려주는 방식 저장 | 다음 대답부터 {라벨}로 들려드려요 / 저장하지 못했어요. 다시 골라 주세요. |

ⓕ **홈·방·버튼·aria**

| 자리 | 문구 |
|---|---|
| 홈 | ＋ 새 회화 / 섹션 제목 "회화" / 이전 회화 더 보기 |
| 빈 목록 | 아직 회화가 없어요 / 버튼을 누른 채로 일본어로 말하면 선생님이 대답해요. 틀린 표현은 그 자리에서 고쳐 줘요. / 첫 회화 시작하기 |
| 교정 요약 행(TALK) | {제목} · 회화에서 보기 › |
| 새 회화 시트 | 새 회화 / 제목 (선택) / 비워 두면 자동으로 정해져요 / 시작하기 / 만드는 중… |
| 머리(aria) | 회화 목록으로 · 회화 메뉴 · (sr-only) , 회화: {제목} |
| 빈 방 | {teacherName}에게 일본어로 말을 걸어 보세요. / 아래 버튼을 누른 채로 말하고, 다 말하면 손을 떼세요. 바로 보내져요. / 틀린 표현은 선생님이 그 자리에서 고쳐 줘요. / 이렇게 시작해 보세요: |
| 부분 인식 | 듣고 있어요… / 선생님 말이 끝나면 바로 보낼게요 |
| 푸시투토크 aria-label | 누르고 있는 동안 말하기 / 누르면 선생님 말을 멈추고 말하기 |
| 입력 바 버튼 aria-label | 글자로 입력하기 · 말로 입력하기 · 선생님 말 멈추기 |
| 글자 모드 입력창 | 일본어로 써 보세요 — 보내면 선생님이 말로 대답해요 |
| 말풍선 버튼 | ▶ 다시 듣기 / ▶ 내 목소리 / ■ 멈춤 / 불러오는 중… · (aria) 선생님 말 다시 듣기 · 내 목소리 다시 듣기 · 멈추기 |
| 이름 줄 | {teacherName} · 말하는 중 |
| 메뉴 | 회화 메뉴 / 제목 바꾸기 / 읽기 항상 펼치기 / 들려주는 방식(자연 속도 · 학습 속도 · 천천히) / 회화 삭제 |
| 삭제 확인 | 이 회화를 삭제할까요? / 메시지와 교정·제안이 함께 지워져요. 이미 남긴 공부 기록은 그대로 남아요. / 삭제 / 취소 |
| 찾을 수 없음 | 이 회화를 찾을 수 없어요. 삭제되었을 수 있어요. [회화 목록으로] |
| 불러오기 실패 | 회화를 불러오지 못했어요. [다시 시도] |

ⓖ **낭독(스크린리더)** — 말풍선 앞 `sr-only` "나:" / "{teacherName}:"(§3 그대로). 생성 중 말풍선은 `aria-busy` 라 `done` 뒤 한 번만 읽힌다. 부분 인식 말풍선은 읽지 않는다.

### 9-9. 360/390/412 · 접근성 체크리스트

폭·배치
- [ ] 세 폭에서 가로 스크롤 0(`scrollWidth === innerWidth`). 공백 없는 긴 일본어·이모지를 사용자·선생님 말풍선·UnsentBar·교정 카드에 넣고 확인.
- [ ] 스크롤 영역은 `MessageList` 하나(`main`·입력 바·띠 스크롤 없음). 시트 내부만 예외.
- [ ] 머리 360: ← 44 + 아바타 40 + 이름·표시등 열(`min-w-0`, 이름 말줄임, "상태 확인 중 ›" 한 줄) + ⋯ 44 겹침 없음. 표시등 히트가 목록 첫 버튼과 겹치지 않음(56px).
- [ ] 입력 바 360: ⌨ 44 · PTT 72 · ■ 44 가 한 줄, PTT 는 가운데 고정(■ 가 나타나도 움직이지 않음 — 빈 자리 유지). 상태 줄 가장 긴 문구("다시 듣는 중 · 누르면 멈추고 말해요")가 레벨 미터와 함께 한 줄 또는 `break-keep` 두 줄 안에서 입력 바 높이를 바꾸지 않음(h-6 넘치면 문구 줄임 — qa 확인).
- [ ] 교정 카드: 360 위아래 / 390·412 나란히. 선생님 말풍선 아래 줄 버튼들(▶·읽기·번역·문법 칩·시각)은 줄바꿈으로 넘침 0.
- [ ] 100dvh·safe-area: 입력 바 `padding-bottom: max(8px, env(safe-area-inset-bottom))`, 글자 모드 키보드 = §3-9 키보드 항목 그대로(`resizes-content` + `--kb-inset`).
- [ ] 일본어 요소 전부 `lang="ja"`(말풍선·부분 인식·UnsentBar 문장·예문), 일본어 블록에 `break-keep` 없음.

터치·글자
- [ ] 푸시투토크 72×72, 그 밖 모든 대상 ≥44px(⌨·■·🎤·▶ 다시 듣기·▶ 내 목소리·띠 버튼·표시등).
- [ ] 일본어 본문 17px, 부분 인식 `ink2`(5.4:1), 캡션 ≥12px, 읽어야 하는 글에 `ink3`·`warn`·`accent` 뱃지 글자 없음(§1-1). 재생 강조 `ink`/`accent-soft`.
- [ ] 누른 채 손가락이 버튼 밖으로 나가도 녹음 유지, 떼면 끝. 녹음 중 목록이 스크롤되지 않음(`touch-none`), 길게 눌러도 선택·메뉴 없음(§8-9 그대로).

음성·재생
- [ ] 손 떼고 `final` → #32 요청까지 화면 지연 0(디바운스·확인 없음). ≤1자 → 요청 0 + 힌트.
- [ ] 문장이 `chunkIndex` 순서로만 드러나고 재생된다(캐시 HIT 가 먼저 와도). 재생 중 문장 강조가 소리와 맞는다.
- [ ] barge-in: 재생 중 누르면 **100ms 안에 소리 정지** + 녹음 시작, 그 턴 남은 청크는 자동재생되지 않음(▶ 로는 들을 수 있음).
- [ ] 새로고침 직후 첫 동작이 푸시투토크여도 답이 자동재생된다(뗌에서 unlock). 막히면 AutoplayBar 한 번, 탭하면 그 청크부터 재생.
- [ ] TTS 불가 모의: 턴은 텍스트로 끝나고 표시등이 "자막만"(토스트 1회). 복구 뒤 다음 턴 소리가 나면 "온라인"(토스트 1회).
- [ ] 화면을 가리면(탭 전환) 소리 멈춤, 돌아와도 이어서 재생하지 않음.

접근성
- [ ] 녹음 중 목록 `aria-live="off"`, 부분 인식 `aria-hidden`, 생성 중 말풍선 `aria-busy` → `done` 뒤 한 번 낭독. 녹음 중엔 토스트가 뜨지 않음(끝난 뒤 뜸).
- [ ] PTT: `aria-pressed`·`aria-busy`·`aria-describedby="talk-status"`, 상태별 `aria-label`(말하는 중엔 "누르면 선생님 말을 멈추고 말하기"). Space/Enter 누르고 있는 동안 녹음.
- [ ] 띠: SttAlert·UnsentBar `role="alert"`, AutoplayBar `role="status"`, 표시등 `role="status"`(§7).
- [ ] 비활성은 `aria-disabled`/`disabled` + 보이는 이유(상태 줄·토스트). 흑백에서도 상태 구분(PTT 확대·링·스피너·상태 줄 글자, 재생 강조 = 배경 + "말하는 중" 글자 + ■ 버튼).
- [ ] `prefers-reduced-motion`: 링 펄스·확대·말하는 중 막대·점 애니메이션 정지.

엔진명·비밀 비노출
- [ ] 방·홈 `document.body.innerText`·모든 `aria-label`·토스트에 `claude|haiku|sonnet|opus|qwen|reazon|sherpa|whisper|style-bert|gateway|엔진|모델|trace` 0건.
- [ ] DOM 속성·`console` 에 `audio.url`(서명 토큰)·`cacheKey`·`connectionKey`·`traceId` 0건(`<audio src>` 를 쓰지 않는다 — fetch 후 버퍼 재생).

### 9-10. 주의사항

- **빈 상태**: 회화 목록 0 · 방 메시지 0(`TalkIntro`) · 교정 없음(카드 없음, 칭찬 문구 없음 — 대화 흐름을 끊지 않는다) · 교정 요약 0(카드 숨김).
- **로딩**: 방 첫 로드 `LoadingBlock`(머리는 ←만). 다시 듣기 "불러오는 중…". 메뉴 저장 중 radio `aria-disabled`.
- **권한 거부**: 방 진입만으로 권한을 묻지 않는다(§8-0 ③). 거부 상태면 SttAlert(웹/앱 두 벌 조치) + [글자로 대화하기] — 대화는 막히지 않는다.
- **오프라인**: STT `OFFLINE` → PTT unavailable + SttAlert. 턴 보내기 전 실패는 UnsentBar(말은 남는다). `accepted` 뒤 끊김은 오류가 아니다(폴링).
- **원문 무수정**: 사용자 말풍선은 인식 텍스트 그대로(trim 은 **≤1자 판정에만** 쓰고 보낼 때는 서버 규칙대로 원문을 보낸다 — 교정 원문 바이트 일치 검사 대상이다). 교정 카드는 §3 규칙 그대로.
- **AI 는 제안만**: 교정·제안은 채택 전 "저장됨" 을 보이지 않는다(낙관적 갱신 금지).
- **발화 보존**: 내 목소리는 서버 30일 보관(#21b). 화면은 wav 를 메모리에만 두고(큐 LRU 8MB) 저장소·로그에 남기지 않는다. 인식 텍스트·partial 도 `console`·`localStorage` 금지(초안 `sessionStorage` 는 글자 모드 입력창만).
- **자동재생**: 소리는 `useEffect`·타이머에서 처음 시작하지 않는다 — 컨텍스트는 PTT 누름·뗌·▶·AutoplayBar 탭 핸들러 안에서만 깨우고, 깨어 있는 컨텍스트로 SSE 청크를 재생한다.
- **중복 전송**: final 1개 = 턴 1개. 훅이 `busy` 면 `send` 를 부르지 않고 QUEUED 로(지금 `send` 는 busy 면 조용히 무시한다 — 말이 사라지는 사고). 서버 409 가 최종 보증.
- **메모리**: 방을 떠나면 큐 버퍼 해제. 한 방에서 오래 대화해도 LRU 20 메시지·8MB.
- **범위 밖(다음 task 후보)**: 문장 하나만 눌러 듣기 · "천천히 다시 듣기" 버튼(말풍선별 `speechProfile:'LEARNING_SLOW'` #23) · 핸즈프리(`endpoint:'auto'`) · 발음 분석 표시(Phase 3).

### 9-11. Leader 확인 요청

| # | 항목 | 화면이 가정한 것 | 틀리면 |
|---|---|---|---|
| ① | **barge-in vs "재생 중 버튼 막기"** | K8(재생 중 누르면 즉시 멈추고 녹음)을 따르고, §8-2 C 메모와 designer 원칙 "TTS 재생 중 마이크 버튼 비활성 시각화"를 **"재생 중엔 누르면 멈춘다는 표시(라벨·상태 줄·■)"** 로 바꿔 읽는다. 에코는 `stopAllTts` 뒤 녹음 시작 + `getUserMedia` 기본 에코 제거로 막는다 | 재생 중 PTT `disabled` + ■ 로만 멈춤(완료 기준 9 의 barge-in 문구도 수정 필요) |
| ② | **`final.utteranceId: null`**(gateway 콜백 실패 — README §4 "텍스트 턴으로 이어간다") | `{ text, inputSource:'TEXT' }` 로 보낸다(REALTIME_STT 인데 id 없음 = 400 이므로). 그 말엔 ▶ 내 목소리가 없다 | `SERVER_STT` 등 다른 값을 쓰거나, REALTIME_STT+id 없음을 허용 |
| ③ | **SSE `audio` 추가 필드** | `cached: boolean`(캐시 HIT 는 표시등을 바꾸지 않는 16 §12.2 규칙용) · `pauseBeforeMs: number`(Speech Profile gap + Rendering Plan — 클라가 프로필 정책을 중복해 알지 않게). 없으면 `cached=false`·간격 0 | HIT 재생도 "새 합성 성공" 으로 세어 자막만→온라인 복귀가 조금 빨라질 수 있음 · 학습 속도 프로필의 문장 사이 쉼이 사라짐 |
| ④ | **자막만 턴의 신호** | 서버가 TTS 를 시도하지 않은 턴에 `status{stage:'TTS', warning:'TTS_UNAVAILABLE'}`(또는 `done.tts.executionMode`)를 싣기 권장. 없으면 "TALK 인데 `audio` 0건 + `audioCount=0`" 으로 추정해 422 신호(재확인) | 문장이 0개인 답(거의 없음)도 재확인 1회를 부른다 — 무해 |
| ⑤ | **`clientTimings` 필드** | 계약 3필드(`prevMessageId·playbackStartDelayMs·firstAudioAtMs`) + **`sttMs`**(이번 턴 손 뗌→final, K7 STT step) + **`releaseToFirstAudioEventMs`**(완료 기준 7 의 클라 관측치). `firstAudioAtMs` 기준점 = 손 뗌(글자 턴은 보내기) | developer A 가 계약에 이름·정의를 고정하면 `timings.ts` 만 맞춘다 |
| ⑥ | **#29 추가 필드** | USER 메시지 `utteranceId`(계약 예시엔 있으나 현 직렬화 `MESSAGE_SELECT` 에 없음) + `audioExpired`(또는 `audioExpiresAt`) · ASSISTANT `speechStyle`(toolLog meta.style — #23 다시 듣기 캐시 HIT 용) | 새로고침 뒤 ▶ 내 목소리 숨김 · 다시 듣기 첫 회 MISS(문장당 ≈0.7s) |
| ⑦ | **AUDIO_TEXT_MISMATCH 처리 강도** | "남은 청크 버림" 에 더해 **재생 중 청크도 즉시 끊고** 드러낸 문장을 거둔 뒤 `done` 의 최종 텍스트만 보인다(들리는 것 = 보이는 것) | 재생 중 문장은 끝까지 들려주고 다음부터 버림 |
| ⑧ | **보내지 못한 말 다시 보내기** | 같은 `utteranceId` 로 재전송 허용(아직 메시지에 연결 전). [글자로 고치기] = 같은 id + 고친 text + `REALTIME_STT` → 서버 `finalSource=USER`(K6) | 재전송은 id 없이 TEXT 로(▶ 내 목소리·발화 연결을 잃음) |
| ⑨ | **표시등 폴링 멈춤 범위** | §7-3 A "회화방이 `pause(true)`" 를 **턴 진행 중에만**으로 좁힌다 — 방에 머무는 동안 자막만→복구를 폴링(30초)으로도 잡도록 | 방 전체 pause 면 복구는 다음 턴 소리로만 알 수 있다 |
| ⑩ | **방에서 "들려주는 방식" 변경** | #14 에 부분 PUT 이 없어 #13 GET → `speechProfile` 만 바꿔 전체 PUT. 설정 화면과 같은 값을 바꾼다(designer 원칙 "Speech Profile 토글") | 메뉴엔 "목소리·속도 설정 ›"(→ `/settings`) 링크만 |
| ⑪ | **#24 서명 URL 사용 범위** | 큐는 `audio.url` 이 `/api/v1/speech/tts/` 로 시작할 때만 받고, 다시 듣기는 보관본·#23 으로만(10분 만료 URL 재사용 안 함). URL·토큰을 DOM·로그에 남기지 않는다 | — |
| ⑫ | **발견 이슈**(이번 task 에서 B 가 고침) | `useRealtimeStt` 가 `final.utteranceId` 를 버린다 · `useChatTurn.send` 가 `busy` 면 조용히 무시한다(음성 자동 전송에선 말이 사라짐 → QUEUED 로 해결) · `PendingCorrectionsCard` 가 CHAT 만 거른다 · `CorrectionCard` 가 늘 "n/m" 카운터를 그린다 | — |

---

## 10. 관리자 콘솔 — 발음 사전 (task-003g)

> 정본: IA `admin-console/01` §3(Speech › TTS › Pronunciation Dictionary 행) · API `api-contract.md` §7-2 lexicon 5행(이 절에서는 L1~L9 로 부른다, §10-4) · 엔티티 `domain-model.md` `PronunciationLexiconEntry`·`PronunciationLexiconVersion`(§5 상태 전이·§6 물리 삭제 없음) · 규칙 `speech-platform/16` §2(범위 우선순위 L-1~L-5·버전·방식 A·Import/Export·Preview) · 권한 `role-permission.md` §3·§6(PRODUCTION) · 되돌리기 상태 `admin-console/09` §5(ROLLED_BACK = 밀려난 직전 ACTIVE). 콘솔 셸·공용 조각·404/403 은 §6 그대로. 새 색 없음(§1-1 토큰만).
> 이 절은 **콘솔 안이지만 엔진·모델·서비스 이름을 쓰지 않는다**(§6-0 ⑨ 의 예외 — 사전은 엔진 독립 데이터다). "읽기 확인"·"미리듣기"·"선생님 목소리 서비스" 같은 중립 용어만 쓴다.

### 10-0. 한눈에 보는 결정

1. **경로 2개 · 메뉴 1행**: `/admin/speech/tts/lexicon`(사전 목록 — 항목·가져오기·내보내기 시트 포함) · `/admin/speech/tts/lexicon/versions`(버전 기록 — 버전 상세·되돌리기 시트). 메뉴는 "엔진" 묶음의 **음성 합성 바로 아래 "발음 사전"** 한 줄(`voices.read`). 바 제목은 가장 긴 접두사 규칙으로 두 경로 모두 "발음 사전". TTS 역할 페이지 맨 아래에 링크 카드 하나.
2. **한 화면 = 목록 + 시트**: 추가·수정·보기·끄기·다시 켜기는 공용 `Sheet` 하나(`LexiconEntrySheet`)의 모드다. 항목 상세 경로를 따로 만들지 않는다(항목 단건 GET 이 정본에 없다).
3. **목록은 폭으로 모양을 바꾼다**: 목록 컨테이너 ≥720px(데스크톱) = `<table>` 7열(표기·읽기·악센트·우선순위·범위·상태·수정), <720px(360·390·412) = 카드 행. 같은 데이터·같은 동작, 가로 스크롤 0. 필터(검색·범위·대상·꺼진 항목 포함)·쪽 번호는 URL 쿼리에 남긴다(새로 고침·뒤로 가기 보존 — §6 Diagnostics·Configuration 과 같은 "서버 page 가 읽어 `initial*` 로 넘기고 클라이언트는 `router.replace`" 방식).
4. **쓰기 권한 4갈래**(§10-1 표): `voices.read` 만 → 보기 전용(쓰기·미리듣기 버튼이 DOM 에 없음) · `voices.manage` → 쓰기·미리듣기 · PRODUCTION 에서 `config.apply.production` 없음(ADMIN·DEVELOPER) → 보기 + 미리듣기 · PRODUCTION + SUPER_ADMIN → 쓰기 + **확인 문구 `PRODUCTION` 입력**, 확정 버튼 이름에 환경명("PRODUCTION 에 저장").
5. **모든 쓰기에 이유 필수**(1~200자, 빠른 이유 칩으로 채울 수 있음)와 **`baseVersion`**(화면이 마지막으로 본 사용 중 사전 번호). 409 `VERSION_CONFLICT` 는 입력을 지우지 않고 "다른 곳에서 사전이 바뀌었어요 (v{a} → v{b})" + [새로 불러오기].
6. **저장 1번 = 새 사전 버전 1개.** 성공 토스트에 새 번호를 보인다("저장했어요 · 사전 v8"). 여러 변경을 한 버전으로 묶어 게시하는 기능(16 §2.3)은 이번에 없다(§10-11 ⑩).
7. **지우기 없음**: 버튼 이름은 "끄기"다(`DELETE` = `enabled=false`). 확인 단계에서 "지우지 않아요 — 버전 기록과 내보내기에 남고 언제든 다시 켤 수 있어요"를 말한다. 꺼진 항목은 "다시 켜기"(`PUT enabled:true`)로 되살린다. 목록 발밑에 "항목은 지우지 않고 끄기만 해요" 한 줄.
8. **저장 전 미리듣기**(시트 안 `LexiconPreviewPanel`): 예문 → [읽기 확인] → **적용 전(지금 사전 v{n}) / 적용 후(이 입력 반영)** 두 줄에 가나 읽기·높낮이 표기(↑↓)·[▶]. 초안은 저장되지 않는다(`draftEntries`). 두 줄이 같으면 "지금과 같게 읽어요", 예문에 표기가 걸리지 않으면 ⚠ 안내. 입력이 바뀌면 결과를 흐리게 하고 "입력이 바뀌었어요 — 다시 확인해 주세요".
9. **악센트 입력 = 모라 칩**(`0 평판 | 1 ニ | 2 ホ | …`, 칩 = "이 모라 다음에서 내려감") + 입력값의 표기(`ニ↑ホンバシ`). **지금 선생님 목소리는 읽기만 따르고 높낮이는 스스로 정한다**(방식 A 치환) — 화면은 이것을 숨기지 않는다: 악센트 칸 아래 한 줄 + 미리듣기 "적용 후" 는 **실제로 읽을 높낮이**(§10-11 ①).
10. **가져오기 = 미리 보기 뒤 적용**: 파일(CSV/JSON, ≤256KB·≤2,000행) + 방식(합치기 MERGE / 범위 바꾸기 REPLACE_SCOPE — 위험 설명) → [변경 내용 미리 보기](dryRun) → 추가·수정·끄기·그대로·오류 수 + 행별 오류표 + 바뀌는 항목 → **오류 0 이고 바뀌는 것이 있을 때만** 이유 → [적용]. 파일·방식을 바꾸면 미리 본 결과를 버린다. 적용은 dryRun 때의 `baseVersion` 을 보내고, 그 사이 바뀌었으면 409 → 다시 미리 보기.
11. **내보내기**는 보기 전용 역할도 쓴다(`voices.read`): CSV / JSON 을 골라 사용 중 사전 전체(꺼진 항목 포함)를 내려받는다. 파일명 `kaiwa-lexicon-{env}-v{n}.{csv|json}`.
12. **버전 기록**: 번호·상태(사용 중 / 이전 / 되돌려짐)·시각·작업자·요약·항목 수. 행 → 상세 시트(직전 버전과 비교) → [v{n} 내용으로 되돌리기](지금과 비교 + 이유 + PRODUCTION 확인) → 새 버전. 사용 중 버전과 지금과 내용이 같은 버전에는 되돌리기 확정 버튼이 없다.
13. **서버 문구 비노출**: 이 화면은 서버 `message` 를 그리지 않는다(HTTP status·코드로 고른 §10-8 문구만). 가져오기 행 오류도 코드 → 문구.

### 10-1. 화면 개요 · 메뉴

| 항목 | 내용 |
|---|---|
| 목적 | 관리자·개발자가 선생님 목소리가 **잘못 읽는 단어**(인명·지명·외래어·숫자 예외)의 읽기를 고치고, 저장 전에 들어 보고, 잘못 고쳤으면 이전 버전 내용으로 되돌린다 |
| 진입 | 콘솔 메뉴 "엔진 › 발음 사전" · TTS 역할 페이지(`/admin/speech/tts`) 맨 아래 "발음 사전 ›" 카드 · 버전 기록은 목록 요약 카드의 "버전 기록 ›" |
| 역할별 가시성 | USER: 두 경로 모두 `/admin/**` 404(§6) · ADMIN·DEVELOPER·SUPER_ADMIN: 메뉴 보임(`voices.read`), 쓰기는 아래 표 |
| 환경 | 지금 프로세스 환경(`APP_ENV`)의 사전만 보고 바꾼다. 환경 띠(§6)는 그대로, 요약 카드 제목에 "{env} 사전 v{n}" 을 한 번 더 쓴다. 다른 환경 사전 편집(role-permission §6-6)은 없다 |
| 앱/웹 분기 | 없음. 앱 WebView(≈390)는 내보내기 파일 저장이 안 될 수 있어 앱에서만 안내 한 줄(§10-2 H) |
| 하단 탭 | 없음(콘솔 셸) |
| 음성 | 미리듣기 ▶ 만. 자동재생 없음 — ▶ 탭 핸들러 안에서만 재생 시작(§7-0 ⑧ 과 같은 규칙) |

**메뉴 행**(`src/modules/admin/console/menu.ts`, `speech-tts` 바로 다음 — 소유 §10-11 ⑫)
```ts
{ id: 'speech-tts-lexicon', path: '/admin/speech/tts/lexicon', label: '발음 사전', capability: 'voices.read', phase: 1, group: 'speech' },
```
`labels.ts` → `MENU_SUB['speech-tts-lexicon'] = '읽기·악센트 고치기·버전'`. 바: "AI Engine Console · 엔진 / 발음 사전"(버전 기록 경로도 같은 제목, 본문 `h2` 가 "버전 기록").

**페이지 가드**(§6-2 B — 모든 `page.tsx` 첫 줄)

| 경로 | page capability | 화면 | 서버가 읽어 넘기는 쿼리(검증 후) |
|---|---|---|---|
| `/admin/speech/tts/lexicon` | `voices.read` | `LexiconScreen` | `q`(≤40자) · `scope`(5종 중 하나) · `ref`(`/^[\w-]{1,40}$/`) · `inactive`(`'1'`) · `page`(1~1000 정수) — 틀리면 버린다 |
| `/admin/speech/tts/lexicon/versions` | `voices.read` | `LexiconVersionsScreen` | `v`(1 이상 정수) — 틀리면 버린다 |

**쓰기 권한 표**(`useLexiconAccess()` — 숨김용일 뿐, 서버가 진실)

| 상황 | 목록·보기·내보내기·버전 보기 | 미리듣기·문장 읽기 확인 | 추가·수정·끄기/켜기·가져오기·되돌리기 | 안내 줄(요약 카드 아래) |
|---|---|---|---|---|
| `voices.read` 만 | ✅ | — (패널 없음) | — (버튼 DOM 0) | 보기 전용이에요 — 바꾸려면 voices.manage 권한이 필요해요. |
| `voices.manage`, env ≠ PRODUCTION | ✅ | ✅ | ✅ 이유 필수 | 없음 |
| `voices.manage`, env = PRODUCTION, `config.apply.production` 없음(ADMIN·DEVELOPER) | ✅ | ✅ | — (버튼 DOM 0) | 운영 환경 사전은 SUPER_ADMIN 만 바꿀 수 있어요. 읽기 확인·미리듣기는 할 수 있어요. |
| SUPER_ADMIN, env = PRODUCTION | ✅ | ✅ | ✅ 이유 + 확인 문구 `PRODUCTION` | 운영 환경 사전이에요 — 바꾸면 모든 학습자의 선생님 목소리 읽기가 바뀌어요. |

```ts
// src/components/admin/lexicon/useLexiconAccess.ts
const can = useCan(); const env = useConsoleEnv()
const canManage = can('voices.manage')
const canWrite = canManage && (env !== 'PRODUCTION' || can('config.apply.production'))
return {
  canManage, canWrite, canPreview: canManage, needsConfirm: canWrite && env === 'PRODUCTION', env,
  note: !canManage ? 'READ_ONLY' : !canWrite ? 'PROD_SUPER_ONLY' : env === 'PRODUCTION' ? 'PROD_WARN' : null,
}
```
- 현 역할 표(role-permission §3)에서는 콘솔 역할이 모두 `voices.manage` 를 가져 "`voices.read` 만"인 계정이 없다. 이 갈래는 코드로 두고 단위 테스트(가짜 capability)로 확인한다(§10-9, §10-11 ⑬).

### 10-2. UI 구조 (의사코드, 390px 기준)

#### A. 사전 목록 — `/admin/speech/tts/lexicon` · `LexiconScreen`

```tsx
// src/app/(admin)/admin/speech/tts/lexicon/page.tsx (서버)
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const g = await requireConsolePage('voices.read', { path: '/admin/speech/tts/lexicon' })
  if (!g.allowed) return <ConsoleForbidden missing={g.missing} role={g.viewer.role} />
  return <LexiconScreen initialParams={parseLexiconParams(await searchParams)} />   // §10-1 표의 검증, 틀린 값은 버린다
}
```

```
<p className="text-[13px] text-ink2 break-keep">{INTRO}</p>                                   ← §10-8 ⓐ
<details className="mt-1"><summary className="flex h-11 cursor-pointer items-center text-[13px] font-medium">적용 규칙</summary><RulesNote /></details>
<LexiconSummaryCard list={list.data} env now />
{access.note && <p role="note" className="mt-2 rounded-xl bg-surface2 px-3 py-2 text-[13px] text-ink break-keep">{NOTE[access.note]}</p>}
<div className="@container mt-3"><div className="flex flex-col gap-2 @min-[720px]:flex-row">             ← 액션 줄
  {access.canWrite && <Btn variant="primary" className="w-full @min-[720px]:w-auto" onClick={openAdd}>＋ 항목 추가</Btn>}
  <div className="flex gap-2 [&>*]:min-w-0 [&>*]:flex-1 @min-[720px]:[&>*]:flex-none">
    {access.canWrite && <Btn variant="ghost" onClick={openImport}>가져오기</Btn>}
    <Btn variant="ghost" onClick={openExport}>내보내기</Btn>
  </div>
</div></div>
{access.canPreview && <LexiconSentenceCheck voices />}                                            ← §E 끝 · 선택(구현 순서 마지막)
<LexiconFilters params voices onChange={setParams} />                                            ← §C
<RefreshLine loadedAt reloading onReload={list.reload} />
{list.status === 'loading' && !list.data ? <ConsoleLoading /> :
 list.err && !list.data ? <LoadError err={list.err} name="발음 사전" onRetry={list.reload} /> :
 <>
   <p aria-live="polite" className="mb-1.5 mt-1 text-[12px] text-ink2">{total}개{filtered ? ' · 조건에 맞는 항목' : ''}</p>
   {items.length === 0 ? <EmptyNote>{filtered ? EMPTY_FILTERED : EMPTY_ALL}</EmptyNote>
                       : <LexiconList items total page canWrite voiceName now onOpen={openEntry} />}
   <Pager page pageSize total onPage />                                                              ← total ≤ pageSize 면 그리지 않는다
   <p className="mt-3 text-[12px] text-ink2 break-keep">항목은 지우지 않고 끄기만 해요 — 버전 기록과 내보내기에 남아요.</p>
 </>}
<LexiconEntrySheet … />  <LexiconImportSheet … />  <LexiconExportSheet … />
```
- 버튼 `Btn` 기본 크기(h-12)를 쓴다 — `size="sm"`(38px)은 콘솔 터치 기준(44px) 미달이라 쓰지 않는다.

**LexiconSummaryCard**
```
<Card className="mt-2">
  <div className="flex min-w-0 items-center gap-2">
    <h2 className="min-w-0 flex-1 truncate text-[16px] font-semibold">{env} 사전 v{dictionaryVersion}</h2>
    <Link href="/admin/speech/tts/lexicon/versions" className="-my-2 inline-flex h-11 flex-none items-center text-[13px] font-medium text-accent">버전 기록 ›</Link>
  </div>
  {counts && <p className="text-[13px] text-ink2">사용 중 {counts.enabled} · 꺼짐 {counts.disabled}</p>}
  {active && <p className="mt-0.5 truncate text-[12px] text-ink2">마지막 변경 {formatAgo(active.createdAt, now)} · {actorLabel(active.actor)}{active.changeSummary ? ` · ${active.changeSummary}` : ''}</p>}
  {dictionaryVersion === 0 && <p className="text-[13px] text-ink2">아직 사전 버전이 없어요 — 첫 항목을 추가하면 v1 이 만들어져요.</p>}
</Card>
```
- `changeSummary` 는 서버가 만든 한 줄(≤300자)이라 `truncate`. 전문은 버전 기록에서 본다.
- 목록을 아직 못 읽었으면 제목 자리에 "{env} 사전" 만(번호 없음).

**RulesNote**(접힘, 12.5px ink2 목록 4줄): ① 범위가 좁을수록 먼저 적용돼요: 사용자 > 목소리 > 레슨 > 코스 > 전체 ② 한 문장 안에서는 긴 표기가 먼저예요(日本橋駅 이 日本橋 보다 먼저). 길이가 같으면 우선순위가 큰 쪽 ③ 꺼진 항목은 쓰이지 않지만 버전 기록과 내보내기에 남아요 ④ 바꾸면 다음 문장부터 반영돼요. 이미 만든 소리는 새 사전으로 다시 만들어요. — 일본어 예시 단어는 `<span lang="ja">`.

와이어프레임(390px, LOCAL, DEVELOPER):
```
┌──────────────────────────────────────┐
│ LOCAL  개발 환경 — 운영과 분리된…  v0.1.0 │
│ ☰  AI Engine Console · 엔진     ↩ 앱으로 │
│    발음 사전                            │
├──────────────────────────────────────┤
│ 선생님 목소리가 잘못 읽는 단어(인명·지명·  │
│ 외래어 등)의 읽기를 고쳐요. 바꾸면 다음 …  │
│ 적용 규칙                           ˅  │
│ ┌ LOCAL 사전 v7           버전 기록 › ┐ │
│ │ 사용 중 6 · 꺼짐 1                   │ │
│ │ 마지막 변경 3분 전 · 관리자 · 日本橋 … │ │
│ └────────────────────────────────────┘ │
│ [            ＋ 항목 추가            ] │ h-12 primary
│ [    가져오기    ] [    내보내기    ]   │ h-12 ghost
│ 문장으로 읽기 확인                   ˅  │ (선택)
│ ┌ ⌕ 표기·읽기 검색 (예: 日本橋, ニホン) ┐ │
│ [모든 범위][GLOBAL][COURSE][LESSON][VO→ │ ChipRadio
│ [꺼진 항목 포함]                          │ ToggleButton
│ 마지막 갱신 16:32:05     [다시 불러오기] │
│ 7개                                    │
│ ┌──────────────────────────────────┐ │
│ │ 日本橋                     ●사용 중 │ │ 17px ja
│ │ ニホンバシ · 악센트 0(평판)           │ │ 15px ja + 13px
│ │ GLOBAL · 우선 10 · 지명 · 3분 전    › │ │ 12px ink2
│ ├──────────────────────────────────┤ │
│ │ 等々力                         꺼짐 │ │
│ │ トドロキ · 악센트 0(평판)             │ │
│ │ VOICE 하루카 · 우선 10 · 지명 · 어제 › │ │
│ └──────────────────────────────────┘ │
│ 항목은 지우지 않고 끄기만 해요 — 버전 기록과…│
└──────────────────────────────────────┘
```

데스크톱(≥1024, 사이드바 + 본문 최대 960):
```
│ 사이드바     │ 선생님 목소리가 잘못 읽는 단어(…)의 읽기를 고쳐요. 바꾸면 다음 문장부터 반영돼요.          │
│ 엔진         │ ┌ LOCAL 사전 v7                                                  버전 기록 › ┐ │
│  실시간 음성… │ │ 사용 중 6 · 꺼짐 1 · 마지막 변경 3분 전 · 관리자 · 日本橋 악센트 수정          │ │
│  분석 음성 … │ └──────────────────────────────────────────────────────────────────────────┘ │
│  음성 합성    │ [＋ 항목 추가] [가져오기] [내보내기]                                          │
│ ▌발음 사전    │ ┌ ⌕ 표기·읽기 검색 ──────────┐                              [꺼진 항목 포함]   │
│  LLM         │ [모든 범위][GLOBAL][COURSE][LESSON][VOICE][USER]                             │
│ 자원 …       │ ┌──────────┬───────────┬────────┬─────┬───────────┬───────┬────────┐       │
│              │ │ 표기      │ 읽기        │ 악센트  │ 우선 │ 범위        │ 상태   │ 수정    │       │
│              │ ├──────────┼───────────┼────────┼─────┼───────────┼───────┼────────┤       │
│              │ │ 日本橋    │ ニホンバシ   │ 0 평판 │ 10  │ GLOBAL     │●사용 중│ 3분 전  │       │
│              │ │ 神保町    │ ジンボーチョー│ 3      │ 10  │ GLOBAL     │●사용 중│ 어제    │       │
│              │ │ 等々力    │ トドロキ     │ 0 평판 │ 10  │ VOICE 하루카│ 꺼짐   │ 어제    │       │
│              │ └──────────┴───────────┴────────┴─────┴───────────┴───────┴────────┘       │
│              │ ‹ 이전                    1 / 1                    다음 ›                    │
```
- 액션 줄: <720 은 [＋ 항목 추가] 전폭 한 줄 + [가져오기][내보내기] 반반. ≥720 은 한 줄 왼쪽 정렬.
- 필터: <720 은 검색 → 범위 칩 → (대상) → 토글 세로. ≥720 은 검색(최대 360px)과 토글이 한 줄(`@min-[720px]:flex-row justify-between`), 칩은 그 아래.

#### B. 항목 목록 — `LexiconList` · `EntryStatusBadge` · `Pager`

```tsx
<div className="@container">
  <table className="hidden w-full table-fixed border-separate border-spacing-0 overflow-hidden rounded-[14px] border border-line bg-surface @min-[720px]:table">
    <caption className="sr-only">발음 사전 항목 {total}개 중 {from}–{to}</caption>
    <colgroup>표기 20% · 읽기 22% · 악센트 10% · 우선 7% · 범위 17% · 상태 11% · 수정 13%</colgroup>
    <thead><tr className="text-left text-[12px] text-ink2">
      {['표기','읽기','악센트','우선순위','범위','상태','수정'].map(h => <th scope="col" className="px-3 py-2 font-medium">{h}</th>)}
    </tr></thead>
    <tbody>{items.map(e =>
      <tr key={e.id} onClick={() => onOpen(e)} className="cursor-pointer align-top hover:bg-surface2 [&>td]:border-t [&>td]:border-line [&>td]:px-3 [&>td]:py-2">
        <td><button type="button" aria-label={`${e.surface} ${canWrite ? '고치기' : '보기'}`} onClick={stop(onOpen(e))}
                    lang="ja" className="min-h-11 w-full text-left text-[16px] font-semibold [overflow-wrap:anywhere]">{e.surface}</button></td>
        <td lang="ja" className="pt-3 text-[15px] [overflow-wrap:anywhere]">{e.reading}</td>
        <td className="pt-3 text-[13px] tabular-nums">{e.accentType}{e.accentType === 0 && <span className="text-ink2"> 평판</span>}</td>
        <td className="pt-3 text-[13px] tabular-nums">{e.priority}</td>
        <td className="pt-3 text-[13px]"><span className="font-mono">{e.scope}</span>{e.scopeRefId && <span className="block truncate text-[12px] text-ink2">{refLabel(e)}</span>}</td>
        <td className="pt-3"><EntryStatusBadge enabled={e.enabled} /></td>
        <td className="pt-3 text-[12px] text-ink2">{formatAgo(e.updatedAt, now)}</td>
      </tr>)}
    </tbody>
  </table>
  <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface @min-[720px]:hidden">
    {items.map(e => <li key={e.id}>
      <button type="button" onClick={() => onOpen(e)} className="flex min-h-[64px] w-full min-w-0 flex-col gap-0.5 px-3.5 py-2.5 text-left">
        1줄 <span className="flex min-w-0 items-start gap-2">
              <span lang="ja" className="min-w-0 flex-1 text-[17px] font-semibold [overflow-wrap:anywhere]">{e.surface}</span>
              <EntryStatusBadge enabled={e.enabled} /></span>
        2줄 <span className="min-w-0 text-[13px] text-ink2 [overflow-wrap:anywhere]"><span lang="ja" className="text-[15px] text-ink">{e.reading}</span> · 악센트 {e.accentType}{e.accentType === 0 ? '(평판)' : ''}</span>
        3줄 <span className="flex min-w-0 gap-2 text-[12px] text-ink2">
              <span className="min-w-0 flex-1 truncate"><span className="font-mono">{e.scope}</span>{e.scopeRefId ? ` ${refLabel(e)}` : ''} · 우선 {e.priority}{e.wordType ? ` · ${WORD_TYPE_KO[e.wordType]}` : ''} · {formatAgo(e.updatedAt, now)}</span>
              <span aria-hidden="true">›</span></span>
      </button></li>)}
  </ul>
</div>
```
- 행 전체가 누르는 곳이다. 표에서는 첫 칸 `<button>` 이 키보드·스크린리더 진입점이고 `<tr onClick>` 은 마우스 편의일 뿐이다(`tr` 에 role·tabIndex 를 주지 않는다. 버튼 클릭이 tr 로 두 번 올라가지 않게 `stopPropagation`).
- 표기·읽기는 **자르지 않고 줄바꿈**한다(`[overflow-wrap:anywhere]`) — 40자 표기도 칸 안에서 여러 줄. 범위의 대상만 `truncate`(전체는 시트에서).
- `refLabel(e)`: VOICE → #82 목록의 `displayName`(못 찾으면 id 앞 8자 + "…") · 그 밖 → id 앞 8자 + "…"(모노).
- 꺼진 항목 행을 흐리게 하지 않는다(명암비) — 뱃지 "꺼짐"만.
- 두 모양이 모두 DOM 에 있고 하나는 `display:none` 이다(스크린리더에는 하나만 읽힌다). E2E 는 보이는 쪽만 센다(`:visible`).

**EntryStatusBadge**(`lexicon/Badges.tsx`)
```
enabled  → <span aria-label="상태: 사용 중" className="inline-flex h-[22px] flex-none items-center gap-1 rounded-md bg-good-soft px-2 text-[11.5px] font-semibold text-good"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-good" />사용 중</span>
disabled → <span aria-label="상태: 꺼짐" className="… bg-surface2 text-ink2">꺼짐</span>
```

**Pager**
```
<nav aria-label="쪽 이동" className="mt-3 flex items-center justify-between">
  <button type="button" disabled={page <= 1} className="h-11 px-3 text-[14px] font-medium text-ink disabled:text-ink2">‹ 이전</button>
  <span aria-live="polite" className="text-[13px] tabular-nums text-ink2">{page} / {pages}</span>
  <button type="button" disabled={page >= pages} className="h-11 px-3 text-[14px] font-medium text-ink disabled:text-ink2">다음 ›</button>
</nav>
```
- 쪽을 바꾸면 `document.querySelector('[data-app-shell] main')?.scrollTo({ top: 0 })`.
- 목록을 읽은 뒤 `page > pages`(항목을 끄고 꺼진 항목 포함을 해제한 경우 등)면 마지막 쪽으로 `router.replace`.

#### C. 필터 — `LexiconFilters`

```
<input type="search" aria-label="표기·읽기 검색" placeholder="표기·읽기 검색 (예: 日本橋, ニホン)" enterKeyHint="search" lang="ja"
       className="{INPUT} mt-3" value={qDraft} onChange />                        ← 300ms 디바운스 → setParams({ q }) (IME 조합 중에는 보내지 않는다)
<div className="mt-2"><ChipRadio ariaLabel="범위" options={[
   { value: 'ALL', label: '모든 범위' }, { value: 'GLOBAL', label: 'GLOBAL', mono: true }, …COURSE·LESSON·VOICE·USER(mono) ]} value={scope} /></div>
{scope === 'VOICE' && <select aria-label="목소리" className="{INPUT} mt-2">모든 목소리 · {#82 displayName}</select>}                ← setParams({ ref })
{scope ∈ COURSE|LESSON|USER && <input aria-label="대상 id" placeholder="대상 id (선택)" autoCapitalize="off" spellCheck={false}
                                         className="{INPUT} mt-2 font-mono" />}                                                     ← 500ms 디바운스 → ref
<div className="mt-2 flex items-center gap-2"><ToggleButton pressed={inactive} onToggle>꺼진 항목 포함</ToggleButton></div>
```
- URL 쿼리: `q` · `scope`(ALL 이면 뺀다) · `ref` · `inactive=1` · `page`(1 이면 뺀다). 필터가 바뀌면 `page` 를 뺀다. `router.replace('/admin/speech/tts/lexicon?…', { scroll: false })`.
- 목록 경로 = `/api/admin/v1/lexicon?` + `q` · `scope` · `scopeRefId=ref` · `enabled=inactive ? 'all' : '1'` · `page` · `pageSize=50`(§10-11 ⑤). 범위가 ALL 이 되면 `ref` 도 뺀다.
- 검색어는 그대로 보낸다(히라가나로 쳐도 읽기에서 찾는 것은 서버 몫, §10-11 ⑤).
- `INPUT` 클래스는 §4-2 B 와 같은 모양을 lexicon 안 상수로 둔다: `h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-[16px] text-ink placeholder:text-ink3`(placeholder 의 ink3 는 §1-1 허용). `(app)` 의 `AcceptCorrectionSheet` 를 import 하지 않는다. `select` 도 같은 높이·테두리.

#### D. 항목 시트 — `LexiconEntrySheet` (mode: `'add' | 'edit' | 'view' | 'confirmDisable' | 'confirmEnable' | 'discard'`)

열기: [＋ 항목 추가] → `add` · 행 → `canWrite ? 'edit' : 'view'`. 제목: 항목 추가 / 항목 고치기 / 항목 보기 / 항목 끄기 / 항목 다시 켜기 / (discard 는 앞 제목 유지).
`dismissible={!submitting}`. 닫기(✕·배경·Esc) 때 `dirty` 면 닫지 않고 `discard` 모드로. 모드가 바뀌면 시트 제목으로 포커스.

```
mode 'add' | 'edit':
  {mode === 'edit' && <EntryHead entry />}        ← 표기(lang=ja 20px semibold) + 상태 뱃지 / 12px ink2 "{scope} · {대상} · {종류}" / 12px ink2 "표기·범위는 바꿀 수 없어요 — 끄고 새로 추가해 주세요."
  {mode === 'edit' && !entry.enabled &&
     <p className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 rounded-xl bg-surface2 px-3 py-1.5 text-[13px] text-ink">
       꺼진 항목이에요. 고쳐 저장해도 꺼진 채로 남아요.
       <button type="button" className="h-11 font-semibold text-accent" onClick={→ 'confirmEnable'}>다시 켜기</button></p>}
  <EntryForm mode draft errors voices onChange />      ← 아래
  {canPreview && <LexiconPreviewPanel mode="compare" draft={validDraft} voices lockedVoiceId={draft.scope === 'VOICE' ? draft.scopeRefId : null} />}   ← §E
  <hr className="my-4 border-line" />
  <WriteConfirmFields reason confirm needsConfirm quick={QUICK_REASONS.save} errors />                                                          ← §F
  {notice && <SheetNotice notice onAction />}           ← 409·403·404·500·0(§10-8 ⓓ). 필드 오류(422)는 각 칸 아래
  <p className="mt-2 text-[12px] text-ink2">저장하면 사전 v{baseVersion + 1} 이 만들어지고 다음 문장부터 반영돼요.</p>
  <BtnRow>
    <Btn variant="primary" aria-busy={submitting} onClick={submit}>{submitting ? '저장하는 중…' : needsConfirm ? 'PRODUCTION 에 저장' : '저장'}</Btn>
    <Btn variant="ghost" onClick={requestClose}>취소</Btn>
  </BtnRow>
  {mode === 'edit' && entry.enabled && <button type="button" className="mt-2 flex h-11 w-full items-center justify-center text-[14px] font-semibold text-bad" onClick={→ 'confirmDisable'}>이 항목 끄기</button>}

mode 'view':   (보기 전용 · PRODUCTION 의 ADMIN·DEVELOPER)
  <EntryHead entry />
  <Card flat className="mt-3"><KeyValueList items=[
     읽기 {reading}(node: lang=ja 16px) · 악센트 {n}{n===0 ? ' 평판' : ''} {accentNotation}(lang=ja) · 우선순위 {priority} · 범위 {SCOPE_KO[scope]}
     · 대상 <MonoId value={scopeRefId} copy label="대상 id" />(GLOBAL 이면 행 없음) · 종류 · 메모 · 상태 · 수정 {formatDateTime(updatedAt)} ] /></Card>
  {canPreview && <LexiconPreviewPanel mode="current" initialText={entry.surface} voices />}
  <Btn variant="ghost" className="mt-3 w-full" onClick={onClose}>닫기</Btn>

mode 'confirmDisable':
  <p lang="ja" className="text-[20px] font-semibold [overflow-wrap:anywhere]">{surface}</p>
  <p className="mt-1 text-[14px] break-keep">이 항목을 끌까요? 다음 문장부터 이 읽기(<span lang="ja">{reading}</span>)를 쓰지 않아요.</p>
  <p className="mt-1 text-[13px] text-ink2 break-keep">지우지 않아요 — 버전 기록과 내보내기에 남고, 언제든 다시 켤 수 있어요.</p>
  <WriteConfirmFields quick={QUICK_REASONS.disable} … />
  {notice && <SheetNotice … />}
  <BtnRow><Btn variant="danger" aria-busy>{needsConfirm ? 'PRODUCTION 에서 끄기' : '끄기'}</Btn><Btn variant="ghost">돌아가기</Btn></BtnRow>   ← 돌아가기 = 'edit'(입력 유지) → L4

mode 'confirmEnable':  같은 모양 — "이 항목을 다시 켤까요? 다음 문장부터 이 읽기를 다시 써요." · 빠른 이유 `QUICK_REASONS.enable`
  <BtnRow><Btn variant="primary">{needsConfirm ? 'PRODUCTION 에서 다시 켜기' : '다시 켜기'}</Btn><Btn variant="ghost">돌아가기</Btn></BtnRow>   → L3 `{enabled: true, reason, baseVersion, confirm?}`

mode 'discard':
  <p className="text-[15px]">저장하지 않은 입력이 있어요. 닫을까요?</p>
  <BtnRow><Btn variant="danger">입력 버리고 닫기</Btn><Btn variant="ghost">계속 쓰기</Btn></BtnRow>
```

**EntryForm**(add 는 모든 칸, edit 는 표기·범위·대상 칸 없음 — `EntryHead` 가 보여 준다)
```
Field 표기*      input#lexSurface lang=ja placeholder="예: 日本橋, 等々力"                    1~40   ← add 만, 시트가 열리면 자동 포커스
Field 읽기*      input#lexReading lang=ja placeholder="예: ニホンバシ (히라가나로 써도 돼요)" autoCapitalize="off" spellCheck={false}
                 onChange: 친 그대로 보관 · onBlur·저장 직전: toKatakana(trim) 로 바꿔 칸에 다시 쓴다(IME 조합 중에는 바꾸지 않는다)
                 아래 12px ink2: 가나만이면 "가타카나로 저장해요 · {moraCount}모라" / 히라가나가 섞여 있으면 "저장할 때 가타카나로 바꿔요 · {n}모라"
Field 악센트     <AccentPicker reading={toKatakana(draft.reading)} value={draft.accentType} error onChange />             ← 아래
                 아래 12px ink2: "입력한 악센트는 저장돼요. 지금 목소리에는 읽기만 반영되고 높낮이는 목소리가 스스로 정해요."(§10-11 ①)
<div className="grid grid-cols-2 gap-2.5">                                                          ← 360 에서도 2열(각 ≥150px)
  Field 우선순위  input type=number inputMode=numeric min=0 max=100 step=1 (기본 10)               0~100
  Field 종류      select: 선택 안 함 · 고유명사 · 인명 · 지명 · 일반어 · 외래어 · 약어
</div>
<p className="text-[12px] text-ink2">우선순위는 같은 길이의 표기가 겹칠 때만 써요(큰 쪽이 먼저).</p>
Field 범위*      (add 만) <ScopePicker value onChange />                      ← 라디오 카드 5개, 1열(각 min-h-[56px]): 코드(모노) + 한 줄 설명
Field 대상*      (add, scope ≠ GLOBAL)
                   VOICE → select(#82: displayName, 상태가 사용 가능이 아니면 " (꺼짐)" 덧붙임)
                   그 밖 → input font-mono autoCapitalize=off spellCheck=false placeholder="{코스|레슨|사용자} id"   ≤40
                   아래 12px ink2: "저장할 때 서버가 있는 id 인지 확인해요."
Field 메모       textarea rows=2(자동 높이 최대 5줄) placeholder="왜 이렇게 읽는지 (선택)"   ≤200
```
- 길이는 코드포인트(`cpLength`)로 세고 `maxLength` 속성은 쓰지 않는다. [저장]은 늘 누를 수 있고, 틀린 칸이 있으면 요청 없이 **첫 오류 칸으로 포커스** + 칸 아래 12px `text-bad` + `aria-invalid`·`aria-describedby`(§4-2 B 와 같은 규칙). 필수 표시는 라벨 뒤 `<span aria-hidden="true">*</span>` + `aria-required`.
- 검증은 `validateDraft()`(순수, §10-5) → 오류 키 → §10-8 ⓑ 문구. 서버 422 의 필드 코드도 같은 표로 바꾼다.
- `dirty` = add 는 어느 칸이든 값이 있으면 · edit 는 읽기·악센트·우선순위·종류·메모 중 하나가 원래 값과 다르면(이유 칸은 dirty 에 넣지 않는다). edit 에서 `!dirty` 로 [저장]을 누르면 토스트 "바뀐 내용이 없어요", 요청 없음.
- 저장 요청: add → L2 `{surface, reading, accentType, priority, scope, scopeRefId, wordType, note, reason, baseVersion, confirm?}` · edit → L3 `{reading, accentType, priority, wordType, note, reason, baseVersion, confirm?}`(편집 칸 전부). 빈 선택값은 `null`, 문자열은 앞뒤 공백 제거.
- 성공 → 시트 닫기 · 토스트 "저장했어요 · 사전 v{n}" · `baseVersion = n` · 목록 다시 읽기.

**ScopePicker**
```
<div role="radiogroup" aria-label="범위" className="grid gap-2">
  {SCOPES.map(s => <button type="button" role="radio" aria-checked={v === s} className="flex min-h-[56px] min-w-0 flex-col justify-center rounded-xl border px-3 py-2 text-left {v===s ? 'border-accent bg-accent-soft ring-1 ring-accent' : 'border-line bg-surface'}">
     <span className="font-mono text-[13px] font-semibold text-ink">{s}</span>
     <span className="text-[13px] text-ink break-keep">{SCOPE_KO[s]}</span></button>)}
</div>
```
- 선택 표시는 테두리·링(글자는 늘 `ink`) — `accent-soft` 위 글자 명암비 문제 없음(§1-1 `ink`/`accent-soft` 13+).
- 기본값 GLOBAL. 범위를 바꾸면 대상 칸을 비운다.

**AccentPicker**
```
<p id="lexAccentLabel" className="text-[12.5px] font-medium text-ink2">악센트 <span className="font-normal">(내려가는 자리)</span></p>
{moras.length === 0
  ? <p className="text-[12px] text-ink2">읽기를 먼저 입력해 주세요.</p>
  : <div role="radiogroup" aria-labelledby="lexAccentLabel" className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 py-1">
      <button role="radio" aria-checked={v === 0} aria-label="0, 평판 — 내려가지 않음" className="h-11 min-w-[64px] flex-none rounded-full border px-3 text-[13px] {on}">0 평판</button>
      {moras.map((m, i) => <button role="radio" aria-checked={v === i + 1} aria-label={`${i + 1}, ${m} 다음에서 내려감`}
         className="h-11 min-w-[52px] flex-none rounded-full border px-2.5 {on}">
         <span className="mr-1 text-[11px] tabular-nums">{i + 1}</span><span lang="ja" className="text-[16px]">{m}</span></button>)}
    </div>}
{moras.length > 0 && <p lang="ja" aria-label={spokenAccent(notation)} className="mt-1 text-[16px] tracking-wide">{notation}</p>}
{error && <p id="lexAccentErr" className="mt-1 text-[12px] text-bad">{error}</p>}
```
- `moras = splitMoras(toKatakana(reading))`, `notation = accentNotation(moras, v)`. 읽기가 가나가 아니면 칩 대신 "읽기를 먼저 입력해 주세요"(값은 유지).
- 칩 색은 `ChipRadio` 와 같다(선택 `border-accent bg-accent text-on-accent`, 나머지 `border-line bg-surface text-ink`). 선택 칩 안 숫자도 `text-on-accent`(ink2 를 쓰지 않는다 — accent 위 명암비).
- 키보드: roving tabindex(선택 칩만 `tabIndex=0`), ←/→ 로 옮기며 고른다. 고른 칩이 밖이면 `scrollIntoView({ inline: 'nearest', block: 'nearest' })`(첫 그리기 제외).
- 읽기를 바꿔 값이 모라 수를 넘으면 **값을 몰래 바꾸지 않고** 오류 "악센트는 0(평판)부터 {n}(모라 수)까지예요."를 보인다.
- `accentNotation(moras, n)`: n=0 → `m1↑m2…`(한 모라 단어는 화살표 없음) · n=1 → `m1↓m2…` · n≥2 → `m1↑m2…mn↓m(n+1)…`(n = 모라 수면 끝에 `↓`). 미리듣기 `accent` 와 같은 기호다. `spokenAccent` 는 ↑ → " 올라감 ", ↓ → " 내려감 ".

와이어프레임(390, 'edit'):
```
┌ 항목 고치기                          ✕ ┐
│ 日本橋                        ●사용 중 │ 20px ja
│ GLOBAL · 지명                          │
│ 표기·범위는 바꿀 수 없어요 — 끄고 새로 추가…│
│ 읽기*                                  │
│ ┌ ニホンバシ                          ┐ │ 16px ja
│ 가타카나로 저장해요 · 5모라                │
│ 악센트 (내려가는 자리)                    │
│ [0 평판][1 ニ][2 ホ][3 ン][4 バ][5 シ]    │ radiogroup, 가로 스크롤
│ ニ↑ホンバシ                              │
│ 입력한 악센트는 저장돼요. 지금 목소리에는… │
│ 우선순위           종류                  │
│ ┌ 10          ┐  ┌ 지명            ▾ ┐  │
│ 우선순위는 같은 길이의 표기가 겹칠 때만…    │
│ 메모 ┌ 東京 日本橋(大阪 日本橋=ニッポン…┐  │
│ ── 미리듣기 ──────────────────────── │
│ 저장하지 않은 입력으로 읽어 봐요. 사전은…  │
│ 예문 ┌ 日本橋で降ります           ┐ 8/100 │
│ 목소리 ┌ 기본 목소리              ▾ ┐     │
│ [            읽기 확인            ]      │ ghost h-12
│ ┌ 적용 전 · 지금 사전 v7           (▶) ┐│
│ │ ニ↓ホンバシデ オ↑リマス                ││
│ │ 적용 후 · 이 입력                (▶) ││
│ │ ニ↑ホンバシデ オ↑リマス                ││
│ │ ● 읽기가 달라져요 · 이 예문에 1번 적용   ││
│ └──────────────────────────────────┘│
│ ────────────────────────────────── │
│ 변경 이유*                              │
│ ┌                               ┐ 0/200│
│ [오독 수정][새 고유명사][악센트 조정][우선…→│
│ 저장하면 사전 v8 이 만들어지고 다음 문장부터…│
│ [      저장      ] [      취소      ]  │
│             이 항목 끄기                 │ text-bad 44px
└─────────────────────────────────────┘
```

#### E. 미리듣기 — `LexiconPreviewPanel` (mode: `'compare' | 'current'`) · `LexiconSentenceCheck`

```
<section aria-labelledby="lexPreviewTitle" className="mt-4">
  <h3 id="lexPreviewTitle" className="text-[14px] font-semibold">미리듣기</h3>
  <p className="text-[12px] text-ink2 break-keep">{mode === 'compare' ? '저장하지 않은 입력으로 읽어 봐요. 사전은 바뀌지 않아요.' : '지금 사전으로 읽어 봐요.'}</p>
  Field 예문    textarea lang=ja rows=1(자동 높이 최대 3줄) ≤100, 카운터 "{n}/100"
                처음 값 = 표기. 사용자가 예문을 직접 고치기 전까지는 표기를 따라 바뀐다(`exampleTouched`)
  Field 목소리  select: "기본 목소리"(voiceId 생략) + #82 중 `status === 'AVAILABLE' && enabled` 인 것(displayName)
                `lockedVoiceId` 가 있으면(VOICE 범위 초안) 그 목소리로 고정·비활성 + 12px ink2 "목소리 범위 항목이라 그 목소리로 들어요"
  <Btn variant="ghost" className="mt-2 w-full" aria-busy={phase === 'checking'} disabled={cooling} onClick={check}>
    {phase === 'checking' ? '읽는 중…' : cooling ? `${n}초 뒤 다시` : '읽기 확인'}</Btn>
  {mode === 'compare' && !draftValid && <p className="mt-1 text-[12px] text-ink2">표기·읽기를 올바르게 입력하면 확인할 수 있어요.</p>}   ← 이때 [읽기 확인]은 누르면 첫 오류 칸 포커스(요청 없음)
  <div aria-live="polite" className="min-w-0">
    {result && <div className="mt-2 rounded-xl border border-line bg-surface2 p-3 {stale ? 'opacity-60' : ''}">
       <ReadingRow label={mode === 'compare' ? `적용 전 · 지금 사전 v${d.dictionaryVersion}` : `지금 사전 v${d.dictionaryVersion}`} side={d.before} which="before" />
       {d.after && <ReadingRow label="적용 후 · 이 입력" side={d.after} which="after" className="mt-2 border-t border-line pt-2" />}
       {d.after && <p className="mt-2 flex items-start gap-1.5 text-[13px] text-ink break-keep">
          <span aria-hidden="true" className="mt-1.5 h-2 w-2 flex-none rounded-full {changed ? 'bg-good' : 'bg-ink2'}" />
          {changed ? '읽기가 달라져요' : '지금과 같게 읽어요'}{hits > 0 ? ` · 이 예문에 ${hits}번 적용` : ''}</p>}
       {d.after && hits === 0 && <p className="mt-1 text-[13px] text-ink break-keep">⚠ 이 예문에는 이 항목이 걸리지 않았어요. 예문에 표기 「<span lang="ja">{surface}</span>」가 있는지, 더 긴 표기의 다른 항목이 먼저 걸리지 않았는지 확인해 주세요.</p>}
       {stale && <p className="mt-1 text-[12px] text-ink2">입력이 바뀌었어요 — 다시 확인해 주세요.</p>}
    </div>}
    {notice && <p className="mt-2 text-[13px] text-ink break-keep">{notice}</p>}          ← 429·502/503/504·422(예문)·소리 실패·0(§10-8 ⓒ)
  </div>
</section>
```

**ReadingRow**
```
<div className="flex min-w-0 items-start gap-2 {className}">
  <div className="min-w-0 flex-1">
    <p className="text-[12px] text-ink2">{label}</p>
    <p lang="ja" aria-label={spokenAccent(side.accent || side.reading)} className="text-[16px] leading-[1.7] [overflow-wrap:anywhere]">{side.accent || side.reading}</p>
    {side.accent && stripArrows(side.accent) !== side.reading && <p lang="ja" className="text-[13px] text-ink2 [overflow-wrap:anywhere]">{side.reading}</p>}
  </div>
  <PlayButton which playing={playing === which} loading={audioLoading === which} disabled={stale || cooling} onClick={() => play(which)} />
</div>
```
- `PlayButton`: 44×44 원형 `border border-line bg-surface`, ▶ / ■(재생 중) / "…"(받는 중, 정적 — `prefers-reduced-motion` 무관). `aria-label` = "적용 전 읽기 듣기" · "적용 후 읽기 듣기" · (재생 중) "멈추기". 한 번에 하나만 소리 난다(다른 쪽을 누르면 앞 소리를 멈추고 새로 재생).
- **소리 가져오기**(§10-3 C): 응답에 `side.audioUrl` 이 있으면 그 URL 을 받아(`apiGetAudio`) 재생, 없으면 같은 L7 을 `Accept: audio/wav` + `side` 로 다시 불러(`apiPostAudio`) 재생. 둘 다 **▶ 탭 핸들러 안에서 동기로 `unlockTtsAudio()`** 를 먼저 부른다(§7-0 ⑧).
- `changed` = `before.accent !== after.accent || before.reading !== after.reading`. `hits` = `after.matches` 중 표기가 초안 표기와 같은 것의 수(서버가 `matches` 를 안 주면 ⚠ 줄은 그리지 않고 두 줄 비교만).
- 결과는 **초안 키**(`surface|reading|accentType|priority|scope|ref|wordType|text|voiceId`)와 함께 보관한다. 키가 바뀌면 `stale`(흐림 + ▶ 비활성) 이고 재생 중이면 멈춘다.
- 모드 `'current'`(보기 시트·문장 확인): 한 줄만, `draftEntries` 없이 부른다.

**LexiconSentenceCheck**(목록 머리, `canPreview` 일 때 — **선택, 구현 순서 마지막**)
```
<details className="mt-3 rounded-[14px] border border-line bg-surface">
  <summary className="flex h-12 cursor-pointer items-center px-3.5 text-[14px] font-medium">문장으로 읽기 확인</summary>
  <div className="px-3.5 pb-3">
    <p className="text-[12px] text-ink2 break-keep">선생님이 이상하게 읽는 문장을 넣어 보고, 틀린 단어를 찾아 항목으로 추가해요.</p>
    <LexiconPreviewPanel mode="current" initialText="" voices />
  </div>
</details>
```

#### F. 쓰기 확인 칸 — `WriteConfirmFields`(항목 저장·끄기·켜기·가져오기·되돌리기 공용)

```
Field 변경 이유*  textarea#lexReason rows=2 placeholder="예: 日本橋 가 ニッポンバシ 로 읽혀서"  ≤200, 카운터 "{n}/200"
<div role="group" aria-label="빠른 이유" className="no-scrollbar -mx-4 mt-1.5 flex gap-1.5 overflow-x-auto px-4 py-1">
  {quick.map(t => <button type="button" className="h-11 flex-none rounded-full border border-line bg-surface px-3 text-[13px] text-ink">{t}</button>)}
</div>                                           ← 누르면: 칸이 비었으면 그 글로, 이미 글이 있으면 뒤에 " · {t}"
{needsConfirm && <div className="mt-3 rounded-xl border border-bad bg-surface p-3">
  <p className="text-[13px] font-semibold text-bad">운영 환경(PRODUCTION) 사전을 바꿔요</p>
  <p className="mt-0.5 text-[13px] text-ink break-keep">모든 학습자의 선생님 목소리 읽기가 바뀌어요. 확인하려면 아래에 PRODUCTION 을 그대로 입력해 주세요.</p>
  <input aria-label="확인 문구" autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="PRODUCTION" className="{INPUT} mt-2 font-mono" />
</div>}
```
- `QUICK_REASONS`: 저장 = 오독 수정 · 새 고유명사 · 악센트 조정 · 우선순위 조정 / 끄기 = 잘못 넣은 항목 · 더 이상 필요 없음 · 다른 항목과 겹침 / 켜기 = 다시 필요해짐 / 가져오기 = 일괄 추가 · 사전 복원 / 되돌리기 = 문제 있는 변경 되돌림.
- 확정 버튼은 늘 누를 수 있다. 누르면 이유(비었음·200자 초과)·확인 문구 불일치를 먼저 검사해 첫 오류 칸 포커스(요청 없음). 확인 문구는 **대소문자까지 정확히** `PRODUCTION`(앞뒤 공백만 무시).
- `text-bad` on `bg-surface` 는 `bad`/`bad-soft` 보다 명암비가 높다(글자 사용 가능 — §6 `MISCONFIGURED` 뱃지와 같은 조합).

#### G. 가져오기 시트 — `LexiconImportSheet`(step: `'pick' | 'checking' | 'reviewed' | 'applying'`)

```
Sheet title="사전 가져오기" dismissible={step !== 'checking' && step !== 'applying'}
 FilePick:
   <input id="lexImportFile" type="file" accept=".csv,.json,text/csv,application/json" className="sr-only" onChange />
   <label htmlFor="lexImportFile" className="{Btn ghost 모양, h-12} w-full cursor-pointer">{file ? '다른 파일 고르기' : '파일 고르기 (CSV · JSON)'}</label>
   {file && <p className="mt-1 truncate text-[13px]">{file.name} · {kb(file.size)}KB</p>}
   {fileError && <p className="mt-1 text-[12px] text-bad">{fileError}</p>}     ← 요청 전 검사: 확장자 csv/json 아님 · 256KB 초과(§10-8 ⓓ)
   <details className="mt-2"><summary className="flex h-11 cursor-pointer items-center text-[13px] font-medium">파일 형식</summary>
     <p className="text-[12.5px] text-ink2">CSV(UTF-8) 첫 줄:</p>
     <code className="block font-mono text-[12px] [overflow-wrap:anywhere]">surface,reading,accentType,priority,scope,scopeRefId,wordType,note,enabled</code>
     <p className="text-[12.5px] text-ink2 break-keep">JSON: 같은 키를 가진 객체의 배열 · 최대 2,000행 · 256KB · 내보내기 파일을 그대로 다시 올릴 수 있어요.</p></details>
 ModePick <div role="radiogroup" aria-label="가져오는 방식" className="mt-3 grid gap-2">   (카드 2개, ScopePicker 와 같은 모양)
   ◉ 합치기 (MERGE) — 파일의 항목을 추가하거나, 같은 표기·범위의 항목을 파일 값으로 고쳐요. 파일에 없는 항목은 그대로 둬요.
   ○ 범위 바꾸기 (REPLACE_SCOPE) — 파일에 나온 범위(예: GLOBAL)를 파일 내용으로 통째로 바꿔요.
        <span className="block text-[13px] font-semibold text-bad">⚠ 그 범위에서 파일에 없는 항목은 모두 꺼져요.</span>
 <Btn variant="ghost" className="mt-3 w-full" aria-busy={step === 'checking'} onClick={dryRun}>{step === 'checking' ? '파일을 확인하는 중…' : '변경 내용 미리 보기'}</Btn>
   → L5 `?mode=&dryRun=1`(multipart `file`) → step 'reviewed'. 파일·방식을 바꾸면 결과를 버리고 'pick'. 파일이 없으면 누를 때 "파일을 골라 주세요"

 step 'reviewed' → <ImportReview result mode />
   <div aria-live="polite" className="mt-3 rounded-xl border border-line bg-surface2 p-3">
     <p className="text-[14px] font-semibold">{rows}행 확인 · 지금 사전 v{baseVersion} 기준</p>
     <ul className="mt-1.5 flex flex-wrap gap-1.5">  CountChip × 5 — 추가 {add} · 수정 {update} · 끄기 {disable} · 그대로 {unchanged} · 오류 {error}
         (0 도 보인다 · 끄기 >0 은 `border border-bad bg-surface text-bad` · 오류 >0 은 `bg-bad-soft text-bad` · 나머지 `bg-surface text-ink`) </ul>
     {mode === 'REPLACE_SCOPE' && scopes?.length > 0 && <p className="mt-1.5 text-[13px] break-keep">바뀌는 범위: {scopes.map(s => `${s.scope}${s.scopeRefId ? ` ${short(s.scopeRefId)}` : ''}(끄기 ${s.disable})`).join(' · ')}</p>}
   </div>
   {disable > 0 && <p role="alert" className="mt-2 rounded-xl border border-bad bg-surface px-3 py-2 text-[13px] font-semibold text-bad break-keep">⚠ 적용하면 {disable}개 항목이 꺼져요.</p>}
   {errors.length > 0 && <ImportErrorTable errors total={error} />}
   {changes?.length > 0 && <details className="mt-2"><summary className="flex h-11 cursor-pointer items-center text-[13px] font-medium">바뀌는 항목 보기 ({add + update + disable})</summary>
       <LexiconDiffList rows={changes} truncated={changesTruncated ?? 0} /></details>}
   {error > 0 ? <p className="mt-3 text-[13px] text-ink break-keep">오류가 있는 행을 고친 파일로 다시 확인해 주세요. 오류가 0 일 때만 적용할 수 있어요.</p>
    : add + update + disable === 0 ? <p className="mt-3 text-[13px] text-ink">바뀌는 항목이 없어요 — 지금 사전과 같아요.</p>
    : <>
        <WriteConfirmFields quick={QUICK_REASONS.import} … />
        {notice && <SheetNotice … />}
        <p className="mt-2 text-[12px] text-ink2">적용하면 사전 v{baseVersion + 1} 이 만들어져요.</p>
        <BtnRow>
          <Btn variant="primary" aria-busy={step === 'applying'}>{step === 'applying' ? '적용하는 중…' : `${needsConfirm ? 'PRODUCTION 에 적용' : '적용'}${disable > 0 ? ` (${disable}개 끄기 포함)` : ''}`}</Btn>
          <Btn variant="ghost">취소</Btn>
        </BtnRow>
      </>}
   → 적용 = L5 `?mode=&dryRun=0`(multipart `file`·`reason`·`baseVersion`(dryRun 결과 값)·`confirm?`) → 시트 닫기 · 토스트 "가져왔어요 · 사전 v{n} (추가 a · 수정 b · 끄기 c)" · 목록 다시 읽기
```

**ImportErrorTable**
```
<div className="@container mt-2">
  <p className="text-[13px] font-semibold text-bad">오류 {total}행{errors.length < total ? ` (앞 ${errors.length}개만 보여요)` : ''}</p>
  ≥560: <table className="mt-1 w-full table-fixed text-[13px]"><thead>행(14%) · 칸(24%) · 사유</thead> … </table>
  <560: <ul className="mt-1 divide-y divide-line rounded-xl border border-line bg-surface">
          <li className="px-3 py-2 text-[13px] break-keep"><span className="font-semibold tabular-nums">{row}행</span>{field && <span className="font-mono text-ink2"> · {field}</span>} — {importErrorText(code)}</li></ul>
</div>
```
- 행 번호는 **파일 기준**(CSV 는 머리글이 1행이라 첫 데이터가 2행) — 서버 값 그대로 보인다. 시트는 480px 라 표는 사실상 넓은 데스크톱 시트에서만 나온다.

와이어프레임(390, reviewed, REPLACE_SCOPE):
```
┌ 사전 가져오기                        ✕ ┐
│ [          다른 파일 고르기          ]  │
│ lexicon-global.csv · 12KB             │
│ 파일 형식                          ˅   │
│ ┌ MERGE                              ┐│
│ │ 합치기 — 파일의 항목을 추가하거나…     ││
│ └────────────────────────────────────┘│
│ ┏ REPLACE_SCOPE                      ┓│ 선택(링)
│ ┃ 범위 바꾸기 — 파일에 나온 범위를…     ┃│
│ ┃ ⚠ 그 범위에서 파일에 없는 항목은 모두 꺼져요.┃│
│ ┗────────────────────────────────────┛│
│ [        변경 내용 미리 보기        ]    │
│ ┌ 42행 확인 · 지금 사전 v7 기준       ┐ │
│ │ [추가 30][수정 5][끄기 2][그대로 5][오류 0]│
│ │ 바뀌는 범위: GLOBAL(끄기 2)          │ │
│ └────────────────────────────────────┘ │
│ ⚠ 적용하면 2개 항목이 꺼져요.             │
│ 바뀌는 항목 보기 (37)               ˅   │
│ 변경 이유* ┌                        ┐   │
│ [일괄 추가][사전 복원]                   │
│ 적용하면 사전 v8 이 만들어져요.            │
│ [적용 (2개 끄기 포함)] [    취소    ]     │
└─────────────────────────────────────┘
```

#### H. 내보내기 시트 — `LexiconExportSheet`

```
Sheet title="사전 내보내기"
<p className="text-[14px] break-keep">지금 쓰는 {env} 사전 v{n} 전체(꺼진 항목 포함 {total}개)를 내려받아요. 이 파일을 그대로 가져오면 바뀌는 것이 없어요.</p>
<ConsoleSegmented ariaLabel="파일 형식" options={[{ value: 'csv', label: 'CSV' }, { value: 'json', label: 'JSON' }]} value={format} className="mt-3" />
<p className="mt-1 text-[12px] text-ink2">{format === 'csv' ? '엑셀·스프레드시트에서 열 수 있어요.' : '다른 도구나 백업에 쓰기 좋아요.'}</p>
{isNativeApp() && <p className="mt-2 text-[12px] text-ink2 break-keep">앱에서는 파일 저장이 안 될 수 있어요. 안 되면 컴퓨터 브라우저에서 내려받아 주세요.</p>}
{error && <div className="mt-2"><ConsoleError message={error} /></div>}
<BtnRow><Btn variant="primary" aria-busy={busy}>{busy ? '만드는 중…' : '내려받기'}</Btn><Btn variant="ghost">닫기</Btn></BtnRow>
```
- `{total}` 은 L1 `counts.enabled + counts.disabled`(없으면 "꺼진 항목 포함" 만).
- 내려받기(`lexiconApi.downloadExport`): `fetch('/api/admin/v1/lexicon/export?format=…', { credentials: 'same-origin', cache: 'no-store' })` → 401 이면 `api.ts` 와 같이 로그인으로 · `res.ok` 이고 `Content-Type` 이 `application/json` 봉투가 아니면(또는 JSON 형식을 골랐고 본문이 봉투 모양이 아니면) blob → `URL.createObjectURL` → 숨은 `<a download={filename}>` 클릭 → 곧바로 revoke · 실패면 봉투를 읽어 status 로 §10-8 ⓓ.
- 파일명: `Content-Disposition` 의 `filename` → 없으면 `kaiwa-lexicon-{env 소문자}-v{n}.{csv|json}`.
- 성공 토스트 "내려받았어요 · v{n}", 시트는 닫지 않는다(다른 형식도 받을 수 있게).

#### I. 버전 기록 — `/admin/speech/tts/lexicon/versions` · `LexiconVersionsScreen` · `VersionDetailSheet`

```
<BackLink href="/admin/speech/tts/lexicon">발음 사전</BackLink>
<h2 className="text-[17px] font-semibold">버전 기록</h2>
<p className="text-[13px] text-ink2 break-keep">{env} 사전의 모든 변경이 버전으로 남아요. 되돌리기는 과거 버전 내용으로 새 버전을 만들어요(기록은 지우지 않아요).</p>
<details><summary className="flex h-11 cursor-pointer items-center text-[13px] font-medium">상태 뜻</summary>
  <ul className="text-[12.5px] text-ink2"> <VersionStatusBadge ACTIVE/> 지금 적용 중 · <VersionStatusBadge SUPERSEDED/> 새 버전에 밀려났어요 · <VersionStatusBadge ROLLED_BACK/> 이 버전의 변경을 되돌려 새 버전으로 바꿨어요 </ul></details>
<RefreshLine … />
{first.status === 'loading' && !items.length ? <ConsoleLoading /> : first.err && !items.length ? <LoadError … name="버전 기록" /> :
 <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
   <li><button type="button" onClick={() => openVersion(v.version)} className="flex min-h-[64px] w-full min-w-0 flex-col gap-0.5 px-3.5 py-2.5 text-left">
     1줄 <span className="flex min-w-0 items-center gap-2"><span className="font-mono text-[15px] font-semibold">v{version}</span><VersionStatusBadge status />
           <span className="ml-auto text-[12px] tabular-nums text-ink2">{formatAgo(createdAt, now)}</span></span>
     2줄 <span className="min-w-0 truncate text-[14px]">{changeSummary ?? '요약 없음'}</span>
     3줄 <span className="flex min-w-0 gap-2 text-[12px] text-ink2"><span className="min-w-0 flex-1 truncate">{actorLabel(actor)} · 항목 {entryCount}개{enabledCount !== undefined ? `(사용 중 ${enabledCount})` : ''}</span><span aria-hidden="true">›</span></span>
   </button></li>
 </ul>}
{hasMore && <Btn variant="ghost" className="mt-3 w-full" aria-busy={loadingMore}>{loadingMore ? '불러오는 중…' : '더 보기'}</Btn>}
<VersionDetailSheet version={openV} activeVersion onClose onRolledBack />      ← URL ?v={n}(router.replace). 새로 고침해도 시트가 열린다
```
- `VersionStatusBadge`(`lexicon/Badges.tsx`): ACTIVE `bg-good-soft text-good` + 점 "사용 중" · SUPERSEDED `bg-surface2 text-ink2` "이전" · ROLLED_BACK `border border-bad bg-surface text-bad` "되돌려짐"(§6 `TraceStatusBadge PARTIAL` 과 같은 모양). `aria-label="상태: {글자}"`.
- `actorLabel(actor)`: `actor?.name` → 없고 작업자 자체가 없으면(시드) "시스템" → 그 밖 "알 수 없음". 역할이 있으면 뒤에 `({role})`.

**VersionDetailSheet**(mode `'view' | 'confirmRollback'`)
```
Sheet title="버전 v{n}" dismissible={!submitting}
 mode 'view':   (L8a ?compare=previous — 시트를 열 때 한 번)
   loading → <ConsoleLoading /> · 404 → <p className="text-[14px]">그 버전을 찾을 수 없어요.</p> · 그 밖 오류 → ConsoleError + 다시 시도
   <div className="flex min-w-0 flex-wrap items-center gap-2"><VersionStatusBadge status /><span className="text-[13px] text-ink2">{formatDateTime(createdAt)} · {actorLabel(actor)}</span></div>
   <p className="mt-1 text-[14px] [overflow-wrap:anywhere]">{changeSummary ?? '요약 없음'}</p>
   <KeyValueList className="mt-2" items=[ 항목 수 {entryCount}개{enabledCount !== undefined ? ` (사용 중 ${enabledCount})` : ''} · 스냅샷 해시 <MonoId value={snapshotHash.slice(0, 12)} copy label="스냅샷 해시" /> ] />
   <SectionHeader title={against ? `직전 버전(v${against})과 비교` : '첫 버전'} />
   <DiffCounts counts />  <LexiconDiffList rows truncated />
   {status === 'ACTIVE' ? <p className="mt-3 text-[13px] text-ink2">지금 쓰는 버전이에요.</p>
    : canWrite && <Btn variant="ghost" className="mt-3 w-full" onClick={→ 'confirmRollback'}>v{n} 내용으로 되돌리기</Btn>}
 mode 'confirmRollback':   (L8a ?compare=active — 이 모드에 들어올 때 한 번)
   <p className="text-[14px] break-keep">지금(v{active}) 사전을 v{n} 내용으로 되돌리면:</p>
   <DiffCounts counts />  <LexiconDiffList rows truncated />
   {allZero ? <p className="mt-2 text-[13px] text-ink">지금 사전과 내용이 같아 되돌릴 것이 없어요.</p>
            + <Btn variant="ghost" className="mt-3 w-full">돌아가기</Btn>
    : <>
       <p className="mt-2 text-[13px] text-ink2 break-keep">새 버전 v{active + 1} 이 만들어지고 v{active} 는 '되돌려짐'으로 표시돼요. 다음 문장부터 반영돼요.</p>
       <WriteConfirmFields quick={QUICK_REASONS.rollback} … />
       {notice && <SheetNotice … />}
       <BtnRow><Btn variant="primary" aria-busy>{needsConfirm ? 'PRODUCTION 에서 되돌리기' : `v${n} 내용으로 되돌리기`}</Btn><Btn variant="ghost">돌아가기</Btn></BtnRow>
      </>}
   → L9 `{reason, baseVersion: active, confirm?}` → 시트 닫기(`?v` 제거) · 토스트 "되돌렸어요 · v{n} 내용으로 사전 v{m}" · 첫 쪽부터 다시 읽기
```
- `activeVersion` 은 목록 첫 행(ACTIVE)의 번호. 목록이 아직 없으면 되돌리기 버튼을 그리지 않는다.

**DiffCounts** — 칩 4개(0 도 보인다): 추가 {added} · 수정 {changed} · 끔 {disabled} · 다시 켬 {enabled}. 모양은 가져오기 `CountChip`(`bg-surface2 text-ink`, 끔 >0 만 `border border-bad bg-surface text-bad`).

**LexiconDiffList**(버전 상세·되돌리기 확인·가져오기 미리 보기 공용)
```
<ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface">
  <li className="min-w-0 px-3 py-2">
    1줄 <span className="flex min-w-0 items-center gap-2"><NeutralBadge>{DIFF_KO[kind]}</NeutralBadge>
          <span lang="ja" className="min-w-0 flex-1 text-[15px] font-semibold [overflow-wrap:anywhere]">{surface}</span>
          <span className="flex-none font-mono text-[12px] text-ink2">{scope}{scopeRefId ? ` ${short(scopeRefId)}` : ''}</span></span>
    2줄(13px, 가나 조각은 lang=ja):
      ADDED    → {after.reading} · 악센트 {after.accentType} · 우선 {after.priority}
      CHANGED  → 바뀐 칸만 ` · ` 로: 읽기 {b} → {a} · 악센트 {b} → {a} · 우선 {b} → {a} · 종류 {b} → {a} · 메모 바뀜
      DISABLED → {before.reading} · 이제 쓰지 않아요
      ENABLED  → {after.reading} · 다시 써요
  </li>
</ul>
{truncated > 0 && <p className="mt-1 text-[12px] text-ink2">외 {truncated}개</p>}
빈 rows → <EmptyNote>바뀐 항목이 없어요.</EmptyNote>
```
- 종류는 글자 뱃지(추가·수정·끔·다시 켬)로 뜻을 전한다. 색·기호만 쓰지 않는다.

와이어프레임(390, 버전 기록):
```
│    발음 사전                            │
├──────────────────────────────────────┤
│ ← 발음 사전                              │
│ 버전 기록                                │
│ LOCAL 사전의 모든 변경이 버전으로 남아요. … │
│ 상태 뜻                             ˅   │
│ 마지막 갱신 16:40:11     [다시 불러오기] │
│ ┌──────────────────────────────────┐ │
│ │ v9 [●사용 중]                 방금 │ │
│ │ v7 로 되돌림: 문제 있는 변경 되돌림   │ │
│ │ 관리자(SUPER_ADMIN) · 항목 7개(사용… › │ │
│ ├──────────────────────────────────┤ │
│ │ v8 [되돌려짐]              10분 전 │ │
│ │ 가져오기 REPLACE_SCOPE: 추가 30 · …  │ │
│ │ 개발자(DEVELOPER) · 항목 37개       › │ │
│ ├──────────────────────────────────┤ │
│ │ v1 [이전]                 9월 27일 │ │
│ │ 시드 v1(task-003d)                 │ │
│ │ 시스템 · 항목 6개                   › │ │
│ └──────────────────────────────────┘ │
│ [              더 보기              ] │
```

#### J. TTS 역할 페이지 링크 — `RoleScreen` 수정

`role === 'TTS' && can('voices.read')` 인 "목소리" 섹션 **바로 아래**:
```
<Section> <SectionHeader title="발음 사전" />
  <Link href="/admin/speech/tts/lexicon" className="flex min-h-[56px] min-w-0 items-center gap-2 rounded-[14px] border border-line bg-surface px-3.5 py-2.5">
    <span className="min-w-0 flex-1"><span className="block text-[14px]">읽기가 틀린 단어 고치기</span>
      <span className="block truncate text-[12px] text-ink2">항목·미리듣기·가져오기·버전 기록</span></span>
    <span aria-hidden="true">›</span></Link>
</Section>
```
- 요청을 더 부르지 않는다(버전 번호·항목 수는 사전 화면에서).

### 10-3. 상태 관리

**A. `LexiconScreen`**
```
params   = useState(initialParams)  // { q, scope: 'ALL'|Scope, ref, inactive: boolean, page: number } — 서버 page 가 검증해 넘긴 값
setParams(patch) → setState + router.replace(`/admin/speech/tts/lexicon${qs}`, { scroll: false })   // 필터가 바뀌면 page 삭제
list     = useAdminResource<LexiconListDto>(listPath(params))        // path 가 바뀌면 이전 요청 abort·늦은 응답 버림(훅 기능)
voices   = useAdminResource<AdminVoiceDto[]>('/api/admin/v1/voices') // refLabel·목소리 select. 실패해도 화면은 동작(id 로 표시)
baseVersion = useState<number | null>  ← list 가 올 때마다 list.data.dictionaryVersion 로, 쓰기 성공 응답의 version.version 으로 즉시
sheet    = { mode: 'closed'|'add'|'edit'|'view'|…; entry: LexiconEntryDto | null }
importOpen · exportOpen: boolean
now      = useNow(true, 30_000)
```
- 쓰기 성공 뒤: `setBaseVersion(res.version.version)` → `list.reload()` → 토스트(`useConsoleToast`). 추가한 항목이 지금 필터·쪽에서 안 보여도 필터를 몰래 바꾸지 않는다.
- 항목 시트가 열린 동안 목록이 다시 와도 시트 안 `entry` 는 열 때의 값을 쓴다(입력 중 값이 바뀌지 않게). 409 뒤 [새로 불러오기]만 `entry` 를 새 값으로 바꾼다.

**B. `useLexiconForm(mode, entry, baseVersion)`** — `draft` · `touched` · `errors = validateDraft(draft, mode)` · `serverFieldErrors` · `notice` · `submitting` · `dirty` · `submit(kind: 'save'|'disable'|'enable')`
```
submit: 클라 오류(칸·이유·확인 문구) 있으면 첫 칸 focus, return
        body = toBody(kind, draft, reason, baseVersion, confirm?)
        kind save+add → createEntry · save+edit → updateEntry · disable → disableEntry · enable → updateEntry({ enabled: true, … })
        200 → onSaved(res, kind)
        409 VERSION_CONFLICT     → notice(conflict: details.baseVersion → details.currentVersion) + [새로 불러오기]
                                   = list.reload() → baseVersion 갱신 → entry 를 새 목록의 같은 id 로 바꿈(없으면 404 안내). 입력은 그대로
        409 E_LEXICON_DUPLICATE  → notice + [그 항목 열기]: details.existing 이 있으면 그 항목으로 mode 'edit'(canWrite) 전환,
                                   없으면 필터 { q: 표기, scope, inactive: true } 로 바꾸고 시트를 닫는다(§10-11 ⑥)
        422                      → serverFieldErrors = mapFieldErrors(details) → 첫 칸 focus(이유·확인 문구 코드도 같은 경로)
        403                      → notice(PRODUCTION / 권한) · 404 → notice("찾을 수 없어요") + [목록 새로 고침]
        429                      → notice("{n}초 뒤") · 0·500 → notice(재시도). 모든 실패에서 입력 유지
```

**C. `useLexiconPreview({ mode })`**
```
phase: 'idle' | 'checking' | 'ready' | 'error'
result: { key: string; data: LexiconPreviewDto } | null          // key = draftKey(초안 + 예문 + voiceId)
stale  = result !== null && result.key !== currentKey
cooldownUntil: number | null  ← 429(retryAfterOf) — [읽기 확인]·▶ 모두 잠금, useCountdown 으로 남은 초
playing: 'before' | 'after' | null · audioLoading: 같은 값 | null · playbackRef: TtsPlayback | null · acRef: AbortController | null

check():      acRef abort → apiPost(L7, { text, voiceId?, draftEntries: mode === 'compare' ? [toDraftEntry(draft)] : undefined, compare: mode === 'compare' })
play(which):  (onClick 안에서 **동기로** 먼저) unlockTtsAudio()
              playing === which 면 stop 하고 끝. 다른 쪽이 재생 중이면 stop
              audioLoading = which
              buf = side.audioUrl ? await apiGetAudio(side.audioUrl) : (await apiPostAudio(L7, { …check 때 본문, side: which })).data
              playbackRef = await playWav(buf) → playing = which → ended 에 null
invalidate(): 초안 키가 바뀌는 onChange 마다 — 재생 정지 + 받는 중인 요청 abort(결과는 stale 로 남긴다)
시트 닫기·언마운트: abort + stop
```
- `audioUrl` 은 상태에만 두고 `<audio src>`·DOM·로그에 싣지 않는다(받아서 ArrayBuffer 로 재생).

**D. `useLexiconImport(baseVersionFromList)`** — `file` · `fileError` · `mode: 'MERGE' | 'REPLACE_SCOPE'`(기본 MERGE) · `step` · `review: LexiconImportResultDto | null` · `reason` · `confirm` · `notice`.
- `setFile`·`setMode` → `review = null`, `step = 'pick'`, `notice = null`. 적용 409 → notice(§10-8 ⓓ) + [다시 미리 보기](같은 파일·방식으로 dryRun 재실행). 적용 성공 → 시트 닫고 상위 `onApplied(res)`.
- 파일은 `File` 객체로만 들고 있다(`FileReader` 로 읽지 않는다).

**E. `LexiconVersionsScreen`**
```
first   = useAdminResource<LexiconVersionListDto>(versionsPath(1))
more    = { items: LexiconVersionDto[]; page: number; loadingMore: boolean; reqNo: number }  // [더 보기] = apiGet(versionsPath(page+1)), 요청 번호로 늦은 응답 버림
items   = [...first.data.items, ...more.items]   (first 가 다시 오면 more 초기화)
openV   = useState(initialV) + router.replace(`?v=${n}` | '')
detail  = useAdminResource<LexiconVersionDetailDto>(openV ? versionDetailPath(openV, 'previous') : null)
confirm = useAdminResource<LexiconVersionDetailDto>(openV && mode === 'confirmRollback' ? versionDetailPath(openV, 'active') : null)
activeVersion = items.find(v => v.status === 'ACTIVE')?.version ?? null
되돌리기 성공 → openV = null → first.reload()(more 초기화) → 토스트
```
- `useLexiconAccess()`(§10-1)는 렌더마다 계산하고 저장하지 않는다.
- 사전 항목·초안·capability·미리듣기 소리를 브라우저 저장소(localStorage·sessionStorage·IndexedDB)에 두지 않는다.

### 10-4. API 호출 계획

모두 `@/components/common/api`(`apiGet`·`apiPost`·`apiPut`·`apiDelete`·`apiUpload`·`apiPostAudio`·`apiGetAudio`) + `@/components/common/errors`(`toErr`·`retryAfterOf`). 경로의 id 는 `encodeURIComponent`, 쿼리는 `URLSearchParams`. 요청 함수는 `lexiconApi.ts` 한 곳에 둔다. 번호 L1~L9 는 이 절의 이름(정본 §7-2 표는 번호가 없다).

| # | 엔드포인트 | 메서드 | capability | 화면 | 파라미터 / 본문 | 사용 필드 | 오류 처리 |
|---|---|---|---|---|---|---|---|
| L1 | `/api/admin/v1/lexicon` | GET | voices.read | 목록·요약 카드 | `q` `scope` `scopeRefId` `enabled=1\|all` `page` `pageSize=50` | `items[]` · `page, pageSize, total` · `dictionaryVersion` · `counts{enabled, disabled}` · `active` | `LoadError`(403 카드 · 404 "권한이 바뀌었을 수 있어요" · 그 밖 ErrorBlock) |
| L2 | `/api/admin/v1/lexicon` | POST | voices.manage (+PRODUCTION `config.apply.production`) | 항목 추가 | `{surface, reading, accentType, priority, scope, scopeRefId, wordType, note, reason, baseVersion, confirm?}` | `entry` · `version{version, createdAt}` | §10-3 B |
| L3 | `/api/admin/v1/lexicon/:id` | PUT | 〃 | 수정 · 다시 켜기 | `{reading, accentType, priority, wordType, note, enabled?, reason, baseVersion, confirm?}` | 〃 | 〃 + 404 |
| L4 | `/api/admin/v1/lexicon/:id` | DELETE(**본문 있음**) | 〃 | 끄기 | `{reason, baseVersion, confirm?}` | `entry{enabled:false}` · `version` | 〃 |
| L5 | `/api/admin/v1/lexicon/import?mode=MERGE\|REPLACE_SCOPE&dryRun=1\|0` | POST multipart | 〃 | 가져오기 | `file`(+적용 때 `reason`·`baseVersion`·`confirm?`) | `LexiconImportResultDto` | 413·415·422(형식·행 수·오류 행)·409·403 → §10-8 ⓓ |
| L6 | `/api/admin/v1/lexicon/export?format=csv\|json` | GET(파일) | voices.read | 내보내기 | — | 본문 파일 · `Content-Disposition` | 봉투 오류면 status 로 §10-8 ⓓ |
| L7 | `/api/admin/v1/lexicon/preview` | POST | voices.manage | 미리듣기·문장 확인 | JSON: `{text(화면 ≤100), voiceId?, draftEntries?[{surface, reading, accentType, priority, scope, scopeRefId, wordType}], compare?}` / 소리: 같은 본문 + `side` + `Accept: audio/wav` | `dictionaryVersion` · `before`·`after{reading, accent, matches?, audioUrl?}` | 429 쿨다운 · 502/503/504 "목소리 서비스" · 422 예문 · 0 |
| L8 | `/api/admin/v1/lexicon/versions?page=&pageSize=20` | GET | voices.read | 버전 기록 | — | `items[]` · `page, pageSize, total` | LoadError |
| L8a | `/api/admin/v1/lexicon/versions/:v?compare=previous\|active` | GET | voices.read | 버전 상세 · 되돌리기 확인 | — | 버전 필드 + `compare, against, counts, rows(≤100), truncated` | 404 → 시트 안 "그 버전을 찾을 수 없어요" · **정본에 없음 → §10-11 ②** |
| L9 | `/api/admin/v1/lexicon/versions/:v/rollback` | POST | voices.manage (+PRODUCTION) | 되돌리기 | `{reason, baseVersion, confirm?}` | `version{version}` · `replaced{version, status}` | 409(`VERSION_CONFLICT`·`ALREADY_ACTIVE`·`NO_CHANGE`)·403·404 |
| 82 | `/api/admin/v1/voices` | GET | voices.read | 대상 이름 · 목소리 select | — | `id, displayName, status, enabled` **만** | 조용히 id 로 대신 |

**화면이 기대하는 DTO**(`src/types/admin.ts` "Lexicon" 절 — §6-11 ⑪ 과 같은 원칙: A 의 응답이 이 모양을 맞추거나, A 가 먼저 정한 이름이 있으면 B 가 그 이름을 따른다)
```ts
export type LexiconScopeName = 'GLOBAL' | 'COURSE' | 'LESSON' | 'VOICE' | 'USER'
export type LexiconWordType = 'PROPER_NOUN' | 'PERSON' | 'PLACE' | 'COMMON' | 'LOANWORD' | 'ABBREVIATION'
export interface LexiconEntryDto {
  id: string; surface: string; reading: string; accentType: number; priority: number
  scope: LexiconScopeName; scopeRefId: string | null; wordType: LexiconWordType | null; note: string | null
  enabled: boolean; updatedAt: string
}
export interface LexiconActorDto { name: string | null; role: string | null }
export interface LexiconVersionDto {
  version: number; status: 'ACTIVE' | 'SUPERSEDED' | 'ROLLED_BACK'; createdAt: string
  actor: LexiconActorDto | null; changeSummary: string | null; entryCount: number; enabledCount?: number; snapshotHash: string
}
export interface LexiconListDto {
  items: LexiconEntryDto[]; page: number; pageSize: number; total: number
  dictionaryVersion: number; counts?: { enabled: number; disabled: number }; active?: LexiconVersionDto | null
}
export interface LexiconVersionListDto { items: LexiconVersionDto[]; page: number; pageSize: number; total: number }
export interface LexiconWriteResultDto { entry?: LexiconEntryDto; version: { version: number; createdAt: string } }
export interface LexiconSnapshotRowDto {
  surface: string; reading: string; accentType: number; priority: number
  scope: LexiconScopeName; scopeRefId: string | null; wordType: LexiconWordType | null; enabled: boolean; note?: string | null
}
export interface LexiconDiffRowDto {
  kind: 'ADDED' | 'CHANGED' | 'DISABLED' | 'ENABLED'; surface: string; scope: LexiconScopeName; scopeRefId: string | null
  before: LexiconSnapshotRowDto | null; after: LexiconSnapshotRowDto | null
}
export interface LexiconDiffCountsDto { added: number; changed: number; disabled: number; enabled: number }
export interface LexiconVersionDetailDto extends LexiconVersionDto {
  compare: 'previous' | 'active'; against: number | null; counts: LexiconDiffCountsDto; rows: LexiconDiffRowDto[]; truncated: number
}
export interface LexiconImportErrorDto { row: number; field: string | null; code: string }
export interface LexiconImportResultDto {
  dryRun: boolean; mode: 'MERGE' | 'REPLACE_SCOPE'; baseVersion: number; rows: number
  counts: { add: number; update: number; disable: number; unchanged: number; error: number }
  scopes?: { scope: LexiconScopeName; scopeRefId: string | null; disable: number }[]
  changes?: LexiconDiffRowDto[]; changesTruncated?: number
  errors: LexiconImportErrorDto[]; errorsTruncated?: number
  version?: { version: number }                       // dryRun=0 성공일 때
}
export interface LexiconPreviewSideDto { reading: string; accent: string; matches?: { surface: string; reading: string }[]; audioUrl?: string | null }
export interface LexiconPreviewDto { dictionaryVersion: number; before: LexiconPreviewSideDto; after?: LexiconPreviewSideDto }
```
- `confirm` 은 PRODUCTION 일 때만 싣는다(화면은 입력이 `'PRODUCTION'` 과 같을 때만 보낸다).
- 서버 `message` 는 이 화면에서 그리지 않는다(§10-0 ⑬). `details` 만 읽는다: `baseVersion`·`currentVersion`(409) · `existingId`·`existing`(중복) · `missing`(403) · `fields`(`{[field]: code}`) 또는 `errors`(`[{field, code}]`)(422) · `retryAfterSec`(429) · `rows`(행 수 초과).
- `common/api.ts` 의 `apiDelete` 에 선택 본문 인자를 더한다(§10-6) — 이유를 URL 에 싣지 않기 위해서다(접근 로그 노출).

### 10-5. 컴포넌트 분해 (`src/components/admin/lexicon/*`)

| 이름 | 종류 | props / 반환 | 상태 |
|---|---|---|---|
| `LexiconScreen` | client | `{ initialParams: LexiconParams }` | §10-3 A |
| `LexiconSummaryCard` | client | `{ list: LexiconListDto \| null; env: AdminEnvironment; now: number }` | — |
| `LexiconFilters` | client | `{ params: LexiconParams; voices: AdminVoiceDto[]; onChange(patch) }` | qDraft·refDraft(디바운스·IME) |
| `LexiconList` · `Pager` | client | `{ items; total; page; pageSize; canWrite; voiceName(id): string \| null; now; onOpen(e) }` · `{ page; pageSize; total; onPage(n) }` | — |
| `Badges.tsx` — `EntryStatusBadge` · `VersionStatusBadge` · `CountChip` | client | `{ enabled }` · `{ status }` · `{ label; n; tone: 'plain'\|'warn'\|'error' }` | — |
| `LexiconEntrySheet` | client | `{ open; mode; entry; baseVersion; voices; onClose(); onSaved(res, kind); onFindDuplicate(q, scope) }` | §10-3 B(`useLexiconForm`) |
| `EntryForm` · `ScopePicker` · `AccentPicker` | client | `{ mode; draft; errors; voices; onChange(patch) }` · `{ value; onChange }` · `{ reading; value; error?; onChange }` | — |
| `LexiconPreviewPanel` (+ 안쪽 `ReadingRow`·`PlayButton`) | client | `{ mode: 'compare'\|'current'; draft?: DraftEntry \| null; draftValid?: boolean; initialText?: string; voices; lockedVoiceId?: string \| null; onInvalidDraft?() }` | §10-3 C(`useLexiconPreview`) |
| `LexiconSentenceCheck` | client | `{ voices }` | — |
| `WriteConfirmFields` | client | `{ reason; onReason; confirm; onConfirm; needsConfirm; quick: readonly string[]; errors: { reason?: string; confirm?: string } }` | — |
| `SheetNotice` | client | `{ notice: { text: string; action?: { label: string; onClick(): void } } }` | — |
| `LexiconImportSheet` · `ImportReview` · `ImportErrorTable` | client | `{ open; baseVersion; onClose(); onApplied(res) }` · `{ result; mode }` · `{ errors; total }` | §10-3 D(`useLexiconImport`) |
| `LexiconExportSheet` | client | `{ open; env; dictionaryVersion; total: number \| null; onClose() }` | format·busy·error |
| `LexiconVersionsScreen` | client | `{ initialV: number \| null }` | §10-3 E |
| `VersionDetailSheet` · `DiffCounts` · `LexiconDiffList` | client | `{ version: number \| null; activeVersion: number \| null; onClose(); onRolledBack(res) }` · `{ counts }` · `{ rows; truncated }` | view / confirmRollback |
| `useLexiconAccess` | hook | `() → { canManage, canWrite, canPreview, needsConfirm, env, note }` | — |
| `lexiconParams.ts` | 순수(서버 page·클라이언트 공용 — fetch·브라우저 API 없음) | `parseLexiconParams(sp) → LexiconParams` · `parseVersionParam(sp) → number \| null` · `toQuery(params)` | — |
| `lexiconApi.ts` | 순수+fetch(클라이언트) | `listPath(params)` · `createEntry` · `updateEntry` · `disableEntry` · `importLexicon(file, mode, dryRun, extra?)` · `downloadExport(format, env, v)` · `preview(body)` · `previewAudio(body, side)` · `versionsPath(page)` · `versionDetailPath(v, compare)` · `rollback(v, body)` | — |
| `kana.ts` | 순수 | `toKatakana` · `isReading` · `splitMoras` · `moraCount` · `accentNotation(moras, n)` · `spokenAccent(s)` · `stripArrows(s)` · `hasJapanese` · `hasHiddenChar` · `validateDraft(draft, mode) → FieldErrors` · `draftKey(…)` | — |
| `lexiconCopy.ts` | 순수 | 라벨(`SCOPE_KO`·`WORD_TYPE_KO`·`VERSION_STATUS_KO`·`DIFF_KO`) · §10-8 문구 · `fieldErrorText(field, code, ctx)` · `writeErrorNotice(err, kind)` · `importErrorText(code)` · `previewErrorText(err)` · `QUICK_REASONS` · `actorLabel(actor)` | — |

`kana.ts` 규칙(서버 `src/modules/speech/tts/text.ts` 와 같아야 한다 — 테스트로 대조):
- `toKatakana`: 히라가나 U+3041~U+3096 → +0x60, `ゝゞ` → `ヽヾ`, `ー`·가타카나는 그대로, 앞뒤 공백 제거. 그 밖 문자는 그대로 둔다(검증에서 걸린다).
- `isReading(s)` = `/^[ァ-ヺー]+$/`(서버 `KATAKANA_READING` 과 같은 식). `・`·공백·반각 가나는 불가.
- 작은 가나 = `ァィゥェォャュョヮヵヶ`(서버 `SMALL_KANA` 와 같다). `splitMoras`: 작은 가나는 앞 모라에 붙이고, 맨 앞 작은 가나는 다음 모라에 붙인다. `ッ`·`ン`·`ー` 는 각각 한 모라. `moraCount(r) = splitMoras(r).length` = 서버 `moraCount(r)`.
- `hasJapanese` = 가나·한자·`々〆ヵヶ` 가 하나라도 있음. `hasHiddenChar` = 제어문자(U+0000~001F·007F~009F)·폭 없는 문자(U+200B~200F·2028~202E·2060~2064·FEFF).

재사용: `Sheet` · `ui.tsx`(`Card`·`Btn`·`BtnRow`·`Field`·`Section`·`SectionHeader`) · `ConsoleSegmented` · 콘솔 `ChipRadio`·`ToggleButton`·`RefreshLine`·`KeyValueList`·`MonoId`/`CopyButton`·`NeutralBadge`·`ConsoleStates`(`LoadError`·`ConsoleLoading`·`ConsoleError`·`EmptyNote`·`BackLink`·`ConsoleForbidden`)·`useAdminResource`·`ConsoleProvider`(`useCan`·`useConsoleEnv`·`useConsoleToast`)·`format.ts`(`formatAgo`·`formatDateTime`) · `common/format`(`cpLength`) · `common/useNow`(`useNow`·`useCountdown`) · `@/modules/infra/native`(`isNativeApp` — `api.ts` 와 같은 경로) · **`@/components/speech/ttsAudio`(`unlockTtsAudio`·`playWav`) — 화면 문구 없는 재생 유틸이라 예외로 import(§10-11 ⑪)**. `EmptyBlock`·`LoadingBlock`(ink3 글자)은 쓰지 않는다. 콘솔 컴포넌트를 `(app)` 화면에서 import 하지 않는다.

### 10-6. 생성/수정 파일 목록 (developer B)

신규
- `src/app/(admin)/admin/speech/tts/lexicon/page.tsx` — `requireConsolePage('voices.read', { path })` → `<LexiconScreen initialParams={parseLexiconParams(await searchParams)} />`
- `src/app/(admin)/admin/speech/tts/lexicon/versions/page.tsx` — 같은 가드 → `<LexiconVersionsScreen initialV={parseVersionParam(await searchParams)} />`
- `src/components/admin/lexicon/{LexiconScreen,LexiconSummaryCard,LexiconFilters,LexiconList,Badges,LexiconEntrySheet,EntryForm,ScopePicker,AccentPicker,LexiconPreviewPanel,LexiconSentenceCheck,WriteConfirmFields,SheetNotice,LexiconImportSheet,ImportReview,LexiconExportSheet,LexiconVersionsScreen,VersionDetailSheet,LexiconDiffList}.tsx`
- `src/components/admin/lexicon/{useLexiconAccess,useLexiconForm,useLexiconPreview,useLexiconImport,lexiconParams,lexiconApi,kana,lexiconCopy}.ts` — `lexiconParams.ts` 는 서버 page 가 import 하므로 `'use client'`·브라우저 API·`common/api` import 가 없어야 한다
- `src/components/admin/lexicon/__tests__/{kana,lexiconCopy,access}.test.ts` — ① `isReading`·`moraCount` 가 서버 `@/modules/speech/tts/text` 와 같은지(표본 30개: 拗音·ッ·ン·ー·ヴ·ヵ·맨 앞 작은 가나·반각·ひらがな) ② `toKatakana`(ゝゞ·ー 유지·공백) ③ `accentNotation` 0·1·중간·끝(尾高)·한 모라 ④ `validateDraft` 모든 오류 키(표기 빈 값·41자·일본어 없음·숨은 문자 / 읽기 비·가나 밖·61자 / 악센트 범위 / 우선순위 -1·101·1.5 / 범위별 대상) ⑤ 오류 매핑(409 두 갈래·422 필드·403 PRODUCTION·429·502/503/504·0·모르는 코드) ⑥ `useLexiconAccess` 네 갈래(가짜 capability — `voices.read` 만인 역할이 실제로 없어서, §10-11 ⑬) ⑦ `parseLexiconParams` 틀린 값 버림
- `src/types/admin.ts` — "Lexicon" 절 DTO(§10-4). A 가 먼저 같은 타입을 두면 그것을 쓴다

수정
- `src/modules/admin/console/menu.ts` — 메뉴 1행(§10-1). **A 소유 모듈 — Leader 가 한 사람에게 정해 준다(§10-11 ⑫)**
- `src/components/admin/console/labels.ts` — `MENU_SUB['speech-tts-lexicon']`
- `src/components/admin/console/RoleScreen.tsx` — TTS "발음 사전" 링크 카드(§10-2 J)
- `src/components/common/api.ts` — `apiDelete<T>(path, body?)`(본문이 있을 때만 JSON `Content-Type`). 기존 호출(인자 1개) 무영향

화면이 기대는 A 의 공개 API: `requireConsolePage(cap, { path })`(있음) · L1~L9 라우트(+L8a — §10-11 ②) · (있으면) 응답 타입. 이름이 달라지면 A 기준으로 B 가 맞춘다.

### 10-7. 구현 순서

1. `kana.ts`·`lexiconCopy.ts`·`lexiconParams.ts` + 단위 테스트(서버 `text.ts` 대조 포함) → `types/admin.ts` Lexicon 절 → `lexiconApi.ts` → `apiDelete` 본문 인자.
2. 페이지 2개 + 가드 + 메뉴 행·`MENU_SUB`(A 라우트가 아직이면 목록 자리 ErrorBlock 까지만 확인 — 화면에 개발용 가짜 데이터·스위치를 만들지 않는다).
3. `useLexiconAccess` → `LexiconScreen`(요약 카드·안내 줄·액션 줄·필터·URL 쿼리·`LexiconList` 표/카드·`Pager`).
4. `LexiconEntrySheet` view → add/edit(`EntryForm`·`ScopePicker`·`AccentPicker`·`WriteConfirmFields`·`useLexiconForm`) → confirmDisable·confirmEnable·discard.
5. `LexiconPreviewPanel`(`useLexiconPreview`·재생) — A 의 L7 응답 모양(§10-11 ③)을 확인한 뒤.
6. `LexiconExportSheet` → `LexiconImportSheet`(dryRun → 적용).
7. `LexiconVersionsScreen` → `VersionDetailSheet`(L8a 가 없으면 §10-11 ② 대안) → 되돌리기.
8. `RoleScreen` 링크 카드 → (선택) `LexiconSentenceCheck`.
9. §10-9 자체 점검 — dev 서버(LOCAL), QA 계정 ADMIN·DEVELOPER·SUPER_ADMIN. **USER scope·가짜 표기만** 쓰고 끝나면 되돌리기로 기준선에 맞춘다(운영 pm2 가 `APP_ENV=LOCAL` 이라 LOCAL 사전 = 실사용자 발음, A 기록 05:06).

### 10-8. 한국어 UI 문구 (`lexiconCopy.ts`)

ⓐ 공통 · 라벨

| 자리 | 문구 |
|---|---|
| 소개(`INTRO`) | 선생님 목소리가 잘못 읽는 단어(인명·지명·외래어 등)의 읽기를 고쳐요. 바꾸면 다음 문장부터 반영돼요. |
| 적용 규칙 | 적용 규칙 / 범위가 좁을수록 먼저 적용돼요: 사용자 > 목소리 > 레슨 > 코스 > 전체 / 한 문장 안에서는 긴 표기가 먼저예요(日本橋駅 이 日本橋 보다 먼저). 길이가 같으면 우선순위가 큰 쪽이에요. / 꺼진 항목은 쓰이지 않지만 버전 기록과 내보내기에 남아요. / 바꾸면 다음 문장부터 반영돼요. 이미 만든 소리는 새 사전으로 다시 만들어요. |
| 요약 카드 | {env} 사전 v{n} / 버전 기록 › / 사용 중 {a} · 꺼짐 {b} / 마지막 변경 {ago} · {작업자} · {요약} / 아직 사전 버전이 없어요 — 첫 항목을 추가하면 v1 이 만들어져요. |
| 안내 줄(`NOTE`) | READ_ONLY: 보기 전용이에요 — 바꾸려면 voices.manage 권한이 필요해요. / PROD_SUPER_ONLY: 운영 환경 사전은 SUPER_ADMIN 만 바꿀 수 있어요. 읽기 확인·미리듣기는 할 수 있어요. / PROD_WARN: 운영 환경 사전이에요 — 바꾸면 모든 학습자의 선생님 목소리 읽기가 바뀌어요. |
| 액션 | ＋ 항목 추가 / 가져오기 / 내보내기 / 문장으로 읽기 확인 |
| 필터 | 표기·읽기 검색 (예: 日本橋, ニホン) (aria: 표기·읽기 검색) / (aria) 범위: 모든 범위 · GLOBAL · COURSE · LESSON · VOICE · USER / 모든 목소리 / 대상 id (선택) / 꺼진 항목 포함 |
| 목록 | {n}개 · 조건에 맞는 항목 / 표기 · 읽기 · 악센트 · 우선순위 · 범위 · 상태 · 수정 / 평판 / 악센트 {n}(평판) / 우선 {n} / (aria) {표기} 고치기 · {표기} 보기 / (aria) 쪽 이동 / ‹ 이전 · {p} / {q} · 다음 › / 항목은 지우지 않고 끄기만 해요 — 버전 기록과 내보내기에 남아요. |
| 빈 목록 | (전체) 아직 항목이 없어요. [＋ 항목 추가]로 첫 단어를 넣어 보세요. — 보기 전용이면 "아직 항목이 없어요." 만 / (조건) 조건에 맞는 항목이 없어요. 검색어나 범위를 바꿔 보세요. |
| 상태 | 사용 중 · 꺼짐 (aria: 상태: 사용 중 · 상태: 꺼짐) |
| 범위 `SCOPE_KO` | GLOBAL 전체 — 모든 학습자·모든 목소리 / COURSE 코스 — 한 주제(코스)에서만 / LESSON 레슨 — 한 레슨에서만 / VOICE 목소리 — 한 목소리에서만 / USER 사용자 — 한 학습자에게만(이름 같은 개인 고유명사) |
| 대상 이름 | 코스 id · 레슨 id · 목소리 · 사용자 id |
| 종류 `WORD_TYPE_KO` | 선택 안 함 · PROPER_NOUN 고유명사 · PERSON 인명 · PLACE 지명 · COMMON 일반어 · LOANWORD 외래어 · ABBREVIATION 약어 |
| 시트 제목 | 항목 추가 / 항목 고치기 / 항목 보기 / 항목 끄기 / 항목 다시 켜기 / 사전 가져오기 / 사전 내보내기 / 버전 v{n} |
| 항목 머리 | 표기·범위는 바꿀 수 없어요 — 끄고 새로 추가해 주세요. / 꺼진 항목이에요. 고쳐 저장해도 꺼진 채로 남아요. / 다시 켜기 |
| 칸 | 표기* / 읽기* / 악센트 (내려가는 자리) / 우선순위 / 종류 / 범위* / 대상* / 메모 / 변경 이유* / (aria) 확인 문구 |
| 칸 도움말 | 가타카나로 저장해요 · {n}모라 / 저장할 때 가타카나로 바꿔요 · {n}모라 / 읽기를 먼저 입력해 주세요 / 입력한 악센트는 저장돼요. 지금 목소리에는 읽기만 반영되고 높낮이는 목소리가 스스로 정해요. / 우선순위는 같은 길이의 표기가 겹칠 때만 써요(큰 쪽이 먼저). / 저장할 때 서버가 있는 id 인지 확인해요. / (꺼짐) |
| placeholder | 예: 日本橋, 等々力 / 예: ニホンバシ (히라가나로 써도 돼요) / 코스 id · 레슨 id · 사용자 id / 왜 이렇게 읽는지 (선택) / 예: 日本橋 가 ニッポンバシ 로 읽혀서 / PRODUCTION |
| 악센트 칩 | 0 평판 / {i} {모라} (aria: 0, 평판 — 내려가지 않음 · {i}, {모라} 다음에서 내려감) |
| 저장 줄 | 저장하면 사전 v{n} 이 만들어지고 다음 문장부터 반영돼요. / 적용하면 사전 v{n} 이 만들어져요. |
| 버튼 | 저장 / PRODUCTION 에 저장 / 저장하는 중… / 취소 / 이 항목 끄기 / 끄기 / PRODUCTION 에서 끄기 / 다시 켜기 / PRODUCTION 에서 다시 켜기 / 돌아가기 / 닫기 / 입력 버리고 닫기 / 계속 쓰기 / 새로 불러오기 / 그 항목 열기 / 목록 새로 고침 |
| 끄기 확인 | 이 항목을 끌까요? 다음 문장부터 이 읽기({reading})를 쓰지 않아요. / 지우지 않아요 — 버전 기록과 내보내기에 남고, 언제든 다시 켤 수 있어요. |
| 켜기 확인 | 이 항목을 다시 켤까요? 다음 문장부터 이 읽기를 다시 써요. |
| 닫기 확인 | 저장하지 않은 입력이 있어요. 닫을까요? |
| PRODUCTION 확인 | 운영 환경(PRODUCTION) 사전을 바꿔요 / 모든 학습자의 선생님 목소리 읽기가 바뀌어요. 확인하려면 아래에 PRODUCTION 을 그대로 입력해 주세요. |
| 빠른 이유(`QUICK_REASONS`) | save: 오독 수정 · 새 고유명사 · 악센트 조정 · 우선순위 조정 / disable: 잘못 넣은 항목 · 더 이상 필요 없음 · 다른 항목과 겹침 / enable: 다시 필요해짐 / import: 일괄 추가 · 사전 복원 / rollback: 문제 있는 변경 되돌림 |
| 토스트 | 저장했어요 · 사전 v{n} / 껐어요 · 사전 v{n} / 다시 켰어요 · 사전 v{n} / 가져왔어요 · 사전 v{n} (추가 {a} · 수정 {b} · 끄기 {c}) / 되돌렸어요 · v{k} 내용으로 사전 v{n} / 내려받았어요 · v{n} / 바뀐 내용이 없어요 |

ⓑ 입력 검증(칸 아래 12px `text-bad` — 서버 422 필드 코드도 같은 표)

| 칸 | 조건 · 서버 코드 | 문구 |
|---|---|---|
| 표기 | 비었음 · `E_SURFACE` | 표기를 입력해 주세요. |
| 표기 | 40자 초과 · `E_SURFACE` | 표기는 40자까지예요({n}자). |
| 표기 | 일본어 글자 없음 · `E_SURFACE_NOT_JA` | 일본어 글자(가나·한자)가 들어가야 해요. |
| 표기 | 제어·보이지 않는 문자 · `E_SURFACE_CHARS` | 보이지 않는 문자가 섞여 있어요. 지우고 다시 입력해 주세요. |
| 읽기 | 비었음 | 읽기를 입력해 주세요. |
| 읽기 | 가나·ー 밖 문자 · `E_READING` | 읽기는 가나(히라가나·가타카나)와 장음 ー 만 쓸 수 있어요. |
| 읽기 | 60자 초과 | 읽기는 60자까지예요({n}자). |
| 악센트 | 범위 밖 · `E_ACCENT` | 악센트는 0(평판)부터 {n}(모라 수)까지예요. |
| 우선순위 | 정수 아님·범위 밖 · `E_PRIORITY` | 우선순위는 0~1000 사이 정수예요. |
| 범위 | 안 고름 · `E_SCOPE` | 범위를 골라 주세요. |
| 대상 | 비었음 · `E_SCOPE_REF` | {대상 이름}를 입력해 주세요. / (VOICE) 목소리를 골라 주세요. |
| 대상 | 40자 초과 | 대상 id 는 40자까지예요. |
| 대상 | 없는 id · `E_SCOPE_REF_NOT_FOUND` | 그 id 의 {대상}를 찾을 수 없어요. |
| 종류 | `E_WORD_TYPE` | 종류를 목록에서 골라 주세요. |
| 메모 | 200자 초과 · `E_NOTE` | 메모는 200자까지예요. |
| 이유 | 비었음 · `E_REASON` | 변경 이유를 입력해 주세요. |
| 이유 | 200자 초과 | 이유는 200자까지예요({n}자). |
| 확인 문구 | 불일치 · `E_CONFIRM` | PRODUCTION 을 그대로 입력해야 바꿀 수 있어요. |
| 예문 | 비었음 | 예문을 입력해 주세요. |
| 예문 | 200자 초과 | 예문은 200자까지예요({n}자). |
| (모르는 코드) | — | 입력값을 확인해 주세요 ({code}) |

ⓒ 미리듣기

| 자리 | 문구 |
|---|---|
| 머리 | 미리듣기 / 저장하지 않은 입력으로 읽어 봐요. 사전은 바뀌지 않아요. / 지금 사전으로 읽어 봐요. / 선생님이 이상하게 읽는 문장을 넣어 보고, 틀린 단어를 찾아 항목으로 추가해요. |
| 칸 | 예문 / 목소리 / 기본 목소리 / (꺼짐) / 목소리 범위 항목이라 그 목소리로 들어요 |
| 버튼 | 읽기 확인 / 읽는 중… / {n}초 뒤 다시 / (aria) 적용 전 읽기 듣기 · 적용 후 읽기 듣기 · 지금 사전으로 듣기 · 멈추기 |
| 줄 라벨 | 적용 전 · 지금 사전 v{n} / 적용 후 · 이 입력 / 지금 사전 v{n} |
| 판정 | 읽기가 달라져요 / 지금과 같게 읽어요 / · 이 예문에 {n}번 적용 / ⚠ 이 예문에는 이 항목이 걸리지 않았어요. 예문에 표기 「{surface}」가 있는지, 더 긴 표기의 다른 항목이 먼저 걸리지 않았는지 확인해 주세요. / 입력이 바뀌었어요 — 다시 확인해 주세요. / 표기·읽기를 올바르게 입력하면 확인할 수 있어요. |
| 429 | 미리듣기는 1분에 10번까지예요. {n}초 뒤에 다시 해 주세요. |
| 502·503·504 | 지금은 선생님 목소리 서비스에 닿지 않아 읽기 확인·미리듣기를 할 수 없어요. 저장은 할 수 있어요. |
| 422 예문(치환 뒤 길이 초과 포함) | 예문이 너무 길어요. 더 짧게 줄여 주세요. |
| 소리만 실패(읽기는 옴) | 소리를 만들지 못했어요. 읽기는 위에서 확인할 수 있어요. |
| 재생 실패·만료 | 소리를 재생하지 못했어요. [읽기 확인]을 다시 눌러 주세요. |
| 403 | 미리듣기 권한이 없어요 (voices.manage). |
| 0 | 연결하지 못했어요. 네트워크를 확인해 주세요. |

ⓓ 저장·끄기·켜기·가져오기·되돌리기 오류(`SheetNotice` — 확정 버튼 위, `role="alert"`)

| status · code | 문구 | 보조 버튼 |
|---|---|---|
| 409 `VERSION_CONFLICT` | 다른 곳에서 사전이 바뀌었어요 (v{base} → v{current}). 새로 불러온 뒤 다시 저장해 주세요. 입력한 내용은 그대로예요. | 새로 불러오기 |
| 409 `VERSION_CONFLICT`(가져오기 적용) | 미리 본 뒤에 사전이 바뀌었어요 (v{base} → v{current}). 변경 내용을 다시 확인해 주세요. | 다시 미리 보기 |
| 409 `VERSION_CONFLICT`(되돌리기) | 다른 곳에서 사전이 바뀌었어요 (v{base} → v{current}). 목록을 새로 불러온 뒤 다시 확인해 주세요. | 새로 불러오기 |
| 409 `E_LEXICON_DUPLICATE` | 같은 범위에 「{surface}」 항목이 이미 있어요{꺼져 있으면 " (꺼져 있어요)"}. | 그 항목 열기 |
| 409 `ALREADY_ACTIVE` | 지금 쓰는 버전이에요. | — |
| 409 `NO_CHANGE` | 지금 사전과 내용이 같아 되돌릴 것이 없어요. | — |
| 403(`missing` 에 `config.apply.production` · code `PRODUCTION_CONFIRMATION_REQUIRED`) | 운영 환경 사전은 SUPER_ADMIN 이 확인 문구를 넣어야 바꿀 수 있어요. | — |
| 403 그 밖 | 이 변경 권한이 없어요 ({missing}). | — |
| 404(항목) | 이 항목을 찾을 수 없어요. 목록을 새로 불러와 주세요. | 목록 새로 고침 |
| 404(버전) | 그 버전을 찾을 수 없어요. | — |
| (요청 전) 확장자 | CSV 나 JSON 파일만 올릴 수 있어요. | — |
| (요청 전) 256KB 초과 · 413 · `E_IMPORT_TOO_LARGE` | 파일이 256KB 를 넘어요({n}KB). 나눠서 올려 주세요. | — |
| 422 `E_IMPORT_TOO_MANY_ROWS` | 2,000행을 넘어요({n}행). 나눠서 올려 주세요. | — |
| 415 · 422 `E_IMPORT_FORMAT` | 파일을 읽지 못했어요. UTF-8 CSV 나 JSON 배열인지 확인해 주세요. | — |
| 422 `E_IMPORT_HEADER` | CSV 첫 줄(머리글)이 형식과 달라요. [파일 형식]을 확인해 주세요. | — |
| 422 `E_IMPORT_HAS_ERRORS`(적용 때) | 오류가 있는 행이 있어 적용하지 않았어요. 고친 파일로 다시 확인해 주세요. | 다시 미리 보기 |
| 422 필드(항목 저장) | (각 칸 아래 ⓑ) | — |
| 429 | 너무 자주 눌렀어요. {n}초 뒤에 다시 해 주세요. | — |
| 500 | 저장하지 못했어요. 잠시 뒤 다시 눌러 주세요. 입력한 내용은 그대로예요. | — |
| 0 | 연결하지 못했어요. 네트워크를 확인해 주세요. | — |
| 0(가져오기 적용·되돌리기 중 끊김) | 연결이 끊겼어요. 적용됐는지 모르니 목록을 새로 불러와 확인해 주세요. | 목록 새로 고침 |
| 401 | (`api.ts` 가 로그인으로 보낸다 — 화면 문구 없음) | — |
| 422 `E_SNAPSHOT_INTEGRITY`(버전 상세·되돌리기 확인 diff — 이 버전 손상) | v{n} 기록이 손상돼 비교·되돌리기를 할 수 없어요. 올바른 내보내기 파일이 있으면 가져오기로 복구해 주세요. | 없음(빈 diff·개수 칩 안 보임) |
| 422 `E_SNAPSHOT_INTEGRITY`(직전 버전 손상) | 직전 버전 v{p} 기록이 손상돼 비교할 수 없어요. | 없음(이 버전이 멀쩡하면 되돌리기는 가능) |
| 422 `E_SNAPSHOT_INTEGRITY`(되돌리기 거절) | v{n} 기록이 손상돼 되돌릴 수 없어요. 올바른 내보내기 파일이 있으면 가져오기로 복구해 주세요. | 없음(확정 버튼 거둠, [돌아가기]만) |

가져오기 행 오류(`importErrorText`, 모르는 코드는 "확인이 필요해요 ({code})")

| code | 문구 |
|---|---|
| `E_SURFACE` · `E_SURFACE_NOT_JA` · `E_SURFACE_CHARS` | 표기가 비었거나 40자를 넘거나, 일본어가 아니거나 보이지 않는 문자가 있어요 |
| `E_READING` | 읽기는 가나와 ー 만 쓸 수 있어요(60자까지) |
| `E_ACCENT` | 악센트가 0~모라 수 밖이에요 |
| `E_PRIORITY` | 우선순위는 0~100 정수예요 |
| `E_SCOPE` | 범위는 GLOBAL·COURSE·LESSON·VOICE·USER 중 하나예요 |
| `E_SCOPE_REF` | GLOBAL 은 대상 id 가 비어야 하고, 나머지는 있어야 해요 |
| `E_SCOPE_REF_NOT_FOUND` | 대상 id 를 찾을 수 없어요 |
| `E_WORD_TYPE` | 종류 값이 목록에 없어요 |
| `E_NOTE` | 메모가 200자를 넘어요 |
| `E_DUPLICATE_IN_FILE` | 파일 안에 같은 표기·범위가 두 번 있어요 |
| `E_ENABLED` | enabled 는 true 또는 false 여야 해요 |
| `E_ROW_FORMAT` | 칸 수가 머리글과 달라요 |

ⓔ 가져오기 · 내보내기 · 버전

| 자리 | 문구 |
|---|---|
| 가져오기 | 파일 고르기 (CSV · JSON) / 다른 파일 고르기 / {name} · {n}KB / 파일을 골라 주세요 / 파일 형식 / CSV(UTF-8) 첫 줄: / JSON: 같은 키를 가진 객체의 배열 · 최대 2,000행 · 256KB · 내보내기 파일을 그대로 다시 올릴 수 있어요. / (aria) 가져오는 방식 |
| 방식 | 합치기 (MERGE) — 파일의 항목을 추가하거나, 같은 표기·범위의 항목을 파일 값으로 고쳐요. 파일에 없는 항목은 그대로 둬요. / 범위 바꾸기 (REPLACE_SCOPE) — 파일에 나온 범위(예: GLOBAL)를 파일 내용으로 통째로 바꿔요. / ⚠ 그 범위에서 파일에 없는 항목은 모두 꺼져요. |
| 미리 보기 | 변경 내용 미리 보기 / 파일을 확인하는 중… / {n}행 확인 · 지금 사전 v{v} 기준 / 추가 {n} · 수정 {n} · 끄기 {n} · 그대로 {n} · 오류 {n} / 바뀌는 범위: {…} / ⚠ 적용하면 {n}개 항목이 꺼져요. / 바뀌는 항목 보기 ({n}) / 오류 {n}행 (앞 {k}개만 보여요) / 행 · 칸 · 사유 / {row}행 · {field} — {사유} / 오류가 있는 행을 고친 파일로 다시 확인해 주세요. 오류가 0 일 때만 적용할 수 있어요. / 바뀌는 항목이 없어요 — 지금 사전과 같아요. |
| 적용 | 적용 / PRODUCTION 에 적용 / ({n}개 끄기 포함) / 적용하는 중… |
| 내보내기 | 지금 쓰는 {env} 사전 v{n} 전체(꺼진 항목 포함 {total}개)를 내려받아요. 이 파일을 그대로 가져오면 바뀌는 것이 없어요. / (aria) 파일 형식: CSV · JSON / 엑셀·스프레드시트에서 열 수 있어요. / 다른 도구나 백업에 쓰기 좋아요. / 앱에서는 파일 저장이 안 될 수 있어요. 안 되면 컴퓨터 브라우저에서 내려받아 주세요. / 내려받기 / 만드는 중… / 내려받지 못했어요. 잠시 뒤 다시 눌러 주세요. |
| 버전 기록 | ← 발음 사전 / 버전 기록 / {env} 사전의 모든 변경이 버전으로 남아요. 되돌리기는 과거 버전 내용으로 새 버전을 만들어요(기록은 지우지 않아요). / 상태 뜻 / 지금 적용 중 · 새 버전에 밀려났어요 · 이 버전의 변경을 되돌려 새 버전으로 바꿨어요 / 요약 없음 / 항목 {n}개(사용 중 {m}) / 시스템 · 알 수 없음 / 더 보기 |
| 버전 상세 | 직전 버전(v{n})과 비교 / 첫 버전 / 항목 수 · 스냅샷 해시 / 추가 · 수정 · 끔 · 다시 켬 / 이제 쓰지 않아요 · 다시 써요 · 메모 바뀜 · 외 {n}개 · 바뀐 항목이 없어요. / 지금 쓰는 버전이에요. / v{n} 내용으로 되돌리기 |
| 되돌리기 확인 | 지금(v{a}) 사전을 v{n} 내용으로 되돌리면: / 새 버전 v{a+1} 이 만들어지고 v{a} 는 '되돌려짐'으로 표시돼요. 다음 문장부터 반영돼요. / 지금 사전과 내용이 같아 되돌릴 것이 없어요. / PRODUCTION 에서 되돌리기 |
| 버전 상태 | ACTIVE 사용 중 · SUPERSEDED 이전 · ROLLED_BACK 되돌려짐 |
| diff 종류(`DIFF_KO`) | ADDED 추가 · CHANGED 수정 · DISABLED 끔 · ENABLED 다시 켬 |
| TTS 역할 링크 | 발음 사전 / 읽기가 틀린 단어 고치기 / 항목·미리듣기·가져오기·버전 기록 |
| 메뉴 | 발음 사전 / 읽기·악센트 고치기·버전 |

### 10-9. 360/390/412 · 데스크톱 · 접근성 체크리스트

폭·배치
- [ ] 360·390·412 + 데스크톱(1280·1024) — 두 화면·다섯 시트 모두 가로 스크롤 0. 긴 값으로 확인: 표기 40자(한자만), 읽기 60자(拗音·ー 섞기), cuid 25자 scopeRefId, 메모 200자, 이유 200자, changeSummary 300자, 가져오기 오류 200행, 파일 이름 120자, 악센트 칩 40개.
- [ ] 목록 컨테이너 <720 = 카드, ≥720 = 표(1024 에서 사이드바를 뺀 본문 ≈744px 에서 표). 표는 `table-fixed` + 칸 안 줄바꿈으로 넘치지 않는다(표기·읽기를 `truncate` 로 자르지 않는다).
- [ ] 세로 스크롤은 `main` 하나 + 열린 시트 안 하나. 범위 칩·악센트 칩·빠른 이유 줄은 가로 스크롤만(스크롤바 숨김), 포커스 링이 잘리지 않음(`py-1`).
- [ ] 시트(85dvh)에서 390·키보드가 올라와도 이유 칸·[저장]까지 시트 안 스크롤로 닿는다.
- [ ] 필터·쪽이 URL 에 남는다: 새로 고침·뒤로 가기 뒤 같은 목록. `?v=` 로 버전 상세가 다시 열린다. 틀린 쿼리(`?scope=X&page=-1`)는 조용히 무시.

터치·글자
- [ ] 카드 행 ≥64px, 표 첫 칸 버튼 ≥44px, 모든 버튼·칩·▶·토글·쪽 이동·"이 항목 끄기"·`<summary>` ≥44px. `Btn size="sm"`(38px) 을 쓰지 않는다.
- [ ] 일본어(표기·읽기·예문·높낮이 표기·diff 표기·RulesNote 예시)는 `lang="ja"` + 16px 이상(목록 표기 17px·표 16px·읽기 15px 는 보조 줄), 한국어 문장에만 `break-keep`.
- [ ] 읽어야 하는 글에 `ink3`·`warn` 글자·`accent` 뱃지 글자 없음(§1-1). 꺼진 행을 흐리게 하지 않는다. 되돌려짐 뱃지·PRODUCTION 확인 상자·끄기 경고 = `text-bad` on `bg-surface`.
- [ ] 다크 모드: 토큰만, 하드코딩 색 0.

권한·노출
- [ ] USER: 두 경로 모두 `/zzz` 와 같은 404, 메뉴·TTS 링크 없음(§6).
- [ ] ADMIN·DEVELOPER·SUPER_ADMIN(LOCAL): 메뉴 "엔진 › 발음 사전", 모든 쓰기 버튼·미리듣기 보임, 확인 문구 칸 없음.
- [ ] PRODUCTION 갈래는 `access.test.ts`(가짜 env·capability)로: ADMIN·DEVELOPER → 쓰기 버튼 0 + 안내 줄, 미리듣기 있음 · SUPER_ADMIN → 확인 문구 칸, 버튼 "PRODUCTION 에 저장", 문구가 다르면 요청 0. (실제 PRODUCTION 프로세스에서 누르지 않는다.)
- [ ] `voices.read` 만(가짜 capability): 쓰기·미리듣기·가져오기·되돌리기 버튼 DOM 0, 내보내기·버전 보기 있음, 안내 줄 "보기 전용이에요".
- [ ] **엔진명 0**: 두 화면·시트의 렌더 텍스트·`aria-label`·토스트에서 `g2p|openjtalk|mecab|user[_-]?dict|style-?bert|sbv2|\bM4\b|:8200|reazon|whisper|claude|haiku|sonnet|opus|qwen` 0건(대소문자 무시). `src/components/admin/lexicon/**` 의 문자열 리터럴도 같은 grep 0(주석 제외).
- [ ] 서버 `message` 를 그리지 않는다 — 409·422 에서도 §10-8 문구만.

동작(완료 기준 7 · 5 · 6 대응)
- [ ] 검색(표기·읽기)·범위 칩·목소리/대상 id·꺼진 항목 포함·쪽 이동이 L1 파라미터로 나간다(네트워크 탭). 빠르게 쳐도 요청이 겹쳐 보이지 않는다(디바운스·abort).
- [ ] 추가·수정·끄기·다시 켜기 → 토스트 "사전 v{n+1}" · 요약 카드 번호 갱신 · 이유 없이 누르면 요청 0 + 이유 칸 포커스. 수정 없이 [저장] → "바뀐 내용이 없어요", 요청 0.
- [ ] 두 탭에서 같은 사전을 연 뒤 한쪽 저장 → 다른 쪽 저장 시 409 안내·입력 유지 → [새로 불러오기] 뒤 저장 성공.
- [ ] 같은 표기·범위 추가 → 중복 안내 + [그 항목 열기].
- [ ] 미리듣기: 적용 전/후 두 줄(가나·↑↓), ▶ 각각 재생, 다른 쪽 누르면 앞 소리 멈춤, 재생 중 입력을 바꾸면 멈추고 흐려짐. 저장 없이 닫으면 DB 행·버전·TtsCache 변화 0(QA 가 API·DB 로 대조). 11번째 요청 → 카운트다운. 목소리 서비스가 꺼진 상태 → "선생님 목소리 서비스에 닿지 않아…" + [저장]은 동작.
- [ ] 가져오기: 256KB 초과·다른 확장자는 요청 없이 거절. dryRun → 개수·오류 행(잘못된 가나·중복·scopeRefId) 표시, DB 변화 0. 오류가 있으면 적용 버튼 없음. 오류 0 → 적용 → 새 버전. REPLACE_SCOPE 끄기 수가 세 곳(방식 설명·결과·버튼)에 보임. 내보낸 파일 다시 가져오기 → "바뀌는 항목이 없어요".
- [ ] 내보내기 CSV·JSON: 파일명·내용(꺼진 항목 포함), 데스크톱 Chrome 에서 저장됨, 시트가 닫히지 않음.
- [ ] 버전 기록: 상태 3종 뱃지·상세 diff·되돌리기 → 새 ACTIVE + 직전 "되돌려짐", 사용 중 버전엔 버튼 없음, 같은 내용이면 "되돌릴 것이 없어요". `?v=` 새로 고침.
- [ ] 끝나면 QA 데이터를 되돌려 시드 GLOBAL 6건 그대로(완료 기준 8).

접근성
- [ ] 시트: `role=dialog aria-modal`, 제목 포커스, 닫으면 연 버튼으로 포커스 복귀, Esc(제출 중 제외). 모드가 바뀌면 제목으로 포커스.
- [ ] 표: sr-only `<caption>`·`<th scope="col">`, 첫 칸 버튼 `aria-label="{표기} 고치기|보기"`. 카드 목록은 `<ul>` + 행 `<button>`.
- [ ] 범위 칩·범위 카드·악센트 칩·가져오기 방식 = `role=radiogroup/radio` + `aria-checked`, 꺼진 항목 포함 = `aria-pressed`. 악센트 칩은 ←/→ 이동.
- [ ] 오류 칸 `aria-invalid` + `aria-describedby`, 제출 실패 시 첫 오류 칸 포커스. notice 는 `role="alert"`, 미리듣기 결과·가져오기 결과·목록 개수·쪽 번호는 `aria-live="polite"`.
- [ ] 높낮이 표기의 `aria-label` 은 ↑↓ 대신 "올라감·내려감".
- [ ] 뱃지는 글자로 뜻을 전한다(점 `aria-hidden`). 포커스 링이 보인다(outline 제거 금지).

### 10-10. 주의사항

- **엔진명·서버 문구**: 콘솔이지만 이 화면은 엔진 독립 데이터라 엔진·모델·서비스 이름을 쓰지 않는다(§10-0 ⑬). #82 목소리 DTO 의 `ttsEngineId`·`model`·`speaker` 는 읽지 않는다(`id`·`displayName`·`status`·`enabled` 만).
- **초안은 저장이 아니다**: 미리듣기(L7)는 쓰기가 아니다 — 이유·확인 문구를 묻지 않고 PRODUCTION 의 ADMIN·DEVELOPER 도 쓸 수 있다. 결과 카드에 "사전은 바뀌지 않아요"를 늘 적는다.
- **악센트 정직성**(§10-11 ①): 입력한 악센트가 지금 소리에 반영되지 않는다는 사실을 칸 아래에 적는다. 미리듣기 "적용 후" 높낮이가 입력한 악센트와 달라도 오류로 표시하지 않는다.
- **REPLACE_SCOPE 위험**: 방식 설명·미리 보기 결과·확정 버튼 세 곳에서 끄기 수를 말한다. 오류 행이 하나라도 있으면 적용 버튼이 없다(부분 적용이 의도치 않은 끄기로 번지지 않게).
- **baseVersion**: 쓰기 요청은 늘 화면이 본 사용 중 번호를 싣고, 성공하면 응답 번호로 **즉시** 갱신한다(목록 재조회를 기다리면 연속 저장이 헛 409 가 된다).
- **자동재생 금지**: 결과가 와도 저절로 재생하지 않는다. ▶ 탭 핸들러 안에서 동기로 `unlockTtsAudio()`.
- **소리·URL 흔적**: 미리듣기 소리를 브라우저 저장소에 두지 않는다. `audioUrl` 을 DOM(`src` 속성)·`console.log` 에 남기지 않는다.
- **다운로드**: 내보내기 blob URL 은 클릭 직후 revoke. 앱 WebView 는 저장이 안 될 수 있어(DownloadListener 없음) 앱에서만 안내 한 줄 — 기능은 숨기지 않는다.
- **파일 읽기**: 가져오기 파일을 화면에서 파싱·표시하지 않는다(`FileReader` 없음). 크기·확장자만 보고 내용 검증은 서버 결과를 그린다. `dangerouslySetInnerHTML` 금지(표기·메모·changeSummary 모두 글자로).
- **운영 주의**: 운영 pm2 가 `APP_ENV=LOCAL` 이라 dev·QA 가 LOCAL 사전에 쓴 것이 **실사용자 발음**이 된다(A 기록 05:06). 화면 점검은 USER scope·가짜 표기만, 끝나면 되돌리기로 기준선 복귀.
- **캐시**: 사전이 바뀌면 TTS 캐시는 버전 키로 자연히 새로 만들어진다 — 화면에 "캐시 비우기" 같은 버튼을 두지 않는다.
- **오프라인**: 목록은 ErrorBlock + 다시 시도. 시트 안 쓰기는 notice + 입력 유지. 가져오기 적용·되돌리기 중 끊기면 결과를 모르므로 "목록을 새로 불러와 확인" 안내(§10-8 ⓓ).

### 10-11. Leader 확인 요청

| # | 항목 | 화면이 가정한 것 | 틀리면 |
|---|---|---|---|
| ① | **악센트가 소리에 반영되지 않음** | 현 방식 A 는 표기를 가타카나 읽기로 **치환만** 하고(`engine/adapters/tts/styleBertHttp.ts` `substituteReadings`, 주석 "악센트는 엔진 g2p 에 맡김"), 높낮이는 합성기가 정한다 → `accentType` 은 저장만 되고 소리에 영향이 없다. 화면은 이것을 악센트 칸 아래 한 줄로 밝히고, 미리듣기 "적용 후" 에 실제 높낮이를 보인다 | 사용자 결정 사항: 악센트 칸을 숨기거나(엔티티엔 남김) 방식 B(엔진 사용자 사전)를 앞당긴다. **화면 권장은 숨기지 않고 두기**(시드 값 보존·방식 B 대비·정직한 안내) |
| ② | **버전 상세 diff API(L8a) 없음** | 정본 표는 버전 목록·rollback 만. 상세·되돌리기 확인에 `GET …/lexicon/versions/:v?compare=previous\|active` → `{…버전 필드, compare, against, counts, rows(≤100), truncated}` 를 요청(스냅샷 두 개를 서버가 비교 — 화면에 스냅샷 전체를 내려보내지 않는다) | 없으면: 상세 = 메타·요약만, 되돌리기 확인 = "v{n} 의 항목 {entryCount}개로 되돌려요" 한 줄(무엇이 바뀌는지 모르고 되돌리게 됨 — 권장하지 않음) |
| ③ | **미리듣기 응답 모양** | JSON `{dictionaryVersion, before, after?}` 를 `compare:true` 한 번으로(읽기 확인만이라 가볍다). 소리는 ㉠`side.audioUrl`(task-007 서명 URL 규칙: 사용자 결속·10분·실패 404) 또는 ㉡같은 L7 을 `Accept: audio/wav` + `side` 로 다시 호출(§7 과 같은 wav 본문) — 화면은 둘 다 처리. `draftEntries` 는 **범위 문맥과 상관없이 이번 요청에 적용**하고 같은 키(범위·대상·표기)의 저장 항목을 대신한다(USER·LESSON 초안도 들어 볼 수 있게). `after.matches` 로 적용 횟수 | `compare` 가 없으면 화면이 L7 을 두 번 부른다(분당 10회를 두 배로 씀). 초안이 범위 때문에 안 걸리면 "걸리지 않았어요"만 나온다 |
| ④ | 예문 길이 | 계약 ≤200 이지만 합성 1회 상한이 100자(tts-service `/synthesize`)이고 치환으로 길어진다 → 화면 상한 **100자**, 초과 422 는 "예문이 너무 길어요" | A 가 문장 분할을 하면 200 으로 올린다(숫자 하나) |
| ⑤ | L1 파라미터·응답 | `enabled=1\|all`(Leader G1, 정본 표엔 없음) · `pageSize=50` · 정렬 `updatedAt desc` · 응답에 `dictionaryVersion`·`counts`·`active`(요약 카드용). 검색어의 히라가나 → 읽기(가타카나) 매칭은 서버 몫 | `counts`·`active` 가 없으면 요약 카드가 L8 1쪽을 한 번 더 읽는다 |
| ⑥ | 중복 409 본문 | `E_LEXICON_DUPLICATE` + `details.existing`(항목 DTO) → [그 항목 열기]가 바로 그 항목 시트를 연다(꺼진 중복 포함 — unique 가 `enabled` 와 무관) | `existingId` 만이면 표기·범위·꺼진 항목 포함으로 필터를 걸어 찾게 한다 |
| ⑦ | **검증 경계 불일치** | 정본(domain-model 주석·16 §2.2 L-4·현 `validateLexiconEntry`) = 읽기 **가타카나·ー 만, ≤60**, 우선순위 0~1000 / Leader G3 = 가나(히라가나 포함) 1~80, 우선순위 0~100. 화면: 히라가나 입력 허용 → **보내기 전에 가타카나로 바꿈**(저장값은 늘 가타카나), 읽기 ≤60(DB 컬럼 `VarChar(60)`), 우선순위 0~100. 표기 "일본어 문자 포함"·"숨은 문자" 코드 이름(`E_SURFACE_NOT_JA`·`E_SURFACE_CHARS`)은 화면 제안 | A 의 최종 규칙으로 `validateDraft` 숫자·코드만 바꾼다. 읽기 80 을 쓰려면 DB 컬럼 변경(사용자 승인) |
| ⑧ | PRODUCTION 확인 필드 | 본문 `confirm: 'PRODUCTION'`(대상 환경 이름을 그대로 입력). 버튼은 SUPER_ADMIN(`config.apply.production`)에게만 보인다. 다른 역할은 PRODUCTION 에서 보기 + 미리듣기만 | 필드 이름·값만 맞추면 된다. admin-console/09 §3 의 `confirmation.token` 방식이면 토큰 발급 호출이 하나 더 필요 |
| ⑨ | **가져오기는 전부 아니면 전무** | 오류 행이 1개라도 있으면 적용하지 않는다(화면은 버튼을 숨기고, 서버도 dryRun=0 을 422 `E_IMPORT_HAS_ERRORS` 로 거절). multipart 필드 `file`·`reason`·`baseVersion`·`confirm`, 쿼리 `mode`·`dryRun`. 결과에 `changes`(≤100)·`scopes`(REPLACE_SCOPE 범위별 끄기 수)·`errors`(≤200) | "오류 행 빼고 적용"을 원해도 REPLACE_SCOPE 에서는 막아야 한다(빠진 행이 끄기로 번짐) |
| ⑩ | 묶음 게시 없음 | 16 §2.3 의 "변경 묶어서 게시"(draft 항목 `versionId=null`)는 엔티티에 칸이 없어 이번엔 **저장 1번 = 버전 1개** | 필요하면 스키마 변경(사용자 승인) + 화면에 "게시 대기" 목록 추가 |
| ⑪ | `components/speech/ttsAudio` import | admin 이 `(app)` 컴포넌트를 import 하지 않는 규칙(§6-5)의 예외 — 화면 문구 없는 재생 유틸(`unlockTtsAudio`·`playWav`)만. 다음에 `components/common/audio` 로 옮기길 권장(별도 task) | 옮기면 import 경로만 바뀐다 |
| ⑫ | 메뉴 행 소유 | `menu.ts` 는 A 소유 모듈이다. 한 줄이라 **B 가 추가하고 A 에 알리길 권장**(A 는 라우트·서비스에 집중) | A 가 추가하면 B 는 `MENU_SUB` 만 |
| ⑬ | `voices.read` 만인 역할이 없다 | role-permission §3 에서 콘솔 역할(ADMIN·DEVELOPER·SUPER_ADMIN)은 모두 `voices.manage` 를 가진다 → "보기 전용" 화면은 실제 계정으로 못 본다. 완료 기준 2·7 의 "읽기 전용 역할 버튼 0" 은 단위 테스트(가짜 capability)로 확인 | QA 가 실제 화면으로 봐야 한다면 임시 역할·capability 조작이 필요(권장하지 않음) |
| ⑭ | ROLLED_BACK 뜻 | A 기록(05:06)·admin-console/09 §5 대로 **밀려난 직전 ACTIVE** 가 ROLLED_BACK, 복원 대상은 그대로. 뱃지 "되돌려짐"·설명 문구는 이 뜻 기준. `schema.prisma`·domain-model 주석("대상은 ROLLED_BACK")·16 §2.3 과 반대라 정본 주석 정리 필요 | 뜻이 바뀌면 설명 문구만 바꾼다 |
| ⑮ | 작업자·되돌림 표시 | `PronunciationLexiconVersion` 에 `rollbackOf` 칸이 없다 → 되돌림은 `changeSummary`(예: "v7 로 되돌림: {이유}")로만 보인다. 작업자는 `actorUserId` → User 조인으로 `actor{name, role}`, 둘 다 없으면(시드) "시스템". `entryCount`·`enabledCount` 는 스냅샷 길이로 서버가 계산 | `rollbackOf` 를 칸으로 두려면 스키마 변경(사용자 승인) |
| ⑯ | `AuditLog.scope` | 16 §2.3 은 `AuditLog(scope=LEXICON)` 인데 `ConfigScope` enum 에 LEXICON 이 없다(추가 = db push 승인 사항). 화면과 무관하지만 A 가 `scope=null` + `action='lexicon.*'` 로 둘지 확인 필요 | — |
| ⑰ | 범위 대상 고르기 | COURSE·LESSON·USER 는 고르는 목록 API 가 없어 **id 직접 입력**(저장 때 서버가 존재 확인). VOICE 만 #82 목록에서 고른다 | Phase 2 에 주제·레슨·사용자 검색 API 가 생기면 select 로 바꾼다 |
| ⑱ | `apiDelete` 본문 | L4 가 `reason`·`baseVersion`·`confirm` 을 **본문**으로 받는다(이유를 URL 에 싣지 않는다 — 접근 로그 노출). `common/api.ts` 의 `apiDelete` 에 선택 본문 인자 추가 | A 가 `POST …/:id/disable` 을 따로 두면 그걸 쓴다 |
| ⑲ | §6-1 메뉴 라벨 표기 | §6-1 표의 라벨(Dashboard·TTS…)은 영문이지만 구현 `menu.ts` 는 한국어(대시보드·음성 합성…)다. 이 절은 구현 값("발음 사전")을 따른다 | 다음에 §6 을 만지는 task 가 §6-1 표를 `menu.ts` 값으로 맞춘다 |
