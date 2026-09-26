---
project: TheKaiwa
updated: 2026-09-26
tags:
  - type/context
---
# 현재 상태 — 다음 세션은 이 문서부터 읽으세요

## 한 줄 요약

**설계 단계 완료 + 2·3·5차(TTS) 보완(2026-09-26), 구현 코드 0줄.** Git 원격 연동 완료(`origin/main`), **DB 스키마 생성 완료(50 테이블, seed 미실행)**, **Google OAuth 클라이언트 검증 완료**. nginx vhost 적용 완료. **task-002 Phase 0 완료(2026-09-26)** — `https://kaiwa.미라클펭귄.com` 에 로그인+5탭 앱 셸이 떠 있다(pm2 `thekaiwa`, 미러 실행). **task-004 완료(2026-09-27)** — `engine.llm` 파사드·router·페르소나 로더·프롬프트 3종, 회화 턴 p50 5.1s([[llm-japanese-quality]]: CLI 는 반드시 설정/MCP 생략·thinking 끔). 다음은 사용자 조치가 필요 없는 task-005(설정 허브·출석) → 006(채팅·점검·교정 채택) → 008(단어장·오늘의 단어) → 005b(콘솔 골격) 순으로 자율 진행. task-003(M4 tts 디렉토리 승인·실기기)은 사용자 조치 대기. 사용자 기획서 5종(원 기획서·음성 처리 아키텍처·Voice/Engine 관리 플랫폼·Admin Console·TTS 상용 벤치마크 보완)을 통합 설계안 `docs/design-spec.md` 와 정본 5종(`docs/design/{domain-model,api-contract,module-dependency,configuration-resolution,role-permission}.md`) + 설계 문서 34종(`docs/design/speech-platform/00~16`, `docs/design/admin-console/00~16`)으로 확정했다. 다음은 **task-002 Phase 0 스캐폴딩**이다.

### 사용자만 할 수 있는 것 (Phase 0 착수 전)
- ✅ **Gitea 저장소 `project_TheKaiwa`** 생성·연결·push 완료(2026-09-26, `origin/main` 추적)
- ✅ **NAS MariaDB** `thekaiwa` DB·계정 생성(사용자, 2026-09-26) → `TheKaiwa/.env` 생성·비밀번호 입력 → 우분투 미러 `~/.node-local/thekaiwa` 에서 prisma 6.19.3 `validate`·`db push`·`generate` 완료 — **50 테이블, utf8mb4_unicode_ci, `Correction.original` TEXT** (seed 는 task-002)
- ✅ **Google OAuth 클라이언트** — `.env` 의 ID·시크릿 검증(토큰 엔드포인트 `invalid_grant` = 자격 일치) + redirect URI `https://kaiwa.xn--lh0b87pnudm10a4vd.com/api/auth/google/callback` 등록 확인(인증 엔드포인트 200, 2026-09-26). 콘솔에는 `/api/auth/callback/google` 항목도 남아 있으나 무해
- ✅ **nginx vhost** 적용됨(2026-09-26 23:07, `/`·`/ws/speech` 502 = 앱·gateway 미기동 정상). APK `/app/download/` 는 alias 대신 앱 라우트 프록시로 conf 를 고쳤으니 task-009 전 재적용 1회. 원래 절차: [`../../docs/nginx/README.md`](../../docs/nginx/README.md)(`sites-available` 복사 + 심볼릭 링크 + `nginx -t` + reload, modsecurity id 9001010). 사용자 sudo 실행 후 `curl -sI` 로 502 확인(앱 기동 전 정상). task-002 완료 기준 "폰 https 로그인" 에 필요하므로 **task-002 진행 중 적용**
- ⬜ **맥 M4** 에 `~/kaiwa-tts-run` 디렉토리·venv·Style-Bert-VITS2 설치 위치 승인(tts-service)
- ⏸ `cc-sync-codex/sync-projects.ps1` 실행 — **1차 구현 후로 보류**(사용자 결정 2026-09-26)
- ✅ 포트 3010·8100 비어 있음(2026-09-26 `ss -ltnp` 실측; 8090 whisper·3009 TheMeal 점유). 우분투 node 20.20.2·npm 10.8.2·Claude CLI 2.1.222(claude.ai 로그인)·JDK 21·pm2 6.0.14·Python 3.10 확인. M4 home-m4-api :8000 응답, :8200 은 미기동(task-003)

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
