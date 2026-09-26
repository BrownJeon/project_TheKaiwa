---
project: TheKaiwa
updated: 2026-09-26
tags:
  - type/context
---
# 현재 상태 — 다음 세션은 이 문서부터 읽으세요

## 한 줄 요약

**설계 단계 완료(2026-09-26), 구현 코드 0줄.** 사용자 기획서 4종(원 기획서·음성 처리 아키텍처·Voice/Engine 관리 플랫폼·Admin Console)을 통합 설계안 `docs/design-spec.md` 와 정본 5종(`docs/design/{domain-model,api-contract,module-dependency,configuration-resolution,role-permission}.md`) + 설계 문서 33종(`docs/design/speech-platform/00~15`, `docs/design/admin-console/00~16`)으로 확정했다. 다음은 **task-002 Phase 0 스캐폴딩**이다.

### 사용자만 할 수 있는 것 (Phase 0 착수 전)
- ⬜ **Gitea 저장소 `project_TheKaiwa` 생성**(맥 PAT 은 `write:repository` 뿐이라 생성 불가 — Gitea UI 에서) → `git remote add origin` 후 push
- ⬜ **NAS MariaDB** `thekaiwa` DB·계정 생성 → `.env` `DATABASE_URL`
- ⬜ **Google OAuth 클라이언트** 발급 — redirect URI `https://kaiwa.xn--lh0b87pnudm10a4vd.com/api/auth/google/callback`(퓨니코드)
- ⬜ **nginx vhost** `kaiwa.xn--lh0b87pnudm10a4vd.com` → `127.0.0.1:3010` + `/ws/speech` → `127.0.0.1:8100`(Upgrade) 적용(sudo). DNS·TLS 는 와일드카드라 손댈 필요 없음
- ⬜ **맥 M4** 에 `~/kaiwa-tts-run` 디렉토리·venv·Style-Bert-VITS2 설치 위치 승인(tts-service)
- ⬜ `cc-sync-codex/sync-projects.ps1` 실행(pwsh 있는 머신) → `.codex/`·`AGENTS.md` 생성
- ⬜ 포트 3010·8100 이 서버에서 비어 있는지 `ss -ltnp` 확인(문서 기준으로는 비어 있음)

## 1. 읽는 순서

| 순서 | 문서 | 무엇이 있나 |
|------|------|------------|
| 1 | [`../../CLAUDE.md`](../../CLAUDE.md) | 프로젝트 정체성·스택·6층 모듈·금기·팀 구성 |
| 2 | [`../../docs/design-spec.md`](../../docs/design-spec.md) | **통합 설계안** — §0 확정 사항 · §8 LLM · §9 음성 · §9-B Voice/Engine · §9-C Console · §15 Phase |
| 3 | `../../docs/design/domain-model.md` · `api-contract.md` · `module-dependency.md` · `configuration-resolution.md` · `role-permission.md` | **정본 5종** — 엔티티·API·모듈·설정 해석·권한 |
| 4 | `../../docs/design/speech-platform/00~15` · `../../docs/design/admin-console/00~16` | 세부 설계 33종 |
| 5 | [[task-001-initial-planning]] | 설계 과정 전체 기록 — 무엇을 왜 정했는지 |
| 6 | [[stack-and-llm-choice]] · [[speech-architecture-decisions]] | 결정 이유 |

원문 4종은 `../../docs/{기획서,음성처리-기획안,음성처리-추가기획안,관리자콘솔-기획안}-원본.md` 에 그대로 있다(수정 금지).

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
| 이번 산출물 | **설계 문서만**. 코드·실물 스키마 없음 |

## 3. 다음 세션이 반드시 지켜야 할 것

- **6층 import 방향** `app(+admin) → {preferences, conversation, learning, speech} → engine → infra`, 라우트·화면에 엔진명 금지
- **제안→채택**: AI 산출은 `PROPOSED` 로만, 채택 전 다른 테이블 행 0. `Correction.original` 무수정. 집계는 `StatsSnapshot` 만
- **Secret 은 `credentialRef` 만**, 관리자 변경은 `ConfigurationVersion`+`AuditLog` 필수
- **NFS noexec** — `node_modules`·빌드·pm2 는 `~/.node-local/thekaiwa/`, NFS `src/` 가 편집 대상. 빌드 출력을 `| head` 로 자르지 말 것(SIGPIPE)
- **네이티브 변경은 착수 전 고지** + `versionCode` 증가 + deployer APK
- 5초 예산 실측 게이트(§9)를 task-003 에서 먼저 통과시킬 것 — 못 맞추면 목표 재정의는 사용자 결정

## 4. 다음 작업 — Phase 0

**[[task-002-phase0-scaffolding]] 이력서 작성 완료(status: todo).** 사용자 선결 항목(위 ⬜) 중 저장소·DB·OAuth 가 끝나면 designer → developer×2 → reviewer → qa 순으로 배정한다. 병렬 착수 가능: task-003(플러그인+음성 P0)·task-004(AI 클라이언트+페르소나 v1)·task-005(설정 허브)·task-005b(Console 골격)는 002 직후.

Phase 1 전체 계획은 [[board]] Backlog 와 `design-spec.md` §15.
