---
task_id: task-009
title: "Phase 1 통합 — 운영 blue/green 컷오버(미러 → 릴리스)·APP_ENV=PRODUCTION·운영 E2E·롤백 리허설"
status: in-progress
base_ref: caa3155
risk_level: R2
roles_involved: [leader, judge, developer, reviewer, deployer, qa, codex]
related_tasks: [task-002-phase0-scaffolding, task-003e-stt-gateway-web, task-003f-android-ondevice-stt, task-003h-app-branding, task-007-talk-voice-web]
tags:
  - type/task
  - domain/infra
  - domain/deploy
aliases:
  - 운영 컷오버
  - task-009
created: 2026-09-28
updated: 2026-09-28
---

## 목표 (Leader)
design-spec §15 task-009 "Phase 1 통합 QA·라이브·APK" — 지금 운영은 **개발 미러(`~/.node-local/thekaiwa`)에서 `next start`** 로 돈다(릴리스·롤백 없음, 미러 build = 운영 덮어쓰기 위험, 재부팅 자동 기동 없음, `APP_ENV=LOCAL`). 워크스페이스 표준(`scripts/deploy.sh` + `release.sh` — `/home/brownjeon/apps/<project>/{repo,releases,shared,current}`, 헬스 통과 전 `current` 불변, 실패 자동 롤백)으로 옮기고, 운영 환경을 **PRODUCTION** 으로 분리한 뒤, 운영 E2E(회화·채팅·단어)와 롤백 리허설로 Phase 1 을 닫는다. APK 배포본·배너는 003f/003h 에서 끝남(검증만).
사용자 지시(2026-09-28): "다음 단계진행해줘".

정본: 워크스페이스 `../docs/dev-deploy-workflow.md`(§2 구조·§3 매니페스트·앱 여러 개·shared 파일/디렉터리·§3 `cwd: __dirname`·§7-1 미러 프로젝트·§7-2 공유 자원·`file:` 의존성 `$BASE/NFS` 링크) · `../docs/deployer-integration-procedure.md` · `../docs/deploy-rollout-order.md` · `../scripts/deploy.sh` · `../HOME-SERVER_CONFIG/servers/linux/deploy/release.sh` · 이 프로젝트 `deploy.yml`·`ecosystem.config.js`·`docs/deploy-order.md`(**TheMeal 에서 복사된 옛 문서 — 다시 쓴다**) · `.claude/agents/deployer.md`.

## Leader 사전 조사 (2026-09-28 13:20)
- 운영 pm2: `thekaiwa`(cwd 미러), `thekaiwa-speech-gateway`(cwd NFS `speech/gateway`, venv `~/.node-local/thekaiwa-speech/venv`, 모델 `DATA_ROOT/models` ✅). `/home/brownjeon/apps/thekaiwa` 없음(release.sh 가 첫 배포에 만든다). 다른 프로젝트 9개는 이미 릴리스 구조(오늘 12:0x 다른 세션이 일괄 배포). **`tradinginvest` 가 online(⛔ 비활성 프로젝트 — 건드리지 않는다, `pm2 save` 판단에 영향)**.
- 환경 분리 데이터: `EngineConnection`·`AppSetting`·`PronunciationLexicon*` 이 LOCAL·PRODUCTION 양쪽 시드돼 있고 **설정값이 동일**(차이는 자동 갱신되는 `status/lastHealthAt/lastFunctionalAt` 뿐, 사전 v1 snapshotHash 같음). `ConfigurationVersion`·`PromptVersion` 0행 → **운영을 PRODUCTION 으로 바꾸는 것은 `shared/.env` 의 `APP_ENV=PRODUCTION` 한 줄**이면 된다(개발은 NFS `.env` 의 LOCAL 그대로 → 같은 DB 에서 환경 분리가 설계대로 작동).
- `deploy.yml` 은 준비돼 있으나 `runtime.app` 하나(gateway 누락)·선결 과제 주석이 옛날 것. `ecosystem.config.js` 의 `thekaiwa.cwd`·`LOG_DIR` 이 미러 하드코딩(§7-1 함정). `package-lock.json` 에 `@thekaiwa/sherpa-stt`(file:plugins) 항목이 없어 `npm ci` 가 실패할 가능성(003f A 보고). `file:` 의존성 `@workspace/auth-oauth`(NFS 절대경로, install-links) → `$BASE/NFS` 호환 링크 필요 여부 확인.

## Leader's Plan (2026-09-28)

### 범위 결정
- **R1 코드·설정(developer)**:
  1. `ecosystem.config.js` — `thekaiwa`: `cwd: __dirname`, 릴리스에서 `next start -p 3010`, `LOG_DIR` = 운영은 `<base>/shared/logs` / 개발(미러·NFS)은 기존 동작 유지(경로로 판별), `fs.mkdirSync` 유지. `thekaiwa-speech-gateway`: `HERE = __dirname`(릴리스의 `speech/gateway`·`speech/common`), venv 공유(`~/.node-local/thekaiwa-speech/venv`), 모델 `DATA_ROOT/models`(이미 우선순위), `.env` 는 릴리스의 `.env`(= shared 링크).
  2. `deploy.yml` — `runtime.apps: [thekaiwa, thekaiwa-speech-gateway]`, `port: 3010`, `build.command` 는 릴리스에서 직접(`prisma generate && next build`, 현행), 선결 주석 정리, `shared: [.env, logs]`.
  3. `package-lock.json` 재생성(미러에서 `npm install --package-lock-only` → NFS 반영) — `npm ci` 가 릴리스 깊이(`/home/brownjeon/apps/thekaiwa/releases/<id>`)에서 통과하는지 **격리 디렉터리에서 실측**(`$BASE/NFS` 링크 필요 여부 포함).
  4. `docs/deploy-order.md` **TheKaiwa 용으로 다시 쓰기**(TheMeal 잔재 제거): 선결 조건·배포 전 확인·실행(`scripts/deploy.sh TheKaiwa --dry-run` → `--yes`)·결과 판정(RELEASE_RESULT)·배포 후 확인(health 본문·핵심 플로우·gateway·M4·APK)·롤백·공유 자원(DB·venv·DATA_ROOT·M4)·APK 경로(build-apk.sh --publish + AppRelease)·개발은 미러 계속.
  5. `/api/health` 가 degraded 에서도 200 인지 확인 → release.sh 통과 기준으로 적절한지 판단·기록(TTS/M4 가 잠시 죽어도 배포가 막히지 않는 게 맞다 — DB·env 필수 항목 실패는 503 이어야).
- **R2 컷오버(deployer — Leader 동행)**: `shared/.env` 배치(NFS `.env` 복사 + `APP_ENV=PRODUCTION` 으로 한 줄 교체, 600, 값 출력 금지) → `--dry-run` → `--yes`(release.sh 가 `ensure_current_cwd` 로 옛 미러 프로세스를 delete 후 재등록) → RELEASE_RESULT ok → health·https·gateway·M4·APK 확인 → 콘솔 배지 PRODUCTION 확인.
- **R3 운영 E2E(qa, Leader 확인)**: 운영(3010 localhost + https)에서 QA 계정으로 채팅 턴·회화 턴(TTS 청크·#24)·단어 세트·gateway WS(운영 Origin) 1회씩, 데이터 정리. 기존 스모크(`task006/007/008/003f-smoke`) 재사용.
- **R4 롤백 리허설**: 새 ecosystem 으로 릴리스 2개 이상 쌓은 뒤 `scripts/deploy.sh TheKaiwa --rollback` → health → 다시 앞으로 배포. 컷오버 이전(미러 ecosystem) 릴리스는 없으므로 해당 없음.
- **R5 사용자 몫(여기서 멈춰 요청)**: `pm2 save`(⚠ `tradinginvest` 가 online 이라 저장하면 재부팅 때 같이 살아남 — 사용자 판단) · `pm2 startup`(sudo) · webhook 자동 배포 매핑(push → 배포 — 기본 **하지 않음**, 필요 시 사용자 결정) · DB 구조 변경 3건(사용자 검토 중 — 이 task 에서 적용하지 않음).
- **개발 흐름 변화**: 컷오버 뒤 운영은 미러를 쓰지 않는다 → **미러에서 `npm run build` 금지 규칙이 풀린다**(dev 전용). CLAUDE.md·ACTIVE·메모리 갱신.

### 분배
| 역할 | 담당 | 순서 |
|---|---|---|
| judge·codex | intake · C1(운영 전환 설계 — 설정 분리·롤백·공유 자원) | 1 |
| developer (Opus) | R1 전부 + `npm ci` 격리 실측 | 2 |
| reviewer | ecosystem·deploy.yml·lock·문서·health 판단 감사 | 3 |
| deployer (Haiku) + Leader | R2 컷오버·R4 롤백 리허설 | 4 |
| qa + Leader | R3 운영 E2E | 5 |

### 완료 기준
1. `scripts/deploy.sh TheKaiwa --yes` → `RELEASE_RESULT status=ok`, pm2 `thekaiwa`·`thekaiwa-speech-gateway` cwd 가 `/home/brownjeon/apps/thekaiwa/releases/<id>/…`, `current` 링크, `shared/.env`(600)·`shared/logs`.
2. 운영 `APP_ENV=PRODUCTION`(콘솔 배지·health `env`), 개발 dev 서버는 LOCAL 유지.
3. https health 200·ok, 로그인 화면, 채팅·회화(음성 청크)·단어 세트 1회씩 운영 E2E PASS, gateway WS(운영 Origin) final, M4 TTS, `/models/*`, `/app/download/latest.apk`·`/api/app/version`.
4. 롤백 리허설: `--rollback` → 이전 릴리스로 health ok → 재배포 ok.
5. `docs/deploy-order.md` TheKaiwa 판, CLAUDE.md 배포 절·ACTIVE 갱신, 미러 build 금지 해제 명시.
6. 사용자 요청 목록(pm2 save/startup·webhook·DB 구조)을 정리.

### 네이티브 변경
없음.

## 판단 기록 (judge)
- [2026-09-28 00:00] intake engine=jev → task_type=ops · risk=R2 · developer_model=opus · next=assign · demo=none | overrides=- | fallback=- | tokens=1347
- [2026-09-28 00:01] codex_gate/C1 engine=jev → codex_required=false · mode=null · focus=null · budget_rule=CX-limit-unknown-r2 | overrides=- | fallback=- | tokens=773

## Codex 검토

## Developer 기록
- [13:34] **R1 완료(코드·설정·문서)** — 운영 pm2·`/home/brownjeon/apps/thekaiwa`·`--yes`·`.env`/`shared/.env` 는 건드리지 않음(격리 디렉터리는 확인 후 삭제).
  - `ecosystem.config.js`: `IN_RELEASE`(부모 디렉터리 이름이 `releases`) 판별 추가 → 릴리스면 **node_modules 유무와 무관하게** `cwd=__dirname`(미러로 조용히 빠지는 §7-1 함정 차단), `LOG_DIR=<base>/shared/logs`(릴리스 prune 뒤에도 pm2 로그 경로 유지 — VoiceVault 방식). 그 밖은 종전(NFS→미러, node_modules 옆이면 그 자리) 그대로. gateway 는 이미 `HERE` 기준이라 변경 없음(릴리스에서 cwd·PYTHONPATH·config = 릴리스, `.env` = shared 링크, 모델 = `DATA_ROOT/models`). NFS 평가 결과 = 현재 pm2 등록값과 동일 확인(미러·NFS·로그 경로).
  - `deploy.yml`: `runtime.apps: [thekaiwa, thekaiwa-speech-gateway]`·port 3010·`shared: [.env, logs]`·build 현행, 선결 주석을 현재 사실로(origin·`$BASE/NFS` 링크·공유 자원·헬스 의미). `scripts/deploy.sh TheKaiwa --dry-run` = "대상이 이 서버 자신 — 로컬 실행", `--apps thekaiwa,thekaiwa-speech-gateway --port 3010 --health /api/health --shared .env,logs`, `apps/thekaiwa` 미생성 확인.
  - `package-lock.json`: NFS lock 은 **prisma 2개(37 항목)만 담은 채 방치**돼 있었다(미러 lock 이 NFS 로 복사된 적 없음). 미러에서 `npm install --package-lock-only` → `@thekaiwa/sherpa-stt`(`file:plugins/sherpa-stt`)만 추가(버전 변화 0, 614 항목) → NFS 로 복사. ⚠ `--package-lock-only` 가 미러 `node_modules/.package-lock.json`(숨은 lock)을 디스크에 없는 106 항목까지 담아 다시 썼다 → 오도를 막으려 **숨은 lock 만 삭제**(npm 이 다음 설치 때 재생성, 런타임 무관). `scripts/sync-local.sh` 에 미러·NFS lock 불일치 **경고**(덮어쓰지 않음) 추가 — 재발 방지.
  - **격리 실측**(`/home/brownjeon/apps/.thekaiwa-npmci-check/releases/x`, R1 트리 `git archive`, release.sh 와 같은 `env -i` 최소 환경): 링크 없음 → `npm ci` ENOENT `<base>/NFS/.../auth-oauth`(예상) / `$BASE/NFS` 링크 → `npm ci` 6초·510 패키지·경고 1(eslint deprecated), 두 file: 의존성 실파일 설치 / `prisma generate && next build` 14초(TS 7.6초), 경고 = prisma `package.json#prisma` deprecated·Turbopack dynamic fs 3건(기존) / 크기 릴리스 ≈1.1G(node_modules 882M·.next 161M) / `current` 경유 ecosystem 평가 = cwd 릴리스 realpath·로그 shared / 임시 포트 `next start` → health 200 ok, `DATABASE_URL=` 로 띄우면 **503 down(curl -fsS 실패)** / 격리 릴리스 ecosystem 그대로 gateway(임시 포트) 모델 로드 1.75초·`ok:true`. `.env` 는 사본 없이 NFS `.env` 심볼릭 링크로만 썼다.
  - **`$BASE/NFS` 링크는 release.sh 가 만들지 않는다** — 컷오버 때 사람이 1회(`ln -s /home/brownjeon/NFS /home/brownjeon/apps/thekaiwa/NFS`, TheMeal·VoiceVault 와 동일).
  - `/api/health`: 종전은 **항상 200**(api-contract #1)이고 DB 는 확인조차 안 했다(env 존재만) → `.env` 가 비어도 배포 통과. **정본과 다르게 한 것**: Leader 지시(필수 실패 503)대로 `db`(`SELECT 1`, 2초) 추가, 필수 = `env_database·env_jwt·env_google_oauth·env_data_root·db` 실패 시 `status:"down"`·HTTP 503·`success:false`, 선택(tts·stt_gateway·stt_analysis·llm·env_internal_secret)만 실패면 200 degraded. `down` 캐시 5초(60초면 기동 직후 실패가 release.sh 30초 대기 내내 굳는다). TheThinker·TheCareerMng 의 DB 503 선례와 같은 방향. 단위 테스트 `src/modules/admin/__tests__/health.test.ts` 4건.
  - `docs/deploy-order.md` TheKaiwa 판 전면 재작성(TheMeal 잔재 0) · `CLAUDE.md` 배포 절 "현재 상태" 한 줄(다른 세션의 미커밋 hunk 는 커밋에서 제외 — 내 줄만 index 에 올림).
  - 검증: typecheck 0 · lint 0 error/5 warning(기존 파일) · test 496 = 495 pass + 1 skip · 엔진명 grep — 변경 파일 응답·UI 0(기존 env 이름 주석뿐).
  - **Leader 가 할 일(컷오버 R2 전·중)**: ① R1 커밋 **push**(배포는 origin 기준 — 이 커밋은 push 안 함) ② api-contract #1 을 "필수 실패 503·`db` 키·status ok|degraded|down"으로 갱신 ③ `.claude/agents/deployer.md` 86·104행의 옛 헬스 키(`speech_gateway`·`tts_service`·`claude_cli`) → 역할 키(`stt_gateway`·`tts`·`llm`)·503 규칙 반영 ④ `docs/nginx/README.md` 18행 "blue/green 은 deploy.sh 가 포트 스위칭" → 실제는 같은 포트·`current` 링크 전환 ⑤ `mkdir -p $B/shared` + `$B/NFS` 링크 + `shared/.env`(install -m 600 + `APP_ENV=PRODUCTION`) — deploy-order §9-1 ⑥ **최초 배포는 health_failed 여도 자동 복구가 없다**(이전 릴리스 없음) → §9-3 NFS ecosystem 재등록 경로. 그래서 컷오버 확인 전 미러 `npm run build` 금지 유지.
  - **R5 전제 정정(사실 확인)**: `pm2-brownjeon.service`(pm2 startup)는 이미 enabled, `~/.pm2/dump.pm2`(12:15, 다른 프로젝트 배포의 release.sh `pm2 save --force`)에 **`thekaiwa`(미러)·`thekaiwa-speech-gateway`(NFS)·⛔`tradinginvest`(online)가 이미 들어 있다**. release.sh 는 배포마다 `pm2 save --force` 를 하므로 "pm2 save 는 사용자 몫"을 분리할 수 없다 — tradinginvest 를 dump 에서 빼는 것만 사용자 결정으로 남는다.
  - **R3 주의**: 역할 QA 계정(admin·developer·super)은 `APP_ENV=PRODUCTION` 에서 세션이 안 된다(`infra/auth.ts`), task005b·003e·003g 스모크는 LOCAL 행을 원복하는 전제라 운영 3010 이 아니라 미러 dev(LOCAL)로. USER 흐름(task006/007/008)은 운영 3010 가능.

## Reviewer 기록

### REV-025 (2026-09-28, 542c814 + 2064a07 — 컷오버 준비)

**판정: PASS** (Critical 0 · High 0 · Medium 2 · Low 2) — 컷오버(R2) 진행 가능, 단 아래 "컷오버 전 반드시 고칠 것"부터.

대상: `git show --stat 542c814 2064a07`(10파일 + 3파일). Read 전용 감사 + 독립 재검증(격리 스크래치에서 `git archive 2064a07` → tsc·eslint·`npm run test`(node_modules 는 미러 심볼릭 링크로 재사용, `.env` 는 읽기만) 재실행 → 스크래치 삭제, `scripts/deploy.sh TheKaiwa --dry-run` 1회(읽기 전용, `--yes` 미사용)).

**1. `ecosystem.config.js` — 세 곳 평가 시나리오 코드 추적, 실제 파일시스템 대조**
- `IN_RELEASE = path.basename(path.dirname(HERE)) === 'releases'` → 릴리스(`<base>/releases/<id>`)면 `node_modules` 유무와 무관하게 `CWD=HERE`, `LOG_DIR=<base>/shared/logs`(정확히 `path.resolve(HERE,'../../shared/logs')` = `$BASE/shared/logs`). NFS 편집 트리(부모 디렉토리명 `project`)에서는 `IN_RELEASE=false` → 기존과 동일하게 미러 폴백. 코드 추적으로 재계산해 developer 주장과 일치 확인.
- **VoiceVault 대조**: `VoiceVault/ecosystem.config.js:69` 가 정확히 같은 식(`path.basename(path.dirname(__dirname)) === 'releases'`) 을 이미 운영 중(whisper-service 도 `cwd: `${__dirname}/whisper-service`` 로 gateway 와 동일 패턴) — 새로 발명한 게 아니라 검증된 패턴을 그대로 가져온 것. 근거 있음.
- **실제 서버 대조**: `/home/brownjeon/apps/{voicevault,themeal}` 에 이미 `NFS -> /home/brownjeon/NFS` 심볼릭 링크와 `shared/.env`(600) 가 존재함을 직접 확인(`ls -la`, `stat -c '%a %n'`) — deploy-order.md §9-1 이 요구하는 것과 정확히 같은 모양. `/home/brownjeon/apps/thekaiwa` 자체는 아직 없음(최초 컷오버 전 상태, 예상대로) — developer 의 isolated `npm-ci-check` 디렉토리도 남아있지 않음(정리 확인).
- 옛 미러 하드코딩으로 "조용히" 빠지는 경로 없음: `node_modules` 유무 체크를 `IN_RELEASE` 가 앞서 가로채므로, 릴리스에 `npm ci` 가 실패해 `node_modules` 가 비어 있어도 미러로 폴백하지 않고 그 자리에서 기동 실패로 드러난다(의도된 설계, 확인).
- gateway(`thekaiwa-speech-gateway`) 블록은 이번 diff 로 변경되지 않았음(git diff 컨텍스트 확인) — 원래부터 `cwd: \`${HERE}/speech/gateway\`` 라 릴리스에서도 그대로 릴리스 경로를 본다. `.env` 읽기(`readEnvFile(\`${HERE}/.env\`)`) 는 릴리스의 `.env` 심볼릭 링크(→ `shared/.env`) 를 본다 — 맞음.

**2. `release.sh` 와의 정합(HOME-SERVER_CONFIG 실제 스크립트 정독)**
- `ensure_current_cwd` 는 `APPS` 목록의 각 앱에 대해 `pm2_cwd_of` → `readlink -f` 비교 → 불일치 시 `pm2 delete` + `pm2 start --only <app>` 재등록. gateway 도 `interpreter: none` 이라 이 로직에 영향받지 않고 동일하게 처리됨 — 코드상 앱 이름 기반 범용 로직이라 두 앱 모두 통과.
- **`health_check()` 는 `HEALTH`+`PORT` 가 있으면 Next 앱(3010) 의 `/api/health` 만 curl 로 본다 — gateway(8100) 가 실제로 요청을 처리하는지는 이 게이트가 보증하지 않는다.** `ensure_current_cwd` 는 gateway 의 **cwd 일치**만 확인하므로, gateway 프로세스가 cwd 는 맞는데 기동 자체는 실패(venv 경로·PYTHONPATH 오류 등)해도 `RELEASE_RESULT status:"ok"` 로 끝날 수 있다. `deploy.yml` 주석과 deploy-order.md §5-2 가 이 한계를 이미 명시하고 배포 후 `curl 127.0.0.1:8100/health` 수동 확인을 요구해 뒀으므로 설계 결함이 아니라 **문서화된 리스크**다 — 다만 "컷오버 때 확인할 것"에 다시 못박아 둔다(생략하면 gateway 죽은 채 `ok` 로 오판할 수 있음).
- 최초 컷오버 시 `health_failed` 자동 복구 없음(되돌아갈 `prev` 없음) — `deploy-order.md §9-3` 의 복귀 절차(`pm2 delete` → `env -i` 최소 환경으로 NFS 에서 재기동 → `pm2 save --force`)를 코드로 읽어보면 실행 가능한 순서다. 단, 이 절차 자체를 사전에 **한 번도 실측하지 않았다** — 절차서에 있는 그대로일 뿐 리허설은 안 됨(완료 기준 자체가 "일 실패하면"이라 상시 요구는 아니지만, deployer 가 처음 겪는 상황이 될 것임을 인지해 둘 것).
- `pm2 save --force` 가 매 배포마다 실행돼 그 시점 pm2 전체 목록(⛔ `tradinginvest` 포함)을 dump 에 남긴다는 developer 관찰을 `release.sh` 코드(`pm2_reload()`·`ensure_current_cwd()` 양쪽에 `pm2 save --force`) 로 재확인 — 정확하다. 이 task 는 그 정리를 하지 않기로 한 결정(사용자 몫)이 옳다 — task-009 완료 기준에도 "정리" 가 아니라 "목록화"만 있음.

**3. health 게이트 코드·테스트 — `src/modules/admin/health.ts`, `route.ts`, `health.test.ts`**
- `HEALTH_REQUIRED_CHECKS = [env_database, env_jwt, env_google_oauth, env_data_root, db]`, `summarizeHealth` 이 하나라도 false 면 `down`, `healthHttpStatus('down')===503`. 예외·URL·경로 미노출(`probe()`/`pingDb()` 모두 catch 후 boolean 만 반환, 원인 문자열 버림) — 확인.
- `DOWN_CACHE_MS=5000` vs release.sh `HEALTH_TIMEOUT=30`(2초 간격 폴링) — 5초 캐시면 기동 직후 실패해도 30초 안에 4~5회 재확인 기회가 있다. 계산 확인.
- 단위테스트 4건을 그대로 재실행(격리): `env` 값 노출 안 됨(`!JSON.stringify(down).includes('"x"')`), 5초/60초 캐시 경계, 필수/선택 분리 — 전부 통과. `admin.index.ts` 가 `healthHttpStatus` 를 새로 export, `route.ts` 가 `success: httpStatus===200` 로 바꾼 것도 계약대로.
- `src/modules/admin/health.ts` 가 `@/modules/infra` 의 `prisma` 를 직접 import — `module-dependency.md` §3-1 행렬(`admin → infra` ✓, admin 은 전 층 허용)에 맞음, 위반 아님.

**4. `package-lock.json` — 버전 변화 실측**
- 옛 lock: `name":"thekaiwa","version":"0.0.1"`(현재 package.json 은 `0.1.0` — 옛 lock 자체가 낡았다는 developer 주장과 일치), `packages` 37개(전부 prisma 하위 트리). 새 lock: `0.1.0`, 614개, `package.json` 의 `dependencies` 14개 전부 lock 에 존재(`missing in lock: []`).
- `@thekaiwa/sherpa-stt` → `file:plugins/sherpa-stt`(저장소 내부 상대경로, 깊이 무관 — 확인). `@workspace/auth-oauth` → lock 의 `resolved` 필드가 `file:../../NFS/homes/brownjeon/project/shared/auth-oauth`(**lock 파일이 있던 디렉터리 기준 상대경로**, 미러가 `/home/brownjeon` 기준 2단계 깊이였기 때문에 생긴 값) — 릴리스 경로(`/home/brownjeon/apps/thekaiwa/releases/<id>`, 이것도 `<base>` 기준 정확히 3단계, `<base>` 자체는 `/home/brownjeon` 기준 2단계)에서 `../../` 를 계산하면 `<base>` 로 떨어져 `<base>/NFS/...` 를 찾는다는 developer·문서의 설명을 수치로 재현·확인했다(직접 계산, 격리 npm ci 는 developer 가 이미 실측 완료 — 재실행하지 않음, 신뢰).
- `.npmrc` 의 `install-links=true` 존재 확인(주장대로).

**5. `docs/deploy-order.md` — 전면 재작성 문서 정독**
- `grep -in themeal` → 남은 언급은 전부 의도된 역사적 참조(비교 대상 언급)뿐, 경로·포트·앱이름 잔재 0.
- §9(최초 컷오버)·§9-3(복구)·§9-4(롤백 리허설)·§9-5(완료 판정) 순서가 release.sh 실제 동작과 어긋나는 곳 없음. §1-1(`$BASE/NFS` 링크)·§2-2(lock 은 NFS 가 정본) 설명이 위 3·4 항에서 코드로 재확인한 내용과 일치.

**6. 회귀(tsc·eslint·test) 독립 재실행 — 발견 2건(둘 다 오늘 diff 의 결함은 아님)**
- `tsc --noEmit`: 0 에러(developer 주장과 일치).
- `npm run test`(node 내장 test runner, tsx): **496 tests, 496 pass, 0 fail, 0 skip.** developer 보고는 "495 pass + 1 skip". 원인 추적: `src/modules/speech/__tests__/modelPackage.test.ts` 의 스킵 조건이 "저장소 speech/models 가 없는 실행 위치(미러)" 인데, `scripts/sync-local.sh` 는 `speech/` 를 미러에 동기화하지 않는다(목록에 없음) — developer 는 실제 `npm run test`(미러에서 실행) 로 이 항목이 스킵됐고, 나는 `git archive` 전체 트리(스킵 조건이 거짓)에서 실행해 스킵되지 않았을 뿐. 총 개수(496)·실패(0) 는 일치 — **결함 아님, 방법론 차이로 설명됨.**
- `eslint .`(node_modules 링크 그대로, 스크래치 루트 전체 대상): **2 error, 5 warning**(exit 1). developer 보고는 "0 error, 5 warning". 원인: 2건의 에러가 `ecosystem.config.js:2-3`(`const fs = require(...)`, `const path = require(...)`, `@typescript-eslint/no-require-imports`)에서 나는데, `package.json` 의 `lint` 스크립트는 `cd $HOME/.node-local/thekaiwa && eslint .` 로 **미러에서만** 돈다. `scripts/sync-local.sh:66`(`for f in tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs next-env.d.ts package.json .npmrc capacitor.config.ts`) 에 `ecosystem.config.js`·`deploy.yml` 이 **빠져 있어 미러에 이 파일 자체가 없다** — 그래서 실제 `npm run lint` 는 이 파일을 보지 못하고 "0 error" 가 정확히 나온다. **developer 보고는 실제 파이프라인 기준으로는 사실이지만, 이는 이번 task 의 핵심 산출물(`ecosystem.config.js`) 이 저장소의 어떤 자동 lint/typecheck 에도 걸리지 않는다는 뜻**(diff 를 보면 이 `require()` 두 줄은 이번 커밋 이전부터 있던 컨텍스트 줄이라 오늘 새로 생긴 에러는 아니다 — pm2 가 이 파일을 CJS 로 읽어야 하므로 `require` 자체는 불가피/의도적이기도 하다). 코드 동작에는 영향 없음(pm2 는 `require` 를 문제없이 실행) — **Medium**: 검증 사각지대이자, 다음에 이 파일을 고치는 사람이 `npm run lint` 의 "통과" 를 근거로 실수를 놓칠 수 있다.

**7. `scripts/deploy.sh TheKaiwa --dry-run` 실행 결과 — 재현된 이슈 1건**
- 사전점검에서 커밋되지 않은 변경 8건(다른 세션의 `.claude/agents/*`·`settings.json`·`CLAUDE.md` — 지시대로 감사 대상 아님, 확인만)과 **push 되지 않은 커밋 6개**(542c814·2064a07 포함 이번 R1 전체)를 정확히 경고까지는 했으나, 그 직후 **`git log --oneline "$ORIGIN_REF..HEAD" | head -5` 파이프에서 SIGPIPE 로 스크립트 자체가 exit 141 로 죽었다**(`set -o pipefail` + `head -5` 가 6줄 중 5줄만 읽고 닫아 `git log` 가 SIGPIPE 를 받고, pipefail 이 그 비정상 종료를 파이프라인 종료 코드로 승격). `--dry-run`·`--yes` 여부와 무관하게 `AHEAD>5` 면 항상 발생하는 경로(코드 확인: 이 pipe 실행 자체는 `ASSUME_YES`/`DRY_RUN` 분기 밖에 있다). **이 파일(`scripts/deploy.sh`)은 오늘 diff 밖**(워크스페이스 공용 스크립트, 최종 수정 09-21)이라 이번 task 의 결함은 아니지만, **지금 이 프로젝트 상태(6개 unpushed)에서 그대로 재현되는 살아있는 트랩**이다. `deploy-order.md` 가 지시하는 순서(push 먼저 → dry-run)를 따르면 `AHEAD=0` 이 되어 이 코드 경로 자체를 타지 않으므로 실무 영향은 "push 를 잊으면 계획 출력 대신 알 수 없는 크래시를 본다" 정도지만, 그 알 수 없는 크래시가 정확히 **오늘 이 task 의 완료 기준 1번째 줄("origin push")을 건너뛰었을 때** 나는 에러라는 점에서 컷오버 당일 헷갈릴 소지가 크다 — **Medium**(재현 확인, 파일은 out-of-scope).
- 이 SIGPIPE 때문에 dry-run 의 나머지 출력(apps 2개·port 3010·health·shared 계획)은 **이번 감사에서 실측하지 못했다** — deploy.yml·release.sh 코드 정독으로는 문제없다고 판단했으나, push 후 한 번 더 dry-run 을 실행해 실제 출력을 눈으로 보는 절차가 반드시 필요하다(아래 "컷오버 때 확인할 것" 1번).

**8. api-contract.md(#1) 문서 정합성 — 불일치 발견**
- 2064a07 이 추가한 설명 문단(§2-1 #1, 문서 322행)은 "아래 예시는 degraded(200) 형태, `checks` 에 `db` 키가 추가됐다" 라고 적었지만, **실제 예시 JSON(328~348행)은 바뀌지 않았다** — `data.env` 필드가 없고 `checks` 에 `db` 키도 없다(여전히 옛 9개 키만). 352행 프로즈도 `` `status` 는 `ok | degraded` `` 로 남아 `down` 이 빠져 있다. 총람 표(114행)는 올바르게 갱신됐다(`{app,env,status:ok|degraded|down,degraded[],checks{}}`) — **총람과 상세 예시가 서로 다른 얘기를 하는 상태.** `api-contract.md` 는 이 저장소의 정본이라 QA·Deployer 가 실제 응답을 이 예시와 대조하면 혼동한다 — **Medium**.

**지적사항**
| # | 심각도 | 내용 | 근거 | 권고 |
|---|---|---|---|---|
| 1 | MEDIUM | `docs/design/api-contract.md` #1 상세 예시가 2064a07 의 설명 문단과 실제로 다르다 — `env`·`checks.db` 없고 `status` 설명에 `down` 누락 | 322·328-348·352행(위 8항), 총람 114행은 올바름 | 예시 JSON 에 `"env":"PRODUCTION"`·`checks.db:true` 추가, 352행 `ok\|degraded\|down` 으로 정정. 코드 동작과 무관하지만 정본 문서라 이번 task 문서 완료 기준 안에서 처리 |
| 2 | MEDIUM | `ecosystem.config.js`·`deploy.yml` 이 `scripts/sync-local.sh` 동기화 목록(66행)에 없어 `npm run lint`/`npm run test` 가 실제로는 미러에서만 돌기 때문에 이 파일들을 검사하지 않는다 — 실측 시 `ecosystem.config.js` 에 `no-require-imports` 에러 2건 존재(오늘 diff 로 생긴 건 아님, pm2 CJS 요구사항상 불가피할 수 있음) | eslint 직접 실행 결과(§6), sync-local.sh:66 파일 목록 | 두 파일을 sync-local.sh 목록에 추가하거나(가능하면), 최소한 이 파일을 다루는 사람이 "lint 통과" 를 전체 검증으로 착각하지 않게 CLAUDE.md/deploy-order.md 에 한 줄 명시. 컷오버 차단 사유 아님 |
| 3 | MEDIUM | `scripts/deploy.sh` 사전점검이 unpushed 커밋 6개(지금 상태)에서 `git log \| head -5` + `pipefail` 조합으로 SIGPIPE(exit 141) 로 죽는 것을 직접 재현 — dry-run 계획 출력 이후 단계를 이번 감사에서 실측하지 못함 | 실행 로그(§7), scripts/deploy.sh:258 부근 코드(파일은 오늘 diff 밖) | push 먼저 하면 AHEAD=0 이라 이 경로를 안 탄다(문서 순서 그대로 따르면 회피됨) — 컷오버 전 push 후 dry-run 재실행으로 실제 계획 출력 확인 필수(아래 목록 1번). 스크립트 자체 수정은 이번 task 범위 밖(별도 flag 고려 가치 있음) |
| 4 | LOW | `.claude/agents/deployer.md`(77행, 오늘 diff 밖) "pm2 앱명" 표에 아직 존재하지 않는 `thekaiwa-speech-worker`(Phase 2) 가 나열돼 있다 | deploy.yml `runtime.apps` 는 2개뿐, ACTIVE.md 도 Phase 2 로 명시 | 컷오버 당일 deployer 가 3번째 프로세스를 찾다 혼동하지 않게 참고만 — 정정은 이번 task 범위 밖, 급하지 않음 |

**컷오버 전 반드시 고칠 것**
1. **origin/main push** — task-009 R1 커밋 6개(542c814·2064a07 포함)가 아직 push 안 됨(`--dry-run` 실측 확인). push 전에는 `--yes` 를 돌려도 옛 코드가 배포되거나(운 좋으면) §7 의 SIGPIPE 로 크래시한다.
2. `docs/design/api-contract.md` #1 예시 JSON·프로즈 정정(지적 #1) — 코드는 맞지만 정본 문서가 스스로 모순된 상태로 남으면 QA·Deployer 대조 기준이 흔들린다.

**컷오버 때 확인할 것**
1. push 후 `scripts/deploy.sh TheKaiwa --dry-run` 을 **한 번 더** 실행 — "push 되지 않은 커밋" 경고 없이(AHEAD=0) SIGPIPE 없이 apps 2개·port 3010·health `/api/health`·shared `.env,logs` 계획이 끝까지 출력되는지 육안 확인(이번 감사는 여기서 막혀 실측 못함).
2. `pm2 -jlist` 또는 `--status` 로 **두 앱 모두**("thekaiwa"·"thekaiwa-speech-gateway") "재등록 완료" 로그가 찍히는지 확인(하나만 옮겨가고 다른 하나는 옛 경로에 남는 상황을 배제).
3. `RELEASE_RESULT status:"ok"` 를 받아도 그것만으로 gateway 가 실제로 동작한다고 보지 말 것 — `health_check()` 는 Next 앱(3010) 만 본다. 반드시 `curl 127.0.0.1:8100/health` 로 `ok:true` 직접 확인(deploy-order.md §5-2 에 이미 있음 — 생략 금지).
4. 최초 배포가 `health_failed` 로 끝나면 자동 롤백이 없다 — §9-3 복귀 절차(`pm2 delete` → `env -i` 최소 환경으로 NFS ecosystem 재기동)를 실행할 준비(정확한 `PATH`·`HOME` 값)를 미리 해 둘 것. 이 절차 자체는 사전 리허설되지 않았다.
5. `pm2 save --force` 가 배포 성공/롤백 양쪽에서 자동 실행돼 그 시점 전체 pm2 목록(⛔ `tradinginvest` 포함)이 dump 에 남는다 — 이미 알려진 사실이고 이번 task 가 정리하지 않기로 한 것이 맞는 판단이나, 배포 직후 dump 내용을 한 번 더 인지해 둘 것(사용자 결정 사항, 차단 아님).
6. `data.env == "PRODUCTION"`·`data.status == "ok"` 를 응답 본문에서 직접 확인(위 지적 #1 의 문서 수정 여부와 무관하게 코드 자체는 정확함 — 실측 확인됨).

**high_risk_areas (QA 인계)**: gateway(8100) 실제 헬스(`ok:true`) — 배포 게이트가 이를 보증하지 않음 · 최초 컷오버 `health_failed` 복구 절차(리허설 안 됨) · 역할 QA 계정(admin/developer/super) 이 PRODUCTION 세션 불가(`infra/auth.ts:46` 확인) 이므로 관리자 콘솔 계열 검증은 실제 로그인으로만 · `data.env`/콘솔 배지 PRODUCTION 표시 · 롤백 리허설(§9-4) 실제 수행 여부.

**native_change**: false

```json
{ "reviewId": "REV-025", "status": "PASS", "issues": [ { "issue": "api-contract.md #1 상세 예시가 설명 문단·총람과 불일치(env·checks.db 누락, status 설명에 down 누락)", "severity": "MEDIUM", "component": "docs/design/api-contract.md:322,328-348,352", "risk": "QA·Deployer 가 정본 예시와 실제 응답을 대조할 때 혼동", "evidence": "322행 'checks 에 db 키가 추가됐다' 주장과 달리 328-348행 JSON 에 db·env 없음, 352행은 여전히 ok|degraded", "recommendation": "예시 JSON 에 env·checks.db 추가, 352행 down 포함하도록 수정" }, { "issue": "ecosystem.config.js·deploy.yml 이 scripts/sync-local.sh 동기화 목록에 없어 npm run lint 가 이 파일을 검사하지 않음", "severity": "MEDIUM", "component": "scripts/sync-local.sh:66, ecosystem.config.js:2-3", "risk": "이 task 의 핵심 산출물이 어떤 자동 검증에도 안 걸림 — 실측 시 no-require-imports 에러 2건 존재(pm2 CJS 요구로 불가피할 수 있음, 오늘 diff 로 생긴 것은 아님)", "evidence": "직접 eslint . 실행 결과 2 error, npm run lint 는 cd 미러 후 실행이라 이 파일 부재로 통과", "recommendation": "sync-local.sh 목록에 두 파일 추가하거나 최소 문서에 사각지대 명시. 차단 아님" }, { "issue": "scripts/deploy.sh 사전점검이 unpushed 6개 상태에서 git log | head -5 + pipefail 로 SIGPIPE(exit 141) 크래시", "severity": "MEDIUM", "component": "scripts/deploy.sh:258 부근(파일은 오늘 diff 밖)", "risk": "push 를 잊고 배포를 시도하면 원인이 드러나지 않는 크래시를 만나 컷오버 당일 혼동", "evidence": "scripts/deploy.sh TheKaiwa --dry-run 직접 실행 재현, exit=141", "recommendation": "컷오버 전 반드시 push 먼저(AHEAD=0 이면 이 경로 자체를 안 탐) — 스크립트 자체 수정은 별도 검토" }, { "issue": ".claude/agents/deployer.md pm2 앱명 표에 미존재 thekaiwa-speech-worker 나열", "severity": "LOW", "component": ".claude/agents/deployer.md:77(오늘 diff 밖)", "risk": "컷오버 당일 3번째 프로세스를 찾다 혼동 가능", "evidence": "deploy.yml runtime.apps 는 thekaiwa·thekaiwa-speech-gateway 2개뿐, worker 는 Phase 2", "recommendation": "참고만, 급하지 않음" } ], "summary": { "critical": 0, "high": 0, "medium": 3, "low": 1 }, "high_risk_areas": ["gateway(8100) 실제 헬스 — 배포 게이트가 보증 안 함", "최초 컷오버 health_failed 복구 절차 미리허설", "역할 QA 계정 PRODUCTION 세션 불가 — 콘솔 검증은 실로그인", "data.env/콘솔 배지 PRODUCTION 표시", "롤백 리허설(§9-4) 실제 수행"], "native_change": false }
```

## Deployer 기록

## QA 기록

## 최종 요약
