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

## Reviewer 기록

## Deployer 기록

## QA 기록

## 최종 요약
