---
task_id: task-019
title: "정리 backlog 3건 — ESLint 상대경로 교차 모듈 import 규칙 · Claude CLI 자식 env 프록시 키 제거 · A4 스키마 밖 필드 제거를 요청 옵션으로"
status: done
base_ref: e7a2df0
risk_level: R1
roles_involved: [leader, developer, reviewer, qa]
related_tasks: [task-010-today-lesson, task-012c-console-p2]
tags:
  - type/task
  - domain/infra
aliases:
  - 정리 backlog 3건
  - task-019
created: 2026-09-29
updated: 2026-09-29
demo_gate:
  required: false
  level: "none"
  status: "not_required"
  version: 0
  repo_path: ""
  artifact_url: ""
  content_sha256: ""
  decided_by: "leader"
  rule_id: ""
  approved_by: ""
  approved_at: ""
  approval_quote: ""
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: false
---

## 목표 (Leader)
`board.md` "정리 backlog (소규모)" 상단 3줄을 한 번에 정리한다(스키마 0·화면 0·Python 0).

1. **ESLint 6층 사각지대** — [[task-010-today-lesson]] REV-034 ⑤: `eslint.config.mjs` 경계 규칙이 `@/modules/...` 별칭만 막아 `../../engine/json/...` 같은 **상대경로 교차 모듈 import** 를 못 잡는다. `src/modules/<모듈>/**` 파일이 상대경로로 다른 모듈 디렉터리에 들어가는 import 를 error 로(같은 모듈 안 상대경로는 허용).
2. **Claude CLI 자식 env 프록시 키** — [[task-012c-console-p2]] "Codex C2 수정 재검(012c)" Low: `buildChildEnv` 허용 목록의 `HTTP(S)_PROXY`·`NO_PROXY` 류를 운영·개발 env 에 값이 없음을 확인(존재 여부만)한 뒤 뺀다.
3. **A4 스키마 밖 필드 제거를 요청 옵션으로** — REV-034 ⑥ Medium: WeakSet 전역 등록(`enableAdditionalPropertiesStrip(LESSON_SCHEMA)`, schemas.ts 모듈 로드 부수효과) → `LlmJsonRequest.stripAdditionalProperties?: boolean` 요청 옵션. 동작 동일(LESSON 만, 필수 필드 불변, 키 경로만 로그).

금지: 스키마·화면·Python·ecosystem·.env·운영 3010·pm2·commit/push·비밀값 출력·`.claude/agents`(tutor.md 포함) 수정.

## 관련 과거 이력 요약
- REV-034(2026-09-29 07:46, [[task-010-today-lesson]]) — A4 v7 CONDITIONAL_PASS. High ⑤(schemas.ts 상대경로 딥 import, ESLint 가 못 잡음)는 08:30 Leader 가 배럴 export 로 정리. Medium ⑥(요청 옵션 전환)·ESLint 사각지대는 정리 backlog.
- REV-035 재검(2026-09-29 11:05, [[task-012c-console-p2]]) — 자식 env 허용 목록 전환 PASS, 프록시 6키는 "오늘은 값이 없어 무해, 미사용 상태로 미리 열려 있음" Low.

## 완료 기준
- `eslint .` 0 error(현재 코드), 상대경로 교차 모듈 import 가 error 로 잡힘을 실측
- 프록시 키 제거 + 회귀 테스트, 운영·개발 env 에 프록시 키 없음 확인(이름만)
- `stripAdditionalProperties` 요청 옵션으로 전환, WeakSet·`enableAdditionalPropertiesStrip` 제거, 단위 테스트 갱신
- tsc 0 · eslint 0 · 전체 단위 0 fail · 격리 복제본 dev(3019) 006·010 스모크 PASS

## 판단 기록 (judge)

## Developer 기록
- [11:37] 착수. 근거 읽음: [[task-010-today-lesson]] REV-034(⑤ High·⑥ Medium·Low), [[task-012c-console-p2]] "Codex C2 수정 재검(012c)" ① 프록시 Low. base `e7a2df0`, 작업 트리 clean 에서 시작.
- [11:40] **② 프록시 키 존재 확인(이름만, 값 출력 없음)** — NFS `.env`·`.env.example`·`ecosystem.config.js`·운영 `apps/thekaiwa/shared/.env`·미러 `.env`: proxy 키 0건 · 운영 pm2 `thekaiwa`(27키)·`thekaiwa-speech-gateway`·pm2 데몬(24키) `/proc/<pid>/environ` 키 이름: proxy 0건 · 현재 셸 0건 · `~/.bashrc`·`~/.profile`·`/etc/environment` 0건. → `CHILD_ENV_ALLOW` 에서 `HTTP_PROXY`·`HTTPS_PROXY`·`NO_PROXY`·소문자 3개 제거(`ALL_PROXY` 는 원래 없음), 필요해지면 `new URL(v)` 로 userinfo 를 지운 값만 넘긴다는 주석. 회귀 테스트(`engine/__tests__/task012c.test.ts`): 대/소문자 8개 프록시 키(userinfo 포함 값)가 자식 env 에 안 감 + 허용 목록 자체에 `/PROXY/i` 이름 없음.
- [11:42] **③ 요청 옵션 전환** — `engine/json/schemaValidate.ts`: WeakSet·`enableAdditionalPropertiesStrip` 삭제, `extractAndValidate(raw, schema, { stripAdditionalProperties })`·`RunJsonOptions.stripAdditionalProperties` 로 매 시도(일반·soft 경로 모두) 전달, `runJsonAnalysis` 도 통과만. 제거 로직(`stripAdditionalPropertiesWalk`)·로그 문구(키 경로만)는 그대로, REV-034 Low(oneOf/allOf/$ref 는 건너뜀 = fail-safe)를 주석에 명시. `engine/llm` `LlmJsonRequest.stripAdditionalProperties?: boolean` → `completeJson` 이 `runJsonWithRetry` 로 전달. `engine/index.ts` 배럴에서 export 제거. `schemas.ts` 의 import·등록 호출·설명 주석 삭제(모듈 로드 부수효과 0). `conversation/prompts/lesson.ts`(prompt-engineer 영역 — Leader 지시 범위): `buildLessonRequest` 반환에 `stripAdditionalProperties: true` 한 줄 + v7 헤더 주석 2줄만 갱신, 프롬프트 지시문·`LESSON_PROMPT_VERSION`(lesson@v7) 불변.
- [11:44] **① ESLint 상대경로 교차 모듈 규칙** — `eslint.config.mjs` `boundary()` 가 `src/modules/<m>/**` 블록일 때 **모듈 루트 기준 깊이 d(0~5)별 블록**을 뒤에 덧붙여 같은 별칭 패턴 + `relativeEscape(d)` 를 싣는다(flat config 는 같은 규칙을 뒤 블록이 통째로 덮으므로 패턴을 합쳐 싣는 기존 방식 유지). 금지: `..` 를 정확히 d+1(→`src/modules/*`)·d+2(→`src/*`) 번 오른 뒤 끝나거나 내려가는 경로 · 루트까지 올랐다가 `src` 로 돌아오는 경로 · 정규화되지 않은 경로(`./x/../..`·`.././..`). 허용: 같은 모듈 안 상대경로 · 루트 비코드 파일(`../../../../package.json`·`prisma/seed-data/*.json` — 현재 PROD 2건). 깊이 6+ 파일은 상위 상대경로 전부 금지(fail-closed, 현재 최대 깊이 2). **테스트(`**/__tests__/**`·`*.test.ts`)는 이 패턴만 제외**(다른 모듈 내부 화이트박스 import 관례 13파일 24건 — 별칭 경계 규칙은 그대로 적용). speech 클라이언트 전용 두 블록의 `^\.\.` 도 `./..` 접두·비정규화 경로를 막게 보강.
- [11:45] 규칙 실측 — ESLint API `lintText` 로 39케이스(원래 REV-034 위반 `../../engine/json/schemaValidate` 금지 포함, 같은 모듈 허용·루트 JSON 허용·`src/types`/`app` 금지·`./../`·비정규화·깊이 4/5/6 경계·테스트 제외·별칭 규칙 유지) 전부 기대대로.
- [11:47] **검증**(`sync-local.sh` 후 격리 복제본 `~/.node-local/thekaiwa-t019`, `.env` 600): `tsc --noEmit` 0 · `eslint .` **0 error**·5 warning(기존 `react-hooks/set-state-in-effect`, 미변경 컴포넌트 5파일) · 전체 단위 **833: 830 pass·0 fail·3 skip**(신규 6: lesson 3 — 빌더가 옵션 켬·옵션 없으면 LESSON 도 안 지움·`completeJson` 이 옵션 전달(켜면 1회+키 경로 로그 / 끄면 재시도 2회), strip 3 — 로그 키 경로만·`runJsonWithRetry` 일반/soft 전달·"`stripAdditionalProperties: true` 프로덕션 코드는 lesson.ts 하나" 소스 스캔).
- [11:52] **라이브**(격리 복제본 dev 3019, `env -i HOME USER LANG PATH APP_ENV=LOCAL`, `-H 127.0.0.1`, QA 계정 qa-bot·qa-bot2): **006 42/42**(턴 p50 4952ms) · **010 65/65**. 010 동안 dev 서버의 Claude CLI 자식 202회 샘플링 → env 키 = `HOME LANG MAX_THINKING_TOKENS NODE_ENV PATH USER` 뿐(프록시 없음, 실 CLI 호출 20회 성공). 이번 A4 응답엔 스키마 밖 키가 없어 `[json] 스키마 밖 필드 제거` 로그는 안 나옴(확률적 — 전달 경로는 `completeJson` 단위 테스트로 확인). dev 로그의 `prisma:error`/500 은 010 9b 의도된 롤백 검증, `home-m4-lan LlmMisconfiguredError → 다음 후보`는 개발 `.env` `HOME_M4_API_KEY` 빈 값(012c 기록과 같은 기존 현상). 서버 종료.
- 남은 점: (a) `agent-vault/30-Knowledge/decisions/llm-japanese-quality.md` §12 에 `enableAdditionalPropertiesStrip` 서술이 남아 있음(Leader 문서 영역 — 갱신 필요) (b) ESLint 규칙은 정적 import/export 만 — 동적 `import()`·`require` 는 대상 밖 (c) `src/app`·`src/components` 의 상대경로 모듈 import 는 이번 범위 밖(현재 0건 grep 확인) (d) 격리 복제본 `~/.node-local/thekaiwa-t019` 는 reviewer 재사용용으로 남김(.env 600) — 끝나면 삭제.

## Reviewer 기록

### 2026-09-29 11:59 reviewer — REV-037

**판정: PASS**(Critical 0 · High 0 · Medium 0 · Low 0)

Read 전용 독립 감사. 격리 복제본 `~/.node-local/thekaiwa-t019`(developer가 남긴 것)에 이번 diff 전체(`eslint.config.mjs`·`src/`)를 재동기화한 뒤 developer 주장을 **직접 재실행**해 검증했다(developer 보고를 그대로 신뢰하지 않음).

**① ESLint 상대경로 교차 모듈 규칙** — `eslint.config.mjs` `relativeEscape(depth, message)` + `boundary()` 의 깊이별 블록(d=0..6, 6+는 fail-closed 전체 금지) 로직을 코드로 직접 추적(정규식 3종: 정확히 d+1/d+2 상승 후 종료·하강 금지 / d+3 상승 후 `src` 재진입 금지 / 비정규화 경로 금지). 실측:
- `eslint .` 실행 → **0 error, 5 warning**(기존 `react-hooks/set-state-in-effect`, 5개 컴포넌트 — 이번 diff 무관, developer 보고와 일치).
- `tsc --noEmit` → **0 에러**.
- ESLint `lintText` API 로 **21건 자체 설계 테스트**(developer 의 39건과 별개로 직접 작성) 실행 — REV-034 ⑤ 원 사례(`conversation/prompts/lesson.ts` → `../../engine/json/schemaValidate`) 재현 차단 확인, 같은 모듈 안 상대경로(깊이 0/1/2/5 다양) 허용 확인, 저장소 루트 파일(`package.json`) 허용 후 `src` 재진입 차단 확인, 비정규화 경로(`./x/../../y`, `.././..`) 차단 확인, 깊이 6 파일의 같은 모듈 내 상대경로까지 fail-closed 로 차단됨을 확인, `__tests__`/`*.test.ts` 는 상대경로 화이트박스만 예외이고 별칭(`@/modules/...`) 경계는 테스트에도 그대로 적용됨을 확인(`@/modules/speech` import 가 conversation 테스트에서도 error). **21/21 기대대로 — 오탐·미탐 없음.**
- 현재 코드베이스 실제 최대 중첩 깊이는 2(engine/infra/speech) — `RELATIVE_MAX_DEPTH=5` 여유 있고 6+ 캐치올은 현재 도달 불가(안전 마진, 문제 아님).
- flat config 의 "뒤 블록이 같은 규칙을 통째로 덮는다" 함정을 깊이별 블록마다 `patterns` 원본을 재포함하는 방식으로 정확히 우회했음을 확인(코드 46번째 줄 `[...patterns, ...relativeEscape(d, message)]`).
- `src/modules/speech/stt|tts/client/**` 전용 오버라이드 블록(파일 뒷부분, 더 늦게 선언되어 우선)에도 `NON_NORMALIZED` 가 추가됐음을 확인.

**② Claude CLI 자식 env 프록시 키 제거** — `CHILD_ENV_ALLOW` 에서 6키 제거가 `buildChildEnv`(허용 목록 화이트리스트 필터, `CHILD_ENV_LOCALE`=`LC_*` 만 별도 허용)를 통해 실제로 자식 프로세스 env 전달을 차단함을 코드로 확인. `ALL_PROXY`/`all_proxy` 는 diff 전에도 목록에 없었다는 developer 주장을 diff 자체로 확인(제거된 줄 6개뿐). `task012c.test.ts` 회귀에 대소문자 8개 프록시 키(+ userinfo 포함 값) 미유입 검증과 "허용 목록 자체에 `/PROXY/i` 이름 없음" 검증이 추가됨을 확인. 이 변경은 제거만 하는 방향이라 최악의 경우도 "기존 무해 상태 유지"이고 실패 방향이 없다(안전).

**③ A4 스키마 밖 필드 제거 → 요청 옵션 전환** — `engine/json/schemaValidate.ts`(WeakSet·`enableAdditionalPropertiesStrip` 완전 삭제, `ExtractOptions`/`RunJsonOptions.stripAdditionalProperties` 신설, `runJsonWithRetry`·`runJsonSoft` 양쪽 시도 모두 옵션 전달), `engine/llm/index.ts`(`LlmJsonRequest.stripAdditionalProperties` → `completeJson` 이 그대로 전달), `engine/index.ts`(배럴에서 옛 export 제거), `conversation/structuredResponse/schemas.ts`(`@/modules/engine` import·모듈 로드 부수효과 완전 제거 — grep 으로 재확인, import 문 0줄), `conversation/prompts/lesson.ts`(`buildLessonRequest` 반환에 `stripAdditionalProperties: true` 한 줄) 전부 Read. 확인 사항:
- `grep -rn stripAdditionalProperties.*true src` → 프로덕션 코드에서 켜는 곳은 `conversation/prompts/lesson.ts` **하나뿐**(테스트 제외) — 신규 소스 스캔 테스트(`additionalPropertiesStrip.test.ts` 마지막 케이스)도 같은 결론.
- `grep -rn enableAdditionalPropertiesStrip src` → **0건**(옛 API 완전 제거, 잔존 호출자 없음).
- `lesson.ts` import 문 확인 — `@/modules/engine` 배럴(타입만)·같은 모듈 안 상대경로(`../persona/loader` 등)만 사용, 6층 경계·index.ts 우회 위반 없음.
- 다른 A 지점(TALK·CHAT·WORD_ENRICH·CHAT_REVIEW·EVAL_GEN·EVAL_GRADE) 동작 불변 — 옵션 기본값 false 라 `stripAdditionalProperties` 를 안 켠 모든 호출은 기존 ajv 그대로.
- 로그(`[json] 스키마 밖 필드 제거: ...`)는 키 경로만 싣고 값을 싣지 않음을 테스트(`제거 로그는 키 경로만 싣는다`)로 확인 — Trace/로그에 원문·학습자 텍스트 없음 원칙 위반 없음.
- `conversation/__tests__/lesson.test.ts` 신규 e2e 테스트(`completeJson` + 가짜 home-m4 서버)로 옵션 on/off 양쪽 경로(재시도 횟수·로그 유무)를 직접 검증한 것을 확인 — 단위 테스트 수준을 넘어 통합 경로까지 커버.

**독립 재실행 결과**(격리 복제본, 라이브·Claude CLI 미실행):
- `tsc --noEmit` 0
- `eslint .` 0 error / 5 warning(기존)
- 전체 단위 테스트(`node --import tsx --test`): **833개 — 830 pass · 0 fail · 3 skip**(developer 보고와 정확히 일치)

**지적 없음.** 정리 backlog 3건 모두 사양대로 구현됐고, 범위 밖 파일(스키마·화면·Python·ecosystem·.env·`.claude/agents`) 변경 없음을 `git diff --stat` 로 확인.

**참고(비차단, Low 미만 — Leader 문서 영역)**: `agent-vault/30-Knowledge/decisions/llm-japanese-quality.md` §12 에 옛 `enableAdditionalPropertiesStrip` 서술이 남아 있다(developer 가 이력서에 이미 공개·Leader 담당으로 명시). 코드 결함이 아니므로 판정에 반영하지 않음 — Leader 갱신 필요.

**QA high_risk_areas**: 없음(코드 변경이 lint 규칙·자식 env 허용 목록·JSON 후처리 내부 로직에 한정되고 API 계약·DB·화면 변경 0). 다만 격리 3019 006/010 라이브 스모크는 developer 실행분(rev 재실행 안 함)이므로 QA 가 **운영 배포 전 일반 스모크**(006·010 최소 1회)로 A4 lesson 흐름 회귀 없음을 한 번 더 확인하는 것을 권고(필수 아님 — 이번 변경은 로직 동일성이 테스트로 강하게 뒷받침됨).

**native_change**: false

## QA 기록

## 최종 요약

### 2026-09-29 17:10 Leader(메인) — judge C2·QA·배포
- judge C2(Leader 직접 실행, jev): **codex_required=false**(R1, budget_rule CX-limit-unknown-hold, 규칙 덮어쓰기 없음).
- QA: developer(격리 복제본 3019 — 단위 830/833·eslint 0·006 42/42·010 65/65, CLI 자식 env 키 202회 확인)·REV-037(독립 재실행 830/833·ESLint 21 사례) 결과에 더해 Leader 가 격리 복제본에서 tsc·`next build` 확인 → 커밋·운영 반영, 운영 006·010 스모크.

### 2026-09-29 17:30 Leader(메인) — 운영 반영
- `8313dc9` push → webhook `RELEASE_RESULT ok`(릴리스 `20260929-120241-8313dc90`). 운영 스모크 `SMOKE_ENV=PRODUCTION` **006 42/42 · 010 65/65**.

## 최종 요약

**정리 작업 3건이 운영에 반영됐습니다** (2026-09-29, 사용자 화면 변화 없음).
- 코드 규칙 검사(ESLint)가 이제 모듈 경계를 상대경로로 몰래 넘는 import 도 잡습니다 — 리뷰에서 한 번 사람 눈으로만 잡혔던 종류의 실수를 자동으로 막습니다.
- AI(Claude CLI) 하위 프로세스에 넘기는 환경변수에서 쓰지 않는 프록시 설정을 뺐습니다 — 혹시 들어갈 수 있던 계정 정보 경로를 미리 닫았습니다.
- 레슨 생성의 "스키마 밖 필드 자동 제거"를 더 안전한 방식(요청마다 켜는 옵션)으로 바꿨습니다. 동작은 같습니다.
- 검증: 리뷰 REV-037 PASS, 단위 830/833(실패 0), 운영 스모크 회화 42/42·오늘의 회화 65/65.
