---
task_id: task-072
role: designer
tags:
  - type/designer-record
  - domain/vocab
  - domain/conversation
  - domain/improvement
aliases:
  - task-072 designer 기록
created: 2026-10-16
updated: 2026-10-16
---

# task-072 — Designer 기록 (단어 추가 일본어 도우미)

> 본 이력서 [[task-072-improve-word-add-helper]] 의 designer 작업 기록. 이 파일만 designer 가 쓴다(이력서 본문·코드는 수정하지 않음).
> **데모 v1 = 사용자 승인 전.** 구현 가이드 초안은 `docs/screens.md` **§30**(승인 전 표기). 승인 전에는 developer 에게 넘기지 않는다. 회화방 도우미 정본 §22·[[task-056-designer-record]] 를 재사용 기준으로 삼았다.

## 체크포인트
- [09:12] 기존 파악 — 이력서 전체(D1~D9·L1~L6), `docs/screens.md` §22(회화방 도우미 승인 v1)·§28-4(추가 폼)·§15(표시 스위치), 데모 `task-056-talk-phrase-helper-v1.html`(토큰·버튼·카드·안내 CSS), [[task-056-designer-record]], 코드(읽기만) `vocab/{WordAddSheet,WordForm,WordMicField,labels}`·`talk/{PhraseHelperButton,PhraseHelperCard,helperCopy,phraseHelperLogic}`·`common/{Sheet,ui}`·`common/japanese/JapaneseText`·`speech/reading/client`(한글 줄 규칙), `types/phraseHelp.ts`, 서버 검증 `structuredResponse/phraseHelp.ts`(`no_hangul` 기준 `/[가-힣]/`), [[task-073-improve-word-add-copy]](파일 겹침 확인). `globals.css` sha256 앞 12자 `a314f18f1807`(회화방 데모와 같음).
- [09:14] 디자인 스킬 page-layout-designer·ui-component-builder 읽음(project-ui-system 미적용 — 학습 앱 화면).
- [09:20] 데모 v1 작성 `docs/demo/task-072-word-helper-v1.html` — 상태 31개(현재 1 + 제안 30) · 보기 하나/세 폭/현재 vs 제안 · 결정 12개(D1~D9 + D1′·D6′ + D4 두 갈래)를 라디오로 바꾸면 휴대폰이 바뀜 · 「직접 해 보기」(가あ → 칩/입력 → 찾는 중 → 결과 → [표현 칸에 넣기] → [뜻 채우기]) · 라벨 줄 세 폭(닫힘·말로 쓰기 열림·도우미 열림·글꼴 130%) · 알려진 한계·질문 · 개발 메모 · 자체 시험(`#selftest`).
- [09:24] 헤드리스 Chrome 검증(데모 파일만 로컬 file:// 열람, 운영·개발 서버 접속 없음): 자체 시험 **1,209칸**(상태 31 × 폭 360/390/412 × ★ + 대안 11가지 하나씩 + 표시 끔) — **가로 넘침 0 · 44px 미만 터치 0 · 라벨 줄 두 줄 0**. 캡처로 확인: 세 폭 처음 안내·결과 3개·다크 패널(키보드)·현재 vs 제안(말로 쓰기→도우미)·하위 시트(D2 B)·찾는 중. 고친 것 3건: ① 데모의 결과 상태 자동 스크롤이 라벨 줄을 가림 → 초점 없는 패널은 머리+160px 만 보이게(실제 앱은 스스로 굴리지 않는다) ② 패널 머리가 위 테두리에 붙음 → 위 4px ③ 라벨 줄 비교 상자의 장식 버튼이 Tab·낭독에 잡힘 → `inert`.
- [09:28] 가이드 초안 `docs/screens.md` §30(30-0~30-13) — 기존 절 무수정(§29 뒤에 붙임).
- [09:30] lint `DEMO_LINT_PASSED`(`--expect task-072-v1`), 파일 sha256 앞 16자 `b84f9cdfc0e29b7d`(88,238 B — 정본 해시는 Leader 의 `status` 가 기록).
- 디자인 스킬: layout·component·design-reviewer·a11y-reviewer(project-ui-system 미적용) / 자체 점검 P0 0·P1 0·P2 4, a11y Critical 0·Major 0·Minor 4(아래).

## 결정 표 (★ = 데모 기본 — 사용자 승인 전)

| # | 결정 | ★ 권고 | 대안 | 비고 |
|---|---|---|---|---|
| D1 | 버튼 위치·모양 | 라벨 줄 오른쪽 끝, 「말로 쓰기」 오른쪽 8px, 둥근 「가あ」 44px | 입력 칸 아래 44px 줄 | 이력서 ★ 그대로 |
| D1′ | 보이는 단계 | 표현 1단계에만 | 폼 단계에도 | **designer 추가**(이력서에 없던 하위 결정) |
| D2 | 판 형태 | 시트 안 인라인 패널(표현 칸 아래·[뜻 채우기] 위) | 하위 시트 | 이력서 ★ 그대로 |
| D3 | 질의 | 한국어 글자만(한글 1자↑·100) | — | 이력서 ★ + 한글 없음 문구를 단어 맥락으로 |
| D4 | 카드 | 일본어 20px + 한글 줄 + 뜻 + ▶ + [표현 칸에 넣기] · 첫 카드만 · 「왜」 숨김 | 모두 펼침 / 「왜」 보임 | 이력서 ★ 그대로(글자 크기 20 은 designer 가 정함) |
| D5 | 넣기 | 바꿔 넣고 닫기 → 표현 칸 초점, 뜻 채우기는 사용자 | [넣고 뜻 채우기] | 이력서 ★ 그대로 |
| D6 | 안내 플래그 | `kaiwa.talk.helperTipSeen` 공유 | 별도 플래그 | 이력서 ★ 그대로 |
| D6′ | 안내 모양 | 시트 안 줄 안내(라벨 줄 아래 끼움) | 떠 있는 말풍선 | **designer 추가** |
| D7 | 409 `PHRASE_BUSY` | 전용 문구 | 일반 오류(회화방과 같음) | 이력서 ★ 문구를 「다른 화면에서 … 찾는 중이에요. 끝나면 다시 물어봐 주세요.」로 구체화 |
| D8 | 공존 | 서로 닫기 + [뜻 채우기]·[직접 입력하기] 때 기다리는 요청 취소 | 함께 열림 | 이력서 ★ 에 「요청 취소」를 더함 |
| D9 | 읽기 표시 | 앱 표시 설정 따름, 뜻은 늘 | 읽기 늘 보임 | 이력서 ★ 그대로 |

**designer 가 바꾼 ★: 없음.** 새로 더한 하위 결정 2개(D1′·D6′)와 구체화 3곳(D4 글자 크기, D7 문구, D8 요청 취소)만 있다.

## 데모가 확인한 사실 (헤드리스 Chrome, 이 환경 글꼴 — [확실]은 이 측정에 한함)
- [확실] 라벨 줄(시트 본문 328/358/380px): 높이 44(한 줄) · 「말로 쓰기」 74px · 가あ 44px · 남는 폭 **179/209/231px**. 「글자로 쓰기」(말로 쓰기 열림) 167/197/219, 글꼴 130% 157/187/209 — 모두 한 줄.
- [확실] 360×780 + 키보드 모형 300px: 시트 본문 보이는 높이 356px, 패널 열림(빈 질의) 내용 약 492px → 본문 안 스크롤(질의 칸은 보임). 키보드 없을 때 본문 최대 611px.
- [확실] 자체 시험 1,209칸 가로 넘침 0 · 44px 미만 터치 0(칩·조각 칩·안내 ✕ 는 ::before 히트 44 로 제외).
- [확실] 공용 `Sheet` 가 `document` keydown 으로 Esc 에 시트를 닫는다(`Sheet.tsx:37`) → 패널 Esc 는 전파를 막아야 한다(가이드 30-6).
- [확실] 1단계가 `<form>`(제출 = 뜻 채우기)이라 패널 안에 form 을 두면 중첩·Enter 가 뜻 채우기를 부른다(가이드 30-11 가장 흔한 함정).
- [확실] 회화방 `helperFailureOf` 는 409 `PHRASE_BUSY`·상태 0 을 일반 오류로 본다 → 단어용 변환 함수를 따로 둔다(회화방 불변, L6).
- [가능성 높음] task-073 W-2 가 `WordMicField.tsx`·`labels.ts` 를 이미 고치는 중(오늘 09:24 developer 완료 기록) → 이 작업의 `WordMicField` 슬롯 추가는 073 머지 뒤.

## 자체 점검 (ui-design-reviewer · ui-accessibility-reviewer)
- 디자인 P0 0 · P1 0 · **P2 4**: ① 결과가 오면 다음 주 행동은 카드의 [표현 칸에 넣기]인데 GHOST 라 accent [물어보기]보다 약하다 — 회화방 카드와 같은 모양을 지키려고 수용 ② 키보드가 있을 때 패널 아래(예시 칩)는 본문을 밀어야 보인다(356 / 492px) — [물어보기]가 키보드를 내리므로 수용 ③ 처음 안내 줄이 흐름 안이라 닫을 때 표현 칸이 약 50px 올라간다(한 번뿐) — 떠 있는 말풍선은 ✕·입력 칸을 가려서 더 나쁨 ④ 라벨 줄에 밑줄 텍스트 버튼(말로 쓰기)과 둥근 아이콘(가あ)이 나란히 — 각자 원래 부품 모양을 지킨 결과, 수용.
- 접근성 Critical 0 · Major 0 · **Minor 4**: ① 보이는 글리프 「가あ」와 이름 「일본어 도우미」가 다름(WCAG 2.5.3 — 회화방과 같은 수용) ② [물어보기] 비활성이 흐림 + `aria-disabled`(누르면 안내 줄로 이유) ③ ▶ 이름에 일본어가 섞여 한국어 음성으로 읽힘(기존 패턴) ④ 패널이 DOM 상 표현 칸 뒤라 버튼 → Tab 이 표현 칸을 먼저 지남 — 열 때 초점을 질의 칸으로 옮겨 영향 작음, 보이는 순서와 같아 2.4.3 충족.

## Leader·사용자에게 묻고 싶은 것
- **Q1** D1′ 폼 단계에도 도우미를 둘까? ★ 1단계만(초안 뒤 표현을 바꾸면 읽기·뜻이 어긋남, WordForm 은 수정 시트 공용).
- **Q2** D7 — 409 `PHRASE_BUSY` 전용 문구(★) vs 일반 오류. 회화방 쪽은 그대로.
- **Q3** D6 — 공유 플래그면 회화방 안내를 이미 본 지금 사용자는 단어 시트 안내를 못 본다. 괜찮은가?(사용자가 직접 요청한 기능이라 영향은 작다고 봄 — [추측])
- **Q4** 찾는 중 [그만두기](회화방엔 없음, 브리프 요구) — 서버 입구가 요청 중단 신호를 엔진까지 넘겨야 한다(L1 사양 확인, Leader).
- **Q5** 한글 없는 질의를 화면이 먼저 막고 단어 맥락 문구를 쓰는 것(서버 `no_hangul` 400 문구 비노출) — 동의?
- **Q6(Leader)** 공용 `Sheet` 의 Esc 처리 — 패널 쪽 `stopPropagation` 으로 끝낼지, `Sheet` 가 `e.defaultPrevented` 를 보게 한 줄 더할지(공용 부품 — 다른 시트 회귀 확인 필요).
- **Q7(Leader)** 실행 순서 — task-073 머지 뒤 이 작업의 `WordMicField` 슬롯 추가(같은 파일).

## 확인 못 한 것
- 한 단어 질의가 사전형 표제어로 오는지(L4 — PE 실호출, 데모 승인 뒤).
- 실제 앱 WebView(약 390px)·안드로이드 키보드 높이에서의 시트 높이(§22-15 D 와 같은 기존 한계 — QA 실기기).
- 데모의 한글 줄(임빠꾸또·멘도-꾸사이 등)은 `speech/reading/client.ts` 규칙을 손으로 옮긴 값 — 실제는 #24r 분석 결과.

## 가이드 확정 (2026-10-17)

- [22:20] 사용자 데모 승인(v1, ★ 권고 그대로, sha256 `b84f9cdf…` — 데모 파일 무수정) 뒤 `docs/screens.md` §30 을 **확정 가이드**로 다시 썼다(줄 13403~13835, §30 밖 무변경 — 앞·뒤 구간 sha256 앞 16자가 편집 전후 같음 `f49fb826d19c7883`·`db02204d09de319e`). 읽은 것: §22·§31·데모 전체, [[task-072-rev-server-record]]·[[task-072-dev-server-record]] §3·api-contract #181, 코드(읽기만) `talk/{phraseHelperLogic,helperCopy,PhraseHelperButton,PhraseHelperCard,PhraseHelperPanel,usePhraseHelper,PhraseHelperTip}`·`vocab/{WordMicField,WordAddSheet,useWordMic,wordMic,labels}`·`common/Sheet`·`challenge/parts Skeleton`·`types/phraseHelp`·`next/dist/client/app-index.js`.
- 디자인 스킬: page-layout-designer·ui-component-builder·ui-accessibility-reviewer(가이드 문서 점검 — 데모 재점검 아님) / 가이드 기준 자체 점검 P0 0·P1 0·P2 1(꼬리표 없는 [다른 후보] 줄은 요약 칸이 빈다 — Q4), a11y Critical 0·Major 0·Minor 3(글리프≠이름 2.5.3 · ▶ 이름 언어 섞임 · 보낸 뒤 초점이 흐린 [물어보기]에 머묾 — 모두 기존 패턴 수용).

### 바꾼 것(초안 → 확정)
1. **talk 무수정 전환**(Leader 지시 「`src/components/talk/**` 읽기·재사용만」): 초안의 `PhraseHelperButton controlsId`·`PhraseHelperCard variant` 넓히기를 버렸다 → 카드는 `vocab/WordHelperCard` 새로, 패널 `<section>` id 는 `HELPER_PANEL_ID`(`talk-helper`) 재사용([확실] `WordAddSheet` 사용처는 `WordsScreen` 1곳이라 회화방 판과 겹칠 수 없다).
2. **#181 계약 반영**(REV-072S L-4): `items` 는 `{ja, ko}` 뿐 — 카드 꼬리표·「왜」 줄을 그리지 않고 [다른 후보] 요약 칸은 빈다.
3. **실패 분류**: talk `createHelperRequester` 는 그대로 쓰되 그 안 `settleHelper` 가 talk `helperFailureOf`(409 `PHRASE_BUSY`·상태 0 → 일반 오류)로만 분류한다 → 요청 함수 래퍼가 `wordHelperFailureOf` 로 먼저 분류해 지역 변수에 담는 방식으로 확정(talk 무수정, D7·오프라인 문구 살림). 400 은 사유별로 입력 안내(`required`·`no_text` → 빈칸, `max_length` → 100자, `no_hangul` → 단어 맥락 문구), `forbidden_char`·`secret_like` 만 서버 문구(맥락 중립, dev-server-record §3 과 같음).
4. **Esc 원인 정정**: [확실] Next 16 은 `hydrateRoot(document)` 라 React 리스너와 공용 Sheet 의 Esc 리스너가 같은 `document` 에 있다 → 초안의 `stopPropagation` 으로는 시트가 닫힌다. 처방 A = `Sheet` 한 줄 `!e.defaultPrevented`(Leader 확인), B = `stopImmediatePropagation`(등록 순서 의존).
5. **공용 `Skeleton` 사용 금지**: 블록이 `bg-surface2` 라 패널 바탕에서 안 보이고 마운트마다 새 status 를 만든다 → 로컬 104px `bg-surface` 블록 + 늘 마운트 sr 줄.
6. **막다른 길 없음 명시**: 정형 인사 502(서버 수정 전)·200 빈 목록(수정 후) 모두 질의 칸·표현 칸·[직접 입력하기]가 열려 있음을 30-11 ⑪·QA W9 로 고정. 화면 변경은 필요 없다.
7. **073 과의 맞물림**: 표현 라벨 줄 지금 구조(§31 이후)에 `trailing`·`afterLabel` 슬롯만. [확실] `mic.close('surface')` 는 말로 쓰기가 닫혀 있어도 073 확인 안내를 지운다(`micNoticeStep 'leave'`) → 도우미 열기 때는 `mic.target === 'surface'` 일 때만 부르고, [표현 칸에 넣기]는 `mic.edited('surface')` 로 안내를 거둔다.
8. **초점**: 보낸 뒤 `blur()` 대신 [물어보기]로 초점(대화상자 밖 Tab 누출 방지) — [가능성 높음] 안드로이드에서 키보드도 내려감, QA W14 실기기 확인.
9. **[뜻 채우기] 취소 시점**: 초안 「첫 줄」 → 「검증 통과해 뜻 찾기를 시작할 때만」(빈 표현으로 눌러 이유만 보이면 패널 유지 — 데모 동작과 같음).
10. **함정·시험 구체화**: 패널 안 `type="submit"` 이 하나라도 있으면 그 버튼이 폼의 기본 버튼이 되어 표현 칸 Enter 가 [물어보기]를 누른다(트리 순서) · [확실] jsdom 없음 → 처리기를 순수 함수로 꺼내 가짜 이벤트로 시험 + 정적 렌더 + 소스 스캔 + QA 브라우저(30-14).

### 데모와 다른 점
- **보이는 차이 1건**: 꼬리표·[다른 후보] 요약 없음(서버 계약 — 위 2). 새 요소·새 문구 0.
- 보이지 않는 차이: 위 3(400 두 사유 서버 문구)·4·5·8·9 와 빈 안내 줄 `empty:mt-0`(데모 CSS 는 `display:none` — 라이브 영역 유지). 상세 §30-16.

### Leader 에게 올리는 질문 (§30-16)
- **Q1** 공용 `Sheet` Esc 한 줄(A) 승인? 거절 시 B. 기본 A.
- **Q2** [그만두기] 직후(또는 회화방에서 묻다가 넘어온 직후) 409 `PHRASE_BUSY` — 서버 잠금은 취소된 요청이 AI 호출 줄에서 차례를 기다리던 중이면 차례가 올 때 풀려 몇 초간 「다른 화면에서 … 찾는 중이에요」가 뜰 수 있다. 기본 = 승인된 D7 그대로, 대안 = 자기 취소 직후 N초는 `error` 문구.
- **Q3** 빈 결과 힌트에 「…또는 위 표현 칸에 일본어를 바로 적어도 돼요」를 더할지 — 데모에 없는 새 문구라 기본은 데모 그대로(바꾸면 데모 vN+1 로 사용자 확인).
- **Q4** [다른 후보] 요약 칸에 나머지 후보 `ja` 를 보일지 — 기본 비움.
- **Q5** jsdom 개발 의존성 추가 — 기본 넣지 않음.
