---
project: TheKaiwa
updated: 2026-09-26
tags:
  - type/context
---
# OPS-QUEUE — sudo·사용자 승인 대기 항목

| # | 항목 | 필요 이유 | 담당 | 상태 |
|---|------|----------|------|------|
| 1 | Gitea 저장소 `project_TheKaiwa` 생성 | push=배포 경로, webhook | 사용자 | ✅ 2026-09-26 (webhook 등록은 task-002/009) |
| 2 | NAS MariaDB `thekaiwa` DB·계정 — 관리자로 실행: `CREATE DATABASE thekaiwa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER 'thekaiwa'@'%' IDENTIFIED BY '<비밀번호>'; GRANT ALL PRIVILEGES ON thekaiwa.* TO 'thekaiwa'@'%'; FLUSH PRIVILEGES;` 후 `TheKaiwa/.env` 에 `DATABASE_URL=mysql://thekaiwa:<비밀번호>@192.168.219.154:3306/thekaiwa` | `prisma db push` | 사용자 → Leader 검증 | ✅ 완료(2026-09-26): SQL 실행(사용자) → `.env` 생성·비밀번호 입력 → 우분투 미러 prisma 6.19.3 validate·db push·generate, **50 테이블·utf8mb4_unicode_ci 확인**. `package-lock.json` 을 NFS 로 복사해 커밋. seed 는 task-002 |
| 3 | Google OAuth 클라이언트(퓨니코드 콜백) | 로그인 | 사용자 | ✅ 2026-09-26 — ID·시크릿(`invalid_grant`)·redirect URI `/api/auth/google/callback` 검증 완료 |
| 4 | nginx vhost `kaiwa.*` + `/ws/speech` Upgrade + `/app/download/` | 웹·gateway 폴백·APK 배포본 | 사용자(sudo) | ✅ 2026-09-26 23:07 사용자 적용(`nginx -t` 통과, `/`·`/ws/speech` 502=업스트림 미기동 정상). `/app/download/` alias 가 403(www-data 가 `/home/brownjeon` 750 미통과) → 앱 라우트 프록시로 conf 수정, **task-009 전 재적용 1회** |
| 5 | 맥 M4 `~/kaiwa-tts-run` 준비(venv·SBV2·모델) | tts-service | 사용자 | 🟡 2026-09-27 사용자 진행 — 가이드 [`speech/tts-service/SETUP-M4.md`](../../speech/tts-service/SETUP-M4.md)(1~6단계, 결과 8항목 회신). :8200 미기동 |
| 6 | 우분투 `apps/thekaiwa/shared/{.env,secrets/}` 배치 | 첫 배포·credentialRef | 사용자 | ⬜ |
| 7 | `sync-projects.ps1` 실행(pwsh) | Codex 동기화 | 사용자 | ⏸ 1차 구현 후(사용자 결정 2026-09-26) |
