---
task_id: task-072
role: reviewer
title: "task-072 서버 부분 독립 감사 — #181 POST /api/v1/words/phrase-help (단어 모드 phraseHelp@v2)"
created: 2026-10-17
tags:
  - type/task-record
  - domain/conversation
  - domain/vocab
---

# task-072 Reviewer 기록 (서버 부분만, REV-072S)

이력서: [[task-072-improve-word-add-helper]] · developer 서버 [[task-072-dev-server-record]] · PE [[task-072-pe-record]]

## 판정: **PASS_WITH_NOTES** (스키마 기준 PASS — Critical 0 · High 0 · Medium 1 · Low 5)
- 범위: 작업트리 미커밋 변경 — `git diff HEAD` 6개 파일 + 신규 라우트·시험·픽스처·하네스. **화면 코드 0줄**(`src/components`·`src/app/(app)` 변경 없음 확인) → 데모 게이트 대조 해당 없음. DB 스키마·환경변수·네이티브 변경 없음(`native_change: false`). Codex 검토 기록 없음(해당 없음).
- 결론: 회화방(#180) 동작은 **바이트 단위로 불변**임을 직접 확인했고, #181 의 인증·검증·한도·잠금·취소·오류 매핑·원문 미기록은 실제 라우트 핸들러를 통과시켜도 계약대로 동작한다. 막을 결함은 없다. 다만 **정형 인사말 질의(감사합니다·죄송합니다)가 502 로 끝난다**는 실측 Medium 1건과, 시험이 못 잡는 변이 2건(Low)이 있다.

## 불편한 사실 먼저
1. [확실] **단어 모드는 흔한 정형 표현에서 실패한다.** 이 감사에서 단어 모드(`phraseHelp@v2`)를 로컬 Claude CLI 로 5문장만 실호출한 결과: `감사합니다`·`죄송합니다` → 1차 응답이 `JA_NOT_WORD`(ありがとうございます 류, `ます/ません` 꼬리)로 전부 버려져 재시도도 같은 위반 → `JsonSchemaError` → **502**(4.4~5.2초, 엔진 2회분을 쓴다). `안녕하세요`·`잘 먹겠습니다`·`수고하셨습니다` → `NOT_A_PHRASE` 빈 결과(200 「못 찾았어요」). PE 의 15+12개 질의에는 정형 인사가 없어 이 구멍을 못 봤다. 사용자가 「감사합니다」를 단어장에 넣으려 할 수는 있다.
2. [확실] 개발자가 「라우트는 실행할 수 없어 소스 스캔」이라 한 부분은 **스캔이 놓치는 결함이 실제로 있다**: 라우트 `requireSession()` 의 `await` 를 지워도(변이 X2) 새 시험 24개가 전부 통과한다(그러면 엔드포인트가 모두에게 500). 같은 틱 동시 호출 원자성도 시험이 없다(변이 X1 생존, 아래).
3. [확실] 「저장 없음」 엔드포인트가 매 호출 `getProfile` upsert(쓰기 경로)를 탄다. 문서에 적혀 있고 #180·#169 선례가 있어 결함은 아니지만 「읽기만」은 아니다.

## 심각도별 지적
| # | 심각도 | 위치 | 내용 | 근거 | 권고 |
|---|---|---|---|---|---|
| M-1 | **Medium** | `structuredResponse/phraseHelp.ts` `isWordHeadform`·`WORD_SENTENCE_TAIL`(:321-324), `fitPhraseHelp` 단어 분기(:386-390) | 정형 인사·고정 표현(ありがとうございます·すみません·いただきます 등 `ます/です/ません` 꼬리)이 표제어로 인정되지 않아 **모든 항목이 버려지면 INVALID → 재시도 → 502**. 17~100자 표제어도 `JA_NOT_WORD` 로 가서 회화 모드와 달리 TOO_LONG(200 빈 목록)이 아니라 502. 재시도가 고칠 수 없는 입력(정형 표현)에서 엔진 2회분(약 5초)을 쓰고 「다시 시도해 주세요」를 보여 준다 | 실호출(위 「불편한 사실」1) · `fitPhraseHelp` mode=word 에 `ありがとうございます` 단독 → INVALID · 라우트 in-process 시험 502 | PE/Developer 중 한 곳에서: ⓐ 마지막 시도에서 「전부 JA_NOT_WORD 로만 버림」이면 502 대신 `TOO_LONG` 과 같이 200 빈 목록(못 찾음)으로 받기, 또는 ⓑ 정형 표현 예외(꼬리 검사 제외 목록) · 픽스처에 인사 4종(감사·죄송·잘 먹겠습니다·수고) 추가해 실호출 재측정. **화면 작업을 막지는 않는다**(화면은 502 도 「못 만들었어요」로 처리) |
| L-1 | Low | `task072WordHelpServer.test.ts` 잠금 시험 | **같은 틱 동시 호출 원자성 시험 없음.** `withPhraseLock` 의 검사(`has`)와 등록(`add`) 사이에 `await` 가 끼어도(변이 X1) 시험 24개+기존 도우미 시험이 전부 통과. 이 변이에서 `Promise.all([helpWordPhrase×3])` 은 **3건 모두 통과**(정상 코드는 1건만) | 변이 X1 · 아래 재현 시험 `_revRace.test.ts`(정상 코드 통과·변이에서 `expected 1, actual 3`) | `Promise.all` 로 같은 사용자 3건을 동시에 시작해 정확히 1건만 통과하는 시험 1개 추가(재현 시험을 그대로 써도 된다) |
| L-2 | Low | 라우트 시험이 소스 정규식 스캔뿐 | 인증·순서·한도 키는 문자열 스캔이라 `await` 누락(변이 X2)을 못 잡는다. 이 감사에서는 `requireSession` 에 시험용 훅을 단 미러에서 **실제 핸들러**를 불러 401/400/429/409/502/504/취소를 전부 확인했다(통과) | `_revRoute.test.ts`(저장소에는 인증 시험 seam 이 없어 미러 전용) | QA 가 실제 HTTP 로 401·400·429 를 반드시 확인(아래 high_risk_areas). 장기적으로는 `requireSession` 에 시험용 주입 seam 을 두면 라우트 시험을 정식화할 수 있다(별도 작업) |
| L-3 | Low | `chats/phraseHelp.ts` `phraseHelpDeps.learnerLevel` → `getProfile` | #181 은 매 호출 `profile.upsert`(쓰기) 후 엔진. 문서화됨(#181 행 마지막 문장). 사용자 영향 없음 | `preferences/index.ts:23-26` | 수용. 읽기 전용 수준 조회를 따로 두면 「저장 없음」이 엄밀해진다(후속) |
| L-4 | Low | `docs/screens.md` §30-7 | 화면 설계는 `items[0..3].{ja, ko, labelKo?}` 를 쓸 수 있다고 적었으나 서버(단어 모드)는 `labelKo`·`whyKo` 를 **보내지 않는다**. 클라이언트 파서 `readPhraseHelp` 는 선택 칸이라 호환 | `phraseHelperLogic.ts:146-161` | 화면 developer 가 §30-7 을 서버 계약(`{ja,ko}` 만)에 맞추거나 `labelKo` 줄을 단어 화면에서 쓰지 않는다고 명시 |
| L-5 | Low | 두 라우트의 한도 상수 중복 | `PHRASE_HELP_PER_MINUTE`/`PER_DAY` 가 #180·#181 라우트에 각각 있다(키·창도 문자열 중복). 한쪽만 바뀌면 합산이 깨진다 — 개발자 시험이 두 라우트 소스를 `deepEqual` 로 대조해 잡는다(변이 R05·R07 및 내 변이 X4 가 잡힘) | `route.ts:8-9` vs `chats/[id]/phrase-help/route.ts:10-11` | 수용(시험이 고정). 정리는 별도 작업 |

Critical 0 · High 0 · Medium 1 · Low 5. 엔진명 누출: 라우트·응답·타입·오류 봉투에 없음(주석의 `haiku` 언급은 기존 v1 주석 관행과 같은 위치뿐, UI·분기·문구 아님).

## 감사 관점별 결과 (7영역)
1. **아키텍처**: 라우트는 `@/modules/infra`·`@/modules/conversation`(index) 만 import. 서비스 파일은 신규 import 0(`phraseHelpPromptVersion` 은 같은 모듈). `src/types/phraseHelp.ts` 는 서버 import 없음. 응답 봉투 `{success,data,message}`·`/api/v1`·번호 #181 문서 충돌 없음(`docs`·`src` 전수 grep: #181 은 api-contract 의 두 행과 이 작업의 참조뿐, #180 다음 번호). pm2 `thekaiwa` `instances: 1` → 프로세스 메모리 잠금·한도가 유효.
2. **유지보수성**: `helpPhrase` 에서 잠금·요청 조립·엔진 호출을 내부 조각 3개로 뽑아 복사 없이 공유(재배치만). 모델명·포트·타임아웃·Secret 하드코딩 없음. (L-5 상수 중복만)
3. **안정성**: 잠금 해제 `finally`(실패·취소·INVALID·프로필 실패·입력 오류 뒤 풀림 확인), 취소 신호 `req.signal` → 엔진 도달 → 409 `CANCELLED`·500 아님(task-056/058 M1 교훈 준수), 504/502 매핑. (M-1: INVALID 경로)
4. **운영성**: Trace `kind:'TURN'`·`refType:'phraseHelp'`·`refId:null`·단계에 `mode`·`promptVersion`·`scene:'NONE'` 추가, 질의·표제어·뜻 원문 없음(Trace 직렬화·console 가로채기로 확인). 스키마상 `refId` 는 nullable(`RequestTrace.refId String?`). 헬스·ConfigurationVersion 해당 없음(설정 변경 없음).
5. **성능**: 단어 모드 `promptChars` 약 2.2~2.7K(A1 상한 3,000 안), 실호출 2.1~2.8초/회. 5초 예산: 정형 인사 502 경로만 두 번 호출해 4.4~5.2초(M-1).
6. **보안**: 인증 401 → 본문 400(한도·프로필·엔진 미접촉) → 한도 429 → 잠금 409 순서 실제 핸들러로 확인. `mode`·`scene` 키는 본문 검증이 `unknown_key` 400 으로 막음(서버 고정). spawn/경로/Secret 조립 없음. 소유자 검사 대상 리소스 없음(채팅 미접근을 타입 `Pick<…,'learnerLevel'|'complete'|'trace'>` 로 봉쇄). 프롬프트 주입: 출력 방어(`ja` 한글 금지·허용 글자·로마자 대조·16자, `ko` 한글 필수·일본어 글자/URL/엔진명 금지)가 v1 과 같이 걸림.
7. **학습 원칙**: LLM 산출을 어디에도 저장하지 않음(`helpWordPhrase` 경로의 쓰기는 `getProfile` upsert(L-3)와 Trace 코드·수치뿐). AI 는 제안만. 엔진명·model_id·speaker_id 응답 노출 0. TTS 해당 없음.

## 직접 한 검증

### (1) 회화방(#180) 불변 대조 — 통과
HEAD 의 3개 모듈을 미러 `_head/` 에 따로 복사해 같은 입력으로 비교(재현 시험 `_revCompare.test.ts`).
- `buildPhraseHelpRequest` 3,600조합(수준 10 × 장면 5 × 질의 8 × `mode` 9종: 생략·null·`WORD`·`phrase`·`true`·`1`·`{}`·`Word`·` word`) JSON 바이트 동일
- `fitPhraseHelp`·`phraseHelpViolations`(3가지 `info`)·`finalizePhraseHelp` 응답 15종 × 질의 8 × `mode` 4종 + 수준 10 → 동일, 스키마·한도 표(`wordJaMax`/`wordKoAsk` 제외)·`parsePhraseHelpBody` 입력 10종 동일
- `helpPhrase` 11시나리오(정상·404·회화 아님·ENDED·역할극 장면·수준 없음·INVALID·거절·긴 글·엔진 실패·취소)의 결과·오류 코드/상세/문구·호출 순서·엔진 요청 JSON·Trace 레코드(키 포함) 동일

### (2) #181 실제 라우트 핸들러 in-process (`requireSession` 에만 미러 전용 훅, DB·엔진은 `phraseHelpDeps` 가짜) — 8/8 통과
401(프로필·엔진 0) · 200 본문 `{success:true,data:{items:[{ja,ko}]},message:null}`+`Cache-Control: private, no-store`(모델이 낸 `labelKo`·`whyKo` 제거) · 400 12종(한도 미소모 — 직후 정상 호출 10번 가능) · 429 합산(#181 6+#180 4 → 11번째는 어느 쪽이든 429, `Retry-After` 헤더 = `details.retryAfterSec`) · 하루 300 합산(시계 전진, 200 통과 300건 후 429) · 409 `PHRASE_BUSY` 양방향·다른 사용자 통과·끝나면 풀림 · 502(`ClaudeCliError`·`NoEngineAvailableError`)/504(`ClaudeCliTimeoutError`), 봉투에 엔진명 0 · 거절 200 `items:[]` · INVALID 502 · 취소 409 `CANCELLED`·잠금 해제 · 로그/Trace 에 질의 원문 0.

### (3) 증빙 재실행 (미러 `~/.node-local/thekaiwa-rev072s` = `cp -al` + 저장소 `rsync --delete`, `UserWordState` 724건 확인, `diff -rq` 동일)
| 항목 | 결과 |
|---|---|
| `tsc --noEmit` | **0** |
| `eslint src/modules/conversation src/app/api/v1/words src/types tests/prompts` | **0** |
| conversation 시험 | **1,249 / 실패 0** |
| 전체 시험(`src`+`scripts/seed-build`, `--test-concurrency=1`) | **4,200건 중 4,198 통과 · 실패 0 · 건너뜀 2** |
| `next build` (`./node_modules/.bin/next build > log; echo $?`) | **0** — 라우트 목록에 `/api/v1/words/phrase-help`·`/api/v1/chats/[id]/phrase-help` |

### (4) 실호출 최소 확인 (로컬 Claude CLI, 5회·단어 모드, DB·서버 접촉 0)
`감사합니다`·`죄송합니다` → 502(재시도 포함 2회 호출) · `안녕하세요`·`잘 먹겠습니다`·`수고하셨습니다` → 빈 결과(NOT_A_PHRASE). → M-1.

### (5) 변이 12개 (하드링크 미러 `-mut`에서 파일을 rename 으로 교체, 새 시험 24 + PE 시험 + 기존 `phraseHelp`·`task056PhraseHelp` 시험 88건으로 판정, 매번 저장소 원본으로 복원)
| # | 변이 | 결과 |
|---|---|---|
| X1 | 잠금 검사와 등록 사이에 `await Promise.resolve()`(원자성 상실) | **생존** → L-1 (동시 3건 모두 통과 재현) |
| X2 | 라우트 `await requireSession()` 에서 `await` 제거 | **생존** → L-2 |
| X3 | 라우트 `readJsonObject(req, 1024)` → 기본 64KB | 잡힘(라우트 순서 시험) |
| X4 | 라우트 하루 한도 창 `86_400_000` 제거(기본 60초) | 잡힘(한도 공유 시험) |
| X5 | 취소 단계 Trace 에서 `...stepExtra` 제거 | 잡힘(취소 시험) |
| Y1 | 단어 모드 `isWordHeadform` 검사 우회 | 잡힘(5건) |
| Y2 | 문장 꼬리 정규식에서 `ください` 제거 | 잡힘 |
| Y3 | `wordJaMax` 16 → 100 | 잡힘 |
| Y5 | 단어 모드가 `labelKo`·`whyKo` 를 유지 | 잡힘(3건) |
| Y8 | `finalizePhraseHelp` 가 `mode` 를 잃음(재시도 검사에는 있고 최종 보정에는 없음) | 잡힘(3건) |
| Z1 | 본문 검사가 `mode` 키를 허용 | 잡힘(2건) |
| Z2 | `helpWordPhrase` 가 `mode:'word'` 를 빼고 호출 | 잡힘(6건) |
→ 12개 중 **10 잡힘 · 2 생존**. 개발자 표(19/19)와 겹치지 않는 변이를 골랐다.

## QA 가 실제 HTTP 로 확인할 high_risk_areas
서버를 띄워 쿠키 세션(QA 계정)으로 `POST /api/v1/words/phrase-help` 를 친다. 프로필·DB 는 읽기만(운영 쓰기 금지).
1. **401**: 쿠키 없이 → 401 `UNAUTHENTICATED`(L-2: 소스 스캔만 있던 부분). 같은 요청이 세션 있으면 200.
2. **400 은 한도를 쓰지 않는다**: 잘못된 본문(빈 `{}`·`{"queryKo":"abc"}`·101자·`{"queryKo":"가","mode":"word"}`·배열·1KB 초과·JSON 아님)을 12번 이상 보낸 뒤 정상 호출이 10번 연속 200.
3. **429 + `Retry-After`**: 1분 안 11번째 → 429, 응답 헤더 `Retry-After` 와 `data.details.retryAfterSec` 일치. **#180(`/chats/:id/phrase-help`) 호출과 합산**(둘을 섞어 10회).
4. **409 `PHRASE_BUSY` 양방향**: 같은 세션에서 두 요청을 동시에(엔진 2~3초) — #181+#180, #180+#181, #181+#181 중 하나는 409 `CONFLICT/PHRASE_BUSY`, 끝나면 풀림. 다른 계정은 영향 없음.
5. **취소**: `curl --max-time 0.5` 등으로 끊은 직후(2~3초 안) 같은 세션 재호출이 `PHRASE_BUSY` 로 오래 걸리지 않는지(엔진이 끊기면 잠금 해제) · 서버 로그에 500/스택 없음.
6. **응답 모양**: 200 본문에 `labelKo`·`whyKo` 키 없음, 헤더 `Cache-Control: private, no-store`, 엔진명·model 문자열 0(본문·헤더·오류 봉투).
7. **단어 모드 결과**: `임팩트`→インパクト(가타카나) · `어색하다` · `귀찮다` · `눈치` · `설레다` 등에서 `ja` 가 사전형 표제어, 후보 ≤3. **정형 인사 `감사합니다`·`죄송합니다` 는 현재 502(M-1) — 수정 전에는 기대값을 502/빈 결과로 기록**.
8. **원문 미기록**: 호출 뒤 서버 로그(pm2/dev 로그)와 `RequestTrace`(최신 행 `refType='phraseHelp'`, `refId` null, `kind='TURN'`, `steps[].mode='word'`·`promptVersion='phraseHelp@v2'`)에 질의·표제어·뜻이 없는지. 비밀 값 출력 금지.
9. **회화방 회귀**: 같은 세션으로 #180 호출 — 후보 ≥2 면 `labelKo`, 첫 후보에 `whyKo` 가 그대로 오는지, `PHRASE_BUSY`/`ENDED`/404 가 이전과 같은지.
10. **엔진 오류 502/504**: 실제로 만들기 어렵다(in-process 로만 확인) — QA 가 가능한 경우만(엔진 일시 중지 등 운영 영향 없는 방법), 아니면 「미검증, 단위·in-process 로 대체」로 기록.

## 알려진 한계 재확인 (developer 기록 §7)
1~6 동의. 7 항목 확인 결과: ① `helpPhrase` 재배치 외부 동작 불변(위 (1)) ② 검사·등록 같은 틱(현 코드 OK, 시험 없음 → L-1) ③ 라우트 순서 OK ④ `stepExtra` 가 회화 Trace 에 새지 않음(`stepExtra` 미전달 → 키 없음, (1)에서 Trace 키 동일) ⑤ 문서 #181 행과 코드 일치(순서·한도·헤더·응답 모양·번호 모두 일치).

## 커밋 시 주의 (Leader)
- 이 서버 부분 변경은 6개 수정 + 신규 라우트·시험·픽스처·하네스이며 다른 task 파일과 겹치지 않는다. `.obsidian/` 는 이 작업과 무관한 미추적 — **스테이징 제외**. 명시 경로 스테이징 권장.
- 미러: `~/.node-local/thekaiwa-rev072s`(저장소와 동일, QA 가 재사용 가능) · `~/.node-local/thekaiwa-rev072s-mut`(변이용, 정리 가능). 재현 시험 3개·변이 스크립트는 세션 스크래치패드 `scratchpad/rev072s/` (저장소 밖).

---

## 재감사 (REV-072S2) — **중간 기록 (turn ~31, 최종 판정 전)**

범위: REV-072S 이후 보완 라운드(`NOT_A_WORD`)만. 제품 코드 변경은 `structuredResponse/phraseHelp.ts` 3줄 + 주석, `chats/phraseHelp.ts` 주석 1줄뿐임을 **감사 직전 소스(두 미러 `thekaiwa-rev072s-mut`·`thekaiwa-dev072-sv` 의 md5 동일 = 내가 감사한 상태)와 `diff` 로 직접 확인**. `prompts/phraseHelp.ts` 는 md5 동일(변경 0).
- 확인 끝: ① 판정식(`every(r === 'JA_NOT_WORD')`·`reasons.length > 0` 가드·`kept.length === 0` 안에서만) ② 위반 조건(`(TOO_LONG ∥ NOT_A_WORD) && !lastAttempt`, `INVALID` 는 시도 무관 위반) ③ 서비스는 `fin.status === 'INVALID'` 만 던지므로 `NOT_A_WORD` → 200 `{items: []}`, Trace `status:'OK'`·`outcome:'NOT_A_WORD'`.
- 독립 대조(내가 새로 쓴 시험, 저장소 밖): 항목 종류 13종 × 길이 0~4 **30,941조합**을 독립 오라클(종류→이유 표)과 대조 — 단어 모드 상태 일치(OK 14,836 · INVALID 15,735 · NOT_A_WORD 340 · TOO_LONG 30), 이전 소스와 다른 경우는 flip 340건(정형 꼬리 4종 길이 1~4 조합)뿐. 회화 모드 8종 `mode` 값 × 30,941 = **247,528조합** 바이트 동일·`NOT_A_WORD` 0건. 비정상 응답 형태 17종 × 9 mode 동일.
- developer 의 차분 시험(`_diffprev072fix.test.ts`) **직접 재실행** 통과: 회화 336,000조합 · prompts 280 · 단어 flip 1,904/동일 40,096 · `helpWordPhrase` flip 72 — 보고 수치와 일치.
- 증빙: tsc 0 · eslint 0 · conversation 1,260/0 · 전체 4,211 중 4,209 통과·실패 0·건너뜀 2 (developer 보고와 동일). build·변이·실호출·라우트 in-process 는 이 블록 뒤에 이어 적는다.

## 재감사 (REV-072S2) — **최종 판정**

### 판정: **PASS_WITH_NOTES** (스키마 기준 PASS — Critical 0 · High 0 · Medium 0 · Low 4) · `native_change: false` · Codex 검토 기록 없음(해당 없음) · 화면 코드 0줄(데모 게이트 대조 해당 없음)

### 불편한 사실 먼저
1. [확실] **M-1 은 「고쳐진 것」이 아니라 「오류를 빈 결과로 바꾼 것」이다.** 502 가 사라진 대신, 모델이 고장나 표제어 대신 문장형만 반복해도 화면은 오류가 아니라 「못 찾음」 빈 결과를 본다. 감사 실호출에서 정형 인사 질의는 **언제나 모델 2회**(재시도 유지, Leader 결정)를 쓰고 **4.5~4.7초 뒤** 빈 결과로 끝난다(developer 실측 최대 6.3초). 12초 한도 안이고 계약상 맞지만, 운영에서는 Trace `outcome=NOT_A_WORD` 비율을 봐야 모델 품질 저하를 알 수 있다(L-6).
2. [확실] **X2(라우트 `await requireSession()` 의 `await` 제거)는 이번에도 시험이 못 잡는다**(생존). 소스 스캔 시험의 한계 그대로 — QA 가 실제 HTTP 401 을 반드시 확인해야 한다(L-2 유지).
3. [확실] `NOT_A_WORD` 는 「정형 인사」만이 아니다: 꼬리 없는 17자 이상 긴 복합어·쉼표/부호가 든 한 항목도 `JA_NOT_WORD` 뿐이면 같은 경로(200 빈 결과)다. Leader 결정(「이유가 JA_NOT_WORD 뿐」)의 범위 안이지만 문서·주석은 「정형 인사」로만 설명한다(L-7).

### 확인 항목별 결과
1. **판정 정확성 — 통과.** `fitPhraseHelp` 는 `kept.length === 0` 안에서만 `isTooLongOnly ? TOO_LONG : isNotWordOnly ? NOT_A_WORD : INVALID`. `every`(+`length>0`) 이므로 하나라도 다른 이유가 섞이면 INVALID, 일부라도 표제어가 남으면 OK(부분 성공 불변, `itemsDropped` 만 증가). `dropped` 와 `kept` 합이 `itemsRaw` 와 모든 조합에서 일치(30,941조합 단언). 빈 입력·`status` 이상·`items` 모양 이상 17종은 모두 이전과 동일(NOT_A_WORD 0건). `isTooLongOnly` 와 `isNotWordOnly` 는 이유 집합이 서로소라 삼항 순서는 동치(변이 불필요). `reasons.length > 0` 가드는 `kept=0 && rawItems>0` 에서 항상 참이라 도달 불가(동치 변이).
2. **회화 모드 불변 — 통과.** 제품 코드 diff 전수 확인: `structuredResponse/phraseHelp.ts` 는 타입 유니온 1개·`isNotWordOnly` 1개·분류 삼항 1줄·`phraseHelpViolations` 조건 1줄 + 주석, `chats/phraseHelp.ts` 는 **주석 1줄**, `prompts/phraseHelp.ts` 는 md5 동일(변경 0). `JA_NOT_WORD` 는 `word &&` 안에서만 추가되므로 회화 모드에서는 이유 집합에 없어 새 상태가 나올 수 없다. 대조 기준 소스는 두 미러(`thekaiwa-rev072s-mut`·`thekaiwa-dev072-sv`)의 md5 가 일치하는 「내가 감사한 상태」. 결과: 회화 모드 8종 `mode` 값 × 30,941 = **247,528조합** `fit`·`violations`(5종 시도 정보)·`trace`·`items` 바이트 동일, developer 차분 시험(`_diffprev072fix`) **직접 재실행** 회화 336,000조합·prompts 280·단어 flip 1,904/동일 40,096·`helpWordPhrase` flip 72 — 보고 수치와 정확히 일치. 단어 모드의 이전 대비 차이는 flip(「이전 INVALID·이유 JA_NOT_WORD 뿐」) 340건(정형 꼬리 4종 길이 1~4 조합)뿐.
3. **서비스·라우트 — 통과.** 서비스는 `fin.status === 'INVALID'` 만 던지므로 `NOT_A_WORD` → `{items: []}`. 실제 핸들러(in-process, `requireSession` 에만 미러 전용 훅) + **진짜 `runJsonWithRetry`·ajv·요청 extraCheck**: ① 정형 인사 두 번 → 200 `{success:true,data:{items:[]},message:null}`·`Cache-Control: private, no-store`·모델 호출 정확히 2회·Trace `status OK / outcome NOT_A_WORD / dropReasons JA_NOT_WORD / attempts 2 / mode word / refId null`·Trace·로그에 질의·표제어 원문 0·엔진명 0·이어서 정상 호출 200(잠금 해제) ② 정형 + 한글 ja 섞임 → 재시도 뒤 502 ENGINE_ERROR(모델 2회, Trace ERROR, 잠금 해제) ③ 첫 응답 정형·재시도가 `ありがとう` → 200 표제어 1개 ④ NOT_A_WORD 도 한도를 정상 소모(11번째 429) ⑤ #180 회화방에서 같은 정형 응답은 항목 그대로·`NOT_A_WORD` 없음·`mode` 키 없음. 이전 감사자의 라우트 시험 8개(401/200 모양/400 10종/429 합산/하루 300/409 양방향/502·504·거절/취소)도 변경 없이 통과 — 총 13/13. **5초 예산 의견**: 정형 인사는 설계상 모델 2회라 4.5~6.3초(5초 예산 초과 가능, 12초 한도 안). 재시도를 줄이면 `ありがとう` 를 건지는 사례를 잃으므로(developer 실측 1/4) Leader 결정(재시도 유지)을 존중하되, 화면 쪽 로딩 문구가 5초 넘는 대기를 견디는지는 화면 단계에서 볼 일.
4. **시험의 질 — 통과.** 옛 기대값 4곳 갱신은 정당하다: 「문장만 있으면 INVALID/마지막 시도도 위반」 → 「NOT_A_WORD/마지막 시도 데이터」로 바꾸되 **같은 자리에 「다른 위반이 섞이면 마지막 시도에서도 위반(502)」 단언을 새로 둬** 약화가 아니라 갈래 분리다(`mixed` 단언·섞임 14종·서버 502 3종). 새 시험 3종(진짜 재시도 루프 3·동시성 2)은 모델 호출 횟수·Trace attempts·경고 문구 무원문까지 단언한다. 아래 변이로 동작 검증.

### 직접 한 변이 (새 변이 미러 `~/.node-local/thekaiwa-rev072s2-mut` = `cp -al` 후 파일 rename 교체·매번 원본 복원, 판정 4개 시험 파일 99건)
| # | 변이 | 결과 |
|---|---|---|
| N0 | 변이 없음(기준) | 99/99 통과 |
| N1 | `every` → `some` (이유 중 하나만 JA_NOT_WORD 여도 NOT_A_WORD) | 잡힘(4건) |
| N2 | 이유 집합 검사 제거(0개 + 길이 아님이면 전부 NOT_A_WORD) | 잡힘(13건) |
| N3 | `isNotWordOnly` 가 JA_TOO_LONG 섞임까지 허용 | 잡힘(1건 — 섞임 14종) |
| N4 | 첫 시도 위반에서 NOT_A_WORD 제외(재시도 안 함) | 잡힘(5건) |
| N5 | 마지막 시도에서도 NOT_A_WORD 가 위반(502 되돌림) | 잡힘(3건) |
| N6 | 서비스가 NOT_A_WORD 를 502 로 던짐 | 잡힘(2건) |
| N7 | Trace outcome 이 NOT_A_WORD 를 `OK` 로 숨김 | 잡힘(3건) |
| N8 | `lastAttempt` 경계 `>=` → `>` | 잡힘(4건) |
| N9 | 시도 정보 생략을 마지막 시도로 취급 | 잡힘(3건) |
| N10 | `JA_NOT_WORD` 검사가 회화 모드에도 걸림(`word &&` 제거) | 잡힘(23건) |
| X1 | 잠금 `has()`·`add()` 사이 `await`(원자성 상실) — **직전 감사 때 생존** | **잡힘(2건 — 이번에 추가한 동시성 시험)** |
| X2 | 라우트 `await requireSession()` 의 `await` 제거 | **생존(99/99)** — 소스 스캔 한계, 아직 시험 없음 → L-2 유지 |
→ 12개 중 **11 잡힘 · 1 생존(X2)**. 동치 변이(`length>0` 가드·삼항 순서)는 실행하지 않고 논증으로 갈음.

### 지적 (Critical 0 · High 0 · Medium 0 · Low 4)
| # | 심각도 | 위치 | 내용 | 권고 |
|---|---|---|---|---|
| L-2(유지) | Low | 라우트 시험이 소스 정규식 스캔뿐 | X2 생존. 인증 `await` 누락을 단위 시험이 못 잡는다(미러 in-process 로는 401 확인 — 위 13/13 의 401) | QA 실제 HTTP 401 확인 필수. 장기: `requireSession` 시험 주입 seam |
| L-6 | Low | `chats/phraseHelp.ts` `runPhraseHelp`(운영 관측) | 502 → 200 빈 결과 전환으로 「모델이 문장형만 반복」 같은 품질 저하가 화면 오류가 아니라 빈 결과로 보인다. Trace `outcome=NOT_A_WORD` 만 단서 | 관리자 쪽에서 `PHRASE_HELP` 단계 `outcome` 비율을 볼 수 있다는 점을 운영 메모에 한 줄(후속, 코드 변경 아님) |
| L-7 | Low | `chats/phraseHelp.ts` 머리 주석 :10 · `prompts/phraseHelp.ts` `finalizePhraseHelp` 문서 주석 | 「`NOT_A_PHRASE`·`UNSAFE`·`TOO_LONG` → 빈 목록」에 `NOT_A_WORD` 가 빠져 있고, `JA_NOT_WORD` 뿐이면 17자 이상 긴 표제어·부호 포함 항목도 같은 경로라는 설명이 없다(코드 영향 0). `api-contract.md` #181 행은 「거절·못 찾음도 `items:[]`」라 모순 없음 | PE/Leader 가 주석 한 단어, 계약 행에 「(정형 표현으로 표제어가 0개면 502 가 아니라 빈 목록)」 한 구절(선택) |
| L-8 | Low | 직전 감사 L-3~L-5(유지) | 프로필 upsert(저장 없음이 엄밀히는 아님)·`labelKo` 화면 문서·한도 상수 중복 — 이번 라운드 범위 밖, 변화 없음 | 직전 기록 그대로 |

해소: **M-1(Medium)·L-1(Low)** 해소 확인. 엔진명 누출 0(응답·Trace·로그·새 주석/문서 문구, 실호출 하네스도 「엔진명 누출 0」).

### 증빙 숫자 대조 (미러 `~/.node-local/thekaiwa-rev072s` = 저장소 `src/`(app·components 제외, 두 폴더는 저장소와 동일 확인)·`tests/`·`package.json` 동기화, `diff -rq` 동일)
| 항목 | developer 보고 | 이번 재실행 |
|---|---|---|
| `tsc --noEmit` | 0 | **0** |
| `eslint src/modules/conversation src/app/api/v1/words tests/prompts` | 0 | **0** |
| conversation 시험 | 1,260 / 0 | **1,260 통과 / 0 실패** |
| 전체 시험(`--test-concurrency=1`, 가짜 DATABASE_URL) | 4,211 중 4,209 통과·실패 0·건너뜀 2 | **4,211 중 4,209 통과·실패 0·건너뜀 2**(134초) |
| `next build` | exit 0 | **exit 0**(`.next` 를 프로젝트 밖으로 `mv` 한 뒤 새로 빌드, 출력 자르지 않음) — 라우트 목록에 `/api/v1/words/phrase-help`·`/api/v1/chats/[id]/phrase-help` |
| 실호출(`감사합니다`, 로컬 Claude CLI, DB·서버 접촉 0) | 200 빈 목록 / 200 표제어 | 2회 모두 **HTTP 200 · 빈 목록 · NOT_A_WORD · 시도 2 · 4.5~4.7초 · 502 0 · 엔진명 누출 0**(모델 호출 4회) |
숫자 전부 일치. 금지 준수: 커밋·푸시·배포·DB 쓰기·QA 서버(3011 포함)·운영 포트·`.env` 복사·`pkill` 모두 0, 다른 미러 무접촉(새로 만든 `thekaiwa-rev072s2-mut` 와 `thekaiwa-rev072s` 만 사용).

### QA 가 볼 곳 갱신 (직전 기록의 high_risk_areas 1~10 유지, 아래만 바뀜)
- **7번 기대값 변경**: 정형 인사(`감사합니다`·`죄송합니다`)는 **502 가 아니라 200 `{success:true,data:{items:[]},message:null}`** (또는 재시도가 `ありがとう` 를 건지면 200 표제어 1개). 소요 4.5~6.3초(모델 2회). `안녕하세요`·`잘 먹겠습니다` 는 모델이 `NOT_A_PHRASE` 로 거절해 2초대에 200 빈 목록.
- **새 확인**: 502 가 나오는 경우는 이제 「정형 꼬리 + 다른 위반 섞임」·엔진 오류뿐 — 재현이 어려우므로 in-process 확인으로 갈음하고 「미검증, 단위·in-process 대체」로 기록.
- **Trace 확인**: 정형 인사 호출 뒤 `RequestTrace` 최신 행 `status='OK'`, `steps[0].outcome='NOT_A_WORD'`, `dropReasons='JA_NOT_WORD'`, `attempts=2`, `mode='word'`, 질의·표제어 원문 0.
- **401(L-2)**: 쿠키 없는 실제 HTTP 호출 → 401 `UNAUTHENTICATED` (소스 스캔이 못 잡는 부분).

### 커밋 시 주의 (Leader, 직전과 동일 + 추가)
- 이 라운드 몫 파일: `structuredResponse/phraseHelp.ts` · `chats/phraseHelp.ts`(주석) · `__tests__/phraseHelpWord.test.ts` · `__tests__/task072WordHelpServer.test.ts` · `tests/prompts/{fixtures/phrase-help-word.json,phraseHelpWordCheck.ts,phrase-help-word-live.ts}`. 앞 라운드 미커밋과 같은 파일이므로 파일 단위 명시 스테이징(`git --literal-pathspecs add -- <경로>`), `.obsidian/` 제외.
- 정리 가능한 미러: `~/.node-local/thekaiwa-rev072s2-mut`(변이용, 이번 생성)·`~/.node-local/thekaiwa-rev072s-oldnext`(옛 `.next`). 재현 시험 3종·변이 스크립트·로그는 세션 스크래치패드 `rev072s2/` (저장소 밖).
