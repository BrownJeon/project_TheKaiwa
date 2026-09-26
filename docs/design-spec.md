# TheKaiwa 통합 설계안 (일본어회화 앱)

> **단일 출처.** 사용자 기획서 4종(`기획서-원본.md` · `음성처리-기획안-원본.md` §1~§24 · `음성처리-추가기획안-원본.md` §25~§77 · `관리자콘솔-기획안-원본.md` §78~§128)을 통합하고, 6층 플랫폼 아키텍처에 맞게 DB Entity·API·모듈·설정 해석·권한을 재설계한 결과다. 세부 정본은 `docs/design/` 5종과 `speech-platform/`·`admin-console/` 문서 33종이며, 이 문서는 요약과 결정을 담는다. 작성 2026-09-26. **구현 코드 없음.**

| 정본 | 내용 |
|---|---|
| [design/domain-model.md](design/domain-model.md) | 전체 Prisma 스키마·층별 소유·상태 전이·삭제/스냅샷·시드 |
| [design/api-contract.md](design/api-contract.md) | 전 엔드포인트(무버전·`/api/v1`·`/api/admin/v1`·`/api/internal`·WS·SSE·Python 내부) |
| [design/module-dependency.md](design/module-dependency.md) | 6층 모듈·import 행렬·Python 대응·플러그인 경계·이식 매핑 |
| [design/configuration-resolution.md](design/configuration-resolution.md) | 8층 Source 우선순위·Effective Configuration·Schema·Environment·Override |
| [design/role-permission.md](design/role-permission.md) | Role 4단계 × capability 매트릭스·라우트 매핑 |
| `design/speech-platform/00~15` | Voice·Engine·Connection·Health·Router·Fallback·설정 UI (기획안 §77) |
| `design/admin-console/00~16` | Console IA·Resolver·Version·Audit·Diff·Rollback·Playground·Trace·Prompt Registry·Environment (기획안 §128) |

---

## 0. 사용자 확정 사항 (2026-09-26)

| 항목 | 결정 |
|---|---|
| 프로젝트명·주소 | **TheKaiwa** — `./TheKaiwa/`, `kaiwa.미라클펭귄.com`(퓨니코드 `kaiwa.xn--lh0b87pnudm10a4vd.com`), appId `com.miraclepenguin.kaiwa`, pm2 `thekaiwa`, 포트 3010, Gitea `project_TheKaiwa`, 딥링크 `thekaiwa://`, 쿠키 `thekaiwa_session` |
| 클라이언트 | Next.js 16 App Router + TS + Tailwind v4 + Prisma 6(NAS MariaDB) + Capacitor 7 Android(루트). 기획서의 React Native 는 정정(참고 대상 주짓수일상이 Capacitor+Android 였고 워크스페이스 표준도 동일) |
| LLM | Claude CLI 구독(`--print --json-schema`). 회화 턴 haiku / 점검·레슨·평가 sonnet / 분석 opus. home-m4-api 는 어댑터만 |
| 음성 처리 | 별도 스택(§9): sherpa-onnx + ReazonSpeech(실시간) / faster-whisper(분석) / Style-Bert-VITS2(TTS) / Pronunciation Analyzer(Phase 3). **안드로이드 기본 STT/TTS 미사용** |
| 실시간 STT 위치 | **온디바이스 네이티브 플러그인**(Kotlin + sherpa-onnx AAR, 휴대폰 CPU·메모리, 모델은 첫 실행 시 서버 다운로드). 서버 WebSocket gateway 는 웹·저사양 **폴백**, 라우터가 device capability 로 선택 |
| 음성 서비스 실행 | 우분투 **pm2 + venv**(VoiceVault whisper 방식). Redis 없이 MariaDB `SpeechJob` 폴링 큐 |
| TTS 호스트 | **처음부터 맥 M4**(`~/kaiwa-tts-run`, :8200) |
| APK 갱신 | 네이티브 변경 task 는 **deployer 가 APK 재빌드·배포본 제공·업데이트 안내**. 앱은 `GET /api/app/version` 배너 |
| Voice·Engine 관리 | 기획안 §25~§77 채택 — Voice 는 데이터(Registry·Profile·Package Import·상태·통합 미리듣기), Engine = Descriptor(코드)+Connection Profile(DB)+Configuration Schema+Health/Functional Test+Fallback, 사용자/관리자 설정 분리, Credential 은 `credentialRef` 만, LLM/Speech/Learning 6층 분리 |
| Admin Console | 기획안 §78~§128 채택 — Role 4단계(capability), Effective Configuration + 8층 Source, Schema 기반 Form/JSON 편집(Validate→Test→Diff→Apply), ConfigurationVersion·Audit·Rollback, Environment(LOCAL/PRODUCTION 사용), Plugin Registry, Playground·E2E·Trace·Diagnostics·Log level, Prompt Registry, Preset/Export/Import/Override |
| 팀 | leader(Opus)·designer(Opus)·developer(Opus)·prompt-engineer(Sonnet)·reviewer(Sonnet)·qa(Haiku)·deployer(Haiku) + 강사 런타임 페르소나 `tutor.md` |
| 이번 산출물 | **설계 문서만**. 코드·실물 `schema.prisma`·API 구현은 Phase 0 이후 |

## 1. 목적과 범위

- **목적**: 일본어 초~중급 1인 학습자가 학원 없이 매일 짧게 AI 선생님과 회화·채팅으로 교정받고, 단어·회화·평가와 3일 반복 커리큘럼으로 습관을 만들며, 성장 기록을 근거로 개인 맞춤 계획을 받는다.
- **목표(기획서)**: ① 실전 표현 교정으로 말하기 자신감 ② 매일 학습 + 3일 반복 습관 ③ 강사 에이전트의 평가·분석 기반 커리큘럼.
- **성공 기준**: 회화 세션 교정 응답 5초 이내(p50 ≤4.5s·p95 ≤7s) · 주간 연속 출석률 60%↑ · 단어 1세트 3분 이내 · 평가 결과 기록률 100%.
- **범위 밖**: 원어민 실시간 통화(§16 권고: 외부 서비스 연동만 추후 검토), 커뮤니티·랭킹. **발음 피치·억양 채점은 기획서에서 범위 밖이었으나 음성 기획안 §9·§21 로 음성 Phase 3 에 편입**(게이트: Phase 2 신뢰도 데이터).

## 2. 기술 스택

| 영역 | 선택 | 근거 |
|---|---|---|
| 웹·API | Next.js 16 App Router + TS + Tailwind v4, 포트 3010 | TheMeal 골격(`src/lib/{auth,ai,db,session}`, `scripts/sync-local.sh`, `ecosystem.config.js`) 이식. NFS noexec → `~/.node-local/thekaiwa` 미러 |
| DB | NAS MariaDB + Prisma 6, `db push` 만 | 개발·운영 공유(TheMeal 관례). 설정 엔티티 `environment` 컬럼 |
| 인증 | `@workspace/auth-oauth` Google + httpOnly JWT + 초대코드 + 앱 딥링크 60초 `AppAuthCode` | TheMeal·VoiceVault 검증 경로 |
| 앱 | Capacitor 7 Android, `server.url` 퓨니코드, `adjustMarginsForEdgeToEdge:'auto'`·`errorPath`, `MainActivity.onPause` 쿠키 flush, `KeyboardInset`, `scripts/build-apk.sh`(JDK 21, 우분투) | VoiceVault 보정 5종. TheMeal `next.config.ts` 의 `microphone=()` 은 **복사 금지**(`microphone=(self)`) |
| LLM | Claude CLI(`claudeCli.ts` = TheMeal + bjj `--agents`/`stream-json` 확장), home-m4 어댑터(`llmClient.ts`, system-first 가드) | 구독 비용 0, 일본어 교정 품질. qwen 은 P0 비교 실측 후 보조 용도 결정 |
| 음성 | §9 | — |
| 큐·잡 | MariaDB `SpeechJob`/`AiJob` 폴링(`SELECT … FOR UPDATE SKIP LOCKED`) | 우분투에 Redis 없음, 1인 앱 처리량 |
| 재사용 | bjj `masterChat.js`(턴·락·SSE·폴링), `gymMasterPersona.js`, `SwipeCardDeck.jsx`(제스처·셔플·제외집합) | §7 참조. 픽미업은 퀴즈가 아니므로 정오답·보관은 신규 |

## 3. 아키텍처 (기획안 §76 6층 + 실제 배치)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Japanese Learning App  — Next.js app 층 (+ admin 조합 모듈)                 │
├──────────────────────────────────────────────────────────────────────────┤
│ L1 User Preference   — Profile(학습) · UserVoiceSetting · UserSpeechSetting │
├──────────────────────────────────────────────────────────────────────────┤
│ L2 Conversation      — Orchestrator · Persona · PromptBuilder/Registry ·     │
│                        StructuredResponse(§67) · Chat/Correction/Proposal   │
├──────────────────────────────────────────────────────────────────────────┤
│ L3 Learning          — Vocab · Topic/Chunk · Lesson/ReviewSchedule ·        │
│                        Evaluation · StudyLog/Attendance · StudyPlan ·       │
│                        LearningHistory · StatsSnapshot · Knowledge(RAG 슬롯) │
├──────────────────────────────────────────────────────────────────────────┤
│ L4 Speech            — Utterance · STT 클라이언트 라우팅 · TTS Parameter     │
│                        Resolver/Player/Cache · Voice Registry · Analysis    │
├──────────────────────────────────────────────────────────────────────────┤
│ L5 Engine Management — Registry(Descriptor·Schema) · Connection ·           │
│                        Health/Test · Router · Fallback · Configuration      │
│                        Resolver/Version/Override · Trace · Adapters         │
├──────────────────────────────────────────────────────────────────────────┤
│ L6 AI Infrastructure — db · secrets(credentialRef) · storage(DATA_ROOT) ·   │
│                        jobs · runtime(spawn/http/ws) · config · audit · log │
└──────────────────────────────────────────────────────────────────────────┘
```

**물리 배치**
```
휴대폰(Capacitor)                      우분투(pm2 blue/green)                    맥 M4
 ├ WebView ← kaiwa.… (Next.js :3010)   ├ thekaiwa (Next.js)                      ├ kaiwa-tts-run (Style-Bert-VITS2 :8200)
 ├ @thekaiwa/sherpa-stt 플러그인        ├ thekaiwa-speech-gateway (:8100, WS 폴백) ├ home-m4-api (:8000, 보조 LLM)
 │   VAD + ReazonSpeech int8 온디바이스  ├ thekaiwa-speech-worker (SpeechJob 큐)     └ Ollama
 └ 모델 다운로드 ← /models/…            ├ voicevault-whisper (:8090, 재사용)
                                        └ nginx: /, /ws/speech, /app/download, /models
NAS MariaDB(thekaiwa) ← Prisma / Python worker(콜백은 앱 /api/internal)
```
- 의존 방향: `app(+admin) → {preferences, conversation, learning, speech} → engine → infra`. conversation 과 speech 는 서로 import 하지 않고 라우트가 조합한다(기획안 §66 "Speech Engine 과 LLM 을 직접 연결하지 않는다").
- Admin Console → Admin API → Engine Management Service → Registry → Adapter → 엔진(기획안 §121). 사용자 API 와 분리.

## 4. 모듈·패키지 구조 (요약 — 정본 `design/module-dependency.md`)

```
src/modules/
├── admin/          # L0: console · configuration(editor·diff·versions·rollback·presets·export/import·overrides) · diagnostics · playground · audit · permissions
├── preferences/    # L1: voiceSetting · speechSetting · learningSetting(Profile) · appSetting
├── conversation/   # L2: orchestrator · persona · promptBuilder · promptRegistry · window · structuredResponse · chats · corrections · proposals · prompts/**
├── learning/       # L3: learnerProfile · attendance · studyLog · vocab · topics · lessons · reviewSchedule · evaluation · studyPlan · learningHistory · snapshots · knowledge
├── speech/         # L4: utterances · stt/{RealtimeSttClient, OnDeviceSherpaClient, WebSocketSttClient, modeResolver} · tts/{parameterResolver, sentenceSplit, cache, TtsPlayer} · voices/{registry, profiles, importJobs, preview} · pronunciation · analysis
├── engine/         # L5: registry/{descriptors, schemas, plugins} · connections · credentials · health · functionalTest · router · fallbackPolicy · configuration/{resolver, versions, overrides, validate, diff} · metrics · trace · adapters/{llm, stt, tts} · json
└── infra/          # L6: db · secrets · storage · jobs · runtime · config · audit · validation · logging · dates · native/bridge
speech/{common, gateway, worker, tts-service, models, test-assets}   # Python — common 이 L5/L6 개념을 미러
plugins/sherpa-stt/                                                    # Capacitor 플러그인(Kotlin)
```
규칙: 각 모듈은 `index.ts` 만 공개, 층별 소유 테이블만 쓰기, 엔진명은 `engine/adapters`·`speech/common`·seed 에만, ESLint `import/no-restricted-paths` 로 강제.

## 5. 인증·권한

- **웹**: Google OAuth → `POST /api/auth/complete`(초대코드) → httpOnly Secure 쿠키 `thekaiwa_session`(JWT, `jose` 검증, Edge 미들웨어 화이트리스트 `/`,`/login`,`/invite`).
- **앱**: Custom Tab `GET /api/auth/google?platform=app` → 콜백 → `thekaiwa://auth/callback?code=` → `GET /api/auth/app-exchange?code=`(64자 hex, 60초, 조건부 소각 1회) → 쿠키 → `/study/today`. JWT 를 딥링크에 싣지 않는다.
- **Role 4단계**: `USER / ADMIN / DEVELOPER / SUPER_ADMIN`(`OWNER_EMAIL` 시드 = SUPER_ADMIN). 검사는 role 이 아니라 **capability**(`can(user, 'config.edit')`, 정본 `role-permission.md`). 일반 API 는 소유자 검사(타인 404), `/api/admin/v1/*` 는 capability(403), 콘솔 라우트는 capability 없으면 404, `/api/internal/*` 는 `X-Internal-Secret`, WS 는 60초 티켓.
- **PRODUCTION 보호**: Engine/Model/Connection/Credential/Fallback 변경은 Validate→Functional Test→Change Summary→SUPER_ADMIN 확인→Apply. 임시 Override 는 `AppSetting override.production.enabled=false`.

## 6. 데이터 모델 (요약 — 정본 `design/domain-model.md`)

**층별 소유**: L0 admin `ConfigurationPreset·DebugSession` / L1 `Profile(학습 설정만)·UserVoiceSetting·UserSpeechSetting·AppSetting` / L2 `Chat·ChatMessage·Correction·TutorProposal·PromptTemplate·PromptVersion` / L3 `WordEntry·VocabSession·VocabAttempt·ConversationTopic·TopicChunk·Lesson·ReviewSchedule·StudyLog·Attendance·Evaluation·EvaluationItem·StudyPlan·StatsSnapshot·LearnerErrorStat` / L4 `Utterance·SpeechAnalysis·SpeechJob·TtsCache·VoiceProfile·VoiceModel·VoiceStyle·VoiceImportJob` / L5 `Engine·EngineConnection·EngineHealth·EngineFallbackPolicy·ConfigurationVersion·RuntimeOverride·RequestTrace·EngineMetricsDaily` / L6 `User·AppAuthCode·AiJob·AppRelease·AuditLog`.

**4대 규칙(스키마에 주석으로 박는다)**
1. **AI 제안 → 사용자 채택 후 저장**: `Correction`·`TutorProposal`·`StudyPlan` 은 `PROPOSED` 로만 생성되고 채택 시에만 `WordEntry`·`StudyLog(origin=ACCEPTED)`·프로필 변경이 생긴다. 사용자가 직접 수행한 결과(세트 완료·평가 제출·레슨 완료)는 `StudyLog(origin=DIRECT)` 로 즉시.
2. **삭제 정책**: 집계는 `StatsSnapshot`(생성·증가만) 에서만 읽고, 이력 행은 `*Snap` 컬럼으로 원본 삭제 후에도 읽힌다. 오디오 원본 보존 30일.
3. **원문 보존**: `Correction.original` 은 어떤 경로로도 UPDATE 하지 않는다.
4. **설정·Secret**: 설정 엔티티는 `environment` 컬럼, 프로세스는 `APP_ENV` 행만. Secret 은 `credentialRef` 만 저장.

**기획서 엔티티 대응**: User→`User+Profile`, WordEntry→`WordEntry`(+archived·chunkType·source·카운터), ConversationTopic→`+TopicChunk`(이름/액션/느낌/꾸밈), StudyLog→`StudyLog`(교정은 `Correction` 정규화, 집계는 스냅샷), Evaluation→`+EvaluationItem`. 추가: `VocabSession/Attempt`, `Lesson/ReviewSchedule`, `Chat/ChatMessage/Correction/TutorProposal`, `Attendance`, `StudyPlan`, `Utterance/SpeechAnalysis/SpeechJob/TtsCache`, Voice·Engine·Configuration·Trace·Prompt 계열.

## 7. 기능 설계 (메뉴 6개 + 설정 허브)

### 7-1. AI와 공부하기 — 회화(TALK) · 채팅(CHAT)
- **회화**: 푸시투토크 → 온디바이스 플러그인(또는 gateway) partial 자막 → `final` → `POST /api/v1/speech/utterances`(wav 업로드, 백그라운드) + `POST /api/v1/chats/:id/turns {utteranceId, text}` SSE → A1 구조화 응답(`conversation·correction·learning·speech.style·endOfTopic`) → `reply_ja` 문장 분할 → `POST /api/v1/speech/tts` → 1문장 재생 중 2문장 합성. 교정 카드는 원문 | 교정 나란히, 채택/무시. 사용자당 동시 턴 1(409), 12s fail-fast, 끊김 시 `GET /api/v1/chats/:id` 폴링(2.5s→5s).
- **채팅**: 텍스트 턴(A2, 교정 없음) → 대화 종료 후 `POST /api/v1/chats/:id/review`(A3, ≤20건 동기·초과 잡) → 문장별 교정 카드(`original` 바이트 일치 검증) → 채택 시 단어장 추가 시트 → 종료 시 `ADD_STUDY_LOG` 제안 카드.

### 7-2. 오늘의 단어 (`learning/vocab`)
- 풀 = `archived=false` − 오늘 DONE 세션 단어. `count = min(요청(기본 `dailyWordCount`), 풀)`, 풀 0 → 빈 상태 CTA, 풀 <4 → FLIP 강등. 가중치 `w = clamp(1 + 2·wrong − 0.5·correct, 0.25, 8) × recency(미노출 2.0 / 7일↑ 1.5 / 1~7일 1.0 / 24h 내 0.3)`, 가중 비복원 샘플링(seed 저장) → Fisher-Yates → CHOICE 보기 = 정답 + 같은 품사 오답 3. **정답은 응답에 싣지 않는다**(채점은 서버).
- **CHOICE(4지선다) 기본**, FLIP 옵션. 카드당 ≤12s × 10장 ≈ 2분 + 결과 30s → 3분 목표. 카드 앞면 표기+읽기 토글+TTS.
- attempt 즉시 저장(재진입) → `finish` 단일 트랜잭션(카운터·`lastSeenAt`·`StudyLog(WORDS,DIRECT)`·`StatsSnapshot(VOCAB_SESSION)`+DAILY). "생성 개수별 맞춘/틀린" = 스냅샷을 `cardCount` 별 그룹.
- 보관 두 층위: **세트 보관** `VocabSession.keptAt`(보관함 → 다시 풀기 `replay`) · 카드 표시 `VocabAttempt.flagged`(위 스와이프).
- bjj 덱 이식: 드래그 좌표 ref·탭 10px/위 −80/좌우 ±60 임계·3장 스택 transform·`touchend preventDefault`·`touchAction:none` 중앙 80%. 바꿈: 위=flag, 좌=답한 뒤에만 다음, 우=이전 카드 읽기 전용, 키보드 1~4.

### 7-3. 오늘의 회화 (Lesson) — 자체 생성 + 붙여넣기
- 주제(`ConversationTopic`+조각) 또는 사용자가 붙여넣은 자막 문장(`Lesson.sourceText`, 레퍼런스3 경로) → A4 가 5단계 수업(이해 dialogue → 문법 → 문제 quiz 5 → 응용 3 → 말하기 3) 생성(잡+폴링). 단계 진행은 `PATCH /lessons/:id/progress`, 완료는 트랜잭션(`StudyLog(LESSON,DIRECT)`+스냅샷+`ReviewSchedule` upsert).
- 외부 콘텐츠(흘려듣기 구간) 큐레이션은 제외, 대화문 TTS 반복 재생으로 대체(§16 권고 2).

### 7-4. 3일 반복 (`learning/reviewSchedule`) — 코드가 '언제·무엇', LLM 은 '어떻게 섞을지'만
- 학습일 = `Lesson(NEW, DONE)` 1건↑인 KST 날짜(달력일 아님). `R = StudyPlan.curriculum.reviewEvery ?? 3`.
```
1. due = ReviewSchedule(DUE) 있으면: R학습일 이상 미뤄졌으면 EXPIRED + 재료를 carryPool 로 승계, 아니면 {mode:'BOTH', review:due}
2. S = 마지막 복습 완료 이후 학습일; |S| < R → {mode:'NEW', guard:{reason:'cycle', needed:R-|S|}}
3. src = S 의 마지막 R일 NEW/DONE 레슨(날짜당 ≤2, 총 ≤6, 최신 우선) + carryPool ≤2
   최소 기록 가드: |src| < 2 또는 날짜 수 < 2 → {mode:'NEW', guard:{reason:'insufficient'}}
4. upsert ReviewSchedule(dueDate=오늘, sourceLessonIds=src) → {mode:'BOTH'}
재진입: 마지막 NEW 레슨 7일↑ 전이면 최근 R학습일 레슨으로 복습부터(reason:'stale'). complete(REVIEW)→DONE·리셋 / skip→SKIPPED(당일).
```
- `mixSpec`(코드): 재료 레슨의 chunks 타입별 라운드로빈 8 + grammar 3 + quiz 오답 ≤3 + 채택 교정 ≤3 → A5 가 "이 재료만으로" REVIEW 레슨. 후검증 `chunks ⊆ mixSpec` 실패 시 1회 재시도.

### 7-5. AI평가 (`learning/evaluation`)
- 난이도 = JLPT 5단계(N5 입문 ~ N1 고급, 기준 `tutor.md` §4). 기본 `Profile.level`, 같은 레벨 ≥90 두 번 연속 → `SET_LEVEL` 제안.
- 문항: WORDS 10(MEANING_CHOICE 4·READING_INPUT 2·USAGE_CHOICE 2·CHUNK_CLASSIFY 2, 전부 코드 채점) / TALK 6(LISTEN_RESPOND 2·ASSEMBLE 1(코드)·SITUATION_RESPOND 2·CORRECTION_SPOT 1, 서술형만 A7). 재료 단어장 ≥60%, 14일 중복 금지, 제한 10분. 말하기 문항은 **분석 STT(whisper) 텍스트** 사용.
- 루브릭 5차원 0~5(정확성·어휘·문법·자연스러움·조각 조립), 문항 0~10, `total = Σscore/Σmax×100`, 등급 ≥90/75/60. 발음·유창성 제외(발음은 SpeechAnalysis 별도).
- **기록률 100%**: submit 잡 마지막 = `$transaction(Evaluation DONE + StudyLog(EVALUATION,DIRECT) + StatsSnapshot(EVALUATION) + DAILY)`. 실패 시 GRADING 잔류·재시도.

### 7-6. 공부계획표 — 달력 · 분석 · 성장기록
- **출석**: `(app)/layout.tsx` 의 `AttendancePing` 이 하루 1회 `POST /api/v1/attendance/check-in`(멱등, `@@unique([userId,date])`, DAILY 스냅샷 `attended`).
- **달력**: `StudyLog`+`Attendance` 파생(`GET /api/v1/plan/calendar?month=`), 일 상세.
- **분석**: `POST /api/v1/plan/analysis {from,to}` → 코드가 입력 집계(출석·유형별 횟수·평가 추이·오류 유형 top5·오답 단어 top10·목표) → A8(opus, batch) → `StudyPlan(PROPOSED)` → 사용자 확인 → ACCEPTED(이전 ARCHIVED). 같은 `sourceRange.hash` 면 재생성 안 함. **Learning History**(§70): `LearnerErrorStat` 가 교정 채택·분석 완료 시 갱신되어 A8 입력·프롬프트 헤더에 쓰인다.
- **성장기록**: `GET /api/v1/plan/growth` 는 **`StatsSnapshot` 만** 읽는다(삭제 후 추이 불변). 평가 5차원 레이더·일별 활동·연속 출석·수준 이력.

### 7-7. 서랍장 · 무엇이든 물어보세요 · 설정 허브
- **서랍장**: 단어장 CRUD·보관·카테고리·검색·정렬(최근/오답/가나다), `drawer/corrections`(채택 교정 모음).
- **무엇이든 물어보세요**: `Chat(kind=ASK)` + 턴 라우트 재사용, 페르소나 전체 + 학습자 헤더(≤600자) + 최근 12개(bjj `buildWindow`), A9 응답 `answer_md` + 제안 카드(ADD_WORD·ADD_STUDY_LOG·ADD_TOPIC·SET_LEVEL). 3b 에서 MCP `propose_*` 로 전환.
- **설정 허브 `/settings`**(기획안 §72): 기본정보·목표·학습(수준·설명 언어·교정 빈도=strictness·설명 상세도) / **AI 선생님**(VoiceProfile 카드·스타일·속도·Pitch·Intonation·**▶ 현재 설정으로 미리듣기**(저장 전 draft)) / 음성 인식(자동·빠른 응답·높은 정확도·오프라인) / Advanced·Voice 관리·AI Engine Console 진입은 capability 있을 때만.

## 8. LLM / Conversation 플랫폼 (기획안 §65~§70)

- **구성**: Foundation LLM(Claude) + System Prompt + Teacher Persona(`tutor.md`, key `teacher-persona`) + Conversation Context(창) + Learner Profile(헤더) + Learning History(`LearnerErrorStat`) + Lesson Context + Japanese Knowledge Base(RAG 슬롯, home-m4 `/v1/kb` 후보). 파인튜닝 없음.
- **Conversation Orchestrator**(`conversation/orchestrator`, bjj `masterChat.js` 이식): 사용자 메시지·assistant `PENDING` 행 INSERT → `accepted` → PromptBuilder(페르소나 절 필터 + `[모드]` 헤더 + 학습자 헤더 + 창) → engine.router → `completeJson`(구조화 응답 검증, `correction.original` 바이트 일치 검증) → 저장 → `done`. 사용자당 동시 턴 1(메모리 락 + DB `PENDING`), 기동 시 `PENDING→FAILED`. Speech(STT/TTS) 는 라우트가 조합.
- **구조화 응답(§67)**: `{conversation:{replyJa,replyReading,replyKo}, correction:null|{required,original,corrected,explanationKo,errorType,severity,chunkType}, learning:{grammarPoint,difficulty}, speech:{style:NEUTRAL|ENCOURAGING|CALM|CHEERFUL}, endOfTopic}`. LLM 은 speaker/model/pitch/styleWeight 를 정하지 않는다(§68).
- **TTS Parameter 우선순위(§69)**: User Setting(AUTO 아닌 값) > VoiceProfile.defaults > Persona 힌트 > Conversation Context(복습=LEARNING 속도) > LLM `speech.style`.
- **Prompt Registry**: 파일(`conversation/prompts/**`, `tutor.md`) = `SOURCE_CODE` v0, `npm run prompts:sync` → `PromptVersion(SOURCE_CODE)`, Console 편집 = `CONSOLE` 버전, ACTIVE 가 런타임 우선.

| # | 지점 | 입력 | 출력 | 모델 | 상한 | 방식 |
|---|---|---|---|---|---|---|
| A1 | 회화 턴 | 페르소나 절 필터 ≤2,500 + `[모드] TALK` + 헤더 ≤300 + 최근 6개 ≤2,000 + 발화(**총 ≤3,000자**) | §67 전체(`replyJa` ≤2문장) | haiku | 12s fail-fast | SSE |
| A2 | 채팅 턴 | A1 + 교정 금지, 최근 12개 ≤6,000 | `conversation·learning·speech` | haiku | 20s | SSE |
| A3 | 표현 점검 | 페르소나 전체 + `[모드] REVIEW` + 메시지 전부(id, ≤40건·8,000자) | `items[{message_id,original,corrected,explanation_ko,error_type,severity,chunk_type}], summary_ko, strengths, focus` | sonnet | 90s | ≤20건 동기/잡, 1회 |
| A4 | 레슨 생성 | `[모드] LESSON` + 주제·조각 + level + 채택 교정 ≤5 + 이전 제목 / `sourceText` | `title, dialogue[6~10], chunks, grammar[≤3], quiz[5], application[3], speaking[3]` | sonnet | 120s | 잡 |
| A5 | 복습 혼합 | A4 스키마 + `mixSpec` | A4 동일, `chunks ⊆ mixSpec` 후검증 | sonnet | 120s | 잡 |
| A6 | 평가 출제 | `[모드] EVAL_GEN` + kind·level·topic + 단어 ≤15 + 14일 해시 | `items[{kind,prompt,expected,dims,chunk_type?,word_surface?}]` | sonnet | 60s | 잡 |
| A7 | 평가 채점 | `[모드] EVAL_GRADE` + 루브릭 + 서술형 문항·답 | `items[{order,score,feedback_ko}], rubric{5}, total, comment_ko, next_focus` | sonnet | 120s | 잡, DONE 단일 트랜잭션 |
| A8 | 분석→계획서 | `[모드] PLAN` + 코드 집계 ≤6,000자 | `analysis{strengths,weaknesses,level_estimate,evidence}, curriculum{reviewEvery,weeks[]}, rationale_ko` | opus | 300s | 잡(batch), hash 캐시 |
| A9 | 무엇이든 | 페르소나 전체 + `[모드] ASK` + 헤더 ≤600 + 최근 12개 ≤8,000 | `answer_md, proposals[]` | UserVoice… 아님 — Profile 기본 sonnet | 120s | SSE |
| A10 | 단어 보강 | surface | `reading, meaning_ko, part_of_speech, jlpt, example_ja, example_ko` | home-m4/haiku | 20s | 동기·캐시 |

- **페르소나 절 구조**(`tutor.md` v0, prompt-engineer 가 v1): 1 정체성 · 2 말투 · 3 교정 원칙 · 4 난이도 N5~N1 · 5 조각 프레임 · 6 모드별 출력 · 7 커리큘럼 규칙 · 8 하지 말 것 · 9 Claude Code 세션. 런타임 `persona.ts` 가 `## N.` 절 필터(A1 은 1·3·4·6).
- **5초 예산**: VAD endpoint 0.4~0.6 + 온디바이스 디코드 0.2~0.4 + 업로드/INSERT 0.1~0.2 + **Claude CLI 스폰+haiku 2.0~3.5** + 첫 문장 TTS 0.4~1.0(M4) + 재생 0.1 = 3.2~5.8s. 초과 시 ① 문장 단위 TTS 파이프라인 ② 프롬프트 다이어트 ③ TTS 캐시·ONNX ④ `--include-partial-messages` ⑤ 큐 동시성 2 ⑥ 응답/교정 2이벤트.

## 9. 음성 플랫폼 (기획안 §1~§24)

**원칙(§23)**: 단일 엔진 비종속 · 실시간/분석 분리 · ReazonSpeech=실시간 · faster-whisper=검증 · sherpa-onnx=오디오 런타임 · TTS 독립 서비스 · 전 엔진 플러그인 · 설정으로 엔진 선택 · STT≠발음평가 · Ensemble · 분석이 대화 지연을 늘리지 않음 · 상용 API 교체 가능.

**엔진 역할과 조사로 확인한 사실**
| 구성요소 | 역할 | 확인 내용 → 설계 영향 |
|---|---|---|
| sherpa-onnx | 오디오 런타임(VAD·endpoint·온디바이스 추론) | Android AAR/Kotlin·Python·WASM 모두 제공. 온디바이스 플러그인과 gateway 가 **같은 모델** |
| ReazonSpeech | 실시간 일본어 STT | `sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01` 은 **오프라인 zipformer**(int8 encoder ≈148MB, CPU RTF 0.054), 스트리밍 JA 모델 없음 → "실시간" = silero VAD 세그먼트 → 오프라인 디코드(5초 발화 ≈0.3s). 원 모델 Apache-2.0 |
| faster-whisper | 분석 STT(재검증·발음 참조 텍스트) | MIT. VoiceVault whisper-service(medium int8 CPU, `POST /transcribe-chunk`, :8090) 재사용, 정확도 부족 시 전용 인스턴스 |
| Style-Bert-VITS2 | AI 선생님 TTS(다중 Voice·스타일·속도·pitch·intonation) | AGPL-3.0(`text/user_dict` LGPL), CPU 추론, `server_fastapi.py`(`/voice`·`/models/info`·`/models/refresh`), 기본 100자 → 문장 분할. 맥 M4 별도 디렉토리·HTTP 경계로 격리 |
| Pronunciation Analyzer | 음소·모라·길이·피치 | narabas(MIT, wav2vec2 일본어 음소 강제정렬, pyopenjtalk 음소열) + pyopenjtalk(기대 모라·악센트) + pyworld F0 + CTC GOP → 長音·促音·撥音·모라 타이밍·피치 악센트·속도·포즈. 음성 Phase 3 |

**플로우**: 마이크 → (온디바이스) sherpa VAD → ReazonSpeech → partial/final → `Utterance` 저장 + `SpeechJob` enqueue → Conversation Orchestrator → LLM → 문장 분할 → tts-service → 재생. 비동기: worker → whisper → TranscriptComparator(NFKC·구두점 제거·かな 변환·편집거리 → `transcriptConfidence`, `<0.85` → `requiresReview` → 교정 카드에 2안 표시·사용자가 `finalText` 확정) → (P3) PronunciationAnalyzer → `SpeechAnalysis` → 단어별 ★5 + 한 줄 피드백(§16).

**온디바이스 플러그인 `@thekaiwa/sherpa-stt`**(`plugins/sherpa-stt/`, Capacitor 7, Kotlin): `checkModel()`·`downloadModel(url, sha256, onProgress)`·`start({vad:{silenceMs:500}, partial:true})`·`stop()`·`release()`, 이벤트 `vad`·`partial`·`final{text,durationMs,wavPath}`. `OfflineRecognizer`(int8, `num_threads` 2~4) + `Vad`(silero) + `AudioRecord` 16kHz 백그라운드 스레드. 모델은 APK 에 넣지 않고 `/models/reazonspeech-int8/manifest.json`(≈160MB, Wi-Fi 안내·재개, `filesDir/models/<version>/`). 웹 번들은 `window.Capacitor.Plugins.SherpaStt` 전역만 본다.

**클라이언트 라우팅**: `RealtimeSttClient` = 플러그인 존재+모델 설치 → `OnDeviceSherpaClient` / 그 외(웹·미설치·오류 2회) → `WebSocketSttClient`(gateway). 선택 결과는 `Utterance.realtimeEngine(reazon-ondevice|reazon-gateway)` 에 기록. Speech Mode(§9-B): AUTO/FAST/ACCURATE/OFFLINE.

**gateway 폴백 프로토콜**(`wss://kaiwa.…/ws/speech`, nginx Upgrade → 127.0.0.1:8100): 클라 `start{chatId,sampleRate:16000,ticket}` → binary PCM16 40ms → `stop`; 서버 `vad{state}`·`partial{segIdx,text}`·`final{utteranceId,text,engine,durationMs,segments}`·`error`; ping 15s; 인증 `POST /api/v1/speech/ticket`(60초 JWT). 끊김=오류 아님.

**TTS 모드(§10·§11)**: Native(1.0×) / Learning(0.6·0.8·1.0×, `length`) / 스타일(Teacher·Friendly·Casual·Formal·Cheerful) — Phase 1 기본 보이스+속도, Phase 4 스타일·감정·캐릭터. 같은 문장 "학습자용 → 자연 속도" 비교 듣기. 캐시 키 sha1(text|voiceId|style|styleWeight|speed|pitch|intonation|engineConnectionId|textVersion).

**서비스 구성(§18·§19 → 워크스페이스)**: 기획안의 Docker 분리는 사용자 결정으로 **우분투 pm2+venv**(gateway `thekaiwa-speech-gateway` :8100, worker `thekaiwa-speech-worker`), **M4 tts-service**(`~/kaiwa-tts-run`, :8200), Redis/Postgres 대신 **MariaDB `SpeechJob` 큐**. conversation-service/learning-analysis-service 는 Next.js 모듈. gateway/worker → 앱 콜백 `/api/internal/*`.

**라이선스(§20)**: ReazonSpeech Apache-2.0 · faster-whisper MIT · sherpa-onnx Apache-2.0 · narabas MIT · Style-Bert-VITS2 AGPL-3.0(별도 서비스 격리, 개인 이용 범위, 기본 모델 약관 확인).

**음성 Phase(§21) ↔ 앱 Phase**: P1(온디바이스+gateway ReazonSpeech·SBV2 기본 보이스·Learning 속도) = 앱 1 / P2(whisper 재분석·Ensemble·confidence·발화 로그) = 앱 2 / P3(Pronunciation Analyzer) = 앱 3 / P4(고급 TTS 스타일·감정·캐릭터·조건 라우팅 확장·Voice Package Import) = 앱 3 이후.

**실측 게이트(P0, task-003)**: ① S25+ 온디바이스 5초 발화 디코드 ≤0.8s·RSS ≤600MB ② gateway 동일 + WebView getUserMedia→WS ③ M4 SBV2 20자 1문장 ≤1.0s ④ 인식률 20문장 ≥16(양 경로) ⑤ 모델 160MB 다운로드·재개 ⑥ 우분투 메모리. 미달 시 순서대로 튜닝(`endpoint_silence_ms`·fp32/빔·ONNX TTS·캐시), 그래도 안 되면 목표 재정의는 사용자 결정.

**구현 순서(§24)**: Speech Engine Interface → ReazonSpeech Adapter(온디바이스·gateway) → whisper Adapter → TTS Adapter → Router → `Utterance` 모델 → Realtime/Async 분리 → `SpeechJob` 파이프라인 → Comparator → `SpeechAnalysis` → Orchestrator 연결 → 플러그인/WS 프로토콜 (task-003·007·012b).

## 9-B. Voice·Engine 관리 플랫폼 (기획안 §25~§77) — 세부: `design/speech-platform/`

**충돌 검토·해소**
| # | 기존 | 기획안 | 해소 |
|---|---|---|---|
| 1 | `speech.config.yml` 로 엔진 선택 | Engine Registry + Connection Profile 데이터·관리 UI·연결 테스트 | Descriptor+Schema 는 코드(어댑터 `descriptor()`/`configurationSchema()`), Connection·Fallback·Health 는 DB. yaml 은 8층 해석의 `APPLICATION_CONFIG` 층 |
| 2 | `Profile` 에 음성 컬럼 | 사용자 설정 = AI 선생님/음성 인식/학습/Advanced(관리자) | `UserVoiceSetting`·`UserSpeechSetting` 분리, `Profile` 은 학습 설정만(+`explainDepth`). Advanced 는 capability |
| 3 | A1 평면 스키마 | §67 구조화 응답 + §68 LLM 은 의미적 스타일만 + §69 우선순위 | 스키마 통일, `speech.style` 은 Resolver 5순위 |
| 4 | 기본 보이스 1개 | Voice Registry·다중 Profile·Package Import·Preview·수명주기 | Phase 1 `VoiceProfile` 시드 2~3 + 통합 미리듣기, Import·삭제 수명주기는 Phase 4 |
| 5 | `tutor/turn.ts` | §66 Orchestrator, §76 6층 | 디렉토리를 6층으로 재편(§4) |
| 6 | env 로 LLM 라우팅 | Advanced 에 LLM Engine/Connection/Test | LLM 도 Engine Registry(`type=LLM`) |
| 7 | 캐시 키 4요소 | pitch·intonation·previewTextVersion | 캐시 키 9요소, Preview 도 같은 캐시 |
| 8 | 플러그인 설정 상수 | §53 sherpa 런타임 설정도 Connection Profile | `connectionType=ONDEVICE` Connection, 앱은 `GET /api/v1/speech/config` 로 수신 |

**도메인 객체(§73) → 모듈·테이블**: EngineDescriptor/Schema/Provider → `engine/registry`(코드) · EngineRegistry → `engine/registry/index`(코드+DB `Engine` 스냅샷) · ConnectionProfile/CredentialRef/HealthStatus/FallbackPolicy → `engine/{connections,credentials,health,fallbackPolicy}` + `EngineConnection·EngineHealth·EngineFallbackPolicy` · EngineRouter → `engine/router` · VoiceProfile/Registry/Package/ImportJob/Preview → `speech/voices` + M4 `tts-service/admin` + `VoiceProfile·VoiceModel·VoiceStyle·VoiceImportJob` · TTSParameterResolver → `speech/tts/parameterResolver` · SpeechModeResolver → `speech/stt/modeResolver` · UserVoice/SpeechSetting → `preferences` · SecretResolver → `infra/secrets`(`env:NAME` / `file:<name>` → `apps/thekaiwa/shared/secrets/`).

**Resolver·Router 규칙**: TTS Parameter = User(non-AUTO) > VoiceProfile.defaults > Persona > Context > LLM style → SBV2 파라미터(`model_id, speaker_id, style, style_weight, length=1/speed, pitch_scale, intonation_scale`). Speech Mode: AUTO=라우터(온디바이스 우선) / FAST=온디바이스 고정 / ACCURATE=gateway + 분석 STT 재확인(임계 0.9) / OFFLINE=온디바이스만. Engine Router: 역할별 `EngineFallbackPolicy` 순회, `UNAVAILABLE·DISABLED·MISCONFIGURED` 제외, 1회 재시도, 실제 connection 을 `Utterance`/`RequestTrace` 에 기록, 헬스 5분 주기.

**Voice**: `VoiceProfile{id, displayName, description, ttsEngineId, voiceModelId, speaker, defaults{style,styleWeight,speed,pitch,intonation}, previewPath, status, enabled}` — 사용자에겐 Model/Speaker 비노출. Package(zip: manifest.json + model/{config.json,model.safetensors,style_vectors.npy} + preview/) → 앱 admin API → M4 `POST /admin/voices/import`(검증→`model_assets`→`/models/refresh`→`/models/info`→TTS 테스트→등록). 상태 IMPORTING→VALIDATING→AVAILABLE→DISABLED→ARCHIVED, DISABLED 시 사용자 기본 voice 전환. Preview: draft 설정 → `POST /api/v1/voices/preview`, 텍스트 `AppSetting voice.preview.defaultText`, LLM 호출 없음.

**API 추가**(정본 `api-contract.md`): `GET /api/v1/voices`, `POST /api/v1/voices/preview`, `GET/PUT /api/v1/settings/{profile,voice,speech}`, `GET /api/v1/speech/config`; `/api/admin/v1/voices*`(create/import·update·activate·disable·delete·sync·import-jobs), `engines`, `engine-connections*`(+health·test·log-level), `fallback-policies/{role}`, `secrets`(ref 만); M4 `POST /synthesize`·`GET /voices`·`POST /admin/voices/import`·`POST /admin/models/refresh`·`GET /health`.

**설정 UI(§72)**: §7-7 설정 허브. 일반 사용자 화면에 엔진명 노출 금지. Advanced 는 Engine+Connection 선택·Schema 동적 폼·Health/Functional 테스트.

**Phase**: 앱 1 = Engine 디스크립터+seed connection 6(`claude-cli-local`·`home-m4-lan`·`reazon-ondevice`·`reazon-gateway`·`whisper-voicevault`·`style-bert-m4`)·Router·Fallback(온디바이스→gateway)·VoiceProfile 시드·UserVoice/SpeechSetting·통합 미리듣기·speech/config·Advanced 읽기+테스트 / 2 = Advanced 편집·Health 스케줄·Fallback 편집·Learning History / 4 = Voice Package Import·수명주기·다중 학습 보이스.

**§77 문서**: `speech-platform/00-conflict-review-and-domain-model.md` · 01 voice-profile-entity · 02 voice-registry-api · 03 voice-import-delete-api · 04 voice-preview-api · 05 engine-registry-entity · 06 engine-connection-profile-entity · 07 engine-configuration-schemas · 08 credential-secret-management · 09 engine-health-api · 10 engine-functional-test-api · 11 speech-engine-router · 12 engine-fallback-policy · 13 user-speech-setting-entity · 14 admin-speech-settings-ui · 15 voice-management-admin-ui.

## 9-C. Admin / Developer AI Engine Console (기획안 §78~§128) — 세부: `design/admin-console/`

**충돌 검토·해소**
| # | 기존 | 기획안 | 해소 |
|---|---|---|---|
| 1 | Role 2단계(OWNER/MEMBER) | USER/ADMIN/DEVELOPER/SUPER_ADMIN | 4단계 + capability 매트릭스(`role-permission.md`), `OWNER_EMAIL`=SUPER_ADMIN |
| 2 | yaml=seed 전용 | Configuration Registry·Resolver·8층 Source·Effective Configuration | yaml 을 `APPLICATION_CONFIG` 층으로 승격. **DEFAULT → SOURCE_CODE → APPLICATION_CONFIG → ENVIRONMENT → DATABASE → CONNECTION_PROFILE → USER_SETTING → RUNTIME_OVERRIDE**, 키마다 `{value, source, sourceRef, editability}` |
| 3 | 프롬프트 = 코드 파일 | Prompt Registry·Versioning·Test | 파일 = `SOURCE_CODE` v0, DB `PromptVersion` ACTIVE 우선, `prompts:sync` |
| 4 | 개발·운영 같은 DB | Environment 분리·Production 보호 | `environment` 컬럼 + `APP_ENV`, LOCAL/PRODUCTION 사용, SUPER_ADMIN 확인 게이트, Production Override 비활성 |
| 5 | `ChatMessage.toolLog` | Request Trace·Diagnostics | `RequestTrace` 신설, `toolLog{traceId,…}`, 원음·전체 대화 미저장(§113) |
| 6 | Health 최근 N건 | Diagnostics 메트릭·Log level | `EngineMetricsDaily`(Trace 집계), 서비스 `/health` 메모리, `logLevel` RUNTIME_EDITABLE + `/admin/log-level` |
| 7 | 6층 | §122 backend 모듈 | `src/modules/admin`(L0 조합) 신설, §122 매핑은 `admin-console/00` |

**Configuration 모델**: `ConfigurationSchema`(코드: key·type·default·min/max/enum·description·impact·editability(READ_ONLY|RUNTIME_EDITABLE|RESTART_REQUIRED|REDEPLOY_REQUIRED|SECRET)·restartRequired) · `ConfigurationVersion`(environment·scope·targetId·version·snapshot·diff·actor·reason·status ACTIVE|SUPERSEDED|ROLLED_BACK; Rollback 도 새 버전) · `AuditLog` · `RuntimeOverride`(TEMPORARY ttl / SESSION) · `ConfigurationPreset` · Export/Import(Secret → `credentialRef`) · `PromptTemplate`/`PromptVersion` · `RequestTrace`(steps·latency·connection·model·status, `X-Trace-Id` 전파) · `DebugSession` · `EngineMetricsDaily`.

**Admin API**(`/api/admin/v1/`, capability): overview · config/effective · config/schema/:engineId · config/validate · config/test · config/diff · config/apply · config/versions(+`/:id/rollback`) · config/raw/:scope/:targetId · config/export|import · presets · overrides · plugins · engine-connections/:id/log-level · diagnostics/:connectionId · playground/stt|tts|llm · playground/e2e · traces · debug-sessions · prompts(+versions·activate·test) · audit · environment. Python 서비스 공통: `GET /health`·`POST /admin/log-level`·`POST /admin/config/apply`·`GET /admin/config/effective`.

**Console IA(§80·§123)**: `(admin)/admin/{dashboard, speech/{realtime,analysis,tts}, llm, voices, plugins, connections, configuration, prompts, diagnostics, playground, history}` — 별도 레이아웃(추후 독립 Admin Web 분리 가능), Environment 배지, capability 없으면 404.

**Phase**: 앱 1 = Role·capability·Console 골격(Dashboard·Effective Config 읽기+Source·Plugins·Connections·Health/Test·Trace 저장·History 읽기) / 2 = Form·JSON 편집·Validate/Test/Diff/Apply·Version·Rollback·Prompt Registry·Playground / 3 = E2E·Diagnostics·Debug session·Log level / 4 = Preset·Export/Import·Override·Voice Preview Playground·Admin Web 분리.

**§128 문서**: `admin-console/00-integration-review.md` · 01 console-information-architecture · 02 role-permission-model · 03 engine-configuration-schema · 04 effective-configuration-resolver · 05 configuration-source-priority · 06 configuration-version-entity · 07 configuration-audit-entity · 08 configuration-diff-api · 09 configuration-rollback-api · 10 raw-json-configuration-api · 11 engine-playground-api · 12 end-to-end-test-api · 13 request-trace-model · 14 prompt-registry-versioning · 15 developer-diagnostic-api · 16 environment-configuration-policy.

## 10. API (요약 — 정본 `design/api-contract.md`)

- 응답 `{success, data, message}`. 무버전: `/api/health`(공개, boolean checks 만), `/api/auth/*`, `/api/app/version`, `/models/*`. 사용자 `/api/v1/*`(소유자 검사 → 타인 404), 관리자 `/api/admin/v1/*`(capability → 403), 서비스 콜백 `/api/internal/*`(`X-Internal-Secret`), `wss /ws/speech`, SSE `POST /api/v1/chats/:id/turns`.
- 오류: 400 VALIDATION · 401 UNAUTHENTICATED · 403 FORBIDDEN · 404 NOT_FOUND · 409 CONFLICT · 422 ENGINE_UNAVAILABLE · 429 RATE_LIMITED · 502 ENGINE_ERROR · 504 ENGINE_TIMEOUT.
- Phase 0: health·auth 6종·app/version·models. Phase 1: settings·voices·speech(ticket·utterances·tts·config)·attendance·chats·turns·review·corrections·proposals·words·vocab·jobs + admin 골격. Phase 2: topics·lessons·reviews·evaluations·plan/calendar·study-logs + admin 편집·versions. Phase 3: plan/analysis·growth·drawer·ASK + playground/e2e·diagnostics. Phase 4: presets·export/import·overrides·voices import.

## 11. 화면 구성

| 탭 | 경로 | 기획서 메뉴 | Phase |
|---|---|---|---|
| 회화 | `/study/ai` → `talk/[chatId]`, `chat/[chatId]`, `chat/[chatId]/review` | 1. AI와 공부하기 | 1 |
| 오늘 | `/study/today` → `words/[sessionId]`(+result), `talk/[lessonId]`, `eval/[evaluationId]`(+result) | 2. 오늘의 공부 | 1 / 2 |
| 계획표 | `/plan` → `calendar` · `analysis` · `growth` | 3. 공부계획표 | 2 / 3 |
| 서랍장 | `/drawer/words`(+`[wordId]`), `/drawer/corrections` | 4. 서랍장 | 1(최소) / 3 |
| 질문 | `/ask`, `/ask/[chatId]` (Phase 3 전 "준비 중") | 6. 무엇이든 물어보세요 | 3 |
| 상단 아바타 | `/settings`(기본정보·목표·학습 / AI 선생님+미리듣기 / 음성 인식 / Advanced·Voice 관리·Console 진입은 capability) | 5. 프로필 | 1 |
| 콘솔 | `(admin)/admin/*` 별도 레이아웃 | 기획안 §80 | 1(읽기) / 2~4 |

모바일 원칙: 412×892 기준·앱 WebView ≈390px → 360/390/412 검증, `100dvh`, 터치 44px(푸시투토크 ≥64px), 일본어 16px↑·후리가나 토글, 화면당 스크롤 1곳, 음성 우선 입력 + 텍스트 폴백 상시. 사용자 화면에 엔진명·model_id·speaker_id 0건.

## 12. 안드로이드 앱 · APK 갱신

- `capacitor.config.ts`: `appId com.miraclepenguin.kaiwa`, `server.url https://kaiwa.xn--lh0b87pnudm10a4vd.com`, `androidScheme https`, `cleartext false`, `errorPath`, `adjustMarginsForEdgeToEdge:'auto'`, `webDir public/app-shell`. Manifest: 딥링크 intent-filter·`singleTask`·`RECORD_AUDIO`. `MainActivity.onPause` 쿠키 flush. 앱/웹 분기는 로그인·실시간 STT 경로·APK 배너 세 곳.
- **APK 갱신 운영**: 네이티브 변경 판정(`plugins/**`·`android/**`·`capacitor.config.ts`·Manifest·플러그인 버전) → developer 가 착수 전 고지 + `versionCode` 증가 → deployer `scripts/build-apk.sh`(우분투 JDK 21) → sha256 → `DATA_ROOT/releases/thekaiwa-<ver>.apk` + nginx `/app/download/latest.apk` → `AppRelease` 행 → `GET /api/app/version {latest, latestCode, minSupported, url, notes, reinstallRequired}` → 앱 배너("새 버전 v1.2 — 다운로드"). 웹만 바뀐 배포는 배너 없음. 디버그 키스토어 백업 필수.

## 13. 인프라·운영

| 구성 | 값 |
|---|---|
| 우분투(125.177.194.26, ssh 993) | pm2 blue/green `/home/brownjeon/apps/thekaiwa/releases/*` — `thekaiwa`(:3010) · `thekaiwa-speech-gateway`(127.0.0.1:8100) · `thekaiwa-speech-worker`; venv `~/.node-local/thekaiwa-speech/venv`; `voicevault-whisper` :8090 재사용; nginx vhost `/`·`/ws/speech`(Upgrade)·`/app/download`·`/models`; `shared/{.env,secrets/}` |
| 맥 M4(192.168.219.100) | `~/kaiwa-tts-run`(venv+uvicorn :8200, 크론 와치독, `git push` 웹훅 — 사용자 승인 게이트); `home-m4-api` :8000 보조 |
| 배포 | `scripts/deploy.sh TheKaiwa`(release.sh) = push 후 `origin` ref 기준. `--with-migrate` 사용자 승인. `docs/deploy-order.md` 정본(Phase 0) |
| 큐·잡 | MariaDB `SpeechJob`/`AiJob`, worker 폴링, 기동 시 RUNNING→FAILED 정리 |
| 헬스 | `/api/health` checks(env_database·env_jwt·env_google_oauth·claude_cli·speech_gateway·tts_service·whisper_service) boolean, gateway/tts `/health`(모델 로드·메모리·버전) |
| 데이터 | `DATA_ROOT/users/<id>/utterances/YYYY-MM/*.wav`(30일), `tts-cache/`, `releases/*.apk`, `speech/models/`(미커밋) |

## 14. 환경 변수 · 시크릿

`.env.example` 그룹: APP_ENV·PORT·DATA_ROOT / DATABASE_URL / JWT_*·SIGNUP_INVITE_CODE·OWNER_* / GOOGLE_*·OAUTH_CALLBACK_BASE·APP_DEEP_LINK_SCHEME / CLAUDE_CLI_PATH·CLAUDE_CLI_CONCURRENCY·AI_API_BASE·AI_API_KEY_REF·AI_API_MODEL / SPEECH_GATEWAY_URL·SPEECH_INTERNAL_SECRET·SPEECH_CONFIG_PATH·TTS_SERVICE_URL·WHISPER_SERVICE_URL·SECRETS_DIR / APK_DOWNLOAD_BASE. 외부 API Key 는 `credentialRef`(`env:NAME`·`file:<name>`)로만 참조, DB·앱·Export·Trace·로그에 값 없음. env 는 8층 해석의 `ENVIRONMENT` 층(`KAIWA_<ROLE>_<KEY>` 관례, 정본 `configuration-resolution.md`).

## 15. Phase 로드맵 (Agent Vault task 단위)

루프: leader → designer(UI) → prompt-engineer(AI 지점) → developer → reviewer → qa → deployer → leader. 기획서 대비 조정: 서랍장 최소판·출석 API 를 Phase 1 로 당김, 발음 분석을 Phase 3 로 편입, Console 골격을 Phase 1 로.

| task | 제목 | 핵심 완료 기준 | 의존 |
|---|---|---|---|
| 001 | 초기 기획·설계 확정 | ✅ 이 문서 + 정본·설계 문서 | — |
| 002 | Phase 0 스캐폴딩 | 폰 https 로그인→5탭, 3폭 잘림 0, health 200, Permissions-Policy 검사, 6층 골격+ESLint, Prisma 정본+seed(Engine·connection 6·VoiceProfile·AppSetting), api-contract Phase 0 라우트 일치 | 001 + 사용자 선결 |
| 003 | 온디바이스 STT 플러그인 + 음성 서비스 P0 + Capacitor 셸 | APK 로그인 유지, 온디바이스 20문장 partial/final, 모델 다운로드→재사용, gateway 폴백 동일, SBV2 1문장 합성·재생, **실측 게이트 6항목** → `decisions/speech-p0-measurements.md`, deployer APK | 002 |
| 004 | AI 클라이언트 계층 + 강사 페르소나 v1 | engine adapters(claudeCli·homeM4)·router·resolver 최소, `tutor.md` v1, prompts{talk,chat,chatReview}+픽스처 20문장, A1 p50 ≤4s, json-schema+agents 동시 동작, qwen 비교 | 002 |
| 005 | 설정 허브 + 출석 | AI 선생님(VoiceProfile·통합 미리듣기 draft)·음성 인식 4모드·학습, settings API 3종, voices/preview 캐시, 하루 2회 열어도 출석 1행, 화면 엔진명 0 | 002, 003 |
| 005b | Admin Console 골격 | capability 가드(USER `/admin` 404), Dashboard, Effective Config+Source(env 덮어쓴 키 `ENVIRONMENT`), Plugins·Connections·Health/Test→`RequestTrace`·`EngineHealth`, History 읽기, Secret 미노출 | 002, 003 |
| 006 | AI 채팅 + 표현 점검 + 교정 채택 | SSE 턴·락·폴링, `original` 바이트 일치, 채택 전 행 0, IDOR 404, 이모지 500 없음 | 004, 005 |
| 007 | AI 회화(음성) 실시간 교정 | `RealtimeSttClient` 라우팅·`TtsPlayer`·5구간 계측, 실기기 30턴 p50 ≤5s, 원문 무수정, 권한 거부 안내, 웹 gateway 동작 | 003, 006 |
| 008 | 단어장 최소판 + 오늘의 단어 | CRUD·보관·카테고리, 세트 생성(정답 미노출)·CHOICE·finish 트랜잭션, 10장 3분, 삭제 후 집계 불변, 풀<4 FLIP | 002, 005 |
| 009 | Phase 1 통합 QA·라이브·APK | nginx·Gitea·webhook·첫 blue/green, 운영 e2e(회화·채팅·단어), `RELEASE_RESULT ok`, 롤백 리허설, APK 배포본·배너 | 006, 007, 008 |
| 010~012 | Phase 2: 주제·조각·오늘의 회화·3일 반복 / AI평가 / 달력 | 3일 가드·만료 승계·stale, 기록률 100% 트랜잭션, 첫 평가 20건 루브릭 조정 라운드 | 009 |
| 012b | 음성 P2 | worker+`SpeechJob`·WhisperEngine·Comparator·requiresReview 카드·발화 로그 | 009 |
| 012c | Console P2 | Form/JSON 편집·Validate/Test/Diff/Apply·Version·History·Rollback·Prompt Registry sync/activate/test·Playground | 005b |
| 013~015 | Phase 3: 분석·성장기록 / 서랍장 전체 / 무엇이든(3a→3b MCP) | 성장기록=스냅샷만, 분석 hash 캐시, ASK 제안 카드 | 012 |
| 015b | 음성 P3 | PronunciationAnalyzer(narabas+pyopenjtalk+F0), 단어별 ★ 피드백 | 012b |
| 015c | Console P3 | E2E·Diagnostics·Debug session·Log level | 012c |
| 016 | Phase 4 | Voice Package Import·수명주기·스타일·감정 / Preset·Export/Import·Override / Admin Web 분리 검토 | 015* |

병렬: 003·004·005·005b 는 002 직후 동시(파일 경계 분리). 006·008 독립.

## 16. 범위 밖 · 리스크 · 미결 권고

**미결 질문(기획서 3건)**
1. **'전화1번' 원어민 통화**: 자체 구현하지 않는다. AI평가 데이터가 쌓이고 만족도가 낮을 때 외부 서비스 연동만 검토. 스키마 흔적 없음.
2. **오늘의 회화 콘텐츠**: 자체 생성(A4) + 사용자 붙여넣기(`Lesson.sourceText`). 외부 콘텐츠 큐레이션은 저작권·수급 문제로 제외, 확장 여지만.
3. **AI평가 채점 기준**: §7-5 초안 채택, Phase 2 첫 20건 사용자 검토 라운드.

| 리스크 | 조치 |
|---|---|
| Claude CLI 스폰 지연이 5초 잠식 | task-004 실측 게이트, 프롬프트 3,000자·절 필터·2문장, 6단계 완화 순서 |
| ReazonSpeech 인식률·VAD endpoint·SBV2 합성 시간 | task-003 실측 게이트 6항목, 튜닝 순서, 최후 목표 재정의는 사용자 |
| Claude 구독 공유 rate limit | 회화 haiku 고정, 분석·레슨 batch 레인, 동시 턴 1, `toolLog.model` 집계 |
| 3일 반복이 기록 부족 시 무의미 | 최소 기록 가드·만료 승계·7일 재진입, 해석을 문서에 고정 |
| 강사가 기록을 임의 변경 | `PROPOSED` 전용 스키마, QA 행 수 대조 |
| SBV2 AGPL·모델 약관 | M4 별도 디렉토리·HTTP 경계·`LICENSE-NOTICE.md`, 개인 이용 |
| 휴대폰 온디바이스 부담(148MB·RSS·배터리) | Wi-Fi 다운로드·재개, `num_threads` 실측, 오류 2회 gateway 폴백, `sttMode=GATEWAY` |
| 네이티브 변경 시 재설치 누락 | deployer `<apk_release>` + `/api/app/version` 배너 + `reinstall_required` |
| 개발·운영 같은 DB 에서 설정 혼선 | `environment` 컬럼·`APP_ENV`, Production 보호, Override 비활성 |
| Secret 유출 | `credentialRef` 만, Export/Trace/로그 마스킹, reviewer 체크 |
| `microphone=()` 헤더 복사 사고 | task-002 `curl -I` 검사 |
| SSE 백그라운드 끊김 | 끊김=오류 아님, 폴링, `visibilitychange` 재조회 |
| NFS noexec·SIGPIPE | `sync-local.sh`·`.npmrc`, 빌드 출력 파이프 금지 |

## 17. 팀 구성

| 역할 | 모델 | 담당 파일 경계 |
|---|---|---|
| leader | Opus | `CLAUDE.md`·`docs/**`(screens.md 제외)·정본·인프라 초안·`agent-vault/**` |
| designer | Opus | `docs/screens.md`·목업·`docs/demo/` |
| developer | Opus | `src/**`(prompts 제외)·`prisma/**`·`speech/**`·`plugins/**`·`android/**` |
| prompt-engineer | Sonnet | `src/modules/conversation/prompts/**`·`.claude/agents/tutor.md`·`tests/prompts/**` |
| reviewer | Sonnet | Read 전용 |
| qa | Haiku | `tests/**`(prompts 제외)·`e2e/**` |
| deployer | Haiku | task `## 배포 기록`·`20-Log`·`OPS-QUEUE` + APK 릴리스 |
| tutor(런타임) | Sonnet | `.claude/agents/tutor.md`(key `teacher-persona`), 앱이 `--agents` 로 로드 |

## 18. 데이터 정책

- **운영 데이터 ≠ 학습 데이터(§71)**: 사용자 대화·음성은 모델 학습에 자동 사용하지 않는다. `Utterance.trainingOptIn` 기본 false, 사용 시 허가→익명화→품질 검증→Dataset 등록 절차(현 단계 미구현).
- **보존**: 오디오 원본 30일(사용자 삭제 시 즉시 삭제), 분석 결과·텍스트 영구, `RequestTrace` 90일, `AuditLog`·`ConfigurationVersion` 영구.
- **삭제**: 사용자 삭제 기능은 `users/<id>/` 파일 트리 정리를 함께 넣는다(TheMeal 교훈). 집계 스냅샷은 삭제 경로에서 불변.
- **로그**: 원음·전체 대화·API Key·토큰은 일반 로그 금지, `DebugSession` 에서만 제한 수집(§113). Production 은 TRACE 레벨 제한.
- **테스트 데이터**: 베타 더미 User·StudyLog·Evaluation 은 정식 사용 전 전량 삭제(기획서 검증 절).
