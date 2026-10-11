---
task_id: task-058
title: "기존 LLM 라우트 #169·#178 에 요청 취소 신호(req.signal) 전달 — task-056 서버 감사 REV-190 M1 의 동일 결함 정리"
status: review
base_ref: a834978
risk_level: "R1"
roles_involved: [leader, judge, developer, reviewer]
related_tasks: [task-056-improve-talk-phrase-helper, task-010d-scenario-roleplay, task-045-topic-scenario-manager]
tags:
  - type/task
  - domain/conversation
  - domain/tech-debt
aliases:
  - 취소 신호 전달
  - task-058
created: 2026-10-11
updated: 2026-10-11
---

# task-058 — #169·#178 에 `req.signal` 전달

## 사용자 요청 (원문)
- 2026-10-11 「이 작업을 여기에서 진행해 주세요: “Pass req.signal to LLM calls in #169 and #178”」 — task-056 서버 감사 중 Leader 가 올린 작업 제안 칩(task_3585d1ad)을 사용자가 수락.

## 관련 과거 이력 요약 (Leader 큐레이션)
- **발견**: task-056 서버 감사 [[task-056-rev-server-record]] REV-190 **M1** — 화면이 12초 시간 초과나 방 이탈로 요청을 끊어도 서버가 `req.signal` 을 엔진 호출에 넘기지 않아, 취소된 호출이 전역 직렬 CLI 큐 슬롯을 계속 점유하고(다음 회화 턴 지연 가능) 사용자당 동시 1건 잠금도 길게 유지된다. 감사가 같은 누락이 #169(`reply-practice`)·#178(`scenarios/openings/draft`)에도 있음을 grep 으로 확인(`req.signal` 없음).
- **참조 구현**: #180 도우미 — `src/app/api/v1/chats/[id]/phrase-help/route.ts`(`req.signal` 전달)·`src/modules/conversation/chats/phraseHelp.ts`(서비스가 `signal` 을 받아 엔진 요청에 싣고, `signal?.aborted === true && isAbortError(e)` 일 때만 조용한 409 `CONFLICT {reason:'CANCELLED'}` 로 끝냄, 잠금은 `finally`) + 시험(`task056PhraseHelp.test.ts`·`task056PhraseHelpRoute.test.ts`). 선례: `src/app/api/v1/vocab/sessions/route.ts`, #47 `CANCELLED`(`sessions.ts:473`).
- **알려진 한계(수용)**: 큐 대기 중 취소는 차례가 올 때 잠금이 풀린다(REV-192 L-R1). home-m4 폴백 분기는 신호를 받지 않는다.
- 승인된 교훈(`/이슈기록 관련 …`): 없음(task-056 에서 확인).

## judge 접수 (Leader 실행, `judge-result@2`)
- `feature` · 1.75 · R1 · developer=**sonnet** · standard. 입력·결과: 스크래치 `judge-058-intake*.json`.
- `demo=delta`(`next=demo_first`)는 **Leader override**: 변경 파일이 라우트·서비스·시험뿐이고 **화면 파일·문구·동작 변경이 없다**(UI 프로젝트 저확신 보수 판정 `DM-low-confidence` 오탐). 데모 게이트 불필요 — `check.mjs init` 하지 않음.

## 설계
1. 라우트 두 곳에서 `req.signal` 을 서비스로 전달(`suggestReply(userId, chatId, messageId, deps?, signal?)` — #180 처럼 기존 시험 호출을 깨지 않게 deps 뒤 선택 인자, `runOpeningDraft(userId, body, deps?, signal?)`).
2. 서비스가 `signal` 을 엔진 요청에 싣는다(`{...req, traceId, ...(signal ? {signal} : {})}`).
3. 취소 분기: `signal?.aborted === true && isAbortError(e)` 일 때만 409 `CONFLICT {reason:'CANCELLED'}` 로 조용히 끝낸다(오류 로그 소음·500 없음, Trace 에 `CANCELLED` 코드만). 그 밖의 오류는 기존 매핑(`engineFailure`/`classifyError`) 그대로. 잠금(`inFlight`)은 기존 `finally` 로 풀림.
4. 중복 정의를 늘리지 않도록 `isAbortError`/`cancelledError` 를 공용 위치로 옮길 수 있으면 옮기되, 6층·`index.ts` 규칙을 지킨다(어렵다면 서비스별 복사 + 사유 기록).

## 하지 않는 것
- 응답 형식·한도·오류 매핑·문구 변경, 새 오류 코드(`CANCELLED` 는 #47·#180 선례 재사용), home-m4 폴백 취소, 큐 대기 중 취소 시 잠금 즉시 해제(`Promise.race`), 화면 변경(화면은 이미 12초 abort 를 하고 있음 — 필요하면 별도), 스키마·네이티브.

## 완료 기준
1. 두 라우트에서 신호가 엔진 요청까지 전달됨을 시험으로 확인(진짜 `Request`+`AbortController`), abort 시 조용한 409 `CANCELLED`·`console.error` 0·같은 사용자의 즉시 재호출 200(잠금 해제), 신호가 살아 있는 `AbortError` 는 기존 매핑, 기존 시험 전부 통과.
2. eslint·tsc 0, reviewer 가 증빙 재실행·변이 3건 이상 확인.
3. 라이브 취소 동작(실제 fetch abort 가 `req.signal` 을 발화하는지, `claudeCli` 가 SIGTERM 하는지)은 서버가 떠 있을 때만 확인 가능 — task-056 QA-B 에서 #180 으로 확인하는 것과 같은 메커니즘이므로 결과를 인용하고, #169·#178 는 시험 수준 + 가능하면 스모크 1건.

## 상태 로그
- 2026-10-11 접수(base_ref `a834978`, 미커밋 task-056 파일과 겹치는 파일 없음). 다음: developer(sonnet) → reviewer.
- 2026-10-11 다른 세션과 협의: task-057(오늘의 단어 perf)은 `modules/learning/vocab/*` 만 건드려 겹침 없음. 그쪽 측정을 위해 QA1 계정에 기본 단어 7,755개가 심어져 있다 — 이 task 의 QA 는 QA1 의 `WordEntry`·`VocabSession` 행 수 대조를 하지 않거나 QA3/QA4 를 쓴다.
- 2026-10-11 구현(developer sonnet)·감사 REV-197 PASS_WITH_NOTES(L1 시험 보강 반영: abort 된 신호 + 엔진 시간 초과는 기존 매핑). 시험 13/13·회귀 1,183/1,183, 변이 16건 사망. 라이브 취소 동작은 task-056 QA-B/B2 가 #180 으로 확인한 메커니즘(실행 중 취소 후 자식 `claude` 종료 p50 579ms, 재호출 200). 2026-10-12 로컬 커밋 **`30b8b4c`**(사용자 지시) — 미 push·미배포. 후속: `isAbortError`·`cancelledError` 중복 통합(task-056 커밋 뒤), 배포 뒤 운영 nginx 경유 abort 전파와 `[claudeCli] 취소` 로그 확인.
