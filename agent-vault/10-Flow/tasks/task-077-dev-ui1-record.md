---
task_id: task-077
role: developer
step: UI-1
title: "task-077 UI-1 — 하단 입력 영역·일본어 도우미 공용 부품 일반화(선택 prop·주입, 기본값 = 지금)"
tags:
  - type/task-record
  - domain/lesson
  - domain/speech
created: 2026-10-18
updated: 2026-10-18
---

# task-077 UI-1 developer 기록 — [[task-077-improve-lesson-speak-translation-helper]]

## 한 줄 요약
(DONE · risk MEDIUM — 공용 부품 변경) `VoiceBar`(■ 이름·상태 줄 id)·`Composer`(초안 키 전체·Enter 방식·보내기 이름)·`usePhraseHelper`(요청 함수 주입·`ended`/`onEnded` 선택)·도우미 문구(`'lesson'`·`lockedCheck`)·잠금 규칙(`'check'`·`lessonHelperLockReason`)을 **선택 prop·주입(기본값 = 지금)** 으로 넓혔다. 회화방·질문 탭·시나리오 호출부는 한 줄도 고치지 않았고, 기본 마크업·로직 93종이 변경 전(HEAD)과 바이트 동일, `voiceSharedFrozen` 포함 영향 시험 464/464 그대로 통과. **Leader 확인 필요 1건**(아래 「UI-2 가 막힐 곳」 ①).

## 변경 파일
| 파일 | 변경 | 기본값(= 지금) |
|---|---|---|
| `src/components/talk/VoiceBar.tsx` | 선택 prop `stopLabel`·`statusId` | `TALK_ROOM.stopTeacher`(「선생님 말 멈추기」)·`TALK_STATUS_ID`(`talk-status`) |
| `src/components/chat/Composer.tsx` | 선택 prop `draftKey`(chatId 와 택일)·`enterSends`·`sendLabel` + 순수 함수 `enterSubmits`·`composerDraftKey` export, props 타입 `ComposerProps` export | `chatId` → `KEYS.draft(chatId)` · `'finePointer'` · 「보내기」 |
| `src/components/talk/usePhraseHelper.ts` | `request` 주입(chatId 와 택일 타입) · `ended?`·`onEnded?` · `PhraseHelpRequest` 타입 · `phraseHelpRequest(path)` | `chatId` → #180 호출 줄 글자 그대로 · `ended` false · `onEnded` 없음 |
| `src/components/talk/helperCopy.ts` | `HelperRoomKind` 에 `'lesson'` · `placeholder/examples/noneExample.lesson` · `lockedCheck` | talk·rp 문구 불변 |
| `src/components/talk/phraseHelperLogic.ts` | `HelperLockReason` 에 `'check'` · `lessonHelperLockReason(phase, checking)` · `helperLockToast('check')` · `helperPanelShown` 의 `ended` 선택 | `helperLockReason`·`helperLockToast('voice'/'turn'/null)` 불변 |
| `src/components/talk/__tests__/task077SharedHelper.test.ts` | 새 시험 19개 | — |
| `src/components/chat/__tests__/task077ComposerOptions.test.ts` | 새 시험 8개 | — |

변경 없음(확인만): `PhraseHelperPanel`·`PhraseHelperCard`·`PhraseHelperButton`·`PhraseHelperTip`(kind 는 `HELPER.*[kind]` 인덱스뿐이라 `'lesson'` 이 그대로 통함 · Tip 은 VoiceBar `px-4`·우측 44 칸 기준이라 레슨도 같은 VoiceBar 면 그대로) · `TalkRoom`·`ChatRoom`·`ask/useAskInput`(호출부 0줄 변경 — tsc 0) · `src/types/phraseHelp.ts`.

## UI-2 에게 넘길 인터페이스

### VoiceBar
```ts
<VoiceBar
  view={lessonVoiceView}            // TalkView 모양: state 'RECORDING'(phase==='recording' 일 때 — 레벨 미터가 이 값만 봄) | 그 밖 'IDLE'
                                    // ptt = { phase: voice.phase, disabled: checking, label: voice.pttLabel }
                                    // statusText = checking ? U5.checking : voice.statusText · showStop = pb 재생 중 · keyboardDisabled = false · sub = null
  db={voice.db}
  onPress={…} onRelease={voice.release} onAbort={voice.abort} onKeyboard={…} onStop={() => pb.stop()}
  trailing={helperButton}
  keyboardLabel={U5.textMode}       // ⚠ 아래 「UI-2 가 막힐 곳」 ① — StageSpeak.tsx 원문에 이 글자가 있으면 voiceSharedFrozen 4번째 시험 실패
  stopLabel={U5.stopSound}          // 새 — 기본 「선생님 말 멈추기」
  statusId="lesson-voice-status"    // 새 — 기본 'talk-status'. 레슨은 지금 id 유지를 권장(아래)
/>
```
- `statusId`: `lesson-voice-status` 를 참조하는 시험·스크립트는 저장소에 없다(grep: StageSpeak 자신뿐). 레슨과 회화방이 한 화면에 함께 그려지는 일은 없어 `talk-status` 를 써도 충돌은 없지만, 지금 레슨 DOM id 를 유지하는 쪽이 QA 대조가 쉽다 → **`statusId="lesson-voice-status"` 권장**.

### Composer
```ts
<Composer
  key={item.id}                                          // 과제가 바뀌면 새로 그린다(초안은 마운트 때 한 번 읽는다 — key 없이 draftKey 만 바꾸면 이전 과제 글이 새 키로 써진다)
  draftKey={LESSON_KEYS.speakDraft(lesson.id, item.id)}  // 새 — 저장 키 전체. chatId 와 둘 중 하나만(타입이 강제)
  enterSends="always"                                    // 새 — B6-Q A: Shift 없이 Enter = 확인(모바일 포함), IME 조합(isComposing·keyCode 229)·Shift+Enter 는 줄바꿈
  sendLabel={U5.send}                                    // 새 — 「확인하기」(막힌 이유가 있으면 그 이유가 이름)
  placeholder={U5.inputPlaceholder} inputLabel={U5.textMode}
  busy={checking} busyReason={U5.checking} blockedUntil={null}
  onSend={(t) => …}                                      // ⚠ 받은 글은 trim 전 원문, 입력창은 이미 비워짐 → 확인 실패 시 composerRef.current?.restore(t)
  onBlocked={onToast} handleRef={composerRef}
  leading={<>{micButton}{helperButton}</>}
/>
```
```ts
export type ComposerEnter = 'finePointer' | 'always'
export function enterSubmits(e: { key: string; shiftKey: boolean; isComposing: boolean; keyCode: number }, mode: ComposerEnter, finePointer: () => boolean): boolean
export function composerDraftKey(src: { chatId?: string; draftKey?: string }): string   // draftKey ?? KEYS.draft(chatId)
export type ComposerProps = ComposerBase & ({ chatId: string; draftKey?: undefined } | { draftKey: string; chatId?: undefined })
```
- 지금 레슨과 달라지는 것(승인 §34-3 「글자 입력 동작」 그대로): 빈 칸 확인 = 아무 일 없음(`U5.emptyToast` 안 씀) · 초안 쓰기 300ms 디바운스(지금 즉시) · 높이 상한 136px(지금 150) · 1,000자 상한·900자부터 표시 · IME 판정에 keyCode 229 추가.
- 확인 성공 뒤 초안 지우기는 Composer 가 한다(보내면 입력창이 비고 300ms 뒤 키 삭제) — StageSpeak 의 `setDraft('')`·`writeStore(draftKey, null)` 는 필요 없다.

### usePhraseHelper
```ts
export type PhraseHelpRequest = (queryKo: string, signal: AbortSignal) => Promise<unknown>   // #180 과 같은 응답 본문({items})
export function phraseHelpRequest(path: string): PhraseHelpRequest                          // apiPost(path, { queryKo }, { signal })
export type PhraseHelperDeps = {
  recording: boolean        // = 잠금(아래 lessonHelperLockReason !== null) — 입력·[물어보기]·카드 버튼 잠금, 낭독 미룸
  ended?: boolean           // 레슨은 넘기지 않음(false)
  roomSounding: boolean     // = pb 재생 중
  stopOthers: () => void    // = () => pb.stop()
  onEnded?: () => void      // 레슨은 넘기지 않음
} & ({ chatId: string; request?: undefined } | { request: PhraseHelpRequest; chatId?: undefined })
```
레슨 사용 예:
```ts
const lockWhy = lessonHelperLockReason(voice.phase, checking)          // 'voice' | 'check' | null
const helper = usePhraseHelper({
  request: helperRequest,                                               // useMemo(() => phraseHelpRequest(`/api/v1/lessons/${encodeURIComponent(lesson.id)}/phrase-help`), [lesson.id])
  recording: lockWhy !== null,
  roomSounding: pb.snapshot.phase === 'playing',
  stopOthers: () => pb.stop(),
})
// 잠긴 버튼: <PhraseHelperButton locked={lockWhy !== null} onLocked={() => onToast(helperLockToast(lockWhy))} …/>
// 판: <PhraseHelperPanel h={helper} kind="lesson" locked={lockWhy !== null} …/>
// 자동 취소: voice.press 첫 줄 · 글자 확인 시작에서 helper.cancelPending()
```
- `request` 는 렌더마다 새 함수여도 된다(요청 시점의 값만 쓴다). 응답·오류·429 카운트다운·`cancelPending`·재시도·12초/5초 타이머는 회화방과 같은 코드 경로(`settle`·`createHelperRequester`).
- #184 의 409 는 `PHRASE_BUSY`·`CANCELLED` 뿐 → 판 「오류」(ENDED 없음). 만약 ENDED 가 와도 `onEnded` 가 없으면 판만 닫힌다(예외 없음 — 시험).

### 문구·잠금
```ts
HELPER.placeholder.lesson  // '예: 주말에 친구를 만났어요'
HELPER.examples.lesson     // ['주말에 친구를 만났어요', '요리하는 걸 좋아해요', '조금 더 연습하고 싶어요']
HELPER.noneExample.lesson  // '주말에 친구를 만났어요'
HELPER.lockedCheck         // '답을 확인하는 중에는 열 수 없어요'  (말하는 중은 기존 HELPER.locked)
lessonHelperLockReason(voicePhase: string, checking: boolean): 'voice' | 'check' | null   // starting·recording·finishing → voice(확인 중이어도 먼저) / checking → check
helperLockToast(reason)    // 'check' → lockedCheck · 'turn' → lockedTurn · 'voice'·null → locked
```
- 처음 한 번 안내: `claimHelperTip()`·`HELPER_TIP_KEY`(`kaiwa.talk.helperTipSeen`) 그대로 재사용(B7 A — 시험으로 키 고정). `PhraseHelperTip` 은 변경 없이 VoiceBar 를 감싼 `relative flex-none` 상자 안에 두면 된다(회화방과 같은 구조).

### 하단 묶음 높이(B8) — 공용 부품 변경 없이 **레슨이 감싼다**
공용 부품에 `onHeight` 를 넣지 않았다(회화방 DOM·동작을 건드리지 않으려고). UI-2 가 판 + 바를 한 상자로 감싸 잰다:
```tsx
const stackRef = useRef<HTMLDivElement>(null)
useLayoutEffect(() => {
  const el = stackRef.current
  if (!el) return onBottomHeight(null)          // reviewing(입력 영역 없음)
  const report = () => onBottomHeight(Math.round(el.getBoundingClientRect().height))
  report()
  const ro = new ResizeObserver(report)
  ro.observe(el)
  return () => ro.disconnect()
}, [onBottomHeight, reviewing])
…
{!reviewing ? (
  <div ref={stackRef} className="flex-none">     {/* 블록 상자 — 판의 max-h·overflow 는 그대로 동작, KeyboardInset 은 closest('[data-kb-docked]') 라 감싸도 같음 */}
    {helper.shown ? <PhraseHelperPanel kind="lesson" … /> : null}
    {textMode ? <div hidden={helper.typing} className="contents"><Composer key={item.id} … /></div>
      : helper.typing ? null
      : <div className="relative flex-none">{tipShown ? <PhraseHelperTip … /> : null}<VoiceBar … /></div>}
  </div>
) : null}
// LessonScreen: <Toast bottomPx={stage === 5 ? (bottomH ?? 136) + 12 : 24} />   (회화방 136·84 는 그대로)
```

## UI-2 가 막힐 곳 — Leader 확인 필요
① **[Leader 확인 필요] `voiceSharedFrozen.test.ts` 4번째 시험이 승인 인터페이스와 충돌**: 「회화·수업·평가·마이크 테스트 화면은 질문 탭 전용 prop 을 넘기지 않는다」가 `src/components/lesson/StageSpeak.tsx`·`useLessonVoice.ts` 원문에 `keyboardLabel`(·`safeBottom`·`cancelOutside`…) 글자가 있으면 실패한다. 승인 §34-3 은 레슨이 ⌨ 이름을 `keyboardLabel` 로 넘긴다고 정했으므로 StageSpeak 에 그대로 쓰면 이 시험이 깨진다(이 파일은 수정 금지로 받았다). 선택지: (a) 레슨 하단 조합을 새 파일(예 `lesson/LessonSpeakInput.tsx`)로 옮긴다 — 시험은 글자 그대로 통과하지만 시험 의도(수업 화면에 질문 탭 prop 금지)를 파일 분리로 피하는 모양이다 · (b) Leader 가 그 시험의 금지 목록에서 레슨 두 파일의 `keyboardLabel` 만 빼도록 승인(21종 고정 마크업·fixture 는 그대로 — 소스 스캔 줄만) · (c) VoiceBar 에 다른 이름의 prop 을 하나 더 둔다(같은 일을 하는 prop 두 개 — 비권장). developer 권고: **(b)** — `keyboardLabel` 은 task-077 에서 질문 탭 전용이 아니게 됐고, (a) 는 감사가 「회피」로 볼 수 있다.
② Composer 는 보내는 순간 입력창을 비운다 → #62b 실패 시 `restore(t)` 를 부르지 않으면 지금 레슨(실패해도 글이 남음)보다 나빠진다.

## 회귀 0 증빙
| 항목 | 변경 전(기준선) | 변경 후 |
|---|---|---|
| 영향 시험(voiceSharedFrozen·talk phraseHelper* 6·chat 13·ask 12·vocab helper 3·scenario roomRender·shell scrollBoxPosition = 37파일) | 464/464 | 464/464 |
| `voiceSharedFrozen` 21종 고정 마크업 | 통과 | 통과(파일 수정 없음) |
| 기본 마크업·로직 동등성(HEAD 5파일 vs 새 5파일, 같은 스크립트 — Composer 6조합·VoiceBar 질문 탭/도우미 6조합·도우미 판 talk/rp × 9상태 × 글자/말 × 잠금 72조합·잠금 7상태·판 표시 4조합·문구 JSON) | — | **93/93 바이트 동일** |
| tsc | 0 | 0 (호출부 TalkRoom·ChatRoom·useAskInput 0줄 변경) |

## 시험 표 (새 27개 — 동작 시험 위주, 소스 스캔은 배선 3개만)
| 파일 | 시험 | 종류 |
|---|---|---|
| `talk/__tests__/task077SharedHelper.test.ts` | VoiceBar 기본값 = 지금(stopLabel·statusId 기본값 명시 = 생략, trailing 유무 × 재생 중) | 렌더 |
| 〃 | stopLabel: ■ 이름만 바뀜(바로 옆 칸·마이크 오른쪽 칸), 재생 중 아니면 없음 | 렌더 |
| 〃 | statusId: 상태 줄 id 와 마이크 `aria-describedby` 가 함께, 그 밖 바이트 동일 | 렌더 |
| 〃 | 레슨용 view 렌더(상태 줄 문구·마이크 이름·확인 중 disabled·■·⌨ 이름·도우미 칸·녹음 중 레벨 미터) | 렌더 |
| 〃 | `'lesson'` 문구 5개(손으로 적음) / 회화방·역할극 문구 8개 불변(손으로 적음) | 값 |
| 〃 | 판 `kind='lesson'` placeholder·칩 3개·빈 결과 예 / `talk`·`rp` 판 문구 불변·뼈대 동일 | 렌더 |
| 〃 | `lessonHelperLockReason` 10조합 표 · `helperLockToast` 4이유 · 회화방 `helperLockReason`/`helperLocked` 8상태 불변 · `helperPanelShown` ended 생략 | 순수 |
| 〃 | 안내 저장 키 = `kaiwa.talk.helperTipSeen` 하나(두 번째 화면은 다시 안 뜸) | 순수 |
| 〃 | 훅 주입: 정리한 질의·신호로 1회, fetch 0, 받는 중 재요청 막힘, 결말 뒤 다음 요청 | 훅(서버 렌더 probe) |
| 〃 | 훅 주입: 잠금(recording)·빈 질의면 부르지 않음 | 훅 |
| 〃 | 훅 주입: `cancelPending` → 신호 끊김·true, 늦은 ENDED 버림, 다시 물으면 새 요청 | 훅 |
| 〃 | 훅 주입: 409 ENDED → onEnded 1회 / onEnded 없으면 예외 없이 끝 + 429 도 예외 없음 | 훅 |
| 〃 | 훅 기본(chatId): fetch 주소 `/api/v1/chats/c%2F1/phrase-help`·본문 `{"queryKo":"목이 쉬었어요"}` | 훅 |
| 〃 | `phraseHelpRequest(path)`: POST·본문·응답 data 그대로 | 동작 |
| `chat/__tests__/task077ComposerOptions.test.ts` | `enterSubmits` 96조합 전수(모드 2 × 키 3 × Shift × isComposing × 229 × 정밀 포인터) + 매체 질의 호출 횟수 | 순수 |
| 〃 | 대표 사례 6개(모바일 회화 Enter = 줄바꿈, 모바일 레슨 Enter = 확인, 조합 Enter) | 순수 |
| 〃 | `composerDraftKey` 3사례 | 순수 |
| 〃 | 초안 읽기: 과제 a/b/c·회화방 키가 섞이지 않음(sessionStorage 대역) | 렌더 |
| 〃 | sendLabel: 기본 「보내기」·「확인하기」·busy 이유 우선·1,000자 초과 이유 우선 | 렌더 |
| 〃 | 기본값 = 지금(기본값 명시 = 생략, draftKey 로 지금 키 = chatId, enterSends 는 마크업 불변) | 렌더 |
| 〃 | 배선 스캔: Enter 판단 한 곳·기본 `finePointer` / 초안 읽기·쓰기·의존성이 같은 `storeKey` | 소스(배선) |

## 변이 표 (임시 미러 `thekaiwa-dev077u1-mut`, 시험 = 새 2파일 + voiceSharedFrozen + phraseHelper* 6 + sharedDefaults + askChatTab — **22/22 포착**, 끝난 뒤 7파일 원본 복원 `cmp` 동일)
| # | 변이 | 결과 | 잡은 시험 |
|---|---|---|---|
| M1 | VoiceBar ■ 기본 이름이 「소리 멈추기」 | 포착 | phraseHelperRender 2 · 기본값 = 지금 |
| M2 | statusId 를 마이크 describedBy 에 안 씀 | 포착 | statusId · 레슨용 view |
| M3 | 상태 줄 id 기본값 변경 | 포착 | voiceSharedFrozen 21종 · 기본값 · statusId |
| M4 | Composer Enter 기본값 `always`(모바일 회화 Enter 가 보내기로) | 포착 | 배선 스캔(마크업 불변이라 스캔만 잡음) |
| M5 | `enterSubmits` 모드 뒤바뀜 | 포착 | 96조합 · 대표 사례 |
| M6 | 229 조합 검사 빠짐 | 포착 | 96조합 · 대표 사례 |
| M7 | 초안 키 충돌(draftKey 를 chatId 로 취급) | 포착 | composerDraftKey · 초안 읽기 · 기본값 |
| M8 | 초안 쓰기만 대화 키 | 포착 | 배선 스캔 |
| M9 | sendLabel 무시 | 포착 | sendLabel |
| M10 | 요청 함수 주입 무시(늘 #180) | 포착 | 훅 주입 3개 |
| M11 | 주입 경로 질의 trim 안 함 | 포착 | 훅 주입 |
| M12 | 잠금 이유(recording) 무시 | 포착 | phraseHelperRender(MU1) · 훅 잠금 |
| M13 | 레슨 placeholder 가 회화방 문구 | 포착 | 문구 · 판 lesson |
| M14 | `'lesson'` 예시가 회화방 문구를 덮음 | 포착 | phraseHelperLogic 문구 표 · 회화방 문구 불변 · 판 talk |
| M15 | 레슨 예시 칩 누락(2개) | 포착 | 문구 · 판 lesson |
| M16 | 확인 중 토스트가 「말하는 중」 | 포착 | helperLockToast |
| M17 | `starting` 을 잠그지 않음 | 포착 | lessonHelperLockReason |
| M18 | 확인 중이 말하는 중보다 먼저 | 포착 | lessonHelperLockReason |
| M19 | 안내 저장 키 분리(레슨 전용 키) | 포착 | claimHelperTip(기존) · 안내 키 |
| M20 | ended 없으면 판 안 보임 | 포착 | helperPanelShown |
| M21 | onEnded 없을 때 호출(레슨에서 예외) | 포착 | 훅 결말(unhandledRejection 감시) |
| M22 | 회화방 잠금이 `check` 를 냄 | 포착 | phraseHelperTurnLock 3 · Logic |

## 증빙 명령·결과 (미러 `~/.node-local/thekaiwa-dev077u1` — 저장소에서 편집 후 임시 파일 + `mv` 로 반영, 7파일 link 1·`cmp` 동일. 서버 A·B 파일은 이 미러에 없음 — 합친 상태는 Leader 가 다시 돌린다)
| 명령 | 결과 |
|---|---|
| `./node_modules/.bin/tsc --noEmit` | 0 |
| `./node_modules/.bin/eslint <변경 5파일 + 새 시험 2파일>` | 0 |
| 영향 시험 37파일(기준선과 같은 목록) `node --import tsx --test --test-concurrency=1 …` | 464/464 (변경 전 464/464) |
| 새 시험 2파일 | 27/27 |
| 전체 시험 `find src scripts/seed-build -name '*.test.ts'`, `--test-concurrency=1`, 가짜 `DATABASE_URL` | **tests 4423 · pass 4418 · fail 0 · skipped 5** · exit 0 |
| `./node_modules/.bin/next build > log 2>&1; echo $?` | **0** (경고 3 = 기존 페르소나 파일 추적, 무관) |
| 동등성 스크립트(HEAD 5파일 vs 새 5파일, 임시 미러) | 93/93 동일 |
| 변이 22개(임시 미러) | 22/22 포착, 원본 복원 `cmp` 동일 |
| 엔진명·직접 fetch·`window.Capacitor` grep(변경 5파일) | 0 |

## 알려진 한계
- 훅을 진짜 React 로 돌리는 렌더러(jsdom 등)가 없어 `usePhraseHelper` 주입 경로는 서버 렌더로 한 번 그려 잡은 반환값으로 시험했다 — 요청 함수 호출·동시 1건·취소·결말 콜백까지만 보이고, 상태(phase·rateUntil)는 서버 렌더에서 바뀌지 않아 직접 못 본다(결말 함수 `settle` 이 회화방과 같은 것임은 ENDED → onEnded 로 확인, 429 매핑은 기존 `helperFailureOf` 순수 시험).
- Composer 초안 **쓰기**(300ms 효과)는 렌더러가 없어 배선 스캔으로만 본다(읽기는 렌더로 동작 시험). key 를 바꾸면 이전 인스턴스의 대기 중 쓰기(≤300ms)는 버려진다 — 회화방과 같은 동작.
- `enterSends` 는 마크업에 드러나지 않아 기본값은 배선 스캔(`enterSends = 'finePointer',`)으로 고정했다.

## reviewer 가 볼 곳
- `usePhraseHelper.ts` `ask` 의 주입 분기(`if (custom) { … return }`) — 기본 경로 줄을 글자 그대로 둔 이유는 `phraseHelperRender.test.ts:457` 의 글자 단위 스캔.
- `Composer.tsx` `enterSubmits` 가 지금 순서(Enter → 조합 → Shift → 매체 질의)를 그대로 지키는지(매체 질의 호출 횟수까지 시험).
- `PhraseHelperDeps`·`ComposerProps` 의 택일 타입(둘 다/둘 다 없음은 컴파일 오류).

## Developer 기록
- [22:00] 착수. 이력서·screens §34·코드 읽음. 소비처 전수(grep): VoiceBar = TalkRoom·ask/useAskInput · Composer = TalkRoom·ChatRoom·ask/useAskInput · usePhraseHelper·Panel·Card·Button·Tip = TalkRoom 만 · 단어 도우미(vocab/*)는 `HELPER_PANEL_ID` 만 talk 에서 가져온다(변경 없음) · 시나리오는 TalkRoom(역할극)을 거친다(ScenarioSheet 는 주석에서 이름만).
- [22:20] 체크포인트 — 기준선 464/464 → 구현(5파일) → tsc 0 · 영향 시험 464/464 · 새 시험 통과.
- [22:35] 동등성 93/93 · 변이 22/22 포착.
- [22:55] 완료 — eslint 0 · tsc 0 · 전체 4423(pass 4418·fail 0·skip 5) · next build 0. **남은 일(UI-2·Leader)**: ① frozen 시험 4번째와 `keyboardLabel` 충돌 결정 ② 레슨 배선. 임시 미러 `~/.node-local/thekaiwa-dev077u1-mut`(node_modules 는 심볼릭 링크)는 남겨 둠 — 정리는 Leader 지시 시(`rm -rf`). 미커밋: 변경 5파일 + 새 시험 2파일 + 이 기록.
