# 일본어교육 (TheKaiwa)

> **제품 이름: Lingofy Japanese** · 부제 「일본어가 자연스러워지는 AI 회화」(사용자 결정 2026-09-28, task-003h) — 화면·런처·웹 매니페스트에 쓰는 이름. 저장소·도메인·appId `com.miraclepenguin.kaiwa`·딥링크 `thekaiwa://`·쿠키·pm2·APK 저장 이름 등 **기술 식별자는 TheKaiwa/thekaiwa 그대로**(값 정본 `src/components/common/brand.ts`).

**AI 일본어 선생님과 말하고(회화)·쓰고(채팅) 교정받으며, 오늘의 단어·회화·평가와 강사가 3~7일에서 판단하는 반복 커리큘럼으로 회화를 훈련하는 개인 모바일 앱 (kaiwa.미라클펭귄.com)**

모바일 웹(갤럭시 S25+ Chrome)으로 테스트하고, 같은 서버를 Capacitor 안드로이드 앱(WebView `server.url`)으로 감싸 운영한다. 앱은 운영 웹을 로드하므로 **웹 변경 = 웹 배포**, **네이티브 변경(플러그인·Manifest·Capacitor 설정) = APK 재빌드·재설치**(deployer 가 배포본·업데이트 안내 담당).

> **현재 단계: 설계 완료, 코드 0줄 (2026-09-26).** 새 세션은 `agent-vault/00-Context/ACTIVE.md` 부터 읽는다.

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드·API | Next.js 16 (App Router) + TypeScript + Tailwind v4, 포트 **3010**, pm2 `thekaiwa` |
| DB | MariaDB(NAS 192.168.219.154) + Prisma 6 — `.env`의 `DATABASE_URL`만. 개발·운영 공유(`prisma db push`만, `migrate dev` 금지). 설정 엔티티는 `environment` 컬럼으로 분리 |
| 인증 | Google OAuth(`@workspace/auth-oauth`) + httpOnly 쿠키 JWT `thekaiwa_session` + 초대코드. **앱은 Custom Tabs + `thekaiwa://` 딥링크 60초 1회용 `AppAuthCode` 교환**. 권한은 Role 4단계(USER/ADMIN/DEVELOPER/SUPER_ADMIN) × capability |
| LLM | **Claude CLI 구독**(`--print --permission-mode dontAsk --json-schema`, 회화 haiku / 점검·레슨·평가 sonnet / 분석 opus) — `src/modules/engine/adapters/llm/claudeCli` 유일 경로. home-m4-api `/v1/chat`(qwen)은 어댑터만(단어 보강·폴백 후보) |
| 실시간 STT | **온디바이스** Capacitor 플러그인 `@thekaiwa/sherpa-stt`(Kotlin + sherpa-onnx AAR + ReazonSpeech zipformer int8, 모델은 첫 실행 시 `/models/` 다운로드). 폴백 = 우분투 gateway(`speech/gateway`, WS `/ws/speech`, 127.0.0.1:8100). **안드로이드 기본 STT/TTS 미사용** |
| 분석 STT | VoiceVault whisper-service 재사용(127.0.0.1:8090) — `speech/worker` 가 MariaDB `SpeechJob` 큐로 비동기 처리, Transcript Ensemble(confidence·requiresReview) |
| TTS | **Style-Bert-VITS2 on 맥 M4**(`~/kaiwa-tts-run`, :8200, AGPL 격리, `style_bert_vits2` 라이브러리 위 **자체 FastAPI 래퍼** — 원 `server_fastapi` 에는 사전·타이밍·스트리밍·pitch 라우트 없음) — 다중 Voice Profile·통합 미리듣기. 앱 L4 `speech/tts` 가 **TTS 플랫폼 층**(발음 사전+버전·Japanese Text Normalizer·엔진 독립 Rendering Plan·`SpeechProfile` 5종·청크 스트리밍+Playback Queue·캐시 키 12요소·실행 상태 표시등)을 소유하고, 어댑터만 SBV2 파라미터를 안다(정본 `docs/design/speech-platform/16-tts-productization-layer.md`) |
| 발음 분석 | 음성 Phase 3: narabas + pyopenjtalk + F0 (모라·長音·促音·피치·유창성) |
| 엔진 관리 | Engine Descriptor(코드) + Connection Profile(DB) + Configuration Schema + Health/Functional Test + Fallback + 8층 설정 해석(Effective Configuration) + ConfigurationVersion·Audit·Rollback |
| 앱 | Capacitor 7 Android(루트 `android/`), `server.url` 퓨니코드, edge-to-edge·쿠키 flush·KeyboardInset(VoiceVault 보정 5종) |
| 운영 | 우분투 pm2 blue/green(`thekaiwa`·`thekaiwa-speech-gateway`·`thekaiwa-speech-worker`) + nginx `kaiwa.xn--lh0b87pnudm10a4vd.com` + M4 tts-service(git push 웹훅, 사용자 승인) + APK 배포본 `/app/download/latest.apk` |

## 설계 문서

> **새 세션은 `agent-vault/00-Context/ACTIVE.md`부터 읽으세요** — 확정 결정·사용자 대기 항목·다음 작업이 한 곳에 있습니다.

- **통합 설계안(단일 출처)**: [docs/design-spec.md](docs/design-spec.md) — §0 확정 사항 · §3 6층 아키텍처 · §8 LLM/Conversation · §9 음성 · §9-B Voice/Engine · §9-C Admin Console · §15 Phase
- **정본 5종**: [domain-model](docs/design/domain-model.md)(DB Entity·Prisma) · [api-contract](docs/design/api-contract.md)(API·WS·SSE) · [module-dependency](docs/design/module-dependency.md)(6층 모듈·import 행렬) · [configuration-resolution](docs/design/configuration-resolution.md)(8층 설정 해석) · [role-permission](docs/design/role-permission.md)(Role×capability)
- **세부 설계**: `docs/design/speech-platform/00~15` · `docs/design/admin-console/00~16` · [learning-personalization-and-llm-data](docs/design/learning-personalization-and-llm-data.md)(학습 개인화·반복 학습·주제/상황·기록 조회·M4 방안) · [tutor-persona-validation](docs/design/tutor-persona-validation.md)
- **원문 보존(수정 금지)**: `docs/{기획서,음성처리-기획안,음성처리-추가기획안,관리자콘솔-기획안}-원본.md`
- **결정 이유**: `agent-vault/30-Knowledge/decisions/{stack-and-llm-choice,speech-architecture-decisions,tutor-persona-choice}.md`

## 디렉토리 구조 (설계, Phase 0 에서 생성)

```
TheKaiwa/
├── .claude/{settings.json, agents/{leader,designer,developer,prompt-engineer,reviewer,qa,deployer,judge,codex,tutor}.md}
├── agent-vault/{00-Context,10-Flow,20-Log,30-Knowledge}
├── docs/{design-spec.md, design/{정본 5종, speech-platform/, admin-console/}, *-원본.md, screens.md, demo/, nginx/, deploy-order.md}
├── prisma/{schema.prisma, seed.ts, seed-data/}          # Phase 0
├── plugins/sherpa-stt/            # Capacitor 플러그인(Kotlin) — 온디바이스 VAD+ReazonSpeech
├── speech/{speech.config.yml, common/, gateway/, worker/, tts-service/(M4), models/, test-assets/}
├── android/ · capacitor.config.ts · ecosystem.config.js · deploy.yml · .devmirror · .npmrc · .env.example
└── src/
    ├── middleware.ts
    ├── app/{(auth)/{login,invite}, (app)/{study/{ai,today},plan,drawer,settings,ask}, (admin)/admin/*, api/{health,auth,v1,admin/v1,internal,app/version,models}}
    ├── components/{shell,talk,chat,vocab,lesson,eval,plan,drawer,settings,admin,ask,speech,common}
    └── modules/                   # ★ 6층 플랫폼 — 위→아래로만 import
        ├── admin/          # L0 (app 층 조합): console·configuration·diagnostics·playground·audit·permissions
        ├── preferences/    # L1 User Preference: Profile(학습)·UserVoiceSetting·UserSpeechSetting·AppSetting
        ├── conversation/   # L2 Conversation Platform: orchestrator·persona·promptBuilder·promptRegistry·structuredResponse·chats·corrections·proposals·prompts/**
        ├── learning/       # L3 Learning Platform: vocab·topics·lessons·reviewSchedule·evaluation·studyLog·attendance·studyPlan·learningHistory·snapshots
        ├── speech/         # L4 Speech Platform: utterances·stt(RealtimeSttClient·OnDevice·WebSocket·modeResolver)·tts(parameterResolver·TtsPlayer·cache)·voices·analysis
        ├── engine/         # L5 Engine Management: registry·connections·credentials·health·functionalTest·router·fallbackPolicy·configuration(resolver·versions·overrides)·trace·adapters/{llm,stt,tts}
        └── infra/          # L6 AI Infrastructure: db·secrets·storage·jobs·runtime·config·audit·logging·dates·native/bridge
```

## 연동 원칙 (금기와 짝)

- **6층 방향**: `app(+admin) → {preferences, conversation, learning, speech} → engine → infra`. 같은 층은 `index.ts` 만, conversation↔speech 는 라우트가 조합, 각 층은 자기 테이블만.
- **엔진명은 `engine/adapters`·`speech/common`·seed 에만**. 라우트·화면·L1~L4·사용자 UI 에 `reazon/whisper/style-bert/claude`·model_id·speaker_id 가 나오면 위반.
- **AI 는 제안만**: `Correction`/`TutorProposal`/`StudyPlan` 은 `PROPOSED` 로 생성, 채택 시에만 `WordEntry`·`StudyLog(ACCEPTED)`. 사용자 직접 행위(세트 완료·평가 제출·레슨 완료)는 `StudyLog(DIRECT)`+`StatsSnapshot` 을 **한 트랜잭션**. `Correction.original` 은 UPDATE 금지. 집계는 `StatsSnapshot` 만 읽는다(삭제 후 불변).
- **LLM 계약**: 모든 프롬프트에 "응답은 JSON 객체 하나뿐", `--json-schema` + `extractJson` + ajv 1회 재시도. §67 구조화 응답. LLM 은 `speech.style` 만 내고 speaker/model/pitch 는 TTS Parameter Resolver(User > VoiceProfile > Persona > Context > LLM)가 정한다.
- **음성**: 실시간 경로(플러그인/gateway → 턴 → 문장 단위 TTS)에 분석을 동기로 넣지 않는다. 원음·전체 대화·Secret 은 `RequestTrace`·로그·Export 에 남기지 않는다. 오디오 원본 보존 30일.
- **설정·Secret**: 관리자 변경은 `ConfigurationVersion`+`AuditLog` 없이 저장 금지, Rollback 은 새 버전. Secret 은 `credentialRef`(`env:`/`file:`)만 저장. PRODUCTION 변경은 SUPER_ADMIN 확인.
- **5초 예산**: A1 프롬프트 ≤3,000자·2문장, 계측 `toolLog{traceId,…}`, 12s fail-fast.

## 모바일 UI 원칙

**412×892 기준**(S25+), 앱 WebView ≈390px → **360/390/412 세 폭 검증**. `100dvh`, 최상위 그리드 `minmax(0,1fr)`, `min-width:0`, 터치 44px↑(푸시투토크 ≥64px), 일본어 본문 16px↑·후리가나 토글, `env(safe-area-inset-*)`, 화면당 스크롤 1곳, 하단 탭 5개(회화·오늘·계획표·서랍장·질문)+상단 아바타(설정). 앱/웹 분기는 로그인·실시간 STT 경로·APK 배너 세 곳만.

## 환경 변수

`.env.example` → `.env`. 그룹: APP_ENV·PORT·DATA_ROOT / DATABASE_URL / JWT_*·SIGNUP_INVITE_CODE·OWNER_* / GOOGLE_*·OAUTH_CALLBACK_BASE·APP_DEEP_LINK_SCHEME / CLAUDE_CLI_*·AI_API_* / SPEECH_GATEWAY_URL·SPEECH_INTERNAL_SECRET·SPEECH_CONFIG_PATH·TTS_SERVICE_URL·WHISPER_SERVICE_URL·SECRETS_DIR / APK_DOWNLOAD_BASE. `.env`·`shared/secrets/` 는 절대 커밋하지 않는다.

## 빌드/실행 (Phase 0 이후)

**NFS는 noexec** — `node_modules`·빌드·pm2 실행은 `~/.node-local/thekaiwa/`, NFS `src/`가 유일한 편집 대상(`scripts/sync-local.sh`, `.npmrc install-links=true`). 음성 서비스 venv 는 `~/.node-local/thekaiwa-speech/venv`.

```bash
cp .env.example .env
npm run dev                     # sync-local → ~/.node-local/thekaiwa 에서 next dev -p 3010
npm run build > /tmp/build.log 2>&1; echo $?     # ⚠️ 출력을 | head 로 자르지 마라(SIGPIPE 로 빌드가 죽는다)
bash scripts/sync-local.sh && cd ~/.node-local/thekaiwa && ./node_modules/.bin/prisma db push --skip-generate && ./node_modules/.bin/prisma generate
bash scripts/build-apk.sh       # 우분투, JDK 21 — 네이티브 변경 시만(deployer)
```

## 금기 사항

- 라우트·화면에서 spawn/fetch/`window.Capacitor` 직접 호출, 엔진명 분기, 안드로이드 기본 STT/TTS 사용
- 세션 토큰·API Key 를 URL·localStorage·앱·DB·Export·Trace·로그에 싣기(앱 교환은 60초 `AppAuthCode`, Secret 은 `credentialRef`)
- 사용자 입력을 shell 문자열로 조립(항상 argv), `DATA_ROOT` 밖 경로, 소유자·capability 검사 생략
- AI 산출을 채택 없이 저장, `Correction.original` 수정, 삭제 경로에서 `StatsSnapshot` 변경
- 관리자 설정을 `ConfigurationVersion` 없이 변경, PRODUCTION 임시 Override
- 하위 층에서 상위 층 import, `index.ts` 우회 import
- 네이티브 변경을 고지·`versionCode` 증가 없이 배포, 모델 파일·`.env`·`android/build` 커밋
- 사용자 대화·음성 데이터를 학습에 사용

## 에이전트 팀

| 역할 | 모델 | 담당 |
|------|------|------|
| leader | **Opus** | 요구사항→사양(정본 인용), task 이력서 큐레이션, 6층·제안→채택·Secret 원칙 수호, 인프라·문서, 최종 보고 |
| designer | **Opus** | 412/390px 화면·관리자 콘솔 IA·목업·구현 가이드(`docs/screens.md`), 음성 우선 입력, 엔진명 비노출 |
| developer | **Opus** | Next.js·Prisma·6층 모듈·Python 음성 서비스·Kotlin 플러그인 구현(adapter 경유), 네이티브 변경 고지 |
| prompt-engineer | **Sonnet** | 강사 페르소나 `tutor.md`·프롬프트 모듈(A1~A10)·JSON 계약·회귀 픽스처·Prompt Registry sync |
| reviewer | **Sonnet** | 6층 경계·보안·LLM 계약·학습 원칙·ConfigurationVersion·엔진명 누출·네이티브 고지 독립 감사 |
| qa | **Haiku** | 인증·capability·제안→채택 행 수·스냅샷·복습 판단 범위(3~7일·FOCUS ≤3) 가드·기록률·5초/3분 지표·양 경로 STT·3폭·실기기·APK 배너 검증 |
| deployer | **Haiku** | `scripts/deploy.sh TheKaiwa`·음성 서비스 헬스·M4 배포(사용자 승인)·**APK 재빌드·배포본·업데이트 안내** |
| judge | **Haiku** | Jev 판정 도구 실행 — 작업 접수 분류(유형·복잡도·developer 모델)·Codex 개입 판정(C1·C2·C3). 직접 추론·코드 수정 금지 (2026-09-27 개발환경 개선 선도입, ADP-001-C02) |
| codex | **Haiku** | judge 개입 판정 시에만 Codex CLI 읽기 전용 검토 실행·기록. 실패해도 작업 진행 후 실패 내역 보고 |
| tutor (런타임) | Sonnet | `.claude/agents/tutor.md` v1 = 일본인 원어민·교정 철저·한국어 설명+일본어 대화·이름 사용자 지정·복습 주기 3~7일 판단(key `teacher-persona`). 개발팀 아님, 앱 런타임이 `--agents` 로 로드 |

## Phase 로드맵

| Phase | 내용 | 상태 |
|-------|------|------|
| 설계 | 기획서 4종 통합·6층 재설계·정본 5종·설계 문서 33종·팀·vault | ✅ 완료 (2026-09-26) |
| 0 | 스캐폴딩·6층 골격·Prisma·seed·OAuth·health·앱 셸·pm2·deploy 경로 | ⬜ [[task-002]] (Gitea ✅ · DB SQL 대기 · OAuth) — `prisma/schema.prisma`·`package.json`·`sync-local.sh` 는 준비됨 |
| 1 | 온디바이스 STT 플러그인+gateway+M4 TTS P0 실측 / AI 클라이언트+페르소나 v1 / 설정 허브+미리듣기 / Console 골격 / AI 채팅·교정 / AI 회화 / 단어장+오늘의 단어 / 통합 QA·라이브·APK | ⬜ task-003~009 |
| 2 | 오늘의 회화(주제·상황·청취 구간)·반복 학습(강사 판단 3~7일·RepetitionItem) / AI평가 / 달력 / 음성 P2(whisper 분석·Ensemble) / Console P2(편집·Version·Rollback·Prompt Registry·Playground) | ⬜ |
| 3 | 분석·성장기록 / 서랍장 전체 / 무엇이든 물어보세요 / 음성 P3(발음 분석) / Console P3(E2E·Diagnostics·Debug) | ⬜ |
| 4 | Voice Package Import·스타일·Preset·Export/Import·Override·Admin Web 분리 검토 | ⬜ |

> Phase별 상세 범위·완료 기준은 [설계안 §15](docs/design-spec.md). 착수 전 반드시 읽을 것.

## Compact instructions

컴팩트 시 변경 파일 경로, Phase 진행 상태, 사용자 대기 항목(OPS-QUEUE), 실측 게이트 결과, 미해결 결정(SBV2 화자 매핑·Redis·EngineMetricsDaily)을 우선 보존한다. 탐색 출력·중간 디버깅은 버린다.

---

**현재 상태·다음 작업은 `agent-vault/00-Context/ACTIVE.md` 참조**

## 배포

배포 절차의 **정본은 [`docs/deploy-order.md`](docs/deploy-order.md)** (Phase 0 에서 작성). 배포 전에 그 문서를 먼저 읽는다.

| 항목 | 값 |
|---|---|
| 배포 명령 | `scripts/deploy.sh TheKaiwa` (웹 + 음성 gateway/worker, 우분투 pm2 blue/green) |
| 실행 주체 | `.claude/agents/deployer.md` (QA PASS 이후에만 기동) |
| 대상 프로세스 | thekaiwa · thekaiwa-speech-gateway · thekaiwa-speech-worker |
| M4 tts-service | `git push` 웹훅(사용자 승인 게이트), `http://192.168.219.100:8200/health` |
| APK | 네이티브 변경 시 deployer `<apk_release>` → `/app/download/latest.apk` + `/api/app/version` 배너 |
| 현재 상태 | **컷오버 준비 완료(task-009 R1)** — `deploy.yml` 앱 2개(thekaiwa·thekaiwa-speech-gateway)·`ecosystem.config.js` 릴리스 cwd(`__dirname`)·`shared/logs`·`package-lock.json` 재생성(격리 `npm ci`+build 실측)·`/api/health` 필수 실패 503. **운영은 아직 미러**(`~/.node-local/thekaiwa`, `APP_ENV=LOCAL`) — 컷오버(R2: `$BASE/NFS` 링크·`shared/.env` `APP_ENV=PRODUCTION`·`--yes`)는 `docs/deploy-order.md` §9. 컷오버 전까지 미러 `npm run build` 금지 |

- 배포는 **`origin` 의 ref 기준**이다 — push 되지 않은 커밋은 나가지 않는다.
- `--with-migrate`(DB 마이그레이션)는 **사용자 승인 사항**이다. 개발과 운영이 같은 NAS MariaDB 를 본다.
- 배포 실패로 수정했다면 곧바로 재배포하지 않고 **Reviewer 부터 전체 재순환**한다.

워크스페이스 공통: [배포 메커니즘](../docs/dev-deploy-workflow.md) · [연계 정책](../docs/deployer-integration-procedure.md) · [앱 전환 가이드](../docs/app-conversion-guide.md)

## 에이전트 팀 세션 프로토콜

이 CLAUDE.md 로드 및 현재 상태 요약 완료 후, 아래 팀 소집 문구를 자동 출력한다.

```
---
🚀 에이전트 팀 소집
프로젝트: 일본어교육 (TheKaiwa)
팀 구성:
  - leader          (Opus)   — 요구사항 분석·정본 기반 사양·task 큐레이션·인프라·최종 보고
  - designer        (Opus)   — 412/390px 화면·관리자 콘솔 IA·목업·구현 가이드 (docs/screens.md)
  - developer       (Opus)   — Next.js·Prisma·6층 모듈·Python 음성 서비스·Kotlin 플러그인 구현
  - prompt-engineer (Sonnet) — 강사 페르소나(tutor.md)·프롬프트 모듈·JSON 계약·회귀 픽스처
  - reviewer        (Sonnet) — 6층 경계·보안·LLM 계약·제안→채택·ConfigurationVersion 독립 감사
  - qa              (Haiku)  — 인증·권한·집계·스냅샷·지표(5초/3분)·양 경로 STT·3폭·실기기 검증
  - deployer        (Haiku)  — 운영 배포(scripts/deploy.sh TheKaiwa)·M4 TTS·APK 재빌드·업데이트 안내
  - judge           (Haiku)  — Jev 판정: 작업 접수 분류·developer 모델·Codex 개입(C1 설계·C2 리뷰 후·C3 재발)
  - codex           (Haiku)  — judge 판정 시에만 Codex 읽기 전용 외부 검토, 실패는 보고 후 진행
  · tutor           (런타임 페르소나, 개발팀 아님) — .claude/agents/tutor.md

워크플로우: Leader(→Judge 접수) → Designer → Prompt-Engineer → [Judge C1 → Codex?] → Developer → Reviewer → [Judge C2 → Codex? → Reviewer 판정] → QA → Deployer → Leader
작업 지시 방법:
  → leader에게 직접 요청하면 팀이 역할별로 분담해서 처리합니다.
  → 팀 정리 시: "팀 정리해줘" 또는 "Clean up the team"
---
```
