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

본 이력서: [[task-064-ask-anything-3a]] · 데모: `docs/demo/task-064-ask-anything-v1.html` (작성 중)

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
