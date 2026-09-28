# 일본어교육 (TheKaiwa) — 배포 작업절차서

> **이 프로젝트 배포의 정본.** 배포를 실행하기 전에 이 문서를 먼저 읽는다.
> 작성 2026-09-28 (task-009 R1 — 종전 문서는 TheMeal 판을 복사한 것이라 전면 재작성) · 근거: 워크스페이스
> [`dev-deploy-workflow.md`](../../docs/dev-deploy-workflow.md)·`HOME-SERVER_CONFIG/servers/linux/deploy/release.sh`·
> TheMeal·VoiceVault 컷오버 선례·task-009 격리 실측.
>
> | 문서 | 다루는 것 |
> |---|---|
> | [`../../docs/dev-deploy-workflow.md`](../../docs/dev-deploy-workflow.md) | 배포 **메커니즘** (스크립트·매니페스트·blue/green) |
> | [`../../docs/deployer-integration-procedure.md`](../../docs/deployer-integration-procedure.md) | 에이전트 **연계 정책**·게이트 |
> | **이 문서** | **이 프로젝트에서 실제로 무엇을 어떤 순서로 하는가** |
> | [`../deploy.yml`](../deploy.yml) · [`../ecosystem.config.js`](../ecosystem.config.js) | 매니페스트 · pm2 정의(앱 2개) |
> | [`../.claude/agents/deployer.md`](../.claude/agents/deployer.md) | 실행 주체(QA PASS 이후) |

---

## 0. 한 줄 요약

**NFS 소스를 고치고 → 미러(`npm run dev`)에서 검증 → 커밋·푸시 → `scripts/deploy.sh TheKaiwa --dry-run` → `--yes`.**
우분투 서버 자신에서 실행하면 SSH 없이 로컬로 돈다(`env -i` 최소 환경 — 에이전트 세션의 환경변수가 운영 앱에 새지 않는다).
새 릴리스 디렉토리에서 설치·빌드하고, `/api/health` 가 200 이어야만 `current` 를 넘긴다.
빌드가 깨지면 운영은 그대로, 헬스가 실패하면 이전 릴리스로 자동 롤백된다.

```
NFS 편집(SSOT) → ~/.node-local/thekaiwa 미러에서 dev 검증 → git push (origin/main)
                                        │
                     scripts/deploy.sh TheKaiwa --yes   (우분투 자신이면 로컬 실행)
                                        ▼
/home/brownjeon/apps/thekaiwa/releases/<id>: git archive → shared 링크 → npm ci → prisma generate + next build
   → current 전환 → pm2 thekaiwa·thekaiwa-speech-gateway reload(cwd 가 릴리스가 아니면 delete 후 재등록)
   → /api/health ─┬─ 200 → 완료(오래된 릴리스 정리, 최근 5개 유지)
                  └─ 503/무응답 → 이전 릴리스로 자동 롤백
```

> **현재 상태 (2026-09-28)**: 컷오버 준비(task-009 R1) 완료 — 매니페스트·ecosystem·lock·헬스 게이트가 릴리스 구조를 지원한다.
> **운영은 아직 미러에서 돈다**(pm2 `thekaiwa` cwd `~/.node-local/thekaiwa`, `thekaiwa-speech-gateway` cwd NFS `speech/gateway`, `APP_ENV=LOCAL`).
> 최초 컷오버는 §9 절차로 Leader·deployer 가 한다. 컷오버가 끝나면 이 블록을 갱신한다.

---

## 1. 선결 조건

| # | 항목 | 상태 | 주체 |
|---|---|---|---|
| 1 | 원격 저장소 origin | ✅ Gitea `project_TheKaiwa` — push 는 `https://git.미라클펭귄.com/...`, 서버 fetch 는 `deploy.yml` 의 LAN 주소(`http://192.168.219.154:3000/...`, 같은 저장소) | — |
| 2 | `deploy.yml` | ✅ 앱 2개(`thekaiwa`·`thekaiwa-speech-gateway`), 포트 3010, `shared: [.env, logs]`, 릴리스에서 직접 빌드 | — |
| 3 | `ecosystem.config.js` | ✅ 릴리스에서 평가되면 두 앱 모두 `cwd` = 그 릴리스(`__dirname`), 로그 = `<base>/shared/logs`. NFS 에서 평가되면 종전(미러·NFS) 그대로 | — |
| 4 | `package-lock.json` | ✅ 재생성(614 항목, `@thekaiwa/sherpa-stt` 포함). 같은 깊이 격리 디렉터리에서 `npm ci` 6초·build 14초 통과(§11) | — |
| 5 | `/api/health` 배포 게이트 | ✅ 필수(DB 접속·필수 env) 실패 = 503, 선택(음성·LLM)만 실패 = 200 degraded(§4-1) | — |
| 6 | **`$BASE/NFS` 호환 링크** | ⬜ 컷오버 때 1회 — `ln -s /home/brownjeon/NFS /home/brownjeon/apps/thekaiwa/NFS` (§1-1) | Leader |
| 7 | **`shared/.env`** | ⬜ 컷오버 때 1회 — NFS `.env` 복사 + `APP_ENV=PRODUCTION`, 권한 600(§9) | Leader |
| 8 | STT 모델 `DATA_ROOT/models/reazonspeech-int8/manifest.json` | ✅ 존재 — 릴리스에는 모델이 없으므로(git 미추적) gateway 는 여기서 읽는다 | — |

> `/home/brownjeon/apps/thekaiwa` 자체는 `release.sh` 가 첫 배포에서 만든다(`mkdir -p`·`git clone --mirror`).
> 다만 6·7번을 넣으려면 먼저 만들어야 하므로 §9 에서 `mkdir -p .../shared` 부터 한다. 이미 있어도 `release.sh` 는 문제없다.

### 1-1. `file:` 의존성과 `$BASE/NFS` 링크 — `release.sh` 는 만들지 않는다

`package.json` 의 `@workspace/auth-oauth` 는 NFS **절대경로** `file:` 의존성인데, `package-lock.json` 은 lock 을 만든 미러
(`~/.node-local/thekaiwa`, `/home/brownjeon` 기준 2단계) 기준 **상대경로** `file:../../NFS/homes/brownjeon/project/shared/auth-oauth`
로 굳힌다. 릴리스(`<base>/releases/<id>`)에서 `../../` 는 `<base>` 이므로 `npm ci` 는 `<base>/NFS/...` 를 찾는다.

- 링크가 없으면: `npm error enoent Could not read package.json: .../apps/thekaiwa/NFS/.../auth-oauth/package.json` → `build_failed`,
  운영 영향 없음(2026-09-28 격리 실측으로 재현).
- 링크가 있으면: `.npmrc` 의 `install-links=true` 로 **실제 파일로 복사 설치**되어 런타임에는 이 경로가 필요 없다(설치 시점에만).
- TheMeal·VoiceVault 도 같은 링크를 둔다(`/home/brownjeon/apps/{themeal,voicevault}/NFS`).
- `@thekaiwa/sherpa-stt`(`file:plugins/sherpa-stt`)는 저장소 안 경로라 깊이와 무관하다. 웹 번들은 이 패키지를 import 하지 않는다
  (APK 빌드는 별도 작업 디렉터리 `~/.node-local/thekaiwa-apk` 에서 한다).

> lock 을 **미러가 아닌 다른 깊이에서** 다시 만들면 상대경로가 바뀌어 이 링크로는 안 맞게 된다. lock 은 항상 미러에서 만든다(§2-2).
> `npm install` 로 우회하지 않는다 — 잠금이 무시돼 의존성이 조용히 드리프트한다.

---

## 2. 배포 전 확인

```bash
cd /home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa

git status -sb | head -1              # "[ahead N]" 이면 N 개가 아직 origin 에 없다 — 배포는 origin 의 ref 다
git log --oneline origin/main..HEAD   # 빠질 커밋
git branch --show-current             # 기대: main
```

- QA 보고(`verdict=PASS`, 결함 0건)가 없으면 deployer 는 기동하지 않는다.
- `ahead` 가 0 이 아니면 푸시하거나, 올리지 않을 커밋이면 사용자에게 확인받는다. `--yes` 는 그 경고도 넘긴다.

### 2-1. 이 배포에 "릴리스 밖" 변경이 섞였는가

blue/green 은 **릴리스 디렉토리 안의 것만** 되돌린다. 아래가 바뀌었으면 웹 배포와 별개로 다룬다(§7).

| 바뀐 것 | 어떻게 반영하나 | 롤백 |
|---|---|---|
| `prisma/schema.prisma` | 배포 **전에** 사용자 승인 후 미러에서 `db push`(백업 먼저). 개발·운영이 같은 DB 라 push 즉시 운영(옛 릴리스)에도 적용된다 → 옛 코드와도 호환되는 변경만, 아니면 순서 설계 | ❌ |
| `speech/**/requirements.txt` | 공유 venv `~/.node-local/thekaiwa-speech/venv` 에 별도 승인 작업으로 설치 | ❌ |
| `speech/tts-service/**` | 맥 M4 별도 배포(git push 웹훅, 사용자 승인) | ❌ |
| `plugins/**`·`android/**`·`capacitor.config.ts` | APK 재빌드·배포본(§8). 웹 배포와 무관 | ❌ |
| `.env` 키 추가·변경 | `shared/.env` 에 직접 반영(값 출력 금지) 후 배포 — 릴리스는 `shared/.env` 링크만 본다 | ❌ |
| 모델 버전 | `DATA_ROOT/models` 갱신(`scripts/models-verify.sh` 게이트) | ❌ |

### 2-2. 의존성을 바꿨다면 — lock 은 NFS 가 정본

운영은 **NFS(git) 의 `package-lock.json`** 으로 `npm ci` 한다. 의존성은 미러에서 `npm install` 로 바꾸므로 미러 lock 이 앞서 나간다.

```bash
# NFS package.json 수정 → npm run dev(동기화) → 미러에서 설치 → 미러 lock 을 NFS 로 복사 → 둘 다 커밋
cd ~/.node-local/thekaiwa && npm install --no-audit --no-fund
cp ~/.node-local/thekaiwa/package-lock.json /home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa/
```

`scripts/sync-local.sh` 는 두 lock 이 다르면 경고만 한다(덮어쓰지 않는다). 잊으면 운영 `npm ci` 가
"package.json 과 lock 이 어긋난다"로 `build_failed` — 시끄럽게 실패하고 운영은 안전하다.
(task-009 전까지 NFS lock 은 prisma 2개만 담은 채 방치돼 `npm ci` 자체가 불가능했다.)

---

## 3. 배포 실행

```bash
cd /home/brownjeon/NFS/homes/brownjeon/project

# ① 계획만 확인 — 실행하지 않는다. apps 2개·포트 3010·health·shared(.env,logs)·ref 를 눈으로 본다
scripts/deploy.sh TheKaiwa --dry-run
#    기대: "대상이 이 서버 자신이다 (125.177.194.26) — SSH 없이 로컬로 실행한다"
#          --apps thekaiwa,thekaiwa-speech-gateway  --port 3010  --health /api/health  --shared .env,logs

# ② 배포
scripts/deploy.sh TheKaiwa --yes
```

`release.sh` 가 하는 일(이 프로젝트 기준, 순서대로):

1. `$BASE/repo`(git mirror) fetch → `origin/main` SHA 로 `releases/<YYYYMMDD-HHMMSS>-<sha8>/` 전개
2. `shared/.env`·`shared/logs` 를 릴리스 안으로 심볼릭 링크(`.env` 가 없으면 **의도적으로 실패**)
3. `npm ci` → `prisma generate` → `next build` — 여기까지 실패하면 `build_failed`, `current`·pm2 그대로
4. `current` 전환 → pm2 `startOrReload` 두 앱 → **실제 cwd 확인**(`ensure_current_cwd`) — 릴리스를 안 가리키면 `pm2 delete` 후 재등록
   (앱마다 수 초 중단, gateway 는 모델 로드 ≈2초)
5. `/api/health` 를 30초 동안 2초 간격으로 `curl -fsS` — 통과하면 오래된 릴리스 정리(5개 유지)
6. ⚠ **`pm2 save --force` 를 스스로 한다**(4단계 뒤마다). 즉 배포할 때마다 그 시점 pm2 프로세스 목록 전체가 dump 에 저장된다(§10).

> ⚠️ **`--with-migrate` 를 스스로 붙이지 않는다.** `deploy.yml` 에 `migrate` 가 없어서 붙이면 거부되지만, 스키마 변경은 §2-1 대로 따로 한다.

---

## 4. 결과 판정

마지막 줄의 `RELEASE_RESULT <json>` 의 `status` 로 판정한다(출력 문구가 아니라).

| `status` | 운영 상태 | 다음 조치 |
|---|---|---|
| `ok` | 새 릴리스 | §5 배포 후 확인 |
| `build_failed` | **영향 없음** (current·pm2 불변) | 빌드 로그 발췌 → developer. 수정 후 Reviewer 부터 재순환 |
| `health_failed` | **이전 릴리스로 자동 롤백됨** (최초 컷오버는 예외 — §9-3) | pm2 로그 발췌 → developer. 수정 후 Reviewer 부터 재순환 |
| `rolled_back` | 이전 릴리스 (수동 롤백) | 사용자 지시로만 발생 |
| `rollback_unhealthy` | 🔴 **비정상** | 즉시 에스컬레이션. **추가 배포 시도 금지** |

```bash
scripts/deploy.sh TheKaiwa --status      # current·릴리스 목록·두 앱 pm2 상태와 cwd·헬스
scripts/deploy.sh TheKaiwa --logs 100    # 두 앱 pm2 로그
```

### 4-1. `/api/health` 판정 규칙 (배포 게이트)

`release.sh` 는 HTTP 코드만 본다(`curl -fsS` = 2xx 통과). 그래서 코드에 의미를 싣는다(`src/modules/admin/health.ts`).

| 상황 | HTTP | `data.status` | 배포 |
|---|---|---|---|
| 전부 정상 | 200 | `ok` | 통과 |
| 선택 의존성만 불가 — `tts`(M4)·`stt_gateway`·`stt_analysis`(whisper)·`llm`(CLI 경로 미설정)·`env_internal_secret` | 200 | `degraded` + `degraded[]` | **통과** — M4 가 잠시 꺼져도 웹 배포는 막히지 않는다 |
| 필수 중 하나라도 불가 — `db`(`SELECT 1`, 2초)·`env_database`·`env_jwt`·`env_google_oauth`·`env_data_root` | **503** | `down` | **실패** → 자동 롤백 |

- 값은 boolean 만(무인증 공개 엔드포인트). 정상 판정은 60초, `down` 은 5초만 캐시한다(기동 직후 한 번의 실패가 30초 대기 내내 굳지 않게).
- `data.env` 가 그 프로세스의 `APP_ENV` 다 — 컷오버 뒤 운영은 `PRODUCTION`.
- NAS MariaDB 가 내려가 있으면 새 배포도, 자동 롤백 대상도 503 이라 `rollback_unhealthy` 가 된다 — 이때는 코드 문제가 아니라 DB 문제다.

---

## 5. 배포 후 확인 — 여기가 핵심

`status: ok` 는 "필수 의존성이 붙은 프로세스가 떴다"는 뜻이지 기능이 동작한다는 뜻이 아니다.
**실제로 열어서** 확인하고, 확인하지 않은 항목은 "미확인"이라고 적는다.

### 5-1. 프로세스·경로

```bash
scripts/deploy.sh TheKaiwa --status
pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const a of JSON.parse(s))if(/^thekaiwa/.test(a.name))console.log(a.name,a.pm2_env.status,a.pm2_env.pm_cwd,"restarts="+a.pm2_env.restart_time)})'
#   기대: thekaiwa  → /home/brownjeon/apps/thekaiwa/releases/<id>
#         thekaiwa-speech-gateway → /home/brownjeon/apps/thekaiwa/releases/<id>/speech/gateway
ls -la /home/brownjeon/apps/thekaiwa/shared/logs/     # pm2-*.log·speech-gateway-*.log 가 쌓이는가
```

### 5-2. 헬스·엔드포인트

```bash
BASE=https://kaiwa.xn--lh0b87pnudm10a4vd.com
curl -s http://127.0.0.1:3010/api/health | jq '.data | {env, status, degraded}'   # 기대: env "PRODUCTION", status "ok", degraded []
curl -s -o /dev/null -w '%{http_code}\n' $BASE/api/health                         # 200 (nginx 경유)
curl -s http://127.0.0.1:8100/health | jq .ok                                      # gateway true (모델 로드 후)
curl -s http://192.168.219.100:8200/health | jq .ok                                # M4 TTS true (별도 배포 대상)
curl -s $BASE/models/ondevice-ja-v1/manifest.json | jq '.version'                  # 온디바이스 모델 manifest (DATA_ROOT/models)
curl -sI $BASE/app/download/latest.apk | grep -i content-disposition               # APK 배포본 (DATA_ROOT/releases)
curl -s $BASE/api/app/version | jq '.data | {latest, latestCode, minSupportedCode}' # AppRelease 최신 행
```

### 5-3. 화면·핵심 흐름 (사람 또는 QA)

- [ ] `https://kaiwa.미라클펭귄.com` 로그인 화면 렌더링, Google 로그인 → 회화 탭
- [ ] 채팅 1턴(교정 표시), 회화 1턴(음성 청크 재생 — #24), 오늘의 단어 세트 1회
- [ ] 실시간 STT(gateway WS, 운영 Origin) final 1회 — 웹에서 마이크
- [ ] 관리자 콘솔 상단 환경 배지 `PRODUCTION`
- [ ] 앱(APK)에서 로그인·회화 1턴 — 앱은 운영 웹을 로드하므로 웹 배포만으로 반영된다

> ⚠️ **QA 자동 스모크(`tests/live/*`)는 운영이 LOCAL 이던 시절에 작성됐다.** 컷오버 뒤 3010 은 PRODUCTION 행을 쓴다.
> - USER QA 계정(`qa-bot`·`qa-bot2`)은 운영(localhost 직접 요청)에서도 세션이 된다 → 채팅·회화·단어 흐름(task006/007/008 스모크)은 쓸 수 있다.
> - **역할 QA 계정(admin·developer·super)은 `APP_ENV=PRODUCTION` 프로세스에서 세션이 되지 않는다**(`infra/auth.ts`) → 콘솔 검증은 실제 로그인으로.
> - LOCAL 행을 전제로 원복하는 스모크(task005b·task003e·task003g 등)는 운영 3010 이 아니라 미러 dev 서버(LOCAL)에 돌린다.

### 5-4. Prisma — `generate` 가 조용히 옛 스키마로 도는 함정

스키마를 바꾼 배포라면 생성 결과를 직접 확인한다(VoiceVault 실측: 옛 스키마로 돌고도 `✔ Generated` 로 끝났다).

```bash
grep -c '<신규모델 camelCase>' /home/brownjeon/apps/thekaiwa/current/node_modules/.prisma/client/index.d.ts   # 0 이면 실패
```

`npx prisma` 는 쓰지 않는다 — 반드시 `node node_modules/.bin/prisma`.

---

## 6. 실패했을 때

### 6-1. 롤백

```bash
scripts/deploy.sh TheKaiwa --rollback      # 직전 릴리스로
scripts/deploy.sh TheKaiwa --rollback 2    # 두 단계 전으로
```

`current` 를 되돌리고 두 앱을 reload 한다(수 초). **수동 롤백은 사용자 지시가 있을 때만** — 자동 롤백은 스크립트가 이미 한다.
코드만 되돌아간다. DB 스키마·venv·`DATA_ROOT`·M4·`shared/.env` 는 그대로다(§7).

> ⚠️ **컷오버 직후 첫 롤백.** 컷오버 이전 릴리스는 없다(미러 시절엔 릴리스가 없었다). 첫 배포 직후 `--rollback` 은
> "이전 릴리스가 없다"로 거부된다 — 정상이다. 새 ecosystem 으로 만든 릴리스가 2개 이상 쌓인 뒤에 롤백을 연습한다(§9-4).

### 6-2. 흔할 만한 실패와 원인

| 증상 | 원인 | 조치 |
|---|---|---|
| `shared 파일이 없다: .../shared/.env` | 첫 배포 전 `.env` 미배치 | §9-1 |
| `npm ci` ENOENT `.../apps/thekaiwa/NFS/.../auth-oauth` | `$BASE/NFS` 호환 링크 없음 | §1-1 |
| `npm ci` "package.json and package-lock.json ... not in sync" | 의존성 변경 후 미러 lock 을 NFS 로 안 옮김 | §2-2 |
| `health_failed`, 본문 `status: "down"` | 필수 의존성 불가 — `shared/.env` 키 누락 또는 DB 접속 불가 | `curl -s 127.0.0.1:3010/api/health \| jq .data.degraded` 로 어느 항목인지 본다 |
| 배포는 됐는데 **옛 코드가 돈다** | pm2 cwd 가 릴리스가 아님(`ensure_current_cwd` 가 잡아야 한다) | §5-1 cwd 확인 → 어긋나면 에스컬레이션 |
| gateway `ok:false`·모델 없음 | `DATA_ROOT/models` 가 비었거나 NFS 미마운트(재부팅 직후) | NFS 확인 후 `fetch_models.py --dest "$DATA_ROOT/models"`, `pm2 restart thekaiwa-speech-gateway` |
| LLM 이 안 된다(회화·채팅 실패) | CLI 실행 파일을 못 찾음 — `env -i` 최소 PATH 에는 `/usr/bin` 만 있다 | `/usr/bin/claude` 링크 확인(`CLAUDE_CLI_PATH=claude` 가 PATH 로 풀린다). 인증은 `~/.claude` |
| `배포가 이미 진행 중이다` | flock 점유 | 진행 중인 배포를 기다린다. 비정상 종료였다면 `$BASE/.deploy.lock` 확인 |

---

## 7. 롤백으로 되돌아가지 않는 공유 자원

| 자원 | 위치 | 취급 |
|---|---|---|
| **DB 스키마·데이터** | NAS MariaDB `192.168.219.154:3306` — **개발과 운영이 같은 DB**, 환경 분리는 `environment` 컬럼(`APP_ENV`) | 스키마는 `db push` 만(`migrate dev` 금지), 사용자 승인·백업 먼저. 대기 중인 구조 변경 3건(Utterance chatId/unique·ConfigScope LEXICON·LexiconVersion rollbackOf)은 이 절차 밖 |
| **Python venv** | `~/.node-local/thekaiwa-speech/venv` (gateway) | 배포가 건드리지 않는다. `requirements.txt` 변경은 별도 승인 작업 |
| **`DATA_ROOT`** | `/home/brownjeon/NFS/homes/brownjeon/project/files/thekaiwa` — `models/`(STT 모델)·발화 wav(30일)·TTS 캐시·`releases/*.apk` | 개발과 공유. 배포로 옮기지 않는다 |
| **맥 M4 tts-service** | `192.168.219.100:8200` (`~/kaiwa-tts-run`) | 별도 배포(git push 웹훅, 사용자 승인) |
| **`shared/.env`** | `/home/brownjeon/apps/thekaiwa/shared/.env` (600) | 운영 전용 사본. NFS `.env`(개발, `APP_ENV=LOCAL`)와 **`APP_ENV` 한 줄만 다르다**. 키를 추가하면 양쪽 모두 |
| **`SECRETS_DIR`** | `.env` 가 `/home/brownjeon/apps/thekaiwa/shared/secrets` 를 가리킨다 | `file:` credentialRef 를 쓸 때만 필요(700, 파일 600). `release.sh` 는 만들지 않는다. `shared:` 목록에 넣지 않는다(절대경로 참조) |
| **공용 패키지** | NAS `project/shared/auth-oauth`(git 밖) | 설치 시점 복사본이 릴리스에 들어간다 |
| **nginx** | `kaiwa.xn--lh0b87pnudm10a4vd.com` → `127.0.0.1:3010`·`/ws/speech` → `127.0.0.1:8100` | 포트가 그대로라 컷오버·배포로 바꿀 것이 없다 |

> 분석 STT worker(`thekaiwa-speech-worker`)는 Phase 2 에서 `ecosystem.config.js`·`deploy.yml runtime.apps` 에 함께 추가한다.

---

## 8. APK 배포 경로 (네이티브 변경 때만)

앱은 운영 웹(`server.url`)을 로드하므로 **웹 변경 = 웹 배포**다. `plugins/**`·`android/**`·`capacitor.config.ts`·Manifest·Gradle 이
바뀌었을 때만 APK 를 새로 만든다(`versionCode` 증가 필수). 웹 릴리스·롤백과 독립이다.

```bash
cd /home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa
bash scripts/build-apk.sh --test > /tmp/apk.log 2>&1; echo $?   # 파이프로 자르지 않는다(SIGPIPE)
bash scripts/build-apk.sh --publish                             # 사용자 승인 후 — DATA_ROOT/releases/thekaiwa-<versionName>.apk
```

- `--publish` 가 출력한 값(versionCode·versionName·apkPath=파일 이름만·sha256·minSupported)으로 deployer 가 `AppRelease` 행을 넣는다.
  `AppRelease` 는 환경 컬럼이 없어 개발·운영이 같은 행을 본다.
- 확인: `curl -s $BASE/api/app/version`(새 `latestCode`) · `curl -sI $BASE/app/download/latest.apk`(파일명·크기) · 폰에서 업데이트 띠.
- 작업 디렉터리 `~/.node-local/thekaiwa-apk`(릴리스·미러와 분리), 로그 `~/.node-local/thekaiwa-apk/logs/`.

---

## 9. 최초 컷오버 절차 (1회성 — task-009 R2, Leader·deployer)

미러에서 도는 운영을 릴리스 구조로 옮긴다. `release.sh` 가 옛 미러 프로세스를 `ensure_current_cwd` 로 **delete 후 재등록**하므로
수동 `pm2 delete` 는 필요 없다(두 앱 각각 수 초 중단). **되돌릴 수 있는 순서로** 진행한다.

### 9-0. 전제

- [ ] task-009 R1 커밋(`ecosystem.config.js`·`deploy.yml`·`package-lock.json`·`/api/health`·이 문서)이 **origin/main 에 push** 됐다 — 배포는 origin 기준이다
- [ ] Reviewer PASS
- [ ] 미러 `~/.node-local/thekaiwa/.next` 가 지금 운영 빌드 그대로다 — **컷오버 확인 전에는 미러에서 `npm run build` 금지**(§9-3 복귀 경로)

### 9-1. 서버 준비 (값은 출력하지 않는다)

```bash
B=/home/brownjeon/apps/thekaiwa
mkdir -p $B/shared
ln -s /home/brownjeon/NFS $B/NFS                                             # §1-1
install -m 600 /home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa/.env $B/shared/.env
sed -i 's/^APP_ENV=.*/APP_ENV=PRODUCTION/' $B/shared/.env                     # 인라인 주석째 한 줄을 바꾼다
grep -c '^APP_ENV=PRODUCTION$' $B/shared/.env                                # 1
stat -c '%a %n' $B/shared/.env                                               # 600
```

- `shared/.env` 의 `NODE_ENV=development` 줄은 그대로 둬도 된다 — pm2 env(`NODE_ENV=production`)가 우선하고 Next 는 이미 있는 변수를 덮지 않는다.
- `SPEECH_GATEWAY_ALLOWED_ORIGINS`·`OAUTH_CALLBACK_BASE`·`APP_INTERNAL_URL` 은 이미 운영 값이다.
- 환경 데이터는 준비돼 있다: `EngineConnection`·`AppSetting`·`PronunciationLexicon*` 이 LOCAL·PRODUCTION 양쪽에 같은 값으로 시드돼 있고
  (`ConfigurationVersion`·`PromptVersion` 0행), 운영을 PRODUCTION 으로 바꾸는 것은 이 한 줄이다. 개발(NFS `.env`)은 LOCAL 그대로.

### 9-2. 배포

```bash
cd /home/brownjeon/NFS/homes/brownjeon/project
scripts/deploy.sh TheKaiwa --dry-run
scripts/deploy.sh TheKaiwa --yes
#   로그에 "pm2 'thekaiwa' 이 아직 옛 경로를 잡고 있다: /home/brownjeon/.node-local/thekaiwa → delete 후 재등록" 이
#   두 앱 모두 찍히고 "재등록 완료" 가 나와야 한다
```

그다음 §5 전부. 특히 `data.env == "PRODUCTION"`, 두 앱 cwd 가 릴리스, gateway `ok:true`, 콘솔 배지.

### 9-3. 최초 배포가 `health_failed` 면 — 자동 복구가 없다

첫 배포에는 되돌아갈 이전 릴리스가 없어서 `release.sh` 는 "되돌아갈 이전 릴리스가 없다 (최초 배포)"만 남기고 **pm2 는 새 릴리스를 가리킨 채**다.
옛 세계로 되돌리는 방법은 NFS 에서 ecosystem 을 평가하는 것이다 — NFS 에는 `node_modules` 가 없어 Next 앱은 미러로, gateway 는 NFS 로 간다(종전과 동일).

```bash
pm2 delete thekaiwa thekaiwa-speech-gateway
# pm2 start 는 실행한 셸의 환경변수를 앱에 넣는다 — 에이전트 세션 변수(API 키 등)가 새지 않게 release.sh 와 같은 최소 환경으로
cd /home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa && env -i HOME="$HOME" USER="$USER" LOGNAME="$USER" SHELL=/bin/bash \
  PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin LANG="${LANG:-C.UTF-8}" pm2 start ecosystem.config.js
pm2 save --force        # dump 도 옛 세계로 (release.sh 가 이미 새 경로로 저장해 뒀다)
curl -s http://127.0.0.1:3010/api/health | jq '.data | {env,status}'   # env LOCAL
```

`/home/brownjeon/apps/thekaiwa` 는 남겨 둬도 운영에 영향이 없다. 원인을 고친 뒤 Reviewer 부터 재순환해 다시 9-2.

### 9-4. 롤백 리허설 (task-009 R4)

```bash
scripts/deploy.sh TheKaiwa --yes          # 두 번째 릴리스(같은 SHA 여도 릴리스 id 는 새로 생긴다)
scripts/deploy.sh TheKaiwa --rollback     # → RELEASE_RESULT rolled_back, health ok, 두 앱 cwd = 이전 릴리스
scripts/deploy.sh TheKaiwa --yes          # 다시 앞으로 → ok
```

### 9-5. 컷오버 완료 판정 — 전부 참일 때만

- [ ] `RELEASE_RESULT {"status":"ok",...}`, `--status` 의 두 앱 cwd 가 `/home/brownjeon/apps/thekaiwa/releases/<id>…`
- [ ] `shared/.env` 600·`APP_ENV=PRODUCTION`, `shared/logs/` 에 두 앱 로그
- [ ] 운영 health `env: PRODUCTION`·`status: ok`, 개발 dev 서버 health 는 `LOCAL`
- [ ] §5-2·§5-3 통과(운영 E2E — task-009 R3)
- [ ] §9-4 롤백 리허설 통과
- [ ] 이 문서 상단 "현재 상태"·`CLAUDE.md` 배포 절·ACTIVE 갱신 — **미러는 개발 전용이 되어 미러 `npm run build` 금지가 풀린다**
- [ ] 옛 미러 로그 `~/.node-local/thekaiwa/logs/` 는 기록으로만 남는다(새 로그는 `shared/logs`)

---

## 10. 개발 흐름 — 컷오버 뒤에도 미러는 계속 쓴다

| 무엇 | 어디서 | 비고 |
|---|---|---|
| 편집 | NFS `TheKaiwa/` (유일한 SSOT) | 운영 릴리스 디렉토리를 직접 고치지 않는다 — 다음 배포에 사라진다 |
| dev 서버·typecheck·lint·test | 미러 `~/.node-local/thekaiwa` (`npm run dev` 등 — `sync-local.sh` 경유) | `APP_ENV=LOCAL`(NFS `.env`). 운영 3010 과 겹치지 않게 dev 는 3011~ 에 `-H 127.0.0.1` |
| `npm run build` | 미러 | **컷오버 전: 금지**(미러 `.next` 가 운영 빌드). **컷오버 후: 허용**(운영은 릴리스의 `.next`) |
| 운영 반영 | `scripts/deploy.sh TheKaiwa --yes` 만 | 우분투에서 직접 `pm2 restart`·`git pull`·`npm run build` 로 운영을 바꾸지 않는다 |

### pm2 dump·재부팅

- `pm2-brownjeon.service`(pm2 startup)는 이미 enabled 다. 재부팅 시 `~/.pm2/dump.pm2` 의 프로세스가 되살아난다.
- `release.sh` 는 배포할 때마다 `pm2 save --force` 를 한다 — 다른 프로젝트 배포도 마찬가지라 dump 는 **마지막 배포 시점의 전체 목록**이다
  (2026-09-28 12:15 dump 에 이미 `thekaiwa`(미러)·`thekaiwa-speech-gateway`(NFS)·⛔`tradinginvest`(online)가 들어 있다).
  비활성 프로젝트를 dump 에서 빼는 것은 사용자 결정이다(워크스페이스 CLAUDE.md "프로젝트 운영 상태").
- 재부팅 직후 NFS 마운트가 pm2 보다 늦으면 `DATA_ROOT`(모델·발화) 접근이 실패할 수 있다 — 부팅 뒤 §5-2 를 한 번 본다.

---

## 11. 부록 — 실측·경로·값

### 격리 실측 (2026-09-28, task-009 R1)

`/home/brownjeon/apps/.thekaiwa-npmci-check/releases/x/`(릴리스와 같은 깊이, 확인 후 삭제)에 R1 트리를 `git archive` 로 풀고
`release.sh` 와 같은 `env -i` 최소 환경에서 실행.

| 단계 | 결과 |
|---|---|
| `npm ci`, `$BASE/NFS` 링크 없음 | ❌ ENOENT `<base>/NFS/.../auth-oauth/package.json` (예상대로) |
| `npm ci`, 링크 있음 | ✅ 6초(npm 캐시 사용), 510 패키지, 경고 1(eslint 9.39.5 deprecated). `@workspace/auth-oauth`·`@thekaiwa/sherpa-stt` 실파일 설치 |
| `prisma generate && next build` | ✅ 14초(TypeScript 7.6초 포함). 경고: `package.json#prisma` deprecated(Prisma 7), Turbopack "Dynamic filesystem access" 3건(페르소나·CLI 경로 — 기존) |
| 크기 | 릴리스 ≈1.1G(`node_modules` 882M·`.next` 161M) → 5개 보관 ≈5.5G |
| ecosystem 평가(`current` 경유) | 두 앱 cwd = `releases/x`(realpath), 로그 = `<base>/shared/logs`, gateway PYTHONPATH·config = 릴리스, 모델 = `DATA_ROOT/models` |
| `next start`(격리 릴리스, 임시 포트) | `/api/health` 200 `status ok`(env LOCAL — 사본 아님, NFS `.env` 링크) / `DATABASE_URL=` 로 띄우면 **503** `down`(`curl -fsS` 실패) |
| gateway(격리 릴리스 ecosystem 그대로, 임시 포트) | 모델 로드 1.75초, `/health` `ok:true` |

### 경로·값

| 용도 | 값 |
|---|---|
| 편집 대상(SSOT) | `/home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa` (맥 `/Volumes/homes/brownjeon/project/TheKaiwa`) |
| 개발 실행 미러 | `~/.node-local/thekaiwa` (`scripts/sync-local.sh`) |
| 운영 | `/home/brownjeon/apps/thekaiwa/current` → `releases/<id>` (최근 5개), `shared/{.env,logs}`, `NFS` 링크, `repo/` |
| pm2 앱 | `thekaiwa`(Next, `127.0.0.1:3010`) · `thekaiwa-speech-gateway`(uvicorn, `127.0.0.1:8100`, venv 공유) |
| 헬스 | `GET /api/health` (필수 실패 503) · gateway `GET :8100/health` · M4 `GET 192.168.219.100:8200/health` |
| 운영 도메인 | `https://kaiwa.미라클펭귄.com` (`kaiwa.xn--lh0b87pnudm10a4vd.com`) |
| 저장소 / ref | Gitea `project_TheKaiwa` / `main` |
| 우분투 호스트 | `home-dev-x600` `125.177.194.26` · sshd 993 (자기 자신에서 실행하면 로컬) |
| DB | `192.168.219.154:3306` — **개발과 운영이 공유** |
