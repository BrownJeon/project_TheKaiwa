---
task: task-064
role: developer (dev-S2b — ASK 라우트·검증·한도·DTO)
tags:
  - type/task-record
  - domain/conversation
---
# task-064 dev-S2b 기록 — ASK 라우트·검증·한도·DTO

부모 이력서: [[task-064-ask-anything-3a]] · 파트너: [[task-064-dev-s2a-record]](orchestrator ASK 파이프라인)

## 파일 표 (S2b)

| 파일 | 변경 |
|---|---|
| `src/modules/conversation/chats/validate.ts` | #28 ASK 허용(`kind`·`title` 밖 키 400, null 이어도) · #32 `scope?:{key}` 파싱 · `assertTurnFitsKind`(ASK 글자만·`scope` ASK 한정) · `featureNotReady` 삭제 |
| `src/modules/conversation/chats/askLimits.ts`(신규) | 분당 3·하루 60·전역 진행1+대기2(`ASK_BUSY`), 엿보기 후 소비, `release`/`refund`, 슬롯 180초 만료 |
| `src/modules/conversation/chats/askView.ts`(신규) | #29 `messageAskField` — ASK ASSISTANT 만 `ask`(S2a `askMetaFromToolLog` 사용), 진행 중·실패 null |
| `src/modules/conversation/chats/index.ts` | `defaultChatTitle`(ASK=「새 질문」, S2a 상수) · `getOwnedChatKind` · `MessageDto.ask` · `serializeMessage(kind)` |
| `src/modules/conversation/index.ts` | 공개 export 추가(`assertTurnFitsKind`·`admitAskTurn`·`askInflightCount`·한도 상수·`AskAdmission`·`getOwnedChatKind`) — **공유 파일** |
| `src/app/api/v1/chats/_lib/turnRoute.ts`(신규) | #32 본문: 본문 400 → 종류 404 → 종류별 400 → ASK 한도 429 → startTurn → SSE. ASK 는 훅 0, `turn.done` 에서 슬롯 해제, 수락 전 실패 refund |
| `src/app/api/v1/chats/[id]/turns/route.ts` | 훅 조합(`talkChatHooks`)+deps 만 남김 — TALK·CHAT 동작 불변 |
| `src/app/api/v1/chats/route.ts` | 주석만(ASK 열림) |
| 시험 | 신규 `conversation/__tests__/askApi.test.ts`·`chats/_lib/__tests__/turnRoute.test.ts`, 수정 `task006.test.ts`·`task010d.test.ts`(ASK=FEATURE_NOT_READY 단언 → 열림/VALIDATION) |

## S2a 접점
- `startTurn`/`TurnHandle` 그대로 — ASK 도 같은 SSE 라우트. ASK 에는 훅을 넘기지 않는다(S2a 요청: gate 포함).
- `TurnRequest.scope = {key}`(S2a 가 `request.scope?.key` 로 읽음). 직전 되묻기 여부 판정·결합은 S2a.
- #29 `ask` = S2a `askMetaFromToolLog` 결과 그대로(모양 검사 한 곳). 기본 제목 상수도 S2a 것 하나.
- 이중 방어: ASK 비글자 요청은 라우트(`assertTurnFitsKind`, field `utteranceId`/`inputSource`)와 orchestrator(`assertAskRequest`, field `inputSource`) 둘 다 400 — 라우트가 먼저라 실제 응답은 라우트 쪽 필드.

## Developer 기록
- [17:50] 착수. 계약 §2-18-A·#27~#32, 이력서 Codex C1·Leader 판정, 기존 라우트(`chats/route.ts`·`[id]/route.ts`·`[id]/turns/route.ts`·`_lib/chatDetail.ts`)·`chats/{validate,index}.ts`·`infra/{http,sse}.ts`·`orchestrator/{index,locks}.ts`·`types/ask.ts`·화면 `useChatTurn`/`ask/logic.ts`(하루 한도 = `retryAfterSec>3600` 로 가름, `ASK_BUSY` reason) 읽음. S2a 기록 아직 없음 → 검증·한도·DTO 먼저.
- [18:05] 시험 먼저 작성: `src/modules/conversation/__tests__/askApi.test.ts`(#28·#32 검증·한도·#29 ask) · `src/app/api/v1/chats/_lib/__tests__/turnRoute.test.ts`(라우트 본문 ASK 분기·슬롯 해제·끊김·TALK/CHAT 회귀·정적 signal 검사). 설계 결정:
  - 라우트가 `getOwnedChat` 으로 **종류를 먼저 읽는다**(본문 400 → 종류 404 → 종류별 검사 400 → ASK 한도 429 → startTurn). TALK 경로에 PK 읽기 1회 추가(커밋 아님, LAN 수 ms) — resume 경로도 종류를 알아야 ASK 한도를 걸 수 있어서(orchestrator 의 precheck 는 resume 에서 안 돈다).
  - 한도 `chats/askLimits.ts`: 하루 → 분 → 전역 순서로 **엿보기**, 모두 통과해야 소비(거절은 몫을 안 깎음). 하루 한도 `retryAfterSec = max(남은 초, 3601)`(화면 L-11 이 3600 초과로 하루를 가름 — 창 끝 무렵 최대 1시간 과잉 잠금, 설계-코드 차이). 전역 슬롯은 `ASK_SLOT_MAX_MS`(180초 = STALE_PENDING) 뒤 자동 만료(해제 누락 안전망). 수락 전 실패는 `refund`.
  - 라우트 본문은 `_lib/turnRoute.ts`(deps 주입, chatDetail 방식).
- [18:25] **체크포인트 1 — 검증·한도·DTO·라우트 본문 구현, 대상 시험 45/45 통과**(askApi·turnRoute·task006·task010d·chatDetail).
  - 완료: `chats/validate.ts`(ASK 생성 키 `kind`·`title` 만 — 그 밖 키 null 이어도 400 / `scope` 파싱(`{key}`, 생략이면 칸 없음) / `assertTurnFitsKind`(ASK = `utteranceId` 400·`inputSource≠TEXT` 400, TALK·CHAT 에 `scope` 400, resume 은 검사 안 함) / 안 쓰게 된 `featureNotReady` 삭제) · `chats/askLimits.ts`(신규) · `chats/askView.ts`(신규, `toolLog.ask` 허용 필드만 재검증해 `ask`) · `chats/index.ts`(`defaultChatTitle` export, ASK = 「새 질문」, #29 ASSISTANT 에 `messageAskField`) · `_lib/turnRoute.ts`(신규) · `[id]/turns/route.ts`(훅 조합만 남김) · `chats/route.ts`(주석) · `conversation/index.ts`(공용 export 3줄 — **공유 파일, Leader 알림 대상**) · 옛 시험 2곳(task006·task010d 의 ASK=FEATURE_NOT_READY 단언 → 열림/VALIDATION).
  - 남은 일: S2a 인터페이스 확인 → ASK 훅이 필요하면 `TurnRouteDeps` 에 추가 / tsc·eslint·전체 시험·build / 변이 ≥8 / 최종 기록.
  - 미커밋 파일: 위 전부 + 시험 2개(`askApi.test.ts`·`turnRoute.test.ts`).
- [18:40] **S2a 인터페이스 반영**(그쪽 기록 「인터페이스」 절): ① `TurnRequest.scope` 를 **`{ key }` 객체**로(S2a 가 `request.scope?.key` 로 읽음 — 처음엔 문자열로 만들어 칩이 조용히 무시될 뻔함) ② #29 `ask` 는 S2a 의 `orchestrator/ask.ts` `askMetaFromToolLog`(직전 되묻기 판정과 같은 모양 검사 한 곳)를 쓰고, 내 `askView.ts` 는 종류·역할·상태 게이트(`messageAskField`)만 남김 ③ 기본 제목 상수는 S2a 의 `ASK_DEFAULT_TITLE` 하나만(내 validate.ts 사본 삭제 — 값이 둘이면 첫 답 때 제목 바꾸기 조건이 어긋날 수 있다) ④ ASK 에 훅 0(gate 포함) — S2a 요청과 일치. 대상 시험 43/43, **tsc 0 오류**, **eslint exit 0(경고 5 — 내 파일 아님)**.
- [18:50] 라우트의 종류 조회를 가벼운 `getOwnedChatKind`(select kind 1회 — `getOwnedChat` 은 topic 관계까지 읽어 왕복이 늘 수 있음)로 바꿈 + #27 목록 행 모양 시험 추가. tsc 0. 변이 시험(미러에서 원본 복구 방식) 진행 중.
- [19:05] **변이 15/15 잡힘**(미러에서 한 건씩 바꾸고 askApi+turnRoute 실행 후 원복, 원복 cmp 확인): M1 ASK 생성 여분 키 허용 · M2 ASK utteranceId 검사 삭제 · M3 TALK scope 허용 · M4 분당 한도 off-by-one · M5 하루 retryAfter 하한 제거 · M6 전역 검사를 소비 뒤로(BUSY 가 몫 소비) · M7 release 가 슬롯 안 지움 · M8 refund 가 몫 안 되돌림 · M9 수락 전 실패 refund 없음 · M10 슬롯을 startTurn 직후 해제(끊김·진행 중 미반영) · M11 ASK 에 TALK 훅 전달 · M12 ask 칸을 USER 에도 · M13 ASK 기본 제목 누락 · M14 슬롯 만료 안전망 제거 · M15 한도를 종류 검사 전에. 처음엔 라우트 시험이 실패할 때 끝나지 않은 가짜 턴의 SSE 핑 타이머 때문에 **멈춤(시간 초과)으로** 보였다 → `afterEach` 가 만든 턴을 모두 끝내도록 고침(실패가 실패로 바로 보인다). 함정: `pgrep -f mut.py` 대기 루프는 자기 명령줄에 걸려 끝나지 않는다.
- [19:15] 전체 단위 시험(미러, `src/modules`+`src/app`) **2,276 중 2,275 통과·0 실패·1 skip**(기존 skip), tsc **0**, eslint **exit 0**(경고 5 — 기존 화면 파일 `react-hooks/set-state-in-effect`, 내 파일 아님). `next build` 진행 중. ASK 생성 거절 키 이름은 `details.field` 에 40자까지만 싣게(사용자 키 그대로 되돌려 주지 않게).

### 설계-코드 차이
1. **하루 한도 `retryAfterSec`**: 고정 24시간 창의 남은 시간이 1시간보다 짧아도 3601초를 준다(화면 L-11 이 `>3600` 으로 하루 한도를 가르므로). 결과: 창 끝 무렵엔 화면이 최대 1시간 더 잠근다(서버는 창이 지나면 받는다). 정확히 하려면 서버가 `details.reason:"DAILY_LIMIT"` 를 주고 화면이 그걸로 가르는 쪽(screens L-8·L-11 후속 권고와 같음) — 계약 밖이라 넣지 않음.
2. **ASK 한도는 "엿보고 통과하면 소비"**: 분·하루·전역 중 하나라도 거절되면 몫을 깎지 않고, 수락 전 실패(409 턴 진행 중·404·orchestrator 400)는 `refund`. 계약은 "초과 429" 만 정하므로 더 관대한 쪽(학습자가 거절로 몫을 잃지 않음). 단 기존 `turn:` 분당 12 는 그대로 모든 시도를 센다.
3. **전역 슬롯 = 프로세스 안 ASK 턴 수(수락 전 확인 ~ `handle.done`)**: 실제 LLM 대기열이 아니라 근사. 해제 누락 안전망으로 180초 뒤 저절로 세지 않는다(S2a 의 ASK 서버 예산 170초 < 180초).
4. **`ASK_BUSY` `retryAfterSec` = 30 고정**(질문 1건 평균 근처 추정 — 실측 후 조정 후보).
5. **라우트가 종류를 먼저 읽는다(`getOwnedChatKind`)**: TALK·CHAT 턴에도 PK 읽기 1회 추가(관계 없음, 커밋 아님). 이전엔 404 가 startTurn 안에서 났고 지금은 라우트에서 — 응답(404 `채팅을 찾을 수 없어요.`)은 같다.

### 남은 의문(Leader)
- **ASK 방에 다른 대화 기능 라우트**(#33 점검 `review`·`phrase-help`·`reply-practice`·`scenario/finish`·#32t 번역)는 손대지 않았다 — ASK 방으로 부르면 각 라우트의 기존 동작(대부분 종류 검사 없음)대로다. 화면은 ASK 방에서 이 메뉴를 내지 않지만 서버 차단이 필요한지 결정 필요.
- **`conversation/index.ts` 공유 파일**에 export 를 더했다(S1 의 `askRouter` 줄과 같은 파일) — 커밋 때 hunk 단위로 가를 것.
- 하루 한도 `DAILY_LIMIT` reason 추가 여부(위 차이 1).
- [19:25] **완료(DONE)**. `next build` **exit 0**(`/api/v1/chats/[id]/turns` 포함, 경고는 기존 Turbopack 추적 경고), 마지막 수정(거절 키 40자) 후 대상 시험 44/44·tsc 0·eslint 0 재확인.
  - 실행 증빙: 미러 `~/.node-local/thekaiwa-dev064s2b` — `node --import tsx --test --test-concurrency=1 $(find src/modules src/app -name '*.test.ts' | sort)` → 2,276 tests / pass 2,275 / fail 0 / skip 1 · `tsc --noEmit` 0 · `eslint src` exit 0(경고 5, 기존) · `next build` exit 0 · 변이 15/15.
  - 미커밋 파일: `src/modules/conversation/chats/{validate.ts,index.ts,askLimits.ts,askView.ts}` · `src/modules/conversation/index.ts`(공유 hunk) · `src/app/api/v1/chats/{route.ts,[id]/turns/route.ts,_lib/turnRoute.ts}` · 시험 `src/modules/conversation/__tests__/{askApi,task006,task010d}.test.ts` · `src/app/api/v1/chats/_lib/__tests__/turnRoute.test.ts`.
  - 다음 첫 행동(Reviewer): `_lib/turnRoute.ts` 순서(본문 400 → 종류 404 → 종류별 400 → ASK 429 → startTurn)와 `askLimits.ts` 엿보기/소비/refund, S2a `orchestrator/ask.ts` 의 `askMetaFromToolLog` 를 #29 가 쓰는지 대조. 미러는 리뷰 뒤 지워도 된다.
