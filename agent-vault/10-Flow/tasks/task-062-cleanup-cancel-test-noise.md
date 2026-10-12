---
task_id: task-062
title: "후속 정리 — 취소 판정 도우미 통합·소스 검사 시험 5파일 공용 도구화·취소 시 서버 로그 소음 정리"
status: done
base_ref: b89d779
risk_level: "R1"
roles_involved: [leader, judge, developer, reviewer, qa]
related_tasks: [task-056-improve-talk-phrase-helper, task-058-cancel-signal-169-178]
tags:
  - type/task
  - domain/tech-debt
  - domain/conversation
aliases:
  - 취소 정리
  - task-062
created: 2026-10-12
updated: 2026-10-12
demo_gate:
  required: false
  level: "none"
  status: "not_required"
  version: 0
  repo_path: ""
  artifact_url: ""
  content_sha256: ""
  decided_by: "judge"
  rule_id: ""
  approved_by: ""
  approved_at: ""
  approval_quote: ""
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: false
---

# task-062 — 후속 정리 3건

## 사용자 요청 (원문)
- 2026-10-12 「C. 그렇게 해줘」 — 직전 점검 목록 (C)의 「코드·시험 후속」 정리(취소 판정 도우미 두 정의를 하나로, `scenario/__tests__` 5파일을 공용 `readCode` 로, 취소 시 서버 로그의 처리되지 않은 예외 소음 정리)를 진행. 수용한 한계(큐 대기 중 취소의 잠금 지연·home-m4 폴백 취소 미지원·취소 직후 0.6초 안 재호출 409·칩 2행 히트 41.75px·상황 삭제된 마친 방의 조용한 닫힘)는 **조치하지 않는다**. 「작성안 요구안대로 진행해주고 결과알려줘」.

## 관련 과거 이력 요약 (Leader 큐레이션)
- `isAbortError`·`cancelledError` 두 정의가 `src/modules/conversation/chats/requestCancel.ts`(task-058)와 `phraseHelp.ts`(task-056)에 중복. REV-197 L2·task-058 기록: 글자까지 같지만 한쪽에만 조건이 뒤늦게 붙은 선례(REV-190→192)가 있어 표류 위험 — 통합 권고(task-056 커밋 뒤 별도 소변경).
- `scenario/__tests__` 의 `qaP2cAFixes.test.ts`·`roomFlow.test.ts`·`resultWiring.test.ts`·`resultLogic.test.ts`·`variant*.test.ts` 는 소스 정규식으로 배선을 잠가 **주석 처리된 코드도 통과**시킬 수 있다(REV-193 F-1·REV-194 와 같은 약점). 공용 도구 `src/components/__tests__/sourceCode.ts`(`readCode` — TypeScript 파서로 주석만 제거, 문자열·정규식·JSX 글자 안 `//` 보존)가 이미 있다(task-056 REV-194 시험 보강).
- 서버 로그 소음: 클라이언트가 요청을 끊으면 `[api] 처리되지 않은 예외: Error: aborted` 가 남는다(운영 `pm2-err.log` 에 2026-09-30 부터 기존 현상, QA-B/B2 에서 9건 재확인, 응답·계약 영향 없음). 위치는 공용 `withApi`(`src/modules/infra/http.ts`).
- 승인된 교훈: 없음.

## judge 접수 (Leader 실행)
`structural` · 1.41 · R1 · developer=**sonnet** · standard · demo=none. 입력·결과: 스크래치 `judge-062-intake*.json`.

## 설계 (Leader)
1. **취소 판정 통합**: `requestCancel.ts` 를 정본으로 하고 `phraseHelp.ts` 가 거기서 import(같은 `conversation/chats/` 내부, `index.ts` 우회 아님). 동작 불변 — `signal?.aborted === true && isAbortError(e)` 분기, 409 `CONFLICT {reason:'CANCELLED'}`, 문구 그대로. task-056·058 시험 전부 통과.
2. **시험 5파일**: 주석 처리된 호출이 통과하는 단언을 `readCode` 로 옮긴다(단언의 의미는 바꾸지 않음). 옮긴 단언마다 변이(주석 처리 포함)로 실패하는지 확인.
3. **서버 로그 소음**: `withApi` 에서 **클라이언트가 이미 끊긴 요청**(`req.signal.aborted === true`)이면서 오류가 'aborted' 계열(`Error: aborted`, `ECONNRESET`, `AbortError`)일 때만 `[api] 처리되지 않은 예외` 오류 로그를 남기지 않는다. 그 밖의 모든 예외(신호가 살아 있는데 'aborted' 문구가 나는 경우 포함)는 지금처럼 로그+500. 응답 형식·상태 코드·다른 오류 처리 불변. **공용 인프라 변경이라 reviewer 가 가장 엄격하게 본다**(오류를 숨기지 않는지, 신호가 없는 요청 경로, 스트리밍 응답 경로).

## 하지 않는 것
위 수용 한계 조치, 응답·화면·계약 변경, `phraseHelp` 외 라우트 로직 변경, `withApi` 의 다른 동작 변경.

## 완료 기준
1. 시험 전부 통과(기존 + 통합/소음 새 시험), eslint·tsc 0, 변이 재현.
2. `withApi` 소음 처리 시험: 끊긴 요청의 'aborted' 오류 → 로그 0·응답 처리 불변 / 살아 있는 요청의 같은 문구 오류 → 로그 1회 / 일반 오류 → 로그 1회·500.
3. reviewer 증빙 재실행, QA(짧게): 개발 서버에서 클라이언트 abort 로 소음 로그가 사라지고 정상 요청 응답이 변하지 않음.

## 상태 로그
- 2026-10-12 접수(base_ref `b89d779`). 다음: developer(sonnet) → reviewer → QA.
- 2026-10-12 구현 완료 — [[task-062-dev-record]]: ① `phraseHelp.ts` 의 `isAbortError`·`cancelledError` 중복 정의 삭제 → `requestCancel.ts` 정본 import ② `scenario/__tests__` 9파일 소스 검사를 공용 `readCode` 로(단언 본문 0 수정 — 읽기 줄·import 만) ③ `withApi` 소음 정리: `req.signal.aborted === true` 이면서 `Error: aborted`/`AbortError` 일 때만 `[api] 처리되지 않은 예외` 로그 생략(응답·상태·`classifyError`·시그니처 불변). 새 시험 `task062ClientGone`(9)·`task062SharedCancel`(3).
- 2026-10-12 감사 **REV-199 PASS_WITH_NOTES**(Critical·High·Medium 0, Low 1, 정보 3) — [[task-062-rev-record]]: tsc/eslint/`next build` 0, 전체 시험 3,370 통과·실패 0·건너뜀 1, 변이 13건 전부 검출, 시험 이동 4건은 옛 시험이 통과하던 주석 처리 변이를 새 시험이 잡음(「옛 시험 거짓 통과」 재현). 개발 서버 직접 재현(포트 3018): HEAD `http.ts` 는 본문 중 끊기 2건에서 `Error: aborted` 로그 2줄, 작업본은 0줄이고 살아 있는 요청의 400·404 응답은 글자까지 동일.
  - Low F-1: `task062SharedCancel.test.ts` 가 `src/components/__tests__/sourceCode` 를 import(시험 전용이라 번들·런타임 영향 없음, 층 선례만) → 후속에 `sourceCode.ts` 를 중립 위치로 옮기는 정리 후보. 정보 I-1(끊김 빈도가 pm2 오류 로그에서 안 보임 — 운영 로그에 09-30 이후 1건뿐이라 영향 작음)·I-2(부정 단언 방침이 두 가지 섞임)·I-3(dev 기록 「8 test」→ 9개, 요약 문구만 낡음).
- 2026-10-12 **QA PASS**(결함 0, [[task-062-qa-record]]): 운영 모드 `next start`(전용 미러 `thekaiwa-qa062`, 포트 3019)에서 본문 중 끊기 3건(phrase-help Content-Length·chunked, turns Content-Length) 작업본 새 로그 0줄 / `http.ts` 만 HEAD 로 바꾼 대조군은 각 1줄(`Error: aborted`). 깨진 JSON 400·`{}` 400·없는 대화 404·무쿠키 401 은 작업본·HEAD 응답 원문 diff 없음. 끊긴 요청 자체의 응답은 소켓이 없어 관찰 불가(코드상 불변), LLM 응답 중 SSE 끊김·살아 있는 요청의 `aborted` 1회 로그는 단위 시험(REV-199) 근거만.
- 주의(QA 발견): `package.json` 의 `build` 스크립트가 `cd $HOME/.node-local/thekaiwa` 를 하므로 전용 미러에서 `npm run build` 를 쓰면 **기본 미러가 빌드된다** — 전용 미러에서는 `next build` 직접 실행.
- 2026-10-12 커밋 `d9343a7` → **운영 배포 완료**(사용자 「푸시 및 배포해주고 임시 미러는 정리해줘」): push `5586177..3c0427b` → 릴리스 `20261012-130400-3c0427b8`(`RELEASE_RESULT ok`·`migrated:false`), 롤백 대상 `20261012-091540-55861770`. 헬스 `status ok`·pm2 3개 online. push 전 게이트(HEAD `d9343a7`): tsc 0·eslint 오류 0(경고 5, 기존 효과 훅 경고)·시험 3,349/3,350(1 건너뜀)·`next build` 0. 임시 미러 6개 삭제 완료.

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 해당없음 | - | - | judge: none | 10-12 11:54 |
