---
task_id: task-081
title: "task-081 PE 3단계 기록 — 조각 지침 보정 + slash 결정적 보정 + 재측정 6회"
type: pe-record
tags:
  - type/task
  - domain/lesson
  - domain/prompt
created: 2026-10-21
updated: 2026-10-21
---

# task-081 Prompt-Engineer 3단계 기록 (지침 보정 + 재측정)

> 이력서 [[task-081-improve-lesson-chunk-step]] · 1단계 [[task-081-pe-record]] · 2단계 [[task-081-pe-measure-record]] · G6 판정 `task-081-pe-data/g6-judgment.md` · 하네스 `tests/prompts/lesson-pieces-live.ts` · 미러 `~/.node-local/thekaiwa-pe081`(지시문의 `pe081b` 는 존재하지 않는다 — 2단계가 쓴 미러는 `pe081`)
> 호출 예산: 사용자 승인 40 / Leader 상한 30 / **이번 소환 6 — 6회 사용, 누적 18.** 합격선 G1~G6 은 사전 등록 값 그대로(측정 뒤 수정 없음). 이 문서는 사실만 적고 **조각 품질(G6)은 판정하지 않는다**(자기 채점 금지).

## 0. 한눈에 (불편한 사실 먼저)

1. **[확실] 원인 ② «종류가 지침과 어긋남» 은 프롬프트 규칙만으로 고쳐지지 않았다.** 자동 탐지가 되는 세 항목이 보정 전·후 **같은 모양으로 남았다**: 수량 `一つ` → MODIFIER (core 4/4 → r2 2/2, **지침 예문 자체가 一つ=NAME 인데도**) · 인사·부탁 `よろしくお願いします` → ACTION (core 1/1 → r2 **4/4**) · `混んでいました` → FEELING (1/1 → 1/1). 새 규칙 문장(수량=NAME·정형 인사=EXPRESSION·〜ている 상태 동사=ACTION)이 이 항목들에서는 효과가 없었다는 뜻이다(표본 작음 — r2 는 6호출).
2. **[가능성 높음] 원인은 persona §5 «조각 프레임» 과의 충돌이다.** `tutor.md` §5 는 LESSON 모드 persona 에 들어가며 `꾸밈(飾): 부사·수식·조사구·시간·장소 — 昨日 / 友達と / とても / 新宿で`, `느낌(感): 형용사·감정·평가` 로 chunks 4유형을 정의한다. pieces 6유형(수량·때·장소=NAME, 조사=LINK)과 정의가 다르고, 모델이 후자(자기 분류)를 따른 흔적이 `一つ`(예문을 그대로 베끼면서 종류만 바꿈)에서 보인다. **[추측]** — 확인하려면 라이브 호출이 필요하다(이번 예산 소진). persona 는 모든 모드의 바이트(골든 해시)와 런타임에 영향을 주므로 이번 소환에서는 건드리지 않았다(에스컬레이션 §6).
3. **[확실] 원인 ①·④ 는 숫자로 크게 줄었다.** 홀로 떨어진 です/ます 류 조각 core 22개(18줄=17.6%) → r2 **0개**, G5b 5.9% → **0%**. 명사-조사 사이 slash(정리 전 상태) core 14개/102줄(13.7%) → r2 2개/52줄(3.8%) — 이 2개는 정리 단계가 조사로 옮겼다(`slashMoved=2`, 저장 뒤 0).
4. **[확실] G1~G5b 전부 통과(6회 환산 포함), 재시도 0, null 줄 0/52.** 다만 표본이 6호출(TOPIC 만)이라 core 와 같은 입력 조합이 아니다 — 비교는 «방향» 만 보여 준다. 복습·상황·붙여넣기는 다시 부르지 않았다(지침 줄이 같은 바이트 — 시험이 고정).
5. **[확실] 프롬프트 +332자는 CAP 을 넘겨서 CAP 을 올렸다(9,900 → 10,300).** 다른 줄을 깎아 상쇄하지 않았다(§2 이유). 올림 이유와 새 천장은 §2.
6. **[확실] 눈가림 표 r2 40줄은 만들었고 판정하지 않았다.** 한계: r2 의 TOPIC 호출은 지침 예문(`温かいコーヒーを一つください。`)을 그대로 베끼는 경우가 있어 «독립 표본» 이 아닐 수 있다(T-cafe-order-N4 의 첫 줄이 같은 문장).

## 1. 체크포인트 로그

- [CP0 읽기] 1·2단계 기록·G6 판정·눈가림 표·현재 프롬프트/검증 코드 확인. 어색 13줄 원인 4가지 → 프롬프트 규칙(공유 한 줄 `piecesInstruction.ts`) + 결정적 보정은 원인 ④(slash)만.
- [CP1 보정·시험 완료, 호출 0] §2~§4. `src/modules/conversation` + `engine` 시험 **1,600개 통과**(최종 지침 문구 기준 재실행) · eslint(`src/modules/conversation tests/prompts`) 0 · `tsc --noEmit` 내 영역 0건(전체 28건은 전부 `src/components/lesson/**`·`components/challenge/logic.ts` — 화면 ③ 갈래 진행 중 파일) · 변이 9/9 사망 · DRY 통과(24개 입력 요청 생성·조각 지침 1회·quiz 없음).
- [CP2 라이브 r2] 2026-10-21 15:23:05 KST 시작(실시간 약 4분 20초, 호출 시간 합 254.5초), `LIVE_OK=task-081 PLAN=r2 MAX_CALLS=6 ARM=v10r2`, PID 3701076 정상 종료(exit 0, 남은 프로세스 0, 포트 점유 없음 — 3010 은 운영 앱). **호출 원장 `pe-081-tune/task081-pieces-r2.calls.json`: start 6 · end 6.** 하네스 행 6(성공 6·실패 0), CLI 시도 6(재시도 0), 한도(429) 문구·즉시 실패 0. 측정 중 프롬프트·코드·픽스처 수정 0, 재동기화 0. (측정 전 미러 ↔ NFS 대조 차이 0, `mirror-audit` exit 0.)
- [CP3 지표·표] 아래 §5·§7. 눈가림 표 40줄(풀 52줄, `SEED=82`), 열쇠 `sealed/blind-sheet-r2.key.json` — **열어 보지 않았다.**
- 참고: 측정 전에 하네스를 `LIVE_OK` 없이 한 번 실행했다(계획만 출력하고 종료 — 호출 0, 원장·결과 파일 생성 없음 확인).

## 2. 변경 요약 (파일)

| 파일 | 변경 |
|---|---|
| `src/modules/conversation/prompts/piecesInstruction.ts` | 조각 지침 한 줄 869 → **1,201자(+332)**. A4(일반·상황)·A5(복습)가 같은 문장을 쓰므로 한 곳. 버전 표기는 **`lesson@v10`·`lessonScenario@v2`·`reviewMix@v4` 그대로**(미배포라 사용자에게 나간 적이 없다 — 파일 머리 주석에 사실 기록). |
| `src/modules/conversation/structuredResponse/lessonPieces.ts` | **slash 결정적 보정**(PE 확정 3): `moveSlashOntoParticles` — slash 가 켜진 조각(type 있음) 바로 뒤가 LINK 면 그 slash 를 LINK 연속 구간 끝으로 옮긴다(구간 안 다른 slash 는 접음). 글·순서·종류 불변 → «같음» 정의·위반 판정 불변(줄이 null 이 되지 않는다). type null 조각(문장부호)의 slash 는 건드리지 않음. 꼬리 정리보다 먼저 실행(줄 끝에 닿으면 지워짐). 멱등. `checkPieces` 결과 `slashMoved`, `LessonPiecesSummary.slashMoved` 추가. |
| `src/modules/conversation/prompts/{lesson,reviewMix}.ts` | 엔진 로그 `… reasons={…} slashMoved=N`. **`lesson.ts` `LESSON_USER_PROMPT_CAP` 9,900 → 10,300** + 주석. |
| 시험 | `lessonPieces.test.ts`(71개: 픽스처 60 + 단위 11 — 지침 문구 고정 3개·slash 합산 1개 신규) · `lessonPiecesLive.test.ts`(12개: 기존 8 + r2 계획·`KIND_CAP`·`slashMoved` 파싱·휴리스틱 플래그·`compareRuns` 4개 신규) · `lesson.test.ts`·`lessonScenario.test.ts` 예산 천장 갱신 |
| 픽스처 | `tests/prompts/fixtures/lesson-pieces-cases.json` 52 → **60건**(slash→조사 8건 추가, 기존 «마지막 조각 slash» 2건의 기대값 갱신, `expect.slashMoved` 추가 — 파이썬 독립 구현으로 생성, 기존 good 케이스 전부 같은 결과 확인) · `lesson-general-golden.json`(7건, 요청 바이트 해시) 재기록 |
| 하네스 `tests/prompts/lesson-pieces-live.ts` | `PLAN=r2`(6회)·`KIND_CAP`(계획별 상한: core 12·extra 6·r2 6 — 환경변수가 커도 못 넘김)·`COMPARE=1`(core/r2 같은 분석기로 나란히)·휴리스틱 플래그 7개 추가(아래 §5)·`parseLogs` 가 `slashMoved` 읽음 |

### 2-1. 지침 보정 전/후 (바뀐 문장만)

**보정 전(869자)** — type 절: `NAME(사람·물건·장소·때·수량) · ACTION(동사, 활용형 통째로: 飲みます・来てください・お待ちください, する동사도) · FEELING(い/な형용사, です/ます 는 앞에 붙임: 静かです) · MODIFIER(…) · EXPRESSION(문장 밖에서 통째로 쓰는 인사·대답: はい・すみません・お願いします) · LINK(…)`, ko 절: `조사는 "~을/를"·"~에서"·"~까(물음)" 형식`, slash 절: `한 문장에 2~4곳(조사까지 붙은 주제·목적어·장소 덩어리 뒤, 마지막 서술 덩어리 앞, 쉼표 뒤), 줄의 마지막 조각은 false`.

**보정 후(1,201자)** — 원인별로 다음이 바뀌었다(나머지·예문 두 개는 같은 바이트):
- ① `**です・ます・でした・ました 는 바로 앞 조각에 붙이고 따로 떼지 않습니다**(学生です=NAME・静かです=FEELING・食べました=ACTION). 문말 か・ね・よ 만 LINK 로 따로 두며, 떼어 낸 ですか 를 EXPRESSION 으로 만들지 않습니다.` (FEELING 괄호 안 «です/ます 는 앞에 붙임» 한 구절을 독립 문장으로 승격)
- ② `NAME(…수량: 二人・三枚도 꾸밈이 아니라 NAME)` · `ACTION(…, する동사와 〜ている 상태 동사도 느낌이 아니라 ACTION: 練習しています)` · `EXPRESSION(문장 밖에서 통째로 쓰는 인사·대답·정형 부탁: はい・まだです・いただきます・お先に失礼します — 부사+です 대답도, 동사 꼴 정형 인사·부탁도 EXPRESSION)`
- ③ `ko: … 조사는 "~을/를"·"~에서"·"~까(물음)", に 는 때·장소 "~에"·목적 "~하러"(散歩に行く), 문말 よ 는 "~요(강조)" — "~이에요"·"~이요" 로 풀지 않습니다.`
- ④ `…쉼표 뒤), 명사와 조사 사이는 끊지 않고 조사 조각에 slash, 줄의 마지막 조각은 false.` (+ 결정적 보정)
- **눈가림 표(`blind-sheet.md`)의 문장·낱말은 예시에 쓰지 않았다**(시험으로 고정). 새 예시 낱말: 二人・三枚・学生です・食べました・練習しています・まだです・いただきます・お先に失礼します・散歩に行く.

### 2-2. 프롬프트 길이와 CAP

| | v10(보정 전) | 보정 후 | 증가 |
|---|---|---|---|
| 조각 지침 한 줄 | 869 | 1,201 | **+332** (한도 +450 이내) |
| 주제 경로 정상~준최악(시험 (a)) | 9,853 | 약 10,185 | +332 |
| 실제 DB 한도 최악(시험 (b)) | 9,886 | **10,218**(시험 진단값) | +332 |
| 상황 없는 최악(`lessonScenario` 시험) | 약 9,400 | 9,729 | +329~332 |
| CAP / 천장(시험) | 9,900 / 9,920 | **10,300 / 10,250**(상황 포함 합계 천장 11,000) | |

**CAP 을 올린 이유(보고 대상)**: 다른 줄(id 규칙·모범 답 규칙·reading 규칙·키 제한 줄)은 재시도·위반을 줄이려고 실측으로 다듬은 줄이라, 깎은 뒤의 회귀를 볼 라이브 호출이 이번 예산(6회)에 없다. CAP 은 런타임 강제가 없는 설계 예산이고(120s 배치 잡), 입력 +332자(약 220토큰)는 지연에 거의 영향이 없다 — 실측으로도 확인(§5: 1차 성공 중앙값 core 42.6초 → r2 43.3초).

## 3. 시험·변이

- 단위/픽스처: `lessonPieces.test.ts` 71 · `lessonPiecesLive.test.ts` 12 · 전체 `conversation`+`engine` **1,600 통과**(0 실패). 경계값 포함: 옮길 대상 없음 · 이미 LINK 에 slash 있음 · LINK 연속 구간 · 마지막 조각(옮긴 slash 가 줄 끝에 닿아 삭제) · 문장부호 조각의 slash 불변 · 한 줄 두 군데 · 멱등(정리된 배열을 다시 넣으면 `slashMoved=0`).
- **변이 시험 9건(임시 파일 + `mv`, 원복 뒤 `cmp` NFS 와 일치 확인) 전부 사망**: M1 type-null 가드 제거(1건 실패) · M2 LINK 구간 확장 제거(2) · M3 이동을 꼬리 정리 뒤로(5) · M4 원 조각 slash 를 지우지 않음(10) · M5 옮긴 수를 세지 않음(10) · M6 조사에 이미 slash 가 있으면 옮기지 않음(5) · M7 지침에서 수량=NAME 삭제(2) · M8 지침에서 «조사 조각에 slash» 삭제(1) · M9 지침에 눈가림 표 낱말 삽입(1).
- 골든 재기록: `UPDATE_GOLDEN=1 … lessonScenario.test.ts` → 미러에서 만든 `lesson-general-golden.json` 을 NFS 로 복사(지침 문구를 한 번 더 고쳐 두 번 재기록). `talk-general-golden.json` 은 이번 소환에서 바뀌지 않음.

## 4. 호출 대조 (예산)

| 구분 | 수 |
|---|---|
| 하네스 행(`completeJson` 호출) | 6 |
| 호출 원장 start / end | 6 / 6 |
| CLI 시도(재시도 포함) | 6 |
| 이 소환 허용 | 6 (`KIND_CAP.r2`=6 — 환경변수가 커도 못 넘김) |
| **총량 사용(Leader 상한 30 중)** | **18** (core 12 + r2 6; 사용자 승인 40 중 18) |

## 5. 결과 — core(12회·102줄) 대비 r2(6회·52줄)

### 5-1. 합격선 G1~G5b (하네스 판정, 사전 등록 값 그대로)

| # | 합격선 | r2 측정값 | 판정 | (core) |
|---|---|---|---|---|
| G1a | 1차 성공 중앙값 ≤ 60초 | 43.3초 (n=6, 38.3~45.4) | 합격 | 42.6초 |
| G1b | 전체 최대 ≤ 100초 | 45.4초 | 합격 | 80.2초 |
| G1c | 120초 초과 0 | 0 | 합격 | 0 |
| G2a | 재시도율 ≤ 17% (**6회 환산: ≤ 1회**) | 0/6 | 합격 | 2/12 (경계) |
| G2b | 최종 실패 0 | 0 | 합격 | 0 |
| G3a | null 줄 ≤ 10% | 0/52 = 0% | 합격 | 5/102 = 4.9% |
| G3b | 마지막 시도 면책 0건 | 0 | 합격 | 0 |
| G3c | 1차 조각 임계 재시도 ≤ 1건 | 0 | 합격 | 0 |
| G4 | koNoHangul ≤ 3% | 0/255 | 합격 | 0/528 |
| G5a | 조사가 LINK 아님 ≤ 3% | 0% of 60 | 합격 | 1.5% of 137 |
| G5b | です/ます·어미 분리 줄 ≤ 5% | **0/52 = 0%** | 합격 | **6/102 = 5.9% 불합격** |
| G6 | 눈가림 Leader 판정(≥40줄) | 표 40줄 생성 — **미판정** | Leader 몫 | 67.5% 불합격 |

### 5-2. 원인별 자동 탐지 항목 (휴리스틱 — 게이트 아님, 정규식은 `lesson-pieces-live.ts` 상단)

| 원인 | 탐지 항목 | core (102줄) | r2 (52줄) |
|---|---|---|---|
| ① | 홀로 떨어진 です/でした/ます/ました(+か·ね·よ) 조각 | **22개 · 18줄 (17.6%)** — `です`(FEELING) 17 · `でした` 2 · `ですか`(EXPRESSION) 2 · `ですか`(LINK) 1 | **0 · 0줄** |
| ① | G5b 분리 줄(FEELING+です, 활용형+ます) | 6줄 (5.9%) | 0줄 |
| ② | 수량인데 NAME 아님 (`一つ`…) | 4 (전부 MODIFIER) | **2 (전부 MODIFIER)** |
| ② | FEELING 인데 〜ている/する 꼴 | 3 (緊張しています 2·混んでいました 1) | 1 (混んでいました) |
| ② | 정형 인사·부탁이 ACTION (…お願いします 류) | 1 (よろしくお願いします) | **4 (전부 よろしくお願いします)** — 자기소개 호출에 이 문장이 4번 나왔다 |
| ③ | よ 풀이가 «~이에요/~이요» | 2 / よ 조각 8 | 0 / よ 조각 1 (표본 부족) |
| ③ | に 풀이 «~으로» | 1 / に 조각 17 | 0 / に 조각 10 (그중 «~하러» 1) |
| ④ | 명사-조사 사이 slash (정리 **전**) | 14개 (13.7%) — 옛 파이프라인이라 저장까지 남음 | **2개 (3.8%)** = `slashMoved` 2, 저장 뒤 0 |
| — | 구간(slash) 없음 줄 / 5곳 초과 줄 | 0 / 1 | 1 / 0 |

해석(사실만): ① 은 규칙 문장이 먹혔고 ④ 는 규칙이 raw 발생률을 약 1/4 로 줄인 뒤 남은 2건을 결정적 보정이 처리했다. ③ 은 표본이 부족해(よ 1개) 판단 불가. **② 는 개선 신호가 없다**(§0-1).

### 5-3. 크기·지연 (프롬프트 +332자의 영향)

| | core | r2 |
|---|---|---|
| 프롬프트 글자(persona 포함 CLI 입력) 중앙값 | 11,742 (TOPIC 1차 성공만 11,748) | 12,052 (+약 310) |
| 응답 JSON 글자 중앙값 / 최대 | 6,645 / 7,582 | 6,741 / 7,336 |
| pieces 몫 | 38.2% | 36.7% |
| 조각/줄 · 구간/줄 | 7.6 · 2.04 | 7.1 · 1.50 |
| 1차 성공 경과 중앙값 / 최대 | 42.6초 / 49.3초(전체 최대 80.2초는 재시도 2건) | 43.3초 / 45.4초 |
| 종류 분포(type 있는 조각) | LINK 26.5% · NAME 24.4% · FEELING 13.1% · EXPRESSION 12.9% · ACTION 12.9% · MODIFIER 10.2% | NAME 25.1% · LINK 24.3% · ACTION 16.5% · EXPRESSION 13.3% · MODIFIER 11.8% · FEELING 9.0% |

지연은 변화 없음(프롬프트 증가분의 영향 관찰 안 됨). 구간/줄이 2.04 → 1.50 으로 줄었다 — 지침의 slash 절 문구 변화와 TOPIC 만의 표본 효과가 섞여 있어 어느 쪽인지는 모른다.

## 6. 에스컬레이션·열린 결정 (Leader)

1. **원인 ② 후속 여부**: ⓐ 그대로 G6 로 판정(② 해당 줄이 40줄 중 몇 줄이냐에 달림) ⓑ **persona §5 충돌을 푸는 한 문장 추가**(예: «조각(pieces) 6유형은 chunks 4유형과 다릅니다 — 수량·때·장소 명사는 이름, 조사는 연결») + 3호출 확인. ⓑ 는 persona(`tutor.md`) 변경이라 모든 모드 골든 해시가 바뀌고 런타임 영향이 있어 이번 소환에서 하지 않았다(에스컬레이션 조건: 페르소나 절 구조 변경 — 구조는 그대로이나 §5 내용 변경). 대안 ⓒ 지침 줄 맨 앞에 «persona 의 4유형 정의가 아니라 아래 6유형을 쓴다» 한 줄(+약 50자) — persona 불변이라 안전하지만 효과는 미측정.
2. **문서 동기화(Leader/designer)**: `docs/screens.md` §37-12-3 규칙 6·§37-18-1 PE 확정에 «slash 를 명사에서 조사로 옮김(PE 확정 3)» 한 줄. `lesson-pieces-cases.json` 을 쓰는 developer 시험이 있으면 기존 2건(`slash 줄 마지막 조각은 지움`·`저장 모양(slash 키 없음)도 같은 결과`)의 기대값이 바뀐 것에 맞춰야 한다(현재 learning 쪽에 이 파일을 쓰는 시험은 없음 — grep 확인).
3. **CAP 10,300**(§2-2) 수용 여부.
4. 서버 `generate.ts` 의 `toolLog` 가 `slashMoved` 를 싣으려면 `applyLessonPieces` 반환 요약(`slashMoved`)을 받아야 한다 — 지금은 엔진 로그 줄(`[lesson|reviewMix] pieces — … slashMoved=N`)에만 있다(developer 소관, 필요하면).

## 7. 산출물 위치

| 파일 | 내용 |
|---|---|
| `agent-vault/10-Flow/tasks/task-081-pe-data/blind-sheet-r2.md` | 눈가림 표 r2 S01~S40 (시드 82, 풀 52줄, arm·호출 id 없음) |
| `…/task-081-pe-data/sealed/blind-sheet-r2.key.json` (+`README.md`) | **열쇠 — Leader 판정 확정 전 열지 않음**(나도 열지 않았다) |
| `…/task-081-pe-data/r2-summary.json` | 호출별 지표 + core/r2 나란히(`COMPARE=1` 결과, 글 없음) |
| 스크래치 `/tmp/claude-1000/-home-brownjeon-NFS-homes-brownjeon-project-TheKaiwa/729e3300-9a56-4bdf-bda2-ca7f7603c97f/scratchpad/pe-081-tune/` | `task081-pieces-r2.json`(레슨 글 포함 — vault 로 복사 안 함)·`.calls.json`·`run-r2.log`·`compare.json`·변이/시험 로그·보정 전 파일 사본 |

판정 방법: Leader 가 `{"S01":"맞음",…}`(40개) 를 만들면 `cd ~/.node-local/thekaiwa-pe081 && SCORE=1 VERDICTS=<판정.json> KEY=<sealed/blind-sheet-r2.key.json> node --env-file=.env --import tsx tests/prompts/lesson-pieces-live.ts`.

## 8. 한계

- r2 는 6호출·TOPIC 만(self-intro N4·N3, cafe-order N4, travel-story N5·N2, ask-directions N4)이라 core(복습·상황·붙여넣기 포함)와 입력 조합이 다르다. 6회 환산 합격선은 «참고용» 이다(G2a ≤1회·G3c ≤1건).
- 자동 탐지는 휴리스틱이다: `お願いします` 끝말은 «コーヒーをお願いします» 처럼 물건을 청하는 쓰임도 있어 정형 인사만 가르지 못하고, 수량 정규식은 `十分` 같은 낱말에 오탐할 수 있다. 사람 판정은 G6 만 가른다.
- 눈가림 표 r2 는 지침 예문 문장이 그대로 들어간 줄이 있을 수 있다(독립 표본 아님). 풀 52줄 중 40줄을 뽑았으므로 표본 대부분이 겹친다.
- 原因 ③(뜻 풀이)은 r2 에 よ 1개·목적 に 1개뿐이라 개선 여부를 모른다.

## 9. 재발 가능한 함정 (vault 지식 후보)

- **persona 의 개념 정의가 지침 줄의 정의와 다르면 지침이 진다** — pieces 6유형 지침을 고쳐도 persona §5 의 chunks 4유형 정의(꾸밈=부사·수식·조사구·시간·장소)가 남아 있으면 모델은 자기 분류를 따른다. 새 분류 체계를 도입할 때는 persona 의 옛 정의가 같은 모드 프롬프트에 함께 들어가는지부터 본다. **예문에 정답을 적어도 모델이 같은 문장을 베끼면서 종류만 바꾼다**(`一つ`).
- 프롬프트 CAP 은 시험 5곳에 숫자로 박혀 있다(`lesson.test.ts` 천장·`lessonScenario.test.ts` 두 곳·`lesson.ts` 주석·CAP). 지침을 길게 하면 한꺼번에 올려야 한다. 골든 해시도 지침 한 글자에 깨진다 — 지침 문구를 확정한 **뒤에** 골든을 재기록한다.
- 결정적 보정은 «글을 안 바꾸는 속성(slash)» 에만 안전하다. 합치기·종류 바꾸기는 «같음» 정의·화면 의미를 건드리므로 프롬프트로만 다룬다.
- 검증기가 못 잡는 규칙(≈ 이으면 같으므로 통과)은 휴리스틱 + 사람 판정으로만 보인다. 이번에 자동 탐지 7개를 하네스에 넣어 다음 측정부터 «어색» 원인을 바로 센다.

---

## 10. 회귀 확인 (PE, 2026-10-21 15:35~15:37 KST) — 복습·상황·붙여넣기 라이브 3회

**목적**: r2 는 주제 수업만이라 `reviewMix@v4`·`lessonScenario@v2`·sourceText 생성은 보정된 조각 지침(CAP 10,300)으로 라이브 확인이 없었다. core 의 `R-6`·`S-cafe-order-N5`·`SRC-paste-N4` 와 **같은 입력·같은 id** 로 3호출. 프롬프트·스키마·검증 코드 변경 0 (하네스 계획만 추가).

### 10-1. 실제 실행한 것
| 항목 | 값 |
|---|---|
| 하네스 변경 | `tests/prompts/lesson-pieces-live.ts` — `PLAN=reg`(`KIND_CAP.reg=3`, `HARD_CAP` 20 불변, 결과 라벨 기본 `v10r2`) · dry() reg 점검(core 와 같은 입력 JSON 일치) · `COMPARE` 가 `PLAN=reg` 이면 core 를 같은 id 로 걸러 id 별 표(`compareById`) 출력 |
| 단위 시험 | 새 `tests/prompts/lesson-pieces-live.reg.test.ts` 5건(계획 3건·core 와 동일 입력·요청 바이트 동일·상한 3·`MAX_CALLS=99` 에도 하위 프로세스가 상한 3·`LIVE_OK` 없음/틀림이면 호출·원장 0·`compareById`) + 기존 `lessonPiecesLive.test.ts` 12건 = **17/17 통과**. eslint 0건. (`src/**` 금지 지시라 새 시험을 `tests/prompts/` 에 둠 — `npm test` 의 src 글롭에는 안 잡힘 → Leader 가 `src/modules/conversation/__tests__/` 로 옮길지 결정) |
| 미러 | `~/.node-local/thekaiwa-pe081` 을 NFS 와 `sync-local.sh` 로 맞춘 뒤(측정 전 1회, 측정 중 재동기화 없음) `mirror-audit --check` exit 0, 핵심 파일 sha 동일 확인(tutor.md 2bfa9c42… · piecesInstruction.ts 540b13c2… · lesson.ts ebffc619… · reviewMix.ts 478c04e6…) |
| DRY | 호출 0 — 계획 3건·`KIND_CAP={core:12,extra:6,r2:6,reg:3}`·원장 경로 확인, 조각 지침 1번씩 포함 |
| **라이브** | `LIVE_OK=task-081 PLAN=reg MAX_CALLS=3 ARM=v10r2` 직렬(간격 ≥1.5초). **원장 `reg.calls.json`: start 3 · end 3** = 실제 호출 3회. 429·한도·즉시 실패 0. 모델 sonnet. **이번 소환 3회 / 누적 21회**(core 12 + r2 6 + reg 3; 사용자 승인 40·Leader 상한 30 이내) |

### 10-2. 나란히 (core → reg, 같은 id)
| id | 경과 | 시도 | 프롬프트 글자(persona 7,075 포함) | 응답 글자 | 줄 / null 줄 | 조각 수 | 구간(slash) |
|---|---|---|---|---|---|---|---|
| R-6 (복습) | 38.4 → **41.8초** | 1 → 1 | 10,776 → 11,108 (+332) | 6,171 → 6,695 | 8/0 → 8/0 | 50 → 63 | 24 → 20 |
| S-cafe-order-N5 (상황) | 44.1 → **41.5초** | 1 → 1 | 12,291 → 12,623 (+332) | 7,554 → 6,972 | 10/0 → 10/0 | 81 → 66 | 26 → 20 |
| SRC-paste-N4 (붙여넣기) | 38.1 → **42.8초** | 1 → 1 | 11,232 → 11,564 (+332) | 6,200 → 6,712 | 8/0 → **9/1** | 59 → 64 | 14 → 15 |

- **지표(G1~G5b, 사전 등록 정의, n=3 이라 참고용)**: 전부 OK — G1a 중앙값 41.8초(≤60) · G1b 최대 42.8초(≤100) · G1c 120초 초과 0 · G2a 재시도 0/3 · G2b 실패 0 · G3a null 줄 **1/27 = 3.7%**(≤10%) · G3b 면책 0 · G3c 1차 조각 임계 재시도 0 · G4 koNoHangul 0/140 · G5a 조사가 LINK 아님 0%(44개 중) · G5b 분리 줄 0%. (core 같은 3건도 전부 OK)
- **프롬프트 길이**: 세 경로 모두 core 대비 **정확히 +332자**(지침 보정분 +329 와 일치 — 다른 줄 변화 없음). persona 를 뺀 `system+user` 는 R-6 3,641 · SRC 4,097 · S 5,123자(DRY) — CAP 10,300 은 «정상~준최악 조합» 설계 예산이라 시드 입력은 근처에도 못 간다(최악 10,215 는 단위 시험 `lesson.test.ts` 가 고정).
- **계약 위반으로 인한 재시도 0** (3건 모두 1회 성공). 원인 로그 없음.
- **null 줄 1건**: SRC-paste-N4 line 8 `お弁当はどうでしたか。おいしかったですか。` — 이유 `type_null_mismatch` 1(원본 응답은 정리 단계가 null 로 바꾼 뒤라 보존 안 됨). core 의 같은 호출은 null 0. 27줄 중 1줄이라 원인(지침 vs 우연)은 판단 불가.
- **휴리스틱 플래그(게이트 아님)**: reg 합계 `feelingVerbForm` 2 — 둘 다 R-6 의 `緊張しています`(FEELING)(core R-6 은 1건, 다른 호출 포함 core 12회에서도 3건이었던 «② FEELING 인데 ている 꼴» 이 지침 보정 뒤에도 남음 — r2 와 같은 결론: ② 는 개선 신호 없음). 나머지 0: `lonelyCopula` 0 (core S 에서 2) · `quantityNotName` 0 (core S 에서 1) · `greetingAsAction` 0 · `koYoBad` 0 · `slashBeforeLink` 0 (core R-6·S 에서 각 1) · `slashMoved` 합계 22 (R-6 10 · S 12 · SRC 0 — 정리 단계가 명사→조사로 옮긴 구간).
- 조각 종류 분포(type 있는 140개): LINK 45 · NAME 38 · ACTION 18 · EXPRESSION 16 · FEELING 13 · MODIFIER 10.

### 10-3. 눈가림이 아닌 전체 줄 목록
`task-081-pe-data/blind-sheet-reg.md` — **26줄 전부**(풀 26줄 = 27줄 − null 1줄, `SHEET_N=60 SEED=83`), 호출 id·arm 숨김. 열쇠 `task-081-pe-data/sealed/blind-sheet-reg.key.json`(S01~S26 → 호출·줄). 조각 품질은 판정하지 않았다(Leader 몫). 수치 요약은 `task-081-pe-data/reg-summary.json`(글 없음). 레슨 글이 들어 있는 원본 `reg.json`·`reg.calls.json` 은 스크래치 `/tmp/claude-1000/-home-brownjeon-NFS-homes-brownjeon-project-TheKaiwa/729e3300-9a56-4bdf-bda2-ca7f7603c97f/scratchpad/pe-081-reg/` 에만 둔다.

### 10-4. 한계
- n=3 이라 지연 중앙값·비율은 «이상 징후 없음» 수준의 확인이다(사전 등록 숫자의 통계적 판정 아님). core 대비 경과 ±4초는 호출 간 분산 안.
- 응답 크기는 줄어든 호출(S: 7,554 → 6,972)과 늘어난 호출(R-6: 6,171 → 6,695)이 섞여 있어 방향성을 말할 수 없다.
- null 줄 1건의 원인은 이 데이터로 모른다. 원인이 알고 싶으면 정리 단계 전 원본 응답을 남기는 하네스 옵션이 필요하나 이번 소환은 측정 무효화 방지를 위해 코드를 더 바꾸지 않았다.
