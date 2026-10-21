---
task: task-081
part: ui4a
role: developer
tags:
  - type/record
  - domain/lesson
---
# task-081 화면 갈래 ④-A — 응용 단계 `StageApply`(마이크 기본 + 한국어 뜻 줄) 기록

이력서: [[task-081-improve-lesson-chunk-step]] · 가이드 `docs/screens.md` §37-5·37-7·37-8·37-10·37-14·37-17·37-18-1 · 승인 데모 v1 `applyBody('prop')`

## Developer 기록

- [15:10] 체크포인트 1 — 구현 1차 완료
  - 완료: `src/components/lesson/StageApply.tsx`(props `textFirst`·`trCache` · `voiceMode` 초기 `!textFirst` · 늦은 `textFirst` · 알아들은 말 상자 `aria-live` + `JaText`·`HangulLine`·뜻 줄 · 비교 뒤 «내 문장» 뜻 줄 · `via` 화면 메모리 · 비교 버튼 rAF nearest 스크롤 · 순수 함수 `applyTrTarget` export) · `lessonCopy.ts` `U4.desc`·`U4.voiceBox`·`U4.textFirst`
  - 미러 `~/.node-local/thekaiwa-dev081u4a`(make-mirror.sh, MIRROR_OK) · tsc: 내 파일 오류 0(남은 25건은 아래 표) · eslint 2파일 0
  - 남은 일: 시험 파일 `__tests__/task081ApplyUi.test.ts` · 변이 시험 ≥4 · 기록 마무리
  - 다음 첫 행동: 시험 작성 → 미러 sync → `node --import tsx --test --test-concurrency=1`
  - 미커밋 파일: `src/components/lesson/StageApply.tsx` · `src/components/lesson/lessonCopy.ts`(U4 블록만) · 이 기록
- [15:35] 체크포인트 2 — ④-A 완료(시험·변이·기록). 커밋·푸시·배포·DB 쓰기 없음, LLM 호출 0, 브라우저·dev 서버 안 띄움.

### 변경 파일
| 파일 | 무엇을 |
|---|---|
| `src/components/lesson/StageApply.tsx` | §37-5 전부 — props `textFirst`·`trCache` · `voiceMode` 초기 `!textFirst` · 늦은 `textFirst`(아무것도 안 했을 때만 글자로, `queueMicrotask` — ⑤ 136행 방식) · 글자 우선 이유 `<p role="status">U4.textFirst` · 알아들은 말 상자 `aria-hidden` → `aria-live="polite"`(partial 줄만 `aria-hidden`) + `JaText`·`HangulLine`·`SpeakTranslation via="voice"` · 비교 뒤 «내 문장» 칸 `SpeakTranslation via={viaOf[idx] ?? 'text'}` · `viaOf` 화면 메모리(저장 안 함) · [비교하기] rAF 뒤 `scrollIntoView({block:'nearest'})` · 순수 함수 export `applyTrTarget`·`applyAnswerPatch` |
| `src/components/lesson/lessonCopy.ts` | **`U4` 블록만** — `desc`·`voiceBox` 바꿈, `textFirst` 새 키 |
| `src/components/lesson/__tests__/task081ApplyUi.test.ts` (새) | 15건 |

### `StageApply` 최종 props 시그니처 (④-B1 이 `LessonScreen.tsx:313` 호출부에 넘길 것)
| prop | 형 | 값(호출부) |
|---|---|---|
| `lesson` | `LessonDto & { content: LessonContent }` | 지금 그대로 |
| `st` | `UseLesson` | 그대로 |
| `pb` | `LessonPlayback` | 그대로 |
| `reviewing` | `boolean` | 그대로 |
| `config` | `SttClientConfig \| null` | 그대로 |
| **`textFirst`** ★ | `boolean` | `LessonStages` 의 `useSpeechConfig()` 값(175행 — ⑤ 에 넘기는 것과 같은 변수) |
| **`trCache`** ★ | `SpeakTrCache`(`./useSpeakTranslation`) | 179행 `const trCache = useSpeakTrCache()` — ⑤ 와 같은 객체(④·⑤ 뜻 메모리 공유) |
| `onToast` | `(m: string) => void` | 그대로 |
| `footer` | `React.ReactNode` | 그대로 |

호출 예: `<StageApply lesson={lesson} st={st} pb={pb} reviewing={reviewing} config={config} textFirst={textFirst} trCache={trCache} onToast={show} footer={footer} />`

### `U4` 키 (37-8)
| 키 | 문구 | 비고 |
|---|---|---|
| `U4.desc` | 상황에 맞는 문장을 말로 만들어 봐요. 채점하지 않고, 모범 답안과 비교해 스스로 확인해요. | 바뀜 |
| `U4.voiceBox` | 버튼을 누른 채로 말하면 여기에 알아들은 말이 나와요 | 바뀜(`U5.voiceBox` 와 같음 — 시험) |
| `U4.textFirst` | 지금은 말로 답하기를 쓸 수 없어서 글자 입력으로 열었어요. | 새 |
| `U4.mine`·`byText`·`byVoice`·`count`·`compare`·`dontKnow` | 지금 그대로 | 37-8 에 바뀜 없음 |
| 뜻 줄 | `SpeakTranslation` 안의 `DISPLAY_COPY.userTr.*`·`U5.trSr`·`U5.trHeard` 재사용 | `U4` 에 새 키 없음 |

### 결정과 근거
1. **번역 대상 키(ⓑ 비교 뒤)**: 저장한 글이 방금 알아들은 글과 같으면 알아들은 결과 키 `ap:{idx}:{seq}` 를 이어 쓰고, 아니면 `ap:{idx}:saved`. 근거: [비교하기] 순간 뜻이 아직 받는 중이면 키가 바뀌어 요청을 끊고 같은 글을 다시 묻게 됨(#185 한도 낭비·409 위험). 가이드는 «같은 계획» 만 정함.
2. **알아들은 말 상자의 뜻 줄은 `heard[idx].text === draft` 일 때만**: 말로 알아들은 뒤 글자 모드에서 고치고 다시 마이크 모드로 오면 그 초안은 번역하지 않음(«쓰는 동안 번역 안 함» — 37-5). 이때 상자는 `JaText` 로 그리되 읽기 분석 목록에 없어 루비·한글 줄 없음.
3. **읽기 분석(`useAnnotations`) 목록에 알아들은 글만 더함**(글자 초안은 넣지 않음) — 글쇠마다 분석하지 않게.
4. **늦은 `textFirst` 차단 조건 `touchedRef`**: 누르고 말하기 누름·최종 결과·글자 입력·[글자로/말로 쓰기] 전환 중 하나라도 있으면 바꾸지 않음. 가이드는 «말하지·쓰지 않았을 때» — 사용자가 방법을 직접 고른 것도 존중하려고 전환을 더함.
5. **`paused: voice.recording`**: 다시 말하는 동안 받는 중인 뜻 요청을 끊음(⑤ 는 도우미 잠금, ④ 는 도우미 없음).
6. **스크롤은 결과 하나에 한 번**(`scrolledTickRef`) — 없으면 다음 상황으로 넘어갈 때·헛누름 뒤에도 움직임. 녹음 중·글자 모드·비교 뒤엔 안 함.
7. **`applyAnswerPatch` 추출**: 저장 모양은 그대로(`application: { answers }` 만) — `via` 미저장을 시험으로 고정하려고.
8. **[비교하기] 를 `<div ref className="mt-2">` 로 감쌈**: `Btn` 이 ref 를 받지 않아서(`mt-2` 를 감싼 div 로 옮김 — 보이는 모양 같음).

### 시험 · 실행 증빙 (미러 `~/.node-local/thekaiwa-dev081u4a`, `node --import tsx --test --test-concurrency=1`)
- 새 `task081ApplyUi.test.ts` **15/15 통과** — 초기 마이크(④-1)·글자 우선 + `role="status"` 1개(④-10)·상자 `aria-live` 이고 `aria-hidden` 아님·비교 뒤 뜻 줄 같음=모범 답안 뜻/준비 줄 없음(④-5)·다름=준비 줄(④-9)·메모리 뜻 + 힌트 없음(다시 열기)·건너뜀 뜻 줄 없음·`applyTrTarget` 5건(fetch·free·대상 없음 3가지·비교 뒤 키)·`applyAnswerPatch` via 없음·정적(금지어 6개·엔진명·`window.Capacitor`/`fetch(`·`VoiceBar`/`Composer` import 0·훅 1개·`trCache` props·rAF nearest·`useState(!textFirst)`·저장 모양 한 곳)·`U4` 문구 글자 그대로·«세요» 0.
- 관련 기존 시험 재실행 전부 통과: `display` 11 · `task077SpeakTranslation` 17 · `task077LessonSpeak` 19 · `talk/voiceSharedFrozen` 4 · `vocab/wordMicField` 33 · `task081ChunkUi` 18 · `lessonLogic` 9.
- eslint(`StageApply.tsx`·`lessonCopy.ts`·새 시험) 0.
- 변이 7/7 잡힘(임시 파일 + mv, 원복 뒤 NFS 와 `cmp` 같음 — 스크립트 `scratchpad/dev-081-ui4a/mutate.sh`): M1 `useState(false)` → 3 실패 · M2 상자 `aria-hidden` → 1 · M3 «고친 초안도 번역» → 1 · M4 저장에 `via` → 1 · M5 «내 문장» 뜻 줄 제거 → 3 · M6 `U4.textFirst` 문구 → 1 · M7 비교 뒤 키 재사용 제거 → 1.

### 남은 tsc 오류와 몫 (내 파일 오류 0)
| 파일 | 건 | 몫 |
|---|---|---|
| `lesson/LessonScreen.tsx:313` | 1 (`textFirst`·`trCache` 없음) | **④-B1** — 위 표대로 넘기면 사라짐 |
| `lesson/logic.ts:319,327` | 2 (`U3.legacyPrompt`) | ④-B1(문제 부속 지움 37-13 ⑥) |
| `lesson/__tests__/task025.test.ts`·`task025b.test.ts` | 6·15 (`U3.legacy*`) | ④-B1(37-13 ⑥ 문제 관련 시험 정리) |
| `lesson/review/__tests__/quizTrace081.test.ts:57` | 1 (`lessonBody`) | ④-B2 병행 작업분 |

### 가이드·데모와 어긋난 곳 (Leader·designer 확인 권장)
1. **④-5 모범 답안과 같게 말함(`a-same`)**: 데모 `trBlock` 은 말로 한 답이면 같음이어도 «알아들은 말을 그대로 옮겼어요» 힌트를 보이지만, 가이드대로 `SpeakTranslation` 을 재사용해 ⑤ 규칙(`speakTrHint` — AI 가 옮긴 뜻일 때만)을 따름 → 같음이면 힌트 없음. 바꾸려면 ⑤ 와 함께 바뀌므로 이번엔 그대로.
2. **누르고 말하기 상태 줄**: 데모 `pttBlock` 은 알아들은 뒤 «다시 하려면 또 누르고 말해요»(`U5.idleAfter`)인데 데모 `cur`(지금) 에도 같은 글이라 데모 쪽 근사로 보고 가이드 «지금 부품 그대로» 에 따라 `hadResult: false` 유지(지금 대기 문구).
3. 중첩 `aria-live`: 상자(polite) 안에 `SpeakTranslation`(polite·atomic) — 가이드 그대로 둘 다 둠. 낭독 중복 여부는 QA·실기기(TalkBack) 확인.

### 한계 (서버 렌더라 못 본 것 — QA 몫)
- 누름·뗌·최종 결과 뒤 상자 갱신, 늦게 온 `textFirst` 전환/미전환, [비교하기] 스크롤(390×780·360×130%), 초점 이동, 실제 #185 호출 수(네트워크 탭), 409·429 줄, 다시 보기에서 상황 이동 때 호출이 지금 상황 하나뿐인지.
- `LessonScreen` 이 아직 새 props 를 넘기지 않아 실제 화면은 ④-B1 뒤에만 동작.

### QA 가 볼 곳
- ④-1~④-11 상태 표(37-7) 전부 · 같은 글 말함 → 호출 0 · 말한 뒤 [비교하기] → 추가 호출 0(같은 키·메모리) · 글자 답 비교 → 1회 · ⑤ 에서 같은 글 → 0회(메모리 공유) · 녹음 중 받는 요청 끊김 · 설정 응답이 늦을 때(느린 망) 아무것도 안 했으면 글자 모드 + 이유 줄, 이미 눌렀으면 그대로 · TalkBack 으로 최종 결과·뜻 낭독(중복 여부) · 44px 터치(⌨/🎤 전환 `h-11`·다시 가져오기 `h-11`).
- 미커밋 파일: `src/components/lesson/StageApply.tsx` · `src/components/lesson/lessonCopy.ts`(U4 블록만 — 같은 파일의 ③ 변경은 ui3 몫) · `src/components/lesson/__tests__/task081ApplyUi.test.ts` · 이 기록.
