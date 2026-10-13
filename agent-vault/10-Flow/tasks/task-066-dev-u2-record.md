---
task_id: task-066
role: developer-U2
tags:
  - type/task-record
  - domain/ask
  - domain/speech
aliases:
  - task-066 U2 기록
---
# task-066 developer U2 기록 — 말 바·공용 음성 부품 선택 확장·입력 묶음(`useAskInput`)

> 상위: [[task-066-ask-chatbot-voice]] · 가이드 `docs/screens.md` §26(26-7·26-12·26-13·26-15) · 짝: [[task-066-dev-u1-record]]

## READY 신호 (U1 이 읽는 줄)
- **[READY] 글자 전용 useAskInput(시각) — 09:25** `src/components/ask/useAskInput.tsx`. 계약 = 26-7 B 그대로(`useAskInput(opts): { bar, strip, tail, mode, route, sendChip, fixAsk, fill, focus, onRestore }`, 타입 `AskInputOptions`·`AskInputApi`·`AskVia`·`AskInputMode` export). 지금 `bar`=Composer(🎤 없음)·`strip`=TurnNotice(감싸는 상자 `flex-none` 포함)·`tail`=null·`mode`='text'·`route`=WEB.
  - 계약과 다른 점 1개: `sendChip(text)` 가 **boolean** 을 돌려준다(보냈으면 true) — 칩 뒤 `focusList` 는 true 일 때만 하면 된다(무시해도 됨).
  - 글자 보내기 때 `kaiwa.chat.draft.<draftKey>` 를 즉시 비운다(Q-6 — Composer 300ms 디바운스가 언마운트로 취소돼 `ask-new` 초안이 남는 문제). U1 쪽 `onCreated` 에서 따로 지울 필요 없음.
  - 예정(U1 이 쓸 것): `voiceView.ts` 의 `askSendOptions(via)`(voice → `{inputSource:'REALTIME_STT'}`, text → `{}`) — AskRoom `send` 에서 쓰면 시험 ⑥이 그 함수를 고정한다. `voiceBubble.ts` 의 `lastUserVoiceId`·`voiceQuestionTexts` 는 단계 3. `AskQuestionBubble` 새 선택 prop(`sending?`·`canFix?`·`onFix?`·`ann?`, `showTime` 선택화)은 단계 5.
  - U1 단계 2 `Composer safeBottom` 이 들어오면 내가 `safeBottom={false}` 를 넘긴다(아직 prop 없음 — 09:25 확인).
- **[READY] 말 모드 useAskInput + AskQuestionBubble 말 갈래 + voiceBubble — 10:25**. 추가 선택 옵션 `voiceBusyText?: string`(AskRoom 불러오는 중 → `ASK_COPY.loadingConv` 넘겨 주세요). `askSendOptions`·`AskVia` 는 U1 `logic.ts` 것을 쓴다(내 중복 삭제). 모드 기억 훅 `useAskInputMode()`(useSyncExternalStore, 서버 'text') — `AskTabSkeleton` 에서 써도 됨.

## 지금까지 · 다음 첫 작업 (인수인계 정본)
- 09:22 착수. 가이드 §26 전체·U2 대상 공용 부품(PushToTalkButton·VoiceBar·LiveUtteranceBubble·UnsentBar·SttAlert·TurnNotice·Composer·useRealtimeStt·sttUiState·talkState·talkCopy·useLessonVoice)·AskRoom·TalkRoom 음성 연결부 읽음.
- 전용 미러 `~/.node-local/thekaiwa-dev066u2` 준비(동기화 스크립트 = 스크래치패드 `u2sync.sh` — src·tests·plugins·prisma·scripts rsync + 루트 설정 복사, node_modules = predeploy 하드링크, `.env` 없음).
- 기준 tsc(내 변경 전, 09:21): U1 진행 중 파일만 오류(`AskHome`·`AskRoom`·`useScopeNoticeGate`·`askBehavior/askRoom/scopeNotice.test` — `ASK_KEYS.pending/draft/scopeNotice`·`scopeSheetRestoreText` 제거 때문). U1 `logic.ts` 에 `ASK_KEYS.inputMode` 이미 있음(09:21 확인).
- 단계1 완료(09:25, READY 위). 단계2 완료(09:40): 확장 **전** 마크업 21종을 `talk/__tests__/fixtures/voiceShared.frozen.json` 에 고정(확장 전 코드로 생성·통과 확인) → `PushToTalkButton cancelOutside`(순수 `pttHandlers`·`pttOutside`·`pttReleaseAction` export, 그릇 = `useState` 한 번 — ref 를 렌더 중 함수에 넘기면 eslint `react-hooks/refs` 오류라서)·`VoiceBar cancelOutside/safeBottom/keyboardLabel`·`LiveUtteranceBubble out/caption`·`UnsentBar textOf/canResend`. 시험 `talk/__tests__/voiceSharedFrozen.test.ts`(4)·`speech/__tests__/pttCancelOutside.test.ts`(5) 통과, eslint 0, 내 파일 tsc 0.
- 단계3 완료(09:50): `askVoiceCopy.ts`(문구 + `askUnsentText`·`askUnsentDaily`·`askUnsentCanResend`·`askUnsentReasonOf`·`askUnsentBarReason`, 타입 `AskUnsent`) · `voiceView.ts`(`askVoiceView`·`askDailyBlocked`·`askIdleHint`·`askFinalAction`·`askSendOptions`) · `voiceBubble.ts`(`isVoiceQuestion`·`lastUserVoiceId`·`voiceQuestionTexts`) + 시험 `voiceView.test.ts`(6)·`askVoice.test.ts`(8, 소스 스캔 포함) 통과.
- 단계4 완료(10:00): `useAskInput` 말 모드 — 모드 기억 `useAskInputMode()`/`writeAskInputMode()`(useSyncExternalStore, 서버 스냅샷 'text' — 수화 불일치 없음; U1 `AskTabSkeleton` 도 쓸 수 있게 export) · `useSpeechConfig` + `useRealtimeStt({ purpose:'MIC_TEST', config, maxSec:30, onFinal })`(대화 id 없음) · `onFinal`=`askFinalAction` · 밀어서 취소 `cancel()`(cancelledRef + abort + 토스트) · 띠 SttAlert(**말 모드에서만** — 질문 Q-U2-1) > UnsentBar(`askUnsentText`·`canResend`) > TurnNotice · 꼬리 LiveUtteranceBubble(out·caption) · 자동 30초·전환 토스트 · `onRestore`(글자 → 입력창, 입력창이 없으면(말 모드) 초안 키에 남김 / 말 → 띠). Composer `safeBottom={false}`(U1 단계2 들어옴 확인).
- 단계5 완료(10:15): `AskQuestionBubble` 말 갈래(`lang="ja"` 상자·`JaText`(JA_BODY 17px)+`HangulLine onTint waitAsLine`(회화 내 말풍선과 같은 부품)·「🎤 말로 물었어요」·[고쳐서 묻기] `canFix && onFix` 일 때만·sr 「나(말로 물음): 」 — sr 줄은 `lang="ko"` 를 달았다: `lang="ja"` 상자 안 한국어를 일본어 음성으로 읽지 않게, reviewer 확인 대상). 새 선택 prop `sending?`·`canFix?`·`onFix?`·`ann?`, `showTime` 선택화. **글자 갈래 마크업은 확장 전 그대로**(확장 전 생성 문자열로 시험 고정). `types/ask.ts` `AskTurnRequest.inputSource` = `'TEXT' | 'REALTIME_STT'`(발화 id 필드 없음).
- U1 과 겹친 것 정리(10:20): U1 이 `logic.ts` 에 `askSendOptions`·`AskVia` 를 먼저 만들어 → 내 `voiceView.askSendOptions` 삭제, 시험은 `logic` 것을 고정, `useAskInput` 은 `AskVia` 를 `logic` 에서 가져와 다시 내보냄.
- 계약 추가(선택, 10:25): `AskInputOptions.voiceBusyText?` — busy 일 때 말 바 상태 줄(없으면 「답을 받은 뒤 말할 수 있어요」). U1 `AskRoom` 이 `?chat=` 불러오는 중이면 `ASK_COPY.loadingConv` 를 넘기면 26-5 B 「누르고 말하기 잠금 문구 = 대화를 불러오고 있어요」가 맞는다(U1 에 알림 필요).
- 단계6(코드 수준 통합 확인, 10:45): U1 `AskRoom`·`AskNewConversation` 이 계약대로 부름 — `useAskInput({...voiceBusyText})`·`input.{bar,strip,tail,route,sendChip,fixAsk,onRestore,mode}`·`renderUser` 에 `canFix={m.id===lastVoiceId} onFix={input.fixAsk} ann={annOf}`·`voiceQuestionTexts` 를 읽기 층 요청에 합침·#28 실패 시 `input.onRestore(t,{opts:askSendOptions(v),status:0,…})`(말이면 「보내지 못한 말」 띠, 네트워크 문구). 실제 웹(서버 인식)·앱(휴대폰 인식) 말 질문 흐름은 브라우저·실기기라 **QA 몫**(K7·K8·K9).
- 단계7 회귀(10:50): 회화·수업 말하기·평가·마이크 테스트가 쓰는 공용 부품 4종은 새 prop 없이 확장 전과 **마크업 21종 동일**(고정 시험) + 핸들러 순서 동일(`pttHandlers` 기본 경로 시험) + 6개 호출 파일에 질문 전용 prop 0(소스 시험). `TalkRoom.tsx`·`talkState.ts`·`talkCopy.ts`·`useRealtimeStt.ts`·`sttUiState.ts`·`sttCopy.ts`·`useLessonVoice.ts`·`MicTestCard.tsx`·`modules/speech/**` 수정 0.
- **게이트(10:55, 미러 = 작업 트리 src·tests 전체 + U1 단계8 반영본)**: tsc `--noEmit --incremental false` **0** · eslint(`src/components/{ask,talk,speech,chat}`·`src/types/ask.ts`) **오류 0·경고 0** · 시험: 전체 `find src -name '*.test.ts'` 3,842 중 3,647 통과·192 실패 → 실패 192 는 전부 **미러에 `.claude/agents/tutor.md` 가 없어 페르소나 로더가 던진 것**(내 미러 환경 문제, 동기화 스크립트 고침) + U1 `arrivalAlignWiring`(U1 이 고침) → 실패했던 24개 파일 재실행 **560/560 통과** · 관련 묶음 재확인 `components/{ask,talk,speech,chat,lesson,shell}` **604/604 통과**. 변이 18/18 잡힘(아래 표).
- **남은 위험**: ① 실기기 미확인 — 앱 WebView 에서 캡처 중 96px 판정 감각·시스템 제스처 `pointercancel`·휴대폰 경로 wav 0개(K8)·TalkBack 낭독(QA). ② `useAskInput` 자체(React 상태 연결)는 렌더 시험이 없다 — 판정은 순수 함수·소스 스캔으로만 고정(DOM 시험 도구 없음). ③ Q-U2-1(오류 띠 말 모드만)·Q-U2-2(취소 뒤 짧은 누름 힌트 숨김)·말풍선 sr 줄 `lang="ko"` 는 가이드와 다른 판단 — Leader/designer 확인 필요. ④ 플러그인 `saveWav` 기본값 true(클라이언트가 늘 명시해서 지금은 안전).
- 다음 첫 작업(이어받는 사람): 없음 — U2 범위 완료. U1 단계8 최종 통합(next build·26-14 C 표) 결과만 확인.
- 미커밋(내 것): `ask/{useAskInput.tsx, askVoiceCopy.ts, voiceView.ts, voiceBubble.ts}`(새) · `ask/__tests__/{voiceView,askVoice}.test.ts`(새) · `speech/PushToTalkButton.tsx` · `talk/{VoiceBar,LiveUtteranceBubble,UnsentBar}.tsx` · `talk/__tests__/voiceSharedFrozen.test.ts`(새)·`talk/__tests__/fixtures/voiceShared.frozen.json`(새) · `speech/__tests__/pttCancelOutside.test.ts`(새) · 이 기록.

## 변이 표(26-13 ②③⑥⑦⑧⑬⑮ — 별도 미러 `thekaiwa-dev066u2-mut`, 스크립트 `scratchpad/mutate.py`, 10:40) — **18건 중 18건 잡힘**
| # | 변이 | 실패한 시험 |
|---|---|---|
| M1 | VoiceBar 기본 `safeBottom` 끔(기본값 켬) | voiceSharedFrozen 「확장 전 고정 문자열(21종)」·「기본 경로…」 |
| M2 | 버튼에 `data-out` 늘 붙임 | pttCancelOutside 「모양 클래스는 cancelOutside 에만」 + 고정 21종 |
| M3 | UnsentBar 기본 다시 보내기를 400 에도 | 고정 21종(unsent.400) |
| M4 | 말 보내기 옵션에 발화 id 실음(`logic.askSendOptions`) | voiceView 「보내기 옵션: 말 = REALTIME_STT 만」 |
| M5 | 티켓 용도 `TURN`(원음 저장 경로) | askVoice 「목소리 미저장(⑥ 소스)」 |
| M6 | 인식에 대화 id 넘김 | askVoice ⑥ 소스 |
| M7 | 1자 규칙 `<= 1` → `< 1` | voiceView 「손을 뗀 뒤 판정」 |
| M8 | 답 기다릴 때 그냥 보냄(줄 세움) | voiceView 「손을 뗀 뒤 판정」 |
| M9 | 밖에서 떼기 판정 제거 | pttCancelOutside 「96px 밖에서 떼면 onCancel」 |
| M10 | 이력 없앰(한 경계) | pttCancelOutside 「밖 판정 12px 이력」·「96px…」 |
| M11 | 취소한 말 가드(`cancelledRef`) 제거 | askVoice 「밀어서 취소·여백(소스)」 |
| M12 | 기본 버튼도 Esc 취소 | pttCancelOutside 「기본(취소 없음)… Esc 무시」 |
| M13 | 문구 누락(밖 상태 빈 글) | askVoice 「문구 = §26-10 B 원문」·voiceView 우선순위 |
| M14 | 엔진명 노출(unavailable 에 reazon) | askVoice 원문·「엔진·모델… 이름 0」·voiceView 7행 |
| M15 | 취소 직후 「중간에 멈춤」 힌트 보임 | voiceView 「대기 힌트」 |
| M16 | [고쳐서 묻기]를 마지막 말 질문에(글자 뒤에도) | askVoice 「[고쳐서 묻기] 대상(⑮)」 |
| M17 | 말 바 순서 바꿈(busy 를 녹음보다 먼저) | voiceView 「7행」·「우선순위」 |
| M18 | 부분 말풍선 기본에 캡션 | 고정 21종 |

## 가이드 26-15 developer 확인 질문 — U2 몫 답(코드 읽기·시험 기준, 실기기는 QA)
- **Q-2 `MIC_TEST` 인식 품질·녹음 파일 미생성** — 파일이 생길 수 있는 곳을 끝까지 따라감:
  - 웹/폴백(gateway): 티켓 용도는 `modules/speech/stt/ticket.ts` 가 서명(`TICKET_PURPOSES = ['TURN','MIC_TEST']`) → gateway `kaiwa_gateway/connection.py:325` `if self.claims.purpose == "TURN" and text: utterance_id = await self._persist(utt)` — wav 저장·internal 콜백(발화 행)은 **TURN 일 때만** [확실]. `:184` 는 TURN 일 때만 저장소·콜백 의존을 요구. 인식 자체(모델·끝점·후처리)는 용도로 가르는 분기를 이 두 곳 말고 찾지 못함 [가능성 높음 — `connection.py` 전체 분기는 purpose 두 곳뿐(grep)].
  - 앱(휴대폰): `OnDeviceSttClient.ts:147` `saveWav: o.purpose === 'TURN'` → 플러그인 `SttSession.kt:282` `if (opts.saveWav && text.isNotEmpty() && pcm.isNotEmpty()) wavStore.save(...) else null` — 파일을 쓰는 곳은 `SherpaSttPlugin.kt:424 wavStore`(→`WavWriter.write`) 하나뿐이라 **MIC_TEST 는 wav 파일을 만들지 않는다** [확실 — 코드 경로]. 업로드(#21)도 `OnDeviceSttClient.ts:289` 가 `purpose !== 'TURN'` 이면 null [확실]. 휴대폰 → 서버 전환 때도 `router.ts:223·237·264` 가 같은 `BeginOptions`(용도 포함)를 넘김 [확실]. 주의: 플러그인 기본값은 `saveWav=true`(`SherpaSttPlugin.kt:504`) — 클라이언트가 늘 키를 명시하므로 지금은 안전, 키를 빼는 변경이 생기면 깨진다. 소리 PCM 은 세션 동안 메모리에만.
  - 질문 쪽: `useAskInput` 은 `purpose:'MIC_TEST'` 1건·대화 id 없음·발화 id 0·`/api/v1/utterances`·업로드 0 — 시험 `askVoice.test.ts` 소스 스캔으로 고정. 실기기 앱 저장소(utterDir) 파일 0 확인은 QA K8.
- **Q-3 휴대폰 인식 파일 상태 공유**: `onDeviceModelStore()` 는 모듈 전역 하나 — `useRealtimeStt` 가 같은 저장소를 구독(`subscribe`)하고 사전 점검(`micPreflight`)에 `snapshot().installed` 를 쓴다 → 회화·설정·질문이 같은 상태 [확실]. 권한 첫 누름(`PERMISSION_ONLY` → 힌트 「마이크를 허용했어요…」)·파일 없음 띠(`SttAlert MODEL_REQUIRED`)도 같은 훅·부품이라 같다 [확실]. 단 질문 탭은 띠를 **말 모드에서만** 보인다(Q-U2-1).
- **Q-4 포인터 캡처 + 거리 판정**: 캡처 중에는 `pointermove`·`pointerup` 이 버튼 밖 좌표로도 이 버튼에 온다(포인터 캡처 규격, Chromium WebView 동일) — 그래서 `pointerleave` 가 아니라 중심 거리로 판정(`pttHandlers`, 시험 고정). 버튼에 `touch-none`(touch-action:none)이 이미 있어 끌어도 스크롤로 빼앗기지 않는다 [확실 — 클래스]. 아래 가장자리 시스템 제스처 → `pointercancel` → 기존 `onAbort`(보내지 않음·「녹음이 중간에 멈췄어요」 힌트는 사용자 취소가 아니므로 보임) [확실 — 코드]. 96px 경계가 엄지로 자연스러운지는 실기기 5회 — QA.
- **Q-7 새로고침 뒤 말 질문 표시 유지**: #29 `MESSAGE_SELECT` 에 `inputSource` 포함·응답에 그대로(`modules/conversation/chats/index.ts:213·241`) [확실], `useChatTurn` 임시 메시지도 `opts.inputSource` 를 싣는다 [확실] → 말 갈래(`isVoiceQuestion`)가 새로고침·복원 뒤에도 같다. 발화 id 없는 `REALTIME_STT` 임시 메시지 — `useChatTurn` 은 `utteranceId` 가 있을 때만 본문에 싣는다(`...(opts.utteranceId ? {...} : {})`) [확실].
- **Q-8 티켓 한도**: 누를 때마다 `begin` → 서버 경로는 티켓 1장. 짧은 누름(300ms 미만)·밀어서 취소도 티켓을 쓴다 — 분당 20 을 넘기려면 3초에 한 번꼴 연타가 필요, 넘으면 기존 `SttAlert`(RATE_LIMITED) 문구 [가능성 높음 — 실측 안 함].
- **Q-6(U1 몫이지만 내 코드가 해결)**: `Composer` 는 보낸 뒤 300ms 디바운스로 초안을 비우는데 그 사이 언마운트되면 타이머가 취소돼 `kaiwa.chat.draft.ask-new` 에 옛 글이 남는다 [확실 — `Composer.tsx` 효과 정리 함수]. `useAskInput.sendText` 가 보내기 전에 그 키를 바로 비운다.

## 확인 질문(Leader·designer 에게) — 가이드가 모호해 이렇게 정함
- **Q-U2-1 인식 오류 띠를 글자 모드에서도 보이나**: 26-7 G 는 `textMode={mode==='text'}` 로 써 글자 모드에서도 띠가 보이는 것처럼 읽힌다. 그러나 질문 탭은 **처음이 글자 모드**라, 마이크 권한을 예전에 거절한 기기·막힌 브라우저에서 `/ask` 첫 화면에 빨간 마이크 오류 띠가 뜬다(데모 B·first 에 없음, 26-11 F1 첫 화면 목록에도 없음) [가능성 높음 — `useRealtimeStt` 의 사전 점검·권한 감시가 마운트 때 오류를 만든다]. **말 모드에서만** 띠를 보이게 했다(글자 모드로 바꾸면 숨고, 닫지 않았으면 말 모드로 오면 다시 보임). 다르게 원하면 `useAskInput` 의 `showSttAlert` 한 줄.
- **Q-U2-2 취소 직후 「짧은 누름」 힌트도 숨김**: 가이드는 `INTERRUPTED` 만 숨기라고 했지만, 녹음 시작 전(starting)에 밖으로 빼거나 Esc 로 취소하면 상태기계가 `SHORT_PRESS`(「버튼을 누른 채로 말하고…」)를 남긴다 — 토스트 「보내지 않았어요」와 어긋나 같이 숨겼다(`askIdleHint`, 시험 고정).

## Developer 기록
- [09:22] 착수 — 범위 26-12 A U2 파일만.
- [09:40] 단계2 — 고정 시험 먼저(확장 전 21종 통과) → 확장 → 같은 시험 통과. 주의: 고정 JSON 은 「확장 전」 산출물이라 다시 만들지 말 것(다시 만들면 고정 의미가 사라짐).
