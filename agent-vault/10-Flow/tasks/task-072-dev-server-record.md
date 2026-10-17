---
task_id: task-072
role: developer
title: "task-072 서버 부분 — 단어 추가 일본어 도우미 새 입구 #181 `POST /api/v1/words/phrase-help` (화면은 073 배포 뒤)"
created: 2026-10-17
tags:
  - type/task-record
  - domain/conversation
  - domain/vocab
---

# task-072 Developer 기록 (서버 부분만)

이력서: [[task-072-improve-word-add-helper]] · 프롬프트(단어 모드 `phraseHelp@v2`): [[task-072-pe-record]] · 회화 도우미 선행: [[task-056-improve-talk-phrase-helper]]

범위: Leader 지시 1~7(새 라우트 #181, 서버 함수, 한도 공유, 저장 금지, 공개, API 계약 문서, 시험). **화면(`src/components/**`·`src/app/(app)/**`)은 손대지 않았다**(task-073 작업 중 변경과 같은 라벨 줄 파일 — 073 배포 뒤). 네이티브·DB 스키마·환경변수·프롬프트 변경 없음. 커밋·푸시·배포 없음.

## 1. 변경 파일
| 파일 | 변경 |
|---|---|
| `src/app/api/v1/words/phrase-help/route.ts` (신규) | #181 라우트. `requireSession` → `readPhraseHelpBody(readJsonObject(req, 1024))` → `rateLimit` 분당 10·하루 300(#180 과 **같은 키**) → `helpWordPhrase(uid, body, undefined, req.signal)` · `Cache-Control: private, no-store` |
| `src/modules/conversation/chats/phraseHelp.ts` | `helpWordPhrase`·`WordPhraseHelpDeps` 추가. 공통 조각 3개를 뽑음: `withPhraseLock`(잠금)·`buildHelpRequest`(프롬프트 요청+입력오류→400)·`runPhraseHelp`(엔진 호출·취소·Trace·결과 매핑; `chatId: string\|null`·`stepExtra` 추가). `helpPhrase` 는 이 조각을 쓰도록 **재배치만**(판정 순서·문구·코드 그대로) |
| `src/modules/conversation/index.ts` | `helpWordPhrase`·`WordPhraseHelpDeps`·`PHRASE_HELP_WORD_PROMPT_VERSION`·`phraseHelpPromptVersion`·`isWordMode`·`PhraseHelpMode` 공개(자기 줄 5개만) |
| `src/types/phraseHelp.ts` | 화면용 `WordPhraseHelpItem`(= `Pick<PhraseHelpItem,'ja'\|'ko'>`)·`WordPhraseHelpResponse` 추가. 기존 타입 불변 |
| `docs/design/api-contract.md` | §1-5 #181 행 신설(#180 바로 아래)·제목 `#161~#181` · §2-9 단어장 표에 #181 포인터 행 |
| `src/modules/conversation/__tests__/task072WordHelpServer.test.ts` (신규) | 시험 24건 |
| 이 기록 · 이력서 「상태 로그」 한 줄 · `20-Log/2026-10-17.md` 한 줄 | vault |

파일 수(코드·문서) 6 — 10개 이하. PE 의 미커밋 변경(`prompts/phraseHelp.ts`·`structuredResponse/phraseHelp.ts`·`phraseHelpWord.test.ts`·픽스처/하네스)과 073 의 작업 중 변경은 **건드리지 않았고** 미러에 그대로 들어와 함께 시험했다.

## 2. 설계 결정
1. **공유 방식 — 복사 없이 내부 조각 3개.** `helpWordPhrase` 는 `helpPhrase` 의 채팅 의존(대화 소유·종류·종료·역할극 장면)만 걷어낸 함수이고, 나머지는 같은 파일의 내부 함수를 그대로 부른다.
   - `withPhraseLock(userId, run)`: 검사(`inFlight.has`)와 등록(`add`)이 같은 틱, `finally` 에서 `delete`. **회화·단어 도우미가 같은 `inFlight` Set** 을 쓰므로 한 사용자에게서 동시에 둘이 돌 수 없다(L3). 거절 문구·코드는 기존 그대로 `CONFLICT`/`PHRASE_BUSY`/「일본어 표현을 찾는 중이에요.」.
   - `buildHelpRequest(input)`: `buildPhraseHelpRequest` + `PhraseHelpInputError` → 400 `VALIDATION`(field `queryKo`).
   - `runPhraseHelp(...)`: 엔진 호출(`req.signal` 전달)·취소(`signal.aborted && isAbortError` 일 때만 409 `CANCELLED`)·`finalizePhraseHelp`·거절은 200 `items:[]`·`INVALID` 는 502·Trace 기록. `helpPhrase` 호출 쪽은 `stepExtra` 를 안 넘기므로 **회화 쪽 Trace 단계는 키 하나도 안 늘었다**(시험 고정).
2. **의존 타입을 줄여 채팅 접근을 타입으로 봉쇄**: `WordPhraseHelpDeps = Pick<PhraseHelpDeps, 'learnerLevel'|'complete'|'trace'>`. 기본값 `phraseHelpDeps` 가 그대로 들어맞는다. 시험의 가짜 deps 는 이 셋뿐 — `readChat`·`isEnded`·`readMaterial` 가 없어도 돈다.
3. **모드·수준·장면은 서버가 고정**: `{ queryKo, level: 프로필, scene: null, mode: 'word' }`. 본문은 `parsePhraseHelpBody`(모르는 키 `unknown_key` 400)라서 `mode` 를 실을 수 없고, 검증을 우회해 `mode`·`scene` 이 들어와도 함수가 읽지 않는다(시험).
4. **잠금 위치**: `helpWordPhrase` 는 **프로필 읽기 전에** 잠금을 잡는다 — 거절된 호출이 프로필 upsert 도 엔진도 건드리지 않는다. (`helpPhrase` 는 방 확인 → 잠금 순서 그대로: 없는 방은 잠금보다 먼저 404, 마친 역할극 `ENDED` 가 `PHRASE_BUSY` 보다 먼저.)
5. **한도 키 공유**: 라우트가 #180 과 같은 문자열 `phrase-help:<uid>`(10/분)·`phrase-help-day:<uid>`(300/24h)를 쓴다. #180 라우트를 건드리지 않으려고 상수는 라우트마다 둔다(`PHRASE_HELP_PER_MINUTE`·`PER_DAY`) — **어긋남은 시험이 잡는다**(두 라우트 소스에서 키·한도·창을 뽑아 `deepEqual`, 실제 `rateLimit` 에서 한쪽이 채운 버킷이 다른 쪽에서 429 로 이어짐을 확인).
6. **Trace(L5 — 원문 0)**: `kind:'TURN'`·`refType:'phraseHelp'`·`refId:null`(방 없음)·단계 `PHRASE_HELP` 에 기존 수치·코드(`phraseHelpTrace`)와 `scene:'NONE'`·`mode:'word'`·`promptVersion:'phraseHelp@v2'`. 실패·취소 단계에도 `mode`·`promptVersion` 이 남는다(관리 화면에서 단어 도우미 실패를 가려볼 수 있게). 질의·`ja`·`ko` 원문은 Trace·`console` 어디에도 없다(시험: 모든 경로 console 가로채기 + Trace 직렬화 대조). `recordTrace` 외 새 기록 경로 없음.
7. **알려진 부수 쓰기 1건(새 것 아님)**: 수준은 `getProfile(uid)` — 이 함수는 `Profile` 을 **upsert** 한다(#180 이 대화 수준이 없을 때, #169 도 같은 선례). #181 은 늘 프로필 수준을 쓰므로 Profile 행이 없는 사용자의 첫 호출이 행 1개를 만든다. 학습 기록·단어장·스냅샷은 0. 계약 문서에 적었다.

## 3. 화면 developer 가 쓸 계약 (#181)
요청: `POST /api/v1/words/phrase-help` · `Content-Type: application/json` · 본문 `{ "queryKo": string }` — 정리(trim) 뒤 1~100자, 한글 1자 이상, 본문 ≤1KB, 다른 키 금지(모드 같은 것을 보내지 않는다). 쿠키 세션 필요. 요청에 `AbortSignal` 을 걸면 서버가 엔진 호출까지 멈춘다(시트 닫기·12초 시간 초과·[그만두기]).

응답 200: `{ success:true, data:{ items:[{ ja, ko }] }, message:null }` — **0~3개**, `labelKo`·`whyKo` 키는 없다. 타입 `WordPhraseHelpResponse`(`src/types/phraseHelp.ts`). 거절·못 찾음(`NOT_A_PHRASE`·`UNSAFE`·길이 초과)은 `items:[]` 로 같은 모양 — **사유를 구분해 알리지 않는다**(화면은 「못 찾았어요」 한 갈래). 헤더 `Cache-Control: private, no-store`.

| HTTP | 오류 봉투 `{ success:false, data:{ code, details? }, message }` 의 `data.code` / `data.details.reason` | 언제 | 화면이 해야 할 일(데모 D7 입력) |
|---|---|---|---|
| 400 | `VALIDATION` (`data.details.field`/`reason`: `required`·`max_length`·`no_hangul`·`no_text`·`forbidden_char`·`secret_like`·`type`·`unknown_key`; 1KB 초과·JSON 오류는 `reason` 없음) | 본문 검사 실패 — **한도 미소모, DB·엔진 미접촉** | 화면이 먼저 막는 것(한글 없음 Q5, 100자)이 정상 경로. 서버 400 은 봉투의 `message`(한국어 안내)를 질의 칸 아래 안내 줄에 그대로 보여도 된다(#180 과 같은 쓰임) |
| 401 | `UNAUTHENTICATED` | 세션 없음 | 기존 로그인 만료 처리 |
| 409 | `CONFLICT` / `PHRASE_BUSY` | **회화 도우미·단어 도우미 통틀어 이 사용자의 호출이 이미 진행 중** | 데모 D7 의 「일본어 표현을 찾는 중이에요」 부드러운 안내(다시 시도 버튼). 잠시 뒤 재시도 가능 |
| 409 | `CONFLICT` / `CANCELLED` | 화면이 요청을 끊은 경우 | 손님이 읽지 않는 응답 — 상태를 바꾸지 말고 무시 |
| 429 | `RATE_LIMITED` + 응답 헤더 `Retry-After`(초; `data.details.retryAfterSec` 도 같은 값) | 분당 10 또는 하루 300 초과(회화 도우미와 **합산**) | 한도 문구 + 대기 시간 안내(`Retry-After` 초 사용) |
| 502 | `ENGINE_ERROR` (`PHRASE_INVALID` 포함) | 엔진 실패·쓸 수 있는 표제어 0(재시도 뒤에도) | 「일본어 표현을 만들지 못했어요. 다시 시도해 주세요.」(봉투 `message` 를 그대로 써도 엔진명 없음) |
| 504 | `ENGINE_TIMEOUT` | 서버 12초 한도 | 시간 초과 안내 |
| 네트워크 오류 | — | 오프라인 등 | D7 오프라인 상태 |

회화 도우미(#180)와 **한 사용자 동시 1건**이라, 단어 시트의 도우미를 쓰는 중 회화방 도우미를 눌러도 같은 409 가 난다(반대도). 화면은 도우미 호출 중 [뜻 채우기] 등 다른 AI 호출과 겹치지 않게 설계돼 있으나, 그것은 `PHRASE_BUSY` 와 별개(뜻 채우기는 #41, 자체 한도).

## 4. 증빙 (미러 `~/.node-local/thekaiwa-dev072-sv` — `cp -al` 후 저장소 `src/`·`tests/`·`package.json` `rsync --delete`, `UserWordState` 724건 확인)
- `tsc --noEmit` **0** · `eslint src/modules/conversation src/app/api/v1/words src/types` **0**
- 새 시험 `task072WordHelpServer.test.ts` **24/24 통과**
- conversation 전체 **1,249 pass / 0 fail**(기준 1,225 + 24 — 기존 `phraseHelp.test.ts`·`task056PhraseHelp.test.ts`·PE `phraseHelpWord.test.ts` 가 **수정 없이** 통과)
- 전체 시험·`next build`: 아래 「최종 수치」 참조
- 호출 방식 주의: 실제 Claude 호출·DB·운영/QA 서버 접촉 0 (`DATABASE_URL` 가짜, 주입 가짜 엔진)

## 5. 시험이 고정하는 것 (24건)
공개 API·버전 라벨 / 정상(채팅 접근 없이 프로필 1회+엔진 1회, 단어 모드 persona·system·본문) / **모드 서버 고정**(본문 `mode` 400·우회 호출 무시) / 수준 = 프로필(N5≠N2, 알 수 없는 값 = 수준 없음) / 질의 정리 / 응답 매핑(`{ja,ko}` 만·4개→3개·1개) / 거절 3종 200 빈 목록 / INVALID 502 / 엔진 실패 502·502·504 / 빈 질의 400 / **잠금 공유 양방향**(회화→단어 409, 단어→회화 409, 단어끼리 409, 다른 사용자 통과, 끝나면·실패·INVALID·프로필 실패·입력 오류 뒤 풀림) / **취소**(신호 전달·409 `CANCELLED`·500/오류 로그 0·잠금 해제·미리 끊긴 신호·살아 있는 신호의 AbortError 는 취소 아님 500) / Trace(refId null·mode·promptVersion·scene·원문 0, 실패 단계에도 mode) / **로그 원문 0**(성공·거절·실패·INVALID·취소 console 가로채기) / 저장 없음(소스 스캔) / **회화 도우미 회귀**(Trace 에 새 칸 없음·refId 방 id·v1·채팅 의존 그대로) / 본문 400 10종(실제 `readJsonObject(1024)`) / **라우트 순서**(401→400→한도→호출·`req.signal`·no-store) / **한도 공유**(두 라우트 소스 `deepEqual`+실제 `rateLimit` 합산) / 엔진명 비노출(소스·응답·오류 봉투) / 6층 import.

라우트 자체는 쿠키 세션이 필요해 실행하지 않고 소스 스캔으로 고정했다(기존 라우트 시험과 같은 방식). 401/429 의 HTTP 상태는 `requireSession`·`rateLimit`·`toErrorResponse` 가 이미 각자 시험된 공용 조각이고, 순서·키는 스캔이 고정한다.

## 6. 변이 점검 (미러 `thekaiwa-dev072-sv-mut` — 하드링크 미러라 파일을 제자리에서 쓰지 않고 rename 으로 교체; 한 번에 하나만 바꾸고 새 시험+기존 도우미 시험 2종을 돌린 뒤 저장소 원본으로 복원)
19개 전부 잡힘.
| # | 변이 | 결과 | 잡은 시험(대표) |
|---|---|---|---|
| M01 | 단어 도우미가 잠금 키를 다르게(`word:<uid>`) — 잠금 미공유 | 잡힘 | 잠금 공유 양방향 2건 |
| M02 | `mode:'word'` 제거 | 잡힘(6건) | 정상·모드 고정·수준·Trace 등 |
| M03 | 수준을 프로필 대신 `null` | 잡힘(3건) | 정상·모드 고정·수준 |
| M04 | 취소 신호를 엔진까지 안 넘김 | 잡힘 | 취소 2건 |
| M05 | 질의 원문 `console.log` | 잡힘 | 로그 원문 0 · 저장 없음 스캔 |
| M06 | 응답 매핑을 첫 항목만 | 잡힘(17건, 회화 시험 포함) | 매핑·정상·3개 상한 |
| M07 | `PHRASE_BUSY` 문구 변경 | 잡힘 | 잠금 공유(userMessage) |
| M08 | `PHRASE_BUSY` reason 변경 | 잡힘 | 회화 `PHRASE_BUSY` 시험 포함 3건 |
| M09 | Trace `refId` 가 방 id | 잡힘 | Trace 시험 |
| M10 | Trace 단계에서 `mode`·`promptVersion` 제거 | 잡힘 | Trace · 취소 |
| M11 | 잠금 `finally` 해제 누락 | 잡힘(31건) | 잠금 해제 전반 |
| M12 | 프로필 읽기를 잠금 앞으로 | 잡힘 | 잠금 공유(접촉 0 단언) |
| R01 | 라우트 한도 키를 `word-help:` 로 | 잡힘 | 라우트 순서 · 한도 공유 |
| R02 | 본문 검사 앞에서 한도 소모(400 이 한도 소모) | 잡힘 | 라우트 순서 · 한도 공유 |
| R03 | `req.signal` 미전달 | 잡힘 | 라우트 순서 |
| R04 | `Cache-Control` 헤더 제거 | 잡힘 | 라우트 순서 |
| R05 | 하루 한도 300→200 | 잡힘 | 한도 공유 |
| R06 | `requireSession` 을 본문 검사 뒤로 | 잡힘 | 라우트 순서 |
| R07 | 분당 한도 10→20 | 잡힘 | 한도 공유 |
| I01 | `index.ts` 에서 `helpWordPhrase` 내보내기 누락 | 잡힘 | 공개 API |

## 7. 알려진 한계·reviewer 가 볼 곳
1. **라우트는 실행 없이 소스 스캔**: 인증(`auth()`)이 요청 컨텍스트를 요구해 단위 시험에서 라우트를 직접 부를 수 없다(모듈 목킹 미지원 — Node 20). 401/400/429 의 실제 HTTP 응답은 QA 에서 curl 로 확인해야 한다(서버 가동 필요).
2. **한도 상수가 두 라우트에 중복**: #180 라우트를 건드리지 않으려는 선택. 한쪽만 바뀌면 시험이 깬다. 정리하려면 #180 라우트도 같은 상수를 import 해야 하므로 별도 작업.
3. **Profile upsert 1건**(위 §2.7). 원문과 무관.
4. **큐 대기 중 취소**: #180 과 같은 수용 한계 — 엔진 큐에서 차례를 기다리는 중 취소되면 차례가 올 때 잠금이 풀린다.
5. **`PHRASE_BUSY` 공유로 인한 화면 영향**: 회화방에서 도우미를 연 채(요청 진행 중) 홈으로 나가 단어 시트를 열고 곧바로 도우미를 쓰면 409 가 날 수 있다. D7 의 부드러운 안내가 이 경우를 덮는다.
6. 후보 상한을 3→2 로 줄일지는 PE 한계 2 로 Leader 결정 대기(서버 상한은 `PHRASE_HELP_LIMITS.itemsMax=3` 단일 값이라 바꾸면 회화 도우미도 영향 — 단어 모드만 줄이려면 보정에 분기 필요, 아직 안 함).
7. reviewer 확인 지점: ① `helpPhrase` 재배치가 외부 동작을 안 바꿨는지(기존 시험 수정 0) ② `withPhraseLock` 의 검사·등록이 같은 틱인지 ③ 라우트 호출 순서 ④ `stepExtra` 가 회화 Trace 에 새지 않는지 ⑤ 문서 §1-5 #181 문구와 코드 일치.

## 8. 최종 수치
- 전체 시험(`src`+`scripts/seed-build`, `--test-concurrency=1`): **4,200건 중 4,198 통과 · 실패 0 · 건너뜀 2**(PE 기준 4,176 + 새 시험 24 — 늘어난 만큼 늘었고 기존 skip 2건 그대로)
- `next build` **exit 0**(`/tmp/claude-1000/dev072-sv-build.log`, 출력 자르지 않음) — 라우트 목록에 `/api/v1/words/phrase-help` 포함
- 미러와 저장소 `src/`·`tests/` `diff -rq` 동일(시험·빌드한 상태 = 지금 저장소 상태)
- 변이 점검 19/19 잡힘(위 §6), 변이 미러는 변이마다 저장소 원본으로 복원했고 시험·빌드 미러(`-sv`)는 하드링크 rename 방식이라 영향 없음

## 9. 체크포인트
- **완료**: 서버 부분 전부(§1). 사양과 달라진 점 없음(지시 1~7 그대로). 추가로 한 것: 화면용 타입 2개, §2-9 포인터 행, Trace 단계 `mode`·`promptVersion`(원문 0).
- **남은 일**: 화면(단어 추가 시트 「가あ」 버튼·인라인 패널·카드·상태 31종) — task-073 배포 뒤. reviewer 서버 감사. QA 의 curl 확인(401/400/429/409/502/504 실제 HTTP).
- **다음 첫 행동(화면 developer)**: 이 기록 §3 계약표 → `docs/screens.md` §30 → 승인 데모 `docs/demo/task-072-word-helper-v1.html`; 데모 게이트 `activate` 는 화면 구현 시작 때(`check.mjs check --task` 가 `DEMO_GATE_PASSED` 인지 확인). 질의 칸 Enter 가 1단계 `<form>` 을 제출하지 않게 막고, 패널에서 Esc 전파를 막을 것(designer 함정).
- **주의점**: 한도 상수는 두 라우트에 중복(#180·#181) — 한쪽만 바꾸면 시험이 깬다. 단어 모드 보정(`JA_NOT_WORD`)은 PE 소유라 건드리지 않았다. 후보 상한 3→2 는 Leader 결정 대기.
- **미커밋 파일(내 몫)**: `src/app/api/v1/words/phrase-help/route.ts`(신규) · `src/modules/conversation/chats/phraseHelp.ts` · `src/modules/conversation/index.ts` · `src/types/phraseHelp.ts` · `src/modules/conversation/__tests__/task072WordHelpServer.test.ts`(신규) · `docs/design/api-contract.md` · vault(이 기록·이력서 상태 로그 한 줄·`20-Log/2026-10-17.md` 한 줄). 그 밖의 미커밋(PE·073·designer)은 내 것이 아니다 — 푸시 전 hunk 단위 스테이징 필요.
- 미러: 시험·빌드 `~/.node-local/thekaiwa-dev072-sv`(reviewer 가 그대로 써도 됨, 저장소와 동일), 변이 점검용 `~/.node-local/thekaiwa-dev072-sv-mut`(정리 가능), 로그 `/tmp/claude-1000/dev072-sv-{full,build,conv}.log`.

## 10. 감사 후 보완 라운드 (REV-072S M-1 · L-1) — 2026-10-17 developer(신규 소환)

범위: reviewer 지적 **M-1**(정형 인사가 단어 모드에서 502) · **L-1**(같은 틱 동시 호출 원자성 시험 없음)만. 화면·라우트·프롬프트 문구·`prompts/**`·docs 는 건드리지 않았다. 네이티브·DB·환경변수 변경 없음. 커밋·푸시·배포 없음.

### 10.1 변경 파일 (모두 내 소유 목록 안)
| 파일 | 변경 |
|---|---|
| `src/modules/conversation/structuredResponse/phraseHelp.ts` | 최종 상태 `'NOT_A_WORD'` 추가(단어 모드 전용). `isNotWordOnly`(이유가 `JA_NOT_WORD` 뿐). `fitPhraseHelp`: 남은 항목 0 → 길이뿐이면 `TOO_LONG`, **`JA_NOT_WORD` 뿐이면 `NOT_A_WORD`**, 그 밖은 `INVALID`. `phraseHelpViolations`: `(TOO_LONG ∥ NOT_A_WORD) && !lastAttempt` 만 위반 → **첫 시도는 위반(재시도 1회 그대로), 마지막 시도는 데이터**. 머리 주석 보강 |
| `src/modules/conversation/chats/phraseHelp.ts` | **주석만**(서비스 로직 불변: `fin.status === 'INVALID'` 만 던지므로 `NOT_A_WORD` 는 자동으로 `{items: []}` 200) |
| `src/modules/conversation/__tests__/phraseHelpWord.test.ts` | 옛 기대 3곳 갱신(INVALID→NOT_A_WORD, 마지막 시도 위반→`[]`) + 신규 5개 → 24개 |
| `src/modules/conversation/__tests__/task072WordHelpServer.test.ts` | INVALID 시험을 「다른 위반 섞임 → 502」로 교체 + 신규 6개(NOT_A_WORD 200·진짜 재시도 루프 3·동시성 2) → 30개 |
| `tests/prompts/fixtures/phrase-help-word.json` | `wordFormulaCases` 4종(감사합니다·죄송합니다·안녕하세요·잘 먹겠습니다, 기대 `OK_OR_EMPTY` = 「표제어 0개 허용」) + note |
| `tests/prompts/phraseHelpWordCheck.ts` · `tests/prompts/phrase-help-word-live.ts` | `classifyFormulaOutcome`·`formulaPasses`, 하네스 `GROUP=formula`(서버 입구 `helpWordPhrase` 를 수준·Trace 만 가짜로 그대로 호출) |

### 10.2 결정 근거
1. **새 최종 상태 `NOT_A_WORD`**(INVALID 의 하위로 두지 않고, `NOT_A_PHRASE` 재사용도 안 함): 재시도 규칙(첫 시도 위반·마지막 데이터)이 `TOO_LONG` 과 같은 모양이고, 관리 화면에서 Trace `outcome=NOT_A_WORD`/`dropReasons=JA_NOT_WORD` 로 「모델이 거절한 것(NOT_A_PHRASE)」과 구분된다. `PhraseHelpFinalStatus` 를 소비하는 곳은 Trace 문자열·`phraseHelpItems`(`OK` 만 항목)뿐이라 다른 코드 영향 없음.
2. **분류식에 `word &&` 가드를 두지 않았다**: `JA_NOT_WORD` 는 `if (word && !isWordHeadform)` 안에서만 추가되므로 회화 모드에서는 이유 집합에 없어 `isNotWordOnly` 가 항상 false — 가드를 또 두면 동치 변이만 늘어난다. 회화 모드 불변은 아래 10.4 의 이전 소스 대조로 입증.
3. **재시도는 그대로**(Leader 결정): 첫 시도가 정형 꼬리면 위반(고정 문장)으로 한 번 더 부른다. 실호출에서 재시도가 `ありがとう`(표제어)를 건진 1건이 있었다(10.6).
4. 엔진 폴백: 마지막 시도 위반이 사라져 `JsonSchemaError` 가 안 나므로 정형 인사에서 엔진이 던지는 일 자체가 없다 — 모델 호출은 최대 2회로 끝난다.

### 10.3 증빙 (미러 `~/.node-local/thekaiwa-dev072-fix` — `cp -al thekaiwa-dev072-sv` 후 저장소 `src/`·`tests/`·`package.json` rsync, `UserWordState` 724건 확인, 끝에 `diff -rq` 동일)
- `tsc --noEmit` **0** · `eslint src/modules/conversation src/app/api/v1/words tests/prompts` **0**
- 신규·갱신 시험: `phraseHelpWord.test.ts` **24/24** · `task072WordHelpServer.test.ts` **30/30**(기준 24) · 기존 `phraseHelp.test.ts`·`task056PhraseHelp.test.ts` **수정 0건으로 통과** — 4개 파일 합 99건 중 99 통과
- conversation 전체 **1,260 pass / 0 fail**(기준 1,249 + 11)
- 전체 시험(`src`+`scripts/seed-build`, `--test-concurrency=1`) **4,211건 중 4,209 통과 · 실패 0 · 건너뜀 2**(기준 4,200 + 11, skip 2 그대로)
- `next build` **exit 0**(`./node_modules/.bin/next build > 로그 2>&1; echo $?`, 출력 자르지 않음) — 라우트 목록에 `/api/v1/words/phrase-help`·`/api/v1/chats/[id]/phrase-help`. (`.next` 트러블슈팅은 10.8)
- 마지막에 동시성 시험 2개를 `try/finally`(단언이 깨져도 문을 열어 잠금 해제)로 다듬은 뒤 `task072WordHelpServer.test.ts` 30/30·eslint 0·tsc 0 을 다시 확인했다. 전체 시험·conversation·빌드 수치는 그 직전 실행이다(해당 파일 외 변경 없음).

### 10.4 회화 모드 불변 — 이전 소스와의 차분 대조 (미러 전용 일회성, 저장소에 넣지 않음)
이 라운드 직전 소스(`thekaiwa-dev072-sv` 의 `conversation/**`)를 `_prev` 로 복사해 같은 입력으로 돌렸다(시드 고정 난수 응답 6,000개 — 상태·항목 수·`ja`/`ko`/`labelKo`/`whyKo`·모양 오류·길이·한글·URL·엔진명 섞음). 사본 시험은 스크래치패드 `_diffprev072fix.test.ts` (저장소 밖).
- **회화 모드**(mode 생략·null·`'sentence'`·`'WORD'`·`' word'`·`true`·`1`·`{}` 8종) × 응답 6,000 × 질의 7 = **336,000조합**: `fitPhraseHelp`·`phraseHelpViolations`(시도 정보 4종)·`phraseHelpTrace`·`phraseHelpItems` JSON 바이트 동일, `NOT_A_WORD` 0건. 요청 빌드·`finalizePhraseHelp` 280조합(+84,000 finalize) 동일. `helpPhrase` 400시나리오(결과·오류·호출 순서·엔진 요청 JSON·Trace) 동일.
- **단어 모드** 42,000조합: 이전과 다른 경우는 **「이전 INVALID · 이유 `JA_NOT_WORD` 뿐 · 항목 0」→ `NOT_A_WORD` 1,904건뿐**(나머지 40,096건 바이트 동일). 위반 문구도 다른 경우는 그 1,904건의 **마지막 시도(위반 → `[]`)** 뿐. `helpWordPhrase` 1,500표본: 바뀐 72건은 전부 「502 PHRASE_INVALID → 200 `{"items":[]}`」이고 호출 순서·엔진 요청은 동일.

### 10.5 변이 점검 14개 — 전부 잡힘 (미러 하드링크 보호: rename 으로 교체 후 원본 복원, 매번 4개 시험 파일로 판정; 스크립트 `scratchpad/mut072fix.py`)
| # | 변이 | 결과 | 잡은 시험(대표) |
|---|---|---|---|
| M1 | `NOT_A_WORD` 분류를 끔(전부 INVALID → 502 되돌림) | 잡힘(7건) | 보정·extraCheck·NOT_A_WORD 단위 |
| M2 | 「JA_NOT_WORD 뿐」을 `every`→`some`(하나라도) | 잡힘(4건) | 다른 위반 섞임 단위 · 서버 502 2건 |
| M3 | `KO_BAD` 가 섞여도 NOT_A_WORD | 잡힘(5건) | 섞임 단위 · 기존 방어 · 서버 502 |
| M4 | `ITEM_SHAPE` 가 섞여도 NOT_A_WORD | 잡힘(3건) | 섞임 단위 · 거절 상태 · 서버 502 |
| M5 | 회화 모드에 새 분기가 샌다(`JA_HANGUL` 뿐이어도 NOT_A_WORD) | 잡힘(7건) | 회화 모드 NOT_A_WORD 금지 · extraCheck(기존) |
| M6 | 표제어 검사가 회화 모드에도 걸림(`word &&` 제거) | 잡힘(23건) | 기존 회화 보정 시험 전반 |
| M7 | 첫 시도 재시도 제거(NOT_A_WORD 를 항상 데이터로) | 잡힘(5건) | 재시도 규칙 · 모델 호출 2번 시험 |
| M8 | 마지막 시도에도 NOT_A_WORD 를 위반으로(엔진이 던짐 → 502) | 잡힘(3건) | 재시도 규칙 · 200 빈 목록(진짜 재시도 루프) |
| M9 | 서비스가 `NOT_A_WORD` 를 502 로 던짐 | 잡힘(2건) | NOT_A_WORD 200 · 재시도 루프 200 |
| M10 | 잠금 검사·등록 사이 `await`(원자성 깨기, 감사 X1) | **잡힘(2건 — 이번에 추가한 동시성 시험 2건만)** | 같은 틱 3건 · 단어·회화 4건 |
| M11 | Trace outcome 이 `INVALID` 로 찍힘 | 잡힘(3건) | NOT_A_WORD 단위·서버 Trace |
| M12 | 표제어 꼬리 목록에서 `ません` 제거 | 잡힘(2건) | 정형 인사 단위·서버 |
| M13 | 길이 전용 `TOO_LONG` 분류를 끔(기존 갈래 회귀) | 잡힘(6건) | 기존 보정·extraCheck |
| M14 | 잠금 `finally` 해제 제거 | 잡힘(37건) | 잠금·정상 경로 전반 |
→ **14개 중 14 포착**(감사 때 생존한 X1 은 M10 으로 이제 포착). 동시성 시험이 깨졌을 때 뒤 시험이 연쇄로 `PHRASE_BUSY` 로 깨져 원인이 묻히지 않게, 두 시험은 단언이 깨져도 `finally` 에서 문을 열어 잠금을 푼다(M10 에서 실패는 정확히 2건).

### 10.6 실호출 (로컬 Claude CLI, DB·서버·운영 포트 접촉 0, `routerDeps.loadChain` 고정 연결, `DATABASE_URL` 가짜; 질의당 2회 = 8행, 모델 호출 12회 — 결과 `/tmp/claude-1000/dev072fix-live/`)
서버 입구 `helpWordPhrase` 를 그대로 불러 HTTP 로 치면 무엇인지 잰 것(수준 조회·Trace 만 가짜).
| 질의 | 회차 1 | 회차 2 |
|---|---|---|
| 감사합니다 | 200 표제어 `ありがとう`(1차 `ありがとうございます` 위반 → 재시도가 건짐, 4.5s) | **200 빈 목록**(`NOT_A_WORD`·`JA_NOT_WORD`, 시도 2, 5.1s) |
| 죄송합니다 | **200 빈 목록**(`NOT_A_WORD`, 시도 2, 6.2s) | **200 빈 목록**(`NOT_A_WORD`, 시도 2, 6.3s) |
| 안녕하세요 | 200 빈 목록(모델이 `NOT_A_PHRASE`, 시도 1, 2.1s) | 200 빈 목록(`NOT_A_PHRASE`, 2.2s) |
| 잘 먹겠습니다 | 200 빈 목록(`NOT_A_PHRASE`, 2.2s) | 200 빈 목록(`NOT_A_PHRASE`, 2.2s) |
**요약: 200 빈 목록 7 · 200 표제어 1 · 문장형 0 · 오류(502 등) 0** — 감사 때 502 였던 감사합니다·죄송합니다가 전부 200. 엔진명 누출 0.

### 10.7 남은 위험·후속 후보
1. **5초 예산**: 재시도를 두 번 타는 정형 인사(감사·죄송)는 **4.5~6.3초**(모델 2회). 응답은 맞지만 화면은 빈 결과를 그만큼 늦게 본다. 12초 한도 안. Leader 결정(재시도 유지) 그대로 두었다. 줄이려면 PE 쪽에서 프롬프트가 정형 인사를 사전형(ありがとう·すまない 류)으로 풀게 하거나, `ます/です` 꼬리만 있는 1차 응답은 재시도 없이 끝내는 방법이 있는데 — 후자는 실호출에서 재시도가 `ありがとう` 를 건진 사례(1/4)를 잃는다.
2. `안녕하세요`·`잘 먹겠습니다`는 모델이 `NOT_A_PHRASE` 로 거절해 빈 목록(이 사용 자체가 단어 도우미의 목적 밖이라 정상).
3. `prompts/phraseHelp.ts` 의 `finalizePhraseHelp` 문서 주석("`NOT_A_PHRASE`·`UNSAFE`·`TOO_LONG` 은 항목 없음")에 `NOT_A_WORD` 가 빠져 있다 — **PE 영역이라 안 고쳤다**(코드 영향 없음, 주석 한 단어).
4. `api-contract.md` #181 행은 이미 「거절·못 찾음도 `items:[]`, 사유를 구분해 알리지 않음」이라 이 동작과 모순이 없다 — 원하면 Leader 가 502 항목에 「(정형 표현으로 표제어가 0개면 502 가 아니라 빈 목록)」을 덧붙인다.
5. 라우트 시험이 소스 스캔뿐인 점(L-2)은 이번 범위 밖 — QA 가 실제 HTTP 로 401/400/429 를 확인한다(감사 high_risk_areas). 이 라운드로 QA 기대값이 바뀌는 곳: **정형 인사(감사합니다·죄송합니다)는 502 가 아니라 200 `{items: []}`**.

### 10.8 트러블슈팅 (재발 가능)
- **하드링크 미러(`cp -al`)의 `.next` 를 그대로 쓰면 `next build` 가 Tailwind/PostCSS 단계에서 깨진다** — 첫 시도: CSS 후보에 깨진 바이트(`var(z���)`·`26px!\13`) 20건 경고, 둘째 시도: `CssSyntaxError … globals.css:2:13951 Missed semicolon`. 원인 추정[가능성 높음]: Turbopack 캐시 파일이 원본 미러(`thekaiwa-dev072-sv`)와 같은 inode 라 제자리 쓰기로 서로 오염. 해결: `.next` 를 **프로젝트 밖**(`~/.node-local/thekaiwa-dev072-fix-oldnext*`)으로 `mv` 하고 새로 빌드 → exit 0. 프로젝트 안에 `.next-xxx` 로 옮겨 두면 Tailwind 가 그 안을 스캔해 같은 오류가 난다(첫 시도의 부분 원인). 원본 `thekaiwa-dev072-sv/.next` 도 같은 방식으로 오염됐을 수 있으니 거기서 빌드하지 말 것(시험·tsc 는 영향 없음).
- 미러의 `rsync -a --delete src/` 는 미러에만 둔 일회성 파일(`_prev`·`_diffprev.test.ts`)을 지운다 — 대조 시험은 끝나면 어차피 정리 대상이라 문제없었으나, 변이 점검은 `--exclude` 로 보호하거나 변이 스크립트처럼 파일 단위 교체를 쓸 것.

### 10.9 체크포인트
- **완료**: M-1(`NOT_A_WORD`) · L-1(동시성 시험) · 정형 인사 픽스처 4종 · 하네스 `GROUP=formula` · 실호출 · 변이 14/14 · 차분 대조.
- **남은 일**: reviewer 재검증 → QA 실제 HTTP(기대값 갱신 위 10.7-5) → 화면 구현(task-073 배포 뒤 이미 허용). PE: 주석 한 단어(10.7-3).
- **다음 첫 행동(reviewer)**: 10.4 의 차분 대조를 그대로 재현(`scratchpad/_diffprev072fix.test.ts`, 저장소 밖)하거나 변이 M1·M2·M8·M10 만 재현.
- **주의점**: `NOT_A_WORD` 는 `JA_NOT_WORD` 뿐일 때만이다 — 다른 위반이 섞이면 INVALID(502). 첫 시도 위반이라는 점이 재시도를 살린다.
- **미커밋 파일(이 라운드 내 몫)**: `src/modules/conversation/structuredResponse/phraseHelp.ts` · `chats/phraseHelp.ts`(주석) · `__tests__/phraseHelpWord.test.ts` · `__tests__/task072WordHelpServer.test.ts` · `tests/prompts/fixtures/phrase-help-word.json` · `tests/prompts/phraseHelpWordCheck.ts` · `tests/prompts/phrase-help-word-live.ts` · vault(이 기록·이력서 상태 로그 한 줄·`20-Log/2026-10-17.md` 한 줄). 앞 라운드 미커밋(PE·서버)과 같은 파일에 겹쳐 있어 푸시 전 hunk 단위가 아니라 **파일 단위 명시 스테이징**(`git --literal-pathspecs add -- <경로>`).
- 미러: `~/.node-local/thekaiwa-dev072-fix`(저장소와 동일, 시험·빌드 완료), `-oldnext`·`-oldnext2`(옛 `.next`, 정리 가능). 로그 `/tmp/claude-1000/dev072fix-*.log`.
