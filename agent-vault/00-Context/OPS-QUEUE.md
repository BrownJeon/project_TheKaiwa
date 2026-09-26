---
project: TheKaiwa
updated: 2026-09-26
tags:
  - type/context
---
# OPS-QUEUE — sudo·사용자 승인 대기 항목

| # | 항목 | 필요 이유 | 담당 | 상태 |
|---|------|----------|------|------|
| 1 | Gitea 저장소 `project_TheKaiwa` 생성 | push=배포 경로, webhook | 사용자 | ⬜ |
| 2 | NAS MariaDB `thekaiwa` DB·계정 | `DATABASE_URL` | 사용자 | ⬜ |
| 3 | Google OAuth 클라이언트(퓨니코드 콜백) | 로그인 | 사용자 | ⬜ |
| 4 | nginx vhost `kaiwa.*` + `/ws/speech` Upgrade + `/app/download/` | 웹·gateway 폴백·APK 배포본 | 사용자(sudo) | ⬜ |
| 5 | 맥 M4 `~/kaiwa-tts-run` 준비(venv·SBV2·모델) | tts-service | 사용자 | ⬜ |
| 6 | 우분투 `apps/thekaiwa/shared/{.env,secrets/}` 배치 | 첫 배포·credentialRef | 사용자 | ⬜ |
| 7 | `sync-projects.ps1` 실행(pwsh) | Codex 동기화 | 사용자 | ⬜ |
