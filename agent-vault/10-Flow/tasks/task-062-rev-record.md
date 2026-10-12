---
task_id: task-062
role: reviewer
tags:
  - type/record
  - domain/tech-debt
created: 2026-10-12
---

# task-062 Reviewer 기록

이력서: [[task-062-cleanup-cancel-test-noise]] · developer 기록: [[task-062-dev-record]]

## Reviewer 기록 (REV-199) — 최종

**판정: PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 0 · Low 1 · 정보 3. 차단 사유 없음. 감사 대상은 이력서 base `b89d779` 위의 미커밋 작업트리, 소스 수정 0(변이는 전용 미러 사본에서만, 매번 NFS 원본 복사 후 `cmp` 동일).

### 환경
- 전용 미러 `~/.node-local/thekaiwa-rev062` — `node_modules` 는 기본 미러에서 `rsync --link-dest` 하드링크(`.prisma` 만 `thekaiwa-predeploy` 실복사, 스키마 md5 `8f493d1b…` = NFS = predeploy), `KAIWA_LOCAL_ROOT=… bash scripts/sync-local.sh`. 기본 미러·predeploy·타 미러·포트 3010~3017 미접촉. 개발 서버는 포트 3018 만 사용하고 종료(포트 비움 확인). 쿠키는 QA4 1시간짜리, 사용 뒤 삭제. LLM·DB 쓰기 0.
- 다른 세션(task-060 `vocab/**`·task-061 `talk/**`·`docs/screens.md`)의 미커밋 파일이 함께 sync 되지만 tsc·전체 시험·build 모두 통과해 구분할 실패 없음.

### 재현 수치
| 항목 | 결과 |
|---|---|
| eslint (변경·신규 14파일) | rc 0, 출력 0 |
| `tsc --noEmit` | rc 0, 0줄 |
| 새 시험 `task062ClientGone`(9)+`task062SharedCancel`(3)+`scenario/__tests__/*` | 176/176 |
| 전체 `node --import tsx --test --test-concurrency=1 $(find src scripts/seed-build -name '*.test.ts')` | **3371 tests · pass 3370 · fail 0 · skipped 1**(developer 수치와 동일, 228s) |
| `next build` (출력 파일로) | rc 0, `BUILD_ID` 생성 |
| 변이 | 아래 13건 모두 새 시험이 실패로 잡음, 원복 `cmp` 13/13 동일 |

### 개발 서버 직접 재현 (포트 3018, `POST /api/v1/chats/nonexistent-rev199/phrase-help`, raw TCP)
- 같은 서버·같은 클라이언트 스크립트로 `http.ts` 만 바꿔 비교(미러 사본만).
  - **HEAD `http.ts`**: S1 `Content-Length: 200` 선언 후 30바이트만 보내고 소켓 destroy, S2 chunked 한 덩어리 후 destroy → `[api] 처리되지 않은 예외: Error: aborted` **2줄**(기준선이 소음을 실제로 낸다는 증명 = 끊긴 시점에 `req.signal.aborted === true` 가 성립).
  - **작업본 `http.ts`**: 같은 S1·S2 → **0줄**. S3(깨진 JSON 전체 본문) 400 `VALIDATION`「JSON 형식이 올바르지 않습니다.」· S4(`{}`) 400 `queryKo required` · S5(정상 본문·없는 대화) 404 `NOT_FOUND` — 세 응답의 상태·봉투가 HEAD 와 **글자까지 같음**, 서버 로그에 새 줄 없음.
  - `turns`(SSE 라우트)·`reply-practice` 도 본문 중 끊기 → 로그 0(라우트 도달은 접근 로그로 확인).

### 감사 항목별 결과
1. **`withApi` 소음 정리 (공용 인프라)** — `http.ts:96-103` 조건은 `req?.signal?.aborted === true` **그리고** (`message === 'aborted'` **또는** `name === 'AbortError'`) 뿐, `code` 단독 갈래 없음(Leader 추가 지시 반영 확인). [확실]
   - 오류를 숨기지 않음: 신호 살아 있는 같은 문구·`AbortError`, 신호 없는 호출(`{}`·`undefined`·`null`·`signal` 없는 요청), `code` 만 `ECONNRESET` 인 상류형 오류(message 가 `socket hang up`·`read ECONNRESET` 등), 일반 예외, 문자열 throw 는 모두 로그 1회+기존 500. `ApiError`·엔진 오류 이름은 처음부터 로그 대상이 아니라 불변. 시험 ①~⑥ + 변이로 확인. 코드 읽기로도 `opts.clientGone` 은 `INTERNAL` 분기의 로그 한 줄만 건너뛴다. [확실]
   - 응답 형식·상태·`classifyError`·`withApi` 시그니처·반환 불변: `toErrorResponse` 두 번째 인자는 선택(기본 `{}`), 호출처는 `http.ts` 자신 + `index.ts` 재수출 + 시험뿐(`grep -rn` 확인, 앱 코드 다른 호출처 0). `withApi` 의 비라우트 언급은 주석뿐. [확실]
   - **SSE/스트리밍**: `sseResponse` 는 `Response` 를 즉시 돌려주고 스트림 작업 예외는 자체 `[sse] 스트림 작업 예외` 로거로 처리 — `withApi` catch 는 Response 반환 전(본문 읽기·권한·검증)만 감싼다. 이번 변경은 그 catch 안의 판정이라 스트림 중 오류 경로를 건드리지 않는다. 라우트 실측은 본문 중 끊기 한 갈래만 했다(진행 중 SSE 스트림 도중 끊기는 LLM 호출이 필요해 하지 않음 — 코드 읽기 근거). [가능성 높음]
   - 'aborted' 던져지는 위치: `readBodyCapped` 의 `reader.read()` — 위 재현으로 직접 확인(HEAD 에서 로그 발생·작업본에서 0). 본문을 다 받은 뒤 처리 중 끊김은 오류 자체가 없다(dev 기록 ③과 일치). [확실]
2. **취소 판정 통합** — `git diff` 삭제 두 줄(`isAbortError`·`cancelledError`)과 `requestCancel.ts:11-14` 정의가 글자 그대로 같음(`name === 'AbortError'`, `new ApiError('CONFLICT','요청이 취소됐어요.',{reason:'CANCELLED'})`). 세 서비스(`replyPractice:25`·`openingDraftRun:23`·`phraseHelp:24`)가 `./requestCancel` 에서 import, 취소 분기 모양 동일(`signal?.aborted === true && isAbortError(e)` → `throw cancelledError()`). 같은 `chats/` 폴더 내부 import 라 `index.ts` 우회·6층 위반 없음, 순환 import 없음(`requestCancel` 은 `@/modules/infra` 만). [확실]
3. **시험 9파일 이동** — 9파일 diff 의 삭제/추가 단언 0(import·읽기 줄만 교체, 단언 본문 불변), 중복 제거 정규식(`roomFlow`·`variant*` 자작 `stripComments`)만 삭제. 모든 양성 단언이 실제 코드에서 통과(주석에 기댄 단언 없음 — 전체 시험 통과). `roomRender.test.ts:279` 를 원문으로 둔 판단은 타당: 「scenario/rolePlay 참조 없음」 부정 단언이라 주석 속 이름도 실패시키는 쪽이 더 엄격하고 주석으로 없던 참조를 숨길 수 없다.
   - **무작위 아닌 직접 재현 4건**(옛 HEAD 시험 vs 새 시험, 같은 변이 소스, 미러 사본): R1 `TalkRoom` srMsg state 줄 `//` → 옛 10/0 통과·**새 9/1 실패** · R2 `useRolePlay` `setSheet(...)` → `/*…*/` → 옛 18/0·**새 17/1** · R3 `LessonEnd` 카드 → `{/* */}` → 옛 6/0·**새 5/1** · R4 `VariantDraftScreen` `<DraftEditor …/>` 감싸기 → 옛 4/0·**새 2/2**. 변이 전 기준선은 옛·새 모두 통과. 즉 developer 의 「옛 시험 거짓 통과·새 시험 실패」 주장 재현됨.
4. **새 시험 품질** — `task062ClientGone` 변이 6건 모두 실패로 잡힘: H1 신호 조건 제거 · H2 `code` 갈래 되돌림(좁히기 보호) · H3 message 정확→`includes` · H4 `clientGone` 무시 · H5 신호 조건 반전 · H6 `withApi` 가 `clientGone` 미전달. `task062SharedCancel` 변이 3건 모두 실패: C1 `phraseHelp` import 주석 + 자체 재정의 · C2 `openingDraftRun` 분기에서 신호 검사 제거 · C3 `isAbortError` 를 느슨하게.
5. **범위 이탈 없음** — 변경 소스는 지시 목록뿐(`phraseHelp`·`requestCancel`·`http.ts`, 시험 9+2파일). 다른 `git status` 항목(`talk/**`·`vocab/**`·`docs/screens.md`)은 task-060/061 몫이고 `docs/screens.md` 에 task-062 언급 0. 응답·화면·계약 변경 없음.

### 발견 사항
| # | 심각도 | 위치 | 내용 | 권고 |
|---|---|---|---|---|
| F-1 | LOW | `src/modules/conversation/__tests__/task062SharedCancel.test.ts:10` | `src/modules/**` 시험 중 유일하게 `src/components/__tests__/sourceCode` (UI 층 시험 도구)를 import 한다. 시험 전용이라 번들·런타임 영향 0이고 eslint 도 통과하지만, 「하위 층이 상위 층 import」 선례가 된다. | 후속 정리에서 `sourceCode.ts` 를 중립 위치(예: `src/test-utils/`)로 옮기거나, 이 시험에서만 `typescript` 로 직접 읽기. 지금은 차단 사유 아님. |
| I-1 | 정보 | `http.ts:96-103` | 소음 판정이 로그를 아예 건너뛰므로 「사용자가 느린 호출을 끊는 빈도」가 `pm2-err.log` 에서 안 보이게 된다. 운영 로그에는 2026-09-30 이후 1건뿐이라 실익도 위험도 작다. | 필요하면 나중에 카운터·`RequestTrace` 로. 지금은 조치 없음. |
| I-2 | 정보 | `resultLogic.test.ts:196-204`·`roomFlow.test.ts:285-286` | 이 두 곳의 부정 단언도 이제 주석을 걷은 소스를 본다(`roomRender:279` 는 「부정 단언은 원문이 엄격」 근거로 원문 유지). 실행 코드의 금지 참조는 여전히 잡고 주석 속 이름만 더는 실패시키지 않아 약화는 아니나, 두 방침이 섞였다. | 방침 문서화 정도. 조치 불필요. |
| I-3 | 정보 | dev 기록 | 「8 test」는 Leader 추가 지시로 9개가 됐다(요약 문구만 낡음). 기능 영향 0. | 없음. |

### 확인 못 한 것
- 진행 중 SSE 스트림(LLM 호출 중) 도중 끊기의 서버 로그 — LLM 호출 없이 재현 불가라 코드 읽기(`sse.ts` 자체 catch, `withApi` 바깥)로만 판단.
- 운영 환경(blue/green, nginx 경유)에서 끊김 시점의 `req.signal` 거동 — 개발 서버(`next dev` Turbopack)에서만 확인. Next 의 `next start` 에서도 같은 조건인지는 QA 가 `next start` 로 1회 확인하면 확실해진다. [추측: 같다]
- 하나의 요청에서 클라이언트 취소와 진짜 서버 결함이 동시에 일어나 둘 다 'aborted' 로 보이는 경우 — 구분 불가(수용 가능한 한계).

### QA 인계 (high_risk_areas)
- `withApi` catch 경로의 abort 로그 판정(`http.ts`) — QA 는 `next start` 로 같은 S1/S2 재현과 정상 요청 응답 불변 1회.
- native_change: false.
- Sonnet 반려 횟수: 0(Opus 승격 권고 없음).
