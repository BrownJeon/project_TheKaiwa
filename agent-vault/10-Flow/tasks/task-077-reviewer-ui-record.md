---
task_id: task-077
role: reviewer
review_id: REV-077U
step: UI-1 + UI-2 화면 감사
verdict: PASS_WITH_NOTES
tags:
  - type/task-record
  - domain/lesson
  - domain/speech
created: 2026-10-18
updated: 2026-10-18
---

# task-077 화면 감사 REV-077U (UI-1 공용 부품 + UI-2 레슨 ⑤ 배선) — [[task-077-improve-lesson-speak-translation-helper]]

## 한 줄 판정
**PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 0 · Low 3 · Info 9. 회귀 0(L3)은 변경 전 트리와의 차등 렌더 23,328조합 바이트 동일로 확인했고, 합쳐진 전체 상태(서버 A·B + UI-1 + UI-2)의 tsc 0 · eslint 0 · 전체 시험 4522(실패 0) · `next build` 0. 화면 규칙(A1~A5·B1~B8·B6-Q)은 승인 데모·§34 와 어긋난 곳이 없다. 남은 것은 시험 구멍 2개와 실기기에서만 보이는 항목들이다.

## 증빙 재실행 — 서버 A·B + UI-1 + UI-2 가 합쳐진 전체 상태 (첫 재실행)
미러 `~/.node-local/thekaiwa-rev077u` — 시작·끝 모두 `diff -rq src <저장소 src>` 차이 0, node_modules 만 하드링크, 소스(`StageSpeak.tsx`)·`tsconfig.tsbuildinfo` link 1. 변이는 별도 복사본 `~/.node-local/thekaiwa-rev077u-mut`(src 복사 + node_modules 심볼릭 링크)에서만 했고 끝난 뒤 미러와 `diff -rq` 동일. 저장소 원본은 이 기록 파일 외 변경 0.

| 명령 | 결과 |
|---|---|
| `./node_modules/.bin/tsc --noEmit` | exit 0 |
| `./node_modules/.bin/eslint src/components src/app src/modules src/types` | exit 0 |
| 전체 시험 `find src scripts/seed-build -name '*.test.ts' \| sort` → `node --import tsx --test --test-concurrency=1`, 가짜 `DATABASE_URL` | **tests 4522 · pass 4517 · fail 0 · cancelled 0 · skipped 5** · exit 0 · 281s (UI-2 개발자 4516 + 서버 Low-1 후속 시험 6 — 합쳐진 상태) |
| `./node_modules/.bin/next build > log 2>&1` | **exit 0** · 경로표에 `ƒ /api/v1/lessons/[id]/phrase-help`·`ƒ /api/v1/lessons/[id]/speaking-translation` · 경고 3 = 기존 「Dynamic filesystem access」(페르소나·엔진 파일 추적, 무관) |
| 영향 시험 묶음(새 4파일 + `voiceSharedFrozen` + `phraseHelperRender/Logic/TurnLock` + `display`, 변이 기준선) | 127/127 |
| 데모 게이트 `check.mjs check --task …task-077…md` | `DEMO_GATE_PASSED` (approved v1, hash verified). `evidence.jsonl` 48줄: kind `approve` v1, `prompt_ts` 21:43:07 < 기록 21:44:34, 승인 인용 해시 있음 — 에이전트가 `approve`·`waive` 를 대신 실행했거나 `state/demo-gate/` 를 직접 쓴 흔적은 이 감사에서 확인되지 않음 |

## 항목 A~I 판정

| 항목 | 판정 | 요약 (근거는 아래 상세) |
|---|---|---|
| A 회귀 0 (L3) | **PASS** | 호출부·도우미 4부품 수정 0 · 기본 마크업 차등 렌더 동일 · `voiceSharedFrozen` 수정 범위 확인 |
| B 레슨 ⑤ 하단·도우미 | **PASS** | B1~B8·B6-Q 구현이 §34 와 일치, 기존 동작 보존, `restore` 경로 있음 |
| C 번역 줄 | **PASS_WITH_NOTES** | A1~A5 일치. Low-2(취소 직후 같은 틱 재요청), Low-3(결정 2) |
| D 높이·토스트 | **PASS** | 하단 묶음 `ResizeObserver` + 12px, 초기 136, 정리 있음, 회화방 값 불변 |
| E 결정·변화 판단 | **PASS** | ① 허용 ② 승인 사항과 일치 ③ 결함 아님 ④ 결함 아님(후속 제안) |
| F 접근성·모바일·6층 | **PASS** | 새 파일에 직접 fetch·Capacitor·엔진명 0, 서버 모듈 import 0 |
| G 시험 | **PASS_WITH_NOTES** | 규칙을 손으로 적은 표로 묶음. 변이 18개 중 16 포착 · 생존 2 = Low-1 |
| H 증빙 재실행 | **PASS** | 위 표 |
| I QA 전달 | 아래 목록 | |

### A. 회귀 0 (최우선, L3)
- **호출부**: `git status` 상 수정된 `src/components` 파일은 `chat/Composer`, `talk/{VoiceBar,usePhraseHelper,helperCopy,phraseHelperLogic}`, `talk/__tests__/voiceSharedFrozen.test.ts`, `lesson/{StageSpeak,LessonScreen,lessonCopy}` 뿐이다. `TalkRoom`·`ChatRoom`·`ask/useAskInput`·`scenario/*`·`vocab/*`·`PhraseHelperPanel/Card/Button/Tip` 는 수정 0 (UI-1 의 「호출부 0줄」 주장 사실).
- **새 선택 prop 기본값 = 변경 전**(diff 직접 확인): `VoiceBar` `stopLabel = TALK_ROOM.stopTeacher`·`statusId = TALK_STATUS_ID`; `Composer` `enterSends = 'finePointer'`·`sendLabel = '보내기'`·`draftKey ?? KEYS.draft(chatId)`; `usePhraseHelper` `request` 분기는 `ask` 안에서 기본 #180 호출 줄 **앞**에 `if (custom)` 로만 추가(기본 줄은 글자 그대로), `ended?`·`onEnded?.()`; `helperCopy`·`phraseHelperLogic` 는 값 추가·유니온 확장뿐(`helperLockReason('talk' 계열)` 반환값 불변). `Composer` 의 Enter 판단은 변경 전 순서(Enter → 조합/229 → Shift → 정밀 포인터)와 같은 순서로 `enterSubmits` 에 옮겨졌고 매체 질의는 「그냥 Enter」일 때만 한다.
- **독립 차등 렌더**(UI-1 의 「93종 바이트 동일」 증빙을 믿는 대신 직접 재현): `git archive HEAD` 트리와 작업 트리에서 같은 하네스(`renderToStaticMarkup`)를 돌렸다. `VoiceBar` **23,040조합**(상태 6 × 인식 단계 5 × 잠금 × ■ × ⌨ 잠금 × sub 4 × 도우미 칸 × safeBottom 3 × keyboardLabel 2 × cancelOutside 2) + `Composer` **288조합**(busy × 막힘 × leading × lang × safeBottom × 이름·사유) = **23,328조합 전부 바이트 동일**. `HELPER` 문구는 HEAD 키 전부 동일(새 키 `lockedCheck` 하나만 추가), `helperLockReason/Locked/Toast/PanelShown` 출력 동일. 하네스는 HEAD 측 `helperCopy` 만 `lockedCheck` 가 없어 실제로 HEAD 트리를 읽었음이 확인됨.
- **`voiceSharedFrozen` 수정**: 8줄(+7 −1), 4번째 시험 소스 스캔 반복 한 곳. `keyboardLabelOk = Set([StageSpeak.tsx, useLessonVoice.ts])` 이고 `bad === 'keyboardLabel' && keyboardLabelOk.has(f)` 일 때만 건너뜀. 다른 금지어(`cancelOutside`·`safeBottom`·`textOf=`·`canResend`·`caption=`)·다른 파일(`TalkRoom`·`StageApply`·`EvalItems`·`MicTestCard`)은 그대로 금지, 시험 이름·21종 고정 마크업 시험·픽스처 JSON 수정 0(`git status` 에 픽스처 변경 없음). 허용 목록의 `useLessonVoice.ts` 는 지금 `keyboardLabel` 이 0건(Info-4 — 필요 이상으로 넓음).
- 영향 시험(talk·chat·ask·vocab 도우미·scenario) 전부 전체 시험 4522 안에서 통과.

### B. 레슨 ⑤ 하단·도우미 (B1~B8, B6-Q)
`StageSpeak.tsx` 를 변경 전(`git show HEAD:`)과 대조했다.
- 음성 모드 = 공용 `VoiceBar`(`lessonVoiceView`, `trailing` 도우미, `keyboardLabel`·`stopLabel`·`statusId`). 변경 전 레슨 말 바와 20조합 바이트 대조 시험이 있고(알려진 차이 2개만), 제가 읽은 diff 와 일치. 글자 모드 = 공용 `Composer`(`key={item.id}`·`draftKey`=`LESSON_KEYS.speakDraft`·`enterSends="always"`·`sendLabel`=확인하기·`busy={checking}`·`leading`=🎤+도우미) — 구조가 `TalkRoom` 의 Composer 감싸기(`<div hidden={helper.typing} className="contents">`)·말 바 감싸기(`helper.typing ? null : <div className="relative flex-none">` + Tip)와 같다.
- 요청 = `phraseHelpRequest('/api/v1/lessons/:id/phrase-help')`(#184, `ended`·`onEnded` 안 넘김). 잠금 = `lessonHelperLockReason(voice.phase, checking)` — starting/recording/finishing → voice, 확인 중 → check, 토스트 2종(녹음 중이면 끝난 뒤 `deferredLockToastRef`).
- **#62b 결과가 오면 판 닫힘(결과는 기억)**: `runSpeakCheck` 가 성공 뒤 `closeHelper()`; 시작에 `cancelHelper()`; 마이크 누름 `onPress` 에 `helper.cancelPending()`; 건너뜀·[다음 과제] 는 `goNext` 가 `helper.close()`. 너무 짧은 녹음(빈 결과)은 `check` 를 부르지 않아 판 유지(§34-5).
- **글자 답 소실 방지**: `Composer.submit` 은 `setText('')` 뒤 `onSend(원문)` 이므로 `check` 의 조기 반환(`checking||reviewing`)과 `runSpeakCheck` 실패 경로가 `restore(raw)` 를 부른다. `ComposerHandle.restore` 는 입력창이 비어 있을 때만 되돌려 사용자가 새로 쓴 글을 덮지 않는다. 변이 M8 이 포착.
- B6-Q: `enterSends="always"` + IME(`isComposing`·229)·Shift 제외 — 변경 전 레슨(Shift 없으면 확인)과 같고 IME 229 만 보강. 빈 칸 확인 = 단추 흐림·아무 일 없음(§34-3 표의 승인 사항).
- 처음 한 번 안내: 회화방과 같은 저장 키(`claimHelperTip`), 말 모드 입력 바가 처음 그려진 뒤 한 번 판정하되 인식 설정(#19) 읽기 전(`config===null && !textFirst`)에는 보류 — 글자 모드로 시작할 사용자가 안내를 소진하지 않게 하는 합리적 보강(Info-6).
- 도우미 입력 중(`helper.typing`) 말 바·글자 바 숨김(초안·핸들 유지), [입력창에 넣기] 는 채우기만(`fill`) 후 초점은 입력창으로, ✕·Esc 는 도우미 버튼으로.
- 기존 동작 보존: 인식 흐름·누르고 말하기·글자↔말 전환(⌨ 로 바꿀 때만 입력창 초점, 처음부터 글자 모드는 초점 없음)·초안 복원(마운트 때 한 번 읽음)·건너뛰기·막힘 문구·`resultRef` 초점/스크롤 모두 변경 전과 같다. 의도된 차이(승인): 빈 칸 토스트 제거, 초안 300ms 디바운스, 높이 136, 1,000자.

### C. 번역 줄 (A1~A5)
- 같으면(`compareAnswer(...).kind==='same'` 이고 `modelKo` 가 있음) AI 호출 0·`modelKo` 즉시, 다르면 #185 `{text}` 1회(`itemId` 안 보냄 — 변이 M16 포착), 저장 없음.
- 자동·비차단: 결과 줄·모범 답안·[다음 과제]는 번역과 무관하게 동작. 캐시 `Map<text,ko>` 는 `LessonStages` 의 `useSpeakTrCache`(수업 화면 동안). 단계 이동 뒤 같은 글은 다시 묻지 않는다.
- **취소**: `createSpeakTranslator` — 동시 1건, 대상이 바뀌거나(새 시도·다음 과제·결과 없음) 잠금(녹음·인식·확인 중)이면 `AbortController.abort()` 로 서버 잠금을 풀고(서버 409 `CANCELLED` 는 화면이 이미 버려 줄이 없음), 12초 상한(`timedOut` 이면 실패 줄), 늦은 답은 `mine()` 으로 버림, 잠금이 풀리면 다시 묻고, 실패한 대상은 저절로 다시 묻지 않고 [다시 가져오기]로만. 새 시도는 `seq` 로 키가 달라져 같은 글을 다시 말해도 새 결과로 본다. **상호작용**: 곧이은 [다시 가져오기]는 사람의 클릭이 서버의 `finally` 잠금 해제보다 훨씬 늦어 BUSY 가 되지 않는다. 다만 `sync` 가 `abort()` 와 새 `start()` 를 같은 틱에 하는 경로가 하나 있다 → **Low-2**.
- 오류 표: 0·5xx·502·422·12초 → 실패 줄 + [다시 가져오기] · 429 → 한도 줄 + 단추 · 409 `TRANSLATION_BUSY` → 바쁨 줄 + 단추 · 409 `CANCELLED` → 빈 칸 · 400·404 → 「이 말은 번역할 수 없어요」(단추 없음) · 그 밖 409 → 실패. §34-7 표와 일치(`speakTrFailureOf` 표 시험).
- **A4 ★ 모양**: 말풍선 안 한글 발음 줄(`HangulLine !mt-0`) 바로 아래 `SpeakTranslation` — `mt-2 border-t border-ink/18` · `pt-2 text-[15px] leading-normal text-ink2` · 시각 숨김 「한국어 뜻: 」 · `aria-live="polite" aria-atomic` 늘 마운트. 회화방 `UserTranslation` 과 클래스 문자열이 같다(`TR_LINE` 상수는 복제 — Info-5). **힌트** 「알아들은 말을 그대로 옮겼어요」는 `via==='voice' && state.ok && state.ai` 일 때만(글자 답·모범 답안 뜻·실패에는 없음 — M2·M28 포착).
- 새 문구: `U5.trSr`·`U5.trHeard`·`HELPER` 레슨 분기·`lockedCheck` 뿐. 오류·준비 문구는 `DISPLAY_COPY.userTr` 재사용. 번역 표시 스위치와 무관(`showTranslation`/`useDisplayPrefs` 사용 0 — 시험).
- 건너뛴 과제: 말풍선이 없고 `trPlan.kind==='skip'` 이라 칸·요청 0. 「끝낸 단계 다시 보기」: 입력 영역 없음(도우미 없음) · 번역 칸은 같은 규칙으로 보이고 요청도 자동(§34-2 와 일치). 다시 보기에서 과제 탭 3개를 오가면 불러온 결과마다 #185 를 부를 수 있다(캐시로 중복 없음).

### D. 높이·토스트 (B8)
- 하단 묶음 `div ref={stackRef} className="flex-none"` 에 `ResizeObserver`(`typeof ResizeObserver === 'undefined'` 가드, 언마운트 `disconnect`), 다시 보기·입력 영역 없음은 `null`. `lessonToastBottom(stage, h)`: 5단계 외 24 · 재기 전·NaN·0 이하·다시 보기 136 · 그 밖 `round(h)+12`. `LessonScreen` 은 `stage === 5 ? 136 : 24` 하드코딩 제거(시험 확인). 회화방 토스트 값(136·84)은 `TalkRoom` 미수정이라 불변.
- 판을 열 때 과제 문장이 가려져 있으면 한 번만 과제 카드 머리로: `useLayoutEffect([helper.shown])` + `alignOnOpenRef`(열기 클릭에서만 true) + `taskSentenceHidden`(±1px). 판 최대 높이는 `PhraseHelperPanel`(미수정) 의 `min(46dvh,320px)` 그대로. 이 효과의 **연결**(M13)은 시험이 못 잡는다 → Low-1.

### E. 보고된 변화 · 결정 2건
1. **■ 아이콘 안쪽 네모 14→12 단위(24 viewBox)**: 18px 아이콘 기준 10.5px→9px, 44px 버튼·배경은 그대로. 승인된 「회화방과 같은 배치」(공용 `VoiceBar`)의 직접 결과이고 시험이 알려진 차이로 고정. 데모 분류 = **implementation**, 허용. 폰 확인에서 거슬리면 상수 한 곳(`VoiceBar.StopIcon`)이지만 회화방도 같이 바뀌므로 바꾸지 않는 편이 안전.
2. **글자 모드 입력(빈 칸 확인 무반응·초안 300ms·높이 136)**: §34-3 「글자 입력 동작」 표의 승인 사항과 일치. 빈 칸일 때 확인 단추가 흐려지고(`aria-disabled`) Enter 도 무반응이라 «아무 반응 없음»이 «고장»으로 읽힐 위험은 작다. 죽은 상수 `U5.emptyToast` 만 남음(Info-3).
3. **결정 1(오류 띠 「글자로 답하기」는 입력창 초점 없음)**: 결함 아님. §34-3 은 ⌨ 만 초점을 적었고 이 단추는 변경 전에도 초점이 없었다. 회화방은 띠에서도 주므로 어긋남은 있으나 Leader 판정 «현행 유지»에 동의. 사용자가 불편해하면 `onTextMode` 에 `focusTextRef.current = true` 한 줄.
4. **결정 2(일본어 글자 없는 글자 답도 #185 호출)**: 승인 데모와 일치하므로 결함이 아니다. 다만 한국어로 친 답이면 서버가 502 `TRANSLATION_REJECTED` 를 돌려 «번역을 가져오지 못했어요 · 다시 가져오기» 가 뜨고, 단추를 눌러도 같은 결과일 가능성이 높아 단추가 약속하지 못하는 일을 약속한다(+한도 소모 1회). → **Low-3**, 후속 권고.

### F. 접근성·모바일 UI·6층
- 터치: 새 [다시 가져오기] `h-11`·폭 ≥44(음수 마진 보정), 도우미 버튼/판 부품은 미수정 공용, ⌨/🎤 `h-11 w-11`. 화면당 스크롤 1곳(본문 `overflow-y-auto`), 판은 본문 위가 아니라 **아래 묶음에 접힘 없이** 들어가고 안쪽 스크롤은 회화방 판 그대로. `min-w-0`·`break-keep [overflow-wrap:anywhere]` 번역 칸, `env(safe-area-inset-bottom)`/`var(--safe-bottom)` 는 공용 부품이 담당.
- 낭독: 번역 칸 `aria-live="polite" aria-atomic` + 시각 숨김 「한국어 뜻: 」, 준비 막대 `aria-hidden`(공용 `HangulPlaceholder`) + 「번역 중…」, [다시 가져오기] 누르면 칸으로 초점, 도우미 버튼 `aria-label/expanded/controls/describedby`·잠김 `aria-disabled` 는 공용 부품 그대로, 본문 `aria-live=off`(녹음 중), 초점 순서는 DOM 순서(본문 → 판 → 안내 → ⌨ → 마이크 → ■ → 도우미 / 글자: 🎤 → 도우미 → 입력창 → 확인하기) 가 데모 낭독 표와 같다. 안내 말풍선의 `aria-describedby` 는 글자 모드에서 빠진다(`!textMode`) — 그러나 시험이 못 잡는다(M11, Low-1).
- 엔진명·모델명 노출: 새 파일 5 + `StageSpeak`·`LessonScreen` 정규식 스캔 0(시험 고정), 직접 `fetch(`·`window.Capacitor` 0, API 는 `apiPost` 경유. 새 컴포넌트 파일은 `@/modules/*` 를 import 하지 않는다(6층 — 컴포넌트가 서버 모듈을 끌어오지 않음; 기존 `@/modules/infra/native`·`@/modules/speech/stt/client` 타입 import 는 변경 전부터).
- 데모 대비 분류: material 0 · implementation 1(■ 아이콘 크기) · defect 0.

### G. 시험
- 새 시험(화면): `task077SpeakTranslation`(17), `task077LessonSpeak`(17), `task077SharedHelper`(19), `task077ComposerOptions`(8). 규칙은 손으로 적은 표(번역 계획 13행·오류 15행·`lessonVoiceView` 9행·토스트 10행·Enter 96조합·잠금 이유)로 묶고, 마크업은 «변경 전 레슨 말 바를 HEAD 줄 그대로 옮긴 것»과 대조(구현 식 되풀이 아님). 소스 스캔은 배선 확인에만 쓰였다(이 점이 알려진 한계 — 렌더러 없음). 기존 시험 약화 없음: `voiceSharedFrozen` 은 위 한 곳만, `display.test.ts`(B_FILES 포함) 통과.
- **직접 변이 18개**(`thekaiwa-rev077u-mut`, 파일마다 임시 파일 + `os.replace`, 끝난 뒤 `diff -rq` 미러와 동일) — **16 포착 · 2 생존**:

| # | 변이 | 결과 | 잡은 시험 |
|---|---|---|---|
| M1 | 같으면 AI 호출(같음 판정 무시) | 포착 | translationPlan 표 |
| M2 | 힌트가 글자 답에도 | 포착 | speakTrHint · 번역 칸 마크업 |
| M3 | abort 누락 | 포착 | 수명주기 3개 |
| M4 | 캐시 무시 | 포착 | speakTrView |
| M5 | #62b 결과 뒤 판 안 닫음 | 포착 | runSpeakCheck 2개 |
| M6 | 토스트 오프셋 136 고정 | 포착 | lessonToastBottom |
| M7 | `Composer` `enterSends` 기본값 → always | 포착 | Composer Enter 배선 시험 |
| M8 | `restore` 누락 | 포착 | runSpeakCheck 2개 |
| M9 | `VoiceBar` 기본 `stopLabel` 변경 | 포착 | voiceSharedFrozen·SharedHelper 5개 |
| M10 | `finishing` 을 잠금에서 제외 | 포착 | lessonHelperLockReason |
| **M11** | 안내가 글자 모드에도(`!textMode` 제거) | **생존** | — |
| M12 | 번역 칸 `aria-live` 제거 | 포착 | 번역 칸 마크업 2개 |
| **M13** | 판 열 때 카드 맞춤 누락(`alignOnOpenRef.current = true` 삭제) | **생존** | — |
| M14 | 400 을 막힘이 아닌 실패로 | 포착 | speakTrFailureOf · 수명주기 오류 |
| M15 | `onEnded!()`(onEnded 없는 레슨에서 ENDED 예외) | 포착 | 주입 경로 결말 시험 |
| M16 | #185 본문에 `itemId` | 포착 | speakTrRequest |
| M17 | 잠금 중에도 번역 유지(`paused:false`) | 포착 | 배선 스캔 |
| M18 | 힌트 문구 변경 | 포착 | 번역 칸 마크업 |

## 발견

| ID | 심각도 | 위치 | 내용·근거 | 권고 |
|---|---|---|---|---|
| Low-1 | LOW | `StageSpeak.tsx:279`(`tipShown` 의 `!textMode`)·`:286`(`alignOnOpenRef.current = true`) | 두 배선이 변이에서 생존했다(M11·M13). 코드는 지금 옳다(회화방은 REV-191 I-1 로 같은 `mode === 'voice'` 가드가 있다). 가드가 빠지면 글자 모드의 도우미 버튼 `aria-describedby` 가 DOM 에 없는 id 를 가리키고, 카드 맞춤이 빠지면 판을 열 때 과제 문장이 가려진 채 남는다. 개발자가 인정한 「스캔으로만 잡는 변이의 한계」와 같은 계열 | 스캔 시험 두 줄 추가: `tipShown = tipOpen && … && !textMode` 정규식, `alignOnOpenRef.current = true\s+helper.setOpen(true)` 정규식. QA 이전이면 좋지만 차단 사유는 아님 |
| Low-2 | LOW | `speakTranslation.ts` `sync`(fetch→fetch 대상 교체)·서버 `lessonTranslation.ts:94` | 대상이 한 fetch 결과에서 다른 fetch 결과로 곧바로 바뀌면 `abort()` 직후 같은 틱에 새 #185 를 보낸다. 서버의 사용자당 동시 1건 잠금은 엔진 호출이 중단된 뒤 `finally` 에서 풀리므로 아주 좁은 틈에 409 `TRANSLATION_BUSY` → 바쁨 줄이 뜰 수 있다. 실제 경로는 「끝낸 단계 다시 보기」에서 과제 1·2·3 탭을 빠르게 갈아탈 때뿐이다(새 시도는 마이크 누름에서 먼저 잠금으로 끊고, 12초 뒤 재시도는 사람 클릭). 바쁨 줄의 [다시 가져오기]로 스스로 풀리고 흐름은 막히지 않는다 | 선택: 직전 요청을 우리가 끊은 직후 BUSY 가 오면 ~300ms 뒤 한 번 자동 재시도, 또는 교체 시 새 요청을 다음 틱+짧은 지연 뒤로 미룸. QA 가 다시 보기 탭 연타로 빈도를 보고 필요하면 |
| Low-3 | LOW | `translationPlan`(`speakTranslation.ts`)·결정 2 | 일본어 글자(히라가나·가타카나·한자)가 하나도 없는 글자 답(한국어로 친 답 등)도 #185 를 부른다 → 서버 502 `TRANSLATION_REJECTED`(서버 감사 Info-2) → 「번역을 가져오지 못했어요 · 다시 가져오기」. 승인 데모대로라 결함은 아니나 한도 1회와 의미 없는 재시도 단추를 쓴다 | 후속(IMP 후보): 일본어 글자 없으면 요청 생략 + 칸 없음 또는 막힘 줄(단추 없음). 사용자 결정 사항 — 이번 배포에 넣지 않아도 됨 |
| Info-1 | INFO | `StageSpeak.tsx:138`(초안 흐름)·`Composer.tsx:125` | 글자 답을 보낸 뒤 300ms 안에 마이크 모드로 바꾸는 등 Composer 가 언마운트되면 디바운스 타이머가 정리돼 방금 보낸 글이 세션 초안에 남는다(변경 전 레슨은 성공 즉시 지움). 회화방과 같은 동작이고 과제 키별 세션 저장이라 영향 작음 | 조치 불필요, 폰 확인에서 이상하면 |
| Info-2 | INFO | 데모 분류 | ■ 아이콘 안쪽 네모 14→12(implementation) | 허용(E-1) |
| Info-3 | INFO | `lessonCopy.ts:385` | `U5.emptyToast` 는 이제 쓰는 곳 0(개발자 기록에 명시). 죽은 상수 | 다음 정리 때 제거 |
| Info-4 | INFO | `voiceSharedFrozen.test.ts` 예외 | 허용 목록에 `useLessonVoice.ts` 가 있으나 그 파일은 `keyboardLabel` 0건 — 필요 이상으로 넓다(지시 범위 안) | 사용하는 파일만 남기고 싶으면 한 항목 삭제(시험이 두 파일을 글자로 고정하고 있어 같이 수정) |
| Info-5 | INFO | `SpeakTranslation.tsx:14` ↔ `MessageBubble.tsx:94` | `TR_LINE = 'mt-2 border-t border-ink/18'` 이 두 곳에 복제(§34-9 는 공용 상수 추출을 제안했으나 회화방 무수정 원칙으로 복제). 값이 지금은 같고 동기화 시험은 없다 | 선택: 같은 값임을 고정하는 한 줄 시험 |
| Info-6 | INFO | `StageSpeak.tsx:254` | 안내(Tip) 판정을 인식 설정 읽기 전에는 보류 — 글자 모드로 시작할 사용자에게 안내를 소진시키지 않는 합리적 보강(회화방은 방 준비 뒤 판정) | 유지 |
| Info-7 | INFO | `via` 파생 | 서버에서 불러온 결과는 `via` 를 `utteranceId` 유무로 만든다(`StageSpeak.tsx:103`). 말로 답했지만 발화가 저장되지 않은 결과는 다시 열었을 때 「글자」로 보여 힌트 「알아들은 말을 그대로 옮겼어요」가 빠질 수 있다 | 조치 불필요 |
| Info-8 | INFO | 문서 | `docs/screens.md` 는 §34 만 추가(+155)되고 §12-2 J(⑤ 말하기)·§22(회화방 도우미)에 §34 로의 정정이 없으며 변경 이력 머리에 task-077 줄이 없다(§34 머리가 「승인 뒤 구현 때 정정」이라 약속). `api-contract.md` 는 서버 감사에서 확인 | Leader 문서 정리 |
| Info-9 | INFO | 폰 확인 | 360px 에서 placeholder 「일본어로 써서 답해 보세요」가 두 줄이 되어 빈 입력창이 48→70px(승인 ★ = 지금 문구 그대로, 데모 실측). 회화방 빈 입력창도 같은 계산(데모 부수 발견, 범위 밖) | 폰 확인 항목, 한 줄 단축은 상수 한 줄 |

## 직접 확인하지 못한 것 (정직한 한계)
- 렌더러(jsdom 등)가 없어 `StageSpeak` 의 효과·초점·`ResizeObserver`·스크롤 맞춤은 시험으로도 제가 실행해 보지 못했다 — 코드 읽기와 소스 스캔·순수 함수 시험으로만 확인했다. 실측은 QA.
- 서버 측 취소→잠금 해제의 실제 지연은 측정하지 못했다(Low-2 는 코드 구조 기반 추론 [가능성 높음]).

## QA high_risk_areas (실서버·실기기에서만 알 수 있는 곳)
1. **판이 열린 채 상태 변화**: 판이 열린 채 #62b 결과 도착 → 닫힘·다시 열면 마지막 답 / 판 열림 중 녹음 시작 → 대기 요청 취소 안내 / 글자 모드에서 확인 실패(서버 오류·네트워크 끊김) → 입력창에 원문 복원 / 인식 오류 띠 → 판 닫힘.
2. **360/390/412 × 글꼴 100/130% × 780/892px 높이**: 판이 열렸을 때 본문 높이(데모 실측 226px), 판을 열 때 과제 문장 카드 머리 맞춤(스크롤 위치별), 토스트 위치(판 열림·닫힘·키보드 중), 키보드가 올라온 상태에서 입력 바·판, placeholder 두 줄로 빈 입력창 70px(질문 5).
3. **번역 실제 품질·지연**: 캡처의 뒤틀린 인식 문장, 반말, 긴 말(200자↑), 글자 모드 한국어 입력(502 반복, Low-3), 12초 vs 서버 15초, 같으면 네트워크 호출 0(개발자 도구), 힌트는 말로 한 답을 AI 가 옮겼을 때만.
4. **취소·상호작용**: 번역 대기 중 마이크 누름·다음 과제·[다시 가져오기] 연타 → 서버 `CANCELLED` 로 정리되고 바쁨 줄이 안 뜨는지, 「끝낸 단계 다시 보기」에서 과제 탭 연타(Low-2), 비행기 모드 후 재시도.
5. **한도 합산/독립**: #180+#181+#184 분당 10·하루 300 합산(회화방·단어 추가·레슨이 서로 429 를 유발), 번역 #185 분당 20 은 도우미 429 중에도 동작, 동시 3건(번역+회화방 번역+도우미) 지연.
6. **회귀(회화방·질문 탭·시나리오·단어 도우미·채팅)**: 모바일 Enter = 줄바꿈 / 데스크톱 Enter = 전송, 초안 복원, ■ 이름 「선생님 말 멈추기」, 상태 줄 id `talk-status`, 도우미 판·안내, 역할극 문구(rp), 질문 탭 `keyboardLabel`.
7. **TalkBack**: 번역 칸 낭독 순서(결과 줄 → 한국어 뜻), [다시 가져오기] 후 초점, 도우미 버튼 상태·잠금 토스트, ✕ → 도우미 버튼 / [입력창에 넣기] → 입력창 초점, 글자 모드 안내 `aria-describedby` 부재(M11 영역).
8. **앱(WebView)**: 키보드 inset·`--safe-bottom`, 온디바이스 STT 인식 중 도우미 잠금, 인식 설정 읽기 전 안내 판정, 처음 한 번 안내(회화방에서 이미 봤으면 안 뜸).
9. **초안**: 글자 모드 과제별 초안 보존·복원(300ms), 새로고침 뒤 복원, 보낸 직후 이탈(Info-1).
10. **서버 RequestTrace/로그**: 번역 원문·질의 원문이 단계·로그에 없는지(서버 감사 G-2 6번 이어서).

## 체크포인트
- [완료] 이력서·§34·승인 데모(낭독 표)·developer 기록 3종·서버 감사 「UI-2 주의」·변경 코드 전수(StageSpeak 전체, 새 파일 5, 공용 부품 diff)·HEAD 대조.
- [완료] 미러 증빙(tsc·eslint·전체 시험·build)·차등 렌더·변이 18·데모 게이트 check.
- 미커밋 대상: 이 기록 파일만(감사 중 코드·시험·문서 변경 0).
