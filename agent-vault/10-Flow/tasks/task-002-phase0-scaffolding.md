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
