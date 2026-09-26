# 식단관리 (TheMeal) — 배포 작업절차서

> **이 프로젝트 배포의 정본.** 배포를 실행하기 전에 이 문서를 먼저 읽는다.
> 작성 2026-09-19 · 근거: VoiceVault 파일럿 실배포(`VoiceVault/docs/task-038-deploy-order.md`)와
> 워크스페이스 정본 [`dev-deploy-workflow.md`](../../docs/dev-deploy-workflow.md).
>
> | 문서 | 다루는 것 |
> |---|---|
> | [`../../docs/dev-deploy-workflow.md`](../../docs/dev-deploy-workflow.md) | 배포 **메커니즘** (스크립트·매니페스트·blue/green) |
> | [`../../docs/deployer-integration-procedure.md`](../../docs/deployer-integration-procedure.md) | 에이전트 **연계 정책**·게이트 |
> | **이 문서** | **이 프로젝트에서 실제로 무엇을 어떤 순서로 하는가** |
> | [`../deploy.yml`](../deploy.yml) | 이 프로젝트의 배포 매니페스트 |

---

## 0. 한 줄 요약

**맥에서 소스를 고치고 → 커밋·푸시하고 → `scripts/deploy.sh TheMeal --yes` 한 번.**
그 뒤는 우분투가 알아서 한다 — 새 릴리스 디렉토리에 빌드하고, 헬스체크가 통과해야만
`current` 심볼릭 링크를 옮긴다. 빌드가 깨져도 운영은 이전 릴리스로 계속 서 있다.

```
맥: NAS 소스 편집 → npm run dev (:3009, sync-local 경유) → 브라우저 검증 → git push
                                          │
                                scripts/deploy.sh TheMeal --yes  (SSH 한 번)
                                          ▼
우분투: 릴리스 전개 → 빌드 → 헬스체크 ─┬─ 통과 → current 전환 → 완료
                                       └─ 실패 → 자동 롤백 (운영 그대로)
```

> **현재 상태 (2026-09-19)**: ⚠️ 산출물은 **이미 다 갖춰져 있다**(`deploy.yml`·`.devmirror`·`deployer.md`).
> 막혀 있는 것은 하나뿐 — **원격 저장소가 없다.** 배포는 `origin` 기준이라 이것이 선결 조건이다.
> 운영 pm2 는 현재 `~/.node-local/thekaiwa` 미러에서 돈다.

---

## 1. 🔴 선결 조건 — 해소 전에는 배포하지 않는다

| # | 항목 | 상태 | 조치 주체 |
|---|---|---|---|
| 1 | 🔴 **원격 저장소(origin)가 없다** — 로컬 git 저장소는 있다 | 미해소 | **사용자** (Gitea 에 `project_TheKaiwa` 생성) |
| 2 | ⚠️ 운영이 `~/.node-local/thekaiwa` 미러에서 구동 중 (릴리스·롤백 없음) | 미해소 | 사용자 (컷오버, §9) |
| 3 | 🔴 `ecosystem.config.js` 의 `cwd`·`LOG_DIR` 이 미러로 하드코딩됨 | 미해소 | developer |
| 4 | 🔴 `package.json` 의 `build` 가 미러로 빌드 → blue/green 무력화 | `deploy.yml` 에서 우회 완료 | — |
| 5 | `shared/.env` 서버 배치 | 미해소 | 사용자 (§9) |

> **2026-09-19 실측 — 운영 루트는 이미 준비돼 있다.**
> `/home/brownjeon/apps/` 는 존재하고 현재 `voicevault/` 하나가 들어 있다.
> **프로젝트별 base 디렉토리는 사람이 만들 필요가 없다** — `release.sh` 가 첫 배포에서
> `git clone --mirror` 와 `mkdir -p "$BASE/shared"` 로 만든다.
> 사람이 미리 해야 하는 것은 **`shared/.env` 배치 하나뿐**이다(없으면 첫 배포가 의도적으로 실패한다).


### 1번 — 저장소만 만들면 된다

```bash
git -C /Volumes/homes/brownjeon/project/TheMeal remote -v   # 현재 0건
```

`deploy.yml` 의 `source.repo` 는 `http://192.168.219.154:3000/brownjeon/project_TheKaiwa.git` 로
적혀 있는데 **그 저장소가 아직 없다.** 사용자가 Gitea 에 만들고 remote 등록·push 해야 한다.
에이전트가 원격 저장소를 임의로 만들지 않는다.

이 항목만 풀리면 이 프로젝트는 **워크스페이스에서 가장 짧은 컷오버 경로**다 — 나머지 산출물이 이미 있다.

### 3번 — `ecosystem.config.js` 가 미러를 가리킨다

```js
cwd: `${process.env.HOME}/.node-local/thekaiwa`,
const LOG_DIR = `${process.env.HOME}/.node-local/thekaiwa/logs`
```

이대로면 릴리스를 바꿔도 미러의 옛 코드가 계속 돈다. 컷오버 시 다음으로 바꾼다.

```js
cwd: __dirname,
script: 'node_modules/next/dist/bin/next',
const LOG_DIR = '/home/brownjeon/apps/thekaiwa/shared/logs'
```

> ℹ️ `LOG_DIR` 을 `fs.mkdirSync` 로 만드는 코드는 **그대로 둔다.** pm2 는 로그 디렉토리를
> 만들어 주지 않고, 없으면 기동에 실패하는데 그 실패가 어떤 로그에도 남지 않는다
> (VoiceVault 2026-09-02 실장애: 204회 크래시 루프 → 502).

### ℹ️ `file:` 의존성은 이미 안전하다

`package.json` 이 `@workspace/auth-oauth` 를 **NFS 절대경로**로 참조하고
`.npmrc` 에 `install-links=true` 가 있다 — 설치 시 실제 파일로 복사되므로
릴리스 깊이가 바뀌어도 깨지지 않는다. bjj·StockInvest·TheRoute 가 겪는 문제를 이 프로젝트는 피해 간다.

> 다만 `shared/auth-oauth` 자체는 git 밖 NAS 상주 패키지라 **릴리스에 포함되지 않고 롤백되지도 않는다.**
> DB 마이그레이션과 같은 등급의 공유 자원이다.

> **이 절에 미해소 항목이 하나라도 있으면 deployer 는 기동하지 않는다.**
> 배포하지 않고 "무엇이 남았는지"를 그대로 보고하는 것이 올바른 행동이다.

---

## 2. 배포 전 확인

```bash
cd /Volumes/homes/brownjeon/project/TheMeal

# ① 배포되는 것은 작업본이 아니라 origin 의 ref 다. 푸시 안 된 커밋이 있으면 그게 빠진다.
git status -sb | head -1          # "[ahead N]" 이 보이면 N 개가 아직 origin 에 없다
git log --oneline origin/main..HEAD

# ② 브랜치 확인 — deploy.yml 의 source.ref 와 같아야 한다
git branch --show-current         # 기대: main

# ③ 커밋되지 않은 변경
git status --short | head
```

- `ahead` 가 0 이 아니면 **푸시하거나**, 올리지 않을 커밋이면 사용자에게 확인받는다.
  `deploy.sh` 가 경고하지만 `--yes` 로 넘기면 그 경고도 지나간다.
- QA(`verdict=PASS`, 결함 0건) 보고가 없으면 기동하지 않는다.


### 🔴 `npm run build` 를 `deploy.yml` 에 그대로 쓰면 안 되는 이유

`package.json` 의 `build` 는 `~/.node-local/thekaiwa` 에서 빌드한다. 그대로 쓰면
빌드 산출물(`.next`)이 릴리스 디렉토리가 아니라 **모든 릴리스가 공유하는 단일 미러**에
떨어져, `current` 를 되돌려도 앱이 이전 버전으로 돌아가지 않는다 — **blue/green 이 무력화된다.**

그래서 `deploy.yml` 의 `build.command` 는 npm 스크립트를 우회해 릴리스에서 직접 빌드한다.
미러는 NFS `noexec` 회피책인데, 운영 경로(`/home/brownjeon/apps`)는 **ext4 라 우회가 불필요**하다.
**맥 개발에서는 `npm run build` 를 그대로 쓴다** — SMB 위에서는 미러가 여전히 필요하다.


---

## 3. 배포 실행

```bash
# ① 계획만 확인 — SSH 하지 않는다. 대상 호스트·경로·ref 를 눈으로 본다
scripts/deploy.sh TheMeal --dry-run

# ② 배포
scripts/deploy.sh TheMeal --yes
```



> ⚠️ **`--with-migrate` 를 스스로 붙이지 않는다.** 개발과 운영이 같은 NAS MariaDB
> (`192.168.219.154:3306`)를 본다. blue/green 롤백은 **코드만** 되돌리므로 마이그레이션은
> 되돌아가지 않는다. 필요하다고 판단되면 그 사실만 보고하고 사용자 승인을 기다린다.

---

## 4. 결과 판정

스크립트는 마지막에 `RELEASE_RESULT <json>` 한 줄을 출력한다.
**출력 문구가 아니라 이 JSON 의 `status` 로 판정한다.**

| `status` | 운영 상태 | 다음 조치 |
|---|---|---|
| `ok` | 새 릴리스 | §5 배포 후 확인으로 |
| `build_failed` | **영향 없음** (current 불변) | 빌드 로그 발췌 → developer. 수정 후 Reviewer 부터 재순환 |
| `health_failed` | **이전 릴리스로 자동 롤백됨** | pm2 로그 발췌 → developer. 수정 후 Reviewer 부터 재순환 |
| `rolled_back` | 이전 릴리스 (수동 롤백) | 사용자 지시로만 발생 |
| `rollback_unhealthy` | 🔴 **비정상** | 즉시 에스컬레이션. **추가 배포 시도 금지** |

```bash
scripts/deploy.sh TheMeal --status
scripts/deploy.sh TheMeal --logs 100
```

---

## 5. 배포 후 확인 — 여기가 핵심

`status: ok` 는 "프로세스가 떴다" 는 뜻이지 "기능이 동작한다" 는 뜻이 아니다.
아래를 **실제로 열어서** 확인한다. 확인하지 않은 항목은 "미확인"이라고 그대로 적는다.

### 화면·API

- [ ] `https://kaiwa.미라클펭귄.com` 메인 화면이 렌더링되는가
- [ ] `GET /api/health` 가 200 인가
      — ⚠️ 이 라우트가 **degraded 상태에서도 200 을 주는지** 본문을 확인한다.
        200 이면 `release.sh` 는 통과시키므로 깨진 상태가 "정상" 으로 판정된다
- [ ] 로그인·식단 기록 등 핵심 플로우 한 건이 동작하는가
- [ ] SNS 레시피 수집처럼 외부 호출을 하는 기능이 살아 있는가

### 프로세스

```bash
scripts/deploy.sh TheMeal --status
scripts/deploy.sh TheMeal --logs 100
```

- [ ] pm2 재시작 횟수가 늘어나지 않는가
- [ ] `shared/logs/` 에 로그가 실제로 쌓이는가

### ⚠️ Prisma 를 쓰는 프로젝트의 함정 — `generate` 가 조용히 실패한다

`prisma generate` 가 **구 스키마로 돌고도 `✔ Generated Prisma Client` 로 끝나는 경우**를
VoiceVault 에서 실측했다. 그 상태로 배포하면 신규 모델을 쓰는 기능이 500 으로 죽고,
로그만 봐서는 원인이 드러나지 않는다.

스키마를 바꾼 배포라면 배포 후 생성 결과를 직접 확인한다.

```bash
ssh home_ubuntu "grep -c '<신규모델 camelCase>' /home/brownjeon/apps/thekaiwa/current/node_modules/.prisma/client/index.d.ts"
# 0 이면 실패다 — 재배포하고 다시 확인한다
```

⚠️ `npx prisma` 를 쓰지 않는다 — `node_modules` 가 없는 곳에서 npx 가 레지스트리에서
Prisma RC 를 받아오려다 실패한다(맥에서 실측). 반드시 `node node_modules/.bin/prisma` 를 직접 호출한다.


---

## 6. 실패했을 때

### 롤백

```bash
scripts/deploy.sh TheMeal --rollback      # 직전 릴리스로
scripts/deploy.sh TheMeal --rollback 2    # 두 단계 전으로
```

`current` 심볼릭 링크를 되돌리고 pm2 를 reload 할 뿐이라 수 초면 끝난다.
**수동 롤백은 사용자 지시가 있을 때만** 한다 — 자동 롤백은 스크립트가 이미 한다.

> 🔴 **DB 마이그레이션은 되돌아가지 않는다.** 마이그레이션을 동반한 배포를 롤백하면
> 스키마와 코드가 어긋난 상태가 된다.
>
> ⚠️ **컷오버 직후 첫 롤백 주의.** 컷오버 이전에 만들어진 릴리스는 옛 `ecosystem.config.js`
> (미러·NFS 를 가리키는 cwd)를 담고 있다. 그리로 롤백하면 재등록이 옛 경로로 떨어져 실패한다.
> 새 ecosystem 으로 만든 릴리스가 2개 이상 쌓인 뒤에 롤백을 연습한다.

### 흔할 만한 실패와 원인

| 증상 | 원인 | 조치 |
|---|---|---|
| `SSH 접속 불가` | **포트가 22 가 아니다** (이 환경은 **993**) | `deploy.yml` 의 `target.port` 확인 |
| `shared 파일이 없다: .../shared/.env` | 첫 배포 전 `.env` 미배치 | `scp` 로 올린다 (§9) |
| `ref 를 찾을 수 없다` | 커밋이 origin 에 push 되지 않음 / 브랜치명 오기 | push 후 재시도. 이 프로젝트 기본 ref 는 `main` |
| 배포는 됐는데 **옛 코드가 돈다** | `ecosystem.config.js` 의 `cwd` 가 릴리스를 가리키지 않음 | `cwd: __dirname` 으로 고친 뒤 `pm2 delete` → 재배포 |
| `npm ci` ENOENT (`file:` 의존성) | lock 의 상대경로가 릴리스 깊이에서 어긋남 | §1 의 해당 선결 과제 참고 |
| 빌드는 맥에서 되는데 우분투에서 깨진다 | 네이티브 모듈·파일명 대소문자·경로 가정 | **코드가 환경을 가정한 것이다.** Reviewer 재순환 대상 |
| `배포가 이미 진행 중이다` | flock 점유 | 진행 중인 배포를 기다린다. 비정상 종료였다면 `$BASE/.deploy.lock` 확인 |

---

## 7. 하지 말 것

- ❌ 우분투에 직접 ssh 해서 `pm2` / `git pull` / `npm run build` 조작 — 배포 경로는 하나다
- ❌ `--with-migrate` 자체 판단 사용
- ❌ 사용자 승인 없는 수동 `--rollback`
- ❌ QA PASS 없이 배포
- ❌ 운영 릴리스 디렉토리 직접 편집 — 다음 배포에 사라진다. 편집 대상은 NAS 소스뿐이다
- ❌ 실패를 "환경 문제"로 단정하고 같은 명령 재시도
- ❌ 원격 저장소를 임의로 생성하지 않는다 — 사용자 작업이다
- ❌ NFS 데이터 경로(`DATA_ROOT`)를 배포로 옮기지 않는다 — 소스 트리 밖이라 롤백되지 않는다

---

## 8. 보고 형식

**실측치만 적고, 확인하지 않은 항목은 "미확인"이라고 그대로 적는다.**

```
[배포 — 식단관리 (TheMeal)]
- git log -1 / origin 대비 ahead:
- --dry-run 결과: (대상 호스트·경로·ref)
- RELEASE_RESULT: (JSON 원문 그대로)
- --status 결과: (current 릴리스·pm2·헬스)

[배포 후 확인]
- origin 존재 여부:
- 메인 화면 렌더링: 예/아니오
- /api/health (본문 포함):
- 핵심 플로우 1건: 예/아니오 (무엇을 시도했는지)
- pm2 재시작 횟수 변화:

[이상 징후]
- 로그의 ERROR·스택트레이스:
- 그 밖에 예상과 달랐던 것:
```

> ⚠️ VoiceVault 파일럿에서 QA 에이전트 3인이 테스트를 실행하지 않은 채 "PASS·결함 0건"을
> 보고했고 전부 사실이 아니었다. 배포는 운영을 바꾸는 행동이라 같은 일이 벌어지면 피해가
> 즉시 사용자에게 간다. **돌리지 않은 것을 돌렸다고 적지 않는다.**

---

## 9. 최초 컷오버 절차 (1회성)

> 🔴 **§1 의 1번(원격 저장소)이 풀리기 전에는 이 절을 실행할 수 없다.**

운영 중인 서비스를 blue/green 구조로 옮기는 단계다. **되돌릴 수 있는 순서로 진행한다.**
`pm2 delete` 는 순간적인 서비스 중단을 동반하고 deployer 의 권한 경계 밖이므로 **사용자가 수행**한다.

```bash
# (1) 운영 루트와 shared 준비
ssh home_ubuntu 'mkdir -p /home/brownjeon/apps/thekaiwa/shared'

# (2) .env 배치 — 없으면 첫 배포가 실패한다 (의도된 동작)
scp TheMeal/.env brownjeon@125.177.194.26:/home/brownjeon/apps/thekaiwa/shared/.env   # 포트 993 필요 시 -P 993

# (3) 계획 확인 (SSH 하지 않는다)
scripts/deploy.sh TheMeal --dry-run

# (4) 첫 릴리스 전개 + 빌드 + 헬스체크
#     이 시점에는 pm2 가 아직 옛 경로로 돌고 있다 — 운영은 영향받지 않는다
scripts/deploy.sh TheMeal

# (5) 헬스체크 통과를 확인한 뒤에만 pm2 재등록  ← 여기서 짧은 중단이 발생한다
ssh home_ubuntu 'pm2 delete themeal; cd /home/brownjeon/apps/thekaiwa/current && pm2 startOrReload ecosystem.config.js --only themeal --update-env && pm2 save'

# (6) 확인
scripts/deploy.sh TheMeal --status
ssh home_ubuntu "pm2 jlist | python3 -c \"import sys,json;[print(a['name'],a['pm2_env']['pm_cwd']) for a in json.load(sys.stdin)]\""
#   기대: pm_cwd 가 /home/brownjeon/apps/thekaiwa/releases/... 다
```

**실패 시 복귀** — pm2 를 옛 경로로 되돌린다. `apps/` 구조는 남겨둬도 운영에 영향이 없다.

```bash
ssh home_ubuntu 'pm2 delete themeal; cd <옛 경로> && pm2 start ecosystem.config.js --only themeal && pm2 save'
```

### 컷오버 완료 판정 — 전부 참일 때만 완료다

- [ ] `scripts/deploy.sh TheMeal --yes` 가 `RELEASE_RESULT {"status":"ok",...}` 로 끝난다
- [ ] `pm2 jlist` 의 `pm_cwd` 가 `/home/brownjeon/apps/thekaiwa/releases/...` 다 (themeal 전부)
- [ ] 운영 실화면이 정상이다 (§5)
- [ ] `--rollback` 으로 이전 릴리스 복귀가 되고, **다시 배포해 원복**했다
      (릴리스가 2개 이상 쌓인 뒤에 한다)
- [ ] `deploy.yml`·`deployer.md`·이 문서가 커밋되고 **푸시**됐다
- [ ] `shared/logs/` 에 로그가 실제로 쌓인다

> **롤백을 실제로 한 번 돌려보는 것**이 가장 중요하다. 롤백은 사고 났을 때 처음 쓰게 되는데,
> 그때 처음 돌려보면 늦는다.

---

## 10. 부록 — 경로·값 표

| 용도 | 값 |
|---|---|
| 편집 대상(유일한 SSOT) | `/Volumes/homes/brownjeon/project/TheMeal` (맥) / `/home/brownjeon/NFS/homes/brownjeon/project/TheMeal` (리눅스) |
| 맥 개발 실행 | `~/.node-local/thekaiwa/` — `.devmirror` 로 관리 (`scripts/sync-local.sh` 공용본) |
| 운영 경로 | `/home/brownjeon/apps/thekaiwa/current` |
| 릴리스 보관 | `/home/brownjeon/apps/thekaiwa/releases/` (최근 5개) |
| 릴리스 간 유지 | `/home/brownjeon/apps/thekaiwa/shared/` |
| pm2 앱 | `themeal` (단일) |
| 포트 | 3009 |
| 헬스 | `GET /api/health` |
| 운영 도메인 | https://kaiwa.미라클펭귄.com |
| 저장소 / ref | 🔴 **아직 없음** — 로컬 git 저장소는 있으나 remote 가 0개다 / `main` |
| 우분투 호스트 | `home-dev-x600` `125.177.194.26` · **sshd 993 포트** |
| DB | `192.168.219.154:3306` — **개발과 운영이 공유** |
| 매니페스트 | [`../deploy.yml`](../deploy.yml) |
| 실행 주체 | [`../.claude/agents/deployer.md`](../.claude/agents/deployer.md) |
