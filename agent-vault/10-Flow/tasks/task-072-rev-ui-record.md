---
task_id: task-072
role: reviewer
title: "task-072 화면(UI) 독립 감사 — 단어 추가 시트 「일본어 도우미」(REV-072U)"
created: 2026-10-17
status: 완료 — PASS_WITH_NOTES
tags:
  - type/task-record
  - domain/vocab
  - domain/ui
  - domain/review
---

# task-072 Reviewer 기록 — 화면(UI) 감사 (REV-072U)

이력서: [[task-072-improve-word-add-helper]] · 구현: [[task-072-dev-ui-record]] · 서버 감사: [[task-072-rev-server-record]] · 설계: [[task-072-designer-record]]

## 감사 중 기록 (발견 순서대로)

- [m0] 범위 확인: 수정 3(Sheet·WordMicField·WordAddSheet) + 새 6(+시험 3). 금지 구역(`talk/**`·`labels.ts`·`WordForm.tsx`·`useWordMic.ts`·`wordMic.ts`·`types/phraseHelp.ts`의 UI 쪽·`modules/**`·`package.json`·`docs/demo/**`) 확인은 아래 [m1].

- [m1] 금지 구역 확인 — `git diff --stat HEAD -- src/components/talk vocab/{labels.ts,WordForm.tsx,useWordMic.ts,wordMic.ts} package.json docs/demo vocab/__tests__/wordMicField.test.ts` = **공용 `Sheet.tsx` 1파일(+3/-1)만**, 나머지 빈 출력 [확실]. `src/modules/**`·`src/types/phraseHelp.ts` 변경은 서버 파트(REV-072S 범위)로 이번 감사 밖.
- [m2] **Esc 순서 가정 검증 [확실, jsdom 26.1 + react-dom 19.2.8 + 실제 `Sheet`/`PhraseHelperButton`/`panelEscapeKeyDown`]** — 스크립트 `~/.node-local/thekaiwa-rev072u/esc-exp.mts`. `createRoot(div)` 와 Next 16 과 같은 `hydrateRoot(document)`(SSR 문서 → hydrate, `next/dist/client/app-index.js:299/302` 가 `document` 를 컨테이너로 쓰는 것도 확인) 두 방식 모두: 패널 안 Esc → `defaultPrevented=true`·시트 닫힘 0·판 닫힘 1 / 가あ(열림) Esc → 시트 0·토글 1 / 표현 칸(패널 밖, 판 열림)·가あ(닫힘)·body Esc → 시트 닫힘 1 / 조합 중 Esc → 판도 시트도 안 닫힘. 즉 개발자의 가정(React 리스너가 `Sheet` 의 `document` 리스너보다 먼저)은 **맞다**. 추가 근거: `Sheet` 가 `createPortal(…, document.body)` 라 React 가 포털 컨테이너(`body`)에도 리스너를 붙이는데(`preparePortalMount`) `body` 는 `document` 보다 버블 경로에서 먼저다 — 등록 순서와 무관하게도 React 처리기가 먼저 돈다(jsdom 은 브라우저가 아니므로 실제 WebView 확인은 QA 항목 유지).
- [m3] Esc 에 `preventDefault` 하는 모든 곳 전수(`'Escape'`·`keyCode 27`·`onKeyDown` 전수 grep, 앱 코드): ⓐ 새 패널 `panelEscapeKeyDown` ⓑ `talk/PhraseHelperButton`(열림일 때) ⓒ `talk/phraseHelperLogic.closeOnEscape` → `PhraseHelperPanel`(회화방 TalkRoom 전용, `Sheet` 안 아님) ⓓ `PushToTalkButton.onKeyDown`(`cancelOutside` 있을 때 녹음 중 — `useAskInput` 한 곳만 넘기고 그 입력은 어떤 `Sheet` 안도 아님). 그 밖 `onKeyDown`(Composer·ChatRenameForm·ScopePicker·AccentPicker·StageUnderstand·StageSpeak·CalendarSection·EvalItems·DayStrip)은 Enter/방향키만 `preventDefault` — Esc 불변. `document.addEventListener('keydown')` 은 `Sheet` 와 `VocabDeck`(Esc 안 봄) 둘뿐. → **`Sheet` 를 쓰는 43개 파일(`grep -rln "<Sheet"`) 중 닫힘 방식이 달라지는 경로는 WordAddSheet(의도) 한 곳뿐**.
- [m4] 기준 증빙(별도 미러 `thekaiwa-rev072u`, `diff -rq` src·tests·package.json 동일): tsc exit 0 · eslint error 0 / warning 5(기존 파일) · 새 3 + wordMicField 4파일 **85/85 통과** (전체 시험·build 숫자는 아래 「증빙 숫자 대조」).

## 최종 판정 (REV-072U, 2026-10-17 밤)

**PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 1 · Low 4. `native_change: false`(플러그인·android·capacitor 설정 무변경, `versionCode` 해당 없음). 한 가지 불편한 사실부터: 개발자 기록의 「변이 20/20 잡힘」은 **형식(소스 스캔) 변이**에 대한 말이다 — 동작 변이를 내가 17개 새로 넣자 **7개가 살아남았다**(동치 2 + 실제 허점 5, 아래 표). 현재 코드 자체는 맞게 동작한다는 것을 내가 **실제 `WordAddSheet` 를 jsdom 에서 돌려** 확인했다(32/32).

### 지적 표
| ID | 심각도 | 위치 | 내용 | 근거 | 권고 |
|---|---|---|---|---|---|
| M-1 | Medium(시험 질) | `useWordPhraseHelper.ts`(훅 전이)·`WordHelperCard.tsx`(`onFill(item.ja)`) — 시험 3파일 | 훅의 상태 전이와 카드 클릭 값은 **소스 문자열 스캔뿐**이라 동작이 틀려도 시험이 통과한다. 살아남은 변이: R16 카드가 `ja` 대신 `ko` 를 표현 칸에 넘김(**가장 날카로움 — 한글 뜻이 표현 칸에 들어가는 회귀**), R11 [그만두기]가 「찾기를 멈췄어요」 안내를 안 남김, R12 가あ 열 때 시트 낭독 줄을 안 비움(같은 단어 재낭독 실패), R13 새 질문에도 이전 소리 안 멈춤, R14 질의를 고쳐도 사유 안내가 안 지워짐 | 아래 「직접 한 변이」 표 | 코드 수정은 필요 없다(현재 동작 정상). 회귀 방어로 ① QA 가 W3·W5·W10·「그만두기」·「넣기 값」을 실제 화면으로 확인 ② 가능하면 별도 승인으로 개발 의존성 없이 돌릴 수 있는 hook 전이 순수화(상태 전이를 reducer 로) 또는 jsdom 도입(Q5 재결정) |
| L-1 | Low | `wordHelperWiring.test.ts` | 배선 시험이 공백을 지운 소스의 **정확한 모양**(`squash` 정규식)에 묶여 있다 — 동작이 같은 리팩터링(포맷터·변수명)에도 깨진다 | 시험 읽기 | 허용(개발자 인정 사항). 다음에 이 파일을 만지면 동작 시험으로 옮길 것 |
| L-2 | Low(QA 실기기) | `wordHelperLogic.helperQueryKeyDown` | 조합 중 Enter 는 막기만 하고 보내지 않는다(회화방·승인 가이드와 같은 규칙). 안드로이드 키보드의 「검색」 키가 마지막 글자를 조합 중인 상태로 `isComposing`/229 를 보내면 **첫 눌림이 무시**될 수 있다 | `isImeEnter` 정의 + 가이드 30-11 ① | 코드 변경 없음. QA W4 실기기(Gboard·삼성 키보드)에서 「검색」 키 첫 눌림이 보내지는지 확인 |
| L-3 | Low(QA) | `WordPhraseHelper.tsx` `focusOnOpenRef` | 이전 답이 있어 다시 열 때 초점을 **옮기지 않고** 가あ 에 있다고 가정한다(탭이 버튼에 초점을 준다는 가정). 내 jsdom 에서는 `click()` 이 초점을 안 옮겨 처음 FAIL → 탭처럼 `focus()` 후 클릭하면 PASS. 버튼이 탭으로 초점을 못 받는 환경(iOS Safari 류)은 초점이 표현 칸/본문에 남는다 | 하네스 T5a | 대상(안드로이드 Chrome/WebView)에선 문제 낮음. QA W14 에서 재열기 시 `document.activeElement` 확인 |
| L-4 | Low(정보) | `Sheet.tsx` Esc + 가이드 30-7 | **패널 밖** Esc(표현 칸·말로 쓰기 토글·안내 ✕)는 도우미 판이 열려 있어도 시트 전체를 닫고 판 안 답이 사라진다(메모리만). 가이드 그대로의 동작이며 물리 키보드에서만 생긴다 | 하네스 `표현 칸 Esc → closes=1` | 변경 없음. QA 가 의도 동작임을 알고 볼 것 |

### 관점별 결과
1. **공용 `Sheet` Esc 변경** — 아래 「Esc 순서 가정 검증」. 닫기 방식이 달라지는 기존 경로 **0**(WordAddSheet 의도 변경 한 곳뿐). 43개 `<Sheet` 파일 전수 + Esc 에 `preventDefault` 하는 4곳(+ 새 판) 전수.
2. **함정 12 + 접근성 1:1 대응** — ① Enter `preventDefault`: 실제 시트에서 `defaultPrevented=true`·요청 1건·`/api/v1/words` POST 0(T2). 패널 `<form` 0·모든 버튼 `type="button"`(소스+렌더 시험, 내가 `type` 변이 확인은 개발자 M02). ② Esc: 판 안·가あ(열림)=판만 닫힘+시트 유지, 패널 밖=시트 닫힘(T6, 하네스). ③ 취소 시점: 검증 통과 뒤에만(`enrich`), [직접 입력하기] 무조건 — 요청 중 [뜻 채우기]가 도우미 요청을 abort 하고 패널을 닫고 `{surface,enrich:true}` POST(T10). ④ 서로 닫기: `micOpenedNow`(렌더 중 비교)·`mic.target==='surface'` 조건(소스 시험+R08 잡힘) — **jsdom 에서 마이크가 막혀 열리지 않아 실제 열림은 못 돌림 → QA**. ⑥ 스크롤 상자 0·`data-kb-docked` 0(렌더 시험). ⑦ 공용 `Skeleton` 미사용(소스 시험). ⑨ 넣기 순서(R03 잡힘)·`mic.edited` — 실제 시트에서 값=インパクト·패널 닫힘·초점=표현 칸·낭독 줄(T4). ⑪ 막다른 길 없음: 빈 결과에서 질의 칸 편집 가능·[다시 시도] 없음(T8d). ⑫ 요청 본문 `{queryKo}` 하나(T2b). 접근성: `role=status` 두 줄 늘 마운트(렌더 시험)·실패 4종만 `role=alert`(T7a·T8a)·`lang`·44px 클래스 목록(코드 확인).
3. **073 동작 보존** — `git diff HEAD -- vocab/__tests__/wordMicField.test.ts` **빈 출력**, 그 시험 33건 통과. 개발자 골든과 별개로 **HEAD 의 `WordMicField.tsx` 를 꺼내 새 파일과 같은 입력 7상태(닫힘·확인 안내+낭독·막힘·열림·녹음 중·예문 열림·예문 확인 안내)를 렌더해 문자열 비교 → 7/7 바이트 동일**. 073 의 「알아들은 말」 줄·확인 안내·읽기용 줄 얼림은 슬롯이 없을 때 그대로.
4. **요청·상태 처리** — 서버 계약 분류를 실제 응답(Response 객체)으로 확인: 409 `PHRASE_BUSY`→D7 문구 alert(T7a) · 429+`Retry-After: 7`→「7초 뒤…」·대기 중 [물어보기]/[다시 시도] 요청 0(T7b-d) · 502→표준 오류 문구, 서버 `message`(「upstream engine claude…」)·엔진명 비노출(T8a) · 400 `forbidden_char`→서버 문구가 안내 줄에(T8c) · 200 `[]`→빈 결과(T8d) · Q5 한글 없음/공백 → 요청 0(T8e-f) · [그만두기] → abort+안내+초점 [물어보기], 늦은 응답 버림(T9) · 이중 클릭 요청 1건(T2f) · 언마운트 정리는 소스(`dispose`). 문구는 `wordHelperCopy.ts` 한 곳, **정적 문구 전부 승인 데모 HTML 에 글자 단위로 존재**(OK 28/28), 함수 문구 6종은 데모 패턴(「표현 N개를 찾았어요」「다른 후보 N개 더 보기」「N초 뒤 다시 물어볼 수 있어요」「표현 칸에 ‘…’를 넣었어요」「…자까지 물어볼 수 있어요 · n/100」)과 일치. 엔진명·model_id·`localStorage`·`console`·직접 `fetch`·`window.Capacitor`·`@/modules` import 새 파일 6개에 0. 6층: 이 변경에 `src/modules` 의존 없음.
5. **시험의 질** — 아래 변이 표. 소스 스캔은 호출이 빠지는 형식 회귀는 잘 잡지만 **훅 전이·카드 클릭 값**은 못 잡는다(M-1).
6. **데모 게이트** — `check.mjs check` = `DEMO_GATE_PASSED`(approved v1, hash verified). `evidence.jsonl` 의 task-072 줄은 `kind: approve` 한 줄(prompt_ts 14:28:10 → 14:29:18, 세션·transcript 필드 있음, `waive` 없음). 에이전트가 `.claude/state/demo-gate/` 를 직접 쓴 흔적은 못 찾았다. 데모와 다른 점: 가이드 30-16 의 **꼬리표·[다른 후보] 요약 없음 한 가지**(서버 계약) — 구현의 className 대부분이 가이드 §30 코드 블록과 문자열 일치, 불일치 10건은 가이드가 산문(「12 ink2」등)과 회화방 칩 클래스(`talk/PhraseHelperPanel.tsx:151` 와 **동일 문자열**)로 설명한 값이며 데모 CSS(칩 36px·gap 6·mt 6)와 같다. 분류: **implementation**(차이 1건 = 승인된 서버 계약 반영), material/defect 없음.
7. **접근성·모바일 CSS** — 코드 점검: 가로 넘침 방지(`min-w-0`·`flex-none`·`[overflow-wrap:anywhere]`·칩 `max-w-full`+`truncate`), 터치 44px(가あ·✕·[물어보기]·▶·[그만두기]·[다른 후보]·[다시 시도]·`GHOST` h-11, 칩 36+히트 확장, 안내 ✕ 28+`before:-inset-2`). 세 폭·다크·글꼴 130%·키보드 올라온 상태는 브라우저가 필요해 **QA 항목**.

### Esc 순서 가정 검증 (가장 중요한 항목)
- **결론 [확실, jsdom 26.1 + react-dom 19.2.8 + 실제 `Sheet`·`PhraseHelperButton`·`panelEscapeKeyDown`]: 개발자의 가정은 맞다.** `createRoot(div)` 와 Next 16 과 같은 `hydrateRoot(document)`(`next/dist/client/app-index.js:299/302` 가 `appElement = document` 사용) **두 방식 모두**: 패널 안 Esc → `defaultPrevented=true`·시트 닫힘 0·판 닫힘 1 / 가あ(열림) Esc → 시트 0·토글 1 / 표현 칸·가あ(닫힘)·body Esc → 시트 닫힘 1 / 조합 중 Esc → 판도 시트도 안 닫힘. 대조군으로 `!e.defaultPrevented` 를 지우면(H-X3) 같은 하네스가 `closes=1` 로 FAIL 한다(검출력 확인).
- 추가 근거: `Sheet` 가 `createPortal(…, document.body)` 라 React 가 포털 컨테이너(`body`)에도 이벤트 리스너를 붙이고(`preparePortalMount`), `body` 는 `document` 보다 버블 경로에서 먼저다 — 등록 순서와 무관하게도 React 처리기가 먼저 돈다.
- **한계**: jsdom 은 브라우저가 아니다. 실제 안드로이드 WebView 의 Esc(물리 키보드)는 QA 확인으로 남긴다. 휴대폰 소프트 키보드에는 Esc 가 없어 주 사용자 경로의 영향은 작다.

### 직접 한 변이 (별도 `thekaiwa-rev072u-mut` 미러, 매번 원본 복원; 개발자 M01~M20 과 다른 것)
시험 4파일(새 3 + `wordMicField`) 기준. 「하네스」= 내가 만든 실제 `WordAddSheet` jsdom 하네스(32체크).
| # | 변이 | 시험 | 하네스 |
|---|---|---|---|
| R01 | 조합 중 Enter 도 보냄 | 잡힘 | — |
| R02 | 조합 중 Esc 도 판을 닫음 | 잡힘 | — |
| R03 | 넣기 순서 `fill` ↔ `setSurface` 교환 | 잡힘(2건) | — |
| R04 | 결말 합치기가 시간 초과를 무시 | 잡힘 | — |
| R05 | 409 busy/error 분류 뒤집기 | 잡힘 | — |
| R06 | 429 대기 초를 상수 10 으로 | 잡힘 | — |
| R07 | `ask` 가 `pending` 을 무시 | **생존(동치)** — 이미 `loading` 이면 `req.start` 가 null 이라 관측 가능한 차이 없음 | — |
| R08 | `micOpenedNow` 느슨하게(이미 열린 칸도 「새로 열림」) | 잡힘 | — |
| R09 | `hasHangul` 이 자모(ㅋㅋ)도 한글로 | 잡힘 | — |
| R10 | [다시 시도] 클릭 가드(`if (waiting) return`) 제거 | **생존(동치)** — 훅의 `rateWaiting` 이 같은 막기를 이미 한다 | 생존(동치 확인: 클릭해도 요청 0) |
| R11 | [그만두기]가 「찾기를 멈췄어요」 안내를 안 남김 | **생존** | 잡힘(T9a) |
| R12 | 가あ 열 때 시트 낭독 줄을 안 비움 | **생존** | 잡힘(T5b) |
| R13 | 새 질문에도 이전 소리를 안 멈춤 | **생존** | (오디오라 미시험) |
| R14 | 질의를 고쳐도 사유 안내가 안 지워짐 | **생존** | 생존(하네스에 항목 없음) |
| R15 | `closeToButton` 이 가あ 로 초점 복귀를 안 함 | 잡힘 | — |
| R16 | 카드 [표현 칸에 넣기]가 `ja` 대신 `ko` 를 넘김 | **생존** | 잡힘(T4a·T4c) |
| R17 | 처음 안내가 판 열림을 무시(`!helperOpen` 제거) | 잡힘 | — |
하네스 대조 변이: H-X1(판 Esc `preventDefault` 제거) 잡힘 · H-X2(Enter `preventDefault` 제거) 잡힘 · H-X3(`Sheet` 가드 제거) 잡힘. → **17개 중 시험이 10 잡음 / 7 생존(동치 2 + 실제 허점 5)**, 실제 허점 5 중 3(R11·R12·R16)은 하네스가 잡아 현재 코드가 옳다는 것까지 확인.

### 증빙 숫자 대조 (별도 미러 `thekaiwa-rev072u`, `src/`·`tests/`·`package.json` `diff -rq` 동일, `UserWordState` 724)
| 항목 | 개발자 보고 | 내 재실행 |
|---|---|---|
| `tsc --noEmit` | exit 0 | **exit 0** |
| `eslint src/components src/modules/conversation tests/prompts` | error 0 · warning 5(기존 파일) | **error 0 · warning 5** (동일 5건) |
| 새 3파일 + `wordMicField` | 52 + 33 | **85/85 통과** |
| 전체 시험 | 4,263 중 4,261 통과·실패 0·건너뜀 2 | **tests 4,263 · pass 4,261 · fail 0 · skipped 2** |
| `next build` | exit 0 | **exit 0**(첫 시도는 내가 미러 루트에 둔 `.mts` 스크래치 파일의 타입 오류로 1 — 제품 코드 아님, 스크래치를 미러 밖으로 옮긴 뒤 재실행 0) |
| `git diff --stat` 금지 구역 | 빈 출력 | 빈 출력(`Sheet.tsx` 1파일만 변경) |

### QA 에 넘기는 high_risk_areas (실제 브라우저/HTTP 로 확인 — jsdom 으로 못 한 것)
1. **401 HTTP**: 로그아웃 상태에서 `POST /api/v1/words/phrase-help` → 401(공용 `api.ts` 가 로그인으로 보냄). 400(`<임팩트>`·`unknown_key` 본문)·429(+`Retry-After`)·409 `PHRASE_BUSY`(회화방 도우미와 동시)·502·504·12초는 모의가 아닌 **실제 응답**으로.
2. **Esc 위치별 5곳(WebView, 물리 키보드)**: ⓐ 패널 안(질의 칸·카드 버튼) ⓑ 가あ(열림) ⓒ 가あ(닫힘) ⓓ 표현 칸 ⓔ 패널 열린 채 말로 쓰기 토글·안내 ✕ → 기대 = ⓐⓑ 판만 닫힘+초점 가あ, ⓒⓓⓔ 시트 닫힘(L-4). 조합 중 Esc 는 둘 다 안 닫힘. **다른 시트(새 채팅·교정 채택·단어 상세·평가 등) Esc 닫기 회귀 0.** 회화방 판 Esc 불변.
3. **Enter**: 질의 칸 Enter·키보드 「검색」 키가 [뜻 채우기]를 안 부름(네트워크에 `/api/v1/words` POST 0) — **jsdom 은 암묵 제출을 구현하지 않아 내가 못 봤다.** 표현 칸 Enter 는 패널이 열린 채로도 [뜻 채우기]. IME 조합 중 첫 눌림(L-2).
4. **초점·키보드(실기기)**: 보낸 뒤 `document.activeElement`=[물어보기]·키보드 내려감·Tab 이 시트 밖으로 안 샘·재열기 초점(L-3)·360×780 + 키보드에서 질의 칸이 키보드 위에 보임·패널 안 스크롤 상자 0.
5. **3폭·다크·글꼴 130%·키보드**: 360/390/412 라벨 줄 한 줄(44px)·가로 넘침 0·가あ 오른쪽 끝=시트−16px·터치 44px. 안내 줄(`bg-ink`/`text-surface`) 다크 반전.
6. **409/429/502/504 화면**: 각 상태 상자(alert 여부)·[다시 시도]·429 카운트다운이 1초씩 줄고 0 에서 「잠시 뒤 다시 물어봐 주세요.」. 자기 [그만두기] 직후 재질문이 409 로 보일 수 있음(Q2, 알려진 한계).
7. **정형 인사 200 빈 목록**: 「감사합니다」→ 빈 결과 문구, 질의 칸·표현 칸·[직접 입력하기] 사용 가능(막다른 길 0).
8. **073 회귀**: 말로 쓰기 결과 → 확인 안내 → 가あ 열고 닫아도 유지 → [표현 칸에 넣기] 하면 사라짐(W10) · 「알아들은 말」 낭독 1회(재낭독 없음)·읽기용 줄 얼림 · 마이크 막힌 환경에서 토글 눌러도 패널 유지(실제 열림 경로는 jsdom 에서 못 돌림).
9. **PushToTalk Esc**: 질문 탭에서 녹음 중 Esc → 녹음 취소(시트 아님) 불변, 그 화면의 메뉴 시트를 연 채 녹음 중 Esc 는 이제 녹음만 취소(시트 유지 — 개발자·Leader 가 「의도에 가까움」으로 수용한 미세 변화, 내 전수 조사로도 이 한 경로).
10. **카드·소리**: [표현 칸에 넣기]가 **일본어 표기**(`ja`)를 넣는지(M-1 R16)·▶ 한 번에 하나·히라가나/한글 표시 스위치 on/off(W11)·[그만두기] 안내·질의 고치면 사유 안내 사라짐·새 질문 때 재생 중 소리 멈춤(M-1 R13·R14).
11. **회화방 회귀**: `git diff -- src/components/talk` 0줄 · 회화방 도우미 열기·묻기·결과 실화면 한 번.
12. **처음 안내**: 새 프로필에서 한 번만, ✕/가あ 로 닫힘, 회화방과 양방향 공유(D6).

### 하지 않은 것 / 확실하지 않은 것
- 실브라우저·실기기 확인 일체(Esc 실제 WebView·키보드·3폭·다크·130%)는 하지 않았다(금지: QA 서버 기동). 위 QA 항목으로 넘긴다.
- `Sheet` 변경이 **지금 앱에서** 다른 시트의 동작을 바꾸지 않는다는 결론은 현 코드의 Esc `preventDefault` 4곳 전수에 근거한다 — 앞으로 시트 안에 `cancelOutside` PTT 나 새 Esc 처리기를 넣으면 닫힘 방식이 달라진다(공용 규칙이 됐다).
- 내 jsdom 하네스·복사 대조 스크립트는 스크래치 디렉터리에만 두고 저장소에는 넣지 않았다(저장소 파일 수정 0, 커밋·푸시·배포·DB 쓰기·QA 서버 기동 0).
