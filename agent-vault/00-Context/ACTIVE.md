---
project: TheKaiwa
updated: 2026-10-03
tags:
  - type/context
---
# 현재 상태 — 다음 세션은 이 문서부터 읽으세요

## 한 줄 요약

재개 문구: "일본어교육 작업 이어서 진행해줘". 프로젝트 표시 이름은 `일본어교육`(기술 식별자는 `TheKaiwa`/`thekaiwa`). Phase 1 구현 중 — task-002·004·005·**006(AI 채팅)·008(단어장)·005b(관리자 콘솔 골격)·003d(TTS P0 — 미리듣기·M4 :8200)·003e(STT gateway·마이크 테스트)·007(AI 음성 회화 — 웹)·003g(발음 사전 관리)** 완료·운영 반영(2026-09-27~28 전부 QA PASS). 운영 프로세스: pm2 `thekaiwa`(3010, 우분투 미러 `~/.node-local/thekaiwa` 에서 `next start`) · pm2 `thekaiwa-speech-gateway`(127.0.0.1:8100, nginx `wss://…/ws/speech`) · M4 tts :8200(crontab watchdog). **`pm2 save` 안 함** — 재부팅 시 앱·gateway 가 자동 기동되지 않는다(task-009 에서 등록). 앱 `https://kaiwa.미라클펭귄.com`. **003f 는 팀 작업·운영 반영 완료, 사용자 폰 F6 실측 대기**(nginx 재적용 ✅). 앱 이름 = **Lingofy Japanese**(부제 「일본어가 자연스러워지는 AI 회화」, 003h, 앱 1.0.1 — 기술 식별자는 TheKaiwa 유지). DB 구조 변경 3건은 task-018 로 **적용 완료**(2026-09-28, 백업 후 db push·webhook 배포). TradingInvest 는 사용자 승인으로 pm2 삭제(재부팅 부활 방지). NAS MariaDB fsync 완화는 사용자가 별도 세션에서. **task-009 완료(14:06)** — 운영은 `/home/brownjeon/apps/thekaiwa/current` 릴리스(blue/green)·`APP_ENV=PRODUCTION`, 배포 `bash scripts/deploy.sh TheKaiwa --yes`·롤백 `--rollback`, 미러는 개발 전용(미러 build 허용). **Phase 1 사실상 완료** — 남은 것: 사용자 폰 F6. **Phase 2 착수(2026-09-28 16:07)** — 사용자 결정: 상황 역할극(Scenario)은 Phase 2 후반 별도 task(010d) · 능력 축은 관측 기록만 Phase 2(010b) · 교정 방식 설정 추가·기본 유창성(010c). 순서 010 오늘의 회화 → 010b 반복 학습 → 010c 교정 방식 → 011 AI평가 → 012 달력 → 010d 상황 역할극(design-spec §15). **[[task-010-today-lesson]] 완료·운영 반영(2026-09-28 22:38, 커밋 `67771a5`)** — 같은 릴리스로 011 AI평가·012 달력 **서버**와 010b(A11·A5)·010c(talk@v3 — 운영 TALK 에 `[교정] 유창성` 줄 반영)·011(A6·A7) 프롬프트도 운영 반영(REV-031 PASS, 운영 스모크 010 65/65·011 61/61·012 32/32·007 44/44). 붙여넣기 레슨 A4 신뢰도(운영 11b 1회 실패) 진단은 prompt-engineer 진행. **2026-09-29 추가 운영 반영**: A4 붙여넣기 신뢰도 lesson@v6(`f4a3f32`, 운영 010 65/65) · **task-012b 1단계 분석 STT 파이프라인**(`8af4542`, 워커 미등록 — U1·U2 대기, 운영 007 44/44·011 60/60) · task-012c Console P2 **서버 1·2단계 운영 반영**(`6abe464`·`8c22f01` — 편집 선결 보안 게이트·설정 편집/버전/Rollback/감사 API, 화면은 데모 v2 승인 대기) · A4 lesson@v7(`6abe464`). **다음은 사용자 대기**: 데모 5개 승인 + DB 추가 승인(아래 §4 일괄 요청) — 승인 오면 designer 가이드 → activate → 화면·010b/010c/010d 서버. **데모 승인은 사용자만**. 운영 스모크는 반드시 `SMOKE_ENV=PRODUCTION`(빠뜨리면 발화 업로드 connection 이 LOCAL 로 잡혀 7e~7h 실패). NAS MariaDB fsync 완화는 사용자가 별도 세션에서.

> **개선 백로그(사용자 점검분)** — `10-Flow/improvements/`([[improvements/README|규칙]]). 사용자가 `/개선작업` 으로 계속 추가한다. **task-009 완료 전에는 추가만 하고 착수 금지** — 구현 task 에 끼워 넣지 않는다. 착수는 `/개선작업 착수`(Designer → Developer → Reviewer → QA).

### 재개 시 먼저 볼 것
- **⚠ push = 운영 배포(webhook, 2026-09-28)** — 코드 커밋은 QA PASS 뒤에만 push. 문서·vault 만 바뀐 push 는 배포를 건너뛴다(`deploy-thekaiwa.sh`, deploy-order §9-6). DB 스키마 변경은 사람이 백업 뒤 db push 먼저.
- **운영 배포 방식(task-009 이후)**: `bash scripts/deploy.sh TheKaiwa --yes`(origin/main 기준 — push 먼저) → `RELEASE_RESULT ok` 판정. 운영 로그 `/home/brownjeon/apps/thekaiwa/shared/logs/`. 운영 스모크는 `SMOKE_ENV=PRODUCTION`(연결 행이 환경별) + 포트 3010, admin 계열 QA 계정은 운영 세션 불가. 배포 직후 1분은 health 가 `degraded [stt_gateway]` 로 보일 수 있음(gateway 재기동 캐시).
- **task-007 운영 가동(2026-09-28 04:55)** — 회화 탭 기본, 운영 pm2 `thekaiwa` 아래 예열 `claude --print` 자식 프로세스가 0~2개(각 ≈270MB, 10분 유휴 정리)는 정상. 개발 dev 서버에서 웹 STT 를 쓰려면 운영 gateway(운영 Origin 만 허용) 대신 개발 gateway(`run_dev.py --port 8197`, `SPEECH_GATEWAY_ALLOWED_ORIGINS=http://localhost:<dev>`·`APP_INTERNAL_URL=http://127.0.0.1:<dev>`) + E2E `--ws-rewrite`(tests/live/task007-ui-e2e.mjs). QA 에이전트가 dev 서버를 끄지 않고 남기는 일이 있었다 — 작업 후 `ss -ltn` 으로 3011/3012 확인.
- **운영 반영 완료(2026-09-27 18:26, 사용자 지시)** — task-006·008·005b(005b 는 QA 전, 격리 복제본 운영 빌드로 스모크 005b 47/47·008 74/74 선검증) 를 미러 `npm run build` + `pm2 restart thekaiwa` 로 반영, https health 200·청크 200. origin push 완료(`c411fc3`, **origin 은 공개 도메인 URL 이라 이 PC 자격 증명이 없음 → LAN URL `http://192.168.219.154:3000/brownjeon/project_TheKaiwa.git` 로 push 후 `update-ref refs/remotes/origin/main`**). `SPEECH_INTERNAL_SECRET` 회전 완료(세션 출력 노출 사고 대응, NFS·미러 `.env` 동일 값).
- **⚠ 운영 pm2 가 `APP_ENV=LOCAL` 로 돈다** — ecosystem 에 APP_ENV 가 없어 `.env` 값(LOCAL)을 쓴다(task-002 부터). 콘솔 배지 LOCAL·PRODUCTION 보호 규칙 미발동·connection 행도 LOCAL. PRODUCTION 전환은 seed/connection 행 환경 이관과 함께 task-009(첫 blue/green) 에서 결정.
- **Codex 정상 운용 중(2026-09-27 한도 초기화 후)** — exec 모드로 task-006 C2(지적 0)·task-008 C2(2건 채택·수정)·task-005b C2(1건 = REV-009 Medium 과 동일) 완료. 래퍼 실행 시 NFS git 은 `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=safe.directory GIT_CONFIG_VALUE_0='*'`. codex 에이전트가 기록을 `## 최종 요약` 뒤에 붙이는 버릇 — Leader 가 `## Codex 검토` 절로 옮길 것.
- **judge·codex 운용**([[task-017-dev-env-judge-codex]]): 접수 시 `base_ref` → judge `intake`, C1(설계 직후)·C2(reviewer PASS 직후)·C3(결함 2회 재발) 마다 judge `codex_gate`. judge 도구는 Linux 에서 테스트 18/18(2026-09-27). NFS git 은 dubious ownership → 래퍼 실행 시 `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=safe.directory GIT_CONFIG_VALUE_0='*'` 환경변수로 넘김(전역 설정 변경 금지).
- 사용자 폰 확인 항목: (006) Gboard 일본어 IME 확정 Enter 미전송·보내기 후 키보드 유지·입력창 가림 없음 / (008) 실제 손가락 스와이프 감도·뜻 채우기·검색 중 Gboard 입력.
- **dev 서버 화면 검증 팁(QA-012 발견)**: Next 16 dev 는 `127.0.0.1` 로 열면 cross-origin 보호로 `_next/static` 청크가 403 → 하이드레이션 실패. **`localhost:3011` 로 접속**하면 정상(task-006 QA-011 의 "하이드레이션 실패"도 같은 원인 추정 — 채팅 화면 3폭은 이 방법으로 재확인 가능). `--webpack` dev 는 `crypto` 해석 실패로 못 씀.
- **운영과 분리한 빌드 검증**: `~/.node-local/thekaiwa-buildcheck` 에 미러를 복제(`node_modules` 는 `cp -al` 하드링크, `.next`·`logs` 제외) 후 `next build` → 확인 뒤 삭제. 미러에서 직접 build 금지.
- 결정 기록 [[llm-japanese-quality]] — Claude CLI 는 반드시 설정/MCP 생략·thinking 끔(안 하면 회화 1턴 40~120초). task-007 에서 **예열 CLI(프로세스당 1요청) + 첫 문장 조기 합성**으로 해결 — 손 뗌→첫 음성 바이트 p50 ≈1.8~2.1s(웹 경로).
- 인증이 필요한 API 검증은 `tests/live/qa-session.ts`(QA 계정 2개 `qa-bot`·`qa-bot2`, localhost 전용) + `tests/live/task006-smoke.sh`·`task008-smoke.sh <port>` 패턴(dev 서버 3011, 2프로세스 경합은 하드링크 복제 + 3012).
- 커밋은 `git -c safe.directory=$PWD -c user.name=brownjeon -c user.email=ifries8611@gmail.com commit` (저장소·전역 git 신원 미설정).

### 사용자만 할 수 있는 것 (Phase 0 착수 전)
- ✅ **Gitea 저장소 `project_TheKaiwa`** 생성·연결·push 완료(2026-09-26, `origin/main` 추적)
- ✅ **NAS MariaDB** `thekaiwa` DB·계정 생성(사용자, 2026-09-26) → `TheKaiwa/.env` 생성·비밀번호 입력 → 우분투 미러 `~/.node-local/thekaiwa` 에서 prisma 6.19.3 `validate`·`db push`·`generate` 완료 — **50 테이블, utf8mb4_unicode_ci, `Correction.original` TEXT** (seed 는 task-002)
- ✅ **Google OAuth 클라이언트** — `.env` 의 ID·시크릿 검증(토큰 엔드포인트 `invalid_grant` = 자격 일치) + redirect URI `https://kaiwa.xn--lh0b87pnudm10a4vd.com/api/auth/google/callback` 등록 확인(인증 엔드포인트 200, 2026-09-26). 콘솔에는 `/api/auth/callback/google` 항목도 남아 있으나 무해
- ✅ **nginx vhost** 적용됨(2026-09-26 23:07, `/`·`/ws/speech` 502 = 앱·gateway 미기동 정상). APK `/app/download/` 는 alias 대신 앱 라우트 프록시로 conf 를 고쳤으니 task-009 전 재적용 1회. 원래 절차: [`../../docs/nginx/README.md`](../../docs/nginx/README.md)(`sites-available` 복사 + 심볼릭 링크 + `nginx -t` + reload, modsecurity id 9001010). 사용자 sudo 실행 후 `curl -sI` 로 502 확인(앱 기동 전 정상). task-002 완료 기준 "폰 https 로그인" 에 필요하므로 **task-002 진행 중 적용**
- ⬜ **맥 M4** 에 `~/kaiwa-tts-run` 디렉토리·venv·Style-Bert-VITS2 설치 위치 승인(tts-service)
- ⏸ `cc-sync-codex/sync-projects.ps1` 실행 — **1차 구현 후로 보류**(사용자 결정 2026-09-26)
- ✅ 포트 3010·8100 비어 있음(2026-09-26 `ss -ltnp` 실측; 8090 whisper·3009 TheMeal 점유). 우분투 node 20.20.2·npm 10.8.2·Claude CLI 2.1.222(claude.ai 로그인)·JDK 21·pm2 6.0.14·Python 3.10 확인. M4 home-m4-api :8000 응답, :8200 은 미기동(task-003)

## 개선작업 진행 (2026-09-30 착수 — 사용자 점검 개선 백로그)

- 착수 조건(task-009 완료) 충족, `improvements/` 16건 중 13건을 7개 task 로 묶어 착수: [[task-020-improve-tab-label]]·[[task-021-improve-keyboard-inset]]·[[task-022-improve-voice-range]]·[[task-023-improve-vocab-screen]]·[[task-024-improve-talk-length]]·[[task-025-improve-today-lesson]]·[[task-026-improve-hangul-reading]]. 우선순위 미지정이라 Leader 권고 순서(020→021→022→023→024→025→026)를 **잠정** 채택 — 사용자가 바꿀 수 있다.
- **진행(2026-09-30 23:30)**: [[task-020-improve-tab-label]] ✅ · [[task-024-improve-talk-length]] ✅(`da263a6`) 운영 반영, [[task-022-improve-voice-range]] **서버**만 운영 반영(`0e1140c`, 화면은 데모 v2 승인 뒤). 운영 릴리스 `20260930-231913-da263a65`, 헬스 degraded 사유는 미등록 분석 워커(U1·U2 대기)뿐. 025 는 프롬프트(lesson@v8)·검사 코드가 **미커밋 WIP**(화면·라우트 타입 정리는 데모 승인 뒤).
- **사용자 지시(IMP-0011)**: 오늘의 단어 **참고 화면을 사용자가 업로드 예정**(미도착) — 데모 때 참고하고, **스와이프는 기존과 동일·버튼 구성만 간소하게**(항목 파일에 기록).
- **진행(2026-10-01 14:00)**: 사용자가 데모 11건을 권고안대로 승인(010b v1·010c v1·011 v1·012 v1·010d v1·012c v2·021 v1·022 v2·023 v1·025 v1·026 v1) · **DB 추가 변경 적용 완료**(백업 `files/thekaiwa/backups/thekaiwa-20261001-082739-pre-task010-schema.sql.gz`, 커밋 `989f1a3`) · **운영 반영 완료**: 022 음성 조절 화면(`d068ab0`) · **012b 분석 STT 워커 기동(`97b31cf`, 릴리스 `20261001-131341-97b31cf`, migrated:false)** — pm2 `thekaiwa-speech-worker` 등록·webhook `--apps` 3개·pyopenjtalk 운영 venv(U1·U2 ✅), 운영 라이브 검증(pm2 online·restarts 0·health 전부 true·스모크 007 45/45·011 61/61·010 65/65·012 32/32 — 012 첫 실행의 4f 1건은 앞선 011 스모크가 같은 QA 계정 스냅샷 updatedAt 을 건드린 부수 효과, 단독 재실행 32/32). **리뷰 단계**: 011(REV-046 PASS + Codex C2 REV-051 채택 → developer 수정 중) · 012(REV-048 CONDITIONAL_PASS — 평가 페이지 `today/eval/[evaluationId]` 는 011 과 같이 나가야 함) · 012c(REV-047 M-1 수정 완료 → 좁은 재감사 REV-054) · 021(웹 REV-049 PASS, QA E2E 94/95 — TalkRoom F390 listGap 342 원인 진단 중, APK·실기기 대기) · 023(REV-050 수정 완료 → 좁은 재감사 REV-053) · 025(REV-052 PASS·Medium 2 배포 전 조건 · judge C2=Codex 필수 adversarial/security → Codex 검토 중, PE 가 (e)=B A/B 재측정 중) · 010c(developer 구현 중). A6 CORRECTION_SPOT `segments`·`evalGen@v3` 는 prompt-engineer 진행. 011 데모 권고 6건(a~f)=B·B·B·B·B·A 그대로 구현.
- **진행(2026-10-01 16:15)**: 사용량 한도 재설정 후 재개. **리뷰·수정 진척**: 023 QA 재실행 PASS(Leader 가 직접 실행 근거만 채택·정리 재확인) · 011 REV-051 수정(저장 실패 수집→1회 재시도→시트·번호 칩) 재감사 REV-057 PASS · 012c REV-054 PASS 후 Codex C2 High 지적 → **REV-056 부분 채택(Medium)** — 설정 값 비밀 의심 검사가 STRING/JSON 편집 값에 없음(운영 `ConfigurationVersion` 0행이라 저장된 비밀 없음) → developer 수정 중(재귀 검사·RawTab 안내) 뒤 Reviewer 재시작 · 010c REV-055 PASS + M-1(헤더 교정 모드↔`[교정]` 줄 이중 신호) → PE 수정(`talk@v5`, `omitCorrectionMode`) → 좁은 재감사 REV-058 진행 · 025 Codex 0건, PE (e)=B A/B 재측정 중 · 021 QA F390 은 콜드 컴파일 타이밍(결함 아님)으로 진단, 워밍 재실행 대기. **011·012 통합 QA 1차는 BLOCKED_ON_ENV(미러 node_modules 심볼릭 링크 → Turbopack 거부, 예측·developer 결과 인용)로 반려** — 진짜 node_modules 복사 미러(`thekaiwa-qa-011b`)로 QA 재실행 중(012 단독 → 011 단독 순서, 같은 QA 계정 공유 오탐 회피). 011·012 는 같은 릴리스(평가 원본 링크 `today/eval/[evaluationId]` untracked)로 나가야 한다. 설계 정본 보강: `domain-model` ChatMessage.toolLog `correction{…}` 메타(010c), `design-spec` §8 A1 "교정 모드 칸 없음·`[교정]` 줄 단일 출처".
- 다음 디스패치 순서(DB 적용 완료, 게이트 활성화 후): 010b 서버 연결(011 뒤) → 010c → 010d(010b·010c 뒤) · 023 · 025(+PE e=B) → 026(025 뒤).
- 사용자 대기: IMP-0011 오늘의 단어 **참고 화면 업로드** + Q9 · IMP-0007 단어 출처 · IMP-0004 2단계(`/신규도입` 먼저) · IMP-0017 카드 목록 캡처 + 3결정(「채팅」 교체 vs 「시나리오」 추가 / 3모드·듣기 모드·설정 메뉴 범위 / 010d 데모 v2 교체) · nginx `/api/internal/` 차단 블록(sudo)·U-C1·U-C2 미승인.
- **진행(2026-10-03 10:00)**: 운영 반영 릴리스 `20261003-093130-2209ed2b`(커밋 `cb176cc`·`2209ed2`, migrated:false, 직전 `20261001-131341-97b31cff`) — 010b(서버 1단계)·010c·011·012·012c·021(웹만)·023·025 가 한 배치로 나갔다. 운영 스모크: 010 65/65 · 011 61/61 · 012 32/32 · 007 45/45 · **010b 52/52(누출 0)**. 스모크 스크립트 보정은 `c1d93e5`(tests-only, 아래 025b 배포로 푸시됨). 미러 5.4GB 정리. 후속 [[task-025b-lesson-hangul-fallback]] 등록(퀴즈 질문 한글 폴백 Medium 포함).
- **진행(2026-10-03 12:50)**: [[task-025b-lesson-hangul-fallback]] **완료·운영 반영** — 커밋 `9070e11`(+`c1d93e5`·`26c0a38` 함께 푸시), 릴리스 `20261003-124555-9070e11e`(직전 `20261003-093130-2209ed2b`, migrated:false), pm2 3개 online·`/api/health` ok. 운영 스모크 010 **65/65**(A4 재시도 0·누출 0·마지막 시도 로그 0건). 다음 세션은 **task-026(한글 읽기 변환·토글, 025b 완료로 선행 해소)부터** 신규 디스패치(D-10 정책이 신규 세션에 전부 적용됨 — judge 접수에 `origin:"improvement"`·`changed_paths` 전달, developer 모델은 judge 값 그대로). 010d 는 IMP-0017 결정 3 대기라 보류. 021 APK 1.0.2(versionCode 3) 는 **15:52 사용자 지시로 배포본 공개 완료**(AppRelease INSERT·minSupported 2) — 사용자 재설치 후 S25+ 확인(F6) 대기.
- **운영 관찰 항목**: A11(`reviewDecision`) 호출이 사용자당 하루 10회 초과하면 경보 · A11 실패(FALLBACK)·지연 감시(첫 스모크 1회 64.6s FAILED, 재실행은 12.5~29s 전부 DONE) · 010c COACH 힌트 누출률(운영 표본 ≥10건, 30% 초과 시 talk@v6) · lesson@v8 롤백 기준 4종(성공률 10%p↓ · 붙여넣기 FAILED · 빈 promptKo 저장 · 재시도 20% 초과).
- **다른 세션의 미커밋 변경(건드리지 않음)**: `CLAUDE.md`·`.claude/settings.json`·`.claude/agents/{deployer,developer,judge,leader,prompt-engineer,reviewer}.md`·`improvements/README.md` — D-10 개발 프로세스 문서 변경으로 보이며 이 세션이 만든 것이 아니다.
- 화면 코드는 데모 승인(또는 사용자 생략) 뒤에만 쓴다. 커밋·푸시(=운영 배포)는 task 별 QA PASS 뒤 진행 지시("진행/이어서") 범위 안에서 Leader 가 하고, 중단 요청이 있으면 보류한다.

## 1. 읽는 순서

| 순서 | 문서 | 무엇이 있나 |
|------|------|------------|
| 1 | [`../../CLAUDE.md`](../../CLAUDE.md) | 프로젝트 정체성·스택·6층 모듈·금기·팀 구성 |
| 2 | [`../../docs/design-spec.md`](../../docs/design-spec.md) | **통합 설계안** — §0 확정 사항 · §8 LLM · §9 음성 · §9-B Voice/Engine · §9-C Console · §15 Phase |
| 3 | `../../docs/design/domain-model.md` · `api-contract.md` · `module-dependency.md` · `configuration-resolution.md` · `role-permission.md` | **정본 5종** — 엔티티·API·모듈·설정 해석·권한 |
| 4 | `../../docs/design/speech-platform/00~16` · `../../docs/design/admin-console/00~16` | 세부 설계 34종 — **16 = TTS Productization 층**(5차 보완) |
| 4b | [`../../docs/design/learning-personalization-and-llm-data.md`](../../docs/design/learning-personalization-and-llm-data.md) · [`tutor-persona-validation.md`](../../docs/design/tutor-persona-validation.md) | **학습 개인화·반복 학습(강사 판단 3~7일)·주제·상황·기록 조회·M4 방안·지표** / 페르소나 검증 세트 |
| 5 | [[task-001-initial-planning]] · [[task-003b-tutor-persona-v1]] · [[task-003c-tts-productization-design]] | 설계 과정 전체 기록 — 무엇을 왜 정했는지 |
| 6 | [[stack-and-llm-choice]] · [[speech-architecture-decisions]] · [[tutor-persona-choice]] | 결정 이유 |

원문 5종은 `../../docs/{기획서,음성처리-기획안,음성처리-추가기획안,관리자콘솔-기획안,tts-보완-기획안}-원본.md` 에 그대로 있다(수정 금지).

## 2. 확정된 결정 (2026-09-26 사용자 확정)

| 주제 | 결정 |
|------|------|
| 이름·주소 | TheKaiwa / kaiwa.미라클펭귄.com / 포트 3010 / pm2 `thekaiwa` / Gitea `project_TheKaiwa` / appId `com.miraclepenguin.kaiwa` / 딥링크 `thekaiwa://` |
| 클라이언트 | Next.js 16 + Prisma 6(NAS MariaDB) + Capacitor 7 Android(루트). 기획서의 React Native 는 정정(참고 대상 주짓수일상이 Capacitor 였음) |
| LLM | Claude CLI 구독(`--print --json-schema`), 회화 haiku / 점검·레슨·평가 sonnet / 분석 opus. home-m4-api 는 어댑터만 |
| 음성 | 안드로이드 기본 STT/TTS **미사용**. 실시간 STT = **온디바이스 네이티브 플러그인**(Kotlin + sherpa-onnx AAR + ReazonSpeech int8, 모델은 첫 실행 시 서버 다운로드) / 서버 gateway(우분투 pm2+venv :8100) 는 웹·저사양 폴백 / 분석 STT = VoiceVault whisper-service 재사용 / TTS = **Style-Bert-VITS2 on 맥 M4 :8200** / 발음 분석 = 음성 Phase 3(narabas+pyopenjtalk+F0) |
| 음성 서비스 실행 | 우분투 pm2+venv(VoiceVault whisper 방식), 큐 = MariaDB `SpeechJob` 폴링(Redis 없음) |
| APK 갱신 | 네이티브 변경 task 는 deployer 가 APK 재빌드·배포본 제공·업데이트 안내(`<apk_release>`), 앱은 `/api/app/version` 배너 |
| Voice/Engine | Voice 는 데이터(Registry·Profile·Package Import·통합 미리듣기), Engine = Descriptor(코드)+Connection(DB)+Schema+Health/Test+Fallback, Secret 은 `credentialRef` 만 |
| Console | Role 4단계(capability), Effective Config + 8층 Source, ConfigurationVersion·Audit·Rollback, Environment(LOCAL/PRODUCTION), Playground·E2E·Trace, Prompt Registry |
| 팀 | leader·designer·developer·prompt-engineer·reviewer·qa·deployer 7인 + 강사 페르소나 `tutor.md` |
| 강사 페르소나 v1 | 단일 · 일본인 원어민 · 교정에 철저(strictness 기본 STRICT) · 한국어 설명+일본어 대화 · 이름 사용자 지정(`Profile.teacherName`) · 런타임 전용(개발팀 미편입) |
| 반복 학습 | **강사가 3~7일에서 판단(A11)**, 코드는 범위 강제·`RepetitionItem` 기록·균등 랜덤 추출·FOCUS(≤3일)·폴백. "3일 고정" 폐기 |
| 학습 설계 보완 | 주제→상황 역할극(`Scenario` 제안)·관측/능력 축(제안)·ASK 기록 조회 계층(3a 정형 조회, LLM SQL 금지, 출처 표시)·M4 모델 후보(Qwen3·Qwen3-Swallow·Qwen3.5, 벤치마크 대상)·LoRA 는 공통 강사 행동만·개인 데이터 학습 금지 유지 — 사용자 결정 필요 항목은 새 문서 §8 |
| TTS 5차 보완 | TTS 는 **플랫폼 층**(L4 `speech/tts`): 발음 사전+버전·Japanese Text Normalizer·엔진 독립 Rendering Plan·`SpeechProfile` 5종(`TtsMode` 교체)·청크 스트리밍+Playback Queue·캐시 키 12요소·**강사 프로필 옆 실행 상태 표시등**(P0) / 관측·Timing·Golden 회귀·A/B·Voice Versions/Canary(P1 제안) / 온디바이스 TTS(P2 research). **M4 tts-service = `style_bert_vits2` 위 자체 FastAPI**(원 서버에 사전·타이밍·스트리밍·pitch 없음, 실측). 사용자 결정 5건은 [[task-003c-tts-productization-design]] |
| 이번 산출물 | **설계 문서만**. 코드·실물 스키마 없음 |

## 3. 다음 세션이 반드시 지켜야 할 것

- **6층 import 방향** `app(+admin) → {preferences, conversation, learning, speech} → engine → infra`, 라우트·화면에 엔진명 금지
- **제안→채택**: AI 산출은 `PROPOSED` 로만, 채택 전 다른 테이블 행 0. `Correction.original` 무수정. 집계는 `StatsSnapshot` 만
- **Secret 은 `credentialRef` 만**, 관리자 변경은 `ConfigurationVersion`+`AuditLog` 필수
- **NFS noexec** — `node_modules`·빌드·pm2 는 `~/.node-local/thekaiwa/`, NFS `src/` 가 편집 대상. 빌드 출력을 `| head` 로 자르지 말 것(SIGPIPE)
- **네이티브 변경은 착수 전 고지** + `versionCode` 증가 + deployer APK
- **TTS**: 라우트·LLM·클라이언트는 SBV2 파라미터명을 모른다(어댑터 전용). 발음 사전 변경은 새 `PronunciationLexiconVersion` + `AuditLog`. 원문은 Trace 에 남기지 않고 `normalizedText` 해시만
- 5초 예산 실측 게이트(§9)를 task-003 에서 먼저 통과시킬 것 — 못 맞추면 목표 재정의는 사용자 결정

## 4. 다음 작업 — Phase 0

**[[task-002-phase0-scaffolding]] 이력서 작성 완료(status: todo).** DB 선행: 사용자가 [[OPS-QUEUE]] #2 SQL 을 실행하고 `.env` 를 두면 Leader 가 `prisma db push` 로 48 테이블을 만든다(시드는 task-002). 사용자 선결 항목(위 ⬜) 중 저장소·DB·OAuth 가 끝나면 designer → developer×2 → reviewer → qa 순으로 배정한다. 병렬 착수 가능: task-003(플러그인+음성 P0)·task-004(AI 클라이언트+페르소나 v1)·task-005(설정 허브)·task-005b(Console 골격)는 002 직후.

Phase 1 전체 계획은 [[board]] Backlog 와 `design-spec.md` §15.

> **2026-09-28 21:10 사용자 대기(일괄 요청)**: Phase 2 데모 5개 검토·승인 — 010b https://claude.ai/artifact/WtuZFyoPu2PbkJuzMGusJx · 010c https://claude.ai/artifact/3R8hFUYHumSxYThz4qdFg1 · 011 https://claude.ai/artifact/2b6HjEwsxQkioKHxx7oiiq · 012 https://claude.ai/artifact/Pov9EdqNGL9x4jaFJ2MPoz · 010d https://claude.ai/artifact/VbLHUXXbMnM4R4ZAv7vxgj (전부 review_requested) + DB 추가 승인(010b LearningObservation·enum 3 / 010c Profile.correctionMode / 010d Scenario·ScenarioTopic·Lesson.scenarioId·Chat.scenarioId·Chat.lessonId / 011 EvaluationItem.textRevealedAt — 전부 additive, 백업 후 db push).
> **2026-09-29 03:50 사용자 대기 추가**: ⑥ **012c 콘솔 편집 데모 v2** https://claude.ai/artifact/6xHJK9pXzMpWxCfSZaT65o (review_requested, 데모 안 결정 6건 — 권고 d1 B·나머지 A) · **012b 운영 반영 승인** U1(pm2 `thekaiwa-speech-worker` 신규 기동 + webhook `--apps` 에 worker 추가 — 저장소 밖 `~/.local/webhook-deploy/deploy-thekaiwa.sh`) · U2(운영 venv 에 pyopenjtalk 설치 — sudo 불필요, 소스 빌드) · (선택) nginx `location /api/internal/ { return 404; }`(sudo) · **U-C1**(TTS Voice Versions·Canary → Phase 4 이관) · U-C2(TTS 회귀 경보 합격 기준 초안값 사용). 012b 코드는 U1·U2 없이도 배포 가능(워커 없으면 적재 0·health 의 `stt_analysis_worker` 만 degraded).

> **2026-10-01 사용자 승인 반영(위 두 대기 줄은 아래로 해소)**: ① "대기 중인 데모 전부 권고안대로 승인" — 010b·010c·011·012·010d·012c(v2)·021·022(v2)·023·025·026 데모 11건 게이트 기록 완료(권고안 전부). ② "db추가 승인 및 012b 분석 작업도 이어서 진행해줘" — DB 추가 4건(010b LearningObservation+enum 3·010c Profile.correctionMode·010d Scenario 계열·011 textRevealedAt)은 **백업 → db push → 코드** 순서로 진행, 012b U1(워커 pm2 기동+webhook `--apps`)·U2(운영 venv pyopenjtalk)도 진행. **미승인 유지**: nginx `/api/internal/` 차단(sudo)·U-C1·U-C2·IMP-0011(참고 화면 업로드+Q9)·IMP-0007·IMP-0017 카드 화면 캡처.
