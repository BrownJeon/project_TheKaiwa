---
task_id: task-077
role: developer
step: UI-2
title: "task-077 UI-2 — 레슨 ⑤ 말하기 배선: 공용 입력 영역 + 일본어 도우미 + 「내가 한 말」 한국어 뜻"
tags:
  - type/task-record
  - domain/lesson
  - domain/speech
created: 2026-10-18
updated: 2026-10-18
---

# task-077 UI-2 developer 기록 — [[task-077-improve-lesson-speak-translation-helper]]

## 한 줄 요약
(DONE · risk MEDIUM) 오늘의 회화 ⑤ 하단을 회화방 공용 `VoiceBar`(레슨 view `lessonVoiceView`)·`Composer`(레슨 초안 키·Enter 확인·「확인하기」)로 바꾸고, 회화방과 같은 자리·동작의 일본어 도우미(#184)와 「내가 한 말」 한국어 뜻(#185 — 같으면 모범 답안 뜻 즉시·다르면 AI 1회·자동·비차단)을 붙였다. 토스트 바닥은 하단 묶음 실제 높이 + 12. 공용 부품(`talk/`·`chat/`) 코드는 한 줄도 고치지 않았고, `voiceSharedFrozen` 은 Leader 승인 좁은 예외(레슨 두 파일의 `keyboardLabel` 하나)만 넣었다. 기존 영향 시험 629/629 그대로 + 새 34개.

## 변경 파일
| 파일 | 구분 | 내용 |
|---|---|---|
| `src/components/lesson/StageSpeak.tsx` | 수정 | 하단 = 판+바 상자(`ResizeObserver` → `onBottomHeight`) · 말 = 공용 `VoiceBar`(`trailing` 도우미·`keyboardLabel`/`stopLabel`/`statusId` 레슨 값) · 글자 = 공용 `Composer`(`key={item.id}`·`draftKey`·`enterSends="always"`·`sendLabel`·🎤+도우미 `leading`) · 도우미(`usePhraseHelper({request: #184})`·잠금 `lessonHelperLockReason(phase, checking)`·처음 한 번 안내·잠금 토스트(녹음 중이면 끝난 뒤)·✕/넣기 초점 복귀·판 열 때 카드 맞춤) · 말풍선 안 `SpeakTranslation` · 확인은 `runSpeakCheck`(도우미 접기 → #62b → 판 닫기 / 실패 시 원문 되돌리기) · [다음 과제]·건너뛰기 = `goNext`(판 닫기). 복제 마크업(`KeyboardIcon`·textarea·상태 줄·누르고 말하기)·초안 즉시 저장 제거 |
| `src/components/lesson/LessonScreen.tsx` | 수정 | `Toast bottomPx={lessonToastBottom(stage, speakBottom)}`(136 하드코딩 대신) · `useSpeakTrCache()`(수업 화면 동안 뜻 메모리) · StageSpeak 에 `toastOpen`·`onBottomHeight`·`trCache` |
| `src/components/lesson/lessonCopy.ts` | 수정 | `U5.trSr`(「한국어 뜻: 」)·`U5.trHeard`(「알아들은 말을 그대로 옮겼어요」) — §34-6 의 새 문구 둘뿐 |
| `src/components/lesson/lessonVoiceView.ts` | 새 | `lessonVoiceView`(TalkView 유도 — 질문 탭 `voiceView` 본보기) · `lessonToastBottom` · `taskSentenceHidden` |
| `src/components/lesson/speakTranslation.ts` | 새 | `translationPlan`·`speakTrFailureOf`·`koOf`·`speakTrHint`·`speakTrRetryable`·`speakTrView` + 요청 수명주기 `createSpeakTranslator`(동시 1건·대상 바뀜/잠금/언마운트 때 끊기·12초·늦은 답 버림) |
| `src/components/lesson/useSpeakTranslation.ts` | 새 | 훅(React 상태로만 옮김) · `useSpeakTrCache` · `speakTrRequest`(#185 본문 `{text}` 하나, `apiPost` 경유) |
| `src/components/lesson/SpeakTranslation.tsx` | 새 | 번역 칸 — 회화방 `UserTranslation` 과 같은 클래스·`DISPLAY_COPY.userTr` 문구, `aria-live="polite" aria-atomic` 늘 마운트, [다시 가져오기] 누르면 칸으로 초점 |
| `src/components/lesson/speakCheck.ts` | 새 | `runSpeakCheck` — 답 확인 순서(화면 상태 없이 시험) |
| `src/components/talk/__tests__/voiceSharedFrozen.test.ts` | 수정(좁게) | 아래 절 |
| `src/components/lesson/__tests__/task077SpeakTranslation.test.ts` | 새 | 17개 |
| `src/components/lesson/__tests__/task077LessonSpeak.test.ts` | 새 | 17개 |

공용 부품(`talk/VoiceBar`·`chat/Composer`·`talk/usePhraseHelper`·도우미 4부품·`helperCopy`·`phraseHelperLogic`)·`MessageBubble`·서버·문서 **변경 0**(UI-1 인터페이스로 충분했다 — «Leader 확인 필요» 없음).

## `voiceSharedFrozen` 좁은 수정 (Leader 승인)
- 위치: 4번째 시험 「회화·수업·평가·마이크 테스트 화면은 질문 탭 전용 prop 을 넘기지 않는다」의 소스 스캔 반복만.
- 내용: `keyboardLabelOk = new Set(['src/components/lesson/StageSpeak.tsx', 'src/components/lesson/useLessonVoice.ts'])` 를 두고 `bad === 'keyboardLabel' && keyboardLabelOk.has(f)` 일 때만 건너뛴다. 다른 파일(`TalkRoom`·`StageApply`·`EvalItems`·`MicTestCard`)의 `keyboardLabel`, 레슨 두 파일의 `cancelOutside`·`safeBottom`·`textOf=`·`canResend`·`caption=` 는 그대로 금지. 시험 이름·21종 고정 마크업 시험·fixture JSON **수정 0**.
- 이유: 승인 B6 A(레슨이 공용 `VoiceBar` 사용, ⌨ 이름 「글자로 답하기」= 이미 있는 `keyboardLabel` prop)와 이 금지가 충돌(UI-1 기록 ①, 권고 b). 실제로 쓰는 곳은 `StageSpeak.tsx` 한 곳(`useLessonVoice.ts` 는 지시대로 허용 목록에만 둠 — 지금 그 파일엔 없음).
- 넓어지지 않게: `task077LessonSpeak.test.ts` 가 예외 줄의 글자(두 파일·`keyboardLabel` 하나)를 고정한다(변이 M30 포착).

## §34 와 어긋난 곳 · 구현 결정
1. **■ 아이콘 사각형**: 레슨 말 바가 공용 `VoiceBar` 를 쓰므로 ■ 의 안쪽 사각형이 레슨 `StopIcon`(24 중 14) → `VoiceBar` 것(24 중 12)으로 작아진다(버튼 44·바탕 그대로). 승인 「회화방과 같은 배치」의 결과라 그대로 두고 시험에 «알려진 차이»로 고정. ⌨ 클래스 끝 공백 1개도 같은 이유(보이는 차이 없음). 그 밖의 말 바 마크업은 변경 전 레슨 말 바와 20조합(단계 5 × 확인 중 × 재생 중) 바이트 동일.
2. **상태 줄 id**: `statusId="lesson-voice-status"`(지금 DOM id 유지, UI-1 권고).
3. **⌨ 로 바꿀 때 초점**: §34-3 대로 ⌨ 를 누르면 입력창 초점(회화방과 같음), 처음부터 글자 모드(`textFirst`)면 주지 않음. **인식 오류 띠의 「글자로 답하기」는 지금처럼 초점 없음**(§34-3 은 ⌨ 만 적었다 — 회화방은 띠에서도 초점을 준다. 맞출지 Leader 판단, 한 줄).
4. **글자 입력 동작은 §34-3 표 ★ 그대로 바뀐다**(승인됨): 빈 칸 확인 = 단추 흐림·토스트 없음(`U5.emptyToast` 상수는 남김 — 쓰는 곳 0) · 초안 300ms · 높이 136 · 1,000자 · 확인 중에 보내기를 누르면 토스트 「확인하는 중…」(`busyReason`, 지금은 조용히 무시) · Enter = Shift 없으면 확인(지금과 같음, IME 229 추가).
5. **도우미 판 `blocked`** = 말 모드에서 인식 오류 띠가 새로 뜨는 순간 판을 닫는다(회화방 «띠가 뜨면 닫힘» 규칙을 레슨 오류 띠에 대응 — §34-5 「같은 것」에서 유도). `otherOpen` = false(목표 카드·대답 연습 없음).
6. **잠금 토스트 미룸**: 녹음 중(시작·녹음)에 잠긴 도우미를 누르면 토스트를 녹음이 끝난 뒤 띄운다(데모 낭독 표 「녹음 중이면 끝난 뒤 뜸」). 레슨의 다른 토스트는 지금처럼 바로.
7. **처음 한 번 안내 판정 시점**: 회화방은 방이 준비된 뒤 판정. 레슨은 인식 설정(#19)을 읽기 전(`config===null && !textFirst`)에는 판정하지 않는다 — 글자 모드로 시작할 사람에게 안내를 «써 버리지» 않게.
8. **뜻 메모리 위치**: §34-4 「수업 화면 동안」 → `LessonStages` 가 `useSpeakTrCache` 로 들고 StageSpeak 에 내려 준다(① ~ ④ 다시 보기로 갔다 와도 같은 글은 다시 묻지 않음, 수업 화면을 떠나면 사라짐).
9. **시도 번호(`seq`)**: 같은 글을 다시 말해도 새 결과로 본다 — 메모리에 뜻이 있으면 즉시, 앞 시도가 실패였으면 새 시도에서 다시 묻는다. 실패한 같은 결과는 저절로 다시 묻지 않고 [다시 가져오기]로만.
10. **잠금 중 번역**: 녹음·인식·확인 중에는 받는 중인 #185 를 끊고(서버 잠금 해제) 칸은 「번역 중…」으로 둔다. 새 결과가 오면 그 글로, 결과 없이 끝나면(너무 짧음 등) 같은 글을 다시 묻는다. 잠금 중에는 칸 내용이 바뀌지 않아 녹음 중 낭독이 생기지 않는다.
11. **409 그 밖의 이유**(BUSY·CANCELLED 아님)는 실패 줄(서버는 두 이유만 보낸다).
12. **번역 칸 상자 `outline-none`**: `tabIndex=-1` 초점 대상(결과 줄 `resultRef` 와 같은 처리). §34-4 의사코드엔 클래스가 없음.
13. **다시 보기**: `!reviewing` 일 때만 하단 묶음(도우미 없음) — 번역 칸은 다시 보기에서도 같은 규칙으로 보인다(코드 확인, §34-2 와 일치). 입력 영역이 없으면 토스트 바닥 136(지금 값).
14. **Info-2(일본어 글자가 없는 말)**: 지시에 없어 손대지 않았다 — 지금은 #185 를 부르고 502 `TRANSLATION_REJECTED` → 실패 줄 + [다시 가져오기]. 호출 생략 여부는 «Leader 확인 필요»(감사 G-1 ⑤).

## 시험 (새 34개 — 동작 시험 위주, 배선은 소스 스캔)
| 파일 | 시험 | 종류 |
|---|---|---|
| `task077SpeakTranslation` | `translationPlan` 13행(건너뜀·공백·같음·문장부호/공백만 다름·모범 뜻 공백·한 글자 다름·뒤틀린 인식·모범 뜻 비었음·200자 초과) | 순수 |
| 〃 | `speakTrFailureOf` 15행 · `koOf` 10행 · `speakTrHint` 11조합 · `speakTrRetryable` 8 · `speakTrView` 6 | 순수 |
| 〃 | 수명주기: 한 번 묻고 메모리·중복 없음 / 대상 바뀜 → 끊기·늦은 답·실패 버림 / 잠금 → 끊고 idle·잠금 중 시작·재시도 없음·풀리면 다시 / 실패는 저절로 안 묻고 재시도만·받는 중 재시도 무시·서버 취소 줄 없음 / 오류 6종·빈 뜻 / 12초(mock 타이머) / dispose·재마운트 | 동작(가짜 요청) |
| 〃 | `speakTrRequest`: 주소 인코딩·POST·본문 `{text}` 하나·신호 전달·응답 그대로 | 동작(가짜 fetch) |
| 〃 | 번역 칸 마크업: 뜻+힌트(말·AI) 전체 문자열 / 글자 답·모범 뜻 힌트 없음 / 준비(idle·loading) / 실패·한도·바쁨(+단추)·막힘(단추 없음)·서버 취소(빈 칸) / 스위치 무관 | 렌더 |
| `task077LessonSpeak` | `lessonVoiceView` 9행 표 | 순수 |
| 〃 | 공용 말 바 = 변경 전 레슨 말 바 20조합(알려진 차이 2개만) · 도우미 칸 있을 때 자리·이름 | 렌더 |
| 〃 | `lessonToastBottom` 10행 · `taskSentenceHidden` 7행 | 순수 |
| 〃 | `runSpeakCheck` 4개(성공 순서·글자 실패 되돌리기·말 실패·발화 409 재전송/재실패/발화 없음) | 동작 |
| 〃 | 배선 스캔 7개(공용 부품·글자 입력 prop·되돌리기/취소 연결·도우미 #184/잠금/넣기/다음 과제·번역 칸 자리/잠금/스위치 무관/메모리·토스트 바닥·새 파일 규칙(fetch·Capacitor·엔진명·화면 B 규칙)) + frozen 예외 고정 | 소스 |

## 변이 (임시 미러 `~/.node-local/thekaiwa-dev077u2-mut` — 소스 실제 복사·node_modules 심볼릭 링크, 시험 = 새 2파일 + voiceSharedFrozen + display, 기준선 실패 0) — **30/30 포착**, 끝난 뒤 `diff -rq src` 미러와 동일·저장소 `cmp` 동일
| # | 변이 | 결과 | 잡은 시험 |
|---|---|---|---|
| M01 | 같으면 AI 호출(같음 판정 무시) | 포착 | translationPlan |
| M02 | 다르면 모범 답안 뜻 사용 | 포착 | translationPlan |
| M03 | 힌트가 글자 답에도 | 포착 | speakTrHint · 번역 칸 마크업 |
| M04 | abort 누락(신호를 끊지 않음) | 포착 | 수명주기 대상 바뀜 · 잠금 · dispose |
| M05 | 메모리 무시(있어도 다시 묻기) | 포착 | 수명주기 한 번 묻기 |
| M06 | 잠금 이유 뒤바뀜(확인 중 무시) | 포착 | 배선 도우미(스캔) |
| M07 | #62b 결과 뒤 판 안 닫음(순서 함수) | 포착 | runSpeakCheck 성공 · 발화 409 |
| M08 | #62b 결과 뒤 판 안 닫음(화면 배선) | 포착 | 배선 확인(스캔) |
| M09 | 토스트 136 고정(화면) | 포착 | 배선 토스트(스캔) |
| M10 | 토스트 높이 무시(함수) | 포착 | lessonToastBottom |
| M11 | `enterSends` 빠짐(모바일 Enter 줄바꿈) | 포착 | 배선 글자 입력(스캔 — Enter 는 마크업에 없음) |
| M12 | 실패 시 되돌리기 누락(순서 함수) | 포착 | runSpeakCheck 글자 실패 · 발화 409 |
| M13 | 막혔을 때 되돌리기 누락 | 포착 | 배선 확인(스캔) |
| M14 | 초안 키 변경 | 포착 | 배선 글자 입력 |
| M15 | 번역 칸을 조건부로 숨김(스위치 흉내) | 포착 | 배선 번역 칸 |
| M16 | 409 CANCELLED 를 실패 줄로 | 포착 | speakTrFailureOf · 수명주기 서버 취소 |
| M17 | 12초 상한 없음(120초) | 포착 | 수명주기 12초 |
| M18 | 늦은 답 버리지 않음 | 포착 | 수명주기 3개 |
| M19 | 잠금 중 끊지 않음 | 포착 | 수명주기 잠금 |
| M20 | 잠금 중 재시도 허용 | 포착 | 수명주기 잠금 |
| M21 | ⌨ 녹음 중 잠금(지금 레슨과 다름) | 포착 | lessonVoiceView 표 · 말 바 대조 |
| M22 | 상태 줄이 확인 중 무시 | 포착 | lessonVoiceView 표 · 말 바 대조 |
| M23 | #185 본문에 itemId | 포착 | speakTrRequest |
| M24 | 막힘(400·404)에도 다시 가져오기 | 포착 | speakTrRetryable · 번역 칸 마크업 |
| M25 | 마이크 누름에 도우미 취소 없음 | 포착 | 배선 확인(스캔) |
| M26 | 확인 시작에 도우미 취소 없음 | 포착 | runSpeakCheck 4개 |
| M27 | Composer `key` 없음(과제 바뀌어도 이전 초안) | 포착 | 배선 글자 입력(스캔) |
| M28 | 모범 답안 뜻에 힌트(ai true) | 포착 | speakTrView |
| M29 | 도우미 주소를 회화방 #180 으로 | 포착 | 배선 도우미(스캔) |
| M30 | frozen 예외를 넓힘(모든 파일 `keyboardLabel` 허용) | 포착 | frozen 예외 고정 |
- 스캔으로만 잡는 변이(M06·M08·M09·M11·M13·M14·M15·M25·M27·M29): 렌더러가 없어 StageSpeak 배선은 글자 단위로만 고정된다 — 같은 뜻의 다른 글자로 바꾸면 못 잡는다(알려진 한계).

## 증빙 (미러 `~/.node-local/thekaiwa-dev077u2` — 저장소에서 편집 후 임시 파일 + `mv` 로 반영)
| 명령 | 결과 |
|---|---|
| 변경 전 영향 시험(lesson·talk·chat·ask·shell 61파일) | 629/629 |
| `./node_modules/.bin/tsc --noEmit` | 0 |
| `./node_modules/.bin/eslint <변경·새 11파일>` | 0 |
| 변경 후 영향 시험(같은 폴더 63파일 = 61 + 새 2) | 663/663 (기존 629 그대로 + 새 34) |
| 전체 시험 `find src scripts/seed-build -name '*.test.ts' \| sort`, `--test-concurrency=1`, 가짜 `DATABASE_URL` | **tests 4516 · pass 4511 · fail 0 · skipped 5** · exit 0 · 260s (UI-1·서버 합친 상태 4482 + 새 34) |
| `./node_modules/.bin/next build > log 2>&1; echo $?` | **0** · 경로표에 `ƒ /api/v1/lessons/[id]/phrase-help`·`speaking-translation` · 경고 3 = 기존 페르소나·엔진 파일 추적(무관) |

## 알려진 한계
- 렌더러(jsdom 등)가 없어 StageSpeak 의 효과·초점·`ResizeObserver`·카드 맞춤 스크롤은 실행 시험이 없다 — 규칙은 순수 함수(`lessonToastBottom`·`taskSentenceHidden`·`runSpeakCheck`·번역 컨트롤러)로, 연결은 소스 스캔으로 본다. 실측(360/390/412 × 130% · 키보드 · TalkBack)은 QA.
- 빈 입력창 높이: 도우미가 들어가 입력창이 좁아져 360px 에서 placeholder 가 두 줄 → 빈 입력창 48→70px(데모 실측, 승인 ★ = 지금 문구 그대로). 폰 확인 항목.
- `useLessonVoice.ts` 는 이번에 고치지 않았다(view 유도는 새 파일). frozen 허용 목록에는 지시대로 넣어 두었다.

## reviewer 가 볼 곳
- `speakTranslation.ts` `createSpeakTranslator.sync` — 대상 바뀜/잠금/메모리 순서, `useSpeakTranslation` 효과 의존성(`idle` 불리언으로 재시작 판단). StrictMode 재마운트(`dispose` 는 영구 정지가 아님).
- `StageSpeak.tsx` `helperOpsRef`(도우미 훅이 음성 훅 뒤라 확인 함수가 ref 로 부름 — 회화방 `cancelHelperRef` 와 같은 방식), `check` 의 막힘 경로 되돌리기.
- `voiceSharedFrozen.test.ts` 예외 줄이 지시 범위(레슨 두 파일 · `keyboardLabel` 하나)를 넘지 않는지.

## 폰 확인 제안
① 캡처 장면(뒤틀린 인식)에서 「번역 중…」 → 뜻 + 「알아들은 말을 그대로 옮겼어요」 ② 모범 답안과 똑같이 말하면 로딩 없이 뜻(힌트 없음) ③ 글자로 쓴 답의 뜻(힌트 없음) ④ 비행기 모드 → 「번역을 가져오지 못했어요 · 다시 가져오기」 → 켜고 누르기 ⑤ 말 모드 「가あ」 우측 끝·■ 마이크 오른쪽·처음 한 번 안내(회화방에서 이미 봤으면 안 뜸) ⑥ 판 열기 → 과제 문장 보임, 도우미 입력 중 아래 바 숨김 ⑦ 글자 모드 [입력창에 넣기] → 채우기만, Enter 로 확인 ⑧ 녹음·확인 중 「가あ」 → 잠금 토스트 ⑨ 확인 결과가 오면 판 닫힘, 다시 열면 마지막 답 ⑩ 토스트가 판·바 위로 뜨는지 ⑪ 360px 빈 입력창 높이 ⑫ ■ 아이콘 크기 변화가 눈에 띄는지 ⑬ 챌린지 난이도가 프로필과 다른 레슨에서 도우미 표현 수준(감사 Low-2).

## Developer 기록
- [22:22] 착수. 이력서·screens §34·UI-1/서버 A·B/감사 기록·StageSpeak·useLessonVoice·LessonScreen·공용 부품(VoiceBar·Composer·usePhraseHelper·Panel·Button·Tip)·TalkRoom 배선 읽음. 미러 `~/.node-local/thekaiwa-dev077u2` src = 저장소 src(diff 0) 확인.
- [22:32] 체크포인트 — 구현 완료(tsc 0 · eslint 0, 미러). 기준선(변경 전) 영향 시험 61파일 629/629.
- [22:38] 새 시험 34개 통과 · 변경 후 영향 시험 663/663 · `runSpeakCheck` 분리(도우미 닫기·되돌리기를 동작 시험으로).
- [22:46] 완료 — 전체 4516(fail 0·skip 5) · next build 0 · 변이 30/30 포착(임시 미러 복원 확인). 임시 미러 `~/.node-local/thekaiwa-dev077u2-mut`(node_modules 심볼릭 링크)는 남겨 둠 — 정리는 Leader 지시 시. 엔진명·직접 fetch·`window.Capacitor` 스캔 0(시험으로 고정).
  - 미커밋: 변경 4파일(`StageSpeak.tsx`·`LessonScreen.tsx`·`lessonCopy.ts`·`voiceSharedFrozen.test.ts`) + 새 7파일(`lessonVoiceView.ts`·`speakTranslation.ts`·`useSpeakTranslation.ts`·`SpeakTranslation.tsx`·`speakCheck.ts`·시험 2) + 이 기록.
  - Leader 확인 필요(선택) 2건: ① 인식 오류 띠 「글자로 답하기」에도 입력창 초점을 줄지(회화방은 줌, 지금 레슨은 안 줌 — 그대로 둠) ② 일본어 글자 없는 말의 #185 호출 생략(감사 Info-2 — 그대로 둠).

## REV-077U Low-1 보강

감사 REV-077U 의 Low-1(변이 M11·M13 생존)만 닫았다. **시험만 보강 — 제품 코드·서버·docs·다른 시험은 건드리지 않음.** 변경 파일 1개: `src/components/lesson/__tests__/task077LessonSpeak.test.ts`(기존 단언 변경 0, 새 `test` 2개 + 조각 추출 헬퍼 `between` 1개 추가).

### 추가한 단언 (소스 스캔 — 렌더러 없음, 기존 방식 그대로)

| 시험 | 고정하는 것 | 정규식·검사 |
|---|---|---|
| 「도우미 안내 말풍선 … (M11)」 | 버튼 `aria-describedby` 는 안내 말풍선이 보일 때만, 글자 모드에서는 안내도 가리킴도 없음 | ① `const tipShown = tipOpen && …(중간 항 자유)… && !textMode` 줄 끝까지 ② `describedBy={tipShown ? HELPER_TIP_ID : undefined}` ③ `{tipShown ? <PhraseHelperTip onClose={…} /> : null}` ④ `HELPER_TIP_ID` 출현이 정확히 2번(import 와 가드 걸린 describedBy) — 가드 없는 곳이 하나 더 생기면 실패 |
| 「도우미 판 열기 … (M13)」 | 맞춤 표시는 열기 클릭에서만 켜고, 판이 보일 때 한 번 소비해 가려진 과제 카드 머리로 맞춘다 | ① `toggleHelper` 조각 안에 `alignOnOpenRef.current = true` 바로 뒤 `helper.setOpen(true)` ② `alignOnOpenRef.current = true` 가 파일에서 정확히 1번 ③ `onToggle={toggleHelper}` ④ 소비 효과(`alignOnOpenRef` 선언 ~ `tipShown` 사이)에 `useLayoutEffect(() => { if (!helper.shown \|\| !alignOnOpenRef.current) return; alignOnOpenRef.current = false` · `taskSentenceHidden({…}))` 뒤 `cardRef.current?.scrollIntoView({ block: 'start' })` · `}, [helper.shown])` ⑤ 효과가 읽는 세 ref(`scrollRef`·`cardRef`·`targetsLabelRef`) 가 DOM 에 붙어 있음 |

`between(src, from, to)` 는 두 표지가 없으면 시험을 실패시킨다(빈 조각으로 조용히 통과 방지).

### 변이 재현 — 6개 전부 포착

변이 미러 `~/.node-local/thekaiwa-dev077u2-mut`(시작 때 저장소 `src` 와 `diff -rq` 비교 → 서버 시험 2파일만 달라 임시 파일 + `os.replace` 로 맞춘 뒤 동일, 소스 link 수 1). 변이마다 임시 파일 + `os.replace` 로 쓰고 시험 파일 실행, `finally` 에서 저장소 원본으로 복원. 기준선 19/19(기존 17 + 새 2).

| # | 변이 | 결과 | 잡은 시험 |
|---|---|---|---|
| M11 | 안내 가드에서 `&& !textMode` 제거 (감사자 변이 재현) | **포착** (pass 18 · fail 1) | M11 시험 |
| M13 | `alignOnOpenRef.current = true` 줄 삭제 (감사자 변이 재현) | **포착** (pass 18 · fail 1) | M13 시험 |
| M11b | 안내 가드를 항상 true 로 (`const tipShown = true`) | **포착** | M11 시험 |
| M13b | 맞춤 효과의 `scrollIntoView` 호출 제거 | **포착** | M13 시험 |
| M11c | (추가) `describedBy` 가드 제거 → `describedBy={HELPER_TIP_ID}` | **포착** | M11 시험 |
| M13c | (추가) 과제 카드 `ref={cardRef}` 떼기 | **포착** | M13 시험 |

복원 확인: `cmp` 저장소 `StageSpeak.tsx` = 변이 미러 동일, `diff -rq src` 미러와 동일, 임시 파일 잔재 없음, 변이 미러 소스 link 수 1.

### 증빙 (개발 미러 `~/.node-local/thekaiwa-dev077u2` — 시험 파일은 임시 파일 + `mv` 로 반영, `cmp` 동일)
- `./node_modules/.bin/tsc --noEmit` → exit 0
- `./node_modules/.bin/eslint src/components/lesson/__tests__/task077LessonSpeak.test.ts` → exit 0
- `node --import tsx --test --test-concurrency=1 src/components/lesson/__tests__/*.test.ts`(8파일, 가짜 `DATABASE_URL`) → **tests 94 · pass 94 · fail 0 · cancelled 0 · skipped 0** · exit 0
- 제품 코드 변경 0 — `StageSpeak.tsx` 는 읽기만 했다.

### 남은 한계
- 이 두 시험도 소스 스캔이라 «글자 그대로의 배선»을 고정한다(렌더러 없음 — 기존 알려진 한계와 같은 계열). 같은 뜻의 다른 식으로 고쳐 쓰면 시험이 먼저 깨져 사람이 의도를 다시 확인하게 된다.
- 임시 미러 두 개(`…-dev077u2`·`…-dev077u2-mut`)와 변이 스크립트(스크래치패드 `mut077u2.py`)는 남겨 둠 — 정리는 Leader 지시 시.

- [23:08] REV-077U Low-1 보강 완료 — 새 단언 2개 · 변이 6/6 포착 · 레슨 시험 94/94 · tsc 0 · eslint 0.

## 입력창 문구 단축(사용자 결정 2026-10-19)
- [23:47] 오늘의 회화 ⑤ 글자 입력창 placeholder 를 「일본어로 써서 답해 보세요」 → 「일본어로 답해 보세요」 로 단축(360px 두 줄 → 한 줄). 바꾼 곳: `src/components/lesson/lessonCopy.ts` `U5.inputPlaceholder` 한 줄(사용처 `StageSpeak.tsx` 562행 한 곳뿐 — `grep inputPlaceholder src` 로 확인), 고정 단언 `task077LessonSpeak.test.ts` 250행, Composer 시험용 임의 값 `task077ComposerOptions.test.ts` 85행(이 시험은 문구에 의존하는 단언 없음, 값만 맞춤).
- 증빙(미러 `…-dev077u2`, 저장소와 `diff -rq src` 동일·임시 파일+`mv` 반영, 소스 link 1): `tsc --noEmit` 0 · `eslint` 변경 3개 0 · 레슨 시험 94/94 · composer 시험 8/8 · `grep "일본어로 써서 답해 보세요" src` 0건. 회화방·역할극·질문 탭 placeholder·docs·데모는 건드리지 않음.
