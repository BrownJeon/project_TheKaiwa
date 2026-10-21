---
task_id: task-081
title: "task-081 PE 1단계 기록 — 조각(pieces) 스키마·검증·프롬프트 v10·측정 준비"
type: pe-record
tags:
  - type/task
  - domain/lesson
  - domain/prompt
created: 2026-10-21
updated: 2026-10-21
---

# task-081 Prompt-Engineer 1단계 기록 (라이브 LLM 호출 0)

> 이력서 [[task-081-improve-lesson-chunk-step]] · 가이드 `docs/screens.md` §37-12·37-13·37-16·37-18-1 · 미러 `~/.node-local/thekaiwa-pe081`(`make-mirror.sh` 로 생성, 소스는 NFS 에서 고치고 `sync-local.sh` 로 채움).
> **상태: 1단계 완료(설계·구현·측정 준비). 라이브 측정(2단계)은 사용자 호출 예산 승인 뒤 별도 지시.**

## 0. 한눈에 (불편한 사실 먼저)

1. **[확실] 지연 위험이 실제로 있다.** v10 은 입력은 거의 그대로(+363자)인데 **출력이 약 +20~35%** 늘 것으로 추정된다(§6). 운영 v9 의 LLM 단계 중앙값 42.6초 → 추정 **50~57초**로 합격선 G1a(60초)에 아슬아슬하다. 재시도(1회)가 한 번 나면 120초 잡 예산을 넘길 가능성이 높다. 측정으로만 확정된다.
2. **[확실] 계획서의 «같은 함수를 서버 저장·재시도 판정이 함께 쓴다»는 6층 규칙 때문에 그대로는 불가능하다.** L3 `learning` 은 L2 `conversation` 을 import 하지 않는다(`module-dependency` §3·§4-4, `content.ts` 머리 주석). 대신 **요청의 `extraCheck`(L2)가 최종 응답의 `pieces` 를 제자리 정리해서 돌려준다** → 저장 단계는 이미 «정리된 배열 | null» 을 받는다. 서버가 방어용으로 또 검사하고 싶으면 로컬 복사본 + 아래 공용 픽스처로 묶는다(§4).
3. **[확실] TALK(A1) 요청 바이트가 바뀌었다.** `tutor.md` §1 의 한 구절(«문제→응용»)을 고쳐서 TALK persona 해시가 달라졌다(`talk-general-golden.json` 8건, **persona 해시만** 변경 확인). 되돌리고 싶으면 §1 한 구절만 원복 + 골든 2개 재기록(§5).
4. **[확실] 골든 «3종 재기록은 라이브 출력이 필요»가 아니다.** `lesson.json`·`review-mix.json` 은 **입력** 픽스처(변경 없음, quiz 문자열 0건 확인), `lesson-general-golden.json` 은 **요청 바이트 해시 골든**(결정적)이라 **이번에 이미 재기록**했다. 라이브 출력 골든은 원래 없다.
5. **[가능성 높음] A5(복습)에 `stripAdditionalProperties` 를 못 켰다.** 기존 가드 시험이 «켜는 빌더는 A4·A12·phraseHelp 셋뿐»으로 못 박아 두었다(task-019). 조각 객체가 늘어 스키마 밖 키(reading 등) 재시도 위험이 커지지만 임의로 가드를 풀지 않았다 → 열린 결정(§7).

## 1. 체크포인트 로그

- [CP1] **스키마·타입 확정 — developer 가 import 해도 됨.** `structuredResponse/schemas.ts`: `quiz` 제거(`required`·`properties`·`lessonQuizItem`·`LessonQuizItem`·`LessonResponse.quiz` 삭제), `dialogue[i].pieces` 필수.
- [CP2] **프롬프트 v10 + 후검증 + 시험.** `lesson@v10`·`lessonScenario@v2`·`reviewMix@v4`.
- [CP3] **측정 준비 + 베이스라인.** `tests/prompts/lesson-pieces-live.ts`(DRY 통과) + 하네스 시험 8개. Trace 읽기 전용 집계(§5).

## 2. 변경 요약 (파일)

| 파일 | 변경 |
|---|---|
| `src/modules/conversation/structuredResponse/schemas.ts` | `quiz` 삭제 · `pieces` 필수 · `lessonPiece` 스키마 · 새 export 아래 |
| `…/structuredResponse/lessonPieces.ts` (신규) | 규칙 6개의 **유일한 소유자** — `checkPieces`·`validatePieces`·`scanLessonPieces`·`applyLessonPieces`·`piecesOverThreshold`·`piecesViolationMessages`·`isPunctuationOnly`·`PIECES_VIOLATION_REASONS` (전부 `conversation/index.ts` 로 내보냄) |
| `…/structuredResponse/checks.ts` | `quiz` 검사(promptKo 한글·targetIds·문항 글 엔진명) 삭제 · `kind:'pieces'` · `tolerateInvalidPieces` · 조각 ko/ja 도 엔진명 검사 |
| `…/structuredResponse/repair.ts` | `data.quiz` 두 곳 삭제 |
| `src/modules/conversation/prompts/piecesInstruction.ts` (신규) | A4·A5·상황이 공유하는 조각 지침 한 줄(869자) |
| `…/prompts/lesson.ts` | `lesson@v10`·`lessonScenario@v2` · quiz 줄·언급 삭제 · 단계 이름 «조각» · `extraCheck(data, info)` 재작성 · `LESSON_USER_PROMPT_CAP` 9,500 → **9,900** |
| `…/prompts/reviewMix.ts` | `reviewMix@v4` · 같은 변경 · `extraCheck(data, info)` (예전엔 `info` 를 안 받았다) |
| `.claude/agents/tutor.md` | §1 한 구절(«문제→응용» → «조각→응용»)·§6 LESSON 행(`quiz` → `pieces`) |
| 시험 | `lesson.test.ts`·`reviewMix.test.ts`·`lessonScenario.test.ts`·`task039.test.ts`·`talkScenario.test.ts`·`wordEnrichChunk.test.ts`(J12 예외 1곳) 수정 · `lessonPieces.test.ts`(59개)·`lessonPiecesLive.test.ts`(8)·`lessonPiecesHelpers.ts` 신규 |
| 픽스처 | `tests/prompts/fixtures/lesson-pieces-cases.json`(좋은 줄 26·나쁜 줄 26 — **developer 재사용용**) · `lesson-general-golden.json`·`talk-general-golden.json` 재기록 |
| 하네스 | `tests/prompts/lesson-pieces-live.ts` (§7) |

### 새 export (`schemas.ts`)
`PIECE_TYPES`(6종)·`PieceType`·`LESSON_PIECES_MIN/MAX`(1/24)·`LESSON_PIECE_JA_MAX`(40)·`LESSON_PIECE_KO_MAX`(30)·`LessonPieceOut`(LLM 모양 `{ja,type,ko,slash?:boolean}`)·`DialoguePiece`(저장 모양 `{ja,type,ko,slash?:true}`)·`LessonDialogueLine.pieces: LessonPieceOut[] | null`.
**널 허용 칸은 스펙의 `type:['string','null']+enum[…,null]` 대신 이 파일의 다른 칸과 같은 `anyOf [null, …]`** — 의미 동일, 구조화 출력 호환 관례를 따랐다.

## 3. 결정과 근거

### 3-1. quiz 관련 검사를 «분리»하지 않고 삭제한 이유
37-13 ⑥은 `checks.ts`·`repair.ts` 의 quiz 부분을 «옛 수업 완료용으로 남긴다»고 했지만, **실제 호출처를 전수 확인**하니(`grep checkLessonResponse|repairLessonResponse`) 두 함수는 **생성 직후 응답만** 검사한다 — `prompts/lesson.ts`·`prompts/reviewMix.ts` 의 `extraCheck` 와 시험·`tests/live` 도구뿐이고, 옛 수업을 다시 검사하는 곳은 없다. 옛 수업 완료용 코드(`learning/lessons/content.ts` `scoreQuiz`·`quizTargetTally` 등)는 **별개 파일**이라 건드리지 않았다. `LessonResponse` 에서 `quiz` 가 사라진 뒤에 남겨 두면 죽은 분기 + 타입 구멍(선택 필드)이 된다.
(`tests/live/{lesson-measure,lesson-promptko-measure,task010-smoke,task010b-smoke}.ts` 4개가 `quiz` 를 읽는다 — tsc 대상이 아니라 컴파일은 통과하지만 **실행하면 깨진다**. 옛 v8/v9 측정·스모크용 일회성 도구라 손대지 않았다.)

### 3-2. «부드러운 위반»(재시도 뒤에도 넘으면 레슨 실패 대신 위반 줄 null 저장) — **지금 파이프라인으로 표현 가능, 코드 확인 완료**
- 엔진은 `extraCheck(data, info)` 에 `info.attempt/maxAttempts`(`JSON_MAX_ATTEMPTS=2`)를 준다. 기존 `tolerateContentMismatch`(④ 매칭)가 이미 «마지막 시도에서만 면책» 패턴이다 → **같은 방식으로 `tolerateInvalidPieces`** 를 추가했다(`checks.ts`).
- 흐름: 1차에서 «위반 줄 × 2 > 줄 수» → 위반 문구(어긴 줄 번호와 규칙, 일본어 글 없음)로 재시도 → 2차(마지막)에서는 조각 위반을 면책 → **응답 전체는 통과**하고 `applyLessonPieces` 가 위반 줄을 `null`, 통과한 줄은 정리된 배열로 **제자리** 바꾼다(engine 이 돌려주는 `data` 가 같은 참조라는 건 `repair.ts` 머리 주석이 이미 확인). 임계 이하(예: 6줄 중 3줄)는 재시도 없이 바로 그 줄만 null.
- 다른 위반(존재하지 않는 id·한글 혼입·엔진명)은 마지막 시도에서도 **여전히 실패**한다(시험으로 고정).
- 대안으로 본 엔진 옵션 `softExtraCheck: true` 는 **쓰지 않았다**: 모든 `extraCheck` 위반을 던지지 않게 만들어 id 환각까지 통과시킨다.
- 모든 줄이 null 인 수업이 나올 수 있다 → 화면은 줄마다 «나누지 못했어요»(37-3-1). 레슨 실패는 아니다.

### 3-3. PE 확정 (37-18-1 «세부 slash 규칙은 PE»)
1. **slash 정리 확장**: 스펙의 «줄 마지막 조각엔 붙지 않는다» → **«그 조각 뒤에 type 이 있는 조각이 하나도 없으면(뒤가 비었거나 문장부호 조각뿐이면) slash 를 지운다»**. 「…ください ／ 。」 같은 소리 없는 빈 구간을 저장 단계에서 없앤다. 멱등. 문장 경계의 `。` 조각에 붙은 slash(뒤에 typed 조각이 있음)는 유지 — 데모 샘플과 같다. `phraseText` 구현은 이 규칙을 알 필요 없이 «끝의 type null 제외»만 방어로 유지하면 된다.
2. **`ko` 에 한글이 있는지는 검사하지 않고 센다**(`koNoHangul` 지표). 결정적으로 가를 수 없고(숫자·로마자 단위 등) 재시도만 늘린다. 합격선 G4 로 관찰.
3. **조각 ja 는 입력 그대로 저장**한다(NFC 정규화는 «같음» 비교에만). NFD 로 쪼개진 조각도 합치면 같으면 통과한다(픽스처에 2건).
4. **임계 분모 = 대화 줄 수**(`dialogue.length`, 6~10). 6줄이면 3줄까지 허용·4줄부터 위반, 10줄이면 5줄까지 허용.
5. 위반 문구에는 **줄 번호·규칙·글자 수·어긋난 위치만** 싣는다 — 레슨 글(붙여넣은 원문에서 온 것일 수 있다)이 엔진 로그에 남지 않게(엔진이 위반 문구를 `console.warn` 한다).

### 3-4. 입력 예산 (`LESSON_USER_PROMPT_CAP` 9,500 → 9,900)
조각 지침 869자 − quiz 줄·언급 약 506자 = **+363자**(주제 경로 정상~준최악 9,490 → 9,853, 실제 한도 최악 9,523 → 9,886 — 시험이 측정). 의도된 증가라 CAP 과 시험 천장(9,540 → 9,920)을 함께 올렸다. 입력 +363자(약 250토큰)는 지연에 거의 영향이 없다. A1(TALK) 3,000자 상한은 무관.

### 3-5. J12 시험 예외 1곳
`wordEnrichChunk.test.ts` J12: «조각 enum 은 4유형, `wordEnrich` 만 5유형» → **수업 pieces 6유형은 `schemas.ts` 의 `PIECE_TYPES`·`LESSON_SCHEMA` 두 곳에만 허용**(경로 정규식으로 고정, 다른 곳에 6유형 enum 이 생기면 실패). 사용자 Q9 A 승인 사항.

## 4. developer 에게 (서버)

1. **`learning/lessons/content.ts` `LessonGenOutput`** 을 맞춰야 `tsc` 가 통과한다(현재 `app/api/v1/lessons/route.ts:33`·`app/api/v1/_lib/review.ts:73` 두 곳이 `LlmJsonRequest<LessonGenOutput>` 불일치로 실패 — 이 task 의 의도된 신호). 모양:
   ```ts
   dialogue: { speaker: 'A'|'B'; ja: string; reading: string; ko: string;
               pieces: { ja: string; type: 'NAME'|'ACTION'|'FEELING'|'MODIFIER'|'EXPRESSION'|'LINK'|null; ko: string|null; slash?: boolean }[] | null }[]
   // quiz 는 LessonGenOutput 에서 빼고, StoredLessonContent 에만 옛 수업용 `quiz?: StoredQuizItem[]` 로 둔다(37-12-9).
   ```
2. **저장 단계에서 `pieces` 를 다시 검증할 필요는 없다** — 요청의 `extraCheck` 가 정리를 끝내고 돌려준다(통과한 줄 = 정리된 배열, 못 넘은 줄 = `null`, `slash:false` 키 없음). 그래도 방어용으로 L3 안에 로컬 복사본을 두려면 `tests/prompts/fixtures/lesson-pieces-cases.json`(52건: 좋은 줄 26·나쁜 줄 26, 이유 코드 포함)을 같은 시험으로 돌려 두 벌을 묶는다. 시험 모양은 `src/modules/conversation/__tests__/lessonPieces.test.ts` 참고.
3. **계측 정의**(`toolLog`): `piecesTotal` = `dialogue` 줄 수, `piecesNullLines` = `pieces === null` 인 줄 수(저장된 content 에서 계산). 엔진 로그에는 이미 `[lesson] pieces — lines=… nullLines=… pieces=… koNoHangul=… reasons={…}` 한 줄이 남는다(응답 1건당 1줄, 글 없음).
4. `Lesson.promptVersion` 표기: `lessonPromptVersion(input)` 이 `lesson@v10`/`lessonScenario@v2` 를 돌려준다(`reviewMix@v4` 는 `REVIEW_MIX_PROMPT_VERSION`). 전부 VarChar(20) 안.
5. `npm run prompts:sync`(PromptVersion SOURCE_CODE) — `teacher-persona`(tutor.md) 내용이 바뀌었으므로 sync 대상이다. 배포 때 Leader/deployer 확인.

## 5. 베이스라인 (운영 `RequestTrace` 읽기 전용 SELECT — 숫자만, 사용자 대화·내용 없음)

| 대상 | n | LLM 단계(ms) | 전체(ms) | 비고 |
|---|---|---|---|---|
| `lessonGen`(lesson@v7~v9·lessonScenario@v1) | 11 | 중앙값 **42,556** · p90 67,748 · 최대 **70,316** · 최소 33,137 · 평균 47,886 | 중앙값 45,158 · 최대 71,777 | SAVE 단계 484~3,171 |
| `reviewGen`(reviewMix@v2~v3) | 2 | 44,299 · 39,875 | 47,269 · 42,135 | |

한계: ① 11건 중 9건이 10-18 task-076 QA 연속 호출(10:25~10:35·14:09~23:55)이라 부하 조건이 섞였다 ② **Trace `steps` 에는 시도 횟수가 없어 재시도가 섞여 있다**(상한 쪽 편향) ③ 실패한 생성은 Trace 상태가 모두 OK 라 실패율을 알 수 없다. 저장 레슨 13건 크기(글자 수, 읽기 전용): 전체 4,820~6,154(중앙값 약 5,400) · **quiz 1,132~1,337(중앙값 약 1,200, 전체의 21%)** · 대화 줄 8~10(중앙값 8) · 줄 `ja` 글자 수 중앙값 20·p90 25(n=111).

## 6. 출력 예산·지연 추정 (측정 전 추정 — 숫자로 사전 등록)

- 조각 한 개의 LLM 출력 JSON ≈ 52자(`{"ja":"コーヒー","type":"NAME","ko":"커피","slash":false}` 55자·문장부호 조각 46자). 줄 20자 ≈ 조각 7개(문장부호 포함) ≈ **360자/줄** → 8~9줄 ≈ **3.1k자**(저장 모양은 `slash:false` 가 빠져 약 2.4k).
- quiz 삭제 ≈ −1.2k자. **순증 약 +1.9k자 ≈ 현재 응답(약 5.4k자)의 +35%**. 토큰 환산(CJK 밀도 차이)으로는 **+20~30%**.
- 지연이 출력 토큰에 비례한다면 중앙값 42.6초 → **약 51~55초**, 최대 70.3초 → **약 85~90초**. G1a(60초)·G1b(100초) 안이지만 여유가 적다.
- **재시도 위험**: 1차가 60초를 넘으면 재시도(약 같은 길이)는 120초 잡 예산을 넘기기 쉽다. 그래서 «조각 임계 재시도»가 실제로 유익한지(대개 예산 초과로 실패) 2단계에서 `G3c`(1차 임계 재시도 ≤1건)로 본다.
- **G1 실패 시 대안(구현 안 함 — Leader 결정 사항)**: 조각만 **별도 호출**(task `lessonPieces`, fast 티어, 입력 = 대화 줄 ja/ko)로 떼어 본 호출 뒤에 돌린다. 본 호출은 quiz 가 빠져 더 짧아지고(v9 대비 약 −15%), 조각 호출은 출력 2.4k자라 10초 안팎 → 합계가 단일 호출보다 짧을 수 있다. 대신 새 task 항목·실패 처리(조각 호출 실패 = 모든 줄 null)·잡 단계가 늘어 developer 변경이 필요하다.

## 7. 측정 설계 (2단계 — 실행 금지 상태로 준비 완료)

도구: `tests/prompts/lesson-pieces-live.ts` (DRY 통과 · 하네스 시험 8개). **호출 가드 4겹**: ① 직접 실행일 때만 `main()` (import 부작용 호출 0) ② `LIVE_OK=task-081` 없으면 계획만 출력 ③ `MAX_CALLS`·절대 상한 `HARD_CAP=20` 을 OUT 에 남은 행(실패 포함)까지 센다 ④ 호출 원장 `*.calls.json` 에 «시작» 줄을 호출 전에 먼저 쓴다(프로세스가 죽어도 몇 번 불렀는지 남음). 429·한도 문구·즉시 실패 2연속이면 멈춘다. 직렬·간격 ≥1.5초.

### 입력 세트 (core 12회)
주제 8 = 시드 5종 원래 수준(self-intro N5·cafe-order N5·ask-directions N5·weekend-plan N4·travel-story N4) + 수준 올림 3(travel-story→N3·weekend-plan→N2·cafe-order→N3, 줄이 길고 활용·복합 문형 증가) · 상황 1(cafe-order + «카페에서 주문 바꾸기», `lessonScenario@v2`) · 붙여넣기 1(sourceText, N4) · 복습 2(`reviewMix@v4` 6항목·10항목). `PLAN=extra` 6회는 같은 입력 되풀이(core 가 경계에 걸릴 때만).

### 지표 → 합격선 (사전 등록 — `GATE` 상수, 측정 뒤 수정 금지)
| # | 지표 | 합격선 | 판정 |
|---|---|---|---|
| G1a | 1차 성공 호출 경과 중앙값 | ≤ 60초 | 하네스 |
| G1b | 전체 최대 | ≤ 100초 | 하네스 |
| G1c | 120초 초과 호출 | 0 | 하네스 |
| G2a | 재시도율(`attempts=2`) | ≤ 17%(12회 중 2) | 하네스 |
| G2b | 최종 실패(던짐) | 0 | 하네스 |
| G3a | 조각 null 줄 비율(전체 풀링, `piecesNullLines/piecesTotal`) | ≤ 10% | 하네스 |
| G3b | 마지막 시도 면책(조각 위반 줄 null 저장) | 0건 | 하네스 |
| G3c | 1차에서 조각 임계로 재시도한 호출 | ≤ 1건 | 하네스 |
| G4 | `koNoHangul`(type 있는 조각 대비) | ≤ 3% | 하네스 |
| G5a | 조사 조각이 LINK 가 아닌 비율 | ≤ 3% | 하네스(휴리스틱) |
| G5b | です/ます·활용 어미 분리 줄 | ≤ 5% | 하네스(휴리스틱) |
| G6 | **눈가림 Leader 판정**(≥40줄): 틀림 ≤5% · 맞음 ≥70% · 맞음+어색 ≥92% | | `SCORE=1` |

보고 지표(합격선 없음): 응답 JSON 글자 수 중앙값·최대·pieces 몫, 프롬프트 글자 수, 종류 분포, 줄당 조각 수·구간 수, 긴 EXPRESSION·구간 없음/과다·긴 ko 개수, null 이유별(`join_mismatch` 등), 재시도 원인 문구(규칙·경로만).

### 눈가림 절차
`SHEET=1 SHEET_FROM=<결과.json[,변형.json]> SHEET_N=40 SEED=81` → `*.sheet.md`(arm·호출 id 없이 `S01…` 만, 시드 고정 무작위, null 줄 제외) + `*.sheet.key.json`(매핑 — **Leader 에게 보이지 말 것**). Leader 가 판정 JSON(`{"S01":"맞음",…}`)을 채우면 `SCORE=1 VERDICTS=… KEY=…` 가 arm 별로 집계한다. 변형 비교는 `PIECES_FILE=<지침 줄 텍스트>` 로 운영 파일을 바꾸지 않고 한 줄만 대체한다.

### 호출 수·시간 추정
- core **12회**(CLI 시도 최대 24 — 재시도 포함), 직렬이라 **약 11~15분**(회당 50~70초 + 간격). extra 6회는 +6~8분.
- G 실패로 지침 줄을 고쳐 재측정하면 +12회(변형 1개 기준). **승인 요청 권고: 18회(core 12 + extra 6)를 먼저, 변형 재측정 12회는 필요할 때 따로.** 합계 상한 30회.
- 2단계 지시에 필요한 것: ① 사용자 호출 예산 승인(위 숫자) ② 미러 `~/.node-local/thekaiwa-pe081`(`.env` 있음) ③ `LIVE_OK=task-081` 허용 ④ 눈가림 판정자(Leader)와 40줄 판정 시간.

## 8. 골든 계획 (정정 포함)
- `tests/prompts/fixtures/lesson.json`·`review-mix.json`: 입력 픽스처 — **변경 없음**.
- `lesson-general-golden.json`(7건): **재기록 완료**(요청 바이트가 지시문·스키마·persona 변경으로 바뀜). `UPDATE_GOLDEN=1 node --import tsx --test src/modules/conversation/__tests__/lessonScenario.test.ts` → 미러에서 만든 파일을 NFS 로 복사(이 task 에서 한 절차).
- `talk-general-golden.json`(8건): persona 해시만 재기록(`talkScenario.test.ts`).
- 라이브 출력 «골든»은 두지 않는다. 2단계 결과 JSON(`task081-pieces-core.json`)을 이력서에 요약으로 남기고, 원본은 `agent-vault/10-Flow/tasks/` 밖(스크래치)에 둔다 — 레슨 글이 들어 있다.

## 9. 실행한 것 (미러 `~/.node-local/thekaiwa-pe081`)
- 시험: `src/modules/conversation` + `src/modules/engine` **1,584개 전부 통과**(최종 재실행, 중간에 A5 strip 가드 1건이 실패해 reviewMix 의 `stripAdditionalProperties` 를 되돌렸다). 신규: `lessonPieces.test.ts` 59개(픽스처 52 + 단위 7) · `lessonPiecesLive.test.ts` 8개.
- `tsc --noEmit`: conversation·tests 0건. **전체 오류 2건은 모두 developer 소유**(`app/api/v1/lessons/route.ts`·`app/api/v1/_lib/review.ts`, `LessonGenOutput` 불일치).
- `eslint src/modules/conversation tests/prompts`: 0건.
- 하네스 `DRY=1`: 18개 입력 모두 요청 생성·조각 지침 1회·quiz 없음 확인, 분석기·플래그·눈가림 표·판정 집계 점검 통과. **라이브 호출 0회.**

## 10. 열린 결정 (Leader)
1. **A5 복습에 `stripAdditionalProperties` 를 켤까?** 켜려면 가드 시험(`wordEnrichChunk`와 별개의 «켜는 빌더 셋뿐» 시험)을 4개로 고쳐야 한다. 근거는 2단계 재시도 원인(`retryReason`)에 `additionalProperties`/`reading` 이 보이는지로 정하는 것을 권한다.
2. **TALK persona 바이트 변경 수용 여부**(§0-3). 수용하면 그대로, 아니면 `tutor.md` §1 한 구절 원복 + 골든 2개 재기록.
3. **G1 실패 시 조각 별도 호출**(§6) 착수 여부 — 측정 뒤에 정한다.
4. 옛 스크립트 `tests/live/{lesson-measure,lesson-promptko-measure,task010-smoke,task010b-smoke}.ts` 는 `quiz` 를 읽어 실행하면 깨진다 — 지울지 유지할지(손대지 않음).

## 11. 재발 가능한 함정 (vault 지식 후보)
- 구조화 출력에 «줄마다 배열» 이 들어가면 출력이 입력의 두 배 이상 늘 수 있다 — **추가 필드는 입력 글자 수가 아니라 출력 토큰으로 예산을 본다.**
- 6층 규칙 때문에 «L3 가 L2 의 검증 함수를 직접 쓴다»는 설계는 성립하지 않는다 → **L2 `extraCheck` 가 정리까지 끝내고 돌려주는** 방식이 맞다(`repair.ts` 도 같은 방식).
- 엔진 로그가 위반 문구를 그대로 남기므로 **위반 문구에 레슨 글을 싣지 않는다.**
- 골든 해시는 persona 문구 한 구절에도 깨진다 — persona 를 고치면 **모든 모드의 골든**을 확인한다(이번엔 A1·A4 둘).
