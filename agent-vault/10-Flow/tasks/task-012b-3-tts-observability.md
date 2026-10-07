---
task_id: task-012b-3
title: "TTS P1 관측 — EngineMetricsDaily 물화·TTS 컬럼 확장·GET /api/admin/v1/tts/metrics·TTS 캐시 예열/정리"
status: todo
base_ref: 5c3a701
risk_level: R2
roles_involved: [leader, judge, developer, reviewer, qa]
related_tasks: [task-012b-speech-p2, task-003d-tts-p0, task-003c-tts-productization-design, task-007-talk-voice-web, task-012c-console-p2, task-005b-admin-console-skeleton]
tags:
  - type/task
  - domain/speech
  - domain/engine
  - domain/admin
aliases:
  - TTS 관측
  - TTS 지표
  - task-012b-3
created: 2026-10-06
updated: 2026-10-06
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

## 목표 (Leader)
TTS 품질·속도를 날짜별로 볼 수 있게 한다. `RequestTrace` 에 이미 기록되는 TTS 하위 단계(`TTS`·`TTS_SYNTH[i]` 등)를 **`EngineMetricsDaily` 에 하루 단위로 물화**하고(기존 칸 + TTS 칸 6개), 관리자 API `GET /api/admin/v1/tts/metrics` 로 돌려준다. 함께 **TTS 오디오 캐시 예열·정리**(speech-platform/16 §11.2)를 연다. 대시보드 화면은 012c-3 몫이다(이 task 는 화면 0).

## 사용자 결정·지시
- 2026-10-06 사용자 지시 원문(Leader 전달): **"지금부터 페이즈2작업에 전체 작업을 데모화면 승인없이 한번에 진행해주고 결과를 정리해서 알려줘"**.
- 같은 날 사용자 답(AskUserQuestion, Leader 전달): **DB 전부 승인 — 그중 "TTS 관측 `EngineMetricsDaily` 컬럼 확장"**(추가만, 백업 후 다른 승인 변경과 **한 번에** `prisma db push`) · 운영 배포는 모든 작업이 끝난 뒤 한 번에.
- → [[task-012b-speech-p2]] **U4 = 확장(권고안) 확정**(`docs/design/speech-platform/16-tts-productization-layer.md` §16 #3 의 "확장 vs `TtsMetricsDaily` 신설" 중 확장). 신설 표·`TraceKind TTS` 값 추가는 **승인 범위 밖** — 하지 않는다.

## 설계 방침 (Leader 초안 — developer 가 확정, 정본 반영은 Leader)
- **스키마(작성자는 이 task 가 아니다)**: `EngineMetricsDaily` 에 `p99Ms Int?` · `ttfaP50Ms Int?` · `ttfaP95Ms Int?` · `rtfAvg Float?` · `cacheHitRate Float?` · `byVoice Json?`(`{voiceId:{requests, errors, p50Ms}}`) — 16 §7.3 그대로. TTS 연결 행만 채우고 나머지는 null. **`prisma/schema.prisma` 는 Phase 2 일괄 DB 단일 작성자(WP-DB0)가 다른 승인 변경과 함께 쓰고 한 번에 push 한다**([[phase2-batch-plan]] §4) — 이 task 의 developer 는 스키마를 고치지 않고, push 뒤 미러에서 `prisma generate` 만.
- **원천**: TTS 단계는 `TURN`(회화·레슨·평가 오디오)·`PREVIEW` Trace 의 `steps[]` 에 있다(`src/modules/speech/tts/synthesize.ts:339`, 허용 키 `src/modules/speech/tts/metrics.ts:9-17`) [확실]. `TraceKind` 에 `TTS` 는 없다(`prisma/schema.prisma` enum TraceKind) — **추가하지 않고** step 이름으로 거른다. 연결 매핑은 step 의 `connectionKey` → `EngineConnection`(환경별 행이라 환경이 함께 갈림).
- **물화 실행 방식(Leader 결정 L-4 — 권고)**: 지금 `src/` 에 주기 잡·크론이 없다(`setInterval` 은 클라 타이머뿐) [확실]. 우분투 crontab 은 저장소 밖 인프라 변경이라 **승인 범위 밖**. 그래서 **지연 물화**: ① 지표 API 요청 때 "어제까지 중 아직 물화 안 된 날"을 계산해 upsert(`@@unique([connectionId, date])`), 당일분은 즉석 집계(60초 캐시 — 16 §7.3) ② (선택) 분석 워커 claim 경로에 하루 1회 편승(task-012b D-B9 와 같은 방식). 물화는 멱등이어야 한다(두 요청이 겹쳐도 같은 행).
- **지표 정의**: 16 §7.1 — TTFA(부모 `TTS` step `ttfaMs`)·p50/p95/p99(합성 지연)·RTF 평균(`TTS_SYNTH.rtf`)·캐시 적중률(`cacheHit`)·voice 별 요청 수. 표본 0 이면 null(0 이 아님).
- **권한**: 정본 불일치 주의 — 16 §7.3 은 `engine.read`, `docs/design/role-permission.md:49` 는 Diagnostics 지표·`EngineMetricsDaily` 를 **`trace.read`** 로 둔다 [확실]. 권고: 정본 `role-permission.md` 를 따른다(`trace.read`, DEVELOPER·SUPER_ADMIN) — Leader 가 16 문서를 정정.
- **캐시 예열·정리**(16 §11.2): 정리 = `TtsCache` LRU(기본 상한 2GB, `lastHitAt` 오래된 것부터 파일+행) · 예열 = 고정 문장 목록 × AVAILABLE voice × {NATIVE, LEARNING_SLOW}. **설정 키(`tts.cache.maxBytes`·`tts.cache.warmupSentences`)는 지금 코드·seed 에 없다** [확실 — grep 0건] → 코드 상수 기본값으로 시작하고, AppSetting 으로 올리려면 seed·`ConfigurationVersion` 규칙(관리자 변경은 버전·감사 필수)을 따른다. 예열은 M4 에 합성 요청을 보내므로 **회화 시간대와 겹치지 않게**(관리자 수동 실행 또는 지연 물화와 같은 편승 — 회화 TTS 큐를 막지 않는지 확인).
- 사용자 응답·로그에 문장 원문·오디오·시크릿 0(16 §7.2 "본문·표기·읽기·오디오는 어느 step 에도 없다").

## 예상 변경 경로
- `src/modules/engine/trace/**`(집계 읽기) 또는 새 `src/modules/engine/metrics/**`(물화·조회) · `src/modules/engine/index.ts`
- `src/modules/speech/tts/cache.ts`(정리·예열) · `src/modules/speech/index.ts`
- `src/app/api/admin/v1/tts/metrics/route.ts`(신규) · (선택) 캐시 정리·예열 관리자 액션 라우트
- `src/types/admin.ts`(응답 타입)
- 테스트: `src/modules/engine/__tests__/**` · `src/modules/speech/__tests__/**` · `tests/live/task012b3-smoke.ts`(신규)
- 문서(Leader): `docs/design/api-contract.md`(새 라우트) · `docs/design/domain-model.md`(EMD 칸) · `16-tts-productization-layer.md` §7.3 권한 정정

## 파일 경계 (다른 WP 와 충돌 방지 — [[phase2-batch-plan]] §2)
- **`prisma/schema.prisma` 금지**(단일 작성자 WP-DB0).
- `src/modules/speech/tts/{cache,metrics,synthesize,index}.ts` 는 **이 task 가 먼저**, [[task-012b-4-tts-timing-m4]] 의 앱 부분(timing 부착·`TTS_TIMING` 단계)이 이 task 로컬 커밋 뒤. 이 task 는 `metrics.ts` 의 허용 키 목록을 바꾸지 않는다(012b-4 몫).
- 화면 파일 0(대시보드는 012c-3). `components/**` 금지.
- 미러 `~/.node-local/thekaiwa-012b3`(dev 포트 3023). 라이브에 LLM 이 필요 없다(Trace 픽스처 행으로 물화 검증) — 운영 Trace 는 읽기만.

## 완료 기준 (QA 가 실행으로 확인)
1. 픽스처 Trace(TTS step 포함 TURN·PREVIEW, 여러 날·여러 voice·캐시 HIT/MISS·오류)로 물화하면 날짜·연결별 `requests·errors·avg·p50·p95·p99·ttfaP50·ttfaP95·rtfAvg·cacheHitRate·byVoice` 가 손계산과 일치, 표본 0 은 null.
2. 같은 날 두 번·동시 두 요청 물화 → 행 1개, 값 같음(멱등).
3. `GET /api/admin/v1/tts/metrics?range=&connectionId=&voiceId=`: 권한 없는 역할 404/403(콘솔 규칙 그대로), 응답에 문장 원문·시크릿 0, 당일분 즉석 집계 60초 캐시.
4. 캐시 정리: 상한 초과 시 오래된 것부터 파일+행 삭제, 남은 크기 ≤ 상한, 재생 중인 키 보호 규칙(있다면) 확인. 예열: 지정 문장이 캐시 HIT 로 바뀜, 예열 중 회화 턴 TTFA 악화 없음(측정 1회).
5. `TraceKind`·스키마에 이 task 몫 외 변경 0, 기존 Trace 기록 경로 무변경.
6. 회귀: 단위 전부 + 스모크 007(TTS 경로)·003d·012c.

## 관련 과거 이력 요약
- [[task-012b-speech-p2]]: 범위 분할(012b-3 = 지표·스키마, 대시보드 화면은 012c) · U4 기본안 "확장" · Trace 하위 단계는 [[task-003d-tts-p0]]·[[task-007-talk-voice-web]] 에서 이미 구현.
- [[task-003c-tts-productization-design]]: TTS P1 관측 설계(16 §7). [[task-012c-console-p2]]: 012c-3(TTS 대시보드·품질)이 이 task 의 지표를 읽는다 — 012c-3 DB(U-C3)는 아직 미승인.
- [[task-005b-admin-console-skeleton]]: 관리자 라우트 capability 가드·404/403 규칙·Trace 화면.
- 승인된 교훈: 없음(`/이슈기록 관련 tts` 0건, 2026-10-06).

## 승인 상태
- **DB**: `EngineMetricsDaily` 6칸 추가 — **사용자 승인(2026-10-06, Leader 전달)**, push 는 Phase 2 일괄 1회(WP-DB0 · 백업 → `migrate diff` 확인 → push). 그 밖 스키마 변경은 승인 범위 밖.
- **인프라**: crontab 등 저장소 밖 변경 없음(지연 물화). 필요해지면 사용자 승인.
- **데모**: 화면 0 — judge 가 none 으로 볼 것으로 예상. `demo_gate` 는 judge intake 뒤 Leader 가 `check.mjs init` 으로 만든다.
- **M4·네이티브**: 없음(예열이 M4 에 합성 요청만 보냄 — M4 코드 변경 없음).

## 판단 기록 (judge)

## Leader 기록 (Phase 2 일괄 접수, 2026-10-06 21:50)

- **judge intake**(Leader 가 `judge.mjs` 직접 실행, `judge-result@2`·engine=jev·fallback 없음): standard · developer=**opus** · risk=R2 · demo=none(`R2-migration`) · 규칙 덮어쓰기 없음. 결과 JSON `/tmp/judge-task-012b-intake.result.json`.
- **데모 승인 생략**: 사용자 지시(2026-10-06): "지금부터 페이즈2작업에 전체 작업을 데모화면 승인없이 한번에 진행해주고 결과를 정리해서 알려줘". 데모 불필요(화면 0). 데모 게이트 도구 `check.mjs waive` 는 이 문장을 생략 요청으로 인식하지 못해(정규식 `(데모|목업|시안|mockup|demo)\s*(는|은|를|을|도)?\s*(생략|없이…)` — "데모화면 승인없이" 불일치) **정식 waive 기록은 없다** — 게이트 상태는 `init` 직후 값 그대로이고 편집 훅은 warn 단계라 막지 않는다. 사용자가 도구가 인식하는 문장(예: "데모 생략하고 진행해줘")을 한 번 입력하면 정식 기록으로 바꾼다.
- **사용자 승인 사항(AskUserQuestion 2026-10-06)**: DB 변경 전부 승인(추가만·백업 후 통합 `db push`) · 운영 배포는 전부 끝난 뒤 한 번에 · M4 설치·배포 포함 · 챌린지 U3=B2.

## 데모 검토 (demo gate)

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 해당없음 | - | - | judge: none | 10-06 21:48 |

## Developer 기록

- [22:40] 체크포인트 1 (dev-012b3, opus)
  - 완료: 미러 `~/.node-local/thekaiwa-012b3` 생성(§3 절차, `prisma generate` — 새 6칸 생성물 확인). `src/modules/engine/metrics/{ttsAggregate,index}.ts`(계산·지연 물화·조회·60초 캐시) · `engine/index.ts` export · `admin/diagnostics/tts.ts` + `admin/index.ts` export · `app/api/admin/v1/tts/metrics/route.ts` · `types/admin.ts` DTO · `speech/tts/metrics.ts`(TTS_SYNTH 허용 키 `voiceId`) · `speech/tts/synthesize.ts`(TTS_SYNTH 5곳에 `voiceId: voice.id`) · `speech/tts/cache.ts`(정리·예열 후보). 전체 `tsc` 0 오류, engine 단위 14/14.
  - Leader 결정(22:30 SendMessage): ① `app→engine` lint 금지(eslint.config.mjs:115) 때문에 admin 조합 모듈 `admin/diagnostics/tts.ts`·`admin/index.ts` export 를 소유에 추가 ② voiceId 원천 — `metrics.ts` TTS_SYNTH 허용 키에 `voiceId` 추가 + `synthesize.ts` 가 `voice.id` 를 싣는다(012b-4 는 이 task 커밋 뒤).
  - 남은 일: speech 단위 테스트(정리·예열·voiceId 키) · admin 테스트(라우트 첫 줄·range/voiceId 파서·summary) · `tests/live/task012b3-smoke.ts`(작성만) · eslint · 전체 단위 회귀 · 문서 초안·QA 인계.
  - 주의점: TtsCache 는 환경 칸이 없고 DATA_ROOT 도 개발·운영 같음 → 정리는 모든 환경 캐시에 닿는다(실행 진입점 없음, 라이브는 dryRun 만). `voice.id` = VoiceProfile.id(`teacher_haruka` 등, seed `voices.json` profiles) — 엔진 모델 id(`voiceModelId`)·speakerId 아님 [확인].
  - 미커밋 파일: 위 전부(커밋 금지 지시).
- [22:44] 체크포인트 2 (dev-012b3-2, opus — 신규 소환, 이력서만 보고 이어받음)
  - 확인: 앞 dev 가 체크포인트 1 뒤에 speech 단위(`speech/__tests__/task012b3Cache.test.ts`)·engine 단위(`engine/__tests__/task012b3.test.ts`)·admin 단위·`tests/live/task012b3-smoke.ts` 까지 이미 써 두었다(기록만 빠짐). 재동기화 뒤 `tsc` 0 · 세 파일 28/28.
  - 점검에서 고친 것 2건(engine/metrics/index.ts): ① **다른 환경 보기가 그 환경 행을 쓰던 문제** — SUPER_ADMIN `?environment=PRODUCTION` 를 개발 미러(미커밋 코드)에서 부르면 운영 끝난 날 행을 그 빌드 계산으로 굳혔다. `getTtsMetrics` 에 `writable`(기본 = 조회 환경 === APP_ENV) — 다르면 물화하지 않고 행 없는 끝난 날은 즉석 집계(LIVE, 저장·캐시 없음). ② **고아 실패 연결 규칙** — "TTS 연결이 하나뿐일 때" → "켜진 TTS 연결이 하나면 그 키(없으면 하나뿐일 때)". 꺼진 시험 연결(스모크 픽스처 포함)이 생기면 실 연결의 고아 실패가 버려지던 것을 막는다(`fallbackKeyOf` export). LIVE 날에도 연결 생성 전 날은 NONE(`existedOn` 공통).
  - 보완: admin `getTtsMetricsDto` 에 DB 경계 `deps` 주입(기본 = 실제) → 조립 테스트(형식 400 DB 전·없는 연결 404·TTS 아닌 연결 400·range 오류 집계 전·기간 KST·연결 칸 5개). speech: `synthesize.ts` TTS_SYNTH 5곳 `voiceId: voice.id` 소스 스캔(엔진 모델 id·speaker id 없음). engine: fallbackKeyOf·writable=false·writable 기본값(APP_ENV) 3건, 기존 조회 테스트는 `writable: true` 명시. 세 파일 33/33, `tsc` 0.
  - `voiceId` 원천 재확인[확인]: `synthesize.ts:195 pickVoice` → `voices/registry.ts loadTtsVoice` 가 `prisma.voiceProfile.findFirst` 의 `id` 를 돌려준다(seed `teacher_haruka` 등). `jvnv-F1-jp` 류는 VoiceModel id(`voiceModelId`)로 단계에 싣지 않는다.
  - 남은 일: eslint(변경 파일) · 전체 단위 회귀 · 문서 초안·QA 인계·최종 기록.
  - 미커밋 파일: 체크포인트 1 목록 + `engine/__tests__/task012b3.test.ts`·`admin/__tests__/task012b3.test.ts`·`speech/__tests__/task012b3Cache.test.ts`·`tests/live/task012b3-smoke.ts`.
- [22:55] **구현 완료 — Reviewer 인계** (dev-012b3-2)
  - **변경 파일**(전부 미커밋, 이 task 소유만):

    | 파일 | 내용 |
    |---|---|
    | `src/modules/engine/metrics/ttsAggregate.ts`(신규) | 순수 계산 — 표본 규칙(TTS_SYNTH 청크·고아 실패·TTFA)·nearest-rank·누적기·byVoice(이름순·상한 50) |
    | `src/modules/engine/metrics/index.ts`(신규) | KST 하루·지연 물화(끝난 날+2분 유예·90일·0 행·연결 생성 전 제외·upsert P2002→update)·조회(`writable`·즉석 집계 60초 캐시)·`fallbackKeyOf` |
    | `src/modules/engine/index.ts` | export 3줄 |
    | `src/modules/admin/diagnostics/tts.ts`(신규) · `src/modules/admin/index.ts`(export 2줄) | 입력 파서·연결 확인(404/400)·DTO·기간 합계, DB 경계 `deps` |
    | `src/app/api/admin/v1/tts/metrics/route.ts`(신규) | 첫 줄 `requireCapability('trace.read')`, `?environment=` 는 `viewEnvironment` |
    | `src/types/admin.ts` | `TtsMetrics*Dto` |
    | `src/modules/speech/tts/metrics.ts` | TTS_SYNTH 허용 키 `voiceId` + `synthSteps` 인자 |
    | `src/modules/speech/tts/synthesize.ts` | TTS_SYNTH 5곳 `voiceId: voice.id` |
    | `src/modules/speech/tts/cache.ts` | LRU 정리 계획·실행(dryRun)·예열 후보·`missingCacheKeys` — **실행 진입점 없음** |
    | 테스트: `src/modules/{engine,admin}/__tests__/task012b3.test.ts` · `src/modules/speech/__tests__/task012b3Cache.test.ts` · `tests/live/task012b3-smoke.ts`(작성만) | |
  - **실행 증빙**(미러 `~/.node-local/thekaiwa-012b3`, 22:50 동기화 기준): `tsc --noEmit` rc=0 오류 0 · eslint(위 변경 파일 14개) rc=0 경고 0 · task 단위 3파일 **33/33** · **전체 단위 회귀**(`env -u DATABASE_URL node --import tsx --test --test-concurrency=1 $(find src -name '*.test.ts')`, 153파일 — conversation·learning·engine·speech·admin·preferences·infra 전부) **1763 중 pass 1762 · fail 0 · skip 1**(`#9 실제 배포 manifest` — 미러에 `speech/models` 없음, 기존 skip) · 보이지 않는 문자 스캔(`grep -nP` 영폭·bidi·NBSP·`\u{`) 0건 · 엔진명 grep(변경 소스 5파일) 0건 · `prisma/**`·`speech/tts/index.ts`·`speech/index.ts` 무변경(이 task 몫). PE `topicWords.ts` 로 깨진다던 `prompts.test.ts`·`additionalPropertiesStrip.test.ts` 는 이번 회귀에서 **통과**(그 시점 NFS 상태 기준 — 다른 WP 가 바꾸면 달라질 수 있음).
  - **self_check**: unit_test ✓ · lint ✓ · type_check ✓ · engine_name_leak ✗(없음) · native_change ✗(없음). risk_level: MEDIUM(GET 이 파생 행을 쓴다 — 멱등·환경 한정으로 묶음).
  - **QA 인계**(DB 6칸은 22:17 적용 완료 — QA 가 미러 3023 dev 서버로 실행, LLM·M4 호출 0):
    1. 세션 4종 → `BASE=http://127.0.0.1:3023 [WAIT_LIVE=1] node --env-file=.env --import tsx tests/live/task012b3-smoke.ts /tmp/c-user /tmp/c-admin /tmp/c-dev /tmp/c-super`(명령 전문·주의는 파일 머리 주석). KST 자정 전후 2분은 피한다.
    2. 확인 항목: A 권한(401·USER 404·ADMIN 403 `missing:["trace.read"]`·DEVELOPER/SUPER 200) · B 입력 400/404 · E 손계산(D1 7요청·2오류·avg 633·p50 600·ttfa 520·rtf 0.5333·hit 0.2857·byVoice 2목소리 / D2 n=25 p95 2400·p99 null / 표본 0 날 0·null / 오늘 LIVE·저장 0) · D 재조회 멱등(행·computedAt 그대로) · C 동시 두 요청 행 6 · F voiceId 필터 · G 60초 캐시(WAIT_LIVE 로 만료) · **K 다른 환경 보기**(DEVELOPER 403·SUPER 200·그 환경 행 쓰기 0) · H 누출 0 · J 캐시 정리(dryRun 은 전체 TtsCache 읽기만, 실제 삭제는 픽스처 3행 한정 store).
    3. 정리: finally 가 id·키로 지운다. 중단 시 남은 행 = `refType='qa012b3'` RequestTrace · key LIKE `qa012b3-tts-%` EngineConnection(EMD 는 cascade) · `createdAt < 2001-01-01` TtsCache(+파일 `DATA_ROOT/tts-cache/<앞2>/<키>.wav`).
    4. 운영 Trace·PRODUCTION 행은 이 스모크가 읽지도 쓰지도 않는다. 다만 LOCAL 실 TTS 연결의 끝난 날 행은 이 조회로 물화될 수 있다(정상 동작).
    5. 회귀 스모크 007(TTS 경로)·003d·012c 는 QA 몫 — TTS_SYNTH 에 `voiceId` 칸만 늘었고 응답 모양은 무변경.
  - **완료 기준 대비 남는 것**: ④의 "예열 — 지정 문장이 HIT 로 바뀜·예열 중 TTFA 악화 없음" 은 **예열 실행(합성) 진입점이 없어 검증 불가**(후보 계획·없는 키 계산만). 정리도 실행 진입점 없음(dryRun 스모크만). 둘 다 실행 주체(관리자 액션 라우트 or 워커 편승)와 AppSetting 키(`tts.cache.maxBytes`·`tts.cache.warmupSentences` + seed·ConfigurationVersion)를 **Leader 가 정해야** 열 수 있다. 정리는 TtsCache 에 환경 칸이 없어 개발·운영 캐시를 함께 지운다는 점을 결정에 넣을 것.
  - **남은 위험**: ① 끝난 날 행은 다시 계산하지 않는다 — 지표 정의를 바꾸면 해당 행을 지워야 재계산된다(재계산 경로 없음). ② task 이전 Trace 는 `voiceId` 가 없어 그날들의 byVoice 는 null 로 굳는다. ③ TURN Trace steps 는 `appendTraceSteps` 가 64개로 자른다(기존 동작) — 청크가 아주 많은 턴은 뒤 청크 TTS 단계가 빠져 적게 센다. ④ 첫 90d 조회는 89일치 Trace 를 한 번 훑는다(상한 30만 행 넘으면 500 `TtsMetricsScanLimitError`, 부분 저장 없음). ⑤ 기간 합계의 적중 수는 저장 비율(소수 4자리)×요청 수로 되살린다 — 하루 요청 5,000 미만에서만 정확. ⑥ 즉석 집계 캐시는 프로세스별(blue/green 두 프로세스가 각자 60초).
  - **문서 초안**(정본 반영은 Leader — 아래 문구를 그대로 옮기면 된다):
    - `api-contract.md` 2080행(TTS 관리자 표) `GET /api/admin/v1/tts/metrics?range=&connectionId=&voiceId=` 권한 `engine.read` → **`trace.read`**, 설명 덧붙임: "range = `today`·`7d`(기본)·`30d`·`90d`(오늘 KST 포함). connectionId = 같은 환경 TTS 연결 id 또는 key(없으면 404·TTS 아니면 400). voiceId = 형식만 검사, byVoice·summary.voice 를 그 목소리로 좁힘. `?environment=` 는 SUPER_ADMIN(`environment.policy`). 응답 `{environment, range{key,from,to}, today, voiceId, connections[{connection{id,key,name,status,enabled}, summary{requests,errors,errorRate,cacheHitRate,voice}, days[{date, source: MATERIALIZED|LIVE|NONE, requests, errors, errorRate, avgMs, p50Ms, p95Ms, p99Ms, ttfaP50Ms, ttfaP95Ms, rtfAvg, cacheHitRate, byVoice, computedAt}]}]}`. GET 이지만 끝난 날 `EngineMetricsDaily` 행을 지연 물화한다(파생 집계 — AuditLog·ConfigurationVersion 대상 아님, 조회 환경 = APP_ENV 일 때만)." 같은 수정을 §14 표(#123a 근처)에도 번호를 붙여 한 줄.
    - `domain-model.md` 392행(ER)·2169행(모델)에 6칸(`p99Ms Int?`·`ttfaP50Ms Int?`·`ttfaP95Ms Int?`·`rtfAvg Float?`·`cacheHitRate Float?`·`byVoice Json?`) 추가 · 2303행 생성 시점 "매일 03:00 KST + 요청 시 당일 재계산" → "**지연 물화**: 지표 조회가 끝난 날(KST, 자정+2분 유예)·90일 안·행 없는 (연결, 날짜)를 계산해 upsert(표본 0 도 0 행), 오늘은 즉석 집계(60초 캐시). 행은 조회 환경 = APP_ENV 프로세스만 쓴다. TTS 칸은 TTS 연결 행만" · 2650행 미결 #19 → "확정: 컬럼 추가(task-012b-3, 2026-10-06)".
    - `16-tts-productization-layer.md` §7.3(257행) "`engine.read`; Trace 드릴다운 `trace.read`" → "**`trace.read`**(role-permission.md:49 — Diagnostics 지표·EngineMetricsDaily)" · 421행 "`engine.read` = 대시보드" → "`trace.read` = 대시보드".
    - 같은 문서 **§7.1 vs §7.2 불일치**: §7.1 은 "Voice 별 요청 수" 원천을 step `voiceId` 로 두는데 §7.2 `TTS_SYNTH[i]` 허용 키에 `voiceId` 가 없다. 정정: `TTS_SYNTH[i]` 행 → `{chunkIndex, synthMs, audioMs, rtf, modelLoaded, modelVersion, cacheHit, connectionKey, voiceId, status, errorCode}` + 주석 "`voiceId` = VoiceProfile.id(엔진 speaker id·모델 id 아님, task-012b-3). `status`·`errorCode` 는 task-003d 부터 실려 있던 값". 덧붙여 `TTS`(부모) 행도 코드(`speech/tts/metrics.ts:10`)와 다르다 — 문서의 `resolvedParams` 는 코드에 없고 코드의 `styleSource`·`status` 는 문서에 없다(정정 여부 Leader 판단).
    - (선택) §7.1 아래 "일별 물화 정의" 한 단락: `src/modules/engine/metrics/ttsAggregate.ts` 머리 주석(요청 = 청크 단위·HIT 포함, 지연 백분위 = 성공 MISS 만·nearest-rank·p95 20개·p99 100개 미만 null, TTFA = Trace 1건당 1개, 고아 실패 규칙, PLAYGROUND·FUNCTIONAL_TEST 제외).

### dev-012b3c (REV-119 M-1·M-2)

- [23:17] **REV-119 Medium 2건 수정 완료 — Reviewer 재확인 요청**(신규 소환, opus. 범위: M-1·M-2·L-1 주석만, DB·라이브·dev 서버 접촉 0, 커밋 0)
  - **변경 파일**(전부 미커밋):

    | 파일 | 내용 |
    |---|---|
    | `src/modules/admin/diagnostics/tts.ts` | M-1: `voiceOf()` = `Object.hasOwn` 조회 — `ttsDayDto`·`summarize` 두 곳. 좁힌 byVoice 는 `Object.fromEntries([[voiceId, v]])` |
    | `src/modules/engine/metrics/ttsAggregate.ts` | M-1: `finish` byVoice·`parseByVoice` 를 대입(`o[id] = v`) 대신 `Object.fromEntries` 로 — 목소리 id 가 `__proto__` 여도 자기 속성 |
    | `src/modules/engine/metrics/index.ts` | L-1: `MATERIALIZE_LOOKBACK_DAYS` 주석 한 단락(정책 키 `trace.retentionDays` 와 이중 정의·물화가 조회 의존 → 보존 정리 구현 시 정리 전 `materializeTtsDays` 강제·`min(90, retentionDays)` 함께 결정). 코드 변경 0 |
    | `src/modules/speech/tts/cache.ts` | M-2: `pruneTtsCache` 기본 = dryRun(`opts.dryRun !== false` — `false` 리터럴만 삭제). 옵션 타입 `PruneTtsCacheOptions` = 유니온(`dryRun:false` 면 `store` 필수) + 런타임 가드(store 없이 `dryRun:false` → DB 읽기 전 throw). 삭제 루프를 비공개 `deleteFromSharedCacheIncludingProduction` 로 분리(이름·주석에 "개발·운영 같은 DATA_ROOT·TtsCache 라 운영 캐시에 닿는다" 경고), `prismaCachePruneStore` 에도 같은 경고. 정리 후보 선정(`planCachePrune`)·삭제 순서·보호 창 불변 |
    | `src/modules/admin/__tests__/task012b3.test.ts` | +1: 프로토타입 키 `constructor`·`toString`·`__proto__`(+`hasOwnProperty`)·없는 `voice_zz` → JSON 응답에서 byVoice `[null, null]`·`summary.voice {voiceId, 0, 0}`·나머지 합계 불변 / 정상 `voice_a` → 그 목소리만·합계 3·1 / voiceId 없음 → byVoice 전체·voice null / 저장 행에 정말 `__proto__`·`constructor` 목소리가 있으면(JSON.parse 행) 자기 속성으로 집음·프로토타입 정상 / 전역 오염 없음 |
    | `src/modules/engine/__tests__/task012b3.test.ts` | +2: 목소리 id `__proto__`·`constructor`·`toString` 집계 → byVoice 자기 속성·값(손계산)·이름순, 저장 JSON → `parseByVoice` 왕복 동일 / byVoice 상한 불변(목소리 60개 → 요청 상위 50개 `v11..v60` 이름순, 요청 합 1830) |
    | `src/modules/speech/__tests__/task012b3Cache.test.ts` | 기존 실삭제 호출 2곳 `dryRun: false` 명시 · +2: 기본 = 계획만(행·파일 그대로, `dryRun` 결과 true), `0`·`'false'`·`null` 도 삭제 0, `dryRun:false` + store 없음 → reject(`@ts-expect-error` 로 타입 차단도 고정) / **소스 스캔**: `src/` 의 비테스트 파일(`__tests__`·`*.test.*` 제외, 스캔 파일 >100 단언)에서 `pruneTtsCache` 언급이 cache.ts 밖 0건 + cache.ts 안 호출 = 정의뿐 + 실삭제 함수는 정의 1·호출 1·비공개 |
    | `tests/live/task012b3-smoke.ts` | J3 호출만 `pruneTtsCache({ dryRun: false, maxBytes: 0, store: fixtureOnly })`(J2 는 원래 `dryRun: true` 명시라 그대로) |

  - **실행 증빙**(미러 `~/.node-local/thekaiwa-012b3`, 수정 직후 `KAIWA_LOCAL_ROOT=… sync-local.sh` rc=0 → `prisma generate` rc=0, 동기화 후 수정 파일 `diff -q` 동일 확인):
    - task 단위 3파일 `env -u DATABASE_URL node --import tsx --test --test-concurrency=1 …` → **38/38**(기존 33 + 새 5)
    - **변이 확인**(미러에서만 세 수정을 옛 동작으로 되돌려 실행 → 새 테스트 3건 `not ok`(M-1 admin·M-1 engine·M-2 기본값), 35/38 → 미러 원복 후 NFS 와 `diff -q` 동일) — 새 테스트가 회귀를 잡는다
    - `tsc --noEmit` rc=0 오류 0(tests/live 포함 — `@ts-expect-error` 가 실제 타입 오류를 짚음)
    - eslint(변경 8파일) rc=0 경고 0
    - **전체 단위 회귀** 154파일 `env -u DATABASE_URL node --import tsx --test --test-concurrency=1 $(find src -name '*.test.ts')` → **1786 중 pass 1785 · fail 0 · skip 1**(`#9 실제 배포 manifest` — 미러에 `speech/models` 없음, 기존 skip). REV-119 재실행 1765 대비 +21 = 이번 +5 + 같은 작업 트리의 다른 WP 추가분(실패 0)
    - 보이지 않는 문자(`grep -nP` 영폭·bidi·NBSP·`\u{`) 변경 파일 0건 · 엔진명 grep(변경 소스 4파일) 0건
  - **QA 인계 변경**: ① 스모크 **J3** 이 `dryRun: false` + `store: fixtureOnly` 를 명시하도록 바뀜(동작·기대값 동일 — 픽스처 3행만 실삭제). J2 는 그대로 `dryRun: true`(전체 TtsCache 읽기만). ② high_risk 4 의 `?voiceId=constructor|toString|__proto__` 기대값은 이제 **byVoice null · `summary.voice` = `{voiceId, requests:0, errors:0}`**(수정 후 모양). ③ 기본 인자 실삭제는 이제 일어나지 않지만 라이브에서 시도하지 말 것(지시 유지).
  - **남은 위험**: ① 실삭제 가드는 "의도 명시" 이지 환경 분리가 아니다 — `dryRun:false` + `store: prismaCachePruneStore` 를 명시하면 여전히 운영 캐시까지 지운다(TtsCache 환경 칸 부재는 그대로, 진입점을 열 때 다시 결정). ② `listEntries` 에 `orderBy` 가 없어 20만 행 초과 시 임의 부분집합으로 LRU 가 도는 점(REV-119 M-2 보조)은 "후보 선정 로직 불변" 지시로 손대지 않음 — `truncated` 표시만. ③ L-1 은 주석만(코드 결합·테스트 없음). L-2~L-6 은 범위 밖 그대로.
  - 미커밋 파일: 위 표 8개(+ 이전 체크포인트 목록 그대로).

### dev-012b3d (REV-123 F-1·F-2)

- [23:43] **REV-123 F-1·F-2 수정 완료 — Reviewer 재확인 요청**(신규 소환, opus. 범위: F-1·F-2 만. DB·라이브·dev 서버 접촉 0, 커밋 0, 스키마·`cache.ts`·`ttsAggregate.ts`·스모크 무변경)
  - **변경 파일**(전부 미커밋):

    | 파일 | 내용 |
    |---|---|
    | `src/modules/engine/metrics/index.ts` | **F-1**: `upsertTtsDayRow` → `insertTtsDayRowOnce(db, row): 'CREATED' \| 'EXISTED'` — `engineMetricsDaily.create` 만 쓴다. 실패하면 오류 코드로 가르지 않고 `findUnique({connectionId_date})` 로 다시 읽어 행이 있으면 `'EXISTED'`(덮지 않음, P2002·P2034 모두), 없거나 다시 읽기도 실패하면 **원래 오류**를 다시 던진다. `update`·`upsert` 호출 0. `TtsMetricsStore.upsertDay` → `insertDayIfAbsent(row): Promise<boolean>`(만들었을 때만 true). `materializeTtsDays` 반환 = **실제로 만든 행 수**(이전: 시도 수 `missing.length`). 머리 주석·`rowData` 주석을 write-once("먼저 커밋된 행이 남는다 — 가장 완전한 값이 이기는 것은 아님, 정의 변경 시 행 삭제 + 재조회") 로 정정. 오늘 미물화·`writable` 규칙 무변경. **F-2**: `liveDay` 가 계산 뒤 캐시를 다시 읽어 `!cur \|\| cur.at <= now` 일 때만 `set`(더 이른 `now` 로 시작해 늦게 끝난 계산이 신선한 항목을 덮지 않음). 응답은 각 요청이 자기 계산값 그대로. 진행 중 Promise 공유(선택)는 하지 않음 |
    | `src/modules/engine/__tests__/task012b3.test.ts` | `MemStore.upsertDay` → `insertDayIfAbsent`(실제 `insertTtsDayRowOnce` 를 태우는 가짜 db: `create` 는 행 있으면 P2002, `findUnique`; `update`·`upsert` 는 Prisma 의미대로 흉내 내되 `overwrites` 로 셈) + `scanGates`(스캔 순번별 — 결과를 정한 뒤 대기). 기존 "동시성" → `inserts` 2·**반환 합 1**·`overwrites` 0·행 1·값 동일. 기존 "P2002 → update" 테스트 → **`insertTtsDayRowOnce` 계약**(성공 CREATED·data 모양·DbNull / P2002+행 있음 EXISTED·`create,findUnique`·where 키 / P2034+행 있음 EXISTED / P2002+행 없음 → 원래 오류 / 다시 읽기 실패 → 원래 오류 / 어떤 경우도 update·upsert 0). **신규 2**: ① write-once 서로 다른 스냅샷(REPRO-1 반전) — B(더 완전, requests 2) 먼저 커밋 → 늦게 끝난 A 는 행 값 그대로·`computedAt`=B 의 now·A 반환 0·하루 뒤 재호출 0행·스캔 없음 / 순서를 바꿔 A 가 먼저 커밋하면 A 값(requests 1) 유지(첫 커밋 유지 의도 고정) ② liveCache 겹침(REPRO-2 반전) — A(now t0) 지연·B(t0+5s) 먼저 → A 풀림(자기 값 1 반환) → C(t0+10s) 히트로 B 값 2·`computedAt` t0+5s·스캔 2 / 60초 뒤 D(t0+65s) 재스캔 3·E(t0+70s) 히트 `computedAt` t0+65s(교체 경로 유지). `다른 환경 보기` 테스트의 `store.upserts` → `store.inserts` |

  - **실행 증빙**(미러 `~/.node-local/thekaiwa-012b3`, `KAIWA_LOCAL_ROOT=… sync-local.sh` rc=0 → `prisma generate` rc=0, 동기화 후 두 파일 `diff -q` NFS 와 동일. 전부 `DATABASE_URL="mysql://invalid:invalid@127.0.0.1:1/invalid"` 로 덮어씀):
    - task 단위 3파일(`engine`·`admin`·`speech` `task012b3*.test.ts`) → **40/40** pass · fail 0(기존 38 + 신규 2, P2002 테스트는 교체라 수 불변)
    - **변이 확인**(미러에서만, `index.ts` 를 옛 동작으로 되돌려 실행 → 원복 후 NFS 와 `diff -q` 동일): F-1 되돌림(upsert + P2002→update) → **37/40**, `not ok` = 동시성(반환 합 기대 1·실제 2)·`insertTtsDayRowOnce` 계약·**write-once(기대 requests 2·실제 1 — 값 덮어쓰기를 값 단언으로 잡음)** / F-2 되돌림(무조건 set) → **39/40**, `not ok` = liveCache 단조 갱신(C 기대 2·실제 1)
    - **전체 단위 회귀** 157파일 `node --import tsx --test --test-concurrency=1 $(find src -name '*.test.ts')` → **1810 중 pass 1809 · fail 0 · skip 1**(`#9 실제 배포 manifest` — 미러에 `speech/models` 없음, 기존 skip). REV-123 재실행 1806 대비 +4 = 이번 +2 + 같은 작업 트리의 다른 WP 추가분 2 [추측 — 파일 수 157 동일, 다른 파일 안 테스트 증가로 봄]
    - `tsc --noEmit` rc=0 오류 0 · eslint(변경 2파일) rc=0 경고 0
    - 보이지 않는 문자(`grep -nP` 영폭·bidi·NBSP·`\u{`) 0건 · 엔진명 grep(`index.ts`) 0건 · `upsertDay`·`upsertTtsDayRow`·`.upserts` 잔존 참조(`src` `tests` `scripts`) 0건
  - **호출자 영향**[확인]: `materializeTtsDays` 반환값을 쓰는 비테스트 코드 없음(`getTtsMetrics` 는 `await` 만). `engine/index.ts` 는 `materializeTtsDays`·`TtsMetricsStore` 타입을 export — 타입의 메서드 이름이 바뀌었지만 이 타입을 구현하는 곳은 `prismaTtsMetricsStore`·테스트 `MemStore` 뿐(grep). `insertTtsDayRowOnce` 는 `metrics/index.ts` 에서만 export(engine 공개 API 아님).
  - **FINAL_GRACE_MS 10분(선택)**: **하지 않음** — 2분이 모자란다는 관측 근거가 없고(REV-123 ① 상세 1: INSERT→커밋 ms~초), 바꾸면 스모크 머리 주석·문서 초안 문구까지 범위가 번진다.
  - **QA 인계**(스모크 코드·기대값 변경 없음 — `tests/live/task012b3-smoke.ts` 그대로):
    1. **C(행 삭제 → 동시 두 요청) 를 3~5회 반복**(스모크를 반복 실행) — 매번 C1 이 200·200·행 6·값 = 처음과 같음. **500 이 한 번이라도 나오면 즉시 기록**(실 MariaDB 의 INSERT 경합 오류 → `findUnique` 재조회 경로는 가짜 DB 로만 검증됨 — 이 반복이 유일한 실 DB 증거).
    2. D 재조회 멱등(행 6·`computedAt` 불변) + C 가 행을 지운 뒤 다시 계산해 같은 값이 돌아오는지(정의 변경 복구 경로가 write-once 이후에도 살아 있음).
    3. G 60초 캐시는 기존 그대로. liveCache 겹침은 단위 테스트로만 증명(라이브 재현 불가).
    4. 나머지 high_risk(REV-119 1~7·REV-123 갱신분) 그대로.
  - **문서 초안 정정**(Leader 몫 — 위 dev-012b3-2 초안의 `domain-model.md` 2303행 문구): "계산해 upsert" → "**계산해 INSERT(write-once — 이미 있으면 건드리지 않음, 겹치면 먼저 커밋된 행 유지)**".
  - **남은 위험**: ① write-once 는 "첫 커밋 승" 이지 "가장 완전한 값" 이 아니다 — 끝난 날 이후 Trace 가 바뀌지 않는다는 가정(INSERT 시각 = `createdAt`·유예 120초)에 기대며, 깨지면(집계 단계 추가·`appendTraceSteps` 로 집계 대상 단계를 덧붙이는 변경 — REV-123 I-4) 행 삭제 + 재조회로 복구. ② 실 MariaDB 의 `create` 경합 오류 형태(P2002/P2034)·트랜잭션 가시성은 미검증 — 판정을 오류 코드가 아니라 "다시 읽어 행이 있나" 로 해서 형태 의존은 줄였지만, `findUnique` 가 아직 커밋 안 된 상대 행을 못 보는 창이 있으면 원래 오류가 500 으로 나간다 [추측 — InnoDB 유니크 위반은 상대 커밋 후 보고되므로 가능성 낮음]. QA C 반복으로 확인. ③ (이월, REV-123 ③) TTS 캐시 정리의 행 삭제↔재생성 경합과 HIT `lastHitAt` fire-and-forget 경합 — 정리 진입점을 여는 task 에서 키별 상호 배제 또는 "파일 rename 먼저 → 행 조건부 삭제 → unlink" 순서와 TtsCache 환경 칸 문제를 함께 결정. ④ 겹친 미스의 중복 스캔(thundering herd)은 남아 있다(정확성 무관, 선택 항목 미적용).
  - self_check: unit_test ✓ · lint ✓ · type_check ✓ · engine_name_leak ✗ · native_change ✗. risk_level: LOW.
  - 미커밋 파일: 위 표 2개(+ 이전 체크포인트 목록 그대로).

## Reviewer 기록 (REV-119)

- [23:55] **REV-119 판정: PASS_WITH_NOTES** — Critical 0 · High 0 · **Medium 2** · Low 6 · Info 4. 기준 커밋 `5c3a701` 미커밋 작업 트리, 미러 `~/.node-local/thekaiwa-012b3` 를 현재 NFS 상태로 재동기화해 재실행(DB·dev 서버·라이브·운영 접촉 0). 코드·스키마·문서 수정 0(이 절만 기록).
- 7영역 모두 검토. Critical 없음 → QA 진행 금지 사유 없음. Medium 2건은 QA 병행 또는 직후 소규모 수정 권고(수정 시 해당 파일만 Reviewer 재확인).

### 지적

| ID | 심각도 | 위치 | 내용·근거 | 고칠 방법 |
|---|---|---|---|---|
| M-1 | Medium | `src/modules/admin/diagnostics/tts.ts:43`(`ttsDayDto`)·`:74`(`summarize`) · 같은 계열 `src/modules/engine/metrics/ttsAggregate.ts:216-218`(`finish`)·`:265-272`(`parseByVoice`) | `voiceId` 쿼리는 `VOICE_ID=/^[\w.:-]{1,60}$/`(:17)를 통과하는 `constructor`·`toString`·`hasOwnProperty`·`__proto__` 를 받는데, `d.byVoice?.[voiceId]` 가 일반 객체의 프로토타입 키를 집는다. **직접 재현**(저장소 밖 스크립트, byVoice 가 있는 날): `?voiceId=constructor` → `byVoice: {}`(null 이어야 함), `summary.voice: {requests:null, errors:null}`(NaN→null, 정본 DTO 는 number), `?voiceId=__proto__` → `byVoice: {"__proto__":{}}`. 전역 오염은 없음(지역 객체에만 영향) · 관리자(DEVELOPER+) 전용 · 응답 모양 계약 위반일 뿐이지만, 같은 부류를 `range` 에는 `hasOwnProperty` 로 막고(tts.ts:28, 테스트도 `toString`·`__proto__`) voiceId 에는 빠뜨렸다. 집계 쪽은 voiceId 가 `__proto__` 인 단계가 오면 byVoice 가 `{}`(null 이어야 함) — VoiceProfile.id 가 그 값일 가능성은 사실상 0 → Low 수준. | `Object.hasOwn(d.byVoice, voiceId)`(또는 `Map`) 로 조회, 집계·`parseByVoice` 는 `Object.create(null)`/`Object.fromEntries`. 테스트에 `constructor`·`toString`·`__proto__` 3건 추가(기대: byVoice null, voice 합계 0·0). |
| M-2 | Medium | `src/modules/speech/tts/cache.ts:219-227`(`pruneTtsCache`) | Leader 질문 "dryRun 만 있는 이유가 **코드 가드로** 보장되는가" → **아니오**. `dryRun` 기본값은 falsy 라 인자 없이 부르면 **실제 삭제**(`if (opts.dryRun) return result`, :227; 결과 필드는 `opts.dryRun === true`). 이 task 에서 "실행 진입점 없음" 은 호출자 부재일 뿐이다: `speech/tts/index.ts`·`speech/index.ts` 에 cache 재export 없음 [확인 — grep `cache'` 0건], `src/app`·`scripts`·`ecosystem.config.js` 호출 0 [확인 — 호출은 단위 테스트·`tests/live/task012b3-smoke.ts:238,241` 뿐], 이를 고정하는 회귀 테스트도 없다. 위험의 실체는 정본 근거 그대로 — `TtsCache` 환경 칸 없음 · dev(`APP_ENV=LOCAL`)와 운영(`PRODUCTION`)이 같은 `DATA_ROOT`(양쪽 `.env` 실측 [확인]) → 기본 호출이 운영 캐시까지 지운다(캐시라 데이터 손실은 아니고 재합성·M4 부하). 보조: `listEntries` 에 `orderBy` 가 없어(:191) 20만 행 초과 시 임의 부분집합으로 "LRU" 가 돈다(`truncated` 표시만). | 기본을 `dryRun: true` 로 뒤집고 실행은 명시 인자(`dryRun:false`) + 이름 있는 확인 플래그로. `src/` 에서 `pruneTtsCache` 호출이 테스트 밖에 0건임을 소스 스캔 테스트로 고정(synthesize.ts 소스 스캔과 같은 방식). 실행 진입점을 열 때 환경 칸 문제를 다시 판단. |
| L-1 | Low | `src/modules/engine/metrics/index.ts:33` | `MATERIALIZE_LOOKBACK_DAYS = 90` 이 정책 키 `AppSetting trace.retentionDays`(기본 90, RESTART_REQUIRED·policy — `engine/configuration/appSettingSchema.ts:85`, `prisma/seed.ts:89`)와 이중 정의. 정책이 바뀌고 purge(미구현)가 생기면 보존 밖 날에 거짓 0 행이 쓰인다(주석이 막겠다던 바로 그것). 또 물화가 **조회 의존**이라 아무도 대시보드를 90일간 안 열면 purge 전에 굳히지 못한다 — 주석(:16)에 "purge 전에 `materializeTtsDays` 먼저"만 있고 강제 장치·후속 항목이 없다(domain-model 미결 "Trace purge 전 물화"와 연결). | 정책 값을 읽어 `min(90, retentionDays)` 로 쓰거나, 최소한 두 값의 결합을 테스트로 고정. purge 구현 task 에 선행 물화 호출을 완료 기준으로 적는다(후속 이슈 등록 권고). |
| L-2 | Low | `src/modules/engine/index.ts:31` · `src/modules/admin/index.ts:83` | 공개 export 가 필요보다 넓다. engine: 쓰기 함수 `materializeTtsDays` 와 `kstDayBounds`·`isFinalDay`·`clearTtsLiveCache`·`PERCENTILE_MIN_SAMPLES`·`MATERIALIZE_LOOKBACK_DAYS` 는 비테스트 소비자 0(테스트는 `../metrics` 직접 import) [확인 — grep]. admin: `parseTtsMetricsRange`·`parseTtsVoiceId`·`TTS_METRICS_RANGES` 도 동일(라우트는 `getTtsMetricsDto` 만 사용). engine 은 admin·speech·learning·conversation 이 index 로 import 가능해 쓰기 함수가 노출된다. | 쓰는 것만 남기고(012c-3 가 필요하면 그때 추가) `materializeTtsDays` 는 engine 내부 전용으로. |
| L-3 | Low | `src/modules/engine/metrics/index.ts:203` · `:327-334` | (a) 스캔 상한 초과는 일반 `Error` → 500(`toErrorResponse` 기본), 부분 저장 없이 **다음 요청도 같은 범위를 다시 읽고 다시 실패**(영구 고장 모양). (b) 다른 환경 보기(`writable=false`)의 행 없는 끝난 날 즉석 집계는 **캐시가 없어** 90d 요청마다 최대 89일치를 다시 훑는다(`trace.read`+`environment.policy` 곧 SUPER_ADMIN 전용이라 위험은 낮음). 둘 다 1인 앱 규모에선 비현실적. | (a) `ApiError`(503/`TTS_METRICS_TOO_LARGE` 류)로 매핑하거나 LIVE 폴백 (b) gap 계산 결과도 60초 캐시. 지금은 기록만. |
| L-4 | Low | `src/modules/engine/metrics/index.ts:254,320`(`fallbackKeyOf(all)`) | 고아 실패의 연결 귀속은 **물화하는 순간의 연결 상태**로 정해진다. 켜진 TTS 연결을 A→B 로 바꾼 뒤 과거 날이 늦게 물화되면, TTS 단계가 하나도 없던 턴(자막 전환·전 연결 불가)의 고아 실패가 B 로 붙는다(`existedOn` 은 B 생성 전 날 행을 막지만 A 의 날에는 B 가 아닌 A 가 맞다). 이중 집계는 없다(한 건은 한 연결에만). 영향은 연결 교체 전후 며칠 안의 소수 오류. | 수용 가능 — 정본 주석에 "교체 전후 날은 귀속이 근사"를 한 줄. |
| L-5 | Low | `src/modules/engine/metrics/index.ts:139`(`upsertTtsDayRow`) | 동시 생성 경합은 `P2002` 만 처리. MariaDB 에서 같은 유니크 키 동시 INSERT 가 데드락(Prisma `P2034`)으로 질 수 있고 그 경우 재시도 없이 500 한 번(다음 요청은 성공). 복합 유니크 upsert 가 Prisma 네이티브 upsert 인지는 확인 못 함 [추측]. 단위 테스트의 `MemStore` 는 이 경합을 흉내만 낸다(아래 한계). | `P2034` 도 1회 재시도하거나 스모크 C 를 반복 실행해 실측. |
| L-6 | Low | 이력서 문서 초안(아래 7항 대조) | 초안이 코드와는 맞지만 정본에 남는 모순 3개를 안 짚음: (a) `domain-model.md:2724`(제안 본문)가 여전히 `queueDelayMs`·`modelLoadMs` 칸을 열거 — 승인·구현은 6칸뿐 (b) `16-tts-productization-layer.md` §10 P1 행(432)의 완료 기준 "예열 후 첫 청크 HIT" 이 Leader 정정(23:30, 예열·정리 실행 범위 밖)과 어긋난 채 남음 (c) 16 §7.3 대시보드 항목 중 Requests/min·폴백 건수·Engine 별·Model Load Time 은 이 API 가 못 준다(일 단위·연결별) — 012c-3 범위로 명시 필요. | Leader 문서 일괄 반영 때 (a)(b)(c) 포함. |

참고(Info, 결함 아님): ① 지연 백분위는 **성공한 MISS 만**이라 타임아웃(8s)이 p99 에서 빠진다 — 대시보드는 오류율을 p99 옆에 같이 보여야 한다(012c-3 화면 지침). ② 기간 합계 적중 수는 저장 비율(소수 4자리)×요청 수 복원이라 하루 요청이 수천을 넘으면 어긋난다(예: 요청 20,000·적중 7 → 저장 0.0004 → 복원 8) — Developer 기록 ⑤와 같고 1인 앱에선 무영향. ③ TURN Trace 64단계 절단(`appendTraceSteps`)은 기존 동작이며 물화 시점에 따라 청크 수가 소폭 달라질 수 있다. ④ GET 이 파생 행을 쓴다 — 이력서 초안이 명시했고 AuditLog·ConfigurationVersion 대상 아님(설정이 아닌 파생 집계)은 CLAUDE.md 금기와 충돌하지 않는다.

### 감사 초점별 판정

1. **물화 정확도·결정성 — 일치.** 정의 5곳이 같은 값을 말한다(`ttsAggregate.ts` 머리 주석 ↔ `PERCENTILE_MIN_SAMPLES` {50:1,95:20,99:100} ↔ `types/admin.ts` 주석 ↔ 단위·스모크 기대값 ↔ 문서 초안). KST 하루 [00:00,+24h)·끝난 날 = 끝+2분 유예·오늘/유예 중 어제는 저장 0·즉석 집계 60초 캐시·0 행 물화·연결 생성 전 날 제외·90일 한도 모두 코드·테스트로 확인. 스캔 중 오류는 upsert 전에 던져 거짓 0 행이 안 쓰인다 [확인]. 유니크 `@@unique([connectionId, date])` 실제 스키마 확인(`prisma/schema.prisma:1833`, 6칸 추가는 순증 8줄) — 실 DB 인덱스는 DB 접촉 금지라 직접 못 봄(Leader 22:17 `migrate diff` 드리프트 0 기록 신뢰).
2. **`writable` — 올바름.** `index.ts:319` 기본값 = `opts.environment === currentEnvironment()`(APP_ENV), 다르면 `materializeTtsDays` 미호출(:323)·행 없는 끝난 날은 즉석 집계로만(:327-334, 저장·캐시 없음). `getTtsMetrics` 외 `materializeTtsDays` 호출자 없음 [확인]. dev `.env`=LOCAL, 운영 `shared/.env`=PRODUCTION [확인] → 개발 미러에서 SUPER_ADMIN 이 `?environment=PRODUCTION` 을 불러도 운영 행을 쓰지 않는다(단위 3건: 행 0·기존 행 그대로·생성 전 날 NONE·APP_ENV 기본값). `EngineMetricsDaily` 에는 환경 칸이 없고 환경은 `connection.environment` 로 결정 — `ttsConnections(environment)` 로만 연결을 찾아 일관. 고아 실패 규칙 변경 #2 는 `fallbackKeyOf(all)`(필터 무관·켜진 연결 1개면 그 키)로 이중 집계 없음, 과거일 근사 귀속은 L-4.
3. **권한·경계 — 적합.** 라우트 첫 문장 `requireCapability('trace.read')`(`route.ts:12`), `/traces` 와 같은 401(세션 없음)·404(콘솔 비노출)·403(`missing:["trace.read"]`)·`viewEnvironment`(다른 환경 = `environment.policy` = SUPER_ADMIN, 정본 `role-permission.md:101`). 정본 `:49`·`:89`(DEVELOPER·SUPER 만)·`:150`(`GET metrics → trace.read`) 일치. `src/app` 의 engine import 0(ESLint `boundary('src/app/**', ['engine'])` 활성, 라우트는 `@/modules/admin`·`infra` 만), admin→engine 은 `index` 경유. 응답은 집계 숫자·연결 5칸(id·key·name·status·enabled)·목소리 id 만 — 학습자 id·본문·음성·Secret 없음(단위 + 스모크 H1). 쿼리: `range` 화이트리스트(`hasOwnProperty`), `connectionId` 정규식·80자 → 파라미터화 Prisma 조회, `voiceId` 정규식·60자 — 인젝션 경로 없음, 단 M-1. 90일 30만 행 초과 500 은 L-3.
4. **`voiceId` — 원천 확인.** `synthesize.ts:195 pickVoice` → `loadTtsVoice`(`voices/registry.ts`)가 `prisma.voiceProfile.findFirst` 의 `id`(= VoiceProfile.id, seed `teacher_haruka` 류)를 돌려준다 [확인]. 엔진 쪽 `voiceModelId`·`speakerId` 는 같은 객체의 다른 칸이고 단계에는 싣지 않는다. 5곳(HIT :271 · SKIPPED :288 · 합류 :304 · MISS `synthSteps` :309 · 실패 :317) 전부 `voice.id`, 소스 스캔 테스트가 5곳·엔진 id 부재를 고정. 화이트리스트 변경은 `TTS_SYNTH` 에 `voiceId` **한 키**뿐(`metrics.ts:17`, diff 확인), 다른 단계는 버린다(테스트). 값은 `SAFE_STRING` 통과분만. 옛 Trace(voiceId 없음)와 섞여도 깨지지 않는다(손계산 H1 + 테스트). `synthSteps` 의 다른 호출자(`lexiconPreview.ts:226`·`configProbe.ts:92`)는 voiceId 없이 호출하지만 둘 다 PLAYGROUND·FUNCTIONAL_TEST 라 집계 대상 밖 — 일관성만 참고. §7.1 vs §7.2 불일치 정정 문구는 사실(16 문서 :236 `voiceId` 집계 ↔ :247 `TTS_SYNTH[i]` 허용 키에 없음, `status`·`errorCode`·`TTS` 부모 행 차이까지) 맞다.
5. **캐시 정리·예열 — 보호는 있으나 가드는 약함.** 사용 중·최근 보호: 마지막 사용 = max(lastHitAt, createdAt) 이 15분 창(서명 URL 600초보다 김, 테스트가 `>` 단언) 안이면 지우지 않고 `reachable=false` 로 알림, 계획 뒤 히트가 오른 행은 `deleteRowIfUnchanged` 가 남김, 순서 행→파일(재생 끊김 없음). 경로 안전: 파일 경로는 DB `path` 를 믿지 않고 키(16진 40자 정규식)에서만 만든다 — `../../etc/passwd` 류 키는 파일을 안 건드리고 행만 지움(테스트). 삭제 불가능·형식 틀린 키는 행만. 실행 진입점은 **없다** [확인]. 다만 코드 가드는 아님 → M-2. 예열은 후보 계획·없는 키 계산뿐(합성 호출 0). Leader 23:30 정정("예열 효과·회화 TTFA 악화 없음은 범위 밖")은 합리적 — 근거 3개: 예열은 M4 합성 부하를 만드는 쓰기 작업이라 실행 주체·AppSetting 키(`tts.cache.*` — 지금 seed·코드에 없음)·ConfigurationVersion 규칙이 정해져야 함 / `TtsCache` 환경 칸 없음 + 같은 `DATA_ROOT` / 진입점 없이는 "예열 중 TTFA" 를 측정할 수 없음. 단 16 §10 P1 완료 기준이 정정과 어긋난 채 남는 점은 L-6(b).
6. **테스트·재실행 — 직접 재실행 결과 일치.** `tsc --noEmit` rc=0·오류 0 · eslint(변경 14파일) rc=0 · eslint(engine·admin·speech·app/api/admin 디렉터리 전체) rc=0 · task 단위 3파일 **33/33** · **전체 단위 1765 중 pass 1764 · fail 0 · skip 1**(`#9 실제 배포 manifest` — 미러에 `speech/models` 없음, 기존 skip). 개발 기록은 1763 이었는데 +2 는 같은 작업 트리의 다른 WP 가 추가한 테스트(이 task 무관, 실패 0). 보이지 않는 문자 스캔(U+200B–U+200F·U+2028·U+2029·U+FEFF·U+202A–U+202E·U+00A0) 변경 파일 0건. 엔진명 grep(`engine/metrics`·`admin/diagnostics/tts.ts`·라우트) 0건. 스모크 `tests/live/task012b3-smoke.ts` 는 읽기만 했다(실행 금지): `BASE` localhost 강제·`APP_ENV=LOCAL` 아니면 throw, 픽스처는 LOCAL 행(연결 `enabled=false` key `qa012b3-tts-*`·Trace refType `qa012b3`·TtsCache 3행 2000-01-01)뿐, finally 가 id·키로 정리, K2 는 DEVELOPMENT 만 건드리고 PRODUCTION 은 읽지도 쓰지도 않음, 정리 실행은 `fixtureOnly` 저장소로 픽스처 키 한정 — 합격. 단 PRODUCTION `writable` 방어는 단위 테스트로만 증명된다(스모크 K 는 DEVELOPMENT).
7. **문서 초안 — 코드와 일치.** api-contract(2080행 `engine.read`→`trace.read`, range·connectionId·voiceId·응답 모양·GET 물화 문구)·domain-model(392·2169·2303·2650행 존재 확인, 6칸·지연 물화 문구·"조회 환경 = APP_ENV")·16 §7.3(257·421행)·§7.1/§7.2 정정 모두 코드 사실과 맞다. 반영 시 L-6 세 건 추가. 정본 파일은 아직 미수정(예상대로).
8. **범위 — 이탈 없음.** 이 task 소유: `engine/metrics/**`·`engine/index.ts`(3줄)·`admin/diagnostics/tts.ts`·`admin/index.ts`(2줄)·`app/api/admin/v1/tts/metrics/route.ts`·`types/admin.ts`·`speech/tts/{metrics,synthesize,cache}.ts`·테스트 4. `prisma/schema.prisma` 의 `EngineMetricsDaily` 6칸은 WP-DB0 작성분(순증, 승인 범위 일치), `speech/tts/{index,client}`·`speech/index.ts`·`components/**` 무변경, 기존 Trace 기록 경로(`recordTrace`·`TraceKind`) 무변경. 같은 작업 트리의 다른 WP 변경(`conversation/structuredResponse/schemas.ts`·`engine/router/tasks.ts`·`engine/__tests__/additionalPropertiesStrip.test.ts`·`tests/live/qa-session.ts`)은 이 task 파일과 겹치지 않는다(`engine/` 같은 디렉터리의 다른 파일).

### 독립 손계산 (구현 호출 전에 손으로 기대값을 정했고 이후 대조 — 스크립트는 저장소 밖 scratchpad)

| # | 입력(요약) | 손계산 기대 | 구현 | 일치 |
|---|---|---|---|---|
| H1 | PREVIEW 7건: MISS 120/240/360/480ms(rtf .30/.45/.60/.75), HIT 1, TIMEOUT 1, SKIPPED 1, voice a·b | requests 7·errors 2·avg 300·p50 240(⌈0.5·4⌉=2번째)·p95/p99 null·rtfAvg 0.525·적중 1/7=0.1429·ttfa [5,140,260,380,500] p50 260·p95 null·byVoice a{4,1,240}·b{3,1,360} | 동일 | 일치 |
| H2 | MISS ms=1..100 / 1..99 / 10..210(21개) | n=100: p50 50·p95 95·p99 99·avg 50.5→51(half-up) / n=99: p99 null·p95 95·p50 50 / n=21: p50 110(⌈10.5⌉=11번째)·p95 200(⌈19.95⌉=20번째) | 동일 | 일치 |
| H3 | TURN: synth0 MISS 700(rtf .5)·synth1 HIT·synth2 FAILED(+같은 idx `TTS[2]` FAILED)·`TTS[3]` SKIPPED(synth[3] 없음)·`TTS[0].ttfaServerMs` 720 | requests 3+고아 1=4·errors 2·적중 0.25·avg·p50 700·ttfa 720·rtf 0.5·byVoice a{3,1,700}(고아는 voice 없음) | 동일 | 일치 |
| H4 | TURN 에 연결 k1·k2 혼재 + 고아 `TTS[2]`(fallback k1 제공) | k1 요청 1(+ttfa 310)·k2 요청 1·고아는 키가 둘이라 버림(dropped 1) | 동일 | 일치 |
| H5 | KST 경계 | 2026-10-05 → [10-04T15:00Z, 10-05T15:00Z), 2026-01-01 시작 = 2025-12-31T15:00Z | 동일 | 일치 |
| H6 | 목소리 60개(v01..v60, 요청 1..60) | byVoice 상위 50개(v11..v60, 이름순)·총 요청 1830 | 동일 | 일치 |
| H7 | nearest-rank p∈{50,95,99} × n=1..5000, 정수 연산 ⌈p·n/100⌉ 와 대조 | 불일치 0 | 불일치 0(부동소수 안전) | 일치 |
| H8 | 스모크 E1(D1)·E2(D2) 기대값 재계산 | E1: 7요청·2오류·avg 633(1900/3)·p50 600·ttfa [10,520,650,850] p50 520·rtf 0.5333·적중 2/7=0.2857·byVoice A{4,0,500}·B{2,1,800} / E2: 평균 1300·p50 13번째 1300·p95 24번째 2400·p99 null·ttfa p50 1310·p95 2410 | 스모크 기대값과 동일 | 일치 |

한계(가짜 DB 테스트가 대변하지 못하는 것): `MemStore` 는 upsert 를 "조회→틈→생성" 으로 흉내 내 `upsertTtsDayRow` 의 P2002→update 분기를 실코드로 태우지만, 실제 Prisma 의 에러 코드 매핑·MariaDB 데드락(P2034)·`Prisma.DbNull` 의 실제 NULL 기록·`@db.Date` 왕복·`take`/커서 페이징의 SQL 정렬은 못 본다. 그래서 실 DB 동시성(스모크 C)과 값 대조(E1·E2)는 QA 라이브가 유일한 증거다.

### QA 에 넘길 high_risk_areas (native_change: false)

1. **물화 값 손계산 E1·E2·E3·E5** — KST 자정 전후 2분 회피(스모크 머리 주석). 표본 0 날 0·null, 오늘 LIVE·저장 0.
2. **동시 두 요청 C1 을 3~5회 반복**(행을 지우고 두 세션 동시) — 실제 Prisma 에러 코드(P2002/P2034) 경합이 단위로는 안 보임. 행 수 6·값 동일 외에 500 응답이 한 번이라도 나오는지 기록.
3. **다른 환경 보기 K** — DEVELOPER 403·SUPER 200·DEVELOPMENT 연결 행 수 불변. PRODUCTION `writable` 방어는 단위로만 증명되므로, 운영 배포 뒤에는 운영 쪽 `EngineMetricsDaily` 행 수를 읽기 전용으로만 확인(쓰기 시도 금지).
4. **입력 경계** — B1~B4 에 더해 `?voiceId=constructor`·`toString`·`__proto__`(M-1 수정 전후 응답 모양: 기대 byVoice null·voice 합계 0·0), `connectionId` 80자 초과·공백.
5. **누출 H1** — 응답에 QA 사용자 id·화이트리스트 밖 본문(`LEAK_TEXT`)·시크릿 없음. 사용자 응답(#23·#24·SSE)에 `steps`·`voiceId` 가 새로 실리지 않는지(TTS_SYNTH 칸 추가의 영향) 회귀 007 에서 확인.
6. **캐시 정리 J** — J2 dryRun 이 실 `TtsCache` 전체를 읽기만 하는지(전후 전체 행 수 불변 대조 추가 권고), J3 은 픽스처 3행만 지우는지. 기본 인자 실행(M-2)은 라이브에서 시도하지 말 것.
7. **회귀** — 007(TTS 경로)·003d·012c·005b Trace 목록/상세(단계에 `voiceId` 칸이 늘어도 표시·필터 깨지지 않음), Functional Test·Playground 는 voiceId 없이 동작.

### 다음 단계
- Leader: M-1·M-2 처리 시점 결정(권고 — QA 병행 수정, 수정 파일은 `diagnostics/tts.ts`·`ttsAggregate.ts`·`cache.ts`·테스트 3, 재확인은 이 파일들만). L-1~L-6 은 기록·후속(L-1 은 purge 구현 task 에 선행 물화 완료 기준 추가, L-6 은 문서 일괄 반영에 포함).
- 정정 판정: 완료 기준 4 정정은 합리적이며 최종 보고에 "예열·정리 실행 진입점 없음, 예열 효과 미검증" 명시 필요.

## Reviewer 기록 (REV-123)

- [23:34] **REV-123 판정: CHANGES_REQUESTED(경미)** — Critical 0 · High 0 · Medium 0 · **Low 3**(Codex 채택 2 · 수용 1) · Info 4. 범위 = Codex C2 동시성 지적 3건 판정 + dev-012b3c(REV-119 M-1·M-2) 수정 확인. 채택 2건은 Codex 가 매긴 high/medium 이 아니라 **Low** 로 하향한다(근거 아래) — 그래도 **코드 수정이 필요한 채택분이 있어** Leader 지정 규칙대로 CHANGES_REQUESTED 로 둔다. 수정은 `engine/metrics/index.ts` 1파일 + 테스트 1파일 규모이고 QA 라이브와 병행 가능하다(차단 아님). REV-119 M-1·M-2 수정은 **전부 확인**(아래 표).
- 방법: 미러 `~/.node-local/thekaiwa-012b3` 를 NFS 현재 상태로 재동기화(`KAIWA_LOCAL_ROOT=… sync-local.sh` rc=0, 변경 8파일 `diff -q` 동일) 후, 저장소 밖 scratchpad 에 재현·검증 스크립트 2개(`rev123-repro.test.ts`·`rev123-verify.test.ts`)를 써서 미러에서 실행. 전부 `DATABASE_URL="mysql://invalid:invalid@127.0.0.1:1/invalid"` 로 덮어씀. DB·dev 서버·라이브·운영(3010) 접촉 0(무인자 `pruneTtsCache()` 검증에서 `listEntries` 가 무효 주소로 연결을 시도하다 실패한 것이 유일한 시도 — 삭제 경로 이전 단계에서 끝남). 코드·스키마·문서 수정 0.

### Codex C2 지적 3건 판정

| # | Codex 심각도·위치 | 판정 | 내 심각도 | 근거 |
|---|---|---|---|---|
| ① | high · `engine/metrics/index.ts:139` (P2002 패자가 승자 행을 오래된 스냅샷으로 덮음 → 과거 지표 영구 고정) | **부분 채택** — 쓰기 경로가 "끝난 날 행은 불변" 을 강제하지 않는다는 점은 맞고, "영구 고정을 일으키는 현실적 지연" 은 현재 데이터 흐름에 없다 | **Low** | 아래 "① 상세" |
| ② | medium · `index.ts:278` (liveCache miss 겹침 → 오래된 `now` 계산이 나중에 끝나 최대 60초 과거 회귀) | **채택** (정확) — 단 회귀 폭은 "겹친 두 요청의 `now` 차" 뿐이라 영향은 사소 | **Low** | 아래 "② 상세" |
| ③ | medium · `speech/tts/cache.ts:256` (prune 행 삭제 직후 동시 재생성 → 파일 손실 → 행 있고 파일 없음) | **수용 / 범위 밖(진입점 없음)** — 인터리빙 자체는 맞지만 이미 문서화된 자가 복구 상태이고 호출 경로가 없다 | **Low** | 아래 "③ 상세" |

**① 상세 — 서로 다른 스냅샷이면 덮는 창이 있는가**

- 코드 수준: **있다** [확인 — 재현 REPRO-1]. 스냅샷 S1(1건)·S2(2건, A 의 스캔 뒤·B 의 스캔 전에 들어온 그날 소속 Trace 가정)를 주고 A 스캔 대기 → B 가 먼저 쓰고(requests 2) → A 가 늦게 쓰면 최종 `requests = 1`, 이후 `materializeTtsDays` 를 하루 뒤에 다시 불러도 0행(재계산 없음)·값 1 그대로. 덮는 것은 P2002 분기만이 아니다 — Prisma `upsert` 는 행이 이미 있으면 update 가지로 가므로(조회→분기) 동시 생성 충돌이 없어도 늦게 쓰는 쪽이 이긴다(last-writer-wins). 네이티브 `ON DUPLICATE KEY UPDATE` 로 나가는지는 확인 못 했다 [추측] — 어느 쪽이든 결과는 같다. 같은 입력이면 같은 값(REPRO-1b: 비교 동일)이라 기존 동시성 단위 테스트(`task012b3.test.ts:331`)는 같은 Trace 두 번만 증명할 뿐 "스냅샷이 다른" 경우는 어느 테스트도 못 본다.
- 입력 수준: 두 계산이 다른 값을 내려면 "날짜 D 소속인데 끝난 뒤(자정+2분)에야 보이는 Trace" 가 있어야 한다. 현재 코드에는 그 경로가 **없다**:
  1. `RequestTrace.createdAt` 은 INSERT 시각이다 — `recordTrace` 는 `createdAt` 을 넘기지 않고 스키마는 `@default(now())`(`prisma/schema.prisma:1800`) [확인]. D 소속 행은 D 안에 INSERT 되고, 가시화 지연 = INSERT→커밋(ms 단위; NAS fsync 스톨도 초 단위). 유예 120초가 흡수한다. 값을 채우는 시계가 앱 엔진인지 DB 인지는 DB 접촉 금지로 못 봤다 — NTP 동기 가정에서 어느 쪽이든 결론 같음 [추측].
  2. TURN Trace 는 턴 끝에 `recordTrace` 한 번(`orchestrator/index.ts:629`, 다른 `void recordTrace` 호출들도 즉시 INSERT)이고 TTS 단계는 그때 이미 다 들어 있다. 이후 변경은 `appendTraceSteps` 한 곳(`orchestrator/index.ts:400`, `requestTrace.update*` 는 `engine/trace/index.ts:78` 단 하나 — grep) 이고 덧붙는 것은 `PLAYBACK` 뿐 — 집계 정규식(`TTS_SYNTH[i]`·`TTS[i]`)에 걸리지 않는다 [확인].
  3. 유일한 "시점 의존" 원천: `appendTraceSteps` 가 `[...prev, ...steps].slice(0, 64)` 로 자른다(기록 시에는 절단 없음). 64단계를 넘긴 턴(청크 수십 개 — 현실적으로 거의 없음 [추측])은 물화가 덧붙이기 전/후냐에 따라 표본 수가 달라진다. 방향은 "나중이 더 적음".
  4. 그 밖의 시점 의존: `fallbackKeyOf` 가 읽는 연결 켜짐 상태(REV-119 L-4 와 같은 근사).
- "끝난 날 행은 다시 계산하지 않음" 규칙은 **영구 고정이 맞다** — `have` 집합에 있으면 `missing` 에서 빠지고 재계산 경로는 행 삭제뿐(Developer 남은 위험 ① 으로 이미 수용). 그러니 한 번 덜 완전하게 굳으면 영구인 것은 사실이나, 그 "덜 완전" 을 만드는 현실 입력이 위 1~3 에 없다. 동시 겹침 자체는 가능하다(첫 90일 조회는 89일치를 훑어 가장 길다 — 대시보드 이중 요청·블루/그린 두 프로세스) — 다만 같은 값을 쓴다.
- 결론: 설계의 약점 = "불변 행" 을 쓰기 경로가 보장하지 않고 입력의 결정성에 기댄다(코드 주석 `index.ts:12-13` 이 정확히 그렇게 적혀 있다). 지금은 이론적이지만 (a) 지표 정의가 바뀌는 배포(블루/그린 겹침)·(b) 012b-4 등이 집계 단계를 추가하는 변경에서 현실이 될 수 있고, 고치는 비용이 거의 0 이라 **채택(Low)** 한다.
- Codex 권고 평가: "분산 잠금·단일 작업 직렬화" — 과설계(MariaDB `GET_LOCK` 은 연결 고정이 필요해 Prisma 풀과 맞지 않음 [추측]). "ingestion watermark" — 스키마 변경이라 승인 범위 밖. "P2002 패자는 다시 읽기" — 채택(아래 F-1: 쓰기 전용 INSERT, 이미 있으면 건드리지 않음). 이 방식은 **"첫 커밋이 이긴다"** 일 뿐 "가장 완전한 것이 이긴다" 는 아니다 — 후자는 불변 행 모델에서 보장할 수 없고(보장하려면 정의상 재계산 경로가 필요), 현실 입력이 안 변하므로 필요 없다. 솔직히 적어 둔다.

**② 상세 — liveCache 회귀**

- [확인 — REPRO-2] A(now=t0)가 스캔 대기 중에 B(now=t0+5s)가 먼저 끝나 캐시 `at=t0+5s`, 그 뒤 A 가 끝나 `at=t0` 로 덮어씀 → C(t0+10s)는 히트로 A 의 값을 받는다(B 응답 requests 2, C 응답 1; 스캔 2회). `liveDay` 의 `set` 이 무조건이라서다(`index.ts:284`).
- 영향: 값이 되돌아가는 폭 = 두 요청의 `now` 차 사이에 생긴 Trace 몇 건, 지속 ≤ `at` 기준 60초(오히려 더 일찍 만료). 대시보드 숫자가 잠깐 한 칸 덜 보이는 정도 → Low. Codex 의 "최대 60초" 는 지속 시간으로는 맞고 크기로는 과대.
- 보강: 같은 키 미스가 겹치면 스캔도 중복(thundering herd)이다. 진행 중 Promise 공유는 선택(정확성엔 불필요).

**③ 상세 — prune 경합**

- [확인 — REPRO-3] 저장소 수준 재현: `deleteRowIfUnchanged` 직후 재생성(파일 쓰기+행 생성) → `removeFile` 이 새 파일을 지움 → 최종 행 있음·파일 없음.
- 자가 복구: `readCachedAudio` 가 "행 있는데 파일 없음" 이면 행을 지우고 MISS 로 돌려준다(`cache.ts:83-86`), 합성 직후 서명 URL 404 경합은 `recallRecentAudio` 가 먼저 보도록 이미 처리돼 있다(`audioUrl.ts:87-91` 호출 순서·주석 확인, 보관 시간·프로세스 간 공유 여부는 읽지 않음). 이 시나리오는 `cache.ts:252-254` 주석이 이미 명시했고(개발자가 의도한 순서 "행 → 파일"), 최악 결과는 재합성 1회 또는 한 청크 재생 실패 1회(재시도로 회복)이며 데이터 손실은 없다.
- 도달 조건: ⓐ 정리 실행이 있어야 하는데 **진입점 0**(`src/` 비테스트 호출 0 — 아래 M-2 확인) ⓑ 15분 넘게 안 쓰인 키가 ⓒ 행 삭제~파일 삭제(수 ms) 사이에 다시 요청돼야 한다.
- Codex 가 놓친 더 가까운 잔여 경합: HIT 의 `lastHitAt` 갱신이 fire-and-forget(`cache.ts:87` `void prisma.ttsCache.update(...).catch`)이라 plan↔delete 사이에 온 HIT 가 있으면 조건부 삭제는 통과하고(`lastHitAt` 아직 안 올라감) 갱신은 P2025 로 삼켜져 곧 올 #24 조회가 MISS/404 가 된다. 확률 극저(미사용 15분+ 키만 후보), 같은 처리.
- 조치: 이번 task 코드 수정 없음. **진입점을 여는 task 로 이월** — 키별 상호 배제 또는 "파일을 먼저 `.pruned` 로 rename → 행 조건부 삭제 → unlink(행이 바뀌었으면 되돌림)" 순서를 그때 결정(TtsCache 환경 칸 문제와 함께, 이미 Developer 남은 위험 ①).

### REV-119 M-1·M-2 수정 확인(dev-012b3c)

| 항목 | 방법 | 결과 |
|---|---|---|
| M-1 `voiceId` 프로토타입 키 | `getTtsMetricsDto` 를 가짜 deps(byVoice 있는 날 + 저장 행에 JSON.parse 로 만든 진짜 `__proto__` 목소리)로 직접 호출, `JSON.stringify` 뒤 모양 확인 | `constructor`·`toString`·`hasOwnProperty`·`valueOf`·`isPrototypeOf`·없는 `voice_zz` 전부 byVoice `[null,null]`, `summary.voice = {voiceId, requests:0, errors:0}`, 나머지 합계(요청 10·오류 2) 불변 **일치**. 저장 행에 진짜 `__proto__` 가 있으면 자기 속성으로 집힘(`{"__proto__":{requests:9…}}`, 합계 9/9)·`{}.requests` 는 undefined — 전역 오염 없음. 정상 `voice_a` 는 그 목소리만 |
| M-1 `Object.fromEntries` 가 상한·정렬을 바꾸지 않는가 | 목소리 60개(요청 1..60)·정수형 id | 상위 50(`v11..v60`)·이름순·요청 합 1830 **불변**. 정수형 id 는 `['1','3','20']` — 일반 객체의 정수 키 규칙으로 변경 전후 같음 |
| M-2 기본 dryRun | `pruneTtsCache({store, …})` 를 `dryRun` 생략·`true`·`0`·`'false'`·`null`·`undefined`·`NaN`·`''` 로 호출 | 전부 `dryRun=true`·삭제 0·행/파일 그대로·호출 기록 `list` 뿐 **일치** |
| M-2 실삭제 조건 | `dryRun:false` 만 / `dryRun:false, store:undefined` / `dryRun:false, store` | 앞 둘은 DB 읽기 전에 throw(`store` 메시지), 셋째만 삭제(2행·2파일) — 런타임 가드 확인. 타입 가드(`PruneTtsCacheOptions` 유니온 + `@ts-expect-error`)는 tsc rc=0 으로 확인 |
| M-2 호출·노출 | grep(`src` `tests` `scripts` `ecosystem.config.js`) | `pruneTtsCache` 비테스트 `src/` 호출 **0**(cache.ts 정의·주석·가드 메시지뿐). 삭제 함수 `deleteFromSharedCacheIncludingProduction` 은 비 export·정의 1·호출 1(`cache.ts:243`). `speech/index.ts`·`tts/index.ts` 에 cache 재export 없음. `prismaCachePruneStore` 소비 = cache.ts 자신 + 스모크 |
| 스모크 J2·J3 | `tests/live/task012b3-smoke.ts:238-241` 정독(실행 금지) | J2 `dryRun:true`(전체 읽기만), J3 `dryRun:false` + `store: fixtureOnly`(`listEntries` 를 픽스처 키 3개로 필터) — 명시 **확인** |
| L-1 주석 | `index.ts:35-40` | 주석만 추가, 코드 변경 0 — 확인 |

- 한계(수용): 가드는 "의도 명시" 이지 환경 분리가 아니다 — `dryRun:false` + `store: prismaCachePruneStore` 를 명시하면 여전히 운영 캐시까지 지운다(Developer 남은 위험 ① 과 동일). REV-119 가 권고한 "이름 있는 확인 플래그" 대신 `store` 명시를 의도 표식으로 삼았는데, 진입점이 없는 현 시점에서는 수용한다 — 진입점을 열 때 환경 칸 문제부터.

### 직접 재실행 숫자(미러 `~/.node-local/thekaiwa-012b3`, 무효 `DATABASE_URL`)

| 항목 | 결과 |
|---|---|
| task 단위 3파일(`engine`·`admin`·`speech` `task012b3*.test.ts`) | **38/38** pass · fail 0 (기대 38 일치) |
| 전체 단위(`--test-concurrency=1`, 157파일) | **1806 중 pass 1805 · fail 0 · skip 1**(`#9 실제 배포 manifest` — 미러에 `speech/models` 없음, 기존 skip) |
| 기대 대비 | Developer 기록 1786(154파일) → +20/+3파일 = 같은 작업 트리의 다른 WP 테스트(`challenge*`·`task042`·`topic*`)가 늘어난 것 — 이 task 파일 아님, 실패 0 [확인: `git status` 신규/변경 테스트 목록] |
| `tsc --noEmit` | rc=0 · 오류 0(tests/live 포함) |
| eslint(task 변경 14파일) | rc=0 · 경고 0 |
| 보이지 않는 문자 스캔(U+200B–U+200F·U+2028·U+2029·U+FEFF·U+202A–U+202E·U+00A0·`\u{`) 변경 파일 | 0건 |
| 엔진명 grep(`reazon·whisper·style-bert·sbv2·claude`, 변경 소스 4파일) | 0건 |
| 이 task 밖 변경 | `prisma/schema.prisma` 는 WP-DB0 작성분(+69 순증), `speech/index.ts`·`tts/index.ts` 무변경 |

### 수정 지시 초안 (→ developer, 신규 소환 `dev-012b3d`)

- **소유 파일**: `src/modules/engine/metrics/index.ts` · `src/modules/engine/__tests__/task012b3.test.ts`. 읽기만: `ttsAggregate.ts`·`cache.ts`·스키마·스모크(머리 주석 한 줄 정정은 선택). 스키마·`cache.ts`·`ttsAggregate.ts` 변경 금지. 문서 반영은 Leader.
- **F-1 (① 채택) 끝난 날 행 = write-once**:
  - `upsertTtsDayRow` → INSERT 전용(`insertTtsDayRowOnce` 처럼 이름도 바꿔 의미를 드러낼 것): `db.engineMetricsDaily.create({ data: { connectionId, date, ...data } })`. 실패하면 `findUnique({ where: connectionId_date })` 로 다시 읽어 **이미 있으면 정상 반환**(P2002·P2034 데드락 모두 흡수 — 코드 분기 대신 "행이 생겼나" 로 판정), 없으면 원래 오류를 다시 던진다. `update`·`upsert` 호출을 없앤다(`MetricsDayDb` Pick 을 `'engineMetricsDaily'` 그대로 두되 쓰는 메서드는 `create`·`findUnique`).
  - `TtsMetricsStore.upsertDay` → `insertDayIfAbsent`(또는 동등)로 이름·의미 변경, `materializeTtsDays` 의 반환값 = **실제로 만든 행 수**(`CREATED` 만 셈. 현재는 시도 수 `missing.length`). 호출자 `getTtsMetrics` 는 반환값을 쓰지 않는다 — 영향 없음.
  - 머리 주석 `index.ts:12-13`("진 쪽이 update 로 같은 값을 덮는다") → "끝난 날 행은 write-once: 이미 있으면 건드리지 않는다. 두 요청이 겹치면 먼저 커밋된 행이 남는다(같은 Trace 는 같은 값)". "가장 완전한 값이 이긴다" 가 아니라는 점도 한 줄.
- **F-2 (② 채택) liveCache 단조 갱신**: `liveDay` 의 `liveCache.set` 을 `const cur = liveCache.get(ck); if (!cur || cur.at <= now.getTime()) liveCache.set(...)` 로. (선택) 진행 중 계산 Promise 를 키별로 공유해 겹친 미스의 중복 스캔을 없앤다 — 하지 않아도 됨. 응답으로는 각 요청이 자기가 계산한 값을 돌려줘도 된다.
- **③ 코드 수정 없음.** 이월 항목을 이력서 "남은 위험"에 한 줄(진입점 개방 task 에서 키별 잠금 또는 rename-먼저 순서 결정 + HIT `lastHitAt` fire-and-forget 경합).
- **테스트(`engine/__tests__/task012b3.test.ts`)**:
  1. `MemStore.upsertDay` → INSERT 전용(이미 있으면 P2002 형 오류)로 바꾸고, `upsertTtsDayRow — P2002…` 테스트를 새 계약으로 교체: P2002 → `create` 1회·`update`/`upsert` 호출 0·정상 반환 / 오류 + 행 없음 → 원래 오류 재던짐 / 비 P2002 오류(예: P2034) + 행 있음 → 정상 반환.
  2. `동시성` 테스트(331행): 행 1개·값 같음 유지, `a + b` 단언을 새 반환 의미(만든 행 수 = 1)로.
  3. **신규 "서로 다른 스냅샷"**(내 REPRO-1 을 뒤집은 단언): A 스캔을 게이트로 잡고 B 가 더 완전한 스냅샷으로 먼저 쓴 뒤 A 를 풀어도 행은 B 의 값 그대로(requests 2) · 하루 뒤 재호출 0행 · `computedAt` 불변. 순서를 바꿔 A 가 먼저 쓰면 A 의 값이 남는다(= 첫 커밋 유지)는 단언도 한 줄 — 의도(write-once)를 고정.
  4. **신규 liveCache 겹침**(내 REPRO-2 를 뒤집은 단언): 게이트로 A(now=t0) 지연·B(now=t0+5s) 먼저 → A 풀림 → C(t0+10s) 는 B 의 값(requests 2)을 보고 스캔은 2회. 60초 뒤 갱신 경로(`at` 이 더 새로워질 때 교체)도 유지됨을 한 줄.
  5. 변이 확인(dev-012b3c 와 같은 방식): 미러에서 F-1·F-2 를 옛 동작으로 되돌려 새 테스트 3건이 `not ok` 가 되는지.
- **완료 기준**: task 단위 3파일 통과(기존 38 + 새 ≥2 − 교체분), tsc 0, 변경 파일 eslint 0, 전체 단위 회귀, 보이지 않는 문자·엔진명 0, 스키마·`cache.ts` 무변경. 보고에 변경 파일·실행 증빙·남은 위험.
- **QA 확인 항목(수정 후)**: 스모크 C(동시 두 요청) 3~5회 반복 — 행 6·값 동일·**500 한 번도 없음**(P2002/P2034 실제 경합이 가짜 DB 로는 안 보임 — Codex 도 같은 범위를 못 봤다고 적음) · D 재조회 멱등(`computedAt` 불변) · 행을 일부러 지운 픽스처 연결이 다시 계산되는지(정의 변경 복구 경로) · G 60초 캐시.
- (선택, 하지 않아도 됨) `FINAL_GRACE_MS` 2분 → 10분: 어제 값이 10분 동안 LIVE 로 보일 뿐 비용 0 이고 INSERT 지연·시계 어긋남 여유가 커진다. 바꾸면 스모크 머리 주석("KST 자정 전후 2분")·문서 초안의 "2분" 문구도 함께.

### 지적 목록(REV-123)

| ID | 심각도 | 위치 | 내용 | 고칠 방법 |
|---|---|---|---|---|
| L-7 | Low | `engine/metrics/index.ts:140-150`(`upsertTtsDayRow`)·`:263-266` | Codex ① 채택 — 끝난 날 행이 불변이 아니다(last-writer-wins). 서로 다른 스냅샷 재현 REPRO-1 에서 늦은 쓰기가 더 완전한 행을 덮고 재계산이 없다. 현재 데이터 흐름에는 스냅샷이 달라질 현실 경로가 없어(위 ① 상세) 이론적 | F-1 write-once |
| L-8 | Low | `engine/metrics/index.ts:278-288`(`liveDay`) | Codex ② 채택 — 겹친 미스에서 늦게 끝난 오래된 `now` 가 신선한 캐시 항목을 덮어 다음 요청이 과거 값을 본다(REPRO-2). 회귀 폭 = 두 `now` 의 차 | F-2 단조 갱신 |
| L-9 | Low | `speech/tts/cache.ts:256-274` | Codex ③ 수용 — 행 삭제 직후 재생성 + 파일 삭제 → 행만 남음(REPRO-3). 자가 복구·진입점 0 이라 코드 수정 불요, 진입점 task 로 이월 | 이월(위 ③ 조치) |
| I-1 | Info | `engine/trace/index.ts:75` | `appendTraceSteps` 의 64 절단이 물화 시각에 따라 표본 수가 달라지는 유일한 시점 의존 원천(64단계 넘는 턴만, 방향은 "나중이 더 적음") | 기록만 |
| I-2 | Info | `engine/__tests__/task012b3.test.ts:331` | 기존 동시성 테스트가 "같은 Trace 두 번" 만 증명 — 서로 다른 스냅샷을 못 본다 | F-1 테스트 3 으로 보강 |
| I-3 | Info | `index.ts:31` | `FINAL_GRACE_MS` 2분 — 선택적 확대(위) | 선택 |
| I-4 | Info | task-012b-4 | 새 "집계 대상" 단계는 반드시 **기록 시점**(`finishTrace`·턴 `recordTrace`)에 싣는다 — `appendTraceSteps` 로 끝난 날 이후에 덧붙이면 굳은 행에 반영되지 않는다. `TTS_TIMING` 은 집계 대상이 아니라 지금은 무관 | 012b-4 지시에 한 줄 |

### QA 에 넘길 high_risk_areas 갱신 (native_change: false)

REV-119 목록(1~7)은 그대로, 아래만 바뀐다. 최종 코드는 **dev-012b3d 수정 후** 기준.
1. (2번 갱신) **동시 두 요청 C 를 3~5회 반복** — 수정 후 기대: 행 6·값 동일·응답 전부 200. 이번 판정이 Codex 와 공유하는 미검증 범위("MariaDB 실 인스턴스의 Prisma upsert/INSERT P2002·P2034 형태")는 **이 스모크가 유일한 증거**다. 500 이 한 번이라도 나오면 즉시 기록.
2. (신규) **D 재조회 불변 + 행 삭제 후 재계산** — 행을 지우면 다시 계산돼 같은 값이 돌아오는지(정의 변경 복구 경로가 write-once 이후에도 살아 있는지).
3. (4번 기대값 확정) `?voiceId=constructor`/`toString`/`__proto__` → byVoice null · `summary.voice` `{voiceId,0,0}`(REV-123 직접 호출로 확인된 모양).
4. (6번 갱신) J3 은 `dryRun:false`+`store: fixtureOnly`. J2 는 읽기만 — 전후 전체 `TtsCache` 행 수 불변 대조 권고 유지. 기본 인자 실삭제는 이제 일어나지 않지만 라이브에서 시도 금지.
5. (신규) liveCache 겹침은 **단위 테스트로만** 증명된다(라이브에서는 두 미스가 겹칠 확률이 낮아 재현 불가) — QA 는 기존 G(60초 안 재조회는 스캔 안 함)만 확인.

### 남은 위험

- 끝난 날 행이 write-once 가 돼도 "가장 완전한 값" 은 보장되지 않는다(첫 커밋 승) — 현실 입력이 안 변한다는 가정(INSERT 시각 = `createdAt`·유예 120초)에 기댄다. 이 가정이 깨지는 변경(집계 단계 추가·`createdAt` 을 앞당겨 쓰는 경로·보존 정리 전 물화 누락 — L-1)은 지표 정의 변경 시 행 삭제 + 재조회로 복구한다.
- 실 DB 의 MariaDB INSERT 경합 코드(P2002/P2034)는 이 리뷰도 못 봤다(가짜 DB·무효 DATABASE_URL) — QA C 반복이 유일한 증거.
- ③ 과 HIT 갱신 경합은 진입점이 열릴 때까지 휴면. 진입점 task 에서 환경 칸·상호 배제를 같이 결정할 것.
- 확인하지 못한 것: `createdAt` 기본값을 채우는 시계(엔진/DB), `recallRecentAudio` 의 보관 시간·프로세스 간 공유, Prisma 가 복합 유니크 `upsert` 를 네이티브로 내보내는지 — 모두 [추측] 로 표시했고 결론을 좌우하지 않는다.

## QA 기록

### qa-p2a (2026-10-07 — LLM·M4 0 레인, 환경·SINCE 는 [[task-041-challenge-core]] QA 기록 참조)
- 시작 전 `EngineMetricsDaily` 0행·`TtsCache` 1189행(`p2a-qa/emd-count.ts`). 서버 APP_ENV=LOCAL(스모크 가드 통과), KST 자정 ±2분 아님.
- **`tests/live/task012b3-smoke.ts`(역할 쿠키 4종) = 27/27 PASS**(bd6e291+스텁, `WAIT_LIVE=1` — 61초 캐시 만료 G2 포함) + **26/26 PASS**(`0dfb374`, G2 생략). 내용: 권한 401·USER 404·ADMIN 403(`missing trace.read`)·DEVELOPER·SUPER 200 / 입력 400(`range=365d`·`voiceId` 형식)·404·TTS 아닌 연결 400 / **손계산 일치**(D1 `requests 7·errors 2·avg 633·p50 600·ttfaP50 520·rtfAvg 0.5333·cacheHitRate 0.2857·byVoice`, D2 n=25 p95 2400·p99 null) / 표본 0 날 0·null / 오늘 LIVE 저장 안 함 / 물화 6행 / 재조회 불변 / **동시 두 요청 행 6·값 동일** / voiceId 필터 / 60초 캐시 G1·61초 뒤 G2 / 다른 환경 DEVELOPER 403·SUPER 200·**그 환경 행 쓰기 0** / 응답에 사용자 id·본문·시크릿 0 / 캐시 정리 LRU 계획 3 → dryRun 계획 3·삭제 0 → 픽스처 한정 실삭제 행 3·파일 3 → 지운 키 전부 missing.
- **보충 `tests/live/p2a-qa/task012b3-extra.ts` = 10/10 PASS**(REV-123 high_risk): **동시 3요청 × 5회(행을 지우고 매 회)** = 500 0·전부 200·행 6·값 첫 값과 동일(실 MariaDB upsert 경합의 증거) · 한 날 행만 지운 뒤 재조회 = 그 날만 같은 값으로 재계산·나머지 `computedAt` 불변 · `voiceId=constructor|toString|__proto__` = 200·`byVoice null`·`summary.voice {voiceId,0,0}` · 오류 요청(400·400·404)은 물화 전에 끝나 실 연결 행 0 · 전체 `TtsCache` 행 수 1189→1189(정리 실행은 이 도구가 부르지 않음).
- **정보(Info)**: `connectionId` 필터를 준 정상 요청도 **환경의 TTS 연결 전부를 물화**한다(`engine/metrics/index.ts:340` 주석 "필터와 무관" — 설계). 그래서 이 QA 가 실 LOCAL 연결 `style-bert-m4` 의 EngineMetricsDaily 6행(10-01~10-06 — 요청 20·0·0·0·36·0)을 만들었고 SINCE 기준으로 삭제(`qa-cleanup.ts`, 종료 뒤 0행). 끝난 날 행이 write-once 라 개발 환경에서 처음 조회하는 순간의 계산이 굳는다는 기존 "알려진 한계"와 같은 사안.
- 범위 밖(Leader 결정): 예열 효과(HIT 전환·TTFA)는 이번 범위 밖 — 검증하지 않음. NOT_VERIFIED: PRODUCTION 환경 행 읽기(권한상 접촉 안 함).

## 배포 기록

## Codex 검토

### [2026-10-06 14:19] C2 adversarial-review focus=concurrency — done
- judge 판정: task 이력서 L-4 판정 기록(Reviewer REV-119 PASS_WITH_NOTES) / 호출 차수: 1/4
- 대상: repo=/home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa base=5c3a70(task_file) snapshot=a259478
- 지적 3건: 
  - [high] src/modules/engine/metrics/index.ts:139 — P2002 처리에서 패자가 승자의 행을 덮을 수 있음 → 과거 물화가 불완전한 값으로 영구 고정 (권고: 동일 날짜 물화를 DB 분산 잠금·단일 작업으로 직렬화하고 P2002 패자는 다시 읽기 또는 명시적 ingestion watermark 도입)
  - [medium] src/modules/engine/metrics/index.ts:278 — liveCache miss 겹칠 때 오래된 now가 덮을 수 있음 → 최대 60초 동안 지표 회귀 (권고: 캐시 항목을 in-flight Promise로 공유하거나 최신 now만 교체)
  - [medium] src/modules/speech/tts/cache.ts:256 — prune 행 삭제 후 동시 재생성이 파일 손실 → DB 행은 있지만 파일 없는 불일치 (권고: 키별 프로세스 간 잠금·세대 토큰으로 상호 배제)
- 검토하지 못한 범위: MariaDB 실 인스턴스의 Prisma MySQL upsert P2002/P2034 형태·트랜잭션 가시성, 실제 운영 캐시 정리 진입점 없어 CachePruneStore 통합 실행 미검증
- 원본: /home/brownjeon/NFS/homes/brownjeon/project/.claude/state/codex-review/runs/20261006T141924Z-task-012b-3-C2/raw.txt

## 최종 요약

## Leader 기록 (DB0 통합 `db push` 완료, 2026-10-06 22:17)

- **사용자 승인**: AskUserQuestion 2026-10-06 "DB 구조 변경 전부 승인". Reviewer REV-118 PASS_WITH_NOTES(승인 목록 9문장 1:1 일치·승인 밖 0·운영 공존 안전).
- **실행 순서(체크리스트 1~6 준수)**: ① 감사한 5파일 sha256 앞 16자·`git diff HEAD --numstat -- prisma/schema.prisma` = `69 0` 그대로 확인 ② **백업** `files/thekaiwa/backups/thekaiwa-20261006-221627-pre-p2db.sql.gz`(600, 227,836 B, "Dump completed on 2026-10-06 22:16:31", 53개 표) ③ **`migrate diff` 재실행**(`--from-schema-datasource` → 파일): 9문장·sha256 앞 16자 `66c04634550da524`(검토본과 동일)·삭제/경고/이름 변경 0 ④ **`prisma db push --skip-generate`**(`--accept-data-loss` 없음) 22:17:00~22:17:42 rc=0 "Your database is now in sync" ⑤ **검증**: `migrate diff` 재실행 = "This is an empty migration"(드리프트 0) · `information_schema`: `Challenge` 16칸·FK 2(`userId`·`topicId`)·인덱스 `activeKey` 유니크 + `(userId,status,startDate)` + `(userId,endedAt)` · 새 칸 10개 존재(`Correction.extraNoteKo`·`EngineMetricsDaily` 6·`VocabAttempt.refType/refId`·`VocabSession.topicId`) · 행 수 Correction 7·VocabSession 6·Challenge 0 · 운영 `/api/health` success·`status:ok`·`degraded:[]` · pm2 `thekaiwa`·`thekaiwa-speech-gateway`·`thekaiwa-speech-worker` online restarts 0(로그의 Prisma 오류 줄은 10-06 00:17 의 기존 `[jobs]` 줄 — push 와 무관) ⑥ 메인 미러 `prisma generate` 완료.
- **SQL 소속 task**: `Correction.extraNoteKo` = task-039 · `EngineMetricsDaily` 6칸 = task-012b-3 · `VocabAttempt.refType/refId`·`VocabSession.topicId`(+인덱스·FK) = task-042 · `Challenge` 표(유니크 1·인덱스 2·FK 2) = task-041. 이 push 로 **네 task 의 DB 선행이 충족**됐다(운영 코드는 추가분을 select 하지 않으므로 영향 없음).
- 복구 1순위: 새 칸·표만 역순으로 되돌리기(Challenge 표 → VocabSession 의 FK·인덱스·칸 → VocabAttempt 2칸 → EMD 6칸 → Correction 1칸). 백업 전체 복원은 공유 DB 전체 되돌림이라 최후 수단.
- 이후: `git push` 는 사용자 지시대로 **전부 끝난 뒤 한 번** — 커밋은 pathspec(`git add -A` 금지).

## Leader 결정 (dev-012b3b 보고 판정, 2026-10-06 23:30)

- **완료 기준 4("예열하면 HIT 로 바뀌고 회화 TTFA 가 나빠지지 않음") 정정**: 예열·정리를 **실제로 돌리는 진입점(crontab·pm2·관리자 실행 라우트)은 이번에 만들지 않는다**(L-4: 인프라 변경은 승인 밖, `TtsCache` 에 환경 칸이 없어 정리가 개발·운영 캐시를 함께 지우는 위험). 따라서 검증 범위는 **예열 후보 선정·정리 dryRun·물화·지표 API** 까지이고 "예열 효과(HIT 전환·TTFA)" 는 **이번 범위 밖(후속 — 실행 진입점 승인 시)**. 최종 보고에 한 줄 명시.
- **dev-012b3b 가 점검에서 고친 결함 2건(다른 환경 조회 시 쓰기 방지 `writable`·꺼진 시험 연결에 의한 고아 실패 버림)은 채택** — Reviewer 가 확인.
- 알려진 한계(수용): 끝난 날 행은 다시 계산하지 않음(지표 정의가 바뀌면 행 삭제 필요), 이 task 이전 Trace 에는 voiceId 가 없어 그날 `byVoice` 는 null, TURN Trace 단계 64개 절단, 90일 조회 30만 행 초과 시 500.
