---
tags:
  - type/review
  - domain/ask
task: task-064
reviewer: REV-064-S (S1·S2·S3 + Leader 마무리)
status: 완료 (PASS_WITH_NOTES)
---
# REV-064-S1 — task-064 「/ask 3a」 서버 구현 감사 (중간 기록)

## 중간 (약 44턴)

확인 완료: recordRetrieval 전 파일(types·index·assemble·sources·text·range), askRouter(readers·classify), prompts/ask·askResponse, orchestrator/ask·index(startTurn·acceptTurnTx)·locks·stream, chats/{askLimits·validate·index·translation·askView}, `_lib/turnRoute`·`turns/route`·`chats/route`, claudeCli.ts 디코더 diff, 클라이언트 HTML 싱크 grep.

발견(잠정):
- [Medium] `sanitizeAskAnswerMd` HTML 태그 제거가 **단일 패스** — `<<<b>b>script>…` 3중 중첩은 `parseAskResponse`+`finalizeAnswerMd` 두 번 통과 뒤에도 `<script>` 로 재구성(복사한 정규식으로 확인). `<img src=x⏎onerror=…>` 처럼 태그 안 줄바꿈도 그대로 남음. 클라이언트가 텍스트로만 그려 실제 XSS 는 아님(AnswerMarkdown 에 HTML 싱크 없음).
- [Medium] ASK 가 `interactive` 레인(회화·채팅과 같은 FIFO, 동시성 1) — ASK 실행 중 다른 사용자의 회화·채팅 턴이 같은 큐에서 기다림. ASK_BUSY 는 ASK 끼리의 줄만 막는다.
- [정보] 스냅샷 게이트 test=1 은 스냅샷 산출물 문제로 보임(ask.json 누락·삭제된 `ask/page.tsx` 미삭제) — 검증 예정.

다음에 볼 항목: 스냅샷 게이트 2건 재현(실제 작업 트리 기준), 변이 샘플 ≥6, 나머지 시험 품질(askApi·askTurn·askRouteGuard), 로그/Trace 본문 grep, 엔진명 누출 grep.

## 중간 2 (REV-064-S2, 신규 소환, 약 25턴)

**게이트 대조(DONE 확인, 스냅샷 미러 `thekaiwa-rev064`)**: sync=0 · tsc=0 · eslint=0(경고 기존 `DiagnosticsScreen.tsx` 1건) · test=0 — `tests 3719 / pass 3718 / fail 0 / skipped 1`(skip = `#9 실제 배포 manifest`, 미러에 `speech/models` 없음 — 기존·ASK 무관) · build=0. 개발 기록과 같음(이전 1차 실패는 스냅샷 산출물 문제로 해소).

**이번에 확인한 것**: sanitizeAskAnswerMd 전체 + 적대 입력 직접 실행(39종, 스크래치 복사본 tsx), askLimits·locks·turnRoute·orchestrator startTurn/ask.ts 전체, prompts/ask.ts 전체(비신뢰 구역·이스케이프), recordRetrieval/{index,sources,assemble}·askRouter/{readers,index}, validate.ts(#28·#32·`assertNotAskRoom`), 다른 종류 라우트 차단(review=CHAT 아니면 400 · phrase-help/reply-practice=TALK 아니면 404 · scenario/finish=TALK+scenarioId 아니면 400 · translation=`assertNotAskRoom` 400), claudeCli 큐(interactive FIFO 동시성 1).

**잠정 결론**
- [해소] S1 Medium(`<<<b>b>script>` 중첩·태그 안 줄바꿈): 중첩 2~5중·줄바꿈·속성 안 `>`·대소문자·쪼갠 스킴(`java<b>script:`·`java\`script:`)·ZWSP 스킴·중첩 링크·`![](data:)`·20만 자 병리 입력 10종(최대 31ms) 모두 위험 표지 0·멱등. 병리 입력(깊이 40 중첩 링크)에서 `](` 글자가 남는 경우만 있으나 스킴·태그는 0이고 클라이언트가 링크를 안 그림 → 정보.
- 잔여 Low: `x<y … ->` 처럼 영문자 앞 `<` 뒤 같은 문단 안 `>` 까지가 태그로 지워짐(문단 한정, 한국어 설명에서 드묾).
- [Medium 유지] ASK `interactive` FIFO — `tasks.ts:31` ask=interactive·120s, `claudeCli.ts:681-708` 단일 `interactiveQueue`·동시성 1(비선점).
- 한도 저장소 = `globalThis` 메모리, `ecosystem.config.js` instances:1 → 단일 프로세스에선 원자적(동기 함수). 재시작·배포 때만 초기화.

**다음에 볼 항목**: 시험 품질 + 변이 샘플 ≥6(미러), claudeCli StringDecoder·warm pool 영향, 클라이언트 AnswerMarkdown(HTML 싱크 0), askView/#29 DTO·#27 preview, 로그/Trace 본문 grep, 엔진명 grep, classify.ts(분류), dev-fx2 sources 변경, 6층 import 경계.

## 중간 3 (REV-064-S3, 신규 소환, 약 30턴) — 변이 샘플 진행 중

**방법**: 스냅샷 미러 `~/.node-local/thekaiwa-rev064`(게이트 DONE) 안 소스 1곳씩만 바꿔 해당 시험 파일만 실행, 매번 `rev064-tree` 에서 복구(하네스 `finally` 복사). 실행 시간 파일당 <1초.
**지금까지 49건 중 죽임 41 · 생존 8**(생존은 아래에서 하나씩 분류). 죽인 것: 기록 조회 `userId` where 제거 8곳(진행 요약 레슨·복습·표현 찾기 레슨·능력 상태·출석·스냅샷·평가·주제별 레슨) · L2 교정/역할극 읽기 `userId`·`status:'ACCEPTED'`·설명 칸 select 추가 · 후보 단계 이중 방어(status·userId·역할극 mine) 제거(leaky 읽기 시험이 잡음) · 상황 제목 소유 조건 제거 · 레슨 `sourceText` select 추가 · 외부 DTO 에 `id`/후보 전체 추가 · 총 글자 상한·중복 제거 제거 · `sources[]` 의도별 type 필터 제거 · 분당 3→4·하루 60→61·진행 3→4 · 슬롯 release 무력화·슬롯 만료 제거·refund 의 release/분 되돌림 제거 · 라우트 refund/release 제거·ASK 분기 조건 변경 · 규칙 되묻기 단락 제거 · 이력 창 `userId` 제거 · 저장 PENDING 조건 제거 · 칩 범위 `prev.needsScope` 가드 제거 · GENERAL 건수 0 제거 · 범위 가드 제거 · 저장 직전 살균 제거 · FAILED 기록 제거 · 살균 단일 패스/URL/HTML/링크 제거 · 제안 `ADD_TOPIC` 허용(실제 분기 추가).
**생존 8건**: M5b(`S#` 키 정규식 완화)·M5c(`hasOwnProperty` 제거)·M5d(`!plan.length` 단락 제거)·M8a(`ASK_PROPOSAL_KINDS` 에 ADD_TOPIC 만 추가 — 분기가 없어 버려짐)·M8g(소스 라벨 60자 재절단)·M8h(되묻기와 제안 동시 — 파서가 이미 비움) = **동등 변이/이중 방어**(동작이 같다). 실제 시험 공백은 **M6f**(수락 전 실패 `refund` 가 하루 몫을 되돌리는지 단언 없음) · **M7c**(`turn.done.then(release)` 에 거절 처리기 없음 — `done` 이 거절되는 경로 시험 없음) · **M8d**(`loadAskPrev` where 의 `userId` 제거 — 이력 창(`loadAskHistory`)은 시험이 잡는데 형제 함수는 단언 없음) 3건 = Low.

**항목 2(본문 유출)**: `orchestrator/ask.ts`·`prompts/ask*.ts`·`chats/ask*.ts`·`askRouter/*`·`recordRetrieval/*`·`turnRoute.ts` 의 `console.*`/로거 0건(orchestrator 3곳은 `e.name` 만), Trace 단계는 숫자·불리언·식별 키(`askParseTrace` 확인), `toolLog.ask.sources[].label` 은 저장 직전 60자 절단(`ask.ts:473`)+읽을 때도 절단(`askMetaFromToolLog`). 남은 확인: 엔진 쪽 `[json]`/`[claudeCli]` 경고 줄.

## 최종 판정 (REV-064-S, Leader 정리 — S3 가 60턴 한도에서 끊겨 남은 항목은 Leader 가 읽기 전용 grep 으로 직접 확인)

**판정: PASS_WITH_NOTES** (Critical 0 · High 0 · Medium 2 중 1 해소·1 수용 대기 · Low 4 · 정보 다수)

| ID | 심각도 | 내용 | 처리 |
|---|---|---|---|
| S-1 | Medium | `sanitizeAskAnswerMd` 단일 패스 HTML 제거 — `<<<b>b>script>` 재구성 | **해소**(dev-san: 고정점 반복, 적대 입력 49종 위험 표지 0·멱등) |
| S-2 | Medium | ASK 가 회화·채팅과 같은 `interactive` FIFO(동시성 1, 비선점)를 공유 — 다른 사용자의 턴이 ASK 뒤에서 기다림 | **수용 대기** — QA 에서 지연 영향 실측 후 사용자에게 선택지(A 유지·B ASK 전용 레인·C 우선순위·D ASK 시간 단축) 제시 |
| S-3 | Low | 한도·전역 대기 슬롯이 프로세스 메모리(`globalThis`) — 재시작·배포 때 초기화(Codex C2 medium 과 같은 건) | **수용**(pm2 instances:1·초대제·사용자 재시작 경로 없음). 후속: DB 기반 집계 |
| S-4 | Low | 살균: 영문자 앞 `<` 뒤 같은 문단 안 `>` 까지가 태그로 지워짐(`x<y … ->`) | **수용**(문단 한정·한국어 설명에서 드묾) |
| S-5 | Low | 시험 공백 3건: M6f(수락 전 실패 refund 가 하루 몫을 되돌리는지)·M7c(`done` 거절 경로)·M8d(`loadAskPrev` where 의 `userId`) | 코드는 정상(M7c: `turn.done.then(release, release)` 양쪽 처리기 확인). **QA-A 가 M6f 를 라이브로 확인**(409 뒤 분당·하루 몫 불변). 나머지는 후속 시험 보강 |
| S-6 | Low | 병리 입력(깊이 40 중첩 링크)에서 `](` 글자가 남음 — 스킴·태그 0, 링크는 화면에서 그리지 않음 | 정보 |

**확인 완료(근거)**: 변이 49건 중 시험이 41건을 잡음(생존 8 = 동등 변이/이중 방어 6 + 시험 공백 S-5 계열) · 미러 복구 `rc=0`·저장소 소스 무변경 · 신규 ASK 코드(화면·`types/ask.ts`·L2 `askRouter`·`prompts/ask*`·`orchestrator/ask`·`chats/ask*`·`learning/recordRetrieval`) 엔진명 문자열 0건 · `recordRetrieval` 의 conversation/speech/engine import 0 · `askRouter`·`orchestrator/ask`·`chats/ask*` 의 `learning` index 우회 import 0 · 컴포넌트의 `@/modules` 직접 import 0 · 화면의 `window.Capacitor`·`fetch(` 0 · `dangerouslySetInnerHTML`·`innerHTML` 0(`answerMd.ts` 주석에만) · 외부 링크 0(근거 카드 `Link` 는 `askSourceHref` 고정 경로 템플릿 + `SAFE_ID` 정규식 + `encodeURIComponent`) · `claudeCli.ts` 경고 줄은 task·model·글자 수·시간만(본문 0)이고 이번 변경에서 추가된 `console.*` 0 · `turnRoute` 의 `turn.done.then(release, release)` 양쪽 처리기 · 한도 저장소 원자성(동기 함수·단일 프로세스).

**미확인(정직하게)**: classify.ts 의 실제 오분류율 — 시험 57건은 규칙 회귀일 뿐 운영 분포는 모른다(QA 라이브 표본과 운영 관찰로 본다) · 변이 샘플은 서버 쪽에 한정(UI 는 REV-U1/U2 가 별도).
