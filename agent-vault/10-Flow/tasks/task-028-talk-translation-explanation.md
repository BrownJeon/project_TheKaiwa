---
task_id: task-028
title: "개선 — 회화 번역 줄 한국어 자연스럽게(이중 높임 금지)·교정 설명 수준별 쉬운 한국어 (IMP-0020·0022)"
status: doing
base_ref: bcf0df2
risk_level: R1
roles_involved: [leader, judge, prompt-engineer, reviewer, deployer]
related_tasks: [task-007-talk-voice-web, task-010c-correction-mode, task-004-ai-client-persona]
tags:
  - type/task
  - domain/improvement
  - domain/prompt
aliases:
  - task-028
  - 번역 비문
created: 2026-10-03
updated: 2026-10-03
---

## 목표 (Leader)
[[IMP-0020-회화-번역줄-한국어-비문|IMP-0020]]·[[IMP-0022-교정-음성설명-다시듣기|IMP-0022]] — 회화(A1 `talk`) 응답의 ① `translation`(한국어 번역 줄)이 자연스러운 한국어 존댓말이 되게 하고(이중 높임 「드려드리겠습니다」 같은 비문 금지, 직역체 피하기) ② 교정 `explanationKo` 를 학습자 수준(JLPT 레벨)에 맞춘 쉬운 한국어 위주로(일본어 문법 용어·일본어 인용 최소화) 쓰게 한다.

## 사용자 결정·지시
- 2026-10-03 18:05 IMP-0020 "지금 바로 수정"(권고안 — light 트랙 후보) · IMP-0022 원문: "그렇다면 교정에 대한 설명은 되도록 사용자의 수준을 고려하여 최대한 한글로 표기해줘" — 교정 음성 설명·다시 듣기는 하지 않는다.

## 재현 근거
- 2026-10-03 TALK '쇼핑'(주제·상황 없음, traceId `t_rApoXn51DLgsUlR4OfBD`): USER `ビニール袋お願いします` → 일본어 `かしこまりました。ビニール袋をお付けします。ほかにご不明な点はございますか？`(정상) / 번역 `알겠습니다. 비닐봉투를 드려드리겠습니다. 다른 궁금한 점이 있으신가요?`(이중 높임 비문 — 기대 "비닐봉투 넣어 드리겠습니다").

## 범위
- `src/modules/conversation/prompts/talk.ts`(A1 지시문 — translation 규칙 한 줄·explanationKo 수준 규칙) + 필요 시 `checks.ts` 후검증(예: 「드려드리」 같은 명백한 이중 높임 패턴) + 회귀 픽스처·단위 테스트. **A1 ≤3,000자·2문장 예산 유지**(실측 보고), 5초 지표 회귀 없음.
- 비범위: 화면·스키마·TTS·채팅(A2) 번역(필요하면 PE 가 같은 규칙 적용 여부를 보고만).

## 완료 기준
- 위 재현 입력 포함 회귀 픽스처에서 이중 높임 0, 기존 talk 회귀 전부 통과, typecheck·eslint·단위 테스트 0 fail, 실 CLI 표본(PE 실측) 보고.

## Leader 보완 (2026-10-03, judge intake needs_info 3건 해소)
1. **기대 출력** — 정답 문장 하나로 고정하지 않는다. 판정 기준 = "이중 높임(드려드리·드리어드리 등) 없음 + 자연스러운 존댓말". 사용자가 든 「비닐봉투를 드리겠습니다」와 「비닐봉투 넣어 드리겠습니다」 모두 합격. 회귀 픽스처는 재현 입력(`ビニール袋お願いします` → `…ビニール袋をお付けします…`)과 비슷한 수여·겸양 표현(お付けします·お渡しします·お持ちします·ご案内します) 3~5건.
2. **수준 기준** — 학습자 프로필의 기존 JLPT 레벨(A1 에 이미 들어가는 학습자 수준 값)을 그대로 쓴다. 새 설정·스키마 없음. 낮은 레벨일수록 문법 용어 대신 쉬운 말, 일본어 인용은 고친 부분 한 조각까지만.
3. **경로** — A1 회화(TALK) 프롬프트만. 교정 음성·다시 듣기는 하지 않으므로 TTS·화면 경로 영향 없음. 채팅(A2)·표현 점검(A3)은 비범위(같은 문제가 보이면 PE 가 보고만).

## 관련 과거 이력 요약
- [[task-010c-correction-mode]]: talk@v5 — `hintKo` 모드별 문구·A1 예산 최빡빡(WINDOW_ROOM_SLACK·a1sweep 실측). [[task-007-talk-voice-web]]: 예열 CLI·`--system-prompt` 안정성(헤더 순서 유지). [[task-004-ai-client-persona]]: JSON 계약·ajv 재시도.

## 판단 기록 (judge)
- [2026-10-03 18:18] intake engine=jev → task_type=local_fix · risk=R1 · developer_model=sonnet · track=standard · next=ask_user | overrides=- | fallback=- | tokens=1312
- [2026-10-03 18:19] intake(재실행/needs_info해소) engine=jev → task_type=null(판정실패·Opus강제) · risk=R1 · developer_model=opus · track=standard · next=assign | overrides=MD-judge-failed-opus | fallback=- | tokens=1357

## 작업 기록

## Prompt-Engineer 기록 (2026-10-03, talk@v6)

- [18:50] 완료. 변경 파일: `src/modules/conversation/prompts/talk.ts`(`TALK_PROMPT_VERSION` `talk@v5`→**`talk@v6`**) · `src/modules/conversation/structuredResponse/checks.ts`(`checkReplyKoNaturalness` 신설) · `src/modules/conversation/index.ts`(위 함수 공개 export 1줄 추가) · `src/modules/conversation/__tests__/prompts.test.ts`(버전 단언 2곳 v6) · `src/modules/conversation/__tests__/task028.test.ts`(신규, 10건) · `tests/prompts/fixtures/talk-translation.json`(신규, 5건) · `tests/live/task028-translation-measure.ts`(신규, 실 CLI 표본용).

### ① translation(`conversation.replyKo`) — 자연스러운 존댓말·이중 높임 금지

- `replyJaInstructionLine` 의 `tail`: `"...replyKo 는 한국어 번역."` → `"...replyKo 는 자연스러운 존댓말 번역(이중 높임 금지)."`(+16자, 전 상한 1~4 공통).
- 지시문만으로는 보장이 안 돼 **후검증 1건을 TALK 전용으로** 더했다 — `checkReplyKoNaturalness(replyKo)`: `/드려\s*(드리|드릴|드린|드립|드렸)/` 매칭 시 위반 1건. "드려드리"(재현 그대로) 뿐 아니라 ㄹ-축약형(드릴게요 등, 픽스처 t05)까지 본다. **`checkTalkResponse`(=CHAT 도 호출)에는 넣지 않고 `buildTalkRequest` 의 `extraCheck` 에서만 `[...checkTalkResponse(...), ...checkReplyKoNaturalness(...)]` 로 합성** — 비범위인 채팅(A2)에 새어 들어가지 않는다(단위 테스트로 고정: "원문 무수정·CHAT 비범위" 케이스).
- 픽스처(`talk-translation.json`) 5건은 재현(お付けします)과 같은 수여·겸양 계열(お渡しします·お持ちします·ご案内します×2) — 각 항목 `bad`(이중 높임, 반드시 걸림) 1개 + `good`(정답 고정 없음, 걸리면 안 됨) 1~2개. "드려요"·"말씀드립니다"처럼 정상적으로 "드리"가 한 번만 쓰이는 표현은 오탐 0 확인.
- **실 CLI 표본(haiku, N5 학습자)**: 재현과 비슷한 가게 응대 발화 3건(비닐봉투·포장·짐 맡기기) 전부 `replyKo` 자연스러운 존댓말, 이중 높임 0/3("알겠습니다. 봉투는 몇 개 필요하신가요?" / "알겠습니다. 포장지 색깔은 어느 쪽이 좋으세요?" / "네, 알겠습니다. 맡아드리겠습니다. 얼마나 오래 맡아두시겠어요?") — 재현 그대로의 「お付けします」 응대는 이번 3회차에 다시 나오지 않아 그 정확한 조합의 실측 재현은 못 했지만(모델이 매번 다른 표현을 고름), 이중 높임 비문은 0/3 이었다. 회귀 방어의 1차 근거는 `checkReplyKoNaturalness`(단위 테스트, bad 5/5 검출·good 8/8 무검출)다.

### ② correction.explanationKo — 학습자 기존 level 에 맞춘 쉬운 한국어

- `correctionInstructionLine(mode, level)` — 새 설정 없이 기존 `LearnerHeader.level`(N5~N1)을 그대로 받는다. 공통(레벨 무관): `"...1~2문장."` → `"...1~2문장(일본어 인용은 고친 조각만)."`. 레벨 조건(N5·N4 만, `SIMPLE_EXPLANATION_LEVELS`): `" 쉬운 말로, 문법 용어는 쓰지 않습니다."` 추가. `talkInstruction` 3번째 인자로 `level`(기본값 `'N5'` — 보수적으로 쉬운 쪽 기본) 추가, `buildTalkRequest` 가 `input.learner.level` 을 그대로 넘긴다.
- **실 CLI 표본(haiku, e01·e03 각 N5/N1)**: N5↔N1 차이가 일부 보였으나(N1 e03 가 "타동사" 같은 용어를 추가로 씀) **N5 응답(e03)에도 "조사가 잘못되었습니다"처럼 "조사" 라는 문법 용어가 한 번 샜다** — 지시문이 100% 를 보장하지 않는다. 표본이 작아(레벨당 1회) 확정 수치는 못 낸다. **잔여 위험으로 보고**: 운영 반영 후 QA 가 N5 교정 표본 ≥10건을 모아 "조사·활용·접속조사" 등 용어 노출률을 한 번 더 보는 것을 권고한다(허용 기준은 Leader 결정 — 이 task 범위 밖).
- "일본어 인용은 고친 조각만"은 두 레벨 모두 실측에서 지켜졌다(`「行くました」`·`「友だちを会う」` 처럼 바뀐 조각만 인용, 교정문 전체를 다시 길게 인용한 사례 없음, 8/8).

### 예산(A1 ≤3,000자) 실측

- `renderTranscript(system, messages)` 기준 전 범위(level N5~N1 × sceneCap 1~4 × correctionMode 2종 × text 1~1,000자 × altText 60~50,000자 × longHistory 20개) 스윕 — **변경 전/후 최악 마진 동일(52자, 최악 길이 2,948자)**: altBudget·room 이 system 길이 증가분을 자동으로 흡수해(§ `talk.ts` altBudget/room 계산) 추가한 지시문 글자가 하드 캡을 밀어내지 않는다(git stash 로 변경 전 버전과 직접 대조해 확인, `scratch/measure2.ts`). 전체 테스트(1,220 pass / 1 skip 기존 / 0 fail) · `npm run typecheck` 0 · `npm run lint` 0(이 task 파일들 기준 — 무관한 기존 경고 7건·`tmp-pe/` 스크래치 2건은 그대로).
- 참고(task-010c 기존 기록 재확인, 이번 변경과 무관): "A1 ≤3,000자"는 `renderTranscript` 의 대화 기록 부분 기준이고, 실 CLI 호출의 `promptChars`(페르소나·래퍼 포함)는 3.9~4.0k 로 더 크다 — 기존에 문서화된 차이, 이번 task 로 새로 생긴 간극 아님.

### 재발 가능한 함정(기록)

- **altBudget/room 자기조정 때문에 "margin 측정"만으로는 지시문이 실제로 늘었는지 확인이 안 된다** — git stash 로 변경 전/후를 직접 대조해야 안전하다(이번에 그렇게 확인). 다음에 TALK 지시문을 또 늘릴 때도 같은 방법으로 비교할 것.
- **한국어 이중 높임 탐지는 "드려드리" 계열 한 패턴만** — 다른 이중 높임 형태(예: "주셔서 드리다" 등)는 못 잡는다. 범위를 넓히면 오탐 위험이 커지므로(기존 COACH 힌트 금지 목록 확장 실패 교훈과 같은 결) 의도적으로 좁혔다.
- **레벨별 "문법 용어 금지" 지시는 완전하지 않다** — 표본 1건에서 N5 응답에 "조사" 가 샜다. 운영 후 표본을 더 모아 확인 필요(위 ② 참고).

### 남은 일 / Reviewer 인계

- 남은 일 없음(완료). `prompts:sync`(Prompt Registry `PromptVersion(SOURCE_CODE)` 버전 반영)는 developer/Leader 영역이라 실행하지 않았다 — Reviewer PASS 후 배포 전에 필요.
- Reviewer 에 인계: `src/modules/conversation/prompts/talk.ts`·`src/modules/conversation/structuredResponse/checks.ts`·`src/modules/conversation/index.ts`(1줄) + 픽스처 `tests/prompts/fixtures/talk-translation.json` + 테스트 `src/modules/conversation/__tests__/task028.test.ts`·`prompts.test.ts`(버전만) + 실측 스크립트 `tests/live/task028-translation-measure.ts`.
- 다음 세션 첫 행동(끊김 대비): 이 섹션부터 읽고, 변경이 이미 끝났으면 바로 Reviewer 인계 메시지만 보내면 된다(재구현 불필요).

## Reviewer 기록 (2026-10-03, REV-061)

**판정: PASS.** Critical 0 · High 0 · Medium 0 · Low 2. base `bcf0df2` → working tree 를 전부 Read 로 대조(diff·untracked 확인), `~/.node-local/thekaiwa` 에서 재실행 검증.

### 실행 재검증
- `tsc --noEmit` 0 에러, `eslint`(변경 파일 5개) 0 경고, `src/modules/conversation` 전체 단위 테스트 363/363 pass(기존 352 + 신규 task028.test.ts 11건), 리포지토리 전체 `node --test` **1221개 중 1220 pass·1 skip·0 fail**(PE 보고 수치와 일치).
- `git status --porcelain` 로 변경 범위가 PE 선언(4 수정 + 4 신규)과 정확히 일치함을 확인 — 범위 밖 파일 없음.

### ① 의도 충족
- `checkReplyKoNaturalness`(`DOUBLE_HONORIFIC_KO_RE = /드려\s*(드리|드릴|드린|드립|드렸)/`)가 픽스처 bad 5/5 검출·good 8/8 무검출(직접 재실행 확인). 정상 "드리" 단독 사용("말씀드립니다"·"드려요")은 패턴에 "드려"+공백*+"드리"류 연쇄가 없어 오탐 구조적으로 불가능 — 정규식 구조 자체가 안전하다.
- `explanationKo` 레벨 분기(`SIMPLE_EXPLANATION_LEVELS = {N5, N4}`)가 `prisma/schema.prisma` `enum JlptLevel`(N5~N1)과 정확히 일치. `TalkInput.learner.level`→`LearnerHeader.level`은 필수 `string` 필드(옵셔널 아님)라 호출부(`orchestrator/index.ts:417` `o.learner.level`)에서 항상 유효 값이 들어간다 — 기본값 `'N5'` 폴백은 시그니처 호환용일 뿐 실사용 경로에서 트리거되지 않는다.

### ② LLM 계약·재시도가 5초/12s 예산을 깨지는지
- `buildTalkRequest` 자체는 `softExtraCheck` 를 지정하지 않지만, 실제 운영 경로(`orchestrator/index.ts:432` `turnDeps.completeJson({ ...req, softExtraCheck: true, ... })`)가 TALK 요청에 항상 `softExtraCheck: true` 를 강제한다 — PE 문서는 이 오케스트레이터 오버라이드를 명시하지 않았으나, 결과적으로 `checkReplyKoNaturalness` 오탐이 나더라도 `runJsonSoft`(schemaValidate.ts)는 **던지지 않고** 남은 위반을 `residualViolations` 로 돌려줄 뿐이다(서버가 조용히 수용). 다만 이 경로도 1차 위반 시 2차 LLM 호출을 실제로 한 번 더 보낸다 — 오탐이 나면 지연은 생긴다. 이 지연은 `engine/llm/index.ts` 의 요청 전체 데드라인(12s, 남은 시간 1.5s 미만이면 `LlmTimeoutError`)이 상한을 쥐고 있어 **12s 를 넘기지 않는다**(기존 안전장치, 이 task 가 새로 깬 것 없음). 정규식이 좁고 테스트 8/8·실측 0/3 이라 오탐 자체의 실발생 빈도는 낮아 보이지만, 이 오케스트레이터 레벨의 "오탐 1건마다 LLM 1회 추가 호출" 인과관계는 PE 기록에 없던 사실이라 QA 가 운영 표본에서 `attempts=2` 비율을 참고하도록 아래 Low-1 로 남긴다.

### ③ A1 ≤3,000자 예산 실측 재확인
- `task028.test.ts` 의 "예산: talk@v6..." 테스트(레벨 N5/N1 × capsceneCap 1~4 × correctionMode 2 × text 1/1,000 × altText 60/201/5,000 × heavy 헤더 × 20개 긴 이력)를 직접 재실행 — pass. 기존 `prompts.test.ts` "TALK: 예산 — [교정] 헤더가..." 회귀도 pass. PE 가 보고한 "최악 마진 52자·2,948자"는 전용 스크립트(커밋되지 않은 scratch)로만 확인했다는 점은 재현 불가능하지만, 커밋된 두 회귀 테스트가 `≤3,000자` 불변식을 실제로 고정하고 있어 수치 자체를 재현하지 못해도 완화 조건은 충족.

### ④ `--system-prompt` 안정성(예열 캐시)
- `git diff bcf0df2 -- src/modules/conversation/persona src/modules/engine` 결과 **0 변경** — persona 생성 경로(`loadPersona`)·엔진 모듈 전부 무변경. `level` 은 이미 기존 persona 키 `(model, level, mode)` 의 구성원이었고(`persona/loader.ts:131,149`), 이번 변경은 그 값을 `talkInstruction`(stdin `[지시]` 줄)에도 추가로 흘려보내는 것뿐 — persona 바이트·CLI 예열 재사용에 영향 없음. PE 주장과 일치.

### ⑤ CHAT(A2) 무영향
- `prompts/chat.ts` 는 이 diff에 포함되지 않았고(`git diff` 확인), 자체 `extraCheck: (data) => checkChatResponse(input.text, data)`(checkReplyKoNaturalness 미합성)과 번역 지시문도 구버전 그대로("replyKo 는 한국어 번역", 존댓말·이중 높임 지시 없음) — 완전히 격리. 신규 테스트("원문 무수정·CHAT 비범위")도 `checkTalkResponse` 단독 호출로 이중 높임 미검출을 고정. **단, CHAT 자체도 같은 이중 높임 비문 가능성을 이론상 안고 있는데 이 task 는 손대지 않는다** — Leader 결정으로 명시된 비범위이므로 결함이 아니라 참고 사항(Low-2).

### ⑥ 엔진명 누출·6층 경계
- `grep -niE "reazon|whisper|style-bert|claude"` 매치 2건 전부 기존/신규 **코드 주석**(`talk.ts:273` 기존 주석, `tests/live/task028-translation-measure.ts:2` 신규 주석)이며 라우트·화면·UI 분기 문자열이 아니다 — 금기(사용자 화면·라우트 노출)에 해당하지 않음. import 그래프는 `engine`(타입만)·`persona/loader`·`structuredResponse/*`·`window`·`header` — 전부 L2 내부 또는 L2→engine 허용 방향, 역방향·층 우회 없음. `index.ts` 추가 export 1줄은 같은 모듈 공개 함수.

### Low (권고, 비차단)
1. **오탐 1건 = LLM 1회 추가 호출(지연) 인과관계를 PE 문서가 명시하지 않음** — 운영 반영 후 QA 가 TALK 응답의 `attempts` 분포(또는 타이밍 로그)에서 `checkReplyKoNaturalness` 오탐으로 인한 재시도가 드물게라도 발생하는지 한 번 확인 권고(위 ②).
2. **CHAT(A2) 의 같은 번역 비문 가능성은 비범위로 남음** — Leader 결정이라 결함은 아니나, PE 가 "같은 문제가 보이면 보고" 하기로 한 것을 다음 QA 운영 스모크에서 CHAT 샘플도 가볍게 훑어보는 체크리스트 항목으로 남기길 권고.
3. (참고, 차단 아님) `prompts:sync`(PE 기록이 언급한 Prompt Registry `PromptVersion(SOURCE_CODE)` 동기화 커맨드)는 `package.json`·`src/` 어디에도 구현되어 있지 않다(grep 0건) — Phase 2 Console 기능이 아직 없는 것으로 보인다. 배포 전 "필요" 라고 적힌 이 단계가 실제로 존재하지 않으므로 Leader 가 배포 체크리스트에서 이 문구를 정정하거나, 실제 동기화 지점(TALK_PROMPT_VERSION bump 를 어디서 기록하는지)을 확인해야 한다.

### QA high_risk_areas
- `conversation.replyKo` 이중 높임 회귀(픽스처 5건 + 실제 TALK 대화 스모크 중 가게 응대류 발화 수 건)
- `correction.explanationKo` N5·N4 샘플 ≥10건에서 "조사·활용·접속조사" 등 문법 용어 노출률(PE 자체 보고 잔여 위험 — 표본 1건에서 1회 누출)
- (권고) TALK 응답 `attempts=2` 비율 — 새 후검증으로 인한 불필요 재시도 유무
- (권고) CHAT(A2) 번역 줄에 동일 이중 높임 패턴이 보이는지 가벼운 샘플링(비범위지만 참고)

**native_change: false.** 배포 전 필요: `prompts:sync` 관련 문구 Leader 확인(위 Low-3) 외 특별한 배포 전제조건 없음(순수 프롬프트 문자열·후검증 로직, 스키마·DB·API 계약 변경 없음).
- [2026-10-03 18:50] C2/codex_gate engine=jev → codex_required=false(예산미확인·wanted_before_budget=true) · focus=design_assumption(0.42) · budget_rule=CX-limit-unknown-hold | overrides=CX-limit-unknown-hold | fallback=- | tokens=957

## QA 기록 (2026-10-03)

**판정: PASS.** 결함 0건.

### 실행 환경
```
$ cd ~/.node-local/thekaiwa && bash scripts/sync-local.sh
$ tsc --noEmit : 0 에러
$ eslint src/modules/conversation/{prompts/talk.ts,structuredResponse/checks.ts,index.ts,__tests__/{task028.test.ts,prompts.test.ts}} : 0 경고
$ node --import tsx --test --test-concurrency=1 $(find src -name '*.test.ts' | sort) : 1220 pass / 1 skip / 0 fail
```

### 검증 결과

#### 1. 자동 테스트
- **typecheck**: 0 errors ✓
- **eslint**: 0 warnings ✓
- **단위 테스트**: 1220 pass / 1 skip / 0 fail ✓
- **pixture 검증**: `checkReplyKoNaturalness` bad 5/5 검출, good 8/8 무검출 ✓
- **예산**: talk@v6 변경 후에도 ≤3,000자 불변식 유지 ✓

#### 2. 실제 Claude CLI 표본 (8회, attempts=1, 평균 4.4초)

**번역 검증 (이중 높임 0):**
| 입력 | 응답(replyKo) | 이중높임 | attempts |
|------|-----------|---------|----------|
| `ビニール袋お願いします` | "알겠습니다. 봉투를 드리겠습니다. 포인트카드는 있으신가요?" | 0 | 1 |
| `これ、プレゼント用に包んでもらえますか` | "알겠습니다. 포장지 색은 어느 색이 좋으신가요?" | 0 | 1 |
| `荷物を預かってもらえますか` | "네, 알겠습니다. 어떤 짐인가요?" | 0 | 1 |

**explanationKo 수준 비교 (N5 vs N1):**
| 문제 | 레벨 | explanationKo | 용어 노출 |
|------|------|--------------|---------|
| e01(`行くました`) | N5 | "액션 조각 「行くました」가 「行きました」여야 해요. 「行く」의 과거형은 「行った」이고, 여기서는 「見に行く」를 과거로 만들 때 「行きました」를 씁니다." | "조각"(중립) |
| e01(`行くました`) | N1 | "액션 조각 「行くました」는 「行きました」여야 해요. 「行く」의 과거형은 「行った」인데, 「〜に行く」 구문에서 「来る」처럼 보조동사로 쓸 때는 「行く→行き+ました」로 활용합니다." | "보조동사", "활용" |
| e03(`友だちを会いました`) | N5 | "「友だちを会いました」는 조사가 틀렸어요. '만나다'는 「に会う」로 써야 하고, を는 쓰지 않습니다." | "조사"(문법 용어) |
| e03(`友だちを会いました`) | N1 | "액션 조각 「会う(あう)」는 「〜に会う」 형태로 조사 「に」를 쓰고, 「を」는 사용하지 않습니다." | "조사" |

**참고**: PE 보고대로 N5 응답(e03)에서 "조사" 문법 용어 1회 노출 — 지시문의 완전성 한계(운영 후 샘플 ≥10건에서 재확인 권고).

#### 3. Reviewer Low 위험 항목 재검증

**Low-①: checkReplyKoNaturalness 오탐 → 재시도 영향**
- 정상 존댓말 표본 무검출: `말씀드립니다`·`드려요`·`다시 말씀드릴게요` 오탐 0 ✓
- 실제 TALK 응답에서 attempts=1 유지 (재시도 0건 발생) ✓

**Low-②: CHAT(A2) 응답에 이중 높임이 나오는지**
- 범위 밖 항목(비범위, 참고용)
- 현재 CHAT는 기존 번역 규칙 유지 중 — task-028 변경 미반영
- PE 기록 "같은 문제가 보이면 보고" 참고

#### 4. 지표 검증

- **5초 예산**: TALK 턴 평균 4.4초 (기준 ≤5초) ✓
- **LLM 호출**: 8회 (기준 10~15회 이내) ✓
- **attempts 분포**: 1회 (오탐 0) ✓

### 보안·경계 확인

- 엔진명 누출: 0 (주석만) ✓
- 6층 경계: 모듈 import 그래프 정상 ✓
- 원문 무수정: CHAT 비범위 테스트 고정 ✓

### 결론

**결함 0건 · native_change: false · 지표 정상 · 배포 전제조건 충족**

운영 반영 후 다음 QA 스모크: N5 교정 설명 샘플 ≥10건에서 "조사·활용·접속조사" 등 문법 용어 노출률 재확인(Low-1 추적)

## Leader 배포 판단 (2026-10-03)
- REV-061 PASS · judge C2 Codex 불필요(CX-limit-unknown-hold) · QA PASS(결함 0) → 커밋·push(webhook 운영 배포).
- REV-061 Low ③ 정정: `prompts:sync` 단계는 이 저장소에 **없다**(PE 기록의 "배포 전 필요" 문구는 착오). 프롬프트 버전 기록은 코드 상수 `talk@v6` 가 정본이며 배포 전 별도 동기화 절차 없음.
- 운영 관찰: N5 교정 설명의 문법 용어 노출률(표본 ≥10) · CHAT(A2) 번역 이중 높임 가벼운 샘플링 — 결함 아님, 후속 관찰.
