---
task_id: task-062
role: qa
tags:
  - type/record
  - domain/tech-debt
created: 2026-10-12
---

# task-062 QA 기록 — 운영 모드(`next start`) 재확인

이력서: [[task-062-cleanup-cancel-test-noise]] · reviewer 기록: [[task-062-rev-record]] · developer 기록: [[task-062-dev-record]]

## 판정

- **PASS** — 결함 0건, 수정 없음.
- 작업본에서 클라이언트가 끊은 요청(S1·S2·turns) 로그 **0줄**. 같은 요청을 HEAD `http.ts` 로 돌리면 **각 1줄**(대조군, 아래).
- 정상 요청(S3·S4) 응답 상태·봉투가 HEAD 와 **바이트 단위로 같음**.
- 확신: [확실] = 이번 세션에서 직접 실행한 결과. 끊김 응답의 「불변」은 관찰 불가라 [가능성 높음]으로만 적는다(아래).

## 환경

- 전용 미러 `~/.node-local/thekaiwa-qa062`. `KAIWA_LOCAL_ROOT=… bash scripts/sync-local.sh` 로 NFS 작업트리를 12:31 무렵 동기화(HEAD `3c5d281` + 미커밋 task-062 파일 3개 + 신규 시험 1개).
- `node_modules` 는 기본 미러에서 `rsync --link-dest` 하드링크. `.prisma`·`@prisma` 는 실복사 후 `prisma generate`. 기본 미러의 `prisma/schema.prisma` md5 가 NFS(`8f493d1b…`)와 달라(`75a5…`) 기본 미러 클라이언트는 쓰지 않았다. 미러 스키마 md5 = NFS 확인.
- 빌드: `node node_modules/next/dist/bin/next build` 를 미러에서 직접 실행. `npm run build` 는 package.json 이 `cd $HOME/.node-local/thekaiwa` 를 하므로 쓰지 않았다. 작업본 rc 0(완료 확인 12:32:46), 「warnings while optimizing」 0건.
- 기동: `next start -H 127.0.0.1 -p 3019`. `/api/health` 200. 로그 `$SP/qa062-server.log`.
- 쿠키: `tests/live/qa-session.ts`, `QA_ACCOUNT=1`(qa-bot@thekaiwa.test, USER), 1시간짜리. 기존 QA 행을 upsert(`update: {}`)로 재사용, 신규 생성 아님. 사용 후 파일 삭제.
- 대조군: 같은 미러에서 `src/modules/infra/http.ts` 만 `git show HEAD:…` 로 바꿔 다시 `next build`(rc 0, 12:36:26). HEAD 타입 검사를 위해 `task062ClientGone.test.ts` 를 미러에서만 치웠다(운영 코드 영향 없음). 첫 HEAD 빌드는 미러 안 `.next-work` 폴더를 Tailwind 가 스캔해 CSS 경고가 쌓여 rc 1 로 실패 → 폴더를 미러 밖으로 옮기고 재빌드. 실패 원인은 QA 환경이며 제품 결함이 아니다.
- HEAD 는 점검 시점 `3c5d281`(task-061 커밋). 이력서 base `b89d779` 와 다르다. 비교의 기준선은 「HEAD + 미커밋 task-062 3파일」이다.

## 시나리오 결과 (운영 모드, raw TCP 소켓)

| # | 요청 | 작업본 새 로그 줄 | HEAD 새 로그 줄 | 응답 |
|---|---|---|---|---|
| S1 | `POST …/phrase-help` · `Content-Length: 200` 선언 후 30바이트만 보내고 destroy | **0** (예외 0) | **1** `[api] 처리되지 않은 예외: Error: aborted` | 없음(수신 0바이트) |
| S2 | `POST …/phrase-help` · chunked 한 덩어리(30바이트) 후 destroy | **0** | **1** 같은 문구 | 없음(수신 0바이트) |
| S1-turns | `POST …/turns` · `Content-Length: 200` 선언 후 30바이트 destroy | **0** | **1** 같은 문구 | 없음(수신 0바이트) |
| S3a | `phrase-help` · 깨진 JSON `{"queryKo":` | 0 | 0 | **400** `VALIDATION` 「JSON 형식이 올바르지 않습니다.」 |
| S3b | `phrase-help` · `{}` | 0 | 0 | **400** `VALIDATION` `details{field:queryKo, reason:required}` 「하고 싶은 말을 한국어로 써 주세요.」 |
| S3c | `phrase-help` · 올바른 본문 + 없는 대화 id | 0 | 0 | **404** `NOT_FOUND` 「채팅을 찾을 수 없어요.」 |
| S4 | `phrase-help` · 올바른 본문, 쿠키 없음 | 0 | 0 | **401** `UNAUTHENTICATED` 「로그인이 필요합니다.」 |

- S3·S4 원문 응답을 작업본(`$SP/qa062-work-req.txt`)과 HEAD(`$SP/qa062-head-req.txt`)에서 저장해 `diff` → **빈 출력(동일)**. 봉투 `{success:false,data:{code},message}` 불변 [확실].
- 해석 [확실]: 작업본 0줄은 「요청이 `withApi` 본문 읽기에 닿지 않아서」가 아니다. 같은 요청이 HEAD 에서는 같은 조건으로 로그를 남긴다. 즉 제거된 것은 소음뿐이다.
- 끊긴 요청의 응답 불변은 직접 관찰 못 했다(응답을 읽을 소켓이 없다). 코드상 `toErrorResponse` 는 분류·상태를 바꾸지 않고 로그 한 줄만 건너뛴다 [가능성 높음].

## 기동 시 부작용 (공유 NAS DB)

- `src/instrumentation.ts` 는 기동 때 `sweepStalePending`·`jobs.sweepStaleJobs` 를 공유 DB 에 돈다(개발·운영이 같은 DB). 작업본·HEAD 두 기동 로그 모두 `[startup] stale 정리` 줄이 없었다. 코드는 0건일 때 줄을 찍지 않으므로 「정리 0건」으로 본다. 실패 경고도 없었다.
- DB 쓰기는 QA 쿠키 upsert(빈 update)뿐이다.

## 하지 않은 것 · 한계

- LLM 을 부르는 요청은 보내지 않았다(완전한 올바른 본문으로 대화가 있는 경우 미실행). 그래서 **SSE 스트림 도중 끊김(LLM 응답 중)은 미검증**이다. 코드 읽기 근거만 있다(REV-199 와 같은 한계).
- 브라우저의 실제 중단이 아니라 원시 TCP 소켓 destroy 로 재현했다.
- 살아 있는 요청에서 같은 `aborted` 문구가 로그 1회로 남는지는 **HTTP 수준으로 확인하지 않았다**. 근거는 단위 시험(감사 REV-199 ②~⑥)뿐이다.
- 운영 서버(3010)·개발 서버(3011) 접근 없음. DB 쓰기는 위 upsert 뿐. 소스 수정·`git add`·`commit` 없음.
- REV-199 F-1(LOW, 시험이 `components` 도구를 import) — QA 범위 밖, 판정 영향 없음.

## 정리 상태

- 프로세스: 작업본 서버(PID 3799903·워커 3799904)와 HEAD 서버(PID 3806990) 종료. `kill -0` 로 모두 사라짐 확인. `ss -ltn` 에서 3019 비어 있음.
- 쿠키: `$SP/qa062-cookie` 삭제.
- 미러 `~/.node-local/thekaiwa-qa062` (343MB) 는 **삭제하지 않음**(경로만 보고). 현재 `.next` = HEAD 빌드. 작업본 빌드 산출물은 `$SP/qa062-next-work`, 실패한 HEAD 빌드는 `$SP/qa062-next-head-failed`.
- 로그·스크립트(스크래치 `$SP` 안): `qa062-server.log`, `qa062-server-head.log`, `qa062-raw.mjs`, `qa062-work-req.txt`, `qa062-head-req.txt`, `qa062-build*.log`.
- 스크린샷·`/tmp/qa-artifacts` 산출물 0개.

## 결과 한 줄

S1·S2·turns 끊김 로그 작업본 0 / HEAD 1(×3), S3·S4 응답 HEAD 와 동일, 결함 0, PASS.
