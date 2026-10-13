---
tags:
  - type/review
  - domain/ask
  - domain/speech
task: task-066
reviewer: REV-066-U2 (음성 질문 구현 U2 몫 — 공용 4부품 선택 확장·useAskInput 말 모드)
status: 완료 (PASS_WITH_NOTES)
---
# REV-066-U2 — task-066 U2(음성 질문) 독립 감사

대상: `ask/{useAskInput.tsx,voiceView.ts,askVoiceCopy.ts,voiceBubble.ts,AskQuestionBubble.tsx}` · `speech/PushToTalkButton.tsx` · `talk/{VoiceBar,LiveUtteranceBubble,UnsentBar}.tsx` · `types/ask.ts` · 시험. 개발자 기록 [[task-066-dev-u2-record]]. 검증은 전용 미러 `~/.node-local/thekaiwa-dev066u2` 에서만(시작 시 `diff -rq src tests` 0). 작업 트리·docs 수정 0.

## 중간 기록 (약 25턴 시점)

### 확인 끝난 항목
- **1(a) 회화 불변 — 독립 재생성 OK**: 미러에 `git show HEAD:` 로 4부품의 **HEAD 판**을 임시 복사(`src/__rev_u2_head/`, 끝에 제거)해 새 판과 같은 입력으로 `renderToStaticMarkup` 비교 → 186케이스(PushToTalk 5상태×disabled3×describedBy2×label2=60, 말 바 8뷰×db3×trailing2=48, 부분 말풍선 18, 보내지 못한 말 5사유×서버문구3×글2×(blockedUntil null·미래)=60) **차이 0**. 같은 HEAD 판 출력이 고정 JSON 21종과도 21/21 일치(= 고정 JSON 은 확장 전 코드 산출물이 맞다).
- **1(b) 호출처**: `PushToTalkButton` 호출 = MicTestCard·StageApply·StageSpeak·EvalItems·VoiceBar, `VoiceBar`=TalkRoom·useAskInput, `LiveUtteranceBubble`=TalkRoom·useAskInput, `UnsentBar`=TalkRoom·useAskInput. `cancelOutside|safeBottom|keyboardLabel|textOf=|canResend=|caption=|out=` 의 질문 전용 prop 은 `useAskInput.tsx` 밖 호출처에 **0건**(grep).
- **2 음성 미저장 — 3곳 직접 읽음, 맞다**(상세는 최종 판정 절).

### 중간 2 (약 37턴 시점)
- **기존 시험**: 미러(= 작업 트리와 `diff -rq src` 0)에서 `components/{ask,talk,speech,chat,lesson,eval,shell}` 646건 **646/646 통과**.
- **음성 미저장(Q-2) 직접 읽기 결과**: gateway `connection.py:325`(TURN 일 때만 `_persist`)·`:184`(TURN 일 때만 저장소 요구)·`write_wav` 호출자는 `store.py:56` 하나(`write_incoming`)이고 그 호출은 `connection.py:396`(`_persist`) 하나 → 서버에 MIC_TEST 는 wav·발화 행을 만드는 경로가 없다. 앱: `OnDeviceSttClient.ts:147` `saveWav: o.purpose==='TURN'` → 플러그인 `SttSession.kt:282` 가 `opts.saveWav` 일 때만 `wavStore.save`, 플러그인에서 wav 를 쓰는 곳은 `SherpaSttPlugin.kt:421-425` 하나(`WavWriter.write`), 업로드는 `OnDeviceSttClient.ts:289` 가 TURN 이 아니면 null. 질문이 넘기는 용도 = `useAskInput.tsx:157` `purpose:'MIC_TEST'`·`chatId` 없음. 폴백(`router.ts:223/237/264`)은 같은 `BeginOptions` 를 넘긴다.
- **발견 후보**(최종에 ID 부여): ① `PushToTalkButton.onPointerDown` 이 `g.out=false` 만 하고 `setOut(false)`/`onOutChange(false)` 를 안 해, 밖에서 누른 채 버튼이 비활성(30초 자동 멈춤 등)이 돼 pointerup 이 못 오면 다음 누름에서 「밖」 표시가 남을 수 있음(Low, 실기기 확인 필요). ② 30초 자동 멈춤 뒤 밖에서 떼면 이미 보낸 말에도 토스트 「보내지 않았어요」(Low). ③ 질문 탭은 글자 모드에서도 `useRealtimeStt`·`useSpeechConfig`(#19 GET)를 늘 마운트(Info).

## 최종 판정: PASS_WITH_NOTES — Critical 0 · High 0 · Medium 1 · Low 2 · Info 4

검증은 전용 미러 `~/.node-local/thekaiwa-dev066u2` 에서만. 끝에 `diff -rq src tests` 0·`*.orig/*.rej` 0·잔존 프로세스 0(스크래치 `src/__rev_u2_head/`·`speech-rev/` 제거 확인). 작업 트리·docs 수정 0, 실제 `claude` 0회, 운영/dev/gateway 포트·build/dev 미사용. 게이트: tsc `--noEmit --incremental false` exit 0 · eslint(`components/{ask,talk,speech}`·`types/ask.ts`) 0 · 시험 `components/{ask,talk,speech,chat,lesson,eval,shell}`+`onDeviceStt` 661 중 661 통과(원본), gateway `test_ws.py` 36 통과.

### 항목별 결과
1. **회화·수업·평가·마이크 테스트 불변 — OK(독립 재생성).** (a) HEAD 판 4부품을 `git show HEAD:` 로 미러에 임시 복사해 같은 입력(186케이스)으로 비교 → 차이 0, HEAD 판 출력이 고정 JSON 21종과 21/21 일치. (b) 호출처 grep: 질문 전용 prop 은 `useAskInput.tsx` 밖 0건(`TalkRoom:1206`·`StageSpeak:415`·`StageApply:279`·`EvalItems:478`·`MicTestCard:112`). (c) 기존 시험 통과. (d) `pttHandlers` 기본 경로는 HEAD 와 같은 호출 순서(`PushToTalkButton.tsx` `onPointerDown`: primary·버튼 검사 → 캡처 → `onPress`, `onPointerUp`: primary 검사 → `onRelease`, `onKeyDown/Up`, `onBlur`; `onPointerMove: undefined`); `onAbort` 소비처는 전부 `() => void` 라 인자 생략 무해; `Composer safeBottom` 기본 true 도 HEAD 와 같은 값.
2. **음성 미저장 — 확인됨(근거 `파일:줄`)**: 위 중간 2 절. 용도 `useAskInput.tsx:157` `MIC_TEST`·대화 id 없음. 서버는 `connection.py:325`(TURN 일 때만 `_persist`)·`:184`, `write_wav` 호출은 `store.py:56`←`connection.py:396` 하나뿐. 앱은 `OnDeviceSttClient.ts:147`·`:289`·`SttSession.kt:282`·`SherpaSttPlugin.kt:421-425`. `src/**` 의 `MIC_TEST` 분기는 ticket 발급(`ticket.ts`)·클라이언트 용도 전달뿐이고 Utterance/SpeechJob 행을 만드는 곳 0. 변이로도 확인: 서버 게이트 제거(G1)는 `test_ws.py::test_mic_test_flow_no_storage_no_engine_ids` 가, 앱 saveWav/업로드 게이트 제거(V12·V13)는 `onDeviceStt.test.ts` 가 잡는다. **단 실기기 앱 저장소 wav 0개는 QA 몫.**
3. **전송 경로 — OK.** 말 질문 옵션은 `logic.ts:196` `askSendOptions('voice')={inputSource:'REALTIME_STT'}` 하나, `components/ask/**` 에 `utteranceId`·`/api/v1/utterances`·`uploadOnDeviceUtterance`·`buildTurnBody` 0(grep). `useChatTurn.ts:199-200` 은 `opts.utteranceId` 가 있을 때만 싣고 질문은 안 넘긴다. `types/ask.ts` `AskTurnRequest` 에 발화 id 필드 없음. 1자 이하 `voiceView.ts:95`, 빈 글 ignore, final 중복은 `useRealtimeStt.ts` 가 `wasFinishing` 일 때만 `onFinal`(두 번째 final 은 idle 이라 무시), 답 대기 `unsentSelf`, 429 `unsent429`, 409/429/400 은 `onRestore` 의 `askUnsentReasonOf`, 한도 잠금은 `askVoiceView` 가 버튼 비활성. 언마운트는 훅 정리(`useRealtimeStt.ts` 정리 효과 `dispose`)로 늦은 결과가 안 온다 [가능성 높음 — 클라이언트 emit 중단은 코드 정독, 실행 미확인].
4. **취소 — 코드상 OK, Low 2건.** 96px 밖/84px 안 복귀(`pttOutside`: 반지름 36 기준 밖 >96, 이력 구간 ≥84 유지)·멀티터치(`isPrimary`)·`pointercancel`(=abort, 전송 안 함)·Esc(녹음/시작 중만)·밖에서 뗌은 `onRelease` 를 부르지 않고 `onCancel`→`sttAbort`+`cancelledRef`(이중 억제: 반응기가 `finishing` 에서만 `onFinal` 을 올리고, `cancelledRef` 가 한 번 더 막음). 구간 final(녹음 중 VAD 확정)은 `wasFinishing` 거짓이라 전송 안 됨. 발견은 F-2.
5. **프라이버시 — OK.** 변경 파일에 `console.*`·직접 `localStorage` 0, 인식 글은 화면 상태(`unsent`)에만 있고 세션 저장소에는 모드 키(`'text'|'voice'`)와 글자 초안 키만. 말 글은 [고쳐서 묻기]로 입력창에 들어간 뒤 Composer 초안 디바운스로만 저장(글자 질문과 같은 규칙, Info). 부분 말풍선 `LiveUtteranceBubble.tsx` `aria-hidden="true"`(+캡션도), 화면 문구에 엔진·모델명 0(`MIC_TEST` 는 코드 상수뿐, 사용자 문구 0), 문구 18개는 시험이 §26-10 B 원문과 대조. gateway 로그는 `text_fingerprint`(글자 수+sha1 앞 8자)만.
6. **상태·접근성·하이드레이션 — OK, 실기기 확인 필요.** `useAskInputMode` 서버 스냅샷 `'text'`(수화 불일치 없음, 단 저장된 'voice' 는 수화 직후 한 번 더 그려 입력창→말 바 깜빡임 가능 — QA 확인), `lang="ja"` 상자 안 `lang="ko"` sr 줄, 말 바 상태 줄은 `aria-live` 없이 PTT `aria-describedby` 로만 연결(중복 발화 없음; 인식된 질문 낭독은 목록 쪽에 의존 — TalkBack 확인), 터치 PTT 72·⌨ 44·[고쳐서 묻기] `min-h-11`.
7. **변이 19건(앱 18 + gateway 1) — 잡힘 12 · 생존 7**: 아래 표.
8. **가이드와 다르게 판단한 3건 — 구현 판단 범위, 합리적.** Q-U2-1(오류 띠 말 모드만): 글자로 묻는 사람에게 첫 화면 마이크 오류를 안 보이게 하는 쪽이 데모·26-11 F1 목록과 맞다 — 단 설계 문서에 한 줄 반영 권고. Q-U2-2(취소 직후 짧은 누름 힌트 숨김): 토스트와 모순 방지, 타당. sr 줄 `lang="ko"`: a11y 상 옳다. **사용자에게 알릴 만한 것은 이 3건이 아니라 「한 글자 단어(水·木·目 …)는 말로 못 묻는다」(1자 이하 규칙, 회화와 같은 규칙을 그대로 가져옴 — `voiceView.ts:95`, 시험이 '木' 을 고정)** 다. 사용자는 「단어·문장」을 말한다고 했으므로 설계 의도와 어긋날 수 있다(설계대로 구현이라 결함은 아님).
9. **QA 몫**: 아래.

### 변이 표 (미러 소스 사본, 매번 원복)
| # | 변이 | 결과 |
|---|---|---|
| V1 | 티켓 용도 MIC_TEST→TURN | 잡힘(askVoice 소스) |
| V2 | 말 질문을 via='text' 로 보냄(inputSource 누락) | **생존(시험 공백)** |
| V3 | `press` 가 `cancelledRef` 를 안 풂(한 번 취소하면 이후 말 질문 전부 무음 폐기) | **생존(시험 공백)** |
| V4 | `cancel` 이 `sttAbort` 를 안 부름 | **생존(시험 공백)** |
| V5 | final 판정에서 답 대기 무시 | **생존(시험 공백)** |
| V6 | final 에서 `cancelledRef` 검사 제거 | 잡힘(소스 정규식) |
| V7 | 인식 오류 띠를 글자 모드에서도 | **생존(시험 공백)** |
| V8 | 1자 규칙 `<=1`→`<1` | 잡힘 |
| V9 | 밖에서 떼면 보냄(판정 반전) | 잡힘(2) |
| V10 | pointercancel 을 취소로 | 잡힘 |
| V11 | 300ms 미만 취소 제거(sttUiState) | 잡힘 |
| V12 | 앱 `saveWav` 늘 true | 잡힘(onDeviceStt) |
| V13 | 앱 업로드 용도 검사 제거 | 잡힘(onDeviceStt) |
| V14 | 글자 보낼 때 초안 키 비우기 제거(Q-6) | 생존(시험 공백, Low) |
| V15 | 모드 서버 스냅샷 'voice'(수화 불일치) | 생존(시험 공백) |
| V16 | 부분 말풍선 aria-hidden 제거(기본 경로) | 잡힘(고정 21종) |
| V17 | 다시 보내기에서 429 검사 제거 | 생존(시험 공백) |
| V18 | 밖 상태 줄 문구 제거 | 잡힘 |
| G1 | gateway `_on_final` 의 `purpose=="TURN"` 게이트 제거 | 잡힘(`test_mic_test_flow_no_storage_no_engine_ids`) |
생존 7건은 **동등 변이가 아니라 시험 공백**(모두 `useAskInput` 의 React 배선 — 판정 함수가 아니라 상태·ref·콜백 연결). 현재 코드는 정독상 정확해 공백이 숨긴 결함은 없다.

### 발견
- **F-1 (Medium, 시험 공백)** `useAskInput.tsx` 말 모드 배선(`onFinal` 분기→`onSend(…,'voice')`, `press` 의 취소 표지 해제, `cancel` 의 abort, busy 합산, 띠 우선순위, 모드 서버 스냅샷, 다시 보내기 검사)에 행동 시험이 없다. V2/V3/V4/V5/V7/V15/V17 이 661/661 통과. 재현: `scratchpad/mut.py V2 V3 V4 V5`. 권고: `onFinal` 처리·`press`/`cancel` 의 ref 규칙을 주입형 순수 컨트롤러(예 `makeAskVoiceHandlers({getOpts,cancelledRef,setUnsent,setLocalHint})`)로 빼서 가짜로 시험하거나, 최소한 소스 정규식 3~4개(`onSend(act.text, 'voice')`, press 의 `cancelledRef.current = false`, cancel 의 `sttAbort()`). 동결 필요 시점: QA 전 또는 직후(차단은 아님).
- **F-2 (Low)** 밖 상태 정리 구멍 2곳. ① `PushToTalkButton.tsx` `onPointerDown` 은 `g.out=false` 만 하고 React `out`·`onOutChange(false)` 를 풀지 않고, `onPointerMove` 는 새 값이 `g.out` 과 같으면 일찍 반환하므로, 밖에 있는 채로 pointerup/cancel 이 핸들러에 안 닿은 뒤(예: 30초 자동 멈춤으로 버튼이 `disabled`) 다음 누름은 손가락이 안인데 「밖」 모양·문구가 남을 수 있다. ② 밖에서 뗀 시점이 30초 자동 멈춤 뒤 final 이 이미 전송된 뒤라면 토스트 「보내지 않았어요」가 거짓이 된다(final 전이면 `cancelledRef` 로 일관되게 폐기). Esc 가 드래그 밖 상태에서 눌리면 토스트 2회. 영향은 표시뿐(전송 오류 없음). 권고: `onPointerDown` 에서 `setOut(false)`·`co.onOutChange?.(false)`, `onPointerUp` 취소 분기와 Esc 를 `phase` 가 `recording|starting` 일 때만, Esc 에서 `resetOut()`. 실기기에서 재현 확인 필요(비활성 버튼의 pointerup 전달은 브라우저별로 다르다).
- **F-3 (Low, 후속)** 플러그인 `SherpaSttPlugin.kt:504` `saveWav` 기본값 true — 약속 「목소리 저장 안 함」의 보호가 JS 클라이언트가 늘 명시하는 데 의존한다(호출처 1곳 `OnDeviceSttClient.ts:178`, V12/V13 시험이 잠금). 지금 결함은 아님. 다음 네이티브 변경 때 기본 false 로(APK 재빌드·versionCode 필요하니 지금 하지 말 것).
- **F-4 (Info)** 글자 모드에서도 `useRealtimeStt`+`useSpeechConfig`(#19 GET)를 늘 마운트 — 마이크·티켓은 누를 때만이라 약속과 무관, 비용만.
- **F-5 (Info)** 한 글자 단어 불가(위 8).
- **F-6 (Info)** [고쳐서 묻기] 글은 입력창에 들어가면 글자 질문과 같이 세션 초안에 저장됨(설계 범위).
- **F-7 (Info)** 인식된 질문을 소리로 알리는 장치 없음(`announce` 미사용) — 목록 쪽 live region 에 의존, TalkBack 확인.

### QA 가 실기기·브라우저에서 꼭 볼 것 (이 감사로 못 확인)
1. 실제 일본어 발화(단어 1~2개·짧은 문장) 인식 품질: 웹(gateway)·앱(온디바이스) 각각, EMPTY_RESULT/오인식 빈도, 한 글자 단어가 「너무 짧아서」로 막히는 체감.
2. **목소리 미저장 실증**: 말 질문 후 앱 `files/utterances/` 0개(K8)·서버 `incoming/` 비어 있음·`Utterance`/`SpeechJob` 행 수 불변(K7); 폴백(휴대폰→서버 전환) 직후도.
3. 96px/84px 경계의 엄지 감각 5회·시스템 제스처(`pointercancel`)·화면 회전·F-2 재현(밖에서 누른 채 30초, 비활성 버튼 pointerup 전달).
4. 하이드레이션: 세션 모드 'voice' 에서 새로고침/직접 `/ask` — 콘솔 경고·입력창→말 바 깜빡임.
5. TalkBack: 말 질문 말풍선 일본어/한국어 낭독 전환, 상태 줄·낭독 중복, [고쳐서 묻기] 경로.
6. 360/390/412 에서 말 바 높이·부분 말풍선·보내지 못한 말 띠 겹침, 한도(`ASK_DAILY`)·429·409 띠 문구.
7. 회화·수업 말하기/말로 쓰기·평가·마이크 테스트 한 번씩(공용 부품 불변 체감).
