---
task_id: task-064
title: "task-064 Designer 기록 — 무엇이든 물어보세요(/ask) 3a 데모 v1"
status: in_progress
tags:
  - type/task-note
  - domain/ask
aliases:
  - task-064 designer
created: 2026-10-12
updated: 2026-10-12
---

# task-064 Designer 기록

본 이력서: [[task-064-ask-anything-3a]] · 데모: `docs/demo/task-064-ask-anything-v1.html` (수정 요청) → `docs/demo/task-064-ask-anything-v2.html` (lint 통과, Leader 검토 요청 대기)

## Designer 기록
- [13:20] 착수. 읽은 것: task-064 이력서 전체, demo-review-gate.md, design-skills.md, design-spec §7-7·§8 A9, learning-personalization §3·§8 D2, api-contract #27~#32·§2-8(#37~#39)·§2-18·§6 ASK 행, screens.md §1·§2·§3-2(A~H)·§15(일본어 표시), globals.css(sha256 a314f18f1807), 기존 데모 task-055 형식, 현재 `/ask` = `ComingSoon` 11줄, `ChatMenuSheet`(삭제 = 방 ⋯ 메뉴 → 확인 단계).
- [13:22] 사실 확인: ① [확실] 채팅 목록 행(ChatListItem)에는 삭제가 없다 — 삭제는 방 안 ⋯ → [삭제] → 확인 단계(#31). 데모 목록도 이 패턴을 그대로 쓰고, 목록에서 바로 지우는 안은 D8 B 로만 둔다. ② [확실] 계약상 ASK 는 `audio` 이벤트가 없다(TALK 만) — 질문 방에 TTS 표시등·마이크 없음, 글자 입력만. ③ [확실] ASK `answerMd` 는 한국어 마크다운 ≤4,000자, `replyKo=null` → 번역 토글 의미 없음(일본어 예문 줄에만 히라가나·한글 층). ④ [확실] `sources[]` 는 `{type,id,date,label}` 만 — 출처 카드에 보일 수 있는 건 유형·날짜·라벨뿐(발췌 본문 없음). ⑤ [확실] SSE 는 `accepted→status(PROMPT|LLM|PARSE)→done|error`, 답 본문 증분 스트림 계약 없음 → "스트리밍 답변"은 단계 문구로 그리고 본문은 done 에 한 번에 보인다(D6 에 근거 기록). ⑥ [확실] 탭 바는 키보드가 열리면 숨는다(TabBar `data-kb`, task-021) — 키보드 상태 데모에 탭 바 없음. ⑦ [확실] 지금 `ProposalCard` 는 ADD_WORD·ADD_STUDY_LOG 두 종만 그린다 — ADD_TOPIC 은 새 모양, SET_LEVEL 은 평가 결과 `LevelCard`(EvalResult.tsx) 모양을 방 안 크기로 줄여 재사용. ⑧ `/drawer/corrections` 에 `?focus=` 복원 인자가 있어 교정 출처 이동 대상으로 쓸 수 있다(첫 쪽 밖 교정도 찾는지는 확인 필요).
- [13:35] 레이아웃 설계(page-layout-designer 7항목, 가이드 §25 앞에 옮길 초안):
  - 목표: 일본어 질문·내 기록 질문에 근거 있는 답을 받고, 근거를 눌러 원래 기록으로 가며, 제안은 골라서만 저장.
  - 위계: 목록 = ① 질문 입력(+예시) ② 지난 질문 / 방 = ① 답 본문 ② (LOW·기록 없음 한 줄은 답 맨 위) ③ 근거 카드 ④ 제안 카드 ⑤ 입력창.
  - 영역: 목록 `AppBar("질문")` · 입력 카드 · 예시 칩 · 지난 질문 목록 · 하단 탭 / 방 `BackBar` · 표시 바 · 메시지 목록(유일한 스크롤) · TurnNotice · Composer(탭 숨김).
  - 컴포넌트: 재사용 = BackBar·AppBar·Composer·TurnNotice·Sheet·Toast·ProposalCard(+ADD_TOPIC·SET_LEVEL)·JaText/HangulLine/DisplayBar·ChatMenuSheet 패턴·useChatTurn/sse. 새 것 = AskComposerCard·AskExamples·AskListItem·AnswerCard·AnswerMarkdown(화이트리스트)·ExampleBlock·SourceList/SourceCard·ScopeChips·ConfidenceLine·AskPending·ScopeNoticeSheet.
  - 상태: 목록(첫 방문·있음·로딩·오류·키보드) / 방(대기 3단계·도착·LOW·기록 없음·되묻기·제안 4종×4상태·시간 초과·답 불가·429·409·전송 실패·404·키보드·긴 답) / 시트(보내는 범위 처음·다시 보기, 메뉴·이름·삭제 확인·삭제 실패).
  - 행동: 주 = [물어보기]·[보내기] / 보조 = 예시 칩·되묻기 칩·근거 열기·더 보기·제안 채택/무시·[나가서 기다리기] / 위험 = 질문 방 삭제(확인 단계).
  - 반응형: 360 에서 예시 칩 줄바꿈(가로 넘침 0), 근거 카드 라벨 2줄 말줄임, 제안 버튼 두 줄로 내려감(`flex: 1 1 130px`).
- [13:52] 데모 v1 작성 `docs/demo/task-064-ask-anything-v1.html`(약 122KB, 인라인 CSS·JS, 토큰 = globals.css@a314f18f1807 값 고정, 라이트·다크). 상태 탭 11개(A 현재 vs 제안 · B 목록 5 · C 보내는 범위 2 · D 대기 4 · E 답과 근거 3 · F 확신도·기록 없음 3 · G 범위 되묻기 3 · H 제안 카드 3 · I 오류·제한 6 · J 키보드·긴 답 2 · K 방 메뉴·삭제 5) + 클릭 흐름(예시 칩 → [물어보기] → 안내 시트 → 대기 3단계 → 답).
- [14:05] 결정 패널 D1~D9(12개 선택 묶음), ★ 권고: D1 B(맨 위 입력 카드 + 예시 칩, 아래 지난 질문) · D2 범위 (b) + 안내 A(첫 질문 보낼 때 시트 한 번, 방 메뉴·입력 카드 링크로 다시 보기) · D3 A(답 아래 근거 3장 + [n개 더 보기]) · D4 A(LOW 일 때만 답 맨 위 한 줄, HIGH·MEDIUM 조용) · D5 A(고정 기간 칩 이번 주·지난 30일·전체 기간 + [직접 쓸게요]) · D6 표시 C(단계 문구 PROMPT→LLM→PARSE + 경과 초 + 30s·90s 안내) + 취소 X([나가서 기다리기], 서버 계속) · D7 A(답 → 근거 → 제안) · D8 제목 A(첫 질문 앞 30자 · 둘째 줄 = 마지막 답 첫 줄) + 삭제 X(방 ⋯ → 확인) · D9 A(예문 블록만 히라가나·한글, 뜻 줄 늘 보임, 표시 바 2개).
  - D9 근거(과제 지시와 다른 점): 과제 지시는 "번역도 앱 공통 스위치를 따른다"였지만, 예문 뜻 줄은 번역이 아니라 설명의 일부이고 번역 기본값이 끔이라 B 로 하면 뜻이 숨어 설명이 반쪽이 된다 → A 권고, B 는 선택지로 그대로 둠.
  - D6 근거: [확실] #32 SSE 에 답 글자 증분 이벤트가 없음 → "스트리밍 답변"은 그릴 수 없고 단계 문구가 유일한 진행 신호. 진짜 취소(Y)는 계약 없음 + task-056 교훈(직렬 CLI 줄)과 맞물려 QA 지연 실측 뒤 재검토.
- [14:15] 브라우저 실측(Playwright, 127.0.0.1 임시 서버 — 스크래치패드 사본): 11탭×세부 상태×3폭 가로 넘침 0, 44px 미만 터치 = 표시 바 토글 32px(가상 히트 44, 기존 DisplayToggles 와 같음)뿐, 결정 32안 전부 × 전 상태 렌더 1,184회 JS 오류 0, 흐름(칩→시트→대기→답, 두 번째는 시트 생략) 동작 확인, 사용자 화면 엔진명 grep 0. 수정 3건: `.sc` 클래스 충돌(근거 카드가 스크롤 영역을 grid 로 깨뜨림) → `.srcc`, 근거 라벨 1줄 → 2줄(360 에서 고친 문장이 잘림), 대기 경과 초를 `aria-hidden`(초마다 낭독 방지).
- [14:18] 디자인 스킬: layout·component (project-ui-system 미적용 — 학습 앱 화면) / 자체 점검 P0 0·P1 0(근거 라벨 잘림 P1 → 수정함)·P2 2(근거 순서는 서버 순서 그대로 · 하단 탭 비활성 글자 ink3 명암 미달은 기존 전역 이슈 §1-1, 이번 범위 밖), a11y Critical 0·Major 0(경과 초 반복 낭독 Major → 수정함)·Minor 2(데모 틀의 상태 탭 화살표 키 없음 · 데모 시트는 초점 이동을 그리지 않음 — 구현은 공용 `Sheet` 의 초점·Esc·복귀 규칙 그대로).
- [14:20] lint `DEMO_LINT_PASSED`(expect task-064-v1). sha256 `aba72aa7…`(Leader 가 검토 요청 때 다시 기록). Leader 에게 인계 — Artifact 게시·검토 요청은 Leader.

## 구현 때 영향 받는 곳 (추정 — 승인 뒤 screens.md §25 에서 확정)
- 라우트: `src/app/(app)/ask/page.tsx`(ComingSoon 교체) · 새 `src/app/(app)/ask/[chatId]/page.tsx` · `src/components/shell/routes.ts`(탭 숨김 경로 `/ask/[chatId]`).
- 새 `src/components/ask/`: AskHome · AskComposerCard · AskExamples · AskListItem · AskRoom · AnswerCard · AnswerMarkdown(굵게·목록·인용·문단 화이트리스트, React 요소로만) · ExampleBlock · SourceList/SourceCard · ScopeChips · ConfidenceLine · AskPending · ScopeNoticeSheet · askCopy.ts.
- 재사용·확장: `chat/{Composer, TurnNotice, useChatTurn, sse, ChatMenuSheet(+「보내는 범위 보기」 줄·ASK 문구), ProposalCard(+ADD_TOPIC·SET_LEVEL)}` · `common/{Sheet, Toast, ui}` · `common/japanese/JapaneseText(JaText, HangulLine, DisplayBar — ASK 는 keys ['fu','hg'])` · `shell/{AppBar, BackBar}` · 평가 `LevelCard` 모양.
- 서버·프롬프트 쪽(designer 범위 밖, Leader·PE·developer-S): 근거 유형 enum·이동 주소, 「기록 0건」 신호, 칩 답의 의도 분류, ASK `Chat.preview` = 마지막 답 첫 줄, ADD_TOPIC 페이로드 키, 예문 표기 규칙(인용 줄 + 뜻 줄).

## 열린 질문 (Leader)
1. 근거 `type` 값 목록과 `REVIEW`(복습 항목) 이동 대상 — 전용 상세가 없다. 데모는 `/study/today`(복습 카드). `/drawer/corrections?focus=` 가 첫 쪽 밖 교정도 찾는지.
2. 「관련 기록을 못 찾았어요」 줄 — 서버 신호(`conversation.records`) 추가 vs 프롬프트가 본문 첫 줄에 쓰기.
3. 되묻기 칩 답("지난 30일")의 의도 분류 — 직전 USER 질문과 합쳐 분류 vs #32 `scope` 인자. D5 C 를 고르면 `needsScope` 형태 변경.
4. ASK `Chat.preview` 를 마지막 답 첫 줄(평문 ≤60자)로 채울지(D8 A 전제).
5. 안내 확인을 기기별 localStorage(`kaiwa.ask.scopeNotice.v1`)로 둘지 — 스키마 변경 없이. 범위가 바뀌면 키 버전 올림.
6. 진짜 취소(D6 Y)는 턴 취소 계약이 필요 — 이력서 결정 3(지연 실측) 뒤 재검토 후보.

## v2 (현행화) — 사용자 검토 요청 2건 반영
- [14:40] 착수(v2). 읽은 것: 이력서 「사용자 추가 요청」·「Leader 결정」·「범위」, 이 기록, v1 데모 전체(1,247줄), demo-review-gate §5·§6, screens.md §8(푸시투토크)·§9-2 F(VoiceBar)·§9 상태표, `speech/sttCopy.ts`·`talk/VoiceBar.tsx`·`speech/PushToTalkButton.tsx`·`speech/MicLevelMeter.tsx`·`speech/onDeviceUpload.ts`·`speech/useRealtimeStt.ts` 머리, `modules/speech/stt/client/{capture,pcm,router}.ts` 머리, `utterances/limits.ts`, `prisma ChatMessage.inputSource`. 디자인 스킬 4종 Read. 토큰 해시 그대로 `a314f18f1807`(v1 과 같음). v1 은 손대지 않고 복사해 v2 를 만든다.
- [14:45] 사실 확인(설계 판단 근거): ① [확실] 브라우저 캡처(`capture.ts` getUserMedia→AudioWorklet)와 16kHz PCM16 변환(`pcm.ts Downsampler`)이 이미 있다 — 녹음 후 올리는 받아쓰기에 그대로 쓸 수 있고, 남는 일은 PCM 을 모아 wav 머리를 붙이는 것뿐. ② [가능성 높음] 앱 WebView 에서도 이 캡처가 동작한다 — `router.ts` 가 휴대폰 인식 시작 실패 시 「이번 누름을 서버로 이어 간다」(= WebView 의 브라우저 캡처 경로)고 적혀 있고 Manifest 에 `RECORD_AUDIO` 가 있다. 실기기 확인은 필요. ③ [확실] `ChatMessage.inputSource` 에 `SERVER_STT` 값이 이미 있다 — 「음성으로 물었어요」 표시는 #32 `inputSource:'SERVER_STT'`(utteranceId 없음)로 남길 수 있다(스키마 변경 없음, 계약상 SERVER_STT+utteranceId 없음 허용 여부는 Leader 확인). ④ [확실] 기존 발화 업로드 한도 60초·2MB, 16kHz 모노 16비트 = 초당 32KB → 30초 ≈ 0.96MB. ⑤ [확실] 기존 STT 문구에 「30초가 지나 자동으로 멈췄어요」(AUTO_STOPPED)·마이크 거부(웹/앱 두 벌)·「소리가 거의 들리지 않아요」(TOO_QUIET)가 있어 재사용한다. ⑥ [확실] 기존 회화 입력은 「누르고 있는 동안」(푸시투토크 72px)이다.
- [14:40] (이어받음 — 이전 designer 가 사용자 중단으로 멈춤) 점검: v2 파일(1,656줄·172KB)은 lint 통과 상태이고 v1 대비 diff 718줄. 들어 있는 것 = 대기 화면 버튼 제거(D 탭 s1~s3·list·arrived) · L 「음성 질문」 탭 19개 세부 상태(대기·카드·듣는 중·27초·글로 바꾸는 중·결과·섞어 말함·일본어·보낸 뒤·답 도착 / 권한 묻기·거부 웹·앱·너무 짧음·소리 없음·못 바꿈·연결 끊김·쉬는 중) · 실제로 도는 받아쓰기 흐름(타이머) · 결정 D1~D13 · 「내 선택 요약」 + 승인 문장 · 보내는 범위 시트의 음성 한 줄 · A 탭 「구현 단계(D13)」. 빠진 것 = ① 「나가서 기다리기」 글자 5곳(meta·v2 변경 상자·주석·D 캡션·D6 근거) ② 하단 탭 「오늘」(task-065 로 「공부」) + 답 예문 속 「‘오늘’ 탭」 ③ 실측 기록 없음(스크래치 `v2/check.js` 는 있으나 결과 미기록). 남은 헤드리스 크롬: 오늘 띄운 것 없음 — 9월 15일 bjj 쪽(`/tmp/bjj042i-*`)만 있어 건드리지 않음.
- [14:43] 바꾼 것: ① 「나가서 기다리기」 글자 5곳 → 0(「이탈 버튼(v1 이전 안)」으로 바꿔 씀 — meta·v2 변경 상자·주석·D 캡션·D6 근거) ② 하단 탭 = `TabBar.tsx` 라벨·아이콘 그대로(회화·**공부**·계획표·단어장·질문, 패딩도 `max(10px, safe-area)` 로 맞춤), 복습 답 「‘공부’ 탭의 복습 카드」, v2 변경 상자에 4번째 줄(메뉴 이름). 회화 홈 제목은 이 데모에 없음 ③ 「내 선택 요약」: D6 값에 「취소 버튼 없음」을 붙이고 [요약 복사]·[승인 문장 복사] 추가(클립보드가 막힌 보기 환경이면 글을 골라 두고 「길게 눌러 복사」 안내, 알림은 버튼 옆 `aria-live` 글 — 휴대폰 안 토스트는 결정 패널에서 안 보여서) ④ 근거 이동 주소: 복습 = 「/study/today (공부 탭 · 복습 카드)」, 상황 연습 = 상세 화면이 지금 없음을 표시, 계약 메모 ①에 확인 필요 2건 추가 ⑤ 초점 유지: `render()` 가 다시 그릴 때 초점 컨트롤(data-act·data-inp·결정 라디오)을 같은 자리로 돌려놓는다 — 실측에서 목록 카드 받아쓰기 [취소] 뒤 초점이 사라지던 결함(토스트 재그리기)을 찾아 고침.
- [14:46] 실측(Playwright 스크립트, file:// — 서버 없음, 스크래치 `v2/check2.js`): 상태 탭 12개 × 세부 상태 × 3폭 × 라이트·다크 116 화면 가로 넘침 0 · 결정 39안 × 전 상태 2,262 렌더 가로 넘침 0 · JS 오류 0 · 11px 미만 글자 0 · 화면 글(innerText)에서 「나가서 기다리기」 0 · 엔진·모델 이름(whisper·reazon·claude·sonnet·sherpa·qwen·vits·onnx 등) 0 · 하단 탭 라벨은 모든 렌더에서 「회화|공부|계획표|단어장|질문」 하나뿐 · 「오늘 탭」 문구 0. 흐름: 말로 묻기(🎤 → 듣는 중 → 日本語 칩 → [완료] → 글로 바꾸는 중 → 받아쓴 글·초점 입력창 → [↑] → 보내는 범위 시트 → 「음성으로 물었어요」 대기(이탈 버튼 0) → 답) · 목록 카드(듣는 중 → 받아쓴 글이 카드 입력창에 → [취소] 뒤 초점 = 카드 🎤) · D s1/s2/s3 버튼 0, s2·s3 안내 줄 확인 · 승인 문장(권고 그대로 / D10 C·D13 B 바꾸면 「(바꾼 것: D10 C 일본어만, D13 B 한 번에)」 / 되돌리기) · 복사(성공 / 클립보드 없음 → 글 258자 선택) · 결정 라디오 화살표 키 뒤 초점 유지. 세로 스크롤 2곳 = C 탭(보내는 범위 시트가 열린 상태: 시트 + 가려진 목록)뿐 — 모달 뒤 화면은 덮개에 가려 움직이지 않아 규칙 위반 아님(앱 공용 Sheet 와 같음). 44px 미만 = 표시 바 토글 32px·되묻기 칩 40px·언어 칩 40px — 셋 다 가상 터치 영역 44px(v1·지금 앱과 같음). lint `DEMO_LINT_PASSED`, 토큰 해시 `a314f18f1807` 그대로, v1 sha256 `aba72aa7…` 그대로(손대지 않음). v2 sha256 `8b899402acad…`(175,877B). 띄운 브라우저는 스크립트 `finally` 에서 닫음 — 끝난 뒤 1시간 안에 뜬 크롬 프로세스 0.
- [14:47] 디자인 스킬: ui-design-reviewer·ui-accessibility-reviewer(이번에 Read — 이전 designer 가 4종 Read) / 자체 점검 P0 0·P1 0·P2 3(받아쓰기 판이 360 에서 약 235px 를 차지 — 듣는 동안 답을 위로 밀어 읽게 됨, 수용 · 시트 열린 상태 스크롤 2곳 = 모달 · 예문 ▶(D12 B)는 예문 블록에 44px 열을 더한다 — 360 가로 넘침 0 만 확인, 줄바꿈 변화는 재 보지 않음), a11y Critical 0·Major 0(초점 사라짐 Major → 고침)·Minor 2(데모 시트는 시트 안으로 초점을 옮기지 않음 — 구현은 공용 `Sheet` 규칙 · 가상 터치 영역 3종).
- [14:48] D10~D13 권고·근거:
  - **D10 ★ A 언어 칩 [한국어|日本語] 고정**(마지막 고른 언어 기억, 처음 한국어) — [확실] 서버 받아쓰기 설정이 「일본어 고정·자동 감지 끔」인 이유가 섞인 말 오인이다(`fasterWhisper.provider.ts` `runtime.language` = 'ja', 설명 「언어 고정(자동 감지 끔)」). 자동 감지(B)는 그 이유를 거스르고, 일본어만(C)은 요청의 절반(한국어로 상황 설명)을 못 한다. 받아쓰기는 [완료] 뒤에 하므로 듣는 중에 칩을 바꿔도 되고, 잘못 골랐으면 방금 녹음을 [다른 언어로 다시 받아쓰기].
  - **D11 ★ A 받아쓴 글을 입력창에 채움 → 확인·고친 뒤 보내기** — [추측] 한국어 품질 미실측. 잘못 들은 질문이 가면 최대 120초 기다린 뒤에야 안다. 누름 1번이 그 비용보다 싸다.
  - **D12 ★ A 이번엔 글자 답만** — 요청에 없는 기능이고, 질문 턴엔 소리 이벤트가 없어 예문마다 #23 합성·재생 상태·🎤 와의 겹침 규칙이 새로 든다. B 를 고르면 예문 블록에 ▶ 44px.
  - **D13 ★ A 글자 질문 먼저 → 음성은 같은 task 2단계** — 글자 ASK 는 새 서버 경로 없이 되지만, 한국어 말로 묻기는 짧은 받아쓰기 경로 + 한국어 품질·걸리는 시간 실측이 먼저다. 한 번에(B) 내면 그 실측이 글자 질문까지 늦춘다.
- [14:49] 구현 영향(음성 2단계 — 추정 포함):
  - 서버(새 경로): 녹음 wav 16kHz 모노 ≤30초·≤1MB + `language: ko|ja` → `{text, language, durationMs}` 동기 응답(목표 3~10초, 20초 넘으면 시간 초과). [확실] 지금 언어는 엔진 설정 키 하나(`runtime.language`, 소비자 PYTHON)라 **요청마다 언어를 넘기는 인자**를 어댑터·받아쓰기 서비스 호출에 새로 내야 한다(L5 adapter + `speech/common` — 엔진명은 그 층에만). [확실] 지금 분석 받아쓰기는 `SpeechJob` 큐(비동기)뿐이라 동기 경로가 없다. 원음은 저장하지 않음(Utterance 행·파일 없음, 메모리에서만), `RequestTrace`·로그에 받아쓴 글도 남기지 않음. 사용자당 동시 1건·분당 상한. [가능성 높음] 받아쓰기 서비스는 VoiceVault 와 함께 쓰는 것이라(127.0.0.1:8090) 그쪽 작업과 겹칠 때의 지연을 실측해야 한다.
  - 계약: #32 `inputSource:'SERVER_STT'` + `utteranceId` 없음 허용을 명시(지금 표는 「utteranceId 없는 REALTIME_STT 는 400」만). 받아쓰기 오류 코드 → 화면 문구(권한·짧음·소리 없음·못 바꿈·연결·쉬는 중) 표. 보내는 범위 안내 키 `kaiwa.ask.scopeNotice.v1` → 음성 출시 때 `v2`(음성 문장이 더해져 한 번 더 보이게).
  - 화면(앱 WebView 마이크): [확실] 브라우저 캡처 `capture.ts`(getUserMedia → AudioWorklet, 제스처 안에서 `prepare`)와 `pcm.ts` 16kHz 변환이 있다 — PCM16 을 모아 wav 머리만 붙이면 된다. [가능성 높음] 앱 WebView 에서도 이 캡처가 쓰인다 — `router.ts` 가 휴대폰 인식 시작 거부 시 「이번 누름을 서버로 이어 간다」(= WebView 브라우저 캡처 경로). 실기기 확인 필요, 마이크 권한은 이미 있어 APK 재빌드 없음 [가능성 높음]. 회화의 푸시투토크·`useRealtimeStt` 는 고치지 않는다(받아쓰기는 「누르고 있기」가 아니라 「눌러서 시작 → [완료]」). 문구는 `sttCopy`(마이크 거부 웹/앱·30초 자동 멈춤·소리 작음) 재사용, 레벨은 `MicLevelMeter`.
- [14:50] 열린 질문(Leader):
  1. **나가는 길** — Leader 지시는 「상단 뒤로·하단 탭」이지만 질문 방은 채팅 방처럼 하단 탭을 숨긴다(v1 설계, `routes.ts` 탭 숨김 경로). 데모는 「‹·안드로이드 뒤로 → 목록(여기서 하단 탭)」으로 적었다. designer 권고 = 숨김 유지(입력 바·키보드 높이 예산, 채팅과 같은 규칙). 방에서도 탭을 보이려면 vN+1.
  2. 근거 유형 — 평가 결과 상세(`/study/today/eval/[id]`)가 있는데 Leader 목록에 `EVALUATION` 이 없다(데모 H 탭 레벨 답이 씀) → 추가할지. `SCENARIO` 는 상세 화면이 없다(`/study/ai/scenario/[id]` 는 edit·variant 만) → 이동 대상을 정해야 함.
  3. 받아쓰기 경로 계약(경로·오류 코드·한도·요청별 언어 인자)과 한국어 품질 실측 방법(표본·합격선)을 누가 언제 정하나 — D13 A 의 2단계 착수 조건.
  4. D10 C 를 고르면 실시간 경로를 「저장하지 않는」 방식(점검용과 같은)으로 ASK 에 열어야 한다 — 계약 확인.
