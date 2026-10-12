---
tags:
  - type/task-record
  - domain/ask
aliases:
  - task-064 dev-fx
---
# task-064 통합 보정(dev-fx) — Developer 기록

> 상위: [[task-064-ask-anything-3a]]. 범위: 429 `reason` 명시 · ASK 방 다른 종류 라우트 차단 · 화면 보정(`noneLine`, `AskSource.id` 정합). 정본 `docs/design/api-contract.md` §2-18-A 3항·3-A항.
> 전용 미러 `~/.node-local/thekaiwa-dev064fx`(predeploy `node_modules` `cp -al` + `KAIWA_LOCAL_ROOT=… bash scripts/sync-local.sh`).

## Developer 기록

- [18:15] 착수. 기준선: 저장소 전체 `tsc --noEmit` exit 0(보정 전).
- [18:25] 시험 먼저 작성(빨강 확인 10건): `askApi.test.ts`(reason `ASK_RATE`/`ASK_DAILY` 단언·겹침 순서), `components/ask/__tests__/logic.test.ts`(⑨-b reason 우선·폴백, ⑦-b `noneLine`+`needsScope`, `AskSource.id:null` 정합), 신규 `askRouteGuard.test.ts`(ASK 방 다섯 라우트 차단).
- [18:40] 구현(1~3묶음): `chats/askLimits.ts`(`AskLimitReason`, 분당 `ASK_RATE`·하루 `ASK_DAILY`, `details.reason` — `ASK_BUSY` 와 같은 자리 · 하루 `retryAfterSec` 기존 값) · `components/ask/logic.ts`(`askNoticeText` reason 우선 + `retryAfterSec>3600` 폴백, `askAnswerView.noneLine` 에 `!needsScope`) · `chats/validate.ts`(`assertNotAskRoom` 공용 가드) · `chats/translation.ts`(소유 확인 뒤 가드, 같은 조회에 `chat.select.kind` join — 추가 쿼리 0, `where` 불변) · `chat/useChatTurn.ts`(주석 1줄만 — reason 은 이미 전달됨). 집중 시험 64/64 통과.
- 확인한 사실: 표현 점검 `400`(`kind≠CHAT`, claimReview 안) · 상황 마치기 `400`(`not_scenario`) · 일본어 도우미/대답 연습 `404`(`kind≠TALK` — 기존 계약 "존재를 숨김", 3-A항 "그대로") — 이 넷은 이미 닫혀 있어 코드 불변, **열려 있던 것은 내 말 번역(#32t)뿐**이라 거기만 수정.
- 확인한 사실: `src/types/ask.ts` `AskSource.id` 는 이미 `string | null`, 서버 `AskSourceDto.id` 도 `string | null`(orchestrator/ask.ts) — 타입 정합, 수정 없음. 시험으로 `askMetaOf` 가 `id:null` 을 보존하고 `askSourceHref` 가 기본 화면(`/plan`·`/study/today`)으로 보내는 것만 잠갔다.
- [18:55] 변이 확인 13건 전부 잡힘(미러 사본에만 적용 후 재동기화): 분당/하루 reason 뒤바꿈·누락(2) · 화면 `ASK_DAILY` 무시·`ASK_RATE` 보호 제거(2) · `noneLine` 의 `!needsScope` 제거(1) · 번역 가드 제거·가드 반전·select join 제거·가드를 캐시 응답 뒤로 이동(4) · 이미 닫혀 있던 4곳(도우미 `kind≠TALK`·표현 점검 `kind≠CHAT`·대답 연습 `kind≠TALK`·상황 마치기 `kind≠TALK`) 제거(4). 처음엔 대답 연습·상황 마치기 변이가 `scenarioId:null` 에 가려 살아남아(fail=0) ASK 시험 행에 `scenarioId:'scn_stray'` 를 붙여 종류 검사가 단독으로 서게 고쳤다.
- [19:05] **실행 증빙**(전용 미러 `~/.node-local/thekaiwa-dev064fx`, NFS 원본 `sync-local.sh` 직후, **저장소 전체**):
  - `./node_modules/.bin/tsc --noEmit` → exit 0
  - `./node_modules/.bin/eslint src` → exit 0 (경고 5건은 이번 변경 밖 — `admin/trace/DiagnosticsScreen`·`settings/{LearningSettings,OnDeviceDiagnosticsCard,SpeechSettings,VoiceSettings}` 의 `react-hooks/set-state-in-effect`)
  - `DATABASE_URL=가짜 node --import tsx --test --test-concurrency=1 $(find src -name '*.test.ts' | sort)` → **3,668건 중 3,667 통과 · 실패 0 · 건너뜀 1**(건너뜀 = `#9 실제 배포 manifest` — 미러에 `speech/models` 가 없어 저장소에서만 도는 시험, 기존 동작)
  - `./node_modules/.bin/next build > log 2>&1` → exit 0 (Turbopack 경고 3건은 기존 — `persona/loader.ts` readFileSync·statSync, `claudeCli.ts:867` spawn 의 "Dynamic filesystem access" 추적 경고, 이번 변경 밖)
  - 보정 전 기준선: 저장소 전체 `tsc --noEmit` exit 0.
- 변경 파일(NFS 원본 기준, 미커밋):
  - 서버: `src/modules/conversation/chats/askLimits.ts`(reason) · `src/modules/conversation/chats/validate.ts`(`assertNotAskRoom`) · `src/modules/conversation/chats/translation.ts`(가드 + 같은 조회 join)
  - 화면: `src/components/ask/logic.ts`(`askNoticeText`·`askAnswerView`) · `src/components/chat/useChatTurn.ts`(주석 1줄) · `src/app/api/v1/chats/[id]/messages/[messageId]/translation/route.ts`(머리 주석 1줄)
  - 시험: `src/modules/conversation/__tests__/askApi.test.ts`(수정) · `src/components/ask/__tests__/logic.test.ts`(수정) · `src/modules/conversation/__tests__/askRouteGuard.test.ts`(신규, 9건)
- 결정·근거:
  1. `reason` 은 `ApiError.details.reason`(= 응답 `data.details.reason`) — 기존 `ASK_BUSY` 와 같은 자리라 `useChatTurn` 은 이미 `detailString(err,'reason')` 로 문자열 아무거나 `TurnNoticeState.reason` 에 싣는다(코드 변경 불필요).
  2. 화면 `reason` 우선: `ASK_BUSY`→몰림, `ASK_DAILY`→오늘, `ASK_RATE`→초/분(추정 건너뜀), 그 밖·없음→기존 `retryAfterSec>3600` 추정. 새 문구 없음(기존 `rate`·`rateMin`·`rateDay`·`askBusy*` 재사용), 남은 횟수·한도 숫자는 어느 갈래에도 없음(시험이 `/남은|회|번 더|하루 60|분당 3/` 부정 단언).
  3. 3-A항 "이미 TALK/CHAT 이 아니면 거절하는 라우트는 그대로" 를 따라 **일본어 도우미(#180)·대답 연습(#169)은 ASK 방에서 기존 `404`**(존재를 숨김, 계약 #180·#169 가 이미 "회화 아닌 대화 404")를 유지했다 — Leader 지시문의 "ASK → 400" 과 코드가 다른 곳이 이 둘이다. 400 으로 통일하려면 두 서비스에 `assertNotAskRoom` 한 줄씩 추가하면 되나 #180·#169 계약(404)과 시험 문구가 바뀌므로 Leader 결정 사항.
  4. 번역(#32t)은 가드를 **소유 확인 뒤·`USER` 역할 검사/캐시 응답/LLM 앞**에 둔다(남의 방은 404 그대로, ASK 방은 번역이 이미 있어도 400). 종류는 같은 `findFirst` 에 `chat:{select:{kind:true}}` 를 더해 읽는다 — 추가 쿼리 0, `where`(id·chatId·userId) 불변(기존 시험이 단언).
- 남은 의문 / Leader 에게:
  - `docs/screens.md` §25-5 G(약 11006행 "429 두 갈래는 `notice.reason === 'ASK_BUSY'` 로 가른다")와 §25-3 `useChatTurn` 행(약 10721행 "`ASK_BUSY` 구분")은 이제 **세 갈래**(`ASK_RATE`·`ASK_DAILY`·`ASK_BUSY`, 없으면 `>3600` 추정)다 — docs 는 내 범위 밖이라 고치지 않았다.
  - 위 결정 3(도우미·대답 연습 404 유지) 승인 여부.
  - `retryAfterSec` 가 아닌 `reason` 으로 갈리므로 QA 는 분당/하루/몰림 세 응답의 `data.details.reason` 을 `curl` 로 직접 볼 수 있다.
- 주의점(함정): 시험에서 `prisma.$transaction` 은 Proxy 뒤라 `mock.method` 가 못 찾아 직접 바꿔 끼우고 되돌려야 한다(`askRouteGuard.test.ts` — 기존 `task010dA3b.test.ts` 방식). `t.mock.method(translationDeps, …)` 를 같은 시험 안에서 두 번 쓰면 `t.mock.restoreAll()` 부터.
- 미커밋 파일: 위 "변경 파일" 목록 + 이 기록. 커밋·push·`git add` 하지 않았다.
