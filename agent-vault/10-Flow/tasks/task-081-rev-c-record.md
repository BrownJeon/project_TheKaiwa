---
tags:
  - type/task-record
  - domain/lesson
---
# task-081 감사 C (화면·접근성·문구) — Reviewer 기록 (최종)

판정: **PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 2 · Low 6. 읽기 전용 감사(코드·문서 수정 없음). 변이 시험만 미러 `~/.node-local/thekaiwa-t081int` 에서 임시 파일 + `mv` 로 했고 원복·`cmp` 로 확인했다.
데모 게이트: `check.mjs check` → `DEMO_GATE_PASSED`(approved v1). `evidence.jsonl` 52행 = approve v1, 14:01, 세션 `729e3300…`(현재 메인 세션)·사용자 문장 해시 — 에이전트가 대신 실행한 흔적 없음.

## 실제로 확인한 것
- **금기·원칙 (범위 전 파일)**: 엔진명·모델명 0 · `fetch(`·`spawn`·`window.Capacitor`·`dangerouslySetInnerHTML` 0(주석 1건) · `StageApply` 에 `voiceSharedFrozen` 금지어 6개 0 · 하드코딩 색(#hex·rgb) 0, `protein/carb/accent/good/ink*` 토큰만 · `modules/**` 는 공개 진입점(`speech/reading/client`·`speech/tts/client`·`speech/stt/client`·`infra/native`)만, `hasKanji`·`rubyPieces`·`hangulLine` 은 이미 있는 export.
- **문구 37-8**: `U3`·`STAGE_NAMES`·`STAGE_COPULA`(이해예요·문법이에요·조각이에요·응용이에요·말하기예요)·`PIECE_TYPE_*`·`HOME`·`GEN.order`·`U2`·`U4`·`END`·`RV_*`·`LESSON_CH`·`challengeCopy`·`growthCopy` 를 가이드 글자와 대조 — 어긋남 0. 오늘 카드·복습 카드·챌린지 이어서 하기 카드 3곳 모두 `STAGE_COPULA` 경유(챌린지는 `STAGE_COPULA[stageDone]`, 0~4 범위). 성장 탭 4줄은 Leader 결정 §37-18-1 ② 와 일치(`GRAMMAR_PARTICLE` 한쪽 증거 줄은 빈 값). `askCopy.ts:209` «점수» 불변.
- **«문제» 잔재**: 범위 소스(주석 제외)에서 `challenge/logic.ts:162` `'문제 있음: '` 하나(허용). 앱 전체 `수업 문제|문제 점수|5문제|퀴즈` 검색도 화면 문구 0(서버 주석만).
- **제거 잔재**: `StageQuiz`·`correctFromScore`·`quizPromptView`·`LessonQuiz`·`Dots`·`statQuiz`·`lessonScore` 참조 0(시험의 «없음» 단언 제외). `AuxLessonLine`·`ReviewCard` 의 `score`/`correct` 가 호출부까지 일관되게 빠졌다. 타입에서 `quiz` 칸이 빠졌지만 화면 소스에 `.quiz`/`progress.quiz` 읽기 0 → 옛 수업 응답을 받아도 깨지지 않음(`content.quiz` 는 그냥 무시).
- **접근성 37-10 (코드로 보장되는 것)**: 조각 칸 `button type=button aria-pressed`, `type===null` 은 `span aria-hidden`, 빗금 `aria-hidden`, 카드 머리 `aria-live="polite"` 와 재생 `role="status"` 는 카드에 `key` 가 없어 문장이 바뀌어도 같은 요소(글만 변경), 문장 전체 `sr-only lang=ja` 한 번, 칸 묶음 `role=group aria-label`(소리 없음일 땐 `tilesAriaTextOnly`), 모아 보기 `aria-expanded`·`aria-controls`, 초점 이동(`focusTo` ref + `[line]` effect: 마지막 도착 → footer 첫 버튼, 첫 문장 도착 → `[data-chunk-next]`). 터치 44px: 칸 `min-h-11 min-w-11`, ▶ `h-11 w-11`, 구간 버튼 `min-h-11`, 칩 `min-h-11`, 모아 보기 머리 `min-h-[52px]`. 일본어 본문 17/16px(루비 `rt`·이름표 11px 은 가이드가 하한으로 정함).
- **상태·흐름**: 옛 수업(어느 줄에도 `pieces` 키 없음)→`ChunkEmpty`+footer, 새 수업인데 전부 null→줄마다 «나누지 못했어요»(옛 문구 안 씀), 소리 없음→줄 ▶·조각 ▶·구간 버튼·`pick` 의 재생 호출 모두 `!textOnly` 가드·모아 보기 칩은 `li` 글, `progress.pieces.seen`(정렬·중복 제거는 `patchOf` 와 `move` 양쪽, `reviewing` 이면 저장 안 함, `immediate` 아님), 재생 키 `piece:{l}:{j}`/`phrase:{l}:{k}` 는 줄 다시 듣기 키와 안 겹침, 요청 본문 `sub` 는 `lessonAudioBody` 한 곳에서 piece·phrase 에만, 모든 hook 이 조기 return 앞에 있음, rAF 는 effect cleanup 으로 취소, 이 컴포넌트들엔 타이머 없음, SSR/하이드레이션은 `prefs.loaded` 게이트라 초기값이 서버·클라이언트 같음.
- **응용(④)**: `useState(!textFirst)`, 늦게 온 `textFirst` 는 `touchedRef`(누름·결과·입력·방식 전환)가 서기 전에만 글자 모드로, `via` 는 화면 메모리 `viaOf` 뿐(저장 모양 `applyAnswerPatch` 에 없음), 번역 훅 1개·대상은 `applyTrTarget` 이 지금 상황 하나만(말한 직후 `ap:{idx}:{seq}`, 비교 뒤 같은 글이면 같은 키 이어 씀, 글자 답은 `ap:{idx}:saved`)·모범 답안과 같으면 `free`(호출 0)·`trCache` 는 `LessonScreen` 이 `textFirst`·`trCache` 와 함께 넘김(`LessonScreen.tsx:315`).
  - 데모와 다른 곳: 모범 답안과 같게 말해도 «알아들은 말을 그대로 옮겼어요» 힌트를 안 보임(`speakTrHint` 가 `state.ai` 일 때만). 가이드 §37-7 ④-4 는 «ok, ai» 에서만 힌트를 적고 ④-5 는 «모범 답안 뜻 즉시» 만 적었으며 ⑤ 의 기존 규칙(A4 A)과 같다. 분류 = **implementation**(가이드가 정본, Leader 수용, dev-ui4a 기록 79행). 재승인 불필요.
- **시험 실행**: 새 5개 파일 63건 통과(미러 = NFS 소스 `cmp` 일치 확인 후). 변이 7건: M5(`saved` 키)·M6(`reviewing` 저장 가드)·M7(머리 `aria-live`) 잡힘 / M1·M2·M3·M4 생존 → 아래 L5.

## 발견

| # | 심각도 | 위치 | 내용 · 근거 · 권고 |
|---|---|---|---|
| F1 | **Medium** [가능성 높음] | `StageApply.tsx` 알아들은 말 상자(`data-apply-heard aria-live="polite"`, 약 338행) 안 `<SpeakTranslation>`; `SpeakTranslation.tsx` 끝의 `<div aria-live="polite" aria-atomic="true">` | 같은 `polite` 생존 영역이 중첩된다. 바깥 상자는 처음부터 있지만 안쪽 영역은 알아들은 말과 **같은 렌더에 새로 마운트**(`draft && heard.text===draft`)돼 «번역 중…» 줄이 바깥 영역의 추가분으로 한 번, 뜻이 오면 안쪽(atomic)과 바깥 추가분으로 또 읽힐 수 있다. 가이드 37-10 ⑦ 이 상자 live 를 요구했으므로 구조 자체는 정본이지만 가이드는 뜻 줄을 `role="status"` 로 가정했고 실제 부품은 `aria-live`다. `SpeakTranslation` 머리 주석의 «늘 마운트된 aria-live» 전제도 ④ 에서는 깨진다. **권고**: 바깥 live 를 알아들은 글(`JaText`+`HangulLine`)만 감싸는 안쪽 래퍼로 좁히고 `SpeakTranslation` 은 형제로 두거나(시각은 그대로) 안쪽을 `aria-live="off"` 로 둔다. **TalkBack 실측 필수**(코드로는 SR 별 결과를 못 봄). |
| F2 | **Medium** [가능성 높음] | `ChunkSentence.tsx` `PieceTiles`(약 108~138행) | 칸 글자 `whitespace-nowrap` + 칸 `max-w-full`(flex 항목 `min-width:auto` 라 줄지 않음) 인데 서버가 허용하는 조각 길이는 `LESSON_PIECE_JA_MAX = 40`(`schemas.ts:323`). 가이드·데모가 잰 가장 긴 칸은 «ありがとうございます»(11자, 130% ≈ 230px < 카드 안 304px)뿐이라 **14자 이상 한 조각**(EXPRESSION 의 긴 정형 표현)은 360px·130% 에서 카드 밖으로 넘칠 수 있다. 프롬프트 지침에도 조각 글자 수 상한 문구가 없다(`piecesInstruction.ts` 는 `ko` 만 «12자 안팎»). **권고**: (a) 한 칸 안에서만 `[overflow-wrap:anywhere]` 폴백(예: 글자 수 > N 인 칸만 `whitespace-normal`) 또는 (b) 서버 `ja` 상한을 줄이기(PE·Leader 결정). QA 가 40자 조각 픽스처로 360/130% 가로 넘침을 직접 잴 것. |
| F3 | Low | `StageApply.tsx` `compare()` 의 `via` 판정 | `via = voiceMode ? 'voice' : 'text'` — 말로 알아들은 뒤 글자로 고치고 다시 말하기 모드로 돌아와 [비교하기] 하면 **고친 글**에 «알아들은 말을 그대로 옮겼어요» 힌트가 붙는다. `heard[idx]?.text === t` 일 때만 `'voice'` 로 하면 정확하다. 드문 조합. |
| F4 | Low | `topicCopy.ts` `LESSON_CH.auxDone` | 호출부가 한 인자로 바뀐 뒤에도 `(t, legacyCorrect?)` 로 단언한 호환 껍데기가 남아 있고 시험(`quizTrace081`)이 옛 두 인자 호출을 고정한다. 죽은 코드 — 다음 정리 때 제거 권고. |
| F5 | Low | `ChunkSentence.tsx` (낭독) | 문장 전체 `sr-only lang=ja` 뒤에 칸 버튼이 조각 글을 다시 읽어 탐색 모드에서 같은 일본어가 두 번 읽힌다. 가이드(데모 Minor-1)가 정한 구조이므로 결함 아님 — TalkBack 으로 «コーヒー 이름 조각, 커피»·머리 한 번 낭독을 확인할 것. |
| F6 | Low | `LessonEnd.tsx:70` vs `lessonCopy.ts` `HOME.doneBody` | 조각 수 0 이면 종료 카드는 «0 오늘의 조각» 3칸, 오늘 카드는 «조각» 줄을 뺀다(`pieces ?`). 서버가 문장부호뿐인 줄을 거르므로 현실적으로 닿지 않지만 규칙이 서로 다르다. `collectCount` 도 알 수 없는 종류를 센다(그리지는 않음). |
| F7 | Low | `PieceCollect.tsx` `aria-controls` | 접힌 동안 가리키는 `#piece-collect-body` 가 DOM 에 없다. 가이드(37-4-3)가 정한 모양이고 해로운 동작은 없다 — 수용. |
| F8 | Low (시험 구멍) | 시험 전반 | 새 시험은 서버 렌더·정규식 배선 단언이라 **클릭·초점·스크롤·`textFirst` 지각 도착**을 못 본다. 변이 M2(`pick` 의 `!textOnly` 가드 제거)·M3(뜻 줄 `heard.text===draft` 가드 제거)·M4(마지막 도착 초점) 이 시험을 통과했다. M1(`canNext` 의 `last ||` 제거)은 `seen.size >= n` 과 동치라 **등가 변이**(결함 아님). 이 네 동작은 QA 가 직접 해야 한다. |

수정 요청 없음(Critical·High 0). F1·F2 는 Leader 가 QA 실화면 결과와 함께 Developer 에게 넘길지 판단.

## QA 에 넘길 high_risk_areas
1. ③ 40자짜리 조각 한 개가 든 문장(EXPRESSION)을 360/130%·라이트/다크에서 — 가로 넘침 0·칸이 카드 밖으로 나가지 않는지 (F2)
2. ④ 알아들은 말 상자 TalkBack 낭독: 말한 직후 «일본어 → 한글 읽기 → 번역 중… → 한국어 뜻» 이 **각각 한 번**만 읽히는지, partial 은 안 읽히는지 (F1·F5)
3. ③ 소리 없음(표시등 자막만): 칸을 눌러도 요청이 안 나가고(네트워크 탭 `/audio` 0건)·▶·구간 버튼 0·모아 보기 칩이 버튼이 아닌지 (F8-M2)
4. ③ 문장 이동 초점: [다음 문장]으로 마지막 도착 → [다음 단계] 에 초점, [이전 문장]으로 첫 문장 도착 → [다음 문장] 에 초점, 이동할 때 재생·고른 조각 해제 (F8-M4)
5. ③ 이어 하기: 일부만 본 수업을 닫았다 다시 열면 안 본 첫 문장에서 시작, 끝낸 단계 다시 보기에서는 `PATCH` 가 안 나가는지(네트워크), 옛 수업 빈 상태·전부 null 새 수업
6. ④ 번역 호출: 모범 답안과 같게 말하면 `/speaking-translation` 0건, 같은 글 재말하기·비교 뒤 같은 글은 추가 호출 0, 다시 보기에서 세 상황 동시 호출 0, 말하기 후 글자로 고쳐 [비교하기] 했을 때 힌트가 붙는 조합 (F3)
7. ④ `textFirst` 지각 도착: 설정 응답이 늦게 와도 사용자가 마이크를 누르기 전엔 글자 모드로, 누른 뒤엔 유지 / 글자 우선 이유 줄 (F8-M3)
8. 오늘 카드 «다음은 ③ 조각이에요»·«② 문법이에요», 종료 카드 3칸/2칸(옛 수업), 복습 카드·챌린지 이어서 하기 카드 서술격, 성장 탭 안내 4줄
9. 360/390/412 × 100/130% 가로 스크롤·44px 미만 터치 0, 다크 모드에서 밑줄 막대(`protein`/`carb`) 구분(이름표 글자가 정보)

## 보고
- Critical 0 · High 0 → QA 진행 가능. Escalation 조건 없음. native_change: false(이 범위에 네이티브 파일 없음).
- 못 본 것(브라우저·스크린리더·실기기): 위 high_risk_areas 1~9. 전체 시험·`tsc`·빌드·서버·DB·LLM 은 지시대로 돌리지 않았다.
