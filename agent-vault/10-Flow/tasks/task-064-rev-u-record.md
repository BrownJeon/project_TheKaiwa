---
task_id: task-064
role: reviewer
part: REV-064-U (화면·접근성 감사 — /ask 목록·질문 방·components/ask·공용 확장)
tags:
  - type/task-record
  - domain/ask
  - domain/ui
aliases:
  - REV-064-U
created: 2026-10-12
---

# task-064 — Reviewer 기록 (REV-064-U1: /ask 화면 구현)

이력서 본문: [[task-064-ask-anything-3a]] · 구현 가이드 `docs/screens.md` §25 · 승인 데모 `docs/demo/task-064-ask-anything-v2.html`(v2) · 개발 기록 [[task-064-dev-u-record]] · [[task-064-dev-u3-record]] · [[task-064-dev-fx-record]]

## REV-064-U1 — 판정: **PASS_WITH_NOTES** (Critical 0 · High 1 · Medium 3 · Low 3 · 정보 6)

> 조건: **H-1 은 QA 전에 고친다**(작은 수정, 실제 모델 출력에서 모든 예문의 뜻 줄이 사라진다). H-1 수정 후에는 `answerMd.ts` 예문 부분만 좁게 재감사하면 된다. 나머지는 권고.
> 확신 표시: `[확실]` = 이번 세션에서 파일을 읽거나 실행해 확인한 것.

### 0. 감사 범위·방법
- 읽은 것: `src/components/ask/**` 전부(부품 18 + 순수 모듈 3 + 시험 6) · `src/app/(app)/ask/**` 3 · `src/types/ask.ts` · `shell/{askReturn,correctionsReturn,routes}.ts` · 공용 확장 diff(`ChatMenuSheet`·`ChatRoom`·`Composer`·`MessageList`·`ProposalCard`·`TurnNotice`·`labels`·`useChatTurn`·`JapaneseText`) · `removalA11y.test.ts` 허용 목록 diff · PE 모듈 `prompts/ask.ts`·`askResponse.ts`(예문 표기·살균 대조).
- 실행한 것: 스크래치 탐침(`answerMd.ts` 사본 + `tsx`, 적대 입력 28건·ReDoS 18건) · 검토 미러에서 변이 20건(미러만, 끝나고 `diff -rq` 로 NFS 원본과 동일 확인, 가짜 `ask/page.tsx` 원위치).
- 데모 게이트: `node ../.claude/tools/demo-gate/check.mjs check --task agent-vault/10-Flow/tasks/task-064-ask-anything-3a.md` → **`DEMO_GATE_PASSED`** (task-064, approved v2, `hash: verified`). `evidence.jsonl` 37행: `kind:approve`, `version:2`, `prompt_ts 16:43:14` → 승인 `16:43:39`, 이력서 frontmatter `approval_quote` 가 사용자 발언과 일치. 에이전트가 `approve`·`waive` 를 대신 실행했거나 state 파일을 직접 쓴 흔적은 보지 못함.

### 1. 스냅샷 게이트 대조 (`/tmp/claude-1000/rev064/result.txt`, head 9f76338, overlay 85 파일)
| 항목 | 개발 기록(dev-fx 19:05) | 스냅샷 | 판정 |
|---|---|---|---|
| tsc | exit 0 | `tsc=0` | 일치 |
| eslint | exit 0 (경고 5, 변경 밖) | `eslint=0` | 일치 |
| 시험 | 3,668 중 3,667 통과 · 실패 0 · 건너뜀 1 | **3,622 중 3,619 통과 · 실패 2 · 건너뜀 1** | 아래 — 둘 다 **스냅샷 산출물**, 코드 결함 아님 |
| build | exit 0 | `build=0` | 일치 |
- 실패 ① `askHome.test.ts` ⑰ 「같은 주소 두 파일이면 빌드 실패」: 스냅샷(= HEAD 위 덮어쓰기)에 **삭제가 반영되지 않아** 옛 `src/app/(app)/ask/page.tsx` 가 남아 있다. [확실] 미러에서 그 파일만 치우고 ask·shell·topic 시험 173건 재실행 → **173/173 통과**(파일 원위치함).
- 실패 ② `modules/conversation/__tests__/ask.test.ts`: `tests/prompts/fixtures/ask.json` 읽기 ENOENT — 미추적 파일이라 스냅샷에 없음. 이 파일의 시험이 아예 돌지 않아 총 시험 수가 46개 적다(3,668 → 3,622). 서버 쪽 감사(REV-064-S) 범위라 내용은 보지 않았다.
- → **M-3**(커밋 체크) 참조. 실패 2건을 근거로 코드를 반려하지 않는다.

### 2. 발견 사항

#### High
**H-1. 예문 표기 불일치 — 프롬프트 모듈과 화면 파서가 서로 다른 문법** (`components/ask/answerMd.ts:130-155` ↔ `modules/conversation/prompts/ask.ts:285-299`·`prompts/askResponse.ts:262-276`)
- 근거: PE 지시문 `ASK_EXAMPLE_SYNTAX_LINES = ['> 일본어 예문 한 문장', '그 문장의 한국어 뜻']` 와 지시문 299행("바로 아래 줄은 … 한국어 뜻(앞에 기호 없음)"), 참조 파서 `askExampleBlocks`(`>` 줄 + 다음 줄), 회귀 픽스처 `tests/prompts/fixtures/ask.json` 모두 **뜻 줄에 `>`·`→` 가 없다**. 화면 `answerMd.ts` 는 `MEANING = /^(?:→|->)\s*(.*)$/` 이고 뜻은 `>` **인용 묶음 안의 `→` 줄**만 인정하며, §25-6 B 의 「PE 규칙: `>` 일본어 한 줄 + `> →` 뜻 한 줄」 이 정본이다. 모델은 PE 지시문을 따른다.
- 재현: `parseAnswerMd('핵심.\n\n> 窓が開いている。\n창문이 열려 있어요.')` → `[p, ex{meaning:null}, p{'창문이 열려 있어요.'}]` — 예문 상자에 뜻이 없고 한국어 뜻이 상자 밖 별도 문단으로 떨어진다. 시험 173건은 `> →` 형식만 넣어서 이 조합을 한 번도 보지 못한다(PE 픽스처 문자열을 `parseAnswerMd` 에 넣는 교차 시험 없음). `task-064-designer-record.md:41` 은 「예문 표기 규칙(인용 줄 + 뜻 줄)」 을 서버·프롬프트 쪽 결정 사항으로 넘겼으나 합의 기록이 없다.
- 위험: 모든 일반 질문 답에서 승인 데모의 「예문 상자 안 → 뜻」 (D9) 이 재현되지 않는다. 보안·데이터 문제는 아니고 표시 품질 결함이라 High(Critical 아님).
- 권고(분류 defect): (a) 화면 파서가 `>` 일본어 줄 **바로 다음의 `>` 없는 한 줄**(한글 있음 · 가나/한자 없음)도 뜻으로 받는다 — `> →` 형식도 유지. 비용 작고 지시문 체크섬(`ASK_CHECKSUM_PIN`)·실측을 건드리지 않는다. (b) 또는 PE 지시문·`askExampleBlocks`·픽스처를 `> →` 로 맞춘다(체크섬 핀 변경·재실측 필요). 어느 쪽이든 PE 픽스처의 실제 답 문자열을 `parseAnswerMd` 에 넣는 교차 시험을 추가한다. 정본 선택은 Leader.

#### Medium
**M-1. 공용 확장 「기본값 무변경」 보호 시험 부재 (§25-11 ⑯)**
- 근거: 변이 5건이 **전체 `src/components`·`src/app` 시험 1,458건에서도 전부 생존** — M16 `ProposalCard` 모르는 kind → 공부 기록 카드 폴스루 · M17 `Composer` 기본 `lang` ko · M18 `DisplayBar` 기본 키에서 `tr` 제거 · M19 `MessageList` `annotate` 기본 false · M20 `useChatTurn` 요청 본문에 `scope` 항상 포함. M20 은 서버가 TALK·CHAT 의 `scope` 를 400 으로 거절하므로(`ask.test.ts` #32) 회귀하면 회화·채팅 전송이 깨진다. 현재 코드는 diff 대조상 기본값이 그대로다(회귀 없음 확인).
- 권고: ⑯ 의 기본값 5~6개를 순수 단위 시험으로 고정(`SendOptions` → 본문 키 빌더를 순수 함수로 빼거나 `renderToStaticMarkup`).

**M-2. 규칙이 요구한 행동 6건이 시험 무방비 — 소스 문자열 검사 중심의 한계**
- 근거(변이 생존): M08 칩 보낸 뒤 `focusList()` 제거(§25-9) · M09 `AskHome.create` 의 `creatingRef` 중복 생성 방지 early return 제거(§25-12 B 4 — `/creatingRef/` 정규식이 다른 줄에 맞아 통과) · M10 경과 초 `aria-hidden` 제거(§25-9) · M12 `useScopeNoticeGate` 서버 스냅샷을 `null`→`true`(첫 렌더가 이미 확인한 것으로 보임) · M13 근거 카드가 항상 돌아오기 기록을 남김(집중 화면 아닌 REVIEW·STUDY_LOG·CORRECTION 도) · M14 보내는 범위 시트 [취소]/Esc/배경 때 입력 바 글 복원 제거. 코드는 모두 요구대로 짜여 있다(직접 읽어 확인).
- 잡힌 변이(좋은 점): M01~M07(링크 문법·스킴/URL·HTML 태그 살균 해제, 예문 한글 판정, 칩 조건, 429 `reason` 분기, 시트 문구 축소)·M11(pending 키 지우기)·M15(세 기록 동률 순서) 9건은 정확히 잡힘 — `answerMd`·시트 문구·`reason` 분기의 시험 품질은 높다.
- 권고: M09·M13·M14 는 순수 함수 하나로 빼서(예: `shouldRememberAskReturn(type)`, `onSheetCancel(held)`) 단위 시험, M08·M10 은 구조 시험에 줄 단위 패턴 추가.

**M-3. 커밋 체크 — 삭제와 미추적 신규 파일**
- 근거: 작업 트리에서 `src/app/(app)/ask/page.tsx` 가 삭제 상태(`D`)이고 새 `ask/(tab)/page.tsx` 가 있다. 삭제가 커밋에서 빠지면 `/ask` 를 두 페이지가 정의해 **빌드가 실패**한다(스냅샷 시험 ①이 정확히 이 상황을 비춘다). 또 `tests/prompts/fixtures/ask.json`·`src/components/shell/__tests__/askReturn.test.ts`·`src/components/ask/**`·`src/types/ask.ts`·`(tab)/`·`[chatId]/` 가 미추적이다.
- 권고: Leader 가 스테이징할 때 삭제(`git rm`)와 위 미추적을 함께 넣고, 커밋 전에 HEAD 가 아닌 **스테이징된 트리**로 시험을 한 번 더 돌린다(메모리의 공유 작업트리 hunk 스테이징 교훈).

#### Low
- **L-1. 첫 질문 유실 가능** (`AskHome.tsx` `create`): `writeStore`(예외 삼킴)로 `pending.<id>` 를 쓰고 곧바로 초안을 지우고 방으로 이동한다. 세션 저장소가 막힌 기기에서는 글이 사라지고 빈 방만 남는다. 권고: 쓴 뒤 `readStore` 로 확인하거나 모듈 메모리 변수를 폴백으로(주소에 싣지는 말 것).
- **L-2. 시트 문구 ↔ 계약 ③ 열거어**: 계약 §2-18-A 5항 ③ 은 「공부 횟수·점수·**연속**·복습 예정 목록」, 시트(승인 데모 문구)는 「공부 횟수·점수·복습 예정 목록」. [확실] 서버는 실제로 `연속 출석 N일` 을 만든다(`learning/recordRetrieval/sources.ts:199`). 「공부 기록 요약」 이라는 큰 말이 덮어서 사용자 동의 범위 안이라고 볼 수 있으나, 계약의 「동의 문구와 실제 전송 범위는 항상 같아야 한다」 에 비추면 열거어 하나가 빠졌다. 시트는 사용자가 승인한 문구라 이 감사에서 고치지 않는다 — Leader 가 「연속 출석」 추가 여부를 정하고, 바꾸면 안내 키 버전을 올리고 데모 재승인.
- **L-3. 오래된 `pending` 자동 전송**: 목록이 `pending.<id>` 를 쓴 뒤 방이 읽기 전에 이탈하면 키가 남고, 같은 탭 세션에서 그 빈 방을 나중에 열면 사용자가 누르지 않았는데 그 질문이 전송된다(목록에서 범위 안내는 이미 확인한 글이라 안전 문제는 아님). 권고: `pending` 값에 시각을 담아 몇 분 지나면 버린다.

#### 정보 (조치 불필요 또는 다른 담당)
- I-1. 의존 방향: `chat/ProposalCard`→`ask/askCopy`·`eval/logic`, `chat/ChatMenuSheet`→`ask/{askCopy,logic}` 는 공용 부품이 기능 폴더를 import 한다. 순환은 없다(askCopy 는 types 만, `ask/logic` 은 `chat/labels` 만 부르고 `ChatMenuSheet` 를 부르지 않음).
- I-2. 답 본문·내 질문 말풍선의 일본어 구간이 15px(§25-9 글자 크기가 정한 값) — 프로젝트 원칙 「일본어 본문 16px↑」 과 어긋난다. 디자인 판단이므로 Leader 를 통해 designer 에게.
- I-3. 살균 잔존: `<<b>script>` 는 한 번의 치환으로 글자 `<script>` 가 남는다. [확실] React 텍스트 노드로 그려져 실행되지 않으며 서버 살균이 첫 방어선이다.
- I-4. 제안 카드 [바꾸기]/[추가] 채택 후 버튼이 사라져 초점이 문서로 빠진다 — 기존 단어 카드와 같은 패턴. TalkBack 실측은 QA.
- I-5. `AskPending` 의 `role="status"` 는 마운트 시점 첫 단계 문장을 일부 스크린리더가 읽지 않을 수 있다 — QA 실측.
- I-6. 정보: `parseAnswerMd` 가 답마다 렌더 때 두 번(`exampleTexts`·`AskAnswer`) 돈다 — 상한 4,000자라 비용 무시.

### 3. `answerMd` 렌더 보안 — 결론: **통과**
- `dangerouslySetInnerHTML`·`innerHTML`·`DOMParser`·`<a>`·`href`·`next/link`(답 렌더러)·자동 링크 **0** — `AnswerMarkdown`·`ExampleBlock` 전문 읽음, 소스 스캔 시험(주석 제거본)이 이를 잠그고 변이 M01~M03 로 살균 해제 시 즉시 실패함을 확인.
- 허용 노드 = 문단·강조·기울임·목록·인용·`br`·예문뿐. 탐침 28건: `<script>`·`<img onerror>`·`<iframe>`·`javascript:`/`data:`/`vbscript:`·마크다운 링크/이미지/참조식 링크·`<https://…>`·`www.`·`mailto:`·HTML 엔티티·양방향/제로폭 제어 문자 모두 링크·태그·속성 출력 0(엔티티는 글자 그대로 표시, 제어 문자는 제거).
- ReDoS: 시도한 18패턴(`*a ` 반복, `[`·`<a `·`<!--` 반복, `[a](` 중첩 등)은 모두 **최대 O(n²)** 이고 20,000자에서 최대 0.48초(`*a ` 반복), 서버 상한 4,000자에서는 수십 ms 이하 — 치명적 역추적 없음.
- 부정 시험이 실제 렌더 결과(`renderToStaticMarkup`)를 보는가: 예. 단 렌더 결과의 `<script` 부재 단언은 React 가 `&lt;script` 로 이스케이프하므로 **태그 살균이 꺼져도 통과**한다 — 그 보호는 `sanitizeAnswerText('<b>굵게</b>') === '굵게'` 단위 시험이 지고 있다(M03 이 두 시험에서 잡힘). 문제 없음.

### 4. 관점별 요약
1. **§25 일치**: 목록 5상태·질문 방 상태(대기 3단계·도착·LOW·기록 없음·되묻기 칩·제안 3종·시간 초과·답 불가·429 세 갈래·409·네트워크·404·긴 답)의 구조·문구·선택 규칙이 §25·승인 데모와 맞다. **H-1 만 예외**. 문구 원문 비교: `askCopy.ts` ↔ 데모 — 보내는 범위 시트 아래.
2. 보내는 범위 시트 문구 = 데모 `…v2.html` 1089~1103행과 일치: 머리 문단·보내는 것 5줄(「질문과 이 질문 방의 최근 대화(12개까지)」·「표시 이름·레벨 같은 학습자 정보」·「공부 기록 요약 — 공부 횟수·점수·복습 예정 목록」·「내가 채택한 교정의 원래 문장과 고친 문장」·「수업에서 배운 표현」)·보내지 않는 것 3줄(「이메일·계정 정보」·「내부 번호(id)」·「다른 회화·채팅의 대화 내용」)·꼬리. 음성 줄은 L-5 대로 없음. 계약 §2-18-A 5항 대비 좁거나 넓지 않음(L-2 의 「연속」 열거어 한 가지 제외). 한도 숫자(20건·2,000자)는 데모 문구에 있어 그대로 — 429 안내에는 한도 숫자·남은 횟수 없음(시험이 부정 단언).
3. **근거 카드 이동**: `askSourceHref` 6유형 + `id:null` 기본 화면(공부 기록→`/plan`, 복습→`/study/today`, 그 밖 null) + id 형식 검사(`^[A-Za-z0-9_-]{1,64}$`·`encodeURIComponent`) + `DATE_KEY`; 이동 불가·모르는 유형은 정적 `div`(링크·초점 없음). `askReturn` 은 `/ask/<id>` 만 허용하고 `pickBackHref` 는 `r.at > best.at` 로 동률 순서(계획표→교정 모음→질문 방)가 맞다(M15 로 잠김).
4. **첫 질문 인계**: 키를 읽기 전에 지우고(M11 잠김) 메시지 0개일 때만 전송, 방 만들기 실패는 토스트·잠금 해제, 방이 실패하면 키가 남아 재시도 때 전송. 관문은 `acknowledged === true` 만 통과(수화 전 `null` → 시트), [취소]/Esc/배경은 보내지 않고 `closeScopeSheet` 가 입력 바 글을 되돌린다(M14 시험 부재 → M-2). L-1·L-3 참조.
5. **상태·전송**: 대기 중 입력은 `busy`/`blockedUntil` 로 막고 `[나가서 기다리기]`·취소 요청 0(시험 ⑱). 단계 문구·경과 초 `aria-hidden`·30/90초 안내 `aria-live` 확인. 「새 답」은 `lastAnswerOk` 로 성공한 답에만. 409·429 문구에 남은 횟수 없음.
6. **접근성**: `Sheet` 가 `role=dialog`·`aria-modal`·`aria-labelledby/describedby`·제목 초점·닫힐 때 여는 요소로 초점 복귀·Esc/배경. 도착 알림은 방 루트 `sr-only role=status`(`doSend` 가 `arrivedId` 를 비워 같은 문장 재알림 보장). 칩 `role=group` 「기간 고르기」·되묻기 뒤 `focusList`(M08 시험 부재). 터치: 칩 40+`before` 확장 44, 근거 카드 `min-h-14`, 버튼 `min-h-11`/`h-11`. `lang`: 입력창 없음, 일본어 구간 `JaRuns` `lang=ja`.
7. **레이아웃**: 방 루트 `flex h-full min-h-0 min-w-0 flex-col`(채팅방과 같음), `MessageList` 단일 스크롤, `100dvh`·safe-area 는 셸. 목록 행 클래스 = `ChatListItem`(시험 ⑰ 잠금), 자리표시 `AskHomeSkeleton` 이 실제 부품을 `inert` 로 그려 점프 0 기대. `routes.ts` `'/ask/'` 가 방에서 하단 탭 숨김, `/ask` 는 탭 유지. 클래스 합산상 예산 충족(실측 아님 — 브라우저 실측은 QA).
8. **회귀(코드 대조)**: `useChatTurn`·`MessageList`·`Composer`·`TurnNotice`·`ChatMenuSheet`·`ProposalCard`·`ChatRoom`·`DisplayBar`·`labels` 확장 모두 옵션 인자 + 기본값 = 기존 동작. `ProposalCard` 는 모르는 kind 를 이제 `null` 로 그린다(전엔 공부 기록 카드로 오표시) — 의도된 개선이나 M-1 처럼 보호 시험 없음. `turnFailure` 가 `code` 를 더하지만 기존 `labels.test` 통과.
9. **3a 범위**: `ask/` 비시험 소스에서 `getUserMedia`·`useRealtimeStt`·`PushToTalk`·`speech/stt`·엔진·모델 이름 grep **0건**, 방 전송 본문은 `useChatTurn` 기본값 `inputSource:'TEXT'`(`useChatTurn.ts:191,208`)뿐이고 목록의 방 만들기(#28) 본문에는 `inputSource` 가 없다. 데모 게이트 PASS.
10. **시험 품질**: 173건(ask·shell·topic 접근성) 중 변이 20건에서 9 잡힘·11 생존(M-1·M-2). 18개 시험 지점 중 ⑯ 만 사실상 비어 있음. 주석 처리 코드가 통과하는 약한 정규식은 `readCode`(주석 제거) 사용으로 막혀 있음.
11. **사용자에게 알릴 부작용/실측 필요**: H-1 수정 전까지 예문 뜻이 상자 밖에 나온다 · 360/390/412 높이·가로 스크롤·`inert` 자리표시 점프 · TalkBack(도착 알림·대기 status·제안 채택 후 초점) · 휴대폰 뒤로가기와 「질문으로」 · 세션 저장소 차단 환경 · 시트 [취소] 후 글 복원.

### 5. Reviewer → QA 인계
- `high_risk_areas`: ① 예문 뜻 줄(실제 모델 출력 문자열) 렌더 ② 「보내는 범위」 시트 취소·Esc·배경 후 입력 바 복원과 첫 보내기 이어짐 ③ 첫 질문 인계(새로고침·뒤로·방 열기 실패 후 재시도) ④ 근거 카드 → 수업·평가·역할극 → ← 「질문으로」·휴대폰 뒤로 ⑤ 대기 카드 라이브 영역·경과 초 비낭독 ⑥ 360/390/412 높이·자리표시 점프 ⑦ TalkBack
- `native_change`: false (스키마·네이티브 변경 없음, 웹 배포만)

### 6. 이력 / 되돌림 확인
- 미러 변이 20건 후 `diff -rq` (`components/ask`·`components/chat`·`components/shell`·`JapaneseText.tsx`) NFS 원본과 차이 0, 옮겨 둔 `ask/page.tsx`(스냅샷 전용 잔존 파일) 원위치. NFS 소스·시험·문서 수정 0, 커밋·`git add` 없음.

판정: PASS_WITH_NOTES

---

## REV-064-U2 — 화면 재감사(보정 2 검증) — 판정: **PASS_WITH_NOTES** (Critical 0 · High 0 · Medium 0 · Low 3 · 정보 4)

> 범위: U1 의 H-1·M-1·M-2·M-3·L-2 가 실제로 해소됐는지, 그리고 dev-fx2 의 순수 함수 추출이 기본 동작을 바꾸지 않았는지만. U1 이 확인한 나머지는 재확인하지 않음. 확신 표시: `[확실]` = 이번 세션에서 읽거나 실행해 확인.
> 대상: [[task-064-dev-fx2-record]] · [[task-064-dev-san-record]] · 정본 `docs/screens.md` §25-6 B(Leader 정정 포함).

### 0. 스냅샷 게이트 대조 (`/tmp/claude-1000/rev064/result.txt`, head 9f76338, overlay 92 파일, 마지막 줄 `DONE`)
| 항목 | dev-fx2 기록 | 스냅샷 | 판정 |
|---|---|---|---|
| tsc | 0 | `tsc=0` | 일치 |
| eslint | 0 (경고 5, 변경 밖) | `eslint=0`, 로그 끝 `✖ 5 problems (0 errors, 5 warnings)` | 일치 |
| 시험 | 3,718 중 3,717 통과 · 실패 0 · 건너뜀 1 | **3,719 중 3,718 통과 · 실패 0 · 건너뜀 1** (`test=0`) | 실패 0 일치, **총수 +1**(I-3) |
| build | 0 | `build=0` | 일치 |
- [확실] `diff -rq` 로 스냅샷 `src` = dev-fx2 전용 미러 `src` = NFS `src`(차이 0). U1 의 실패 2건(삭제 미반영·픽스처 없음)은 이번 스냅샷에서 사라짐 — 스냅샷 `src/app/(app)/ask/` 에 `page.tsx` 없음, `tests/prompts/fixtures/ask.json` 포함.
- 데모 게이트·evidence: 이번 재감사 범위(코드 보정)는 화면 구조·문구 변경이 없어 재실행하지 않음. 시트 문구는 아래 §4 에서 승인 데모와 대조.

### 1. H-1 예문 뜻 줄 — **해소**
- 구현(`components/ask/answerMd.ts:153-207,255-263`): 인용 묶음이 「예문 묶음이고 마지막 줄이 JA(빈 `>` 줄로 끝나지 않음)」일 때만 다음 줄(빈 줄 없이 이어진 `text`)을 뜻으로 받음 — 한글 ≥1자·≤120 코드포인트·`**`/`*`·앞 `→` 제거. 목록·번호·제목·울타리는 `classify` 가 text 가 아니라고 먼저 걸러 문단으로 남음. `> →` 줄이 마지막이면 `canTakeFollowMeaning` 이 false → 뒤따르는 줄은 문단(§25-6 B 「`> →` 줄이 우선」과 일치). 문서 규칙 4항목(빈 줄 없음·한글 ≥1·≤120·목록 표식 아님)이 코드와 1:1.
- **픽스처 실측** [확실] (`tests/prompts/fixtures/ask.json` 의 선생님 답 형태를 스크래치 사본(`answerMd.ts` 복사 + tsx, 소스 무수정)으로 파싱): 픽스처에서 `> ` 예문이 든 선생님 답은 **f01·a04 두 건(같은 문자열)** — 둘 다 예문 2개가 `ex{ja:'窓が開いている。', meaning:'창문이 열려 있어요.'}`·`ex{ja:'窓が開けてある。', meaning:'누군가 창문을 열어 두었어요.'}` 로 **뜻이 상자 안에 붙고** 상자 밖 문단으로 새는 뜻 0건(앞 굵게 문단만 문단으로). 픽스처의 다른 선생님 답(s03)은 예문 없음. 서버 `sanitizeAskAnswerMd` 를 먼저 통과시킨 뒤 파싱해도 같은 결과(`>` 줄·뜻 줄 구조 보존, `__x__`→`**x**` 만 바뀜) — 서버→화면 경로 동치.
- 모양 변형 26건 [확실]: 기호 없는 뜻 / `> →` / 기호 없는 `→ 뜻` / 두 형식 혼합 / 한 묶음에 JA 두 줄+뜻 1줄(마지막 JA 에만 붙음) / 일본어 섞인 뜻(`これ는 제 책이에요.`) / 굵게 뜻 / 경계 120(뜻)·121(문단) / 빈 줄·빈 `>` 줄·목록·번호·제목·울타리 뒤 / 들여쓴 뜻 / 비예문 인용 뒤 한글 줄(문단) — 모두 문서·시험과 같은 결과.
- **오탐(뜻이 아닌 설명 문장이 예문 바로 아래에 붙은 경우)** [확실]: `> 窓が開いている。\n이 문장은 상태가 이어지고 있다는 뜻이에요. 누가 열었는지는 중요하지 않아요.` → 그 설명(≤120)이 예문 상자 안 「→ 뜻」 으로 그려짐(121 이상이면 문단). 처리는 **합리적**: ① 승인된 §25-6 B 정정이 정한 동작이고(Leader 결정) ② 프롬프트 지시문이 「앞뒤를 빈 줄로 띄운 두 줄」 이라 정상 출력에서는 뜻 줄이 곧 그 줄 ③ 실패 방향이 안전(상자 안에 설명이 들어갈 뿐 정보 손실·링크·스크립트 없음, 스크린리더는 「뜻:」 접두를 읽음). 한 줄 뜻 뒤에 이어지는 두 번째 줄은 문단으로 남음(`창문이 열려 있어요.\n(누가 열었는지는 관심 없음)` → 뜻 1 + 문단 1). 영구 결함 아님 — I-1 로 기록.
- **보안 약화 없음** [확실]: 뜻은 `parseAnswerMd` 맨 앞의 `sanitizeAnswerText`(태그·마크다운 링크/이미지·`javascript:`/`data:`/`vbscript:`/`file:`·URL·제어 문자) 뒤의 줄에서 나오고, 렌더는 `ExampleBlock` → `JaRuns` 의 `<span>` 텍스트 노드뿐(`dangerouslySetInnerHTML`·`innerHTML`·`DOMParser` 는 `components/ask` 비시험 소스에 0건, 소스 스캔 grep). 탐침: 뜻 줄에 `[링크](javascript:alert(1)) <img src=x onerror=alert(1)>` → `링크 창문`, `https://…`·`www.…`·`javascript:` → 지워짐(스킴 뒤 `)` 한 글자 잔존은 이전과 같은 살균 동작). 변이 R16(스킴 살균에서 data/vbscript/file 제거)이 시험 1건으로 즉시 잡힘. 새 문법이 링크·태그를 만들 길은 없음. 처리 비용: `canTakeFollowMeaning` 은 인용 묶음이 끝나는 첫 text 줄에서 한 번만 불리고 직후 묶음이 소진/flush 되므로 O(n).
- 시험: `answerMd.test.ts` H-1 ①~⑧ — ① 은 실제 픽스처 파일을 `process.cwd()` 에서 읽는 교차 시험(≥1 답 단언, 기대값을 줄 규칙으로 따로 계산, 뜻이 상자 밖 문단으로 떨어지지 않음 단언). 변이 R15(기호 없는 뜻 붙이기 끔)에서 ①②를 포함해 5건 실패 확인.

### 2. M-1 공용 부품 기본값 불변 — **해소(동작 불변 확인)**
dev-fx 시점 전용 미러(`~/.node-local/thekaiwa-dev064fx`, fx2 이전 상태)와 현재 NFS 를 `diff` 해 fx2 가 실제로 바꾼 줄만 대조 [확실]:
| 추출 | 이전 | 이후 | 동치 근거 |
|---|---|---|---|
| `buildTurnBody`(`chat/turnBody.ts`) ↔ `useChatTurn.ts:209` | `{text,inputSource}` + `utteranceId`/`clientTimings`/`coachRevealed(true일 때)`/`scope`(있을 때) 를 키 순서까지 같은 `if` 로 | 같은 `if` 5개를 한 함수로, `inputSource` 기본 `'TEXT'` | **옵션 없이 `scope` 키가 생기지 않음**(`if (opts.scope)`) — 회화·채팅 본문 `{text,inputSource[,…]}` 그대로, 서버의 TALK/CHAT `scope` 400 거절을 건드리지 않음. R1(scope 항상 싣기)·R2(기본 inputSource 변경)·R12(우회 문법으로 send 에서 scope 주입) 모두 시험이 잡음 |
| `annotatedMessages`(`chat/messages.ts`) ↔ `MessageList.tsx:123-126` | `annotate ? messages.filter(annotatable).map(content) : []` + 같은 순서로 id→상태 | 함수 하나로, `annotate = true` 기본 | `useAnnotations` 호출 횟수·순서 동일(훅은 항상 호출), 상태 배열 길이 = 대상 수. R3(기본 false) 잡힘 |
| `createAskRoom`(`ask/homeLogic.ts`) ↔ `AskHome.tsx:182` | 잠금 확인 → 잠금 → `setBusy(true)` → try{`apiPost({kind:'ASK',title: askTitleOf(text)})` → `pending.<id>` 쓰기 → 초안 지우기 → `setEdited('')` → `router.push`} catch{잠금·바쁨 해제, 토스트} | 같은 순서를 `deps` 로 주입 | 한 줄 차이 없음(바깥 효과 순서 동일). 요청 본문은 여전히 `{kind:'ASK', title}` 뿐(`askHome.test.ts` ⑱ 이 두 줄로 갱신된 정규식으로 `inputSource` 부재를 계속 잠금). R4(잠금 잡기 제거) 잡힘 |
| `scopeSheetRestoreText`(`ask/logic.ts`) ↔ `AskRoom.tsx:269` | `p?.fromComposer → composer.restore(p.text)` | `held?.fromComposer ? held.text : null` → `restore !== null` | `fromComposer` 가 true 면 빈 글 `''` 도 복원(이전과 같음). R5·R6 잡힘 |
- `useChatTurn` 이 옵션 없이 `scope` 를 보내지 않는지 [확실]: `send` 의 본문은 `buildTurnBody(text, opts)` 한 곳뿐이고(`useChatTurn.ts:209`), `run()`/resume/retry 는 받은 `body` 를 그대로 `apiStream` 에 넘김(`body.`/`scope` 를 다시 만지는 코드 0건 — `grep`). 순수 시험 `buildTurnBody('…')` 가 `{text,inputSource}` 두 키뿐임을 `deepEqual` + `'scope' in body === false` 로 단언.
- 그 밖의 fx2 변경 파일은 없음: 이전 미러 대비 `diff -rq` 의 변경 코드 파일은 답 파서·`sources.ts`(L-2)·위 추출 4곳·시험뿐(translation `route.ts`·`askResponse.ts` 는 dev-san 의 서버 쪽 변경으로 이번 범위 밖).

### 3. M-2 새 행동 시험 — **해소(강함 + 아래 L-1 한 곳)**
- 두 시험 파일 구성 [확실]: 실제 행동을 보는 것 — `buildTurnBody`·`annotatedMessages`·`createAskRoom`(가짜 deps 로 연타·성공 시 잠금 유지·실패 시 해제)·`scopeSheetRestoreText`·`useScopeNoticeGate` SSR 프로브(`renderToStaticMarkup` → `data-ack="null"`)·`Composer`/`ProposalCard`/`DisplayBar` 정적 렌더(기본 `lang="ja"`·보내기 이름·context 문구·모르는 종류 `''`·토글 3/2개). 소스 구조 시험(`readCode` = **주석 제거본**)은 AskHome/AskRoom/AskPending/SourceList/MessageList/ProposalCard 배선에 한정 — 주석 처리된 코드는 통과하지 못함(R6 은 줄을 지우는 변이였고 잡힘; 정규식이 줄 단위 통짜라 주석 한 줄 무력화로도 실패).
- **변이 16건**(검토 미러만, 끝나고 `diff -rq src` NFS 와 차이 0 확인): **15건 잡힘 · 1건 생존**.
  | # | 변이 | 결과 |
  |---|---|---|
  | R1 | `buildTurnBody` 가 `scope` 키를 항상 실음 | 잡힘(2건 실패) |
  | R2 | 기본 `inputSource` TEXT→REALTIME_STT | 잡힘(2) |
  | R3 | `annotatedMessages` 기본 `annotate` false | 잡힘(1) |
  | R4 | `createAskRoom` 잠금 잡기 제거(방 두 개 생성) | 잡힘(2) |
  | R5 | `scopeSheetRestoreText` 가 칩 질문도 복원 | 잡힘(1) |
  | R6 | `closeScopeSheet` 의 입력 바 복원 호출 제거 | 잡힘(1) |
  | R7 | 기호 없는 뜻을 마지막 아닌 예문에도 붙임 | 잡힘(H-1 ③) |
  | R8 | `canTakeFollowMeaning` 가드 제거(`> →` 로 끝난 묶음 뒤 줄도 소비) | 잡힘(4) |
  | R9 | 뜻 줄 길이 상한 제거 | 잡힘(H-1 ⑥) |
  | R10 | 보내는 범위 관문 `!== true` → `=== false`(첫 렌더 null 통과) | 잡힘(2) |
  | R11 | 대기 카드 경과 초 `aria-hidden` 제거 | 잡힘(1) |
  | R12 | `useChatTurn.send` 가 scope 없는 전송에도 계산된 키로 `scope` 주입 | 잡힘(1 — `this.run(buildTurnBody(text, opts), ctx)` 정확 문자열 요구가 우회 문법도 막음) |
  | **R13** | `useChatTurn.send` 의 낙관적 말풍선 `inputSource` 기본값만 다른 값으로 | **생존** → L-1 |
  | R14 | 기호 없는 뜻 줄의 굵게 표식 안 지움 | 잡힘(H-1 ⑤) |
  | R15 | 기호 없는 뜻 붙이기 끔 | 잡힘(5 — 픽스처 교차 포함) |
  | R16 | 스킴 살균 약화(data/vbscript/file 제거) | 잡힘(1) |
- 주의(비결함): `askBehavior.test.ts` 일부(경과 초 `aria-hidden`·칩 뒤 `focusList`·근거 카드 돌아오기 기록)는 여전히 줄 단위 정규식 구조 시험이다. 렌더 환경이 없는 저장소 제약이라 수용 가능하며, 위 변이(R11)로 실제 보호 확인.

### 4. L-2(서버 「연속 출석」 제외) ↔ 화면 문구 — **일치**
- `learning/recordRetrieval/sources.ts`: 요약 줄에서 `연속 출석 N일`·`recentAttend` 쿼리(400행 읽기)·`computeStreak` import·`SOURCE_CAPS.streakDays` 제거, 요약 조건도 `|| streak > 0` 제거. 계약 `docs/design/api-contract.md` §2-18-A 5항이 「공부 횟수·점수·복습 예정 목록 — 연속 출석 일수는 보내지 않는다」로 정정됨. 학습자 헤더 `연속 출석` 줄(`prompts/header.ts:45`)은 프로덕션에서 채워지지 않음 [확실: `streakDays` 를 넣는 호출처가 `src` 비시험 코드에 없음, 채우는 곳은 `learning/vocab` 통계 UI 뿐].
- 시트 문구(`components/ask/askCopy.ts:147`)는 승인 데모 `docs/demo/task-064-ask-anything-v2.html:1091` 과 문자 그대로 동일(「공부 기록 요약 — 공부 횟수·점수·복습 예정 목록」) — 변경 없음, 안내 키 버전 올릴 필요 없음(문구 불변). 시험(`recordRetrieval.test.ts` ②)이 모든 항목의 `text`·`label` 에서 「연속」 0건을 부정 단언.
- 남은 일관성 문제는 L-3, PE 픽스처 잔재는 I-2.

### 5. 새 지적
- **L-1 (Low) — 같은 기본값이 두 곳에서 계산됨** (`components/chat/useChatTurn.ts:192` ↔ `components/chat/turnBody.ts:buildTurnBody`). 낙관적 말풍선의 `inputSource` 는 `send` 안 지역 변수(`opts.inputSource ?? DEFAULT_INPUT_SOURCE`)에서, 서버로 가는 본문의 `inputSource` 는 `buildTurnBody` 안에서 따로 계산한다. 지금은 같은 상수를 써서 동치지만, 한쪽만 바뀌면(변이 R13) 화면 말풍선과 보낸 값이 어긋나는데 시험이 못 잡는다. 권고: `const body = buildTurnBody(text, opts)` 를 먼저 만들고 말풍선은 `body.inputSource as InputSource` 를 쓰거나, 말풍선 쪽도 `buildTurnBody` 가 노출한 한 곳에서 읽는다. 사용자 영향 없음(현재 동작 동일) — 다음 손볼 때 정리.
- **L-2 (Low) — 뜻 줄의 `unmark` 가 모든 `*` 를 지움** (`components/ask/answerMd.ts:144-146`, 사용처 `:162,:178`). `3*4 는 12 예요.` → `34 는 12 예요.` 처럼 곱셈표 등 리터럴 별표가 사라지고(재현 [확실]), 반대로 `__굵게__` 는 지우지 않아 밑줄이 글자로 나온다. `> →` 뜻 줄에서는 이전부터 같은 동작이었지만, 이제 임의의 한국어 한 줄이 같은 경로를 타므로 노출이 넓어졌다(일본어 학습 답에서 별표 리터럴은 드묾). 권고: `**…**` 쌍과 줄 앞뒤 단독 `*` 만 지우도록 좁히거나 `parseInline` 의 굵게/기울임 규칙을 뜻에도 적용(뜻이 `JaRuns` 텍스트라 서식은 못 내므로 서식 표식만 벗기면 됨). 보안·데이터 손상 아님.
- **L-3 (Low) — 동의 문구 열거어와 전송 내용의 부분 정정** (`learning/recordRetrieval/sources.ts:193-197`). U1 L-2 의 처방은 「연속 출석」 제외로 끝났지만, 같은 요약이 여전히 `공부한 날 N일`·`출석 N일` 을 보낸다. 시트 열거는 「공부 횟수·점수·복습 예정 목록」이고 계약의 「동의 문구와 실제 전송 범위는 항상 같아야 한다」 기준으로는 출석·공부한 날도 연속과 같은 부류(출석 파생)다. 「공부 기록 요약」 이라는 큰 말 아래 횟수류로 묶인다고 읽으면 허용 범위이므로 위험은 낮다 — 다만 **연속만 빼고 출석 일수는 남긴 이유가 정본에 적혀 있지 않다.** 권고(Leader 결정): ① 「공부 기록 요약 = 공부한 날·출석 일수·활동 횟수·점수」로 계약 5항에 풀어 쓰고 연속 제외는 이미 한 변경이라 그대로 두거나, ② 열거어를 엄격히 따르려면 `출석 N일` 도 제외. 시트 문구는 승인본이라 어느 쪽이든 이 감사에서 바꾸지 않음.

### 6. 정보 (조치 불필요 또는 다른 담당)
- **I-1**: H-1 오탐(설명 문장이 예문 바로 아래에 붙으면 상자 안 뜻으로 보임) — Leader 가 승인한 문법의 알려진 부작용. 이 감사는 라이브 모델을 부르지 않았으므로 실제 출력에서 오탐이 얼마나 나는지는 측정하지 못했다(저장소에 있는 모델 출력 모양은 픽스처 f01·a04 두 건뿐이고 둘 다 정상 모양). PE 기록은 예문 바로 아래 줄을 뜻 줄로 보고 측정했다는 정도만 확인했다. QA 가 실제 모델 답 몇 건의 눈 판정에서 오탐이 자주 보이면 120 상한을 낮추거나 `다음 줄이 마침표로 끝나는 완결 설명문` 휴리스틱을 검토.
- **I-2**: PE 픽스처 `tests/prompts/fixtures/ask.json` p01 은 여전히 `연속 출석 4일` 글과 `header.streakDays: 4` 를 모델링한다. 서버가 이제 만들지 않는 데이터이므로 PE 몫으로 정리 권고(시험 실패는 없음 — 전체 시험 통과).
- **I-3**: 시험 총수 3,719(스냅샷) vs 3,718(dev-fx2 기록) — [확인] `src` 가 dev-fx2 미러·NFS 와 바이트 단위 동일(`diff -rq` 0)이라 코드 차이가 아니다. 총수 차이는 조건부로 등록되는 시험(스냅샷에 `tests/prompts/fixtures/ask.json` 같은 파일이 있고 미러엔 없던 경우 등) 때문일 수 있다 [추측]. 실패 0·건너뜀 1 은 일치하므로 판정에 영향 없음. Leader 스냅샷 수치(3,719/3,718)를 기준 숫자로 쓸 것.
- **I-4**: `src/app/api/v1/chats/[id]/messages/[messageId]/translation/route.ts`·`askResponse.ts` 등 dev-san 의 서버 살균 변경은 이번 범위 밖이다(서버 감사 REV-064-S 영역). 다만 서버 살균을 통과한 예문 구조가 화면 파서에서 같은 결과로 파싱됨은 §1 에서 확인했다.

### 7. 커밋 위험 — Leader 스테이징용 파일 목록 (M-3)
> [확실] `git status --short` 기준(vault 제외). 경로에 `(app)`, `(tab)`, `[id]`, `[chatId]` 가 있어 **`git --literal-pathspecs add …`** 로 스테이징할 것(대괄호를 글로브로 해석하지 않게). 스테이징 뒤 `git diff --cached --stat` 가 이 목록과 일치하는지 확인하고, 가능하면 스테이징된 트리 기준으로 `tsc`·시험을 한 번 더(공유 작업트리 hunk 스테이징 교훈).

**① 삭제 — 빠지면 `/ask` 를 두 페이지가 정의해 빌드 실패** (`askHome.test.ts` ⑰ 이 이것도 잠금)
- `D src/app/(app)/ask/page.tsx` → `git rm` 또는 `git add -A -- 'src/app/(app)/ask'`

**② 미추적 신규 — 하나라도 빠지면 빌드(import)·시험이 깨짐**
- `src/app/(app)/ask/(tab)/` (`page.tsx`, `loading.tsx`) · `src/app/(app)/ask/[chatId]/page.tsx`
- `src/components/ask/` 전부: `AnswerMarkdown.tsx` `answerMd.ts` `AskAnswer.tsx` `AskComposerCard.tsx` `askCopy.ts` `AskExamples.tsx` `AskFailed.tsx` `AskHome.tsx` `AskHomeSkeleton.tsx` `AskListItem.tsx` `AskPending.tsx` `AskQuestionBubble.tsx` `AskRoom.tsx` `ExampleBlock.tsx` `homeLogic.ts` `logic.ts` `ScopeChips.tsx` `ScopeNoticeSheet.tsx` `SourceList.tsx` `useScopeNoticeGate.ts` + `__tests__/{answerMd,askBehavior,askCopy,askHome,askRoom,logic,scopeNotice}.test.ts`
- `src/components/chat/turnBody.ts` · `src/components/chat/__tests__/sharedDefaults.test.ts`
- `src/components/shell/askReturn.ts` · `src/components/shell/__tests__/askReturn.test.ts`
- `src/types/ask.ts`
- `src/app/api/v1/chats/_lib/turnRoute.ts` · `src/app/api/v1/chats/_lib/__tests__/turnRoute.test.ts`
- `src/modules/conversation/askRouter/` (`classify.ts` `index.ts` `readers.ts` + `__tests__/{askIntentCases.ts,classify.test.ts,readers.test.ts}`) · `chats/askLimits.ts` · `chats/askView.ts` · `orchestrator/ask.ts` · `prompts/ask.ts` · `prompts/askResponse.ts` · `__tests__/{ask,askApi,askRouteGuard,askSanitize,askTurn}.test.ts`
- `src/modules/learning/recordRetrieval/` (`assemble.ts` `index.ts` `range.ts` `sources.ts` `text.ts` `types.ts` + `__tests__/{fakeDb.ts,recordRetrieval.test.ts}`)
- `src/modules/engine/__tests__/claudeUtf8Chunks.test.ts` (수정된 `claudeCli.ts` 의 StringDecoder 변경과 한 쌍)
- `tests/prompts/fixtures/ask.json` — `ask.test.ts`·`answerMd.test.ts` H-1 ① 이 읽는다. 빠지면 시험 실패(U1 실측: 46건 미실행·ENOENT 1건)
- `tests/live/ask-measure.ts` — PE 실측 도구(`tsconfig` 에서 제외돼 빌드 영향 없음, 같이 커밋 권장)

**③ 수정(M) — 모두 task-064 관련(변경 줄 중 ASK 언급 확인; `claudeCli.ts` 만 언급 0 이지만 dev-cli 의 U+FFFD 방지 StringDecoder 변경)**
- 코드: `src/app/api/v1/chats/[id]/messages/[messageId]/translation/route.ts` · `src/app/api/v1/chats/[id]/turns/route.ts` · `src/app/api/v1/chats/route.ts` · `src/components/chat/{ChatMenuSheet,ChatRoom,Composer,MessageList,ProposalCard,TurnNotice,labels,messages,useChatTurn}.ts(x)` · `src/components/common/japanese/JapaneseText.tsx` · `src/components/shell/{correctionsReturn,routes}.ts` · `src/components/topic/__tests__/removalA11y.test.ts` · `src/modules/conversation/{index.ts,chats/index.ts,chats/translation.ts,chats/validate.ts,orchestrator/index.ts,orchestrator/locks.ts}` · `src/modules/conversation/__tests__/{prompts,task006,task010d}.test.ts` · `src/modules/engine/adapters/llm/claudeCli.ts` · `src/modules/learning/index.ts`
- 문서: `docs/screens.md` · `docs/design/{api-contract,learning-personalization-and-llm-data,module-dependency}.md` (승인 데모 `docs/demo/task-064-ask-anything-v1·v2.html` 는 이미 추적 중)

**④ 제외 권고**
- `.obsidian/` (워크스페이스 편집기 설정, task-064 무관) — 커밋하지 말 것.
- `agent-vault/` 의 `task-064-*-record.md` 13개(미추적)와 수정 4개(`board.md`·`task-064-ask-anything-3a.md`·`task-064-designer-record.md`·`20-Log/2026-10-12.md`)는 코드 커밋과 분리해 문서 커밋으로.

### 8. 결론
- H-1 **해소**(픽스처 실측 2/2 예문 뜻 상자 안, 서버 살균 통과 후에도 동일, 보안 약화 없음). M-1 **해소**(fx2 추출 4곳 모두 이전 코드와 동치 확인, `scope` 키는 옵션 없을 때 생기지 않음). M-2 **해소**(변이 16건 중 15 잡힘, 생존 1건은 사용자 영향 없는 L-1). M-3 은 코드 문제가 아니라 **Leader 스테이징 작업**이므로 위 목록으로 넘김. L-2(서버 연속 출석) 시트 문구와 일치(남은 L-3 은 Leader 결정).
- 스냅샷 게이트: tsc 0 · eslint 0(경고 5, 변경 밖) · 시험 3,719 중 3,718 통과·실패 0·건너뜀 1 · build 0 — dev-fx2 기록과 실패 0 기준 일치, 총수 +1 은 I-3.
- `native_change`: false. QA `high_risk_areas`: ① 실제 모델 답의 예문 뜻 줄 모양(오탐 빈도, I-1) ② 보내는 범위 시트 취소 후 입력 복원 ③ 첫 질문 인계·방 중복 생성 ④ 회화·채팅 전송 본문에 `scope` 키 없음(실기기 회화 한 번) ⑤ 360/390/412 높이·TalkBack(U1 인계와 동일).
- 되돌림 확인: 변이 후 검토 미러 `diff -rq src` NFS 와 차이 0, NFS 소스·시험·문서 수정 0, 커밋·`git add` 없음. 스크래치 탐침은 세션 스크래치 디렉터리에만 있음.

판정: PASS_WITH_NOTES
