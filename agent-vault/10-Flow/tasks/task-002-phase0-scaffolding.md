---
task_id: task-002
title: "Phase 0 — Next.js 스캐폴딩·6층 골격·Prisma 정본·seed·OAuth·health·앱 셸·pm2·deploy 경로"
status: todo
roles_involved: [leader, designer, developer, reviewer, qa]
related_tasks: [task-001-initial-planning]
tags:
  - type/task
  - domain/infra
  - domain/auth
  - domain/ui
aliases:
  - Phase0
  - 스캐폴딩
created: 2026-09-26
updated: 2026-09-26
---

## 목표 (Leader 작성)
`design-spec.md` §15 Phase 0: 폰 브라우저에서 `https://kaiwa.미라클펭귄.com` 로그인 → 5탭 이동이 되고, `/api/health` 200(`status: ok`), 360/390/412 세 폭 잘림 0, `api-contract.md` 의 Phase 0 라우트가 전부 존재하는 상태.

## 관련 과거 이력 요약
- **선행 완료(2026-09-26, [[task-003c-tts-productization-design]] 직후)**: NAS MariaDB `thekaiwa` DB·계정 생성(사용자) → `.env` 생성(JWT·내부 시크릿 난수, DATA_ROOT=NFS `files/thekaiwa`) → 우분투 `~/.node-local/thekaiwa` 에서 prisma 6.19.3 `validate`·`db push --skip-generate`·`generate` 완료 → **50 테이블**(정본 §3 그대로, seed 미실행). `scripts/sync-local.sh` 는 `src/` 부재를 허용하도록 guard 추가. Google OAuth 클라이언트는 `.env` 에 입력·검증 완료(ID·시크릿·redirect URI `/api/auth/google/callback`). nginx vhost conf 는 `docs/nginx/` 에 준비(사용자 sudo 적용 대기 — 로그인 e2e 전에 적용). 우분투 실측: 포트 3010·8100 빈 상태, node 20.20.2, Claude CLI 2.1.222 로그인됨, JDK 21, pm2 6, whisper :8090 정상, M4 :8000 응답·:8200 미기동. **착수 준비 완료(2026-09-26)** — 사용자 "진행" 지시 시 leader 가 developer×2·designer·reviewer·qa 로 분배.
- [[task-001-initial-planning]] — 정본 5종·확정 결정. TheMeal Phase 0(`TheMeal/agent-vault/10-Flow/tasks/task-002-phase0-scaffolding.md`)이 같은 골격의 선례(Next.js 16·Prisma·OAuth·앱 셸·health·pm2, 회귀 35/35, `.env.example` 시크릿 Critical 교훈).
- 선결(사용자): Gitea 저장소 · NAS DB · Google OAuth 클라이언트 → [[OPS-QUEUE]].

## Leader 지시사항
- **범위**: (1) `create-next-app`(TS·Tailwind v4·App Router, 포트 3010, 미러 `~/.node-local/thekaiwa`) (2) `src/modules/{admin,preferences,conversation,learning,speech,engine,infra}` 골격 + `index.ts` + ESLint `import/no-restricted-paths`(`module-dependency.md` §3 행렬) (3) `prisma/schema.prisma` = `domain-model.md` §3 블록 그대로 + `db push` + `seed.ts`(`domain-model.md` §7: SUPER_ADMIN·주제 5·N5 단어 50·Engine 디스크립터·connection 6·FallbackPolicy·VoiceProfile 2~3·AppSetting) (4) TheMeal 인증 이식(쿠키 `thekaiwa_session`, `thekaiwa://`, 착지 `/study/today`, `AppAuthCode`) + `middleware.ts` (5) `GET /api/health`(boolean checks: env_database·env_jwt·env_google_oauth·claude_cli·speech_gateway·tts_service·whisper_service) (6) 앱 셸: 하단 탭 5 + 상단 아바타 + `KeyboardInset` + `AttendancePing` 자리 + `(admin)` 레이아웃 자리(capability 없으면 404) (7) `.npmrc`·`scripts/sync-local.sh`·`ecosystem.config.js`(`thekaiwa`)·`deploy.yml`·`docs/nginx/kaiwa.xn--lh0b87pnudm10a4vd.com.conf`(`/ws/speech` Upgrade 포함)·`docs/deploy-order.md`·`next.config.ts`(`Permissions-Policy: microphone=(self)`) (8) pm2 등록·첫 blue/green 배포.
- **역할**: designer=셸 토큰·탭 아이콘·빈 화면 가이드(`docs/screens.md` 시작) / developer A=auth·health·prisma·seed / developer B=셸·모듈 골격·infra(파일 경계: `src/modules/{infra,preferences}`+`prisma` vs `src/app`+`src/components`+`src/modules/admin` 골격) / reviewer=`.env.example` 시크릿·OAuth 딥링크·ESLint 경계·health 값 노출 / qa=로그인 분기·3폭·health·`curl -I` Permissions-Policy.
- **금지**: 음성·엔진 어댑터 구현(task-003/004), 프롬프트(task-004), Redis, `prisma migrate dev`.
- **완료 기준**: 위 목표 + `grep -rn 'reazon\|whisper\|style-bert' src/app src/components` 0건 + reviewer PASS + qa PASS + 첫 배포 `RELEASE_RESULT ok`(저장소 준비 시).

## Designer 기록

## Developer 기록

## Reviewer 기록

## QA 기록

## 배포 기록

## 최종 요약

## 체크포인트 (사용량 한도 대비 — 재개 시 여기부터)
- [x] 1. TheMeal 골격 복사·치환(설정 5종·infra auth/db/jwt/session/dates/native·api/auth 6·health·(auth) 페이지·public) — 2026-09-26 23:30
- [x] 2. Role 4단계·메일 제거·착지 /study/today·health checks·package.json·eslint 층 경계·modules/*/index.ts
- [x] 3. 앱 셸((app)/layout·TabBar 5탭·아바타→/settings·AttendancePing 자리·탭별 준비중 페이지·settings 페이지·root redirect)
- [x] 4. prisma/seed.ts + seed-data 4종(OWNER SUPER_ADMIN·주제 5·N5 50·Engine 5·connection 6×2환경·Fallback·Voice 3·AppSetting·PromptTemplate 키)
- [x] 5. 우분투 미러 npm install → prisma generate → typecheck/lint → next build → db seed
- [x] 6. pm2 thekaiwa 기동(미러) → https://kaiwa.… health 200·로그인·5탭 확인(사용자 육안: 폰)
- [ ] 7. reviewer·qa 순환 (reviewer 1차 PASS_WITH_NOTES 8건 → 전부 수정·재검증 PASS_WITH_NOTES 1건(app 클라이언트 컴포넌트의 infra index) → `*.client.tsx` 관례+ESLint 금지로 해소. QA 실행 중. 이전 기록: — 5·6 결과: typecheck 0·lint 0 error·build OK·seed 2회 멱등(주제5·조각60·엔진5·conn12·정책8·voice3·style6·setting12·prompt11)·pm2 thekaiwa online 127.0.0.1:3010·https health ok·Permissions-Policy microphone=(self)·보호 경로 307→/login·/api/auth/me 401·google 307. **폰 로그인·5탭은 사용자 육안**, OWNER 첫 로그인 후 db:seed 재실행 필요)(Permissions-Policy·3폭·IDOR) → 최종 요약·커밋

## Reviewer 기록 (2026-09-26)
- 1차(커밋 e22fd7e): PASS_WITH_NOTES — High 2(ESLint 글롭 깊이로 경계 우회 가능 / `/api/health` 키에 엔진명), Medium 3(OAuth 쿠키 `tm_*` 잔존 / seed 환경별 값 정본 차이 / infra 하위 import 무제한), Low 3(주석 `/home`·정본 credentialRef·가타카나 읽기).
- 수정(커밋 659342c): ESLint `boundary()` 정규식 생성기(모든 깊이 금지·index 우회 금지·컴포넌트의 infra index 금지, 음성 테스트 9건) · health 는 `admin.getHealthSummary()` 로 역할 키(`llm·stt_gateway·stt_analysis·tts`)·boolean·1.5s 프로브·60s 캐시 · 쿠키 `thekaiwa_oauth_{state,pending}` · 문서 동기화(api-contract #1, design-spec §13, domain-model §7: LOCAL 도 우분투 미러).
- 재검증: PASS_WITH_NOTES 1건 — `src/app` 의 `'use client'` 파일이 `@/modules/infra`(Prisma) 를 import 할 수 있음 → 앱 내 클라이언트 컴포넌트를 `*.client.tsx` 로 개명(4개)하고 그 패턴에 infra index 금지 추가, 음성 테스트 1건 확인. `server-only` 는 tsx 단위 테스트에서 예외를 던져 채택하지 않음.
