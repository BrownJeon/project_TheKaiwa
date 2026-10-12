# TheKaiwa 화면 설계 (screens.md)

> 소유: designer · 구현: developer · 감사: reviewer/qa
> 이 문서는 **화면 구현 가이드의 단일 출처**다. API 요청/응답은 `docs/design/api-contract.md` 를 인용만 하고 다시 정의하지 않는다(#번호로 표기).
> 새 화면이 생기면 §2 목록에 한 줄 추가하고, 화면별 절(§3~)을 덧붙인다.
>
> 변경 이력: 2026-09-27 신규 — §1 토큰·§2 목록·§3 AI 채팅(task-006) · 2026-09-27 §4 단어장·§5 오늘의 단어 추가, §2 오늘·서랍장 행 갱신(task-008) · 2026-09-27 §6 Admin Console Phase 1 추가, §2 설정·콘솔 행 갱신(task-005b) · 2026-09-27 §7 음성(TTS) 상태 표시등·미리듣기 추가, §2 설정·음성 회화방 행 갱신(task-003d) · 2026-09-28 §8 음성 인식 마이크 테스트 추가, §2 설정·음성 회화방 행 갱신(task-003e) · 2026-09-28 §9 AI 회화(음성) 회화방 추가, §2 회화 행·§3 "회화 준비 중" 문구·§7-3 A 폴링 멈춤 범위·§8-2 C 재생 중 버튼 메모(→ barge-in) 갱신(task-007) · 2026-09-28 §10 관리자 콘솔 — 발음 사전(목록·항목 시트·적용 전/후 미리듣기·가져오기/내보내기·버전 기록·되돌리기) 추가, §2 콘솔 행·§6 머리말·§6-1 메뉴 행·§6-2 E·§6-10 발음 사전 문구 갱신(task-003g) · 2026-09-28 §11 안드로이드 앱 전용 화면(휴대폰에서 알아듣기 카드 = 모델 내려받기·인식 방식 문구·경로 한 줄·회화방 전환 안내·앱 로그인 대기·앱 마이크 권한·업데이트 띠/설치 시트/앱 버전 줄·서버 연결 실패 화면·관리자 전용 휴대폰 인식 진단) 추가, §2 회화방·설정 행 갱신 + 로그인·앱 셸·APK 자산 행 추가, §8-1·§8-3 C·§8-8 ⓐⓓ·§9-1·§9-2 G·H 앱/웹 분기 문구 정합(task-003f) · 2026-09-28 **앱 이름 "Lingofy Japanese"·부제 "일본어가 자연스러워지는 AI 회화"**(사용자 결정) — §11-2 G·H·§11-8 ⓗⓙ·§11-11 ⑤ 갱신, 로그인 글자 로고 "Lingofy **Japanese**"(task-003h) · 2026-09-28 **§12 오늘의 회화**(오늘 홈 카드·주제 고르기·붙여넣기·수업 만들기 대기·5단계·종료 카드, 승인 데모 `docs/demo/task-010-today-lesson-v2.html`) 추가, §2 오늘 행·§5-2 A "곧 열려요" 갱신(task-010) · 2026-09-30 하단 탭 이름 "서랍장"→"단어장"(§2 두 행·§4-1 진입, 사용자 결정 — URL `/drawer/*`·모듈 이름은 그대로, task-020) · 2026-10-01 §12 오늘의 회화 개선 4건(승인 데모 `docs/demo/task-025-improve-today-lesson-v1.html`, 결정 a·b·c·d=A, e=B) — §12-2 F 줄 다시 듣기 ▶ · G 오늘의 표현 칩 소리 · H 문제 한국어 줄·옛 수업 대체 표기 · I 글자 비교 밑줄, §12-3 C 재생 키, §12-5·§12-8 갱신(task-025) · 2026-10-04 **§15 일본어 표시 — 히라가나·한글·번역**(승인 데모 `docs/demo/task-026-improve-hangul-reading-v4.html`, F1-A) 추가, §1-3 첫 줄을 §15 로 반전(task-026)

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

- **task-026 으로 반전(승인 데모 v4) — 한자 위 `<ruby>` 히라가나 + `[한글]` 줄 + 번역, 앱 전체 스위치 3개: §15 가 정본이다.** 아래 줄들(본문 아래 히라가나 한 줄·말풍선 [읽기] 토글·`localStorage kaiwa.chat.readingDefault`)은 화면 A·B 배포 전까지의 옛 동작이다.
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

> **⚠ 이름 변경(task-065, 2026-10-12)**: 하단 탭 「**오늘**」의 표시 이름이 「**공부**」로, 회화 홈 상단 제목 「AI와 공부하기」가 「**자유로운 대화**」로 바뀌었다(경로·동작·기능 이름 불변). 이 문서의 나머지 서술에 남은 「오늘 탭」「오늘 홈」「오늘로」「AI와 공부하기」는 각각 「공부 탭」「공부 홈」「공부로」「자유로운 대화」로 읽는다. `/study/today` 화면 제목 「오늘의 공부」, 「오늘의 단어/회화/평가」 같은 기능 이름, 「오늘 N장」 같은 날짜 표현은 그대로다.

| 탭/진입 | 경로 | 화면 | 가시성 | 하단 탭 | 상태 |
|---|---|---|---|---|---|
| 회화 | `/study/ai?tab=talk\|chat` (기본 `talk`) | AI와 공부하기 홈(회화·채팅 전환 · 회화 목록/채팅 목록 · 채택 대기 교정 요약) | 로그인 사용자 | 보임 | **task-006(§3)** · 회화 탭 **task-007(§9-2 A)** |
| 회화 | `/study/ai/chat/[chatId]` | 채팅방 | 소유자(타인 404) | **숨김** | **task-006(§3)** |
| 회화 | `/study/ai/chat/[chatId]/review` | 표현 점검 결과 | 소유자 | **숨김** | **task-006(§3)** |
| 회화 | `/study/ai/talk/[chatId]` (`#cr_{교정 id}` 로 카드 위치) | 음성 회화방(머리 = 선생님 아바타·이름 + TTS 상태 표시등(§7) · 푸시투토크 72px(§8) + 글자 입력 전환 · 문장별 점진 표시·재생·barge-in · 교정 카드 즉시) | 소유자(타인 404) | **숨김** | **task-007(§9)** · 앱 분기(권한 [앱 설정 열기]·휴대폰→서버 전환 안내·메뉴 "알아듣는 곳" 한 줄) **task-003f(§11-2 D·F)** · 입력 바 「일본어 도우미」(입력 바 우측 끝 44px 원형 버튼 — task-061·처음 한 번 안내·입력 바 위 판, 일반 회화방·역할극 방 공통) **task-056(§22)** — 데모 v1 승인 2026-10-11 |
| 오늘 | `/study/today` | 오늘의 공부 홈(오늘의 단어 카드 → **오늘의 회화 카드**·최근 기록·보관한 세트, AI 평가 "곧 열려요") | 로그인 | 보임 | **task-008(§5)** · 오늘의 회화 카드 **task-010(§12-2 A)** |
| 오늘 | `/study/today/words/[sessionId]` | 단어 카드 덱 · 세트 결과(같은 경로, 세트 상태로 분기) | 소유자(타인 404) | **숨김** | **task-008(§5)** |
| 오늘 | `/study/today/talk/new` · `/study/today/talk/new/paste` | 오늘의 회화 — 주제 고르기(확인 시트) · 문장 붙여넣기 | 로그인 | **숨김** | **task-010(§12-2 B·C)** |
| 오늘 | `/study/today/talk/[lessonId]` | 오늘의 회화 — 레슨 상태로 분기: 만드는 중·실패 / 5단계(이해·문법·문제·응용·말하기) / 종료 카드 | 소유자(타인 404) | **숨김** | **task-010(§12-2 D~L)** |
| 오늘 | `/study/today/eval/new` | AI 평가 시작 — 종류(단어·회화)·주제 고르기, 단어 부족 안내, 진행 중 평가 이어가기 | 로그인 | **숨김** | **task-011**(데모 v1 승인 2026-09-28, 구현 2026-10-01) |
| 오늘 | `/study/today/eval/[evaluationId]` | AI 평가 — 상태로 분기: 만드는 중·실패 / 준비 화면 [시작하기](10분 시계) / 문항 풀이(듣고 답하기 글자로 보기·틀린 곳 탭·조립) / 채점 중·다시 채점 / 결과(점수·루브릭·문항별 정답·레벨 제안) | 소유자(타인 404) | **숨김** | **task-011**(api-contract §2-14 #65~#69·#67c) |
| 오늘 | `/study/today/eval/history` | AI 평가 기록 목록(진행 중 포함·실패 제외) | 로그인 | **숨김** | **task-011** |
| 계획표 | `/plan` (`?month=YYYY-MM&day=YYYY-MM-DD&log=<id>`) | 달력(출석·학습 점·복습 표시)·하루 시트·기록 열기(원본 이동·삭제)·원본에서 돌아오기 | 로그인 | 보임 | **task-012**(데모 v1 승인 2026-10-01, 구현 완료) · 분석·성장은 Phase 3 |
| 단어장 | `/drawer/words` (`?word=<id>` 상세 시트 · `?add=1` 추가 시트) | 단어장 | 로그인(자기 단어만) | 보임 | **task-008(§4)** · 앱바 아래 분절 `[단어 \| 채택한 교정]` **task-055(§21)** |
| 단어장 | `/drawer/corrections` (돌아오기 복원 `?errorType=&chunkType=&q=&focus=&n=`) | 채택 교정 모음(분절·유형/조각 칩·검색·요약 카드·더 보기·원래 대화 이동·단어 시트) | 로그인(자기 교정만) | 보임 | **task-055(§21)** — 데모 v1 승인 2026-10-11 |
| 질문 | `/ask` | 무엇이든 물어보세요 | 로그인 | 보임 | Phase 3 |
| 상단 아바타 | `/settings` | 설정 허브 · 맨 아래 "관리자 › AI Engine Console" 행 | 로그인(관리자 행은 `engine.read` 보유자만 — 서버 컴포넌트) | 보임 | task-005 ✅ · 관리자 행 **task-005b(§6-2 K)** · 목소리 카드 머리 **상태 표시등·미리듣기 재생 task-003d(§7)** · 음성 인식 절 **마이크 테스트 task-003e(§8)** · 음성 인식 절 **휴대폰에서 알아듣기 카드(앱만)·인식 방식 문구·경로 한 줄** + 맨 아래 **앱 버전 줄(앱만)** · 관리자 행 아래 **휴대폰 인식 진단(앱 && `engine.read`)** **task-003f(§11-2 A·B·C·G·I)** |
| 로그인 | `/login`(`?oauth_error=`) · (Custom Tab 안) `/invite` | 로그인(Google) · 앱: Chrome 창 대기 카드·마무리 덮개·창 닫힘 안내 · 초대 뒤 "앱으로 돌아가기" · 강제 업데이트 띠 | 비로그인 | 없음(`(auth)` 레이아웃) | task-002 · 앱 분기·해요체 문구 **task-003f(§11-2 E·G)** |
| 앱 셸 | 모든 `(app)` 화면 맨 위(상태바 아래 그리드 첫 행) | 앱 업데이트 띠(권장 — 집중 화면 제외·닫으면 그날 숨김 / 강제 — 늘) · 설치 방법 시트 | **앱에서만**(웹 DOM 0·#8 요청 0) | — | **task-003f(§11-2 G)** |
| (APK 자산) | `public/app-shell/index.html`(`server.errorPath`) | 서버 연결 실패 화면 | 앱, 서버 불통 때만 | 없음 | **task-003f(§11-2 H)** — developer A, 첫 빌드 전 |
| 콘솔 | `/admin` → `/admin/dashboard` | 대시보드(역할별 엔진·연결·모델·상태, 30초 갱신) | `console.access` 없으면 **앱 공통 404** | **별도 셸**(환경 띠·콘솔 바, 탭 없음) | **task-005b(§6)** |
| 콘솔 | `/admin/speech/{realtime,analysis,tts}` · `/admin/llm` | 역할 페이지(지금 쓰는 연결·Health/기능 테스트·예비 순서·설정값 요약) | `engine.read` | 별도 셸 | **task-005b(§6)** |
| 콘솔 | `/admin/voices` | 목소리 목록(읽기) | `voices.read` | 별도 셸 | **task-005b(§6)** |
| 콘솔 | `/admin/connections` · `/admin/connections/[id]` | 연결 목록·상세(Health/기능 테스트·최근 결과·시크릿 참조 시트) | `engine.read`(시크릿 시트 `secrets.read_ref`) | 별도 셸 | **task-005b(§6)** |
| 콘솔 | `/admin/plugins` · `/admin/plugins/[id]` | 플러그인 로드 상태·스키마 | `plugins.read`(DEVELOPER+, 없으면 콘솔 403) | 별도 셸 | **task-005b(§6)** |
| 콘솔 | `/admin/configuration` | 설정값 Effective(키·값·Source 배지) — task-005b 시점은 Effective 탭만, 지금은 아래 task-012c 행(Form·Raw JSON·Diff 추가)이 현행 | `config.effective.read` | 별도 셸 | **task-005b(§6)** |
| 콘솔 | `/admin/diagnostics` (`?tab=health\|traces`) · `/admin/diagnostics/traces/[traceId]` | Health 기록 · 요청 Trace 목록/상세 | `engine.read` / Trace 는 `trace.read` | 별도 셸 | **task-005b(§6)** |
| 콘솔 | `/admin/speech/tts/lexicon` (`?q=&scope=&ref=&inactive=1&page=`) · `/admin/speech/tts/lexicon/versions` (`?v=` 버전 상세 시트) | 발음 사전(검색·범위 필터·항목 추가/수정/끄기/다시 켜기 시트·적용 전/후 미리듣기·가져오기 dryRun→적용·내보내기) · 버전 기록(상세 diff·되돌리기) — 메뉴 "엔진 › 발음 사전" · TTS 역할 페이지 링크 카드 | `voices.read`(보기·내보내기·버전 보기) / `voices.manage`(쓰기·미리듣기) · PRODUCTION 쓰기 = SUPER_ADMIN + 확인 문구 | 별도 셸 | **task-003g(§10)** |
| 콘솔 | `/admin/configuration` Form·Raw JSON·Diff 탭(`?scope=&target=&tab=`) · `/admin/history`(`?tab=audit` · `?scope=&target=` · `?v=`) · 연결 상세 [설정 편집]·사용 여부·비밀 참조 연결 · 역할 페이지 [순서 편집] | 설정 편집(검증·기능 테스트·변경 요약·적용, 운영 확인 창) · 설정 버전·되돌리기 · 감사 기록 — 메뉴 "도구 › 이력" | `config.edit`(Raw JSON `config.raw.read`) · `engine.connections.manage` · 비밀 참조 `credentials.manage` · 이력 `audit.read`(되돌리기 `config.rollback`) · 운영 적용 = SUPER_ADMIN | 별도 셸 | **task-012c(§13)** |
| 콘솔 | `/admin/{prompts,playground}` 등 | 프롬프트 편집·버전·Playground (`/admin/history` 는 위 task-012c 행으로 구현됨) | — | 메뉴 없음 | 012c-2 이후 |

- **하위 화면(대화방·결과 화면)은 하단 탭을 숨기고 `←` 헤더로 돌아간다.** 키보드가 올라온 뒤 대화가 보이는 높이를 확보하기 위해서다(412×892 에서 키보드 ≈330px → 남는 ≈560px 중 탭 바 66px 는 12%).
- 사용자 화면 전체에서 엔진·모델·호스트 이름(`claude|haiku|sonnet|opus|qwen|reazon|whisper|style-bert|sherpa|zipformer|onnx`)·`traceId`·"AI 엔진" 같은 구현 용어는 0건이다(온디바이스 모델은 "휴대폰 인식 파일", §11).
- **앱/웹 분기는 로그인·실시간 인식 경로·APK 배너 세 곳뿐**이다 — 앱 전용 요소 전체 목록과 분기 대응은 §11 머리 표.

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
| ~~`useKeyboardInset`~~ → `shell/KeyboardInset` | hook→전역 컴포넌트 | task-021 로 대체 | `html[data-kb]` + `--kb-inset` 을 `<html>` 에 기록(방 루트 한정 아님) |
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
6. 키보드: viewport `interactive-widget` + `useKeyboardInset`(task-021 에서 전역 `shell/KeyboardInset` 으로 대체 — `html[data-kb]`·`--kb-inset`) → 360/390/412 + 실기기 Chrome 확인.
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
- [ ] 2차 보정 `useKeyboardInset(roomRef)(task-021 에서 전역 `shell/KeyboardInset` 으로 대체)`: `visualViewport` 의 `innerHeight - vv.height - vv.offsetTop` 이 1px 넘으면 방 루트에 `--kb-inset` 기록 → Composer `margin-bottom`. `resizes-content` 가 먹는 환경에선 0 이라 이중 보정 없음. `document` 전체가 아니라 **방 루트에만** 쓴다(VoiceVault `KeyboardInset` 의 body 여백 방식은 폼 화면용이라 채팅엔 쓰지 않는다).
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
| ⑦ | 전역 변경 4건 | 루트 viewport `interactiveWidget:'resizes-content'`(설정 화면도 영향 — 회귀 확인) · `:lang(ja)` 폰트 규칙 · TabBar 하위 화면 숨김 · `api.ts apiStream` 추가 | 대안: 키보드는 `useKeyboardInset`(task-021 에서 전역 `shell/KeyboardInset` 으로 대체 — `html[data-kb]`·`--kb-inset`) 만, 탭은 유지 |
| ⑧ | **발견 이슈**(이번 task 밖) | `infra/http.ts` 기본 문구 "AI 엔진을 지금 사용할 수 없습니다."가 사용자에게 보일 수 있음 → 채팅은 코드별 문구로 덮지만, 기본 문구 자체를 "지금은 선생님이 답할 수 없어요"류로 바꾸기 권장 · 공용 `Badge` `warn`(2.60)·`accent`(4.08) 톤과 `ink3` 글자(2.91~3.13)가 라이트 모드 4.5:1 미달 · `ComingSoon` 이 사용자에게 "Phase·task" 를 보여 줌 | 별도 task 로 정리 |
| ⑨ | 빈 채팅 정렬 | 메시지 0 채팅(`lastMessageAt=null`)은 목록 **맨 아래**로 간다(MariaDB DESC 의 NULL) → `COALESCE(lastMessageAt, createdAt) desc` 권장 | 방금 만든 빈 채팅이 목록 끝에 숨는다 |
| ⑩ | 줄바꿈 | 서버의 "제어문자 제거"가 `\n`(`\r\n`)을 **남긴다**(여러 줄 입력) | 여러 줄 메시지가 한 줄로 붙는다 |

---

## 4. 단어장 (task-008)

### 4-0. 한눈에 보는 결정

1. 경로는 `/drawer/words` 하나. 상세·수정·추가는 **바텀시트**로 열고 페이지를 옮기지 않는다. 다른 화면에서 들어올 때는 `?word=<id>`(상세)·`?add=1`(추가)를 쓰고, 시트를 연 뒤 `router.replace` 로 쿼리를 지운다. 하단 탭은 보인다.
2. 목록 위 조작 4줄: 검색(디바운스 300ms, IME 조합 중엔 보내지 않음, 40자 이하) · 분류 칩(가로 스크롤) · **조각 줄**(task-023, 분류와 AND) · 정렬 3종과 [보관함] 토글. 총개수와 걸린 조건(분류·조각)은 목록 머리 한 줄에 보인다.
3. 추가는 **표현 한 칸부터** 시작한다. [뜻 채우기]를 누르면 선생님이 채운 초안이 온다(A10 — **저장되지 않음**). 사용자가 확인·수정한 뒤 [저장]한다. [직접 입력하기]는 같은 폼을 빈 채로 연다. 초안 위에는 "저장해야 단어장에 들어가요"를 고정으로 둔다.
4. 카운터(맞힘·틀림·푼 횟수)와 출처는 **읽기 전용**이라 폼에 없다. 교정에서 온 단어는 상세에서 그 채팅의 점검 결과로 이어 준다.
5. 삭제는 시트 안 확인 단계를 거친다("지난 기록과 통계는 그대로 남아요"). 보관은 확인 없이 토글하고 토스트로 알린다("오늘의 단어에 나오지 않아요").
6. 409 중복은 오류로 보이지 않고 **그 단어로 안내**한다. 입력 아래 문구와 [그 단어 보기]를 두고, 누르면 추가 시트를 닫고 상세 시트를 연다.
7. 빈 단어장에는 [{지금 수준} 단어 {n}개 넣기](#46b)(목표 수준이 따로 있으면 보조 버튼 하나 더)와 [직접 추가]를 둔다. 기본 단어 넣기는 추가 시트 맨 아래에서 언제든 할 수 있다(이미 있는 표현은 서버가 건너뜀). 단계 이름·개수·문구는 **§19**(task-051).
8. 오류 문구는 §4-8 표를 쓴다(서버 `message` 는 400 에만). "AI"·엔진 용어 없이 "선생님이 채워 줘요"라고 쓴다. 소리 버튼은 상세 시트에만 둔다(task-023 — 단어 ▶ + 예문 ▶, §4-2 C·§4-11).

### 4-1. 화면 개요

| 항목 | 내용 |
|---|---|
| 목적 | 내가 모은 단어(직접·기본 팩·교정 채택·선생님 제안 채택)를 찾아보고 고치고, 오늘의 단어에 나올 단어를 **보관**으로 조절한다 |
| 진입 | 하단 탭 "단어장" → `/drawer/words`. 오늘 화면 빈 상태 CTA → `?add=1`. 세트 결과의 틀린 단어 → `?word=<id>` |
| 역할별 가시성 | 로그인 사용자 전원, 자기 단어만. 타인 단어 id → #42 404 → "찾을 수 없어요" |
| 앱/웹 분기 | 없음 |
| 하단 탭 | 보임(시트가 열려 있는 동안에도 탭 바는 그대로 — 시트가 위를 덮는다) |
| 음성 | 상세 시트의 표현 오른쪽 ▶(단어)·예문 카드 ▶(예문) — #23 문장 음성, 사용자 목소리 설정 그대로(task-023, §4-11). 목록에는 없음 |

### 4-2. UI 구조 (의사코드, 390px 기준)

#### A. 목록 — `WordsScreen`

```
AppBar title="단어장" right={<AddButton/>}         ← "＋ 추가": h-11 rounded-xl bg-surface2 px-3 text-[14px] font-semibold, aria-label="단어 추가"
<div className="px-4 pb-8">
  DrawerSwitch current="words"                      ← task-055: 분절 [단어 | 채택한 교정] 42px + mb-2.5 (§21-3 A·§21-7 A)
  WordSearchBar                                     ← 44px
  CategoryChips  className="mt-2.5"                  ← #46 실패·0개면 줄을 그리지 않는다
  ChunkChips                                        ← task-023 조각 줄: 라벨 "조각" + [전체|이름|액션|느낌|꾸밈|없음] 하나만 선택(§4-11). 단어장이 완전히 비면 숨김
  <div className="mt-2.5 flex items-center gap-2">
     <div className="min-w-0 flex-1"><Segmented size="sm" ariaLabel="정렬" [최근 추가 | 많이 틀린 | 가나다순] /></div>
     ArchiveToggle "보관함"  aria-pressed             ← flex-none
  </div>
  archived && <p className="mt-2.5 rounded-xl bg-surface2 p-2.5 text-[13px] text-ink2">보관한 단어는 오늘의 단어에 나오지 않아요.</p>
  ListHeader  12px ink2 mt-3 mb-1.5  aria-live="polite"  ← "단어 57개" / "보관한 단어 2개" / "‘映画’ 검색 결과 3개"(검색어 span lang=ja) + 조건 " · {분류} · {조각}"(ink semibold, task-023)
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
│ 조각 [전체][이름][액션][느낌][꾸밈][없음]→│ task-023 조각 줄(칩 숫자 없음)
│ [최근 추가|많이 틀린|가나다순]  [보관함] │
│ 단어 57개                              │ 12px ink2 (+ " · N5 기초 · 느낌 조각")
│ ┌──────────────────────────────────┐ │
│ │ 映画  えいが            [이름 조각] │ │ WordRow ≥64px
│ │ 영화                 맞힘 3 · 틀림 1 │ │
│ ├──────────────────────────────────┤ │
│ │ 食べる  たべる          [액션 조각] │ │
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
     {chunkType && <Badge tone="neutral">{CHUNK_LABEL[chunkType]}</Badge>}   ← task-023: 출처 뱃지 → 조각 뱃지, 조각 없으면 생략
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
| 단어 0(#46 의 `count+archivedCount` 합 0, 검색·칩·보관함 모두 기본) | 단어장이 비어 있어요 / {L} 기본 단어 {n}개로 바로 시작하거나, 아는 단어를 직접 넣어 보세요. 채팅에서 채택한 표현도 여기에 모여요. (§19-4 A) | [{L} 단어 {n}개 넣기](primary full) ([목표 수준 {L} 단어 {n}개 넣기](ghost full) — 목표 수준이 있을 때) [직접 추가](ghost full) |
| 보관 안 한 단어 0, 보관 단어 있음 | 보관하지 않은 단어가 없어요 / 보관함에서 꺼내거나 새 단어를 넣어 보세요. | [보관함 보기] [단어 추가] |
| 검색 결과 0 | ‘{q}’에 맞는 단어가 없어요 | [‘{q}’ 추가하기](ghost) → 추가 시트(표현 = q, q 가 80자 이하일 때만 버튼 표시) |
| 칩 선택 결과 0 | 이 분류에 단어가 없어요 | [전체 보기] |
| 조각 선택 결과 0(task-023) | ‘{분류}’에 {조각} 단어가 없어요 / 분류와 조각을 함께 고르면 둘 다 맞는 단어만 보여요. · (분류 없음) {조각} 단어가 없어요 · (보관함) 보관한 단어 중 {조각} 단어가 없어요 | [조각 전체 보기] [분류 전체 보기](분류를 골랐을 때만) — h-11 14px ghost |
| 검색 + 조각 결과 0(task-023) | ‘{q}’에 맞는 단어가 없어요 / {조각}[ · {분류}] 안에서 찾았어요. | [조각 전체에서 찾기] — [‘q’ 추가하기] 대신(여기서 넣은 단어는 조각이 비어 이 목록에 다시 안 보인다) |
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
   SeedPackLink  "{L} 기본 단어 {n}개 한 번에 넣기 ›" (+목표 수준 줄)  텍스트 버튼 44px 13px accent  → #46b (시트 유지, 결과는 토스트, §19-4 B)
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
  Field 수준   select(선택 안 함·초보자 (N5)…최상급 (N1), 값은 N5~N1 — §19-4 E)
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
    WordSoundButton target=word   ← task-023: 44px 원형 ▶ (§4-11)
  </div>
  WordSoundLine target=word        ← 누른 버튼 바로 아래 한 줄(실패·자막만·한도·막힘)
  <p className="mt-2 break-keep text-[17px] font-medium">{meaning}</p>
  <div className="mt-2 flex flex-wrap gap-1.5">   Badge neutral: 품사 · 수준 이름(levelLabel(jlpt)) · category(수준 이름과 같으면 생략, §19-4 E) · chunkType 라벨 · (archived) "보관함"
  example && Card flat mt-3:
      <p lang=ja className="whitespace-pre-wrap text-[16px] leading-[1.7] [overflow-wrap:anywhere]">{example}</p>
      exampleKo && <p className="mt-1 break-keep text-[14px] text-ink2">{exampleKo}</p>
      (오른쪽) WordSoundButton target=ex — 예문이 #23 한도 100자(공백 접은 코드포인트)를 넘으면 숨김 · 아래 WordSoundLine(중립 안내 바탕 surface)
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
| 40 | `/api/v1/words` | GET | 목록·검색·칩·조각·정렬·보관함·더 보기 | `q`(≤40 코드포인트, 비면 생략) `category` `chunkType=NAME\|ACTION\|FEELING\|MODIFIER\|none`(고른 때만, task-023) `archived=0\|1` `sort=recent\|wrong\|surface` `limit=30` `cursor` | `items[].{id,surface,reading,meaning,chunkType,correctCount,wrongCount,archived,category}` · `nextCursor` · `total`(머리 줄 숫자) | ErrorBlock + 다시 시도 · 400 → 검색창 아래 서버 문구 |
| 23 | `/api/v1/speech/tts` | POST | 상세 시트 소리 듣기(task-023) | `{ text }` — 단어 = 표현, 예문 = 예문(≤100). `speechProfile`·`voiceId` 는 보내지 않는다(사용자 설정) | `audio/wav` 본문 → `playWav` | 422 자막만 · 429 너무 자주 · 504/12초 늦음 · 0 오프라인 · 그 밖 실패(§4-11) |
| 41 | `/api/v1/words` | POST | [뜻 채우기] | `{ surface, enrich: true }` | `draft.{reading,meaning,partOfSpeech,jlpt,example,exampleKo}` · `saved:false` | §4-8 ⓑ(409·400·422·429·502·504·네트워크) |
| 41 | `/api/v1/words` | POST | [저장] | `{ surface, meaning, partOfSpeech, reading?, jlpt?, example?, exampleKo?, note?, category? }` | `word` · `saved:true` | 409 `details.existingId` → [그 단어 보기] · 400 `details.field` 입력 아래 |
| 42 | `/api/v1/words/:id` | GET | 상세 시트 | — | `WordEntry` 전부 + `stats.{attempts,last7d,evalAppearances}` + `corrections[].{id,chatId}` | 404 → 시트 닫기 + 토스트 + 목록 다시 읽기 |
| 43 | `/api/v1/words/:id` | PATCH | 수정 저장 | 바뀐 필드만(비운 선택값 `null`). `correctCount`·`wrongCount`·`source` 는 보내지 않는다 | `WordEntry` | 409 existingId · 400 field · 404 |
| 44 | `/api/v1/words/:id` | DELETE | 삭제 확인 | — | `deleted` · `snapshotKept` | 404 → 이미 없는 것으로 보고 목록에서 제거 |
| 45 | `/api/v1/words/:id/archive` · `/unarchive` | POST | 보관하기·보관 풀기 | — | `archived` · `archivedAt` | 404 · 그 외 토스트 |
| 46 | `/api/v1/words/categories` | GET | 칩·폼 datalist·빈 상태 판정 | — | `[{category,count,archivedCount}]` | 실패 → 칩 줄 숨김(조용히) |
| 46b | `/api/v1/words/seed-pack` | POST | [{L} 단어 {n}개 넣기]·목표 수준 보조 | `{ pack: SeedPack }`(N5~N1, §19-3) | `added` · `skipped` | 토스트(§4-8 ⓓ) |

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
| `ChunkChips` | client | `{ value: WordChunkFilter \| null; onChange(v) }`(task-023) | — |
| `WordSoundButton`·`WordSoundLine` | client | `{ state; target: 'word'\|'ex'; onPress() }` · `{ state; target; onRetry(); inCard? }`(task-023) | — |
| `useWordSound` · `wordSound.ts` | hook · 순수 | `() → { state, tap(target, text), retry(target, text), stop() }` · `soundText`·`soundFailureKind`·`SOUND_MSG`·`soundButtonView`·`soundLine`(task-023) | 소리 하나 |
| `WordsEmpty` | client | `{ variant: 'noWords'\|'allArchived'\|'noSearch'\|'noSearchChunk'\|'noChunk'\|'noCategory'\|'noArchived'; q?; category?; chunk?; archived?; onSeed(); onAdd(preset?); onShowArchive(); onShowAll(); onClearChunk() ; seeding }` | — |
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
| 조각 줄(task-023) | 조각 / 전체 · 이름 · 액션 · 느낌 · 꾸밈 · 없음 (화면 읽기: "전체 (모든 조각)" · "액션 조각" · "없음 (조각이 정해지지 않은 단어)") |
| 목록 머리 조건(task-023) | … · {분류} · {이름\|액션\|느낌\|꾸밈} 조각 / 조각 없음 |
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
| 기본 단어 | {L} 단어 {n}개 넣기 / 목표 수준 {L} 단어 {n}개 넣기 / {L} 기본 단어 {n}개 한 번에 넣기 / 목표 수준 {L} 단어 {n}개 한 번에 넣기 / 넣는 중… ({L}·{n} 은 §19-2) |
| 기본 단어 결과 | {L} 단어 {added}개를 넣었어요 / {L} 단어 {added}개를 넣었어요 · 이미 있는 {skipped}개는 건너뛰었어요 / {L} 단어가 이미 모두 들어 있어요 (숫자 천 단위 쉼표, §19-4 D) |
| 빈 상태 | §4-2 A `WordsEmpty` 표 |

ⓔ **라벨**

| 값 | 라벨 |
|---|---|
| PartOfSpeech `NOUN`/`VERB`/`ADJ_I`/`ADJ_NA`/`ADVERB`/`PARTICLE`/`EXPRESSION`/`OTHER` | 명사 / 동사 / い형용사 / な형용사 / 부사 / 조사 / 표현 / 기타 |
| JlptLevel `N5`~`N1` | 초보자 (N5) · 초급 (N4) · 중급 (N3) · 고급 (N2) · 최상급 (N1) — `SEED_PACK_LABEL`(§19-2) |
| ~~WordSource 뱃지(목록)~~ | task-023 에서 없앰 — 목록 행은 조각 뱃지(`CHUNK_LABEL`, neutral 톤), 조각 없으면 뱃지 없음. 출처는 상세 "출처" 절에만 |
| WordSource 문장(상세) | 직접 넣은 단어예요 / 채팅 교정에서 채택한 표현이에요 / 기본 단어 팩에서 넣었어요(§19-4 E) / 선생님 제안을 채택한 단어예요 / 레슨에서 넣은 단어예요 / 평가에서 넣은 단어예요 |
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

### 4-11. 조각 필터·조각 뱃지·소리 듣기 (task-023, 승인 데모 `docs/demo/task-023-improve-vocab-screen-v1.html`)

사용자 결정: Q1 조각 필터는 분류 칩과 **병행(AND)** · Q2 목록의 출처 뱃지는 **전부 조각 뱃지로** · 데모 결정 a~e 는 designer 권고안(a 뱃지 생략 · b 하나만 · c "없음" 칩 보임 · d 단어+예문 · e 출처 절 남김).

**조각 줄 `ChunkChips`** — 분류 칩 바로 아래 한 줄(분류 줄이 없으면 `mt-1.5`). 왼쪽 고정 라벨 "조각"(`w-[30px] 12px semibold ink2`, `id` → `radiogroup aria-labelledby`) + 가로 스크롤 칩(`-mr-4`·`pr-4`, 오른쪽 끝까지 밀림). 칩은 `CategoryChips` 와 같은 36px 알약·세로 히트 44px·같은 선택색, **숫자 없음**. 하나만 고른다(`role=radio`). 목록과 함께 스크롤된다(스크롤 1곳). 단어장이 완전히 비었으면(#46 합 0) 줄을 그리지 않는다(고른 조각이 있으면 남김).
- 조회: 고르면 `chunkType=<값>`(없음 = `none`), 바뀌면 커서를 지우고 첫 쪽. 보관함을 켜고 끄면 분류는 전체로, **조각은 유지**.
- 목록 머리: 기존 문구 + 조건 `" · " + <span class="font-semibold text-ink">{분류} · {조각 이름}</span>` — 숫자는 #40 `total` 그대로.

**행 뱃지** — `WordRow` 오른쪽 위 뱃지는 `CHUNK_LABEL[chunkType]`(neutral). 조각이 없으면(직접 넣은 단어·기본 단어 2개) 그리지 않는다. 초록·빨강은 맞힘·틀림 뜻이라 조각 구분에 쓰지 않는다.

**소리 듣기 `WordSoundButton`·`useWordSound`** — 표현 오른쪽(E9 자리)과 예문 카드 오른쪽의 44px 원형 버튼.
- 모양: 대기 ▶(테두리 line·surface) → 불러오는 중(돌기, `aria-busy`, 이름 "{단어|예문} 소리를 불러오는 중, 누르면 취소") → 재생 중 ■(채움 ink + 바깥 고리 accent-soft, 이름 "{…} 소리 멈추기"). 다시 누르면 취소·멈춤. 자막만 안내 중이면 흐린 모양(surface2·ink2), 소리 막힘이면 accent 고리.
- 소리는 한 번에 하나(다른 버튼을 누르면 앞 소리를 멈춤). [수정]·[삭제]로 넘어가거나 시트를 닫으면(언마운트)·화면이 가려지면 멈춘다.
- 요청: #23 `{ text }`(단어 = 표현, 예문 = 예문의 공백을 한 칸으로 접은 글). 발음 사전은 서버가 적용하고 빠르기·목소리는 사용자 설정(`speechProfile`·`voiceId` 생략). 예문이 100자(코드포인트)를 넘으면 예문 버튼을 숨긴다. 탭 핸들러에서 동기로 `unlockTtsAudio()` 후 `apiPostAudio` → `playWav`. 12초 안에 못 받으면 끊는다.
- 안내 한 줄(누른 버튼 바로 아래, `min-h-[44px] rounded-xl px-3 py-1 13px`, 예문 카드 안 중립 바탕은 surface):

| 상황 | 문구 | 톤·역할 | 링크 |
|---|---|---|---|
| 그 밖 실패(400·500·502·재생 실패) | 목소리를 불러오지 못했어요. | bad-soft·bad · alert | [다시 듣기] |
| 504 · 12초 초과 | 목소리 응답이 늦어요. 잠시 후 다시 눌러 주세요. | bad · alert | [다시 듣기] |
| 네트워크(0) | 연결하지 못했어요. 네트워크를 확인해 주세요. | bad · alert | [다시 듣기] |
| 422(자막만) | 지금은 선생님 목소리를 들을 수 없어요(자막만). 목소리가 돌아오면 다시 들을 수 있어요. | 중립 · status | [다시 확인] |
| 429 | 너무 자주 눌렀어요. 잠시 후 다시 들어 주세요. | 중립 · status | — |
| 브라우저가 막음(NotAllowedError) | 소리를 켜려면 ▶ 를 한 번 더 눌러 주세요. | 중립 · status | — (같은 ▶ 를 누르면 받은 소리를 바로 튼다) |
| [다시 듣기]·[다시 확인] 뒤 불러오는 중 | 다시 불러오는 중… | 중립 · status | — |
| 재생 중 | (화면 읽기 전용) {단어·예문} 소리 재생 중 | sr-only status | — |

문구에 엔진·서버 이름은 없다("선생님 목소리"로만). 오디오는 저장·로그하지 않는다.

**상세 출처 절** — 그대로 남긴다(결정 e). 교정 단어의 [점검 결과 보기 ›] 길 유지.

---

## 5. 오늘의 단어 (task-008)

> **task-059(IMP-0011, 2026-10-11) 로 일부 대체됨 → §23.** 푸는 방식 선택 제거 · 카드 탭 → 객관식 · 뜻 보기 면 단어·예문 듣기 · 답한 방식대로 기록(D0~D8). 대체·보완된 줄 끝에 `[task-059 → §23-x]` 표시가 있고 전체 목록은 §23-1 B 표다. 충돌하면 §23 이 우선한다.

### 5-0. 한눈에 보는 결정

1. 경로 2개: 오늘 홈 `/study/today` → 덱·결과 `/study/today/words/[sessionId]`. 결과는 **같은 경로**에서 세트 상태(`DONE`)로 갈라 그린다(§11 의 `(+result)` 를 경로로 나누지 않는다 — 새로고침·재방문·보관 세트 열기가 한 곳에서 끝난다). 덱·결과 화면은 하단 탭을 숨기고 `BackBar` 를 쓴다.
2. 오늘 홈의 "오늘의 단어" 카드는 상태 5가지다. **준비**(장수·방식·분류 → [시작하기]) / **풀던 세트 있음**(E3: [이어서 풀기]·[여기서 끝내기]) / **빈 단어장**([{L} 단어 {n}개 넣기]·(목표 수준 보조)·[단어 직접 추가], §19) / **오늘 풀 단어 없음** / 오류. 레슨·평가는 "곧 열려요" 카드이고 Phase·task 번호는 보이지 않는다. **[task-059 → §23-2]**
3. **정답은 서버만 안다.** 덱은 답을 보낸 뒤 #50 응답(`answer`·`correctText`·예문)으로만 정답·오답을 그린다. 미리 표시하거나 낙관적으로 채점하지 않는다. 보기 버튼은 누르는 순간 "확인 중"이 되고, 응답(보통 0.1~0.3초)이 오면 뒤집힌다. **[task-059 → §23-4]**
4. 덱 구조: 제스처 영역(가운데 80%, 3장 스택)은 **카드 면만** 담는다. 보기 4버튼·알았어요/몰랐어요·도구 줄은 **제스처 영역 밖**에 둔다. `touchend preventDefault` 가 그 영역 안의 버튼 click 을 죽이고, 뒤집힌 직후 새로 생긴 버튼에 떨어지는 유령 클릭도 막기 때문이다.
5. 제스처(bjj 이식): 탭 10px 미만 / 위로 −80px = **다시 볼 카드 표시 토글**(카드는 넘어가지 않는다) **[⚠ task-060 → §24-1: 위로 = 뜻 보기, 오른쪽 = 건너뛰기 확인으로 대체]** / 왼쪽 60px = 다음(**답한 뒤에만**, 안 답했으면 튕겨 돌아오고 안내) / 오른쪽 60px = 이전 카드(읽기 전용). 모든 제스처는 버튼·키보드로도 할 수 있다(1~4·Space·Enter·←/→·F).
6. 조작 수(12초/장): CHOICE 는 보기 1탭 + [다음 카드] 1탭(또는 왼쪽 밀기). FLIP 은 카드 탭(뒤집기) + [알았어요/몰랐어요] 1탭이고, 응답이 오면 **다음 카드로 자동으로 넘어간다**(뒷면을 이미 봤기 때문). 10장이면 조작 약 20번. **[task-059 → §23-3]**
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
| 음성 | 소리 버튼 없음(E9). 자리는 덱 도구 줄의 [읽기]와 [표시] 사이, 결과 화면 단어 행 오른쪽(렌더하지 않음) **[task-059 → §23-5]** |
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
| `loading` | 머리줄 + "불러오는 중…"(ink2, `role=status`) — **※ task-046 이후: 글자 대신 같은 높이 몸통 자리표시(`CardLoadingBody`)를 그린다. §17 참고** |
| `ready` | 설명 2줄 · (오늘 끝낸 세트 ≥1) "오늘 {n}세트를 끝냈어요 · 맞힘 {Σc}/{Σ장}" · 라벨 "장수"(12.5px ink2) + `Segmented sm` `[5,10,15,20,30] ∪ {dailyWordCount}` 오름차순, 기본 `dailyWordCount` · 라벨 "방식" + `Segmented sm` `[4지선다 CHOICE \| 뒤집기 카드 FLIP]` · 라벨 "분류" + `CategoryChips basis=active`(분류가 1개 이하면 줄 생략) · [시작하기] primary full(요청 중 "만드는 중…" + `aria-busy`) · 400 이면 버튼 아래 12px bad 서버 문구 **[task-059 → §23-2]** |
| `inProgress` | "풀던 세트가 있어요"(15px semibold) · "{오늘\|M월 D일} 시작 · {mode 라벨} · {cardCount}장 중 {answered}장 답함"(13px ink2) · "답한 카드는 저장돼 있어요."(12px ink2) · (시작일 ≠ 오늘) "지난 날 시작한 세트예요. 끝내면 그날 기록으로 남아요."(12px ink2) · 버튼: `answered < cardCount` → BtnRow [이어서 풀기](primary) [여기서 끝내기](ghost) / `answered === cardCount` → [결과 보기](primary full, #51) **[task-059 → §23-9]** |
| `empty` (단어 0) | "단어장이 비어 있어요" · "오늘의 단어는 내 단어장에서 골라요. {L} 기본 단어로 바로 시작해 볼까요?" · [{L} 단어 {n}개 넣기](primary full, `useSeedPack`) · (목표 수준이 있을 때) [목표 수준 {L} 단어 {n}개 넣기](ghost full) · [단어 직접 추가](ghost full → `/drawer/words?add=1`) · (보관 단어 > 0) "보관한 단어 {n}개는 오늘의 단어에 나오지 않아요 · 단어장에서 보기 ›"(Link 44px) |
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
- 방식·분류의 마지막 선택은 `localStorage kaiwa.vocab.mode`·`kaiwa.vocab.category` 에 저장한다(분류가 사라졌으면 전체). 장수는 저장하지 않고 늘 `dailyWordCount` 에서 시작한다(설정이 기준). **[task-059 → §23-2]**

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
- [다시 풀기] → #53 → `kaiwa.vocab.notice.{newId}` 에 `{ downgraded: session.downgraded ? 'deleted' : null }` → push 새 덱. 409 → 토스트 "풀던 세트를 먼저 끝내 주세요" + #49 로 `inProgress` 전환 + 카드로 스크롤. **[task-059 → §23-4]**

**TodayComingSoon**
```
SectionHeader "곧 열려요"
Card flat ×2 (각 행: 제목 15px semibold + 설명 13px ink2 break-keep + Badge neutral "곧 열려요")
  오늘의 회화 — 주제와 상황을 골라 선생님과 1:1 수업을 해요.   ← task-010 에서 제거(§12-2 A — 실제 카드로 바뀜), AI 평가 1개만 남는다
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
| sessionStorage notice `downgraded:'few'` | 뜻이 서로 다른 단어가 4개보다 적어서 이번엔 뒤집기 카드로 풀어요. **[task-059 → §23-8]** |
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

**DeckControls — FLIP `FlipControls`**: 앞면 [뜻 보기](primary full 52px) · 뒷면 미답 BtnRow [알았어요][몰랐어요](각 52px, `h-[52px]` 로 덮어씀) · 응답 대기 중엔 두 버튼 `aria-disabled` + 누른 버튼 "기록 중…". 답한 카드(이전 카드 보기)에서는 버튼 대신 한 줄 "{알았어요|몰랐어요|건너뛴 카드}로 기록했어요"(13px ink2). **[task-059 → §23-3]**

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
- 소리 버튼 자리는 [가 읽기]와 [☆ 표시] 사이다(E9 — 지금은 그리지 않고 `grid-cols-4` 유지). **[task-059 → §23-5]**

**GestureHint**(12px ink2, 한 줄, `aria-hidden` — 스크린리더에는 버튼이 같은 기능을 한다)
- 터치(`matchMedia('(pointer: coarse)')`): `← 밀어 다음 · → 밀어 이전 · ↑ 밀어 표시`(화살표 = 손가락 방향).
- 정밀 포인터: `1~4 고르기 · → 다음 · ← 이전 · F 표시`(FLIP 은 `Space 뒤집기 · 1 알았어요 · 2 몰랐어요 · → 다음`). **[task-059 → §23-6]**
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
| 탭 → 상세 열기 | 탭 → FLIP 앞면이면 뒤집기, CHOICE 앞면이면 읽기 토글, 뒷면이면 아무것도 안 함 **[task-059 → §23-3]** |
| 위 −80 → 카드를 위로 날리고(`translateY(-120%)`) 다음 카드 | 위 −80 → **표시(flagged) 토글만**. 카드는 넘어가지 않고 16px 위로 튀었다 돌아온다(160ms). ★ 가 켜지거나 꺼진다 |
| 왼쪽 → 다음(`min(i+1, n−1)`) | 왼쪽 → `canNext` 일 때만 다음. 카드가 왼쪽으로 날아가고(`translateX(-120%) rotate(-8deg)`, opacity 0, 180ms) `view+1`. 안 되면 튕겨 돌아오고 GestureHint 안내 |
| 오른쪽 → 이전 | 오른쪽 → `view > 0` 이면 이전(읽기 전용). 새 카드는 opacity 120ms 로 나타난다 **[⚠ task-060 → §24-1: 오른쪽 = 건너뛰기 확인, 이전은 [이전]·← 만]** |
| 제한 없음 | **저항**: 움직일 수 없는 방향(안 답한 카드의 왼쪽, 첫 카드의 오른쪽)으로 끌면 `x × 0.25` 만 따라온다 |
| 없음 | `touchcancel` → 아무 동작 없이 원위치. 손가락 2개(`touches.length > 1`) → 드래그 취소 |
| 카드마다 드래그 중 setState 로 전체 재렌더 | setState 는 그대로 두되 `VocabCardFace` 를 `memo` 로 감싸 드래그 중에는 transform 만 바뀌게 한다 |
| 진행 표시 `index+1 / n` | DeckProgress(§B) |
| 힌트 `← 이전 · 다음 →` | GestureHint(§B, 방향 바로잡음) |

- React 의 `onTouchStart`·`onTouchMove` 는 passive 로 붙는다 — 거기서는 `preventDefault` 를 하지 않는다(스크롤은 `touch-action:none` 이 막는다). `onTouchEnd` 는 passive 가 아니라 `preventDefault` 가 먹는다.
- `prefers-reduced-motion: reduce` → 회전·날아가기·튀기 없음, opacity 120ms 전환만.
- 스택 영역: `role="group" aria-roledescription="카드" aria-label="{view+1}번째 카드, 모두 {n}장"`. 카드가 바뀌면 sr-only live 영역(`aria-live=polite`)에 "{n}번째 카드, {surface}"(surface 는 `lang=ja` span), 답 응답이 오면 "맞았어요. 정답 {correctText}" / "틀렸어요. 정답 {correctText}" 를 알린다.

키보드(document `keydown`, `VocabDeck` 마운트 동안) **[task-059 → §23-6]**
| 키 | CHOICE | FLIP |
|---|---|---|
| `1`~`4` | 지금 카드·안 답함 → 그 보기 선택 | `1` 알았어요 · `2` 몰랐어요(뒷면일 때) |
| `Space`·`Enter` | 답한 카드 → 다음(마지막이면 결과 보기) | 앞면 → 뒤집기 / 답한 카드 → 다음 |
| `→` | 다음(`canNext` 일 때) | 같음 |
| `←` | 이전 | 같음 |
| `F`·`↑` | 표시 토글 | 같음 **[⚠ task-060 → §24-4: ↑ 는 동작 없음, 표시는 F 만. H = 한글·S = 건너뛰기 확인 추가]** |
| `R` | 읽기 토글 | 같음 |
| `S` | 건너뛰기(안 답함) | 같음 |

무시 조건: 대상이 `input/textarea/select/[contenteditable]` · 시트가 열림 · `e.isComposing` · `ctrl/meta/alt` · `e.repeat` · 초점이 `button`/`a` 인데 `Space`/`Enter`(버튼 자신의 클릭과 이중 실행 방지).
초점: 답 응답 후 [다음 카드]로, 새 카드가 되면 첫 보기(CHOICE) 또는 [뜻 보기](FLIP)로 `focus({ preventScroll: true })`. 포커스 링은 `focus-visible` 에서만 보이므로 터치 사용자에게는 보이지 않는다.

#### D. 한 장의 흐름 (두 모드) **[task-059 → §23-3]**

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

#### E. 결과 화면 — `VocabResult` (세트가 `DONE`) **[task-059 → §23-9]**

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
| 46b | `/api/v1/words/seed-pack` | POST | 빈 상태 [{L} 단어 {n}개 넣기]·목표 수준 보조 | `{pack: SeedPack}`(§19-3) | `added,skipped` | 토스트 `actionErrorText`(§19-4 D) |
| 47 | `/api/v1/vocab/sessions` | POST | [시작하기]·[전체로 풀기] | `{count, mode, category}`(`category` 는 `null` = 전체) | `session.{id,downgraded,cardCount,requestedCount}` / `empty.reason` | 409 `details.sessionId` → inProgress · 400 서버 문구 · 그 외 §5-8 ⓐ **[task-059 → §23-4]** |
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
| `TodayReviewCard`(`lesson/review/`, task-010b) | client | §14-5 | 표시 전용 — 상태는 `TodayHome` 의 `useReviewSkip`·`useDecisionWatch`(§14-3 A), 자리는 `reviewPlacement`(위·아래·곧 열려요) |
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
| `SwipeCardStack` | client | `{ count; view; renderTop(): ReactNode; canNext; canPrev; locked; onTap(); onUp(); onLeft(); onRight(); onBlocked(dir) }` **[⚠ task-060: `canPrev`→`canSkip`, `onUp(): boolean`(뜻이 열릴 때만 true) — §24-1]** | `drag`, `animating`, refs(§5-2 C) |
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
| 방식 | 4지선다 / 뒤집기 카드 (aria: 푸는 방식) **[task-059 → §23-8]** |
| 시작 | 시작하기 / 만드는 중… |
| 풀던 세트 | 풀던 세트가 있어요 / {오늘\|M월 D일} 시작 · {방식} · {N}장 중 {k}장 답함 / 답한 카드는 저장돼 있어요. / 지난 날 시작한 세트예요. 끝내면 그날 기록으로 남아요. / 이어서 풀기 / 여기서 끝내기 / 결과 보기 |
| 409(시작) | 풀던 세트가 있어요. 이어서 풀거나 끝내 주세요. |
| 빈 단어장 | 단어장이 비어 있어요 / 오늘의 단어는 내 단어장에서 골라요. {L} 기본 단어로 바로 시작해 볼까요? / {L} 단어 {n}개 넣기 / 목표 수준 {L} 단어 {n}개 넣기 / 넣는 중… / 단어 직접 추가 / 보관한 단어 {n}개는 오늘의 단어에 나오지 않아요 · 단어장에서 보기 |
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
| VocabMode `CHOICE` / `FLIP` | 4지선다 / 뒤집기 카드 **[task-059 → §23-8]** |
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
- [ ] 탭(10px 미만) = FLIP 뒤집기 / CHOICE 읽기 토글, 위로 80px 넘게 = 표시 토글(카드는 그대로), 왼쪽 60px 넘게 = 답한 뒤에만 다음, 오른쪽 = 이전. **[task-059 → §23-11]** **[⚠ task-060 → §24-1: 위 = 뜻 보기, 오른쪽 = 건너뛰기 확인]**
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
- **저장소 차단**: `kaiwa.vocab.*` 키는 전부 try/catch. 실패하면 기본값(CHOICE·전체·읽기 켬·notice 없음)으로 동작한다. **[task-059 → §23-2]**
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
      <main className="relative min-h-0 min-w-0 overflow-y-auto bg-ground">   ← `relative`: 조상에 위치 지정이 없어 sr-only 가 문서 스크롤을 늘림(task-047, §18)
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
| 앱/웹 분기 | 웹 = 항상 서버 경로(`kind:'GATEWAY'`). 앱(003f) = 라우터가 **누를 때마다** 휴대폰/서버를 고른다(`kind`·`route`, §11-3 C). 화면 차이는 넷뿐: 경로 한 줄에 이유까지(§11-2 C·§11-8 ⓔ) · 권한 흐름(한 번 거절 안내·영구 거절 [앱 설정 열기], §11-2 F) · 사전 점검 OFFLINE 은 서버 경로만(휴대폰 경로는 인터넷 없이 알아듣는다) · 오프라인 방식 + 파일 없음 = MODEL_REQUIRED. 휴대폰 경로도 점검 발화를 올리지 않는다. 카드 바로 위에 "휴대폰에서 알아듣기" 카드(§11-2 A) |
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
p   "지금은 서버에서 알아들어요."                            12px ink2 ← pathCaption(kind) — 앱(003f)은 pathCaption(route), 이유까지(§11-8 ⓔ)
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
| `!navigator.onLine` (`kind==='GATEWAY'` 일 때만 — 휴대폰 경로는 인터넷 없이 알아듣는다, 003f) | `unavailable(OFFLINE)` |
| #19 `gateway.enabled === false` 이고 `kind==='GATEWAY'` | `unavailable(SERVER_UNAVAILABLE)` |
| `permissions.query({name:'microphone'})` = `denied` | error `MIC_DENIED` 표시, **버튼은 누를 수 있음**. `onchange` 로 `granted` 가 되면 error 지움 |
| (앱, 003f) 플러그인 `checkPermissions()` = `prompt-with-rationale` / `denied` | `'rationale'` → 상태 줄 안내(누르기 전) / `denied` → MIC_DENIED + [앱 설정 열기]. 앱으로 돌아오면(resume) 다시 읽는다 — §11-2 F·§11-3 D |

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
| MIC_DENIED | `NotAllowedError`·`SecurityError`·권한 `denied` | 마이크 사용이 막혀 있어요. | 웹: 주소창 왼쪽 아이콘(사이트 정보) → 권한 → 마이크 → 허용으로 바꾼 뒤 다시 눌러 주세요. / 앱(003f): **[앱 설정 열기] 버튼** + "앱 설정 → 권한 → 마이크 → ‘앱 사용 중에만 허용’을 골라 주세요."(버튼이 없으면 "휴대폰 설정 → 애플리케이션 → {APP_LABEL} → 권한 → …" — §11-8 ⓖ, 앱 이름 §11-11 ⑤) | 누를 수 있음 |
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
| MODEL_REQUIRED (앱, 003f) | 오프라인 방식인데 휴대폰 인식 파일 없음·손상 | 휴대폰 인식 파일이 없어요. | 위에서 파일을 받거나 다른 방식을 골라 주세요. (회화방 문구는 §11-8 ⓕ) | 막힘 |
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
| 경로 안내 | 웹 = 지금은 서버에서 알아들어요. · 앱(003f) = `pathCaption(route)` 이유까지 9종(§11-8 ⓔ — 예: 지금은 휴대폰에서 알아들어요. / 지금은 서버에서 알아들어요. 휴대폰 인식 파일을 받으면 …) |
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
| 앱/웹 분기 | task-007 = **웹 경로만**(`kind:'GATEWAY'`). 앱(003f)은 라우터가 누를 때마다 휴대폰/서버를 고르고, 화면 차이는 권한 흐름([앱 설정 열기], §11-2 F) · 전환 안내(오류 2회째 띠 2줄 `switched`·말을 잃지 않은 전환은 토스트 1회, §11-2 D) · MODEL_REQUIRED 띠(오프라인 방식) · ⋯ 메뉴 "알아듣는 곳" 한 줄. **상시 경로 표시는 두지 않는다**(머리 표시등은 목소리 상태 하나 — §11-0 ⑥). 자동재생 규칙은 WebView(`mediaPlaybackRequiresUserGesture`)도 같은 코드로 견딘다(실기기 확인 003f F6) |
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

**일본어 도우미 자리**(task-056, 승인 데모 `docs/demo/task-056-talk-phrase-helper-v1.html` — 상세·상태·문구는 **§22**):
- **말 모드**: `VoiceBar` 에 선택 prop `trailing` 하나. 가운데 칸을 `grid grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)]` 로 나눠 PTT 는 둘째 칸(**위치 불변**), ■(선생님 말 정지)는 셋째 칸 `ml-3 justify-self-start`, 도우미 버튼(44px 원형 아이콘)은 **우측 끝 44 칸** `justify-self-end`(task-061, IMP-0034 — 사용자 요청으로 ■ 와 자리를 맞바꿈) — 마이크↔■ 12px, ■↔도우미 28/43/54px(360/390/412). ⌨·■ 칸은 그대로. `trailing` 을 넘기지 않으면 지금 화면과 같다.
- **글자 모드**: `leading` = 🎤 + 도우미 버튼(같은 44px 원형). 입력창 폭 180/210/232px.
- **처음 한 번 안내 말풍선**(§22-4)은 말 모드 입력 바 바로 위에 뜬다 — 띠·토스트·판·녹음 중에는 숨는다.
- **판은 입력 바 바로 위 한 자리**: 띠(G) 아래·입력 바 위. 역할극 방에서는 「대답 연습」(task-010d 가이드 §3-E `PracticeDock`)과 **한 번에 하나** — 도우미가 열려 있는 동안 대답 연습 줄·판을 그리지 않고, 목표 카드·대답 연습이 새로 펼쳐지면 도우미를 닫는다. 띠가 새로 뜨면 도우미 판도 닫는다(결과는 기억). 판 안에 마이크·보내기 없음(D-8 과 같음).
- 마친 역할극(`RolePlayEndedBar`)에는 버튼·안내·판 모두 없다. 녹음·인식 중 버튼은 `aria-disabled`(판은 열려 있으면 그대로 — §22-0 ⑤).

#### G. 입력 바 위 띠(StripSlot, 한 번에 하나 — 위 칸이 이긴다)

| 우선 | 띠 | 언제 | 모양 · 동작 |
|---|---|---|---|
| 1 | `SttAlert` | STT 오류(§8-8 ⓐ 코드) | `role="alert"` `rounded-xl bg-bad-soft px-3.5 py-3 text-[13px] text-bad break-keep` — 1줄 무엇 + 2줄 어떻게(`sttErrorCopy(code,{native})`). 막힘 계열(INSECURE·UNSUPPORTED·OFFLINE·SERVER_UNAVAILABLE)과 MIC_DENIED·CONNECT_FAILED 엔 [글자로 대화하기](44px 밑줄 텍스트 버튼). 막힘 아닌 것엔 ✕(44). **앱(003f)**: MIC_DENIED 에 [앱 설정 열기] · MODEL_REQUIRED(막힘)에 [설정 열기]+[글자로 대화하기] · 휴대폰 오류 2회째(전환 순간)·오프라인 방식은 ENGINE_ERROR 2줄 교체(§11-8 ⓕ) |
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
  (앱만, 003f) 알아듣는 곳  휴대폰에서 | 서버에서 + 이유 한 줄 + [음성 인식 설정 ›]   ← §11-2 D `SttRouteRow`(읽기 전용, extra 안)
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
| 180 | `/api/v1/chats/:id/phrase-help` | POST | 일본어 도우미 [물어보기]·예시 칩·[다시 시도](task-056) | §22-9 | §22-9 | §22-9 — **계약 정본은 Leader 가 `api-contract.md` 에 반영**(이 표는 참조만) |

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
- [ ] (task-056) 도우미 버튼 44px 원형이 입력 바 우측 끝(task-061)에 들어가도 PTT 위치·입력 바 높이 불변, 세 폭 넘침 0 — 나머지 도우미 확인 항목은 §22-14.
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

### 9-12. 교정 방식 — 유창성·코치 (task-010c · 승인 데모 `docs/demo/task-010c-correction-mode-v1.html`, 결정 a=A·b=B·c=B)

데모 문구·치수·상태를 그대로 옮겼다(문구 정본 `talkCopy.ts` `CORRECTION_MODE_COPY`·`LATER_COPY`·`COACH_COPY`). 서버 계약은 api-contract #11·#12(`correctionMode`)·#29(`laterPending`·교정 `deliver/hintKo/selfCheck`)·#32(`coachRevealed`·`done.selfCheck`)·#34(`deliver=LATER`).

| 자리 | 구현(컴포넌트) | 데모 상태 |
|---|---|---|
| 설정 · 기본정보·학습 | `LearningSettings` 의 `CorrectionModeField` — '교정 강도' 바로 아래. 라벨 + 도움말("교정 강도는 **무엇을** … **언제** …") + 두 줄 선택 카드(네이티브 radio, 카드 전체 ≥56px, 고른 쪽 = 테두리 accent + 채운 동그라미, 유창성에 '기본' 배지) + "말로 하는 회화에만 …" 한 줄. 저장은 기존 [학습 설정 저장] 하나(저장 중 선택 잠금, 실패 토스트 뒤 선택 유지) | `set`·`set-coach`·`set-saving`·`set-saved`·`set-fail` |
| 회화방 머리 칩(a=A) | `TalkRoomHeader` `LaterChip` — ⋯ 바로 왼쪽, h-8(before 로 히트 44), accent-soft 알약 + accent 숫자 원. 처리하지 않은 모아 둔 교정 ≥1 일 때만. 폭 <375 는 "교정 N". 숫자가 늘면 0.45s 확대(WAAPI, 움직임 줄이기면 없음). aria-label "모아 둔 교정 N개 보기", aria-haspopup=dialog | `fl-flow` |
| 유창성 대화 중 | `deliver=LATER` 교정은 대화 속에 그리지 않는다(말풍선 표시도 없음). 칩 +1, 스크린리더 전용 한 줄 "작은 실수 1개를 모아 뒀어요. 모아 둔 교정 N개"(녹음 중이면 끝난 뒤). MAJOR(NOW)는 지금 카드 그대로 | `fl-compare`·`fl-flow` |
| 모아 둔 교정 시트 | `LaterCorrectionsSheet`(공용 `Sheet`) — 열 때마다 #34 `deliver=LATER` 로 불러온다. 불러오는 중(스켈레톤 2)·오류(띠 + [다시 시도])·빈(안내 + [닫기])·목록(안내 + "아직 안 본 교정 N개" + 기존 `CorrectionCard`, 오래된 것 위)·모두 처리(완료 상자 + [대화로 돌아가기]). [채택]은 기존 채택 시트를 위에 열고(그동안 이 시트는 Esc·배경으로 닫히지 않음) 끝나면 목록으로. [채택]·[거절]이 `409`(이미 처리된 교정 — 다른 탭·재시도)이면 토스트 '이미 처리된 교정이에요' 후 대화 목록과 이 시트 목록을 다시 불러온다(그 외 오류는 일반 오류 토스트). 처리할 때마다 초점은 안내 문구(남으면)나 [대화로 돌아가기]로, 닫을 때 칩이 사라졌으면 ⋯ 로 | `fl-sheet`·`fl-accept`·`fl-partial`·`fl-done`·`fl-empty`·`fl-loading`·`fl-error` |
| 홈에서 들어옴 | `#cr_<id>` 가 모아 둔 교정이면 시트를 그 카드로 스크롤 + 테두리 강조(화면에 없는 오래된 교정이면 #34 로 확인 뒤). NOW 교정은 지금처럼 대화 속 카드 | `fl-deeplink` |
| 코치 힌트 카드 | `TalkCorrectionCard`(`correctionView.coachCardView`) — 힌트가 있으면 공개 전: 유형 배지 · '힌트' 배지 · 내 문장(원문 그대로) · 힌트 상자(accent-soft) · 마이크 줄 "힌트를 보고 다시 말해 보세요 …" · [정답 보기](ghost h-11, aria-expanded=false). 교정문·틀린 곳·설명·채택 숨김. 상태 줄도 "힌트를 보고 다시 말해 보세요". [정답 보기] → 기존 카드 + "정답을 보고 다시 말해 보세요." 줄, 초점 "이렇게 고쳐요"(상태 줄 "정답을 보고 …") | `co-compare`·`co-hint`·`co-revealed` |
| 코치 판정 | 다음 말을 보낼 때 그 카드를 열었는지 `coachRevealed` 로 보낸다. `done.selfCheck` SELF → '스스로 고쳤어요 ✓' 배지 + "✓ 다음 말에서 스스로 고쳤어요" / REPEAT → '고쳐 말했어요 ✓' + "✓ 정답을 보고 고쳐 말했어요" / MISSED → 자동 공개(b=B) + "다음 말에서 고치지 못해 정답을 열었어요. …"(이미 열었으면 줄 없음). 판정은 #29 에 남아 새로고침 뒤에도 같다. [정답 보기] 여부는 화면 상태라 다시 들어오면 힌트부터. 힌트 없는 교정은 기존 카드 | `co-self`·`co-auto`·`co-nohint` |
| 회화 메뉴(c=B) | `CorrectionModeMenu` — '들려주는 방식' 아래, **기존 '들려주는 방식'과 같은 세로 radio 줄(52px)** + 고른 방식 설명 한 줄. 고르면 #12 에 `correctionMode` 만 PUT, 토스트 "다음 말부터 {유창성\|코치} 방식으로 교정해요", 실패면 되돌림 | `menu` |

- **데모와 다른 점**: 회화 메뉴의 교정 방식은 데모의 분절 버튼 대신 지금 구현의 '들려주는 방식'과 같은 세로 radio 줄로 그렸다(한 메뉴 안 두 항목 모양 통일 — 동작·문구·값은 데모 그대로).
- 검증(2026-10-01 developer, dev 서버·QA 계정): 회화방·시트·메뉴·설정 360/390/412 × 780/892 가로 넘침 0 · 시트 버튼 44px↑ · 선택 카드 88px · 엔진명 DOM 0 · 콘솔 오류 0.

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

---

## 11. 안드로이드 앱 전용 화면 (task-003f)

> 정본: `design-spec.md` §9(온디바이스 플러그인·클라이언트 라우팅)·§12(앱·APK 갱신) · `plugins/sherpa-stt/README.md` §4(API·이벤트)·§5(모델 저장·검증)·§7(폴백)·§8(APK) · `speech/models/README.md` §4(Wi-Fi 안내·재개) · `api-contract.md` #2~#5(앱 로그인)·#8(`/api/app/version`)·#9·#10(`/models/*`)·#15/#16·#19(`onDevice`)·#21(발화 업로드)·§0-10(헤더) · `module-dependency.md` §6(플러그인 경계) · `speech-platform/12` §3.5(휴대폰 → 서버 전환) · 워크스페이스 `docs/app-conversion-guide.md` §1-6·§4. 재사용: §7(토스트 규칙)·§8(푸시투토크·`sttCopy`·`micPreflight`·`MicTestAlert`)·§9(회화방 `SttAlert`·`announce`·메뉴 시트 `extra`). 새 색 없음(§1-1 토큰만).
> **앱/웹 분기는 로그인·실시간 인식 경로·APK 배너 세 곳뿐이다**(CLAUDE.md 모바일 UI 원칙). 이 절의 요소는 모두 아래 표의 한 칸에 속하고, **웹에서는 DOM 에 0개**다(서버 렌더에도 없다 — 마운트 뒤 판정).

| 분기 | 이 절의 요소 |
|---|---|
| 로그인 | E 앱 로그인 대기·마무리·실패 · (Custom Tab 안) 초대코드 뒤 "앱으로 돌아가기" |
| 실시간 인식 경로 | A 휴대폰에서 알아듣기 카드(모델 내려받기) · B 인식 방식 문구 · C 마이크 테스트 경로 한 줄 · D 회화방 전환 안내·메뉴 한 줄 · F 앱 마이크 권한 · I 휴대폰 인식 진단(관리자만) |
| APK 배너 | G 업데이트 띠·설치 방법 시트·설정 맨 아래 앱 버전 줄 |
| (APK 자산 — 웹 번들 밖) | H 서버 연결 실패 화면 `public/app-shell/index.html` |

### 11-0. 한눈에 보는 결정

1. **판정은 한 곳**: `isNativeApp()`(bridge)를 **마운트 뒤** 한 번 본다(`useNativeEnv()`). 서버 렌더·첫 렌더에는 앱 요소가 없고, 웹에서는 앱 전용 API(#8)도 부르지 않는다. 플러그인이 없는 셸(`getSherpaStt()===null`)은 "웹처럼" 동작한다 — 카드 없음·서버 경로.
2. **모델 = "휴대폰에서 알아듣기" 카드**: 설정 → 음성 인식 절, 인식 방식 카드 **아래**·마이크 테스트 **위**(받고 나서 바로 아래에서 시험한다). 사용자 문구에 "모델"·엔진명을 쓰지 않고 **"휴대폰 인식 파일"**이라 부른다. 크기는 #19 `totalBytes` 로 계산해 보인다(지금 169.8MB → "약 170MB", 하드코딩 금지).
3. **누를 때만 받는다**(첫 실행 자동 다운로드 없음 — §11-11 ⑬). **Wi-Fi 전용이 기본**이고, 모바일 데이터면 거절로 끝내지 않고 "데이터로 받기"를 따로 고르게 한다. 받는 중 [일시정지], 멈춘 뒤 [이어받기]·[받은 것 지우기], 받은 뒤 [지우기](확인 시트), 새 버전이면 [새 버전 받기].
4. **받기 전·받는 중에도 회화는 된다** — 카드가 늘 "그동안은 서버에서 알아들어요"를 말한다. 받기가 끝나면 **다음 누름부터** 휴대폰 경로(앱 재시작 불필요, §11-11 ⑦).
5. **정직한 설명**: "말하는 동안의 소리는 서버로 보내지 않아요"까지만 말한다. 회화에서 다 말한 문장은 턴 기록·"내 목소리 ▶"를 위해 서버에 저장되므로(#21, 30일) **"목소리가 서버로 가지 않아요"라고 쓰지 않는다**. 마이크 테스트는 휴대폰 경로에서도 올리지 않는다(`MIC_TEST`).
6. **경로 표시**: 마이크 테스트 = 늘 한 줄(이유 포함 — 점검 화면이라서). 회화방 = **상시 표시 없음**(머리 표시등은 "선생님 목소리" 상태 하나 — 둘을 나란히 두면 무엇이 "온라인"인지 헷갈린다). 대신 전환 때 안내 1회 + ⋯ 메뉴 시트의 읽기 전용 한 줄 "알아듣는 곳".
7. **전환(폴백)**: 휴대폰 인식 오류가 **앱 실행 동안 누적 2회**(#19 `fallback.onDeviceFailureThreshold`)면 서버로 바꾸고 앱을 다시 켤 때까지 유지한다. 말이 사라진 오류는 평소 오류 띠(§8-8 ⓐ ENGINE_ERROR — 2회째는 2줄만 "다음부터는 서버에서…")로, 말을 잃지 않은 전환은 토스트 1회로 알린다. 오프라인 방식은 바꾸지 않고 글자 입력을 권한다.
8. **앱 마이크 권한**: 첫 누름 = 권한만(§8-0 ③ 그대로, 안드로이드 대화상자). 한 번 거절(`prompt-with-rationale`)이면 누르기 전에 이유 한 줄. **다시 묻지 않음(`denied`)이면 오류 띠에 [앱 설정 열기]** + 경로 문구, 앱으로 돌아오면(resume) 자동으로 다시 읽어 띠를 지운다.
9. **업데이트 띠 = 앱 셸 맨 위 한 줄**. 권장(56px): ✕ 로 닫으면 **그날(KST) 동안** 숨김, 더 새 버전이 나오면 바로 다시. 집중 화면(회화방·채팅방·단어 덱)에서는 권장 띠를 숨긴다. 강제(내 번호 < 최소 지원): 닫기 없음·빨강 톤·**모든 화면**(집중 화면·로그인 포함). 앱 사용을 전면 차단하지는 않는다(§11-11 ④).
10. **받기 = Chrome(Custom Tabs)로 `/app/download/latest.apk`** — WebView 는 파일 다운로드를 처리하지 못한다(§10-10 과 같은 사정). 띠의 글자를 누르면 **설치 방법 시트**(바뀐 점·4단계·[업데이트 받기]). 설정 맨 아래 **앱 버전 줄**이 띠를 닫은 뒤에도 같은 시트로 가는 길이고, 실기기 확인 때 "지금 깔린 APK 번호"를 보는 자리다.
11. **앱 로그인**: 버튼 → "Chrome 창을 여는 중…" → **"Chrome 창에서 로그인하고 있어요" 대기 카드**([Chrome 창 다시 열기]) → 딥링크를 받으면 **"로그인 마무리 중…" 덮개**. 창을 그냥 닫고 오면 대기를 풀고 "로그인 창이 닫혔어요" 한 줄. 실패 문구는 해요체로 고쳐 웹과 같이 쓴다(문구는 분기가 아니다).
12. **서버 연결 실패 화면**(APK 자산)에 템플릿의 TheMeal 흔적(제목·밥 이모지)이 남아 있다 → 첫 APK 빌드 전에 교체(네이티브 변경, developer A).
13. **개발용 스위치 금지**: 화면·쿼리 파라미터·`localStorage` 로 앱 모드를 켜지 않는다. PC 에서 앱 모드는 **Playwright `addInitScript` 가짜 `window.Capacitor`**(`tests/live/`)와 단위 테스트 가짜 플러그인으로만 본다(§11-7 ⑨).
14. **실측 숫자는 관리자에게만**: 디코드 시간·메모리·파일 버전은 사용자 화면에 없고, 설정 맨 아래 관리자 행 밑 **휴대폰 인식 진단** 카드(앱 && `engine.read`)에서만 읽는다 — F6 실측 게이트를 adb 없이 폰에서 확인하는 자리(§11-2 I, §11-11 ⑯).
15. **플러그인 계약은 Developer A v1(08:58)을 따른다** — 메서드·이벤트·오류 코드 이름과 카운트 규칙을 그대로 쓰고, v1 에 없는 것은 `openAppSettings()`(와 선택 `freeBytes`)뿐이다(§11-11 ①).

### 11-1. 화면 개요

| 요소 | 위치(진입) | 목적 | 보이는 조건 | 웹 |
|---|---|---|---|---|
| A `OnDeviceModelCard` | 상단 아바타 → `/settings` → 음성 인식 절 | 휴대폰 인식 파일을 받고·멈추고·지우고, 지금 어디서 알아듣는지 안다 | `native && getSherpaStt()` | 없음 |
| B 인식 방식 문구 | 같은 절 인식 방식 카드 | 방식별 실제 경로를 정확히 말한다 | 늘(문구만 앱/웹 다름) | 웹 문구 |
| C 경로 한 줄 | §8 마이크 테스트 카드 | 다음 누름이 어디서 알아듣는지·왜 | 늘 | "지금은 서버에서 알아들어요." |
| D 전환 안내 · 메뉴 한 줄 | §9 회화방 띠·토스트 · ⋯ 메뉴 시트 | 휴대폰 → 서버 전환을 한 번 알리고, 궁금하면 메뉴에서 본다 | 앱 | 없음 |
| E 로그인 대기·마무리 | `/login` 버튼 자리 · (Custom Tab 안) `/invite` 완료 뒤 | Custom Tab 왕복 중에 무슨 일인지 보인다 | 앱(초대 페이지는 `appRedirect` 응답이 있을 때) | 기존 링크 그대로 |
| F 앱 마이크 권한 | §8 `MicTestAlert` · §9 `SttAlert` · 상태 줄 | 거절·영구 거절에서 다음 행동이 하나로 보인다 | 앱 문구·버튼 | 웹 문구(§8-8 ⓐ) |
| G 업데이트 띠 · 설치 시트 · 앱 버전 줄 | `(app)` 셸 맨 위 · `/login`(강제만) · `/settings` 맨 아래 | 새 APK 를 알고, 받고, 설치한다 | 앱 && 최신 번호 > 내 번호 | 없음(요청도 없음) |
| H 연결 실패 화면 | APK `webDir`(`server.errorPath`) | 서버에 닿지 못할 때 앱이 죽은 것처럼 보이지 않게 | 앱, 서버 불통 | 없음 |
| I 휴대폰 인식 진단 | `/settings` 맨 아래 관리자 행 아래 | F6 실측 게이트 숫자(디코드 시간·메모리)를 폰에서 읽는다 | 앱 && `engine.read` | 없음 |

- 역할별 가시성: I 만 관리자(`engine.read`), 나머지는 로그인 사용자 공통. 로그인 전에는 E·G(강제)·H 만.
- 폭: **앱 WebView ≈390 기준**으로 그리고 360·412 에서 확인(§11-9).

### 11-2. UI 구조 (의사코드, 390px 기준)

#### A. 휴대폰에서 알아듣기 카드 — `OnDeviceModelCard`

배치(`SpeechSettings`):
```
Section
  SectionHeader "음성 인식"
  Card 인식 방식 radiogroup            ← 기존 + 설명 문구(§11-2 B)
  OnDeviceModelCard                    ← 앱에서만(mt-3). 웹·플러그인 없음이면 null
  MicTestCard                          ← §8 + 경로 한 줄(§11-2 C)
```

카드 뼈대(모든 상태 공통):
```
Card id="ondevice-card" className="mt-3 flex flex-col gap-3" aria-labelledby={titleId}
  div flex items-start gap-2
    h4#titleId "휴대폰에서 알아듣기"           15px semibold ink, min-w-0 flex-1
    Badge {상태 뱃지}                          flex-none — good | bad | neutral 만(§1-1)
  p 설명(상태별 §11-8 ⓐ)                      13px ink2 break-keep
  (상태별 본문 — 아래 표)
  p 알아 두세요(§11-8 ⓐ)                      12px ink2 break-keep   ← absent·installed 에서만
```

| phase | 뱃지 | 본문 | 버튼 |
|---|---|---|---|
| `checking` | — | 12px ink2 "확인하는 중…"(1초 넘을 때만 보임) | 없음 |
| `off` | 쓸 수 없음(neutral) | 설명만 "지금은 휴대폰에서 알아듣기를 쓸 수 없어요. 서버에서 알아들어요." | 없음 |
| `absent` | 받지 않음(neutral) | 메타 줄 "약 170MB · Wi-Fi 에서 받아요"(12px ink2) + "받기 전에도 회화는 서버에서 알아들어요." | **Btn primary w-full "휴대폰에 받기 (약 170MB)"** |
| `needsConsent`(모바일 데이터) | 받지 않음 | 안내 상자(`rounded-xl bg-surface2 p-3 role=status`) "지금은 Wi-Fi 가 아니에요." / "모바일 데이터로 약 170MB 를 쓰게 돼요. Wi-Fi 에 연결한 뒤 다시 누르거나, 지금 받을 수 있어요." | BtnRow [데이터로 받기](ghost) [나중에](soft → `absent`) |
| `downloading` | 받는 중(neutral) | `ModelProgress`(아래) + 12px ink2 "받는 동안에도 회화는 서버에서 알아들어요. 다른 화면으로 가도 계속 받아요." | Btn ghost w-full "일시정지" |
| `verifying` | 받는 중 | 막대 100% + "받은 파일을 확인하는 중…"(`aria-busy`) | 없음 |
| `paused` | 멈춤(neutral) | 막대(멈춘 위치, 채움 `bg-ink3` — 장식) + "멈춤 · 123MB / 170MB 받음"(12px ink2 tabular-nums) | Btn primary w-full "이어받기" + 텍스트 버튼(h-11 `text-bad` 13px) "받은 것 지우기"(= `deleteModel()` — 설치본이 없을 때만 보인다) |
| `installed` | 준비됨(good) | 경로 줄(방식·전환별 §11-8 ⓐ, 13px ink) · 메타 "170MB 사용 중"(12px ink2) | Btn danger w-full "지우기" → 확인 시트 |
| `installed` + 새 버전 | 준비됨 | 경로 줄 + 안내 상자 "새 버전이 있어요(약 170MB). 받는 동안에도 지금 버전으로 알아들어요." | Btn primary w-full "새 버전 받기" · Btn danger w-full "지우기" |
| `installed` + 새 버전 받는 중·멈춤 | 준비됨 | `ModelProgress title="새 버전 받는 중…"` / 멈춤 줄 | "일시정지" / "이어받기" + "지우기"(설치본까지 전부 — 플러그인 `deleteModel()` 은 설치본·미완성을 함께 지운다. 새 버전 조각만 버리는 버튼은 두지 않는다) |
| `error` | 문제 있음(bad) — 설치돼 있으면 준비됨 유지 | `ModelAlert`(`role=alert rounded-xl bg-bad-soft px-3.5 py-3 text-[13px] text-bad break-keep`, 1줄 무엇 · 2줄 어떻게 — §11-8 ⓑ) | 오류별 1개(§11-8 ⓑ 버튼 열) |

- 받는 중·멈춤은 **설정 화면을 떠나도 유지**된다(앱 전체 스토어 1개, §11-3 B). 돌아오면 그 자리부터 보인다. 완료되면 카드 안 `role=status` 한 줄 "준비됐어요. 이제 휴대폰에서 알아들어요."(다른 화면에 있었으면 알림 없음 — 경로 한 줄과 카드가 말한다).
- 인터넷이 끊기면(`navigator.onLine=false`) [휴대폰에 받기]·[이어받기]·[새 버전 받기]를 `disabled` 하고 버튼 아래 12px ink2 "인터넷에 연결되면 받을 수 있어요." 받는 중에 끊기면 플러그인 오류 `DOWNLOAD_FAILED` → `error`([이어받기]).
- 마이크 테스트가 녹음 중이면 [지우기]만 `aria-disabled`(쓰는 중인 파일).
- 오프라인 방식이 선택돼 있으면 [지우기] `aria-disabled` + 12px ink2 "오프라인 방식에서는 지울 수 없어요 — 먼저 다른 방식을 골라 주세요."
- 저장 공간: 플러그인 계약 v1(Developer A 기록)에는 여유 공간 조회가 없어 **누른 뒤** `INSUFFICIENT_STORAGE`(여유 < 파일 크기×2.5)로 안다 → `error(INSUFFICIENT_STORAGE)`, 필요량은 `totalBytes×2.5` 로 화면이 계산한다. `checkModel()` 이 `freeBytes` 를 주게 되면 누르기 전에 같은 오류를 보인다(§11-11 ①).

**`ModelProgress`**
```
p   "받는 중… 72%"                          15px ink tabular-nums, aria-hidden(막대가 전한다)
div role="progressbar" aria-label="휴대폰 인식 파일 받기" aria-valuemin=0 aria-valuemax=100 aria-valuenow=72
    aria-valuetext="170MB 중 123MB 받음" className="h-2 overflow-hidden rounded-full bg-surface2"
  div className="h-full rounded-full bg-accent transition-[width] motion-reduce:transition-none" style={{ width: '72%' }}
p   "123MB / 170MB · 남은 시간 약 1분"        12px ink2 tabular-nums
p.sr-only aria-live="polite"                ← 25·50·75·100% 에서만(§11-8 ⓐ 낭독) — 250ms 이벤트마다 읽지 않는다
```
- 남은 시간: 최근 5초 평균 속도, 시작 3초 뒤부터. 60초 미만은 "1분 안에 끝나요". **10초 넘게 진행이 없으면** 남은 시간 대신 "받는 속도가 느려요. Wi-Fi 연결을 확인해 주세요."
- 막대 채움 `bg-accent` 는 비텍스트(3:1 이상). 숫자는 `ink`/`ink2` 글자로 따로 준다.

**지우기 확인 시트 — `ModelDeleteSheet`**(공용 `Sheet`, 제목 "휴대폰 인식 파일 지우기")
```
p 15px ink   지우면 저장 공간 약 170MB 가 비어요. 회화는 서버에서 알아들어요.
p 13px ink2  다시 쓰려면 약 170MB 를 또 받아야 해요.
Btn danger w-full "지우기"          ← 진행 중 "지우는 중…" disabled, 시트 dismissible=false
Btn ghost  w-full mt-2 "취소"
```
성공 → 시트 닫고 토스트 "휴대폰 인식 파일을 지웠어요", 카드 `absent`, 경로 즉시 서버. 실패 → 시트 안 한 줄 "지우지 못했어요. 다시 눌러 주세요."

#### B. 인식 방식 카드 설명 (`SpeechSettings` MODES)

라벨은 그대로, 설명(`desc`)만 앱/웹·파일 유무로 고른다(§11-8 ⓓ). 동작 변화는 하나: **앱에서 오프라인 방식은 휴대폰 인식 파일이 있어야 고를 수 있다**(`disabled` + "휴대폰 인식 파일을 받은 뒤 고를 수 있어요"). 이미 오프라인인데 파일이 쓸 수 없게 된 경우(손상)는 라디오를 막지 않고 카드 `error(MODEL_CORRUPT)` 가 이유를 말한다.

#### C. 마이크 테스트 경로 한 줄 (§8-2 B `pathCaption`)

`pathCaption(route)` — `route = { kind, reason }`(§11-3 C), 문구 §11-8 ⓔ. 파일 없음·받는 중처럼 사용자가 바꿀 수 있는 이유면 끝에 "위에서 받을 수 있어요."를 붙인다(카드가 바로 위 — 링크·스크롤 없음). 받기가 끝나거나 지우면 누르지 않아도 줄이 바로 바뀐다.
- 휴대폰 경로의 마이크 테스트는 **인터넷 없이도 된다** — 사전 점검의 OFFLINE 은 `kind==='GATEWAY'` 일 때만(§8-3 C 갱신).
- 결과는 휴대폰 경로에서도 저장하지 않는다(#21 업로드 없음, wav 는 플러그인이 지움) — 저장 안내(§8-8 ⓓ A) 그대로.
- 오프라인 방식 + 파일 없음 → 오류 `MODEL_REQUIRED`(막힘, §11-8 ⓕ 끝 줄).

#### D. 회화방 (§9) — 전환 안내 · 메뉴 한 줄

| 사건 | 화면 |
|---|---|
| 휴대폰 인식 오류로 **말이 사라짐**(DECODE_FAILED·OOM, 1회째) | 기존 `SttAlert` ENGINE_ERROR(§8-8 ⓐ) 그대로 |
| 같은 오류 **2회째**(= 전환) | `SttAlert` ENGINE_ERROR 의 2줄만 "다음부터는 서버에서 알아들어요. 다시 눌러 말해 주세요."(`switched`) — 토스트 없음(띠가 이미 말함) |
| `start()` 거부처럼 **말을 잃지 않은** 전환(이번 누름이 서버로 이어짐) | `announce`(§9-2 D — 녹음이 끝난 뒤) 토스트 1회 "휴대폰 인식이 잘 안 돼서 서버에서 알아들을게요." |
| 파일 없음·손상을 누를 때 발견 | 조용히 서버(안내 없음 — 카드·경로 줄이 말한다) |
| 오프라인 방식 + 휴대폰 오류 | `SttAlert` ENGINE_ERROR, 2줄 "오프라인 방식이라 서버로 바꾸지 않아요. 다시 말하거나 글자로 대화해 주세요." + [글자로 대화하기] |
| 오프라인 방식 + 파일 없음/손상 | `SttAlert` **MODEL_REQUIRED**(막힘): "휴대폰 인식 파일이 없어요." / "설정 → 음성 인식에서 받거나 다른 방식을 골라 주세요." + [설정 열기](→ `/settings#ondevice-card`) + [글자로 대화하기] |

- 전환 안내(띠 2줄·토스트)는 **앱 실행당 1회**. 다시 켜면 휴대폰부터 쓰고, 또 두 번 실패하면 다시 1회.
- 턴은 막지 않는다: 휴대폰에서 알아들은 문장의 업로드(#21)가 실패해도 글자로 보낸다(§9-11 ② 규칙 — 그 메시지엔 "내 목소리 ▶"가 없다).

**메뉴 시트 한 줄 — `SttRouteRow`**(앱에서만. `TalkRoom` 이 이미 넘기는 `ChatMenuSheet extra` 안, `SpeechProfileMenu` 아래):
```
div flex min-h-[44px] min-w-0 items-center justify-between gap-3 border-t border-line pt-2
  span 13px ink2 "알아듣는 곳"
  span 15px ink  "휴대폰에서" | "서버에서"                ← route.kind
p 12px ink2 break-keep {이유 짧은 꼴 — §11-8 ⓔ 오른쪽 열, 없으면 생략}
Link href="/settings#ondevice-card" className="inline-flex h-11 items-center text-[13px] font-semibold underline underline-offset-4" "음성 인식 설정 ›"
```
- 누를 수 있는 것은 링크 하나. 여기서 경로를 바꾸지 않는다(방식은 설정에서).

#### E. 앱 로그인 — `/login`

버튼 자리(앱에서만 상태가 생긴다 — 웹은 지금의 `<a>` 그대로):
```
AppLoginArea (client) — GoogleLoginButton + AppDeepLink 를 한 상태로 감싼다
  idle        [G  Google로 계속하기]                                   ← 기존 52px
  opening     [(spinner) Chrome 창을 여는 중…] disabled aria-busy         ← ≤1.5s
  waiting     div role="status" rounded-[14px] border border-line bg-surface p-3.5
                (spinner 16) Chrome 창에서 로그인하고 있어요            15px semibold ink
                로그인이 끝나면 이 화면으로 자동으로 돌아와요.           13px ink2 break-keep
                Btn ghost w-full mt-3 "Chrome 창 다시 열기"            ← 같은 URL 로 openExternal
  exchanging  fixed inset-0 z-50 grid place-items-center bg-ground (role="status")
                (spinner 24) 로그인 마무리 중…                         15px ink
  closed      idle 로 돌아오며 버튼 위 13px ink2 role="status" "로그인 창이 닫혔어요. 다시 눌러 주세요."
```
- 하단 안내 두 줄 중 둘째 줄("앱에서는 Chrome 창에서…")은 **앱에서만** 보인다(웹에서는 뜻 없는 말). 첫 줄("처음이라면 초대코드가 필요합니다")은 공통 — 이 줄의 `text-ink3`(라이트 3.13:1)는 `ink2` 로 올린다(§1-1, 읽어야 하는 글).
- 오류 배너(기존 `role=alert` 상자)는 웹·앱 공통 — 문구만 해요체로 교체(§11-8 ⓘ).
- 강제 업데이트 띠(G)를 `main` 맨 위에 둔다(권장 띠는 로그인 뒤 셸에서만).

**Custom Tab 안 초대 페이지**(`/invite`, 새 사용자 — 이 페이지는 앱이 아니라 Chrome 창에 뜬다):
```
제출 성공 + appRedirect 응답
  → location.href = appRedirect (지금 그대로)
  → 폼 자리를 InviteReturn 으로 바꾼다(0.3s 뒤 — 이미 앱으로 넘어갔으면 보이지 않는다)
     (spinner) 앱으로 돌아가는 중…                               15px ink
     앱이 열리지 않으면 아래 버튼을 눌러 주세요.                     13px ink2
     <a href={appRedirect}> Btn primary w-full "앱으로 돌아가기"    ← 같은 1회용 주소(60초)
     1분이 지나면 이 창을 닫고 앱에서 다시 로그인해 주세요.            12px ink2
```

#### F. 앱 마이크 권한 (§8 `MicTestAlert` · §9 `SttAlert` 공통)

앱의 권한은 플러그인 `checkPermissions()`(bridge)로 읽는다(플러그인이 없으면 §8-3 C 의 Permissions API). 서버 경로(WebView 마이크)도 같은 앱 권한 하나를 쓰므로 흐름이 같다.

| 권한 | 누르기 전 | 누름 | 거절 뒤 |
|---|---|---|---|
| `granted` | 없음 | 녹음 | — |
| `prompt` | 없음 | **권한만** 요청(안드로이드 대화상자, §8-0 ③) → 허용: 힌트 PERMISSION_GRANTED | `prompt-with-rationale` 또는 `denied` |
| `prompt-with-rationale`(한 번 거절) | 상태 줄 자리 13px ink2 "말을 알아들으려면 마이크가 필요해요. 누르면 다시 물어봐요." | 권한만 다시 요청 | 다시 거절 → 대개 `denied` |
| `denied`(다시 묻지 않음) | 오류 띠 MIC_DENIED(앱 문구) + **[앱 설정 열기]** | 누를 수 있음 — 다시 확인만, 여전히 `denied` 면 띠 유지 + 포커스를 [앱 설정 열기]로 | — |

오류 띠(§8-2 B `MicTestAlert` · §9-2 G `SttAlert` — 모양 그대로, 버튼 줄만 추가):
```
role=alert rounded-xl bg-bad-soft px-3.5 py-3 text-[13px] text-bad break-keep
  1줄  마이크 사용이 막혀 있어요.
  2줄  앱 설정 → 권한 → 마이크 → ‘앱 사용 중에만 허용’을 골라 주세요.
  [앱 설정 열기]   inline-flex h-11 font-semibold underline underline-offset-4   ← openAppSettings(). false 면 버튼 없이 2줄을 경로형으로(§11-8 ⓖ)
  (회화방) [글자로 대화하기]                                                    ← §9-2 G 그대로
```
- 앱으로 돌아오면(bridge `onAppResume`) 권한을 다시 읽고 `granted` 면 띠를 지우고 힌트 "마이크를 허용했어요. 이제 버튼을 누른 채로 말해 보세요."(§8-8 ⓒ). **돌아온 것만으로 녹음을 시작하지 않는다.**
- 설정 화면·회화방에 들어오는 것만으로는 권한을 묻지 않는다(§8-0 ③ 그대로).

#### G. 업데이트 띠 · 설치 방법 시트 · 앱 버전 줄

배치 — `(app)/layout.tsx` 그리드에 첫 행을 더한다(상태바 여백은 셸 `paddingTop` 이 이미 처리):
```
<div data-app-shell className="grid h-[100dvh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-surface" …>
  <NativeFlag /> <AttendancePing />
  <AppUpdateBanner />      ← 웹·해당 없음이면 null(행 높이 0)
  <main …>{children}</main>
  <TabBar />
</div>
```
(`NativeFlag`·`AttendancePing` 은 그리는 것이 없어 행을 차지하지 않는다 — 그리드 행 순서가 어긋나지 않게 `AppUpdateBanner` 를 `main` 바로 앞에 둔다.)

**권장 띠**(`state='recommended'`, 집중 화면에서는 null):
```
div data-app-update="recommended" role="status" className="flex h-14 min-w-0 items-center gap-1 border-b border-line bg-surface pl-4 pr-1"
  span aria-hidden className="h-8 w-[3px] flex-none rounded-full bg-accent"          ← 장식(비텍스트)
  button className="min-h-11 min-w-0 flex-1 py-1.5 pl-2 text-left" onClick={openSheet}
    span className="block truncate text-[14px] font-semibold text-ink"  "Lingofy Japanese v1.1.0"   ← 이름+버전만(360 에서도 안 잘림, task-003h)
    span className="block truncate text-[12px] text-ink2"               "새 버전이 나왔어요 · 눌러서 설치 방법 보기"
  Btn size="sm" variant="primary" className="relative flex-none before:absolute before:-inset-y-1.5 before:inset-x-0" onClick={download} "받기"
  button aria-label="오늘은 그만 보기" className="grid h-11 w-11 flex-none place-items-center text-ink2" ✕
```

**강제 띠**(`state='forced'`, 모든 화면):
```
div data-app-update="forced" role="alert" className="flex min-w-0 items-center gap-3 border-b border-bad bg-bad-soft px-4 py-2.5"
  div className="min-w-0 flex-1 text-bad break-keep"
    p 14px semibold  "Lingofy Japanese를 업데이트해 주세요"
    p 13px           "이 버전(v1.0.0)은 더 이상 지원하지 않아요. 일부 기능이 멈출 수 있어요."
  Btn size="md" variant="primary" className="flex-none" onClick={openSheet} "업데이트"
```
- ✕ 없음. 버튼은 바로 받기가 아니라 **시트**(강제일수록 설치 방법을 먼저 보고 한 번에 끝내게).
- 로그인 화면: `<AppUpdateBanner forcedOnly insetTop />` 를 `main` 맨 위에. `(auth)` 에는 셸·`NativeFlag` 가 없으므로 띠가 스스로 상태바 여백(`pt-[max(env(safe-area-inset-top),24px)]`)을 가진다.

**설치 방법 시트 — `AppUpdateSheet`**(공용 `Sheet`, 제목 "Lingofy Japanese 업데이트")
```
p 15px semibold ink tabular-nums   v1.0.0 → v1.1.0
p 13px ink2                        9월 28일 올라온 버전 · 약 {size}          ← size 는 #8 에 bytes 가 있을 때만(§11-11 ③)
h3 13px semibold ink2 "바뀐 점"     (notes 가 있을 때만)
p  15px ink whitespace-pre-wrap break-keep                                  ← 서버 notes 는 글자로만(HTML 아님)
h3 13px semibold ink2 "설치 방법"
ol 14px ink leading-6, 항목마다 번호 원(24px bg-surface2 ink 13px) + 간격 10px   ← §11-8 ⓗ 4단계
Btn primary w-full mt-4 "업데이트 받기"                                     ← openExternal(url)
p 12px ink2 mt-2 break-keep  설치 실패 안내(§11-8 ⓗ)
(권장일 때만) Btn ghost w-full mt-2 "나중에"   ← 시트만 닫는다(띠의 ✕ "오늘은 그만 보기"와 다름)
```
- [업데이트 받기] → `openExternal(absoluteUrl)`. 버튼 문구를 3초 동안 "Chrome 창에서 받는 중이에요"(disabled — 두 번 받기 방지)로 바꿨다가 되돌린다. `false` 면 `location.href = absoluteUrl`(A 의 DownloadListener 가 시스템 브라우저로 넘긴다). 그것도 예외를 던지면 시트 안 한 줄 "Chrome 창을 열지 못했어요. 잠시 후 다시 눌러 주세요."
- `url` 은 #8 응답 값을 쓰되 **같은 출처(`location.origin`)의 `/app/download/` 경로일 때만** 연다 — 아니면 `new URL('/app/download/latest.apk', location.origin)`.
- 바뀐 점이 길면(6줄 넘음) 시트 내부 스크롤 한 곳.

**설정 맨 아래 앱 버전 줄 — `AppVersionRow`**(앱에서만, `SpeechSettings` 다음·관리자 행 앞)
```
Section > Card className="flex min-h-[56px] min-w-0 items-center justify-between gap-3"
  div min-w-0
    p 14px ink tabular-nums truncate "Lingofy Japanese v1.0.0"
    p 12px ink2 truncate             "일본어가 자연스러워지는 AI 회화"      ← 부제(task-003h)
  (최신)    span 14px ink2 flex-none "최신"
  (새 버전) button className="inline-flex h-11 flex-none items-center whitespace-nowrap text-[14px] font-semibold text-accent" "새 버전 1.1.0 ›" → AppUpdateSheet
  (강제)    button 같은 모양, 글자 text-bad "업데이트 필요 ›"
```
- `accent` 글자/`surface` 4.80:1(§1-1 ✅). 버전을 모르면(`getAppInfo()` 없음) 줄을 그리지 않는다.

#### H. 서버 연결 실패 화면 — `public/app-shell/index.html` (APK 자산, developer A)

```
(가운데 정렬, 세로 중앙, 좌우 24px, safe-area)
  Lingofy <span accent>Japanese</span>          28px bold (로그인 화면과 같은 글자 로고, task-003h)
  일본어가 자연스러워지는 AI 회화                  13px ink2, mt 4
  서버에 연결하지 못했어요                        17px semibold ink, mt 16
  인터넷 연결을 확인한 뒤 다시 시도해 주세요.       14px ink2
  [다시 시도]     min-height 48, width 200, accent 배경 · on-accent 글자, radius 12, mt 20
                  ← onclick = location.replace('https://kaiwa.xn--lh0b87pnudm10a4vd.com/')
  계속 안 되면 서버가 점검 중일 수 있어요.          12px ink2, mt 12
```
- 인라인 CSS·인라인 스크립트 한 줄뿐(빌드 도구 없음). 색은 `globals.css` 토큰의 hex 를 그대로 쓰고 `@media (prefers-color-scheme: dark)` 로 다크 값도 넣는다. `<title>Lingofy Japanese</title>`, `lang="ko"`, 이모지 없음.
- 이 파일은 **APK 안에 들어간다** — 바꾸면 네이티브 변경(versionCode 증가). 첫 APK(versionCode 1) 빌드 전에 고친다(§11-11 ⑨).

#### I. 휴대폰 인식 진단 — `OnDeviceDiagnosticsCard` (관리자만, §11-11 ⑯)

설정 맨 아래 "관리자 › AI Engine Console" 행(§6-2 K) **바로 아래**. 서버 컴포넌트가 이미 계산하는 `showConsole`(`engine.read`)이 `true` 이고 `ready && native && getSherpaStt()` 일 때만 그린다 — USER 는 DOM 0.
```
Section
  SectionHeader "휴대폰 인식 진단"  + 12px ink2 "관리자에게만 보여요"
  Card
    dl grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2   라벨 13px ink2 / 값 14px ink tabular-nums text-right
      인식기            불러옴 · 스레드 2 | 안 불러옴
      불러오기 시간      1.2초                                  ← lastLoadMs
      최근 발화         5.0초 말함 → 0.31초 만에 알아들음          ← 이번 앱 실행의 마지막 final: durationMs · timings.decodeMs
                        [기준 초과] Badge bad                   ← 5초 이상 발화에서 decodeMs > 800 일 때만
      메모리            앱 412MB · Java 38MB                     ← rssMb · javaHeapMb, rssMb > 600 이면 [기준 초과]
      파일 버전         {modelVersion}                           ← 관리자 화면이라 허용(엔진·모델 이름은 없음)
      앱 구성           플러그인 {pluginVersion} · {abi}
    BtnRow [다시 읽기](ghost) [미리 불러오기](ghost → preload, 결과 "불러오기 시간" 갱신)
    p 12px ink2  "측정값은 이 휴대폰 안에만 있어요. 서버로 보내지 않아요."
```
- 값은 카드 마운트·[다시 읽기] 때만 읽는다(폴링 없음). 카드는 플러그인을 직접 보지 않고 모델 스토어의 `readDiagnostics()`(→ `getDiagnostics()`)·`preload()` 를 부른다(§11-3 B — `getSherpaStt()` 호출자 2곳 규칙 유지). "최근 발화"는 `OnDeviceSherpaClient` 가 모듈 메모리에 둔 마지막 `timings`(텍스트·소리 없음)를 읽는다 — 저장·전송하지 않는다.
- 기준값(0.8s·600MB)은 design-spec §9 실측 게이트 그대로. 이 카드는 F6 에서 사용자가 "20문장을 말해 본 뒤 여기 숫자를 알려 주세요" 하는 자리다.

### 11-3. 상태 관리

#### A. 앱 판정 — `useNativeEnv()`
```ts
// src/components/common/useNativeEnv.ts
export function useNativeEnv(): { native: boolean; ready: boolean }   // 마운트 전 {false,false} → 뒤 {isNativeApp(), true}
```
- 앱 전용 요소는 `ready && native` 일 때만 렌더(수화 불일치 0·웹 DOM 0). 기존 `useState(() => typeof window!=='undefined' && isNativeApp())`(`MicTestCard`·`TalkRoom`)는 **문구 선택에만** 쓰이므로 그대로 둬도 되지만, 새 코드는 이 훅을 쓴다.

#### B. 모델 스토어 — `onDeviceModelStore`(앱 전체 1개, `@/modules/speech/stt/client/onDeviceModel.ts`) + `useOnDeviceModel()`

- `getSherpaStt()` 의 두 번째(마지막) 호출자(§11-11 ⑥). **라우터(`createRealtimeSttClient`)와 카드가 같은 스냅샷**을 본다 — 카드는 "준비됨"인데 누름이 서버로 가는 어긋남을 막는다.
```ts
type ModelPhase = 'unsupported' | 'checking' | 'off' | 'absent' | 'needsConsent' | 'downloading' | 'verifying' | 'paused' | 'installed' | 'error'
interface ModelSnapshot {
  phase: ModelPhase
  installed: boolean              // 휴대폰 경로를 쓸 수 있는가(라우터 입력)
  updateAvailable: boolean        // 설치 버전 !== #19 model.version
  updating: boolean               // installed 이면서 새 버전 받는 중·멈춤
  totalBytes: number | null; receivedBytes: number; etaSec: number | null; slow: boolean
  requiredBytes: number | null    // totalBytes × 2.5(플러그인 거절 기준과 같음)
  error: ModelErrorCode | null    // §11-8 ⓑ
  cellularConsent: boolean        // 이번 앱 실행 동안만
}
actions: refresh() · download({ allowCellular? }) · pause() · remove() · dismissError() · readDiagnostics() · preload()   // 뒤 둘은 진단 카드(§11-2 I)만
```
- 버전 문자열은 비교에만 쓰고 **스냅샷에도 화면에도 싣지 않는다**(엔진·모델 정보 비노출).

| 사건 | 동작 |
|---|---|
| 첫 구독 · `onAppResume` · `online` | `checking`(첫 번만 보임) → #19(ETag) + `checkModel()`(`{installed, version, bytes, downloading, pendingVersion, pendingBytes}` — A 계약 v1) → 아래 판정. 3초 안에 플러그인 응답이 없으면 `absent` 로 보이고 버튼을 누를 때 다시 확인 |
| 판정 | 플러그인 없음 → `unsupported`(카드 null) · `downloading` → `downloading`(WebView 가 다시 로드돼도 진행 중인 받기를 다시 잡는다 — 이후 `downloadProgress` 로 갱신) · `pendingBytes>0` → `paused` · 설치됨 → `installed`(+`updateAvailable`, `pendingVersion` 이 있으면 새 버전 멈춤) · #19 에 모델 블록이 없거나 `version`·`totalBytes` 가 `null`(서버 배포본 없음) → `off`(설치돼 있으면 `installed` 유지) · 그 외 → `absent` |
| [휴대폰에 받기]·[이어받기]·[새 버전 받기] | `downloadModel({ manifestUrl: 절대 URL, wifiOnly: !cellularConsent, expectedVersion })` → `downloading` |
| 플러그인 `NETWORK_NOT_ALLOWED` | `needsConsent` |
| [데이터로 받기] | `cellularConsent=true` → 다시 `download` |
| `downloadProgress` | `receivedBytes`·`etaSec` 갱신(최근 5초 평균) · 10초 무진행 → `slow` · 합계 = 전체면 `verifying` |
| `downloadModel` resolve | `installed` · `updateAvailable=false` · 라우터에 알림(다음 누름부터 휴대폰) |
| `downloadModel` reject | 코드 → `error`(§11-8 ⓑ). `DOWNLOAD_CANCELLED` → `paused`(오류 아님) · `DOWNLOAD_IN_PROGRESS` → `refresh()`(이미 받는 중) · `NETWORK_NOT_ALLOWED` → `needsConsent` |
| [일시정지] | `cancelDownload()` → 진행 중 `downloadModel` 이 `DOWNLOAD_CANCELLED` 로 끝남(받은 조각은 남는다) → `paused` |
| [받은 것 지우기](설치본 없을 때만) · [지우기] 확정 | `deleteModel()`(설치본·미완성 전부) → `absent`(라우터 즉시 서버). `BUSY`(녹음·받기 중) → 시트 안 "지금은 지울 수 없어요. 녹음이나 받기가 끝난 뒤 다시 눌러 주세요." |
| 라우터가 `MODEL_MISSING`·`MODEL_CORRUPT` 보고 | `checkModel({ verify: true })`(불일치 버전은 플러그인이 지운다) → 손상이면 `error(MODEL_CORRUPT)`, 없으면 `absent` |

- 동시 조작 금지: 요청이 걸려 있는 동안 카드 버튼 `disabled`. 받기는 한 번에 하나(플러그인도 거절).
- 모바일 데이터 동의는 **이번 앱 실행 동안만** 기억하고 저장소에 남기지 않는다 — 다음 실행의 이어받기는 다시 묻는다.

#### C. 경로 정보 — 라우터가 화면에 주는 것 (`useRealtimeStt().route`)

```ts
type SttRouteReason = 'WEB' | 'READY' | 'MODEL_ABSENT' | 'MODEL_DOWNLOADING' | 'MODE_ACCURATE' | 'MODE_OFFLINE'
  | 'ONDEVICE_FAILED' | 'SERVER_DISABLED' | 'UPDATE_REQUIRED'
interface SttRoute { kind: SttKind; reason: SttRouteReason }
// SttEvent 에 추가: { type: 'route'; route: SttRoute; switched: boolean }   ← switched = 전환된 순간(안내 1회용)
// SttErrorCode 에 추가: 'MODEL_REQUIRED'                                     ← 오프라인 방식 + 파일 없음/손상
```
- **누를 때마다 고른다**(녹음 중이 아닐 때). 받기가 끝나면 다음 누름부터 휴대폰, 지우면 다음 누름부터 서버. 대기 중에도 스토어가 바뀌면 `route` 를 다시 계산해 경로 한 줄이 바로 바뀐다.
- 전환 카운터는 **모듈 수준(앱 실행 1회)** — 설정 ↔ 회화방을 오가도 이어지고, 앱을 다시 켜면 0.
- 플러그인 오류 → 화면 코드(클라이언트가 끝낸다. 화면은 코드만 안다). 코드·카운트 구분은 **Developer A 플러그인 계약 v1**(task 이력서 "A(앱·플러그인)")의 권고를 따른다:

| 플러그인(언제) | 화면 | 카운트 | 이번 누름 |
|---|---|---|---|
| `PERMISSION_DENIED`(`start` 거부) | MIC_DENIED | × | 끝(권한 흐름 F) |
| `INTERRUPTED`(앱이 뒤로 가 세션 취소) | 힌트 INTERRUPTED(§8-8 ⓒ "녹음이 중간에 멈췄어요") | × | 끝 |
| `ALREADY_STARTED` · `INVALID_ARGUMENT` | — (띠 없음, 개발 오류) | × | `cancel()` 뒤 서버로 이어서 |
| `MODEL_MISSING`(`start` 거부) | — / 오프라인 방식이면 MODEL_REQUIRED | × | **즉시 서버로 이어서**(버퍼 유지) + 스토어 `refresh` |
| `AUDIO_INIT_FAILED` · `BUSY` · `MODEL_CORRUPT` · `OOM`(`start` 거부) | — (띠 없음) / 오프라인 방식이면 MIC_BUSY(`AUDIO_INIT_FAILED`)·MODEL_REQUIRED(`MODEL_CORRUPT`)·ENGINE_ERROR | ○ | **서버로 이어서**. 2회째면 `route{switched:true}` → 토스트 1회. `MODEL_CORRUPT` 는 카드 `error` 도 |
| `DECODE_FAILED` · `OOM` · `MODEL_CORRUPT` · `AUDIO_INIT_FAILED`(세션 중 `error` 이벤트) | ENGINE_ERROR(2회째 `switched`, 오프라인 방식이면 `offlineMode` 2줄) | ○ | 말 잃음 |
| `final.text` 빈 문자열(`wavPath:null`) | 힌트 EMPTY_RESULT(§8-8 ⓒ) | × | 업로드 없음 |
| #21 업로드 실패(TURN) | — | × | final 은 그대로, `utteranceId:null` |

#### D. 권한 — 앱
- `micPreflight(kind, config, native)`: 앱이면 `getSherpaStt()?.checkPermissions()` → `recordAudio`, 없으면 Permissions API. `prompt-with-rationale` 은 `PermState` 새 값 `'rationale'` 로 올려 상태 줄 안내(§11-2 F).
- 플러그인 `start()` 는 권한을 스스로 묻지 않는다(A 계약 v1). A 기록의 "회화 진입·마이크 테스트 전에 `requestPermissions()`"는 화면 규칙(§8-0 ③ — 진입만으로 묻지 않는다)에 따라 **첫 누름 때** 부른다: 권한이 `granted` 가 아니면 그 누름은 `requestPermissions()` 만 하고 녹음하지 않는다.
- `watchMicPermission(cb)`: 앱이면 `onAppResume` 에서 다시 읽는다(Permissions API `onchange` 는 WebView 에서 오지 않을 수 있다).
- `openAppSettings()` 가 `false`(메서드 없음)면 버튼을 그리지 않고 2줄을 경로형으로 바꾼다.

#### E. 업데이트 — `appUpdateStore`(앱 전체 1개, `src/components/shell/useAppUpdate.ts`)
```ts
interface AppUpdateSnapshot {
  state: 'hidden' | 'recommended' | 'forced'
  mine: { name: string; code: number } | null
  latest: { name: string; code: number; notes: string | null; url: string; publishedAt: string | null; bytes: number | null } | null
  dismissedToday: boolean
}
```
| 사건 | 동작 |
|---|---|
| 셸·로그인 첫 마운트(앱) | `getAppInfo()` → 없으면 `hidden`(끝). 있으면 #8(`X-App-Version`) 1회 |
| `onAppResume` | 마지막 확인이 6시간 넘었으면 조용히 #8 다시 |
| 판정 | `mine.code < minSupportedCode` → `forced` · `mine.code < latest.code` → `recommended` · 그 외 `hidden`. #8 실패 → `hidden`(조용히 — 띠 때문에 오류를 보이지 않는다) |
| ✕ | `localStorage kaiwa.app.update.dismissed = {"code": latest.code, "day": "YYYY-MM-DD"(KST)}` → `dismissedToday` |
| 표시 | forced = 늘 · recommended = `!dismissedToday && !focusRoute`. 기록의 `code < latest.code` 이거나 날짜가 오늘이 아니면 다시 보인다 |

- `localStorage` 는 try/catch — 막히면 닫기가 이번 실행 동안만 유지(메모리).
- 집중 화면 = 지금 `TabBar` 의 `HIDDEN_PREFIXES`(회화방·채팅방·단어 덱). 한 곳(`shell/routes.ts` `FOCUS_ROUTE_PREFIXES`)으로 옮겨 둘이 같이 쓴다.
- **강제 상태에서는 라우터가 휴대폰 경로를 쓰지 않는다**(`UPDATE_REQUIRED` — 옛 플러그인과 새 웹의 계약이 어긋났을 수 있다, §11-11 ④).

#### F. 앱 로그인 — `AppLoginArea` 상태
| 지금 | 사건 | 다음 |
|---|---|---|
| idle | 버튼 탭(앱) | opening → `openExternal(url)` |
| opening | `true` | waiting |
| opening | `false`(플러그인 없음·실패) | 일반 네비게이션(지금의 폴백) |
| waiting | 딥링크(코드) | exchanging → `closeExternal()` + `location.replace(app-exchange)`(기존 `AppDeepLink`) |
| waiting | 딥링크(`error`) | 기존대로 `?oauth_error=` 로 replace |
| waiting | `browserFinished` 뒤 **1.5초 안에 딥링크 없음** | idle + closed 안내 |
| waiting | [Chrome 창 다시 열기] | opening |
| exchanging | (문서 이동) | 덮개는 이동까지 유지 |
- 대기에는 시간 제한을 두지 않는다(계정 선택·2단계 인증은 오래 걸릴 수 있다). `closeExternal()` 로 닫혀도 `browserFinished` 가 오므로 "딥링크를 이미 받았으면 무시".
- 콜드 스타트(앱이 꺼진 채 딥링크로 깨어남)는 대기 상태 없이 바로 exchanging — 기존 `getLaunchUrl` 경로 그대로.
- **PKCE(Leader C1-1 채택)**: opening 단계에서 `AppLoginArea` 가 verifier 를 만들어(메모리 + `sessionStorage`, 10분·1회용) challenge 를 #2 에 싣고, 딥링크를 받으면 `code_r`+verifier 로 #5 교환(구현 developer B). 화면 변화는 없다 — [Chrome 창 다시 열기]는 **같은 URL·같은 verifier** 를 다시 쓰고, closed 뒤 버튼을 새로 누르면 새로 만든다. verifier 가 없어진 교환(콜드 스타트로 `sessionStorage` 유실 등)·만료·재사용은 서버가 구분 없이 `app_code_invalid` 로 돌려보내므로 문구도 하나(§11-8 ⓘ). verifier·코드는 화면·`console`·URL 표시줄 어디에도 그리지 않는다.

### 11-4. API 호출 계획

| # | 엔드포인트 | 시점 | 파라미터 | 사용 필드 | 에러 처리 |
|---|---|---|---|---|---|
| 19 | `GET /api/v1/speech/config` | 모델 스토어 첫 구독·resume·`online`(ETag 304 재사용) · 마이크 테스트·회화방(기존) | 헤더 `X-Client-Platform: app`(api.ts 가 앱에서 자동) | `onDevice.enabled` · `onDevice.model.{version, manifestUrl, totalBytes}` · `onDevice.connectionKey`(#21 에 그대로 싣기만) · `fallback.onDeviceFailureThreshold` · `gateway.enabled` · `recognitionMode` | 실패 → 설치돼 있으면 `installed` 유지, 아니면 카드 `error(SERVER)` [다시 시도] |
| 9 | `GET /models/reazonspeech-int8/manifest.json` | **플러그인이** `downloadModel` 안에서. 웹은 #19 `totalBytes` 가 `null` 일 때만 크기용 1회 | — | `totalBytes` 만 | 크기 모름 → 크기 표기 생략 |
| 10 | `GET /models/reazonspeech-int8/<version>/<file>` | 플러그인만(Range 재개) | `Range` | — | 플러그인 오류 코드(§11-8 ⓑ) |
| 15/16 | `GET/PUT /api/v1/settings/speech` | 기존(인식 방식) | 기존 | `recognitionMode` | 기존 |
| 21 | `POST /api/v1/speech/utterances` | `OnDeviceSherpaClient` 가 **TURN final 때만**(MIC_TEST 는 올리지 않음) | multipart `audio`·`text`·`chatId`·`realtimeConnectionKey`(#19 값 그대로)·`durationMs`·`segments`·`timings` | `utteranceId` | 실패 → final 을 `utteranceId:null` 로 넘기고 재시도 없음(§9-11 ②) |
| 8 | `GET /api/app/version` | 앱 셸·로그인 첫 마운트 1회 · resume(6시간 경과) | 헤더 `X-App-Version: {versionName}`(api.ts 가 앱에서만) | `latest` · `latestCode` · `minSupportedCode`(§11-11 ③) · `url` · `notes` · `publishedAt` · `bytes`(있으면) | 실패 → 띠 없음, 오류 표시 없음 |
| — | `GET /app/download/latest.apk` | [업데이트 받기]·띠 [받기] | Custom Tabs(`openExternal`)로 연다 — WebView 이동·`fetch` 금지 | — | 열기 실패 → 시트 안 한 줄 / 띠에서는 시트를 연다 |
| 2 | `GET /api/auth/google?platform=app&next=` | 로그인 버튼(앱) | 기존 `buildGoogleAuthHref` | — | 기존 |
| 5 | `GET /api/auth/app-exchange?code=&next=` | 딥링크 수신 | `location.replace`(기존) | 302 | 만료·재사용 → `/login?oauth_error=app_code_invalid`(§11-8 ⓘ) |

**bridge 호출**(`src/modules/infra/native/bridge.ts` — `window.Capacitor` 를 읽는 유일한 파일, 전부 "없으면 조용히")

| 함수 | 네이티브 | 부르는 곳 | 없으면 |
|---|---|---|---|
| `isNativeApp()` | `Capacitor.isNativePlatform()` | `useNativeEnv`·api.ts | `false` |
| `getSherpaStt()` **신규** | `Plugins.SherpaStt`(필수 메서드가 전부 있을 때만) | `OnDeviceSherpaClient`·`onDeviceModel` **만** | `null` → 카드 없음·서버 경로 |
| `getAppInfo()` **신규** | `Plugins.App.getInfo()` → `{ name: version, code: Number(build) }` | `appUpdateStore`·api.ts(`X-App-Version`) | `null` → 띠·앱 버전 줄 없음 |
| `onAppResume(fn)` **신규** | `Plugins.App.addListener('resume')` | 권한·모델·버전 재확인 | no-op |
| `openExternal(url)` | `Plugins.Browser.open` | 로그인·APK 받기 | `false` |
| `onBrowserFinished(fn)` **신규** | `Plugins.Browser.addListener('browserFinished')` | `AppLoginArea` | no-op(대기는 [다시 열기]·딥링크로만 풀림) |
| `closeExternal()` | `Plugins.Browser.close` | 딥링크 수신(기존) | no-op |
| `openAppSettings()` **신규** | `Plugins.SherpaStt.openAppSettings()`(§11-11 ①) | 권한 띠 | `false` → 버튼 숨김 |

- `GoogleLoginButton.client.tsx` 안의 **자체 `getBridge()` 사본을 지우고** bridge 를 쓴다(`window.Capacitor` 를 두 곳에서 읽는 상태 해소 — module-dependency §6).

### 11-5. 컴포넌트 분해

| 이름 | 위치 | 종류 | props / 반환 | 상태 |
|---|---|---|---|---|
| `OnDeviceModelCard` | components/speech | 컴포넌트 | `{ recognitionMode: RecognitionMode \| null; micBusy?: boolean }` | `useOnDeviceModel` 구독 · 시트 열림 |
| `ModelProgress` | components/speech | 컴포넌트 | `{ received; total; etaSec; slow; verifying; title? }` | 낭독 단계(ref) |
| `ModelDeleteSheet` | components/speech | 컴포넌트 | `{ open; onClose; onConfirm(): Promise<void>; bytes }` | 제출 중 |
| `useOnDeviceModel` | components/speech | 훅 | → `ModelSnapshot` + actions | 스토어 구독 |
| `modelCopy.ts` | components/speech | 문구 | §11-8 ⓐ~ⓓ | — |
| `sttCopy.ts`(수정) | components/speech | 문구 | `pathCaption(route)` · `sttErrorCopy(code, { native, switched, offlineMode, canOpenSettings })` · MODEL_REQUIRED · 권한 안내 | — |
| `MicTestAlert`(수정) | components/speech | 컴포넌트 | `+ onOpenSettings?` | — |
| `SttAlert`(수정) | components/talk | 컴포넌트 | `+ switched?; offlineMode?; onOpenSettings?` · MODEL_REQUIRED 의 [설정 열기] | — |
| `SttRouteRow` | components/talk | 컴포넌트 | `{ route: SttRoute }` | 없음 |
| `AppUpdateBanner` | components/shell | 컴포넌트 | `{ forcedOnly?: boolean; insetTop?: boolean }` | 시트 열림 |
| `AppUpdateSheet` | components/shell | 컴포넌트 | `{ open; onClose; snapshot }` | 받기 요청 표시(3초) |
| `useAppUpdate` · `appUpdateStore` | components/shell | 훅·로직 | → `AppUpdateSnapshot` + `dismiss()` | 싱글턴 |
| `appUpdateCopy.ts` | components/shell | 문구 | §11-8 ⓗ | — |
| `routes.ts` | components/shell | 상수 | `FOCUS_ROUTE_PREFIXES` | — |
| `AppVersionRow` | components/settings | 컴포넌트 | 없음 | `useAppUpdate` |
| `OnDeviceDiagnosticsCard` | components/settings | 컴포넌트 | `{ show: boolean }`(서버의 `showConsole`) | 진단 값·읽는 중 |
| `useNativeEnv` | components/common | 훅 | → `{ native, ready }` | 마운트 판정 |
| `formatMB(bytes)` | components/common/format | 순수 | `170MB` · `1.2GB`(10⁶ 기준, 반올림, 최소 1MB) | — |
| `AppLoginArea` | app/(auth)/login | 클라 | `{ callbackUrl }` — 버튼·딥링크·대기·덮개를 한 상태로 | phase |
| `InviteReturn` | app/(auth)/invite | 클라 | `{ appRedirect }` | 없음 |

### 11-6. 생성/수정 파일 목록 (developer B — 화면)

| 구분 | 파일 |
|---|---|
| 생성 | `src/components/speech/{OnDeviceModelCard.tsx, ModelProgress.tsx, ModelDeleteSheet.tsx, useOnDeviceModel.ts, modelCopy.ts}` |
| 생성 | `src/components/shell/{AppUpdateBanner.tsx, AppUpdateSheet.tsx, useAppUpdate.ts, appUpdateCopy.ts, routes.ts}` · `src/components/settings/{AppVersionRow.tsx, OnDeviceDiagnosticsCard.tsx}` · `src/components/talk/SttRouteRow.tsx` · `src/components/common/useNativeEnv.ts` |
| 생성 | `src/app/(auth)/login/AppLoginArea.client.tsx` · `src/app/(auth)/invite/InviteReturn.client.tsx` |
| 생성(테스트) | `src/components/speech/__tests__/modelCopy.test.ts`(상태·방식별 문구·크기 표기) · `src/components/shell/__tests__/appUpdateStore.test.ts`(판정 3종·하루 1회·새 번호면 다시·집중 화면 숨김·강제는 늘·#8 실패 hidden·`getAppInfo` 없음 hidden) · `src/components/speech/__tests__/sttCopy.test.ts` 보강(경로 한 줄 9종·MIC_DENIED 앱 버튼 유무·MODEL_REQUIRED·switched·offlineMode) |
| 수정 | `src/components/settings/SpeechSettings.tsx`(카드 삽입·방식 설명·앱 오프라인 비활성 규칙) · `src/app/(app)/settings/page.tsx`(`AppVersionRow` · 관리자 행 아래 `<OnDeviceDiagnosticsCard show={showConsole} />`) · `src/app/(app)/layout.tsx`(그리드 첫 행 `AppUpdateBanner`) · `src/components/shell/TabBar.tsx`(`FOCUS_ROUTE_PREFIXES` import) |
| 수정 | `src/components/speech/{sttCopy.ts, MicTestCard.tsx(경로 한 줄·권한 버튼·MODEL_REQUIRED), micPreflight.ts(앱 권한·OFFLINE 은 GATEWAY 만), sttUiState.ts('rationale'·MODEL_REQUIRED), useRealtimeStt.ts(route 노출)}` · `src/components/talk/{SttAlert.tsx, TalkRoom.tsx(route·switched 토스트는 announce·메뉴 extra 에 SttRouteRow)}` |
| 수정 | `src/app/(auth)/login/{page.tsx(AppLoginArea·강제 띠·하단 안내 앱 줄·오류 문구·ink3→ink2), GoogleLoginButton.client.tsx(bridge 사용·phase props), AppDeepLink.client.tsx(onExchanging 콜백)}` · `src/app/(auth)/invite/InviteForm.client.tsx`(appRedirect 뒤 `InviteReturn`) · `src/components/common/{api.ts(X-App-Version), format.ts(formatMB)}` |
| (범위 밖·참고, developer B 모듈) | `src/modules/infra/native/bridge.ts`(§11-4 신규 6개) · `src/modules/speech/stt/client/{onDeviceModel.ts, OnDeviceSherpaClient.ts, index.ts(라우터), types.ts(route·MODEL_REQUIRED)}` |
| (범위 밖·참고, developer A) | `public/app-shell/index.html`(§11-2 H) · `capacitor.config.ts` `server.errorPath` · 플러그인 추가 메서드·오류 코드(§11-11 ①) |
| 테스트 도구(번들 밖) | `tests/live/fake-capacitor.js`(가짜 `window.Capacitor`, §11-7 ⑨) · `tests/live/task003f-ui-e2e.mjs` |

### 11-7. 구현 순서

1. bridge 신규 함수 + 단위 테스트용 가짜 플러그인(`src/modules/speech/stt/client/__tests__/fakeSherpa.ts`) — 모든 함수가 "없으면 조용히"인지 테스트.
2. `onDeviceModel` 스토어(+테스트: §11-3 B 표 전 행) → 라우터 `route`·전환 카운터(+테스트: §11-3 C 표) — Leader's Plan 완료 기준 5 와 같은 묶음.
3. 문구(`modelCopy`·`sttCopy` 보강·`appUpdateCopy`) + `formatMB` + `useNativeEnv`.
4. `OnDeviceModelCard`·`ModelProgress`·`ModelDeleteSheet` → `SpeechSettings` 결합(방식 설명·오프라인 규칙).
5. 권한 흐름(F): `micPreflight`·`MicTestAlert`·`SttAlert` 버튼 → 경로 한 줄(C) → 회화방 전환 안내·메뉴 한 줄(D).
6. `appUpdateStore`(+테스트) → `AppUpdateBanner`·`AppUpdateSheet`·`AppVersionRow` → 셸·로그인 배치 → `OnDeviceDiagnosticsCard`(관리자만).
7. `AppLoginArea`(E)·`InviteReturn`.
8. (developer A) `app-shell/index.html`·`errorPath` — 첫 `assembleDebug` 전에.
9. **PC 에서 앱 모드 렌더(완료 기준 7)** — 가짜 `window.Capacitor`:
   - `tests/live/fake-capacitor.js` 를 Playwright `context.addInitScript({ path })` 로 넣는다(페이지 스크립트보다 먼저 실행 → `isNativeApp()` 가 `true`). `src/` 밖이라 번들에 들어가지 않는다. **앱 코드에 개발용 스위치·쿼리 파라미터를 만들지 않는다.**
   - 가짜 구성: `isNativePlatform: () => true` · `Plugins.App{ getInfo → {version, build}, addListener('resume'), getLaunchUrl → null }` · `Plugins.Browser{ open(호출 기록), close, addListener('browserFinished') }` · `Plugins.SherpaStt{ checkPermissions, requestPermissions, checkModel({verify}), downloadModel(타이머로 downloadProgress, cancelDownload 면 DOWNLOAD_CANCELLED reject), cancelDownload, deleteModel, preload, start/stop/cancel(level·vad·고정 partial·final), release, deleteWav, getDiagnostics, openAppSettings(호출 기록 — §11-11 ① 반영 전엔 빼서 "버튼 없음" 경로도 찍는다), addListener }` — 메서드·이벤트·오류 코드 이름은 **A 계약 v1 표 그대로**(가짜와 진짜가 갈라지지 않게).
   - 조종: `window.__fakeCap.set({ appBuild: 1, perm: 'prompt'|'rationale'|'denied'|'granted', model: 'absent'|'partial'|'installed'|'outdated', network: 'wifi'|'metered', diag: {…} })` · `__fakeCap.emit('resume')` · `__fakeCap.emit('browserFinished')` · `__fakeCap.failNext('INSUFFICIENT_STORAGE'|'DOWNLOAD_FAILED'|'OFFLINE'|'APP_UPDATE_REQUIRED'|'MANIFEST_INVALID'|'DECODE_FAILED'|'AUDIO_INIT_FAILED'|'MODEL_MISSING')` · `__fakeCap.progress(ratio)` · `__fakeCap.calls`(호출 기록).
   - 서버 응답: api.ts 가 `X-Client-Platform: app` 을 붙이므로 개발 DB 에 ONDEVICE 연결이 있으면 #19 가 실제 `onDevice` 를 준다. 없거나 상태를 고정하려면 `page.route('**/api/v1/speech/config')`·`page.route('**/api/app/version')` 로 응답을 바꾼다(띠 3종: `latestCode` = 내 번호 / 내 번호 + 1 / `minSupportedCode` = 내 번호 + 1).
   - 찍을 것(360·390·412 각각): 카드 상태(absent·needsConsent·downloading·paused·installed·installed+새 버전·error 4종) · 권한 `rationale`·`denied`(+[앱 설정 열기] 호출 기록) · 경로 한 줄 · 띠 권장/강제·시트 · 앱 버전 줄 · 로그인 waiting·closed·exchanging · 회화방 메뉴 한 줄.
   - **웹 회귀**: 가짜 없이 같은 화면 → `#ondevice-card`·`[data-app-update]`·앱 버전 줄·메뉴 "알아듣는 곳"·로그인 대기 요소 DOM 0, `/api/app/version` 요청 0.
10. 실기기(F6, 사용자 폰) — §11-9 끝 목록.

### 11-8. 한국어 UI 문구

ⓐ **휴대폰에서 알아듣기 카드**(`modelCopy.ts`)

| 자리 | 문구 |
|---|---|
| 제목 | 휴대폰에서 알아듣기 |
| 뱃지 | 받지 않음 · 받는 중 · 멈춤 · 준비됨 · 쓸 수 없음 · 문제 있음 |
| 설명(absent·needsConsent·downloading·paused) | 휴대폰 안에서 바로 알아들어요. 말하는 동안 소리를 서버로 보내지 않아서 인터넷이 느려도 빨라요. |
| 받기 전 안내(absent) | 받기 전에도 회화는 서버에서 알아들어요. |
| 메타(absent) | 약 {size} · Wi-Fi 에서 받아요 |
| 버튼 | 휴대폰에 받기 (약 {size}) · 데이터로 받기 · 나중에 · 일시정지 · 이어받기 · 받은 것 지우기 · 새 버전 받기 · 지우기 |
| needsConsent | 지금은 Wi-Fi 가 아니에요. / 모바일 데이터로 약 {size} 를 쓰게 돼요. Wi-Fi 에 연결한 뒤 다시 누르거나, 지금 받을 수 있어요. |
| downloading | 받는 중… {p}% · {got} / {size} · 남은 시간 약 {n}분 / 1분 안에 끝나요 · (무진행 10초) 받는 속도가 느려요. Wi-Fi 연결을 확인해 주세요. |
| downloading 안내 | 받는 동안에도 회화는 서버에서 알아들어요. 다른 화면으로 가도 계속 받아요. |
| 새 버전 받는 중 제목 | 새 버전 받는 중… |
| verifying | 받은 파일을 확인하는 중… |
| paused | 멈춤 · {got} / {size} 받음 |
| 오프라인(버튼 아래) | 인터넷에 연결되면 받을 수 있어요. |
| installed 경로 줄 — 자동·빠르게 | 휴대폰에 받아 두었어요. 회화와 마이크 테스트에서 휴대폰으로 알아들어요. |
| — 정확하게 | 휴대폰에 받아 두었어요. 지금 방식(정확하게)에서는 서버에서 알아들어요. |
| — 오프라인 | 휴대폰에 받아 두었어요. 서버로 바꾸지 않고 휴대폰에서만 알아들어요. |
| — 전환 중(오류 2회) | 이번에는 휴대폰 인식이 잘 안 돼서 서버에서 알아듣고 있어요. 앱을 다시 켜면 휴대폰부터 써요. |
| — 강제 업데이트 중 | 앱을 업데이트하면 다시 휴대폰에서 알아들어요. 그동안은 서버에서 알아들어요. |
| — 서버가 꺼 둠 | 지금은 서버에서 알아들어요. |
| installed 메타 | {size} 사용 중 |
| 새 버전 안내 | 새 버전이 있어요(약 {size}). 받는 동안에도 지금 버전으로 알아들어요. |
| off | 지금은 휴대폰에서 알아듣기를 쓸 수 없어요. 서버에서 알아들어요. |
| 알아 두세요(absent·installed) | 회화에서 다 말한 문장은 대화 기록과 ‘내 목소리 다시 듣기’를 위해 서버에 저장돼요(30일 뒤 자동 삭제). 마이크 테스트는 저장하지 않아요. |
| 오프라인 방식 지우기 막힘 | 오프라인 방식에서는 지울 수 없어요 — 먼저 다른 방식을 골라 주세요. |
| 낭독(25·50·75·100%) | 4분의 1 받았어요 · 절반 받았어요 · 4분의 3 받았어요 · 다 받았어요. 확인하는 중이에요 |
| 완료(카드 안 role=status 1회) | 준비됐어요. 이제 휴대폰에서 알아들어요. |
| 토스트 | 휴대폰 인식 파일을 지웠어요 · 새 버전으로 바꿨어요 |

ⓑ **카드 오류**(`ModelAlert` — 1줄 무엇 · 2줄 어떻게 · 버튼 1개)

| 화면 코드 | 플러그인 코드(A 계약 v1) · 원인 | 1줄 | 2줄 | 버튼 |
|---|---|---|---|---|
| INSUFFICIENT_STORAGE | `INSUFFICIENT_STORAGE` — 여유 < 파일 크기×2.5 | 휴대폰 저장 공간이 부족해요. | 여유 공간이 약 {need} 필요해요. 사진이나 앱을 정리한 뒤 다시 눌러 주세요. | 다시 받기 |
| OFFLINE | `OFFLINE` · 받는 중 `navigator.onLine=false` | 인터넷에 연결되어 있지 않아요. | 받은 부분은 남아 있어요. 연결되면 이어서 받을 수 있어요. | 이어받기(오프라인이면 disabled) |
| DOWNLOAD_FAILED | `DOWNLOAD_FAILED` — 연결 끊김·타임아웃·파일 확인 실패 | 파일을 다 받지 못했어요. | 다시 누르면 받을 수 있는 곳부터 이어서 받아요. 계속 안 되면 잠시 뒤에 해 보세요. | 이어받기 |
| SERVER | `MANIFEST_INVALID` · `ORIGIN_NOT_ALLOWED` · `DOWNGRADE_REFUSED` · #19 실패 | 지금은 파일을 받을 수 없어요. | 잠시 후 다시 시도해 주세요. 그동안은 서버에서 알아들어요. | 다시 시도 |
| APP_UPDATE_REQUIRED | `APP_UPDATE_REQUIRED` — 새 파일이 새 앱을 요구 | 새 앱에서만 받을 수 있는 버전이에요. | 앱을 업데이트한 뒤 받아 주세요. | 설치 방법(→ `AppUpdateSheet`) |
| MODEL_CORRUPT | 세션 `MODEL_CORRUPT` → `checkModel({verify:true})` 로 확인 | 휴대폰 인식 파일이 손상됐어요. | 다시 받아 주세요. 그동안은 서버에서 알아들어요. | 다시 받기 |
| (그 밖) | 알 수 없는 코드 | 파일을 받지 못했어요. | 다시 눌러 주세요. | 다시 시도 |

- 오류가 아닌 코드: `NETWORK_NOT_ALLOWED` → `needsConsent` · `DOWNLOAD_CANCELLED` → `paused` · `DOWNLOAD_IN_PROGRESS` → 다시 확인(이미 받는 중). 서버 `message`·플러그인 `err.message`(개발용 영문)는 그리지 않는다.

ⓒ **지우기 시트** — 제목 "휴대폰 인식 파일 지우기" · 본문 "지우면 저장 공간 약 {size} 가 비어요. 회화는 서버에서 알아들어요." · 보조 "다시 쓰려면 약 {size} 를 또 받아야 해요." · 버튼 "지우기" / "지우는 중…" / "취소" · 실패 "지우지 못했어요. 다시 눌러 주세요."

ⓓ **인식 방식 설명**(`SpeechSettings` MODES — 라벨 그대로)

| 값 · 라벨 | 앱 | 앱 · 파일 없음 | 웹 |
|---|---|---|---|
| AUTO 자동(권장) | 휴대폰에서 알아듣고, 안 되면 서버에서 알아들어요 | 파일을 받기 전에는 서버에서 알아들어요 | 서버에서 알아들어요(앱에서는 휴대폰에서도 알아들어요) |
| FAST 빠르게 | 휴대폰에서 바로 알아들어요 | 파일을 받기 전에는 서버에서 알아들어요 | 웹에서는 서버에서 알아들어요(앱에서는 휴대폰에서) |
| ACCURATE 정확하게 | 서버에서 한 번 더 확인해요(조금 느려요) | 같음 | 같음 |
| OFFLINE 오프라인 | 서버로 바꾸지 않고 휴대폰에서만 알아들어요(선생님 대답에는 인터넷이 필요해요) | (비활성) 휴대폰 인식 파일을 받은 뒤 고를 수 있어요 | (비활성) 앱에서만 쓸 수 있어요 |

ⓔ **경로 한 줄**(`pathCaption(route)` — 마이크 테스트) · 메뉴 이유 줄(짧은 꼴)

| route | 마이크 테스트 | 회화방 메뉴 이유 줄 |
|---|---|---|
| WEB | 지금은 서버에서 알아들어요. | (웹엔 메뉴 줄 없음) |
| ONDEVICE · READY | 지금은 휴대폰에서 알아들어요. | — |
| ONDEVICE · MODE_OFFLINE | 지금은 휴대폰에서만 알아들어요(오프라인 방식). | 오프라인 방식 |
| GATEWAY · MODEL_ABSENT | 지금은 서버에서 알아들어요. 휴대폰 인식 파일을 받으면 휴대폰에서 알아들어요 — 위에서 받을 수 있어요. | 휴대폰 인식 파일을 받기 전이에요 |
| GATEWAY · MODEL_DOWNLOADING | 지금은 서버에서 알아들어요. 휴대폰 인식 파일을 받는 중이에요. | 휴대폰 인식 파일을 받는 중이에요 |
| GATEWAY · MODE_ACCURATE | 지금은 서버에서 알아들어요(정확하게 방식). | 정확하게 방식 |
| GATEWAY · ONDEVICE_FAILED | 휴대폰 인식이 잘 안 돼서 이번에는 서버에서 알아들어요. 앱을 다시 켜면 휴대폰부터 써요. | 휴대폰 인식이 잘 안 돼서 바꿨어요 |
| GATEWAY · UPDATE_REQUIRED | 지금은 서버에서 알아들어요. 앱을 업데이트하면 휴대폰에서 알아들어요. | 앱 업데이트가 필요해요 |
| GATEWAY · SERVER_DISABLED | 지금은 서버에서 알아들어요. | — |

ⓕ **회화방 · 마이크 테스트 추가 오류**

| 자리 | 문구 |
|---|---|
| 메뉴 줄 라벨 · 값 · 링크 | 알아듣는 곳 · 휴대폰에서 / 서버에서 · 음성 인식 설정 › |
| 전환 토스트(1회) | 휴대폰 인식이 잘 안 돼서 서버에서 알아들을게요. |
| ENGINE_ERROR 2줄 — 전환 순간(`switched`) | 다음부터는 서버에서 알아들어요. 다시 눌러 말해 주세요. |
| ENGINE_ERROR 2줄 — 오프라인 방식 | 오프라인 방식이라 서버로 바꾸지 않아요. 다시 말하거나 글자로 대화해 주세요. |
| MODEL_REQUIRED(회화방) | 휴대폰 인식 파일이 없어요. / 설정 → 음성 인식에서 받거나 다른 방식을 골라 주세요. · [설정 열기] [글자로 대화하기] |
| MODEL_REQUIRED(마이크 테스트) | 휴대폰 인식 파일이 없어요. / 위에서 파일을 받거나 다른 방식을 골라 주세요. |

ⓖ **앱 마이크 권한**(§8-8 ⓐ MIC_DENIED 의 앱 줄을 이것으로 바꾼다)

| 자리 | 문구 |
|---|---|
| rationale(누르기 전 상태 줄) | 말을 알아들으려면 마이크가 필요해요. 누르면 다시 물어봐요. |
| MIC_DENIED 1줄 | 마이크 사용이 막혀 있어요. |
| MIC_DENIED 2줄(버튼 있음) | 앱 설정 → 권한 → 마이크 → ‘앱 사용 중에만 허용’을 골라 주세요. |
| MIC_DENIED 2줄(버튼 없음) | 휴대폰 설정 → 애플리케이션 → {APP_LABEL} → 권한 → 마이크 → ‘앱 사용 중에만 허용’을 골라 주세요. |
| 버튼 | 앱 설정 열기 |
| 돌아와 허용됨(힌트) | 마이크를 허용했어요. 이제 버튼을 누른 채로 말해 보세요.(§8-8 ⓒ 그대로) |
| 웹(변경 없음) | 주소창 왼쪽 아이콘(사이트 정보) → 권한 → 마이크 → 허용으로 바꾼 뒤 다시 눌러 주세요. |

ⓗ **업데이트**(`appUpdateCopy.ts`)

| 자리 | 문구 |
|---|---|
| 권장 띠 | Lingofy Japanese v{latest} / 새 버전이 나왔어요 · 눌러서 설치 방법 보기 · [받기] · ✕ `aria-label` "오늘은 그만 보기" |
| 강제 띠 | Lingofy Japanese를 업데이트해 주세요 / 이 버전(v{mine})은 더 이상 지원하지 않아요. 일부 기능이 멈출 수 있어요. · [업데이트] |
| 시트 제목·머리 | Lingofy Japanese 업데이트 · v{mine} → v{latest} · {M월 D일} 올라온 버전 · 약 {size} |
| 시트 절 | 바뀐 점 · 설치 방법 |
| 설치 방법 1 | [업데이트 받기]를 누르면 Chrome 창에서 파일을 받아요. |
| 설치 방법 2 | 다 받으면 알림(또는 Chrome ‘다운로드’)에서 받은 파일을 눌러요. |
| 설치 방법 3 | ‘출처를 알 수 없는 앱’ 설치를 물으면 Chrome 을 허용해 주세요(처음 한 번만). |
| 설치 방법 4 | [업데이트]를 누르면 끝나요. 로그인과 받아 둔 휴대폰 인식 파일은 그대로 남아요. |
| 버튼 | 업데이트 받기 · Chrome 창에서 받는 중이에요(3초) · 나중에 |
| 설치 실패 안내 | ‘앱이 설치되지 않았습니다’가 나오면 기존 앱을 지우고 다시 설치해야 해요. 이때는 로그인과 휴대폰 인식 파일 받기를 다시 해야 해요. |
| 열기 실패 | Chrome 창을 열지 못했어요. 잠시 후 다시 눌러 주세요. |
| 앱 버전 줄 | Lingofy Japanese v{mine} / 일본어가 자연스러워지는 AI 회화 · 최신 / 새 버전 {latest} › / 업데이트 필요 › |

ⓘ **로그인**(오류 문구는 웹·앱 공통, 해요체로 교체 — `ERROR_MESSAGES`)

| 자리 | 문구 |
|---|---|
| opening | Chrome 창을 여는 중… |
| waiting | Chrome 창에서 로그인하고 있어요 / 로그인이 끝나면 이 화면으로 자동으로 돌아와요. / [Chrome 창 다시 열기] |
| exchanging | 로그인 마무리 중… |
| closed | 로그인 창이 닫혔어요. 다시 눌러 주세요. |
| 하단 안내 둘째 줄(앱에서만) | 앱에서는 Chrome 창에서 로그인한 뒤 자동으로 돌아와요. |
| `cancelled` | Google 로그인을 취소했어요. |
| `email_unverified` | 이 Google 계정은 이메일 확인이 끝나지 않았어요. |
| `invalid_state` | 로그인 요청 시간이 지났어요. 다시 눌러 주세요. |
| `not_configured` | 서버에 Google 로그인이 아직 준비되지 않았어요. 관리자에게 알려 주세요. |
| `app_code_invalid`(만료·재사용·확인값 불일치 — 서버가 구분하지 않음) | 로그인을 마무리하지 못했어요. 다시 눌러 주세요. |
| `account_conflict` | 이 이메일로 이미 다른 계정이 있어요. 관리자에게 알려 주세요. |
| `failed`(그 밖) | 로그인하지 못했어요. 다시 눌러 주세요. |
| 초대 뒤(Custom Tab) | 앱으로 돌아가는 중… / 앱이 열리지 않으면 아래 버튼을 눌러 주세요. / [앱으로 돌아가기] / 1분이 지나면 이 창을 닫고 앱에서 다시 로그인해 주세요. |

ⓙ **서버 연결 실패 화면**(APK 자산) — Lingofy Japanese · 일본어가 자연스러워지는 AI 회화 · 서버에 연결하지 못했어요 · 인터넷 연결을 확인한 뒤 다시 시도해 주세요. · [다시 시도] · 계속 안 되면 서버가 점검 중일 수 있어요.

ⓚ **휴대폰 인식 진단(관리자만)** — 제목 "휴대폰 인식 진단" · 보조 "관리자에게만 보여요" · 행 라벨 "인식기 / 불러오기 시간 / 최근 발화 / 메모리 / 파일 버전 / 앱 구성" · 값 "불러옴 · 스레드 {n} / 안 불러옴 · {s}초 · {d}초 말함 → {t}초 만에 알아들음 / 아직 없음 · 앱 {rss}MB · Java {heap}MB · 플러그인 {v} · {abi}" · 뱃지 "기준 초과"(bad) · 버튼 "다시 읽기 / 미리 불러오기 / 불러오는 중…" · 안내 "측정값은 이 휴대폰 안에만 있어요. 서버로 보내지 않아요." · 읽기 실패 "진단 값을 읽지 못했어요. 다시 눌러 주세요."

### 11-9. 360/390/412 · 접근성 체크리스트

- [ ] **웹 DOM 0**: PC Chrome(가짜 없음)에서 `#ondevice-card`·`[data-app-update]`·앱 버전 줄·메뉴 "알아듣는 곳"·로그인 대기 요소·진단 카드 0, `/api/app/version` 요청 0. 서버 렌더 HTML 에도 없음.
- [ ] **USER 진단 카드 0**: 가짜 bridge + USER 계정 → 진단 카드 DOM 0 / 관리자 계정 → 보임.
- [ ] 360: 카드 안쪽 ≈298px — 제목(`min-w-0 flex-1`)+뱃지(`flex-none`) 한 줄, "휴대폰에 받기 (약 170MB)" 한 줄, 진행 숫자 줄 `tabular-nums` 로 흔들림 없음, BtnRow 두 버튼("데이터로 받기"·"나중에")이 반씩 들어감.
- [ ] 360: 권장 띠 = 막대 3 + 글자 열(truncate) + [받기] + ✕44, 가로 넘침 0. 강제 띠 글자 두 줄 줄바꿈(`break-keep`), [업데이트]가 줄지 않음.
- [ ] 390×780(앱 WebView 폭): 강제 띠가 있어도 회화방 입력 바·목록이 보이고 세로 스크롤은 목록 한 곳. 권장 띠는 회화방에서 안 보임.
- [ ] 진행 막대 `role=progressbar` + `aria-valuetext`, 낭독은 25% 단위만. `prefers-reduced-motion`: 막대 폭 전환·스피너 회전 없음.
- [ ] 모든 버튼 ≥44px(띠 [받기]는 보이는 38 + `before:` 히트). 텍스트 버튼("받은 것 지우기"·"앱 설정 열기"·"음성 인식 설정 ›")은 h-11.
- [ ] 색만으로 구분하지 않음: 뱃지 글자, 강제 띠 = 빨강 + 제목 글 + ✕ 없음, 멈춤 = "멈춤" 글자.
- [ ] 명암비: 뱃지는 `good`/`bad`/`neutral` 만, 띠 글자 `ink`/`ink2`/`bad`(on `bad-soft` 5.32) — `warn`·`accent` 톤 뱃지 글자 0(§1-1). 로그인 하단 안내 `ink3` → `ink2`. 다크 모드 토큰만(연결 실패 화면은 hex 두 벌).
- [ ] 시트(`ModelDeleteSheet`·`AppUpdateSheet`): 하단 safe-area, 내부 스크롤 한 곳(바뀐 점이 길 때), Esc·배경 탭으로 닫힘(제출 중 제외), 닫으면 여는 버튼으로 포커스 복귀.
- [ ] 로그인 덮개 `role=status` 한 번 낭독, 덮개 중 뒤 버튼 포커스 불가(덮개가 전부 가리고 `inert`).
- [ ] 권한 띠 [앱 설정 열기] 포커스 링, TalkBack 이 1줄·2줄·버튼 순으로 읽음.
- [ ] 전환 토스트는 녹음 중에 뜨지 않음(§9-2 D `announce`).
- [ ] 가짜 bridge 스크린샷 세트(§11-7 ⑨) 360/390/412.
- **실기기(F6, 사용자 폰 — QA 는 NOT_VERIFIED 로 남기고 요청 목록으로)**: ① Wi-Fi 받기 진행률·일시정지·앱 강제 종료 뒤 이어받기·모바일 데이터 동의 ② 받은 뒤 다음 누름부터 휴대폰(마이크 테스트 경로 줄) ③ 지우기 → 서버 ④ 권한 거절 2번 → [앱 설정 열기] → 허용 후 돌아오면 띠 사라짐 ⑤ 로그인 대기 카드 → 완료 복귀 / 창 닫고 복귀 → "닫혔어요" ⑥ 띠 권장·강제(AppRelease 행은 deployer)·Chrome 다운로드·설치·로그인 유지 ⑦ 서버 차단 시 연결 실패 화면 ⑧ 상태바·키보드와 띠·카드 겹침 없음.

### 11-10. 주의사항

- **엔진명 0**: 카드·띠·시트·토스트·`aria-label`·`console` 에 `reazon`·`sherpa`·`zipformer`·`onnx`·`int8`·모델 버전 문자열·manifest 경로·`connectionKey` 를 싣지 않는다. 사용자 말은 "휴대폰 인식 파일"·"휴대폰에서 / 서버에서"뿐.
- **정직성**: "목소리가 서버로 가지 않아요" 금지(§11-0 ⑤). "오프라인"은 알아듣기만 인터넷 없이 된다는 뜻 — 선생님 대답에는 인터넷이 필요하다고 방식 설명에 적는다.
- **자동 다운로드 금지**: 마운트·resume·`online` 에서 `downloadModel` 을 부르지 않는다(이어받기도 누를 때만). 스토어는 확인(`checkModel`)만 한다.
- **모바일 데이터**: `wifiOnly:true` 가 기본. 동의는 이번 앱 실행 동안만, 저장소에 남기지 않는다.
- **빈 상태·로딩**: #19 가 늦어도 카드는 `checking` 문구만 — 설정 화면 다른 카드를 막지 않는다. 플러그인 호출이 3초 안에 안 오면 `absent` 로 보이고 누를 때 다시 확인.
- **오프라인**: 휴대폰 경로의 마이크 테스트는 되고(OFFLINE 사전 점검 제외), 받기 버튼은 막힌다. 회화방은 기존 규칙(턴에는 인터넷 필요).
- **권한 상태 저장 금지**: 늘 네이티브에 다시 묻는다. 돌아온 것만으로 녹음 시작 금지.
- **APK 받기**: `fetch`·`<a download>`·blob 금지. Custom Tabs(`openExternal`)로 연다. A 가 `MainActivity` 에 DownloadListener(→ 시스템 브라우저)를 둔다고 했으므로 `openExternal` 이 `false` 일 때만 `location.href = url` 로 넘긴다(그 경우도 시스템 브라우저가 받는다). URL 은 같은 출처 `/app/download/` 만. `notes` 는 글자로만 그린다(`dangerouslySetInnerHTML` 금지).
- **띠 호출 최소**: #8 은 앱 실행 1회 + 6시간 넘은 resume. 웹에서는 부르지 않는다(`getAppInfo()` 가 `null` 이면 끝).
- **로그인 코드 1회용**: 딥링크 중복(리스너·콜드 스타트) 처리는 기존 `handled` ref 그대로. 대기 카드가 딥링크 처리를 막지 않는다.
- **테스트 흔적 금지**: `window.__fakeCap`·가짜 스크립트는 `tests/live/` 에만. `src/` 에 `?native=1` 같은 스위치를 만들면 reviewer 반려.
- **네이티브 변경 고지**: `app-shell/index.html`·`errorPath`·플러그인 메서드 추가는 APK 에 들어간다 — 첫 빌드 전에 끝내고, 이후 바뀌면 versionCode 증가(CLAUDE.md 금기).

### 11-11. Leader 확인 요청

| # | 항목 | 화면이 가정한 것 | 틀리면 |
|---|---|---|---|
| ① | **플러그인 계약 v1(Developer A, 08:58)에 더 필요한 것** | v1 이 이미 준 것으로 화면을 맞췄다(`checkModel` 의 `downloading`·`pendingBytes` · `cancelDownload`(조각 유지) · `deleteModel` · `getDiagnostics` · 오류 코드 전부). **남은 요청 2개**: ⓐ `openAppSettings()`(`Settings.ACTION_APPLICATION_DETAILS_SETTINGS` + `package:` URI — 영구 거절 권한 띠의 [앱 설정 열기]) ⓑ (선택) `checkModel()` 반환에 `freeBytes` — 누르기 전에 저장 공간 부족을 보이려고. 그리고 **확인 1개**: 계약 #9 의 `MODEL_CHECKSUM` 은 v1 에서 `DOWNLOAD_FAILED` 로 합쳐졌다고 보고 문구를 일반화했다 | ⓐ 없으면 권한 띠는 경로 문구만(버튼 없음 — 동작은 됨) · ⓑ 없으면 부족을 누른 뒤에 앎 · 코드가 따로 있으면 §11-8 ⓑ 에 한 행 추가 |
| ② | **#19 가 방식 때문에 `onDevice.enabled=false` 일 때 모델 정보** | 지금 구현(`stt/config.ts`)은 경로가 GATEWAY 로 풀리면(정확하게 방식 등) `onDevice:{enabled:false}` 만 줘서 카드가 크기·manifest 를 모른다. 가정: 앱 + ONDEVICE 연결이 있으면 `onDevice:{ enabled:false, available:true, model:{…} }` 처럼 **모델 블록은 늘** 싣는다(`enabled` 는 경로 선택만 뜻함) | 정확하게 방식에서 카드가 "이 방식에서는 쓰지 않아요"만 보이고 받기 불가(설치돼 있으면 지우기만) |
| ③ | **#8 버전 비교 단위** | 계약 예시 `minSupported:"1.1.0"`(문자열) ↔ `AppRelease.minSupported Int`(versionCode). 화면은 **번호(versionCode)로만** 비교: 응답에 `minSupportedCode:Int` 추가(이미 있는 `latestCode` 와 짝), `X-App-Version` 은 versionName 그대로, 앱 번호는 `App.getInfo().build`. 시트용 `bytes`(APK 크기)는 선택 | 문자열 비교면 `1.10.0 < 1.9.0` 류 오판. `bytes` 없으면 시트에서 크기 생략 |
| ④ | **강제 업데이트의 세기** | 정본 "차단 배너(닫기 불가)"를 **닫을 수 없는 띠 + 모든 화면**으로 해석, 앱 사용은 막지 않는다. 대신 강제 상태에선 휴대폰 경로를 끄고 서버로(`UPDATE_REQUIRED`) — 옛 플러그인과 새 웹의 계약 어긋남 방지 | 전면 차단(업데이트 전 아무것도 못 함)을 원하면 사용자 결정 — 띠 컴포넌트를 재사용한 전체 화면 `AppUpdateBlocker` 로 바꾼다 |
| ⑤ | **앱 이름(권한 경로 문구)** — **결정 갱신(task-003h, 사용자 2026-09-28): "Lingofy Japanese", 부제 "일본어가 자연스러워지는 AI 회화"** | 안드로이드 설정에 보이는 이름 = 런처 라벨(`strings.xml app_name`) = `capacitor.config.ts appName` = 화면 상수 `APP_NAME`(`src/components/common/brand.ts`, `APP_LABEL` 은 그 별칭) = 웹 매니페스트·탭 제목·연결 실패 화면. 로그인 글자 로고는 "Lingofy **Japanese**"(360~412 에서 두 줄). 기술 식별자(appId `com.miraclepenguin.kaiwa`·`thekaiwa://`·쿠키·도메인·저장소·APK 저장 이름 `thekaiwa-*.apk`)는 그대로 — 받는 파일 이름만 `LingofyJapanese-{ver}.apk` | 이름을 또 바꾸면 `brand.ts` + 빌드 밖 자산 4곳(strings.xml·capacitor appName·manifest.webmanifest·app-shell)을 함께 바꾸고 APK versionCode 를 올린다(`brand.test.ts` 가 넷의 일치를 본다) |
| ⑥ | **`getSherpaStt()` 호출자 2곳** | module-dependency §6 "호출자 = `OnDeviceSherpaClient` 만"에 `speech/stt/client/onDeviceModel.ts`(확인·받기·지우기)를 더한다. 화면은 여전히 플러그인을 직접 보지 않는다(스토어 훅만) | 한 곳만 허용이면 `OnDeviceSherpaClient` 에 모델 관리 정적 메서드를 둔다(파일만 다름) |
| ⑦ | **경로 선택 시점** | speech-platform/12 §3.5 "모델 설치 완료 후 **다음 세션**" 대신 **누를 때마다**(녹음 중 아닐 때) 고른다 — 받자마자 마이크 테스트로 확인할 수 있게. 전환 카운터만 앱 실행 단위 | 세션 단위로 두면 받은 뒤 화면을 떠났다 와야 휴대폰 경로가 되고, 경로 줄이 "받았는데 서버"로 보인다 |
| ⑧ | **manifest 경로의 모델 이름** | 현 구현의 #19 `manifestUrl` 은 모델 이름이 든 경로였다. Developer B 작업 중 diff(`stt/config.ts`)가 `model{ id:'ondevice-ja-v1', manifestUrl: 불투명 }` 로 바꾸는 중이라 그대로 가정 — 화면은 어느 쪽이든 그리지 않는다. `version`·`totalBytes` 가 `null`(배포본 없음)이면 카드 `off` | B 가 되돌리면 완료 기준 8 을 "화면 노출 0"으로 해석(#9·#10 은 플러그인 고정 공개 경로) |
| ⑨ | **연결 실패 화면·`errorPath`** | `public/app-shell/index.html` 이 TheMeal 템플릿 그대로(제목·밥 이모지). `capacitor.config.ts` 에 `server.errorPath` 가 없어 서버 불통 때 이 파일이 안 뜰 수 있다(설계안 §12 에는 있음). developer A 가 첫 빌드 전에 둘 다 반영 | 안 하면 불통 때 WebView 기본 오류 화면(영문·주소 노출) 또는 TheMeal 화면 |
| ⑩ | **APK 받기 경로** | Custom Tabs 에서 `Content-Disposition: attachment` APK 를 열면 Chrome 이 받아 알림으로 설치를 이어 준다고 가정(F6 확인). 예비로 A 의 `MainActivity` DownloadListener(→ 시스템 브라우저) | 둘 다 안 되면 네이티브 DownloadManager(플러그인 메서드 — 네이티브 변경) |
| ⑪ | **기존 사용자 앱 로그인의 302** | 콜백이 `thekaiwa://` 로 바로 302 해도 Custom Tab 이 앱을 연다고 가정(워크스페이스 선례). 초대 경로는 사용자 탭 뒤라 확실 | F6 에서 안 열리면 서버가 302 대신 "앱으로 돌아가기" 중간 페이지(§11-2 E 초대 화면과 같은 모양)를 준다 — 서버 변경 |
| ⑫ | `X-Client-Platform` 값 | 계약 §0-10 은 `web \| android`, 구현(api.ts·`platformFrom`)은 `app`. 화면·가짜 bridge 는 구현(`app`)을 따른다 | 정본 표기만 맞추면 된다 |
| ⑬ | **첫 실행 자동 다운로드** | 하지 않는다(누를 때만). 회화 화면에 "받으세요" 권유도 두지 않는다(대화 방해·분기 최소) | 사용자가 원하면: 자동(권장) 방식 + Wi-Fi + 공간 충분일 때 첫 실행에 받기 시작 + 토스트 "휴대폰 인식 파일을 받고 있어요 — 설정에서 볼 수 있어요" |
| ⑭ | 인식 방식 설명 수정 | §11-8 ⓓ — 웹의 "빠르게 = 휴대폰에서"처럼 사실과 다른 설명과 "오프라인 = 인터넷 없이"를 고친다(문구만. 동작은 앱 오프라인 비활성 규칙 하나) | 그대로 두면 웹에서 빠르게를 골라도 서버라서 설명과 다르다 |
| ⑮ | 발화 wav 전달 | A 계약 v1: `convertFileSrc(wavPath)` 를 `fetch` 해 Blob 으로 #21 업로드 → `deleteWav`(VoiceVault 선례). `server.url` 구성에서 되는지는 F6 확인 | 안 되면 휴대폰 경로 턴이 전부 `utteranceId:null`(내 목소리 ▶ 없음) — 이벤트 base64 로 바꾸는 것은 A·B 합의 |
| ⑯ | **휴대폰 인식 진단 카드(관리자만, §11-2 I)** | F6 실측 게이트(5초 발화 디코드 ≤0.8s·RSS ≤600MB)를 사용자가 adb 없이 폰에서 읽게, `engine.read` 보유자 + 앱에서만 설정 맨 아래에 A 의 `getDiagnostics()` + 마지막 발화 시간을 보인다. USER 화면엔 없다 | 필요 없으면 빼고 F6 을 `adb shell dumpsys meminfo` 로(사용자 폰 개발자 옵션·USB 디버깅 필요) |

---

## 12. 오늘의 회화 (task-010)

> **승인 데모: `docs/demo/task-010-today-lesson-v2.html` (v2 · `task-010-v2`, 사용자 승인 2026-09-28 17:54, sha256 `5c9159f5…`)** — 결정 a~d 전부 B. 데모 상태는 주소 `#<id>`(예: `…-v2.html#l1-memo`)로 바로 열린다. 아래 `#id` 는 그 상태를 가리킨다. v2 는 v1 과 화면 내용이 같고 틀 표시 방식만 다르다.
> 정본: `api-contract.md` §2-11 #55 · §2-12 #56 · §2-13 #58~#62·#62a·#62b·#62c · #21·#21b · #28 · #38·#39 — **developer 가 구현한 계약이다. 데모의 합성 데이터와 필드명이 다르면 계약이 정본이다.** task-010 Leader's Plan L1~L12 · PE `lesson@v1/v2` 스키마(`targetIds` = chunks∪grammar id).
> 재사용: §5(오늘 홈·`BackBar`·flash 방식) · §3 `ProposalCard`·`Sheet` · §7 표시등·`ttsAudio` · §8 `PushToTalkButton`·`useRealtimeStt`·`sttCopy`·`MicLevelMeter` · §9 재생 큐(`createTtsPlaybackQueue`)·`chunkFetch`·`SttAlert`·barge-in. 새 색 없음.
> **적용 토큰**(`src/app/globals.css`): `ground` · `surface` · `surface2` · `ink` · `ink2` · `ink3`(placeholder·비활성·장식만) · `line` · `accent` · `accent-soft` · `on-accent` · `good` · `good-soft` · `bad` · `bad-soft` · `--radius`(14px). `warn`·`carb/protein/fat` 는 쓰지 않는다. 글자 색은 §1-1 표를 지킨다 — `accent-soft` 배경 위 글자는 `ink`/`ink2`(추천 상자·다음 시간엔 카드·재생 중 줄).

### 12-0. 한눈에 보는 결정

1. **경로 3개, 모두 하단 탭 숨김**(집중 화면): 주제 고르기 `/study/today/talk/new` · 붙여넣기 `/study/today/talk/new/paste` · 수업 `/study/today/talk/[lessonId]`. 수업 경로 하나가 레슨 `status` 로 **대기(`GENERATING`) / 실패(`FAILED`) / 5단계(`READY`·`IN_PROGRESS`) / 종료 카드(`DONE`)** 를 갈라 그린다(§5 덱·결과와 같은 방식 — 새로고침·재방문·오늘 홈 카드가 한 주소로 끝난다). `routes.ts` `FOCUS_ROUTE_PREFIXES` 에 `/study/today/talk/` 를 더한다.
2. 오늘 홈: "오늘의 회화" 카드는 **오늘의 단어 카드 바로 아래**(결정 c=B)에 두고, "곧 열려요"에는 AI 평가만 남긴다. 카드 상태 8가지(데모 7개 + 준비됨)를 #58 한 번으로 정한다.
3. 5단계는 **순서대로**(결정 a=B): 단계 표시에서 끝낸 단계와 지금 단계만 누를 수 있다. 끝낸 단계는 읽기 전용으로 다시 본다. 진행은 `stageDone`(0~5, 줄지 않음) 하나다.
4. 청취는 **누를 때만 재생**(b=B)하고, **느리게 들을 땐 글자를 가린다**(d=B). 보통 속도로 듣기 시작하거나 [글자 보기]를 누르면 보이고, 자막만(TEXT_ONLY)이면 처음부터 보인다.
5. 소리는 전부 **#62c → 기존 재생 큐**(`createTtsPlaybackQueue` + `fetchChunkAudio` + `playWav`)로 내고, 표시등은 §7 스토어를 그대로 쓴다. 말하기는 **회화방과 같은 `PushToTalkButton`(72px) + `useRealtimeStt`** 다. 새 오디오·음성 인식 경로를 만들지 않는다.
6. 저장: 사용자 행위마다 #61 `progress`(클라이언트 칸만)로 남기고, 단계를 넘길 때 `stageDone` 을 올린다. 들린 단어 → 제안은 #62a, 말하기 판정은 #62b(코드 판정, AI 채점 없음), 완료는 #62(서버 재채점·한 트랜잭션).
7. AI 는 제안만 한다: 들린 단어는 `ProposalCard` 의 [단어장에 추가]를 눌러야 저장된다(#38). 채택 전 단어장 행 0.
8. 엔진명 0: #62c 의 `runtime`·`clips[].url`(서명)·레슨 `error` 코드는 화면·DOM 속성·콘솔에 싣지 않는다.

### 12-1. 화면 개요

| 항목 | 내용 |
|---|---|
| 목적 | 주제(또는 붙여넣은 문장)로 선생님이 만든 5단계 수업(이해 → 문법 → 문제 5 → 응용 3 → 말하기 3)을 하고, 끝나면 기록·반복 항목이 남고 "다음 시간엔" 예고로 다음 수업에 이어진다 |
| 진입 | 하단 탭 "오늘" → 오늘 홈 "오늘의 회화" 카드 → [수업 만들기]·[주제 고르기]·[이어서 하기]·[시작하기]·[보러 가기]·[다음 수업 만들기]·[끝낸 수업 결과 보기] |
| 역할별 가시성 | 로그인 사용자 전원. 타인·없는 레슨·잡은 404 → "이 수업을 찾을 수 없어요"(같은 문구, `#l-404`). 관리자 전용 요소 없음 |
| 앱/웹 분기 | 말하기·말로 쓰기의 인식 경로뿐(§11 라우터가 고른다). 화면 차이는 권한 안내([앱 설정 열기] 등 §11-2 F) 규칙 그대로, 그 외 동일 |
| 하단 탭 | 오늘 홈은 보임, `/study/today/talk/*` 는 전부 숨김 |
| TTS 상태 표시등 | 수업 머리(선생님 아바타 옆) — §7 `TtsRuntimeStatusIndicator` 그대로 |

### 12-2. UI 구조 (의사코드, 390px 기준 — 데모 상태 id 인용)

#### A. 오늘 홈 — `TodayHome` 에 `TodayLessonCard` 끼우기 (`#home-compare`)

```
AppBar "오늘의 공부"
<div className="px-4 pb-8">
  TodayWordsCard          (그대로)
  TodayLessonCard         ← 새로 넣음. Section 간격 18px (결정 c=B)
  VocabStatsCard?  KeptSets?   (그대로)
  TodayComingSoon         ← ITEMS 에서 "오늘의 회화" 를 빼고 "AI 평가" 1개만
</div>
```
- `TodayHome` 은 기존 4개 요청과 **나란히** #58 을 읽는다. #58 은 별도 상태로 두어 단어 쪽 실패와 서로 막지 않게 한다. 화면으로 돌아올 때(`visibilitychange`)마다 기존 tick 으로 함께 다시 읽는다.
- 412×780·390×800·360×740 에서 두 카드의 주 버튼이 모두 첫 화면(탭 바 위)에 들어온다(데모 360 실측: 수업 카드 버튼 하단 ≈730px).

**TodayLessonCard** — `Card` 하나. 머리줄은 `h2 "오늘의 회화"`(15px semibold)이고, 시작 전 상태에서만 오른쪽에 `약 15분`(12px ink2)을 붙인다.

상태는 순수 함수 `deriveLessonCard(today)`(단위 테스트)로 정한다. 표에서 위 줄이 우선한다:

| # | 상태(데모) | 조건(#58) | 내용 |
|---|---|---|---|
| 1 | `loading` (`#home-loading`) | 요청 중 | 머리 + "불러오는 중…"(13px ink2, `role=status`) — **※ task-046 이후: 글자 대신 같은 높이 몸통 자리표시(`CardLoadingBody`)를 그린다. §17 참고** |
| 2 | `error` (`#home-error`) | #58 실패 | `ErrorBlock`(§12-8 ⓐ) + [다시 시도](이 카드만 다시 읽음) |
| 3 | `gen` (`#home-gen`) | `todayLessons` 에 `GENERATING` 이 있음(가장 최근) | "수업을 만들고 있어요"(15px semibold) · "{주제} · 보통 1~2분 걸려요. 다 되면 여기서 열 수 있어요."(13px ink2) · 움직이는 띠(높이 4px `surface2` 위 `accent` 40% 폭, `aria-hidden`, reduced-motion 이면 정지) · [보러 가기](ghost full) → 수업 경로 |
| 4 | `progress` (`#home-progress`) | 오늘 `READY`·`IN_PROGRESS` 중 가장 최근 것, 없으면 `resume` | `stageDone ≥ 1` → "하던 수업이 있어요" / `READY && stageDone 0` → ★"수업이 준비됐어요"(§12-11 ⑤) · "{주제} · {오늘\|M월 D일} 시작 · 5단계 중 {n}단계 끝냄"(준비됨: "{주제} · 5단계 · 약 15분") · `MiniSteps`(5칸) · "다음은 {③ 문제}예요. 단계마다 저장돼요." · [이어서 하기]/[시작하기](primary full) |
| 5 | `genfail` (`#home-genfail`) | `todayLessons[0]`(가장 최근)이 `FAILED` | "수업을 만들지 못했어요" · "{주제} · 다시 만들면 대부분 잘 만들어져요." · BtnRow [다시 만들기](primary) [주제 고르기](ghost) |
| 6 | `done` (`#home-done`) | 오늘 `DONE` 이 있음 | "✓ 오늘 수업을 끝냈어요" · "{주제} · 문제 {c}/5 맞힘"(§12-11 ①) · `recommendation.nextPreview` 가 있으면 "다음 시간엔" 상자(`accent-soft` r12 px-3 py-2.5, 12px ink2 "다음 시간엔" + 14px semibold ink `titleKo`) · BtnRow [다음 수업 만들기](primary) [주제 고르기](ghost) · [끝낸 수업 결과 보기](가운데 밑줄 텍스트 버튼 44px → 가장 최근 DONE 레슨) |
| 7 | `start` (`#home-start`) | 위 어디에도 해당하지 않음 | "선생님과 5단계로 수업해요. 듣기 → 문법 → 문제 → 응용 → 말하기"(13px ink2) · 추천 상자(`surface2` r12 px-3 py-2.5): "추천 주제"(12px ink2) + `Badge neutral {level}`(배경 `surface`) / `{topicTitle}`(15px semibold) / 근거 한 줄(12px ink2, 아래) · BtnRow [수업 만들기](primary) [주제 고르기](ghost) |

- 추천 근거 한 줄(`recommendation.reason`): `CONTINUE` → "지난 시간 예고 · {nextPreview.titleKo}" · `NEXT_TOPIC` → ★"같은 주제를 세 번 했어요 · 새 주제로 넘어가 봐요" · `START` → ★"아직 해 보지 않은 주제예요". `recommendation` 이 null 이면 추천 상자 없이 [주제 고르기](primary full) 하나만 둔다.
- 주제 이름은 `topic.title`, 붙여넣은 수업(`topic: null`)은 "붙여넣은 문장".
- `c`(맞힌 수) = `Math.round(score / 100 × 5)` — 문제는 늘 5개(스키마 고정)이고 점수는 서버가 다시 채점한 값이다.
- `gen` 상태에서는 화면이 보이는 동안 `jobId` 를 5초마다 #55 로 확인하고, `DONE`·`FAILED` 가 되면 #58 을 다시 읽는다(화면이 가려지면 멈춤).
- `MiniSteps`: `grid grid-cols-5 gap-1`, 칸은 h-7 r8 11.5px. 끝낸 칸 `bg-good-soft text-good font-semibold` "이해 ✓", 다음 칸 `bg-surface ring-[1.5px] ring-accent text-ink font-semibold`, 나머지 `bg-surface2 text-ink2`. `aria-label="5단계 중 {n}단계 끝냄"`.

**카드 버튼 동작**

| 버튼 | 동작 |
|---|---|
| [수업 만들기](start) · [다음 수업 만들기](done) | #59 `{topicId: recommendation.topicId}` → `router.push('/study/today/talk/' + lessonId)`. `reused:true` 이고 `status≠GENERATING` 이면 flash "오늘 만든 수업이 있어요. 이어서 할게요." / 409 `GENERATING{lessonId}` → 그 수업으로 push + flash "만들고 있는 수업이 있어요. 끝나면 이어서 할 수 있어요." / 404 → 토스트 "주제를 찾을 수 없어요." / 429 → "잠시 후 다시 눌러 주세요." / 0 → 네트워크 문구 |
| [다시 만들기](genfail) | 같은 요청을 다시 보낸다(#59 `{topicId}` — 서버가 같은 행을 되살림). 붙여넣은 수업이면 `sessionStorage kaiwa.lesson.src.{lessonId}` 의 원문으로 `{sourceText}`, 원문이 없으면 붙여넣기 화면으로 |
| [이어서 하기]·[시작하기]·[보러 가기]·[끝낸 수업 결과 보기] | 수업 경로로 push |
| [주제 고르기] | `/study/today/talk/new` |

- flash 는 §5 와 같은 방식이다: `sessionStorage kaiwa.lesson.flash` 에 문구를 두고, 수업 화면이 마운트될 때 한 번 꺼내 토스트로 보인다.
- 요청 중 버튼은 `aria-busy` + "만드는 중…"이고, 두 번 눌러도 요청은 한 번이다.
- [수업 만들기]의 `aria-label` = "수업 만들기, 추천 주제 {topicTitle}".

#### B. 주제 고르기 `/study/today/talk/new` — `LessonTopicsScreen` (`#topics` · `#topics-sheet` · `#topics-loading` · `#topics-error`)

```
BackBar sticky backHref="/study/today" backLabel="오늘로" title="주제 고르기" subtitle="오늘의 회화"
<div className="flex flex-col gap-[18px] px-4 pt-3.5 pb-8">        ← main 스크롤 1곳
  <p 14px> 안내 (§12-8 ⓑ, 수준은 아래 규칙)
  TopicList          (#56 items 순서 그대로 — 서버가 수준 → 시드 → 만든 순으로 정렬)
  PasteEntryCard     Card: "갖고 있는 문장으로 수업 만들기"(15 semibold) / 설명 13 ink2 / [문장 붙여넣기](ghost full) → /study/today/talk/new/paste
</div>
TopicSheet (Sheet)
```
- 안내 문구의 수준: `page.tsx`(서버)가 `getProfile().level` 을 `myLevel` 로 넘기고, #56 응답 `level[]`(실제로 적용한 수준)에서 `myLevel` 보다 높은 것을 "한 단계 위", 낮은 것을 "한 단계 아래"로 쓴다. 수준이 두 개면 "내 수준({N5})과 한 단계 위({N4})", 세 개면 "내 수준({N4})과 한 단계 위·아래", 하나면 "내 수준({N5})".
- **주제 행** `TopicRow`(`button`, `min-h-[72px] w-full rounded-[14px] border border-line bg-surface px-3.5 py-3 text-left`, `aria-haspopup="dialog"`): 왼쪽 세로 묶음(`min-w-0 flex-1`) — 1줄 `{title}`(15 semibold) + `<span lang=ja class="ml-1.5 text-[13px] text-ink2">{titleJa}</span>` / 2줄 `description`(13 ink2, 두 줄 말줄임) / 3줄 `lessonCount > 0` ? "지난 수업 {n}번 · {M월 D일}"(12 ink2, `lastLessonAt`) : "아직 수업하지 않았어요"(12 `good` semibold). 오른쪽에 `Badge neutral {level}` + `›`(ink3, `aria-hidden`). 행 간격 8px.
- 로딩: 스켈레톤 4칸(`h-[86px] rounded-[14px] bg-surface2`, `aria-hidden`) + sr-only `role=status` "주제를 불러오는 중…". 오류: `ErrorBlock` "주제를 불러오지 못했어요." + [다시 시도]. **붙여넣기 카드는 로딩·오류 중에도 보인다**(다른 길을 남겨 둔다). 빈 목록은 시드 5개가 있어 사실상 없지만, 생기면 `EmptyBlock` "보여 드릴 주제가 없어요. 문장을 붙여넣어 수업을 만들어 보세요."

**TopicSheet**(`Sheet title={title}`, `#topics-sheet`)
```
<p> <span lang=ja 15px>{titleJa}</span>  Badge neutral {level}
<p 14px mt-1> description
<h3 15 semibold mt-3> "이 주제의 표현 {chunks.length}개"
  chunkType 순서(NAME·ACTION·FEELING·MODIFIER)로 묶는다. 묶음 라벨은 §3-8 ⓔ("이름 조각/액션 조각/느낌 조각/꾸밈 조각", 12px ink2)
  칩 `inline-flex items-baseline gap-1.5 rounded-[10px] bg-surface2 px-2.5 py-1.5`: <span lang=ja 15px>{textJa}</span><span 12 ink2>{meaningKo}</span>   (누르는 기능 없음)
(lessonCount>0) 상자 bg-surface2 r12 px-3 py-2.5 13px: "지난 수업 {n}번 · {M월 D일}"
   + (이 주제 = recommendation.topicId && reason CONTINUE) "<b>지난 시간 예고를 이어서 만들어요</b> · {nextPreview.titleKo}"
<p 12 ink2 mt-3> "수업을 만드는 데 1~2분 걸려요. 만들기 시작하면 취소할 수 없어요."
BtnRow [수업 만들기](primary) [닫기](ghost)
```
- 지난 수업 **제목**(데모의 「はじめての注文」)은 #56 에 없어서 싣지 않는다(§12-11 ②).
- 예고 줄은 #58 `recommendation` 을 쓴다. 주제 화면이 마운트될 때 #56 과 #58 을 함께 읽고, #58 이 실패하면 조용히 넘어간다(예고 줄만 없다).
- [수업 만들기] → A 표와 같은 #59 처리. 요청 중에는 시트 `dismissible=false`, 버튼 "만드는 중…".

#### C. 붙여넣기 `/study/today/talk/new/paste` — `LessonPasteScreen` (`#paste` · `#paste-short` · `#paste-noja`)

```
BackBar sticky backHref="/study/today/talk/new" backLabel="주제 고르기로" title="문장으로 수업 만들기" subtitle="오늘의 회화"
<div className="flex flex-col gap-[18px] px-4 pt-3.5 pb-8">
  <p 14px> 설명(§12-8 ⓒ)
  <div> <label 12.5 ink2 for=paste>붙여넣을 문장</label>
        <textarea id=paste lang=ja rows=8 16px min-h-[176px] aria-describedby="paste-hint paste-count">
        <div className="mt-1.5 flex justify-between"> <span id=paste-hint 12 ink2|bad>{hint}</span> <span id=paste-count 12 tabular-nums ink2|bad>{n} / 2,000자</span>
        (400 NOT_JAPANESE) ErrorBlock 2줄
  </div>
  <p 12 ink2> "붙여넣은 문장은 이 수업과 함께 저장돼요."
  <div> [이 문장으로 수업 만들기](primary full — 50~2,000자가 아니면 aria-disabled, 누르면 이유 토스트)
        <p 12 ink2 text-center mt-2> 1~2분·취소 불가 안내 </div>
</div>
```
- 글자 수는 코드포인트로 센다(`Array.from(s).length`). 안내: 0자 → "50자 이상 · 3~8줄이 알맞아요" / 1~49자 → "50자 이상 넣어 주세요 · 지금 {n}자" / 2,000자 초과 → "2,000자까지 넣을 수 있어요"(`bad`) / 그 밖 → "3~8줄이 알맞아요".
- 일본어 비율은 **보낼 때 서버가** 판정한다(400 `reason:"NOT_JAPANESE"` → 오류 상자 "일본어 문장이 너무 적어요." / "일본어가 들어간 문장을 붙여넣어 주세요."). 입력을 고치면 오류 상자를 지운다. 판정 기준을 한 곳에 두려고 클라이언트에서 미리 막지 않는다.
- 성공하면 원문을 `sessionStorage kaiwa.lesson.src.{lessonId}` 에 두고(실패 시 다시 만들기용, `READY` 가 되면 지움) 수업 경로로 `router.replace`(뒤로가기가 붙여넣기로 돌아오지 않게). 409 `GENERATING` 은 A 표와 같다.
- 입력 초안은 `sessionStorage kaiwa.lesson.pasteDraft` 에 둔다(화면을 나갔다 와도 유지, 보내면 지움).
- → **§20 (task-052, 승인 데모 `docs/demo/task-052-share-target-v1.html` v1)**: 카톡 공유 수신(`?from=share` 진입·맨 위 안내 띠·쓰던 글 되돌리기·빈 공유/받지 못함 토스트)과 **2,000자 초과 자르기 줄(직접 붙여넣기에도 적용)**. 위 규칙은 그대로 유효하고 §20 이 더하는 것만 적었다.

#### D. 수업 대기·실패 — `LessonGenScreen` (`#gen-wait` · `#gen-long` · `#gen-offline` · `#gen-fail`)

```
BackBar backHref="/study/today" backLabel="오늘로" title="수업 만들기" subtitle={주제 | "붙여넣은 문장"}
<div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3.5 pb-8 flex flex-col gap-[18px]">
  GenHero(가운데 정렬, pt-6): 스피너 40px(accent, reduced-motion 이면 정지) / <h2 19px bold>선생님이 수업을 만들고 있어요</h2> /
          <p 14 role=status aria-live=polite>{문구}</p> / <p 12 ink2 tabular-nums>{m:ss} · 보통 1~2분 걸려요</p>
  (폴링 네트워크 실패 중) note "연결이 끊겼어요. 다시 연결되면 이어서 확인해요. 수업은 계속 만들어지고 있어요."
  Card flat "이런 순서로 공부해요" + 5줄(번호 원 26px bg-surface + "<b>이해</b> · 대화를 구간별로 듣고, 들린 단어를 메모해요" …)
  <p 12 ink2> 나가도 계속 만들어짐 · 취소 불가 안내
  [오늘로 돌아가기](ghost full)
</div>
```
- 폴링: #60 의 `jobId` 로 #55 를 2초 → 3초 → 5초(이후 5초 고정) 간격으로 확인한다. `DONE` → #60 을 다시 읽어 `READY` 면 5단계 화면으로 바꾸고, 토스트 "수업이 준비됐어요" + 초점을 ① 제목(h2)으로 옮긴다. `FAILED` → 실패 모양. 화면이 가려지면 멈추고, 다시 보이면 바로 한 번 확인한다.
- 문구(`genPhase`): 경과 초 = `now − lesson.createdAt`(서버 시각 기준이라 다시 들어와도 이어진다). 15초 전 "주제와 지난 수업을 살펴보고 있어요" · 45초 전 "대화문을 쓰고 있어요" · 75초 전 "문법과 문제를 만들고 있어요" · 100초 전 "응용·말하기 과제를 고르고 있어요" · 그 뒤 "마지막으로 확인하고 있어요" · 잡 `stage === 'SAVE'` 이면 경과와 상관없이 "마지막으로 확인하고 있어요" · 120초 넘음 "조금 오래 걸리고 있어요. 조금만 더 기다려 주세요." **잡은 LLM(10%) → SAVE(90%) 두 단계만 알려 주므로 % 막대를 그리지 않는다.** 문구는 안내일 뿐 실제 단계와 1:1 이 아니다.
- 실패 모양: 원 52px `bg-bad-soft text-bad` "!"(`aria-hidden`) / h2 "수업을 만들지 못했어요" / 14px "선생님이 수업을 끝까지 만들지 못했어요. 다시 만들면 대부분 잘 만들어져요." / [다시 만들기](primary full — A 표) / [다른 주제 고르기](ghost full, mt-2). `lesson.error` 코드는 화면에 싣지 않는다.

#### E. 수업 틀 — `LessonStagesScreen` (`#l1` 외 5단계 공통 · `#l-review` · `#l-resume` · `#l-savefail`)

레이아웃(앱 셸 `main` 을 정확히 채우고 본문만 스크롤 — §9 회화방과 같은 방식):
```
<div className="mx-auto flex h-full min-h-0 w-full max-w-[520px] min-w-0 flex-col bg-ground">
  LessonHeader    flex-none 56px
  StageSteps      flex-none ≈58px
  <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3.5 pb-8">   ← 유일한 스크롤
     (다시 보기 중) ReviewNote
     StageUnderstand | StageGrammar | StageQuiz | StageApply | StageSpeak
  </div>
  (⑤만) LessonVoiceBar | LessonTextBar    flex-none, padding-bottom: max(8px, env(safe-area-inset-bottom))
  Toast
</div>
```

**LessonHeader**: `h-14 border-b border-line bg-surface px-1` — [←](44px, `aria-label="오늘로"` → `/study/today`) · `TeacherAvatar md` · `min-w-0 flex-1 pl-1.5` 안에 `h1 16px semibold truncate` = `<span class="sr-only">오늘의 회화, {주제}: </span><span lang=ja>{title}</span>` 과 그 아래 `TtsRuntimeStatusIndicator onAnnounce={toast}`. 한국어 제목(`titleKo`)은 종료 카드에서 쓴다.

**StageSteps**(결정 a=B): `nav aria-label="수업 단계, 5단계 중 {stageDone}단계 끝냄"`, `grid grid-cols-5 border-b border-line bg-surface px-1.5 py-1`. 칸 = `button min-h-[52px] flex-col items-center justify-center gap-0.5 text-[11.5px]`:
- 원 26px: 끝낸 칸 `bg-good-soft text-good` "✓" · 지금 칸 `bg-accent text-on-accent` + 라벨 ink bold + `aria-current="step"` · 열리지 않은 칸(`n > stageDone + 1`)은 테두리만(`ring-[1.5px] ring-line`, 번호 ink2) + `aria-disabled` — 누르면 토스트 "앞 단계를 마치면 열려요".
- 칸 사이 선 2px(`line`, 끝낸 구간은 `good`) — `::after` 장식.
- `aria-label="{n}단계 {이름}[, 끝냄][, 지금 보는 단계][, 앞 단계를 마치면 열려요]"`.
- 열리는 칸은 `n ≤ stageDone + 1`. 끝낸 단계(`n ≤ stageDone`)를 열면 **다시 보기**(`#l-review`): 맨 위 `note role=status` "끝낸 단계를 다시 보는 중이에요. 저장된 답은 바뀌지 않아요." + 맨 아래 [지금 단계로 · {④ 응용}](primary full). 다시 보기에서는 쓰기 요청을 보내지 않는다(듣기·예문 듣기만 된다).
- 처음 열 때 단계 = `min(stageDone + 1, 5)`. 생성 직후가 아니고 `stageDone ≥ 1` 이면 토스트 "{③ 문제}부터 이어서 해요. 앞 단계는 저장돼 있어요."(`#l-resume`).

**단계 넘기기**: 각 단계 끝에 [다음 단계 · {② 문법}](primary full 48px). 누르면 대기 중인 progress 쓰기를 먼저 비우고 #61 `{stageDone: 지금 단계}` 를 보낸다. 성공하면 다음 단계로 가서 스크롤을 맨 위로, 초점을 새 단계 h2(`tabIndex=-1`)로 옮긴다. 실패하면 버튼 위 `role=alert` "진행 상황을 저장하지 못했어요. 다시 눌러 주세요."(`#l-savefail`)를 두고 그 자리에 머문다. 400 `monotonic` 은 이미 더 앞서 있다는 뜻이니 #60 을 다시 읽는다.

#### F. ① 이해 — `StageUnderstand` (`#l1` · `#l1-playing` · `#l1-memo` · `#l1-textonly` · task-025 v1 `#l1-line` · `#l1-interrupt` · `#l1-review`)

```
<h2 17px bold tabIndex=-1>① 이해 · 듣고 이해하기</h2>  + 13px ink2 설명(ONLINE / TEXT_ONLY 두 벌, §12-8 ⓔ)
ToolsRow(mt-2.5): [읽기](Toggle, 기본 켬) [번역](Toggle, 기본 끔)   오른쪽 역할 범례 [A] {rolesKo.A} [B] {rolesKo.B} (12px ink2)
SegmentCard × segmentCount    (아코디언 — 한 번에 하나만 열림. 처음엔 아직 다 듣지 않은 첫 구간)
MemoSummaryCard (mt-[18px])
[다음 단계 · ② 문법]
```
- `Toggle`: `h-8 rounded-full border border-line px-3 text-[13px]` + `before:` 로 세로 히트 44px, `aria-pressed`. 켜진 모양 `bg-ink text-surface`. **읽기 켬/끔은 `localStorage kaiwa.chat.readingDefault` 를 공유**한다(§1-3 — 채팅·회화와 같은 기본값). 번역은 늘 끈 채로 시작한다.
- 역할 칩: 24px r6 12px bold — A `bg-surface2 text-ink`, B `bg-ink text-surface`(글자로도 구분된다). 범례는 20px 칩.

**SegmentCard**(`section rounded-[14px] border border-line bg-surface`, 열리면 `border-accent`):
- 머리 `button min-h-[52px] w-full px-3.5`(`aria-expanded`·`aria-controls`): "구간 {k}"(15 semibold) + " · {a}~{b}줄"(12 ink2) + (닫혀 있고 메모가 있으면) " · 메모 {n}" · 오른쪽 상태 — 끝냄 `Badge good "들었어요"`(TEXT_ONLY "읽었어요") / 반쯤 "느리게 ✓ · 보통"(12 ink2) · `›` 90° 회전.
- 몸통(열림, `px-3.5 pb-3.5`):
  1. (글자 가림 중) "글자를 가리고 먼저 들어요."(12 ink2) + [글자 보기](밑줄 텍스트 버튼 44px).
  2. 줄: `grid grid-cols-[26px_minmax(0,1fr)] gap-2 -mx-2 rounded-[10px] px-2 py-1.5` — 역할 칩 + `<span class="sr-only">{rolesKo}: </span>` + `<p lang=ja 17px/1.7 whitespace-pre-wrap [overflow-wrap:anywhere]>{ja}</p>` + (읽기 켬 && `reading ≠ ja`) `<p lang=ja 14px ink2>{reading}</p>` + (번역 켬) `<p 13 ink2>{ko}</p>`. **재생 중인 줄은 `bg-accent-soft`**.
     글자 가림(d=B): 줄마다 역할 칩 + 높이 14px `bg-surface2` 막대 1~2개(글자 수에 따라, `aria-hidden`) + sr-only "{역할}, 글자 가림". 가림 조건 = `ONLINE && 이 구간을 보통 속도로 끝까지 듣지 않음 && [글자 보기]를 누르지 않음`. 보통 속도 재생을 **시작하면** 바로 보인다. TEXT_ONLY·다시 보기에서는 늘 보인다.
     **줄 다시 듣기 ▶(task-025, IMP-0012)**: ONLINE 이면 줄 그리드가 `grid-cols-[26px_minmax(0,1fr)_44px] items-start` — 마지막 칸에 `LineReplayButton`(누르는 범위 44px `-my-1 -mr-2`, 보이는 원 32px `border border-line bg-surface` / 재생 중 `border-ink bg-ink text-surface` ■ / 받는 중 스피너). `aria-label` "{n}번째 줄[ 느리게] 다시 듣기" / 재생 중 "{n}번째 줄 멈추기". **글자 가림 중에도 보이고 가림을 풀지 않는다**(가림 줄도 같은 3칸). 재생 줄(받는 중 포함) `bg-accent-soft`. 자막만이면 버튼·안내 줄을 숨기고 2칸 그리드로 돌아간다. 다시 보기에서도 보인다(듣기만).
     속도(결정 a=A): 그 구간을 **보통 속도로 끝까지 듣기 전엔 `slow`, 뒤엔 `normal`**, 다시 보기는 늘 `normal`(`lineReplayPace`). 소리 = #62c `{kind:'dialogue', idx, pace}`, 키 `line:{idx}`, **onComplete 없음 → 진행(#61)·StudyLog 쓰기 0**(`playLineReplay`). 같은 큐라 구간 재생 중에 누르면 구간 재생이 끊기고(`breakPending`) "느리게/보통 ✓"는 채워지지 않는다. 재생 중인 줄 ▶ 를 다시 누르면 멈춘다.
  3. (ONLINE, task-025) 안내 줄 12 ink2 "줄 옆 ▶ 는 그 줄만 다시 들려줘요. ‘들었어요’는 아래 구간 듣기(느리게 → 보통)로만 채워져요." → 그 아래 듣기 순서 `ol aria-label="듣는 순서"` 2칸(h-7 r8 12px): "① 느리게"·"② 보통 속도" — 끝낸 칸 `bg-good-soft text-good` "✓", 다음 차례 `bg-surface ring-[1.5px] ring-accent`, 나머지 `bg-surface2 text-ink2`.
  4. 상태 줄 `p role=status 13px ink2 min-h-5`(문구 §12-8 ⓔ): 재생 중 "{느리게|보통 속도로} 듣는 중 · {i}/{n}줄" 등. **줄 다시 듣기가 이 구간에서 소리 나면 그 문구가 먼저**(`pb.lineOf` 가 아니라 큐 스냅샷의 `line:{idx}` 로 — `activeLineReplay`): 받는 중 "{n}번째 줄을 불러오는 중…" / 재생 중 "{n}번째 줄 · {느리게|보통 속도로} 다시 듣는 중". 줄 재생이 막히면(blocked) 아래 버튼 자리가 "▶ 눌러서 듣기".
  5. 버튼(48px): 재생 중 [■ 멈춤](ghost full) / 느리게 전 [▶ 느리게 듣기 · {배율}](primary full) / 느리게 뒤 BtnRow [▶ 보통 속도로](primary) [다시 느리게](ghost) / 둘 다 들음 BtnRow [다음 구간](primary, 마지막 구간엔 없음) [▶ 다시 듣기](ghost, 보통 속도). `{배율}` = 설정 `learningSpeed`(0.6/0.8/1.0 → "0.6배"…, 없으면 0.8 — `page.tsx` 가 넘김). 재생이 막히면(큐 `blocked`) 그 버튼이 "▶ 눌러서 듣기" → `resumeBlocked()`.
     **자동 재생 없음(b=B)**: [다음 구간]은 다음 구간을 열기만 한다.
  6. TEXT_ONLY: 3~5 대신 `note role=status` "지금은 선생님 목소리를 들을 수 없어요(자막만). 목소리가 돌아오면 듣기 버튼이 다시 보여요." + [읽었어요 · 다음 구간](primary full, 마지막 구간은 "읽었어요") → `segmentsDone` 에 넣고 다음 구간을 연다.
  7. `MemoBox`(`mt-3.5 border-t border-line pt-3`): `label for` "들린 단어 메모" + 오른쪽 "{n}/5"(tabular) / 12 ink2 "들린 단어를 일본어로 적어요. 뜻은 몰라도 괜찮아요." / 칩 줄(36px, `bg-surface2` 15px `lang=ja`, 지우기 ✕ 32px + 히트 44px `aria-label="{단어} 지우기"`) / 입력 줄: `input lang=ja 16px h-11 maxLength=20 enterKeyHint=done autoComplete=off` + [추가](ghost h-11) / 오류 `p role=alert 12.5px bad`.
     - 규칙(서버와 같음): 앞뒤 공백 제거. 가나·한자가 1자 이상 없으면 "일본어로 적어 주세요. 예) 注文, ちゅうもん". 같은 구간 중복이면 "이미 적은 단어예요." 구간 5개가 차면 입력 비활성 + placeholder "이 구간은 5개까지 적을 수 있어요". 수업 전체 15개면 "수업 전체에서 15개까지 적을 수 있어요." Enter(IME 조합 중 제외)로 추가하고, 추가한 뒤 초점은 입력창에 그대로 둔다.
- **MemoSummaryCard**(`#l1-memo`): 메모가 0이면 Card flat "들린 단어 메모" + "아직 적은 단어가 없어요. …"(§12-8 ⓔ). 메모가 있으면 Card: "들린 단어 {n}개"(15 semibold) + 읽기 전용 칩 + 설명 "단어장에 없는 단어만 골라 제안해 드려요. 추가를 눌러야 저장돼요." + [단어장에 넣을까요?](ghost full) → #62a:
  - 요청 중: "단어를 찾아보는 중…"(스피너 14px + `role=status`). 뜻 보강 때문에 몇 초 걸릴 수 있다.
  - 결과: "단어 제안 {proposals 수}개 · 선생님 제안이에요. 추가를 눌러야 단어장에 저장돼요." + `proposals` 마다 **`ProposalCard`(§3-2 G 그대로 — [단어장에 추가]·[괜찮아요]·✎ 뜻 고쳐서 추가)** + `skipped` 마다 한 줄(`rounded-xl bg-surface2 px-3.5 py-2.5`, 왼쪽 `<span lang=ja 15px>{surface}</span>`, 오른쪽 12 ink2 사유 §12-8 ⓕ).
  - `ProposalCard` 머리("단어 제안") 자리에 **출처 캡션**을 넣는다: `payload.via === "CHUNK"` → "단어 제안 · 대화 {lineIdx + 1}번째 줄" / `"ENRICH"` → "단어 제안 · 선생님이 찾아본 뜻". `payload.memo ≠ payload.surface` 이면 뜻 아래 12 ink2 "메모 <span lang=ja>{memo}</span> → 사전에 싣는 모양으로 바꿨어요"(ProposalCard 에 선택 prop `caption`·`note` 추가 — §12-5).
  - 결과를 받은 뒤 새로 적은 단어가 있으면 [새로 적은 단어 {k}개도 제안받기](ghost full). 같은 단어를 다시 보내도 서버는 그때 결과를 돌려준다(새 행 없음).
  - 다시 들어왔을 때(`progress.listen.proposed` 가 비어 있지 않음): 제안 카드는 저장돼 있지 않으므로, 이 카드가 처음 보일 때 **메모 초안으로 #62a 를 한 번 다시 불러** 지금 상태의 제안 카드를 복원한다.

#### G. ② 문법 — `StageGrammar` (`#l2` · task-025 v1 `#l2` · `#l2-playing` · `#l2-fail` · `#l2-textonly`)

```
<h2 tabIndex=-1>② 문법 · 표현과 문형</h2> + 13 ink2 "오늘 대화의 표현 조각과 문형 {g}개예요. 표현과 예문을 듣고 소리 내어 따라 읽어 보세요."
(TEXT_ONLY) note "지금은 선생님 목소리를 들을 수 없어 표현·예문 듣기를 숨겼어요(자막만)."
Card "오늘의 표현 {chunks.length}개"(15 semibold) + 13 ink2 "대화에 나온 표현 조각이에요. 누르면 소리를 들을 수 있어요. 문제·응용·말하기에서 다시 써요."(TEXT_ONLY 는 가운데 문장 없이)
   ONLINE: ExprPlayChip = 칩 전체가 button(min-h-11 r10 py-1 pl-1.5 pr-3 bg-surface2): ▶ 원 30px(bg-surface) + <span lang=ja 16px>{textJa}</span> <span 12 ink2>{meaningKo}</span> (isNew) Badge "새 표현" + sr-only ", 듣기"
           재생 중 ring-[1.5px] ring-accent ring-inset + bg-accent-soft, 원 bg-ink ■, sr-only ", 멈추기" / 받는 중 원 안 스피너
   TEXT_ONLY: ExprChip(bg-surface2 r10 px-2.5 py-1.5, 글자만 — 지금과 같음)
GrammarCard × grammar (Card): "문형 {i}"(12 ink2) / <h3 lang=ja 20px bold>{pattern}</h3> / <p 14px>{explanationKo}</p> /
   구분선 아래 예문 행(-mx-2 px-2 py-2.5 rounded-[10px], 재생 중 bg-accent-soft): "예문"(12 semibold ink2) + <p lang=ja 17px>{exampleJa}</p>
   + (읽기 켬) <p lang=ja 14 ink2>{exampleReading}</p> + <p 13 ink2>{exampleKo}</p>   오른쪽 PlayButton 44px 원(aria-label "예문 듣기" / 재생 중 "멈추기")
[다음 단계 · ③ 문제]
```
- 예문 소리 = #62c `{kind:'grammar', idx, pace:'normal'}`.
- **표현 소리(task-025, IMP-0013, 결정 b=A)** = #62c `{kind:'chunk', idx, pace:'normal'}`, 키 `expr:{idx}`, onComplete 없음(기록 없음). 한 번에 소리 하나(다른 소리를 누르면 앞 소리는 멈춤), 재생 중 칩을 다시 누르면 멈춘다. 실패는 기존 토스트 "목소리를 불러오지 못했어요. 잠시 후 다시 눌러 주세요."만 띄우고 칩은 원래 모양(422 는 자막만 전환). **④ 응용 "써 볼 표현"·⑤ 말하기 "목표 표현" 칩은 바꾸지 않는다**(▶ 표시 없음으로 구분).
- 서버 경로 선택(developer): #23 범용 합성이 아니라 #62c 에 `chunk` 를 더했다 — 문장은 서버가 소유자 레슨 본문에서 고르고(클라이언트 글자 없음), 이 레슨/주제 발음 사전 범위·`LEARNING_NORMAL`·12요소 캐시·분당 한도를 그대로 쓴다.

#### H. ③ 문제 — `StageQuiz` (`#l3` · `#l3-wrong` · `#l3-sum` · task-025 v1 `#l3-new` · `#l3-blank` · `#l3-old` · `#l3-old-answered`)

```
<h2 tabIndex=-1>③ 문제 · {N}문제</h2> + 13 ink2 "답을 고르면 바로 정답과 설명이 나와요. 한 번만 고를 수 있어요."
QuizTop: "문제 {i} / {N}"(14 bold) · 점 24px × N(aria-hidden — 맞힘 good-soft ✓ / 틀림 bad-soft ✗ / 지금 ring-2 accent / 남음 surface2 번호)
Card: (quizPromptView) <p 16 semibold>{한국어 질문}</p> + (promptJa 있으면) <p lang=ja 17px leading-1.7>{promptJa}</p>
      (옛 수업 — promptKo null·빈 값) 한국어 질문 자리 = "일본어 문장을 읽고 알맞은 답을 고르세요." + 일본어 문장 + 12 ink2 ⓘ "이 문제에는 한국어 설명이 없어요."
      <div role=group aria-label="보기"> ChoiceButton × 4 </div>
      (답함) Explain(bg-surface2 r12 p-3 role=status): "✓ 맞았어요"(good) | "✗ 틀렸어요 · 정답은 {k}번"(bad) + 14px explanationKo
(답함) [다음 문제] | 마지막 [결과 보기](primary full)
```
- `ChoiceButton`: `grid grid-cols-[26px_minmax(0,1fr)_auto] items-center gap-2.5 min-h-[52px] rounded-xl border border-line bg-surface px-3 py-2.5 text-left mt-2` — 번호 원 24px / 본문(가나·한자가 있으면 `lang=ja` 17px, 아니면 15px — `matchLang`) / 꼬리표. 답한 뒤: 정답 `border-good bg-good-soft` + "✓ 정답"(12 bold good) · 내가 고른 오답 `border-bad bg-bad-soft` + "✗ 내 답"(12 bold bad) · 나머지 `text-ink2`(opacity 금지). `aria-label="{k}번, {보기}[, 정답][, 내 답, 틀림]"`, 답한 뒤에는 넷 다 `aria-disabled`.
- **문제 한국어 표기(task-025, IMP-0014 · Q10)**: 새 수업(A4 `lesson@v8`~)은 `promptKo` 가 늘 있어 한국어 질문(굵게) → 일본어 문장(있을 때). 빈칸형은 정답을 드러내지 않는 지시문("빈칸에 들어갈 알맞은 말을 고르세요."류 — 결정 e=B, 생성 프롬프트 몫). 옛 수업(v7 이하)의 `promptKo` null·빈 값은 다시 만들지 않고 공통 안내 줄로 대체(결정 c=A, 서버 요청 없음). **보기(답)에는 한국어를 붙이지 않는다**(답 노출). 나머지 단계(① 대화 뜻은 [번역] 끈 채 시작 — 결정 d=A, ②④⑤ 는 이미 한국어 필수)는 바꾸지 않는다.
- 채점은 화면이 `content.quiz[].answer` 로 바로 한다(자습이라 정답이 내용에 들어 있다 — 계약 #60). 고르는 즉시 #61 `{progress:{quiz:{answers}}}`(첫 답 고정 — 서버도 바꾸지 않는다). 점수는 완료 때 서버가 다시 계산한다.
- 답한 뒤 초점은 [다음 문제]로, 다음 문제로 가면 첫 보기로 옮기고 스크롤은 문제 카드 위로 맞춘다.
- 결과(모두 답함 또는 다시 보기, `#l3-sum`): Card "{N}문제 중 {c}문제 맞혔어요"(22 bold tabular) + 점 줄 + 문항 목록(✓/✗ 24px 원 + 문제 14px(`promptKo ?? promptJa` — `quizSummaryPrompt`, 공통 안내 줄은 넣지 않는다) + "내 답 {보기} · 정답 {보기}"(12 ink2, 맞힌 문항은 "정답 {보기}"만)) + 12 ink2 "틀린 문제의 표현은 수업을 마치면 복습할 항목으로 기록돼요." + [다음 단계 · ④ 응용].
- 다시 들어왔을 때: 답하지 않은 첫 문항부터, 다 답했으면 결과부터.

#### I. ④ 응용 — `StageApply` (`#l4` · `#l4-voice` · `#l4-compare` · task-025 v1 `#l4-diff` · `#l4-kanji` · `#l4-same` · `#l4-mixed` · `#l4-skip`)

```
<h2 tabIndex=-1>④ 응용 · 문장 만들기 {N}개</h2> + 13 ink2 "상황에 맞는 문장을 직접 만들어요. 채점하지 않고, 모범 답안과 비교해 스스로 확인해요."
Top: "상황 {i} / {N}" + 점(끝냄 ✓ good-soft / 지금 ring accent / 남음 번호)
(다시 보기) 상황 1·2·3 전환 BtnRow(ghost h-11)
Card(@container):
  <p 16 semibold>{promptKo}</p>
  "써 볼 표현"(12 ink2) + ExprChip(targetIds → chunks: textJa·meaningKo | grammar: pattern·"문형")
  (hintJa 있음) 12 ink2 "힌트 · <span lang=ja>{hintJa}</span>"
  ─ 쓰기(비교 전) ─
  label "내 문장" + textarea lang=ja 16px min-h-[84px] maxLength=200
     | (말로 쓰기) 인식 상자(점선 테두리 min-h-16) + PushToTalkButton 64px + 상태 줄
  행: [마이크 아이콘 말로 쓰기 | 키보드 아이콘 글자로 쓰기](밑줄 텍스트 버튼 44px) ··· "{n} / 200자"(12 ink2)
  [모범 답안과 비교하기](primary full, 비었으면 aria-disabled + 토스트 "먼저 문장을 써 보세요")
  [모르겠어요 · 모범 답안 보기](가운데 밑줄 텍스트 버튼 44px)
  ─ 비교 ─ (위아래: 컨테이너 ≥440px 에서만 나란히 → 휴대폰 폭에선 늘 위아래)
    (task-025) 13 semibold ink "글자가 다른 곳에 밑줄을 쳤어요 · 채점이 아니에요" | 같으면 "＝ 모범 답안과 글자가 같아요." | 모르겠어요·200자 초과면 줄 없음
    box(bg-surface2 r12 px-3 py-2.5): 머리 줄 "내 문장"(12 semibold ink2) ··· (다름) 범례 12 ink2 [점선] 모범 답안에 없는 글자
         + <p lang=ja 17px leading-1.7>{내 답 — 다른 글자는 <mark> 굵게 + 점선 밑줄}</p> | 비었으면 13 ink2 "(쓰지 않고 봤어요)"
    box: 머리 줄 "모범 답안"(12 semibold good) ··· (다름) 범례 [실선] 내 문장에 없는 글자
         + <p lang=ja 17px leading-1.7>{modelAnswerJa — 다른 글자는 <mark> 굵게 + 실선 밑줄}</p> + (읽기 켬) {modelReading} + 13 ink2 {modelKo}
         + [▶ 모범 답안 듣기](h-11 테두리 버튼, 재생 중 "■ 멈춤")
    (다름) sr-only "모범 답안에만 있는 글자: {…}. 내 문장에만 있는 글자: {…|없음}."
  12 ink2 비교 표시가 있으면 "채점하지 않아요. 밑줄은 글자가 다른 곳일 뿐, 뜻이 통하면 다르게 써도 괜찮아요. 문장부호·띄어쓰기 차이는 표시하지 않아요. 모범 답안을 소리 내어 따라 읽어 보세요."
          표시 없음(모르겠어요·200자 초과)이면 "채점하지 않아요. 뜻이 통하면 다르게 써도 괜찮아요. 모범 답안을 소리 내어 따라 읽어 보세요."(지금과 같음)
[다음 상황](primary full) | 마지막 [다음 단계 · ⑤ 말하기]
```
- [비교하기] → #61 `{progress:{application:{answers}}}`(그 칸만 새 글자, 다른 칸은 지금 값) 뒤 비교 모양. [모르겠어요]는 저장하지 않고(칸은 null) 비교 모양만 보인다.
- 말로 쓰기: `useRealtimeStt({ purpose: 'MIC_TEST', config })`(원음을 저장하지 않는 경로 — §12-11 ④). final 텍스트를 입력칸에 넣고(덮어씀), 고치려면 [글자로 쓰기]. 권한·오류 안내는 ⑤ 와 같은 `SttAlert`.
- 비교 상자의 `@container` 기준 440px 은 데모 v2 결정이다(일본어 줄이 좁게 꺾이지 않게).
- 모범 답안 소리 = #62c `{kind:'application', idx}`.
- **글자 비교(task-025, IMP-0016)** = `compare.ts` `compareAnswer(저장된 내 답, modelAnswerJa)` — 채팅 교정 카드와 같은 `diffCodepoints`(코드포인트 LCS, 200 초과 null)를 쓰고, **문장부호·공백(`\s`·`\p{P}`)만 다른 글자는 글자 하나씩 "같음"으로 돌린다**(이어 붙이면 원문과 같다는 불변식 유지). `<mark>`: `rounded-[3px] bg-surface px-px font-bold text-ink underline decoration-ink` + 내 문장 `decoration-dotted decoration-[2.5px]` / 모범 답안 `decoration-solid decoration-2`, `underline-offset-[5px]`(범례는 3px). **색은 ink·surface 만 — 빨강·초록·취소선·✓ 없음**. 채점이 아니라 비교 표시라 정오 판정·#61 저장·기록은 바뀌지 않는다.
- 다시 들어왔을 때: 답이 저장된 칸은 비교 모양, 나머지는 쓰기부터(건너뛴 칸은 저장되지 않으니 쓰기로 돌아온다).

#### J. ⑤ 말하기 — `StageSpeak` + `LessonVoiceBar` (`#l5` · `#l5-ok` · `#l5-miss` · `#l5-text` · `#l5-denied` · `#l5-fail` · `#l5-donefail`)

```
<h2 tabIndex=-1>⑤ 말하기 · 과제 {N}개</h2> + 13 ink2 "목표 표현을 넣어 말해 보세요. 아래 버튼을 누른 채로 말하고, 다 말하면 손을 떼요."
Top: "과제 {i} / {N}" + 점(모두 씀 ✓ good-soft / 일부 △ bg-surface + ring line / 지금 ring accent / 남음 번호)
Card:
  <p 16 semibold>{promptKo}</p>
  "목표 표현"(12 ink2) + ExprChip(targetIds): 결과 전 보통 / 결과 뒤 matchedIds → bg-good-soft + "✓ 썼어요"(12 bold good) · missedIds → "· 아직"(12 ink2) · unknownIds → 표시 없음
  (음성 인식 오류) SttAlert(§9-2 G ① 그대로, 버튼 문구 "글자로 답하기")
  결과 전: 인식 상자(점선 테두리 min-h-16 — 녹음 중 partial 17px ja ink2 + "…", aria-hidden) + [이 과제 건너뛰기](밑줄 텍스트 버튼 44px)
  결과 뒤: "내가 한 말" | "내가 쓴 답"(12 semibold ink2) + 말풍선(bg-accent-soft r14 px-3 py-2, lang=ja 17px, 글자 ink)
           + (utteranceId && hasAudio) [▶ 내 목소리](밑줄 텍스트 버튼 44px, 재생 중 "■ 멈춤")
           결과 줄 role=status 14 semibold: used → "✓ 목표 표현을 모두 썼어요"(good) | 아니면 "모범 답안과 비교해 보세요 · 아직 안 쓴 표현 {missed 표기 목록}"(ink)
           box "모범 답안"(good 라벨) + modelAnswer.ja 17px + (읽기 켬) reading + ko + [▶ 모범 답안 듣기]
           12 ink2 "다시 하려면 아래 버튼을 또 누르고 말해요."
(결과 뒤) [다음 과제](primary full) | 마지막 과제: (완료 실패) alert + [수업 마치기](primary full)
LessonVoiceBar: 상태 줄(h-6, MicLevelMeter + 문구) / grid-cols-[44px_minmax(0,1fr)_44px]: [키보드](aria-label "글자로 답하기") · PushToTalkButton 72px · [■](재생 중만, "소리 멈추기")
LessonTextBar: [마이크](aria-label "말로 답하기") · textarea lang=ja 16px(1~5줄 자동 높이, placeholder "일본어로 써서 답해 보세요") · [↑](accent 원, aria-label "확인하기")
```
- 음성: `useRealtimeStt({ purpose: 'TURN', config, maxSec: 30, onFinal })` — **`chatId` 없이**(방 없는 발화, 계약 #21·#62b). 누르면 먼저 재생 큐 `interrupt('BARGE_IN')`(§9 회화방과 같은 barge-in — 재생 중에도 버튼을 막지 않는다). `onFinal({ text, utteranceId })`: trim 뒤 비었으면 힌트 `STT_HINT_COPY.EMPTY_RESULT`(`#l5-fail`), 아니면 #62b `{itemId, text, utteranceId}`.
  - #62b 409 `UTTERANCE_*` → 같은 글자로 `utteranceId` 없이 한 번 다시 보내고 [▶ 내 목소리]는 숨긴다(판정은 그대로 받는다).
  - 앱(휴대폰 인식)은 §11 라우터가 #21 로 wav 를 올리고 `utteranceId` 를 준다 — 화면 코드는 같다.
- 글자: [키보드] → LessonTextBar(초안은 `sessionStorage kaiwa.lesson.speakDraft.{lessonId}.{itemId}`). Enter(Shift 없이·IME 조합 중 아님) 또는 [↑] → #62b `{itemId, text}`. 비어 있으면 토스트 "일본어로 답을 써 주세요". 글자 모드의 키보드 대응은 회화방 `--kb-inset` 방식 그대로.
- 결과가 오면 스크롤을 과제 카드 위로 맞춰 결과가 보이게 하고, 초점은 결과 줄로 옮긴다.
- 상태 줄 문구 = §8-8 ⓑ·ⓒ(`STT_STATUS_COPY`·`recordingStatus`·`STT_HINT_COPY`) + 결과 뒤 대기 "다시 하려면 또 누르고 말해요" + 재생 중 "듣는 중 · 누르면 멈추고 말해요".
- 과제는 몇 번이든 다시 말할 수 있다(서버는 마지막 시도로 바꾼다). [이 과제 건너뛰기]는 서버 요청 없이 결과를 "(건너뛰었어요)"로 두고 다음 과제로 간다 — 그 과제의 목표는 완료 때 못 쓴 표현으로 센다(계약 #62).
- [수업 마치기]는 세 과제 모두 결과(또는 건너뜀)가 있을 때만 보인다 → #62 `{}`:
  - 200 → 응답 `result` 로 종료 카드를 그리고(페이지 새로고침 없이 상태 전환) 초점을 종료 카드 h2 로.
  - 409 `ALREADY_DONE` → #60 을 다시 읽어 종료 카드 + 토스트 "이미 끝낸 수업이에요. 결과를 보여 드릴게요."
  - 409 `STAGES_LEFT` → #61 `{stageDone: 4}` 를 한 번 보내고 #62 를 다시 부른다(사용자에게는 보이지 않음). 또 실패하면 아래 오류.
  - 그 밖 → 버튼 위 `role=alert` "수업 기록을 남기지 못했어요. 다시 눌러 주세요." / "여러 번 눌러도 기록은 한 번만 남아요."(`#l5-donefail`). 요청 중엔 "기록하는 중…" + `aria-busy`, 두 번 눌러도 한 번.
- 다시 들어왔을 때: `progress.speaking[]`(과제마다 마지막 시도)로 결과를 복원한다. `hasAudio` 는 저장돼 있지 않으니 `utteranceId` 가 있으면 [내 목소리]를 두고, #21b 가 404 면 토스트 "녹음이 없어요. 내 목소리는 30일 동안만 보관해요." 후 숨긴다. 결과가 없는 첫 과제부터 연다.

#### K. 종료 카드 — `LessonEnd` (`#end`)

```
BackBar backHref="/study/today" backLabel="오늘로" title="수업을 마쳤어요" subtitle="{주제} · {M월 D일}"(completedAt, KST)
<div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3.5 pb-8 flex flex-col gap-[18px]">
  Hero(가로 flex gap-3): 원 52px good-soft "✓"(aria-hidden) + <div> <h2 20 bold tabIndex=-1>수업을 마쳤어요</h2> <p lang=ja 14>{title}</p> <p 12 ink2>{titleKo}</p> </div>
  StatTiles(grid-cols-3 gap-2, 칸 bg-surface border r12 py-2.5, 숫자 20 bold tabular + 12 ink2 라벨):
     "{correct}/{total}" 문제 정답 · "{applicationDone}" 만든 문장 · "{used}/{used+missed}" 쓴 표현
  Card: "말하기에서 쓴 표현"(15 semibold) + ExprChip(bg-good-soft, ja 16 + ko 12 + ✓) /
        (missed ≥1) "다음엔 이 표현도 써 보세요" + ExprChip(bg-surface2) /
        12 ink2 "오늘 배운 표현과 문형은 복습할 항목으로 기록했어요." /
        (이번에 넣은 단어 ≥1) 행 버튼 "단어장에 넣은 단어 {k}개 · 단어장에서 보기 ›"(accent 13 semibold, 44px, 윗선 → /drawer/words)
  NextCard(bg-accent-soft r14 p-3.5, aria-labelledby): "다음 시간엔"(13 ink2) / <h3 17 bold>{nextPreview.titleKo}</h3> / <p 14>{nextPreview.teaserKo}</p> / [다음 수업 만들기](primary full mt-3)
  [이 주제로 선생님과 이어서 말하기](ghost full) + 12 ink2 가운데 "회화 탭에서 ‘{주제}’ 이야기로 새 회화를 시작해요."
  [오늘로](가운데 밑줄 텍스트 버튼 44px)
</div>
```
- 값: 방금 끝냈으면 #62 `result`(`quiz.correct`·`quiz.total`·`applicationDone`·`expressions.usedIds/missedIds`·`nextPreview`)를 쓴다. 다시 들어왔으면(#60 `DONE`) 같은 값을 계산한다(`endResult.ts`): 정답 = `round(score / 100 × quiz.length)`, 만든 문장 = `progress.application.answers` 에서 글자가 있는 칸 수, 쓴 표현 = `progress.speaking[].matchedIds` 합집합, 못 쓴 표현 = 말하기 목표 전체 − 쓴 것(시도한 과제에서 `matchedIds`·`missedIds` 어디에도 없는 판정 불가는 뺀다), 예고 = `content.nextPreview`.
- id → 칩: `content.chunks`(textJa·meaningKo) / `content.grammar`(pattern·"문형").
- "넣은 단어" 수는 이 수업 화면에서 [단어장에 추가]를 누른 수다(`sessionStorage kaiwa.lesson.added.{lessonId}`). 모르면 줄을 숨긴다(§12-11 ⑥).
- [다음 수업 만들기] → #59 `{topicId: lesson.topic.id}`(A 표 처리). [이어서 말하기] → #28 `{kind:'TALK', topicId}` → `router.push('/study/ai/talk/' + id)`(제목은 서버가 주제 제목으로 정한다). 요청 중 버튼 `aria-busy`.
- **붙여넣은 수업(`source:'TEXT'`, topic 없음)**: 두 버튼이 쓸 주제가 없다. §12-11 ③ 이 결정되기 전의 권고안 — NextCard 대신 BtnRow [다른 문장으로 수업 만들기](primary → 붙여넣기) [주제 고르기](ghost), [이어서 말하기]는 숨긴다.

#### L. 없음·불러오기 (`#l-404` · `#l-loading` · `#l-loaderr`)

- 수업 경로 #60 이 404 → BackBar("오늘의 회화") + 가운데 "이 수업을 찾을 수 없어요." / 13 ink2 "주소가 잘못되었거나 삭제된 수업이에요." / [오늘로](primary).
- 불러오는 중: 머리(제목 자리 비움) + 스켈레톤 3칸 + sr-only "수업을 불러오는 중…". 오류: `ErrorBlock` "수업을 불러오지 못했어요." + [다시 시도].

### 12-3. 상태 관리

#### A. 오늘 홈 — `TodayHome` + `deriveLessonCard(today)` (순수, `lesson/cardState.ts`)
- #58 결과를 `lessonToday`(`loading|ready|error`)로 따로 둔다. §12-2 A 표 순서를 그대로 코드로 옮기고 단위 테스트로 고정한다(GENERATING·오늘 진행·resume·FAILED·DONE·추천 조합).
- `gen` 이면 `useJobWatch(jobId, { intervalMs: 5000, onSettled: reload })`(화면이 보일 때만).

#### B. 수업 — `useLesson(lessonId)` (`lesson/useLesson.ts`)
- 상태: `lesson`(#60 DTO) · `stage`(보고 있는 단계) · `saveError` · `completing` · `completeError`.
- **쓰기 큐 한 줄**(§5 덱과 같은 방식): progress 쓰기(played·segmentsDone·memo·quiz·application)를 큐에 넣어 순서대로 #61 로 보낸다. 화면은 낙관적으로 먼저 바꾼다(사용자 직접 행위라 되돌릴 일이 드물다). 400 이면 그 칸만 되돌리고 오류 문구를 보인다. played·segmentsDone·memo 는 800ms 모아 한 번에 보낸다. `stageDone` 은 큐를 비운 뒤 기다려서 보낸다(실패하면 머문다).
- 복원(#60 → 화면): 구간 played/segmentsDone/memo, 문제 answers(첫 null), 응용 answers, 말하기 결과. 단계 = `min(stageDone + 1, 5)`.
- 상태 분기: `GENERATING` → D(폴링), `FAILED` → D 실패, `READY|IN_PROGRESS` → E~J, `DONE` → K.

#### C. 소리 — `useLessonPlayback()` (`lesson/useLessonPlayback.ts`)
- `useTalkPlayback` 과 같은 구성으로 **`createTtsPlaybackQueue` 1개**를 쓴다(fetchAudio = `fetchChunkAudio(url, signal, apiGetAudio)`, play = `playWav`, onSignal → `useTtsRuntimeStatus().reportSynthesis`). 재생을 새로 구현하지 않는다.
- 재생 단위 = `queue.playParts('replay', key, parts)`:
  - 구간 재생: `key = seg:{k}:{pace}`. 구간의 대화 줄마다 part 하나 — part 함수 안에서 #62c `{kind:'dialogue', idx, pace}` 로 `clips` 를 받아 그 오디오를 가져온다(**미리 전부 합성하지 않고 차례로** — 첫 소리 ≤2초). 조각이 2개 이상이면(대화 줄은 ≤80자라 드물다) 이어 붙여 part 하나로 돌려준다. `snapshot.chunkIndex` = 줄 순번 → 줄 강조·"{i}/{n}줄".
  - 예문·모범 답안·내 목소리: part 하나(#62c `grammar|application|speaking` / #21b).
  - (task-025) 줄 다시 듣기 `key = line:{idx}`(#62c `dialogue`, 구간 듣기 순서를 따라 slow/normal) · 오늘의 표현 `key = expr:{idx}`(#62c `chunk`, normal): part 하나, **onComplete 를 넘기지 않는다** — 진행 쓰기는 구간 키(`seg:{k}:{pace}`)만. 받는 중 표시는 `pb.loading(key)`(큐 `waiting` 또는 재생 손잡이 전).
- 탭 핸들러 안에서 **동기로 `unlockTtsAudio()`** 를 부른 뒤 재생한다(자동재생 정책, §7-0 ⑧). 막히면(`phase==='blocked'`) 누른 버튼이 "▶ 눌러서 듣기" → `resumeBlocked()`.
- 중단 없이 마지막 part 까지 끝났을 때만 `played[pace]` 에 그 구간을 넣고, 둘 다 들었으면 `segmentsDone` 에 넣는다.
- 멈춤: [■] = `interrupt('USER_STOP')` · 단계 이동·화면 가림·언마운트 = `interrupt('HIDDEN')` · 푸시투토크 누름 = `interrupt('BARGE_IN')`.
- 422 `TTS_UNAVAILABLE` → `reportSynthesis({ ok:false, status:422 })` → 스토어가 TEXT_ONLY 로 바뀌고, 화면은 `useTtsRuntimeStatus().snapshot.state === 'TEXT_ONLY'` 로 자막만 모양이 된다(전환 토스트는 스토어가 1회). 502·504·429·0 → 토스트(§9-8 ⓔ 문구) 후 대기 상태.
- 서명 URL 은 저장하지 않는다. 다시 들을 때는 #62c 를 다시 부른다(캐시 HIT).

#### D. 말하기 — `useRealtimeStt` + `lesson/useSpeakCheck.ts`
- ⑤ 는 `useRealtimeStt({ purpose:'TURN', config, maxSec: 30, onFinal })`(회화방과 같은 호출에서 `chatId` 만 뺌), ④ 말로 쓰기는 `useRealtimeStt({ purpose:'MIC_TEST', config, maxSec: 30, onFinal })`. `config` 는 #19 를 읽는 기존 경로 그대로(회화방과 같음).
- `SttAlert`·힌트·권한 흐름(웹 안내 / 앱 [앱 설정 열기])·앱 전환 토스트(`switchNotice`)는 §9·§11 규칙 그대로다.
- 녹음 중에는 본문 `aria-live="off"`, 인식 상자 `aria-hidden`, 토스트는 녹음이 끝난 뒤로 미룬다(§9-0 ⑨).

### 12-4. API 호출 계획 (정본 api-contract §2-11~§2-13 · #21 · #21b · #28 · #38 · #39)

| 화면·동작 | 엔드포인트 | 파라미터 | 쓰는 필드 | 오류 처리 |
|---|---|---|---|---|
| 오늘 홈 카드 | #58 `GET /api/v1/lessons/today` | — | `todayLessons[{id,status,title,titleKo,stageDone,topic,score,jobId}]` · `resume{id,title,titleKo,stageDone,date}` · `recommendation{topicId,topicTitle,level,reason,nextPreview}` | 실패 → 이 카드만 오류(단어 카드와 별개) |
| 홈 만드는 중 확인 | #55 `GET /api/v1/jobs/:id` | — | `status` | 실패는 무시(다음 주기) |
| 주제 목록 | #56 `GET /api/v1/topics` | (없음 — 서버가 수준 ±1) | `items[{id,title,titleJa,level,description,chunks[{chunkType,textJa,meaningKo,order}],lessonCount,lastLessonAt}]` · `level[]` | 오류 블록 + 다시 시도 |
| 수업 만들기 | #59 `POST /api/v1/lessons` | `{topicId}` \| `{sourceText}` | `lessonId,jobId,status,reused` | 400 `NOT_JAPANESE`(붙여넣기 오류 상자) · `one_of`(버그) · 404(토스트 "주제를 찾을 수 없어요.") · 409 `GENERATING{jobId,lessonId}` → 그 수업으로 · 429 · 0 |
| 수업 읽기 | #60 `GET /api/v1/lessons/:id` | — | `status,stageDone,score,source,topic,title,titleKo,progress,content,jobId,createdAt,completedAt` | 404 → L · 그 밖 → L 오류 |
| 대기 폴링 | #55 | — | `status,stage` | 네트워크 실패 → note, 간격 유지 |
| 진행 저장 | #61 `PATCH /api/v1/lessons/:id/progress` | `{stageDone?}` · `{progress:{listen:{segmentsDone,played:{slow,normal},memo:[{segment,ja}]}, quiz:{answers}, application:{answers}}}` — **서버 칸(`listen.proposed`·`speaking`)은 보내지 않는다** | (응답은 #60 모양 — 화면은 낙관 상태 유지) | 400 `monotonic` → #60 다시 · `LIMIT`·`DUPLICATE`·`NOT_JAPANESE` → 메모 오류 문구 · `TOO_LARGE`·그 밖 → "진행 상황을 저장하지 못했어요." · 409 `ALREADY_DONE`·`NOT_READY` → #60 다시 |
| 소리 | #62c `POST /api/v1/lessons/:id/audio` | `{kind:'dialogue'\|'grammar'\|'application'\|'speaking', idx, pace:'slow'\|'normal'}` | `clips[{url,durationMs,pauseBeforeMs}]`(`runtime` 은 쓰지 않음) | 422 `TTS_UNAVAILABLE` → 자막만 · 502·504·429·0 → 토스트(§9-8 ⓔ) |
| 들린 단어 제안 | #62a `POST /api/v1/lessons/:id/memo` | `{segments:[{segment, words}]}`(메모가 있는 구간만, 구간 ≤5·합 ≤15) | `proposals[]`(ProposalDto — `payload{surface,reading,meaning,via,lineIdx,memo}`) · `skipped[{surface,reason}]` | 400 `segment_range`(버그) · 429 "잠시 후 다시 눌러 주세요." · 0 → 네트워크 문구 |
| 제안 채택·거절 | #38 `POST /api/v1/proposals/:id/accept` · #39 `…/reject` | `{payloadOverride?:{meaning}}` | ProposalCard 그대로 | ProposalCard 그대로(409 이미 있음 등) |
| 말하기 확인 | #62b `POST /api/v1/lessons/:id/speaking` | `{itemId, text, utteranceId?}` | `used,matchedIds,missedIds,unknownIds,modelAnswer{ja,reading,ko},utteranceId,hasAudio` | 409 `UTTERANCE_*` → utteranceId 없이 1회 다시 · 400 `unknown_item`(버그) · 429·0 → 토스트 "확인하지 못했어요. 다시 말해 주세요." |
| 발화(앱 경로) | #21 `POST /api/v1/speech/utterances` | §11 라우터가 보낸다(화면은 모름) | `utteranceId` | §11 |
| 내 목소리 | #21b `GET /api/v1/speech/utterances/:id/audio` | — | wav | 404 → "녹음이 없어요. 내 목소리는 30일 동안만 보관해요." 후 버튼 숨김 |
| 수업 마치기 | #62 `POST /api/v1/lessons/:id/complete` | `{}` | `lesson,result{score,quiz{correct,total},applicationDone,expressions{usedIds,missedIds},nextPreview}` | 409 `ALREADY_DONE` → #60 + 토스트 · `STAGES_LEFT` → stageDone 4 저장 뒤 1회 다시 · 그 밖 → 완료 오류 줄 |
| 이어서 말하기 | #28 `POST /api/v1/chats` | `{kind:'TALK', topicId}` | `id` → `/study/ai/talk/{id}` | 404(주제) → 토스트 · 0 → 네트워크 문구 |

### 12-5. 컴포넌트 분해 (`src/components/lesson/*`)

| 파일 | 역할 |
|---|---|
| `TodayLessonCard.tsx` | 오늘 홈 카드(8상태) + `MiniSteps` |
| `cardState.ts` | `deriveLessonCard` 순수 함수 |
| `LessonTopicsScreen.tsx` · `TopicRow.tsx` · `TopicSheet.tsx` | 주제 고르기 |
| `LessonPasteScreen.tsx` | 붙여넣기 |
| `LessonScreen.tsx` | 수업 경로 루트 — #60 을 읽고 상태로 분기 |
| `LessonGenScreen.tsx` · `genCopy.ts` | 대기·실패, 경과 문구 |
| `LessonHeader.tsx` · `StageSteps.tsx` · `ReviewNote.tsx` | 수업 틀 |
| `StageUnderstand.tsx` · `SegmentCard.tsx` · `MemoBox.tsx` · `MemoSummaryCard.tsx` | ① |
| `StageGrammar.tsx` | ② |
| `StageQuiz.tsx` · `ChoiceButton.tsx` | ③ |
| `StageApply.tsx` | ④ |
| `StageSpeak.tsx` · `LessonVoiceBar.tsx` · `LessonTextBar.tsx` | ⑤ |
| `LessonEnd.tsx` · `endResult.ts` | 종료 카드, #60 → 결과 계산 |
| `ExprChip.tsx` · `PlayButton.tsx` · `Toggle.tsx` · `RoleChip.tsx` | 공용 조각 (task-025: `parts.tsx` 에 `ExprPlayChip`·`Spinner`·`InfoIcon` 추가) |
| `compare.ts` · `logic.ts` | (task-025) 응용 글자 비교 `compareAnswer` · 재생 키·속도 `lineReplayKey`/`exprKey`/`lineReplayPace`/`activeLineReplay`/`playLineReplay`/`playExpr` · 문제 표기 `quizPromptView`/`quizSummaryPrompt` — 단위 테스트 `__tests__/task025.test.ts` |
| `useLesson.ts` · `useLessonPlayback.ts` · `useJobWatch.ts` · `useSpeakCheck.ts` | 상태 |
| `lessonCopy.ts` · `labels.ts` · `matchLang.ts` | 문구(§12-8) · 단계·조각 라벨 · "가나·한자가 있으면 `lang=ja`" 판정 |

- 그대로 재사용(수정 없음): `BackBar`·`Card`·`Btn`·`BtnRow`·`Badge`·`ErrorBlock`·`EmptyBlock`·`Sheet`·`Toast`·`TeacherAvatar`·`TtsRuntimeStatusIndicator`·`PushToTalkButton`·`MicLevelMeter`·`useRealtimeStt`·`sttCopy`·`ttsAudio`·`chunkFetch`·`createTtsPlaybackQueue`.
- 조금 고쳐 재사용(선택 prop 추가, 기존 호출부 동작 불변): `ProposalCard` — `caption?: string`(기본 "단어 제안")·`note?: ReactNode` · `SttAlert` — `textModeLabel?: string`(기본 "글자로 대화하기", 레슨은 "글자로 답하기").
- 타입: `src/types/lesson.ts`(#56·#58·#59·#60·#62·#62a·#62b·#62c DTO — 필드명은 계약 그대로).

### 12-6. 생성/수정 파일 목록

- 신규: `src/app/(app)/study/today/talk/new/page.tsx`(서버 — `myLevel`) · `src/app/(app)/study/today/talk/new/paste/page.tsx` · `src/app/(app)/study/today/talk/[lessonId]/page.tsx`(서버 — `teacherName`·`learningSpeed`) · `src/components/lesson/*`(§12-5) · `src/types/lesson.ts`.
- 수정: `src/components/vocab/TodayHome.tsx`(#58 읽기·카드 넣기) · `src/components/vocab/TodayComingSoon.tsx`(ITEMS 에서 오늘의 회화 제거) · `src/components/shell/routes.ts`(`/study/today/talk/` 추가 — 전역 변경) · `src/components/chat/ProposalCard.tsx`·`src/components/talk/SttAlert.tsx`(선택 prop 추가).
- 서버·계약 변경 없음.

### 12-7. 구현 순서

1. 타입 + `cardState`(+테스트) → `TodayLessonCard`·`TodayHome`·`TodayComingSoon`(홈만으로 #58 확인).
2. 주제 고르기·시트·붙여넣기 → #59 → 수업 경로 루트 + 대기·실패(`useJobWatch`).
3. `useLesson`(쓰기 큐·복원) + 틀(머리·단계 표시·다시 보기).
4. ①(`useLessonPlayback`·구간·메모·#62a·ProposalCard) → ② → ③ → ④.
5. ⑤(`useRealtimeStt`·#62b·글자 모드) → #62 → 종료 카드(#62 결과 + #60 재계산) → 이어서 말하기.
6. 자막만·오류·404·재개 상태 → 3폭·780/892 점검(§12-9) → 데모 v2 와 나란히 대조.

### 12-8. 한국어 UI 문구 (`lessonCopy.ts` — 데모 v2 문구 그대로. ★ = 계약 때문에 더한 줄)

ⓐ **오늘 홈 카드**

| 자리 | 문구 |
|---|---|
| 머리 | 오늘의 회화 / 약 15분 |
| 로딩·오류 | 불러오는 중… / 오늘의 회화를 불러오지 못했어요. [다시 시도] |
| 시작 전 | 선생님과 5단계로 수업해요. 듣기 → 문법 → 문제 → 응용 → 말하기 / 추천 주제 / 지난 시간 예고 · {titleKo} / ★같은 주제를 세 번 했어요 · 새 주제로 넘어가 봐요 / ★아직 해 보지 않은 주제예요 / 수업 만들기 / 주제 고르기 / (aria) 수업 만들기, 추천 주제 {주제} |
| 만드는 중 | 수업을 만들고 있어요 / {주제} · 보통 1~2분 걸려요. 다 되면 여기서 열 수 있어요. / 보러 가기 |
| 하던 수업 | 하던 수업이 있어요 / {주제} · {오늘\|M월 D일} 시작 · 5단계 중 {n}단계 끝냄 / 다음은 {③ 문제}예요. 단계마다 저장돼요. / 이어서 하기 / (aria) 5단계 중 {n}단계 끝냄 |
| ★준비됨 | 수업이 준비됐어요 / {주제} · 5단계 · 약 15분 / 시작하기 |
| 만들기 실패 | 수업을 만들지 못했어요 / {주제} · 다시 만들면 대부분 잘 만들어져요. / 다시 만들기 / 주제 고르기 |
| 오늘 완료 | ✓ 오늘 수업을 끝냈어요 / {주제} · 문제 {c}/5 맞힘 / 다음 시간엔 / {titleKo} / 다음 수업 만들기 / 주제 고르기 / 끝낸 수업 결과 보기 |
| 이름 | (붙여넣은 수업) 붙여넣은 문장 |
| flash·토스트 | 오늘 만든 수업이 있어요. 이어서 할게요. / 만들고 있는 수업이 있어요. 끝나면 이어서 할 수 있어요. / 잠시 후 다시 눌러 주세요. / 연결하지 못했어요. 네트워크를 확인해 주세요. / ★주제를 찾을 수 없어요. / 만드는 중… |
| 곧 열려요 | AI 평가 — 내 단어와 표현으로 지금 실력을 점검해요. |

ⓑ **주제 고르기**

| 자리 | 문구 |
|---|---|
| 머리 | 주제 고르기 / 오늘의 회화 / (aria) 오늘로 |
| 안내 | 어떤 이야기로 수업할까요? 내 수준({N5})과 한 단계 위({N4}) 주제를 보여 드려요. (세 수준: 내 수준({N4})과 한 단계 위·아래 주제를 보여 드려요. / 한 수준: 내 수준({N5}) 주제를 보여 드려요.) |
| 행 | 지난 수업 {n}번 · {M월 D일} / 아직 수업하지 않았어요 |
| 로딩·오류·빈 | 주제를 불러오는 중… / 주제를 불러오지 못했어요. [다시 시도] / 보여 드릴 주제가 없어요. 문장을 붙여넣어 수업을 만들어 보세요. |
| 붙여넣기 카드 | 갖고 있는 문장으로 수업 만들기 / 드라마 대사나 교재 문장을 붙여넣으면 그 문장으로 수업을 만들어요. / 문장 붙여넣기 |
| 시트 | 이 주제의 표현 {n}개 / 이름 조각 · 액션 조각 · 느낌 조각 · 꾸밈 조각 / 지난 수업 {n}번 · {M월 D일} / 지난 시간 예고를 이어서 만들어요 · {titleKo} / 수업을 만드는 데 1~2분 걸려요. 만들기 시작하면 취소할 수 없어요. / 수업 만들기 / 만드는 중… / 닫기 |

ⓒ **붙여넣기**

| 자리 | 문구 |
|---|---|
| 머리 | 문장으로 수업 만들기 / 오늘의 회화 / (aria) 주제 고르기로 |
| 설명 | 일본어 문장을 붙여넣으면 선생님이 그 문장으로 5단계 수업을 만들어요. 드라마 대사·노래 가사·교재 문장이 좋아요. |
| 입력 | 붙여넣을 문장 / (placeholder) 예) 今日はいい天気ですね。(줄바꿈) そうですね。散歩に行きませんか。 |
| 안내 | 50자 이상 · 3~8줄이 알맞아요 / 50자 이상 넣어 주세요 · 지금 {n}자 / 2,000자까지 넣을 수 있어요 / 3~8줄이 알맞아요 / {n} / 2,000자 |
| 오류 | 일본어 문장이 너무 적어요. / 일본어가 들어간 문장을 붙여넣어 주세요. |
| 저장·버튼 | 붙여넣은 문장은 이 수업과 함께 저장돼요. / 이 문장으로 수업 만들기 / 수업을 만드는 데 1~2분 걸려요. 만들기 시작하면 취소할 수 없어요. / (막힘 토스트) 50자 이상 넣어 주세요 · 2,000자까지 넣을 수 있어요 |

ⓓ **대기·실패**

| 자리 | 문구 |
|---|---|
| 대기 | 수업 만들기 / 선생님이 수업을 만들고 있어요 / 주제와 지난 수업을 살펴보고 있어요 · 대화문을 쓰고 있어요 · 문법과 문제를 만들고 있어요 · 응용·말하기 과제를 고르고 있어요 · 마지막으로 확인하고 있어요 · 조금 오래 걸리고 있어요. 조금만 더 기다려 주세요. / {m:ss} · 보통 1~2분 걸려요 / 연결이 끊겼어요. 다시 연결되면 이어서 확인해요. 수업은 계속 만들어지고 있어요. |
| 순서 카드 | 이런 순서로 공부해요 / 이해 · 대화를 구간별로 듣고, 들린 단어를 메모해요 / 문법 · 대화에 나온 문형 1~3개 / 문제 · 4지선다 5문제, 바로 정답 확인 / 응용 · 상황에 맞는 문장 3개 직접 만들기 / 말하기 · 목표 표현을 넣어 말하기 3개 |
| 안내·버튼 | 이 화면을 나가도 수업은 계속 만들어져요. 다 되면 오늘 탭에서 열 수 있어요. 만들기 시작한 수업은 취소할 수 없어요. / 오늘로 돌아가기 / (토스트) 수업이 준비됐어요 |
| 실패 | 수업을 만들지 못했어요 / 선생님이 수업을 끝까지 만들지 못했어요. 다시 만들면 대부분 잘 만들어져요. / 다시 만들기 / 다른 주제 고르기 / ★(붙여넣은 수업, 원문 없음) 문장 다시 붙여넣기 |

ⓔ **수업 공통 · ① · ②**

| 자리 | 문구 |
|---|---|
| 머리 | (sr) 오늘의 회화, {주제}: / (aria) 오늘로 |
| 단계 | 이해 · 문법 · 문제 · 응용 · 말하기 / (aria) 수업 단계, 5단계 중 {n}단계 끝냄 / {n}단계 {이름}, 끝냄 · 지금 보는 단계 · 앞 단계를 마치면 열려요 / (토스트) 앞 단계를 마치면 열려요 |
| 이동 | 다음 단계 · ② 문법 (· ③ 문제 · ④ 응용 · ⑤ 말하기) / 지금 단계로 · {④ 응용} / 끝낸 단계를 다시 보는 중이에요. 저장된 답은 바뀌지 않아요. / 진행 상황을 저장하지 못했어요. 다시 눌러 주세요. / (토스트) {③ 문제}부터 이어서 해요. 앞 단계는 저장돼 있어요. |
| ① 제목·설명 | ① 이해 · 듣고 이해하기 / 구간마다 느리게 한 번, 보통 속도로 한 번 들어요. 들린 단어는 메모해 두세요. / (자막만) 지금은 선생님 목소리를 들을 수 없어요. 글자와 읽기로 대화를 따라가 보세요. |
| 보기 도구 | 읽기 / 번역 / (aria) 보기 설정 |
| 구간 | 구간 {k} · {a}~{b}줄 · 메모 {n} / 들었어요 / 읽었어요 / 느리게 ✓ · 보통 / 글자를 가리고 먼저 들어요. / 글자 보기 / (sr) {역할}, 글자 가림 / ① 느리게 · ② 보통 속도 / (aria) 듣는 순서 |
| 구간 상태 | 먼저 느리게 들어 봐요. / 이번엔 보통 속도로 들어 봐요. 글자와 함께 확인해요. / {느리게\|보통 속도로} 듣는 중 · {i}/{n}줄 / 이 구간을 다 들었어요. 들린 단어를 적고 다음 구간으로 가요. / 구간을 모두 들었어요. 아래에서 들린 단어를 단어장에 넣을 수 있어요. |
| 구간 버튼 | ▶ 느리게 듣기 · {0.8}배 / ▶ 보통 속도로 / 다시 느리게 / 다음 구간 / ▶ 다시 듣기 / ■ 멈춤 / ▶ 눌러서 듣기 |
| 줄 다시 듣기(task-025) | 줄 옆 ▶ 는 그 줄만 다시 들려줘요. ‘들었어요’는 아래 구간 듣기(느리게 → 보통)로만 채워져요. / {n}번째 줄을 불러오는 중… / {n}번째 줄 · {느리게\|보통 속도로} 다시 듣는 중 / (aria) {n}번째 줄[ 느리게] 다시 듣기 · {n}번째 줄 멈추기 |
| 자막만 | 지금은 선생님 목소리를 들을 수 없어요(자막만). 목소리가 돌아오면 듣기 버튼이 다시 보여요. / 읽었어요 · 다음 구간 / 읽었어요 |
| 메모 | 들린 단어 메모 / {n}/5 / 들린 단어를 일본어로 적어요. 뜻은 몰라도 괜찮아요. / 예) 注文 / 추가 / (aria) {단어} 지우기 / 이 구간은 5개까지 적을 수 있어요 / 일본어로 적어 주세요. 예) 注文, ちゅうもん / 이미 적은 단어예요. / 수업 전체에서 15개까지 적을 수 있어요. |
| 메모 모음 | 들린 단어 메모 / 아직 적은 단어가 없어요. 구간을 들으며 들린 단어를 적으면, 단어장에 없는 단어를 골라 제안해 드려요. / 들린 단어 {n}개 / 단어장에 없는 단어만 골라 제안해 드려요. 추가를 눌러야 저장돼요. / 단어장에 넣을까요? / 단어를 찾아보는 중… / 단어 제안 {n}개 · 선생님 제안이에요. 추가를 눌러야 단어장에 저장돼요. / 새로 적은 단어 {k}개도 제안받기 |
| 제안 카드 | 단어 제안 · 대화 {n}번째 줄 / 단어 제안 · 선생님이 찾아본 뜻 / 메모 {memo} → 사전에 싣는 모양으로 바꿨어요 / (버튼·처리 후 문구는 §3-8 ⓕ `ProposalCard` 그대로) |
| ② | ② 문법 · 표현과 문형 / 오늘 대화의 표현 조각과 문형 {g}개예요. 표현과 예문을 듣고 소리 내어 따라 읽어 보세요. / 오늘의 표현 {n}개 / 대화에 나온 표현 조각이에요. 누르면 소리를 들을 수 있어요. 문제·응용·말하기에서 다시 써요.(자막만: 가운데 문장 없음) / 새 표현 / (sr) , 듣기 · , 멈추기 / 문형 {i} / 예문 / (aria) 예문 듣기 · 멈추기 / 지금은 선생님 목소리를 들을 수 없어 표현·예문 듣기를 숨겼어요(자막만). |

ⓕ **제외 사유**(#62a `skipped[].reason`)

| 값 | 문구 |
|---|---|
| `IN_WORDBOOK` | 이미 단어장에 있어요 |
| ★`DUPLICATE` | 같은 단어를 두 번 적었어요 |
| ★`LIMIT` | 메모 한도를 넘어 제안하지 않았어요 |
| ★`NOT_JAPANESE` | 일본어 단어가 아니라 제안하지 않았어요 |
| ★`ENRICH_FAILED` | 뜻을 찾지 못했어요. 잠시 후 다시 눌러 주세요. (이때는 [단어장에 넣을까요?]를 다시 보인다) |
| (모르는 값) | 줄을 그리지 않는다 |

ⓖ **③ · ④ · ⑤**

| 자리 | 문구 |
|---|---|
| ③ | (task-025 옛 수업) 일본어 문장을 읽고 알맞은 답을 고르세요. / 이 문제에는 한국어 설명이 없어요. / ③ 문제 · {N}문제 / 답을 고르면 바로 정답과 설명이 나와요. 한 번만 고를 수 있어요. / 문제 {i} / {N} / ✓ 정답 / ✗ 내 답 / ✓ 맞았어요 / ✗ 틀렸어요 · 정답은 {k}번 / 다음 문제 / 결과 보기 / ③ 문제 · 결과 / {N}문제 중 {c}문제 맞혔어요 / 내 답 {보기} · 정답 {보기} / 틀린 문제의 표현은 수업을 마치면 복습할 항목으로 기록돼요. / (aria) 보기 · {k}번, {보기}, 정답 · 내 답, 틀림 |
| ④ | ④ 응용 · 문장 만들기 {N}개 / 상황에 맞는 문장을 직접 만들어요. 채점하지 않고, 모범 답안과 비교해 스스로 확인해요. / 상황 {i} / {N} / 써 볼 표현 / 문형 / 힌트 · {hintJa} / 내 문장 / 일본어로 써 보세요 / 말로 쓰기 / 글자로 쓰기 / {n} / 200자 / 여기에 알아들은 말이 나와요 / 모범 답안과 비교하기 / 먼저 문장을 써 보세요 / 모르겠어요 · 모범 답안 보기 / (쓰지 않고 봤어요) / 모범 답안 / ▶ 모범 답안 듣기 / 채점하지 않아요. 뜻이 통하면 다르게 써도 괜찮아요. 모범 답안을 소리 내어 따라 읽어 보세요. / 다음 상황 / 상황 {k} / (task-025 글자 비교) 글자가 다른 곳에 밑줄을 쳤어요 · 채점이 아니에요 / ＝ 모범 답안과 글자가 같아요. / 점선 모범 답안에 없는 글자 / 실선 내 문장에 없는 글자 / (sr) 모범 답안에만 있는 글자: {…}. 내 문장에만 있는 글자: {…\|없음}. / 채점하지 않아요. 밑줄은 글자가 다른 곳일 뿐, 뜻이 통하면 다르게 써도 괜찮아요. 문장부호·띄어쓰기 차이는 표시하지 않아요. 모범 답안을 소리 내어 따라 읽어 보세요. |
| ⑤ | ⑤ 말하기 · 과제 {N}개 / 목표 표현을 넣어 말해 보세요. 아래 버튼을 누른 채로 말하고, 다 말하면 손을 떼요. / 과제 {i} / {N} / 목표 표현 / ✓ 썼어요 / · 아직 / 버튼을 누른 채로 말하면 여기에 알아들은 말이 나와요 / 아래 입력창에 일본어로 써서 답해요 / 이 과제 건너뛰기 / (건너뛰었어요) / 내가 한 말 / 내가 쓴 답 / ▶ 내 목소리 / ✓ 목표 표현을 모두 썼어요 / 모범 답안과 비교해 보세요 · 아직 안 쓴 표현 {…} / 다시 하려면 아래 버튼을 또 누르고 말해요. / 다음 과제 / 수업 마치기 / 기록하는 중… / 수업 기록을 남기지 못했어요. 다시 눌러 주세요. / 여러 번 눌러도 기록은 한 번만 남아요. |
| ⑤ aria·입력 | 글자로 답하기 · 말로 답하기 · 확인하기 · 소리 멈추기 · 누르고 있는 동안 말하기 · 누르면 소리를 멈추고 말하기 / (입력창) 일본어로 써서 답해 보세요 |
| ⑤ 토스트 | 일본어로 답을 써 주세요 / ★확인하지 못했어요. 다시 말해 주세요. / 이미 끝낸 수업이에요. 결과를 보여 드릴게요. / 녹음이 없어요. 내 목소리는 30일 동안만 보관해요. |
| 상태 줄 | §8-8 ⓑ·ⓒ + 다시 하려면 또 누르고 말해요 / 듣는 중 · 누르면 멈추고 말해요 |
| 음성 인식 오류 | §8-8 ⓐ(`SttAlert`), 버튼만 "글자로 답하기" |

ⓗ **종료 카드 · 없음**

| 자리 | 문구 |
|---|---|
| 머리 | 수업을 마쳤어요 / {주제} · {M월 D일} / (aria) 오늘로 |
| 본문 | 수업을 마쳤어요 / 문제 정답 · 만든 문장 · 쓴 표현 / 말하기에서 쓴 표현 / 다음엔 이 표현도 써 보세요 / 오늘 배운 표현과 문형은 복습할 항목으로 기록했어요. / 단어장에 넣은 단어 {k}개 · 단어장에서 보기 |
| 다음 | 다음 시간엔 / 다음 수업 만들기 / 이 주제로 선생님과 이어서 말하기 / 회화 탭에서 ‘{주제}’ 이야기로 새 회화를 시작해요. / 오늘로 |
| ★붙여넣은 수업 | 다른 문장으로 수업 만들기 / 주제 고르기 (§12-11 ③ 결정 뒤 확정) |
| 없음·오류 | 이 수업을 찾을 수 없어요. / 주소가 잘못되었거나 삭제된 수업이에요. / 오늘로 / 수업을 불러오는 중… / 수업을 불러오지 못했어요. [다시 시도] |

### 12-9. 360/390/412 · 높이 780/892 · 접근성 체크리스트 (데모 v2 의 "세 폭"·"892" 와 나란히 대조)

폭·높이
- [ ] 세 폭 모두 가로 스크롤 0 — 제목 40자·대화 줄 80자·긴 보기·모범 답안 120자·메모 칩 5개·제안 카드 5장으로 확인(일본어 블록 `break-keep` 금지, `overflow-wrap:anywhere`).
- [ ] 오늘 홈 412×780·390×800·360×740: 단어 카드 [시작하기]와 수업 카드 주 버튼이 탭 바 위(첫 화면). 추천 주제 이름이 20자여도 두 줄 이내.
- [ ] 수업 화면 스크롤은 본문 한 곳, 머리·단계 표시·(⑤)입력 바는 고정. 390×780 에서 ⑤ 결과 카드와 입력 바가 겹치지 않고, 892 에서 입력 바가 safe-area 위에 있다.
- [ ] 360: 단계 표시 5칸 라벨이 잘리지 않음(칸 ≈68px), 듣기 순서 2칸·BtnRow 두 버튼 라벨이 한 줄("▶ 보통 속도로"·"다시 느리게"), 비교 상자 위아래.
- [ ] 412 에서도 비교 상자는 위아래(컨테이너 <440px).
- [ ] 키보드(⑤ 글자 모드·메모 입력·붙여넣기·④ 입력)가 올라와도 입력칸이 가려지지 않는다 — ⑤ 는 회화방 `--kb-inset`, 나머지는 스크롤 안 입력이라 포커스 때 `scrollIntoView({block:'nearest'})`.

소리·음성
- [ ] 첫 진입·[다음 구간]·단계 이동에서 소리가 저절로 나지 않는다(b=B). 탭 → 첫 소리 ≤2초(캐시 miss).
- [ ] 재생 중 줄 강조가 소리와 맞고, [■]·다른 재생·푸시투토크 누름에 즉시 멈춘다. 화면을 가려도 멈춘다.
- [ ] 느리게 들을 땐 글자가 가려지고, 보통 속도 시작·[글자 보기]에서 보이며, 자막만이면 처음부터 보인다(d=B).
- [ ] 서버 목소리 불가(422) → 표시등 "자막만" + ①②④⑤ 듣기 버튼이 사라지고 [읽었어요]로 진행할 수 있다. 마이크는 그대로 쓴다.
- [ ] 푸시투토크: 웹(서버 인식)·앱(휴대폰 인식) 둘 다 #62b 판정·내 목소리 재생까지. 마이크 거부 안내(웹/앱 문구).

기록(QA 가 행 수로 확인)
- [ ] 새로고침·나갔다 오기 → 같은 단계, 들은 구간·메모·문제 답·응용 답·말하기 결과가 복원된다.
- [ ] 문제는 한 번만 고를 수 있다(다시 눌러도 요청 0). 제안 [단어장에 추가] 전 단어장 행 0.
- [ ] [수업 마치기]를 두 번 눌러도 기록은 한 번(409 뒤 종료 카드).
- [ ] 끝낸 단계 다시 보기에서 쓰기 요청(#61·#62a·#62b) 0회.

접근성
- [ ] 모든 일본어(대화·읽기·칩·보기·모범 답안·메모·입력창)에 `lang="ja"`. 대화 17px·읽기 14px·캡션 ≥11px.
- [ ] 단계 표시 `aria-current="step"`·`aria-disabled`, 토글 `aria-pressed`, 구간 머리 `aria-expanded`, 시트 `role=dialog`(초점 가두기·Esc·닫을 때 복귀).
- [ ] 초점 이동: 단계 넘김 → 새 단계 h2 · 문제 답 → [다음 문제] · 다음 문제 → 첫 보기 · 말하기 결과 → 결과 줄 · 생성 완료 → ① h2 · 완료 → 종료 카드 h2.
- [ ] live 영역: 구간 상태 줄·문제 설명·말하기 결과 `role=status`. 녹음 중 본문 `aria-live="off"`·인식 상자 `aria-hidden`.
- [ ] 색만으로 구분하지 않는다(✓/✗/△ 글자·테두리·라벨). `accent`·`warn` 배경 위 글자 없음(§1-1).
- [ ] `prefers-reduced-motion`: 띠·스피너·녹음 링·펄스 정지.

엔진명
- [ ] 수업 관련 화면의 렌더 텍스트·토스트·DOM 속성에 `claude|haiku|sonnet|opus|qwen|reazon|whisper|style-bert|sherpa|zipformer|onnx|엔진|모델|trace|Phase|task-` 0건. #62c `runtime`·서명 URL·`lesson.error` 코드 미표시.

### 12-10. 주의사항

- **정답**: 레슨은 자습이라 정답을 화면이 갖고 있다(§5 단어 덱의 "정답 미노출"과 반대 — 헷갈리지 말 것). 대신 점수는 서버 값만 쓴다(종료 카드·오늘 홈).
- **쓰기 칸**: #61 로 서버 칸(`listen.proposed`·`speaking`)이나 모르는 키를 보내면 400. `quiz.answers` 는 배열 전체를 보내도 서버가 첫 답을 지킨다.
- **다시 보기**: 끝낸 단계에서는 어떤 쓰기도 보내지 않는다(#61·#62a·#62b 0회). 듣기(#62c)만 된다.
- **이탈**: 막지 않는다(뒤로가기 가로채기 금지). 모든 행위가 이미 저장돼 있고, 오늘 홈이 [이어서 하기]로 안내한다.
- **서명 URL·원문**: `clips[].url` 은 보관·로그 금지. 붙여넣은 원문은 `sessionStorage` 에만 두고(`READY` 가 되면 삭제) `localStorage` 에는 두지 않는다.
- **저장소 차단**: `kaiwa.lesson.*`·`kaiwa.chat.readingDefault` 는 전부 try/catch. 실패하면 기본값(읽기 켬·flash 없음·초안 없음)으로 동작한다.
- **날짜**: "오늘"·"M월 D일"은 서버 `date`·`completedAt` 을 KST 로 표시한다. 완료 기록은 완료한 날(계약).
- **동시 생성 1개**: 다른 수업을 만드는 중이면 새로 만들지 않고 그 수업으로 간다(409 처리). 버튼을 미리 막지 않는다.
- **엔진명**: 오류 문구는 §12-8 표만 쓴다. `error` 코드·`reason` 값을 화면에 그대로 쓰지 않는다.

### 12-11. Leader 확인 요청 (계약 ↔ 승인 데모 v2 — 의미가 달라지는 곳)

| # | 데모 v2 | 계약(구현) | 가이드가 한 것 / 요청 |
|---|---|---|---|
| ① | 오늘 홈 "오늘 완료": "문제 4/5 맞힘 · 말하기 표현 4/5" | #58 `todayLessons` 에 `score` 만 있고 표현 수가 없다 | "문제 {c}/5 맞힘"만(점수에서 계산). 표현 수를 살리려면 #58 항목에 `expressions{used,total}` additive 필요 — **결정 요청**(권고: 추가하지 않고 줄 생략) |
| ② | 주제 시트 "지난 수업 1번 · 9월 26일 「はじめての注文」" | #56 에 마지막 수업 **제목**이 없고, 예고는 #58 추천 주제 하나만 | 제목은 생략, 예고는 그 주제가 추천(CONTINUE)일 때만 보인다. 제목이 꼭 필요하면 #56 에 `lastLessonTitle` additive — **확인 요청** |
| ③ | 종료 카드 = 다음 시간엔 + [다음 수업 만들기] + [이어서 말하기] | 붙여넣은 수업은 `topic: null` — #59 다음 수업·#28 이어 말하기에 쓸 주제가 없다 | 권고: 붙여넣은 수업은 NextCard 대신 [다른 문장으로 수업 만들기]·[주제 고르기], 이어서 말하기는 숨김(데모에 없던 분기) — **결정 요청** |
| ④ | ④ "말로 쓰기" | 음성 인식 용도는 `TURN`(원음 저장)·`MIC_TEST`(저장 안 함) 둘뿐 | `MIC_TEST` 로 받는다(응용은 판정·재생이 없어 원음이 필요 없다). 이름만 어색하다 — 별도 용도가 필요하면 알려 달라 |
| ⑤ | 오늘 홈 카드 7상태 | `READY && stageDone 0`(만들어졌지만 시작 전) 상태가 생긴다 | "수업이 준비됐어요 / [시작하기]" 문구 변형을 추가(레이아웃은 "하던 수업"과 같음). 의미 변화는 없다고 판단 — 이의가 있으면 알려 달라 |
| ⑥ | 종료 카드 "단어장에 넣은 단어 2개" | #60·#62 에 채택 수가 없다(`listen.proposed` 는 제안 시점 결과) | 이 수업 화면에서 누른 수를 `sessionStorage` 로 세고, 모르면(다른 기기·재방문) 줄을 숨긴다. 늘 보이려면 #62 `result` 에 채택 수 additive |
| ⑦ | 회화방으로 넘어가며 토스트 "‘카페 주문’ 회화를 시작했어요" | 회화방은 task-007 화면 | 회화방을 고치지 않으려고 **생략**(이동만 한다). 필요하면 회화방 flash 읽기를 별도 승인으로 |
| ⑧ | 제안 카드 버튼 [단어장에 추가]/[괜찮아요] | 기존 `ProposalCard` 에는 "✎ 뜻 고쳐서 추가"도 있다 | 그대로 둔다(같은 컴포넌트, 기능이 하나 더 있을 뿐) |
| ⑨ | — | `routes.ts` 전역 목록 | `/study/today/talk/` 를 집중 화면에 추가(탭 바·권장 업데이트 띠 숨김) — 전역 변경 |

---

## 13. 관리자 콘솔 P2 — 설정 편집·이력·되돌리기 (task-012c)

승인 데모: docs/demo/task-012c-console-p2-v2.html (v2)

> **`task-012c-v2`, 사용자 승인 2026-10-01 08:17("대기 중인 데모 전부 권고안대로 승인"), sha256 `39b19fc8…5067583e`** — 결정 **d1=B**(Form 은 바꿀 수 있는 칸 먼저, 잠긴 칸은 "바꿀 수 없는 설정 n개"로 접기) · **d2=A**(휴대폰 Raw JSON 편집은 경고 띠만) · **d3=A**(감사 전·후는 키마다 한 줄, DEVELOPER 이상 원문 JSON 펼침) · **d4=A**(연결 상세에서 같은 화면 편집) · **d5=A 이지만 이번 범위 밖**(목소리 기본값 편집은 D-C14 로 012c-2 — 대상 종류에 없다) · **d6=A**(운영 설정은 키 하나 = 대상 하나). 데모 상태는 주소 `#<id>`(예: `…-v2.html#cfg-prod-confirm`)로 바로 열리고, 아래 `#id` 는 그 상태를 가리킨다.
> **사후 가이드**: 화면은 developer B 가 데모를 직접 따라 먼저 만들었다(2026-10-01 09:20 → REV-047 M-1·L-1 수정 13:26 → REV-056 문구 14:11). 이 절은 **그 구현에 맞춘다** — 컴포넌트·함수·문구는 실제 코드 이름 그대로다. 코드와 이 절이 어긋나면 §13-11 표에 적힌 곳 말고는 코드가 사실이고 이 절을 고친다. 데모와 다른 점 = §13-11, 판단이 필요한 것 = §13-12.
> 정본: `configuration-resolution.md` §6(Edit→Validate→Test→Diff→Apply·버전 상태 전이)·§7(환경)·§8(8-1 고정 흐름·8-2 엄격 키·8-4 Rollback 도 테스트 필수) · `role-permission.md` §3·§4-2·§6·§7 · `api-contract.md` #91a·#93·#93a·#93b·#99a·#100·#101·#102·#104~#111·#123b·#137 · `admin-console/` 01·03·06~10·16. DTO 단일 출처 `src/types/admin.ts`(화면·서버 공유).
> 재사용: §6 콘솔 셸·`ConsoleSegmented`·`ChipRadio`·`ConsoleStates`(`ConsoleLoading`·`ConsoleError`·`LoadError`·`EmptyNote`·`BackLink`·`ConsoleForbidden`)·`StatusBadge`·`KeyValueList`·`EngineTestPanel`·`SecretsSheet`·`EffectiveRow`·`SourceBadge`·`useAdminResource`·`useConsoleToast` · §10 발음 사전의 쓰기 확인 칸·버전 행 모양 · 공용 `Sheet`·`Card`·`Badge`. **새 색 없음.**
> **적용 토큰**(`src/app/globals.css`, 이름만): `ground` · `surface` · `surface2` · `ink` · `ink2` · `ink3`(입력 placeholder 만) · `line` · `accent` · `accent-soft` · `on-accent` · `good` · `good-soft` · `warn-soft`(배경만 — 그 위 글자는 `ink`) · `bad` · `bad-soft` · `--radius`(14px) · `--kb-inset`(공용 `Sheet` 가 씀). `warn` 글자·`accent-soft` 위 `accent` 글자는 쓰지 않는다(§1-1). 데모 토큰 출처 `globals.css@sha256:22f382529f92` ↔ 지금 `bf67d6c60da2` — task-021 키보드 규칙만 늘었고 색 값 15개는 같다(대조함).

### 13-0. 한눈에 보는 결정

1. **바뀌는 곳 4 + 새 화면 1**: 설정 `/admin/configuration`(Effective 탭만 → Effective·Form·Raw JSON·Diff + 대상 종류 + 적용 막대) · 연결 상세(사용 여부 스위치·[설정 편집]·[비밀 참조 연결]) · 역할 페이지([순서 편집]) · 발음 사전 운영 이유 10자 검사(문구만, §13-2 O) · **새 화면 `/admin/history`**(설정 버전·감사 기록·되돌리기 — 메뉴 "도구 › 이력").
2. **편집기 하나**: 설정 화면·연결 상세 편집·예비 순서 편집이 같은 `useConfigEditor`(초안·흐름·확인 창 상태) + `EditorChrome`(적용 막대·적용 확인 창·초안 버리기)을 쓴다. 다른 것은 쓰기 함수(`Writer`)뿐 — #107/#111 · #93(그 밖 키는 #107) · #100.
3. **Form·Raw JSON 은 초안 하나**. Raw JSON 편집 중에는 Raw 글이 초안의 원본이라 Form 칸을 바꾸면 그 값을 글에 넣고 다시 읽는다. 적용은 **확인한 변경 요약과 같은 변경**만 보낸다(`applyPayload` — 어긋나면 초안 patch 로 보내고 화면에 알린다, REV-047 M-1).
4. **흐름 = 검증 → 테스트 → 요약 → 적용**(순수 `flowView`). 개발 환경: 테스트 건너뛰기·`partial` 이어 가기 가능. 운영(PRODUCTION): 테스트 필수·`partial`/`failed` 적용 불가·적용은 최고관리자만 — 비 최고관리자는 **초안·변경 요약까지**(적용 단계 🔒, 버튼 없음).
5. **운영 확인 창**: 요약 해시 · 기능 테스트(30분) · 이유 10~200자 · `PRODUCTION` 입력. 한 번에 쓰는 창(켜기/끄기·비밀 참조·되돌리기)은 `useWritePrep` 가 같은 후보로 #106 요약 해시와 #105 테스트 결과 id 를 붙인다. 끄기는 테스트 면제(Leader 09-29 03:50 ②).
6. **권한 없는 버튼은 그리지 않는다**(비활성으로 남기지 않는다). 순수 `configAccess(can, env)` 가 역할×환경 갈래를 정하고 서버가 매 요청 다시 검사한다.
7. **비밀 값 입력 칸 0**: 비밀 참조는 이름만 고른다(#101 `allowedFor` ∩ 서버에 있음). 이유·설정 값의 비밀 유사 문자열은 서버가 거절하고(422 `E_REASON_SECRET_LIKE` · 400 `secretValue`) 화면은 원문을 되돌려 보이지 않는다.
8. **이력은 지우지 않는다**: 되돌리기 = 과거 내용으로 새 버전(밀려난 직전은 "되돌려짐"). 첫 적용은 기준선 v1 + 적용 v2. 손상·규칙 위반 스냅샷은 비교·되돌리기 버튼을 그리지 않는다.
9. 엔진·모델 이름은 서버 DTO 의 표시명만 그린다 — 화면 코드·문구 상수에 하드코딩 0(`configCopy.ts` 머리 주석, REV-054 grep 0).
10. 폭은 §6 그대로(데스크톱 우선 + 모바일 대응): ≥1024 사이드바 232px + 본문 최대 960px, 360/390/412 가로 스크롤 0, 세로 스크롤은 `main` 하나(시트 안·Raw 편집기 가로 스크롤은 예외).

### 13-1. 화면 개요 · 메뉴 · 권한 갈래

| 항목 | 내용 |
|---|---|
| 목적 | 관리자가 엔진 연결·예비 순서·운영 설정을 Form 또는 Raw JSON 으로 고치고 검증·기능 테스트·변경 요약을 거쳐 적용한다. 적용마다 설정 버전(`ConfigurationVersion`)+감사(`AuditLog`)가 한 트랜잭션으로 남고, 이력 화면에서 과거 버전 내용으로 되돌린다(새 버전) |
| 진입 | 메뉴 "설정·진단 › 설정" · 역할 페이지·연결 상세 "설정값 전체 보기 ›"(`&tab=effective`) · 연결 상세 사용 여부 스위치·[설정 편집]·[비밀 참조 연결] · 역할 페이지 [순서 편집] · 메뉴 "도구 › 이력" · 설정 요약 카드 "버전 기록 ›"(`/admin/history?scope=&target=`) · 감사 행 "버전 보기 ›" |
| 역할별 가시성 | USER: `/admin/**` 전부 앱 공통 404(§6) · ADMIN: Effective·Form·Diff 탭, 개발 환경 적용·되돌리기, 감사 키별 전·후 · DEVELOPER: + Raw JSON 탭(보기·편집)·감사 원문 JSON·Trace 링크 · SUPER_ADMIN: + 운영 적용·운영 되돌리기·비밀 참조 연결·감사 환경 필터 (아래 매트릭스) |
| 앱/웹 분기 | 없음(앱 WebView ≈390 에서도 같은 화면) |
| 하단 탭 | 없음(콘솔 별도 셸, §6) |
| 주소 상태 | 설정 `?scope=APP_SETTING&target=<연결 key·설정 키>&tab=effective\|form\|raw\|diff`(기본 탭 Form, 옛 `?target=<연결 key>` 그대로 열림) · 이력 `?tab=audit` · `?scope=&target=`(대상 고정) · `?v=<버전 id>`(상세 시트가 열린 채) — 서버 `page.tsx` 가 형식(정규식)을 걸러 넘기고 클라이언트는 `useSearchParams` 를 쓰지 않는다 |

**메뉴** — `src/modules/admin/console/menu.ts`(이 task 의 hunk) · `labels.ts` `MENU_SUB`:

| id | 이번에 바뀐 것 |
|---|---|
| `configuration` | 탭 `form`(config.edit)·`raw`(config.raw.read)·`diff`(config.edit) phase 1 · 메뉴 설명 "실제 적용값·편집" |
| `history` | phase 2 → **1**(그룹 "도구") · 메뉴 설명 "설정 버전·감사 기록·되돌리기" (`#hist-menu`) |

화면의 탭 줄은 `menu.ts` 탭이 아니라 `configTabs(access)` 가 같은 capability 로 정한다. 페이지 가드(`requireConsolePage`): `/admin/configuration` = `config.effective.read` · `/admin/history` = `audit.read` · 연결 상세·역할 페이지는 §6 그대로 `engine.read`.

**권한 갈래** — `configAccess(can, env)`(`configEditor/configAccess.ts`, 순수 — 단위 테스트가 역할×환경 6갈래를 고정):

| 필드 | 규칙 | 쓰는 곳 |
|---|---|---|
| `canEdit` | `config.edit` | Form 입력칸·적용 막대(검증·요약까지)·Diff 탭 |
| `canRaw` / `canRawEdit` | `config.raw.read` / + `config.edit` | Raw JSON 탭 / [JSON 편집] |
| `canTest` | `functional_test.run` | 막대 [기능 테스트] |
| `canApply` · `needsConfirm` | `config.edit` && (비 PRODUCTION \|\| `config.apply.production`) · canApply && PRODUCTION | 막대 [적용…] · 확인 창 PRODUCTION 입력 |
| `canManageConn` · `canApplyConn` | `engine.connections.manage` · + 운영이면 최고관리자 | [설정 편집]·[순서 편집] · 사용 여부 스위치·연결/예비 순서 적용 |
| `canCredential` | `credentials.manage`(SUPER_ADMIN) | [비밀 참조 연결] |
| `canSecretsRead` | `secrets.read_ref` | [있는지 확인] |
| `canRollback` · `rollbackProdOnly` | `config.rollback` && 운영이면 최고관리자 · `config.rollback` 은 있으나 운영 비 최고관리자 | 되돌리기 버튼 · 버튼 대신 안내 한 줄 |
| `canTrace` · `canAudit` · `canOtherEnv` | `trace.read` · `audit.read` · `environment.policy` | Trace 링크·감사 원문 JSON · "버전 기록 ›" · 감사 환경 필터 |

보이는 것(역할 × 환경) — **표에 없는 버튼은 DOM 에 없다**:

| 요소 | ADMIN·LOCAL | ADMIN·PROD | DEVELOPER·LOCAL | DEVELOPER·PROD | SUPER·LOCAL | SUPER·PROD |
|---|---|---|---|---|---|---|
| 탭 | Effective·Form·Diff | 같음 | + Raw JSON | + Raw JSON | + Raw JSON | + Raw JSON |
| 막대 마지막 단계 | [적용…] | 🔒 + 안내 | [적용…] | 🔒 + 안내 | [적용…] | [PRODUCTION 에 적용…] |
| Raw [JSON 편집] | — | — | ○ | ○(요약까지) | ○ | ○ |
| 사용 여부 | 스위치 | 글자 | 스위치 | 글자 | 스위치 | 스위치 |
| [설정 편집]·[순서 편집] | ○ | ○(요약까지) | ○ | ○(요약까지) | ○ | ○ |
| [비밀 참조 연결] | — | — | — | — | ○ | ○ |
| [있는지 확인] | ○ | ○ | ○ | ○ | ○ | ○ |
| 버전 되돌리기 | 버튼 | 안내 한 줄 | 버튼 | 안내 한 줄 | 버튼 | 버튼 |
| 감사 원문 JSON·Trace | — | — | ○ | ○ | ○ | ○ |
| 감사 환경 필터 | — | — | — | — | ○ | ○ |

### 13-2. UI 구조 (의사코드, 390px 기준 — 데모 상태 id 인용)

#### A. 설정 화면 — `ConfigScreen` → `Workspace` (`#cfg-compare` · `#cfg-effective` · `#cfg-loading` · `#cfg-error` · `#cfg-forbidden`)

```
page.tsx(서버): requireConsolePage('config.effective.read') → 아니면 ConsoleForbidden
ConfigScreen({ initialScope, initialTarget, initialTab })
  conns = #91 전체(useAdminResource)            로딩 ConsoleLoading · 실패 LoadError name="연결"
  TabsBar   ConsoleSegmented "설정 보기" [Effective | Form | Raw JSON | Diff {바뀐 수}]   ← configTabs(access), 2개 미만이면 그리지 않음
  TargetPicker
    ConsoleSegmented "대상 종류" [연결 | 운영 설정]                 ← EDIT_SCOPE_OPTIONS. 종류를 바꾸면 그 종류의 첫 대상
    ChipRadio "대상"   연결 = key(모노) · 운영 설정 = APP_SETTING_KEYS 9개 한국어 이름
  대상 읽기: 연결 #102(scope=ENGINE_CONNECTION) / 운영 설정 #123b GET    로딩 ConsoleLoading · 404 EmptyNote "대상을 찾을 수 없어요." · 실패 LoadError name="설정값"
  Workspace key="{scope}:{target}"                                    ← 대상이 바뀌면 초안이 새로 시작
    Card flat 요약
      1줄 13px: 연결 "{이름} · {역할} · {엔진 표시명} · 스키마 v{n}" / 운영 설정 "운영 설정 · {키(모노)}[ · 환경 정책 키(읽기만)]"
      2줄 12px ink2: "지금 v{n} 사용 중 · {env}" | "아직 설정 버전 없음 — 처음 적용할 때 기준선 v1 이 함께 생겨요 · {env}"
            [버전 기록 ›](audit.read && v{n} 있음, LINK_SM 44px) → /admin/history?scope=&target=
    AppliedNote(적용 결과 한 줄 — E 절)
    (rawIgnored) Note warn "Raw JSON 글은 적용하지 않았어요 — 확인한 변경 요약과 달라, 변경 요약(초안) 기준으로 적용했어요. …"
    (rebased && 바뀐 값) Note warn "최신 값 기준으로 다시 불러왔어요 — 지금 v{n}. 내 초안은 그대로 두었어요(같아진 값은 뺐어요). 다시 검증해 주세요."
    탭 본문(B~D)
    EditorChrome(showBar = tab ≠ effective)                            ← 적용 막대·적용 확인 창·초안 버리기(E·F)
    SecretsSheet(canSecretsRead) · CredentialSheet(canCredential && 연결 대상, I 절)
    ConfirmDropSheet "다른 대상으로 옮길까요?"                          ← 바뀐 값이 있는데 대상·종류를 바꾸면 (`#cfg-switch`)
```

- 탭·대상을 바꾸면 `router.replace(configHref(scope, target, tab), {scroll:false})`. **Raw JSON 원문(#110)은 그 탭을 처음 열 때만** 읽는다(운영 대상은 조회마다 감사 1행 — 페이지 진입·대상 칩만으로 남기지 않는다).
- Raw JSON 문법 오류가 있으면 Form 탭으로 못 간다(토스트 "Raw JSON 문법 오류를 먼저 고쳐 주세요").
- 바뀐 값이 있으면 새로 고침·창 닫기 전에 브라우저 확인(`beforeunload`).
- Effective 탭: 연결 = `EffectivePanel`(§6-2 I 본문 그대로 — 출처 8층·키 검색·출처 칩·`EffectiveRow`) · 운영 설정 = 한 행(키 모노 / 값 15px — 미리듣기 문장은 `lang="ja"`, 그 밖 모노 / `SourceBadge` DATABASE\|DEFAULT · editability · 행이 없으면 "저장된 행 없음 — 기본값을 써요").

#### B. Form 탭 — `FieldList`(d1=B) (`#cfg-form` · `#cfg-form-dirty` · `#cfg-form-errors` · `#cfg-form-service` · `#cfg-form-cli` · `#cfg-form-app` · `#cfg-prod-lock`)

```
(Raw 문법 오류) Note bad role=alert "Raw JSON 에 문법 오류가 있어 Form 을 잠갔어요 / Raw JSON 탭 {줄}행 근처를 고치면 다시 열려요. 초안은 마지막으로 읽힌 값이에요."  + 칸 전부 disabled
(테스트 결과) ConfigTestCard (F 절)
(검증 오류) Note bad role=alert "검증에서 {n}개를 고쳐야 해요" + 줄마다 [칸 이름](누르면 Form 탭·그 칸으로 스크롤·포커스) — {message}
(스키마 밖 키) [스키마 외 키 {n}개](warn-soft 뱃지, 글자 ink) "Raw JSON 에서 넣은 키예요 — 검증에서 걸러져요"
FieldList (enabled 키는 숨김 — 연결 상세 스위치 #93a 에서)
  for 묶음 g (키 첫 마디: connection "연결" · runtime "실행 설정" · logging "로그"; 운영 설정은 제목 없음):
    <h3 15 semibold>{묶음 이름}</h3>  <span 모노 12 ink2>{g}.*</span>
    입력 칸 카드 (rounded-[14px] border bg-surface px-3.5, @container) — FieldRow × 입력 가능한 키
    <details> "▸ 바꿀 수 없는 설정 {n}개 ({이유별 개수 — 예: 서비스 관리 3 · 읽기 전용 2})"   ← 입력 칸이 0개면 펼친 채
       잠긴 FieldRow × n
(정책 없음) EmptyNote "이 대상은 편집 정책을 불러오지 못해 Form 을 열 수 없어요."
(연결) 12px ink2 "사용 여부는 연결 상세에서, 예비 순서(기본·예비 연결)는 역할 페이지에서 바꿔요 [연결 상세 ›]"
```

**FieldRow**(`data-field={key}`, 컨테이너 ≥620px 이면 이름 2 : 값 3 두 칸, 아니면 위아래):
```
이름  label 14 semibold {칸 이름} [엄격](StrictBadge — 빨간 테두리) [바뀜](ChangedBadge)  / 키 모노 12 ink2
값    잠금        → LockedValue: surface2 상자 🔒 {값} · {잠금 이유 한 줄} · (SHADOW) "저장값 {값}" + ENVIRONMENT 배지 · (그 밖) LockBadge  — 입력 DOM 없음
      비밀 참조   → SecretValue: "{참조 이름} 🔒" | "연결 안 됨" · "값은 화면·저장소 어디에도 없어요. 서버에 넣어 둔 비밀의 이름만 가리켜요."
                     [있는지 확인](canSecretsRead && 참조 있음) [비밀 참조 연결](canCredential && 연결 대상) — 둘 다 44px 링크, 시트 열기
      입력        → InputControl
                     BOOLEAN Switch(켜짐/꺼짐, 44px) · 목소리 키 select(목록에 없는 값은 "{id} (목록에 없음)" 맨 위)
                     ENUM ≤3 ConsoleSegmented + 아래 모노 값 · ENUM >3 select
                     여러 줄(미리듣기 문장, lang=ja)·JSON textarea 3줄(JSON 은 모노) · 그 밖 input 16px 모노(inputMode url|numeric|decimal|text)
      도움 줄 12 ink2: SourceBadge · editability · 범위("{min}~{max}" · "{n} 이상|이하" · "{n}자까지") · "실행 검증 없음"(verifiable NO) · 글자 수(여러 줄)
      설명이 칸 이름보다 길면 원문 설명 한 줄 더
      바뀜 → "원래 값 {기준값} [원래대로]"
오류  FIELD_ERROR "{message}[ · 혹시 {suggestion} 인가요?]"  (입력에 aria-invalid·aria-describedby)
```
- 칸 이름 = 서버 설명의 첫 마디(`fieldLabel` — " — "·". "·" → " 앞, 40자), 설명이 없으면 키의 끝 두 마디.
- 기준값 = 저장값, 저장값이 없으면 Effective 값(바꾸지 않은 칸을 저장값으로 새로 쓰지 않는다). 기준값과 같아지면 초안에서 빠진다.
- **잠금 순서**(`fieldLock`): 서버 잠금(`lock`) → env 가 덮음(SHADOW) → 운영에서 실행 검증 방법 없음(NOVERIFY). 뱃지 이름은 §13-8 `LOCK_BADGE`, 이유는 서버 `lockMessage` 우선(없으면 `LOCK_WHY_FALLBACK`), 화면 잠금 두 가지는 `CLIENT_LOCK_WHY`.

#### C. Raw JSON 탭 — `RawTab`(DEVELOPER 이상, d2=A) (`#cfg-raw` · `#cfg-raw-edit` · `#cfg-raw-syntax`)

```
surface2 상자: "저장값 JSON · v{n}|버전 없음(초기값) · 스키마 {schemaRef}(모노)"
               12 ink2 "콘솔 적용값·연결 프로필 층만(환경 변수·설정 파일 값 없음)[ · 실제 값과 다른 키 {effectiveDiffers}]"
(canRawEdit && 가림 값 없음) [JSON 편집](aria-pressed, 44px) "읽기 전용으로 보고 있어요."  ↔  [✓ JSON 편집 중] "Form 과 같은 초안이에요. 고친 값은 Form 에 바로 보여요."
(canRawEdit && 가림 값 *** 있음) Note neu "가려진 값(•••)이 있는 문서라 JSON 편집을 열지 않아요 — Form 탭에서 바꿔 주세요."
(편집 중 · <1024 만) Note warn "휴대폰에서는 실수하기 쉬워요 — 쉼표 하나로 전체가 깨져요. 가능하면 컴퓨터에서 고쳐 주세요(막지는 않아요)."
(문법 오류) Note bad role=alert "JSON 문법 오류 — {줄}행 {열}열 근처 / 쉼표나 따옴표가 빠졌는지 확인해 주세요. 고치기 전까지 Form 탭과 [검증]이 잠겨요."
편집기 grid [줄 번호 | 본문]  (rounded-xl border, 모바일 16px/24px · ≥1024 13px/20px)
   줄 번호 aria-hidden, 오류 줄 = "●{n}" bad-soft·bad
   편집 중 textarea aria-label "설정 JSON"(wrap=off, 줄 수만큼 높이 — 세로 스크롤은 main, 가로 스크롤은 편집기 안) / 보기 pre aria-label "설정 JSON(읽기 전용)"
(오류) role=alert 카드 "검증 실패 · {n}건" — 행: [{줄}행] {키 모노} [{rule 코드}](title = RULE_KO) / {message} / (제안 && 편집 중) [{from 끝 마디} → {to 끝 마디} 로 바꾸기]
꼬리 12 ink2 "맨 바깥의 x- 로 시작하는 키(예: x-note)는 메모로 둘 수 있지만 저장되지 않아요."
```
- 글 → 초안은 300ms 뒤 읽는다(`parseRawText` — 서버 #111 과 같은 문서↔평면 키 대응). 저장값 키를 지우면 그 키에 로컬 오류 "저장값의 키를 지울 수 없어요 — 값을 바꿔 주세요.", `__proto__`·`constructor`·`prototype` 이름은 "쓸 수 없는 키 이름이에요(__proto__·constructor·prototype) — 지워 주세요."(초안에 넣지 않음, REV-047 L-1).
- 편집을 끄면 글을 버리고 초안(마지막으로 읽힌 값)만 남는다. 제안 바꾸기는 첫 일치 줄의 끝 마디 이름만 바꾼다(REV-047 L-3 — §13-12 ⑧).

#### D. Diff 탭 (`#cfg-diff` · `#cfg-diff-empty` · `#cfg-prod-partial`)

```
바뀐 값 0 → EmptyNote "바뀐 값이 없어요. / Form [또는 Raw JSON ]에서 값을 바꾸면 여기에 변경 요약이 나와요."
머리  <h3 15 semibold>변경 요약</h3>  12 ink2 tabular "v{지금|0 (초기값)} → v{다음}"   ← 첫 적용(지금 0)이면 다음 = 2(기준선 v1 이 함께)
  서버 요약 있음: "서버 변경 요약 · 방금 만듦[ · 요약 해시 {앞 6…뒤 4} (적용할 때 서버가 다시 계산해 대조해요)]"   ← 해시는 운영만
  없음: "아직 서버 변경 요약을 만들지 않았어요 — 검증[·기능 테스트] 뒤 [변경 요약 보기]를 누르면 확정돼요. 아래는 초안 미리 보기예요."
SummaryChips(ul aria-label "변경 요약 수"): 바뀜 n · 엄격 n(1↑ 이면 빨간 테두리) · 효력 없음 n(있을 때만, 빨간 테두리) · 비밀 참조 바뀜|그대로 · (운영 + 서버 요약) 기능 테스트 필요|불요
(운영) Note bad "운영(PRODUCTION) 적용에 필요한 것 / 최고관리자(SUPER_ADMIN) · 바뀐 키를 모두 실행으로 확인한 기능 테스트(30분 안) · 이 변경 요약 · 이유 10자 이상 · PRODUCTION 입력[ · 엄격 키는 최고관리자 본인이 직접]"
ConfigTestCard(있으면)
DiffList(서버 changes) | DraftPreviewList(초안 — 전 → 후만)       "바뀌지 않은 키 {n}개"(서버 요약)
```
**DiffRow**: [추가|바뀜](글자 뱃지 — 색으로 종류를 말하지 않는다) {키 모노} [엄격] / {전}(취소선 ink2) → {후}(sr-only "에서 다음으로") / 출처 전 → 후 배지 · editability · `VERIFIABLE_KO` / blocked: `SHADOWED_BY_ENVIRONMENT` = warn-soft "효력 없음 — 환경 변수가 이겨요. 저장은 되지만 실제 값은 그대로예요." · 그 밖 = 빨간 테두리 "적용할 수 없는 키 — {서버 message}". 값은 `valueText`(비밀 참조는 이름만, 서버 경로·가림 값은 §6 표시 규칙, 예비 순서는 연결 이름).

#### E. 적용 막대 — `FlowBar` + `flowView` (`#cfg-form-dirty` · `#cfg-testing` · `#cfg-test-fail` · `#cfg-test-partial` · `#cfg-test-429` · `#cfg-prod-viewer` · `#cfg-prod-flow`)

- 나오는 때: 설정 화면은 바뀐 값 ≥1 && 탭 ≠ Effective, 연결·예비 순서 편집은 편집 중 늘(바뀐 값 ≥1).
- 자리: `fixed` 화면 아래(`z-[8]`, ≥1024 `left-[232px]` = 사이드바 오른쪽), 안쪽 최대 912px. 모바일 = 단계 줄(4칸 26px, 12px) / 안내 한 줄(12px ink2, `aria-live=polite`) / 버튼 줄(h-11, 칸 나눔) 세로 쌓기, ≥1024 = 세 칸 한 줄. 아래 여백 `max(10px, env(safe-area-inset-bottom))`. 본문 끝에 빈 자리 150px(≥1024 84px — 막대 자체 높이는 모바일 119px·1280px 63px 로 실측)를 둬 마지막 칸이 가려지지 않게 한다. 키보드가 열린 동안은 막대(fixed 영역)만 숨기고 빈 자리는 남긴다(하단 탭과 같은 규칙 — `html[data-kb]`, `FlowBar` 의 `[:root[data-kb]_&]:hidden`, 012c QA 결함 #1) — 지금 앱(1.0.1) WebView 는 키보드가 창을 줄이지 않아(`data-kb` 가 켜지지 않음) 대상 밖이다(task-021 네이티브 보정 APK 가 들어오면 같은 규칙으로 숨는다).
- 단계 4칸 `role=region aria-label="적용 단계"`: 검증 · 테스트(운영 "테스트(필수)") · 요약 · 적용. 톤: done `good-soft`/`good` ✓ · err `bad-soft`/`bad` ✗(partial △) · cur `surface` + `accent` 안쪽 테두리(`aria-current=step`) · lock 🔒(권한 없는 적용) · skip 취소선 · idle `surface2`.
- 버튼: 늘 [초안 버리기](ghost) + 지금 단계 버튼 하나(primary). busy 중 라벨 "검증 중…"·"만드는 중…"·"테스트 중…"(`aria-busy`).

| `flowView` 조건(위가 우선) | 안내(굵게 = **…**) | 버튼(초안 버리기 외) |
|---|---|---|
| Raw 문법 오류 | **JSON 문법 오류**를 고쳐야 검증할 수 있어요 | [검증](비활성) |
| 검증 전 | 바뀐 값 **{n}개** · 먼저 검증해요(저장하지 않아요) | [검증] |
| 검증 실패 | **고칠 칸 {n}개** — 칸 아래 안내를 확인해 주세요 (Raw 탭: **오류 {n}건** — 편집기 아래 목록을 확인해 주세요) | [검증] |
| 운영 + 일부만 확인 | **실행으로 확인 못 한 키**가 있어 운영에 적용할 수 없어요 — 그 키를 원래대로 돌리면 다시 테스트할 수 있어요 | 없음 |
| 테스트 중 | 기능 테스트 중… **{n}초** (최대 30초) | [테스트 중…](비활성) |
| 30초 대기(429) | 이 연결은 **30초에 한 번**만 테스트할 수 있어요 | (개발)[요약 보기] · [{n}초 뒤 다시](비활성) |
| 테스트 실패 | **테스트 실패** — 결과를 확인하고 값을 고쳐 주세요 | (개발)[요약 보기] · [기능 테스트] |
| 운영 + 테스트 권한 없음 | 운영은 기능 테스트가 필수인데 **기능 테스트 권한**이 없어요 | 없음 |
| 테스트 전 | 운영: 운영은 **기능 테스트가 필수**예요[ (미리듣기 합성 1회로 확인)] · 개발: 검증 통과 · 기능 테스트는 개발 환경에서 건너뛸 수 있어요[ (…)] | (개발)[요약 보기] · [기능 테스트] |
| 테스트 통과·건너뜀 | 테스트 통과 · 결과는 30분 동안 유효해요 / 테스트 일부만 확인 · 개발 환경이라 이어서 할 수 있어요 / 테스트를 건너뛰었어요(개발 환경) | [변경 요약 보기] |
| 요약 + 적용 가능 | 변경 요약을 확인했어요 · 이유를 적고 적용해요 | [적용…] · 운영 [PRODUCTION 에 적용…] |
| 요약 + 운영 비 최고관리자 | **운영(PRODUCTION) 적용은 최고관리자(SUPER_ADMIN)만** 할 수 있어요 — 초안·변경 요약까지 만들 수 있어요 | 없음(적용 칸 🔒) |

- [요약 보기](개발만) = 테스트를 `skip` 으로 두고 바로 #106. [변경 요약 보기] 성공 → 설정 화면은 Diff 탭으로 넘어간다(`onDiffReady`).
- 초안이 바뀌면 검증·테스트·요약이 처음부터(`flowAfterEdit` — 30초 대기는 유지). 테스트 실행이 있었으면(`runs` 1↑) 30초 카운트다운, 429 면 `Retry-After` 초.
- 운영 설정 대상의 테스트 안내 꼬리 = "미리듣기 합성 1회로 확인".

#### F. 적용 확인 창 — `ApplySheet` + `ReasonFields` (`#cfg-apply` · `#cfg-first` · `#cfg-applied` · `#cfg-prod-confirm` · `#cfg-prod-errors` · `#cfg-prod-mismatch` · `#cfg-prod-expired` · `#cfg-prod-secret` · `#cfg-prod-forbid` · `#cfg-conflict` · `#cfg-conflict-after` · `#cfg-discard`)

```
Sheet 제목: 개발 "설정 적용" / 운영 "운영(PRODUCTION)에 적용"          (적용 중에는 바깥을 눌러도 닫히지 않음)
(운영) role=note 빨간 테두리 상자 "운영(PRODUCTION) 설정을 바꿔요 / 적용하는 순간 모든 학습자의 요청에 반영돼요(이 서버는 바로, 다른 서버 프로세스는 30초 안에)."
{대상 이름}(14 semibold) / 12 ink2 "{종류} · v{지금|0 (초기값)} → v{다음} · {env}"
변경 요약(h3) [(운영) {HH:mm:ss} 만듦] · SummaryChips · DiffList 4줄 + "외 {n}개" · (운영) "요약 해시 {짧게} — 적용할 때 서버가 같은 초안으로 다시 계산해 맞는지 봐요."
(운영) 기능 테스트(h3) TestLine
    불요 → "바뀐 키가 모두 실행 확인이 필요 없는 키라 테스트 없이 적용해요."
    없음·실패 → bad "통과한 기능 테스트가 없어요." · 일부만·id 없음 → bad "일부 키만 확인돼 운영에 적용할 수 없어요."
    통과 → [통과] {지연} · "{n}분 남음" | bad "만료" · traceId(모노, 말줄임)
(첫 적용) surface2 상자 "처음 적용이에요 — 지금 값을 기준선 v1 로 먼저 남기고 이번 변경은 v2 가 돼요. 기준선으로 언제든 되돌릴 수 있어요."
ReasonFields
SheetNotice(role=alert bad-soft — 실패 갈래, 아래 표) + 동작 버튼(밑줄 44px)
[적용 | PRODUCTION 에 적용](h-12 accent, "적용하는 중…") [취소](h-12)        ← 알림이 막는 갈래(block)면 확정 버튼을 그리지 않는다
```

**ReasonFields**(적용·되돌리기·비밀 참조·켜기/끄기 공용):
```
<label>변경 이유*</label>   12 tabular "{n}/200"
textarea 2줄 16px (aria-required, placeholder "예: 응답이 느려서 제한 시간을 늘림")
오류 FIELD_ERROR | 도움 "{10~200자|1~200자} · 줄바꿈은 띄어쓰기로 저장돼요 · 키·토큰 같은 비밀은 적지 마세요(감사 기록에 남아요)"
빠른 이유 칩 줄(role=group "빠른 이유", 가로 스크롤·스크롤바 숨김, 칩 h-11 rounded-full) — 누르면 " · " 로 덧붙임
(needsConfirm) 빨간 테두리 상자 "운영 환경(PRODUCTION) 설정을 바꿔요 / 확인하려면 아래에 PRODUCTION 을 그대로 입력해 주세요."
   input aria-label "확인 문구" 모노 16px(autoCapitalize characters · autoComplete off · spellCheck false · placeholder PRODUCTION)
```
- 글자 수는 서버 저장 규칙과 같은 모양(`normalizeReason` — 줄바꿈·제어문자 → 공백 하나, 앞뒤 공백 제거, 코드포인트)으로 센다. 이유·확인 문구는 상태에만 두고 저장소·로그·URL 에 남기지 않는다.

**[적용] 누름 → 요청 전 검사**(안내용 — 서버가 다시 검사):

| 조건 | 화면 |
|---|---|
| 이유 0자 / 운영 10자 미만 / 200자 초과 | 이유 칸 아래 "변경 이유를 적어 주세요." / "운영 변경은 10자 이상 적어 주세요(지금 n자)." / "200자까지 적을 수 있어요(지금 n자)." |
| 운영 확인 문구 ≠ `PRODUCTION` | 확인 칸 아래 "PRODUCTION 을 대문자로 그대로 입력해 주세요." |
| Raw 글을 아직 읽기 전(요약 뒤 300ms 안에 고침) | 지금 읽어 초안에 넣고 알림 "Raw JSON 이 변경 요약 뒤에 바뀌었어요. 변경 요약을 다시 만든 뒤 적용해 주세요." [변경 요약 다시 만들기] |
| 변경 요약 없음(모든 환경) | "변경 요약을 먼저 만들어 주세요." [변경 요약 다시 만들기] |
| 운영 + 테스트 필요 + 통과 결과 없음 | "통과한 기능 테스트가 없어요. 다시 테스트한 뒤 적용해 주세요." [다시 테스트] |

**쓰기 실패 → 화면**(`writeErrorView`, 서버 `details.reason` 우선 — 적용·되돌리기·비밀 참조·켜기/끄기 공통):

| 응답 | 갈래 · 문구 | 동작 버튼 | 확정 버튼 |
|---|---|---|---|
| 네트워크(0) | "연결하지 못했어요. 네트워크를 확인해 주세요." | — | 남김 |
| `details.field = reason` | 이유 칸 아래: 비밀 유사 → `REASON_SECRET_TEXT` · 짧음 "{min}자 이상 적어 주세요(지금 n자)." · 김 "{max}자까지 적을 수 있어요(지금 n자)." · 그 밖 "변경 이유를 적어 주세요." | — | 남김 |
| 409 `VERSION_CONFLICT` | "다른 곳에서 먼저 적용됐어요[ — 지금 v{n}]. 내가 바꾼 값 {n}개는 그대로 있어요." | [최신 값 기준으로 다시 비교] [초안 버리기] | 숨김 |
| 409 `SUMMARY_MISMATCH` | "변경 요약을 만든 뒤 설정이 바뀌었어요(요약 불일치). 변경 요약을 다시 만들어 확인해 주세요." | [변경 요약 다시 만들기] | 숨김 |
| 409 `PRIMARY_IN_USE` | "이 역할의 기본 연결이라 끌 수 없어요[({역할})]. 역할 페이지에서 기본 연결을 먼저 바꿔 주세요." | [역할 페이지로] | 숨김 |
| 409 `NO_CHANGE` | "지금 설정과 내용이 같아 되돌릴 것이 없어요." | — | 숨김 |
| 409 `ALREADY_ACTIVE` | "이미 사용 중인 버전이에요." | [새로 불러오기] | 숨김 |
| 409 그 밖 | "다른 곳에서 설정이 바뀌었어요. 새로 불러온 뒤 다시 확인해 주세요." | [새로 불러오기] | 숨김 |
| 403 `PRODUCTION_CONFIRMATION_REQUIRED` | 확인 칸 아래 "PRODUCTION 을 대문자로 그대로 입력해 주세요." | — | 남김 |
| 403 `PRODUCTION_TEST_REQUIRED` | "기능 테스트 결과가 만료됐거나 지금 초안과 달라요({`TEST_DETAIL_KO` — 테스트 결과 없음·찾을 수 없음·통과하지 못한 테스트·30분이 지남·다른 대상의 테스트·초안이 테스트 뒤에 바뀜·확인 못 한 키가 있음·함께 확인한 연결이 실패}). 다시 테스트한 뒤 적용해 주세요." | [다시 테스트] | 숨김 |
| 403 `CROSS_ENVIRONMENT_TEST_UNAVAILABLE` | "다른 환경 서버에서는 이 변경을 실행 검증할 수 없어요 — 그 환경의 콘솔에서 적용해 주세요." | — | 숨김 |
| 403 그 밖 | "이 작업을 할 권한이 없어요[(필요한 권한 …)]. 역할이 바뀌었을 수 있어요 — 콘솔을 다시 불러와 주세요." | — | 숨김 |
| 422 `E_REASON_SECRET_LIKE` | 이유 칸 아래 `REASON_SECRET_TEXT`(입력 원문은 되돌려 보이지 않음) | — | 남김 |
| 422 `E_SNAPSHOT_INTEGRITY` | "기록이 손상돼 이 버전으로는 되돌릴 수 없어요. 다시 눌러도 바뀌지 않아요." | — | 숨김 |
| 422 `E_REF_NOT_ALLOWED` | "이 연결에 허용되지 않은 비밀 참조예요. 목록에 있는 참조만 고를 수 있어요." | — | 남김 |
| 422 그 밖 | "규칙에 맞지 않아 적용하지 않았어요." | — | 남김 |
| 400 `errors[]` | 창을 닫고 칸 오류로(검증 실패 상태) — 한 번 쓰기 창은 메시지를 " · " 로 이어 알림 | — | — |
| 400 `E_CONN_SECRET_VALUE` · `NO_CHANGE` · `CREDENTIAL_ONLY` | "비밀 값은 보낼 수 없어요 — 서버에 둔 참조 이름만 연결해요." · "지금 저장값과 달라지는 값이 없어요." · "비밀 참조는 [비밀 참조 연결]에서만 바꿀 수 있어요." | — | 남김 |
| 400 `field = baseVersion` · 404 | "기준 버전을 알 수 없어요 — 다시 불러와 주세요." · "대상을 찾을 수 없어요. 다시 불러와 주세요." | [새로 불러오기] | 숨김 |
| 429 · 그 밖 | "요청이 많아요. 잠시 뒤에 다시 시도해 주세요." · "적용하지 못했어요. 잠시 뒤 다시 시도해 주세요." | — | 남김 |

- 동작 버튼(`noticeAction`): **최신 값 기준으로 다시 비교** = 대상을 다시 읽고 초안은 남김(저장값과 같아진 키만 `liveDraft` 가 뺀다) → 흐름 처음부터 + warn Note(A 절) · **새로 불러오기** = 같지만 안내 없음 · **변경 요약 다시 만들기** = 요약만 지움(요약 단계로) · **다시 테스트** = 테스트·요약 지움 · **초안 버리기** = 초안 비움 · **역할 페이지로** = 그 역할 페이지로 이동.
- **성공**: 창 닫힘 · 초안·흐름·이유 비움 · 토스트 "적용했어요 · v{n}[ (기준선 v1 함께)]" | "바뀐 값이 없어 적용하지 않았어요" · 대상 다시 읽기 · `AppliedNote`: good "**적용했어요 · v{n}** — 그 전 값은 기준선 v1 로 함께 남겼어요. 이 서버에는 바로, 다른 서버 프로세스에는 30초 안에 반영돼요.[ 미리듣기 버전도 함께 올라갔어요(v{n}).][ 환경 변수가 덮는 키는 실제 값이 그대로예요.]" / 바뀐 것 없음 neu "지금 저장값과 같아 적용하지 않았어요(버전을 만들지 않았어요)." · Raw 글을 버리고 patch 로 보냈으면 A 절 warn Note.
- **초안 버리기**: `ConfirmDropSheet` "초안을 버릴까요?" / "바꾼 값 {n}개가 사라져요. 저장된 설정은 그대로예요." [버리기](ghost, `bad` 글자) [계속 편집]. 대상 옮기기는 "다른 대상으로 옮길까요?" / "**{이름}**에서 바꾼 값 {n}개는 저장되지 않고 사라져요." [버리고 옮기기].

#### G. 기능 테스트 결과 카드 — `ConfigTestCard` (설정 Form·Diff 탭, 연결·예비 순서 편집)

```
role=group "기능 테스트 결과"  surface2 rounded-[14px] p-3.5
머리: ok [통과](StatusBadge PASSED) · partial [일부만 확인](warn-soft 뱃지, 글자 ink) · failed [실패]   "기능 테스트 · 후보 설정"   ··· {지연} · {HH:mm:ss}
ok      "후보 설정으로 바뀐 키를 모두 실제로 실행해 확인했어요. 저장은 하지 않았어요." (전부 테스트 불요면 "바뀐 키가 모두 실행 확인이 필요 없는 키예요. 저장은 하지 않았어요.")
        "결과는 {n}분 더 유효해요(운영 적용 때 첨부돼요)." | bad "결과가 만료됐어요 — 운영에 적용하려면 다시 테스트해 주세요."
partial "일부 키는 실행으로 확인할 방법이 없어요." · "확인 못 한 키 {키들 모노}" · 운영 bad "운영에서는 이 초안을 적용할 수 없어요 — …" / 개발 "개발 환경에서는 그대로 적용할 수 있어요. 운영에서는 이런 초안은 적용할 수 없어요."
failed  {오류 코드 한국어 | "후보 설정으로 실행하지 못했어요."} · "바꾼 값이 맞는지 확인해 주세요. 서비스가 꺼져 있으면 정상적인 결과예요."
공통    "실행으로 확인한 키 {키들}" · trace {id 모노 말줄임} [Trace 보기 ›](canTrace, 44px)
```

#### H. 연결 상세 — `ConnectionDetailScreen` 수정 + `ConnectionEditPanel`(d4=A) (`#conn-compare` · `#conn-view` · `#conn-edit` · `#conn-host` · `#conn-secrets`)

```
BackLink "연결 목록" · RefreshLine
Card 머리(§6-2 H 그대로) + <hr>
  "사용 여부 [엄격]"  ↔  (canApplyConn && 편집 아님) Switch(켜짐/꺼짐 — 누르면 EnabledSheet)  |  글자 "켜짐|꺼짐"(14 semibold)
  (canManageConn && 편집 아님) [설정 편집](ghost full 44px)
편집 아님: EngineTestPanel · "연결 정보" KeyValueList (credentialRef 행 = "{이름} 🔒" | "없음" + [있는지 확인](secrets.read_ref) [비밀 참조 연결](canCredential)) · "실행 설정 (runtime)"
편집 중 → ConnectionEditPanel (EngineTestPanel·연결 정보·실행 설정 자리를 바꾼다):
  Note neu "편집 중 · 바뀐 값 {n}개 — 아래 막대에서 검증·적용해요"  [편집 끝내기](44px)
  12 ink2 "편집 중에는 아래 막대의 [기능 테스트]가 저장 전 후보 설정으로 테스트해요."
  AppliedNote · (요약 뒤) "변경 요약" SummaryChips + DiffList · ConfigTestCard · 오류 Note "검증에서 {n}개를 고쳐야 해요 — 칸 아래 안내를 확인해 주세요."
  FieldList(enabled 숨김 · 비밀 참조 행의 두 버튼 그대로) · EditorChrome(막대 늘, roleHref = 이 연결의 역할 페이지)
  [편집 끝내기] + 바뀐 값 → ConfirmDropSheet "편집을 끝낼까요?" / "바꾼 값 {n}개가 사라져요. 저장된 설정은 그대로예요." [버리고 끝내기]
EffectiveSummaryCard("설정값 전체 보기 ›" → `?target={key}&tab=effective`) · HealthHistoryList
```
- 편집 정책은 #102(scope=ENGINE_CONNECTION, targetId = 연결 id) — 로딩 `ConsoleLoading` · 실패 `LoadError name="편집 정책"`.
- 쓰기(`Writer`): `connectionFormBody(patch)` 가 `connection.*`·`runtime.*` 만이면 #93 PUT `{connection, runtime}`, 그 밖 키가 섞이면 #107. 적용 권한은 `canApplyConn`(운영은 최고관리자) — 비 최고관리자는 요약까지.
- 주소 허용 목록 밖(`#conn-host`) = 서버 검증 `hostNotAllowed` → 그 칸 아래 서버 문구(화면이 문구를 만들지 않는다). Raw JSON 은 설정 화면에만 있다(d4=A).

#### I. 한 번 쓰기 창 — `EnabledSheet` · `CredentialSheet` · `PrepTestSection` (`#conn-disable` · `#conn-primary` · `#conn-cred` · `#conn-cred-prod`)

**EnabledSheet**(#93a):
```
제목 "연결 켜기" | "연결 끄기"
14px  켜기 "켜면 라우터가 이 연결을 다시 고를 수 있어요. 켜기 전에 기능 테스트로 동작을 확인해요." / 끄기 "끄면 라우터가 이 연결을 고르지 않아요. 예비 순서에 있으면 그 자리를 건너뛰어요."
12 ink2 "{이름} · {key} · 사용 여부는 [엄격] 키예요[ — 운영은 최고관리자가 직접]"
켜기: PrepTestSection(운영 필수 · 개발 선택)    끄기: 운영이면 요약만 만든다("변경 요약을 만드는 중…") — 테스트 없음
ReasonFields(운영 PRODUCTION 입력) 빠른 이유 켜기 [다시 쓰려고|문제가 해결돼서] · 끄기 [서비스 점검 중|오류가 계속 나서|더 이상 안 써서]
SheetNotice · [켜기|끄기|PRODUCTION 에서 켜기|PRODUCTION 에서 끄기](끄기는 ghost + bad 글자, "처리하는 중…") [취소]
```
- 운영인데 준비 안 됨: 켜기 "운영에서 켜려면 기능 테스트를 먼저 통과해야 해요." · 끄기 "변경 요약을 만들지 못했어요. 창을 닫았다 다시 열어 주세요." 409 `PRIMARY_IN_USE` → [역할 페이지로](`#conn-primary`). 성공 토스트 "연결을 켰어요|껐어요 · 설정 v{n}".

**CredentialSheet**(#93b, `canCredential` 만 — 연결 상세와 설정 Form 의 비밀 참조 행에서 연다):
```
제목 "비밀 참조 연결"
13px "값은 여기서 입력하지 않아요. 서버에 넣어 둔 비밀(환경 변수·비밀 파일)의 **이름만** 연결해요."   12 ink2 "지금: {참조|연결 안 됨}"
#101 을 열 때마다 한 번(감사 1행) — 로딩 ConsoleLoading · 실패 LoadError name="비밀 참조"
radiogroup "비밀 참조 고르기"
  "이 연결이 허용한 참조 중 서버에 있는 것" — 라디오 행 56px: {참조 모노} / "{파일|환경 변수}[ · 지금 연결됨]" [있음]   (없으면 점선 "고를 수 있는 참조가 없어요.")
  (허용됐지만 서버에 없는 것) 12 ink2 "허용됐지만 서버에 없는 참조 {n}개({이름들})는 고를 수 없어요 — 서버에 먼저 넣어 주세요."
  [연결 해제] 라디오 "비밀 없이 호출해요 — 인증이 필요한 서비스면 실패해요"
12 ink2 "다른 연결의 참조와 부팅용 비밀(세션 서명·내부 서비스·DB 접속 등)은 목록에 나오지 않고, 넣어도 거부돼요(422)."
(골랐을 때만) PrepTestSection label "기능 테스트"(운영 필수 · 개발 선택) · ReasonFields 빠른 이유 [키를 교체해서|인증 오류가 나서|시험해 보려고]
[연결|연결 해제|PRODUCTION 에 연결] [취소]   (안 골랐으면 [닫기] 하나)
```
- 선택지 = `credentialChoices(#101, 연결 key)` — `allowedFor` 에 이 연결 key 가 있는 것 중 `exists` 와 아닌 것. **값 입력 칸은 어디에도 없다.** 성공 토스트: 연결 상세 "비밀 참조를 바꿨어요|해제했어요 · 설정 v{n} — 상태는 다음 상태 확인 때 갱신돼요", 설정 화면은 꼬리 없이.

**PrepTestSection**(켜기·비밀 참조·운영 되돌리기 공용): (운영) "변경 요약을 만드는 중…" / 요약 실패 bad 한 줄 / 테스트 불요 "이 변경은 실행으로 확인할 키가 없어 테스트 없이 적용해요." / h3 "{label} (필수)|(선택)" · "테스트 중…"(role=status) · 결과 뱃지 + "통과 · {지연} · 30분 유효" | "일부만 확인 — 운영에는 적용할 수 없어요" | "실패" · 오류 줄 · [이 설정으로 기능 테스트]|[다시 테스트]|[{n}초 뒤 다시](ghost full 44px — 통과하면 사라짐).

**SecretsSheet**(§6 기존) 변경 한 가지: **연결에 걸린 참조만**(`usedBy` 1↑) 보인다 — 허용됐지만 아무도 안 쓰는 참조는 비밀 참조 연결 시트에서만(`#conn-secrets`).

#### J. 역할 페이지 예비 순서 — `RoleScreen` 수정 + `FallbackEditor` (`#role-compare` · `#role-edit` · `#role-guard` · `#role-summary` · `#role-prod`)

```
"예비 연결 순서" SectionHeader right=[순서 편집](canManageConn && 연결 목록 읽힘, ghost 44px)   ← 누르면 같은 Section 을 FallbackEditor 로 바꾼다
FallbackEditor (편집 정책 #102 scope=FALLBACK_POLICY, targetId = 정책 id)
  머리 "예비 연결 순서 · 편집 중"  [편집 끝내기](44px)
  AppliedNote · (요약 뒤) surface2 상자 "변경 요약" SummaryChips + DiffList(값은 연결 이름, 예비 목록은 "A → B", 빈 목록 "없음") · ConfigTestCard · 오류 Note(메시지 줄마다)
  <ol aria-label="예비 연결 순서(편집)"> 행 60px:
     "기본|예비" + 순번(모노 14) / {이름} · {key 모노 12} StatusBadge / [↑][↓][−] 44px 아이콘(aria-label "{이름} 위로|아래로|빼기", 끝에서는 비활성)
     1개뿐이면 [−] 없음 + "마지막 연결은 뺄 수 없어요 — 빼면 이 기능이 멈춰요."
  12 ink2 "맨 위가 기본 연결이에요. 예비는 4개까지. 순서를 바꾸면 엄격 키라 운영에서는 최고관리자가 직접 적용해요."
  "넣을 수 있는 연결"(같은 역할 · 순서 밖) 행 56px: {이름}/{key} · 꺼짐이면 "꺼진 연결은 넣을 수 없어요 · [연결 상세에서 켜기 ›]" · StatusBadge · [넣기](켜짐 && 5개 미만)
  12 ink2 "{실패하면 다음 연결로 한 번 다시 시도해요 | 실패해도 다른 연결로 넘기지 않아요} (이 설정은 라우터가 읽지 않아 여기서 바꾸지 않아요)"
  EditorChrome(막대 늘, namer = 연결 이름) · [편집 끝내기] + 바뀐 순서 → ConfirmDropSheet "편집을 끝낼까요?" / "바꾼 순서가 사라져요. …" [버리고 끝내기]
```
- 순서는 초안(`primaryConnectionId` + `fallbackConnectionIds`)에서 읽고 `moveItem`·`removeItem`·`addItem`(순수, `MAX_FALLBACKS` = 4)으로 바꾼다. 드래그 없음. 쓰기 #100 `{primaryConnectionId?, fallbackConnectionIds?}`. 성공 토스트 "예비 순서를 적용했어요 · v{n}[ (기준선 v1 함께)]".

#### K. 이력 — `/admin/history` · `HistoryScreen`(새 화면) (`#hist-versions` · `#hist-menu` · `#hist-empty` · `#hist-loading` · `#hist-error`)

```
page.tsx(서버): requireConsolePage('audit.read') → 아니면 ConsoleForbidden · tab·scope·target·v 를 형식 검사 후 넘김
ConsoleSegmented "이력 보기" [설정 버전 | 감사 기록]                       ← ?tab=audit (router.replace)
(voices.read) 링크 카드 52px "발음 사전 버전 기록 ›" / "사전은 자체 버전으로 따로 남아요(기존 화면)" → /admin/speech/tts/lexicon/versions
설정 버전 탭 VersionsTab
  13 ink2 "설정을 적용할 때마다 버전이 남아요. 되돌리기는 과거 버전 내용으로 **새 버전**을 만들어요(기록은 지우지 않아요)."
  <details> "▸ 상태 뜻" — [사용 중] 지금 적용 중 · [이전] 새 버전에 밀려났어요 · [되돌려짐] 되돌리기로 밀려난 버전이에요 · [기준선] 첫 적용 직전 값 — 처음 상태로 되돌릴 때 써요 · [기록 손상] 기록이 깨져 비교·되돌리기를 할 수 없어요
  ChipRadio "대상" [전체 | 불러온 버전의 대상들(+ 주소로 고정된 대상)]       ← 좁힌 뒤에도 본 대상 칩은 남는다
  #108(20개씩 커서): ul ConfigVersionRow × n · [더 보기](44px, "불러오는 중…")
    로딩 role=status "불러오는 중…" · 빈 EmptyNote "아직 설정 버전이 없어요. / 처음 적용하면 그 전 값이 기준선 v1 로, 적용한 값이 v2 로 남아요." · 실패 ConsoleError(다시 시도)
감사 기록 탭 → AuditTab (M 절)
```
**ConfigVersionRow**(버튼 ≥64px, `aria-haspopup=dialog`):
```
1줄  v{n}(모노 15 semibold) VersionStatusBadge [기준선] [기록 손상] "v{k} 로 되돌림" ········· {몇 분 전}
2줄  (대상 칩 = 전체일 때만) {대상 이름} · {종류}
3줄  기준선 "기준선 — 첫 적용 전 값" | {diffSummary} | "요약 없음"
4줄  12 ink2 {작업자 email | 시스템} · {Form | Raw JSON | 되돌리기 | 기준선} · {테스트 통과|테스트 실패}   ›
```
- `VersionStatusBadge`: 사용 중 = `good-soft`/`good` + 점 · 이전 = `surface2`/`ink2` · 되돌려짐 = 빨간 테두리 `bad` 글자. `DamagedBadge` "기록 손상"(빨간 테두리, `aria-label` 에 손상 종류). 모두 글자로 뜻을 전한다.

#### L. 버전 상세·되돌리기 — `ConfigVersionSheet` (`#hist-detail` · `#hist-detail-active` · `#hist-rollback` · `#hist-rollback-prod` · `#hist-prod-viewer` · `#hist-dropped` · `#hist-nochange` · `#hist-damaged` · `#hist-conflict`)

```
Sheet 제목 보기 "v{n} · {대상 이름}" / 되돌리기 "v{n} 내용으로 되돌리기"
보기(Detail):
  VersionStatusBadge [기준선] [기록 손상] · 13 ink2 "{날짜 시각} · {작업자|시스템}"
  14px {이유 | "이유 없음"} (기준선은 "첫 적용 전 값을 기준선으로 남김")
  KeyValueList 출처 "{Form|Raw JSON|되돌리기|기준선|알 수 없음}[ · v{k} 로 되돌림]" · 기능 테스트 통과|실패|— · 대상 "{이름} · {종류}" · 환경
  (손상 — 목록 integrity ≠ OK 또는 #108a 422) DamagedNote bad "기록이 손상돼 이 버전으로는 비교·되돌리기를 할 수 없어요. / 기록 형식이 깨졌거나 지금 규칙에 맞지 않는 값이 있어요. 다시 불러와도 바뀌지 않는 데이터 문제예요."  — 비교·되돌리기 없음
  ConsoleSegmented "비교 기준" [직전 버전과 | 지금과]   (#108a ?compare=previous|active)
    12 ink2 "직전 버전(v{k})과 비교" | "첫 버전(기준선)이에요 — 아래 스냅샷이 그때 값이에요." | "지금 저장값과 비교 — 이 버전으로 되돌리면 바뀌는 값"
    EntryList: [추가|제거|바뀜] {키 모노} / {전}(취소선) → {후}|(없음)   · "외 {n}개" · 차이 0 점선 "바뀐 값이 없어요."
    <details> "▸ 스냅샷 전체 보기" pre(모노 12, 줄바꿈) + "비밀은 참조 이름만 담겨요."
  ACTIVE → "지금 쓰는 버전이에요." | canRollback → [v{n} 내용으로 되돌리기](ghost full 44px) | rollbackProdOnly → "운영(PRODUCTION) 되돌리기는 최고관리자만 할 수 있어요."
되돌리기(Rollback): #108a ?compare=active + #108(같은 대상 ACTIVE 1개 → baseVersion)
  14px "지금(v{a}) 설정을 v{n} 내용으로 되돌리면:"
  (droppedKeys) Note warn "지금 스키마에 없는 키 {n}개는 빠져요 / {키들} — 그 사이 설정 형식이 바뀌어 더는 쓰지 않는 키예요."
  차이 0 → 점선 "지금 설정과 내용이 같아 되돌릴 것이 없어요." + [돌아가기]  (확정 버튼 없음 — 409 NO_CHANGE 를 미리 막음)
  EntryList · "외 {n}개" · 13 ink2 "새 버전 v{a+1} 이 만들어지고 v{a} 는 “되돌려짐”으로 표시돼요. 이 서버에는 바로, 다른 서버 프로세스에는 30초 안에 반영돼요."
  (운영) PrepTestSection label "되돌릴 설정으로 기능 테스트"(필수 — 후보 = {versionId})
  ReasonFields 빠른 이유 [응답이 느려져서|오류가 나서|적용 전으로 되돌림] (운영 PRODUCTION 입력)
  SheetNotice · [v{n} 내용으로 되돌리기 | PRODUCTION 에서 되돌리기]("되돌리는 중…") [돌아가기]
```
- 요청 전 검사: 이유·확인 문구(F 절) · 지금 버전을 모르면 "지금 쓰는 버전을 알 수 없어요. 새로 불러와 주세요." · 운영 준비 안 됨 "운영 되돌리기는 되돌릴 설정으로 기능 테스트를 먼저 통과해야 해요." · 실패 갈래는 F 절 표(409 `VERSION_CONFLICT`·`NO_CHANGE`·`ALREADY_ACTIVE`·422 `E_SNAPSHOT_INTEGRITY` 등 — `#hist-conflict`·`#hist-damaged`).
- 성공: 시트 닫힘 · 토스트 "되돌렸어요 · v{k} 내용으로 v{n}" · 버전 목록 처음부터 다시.
- **버전 id 로 열기**(`?v=` · 감사 "버전 보기 ›"): `VersionById` 가 #108a 를 읽어 같은 시트를 연다. 404 "그 버전을 찾을 수 없어요." · 422 "기록이 손상돼 이 버전을 열 수 없어요." · 그 밖 "버전 정보를 불러오지 못했어요." + [닫기].

#### M. 감사 기록 — `AuditTab`(d3=A) (`#hist-audit` · `#hist-audit-open` · `#hist-audit-lex` · `#hist-audit-empty`)

```
13 ink2 "관리자가 한 일(적용·되돌리기·비밀 참조 연결·켜기/끄기·민감 조회)이 시간순으로 남아요. 값은 저장할 때 이미 가려져 있고, 비밀은 참조 이름만 있어요."
ChipRadio "분류" [전체 | 연결 | 예비 순서 | 운영 설정 | 발음 사전]          ← AUDIT_CATEGORIES(→ scope)
ConsoleSegmented "기간" [오늘 | 7일 | 30일 | 전체]                       ← 기본 7일. "오늘" = 한국 시각 0시부터
<details> "▸ 필터 더 보기 — 작업 · 사람[ · 환경]"
   select 작업(ACTION_FILTERS — 끝이 "." 면 접두) · select 사람(불러온 기록의 작업자) · (canOtherEnv) select "환경 (최고관리자만)" [{env} (지금) | 다른 환경] | 12 ink2 "지금 환경({env}) 기록만 보여요."
(분류 = 발음 사전) surface2 "발음 사전 분류에는 분류가 생기기 전(9월 28일 전) 기록도 함께 나와요 — “옛 기록” 표시."
#137(30개씩 커서) — 한국 날짜 머리("오늘"·"어제"·"M월 D일")로 묶은 ul
  AuditRow(버튼 ≥64px, aria-expanded)
    1줄 {HH:mm} **{작업 이름}** [옛 기록] ······ ˅/˄
    2줄 {action 코드 모노 11.5}
    3줄 {summary | 대상 id | —}
    4줄 12 ink2 {email(역할)|시스템}[ · “{이유}”]
  펼침(왼쪽 선 border-line):
    (조회 감사) "조회만 — 값은 기록하지 않아요."
    키마다 한 줄: {키 모노 12} / {전}(취소선) → **{후}**     ← auditLines(before/after 의 values), 미리듣기 문장·발음 사전은 lang=ja
    (줄이 없고 원문도 못 봄) "바뀐 값 요약이 없는 기록이에요."
    (canTrace) <details> "▸ 원문 JSON" before | after pre 두 칸(컨테이너 ≥440 나란히, 아니면 위아래)
    12 ink2 "환경 {env}[ · IP {/24 가림}][ · 분류 없음(옛 기록)]"
    [버전 보기 ›](versionId 있음) [Trace {앞 10자} ›](canTrace)
로딩 role=status "불러오는 중…" · 빈 EmptyNote "조건에 맞는 기록이 없어요." · 실패 ConsoleError · [더 보기]
```
- 기간 시작은 화면을 연 시각 기준(분 단위로 자름, 하루에 한 번만 다시 잰다 — 분마다 경로가 바뀌어 [더 보기]로 붙인 목록이 리셋되지 않게).
- 감사 값은 서버가 저장할 때 이미 가린 값이다 — 화면은 값을 더하거나 풀지 않는다. 작업 이름은 `actionLabel`(모르는 action 은 코드 그대로).

#### N. 공통 상태 — 로딩·오류·권한

| 상태 | 화면 |
|---|---|
| 첫 로딩 | `ConsoleLoading`("불러오는 중…") — 설정·연결 편집·예비 순서 편집·시트 / 목록은 가운데 role=status 한 줄 |
| 불러오기 실패 | `LoadError`(이름 "연결"·"설정값"·"편집 정책"·"비밀 참조") 또는 `ConsoleError`(다시 시도) — `loadErrorText` |
| 콘솔 안 403(`#cfg-forbidden`) | 페이지 가드 = `ConsoleForbidden`(필요한 권한·내 역할). 쓰기 도중 권한이 바뀌면 F 절 403 알림 |
| 요청 실패(검증·테스트·요약) | `requestErrorText` 한 줄(`ConsoleError`, 막대 위): 네트워크 · 권한 · 대상 없음 · "지금 저장값과 달라지는 값이 없어요." · 서버 400 message · "{검증|기능 테스트|변경 요약}을(를) 하지 못했어요. 잠시 뒤 다시 시도해 주세요." |
| 다시 읽는 중 | `main.reloading` → sr-only role=status "다시 불러오는 중…" |

#### O. 발음 사전 운영 이유 10자(R1 — §10 레이아웃 변화 없음)

`lexicon/kana.ts` `validateWriteMeta`: 확인 문구가 필요한(운영) 쓰기는 이유(공백 접은 길이) 10자 미만이면 `TOO_SHORT`(`REASON_MIN_PRODUCTION` = 10, 서버와 같은 값) · `lexicon/lexiconCopy.ts` `fieldErrorText('reason')`: `E_REASON_SECRET_LIKE` → `REASON_SECRET_TEXT` 와 같은 문구 · `TOO_SHORT` → "운영 변경 이유는 10자 이상 적어 주세요(지금 n자)." · `E_REASON` → "이유를 확인해 주세요 — 1~200자(운영은 10자 이상)로 적어요." (§10-8 문구 표에 이 세 줄이 추가된 것으로 본다.)

### 13-3. 상태 관리

- **`useConfigEditor({ target, access, writer, onApplied, onReload, onDiffReady })`**(`configEditor/useConfigEditor.ts`) — 대상 하나의 편집 상태. 대상이 바뀌면 호출자가 `key` 로 다시 마운트한다.
  - 초안 `Draft = { patch, unknown }`(평면 점 키 → 값 / 스키마 밖 키). 보이는 초안 = `liveDraft(rawDraft, fields)`(다시 읽은 저장값과 같아진 키를 렌더 중에 뺀다 — 409 [최신 값 기준] 용). 바뀐 수 `draftCount`.
  - 흐름 `FlowState { v, t, d }`(`flow.ts` — `FLOW_START` · `flowAfterEdit` · `testStateOf` · `testPassed`). 초안이 바뀌면(`touched`) 검증·테스트·요약·적용 결과·요청 오류·`rawIgnored` 를 지운다.
  - 오류 = 서버 칸 오류(#104·#105·#106·적용 400) + 로컬 오류(Raw 지운 키·막힌 키 이름).
  - Raw: `rawEditing` · `rawText` · `syntax` · 300ms 읽기 타이머(`cancelParse` 로 실행·취소·적용 성공·버리기·제안·켜기/끄기 때 정리). 보기 글 `rawView` = 저장값 문서 + 초안(`docWithDraft`). Form 편집은 Raw 편집 중이면 `editViaRaw`(`rawTextWithField` → 다시 읽기).
  - 테스트: `AbortController`(언마운트·재실행 때 취소) · 30초 쿨다운(`useCountdown`) · 경과 초(`useNow` 1초, 테스트 중만).
  - 적용 창: `sheet`·`reason`·`confirm`·오류·`notice`·`applying`·`applied`·`rawIgnored`·`rebased`.
  - **남은 한계(REV-054 L-1)**: 검증·테스트·요약 응답이 초안이 바뀐 뒤 도착하면 그 응답이 흐름을 덮을 수 있다(요청 시점 후보와 비교하지 않음) — 운영은 서버 `SUMMARY_MISMATCH` 가 막고, 개발 환경만 좁은 시간창. §13-12 ⑧.
- **`useWritePrep({ open, target, candidate, production })`** — 한 번 쓰기 창. key = `JSON.stringify([target, candidate])`; 운영이고 창이 열리면 #106 을 자동으로 한 번, #105 는 버튼으로. `ready` = 개발이면 늘, 운영이면 요약 있음 && (테스트 불요 || ok + id). `meta()` 가 `writeMeta`(baseVersion·reason·운영 confirm·summaryHash·testResultId)를 만든다. 후보가 바뀌면(참조 다시 고르기) 요약·테스트를 새로.
- **`usePaged(pathFor)`** — #108·#137 커서 목록. 경로(필터)가 바뀌면 처음부터, 늦게 온 옛 응답은 버린다(abort + key 비교).
- **URL**: `ConfigScreen` 탭·대상, `HistoryScreen` 탭은 `router.replace(…, {scroll:false})`. 이력 행을 눌러 연 시트는 주소에 `v` 를 쓰지 않는다(`?v=` 는 들어올 때만).
- **다시 읽기**: 적용·비밀 참조 성공 → 대상(#102|#123b)·#110·#91 다시. 연결 상세는 #91a·편집 정책·Health 기록 다시.
- 저장소: `localStorage`·`sessionStorage` 사용 0(이유·확인 문구·해시 포함 — REV-047 grep).

### 13-4. API 호출 계획 (정본 api-contract — 요청 함수는 `configEditor/configApi.ts` 한 곳, id 는 `encodeURIComponent`, 이유·확인·해시는 늘 본문)

| 화면 | # | 메서드 · 경로 | 보내는 것 | 쓰는 필드 | 오류 |
|---|---|---|---|---|---|
| 설정 | #91 | GET `engine-connections` | — | id·key·name·role·engineName·enabled·status·credentialRef | `LoadError` |
| 설정(연결)·연결 편집·예비 순서 편집 | #102 | GET `config/effective?scope=ENGINE_CONNECTION\|FALLBACK_POLICY&targetId=` | — | targetId·targetKey·schemaVersion·keys[](값·출처)·`edit{version, keys[ConfigKeyPolicyDto]}` | 404 "대상을 찾을 수 없어요." · `LoadError` |
| 설정(운영 설정) | #123b | GET `app-settings/{key}` | — | value·exists·type·description·editability·policy·lock·lockMessage·verifiable·version | 같음 |
| 설정(Raw) | #110 | GET `config/raw/{scope}/{targetId}` | Raw 탭 처음 열 때 | json·version·schemaRef·effectiveDiffers | `ConsoleError` |
| 설정(목소리 키) | #82 | GET `voices` | 운영 설정 + `voices.read` | id·displayName·enabled·status | 목록 없이 글자 입력 |
| 편집기 공통 | #104 | POST `config/validate` | `{scope,targetId,patch}` | valid·errors[{key,rule,message,suggestion}] | 400 errors → 칸 |
| 〃 | #105 | POST `config/test` | `{scope,targetId,patch}` 또는 `{…,versionId}` | status·testResultId·expiresAt·latencyMs·testedKeys·untestedKeys·runs[{ok,errorCode}]·traceId | 429 `Retry-After` · 400 errors · 403 교차 환경 |
| 〃 | #106 | POST `config/diff` | 같음 | changes[]·summary{changed,strict,shadowed,secretTouched}·unchanged·summaryHash·testRequired | 400 errors |
| 설정(Form) | #107 | POST `config/apply` | `{scope,targetId,patch,baseVersion,reason[,confirm,summaryHash,testResultId]}` | changed·version·baselineVersion·derived·warnings | `writeErrorView` |
| 설정(Raw) | #111 | PUT `config/raw/{scope}/{targetId}` | `{json(글 그대로), dryRun:false, baseVersion, reason, …}` | 같음 | 같음 |
| 연결 상세 | #91a | GET `engine-connections/{id}` | — | §6 + version·credentialRef·effectiveSummary | §6 |
| 연결 편집 | #93 | PUT `engine-connections/{id}` | `{connection?, runtime?, …meta}` | `ConfigApplyResultDto` | `writeErrorView` |
| 켜기·끄기 | #93a | PUT `engine-connections/{id}/enabled` | `{enabled, …meta}` | 같음 | + 409 `PRIMARY_IN_USE` |
| 비밀 참조 | #93b | PUT `engine-connections/{id}/credential` | `{credentialRef: 이름\|null, …meta}` — 값 필드 없음 | 같음 | 422 `E_REF_NOT_ALLOWED` · 400 `E_CONN_SECRET_VALUE` |
| 비밀 참조 시트·있는지 확인 | #101 | GET `secrets` | 시트를 열 때마다(감사 1행) | ref·source·exists·usedBy·allowedFor | `LoadError` |
| 역할 페이지 | #99a | GET `fallback-policies/{role}` | — | id·primary·fallbacks·retryOnce·version | §6 |
| 예비 순서 | #100 | PUT `fallback-policies/{role}` | `{primaryConnectionId?, fallbackConnectionIds?, …meta}` | `ConfigApplyResultDto` | `writeErrorView` |
| 이력 | #108 | GET `config/versions?scope=&targetId=&status=&cursor=&limit=20` | — | items[ConfigVersionItemDto]·nextCursor | `ConsoleError` |
| 이력 | #108a | GET `config/versions/{id}?compare=previous\|active` | — | entries·truncated·droppedKeys·against·snapshot | 422 `E_SNAPSHOT_INTEGRITY` → DamagedNote |
| 이력 | #109 | POST `config/versions/{id}/rollback` | `{baseVersion(지금 ACTIVE), reason[,confirm,summaryHash,testResultId]}` | version·restoredFromVersion | `writeErrorView` |
| 이력(운영 되돌리기 준비) | #106·#105 | 위와 같음 | `{scope,targetId,versionId}` | summaryHash·testRequired / testResultId | — |
| 감사 | #137 | GET `audit?scope=&action=&actorUserId=&environment=&from=&cursor=&limit=30` | — | items[AuditItemDto]·nextCursor | `ConsoleError` |

- 운영 쓰기 꼬리 = `writeMeta`: 운영이면 `confirm`(앞뒤 공백 제거)·`summaryHash`, 테스트가 필요하면(또는 개발에서 결과가 있으면) `testResultId`.

### 13-5. 컴포넌트 분해

| 파일 | 역할 |
|---|---|
| `configEditor/ConfigScreen.tsx` | 설정 화면(`ConfigScreen` 데이터·주소 · `Workspace` 대상 하나 · `TargetPicker` · `TabsBar` · `configHref`) |
| `configEditor/useConfigEditor.ts` | 편집 컨트롤러(초안·흐름·Raw·적용 창) · `liveDraft` |
| `configEditor/draft.ts` | 순수: `FieldModel`·`fieldsFromEffective`·`fieldFromAppSetting`·`fieldLock`·`isLockedRow`·초안 함수·`parseRawText`·`rawTextWithField`·`applyPayload`·`rawLineOf`·`renameRawKey`·`connectionFormBody`·`hasMaskedValue` |
| `configEditor/flow.ts` | 순수: `flowView`·`checkReasonInput`·`checkConfirmInput`·`normalizeReason`·`writeErrorView`·`requestErrorText`·`testMinutesLeft`·`REASON_SECRET_TEXT` |
| `configEditor/configAccess.ts` | 순수: `configAccess`·`configTabs`·`pickTab` |
| `configEditor/configApi.ts` | 요청 경로·본문(#102~#111·#93~#93b·#100·#123b·#108~#109) · `writeMeta` |
| `configEditor/configCopy.ts` | 문구·라벨 상수(§13-8) · `APP_SETTING_KEYS` · `fieldLabel` · `actionLabel` |
| `configEditor/FieldList.tsx` | Form 칸 목록(`FieldRow`·`LockedValue`·`SecretValue`·`InputControl`·`lockCounts`) |
| `configEditor/RawTab.tsx` · `DiffView.tsx` · `ConfigTestCard.tsx` | Raw JSON 탭 · 변경 요약(`DiffList`·`DiffRow`·`DraftPreviewList`·`SummaryChips`·`valueText`) · 테스트 결과 |
| `configEditor/EditorChrome.tsx` · `FlowBar.tsx` · `ApplySheet.tsx` · `ReasonFields.tsx` · `AppliedNote.tsx` | 적용 막대·확인 창 묶음 · 막대 · 확인 창(`SheetNotice`·`TestLine`·`ConfirmDropSheet`·`shortHash`) · 이유+PRODUCTION · 적용 결과 |
| `configEditor/ConnectionEditPanel.tsx` · `ConnectionSheets.tsx` · `FallbackEditor.tsx` · `useWritePrep.ts` | 연결 상세 편집 · `EnabledSheet`·`CredentialSheet`·`PrepTestSection`·`credentialChoices` · 예비 순서 편집(`moveItem`·`removeItem`·`addItem`) · 한 번 쓰기 준비 |
| `configEditor/ui.tsx` | `INPUT`·`TEXTAREA`·`FIELD_*`·`LINK_SM` · `StrictBadge`·`ChangedBadge`·`LockBadge`·`NeutralTag`·`VersionStatusBadge`·`DamagedBadge`·`LockIcon`·`Note`·`Switch` |
| `configEditor/EffectiveScreen.tsx` | `EffectivePanel`(Effective 본문 — 설정 화면이 씀). 기본 내보내기는 이제 안 쓰임(§13-12 ⑦) |
| `history/HistoryScreen.tsx` · `ConfigVersionRow.tsx` · `ConfigVersionSheet.tsx` · `AuditTab.tsx` | 이력 화면(`VersionsTab`·`VersionById`·`StatusLegend`) · 버전 행 · 상세·되돌리기(`Detail`·`Rollback`·`EntryList`·`DamagedNote`) · 감사(`AuditRow`) |
| `history/historyQuery.ts` · `usePaged.ts` | 순수: 주소·필터·`auditPath`·`periodFrom`·`auditLines`·`dayLabel`·`actorText`·`versionTargetOptions`·`historyHref` · 커서 목록 |
| `console/ConnectionDetailScreen.tsx` · `RoleScreen.tsx` · `EffectiveSummaryCard.tsx` · `SecretsSheet.tsx` · `labels.ts` | 수정(H·J 절, `&tab=effective`, 사용 중 참조만, 메뉴 설명) |

### 13-6. 생성/수정 파일 목록 (developer B, 2026-10-01 — 이미 있음)

- 신규: `src/components/admin/configEditor/{ConfigScreen,FieldList,FlowBar,ApplySheet,EditorChrome,RawTab,DiffView,ConfigTestCard,ReasonFields,ConnectionEditPanel,ConnectionSheets,FallbackEditor,AppliedNote,ui}.tsx` · `{configAccess,configApi,configCopy,draft,flow,useConfigEditor,useWritePrep}.ts` · `src/components/admin/history/{HistoryScreen,ConfigVersionRow,ConfigVersionSheet,AuditTab}.tsx` · `{historyQuery,usePaged}.ts` · `src/app/(admin)/admin/history/page.tsx` · 단위 `configEditor/__tests__/{configEditor,flow,rawSync}.test.ts`·`history/__tests__/history.test.ts`·`lexicon/__tests__/reasonCopy.test.ts` · 화면 E2E `tests/live/task012c-ui-e2e.mjs`.
- 수정: `src/app/(admin)/admin/configuration/page.tsx` · `src/components/admin/console/{ConnectionDetailScreen,RoleScreen,EffectiveSummaryCard,SecretsSheet}.tsx`·`labels.ts` · `configEditor/EffectiveScreen.tsx`(`EffectivePanel` 추출) · `src/modules/admin/console/menu.ts`(B 의 hunk) · `lexicon/{kana,lexiconCopy}.ts`·`__tests__/kana.test.ts`.
- 이 가이드로 새로 만들 파일은 없다. 후속 수정은 §13-7.

### 13-7. 구현 순서 (구현 완료 — 후속 수정 순서)

1. (Leader 판단 뒤) §13-12 ① 키보드 열림 때 적용 막대 숨김 — `FlowBar` 에 `data-flowbar` + `globals.css` `:root[data-kb] [data-flowbar]{display:none}`(하단 탭과 같은 규칙) 또는 `KeyboardInset` 드러내기 계산에서 막대 높이 빼기. QA 360·390 실기기.
2. §13-12 ⑨ 문구 2줄(`flow.ts` 손상 문구 ↔ `DamagedNote`) + 손상 시 `issues[].key` 표시(값 금지).
3. §13-12 ⑧ REV-054 Low 묶음: 진행 중 응답 버리기(요청 시점 `candidate.patch` 비교) · 409 [최신 값 기준] 뒤 Raw 편집 글 재생성 또는 편집 끄기 · `rawLineOf`·`renameRawKey` 부모 경로 일치 · `APP_SETTING_KEYS` ↔ 서버 목록 비교 단위 1건 · 막대 사이드바 폭을 CSS 변수로.
4. §13-12 ③ #123b 범위 필드가 생기면 `fieldFromAppSetting` 이 `min`·`max`·`maxLength`·`nullable` 을 옮겨 담는다(지금은 담지 않음 — `rangeText` 는 그대로 동작).
5. 수정마다 데모 게이트 `check` → 단위(`configEditor`·`flow`·`rawSync`·`history`) → E2E(`task012c-ui-e2e.mjs` — 정리 범위는 REV-047 L-6 대로 응답 id 만) → Reviewer.

### 13-8. 한국어 UI 문구 — 단일 출처 위치 (흐름·실패 문구는 §13-2 E·F 표가 그대로다)

| 상수 · 위치 | 내용 |
|---|---|
| `LOCK_BADGE`(configCopy) | 읽기 전용 · 재시작 필요 · 비밀 참조 전용 · 편집 보류 · 서비스 관리 · 앱이 안 씀 · 서버 주소 고정 · 자동 · 환경 정책 · 환경 변수가 덮음(SHADOW) · 운영 잠금(NOVERIFY) |
| `CLIENT_LOCK_WHY` | SHADOW "환경 변수가 이 값을 덮고 있어 잠갔어요 — 여기서 바꿔도 효력이 없어요." · NOVERIFY "실행으로 확인할 방법이 없는 키라 운영에서는 콘솔로 바꾸지 않아요(개발 환경에서는 바꿀 수 있어요)." |
| `LOCK_WHY_FALLBACK` | 서버 `lockMessage` 가 빌 때만 — 재시작 필요 "재시작해야 반영되는 키라 이번 단계에서는 콘솔로 바꾸지 않아요(서버 설정·배포로)." 등 9종 |
| `SCOPE_KO` · `EDIT_SCOPE_OPTIONS` | 연결 · 예비 순서 · 운영 설정 · 목소리 기본값 · 프롬프트 · 프리셋 · 발음 사전 / 대상 종류는 연결·운영 설정 둘 |
| `ORIGIN_KO` · `VERSION_STATUS_KO` · `VERIFIABLE_KO` | 기준선·Form·Raw JSON·되돌리기 / 사용 중·이전·되돌려짐 / 실행 검증·실행 검증 없음·테스트 불요·값에 따라 검증 |
| `RULE_KO` | Raw 오류 rule 코드의 title(형식·최솟값·…·비밀 값·허용 안 된 주소·허용 안 된 참조·재시작 필요) |
| `APP_SETTING_KEYS` | 미리듣기 문장 · 기본 목소리 · 다시 확인할 인식 신뢰도 · 미리듣기 버전 · 운영 임시 덮어쓰기 · 운영 디버그 최대 시간(분) · 운영 로그 레벨 상한 · 녹음 보관 일수 · 요청 기록 보관 일수 (서버 `appSettingSchema` 와 같은 순서·키) |
| `ACTION_KO` · `ACTION_FILTERS` | 감사 작업 이름(설정 적용·설정 적용(Raw JSON)·설정 되돌리기·기준선 저장·운영 원문 조회·비밀 참조 연결/해제·연결 켜기/끄기·비밀 참조 목록 조회·발음 사전 작업 5종) / 작업 필터 10개 |
| `QUICK_REASONS_APPLY`(ReasonFields) | 응답이 느려서 · 오류가 나서 · 시험해 보려고 · 원래대로 되돌림 (켜기·끄기·비밀 참조·되돌리기 창은 I·L 절의 자기 목록) |
| `NOTICE_ACTION_KO`(ApplySheet) | 최신 값 기준으로 다시 비교 · 초안 버리기 · 변경 요약 다시 만들기 · 다시 테스트 · 역할 페이지로 · 새로 불러오기 |
| `REASON_SECRET_TEXT`(flow) | "이유에 비밀처럼 보이는 글자(키·토큰)가 있어 저장하지 않았어요. 이유에는 비밀 값을 적지 마세요." |
| 서버 문구(화면은 그대로 보인다) | 설정 값 비밀 유사 400 `secretValue` "비밀처럼 보이는 글자가 있어 저장하지 않았어요."(`validate.ts` `SECRET_VALUE_MESSAGE` — 입력 값·경로를 되돌리지 않음) · 확장 키 경고 "확장 키(x-)는 저장하지 않고 적용하지도 않습니다." · 잠금 이유 `lockMessage` · 주소 허용 목록 등 칸 오류 `message`·`suggestion` |

### 13-9. 360/390/412 · 데스크톱 · 키보드 · 접근성 · QA 체크리스트

폭·배치
- [ ] 360·390·412·1024·1280 에서 설정(4탭 × 연결·운영 설정)·연결 상세(보기·편집)·역할 페이지(보기·순서 편집)·이력(버전·감사)·모든 시트 가로 스크롤 0. 긴 값: 64자 연결 key·긴 주소·`allowedTasks` 배열·요약 해시·traceId·`effectiveDiffers` 여러 개·감사 원문 JSON·200자 이유·미리듣기 문장 100자(일본어, `lang="ja"`, `break-keep` 없음).
- [ ] Raw 편집기만 안에서 가로 스크롤(`wrap=off`) — 페이지는 0. 편집기 높이는 줄 수만큼이라 세로 스크롤은 `main` 하나.
- [ ] 적용 막대: 모바일 세 줄 쌓기 + 버튼 칸 나눔, ≥1024 한 줄·사이드바 오른쪽(232px)부터. 본문 마지막 칸·[더 보기]·"연결 상세 ›" 가 막대에 가리지 않는다(빈 자리 150/84px). 제스처 바 위로 떠 있다(`env(safe-area-inset-bottom)`).
- [ ] Form 칸: 컨테이너 ≥620px 이면 이름 | 값 두 칸, 아니면 위아래. 감사 원문 JSON 은 컨테이너 ≥440 에서 나란히.
- [ ] 칩 줄(대상·분류·빠른 이유)은 가로 스크롤만·스크롤바 숨김, 선택 칩이 화면 밖이면 보이게.

키보드(task-021 `KeyboardInset` · `interactive-widget=resizes-content`)
- [ ] 확인 창·한 번 쓰기 창의 이유 칸·PRODUCTION 칸에 포커스하면 시트가 키보드 위로 올라가고 입력 칸이 보인다(공용 `Sheet` 의 `--kb-inset`).
- [ ] **Form 의 아래쪽 칸·Raw 편집기 마지막 줄에 포커스했을 때 적용 막대(fixed, 모바일 ≈150px)에 가리지 않는다** — 지금 코드는 막대를 키보드와 함께 위로 올리고 드러내기 계산에 막대 높이를 넣지 않아 가려질 수 있다(코드 추적, 실기기 미확인 → §13-12 ①). 360×(키보드 열림) 에서 본문이 몇 px 남는지 기록.
- [ ] 입력칸 글자 16px(확대 방지) — Raw 편집기도 모바일 16px.

터치·글자
- [ ] 누르는 것 ≥44px: 탭·대상 종류(`ConsoleSegmented` min-h-11)·칩·[버전 기록 ›]·[원래대로]·[있는지 확인]·[비밀 참조 연결]·[JSON 편집]·제안 바꾸기·↑↓−·[넣기]·[편집 끝내기]·[더 보기]·"상태 뜻"·"필터 더 보기"·"원문 JSON"·알림 동작 버튼. 목록 행 ≥56px(버전·감사 행 ≥64px, 예비 순서 행 60px). 시트 확정·취소 48px.
- [ ] 읽어야 하는 글에 `ink3`·`warn` 글자·`accent-soft` 위 `accent` 글자 없음. `warn-soft` 뱃지·상자 글자는 `ink`. 운영 강조는 `bad` 글자 on `surface`/`bad-soft`.
- [ ] 종류·상태는 글자로 전한다(바뀜·추가·제거 뱃지, 상태 뱃지 `aria-label`, 점·✓·✗·🔒 는 장식).

권한·노출(서버 재검사와 별개로 화면 DOM 확인)
- [ ] USER: `/admin/configuration`·`/admin/history` 가 없는 주소와 같은 404.
- [ ] ADMIN: Raw JSON 탭·[JSON 편집]·[비밀 참조 연결]·감사 원문 JSON·Trace 링크·환경 필터 DOM 0. 운영에서 [적용…]·사용 여부 스위치·되돌리기 버튼 DOM 0(대신 🔒·글자·안내 한 줄).
- [ ] DEVELOPER: 운영에서 Raw 편집·요약까지 되고 적용 버튼 DOM 0. [비밀 참조 연결] DOM 0.
- [ ] SUPER_ADMIN: 운영 확인 창에 PRODUCTION 칸·요약 해시·기능 테스트 줄.
- [ ] 비밀 참조: 값 입력 칸 0(`input[type=password]` 포함 0), 허용 밖 참조는 목록에 없음, 허용됐지만 없는 참조는 이름 한 줄만.
- [ ] 화면 텍스트·DOM 속성·콘솔 로그·`localStorage`·`sessionStorage`·URL 에 비밀 값·이유 원문·확인 문구 0. 비밀 유사 이유·값 거절 응답에 입력 원문 0.
- [ ] 화면 코드에 엔진·모델 이름 하드코딩 0(`src/components/admin/{configEditor,history}` grep — 표시명은 DTO).

동작(QA 라이브 = 개발 환경 LOCAL 행만, 운영 경로는 단위 + U-C7 리허설)
- [ ] 첫 적용 = 기준선 v1 + v2(시트 안내·토스트·이력 두 행) · 변경 0 = 버전 0("바뀐 값이 없어 적용하지 않았어요").
- [ ] Raw 편집 중 Form 변경 → Raw 글에 들어감 → 요약 = 적용 = DB 행 = 감사 `config.raw_apply`. 요약 뒤 300ms 안에 Raw 수정 후 [적용] → 막힘 안내. 어긋난 글은 patch 로 + "Raw JSON 글은 적용하지 않았어요".
- [ ] `__proto__` 키 → 줄 표시 오류·적용 단계 못 감 · 저장값 키 지움 → required 오류 · 가림 값 문서 → [JSON 편집] 없음.
- [ ] 409 `VERSION_CONFLICT`(두 탭) → [최신 값 기준으로 다시 비교] 뒤 초안 유지 + 안내. 기본 연결 끄기 → 409 + [역할 페이지로].
- [ ] 테스트 30초 카운트다운 · 429 `Retry-After` · partial(개발 이어 감 / 운영 막힘).
- [ ] 예비 순서: 마지막 1개 [−] 없음 · 꺼진 연결 [넣기] 없음 · 요약 뒤 버리기 = 쓰기 0.
- [ ] 이력: 대상 칩·되돌리기 = 새 버전·직전 "되돌려짐"·"v{k} 로 되돌림" · 같은 내용 = 확정 버튼 없음 · 손상 = 비교·되돌리기 없음 · `?v=` 직접 열기 · 감사 펼침(키마다 한 줄)·옛 발음 사전 기록 "옛 기록".
- [ ] 미리듣기 문장·모델 칸·예비 순서 JSON 에 비밀 유사 값 → 칸 아래 "비밀처럼 보이는 글자가 있어 저장하지 않았어요." · 버전·감사 증가 0.
- [ ] Raw 의 맨 바깥 `x-note` → 적용 성공·저장 문서에 없음(안내 문구와 일치) · 중첩 `x-` → 서버 `unknownKey`.

접근성
- [ ] 시트 `role=dialog`·제목 포커스·Esc·닫으면 연 버튼으로 포커스(공용 `Sheet`). 적용 중에는 바깥 눌러 닫기 막힘.
- [ ] 막대 안내 `aria-live=polite`, 단계 `aria-current=step`, 실행 중 버튼 `aria-busy`. [JSON 편집] `aria-pressed`, 감사 행 `aria-expanded`, 칩 `role=radio aria-checked`, 비밀 참조 라디오 `role=radiogroup`.
- [ ] 칸 오류 `aria-invalid` + `aria-describedby`, 알림 `role=alert`, 적용 결과 `role=status`.
- [ ] 줄 번호 `aria-hidden`, 편집기 `aria-label="설정 JSON"`, 화살표는 sr-only "에서 다음으로".

### 13-10. 주의사항 · developer 가 건드리지 말 것

- **capability 는 서버가 진실**: `configAccess` 는 숨김용이다. 페이지는 `requireConsolePage`, 쓰기는 서버가 매 요청 `config.apply.production`·엄격 키 본인·`baseVersion`·`summaryHash`·`testResultId`·reason 을 다시 검사한다. 화면 검사(이유 길이·PRODUCTION 입력·요약 있음)는 안내용으로만 둔다.
- **적용 본문 = 확인한 변경 요약**(REV-047 M-1). `applyPayload`·`editViaRaw`·`cancelParse` 경로를 단순화하지 않는다 — 단위 `rawSync.test.ts` 변이 시험이 이 불변식을 지킨다.
- **비밀**: 값 입력 칸을 만들지 않는다. `credentialRef` 는 설정 patch 로 보내지 않는다(서버 400 `CREDENTIAL_ONLY` — [비밀 참조 연결] 전용). 이유·확인 문구·요약 해시는 본문으로만, 로그·저장소·URL 금지. 거절 응답의 입력 원문을 화면에 다시 그리지 않는다.
- **Raw 원문 조회 = 감사**: 운영 대상 #110 은 조회마다 감사 1행 — 페이지 진입·대상 칩 변경만으로 읽지 않는다(탭을 볼 때만). #101 도 시트를 열 때만.
- **운영 화면은 QA 가 라이브로 못 본다**(QA 역할 토큰이 운영에서 인정되지 않음) — 운영 경로는 단위(`flowView`·`configAccess`·`writeErrorView`·`ReasonFields`)와 U-C7 사용자 리허설로만 확인한다. QA·E2E 는 LOCAL 행만 쓰고 자기가 만든 버전 id 만 지운다(감사는 불변이라 남는다).
- **엔진 이름**: 화면 상수·문구에 엔진·모델 이름을 쓰지 않는다(데모의 가명 엔진 A~E 와 같은 원칙). 연결·모델 표시는 서버 DTO 그대로.
- **데모와 다르게 바꿀 때**: §13-11 의 implementation 갈래를 넘는 변경(탭·단계·CTA·정보 구조)은 데모 v3 로 사용자 재승인.
- 목소리 기본값 편집·Voice 관리·프롬프트·Playground 는 012c-2 — 대상 종류·메뉴에 미리 그리지 않는다.

### 13-11. 데모와 다른 점 (구현이 사실 — 정본 권고 포함)

| # | 데모 v2 | 구현 | 분류(REV) | 권고 |
|---|---|---|---|---|
| 1 | 대상 종류 3개(연결·운영 설정·목소리 기본값), `#cfg-form-voice`·`#cfg-first` 가 목소리 대상 | 2개(연결·운영 설정) | 범위 이동(D-C14, 사용자 승인 범위) | 구현 정본. 목소리 편집은 012c-2 데모에서 |
| 2 | 감사 분류 칩 7개(+목소리·조회·권한 거부) · 결과 필터·결과 뱃지·분류별 개수 | 5개(전체·연결·예비 순서·운영 설정·발음 사전) · 결과 필터·뱃지·개수 없음 · "조회"는 [필터 더 보기 › 작업] | implementation(REV-047 ①) | 구현 정본(권한 거부는 서버가 감사로 남기지 않아 칩이 거짓 안내가 됨) |
| 3 | 예비 순서 편집에 "실패하면 다음 연결로 한 번 다시 시도" 스위치 | 글자 한 줄 + "(이 설정은 라우터가 읽지 않아 여기서 바꾸지 않아요)" | implementation(REV-047 ②) | 구현 정본(서버 NOT_CONSUMED — 동작 없는 스위치 금지) |
| 4 | Form 에 사용 여부 칸 | Form 에서 숨김 — 연결 상세 스위치(#93a)로만 | implementation(REV-047 ③) | 구현 정본(켜기/끄기 단일 경로·기본 연결 409 보호) |
| 5 | 운영 설정 칸에 범위 표시 | 범위 없음(서버 검증만), 키 목록은 화면 상수 9개 | implementation(REV-047 ④) | 구현 유지 + §13-12 ③ |
| 6 | 요약 카드 "마지막 적용 n시간 전" | 없음 | implementation(REV-047 ⑤) | 구현 정본(DTO 에 시각 없음 — 생기면 추가) |
| 7 | Raw 꼬리 "x- 로 시작하는 키(예: x-note)는 스키마 밖이어도 그대로 보존돼요." | "맨 바깥의 x- 로 시작하는 키(예: x-note)는 메모로 둘 수 있지만 저장되지 않아요." | 문구 정정(REV-054 L-2·REV-056 ④) | **구현 정본** — 서버 사실(맨 바깥 `x-` 는 저장 안 함, 중첩은 400) |
| 8 | 적용 막대 `position: sticky`(본문 안) | `fixed` + 본문 끝 빈 자리 + ≥1024 `left-[232px]` 상수 | implementation(REV-047 L-4) | 동작 같음. 셸 폭을 CSS 변수로(§13-7 3) |
| 9 | — | 새 안내 3개: "Raw JSON 글은 적용하지 않았어요 …" · "Raw JSON 이 변경 요약 뒤에 바뀌었어요 …" · 막힌 키 이름 오류 | implementation(REV-054 — 데모의 요약 불일치 흐름과 같은 종류) | 구현 정본 |
| 10 | 적용 전 "변경 요약 없음" 막기는 운영만 | 모든 환경 | implementation(REV-054 "완화 아님") | 구현 정본 |
| 11 | 비밀 값 거절은 비밀 참조 칸 평문만 | 일반 설정 값(자유 문장·모델 칸·JSON 잎)도 400 `secretValue` "비밀처럼 보이는 글자가 있어 저장하지 않았어요." | 서버 규칙 확장(REV-056·REV-059, Codex C2 재검토 보강 진행 중) | 화면은 서버 문구 그대로 — 화면 변경 없음 |
| 12 | 시크릿 참조 시트 = #101 전체 | 연결에 걸린 참조만(`usedBy` 1↑) | implementation(서버 1단계 5번) | 구현 정본(허용·미사용 참조는 비밀 참조 연결 시트) |
| 13 | 감사 펼침 링크 "버전 v6 보기 ›" | "버전 보기 ›"(감사 `versionId` 로 시트) | 문구 | 구현 정본(번호는 시트 제목에) |
| 14 | 기본 탭 Form · Effective 링크 | 같음 + 역할 페이지·연결 상세 "설정값 전체 보기 ›" 는 `&tab=effective` | implementation(REV-047 ⑥) | 구현 정본 |

- 위 14건 모두 정보 구조·단계·CTA 는 데모와 같다 — **데모 재승인 필요 없음**(REV-047·REV-054·REV-059 판정과 같음).

### 13-12. Leader 확인 요청

| # | 항목 | 지금 | 권고 |
|---|---|---|---|
| ① | **키보드 열림 때 적용 막대**(실기기 미확인, 코드 추적) | `FlowBar` 는 `fixed` 모바일 ≈150px. `resizes-content` 라 키보드와 함께 위로 올라오고, `KeyboardInset` 의 입력 칸 드러내기는 막대 높이를 빼지 않는다 → Form 아래쪽 칸·Raw 편집기 줄이 막대 뒤에 가릴 수 있고, 360px 에서는 본문 높이가 크게 줄어든다 | 하단 탭과 같은 규칙으로 **키보드가 열린 동안 막대 숨김**(`data-flowbar` + `:root[data-kb] [data-flowbar]{display:none}`) — 입력 중에는 막대를 쓸 일이 없다. 데모 변경 아님(implementation). QA 360·390 실측 항목 추가 |
| ② | developer B 확인 요청 (a) — §13-11 2~6·14 수용 | 구현됨 | **수용 권고**(REV-047 implementation 판정과 같음) |
| ③ | developer B (c) — #123b 범위 필드 | DTO 에 `min`·`max`·`maxLength`·`nullable` 없음 · 목록 API 없음 | developer A 가 #123b 에 범위 필드를 더하면 화면은 `fieldFromAppSetting` 한 곳만 고친다. 목록 API 는 선택(`APP_SETTING_KEYS` 드리프트 가드 단위 1건으로도 충분) |
| ④ | developer B (d) — 운영 경로 실화면 | 단위로만 확인 | U-C7 리허설(사용자 본인 SUPER_ADMIN) 순서 제안: 운영 설정 비엄격 키 1건 Form → 검증 → 기능 테스트 → 변경 요약(해시 확인) → 확인 창(이유 10자↑·PRODUCTION) → 이력에서 그 버전 [되돌리기](운영 테스트) → 감사 2행 확인 |
| ⑤ | 정본 문구 정리 — `configuration-resolution.md` §8-1 끝 "ADMIN/DEVELOPER … 승인 요청(`pendingProductionApprovals`)" | 데모·구현 모두 "초안·변경 요약까지"이고 승인 요청 기록은 없다 | 정본을 "초안·변경 요약까지 — 최고관리자 계정으로 다시 적용(1인 앱)"으로 정리(Leader) |
| ⑥ | `docs/screens.md` §2 표 | 이번엔 §13 행 한 줄만 더했다. 기존 `/admin/configuration`(Effective 탭만)·`/admin/{prompts,playground,history}`(Phase 2+) 행은 지침대로 건드리지 않았다 | Leader 가 두 행을 정리(history 를 빼고 prompts·playground 만 012c-2 로) |
| ⑦ | `EffectiveScreen` 기본 내보내기 | 설정 페이지가 `ConfigScreen` 으로 바뀌어 아무도 import 하지 않음(`EffectivePanel` 만 쓰임). `ConfigAccess.note` 도 화면에서 안 씀 | 다음 정리 때 삭제(동작 영향 0) |
| ⑧ | REV-054 Low 중 화면에 보이는 것 | L-1 진행 중 응답이 낡은 요약을 세움(개발 환경 좁은 시간창) · L-4 409 [최신 값 기준] 뒤 Raw 편집 글이 옛 저장값으로 남음 · REV-047 L-3 제안 바꾸기 첫 줄 일치 | 다음 라운드 묶음(§13-7 3) — 데모 재승인 불필요 |
| ⑨ | 손상 문구 두 곳 | `flow.ts` 422 `E_SNAPSHOT_INTEGRITY` "기록이 손상돼 …" ↔ 시트 `DamagedNote` "…지금 규칙에 맞지 않는 값이 있어요"(비밀 유사 값으로 막힌 경우는 손상이 아님 — REV-059 L3) | `flow.ts` 문구를 시트와 같은 뜻으로 + `DamagedNote` 에 `issues[].key`(값 금지, REV-059 L5) |

---

## 14. 오늘의 복습 (task-010b)

승인 데모: docs/demo/task-010b-repetition-v1.html (v1)

> **`task-010b-v1`, 사용자 승인 2026-10-01 08:17, sha256 `dcd310bf…`** — 결정 **a=A**(할 일이 있을 때만 오늘의 회화 위) · **b=B**(바로 건너뛰고 5초 되돌리기) · **c=A**([복습 시작]을 누를 때 만든다) · **d=B**('곧 열려요' 안). 데모 상태는 주소 `#<id>`(예: `…-v1.html#rv-due`)로 바로 열리고, 아래 `#id` 는 그 상태를 가리킨다.
> 정본: `api-contract.md` §2-13 #58·#60·#62·#63·#64 · #55 + **task-010b Leader 기록(2026-10-01) 계약 결정 ①~⑦**(additive — 기존 키 변경 없음). 데모의 합성 데이터와 필드명이 다르면 계약이 정본이다. 계약에 아직 없는 필드는 §14-11 에 모았다(★ 표시).
> 재사용: §12 오늘의 회화 화면 전부(수업 경로·5단계·대기·종료 카드·`useJobWatch`·`MiniSteps`·`ExprChip`/`ExprPlayChip`·`Spinner`) · §5 오늘 홈·flash 방식 · 공용 `Card`·`Btn`·`BtnRow`·`Badge`·`ErrorBlock`·`TeacherAvatar`·`BackBar`·`Toast`. **새 색 없음.**
> **적용 토큰**(`src/app/globals.css`, 이름만 쓴다): `ground` · `surface` · `surface2` · `ink` · `ink2` · `ink3`(장식만) · `line` · `accent` · `accent-soft` · `on-accent` · `good` · `good-soft` · `bad` · `bad-soft` · `--radius`(14px) · `--safe-bottom`. `warn` 은 쓰지 않는다. 글자 색은 §1-1 — `accent-soft` 위 글자는 `ink`/`ink2`(집중 뱃지·"복습" 뱃지·다음 복습 상자), `accent` 는 점·테두리(비텍스트)로만.

### 14-0. 한눈에 보는 결정

1. **바뀌는 곳은 4군데**: 오늘 홈 "오늘의 복습" 카드(새) · 복습 수업 머리·① 이번 복습 항목·② 집중 표시·③ 결과 한 줄(오늘의 회화 수업 화면 재사용) · 복습 수업 대기/실패 문구 · 복습 종료 카드의 "다음 복습". **새 경로는 없다** — 복습 수업도 `/study/today/talk/[lessonId]` 하나가 `lesson.kind === 'REVIEW'` 로 갈라 그린다.
2. 카드 상태는 **#58 한 번**으로 정한다(Leader ②: `review`·`guard`·`decisionPending`·`nextReview`). 순수 함수 `deriveReviewCard`(단위 테스트)가 14상태 중 하나를 고른다.
3. **카드 위치(a=A)**: 복습 있음·만드는 중·만들기 실패·하던 복습(준비됨 포함)일 때만 **오늘의 회화 위**, 판단 대기·오늘 완료·오늘은 없음·건너뜀은 **오늘의 회화 아래**. 가드는 맨 아래 **"곧 열려요"**(d=B).
4. **건너뛰기(b=B)**: 누르면 화면만 바로 "건너뛰었어요"로 바꾸고 5초 뒤 #64 를 보낸다. 되돌리면 보내지 않는다. **5초 안에 화면을 떠나면(다른 탭·뒤로·앱 백그라운드) 그 자리에서 바로 보낸다**(§14-2 C).
5. **복습 수업은 [복습 시작]을 누를 때 만든다(c=A)** → #63 → 수업 경로로 이동 → 기존 대기 화면이 잡을 지켜본다. 판단 직후 미리 만들기 없음(Leader ⑦).
6. **#58 오류·로딩은 오늘의 회화 카드 한 곳에서만** 보인다(Leader ⑥) — 복습 카드는 그동안 그리지 않는다. 오류 문구는 "오늘의 회화와 복습을 불러오지 못했어요."로 합친다.
7. ① "이번 복습 항목"에 **읽기 줄은 없다**(Leader ③) · 출처는 3종 라벨만(Leader ④) · 종료 카드의 다음 복습은 #62 `reviewDecisionJobId` → #55 → #60 재조회(Leader ⑤).
8. 엔진명 0: `decidedBy`·잡 id·일정 id·`refType` 원값은 화면·DOM 속성·콘솔에 싣지 않는다(라벨로만 바꿔 보인다). 근거 문장은 서버가 이미 엔진명을 걸렀지만 화면은 그대로 텍스트로만 그린다(`dangerouslySetInnerHTML` 금지).

### 14-1. 화면 개요

| 항목 | 내용 |
|---|---|
| 목적 | 선생님(A11)이 3~7일 간격으로 고른 항목을 오늘 홈에서 근거와 함께 보여 주고, [복습 시작]으로 그 항목만 섞은 5단계 복습 수업(A5)을 한다. 끝나면 항목마다 다음 복습 날짜가 정해진다 |
| 진입 | 하단 탭 "오늘" → 오늘의 복습 카드 [복습 시작]·[보러 가기]·[이어서 하기]·[시작하기]·[다시 만들기]·[끝낸 복습 결과 보기] |
| 역할별 가시성 | 로그인 사용자 전원. 타인·없는 일정은 #63·#64 `404` → 카드만 다시 읽음(문구 없음). 타인·없는 레슨은 §12-2 L 그대로. 관리자 전용 요소 없음 |
| 앱/웹 분기 | 없음(말하기 인식 경로만 §12 그대로) |
| 하단 탭 | 오늘 홈 보임, 수업 경로 숨김(§12 그대로 — `routes.ts` 변경 없음) |
| TTS 상태 표시등 | 복습 수업 머리 — §12 `LessonHeader` 그대로 |

### 14-2. UI 구조 (의사코드, 390px 기준 — 데모 상태 id 인용)

#### A. 오늘 홈 — `TodayHome` 에 `TodayReviewCard` 끼우기 (`#home-compare` · `#rv-*`)

현재 `src/components/vocab/TodayHome.tsx`(011 반영 상태) 기준으로 이렇게 끼운다:

```
<div className="px-4 pb-8">
  <div ref={cardRef}> TodayWordsCard </div>                     (그대로)
  {rv.above ? <TodayReviewCard …/> : null}                       ← 새로: 할 일 있는 4상태
  TodayLessonCard  (+ errorText 를 합친 문구로, deriveLessonCard 는 NEW 만 — 아래)
  {rv.below ? <TodayReviewCard …/> : null}                       ← 새로: 판단 대기·완료·없음·건너뜀
  EvalHomeCard                                                   (그대로 — 011)
  VocabStatsCard?  KeptSets?                                     (그대로)
  {rv.kind === 'guard' ? <ReviewSoonSection guard=… /> : null}   ← 새로: 맨 아래 "곧 열려요"(d=B)
  FinishConfirmSheet  Toast                                      (그대로)
  <UndoToast …/>                                                 ← 새로: 건너뛰기 5초 되돌리기
</div>
```

- `TodayHome` 은 지금처럼 #58 을 **한 번** 읽어 `lessonToday` 에 둔다(새 요청 없음). 복습 카드는 그 응답과 로컬 건너뛰기 상태(`useReviewSkip`)로 `deriveReviewCard()` 를 부른다. `TodayReviewCard` 는 **상태를 갖지 않는 표시 컴포넌트**로 만든다 — 위·아래로 자리를 옮겨도 건너뛰기 타이머·되돌리기가 끊기지 않게 상태는 `TodayHome` 의 훅에 둔다([자세히] 펼침만 카드 안 `useState`, 자리가 바뀌면 접혀도 된다).
- **`deriveLessonCard` 는 `kind === 'NEW'` 만 본다**(`todayLessons` 에 복습 레슨도 들어 있다 — `lessons/today.ts` 실측). 한 줄 필터 + 테스트 1건. 이게 없으면 복습 수업을 만드는 동안 오늘의 회화 카드가 "수업을 만들고 있어요"로 바뀐다. `resume`(지난 날짜 하던 수업)은 `kind` 가 없어 화면이 거를 수 없다 → 서버가 NEW 만 담아야 한다(§14-11 ★①).
- `TodayLessonCard` 오류 문구: `#58` 실패 시 `HOME.loadError` 대신 "오늘의 회화와 복습을 불러오지 못했어요."(prop `errorText` 추가, 기본값은 기존 문구 — 다른 호출부 없음). [다시 시도]는 지금처럼 #58 을 다시 읽는다(두 카드가 함께 돈다).
- `page.tsx`(서버)가 `teacherName`(= `profile.teacherName?.trim() || '선생님'`, 레슨 경로와 같은 규칙)을 `TodayHome` 에 넘긴다 — 근거 상자의 "{이름} 선생님 판단" 줄.

**카드 상태** — `deriveReviewCard(state, today, skip)`(순수, `lesson/review/reviewLogic.ts`). 표에서 위 줄이 우선한다.

| # | 상태(데모) | 조건 | 자리 | 내용 |
|---|---|---|---|---|
| 1 | `loading` (`#rv-loading`) | `lessonToday.state === 'loading'` | 없음 | **그리지 않는다** — 오늘의 회화 카드의 "불러오는 중…" 하나로 충분(Leader ⑥). |
| 2 | `error` (`#rv-error`) | `lessonToday.state === 'error'` | 없음 | **그리지 않는다** — 오늘의 회화 카드가 합친 문구 + [다시 시도]. 서버가 복습 계산만 실패한 경우(`review:null, guard:null, decisionPending:false, nextReview:null` 로 degrade)도 결과적으로 15번(숨김)이 된다 — 오류 문구 없음. |
| 3 | `skipped` (`#rv-skip` · `#rv-skipped`) | 로컬 `skip.phase ∈ {pending, sending}` 이고 `skip.reviewId === review.id` | 아래 | 건너뜀 카드(13번과 같은 모양) + `UndoToast`(pending 동안만). 서버가 아직 `DUE` 를 돌려줘도 로컬이 이긴다. |
| 4 | `guard` (`#rv-guard`) | `guard?.reason === 'insufficient'` | 맨 아래 "곧 열려요" | B 절 |
| 5 | `gen` (`#rv-gen`) | `review.status === 'DUE'` && `review.jobId` | **위** | "복습 수업을 만들고 있어요"(15 semibold) · "{n}개 항목 · 보통 1~2분 걸려요. 다 되면 여기서 열 수 있어요."(13 ink2) · 띠(§12 `lesson-indet` 그대로, `aria-hidden`) · [보러 가기](ghost full) → 수업 경로. 화면이 보이는 동안 `useJobWatch(review.jobId, {delays:[5000], onSettled: reload})` |
| 6 | `genfail` (`#rv-genfail`) | `DUE` && `lessonId` && 그 레슨 상태가 `FAILED`(아래 "레슨 상태 찾기") | **위** | "복습 수업을 만들지 못했어요" · "{n}개 항목 · 다시 만들면 대부분 잘 만들어져요." · [다시 만들기](primary full → #63 다시, §14-11 ★③) · [오늘은 건너뛰기] |
| 7 | `progress` (`#rv-progress`) | `DUE` && `lessonId` && 레슨 `IN_PROGRESS`(또는 `READY && stageDone ≥ 1`) | **위** | "하던 복습이 있어요" · "{n}개 항목 · 오늘 시작 · 5단계 중 {k}단계 끝냄" · `MiniSteps done={k}`(§12 `TodayLessonCard` 에서 export 된 것) · "다음은 {③ 문제}예요. 단계마다 저장돼요." · [이어서 하기](primary full) |
| 8 | `ready` (`#rv-progress` 변형) | `DUE` && `lessonId` && 레슨 `READY && stageDone 0` | **위** | "복습 수업이 준비됐어요" · "{n}개 항목 · 5단계 · 약 15분" · `MiniSteps done={0}` · [시작하기] |
| 9 | `due` (`#rv-due` · `#rv-due-more`) | `DUE` && `lessonId == null` && `decidedBy === 'TUTOR'` | **위** | 아래 "복습 있음 카드" |
| 10 | `dueFallback` (`#rv-due-fb`) | 9 와 같고 `decidedBy === 'FALLBACK'` | **위** | 근거 상자만 폴백 모양 |
| 11 | `done` (`#rv-done`) | `review.status === 'DONE'` && `!decisionPending` | 아래 | "✓ 오늘 복습을 끝냈어요"(✓ `good`, `aria-hidden`) · "{n}개 항목 · 문제 {c}/5 맞힘"(점수를 모르면 "{n}개 항목"만) · "다음 복습" 상자(`nextReview` 가 있을 때) · [끝낸 복습 결과 보기](가운데 밑줄 44px → `lessonId` 수업 경로) |
| 12 | `donePending` (`#rv-done-pending`) | `DONE` && `decisionPending` | 아래 | 11 과 같고 "다음 복습" 상자 안이 `Spinner` + "선생님이 날짜를 정하고 있어요"(`role=status`) |
| 13 | `skippedServer` (`#rv-skipped`) | `review.status === 'SKIPPED'` | 아래 | "오늘 복습은 건너뛰었어요" · "{n}개 항목은 다음에 공부하는 날 선생님이 다시 골라 드려요." |
| 14 | `pending` (`#rv-pending`) | `review == null` && `decisionPending` | 아래 | `Spinner` + "선생님이 오늘 복습할 항목을 고르고 있어요"(15 semibold, `role=status`) · "곧 준비돼요. 보통 1분 안에 끝나요. 그동안 다른 공부를 해도 괜찮아요."(13 ink2) — 버튼 없음 |
| 15 | `rest` (`#rv-rest`) | `review == null` && `nextReview` | 아래 | "오늘은 복습할 항목이 없어요" · "다음 복습 · {10월 3일(토)}, {d}일 뒤 · {k}개 항목" — 버튼 없음 |
| 16 | `hidden` | 그 밖(가드 `cycle`·`stale`·모르는 값, 아무것도 없음) | 없음 | 그리지 않는다(§14-11 ⑥) |

- 표의 1~16 중 데모 14상태 = 2·1·4·14·9·10(·`#rv-due-more` 펼침)·5·6·7·8·11·12·15·13. 3은 건너뛰기 직후(로컬), 16은 계약상 남는 경우다.
- **레슨 상태 찾기**: `review` 에는 레슨 상태가 없다. `today.todayLessons.find(l => l.id === review.lessonId)` 의 `status`·`score` 를 쓴다(지금 서버는 오늘 날짜 레슨을 종류 상관없이 담는다 — §14-11 ★⑧ 에서 유지 확인). 못 찾으면 7번(progress)으로 보고, 수업 경로가 실제 상태(대기·실패·5단계)를 그린다.
- `{n}` = `review.itemCount`, 집중 = `review.focusCount`, `{k}` = `review.stageDone ?? 0`, `{c}` = `correctFromScore(score)`(§12 `logic.ts`).
- 날짜 `{10월 3일(토)}` = `formatMonthDay(date) + '(' + weekdayOf(date) + ')'`(vocab/format). `{d}` = `nextReview.days`.
- `#58` 의 `mode`·`cycle` 은 쓰지 않는다(카드는 `review` 로 정한다).

**복습 있음 카드**(9·10, `#rv-due`): `Card` 테두리만 강조(`border-accent` — `Card` 의 `border-line` 과 겹치므로 important `border-accent!`), `aria-labelledby` = 카드 h2.

```
<div 머리줄 flex justify-between items-baseline> <h2 15 semibold>오늘의 복습</h2> <span 12 ink2>약 15분</span>
<p rv-sum mt-1 flex-wrap gap-1.5 15 semibold> {n}개 항목  {focusCount>0 && FocusBadge "집중 {f}개"}
TeacherWhy  (아래)                                         mt-2.5
(skip.phase==='failed') <p role=alert 오류 상자 mt-2>건너뛰지 못했어요. 다시 눌러 주세요.</p>   (#rv-skip-fail)
[복습 시작] Btn primary full mt-3   (요청 중 "만드는 중…" + aria-busy, 두 번 눌러도 한 번)
[오늘은 건너뛰기] 가운데 밑줄 텍스트 버튼 h-11 w-full 13 semibold ink
```

**TeacherWhy**(근거 상자, `lesson/review/TeacherWhy.tsx`) — `grid grid-cols-[28px_minmax(0,1fr)] gap-2 rounded-xl bg-surface2 px-3 py-2.5`(다음 복습 상자 안에서는 `bg-surface`):
- TUTOR: `TeacherAvatar sm`(장식) / 본문 `<p id={useId()} 13.5px/1.5 ink>` `<span class="sr-only">선생님 근거: </span>` + `JaQuoted(text)` — 접힘이면 `line-clamp-2`, 펼침이면 전체(≤300자) / 메타줄 `flex flex-wrap justify-between gap-x-2`: "{이름} 선생님 판단 · 오늘 {HH:mm}"(12 ink2, `teacherName === '선생님'` 이면 "선생님 판단 · …") + [자세히]/[접기](12.5px semibold 밑줄, 보이는 높이 32px + `before:` 히트영역으로 44px, `aria-expanded`·`aria-controls`=본문 id) / 펼침에만: "이번 복습 항목 {n}개"(12 ink2 mt-2) + 칩 줄(`flex flex-wrap gap-1.5`, 칩 `h-8 rounded-[10px] bg-surface px-2.5 15px`, 집중이면 앞에 7px `accent` 점(`aria-hidden`) + sr-only "집중, ", `textJa` 는 `lang=ja`). `preview` 는 최대 7개 — `itemCount > preview.length` 면 마지막에 "외 {k}개"(12.5 ink2) 칩.
- FALLBACK: 아바타 자리에 28px 원 `bg-surface text-ink2` 이탤릭 "i"(`aria-hidden`) / "지난 학습에서 틀리거나 오래된 항목을 골랐어요"(13.5 ink) / "이번엔 기본 규칙으로 골랐어요."(12 ink2). [자세히]·칩 없음(데모 `#rv-due-fb` 그대로). 서버 `tutorRationale` 은 이 경우 쓰지 않는다.
- 시각 = `decidedAt` → `kstDateKey` 가 오늘이면 "오늘 {formatClock}", 아니면 `formatMonthDay`. 없으면 "· 시각" 부분을 뺀다.
- **`JaQuoted`**: 문자열을 `/(「[^」]*」)/` 로 나눠 「…」 조각만 `<span lang="ja">` 로 감싼다(React 노드 배열 — HTML 주입 없음). 근거 문장은 한국어 바탕이라 나머지는 그대로.

**카드 버튼 동작**

| 버튼 | 동작 |
|---|---|
| [복습 시작](9·10) | #63 `POST /api/v1/reviews/{review.id}/start` → `router.push('/study/today/talk/' + lessonId)`. 409·404 → 토스트 "오늘 복습이 바뀌었어요. 다시 불러올게요." + #58 다시 · 429 → "잠시 후 다시 눌러 주세요." · 0 → "연결하지 못했어요. 네트워크를 확인해 주세요." · 그 밖 → "복습 수업을 만들지 못했어요. 다시 눌러 주세요." |
| [다시 만들기](6) | 같은 #63(서버가 실패한 레슨을 같은 행으로 되살림 — ★③). 성공하면 수업 경로로 push |
| [보러 가기]·[이어서 하기]·[시작하기]·[끝낸 복습 결과 보기] | 수업 경로로 push(`review.lessonId`) |
| [오늘은 건너뛰기](9·10·6) | C 절 |

#### B. 가드 — 맨 아래 "곧 열려요" (`#rv-guard`, d=B)

- 011 이 "곧 열려요" 칸(`TodayComingSoon`)을 지웠다(AI 평가가 실제 카드가 됨). 그래서 **가드일 때만** 맨 아래(보관한 세트 다음)에 같은 모양의 칸을 되살려 가드 카드 하나를 넣는다 — d=B 의 "아직 쓸 수 없는 기능끼리 맨 아래 / 처음 쓰는 날 오늘 홈이 지금과 거의 같음"을 그대로 지킨다(§14-11 데모와 다른 점 ②).

```
<section mt-[18px]> <h3 15 semibold mb-2>곧 열려요</h3>
  Card flat:
    <div flex justify-between items-start gap-2> <p 15 semibold>오늘의 복습</p>  Badge neutral "기록이 더 쌓이면 열려요"(래퍼 [&>span]:bg-surface — flat 카드 위라서) </div>
    <p 13 ink2 mt-1>선생님이 복습 날짜를 정하려면 기록이 조금 더 필요해요.</p>
    <div flex-col gap-2 mt-2.5> MeterRow "공부한 날" {studyDays.have}/{need}일 · MeterRow "복습할 재료" {items.have}/{need}개 </div>
    <p 12 ink2 mt-2>수업이나 단어 세트를 끝내거나 교정을 채택하면 재료가 쌓여요.</p>
```
- `MeterRow`: `grid grid-cols-[minmax(0,1fr)_minmax(64px,96px)_52px] items-center gap-2.5 text-[13px]` — 라벨 / 막대(`h-1.5 rounded-full bg-surface`, 채움 `bg-good` 폭 `min(100, have/need×100)%`, `role="img" aria-label="공부한 날, 2일 중 1일[, 채웠어요]"`) / 숫자(12.5 ink2 tabular 오른쪽, `aria-hidden`; 채웠으면 `good` bold "✓ 2/2일").
- `guard.studyDays`·`guard.items` 가 없으면(옛 응답) 막대 두 줄을 빼고 문장만 둔다.

#### C. 건너뛰기 — 5초 되돌리기 (`#rv-skip` · `#rv-skip-fail` · `#rv-skipped`, b=B) — `useReviewSkip(review, onCommitted)`

상태: `{ phase: 'idle' | 'pending' | 'sending' | 'failed', reviewId, deadline }` — `TodayHome` 에 하나.

| 일 | 화면 | 요청 |
|---|---|---|
| [오늘은 건너뛰기] 누름 | `phase=pending` → 카드가 3번(건너뜀, 아래 자리)으로 바뀌고 `UndoToast` "오늘 복습을 건너뛰었어요 [되돌리기]" · 초점을 [되돌리기]로 | **보내지 않는다.** `setTimeout(commit, 5000)` |
| [되돌리기] (5초 안) | `phase=idle` → 9/10번 카드(위)로 · 토스트 "건너뛰기를 되돌렸어요" · 초점을 [오늘은 건너뛰기]로 | **0회** |
| 5초 지남 | `phase=sending` → 토스트 닫힘(이미 저장 중이라 되돌리기 없음) | #64 `POST /api/v1/reviews/{id}/skip` 1회 |
| 성공 | `phase=idle` + #58 다시 → 13번(서버 `SKIPPED`). 초점이 토스트 안에 있었으면 카드 h2(`tabIndex=-1`)로 | — |
| 실패(0·5xx·429) | `phase=failed` → 9/10번(위) + 카드 안 `role=alert` "건너뛰지 못했어요. 다시 눌러 주세요." · 초점 [오늘은 건너뛰기] | 자동 재시도 없음. 다시 누르면 같은 5초 흐름 |
| 409·404 | `phase=idle` + #58 다시(이미 처리됐거나 시작된 복습 — 서버 상태대로, 문구 없음) | — |
| **5초 안에 화면을 떠남** | — | **그 자리에서 바로 보낸다(권고)** — 아래 |

- **떠남 = 즉시 보냄(취소 아님)** — 트리거: `visibilitychange → hidden`(다른 앱·홈 버튼·앱 백그라운드·화면 끄기 — 웹과 앱 WebView 공통, `window.Capacitor` 직접 사용 금지), `pagehide`, `TodayHome` 언마운트(다른 탭·수업 경로로 이동). 보낼 때 `keepalive: true`(§14-5 `api.ts` 선택 옵션)로 페이지가 닫혀도 요청이 끝나게 한다.
  - 이유 ① **보인 대로 저장**: 사용자는 이미 "건너뛰었어요" 화면을 보고 떠났다. 취소하면 돌아왔을 때 복습 카드가 말없이 되살아나 "건너뛰었는데 왜 또 있지?"가 된다. ② 결정 b 에서 받아들인 대가 그대로다 — "토스트를 놓치면 되돌릴 수 없어요(항목은 다음 학습일에 다시 나와요)". 떠나는 것 = 토스트를 놓치는 것. ③ 건너뛰기는 잃는 것이 없다(항목은 그대로, 다음 학습일에 다시 DUE). 반대로 "건너뛰고 바로 회화 탭으로" 같은 흔한 흐름이 취소로 매번 무효가 되면 의도가 사라진다. ④ 백그라운드에서는 타이머가 늦어지거나 멈춰 5초 타이머를 믿을 수 없다 — 숨김 시점에 확정하는 쪽이 결과가 하나로 정해진다.
  - 떠나면서 보낸 요청이 실패하면 사용자는 그 자리에 없다 → `sessionStorage kaiwa.review.skipFailed = {reviewId}` 를 남기고, 다음에 홈을 열었을 때 그 일정이 아직 `DUE` 면 9/10번 + 실패 줄(`#rv-skip-fail`)로 보인 뒤 플래그를 지운다(`SKIPPED` 면 그냥 지운다). 저장소가 막히면 조용히 서버 상태만 보인다(try/catch).
- 보내는 중복 막기: `committedRef` — 타이머·숨김·언마운트가 겹쳐도 #64 는 한 번. 되돌리기는 `phase === 'pending'` 일 때만 받는다.
- pending 중 #58 이 다시 읽혀도(화면 복귀 tick·판단 대기 재확인) 로컬 `skip` 이 이긴다(표 3번). 응답의 `review.id` 가 바뀌면(날짜가 바뀜) 로컬 상태를 버린다.
- `UndoToast`(`lesson/review/UndoToast.tsx`, 공용 `Toast` 는 `pointer-events-none` 이라 버튼을 못 단다): `fixed left-4 right-4 z-50 flex items-center justify-between gap-2 rounded-xl bg-ink py-0.5 pl-3.5 pr-1 text-surface shadow-lg`, `bottom: calc(84px + var(--safe-bottom) + var(--kb-inset, 0px))`(공용 Toast 와 같은 자리) · `<p role="status" aria-live="polite" 13.5px>` + `<button min-h-11 px-3 text-[14px] font-bold underline underline-offset-[3px] text-surface focus-visible:outline-surface>되돌리기</button>`. 떠 있는 동안 같은 자리 공용 토스트는 띄우지 않는다(되돌린 뒤의 "건너뛰기를 되돌렸어요"는 UndoToast 가 닫힌 뒤).
- 카운트다운 숫자는 그리지 않는다(데모 그대로). `prefers-reduced-motion` 이면 나타남 애니메이션 없음.

#### D. 복습 수업 대기·실패 — `LessonGenScreen` 복습 모양 (`#rl-gen` · `#rl-genfail`)

§12-2 D 와 같은 틀에서 `lesson.kind === 'REVIEW'` 일 때만 바꾼다:

| 자리 | 오늘의 회화(그대로) | 복습 |
|---|---|---|
| BackBar | "수업 만들기" / {주제} | "복습 수업 만들기" / "오늘의 복습 · {n}개 항목"(`reviewItems` 없으면 "오늘의 복습") |
| 제목 | 선생님이 수업을 만들고 있어요 | 선생님이 복습 수업을 만들고 있어요 |
| 경과 문구 | `genPhase` | 15초 전 "이번 복습 항목을 살펴보고 있어요" · 45초 전 "항목을 섞어 대화문을 쓰고 있어요" · 그 뒤는 `genPhase` 와 같음(`reviewGenPhase` 가 앞 두 구간만 바꾸고 위임) |
| 가운데 카드 | "이런 순서로 공부해요" 5줄 | `ReviewGenItems`: Card flat "이번 복습 항목 {n}개로 만들어요"(15 semibold) + 칩 줄(근거 상자 칩과 같음, 전부 — 7개 제한 없음) + "항목을 섞은 새 대화로 오늘의 회화와 같은 5단계(이해 → 문법 → 문제 → 응용 → 말하기)를 해요. ● 은 집중 항목이에요."(13 ink2 mt-2) |
| 실패 | [다시 만들기]·[다른 주제 고르기] | "복습 수업을 만들지 못했어요" · [다시 만들기](#63 `{reviewScheduleId}` — 같은 레슨이면 `onSettled`, 다른 `lessonId` 면 `router.replace`) · [오늘로 돌아가기](ghost full → `/study/today`). 건너뛰기는 오늘 홈 카드(6번)에서 |
| 준비 토스트 | 수업이 준비됐어요 | 복습 수업이 준비됐어요 |

- 폴링·경과 시간·연결 끊김 note·"나가도 계속 만들어져요" 문구는 §12-2 D 그대로.

#### E. 수업 머리 — `LessonHeader` (`#lesson-compare`)

```
h1 16 semibold truncate:
  (REVIEW) <span aria-hidden 20px-높이 뱃지 bg-accent-soft text-ink 11.5 semibold rounded-md px-2 mr-1 align-[1px]>복습</span>
           <span class="sr-only">오늘의 복습: </span>
  (NEW)    <span class="sr-only">오늘의 회화, {주제}: </span>        ← 그대로
  <span lang=ja>{title}</span>
TtsRuntimeStatusIndicator   (그대로)
```
- `LessonHeader` 에 선택 prop `review?: boolean` 만 더한다(기본 false → 지금과 같음). 단계 표시·스크롤·입력 바는 그대로.
- 이름 충돌 주의: 기존 `reviewing`(끝낸 단계 다시 보기)과 섞지 않게 새 값은 **`isReviewLesson`** 으로 부른다.

#### F. ① 이해 — 맨 위 "이번 복습 항목" (`#rl1` · `#rl1-closed`)

- **`StageUnderstand` 는 고치지 않는다.** `LessonStages`(LessonScreen.tsx) 의 스크롤 영역에서 `stage === 1 && isReviewLesson` 일 때 `{reviewNote}` 다음, `<StageUnderstand>` 앞에 `ReviewItemsCard` 를 넣는다(데모 순서: 다시 보기 안내 → 항목 카드 → ① 제목).

```
Card (mb-2.5)
  <button 접기 머리 w-full min-h-12 flex items-center gap-2 text-left aria-expanded aria-controls>
     <span flex-1 min-w-0 15 semibold>이번 복습 항목 {n}개 <span 12 ink2 font-normal>· 집중 {f}개</span></span>   (f=0 이면 뒷부분 없음)
     <span chev aria-hidden>›</span>
  </button>
  <div id hidden={!open}>
     <p 13 ink2 mt-1>선생님이 고른 항목이에요. 오늘 대화·문제·말하기에 섞여 나와요.</p>
     <ul mt-2> ReviewItemRow × n </ul>
     (f>0) <p 12 ink2 mt-2> FocusBadge "집중" + " 자주 틀리거나 교정받은 항목이에요. 다음 복습도 3일 안에 다시 봐요."</p>
  </div>
```
- **ReviewItemRow**(`li grid grid-cols-[minmax(0,1fr)_auto] gap-x-2.5 py-2.5 border-t border-line first:border-t-0 first:pt-0.5`):
  - 1줄: 종류 칩(`h-5 rounded-md bg-surface2 px-1.5 11.5px semibold ink2`) + `<span lang=ja 17px/1.5 [overflow-wrap:anywhere]>{textJa}</span>`
  - **읽기 줄 없음**(Leader ③ — `[읽기]` 토글은 이 카드에 영향 없음)
  - 2줄: `meaningKo`(14px, 없으면 줄 생략)
  - 3줄(12 ink2): `{횟수}` · 공부 {studiedCount}번 · {출처}에서 — 횟수: `feedbackCount > 0` → "교정 {n}번" / `wrongCount > 0` → "틀림 {n}번"(둘 다 `bad` semibold) / 아니면 "틀린 적 없음". `studiedCount === 0` → ★"처음 복습해요". 출처 라벨을 모르면 "· {출처}에서" 를 뺀다.
  - 오른쪽: 집중이면 `FocusBadge "집중"`, 아니면 빈 칸.
- 순서(`sortReviewItems`): FOCUS 먼저 → (`feedbackCount + wrongCount`) 큰 순 → `studiedCount` 작은 순 → 원래 순서.
- 라벨: 종류 `EXPRESSION`·`CHUNK` → 표현, `GRAMMAR` → 문형, `WORD` → 단어(`SCENARIO` → 상황, `LESSON` → 수업 — Phase 2 에선 안 나옴) / 출처(Leader ④, `refType`) `TopicChunk`·`Expr`·`Grammar` → 수업, `Correction` → 회화 교정, `WordEntry` → 단어 세트.
- 접힘 상태는 `sessionStorage kaiwa.review.itemsOpen.{lessonId}`(try/catch, 기본 펼침). 다시 보기(끝낸 ①)에서도 같은 카드.
- 데이터: #60 `reviewItems[]`(★②). 없으면 카드를 그리지 않는다.

#### G. ② 문법 — 집중 표시 (`#rl2`)

- `StageGrammar` 에 선택 prop 두 개만: `focusIds?: ReadonlySet<string>`(REVIEW 의 FOCUS 항목 id) · `variant?: 'NEW' | 'REVIEW'`(기본 NEW).
- REVIEW 이면: 설명 "복습할 표현과 문형 {g}개예요. 표현과 예문을 듣고 소리 내어 따라 읽어 보세요." · 표현 카드 제목 "복습 표현 {n}개" · 설명 "이번 복습 항목이에요. 누르면 소리를 들을 수 있어요. 문제·응용·말하기에서 다시 써요."(자막만: "이번 복습 항목이에요. 문제·응용·말하기에서 다시 써요.") · 칩의 `badge` 자리에 `focusIds.has(c.id)` 면 `FocusBadge "집중"`(높이 20px), `isNew` 면 기존 "새 표현".
- A5 는 항목을 전부 `chunks[]` 로 넣고 **id 를 그대로 둔다**(PE reviewMix 설계) — 그래서 문형 항목(예: 〜で)도 "복습 표현" 칩으로 나오고, 집중 표시는 칩에만 붙는다. **문형 카드에는 집중 표시를 달 수 없다**(문형은 A5 가 새 id `g1…` 로 다시 쓴다, §14-11 데모와 다른 점 ⑤).

#### H. ③ 문제 결과 한 줄

- `StageQuiz` 에 선택 prop `variant?: 'NEW' | 'REVIEW'`. REVIEW 결과 카드 아래 문구만 "틀린 문제는 수업을 마친 뒤 선생님이 다음 복습 날짜를 정할 때 참고해요."(NEW 는 `U3.sumNote` 그대로).
- ④ 응용·⑤ 말하기·메모·제안·소리·말하기 판정·[수업 마치기]는 **바꾸지 않는다**.

#### I. 복습 종료 카드 — `LessonEnd` 복습 모양 (`#end-compare` · `#rend` · `#rend-more` · `#rend-pending` · `#rend-fb`)

`lesson.kind === 'REVIEW'` 이면 아래만 바꾼다(통계 3칸·쓴 표현/못 쓴 표현 카드·단어장 줄은 그대로):

```
BackBar backHref=/study/today backLabel="오늘로" title="복습을 마쳤어요" subtitle="오늘의 복습 · {M월 D일}"
Hero: h2 "복습을 마쳤어요" / <p lang=ja 14>{title}</p> / <p 12 ink2>"{n}개 항목 복습 · {titleKo}"
StatTiles · 쓴 표현 Card   (그대로, 단 기록 문구 = "복습한 항목마다 공부 횟수를 1번씩 더했어요.")
NextReviewCard            ← "다음 시간엔"·[다음 수업 만들기]·[이어서 말하기]·붙여넣기 분기 대신
<div> [오늘로] Btn primary full / <p 12 ink2 text-center mt-2>오늘 탭에서 새 수업도 이어서 할 수 있어요.</p> </div>
(맨 아래 밑줄 [오늘로] 없음 — 주 버튼이 [오늘로])
```
- 복습 레슨은 `topic: null` 이라 지금 코드에선 "붙여넣은 문장"·붙여넣기 버튼으로 떨어진다 — **`kind` 분기를 `topic` 분기보다 먼저** 둔다.

**NextReviewCard**(`section rounded-[14px] bg-accent-soft p-3.5 aria-labelledby`, `lesson/review/NextReviewCard.tsx`) — 위에 `<p 13 ink2>다음 복습</p>`:

| 상태 | 조건 | 내용 |
|---|---|---|
| 대기 (`#rend-pending`) | `nextReview == null` 이고 (`reviewDecisionJobId` 를 지켜보는 중 또는 다시 들어와 #60 을 다시 읽는 중) | `<h3 17 bold flex gap-2>` `Spinner`(16px accent) + "선생님이 다음 복습 날짜를 정하고 있어요" / `<p 14 role=status>` "보통 1분 안에 끝나요. 이 화면을 나가도 괜찮아요 — 오늘 탭에서도 볼 수 있어요." |
| 선생님 판단 (`#rend` · `#rend-more`) | `nextReview.decidedBy === 'TUTOR'` | `<h3>` "선생님이 {dmin}일 뒤로 정했어요" / `<p 14>` 묶음이 2개 이상이면 "{가장 이른 날짜(요일)}부터, 항목마다 3~7일 간격이에요.", 1개면 "{날짜(요일)}에 다시 봐요." / 묶음 목록(`flex-col gap-2 mt-2.5`): 행 `rounded-xl bg-surface px-3 py-2.5` — `<p flex justify-between 13>` `<b 15>{d}일 뒤</b>` `<span 12 ink2>{날짜(요일)} · {k}개</span>` + 칩 줄(`ExprChip` bg-surface2, ja 15px, 집중이면 `FocusBadge`) / `TeacherWhy`(bg-surface, 본문 = `rationaleKo`, 칩 없음, [자세히]/[접기] 늘 둠) |
| 판단 실패 (`#rend-fb`) | `decidedBy === 'FALLBACK'` | `<h3>` "가장 가까운 복습은 {dmin}일 뒤예요" / `<p 14>` "{날짜(요일)}" / `<p 12 ink2>` "이번엔 선생님 판단 없이 지난 간격대로 정했어요. 다음에 공부할 때 다시 판단해요." — 묶음·근거 없음(데모 그대로) |
| 모름 | 대기를 끝냈는데도 `null`(잡 404 등) | `<p 14>` "다음 복습 날짜는 오늘 탭에서 볼 수 있어요." |

- 묶음 칩: `groups[].itemIds` → `reviewItems` 에서 `textJa`·집중을 찾는다. 못 찾은 id 는 건너뛴다. 묶음은 `days` 오름차순.
- 값 흐름(`useNextReview`): 방금 끝냈으면 #62 응답 `nextReview` 를 먼저 쓰고, `reviewDecisionJobId` 가 있으면 대기 → `useJobWatch(jobId, {delays:[2000,3000,5000]})` → `DONE`·`FAILED` 어느 쪽이든 #60 을 다시 읽어 `nextReview` 를 쓴다(Leader ⑤ — 실패면 서버가 `FALLBACK` 으로 채운다). 다시 들어왔을 때(#60 `DONE`) `nextReview` 가 `null` 이면 지켜볼 잡 id 가 없으므로 화면이 보이는 동안 #60 을 5·10·20·30초에 다시 읽고 멈춘다(그 뒤는 화면 복귀 때 한 번).
- 대기에서 채워질 때 초점은 옮기지 않는다(`role=status` 로 알림). 초점은 §12 와 같이 마운트 때 h2.

### 14-3. 상태 관리

#### A. 오늘 홈 — `TodayHome` + `deriveReviewCard` + `useReviewSkip` + `useDecisionWatch`
- `deriveReviewCard(state, today, skip): ReviewCard`(§14-2 A 표, 순수) · `reviewPlacement(card): 'above' | 'below' | 'soon' | 'none'`(순수). 둘 다 `lesson/review/reviewLogic.ts`, 단위 테스트로 16행 조합을 고정한다.
- `useReviewSkip(review, { onCommitted: reload, onToast })` — §14-2 C. 타이머·`visibilitychange`·`pagehide`·언마운트 정리를 이 훅 하나에 둔다.
- `useDecisionWatch(card.kind ∈ {pending, donePending}, reload)` — 화면이 보이는 동안 #58 을 10·20·30초, 이후 30초마다 다시 읽고 **3분**에서 멈춘다(그 뒤는 기존 화면 복귀 tick). A11 잡 id 가 #58 에 없어서 #55 대신 #58 을 다시 읽는다(Leader ②). 기존 `lessonTick` 을 올리는 방식이라 새 요청 경로가 없다.
- 만드는 중(5번)은 `useJobWatch(review.jobId, { delays:[5000], onSettled: reload })`(오늘의 회화 카드와 같은 방식, 두 감시가 동시에 있어도 된다).

#### B. 수업 — `LessonScreen`
- `isReviewLesson = lesson.kind === 'REVIEW'`, `reviewItems = lesson.reviewItems ?? []`(★②), `focusIds = new Set(reviewItems.filter(x => x.priority === 'FOCUS').map(x => x.id))`(`useMemo`).
- 분기는 §12 그대로(`GENERATING|FAILED` → 대기·실패, `DONE` → 종료, 그 밖 → 5단계)이고, 각 화면에 `isReviewLesson`·`reviewItems`·`focusIds` 를 선택 prop 으로 내린다.
- `complete()` 성공 시 `onEnded` 에 `reviewDecisionJobId`·`nextReview` 도 넘긴다(`EndResult` 에 선택 칸 `review?: { jobId: string | null; nextReview: NextReviewDetail | null }`). `endResultFrom`(다시 들어옴)은 #60 `nextReview` 를 그대로 싣는다.

### 14-4. API 호출 계획 (정본 api-contract §2-13 #58·#60·#62·#63·#64 · #55 + Leader 결정 ①~⑦)

| 화면·동작 | 엔드포인트 | 파라미터 | 쓰는 필드 | 오류 처리 |
|---|---|---|---|---|
| 오늘 홈 카드 | #58 `GET /api/v1/lessons/today` (기존 요청 그대로) | — | `review{id,status,itemCount,focusCount,preview[≤7]{textJa,priority},decidedBy,tutorRationale,decidedAt,lessonId,stageDone,jobId}` · `guard{reason,studyDays{have,need},items{have,need}}` · `decisionPending` · `nextReview{date,days,itemCount[,decidedBy★④]}` · `todayLessons[]`(복습 레슨의 `status`·`score` 찾기) | 실패 → 오늘의 회화 카드 한 곳에서 합친 문구(복습 카드 숨김) |
| 판단 대기 재확인 | #58 (같은 요청) | — | 위와 같음 | 실패 무시(다음 주기) |
| 홈 만드는 중 | #55 `GET /api/v1/jobs/:id` | `review.jobId` | `status` | 실패 무시 |
| 복습 시작 | #63 `POST /api/v1/reviews/:id/start` | `:id = review.id` | `lessonId`, `jobId` | 409(`status≠DUE`)·404 → 토스트 + #58 다시 · 429 · 0 · 그 밖 → 토스트(§14-8 ⓐ) |
| 건너뛰기 | #64 `POST /api/v1/reviews/:id/skip` | `:id = review.id`, `keepalive`(떠날 때) | `status`(`SKIPPED`) | 409·404 → #58 다시(문구 없음) · 0·429·5xx → 카드 실패 줄 |
| 복습 수업 읽기 | #60 `GET /api/v1/lessons/:id` | — | §12 필드 + `kind` · `reviewScheduleId` · `reviewItems[]`★② · `nextReview{decidedBy,rationaleKo,groups[{days,date,itemIds}]}` | §12-2 L 그대로 |
| 복습 수업 대기 | #55 | `lesson.jobId` | `status`,`stage` | §12-2 D 그대로 |
| 다시 만들기(대기 화면 실패) | #63 | `:id = lesson.reviewScheduleId` | `lessonId`,`jobId` | 409 → #60 다시 · 그 밖 → 토스트 |
| 진행·메모·말하기·소리 | #61 · #62a · #62b · #62c | §12 그대로 | §12 그대로 | §12 그대로 |
| 복습 마치기 | #62 `POST /api/v1/lessons/:id/complete` | `{}` | §12 `result` + `reviewDecisionJobId` · `nextReview`(#60 과 같은 모양 ★⑤) | §12 그대로(409 `ALREADY_DONE`·`STAGES_LEFT`) |
| 다음 복습 판단 대기 | #55 → #60 | `reviewDecisionJobId` | `status` → `nextReview` | 잡 실패·404 도 #60 을 다시 읽는다 |

- 새 엔드포인트 없음. 경로의 id 는 #58 `review.id`(= ReviewSchedule id)다 — 레슨 id 와 섞지 않는다.

### 14-5. 컴포넌트 분해 (`src/components/lesson/review/*` 신규 + 기존 lesson·vocab 에 선택 prop)

| 파일 | 역할 | 주요 props |
|---|---|---|
| `TodayReviewCard.tsx` | 홈 카드(§14-2 A 의 5~15번, 표시 전용) | `{ card: ReviewCard; teacherName; busy: boolean; skipFailed: boolean; onStart(); onRetry(); onOpen(lessonId); onSkip() }` |
| `ReviewSoonSection.tsx` · `MeterRow` | "곧 열려요" + 가드 카드 | `{ guard: ReviewGuard }` |
| `TeacherWhy.tsx` · `JaQuoted` | 근거 상자(TUTOR/FALLBACK, 접기) | `{ mode: 'TUTOR' \| 'FALLBACK'; text: string \| null; who: string; at: string \| null; chips?: ReviewChip[]; more?: number; surface?: boolean }` |
| `UndoToast.tsx` | 되돌리기 토스트 | `{ open: boolean; message: string; actionLabel: string; onAction(); actionRef }` |
| `FocusBadge.tsx` · `FocusDot` | ● 집중 뱃지(`bg-accent-soft text-ink ring-1 ring-inset ring-accent` + 6px `accent` 점) · 칩 앞 7px 점 | `{ children }` |
| `ReviewItemsCard.tsx` | ① 이번 복습 항목(접기) | `{ lessonId; items: ReviewItem[] }` |
| `ReviewGenItems.tsx` | 대기 화면 가운데 카드 | `{ items: ReviewItem[] }` |
| `NextReviewCard.tsx` | 종료 카드 다음 복습 | `{ state: 'pending' \| 'ready' \| 'unknown'; next: NextReviewDetail \| null; items: ReviewItem[]; teacherName }` |
| `reviewLogic.ts` | `deriveReviewCard`·`reviewPlacement`·`sortReviewItems`·`itemTypeLabel`·`sourceLabel`·`countLabel`·`splitJaQuotes`·`formatDue`(날짜+요일)·`reviewGenPhase`·`groupsSorted` — 순수, 테스트 `__tests__/review.test.ts` | — |
| `useReviewSkip.ts` · `useDecisionWatch.ts` · `useNextReview.ts` | 상태(§14-3) | — |
| `reviewCopy.ts` | 문구(§14-8) — `lessonCopy.ts` 는 건드리지 않는다 | — |

기존 파일에 끼우는 곳(전부 **선택 prop·한 줄 분기 — NEW 경로 동작 불변**):

| 파일 | 바꾸는 곳 |
|---|---|
| `vocab/TodayHome.tsx` | props `teacherName` 추가 · `deriveReviewCard`/`reviewPlacement` 로 카드 위·아래·곧 열려요 배치 · `useReviewSkip`·`useDecisionWatch` · `UndoToast` · 복습 카드 `useJobWatch` · `TodayLessonCard errorText` |
| `lesson/logic.ts` | `deriveLessonCard`: `todayLessons` 를 `kind === 'NEW'` 로 거름(테스트 추가) |
| `lesson/TodayLessonCard.tsx` | 선택 prop `errorText?: string`(기본 `HOME.loadError`) |
| `lesson/LessonScreen.tsx` | `isReviewLesson`·`reviewItems`·`focusIds` 계산 · `LessonHeader review` · ① 앞 `ReviewItemsCard` · `StageGrammar`/`StageQuiz` 에 `variant`·`focusIds` · 준비 토스트 문구 · `complete()` 결과에 복습 칸 |
| `lesson/parts.tsx` | `LessonHeader` 선택 prop `review?: boolean` |
| `lesson/StageGrammar.tsx` · `lesson/StageQuiz.tsx` | 선택 prop(§14-2 G·H) |
| `lesson/LessonGenScreen.tsx` | `kind === 'REVIEW'` 분기(§14-2 D) |
| `lesson/LessonEnd.tsx` | `kind === 'REVIEW'` 분기를 `topic` 분기 앞에(§14-2 I) |
| `common/api.ts` | `ApiOptions.keepalive?: boolean` → `fetch(..., { keepalive })`(기본 false, 기존 호출 불변) |
| `app/(app)/study/today/page.tsx` | `teacherName` 을 넘김 |
| `types/lesson.ts` | `TodayLessons` 에 `review`·`guard`·`decisionPending`·`nextReview` · `LessonDto` 에 `reviewScheduleId`·`reviewItems?`·`nextReview?` · `CompleteResult` 에 `reviewDecisionJobId`·`nextReview` (전부 additive) |
| `types/review.ts`(신규) | `TodayReview`·`ReviewGuard`·`NextReviewSummary`·`ReviewItem`·`NextReviewDetail`·`StartReviewResult`·`SkipReviewResult` — 필드명은 계약 그대로 |

- 그대로 재사용(수정 없음): `useJobWatch`·`MiniSteps`·`ExprChip`·`ExprPlayChip`·`Spinner`·`Card`·`Btn`·`Badge`·`ErrorBlock`·`TeacherAvatar`·`BackBar`·`Toast`·`formatMonthDay`·`weekdayOf`·`formatClock`·`kstDateKey`·`correctFromScore`·`genPhase`.

### 14-6. 생성/수정 파일 목록

- 신규: `src/components/lesson/review/{TodayReviewCard,ReviewSoonSection,TeacherWhy,UndoToast,FocusBadge,ReviewItemsCard,ReviewGenItems,NextReviewCard}.tsx` · `src/components/lesson/review/{reviewLogic,reviewCopy,useReviewSkip,useDecisionWatch,useNextReview}.ts` · `src/components/lesson/review/__tests__/review.test.ts` · `src/types/review.ts`.
- 수정: §14-5 아래 표의 12개 파일(선택 prop·분기만).
- 서버·계약: 화면 쪽 변경 없음. §14-11 ★ 항목은 Leader 가 서버 1단계와 맞춘다.

### 14-7. 구현 순서

1. 타입(`types/review.ts`·`lesson.ts` additive) + `reviewLogic`(+테스트: 16상태·자리·정렬·라벨·`splitJaQuotes`·`formatDue`) + `deriveLessonCard` NEW 필터(+테스트).
2. `TodayReviewCard`·`TeacherWhy`·`FocusBadge` → `TodayHome` 배치(위/아래) → 오류 문구 합치기 → 홈만으로 #58 확인(복습 있음·폴백·대기·없음·완료·건너뜀).
3. `useReviewSkip`·`UndoToast`(+ `api.ts keepalive`) → 5초·되돌리기·떠남·실패 플래그.
4. `ReviewSoonSection`(가드) · `useDecisionWatch`.
5. [복습 시작] → #63 → `LessonGenScreen` 복습 모양 → `LessonHeader`·`ReviewItemsCard`·`StageGrammar`/`StageQuiz` 선택 prop.
6. `LessonEnd` 복습 분기 → `NextReviewCard`·`useNextReview`(#62 → #55 → #60).
7. 3폭 × 780/892 점검(§14-9) → 데모 v1 상태 목록과 나란히 대조.

### 14-8. 한국어 UI 문구 (`reviewCopy.ts` — 데모 v1 문구 그대로. ★ = 계약 때문에 더한 줄)

ⓐ **오늘 홈 카드**

| 자리 | 문구 |
|---|---|
| 머리 | 오늘의 복습 / 약 15분(복습 있음만) |
| 복습 있음 | {n}개 항목 / 집중 {f}개 / (sr) 선생님 근거: / {이름} 선생님 판단 · 오늘 {HH:mm} / 자세히 / 접기 / 이번 복습 항목 {n}개 / 외 {k}개 / (sr) 집중, / 복습 시작 / 만드는 중… / 오늘은 건너뛰기 |
| 기본 규칙 | 지난 학습에서 틀리거나 오래된 항목을 골랐어요 / 이번엔 기본 규칙으로 골랐어요. |
| 판단 대기 | 선생님이 오늘 복습할 항목을 고르고 있어요 / 곧 준비돼요. 보통 1분 안에 끝나요. 그동안 다른 공부를 해도 괜찮아요. |
| 오늘은 없음 | 오늘은 복습할 항목이 없어요 / 다음 복습 · {M월 D일(요일)}, {d}일 뒤 · {k}개 항목 |
| 만드는 중 | 복습 수업을 만들고 있어요 / {n}개 항목 · 보통 1~2분 걸려요. 다 되면 여기서 열 수 있어요. / 보러 가기 |
| 만들기 실패 | 복습 수업을 만들지 못했어요 / {n}개 항목 · 다시 만들면 대부분 잘 만들어져요. / 다시 만들기 / 오늘은 건너뛰기 |
| 하던 복습 | 하던 복습이 있어요 / {n}개 항목 · 오늘 시작 · 5단계 중 {k}단계 끝냄 / 다음은 {③ 문제}예요. 단계마다 저장돼요. / 이어서 하기 / (aria) 5단계 중 {k}단계 끝냄 |
| 준비됨 | 복습 수업이 준비됐어요 / {n}개 항목 · 5단계 · 약 15분 / 시작하기 |
| 오늘 완료 | ✓ 오늘 복습을 끝냈어요 / {n}개 항목 · 문제 {c}/5 맞힘 / 다음 복습 / {M월 D일(요일)} · 선생님이 {d}일 뒤로 정했어요 / ★(`decidedBy` 모름) {M월 D일(요일)} · {d}일 뒤 / (폴백) {M월 D일(요일)} · {d}일 뒤 + 이번엔 지난 간격대로 정했어요 / 선생님이 날짜를 정하고 있어요 / 끝낸 복습 결과 보기 |
| 건너뜀 | 오늘 복습은 건너뛰었어요 / {n}개 항목은 다음에 공부하는 날 선생님이 다시 골라 드려요. |
| 되돌리기 | 오늘 복습을 건너뛰었어요 / 되돌리기 / (토스트) 건너뛰기를 되돌렸어요 / 건너뛰지 못했어요. 다시 눌러 주세요. |
| ★#58 오류(합침) | 오늘의 회화와 복습을 불러오지 못했어요. [다시 시도] |
| ★시작 오류 토스트 | 오늘 복습이 바뀌었어요. 다시 불러올게요. / 잠시 후 다시 눌러 주세요. / 연결하지 못했어요. 네트워크를 확인해 주세요. / 복습 수업을 만들지 못했어요. 다시 눌러 주세요. |

ⓑ **곧 열려요(가드)**

| 자리 | 문구 |
|---|---|
| 칸 | 곧 열려요 / 오늘의 복습 / 기록이 더 쌓이면 열려요 |
| 본문 | 선생님이 복습 날짜를 정하려면 기록이 조금 더 필요해요. / 공부한 날 / 복습할 재료 / {have}/{need}일 · {have}/{need}개 · ✓ {have}/{need}일 / 수업이나 단어 세트를 끝내거나 교정을 채택하면 재료가 쌓여요. |
| aria | 공부한 날, {need}일 중 {have}일[, 채웠어요] · 복습할 재료, {need}개 중 {have}개[, 채웠어요] |

ⓒ **복습 수업 대기·실패**

| 자리 | 문구 |
|---|---|
| 머리 | 복습 수업 만들기 / 오늘의 복습 · {n}개 항목 |
| 대기 | 선생님이 복습 수업을 만들고 있어요 / 이번 복습 항목을 살펴보고 있어요 · 항목을 섞어 대화문을 쓰고 있어요 · (이후 §12-8 ⓓ 그대로) |
| 가운데 카드 | 이번 복습 항목 {n}개로 만들어요 / 항목을 섞은 새 대화로 오늘의 회화와 같은 5단계(이해 → 문법 → 문제 → 응용 → 말하기)를 해요. ● 은 집중 항목이에요. |
| 실패·토스트 | 복습 수업을 만들지 못했어요 / (본문·[다시 만들기] §12-8 ⓓ 그대로) / 오늘로 돌아가기 / (토스트) 복습 수업이 준비됐어요 |

ⓓ **복습 수업**

| 자리 | 문구 |
|---|---|
| 머리 | 복습(뱃지) / (sr) 오늘의 복습: |
| ① 항목 카드 | 이번 복습 항목 {n}개 · 집중 {f}개 / 선생님이 고른 항목이에요. 오늘 대화·문제·말하기에 섞여 나와요. / 표현 · 문형 · 단어 / 교정 {n}번 · 틀림 {n}번 · 틀린 적 없음 / 공부 {n}번 · ★처음 복습해요 / 수업에서 · 회화 교정에서 · 단어 세트에서 / 집중 / 자주 틀리거나 교정받은 항목이에요. 다음 복습도 3일 안에 다시 봐요. |
| ② | 복습할 표현과 문형 {g}개예요. 표현과 예문을 듣고 소리 내어 따라 읽어 보세요. / 복습 표현 {n}개 / 이번 복습 항목이에요. 누르면 소리를 들을 수 있어요. 문제·응용·말하기에서 다시 써요. / (자막만) 이번 복습 항목이에요. 문제·응용·말하기에서 다시 써요. / 집중 |
| ③ | 틀린 문제는 수업을 마친 뒤 선생님이 다음 복습 날짜를 정할 때 참고해요. |

ⓔ **복습 종료 카드**

| 자리 | 문구 |
|---|---|
| 머리·본문 | 복습을 마쳤어요 / 오늘의 복습 · {M월 D일} / {n}개 항목 복습 · {titleKo} / 복습한 항목마다 공부 횟수를 1번씩 더했어요. |
| 다음 복습 | 다음 복습 / 선생님이 다음 복습 날짜를 정하고 있어요 / 보통 1분 안에 끝나요. 이 화면을 나가도 괜찮아요 — 오늘 탭에서도 볼 수 있어요. / 선생님이 {d}일 뒤로 정했어요 / {날짜(요일)}부터, 항목마다 3~7일 간격이에요. / ★{날짜(요일)}에 다시 봐요. / {d}일 뒤 / {날짜(요일)} · {k}개 / 가장 가까운 복습은 {d}일 뒤예요 / 이번엔 선생님 판단 없이 지난 간격대로 정했어요. 다음에 공부할 때 다시 판단해요. / ★다음 복습 날짜는 오늘 탭에서 볼 수 있어요. |
| 버튼 | 오늘로 / 오늘 탭에서 새 수업도 이어서 할 수 있어요. |

### 14-9. 360/390/412 · 높이 780/892 · 접근성 · QA 체크리스트 초안 (데모 v1 "세 폭"·"892" 와 나란히 대조)

상태별 문구(픽스처 #58·#60·#62 로 하나씩 — 데모 상태 id 와 1:1)
- [ ] 홈 16행 표의 조건마다 해당 카드·문구·자리(위/아래/곧 열려요/없음)가 나온다. 특히 3(로컬 건너뜀이 서버 `DUE` 를 이김)·6(레슨 `FAILED`)·8(준비됨)·12(완료+판단 대기)·16(가드 `cycle`/`stale` → 숨김).
- [ ] 위치(a=A): 5~10번은 오늘의 회화 **위**, 11~15번은 **아래**(오늘의 회화와 AI 평가 사이), 가드는 보관한 세트 다음 "곧 열려요".
- [ ] #58 로딩·실패: 복습 카드 0개, 오늘의 회화 카드에만 "불러오는 중…"/합친 오류 문구 1개. [다시 시도]가 두 카드를 함께 채운다.
- [ ] 복습 레슨이 만들어지는 중·하던 중·끝난 날에도 **오늘의 회화 카드는 자기 상태 그대로**(NEW 필터) · 지난 날짜 하던 복습이 "하던 수업"으로 나오지 않는다(★①).
- [ ] TUTOR 근거 2줄 말줄임 → [자세히] 전체 + 칩(최대 7 + "외 {k}개") → [접기]. FALLBACK 은 ⓘ + 고정 문구, [자세히]·칩 없음.

건너뛰기 5초(네트워크 기록으로 #64 횟수 확인)
- [ ] 누름 → 카드가 아래로 "건너뛰었어요" + 토스트, **#64 0회** · 5초 안 [되돌리기] → 카드 위로 복귀, 토스트 "건너뛰기를 되돌렸어요", **#64 0회** · 그대로 5초 → **#64 정확히 1회**, 새로 읽은 #58 `SKIPPED`.
- [ ] 5초 안에 다른 탭 이동 / 수업 경로 이동 / 앱 홈 버튼(백그라운드) / 화면 끄기 → 그 순간 #64 1회(중복 0), 돌아오면 건너뜀 카드.
- [ ] 오프라인에서 5초 → 카드 위로 복귀 + "건너뛰지 못했어요. 다시 눌러 주세요."(`role=alert`) · 오프라인에서 떠남 → 다시 열면 같은 실패 줄 1회 · 409 응답 → 문구 없이 서버 상태.
- [ ] 되돌리기 버튼 44px·키보드로 누를 수 있고, 초점 이동(되돌리기 ↔ 건너뛰기 링크 ↔ 카드 제목)이 끊기지 않는다.

흐름: 복습 시작 → 대기 → 수업 → 종료
- [ ] [복습 시작] 두 번 눌러도 #63 1회 → "복습 수업 만들기" 대기(제목·부제·항목 칩·경과 문구 복습판) → 준비 토스트 "복습 수업이 준비됐어요" → ① 맨 위 항목 카드(읽기 줄 없음 — [읽기] 토글을 바꿔도 이 카드는 그대로) → ② 복습 표현 칩에 집중 뱃지 → ③ 결과 문구 복습판 → ④⑤ 오늘의 회화와 같음 → [수업 마치기] → 종료 카드 "복습을 마쳤어요" + 다음 복습 대기 → 판단 끝(#55 → #60) 묶음·근거 → [오늘로] → 홈 11번(다음 복습 줄).
- [ ] 대기 실패 → [다시 만들기]로 새 잡(★③) · [오늘로 돌아가기] · 홈 6번 카드에서 [오늘은 건너뛰기] 가능(★⑦).
- [ ] 종료 카드에 [다음 수업 만들기]·[이어서 말하기]·붙여넣기 버튼이 **없다**. 다시 들어와도(#60 DONE) 같은 카드.

폭·높이
- [ ] 세 폭 모두 가로 스크롤 0 — 근거 300자 · `textJa` 40자 칩 7개 · `meaningKo` 60자 · 항목 12개 · 집중 12개 · 묶음 3개로(일본어에 `break-keep` 금지, `[overflow-wrap:anywhere]`).
- [ ] 390×780: 복습 있는 날 [복습 시작] 하단이 탭 바 위(데모 실측 665, 360×740 은 684 — 경계) · 복습 없는 날(11~15번) 오늘의 회화 주 버튼이 지금처럼 첫 화면(데모 673/693).
- [ ] 360: 근거 메타줄과 [자세히]가 겹치지 않음(줄바꿈 허용) · 가드 막대 3열(라벨 ≥130px) · 묶음 행 "{d}일 뒤 / 날짜 · {k}개" 한 줄 · 머리 "복습" 뱃지 + 제목 말줄임.
- [ ] 892: UndoToast·공용 토스트가 탭 바·safe-area 위, 키보드가 열려 있으면 키보드 위(`--kb-inset`).

접근성·엔진명
- [ ] 모든 `textJa`·칩·근거 속 「…」에 `lang="ja"`. ① 일본어 17px · 칩 15px · 캡션 ≥11px.
- [ ] 접기 머리·[자세히] `aria-expanded`/`aria-controls`, 판단 대기·다음 복습 대기 `role=status`, 건너뛰기 실패 `role=alert`, 막대 `role=img` + 숫자 `aria-hidden`, 집중은 글자 "집중"/sr "집중, "(색만으로 구분 안 함).
- [ ] `prefers-reduced-motion`: 스피너·띠 정지.
- [ ] 렌더 텍스트·토스트·DOM 속성에 `claude|haiku|sonnet|opus|qwen|reazon|whisper|style-bert|sherpa|zipformer|onnx|엔진|모델|TUTOR|FALLBACK|REVIEW_DECISION|REVIEW_GEN|Phase|task-` 0건, 일정·잡 id 0건.
- [ ] 타인 `review.id` 로 #63·#64 → 404 → 화면이 깨지지 않고 #58 다시.

### 14-10. 주의사항 · developer 가 건드리지 말 것

주의사항
- **복습 카드는 기다리지 않는다**: 판단 대기·만드는 중에도 다른 카드와 [복습 시작] 외 동작은 막지 않는다. 재확인은 화면이 보일 때만.
- **날짜**: "오늘"·"{d}일 뒤"는 서버 `date`·`days` 를 그대로(KST). 화면이 날짜를 다시 계산하지 않는다(요일만 `weekdayOf`).
- **숫자 출처**: 항목 수·집중 수는 `review.itemCount/focusCount`, 문제 점수는 복습 레슨 `score` — 화면이 항목 목록에서 다시 세지 않는다.
- **저장소**: `kaiwa.review.skipFailed`·`kaiwa.review.itemsOpen.*` 는 `sessionStorage` + try/catch. `localStorage` 에 복습 상태를 두지 않는다.
- **동시 생성**: 오늘의 회화를 만드는 중에 [복습 시작]을 눌러도 버튼을 미리 막지 않는다 — 서버 오류(409 등)는 위 표대로 토스트.

건드리지 말 것
- `docs/demo/task-010b-repetition-v1.html`(승인본) — 고칠 일이 생기면 Leader 에게.
- 오늘의 회화(NEW) 화면의 동작·문구·DOM — 새 prop 은 전부 선택값이고 기본값이 지금과 같아야 한다(`__tests__/task025.test.ts` 등 기존 테스트 그대로 통과).
- `TodayLessonCard` 의 모양·상태 표(필터 한 줄과 `errorText` 외), `EvalHomeCard`(011)·`TodayWordsCard`·`VocabStatsCard`·`KeptSets`.
- 단어 세트 결과 화면·채팅/회화방 교정 카드·`ProposalCard` — 반복 항목 등록·관측 기록은 서버 트랜잭션 안에서만 일어나고 **화면 문구를 더하지 않는다**.
- 공용 `Toast`·`Badge` 톤 표 — 집중 뱃지·되돌리기 토스트는 `lesson/review/` 안에 새로 만든다.
- `useJobWatch`·`useLesson`·`useLessonPlayback`·`StageUnderstand`·`StageApply`·`StageSpeak` — 고치지 않는다(① 항목 카드는 `LessonScreen` 이 앞에 끼운다).
- `routes.ts`(집중 화면 목록) — 수업 경로가 이미 들어 있다.
- 금지: [복습 시작] 전 #63 미리 부르기(c=A) · ① 읽기 줄·새 DB 칸(Leader ③) · 항목별 `decisionReason` 노출 · `window.Capacitor`·`fetch` 직접 호출(`api.ts` 경유, `keepalive` 옵션) · `dangerouslySetInnerHTML`(근거 문장) · 엔진·판단 주체 원값 표시.

### 14-11. 데모와 다른 점 · Leader 확인 요청

**데모와 다른 점(구현이 데모 v1 과 달라지는 곳 — 재승인 없이 가이드로 처리하자는 판단, 이의가 있으면 Leader 가 사용자에게)**

| # | 데모 v1 | 구현(가이드) | 이유 |
|---|---|---|---|
| ① | 복습 카드에 자체 "불러오는 중…"·"불러오지 못했어요 [다시 시도]"(`#rv-loading`·`#rv-error`) | 복습 카드를 그리지 않고 오늘의 회화 카드 한 곳에 "오늘의 회화와 복습을 불러오지 못했어요." | Leader ⑥(#58 한 응답 — 오류가 두 번 나오지 않게) |
| ② | 가드 = 맨 아래 "곧 열려요" 안, AI 평가 카드와 나란히 | 같은 자리·모양이되 **가드일 때만 "곧 열려요" 칸이 생긴다**(AI 평가는 011 에서 실제 카드가 되어 칸이 사라졌다) | d=B 의 뜻(쓸 수 없는 기능은 맨 아래 한곳) 유지 |
| ③ | "아래" = 오늘의 회화 바로 아래(그 아래는 통계) | 오늘의 회화와 **AI 평가 카드 사이** | 데모 뒤에 생긴 카드 — 복습 카드를 오늘의 회화 옆에 둔다 |
| ④ | ① 항목마다 읽기 줄 | 없음 | Leader ③ |
| ⑤ | ② 문형 카드(〜で)에 ● 집중 | 문형 카드엔 없고, 문형 항목도 "복습 표현" 칩으로 나와 칩에 집중 표시 | A5 가 항목을 전부 chunks(id 보존)로, 문형은 새 id 로 쓴다(PE reviewMix 설계·REV-031 PASS) |
| ⑥ | "오늘 오전 9:12" | "오늘 09:12"(앱 공통 `formatClock`) · 기본 이름이면 "선생님 판단" | 앱 다른 화면과 시각 표기 통일, "선생님 선생님" 방지 |
| ⑦ | 오늘 완료 "선생님이 3일 뒤로 정했어요" | #58 `nextReview` 에 `decidedBy` 가 없으면 "{날짜} · {d}일 뒤"(중립) | 계약에 판단 주체가 없음(★④) |
| ⑧ | 공부 횟수 늘 1번 이상 | 0번이면 "처음 복습해요" | 교정 채택·단어 세트로 막 들어온 항목은 0일 수 있다 |
| ⑨ | 건너뛰기 실패 뒤 초점 [복습 시작] | 초점 [오늘은 건너뛰기] | 실패 문구가 "다시 눌러 주세요"라서(보이는 화면 차이 없음) |
| ⑩ | 5초 안에 떠나는 경우 정의 없음 | 떠나면 즉시 #64(§14-2 C) | 이번 지시 — 권고와 이유는 C 절 |

**Leader 확인 요청(서버 1단계와 맞출 것 — ★ = 화면이 이 값 없이는 그 상태를 못 그림)**

| # | 요청 | 왜 | 없으면 |
|---|---|---|---|
| ★① | #58 `resume` 에 **NEW 레슨만**(또는 `resume.kind` additive) | 지난 날짜에 하다 만 복습 레슨이 오늘의 회화 카드 "하던 수업이 있어요"로 뜬다 — `resume` 엔 `kind` 가 없어 화면이 거를 수 없다 | 복습 레슨이 오늘의 회화로 섞여 보임 |
| ★② | #60(REVIEW, **모든 status**)에 `reviewItems[{id, itemType, textJa, meaningKo, priority, wrongCount, feedbackCount, studiedCount, refType}]` additive(이름은 서버와 합의) | ① 항목 카드·대기 화면 칩·② 집중 표시·종료 카드 묶음 칩이 전부 이것을 쓴다. Leader ③④ 가 뜻·출처를 이 데이터로 보이라고 했지만 #60 필드가 정해지지 않았다. `id` 는 A5 `chunks[].id` 와 같은 RepetitionItem id | ①·대기 칩·집중 표시·묶음 칩 전부 빠짐 |
| ★③ | #63 — 연결된 레슨이 `FAILED` 면 **같은 일정으로 다시 만든다**(#59 의 FAILED 행 되살림과 같은 규칙). 지금 문구는 "이미 lessonId 가 있으면 그 레슨 반환" | 홈 6번·대기 화면 실패의 [다시 만들기] | 실패한 복습을 다시 만들 길이 없음 |
| ④ | #58 `nextReview.decidedBy` additive(선택) | 완료 카드 "선생님이 {d}일 뒤로 정했어요" vs "지난 간격대로" 구분 | 중립 문구(데모와 다른 점 ⑦) |
| ⑤ | #62 `nextReview` 모양 = #60 `nextReview`(`decidedBy, rationaleKo, groups[]`)로 확정 | 방금 끝낸 종료 카드가 #60 을 다시 읽지 않고 바로 그리게 | #62 뒤 #60 을 한 번 더 읽음(동작은 됨) |
| ⑥ | `guard.reason` 의 `cycle`·`stale` 뜻 | 화면은 `insufficient` 만 그리고 나머지는 숨긴다 | 숨김(가드 안내 없음) |
| ⑦ | #64 를 연결 레슨 `FAILED` 일 때도 허용, `IN_PROGRESS` 면 409 | 홈 6번 카드에 [오늘은 건너뛰기]가 있다(데모) | 6번에서 건너뛰기 실패 줄 |
| ⑧ | #58 `todayLessons` 에 복습 레슨을 계속 담는다(지금 서버 동작) — 또는 `review.lessonStatus`·`review.score` additive | 홈 6·7·8·11번이 복습 레슨 상태·점수를 여기서 찾는다 | 6번을 못 그림(수업 경로로 넘겨 실패 화면을 보임), 11번 점수 생략 |

---

## 15. 일본어 표시 — 히라가나·한글·번역 (task-026)

승인 데모: docs/demo/task-026-improve-hangul-reading-v4.html (v4)

- 승인: 사용자 2026-10-04 18:26 "task-026 데모 v4 승인, F1은 A"(content sha256 `ddda03ff…`, task frontmatter `demo_gate`). 데모 상태 id = `#talk`·`#talk-pend`·`#talk-fail`·`#chat`·`#review`·`#words`·`#wsheet`·`#deck`·`#l1`·`#l2`·`#l3`·`#l3b`·`#l4`·`#l5`·`#settings`(주소 `#<id>` 로 바로 열림). 데모의 "현재"는 HEAD 소스 대조본이라 **구현은 지금 컴포넌트 위에 층만 얹는다**(지우거나 옮기는 요소 없음 — §15-4 MOV 9건만 예외).
- 적용 토큰(이름만, 새 색 없음): `--ink`·`--ink2`·`--ink3`·`--surface`·`--surface2`·`--line`·`--accent`·`--accent-soft`·`--bad`(Tailwind `text-ink2`·`bg-surface2`·`border-line` …). 크기: 일본어 본문 17px·한글 13px·루비 11px(최소) — §15-1 표.
- 이 절이 **대체하는 옛 규칙**(구현 배포 뒤 무효): §1-2 "일본어 읽기(히라가나 줄) 14px" 행 · §1-3 전체 · §3-2 C 말풍선 [읽기 ▾]·⋯ "읽기 항상 펼치기" · §3-8 해당 문구 · §4-2 A 단어 행 "옆 읽기" · §5-2 B 카드 앞면 읽기 줄(카드 [읽기] 켰을 때 → 루비) · §9-2 E 선생님 말풍선 읽기 · §12-2 ① [읽기][번역] 알약(→ [히라가나][한글][번역]). 그 밖의 §3·§4·§5·§9·§12 내용은 그대로 유효하다.
- 서버는 끝났다(커밋 `f67bf70`, 운영 반영 10-04 15:55): #24r 읽기 분석 · #11~#12 표시 스위치 3칸 · #29 USER `translation` · #32 `done.userTranslation` · #32t 내 말 번역 다시 가져오기. 이 절은 **화면만** 다룬다.

### 15-0. 결정 요약 (확정 — 바꾸지 않음)

| 결정 | 내용 | 구현에서 뜻하는 것 |
|---|---|---|
| D1-A | 한글 표기 ‘까’ 계열(구절 첫 글자만 거센소리, 장음 ‘-’, 촉음·ん 받침, 조사 は·を·へ 소리대로) | 변환은 `@/modules/speech/reading/client` 의 `hangulLine()` 하나뿐. 화면이 규칙을 만들지 않는다 |
| D2-B | 읽기 없는 한자 문장도 서버가 소리를 구한다(형태소별 표기·읽기) | 모든 일본어는 #24r 로 분석. 문장의 `reading`(LLM 히라가나 줄)은 화면에 더 쓰지 않는다 |
| D4-A | 히라가나·한글·번역은 서로 다른 스위치 | 세 값 독립(하나가 꺼져도 다른 층은 그대로) |
| E1-A | 한자 위 히라가나가 문장 아래 읽기 줄을 대신(목록·제안 카드의 옆 읽기 칸도) | `<p>{reading}</p>` 줄·옆 읽기 `<span>` 을 없애고 `<ruby>` 로 |
| E2-A | 처음 값: 히라가나 켬 · 한글 켬 · 번역 끔 | 서버 기본값 그대로(Profile `true·true·false`) |
| E3-A | 회화방·채팅방 머리 바로 아래 44px 표시 바 [히라가나][한글][번역] | `DisplayBar`(§15-2 G) |
| E4-B | 일괄 + 말풍선별 [번역 ▾] (말풍선 [읽기 ▾] 없앰) | 바에서 번역을 바꾸면 말풍선별로 연 것 초기화(§15-3 D) |
| E5-A · E6-A | 내 말 번역도 번역 스위치를 따름 · 보낼 때마다 미리 만듦(준비 중 “번역 중…”, 실패 [다시 가져오기]) | 사용자 승인 T1(10-04 13:11): 턴 응답에 같이 옴(`done.userTranslation`), 없으면 #32t |
| 범위 | 세 스위치 모두 앱 전체 하나(사용자 설정) — 오늘의 회화 번역 토글도 통합 | 화면별 값 없음. `localStorage kaiwa.chat.readingDefault` 는 1회 이관 후 삭제 |
| 문구 | 한자 위 읽기 표시 이름은 ‘히라가나’(사용자 지시 10-04) | 화면 글자에 ‘후리가나’ 0건(코드 식별자 `furigana` 는 무방) |
| **F1-A** | 회화·채팅 ⋯ 메뉴의 “읽기 항상 펼치기” 줄 제거 | `ChatMenuSheet` 의 그 `role="switch"` 줄·props 삭제 |
| T1 | 내 말 번역은 같은 LLM 호출(추가 호출 0) | 화면은 번역을 "요청"하지 않는다 — 턴 결과를 받거나, 사용자가 누를 때만 #32t |

### 15-1. 공통 규칙

**A. 층 순서(한 블록 안, 위 → 아래)**: 히라가나(한자 위 `<rt>`) → 일본어 본문 → `[한글]` 한 줄 → 번역(말풍선은 안쪽 구분선 아래). 선생님 말·내 말·교정 칸·수업 줄이 모두 같다.

**B. 크기·줄간격(데모 CSS 값 그대로)**

| 자리 | 일본어 | 히라가나(rt) | 루비 블록 줄간격 | `[한글]` |
|---|---|---|---|---|
| 말풍선(선생님·내 말) · 교정 카드 두 칸 · 수업 대화 줄·예문·모범 답안·내 문장·문제 일본어 줄 · ⑤ 내가 한 말 · 설정 미리 보기 | 17 (`JA_BODY`/`JA_TEXT`) | 11 | 1.7 → **2.1** | 13 |
| 단어 상세 예문 | 16 | 11 | 1.7 → **2.15** | 13 |
| 단어 제안 카드 표제어 | 18 semibold | 11 | **2** | 13 |
| 단어장 행 표제어 | 18 semibold | 11 | **1.95** | 12.5 |
| 문제 보기 | 17 | 11 | **2.1** | 12.5 |
| 표현 칩(② 오늘의 표현 · ④ 써 볼 표현 · ⑤ 목표 표현) | 16 | 11 | **2.1** | 12 (칩 안, 일본어 뒤 같은 흐름) |
| 단어 상세 표제어 | 28 semibold | **13** | **1.8** | 14 |
| 오늘의 단어 카드 앞면 | `surfaceSize()` 그대로 | **16** | **1.7** | 15 (위 여백 4px) |

- 루비 줄간격은 **그 블록에 한자가 있고 히라가나 켬일 때만** 넓힌다(`hasKanji(text) && showFurigana`). **분석을 기다리는 동안에도 미리 넓혀** 둔다 — 루비가 채워질 때 세로로 밀리지 않게(데모 `fuCls`). 히라가나 끔이면 원래 줄간격.
- `[한글]` 줄: `lang="ko"` · `text-ink2` · 줄간격 1.5 · 위 여백 2px · `word-break:normal` + `overflow-wrap:anywhere`(**`break-keep` 금지** — 띄어쓰기 없는 긴 소리 줄이 넘친다).
- 번역: 말풍선은 `mt-2 border-t border-line pt-2 text-[15px] text-ink2`(지금 선생님 번역과 같음, 내 말 말풍선은 테두리 `color-mix(ink 18%)` — `accent-soft` 위라서). 수업 ① 번역 13px 은 지금 그대로.

**C. 루비 마크업**: `<ruby>漢字<rt aria-hidden="true">かんじ</rt></ruby>`(`<rp>` 없음). 스타일은 `globals.css` 를 건드리지 않고 공용 컴포넌트 안 클래스로: ruby `[ruby-position:over] [ruby-align:center]`, rt `text-[11px] leading-none font-normal text-ink2 tracking-normal select-none`. 한자 묶음 위에만 얹고 送り仮名·가나·가타카나·숫자 위에는 없다(`rubyPieces()` 가 이미 그렇게 나눈다 — `reading:null` 조각은 그냥 글자). `ruby-align:center` 는 일부러다(기본 space-around 는 `面 白` 처럼 한자 사이를 벌린다).

**D. `[한글]` 마크업**: `<p lang="ko" class="… select-none"><span class="sr-only">한글 발음: </span><span aria-hidden="true" class="text-ink3">[</span>{hangul}<span aria-hidden="true" class="text-ink3">]</span></p>`. 대괄호는 장식(`ink3` 는 장식 전용 — §1-1)이라 읽지 않고, 스크린리더는 "한글 발음: 쿄-와 나니오 따베마시따까"로 읽는다.

**E. 접근성·복사**
- 스크린리더 순서 = 일본어 본문(rt 는 `aria-hidden`) → "한글 발음: …" → 번역. 히라가나를 읽히지 않는 이유: 본문과 겹쳐 두 번 읽힘.
- **복사·저장·음성에 쓰지 않는다**: rt·`[한글]` 줄은 `select-none`(길게 눌러 전체 선택해도 섞이지 않게). 단어장 추가·TTS·"다시 말하기 채우기"(`onPick`)는 지금처럼 `message.content`·원문 문자열을 쓴다(DOM 글자를 읽지 않는다).
- 토글은 `aria-pressed` + 켬일 때 `✓`(aria-hidden) + 굵게 — 색만으로 구분하지 않는다. 설정 스위치는 `role="switch"` `aria-checked`.

**F. 달지 않는 자리(데모 "적용 범위" 표)** — 입력칸 전부(Composer·수업 메모 입력·④ 문장 입력·단어 추가/수정 폼·교정 채택 시트 입력) · 수업 ① 메모 칩·"들린 단어 n개" 칩 · 인식 중 자막(`LiveUtteranceBubble` 3종·`UnsentBar`) · 스트리밍 중 선생님 말풍선(줄간격만 미리 — §15-4-1) · 제목·머리줄(채팅 제목·수업 머리 일본어 제목·목록 미리보기) · 문법 칩(`learning.grammarPoint`) · 한국어 문장 속 「」 인용(설명·총평·문제 한국어 줄의 `J()`) · 관리자 콘솔 · §15-7 의 범위 밖 화면.

**G. "애매하면 숨김"(task 핵심 원칙)** — 분석 칸이 `null`·`available:false`·요청 실패·400자 초과 분할 불가면 히라가나 없이 본문만, `[한글]` 줄은 통째로 없앤다. **대체 표시 금지**: 옛 `message.reading`/`d.reading` 히라가나 줄로 되돌리지 않고, `kanaToHangul(저장된 읽기)` 로 한글을 만들지 않는다(장음이 글자대로 나와 `토우꾜우` 가 된다 — S1 인계).

### 15-2. 데이터 흐름

**A. 공용 파일(화면 A 가 먼저 만든다 — `src/components/common/japanese/`)**

| 파일 | 내보내는 것 | 역할 |
|---|---|---|
| `displayPrefs.ts` | `useDisplayPrefs()` → `{ loaded, showFurigana, showHangul, showTranslation, trEpoch, set(key, on) }` · `DISPLAY_COPY` | 앱 전체 표시 스위치 저장소(§15-3) |
| `annotations.ts` | `useAnnotations(texts)` · `useWordLayers(surface, reading)` · `cutRubyByRanges()` · `segmentsHiragana()` | #24r 묶음 요청·캐시·상태(아래 B~E) |
| `JapaneseText.tsx` | `JaText` · `HangulLine` · `DisplayToggles` · `DisplayBar` | 루비·한글 줄·토글 렌더(아래 F·G) |
| `__tests__/japaneseDisplay.test.ts` | — | 분할·범위 자르기·읽기 대조·이관 순서·캐시 규칙 |

컴포넌트는 `@/modules/speech/reading/client` 만 import 한다(eslint 허용 경로 — `rubyPieces`·`hangulLine`·`alignWordRuby`·`hasKanji`·`READING_MAX_TEXTS/CHARS`·`ReadingSegment` 타입). `speech/reading` 루트·`engine` import 금지(eslint error).

**B. #24r 요청 묶기(`annotations.ts`, 모듈 전역 하나)**
1. 화면의 모든 `useAnnotations(texts)` 가 넘긴 문장을 한 대기열에 모은다 → 같은 tick 끝(`setTimeout(0)`)에 **최대 64개씩** `POST /api/v1/text/annotate {texts}` 한 번(사용자당 60/분 — 채팅방 첫 로드 50개 + 교정·제안이 1~2 요청이 되게).
2. 같은 문장은 한 번만 보낸다(대기 중·요청 중 중복 제거). 결과는 문장 문자열 → `segments|null` 메모리 캐시(LRU 2,000, 앱 세션 동안 — 화면을 옮겨도 다시 요청하지 않음).
3. 응답 `items[i] === null` 이고 `available:true` = 이 문장은 분석 불가 → **null 로 캐시**(다시 묻지 않음). `available:false` 응답의 null 칸·HTTP 실패(429·5xx·네트워크·12초 시간 초과) = **캐시하지 않음**, 그동안은 숨김. 실패 문장은 **같은 화면에서 35초 간격·최대 2회** 다시 묻는다(재시도 기록은 문장 단위로 `AnnotationClient` 가 소유) — 확인 계기는 새 말 도착·앱 복귀(`visibilitychange`)·온라인 복귀(`online`)·표시 OFF→ON 때뿐이고 **타이머 폴링은 없다**(아무 일도 없는 화면은 숨김 그대로). 그 뒤엔 다음 진입(마운트) 때.
4. **보내지 않는 경우**: 히라가나·한글 둘 다 끔(요청 0) · 빈 문자열·공백뿐 · 한자 없는 문장인데 한글 끔(히라가나만 켬 — 루비 할 것이 없다) · 스트리밍 중 문장.
5. **400자 초과**(채팅 말은 1,000자까지): 400자 안의 마지막 `。！？!?\n` 뒤에서 잘라 여러 문장으로 보내고 결과 세그먼트를 순서대로 잇는다. 400자 안에 끊을 곳이 없으면 그 문장은 숨김(중간을 자르면 단어가 잘려 읽기가 틀린다).
6. 로그아웃(401)은 기존 `api.ts` 동작 그대로.

**C. 상태 — `useAnnotations(texts: string[]): AnnotationState[]`(입력 순서)**: `{ s:'off' }`(두 층 다 끔) · `{ s:'loading' }` · `{ s:'ready', segments }` · `{ s:'none' }`. 렌더 규칙: loading = 본문 그대로 + 루비 줄간격 예약 + `[한글]` 자리에 **옅은 막대**(높이 12px·폭 62%·`bg-surface2`, 내 말 말풍선 안은 `bg-surface`, 위 6·아래 4px — 실제 한글 줄 높이와 같아 채워질 때 밀리지 않음, `motion-safe:animate-pulse`, aria-hidden — **내 말풍선만 task-030 에서 자리 = 한글 줄 높이로 보정, §15-10 B**) · ready = `rubyPieces(segments)` 로 루비, `hangulLine(segments)` 가 null 이 아니면 `[한글]` · none = 루비·한글 없음(막대 지움).

**D. 한글 줄은 `hangulLine(segments)` 만(QA O-1)** — `kanaToHangul(pronLine(…))` 처럼 우회하면 조사 を 보정(`ピアノを` → `피아노오`)이 빠진다. 화면 코드에 `kanaToHangul`·`pronLine` 호출 0건이어야 한다(Reviewer grep 대상).

**E. 단어(단어장 행·단어 상세·단어 제안 카드·오늘의 단어 카드) — `useWordLayers(surface, reading)`**
- 루비 = `alignWordRuby(surface, reading)`(저장된 `WordEntry.reading`·제안 `payload.reading`, 서버 없이). null(한자 없음·정렬 실패·상한 초과)이면 루비 없이 표제어만. REV-086 M1 로 다항 시간·상한(표제어 80·읽기 120자) 처리돼 있다.
- 한글 = **표제어를 #24r 로 분석한 `hangulLine`** — 단, 저장된 읽기와 분석기 읽기가 다르면 숨긴다: `segmentsHiragana(segments)`(조각마다 `ruby` 가 있으면 `[표기, 읽기]` 의 읽기(없으면 표기), 없으면 `surface` → 가타카나를 히라가나로) 와 저장 읽기(가타카나→히라가나, 공백 제거)가 **같을 때만** 한글을 보인다. 저장 읽기가 없으면 대조 없이 보인다. 이유: 사용자가 `明日=あす` 로 저장했는데 분석기는 `あした` 일 때 루비 「あす」 아래 한글 「아시따」가 나오면 서로 어긋난 발음이다(★ Leader 확인 ①).
- 단어장 목록은 화면에 그려진 행의 표제어를 한 번에(페이지 50개 = 1요청), [단어 더 보기] 때 새 행만.

**F. `JaText` — 루비 렌더 + 범위 겹치기**
```tsx
<JaText text={string} state={AnnotationState} className={JA_BODY}            // 루비 줄간격은 내부에서 붙인다
        ranges?={[{ start, end, className, as?: 'span'|'mark' }]} />       // 문장 강조·교정 diff·비교 밑줄
```
- `ranges` 는 지금 컴포넌트가 따로 그리던 것을 그대로 받는다: 회화 다시 듣기 문장 강조(`TalkTutorBubble` spans → `bg-accent-soft`), 교정 diff(`CorrectionCard` `Segments` 제거·추가), ④ 비교 밑줄(`compare.ts` 점선·실선 `mark`). 오프셋은 **코드포인트 기준**(diff·compare 가 이미 코드포인트).
- `cutRubyByRanges(pieces, ranges)`: 루비 조각을 범위 경계에서 자른다. **경계가 한자 묶음 한가운데를 자르면 그 묶음만 히라가나를 뺀다**(글자는 그대로 · 범위 표시 유지) — 반쪽 읽기를 보이지 않기 위해. 밑줄 `mark` 는 글자 아래, 루비는 위라 둘 다 보인다(MOV ⑦).
- `lang="ja"` 는 바깥 요소에 한 번.

**G. `HangulLine` · `DisplayToggles` · `DisplayBar`**
- `HangulLine({ state, size: 13|12.5|12|14|15, inline?, tone?: 'onAccent' })` — §15-1 D 마크업 + loading 막대. `inline` = 칩 안 같은 흐름(`<span>` 12px).
- `DisplayToggles({ keys: ('fu'|'hg'|'tr')[], onToast })` — 32px 알약(지금 수업 `parts.Toggle` 과 같은 모양: 켬 `bg-ink text-surface border-ink` + `✓` + semibold, 끔 `bg-surface border-line`), 세로 히트 46px(`before:-inset-y-[7px]` — task-030 §15-10 A, 표시 바 안에서는 44 로 잘림), `flex-none` + 줄바꿈 없음. `loaded` 전에는 `aria-disabled` + 흐리게(누르면 무시).
- `DisplayBar({ onToast })` — 회화·채팅 머리 바로 아래 `h-11 flex-none items-center gap-1.5 px-3 bg-surface shadow-[inset_0_-1px_0_var(--color-line)] overflow-x-auto`(아래 선은 `border-b` 가 아니라 안쪽 1px 선 — task-030 §15-10 A)(스크롤바 숨김, 360 에서도 한 줄이라 실제로는 스크롤되지 않음), 맨 앞 "표시" 12px `text-ink2`(aria-hidden), `role="group" aria-label="이 방 전체 표시"` + `DisplayToggles(['fu','hg','tr'])`. 화면당 스크롤 1곳 규칙 — 바는 고정 머리의 일부(목록 스크롤 밖).

**H. 내 말 번역(E5·E6, T1)**

| 상태 | 언제 | 번역 칸(번역이 펼쳐져 있을 때만 보임) |
|---|---|---|
| `ok` | `message.translation` 있음 | 번역 글 15px |
| `pending` | 이번 세션에 보낸 말이고 턴이 아직 안 끝남(임시 말풍선·`accepted` 뒤 `done` 전) | 막대 72px + "번역 중…"(13px `text-ink2`) |
| `failed` | `done.userTranslation === null` 을 이번 세션에 받음 · #32t 가 다시 시도 가능한 오류 | "번역을 가져오지 못했어요" + [다시 가져오기] |
| `none` | 서버에서 읽어 온 말인데 `translation` 이 null(옛 말·턴 실패한 말) | [번역 가져오기] 하나(★ 데모와 다른 점 ⓐ) |
| `retrying` | [다시 가져오기]/[번역 가져오기] 누른 뒤 | 막대 + "번역 중…" |
| `blocked` | #32t 409·429·400·404 | 아래 표 문구 |

- 데이터: 새 턴 = SSE `done.userTranslation`(`useChatTurn.onDone` 이 `dn.userMessageId` 말풍선에 `translation` 을 넣는다), 새로고침·지난 말 = #29 USER `translation`. 화면 전용 칸 `ChatMessageView.translationState?: 'pending'|'failed'`(서버 값 아님 — #29 로 다시 읽으면 사라진다).
- [다시 가져오기]·[번역 가져오기] → `POST /api/v1/chats/:id/messages/:messageId/translation`(본문 없음, id 는 `encodeURIComponent`) — **사용자가 누를 때만**(자동 호출 금지 — 분당 20회 상한·LLM 비용). 버튼 44px 히트(보이는 글자 13px 밑줄, 데모 `.trf .fb`). 누른 뒤 응답 전 다시 누르면 무시.

| #32t 응답 | 화면 |
|---|---|
| `200 {translation, cached}` | `ok` — 번역 표시(같은 말풍선 `translation` 갱신) |
| `409 {reason:"TURN_RUNNING"}` | "선생님 답이 끝나면 다시 눌러 주세요" + 버튼 유지 |
| `409 {reason:"TRANSLATION_BUSY"}` | "다른 번역을 가져오는 중이에요. 잠시 뒤 다시 눌러 주세요" + 버튼 유지 |
| `429` | "잠시 뒤 다시 눌러 주세요" + 버튼 유지 |
| `502`(`TRANSLATION_REJECTED` 포함)·`504`·`422`·네트워크 | `failed` — "번역을 가져오지 못했어요" + [다시 가져오기] |
| `400`·`404` | "이 말은 번역할 수 없어요" — 버튼 없음 |

- 오류 문구는 **번역 칸 안에서만**(토스트·빨간색 없음 — 데모 `#talk-fail`). 대화·히라가나·한글·선생님 답은 막지 않는다.
- 선생님 말 번역은 지금처럼 `message.translation`(ASSISTANT) — 없으면 [번역 ▾] 를 숨긴다(지금 동작).

### 15-3. 설정 — 표시 스위치 3개(앱 전체 하나)

**A. 서버 값**: Profile `showFurigana`(기본 true) · `showHangul`(true) · `showTranslation`(false) — 읽기 `GET /api/v1/settings/profile`, 쓰기 **`PUT /api/v1/settings/profile`**(PATCH 아님 — 405), **바꾼 키 하나만** 보낸다(`{ "showHangul": false }`), 불리언만(그 밖 400). api-contract #11~#12. 학습 설정 폼(`LearningSettings` [학습 설정 저장])의 보내는 키 목록에는 넣지 않는다(지금 그대로 — 두 저장이 서로 덮지 않게).

**B. 저장소(`displayPrefs.ts`)** — React 컨텍스트 대신 모듈 전역 저장소 + `useSyncExternalStore`(레이아웃 파일을 건드리지 않고 회화·채팅·수업·단어장·설정이 같은 값을 본다).
- 첫 구독 때 GET 1회(앱 세션 동안 유지 — 화면을 옮겨도 다시 읽지 않음, 설정 화면은 마운트 때 한 번 더 읽어 다른 기기 변경을 반영). 로드 전 `loaded:false` → 층을 그리지 않고 토글은 흐림(값이 오면 한 번에 켜짐 — 끈 사용자에게 잠깐 보였다 사라지는 깜박임 방지). GET 실패 → 기본값(E2-A)으로 `loaded:true`(층이 학습 기능의 일부라 막지 않음), 설정 화면만 오류 블록.
- `set(key, on)`: **바로 화면에 반영(낙관)** → PUT. 요청은 한 줄로(연타 시 마지막 값만 보냄). 실패하면 이전 값으로 되돌리고 저장소가 `failEpoch` 를 1 올린다(사용자가 누른 PUT 이 되돌려졌을 때만 — 더 새 값이 이어받은 경우·이관 PUT 실패는 올리지 않음). **실패 토스트 "표시 설정을 저장하지 못했어요. 다시 눌러 주세요"는 앱 셸 한 곳(`components/shell/DisplaySaveNotice.tsx`, `(app)/layout.tsx`)이 띄운다** — 화면을 떠난 뒤 늦게 실패해도 보인다. 호스트 화면(설정·표시 바·도구 줄)은 실패 토스트를 띄우지 않는다(이중 방지). 성공 토스트는 §15-5(누른 곳에서, 탭 즉시). 실패 때 호스트가 방금(2.2초 안) 띄운 성공 토스트는 `useClearSuccessOnSaveFail` 이 `onToast('', 0)`(빈 문구 = 숨김)로 지운다 — 테스트로 잠근다(task-030 REV-097 L-1). **예외: 회화방은 셸 대신 방이 실패 알림을 띄운다(§15-10 C).**
- 같은 저장소라 **표시 바·수업 도구 줄·단어장 도구 줄·설정 스위치가 즉시 함께 바뀐다**(새로고침 불필요).

**C. 옛 값 1회 이관(첫 GET 성공 직후, 한 번)**: `readStore('local', 'kaiwa.chat.readingDefault')` 가 `'off'` 이고 서버 `showFurigana === true` 면 `PUT { "showFurigana": false }` → 성공하면 키 삭제(실패면 키를 남겨 다음 로드에 다시). 값이 `'on'` 이거나 서버가 이미 false 면 PUT 없이 키 삭제. `chat/storageKeys.ts` 의 키 이름은 이관용으로만 남기고, 이 키를 읽던 `ChatRoom`·`TalkRoom`·`LessonScreen` 코드는 지운다. `kaiwa.vocab.readingDefault`(오늘의 단어 카드 [읽기])는 **다른 값이라 그대로**.

**D. 말풍선별 [번역 ▾](E4-B)**: 저장소가 `trEpoch`(번역 스위치를 바꿀 때마다 +1)를 준다. 말풍선 상태 = `{ epoch, open }` — `epoch !== trEpoch` 면 무시하고 `showTranslation` 을 따른다. 그래서 바에서 번역을 바꾸면 개별로 열고 닫은 것이 전부 초기화된다. 히라가나·한글은 말풍선별 조작이 없다.

### 15-4. 화면별 변경 (컴포넌트 파일 · 바꿀 곳)

#### 15-4-1. 회화방 — `#talk` · `#talk-pend` · `#talk-fail` (화면 A)

| 파일 | 바꿀 곳 |
|---|---|
| `talk/TalkRoom.tsx` | `readingDefault` 상태·`readStore/writeStore(KEYS.readingDefault)`(168·1060행 부근) 삭제 · `TalkRoomHeader` 바로 아래(첫 줄 `room` 안, 목록 스크롤 밖)에 `<DisplayBar onToast={toast.show} />` · `MessageList`·`TalkTutorBubble`·`ChatMenuSheet` 에 넘기던 `readingDefault`/`onReadingDefault` 삭제 · 대화 속 `UserBubble`(747행 부근)은 §15-2 H 번역 칸을 쓰도록 `chatId` 그대로 넘김 |
| `talk/TalkTutorBubble.tsx` | `streaming`: 본문은 지금처럼 문장 `<span>` 이어 붙이기(루비 없음), 단 `showFurigana && hasKanji(content)` 면 줄간격 2.1 미리 · `done`: `spans` 를 `JaText ranges`(재생 중 문장 = `rounded-sm bg-accent-soft text-ink`)로 넘김 — 강조·▶ 다시 듣기·"말하는 중" 그대로 |
| `talk/TalkCorrectionCard.tsx` | 코치 힌트 상태의 "내 문장" 칸(107행)에 `JaText`+`HangulLine`(정답을 보기 전 칸이라 교정문은 없음) |
| (공용) `chat/MessageBubble.tsx`·`chat/CorrectionCard.tsx` | 15-4-2 와 같다 — 회화방도 이 둘을 쓴다 |

- 상태별: `#talk` 선생님 말 = 히라가나 → 일본어 → `[한글]` → (번역) · 아래 줄 [▶ 다시 듣기][번역 ▾][문법 칩][시각] — **[읽기 ▾] 삭제**. 내 말 = 같은 층 · 아래 줄 [▶ 내 목소리][번역 ▾][시각]. 대화 속 교정 카드(유창성 큰 실수) 두 칸에 히라가나·`[한글]`.
- `#talk-pend`: 방금 보낸 내 말 = 본문 그대로 + 루비 줄간격 예약 + `[한글]` 자리 막대 + (번역 켬이면) "번역 중…" · sr-only "발음과 번역을 준비하고 있어요." 한 번 · 그 아래 선생님 준비 말풍선·상태 줄 "선생님이 생각하고 있어요"·마이크 흐림은 지금 그대로. 내 말 분석은 **보낸 직후 바로** 요청한다(턴과 독립 — 1ms 대 분석이라 대개 선생님 답보다 먼저 채워짐).
- `#talk-fail`: 선생님 답(t4)까지 온 뒤 내 말 번역 칸만 `failed`. 대화는 그대로 이어진다.
- 인식 중 자막(`LiveUtteranceBubble`)·보내지 못한 말(`UnsentBar`)·`TalkIntro`·머리(표시등·"모아 둔 교정 N"·⋯)는 그대로. "모아 둔 교정" 시트(`LaterCorrectionsSheet`)는 `CorrectionCard` 를 쓰므로 자동으로 층이 붙는다(파일 수정 없음).

#### 15-4-2. 채팅방 — `#chat` (화면 A)

| 파일 | 바꿀 곳 |
|---|---|
| `chat/ChatRoom.tsx` | `readingDefault` 상태·이관 전 localStorage 읽기/쓰기(52·236행) 삭제 · `ChatRoomHeader` 바로 아래 `<DisplayBar onToast={toast.show} />`, **그 아래** `ReviewDoneBar`(점검을 마친 채팅 띠 — MOV ③) · `MessageList`·`ChatMenuSheet` props 정리 |
| `chat/MessageList.tsx` | `readingDefault` prop 삭제(207행 `TutorBubble`) · 화면에 그린 말(선생님·내 말)의 본문을 모아 `useAnnotations` 한 번(말풍선마다 따로 부르지 말고 목록이 모아서 넘긴다 — 요청 묶기·스크롤 계산을 한 곳에) · [이전 메시지] 로 앞에 붙인 말은 다음 묶음 |
| `chat/MessageBubble.tsx` | `TutorBubble`: `readingOpen`·`showReading`·[읽기 ▾] 삭제, 본문 `JaText` + `HangulLine` + 번역(전역 + 말풍선별, §15-3 D). `UserBubble`: 같은 층 + 아래 줄에 [번역 ▾](말풍선 상태) 추가 + 번역 칸(§15-2 H). `JA_BODY` 그대로. `PendingBubble`·`FailedBubble` 그대로 |
| `chat/useChatTurn.ts` · `types/chat.ts` | `TurnDoneEvent.userTranslation?: string \| null` 추가 · 보낼 때 임시 내 말 `translationState:'pending'` · `onDone` 에서 `dn.userMessageId` 말풍선에 `translation = dn.userTranslation ?? null`, null 이면 `translationState:'failed'` · 턴 `error`/실패면 `translationState` 를 지움(→ `none`) · `ChatMessageView.translationState?` 추가 |
| `chat/ProposalCard.tsx` | ADD_WORD(118~130행): 표제어 옆 읽기 `<span>` 삭제 → 표제어 위 히라가나(`useWordLayers`) + 아래 `[한글]` 13. 뜻·버튼·"✎ 뜻 고쳐서 추가"·처리된 줄(`✓ 단어장에 추가했어요 · 表記`)은 그대로(처리된 줄은 머리줄 취급 — 달지 않음) |
| `chat/ChatMenuSheet.tsx` | **F1-A**: "읽기 항상 펼치기" `role="switch"` 줄(116~123행)과 `readingDefault`·`onReadingDefault` props 삭제. [제목 바꾸기]·`extra`(회화: 들려주는 방식·교정 방식)·삭제는 그대로 |

- `あしたはやすみです。` 처럼 한자 없는 말 = 위 히라가나 없음 · `[한글]` 만. 입력창은 달지 않는다.
- 스크롤: 첫 로드 바닥 붙이기는 지금 로직 그대로 — 루비 줄간격 예약 + 같은 높이 막대 덕에 분석 결과가 와도 높이가 거의 그대로라 바닥이 유지된다(QA 확인 ⑧).

#### 15-4-3. 표현 점검 — `#review` (화면 A)

- `chat/CorrectionCard.tsx`: 두 칸(컨테이너 320px 이상 나란히, 360 폭 화면은 위아래 — 지금 `@min-[320px]:grid-cols-2` 그대로) 각각 `JaText`(diff `Segments` 를 `ranges` 로 — 지운 글자·넣은 글자 위에도 히라가나) + `HangulLine`(문장 전체 소리 — diff 표시 없음). 칸 폭은 늘리지 않는다.
- `ChatReview.tsx` 는 수정 없음 — 총평·잘한 점·집중할 점·"공부 기록 남기기" 카드·[남은 교정 n | 전체 n]·[대화로 돌아가기] 그대로, 설명 속 「」 인용은 달지 않는다. 점검 화면에는 표시 바가 없다(값은 앱 설정 그대로 따름).
- 점검 카드 전부(최대 수십 개)를 화면 마운트 때 한 묶음으로(`CorrectionCard` 가 각자 부르면 tick 묶기로 자동 합쳐진다 — §15-2 B 1).

#### 15-4-4. 단어장 목록 — `#words` (화면 B)

| 파일 | 바꿀 곳 |
|---|---|
| `vocab/WordsScreen.tsx` | "단어 50개" 줄(280행 `<p aria-live>`)을 `flex items-center justify-between gap-2` 줄로: 왼쪽 개수 글(`min-w-0 flex-1`, **`aria-live` 는 이 글에만**, 검색어·조건이 길면 줄바꿈) · 오른쪽 `DisplayToggles(['fu','hg'])`(`flex-none`, 줄 높이 18 → 32px) — **MOV ①**(정렬 세그먼트+보관함 줄은 이미 가득) · 그린 행 표제어 묶음 요청(한글 켬일 때만) |
| `vocab/WordRow.tsx` | 표제어 옆 읽기 `<span>`(23~28행) 삭제 → 빈 칸(`flex-1`) 유지 · 표제어에 루비(줄간격 1.95) · 둘째 줄로 `[한글]` 12.5 · 셋째 줄 뜻·맞힘/틀림(지금 둘째 줄). 조각 뱃지 자리 그대로. `truncate` 는 유지하되 **줄간격 1.95 로 rt 가 잘리지 않게**(QA ⑤) |

- 행 높이(데모 실측): 둘 다 켬 약 102 · 히라가나만 80 · 한글만 92 · 둘 다 끔 71px(지금 64 → 최소 높이 64 는 유지). 검색·분류 칩·조각 줄·정렬·보관함·[＋ 추가]·[단어 더 보기]·빈 상태(`WordsEmpty`)는 그대로.
- `すみません`·`コーヒー` 같은 한자 없는 단어 = 히라가나 없음 · `[한글]` 만.

#### 15-4-5. 단어 상세 시트 — `#wsheet` (화면 B)

- `vocab/WordDetailSheet.tsx`: 표제어 28(273행)에 루비(rt 13·줄간격 1.8) → 읽기 15px 줄(277행) **삭제** → `[한글]` 14 → 뜻 17. 오른쪽 ▶ 소리 버튼(44) 자리 그대로.
- 예문 카드(301행): 예문 16 에 루비(줄간격 2.15) + `[한글]` 13 + 번역(지금처럼 늘 보임) · ▶ 그대로. 예문은 저장 읽기가 없으니 #24r(`useAnnotations`).
- 뱃지 줄·기록 4칸·출처·[수정][보관하기]·삭제·삭제 확인 문구(252행 ‘表記’ 인용은 달지 않음)·수정 폼(입력칸)은 그대로. 시트에는 토글이 없다(앱 설정을 따름).

#### 15-4-6. 오늘의 단어 카드 — `#deck` (화면 B, 예외 규칙)

- 외우기 카드라 **카드 [あ 읽기](`DeckToolbar`, `kaiwa.vocab.readingDefault` 그대로)를 켰을 때만** 표제어 위 히라가나(rt **16**·줄간격 1.7) + (앱 설정 한글 켬일 때) `[한글]` **15**(위 4px). 앱 설정 `showFurigana` 는 카드에 영향이 없다. [읽기] 끔 = 표제어만(지금과 같음).
- `vocab/VocabCardFace.tsx` 앞면(56~64행): 읽기 17px 줄 삭제 → 루비·한글로. `memo` 를 지키기 위해 **루비·한글 값은 `vocab/VocabDeck.tsx`(153행에서 카드 면을 그림)가 덱의 카드 표제어 전부를 처음 한 번에 `useWordLayers` 로 받아 props(`ruby`, `hangul` — 문자열·배열이라 얕은 비교로 memo 유지)로 넘긴다** — 카드 면 안에서 훅을 부르지 않는다(드래그 중 다시 그리지 않음). `line-clamp-3` 과 루비가 겹쳐 첫 줄 rt 가 잘리지 않는지 확인(QA ⑤).
- 뒷면(FLIP·답한 뒤, 80~98행)은 **이번 범위 밖 — 그대로**(데모에 없음). → **task-033 에서 적용: §15-11-3**.
- 진행·보기·도구 칸 4개·제스처 안내·12초 리듬은 그대로. 분석이 늦어도 카드 넘김을 막지 않는다(막대 → 채워짐).

#### 15-4-7. 오늘의 회화 ①~⑤ — `#l1`~`#l5` (화면 B)

| 파일 | 바꿀 곳 |
|---|---|
| `lesson/LessonScreen.tsx` | `reading` 상태·`CHAT_KEYS.readingDefault` 읽기/쓰기(164·270행)·`onReading` 삭제 · 단계 컴포넌트에 넘기던 `reading` props 삭제(각 단계가 `useDisplayPrefs` 를 직접 읽는다) |
| `lesson/StageUnderstand.tsx` (`#l1`) | 도구 줄(99~104행) `Toggle 읽기`·`Toggle 번역`(화면 상태 `trans`) → `DisplayToggles(['fu','hg','tr'])` + 역할 범례 그대로(같은 `role="group" aria-label="보기 설정"` 줄) · 대화 줄(201~209행): 일본어에 루비 · 읽기 줄 삭제 · `[한글]` 13 · 번역 13(`showTranslation`) · 줄 ▶ 그대로 · **글자 가림 중(124·184행 `hidden`)에는 지금처럼 막대만** — 히라가나·한글도 그리지 않는다 · 메모 칩·메모 입력·"들린 단어" 카드는 달지 않음 |
| `lesson/StageGrammar.tsx` (`#l2`) | 도구 줄 신설 `DisplayToggles(['fu','hg'])`(설명 문단 아래 — **MOV ④**: 예문 번역이 늘 보여 [번역] 없음) · 예문 읽기 줄(87행) 삭제 → 루비 + `[한글]` · 문형(〜をください) `[한글]`(한자 있으면 루비도) |
| `lesson/parts.tsx` | `ExprPlayChip`: 칩 일본어 16 에 루비(줄간격 2.1) + `HangulLine inline size=12` · ▶ 듣기·"새 표현"·뜻 그대로 · 수업 `Toggle` 은 이 절 이후 쓰는 곳이 없으면 지워도 된다(다른 사용처 grep 후) |
| `lesson/StageQuiz.tsx` (`#l3`·`#l3b`) | 도구 줄 신설 `DisplayToggles(['fu','hg'])` — **MOV ⑤**(보기에 번역 없음) · 문제 카드의 **따로 있는 일본어 문장 줄**(`promptJa`)에 루비 + `[한글]` 13 — **MOV ⑥** · 보기 일본어 17 에 루비 + `[한글]` 12.5(보기 높이 52 → 약 80px) · 한국어 문제 줄은 달지 않음 · **★ 읽기 문제 보호**(§15-9 ②) |
| `lesson/StageApply.tsx` (`#l4`) | 써 볼 표현 칩 = 히라가나·`[한글]` 12 · 내 문장·모범 답안: 비교 밑줄을 `JaText ranges` 로(점선·실선 `mark` 그대로) + 루비 위 + `[한글]` 13 — **MOV ⑦** · 모범 답안 읽기 줄(225행) 삭제 · 뜻·[▶ 모범 답안 듣기]·범례·안내 그대로 · 입력칸 달지 않음 |
| `lesson/StageSpeak.tsx` (`#l5`) | 목표 표현 칩 = 히라가나·`[한글]` 12("✓ 썼어요" 그대로) · "내가 한 말" 말풍선 안에 루비 + `[한글]`(말풍선 안, 위 여백 0 — **MOV ⑨**) · 모범 답안 읽기 줄(306행) 삭제 → 루비·`[한글]` · 녹음 중 자막은 달지 않음 |
| (`lesson/lessonCopy.ts`) | 수정하지 않는다 — `U1.reading`·`U1.translation`(옛 알약 이름)은 쓰는 곳만 없어진다(정리는 후속). 새 이름은 `DISPLAY_COPY` |

- 한 단계에 나오는 일본어(대화 10줄·칩 8개·예문·문제 5개 보기 등)는 단계 화면 마운트 때 한 묶음(64개 이하 — 넘으면 자동으로 2요청).
- 수업 머리 일본어 제목(`LessonHeader`)·단계 칸·복습 레슨 카드(`review/*`)·종료 카드는 달지 않는다(§15-7).

#### 15-4-8. 설정 › 일본어 표시 — `#settings` (화면 B)

- `app/(app)/settings/page.tsx`: `<LearningSettings />` 와 `<VoiceSettings …/>` 사이에 `<DisplaySettings />`(새 클라이언트 컴포넌트 `components/settings/DisplaySettings.tsx`).
- 모양: `Section` + `SectionHeader` "일본어 표시" → 카드 하나: 스위치 줄 3개(행 전체 `role="switch"` 버튼, 최소 56px, 제목 15 semibold + 설명 13 `text-ink2`, 오른쪽 48×28 스위치 — `ChatMenuSheet` 에 있던 스위치 모양 재사용, 줄 사이 `border-t border-line`) → 안내 2줄 12.5 `text-ink2 break-keep` → 미리 보기 상자(`rounded-xl bg-surface2 px-3 py-2.5`, 캡션 "미리 보기" + 예문 `今日は何を食べましたか？` 를 `JaText`·`HangulLine`·(번역 켬) "오늘은 뭘 먹었어요?" 13 — 실제 #24r 결과로 그림, 둘 다 끄면 캡션 "히라가나와 한글을 모두 숨겼어요").
- 누르면 **바로 저장**(학습 설정 [저장]과 별개) — `useDisplayPrefs().set`, 성공 토스트(이 화면, 탭 즉시)·실패 되돌림(실패 토스트는 앱 셸)은 §15-3 B. 로딩 = 스위치 3개 자리 `LoadingBlock`, 저장소 GET 실패 = `ErrorBlock`([다시 시도] → 다시 GET).
- 다른 절(출석·로그인 계정·기본정보 · 학습·AI 선생님 목소리·음성 인식·앱 버전)은 그대로.

#### 15-4-9. 데모 v4 "제안 배치가 달라진 곳"(MOV 9건) → 구현 위치

| # | 무엇 | 구현 |
|---|---|---|
| ① | 단어장 [히라가나][한글] | `WordsScreen` "단어 N개" 줄 오른쪽(§15-4-4) |
| ② | 단어 제안 카드 | 채팅·회화방 선생님 말풍선 아래(지금 위치) `ProposalCard` — 표제어 위 히라가나·아래 `[한글]`·옆 읽기 없앰 |
| ③ | 채팅방 표시 바 | 머리 바로 아래, `ReviewDoneBar` 는 그 아래 |
| ④ | ② 문법 도구 줄 | [히라가나][한글]만 |
| ⑤ | ③ 문제 도구 줄 | [히라가나][한글]만 |
| ⑥ | ③ 문제 문장 | 따로 있는 `promptJa` 줄에 히라가나·`[한글]` |
| ⑦ | ④ 응용 비교 | 밑줄(아래)과 히라가나(위) 둘 다 — `JaText ranges` |
| ⑧ | 문법 칩 | 달지 않음 |
| ⑨ | ⋯ 메뉴 "읽기 항상 펼치기" | F1-A — 삭제 |

### 15-5. 한국어 문구 (단일 출처 `components/common/japanese/displayPrefs.ts` `DISPLAY_COPY` — ★ = 데모에 없던 문구)

| 키 | 문구 |
|---|---|
| 토글 이름 | 히라가나 · 한글 · 번역 (켬이면 앞에 `✓`, aria-hidden) |
| 표시 바 | 머리 글자 "표시"(aria-hidden) · 그룹 이름 "이 방 전체 표시" · 수업·단어장 도구 줄 그룹 이름 "보기 설정" |
| 토스트(누른 곳에서, 2.2초) | "히라가나를 보여 줘요 · 모든 화면에 적용돼요" / "히라가나를 숨겼어요 · 모든 화면에 적용돼요" / "한글 발음을 보여 줘요 · 모든 화면에 적용돼요" / "한글 발음을 숨겼어요 · 모든 화면에 적용돼요" / "번역을 모두 펼쳤어요 · 모든 화면에 적용돼요" / "번역을 모두 접었어요 · 모든 화면에 적용돼요" |
| ★ 저장 실패 토스트(앱 셸 `DisplaySaveNotice` 한 곳 — 어느 화면에서든 같은 문구, 호스트 화면은 띄우지 않음) | "표시 설정을 저장하지 못했어요. 다시 눌러 주세요" |
| 설정 절 | 제목 "일본어 표시" · "히라가나 보기" / "한자 위에 작게 읽는 법을 적어요." · "한글 발음 보기" / "일본어 아래에 한글로 소리를 적어요." · "번역 펼쳐 두기" / "선생님 말과 내 말의 뜻을 처음부터 펼쳐요." · 안내 "회화방·채팅방 위 표시 바, 오늘의 회화·단어장 도구 줄에서도 바꿀 수 있어요. 어디서 바꾸든 같은 값이에요." · "한글은 소리를 짐작하는 도움말이에요. 정확한 소리는 선생님 목소리로 들어 보세요." · "미리 보기" · "히라가나와 한글을 모두 숨겼어요" |
| 말풍선 | "번역 ▾" / "번역 ▴"(`aria-expanded`) — "읽기 ▾" 문구는 삭제 |
| 내 말 번역 | "번역 중…" · "번역을 가져오지 못했어요" · [다시 가져오기] · ★[번역 가져오기] · ★"선생님 답이 끝나면 다시 눌러 주세요" · ★"다른 번역을 가져오는 중이에요. 잠시 뒤 다시 눌러 주세요" · ★"잠시 뒤 다시 눌러 주세요" · ★"이 말은 번역할 수 없어요" |
| 스크린리더 | "한글 발음: " (한글 줄 머리) · "발음과 번역을 준비하고 있어요."(보낸 직후 내 말, 한 번) |
| 오늘의 단어 | [あ 읽기] 그대로 |

### 15-6. 360 / 390 / 412 · 높이 780 / 892 · 접근성 QA 체크리스트

데모 v4 와 나란히 대조한다(데모 상단 "폭"·"보기 › 현재 vs 제안"·"표시" 토글). 1·3·20·21·22 는 task-030 데모 v1(`#toggle`·`#bubble`·`#toast`)과도 대조한다. 모든 항목을 히라가나·한글 켬/끔 4조합 중 최소 (켬·켬)·(끔·끔) + 번역 켬에서.

1. **표시 바**(`#talk`·`#chat`): 360 에서 [✓히라가나][✓한글][번역] 한 줄·가로 스크롤 0, 높이 44, 머리 56 바로 아래, 목록만 스크롤(화면당 스크롤 1곳). 390×780 회화방 대화 영역 ≈563px(데모 실측). **토글 유효 터치 높이 ≥44px**(360/390/412, task-030 이전 41) — 바 아래 선은 같은 색·같은 자리로 보이고 알약 32px 그대로(겉모양 변화 0). 단어장·수업 도구 줄 토글 유효 터치 46px.
2. **층 순서·크기**: 히라가나 11(단어 상세 13·카드 16) `ink2` 한자 위에만(送り仮名 위 없음 — `面白い`·`持ち帰る`) · `[한글]` 대괄호·크기 §15-1 B · 번역 구분선 아래.
3. **줄간격 예약**: 분석 응답을 늦춘 상태(네트워크 느리게)에서 루비·한글이 채워질 때 말풍선 높이 변화 ≤4px · 채팅 첫 로드 바닥 유지. **내 말풍선은 번역 켬·끔 둘 다 ≤4px**(task-030 이전 번역 켬 +5.5 · 데모 v1 제안 +2 — 남는 몫은 루비 본문 1~2px, 기기 글꼴에 따라 다름) · 막대 모양(12px·폭 62%·`bg-surface`·깜박임) 그대로 · 선생님 말풍선·교정·제안 카드 높이 변화는 지금 값 그대로(회귀 없음).
4. **애매하면 숨김**: 분석기 다운(gateway 정지 또는 #24r `available:false`) → 히라가나·한글 자리 없음, 옛 히라가나 줄이 **나오지 않음**, 오류 토스트 없음 · 400자 넘는 말(끊을 곳 없음) 숨김 · `静か`·`3時`·`2026年10月4日` 등 S1 표본이 서버 결과대로.
5. **잘림**: 단어장 행 `truncate` 표제어·카드 `line-clamp-3`·칩·문제 보기에서 rt 윗부분 잘림 0(360/412), 긴 표제어 말줄임 정상, 보기 높이 ≈80px.
6. **교정 카드**: 컨테이너 320↑ 두 칸·360 화면 위아래, diff 지운/넣은 글자 위 루비, 한자 묶음 가운데가 diff 경계면 그 묶음만 히라가나 없음.
7. **단어**: 행 높이(둘 다 켬 ≈102·히라가나만 80·한글만 92·둘 다 끔 71) · 저장 읽기 ≠ 분석 읽기(`明日=あす`)면 한글 숨김 · 악성 단어(한자·가나 교차 80자)로 화면 멈춤 없음(REV-086 M1).
8. **스위치 동기화**: 표시 바에서 끄면 → 수업·단어장 도구 줄·설정 스위치가 같은 값 · 다른 기기에서 바꾼 값은 설정 화면 진입 때 반영 · PUT 실패(오프라인)면 되돌림 + 셸 토스트 1개(호스트 토스트와 이중 없음) · 연타 시 마지막 값 저장.
9. **이관**: `localStorage kaiwa.chat.readingDefault='off'` + 서버 기본 → 첫 로드 뒤 서버 `showFurigana:false`·키 삭제 · `'on'` → PUT 없이 키 삭제 · `kaiwa.vocab.readingDefault` 는 남음.
10. **E4-B**: 말풍선 [번역 ▾] 로 연 뒤 바에서 번역 켬→끔 → 모든 말풍선 닫힘(개별 상태 초기화).
11. **내 말 번역**: 새 턴 `done.userTranslation` 즉시 표시 · null → "번역을 가져오지 못했어요"+[다시 가져오기] → 성공 · 옛 말 [번역 가져오기] · 턴 진행 중 누르기 → 409 문구 · 21번째(분당) → 429 문구 · 자동 호출 0건(네트워크 탭에서 #32t 는 누를 때만).
12. **F1-A**: 회화·채팅 ⋯ 메뉴에 "읽기 항상 펼치기" 없음.
13. **오늘의 단어**: [읽기] 끔이면 앱 설정과 무관하게 히라가나·한글 없음 · 켬 + 한글 끔이면 히라가나만 · 드래그 중 프레임 저하 없음.
14. **수업**: ① 가림 중 층 없음 · ① [번역] = 회화방 번역과 같은 값 · ③ 읽기 문제 보호(§15-9 ②).
15. **접근성**: TalkBack/스크린리더가 rt 를 읽지 않고 "한글 발음: …"을 읽음 · 토글 `aria-pressed`·설정 `role=switch aria-checked` · 포커스 링 · 터치 44px(토글·[다시 가져오기]) · 명암비(`ink2` on `surface`·`accent-soft`·`surface2`) ≥4.5 · 다크 테마 · `prefers-reduced-motion` 막대 깜박임 없음.
16. **복사**: 말풍선 길게 눌러 전체 선택 → 복사 결과에 히라가나·한글 없음.
17. **엔진명**: 화면·응답·콘솔 로그에 분석기 이름 0건 · 화면 글자 '후리가나' 0건.
18. **요청량**: 채팅방(50말) 첫 진입 #24r ≤2회 · 화면 이동 후 돌아와도 캐시 적중(재요청 0) · 두 층 끔이면 #24r 0회.
19. **분석 장애 복구(같은 화면)**: 분석기를 막은 상태(gateway 정지 또는 429 유도)로 회화·채팅방 입장 → 기존 말풍선 히라가나·한글 없음 → 분석기 복구 후 새 말 도착·앱 백그라운드 복귀·온라인 복귀·한글(또는 히라가나) OFF→ON 중 하나 → **35초가 지난 뒤** 기존 말풍선 읽기가 돌아옴 · 35초 안에는 다시 묻지 않음 · 같은 문장 재시도 최대 2회(최초 포함 3회)에서 멈춤 · 아무 조작 없는 방에서는 요청 0(타이머 폴링 없음) · 장애 중 요청 폭주 0.
20. **느린 저장 실패 + 화면 이동**: 표시 스위치 PUT 을 지연(최대 10초)·500 으로 만든 뒤 누르고 곧바로 다른 탭·화면으로 이동 → 실패 시 값 되돌림 + **앱 셸 토스트 정확히 1개**("표시 설정을 저장하지 못했어요. 다시 눌러 주세요") · 같은 화면에 머문 실패도 1개(이중 없음) · 성공 때는 누른 곳 성공 토스트만 · 실패 때 방금 뜬 성공 토스트는 지워짐(두 토스트 겹침 0).
21. **회화방 저장 실패 알림(task-030 §15-10 C, 데모 v1 `#toast`)**: 회화방 음성 모드에서 표시 바 스위치 PUT 실패 → 알림이 **아래에서 136px**(방 토스트와 같은 자리)·음성 입력 바(116)와 겹침 0·상태 줄 보임 · **녹음 중 실패** → 스위치는 즉시 되돌아가고 알림은 화면·스크린리더 모두 미룸 → 손을 뗀 순간 **1회** 표시(녹음 중 실패가 여러 번이어도 1회) · 회화방 글자 입력 모드 = 84 · 다른 화면(설정·단어장·오늘의 회화·채팅방) = 84 그대로 · 회화방에서 실패 알림 정확히 1개(셸 알림과 이중 0) · 회화방을 떠난 뒤 늦게 온 실패는 셸 알림(84)으로 1개 · 문구·2.2초 그대로 · 알림이 탭을 막지 않음.
22. **한글 줄·재시도(task-030 화면 밖 보정)**: `先生へ` → `[센세-에]` · `家へ` → `[이에에]` · `コーヒーを` → `[코-히-오]` 그대로 · 단어 내부 장음(`센세-`·`토-꾜-`) 그대로 · 분석기 429 상태에서 같은 문장이 겹친 요청을 받아도 재시도 기록은 요청 1회당 1번만 늘어 항목 19 의 "최초 포함 3회"가 그대로 지켜짐.

### 15-7. 건드리지 말 것

- 서버·모듈: `src/modules/**`(특히 `speech/reading/client.ts` 변환 규칙 — 새 변환 함수를 화면에 만들지 않는다)·`src/app/api/**`·`prisma`·api-contract. 필요한 게 생기면 Leader 에게.
- `message.reading`·`replyReading` 데이터 경로(`useChatTurn` 이 받아 두는 것)는 **그대로 둔다** — 화면에서 안 쓸 뿐. 제거는 화면 A 배포 뒤 별도 PE+developer task(PE 기록 talk@v8·chat@v3).
- `LearningSettings` 저장 키 목록 · `CorrectionModeMenu` · `kaiwa.vocab.readingDefault` · TTS·다시 듣기·`onPick`(원문 문자열 사용).
- 지금 화면 요소(조각 필터·뱃지·▶ 소리·줄 ▶·▶ 듣기 칩·비교 밑줄·모아 둔 교정 칩·문법 칩·[표현 점검]·표시등) — 지우거나 옮기지 않는다(MOV 9건만).
- **이번 범위 밖(층을 달지 않음 — 데모에 없음, 후속 개선 후보)** — *task-033(§15-11)이 AI 평가·카드 뒷면·세트 결과 목록·`lesson/review/*` 칩·항목 카드·`LessonEnd` 표현 칩을 가져갔다. 남은 범위 밖은 §15-11-0 끝 줄*: AI 평가(`components/eval/*`) · 단어 세트 결과 목록(`vocab/WordResultList`)·카드 뒷면 · 복습 레슨 카드(`lesson/review/*`)·`LessonEnd`·`LessonTopicsScreen`·`LessonPasteScreen` · `PendingCorrectionsCard`·`ChatListItem`·`RoomIntro`·`TalkIntro` · `MicTestCard` · 관리자 콘솔 전부.

### 15-8. 서브태스크 분할 (각 15파일 이하 · 공용 부품은 A 가 먼저)

**화면 A — 공용 + 회화·채팅·표현 점검(15파일)**
1. `components/common/japanese/displayPrefs.ts`(신규) 2. `…/annotations.ts`(신규) 3. `…/JapaneseText.tsx`(신규) 4. `components/common/__tests__/japaneseDisplay.test.ts`(신규) 5. `chat/MessageBubble.tsx` 6. `chat/MessageList.tsx` 7. `chat/ChatRoom.tsx` 8. `chat/ChatMenuSheet.tsx` 9. `chat/CorrectionCard.tsx` 10. `chat/ProposalCard.tsx` 11. `chat/useChatTurn.ts` 12. `types/chat.ts` 13. `talk/TalkRoom.tsx` 14. `talk/TalkTutorBubble.tsx` 15. `talk/TalkCorrectionCard.tsx`
- 순서: ① 공용 1~4(테스트: 400자 분할·`cutRubyByRanges` 경계·`segmentsHiragana` 대조·이관 순서·캐시 규칙 null/available) → **여기서 커밋 지점 — B 착수 가능** ② 채팅(5~12) ③ 회화(13~15) ④ 360/390/412 확인.

**화면 B — 오늘의 회화·단어장·단어 상세·오늘의 단어·설정(15파일)**
1. `lesson/LessonScreen.tsx` 2. `lesson/StageUnderstand.tsx` 3. `lesson/StageGrammar.tsx` 4. `lesson/StageQuiz.tsx` 5. `lesson/StageApply.tsx` 6. `lesson/StageSpeak.tsx` 7. `lesson/parts.tsx` 8. `vocab/VocabDeck.tsx` 9. `vocab/WordsScreen.tsx` 10. `vocab/WordRow.tsx` 11. `vocab/WordDetailSheet.tsx` 12. `vocab/VocabCardFace.tsx` 13. `settings/DisplaySettings.tsx`(신규) 14. `app/(app)/settings/page.tsx` 15. `components/lesson/__tests__/display.test.ts`(③ 읽기 문제 보호 판정·도구 줄 키)
- 순서: 설정(13·14 — 스위치가 먼저 있어야 나머지를 확인하기 쉽다) → 단어장·오늘의 단어(8~12) → 수업(1~7).
- 둘 다 화면 파일이라 데모 게이트 `approved`(v4) 상태에서 시작. 서버·DB·네이티브 변경 0 → 웹 배포만(APK 재빌드 없음).

### 15-9. 데모와 다른 점 · Leader 확인 요청

**데모에 없던 상태 — 가이드로 정함(이의가 있으면 Leader 가 사용자에게)**

| # | 데모 v4 | 가이드 | 이유 |
|---|---|---|---|
| ⓐ | 내 말 번역 칸은 "번역 중…"·실패 두 상태만 | 서버에서 읽어 온 옛 말(번역 null)은 실패 문구 없이 **[번역 가져오기]** 하나 | 번역 켬으로 옛 채팅을 열면 모든 내 말에 "가져오지 못했어요"가 늘어서 실패처럼 보인다. 자동으로 가져오면 분당 20회·LLM 비용 |
| ⓑ | #32t 오류는 "가져오지 못했어요" 하나 | 409(턴 진행·다른 번역)·429·400/404 별도 문구(§15-2 H) | 계약에 있는 응답 — 같은 문구면 눌러도 계속 안 되는 이유를 모름 |
| ⓒ | 분석 대기 막대는 "보낸 직후 내 말"에만 | 분석을 기다리는 모든 자리(첫 로드 포함) | 채워질 때 높이가 튀지 않게(채팅 바닥 유지) |
| ⓓ | 표시 설정 저장 실패 상태 없음 | 되돌림 + 앱 셸 토스트 한 곳(`DisplaySaveNotice`) | 낙관 반영이라 실패를 알려야 함 — 화면을 떠난 뒤 실패해도 보이게(REV-096) |
| ⓔ | 카드 뒷면·평가 화면 등 | 범위 밖(그대로) | 데모 "적용 범위" 표에 없음 — 후속 IMP 후보 |

**Leader 확인 요청**

| # | 요청 | 권고 |
|---|---|---|
| ★① | 단어 루비(저장 읽기)와 한글(분석기)이 서로 다른 읽기면 한글을 숨긴다(§15-2 E) — 사용자가 고친 읽기가 있는 단어에서 한글이 안 보일 수 있음 | 이대로(숨김). 대안은 "저장 읽기를 #24r 에 힌트로" = 서버 변경이라 비범위 |
| ★② | ③ 문제가 **읽기 문제**(예: promptJa 「注文」 + 가나 보기 4개)면 루비·한글이 정답을 알려 준다. A4 프롬프트는 읽기 문제를 막지 않는다 | 고르기 전에는, **promptJa 루비 읽기 중 하나가 보기와 같으면** promptJa 의 히라가나·한글을 숨기고(보기 쪽은 그대로) 답한 뒤 보인다 — 평소 문제에는 영향 없음. 데모 "정답 힌트가 되지 않아요" 전제를 지키는 보호 장치 |
| ③ | O-3 "참고 번역" 표기(내 말 번역 오역 1/8 — 京都→경주) | **말풍선마다 붙이지 않는다(권고)** — 선생님 말 번역도 같은 LLM 이라 내 말에만 붙이면 일관성이 깨지고, 매 말풍선 꼬리표는 소음이다. 필요하면 설정 "번역 펼쳐 두기" 설명 끝에 "(AI 번역이라 가끔 틀릴 수 있어요)" 한 구절 — 사용자 확인 후에만(승인 문구 변경) |
| ④ | `message.reading`·`replyReading` 제거 task(PE talk@v8·chat@v3)는 화면 A 배포 뒤 | 화면 A 운영 반영 후 Leader 가 별도 task 로 |
| ⑤ | 범위 밖 화면(§15-7 끝 목록) | 사용자 원 요청("모든 일본어 부분")과의 차이 — `/개선작업` IMP 로 남길지 Leader 판단 |

### 15-10. task-030 후속 보정 — 토글 터치·내 말풍선 대기 자리·회화방 저장 실패 알림

승인 데모: docs/demo/task-030-japanese-display-followup-v1.html (v1)

- 승인: 사용자 2026-10-04 21:52 "task-030 데모 v1 승인"(sha256 `2383be5b…`, task frontmatter `demo_gate`). 데모 상태 id = `#toggle`·`#bubble`·`#toast`·`#decision`(결정 사항 없음). 데모의 "현재"는 HEAD `a130443` 클래스 값 그대로.
- **화면 구조·문구·색은 바꾸지 않는다** — 수치·규칙 보정만. 적용 토큰(이름만, 새 색 없음): `--color-line`(`--line`)·`--surface`·`--surface2`·`--ink2`. 새 수치 없음(136·84 는 `TalkRoom` 의 `VOICE_TOAST_BOTTOM`·`TEXT_TOAST_BOTTOM` 기존 값).
- 이 절이 위 §15-2 C·G·§15-3 B·§15-6 1·3·20 의 해당 값을 대신한다(그 줄에 표시해 둠).

**A. 표시 바 토글 터치 41 → 44px (`#toggle`, QA-L2) — `components/common/japanese/JapaneseText.tsx`**
- 원인: `DisplayBar` `h-11 border-b overflow-x-auto` → 안쪽 43px, 가로 스크롤 상자가 위아래로 넘친 토글 터치 영역(`before:-inset-y-1.5` = 44)을 잘라 41.
- `DisplayBar`: `border-b border-line` → `shadow-[inset_0_-1px_0_var(--color-line)]`(같은 색·같은 자리의 안쪽 1px 선) — 안쪽 44px. `overflow-x-auto`·높이 `h-11`·나머지 클래스 그대로.
- `DisplayToggles`: `before:-inset-y-1.5` → `before:-inset-y-[7px]`(46px). 바 안에서는 바 높이 44 로 잘려 44, 단어장·수업 도구 줄에서는 46. 알약 `h-8`(32)·글자·색·`✓` 그대로 — 알약이 0.5px 아래로 갈 뿐 겉모양 변화 0.
- 다른 `border-b` 위 가로 스크롤 줄에는 손대지 않는다(이번 범위는 표시 바 하나).

**B. 번역 켬 내 말풍선 높이 변화 +5.5 → ≤4px (`#bubble`, QA-L3) — `JapaneseText.tsx` · `components/chat/MessageBubble.tsx`**
- 원인: `HangulPlaceholder` `mt-1.5 h-3 mb-1`(6+12+4) 의 아래 4px 가 바로 아래 번역 칸 `mt-2` 와 겹쳐 사라짐 → 대기 자리 18 vs 한글 줄 21.5(위 2 + 13px×1.5) = +3.5, 루비 붙은 본문 +2 → +5.5.
- 제안: **내 말풍선(`UserBubble`, `MessageBubble.tsx` 195행 `<HangulLine state={ann} onTint />`)만** 대기 자리를 한글 줄과 같은 높이로 — 바깥 `mt-0.5 flex h-[19.5px] items-center`(aria-hidden) 안에 막대 `h-3 w-[62%] rounded-md bg-surface motion-safe:animate-pulse`, **막대 위아래 여백 0**(하단 margin 0 이라 번역 칸 `mt-2` 와 겹칠 것이 없다). 번역 켬·끔 모두 데모 실측 +2.
- 구현 형태: `HangulLine`(→`HangulPlaceholder`)에 선택 prop 하나(예: `slot="line"`)를 두고 내 말풍선에서만 넘긴다. 기본값 = 지금 막대(`mb-1 mt-1.5`) 그대로 — 선생님 말풍선·`TalkCorrectionCard`(onTint)·교정·제안 카드·수업 줄은 바꾸지 않는다(Leader 범위, 이미 ≤4px). `size` 13 기준(내 말풍선은 13 만 씀).
- 막대 모양(12px·폭 62%·내 말 말풍선 `bg-surface`·깜박임·`prefers-reduced-motion` 정지)·"번역 중…" 막대(138행 `!w-[72px]`)는 그대로.

**C. 회화방 저장 실패 알림 자리·녹음 중 미루기 (`#toast`, REV-097 L-2) — `displayPrefs.ts` · `shell/DisplaySaveNotice.tsx` · `JapaneseText.tsx` · `talk/TalkRoom.tsx`**

| 상황(데모 `#toast` 4종) | 지금 | 바꾼 뒤 |
|---|---|---|
| 회화방 음성 모드 · 말하지 않을 때 | 셸 알림 bottom 84 → 음성 입력 바(116)와 겹쳐 상태 줄 가림 | **bottom 136**(방 토스트 자리) · 겹침 0 |
| 녹음 중에 실패 | 즉시 표시(상태 줄 가림·스크린리더 음성이 마이크로) | 스위치 값은 즉시 되돌림, **알림은 화면·스크린리더 모두 미룸** |
| 손을 뗀 직후 | (녹음 중 이미 사라져 못 봄) | 미뤄 둔 알림 **1회** 표시(136) |
| 회화방 글자 입력 모드 | 84 | 84(`TEXT_TOAST_BOTTOM`) — 같음 |
| 다른 화면(설정·단어장·오늘의 회화·채팅방) | 84 | 84 그대로(셸) |

- 방식: 회화방이 마운트된 동안 **방이 실패 알림을 "맡는다"** — `displayPrefs.ts` 에 맡기 훅(예: `useClaimDisplaySaveFailure(onFail)`, 마운트 때 등록·언마운트 때 해제, 한 번에 하나)을 두고, `TalkRoom` 이 `() => notify(DISPLAY_COPY.saveFailed, DISPLAY_TOAST_MS)` 로 맡는다. `notify` 는 지금 규칙 그대로(녹음 중 `deferredToastRef` 에 넣었다가 녹음이 끝나면 `showToast` 1회, 마지막 값만 남음 → 녹음 중 여러 번 실패해도 1회) — 토스트 자리는 `<Toast bottomPx={mode === 'voice' ? 136 : 84}>` 그대로라 새 수치가 없다.
- 맡은 동안 `DisplaySaveNotice`(셸)는 띄우지 않는다 → **알림 정확히 1개**. 방을 떠난 뒤 늦게 온 실패(PUT 상한 10초)는 해제됐으니 셸이 84 로 띄운다(REV-096 #2 유지).
- 성공 토스트 지우기와 순서: 맡은 호스트가 있으면 `useClearSuccessOnSaveFail` 의 `onToast('', 0)` 를 **부르지 않는다** — 실패 문구가 같은 방 토스트 칸을 덮어 성공 토스트가 자연히 사라지고, 빈 문구가 `notify` 를 거쳐 미룬 실패 알림이나 막 띄운 실패 알림을 지우는 순서 문제가 생기지 않는다. 맡은 호스트가 없으면 지금 동작 그대로(§15-3 B — 테스트로 잠금, REV-097 L-1).
- 문구("표시 설정을 저장하지 못했어요. 다시 눌러 주세요")·2.2초(`DISPLAY_TOAST_MS`)·되돌림·`failEpoch` 규칙 그대로. 알림은 탭을 막지 않는다(지금 `Toast` 그대로).

**D. 화면 밖 보정(데모에 없음 — 화면 배치 변화 0, 같은 작업)**
- 한글 줄 장음 뒤 조사 へ(1단계 완료, REV-098 PASS) — 2단계에서 REV-098 L-1 단언 1건 추가(`[ケ][絵 エ]` → `케-` 유지, 조사 아닌 エ 는 합침).
- REV-097 L-3 `annotations.ts`: 겹친 flush 가 같은 조각으로 429 를 받아도 그 조각의 실패 기록은 **요청 1회당 1번만** 늘린다(§15-2 B 3 "35초 간격·최대 2회" 불변).

**E. 생성/수정 파일(화면 6파일 `src/components/**` + 테스트 2)**
1. `common/japanese/JapaneseText.tsx`(A 바·토글 · B 대기 자리 prop · C 지우기 생략) 2. `chat/MessageBubble.tsx`(B 내 말풍선 prop) 3. `common/japanese/displayPrefs.ts`(C 맡기 훅) 4. `shell/DisplaySaveNotice.tsx`(C 맡은 동안 숨김) 5. `talk/TalkRoom.tsx`(C 맡기) 6. `common/japanese/annotations.ts`(D L-3) 7. `common/__tests__/japaneseDisplay.test.ts`(L-1 `onToast('',0)` 잠금 · 맡은 동안 셸 0·지우기 0 · 해제 뒤 셸 1 · L-3 재시도 1회 증가) — `speech/__tests__/reading.test.ts` 는 REV-098 L-1 단언 1건.
- 순서: A → B(390 에서 번역 켬·끔 측정) → C(맡기·해제·녹음 중 미루기) → D → 테스트 → 360/390/412 확인(§15-6 1·3·20·21·22).
- 서버·DB·API·네이티브 변경 0 → 웹 배포만(APK 재빌드 없음). 엔진명·'후리가나' 신규 0건.

### 15-11. task-033 일본어 표시 확장 — AI 평가 · 단어 카드 뒷면 · 세트 결과 · 복습 칩

승인 데모: docs/demo/task-033-japanese-display-more-screens-v1.html (v1)

- 승인: 사용자 2026-10-05 08:37 "task-033 데모 v1 승인"(content sha256 `d84e9574…`, task frontmatter `demo_gate`). 결정 6건 = **권고 A 전부**: E1-A · E2-A · C1-A · C2-A · R1-A · S1-A(아래 §15-11-1). 데모 상태 id = `#e-meaning`·`#e-reading`·`#e-usage`·`#e-chunk`·`#e-listen`·`#e-listen-rv`·`#e-assemble`·`#e-spot`·`#e-result-w`·`#e-result-t`·`#c-back`·`#c-flip`·`#c-long`·`#c-result`·`#r-home`·`#r-gen`·`#r-items`·`#r-end`(주소 `#<id>`). 데모의 "현재"는 HEAD `26b6322` 소스 대조본.
- **표시 규칙은 새로 만들지 않는다** — 층 순서·크기·줄간격·대괄호·"애매하면 숨김"·입력칸 제외는 §15-1·§15-2 그대로, 공용 부품(`JaText`·`HangulLine`·`DisplayToggles`·`useAnnotations`·`useWordLayersList`·`cutRubyByRanges`·`plainPieces`)을 **수정 없이** 쓴다. `src/components/common/**` 변경 0.
- 적용 토큰(이름만, 새 색 없음): `--ink`·`--ink2`·`--ink3`·`--surface`·`--surface2`·`--line`·`--accent`·`--accent-soft`·`--good`·`--bad`(Tailwind `text-ink2`·`bg-surface2`·`decoration-good`·`decoration-bad` …). 새 수치 없음 — 아래 표의 값은 전부 데모 CSS 값이며 §15-1 B 표에 이미 있는 조합이다.
- 서버·DB·API·네이티브 변경 0(#24r 읽기 분석·#11~#12 표시 설정·#66 평가 상세 그대로) → 웹 배포만, APK 재빌드 없음. 새 문구 1개(★ §15-11-2 D).

#### 15-11-0. 레이아웃 설계(delta — 바뀌는 위계만)

| 항목 | 내용 |
|---|---|
| 목표 | 회화방·수업에서 쓰던 히라가나·`[한글]` 층을 평가·카드 뒷면·복습 칩에도 같은 모양으로 — **단, 정답을 흘리지 않는다** |
| 주요 위계 | 바뀌지 않음. 층은 본문 바로 위(히라가나)·바로 아래(`[한글]`)에만 붙고 카드·행·칩 순서는 그대로. 새 영역은 평가 푸는 화면의 도구 줄 하나(E2-A, 문항 카드 위 42px = 알약 32 + 아래 여백 10) |
| 영역 | 평가 푸는 중(헤더 56·문항 번호 줄 고정 → **스크롤 영역 맨 위에 도구 줄** → 문항 카드 → 아래 [이전][다음] 고정) · 평가 결과(층만) · 카드 뒷면(층만, 카드 안 자리 측정) · 세트 결과 목록(행 높이 56 → 약 96, 실측 96~97 — REV-104 L-3) · 복습 칩(높이 32 → 내용 맞춤) |
| 컴포넌트 | 공용 `JaText`·`HangulLine`·`DisplayToggles` + 평가 전용 순수 함수 파일 `eval/displayGuard.ts`(신규, 정답 보호·조각 루비·빈칸 나누기) |
| 상태 | 표시 설정 로드 전(층 없음) · 분석 기다리는 중(줄간격 예약 + 막대) · 분석 완료 · 분석 실패/분석 불가(본문만) · 히라가나/한글 켬·끔 4조합 · 정답 보호(제출 전) · 카드 자리 부족(예문 `[한글]` 뺌) |
| 행동 | 평가 도구 줄 [히라가나][한글] 누르기(앱 전체 값, 토스트 2.2초) — 그 밖의 조작은 지금 그대로 |
| 반응형 | 360/390/412 모두 같은 구조. 줄어드는 곳은 줄바꿈(칩·보기·결과 문장)만, 가로 스크롤 0. 카드 뒷면만 높이 780 에서 예문 `[한글]` 이 빠질 수 있음(C2-A) |

**넣지 않는 곳(데모 "적용 범위" 표 끝)**: 평가 문항 줄 제목 태그("2. 읽기 쓰기 · 注文") · 평가 기록 목록·오늘 홈 평가 카드·평가 시작 화면(일본어 없음) · 한국어 지시문·상황 설명·선생님 한마디·피드백·설명 속 「」(`J()`·`JaQuoted`) · 입력칸(읽기 입력·글자 답·고쳐 쓰기·이유) · 녹음 중 자막(`voice.partial`) · 수업·복습 제목 일본어(`LessonHeader`·`LessonEnd` 머리 `content.title`) · 카드 앞면(§15-4-6 그대로) · 4지선다 보기(한국어 뜻) · 복습 수업 ①~⑤ 문항 본문(026 에서 적용됨). **아직 범위 밖(다음 개선 후보)**: 일반 수업 `LessonEnd` 머리 · `LessonTopicsScreen` · `LessonPasteScreen` · `PendingCorrectionsCard` · `ChatListItem` · `RoomIntro` · `TalkIntro` · `MicTestCard` · 관리자 콘솔.

#### 15-11-1. 결정(확정 — 바꾸지 않음)

| 결정 | 내용 | 구현에서 뜻하는 것 |
|---|---|---|
| **E1-A** | 평가 푸는 동안 앱 설정(히라가나·한글)을 따르고, 정답을 흘리는 자리만 숨김 | §15-11-2 정답 보호 규칙 4개. 평가에는 **번역 층 없음**(번역 스위치는 평가 화면에 영향 0) |
| **E2-A** | 평가 푸는 화면 문항 카드 바로 위 [히라가나][한글] 도구 줄 | `EvalRunner` 스크롤 영역 맨 위(§15-11-2 C). 결과 화면에는 없음 |
| **C1-A** | 카드 뒷면 표제어 히라가나는 앱 히라가나 설정과 무관하게 **늘 보임** | 뒷면 `JaText ruby={저장 읽기 루비} rubyAlways`. `[한글]` 은 앱 한글 설정을 따름(카드 [あ 읽기]와도 무관) |
| **C2-A** | 카드 뒷면 예문 = 히라가나 + `[한글]` 1줄 말줄임, 카드에 자리가 없으면 **예문 `[한글]` 줄만 뺌**(번역 우선) | 카드 면을 그릴 때 한 번 잰다 — 드래그 중에는 재지 않는다(§15-11-3 B) |
| **R1-A** | 복습 칩 = 수업 표현 칩 규칙(히라가나 + 일본어 뒤 `[한글]` 12 인라인), 칩 높이는 내용 맞춤 | `ReviewChips`·`NextReviewCard` 칩(§15-11-4) |
| **S1-A** | 범위를 넓게 — 세트 결과 단어 목록(`WordResultList`)·복습 종료 "쓴 표현·써 볼 표현" 칩(`LessonEnd` `ExprChip`)까지 | 일반 수업 종료 화면의 표현 칩도 같이 바뀐다(같은 컴포넌트 — 승인 데모 S1-A 단점 항목에 적힌 그대로) |

#### 15-11-2. AI 평가 — 푸는 중 (`#e-*`, 서브태스크 A)

**A. 정답 보호 규칙(구현 정의 — 화면이 정하는 유일한 경로는 `eval/displayGuard.ts`)**

평가 상세(#66)는 제출 전 `expected` 를 주지 않으므로 화면이 가진 것은 각 문항의 `prompt` 뿐이다. 아래 4개는 **설정과 무관하게** 지킨다(E1-A 의 "보호").

| # | 자리 | 규칙 | 근거 데모 |
|---|---|---|---|
| P1 | 읽기 쓰기(`READING_INPUT`) 문항의 단어 상자 | 히라가나·`[한글]` **둘 다 그리지 않는다**(지금처럼 단어만, `JaText` 쓰지 않음 — 분석 요청도 하지 않음). 앱 설정에서 히라가나나 한글이 하나라도 켜져 있으면(`prefs.loaded && (showFurigana \|\| showHangul)`) 단어 상자 바로 아래 안내 1줄 ★ | `#e-reading` |
| P2 | **같은 평가 다른 문항** 속 읽기 쓰기 단어(교차 보호) | 그 단어가 들어간 일본어 블록은 ① 그 단어 범위에 걸친 히라가나만 빼고(다른 한자 히라가나는 그대로) ② 그 블록의 `[한글]` 줄을 통째로 숨긴다 | `#e-usage` 2번 보기 |
| P3 | 듣고 답하기 들려주는 문장 | 제출 전에는 글자 자체가 없다(#66 `textHidden:true`) — 막대 2줄 그대로, 층 없음. [글자로 보기](#67c) 뒤 `revealedText` 에만 층 | `#e-listen`·`#e-listen-rv` |
| P4 | 문장 조립 조각 | 조각마다 **히라가나만**. 조각 `[한글]`·"만든 문장" 전체 소리 줄 없음(문장 소리 = 순서 힌트, 조각 단독 소리는 조사 소리가 틀릴 수 있음) | `#e-assemble` |
| — | 평가 전체 | **번역 층 없음**(어느 문항·결과에도 번역을 그리지 않음 — 뜻 고르기·용법의 답을 알려 줌) | 오른쪽 "지금 보는 조건" |
| — | 용법 고르기 빈칸 문장 | 히라가나만, `[한글]` 없음(빈칸 자리 소리 규칙 없음 — "애매하면 숨김") | `#e-usage` |

**P2 판정 방법(서버 변경 0 — `prompt.surface` 기준)**
1. `readingGuardKeys(items)`: 이 평가의 `READING_INPUT` 문항마다 `promptStr(prompt, 'surface')` 에서 **마지막 한자까지 자른 어간**을 키로 쓴다(`注文`→`注文`, `片付ける`→`片付`, `食べる`→`食`, `引き受ける`→`引き受`). 한자가 하나도 없는 표기(가나 단어)는 키를 만들지 않는다(소리가 글자 그대로라 흘릴 것이 없음). 중복 제거. 한자 판정 = `@/modules/speech/reading/client` 의 `hasKanji` 와 같은 문자 범위. ★ 데모는 표기 전체 포함 검사 — 활용형(`食べました`)에서 새지 않게 어간으로 넓혔다(§15-11-7 ⓐ).
2. 키는 `EvalRunner` 가 `items` 로 한 번 계산해(`useMemo`) 문항 컴포넌트에 `guard` prop 으로 넘긴다. 결과 화면(`DONE`)은 키를 쓰지 않는다.
3. `guardHits(text, keys): TextRange[]` — 블록 글자에서 각 키가 나오는 **모든** 자리(코드포인트 기준 `[start,end)`). 히트가 0개면 그 블록은 보호 대상이 아니다 → 평소 경로(`JaText state={ann}` + `HangulLine`).
4. 히트가 있으면: 루비 = `guardedRuby(text, state, hits, showFurigana)` — `state.s==='ready'` 면 `rubyPieces(state.segments)` 에서 **히트 범위와 한 글자라도 겹치는 조각의 `reading` 을 null**(조각 전체가 보호 — 반쪽 읽기 없음), `loading` 이고 한자가 있으면 `plainPieces(text)`(줄간격만 예약, 읽기 없음), 그 밖 null. `JaText` 에는 `ruby={guardedRuby(…)}` 로 넘긴다(공용 `ruby` 경로 — `JaText` 수정 없음). `[한글]` = 그리지 않는다(`HangulLine` 생략).
5. 단어 상자(뜻 고르기·조각 분류)처럼 저장 읽기 루비(`alignWordRuby`)를 쓰는 블록도 같다 — 루비 조각에서 히트 겹친 조각의 읽기를 null, `[한글]` 생략.
6. 분석 요청은 보호 블록도 그대로 보낸다(화면에 그리지 않을 뿐 — 결과 화면에서 캐시 적중).

**B. 문항별 적용 표(`eval/EvalItems.tsx`)**

| 문항(데모) | 자리(현재 행) | 제안 — 일본어 · 히라가나 rt · 루비 줄간격 · `[한글]` | 보호 |
|---|---|---|---|
| 뜻 고르기 `#e-meaning` · 조각 분류 `#e-chunk` | `WordBox`(58~71행) 단어 32 semibold leading 1.3 + **읽기 15px 줄(64~68행)** | 단어 32 semibold · **rt 13 · 루비 줄간격 1.8** · `[한글]` **14**(`className="mt-0"` — 상자 `gap-0.5` 만) · **읽기 15px 줄 삭제**. 루비 = `useWordLayers(word, reading)` 의 `ruby`(저장 읽기 `prompt.reading`, 앱 히라가나 설정 따름), 한글 = 같은 훅의 `hangul`(저장 읽기 ≠ 분석 읽기면 숨김 — §15-2 E). 한자 없는 말(`たまに`) = `[한글]`만 | P2 |
| 뜻 고르기 보기 | `ChoiceRows`(92행) 한국어 15 | 그대로(층 없음) | — |
| 읽기 쓰기 `#e-reading` | `ReadingItem` `WordBox`(171행) | 단어만(지금 그대로) + ★ 안내 1줄(§D) — 입력칸·[저장] 그대로 | **P1** |
| 용법 고르기 `#e-usage` 빈칸 문장 | 152~156행 `<p>` 17 leading 1.7 + `BlankSentence` | `sentenceJa` 를 `___` 에서 둘로 나눠(`blankParts`) 앞·뒤를 각각 `JaText as="span"`(같은 `<p>` 안) + 가운데 빈칸 밑줄 그대로. 한자 있고 히라가나 켬이면 `<p>` 줄간격 **2.1**(기다리는 중에도). `[한글]` **없음** | P2 |
| 용법 고르기 일본어 보기 | `ChoiceRows ja`(111행) 17 | 일본어 17 · rt 11 · 줄간격 **2.1** + `[한글]` **12.5**(`HangulLine as="span"` — 버튼 안이라 `<p>` 금지). 보기 높이 52 → 약 80px. 번호 원·"내 답"·선택 테두리 그대로 | P2 |
| 듣고 답하기 `#e-listen` 들려주는 문장 | `ListenBlock` 막대(283~287행) | 그대로 | **P3** |
| 듣고 답하기 `#e-listen-rv` [글자로 보기] 뒤 | 220~224행 점선 상자 17 leading 1.7 | `JaText`(17, `whitespace-pre-wrap` 유지, 줄간격 2.1) + `[한글]` **13**. "글자로 봤어요 · 결과에 표시돼요" 그대로 | P2 |
| 듣고 답하기·상황 응답 "내가 한 말" | `VoiceAnswer` 367~370행 `item.answerText` 17 | `JaText`(17, 2.1) + `[한글]` **13** — 상자 `aria-hidden` 은 지금처럼 유지(층 추가와 무관, 현행). 녹음 중 자막(360~363행)·빈 상자 안내·글자 입력 모드(textarea)는 달지 않음 | P2 |
| 문장 조립 `#e-assemble` | 넣은 조각(440행)·남은 조각(449~451행) 17, 높이 44 | 조각 글자를 `JaText as="span"`(17, 줄간격 2.1, 높이 44 그대로 — 17×2.1=36). **`[한글]` 없음**. 조각 문자열마다 따로 분석(`useAnnotations(pieces)` 한 번). `aria-label`(`assembleDel`·`assembleAdd`)은 원문 문자열 그대로 | **P4** · P2 |
| 틀린 곳 찾기 `#e-spot`(조각 모드) | 508~524행 조각 버튼 18 | `sentenceJa` **전체를 한 번 분석** → `spotSegmentRuby(state, segments, showFurigana)` 가 조각 경계(코드포인트, `segments.join('')===sentenceJa`)로 `cutRubyByRanges` 해 조각별 루비 배열을 만든다(경계가 한자 묶음을 자르면 그 묶음만 히라가나 없음). 각 버튼 = `JaText as="span" text={seg} ruby={조각 루비}`(줄간격 2.1, 18px, 높이 44 그대로). 조각 묶음(`role="group"`) **아래** 문장 전체 `[한글]` **13**(위 여백 6px = `mt-1.5`). "고른 곳 · …" 줄·입력칸 그대로 | P2 |
| 틀린 곳 찾기(옛 문항, 조각 없음) | 558~562행 문장 상자 17 | `JaText`(17, 2.1) + `[한글]` 13. 고쳐 쓰기 칸·이유 칸은 달지 않음 | P2 |
| 상황 응답 상황 설명 | 404~406행 한국어 | 그대로 | — |

- 분석 상태(`#e-*` 데모 "읽기 분석" 조작): **기다리는 중** = 본문 그대로 + 루비 줄간격 예약 + `[한글]` 자리 막대(§15-2 C, `HangulLine` 기본) — 단어 상자는 저장 읽기라 히라가나가 바로 나오고 한글 자리만 막대. **실패/분석 불가** = 히라가나 없이 본문만(단어 상자는 저장 읽기 히라가나는 보임), `[한글]` 줄 없음, 오류 문구·토스트 없음(§15-1 G).
- 요청 묶기: `EvalRunner` 가 마운트 때 `collectEvalTexts(items)`(아래 E) 로 `useAnnotations` 한 번 — 결과는 버리고 캐시만 데운다(문항을 넘길 때 막대가 다시 뜨지 않게, WORDS 10문항 ≈ 50문장 = 1요청). 각 문항 컴포넌트는 자기 문장을 `useAnnotations` 로 다시 받는다(캐시 적중).

**C. E2-A 도구 줄 — 위치·모양(`eval/EvalRunner.tsx` 505~523행)**
- 위치: 스크롤 영역(`ref={scrollRef}` div) 안, 시간 초과 띠(`over`, 506행) **다음**, 문항 카드 `<section>`(518행) **바로 위**. 스크롤 영역 안이라 스크롤과 함께 움직인다(고정 아님 — 화면당 스크롤 1곳·고정은 헤더·번호 줄·아래 버튼만).
- 모양: `<div role="group" aria-label={DISPLAY_COPY.toolGroup} className="mb-2.5 flex min-w-0 flex-wrap items-center gap-2"><DisplayToggles keys={['fu','hg']} onToast={show} /></div>` — 수업 ③ 문제 도구 줄(`LessonDisplayTools`)과 같은 모양·같은 그룹 이름("보기 설정"). 번역 토글 없음. 알약 32px · 터치 46px(`DisplayToggles` 그대로). `lesson/parts` 를 import 하지 않고 `DisplayToggles` 를 직접 쓴다(평가→수업 의존 금지).
- 문항 종류와 무관하게 늘 보인다(읽기 쓰기 문항에서도 — 다른 문항을 위해 끄고 켤 수 있음). 결과 화면·평가 시작 화면에는 없다.
- 토스트: `EvalRunner` 의 `useToast().show`(지금 `<Toast bottomPx={84}>` 그대로) — 성공 문구 §15-5, 2.2초(`DISPLAY_TOAST_MS`). 저장 실패 알림은 앱 셸(§15-3 B) — 평가는 맡지 않는다.

**D. ★ 새 문구(단일 출처 `eval/evalCopy.ts` `ITEM.readingGuardNote`)**
- `"읽기를 묻는 문항이라 히라가나·한글은 제출한 뒤에 보여 줘요."` — 원문 그대로(마침표 포함).
- 자리: 읽기 쓰기 단어 상자 바로 아래, 입력 줄 위. `<p className="mt-1.5 text-[12px] text-ink2 break-keep">`. 둘 다 끔이면 그리지 않음(숨길 것이 없음). `role`·`aria-live` 없음(정적 안내).

**E. `eval/displayGuard.ts`(신규, 순수 함수 — 테스트 대상)**

| 함수 | 하는 일 |
|---|---|
| `readingGuardKeys(items)` | P2 키 목록(위 A 1) |
| `guardHits(text, keys)` | 키 출현 범위들(코드포인트) |
| `guardedRuby(text, state, hits, showFurigana)` · `guardWordRuby(pieces, hits)` | 히트 겹친 조각 읽기 null(위 A 4·5) |
| `blankParts(sentenceJa)` | `{ before, after } \| null`(`___` 없으면 null → 문장 전체 한 블록) |
| `spotSegmentRuby(state, segments, showFurigana)` | 조각별 `RubyPiece[] \| null`(기다리는 중·한자 있음 = `plainPieces(seg)` 로 줄간격만 예약) |
| `filledRange(sentenceJa, fill)` · `fixLineRanges(sentence, wrongSpan, correctedJa)` | 결과 화면 채운 문장·고친 곳 줄의 `{ text, ranges }`(§15-11-5) — 기존 `logic.ts` `spotFix` 재사용 |
| `collectEvalTexts(items, { done })` | 분석할 일본어 문장 목록(제출 전: 단어 상자·빈칸 앞뒤·일본어 보기·글자로 본 문장·내 답·조각·틀린 곳 문장 / 결과: + 정답·모범 답·들려준 말·채운 문장·고친 줄·`correctedJa`). 읽기 쓰기 단어(P1)·숨긴 듣기 문장은 넣지 않는다 |

`import` 는 `@/modules/speech/reading/client`(`rubyPieces`·`hasKanji` 등)·`@/components/common/japanese/annotations`(`cutRubyByRanges`·`plainPieces`·타입)만.

#### 15-11-3. 오늘의 단어 — 카드 뒷면 · 세트 결과 목록 (`#c-*`, 서브태스크 B)

**A. 카드 뒷면 `vocab/VocabCardFace.tsx`(85~114행) — `#c-back`·`#c-flip`·`#c-long`**

| 자리 | 현재 | 제안 |
|---|---|---|
| 머리 줄(89~98행) | 표제어 22 semibold `truncate` + **옆 읽기 14px `truncate`(92~96행)** + ★ | `flex min-w-0 items-start gap-2`: 왼쪽 `min-w-0 flex-1` 안에 표제어 `JaText as="span" className="block truncate text-[22px] font-semibold" ruby={ruby} rubyAlways leading={2} rt={11}`(**C1-A — 앱 히라가나 끔이어도 보임**) + 그 아래 `HangulLine state={hangul} size={13}`(앱 한글 설정 따름) · 오른쪽 ★ 그대로 · **옆 읽기 칸 삭제** |
| 결과 띠·뜻(19, 3줄) | — | 그대로 |
| 예문(103~107행) 16 leading 1.6 `line-clamp-2` | — | `JaText` 16 `line-clamp-2`, 루비 줄간격 **2.15**(예문 #24r 분석) + `HangulLine size={13} className="line-clamp-1"`(**C2-A 1줄 말줄임** — `display:-webkit-box` 가 `block` 을 이기는지 확인, 지면 `[display:-webkit-box]`) |
| 번역(108행) 14 `line-clamp-1` | — | 그대로(늘 보임 — 번역 스위치와 무관) |

- 데이터(memo 유지 — §15-4-6 과 같은 방식): `VocabDeck.tsx` 가 덱 전체를 처음 한 번에 받아 props 로 넘긴다. 카드 면 안에서 `useAnnotations` 를 부르지 않는다.
  - 표제어 루비: 지금 42행 `ruby`(저장 읽기 `alignWordRuby`, 설정 무관)를 뒷면에도 넘김.
  - 표제어 한글: 39행 `useWordLayersList` 를 **카드 [읽기]와 무관하게** 늘 부른다(한글 끔이면 훅이 요청하지 않음) → 앞면은 지금처럼 `showReading` 일 때만 `faceHangul`, 뒷면은 `layers[view].hangul`(`backHangul` 새 prop).
  - 예문: `useAnnotations(cards.map(c => c.example ?? ''))` 한 번 → `exampleAnn={exAnns[view]}` 새 prop. 빈 예문은 `NONE`.
- 앞면·4지선다 보기·뒤집기 버튼·도구 칸·제스처 안내·12초 리듬 그대로. 분석이 늦어도 카드 넘김을 막지 않는다.

**B. C2-A 자리 측정 — "넘치면 예문 `[한글]` 줄만 뺀다"(드래그 중 측정 금지)**
1. 뒷면 본문 상자(`mt-2 min-h-0 flex-1`, 102행)에 `ref`. 상태 `dropExHangul`(기본 false).
2. **측정 키** = `card.order`·면(`side`)·예문 문자열·`exampleAnn.s`·`prefs.showHangul`·`prefs.showFurigana`·카드 상자 크기. 키가 바뀌면 `dropExHangul=false` 로 줄을 다시 넣고 `useLayoutEffect` 에서 **한 번** 잰다: 본문 상자 안 마지막 자식의 `getBoundingClientRect().bottom` 이 상자 `bottom` 보다 0.5px 넘게 크면 `dropExHangul=true`(같은 레이아웃 단계라 깜박임 없음). 데모 `measure()` 와 같은 판정.
3. 카드 상자 크기 = `ResizeObserver`(카드 면 바깥 상자) — 드래그는 `transform` 만 바꿔 크기가 변하지 않으므로 **드래그 중에는 불리지 않는다**. 스크롤·`pointermove`·`transform` 변화에는 측정을 걸지 않는다. 글꼴 로드 뒤 1회(`document.fonts.ready`) 다시 잰다.
4. 뺐을 때 표시(1단계): 예문 `[한글]` 줄만 없음(막대 포함). 표제어 `[한글]`·예문 히라가나·번역은 그대로. 예문이 없거나 한글 끔이면 재지 않음.
5. 데모 실측: `#c-long`(긴 뜻 — 데모 값은 실제로 **2줄**(57px) + 긴 예문) **360×780 에서만 4px 넘침 → 뺌**, 그 밖 조합 넘침 0(뺄 일 없음).
6. **2단계(task-033 B 구현 중 추가, 2026-10-05 — C2-A "번역을 지킨다" 안의 측정 대체 규칙)**: 1단계로 예문 `[한글]` 을 뺀 뒤 **다시 한 번** 재서 아직 넘치면 **표제어 `[한글]` 줄**(머리 칸 `HangulLine 13`)도 뺀다.
   - 근거 사례: 뜻 3줄 꽉(`line-clamp-3`) + 예문 2줄(루비 2.15) + 번역 1줄 + 결과 띠 = 모든 칸이 상한까지 찬 최악 카드. 780 높이(카드 ≈315px)에서 1단계 뒤에도 번역이 11.8px 잘림(360/390/412 같음), 892 는 1단계만으로 여유 −10.7px.
   - 왜 표제어 `[한글]` 인가: 뒷면 표제어 히라가나는 C1-A 로 **늘 보여** 읽기 정보가 사라지지 않는다. 줄은 21.5px(위 2 + 19.5)로 남은 11.8px 를 덮고 ≈9.7px 여유가 남는다. 예문 1줄로 줄이기(문장 절반이 잘려 번역과 어긋남)·예문 히라가나 빼기(예문 한자를 읽을 길이 없어지고 앱 히라가나 설정과 어긋남)·줄간격 축소(2.15 미만은 둘째 줄 루비가 첫 줄에 닿음)는 쓰지 않는다.
   - 순서 고정·되돌림 없음: 0 → 1(예문 `[한글]`) → 2(+표제어 `[한글]`). 2단계에서 예문 `[한글]` 을 다시 넣어 보지 않는다(두 줄 높이가 같아 다시 넘친다). 상태는 `dropLevel: 0|1|2` 하나를 측정 키에 묶고, 키가 바뀌면 0 으로 돌아가 다시 잰다. 두 번째 측정도 `useLayoutEffect` 안(같은 페인트 전)이라 깜박임 없음. 드래그 중 측정 0 규칙은 그대로.
   - 2단계 뒤에도 넘치면(780 미만 높이 — `VocabDeck` `min-h-[600px]` 쪽) 더 빼지 않는다. 운영 HEAD 구조도 카드 ≈276px 아래에서는 번역이 잘리는 같은 한계(아래 비교).
   - 회귀 판정(코드 값 계산, 같은 최악 내용): HEAD(26b6322 이전 구조 — 머리 22px×1.5=33 · 띠 8+27.5 · 본문 8+뜻 85.5+예문 8+51.2+번역 21) 합 242.2px → 780 카드 안쪽 ≈280px 에서 **≈38px 여유, 잘림 없음**. 이번 층(표제어 루비 44 + `[한글]` 21.5, 예문 루비 68.8 + `[한글]` 21.5)이 +71.6px 를 더해 생긴 **회귀**이며, 1단계(−21.5) + 2단계(−21.5) 뒤 ≈9.7px 여유.
   - 테스트: `overflowsBody` 와 같은 순수 함수로 "단계 선택"(측정값 열 → 0/1/2)을 분리해 단위 테스트. 실화면 QA 는 아래 15-11-8 에 "뜻 3줄 꽉 + 예문 2줄 + 번역" 카드(CHOICE·FLIP 두 모드) × 360/390/412 × 780: 번역 줄 잘림 0 · 2단계일 때 표제어 히라가나 보임 · 892 에서는 2단계 0.

**C. 세트 결과 단어 목록 `vocab/WordResultList.tsx`(S1-A) — `#c-result`**
- 목록(`WordResultList`)이 `useWordLayersList(cards.map(c => ({ surface: c.surface, reading: c.reading })))` 를 한 번 부르고 `Row` 에 `ruby`·`hangul` 을 넘긴다(단어장 `WordRow` 와 같은 방식 — §15-4-4).
- `Row`(18~27행): 표제어 줄을 `JaText as="span" className="block min-w-0 truncate text-[17px] font-semibold" ruby={ruby} leading={1.95}`(**앱 히라가나 설정 따름** — C1 예외는 카드 뒷면만) + `HangulLine as="span" state={hangul} size={12.5}` → **옆 읽기 13px `<span>`(22~26행) 삭제** → "정답 … · 내 답 …" 14 줄 그대로. 오른쪽 뱃지·★·› 그대로.
- 행 높이 56 → 약 96px(둘 다 켬, 실측 96~97px — REV-104 L-3 정정). `min-h-[56px]` 유지. 지운 단어(링크 없는 행)도 같은 층.
- 같은 화면의 세 목록(틀린 단어·다시 볼 카드·전체)이 각자 훅을 불러도 같은 표기는 캐시로 1번만 요청된다.

#### 15-11-4. 복습 — 칩 · 항목 카드 · 종료 표현 칩 (`#r-*`, 서브태스크 C)

| 화면(데모) | 파일 · 현재 | 제안 |
|---|---|---|
| 오늘 홈 복습 카드 [자세히] `#r-home` · 복습 수업 만들기 `#r-gen` | `review/TeacherWhy.tsx` `ReviewChips`(36~50행) — 칩 `h-8` 15px 한 줄 `truncate` | **R1-A**: `ReviewChips` 가 `useAnnotations(chips.map(c => c.textJa))` 한 번. 칩 `li` = `inline-flex min-h-8 max-w-full min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 rounded-[10px] px-2.5 py-1 text-[15px] {bg}` · 집중 점(`FocusDot`)은 `self-center` 감싸기 · 일본어 `JaText as="span" className="min-w-0 [overflow-wrap:anywhere]" leading={2.1}`(15px, **`truncate` 없앰** — 길면 칩 안에서 줄바꿈) + `HangulLine state inline size={12}`. "외 N개" 칩은 `h-8` 그대로. `ReviewGenItems.tsx` 는 `ReviewChips` 를 쓰므로 수정 없음 |
| 홈 카드 근거 문장 「」 | `JaQuoted` | 그대로(달지 않음) — `[자세히]` 닫힘이면 칩이 없어 요청도 0(펼칠 때 한 묶음) |
| 복습 종료 "다음 복습" 묶음 칩 `#r-end` | `review/NextReviewCard.tsx` 70~79행 — 15px `<span lang="ja">` | **R1-A**: 카드가 모든 묶음의 `found` 문장을 모아 `useAnnotations` 한 번 → `<span lang="ja">` 를 `JaText as="span" className="min-w-0 text-[15px] [overflow-wrap:anywhere]" leading={2.1}` + `HangulLine inline size={12}` 로. `li` 클래스·`FocusBadge small`·"외 N개" 그대로 |
| 복습 수업 ① "이번 복습 항목" `#r-items` | `review/ReviewItemsCard.tsx` `ReviewItemRow`(22~29행) — 17px leading 1.5 | 카드가 `useAnnotations(sorted.map(x => x.textJa))` 한 번(접힘이어도 요청 — 목록이 `hidden` 으로 DOM 에 있음). 일본어 자리 = `<span className="min-w-0">` 안에 `JaText as="span" className="block text-[17px] leading-[1.5] [overflow-wrap:anywhere]" leading={2.1}` + `HangulLine as="span" size={13}`. 종류 뱃지 위 여백 `mt-[5px]` → 루비 줄간격을 예약할 때(`showFurigana && hasKanji(textJa)` 이고 분석 loading·ready) **`mt-2`(8px)**. 뜻 14·기록 줄 12·집중 뱃지·접기 그대로. 파일 머리 주석의 "읽기 줄은 없다(Leader ③)"는 "읽기 줄 대신 히라가나·한글 층(task-033)"으로 고친다 |
| 복습 종료 "말하기에서 쓴 표현"·"다음엔 이 표현도" `#r-end` (S1-A) | `lesson/LessonEnd.tsx` 110~125행 `ExprChip`(층 없음) | `LessonEnd` 가 `useAnnotations([...used, ...missed].map(t => t.ja))` 한 번 → `<ExprChip … ann={…} />`(`ExprChip` 은 이미 `ann` 을 받는다 — 16px·줄간격 2.1·`[한글]` 12 인라인, §15-1 B 표현 칩). ✓ 꼬리·`tone="good"` 그대로. **일반 수업 종료 화면에도 같이 적용된다** |
| 복습 종료 머리 일본어 제목(`content.title`, 90행)·근거 상자 「」 | — | 달지 않음(머리줄·026 규칙 F) |

- 오늘 홈·복습 만들기·종료 화면에는 도구 줄이 없다 — 앱 설정을 따른다(표현 점검 화면과 같음). ① 이해 도구 줄 [히라가나][한글][번역](026 `StageUnderstand`)이 바로 아래에 있어 항목 카드도 그 값으로 바뀐다(파일 수정 없음).
- 복습 수업 ①~⑤ 문항 본문은 026 에서 이미 적용(같은 단계 컴포넌트) — 바뀌지 않음, ③ 읽기 문제 보호(§15-9 ②)도 그대로.
- 칩 높이 데모 실측: 히라가나 켬 약 40px, 길면 2줄(`[자세히]` 펼친 상태에서만).

#### 15-11-5. AI 평가 — 결과 (`#e-result-w`·`#e-result-t`, 서브태스크 A)

`eval/EvalResult.tsx` — 제출·채점 뒤라 **보호 없음**(키를 쓰지 않음), 앱 설정을 그대로 따른다. 도구 줄 없음. **번역 층 없음**. 공통 일본어 클래스 `JA`(27행, 17 · leading 1.7 · `whitespace-pre-wrap`)를 쓰는 블록은 `JaText`(클래스 그대로, 루비 줄간격 **2.1**) + `HangulLine size={13}`.

| 자리(현재 행) | 제안 |
|---|---|
| 들려준 말(179~181행 `textJa`) | `JaText` + `[한글]` 13 · [다시 듣기] 그대로 |
| 틀린 곳 찾기 "문장"(197~199행) | `JaText` + `[한글]` 13 |
| 내 답 — 용법(46~50행 `BlankSentence fill`) | `filledRange(sentenceJa, answerText)` → 채운 문장 한 블록 `JaText ranges=[{ 채운 말 범위, className: 'font-semibold underline decoration-2 underline-offset-[5px]' }]` + 채운 문장 전체 `[한글]` 13(빈칸 없음) |
| 내 답 — 읽기 쓰기(52~56행) · 정답 — 읽기(110~114행 `expected.reading`) | 가나만이라 히라가나 없음 · `[한글]` 13만 — 내가 쓴 읽기와 정답 소리 차이가 보임 |
| 내 답 — 조립(58~63행, 조각을 띄어 이은 문장) · 정답 — 조립(116~119행 `expected.order`) | 화면에 보이는 띄어 쓴 문자열 그대로 `JaText` + `[한글]` 13 |
| 내 답 — 듣고 답하기·상황 응답(84~91행) | `JaText` + `[한글]` 13 · "말로 답함/글로 답함" 줄 그대로 |
| 내 답 — 틀린 곳 찾기(조각 모드 66~76행 "고른 곳 · …" + 이유 글) | **달지 않음**(한국어 섞인 답 — 데모 `#e-result-t` 6번 "내 답" 상자) · 옛 문항(77~81행 자유 입력)도 한국어 이유가 섞일 수 있어 달지 않음(★ §15-11-7 ⓓ) |
| 정답 — 용법(103~108행) | 내 답과 같은 방식, 밑줄 `decoration-good` |
| 정답 — 고친 곳(127~139행 취소선·밑줄 한 줄) | `fixLineRanges(sentence, wrongSpan, correctedJa)` → 보이는 한 줄(앞 + 틀린 말 + `' '` + 고친 말 + 뒤)을 한 블록으로 분석해 `JaText ranges=[{틀린 말, 'line-through decoration-bad decoration-2'}, {고친 말, 'underline decoration-good decoration-2 underline-offset-[5px]'}]`(경계가 한자 묶음을 자르면 그 묶음만 히라가나 없음) · `[한글]` = **고친 문장(`expected.correctedJa`) 한 블록의 분석**(취소선 글자 소리 섞지 않음 — 교정 카드와 같은 원칙). 고친 말을 못 찾은 경우(140~144행 `correctedJa` 따로 한 줄)는 그 줄에 `JaText` + `[한글]` 13 · 설명(`explanationKo`) 그대로 |
| 정답 — 모범 답(152~154행) | `JaText` + `[한글]` 13 · **모범 답 아래 읽기 14px 줄(155~159행 `modelReading`) 삭제**(026 D2-B) · "이런 뜻이면 돼요" 그대로 |
| 정답 — 뜻 고르기·조각 분류(한국어) | 그대로 |
| 문항 줄 제목(244~260행 `· 注文`) · 선생님 한마디·피드백·다음에 집중할 것·영역별 점수 | 달지 않음(요약 줄·한국어 문장 속 「」) |

- 요청: `EvalResult` 마운트 때 `collectEvalTexts(items, { done: true })` 로 `useAnnotations` 한 번(캐시 데우기) — 문항을 펼칠 때 막대 없이 바로. 각 상세는 자기 문장을 다시 받는다(캐시 적중).
- 문항 펼침·접힘·[평가 기록][오늘로]·레벨 제안 카드 그대로.

#### 15-11-6. 생성/수정 파일 · 서브태스크 경계 · 구현 순서

공용 부품(`common/japanese/**`)·서버·`modules/**`·`api/**`·prisma 수정 0. 세 서브태스크는 서로 파일이 겹치지 않아 순서 무관(병렬 가능). 각 서브태스크 끝에 `npm run lint`·typecheck·관련 테스트.

| 서브태스크 | 파일(≤15) | 순서 |
|---|---|---|
| **A 평가**(6) | 1 `eval/displayGuard.ts`(신규) · 2 `eval/__tests__/displayGuard.test.ts`(신규) · 3 `eval/EvalItems.tsx` · 4 `eval/EvalRunner.tsx` · 5 `eval/EvalResult.tsx` · 6 `eval/evalCopy.ts`(★ 문구 1개) | ① 1·2(키 어간·히트 여러 개·겹친 조각 읽기 null·loading 예약·`blankParts` 없음/있음·조각 경계가 한자 묶음 가를 때·`fixLineRanges` 고친 말 없음·`collectEvalTexts` 가 P1 단어·숨긴 듣기 문장을 넣지 않음) → ② 4(키·도구 줄·캐시 데우기) → ③ 3(문항별 표 §15-11-2 B) → ④ 5(결과) → ⑤ 360/390/412 |
| **B 카드·결과**(3) | 1 `vocab/VocabDeck.tsx` · 2 `vocab/VocabCardFace.tsx` · 3 `vocab/WordResultList.tsx` | ① 1(덱 훅·props) → ② 2(뒷면 층 → C2 측정) → ③ 3 → ④ `#c-long` 360×780 뺌 확인 |
| **C 복습**(4) | 1 `lesson/review/TeacherWhy.tsx`(`ReviewChips`) · 2 `lesson/review/NextReviewCard.tsx` · 3 `lesson/review/ReviewItemsCard.tsx` · 4 `lesson/LessonEnd.tsx` | ① 1 → ② 2·4(같은 종료 화면 — 함께 확인) → ③ 3 |

- 데모 게이트 `approved`(v1) — 화면 파일 수정 가능. 기존 테스트(`lesson/__tests__/display.test.ts`·`common/__tests__/japaneseDisplay.test.ts`·`eval/__tests__/evalLogic.test.ts`) 회귀 0.
- 화면 코드에 `kanaToHangul`·`pronLine` 호출 0(§15-2 D, Reviewer grep) · `modelReading`·`prompt.reading` 을 **화면 글자로 그리는 곳 0**(루비 정렬 입력으로만).

#### 15-11-7. 데모와 다른 점 · Leader 확인 요청

| # | 데모 v1 | 가이드 | 이유 |
|---|---|---|---|
| ⓐ | 교차 보호 = 읽기 쓰기 **표기 전체**가 들어 있으면 | 표기의 **마지막 한자까지(어간)** 가 들어 있으면 · 가나 단어는 키 없음 | 활용형(`食べる` 문항 + `食べました` 보기)에서 `食` 위 히라가나가 정답 일부를 흘린다. 더 숨기는 쪽이라 정답 노출 0 원칙 강화 — 평소 문항엔 영향 없음 |
| ⓑ | 문항 넘길 때 요청 시점 미정 | 푸는 화면·결과 화면 마운트 때 한 묶음으로 캐시 데우기 | 문항마다 막대가 다시 뜨지 않게(§15-2 B 묶기) |
| ⓒ | 조립 결과 내 답·정답 미표시(접힌 행) | 띄어 쓴 조각 문장 그대로 층 | 결과 화면 "내 답·정답 = 히라가나 + [한글]" 규칙을 같은 문자열에 |
| ⓓ | 옛 틀린 곳 찾기(조각 없음) 결과 미표시 | 내 답은 층 없음 · 문장·고친 줄은 층 | 내 답에 한국어 이유가 섞여 분석 소리가 어색함("애매하면 숨김") |
| ⓔ | 고친 곳 줄 = 조각별 그림 | 보이는 한 줄을 한 번 분석 + 범위 겹치기 | 공용 `JaText ranges` 경로 하나로(026 교정 diff 와 같은 방식) |
| ⓕ | 칩(R1-A)이 두 층 끔일 때 모양 미표시 | 두 층 끔이어도 `truncate` 없이 줄바꿈(높이 32 유지 — `min-h-8`) | 같은 칩이 설정에 따라 말줄임/줄바꿈으로 바뀌지 않게 |

**Leader 확인 요청**: ① ⓐ 어간 키(권고: 이대로 — 사용자 승인 원칙 "정답 노출 0" 안의 구현 정밀화) · ② 평가 "내가 한 말" 상자 `aria-hidden` 은 현행 유지(데모 a11y Minor 1 — 층과 무관, 바꾸려면 별도 IMP).

#### 15-11-8. QA 체크리스트 — 360 / 390 / 412 × 높이 780 / 892 (데모 v1 "폭"·"높이"·"보기 › 현재 vs 제안"과 나란히)

모든 항목을 표시 (히라가나·한글) = (켬·켬)·(끔·끔)·(켬·끔)·(끔·켬) 중 최소 (켬·켬)·(끔·끔) + 번역 켬에서. 분석 지연(네트워크 느리게)·분석 장애(#24r `available:false` 또는 429) 각 1회.

1. **정답 노출 0(제출 전)** — 화면·스크린리더 모두, 네트워크는 아래 예외 1건 외 모두:
   - ★ 알려진 한계(QA I-1, Leader 수용 2026-10-05): 교차 보호 대상 문장(읽기 쓰기 단어가 든 다른 문항의 블록)은 그 블록의 다른 한자 층을 위해 읽기 분석 요청에 포함되고, 응답에 그 단어 읽기가 들어 있다(화면 층 0). 서버가 보호 키를 받아 응답에서 비우는 방식은 후속 후보.
   - 읽기 쓰기 문항 단어 위·아래 히라가나·`[한글]` 0(설정 4조합 전부), 안내 ★ 문구 원문 일치 · 둘 다 끔이면 안내 없음.
   - 같은 평가에 읽기 쓰기 단어(예 `注文`·`片付ける`)가 다른 문항(뜻 고르기 단어 상자·용법 빈칸 문장·용법 보기·조각 분류)에 나오면: 그 한자 위 히라가나 0 · 그 블록 `[한글]` 0 · 같은 블록의 다른 한자 히라가나는 보임. 활용형(`片付けました`)도 보호.
   - 듣고 답하기: [글자로 보기] 전 문장·히라가나·한글 0(막대만) · 누른 뒤 층 보임.
   - 문장 조립: 조각 `[한글]` 0 · 만든 문장 전체 소리 줄 0 · 조각 히라가나만.
   - 용법 빈칸 문장 `[한글]` 0.
   - 평가 화면(푸는 중·결과) 어디에도 번역 0(번역 켬이어도).
   - 결과 화면에서는 위 보호가 모두 풀려 내 답·정답·모범 답·들려준 말·문장에 층 보임.
2. **도구 줄(E2-A)**: 문항 카드 바로 위·시간 초과 띠 아래 · [히라가나][한글] 2개(번역 없음) · 알약 32 · **유효 터치 ≥44px**(실측 44 — QA L-1 정정) · 누르면 즉시 층 반영 + 토스트 문구(§15-5) · 회화방·수업·단어장 도구 줄·설정 스위치와 같은 값 · 780 높이 뜻 고르기에서 보기 4개가 첫 화면 안.
3. **층 크기**: 단어 상자 rt 13·루비 줄간격 1.8·`[한글]` 14 · 일본어 보기 17/2.1/12.5(보기 높이 ≈80) · 내가 한 말·글자로 본 문장·결과 칸 17/2.1/13 · 조립 조각 17/2.1 높이 44 그대로 · 틀린 곳 조각 18/2.1 높이 44 + 아래 문장 `[한글]` 13 · 카드 뒷면 표제어 22/rt 11/줄간격 2 + `[한글]` 13 · 예문 16/2.15 + `[한글]` 13 1줄 · 결과 목록 17/1.95 + 12.5(행 ≈80) · 복습 칩 15/2.1 + 12 인라인 · 항목 카드 17/2.1 + 13 · 표현 칩 16/2.1 + 12.
4. **지운 요소**: 평가 단어 상자 읽기 15px 줄 0 · 모범 답 아래 읽기 14px 줄 0 · 카드 뒷면 옆 읽기 칸 0 · 세트 결과 목록 옆 읽기 0.
5. **C1-A**: 앱 히라가나 끔 → 카드 뒷면 표제어 히라가나 **보임**(앞면은 카드 [あ 읽기] 규칙 그대로) · 앱 한글 끔 → 뒷면 `[한글]` 0 · 카드 [읽기] 끔이어도 뒷면 `[한글]`(한글 켬이면) 보임.
6. **C2-A**: `#c-long` 조건(데모 값 = 뜻 2줄·긴 예문) 360×780 에서 예문 `[한글]` 만 빠지고 번역 줄 잘림 0 · 그 밖 폭·높이에서 예문 `[한글]` 1줄 말줄임 보임 · 모든 조합 카드 안 잘림 0 · **카드를 끄는 동안(드래그) 측정 호출 0**(Performance 기록에서 레이아웃 강제 0 · 프레임 저하 없음) · 다음 카드로 넘어가면 다시 판정 · **2단계(§15-11-3 B6)**: 뜻 3줄 꽉 + 예문 2줄 + 번역 카드(CHOICE·FLIP) × 360/390/412 × 780 → 예문·표제어 `[한글]` 둘 다 빠지고 번역 잘림 0 · 표제어 히라가나 보임 · 같은 카드 892 에서는 예문 `[한글]` 만 빠지거나 안 빠짐(표제어 `[한글]` 보임).
7. **분석 상태**: 기다리는 중 = 줄간격 예약 + 막대(단어 상자·카드 표제어는 히라가나 먼저) · 채워질 때 높이 변화 ≤4px · 장애 = 히라가나 없이 본문(저장 읽기 루비는 보임)·`[한글]` 0·오류 문구 0·옛 읽기 줄 되살아남 0 · 장애 중 요청 폭주 0(§15-6 19).
8. **요청량**: 평가 푸는 화면 입장 #24r ≤2회, 문항 이동 재요청 0 · 결과 화면 입장 ≤2회 · 홈 복습 카드 `[자세히]` 닫힘이면 0 · 세트 결과 세 목록 같은 표기 중복 요청 0 · 두 층 끔이면 0.
9. **잘림·넘침**: 18화면 × 3폭 × 2높이 가로 넘침 0 · `truncate` 표제어(카드 뒷면·결과 목록) rt 윗부분 잘림 0 · 긴 칩 줄바꿈 정상 · 보기 버튼·조각 버튼 글자 잘림 0.
10. **터치 44px**: 도구 줄 토글 · 조립 조각 · 틀린 곳 조각 · 일본어 보기 · 결과 행 · 결과 목록 행(≥56) · [다시 듣기] — 층이 붙어도 히트 영역 줄지 않음.
11. **접근성**: 스크린리더가 rt 를 읽지 않고 "한글 발음: …" 을 읽음 · 보기 버튼 이름 = 일본어 + "한글 발음: …"(순서 유지) · 조각 버튼 `aria-label` 은 원문 그대로 · 토글 `aria-pressed` + ✓ · 포커스 링 · 다크 테마 명암비(`ink2` on `surface`·`surface2`·`accent-soft`·`good-soft`) ≥4.5 · `prefers-reduced-motion` 막대 멈춤.
12. **복사·저장**: 결과·카드·칩 길게 눌러 복사 → 히라가나·한글 섞이지 않음 · 평가 답 저장(#67) 본문에 층 글자 0(`answerText` 는 입력·원문 그대로).
13. **회귀**: 카드 앞면·회화방·채팅·수업 ①~⑤·단어장·설정 화면 변화 0 · 일반 수업 종료 표현 칩에 층(S1-A — 의도된 변경) · 평가 타이머·저장·제출 흐름 변화 0.
14. **엔진명 0**: 화면·응답·콘솔에 분석기·엔진 이름 0 · 화면 글자 '후리가나' 0.


## 16. task-045 주제·상황 관리 (T5 확정 가이드)

승인 데모: `docs/demo/task-045-improve-topic-scenario-manager-v2.html` (v2 — 2026-10-07 사용자 승인 "v2로 진행, D5=A, 변형=A, 위치=A, 화면=A, 재생성=A")

적용 토큰 이름: `ground` `surface` `surface2` `ink` `ink2` `ink3`(placeholder·장식만) `line` `accent` `accent-soft` `on-accent` `good` `good-soft` `bad` `bad-soft` — 새 색 없음. 뱃지: 「챌린지 n일째」 = `good`, 「기본」「내 주제」「✎ 내 버전」 = neutral(`warn`·`accent` 뱃지 글자 금지 — §1-1).

- **정본 순서**: 이 절(T5 확정, 2026-10-07 designer) > task-045 이력서 `## Designer 기록 (계속 — v2` 의 R1~R6·첫마디 흐름 > 같은 이력서 v1 가이드 §0~§11. API 는 `docs/design/api-contract.md` §1-5(#161~#179)와 `docs/design/topic-scenario-manager.md` — **코드(라우트 JSDoc)와 다르면 코드**. 화면 상태 이름은 데모 v2 `SCREENS`(S1~S12·A) 의 `vars` 이름을 그대로 쓴다(예 S4 `scfail`, S9 `seedEdited`).
- **만들지 않는 것**: 변형 B(연출 옵션, 데모 `B` 화면 전체)·`Chat.scenarioVariant`·「변형」 뱃지와 「원본 · {제목}」 메타(§16-8 L-2)·숨긴 항목의 「함께 돌아오는 수」.
- 엔진·모델명·「AI」 낱말 화면 0건 — 늘 「선생님」. 새 문구는 해요체, 셈은 「세요」(세다) 대신 「합쳐 n번까지예요」·「인정돼요」.

### 16-0. 이전 가이드(v1·v2) 대비 확정 변경점 — 실제 API 기준

| # | 항목 | 이전 가이드 | 확정 | 근거 |
|---|---|---|---|---|
| 1 | 주제 초안 응답 | #170 한 응답에 주제 + 상황 초안 2개 + `partial` | #170 = 주제 정보 + 기본 표현만. 상황 초안은 S4 도착 직후 **#166(본문 `topic:{title,titleJa}` 인라인)** 으로 따로 받는다 — 자동 1개 + [＋ 상황 하나 더 만들기](선택 1개) (§16-2 S4, 개수는 L-1) | `api-contract.md` #170·#166 [확실] |
| 2 | 저장 | 주제 + 표현 + 고른 상황 한 트랜잭션 | **#57(주제+표현, 한 트랜잭션) → 받은 id 로 #163 상황 하나씩**. 한 트랜잭션이 아니므로 S4 에 `partial`(주제만 저장됨) 상태를 새로 둔다 | #57·#163 [확실] |
| 3 | 주제 상세·출처 | 관리용 상세 API(origin·scenarioCount·activeChallenge) | 상세 API 없음 → **#56 `level=all` 목록에서 id 로 찾기**. 출처 = #56 `isSeed` + #179(`state:'COPIED'`·`copyId`), 주제별 상황 수 = #161 `topics[]`, 진행 중 챌린지 = #155 `status=ACTIVE&limit=1`(사용자당 1개) | `types/lesson.ts` `Topic`·`types/seedOverride.ts`·`challenge.md:166` [확실] |
| 4 | 글자·개수 상한 | 설명 300 · 기본 표현 8~12 | `TOPIC_SAVE_LIMITS`: 이름·일본어 이름 ≤20 · 설명 ≤120 · 표현 **8~20**(12 미만은 `CHUNKS_SHORT` 안내만) · 표현 일본어 ≤20 · 읽기 ≤40 **필수** · 뜻 ≤30 | `src/types/topicWrite.ts` [확실] |
| 5 | 서버 오류 문구 | 400 `message` 를 칸 아래에 그대로 | **서버 `message` 는 화면에 쓰지 않는다**(400 문구에 「을(를)」「은(는)」 병기 — QA b1 실측, `saveBody.ts:55`·`shape.ts:73`·`openingDraftSchemas.ts:135` [확실]). `field`+`reason`(+`details`)+문맥 → 화면 고정 문구(§16-7). 기존 상황 편집기 `serverProblems`·`genFailureOf`(`scenario/logic.ts:519·561`)도 같이 바꾼다(T5-5a) | QA b1 결함 후보 #2 |
| 6 | 내 버전 주제 | [기본으로 되돌리기]만 또는 「사본 삭제 + 원본 숨김」 가정 | [기본으로 되돌리기](#176 RESTORE — 내 상황이 기본 주제로 되돌아 붙음, 기본이 다시 보임)와 [내 버전 지우기](#173 DELETE — 내 상황 보관·연결 해제, **기본 주제는 내 목록에서 숨김 유지**) 둘 다. 결과가 달라 문구로 구분 | `types/topic.ts` `TopicRemovalMode` [확실] |
| 7 | 나가기 막기 | BackBar ← + 안드로이드 뒤로(`popstate`) | **BackBar ← 만** 확인 시트. 안드로이드 뒤로는 막지 않는다(초안은 sessionStorage 에 남고, App Router 에 막는 수단·선례 없음 — 기존 상황 초안 화면과 같다) | `ScenarioDraftScreen.tsx`·`BackBar.tsx` grep 0 [확실] |
| 8 | 변형 | 시트에 「변형」 뱃지·원본 메타 | 표시 없음(원본을 가리키는 칸은 미승인) — 변형으로 저장한 상황은 그냥 「내 상황」 | `topic-scenario-manager.md` §1 [확실] |

### 16-1. 레이아웃 설계 (page-layout-designer — v1 §0 유지, 바뀐 곳만)

- **목표·위계·영역·행동·반응형**: v1 §0 그대로(BackBar 52 + `main` 한 곳 스크롤 + `Sheet` 포털, 360/390/412).
- **상태 추가**: S2 `refreshing`(바꾼 뒤 다시 읽기 — 지금 목록 유지) · S4 `scgen`(상황 초안 오는 중 — 같은 높이 자리) · S4 `partial`(주제만 저장됨) · S8/S9 `loading`(#172 확인 중)·`changed`(409 새 미리보기) · S7 `copied`(다른 탭이 먼저 내 버전을 만듦) · 첫마디 7상태(v2 D) · A `rate`·`busy`·`baseGone`.
- **컴포넌트 확정**(재사용 우선): `Btn`·`Badge`·`Field`·`Segmented`·`Sheet`·`Toast`(common) · `Skeleton`·`ErrorBox`·`InfoBox`·`BtnLink`(challenge/parts) · `ScenarioCard`(상황 행 — 출처 뱃지 prop 1개 추가) · `ScenarioSheet`·`DraftEditor`·`PlaceChips`(scenario). 새로: `TopicRow` · `TopicInfoFields` · `ChunkEditor` · `ScenarioDraftCards`(S4 상황 칸) · `TopicRemovalSheet`(S8·S9 한 컴포넌트, `mode`) · `HiddenSeedSheet` · `LevelRegenBox`(D4-A) · `OpeningField`(공유 편집기 첫마디) · `VariantAxes`. v1 의 `DraftScenarioCard`·`TopicDeleteBody`·`RevertSheet`·`ScenarioRow` 는 위로 합쳐 만들지 않는다.
- **로딩**: 새 화면은 IMP-0027 원칙 — 같은 높이 정적 자리표시(`Skeleton heights`), 「아직 없어요」·가짜 CTA 금지. **다시 읽기(바꾼 뒤·되돌린 뒤)는 자리표시로 되돌리지 않는다**(R1) — `useKeyedResource` 의 `silent` 요청처럼 지금 값을 두고 바꾼다.

### 16-2. 화면별 확정 흐름

#### S1 설정 행 (위치=A) — `settings/page.tsx`
- 로그인 계정 `<section>` 바로 아래, `<LearningSettings />` 위에 `<ManageEntryRow />`(서버 컴포넌트, 추가 질의 0): 절 제목 「회화 연습」 + 56px 행 `Link href="/settings/scenarios"` — 1줄 「내 상황·주제 관리」(15px) · 2줄 「주제를 적으면 선생님이 상황 초안을 만들어요」(13px `ink2`) · 오른쪽 `›`(`aria-hidden`).
- `components/shell/routes.ts` `FOCUS_ROUTE_PREFIXES` 에 `'/settings/scenarios'` 추가 → 관리 화면 아래는 하단 탭·업데이트 띠 숨김(`/settings` 자체는 탭 보임).

#### S2 내 상황·주제 (화면=A, 분절) — `/settings/scenarios?tab=topics|scenarios[&sc=<id>]`
- **데이터(한 훅 `useManageData`, 네 요청 병렬 — 두 탭이 같은 값을 나눠 쓴다. Leader 제안의 두 훅 대신 하나: #161·#179 를 두 탭이 함께 써서 탭을 바꿀 때 다시 읽지 않으려고)**
  | 요청 | 쓰는 곳 | 실패 시 |
  |---|---|---|
  | #56 `GET /api/v1/topics?level=all` | 주제 탭 전부 | 화면 `ErrorBox`(필수) |
  | #179 `GET /api/v1/seed-overrides` | 출처 판정(내 버전 = `state:'COPIED' && !orphan` 의 `copyId`) · 숨긴 항목 수(`state:'HIDDEN' \|\| orphan`) | 화면 `ErrorBox`(필수 — 없으면 내 버전을 「내 주제」로 잘못 보임) |
  | #161 `GET /api/v1/scenarios?limit=100` | 상황 탭 · 주제별 「상황 n개」(`items[].topics[].id` 로 셈) | 상황 탭만 `ErrorBox`, 주제 행은 「상황 n개」를 빼고 「기본 표현 n개」만 |
  | #155 `GET /api/v1/challenges?status=ACTIVE&limit=1` | 진행 중 챌린지 뱃지(`items[0].topic.id`·`stats.dayIndex`) | 뱃지 생략(조용히) |
  - #161 은 `nextCursor` 가 있으면 이어 읽는다(내 상황 ≤50 + 시드라 한 쪽이 보통 [가능성 높음]).
  - 출처 규칙(`logic.ts` `topicOrigin`·`scenarioOrigin`, 단위 시험): `isSeed` → `SEED` · `!isSeed && copyIds.has(id)` → `COPY`(seedId 연결) · 그 밖 → `MINE`. 상황은 `isMine` 대신 같은 규칙(`!isMine` → `SEED`).
- **탭**: `Segmented`(「주제 n」|「상황 n」) ↔ `?tab` 동기 `router.replace(href, { scroll: false })`(선례 `ScenarioHome.tsx:56`). 탭 전환은 내용이 바뀌는 **의도된 이동**(R5)이지만 `main` 위치는 건드리지 않는다(분절 버튼이 맨 위에 있어 초점만 분절 버튼에 남음).
- **주제 탭**: `Btn`[＋ 주제 만들기](→ S3) + 한 줄 안내 + 「내 주제 n/30」(`tabular-nums`). n≥30 이면 버튼 `aria-disabled` + `aria-describedby` 로 「내 주제는 30개까지예요…」 → 절 「내가 만든 주제 n개」(`MINE`, 비면 점선 상자) → 절 「기본 주제 n개」(`SEED` + `COPY` — 내 버전은 ✎ 뱃지, 기본 뒤에 이름순) → (있으면) 「숨긴 기본 항목 n개 ›」 행(T5-2). 셈 n 은 `MINE`+`COPY`(서버 30개 한도가 사본을 포함 — `TOPIC_LIMITS.minePerUser` 주석 [확실]).
- **`TopicRow`**(버튼 전체가 `Link` → S6, 높이 ≥76): 1줄 제목(1줄 말줄임)+수준 뱃지+출처 뱃지(`flex-none`) · 2줄 `titleJa`(`lang="ja"`, 없으면 줄 생략 — 높이는 최소 76 유지) · 3줄 「상황 n개 · 기본 표현 n개」(`flex-wrap`) + 진행 중이면 「챌린지 n일째」.
- **상황 탭**: `Btn`[＋ 상황 만들기](→ `/study/ai/scenario/new?from=manage`) + 「내 상황 n/50」 → `PlaceChips`(전체·내가 만든·기본) → `ScenarioCard`(출처 뱃지: 내 상황 없음/「✎ 내 버전」/「기본」) → (있으면) 숨긴 항목 행. 행 탭 = `?sc=<id>` 를 `{ scroll: false }` 로 붙이고 `ScenarioSheet` 열기.
- 상태: `loading`(Skeleton [44, 76, 76, 76]) · `error` · `empty` · `scempty` · `limit` · `saved`(돌아왔을 때 토스트) · `hidden` · `restored`. **돌아왔을 때 토스트**: 다른 화면이 sessionStorage `kaiwa.manage.flash` 에 `{kind, title, counts}` 를 남기고 S2 가 마운트 때 한 번 읽어 지운다(제목을 URL 에 싣지 않으려고). 지우기 뒤 초점 = 「내가 만든 주제」 절 제목(`tabIndex=-1`).

#### S3 주제 만들기 — `/settings/scenarios/topics/new` (단계 `ask → generating`)
- 데모 S3 그대로: 「어떤 주제로 연습하고 싶어요?」 → `Field` 주제(input 16px, 2~40자 카운터) → 예시 칩 4개 → 수준 `Segmented`(`levelOptions(프로필 수준)` 재사용 — `DraftEditor.tsx:32`) + 「내 수준(N4)으로 골라 뒀어요」 → [초안 만들기] → 「초안은 저장하기 전까지 어디에도 남지 않아요」.
- 요청 **#170** `POST /api/v1/topics/drafts` `{title, level}`(`note` 칸은 화면에 없다). 벽시계 60초, 15초 넘으면 「조금 더 걸리고 있어요」 한 줄. [그만두기] = `AbortController` — **서버는 계속 돌아 그 사이 다시 누르면 409 `DRAFT_BUSY`**(한도도 1 소모 — QA b2 #2) → 그만둔 뒤 [초안 만들기]는 바로 누를 수 있게 두되 409 면 §16-7 문구.
- **더블 탭 방지**: 요청 중 버튼 `aria-disabled`+`aria-busy`, 폼 `aria-busy`·readOnly. 409 도 한도를 쓰므로 막는 것이 필수.
- **취소 잠금(구현이 확정)**: 시작 직후 800ms(`TOPIC_DRAFT_CANCEL_LOCK_MS`) 동안은 [그만두기]가 듣지 않는다 — 같은 자리 더블 탭이 곧바로 취소가 되지 않게(REV-160 M-3). 「조금 더 걸리고 있어요」 15초(`TOPIC_DRAFT_LONG_MS`)·벽시계 60초(`TOPIC_DRAFT_TIMEOUT_MS`).
- 오류(§16-7 `TOPIC_DRAFT`): 400 `title` → 칸 오류(고정 문구) · 422 `NOT_A_TOPIC` 한 문구 + 입력칸 초점 · 409 · 429(분/일) · 502·네트워크 → 상자 + [다시 만들기]. 사유 구분 표시 없음.
- 도착 → S4, 안내 제목에 초점(`tabIndex=-1`). sessionStorage `kaiwa.topic.draft`(300ms 디바운스, 하이드레이션 뒤 읽기) — 다시 들어오면 「고치던 주제 초안이 있어요」 카드 [이어서 고치기][버리고 새로 만들기].

#### S4 주제 초안 검토 (단계 `review → saving → partial`)
- 위에서부터: 안내(`role=note`, 도착 시 초점) → 「확인해 볼 곳 n가지 · 그대로 저장해도 돼요」(`warnings` 있을 때, v2 E 문구, 줄 누르면 그 칸 — R5) → 「주제 정보」(`TopicInfoFields`: 이름 /20 · 일본어 이름 /20 `lang="ja"` · 수준 · 설명 /120) → 「기본 표현 n개 · 8~20개」(`ChunkEditor` — 종류 4묶음, 행 = 일본어 16px `lang="ja"`·읽기 13px 상시·뜻 13px + ⋯ 메뉴 시트[고치기·위로·아래로·지우기], 고치기는 행 자리 펼침 + 보이는 이름표, 「읽기가 틀릴 수 있어요…」 안내) → **「상황 초안」 절(`ScenarioDraftCards`, 아래)** → 저장 줄.
- **상황 초안 — 요청 시점·순서·비용(L-1 권고안 A 로 설계)**
  1. 주제 초안이 도착하면 **곧바로 #166 1회 자동 요청**: `POST /api/v1/scenarios/drafts` `{ description: 주제 설명(없거나 5자 미만이면 「{이름} 상황에서 나누는 대화」), level: 초안 수준, topic: { title: 초안 이름, titleJa? } }` — `topicId` 는 보내지 않는다(아직 id 없음, 같이 보내면 400 `conflict`). 요청 본문 조립은 `logic.ts` `scenarioSeedDescription()`(단위 시험).
  2. 요청 중에는 절 머리 「상황 초안」 + 같은 높이(132px) 자리 카드 `role=status` 「선생님이 이 주제로 상황 초안을 만들고 있어요 · 보통 10~20초 걸려요. 그동안 위 표현을 먼저 고쳐도 돼요.」 + [그만두기]. **위쪽 칸 편집은 막지 않는다**(점진 도착). 도착하면 그 자리에 카드가 들어간다(높이 변화는 이 절 안에서만 — R2).
  3. 카드: 제목·역할·「첫마디 · {한국어}」/「첫마디 없음」·[고치기](→ S5) + 「이 상황도 저장」 체크(기본 켬). 절 머리 오른쪽 「저장할 상황 k/n」(`tabular-nums`). 체크 해제는 카드 흐림 + 체크만(R2·R1, scrollTop 차 0).
  4. 카드 아래 [＋ 상황 하나 더 만들기] → 같은 자리에 펼침: `Field` 「어떤 상황을 하나 더 만들까요?」(5~300자) + [상황 초안 만들기] → #166 같은 모양(`description` = 적은 글). **최대 2개**(데모 「n/2」 유지) — 2개가 되면 이 줄을 숨긴다.
  5. **순차만**: #166 은 사용자당 동시 1건(409 `DRAFT_BUSY`)이라 병렬 금지 — 자동 요청이 도는 동안 [하나 더] 버튼 `aria-disabled`(이유 연결 「앞 상황 초안을 만드는 중이에요」).
  6. 비용: 주제 하나당 선생님 호출 **기본 2회**(#170 1 + #166 1), 최대 3회. #166 은 하루 40(변형 #177 과 같은 카운터)·분당 6 을 쓴다.
  7. 실패: 502·504·네트워크 → 절 안 `ErrorBox` 「상황 초안은 만들지 못했어요. 주제만 저장하고 상황은 나중에 만들 수도 있어요.」 + [다시 만들기] (데모 `scfail`) · 422 `NOT_A_SCENARIO` → 「이 주제로는 상황 초안을 만들기 어려워요. 아래에 상황을 한 줄로 적어 다시 만들어 보세요.」 + 4번 입력 펼침 · 429·409 → §16-7. **어떤 실패도 주제 저장을 막지 않는다**(저장 버튼 「주제만 저장」).
  8. 주제 이름을 상황 초안 도착 뒤에 고쳐도 이미 받은 상황 초안 글은 바뀌지 않는다(저장 때 장소 연결은 새 주제 id 로 맞음) — 안내하지 않는다(P2, §16-9).
- **S5 상황 초안 고치기**: 카드 [고치기] → `?step=sc0|sc1` 를 `router.push(…, { scroll: false })` 로 붙여 같은 경로의 단계(안드로이드 뒤로 = S4 복귀). BackBar 「주제 초안」 + `DraftEditor` 그대로, 장소 칸만 `placesFixed={{ title: 주제 이름 }}` → 칩 대신 정적 글 「장소 · {이름} (저장할 때 이 주제에 이어져요)」. [완료] 는 S4 카드 값만 바꾼다(서버 0). 돌아오면 **S4 의 들어가기 전 `main.scrollTop` 을 되살리고 그 카드의 [고치기]에 초점**(R5 의도된 이동).
- **상황 만드는 중 표시(구현이 확정)**: 상황 초안을 만드는 동안(자동 요청·[하나 더]) 카드 영역에 같은 높이(132px) 자리 카드 `role=status` 가 서고, 저장 줄 위 한 줄은 `saveOrder` 를 유지한다(`saveNoteActive`) — 이때 「저장할 상황이 없어요.」는 보이지 않는다. 체크 `aria-label` 은 「{n}번째 상황 {제목} 이 상황도 저장」(보이는 글은 그대로).
- **저장(순서·부분 실패 — 한 트랜잭션 아님을 정직하게)**
  1. 저장 전 화면 검사: 주제 칸·표현(`TOPIC_SAVE_LIMITS`) + **체크한 상황 카드마다 `validateDraft`**(첫마디 맞추지 않음 포함). 문제가 있으면 저장 버튼 위 「고칠 곳이 n군데 있어요」 + 첫 문제로 이동(R5) — 상황 카드 문제는 그 카드의 「고칠 곳 n군데」 줄에 초점. **검사로 막을 수 있는 실패는 서버에 보내기 전에 막는다**(부분 실패를 줄이려고).
  2. 저장 버튼 글자: 체크 k>0 → 「주제와 상황 k개 저장」, 아니면 「주제만 저장」. 버튼 아래 한 줄 「주제를 먼저 저장하고, 고른 상황을 하나씩 저장해요.」
  3. **#57** `POST /api/v1/topics` `{title, titleJa, level, description, chunks[]}`(`chunks[].id` 없음). 진행 표시 `role=status` 「주제를 저장하고 있어요…」. 실패 → 아무것도 저장되지 않음(주제+표현은 한 트랜잭션 [확실]) → 「저장하지 못했어요. 아무것도 저장되지 않았어요. 다시 눌러 주세요.」 또는 §16-7 칸·한도 문구. 화면 그대로.
  4. 성공(201 `topic.id`) → **즉시 sessionStorage 초안에 `savedTopicId` 기록**(새로 고침·재시도 때 주제를 두 번 만들어 하루 10·내 주제 30 을 쓰지 않게).
  5. 체크한 상황마다 **순서대로** #163 `POST /api/v1/scenarios`(초안 + `topicIds: [topic.id]`) — 「상황 1/2 저장 중…」. 병렬 금지(분당 20 `scenario-write`·사용자 잠금).
  6. 전부 성공 → `router.replace('/settings/scenarios/topics/<id>')`(S6) + 토스트 「「{이름}」 주제를 저장했어요 · 상황 k개도 저장했어요」 + sessionStorage 초안 삭제.
  7. **일부 실패 → `partial`**: 화면 맨 위 상태 상자(`role=alert`, 초점) 「주제는 저장했어요」 + 「상황 m개는 저장하지 못했어요. 주제와 상황은 따로 저장돼요.」 + 실패한 상황 제목과 이유 한 줄씩(§16-7 `SCENARIO_SAVE`) → [상황 다시 저장](실패한 것만 #163 재시도) · [주제 보기로](남은 초안이 있으면 확인 시트 「저장하지 못한 상황 초안 m개는 사라져요」). 주제 정보·표현 칸은 읽기 전용으로 바꾸고 「주제는 저장됐어요. 주제를 고치려면 주제 보기에서 고쳐요.」. 실패 이유가 `SCENARIO_LIMIT`(50)·`DAILY_LIMIT`(하루 30)이면 [상황 다시 저장]을 `aria-disabled` + 이유. 400 칸 문제면 그 카드 [고치기]로 안내.
- 나가기: BackBar ← 에서 고친 내용이 있으면 나가기 시트(데모 `leave`), [버리기]는 확인 시트(`discard`), [다시 만들기]는 아래로 열리는 인라인 확인(R3, 위로 0px).
- **저장 중 ←(구현이 확정)**: S4 와 S7 모두 저장 중에는 ← 가 `aria-disabled`(`BackBar backDisabled`)이고 누름은 무시된다(나가기 시트도 안 열린다). 안드로이드 하드웨어 뒤로는 막지 않는다(§16-0 #7). REV-164 L-1·REV-166 L-D.

#### S6 주제 보기 — `/settings/scenarios/topics/[id]`
- 데이터(`useTopicDetail`): #56 `level=all` 에서 `id` 찾기 · #179 `kind=TOPIC` · #155 ACTIVE · #161 `?topicId=<id>&limit=100`. #56 에 없으면 「이 주제를 찾을 수 없어요 · 지워졌거나 내 목록에서 숨긴 주제예요.」 + [내 상황·주제로](숨긴 시드를 id 로 직접 연 경우 포함).
- 출처별:
  | 출처 | 상태 상자(`InfoBox`) | 머리 오른쪽 | 맨 아래 글자 버튼 |
  |---|---|---|---|
  | `MINE` | 없음 | [고치기] → S7 | [주제 지우기] → S9(delete) |
  | `SEED` | 「기본 주제예요. 고쳐서 저장하면 내 버전이 생기고, 내 목록에는 내 버전이 대신 보여요.」 | [고치기] → S7(seed) | [나에게서 숨기기] + 아래 「나에게만 숨겨지고, 다시 볼 수 있어요」 → S9(hide) |
  | `COPY` | 「✎ 내 버전이에요 · {#179 `updatedAt` M월 D일}에 만들었어요」 + [기본으로 되돌리기] → S8 | [고치기] → S7 | [내 버전 지우기] + 아래 「내 버전을 지우면 기본 주제도 내 목록에서 숨겨져요」 → S9(copyDelete) |
- 진행 중 챌린지 카드(#155 `items[0].topic.id === id`): 「「{챌린지 제목}」 챌린지 {dayIndex}일째 · {lengthDays}일」 + `ULink` 「챌린지 보기 ›」(`/plan/challenge/<id>`).
- 「기본 표현 n개」(종류 4묶음, 읽기 전용, 일본어 16px `lang="ja"`) → 「이 주제의 상황 n개」(`ScenarioCard` → 같은 화면 위 `ScenarioSheet`, `?sc=`) + [＋ 이 주제로 상황 만들기](→ `/study/ai/scenario/new?from=manage&topicId=<id>` — 장소 미리 고르기는 T5-5a).
- **로딩 자리표시(코드 우선 — QA-F·REV-168)**: 출처 안내 상자의 유무가 주제마다 달라(MINE 은 없음) 자리표시 모양을 출처로 고른다. 관리 화면 목록·저장/되돌리기/고치기 뒤 이동 링크가 **출처 힌트 `?o=m|s|c`**(MINE·SEED·COPY)를 싣고, 페이지는 **허용 값 외는 무시**해 `TopicDetail` 에 넘긴다 — **자리표시 선택에만** 쓰고 도착하면 #56·#179 데이터로만 판정한다. 힌트 없음(직접 주소·새로 고침)은 SEED 모양이 기본. 표현 절 시작 위치(콘텐츠 기준, BackBar 52 + 본문 `pt-3` 12 더하면 절대값): MINE 208.5 · SEED 283.5 · COPY 308(상자 87.5 = `py-3` 24 + 제목 19.5 + 버튼 줄 44, 제목이 한 줄이라는 가정 — 실측은 QA). 머리 카드(설명 길이)·진행 중 챌린지 줄은 자리표시로 맞출 수 없는 한계. **알려진 한계(QA-G 실측)**: 힌트가 없는 진입 — 직접 주소·새로 고침·상황 시트를 연 상태(`topicSheetHref` 가 `o` 를 뗌)·외부 링크 — 은 SEED 모양이라 MINE 은 표현 절이 283.5→208.5(−75px)·COPY 는 283.5→308(+24.5px) 움직인다. 힌트가 붙는 곳: 관리 화면 목록 행·되돌린 뒤 이동(`SEED`)·주제 고치기 저장/나가기/[내 버전 열기]·**주제 만들기 저장 뒤 이동(`MINE`, `useTopicDraft.finishSaved`)**.
- 저장·되돌리기 뒤 돌아오면 `silent` 다시 읽기(R1).

#### S7 주제 고치기 — `/settings/scenarios/topics/[id]/edit`
- S4 의 `TopicInfoFields`·`ChunkEditor` 재사용(표현 행은 `id` 를 들고 있음).
- 저장: `MINE`·`COPY` → **#171** `PATCH` 바뀐 칸만(`chunks` 를 보내면 전체 목록, 기존 표현은 `id` 포함 — 글이 바뀐 표현은 서버가 새 id) · `SEED` → **#174** `POST /topics/<seedId>/fork` 고친 전체 값, 버튼 「내 버전으로 저장」(취소하면 서버 0 — 사본은 저장 때만 생김). 바뀐 게 없으면 서버를 부르지 않고 S6 으로.
- 성공: `MINE`·`COPY` → S6(같은 id) + 「저장했어요」 · `SEED` → **새 사본 id 의 S6** 로 `replace` + 「내 버전으로 저장했어요」(시드 id 는 이제 목록에 없다).
- **D4-A(재생성=A)**: 수준을 바꾸면 수준 칸 바로 아래 `role=status` 상자 「수준을 바꿨어요 ({이전} → {새}). 기본 표현도 새 수준에 맞게 다시 받을까요?」 + 작은 글 「받은 표현은 저장해야 바뀌어요. 새로 받은 표현은 연습 기록이 처음부터 쌓여요.」 + [표현 다시 받기][지금 표현 두기]. [표현 다시 받기] = **#170** `{title: 지금 이름, level: 새 수준}` → 응답의 `chunks` 만 편집기에 넣는다(이름·설명은 그대로, `warnings` 중 표현 관련만 「확인해 볼 곳」). 받는 중 같은 상자 안 스피너(R6, 상자 밖 높이 고정). 실패 → 상자 안 「표현을 받지 못했어요. 지금 표현은 그대로 있어요.」. #170 한도(분당 6·하루 20)를 쓴다는 점은 §16-7 문구로만.
- 오류: 409 `ALREADY_COPIED`(#174, 두 탭 경쟁) → 상자 「다른 화면에서 이미 내 버전을 만들었어요. 여기서 고친 내용은 저장되지 않았어요.」 + [내 버전 열기](#179 다시 읽어 그 시드의 `copyId` S6) · 404 `TOPIC_GONE`/`SEED_NOT_FOUND` → 찾을 수 없음 상태 · 400 `chunks[i].id` `not_found` → 「다른 곳에서 바뀐 표현이 있어요. 화면을 새로 고친 뒤 다시 고쳐 주세요.」 · 409 `USE_FORK`(시드인데 #171 — 목록이 낡음) → 다시 읽어 `SEED` 모드로 바꾸고 「기본 주제라 내 버전으로 저장돼요. 다시 눌러 주세요.」 · 429 `DAILY_LIMIT`(#174 는 #57 과 하루 10 공유) → 「오늘은 주제를 10번 저장했어요(내 버전 만들기 포함). 내일 다시 저장할 수 있어요.」

#### S8·S9 되돌리기·지우기·숨기기 확인 — `TopicRemovalSheet`(`mode`)
| mode | 여는 곳 | 미리보기 | 실행 | `ack` |
|---|---|---|---|---|
| `delete` | S6 `MINE` [주제 지우기] | #172 맨 위 값(= `delete`) | #173 `DELETE /topics/<id>?ack=` | 필수 |
| `copyDelete` | S6 `COPY` [내 버전 지우기] | #172(사본 id) 맨 위 값 | #173(사본 id) | 필수 |
| `restore` | S6 `COPY` [기본으로 되돌리기] | #172(사본 id) `restore` | #176 `{kind:'TOPIC', seedId, ack}` | 필수 |
| `hide` | S6 `SEED` [나에게서 숨기기] | #172(시드 id — `isSeed:true`, 진행 중 챌린지만 읽음) | #173(시드 id, `ack` 무시 — `none` 을 보낸다) | 무시 |
- **열기**: 시트가 열리면 `loading`(시트 본문 Skeleton, 실행 버튼 `aria-disabled` + 「확인하는 중…」) → #172 → `ready`. #172 실패 → 시트 안 오류 + [다시 시도], 실행 버튼은 계속 막음. 404 → 「이 주제는 이미 지워졌어요.」 → 시트 닫고 S2 로 `replace` + 다시 읽기.
- **본문**(데모 S8·S9 그대로, 값만 #172 에서): 진행 중 챌린지가 있으면 경고 상자(테두리 `bad` 1.5px + `bad-soft` + ⚠ + 굵은 「진행 중인 챌린지가 있어요」 + mode 별 본문 §16-6) → 「함께 지워져요」(`scenariosArchived` n개 + 제목, 진행 중 챌린지) → 「그대로 남아요」(**「완료한 챌린지 기록은 그대로 남아요」**는 `finishedChallenges>0` 일 때만 · `scenariosUnlinked` 「다른 주제에도 있는 상황 n개 — 이 주제와의 연결만 빠져요」 · 「수업·단어 기록과 단어장」) / `restore` 는 「기본 주제로 되돌아가요」(`restore.scenariosRelinked` 「내 상황 n개는 기본 주제에 다시 이어져요」). 괄호 보충은 `.sub` 줄로 내린다(v1 P2-2).
- **실행 버튼 글자**: 진행 중 챌린지 있으면 「챌린지까지 지우기」/「챌린지까지 되돌리기」, 없으면 「주제 지우기」/「내 버전 지우기」/「기본으로 되돌리기」/「나에게서 숨기기」. 순서 실행 → [취소], 실행은 `bad` 테두리. 진행 중 `dismissible={false}`·두 버튼 `aria-busy`/`aria-disabled`.
- **409 `IMPACT_CHANGED`**: 응답 `details.preview` 로 본문을 **다시 그리고**(`restore` 는 `preview.restore`), 맨 위에 `role=alert` 「확인하는 사이에 바뀐 내용이 있어요. 아래 내용을 다시 확인하고 눌러 주세요.」 + 그 줄에 초점. **자동으로 다시 보내지 않는다 — 사용자가 다시 눌러야 지워진다**(새 `ack` 사용). 버튼 글자도 새 미리보기로.
- **성공**: 결과 숫자는 **응답 값**(`TopicRemovalResult`)으로 만든다(미리보기 아님 — `ack` 는 진행 중 챌린지만 덮어 상황 수가 바뀌어도 409 가 안 난다, 알려진 한계). `delete`·`copyDelete`·`hide` → S2 `replace` + flash 토스트 · `restore` → **시드 id 의 S6** 로 `replace` + 「「{이름}」 주제를 기본으로 되돌렸어요」.
- **실패**: §16-7 `TOPIC_REMOVAL`. 한 트랜잭션이라 「아무것도 지워지지 않았어요」가 참이다([확실] — `topic-scenario-manager.md` §4).

- 시트 접근성(구현이 확정, REV-161): 확인 시트는 `Sheet describedBy` 로 본문(`descId`)을 대화상자 설명에 연결해, 열리면 제목과 함께 무엇이 바뀌는지 읽힌다.

#### 숨긴 기본 항목 — `HiddenSeedSheet`(S2 맨 아래 행)
- 목록 = #179 의 `state:'HIDDEN'` 또는 `orphan:true` 항목(탭의 종류로 거름). 줄 = 종류 뱃지(「주제」/「상황」) + `seedTitle`(null 이면 「이름을 알 수 없는 기본 항목」) + [다시 보기].
- [다시 보기] = #176 `{kind, seedId}`(ack 없음 — `HIDDEN`·`ORPHAN` 경로는 override 만 지움 [확실]) → 그 줄만 「다시 보이게 했어요」로 바뀌고(R1, 시트 스크롤 0px) 닫으면 S2 `silent` 다시 읽기. 404 `NOT_OVERRIDDEN` → 이미 돌아온 것으로 보고 같은 처리.
- 숨긴 시드로 진행 중인 챌린지가 있어도 계속된다(§0 #9) — 이 시트에서는 따로 말하지 않는다(숨길 때 S9 `hide` 문구가 알림).

#### S10 상황 시트 행동 줄 — `ScenarioSheet` 확장(회화 탭·관리 화면 공용)
| 출처(판정: `isMine` + #179 `kind=SCENARIO`) | 행동 줄(44px 글자 버튼) | API |
|---|---|---|
| 내 상황(`MINE`, 변형 저장본 포함) | [고치기] · [변형 만들기] · [지우기] | #164(편집 화면) · A(#177) · #165 → `ARCHIVED` |
| 기본(`SEED`) | [고치기] · [변형 만들기] · [나에게서 숨기기] | #175(편집 화면에서 저장 때) · #177 · #165 → `HIDDEN` |
| 내 버전(`COPY`) | [고치기] · [변형 만들기] · [기본으로 되돌리기] | #164(사본) · #177(사본 id) · #176 `{kind:'SCENARIO', seedId}` |
- 행동 줄은 상세(#162)와 #179 가 **둘 다** 온 뒤에 한 번에 그린다(늦게 붙는 버튼으로 줄이 밀리지 않게, 자리 높이 44px 고정).
- 숨기기·되돌리기 확인은 기존 「지우기」 인라인 확인 자리(`confirmDel` 패턴, 아래로 열림 — R3)를 재사용, 문구 §16-6 `SHEET`. 성공 → `onDeleted`(목록 다시 읽기) + 토스트, 실패 → 그 자리 문구.
- 내 버전 상황에는 [지우기]를 두지 않는다(데모 S10 `edited` — 지우면 시드까지 숨겨져 사라지는 결과가 헷갈려서 [기본으로 되돌리기]만).
- 시작 버튼·이어서 하기 등 나머지 시트는 그대로.

#### S11 상황 고치기(기본 상황 포함) — 기존 `/study/ai/scenario/[id]/edit[?from=manage]`
- 지금의 시드 404(`useScenarioDraft.ts:115` `!detail.data?.isMine` → gone)를 없앤다: `SEED` 면 `InfoBox` 「기본 상황이에요. 고쳐서 저장하면 내 버전이 생기고, 내 목록에는 내 버전이 대신 보여요.」 + 저장 「내 버전으로 저장」 = **#175** `POST /scenarios/<seedId>/fork`(본문 = `draftPatch` 바뀐 칸만, 빠진 칸은 시드 값). 바뀐 게 없으면 서버 0, 돌아가기만.
- 성공 → 사본 id 로 돌아가기(`?sc=<copyId>&saved=1`) + 「내 버전으로 저장했어요」. 409 `ALREADY_COPIED` → S7 과 같은 상자 + [내 버전 열기]. 400 `topicIds[i]` `not_linked` → 장소 칸 오류 「지금 목록에 없는 장소예요. 목록을 새로 고친 뒤 다시 골라 주세요.」
- `from=manage`: BackBar 뒤로 = `/settings/scenarios?tab=scenarios`, 라벨 「내 상황·주제로」, 저장 뒤 같은 곳 `&sc=<id>&saved=1`. `from` 없으면 지금처럼 회화 탭.
- 새 상황 `?topicId=<id>`(S6 [＋ 이 주제로 상황 만들기]): 묻기 단계 장소 칩을 그 주제로 미리 고른다(목록에 없으면 무시).

#### 공유 편집기 첫마디 — `OpeningField`(S5·S11·A·회화 탭 새 상황/고치기 공통, D5=A)
- `fieldset`「선생님 첫마디」: ① `textarea` 「한국어로 적어요」 16px, 80자 카운터, 힌트 「역할극을 시작할 때 선생님({tutor} 역할)이 나에게 먼저 건네는 말을 적어요. 비워 두면 첫마디 없이 내가 먼저 말을 걸어요.」 ② 읽기 상자(`aria-live="polite"`, 최소 높이 92px, 일본어 `lang="ja"` 16px + 읽기 13px + ▶ 들어 보기) ③ 버튼 줄 [일본어로 만들기 | 일본어 다시 만들기 | 그만두기].
- **상태 판정(`logic.ts`, 단위 시험)**: 편집 값 `opening = { ko, ja | null, koAtJa | null, reading | null }`. `ko.trim()===''` → `none`(저장 = `opening: null`, #164 는 첫마디 지움 [확실 — T1-3 결정 7]) · `ja===null` → `koOnly`(저장 막음) · `ko.trim() !== koAtJa` → `stale`(저장 막음, 예전 일본어 줄 긋기 + 「예전 한국어로 만든 일본어」 이름표) · 그 밖 → `matched`. 상세(#162)에 `opening` 키가 없으면 `none`, 있으면 `{ko, ja, koAtJa: ko}` 로 `matched`. AI 초안(#166·#177) 도 `matched` 로 시작.
- **요청 #178** `POST /api/v1/scenarios/openings/draft` `{ ko, scenario: { title, titleJa?, goal: 목표 문장, placeTitle?, level, roles: { learner, tutor } } }` — **지금 편집 중인 값**으로(저장 전). 역할 둘 중 하나라도 비면 [일본어로 만들기] `aria-disabled` + 이유 「역할을 먼저 적으면 일본어로 만들 수 있어요.」(400 `scenario.roles` 를 보내지 않으려고). 성공 → `{ja, reading}` 넣고 `koAtJa = ko.trim()`. `warnings: JA_TRUNCATED` → 상자 안 「일본어가 길어서 줄였어요. 뜻이 다 담겼는지 확인해 주세요.」 · `READING_DROPPED` → 읽기 줄만 숨김. 읽기는 저장하지 않는다(Leader ④) — 저장·다시 연 뒤에는 읽기 줄 없음.
- **학습자 글 오수용 대비(QA b1 #1 — 코드가 막지 못함)**: `matched` 상자 일본어 아래에 늘 「선생님({tutor} 역할)이 먼저 건네는 말이 맞는지 확인해 주세요. 내가 할 말이면 첫마디가 아니라 대화 순서에 적어요.」(13px `ink2`). 체크 상자·확인 시트는 두지 않는다(매번 저장을 막는 마찰 대비 효과가 낮다 [가능성 높음]). 근본 수정은 PE(L-6).
- 저장 막힘: 저장 버튼 위 「고칠 곳이 1군데 있어요 · 선생님 첫마디」 + 칸 `aria-invalid` + `bad` 테두리 + 「저장하려면 일본어 첫마디를 다시 만들어 주세요.」(`stale`)/「저장하려면 [일본어로 만들기]를 눌러 주세요.」(`koOnly`) + 그 버튼 초점(R5). 한국어를 원래 글로 되돌리면 다시 `matched`.
- 생성 중 한국어 칸 readOnly, [그만두기] = abort(서버는 계속 — 곧바로 다시 누르면 409, §16-7). 결과가 와도 그 칸 안만 바뀌고 초점은 누른 버튼(R6).
- **취소 잠금(구현이 확정, REV-160 M-3)**: 시작 뒤 800ms(`OPENING_CANCEL_LOCK_MS`) 동안 [그만두기]가 듣지 않는다(같은 버튼 더블 탭). 벽시계 30초(`OPENING_TIMEOUT_MS`).
- **기존 편집기 변경 범위**: `DraftEditor.tsx:186` 의 「첫마디가 있을 때만 일본어 칸 + 뜻 칸」 → 늘 보이는 `OpeningField`. 회화 탭의 새 상황(#166)·고치기 화면도 함께 바뀐다(Leader 결정 ①, 승인된 material 변화).

#### A 변형 상황 만들기 — `/study/ai/scenario/[id]/variant[?from=manage]`
- 진입: S10 [변형 만들기]. 기준 상황은 경로 id(내 상황·보이는 시드·내 버전). 404 → 「원본 상황을 찾을 수 없어요. 지웠거나 내 목록에서 숨긴 상황이에요.」 + 돌아가기.
- 위: 원본 요약 `InfoBox`(제목·역할·수준) → 「무엇을 바꿔 볼까요?」 「하나 이상 골라 주세요. 고르지 않은 것은 원본 그대로예요.」 → `VariantAxes` = `fieldset`+`legend` 4개, 칩 `radiogroup`. **축·라벨은 `src/types/scenarioVariant.ts` `SCENARIO_VARIANT_AXIS_KEYS`·`SCENARIO_VARIANT_AXIS_LABELS` 를 그대로 import**(화면에 복사 금지 — 서버 검사와 같은 단일 출처). 표현 수준만 화면이 수준 글자를 붙인다: `same` 「그대로(N5)」 · `up` 「한 단계 위(N4)」(`raiseJlptLevel`). **기준이 N1 이면 `up` 칩 `aria-disabled` + 「이미 가장 높은 수준이라 올릴 수 없어요.」**(서버는 `same` 으로 접는다).
- 「직접 적기(선택)」 `textarea` ≤100(`SCENARIO_VARIANT_NOTE_MAX`) — 저장 값에 들어가지 않는다는 안내는 두지 않는다(학습자에게 의미 없는 내부 사실).
- [변형 초안 만들기]: 축이 전부 `same`/`none` 이면 `aria-disabled` + 이유 「바꿀 점을 하나 이상 골라 주세요.」(`SCENARIO_VARIANT_NO_CHANGE_MESSAGE` 와 같은 글 — 서버 422 `NO_VARIATION` 은 한도를 쓰지 않지만 화면이 먼저 막는다). note 만 적고 축을 안 고른 경우도 같다(서버 `no_change`).
- 요청 **#177** `{axes, note?}` → 만드는 중 `role=status` 「선생님이 변형 상황 초안을 만들고 있어요 · 보통 10~20초 걸려요.」(QA b2 p95 21.4s — 20초 넘으면 「조금 더 걸리고 있어요」) + [그만두기].
- **만드는 중(구현이 확정)**: 표시(`role=status`)는 [변형 초안 만들기] **바로 아래**에 서고(데모는 맨 위 카드 — **코드 우선**: 누른 버튼은 제자리라 버튼 `top` 변화 0px, 초점이 남는다 R6), 같은 버튼이 [그만두기]가 된다. 검토 단계도 같다 — 표시·실패 상자는 [다시 만들기] **아래**(위에 끼면 누른 버튼이 밀린다). 선택 단계의 실패 상자도 버튼 아래이고, 축 위에 서는 두 가지(바꿀 점 없음·만들기 어려움)는 다시 만드는 동안 그대로 둔다(사라지면 버튼이 올라간다). 「조금 더 걸리고 있어요」 20초(`VARIANT_LONG_MS`)·벽시계 60초(`VARIANT_TIMEOUT_MS` — 넘으면 일반 실패 + [다시 만들기])·시작 뒤 800ms(`VARIANT_CANCEL_LOCK_MS` = `OPENING_CANCEL_LOCK_MS`) 동안 [그만두기]가 듣지 않는다. ← 는 초안이 있는 검토 단계에서만 버리기 확인을 연다.
- **검토 안내 문단(데모 v2 `:957` 복원, REV-165 M-2)**: `바꾼 것 · {고른 축 글자들}. 「바뀜」 칸을 확인하고 [새 상황으로 저장]해야 생겨요. 원본은 그대로예요.` — 축 글자는 칩 글자(`axisOptions`, 수준은 「한 단계 위(N4)」)를 성격·돌발·흐름·수준 순서로, 기준이 N1 이면 `up` 은 적지 않는다(서버가 `same` 으로 접는다). 직접 적은 글은 싣지 않는다 — 축 없이 직접 적기만으로는 요청이 나가지 않으므로(데모도 같다) 「바꾼 것 · 직접 적은 내용」 은 없다. 함수 `variantReviewBody`(`variantLogic.ts`).
- 검토: `DraftEditor` + **`changed={changedFields}`** → 해당 칸 라벨 옆 「바뀜」 글자 꼬리표(색만 쓰지 않음, 화면 읽기용 「원본에서 바뀌었어요」). 칸 대응: `title` 제목 · `roles` 역할 · `goal` 목표 · `successCriteria` 성공 조건 · `steps` 대화 순서 · `keyExpressions` 핵심 표현 · `opening` 선생님 첫마디 · `level` 수준. `changedFields` 에 없는 칸은 표시하지 않는다(설명은 늘 원본 그대로 — 표시 없음).
- [새 상황으로 저장] = **#163**(응답 `draft` 그대로 + 고친 값, `topicIds` 는 응답 값) → 그 상황 시트 `saved`. 저장 줄 위 「새 상황은 내 상황 50개·하루 만들기 30번에 들어가요.」
- 비서비스 기준(자기소개·길 묻기·여행·주말)의 `unavailable`·`trouble` 칩도 **막지 않는다**(REV-153 L-5 → designer 결정: QA b2 에서 비서비스 기준 19/19 장소·목적 유지, 부분 반영 3/32 는 품질 문제이고 검토 화면이 거른다).

#### 챌린지 기록 (주제가 지워진 완료 챌린지)
- `ChallengeScreen.tsx:314` 「같은 주제로 한 번 더」(`?again=`)는 **`d.topic.exists === false` 이면 숨기고** `nextBody` 대신 「다음 주제로 넘어가 보세요.」. 제목·결과는 스냅샷 그대로, 「삭제됨」 표기 없음.
- `ChallengeCreateScreen.tsx:89` `!d.topic.id` 일 때 토스트를 `againFail`(「지난 챌린지를 불러오지 못해…」) 대신 「그 주제는 이제 내 목록에 없어요. 주제를 다시 골라 주세요.」(계획표 카드 `ChallengePlanCard.tsx:104` 는 주제 정보가 없어 버튼을 그대로 두고 이 문구로 받는다).
- 다른 챌린지가 진행 중이면(`retry.kind==='blocked'`) 아래 상자 글은 `blockedNoteText(retry, topicGone)`(`challenge/logic.ts`) 가 고른다 — 주제가 있으면 「지금은 「{t}」({n}일째)를 하고 있어요. 진행 중인 챌린지가 끝나면 다시 도전할 수 있어요.」, **지워졌으면 앞 문장만**(위 줄 「다음 주제로 넘어가 보세요.」와 어긋나지 않게). [다른 주제로] 버튼은 blocked 에 없고 [진행 중 챌린지 보기 ›] 링크만 있다.
- `COPY.removed`(`ChallengeScreen.tsx:271`)는 **손대지 않는다** — `endReason === 'TOPIC_REMOVED'`(ENDED) 에서만 나오고, 새 삭제 경로는 기간 지난 챌린지를 먼저 완료로 바꾸고(settle) 진행 중 챌린지 행은 지우므로 새로 생기지 않는다 [가능성 높음 — T3-1 결정·`settle.ts:6`]. 완료(COMPLETED) 챌린지에는 나오지 않는다.

### 16-3. API 호출 계획 (화면 → 엔드포인트)

| 화면 | 엔드포인트 | 사용 필드 | 한도·주의 |
|---|---|---|---|
| S2·S6·S7 | #56 `GET /topics?level=all` | `items[].{id,title,titleJa,level,description,isSeed,chunks[]}` | 읽기 |
| S2·S6·S10·S7 | #179 `GET /seed-overrides?kind=` | `{kind,seedId,seedTitle,state,copyId,orphan,updatedAt}` | `no-store` |
| S2·S6 | #161 `GET /scenarios?limit=100[&topicId=]` | `items[].{id,isMine,topics[],…}` | `nextCursor` 이어 읽기 |
| S2·S6 | #155 `GET /challenges?status=ACTIVE&limit=1` | `items[0].{id,title,topic.id,stats.dayIndex,lengthDays}` | 실패해도 화면 유지 |
| S3·S7(D4) | #170 `POST /topics/drafts` | `{draft:{title,titleJa,level,description,chunks[]},warnings[]}` | 분당 6·하루(24시간) 20·동시 1 |
| S4 | #166 `POST /scenarios/drafts` (`topic` 인라인) | `{draft}` | 분당 6·하루 40(#177 공유)·동시 1 |
| S4 | #57 `POST /topics` | 201 `{topic.id,warnings}` | 하루 10·내 주제 30·분당 20 |
| S4·A | #163 `POST /scenarios` | 201 상세 `id` | 하루 30·내 상황 50·분당 20 |
| S7 | #171 `PATCH /topics/:id` · #174 `POST /topics/:id/fork` | `{topic,warnings}` · `{topic,copyId,seedId}` | #174 = 하루 10 공유 |
| S8·S9 | #172 `GET /topics/:id/removal` → #173 `DELETE ?ack=` / #176 | `TopicRemovalPreview` → `TopicRemovalResult` | 분당 20 `topic-write` |
| 숨긴 항목·S10 | #176 `POST /seed-overrides/restore` | `{path,copyId,removal}` | 분당 20 |
| S10 | #165 `DELETE /scenarios/:id` | `result:'ARCHIVED'\|'HIDDEN'` | 분당 20 |
| S11 | #164 / #175 `POST /scenarios/:id/fork` | 상세 `id` | #175 = 하루 30 공유 |
| 첫마디 | #178 `POST /scenarios/openings/draft` | `{ja,reading,warnings}` | 분당 10·하루 60·동시 1 |
| A | #177 `POST /scenarios/:id/variants/drafts` | `{draft,changedFields,axes}` | 분당 6·하루 40(#166 공유)·동시 1 |

- 래퍼: `src/components/topic/api.ts`(주제·시드 관리·챌린지 ACTIVE — #56·#57·#155·#170·#171·#172·#173·#174·#176·#179) 를 T5-1 에서 **전부** 만든다(뒤 task 들이 이 파일을 고치지 않게 — 병렬 안전). 상황 쪽(#161~#166·#175·#177·#178)은 지금처럼 scenario 훅이 `apiGet/apiPost` 로 직접.
- 오류 해석은 공용 `toErr`(`components/common/errors.ts`)로 `{status, code, details, message}` 를 얻고 **`message` 는 쓰지 않는다**(§16-7).

### 16-4. 상태 관리
- **S2·S6**: `useManageData`/`useTopicDetail` — `Promise.allSettled` 네 요청, 필수 둘(#56·#179) 실패만 화면 오류. `reload({silent:true})` 는 지금 값을 두고 바꾼다(R1). 순번으로 늦은 응답 버림(`useKeyedResource` 와 같은 방식).
- **S3~S5 `useTopicDraft`**: 단계 `ask → generating → review → (sc0|sc1) → saving → partial|done`. sessionStorage `kaiwa.topic.draft` = `{ask, draft, scenarioDrafts[], keep[], savedTopicId?, savedScenario[]?, version}` — `savedTopicId` 가 있으면 다시 들어와도 `partial` 로 연다(주제 재생성 금지). 요청마다 `AbortController`, 15·20초 타이머. 상황 자동 요청은 주제 초안 도착 이벤트에서 한 번만(다시 그려질 때 다시 보내지 않게 ref 가드).
- **S7 `useTopicEdit`**: 원본(#56 항목)과 편집 값 diff → #171 본문, `SEED` 면 전체 값 → #174. D4 요청은 별도 `AbortController`.
- **`useTopicRemoval(mode, id)`**: `loading → ready → busy → (changed → ready) | done | fail`. `changed` 는 409 `details.preview` 로 `ready` 와 같은 모양을 다시 채운다.
- **`useOpeningDraft`**: 위 첫마디 상태 + abort. 편집기 `EditableDraft.opening` 모양이 바뀌므로 `draftFromResponse`·`draftFromDetail`·`draftInput`·`draftPatch`·`validateDraft`(`scenario/logic.ts:273~517`)를 함께 고친다.
- 토글·칩·체크·메뉴는 React 상태만(R1) — 목록 `key` 바꾸기·로딩 되돌림·토글을 URL 에 싣기 금지(`?tab`·`?sc`·`?step` 는 이동이라 예외, `{ scroll: false }`).

### 16-5. 구현 분할 확정 (한 task ≤ ~15 파일·≤ 60턴)

**순서**: `T5-1` → (`T5-2` ∥ `T5-5a`) → `T5-3a` → (`T5-3b` ∥ `T5-4`) → `T5-5b`. 병렬 쌍은 서로 다른 파일만 고친다(아래 목록). `DraftEditor.tsx` 를 고치는 T5-5a·T5-3b·T5-5b 는 **반드시 이 순서로 하나씩**.
Leader 제안 대비 바꾼 점: T5-3 을 **3a/3b 로 나눔**(이유: 선생님 호출 2종·부분 저장·sessionStorage 재개가 한 task 에 몰리면 60턴을 넘길 위험 [가능성 높음] — 3a 는 주제만 저장하는 완결 흐름) · 두 목록 훅을 `useManageData` 하나로(위 §16-2 S2) · `ScenarioRow` 대신 `ScenarioCard` 재사용 · 숨긴 항목 시트를 T5-1 → T5-2 로(파일 수).

| task | 범위 | 생성·수정 파일 | API | 선행 |
|---|---|---|---|---|
| **T5-1** 기반 | 문구·오류 매핑·래퍼·출처 판정·S1·S2(읽기·탭·시트 열기) | 새 `src/components/topic/{topicCopy.ts, failure.ts, api.ts, logic.ts, useManageData.ts, ManageScreen.tsx, TopicRow.tsx}` · 새 `src/components/topic/__tests__/{logic.test.ts, failure.test.ts}` · 새 `src/app/(app)/settings/ManageEntryRow.tsx` · 새 `src/app/(app)/settings/scenarios/page.tsx` · 수정 `src/app/(app)/settings/page.tsx`(1줄) · `src/components/shell/routes.ts`(1줄) · `src/components/scenario/ScenarioCard.tsx`(출처 뱃지 prop) — **14** | #56·#179·#161·#155(+ 래퍼만 나머지) | 없음 |
| **T5-2** 주제 보기·확인 시트 | S6 · S8·S9(4 mode) · 숨긴 항목 시트 · flash 토스트 | 새 `src/app/(app)/settings/scenarios/topics/[id]/page.tsx` · 새 `src/components/topic/{TopicDetail.tsx, useTopicDetail.ts, TopicRemovalSheet.tsx, useTopicRemoval.ts, HiddenSeedSheet.tsx}` · 수정 `topic/{ManageScreen.tsx, logic.ts}` · 새 `topic/__tests__/removal.test.ts` — **9** | #172·#173·#176·#179 | T5-1 |
| **T5-5a** 공유 편집기 첫마디·시트 행동 줄·S11 | `OpeningField` · 시트 출처별 행동·숨기기·되돌리기 · 시드 고치기 #175 · `from=manage` · `?topicId` 장소 미리 고르기 · 서버 `message` 대신 고정 문구(기존 편집기) | 새 `src/components/scenario/{OpeningField.tsx, useOpeningDraft.ts}` · 수정 `scenario/{DraftEditor.tsx, logic.ts, useScenarioDraft.ts, ScenarioDraftScreen.tsx, ScenarioSheet.tsx, scenarioCopy.ts}` · 수정 `src/app/(app)/study/ai/scenario/[id]/edit/page.tsx`·`.../scenario/new/page.tsx`(`from`·`topicId` 전달) · 새 `scenario/__tests__/opening.test.ts` · 수정 기존 시험(`scenario/__tests__/*` 중 `opening`·`serverProblems` 단언) — **≈12** | #178·#175·#165·#176·#179 | T5-1(래퍼·`failure.ts`) |
| **T5-3a** 주제 만들기(주제만 저장) | S3 · S4 주제 정보·기본 표현·경고·저장(#57)·나가기·버리기·다시 만들기·재개 | 새 `src/app/(app)/settings/scenarios/topics/new/page.tsx` · 새 `src/components/topic/{TopicCreateScreen.tsx, useTopicDraft.ts, TopicAskForm.tsx, TopicDraftReview.tsx, TopicInfoFields.tsx, ChunkEditor.tsx}` · 수정 `topic/logic.ts` · 수정 `src/components/shell/BackBar.tsx`(선택 `onBack` prop — 있으면 링크 대신 버튼) · 새 `topic/__tests__/topicDraft.test.ts` — **10** | #170·#57 | T5-1 (T5-5a 뒤 권장 — 같은 `logic` 패턴) |
| **T5-3b** S4 상황 초안·S5·부분 저장 | 자동 #166 1개 + [하나 더] · 카드·체크 · S5(`placesFixed`) · #163 순차 저장 · `partial` | 새 `src/components/topic/ScenarioDraftCards.tsx` · 수정 `topic/{useTopicDraft.ts, TopicDraftReview.tsx, TopicCreateScreen.tsx, logic.ts}` · 수정 `src/components/scenario/DraftEditor.tsx`(`placesFixed`) · 수정 `topic/__tests__/topicDraft.test.ts` — **7** | #166·#163 | T5-3a · T5-5a(`DraftEditor`) · **L-1 결정** |
| **T5-4** 주제 고치기 | S7 · `MINE/COPY` #171 · `SEED` #174 · D4-A · `ALREADY_COPIED`·`USE_FORK`·`not_found` | 새 `src/app/(app)/settings/scenarios/topics/[id]/edit/page.tsx` · 새 `src/components/topic/{TopicEditScreen.tsx, useTopicEdit.ts, LevelRegenBox.tsx}` · 수정 `topic/{ChunkEditor.tsx(표현 id 보존), TopicDetail.tsx([고치기] 링크), logic.ts}` · 새 `topic/__tests__/topicEdit.test.ts` — **8** | #171·#174·#170 | T5-2 · T5-3a |
| **T5-5b** 변형 A·챌린지 기록 | A 전체 · 「바뀜」 · 챌린지 again 처리 | 새 `src/app/(app)/study/ai/scenario/[id]/variant/page.tsx` · 새 `src/components/scenario/{VariantDraftScreen.tsx, VariantAxes.tsx, useVariantDraft.ts}` · 수정 `scenario/{DraftEditor.tsx(changed prop), scenarioCopy.ts}` · 수정 `src/components/challenge/{ChallengeScreen.tsx, ChallengeCreateScreen.tsx, challengeCopy.ts}` · 새 `scenario/__tests__/variant.test.ts` — **10** | #177·#163 | T5-5a · T5-3b(`DraftEditor`) |

**task 별 QA 확인 항목**(전부 360/390/412, `main` 은 `document.querySelector('main').scrollTop`, 시트는 시트 본문):
- **T5-1** ① 설정 첫 화면(780px 안)에 「내 상황·주제 관리」 행이 계정 카드 바로 아래 보이고 → 관리 화면, ← 로 설정(하단 탭 숨김 확인) ② 주제 탭: 기본 5 · 내 버전은 ✎ 뱃지로 기본 절에 · 숨긴 시드 없음 · 「내 주제 n/30」·「상황 n개」 수가 #161 과 일치 ③ #155·#161 을 막아도(네트워크 차단) 목록은 보이고 뱃지·「상황 n개」만 빠짐, #56 을 막으면 오류 상자 ④ 탭 전환 → `main` 위치를 건드리지 않음(분절 버튼이 맨 위에 있어 초점만 분절 버튼에 남음 — `scrollTop` 전후 차 0px), 상황 행 → 시트 열고 닫기 전후 `scrollTop` 차 0px·초점 복귀 ⑤ 로딩 자리표시 높이 = 도착 뒤 높이(점프 ≤ 8px), 엔진명 0.
- **T5-2** ① `delete`·`copyDelete`·`restore`·`hide` 네 시트 문구가 #172 값과 일치(진행 중 챌린지 있음/없음, 완료 기록 줄은 `finishedChallenges>0` 일 때만) ② 시트를 연 채 다른 탭에서 챌린지를 만든 뒤 [주제 지우기] → 409 → 본문·버튼 글자 「챌린지까지 지우기」로 바뀌고 **아무것도 안 지워짐** → 다시 눌러야 지워짐 ③ `copyDelete` 뒤 그 주제와 기본 주제 모두 목록에 없고 숨긴 항목에 기본이 있음, `restore` 뒤 기본 S6 으로 가고 내 상황이 기본 주제에 붙음 ④ 시트 열기→취소·숨긴 항목 [다시 보기] 전후 `scrollTop` 차 0px, 닫으면 연 버튼 초점 ⑤ 토스트 숫자 = 응답 숫자, 조사 병기 0(제목이 이모지·영문으로 끝나도).
- **T5-5a** ① 첫마디 7상태 전환(맞춤·한국어만·고침·만드는 중·실패·비움·맞추지 않고 저장) — 고침·한국어만 상태 저장 막힘·버튼 초점, 비움 저장 → `constraints.opening` null → 역할극 「먼저 말을 걸어 보세요」 ② 학습자 질문(「저기요, 서울역 출구가 어디예요?」)을 넣으면 일본어가 나오고 **확인 문구가 보임**(막지는 못함 — 알려진 한계) ③ 시드 상황 시트 [나에게서 숨기기] → 목록·회화 탭에서 사라지고 숨긴 항목에 있음, [고치기] → 「내 버전으로 저장」 → 사본 시트 ✎, 사본 [기본으로 되돌리기] → 기본 복귀 ④ 첫마디 한국어 고침·[일본어 다시 만들기] 전후 `scrollTop` 차 0px·초점 버튼(회화 탭 기존 고치기 화면 포함) ⑤ 빈 첫마디·영문만 → 칸 오류가 「을(를)」 없는 고정 문구, 키보드가 올라온 상태에서 KeyboardInset 과 겹치지 않음(실기기).
- **T5-3a** ① 2자 미만 막힘·40자 카운터, 만드는 중 [그만두기] → 입력 유지, 422 한 문구 + 입력칸 초점, 502 [다시 만들기] ② 더블 탭 → 요청 1건(DevTools 네트워크) ③ 「주제만 저장」 → #57 1회·행 = 주제 1 + 표현 n, 저장 전 행 0 ④ 표현 ⋯ 메뉴 열기→닫기·[다시 만들기] 확인 상자(위로 0px, 아래로 최소) `scrollTop` 기준 통과 ⑤ 새로 고침 → 「고치던 주제 초안」 카드 → 이어서 고치기 값 동일.
- **T5-3b** ① 초안 도착 직후 #166 이 **1회만**(다시 그려도 재요청 0), 도착 전 위 칸 편집 가능, 자리 카드 높이 고정 ② 상황 체크 끄기/켜기 `scrollTop` 차 0px·초점 체크(v2 요청 1 재현 금지) ③ 두 번째 [하나 더] 는 첫 요청 중 막힘, 2개 뒤 줄 숨김 ④ 상황 저장만 실패 강제(내 상황 50 채운 QA 계정) → `partial`·주제 1행 유지·[상황 다시 저장]이 주제를 다시 만들지 않음(새로 고침 뒤에도) ⑤ S5 다녀오면 S4 위치·카드 [고치기] 초점 복귀.
- **T5-4** ① 내 주제 표현 1개 뜻만 고침 → #171 본문에 그 표현 `id`·바뀐 칸만, 나머지 표현 id 유지 ② 기본 주제 저장 → #174 → 사본 S6·✎, 두 탭 동시 → 한쪽 「이미 내 버전…」 + [내 버전 열기] ③ D4: N5→N4 바꿈 → 상자 → [표현 다시 받기] → 표현만 바뀜·이름 그대로, 저장 전 서버 0 ④ 수준 칩 바꾸기 `scrollTop` 차 0px·초점 칩 ⑤ 하루 10 도달 시 문구(내 버전 포함).
- **T5-5b** ① 축 하나도 안 고르면 버튼 막힘(요청 0), N1 기준 `up` 막힘 ② 칩 누르기 `scrollTop` 차 0px·초점 칩 ③ 검토 「바뀜」 = `changedFields` 와 1:1(설명 칸 표시 없음) ④ 저장 → #163 1행·장소 = 원본 장소 ⑤ 주제를 지운 완료 챌린지: 「같은 주제로 한 번 더」 없음, 「삭제됨」 표기 없음, 계획표 카드 [다시 하기] → 새 문구.

### 16-6. 문구 단일 출처 표 — `src/components/topic/topicCopy.ts`(새 화면) · `src/components/scenario/scenarioCopy.ts`(공유 편집기·시트·A) · `challengeCopy.ts`(2개)

Leader 지시는 「topicCopy.ts 에 전부」였으나 **공유 편집기·시트·A 문구는 `scenarioCopy.ts`** 에 둔다 — scenario 컴포넌트가 topic 폴더를 import 하면 의존 방향이 거꾸로 된다(topic → scenario 만 허용). 변형 축 라벨은 어느 파일에도 복사하지 않고 `src/types/scenarioVariant.ts` 를 import. `{t}` = 제목(늘 「」 안 + 뒤에 고정 명사 「주제」·「상황」·「챌린지」 를 붙여 조사를 명사에 붙인다 — 사용자 글 끝 글자에 조사를 붙이지 않는다. `josa()` 는 한글이 아닌 끝 글자에서 「을(를)」 병기로 떨어진다 — `scenario/logic.ts:42` [확실]).

**topicCopy.ts**
| 키 | 문구 |
|---|---|
| `ENTRY.section` · `row` · `rowSub` | 회화 연습 · 내 상황·주제 관리 · 주제를 적으면 선생님이 상황 초안을 만들어요 |
| `MANAGE.title` · `back` | 내 상황·주제 · 설정 |
| `MANAGE.tabTopics(n)` · `tabScenarios(n)` | 주제 {n} · 상황 {n} |
| `MANAGE.createTopic` · `createTopicSub` | ＋ 주제 만들기 · 주제를 한 줄로 적으면 선생님이 기본 표현과 상황 초안을 만들어요 |
| `MANAGE.mineCount(n)` · `mineFull` | 내 주제 {n}/30 · 내 주제는 30개까지예요. 안 쓰는 주제를 지우면 새로 만들 수 있어요. |
| `MANAGE.mineSection(n)` · `seedSection(n)` · `mineEmpty` | 내가 만든 주제 {n}개 · 기본 주제 {n}개 · 아직 만든 주제가 없어요. 위 [＋ 주제 만들기]로 시작해요. |
| `MANAGE.rowMeta(s,c)` · `rowMetaNoScenario(c)` · `challengeBadge(d)` | 상황 {s}개 · 기본 표현 {c}개 · 기본 표현 {c}개 · 챌린지 {d}일째 |
| `MANAGE.badgeSeed` · `badgeMine` · `badgeCopy` | 기본 · 내 주제 · ✎ 내 버전 |
| `MANAGE.createScenario` · `scenarioCount(n)` · `scenarioEmpty` | ＋ 상황 만들기 · 내 상황 {n}/50 · 아직 만든 상황이 없어요. |
| `MANAGE.hiddenRow(n)` · `loading` · `loadFail` · `loadFailBody` · `retry` | 숨긴 기본 항목 {n}개 · 내 상황·주제를 불러오는 중… · 목록을 불러오지 못했어요 · 잠시 뒤 다시 시도해 주세요. · 다시 시도 |
| `HIDDEN.title` · `intro` · `kindTopic` · `kindScenario` · `noTitle` | 숨긴 기본 항목 · 나에게만 숨긴 기본 주제·상황이에요. 다시 보면 목록에 돌아와요. · 주제 · 상황 · 이름을 알 수 없는 기본 항목 |
| `HIDDEN.show` · `showing` · `shown` · `empty` · `fail` | 다시 보기 · 다시 보이게 하는 중… · 다시 보이게 했어요 · 숨긴 기본 항목이 없어요. · 다시 보이게 하지 못했어요. 다시 눌러 주세요. |
| `CREATE.title` · `ask` · `askSub` | 주제 만들기 · 어떤 주제로 연습하고 싶어요? · 주제를 한 줄로 적어 주세요. 선생님이 설명·기본 표현·상황 초안을 만들어요. |
| `CREATE.field` · `placeholder` · `examples` | 주제 · 예: 병원 진료 · [병원 진료, 공항 체크인, 미용실, 은행 창구] (데모 칩 그대로 — developer 가 데모 값 확인) |
| `CREATE.level` · `levelNote(l)` · `submit` · `privacy` | 수준 · 내 수준({l})으로 골라 뒀어요 · 초안 만들기 · 초안은 저장하기 전까지 어디에도 남지 않아요 |
| `CREATE.short` · `long` | 주제를 2자 이상 적어 주세요. · 주제는 40자까지 적을 수 있어요. |
| `CREATE.gen` · `genSub` · `genLong` · `cancel` · `canceled` | 선생님이 주제 초안을 만들고 있어요 · 보통 10~15초 걸려요. · 조금 더 걸리고 있어요. 그만두고 다시 만들어도 돼요. · 그만두기 · 초안 만들기를 그만뒀어요. 적은 주제는 그대로 있어요. |
| `CREATE.resumeTitle` · `resumeBody(t)` · `resume` · `resumeDiscard` | 고치던 주제 초안이 있어요 · 「{t}」 주제 초안을 이어서 고칠 수 있어요. · 이어서 고치기 · 버리고 새로 만들기 |
| `REVIEW.arrivedTitle` · `arrivedBody` | 초안이 왔어요 · 고칠 곳을 고친 뒤 저장해야 내 주제가 돼요. 저장하기 전에는 어디에도 남지 않아요. |
| `REVIEW.info` · `fTitle` · `fTitleJa` · `fLevel` · `fDesc` | 주제 정보 · 주제 이름 · 일본어 이름 · 수준 · 설명 |
| `REVIEW.chunksHead(n)` · `chunksRange` · `readingWarn` · `readingWarnSub` | 기본 표현 {n}개 · 8~20개 · 읽기가 틀릴 수 있어요. 확인해 주세요. · 한자 읽기는 선생님도 가끔 틀려요. 틀린 읽기는 ⋯ › 고치기에서 바꿔요. |
| `REVIEW.type.{NAME,ACTION,FEELING,MODIFIER}` | 이름 · 액션 · 느낌 · 꾸밈 |
| `REVIEW.menu(t)` · `menuEdit` · `menuUp` · `menuDown` · `menuRemove` | {t} 표현 메뉴 · 고치기 · 위로 · 아래로 · 지우기 |
| `REVIEW.fJa` · `fReading` · `fMeaning` · `apply` · `cancel` · `addChunk` | 일본어 · 읽기 · 뜻 · 바꾸기 · 취소 · ＋ 표현 더하기 |
| `REVIEW.checkHead(n)` · `fixed` | 확인해 볼 곳 {n}가지 · 그대로 저장해도 돼요 · ✓ 고쳤어요 |
| `REVIEW.warn.TITLE_TRUNCATED` | 적은 주제가 길어서 이름을 20자로 줄였어요. 이름을 확인해 주세요. |
| `REVIEW.warn.DESCRIPTION_MISSING` | 설명이 비어 있어요. 한 줄 적어 두면 목록에서 알아보기 쉬워요. |
| `REVIEW.warn.TITLE_JA_MISSING` | 일본어 이름이 비어 있어요. 적지 않으면 한국어 이름만 보여요. |
| `REVIEW.warn.CHUNKS_SHORT(n)` | 기본 표현이 {n}개예요. 20개까지 더 넣을 수 있어요. (v2 의 「12개까지」 → 상한 20 으로 고침) |
| `REVIEW.warn.TYPE_THIN(names,n)` | {이름·액션…} 조각이 {n}개뿐이에요. 하나 더 넣으면 수업 카드가 고르게 나와요. (여러 종류는 한 줄) |
| `REVIEW.problemsHead(n)` · `saveOrder` | 고칠 곳이 {n}군데 있어요 · 주제를 먼저 저장하고, 고른 상황을 하나씩 저장해요. |
| `REVIEW.save(k)` · `saveTopicOnly` · `saving` · `savingScenario(i,k)` | 주제와 상황 {k}개 저장 · 주제만 저장 · 주제를 저장하고 있어요… · 상황 {i}/{k} 저장 중… |
| `REVIEW.regen` · `regenAsk` · `regenYes` | 다시 만들기 · 주제 초안을 다시 만들까요? 지금 고친 내용은 사라져요. · 다시 만들기 |
| `REVIEW.discard` · `discardTitle` · `discardBody` | 버리기 · 초안을 버릴까요? · 버린 초안은 되돌릴 수 없어요. |
| `REVIEW.leaveTitle` · `leaveBody` · `leave` · `stay` | 나갈까요? · 고치던 초안은 이 탭에 남아 있어서 다시 들어오면 이어서 고칠 수 있어요. · 나가기 · 계속 고치기 |
| `SCDRAFT.head` · `pick(k,n)` · `intro` | 상황 초안 · 저장할 상황 {k}/{n} · 주제와 함께 저장할 상황을 골라요. 저장한 뒤에도 따로 만들거나 고칠 수 있어요. |
| `SCDRAFT.gen` · `genSub` · `cancel` | 선생님이 이 주제로 상황 초안을 만들고 있어요 · 보통 10~20초 걸려요. 그동안 위 표현을 먼저 고쳐도 돼요. · 그만두기 |
| `SCDRAFT.keep` · `opening(ko)` · `noOpening` · `edit` · `problems(n)` | 이 상황도 저장 · 첫마디 · {ko} · 첫마디 없음 · 고치기 · 고칠 곳 {n}군데 |
| `SCDRAFT.more` · `moreLabel` · `morePlaceholder` · `moreSubmit` · `moreBusy` | ＋ 상황 하나 더 만들기 · 어떤 상황을 하나 더 만들까요? · 예: 약을 받으며 먹는 법을 묻는 상황 · 상황 초안 만들기 · 앞 상황 초안을 만드는 중이에요. |
| `SCDRAFT.fail` · `retry` · `unfit` | 상황 초안은 만들지 못했어요. 주제만 저장하고 상황은 나중에 만들 수도 있어요. · 다시 만들기 · 이 주제로는 상황 초안을 만들기 어려워요. 아래에 상황을 한 줄로 적어 다시 만들어 보세요. |
| `SCDRAFT.placeFixed(t)` · `backToReview` · `done` | 장소 · {t} (저장할 때 이 주제에 이어져요) · 주제 초안 · 완료 |
| `SCDRAFT.fallbackDesc(t)` | {t} 상황에서 나누는 대화 (요청 본문용 — 화면에 보이지 않음) |
| `PARTIAL.title` · `body(m)` · `topicLocked` | 주제는 저장했어요 · 상황 {m}개는 저장하지 못했어요. 주제와 상황은 따로 저장돼요. · 주제는 저장됐어요. 주제를 고치려면 주제 보기에서 고쳐요. |
| `PARTIAL.retry` · `later` · `laterTitle` · `laterBody(m)` | 상황 다시 저장 · 주제 보기로 · 주제 보기로 갈까요? · 저장하지 못한 상황 초안 {m}개는 사라져요. |
| `TOPIC.back` · `seedInfo` · `copyInfo(date)` · `revert` | 내 상황·주제 · 기본 주제예요. 고쳐서 저장하면 내 버전이 생기고, 내 목록에는 내 버전이 대신 보여요. · ✎ 내 버전이에요 · {date}에 만들었어요 · 기본으로 되돌리기 |
| `TOPIC.challenge(t,d,len)` · `challengeLink` | 「{t}」 챌린지 {d}일째 · {len}일 · 챌린지 보기 |
| `TOPIC.chunksHead(n)` · `edit` · `editAria(t)` | 기본 표현 {n}개 · 고치기 · 「{t}」 주제 고치기 |
| `TOPIC.scenariosHead(n)` · `scenariosEmpty` · `addScenario` | 이 주제의 상황 {n}개 · 이 주제로 만든 상황이 아직 없어요. · ＋ 이 주제로 상황 만들기 |
| `TOPIC.remove` · `hide` · `hideSub` · `copyRemove` · `copyRemoveSub` | 주제 지우기 · 나에게서 숨기기 · 나에게만 숨겨지고, 다시 볼 수 있어요 · 내 버전 지우기 · 내 버전을 지우면 기본 주제도 내 목록에서 숨겨져요 |
| `TOPIC.notFound` · `notFoundBody` · `notFoundBtn` | 이 주제를 찾을 수 없어요 · 지워졌거나 내 목록에서 숨긴 주제예요. · 내 상황·주제로 |
| `EDIT.title` · `seedInfo` · `save` · `saveSeed` | 주제 고치기 · 기본 주제예요. 저장하면 내 버전이 생겨요. 기본 주제는 그대로 남고, 언제든 되돌릴 수 있어요. · 저장 · 내 버전으로 저장 |
| `EDIT.lvlChanged(a,b)` · `lvlNote` · `lvlRegen` · `lvlKeep` | 수준을 바꿨어요 ({a} → {b}). 기본 표현도 새 수준에 맞게 다시 받을까요? · 받은 표현은 저장해야 바뀌어요. 새로 받은 표현은 연습 기록이 처음부터 쌓여요. · 표현 다시 받기 · 지금 표현 두기 |
| `EDIT.lvlGen` · `lvlFail` | 선생님이 새 수준에 맞는 표현을 만들고 있어요 · 표현을 받지 못했어요. 지금 표현은 그대로 있어요. |
| `EDIT.copied` · `openCopy` · `useFork` · `chunkGone` | 다른 화면에서 이미 내 버전을 만들었어요. 여기서 고친 내용은 저장되지 않았어요. · 내 버전 열기 · 기본 주제라 내 버전으로 저장돼요. 다시 눌러 주세요. · 다른 곳에서 바뀐 표현이 있어요. 화면을 새로 고친 뒤 다시 고쳐 주세요. |
| `REMOVAL.title.{delete,copyDelete,restore,hide}` | 주제를 지울까요? · 내 버전을 지울까요? · 기본으로 되돌릴까요? · 이 주제를 숨길까요? |
| `REMOVAL.loading` · `loadFail` | 무엇이 바뀌는지 확인하는 중… · 확인하지 못했어요. 다시 시도해 주세요. |
| `REMOVAL.warnTitle` | 진행 중인 챌린지가 있어요 |
| `REMOVAL.warn.delete(t,d)` (copyDelete 같음) | 「{t}」 챌린지를 {d}일째 하고 있어요. 지우면 이 챌린지도 함께 지워지고, 되돌릴 수 없어요. |
| `REMOVAL.warn.restore(t,d)` | 「{t}」 챌린지를 {d}일째 하고 있어요. 되돌리면 내 버전으로 하던 이 챌린지는 지워지고, 되돌릴 수 없어요. |
| `REMOVAL.warn.hide(t,d)` (`InfoBox`, 경고 아님) | 진행 중인 「{t}」 챌린지는 그대로 이어져요. 숨겨도 챌린지 화면에서 계속 공부할 수 있어요. |
| `REMOVAL.noActive` · `noActiveRestore` | 진행 중인 챌린지는 없어요. 지우면 되돌릴 수 없어요. · 진행 중인 챌린지는 없어요. |
| `REMOVAL.goneHead` · `goneScenarios(n)` · `goneChallenge` | 함께 지워져요 · 이 주제에만 있는 내 상황 {n}개 · 진행 중인 챌린지 |
| `REMOVAL.keepHead` · `keepFinished` · `keepUnlinked(n)` · `keepUnlinkedSub` · `keepRecords` | 그대로 남아요 · 완료한 챌린지 기록은 그대로 남아요 · 다른 주제에도 있는 상황 {n}개 · 이 주제와의 연결만 빠져요 · 수업·단어 기록과 단어장 |
| `REMOVAL.restoreBody` · `restoreHead` · `relinked(n)` | 내가 고친 이름·설명·수준·기본 표현이 기본 내용으로 바뀌어요. · 기본 주제로 되돌아가요 · 내 상황 {n}개는 기본 주제에 다시 이어져요 |
| `REMOVAL.hideBody` | 나에게만 숨겨져요. 다른 사람에게는 그대로 보여요. 「내 상황·주제」 맨 아래 「숨긴 기본 항목」에서 다시 볼 수 있어요. |
| `REMOVAL.copyDeleteBody` | 내가 고친 주제가 지워지고, 기본 주제도 내 목록에서 숨겨져요. 「숨긴 기본 항목」에서 기본 주제를 다시 볼 수 있어요. |
| `REMOVAL.btn.{delete,copyDelete,restore,hide}` · `btnWithChallenge.{delete,restore}` · `cancel` | 주제 지우기 · 내 버전 지우기 · 기본으로 되돌리기 · 나에게서 숨기기 · 챌린지까지 지우기 · 챌린지까지 되돌리기 · 취소 |
| `REMOVAL.busy.{delete,restore,hide}` | 지우는 중… · 되돌리는 중… · 숨기는 중… |
| `REMOVAL.changed` | 확인하는 사이에 바뀐 내용이 있어요. 아래 내용을 다시 확인하고 눌러 주세요. |
| `REMOVAL.fail.{delete,restore,hide}` | 지우지 못했어요. 아무것도 지워지지 않았어요. 다시 눌러 주세요. · 되돌리지 못했어요. 아무것도 바뀌지 않았어요. 다시 눌러 주세요. · 숨기지 못했어요. 다시 눌러 주세요. |
| `REMOVAL.gone` | 이 주제는 이미 지워졌어요. |
| `TOAST.removed(t, s, ch)` | 「{t}」 주제를 지웠어요 (+ ` · 상황 {s}개도 함께 지웠어요` s>0) (+ ` · 진행 중인 챌린지도 지웠어요` ch) |
| `TOAST.hidden(t)` · `copyRemoved(t)` · `restored(t)` | 「{t}」 주제를 숨겼어요 · 「{t}」 내 버전을 지웠어요 · 기본 주제는 숨긴 기본 항목에 있어요 · 「{t}」 주제를 기본으로 되돌렸어요 |
| `TOAST.created(t, k)` · `saved` · `copySaved` | 「{t}」 주제를 저장했어요 (+ ` · 상황 {k}개도 저장했어요`) · 저장했어요 · 내 버전으로 저장했어요 |
| `SCDRAFT.nth(n)` | {n}번째 상황 — 상황 카드 체크 `aria-label` 맨 앞에 붙는 순번(`scenarioKeepName(n, title)` = 「{n}번째 상황 {제목} 이 상황도 저장」). 화면에 보이지 않는다. **데모에 없는 추가**(REV-166 L-C — 제목이 같은 두 초안도 이름이 달라지게) |
| `REVIEW.fType` | 종류 — 표현 고치기 펼침의 종류 칸 이름표. 이 가이드 S4 에 값이 없어 코드가 정했다. **코드 우선** |
| `REVIEW.saveIdle` | 저장할 상황이 없어요. — 저장 줄 위 한 줄. `saveOrder` 와 같은 칸에 겹쳐 그려 줄 높이가 바뀌지 않는다. 고른 상황이 있거나 상황 초안을 만드는 중이면 `saveOrder`, 둘 다 아닐 때만 이 글(`saveNoteActive(k, scBusy)`). **데모에 없는 추가**(REV-164 L-4·REV-166 L-E) |
| `PARTIAL.unsure` | 응답을 받지 못한 상황은 이미 저장됐을 수 있어요. 다시 저장하면 같은 상황이 두 개 생길 수 있어요. — `partial` 상자에서 남은 상황 중 **응답 없음(네트워크)** 으로 실패한 것이 있을 때만(서버가 거절한 오류·새로 고침 뒤에는 보이지 않는다). **데모에 없는 추가**(REV-164 M-1) |
| `EDIT.leaveBody` | 나가면 고친 내용은 저장되지 않아요. — S7 나가기 시트 본문(주제 만들기와 달리 이 탭에 남지 않는다). 제목·버튼은 `REVIEW.leaveTitle`·`leave`·`stay`. **코드 우선**(REV-163) |
| `EDIT.textChanged` | 일본어 글을 바꾸면 이 표현의 연습 기록이 처음부터 다시 시작돼요. — 행 고치기에서 일본어 글이 원래 글과 달라졌을 때만(서버가 새 행으로 만든다). **데모에 없는 추가**(REV-163 M-3) |
| `REMOVAL.checking` | 확인하는 중… — #172 확인이 끝나기 전 실행 버튼 글자. **코드 우선** |
| `MANAGE.tabsAria` · `filterAria` · `filterAll(n)` · `filterMine(n)` · `filterSeed(n)` | 관리 대상 · 상황 보기 범위 · 전체 {n} · 내가 만든 {n} · 기본 {n} — 화면에 보이지 않는 읽어 주는 이름(같은 화면의 두 `radiogroup` 이름이 달라야 한다). **코드 우선** |
| `HIDDEN.showAria(t)` | 「{t}」 다시 보기 — 숨긴 항목 행 [다시 보기] 의 읽어 주는 이름. **코드 우선** |

**scenarioCopy.ts 추가**(공유 편집기·시트·A)
| 키 | 문구 |
|---|---|
| `OPENING.legend` · `koLabel` · `koHint(tutor)` | 선생님 첫마디 · 한국어로 적어요 · 역할극을 시작할 때 선생님({tutor} 역할)이 나에게 먼저 건네는 말을 적어요. 비워 두면 첫마디 없이 내가 먼저 말을 걸어요. |
| `OPENING.make` · `remake` · `cancel` · `play` | 일본어로 만들기 · 일본어 다시 만들기 · 그만두기 · 들어 보기 |
| `OPENING.matchedHead` · `confirmRole(tutor)` | 역할극에서 선생님이 이렇게 말해요 · 선생님({tutor} 역할)이 먼저 건네는 말이 맞는지 확인해 주세요. 내가 할 말이면 첫마디가 아니라 대화 순서에 적어요. |
| `OPENING.koOnly` · `stale` · `staleOld` | 아직 일본어가 없어요. 아래 [일본어로 만들기]를 눌러 주세요. · 한국어를 고쳤어요. 일본어를 다시 만들어 주세요. · 예전 한국어로 만든 일본어 |
| `OPENING.gen(tutor,l)` · `fail` · `failKeep` · `empty` | 선생님이 일본어로 바꾸고 있어요 · 상황과 역할({tutor})·수준({l})에 맞춰요. 보통 3~5초 걸려요. · 일본어로 바꾸지 못했어요. 다시 해 볼까요? · 한국어는 그대로 있어요. · 첫마디가 없어요. 역할극에서는 내가 먼저 말을 걸어요. |
| `OPENING.needRoles` · `truncated` · `problemStale` · `problemKoOnly` | 역할을 먼저 적으면 일본어로 만들 수 있어요. · 일본어가 길어서 줄였어요. 뜻이 다 담겼는지 확인해 주세요. · 저장하려면 일본어 첫마디를 다시 만들어 주세요. · 저장하려면 [일본어로 만들기]를 눌러 주세요. |
| `OPENING.unfit` · `tooLong` · `noHangul` · `max` | 선생님이 처음 건넬 말을 적어 주세요. 예: 어서 오세요, 무엇을 드릴까요? · 첫마디가 길어서 일본어 한 줄로 만들기 어려워요. 조금 줄여 주세요. · 한국어로 적어 주세요. · 첫마디는 80자까지 적을 수 있어요. |
| `SHEET.badgeSeed` · `badgeCopy` · `variant` | 기본 · ✎ 내 버전 · 변형 만들기 |
| `SHEET.hide` · `hideTitle` · `hideBody` · `hideYes` | 나에게서 숨기기 · 이 상황을 숨길까요? · 기본 상황이라 나에게만 숨겨져요. 「내 상황·주제」 맨 아래 「숨긴 기본 항목」에서 다시 볼 수 있어요. 이 상황으로 한 역할극과 기록은 그대로 남아요. · 나에게서 숨기기 |
| `SHEET.revert` · `revertTitle` · `revertBody` · `revertYes` | 기본으로 되돌리기 · 기본 상황으로 되돌릴까요? · 내가 고친 내용은 목록에서 빠지고 기본 상황이 다시 보여요. 내 버전으로 한 역할극 기록은 그대로 남아요. · 기본으로 되돌리기 |
| `SHEET.hidden(t)` · `reverted` · `hideFail` · `revertFail` | 「{t}」 상황을 숨겼어요 · 기본 상황으로 되돌렸어요 · 숨기지 못했어요. 다시 눌러 주세요. · 되돌리지 못했어요. 다시 눌러 주세요. |
| `DRAFT.seedInfo` · `saveSeed` · `backManage` · `copySaved` | 기본 상황이에요. 고쳐서 저장하면 내 버전이 생기고, 내 목록에는 내 버전이 대신 보여요. · 내 버전으로 저장 · 내 상황·주제로 · 내 버전으로 저장했어요 |
| `DRAFT.copied` · `openCopy` · `notLinked` | 다른 화면에서 이미 내 버전을 만들었어요. 여기서 고친 내용은 저장되지 않았어요. · 내 버전 열기 · 지금 목록에 없는 장소예요. 목록을 새로 고친 뒤 다시 골라 주세요. |
| `VARIANT.title` · `baseHead` · `ask` · `askSub` | 변형 상황 만들기 · 원본 상황 · 무엇을 바꿔 볼까요? · 하나 이상 골라 주세요. 고르지 않은 것은 원본 그대로예요. |
| `VARIANT.levelSame(l)` · `levelUp(l)` · `levelTop` | 그대로({l}) · 한 단계 위({l}) · 이미 가장 높은 수준이라 올릴 수 없어요. |
| `VARIANT.note` · `notePlaceholder` · `submit` | 직접 적기(선택) · 예: 상대가 처음에 내 말을 못 알아들어요 · 변형 초안 만들기 |
| `VARIANT.gen` · `genSub` · `genLong` · `cancel` | 선생님이 변형 상황 초안을 만들고 있어요 · 보통 10~20초 걸려요. · 조금 더 걸리고 있어요. 그만두고 다시 만들어도 돼요. · 그만두기 |
| `VARIANT.reviewTitle` · `reviewChanged(labels)` · `reviewBody` · `changed` · `changedSr` | 변형 초안이 왔어요 · 바꾼 것 · {labels}. · 「바뀜」 칸을 확인하고 [새 상황으로 저장]해야 생겨요. 원본은 그대로예요. · 바뀜 · 원본에서 바뀌었어요 (**데모 v2 `:957` 복원**, REV-165 M-2 — 검토 안내 한 문단 = `reviewChanged` + 공백 + `reviewBody`, `{labels}` = 실제 바뀐 축의 칩 글자를 ` · ` 로 이음. 안내 **제목**은 데모의 「「{원본}」를 바꾼 초안이에요」 대신 `reviewTitle` 을 둔다 — 조사(를/을) 처리가 필요해 **코드 우선**) |
| `VARIANT.save` · `saveNote` · `baseGone` · `unfit` | 새 상황으로 저장 · 새 상황은 내 상황 50개·하루 만들기 30번에 들어가요. · 원본 상황을 찾을 수 없어요. 지웠거나 내 목록에서 숨긴 상황이에요. · 이 내용으로는 변형 상황을 만들기 어려워요. 바꿀 점을 다르게 적어 주세요. |
| `VARIANT.baseMeta(l,t,lv)` · `noteCount(n)` · `noteTooLong` · `noChange` | 나 {l} · 선생님 {t} · {lv} · {n}/100 · 직접 적기는 100자까지 쓸 수 있어요. · 바꿀 점을 하나 이상 골라 주세요.(`SCENARIO_VARIANT_NO_CHANGE_MESSAGE` 와 같은 글) — 원본 요약 줄·직접 적기 카운터·막힘 이유. **코드 우선** |
| `VARIANT.busy` · `rate(s)` · `fail` | 다른 화면에서 변형 초안을 만드는 중이에요. 끝난 뒤 다시 눌러 주세요. · 변형 초안은 1분에 6번까지 만들 수 있어요. {s}초 뒤 다시 눌러 주세요. · 잠시 문제가 생겼어요. 다시 만들어 볼까요? (§16-7 변형 #177 표와 같은 글) |
| `CHECK.forbidden` · `secretLike` | §16-7 칸 문구 표의 `forbidden_char`·`secret_like` 와 같은 글(공유 편집기용 사본 — 앱 코드는 scenario → topic import 금지라 두 벌, `common/__tests__/copySync.test.ts` 가 맞춘다). **코드 우선** |
| `CHECK.unusableIn(k)` | {칸 이름}에 쓸 수 없는 글이 있어요. 그 칸을 고친 뒤 다시 만들어 주세요. — 첫마디 제안 #178 이 상황 정보 칸(제목·목표·역할 …)을 거절했을 때 어느 칸인지 말한다. **데모에 없는 추가** |

**challengeCopy.ts 추가**: `CREATE.againTopicGone` 그 주제는 이제 내 목록에 없어요. 주제를 다시 골라 주세요. · `COPY.nextBodyNoTopic` 다음 주제로 넘어가 보세요. · `COPY.blockedNow(t,d)` 지금은 「{t}」({내일 시작|{d}일째})를 하고 있어요. · `COPY.blockedAgain` 진행 중인 챌린지가 끝나면 다시 도전할 수 있어요. (다른 챌린지가 진행 중일 때 결과 화면 상자 = `blockedNow` + 공백 + `blockedAgain`. **주제가 지워졌으면 `blockedAgain` 을 붙이지 않는다** — 같은 주제 [다시 도전]이 없어 약속이 모순이라서, REV-165 M-1. **코드 우선**)


### 16-7. 서버 응답 → 화면 문구 규칙 (`src/components/topic/failure.ts` — 단위 시험)

**규칙**
1. **서버 `message` 는 새 화면·공유 편집기에서 화면에 쓰지 않는다**(400 문구에 조사 병기 — 결함 후보가 아니라 공용 템플릿의 성질 [확실]). 문구는 `failureCopy(context, err)` 한 함수가 고른다.
2. 고르는 열쇠 = **(문맥, HTTP 상태, `details.reason`, `details.field`, `details.retryAfterSec`)** — `reason` 하나만으로 고르지 않는다: 같은 409 라도 문맥별로 `DRAFT_BUSY`·`ALREADY_COPIED`·`IMPACT_CHANGED`·`TOPIC_LIMIT`·`SCENARIO_LIMIT`·`ARCHIVED`·`USE_FORK` 이 다르고, **429 는 `rateLimit()` 이 `reason` 없이 `retryAfterSec` 만 준다**(`infra/http.ts:160` [확실]) → #57·#174·#175·#163 의 `DAILY_LIMIT`(reason 있음, KST 자정)과 #170·#166·#177·#178 의 분·하루 한도(reason 없음, 하루 = 첫 요청부터 24시간 창)를 문맥으로 가른다. 404 도 `TOPIC_GONE`·`SEED_NOT_FOUND`·`NOT_OVERRIDDEN`·`USER_GONE`·이유 없음(#28·#59 일부 — QA a1 #1)이 섞인다.
3. 표에 없는 조합 → 그 문맥의 일반 실패 문구(아래 `*.fail`) — 서버 문구로 떨어지지 않는다.
4. 400 칸 문제(`details.problems[]` 또는 `{field, reason}`) → 칸 키(`problemKey(field)`)에 아래 **칸 문구**. 칸 이름표는 고정 한글이라 조사를 미리 붙여 둔다.

**칸 문구(400 `reason` → 문구, 칸 이름 = 주제 이름·일본어 이름·설명·수준·기본 표현·일본어·읽기·뜻·주제·선생님 첫마디)**
| reason | 문구 |
|---|---|
| `required` · `no_text` | {이름표+을/를} 적어 주세요. (예: 「주제 이름을 적어 주세요.」 「뜻을 적어 주세요.」 「읽기를 적어 주세요.」 — 칸별 문자열을 표로 고정) |
| `max_length` | {이름표+은/는} {상한}자까지 쓸 수 있어요. (상한은 `TOPIC_SAVE_LIMITS`·`SCENARIO_LIMITS` 상수) |
| `forbidden_char` | 꺾쇠(< >)·링크 주소·눈에 보이지 않는 글자는 쓸 수 없어요. (서버가 꺾쇠·URL·숨은 글자를 모두 이 reason 으로 묶는다 — **코드 우선**, `topicCopy.ts` `FAIL.field.forbiddenChar`·`scenarioCopy.ts` `CHECK.forbidden`) |
| `secret_like` | 비밀번호·카드 번호·긴 영문 숫자 키처럼 보이는 글은 쓸 수 없어요. (저장 경로는 카드 번호 모양 숫자열, 초안 경로 #170·#166·#178 은 긴 영문·숫자 토큰도 이 reason — **코드 우선**, `FAIL.field.secretLike`·`CHECK.secretLike`) |
| `not_japanese` · `chars` | 일본어로 적어 주세요. · 쓸 수 없는 글자가 있어요. |
| `reading` | 읽기는 히라가나·가타카나로만 적어 주세요. |
| `duplicate` | 같은 표현이 이미 있어요. |
| `count`(chunks) | 기본 표현은 8~20개여야 해요. 지금 {n}개예요. |
| `enum` | 목록에서 골라 주세요. |
| `engine_name` | 이 칸에는 쓸 수 없는 낱말이 있어요. |
| `no_hangul`(ko) | 한국어로 적어 주세요. |
| `not_found`(`chunks[i].id`) | 다른 곳에서 바뀐 표현이 있어요. 화면을 새로 고친 뒤 다시 고쳐 주세요. |
| `not_found`·`not_linked`(`topicIds[i]`) | 지금 목록에 없는 장소예요. 목록을 새로 고친 뒤 다시 골라 주세요. |
| `type` · `unknown_key` · `conflict` · 그 밖 | 저장하지 못했어요. 화면을 새로 고친 뒤 다시 해 주세요. (화면 결함 — 콘솔 경고) |

**한도·오류 표(문맥 → 상태·이유 → 화면 동작·문구)**
| 문맥 | 조건 | 화면 동작 | 문구 |
|---|---|---|---|
| 공통 | 요청 중 | 버튼 `aria-disabled`+`aria-busy`(더블 탭 방지 — 409 도 한도를 쓴다) | — |
| 공통 | 네트워크 실패 | 그 자리 오류 + 다시 시도 | 인터넷 연결을 확인한 뒤 다시 눌러 주세요. |
| 공통 | 404 `USER_GONE` | 오류 상자 | 계정을 다시 확인해야 해요. 다시 로그인해 주세요. |
| 공통 | 429 분당(쓰기 20, `retryAfterSec` ≤60) | 그 자리 한 줄, 버튼은 누를 수 있게 | 잠시 뒤 다시 눌러 주세요. {s}초 뒤에 할 수 있어요. |
| 주제 초안 #170·D4 | 400 `title` | 칸 오류 | §칸 문구(2~40자는 화면이 먼저 막음) |
| 〃 | 422 `NOT_A_TOPIC` | 입력칸 아래 오류 + 초점 | 이 글로는 주제를 만들기 어려워요. 장소·상황·활동 이름을 적어 주세요(예: 병원 진료, 공항 체크인). |
| 〃 | 409 `DRAFT_BUSY` | 상자 | 다른 화면에서 주제 초안을 만드는 중이에요. 끝난 뒤 다시 눌러 주세요. |
| 〃 | 429, `retryAfterSec` ≤60 | 상자 | 초안은 1분에 6번까지 만들 수 있어요. {s}초 뒤 다시 눌러 주세요. |
| 〃 | 429, `retryAfterSec` >60 | 상자, 버튼 막음 | 오늘은 주제 초안을 20번 모두 만들었어요. 약 {h}시간 뒤 다시 만들 수 있어요. ({h}=올림, 1시간 미만이면 「{m}분 뒤」) |
| 〃 | 502·504 | 상자 + [다시 만들기] | 잠시 문제가 생겼어요. 다시 만들어 볼까요? |
| 상황 초안 #166(S4) | 422 `NOT_A_SCENARIO` | 절 안 + 입력 펼침 | `SCDRAFT.unfit` |
| 〃 | 409 `DRAFT_BUSY` | 절 안 | 앞 상황 초안을 아직 만들고 있어요. 끝난 뒤 다시 눌러 주세요. |
| 〃 | 429 ≤60 / >60 | 절 안 | 상황 초안은 1분에 6번까지 만들 수 있어요. {s}초 뒤 다시 눌러 주세요. / 오늘은 상황 초안을 모두 만들었어요. 상황 초안과 변형 초안을 합쳐 하루 40번까지예요. |
| 〃 | 502·504 | 절 안 + [다시 만들기] | `SCDRAFT.fail` |
| 주제 저장 #57 | 400 | 칸 오류 + 첫 문제 이동 | §칸 문구 |
| 〃 | 409 `TOPIC_LIMIT` | 저장 줄 위 | 내 주제는 30개까지예요. 안 쓰는 주제를 지운 뒤 다시 저장해 주세요. |
| 〃 | 429 `DAILY_LIMIT` | 저장 줄 위, 저장 막음 | 오늘은 주제를 10번 저장했어요. 내일 다시 저장할 수 있어요. 고친 초안은 이 탭에 남아 있어요. |
| 〃 | 5xx | 저장 줄 위 | 저장하지 못했어요. 아무것도 저장되지 않았어요. 다시 눌러 주세요. |
| 상황 저장 #163(S4·A) | 409 `SCENARIO_LIMIT` | `partial` 줄 / A 저장 줄 위 | 내 상황이 50개라 더 저장할 수 없어요. 안 쓰는 상황을 지운 뒤 다시 저장해 주세요. |
| 〃 | 429 `DAILY_LIMIT` | 〃 | 오늘은 상황을 30개 저장했어요. 내일 다시 저장할 수 있어요. |
| 〃 | 400 | 그 카드·칸 | §칸 문구 + 「고칠 곳 n군데」 |
| 〃 | 5xx·네트워크 | 〃 | 잠시 문제가 생겼어요. 다시 눌러 주세요. |
| 주제 고치기 #171 | 404 `TOPIC_GONE` | 찾을 수 없음 상태 | `TOPIC.notFound`·`notFoundBody` |
| 〃 | 409 `USE_FORK` | 다시 읽고 SEED 모드 | `EDIT.useFork` |
| 내 버전 저장 #174·#175 | 409 `ALREADY_COPIED` | 상자 + [내 버전 열기] | `EDIT.copied` / `DRAFT.copied` |
| 〃 | 404 `SEED_NOT_FOUND` | 상자 + 목록으로 | 기본 항목을 찾을 수 없어요. 목록을 새로 고칠게요. |
| 〃 | 409 `TOPIC_LIMIT`·`SCENARIO_LIMIT` · 429 `DAILY_LIMIT` | 저장 줄 위 | 위 #57·#163 문구(#174 는 「(내 버전 만들기 포함)」 붙임) |
| 지우기·되돌리기 #172 | 404 | 시트 닫고 S2 | `REMOVAL.gone` |
| #173·#176(주제) | 409 `IMPACT_CHANGED` | 본문 갱신 + 맨 위 alert + 초점, **자동 재시도 금지** | `REMOVAL.changed` |
| 〃 | 404 `TOPIC_GONE` / `NOT_OVERRIDDEN` | 시트 닫고 다시 읽기 | `REMOVAL.gone` / (되돌리기) 이미 기본으로 돌아가 있어요. |
| 〃 | 400 `ack` · 5xx | 시트 안 | `REMOVAL.fail.*` |
| 숨긴 항목 #176 | 404 `NOT_OVERRIDDEN` | 성공처럼 처리 | `HIDDEN.shown` |
| 상황 시트 #165·#176 | 404 | 시트 닫고 다시 읽기 | 이 상황은 이미 목록에 없어요. |
| 첫마디 #178 | 400 `ko` | 칸 오류 | `OPENING.noHangul`·`max`·「선생님 첫마디를 적어 주세요.」 |
| 〃 | 422 `NOT_AN_UTTERANCE` / `TOO_LONG` | 읽기 상자 안 | `OPENING.unfit` / `OPENING.tooLong` |
| 〃 | 409 `DRAFT_BUSY` | 읽기 상자 안 | 앞에서 누른 일본어를 아직 만들고 있어요. 끝난 뒤 다시 눌러 주세요. |
| 〃 | 429 ≤60 / >60 | 읽기 상자 안 | 일본어 만들기는 1분에 10번까지예요. {s}초 뒤 다시 눌러 주세요. / 오늘은 일본어 만들기를 60번 모두 했어요. 약 {h}시간 뒤 다시 할 수 있어요. |
| 〃 | 502 | 읽기 상자 안 | `OPENING.fail` + `failKeep` |
| 변형 #177 | 404 | 화면 오류 | `VARIANT.baseGone` |
| 〃 | 422 `NO_VARIATION` / `NOT_A_VARIANT` | 축 위 | 바꿀 점을 하나 이상 골라 주세요. / `VARIANT.unfit` |
| 〃 | 409 `DRAFT_BUSY` | 상자 | 다른 화면에서 변형 초안을 만드는 중이에요. 끝난 뒤 다시 눌러 주세요. |
| 〃 | 429 ≤60 / >60 | 상자 | 변형 초안은 1분에 6번까지 만들 수 있어요. {s}초 뒤 다시 눌러 주세요. / 오늘은 상황 초안을 모두 만들었어요. 상황 초안과 변형 초안을 합쳐 하루 40번까지예요. |
| 〃 | 502·504 | 상자 + [다시 만들기] | 잠시 문제가 생겼어요. 다시 만들어 볼까요? |
| 역할극 시작·수업(기존) | 409 `ARCHIVED` | 기존 | 지금은 열 수 없는 상황이에요.(기존 문구 유지) |

### 16-8. Leader 결정 필요 (권고안 포함 — 임의로 고르지 않음)

| # | 항목 | 선택지 | 권고 |
|---|---|---|---|
| L-1 | S4 상황 초안 개수·시점(데모 v2 는 「상황 초안 2개」 자동) | **A** 자동 1개 + [하나 더](학습자가 한 줄로, 최대 2) — 선생님 호출 기본 2회, 두 초안이 겹치지 않음 / **B** 자동 2개 순차 — 데모 그대로, 호출 3회, 두 번째 요청의 상황 설명을 화면이 지어내야 함(예 「{이름}에서 문제가 생겨 부탁하는 상황」 — 같은 설명이면 비슷한 초안이 2개 [가능성 높음]) | **A**. 사용자 결정 1(선생님이 시나리오 초안을 만든다)은 지켜지고 화면 구조(카드·체크·「저장할 상황 k/n」·저장 흐름)는 같다. 데모 대비 차이는 「두 번째 카드가 자동이 아니라 한 번 더 누름」 하나 → designer 판단 minor 이지만 데모에 보인 숫자가 바뀌므로 **사용자에게 한 줄 고지** 권고. B 를 고르면 PE 가 두 번째 설명 문구를 검증해야 한다 |
| L-2 | 「변형」 뱃지·「원본 · {제목}」(데모 S10 `variant`) | 표시 안 함 / 원본 칸 추가(DB 변경 — 미승인) | **표시 안 함**(minor — 변형 초안 제목이 바뀐 점을 담는다). 데모 S10 `variant` 상태는 「내 상황」으로 구현 |
| L-3 | 주제 저장 하루 10 이 하드 삭제로 우회됨(알려진 한계) | 수용 / 서버가 저장 횟수를 따로 셈 | **수용**(개인 앱, 내 주제 30 상한은 막힘). 화면은 「오늘 n번 남음」 같은 숫자를 보이지 않아 우회가 화면 약속과 어긋나지 않는다 |
| L-4 | 시드 숨김 + 진행 중 챌린지 문구 | §16-6 `REMOVAL.warn.hide`(경고 아닌 `InfoBox`) | 이 문구로 확정 요청(정책은 §0 #9 로 닫힘 — 문구만) |
| L-5 | 내 버전 지우기 문구·버튼 | 「내 버전 지우기」 + 「기본 주제도 내 목록에서 숨겨져요」(S6 아래 줄·시트 본문 두 곳) | 이 문구로 확정 요청 — T3-1 남은 위험 ④(지우면 그 주제가 목록에서 사라짐)를 화면이 말한다 |
| L-6 | #178 학습자 글 오수용(QA b1 #1, REV-151 이슈 1 재현) | 화면 확인 문구만 / + PE 가 역할 대조 지시 보강 / + 화면 확인 체크 | **확인 문구 + PE 후속 task**(T5 를 막지 않음). 체크 상자는 저장마다 마찰이라 권하지 않음 |
| L-7 | `DRAFT_BUSY` 409 가 분·하루 한도를 씀(QA b2 #2) | 화면 막기만 / + 서버가 잠금 판정을 한도 앞으로 | 화면은 더블 탭을 막는다(필수). 두 탭 경쟁은 남으므로 **서버 순서 변경(작은 수정) 권고** — T5 와 독립 |
| L-8 | #170·#166·#177·#178 의 429 에 `reason` 없음, 하루 = 24시간 창(KST 아님) | 화면이 `retryAfterSec` >60 으로 하루 한도 추정(이 가이드) / 서버가 `reason:'DAILY_LIMIT'` 추가 | 지금은 화면 추정으로 진행, 서버에 `reason` 추가를 후속 권고(문구 「약 n시간 뒤」는 정확) |
| L-9 | T5-3b 착수 전 L-1 확정 필요 | — | T5-1·T5-2·T5-5a·T5-3a 는 L-1 과 무관하게 먼저 갈 수 있다 |

**v1 가이드 §11 11개 — 코드 기준으로 닫음**
| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| 1 | `challengeCopy.removed` 와 결정 3 충돌 | 닫음 — 완료 챌린지에 안 나옴(ENDED·`TOPIC_REMOVED` 만), 새 삭제는 settle 먼저·진행 중 행 삭제. 화면 일은 「같은 주제로 한 번 더」 숨김뿐(§16-2) | `ChallengeScreen.tsx:271`·`logic.ts:570`·`settle.ts:6`·이력서 T3-1 결정 |
| 2 | #56 수준 ±1 | 닫음 — `level=all` | api-contract #56 |
| 3 | 한도 수치 | 닫음 — 30·10·20(분당)·초안 6/20·상황 50/30·#166/#177 6/40·#178 10/60 | `types/topic.ts`·api-contract §1-5 |
| 4 | 숨김 + 진행 중 챌린지 | 닫음(정책) — 챌린지 계속, 문구 L-4 | §0 #9·#173 시드 `ack` 무시 |
| 5 | 내 버전 지우기 | 닫음 — 사본 삭제 + 시드 숨김 유지, 숨긴 항목에서 다시 보기 | `TopicRemovalMode` `DELETE` |
| 6 | 되돌리기와 진행 중 챌린지·수업 | 닫음 — 사본의 진행 중 챌린지 삭제(`ack`), 내 상황은 시드 주제로 되돌아 붙음 | `RESTORE`·QA a1 항목 3 |
| 7 | 다중 주제 상황 | 닫음 — 이 주제에만 붙은 것만 보관, 나머지 연결만 끊김 | #173 |
| 8 | 「아무것도 지워지지 않았어요」 | 닫음 — #173·#176 한 트랜잭션. 단 S4 저장(주제+상황)은 아님 → `partial` | §4·§16-2 S4 |
| 9 | D1-B 프롬프트 영향 | 닫음 — B 안 만듦 | 사용자 「변형=A」 |
| 10 | 종류마다 하나 이상 | 닫음 — 필수 아님, `TYPE_THIN_*` 안내만 | `TopicWarningCode` |
| 11 | api-contract·domain-model 부재 | 닫음 — #161~#179·`UserSeedOverride` 반영 | api-contract §1-5 |
v2 보강 H-1~H-8 도 모두 닫힘(H-1 읽기 비저장 Leader ④ · H-2 #178 · H-3 Leader ① · H-4 `opening:null` 지움·상세 키 없음 · H-5 20자 · H-6 `TITLE_TRUNCATED` 있음 · H-7·H-8 문구 확정 §16-6).

### 16-9. 자체 점검 (ui-design-reviewer · ui-accessibility-reviewer — 이번에 확정한 흐름)
- **P0 0 · P1 0 · P2 4 / a11y Critical 0 · Major 0 · Minor 3**
- P2-1 S4 대기: 주제 초안(p50 12s) 뒤 상황 초안(p50 11s)까지 첫 저장 가능한 완성본이 약 25초 [가능성 높음 — QA 실측 합]. 보완: 주제 쪽은 바로 고칠 수 있고 상황 칸만 자리 카드로 기다림, 「주제만 저장」 항상 가능.
- P2-2 `partial` 은 데모 v2 에 없던 상태(구조상 필요) — 데모의 `scfail`·`savefail` 시각 언어(상단 상자·`ErrorBox`)를 그대로 써서 새 시각 요소는 없음.
- P2-3 S4 에서 상황 초안 도착 뒤 주제 이름을 고치면 상황 초안 글 속 이름이 옛 이름으로 남을 수 있음 — 저장 연결은 맞아 안내하지 않음.
- P2-4 숨긴 항목 시트가 제목만 보여 「다시 보면 무엇이 함께 돌아오는지」 모름(데이터 없음) — 다시 보기는 되돌릴 수 있는 동작이라 수용.
- Minor-1 칩·분절 화살표 키 이동 없음(v1·v2 와 같음, 공용 `Segmented`·`PlaceChips` 범위).
- Minor-2 S8/S9 409 갱신 때 초점을 시트 맨 위 alert 로 옮긴다 — 화면 읽기 사용자는 본문이 바뀐 것을 alert 로 듣지만 바뀐 줄이 어디인지는 다시 읽어야 함(줄 단위 변경 표시는 과함).
- Minor-3 첫마디 「예전 한국어로 만든 일본어」 줄 긋기는 이름표로 보완(v2 Minor-1 그대로).
- 확인한 접근성 요구: 모든 시트 제목 초점·Esc(진행 중 제외)·닫으면 연 버튼 초점 · 만드는 중 `role=status` · 오류 칸 `aria-invalid`+`aria-describedby` · 막힌 버튼은 `disabled` 가 아니라 `aria-disabled`+이유 연결(초점 가능) · 「바뀜」·✎·⚠ 는 글자로도 · 일본어 `lang="ja"` 16px · 터치 44px(행 56·76).

## 17. task-046 탭 화면 로딩·전환 규칙 (IMP-0027, 2026-10-08)

> 하단 탭으로 화면을 옮길 때 보이던 깜빡임(옛 화면 → 「불러오는 중」 → 가짜 빈 상태/CTA → 실제 내용으로 3~4번 모양이 바뀌며 본문이 자람)을 줄이는 규칙. **화면 구조·문구·기능·API·호출 시점은 바꾸지 않고 로딩 표시만 바꿨다.** 이 절이 §3-3·§4-3·§5-3·§12·§13 의 로딩 상태 표기 중 「불러오는 중…」 글자를 그리는 부분을 대체한다(탭 홈 4곳: 회화·단어장·오늘·계획표). 구현 정본: task-046 이력서(`agent-vault/10-Flow/tasks/task-046-improve-tab-loading-flicker.md`).

### 17-1. 규칙
1. **탭 누름 즉시 반응** — 누른 탭이 서버 응답을 기다리지 않고 첫 프레임(≈16ms)에 켜진다(`shell/TabBar.tsx`·`tabPress.ts`). 눌림 중에는 모양(`data-pending`)만 바뀌고 `aria-current="page"` 는 **경로가 실제로 바뀐 뒤에만** 옮겨 읽기 도구가 잘못된 현재 위치를 읽지 않는다. 이미 켜진 탭을 다시 누르거나 수정키·가운데 버튼 클릭은 눌림 표시를 켜지 않고, 8초 안에 경로가 안 바뀌면 표시를 거둔다. **`prefetch` 를 강제로 켜지 않는다** — 오늘 탭 API 가 복습 판단 잡을 만든다(운영 빌드 실측: 아무것도 누르지 않은 상태에서 `/api/v1/lessons/today` 호출 0).
2. **`loading.tsx` 는 `(tab)` 라우트 그룹에** — `study/ai/(tab)`·`study/today/(tab)`·`plan/(tab)`(각 `page.tsx` 와 같은 폴더)와 `drawer/words/loading.tsx`. `loading.tsx` 는 같은 폴더 아래 **모든 하위 경로**를 감싸므로 탭 폴더 바로 아래에 두면 채팅방·오늘의 단어/회화/평가·챌린지 화면으로 들어갈 때도 탭 자리표시가 뜬다. 그룹 폴더는 주소에 나타나지 않는다. 새 탭 홈을 만들 때도 같은 구조를 쓴다.
3. **자리표시 모양** — ① 정적으로 알 수 있는 부분(탭줄·[＋ 새 회화]·검색 줄·정렬 줄·「분석 · 성장 기록」 카드·달력의 요일 줄과 월 이동)은 자리표시가 아니라 **실제 요소를 즉시** 그린다 ② 데이터가 정하는 섹션만 회색 블록으로 채우고, 높이는 클래스 합산이 아니라 **`getBoundingClientRect` 실측 상수**(가장 흔한 상태 = 데이터가 있는 상태 기준)다 ③ 조건부 섹션(있을 때만 생기는 「채택을 기다리는 교정」·챌린지 띠·복습 카드·「곧 열려요」·통계·보관 세트)은 자리표시에 넣지 않는다 ④ **「불러오는 중…」 글자, 가짜 빈 상태, 가짜 CTA 를 그리지 않는다** ⑤ 스크린리더용 `role="status"` 알림 한 줄(「불러오고 있어요」)만 두며 자리표시 한 화면에 **하나**, `aria-busy` 래퍼 **밖**에 둔다 ⑥ 합격선: 첫 화면(뷰포트 안) 블록 위치 점프 ≤ 8px, 보이는 「불러오는 중」·가짜 CTA 프레임 0.
4. **자리표시 상수와 시험** — 상수 모듈은 `shell/tabSkeletonSizes.ts`·`vocab/todaySkeletonSizes.ts`·`plan/planSkeletonSizes.ts`(대소문자만 다른 `TabSkeleton.tsx` 등과 구분하려고 `Sizes`). 상수↔그리는 클래스를 묶는 시험이 있어 한쪽만 바뀌면 깨진다. 회화 자리표시는 `?tab=` 을 Suspense 안 클라이언트 부품에서 읽고(서버 `page.tsx` 와 같은 `parseStudyAiTab`), `scenario` 는 탭줄만 그린다. 계획표 자리표시는 실제 화면과 같은 `monthGrid` 로 그 달의 주 수를 맞춘다.
5. **한 번에 공개** — 같은 화면의 요청이 도착 순서대로 따로 그려지면 화면이 여러 번 바뀌므로 모두 끝난 뒤 한 번에 보인다. 한 요청이 실패해도 「끝남」으로 센다(실패가 나머지를 막지 않음). 상한은 둘 다 **1500ms**.
   - 회화·채팅(`chat/listHold.ts`): 교정 카드와 목록이 서로 기다린다(카드는 목록이 끝나야 보이고, 목록은 카드가 끝나거나 상한이 지나야 보인다). 오류 상자는 막지 않는다. 오류 때 「첫 결과 정해짐」 알림은 `settleFirstFailure` 가 오류 상자 표시와 같은 호출에서 낸다.
   - 오늘(`vocab/todayHold.ts`·`TodayHome.tsx`): 홈 묶음·#58·#158·평가 카드 4곳이 끝나면 공개. 진짜 카드는 `invisible`+`inert`+`aria-hidden` 으로 **제자리에 이미 마운트**돼 요청을 그대로 보내고(요청 수·시점 불변), 같은 높이 자리표시를 `absolute` 로 겹쳐 그리다 공개되면 거둔다. 한 번 공개된 뒤에는 되돌아가지 않는다([다시 시도]·화면 복귀는 카드 안 몸통 자리표시만).
6. **오류 [다시 시도]** — 자리표시가 최소 500ms(`retryFailHoldMs`) 보인 뒤 오류 상자가 돌아온다(바로 다시 실패해도 깜빡이지 않게).
7. **스크롤** — `key` 변경·remount·`scrollIntoView`·`scrollTo` 를 새로 두지 않는다(분류 칩의 기존 `scrollIntoView` 는 겹침 자리표시와 함께 검증됨).

### 17-2. 실측 요약 (운영 빌드 `next start`, 360/390/412 × 지연 없음·왕복 150ms, 변경 전 → 후)
| 화면 | 첫 화면 점프 | 상태 수 | CLS | 비고 |
|---|---|---|---|---|
| 오늘 (단어 50개) | 383~402px → **0** | 3~4 → 2 | 0.19~0.32 → 0 | 「불러오는 중」 프레임 2~3 → 0 |
| 계획표 | 257.9px(개발 서버 106px) → **0** | 2~3 → 1~3 | 0.07~0.17 → 0 | 기존 자리표시(캘린더 554·요약 172·챌린지 172)를 실측으로 교정 |
| 회화 (교정 없음) | 위쪽 블록 이동 0 | 1~3 | 0 | 본문 +103 → 0 |
| 회화 (교정 카드 있음) | 위쪽 0, 목록 +252 한 번 | 1~3 | 0.137~0.197 | 카드와 목록이 같은 프레임에 나타남 72/72 |
| 단어장 (단어 50개) | 위쪽 0, 마지막 목록만 변동 | — | ≤ 0.002 | |
| 탭 눌림 반응 | 181~192ms → **≈16ms** | | | `aria-current` 는 경로 변경 뒤(≈33ms) |

### 17-3. 알려진 한계 · 후속 후보
- 단어 **0개** 계정의 오늘 탭: 자리표시가 「단어가 있는 흔한 상태」 기준이라 첫 화면 점프 45.5px(360폭 65px) — Leader 결정으로 그대로 둠(첫 사용자 한정).
- 오늘 탭에서 챌린지 요청(#158)이 실패하면 공개 순간 오류 띠가 생겨 한 번 +75px.
- 목록 요청이 먼저 실패하고 교정 카드 요청이 그보다 늦게 끝나면 오류 상자가 카드보다 1프레임 먼저 나오고 카드가 위에 끼며 오류 상자가 252px 밀린다(드문 경로).
- 하드 로드 + 느린 회선에서 첫 2~3프레임(≈40ms)은 탭줄만 보이고 버튼·목록 자리표시가 아래로 붙는다(위쪽 이동 0).
- 단어 0개 단어장: 응답 뒤 분류 칩 줄이 접히며 빈 상자가 자리표시보다 작아져 아래가 올라간다(첫 사용자 한정).
- 계획표 월 이동: 달력이 자리표시로 돌아갔다가 새 달로 바뀌어 달력 아래가 55~154px 움직인다(**변경 전부터 있던 동작**, 탭 전환 범위 밖) — 후속 개선 후보(이전 달 격자 유지 또는 자리표시 높이를 새 달에 맞춤).
- 진행 중 챌린지 카드·기록이 있는 달의 계획표 높이는 실측하지 못했다(NOT_VERIFIED). 실기기(S25+ WebView)·TalkBack 낭독 확인 대기.
- 탭 전환 사이의 **데이터 캐시**(마지막 데이터를 유지한 채 바로 보여 주기)는 이번 범위가 아니다 — B 단계 측정 뒤 별도 결정(사용자별 열쇠·로그아웃 시 비움·무효화 규칙 필요).

## 18. task-047 안쪽 스크롤 상자 위치 기준 규칙 (IMP-0023 계열, 2026-10-10)

> 앱 셸 `main` 안의 안쪽 스크롤 상자에 위치 기준(`position`)이 없으면, 그 안의 `sr-only`(absolute·1px)가 상자가 아니라 `main` 기준으로 잡혀 `main` 의 스크롤 높이를 늘린다. 그 상태에서 숨은 라디오·체크에 초점이 가면 상자뿐 아니라 `main` 도 따로 스크롤돼 BackBar·하단 탭이 화면 밖으로 밀린다(IMP-0023 설정 화면, task-045 편집기). task-021·029·045 가 화면마다 한 곳씩 고쳐도 같은 결함이 남아, 한 규칙으로 막았다. **화면 모양·간격·문구·기능은 바뀌지 않고 위치 지정만 바뀐다.** 구현 정본: task-047 이력서(`agent-vault/10-Flow/tasks/task-047-improve-scroller-relative.md`).

### 18-1. 규칙
1. **전역 규칙 한 개** — `src/app/globals.css` 의 `@layer base`: `:where(main .overflow-y-auto:not(textarea), main .overflow-auto:not(textarea), main .overflow-y-scroll:not(textarea), main .overflow-scroll:not(textarea)) { position: relative }`. `:where()` 라 명시도 0 이고 `base` 층이라 `absolute|fixed|sticky|relative` 유틸리티가 항상 이긴다.
   - `main` **안**으로 좁혔다: `body` 로 포털하는 공용 `Sheet` 등 `main` 밖 상자는 따로 containing block 이 있어 건드리지 않는다.
   - `textarea` 는 뺐다: 폼 컨트롤은 자식 요소를 가질 수 없어 `sr-only` 자손이 있을 수 없으니 얻는 것이 없고, 위치 지정 요소가 되면 Chromium 이 따로 그려 초점 링 가장자리 픽셀이 달라진다(QA-047a-L1, 채팅방 `Composer`).
   - 가로 줄(`overflow-x-auto`)은 대상이 아니다(내용이 짧고 `sr-only` 자손은 `DayStrip` 하나뿐).
2. **콘솔** — 콘솔 `main` 은 조상에도 위치 지정이 없어 안쪽 상자가 없어도 `sr-only` 가 **문서** 기준으로 잡혀 문서 스크롤을 늘린다. 규칙은 `main` 요소 자신에는 닿지 않으므로 `ConsoleShell` 의 `main` 에 직접 `relative` 를 달았다(앱 셸 `main` 은 `(app)/layout.tsx` 에서 이미 `relative`, task-029).
3. **새 화면을 쓸 때** — 안쪽 세로 스크롤 상자는 접두어 없는 `overflow-y-auto|overflow-auto|overflow-y-scroll|overflow-scroll` 를 쓰면 자동으로 보호된다. `md:overflow-y-auto`·`overflow-[auto]`·`!overflow-y-auto`·인라인 스타일처럼 규칙이 못 덮는 형태를 쓰면 시험이 실패하므로 같은 요소에 접두어 없는 `relative|absolute|fixed|sticky` 를 직접 달거나(자손에 `sr-only`·`absolute` 가 있다면 `relative`) 시험의 허용 목록에 사유를 적는다.
4. **시험** — `src/components/shell/__tests__/scrollBoxPosition.test.ts`: 규칙이 `@layer base` 에 살아 있고 네 선택자가 모두 있는지, 소스의 모든 세로 스크롤 토큰이 접두어 없는 표준 토큰인지(변형 금지), 허용 목록(`Sheet`·`Composer`·`WordForm`·`ConsoleNav`)의 사유가 기대는 사실, 콘솔 `main` 의 `relative`, 빈 통과 방지(파일·토큰 하한). 기존 `scenario/__tests__/editorScroller.test.ts`·`app/(app)/__tests__/appShellScroll.test.ts` 와 함께 유지한다.

### 18-2. 실측 요약 (운영 빌드 `next start`, 변경 전 ↔ 후 같은 쿠키로 비교, 읽기 전용)
- **앱 셸 144 상태·콘솔 291 셀**: 요소 위치(기하)·겹침 순서(`elementsFromPoint` 격자)·픽셀 차이 0. 규칙이 실제로 `static` → `relative` 로 바꾼 곳은 `eval/new`·`eval/history`·`plan/challenge/new` 상자뿐이었다.
- **스크롤 누수 대조**(상자에 2400px 블록 + 숨은 라디오 `focus()`): 앱 셸 `main` Δ 1788~2650 → **0**, 콘솔 문서 Δ 2797~3665 → **0**(원래 `relative` 인 편집기·`MessageList` 는 전후 0).
- **예상된 차이**: 콘솔 `lexicon` 표의 `sr-only caption` 좌표가 문서 기준에서 `main` 기준으로 바뀜(보이지 않는 요소, 픽셀·겹침 0). 콘솔 설정 화면 데스크톱 초점 링 가장자리 서브픽셀 차이(최대 채널 ±5/255, 모바일은 0) — 콘솔 `main` 에 `relative` 를 다는 것 자체의 결과로 수용.

### 18-3. 알려진 한계
- 데이터가 있어야 열리는 화면(레슨 단계·평가 진행/결과·역할극 결과·진행 중 챌린지·콘솔 설정 편집/diff)은 실측하지 못했다(NOT_VERIFIED). 정적 분석(REV-173 표 A 13곳)과 단순화 재현·DOM 주입 대조로 갈음.
- 시험은 정적 소스 스캔이다 — 동적으로 조립되는 클래스·템플릿 리터럴 안 삼항 따옴표·`.css` 클래스형 규칙은 못 잡는다(현재 소스에 해당 모양 없음). `input`·`select` 에 스크롤 클래스를 쓰면 규칙이 `relative` 로 바꾼다(현재 없음).
- 빌드 CSS 에 쓰이지 않는 유틸리티 몇 개가 생김(새 시험 파일의 문자열을 Tailwind 가 후보로 읽은 것으로 추정, 약 410B, 화면 영향 없음 [추측]).
- 앱 WebView·Safari·실기기·가상 키보드 상태는 미확인.

## 19. task-051 JLPT 단계 기본 단어 (IMP-0007, 2026-10-10)

> **승인 데모: `docs/demo/task-051-jlpt-tier-wording-v1.html` (v1)** — 파일 sha256 앞 12자 `42a69f93f068`, 토큰 `src/app/globals.css@sha256:a314f18f1807`(지금 파일과 같음). 사용자 승인 2026-10-10 22:56, 원문 「task-051 데모 v1 승인, D1 C·D2 A·D3 B·D4 B·D5 A·D6 A」.
> **정본은 데모 「결정 필요」 패널에서 이 조합을 고른 화면이다.** 데모를 처음 열면 권고안(D1-A·D3-A·D4-A·D6-C)이 그려지므로 패널에서 C·A·B·B·A·A 로 바꿔 본다. 데모 안의 N1 옛 이름(D1-C 로 바꾸기 전 이름)과 단계 수(674·630·1,659·1,778·3,070, 합계 7,811)는 데모를 만들 때 값이라 **이 절이 이긴다**. 데모와 다르게 쓴 곳은 19-9 에 모았다.
> 기본 단어 팩이 JLPT 5단계(N5~N1)로 늘어나 단어장·오늘의 단어·추가 시트의 넣기 문구, 단어 상세·입력의 수준 표시, 설정의 수준 선택과 맨 아래 출처 줄이 바뀐다. 스키마·API 모양은 바뀌지 않는다(#46b `pack` 값만 다섯 개). 이력서: `agent-vault/10-Flow/tasks/task-051-improve-n5-vocab-pack.md`.
> 적용 토큰(이름만, 새 색 없음): `--color-accent` · `--color-on-accent` · `--color-ink` · `--color-ink2` · `--color-surface` · `--color-surface2` · `--color-line`. 공용 컴포넌트: `Btn` · `Card` · `Section` · `Badge` · `Segmented`(두 줄 변형 추가) · `Sheet` · `Toast`.

### 19-1. 결정 최종값

| # | 고른 안 | 화면에 미치는 것 |
|---|---|---|
| D1 | **C** — `초보자 (N5)` · `초급 (N4)` · `중급 (N3)` · `고급 (N2)` · `최상급 (N1)` | 모든 수준 표시가 「이름 (코드)」. N1 옛 이름은 화면·문구·시험 어디에도 쓰지 않는다 |
| D2 | **A** — 설정 지금·목표 수준을 두 줄 분절로 | `Segmented` 두 줄 변형(19-4 F-1) |
| D3 | **B** — 팩 단어의 분류(`category`) = 단계 이름(`seedPackCategory`) | 서버가 넣는다. **기존 소유자 50개는 `N5 기초` 그대로라 분류 칩이 `N5 기초`·`초보자 (N5)` 둘로 갈린다**(합치기 = 데이터 변경, 범위 밖) |
| D4 | **B** — 목표 수준(`goalLevel`) 보조 버튼 | 지금 수준·선생님 대화 수준은 안 바뀐다. 목표 수준을 정해 둔 단계만 넣을 수 있다 |
| D5 | **A** — 설정 맨 아래 출처 한 줄 + 누르면 시트 | 새 `DataCreditRow`(19-4 F-2) |
| D6 | **A** — 확인 창 없이 바로 넣기 | 확인 시트를 만들지 않는다 |

**위험 (D6-A, 사용자 고지 완료)**: 넣은 단어를 한꺼번에 빼는 API·화면이 없다(words 는 GET·POST, categories 는 GET 만). 잘못 누르면(최상급은 3천 개가 넘는다) 하나씩 지우거나 보관해야 한다.

### 19-2. 단일 출처 — 화면에 이름·숫자를 직접 쓰지 않는다

- `@/types/seedPack`(리프 파일, 클라이언트 import 가능, 단어 JSON 을 싣지 않음): `SEED_PACKS`(N5→N1 순서) · `type SeedPack` · `SEED_PACK_LABEL[pack]`(표시 이름) · `seedPackCategory(pack)`(분류 칩 이름, 표시 이름과 같은 글자) · `SEED_PACK_COUNT[pack]`(개수) · `isSeedPack(v)`. **이 파일과 `seedPackCounts.ts`(생성 파일)는 화면 작업에서 고치지 않는다.**
- 지금 개수(참고용, 코드에 쓰지 않음): 초보자 676 · 초급 629 · 중급 1,649 · 고급 1,767 · 최상급 3,034 · 합계 7,755. 데이터를 다시 만들면 생성 파일만 바뀐다.
- `labels.ts` 에 세 함수를 둔다:
  - `levelLabel(l)` = `SEED_PACK_LABEL[l]` — `WordEntry.jlpt`(`JlptLevel`)와 `SeedPack` 은 같은 다섯 값이다. 타입이 안 맞으면 `isSeedPack` 으로 좁힌다.
  - `levelName(l)` = `SEED_PACK_LABEL[l]` 에서 끝의 ` (N5)` 를 뗀 이름(`초보자`) — 두 줄 분절 위쪽 글자·설정 도움말에만 쓴다. 시험: 다섯 값 모두 괄호가 없고 `` `${levelName(l)} (${l})` === SEED_PACK_LABEL[l] ``.
  - `fmtCount(n)` = `n.toLocaleString('ko-KR')`(천 단위 쉼표).
- 금지: 화면 코드·`labels.ts` 의 N1 옛 이름, `'N5 기초'` 를 새로 만드는 코드(기존 행은 받은 글자 그대로 그린다), `50`·`674`·`7,811` 같은 개수 상수.

### 19-3. 어느 단계를 넣나 — `useSeedLevels`

- 값의 출처: **#11 `GET /api/v1/settings/profile`** 의 `level`(주 버튼)·`goalLevel`(보조 버튼). API 변경 없음(이미 쓰는 곳: `LearningSettings`·`CorrectionModeMenu`·`displayPrefs`).
- 새 훅 `useSeedLevels()`(`components/vocab/hooks.ts`): `{ status: 'loading' | 'ready' | 'error', main: SeedPack | null, goal: SeedPack | null, retry: () => void }`.
  - `main` = `isSeedPack(level) ? level : null`
  - `goal` = `isSeedPack(goalLevel) && goalLevel !== main ? goalLevel : null` — 목표 수준이 `없음`이거나 지금 수준과 같으면 보조 버튼을 그리지 않는다. 목표가 지금보다 낮은 단계여도 조건은 「다름」 하나뿐이라 그린다.
  - `status === 'error'` 거나 `level` 이 다섯 값이 아니면 `main = null`, `goal = null`.
- 부르는 곳: `WordsScreen`·`TodayHome` 마운트 때 한 번, 목록·홈 요청과 **동시에** 보낸다. 설정에서 수준을 바꾸고 돌아오면 화면이 다시 마운트되며 새로 읽는다(탭 전환 데이터 캐시 없음 — §17).
- **단계를 모를 때(`main === null`)는 넣기 버튼을 그리지 않는다.**
  - `loading`: 빈 단어장 카드(`noWords`)와 오늘 카드 `empty` 는 #11 이 끝날 때까지 지금 로딩 모양을 유지한다(#46 이 먼저 끝나도 기다림 — 버튼이 늦게 끼어들어 카드가 커지지 않게). 단어가 있는 목록·준비 카드는 기다리지 않는다. 추가 시트는 넣기 줄(구분선 포함)을 그리지 않는다.
  - `error`: 빈 단어장 카드 본문 「아는 단어를 직접 넣어 보세요. 채팅에서 채택한 표현도 여기에 모여요.」, 오늘 카드 본문 「오늘의 단어는 내 단어장에서 골라요.」, 두 카드 모두 넣기 버튼 대신 글자 버튼 **「수준을 불러오지 못했어요 · 다시 시도 ›」**(44px·13px·accent, `retry`)을 [직접 추가] 위에 둔다. 추가 시트는 넣기 줄을 그리지 않는다(재시도 없음 — 시트의 주 목적은 직접 넣기). *(데모에 없던 상태 — 19-9 ④)*

### 19-4. 컴포넌트별 지침

`{L}` = `levelLabel(pack)`, `{n}` = `fmtCount(SEED_PACK_COUNT[pack])`. `main`·`goal` 은 19-3.

**A. `WordsEmpty` — `noWords`** (데모 상태 A)
- props 바꿈: `seeding: boolean`·`onSeed()` → `levels: { status, main, goal, retry }` · `seedingPack: SeedPack | null` · `onSeed(pack: SeedPack)`.
- 제목 그대로 「단어장이 비어 있어요」.
- 본문: `{L(main)} 기본 단어 {n(main)}개로 바로 시작하거나, 아는 단어를 직접 넣어 보세요. 채팅에서 채택한 표현도 여기에 모여요.`
- 버튼 열(`mt-3 flex flex-col gap-2`, 위에서 아래로):
  1. primary full — `{L(main)} 단어 {n(main)}개 넣기`
  2. goal 이 있을 때만 ghost full — `목표 수준 {L(goal)} 단어 {n(goal)}개 넣기`
  3. ghost full — `직접 추가`(그대로)
- 위계: 채운 accent 버튼은 주 하나뿐이다. 보조는 [직접 추가]와 같은 ghost 이고 주 바로 아래 자리와 「목표 수준」 머리말로 구분한다. 데모 D4-A 의 「다른 수준 단어는 설정에서…」 링크는 넣지 않는다.

**B. `WordAddSheet` — 맨 아래 넣기 줄** (데모 상태 B)
- props 바꿈은 A 와 같다(`levels`·`seedingPack`·`onSeed(pack)`).
- `<hr>` 아래 글자 버튼(`TEXT_BTN` = 44px·13px·accent, `self-start`)을 세로로 붙여 둔다:
  1. `{L(main)} 기본 단어 {n(main)}개 한 번에 넣기 ›`
  2. goal 이 있을 때만 `목표 수준 {L(goal)} 단어 {n(goal)}개 한 번에 넣기 ›`
- 누른 뒤: 시트는 그대로 열려 있고 결과는 토스트, 뒤 목록은 지금처럼 `reloadAll()`. 데모 D4-A 의 12px 안내(「수준은 설정 › …」)는 넣지 않는다.
- `main === null` 이면 구분선과 두 글자 버튼을 모두 그리지 않는다.

**C. `TodayWordsCard` — `empty`** (데모 상태 C)
- 본문: `오늘의 단어는 내 단어장에서 골라요. {L(main)} 기본 단어로 바로 시작해 볼까요?`
- 버튼: primary full `{L(main)} 단어 {n(main)}개 넣기` → (goal 있을 때) ghost full `목표 수준 {L(goal)} 단어 {n(goal)}개 넣기` → ghost full `단어 직접 추가`(→ `/drawer/words?add=1`, 그대로). 보관 단어 안내 줄은 그대로.
- 넣은 뒤 지금처럼 `setTick` → 카드가 준비 상태([시작하기])로 바뀐다.
- 보조 버튼이 있으면 카드가 56px(48 + 간격 8) 커진다 — 오늘 홈 첫 화면(≈780px) 안에서 [시작하기]·회화 카드 위치를 3폭에서 확인.

**D. 넣기 → 결과** (데모 상태 D, D6-A — 확인 시트 없음)
- `useSeedPack()` → `{ seed(pack: SeedPack): Promise<SeedPackResult>, seedingPack: SeedPack | null }`. 요청 `apiPost('/api/v1/words/seed-pack', { pack })` — 지금의 `{ pack: 'N5' }` 고정을 지운다.
- 상태: `idle` → (누름) `busy(pack)` → 성공·실패 모두 `idle`.
  - busy 동안 **누른 버튼만** 글이 「넣는 중…」 + `aria-busy="true"`.
  - 같은 화면의 다른 넣기 버튼(주·보조, 시트의 두 글자 버튼)은 `aria-disabled="true"` 이고 누르면 아무 일도 없다(`disabled` 속성은 쓰지 않는다 — 초점이 사라지지 않게, 지금 코드 방식). [직접 추가]·[직접 입력하기] 등 다른 버튼은 막지 않는다.
  - 두 번 탭 방지: 상태 갱신 전 두 번째 탭을 막도록 훅 안 `ref`(`inFlight.current`)로도 막는다. 화면 쪽 `if (seedingPack) return` 도 유지.
- 결과 토스트 `seedResultText(pack, r)`(인자에 pack 추가, 숫자는 `fmtCount`):

  | 경우 | 문구 |
  |---|---|
  | `added > 0`, `skipped === 0` | `{L} 단어 {added}개를 넣었어요` |
  | `added > 0`, `skipped > 0` | `{L} 단어 {added}개를 넣었어요 · 이미 있는 {skipped}개는 건너뛰었어요` |
  | `added <= 0` | `{L} 단어가 이미 모두 들어 있어요` |
  | 실패 | `actionErrorText(e)` — 공통 표(`NETWORK_ERROR`·`GENERIC_ERROR`) 그대로, 새 문구 없음 |

- 건너뛴 수는 서버 값 그대로 쓴다. 기존 50개를 가진 사용자가 초보자를 넣으면 같은 (표기, 읽기)만 건너뛴다 — `ご飯`·`友だち` 는 팩의 `御飯`·`友達` 와 표기가 달라 함께 남는다(SOURCES.md 가공 내용 6, 버그 아님).
- 실패하면 서버가 한 트랜잭션으로 전부 되돌린다(api-contract #46b) — 버튼이 다시 눌리고, 다시 눌러도 같은 단어가 두 번 들어가지 않는다.
- 성공 뒤 목록·홈 갱신은 지금 그대로(`reloadAll`·`setTick`). 토스트는 기존 `Toast`(`role=status`) — 버튼 글이 바뀌므로 따로 live 영역을 두지 않는다.
- 진행 표시는 「넣는 중…」 하나뿐이다. 최상급 3천여 개를 넣는 시간은 재지 않았다(QA 측정, 서버 트랜잭션 상한 30초 — 넘으면 실패 토스트).

**E. 단어 상세·입력** (데모 상태 E)
- `WordDetailSheet` 뱃지 줄: 품사 · `w.jlpt ? levelLabel(w.jlpt)` · **category 가 있고 수준 뱃지 글과 다를 때만** category · 조각 · (보관) 「보관함」. 팩 단어(category = 수준 이름)는 수준 뱃지 하나만, 기존 50개는 `초보자 (N5)` + `N5 기초` 두 개가 보인다.
- `SOURCE_SENTENCE.SEED` = **「기본 단어 팩에서 넣었어요」**(모든 단계 같은 문장 — 단계는 뱃지가 말한다).
- `WordForm` 「수준」 select: `<option value="">선택 안 함</option>` 다음 `JLPT_LEVELS` 순서로 `value="N5"`… 라벨 `levelLabel`. 네이티브 select 를 그대로 쓴다(안드로이드 기본 선택 창). 폼 2열(품사·수준)이 360 에서 각 ≥150px 인지 다시 확인 — 고른 값 「최상급 (N1)」 이 select 안에서 잘리지 않아야 한다.
- `WordRow`(목록 행)는 수준을 그리지 않는다(범위 밖).
- 분류 칩(`CategoryChips`)·목록 조건 줄(`listConditionText`)은 category 글자를 그대로 쓴다 — `초보자 (N5)` 처럼 공백·괄호가 들어간다(목록 요청은 `URLSearchParams` 가 인코딩).

**F-1. 설정 `LearningSettings` — 지금·목표 수준** (데모 상태 F, D2-A)
- `Segmented` 에 두 줄 변형을 더한다: 옵션 `{ value, label, sub? }` + prop `twoLine`(+ `describedBy?`). 기존 한 줄 사용처는 바뀌지 않는다.
  - 칸 높이 48px(`h-12`), 위 줄 `label` 13px `leading-[1.2]`(목표 수준 6칸은 12.5px), 아래 줄 `sub` 11px `text-ink2`, 두 줄 사이 1px, 좌우 여백 2px, 두 줄 모두 `truncate`. 고른 칸 모양(surface 배경·그림자·굵게)은 지금과 같다. 「없음」 칸은 한 줄(`label` 만).
  - 칸마다 `aria-label` = `levelLabel(v)`(「초보자 (N5)」), 「없음」 칸은 「없음」.
- 옵션: `JLPT_LEVELS.map((v) => ({ value: v, label: levelName(v), sub: v }))`. 목표 수준은 앞에 `{ value: 'NONE', label: '없음' }`.
- 지금 수준 분절 바로 아래 도움말(12px `text-ink2`, `id` 를 두고 분절에 `aria-describedby`):
  **「선생님 대화와 기본 단어 넣기가 이 수준을 따라요. 이름은 JLPT 급수와 같아요 — {levelName('N1')}은 가장 높은 급수(N1)예요.」** → 지금 값은 「…— 최상급은 가장 높은 급수(N1)예요.」
- 목표 수준 아래에는 도움말을 더하지 않는다(데모와 같음). 저장은 지금 [학습 설정 저장] 하나.
- 360폭: 목표 수준 6칸은 칸 폭이 약 46px 이다 — 「최상급」(12.5px 세 글자)이 들어간다(데모 헤드리스 360 잘림 0건). 실제 컴포넌트로 다시 확인.

**F-2. 설정 맨 아래 — `DataCreditRow`** (새 파일 `src/components/settings/DataCreditRow.tsx`, 클라이언트, D5-A)
- 위치: `app/(app)/settings/page.tsx` 의 `<AppVersionRow />` **바로 아래**, `{showConsole ? <AdminConsoleEntry /> : null}` **위**. **웹·앱 모두** 그린다(앱 버전 줄과 달리 앱 검사 없음) — 웹에서는 음성 인식 설정 바로 아래, 일반 사용자에게는 설정의 마지막 줄이 된다.
- 줄: `<Section>` 안 `<button type="button" aria-haspopup="dialog">`, `Card` 모양 `flex min-h-[56px] w-full min-w-0 items-center justify-between gap-3 text-left`.
  - 왼쪽(`min-w-0`): 「단어 자료 출처」 14px `text-ink` · 「OpenJLPT 외 · CC BY-SA 4.0」 12px `text-ink2`, 둘 다 `truncate`.
  - 오른쪽: `›` 18px `text-ink2` `aria-hidden`. 접근 이름은 보이는 두 줄 글자 그대로.
- 누르면 공용 `Sheet`(제목 「단어 자료 출처」) — 열면 제목으로 초점, Esc·바깥 누름·[닫기]로 닫히고 닫히면 줄 버튼으로 초점이 돌아간다(기존 `Sheet` 규칙). 내용(위에서 아래로, 14px 본문·13px `text-ink2` 보조):
  1. 「다섯 단계 기본 단어 **{fmtCount(합계)}**개는 공개 자료 **OpenJLPT** 를 바탕으로 만들었어요.」 — 합계 = `SEED_PACK_COUNT` 다섯 값의 합(지금 7,755).
  2. 「JLPT 공식 단어 목록이 아니에요. 급수는 공개 자료가 추정한 값이에요.」
  3. 자료 목록 `<dl>`(칸마다 `surface2` 배경·12px 둥근 모서리·10/12px 안쪽 여백, 칸 사이 10px; `dt` 14px 굵게, `dd` 12.5px `text-ink2`, 주소 `dd` 12px 고정폭 `select-all`):

     | `dt` | `dd` | 주소(글자만) |
     |---|---|---|
     | OpenJLPT | evanclan · CC BY-SA 4.0 | `github.com/evanclan/OpenJLPT` |
     | JLPT 급수 단어 목록 | Jonathan Waller (Tanos) · CC BY | `tanos.co.uk/jlpt` |
     | JMdict 사전 | EDRDG · CC BY-SA 4.0 | `edrdg.org` |

  4. 「한국어 뜻·예문은 AI 가 새로 썼고, 사람은 일부만 확인했어요. 틀린 곳이 보이면 단어를 눌러 고칠 수 있어요.」
  5. 「이 앱의 기본 단어 자료도 같은 CC BY-SA 4.0 으로 둬요.」 + 그 아래 12px 고정폭 `creativecommons.org/licenses/by-sa/4.0`(글자만) *(가이드 추가 — 19-9 ②)*
  6. [닫기] ghost full.
- **주소는 링크로 만들지 않는다**(글자만) — 앱 WebView 가 바깥 사이트로 나가지 않게.
- **Tatoeba 줄은 넣지 않는다** — 예문 생성 입력에 쓰지 않았다(`prisma/seed-data/SOURCES.md`). 엔진·모델 이름도 넣지 않는다(「AI」 일반어만).
- 문구는 컴포넌트 안 상수 한 곳(`DATA_CREDIT`)에 둔다. 시험: 「Tatoeba」와 N1 옛 이름이 없고, 합계가 `SEED_PACK_COUNT` 에서 계산되는지.

### 19-5. API 호출 계획

| # | 엔드포인트 | 메서드 | 보낼 값 | 쓰는 필드 | 오류 처리 |
|---|---|---|---|---|---|
| 11 | `/api/v1/settings/profile` | GET | — | `level` · `goalLevel` | 실패·잘못된 값 → 19-3 `error` 대체(넣기 버튼 숨김 + 「다시 시도」). 401 은 기존 공통 처리 |
| 46b | `/api/v1/words/seed-pack` | POST | `{ pack: SeedPack }`(`N5`·`N4`·`N3`·`N2`·`N1`) | `added` · `skipped` | 토스트 `actionErrorText`. `400 VALIDATION` 은 `isSeedPack` 으로 보내기 전에 막는다 |

### 19-6. 생성·수정 파일 (`src/app`·`src/components` 만)

| 구분 | 파일 |
|---|---|
| 생성 | `src/components/settings/DataCreditRow.tsx` |
| 수정 | `src/components/vocab/{labels.ts, hooks.ts, WordsEmpty.tsx, WordAddSheet.tsx, WordsScreen.tsx, TodayWordsCard.tsx, TodayHome.tsx, WordDetailSheet.tsx, WordForm.tsx}` · `src/components/common/Segmented.tsx`(두 줄 변형) · `src/components/settings/LearningSettings.tsx` · `src/app/(app)/settings/page.tsx` · 해당 시험(`components/vocab/__tests__/labels.test.ts` 등) |
| 고치지 않음 | `src/types/seedPack.ts` · `src/types/seedPackCounts.ts` · `src/modules/**` · `prisma/seed-data/**`(SOURCES.md 포함) · 데모 파일 |

### 19-7. 구현 순서
1. `labels.ts` — `levelLabel`·`levelName`·`fmtCount`·`seedResultText(pack, r)`·`SOURCE_SENTENCE.SEED` + 시험.
2. `hooks.ts` — `useSeedLevels`·`useSeedPack(pack)`(+ `inFlight` ref).
3. 단어장 — `WordsEmpty`·`WordAddSheet`·`WordsScreen`(levels·seedingPack 전달, 빈 카드 대기).
4. 오늘 — `TodayWordsCard`·`TodayHome`.
5. 상세·입력 — `WordDetailSheet`·`WordForm`.
6. 설정 — `Segmented` 두 줄 변형 → `LearningSettings`.
7. `DataCreditRow` → `settings/page.tsx` 배치.
8. 360·390·412 확인(19-8 첫 줄의 조합 포함) + 웹·앱 양쪽 설정 맨 아래.

### 19-8. 주의사항
- **가장 긴 글(3폭)**: 주 버튼 「최상급 (N1) 단어 3,034개 넣기」는 한 줄. **보조 버튼 「목표 수준 최상급 (N1) 단어 3,034개 넣기」는 360폭 카드 안 글자 자리가 약 268px 라 15px 한 줄이 빠듯하다**[추측] — `truncate` 금지, `whitespace-normal break-keep leading-[1.25]` 로 48px 안 두 줄을 허용하고 360 에서 (지금 고급 · 목표 최상급) 조합을 확인한다. **QA 실측(2026-10-11, 레인 B)**: 360 에서 한 줄·높이 48px 로 들어가 두 줄 허용은 쓰이지 않았다(예비로 유지). 보조 버튼이 생기면 오늘 카드는 240→296px(+56px, 3폭 동일)로 커지고 [수업 만들기]는 하단 탭 위에 남는다. 추가 시트의 같은 글자 버튼(13px)도 줄바꿈을 허용한다. 데모는 보조 버튼을 「지금 다음 단계」로만 그려 이 조합을 그리지 않았다.
- 빈 상태·로딩·오류: 19-3. 오프라인이면 넣기 실패 → `NETWORK_ERROR` 토스트, 수준 읽기 실패 → 「다시 시도」.
- 권한: #11·#46b 는 로그인 사용자 본인 것만 — 화면에 추가 권한 분기 없음.
- 화면당 세로 스크롤 1곳 유지(출처 시트 안 스크롤은 `Sheet` 규칙). 탭 5개·상단 아바타 변화 없음.
- D3-B 결과: 소유자 계정 분류 칩이 `N5 기초 50`·`초보자 (N5) {added}` 로 갈린다 — 버그 아님. 칩 합치기(기존 행 이름 변경)는 D3-C 로 고르지 않았다.
- 여러 단계를 넣으면 오늘의 단어 세트가 큰 단계로 쏠린다(세트 생성 규칙, Leader 기록) — 화면 범위 밖, 후속 task 후보. 분류 칩으로 단계를 골라 풀 수는 있다.
- 사용자 화면 엔진명 0건: 출처 시트·문구에 모델·엔진 이름을 넣지 않는다.

### 19-9. 데모와 다르게 쓴 곳 (Leader 확인)
1. **개수**: 데모의 674·630·1,659·1,778·3,070·7,811 → `SEED_PACK_COUNT`(지금 676·629·1,649·1,767·3,034·합 7,755).
2. **출처 시트 문구**: Tatoeba 줄 삭제(쓰지 않음) · 「한국어 뜻·예문은 선생님이 새로 채웠어요」 → 「AI 가 새로 썼고, 사람은 일부만 확인했어요」(SOURCES.md 가공 내용 2·4) · 첫 줄 「기본 단어(옛 단계 이름 범위, 7,811개)는」 → 「다섯 단계 기본 단어 {합계}개는」(옛 이름 제거, 이름을 따로 적지 않게) · 둘째 줄 「JLPT 는 공식 단어 목록을 내지 않아요」 → 「JLPT 공식 단어 목록이 아니에요」(비공식 고지를 앞에) · **라이선스 주소 한 줄 추가**(CC BY-SA 4.0 표시 요건을 돕는 글자 한 줄 — 원치 않으면 빼도 화면 구조는 같다).
3. **보조 버튼 단계**: 데모는 「지금 수준의 다음 단계」로 그렸다 → 구현은 실제 `goalLevel`(데모 D4-B 설명 「목표 수준이 있고 지금 수준과 다르면」을 따름).
4. **수준을 못 읽을 때**: 데모에 없던 상태 — 넣기 버튼을 숨기고 새 글자 버튼 「수준을 불러오지 못했어요 · 다시 시도 ›」 하나를 둔다(19-3).
5. 데모 D2·D5 는 사용자에게 따로 묻지 않고 권고안을 그렸고, 승인 문장에 D2 A·D5 A 로 확정됐다.

---

## 20. 카카오톡 공유하기 수신 (task-052, IMP-0004, 2026-10-11)

> **승인 데모: `docs/demo/task-052-share-target-v1.html` (v1)** — 파일 sha256 앞 12자 `c6851e6d7601`, 토큰 `src/app/globals.css@sha256:a314f18f1807`(지금 파일과 같음). 사용자 승인 2026-10-11 10:11, 원문 「데모 v1 승인, D1~D6은 모두 A」. 데모를 처음 열면 그려지는 권고안이 곧 승인안이다(D1~D6 모두 A).
> 카톡 메시지를 길게 눌러 [공유] → Lingofy Japanese 를 고르면 앱이 열리고 붙여넣기 화면(§12-2 C, `LessonPasteScreen`)에 글이 채워진다. 서버로는 사용자가 [이 문장으로 수업 만들기]를 누를 때만 지금 경로(#59 `{sourceText}`)로 간다. **API·스키마 변경 없음.** 이력서: `agent-vault/10-Flow/tasks/task-052-improve-kakao-share-target.md`(「Leader 결정 — 구현 계약」이 네이티브·브리지 정본).
> 적용 토큰(이름만, 새 색 없음): `--color-surface` · `--color-surface2` · `--color-ink` · `--color-ink2` · `--color-line` · `--color-bad`(기존 안내 그대로). 공용 컴포넌트: `Btn`(ghost·sm) · `Toast`/`useToast` · `BackBar`(그대로).
> 분담: **dev-N** = `android/**` · `src/modules/infra/native/*.ts`(브리지 3함수) · `tests/live/fake-capacitor.js`. **dev-W** = 이 절의 화면 파일 전부(20-7). dev-W 는 브리지 함수를 **이름으로만** 쓰고 네이티브를 직접 만지지 않는다.

### 20-1. 결정 최종값

| # | 고른 안 | 화면에 미치는 것 | 데모 상태 |
|---|---|---|---|
| D1 | **A** 맨 위 안내 띠 | 붙여넣기 화면 내용 맨 위에 띠 1개(`role=status`). 화면을 떠나기 전까지 남는다 | A · G |
| D2 | **A** 바꾸고 띠에 [쓰던 글로 되돌리기] | 쓰던 글이 있으면 공유한 글로 바꾸고, 쓰던 글은 **이 화면 메모리에만** 둔다. 되돌리기·다시 넣기를 오갈 수 있다 | B |
| D3 | **A** 다 넣고 [2,000자에 맞춰 자르기] | 2,000자 초과면 기존 빨간 안내 아래 자르기 줄(문장 끝에서, [되돌리기]). **직접 붙여넣은 긴 글에도 같은 줄**(공유 전용 아님) | C2 |
| D4 | **A** 로그인 화면 한 줄 + 로그인 뒤 같은 붙여넣기 화면 | 로그인 화면에 안내 한 줄(`callbackUrl` 이 공유 붙여넣기일 때만). 글은 주소에 싣지 않고 `from=share` 표시만 잇는다 | D |
| D5 | **A** 붙여넣기 화면 + 토스트 | 글이 빈 공유도 붙여넣기 화면을 열고 토스트 1회. 쓰던 글은 건드리지 않는다 | E |
| D6 | **A** 1.0.3 업데이트 안내 「바뀐 점」 한 줄 | **화면 코드 없음** — deployer 가 `AppRelease.notes` 에 쓴다(문구 20-10) | F |

- 그대로인 것(데모 「그대로인 것」): 붙여넣기 화면의 머리·설명·입력칸·글자 수·안내·버튼·일본어 판정 오류 상자, 50~2,000자 규칙, 일본어 판정(보낼 때 서버), 오늘 홈 카드·주제 고르기 붙여넣기 카드·수업 끝 카드의 붙여넣기 링크(상태 F — 변경 없음).
- C1(50자 미만)·C3(일본어 아님)은 **새 UI 없음** — 채운 뒤 지금 안내·오류 상자 그대로.

### 20-2. 흐름 한눈에 (어디서 공유가 왔나 → 무엇을 하나)

| 공유가 도착했을 때 앱의 위치 | 하는 일 | 기기 뒤로 가기 |
|---|---|---|
| 앱이 꺼져 있었음(콜드 스타트), 로그인됨 | 첫 화면이 뜨자마자 `router.replace('/study/today/talk/new/paste?from=share')` → 붙여넣기 화면이 받아서 채움 | 지나온 화면이 없어 앱이 닫히고 카카오톡으로 돌아감 [가능성 높음 — `singleTask`, 실기기 확인] |
| 앱이 켜져 있음(수업·회화·관리자 콘솔 포함 어느 화면이든), 로그인됨 | `router.push(같은 주소)` → 채움. **확인 창 없이 넘어간다**(데모 전제) | 보던 화면으로 돌아감 |
| 이미 붙여넣기 화면 | **이동하지 않고** 화면에 신호만 보냄 → 그 자리에서 채움(D2 규칙) | 바뀌지 않음 |
| 로그인 전(`/login`) | `router.replace('/login?callbackUrl=' + encodeURIComponent('/study/today/talk/new/paste?from=share'))` → 로그인 화면 한 줄 안내 → 로그인 뒤 기존 `callbackUrl` 흐름으로 붙여넣기 화면 → 채움 | — |
| 초대코드 화면(`/invite`) | 아무것도 하지 않는다(가입을 끊지 않음). 가입·로그인이 끝나 페이지가 새로 뜨면 그때 위 규칙 | — |
| 브라우저(앱 아님) | **완전히 아무 일도 없음**(구성요소가 첫 줄에서 끝남) | — |

### 20-3. 앱 셸 구성요소 — `ShareReceiver` (새 파일 `src/components/shell/ShareReceiver.tsx`)

- `'use client'`, 아무것도 그리지 않는다(`return null`). **마운트 위치 = 루트 레이아웃 `src/app/layout.tsx` 의 `<KeyboardInset />` 바로 다음.**
  - 왜 `(app)/layout.tsx` 가 아닌가: 로그인 전 콜드 스타트는 `/` → `/study/today` → proxy 가 `/login?callbackUrl=/study/today` 로 보내 `(app)` 셸이 한 번도 그려지지 않는다. 그러면 D4-A 의 로그인 화면 한 줄이 나올 수 없다. 루트 레이아웃은 로그인 전·관리자 콘솔까지 덮는 자리이고 `KeyboardInset` 이 같은 이유로 이미 거기 있다. 루트 레이아웃은 클라이언트 이동에서 다시 마운트되지 않으므로 「마운트」 = 문서를 새로 불러온 때(콜드 스타트·앱 로그인 완료의 `window.location.replace`·WebView 재로드)다.
- 네이티브 접근은 **`@/modules/infra/native` 의 함수로만**: `isNativeApp()` · `peekSharedText()` · `onSharedText(cb)` · `onAppResume(fn)`(기존). `window.Capacitor` 직접 호출 금지. 본문을 읽는 `consumeSharedText()` 는 **여기서 부르지 않는다**(붙여넣기 화면만 부른다 — 한 번만 받는 값이 두 곳에서 다투지 않게).
- 의사코드:

```
ShareReceiver():
  router = useRouter(); pathname = usePathname()
  pending = useRef(false)                       // 이동을 부른 뒤 경로가 바뀔 때까지 다시 확인하지 않음
  useEffect(() => { pending.current = false }, [pathname])
  useEffect(() => {
    if (!isNativeApp()) return                  // 브라우저: 리스너도 달지 않는다(완전 no-op)
    check = async (how: 'mount' | 'warm') => {
      if (pending.current) return
      pending.current = true; setTimeout(() => pending.current = false, 3000)   // 안전 해제(같은 경로 replace 는 pathname 이 안 바뀜)
      has = await peekSharedText().catch(() => false)
      if (!has) { pending.current = false; return }
      { pathname: p, search } = window.location; q = new URLSearchParams(search)
      if (p === SHARE_PASTE_PATH):
        if (q.get('from') !== 'share') window.dispatchEvent(new Event(SHARE_EVENT))   // 이미 그 화면 → 이동 없이 채움
        pending.current = false; return                                          // from=share 가 붙어 있으면 화면이 마운트 때 직접 받는 중
      if (p === '/invite') { pending.current = false; return }
      if (p === '/login'):
        if (isShareCallback(q.get('callbackUrl'))) { pending.current = false; return }   // 이미 안내 중 — 다시 바꾸지 않음(로그인 왕복 resume 반복 방지)
        router.replace(`/login?callbackUrl=${encodeURIComponent(SHARE_PASTE_HREF)}`); return
      how === 'mount' ? router.replace(SHARE_PASTE_HREF) : router.push(SHARE_PASTE_HREF)
    }
    void check('mount')
    offR = onAppResume(() => void check('warm'))
    offS = onSharedText(() => void check('warm'))
    return () => { offR(); offS() }
  }, [router])
  return null
```

- 상수·판정은 새 리프 파일 **`src/components/shell/shareTarget.ts`**(`'use client'` 없음, 네이티브 import 없음 — 서버 컴포넌트인 로그인·붙여넣기 `page.tsx` 도 import):
  - `SHARE_PASTE_PATH = '/study/today/talk/new/paste'` · `SHARE_PASTE_HREF = SHARE_PASTE_PATH + '?from=share'` · `SHARE_EVENT = 'kaiwa:shared-text'` · `SHARE_LOGIN_NOTE`(20-6).
  - `isShareCallback(raw: string | null): boolean` — `new URL(raw, 'http://x')` 로 읽어 경로가 `SHARE_PASTE_PATH` 이고 `from === 'share'` 일 때만 true. 파싱 실패·`null` → false. (단위 시험: 인코딩된 값·다른 경로·`from=other`·쓰레기 값)
- 공유가 들어와 이동하면 그 화면은 평소처럼 언마운트된다 — 수업 소리·회화 마이크·재생은 각 화면의 기존 정리(cleanup)로 멈춘다. 새 확인 창·저장 로직을 더하지 않는다(데모 전제 「수업·회화 중이어도 넘어감」).
- **로그·분석에 본문·길이를 남기지 않는다.** `peek` 결과(true/false)도 콘솔에 찍지 않는다.

### 20-4. 붙여넣기 화면 — `LessonPasteScreen` (§12-2 C 위에 더하는 것만)

**① 진입 prop**: `page.tsx` 가 `searchParams` 를 읽어 `<LessonPasteScreen fromShare={from === 'share'} />`. 로그인 없을 때의 `redirect` 는 `callbackUrl` 에 **`?from=share` 를 그대로 잇는다**(`fromShare ? SHARE_PASTE_HREF : SHARE_PASTE_PATH`) — 지금 코드는 쿼리를 버린다(proxy 가 먼저 막지만 같은 규칙으로 맞춤).

**② 한 번만 받기 — 마운트 순서(한 effect 안에서 이 순서)**
1. 초안 복원(지금 그대로): `d = readStore('session', LESSON_KEYS.pasteDraft) ?? ''` → 입력칸에 `d`. **`textRef.current = d` 를 바로 맞춘다**(아래 `prev` 판단이 상태 클로저가 아니라 ref 를 읽는다).
2. `fromShare` 가 아니거나 `handledRef.current` 면 끝. 아니면 `handledRef.current = true`.
3. 주소에서 표시를 지운다: `window.history.replaceState(null, '', SHARE_PASTE_PATH)`(Next App Router 의 네이티브 history 연동 — 안 되면 `router.replace(SHARE_PASTE_PATH, { scroll: false })`). **이후 새로고침·뒤로가기·앞으로가기로 다시 받거나 「받지 못했어요」가 뜨지 않게 하는 장치다.**
4. `isNativeApp()` 이 아니면 끝(브라우저에서 `?from=share` 를 직접 쳐도 토스트 없음).
5. `consumeSharedText()` → `null` 이면 토스트 `PASTE_SHARE.lost`(4초) — 입력칸·초안은 건드리지 않는다. 값이 오면 `applyShare(r.text)`.
- **취소 플래그(`alive`)로 결과를 버리지 않는다** — 한 번만 받는 값이라 버리면 잃는다(개발 모드 StrictMode 의 effect 이중 실행 포함. 두 번째 실행은 `handledRef` 로 막는다).

**③ 화면에 있는 동안 도착(이벤트)**: 마운트 때 `window.addEventListener(SHARE_EVENT, onShare)`(앱일 때만, 언마운트에 해제). `onShare`:
- `busy`(수업 만들기 요청 중)면 아무것도 안 한다 — 공유는 네이티브에 남고 다음 resume 에 다시 확인된다.
- `consumeSharedText()` → `null` 이면 **조용히 끝**(이 경로에서는 「받지 못했어요」를 띄우지 않는다). 값이 오면 `applyShare(r.text)` 뒤 띠를 `scrollIntoView({ block: 'nearest' })`.

**④ `applyShare(raw)` — 순수 함수 `arriveShare(prev, raw)` 로 분리(`src/components/lesson/pasteShare.ts`, 단위 시험)**
- `fill = raw.replace(/\r\n?/g, '\n').trim()` — 줄바꿈을 textarea 값과 같게(글자 수가 화면과 어긋나지 않게), 앞뒤 공백만 정리.
- `fill === ''` → **빈 공유(D5)**: 토스트 `PASTE_SHARE.empty`(4초). 글·초안·띠 모두 그대로. 끝.
- `prev = textRef.current`. `prev !== '' && prev !== fill` → `text = fill`, `alt = prev`, 띠 `replaced(n = 글자수(prev))`. 그 밖(빈 입력칸이거나 같은 글) → `text = fill`, `alt = null`, 띠 `arrived`.
- 공통: `noJa = false`, `trim = null`, `writeStore('session', pasteDraft, fill)`. **입력칸에 초점을 주지 않는다**(키보드가 글·버튼을 가리지 않게 — 화면에 있는 동안 도착해 이미 초점이 있었다면 그대로 둔다).
- `truncated`(네이티브 1만 자 상한으로 잘림)는 **화면에서 쓰지 않는다** — 1만 자는 2,000자를 넘으므로 기존 빨간 안내 + ⑥ 자르기 줄로 흡수된다. 별도 문구 없음. (자르기 줄의 「뒷부분 n자」는 받은 1만 자 기준이다 — 알려진 한계.)

**⑤ 안내 띠 `ShareBanner`**(같은 파일 안 작은 컴포넌트, 데모 `.shb`) — 위치: 내용 열(`flex flex-col gap-[18px] px-4 pb-8 pt-3.5`)의 **첫 자식**, 설명 문단 위. 띠가 없으면 그리지 않는다.

```
<div role="status" className="flex min-w-0 items-start gap-2.5 rounded-xl bg-surface2 px-3 py-2.5">
  <span aria-hidden className="mt-px grid size-7 flex-none place-items-center rounded-full bg-surface text-ink2"> 공유 아이콘 SVG 16px(데모 IC_SHARE 그대로, stroke 2) </span>
  <div className="min-w-0 flex-1">
    <p className="text-[13.5px] font-semibold leading-[1.4] text-ink break-keep">{제목}</p>
    <p className="text-[12.5px] leading-[1.45] text-ink2 break-keep">{본문}</p>
    {버튼 있으면} <Btn variant="ghost" size="sm" className="mt-2 min-h-11" onClick={swap}>{버튼 글}</Btn>
  </div>
</div>
```

| 띠 상태 | 제목 | 본문 | 버튼 |
|---|---|---|---|
| `arrived` | 공유한 글을 넣어 두었어요 | 아직 아무 데도 보내지 않았어요. 확인하고 수업을 만들어 보세요. | 없음 |
| `replaced(n)` | 공유한 글로 바꿔 넣었어요 | 쓰던 글({n}자)은 이 화면에 있는 동안 되돌릴 수 있어요. | 쓰던 글로 되돌리기 |
| `restored(n)` | 쓰던 글로 되돌렸어요 | 공유한 글({n}자)을 다시 넣을 수 있어요. | 공유한 글 다시 넣기 |

- `{n}` = 코드포인트 글자 수 `toLocaleString('ko-KR')`.
- `swap`(두 버튼 공통): `cur = text; text = alt; alt = cur;` 띠를 `replaced ↔ restored` 로 뒤집되 `n = 글자수(cur)`(지금 빠지는 쪽 글의 길이), `noJa = false`, `trim = null`, `writeStore(초안, text)`. **초점은 같은 버튼에 남긴다**(버튼 요소를 바꿔 끼우지 말고 글만 바꿈 → 띠 `role=status` 가 새 제목을 읽는다).
- **`alt`(쓰던 글)는 컴포넌트 상태에만** 둔다 — sessionStorage·서버·로그 어디에도 쓰지 않는다. 화면을 떠나거나 새로고침하면 사라진다(D2-A 의 알려진 단점, 띠 본문이 「이 화면에 있는 동안」이라고 말한다).
- 띠는 **입력해도 사라지지 않는다**(데모와 같음). 입력 뒤 [쓰던 글로 되돌리기] 를 누르면 고친 글이 `alt` 로 가므로 다시 누르면 돌아온다 — 잃는 글 없음.
- 새로고침 뒤에는 띠 없이 초안만 보인다(②-3 으로 `from=share` 가 이미 지워짐) — 데모 전제 「새로고침해도 띠가 다시 뜨지 않음」.

**⑥ 2,000자 자르기 줄 `TrimRow`**(D3-A, 데모 `.trim`) — 위치: 글자 수 줄(`paste-hint`·`paste-count`) **바로 아래**, 일본어 판정 오류 상자 위. **공유든 직접 붙여넣기든** 같은 규칙.
- 표시 조건: `trim` 이 있으면 「잘랐음」 줄, 없고 `글자수 > 2,000` 이면 「자르기」 줄, 그 밖엔 없음.

```
<div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-2 rounded-xl border border-line bg-surface px-3 py-2.5">
  <p id="paste-trim" aria-live="polite" className="min-w-0 flex-[1_1_170px] text-[12.5px] text-ink2 break-keep">{문장}</p>
  <Btn variant="ghost" size="sm" className="min-h-11" aria-describedby="paste-trim" onClick=…>{버튼 글}</Btn>
</div>
```

| 줄 상태 | 문장 | 버튼 → 동작 |
|---|---|---|
| 자르기 전(`n > 2,000`) | 문장이 끝나는 곳에서 잘라 2,000자 안으로 맞춰요. 뒷부분 {r}자는 빠져요. | 2,000자에 맞춰 자르기 → `cut = trimToLimit(text)`; `trim = { full: text, removed: 글자수(text) − 글자수(cut) }`; `text = cut` |
| 잘랐음 | 뒷부분 {r}자를 뺐어요. | 되돌리기 → `text = trim.full`; `trim = null` |

- `{r}` = 「자르기 전」은 `글자수(text) − 글자수(trimToLimit(text))`, 「잘랐음」은 `trim.removed`. 숫자는 `toLocaleString('ko-KR')`.
- 두 동작 모두 `noJa = false` · `writeStore(초안, text)` · **초점은 같은 버튼에**(글만 바뀜). 문장의 `aria-live` 가 결과를 읽는다.
- **입력칸을 고치면 `trim = null`**(되돌리기 사라짐 — 데모와 같음). 고친 결과가 다시 2,000자를 넘으면 「자르기 전」 줄이 다시 나온다.
- 빨간 안내(「2,000자까지 넣을 수 있어요」·글자 수 빨강)·버튼 `aria-disabled`·누르면 이유 토스트는 **지금 그대로**. 자르기 줄은 그 아래 더해질 뿐이다.
- `trimToLimit(text, max = 2000, lookback = 400)`(순수, `pasteShare.ts`): 코드포인트 배열 `a`. `a.length ≤ max` 면 그대로. `i = max−1` 부터 `max−lookback` 까지 내려가며 `a[i]` 가 `。！？!?` 또는 줄바꿈이면 `i+1` 에서 자르고, 못 찾으면 `max` 에서 자른다. 끝의 공백·줄바꿈을 지운다. 시험: 2,000자 이하 불변 · 문장 끝에서 자름 · 400자 안에 문장 끝 없음 → 2,000 · 끝 공백 제거 · 서로게이트 쌍(이모지)을 1자로 셈 · 결과가 항상 2,000자 이하.

**⑦ 토스트** — 화면의 기존 `Toast`(`bottomPx={24}`, `role=status`)와 `show(msg, 4000)`(≤4초 규칙):

| 언제 | 문구 |
|---|---|
| `fromShare` 마운트에서 `consumeSharedText()` 가 `null`(로그인하는 사이 TTL 30분이 지남·앱 프로세스가 메모리에서 밀려나 보관이 사라짐) | 공유한 글을 받지 못했어요. 다시 공유해 주세요. |
| 받은 글이 비었음(공백뿐 포함) — 마운트·이벤트 두 경로 모두 | 공유한 내용에 글이 없어요. 글을 골라 공유해 주세요. |

- 기존 이유 토스트(50자 미만·2,000자 초과에서 버튼 누름)는 그대로.

**⑧ 상태별 화면(데모 상태 id 인용)**

| 데모 | 입력칸 | 띠 | 글자 수 줄 아래 | 버튼 |
|---|---|---|---|---|
| A 정상 도착 | 공유한 글 | `arrived` | — | 50~2,000자면 활성 |
| B 쓰던 글 있음 | 공유한 글 | `replaced(쓰던 글 길이)` ↔ `restored(공유 글 길이)` | — | 위와 같음 |
| C1 50자 미만 | 공유한 글 | `arrived` | 지금 안내 「50자 이상 넣어 주세요 · 지금 {n}자」 | `aria-disabled`(지금 그대로) |
| C2 2,000자 초과 | 공유한 글 전체 | `arrived` | 빨간 안내 + `TrimRow` | `aria-disabled` → 자르면 활성 |
| C3 일본어 아님 | 공유한 글 | `arrived` | (보낸 뒤) 지금 오류 상자 | 지금 그대로 |
| D 로그인 뒤 | 공유한 글 | `arrived` | (글 길이에 따라 A·C1·C2 와 같음) | A 와 같음 |
| D 글을 받지 못함 | 초안(없으면 빈칸) | 없음 | — | 지금 그대로 + 토스트 `lost` |
| E 빈 공유 | 초안 그대로 | 없음(이미 있던 띠는 그대로 둠) | — | 지금 그대로 + 토스트 `empty` |

### 20-5. 로그인 화면 — 한 줄 안내 (D4-A, `src/app/(auth)/login/page.tsx`)

- 표시 조건: **`isShareCallback(firstParam(sp.callbackUrl))`** 일 때만. 서버 컴포넌트라 앱 여부는 보지 않는다 — `from=share` 는 앱의 `ShareReceiver` 만 만들고 웹에서는 생기지 않는다(주소를 손으로 치면 웹에서도 보이지만 해가 없다).
- 위치: 오류 알림(`message`)·미설정 안내 **아래**, `<AppLoginArea …/>` **바로 위**(데모: 부제 → 안내 → 로그인 버튼. 오류가 있으면 오류가 먼저).

```
<p role="status" className="mb-2 flex items-start gap-2.5 rounded-[10px] bg-surface2 px-3.5 py-2.5 text-[13px] text-ink break-keep">
  <span aria-hidden className="mt-px flex-none text-ink2"> 공유 아이콘 SVG 16px </span>
  <span>공유한 글은 로그인하면 붙여넣기 화면에 넣어 드려요.</span>
</p>
```

- 로그인 버튼·앱 로그인 대기(「Chrome 창에서 로그인하고 있어요」)·딥링크 교환은 **그대로**. `callbackUrl` 은 이미 `AppLoginArea` → `prepareAppLogin`/`exchangeAppCode` → 서버 `sanitizeNextPath`(쿼리 유지) 로 이어지므로 로그인 뒤 `window.location.replace('/study/today/talk/new/paste?from=share')` 가 되고, 붙여넣기 화면이 ② 로 받는다.
- 로그인 오류로 다시 로그인 화면에 오면(`oauth_error` + 같은 `callbackUrl`) 안내 줄이 그대로 보인다(같은 조건).

### 20-6. 문구 단일 출처

- `src/components/lesson/lessonCopy.ts` 에 **`PASTE_SHARE`** 추가(기존 `PASTE` 는 고치지 않는다):
  - `arrivedTitle` 「공유한 글을 넣어 두었어요」 · `arrivedBody` 「아직 아무 데도 보내지 않았어요. 확인하고 수업을 만들어 보세요.」
  - `replacedTitle` 「공유한 글로 바꿔 넣었어요」 · `replacedBody(n)` 「쓰던 글({n}자)은 이 화면에 있는 동안 되돌릴 수 있어요.」 · `replacedAction` 「쓰던 글로 되돌리기」
  - `restoredTitle` 「쓰던 글로 되돌렸어요」 · `restoredBody(n)` 「공유한 글({n}자)을 다시 넣을 수 있어요.」 · `restoredAction` 「공유한 글 다시 넣기」
  - `lost` 「공유한 글을 받지 못했어요. 다시 공유해 주세요.」 · `empty` 「공유한 내용에 글이 없어요. 글을 골라 공유해 주세요.」
- 같은 파일에 **`PASTE_TRIM`** 추가(공유 전용 아님): `hint(r)` 「문장이 끝나는 곳에서 잘라 2,000자 안으로 맞춰요. 뒷부분 {r}자는 빠져요.」 · `action` 「2,000자에 맞춰 자르기」 · `done(r)` 「뒷부분 {r}자를 뺐어요.」 · `undo` 「되돌리기」.
- `src/components/shell/shareTarget.ts` 의 `SHARE_LOGIN_NOTE` 「공유한 글은 로그인하면 붙여넣기 화면에 넣어 드려요.」
- 모든 숫자는 `toLocaleString('ko-KR')`. 문구는 데모 v1 `SH` 객체와 **한 글자도 다르지 않다**(시험으로 고정해도 좋다). 엔진·모델 이름 0건.

### 20-7. 생성·수정 파일 (dev-W — `src/app`·`src/components` 만)

| 구분 | 파일 |
|---|---|
| 생성 | `src/components/shell/ShareReceiver.tsx` · `src/components/shell/shareTarget.ts` · `src/components/lesson/pasteShare.ts`(`arriveShare`·`trimToLimit`·글자 수 헬퍼) · 시험 `src/components/lesson/__tests__/pasteShare.test.ts` · `src/components/shell/__tests__/shareTarget.test.ts` |
| 수정 | `src/app/layout.tsx`(`<ShareReceiver />` 한 줄) · `src/components/lesson/LessonPasteScreen.tsx`(prop `fromShare`·마운트 순서·이벤트·`ShareBanner`·`TrimRow`) · `src/components/lesson/lessonCopy.ts`(`PASTE_SHARE`·`PASTE_TRIM`) · `src/app/(app)/study/today/talk/new/paste/page.tsx`(searchParams·redirect 쿼리 유지·prop) · `src/app/(auth)/login/page.tsx`(안내 한 줄) |
| 고치지 않음 | `src/modules/**`(브리지는 dev-N) · `android/**` · `src/components/common/ui.tsx`(44px 는 `min-h-11` 로 덮음) · `AppLoginArea`·`AppDeepLink`·`GoogleLoginButton` · `(app)/layout.tsx` · `TodayLessonCard`·`LessonTopicsScreen`(상태 F 변경 없음) · 데모 파일 |

### 20-8. 구현 순서

1. `shareTarget.ts` + 시험(`isShareCallback`).
2. `pasteShare.ts`(`arriveShare`·`trimToLimit`) + 시험 — 화면 없이 규칙부터 고정.
3. `lessonCopy.ts` 문구.
4. `LessonPasteScreen` — 먼저 `TrimRow`(공유 없이도 직접 긴 글로 확인 가능) → `ShareBanner`·`swap` → `fromShare` 마운트 순서 → `SHARE_EVENT`.
5. `paste/page.tsx`(prop·redirect 쿼리).
6. 로그인 `page.tsx` 안내 줄.
7. `ShareReceiver` + `layout.tsx` 마운트. **dev-N 의 브리지 3함수가 들어온 뒤**에 연결한다(그 전에는 이름만 맞춘 가짜로 시험 — `tests/live/fake-capacitor.js` 는 dev-N 이 늘림).
8. 확인: 브라우저(아무 일 없음·`?from=share` 를 쳐도 토스트 없음) · 가짜 브리지로 A·B·C1·C2·C3·D·D 받지 못함·E · 360/390/412 × 높이 780.

### 20-9. 주의사항

- **앱/웹 분기는 로그인·음성 인식·업데이트 띠 세 곳 원칙 유지.** 공유는 새 분기를 만들지 않는다: `ShareReceiver` 와 붙여넣기 화면의 수신 코드는 `isNativeApp()` 이 false 면 첫 줄에서 끝나고(리스너도 달지 않음), 브라우저에서는 화면이 지금과 한 픽셀도 다르지 않다. `TrimRow` 만 웹·앱 공통(공유와 무관한 D3-A 규칙). D6 는 화면 팁(D6-B)이 아니라 배포 메모다.
- **6층 경계**: 화면·셸은 `@/modules/infra/native` 의 `isNativeApp`·`peekSharedText`·`consumeSharedText`·`onSharedText`·`onAppResume` 만 쓴다. `window.Capacitor`·플러그인 객체 직접 호출 금지, 화면에서 엔진·플러그인 이름 분기 금지.
- **본문 취급**: 공유 본문을 URL·쿼리·로그·`console`·분석·토스트·서버(수업 만들기 전)에 싣지 않는다. 화면에 채운 뒤에는 기존 초안 `sessionStorage kaiwa.lesson.pasteDraft` 에만, 쓰던 글(`alt`)·자르기 전 원문(`trim.full`)은 컴포넌트 상태에만.
- **한 번만 채움**: `consumeSharedText()` 는 붙여넣기 화면 한 곳에서만, `handledRef` + 주소 표시 지우기(②-3)로 새로고침·뒤로가기에서 다시 채우거나 「받지 못했어요」를 띄우지 않는다.
- **자동 포커스 없음**: 마운트·도착·되돌리기·자르기 어느 때도 입력칸에 초점을 주지 않는다. 버튼 동작 뒤 초점은 누른 버튼에 남는다.
- **높이(데모 실측, [이 문장으로 수업 만들기] 하단, 780 중)**: A·C1·C3 = 360 651 · 390/412 630, B 도착 후 360 703, **C2 360 771**(버튼은 첫 화면 안, 아래 1~2분 안내 한 줄만 스크롤). `replaced` 띠(버튼 포함 약 +52px)와 `TrimRow` 가 함께 나오면(쓰던 글이 있는데 2,000자 넘는 공유) 360 에서 버튼이 첫 화면 밖으로 밀린다 — 드문 조합, 스크롤 1곳(main) 안이라 허용. 3폭에서 띠·자르기 줄 가로 넘침 0 확인.
- 화면당 세로 스크롤 1곳(main) 유지, sticky 는 `BackBar` 그대로. 띠·자르기 줄은 sticky 아님.
- **알려진 경계**: 로그인 화면에서 앱 로그인(Chrome 창)을 기다리는 사이 사용자가 카톡으로 가서 **다른 글을** 공유하면 `onSharedText` 로 로그인 주소가 바뀌어 대기가 풀릴 수 있다(다시 누르면 됨, 드묾). 수업 만들기 요청 중(`busy`)에 온 공유는 다음 resume 까지 기다린다.
- 빈 상태·오류·권한: 붙여넣기 화면은 로그인만 확인(지금 그대로). 오프라인이면 수업 만들기에서 기존 처리. 공유 수신 자체는 서버를 부르지 않는다.
- **사용자 화면 엔진명 0건**(띠·토스트·로그인 줄·배포 메모 모두).

### 20-10. D6 — 1.0.3 업데이트 안내 「바뀐 점」 문구 제안 (deployer, `AppRelease.notes`)

```
카카오톡에서 글을 공유하면 바로 '문장으로 수업 만들기' 화면에 들어가요.
```

- 데모 D6-A 예문 그대로(승인안). 설치 시트(§11-2 G `AppUpdateSheet`)가 「바뀐 점」 아래 15px `whitespace-pre-wrap` 로 그린다 — 한 줄이면 360 에서 두세 줄로 접힌다. 1.0.3 에 다른 바뀐 점이 있으면 **줄을 나눠** 이 줄을 첫 줄로 둔다. 엔진·모델 이름 0건. 화면 코드는 바꾸지 않는다.

### 20-11. 데모와 다르게 쓴 곳 · Leader 확인

1. **로그인 안내 줄 위치**: 데모는 오류가 없는 화면만 그렸다 → 오류·미설정 알림 **아래**, 로그인 버튼 영역 바로 위로 정했다(오류가 먼저 읽히게).
2. **자르기 줄 `aria-live`·`aria-describedby`**: 데모에 없던 접근성 보강(보이는 모양 같음). 「되돌리기」 단독 버튼 이름에 문장을 연결.
3. **공유 글 정리**: `\r\n → \n`·앞뒤 공백 정리는 데모에 없던 처리(글자 수가 입력칸 값과 어긋나지 않게). 보이는 결과는 같다.
4. **`ShareReceiver` 위치**: Leader 계약의 「앱 셸」 대신 **루트 레이아웃**(20-3 이유) — 로그인 전 콜드 스타트에서 D4-A 안내가 나오려면 필요하다. `(app)` 셸에만 두면 D4 는 안내 없이(D4-B 처럼) 동작한다.
5. **로그인 전 이동**: 계약의 「붙여넣기 주소로 이동 → proxy 가 `callbackUrl` 로 돌림」 대신 `/login` 에 있을 때는 **로그인 주소의 `callbackUrl` 을 직접 바꾼다**(클라이언트 이동 중 proxy 리다이렉트에 기대지 않음). 결과 주소는 같다.
6. **dev-N 확인 필요(계약에 없음)**: (a) **D5 빈 공유**가 동작하려면 네이티브가 `EXTRA_TEXT` 가 비었거나 공백뿐인(또는 없는) `text/plain` SEND 도 「보관 중인 공유」로 두고 `peek → true`, `consume → { text: '', truncated: false }` 를 줘야 한다. 버리면 D5-B(앱만 열림)처럼 된다. (b) 앱 로그인 딥링크(`thekaiwa://auth/callback`, VIEW 인텐트)가 `onNewIntent` 로 올 때 보관 중인 공유를 지우면 안 된다(D4 흐름). (c) 공유는 붙여넣기 화면만 소비하므로 `ShareReceiver` 의 `peek` 가 보관을 비우지 않아야 한다(계약 그대로).

## 21. 채택 교정 모음 `/drawer/corrections` (task-055, Phase 3 서랍장, 2026-10-11)

> **승인 데모: `docs/demo/task-055-drawer-corrections-v1.html` (v1)** — 파일 sha256 `56a11a9b6face8865ed71cf220932c73859e868685e5d5dffaf9892f19ce4c9e`, 토큰 `src/app/globals.css@sha256:a314f18f1807`(2026-10-11 지금 파일과 같음 확인). 사용자 승인 2026-10-11 17:07, 원문 「task-055 데모 v1 승인, D1~D8은 권고대로」. 데모를 처음 열면 그려지는 권고안(D1 A·D2 C·D3 A·D4 A·D5 A·D6 A·D7 A·D8 B)이 곧 승인안이다.
> **우선순위: task 이력서 「확정 결정」 표(D1~D8) > 이 절 > 데모.** 데모는 쪽 크기 8개·합성 교정 12건·헤드리스 시스템 글꼴이라 **수치는 순위 비교용**이고, 문구·간격·색 토큰·상태 구성은 데모가 기준이다. 데모와 다르게 쓴 곳은 21-13 에 모았다.
> 회화·채팅에서 [채택]한 교정(`status=ACCEPTED`)만 모아 다시 읽는 화면. 단어장 탭 안의 두 번째 목록이고(새 탭 없음), 데이터는 #79 하나(api-contract §2-17 — 이 절은 다시 정의하지 않고 인용만 한다). **스키마·서버 쓰기·네이티브 변경 없음** → 웹 배포만. 이력서: `agent-vault/10-Flow/tasks/task-055-drawer-corrections.md`, 데모 기록: `task-055-designer-record.md`.
> 적용 토큰(이름만, 새 색 없음): `--color-surface` · `--color-surface2` · `--color-ground` · `--color-ink` · `--color-ink2` · `--color-ink3`(검색 placeholder·한글 줄 괄호만 — 기존 부품) · `--color-line` · `--color-accent` · `--color-on-accent` · `--color-accent-soft`(빈 상태 그림 장식만) · `--color-good` · `--color-good-soft` · `--color-bad` · `--color-bad-soft`. 공용 컴포넌트: `AppBar` · `Badge` · `Btn` · `Sheet`(`WordDetailSheet` 경유) · `Toast`/`useToast` · `JaText`·`HangulLine`·`useAnnotations`·`DisplayToggles`·`JaRuns` · `SkeletonRegion`.
> **다른 세션 경계**: 회화방 `src/components/talk/TalkRoom.tsx`(입력 바·마이크 영역)는 task-056(IMP-0030) 소유다. 이 task 는 그 파일을 **열어 고치지 않는다** — 원래 대화에서 ← 를 바꾸는 일은 `shell/usePlanReturn.ts` 한 곳에서 끝난다(21-6 B). `TalkRoomHeader.tsx`·`BackBar.tsx` 도 고치지 않는다. 이 설계는 그 세 파일을 건드려야 하는 부분이 없다.

### 21-0. 레이아웃 설계

| 항목 | 내용 |
|---|---|
| 목표 | 「무엇을 틀렸나 → 어떻게 고치나」 두 문장을 다시 읽고, 자주 틀리는 유형을 숫자로 보고, 필요하면 원래 대화·넣은 단어로 간다 |
| 주요 위계 | ① 분절 `[단어 \| 채택한 교정]`(지금 위치) ② 거르기(검색 → 「유형」 칩(개수) → 「조각」 칩) ③ 머리 줄(개수·조건) + 보기 설정 ④ 요약 카드 목록(✕ 내 문장 / ✓ 고친 문장은 늘 보임) ⑤ [교정 더 보기] |
| 영역(위→아래, 390) | sticky 앱바 52 + 아래 10 → 분절 42 + 10 → 검색 44 → 유형 줄 6 + 44 → 조각 줄 44 → 머리 줄 8 + 32 + 6 → 목록(데모 실측 목록 시작 **298px**, 3폭 같음) |
| 컴포넌트 | `DrawerSwitch`(새) · `WordSearchBar`(prop 추가) · `ErrorTypeChips`(새) · `ChunkChips`(prop 추가) · `DisplayToggles` · `DrawerCorrectionCard`(새) · `WordDetailSheet`(그대로) |
| 상태 | 첫 로딩 · 조건 바꾸는 중 · 목록 · 펼침 · 더 보기 중/실패/끝 · 처음 비어 있음 · 조건 0건 · 검색 0건 · 첫 로딩 실패 · 단어 시트 (21-4) |
| 행동 | 칩 한 번 누름(AND) · 검색 Enter 확정 · 카드 윗부분 눌러 펼침 · [원래 대화 보기 ›] → ← 「교정 모음으로」로 같은 자리 복원 · [단어 ○○ 보기 ›] 시트 |
| 반응형 | 360/390/412 모두 같은 한 줄 흐름(카드 안 나란히 배치 없음). 칩 줄만 가로 스크롤, 세로 스크롤은 `main` 하나 |

### 21-1. 결정 최종값

| # | 확정 | 화면에 미치는 것 | 데모 탭 |
|---|---|---|---|
| D1 | **A** 앱바 아래 분절 | 단어장·교정 모음 둘 다 앱바 「단어장」 아래 `[단어 \| 채택한 교정]`(두 주소로 가는 링크). 단어장 목록 시작 292 → 344px(+52), 자리표시 상수 값 불변 | A |
| D2 | **C** 요약 카드 | 카드 윗부분 전체가 펼침 버튼. ✕/✓ 두 문장은 늘 보이고 설명 2줄, 펼치면 설명 전체·시험 문법·이동 버튼 | B |
| D3 | **A** 칩 두 줄 | 「유형」(개수 = `facets`) + 「조각」(4종, 개수 없음), AND | C |
| D4 | **A** 버튼 | [교정 더 보기], 실패 한 줄, 끝 표시, 쪽 크기 20 | D |
| D5 | **A** ← 「교정 모음으로」 | 회화방·표현 점검의 ← 이름·행선지만 바뀜(`usePlanReturn`) | G |
| D6 | **A** 시트 | 기존 `WordDetailSheet` 를 이 화면 위에 | G |
| D7 | **A** 히라가나·한글만 | 보기 설정 스위치 두 개, 번역 줄·번역 스위치 없음 | B |
| D8 | **B** 설명까지 | 검색 안내 「문장이나 설명으로 찾기」, `original`·`corrected`·`explanation` 부분 일치 | C |

### 21-2. 라우트·파일 지도 (경로는 2026-10-11 코드에서 확인 — [확실])

> `src/components/drawer/` 폴더는 **아직 없다**. 단어장 부품은 전부 `src/components/vocab/` 에 있다(`WordsScreen`·`WordsSkeleton`·`WordDetailSheet`·`ChunkChips`·`WordSearchBar`). 교정 모음 새 부품은 `src/components/drawer/` 를 새로 만들어 둔다(CLAUDE.md 디렉토리 설계의 `components/drawer`).

| 구분 | 파일 | 할 일 |
|---|---|---|
| 새로 | `src/app/(app)/drawer/corrections/page.tsx` | 서버 컴포넌트. `export const metadata = { title: '채택한 교정 · 단어장' }` + `searchParams` 검증(21-6 C) → `<CorrectionsScreen initial={…} />` |
| 새로 | `src/app/(app)/drawer/corrections/loading.tsx` | `<CorrectionsSkeleton />` 만(`drawer/words/loading.tsx` 와 같은 모양). 아래에 하위 경로가 없어 다른 화면으로 새지 않는다 |
| 새로 | `src/components/drawer/CorrectionsScreen.tsx` | 화면 본체(`'use client'`) — 상태·요청·목록·빈/오류·시트·토스트 |
| 새로 | `src/components/drawer/DrawerCorrectionCard.tsx` | D2 C 요약 카드(21-3 C) |
| 새로 | `src/components/drawer/ErrorTypeChips.tsx` | 「유형」 칩 줄(21-3 D) |
| 새로 | `src/components/drawer/DrawerSwitch.tsx` | 분절 `[단어 \| 채택한 교정]`(21-3 A) — 무거운 import 없음(자리표시가 쓴다) |
| 새로 | `src/components/drawer/CorrectionsSkeleton.tsx` | `loading.tsx` 내용(21-7 B) |
| 새로 | `src/components/drawer/logic.ts` | 순수 함수: 요청 주소·칩 목록·머리 줄 개수·빈 상태 종류·이동 주소·돌아오기 주소 만들기/읽기(21-5·21-6) |
| 새로 | `src/components/drawer/correctionsCopy.ts` | 문구 단일 출처(21-9) |
| 새로 | `src/components/shell/correctionsReturn.ts` | 교정 모음 돌아오기 한 건 기록 + 계획표 기록과 고르기(21-6 B) |
| 새로(시험) | `src/components/drawer/__tests__/logic.test.ts` · `src/components/shell/__tests__/correctionsReturn.test.ts` | 21-10 |
| 바꿈 | `src/components/shell/usePlanReturn.ts` | 행선지를 계획표·교정 모음 중 하나로(21-6 B). **소비처(`BackBar`·`TalkRoomHeader`)는 고치지 않는다** |
| 바꿈 | `src/components/vocab/WordsScreen.tsx` | 검색 위에 `<DrawerSwitch current="words" />` 한 줄 |
| 바꿈 | `src/components/vocab/WordsSkeleton.tsx` | 같은 자리에 `<DrawerSwitch current="words" placeholder />` 한 줄 |
| 바꿈 | `src/components/vocab/ChunkChips.tsx` | 선택 prop `withNone`(기본 `true` = 단어장 그대로). 교정 모음은 `false`(「없음」 칩 없음 — 계약 `chunkType` 4종) |
| 바꿈 | `src/components/vocab/WordSearchBar.tsx` | 선택 prop `label`·`placeholder`(기본값 = 지금 「단어 검색」·「표현·읽기·뜻으로 검색」), `commitWhileTyping`(기본 `true` = 지금 300ms 디바운스). 교정 모음은 `false`(21-5 A) |
| 바꿈 | `src/components/shell/tabSkeletonSizes.ts` · `src/components/shell/TabSkeleton.tsx` | 교정 카드 자리표시 상수·부품 추가, `WORD_SKELETON` 주석의 숫자(292·375) 갱신(21-7) |
| 바꿈(시험) | `src/components/shell/__tests__/tabSkeleton.test.ts` | 묶음 시험 추가(21-7 D) |
| 재사용(그대로) | `chat/diff.ts`(`diffCodepoints`) · `chat/labels.ts`(`ERROR_TYPE_LABEL`·`CHUNK_LABEL`) · `chat/ExtraNoteLine.tsx` · `common/japanese/{JapaneseText,annotations,JaRuns}` · `common/ui.tsx`(`Badge`·`Btn`) · `common/Toast` · `vocab/WordDetailSheet.tsx` · `vocab/labels.ts`(`WORD_NOT_FOUND`) · `vocab/format.ts`(`formatMonthDay`) · `common/format.ts`(`kstDateKey`·`cpLength`) · `shell/AppBar.tsx` · `shell/TabSkeleton.tsx`(`SkeletonRegion`) · `shell/planReturn.ts`(읽기만 — `parsePlanReturn`·`samePath`·`isPlanHref`·`PLAN_RETURN_KEY`·`PLAN_RETURN_LABEL`·`PLAN_RETURN_TTL_MS`) · `topic/logic.ts`(`retryFailHoldMs`) | — |
| 재사용 안 함 | `chat/CorrectionCard.tsx` | 두 칸 나란히·[채택][무시]·상태 줄 카드라 D2 C 와 모양이 다르다. **강조 클래스 `REMOVED`·`ADDED` 는 모듈 안 상수라 export 되지 않았다** → 새 카드에 같은 문자열을 두고 시험으로 묶는다(21-10 ⑦). `CorrectionCard.tsx` 는 고치지 않는다 |
| 재사용 안 함 | `common/Segmented.tsx` | `role=radiogroup` 버튼이라 주소 이동·`aria-current` 를 못 한다 → `DrawerSwitch` 가 **같은 클래스**를 링크에 쓴다 |
| 재사용 안 함 | `common/ui.tsx` `ErrorBlock` | [다시 시도] 높이가 44px 가 아니다(21-13 ⑥) → 같은 모양 + `min-h-11` 버튼을 화면 안에 둔다 |
| 고치지 않음 | `talk/TalkRoom.tsx`(task-056) · `talk/TalkRoomHeader.tsx` · `shell/BackBar.tsx` · `shell/planReturn.ts` · `shell/TabBar.tsx`(`match: '/drawer'` 라 교정 모음에서도 이미 「단어장」 켜짐) · `shell/routes.ts`(집중 화면 아님 → 하단 탭 보임) · `chat/CorrectionCard.tsx` · `chat/PendingCorrectionsCard.tsx` · `chat/ChatReview.tsx` · 데모 파일 | — |

- 서버(API #79·모듈 조회 함수·타입)는 Leader 사양(이력서 「설계」 1)대로 developer 가 만든다. 응답 항목은 기존 `CorrectionDto` 와 모양이 달라(`chat` 필수·`savedWord?{id,surface}`·`status` 없음) 새 타입(예: `src/types/chat.ts` 의 `DrawerCorrectionItem`·`DrawerCorrectionPage`)으로 둔다 — 이름은 developer 결정.

### 21-3. 화면 구성 (의사코드, 390px 기준 — 클래스는 데모 CSS 를 Tailwind 로 옮긴 값)

#### A. `DrawerSwitch` (D1 A — 데모 `drawerSeg`)

```
DrawerSwitch({ current: 'words' | 'corrections', placeholder?: boolean })
<nav aria-label="단어장 보기" className="mb-2.5 flex gap-[3px] rounded-xl bg-surface2 p-[3px]">      ← 42px + 아래 10 = 52
  <Link href="/drawer/words" replace aria-current={current==='words' ? 'page' : undefined} className={ITEM}><span className="block truncate">단어</span></Link>
  <Link href="/drawer/corrections" replace aria-current={current==='corrections' ? 'page' : undefined} className={ITEM}><span className="block truncate">채택한 교정</span></Link>
</nav>
ITEM = Segmented md 와 같은 값: relative grid h-9 min-w-0 flex-1 place-items-center rounded-[9px] px-1 text-[13.5px]
       before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-['']   ← 세로로만 44px(Segmented 주석 그대로 — 가로로 넓히면 옆 칸을 가로챈다)
       켬: bg-surface font-semibold text-ink shadow-sm / 끔: font-medium text-ink2
       글자 truncate 는 안쪽 span 에(링크에 달면 overflow:hidden 이 ::before 를 36px 로 자른다 — Segmented 주석)
```
- `replace`: 두 목록 사이 오가기는 기록을 쌓지 않는다(회화 탭 `[회화|채팅|역할극]` 의 `router.replace` 선례). 지금 화면 항목을 다시 누르면 `onClick` 에서 `preventDefault`(아무 일 없음).
- **초점**: 앱 라우터 이동 뒤에는 초점이 문서 처음으로 빠진다 [가능성 높음 — developer 확인]. 데모처럼 **새 화면 분절의 현재 항목에 초점**을 둔다: 클릭 때 모듈 변수 `pendingFocus = 대상` → 새 `DrawerSwitch` 가 마운트될 때 `pendingFocus === current` 면 현재 링크 `focus({ preventScroll: true })` 후 비운다. **`placeholder` 모드는 이 처리를 하지 않는다**(자리표시는 inert 라 초점이 안 가는데 변수를 먼저 비워 버리면 진짜 화면이 초점을 못 받는다).
- `placeholder`: 같은 마크업을 `inert` 상자 안에 그린다(효과 없음 — `WordsSkeleton`·`CorrectionsSkeleton` 용).

#### B. `CorrectionsScreen` (데모 `corrApp`)

```
AppBar title="단어장"                                   ← right 없음([＋ 추가]는 단어 화면만). h1 은 「단어장」 그대로 — 지금 위치는 분절 aria-current 가 알린다
<div className="px-4 pb-8">
  <DrawerSwitch current="corrections" />
  view === 'emptyFirst' → <EmptyFirst /> 만 그리고 끝            ← 검색·칩·머리 줄 없음(21-4 E1)
  <div inert={firstLoading || undefined}>                          ← 첫 응답 전에는 자리표시와 같은 정적 줄(데모 F 첫 로딩)
    <WordSearchBar label={COPY.search} placeholder={COPY.search} commitWhileTyping={false} value={qInput} … error={tooLong ? COPY.searchTooLong : null} />
  </div>
  firstLoading        → <ErrorTypeRowSkeleton />                        ← 21-7 C
  첫 로딩 실패        → (유형 줄 없음)
  그 밖               → <div className="mt-1.5"><ErrorTypeChips … /></div>
  <div inert={firstLoading || undefined} className={유형 줄이 없으면 'mt-1.5' : undefined}>
    <ChunkChips value={filter.chunkType} withNone={false} onChange={…} />
  </div>
  <div className="mb-1.5 mt-2 flex min-h-8 items-center justify-between gap-2">      ← WordsScreen 머리 줄과 같은 클래스
    <p aria-live="polite" className="min-w-0 flex-1 text-[12px] text-ink2 [overflow-wrap:anywhere]">{머리 줄 — 21-4}</p>
    <div role="group" aria-label={DISPLAY_COPY.toolGroup} className="flex flex-none items-center gap-1.5">
      <DisplayToggles keys={['fu', 'hg']} onToast={toast.show} />           ← D7: 'tr' 없음
    </div>
  </div>
  body                                                                 ← 21-4 표(자리표시 / 오류 상자 / 빈 상자 / 목록 + 더 보기)
  목록 = <ul aria-label="채택한 교정 목록" className="flex flex-col gap-2.5"> DrawerCorrectionCard × n </ul>
</div>
{hydrated && wordSheet ? <WordDetailSheet key={id} … /> : null}               ← 21-6 D
<Toast message={toast.message} />
```

#### C. `DrawerCorrectionCard` (D2 C — 데모 `card(…, 'C')`)

```
<li id={`dcr_${c.id}`} className="min-w-0 scroll-mt-16 rounded-[14px] border border-line bg-surface p-3.5">
  <button type="button" aria-expanded={open} aria-controls={`dcr_${c.id}_x`} onClick={onToggle}
          className="block w-full min-w-0 text-left">                       ← 카드 윗부분 전체가 펼침 버튼. 안에는 span 만(p·div 금지 — 21-11 ⑧)
    <span id={`dcr_${c.id}_head`} className="flex min-w-0 items-center gap-1.5">
      <Badge>{ERROR_TYPE_LABEL[c.errorType] ?? '기타'}</Badge>
      {c.severity === 'MAJOR' && <Badge tone="bad">중요</Badge>}
      {c.chunkType && <span className="min-w-0 truncate text-[12px] text-ink2">{CHUNK_LABEL[c.chunkType]}</span>}     ← 「이름 조각」
      {날짜 && <span className="ml-auto flex-none text-[12px] tabular-nums text-ink2"><span className="sr-only">채택한 날 </span>{날짜}</span>}
      <span aria-hidden="true" className="ml-0.5 w-4 flex-none text-center text-[12px] text-ink2">{open ? '▴' : '▾'}</span>
    </span>
    <span className="mt-2 grid min-w-0 grid-cols-[16px_minmax(0,1fr)] items-baseline gap-x-1.5">        ← ✕ 내 문장
      <span aria-hidden="true" className="text-center text-[14px] font-bold text-bad">✕</span>
      <span className="min-w-0">
        <span className="sr-only">내 문장: </span>
        <JaText as="span" text={c.original} state={annOriginal} ranges={diff ? changedRanges(diff.a, REMOVED) : undefined}
                className="block whitespace-pre-wrap text-[16px] leading-[1.7] text-ink2 [overflow-wrap:anywhere]" />
        <HangulLine as="span" state={annOriginal} />
      </span>
    </span>
    <span className="mt-2 grid min-w-0 grid-cols-[16px_minmax(0,1fr)] items-baseline gap-x-1.5">        ← ✓ 고친 문장
      <span aria-hidden="true" className="text-center text-[14px] font-bold text-good">✓</span>
      <span className="min-w-0">
        <span className="sr-only">고친 문장: </span>
        <JaText as="span" text={c.corrected} state={annCorrected} ranges={diff ? changedRanges(diff.b, ADDED) : undefined}
                className="block whitespace-pre-wrap text-[17px] leading-[1.7] [overflow-wrap:anywhere]" />
        <HangulLine as="span" state={annCorrected} />
      </span>
    </span>
    {c.explanation && <span className={`mt-2.5 block text-[15px] leading-normal text-ink2 break-keep [overflow-wrap:anywhere] ${open ? '' : 'line-clamp-2'}`}>{c.explanation}</span>}
    <span className="mt-1.5 block truncate text-[12.5px] text-ink2"><b className="font-semibold text-ink">{회화/채팅}</b> · {c.chat.title}</span>
  </button>
  <div id={`dcr_${c.id}_x`} hidden={!open} className="mt-0.5">                ← 버튼 밖(버튼 안에 버튼·링크를 둘 수 없다)
    <ExtraNoteLine correctionId={c.id} text={c.extraNoteKo} describedBy={`dcr_${c.id}_head`} />     ← 값 없으면 그리지 않음(기존)
    <div className="mt-2 flex flex-wrap gap-2">
      {sourceHref && <Link href={sourceHref} onClick={() => onLeave(c)} aria-label={`${회화/채팅} ‘${c.chat.title}’에서 이 교정 보기`} className={LINK_BTN}>원래 대화 보기 ›</Link>}
      {c.savedWord && <button type="button" onClick={() => onOpenWord(c.savedWord.id)} className={LINK_BTN}>단어 <span lang="ja" className="mx-1 min-w-0 truncate">{c.savedWord.surface}</span> 보기 ›</button>}
    </div>
  </div>
</li>
LINK_BTN = inline-flex min-h-11 min-w-0 max-w-full items-center rounded-xl border border-line bg-surface px-3 text-left text-[14px] font-semibold text-accent
REMOVED  = 'rounded-sm bg-bad-soft text-bad line-through decoration-1'                ← CorrectionCard 와 같은 문자열(시험으로 묶음)
ADDED    = 'rounded-sm bg-good-soft text-good underline decoration-2 underline-offset-4'
```
- `diff = diffCodepoints(c.original, c.corrected)`(200 코드포인트를 넘으면 `null` → 강조 없이 원문 그대로). `[annOriginal, annCorrected] = useAnnotations([c.original, c.corrected])` — `CorrectionCard` 와 같은 방식이고 요청은 `annotationClient` 가 큐로 모은다. developer 는 한 쪽(20개)에서 표시 분석 요청 수가 몇 건인지 네트워크로 확인해 이력서에 적는다(카드마다 1건씩 나가면 목록 단위 `useAnnotations(items.flatMap(…))` 로 올린다).
- 일본어 줄간격은 `JaText` 기본 `leading`(루비 켬일 때 2.1) — 데모 2.05 와 줄당 1px 안팎 차이, `CorrectionCard` 와 같게 둔다.
- 「채택함」 상태 뱃지·[채택][무시]·「채택했어요」 줄은 **그리지 않는다**(모두 채택한 교정).
- 날짜 = `formatMonthDay(kstDateKey(c.resolvedAt))`(「10월 10일」 — `WordDetailSheet` 의 `dateOf` 와 같음). `resolvedAt` 이 없으면 날짜 칸을 그리지 않는다.
- 설명은 `CorrectionCard` 와 같이 일반 글로 그린다(`lang` 없음). `sourceHref`·`onLeave` 는 21-6 A·B. `chat.kind` 가 TALK·CHAT 가 아니면(ASK — 계약상 교정이 없다) [원래 대화 보기 ›]를 그리지 않는다(`PendingCorrectionsCard` 와 같은 방어).
- 펼침 상태는 화면 상태(`Set<id>`)로 들고 있다 — 조건이 바뀌면 비우고, 돌아오기 복원(21-6 C)·단어 시트 뒤 다시 읽기(21-6 D)에서는 유지한다. 펼침·접힘 뒤 초점은 같은 버튼에 남는다.

#### D. `ErrorTypeChips` (D3 A — 데모 `filtersHTML` 의 유형 줄)

```
<div className="-mr-4 flex min-w-0 items-center gap-2">                       ← ChunkChips 와 같은 줄 모양
  <span id={labelId} className="w-[30px] flex-none text-[12px] font-semibold text-ink2">유형</span>
  <div role="radiogroup" aria-labelledby={labelId} className="no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto py-1 pr-4">
    chip('전체', n = 21-5 C ①, sr ' (모든 유형)', value null)
    typeChips(facets, selected).map(t => chip(ERROR_TYPE_LABEL[t.value], t.count, sr '개', t.value))
  </div>
</div>
chip = ChunkChips 의 CHIP 클래스 그대로(h-9 · min-w-[44px] · whitespace-nowrap · 세로 44px ::before · 켬 border-accent bg-accent font-semibold text-on-accent / 끔 border-line bg-surface text-ink)
     role="radio" aria-checked
     내용: {label}<span className="ml-1 font-normal tabular-nums">{n}</span><span className="sr-only">{sr}</span>
```
- 고른 칩이 화면 밖이면 가로로 데려온다(첫 그리기 제외) — `ChunkChips`·`CategoryChips` 와 같은 `scrollIntoView({ inline: 'nearest', block: 'nearest' })`.

### 21-4. 상태 표 (데모 탭 A~H — 문구는 데모 원문, 한 글자도 바꾸지 않는다)

| 탭·상태 | 표시 조건 | 화면 요소 · 문구(원문) | 접근성 이름·역할 |
|---|---|---|---|
| A 단어장(제안) | `/drawer/words` | 앱바 「단어장」 아래 분절 `단어`(현재)·`채택한 교정`, 그 아래 지금 단어장 그대로 | `nav` 「단어장 보기」, 현재 항목 `aria-current="page"` |
| A 교정 모음 | `/drawer/corrections` | 같은 앱바·분절(`채택한 교정` 현재), 하단 탭 「단어장」 켜짐(기존 TabBar) | 문서 제목 「채택한 교정 · 단어장」, h1 「단어장」 |
| F 첫 로딩 | 첫 응답 전(서버 `loading.tsx` → 클라이언트 첫 요청) | 검색(빈 칸)·조각 줄은 실제 요소 `inert`, 「유형」 라벨 + 회색 칩 4개, 머리 줄 글자 없음, 카드 자리표시 3개. **보이는 「불러오는 중」 글자 없음** | `role=status` 한 줄 「불러오고 있어요」(`SkeletonRegion`) |
| F 첫 로딩 실패 | 첫 쪽 요청 실패, 받은 항목 0 | 유형 줄 없음, 머리 줄 글자 없음 + 보기 설정, 오류 상자 「교정을 불러오지 못했어요. 네트워크를 확인해 주세요.」 + [다시 시도] | 상자 `role=alert`, 버튼 「다시 시도」 44px |
| C·F 조건 바꾸는 중 | 칩·검색이 바뀌어 새 첫 쪽을 기다림 | 검색·칩 줄은 그대로 누를 수 있음(칩 숫자는 직전 응답 값, 고른 칩은 바로 켜짐), 머리 줄 비움, 카드 자리표시 3개 | `role=status` 「불러오고 있어요」 |
| B 목록 | items ≥ 1 | 머리 줄 + 카드 목록 | `ul` 「채택한 교정 목록」 |
| B 머리 줄 | 지금 목록을 받은 요청의 조건(`shown`) | 검색 없음 「채택한 교정 {n}개」 / 검색 「‘{q}’ 검색 결과 {n}개」, 조건이 있으면 뒤에 「 · 」 + **{조건}**(유형 라벨과 「{조각} 조각」을 「 · 」로 — 예 「채택한 교정 2개 · **활용 · 액션 조각**」) | `aria-live="polite"`, q 의 일본어 구간만 `lang="ja"`(`JaRuns`) |
| B 펼침 | 카드 윗부분 누름 | ▾→▴, 설명 2줄 → 전체, 아래에 「시험 문법 더 보기 ▾」(있을 때)·[원래 대화 보기 ›]·[단어 {surface} 보기 ›](넣은 단어가 남아 있을 때) | 버튼 `aria-expanded`·`aria-controls`, 버튼 이름 = 카드 글 전체(데모 Minor-1 수용). 링크 이름 「회화(또는 채팅) ‘{대화 제목}’에서 이 교정 보기」 |
| B 히라가나·한글 끔 | 앱 전체 스위치 | 루비·[한글] 줄이 요약 버튼 안에서도 사라짐(데모 카드 평균 275~287 → 213~220px) | 토스트 기존 문구(`DISPLAY_COPY.toast`) |
| C 유형 칩 | 첫 쪽 응답 뒤 | `전체 {합}` + 개수 많은 유형부터 `{유형} {n}`. 0개 유형은 숨김, **단 고른 유형이 0이 되면 그 칩만 `0` 으로 남김** | `radiogroup`(라벨 「유형」), 칩 `role=radio`·`aria-checked`, sr 「 (모든 유형)」/「개」 |
| C 조각 칩 | 늘(처음 비어 있음 제외) | `전체`·`이름`·`액션`·`느낌`·`꾸밈`(「없음」 없음, 개수 없음) | `radiogroup`(라벨 「조각」), sr 「 (모든 조각)」/「 조각」 |
| C 검색 | Enter·검색 키로 확정 | placeholder 「문장이나 설명으로 찾기」, 지우기 ✕. 40자 넘으면 빨간 테두리 + 「검색어는 40자까지예요」(조회 안 함) | 입력 이름 「문장이나 설명으로 찾기」, ✕ 「검색어 지우기」, 오류 `role=alert` + `aria-invalid`·`aria-describedby` |
| E2 조건 0건 | `shown` 에 q 없음·유형/조각 있음, items 0 | 검색·칩 그대로, 상자: 「조건에 맞는 교정이 없어요」 / 「**{조건}** — 다른 조건을 골라 보세요.」 / [조건 풀기] | 버튼 44px. 누르면 유형·조각 둘 다 해제 |
| E3 검색 0건 | `shown` 에 q 있음, items 0 | 「‘{q}’와 맞는 교정이 없어요」 / 「내 문장·고친 문장·설명에서 찾았어요.」 + (유형·조각도 걸렸으면) 「 유형·조각 조건도 함께 걸려 있어요.」 / [검색 지우기] | 누르면 q 해제 + 입력칸 비움 + 입력칸에 초점 |
| E1 처음 비어 있음 | `shown` 에 조건이 하나도 없고 **`facets` 합 0** | 분절 아래 상자만: 「아직 채택한 교정이 없어요」 / 「회화나 채팅에서 선생님이 고쳐 준 문장 아래 **[채택]**을 누르면 여기에 모여요. 모아 둔 문장은 언제든 다시 읽고, 원래 대화로 돌아가 볼 수 있어요.」 / 그림(장식) / [회화하러 가기]·[채팅하러 가기] | 그림 `aria-hidden`(안의 「채택」「무시」는 버튼이 아닌 span). 두 버튼은 링크 `/study/ai?tab=talk`·`/study/ai?tab=chat` |
| D 더 보기 | `nextCursor` 있음 | [교정 더 보기](ghost, 전체 폭 48px) — 누르는 동안 「불러오는 중…」 | `aria-busy` |
| D 더 보기 실패 | 다음 쪽 요청 실패 | 받은 항목 그대로 + 버튼 위 「교정을 더 불러오지 못했어요. 다시 눌러 주세요.」 | `role=alert`. 다시 누르면 같은 커서로 |
| D 끝 | `nextCursor` 없음 **그리고** 더 보기를 한 번 이상 성공 | 「채택한 교정을 모두 봤어요 · {n}개」(n = 받은 항목 수). 한 쪽으로 끝나면 그리지 않음 | `role=status` |
| G 이동 | [원래 대화 보기 ›] | 회화 → 회화방, 채팅 → 표현 점검, 그 카드 강조(기존 `#cr_` 처리) | 원래 화면 ← 이름 「교정 모음으로」(21-6 B) |
| G 단어 | [단어 ○○ 보기 ›] | 이 화면 위 `WordDetailSheet`(기존 모양·동작 그대로) | 시트 제목 「단어」, 닫으면 초점이 누른 버튼으로(Sheet 기존) |
| G 대화를 지웠다면 | — | 목록 쪽 처리 없음(21-6 A 끝 · 21-13 ④) | — |
| H 정보 밀도 | — | 21-12 A 의 수치 | — |

- **E1 그림**(데모 `.mini`, 장식): `mt-1 mb-0.5 flex flex-col gap-1 rounded-xl border border-dashed border-line px-3 py-2.5 text-[13px]` 안에 「내 문장」(12px `text-ink2`) · `<span lang="ja">駅[に 를 REMOVED 모양]降りて…</span>` · 「이렇게 고쳐요」(12px `text-good`) · `<span lang="ja">駅[で 를 ADDED 모양]降りて…</span>` · 알약 줄(`flex flex-wrap items-center gap-1.5`): 「채택」 `inline-flex h-7 items-center rounded-lg px-3 text-[12.5px] font-semibold bg-accent text-on-accent ring-[3px] ring-accent-soft`, 「무시」 같은 크기 `border border-line text-ink2`.
- **상자 모양**: E1 `flex flex-col gap-2 rounded-[14px] border border-line bg-surface px-4 py-5`, E2·E3 같은 상자에 `p-4`. 제목 16px semibold, 본문 14px `text-ink2`(굵은 곳 `font-semibold text-ink`). E1 버튼 줄 `mt-1.5 flex flex-wrap gap-2 [&>*]:min-w-0 [&>*]:flex-[1_1_130px]` — 48px 링크 버튼(`VocabResult` 의 Link 버튼 클래스: 주 `inline-flex h-12 items-center justify-center rounded-xl bg-accent px-4 text-[15px] font-semibold text-on-accent`, 보조 같은 크기 `border border-line bg-surface`). E2·E3 버튼 `Btn variant="ghost" size="sm" className="min-h-11 self-start"`.
- **오류 상자**: `ErrorBlock` 과 같은 `rounded-xl border border-bad-soft bg-bad-soft px-3.5 py-3 text-[13px] text-bad` + 버튼 `mt-0.5 inline-flex min-h-11 items-center font-semibold underline`.
- **더 보기 줄**: 실패 문구 `mt-2 text-[13px] text-bad break-keep`, 버튼 `Btn variant="ghost" className="mt-3 w-full"`(단어장 [단어 더 보기]와 같음), 끝 표시 `mt-3.5 text-center text-[12px] text-ink2`.

### 21-5. API 연결 (#79 — api-contract §2-17 인용)

**A. 요청 주소** — `drawerCorrectionsUrl(filter, { limit, cursor })`(logic.ts):
- 값이 있는 것만 붙인다: `errorType`(9종 중 하나) · `chunkType`(4종 중 하나) · `q`(앞뒤 공백을 뺀 1~40 코드포인트) · `limit`(기본 20, 늘 붙임) · `cursor`(다음 쪽만). 값은 `URLSearchParams` 로 만들어도 된다(이 주소는 API 요청용 — 돌아오기 주소와 규칙이 다르다, 21-6 B).
- **조건(유형·조각·q)이 바뀌면 커서를 버리고 첫 쪽부터** 읽고, 펼친 카드·더 보기 오류·「더 보기 성공」 표시를 비운다.
- **검색은 Enter(검색 키)·폼 제출로만 확정**한다(데모 C) — `WordSearchBar commitWhileTyping={false}` 는 디바운스·IME 조합 끝 예약을 하지 않는다. 단 ✕ 를 누르거나 지워서 **입력칸이 빈 칸이 되면 바로 q 해제**(21-13 ②). 확정 때 `t = v.trim()`; `cpLength(t) > 40` → 오류 문구만(조회 안 함), 아니면 `q = t`(같은 값이면 요청 안 함). 단어장 `commitSearch` 와 같은 규칙.
- 40자 경계: 40자 통과, 41자 「검색어는 40자까지예요」. 이모지·서로게이트 쌍은 1자(`cpLength`).

**B. 응답 → 화면**

| 응답 필드 | 화면 |
|---|---|
| `items[].id` | key, 카드 id(`dcr_`), 이동 해시 `#cr_{id}`, 돌아오기 `focus` |
| `original` | ✕ 줄(저장 글자 그대로 — 21-11 ②), 지운 글자 강조 |
| `corrected` | ✓ 줄, 넣은 글자 강조 |
| `explanation` | 설명(접힘 2줄·펼침 전체) |
| `extraNoteKo` | 펼친 영역의 `ExtraNoteLine`(null·공백뿐이면 없음) |
| `errorType` | 유형 뱃지 |
| `severity` | `MAJOR` 면 「중요」 뱃지 |
| `chunkType` | 머리의 「○○ 조각」(null 이면 없음) |
| `chat.{id,title,kind}` | 출처 줄 「회화/채팅 · 제목」, 이동 주소, 링크 이름 |
| `savedWord?.{id,surface}` | 있으면 [단어 {surface} 보기 ›] → `WordDetailSheet wordId={id}` |
| `resolvedAt` | 채택한 날 「M월 D일」(KST) |
| `nextCursor` | [교정 더 보기] / 끝 표시 |
| `facets.errorType[]` | 유형 칩·머리 줄 개수·처음 비어 있음 판별(아래 C) |

**C. `facets` 규칙** — 계약: `facets.errorType` 는 **`errorType` 조건만 빼고** `chunkType`·`q` 를 반영한 유형별 개수(0개 생략, 많은 순·같으면 `ErrorType` 선언 순).
1. 「전체」 칩 숫자 = `sum(facets)`.
2. 유형 칩 = 서버 순서 그대로. **고른 유형이 facets 에 없으면(0개) 그 유형을 `count 0` 으로 끝에 붙인다**(데모 `facetList` — 검색·조각을 바꾸다 0이 된 칩을 사용자가 보고 풀 수 있게).
3. 머리 줄 n = 유형을 고르지 않았으면 `sum(facets)`, **골랐으면 facets 의 그 유형 count(없으면 0)** — 합을 쓰면 틀린다(facets 는 유형 조건을 뺀 집계다).
4. 처음 비어 있음(E1) = `shown` 에 errorType·chunkType·q 가 모두 없고 `sum(facets) === 0`. 조건이 하나라도 있으면 items 가 0이어도 E2(q 있으면 E3).
5. 칩·머리 줄은 **첫 쪽 응답의 facets 로만** 바꾼다. 더 보기(cursor) 응답의 facets 는 쓰지 않는다(사이에 다른 곳에서 채택해도 숫자가 튀지 않게).
6. 머리 줄·빈 상태 문구는 지금 깔린 목록을 받아 온 요청의 조건(`shown`)으로 그린다 — 단어장 `list.shown` 과 같은 방식(조건 바꾸는 중에 새 조건 문구가 먼저 뜨지 않게). 칩의 켜짐만 지금 고른 값(`filter`)을 따른다.

**D. 오류**
- 첫 쪽 실패(받은 항목 0): 21-4 「F 첫 로딩 실패」. 문구는 `status === 0`(네트워크) 이면 「교정을 불러오지 못했어요. 네트워크를 확인해 주세요.」, 그 밖은 「교정을 불러오지 못했어요.」(단어장 `listErrorText` 와 같은 갈래 — 21-13 ③). [다시 시도] → 자리표시로 돌아가고, 다시 실패하면 자리표시를 최소 500ms 보인 뒤 오류(`retryFailHoldMs`, §17-1 ⑥).
- **조건을 바꾼 첫 쪽**이 실패하면: 옛 조건의 항목은 지우고 같은 오류 상자를 그린다(머리 줄 비움). 유형 줄은 직전 facets 로 남겨 조건을 다시 바꿀 수 있게 한다(21-13 ⑧).
- 더 보기 실패: 21-4 D. 받은 항목 유지.
- 400 VALIDATION 은 화면이 막으므로 정상 흐름에서는 없다(복원 주소 값도 `page.tsx` 가 거른다). 오면 첫 쪽 실패와 같게 그리고 서버 문구는 띄우지 않는다. 401 은 공용 `api.ts` 가 처리한다.

**E. 요청 경합**
- 첫 쪽 요청마다 `AbortController` + 요청 번호(`reqRef`) — 새 요청이 나가면 이전 것은 abort, 늦게 온 옛 응답은 번호로 버린다(단어장 `WordsScreen` 과 같다). 필터 칩을 연타해도 마지막 조건의 응답만 그린다.
- 더 보기는 시작할 때의 번호를 들고 가서, 끝났을 때 번호가 바뀌었으면(그사이 조건 변경) 결과·오류를 모두 버린다. 더 보기 중 다시 누름은 무시(`loadingMore`).
- 더 보기로 받은 항목은 id 로 중복을 걸러 붙인다(단어장과 같음).
- 자동 폴링·화면 복귀(`visibilitychange`) 다시 읽기는 없다 — 마운트·사용자 조작·단어 시트 결과(21-6 D) 때만 읽는다.

### 21-6. 이동 규칙

**A. 원래 대화 주소**(계약 §2-17, 홈 `PendingCorrectionsCard` 와 같은 모양) — `sourceHrefOf(item)`(logic.ts):
- `chat.kind === 'TALK'` → `/study/ai/talk/${encodeURIComponent(chat.id)}#cr_${id}` — 역할극도 같은 회화방(`TalkRoom`)이 그린다(kind TALK [가능성 높음 — QA 확인 B②]).
- `chat.kind === 'CHAT'` → `/study/ai/chat/${encodeURIComponent(chat.id)}/review#cr_${id}`
- 그 밖(ASK) → 링크 없음.
- 원래 화면의 해시 처리·강조는 **기존 그대로**다(회화방: 그 카드 2초 강조, 「모아 둔 교정」이면 시트로 · 표현 점검: 「남은 교정」 필터에 없으면 전체로). 대화를 지우면 교정도 함께 지워지므로(Cascade) 목록의 링크는 늘 있는 대화를 가리킨다. 다른 곳에서 막 지운 드문 경우에는 원래 화면이 자기 「찾을 수 없어요」 상태를 그리고, ← 로 돌아오면 목록을 새로 읽어 그 카드가 빠진다 — **목록 쪽에 404 토스트를 두지 않는다**(21-13 ④).

**B. ← 「교정 모음으로」 — 지금 구조와 얹는 법** [확실 — `usePlanReturn.ts`·`planReturn.ts`·`BackBar.tsx`·`TalkRoomHeader.tsx`·`PlanScreen.tsx` 를 읽고 확인]
- **지금**: 계획표가 원본으로 가기 직전 `PlanScreen.openSource` 가 ① `history.replaceState(null, '', planUrl(month, day, log))`(휴대폰 뒤로가기로 와도 같은 자리) ② `rememberPlanReturn(back, src)` 로 `sessionStorage['kaiwa.planReturn'] = {v:1, plan, src, at}` 를 적는다. 원본 화면 머리의 `usePlanReturn(fallbackHref, fallbackLabel)` 는 `useSyncExternalStore(noop, () => currentPlanReturn(pathname), () => null)` 로 **지금 경로가 `src` 와 같고 2시간 안이면** `{ href: plan, label: '계획표로' }`, 아니면 fallback 을 돌려준다. 계획표는 마운트 때 `forgetPlanReturn()`.
- **소비처**: `BackBar`(표현 점검·채팅방 등)와 `TalkRoomHeader`(회화방·역할극 방 — 로딩·오류 머리 포함) **둘 다 `usePlanReturn` 이 준 `{href, label}` 로 `<Link href aria-label>` 만 그린다**(← 글자는 안 보이고 `aria-label` 로만 읽힌다). 역할극의 `back`(시나리오) 도 훅 인자로 들어가 기록이 맞으면 진다. 그래서 **소비처는 바꿀 필요가 없고 훅 한 곳 변경으로 충분하다.** `TalkRoom.tsx` 는 `TalkRoomHeader` 를 그릴 뿐이라 열지 않는다.
- **얹는 법(읽는 쪽)**:
  1. 새 `shell/correctionsReturn.ts`: `CORRECTIONS_RETURN_KEY = 'kaiwa.correctionsReturn'`, `CORRECTIONS_RETURN_LABEL = '교정 모음으로'`, TTL 은 `PLAN_RETURN_TTL_MS`(2시간). `isCorrectionsHref(v)` = `^/drawer/corrections(?:\?[A-Za-z0-9._~%=&-]*)?$` 이고 길이 ≤ 700(검색어 40자가 퍼센트 인코딩되면 400자를 넘는다 — 계획표의 300 상한을 쓰지 않는다). `serialize/parse/remember/forget` 는 `planReturn.ts` 와 같은 모양(저장소 try/catch, 형식 오류·오래된 값·미래 시각 거절, 경로 비교는 `samePath` 재사용).
  2. `currentBackHref(pathname, now)`: 계획표 기록(`parsePlanReturn(readStore('session', PLAN_RETURN_KEY), now)`)과 교정 기록을 각각 `samePath(src, pathname)` 로 거르고, **둘 다 맞으면 `at` 이 늦은 쪽** 주소, 하나면 그것, 없으면 `null`(같은 회화방을 계획표와 교정 모음에서 번갈아 열면 마지막에 연 곳으로 돌아간다).
  3. `usePlanReturn`: `read = () => currentBackHref(pathname)` — **문자열이나 null 만 돌려준다**(객체를 돌려주면 `useSyncExternalStore` 가 매번 새 값으로 보고 무한 렌더). 서버 스냅샷은 지금처럼 `null`(서버 렌더·하이드레이션 첫 렌더는 fallback — `scenario/__tests__/roomRender.test.ts` 가 서버에서 `TalkRoomHeader` 를 그린다). 이름은 `isPlanHref(href) ? PLAN_RETURN_LABEL : CORRECTIONS_RETURN_LABEL`. 훅 이름·인자·반환 모양은 그대로.
  4. `planReturn.ts`·`planReturn.test.ts` 는 고치지 않는다.
- **얹는 법(쓰는 쪽 — 교정 모음)**: [원래 대화 보기 ›] 링크의 `onClick` = `onLeave(c)`(이동은 `Link` 가 한다 — 계획표와 같은 순서):
  1. `back = correctionsReturnUrl(shown, { focus: c.id, n: clamp(items.length, 20, 50) })`
  2. `window.history.replaceState(null, '', back)` — 휴대폰 뒤로가기로 와도 같은 자리
  3. `rememberCorrectionsReturn(back, srcPath)` — `srcPath` = 21-6 A 주소에서 해시를 뺀 경로
  - 교정 모음 화면은 마운트 때 `forgetCorrectionsReturn()`(계획표의 `forgetPlanReturn()` 과 같은 이유).
- **돌아오기 주소 인코딩**: `URLSearchParams.toString()` 은 공백을 `+` 로 바꿔 허용 문자 밖이 된다 → 값마다 `encodeURIComponent` 를 쓰고 `!'()*` 도 `%XX` 로 바꾸는 helper 로 직접 잇는다. 허용 문자 밖이 섞이면 기록이 거절되어 ← 가 원래 자리로 갈 뿐 오류는 없다(그래서 시험으로 막는다).

**C. 돌아왔을 때 복원**(`page.tsx` → `CorrectionsScreen initial`):
- 읽는 값: `errorType`(9종) · `chunkType`(4종) · `q`(trim 후 1~40 코드포인트) · `focus`(`^[A-Za-z0-9_-]{1,64}$`) · `n`(정수 1~50). 형식이 틀린 값은 **그 값만** 버린다.
- **읽는 위치(구현 확정 — 가이드 초안과 다름)**: 화면(`CorrectionsScreen`)이 `useSearchParams()` 로 **지금 주소**에서 `parseCorrectionsReturnQuery` 를 다시 돌려 읽는다. 휴대폰 뒤로가기는 라우터 캐시의 옛 서버 props 를 다시 쓸 수 있어, `replaceState` 로 바꿔 둔 쿼리가 서버 `initial` 로는 안 들어오기 때문이다(계획표 `PlanScreen` 과 같은 이유). `page.tsx` 가 넘기는 서버 `initial` 은 주소를 못 읽을 때의 대비용이다.
- 첫 요청 = 그 조건 + `limit = n ?? 20`(더 보기로 늘렸던 만큼 한 번에 다시 받는다). 검색 입력칸 초기값 = q.
- 응답에 `focus` 항목이 있으면 그 카드를 **펼친 채로** 그리고, 그린 뒤 그 카드의 [원래 대화 보기 ›]에 `focus({ preventScroll: true })` + `scrollIntoView({ block: 'nearest' })`(데모 `backCorr`). 없으면(그사이 지워짐·50개 밖) 아무것도 펼치지 않고 맨 위.
- 적용한 뒤 `history.replaceState(null, '', '/drawer/corrections')` 로 쿼리를 지운다(새로고침해도 다시 펼치지 않게).
- 분절 [채택한 교정]·하단 탭으로 들어오면 쿼리가 없으므로 늘 처음 상태(조건 없음)다.

**D. 단어 시트(D6 A)** — `WordDetailSheet` props:
- `wordId = savedWord.id`, `preview` 없음(시트가 #42 로 채울 때까지 기존 `LoadingBlock`), `categories = []`(수정 폼의 분류 제안 목록만 빈다 — 분류 입력은 된다, 21-13 ⑤).
- `onClose` → 닫기(초점은 공용 Sheet 가 [단어 ○○ 보기 ›]로 돌린다).
- `onChanged(w)` → 목록에서 `savedWord.id === w.id` 인 카드의 `surface` 만 `w.surface` 로(요청 없음).
- `onArchivedChange` → 목록 변화 없음(토스트는 시트가 `onToast` 로 띄운다).
- `onRemoved(id)` → 시트 닫기 + 토스트 「삭제했어요 · 지난 기록은 그대로 남아요」(단어장과 같은 문구) + **목록 다시 읽기**(지금 조건, `limit = clamp(items.length, 20, 50)` — 위치를 잃지 않게, 펼친 카드 유지) → 그 카드의 단어 버튼이 사라진다(서버 SetNull). 누른 버튼이 없어지므로 초점은 그 카드의 요약 버튼으로.
- `onNotFound` → 시트 닫기 + 토스트 `WORD_NOT_FOUND`(「단어를 찾을 수 없어요. 삭제되었을 수 있어요.」) + 위와 같은 다시 읽기.
- `onOpenWord(id)`(수정 중 중복 안내) → 그 단어로 시트 바꾸기. `onToast` → 화면 토스트.
- 시트 안 「점검 결과 보기 ›」(교정 출처 단어)는 기존 링크 그대로다 — 이 길로 나가면 ← 는 「대화로 돌아가기」(돌아오기 기록을 쓰지 않음, 이번 범위 밖).

### 21-7. 스켈레톤·높이

**A. 단어장(D1 A)** — `WordsSkeleton` 의 `<div className="px-4 pb-8">` 첫 자식으로 `<DrawerSwitch current="words" placeholder />`, `WordsScreen` 같은 자리에 `<DrawerSwitch current="words" />`. 분절 42 + `mb-2.5` 10 = **+52px**(데모 실측 목록 시작 292 → 344, 3폭 같음 — 데모의 292 는 지금 실측과 일치). **`WORD_SKELETON`(6줄×104)·`WORD_CATEGORY_ROW` 값은 바꾸지 않는다** — 바뀌는 것은 정적 요소 위치뿐이고, 6줄 624px 는 360×740 의 목록 칸(375 → 약 323px)도 넘쳐 채운다. `WORD_SKELETON` 주석의 「목록 시작 292, 보이는 칸 375」만 344·323 으로 고친다. developer 는 변경 뒤 첫 화면 점프 ≤ 8px 를 다시 잰다(§17-1 ③⑥).

**B. 교정 모음 `loading.tsx` → `CorrectionsSkeleton`**(`'use client'`, 데이터 요청 없음 — `WordsSkeleton` 과 같은 규칙):
```
<AppBar title="단어장" />
<div className="px-4 pb-8">
  <DrawerSwitch current="corrections" placeholder />
  <div inert><WordSearchBar label={COPY.search} placeholder={COPY.search} value="" onInput={noop} onCommit={noop} onClear={noop} error={null} /></div>
  <ErrorTypeRowSkeleton />                                   ← 「유형」 라벨 + 회색 칩 4개
  <div inert>
    <ChunkChips value={null} withNone={false} onChange={noop} />
    <div className="mb-1.5 mt-2 flex min-h-8 items-center justify-between gap-2">
      <p className="min-w-0 flex-1 text-[12px] text-ink2" />
      <div role="group" aria-label={DISPLAY_COPY.toolGroup} className="flex flex-none items-center gap-1.5"><DisplayToggles keys={['fu', 'hg']} onToast={noop} /></div>
    </div>
  </div>
  <CorrectionCardsSkeleton />
</div>
```
- 화면의 첫 로딩·조건 바꾸는 중도 **같은 부품**(`ErrorTypeRowSkeleton`·`CorrectionCardsSkeleton`)을 쓴다 — 서버 자리표시 → 클라이언트 자리표시 → 데이터 사이에 모양이 안 바뀌게.
- 처음 비어 있는 계정은 응답 뒤 검색·칩이 접혀 아래가 올라간다 — 단어 0개 단어장과 같은 「첫 사용자 한정」 점프로 수용(§17-3 선례).

**C. 새 상수·부품**(`shell/tabSkeletonSizes.ts`·`shell/TabSkeleton.tsx`):

| 이름(후보) | 값 | 근거 |
|---|---|---|
| `CORRECTION_SKELETON.rows` | 3 | 흔한 상태 중간값(§17-1 ③ 규칙, 데모 F). 목록 시작 ≈298 + 카드 ≈280 이면 첫 화면은 1개 + 걸침 1개라 3개면 아래로 넘친다 |
| `CORRECTION_SKELETON.gap` | 10 | 목록 `gap-2.5`(데모 `.cl`) — 클래스와 같은 값 |
| `CORRECTION_SKELETON.cardHeight` | **developer 재측정**(데모 렌더 평균 275~287, 데모 자리표시 270 — 헤드리스 시스템 글꼴 값이라 그대로 쓰지 않는다) | task-046 방식 실측: QA 계정(채택 교정 ≥ 3), 히라가나·한글 켬(기본)·접힘, 360/390/412 에서 첫 3개 카드 `getBoundingClientRect().height` 평균. 이력서 Developer 기록에 표로 남기고 상수 주석에 근거를 적는다 |
| 유형 칩 줄 높이 | `WORD_CATEGORY_ROW`(top 6·pad 4·chip 36) 재사용 | 실제 줄이 `mt-1.5` + `py-1` + `h-9` 로 분류 칩 줄과 같은 클래스 [확실 — 데모 `.crow`·코드 클래스 일치] |
| `CORRECTION_TYPE_ROW.widths` | [56, 64, 60, 72] | 데모 자리표시 칩 폭(높이와 무관) |

- `CorrectionCardsSkeleton` = `SkeletonRegion` 안에 `flex flex-col`(`gap: CORRECTION_SKELETON.gap`), 카드 `flex flex-col gap-2.5 rounded-[14px] border border-line bg-surface p-3.5`(`height: CORRECTION_SKELETON.cardHeight`), 안에 회색 막대 4개(`block rounded-md bg-surface2`: 34%×14 · 82%×20 · 64%×20 · 92%×14 — 데모 `cardSkeletons`). 「불러오는 중」 글자·`animate-pulse` 없음.
- `ErrorTypeRowSkeleton` = `aria-hidden` 줄(`-mr-4 flex min-w-0 items-center gap-2`, `marginTop: WORD_CATEGORY_ROW.top`) 안에 라벨 「유형」(`w-[30px] flex-none text-[12px] font-semibold text-ink2`) + 칩 줄(`flex gap-2`, `paddingBlock: WORD_CATEGORY_ROW.pad`) + 칩 블록(`rounded-full bg-surface2`, `height: WORD_CATEGORY_ROW.chip`, 폭 `CORRECTION_TYPE_ROW.widths`). 알림은 카드 쪽 `role=status` 한 줄뿐이다(한 화면에 하나).
- 합격선: 서버 자리표시 → 데이터 첫 화면에서 분절·검색·조각 줄·첫 카드 위쪽 점프 ≤ 8px, 보이는 「불러오는 중」 프레임 0(§17-1 ③⑥).

**D. `tabSkeleton.test.ts` 에 더할 묶음 시험**
1. `loading.tsx` 범위: `drawer/corrections/loading.tsx` 있음, `drawer/loading.tsx` 없음(기존), `drawer/corrections/` 에는 `page.tsx`·`loading.tsx` 만(하위 경로 없음).
2. `TabSkeleton.tsx` 가 `CORRECTION_SKELETON.cardHeight`·`CORRECTION_SKELETON.gap`·`WORD_CATEGORY_ROW.chip` 을 상수에서 읽는다(기존 「상수에서 높이를 읽는다」 시험 확장).
3. 카드 바깥 클래스: `DrawerCorrectionCard.tsx` 와 `TabSkeleton.tsx` 둘 다 `rounded-[14px] border border-line bg-surface p-3.5`, 목록(`CorrectionsScreen.tsx`)·자리표시 둘 다 `gap-2.5` 이고 `CORRECTION_SKELETON.gap === 10`.
4. 유형 줄: `CorrectionsScreen.tsx` 가 `<div className="mt-1.5">` 로 `ErrorTypeChips` 를 감싸고, `ErrorTypeChips.tsx` 칩에 `h-9 `·스크롤 줄에 `py-1`.
5. 분절: `WordsScreen.tsx`·`WordsSkeleton.tsx`·`CorrectionsScreen.tsx`·`CorrectionsSkeleton.tsx` 넷 다 `<DrawerSwitch` 를 그리고, 두 Skeleton 은 `placeholder` 를 넘긴다.
6. 서버 자리표시는 데이터 요청이 없고 `inert` 가 있다 — 기존 `[dir, file]` 목록에 `['drawer', 'CorrectionsSkeleton.tsx']` 추가. `CorrectionsScreen` 을 import 하지 않는다.
7. `CorrectionCardsSkeleton` 렌더에 `role=status` 한 줄이 `aria-busy` 래퍼 밖(기존 「목록 자리표시 부품」 시험 배열에 추가).
8. `CORRECTION_SKELETON.rows === 3`, `cardHeight` 는 실측 기록과 같은 값.

### 21-8. 표시 스위치·접근성·폭·스크롤

- **표시 스위치**(앱 전체 한 값): 히라가나(`fu`)·한글(`hg`)은 ✕·✓ 두 줄의 루비·[한글] 줄에만 닿는다 — `JaText`(루비) + `HangulLine`(한글) + `useAnnotations([original, corrected])`. 설명·출처 줄·시험 문법·단어 버튼의 일본어에는 표시 층이 없다(`CorrectionCard`·`ExtraNoteLine` 과 같음). **번역 스위치는 이 화면에 없고 따르지도 않는다(D7)** — `DisplayToggles keys={['fu', 'hg']}`. 끄면 `HangulLine` 이 `null` 을 돌려주므로 CSS 로 따로 숨기지 않는다. 단어 시트 안은 기존 시트 규칙 그대로.
- **`lang`**: ✕·✓ 줄은 `JaText`(lang=ja 자동), 단어 버튼의 표현 `<span lang="ja">`, 머리 줄·E3 제목의 q 는 `JaRuns`(일본어 구간만), E1 그림 예문 `lang="ja"`.
- **키보드·화면 읽기**: 요약 버튼 `aria-expanded`/`aria-controls`(이름 = 카드 글 전체 — 데모 Minor-1 수용, `WordRow` 행 버튼과 같음). 칩은 `role=radio`+`aria-checked`, 화살표 이동 없이 각각 Tab(기존 `ChunkChips` 와 같음 — Minor-3 수용). 시트는 공용 `Sheet`(열 때 제목에 초점·Esc·닫으면 연 버튼으로 — 데모 Minor-4 의 초점 가두기는 공용 Sheet 범위, 새로 만들지 않는다). 분절은 `nav` + `aria-current="page"`. 지운·넣은 글자 강조는 화면 읽기에 알리지 않는다(기존 교정 카드와 같음 — Minor-2).
- **터치 44px**: 분절·칩(보이는 36 + 세로 `::before` 44) · 요약 버튼(카드 높이) · 이동 버튼 `min-h-11` · 시험 문법 줄 `min-h-11`(기존) · 더 보기 48 · E1 버튼 48 · E2/E3 버튼 `min-h-11` · 오류 [다시 시도] `min-h-11` · 검색 ✕ 44(기존).
- **폭 360/390/412**: 카드는 위아래 한 흐름이라 세 폭 모양이 같다. 줄어드는 flex/grid 자식에 `min-w-0`(머리·✕/✓ 열·출처 줄·조각 이름·이동 버튼). 출처 줄·조각 이름·단어 버튼의 표현은 `truncate`, 머리 줄은 `[overflow-wrap:anywhere]` 로 줄바꿈. 칩 줄만 가로 스크롤(`-mr-4`·`pr-4`·`no-scrollbar`). 데모 26상태×3폭 가로 넘침 0.
- **스크롤 1곳**: 세로 스크롤은 앱 셸 `main` 하나. 안쪽 세로 스크롤 상자를 만들지 않는다(§18 규칙 대상 없음 — `sr-only` 는 `main`(relative) 기준). sticky 는 `AppBar` 만(분절은 스크롤과 함께 올라간다 — 데모).
- **글자 크기**: ✓ 줄 일본어 17px · ✕ 줄 16px · 루비 11px · 한글 13px · 설명 15px · 출처 12.5px · 머리 줄·날짜·조각 이름·라벨 12px · 뱃지 11.5px(공용 Badge). 11px 미만 없음.
- **명암비**(§1-1): 보조 글 `ink2`, 링크 버튼 `accent`/`surface` 4.80, 뱃지 `bad`/`bad-soft`·`neutral`, ✕/✓ 표시는 장식(`aria-hidden`, 읽기는 sr 이름). `ink3` 는 placeholder·한글 줄 괄호(기존 부품)만.

### 21-9. 문구 단일 출처 — `src/components/drawer/correctionsCopy.ts`

데모 문구와 **한 글자도 다르지 않다**(시험으로 고정해도 좋다). 엔진·모델 이름 0건.

| 키(예) | 문구 |
|---|---|
| `switchNav` · `switchWords` · `switchCorrections` | 단어장 보기 · 단어 · 채택한 교정 |
| `docTitle` | 채택한 교정 · 단어장 |
| `search` · `searchTooLong` | 문장이나 설명으로 찾기 · 검색어는 40자까지예요 |
| `typeLabel` · `typeAllSr` · `typeCountSr` | 유형 · ` (모든 유형)` · 개 |
| `listLabel` | 채택한 교정 목록 |
| `head(n)` · `headSearch(n)` | 채택한 교정 {n}개 · ‘{q}’ 검색 결과 {n}개 (조건은 ` · ` + 굵게 「{유형} · {조각} 조각」) |
| `acceptedOnSr` · `mineSr` · `fixSr` · `major` | `채택한 날 ` · `내 문장: ` · `고친 문장: ` · 중요 |
| `kind.TALK` · `kind.CHAT` | 회화 · 채팅 |
| `goChat` · `goChatAria(kind, title)` | 원래 대화 보기 › · {kind} ‘{title}’에서 이 교정 보기 |
| `goWord(surface)` | 단어 {surface} 보기 › |
| `more` · `moreBusy` · `moreError` · `end(n)` | 교정 더 보기 · 불러오는 중… · 교정을 더 불러오지 못했어요. 다시 눌러 주세요. · 채택한 교정을 모두 봤어요 · {n}개 |
| `loadErrorNetwork` · `loadError` · `retry` | 교정을 불러오지 못했어요. 네트워크를 확인해 주세요. · 교정을 불러오지 못했어요. · 다시 시도 |
| `emptyFirstTitle` · `emptyFirstBody` | 아직 채택한 교정이 없어요 · 회화나 채팅에서 선생님이 고쳐 준 문장 아래 **[채택]**을 누르면 여기에 모여요. 모아 둔 문장은 언제든 다시 읽고, 원래 대화로 돌아가 볼 수 있어요. |
| `emptyFirstPic` | 내 문장 · 駅に降りて… · 이렇게 고쳐요 · 駅で降りて… · 채택 · 무시 |
| `goTalk` · `goChatList` | 회화하러 가기 · 채팅하러 가기 |
| `emptyFilterTitle` · `emptyFilterBody(cond)` · `clearFilter` | 조건에 맞는 교정이 없어요 · **{조건}** — 다른 조건을 골라 보세요. · 조건 풀기 |
| `emptySearchTitle(q)` · `emptySearchBody` · `emptySearchWithCond` · `clearSearch` | ‘{q}’와 맞는 교정이 없어요 · 내 문장·고친 문장·설명에서 찾았어요. · ` 유형·조각 조건도 함께 걸려 있어요.` · 검색 지우기 |
| `wordRemoved` | 삭제했어요 · 지난 기록은 그대로 남아요 |

- 다른 곳에서 가져오는 문구(새로 쓰지 않음): ← 이름 `CORRECTIONS_RETURN_LABEL` 「교정 모음으로」(`shell/correctionsReturn.ts`) · `SKELETON_SR_LABEL` 「불러오고 있어요」 · `DISPLAY_COPY`(보기 설정·토스트·「한글 발음: 」) · `EXTRA_NOTE_LABEL` · `ERROR_TYPE_LABEL` · `CHUNK_LABEL` · 조각 칩 `CHUNK_FILTER_ALL`·`CHUNK_FILTER_CHIPS` · `WORD_NOT_FOUND` · 검색 ✕ 「검색어 지우기」(WordSearchBar 기존).
- 숫자는 `toLocaleString('ko-KR')`.

### 21-10. 구현 순서

1. API #79·모듈 조회 함수·타입·계약 시험(developer, 이력서 「설계」 1) — 화면은 이 응답 모양만 쓴다.
2. `drawer/logic.ts` + 시험: (a) 요청 주소(값 있는 것만·`limit` 20·cursor) (b) `typeChips`(서버 순서·고른 유형 0 붙이기) (c) 머리 줄 n(유형을 골랐으면 그 count) (d) 빈 상태 종류(E1/E2/E3) (e) 이동 주소(TALK/CHAT, ASK 는 null, id 인코딩) (f) 돌아오기 주소 만들기·읽기(9종/4종/40자/`focus`/`n` 경계, 공백·`+`·`!'()*` 인코딩, 만들고 읽으면 같은 값, 700자 이하).
3. `shell/correctionsReturn.ts` + 시험(`planReturn.test.ts` 와 같은 갈래: 정상·경로 불일치·TTL·깨진 값·주소 거절·저장소 예외 + **두 기록이 모두 맞으면 늦은 쪽**) → `usePlanReturn` 변경. 기존 `planReturn.test.ts`·`roomRender.test.ts` 가 그대로 통과해야 한다.
4. `correctionsCopy.ts`.
5. `DrawerSwitch` → `WordsScreen`·`WordsSkeleton` 한 줄씩 → 단어장 첫 화면 점프 재측정.
6. `ChunkChips withNone`·`WordSearchBar` props — 기본값으로 단어장 DOM 이 바뀌지 않는지 확인.
7. `DrawerCorrectionCard` → 강조 문자열 묶음 시험(`CorrectionCard.tsx` 소스의 `REMOVED`·`ADDED` 문자열과 같음) → `ErrorTypeChips` → `CorrectionsScreen` → `page.tsx`(metadata·searchParams 검증).
8. 자리표시 부품·상수 → `CorrectionsSkeleton` → `loading.tsx` → 카드 높이 실측 → 상수 확정 → `tabSkeleton.test.ts` 묶음 시험(21-7 D).
9. 확인: 21-12 A 전부 + tsc·eslint 0 + 360/390/412 × 높이 780.

### 21-11. developer 금지·함정 (주의사항)

1. **엔진·모델·호스트 이름 0건**(화면·문구·aria·토스트·문서 제목).
2. **`Correction.original` 은 저장 글자 그대로** — trim·정규화·자르기·NFC 변환·줄바꿈 정리 모두 금지. 강조는 `diffCodepoints` + `changedRanges` 로 `<span>` 을 나누기만 한다(조각을 이으면 원문과 같음 — 기존 diff 시험). `whitespace-pre-wrap` 로 공백·줄바꿈을 그대로 보인다. `corrected`·`explanation` 도 화면에서 고치지 않는다.
3. **교정 편집·삭제 UI 없음, 제안(PROPOSED) 목록 없음**(서버가 ACCEPTED 만 준다 — 화면이 다시 거르지 않는다), [채택][무시] 없음.
4. **새 탭 없음** — 하단 탭 5개 그대로, 교정 모음은 단어장 탭 안(`TabBar` 의 `match: '/drawer'`).
5. **새 서버 쓰기 없음** — 이 화면이 부르는 API 는 #79(GET) 하나. 단어 시트 안의 수정·보관·삭제는 기존 단어 API 그대로다.
6. **`TalkRoom.tsx`·`TalkRoomHeader.tsx`·`BackBar.tsx`·`planReturn.ts` 를 고치지 않는다**(21-6 B). 회화방 입력 바·마이크 영역은 task-056 소유.
7. **`usePlanReturn` 의 `getSnapshot` 은 문자열/null 만**, 서버 스냅샷 `null` 유지(21-6 B 3).
8. **데모에서 이미 고친 결함 3건을 다시 만들지 않는다**:
   - ① 요약 버튼 안 줄 배치 — 버튼 안에는 `<p>`·`<div>` 를 둘 수 없다(구문 내용만). 줄마다 **블록 `span`**: `JaText as="span"` + `block`, `HangulLine as="span"`(자동 `block`), 설명·출처 `span.block`, 머리 `span.flex`. 데모는 이것을 빠뜨려 줄이 한 줄로 붙었었다.
   - ② 한글 끔이 요약 안에서 안 먹던 것 — 한글 줄을 손으로 만든 span + CSS 로 숨기지 말고 **반드시 `HangulLine`** 을 쓴다(끔이면 `null`). 루비도 `JaText` 만.
   - ③ D1 B 이동 뒤 초점 분실 — D1 은 A 확정이라 해당 없다. 같은 종류의 위험은 분절 이동 뒤 초점이라 21-3 A 규칙으로 막는다.
9. **구현 메모(데모 기록에서 옮김)**: 교정 모음 화면의 문서 제목은 「채택한 교정 · 단어장」, 앱바 h1 은 「단어장」 유지(분절이 지금 위치를 알린다). 요약 버튼 안에서는 `<p>` 대신 블록 `span`.
10. **머리 줄 n 함정**: 유형을 골랐을 때 `sum(facets)` 를 쓰면 틀린다(21-5 C 3). 고른 유형 0 칩 유지(21-5 C 2).
11. **ExtraNoteLine·이동 버튼은 요약 버튼 밖**(중첩 인터랙티브 금지). `ExtraNoteLine` 은 값이 없으면 스스로 그리지 않는다.
12. **빈 상태 구분**: E1(처음)과 E2/E3(조건 0건)을 섞지 않는다 — 조건이 하나라도 있으면 E1 이 아니다.
13. **자리표시**: 「불러오는 중…」 글자·가짜 빈 상태·`animate-pulse` 없음. `placeholder` `DrawerSwitch` 는 초점 효과를 쓰지 않는다.
14. **오프라인·오류**: 첫 쪽 실패는 오류 상자, 더 보기 실패는 한 줄(받은 항목 유지). 권한: 로그인 사용자 누구나, 자기 교정만(서버 `userId` — 화면은 다른 사람 id 를 다룰 일이 없다). 앱/웹 분기 없음.

### 21-12. reviewer·qa 확인표

**A. 데모·이 절과 대조(웹 브라우저에서 확인 가능)**

| # | 항목 | 기준 |
|---|---|---|
| A1 | 단어장 목록 시작 | 344px(지금 292 + 52), 3폭 같음. 자리표시 → 데이터 첫 화면 위쪽 점프 ≤ 8px |
| A2 | 교정 모음 목록 시작 | 데모 298px(±8 안이면 통과, 밖이면 원인 기록 — 실제 글꼴 차이). 자리표시 ↔ 데이터 점프 ≤ 8px, 보이는 「불러오는 중」 0 |
| A3 | 분절 | 높이 42(칸 36, 히트 44), 아래 10. 두 화면에서 같은 자리. `aria-current` 가 지금 화면. 분절 이동 뒤 뒤로가기에 두 목록이 번갈아 쌓이지 않음(`replace`). 이동 뒤 초점이 새 분절 현재 항목 |
| A4 | 머리 영역 | 검색 44 · 유형 줄 6 + 44 · 조각 줄 44 · 머리 줄 8 + 32 + 6. 조각 칩에 「없음」 없음, 보기 설정에 「번역」 없음 |
| A5 | 카드 | 테두리 `line`·모서리 14·안쪽 14·목록 간격 10, ✕/✓ 열 16 + 6, 줄 간 8, 설명 위 10·두 줄 말줄임, 출처 위 6. 글자 17/16/13/11/15/12.5/12/11.5px. 「채택함」 뱃지·[채택][무시] 없음 |
| A6 | 정보 밀도(데모 렌더 — 실기기는 다를 수 있음) | 첫 화면 완전히 보이는 카드 1(+걸침 1), 스크롤 중 한 화면 ≈2.3개(켬)·≈3.0개(끔). 카드 평균 275~287(켬)·213~220(끔) |
| A7 | 쪽·더 보기 | 첫 쪽 20개, [교정 더 보기] 뒤 이어 붙임(중복 0), 실패 한 줄 + 받은 항목 유지, 끝 표시는 더 보기 성공 뒤에만 |
| A8 | facets | 「전체」 = 합, 유형 칩 많은 순, 유형 골랐을 때 머리 줄 = 그 유형 수, 검색·조각 조건이 칩 숫자에 반영, 고른 유형이 0이면 칩 `0` 으로 남음 |
| A9 | 검색 | Enter 로만 확정(입력 중 요청 0), 빈 칸이 되면 해제, 40자 통과·41자 「검색어는 40자까지예요」(조회 0), 이모지 1자. 「존댓말」처럼 설명 낱말로 찾힘(D8) |
| A10 | 빈 상태 | E1(조건 없음·합 0)·E2·E3 문구 원문 일치, 버튼 동작(E1 링크 `?tab=talk`·`?tab=chat`, [조건 풀기], [검색 지우기]+초점) |
| A11 | 필터 연타 | 칩을 빠르게 여러 번 눌러도 마지막 조건 결과만 남음(옛 응답 그리지 않음) |
| A12 | ← 「교정 모음으로」 | 회화방·역할극 방·표현 점검 ← 의 `aria-label`. 누르면 조건·검색어 그대로, 그 카드 펼침, 초점이 그 카드 [원래 대화 보기 ›]. 휴대폰 뒤로가기도 같은 자리. 같은 방을 계획표에서 다시 열면 ← 는 「계획표로」(늦은 쪽) |
| A13 | 단어 시트 | 열기·닫기 초점 복귀, 표현 고치면 버튼 글자 바뀜, 삭제하면 토스트 + 그 카드 단어 버튼 사라짐 + 위치 유지 + 초점이 요약 버튼 |
| A14 | 표시 스위치 | 히라가나·한글 끔 → 요약 버튼 안 루비·[한글] 줄 사라짐(다른 화면과 같은 값) |
| A15 | 가로 넘침·터치 | 360/390/412 × 21-4 전 상태 가로 넘침 0, 누르는 곳 44px 미만 0 |
| A16 | 소유자 | 다른 계정의 채택 교정이 0건(IDOR — 서버 시험과 화면 둘 다) |
| A17 | 원문 그대로 | 앞뒤 공백·연속 공백·줄바꿈이 든 합성 교정에서 ✕ 줄 글(루비·sr 제외) = 저장값 |
| A18 | 문구·이름 | 21-9 원문 일치, 엔진명 0, 문서 제목 「채택한 교정 · 단어장」, h1 「단어장」 |
| A19 | 어두운 화면 | 토큰만(새 색 0), 강조·뱃지 명암비(§1-1) |

**B. 실기기(S25+ Chrome·앱 WebView 390)에서만 — designer 가 확인하지 못한 것**
1. 실제 글꼴·루비 높이 → 카드 높이·자리표시 상수 오차, 첫 화면 밀도. **TalkBack 낭독**: 요약 버튼 이름 길이, 칩 radio, 분절 `aria-current`, 이동 뒤 문서 제목 알림.
2. **역할극(상황 대화) 교정이 `kind=TALK` 로 와서 회화방 `#cr_` 로 열리는지**(역할극 방 화면 가이드가 screens.md 에 없음). 함께: 「모아 둔 교정」(LATER)으로 채택한 교정이 시트로 열리는지, 회화방이 처음 읽는 50개 밖의 오래된 교정·표현 점검 3쪽 밖 교정이면 강조 없이 머무는 기존 한계.
3. **단어 상세 시트의 「점검 결과 보기 ›」**가 회화(TALK)에서 넣은 단어에도 채팅 점검 주소(`/study/ai/chat/{id}/review`)로 가는데 그 화면이 제대로 열리는지(기존 동작 — 안 되면 백로그).
4. 앱 WebView 하드웨어 뒤로가기가 ← 와 같은 자리로 가는지(`replaceState` 반영), 분절 `replace` 뒤 뒤로가기 동작.

### 21-13. 데모와 다르게 쓴 곳 · Leader 확인

1. **계약 표 행 불일치**(고치지 않음): `api-contract.md` §1 표의 #79 행(210행)은 `?errorType=&limit=&cursor=` 로, §2-17(`errorType·chunkType·q·limit·cursor`)과 다르다. 화면은 §2-17 을 따른다 — 표 행 갱신은 Leader.
2. **검색 확정**: 데모대로 Enter 확정(단어장의 300ms 디바운스가 아님). 데모에 없던 보강 — 입력칸을 지워 **빈 칸이 되면 바로 해제**(빈 칸인데 옛 검색 결과가 남는 일을 막음).
3. **첫 로딩 실패 문구**를 status 로 둘로 나눔: 네트워크(0)는 데모 문구 「교정을 불러오지 못했어요. 네트워크를 확인해 주세요.」, 그 밖은 「교정을 불러오지 못했어요.」(서버 오류에 「네트워크를 확인」은 틀린 안내 — 단어장 `listErrorText` 와 같은 갈래).
4. **데모 G 「대화를 지웠다면 … 404 → 토스트 후 다시 읽기」**는 목록 화면에서 일어나지 않는다(이동은 링크라 404 는 원래 화면이 받고 자기 「찾을 수 없어요」 상태를 그린다). 목록 쪽 처리 없음, 돌아오면 마운트 때 다시 읽어 빠진다.
5. **`WordDetailSheet categories=[]`**: 수정 폼의 분류 제안 목록(datalist)만 빈다. 필요하면 시트를 처음 열 때 #46 1회 — 이번엔 넣지 않음.
6. **`ErrorBlock` [다시 시도] 44px 미달**(공용, 단어장 등 여러 화면 같음): 이 화면은 같은 모양 + `min-h-11` 을 화면 안에 둔다. 공용 수정은 전역 이슈로 Leader 판단.
7. **돌아오기 복원 방법**(데모는 화면 상태가 그대로 남는 모형이라 방법이 없었다): 계획표 선례대로 주소 쿼리(`errorType`·`chunkType`·`q`·`focus`·`n`) + `sessionStorage` 한 건. `n` 으로 첫 요청 `limit` 을 늘려 위치를 살린다 — 50개를 넘게 더 읽은 뒤 연 카드는 펼침·초점을 복원하지 못한다(맨 위).
8. **조건을 바꾼 첫 쪽 실패** 때 유형 줄을 직전 숫자로 남긴다(데모는 첫 로딩 실패만 그렸고 유형 줄을 숨겼다 — 첫 로딩 실패는 데모대로 숨김).
9. **D6 「목록 다시 읽기」**를 지금 받은 개수(최대 50)로 한 번에 다시 읽어 위치·펼침을 지킨다(확정 메모 「다시 읽어」 범위 안). 표현 수정은 다시 읽지 않고 버튼 글자만 바꾼다.
10. **문서 제목**: `(app)` 화면 가운데 처음으로 페이지별 `metadata.title` 을 둔다(다른 화면은 앱 이름). 단어 화면 제목은 그대로 — 원하면 「단어 · 단어장」(Leader).
11. **계약에 없음**: 더 보기(cursor) 요청에도 `facets` 를 계산하는지 — 화면은 첫 쪽 것만 쓰므로 서버가 cursor 요청에서 생략해도 된다(Leader·developer 판단).
12. **카드 루비 줄간격**: 데모 2.05 → `JaText` 기본 2.1(`CorrectionCard` 와 같음, 줄당 1px 안팎).
13. **분절 이동 방식**: 데모는 화면 전환만 그렸다 — `Link replace`(기록을 쌓지 않음, 회화 탭 선례) + 이동 뒤 분절 현재 항목에 초점.

---

## 22. 회화방 일본어 도우미 (task-056, IMP-0030, 2026-10-11)

> **승인 데모**: `docs/demo/task-056-talk-phrase-helper-v1.html` (v1) — 2026-10-11 17:58 사용자 승인 「4번만 'B안'으로 하고 나머지는 권고안대로 진행해줘」(sha256 `704e8d58cb2a5067…`). `#hp-*`·`#rp-*` 는 데모 왼쪽 상태 목록 id, 「세 폭」은 데모 아래 「입력 바 세 폭」 패널이다.
> **적용 토큰 이름**(새 색 없음): `ground` · `surface` · `surface2` · `ink` · `ink2` · `ink3`(placeholder 만) · `line` · `accent` · `accent-soft` · `on-accent` · `bad` · `--safe-bottom` · `:root[data-kb]` · `--kb-inset`(앱 셸이 처리).
> **정본 관계**: 회화방 바탕은 §9(입력 바 자리는 §9-2 F 「일본어 도우미 자리」), 표시 스위치는 §15, 역할극 「대답 연습」은 task-010d 가이드 §3-E(`PracticeDock`). 서버 계약 #180 은 **Leader 가 `api-contract.md` 에 반영**하고, 요청·응답 모양·한도는 prompt-engineer 기록(task-056)이 확정한다 — 이 절은 화면이 쓰는 칸만 적는다. 결정 근거·실측: `agent-vault/10-Flow/tasks/task-056-designer-record.md`.

### 22-0. 결정 최종값

| # | 결정 | 확정 | 채택 안 함 |
|---|---|---|---|
| — | 질의 입력 | 한국어 **글자** 입력(키보드) | 한국어 음성 질의 — 범위 밖(휴대폰 인식은 일본어 모델, 새 인식 경로는 별도 판단) |
| ① | 판 형태 | **A 입력 바 위 판** — 대답 연습 판과 같은 자리·모양 | 바텀시트 |
| ② | 후보 수 | **B 최대 3개** — 첫 카드만 보이고 [다른 말투 n개 더 보기]로 접음(추가 요청 없음) | 1개만 |
| ③ | 자연스러운 이유 | **A 카드마다 한 줄 있음** | 없음 |
| ④ | 도우미 버튼 | **B 둥근 아이콘만 44px + 처음 한 번 안내 말풍선** | 아이콘+글씨 56×56 |
| ⑤ | 녹음 중 판 | **A 그대로 보임** — 보내면(`accepted`) 닫고 마지막 답 기억 | 녹음 시작 때 사라짐 |
| ⑥ | 한국어 뜻 줄 | **A 늘 보임** — 「번역」 스위치와 무관(대답 연습 판 규칙) | 「번역」 스위치 따름 |
| ⑦ | 역할극 구분 문구 | **A 대답 연습 입구 부제도 바꿈** — 문구 한 줄만(§22-8) | 도우미 쪽만 |

고정: 저장(단어장 추가) 버튼 없음 — AI 는 제안만 · 판 안에 마이크·보내기 없음(대답 연습 D-8) · 마이크 72px 위치 불변 · 웹 배포만(네이티브 변경 없음) · 마친 역할극에는 없음.

### 22-1. 레이아웃 설계

1. **목표** — 회화 중 말이 막힐 때 하고 싶은 말을 한국어로 써서 물으면 일본어 표현을 보여 주고, 그 표현을 **보면서** 바로 말하거나(말 모드) 입력창에 넣어 고쳐 보내게(글자 모드) 한다. 저장하지 않는다.
2. **위계** — ① 마이크(주 행동, 72px 가운데 그대로) ② 도우미 버튼(보조 — 흰 원 44px, 마이크보다 약하게) ③ 판: 머리 → 입력 줄 → 첫 카드(일본어 17px) → [다른 말투].
3. **영역**(위→아래) — 머리 · (역할극: 목표 카드) · 표시 줄 · 대화 목록(유일한 세로 스크롤) · 띠(§9-2 G) · **[대답 연습 줄·판 | 도우미 판] 중 하나** · 입력 바. 판 안 세로 스크롤은 대답 연습 판과 같은 예외(§1-4 시트 내부 예외와 같은 취급).
4. **컴포넌트** — 새: `PhraseHelperButton` · `PhraseHelperTip` · `PhraseHelperPanel` · `PhraseHelperCard` · `usePhraseHelper` · `helperCopy.ts` · `phraseHelperLogic.ts` / 재사용: `JaText` · `HangulLine` · `useAnnotations` · `Skeleton`(`challenge/parts`) · `Badge` · `useKeyedSound` · `soundText` · `SOUND_MSG` · `composerRef.fill` · 방의 `notify`.
5. **상태** — §22-6 표.
6. **행동** — 주: 물어보기 → 말하기(아래 마이크) / 입력창에 넣기(글자 모드) · 보조: ▶ 듣기 · [다른 말투 더 보기] · ✕/Esc · 위험 동작 없음.
7. **반응형** — 360/390/412 같은 구조, 줄어드는 것은 글자 모드 입력창 폭뿐(180/210/232px). 판 최대 `min(46dvh,320px)`, 키보드가 올라오면 판은 머리+입력 줄만.

### 22-2. 자리 — 입력 바 (§9-2 F 에 더함)

**말 모드** (`#hp-closed` · `#hp-speaking`, 「세 폭」 「제안 · 버튼 B(원형 44) — 말 모드 · ■ 보이는 때」 행)
```
<div className="relative flex-none">                      ← 안내 말풍선(§22-4)의 기준 상자. 말풍선이 없으면 껍데기뿐
  {tipShown && <PhraseHelperTip />}
  VoiceBar (새 선택 prop `trailing?: ReactNode` — 넘기지 않으면 지금 화면과 같다)
    #talk-status h-6                                        ← 그대로
    <div className="mt-1 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center">
      ⌨ 44                                                  ← 그대로
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)] items-center">   ← 지금 `flex justify-center` 를 바꿈
        <span aria-hidden="true" />
        <PushToTalkButton … />                              ← 72, 가운데 — 위치 불변
        {stop ? <div className="ml-3 justify-self-start">{stop}</div> : <span aria-hidden="true" />}      ← task-061(IMP-0034): ■ 가 마이크 오른쪽 12px 로 옮겨 옴
      </div>
      {trailing ? <div className="justify-self-end">{trailing}</div> : (■ 44 | 빈 칸 44)}   ← 도우미는 우측 끝 44 칸(trailing 없으면 지금과 같음)
    </div>
</div>
```
- 실측(task-061, 2026-10-12 — 사용자 요청으로 도우미를 **우측 끝**으로 옮기고 ■ 와 자리를 맞바꿈): 마이크↔■ **12px**(세 폭 같음) · ■↔도우미 **28 / 43 / 54px**(360/390/412) · 도우미 오른쪽 끝 = 화면 오른쪽 − 16px · 가로 넘침 0. ■ 가 없을 때는 마이크 오른쪽이 빈 칸이고 마이크·도우미 위치는 그대로다.
- 녹음 중 마이크는 1.05배 + 바깥 링(§9-3 A)이지만 도우미가 이제 우측 끝에 멀리 있어 링이 닿지 않는다(■ 는 녹음 중 보이지 않는다). 그동안 도우미는 흐림·잠김.

**글자 모드** (`#hp-text`, 「세 폭」 「제안 · 버튼 B(원형 44) — 글자 모드」 행)
```
Composer leading={<>{🎤 44 (기존)}<PhraseHelperButton /></>}      ← Composer 의 `flex items-end gap-2` 그대로
[🎤][가あ][ 일본어로 써 보세요 — … ][↑]
```
- 입력창 폭 **180 / 210 / 232px**(지금 232 / 262 / 284). 넘침 0. 글자 모드에는 안내 말풍선을 띄우지 않는다(§22-4).
- `RolePlayEndedBar`(마친 역할극)에는 버튼·안내·판 모두 없다.

### 22-3. 도우미 버튼 — `PhraseHelperButton` (④B)

props `{ open: boolean; locked: boolean; describedBy?: string; onToggle(): void; onLocked(): void }` — 말·글자 모드 같은 부품, 같은 크기.

| 상태 | 모양 | 탭 |
|---|---|---|
| 닫힘 | `grid h-11 w-11 flex-none place-items-center rounded-full border border-line bg-surface text-ink` + 글리프 `<span aria-hidden="true" className="whitespace-nowrap text-[14px] font-bold leading-none tracking-[-0.5px]">가<span lang="ja" className="text-accent">あ</span></span>` | 판 열기(§22-10) + 안내 말풍선 닫기 |
| 열림 | `border-transparent bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--color-accent)]` · `aria-expanded="true"` | 판 닫기 — 초점은 버튼에 그대로 |
| 잠김(RECORDING·RECOGNIZING·**QUEUED·THINKING** — 사용자 결정 2026-10-11, QA-B2: 턴을 보낸 직후 약 1초 안에 도우미를 부르면 턴의 AI 호출이 도우미 뒤로 밀려 턴 첫 음성 p50 2.42→5.83s) | `opacity-40` + `aria-disabled="true"`(`disabled` 속성은 쓰지 않음 — 눌러서 이유를 듣게). 열 수 있는 상태는 **IDLE·SPEAKING** 뿐(선생님 말 재생 중은 AI 호출이 이미 끝났으니 허용) | 말하는 중(RECORDING·RECOGNIZING): 토스트 「말하는 중에는 열 수 없어요」(방의 `notify` — 녹음 중이면 끝난 뒤 뜸, §9-0 ⑨) · 선생님이 답을 만드는 중(QUEUED·THINKING): 토스트 「선생님이 답하는 중에는 열 수 없어요」 |
| 초점 | `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent` | — |

- **QUEUED·THINKING 에는 잠긴다**(사용자 결정 2026-10-11 — 도우미와 회화 턴은 같은 AI 호출 줄(동시 1건)을 나눠 써서, 턴을 보낸 직후 도우미를 부르면 턴이 밀린다. QA-B2). 단 **SPEAKING 에는 잠기지 않는다** — 선생님 소리를 재생하는 동안은 턴의 AI 호출이 이미 시작됐으니 도우미는 그 뒤에서 기다릴 뿐 턴을 밀지 않는다(`#hp-speaking`: 선생님 소리는 그대로, 판 안 ▶ 를 누를 때 멈춤).
- **접근성 이름** `aria-label="일본어 도우미"` · `aria-expanded` · `aria-controls="talk-helper"`(판이 있을 때만 — 없는 id 를 가리키지 않게) · 안내 말풍선이 보이는 동안 `aria-describedby="talk-helper-tip"`.
- 글리프는 그림 취급(`aria-hidden`). 열림 상태 `accent`/`accent-soft` 4.08:1 은 글자 기준엔 모자라지만 아이콘(비텍스트) 3:1 은 넘는다 — §1-1 「글자 금지」는 읽어야 하는 글에 대한 규칙이다.
- **툴팁**: hover `title` 은 달지 않는다 — 터치에서 보이지 않고, 앱의 다른 아이콘 버튼(⌨·🎤·■)도 쓰지 않는다. 버튼 뜻은 ① 이름 ② 처음 한 번 안내 말풍선(§22-4) ③ 판 머리 「일본어 도우미 / 하고 싶은 말을 한국어로 물어보세요」가 알린다.

### 22-4. 처음 한 번 안내 말풍선 — `PhraseHelperTip` (④B)

데모: 결정 ④ B 에서 `#hp-closed` · `#hp-speaking` · `#rp-closed` 에 보이는 말풍선(데모는 상태를 고를 때마다 다시 보인다 — 모형 한계, 실제는 아래 플래그).

- **문구**: 본문 「한국어로 물어보면 일본어로 알려 줘요」 · 닫기 버튼 `aria-label` 「안내 닫기」.
- **저장 — 기기 안 1비트 플래그**: `localStorage` 키 **`kaiwa.talk.helperTipSeen`** = `'1'`(기존 `common/storage.ts` `readStore`·`writeStore`, 전부 try/catch). 질의·답 원문은 어디에도 저장하지 않는다 — 이 키가 이 기능이 저장소에 남기는 **유일한 값**이다.
- **판정**(순수 함수, `talk/phraseHelperLogic.ts` — 단위 시험: 처음 / 이미 봄 / 저장 막힘):
  ```ts
  export const HELPER_TIP_KEY = 'kaiwa.talk.helperTipSeen'
  export function claimHelperTip(read = readStore, write = writeStore): boolean {
    if (read('local', HELPER_TIP_KEY) !== null) return false   // 이미 봄
    write('local', HELPER_TIP_KEY, '1')                         // 보이는 순간 = 본 것으로 기록
    return read('local', HELPER_TIP_KEY) === '1'                // 쓰기가 막힌 환경 → false = 한 번도 안 보임
  }
  ```
  `writeStore` 는 실패를 알리지 않으므로 **써 보고 다시 읽어** 가린다 — 사생활 모드·저장소 차단·WebView 설정에서 방마다 매번 뜨는 일이 없다(그 환경은 한 번도 안 보임).
- **언제 판정하나**: 말 모드 `VoiceBar` 에 도우미 버튼이 처음 그려진 뒤의 `useEffect` 에서 한 번. 참이면 이 방에 있는 동안 `tipOpen = true` — **방 한 번 방문 동안만** 보이고, 무시하고 지나가도 다음 방부터 뜨지 않는다. 서버 렌더·첫 렌더는 늘 숨김(hydration 차이 없음). 방 로딩 중·마친 역할극·**글자 모드에서는 판정하지 않는다**(글자 모드로 들어왔다가 말 모드로 바꾸면 그때 판정).
- **잠깐 숨김**(닫힌 것 아님 — 조건이 풀리면 이 방에서 다시 보임):
  `tipShown = tipOpen && !helper.open && !locked && !strip && !rp.practiceOpen && !toast.message`
  — 판 열림 · RECORDING·RECOGNIZING · 띠(오류·보내지 못한 말 등 — 버튼을 가리지 않게) · 대답 연습 판 펼침 · 토스트(말 모드 토스트 bottom 136px 와 겹침).
- **닫힘**(이 방에서 다시 안 보임): ✕ 탭 · 도우미 버튼 탭(판이 열리며 닫힘) · 방을 나감. 말풍선 본문 탭은 아무 일도 하지 않는다(데모와 같음).
- **모양**(데모 `.tip` 값 — §22-2 의 `relative flex-none` 상자 기준):
  ```
  <div id="talk-helper-tip" role="note"
       className="absolute bottom-[calc(100%+8px)] right-4 z-[5] flex w-[196px] items-start gap-0.5
                  rounded-[10px] bg-ink py-2 pl-3 pr-0.5 text-[12.5px] leading-[1.45] text-surface break-keep shadow-[0_6px_16px_rgba(0,0,0,.18)]">
    <p className="min-w-0 flex-1">한국어로 물어보면 일본어로 알려 줘요</p>
    <button type="button" aria-label="안내 닫기" className="relative grid h-7 w-7 flex-none place-items-center rounded-full text-surface before:absolute before:-inset-2">✕(14px, aria-hidden)</button>
    <span aria-hidden="true" className="absolute right-[15px] top-full border-[7px] border-transparent border-t-ink" />   ← 꼬리 = 도우미 버튼 가운데
  </div>
  ```
  - 위치 = `right-4`(task-061 이후 — 도우미가 우측 끝 44 칸이라 말풍선 오른쪽 끝이 도우미 오른쪽 끝(= 바 오른쪽 − 16)과 같다). 폭에 따라 변하는 값이 없어 화면 밖으로 나가지 않는다. VoiceBar 의 `px-4` 나 도우미의 우측 끝 배치가 바뀌면 같이 고친다. 꼬리(`right-[15px]`)는 도우미 가운데. 실측(task-061): 말풍선 148~344(360)/178~374(390)/200~396(412)px(왼쪽 여백 ≥16, 오른쪽 끝 = 도우미 오른쪽 끝), 꼬리 중심 = 도우미 중심.
  - ✕ 보이는 28px · 히트 44px(`before:-inset-2`). 다크 테마는 `bg-ink`/`text-surface` 가 저절로 뒤집힌다(대비 = §1-1 ink/surface 12:1 이상). 나타날 때 애니메이션 없음.
- **접근성**: `role="note"` — 나타날 때 낭독하지 않는다(누름 직전 소리와 섞이지 않게). 대신 보이는 동안 도우미 버튼 `aria-describedby` 로 이어져 버튼 초점 때 「일본어 도우미, 한국어로 물어보면 일본어로 알려 줘요」로 읽힌다. DOM 이 VoiceBar 앞이라 Tab 순서는 ✕ → ⌨ → 마이크 → (■, SPEAKING 중) → 도우미.
- 역할극 방에서는 말풍선이 「대답 연습」 접힌 줄 오른쪽 부분을 잠깐 가린다(데모 `#rp-closed` + ④ B 그림 그대로) — 한 번뿐이고 ✕ 로 바로 닫혀 받아들인다.

### 22-5. 판·카드 — `PhraseHelperPanel` · `PhraseHelperCard` (①A·②B·③A·⑥A)

```
<section id="talk-helper" aria-labelledby="talk-helper-title" data-kb-docked
         className="max-h-[min(46dvh,320px)] flex-none overflow-y-auto overscroll-contain border-t border-line bg-surface px-4 pb-3">
  머리 min-h-11 flex items-center gap-2 -mr-2:
    <div className="min-w-0 flex-1">
      <h2 id="talk-helper-title" 14px semibold>일본어 도우미</h2>
      <p 12px ink2 truncate>하고 싶은 말을 한국어로 물어보세요</p>
    </div>
    ✕ 44 rounded-full text-ink2  aria-label="일본어 도우미 닫기"
  <form noValidate className="mt-0.5 flex min-w-0 items-center gap-2">
    <label className="sr-only" htmlFor="talk-helper-q">한국어로 물어볼 말</label>
    <input id="talk-helper-q" type="text" lang="ko" enterKeyHint="search" autoComplete="off" spellCheck={false}
           aria-describedby="talk-helper-msg" disabled={녹음·인식 중}
           className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-[16px] text-ink placeholder:text-ink3 focus:outline-2 focus:-outline-offset-1 focus:outline-accent"
           placeholder={역할극 ? '예: 얼음 적게 해 주세요' : '예: 목이 쉬었어요'} />
    <button type="submit" aria-disabled={빈칸·초과·요청 중·녹음 중·429 대기} onPointerDown={e => e.preventDefault()}
            className="h-11 min-w-11 flex-none whitespace-nowrap rounded-xl bg-accent px-3.5 text-[14px] font-semibold text-on-accent aria-disabled:opacity-40">물어보기</button>
  </form>
  <p id="talk-helper-msg" role="status" className="mt-1 text-[12px] break-keep">…</p>        ← 늘 마운트(display:none 금지)
  <p role="status" className="sr-only">{결과·빈 결과·429 낭독 문장}</p>                       ← 늘 마운트, 녹음 중이면 끝난 뒤 채움
  <div className="mt-2.5 min-w-0 [:root[data-kb]_&]:hidden">  본문(상태별 §22-6) </div>
</section>
```
- [물어보기]는 `onPointerDown preventDefault` 로 입력칸 초점·키보드를 지키고, 보낼 때 input `blur()`(키보드 내림). **판 안 모든 조작 버튼(✕·예시 칩·카드 ▶·[입력창에 넣기]·[다른 말투 n개 더 보기]·[다시 시도])도 같은 `onPointerDown preventDefault`** — 입력칸 초점이 있을 때 버튼을 누르면 blur → 아래 바 재등장 → 판이 약 117px 밀려 click 이 사라지던 문제(QA-C F-2/F-3, 2026-10-11)를 막는다. 질의를 보내는 칩·[다시 시도]는 [물어보기]처럼 보낼 때 input `blur()`. 비활성은 흐림 + `aria-disabled` — 눌러도 보내지 않고 안내 줄로 이유를 말한다(Composer 보내기와 같은 방식). 키보드 검색 키(Enter)도 같은 동작, IME 조합 중 Enter 는 무시(`isComposing`·keyCode 229).
- 글자 수는 코드포인트(`HELPER_MAX = 100`, `helperCopy.ts` 한 곳). 서버도 같은 한도로 400 — 값은 prompt-engineer·Leader 확정값을 따른다.
- 결과 목록: `<ul aria-label="일본어 표현" className="flex flex-col gap-2">` 첫 카드 → (후보 2개 이상) 행 버튼 `my-1 flex h-11 w-full min-w-0 items-center gap-2 rounded-[10px] px-1 text-left`: 「다른 말투 n개 더 보기」(13 semibold ink) + 나머지 꼬리표를 ` · ` 로 이은 요약(12 ink2 truncate) + ▾/▴(aria-hidden), `aria-expanded`·`aria-controls="talk-helper-alts"` → `<ul id="talk-helper-alts" aria-label="다른 말투" hidden={!more}>`(늘 마운트). 펼친 문구 「다른 말투 접기」. 새로 물으면 다시 접힘.
- 판 안에 마이크·보내기·저장 없음. 말 모드 판에는 「말해 보세요」 줄을 두지 않는다(바로 아래 상태 줄 「누르고 있는 동안 말해요」가 다음 행동을 알림).

**카드** `PhraseHelperCard`
```
<li className="flex min-w-0 gap-0.5 rounded-[14px] border border-line bg-surface py-2.5 pl-3 pr-1">
  <div className="min-w-0 flex-1">
    {후보 ≥2 && labelKo ? <Badge tone="neutral">{labelKo}</Badge> : null}
    <JaText text={ja} state={ann} rt={11} leading={2.1} className="mt-1 text-[17px] text-ink [overflow-wrap:anywhere]" />
    <HangulLine state={ann} size={13} />
    <p className="mt-0.5 text-[13px] text-ink2 break-keep">{ko}</p>                                      ← ⑥A 늘 보임
    {whyKo ? <p className="mt-1.5 border-l-2 border-line pl-2 text-[13px] text-ink break-keep">{「」 안은 <span lang="ja">}</p> : null}   ← ③A
    {글자 모드 ? <button className={`${GHOST} mt-2`} aria-disabled={녹음 중}>입력창에 넣기</button> : null}
  </div>
  {!자막만 && soundText(ja) ? <button aria-label={`${ja} ${재생 중 ? '멈추기' : '듣기'}`} className="grid h-11 w-11 flex-none place-items-center rounded-full (재생 중: bg-accent text-on-accent)">▶/■</button> : null}
</li>
{소리 실패면 그 카드 아래 SOUND_MSG 한 줄(단어장 ▶ 와 같음)}
```
- `GHOST` = PracticeDock 의 같은 클래스 문자열(공용으로 꺼내거나 같은 값). 첫 카드는 서버가 준 순서 첫 항목(가장 흔한 말). 후보가 1개면 꼬리표·[다른 말투] 줄 없음.
- [입력창에 넣기] = 판 닫기 → `composerRef.current?.fill(ja)`(입력창을 그 문장으로 덮어쓰고 초점, 자동 전송 없음 — 대답 연습과 같은 동작, `#hp-text-filled`).

### 22-6. 상태 표 (데모 상태 id — 문구는 §22-7)

| 데모 id | 언제 | 화면 |
|---|---|---|
| `hp-closed` | 기본 | 버튼만. 처음 방문이면 안내 말풍선(§22-4) |
| `hp-speaking` | 선생님 말하는 중 | ■ 와 나란히, 버튼 위치 불변. 열 수 있음 |
| `hp-open-kb` | 처음 열기(이전 답 없음) | 판 + 입력칸 초점(키보드). 키보드 위에는 머리+입력 줄만, 아래 바 숨김 |
| `hp-typed` | 한 글자 이상 | [물어보기] 켜짐 |
| `hp-empty` | 빈 채(공백만 포함) 제출 | 안내 줄 bad 「물어볼 말을 한국어로 써 주세요」, 초점·키보드 유지 |
| `hp-long` | 90자~ / 100자 초과 | 「n/100」(ink2, 오른쪽) / bad 「100자까지 물어볼 수 있어요 · n/100」 + [물어보기] 흐림 |
| `hp-open` | 키보드 내림·이전 답 없음 | 「이렇게 물어보세요」 + 예시 칩 3개(방 종류별, 누르면 바로 물음) |
| `hp-loading` | 요청 0~5초 | `Skeleton heights={[120, 120]}` + sr 「일본어 표현을 찾는 중…」, [물어보기] 흐림 |
| `hp-slow` | 5초~12초 | 스켈레톤 아래 12 ink2 「조금만 기다려 주세요」 |
| `hp-result` | 결과 | sr 「표현 n개를 찾았어요」 · 첫 카드 + [다른 말투 n개 더 보기] |
| `hp-more` | 펼침 | 나머지 카드(판 안 스크롤) |
| `hp-playing` | ▶ | 그 카드 ■ + 주황 바탕. 한 번에 소리 하나 |
| `hp-rec` | 녹음 중(⑤A) | 판 유지 · 입력칸 `disabled` · [물어보기]·카드 버튼 `aria-disabled` · 도우미 버튼 흐림. 보내면(`accepted`) 판 닫힘, 다시 열면 마지막 답. **녹음을 시작할 때 아직 답이 오지 않은 도우미 요청(로딩·slow)은 자동 취소**(사용자 결정 2026-10-11, QA-B: 도우미가 먼저 돌면 회화 턴 첫 음성 p50 2.2s→5.2s) — 질의는 입력칸에 남고 안내 줄에 「말하는 동안 도우미를 멈췄어요. 끝나면 다시 물어봐 주세요.」 |
| `hp-none` | `items` 0개 | 상자(자체 `role` 없음 — 낭독은 늘 마운트된 sr-only 줄이 한다, §22-13): 「이 말에 맞는 일본어를 찾지 못했어요.」 + 12 ink2 「짧은 한국어 문장으로 다시 써 보세요. 예: ‘천천히 말해 주세요’」(역할극 ‘얼음 적게 해 주세요’). [다시 시도] 없음 |
| `hp-error` | 0·5xx·404 | `role=alert` 「지금은 표현을 가져오지 못했어요.」 + [다시 시도](GHOST) |
| `hp-timeout` | 12초·504 | `role=alert` 「시간이 오래 걸려 멈췄어요. 다시 물어봐 주세요.」 + [다시 시도] |
| `hp-rate` | 429 | 「n초 뒤 다시 물어볼 수 있어요.」(0 → 「잠시 뒤 다시 물어봐 주세요.」) + [다시 시도] — 카운트다운 동안 [다시 시도]·[물어보기] `aria-disabled` |
| ★ `busy` | 409 `TURN_RUNNING`(계약이 턴 중 호출을 막기로 할 때만) | 「선생님 말이 끝나면 다시 물어봐 주세요.」 + [다시 시도] — 데모에 없음, §22-15 |
| `hp-textonly` | 머리 표시등 「자막만」 | 카드 ▶ 없음(대답 연습 [▶ 듣기]와 같은 규칙) |
| `hp-text` | 글자 모드 결과 | 카드마다 [입력창에 넣기] |
| `hp-text-filled` | 넣은 뒤 | 판 닫힘 · 입력창 채움 · 초점(키보드) |
| `hp-text-kb` | 글자 모드 + 도우미 입력 중 | 아래 Composer 숨김(입력칸 두 개가 겹쳐 보이지 않게) |
| `rp-closed` | 역할극 | 「대답 연습」 줄(새 부제 §22-8) + 우측 끝 도우미 |
| `rp-helper` | 역할극 도우미 열림 | 대답 연습 줄·판을 그리지 않음 — 닫으면 돌아옴. 예시 칩은 가게 말 |
| `rp-practice` | 대답 연습 판이 열린 채 도우미 탭 | 대답 연습 판을 접고 도우미를 연다 / 도우미가 열려 있는 동안에는 대답 연습 줄 자체를 그리지 않는다(§22-10) — 도우미를 닫으면 줄이 돌아온다 |
| `rp-kb` | 역할극 + 도우미 입력 중 | 목표 카드(접힘)·표시 줄·대화만 남고 대답 연습 줄·마이크 줄 숨김 |
| — | 마친 역할극 | 도우미 없음 |

### 22-7. 문구 단일 출처 — `src/components/talk/helperCopy.ts` (데모 문구 그대로, ★ = 데모에 없던 것)

| 키 | 문구 |
|---|---|
| `button` (aria-label) | 일본어 도우미 |
| `tip` · `tipClose` | 한국어로 물어보면 일본어로 알려 줘요 · 안내 닫기 |
| `title` · `sub` · `close` | 일본어 도우미 · 하고 싶은 말을 한국어로 물어보세요 · 일본어 도우미 닫기 |
| `inputLabel` · `ask` | 한국어로 물어볼 말 · 물어보기 |
| `placeholder.talk` · `placeholder.rp` | 예: 목이 쉬었어요 · 예: 얼음 적게 해 주세요 |
| `empty` · `count(n)` · `over(n)` | 물어볼 말을 한국어로 써 주세요 · `{n}/100` · `100자까지 물어볼 수 있어요 · {n}/100` |
| `examplesLead` | 이렇게 물어보세요 |
| `examples.talk` | 목이 쉬었어요 · 천천히 말해 주세요 · 다음에 또 가고 싶어요 |
| `examples.rp` | 얼음 적게 해 주세요 · 빨대는 필요 없어요 · 여기서 마실게요 |
| `loadingSr` · `slow` | 일본어 표현을 찾는 중… · 조금만 기다려 주세요 |
| `found(n)` · `listAria` · `altsAria` | `표현 {n}개를 찾았어요` · 일본어 표현 · 다른 말투 |
| `more(n)` · `less` | `다른 말투 {n}개 더 보기` · 다른 말투 접기 |
| `listen(ja)` · `stop(ja)` · `fill` | `{ja} 듣기` · `{ja} 멈추기` · 입력창에 넣기 |
| `none` · `noneHint(ex)` | 이 말에 맞는 일본어를 찾지 못했어요. · `짧은 한국어 문장으로 다시 써 보세요. 예: ‘{ex}’`(일반 「천천히 말해 주세요」 / 역할극 「얼음 적게 해 주세요」) |
| `error` · `timeout` · `retry` | 지금은 표현을 가져오지 못했어요. · 시간이 오래 걸려 멈췄어요. 다시 물어봐 주세요. · 다시 시도 |
| `rate(n)` · `rateDone` | `{n}초 뒤 다시 물어볼 수 있어요.` · 잠시 뒤 다시 물어봐 주세요. |
| `cancelled` ★ | 말하는 동안 도우미를 멈췄어요. 끝나면 다시 물어봐 주세요. (녹음 시작·턴 시작 때 대기 중 요청을 자동 취소했을 때 안내 줄에. 말하는 동안은 `aria-live="off"`) |
| ★ `busy` | 선생님 말이 끝나면 다시 물어봐 주세요. |
| `locked` (토스트) | 말하는 중에는 열 수 없어요 |
| `lockedTurn` ★ (토스트) | 선생님이 답하는 중에는 열 수 없어요 (QUEUED·THINKING — 턴의 AI 호출이 도우미 뒤로 밀리지 않게) |

- 꼬리표(`labelKo`)·뜻(`ko`)·이유(`whyKo`) 문장은 서버(프롬프트)가 준다 — 화면은 문구를 만들지 않는다. 엔진·모델 이름이 들어간 문구 없음.

### 22-8. 역할극 「대답 연습」 입구 부제 (⑦A — 문구 한 줄만)

- `src/components/scenario/scenarioCopy.ts` `PRACTICE.entrySub`: 「무엇을 말할지 막히면 눌러요」 → **「선생님 말에 맞는 대답 예시를 봐요」**.
- 바뀌는 것은 접힌 줄 부제 글자뿐이다. 대답 연습의 보이는 조건·호출(#169)·판·모드·동작은 task-010d 가이드 §3-E 그대로. 시험은 상수를 참조해 고칠 필요 없음(`scenario/__tests__/roomRender.test.ts:145`).
- 부제는 `truncate` — 360 에서 새 문구가 잘리지 않는지 QA 확인(잘려도 넘침은 없음).
- 두 기능의 구분: 「대답 연습」 = 선생님 말에 대한 **대답 예시 보기**, 「일본어 도우미」 = **내가 하고 싶은 말을 한국어로 묻기**.

### 22-9. API — #180 (Leader 가 `api-contract.md` 에 반영 · 계약 확정은 prompt-engineer 기록 참조)

| # | 엔드포인트 | 메서드 | 화면 동작 | 요청 | 화면이 쓰는 칸 | 오류 처리 |
|---|---|---|---|---|---|---|
| 180 | `/api/v1/chats/:id/phrase-help` | POST | [물어보기] · 예시 칩 · [다시 시도] | `{ queryKo }` — trim 1~100 코드포인트(화면이 먼저 막음) | `items[1..3].{ ja, ko, labelKo?, whyKo? }` — 첫 항목 = 가장 흔한 말, 0개면 빈 결과 | 400 → 입력 안내(보통 오지 않음) · 404 → `hp-error` · 409 `ENDED` → 판 닫고 기존 마친 방 처리(다시 읽기) · 409 `TURN_RUNNING`(계약이 막을 때만) → ★`busy` · 429 → `hp-rate`(`Retry-After` 또는 계약의 대기 초) · 502·0 → `hp-error` · 504·12초 → `hp-timeout` |
| 24r | `/api/v1/text/annotate` | POST | 카드 루비·한글 줄 | `items[].ja`(기존 `useAnnotations`) | 읽기 조각 | 실패해도 일본어 글자는 보임(기존 `JaText`) |
| — | 기존 단어 소리 경로(`useKeyedSound`) | — | 카드 ▶ | `ja` | — | 기존 `SOUND_MSG` |

- 위 요청·응답 모양은 **화면 가정**이다 — 계약이 달라지면 Leader 가 알려 주고 「화면이 쓰는 칸」만 맞춘다. 대화 맥락(마지막 선생님 말·역할극 역할)은 화면이 보내지 않는다(서버·프롬프트 판단 — 화면 문구도 맥락 사용을 약속하지 않음).
- 저장 없음(#169 선례). 질의·답 원문은 `RequestTrace`·로그·브라우저 저장소에 남기지 않는다.

### 22-10. 상태 관리 — `usePhraseHelper(chatId, roomKind)` · `TalkRoom`

- 훅 상태 `{ open, query, phase: 'idle'|'loading'|'slow'|'result'|'none'|'error'|'timeout'|'rate'|'busy', items, more, playingKey, rateUntil, hint }` — **메모리만**(방을 나가면 사라짐). 질의 초안도 `sessionStorage` 에 두지 않는다.
- **열기**: 이전 결과 없음 → 입력칸 초점(같은 사용자 동작 안 — 판 마운트 직후 `useLayoutEffect` 한 번) / 있음 → 결과 그대로, 키보드 안 올림(`hp-open` 의 두 번째 줄). **닫기**(✕·Esc·버튼 재탭): 초점 → 도우미 버튼. Esc 는 초점이 판 안이거나 버튼일 때만.
- **물어보기**: `AbortController` + 12초 끊기, 5초에 `slow`. 요청 중 재요청 금지. 새 질의는 `more=false` · 소리 정지 · input `blur()`. 판을 닫아도 요청은 끝까지 받아 결과를 기억한다(다시 열면 보임).
- **서로 배타**(방 상태): 도우미 열기 → `rp.closePractice()` + (`rp.goalOpen` 이면) `rp.toggleGoal()` / 목표 카드·대답 연습이 **새로**(false→true) 펼쳐지면 도우미 닫기 / 띠가 새로 뜨면 도우미 닫기(결과 기억) / 도우미가 열려 있는 동안 TalkRoom 은 `PracticeDock` 를 그리지 않는다(`PracticeDock` 수정 없음).
- **녹음(⑤A)**: 판 유지 · 입력 `disabled` · [물어보기]·카드 버튼 `aria-disabled`([다른 말투] 펼침은 허용). 턴 `onAccepted`(말·글자 모두) → 판 닫기(결과 기억). 너무 짧아 보내지 않은 녹음이면 판 유지. 결과 낭독은 녹음이 끝난 뒤로 미룬다(§9-0 ⑨). **녹음 시작 시(마이크를 누르는 `onPress`, `stt.press()` 직전) 그리고 모든 회화 턴 시작(`sendOutgoing` 첫 줄 — 글자 전송·다시 보내기·밀려 있던 말 포함) 때 대기 중(`loading`·`slow`) 요청은 `cancelPending()` 으로 취소**한다 — 서버는 이미 `req.signal` 로 엔진 호출을 멈춘다(#180 `CANCELLED`, 약 0.5초). 취소하면 `phase='idle'`, 질의는 유지, 안내 줄(`talk-helper-msg`)에 「말하는 동안 도우미를 멈췄어요. 끝나면 다시 물어봐 주세요.」. 결과가 이미 보이는 상태(`result`)는 그대로 둔다. 글자로 회화 턴을 보내는 경로에서도 대기 중 요청이 있으면 같은 규칙으로 취소한다.
- **소리**: `useKeyedSound` 키 `helper:{index}`. ▶ → 먼저 방 재생 `playback.stop()` + `rp.stopSound()`. 마이크 누름(`onPress` 첫 줄에 추가) · 방 소리 시작 · 판 닫힘이면 멈춤 — 한 번에 하나(대답 연습과 같은 규칙).
- **안내 말풍선**: 방 상태 `tipOpen`(§22-4) + 표시 식 `tipShown`.
- **입력 중**: 도우미 입력칸 `onFocus`/`onBlur` → 방 상태 `helperTyping`(§22-11).

### 22-11. 키보드 · 스켈레톤 높이 · 표시 스위치 · 접근성 · 폭

- **키보드**(`#hp-open-kb` · `#hp-text-kb` · `#rp-kb`): 도우미 입력칸에 초점이 있는 동안 `helperTyping=true` → VoiceBar(+안내 상자)·Composer·대답 연습 줄을 그리지 않는다 — **초점 기반**이라 `data-kb` 가 없는 앱 WebView 에서도 동작한다. 판 본문(예시·결과) 숨김만 `[:root[data-kb]_&]:hidden` 에 기댄다. 판 `section` 은 `data-kb-docked`(KeyboardInset 이 판 안 입력칸을 스크롤로 옮기지 않게 — Composer 와 같음)이고, 셸 높이가 `--kb-inset` 만큼 줄어 판이 키보드 위에 온다. 판이 맨 아래인 동안(입력 중) 아래 여백 `max(12px, var(--safe-bottom))`. 실측 360×780(키보드 모형 300): 대화 목록 약 280px(역할극 약 230px).
- **스켈레톤 높이**: 판 안 로딩 = `Skeleton heights={[120, 120]}`(③A 이유 줄 있음 → 카드 120, ②B → 두 장 — 결과 「첫 카드 + [다른 말투] 줄」과 비슷한 높이라 바뀔 때 판이 덜 출렁인다). 방 첫 로딩은 `LoadingBlock` 이라 입력 바를 그리지 않아 바뀌지 않는다. 탭 스켈레톤(§17·`tabSkeletonSizes`)과 무관 — 회화방은 하위 화면이다.
- **판 높이**: 최대 `min(46dvh, 320px)`, 넘치면 판 안 스크롤. ②B+③A 첫 카드만일 때 [다른 말투] 줄이 판 아래로 말 모드 약 20px·글자 모드 약 73px 밀려 조금 넘겨야 보인다(데모 결정 ② B 에 공개된 실측 — 받아들임). 펼치면 240~535px 넘겨 본다.
- **표시 스위치**(§15): 히라가나 → `JaText` 루비, 한글 → `HangulLine`(두 부품이 스위치를 읽음 — PracticeDock 와 같은 쓰임), **번역 → 카드 뜻 줄에는 적용하지 않음(⑥A)**. 이유 줄은 한국어 설명이라 늘 보인다. 대화 말풍선 번역은 지금처럼 스위치를 따른다.
- **접근성 요약**: 버튼 이름·`aria-expanded`·`aria-controls`(판이 있을 때만)·`aria-describedby`(안내) / 판 = `<section aria-labelledby>` 비모달(대답 연습 판과 같음), ✕·Esc 로 닫으면 초점 → 버튼 / 입력칸 sr 라벨 + 안내 줄 `aria-describedby` + `role=status`(늘 마운트) / 결과·빈 결과·429 는 늘 마운트된 sr `role=status`, 오류·시간 초과는 `role=alert` 상자 / 일본어 칸 `lang="ja"`, 입력칸 `lang="ko"` / 색만으로 구분하지 않음(글자로 말함) / 터치 44px — 칩·안내 ✕ 는 `before:` 히트.
- **폭**: 360/390/412 가로 넘침 0(데모 실측), 판·카드 `min-w-0`, 일본어 `[overflow-wrap:anywhere]`(일본어 블록에 `break-keep` 금지 §1-2), 한국어 설명만 `break-keep`.
- **엔진명·저장**: 화면·DOM·`aria-*`·토스트·콘솔에 엔진·모델 이름과 추적 값 0. 브라우저 저장소에 남는 것은 `kaiwa.talk.helperTipSeen='1'` 하나.

### 22-12. 생성·수정 파일 · 구현 순서 (`src/components` 만 — 서버 라우트·conversation 모듈은 Leader 사양)

- 새: `src/components/talk/{PhraseHelperButton,PhraseHelperTip,PhraseHelperPanel,PhraseHelperCard}.tsx` · `usePhraseHelper.ts` · `helperCopy.ts`(§22-7 + `HELPER_MAX`) · `phraseHelperLogic.ts`(순수: 글자 수·잠김 이유·실패 → 상태·`claimHelperTip`·`HELPER_TIP_KEY`) · `__tests__/phraseHelper.test.ts`.
- 수정: `talk/TalkRoom.tsx`(자리·배타·`helperTyping`·띠·`onAccepted` 닫기·소리·안내 상자) · `talk/VoiceBar.tsx`(`trailing` 슬롯) · `scenario/scenarioCopy.ts`(⑦A 한 줄). 응답 타입 위치는 developer 판단.
- 순서: ① 문구·순수 함수 + 시험(`claimHelperTip` 처음/이미 봄/저장 막힘 포함) → ② `VoiceBar trailing`(없으면 무변화) → ③ Button·Tip·Card·Panel(가짜 데이터) → ④ `usePhraseHelper`(API 연결은 계약 확정 뒤) → ⑤ TalkRoom 배치·배타·키보드·띠·소리 → ⑥ ⑦A 문구 → ⑦ 360/390/412 × 780/892 · 키보드 · 다크 · 엔진명 점검.

### 22-13. 주의사항 · developer 금지

- 대답 연습(`PracticeDock`)·목표 카드의 **동작을 바꾸지 않는다** — TalkRoom 이 그리기 여부만 정한다. ⑦A 는 문구 한 줄.
- `PushToTalkButton` 은 고치지 않는다. VoiceBar 치수를 바꾸면 안내 말풍선 위치 공식도 같이 고친다.
- 저장 버튼·저장 경로를 만들지 않는다(단어장 추가 없음). 질의·답을 `localStorage`·`sessionStorage`·`console` 에 남기지 않는다.
- 판 안에 마이크·보내기를 두지 않는다. [입력창에 넣기]는 채우기만, 자동 전송 금지.
- `role=status`·`alert` 영역을 상태가 바뀔 때 새로 마운트하지 않는다(안내 줄·결과 sr 줄은 늘 마운트 — 오류 상자 `alert` 만 예외).
- 빈 상태·로딩·오류·429·자막만·마친 역할극을 모두 그린다(§22-6). 권한 거부·오프라인은 회화방 규칙 그대로(도우미 요청 실패는 `hp-error`).

### 22-14. reviewer·qa 확인표

| # | 항목 | 확인 |
|---|---|---|
| H1 | 자리·폭 | 360/390/412 가로 넘침 0 · PTT 위치가 도우미 유무·■ 유무와 무관 · 마이크↔■ 12px · 도우미는 우측 끝(오른쪽 − 16) · 글자 입력창 180/210/232 |
| H2 | 터치 | 도우미·판 ✕·[물어보기]·▶·[다른 말투]·[입력창에 넣기]·[다시 시도] 44px 이상, 칩·안내 ✕ 는 히트 44 |
| H3 | 처음 한 번 안내 | 새 브라우저 프로필 → 첫 말 모드 방에서 보임 → 같은 방 녹음·띠·토스트 동안 숨었다 다시 보임 → ✕ 또는 도우미 탭으로 닫힘 → 다른 방 안 보임 · 사이트 데이터 차단 환경 → 한 번도 안 보임 · 글자 모드로 들어오면 안 보이다가 말 모드로 바꾸면 보임 · 버튼 초점 낭독에 안내 문장 포함 |
| H4 | 흐름 | 열기 → 초점·키보드 → 빈 제출 안내 → 입력 → 물어보기(키보드 내림) → 스켈레톤 → 첫 카드 + [다른 말투 n개] → 펼침 → ▶(선생님 소리 먼저 멈춤) → (글자) [입력창에 넣기] → 판 닫힘·입력창 채움·초점 · 다시 열면 마지막 답·키보드 안 올림 · Esc → 초점 버튼 |
| H5 | 녹음(⑤A) | 판 유지 · 입력·[물어보기]·카드 버튼 잠김 · 도우미 버튼 흐림 + 탭 토스트 · 보낸 뒤 닫힘 · 너무 짧은 녹음이면 판 유지 · **녹음 시작 때 대기 중 요청 자동 취소(안내 줄 문구)** |
| H5b | 선생님 답변 중 잠금 | QUEUED·THINKING 에서 도우미 버튼 `aria-disabled` + 토스트 「선생님이 답하는 중에는 열 수 없어요」, SPEAKING·IDLE 에서 열림 · 판이 열린 채 THINKING 이 되면 판 유지·입력/버튼 잠김 |
| H6 | 역할극 | 도우미 열면 대답 연습 줄·판 사라짐 · 대답 연습 줄·목표 카드 펼치면 도우미 닫힘 · 입구 부제 「선생님 말에 맞는 대답 예시를 봐요」 · 대답 연습 동작 회귀 없음 · 마친 역할극에 도우미 없음 |
| H7 | 실패(모의) | 0개 · 오류 · 12초 · 429 카운트다운 · (계약 시) 409 `TURN_RUNNING`·`ENDED` |
| H8 | 표시 스위치 | 히라가나·한글 꺼짐 반영 · 「번역」을 꺼도 카드 뜻 줄은 보임 |
| H9 | 저장·엔진명 | 질의 뒤 `localStorage`·`sessionStorage` 에 질의·답 없음(`kaiwa.talk.helperTipSeen` 만) · `console` 출력 0 · DOM·`aria-*`·토스트에 엔진·모델 이름 0 |
| H10 | 5초 예산 | QA 계정 라이브 응답 시간 분포(5초 안 비율) — 서버·프롬프트 지표와 함께 |
| H11 | 키보드 | 360×780 + 키보드: 판 머리+입력 줄만, VoiceBar·Composer·대답 연습 줄 숨김 · 앱 WebView 실기기(§22-15 D) |
| H12 | 다크 | 안내 말풍선 색 반전 · 열림 버튼 링 · 카드 테두리 |

### 22-15. 데모와 다르게 쓴 곳 · Leader 확인

데모와 다르게 쓴 곳(모양 불변 — 동작·접근성 보강):
1. **안내 말풍선 숨김 조건 추가**: 데모는 판 열림·녹음 중만 그렸다. 인식 중(RECOGNIZING — 버튼이 잠기는 구간과 맞춤)·띠·대답 연습 판 펼침·토스트 동안도 숨긴다(오류 띠의 버튼·토스트와 겹침 방지).
2. **안내 「본 것」 기록 시점 = 처음 보인 순간**(방 한 번 방문 동안만 보임). 저장소가 막힌 환경은 한 번도 안 보인다(Leader 해석 「기기 안 1비트 플래그」를 따름).
3. **안내가 보이는 동안 도우미 버튼 `aria-describedby`** — 데모 자체 점검 Minor 「처음 나타날 때 낭독되지 않음」의 보완.
4. **`aria-controls` 는 판이 있을 때만**, 다른 말투 목록은 `hidden` 으로 늘 마운트(데모는 펼쳤을 때만 그림 — 없는 id 참조 방지).
5. **결과 낭독을 늘 마운트된 sr 상태 줄 하나로**(데모는 결과 때 새로 그린 status — 새로 생긴 라이브 영역은 읽히지 않을 수 있음).
6. **판 `data-kb-docked` + 입력 중 아래 여백 `max(12px, var(--safe-bottom))`**(데모 키보드 모형에는 없던 셸 규칙).
7. ★ **409 `TURN_RUNNING` 문구**는 계약이 턴 중 호출을 막기로 할 때만 쓴다(데모에 없음).

Leader 확인:
- **A. 턴 진행 중 호출** — ✅ **닫힘(2026-10-11 사용자 결정)**: QUEUED·THINKING 동안 도우미 버튼을 잠근다(화면만, 서버 `TURN_RUNNING` 409 는 두지 않음). 이유: QA-B2 에서 턴 직후 약 1초 안에 도우미를 부르면 턴 첫 음성 p50 2.42→5.83s. SPEAKING 은 허용.
- **B. 한도** — 글자 수 100·429 분당/하루 값은 prompt-engineer·Leader 확정값으로 `helperCopy.ts` 상수만 바꾼다.
- **C. 원문 미보관** — 화면은 질의 초안도 저장하지 않는다. 저장소에 남는 값은 `kaiwa.talk.helperTipSeen='1'` 하나(reviewer 확인 대상).
- **D. 앱 WebView 키보드** — `KeyboardInset` 주석상 앱(Android 15 edge-to-edge)은 키보드 인셋을 받지 않아 `data-kb` 가 켜지지 않는다 [가능성 높음]. 그 경우 판 본문이 키보드 위에서 숨지 않고, 입력 줄이 키보드에 가려지는지는 Composer 와 같은 기존 한계다 — 실기기 확인(H11).

## 23. 오늘의 단어 — 카드 우선 방식 통합 (task-059, IMP-0011, 2026-10-11)

> **⚠ task-060(2026-10-12)이 이 절의 덱 조작(스와이프 지도 D0·앞면 [뜻 보기][객관식] 두 칸·도구 줄 [건너뛰기]·`choicesRef`/`'choicesBtn'` 초점·키 힌트 문구)을 §24 로 대체했다. 충돌하면 §24 가 이긴다.** 이 절의 나머지(카드 우선 세트 서버 계약·탭=객관식·보기 목록·결과·홈 카드)는 그대로 유효하다.

> 승인 데모: `docs/demo/task-059-today-words-card-first-v1.html` (v1) — sha256 `5ee92a5850232c1aabe270522a3a6bd1240e9dde16f36c60e59911af1cd7a671`, 토큰 `src/app/globals.css@sha256:a314f18f1807`(2026-10-11 지금 파일과 같음 확인). 사용자 승인 2026-10-11 22:37, 원문 「task-059 데모 v1 승인, D0~D8은 권고대로」. 데모를 처음 열면 그려지는 권고안(D0~D8 모두 A)이 곧 승인안이다.
> **우선순위: task 이력서 「확정 결정」 표(D0~D8)·「서버 명세」 > 이 절 > 데모.** 데모는 합성 5장(Q9 예시)·시스템 글꼴·`pointer` 이벤트 흉내라 **수치는 비교용**이고, 문구·간격·색 토큰·상태 구성은 데모가 기준이다. 데모와 다르게 쓴 곳·Leader 확인은 23-12 에 모았다.
> 이 절은 §5(task-008)의 일부를 **대체·보완**한다(대체 줄 목록 23-1 B). §5 의 나머지(제스처 이식 §5-2 C, 요청 큐, 결과 화면 구조, 끝내기 시트 등)는 그대로 유효하다. 이력서: `agent-vault/10-Flow/tasks/task-059-improve-today-words-card-first.md`, 데모 기록: `task-059-designer-record.md`.
> 적용 토큰(이름만, 새 색 없음): `--color-ground` · `--color-surface` · `--color-surface2` · `--color-ink` · `--color-ink2` · `--color-ink3` · `--color-line` · `--color-accent` · `--color-on-accent` · `--color-accent-soft` · `--color-good` · `--color-good-soft` · `--color-bad` · `--color-bad-soft`. 공용 부품: `BackBar` · `Btn`·`BtnRow`·`Card`(`common/ui.tsx`) · `JaText`·`HangulLine` · `SkeletonRegion`.
> **스키마·네이티브 변경 없음** → 웹 배포만. 서버 변경은 이력서 「서버 명세」(Leader 확정)대로 — 이 절은 화면이 기대는 계약만 인용한다(23-4).

### 23-0. 레이아웃 설계 (page-layout-designer — delta 범위, 데모 기록 그대로)

| 항목 | 내용 |
|---|---|
| 목표 | 방식을 고르지 않고 카드로 바로 풀되, 헷갈리면 같은 카드에서 객관식으로 확인하고, 뜻 보기 면에서 단어·예문을 듣는다. 스와이프는 그대로 |
| 주요 위계(덱) | 카드(표현) → 카드 아래 듣기 줄(뜻 보기 면만) → 힌트 한 줄 → 답하는 버튼(앞면 [뜻 보기]·[객관식] / 보기 4개 / [알았어요]·[몰랐어요]) → 도구 줄 |
| 주요 위계(오늘 홈) | 장수 → (분류) → [시작하기] — 방식 줄 없음 |
| 영역 | 제스처 영역(카드 면만, 버튼 없음)과 버튼 영역(카드 밖)의 분리는 지금 그대로(§5-0 4). **새 버튼(객관식·듣기)은 모두 카드 밖** |
| 컴포넌트 | 기존 `ChoiceList`·`FlipControls`(앞면 두 버튼으로 확장)·`DeckToolbar`(그대로)·`GestureHint`(문구 계산 밖으로)·`VocabCardFace`(안내·띠만) + 새 `DeckListenRow`·순수 모듈 `cardFirst.ts` |
| 상태 | 앞면(보기 닫힘/열림) · 확인 중 · 객관식 정답/오답 · 뜻 보기 면(답 전/기록 중/스스로 답함) · 건너뜀 · 지난 카드 · 보기 없는 세트 · 이전 세트(4지선다/뒤집기) · 소리 7종 · 답 저장 실패 · 섞인 결과 |
| 반응형 | 360/390/412 폭의 일반 조합은 덱 스크롤 0. 카드 높이 340 상한, 객관식으로 답한 뒤에만 듣기 줄만큼 작아진다(데모 실측 −40px). **예외(QA β1 결함 #1·REV-187)**: 360×740 + 주제 세트 알림 + 객관식으로 답한 뒤처럼 무대가 카드 하한+패딩(224)보다 작아지는 조합은 겹침 대신 `main` 이 스크롤된다(수정 `VocabDeck` 무대 `min-h-[224px]`, 약 +44.2px) — §23-7 B |

### 23-1. 한눈에 보는 결정 · §5 에서 대체되는 줄

#### A. 확정 결정(D0~D8 = 구현 기준)

| # | 확정 | 화면에 미치는 것 | 이 절 | 데모 탭 |
|---|---|---|---|---|
| D0 | 스와이프 지금 그대로 | 위 = 다시 볼 카드 표시 · 왼쪽 = 다음(답한 뒤에만) · 오른쪽 = 이전. 알았어요/몰랐어요는 뜻 보기 면 **버튼**만. 스와이프로는 채점하지 않는다 | 23-3 | E |
| D1 | 앞면 탭 = 객관식 열기/닫기 + [객관식] 버튼 | 탭 판정(10px 미만)·판정 순서·임계는 그대로, 「탭이 하는 일」만 바뀜. 뜻 보기 면·답한 카드는 탭해도 그대로 | 23-3 | B·D |
| D2 | 객관식 = 머묾 + [다음 카드] · 스스로 = 0.4초 뒤 자동 | 두 경로 모두 지금 코드 동작(4지선다·뒤집기) 그대로 | 23-3 | D·C |
| D3 | 카드 바로 아래 한 줄 [단어 듣기][예문 듣기] | 예문 없음·100자 초과면 [단어 듣기]만. 카드 안에는 버튼 없음 | 23-5 | C·I |
| D4 | 모든 제스처에 화면 버튼·키(새 C 키) + 초점 이동·화면 읽기 알림 | `keyAction` 확장, 초점 목표 1종 추가 | 23-6 | B |
| D5 | 합산 타일 그대로 + 섞였을 때만 구분 한 줄 | `chosenText` 유무로 화면이 센다(새 API 필드 없음) | 23-9 C | F |
| D6 | 이전 세트는 시작한 방식 화면 그대로 + 듣기 버튼, 다시 풀기는 새 방식 | 이전 세트용 서버 변경 없음, #53 만 새 방식 | 23-9 A | G |
| D7 | 도구 줄 4칸 그대로 | 앞면 버튼 8개(4지선다) → 6개 | 23-3 | B |
| D8 | 시작 카드 설명 문구 그대로 | 「카드를 넘기며 뜻을 맞혀요. 틀린 단어일수록 자주 나와요.」 유지 | 23-7 | A |

#### B. §5 에서 대체·보완되는 줄 (줄 번호 = 이 절을 넣은 뒤의 `docs/screens.md`, 해당 줄 끝에 `[task-059 → §23-x]` 표시)

| §5 위치 | 줄 | 지금 서술 | task-059 이후 | 이 절 |
|---|---|---|---|---|
| §5-0 2 | 1307 | 준비 = 장수·**방식**·분류 | 장수·분류 → [시작하기] | 23-2 |
| §5-0 3 | 1308 | 정답은 서버만 안다(모든 세트) | **CHOICE 세트에만**. 카드 우선(FLIP) 세트는 뜻이 처음부터 오지만 채점 표시는 여전히 #50 응답으로만 | 23-4 |
| §5-0 6 | 1311 | 모드별 조작 수 | 카드마다 답한 방식(객관식 2탭+[다음] / 스스로 2탭 자동) | 23-3 |
| §5-1 음성 | 1325 | 소리 버튼 없음(E9) | 뜻 보기 면 카드 아래 듣기 줄 | 23-5 |
| §5-2 A `ready` | 1380 | 「방식」 라벨 + `Segmented` | 삭제 | 23-2 |
| §5-2 A 저장 | 1399 | `kaiwa.vocab.mode` 저장 | 읽지도 쓰지도 않음(정리) | 23-2 |
| §5-2 A `inProgress` | 1381 | 「{mode 라벨}」 | 이전 4지선다 세트만 방식 이름 | 23-9 |
| §5-2 A 다시 풀기 | 1430 | `downgraded` → notice `deleted` | 보기 없는 세트 → notice `noChoice` | 23-4 |
| §5-2 B DeckNotice | 1529 | 「…이번엔 뒤집기 카드로 풀어요.」 | 새 세트는 「…이번엔 객관식 없이 풀어요.」(이전 세트 문구는 유지) | 23-8 |
| §5-2 B FlipControls | 1585 | 앞면 [뜻 보기] 한 개 | 보기가 있으면 [뜻 보기][객관식] | 23-3 |
| §5-2 B 소리 자리 | 1599 | 도구 줄 [읽기]·[표시] 사이(그리지 않음) | 도구 줄은 그대로 4칸, 소리는 카드 아래 듣기 줄 | 23-5 |
| §5-2 B GestureHint | 1603 | 모드별 고정 문구 | 카드 상태별 문구(정밀 포인터), 소리 안내 줄 | 23-6 |
| §5-2 C 바꾸는 것 | 1625 | 탭 → FLIP 뒤집기 / CHOICE 읽기 | 카드 우선 세트: 탭 → 객관식 열기/닫기 | 23-3 |
| §5-2 C 키보드 | 1639 | C 키 없음 | C 키·보기 열림 때 1~4 | 23-6 |
| §5-2 D 한 장의 흐름 | 1653 | 두 모드 흐름 | 23-3 상태 머신이 대체(이전 세트는 §5-2 D 그대로) | 23-3 |
| §5-2 E 결과(머리) | 1667 | 부제 `{mode 라벨}` · FLIP 이면 「알았어요」 | 객관식 답이 하나라도 있으면 「맞혔어요」 + 섞였을 때 한 줄 | 23-9 |
| §5-4 #47 | 1773 | `{count, mode, category}` | `{count, category}` — `mode` 를 보내지 않는다 | 23-4 |
| §5-8 ⓐ 방식 | 1856 | 방식 라벨·aria 「푸는 방식」 | 삭제 | 23-8 |
| §5-8 ⓓ 라벨 | 1910 | VocabMode 라벨 늘 표시 | 이전 4지선다 세트에만 | 23-8 |
| §5-9 제스처 | 1924 | 탭 = FLIP 뒤집기 / CHOICE 읽기 | 23-11 표 | 23-11 |
| §5-10 저장소 | 1962 | 기본값 CHOICE | `kaiwa.vocab.mode` 없음 | 23-2 |

그대로 유효(바꾸지 않음): §5-0 4(제스처 영역 밖 버튼)·§5-0 5(제스처 의미)·§5-2 B 카드 안 버튼 금지(「카드 안에는 버튼을 두지 않는다」)·§5-2 C 「그대로 옮기는 것」 표 전부·저항·reduced-motion·§5-3 요청 큐·타이머·§5-2 E 보관·목록 구조·§5-2 F 끝내기 시트.

### 23-2. 파일 지도 (경로·줄은 2026-10-11 코드에서 확인 — [확실], 「미확인」 표시 제외)

| 구분 | 파일 | 할 일 |
|---|---|---|
| **고치지 않음** | `src/components/vocab/SwipeCardStack.tsx` | **0줄 변경.** 탭(<10)·위(dy<−80)·좌우(\|dx\|>60) 판정, 저항, `touchend preventDefault`(:162-167), 3장 스택, `touch`+`mouse` 이벤트 구성, `locked` 시 드래그 무시 모두 그대로. 탭이 하는 일은 부모(`VocabDeck.onTap`)가 정한다 |
| 고치지 않음 | `deck.ts` 의 `classifyGesture`·`resistX`·`TAP_MAX`·`UP_MIN`·`SIDE_MIN`·`RESIST`·`FLY_MS` | 기존 시험(`deck.test.ts` 9/10·79/80·59/60) 그대로 통과해야 한다 |
| 고치지 않음 | `wordSound.ts` · `useWordSound.ts` · `WordSoundButton.tsx` | `talk/PhraseHelperCard.tsx`(task-056 다른 세션)·`scenario/*` 가 import 한다. **읽어 쓰기만**, 덱용 모양·문구는 새 `cardFirst.ts` 에 |
| 고치지 않음 | `useAttemptQueue.ts` | 이미 `send(body)` 범용 — FLIP 세트의 `chosenText` 본문도 그대로 보낸다(본문을 만드는 곳은 `useVocabDeck.choose`). `AttemptBody`(`src/types/vocab.ts:225`)에 `{order, chosenText, responseMs, flagged?}` 형태가 이미 있다 |
| 고치지 않음 | `logic.ts` · `validate.ts` · `DeckProgress.tsx` · `DeckToolbar.tsx` · `FinishConfirmSheet.tsx` · `ChallengeStrip.tsx` | 방식(`mode`) 참조 없음(grep 확인). `ChallengeStrip` 에는 방식 줄이 **원래 없다** — 데모 H 의 방식 줄은 `TopicWordsCard` 쪽이다 |
| 고치지 않음 | `src/types/vocab.ts` 의 모양 | `VocabCard.choices?: string[] \| null`(:198)·`CreateSessionBody.mode?`(:163)·`AttemptBody`·`VocabSessionInfo.downgraded?` 가 이미 새 계약을 받는다. 주석(:190-191 「FLIP 카드는 … choices 없음」 류)만 고쳐도 된다 |
| 새로 | `src/components/vocab/cardFirst.ts` | 순수 규칙·문구 단일 출처(23-3·23-8): `hasChoices`·`answeredBy`·`isNoChoiceSet`·`methodTally`·`modeTag`·`frontHint`·`fixedHint`·`blockedNextHint`·`deckSoundView`·`DECK_SOUND_MSG`·`CARD_FIRST`(문구) |
| 새로 | `src/components/vocab/DeckListenRow.tsx` | 뜻 보기 면 카드 아래 듣기 줄(23-5) — 표시만, 상태는 `VocabDeck` 의 `useWordSound()` |
| 새로(시험) | `src/components/vocab/__tests__/cardFirst.test.ts` | 23-10 C |
| 바꿈 | `src/components/vocab/deck.ts` | `KeyContext` 에 선택 필드 `choices?: 'none' \| 'closed' \| 'open'`(기본 `'none'` = 지금 동작), `KeyIntent` 에 `{ type: 'choices' }`, `letterIs` 에 `'C'`. `pickNotice` 의 `stored` 에 `'noChoice'` 추가(최우선, `few`·`deleted` 와 같은 자리), `DeckNotice` 유니온에 `{ kind: 'noChoice' }` |
| 바꿈 | `src/components/vocab/useVocabDeck.ts` | `DeckCard.open?: boolean`(로컬, `flipped` 와 같은 규칙으로 `refresh` 때 유지 :132-133) · `toggleChoices(from: 'tap'\|'btn'\|'key')` 새 함수 · `choose` 가드(:379 `mode !== 'CHOICE'`)를 「CHOICE 세트 또는 (FLIP·보기 있음·열림)」으로 · `flip` 이 `open=false` 도 함께 · `next` 의 막힘 문구를 `blockedNextHint` 로 · `FocusTarget.kind` 에 `'choicesBtn'` · notice 읽기(:152-158)에 `'noChoice'` · `hint` 를 `{ text, tone }` 으로(`HINT.saveFailed`·`flagFailed`·`finishFailed` = `'bad'`, 나머지 `'neutral'` — 23-12 ⑩, `HINT` 문구는 그대로) |
| 바꿈 | `src/components/vocab/VocabDeck.tsx` | `onTap`(:137-141)을 23-3 C 규칙으로 · 아래 버튼 영역 고르기(:193-208)를 23-3 D 로 · `useWordSound()` + `DeckListenRow` 를 카드 무대(:164-191)와 `GestureHint`(:192) 사이에 · 부제(:149) `MODE_LABEL[mode]` → `modeTag(mode)` · 키 처리(:65-124)에 `choices` 문맥과 `'choices'` 의도 · 소리 멈춤 효과(23-5) |
| 바꿈 | `src/components/vocab/VocabCardFace.tsx` | 앞면 안내(:171-175)를 `frontHint(...)` 로, 보기 열림이면 카드 테두리 `border-accent`(지금 `border-line`, :149) · 결과 띠(:180 `resultBand(card.answer, mode)`)를 카드별 방식으로 — `resultBand(card.answer, answeredBy(card, mode) === 'choice' ? 'CHOICE' : 'FLIP')`(함수 시그니처 그대로). **안에 버튼 넣지 않음** |
| 바꿈 | `src/components/vocab/FlipControls.tsx` | 선택 prop `onChoices?: () => void`·`choicesRef?` — 있으면 앞면을 [뜻 보기](primary)·[객관식](ghost) 두 칸으로(23-3 D). 없으면 지금 그대로(full 한 칸) |
| 그대로 재사용 | `src/components/vocab/ChoiceList.tsx` | 0줄 변경으로 충분하다 [가능성 높음] — 보기 표시는 `card.choices`·`card.pending`·`card.chosen`·`markChoice`(응답 `correctText` 기준)만 본다. 카드 우선 세트의 「보기 열림」·「객관식으로 답함」에도 그대로 쓴다 |
| 바꿈 | `src/components/vocab/GestureHint.tsx` | props 를 `{ fixed: string; message: { text: string; tone: 'bad' \| 'neutral' } \| null }` 로(문구 계산은 `cardFirst.fixedHint`). 늘 마운트된 `role=status` 줄 + `role=alert` 줄 두 개(23-6) |
| 바꿈 | `src/components/vocab/DeckNotice.tsx` | `noChoice` 문구(23-8) |
| 바꿈 | `src/components/vocab/TodayWordsCard.tsx` | `MODE_OPTIONS`(:24-27)·「방식」 라벨+`Segmented`(:194-195) 삭제, props `mode`·`onMode` 삭제, `InProgressBody`(:255) `MODE_LABEL[s.mode]` → `modeTag(s.mode)` |
| 바꿈 | `src/components/vocab/TopicWordsCard.tsx` | `MODE_OPTIONS`(:20-23)·`modePicker`(:85-90, 사용처 :140·:161) 삭제, props `mode`·`onMode` 삭제 |
| 바꿈 | `src/components/vocab/TodayHome.tsx` | `MODES`(:62)·`useStoredPref(VOCAB_KEYS.mode…)`(:79) 삭제 · #47 본문(:221) `{ count, category: cat }` · 시작 후 notice(:223)·다시 풀기 notice(:289)를 23-4 D 규칙으로 · `writeTopicStart`(:352)에서 `mode` 빼기 · `wordsCardProps.mode/onMode`(:361·:376)·`TopicWordsCard` 의 `mode`/`onMode`(:416·:421) 삭제 · 마운트 때 옛 키 지우기 한 줄(23-2 하단) |
| 바꿈 | `src/components/vocab/KeptSets.tsx` | 행 제목(:72) `· {MODE_LABEL[s.mode]}` → `modeTag` 규칙(23-9 A) |
| 바꿈 | `src/components/vocab/VocabResult.tsx` | `MODES`·`prefMode`(:31·:66) 삭제, `writeTopicStart`(:150)에서 `mode` 빼기 · 부제(:156) `modeTag` · 제목 동사(:161) · 구분 한 줄(23-9 C) · 다시 풀기 notice(:107) 23-4 D |
| 바꿈 | `src/components/vocab/WordResultList.tsx` | 섞인 세트일 때만 방식 뱃지(23-9 C) — 선택 prop `methodOf?: (card) => …` 또는 `mixedMode?: VocabMode`(이름은 developer) |
| 바꿈 | `src/components/vocab/topicLogic.ts` | `TopicStartToken.mode` 를 선택(`mode?`)으로, `parseTopicStart`(:297)는 「없으면 통과, 있는데 CHOICE·FLIP 이 아니면 null」(기존 시험 :178 `mode:'X'` → null 유지) |
| 바꿈 | `src/components/vocab/topicSetStart.ts` | `TopicStartBody.mode` 를 선택으로(기존 시험이 넣어 보냄 — 그대로 통과), `done` 상태에 `noChoice?: true`(값이 있을 때만 키를 둔다 — 기존 시험 :69 `deepEqual` 유지, 23-4 D) |
| 바꿈 | `src/components/vocab/useTopicSetStart.ts` | 본문(:49) `{ topicId, count }` — **토큰의 `mode` 는 읽어도 보내지 않는다**(배포 직전 옛 화면이 남긴 60초 토큰 방어) · notice(:58) 23-4 D |
| 바꿈 | `src/components/vocab/TopicSetStart.tsx` · `topicCopy.ts` | 대기 화면 부제(:165) `WAIT.subtitle(title, MODE_LABEL[token.mode], count)` → 방식 없이 `‘제목’ · 10장`(`WAIT.subtitle` 인자에서 mode 제거) · `WORDS_CARD.modeLabel`(:39) 삭제 · `REASON.noChoice`(★ 23-8) 추가 |
| 바꿈 | `src/components/vocab/hooks.ts` | `VOCAB_KEYS.mode`(:19) 삭제 대신 주석 「task-059 로 폐기 — 마운트 때 지움」(지우는 코드가 이 키를 쓰므로 키 값은 남긴다) |
| 바꿈 | `src/components/vocab/todaySkeletonSizes.ts` · `__tests__/todaySkeleton.test.ts` · (경계가 바뀌면) `TodaySkeleton.tsx` `H_CLASS.word` | 23-7 재측정 |
| 바꿈(시험, 속성 삭제만) | `__tests__/seedButtons.test.ts:47` · `__tests__/topicLogic.test.ts:206·208` | 카드 props 에서 `mode`·`onMode` 가 없어지므로 객체에서 두 줄 삭제(단언 변경 없음 — 23-12 ⑤) |
| 서버(Dev-S) | `src/modules/learning/vocab/sessions.ts` · `src/app/api/v1/vocab/sessions/route.ts`(주석 :28) | 이력서 「서버 명세」 그대로(23-4 E) |

**옛 저장값 정리(L5)**: `TodayHome` 마운트 효과에서 `writeStore('local', VOCAB_KEYS.mode, null)` 한 번(`common/storage.ts` — try/catch 내장). 다른 곳은 이 키를 읽지도 쓰지도 않는다. `kaiwa.vocab.category`·`readingDefault` 는 그대로.

### 23-3. 카드 상태 머신 (카드 우선 세트 = `session.mode==='FLIP'`)

#### A. 판별 함수 (`cardFirst.ts`, 화면 전체가 이것만 쓴다)

| 함수 | 규칙 |
|---|---|
| `hasChoices(card)` | `Array.isArray(card.choices) && card.choices.length > 0` — `undefined`(이전 뒤집기 세트)·`null`(보기 없는 새 세트)·`[]` 모두 「없음」 |
| `answeredBy(card, mode)` | 안 답함 → `null` · `SKIPPED` → `'skip'` · `mode==='CHOICE'` → `'choice'` · `card.chosenText != null` → `'choice'` · 그 밖 → `'self'` |
| 세트 종류 | `mode==='CHOICE'` → **이전 4지선다 세트**(§5 그대로 + 듣기 줄) · `mode==='FLIP'` + 카드에 보기 있음 → **카드 우선** · `mode==='FLIP'` + 보기 없음 → **보기 없는 세트**(이전 뒤집기 세트와 화면이 같다 — 구분 불가, 23-12 ①) |

#### B. 상태 표 (카드 우선 세트, 지금 카드 = `view === frontier`)

| 상태 | 카드 면 | 아래 영역 | 카드 탭(10px 미만) | [객관식]·C | [뜻 보기]·Space·Enter | 보기·1~4 | [알았어요]/[몰랐어요]·1/2 | 왼쪽 밀기·→·[다음 카드] |
|---|---|---|---|---|---|---|---|---|
| F0 앞면·닫힘 | 앞면 + 안내 「카드를 누르면 객관식으로 골라요」 | [뜻 보기][객관식] + 도구 4칸 | → F1 (초점 이동 없음) | → F1, 초점 첫 보기 | → B0, 초점 [알았어요] | 무시 | 무시 | 막힘 「뜻 보기나 객관식으로 먼저 답해 주세요」 + 튕김(×0.25 저항) |
| F1 앞면·보기 열림 | 앞면 **테두리 accent** + 안내 「카드를 다시 누르면 객관식을 닫아요」 | 보기 4개(`ChoiceList`) + 도구 4칸 | → F0 | → F0, 초점 [객관식](C·버튼일 때만) | Space·Enter 무시(버튼이 없다) | → P | 무시 | 막힘 「먼저 답을 골라 주세요」 |
| P 확인 중 | F1 그대로 | 누른 보기 「확인 중…」, 나머지 `aria-disabled` | 드래그·탭 시작 안 됨(`locked`) | 무시 | 무시 | 무시 | 무시 | 무시 |
| Ac 객관식으로 답함 | 뜻 보기 면 + 띠 「✓ 맞았어요」/「✗ 틀렸어요」 + 뜻·예문 | **듣기 줄** + 보기 4개(✓ 정답/✗ 내 답, `locked`) + [이전][표시][다음 카드] | 무시 | 무시 | Space·Enter → 다음 | 무시 | 무시 | → 다음 카드(자동 아님, D2). 소리 멈춤 |
| B0 뜻 보기 면·답 전 | 뜻 보기 면(띠 없음) | **듣기 줄** + [알았어요][몰랐어요] + 도구 4칸 | 무시 | 무시 | 무시 | 무시 | → Ps | 막힘 「알았어요·몰랐어요를 먼저 골라 주세요」 |
| Ps 기록 중 | B0 그대로 | 누른 버튼 「기록 중…」 | `locked` | 무시 | 무시 | 무시 | 무시 | 무시 |
| As 스스로 답함 | 띠 「✓ 알았어요」/「✗ 몰랐어요」 | 듣기 줄 + 「알았어요로 기록했어요」 | — | — | — | — | — | **0.4초 뒤 자동 다음**(그 카드를 보고 있을 때만, 지금 `FLIP_AUTO_NEXT_MS`) |
| Ak 건너뜀 | 띠 「건너뛴 카드」 | 듣기 줄 + 「건너뛴 카드로 기록했어요」 + [이전][표시][다음 카드] | 무시 | 무시 | → 다음 | 무시 | 무시 | → 다음 |
| 지난 카드 | 답한 상태 그대로(읽기 전용) | Ac/As/Ak 와 같은 아래 영역(`locked`) | 무시 | 무시 | → 다음 | 무시 | 무시 | → 다음 |

모든 상태 공통: 오른쪽 밀기·←·[이전] = 이전 카드(첫 카드면 「첫 카드예요」) · 위 밀기·F·↑·[표시] = 다시 볼 카드 토글(카드 안 넘어감) · R·[읽기] = 읽기 토글(앞면·안 답한 카드의 도구 줄에만 버튼) · S·[건너뛰기] = 안 답한 지금 카드면 건너뛰기(**F1 에서도** — 보기를 닫고 Ak).

- **객관식 ↔ 뜻 보기 (데모 결정)**: F1 에서는 [뜻 보기] 버튼이 없고 Space 도 먹지 않는다 → 뜻을 보려면 먼저 닫는다(카드 탭·C). **B0(뜻을 본 뒤)에서는 객관식을 열 수 없다**(탭·C 무시) — 뜻을 본 카드를 객관식으로 「맞히는」 일이 없게. 보기를 열어도 고르기 전에는 아무것도 기록하지 않는다.
- 보기 없는 세트: F0 앞면 안내 「탭하면 뜻이 보여요」, 아래 [뜻 보기] 한 칸(full), 탭 → B0, C 무시 — 지금 뒤집기 카드와 같다. 막힘 문구는 「알았어요·몰랐어요를 먼저 골라 주세요」(23-12 ⑦).
- `open` 은 카드별 로컬 상태다(서버에 없음). 이전 카드로 갔다 돌아와도 유지, `visibilitychange` 의 #49 다시 읽기(`refresh`)에서도 `flipped` 와 같이 유지, 새로고침(새 마운트)에서는 닫힘. 답이 오면 `open=false`(보기는 `answeredBy==='choice'` 라서 계속 보인다).

#### C. `VocabDeck.onTap` (지금 :137-141 을 바꾼다)

```
onTap():
  if side === 'back' → return                                  // 뜻 보기 면·답한 카드: 그대로(D1)
  if !isCurrent || answered || card.pending → return
  if mode === 'CHOICE' → deck.toggleReading()                  // 이전 4지선다 세트: 지금 동작
  else if hasChoices(card) → deck.toggleChoices('tap')         // 카드 우선: 열기/닫기, 초점 이동 없음
  else if peekable → deck.flip()                               // 보기 없는 세트·이전 뒤집기 세트: 지금 동작
  else → deck.toggleReading()                                  // 뜻 없는 FLIP(대체 흐름): 지금 동작
```

#### D. 아래 버튼 영역 고르기 (지금 :193-208 `mode === 'CHOICE' ? ChoiceList : FlipControls` 를 바꾼다)

```
if mode === 'CHOICE'                                   → ChoiceList(지금 그대로)
else if answered && answeredBy(card) === 'choice'     → ChoiceList(locked)          // Ac·지난 카드
else if answered                                       → FlipControls(기록 한 줄)     // As·Ak
else if card.open                                      → ChoiceList(locked = locked || !isCurrent, firstRef)
else                                                   → FlipControls(side, peekable,
                                                           onChoices = hasChoices(card) ? () => deck.toggleChoices('btn') : undefined,
                                                           choicesRef)
```
- `FlipControls` 앞면 두 칸(데모 `brow0`): `flex gap-2 [&>*]:min-w-0 [&>*]:flex-1`, [뜻 보기] = 지금 `PRIMARY`(h-[52px]) + 정밀 포인터면 `<kbd>Space</kbd>`, [객관식] = 지금 `GHOST`(h-[52px], border line, surface) + 정밀 포인터면 `<kbd>C</kbd>`, `aria-expanded="false"`(데모 그대로 — 열리면 이 버튼 대신 보기가 그려진다). `firstRef` = [뜻 보기], `choicesRef` = [객관식].
- 덱 도구 줄은 **그대로**(D7): 안 답한 카드 [이전][읽기][표시][건너뛰기], 답한 카드 [이전][표시][다음 카드 ›](마지막이면 [결과 보기 ›]).

#### E. 탭·스와이프 불변을 지키는 구체 규칙 (`touchend preventDefault` 함정)

1. **카드 면(`SwipeCardStack` 안, `renderTop`)에는 어떤 버튼도 넣지 않는다.** 터치 기기에서 `onTouchEnd` 가 `preventDefault()` 를 하므로(:163) 영역 안 버튼의 `click` 이 생기지 않는다 — [객관식]·▶ 를 카드 안에 두면 휴대폰에서 눌리지 않는다(D3 B 를 버린 이유).
2. **`preventDefault` 를 지우거나 옮기지 않는다.** 카드 탭으로 보기가 열리면 카드 아래가 바뀐다(카드가 작아지고 그 자리에 보기·듣기 줄). `preventDefault` 가 없으면 호환 `mouse*`·`click` 이 새로 생긴 요소(보기 1번 등)에 떨어져 **누르지 않은 답이 기록될 수 있다** — 뒤집기 직후 [알았어요] 유령 클릭(§5-2 C 6)과 같은 함정.
3. **이벤트 순서(지금 코드 — 바꾸지 않음)**: 터치 = `touchstart`(passive, `dragStart`) → `touchmove`(passive) → `touchend`(`preventDefault` → 호환 마우스·`click` 없음, `dragEnd` → `classifyGesture` → `onTap`/`onUp`/`onLeft`/`onRight`). 마우스 = `mousedown`(`preventDefault` — 초점·글자 선택 없음) → `mousemove` → `mouseup`(`dragEnd`) → `click`(카드에 떨어짐, 처리기 없음 — 해 없음). **데모의 `pointerdown/move/up` 은 데모 안 흉내일 뿐** — 앱을 `pointer` 이벤트로 바꾸지 않는다.
4. 응답 대기(`card.pending`)·넘기는 중(`exiting`)·끝내는 중에는 `locked` 라 드래그가 시작되지 않는다(:41·`SwipeCardStack` :79) — 확인 중에 탭해 보기를 닫는 일이 없다.
5. 보기가 열린 상태에서도 스와이프 의미는 같다: 왼쪽 = 막힘(안 답함), 오른쪽 = 이전, 위 = 표시. **보기를 열었다고 다음 카드로 갈 수 있게 되지 않는다**(답한 뒤에만 — 규칙 그대로).

#### F. 흐름 요약 (§5-2 D 를 카드 우선 세트에 대해 대체)

```
카드 우선:  F0 ─탭/[객관식]/C─▶ F1 ─보기/1~4─▶ P ─#50(chosenText)─▶ Ac(머묾) ─[다음]/← 밀기/→/Enter─▶ 다음 카드
             │                  └─탭/C─▶ F0                 └─실패 0·5xx → F1 + 힌트(빨강) · 400·409 → #49 다시 읽기
             └─[뜻 보기]/Space─▶ B0 ─[알았어요]/[몰랐어요]/1·2─▶ Ps ─#50(selfResult)─▶ As 0.4초 ─▶ 자동 다음 카드
건너뛰기:   F0·F1·B0 ─[건너뛰기]/S─▶ #50 {skipped:true} ─▶ Ak + [다음 카드]
이전 세트:  §5-2 D 그대로(+ 뜻 보기 면 듣기 줄)
```
조작 수(12초/장, §5-0 6 대체): 객관식 = 탭 1 + 보기 1 + [다음] 1 · 스스로 = [뜻 보기] 1 + [알았어요] 1(자동 다음). `responseMs` 규칙(§5-2 D)은 두 경로 모두 그대로.

### 23-4. 서버 계약 연결 (api-contract §2-10 #47·#49·#50·#53 인용 — 다시 정의하지 않는다)

#### A. 요청·응답

| # | 화면이 보내는 것 | 화면이 쓰는 응답 | 오류 처리 |
|---|---|---|---|
| 47 | 내 단어장 `{count, category}` · 주제 `{topicId, count, generate?}` — **`mode` 를 보내지 않는다**(기본 FLIP = 카드 우선) | `session.{id, mode, downgraded}` · `cards[].choices`(보기 없는 세트 판정 23-4 D) · `empty` · `generation` | 지금 그대로(§5-4) |
| 49 | — | `session.mode` · `cards[].{order, surface, reading, choices, meaning, example, exampleKo, flagged, answered, answer, correctText, chosenText}` | 404 → notFound(그대로) |
| 50 객관식 | `{order, chosenText, responseMs, flagged}` — 이전 4지선다 세트 **또는** 카드 우선 세트의 보기 열린 카드에서만 | `answer`·`correctText`·`chosenText`·`example`·`exampleKo`·`answeredAt` | 0·5xx → 보기 원상태 + 힌트 「저장하지 못했어요. 다시 눌러 주세요」 · 400(`not_in_choices`·`mode`·`exclusive`·형식) → #49 다시 읽기(지금 :360) · 409 → #49 다시 읽기 + 「이미 끝난 세트예요…」 |
| 50 스스로 | `{order, selfResult, responseMs}` — FLIP 세트의 뜻 보기 면(B0)에서만 | 같음 | 같음 |
| 50 건너뛰기·표시 | 그대로(`{order, skipped:true}` · `{order, flagged}`) | 그대로 | 그대로 |
| 51·52 | 그대로 | 그대로 | 그대로 |
| 53 | — | `session`·`cards`(보기 없는 세트 판정) | 409 그대로 |

#### B. `chosenText` 와 `selfResult` 고르기 (한 카드에 하나만 — 화면이 보장)

- 보기(`ChoiceList`)로 고른 답 → `chosenText`. [알았어요]·[몰랐어요]·1/2 → `selfResult`. 둘을 **한 본문에 같이 넣는 길은 없다**: B0 에서는 보기를 열 수 없고, 답이 오면 그 카드는 답한 카드라 다시 보낼 수 없다(`answerGuard`). 같은 `order` 재전송은 서버가 첫 결과를 돌려준다(멱등 — 지금 그대로).
- 화면은 정답을 계산하지 않는다(L1): FLIP 세트는 `meaning` 을 처음부터 갖고 있지만 **보기 표시(✓/✗)는 #50 응답 `correctText` 로만**(`markChoice` 지금 그대로). `card.meaning === choice` 비교로 미리 칠하거나 낙관적으로 채점하지 않는다 — reviewer 감사 항목.

#### C. 새로고침·이어 풀기 복원 (#49)

| 카드(#49) | 그리는 상태 |
|---|---|
| `answered` + `answer=SKIPPED` | Ak |
| `answered` + `chosenText != null` | **Ac**(보기 4개에 ✓ 정답/✗ 내 답, 띠 「맞았어요/틀렸어요」) — `choices` 가 같이 와야 한다(계약 #49 「FLIP 카드도 choices」) |
| `answered` + `chosenText == null` | As(띠 「알았어요/몰랐어요」, 「…로 기록했어요」) |
| 안 답함 | F0(로컬 `open`·`flipped` 는 새 마운트에서 사라진다 — 뒤집어 본 카드도 새로고침 뒤엔 앞면, 지금 FLIP 과 같음) |

`DONE` 세트(결과 화면)도 같은 `chosenText` 유무로 방식을 센다(23-9 C).

#### D. `choices:null` 세트(보기를 못 만든 경우)와 알림

- 판정 `isNoChoiceSet({session, cards})` = `session.mode==='FLIP' && cards.length > 0 && cards.every((c) => !hasChoices(c))`.
- **세트를 만든 화면이 알림 값을 남긴다**(지금 `kaiwa.vocab.notice.{id}` 방식 그대로): `TodayHome.start`(:223)·`TodayHome.replay`(:289)·`VocabResult.replay`(:107) = `isNoChoiceSet(r) ? 'noChoice' : r.session.downgraded ? (다시 풀기면 'deleted', 시작이면 'few') : ''`. 주제 세트는 `topicSetStart.ts` 가 `done` 상태에 `noChoice: true` 를 **참일 때만** 싣고 `useTopicSetStart`(:58)가 같은 규칙으로 남긴다.
- 덱은 `pickNotice` 가 `'noChoice'` 를 `few`·`deleted` 와 같은 최우선으로 고른다. 이전 뒤집기 세트를 나중에 열 때는 남긴 값이 없으므로 알림이 뜨지 않는다(구분 불가 문제를 이 경로로 피한다).
- 화면: [객관식] 없음 · 탭 = 뜻 보기 · 앞면 안내 「탭하면 뜻이 보여요」 · 알림 문구(23-8 ⑤). 결과는 스스로 표시만이라 「알았어요」.
- 카드 우선 세트의 `downgraded` 는 늘 `false` 다(서버 `toSessionDto` :173 이 「요청 CHOICE → 결과 FLIP」만 강등으로 센다, 계약 #47 「downgraded 는 쓰지 않는다」). `few`·`deleted` 문구는 이전 세트에서만 보인다.

#### E. 서버(Dev-S) 연결점 — 이력서 「서버 명세」 그대로, 화면이 기대는 것만

`insertSession`(:352 — FLIP 에도 `pickChoices`, 하나라도 못 만들면 그 세트 전부 `null`, FLIP 은 강등 없음) · `toCardDto`(:213-231 — FLIP 카드에도 `choices`, CHOICE 미답 카드의 정답 미노출은 그대로) · `recordAttempt`(:702 — `choice` 시도를 FLIP 에 허용, :703 `flip` 시도의 CHOICE 거절 유지, :704 `not_in_choices` 는 FLIP 에도) · `parseCreateSessionBody`(:278 기본 `'CHOICE'` → `'FLIP'`) · `replayVocabSession`(:869~ — 새 세트 `FLIP`+보기, 주제 세트 경로 :888-901 포함) · 라우트 주석(`sessions/route.ts:28` 「정답 미포함(CHOICE)」). 계약과 코드가 어긋난 곳 2개는 23-12 ②③.

### 23-5. 재생 버튼 (D3) — `DeckListenRow`

#### A. 자리·모양 (데모 `.lrow`·`.lb` → Tailwind)

```
VocabDeck:  …카드 무대(:164-191)… → {side==='back' && (wordText || exText) ? <DeckListenRow …/> : null} → GestureHint → 아래 버튼 영역 → 도구 줄
DeckListenRow:
<div className="flex-none px-4 pb-1">                                   ← 무대와 같은 px-4 → 안쪽 w-[80%] = 카드 폭과 같다
  <div className={`mx-auto -mt-1 grid w-[80%] max-w-[340px] gap-2 ${two ? 'grid-cols-2' : 'grid-cols-1'}`}>   ← 무대 py-3 − 4px = 카드와 8px
    <button type="button" className="flex h-11 min-w-0 items-center justify-center gap-2 rounded-xl border px-2.5 text-[14px] font-semibold {look}">
      <span aria-hidden className="grid h-6 w-6 flex-none place-items-center rounded-full {iconBg}">{▶ 12px | ■ 11px | 돌기 14px}</span>
      <span className="min-w-0 truncate">{글자}</span>
    </button> × (단어, 예문)
  </div>
  <p role="status" className="sr-only">{재생 중 알림}</p>
</div>
```

| 모양(`deckSoundView`) | 조건 | 클래스 | 글자 | 접근 이름 |
|---|---|---|---|---|
| idle | 기본 | `border-line bg-surface text-ink` · 아이콘 바탕 `bg-surface2` · ▶ | 단어 듣기 / 예문 듣기 | 보이는 글자(따로 `aria-label` 없음) |
| loading | 받는 중 | idle 모양 + 돌기(`motion-safe:animate-spin`, 줄임 설정이면 멈춘 반투명) + `aria-busy` | 불러오는 중 | 「{단어\|예문} 불러오는 중, 누르면 취소」 |
| on | 재생 중 | `border-ink bg-ink text-surface` · 아이콘 바탕 `bg-surface text-ink` · ■ | 멈추기 | 「{단어\|예문} 소리 멈추기」 |
| mute | 그 버튼의 안내가 자막만(422) | `border-transparent bg-surface2 text-ink2` | 단어 듣기 / 예문 듣기 | 보이는 글자 |
| blocked | 브라우저가 막음 | idle + `ring-2 ring-accent` | 단어 듣기 / 예문 듣기 | 보이는 글자 |
| fail | 그 버튼의 안내가 fail·slow·offline | `border-bad text-bad` (바탕 surface) | 단어 듣기 / 예문 듣기 | 보이는 글자 |

- 접근 이름은 L6 결정대로 **덱 버튼만** 보이는 글자를 포함한다(상세 시트 `soundButtonView` 의 「단어 소리 듣기」는 그대로 — 고치지 않음).

#### B. 읽을 글·숨김

| 버튼 | 보내는 글(#23 `{ text }`) | 숨김 |
|---|---|---|
| 단어 듣기 | `soundText(card.surface)` | `null` 이면(빈 값·100자 초과) 버튼 없음 |
| 예문 듣기 | `soundText(card.example)` | 예문 없음 또는 100자(코드포인트) 초과 → 버튼 없음 → 줄이 한 칸(`grid-cols-1`)이 된다 |

- `card.example` 은 **평문 일본어**다 — 히라가나 루비·`[한글]` 은 카드에서 `JaText`·`useAnnotations` 가 그리는 표시 층일 뿐이라 **지울 루비가 없다** [확실 — `VocabCardFace.tsx:205` `JaText text={card.example}`]. 공백 접기·제어문자 제거는 `soundText` 가 한다.
- **표시 설정(히라가나·한글)은 카드 글자에만** 영향을 준다. 소리는 설정과 무관하게 같은 문장을 읽는다(데모 C 메모). 빠르기·목소리는 사용자 설정(#23 에 `speechProfile`·`voiceId` 를 보내지 않음 — `useWordSound` 그대로).
- 두 버튼이 다 없으면 줄을 그리지 않는다. 듣기 줄은 **뜻 보기 면(`side==='back'`)일 때만** — B0·Ac·As(0.4초)·Ak·지난 카드, 이전 4지선다·뒤집기 세트의 뒷면 포함(D6 A).

#### C. 상태·동작

- `VocabDeck` 에 `const sound = useWordSound()` 하나. 버튼 `onClick` 안에서 **동기로** `sound.tap(target, text)`(오디오 깨우기 — `useWordSound` 규칙). 소리는 한 번에 하나(다른 버튼 → 앞 소리 멈춤), 같은 버튼을 받는 중·재생 중에 다시 누르면 취소·멈춤(이때 덱 live 영역에 「소리를 멈췄어요」).
- **멈춤**: `view` 가 바뀔 때(다음·이전·자동 다음), `exiting` 이 켜질 때, `phase` 가 `playing` 이 아니게 될 때 `sound.stop()`. 화면 가림·떠남은 훅이 이미 멈춘다(:160-169).
- 재생 중에도 스와이프·탭은 그대로 된다(버튼이 카드 밖) — 왼쪽 밀기로 다음 카드에 가면 소리가 멈춘다. 재생 중 보기·알았어요 누름도 막지 않는다.
- **실패 안내는 힌트 줄 한 줄**(덱은 토스트·버튼 아래 줄을 쓰지 않는다 — 높이 예산). 우선순위: 덱 막힘 힌트(2초) > 소리 안내(뜻 보기 면일 때, 다음 탭·멈춤까지 유지) > 고정 힌트. 문구 6종은 23-8 ⑧. [다시 듣기] 링크는 없다 — 같은 버튼을 다시 누르면 다시 불러온다.
- 재생 중 알림: 듣기 줄의 sr `role=status` 에 「{단어|예문} 소리 재생 중」(`soundLine(state, target)` 의 live 글과 같다).
- TTS 상태 표시등: 없음(강사 아바타가 없는 화면 — §5-1 그대로).

### 23-6. 접근성 (D4)

#### A. 키 (`deck.ts keyAction` — `KeyContext.choices` 선택 필드, 기본 `'none'` 이면 지금과 똑같다)

| 키 | 이전 4지선다 세트 | 이전 뒤집기·보기 없는 세트 | 카드 우선 세트 |
|---|---|---|---|
| `1`~`4` | 보기 고르기 | 뒷면 1 알았어요·2 몰랐어요 | `choices:'open'` → 그 보기 · 뜻 보기 면 → 1·2 스스로 · 앞면 닫힘 → 무시 |
| `Space`·`Enter` | 답한 카드 → 다음 | 앞면 → 뜻 보기 / 답함 → 다음 | 앞면 닫힘 → 뜻 보기 · 열림 → 무시 · 답함 → 다음 |
| **`C`** (새) | 무시 | 무시 | 지금 카드·안 답함·앞면 → `{type:'choices'}`(열기/닫기). `code==='KeyC'` 우선(한글 자판 ㅊ 자리) |
| `→` / `←` | 다음 / 이전 | 같음 | 같음 |
| `F`·`↑` / `R` / `S` | 표시 / 읽기 / 건너뛰기 | 같음 | 같음(S 는 보기 열림에서도) |

무시 조건(입력창·시트·조합·수정키·반복)은 그대로. 「초점이 버튼·링크면 Space/Enter 는 그 요소에 맡김」도 그대로이고, **C·숫자는 버튼 초점과 무관하게 먹는다**(데모와 같음 — 지금 숫자 규칙과 같다).

#### B. 초점 이동

| 동작 | 초점 |
|---|---|
| [객관식]·C 로 열기 | 첫 보기(`ChoiceList firstRef`) |
| C 로 닫기 | [객관식](`choicesRef`, 새 `FocusTarget.kind: 'choicesBtn'`) |
| 카드 탭으로 열기·닫기 | 옮기지 않음 |
| [뜻 보기]·Space | [알았어요](지금 그대로) |
| 객관식 답 응답 | [다음 카드](지금 그대로) |
| 새 카드 | 첫 버튼 — 앞면이면 [뜻 보기](보기 없는 세트도), 이전 4지선다 세트면 첫 보기(지금 그대로) |

모두 `focus({ preventScroll: true })`, 포커스 링은 `focus-visible` 에서만(지금 그대로).

#### C. 화면 읽기 알림 (덱 `aria-live=polite` 한 곳 — 지금 `deck.announce`)

| 때 | 문구 |
|---|---|
| 보기 열림 | 객관식 보기 4개가 나왔어요 |
| 보기 닫힘 | 객관식을 닫았어요 |
| 뜻 보기 | 뜻이 보여요 |
| 객관식 답 | 맞았어요. 정답 {뜻} / 틀렸어요. 정답 {뜻} — **지금 코드 문구 그대로**(:338. 데모 「틀렸어요. 정답은 …」 이 아니라 현행) |
| 스스로 답 | 알았어요로 기록했어요 / 몰랐어요로 기록했어요(그대로) |
| 소리 멈춤(사용자가 누름) | 소리를 멈췄어요 |

- `GestureHint` 는 늘 마운트된 줄 두 개를 둔다: `role=status`(중립 안내·막힘 힌트)와 `role=alert`(빨강 — 소리 fail·slow·offline, 답 저장 실패). **역할을 바꿔 가며 같은 요소를 다시 그리거나 새로 마운트하지 않는다**(새로 생긴 라이브 영역은 읽히지 않을 수 있다 — §22-15 5 와 같은 이유). 보이는 글은 한 줄(`truncate`, 12px, 빨강은 `text-bad font-semibold`, 중립은 `text-ink font-medium`), 고정 힌트는 `aria-hidden`(지금 그대로).
- 카드 그룹(`role=group aria-roledescription="카드"`)은 그대로. 듣기 버튼·[객관식]은 모두 실제 `<button>`, 터치 44px 이상(듣기 44, 앞면 두 칸 52).
- **미확인 — 실기기(TalkBack)**: 카드 영역 이중 탭이 `touch*`/`mouse*` 를 만드는지(만들면 보기 열림, 아니면 무반응). 무반응이어도 [객관식] 버튼이 같은 일을 한다. TalkBack 사용자가 연 보기를 닫는 길은 카드 탭뿐이라(버튼이 보기로 바뀜) 고르거나 [건너뛰기]로 진행해야 한다 — 데모 자체 점검 Minor ①, 이번엔 그대로(필요하면 v2).

### 23-7. 자리표시·높이

#### A. 오늘 홈 단어 카드 — 다시 재야 하는 상수

| 무엇 | 지금 | 할 일 |
|---|---|---|
| `TODAY_CARD_H.word` (`todaySkeletonSizes.ts:18`) | `{ narrow: 305, wide: 285.5, narrowBelow: 370 }` — 「장수·**방식**·[시작하기]」 실측 | 방식 줄(라벨 12.5px 줄 + `mb-1.5 mt-3` + `Segmented sm`)이 빠져 **약 −75px** — 예상 ≈230/≈211 **[추측 — 데모 차이 −74.7px 와 클래스 합산]**. 예상값을 상수로 쓰지 말고 **실측값만** 쓴다 |
| 같은 파일 주석(:13) | 「장수·방식·[시작하기]」 | 「장수·[시작하기]」 |
| `todaySkeleton.test.ts` | :20-21 값 단언 · :35-36 `cardHeightVars('word')`·몸통값(카드 − 60.5) · :57-58 `--h-n:305px`·`--h-w:285.5px` | 새 실측값으로(몸통 = 카드 − `TODAY_CARD_CHROME_H` 60.5 — 계산식은 그대로) |
| `TodaySkeleton.tsx:18` `H_CLASS.word` | `min-[370px]` | 재측정에서 줄바꿈 경계가 바뀌었을 때만 같이 바꾼다(시험 :28 이 상수와 리터럴을 묶는다). D8 A(설명 문구 그대로)라 370 유지 가능성이 높다 [가능성 높음] |
| `lesson`·`eval` 상수 | — | 바꾸지 않는다 |

**재는 방법(task-046 규칙 §17-1 3 ② 그대로)**: 이 브랜치의 개발 서버 + `tests/live/p3-qa-ui/flicker/t3-heights.mjs`(`ONLY=today`). 상태 = 「단어가 있는 흔한 상태」 — QA 계정에 기본 단어 50개(분류 1개 → 분류 칩 줄 없음), **진행 중 챌린지 없음**(→ `TodayWordsCard`, `TopicWordsCard` 아님), **오늘 끝낸 세트 없음**(「오늘 n세트를 끝냈어요」 줄 없음), 진행 중 세트 없음(준비 상태). 360/390/412 에서 단어 카드 `section` 의 `getBoundingClientRect().height` 를 읽고, 폭 360→416 을 4px 씩 훑어 줄바꿈이 바뀌는 지점(`narrowBelow`)을 다시 찾는다. 합격선: 공개 순간 첫 화면 블록 점프 ≤ 8px(§17-1 3 ⑥).
- 같은 상수를 쓰는 곳: `CardLoadingBody kind="word"` — 지금 카드(`TodayWordsCard`)와 챌린지 단어 카드(`TopicWordsCard`, 실제 높이는 원래 실측 안 함 — 정책 그대로).
- 알려진 변화: 단어 0개 계정은 이제 빈 상태(≈240+)가 자리표시보다 **커져** 아래가 조금 밀린다(§17-3 첫 줄의 반대 방향, 첫 사용자 한정) — QA 가 값만 기록.

#### B. 덱 높이 (일반 조합은 스크롤 0, 좁은 폭의 겹치는 조합은 `main` 스크롤 — QA β1 결함 #1 반영)

- 덱 레이아웃·상한(카드 `max-h-[340px] min-h-[200px]`, 덱 `min-h-[600px]`)은 그대로. 듣기 줄(44 + 위 −4 + 아래 4)이 **뜻 보기 면에서만** 생긴다.
- 데모 실측(폭 360/390/412 × 높이 740/800/780): 앞면·뜻 보기 면 340/340/340(상한), 보기 열림 282/340/322(지금 4지선다와 같음), **객관식으로 답한 뒤 242/302/282**(지금 4지선다 답한 뒤 대비 −40). 카드가 작아지는 순간에 전환 애니메이션은 넣지 않는다(데모와 같음, 실기기에서 판단 — 데모 자체 점검 P2 ①).
- **실측 결과(QA β1, 2026-10-12) — 위험이 사실로 확인됨**: 주제 세트(출처·챌린지 줄 `TopicDeckLines`) + 닫지 않은 알림(`DeckNotice`) + 객관식으로 답한 뒤 + 360×740 에서 무대 안쪽(약 155.8px)이 카드 하한 200 보다 작아 카드가 `items-center` 로 위·아래 각 10.1px 넘쳐 알림 아래와 [단어 듣기] 위쪽 23% 를 덮었다(결함 #1, Medium). 390×800·412×780 은 겹침 없음.
- **수정(Dev-D2, 감사 REV-187 PASS)**: `VocabDeck` 카드 무대 `min-h-0` → `min-h-[224px]`(카드 하한 200 + 위아래 패딩 24). 겹침은 사라지고 **그 조합에서만** `main` 이 약 44.2px 스크롤되며 [다음 카드] 가 위쪽 약 20px 만 보인다(`preventScroll:true` 라 초점이 가도 올라오지 않음). 다음으로 가는 길: 카드 왼쪽 밀기(힌트 줄에 항상 표시)·알림 [✕] 닫기(닫으면 스크롤 0)·키보드(Enter/Space/→)·화면 읽기. 바뀌는 조합은 무대 바깥 높이가 224 미만이던 4곳뿐이고 나머지 40+ 측정은 불변.
- **후속(백로그, Low — 조건부 Medium)**: 답한 뒤 [다음 카드] 로 `scrollIntoView({block:'nearest'})` 하거나 정보성 알림을 첫 답 뒤 자동으로 닫는 개선은 `VocabDeck` 의 「스크롤은 건드리지 않는다」 규칙을 바꾸므로 designer/Leader 결정. 챌린지 줄이 붙는 챌린지 주제 세트는 약 +21~65px 로 도구 줄이 가려질 수 있어 QA γ 가 실측(미측정이던 조합).

### 23-8. 문구 단일 출처 (데모 원문 — 한 글자도 바꾸지 않는다. ★ = 데모에 없던 것)

새 문구는 `src/components/vocab/cardFirst.ts` 의 `CARD_FIRST`·`DECK_SOUND_MSG` 한 곳(주제 세트 문구만 `topicCopy.ts`).

| # | 자리 | 문구 | 상수(제안) |
|---|---|---|---|
| ① | 앞면 안내(보기 닫힘) | 카드를 누르면 객관식으로 골라요 | `CARD_FIRST.frontHint` |
| ② | 앞면 안내(보기 열림) | 카드를 다시 누르면 객관식을 닫아요 | `CARD_FIRST.frontHintOpen` |
| ③ | 앞면 버튼 | 객관식 (정밀 포인터 키 표시 `C`) | `CARD_FIRST.choicesBtn` |
| ④ | 막힘(앞면 닫힘에서 다음) | 뜻 보기나 객관식으로 먼저 답해 주세요 | `CARD_FIRST.answerFirst` |
| ⑤ | 알림(보기 없는 세트) | 뜻이 서로 다른 단어가 4개보다 적어서 이번엔 객관식 없이 풀어요. | `DeckNotice` 의 `noChoice`(지금 문구들과 같은 파일 안 자리) |
| ⑤★ | 알림(보기 없는 주제 세트) | 뜻이 서로 다른 표현이 4개보다 적어서 이번엔 객관식 없이 풀어요. | `topicCopy.REASON.noChoice`(지금 `REASON.few` 의 짝) |
| ⑥ | 듣기 버튼 | 단어 듣기 / 예문 듣기 / 불러오는 중 / 멈추기 | `CARD_FIRST.listen` |
| ⑦ | 듣기 접근 이름 | {단어\|예문} 불러오는 중, 누르면 취소 / {단어\|예문} 소리 멈추기 | 같은 곳 |
| ⑧ | 소리 안내(힌트 줄) | fail 「목소리를 불러오지 못했어요 · 다시 눌러 주세요」(빨강·alert) · slow 「목소리 응답이 늦어요 · 잠시 후 다시 눌러 주세요」(빨강·alert) · offline 「연결하지 못했어요 · 네트워크를 확인해 주세요」(빨강·alert) · textonly 「지금은 선생님 목소리를 들을 수 없어요(자막만)」(중립·status) · rate 「너무 자주 눌렀어요 · 잠시 후 다시 들어 주세요」(중립) · blocked 「소리를 켜려면 ▶ 를 한 번 더 눌러 주세요」(중립) | `DECK_SOUND_MSG` (키는 `wordSound.SoundMsgKind` 그대로) |
| ⑨ | 화면 읽기 | 객관식 보기 4개가 나왔어요 / 객관식을 닫았어요 / 뜻이 보여요 / 소리를 멈췄어요 / {단어\|예문} 소리 재생 중 | `CARD_FIRST.sr` |
| ⑩ | 키 힌트(정밀 포인터, 카드 우선 세트) | 앞면(보기 있음) 「Space 뜻 보기 · C 객관식 · → 다음 · F 표시」 · 앞면(보기 없음) 「Space 뜻 보기 · → 다음 · F 표시」 · 보기 열림 「1~4 고르기 · C 닫기 · → 다음 · F 표시」 · 뜻 보기 면 「1 알았어요 · 2 몰랐어요 · → 다음 · F 표시」 · 답한 카드·지난 카드 「Enter 다음 카드 · ← 이전 · F 표시」 | `fixedHint()` |
| ⑪ | 키 힌트(이전 세트)·터치 힌트 | 지금 문구 그대로(4지선다 「1~4 고르기 · → 다음 · ← 이전 · F 표시」, 뒤집기 「Space 뒤집기 · 1 알았어요 · 2 몰랐어요 · → 다음」, 터치 「← 밀어 다음 · → 밀어 이전 · ↑ 밀어 표시」) | `fixedHint()` |
| ⑫ | 결과 구분 한 줄 | 객관식 {n}장 중 {c}장 맞힘 · 스스로 {m}장 중 {k}장 알았어요 | `CARD_FIRST.splitLine(n,c,m,k)` |
| ⑬ | 결과 방식 뱃지(섞인 세트) | 객관식 맞힘 / 객관식 틀림 / 스스로 알았어요 / 스스로 몰랐어요 / 건너뜀 | `CARD_FIRST.methodBadge` |

지워지는 문구: 오늘 카드·[내 단어장으로 풀기]·챌린지 단어 카드의 라벨 「방식」(`TodayWordsCard` 리터럴·`WORDS_CARD.modeLabel`), 분절 「4지선다 / 뒤집기 카드」와 aria 「푸는 방식」(두 `MODE_OPTIONS`), 새 세트 부제·풀던 세트 줄·보관 세트 줄·결과 부제·대기 화면 부제의 「{방식} · 」. `MODE_LABEL`(`labels.ts:144`)은 **남긴다** — 이전 4지선다 세트 표시와 기존 시험이 쓴다. 바뀌지 않는 문구: 「뜻 보기」·「알았어요」·「몰랐어요」·「기록 중…」·보기 「✓ 정답 / ✗ 내 답 / 확인 중…」·결과 띠 5종·도구 줄·「저장하지 못했어요. 다시 눌러 주세요」·설명 문구(D8 A).

`modeTag(mode)` = `mode==='CHOICE' ? '4지선다 · ' : ''` — 덱 부제 `{주제 · }{modeTag}{N}장`, 결과 부제 `{날짜} · {modeTag}{N}장{ · 주제}`, 풀던 세트 줄 `{날짜} 시작 · {modeTag}{N}장 중 {k}장 답함`, 보관 세트 줄 `{날짜} · {N}장{ · 4지선다}`(뒤에 붙는 자리라 형태만 다름 — 이전 4지선다 세트만). 데모 G 의 「· 뒤집기 카드」(이전 뒤집기 세트)는 구분할 수 없어 그리지 않는다(23-12 ①).

### 23-9. 이전 세트 호환(D6) · 결과(D5) · 주제/챌린지 세트(데모 H)

#### A. 이전 세트 — 「시작한 방식 화면 그대로 + 듣기 버튼」

| 세트 | 덱 | 오늘 홈·보관 줄 | 결과 |
|---|---|---|---|
| 이전 4지선다(`CHOICE`, 진행 중) | §5 그대로: 보기 4개 처음부터, 탭 = 읽기, 1~4. **추가: 답한 뒤 뜻 보기 면에 듣기 줄**(카드 −44px, 객관식 답한 카드와 같은 높이) | 「오늘 시작 · 4지선다 · 10장 중 3장 답함」 / 「10월 10일 · 10장 · 4지선다」 | 부제 「… · 4지선다 · N장」, 제목 「맞혔어요」 |
| 이전 뒤집기(`FLIP`, 보기 없음) | §5 그대로(탭 = 뜻 보기, [뜻 보기] 한 칸, 「탭하면 뜻이 보여요」). **추가: 뒷면 듣기 줄** | 방식 이름 없음(23-12 ①) | 방식 이름 없음, 제목 「알았어요」 |
| 보관 세트 [다시 풀기](#53) | 서버가 늘 카드 우선(FLIP+보기)으로 만든다 → 카드 우선 화면 | — | — |
| 이어 풀기 | 서버 상태(#49)로 위 규칙 — 화면 쪽 이주·자동 종료 없음(D6 C 아님) | — | — |

- 이전 세트를 재현하는 법(QA): 이전 4지선다 세트는 지금도 `mode:'CHOICE'` 를 명시하면 만들어진다(계약 #47). **이전 뒤집기 세트(보기 없는 FLIP)는 새 서버로는 만들 수 없다**(`mode:'FLIP'` 명시도 이제 카드 우선) — 배포 전 빌드에서 QA 계정에 만들어 두거나, 보기 없는 세트(뜻이 서로 다른 단어 <4)로 화면을 대신 확인한다(화면이 같다).

#### B. 오늘 홈·주제/챌린지 진입 (데모 A·H)

- `TodayWordsCard` 준비: 설명 → (오늘 끝냄 줄) → 「장수」 + 분절 → (분류) → [시작하기] → (오류 줄). 방식 줄만 빠지고 간격(`mt-3`)·문구는 그대로.
- `TopicWordsCard`: 할 일(`todo`)·조금 남음(`short`)의 `modePicker` 삭제 — [시작하기]/[한 세트 더] 위 간격은 버튼의 `mt-3` 그대로. [내 단어장으로 풀기] 펼침(`MineSetPanel` = `TodayWordsCard embedded`)도 같은 변경이 자동 적용.
- 챌린지 띠(`ChallengeStrip`)는 변경 없음(원래 방식 줄 없음).
- 대기 화면(`/study/today/words/new`) 부제 「‘카페에서 주문하기’ · 10장」(방식 없음), 본문·단계·문구 그대로.
- 주제·챌린지 세트의 덱·결과는 B~F 와 똑같다(같은 덱). 덱 부제 「‘주제’ · 10장」. 챌린지 규칙(목표 장수·완료 조건·합계)은 바꾸지 않는다 — 객관식·스스로 답 모두 「답한 카드」로 센다(서버 합산 그대로).
- 결과 [한 세트 더](`VocabResult.oneMore`) 토큰에 `mode` 없음.

#### C. 결과 화면 (D5)

| 요소 | 규칙 |
|---|---|
| 제목 동사 | `session.mode==='CHOICE'` 또는 `answeredBy==='choice'` 카드가 하나라도 → 「{N}장 중 {c}장 맞혔어요」, 아니면 「…알았어요」(지금 `session.mode === 'FLIP'` 판정 :161 을 대체) |
| 타일 | 맞힘·틀림·건너뜀 합산 그대로(서버 `correctCount`… 우선 — 지금 :77-79 그대로) |
| 구분 한 줄 | 객관식 답 `n ≥ 1` **그리고** 스스로 답 `m ≥ 1` 일 때만, 「걸린 시간 … · 다시 볼 카드 …」 줄 바로 아래(`mt-1 text-[13px] text-ink2 break-keep`), 「보관한 세트를 다시 푼 결과예요.」 줄보다 위 — `methodTally(cards, mode)`: 객관식 = `answeredBy==='choice'` 이고 CORRECT/WRONG 인 카드, 스스로 = `'self'`. 건너뜀은 어느 쪽에도 세지 않는다 |
| 목록 뱃지 | 섞인 세트(위와 같은 조건)일 때만: 세 목록(틀린 단어·다시 볼 카드·전체) **모두** 행 오른쪽 뱃지를 방식 뱃지(⑬)로. 섞이지 않은 세트는 지금 그대로(전체 목록에만 맞힘·틀림·건너뜀). 객관식 오답의 「내 답 ‘…’」은 행 둘째 줄(지금 `정답 {뜻} · 내 답 {보기}`)에 이미 있으므로 뱃지에 반복하지 않는다(23-12 ⑧) |
| 오늘 홈 요약·통계·연속 기록 | 그대로(계산·모양 불변) — Q9 5장 예시: 맞힘 2·틀림 2·건너뜀 1, 통계 「4문제 중 2개」 |

### 23-10. developer 용 구현 순서 · 금지 · 함정

#### A. 순서와 병렬 경계

| 단계 | 담당 | 내용 | 기대는 것 |
|---|---|---|---|
| S | Dev-S(서버) | 23-4 E + 서버 시험(FLIP `choices` 생성·없으면 전부 null, FLIP 에 `chosenText` 채점, 둘 다 400, `not_in_choices`, CHOICE+`selfResult` 400, #53 새 방식, 기본 mode FLIP, CHOICE 명시 호환) | 이력서 「서버 명세」 |
| C0 | Dev-D(덱) 먼저 | `cardFirst.ts` + `cardFirst.test.ts`, `deck.ts`(`keyAction` 선택 필드·`'choices'`·C, `pickNotice` `noChoice`) + 기존 `deck.test.ts` 무수정 통과 확인 | 타입은 `src/types/vocab.ts` 지금 모양 — **클라이언트·서버가 함께 고칠 타입 없음**(정본 = `src/types/vocab.ts`, 서버 DTO 는 `sessions.ts` 안 `VocabCardDto`) |
| C1 | Dev-D | `useVocabDeck`·`VocabDeck`·`VocabCardFace`·`FlipControls`·`GestureHint`·`DeckNotice`·`DeckListenRow` | C0 |
| C2 | Dev-H(홈·결과·주제, C0 이후 C1 과 병렬) | `TodayWordsCard`·`TopicWordsCard`·`TodayHome`·`KeptSets`·`VocabResult`·`WordResultList`·`topicLogic`·`topicSetStart`·`useTopicSetStart`·`TopicSetStart`·`topicCopy`·`hooks.ts` 주석 + 시험 2개 속성 삭제 | C0(`modeTag`·`isNoChoiceSet`·`answeredBy`·`methodTally`·문구) |
| C3 | Dev-H 또는 QA | 23-7 A 재측정 → 상수·시험 | C2 가 개발 서버에 올라간 뒤 |
| I | 통합 | S + C1 + C2 를 한 브랜치에서 tsc·eslint·시험·라이브 흐름(Q9 5장) | — |

파일 소유: `cardFirst.ts`·`deck.ts`·`labels.ts`(건드릴 일 없음) = Dev-D. Dev-H 는 `cardFirst.ts` 에 함수가 더 필요하면 Dev-D 에게 요청(같은 파일 동시 편집 금지). `topicCopy.ts` = Dev-H.

#### B. 건드리면 안 되는 것

- `SwipeCardStack.tsx`(0줄) · `classifyGesture`/`resistX`/임계 상수 · `touchend preventDefault` · 카드 크기 상한·하한 · `VocabCardFace` 안 버튼 금지.
- task-053 단어 가중(`generateWordSet`·`levelCeilingFor`)·세트 생성 풀 규칙 · task-046 자리표시 규칙(실측 상수·`H_CLASS` 리터럴·한 번에 공개·`invisible+inert`) — 값만 재측정.
- 스키마(`prisma/schema.prisma`) · TTS 설정·엔진 · `wordSound.ts`/`useWordSound.ts`/`WordSoundButton.tsx`(다른 화면 공유) · 챌린지·주제 규칙.
- 덱에서 하단 `Toast` 사용 · #47 에 `mode` 보내기 · 화면에서 정답 계산.

#### C. 새 시험(최소) — `cardFirst.test.ts`·`deck.test.ts` 추가 케이스

`hasChoices`(undefined·null·[]·4개) · `answeredBy`(CHOICE·FLIP+chosenText·FLIP 스스로·SKIPPED·안 답함) · `isNoChoiceSet`(빈 카드 배열 → false, CHOICE → false) · `methodTally`·`splitLine`(Q9 5장 → 「객관식 2장 중 1장 맞힘 · 스스로 2장 중 1장 알았어요」) · `fixedHint` 7 갈래 · `blockedNextHint`(열림·뜻 보기 면·앞면 닫힘·보기 없는 세트) · `deckSoundView`(6 모양·접근 이름) · `keyAction` 새 갈래(C 열기/닫기·열림 1~4·열림 Space 무시·뜻 보기 면 C 무시·이전 세트 C 무시·한글 자판 `code:'KeyC'`) · `pickNotice('noChoice')` · `parseTopicStart`(mode 없음 통과·`'X'` null) · 탭 동작 분기(23-3 C)를 순수 함수 `tapAction(...)` 으로 떼어 시험하는 것 권장.

#### D. 함정

1. **카드 안 버튼**은 휴대폰에서 눌리지 않는다(23-3 E 1). 데스크톱 마우스로는 눌려서 개발 중에 놓치기 쉽다 — 360 폭 터치 에뮬레이션으로 확인.
2. **`preventDefault` 삭제 금지**(23-3 E 2) — 보기가 카드 탭 직후에 생기므로 유령 클릭이 「답」으로 기록된다.
3. 데모의 `pointer` 이벤트를 옮겨 오지 않는다(23-3 E 3).
4. `choices` 의 세 가지 「없음」(undefined·null·[])을 모두 없음으로 — `card.choices?.length` 를 바로 진리값으로 쓰지 말고 `hasChoices` 하나로.
5. `MODE_LABEL[mode]` 가 다섯 곳(`VocabDeck:149`·`VocabResult:156`·`KeptSets:72`·`TodayWordsCard:255`·`TopicSetStart:165`) — 하나라도 남으면 새 세트에 「뒤집기 카드」가 보인다. `grep MODE_LABEL` 결과가 `labels.ts` 정의와 `modeTag` 안쪽뿐이어야 한다.
6. 배포 직후 60초 동안 옛 화면이 남긴 주제 시작 토큰에 `mode:'CHOICE'` 가 있을 수 있다 — **토큰의 mode 를 본문에 싣지 않는다**(싣으면 그 세트만 이전 4지선다로 만들어진다).
7. `choose` 가드(:379)·`next` 막힘 문구(:289)·`onTap`(:137) 세 곳이 지금 `mode` 하나로 갈라진다 — 셋 다 카드별 판정으로.
8. 자동 다음(0.4초) 중 듣기를 누르면 곧 멈춘다 — 의도된 동작(데모 같음). 반대로 `view` 바뀜에 `stop()` 을 빠뜨리면 다음 카드에서 앞 카드 소리가 이어진다.
9. 라이브 영역 역할 바꾸기 금지(23-6 C).
10. 기존 시험은 **시그니처를 지켜서** 그대로 통과시킨다: `resultBand(answer, mode)`·`canPeek(mode, card)`·`cardSide(mode, card, flipped)`·`keyAction(e, ctx)`(새 필드 선택)·`pickNotice(...)`(유니온 확장)·`TopicStartBody.mode?`·`topicSetStart` `done` 상태(키는 참일 때만). 수정이 불가피한 시험은 23-12 ⑤ 의 셋뿐.
11. 데모에서 고친 결함 중 앱에 옮길 것: 없음 — 보관 세트 행 링크 40px 는 데모만의 문제였고 앱은 이미 `py-1`(`KeptSets.tsx:70`)로 44px 이상이다.

### 23-11. reviewer · qa 확인표

#### A. 데모와 대조 (헤드리스·개발 서버 가능)

| # | 항목 | 기준 |
|---|---|---|
| Q1 | 오늘 카드 | 방식 줄 0, 장수·(분류)·[시작하기]·오류 줄 순서·간격 그대로, 설명 문구 D8 A 원문 |
| Q2 | 자리표시 | 새 실측 상수 = 360/390/412 실제 카드 높이 ±0.5px, 공개 순간 첫 화면 점프 ≤ 8px(§17), 경계 폭 앞뒤 4px 확인 |
| Q3 | 덱 높이 | 360×740·390×800·412×780 에서 F0·F1·P·Ac·B0·Ak·이전 4지선다 답한 뒤 모두 카드 ≥200 이고 이웃(알림·듣기 줄)과 **겹침 0**. 덱 스크롤은 0 이지만 무대가 224 미만이 되는 4개 조합(23-7 B)만 `main` 스크롤(데모: 객관식 답한 뒤 242/302/282 근처) |
| Q4 | 위험 조합 | 주제 세트 + 알림 + 객관식 답한 뒤 + 360×740 — 카드 높이·`main` 스크롤 기록(23-7 B) |
| Q5 | 터치 크기 | [객관식]·[뜻 보기] 52, 듣기 44, 보기 52, 도구 52 — 44px 미만 0. 가로 넘침 0(긴 표현·200자 보기·100자 예문) |
| Q6 | 스크롤 한 곳 | 덱 0, 결과 `main` 하나(§18 규칙 — 새 안쪽 스크롤 상자 없음) |
| Q7 | 어두운 화면 | 듣기 재생 중(`bg-ink text-surface`)·fail(`border-bad text-bad`)·mute·blocked 고리·보기 열림 카드 테두리 accent — 명암비 4.5:1(글자)·3:1(테두리) |
| Q8 | 스와이프 불변 | `SwipeCardStack.tsx` diff 0줄, `deck.test.ts` 기존 9/10·79/80·59/60 무수정 통과 |
| Q9 | 탭 → 객관식 | 탭 열림/다시 탭 닫힘, [객관식]·C 같은 일, 열어도 #50 요청 0건, 뜻 보기 면에서 탭·C 무반응 |
| Q10 | 서버 채점 | 카드 우선 세트 보기 → #50 `chosenText` → 응답 `correctText` 로만 ✓/✗(요청 전 DOM 에 ✓/✗ 없음) |
| Q11 | 혼합 기록 | Q9 5장(食べる 스스로 알았어요 · 行く 객관식 정답 · 水 객관식 오답 · 高い 스스로 몰랐어요 · 友達 표시 후 끝내기) → 맞힘 2·틀림 2·건너뜀 1, 구분 한 줄, 섞인 세트 뱃지 3 목록, DB `VocabAttempt.chosenText` 2행만 값 |
| Q12 | 보기 없는 세트 | 뜻이 서로 다른 단어 <4 계정 → 알림 ⑤, [객관식] 없음, 탭 = 뜻 보기 |
| Q13 | 이전 세트 | 배포 전 빌드로 만든 CHOICE·FLIP 진행 중 세트와 보관 세트 → D6 A 화면, 듣기 줄만 추가, [다시 풀기] → 카드 우선 |
| Q14 | 주제·챌린지 | 챌린지 단어 카드(할 일·조금 남음)·[내 단어장으로 풀기] 펼침·대기 화면 부제에 방식 없음, 챌린지 합계 그대로 |
| Q15 | 듣기 | 단어·예문 두 버튼, 예문 없음/100자 초과 → 한 칸, 한 번에 하나, 다음 카드에서 멈춤, 표시 설정을 바꿔도 같은 글을 보냄(#23 본문 비교), 실패 6종 문구·모양(오프라인·429 연타·422 는 개발 서버 조작 가능 범위에서) |
| Q16 | 키보드 | C·1~4·Space·Enter·←→·F·R·S 표(23-6 A), 초점 이동(23-6 B), 입력창·시트에서 무시 |
| Q17 | 화면 읽기 | 23-6 C 알림 문구, `role=alert` 줄은 늘 마운트 |
| Q18 | 저장소 | `kaiwa.vocab.mode` 가 홈 방문 뒤 지워짐, 다른 `kaiwa.vocab.*` 그대로, 저장소 차단 환경에서도 동작 |
| Q19 | 엔진명 | 오늘 홈·덱·결과·대기 화면 렌더 글자에 `claude|haiku|sonnet|opus|qwen|reazon|whisper|style-bert|엔진|모델|trace|task-` 0건 |
| R1 | reviewer | L1(FLIP 세트 `choices` 노출 판단)·`toCardDto` CHOICE 미답 카드 정답 미노출 유지·`markChoice` 외 정답 계산 0·`chosenText`/`selfResult` 동시 전송 경로 0 |

#### B. 실기기에서만 (사용자 폰 — 헤드리스 불가면 NOT_VERIFIED 로 넘긴다)

탭(10px)·밀기 임계 손 느낌 · 카드 탭 직후 보기 1번 유령 클릭 없음 · 보기 열림 때 카드 높이 변화가 거슬리는지 · TalkBack 카드 이중 탭 동작·읽기 순서 · 실제 TTS 지연·예문 소리 · S25+ 글꼴 줄바꿈(오늘 카드 높이·힌트 줄 잘림) · 앱 WebView 390 폭.

### 23-12. 데모와 다르게 쓴 곳 · Leader 확인

데모와 다르게 쓴 곳(가이드가 정함 — 모양 영향 작음):
- ⑦ **보기 없는 세트의 막힘 안내**를 「알았어요·몰랐어요를 먼저 골라 주세요」로(데모는 「뜻 보기나 객관식으로 먼저 답해 주세요」 — 객관식이 없는 세트라 맞지 않음).
- ⑧ **결과 방식 뱃지**: 데모는 「객관식 틀림 · 내 답 ‘불’」이지만 앱 행 둘째 줄에 「내 답 불」이 이미 있어 뱃지는 「객관식 틀림」만. 방식 뱃지는 **섞인 세트에서만**(데모는 새 세트 결과에 늘 — 데모에 섞이지 않은 결과 화면은 없었다).
- ⑩ **답 저장 실패 힌트를 빨강(alert)**으로 — 데모 I 「답 저장 실패」 모양. 지금 코드는 모든 힌트가 ink 다. 표시 저장 실패·결과 저장 실패도 같은 빨강으로 맞춘다.
- ⑪ 객관식 답 화면 읽기 문구는 데모(「틀렸어요. 정답은 …」)가 아니라 **지금 코드 문구**(「틀렸어요. 정답 …」) 유지.
- ⑫ 보기 열림 상태를 `visibilitychange` 다시 읽기에서 유지(데모에 없는 경우 — `flipped` 와 같은 규칙).

Leader 확인(계약·데모·코드가 어긋나는 곳 — 고치지 않고 보고):
- ① **이전 뒤집기 세트와 카드 우선 세트를 구분할 수 없다.** 둘 다 `mode='FLIP'` 이고 #48 항목에는 카드가 없으며, #49 에서도 「보기 없는 새 세트」와 이전 뒤집기 세트가 같다. 데모 G 의 보관 줄 「10월 8일 · 10장 · 뒤집기 카드」는 지금 계약으로 그릴 수 없다. **가이드의 임시 규칙: 방식 이름은 `CHOICE`(이전 4지선다)에만.** 대안 B: 계약에 파생 필드(예: #48·#49 세션의 `cardFirst`) 추가 — Leader 결정.
- ② **계약 #50 「둘 다 → 400 `{field:'chosenText', reason:'exclusive'}`」 ↔ 코드 `parseAttemptBody`(sessions.ts:301-302)**: 답 필드가 둘이면 `recordAttempt` 전에 `{field: 'selfResult', reason: 'one_answer'}` 로 거절한다. 화면은 둘을 같이 보내지 않아 영향이 없다 — Dev-S 가 계약에 맞출지, 계약을 코드에 맞출지 결정 필요.
- ③ **계약 #47 안에서 충돌**: 본문 줄 「`mode CHOICE|FLIP`(기본 CHOICE)」(§2-10 #47 첫 목록)과 바로 아래 「`mode` 생략 시 기본은 `FLIP`」. 뒤쪽이 task-059 결정 — 앞 줄 정정 필요.
- ④ **계획표 날짜 시트에 「(뒤집기)」가 보인다.** finish(#51)의 `StudyLog.summary` 가 `…장(${mode==='CHOICE' ? '보기 고르기' : '뒤집기'})`(sessions.ts:831)이고 `plan/logic.ts displaySummary` 가 그대로 보인다 → 카드 우선 세트(객관식 섞임)도 「뒤집기」로 기록된다. 「방식 이름은 이전 세트만」과 어긋남. 서버 문구 변경 여부(계약 「#51 변경 없음」과 충돌 가능) — Leader.
- ⑤ **기존 시험 수정이 필요한 곳 3개**(완료 기준 2 「기존 … 시험이 수정 없이 통과」와의 관계): `todaySkeleton.test.ts`(실측값 — 필연), `seedButtons.test.ts:47`·`topicLogic.test.ts:206·208`(카드 props `mode`·`onMode` 삭제에 따른 속성 두 줄 삭제, 단언 변경 없음). 대안: 두 카드에 `mode?`·`onMode?` 를 쓰지 않는 선택 prop 으로 남겨 시험 무수정(죽은 prop — 비권고). 덱·시도 큐·세트 시험(`deck.test.ts`·`labels.test.ts`·`topicSetStart.test.ts`)은 무수정으로 설계했다.
- ⑥ **완료 기준 3 「재생 버튼(후리가나 설정 반영)」 해석**: 데모 C 대로 「표시 설정은 카드 글자에만, 소리는 같은 문장」으로 QA 표(Q15)를 썼다. 설정에 따라 읽는 글이 바뀌어야 한다는 뜻이면 Leader 확인.
- ⑨ **높이 위험**(23-7 B) — **해결됨(2026-10-12)**: QA 실측에서 확인된 겹침(결함 #1)을 무대 `min-h-[224px]` 로 고쳤고(REV-187 PASS) 부작용(그 조합 `main` 스크롤 약 44.2px·[다음 카드] 가림)은 23-7 B 후속에 기록.

---

## 24. 오늘의 단어 덱 — 조작 정리 (task-060, IMP-0031·0032·0033, 2026-10-12)

> **§5-2 B·C 와 §23(task-059)의 덱 조작 서술 일부를 이 절이 대체한다.** 아래 24-1 의 「대체」 열에 없는 것은 §5·§23 그대로 유효하다. light 트랙(데모 없음) — 사용자 원문 3건 + Leader 권고안(사용자 「권고안으로 작업하고…」 2026-10-12 승인)이 근거다. 서버·API·스키마·네이티브 변경 없음 → 웹 배포만.

### 24-1 제스처·버튼 지도 (§23 D0·D1·23-3 D 를 대체)

| 조작 | 이전(§23) | 지금(§24) |
|---|---|---|
| 탭(10px 미만) | 객관식 열기/닫기(보기 있는 카드) · 뜻 보기(보기 없는 카드) | **그대로** |
| **↑ 위로 밀기** | 다시 볼 카드 표시 토글 | **뜻 보기**(`upAction` → `deck.flip`). 지금 카드·안 답함·뜻 있음·아직 안 뒤집음일 때만 — 이때만 카드가 튄다(`bump`). 보기가 열려 있으면 닫고 뒤집는다. 못 하는 경우: 이미 뒤집음 「알았어요·몰랐어요를 먼저 골라 주세요」 · 뜻 없는 카드 「알았어요·몰랐어요를 누르면 뜻이 보여요」 · 옛 4지선다 세트 「먼저 답을 골라 주세요」 · 답한·지난 카드는 안내 없음 |
| ← 왼쪽 | 다음(답한 뒤에만) | **그대로** |
| **→ 오른쪽 밀기** | 이전 카드 | **건너뛰기 확인 시트**(안 답한 지금 카드에서만). 답한·지난 카드는 ×0.25 저항 + 「이전 카드는 아래 [이전] 버튼으로 가요」. **이전 카드로 가는 길 = [이전] 버튼·← 키만** |
| 앞면 하단 첫 줄 | 보기 있는 카드 [뜻 보기][객관식] 두 칸 | **버튼 없음.** 52px 자리는 고정(`h-[52px]`) — 안내 한 줄: 「카드를 위로 밀면 뜻이 보여요」(보기 없는 카드 「카드를 위로 밀어도 뜻이 보여요」, `CARD_FIRST.slotHint`·`slotHintNoChoice`). 뒤집어도 **하단 첫 줄 높이(52px)와 위치는 불변**(QA-A 실측 360/390/412). 단, 뒷면에서만 생기는 단어/예문 듣기 줄(`DeckListenRow` 44px, task-059 부터)이 카드 무대를 44px 줄여 카드가 22px 올라간다 — task-060 이전부터 있던 동작 |
| 뒷면·답한 카드 | [알았어요][몰랐어요] / 기록 한 줄 | **그대로** |

- 「다시 볼 카드 표시(★)」는 [표시] 버튼·F 키로만 남는다. ↑(ArrowUp) 키는 동작 없음.
- 제스처 영역 안 버튼 금지·`touchend preventDefault` 유지(§5-0 4).
- **화면 읽기·스위치 대체 경로**(제스처 전용 동작의 단일 포인터 대체 — WCAG 2.5.1): 눈에 안 보이는(sr-only) 실제 `<button>` [뜻 보기]·[객관식](보기 있는 카드·안 답함) — 앞면 안내 자리 — 와 [건너뛰기] — 도구 줄 밖 — 가 같은 동작을 한다([건너뛰기] 는 확인 시트를 연다). Tab 키로 닿았을 때(`:focus-visible`)만 보이는 칩으로 나타난다(52px 자리 정중앙, 다른 요소를 밀지 않음). **새 카드·보기 닫기 때 초점은 이 숨은 버튼으로 가지 않는다**(`choicesToggleFocus` — 보기를 열 때만 첫 보기로).

### 24-2 도구 줄 (§5-2 B DeckToolbar 를 대체)

- 안 답한 지금 카드: **[이전][읽기][표시][한글]** (4번째 칸 = 옛 [건너뛰기] 자리). 답함·지난 카드: [이전][표시][다음 카드 ›](마지막이면 [결과 보기 ›]) — 그대로.
- **[읽기] = 히라가나 표기(앞면 표제어 후리가나)만, [한글] = 앞면 한글 표기 줄만** — 서로 독립(`VocabCardFace` 의 앞면 한글 줄은 덱이 넘기는 `hangul` 상태만 따른다). 옛 4지선다 세트의 카드 탭은 [읽기] 만 토글.
- 저장: [읽기] `kaiwa.vocab.readingDefault`(기존) · [한글] **`kaiwa.vocab.hangulDefault`**(새, `'on'|'off'`). 새 키가 비어 있으면 [읽기] 값을 이어받고, [읽기]를 누르는 순간 지금 보이는 한글 값을 새 키에 먼저 굳힌다(`displayToggleWrites`).
- [한글] 막힘(`aria-disabled`+누르면 한 줄): 앱 표시 설정이 로드됐고 한글 끔 → 「설정에서 한글 표기를 켜 주세요」 · 켬인데 이 카드 표제어 층이 없음 → 「이 카드는 한글 표기가 없어요」 · 로딩 중·설정 로드 전 → 막지 않음(`hangulBlock`).
- 아이콘: [읽기] 「あ」 · [한글] 「가」(`aria-hidden`), 칸 높이 52px, `grid-cols-4`(360 폭 칸 76px 안에서 넘치지 않음).

### 24-3 건너뛰기 확인 시트 (`SkipConfirmSheet`, 새 화면 아님)

- 끝내기 확인(`FinishConfirmSheet`)과 같은 바닥 시트 패턴. 제목 「이 카드를 건너뛸까요?」 · 본문 「건너뛴 카드는 '건너뜀'으로 기록하고 뜻을 보여 드려요.」(서버 확인: `skipped:true` → `SKIPPED`·뜻 응답·같은 `order` 재시도는 첫 결과 그대로 = 다시 풀기 불가) · 버튼 [건너뛰기](강조)·[취소] — **첫 초점 [취소]**, 설명 연결은 두 버튼의 `aria-describedby`.
- 열림 = 오른쪽 밀기 · S 키 · sr-only [건너뛰기] — 모두 시트만 연다(`askSkip`). 기록(#50 `skipped`)은 시트의 [건너뛰기]에서 `deck.skip()` 으로만. 시트를 연 카드가 바뀌거나 답이 들어오면 저절로 닫힌다(`skipFor` 가 카드 `order`).
- 시트가 열려 있는 동안 덱 키 입력은 막힌다(`sheetOpen`).

### 24-4 키·힌트 (§5-2 C 키 표·§23-6·23-8 ⑩⑪ 를 대체)

| 키 | 동작 |
|---|---|
| Space | 뜻 보기(그대로) |
| C | 객관식 열기/닫기(그대로) |
| R | 읽기(히라가나) |
| **H** | **한글**(새) |
| F | 표시(★) |
| **S** | **건너뛰기 확인 시트 열기**(바로 건너뛰지 않음) |
| ↑ | 동작 없음(옛 표시 키 해제) |
| ← / → / Enter | 이전 / 다음 / 다음 카드(그대로) |

- 터치 고정 힌트(`fixedHint` 터치 갈래 — 카드 상태에 맞는 것만 말한다): ① 옛 4지선다 세트 「← 밀어 다음 · → 밀어 건너뛰기」(`KEY_HINT.touchChoice`) ② 답한 카드·지난 카드 「← 밀어 다음 · 이전 카드는 [이전]」(`touchDone`) ③ 안 답한 지금 카드의 뒷면, 그리고 뜻 없는 카드(위로 밀어도 뜻이 안 열림) 「← 밀어 다음(답한 뒤) · → 밀어 건너뛰기」(`touchBack`) ④ 안 답한 지금 카드의 앞면 「↑ 밀어 뜻 보기 · ← 밀어 다음 · → 밀어 건너뛰기」(`KEY_HINT.touch`). 모두 31자 이하 — 360 폭 한 줄. 키 힌트는 새 키(H·S 확인)에 맞게 고쳤다. 막힘 문구 `CARD_FIRST.answerFirst` 는 「카드를 위로 밀거나 눌러서 먼저 답해 주세요」.

### 24-5 알려진 한계·미확인

- 실기기(S25+ WebView): 위로 밀기 80px·오른쪽 60px 문턱에서 뜻 보기/확인 시트가 의도대로 갈리는지, 대각선 위가 위로 판정되는 기존 규칙, Bluetooth 키보드 Tab 칩, TalkBack 초점 이동 — **NOT_VERIFIED**.
- 키 힌트(정밀 포인터) 앞면 문구는 360 폭 정밀 포인터에서 끝이 말줄임될 수 있다(데스크톱 덱 폭 488px 에서는 들어감).
- C 로 객관식을 닫으면 초점은 `body` 로 떨어진다(키 단축키는 계속 동작). 새 카드 앞면의 첫 초점은 직전 위치에 남는다.
- 오른쪽 밀기로 이전 카드를 볼 수 없다 — 사용자 지시의 결과(24-1).
- 도구 줄의 숨은 [건너뛰기] 칩은 Tab 으로 닿는 동안 [읽기]·[표시] 두 칸 가운데 일부(각 약 33×32px)를 덮는다(레이아웃은 밀지 않음). 터치 사용자에게는 보이지 않는 경로.
- 건너뛴 카드는 맞힘·틀림에도, 공부한 수(챌린지 하루 합계·복습 입력)에도 들어가지 않는다(서버 규칙) — 확인 시트 문구는 「건너뜀으로 기록하고 뜻을 보여 드려요」까지만 말한다.
- 건너뛰기 확인 시트가 열린 동안 끝내기 시트는 열리지 않는다(`askSkip` 가드 `endOpen`), 시트가 닫히면 `skipFor` 를 비운다(끝내기 실패로 phase 가 돌아와도 되살아나지 않음).
