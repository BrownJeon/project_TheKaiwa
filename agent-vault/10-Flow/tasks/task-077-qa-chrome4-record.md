---
task_id: task-077
role: qa
tags:
  - type/task-record
  - domain/speech
  - domain/conversation
---
# task-077 QA 기록 — 공용 입력 부품 회귀(chrome4, 헤드리스 Chrome)

범위: `VoiceBar`·`Composer`·`usePhraseHelper`·도우미 판/카드/문구가 회화방·질문 탭·역할극·단어 추가 도우미에서 변경 전과 같은지 실브라우저로 확인. 코드 수정 없음.

## 환경·재현 조건 (데모 검토 게이트 §시각 검증)
- 서버: QA `http://127.0.0.1:3011`(APP_ENV=LOCAL, 최종 빌드), 계정 QA2 만. 운영 포트·DB 직접 접속·서버 조작 없음.
- 브라우저: Playwright(playwright-core) + `/usr/bin/google-chrome` headless `--no-sandbox`. locale ko-KR, timezone Asia/Seoul, deviceScaleFactor 2.625, 라이트(다크 1벌은 별도 표기), 글자 크기 130% = `documentElement.style.fontSize='130%'`(로드 뒤), 애니메이션 비활성은 안 함(전환 대기 300~500ms 로 대신), 폰트는 시스템 글꼴(외부 요청 0).
- 모바일 컨텍스트 `isMobile:true, hasTouch:true`(pointer: fine=false) / 데스크톱 컨텍스트 `isMobile:false, hasTouch:false` 1280×800(pointer: fine=true).
- 높이 892, 폭 360·390·412. 비교 기준: HEAD 코드(TalkRoom.tsx 는 변경 없음)·`docs/screens.md` §22·§26.
- QA2 프로필(시작 시점, 변경하지 않음): level N5, politeness POLITE, goalLevel null, dailyWordCount 10, dailyMinutes 15, strictness STRICT, correctionMode FLUENCY, explainLang ko, showFurigana true, showHangul true, showTranslation false. 진행 중 챌린지 없음(조회 404).
- 만든 대화(QA2, 지우지 않음): TALK `cmvdwjbx60007w1pblbran4f2`·`cmvdwpecf0031w1pbydqzpdp9`·`cmvdwqs0m003bw1pbef2swelh`·`cmvdwsfft003nw1pb75n6nkky`·`cmvdwu6470049w1pbsltl9bv8`, RP `cmvdwjd99000dw1pbigm2roq3`, ASK `cmvdwje49000hw1pbded1d5v0`, CHAT `cmvdwjfaq000jw1pbmphpx91s`.
- LLM 슬롯: 시작 때 `ps` 에 서버 소속 `claude --print` 1건(방 만들기 예열로 추정)이 있었으나 호출은 한 번에 하나씩만 했다.
- 스크립트·스크린샷: `scratchpad/qa077-chrome4/`(s1-matrix·s2a-flow-mobile·s2b-desktop·s2c-toast …). 스크린샷은 판정 뒤 삭제 예정.

## 판정표 (진행 중 — 항목 끝날 때마다 갱신)

| 항목 | 판정 | 근거(측정·관찰) |
|---|---|---|
| R1 말 모드 하단 바 배치 | PASS | 360/390/412 × 100/130% 12조합 모두 ⌨ 왼쪽 16px·누르고 말하기 72×72 가운데·도우미 「가あ」 우측 끝(오른쪽 여백 16px, 130% 는 21px)·상태 줄 `#talk-status` 높이 24px(130% 31px)·PTT `aria-describedby=talk-status`. 가로 넘침 0·페이지 세로 스크롤 0 |
| R1 도우미 터치 대상 | PASS | 도우미·⌨·🎤·보내기 모두 44×44(130% 에서 57×57) |
| R1 글자 모드 입력 영역 | PASS | 🎤 12px·도우미·입력창·보내기 「보내기」 44×44 한 줄, 입력창 높이 100% 44~92px·130% 57~136px, 가로 넘침 0 |
| R1 안내 말풍선 | PASS | `kaiwa.talk.helperTipSeen` 지운 뒤 첫 방문에 「한국어로 물어보면 일본어로 알려 줘요」(role=note, `#talk-helper-tip`)가 도우미 버튼 위(rect 178,715 196×52 — 버튼 top 826)에 뜨고 버튼 `aria-describedby=talk-helper-tip`, 저장값 '1'. 새로고침하면 말풍선·describedby 없음 |
| R1 도우미 열기·결과 카드(말 모드) | PASS | 판 열림(390: 0,677 390×215)·`aria-expanded=true`·`aria-controls=talk-helper`, 입력칸 placeholder 「예: 목이 쉬었어요」(회화방용), 「목이 쉬었어요」 질의 → #180 호출 1회 → 「표현 1개를 찾았어요」·喉がかれました…·한글 발음·뜻·이유. **말 모드에 「입력창에 넣기」 0개** |
| R1 닫기 | PASS | Esc·✕ 모두 판 닫힘, 초점이 「일본어 도우미」 버튼으로 복귀 |
| R1 글자 모드 [입력창에 넣기] | PASS | 칩 「천천히 말해 주세요」 클릭 → 결과 2개(표현 2개·「다른 말투 1개 더 보기」)·「입력창에 넣기」 클릭 → 입력창 값 「ゆっくり話してください。」·판 닫힘·초점 「메시지 입력」, 칩은 결과가 있으면 사라지고 입력칸 비우면 돌아오는 기존 동작 |
| R1 초안 저장·복원 | PASS | `sessionStorage kaiwa.chat.draft.<id>` 에 입력창 값 저장 → 새로고침 후 글자 모드로 자동 복원(값 동일), 보내면 입력창·저장값 모두 비워짐 |
| R1 모바일 Enter = 줄바꿈 | PASS | pointer: fine=false 컨텍스트에서 Enter → 줄바꿈 삽입·POST 0건(전송 안 됨) |
| R1 데스크톱 Enter = 전송 | PASS | pointer: fine=true: Shift+Enter → 줄바꿈·POST 0건, Enter → `/turns` POST 1건·입력창 비워짐 |
| R1 보내기·AI 답 | PASS | 보내기 버튼 → `/turns` POST → 선생님 답(일본어+한글 발음) 도착, 입력 영역 복귀 |
| R1 내 말 번역 토글 | PASS | 모바일 390: 내 말풍선 「번역 ▾」(46×44) 클릭 → `aria-expanded` false→true·「번역 ▴」·한국어 뜻 「안녕하세요. 처음 뵙겠습니다.」 표시, 다시 누르면 접힘. 이 시점 POST 는 `text/annotate`(로드 때)뿐이고 #32t 재요청은 없음(주석 응답에 번역이 이미 있음) — **토글 동작만 확인, #32t 「다시 가져오기」 경로는 NOT_VERIFIED**. (QA 스크립트가 처음엔 상단 표시 칩 「번역」을 눌러 QA2 `showTranslation` 을 false→true 로 바꿨다 → 끝에 복구, 아래 「정리」) |
| R1 ■ 선생님 말 멈추기 | PASS | 데스크톱 1280, 말 모드·선생님 말하는 중: ■ 가 마이크 오른쪽 12px(688,734 44×44), 도우미는 우측 끝(1220), ⌨ 왼쪽(16). 상태 줄 「선생님이 말하는 중 · 누르면 멈추고 말해요」 |
| R5 토스트 바닥(턴 중 도우미 잠금) | PASS | 보낸 직후 도우미 `aria-disabled=true`, 누르면 토스트 「선생님이 답하는 중에는 열 수 없어요」(role=status). 바닥 거리 글자 모드 **84**·말 모드 **136**(390×892) — 불변 |
| R7 레슨 전용 문구 누출 | PASS | 회화방·역할극·글자채팅 12조합 본문에서 「일본어로 써서 답해 보세요」「확인하기」「소리 멈추기」「답을 확인하는 중에는 열 수 없어요」 0건, 엔진·모델명 0건 |

| R1 글자채팅(CHAT) 입력 | PASS | 390/412/360 × 100/130: 입력창+보내기 한 줄(보내기 44×44, 130% 57×57), 도우미·🎤 없음(기대대로), 모바일 Enter=줄바꿈(POST 0)·데스크톱 Shift+Enter=줄바꿈, 초안 키 `kaiwa.chat.draft.<id>` 에 저장. 데스크톱 Enter 전송은 TALK 와 같은 `enterSubmits` 경로라 CHAT 에서는 직접 안 눌러 봄 |
| R1 도우미 문구가 회화방용 | PASS | 회화방 placeholder 「예: 목이 쉬었어요」·칩 「목이 쉬었어요/천천히 말해 주세요/다음에 또 가고 싶어요」·못 찾음 안내 「예: ‘천천히 말해 주세요’」(모의 `items:[]`)·오류 「지금은 표현을 가져오지 못했어요. [다시 시도]」(모의 502). 레슨용 문구(「주말에 친구를 만났어요」 등) 0건 |
| R1 도우미 aria | PASS | 버튼 `aria-label=일본어 도우미`, `aria-expanded` false/true, `aria-controls=talk-helper` 는 열렸을 때만, `aria-describedby=talk-helper-tip` 은 말풍선이 보이는 동안만(글자 모드·새로고침 뒤 없음), 턴 중 잠금 `aria-disabled=true`. 초점 순서 말 모드 ⌨ → 누르고 말하기 → 도우미, 글자 모드 🎤 → 도우미 → 메시지 입력 → 보내기(화면 순서와 같음) |
| R2 질문 탭(`/ask?chat=<id>`) | PASS | 글자 모드가 기본 진입. 말 모드(「말로 묻기」→): 하단 바 padding 위 8·아래 8(safeBottom=false)·옆 16·위 테두리 1px, 상태 줄 `#talk-status` 높이 24px(130% 31px)·「누르고 있는 동안 일본어로 말해요」, ⌨ 이름 「글자로 묻기」 44×44 x=16, 도우미 버튼 0개(두 모드 모두). 글자 모드 「질문 입력」+「보내기」 44×44(130% 57×57), placeholder 「이어서 물어보세요」. 360/390/412 × 100/130 가로 넘침 0·페이지 세로 스크롤 0. 육안: 캡션·큰 마이크·띠(「내 학습 기록 일부가 AI 에 보내져요 자세히」)·하단 탭 순서 정상 |
| R2 한 번 질문(LLM 1회) | PASS | 모바일 Enter → 줄바꿈(POST 0), 보내기 버튼 → `/turns` 1건 → 답(「はじめまして」 설명·예문·뜻) 도착, 입력창·초안 비워짐 |
| R3 역할극(RP) 도우미 | PASS | 말 모드: 판 열림·placeholder 「예: 얼음 적게 해 주세요」·칩 「얼음 적게 해 주세요/빨대는 필요 없어요/여기서 마실게요」·결과 2개(「더 부드럽게」 다른 말투)·**「입력창에 넣기」 0개**. 글자 모드: 질의 → 결과 → 「입력창에 넣기」 → 입력창 「ストローは大丈夫です。」(RP placeholder 「새 수강생으로 할 말을 …」 유지)·판 닫힘 → 보내기 → `/turns`·답(대답 힌트 카드 포함). 못 찾음 안내 예 「얼음 적게 해 주세요」·오류 문구 회화방과 동일 |
| R3 마친 방 | PASS | #167 finish 200 뒤 #180 → **409 ENDED**(메시지 「마친 역할극이에요.」). 화면: 도우미 버튼 0·판 0·누르고 말하기 0·입력창 0, 「이 역할극은 마쳤어요 · 결과 보기 · 다시 하기」 띠. 360/390/412(130%) 넘침 0. 열려 있던 판이 ENDED 로 닫히는 라이브 전환은 NOT_VERIFIED |
| R4 단어 추가 도우미(#181) | PASS | 360/390/412 × 100/130: 시트 안 「가あ」 44×44(130% 57×57)·안내 말풍선(`wadd_helper_tip`)·열면 `aria-expanded=true`·`aria-controls=talk-helper`, 입력칸 placeholder 「예: 임팩트, 어색하다」·칩 3개. 390 흐름: 「임팩트」+Enter → 「표현 1개를 찾았어요 インパクト [임빠꾸또] 강한 영향이나 효과」 → 「표현 칸에 넣기」 → 표현 칸 값 「インパクト」·안내 「표현 칸에 ‘インパクト’를 넣었어요」·**저장성 POST 0건**(채우기만) → 도우미 다시 열고 Esc → 판만 닫히고 시트 유지. 429 문구는 한도에 안 걸려 미확인 |
| R5 가로·세로·터치(전 폭×글꼴) | PASS(하단 입력 영역) / OBSERVED(그 밖) | 회화방·역할극·질문·글자채팅·단어 시트 전 조합 `hscroll=false`·페이지 세로 스크롤 0. 하단 입력 영역·도우미 판 안 버튼(⌨·🎤·도우미·보내기·물어보기·✕·카드 버튼)은 100% 44px↑. 판 최대 높이 320px(46dvh 한도)·안쪽 세로 스크롤은 판 하나뿐, 판은 흐름 안에 있어 본문을 덮지 않음(본문이 줄어듦). 아래 「관찰」 O2 참고 |
| R6 스크린샷·다크 | PASS | 총 89장(회화방 말·글자·판·결과, 질문 탭 말·글자·답, 역할극 판·결과·마친 방, 단어 시트·판·결과·채움, 360/390/412 × 100/130% + 다크 360 3장). 다크: body `rgb(20,24,22)`·판 배경 `rgb(29,35,32)`·글자색 `rgb(236,239,233)` 로 반전, 입력창·결과 카드·주 버튼 모두 읽힘(육안). 결과 카드 레이아웃은 #180 응답을 모의해 폭×글꼴×다크 15조합 측정(실제 LLM 은 390 흐름에서 호출) |
| R7 콘솔·네트워크·누출 | PASS | 정상 흐름 스크립트 전부 콘솔 에러 0·페이지 오류 0·외부 호스트 요청 0(`requestfailed` 는 라우터 프리패치 `_rsc` ERR_ABORTED 뿐). 에러 콘솔 6건은 의도한 모의 502·잘못된 방 id(404) 검사에서만. 본문 텍스트에서 레슨 전용 문구 4종 0건·엔진·모델명(reazon/whisper/style-bert/sherpa/claude/…) 0건(회화방·역할극·질문·단어 시트) |

## 관찰(결함 아님·이번 변경 무관)
- **O1 (Low, 기존 동작)** 도우미 칩을 눌러 결과가 나오면 칩 버튼이 사라져 초점이 `body` 로 떨어지고, 이때 Esc 는 판을 닫지 않는다(`closeOnEscape` 가 판·버튼 안 초점에서만 동작). 입력칸에 초점을 주고 Esc 하면 닫히고 초점이 도우미 버튼으로 돌아온다. `PhraseHelperPanel`·`PhraseHelperButton` 은 이번 변경 파일이 아니라 변경 전과 같다.
- **O2 (Low, 기존 동작)** 44px 미만: 도우미 예시 칩 36px(100%)·표시 칩 「히라가나/한글/번역」 32px·「선생님 목소리 상태」 칩 16px·역할극 「마치기」 36px·「체크 보기」 32px·질문 탭 「지난 질문」 36px·범위 줄 32px·글자채팅 「표현 점검」 34px·안내 말풍선 「닫기」 28px(`before:-inset-2` 확장 여부 미측정). 전부 이번에 바뀐 `VoiceBar`/`Composer`/`usePhraseHelper`/도우미 문구 밖의 요소다. 글꼴 130% 에서는 대부분 42~47px.
- 못 찾음 상태 본문에 「이 말에 맞는 일본어를 찾지 못했어요.」 가 두 번 읽히는 것은 화면 글 한 줄 + 판 안 `role="status" sr-only` 낭독 줄(`PhraseHelperPanel` 283행)이라 정상.
- 도우미가 있을 때 판이 열려 있어도(입력칸 초점 없음) 하단 입력 영역이 판 아래에 같이 보이고, 360px·130% 에서 글자 모드 입력창이 126px 폭으로 줄어 placeholder 가 4줄로 접힌다 — 변경 전 레이아웃과 같은 `TalkRoom`(변경 없음)의 배치.

## NOT_VERIFIED (사용자 육안·실기기 확인 필요)
- 말 모드 실제 녹음·STT 인식(마이크 없음) — 누르고 말하기 누름·뗌·barge-in, 도우미 판이 열린 채 녹음 시 잠금.
- IME 조합 중 Enter 무시(Playwright 로 조합 입력을 재현하지 않음 — 코드 시험 `enterSubmits` 에 의존), 안드로이드 앱 키보드 가림·상태바 겹침·TalkBack 낭독.
- 도우미가 열린 상태에서 방이 ENDED 로 바뀌는 라이브 전환, #32t 「다시 가져오기」 재요청, 429 한도 문구.
- 레슨(오늘의 회화 ⑤) 화면은 이번 라운드 범위 밖.
- 변경 전 빌드와의 픽셀 비교는 못 함(HEAD 빌드를 띄우지 않음) — 비교 기준은 변경 없는 `TalkRoom` 상수(토스트 84/136)·`docs/screens.md` §22·§26 수치.

## 지표·측정 요약
- 실호출(스크립트 재실행 포함 대략치): 도우미 #180 8회·`/turns` 6회(회화 5·질문 1)·단어 도우미 #181 1회, 429·오류 응답 없음(오류·못 찾음 화면은 모의 응답으로 확인). LLM 호출은 한 번에 하나씩(스크립트 순차), 호출 지연 p50/p95 는 이번 범위(회귀 확인)에서 측정하지 않음.
- 토스트 바닥 거리: 글자 모드 84px·말 모드 136px(390×892, 턴 중 도우미 잠금 토스트).

## 정리
- QA2 프로필: 시작값(level N5·politeness POLITE·goalLevel null·dailyWordCount 10·dailyMinutes 15·strictness STRICT·correctionMode FLUENCY·explainLang ko·explainDepth NORMAL·showFurigana true·showHangul true·showTranslation **false**)과 끝값이 14개 필드 모두 같다(중간에 스크립트가 표시 칩 「번역」을 눌러 showTranslation 이 true 가 된 것을 `PUT /settings/profile {showTranslation:false}` 로 복구, `updatedAt` 만 바뀜). 진행 중 챌린지 없음.
- 띄운 서버·프로세스 없음(Leader 의 3011 만 사용). 헤드리스 Chrome 잔류 0, 3012·8197 리슨 0.
- 만든 대화 TALK 약 7개·RP 3개(`cmvdwjd99000dw1pbigm2roq3` 은 #167 로 마침, 나머지 2개는 진행 중)·ASK 1·CHAT 1 은 QA2 에 남김(위 환경 절의 id 목록은 일부). 스크린샷 89장은 판정 기록 뒤 삭제 완료(`산출물 정리: 89개 삭제`, 스크립트·JSON 은 scratchpad `qa077-chrome4/` 에 남김).

## 판정
**결함 0건(Critical/High/Medium/Low 없음), 관찰 O1·O2 는 변경 전부터 있던 동작.** 공용 입력 부품의 기본값 경로(회화방·질문 탭·역할극·글자채팅·단어 도우미)는 변경 전 서술과 측정치가 같고, 새 prop 은 레슨 외 화면에 새지 않음.
