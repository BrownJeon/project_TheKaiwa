---
tags:
  - type/task-record
  - domain/ask
  - domain/speech
aliases:
  - task-066 dev-s1
---
# task-066 S1′(서버: ASK 턴이 음성 인식 글자를 받도록) — Developer 기록

> 상위: [[task-066-ask-chatbot-voice]]. 입력: prompt-engineer [[task-066-pe-record]](`buildAskPlan({inputKind})`), 이전 구현 [[task-064-dev-s2a-record]]·[[task-064-dev-s2b-record]]. judge: feature·R1·sonnet·light. 전용 미러 `~/.node-local/thekaiwa-dev066s`(`.env` 없음, `node_modules` 는 `cp -al`, 소스·시험은 rsync).

## 수정한 파일 목록 (미커밋 · `git add` 없음)

| 구분 | 파일 | 변경 |
|---|---|---|
| 소스 | `src/modules/conversation/chats/validate.ts` | `ASK_INPUT_SOURCES`(TEXT·REALTIME_STT) · `assertAskInput`(라우트·수락 트랜잭션 공용) · `parseTurnBody(body, {deferVoiceUtterance})` · `assertTurnFitsKind` 가 TALK·CHAT 의 「REALTIME_STT 는 utteranceId 필수」를 이어받음 |
| 소스 | `src/modules/conversation/orchestrator/index.ts` | `assertAskRequest`(옛 `ASK_TEXT_ONLY`) 삭제 → `assertAskInput` 직접 호출 2곳(precheck 분기·`acceptTurnTx`) |
| 소스 | `src/modules/conversation/orchestrator/ask.ts` | `askInputKindOf` · `AskAcceptedTurn.userMessage.inputSource?` · `buildAskPlan(..., inputKind)` · Trace PROMPT 단계에 `inputKind` |
| 소스 | `src/app/api/v1/chats/_lib/turnRoute.ts` | `parseTurnBody(body, { deferVoiceUtterance: true })` + 머리 주석 |
| 시험 | `src/modules/conversation/__tests__/askApi.test.ts` | + 3건(음성 질문 통과·거절 표·TALK/CHAT 회귀), 기존 「inputSource 는 TEXT 만」 시험 제목 1줄만 수정(단언은 그대로 통과) |
| 시험 | `src/modules/conversation/__tests__/askTurn.test.ts` | `setup()` 이 저장된 사용자 행의 `inputSource` 를 요청 값/복구 값으로 돌려줌(`Setup.resume`), ⑪-a/b 제목·SERVER_STT 케이스, + ⑫-a~e 5건 |
| 시험 | `src/app/api/v1/chats/_lib/__tests__/turnRoute.test.ts` | 기존 「검증은 한도보다 먼저」 1건 조정(`REALTIME_STT` 단독은 이제 수락이라 `SERVER_STT` 로 교체) + 4건(음성 수락·거절·한도/슬롯/409·TALK/CHAT 회귀) |
| 기록 | `agent-vault/10-Flow/tasks/task-066-dev-s1-record.md` | 이 파일 |

건드리지 않음: `src/components`·`src/app/(app)`·`docs`·`prisma`·`speech`·`prompts/**`·`.claude/agents/tutor.md`.

## Developer 기록

- [착수] 읽음: 이력서·PE 기록·`orchestrator/{index,ask}.ts`·`chats/validate.ts`·`_lib/turnRoute.ts`·`[id]/turns/route.ts`(훅 조합)·`components/chat/turnBody.ts`(회화 클라이언트가 보내는 본문: `{text, inputSource, utteranceId?}`)·`schema.prisma InputSource {REALTIME_STT, SERVER_STT, TEXT}`. 전용 미러 생성.
- [발견 ① — 계획에 없던 충돌] **ASK 만 완화하면 모자란다.** `parseTurnBody` 가 종류를 모르는 채로 「`REALTIME_STT` 인데 `utteranceId` 없음 → 400 `utteranceId required`」를 이미 던진다(task006.test 가 고정). 그래서 ASK 음성 질문(발화 id 없음)은 `assertTurnFitsKind` 까지 가지도 못한다. → 본문 검사에 옵션 `deferVoiceUtterance` 를 두고 라우트만 켠다(기본값은 예전 그대로라 `parseTurnBody` 단독 시험 불변). 검사 자체는 `assertTurnFitsKind` 가 TALK·CHAT 에 대해 같은 field/reason/message 로 이어받는다. **동작 차이 1건(의도한 부수 효과)**: 회화·채팅에서 `REALTIME_STT` + `utteranceId` 없음이 *남의 방*으로 가면 예전 400 → 지금 404(소유 확인이 종류별 검사보다 앞이라). 내 방이면 400 그대로.
- [발견 ② 끊김 복구] `acceptTurnTx` 의 resume 경로는 저장된 사용자 행(`USER_MESSAGE_SELECT` 에 `inputSource` 포함)을 돌려주므로, `inputKind` 를 **요청이 아니라 저장된 사용자 행**에서 읽어야 복구 때도 처음 질문의 입력 방식을 따른다 → `a.userMessage.inputSource` 사용.
- [오류 사유 이름] 옛 `ASK_TEXT_ONLY`(orchestrator 방어선)는 음성이 열리면 거짓이 돼 삭제하고, 라우트 검사와 **같은 함수**(`assertAskInput`)로 통일했다. grep 결과 `ASK_TEXT_ONLY` 를 문자열로 쓰는 곳은 클라이언트·시험·문서 어디에도 없음(소스 1곳과 기록 파일뿐) → 클라이언트 영향 없음.
- [체크포인트 1 · 턴 ~35] 구현 4파일 + 시험 3파일 작성 완료. 대상 시험 3파일 61건 통과, tsc 0, 변경 7파일 eslint 0. (함정: 새 미러에는 `.claude/agents/tutor.md` 가 있어야 한다 — 없으면 `PersonaUnavailableError` 로 ASK 시험 14건이 `error` 이벤트로 끝난다. 소스 결함이 아님.) 남은 일: ① `src/modules/conversation`·`src/app/api/v1/chats` 전체 시험 ② 변이 5종+α ③ 기록 마감. 다음 첫 행동: 전체 시험 실행.
- [체크포인트 2 · 턴 ~45] 전체 시험(`src/modules/conversation` + `src/app/api/v1/chats`, `--test-concurrency=1`) **1,185건 중 1,185 통과**, 변이 12종(M1~M12, 아래 표) 전부 실패로 잡힘, 미러 소스는 NFS 와 `diff -rq` 동일(원복 확인). 남은 일: 기록 마감(표·게이트·남은 위험), 필요하면 `src` 전체 시험.

## 허용·거절 규칙 (ASK 턴, `POST /api/v1/chats/:id/turns`)

| 요청 | 결과 | 비고 |
|---|---|---|
| `inputSource` 생략 · 발화 id 없음 | 수락(`TEXT`) | 글자 질문, 불변 |
| `inputSource: TEXT` | 수락 | 불변 |
| `inputSource: REALTIME_STT` · 발화 id **없음** | **수락(새)** — 사용자 행 `inputSource=REALTIME_STT`, `utteranceId` 칸 없음, 프롬프트 `inputKind=VOICE` | 회화의 실시간 STT 결과 글자. `clientTimings.sttMs` 등은 글자 질문처럼 받기만 한다 |
| `utteranceId` 가 오면 (어떤 `inputSource` 든) | 400 `VALIDATION` `{field:'utteranceId', reason:'notAllowed'}` | 원음·발화 행을 질문에 잇지 않는다(목소리 서버 미저장). `inputSource:TEXT`+발화 id 는 본문 검사 단계에서 400 `{field:'inputSource'}` |
| `inputSource: SERVER_STT` | 400 `{field:'inputSource', reason:'TEXT|REALTIME_STT'}` | |
| 그 밖 값(`VOICE` 등) | 400 `{field:'inputSource', reason:'REALTIME_STT|SERVER_STT|TEXT'}` | 본문 검사(기존) |
| `resumePending: true` | 검사 없음 | 저장된 사용자 행의 `inputSource` 를 따라 `inputKind` 결정 |
| 한도·슬롯·409 | 글자 질문과 같음(분당 3·하루 60·`ASK_BUSY`·수락 전 실패는 몫 환불) | 음성 질문도 같은 몫을 쓴다 |

TALK·CHAT: `REALTIME_STT` 는 발화 id 필수(같은 400 `{field:'utteranceId', reason:'required'}`) — 본문 검사가 미룬 것을 `assertTurnFitsKind` 가 이어받는다. 달라진 점은 **남의 방**에 보낸 이 잘못된 요청이 400 → 404 가 된 것 하나.

## 변이 확인 (전용 미러의 소스 사본에만 적용 → 시험 → 원복, 끝나고 `diff -rq src tests` NFS 와 동일 확인)

대상 시험: askApi·askTurn·turnRoute·task006·task007 (스크립트 `mutate.py`, 변이 1건당 약 5초). 

| # | 변이 | 실패한 시험(요약) | 건수 |
|---|---|---|---|
| M1 | 허용 목록에서 `REALTIME_STT` 제거 | 음성 질문 수락(route)·한도(route)·거절(route)·validate 통과/거절·⑫-a/b/d/e | 9 |
| M2 | `utteranceId` 거절 제거 | 「검증은 한도보다 먼저」·음성 거절(route)·#32 ASK 표·validate 거절·⑪-a·⑪-b·⑫-d·⑫-e | 8 |
| M3 | 허용 밖 값(`SERVER_STT`) 통과 | 「검증은 한도보다 먼저」·음성 거절(route)·#32 ASK 표·validate 거절·⑪-a·⑫-d·⑫-e | 7 |
| M4 | `inputKind` 항상 `TEXT` | ⑫-a·⑫-b·⑫-c | 3 |
| M5 | `inputKind` 항상 `VOICE` | ⑫-a(글자 질문에 표지 없음)·⑫-c | 2 |
| M6 | `buildAskPlan` 에 `inputKind` 미전달 | ⑫-a·⑫-c | 2 |
| M7 | 라우트가 `deferVoiceUtterance` 안 켬 | 음성 수락·거절·한도(route)·TALK/CHAT 회귀(route) | 4 |
| M8 | TALK·CHAT 「음성 턴은 발화 id 필수」 이어받기 제거 | TALK/CHAT 회귀(route)·validate 회귀 | 2 |
| M9a | 수락 트랜잭션의 ASK 방어선 제거 | ⑪-b·⑫-e | 2 |
| M9b | `startTurn` precheck 의 ASK 방어선 제거 | ⑪-a·⑫-d | 2 |
| M10 | 수락 트랜잭션이 `inputSource` 를 `TEXT` 로 덮어씀 | ⑫-e | 1 |
| M11 | 음성 질문은 ASK 한도 건너뜀 | 음성 수락(슬롯)·음성 한도/슬롯/409 | 2 |
| M12 | `inputKind` 가 저장된 사용자 행을 무시 | ⑫-a·⑫-b·⑫-c | 3 |

요구한 5종(허용 목록에서 STT 제거 / `utteranceId` 거절 제거 / 허용 밖 값 통과 / `inputKind` 항상 TEXT / 항상 VOICE)은 M1~M5, 나머지 7종은 추가분. **전부 실패로 잡힘**(생존 변이 0).

## 게이트 (전용 미러 `~/.node-local/thekaiwa-dev066s`, `DATABASE_URL=mysql://invalid…:1/invalid`, 실제 `claude` 실행 0회, DB 접촉 0)

- `tsc --noEmit --incremental false` exit **0**
- `eslint`(변경 7파일: validate·orchestrator/{index,ask}·turnRoute + 시험 3) exit **0**
- `node --import tsx --test --test-concurrency=1 $(find src/modules/conversation src/app/api/v1/chats -name '*.test.ts')` **1,185건 중 1,185 통과** (51초)
- 참고: `src` 전체(`find src scripts/seed-build`) 3,820건 — 3,817 통과·2 skip·1 파일 실패(`speech/__tests__/modelPackage.test.ts` — 미러에 `plugins/sherpa-stt/test-fixtures` 를 안 넣어 `ENOENT`, 픽스처를 넣고 다시 돌리면 6 통과·1 skip. 이번 변경과 무관)

## 남은 위험 · 인계

1. **계약 문서 갱신은 Leader**: `docs/design/api-contract.md` §2-18-A 의 #32 ASK 규칙(「`inputSource` 는 `TEXT` 만」·「음성 입력·`utteranceId` 400」)이 이제 거짓이다 → 위 「허용·거절 규칙」 표로 additive 갱신. 오류 사유 `ASK_TEXT_ONLY`(문서·클라이언트 어디에도 없음)는 사라졌다.
2. **화면 developer 에게**: 마이크 질문 전송 본문은 `{ text: <인식된 일본어 글>, inputSource: 'REALTIME_STT' }` — **`utteranceId` 를 절대 보내지 말 것**(400). 회화의 `buildTurnBody(text, { inputSource: 'REALTIME_STT', utteranceId })` 를 그대로 쓰면 안 된다(질문은 `utteranceId` 없이). 회화처럼 `/api/v1/utterances`(발화 생성·원음 업로드) 호출도 하지 않는다 — 원음은 서버에 남기지 않는 설계. `clientTimings.sttMs` 는 보내도 되지만 ASK Trace 에는 쓰이지 않는다. 대화 조회(#29)의 사용자 메시지 `inputSource` 는 `REALTIME_STT` 로 내려온다(마이크 표지가 필요하면 그 값으로). 서버는 글을 1,000자로 자르지 않고 400 으로 거절(기존 `TURN_TEXT_MAX`).
3. **실제 인식 결과로 잰 적 없음**(PE 기록 ⒜): `inputKind:'VOICE'` 표지의 효과는 모의 입력 기준 — QA 가 실기기·gateway 로 10~20건 확인 필요.
4. **남의 방 400→404 변화**(TALK·CHAT, 잘못된 음성 요청 한정): 안전한 방향이지만 「동작 불변」의 엄밀한 예외라 Reviewer 가 알 수 있게 적어 둔다.
5. 인식 글이 AI 로 나가는 범위: 글자 질문과 같다(D2=(b), 원음은 안 나감). 음성 질문 전용 한도/모델 선택 없음(`ask@v2` 도 같은 model tier).

## 실행 증빙 (light 트랙)

- 명령: 위 「게이트」 4줄 · 변이 `mutate.py` (M1~M12) — 결과 위와 같음.
- 체크포인트 3(마감): 완료. 미커밋 파일(내 몫): `src/modules/conversation/{chats/validate.ts,orchestrator/index.ts,orchestrator/ask.ts,__tests__/askApi.test.ts,__tests__/askTurn.test.ts}`, `src/app/api/v1/chats/_lib/{turnRoute.ts,__tests__/turnRoute.test.ts}`, 이 기록 파일.
