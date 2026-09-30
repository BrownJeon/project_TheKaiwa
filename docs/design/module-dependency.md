# TheKaiwa 모듈·패키지 구조와 의존 규칙 (정본)

> 상태: 설계 문서(코드 없음) · 작성 2026-09-26 · 근거: 통합 기획서(`docs/design-spec.md` §4·§9·§9-B·§9-C), 추가 기획안 §76(6층 플랫폼)·§73(도메인 객체), 관리자 콘솔 기획안 §121·§122·§127.

## 0. 목적·정본 관계

이 문서는 **TheKaiwa 저장소의 디렉토리 구조, 모듈 경계, import 방향, Python 서비스·네이티브 플러그인과의 대응**을 정하는 단일 출처다. 구현(task-002 이후)은 이 문서의 트리·행렬·공개 API 목록을 그대로 따르며, 구조를 바꾸려면 이 문서를 먼저 고친다.

정본 분담(중복 정의 금지):

| 주제 | 정본 | 이 문서에서의 취급 |
|---|---|---|
| DB 엔티티·Prisma 스키마·층별 소유·상태 전이 | [`domain-model.md`](domain-model.md) | 모듈별 **소유 테이블 이름만** 나열 |
| API 엔드포인트·요청/응답 JSON·오류 코드·권한 | [`api-contract.md`](api-contract.md) | 시퀀스에서 **경로 이름만** 인용 |
| 8층 설정 소스 우선순위·Effective Configuration | [`configuration-resolution.md`](configuration-resolution.md) | Python `speech/common` 이 같은 규칙을 어떻게 미러링하는지만 |
| Role 4단계 × capability 매트릭스 | [`role-permission.md`](role-permission.md) | `admin.permissions` 모듈이 이를 데이터로 읽는다는 사실만 |
| Voice·Engine 관리 상세(§77 15종) | [`speech-platform/00~15`](speech-platform/) | 모듈 경계에서 참조 |
| Admin Console 상세(§128 16종) | [`admin-console/00~16`](admin-console/) | `modules/admin` 경계에서 참조 |

이름 규칙: 모듈·파일·식별자는 영어(camelCase/PascalCase), 설명은 한국어. 엔티티명은 `domain-model.md` 의 Prisma 모델명과 문자 단위로 같아야 한다(교차 검증 grep 대상).

---

## 1. 전체 디렉토리 트리

```
TheKaiwa/
├── .claude/
│   ├── settings.json                      # Agent Vault 훅 4종(상대경로) + permissions
│   └── agents/{leader,designer,developer,prompt-engineer,reviewer,qa,deployer,tutor}.md
│                                          # tutor.md = 런타임 페르소나(SOURCE_CODE 층 v0, key `teacher-persona`)
├── agent-vault/{00-Context,10-Flow,20-Log,30-Knowledge}/
├── docs/
│   ├── design-spec.md                     # 통합 기획서(§0~§18)
│   ├── 기획서-원본.md · 음성처리-기획안-원본.md · 음성처리-추가기획안-원본.md · 관리자콘솔-기획안-원본.md
│   ├── design/
│   │   ├── domain-model.md · api-contract.md · module-dependency.md(이 문서)
│   │   ├── configuration-resolution.md · role-permission.md
│   │   ├── speech-platform/00~15-*.md
│   │   └── admin-console/00~16-*.md
│   ├── screens.md(designer) · demo/ · nginx/ · deploy-order.md
├── prisma/
│   ├── schema.prisma                      # 정본은 domain-model.md 의 Prisma 블록(실물은 task-002)
│   ├── seed.ts
│   └── seed-data/{topics.json, words-n5.json, voices.json, engines.json}
│                                          # engines.json = Engine 디스크립터 스냅샷 + seed EngineConnection 6종
├── public/{manifest.webmanifest, icons/, app-shell/index.html}
├── android/                               # Capacitor 7 Android 프로젝트(루트 배치, VoiceVault 방식)
│   └── app/src/main/java/com/miraclepenguin/kaiwa/MainActivity.java   # onPause 쿠키 flush
├── plugins/
│   └── sherpa-stt/                        # @thekaiwa/sherpa-stt — Capacitor 7 플러그인(Kotlin + sherpa-onnx AAR)  → §6
├── speech/                                # Python 서비스(우분투 pm2+venv / M4 tts-service)              → §5
│   ├── README.md · speech.config.yml      # APPLICATION_CONFIG 층(3순위) 예시
│   ├── common/                            # gateway·worker 공용 패키지: engine/{descriptor,schema,interfaces,adapters/{stt,tts}}, router, config, secrets, health
│   ├── gateway/                           # FastAPI+websockets :8100 — WS 실시간 폴백 STT · 앱 콜백 · (Phase 4) TTS 프록시 슬롯
│   ├── worker/                            # SpeechJob 폴링 — 분석 STT · TranscriptComparator · PronunciationAnalyzer(Phase 3)
│   ├── tts-service/                       # M4 ~/kaiwa-tts-run — Style-Bert-VITS2 래퍼(AGPL 경계, common 을 import 하지 않음)
│   ├── models/README.md                   # /models/* 서빙 manifest 규약(모델 파일 미커밋)
│   └── test-assets/README.md              # ja-sample.wav(Functional Test 고정 오디오) 규약
├── scripts/{sync-local.sh, build-apk.sh, release.sh}
├── capacitor.config.ts · ecosystem.config.js · deploy.yml · .devmirror · .npmrc
├── next.config.ts                         # TheMeal 보안 헤더 + `microphone=(self)`
├── eslint.config.mjs                      # §3 경계 규칙(import/no-restricted-paths)
├── .env.example · .gitignore(+ speech/models/, speech/**/venv, *.wav)
└── src/
    ├── middleware.ts                      # 세션 쿠키 검사 → (app)·(admin) 보호, (admin) 은 capability 없으면 404
    ├── app/                               # Next.js 라우트는 얇게: 인증·검증·모듈 호출·응답만
    │   ├── (auth)/{login,invite}/
    │   ├── (app)/{study/{ai,today}, plan, drawer, settings, ask}/
    │   ├── (admin)/admin/{dashboard, speech/{realtime,analysis,tts}, llm, voices, plugins, connections,
    │   │                  configuration, prompts, diagnostics, playground, history}/
    │   ├── api/
    │   │   ├── health/ · auth/* · app/version/          # 무버전
    │   │   ├── v1/**                                     # 사용자 API(인증+소유자 검사)
    │   │   ├── admin/v1/**                               # 관리자 API(capability 검사, modules/admin 경유)
    │   │   └── internal/**                               # gateway·worker → 앱 콜백(공유 시크릿 헤더)
    │   └── models/[...path]/route.ts                     # /models/* 개발 폴백(운영은 nginx alias → DATA_ROOT/models)
    ├── components/{shell, talk, chat, vocab, lesson, eval, plan, drawer, settings, ask, speech, common,
    │               admin/{console, configEditor, jsonEditor, diff, trace, playground}}
    └── modules/                           # ★ 6층 플랫폼 + app 층 조합 모듈. §2·§3 이 정본
        ├── admin/                         # L0 (app 층) — 콘솔 조합 모듈
        ├── preferences/                   # L1 User Preference
        ├── conversation/                  # L2 Conversation Platform
        ├── learning/                      # L3 Learning Platform
        ├── speech/                        # L4 Speech Platform
        ├── engine/                        # L5 Engine Management
        └── infra/                         # L6 AI Infrastructure
```

경로 별칭: `@/modules/<name>` 만 허용(`tsconfig.paths`). `@/modules/<name>/<file>` 은 ESLint 가 막는다(§3).

WebSocket `/ws/speech` 는 Next.js 라우트가 아니라 nginx `Upgrade` 프록시 → `127.0.0.1:8100`(gateway) 이므로 `src/app` 트리에 없다.

---

## 2. 6층 + admin 모듈 정의표

공통 규칙:
- 각 모듈은 `index.ts` 하나로만 공개한다. 아래 "공개 API" 는 그 `index.ts` 의 export 목록(설계) 이다. 내부 파일 경로는 구현 자유지만 여기 적은 서브디렉토리 이름을 유지한다.
- Prisma 는 `infra/db` 만 import 하고, 각 모듈은 **자기 소유 테이블만** 읽고 쓴다. 다른 층 테이블이 필요하면 그 층의 공개 함수를 부른다. 두 층에 걸친 원자적 쓰기는 `infra.withTransaction(tx => …)` 에 각 층의 함수를 `tx` 와 함께 넘긴다.
- 서버 전용 파일(spawn·prisma·fs)은 `*.server.ts` 접미 또는 `server-only` import 로 표시해 클라이언트 번들 유입을 막는다. 클라이언트에서 쓰는 것은 `speech/stt/*Client`, `speech/tts/TtsPlayer`, `infra/native/bridge` 뿐이다.

### L0 `src/modules/admin` — Admin/Developer Console 조합 모듈 (app 층)

| 항목 | 내용 |
|---|---|
| 책임 | 관리자 API·콘솔 화면이 부르는 **조합 계층**. capability 검사 → 대상 모듈 호출 → Production 보호 → `AuditLog`·`ConfigurationVersion` 기록을 한 곳에서 보장한다(§121: Console 은 Engine 을 직접 부르지 않는다). |
| 서브디렉토리 | `console/`(overview) · `configuration/`(editor·diff·versions·rollback·presets·export/import·overrides) · `diagnostics/` · `playground/`(stt·tts·llm·e2e) · `audit/` · `permissions/` · `engines/`(connections·health·test·fallback 래퍼) · `voices/`(import·activate·disable·delete·sync 래퍼) · `prompts/`(registry 래퍼) |
| 소유 테이블 | `ConfigurationPreset`, `DebugSession` |
| 공개 API | `can(user, capability)` · `requireCapability(user, capability)` · `CAPABILITIES`(role-permission.md 매트릭스 상수) · `getOverview()` · `getEffectiveConfig(scope, targetId)` · `validateConfig(scope, targetId, patch)` · `testConfig(...)` · `diffConfig(...)` · `applyConfig(actor, scope, targetId, patch, reason)` · `listVersions(scope, targetId)` · `rollbackVersion(actor, versionId, reason)` · `getRawConfig`/`putRawConfig` · `exportSnapshot(scope?)` · `importSnapshot(actor, snapshot, dryRun)` · `listPresets`/`createPreset`/`deletePreset` · `createOverride(actor, kind, scope, targetId, patch, ttl)`/`revokeOverride` · `listPlugins()`/`getPlugin(engineId)` · `getDiagnostics(connectionId)` · `setLogLevel(actor, connectionId, level)` · `createDebugSession(actor, opts)` · `runPlaygroundStt/Tts/Llm(actor, input)` · `runE2e(actor, input)` · `getTrace(traceId)`/`listTraces(filter)` · `listAudit(filter)` · `getEnvironment()` · engines: `listEngineConnections`/`createEngineConnection`/`updateEngineConnection`/`deleteEngineConnection`/`runHealth`/`runFunctionalTest`/`getFallbackPolicy`/`putFallbackPolicy`/`listSecretRefs` · voices: `importVoicePackage(actor, zip)`/`getImportJob`/`updateVoice`/`activateVoice`/`disableVoice`/`archiveVoice`/`syncVoices` · prompts: `listPrompts`/`listPromptVersions`/`createPromptVersion`/`activatePromptVersion`/`testPrompt` |
| 허용 import | `preferences`, `conversation`, `learning`, `speech`, `engine`, `infra` (전 층) |
| 비고 | `(admin)` 라우트 그룹·`/api/admin/v1/*` 만 이 모듈을 import 한다. 사용자 라우트(`/api/v1/*`)는 import 금지. `disableVoice` 처럼 두 층(speech.voices + preferences.reassignVoiceSetting)에 걸친 조합이 이 모듈의 존재 이유다. |

### L1 `src/modules/preferences` — User Preference Layer

| 항목 | 내용 |
|---|---|
| 책임 | 사용자별 설정의 읽기·쓰기·화이트리스트 검증. **값의 의미 해석(엔진 파라미터 변환)은 하지 않는다**(그건 L4 `speech/tts/parameterResolver`). |
| 서브디렉토리 | `profile/`(학습 설정: `level·politeness·goal*·daily*·strictness·explainLang·explainDepth`) · `voiceSetting/` · `speechSetting/` · `appSetting/`(운영 설정 KV) |
| 소유 테이블 | `Profile`, `UserVoiceSetting`, `UserSpeechSetting`, `AppSetting` |
| 공개 API | `getProfile(userId)` · `updateProfile(userId, patch)` · `getVoiceSetting(userId)`(없으면 기본 voice 로 생성) · `updateVoiceSetting(userId, patch)` · `reassignVoiceSetting(fromVoiceProfileId, toVoiceProfileId, tx?)` · `getSpeechSetting(userId)` · `updateSpeechSetting(userId, patch)` · `getAppSetting<T>(key, fallback)` · `setAppSetting(key, value, tx?)` · 상수 `VOICE_PARAM_RANGES`(엔진 독립 음성 수치 범위 정본 — 설정 검증과 speech Resolver·Rendering Plan 클램프가 공유. speech → preferences 는 허용·역방향 금지라 여기 둔다, task-022) · 타입 `Profile`, `UserVoiceSetting`, `UserSpeechSetting`, `RecognitionMode`, `SpeechProfile` |
| 허용 import | `infra` |
| 비고 | `USER_SETTING` 은 설정 해석 규칙의 7순위 소스다. 이 모듈은 값을 **저장·반환만** 하고, Resolver(L5 `engine/configuration`)나 L4 가 요청 시 합성한다. §76 에서 L1 이 "최상층"으로 그려진 것은 사용자 접점이라는 뜻이고, import 순서상으로는 **리프 데이터 모듈**이다(§3). |

### L2 `src/modules/conversation` — Conversation Platform

| 항목 | 내용 |
|---|---|
| 책임 | 채팅·회화·질문 턴의 오케스트레이션(§66), 페르소나·프롬프트·구조화 응답, 교정·제안의 "제안 → 채택" 상태 관리. **STT 와 TTS 를 모른다** — 입력은 이미 텍스트(`text` + `utteranceId?`), 출력은 구조화 응답이며 음성 합성은 라우트가 L4 에 넘긴다. |
| 서브디렉토리 | `orchestrator/`(턴·사용자당 락·SSE 이벤트·pending 정리 — bjj `runTurn` 이식) · `persona/`(`.claude/agents/tutor.md` 로더·`## N.` 절 필터) · `promptBuilder/` · `promptRegistry/`(파일 v0 + DB `PromptVersion` ACTIVE 해석·`prompts:sync`) · `window/`(최근 N개·문자 상한 창) · `structuredResponse/`(§67 스키마·ajv 검증) · `chats/` · `corrections/` · `proposals/` · `prompts/{talk,chat,chatReview,lesson,reviewMix,evalGen,evalGrade,planAnalysis,ask,wordEnrich}` |
| 소유 테이블 | `Chat`, `ChatMessage`, `Correction`, `TutorProposal`, `PromptTemplate`, `PromptVersion` |
| 공개 API | chats: `createChat(userId, {kind, topicId?, title?})` · `listChats(userId, kind?)` · `getChat(userId, chatId)`(`running` 포함) · `updateChat` · `deleteChat` · orchestrator: `runTurn({userId, chatId, text, utteranceId?, inputSource, emit})`(SSE `accepted→status→done|error`) · `getRunningTurn(chatId)` · `sweepPendingMessages()`(기동 시) · `buildTurnContext(userId, chatId)`(내부에서 learning·preferences 호출) · persona: `loadPersona(sections?)` · `getPersonaVoiceHint()`(TTS Resolver 3순위 입력값 — 문자열/enum 만 반환) · promptRegistry: `getActivePrompt(key)` · `listPromptVersions(key)` · `createPromptVersion(key, body, source, actor)` · `activatePromptVersion(key, version, actor)` · `syncPromptsFromSource()` · `testPrompt(key, version, fixture)` · structuredResponse: 타입 `TutorResponse`, `parseTutorResponse(raw)` · corrections: `listCorrections(userId, filter)` · `acceptCorrection(userId, id, {addWord?}, tx?)` · `rejectCorrection` · `reviewChat(userId, chatId)`(A3, ≤20건 동기/초과 잡) · proposals: `listProposals` · `acceptProposal(userId, id, tx?)`(결과 payload 반환 — 실제 WordEntry/StudyLog 생성은 라우트가 learning 에 위임) · `rejectProposal` |
| 허용 import | `learning`, `preferences`, `engine`, `infra` |
| 비고 | 프롬프트 모듈(`prompts/**`)은 prompt-engineer 산출물. LLM 호출은 `engine.llm.completeJson(...)` 만 쓴다(어댑터·모델명 분기 없음, task→tier 표는 `engine/router`). 라우트·화면에 엔진명이 없듯 여기에도 없다. |

### L3 `src/modules/learning` — Learning Platform

| 항목 | 내용 |
|---|---|
| 책임 | 학습자 상태·기록·집계·커리큘럼 결정 코드(3일 반복·세트 생성·채점 규칙). 기획서의 "오늘의 공부·계획표·서랍장" 도메인. |
| 서브디렉토리 | `learnerProfile/`(프롬프트 헤더용 요약) · `attendance/` · `studyLog/` · `vocab/`(setGenerator·distractors·grading·stats·words) · `topics/` · `lessons/`(+`reviewSchedule` §7-4) · `evaluation/`(rubric·scoring) · `studyPlan/` · `learningHistory/`(errorStats §70) · `snapshots/` · `knowledge/`(RAG 슬롯, home-m4 `/v1/kb`) |
| 소유 테이블 | `WordEntry`, `VocabSession`, `VocabAttempt`, `ConversationTopic`, `TopicChunk`, `Lesson`, `ReviewSchedule`, `StudyLog`, `Attendance`, `Evaluation`, `EvaluationItem`, `StudyPlan`, `StatsSnapshot`, `LearnerErrorStat` |
| 공개 API | `getLearnerContext(userId)`(level·goal·최근 약점 — 프롬프트 헤더 ≤300자 재료) · attendance: `checkIn(userId, kstDate)` · `listAttendance(userId, month)` · studyLog: `recordStudyLog(userId, entry, tx?)` · `listStudyLogs` · `deleteStudyLog`(`snapshotKept:true`) · `getCalendar(userId, month)` · `getDay(userId, date)`(task-012 구현 — 달력·하루는 StudyLog·Attendance·ReviewSchedule 파생이라 studyLog 소속, 원본 존재 확인 중 Chat 은 라우트가 `conversation.ownedChatIds` 로 조합) · vocab: `listWords`/`createWord`/`updateWord`/`archiveWord`/`unarchiveWord`/`deleteWord`/`listCategories` · `enrichWord(surface)`(A10) · `createVocabSession(userId, opts)`(정답 미노출 DTO) · `getVocabSession` · `recordAttempt(sessionId, order, answer)` · `finishVocabSession(sessionId)`(단일 트랜잭션) · `keepVocabSession`/`replayVocabSession` · `getVocabStats` · topics: `listTopics(userId, level?)` · `createTopic` · lessons: `getTodayLesson(userId)`(`{mode, date, review?, guard?, todayLessons[], cycle}` — api-contract #58 과 동일, 정합성 #2) · `createLesson(userId, {topicId} \| {sourceText})`(잡) · `updateLessonProgress` · `completeLesson(userId, lessonId)`(트랜잭션 + `ReviewSchedule` upsert) · `startReview`/`skipReview` · `getLessonContext(lessonId)` · evaluation: `createEvaluation`(잡) · `startEvaluation`(#67b) · `lockEvaluationItemForAnswer`+`saveEvaluationAnswer`(라우트가 발화 연결과 한 트랜잭션으로 조합, task-011) · `getEvaluationListenSource`(#67a) · `submitEvaluation`(잡) · `getEvaluation` · `listEvaluations` · studyPlan: `requestPlanAnalysis`(잡, hash 캐시) · `getLatestAnalysis`/`getCurrentPlan` · `acceptPlan`/`rejectPlan` · learningHistory: `recordErrorStat(userId, type, pattern, tx?)` · `getErrorStats(userId)` · snapshots: `getGrowth(userId)`(`StatsSnapshot` 만) · knowledge: `retrieveKnowledge(userId, query)` |
| 허용 import | `preferences`, `engine`, `infra` |
| 비고 | 레슨·평가·계획 생성의 LLM 호출(A4~A8·A10)은 이 모듈 안에서 `engine.llm` 을 직접 쓴다(conversation 을 거치지 않음 — 턴이 아니므로). 프롬프트 본문은 `conversation/prompts/*` 가 아니라 **이 모듈이 `engine.llm` 에 넘길 문자열을 `promptRegistry` 에서 받는다**: `conversation.getActivePrompt(key)` 는 L2 이므로 L3 가 import 할 수 없다 → 라우트/잡 러너가 `getActivePrompt` 결과를 인자로 넘긴다(§4-4 참고). |

### L4 `src/modules/speech` — Speech Platform

| 항목 | 내용 |
|---|---|
| 책임 | 발화(`Utterance`) 수명주기, 실시간 STT 클라이언트 선택, TTS 파라미터 해석·문장 분할·캐시·재생, Voice Registry/Profile/Import/Preview, 분석·발음 결과 조회. **LLM 을 모른다**, 엔진명을 모른다(엔진 역할 `REALTIME_STT/ANALYSIS_STT/TTS` 만 안다). |
| 서브디렉토리 | `utterances/` · `stt/`(`RealtimeSttClient` 인터페이스, `OnDeviceSherpaClient`, `WebSocketSttClient`, `modeResolver`, `ticket`, `config`) · `tts/`(`parameterResolver`, `sentenceSplit`, `cache`, `synthesize`, `TtsPlayer`) · `voices/`(registry·profiles·importJobs·preview·sync) · `pronunciation/`(결과 조회) · `analysis/`(task-012b: 잡 적재 게이트·**사용자별 디바운스**·claim(고아 회수·self-reclaim·환경 필터·하트비트)·실패 백오프·결과 반영·`requiresReview` 판정·평가 채점 텍스트 — comparator 자체는 Python worker. 파일 `policy`(순수 규칙)·`db`·`jobs`·`apply`·`enqueue`·`heartbeat`·`grading`·`validate`) |
| 소유 테이블 | `Utterance`, `SpeechAnalysis`, `SpeechJob`, `TtsCache`, `VoiceProfile`, `VoiceModel`, `VoiceStyle`, `VoiceImportJob` |
| 공개 API | utterances: `createUtterance(userId, meta)` · `storeUtteranceAudio(userId, utteranceId, wav)`(→ `infra.storage`) · `getUtterance(userId, id)` · `resolveFinalText(userId, id, choice, text?)`(#21a, `Utterance` 만) · `applyAnalysisResult(payload)`(internal 콜백용) · analysis(task-012b): `claimAnalysisJobs({workerId, kinds, max})` · `reportJobFailure(jobId, workerId, error, retryable)` · `applyAnalysisResult` · `isAnalysisWorkerAlive()`(적재 게이트·health) · `parseClaimBody`·`parseFailureBody`·`parseAnalysisBody`(내부 라우트 본문 검사) · 적재·디바운스는 `createUtterance`/gateway 등록 안에서(외부 export 없음) · `pickGradingTexts(userId, [{evaluationItemId, answerText}])`(평가 채점 텍스트 선택 — 라우트가 learning 에 주입, 저장된 답과 텍스트가 맞는 발화만) · `purgeExpiredAudio()`(30일) · stt(서버): `issueSpeechTicket(userId, chatId)` · `getSpeechConfig(userId)`(`/api/v1/speech/config` 응답 — 온디바이스 런타임 설정·모델 manifest URL·fallback 여부, 시크릿 없음) · `resolveSpeechMode(setting, capability)` · `enqueueAnalysis(utteranceId, kind)` · stt(클라): `createRealtimeSttClient(config, capability)` · 타입 `RealtimeSttClient`, `SttEvent` · tts: `resolveTtsParameters(input: {userSetting, voiceDefaults, personaHint?, context, llmStyle?})` · `splitSentences(text, maxChars)` · `synthesize(params, text, traceId)`(캐시 → `engine.tts`) · `TtsPlayer`(클라: 문장 큐·프리페치·모드 전환) · voices: `listAvailableVoices()` · `getVoiceProfile(id)` · `previewVoice(draft, text, textVersion)` · `syncVoiceModels()` · `startVoiceImport(zip, actor)` · `getImportJob(id)` · `updateVoiceProfile` · `activateVoice`/`disableVoice`/`archiveVoice` · pronunciation: `getPronunciation(userId, utteranceId)` |
| 허용 import | `preferences`, `engine`, `infra` |
| 비고 | `resolveTtsParameters` 의 3순위 `personaHint` 는 **인자로 받는다**(L2 import 금지). 결과는 엔진 중립 `TtsSynthesisRequest{voiceModelRef, speaker, style, styleWeight, speed, pitch, intonation}` 이며, SBV2 파라미터(`model_id·speaker_id·length=1/speed·pitch_scale·intonation_scale`)로의 변환은 L5 어댑터 `tts/styleBertHttp` 가 한다. |

### L5 `src/modules/engine` — Engine Management Layer

| 항목 | 내용 |
|---|---|
| 책임 | 엔진 디스크립터·설정 스키마(코드), Connection Profile·Health·Fallback(DB), Router, 8층 설정 Resolver·버전·오버라이드, Trace·Metrics, 그리고 **실제 엔진 어댑터**. 상위 층 타입(`Chat`, `Utterance`, `Profile`…)을 **모른다**. |
| 서브디렉토리 | `registry/`(descriptors·schemas·plugins) · `connections/` · `credentials/`(ref 조회만) · `health/` · `functionalTest/` · `router/` · `fallbackPolicy/` · `configuration/`(resolver·versions·overrides·validate·diff) · `metrics/` · `trace/` · `adapters/{llm/{claudeCli,homeM4}, stt/{reazonOnDevice,reazonGateway,whisperHttp}, tts/{styleBertHttp}}` · `json/{extractJson,schemaValidate}` |
| 소유 테이블 | `Engine`, `EngineConnection`, `EngineHealth`, `EngineFallbackPolicy`, `ConfigurationVersion`, `RuntimeOverride`, `RequestTrace`, `EngineMetricsDaily` |
| 공개 API | 역할 파사드(어댑터는 export 하지 않음): `llm.complete(req)` · `llm.completeJson<T>(req)`(`LlmRequest{task, system, messages, tier, jsonSchema?, timeoutMs, priority, traceId?}`) · `stt.transcribe(audio, opts, traceId?)` → `TranscriptionResult` · `tts.synthesize(req: TtsSynthesisRequest, traceId?)` → `AudioData` · `tts.admin.importVoice(zip)`/`tts.admin.refreshModels()`/`tts.admin.listVoices()`/`tts.admin.setVoiceState(model, state)` · registry: `listEngines()` · `getEngineDescriptor(engineId)` · `getConfigurationSchema(engineId)` · `syncDescriptorsToDb()` · connections: `listConnections(role?)` · `getConnection(id)` · `createConnection`/`updateConnection`/`deleteConnection` · credentials: `describeCredentialRef(ref)`(존재 여부·마지막 사용) · health: `runHealthCheck(connectionId)` · `getRecentHealth(connectionId, n)` · `scheduleHealthChecks()` · functionalTest: `runFunctionalTest(connectionId)` · router: `resolveConnection(role, ctx?)` · `withFallback(role, fn)` · 타입 `EngineRole` · fallbackPolicy: `getFallbackPolicy(role)` · `setFallbackPolicy(role, policy, tx?)` · configuration: `resolveEffective(scope, targetId, opts)`(키별 `{value, source, sourceRef}`) · `validate` · `diff` · `apply(actor, …)`(→ `ConfigurationVersion`) · `listVersions` · `rollback` · `createOverride`/`revokeOverride`/`expireOverrides()` · 타입 `ConfigSource`, `Editability` · metrics: `getMetricsDaily(connectionId, range)` · `materializeDailyMetrics()` · trace: `startTrace(kind, meta)` · `traceStep(traceId, step)` · `endTrace(traceId, status)` · `getTrace(traceId)` · `listTraces(filter)` · json: `extractJson`, `validateAgainstSchema` |
| 허용 import | `infra` |
| 비고 | **엔진 이름(`reazon-sherpa`·`whisper`·`style-bert-vits2`·`claude-cli`·`home-m4`)이 문자열로 등장하는 유일한 TS 위치는 `engine/adapters/**` 와 `prisma/seed-data/engines.json` 이다.** 어댑터마다 `descriptor()`·`configurationSchema()`·`healthCheck()`·`functionalTest()` 를 구현한 `EngineProvider` 를 export 하고 `registry/plugins.ts` 가 목록화한다. `router` 는 `EngineFallbackPolicy` 를 순회하며 `status ∈ {UNAVAILABLE, DISABLED, MISCONFIGURED}` 를 제외하고 1회 재시도 후 실제 사용 `connectionId` 를 trace step 에 남긴다. |

### L6 `src/modules/infra` — AI Infrastructure

| 항목 | 내용 |
|---|---|
| 책임 | DB·인증·세션·시크릿·스토리지·잡 큐·프로세스/HTTP 런타임·설정 로더·감사·검증·로깅·날짜·네이티브 브리지. 도메인을 모른다. |
| 서브디렉토리 | `db/`(prisma 싱글턴·`withTransaction`) · `auth/`(TheMeal 이식: OAuth·초대코드·httpOnly JWT·앱 딥링크 코드) · `session/` · `secrets/`(`SecretResolver` `env:NAME`·`file:<name>`) · `storage/`(`DATA_ROOT` 경로 규약·안전 join) · `jobs/`(`SpeechJob`·`AiJob` enqueue/claim/complete) · `runtime/`(`spawnArgv`·`httpRequest`(node:http, timeout 0 Agent)·`wsClient`) · `config/`(yaml/env 로더·`APP_ENV`) · `audit/` · `validation/`(zod 스키마·`ApiError` 코드) · `logging/`(레벨·민감정보 마스킹) · `dates/`(KST) · `native/bridge`(클라) |
| 소유 테이블 | `User`, `AppAuthCode`, `AiJob`, `AppRelease`, `AuditLog` |
| 공개 API | db: `prisma` · `withTransaction(fn)` · auth: `getSessionUser(req)` · `requireUser(req)` · `startOAuth(platform)` · `handleOAuthCallback` · `issueAppAuthCode(userId)` · `consumeAppAuthCode(code)` · `logout` · `SESSION_COOKIE`(`thekaiwa_session`) · secrets: `resolveSecret(ref)` · `secretExists(ref)` · `listSecretRefs()` · storage: `DATA_ROOT` · `utteranceAudioPath(userId, utteranceId, date)` · `ttsCachePath(key)` · `modelServePath(name, version)` · `releaseApkPath(versionName)` · `safeJoin(base, ...parts)` · jobs: `enqueueSpeechJob(tx?, …)` · `enqueueAiJob` · `claimNextJob(kind)`(`FOR UPDATE SKIP LOCKED`) · `completeJob`/`failJob` · `sweepStaleRunning()` · runtime: `spawnArgv(cmd, args, {stdin, cwd, env, timeoutMs})` · `httpRequest(opts)` · config: `APP_ENV` · `loadYamlConfig(path)` · `readEnv(name)` · audit: `recordAudit(entry, tx?)` · validation: `parseBody(schema, req)` · `ApiError` · `ErrorCode` · logging: `logger` · `maskSensitive(obj)` · dates: `kstToday()` · `toKstDate(d)` · `kstMonthRange(month)` · native(클라): `getBridge()` · `isNativeApp()` · `getSherpaStt()` · `onAuthDeepLink` · `openExternal`/`closeExternal` · `toWebFileSrc` · app: `getAppVersionInfo()`(`AppRelease` 최신) |
| 허용 import | 없음(외부 패키지만) |
| 비고 | `native/bridge.ts` 는 VoiceVault 원칙 그대로 **`@capacitor/*` 를 import 하지 않고 `window.Capacitor.Plugins` 전역만** 본다(§6). `logging.maskSensitive` 는 `credentialRef` 값·티켓·전체 발화 텍스트를 마스킹한다. |

---

## 3. 허용 import 행렬과 ESLint 규칙 초안

### 3-1. 행렬 (행 = import 하는 쪽, 열 = import 당하는 쪽)

순서는 **import 가능한 방향이 위→아래(오른쪽)** 이 되도록 정한 것이며, §76 의 층 번호(L1~L6)와 다르다는 점에 주의(L1 preferences 는 리프 데이터 모듈이라 오른쪽에 둔다). 대각선 아래는 전부 ✗ 라 행렬은 **상삼각**이다. ✓ = `index.ts` 를 통해 허용, ✗(규칙) = 상삼각이지만 설계 규칙으로 금지, · = 자기 자신.

| from \ to | app(라우트·컴포넌트) | admin | conversation | learning | speech | preferences | engine | infra |
|---|---|---|---|---|---|---|---|---|
| **app** | · | ✓ (`(admin)`·`/api/admin/v1` 만) | ✓ | ✓ | ✓ | ✓ | ✗(규칙: admin 경유) | ✓ (auth·validation·dates·logging·native 만, `importNames` 제한) |
| **admin** | ✗ | · | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **conversation** | ✗ | ✗ | · | ✓ (`getLearnerContext`·`getLessonContext`·`getErrorStats`·`retrieveKnowledge`·`retrieveRecords` 읽기 — 3차 보완) | ✗(규칙: 라우트가 조합) | ✓ | ✓ (`llm` 파사드·`trace`) | ✓ |
| **learning** | ✗ | ✗ | ✗ | · | ✗(규칙: 라우트가 조합) | ✓ | ✓ (`llm` 파사드 — A4~A8·A10) | ✓ |
| **speech** | ✗ | ✗ | ✗ | ✗ | · | ✓ | ✓ (`stt`·`tts` 파사드·`router`·`trace`) | ✓ |
| **preferences** | ✗ | ✗ | ✗ | ✗ | ✗ | · | ✗(불필요) | ✓ |
| **engine** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | · | ✓ |
| **infra** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | · |

Python 서비스·플러그인(코드 공유 없음, 계약으로만 연결):

| from \ to | `speech/common` | `speech/gateway` | `speech/worker` | `speech/tts-service` | `plugins/sherpa-stt` | `src/**` |
|---|---|---|---|---|---|---|
| **`speech/gateway`** | ✓ (패키지 import) | · | ✗ | ✗ (HTTP 만, Phase 4 슬롯) | ✗ | ✗ (`/api/internal/*` HTTP 콜백만) |
| **`speech/worker`** | ✓ | ✗ | · | ✗ | ✗ | ✗ (`/api/internal/*` HTTP 만 — 잡 클레임 #139·실패 보고 #140·결과 저장 #138, task-012b D-B1) |
| **`speech/common`** | · | ✗ | ✗ | ✗ (`StyleBertVitsEngine` 어댑터가 HTTP 로 호출) | ✗ | ✗ (**DB 접속 없음** — task-012b D-B1 에서 `SpeechJob` 직접 읽기·쓰기를 폐기, 잡도 `/api/internal/speech/jobs/*` HTTP. 설정은 `speech.config.yml`·env·#141a) |
| **`speech/tts-service`** | ✗ (**AGPL 경계** — 우리 코드도 import 하지 않는 독립 패키지) | ✗ | ✗ | · | ✗ | ✗ |
| **`plugins/sherpa-stt`** | ✗ | ✗ | ✗ | ✗ | · | ✗ (모델은 `/models/*` HTTP 다운로드) |
| **`src/**`** | ✗ | ✗ (WS 는 브라우저→nginx→gateway) | ✗ | ✗ (`engine/adapters/tts/styleBertHttp` 가 HTTP) | ✗ (**`window.Capacitor.Plugins.SherpaStt` 전역만**, TS 정의도 import 안 함) | · |

행렬 판독 규칙:
1. 같은 표의 위쪽(왼쪽) 모듈은 아래쪽(오른쪽)만 부른다. 역방향이 필요해지면 **콜백 인자·이벤트·라우트 조합**으로 푼다(예: TTS Resolver 의 persona 힌트).
2. `conversation → learning` 은 §66 의 "Orchestrator → Learner Profile → Lesson Context → Learning History → Knowledge Retrieval" 을 매 턴 조립해야 해서 허용한다. 대신 **쓰기**(단어 추가·StudyLog 생성)는 conversation 이 하지 않고 라우트가 learning 에 위임한다(제안 → 채택 원칙과 같은 방향).
3. `speech ↔ conversation`, `speech ↔ learning` 은 금지다. 음성 턴·평가 말하기 문항·분석 결과 → 오류 통계는 전부 라우트(또는 internal 콜백 라우트)가 두 모듈을 순서대로 부른다(§4).
4. `app → engine` 직접 import 는 금지다. 사용자 라우트는 L1~L4 파사드로 충분하고, 관리자 라우트는 `admin` 모듈이 capability·audit 을 감싼다. `/api/health` 만 예외로 `infra.config`·`engine.health` 의 boolean 요약을 읽는데, 이것도 `admin.getOverview` 의 축약 함수 `getHealthSummary()` 를 두어 `app → admin` 으로 통일한다.
5. `components/**` 는 서버 모듈을 import 하지 않는다. 클라이언트에서 허용되는 것은 `speech`(`createRealtimeSttClient`·`TtsPlayer`)·`infra`(`native/bridge`·`dates`) 의 클라이언트 안전 export 뿐이며, 나머지 데이터는 라우트/서버 컴포넌트가 props 로 넘긴다.

### 3-2. ESLint 규칙 초안 (설계 — task-002 에서 실물화)

```js
// eslint.config.mjs — 경계 규칙 부분만 발췌(설계 초안)
import importPlugin from 'eslint-plugin-import'

const M = 'src/modules'
// 각 모듈이 import 할 수 있는 모듈(자기 자신 제외). §3-1 행렬과 1:1.
const ALLOW = {
  admin:        ['conversation', 'learning', 'speech', 'preferences', 'engine', 'infra'],
  conversation: ['learning', 'preferences', 'engine', 'infra'],
  learning:     ['preferences', 'engine', 'infra'],
  speech:       ['preferences', 'engine', 'infra'],
  preferences:  ['infra'],
  engine:       ['infra'],
  infra:        [],
}
const zones = Object.entries(ALLOW).map(([target, allowed]) => ({
  target: `${M}/${target}`,
  from: M,
  except: [`./${target}`, ...allowed.map((a) => `./${a}`)],
  message: `modules/${target} 는 ${allowed.join(', ') || '(없음)'} 만 import 할 수 있다 (docs/design/module-dependency.md §3)`,
}))

export default [
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { import: importPlugin },
    rules: {
      'import/no-restricted-paths': ['error', { zones: [
        ...zones,
        // app 층: engine 직접 금지(admin 경유), 어댑터·prisma 직접 금지
        { target: 'src/app', from: `${M}/engine`, message: 'app 은 engine 을 직접 부르지 않는다 — L1~L4 파사드 또는 modules/admin 경유' },
        { target: 'src/components', from: `${M}/engine` },
        { target: 'src/app/(app)', from: `${M}/admin`, message: '사용자 라우트는 admin 모듈을 import 하지 않는다' },
        { target: 'src/app/api/v1', from: `${M}/admin` },
        { target: 'src/app/api/internal', from: `${M}/admin` },
        // 모듈 내부 파일 직접 접근 금지 — index.ts 만
        { target: 'src', from: `${M}/*/!(index).ts`, message: '모듈은 index.ts 공개 API 로만 import' },
      ]}],
      'no-restricted-imports': ['error', {
        paths: [
          { name: '@prisma/client', message: 'infra/db 경유' },
          { name: 'node:child_process', message: 'infra/runtime.spawnArgv 경유' },
          { name: 'child_process', message: 'infra/runtime.spawnArgv 경유' },
        ],
        patterns: [
          { group: ['@/modules/*/*'], message: '모듈은 @/modules/<name> 로만 import (index.ts)' },
          { group: ['@capacitor/*', '@capgo/*', '@capacitor-community/*', '@thekaiwa/sherpa-stt'],
            message: '웹 번들은 네이티브 패키지를 import 하지 않는다 — infra/native/bridge 전역만' },
        ],
      }],
    },
  },
  // 예외: 규칙의 "유일한 경로" 파일들
  { files: [`${M}/infra/db/**`], rules: { 'no-restricted-imports': 'off' } },
  { files: [`${M}/infra/runtime/**`], rules: { 'no-restricted-imports': 'off' } },
  // app 층이 infra 에서 가져갈 수 있는 이름 제한(db·runtime·secrets·jobs·storage 금지)
  {
    files: ['src/app/**', 'src/components/**'],
    rules: { 'no-restricted-imports': ['error', { paths: [{
      name: '@/modules/infra',
      importNames: ['prisma', 'withTransaction', 'spawnArgv', 'httpRequest', 'resolveSecret',
                    'enqueueSpeechJob', 'enqueueAiJob', 'claimNextJob', 'safeJoin', 'DATA_ROOT'],
      message: '라우트는 DB·spawn·fetch·시크릿·스토리지를 직접 만지지 않는다(§8 금기)',
    }]}]},
  },
  // 엔진명 문자열 금지(어댑터·seed 밖) — 정규식 린트는 CI 스크립트로 보완
  //   grep -rnE 'reazon|whisper|style-bert|claude-cli|home-m4' src --include='*.ts*' \
  //     | grep -v 'src/modules/engine/adapters' → 0건이어야 한다
]
```

보완 검사(CI 스크립트, 설계):
- `grep -rnE 'reazon|whisper|style-?bert|sherpa' src --include='*.ts' --include='*.tsx' | grep -vE 'src/modules/(engine/adapters|speech/stt/OnDeviceSherpaClient|infra/native/bridge)'` → 0건. (`OnDeviceSherpaClient`·`bridge.getSherpaStt` 는 플러그인 등록명 `SherpaStt` 를 알아야 하므로 예외로 명시한다. 이 둘은 엔진 "선택"이 아니라 플러그인 "존재 확인"이다.)
- `grep -rn 'process.env' src --include='*.ts' | grep -v 'src/modules/infra/config'` → 0건(env 는 `infra.config.readEnv` 로만).

---

## 4. 라우트가 조합하는 대표 시퀀스 3개

표기: `→` 호출, `⇒` HTTP/WS 경계, `[모듈.함수]`. 라우트는 "인증 → 검증 → 모듈 호출 순서 → 응답" 만 하고 분기 논리를 갖지 않는다.

### 4-1. 음성 턴 (Talk: 발화 → 강사 음성)

```
[클라 /study/ai/talk]
  infra.native.getSherpaStt() 존재+모델 설치 → speech.createRealtimeSttClient(config, capability)
     ├─ OnDeviceSherpaClient  : SherpaStt.start() … 이벤트 vad/partial/final{text, durationMs, wavPath}
     └─ WebSocketSttClient    : POST /api/v1/speech/ticket ⇒ wss /ws/speech (nginx ⇒ gateway :8100)
                                gateway: VAD+ReazonSpeech → final{utteranceId,…} (gateway 가 ⇒ POST /api/internal/speech/utterances 로 행 생성
                                — 라우트가 티켓 chatId 를 conversation.getOwnedChat 으로 확인한 뒤 Utterance.chatId 로 저장, task-018)
  (온디바이스 경로) ⇒ POST /api/v1/speech/utterances (multipart wav ≤60s·≤2MB, realtimeText, timings)

[POST /api/v1/speech/utterances]
  infra.requireUser → infra.parseBody
  → conversation.getOwnedChat(userId, chatId)                     # chatId 가 있으면 소유 확인(타인 404) — 라우트 조합, 확인한 방만 저장(task-018)
  → speech.createUtterance(userId, {chatId, realtimeEngine, realtimeText, durationMs, timings})
  → speech.storeUtteranceAudio(userId, utteranceId, wav)          # infra.storage.utteranceAudioPath
  → speech.enqueueAnalysis(utteranceId, 'ANALYSIS_STT')            # 발화 저장과 같은 트랜잭션. 게이트(task-012b D-B3): 워커 claim 120초 안 · recognitionMode≠OFFLINE · ANALYSIS_STT connection enabled · 오디오 있음
                                                                     # runAfter = now+max(20s, FAST 30s) + 같은 사용자 QUEUED 잡 디바운스(≤createdAt+5분, D-B8 수정 2026-09-29) — 같은 트랜잭션(withTransaction, REV-033 L2), 디바운스 UPDATE 를 발화 INSERT 보다 먼저(Codex C2)
  ← { utteranceId, status, analysisQueued, expiresAt }
  (gateway TURN 콜백 POST /api/internal/speech/utterances 도 같은 speech.enqueueAnalysis 를 부른다)

[POST /api/v1/chats/:id/turns  (SSE)]
  infra.requireUser → conversation.getChat(소유자 검사, running 409)
  → conversation.runTurn({userId, chatId, text, utteranceId, inputSource:'REALTIME_STT', emit})
       ├─ conversation.buildTurnContext(userId, chatId)
       │     ├─ preferences.getProfile(userId)                      # strictness·explainLang·explainDepth·politeness
       │     ├─ learning.getLearnerContext(userId)                  # level·goal·약점 요약(≤300자)
       │     ├─ learning.getErrorStats(userId)                      # §70
       │     ├─ learning.retrieveKnowledge(userId, text)            # RAG 슬롯(Phase 3b)
       │     └─ conversation.window (최근 6개 ≤2,000자)
       ├─ conversation.persona.loadPersona(['1','2','3','4','5','6'])   # 절 필터 ≤2,500자
       ├─ conversation.promptRegistry.getActivePrompt('talk')        # DB ACTIVE > 파일 v0
       ├─ engine.trace.startTrace('TURN') → engine.llm.completeJson({task:'talk', tier:'fast', jsonSchema:§67, timeoutMs:12000, priority:'interactive'})
       │     └─ engine.router.resolveConnection('LLM') → adapters/llm/claudeCli (spawn via infra.runtime) → traceStep
       ├─ conversation.structuredResponse.parseTutorResponse → ChatMessage(ASSISTANT)·Correction(PROPOSED) 저장(트랜잭션)
       └─ emit('done', { messageId, conversation:{replyJa,…}, correction, speech:{style}, traceId })

[POST /api/v1/speech/tts  { text: replyJa 문장, context:'TALK', llmStyle, chatId }]
  infra.requireUser
  → preferences.getVoiceSetting(userId)                                # 1순위 입력
  → speech.getVoiceProfile(setting.voiceProfileId)                      # 2순위 입력(defaults)
  → conversation.getPersonaVoiceHint()                                  # 3순위 입력 — 라우트가 값을 꺼내 speech 에 넘긴다
  → speech.resolveTtsParameters({userSetting, voiceDefaults, personaHint, context:{mode:'TALK'}, llmStyle})
  → speech.splitSentences(text, 100)
  → speech.synthesize(params, sentence, traceId)                        # TtsCache 조회 → miss 시
       └─ engine.tts.synthesize(TtsSynthesisRequest) → engine.router('TTS') → adapters/tts/styleBertHttp ⇒ M4 :8200 /synthesize
  ← audio/wav (+ X-Kaiwa-Trace: traceId)      # 클라 TtsPlayer 가 1문장 재생 중 2문장 요청

[worker (비동기, 대화 지연과 무관) — task-012b D-B1: DB 접속 없음, HTTP 만]
  ⇒ POST /api/internal/speech/jobs/claim (#139) → WhisperEngine ⇒ VoiceVault :8090 /transcribe-chunk → TranscriptComparator
  ⇒ POST /api/internal/speech/utterances/:id/analysis (#138)   |  실패 ⇒ POST /api/internal/speech/jobs/:id/result (#140)
[POST /api/internal/speech/jobs/claim]
  infra 공유 시크릿 검사 → speech.claimAnalysisJobs({workerId, kinds, max, env})   # 고아 회수(요청 kinds 만 — 15분↑ 또는 lockedBy 가 이 인스턴스 id 와 정확히 같은 RUNNING = self-reclaim, 로그 분리)·SKIP LOCKED·재검사(그 사용자 마지막 발화 +20초 안이면 RUNNING 대신 runAfter 미룸, Codex C2)·환경 필터(D-B11: 비운영 앱은 QA 계정 잡만)·하트비트 기록. 유휴면 트랜잭션 없이 읽기 1회
  ← { jobs[] }
[POST /api/internal/speech/utterances/:id/analysis]
  infra 공유 시크릿 검사 → speech.applyAnalysisResult(payload)          # 한 트랜잭션: Utterance(analysisText·transcriptConfidence·requiresReview·ANALYZED) + SpeechAnalysis upsert + SpeechJob DONE
                                                                        # requiresReview 판정(임계)은 앱. finalText·finalSource 는 바꾸지 않는다(D-B5)
  → learning.recordErrorStat(userId, …)                                # Phase 3(발음 항목)부터. 라우트가 두 모듈을 순서대로
  ← 200 { stored, utteranceStatus, transcriptConfidence, requiresReview, finalSource }
[PATCH /api/v1/speech/utterances/:id  {choice, text?}]   (#21a, task-012b D-B5·D-B6)
  infra.requireUser → speech.resolveFinalText(userId, id, choice, text)   # 조건부 갱신 1회, Utterance 만 — ChatMessage·Correction·평가 답 불변
[POST /api/v1/evaluations/:id/submit — 채점(A7) 시작]  (task-012b D-B7)
  라우트가 조합(learning → speech import 는 ✗ 규칙): learning.submitEvaluation(userId, id, grading) 에 넘기는 grading 콜백에
  speech 의 발화 텍스트 선택(finalText / analysisText=SERVER_STT / 저장된 답)을 주입한다 — 채점 시작 시점 값, 분석을 기다리지 않는다
```

`ChatMessage.toolLog` 에는 `{traceId, vadMs, sttMs, llmMs, ttsMs, ttsStartMs, connectionId}` 요약만 남기고 단계별 원본은 `RequestTrace.steps` 에 있다.

### 4-2. 통합 미리듣기 (설정 화면 draft → 음성)

```
[클라 /settings AI 선생님 탭]  저장 전 draft {voiceId, style, styleWeight, speed, pitch, intonation}
⇒ POST /api/v1/voices/preview
  infra.requireUser → preferences.parseVoiceDraft(범위 검증: speed 0.5~1.5, pitch 0.7~1.4, intonation 0.6~1.4, styleWeight 0~4 — 정본 preferences.VOICE_PARAM_RANGES, task-022)
  → speech.getVoiceProfile(draft.voiceId)   # status AVAILABLE 아니면 404
  → preferences.getAppSetting('voice.preview.defaultText'), getAppSetting('voice.preview.textVersion')
  → speech.resolveTtsParameters({userSetting: draft, voiceDefaults: profile.defaults, personaHint: null, context:{mode:'PREVIEW'}, llmStyle: null})
  → engine.trace.startTrace('PREVIEW')
  → speech.previewVoice(params, text, textVersion)
       └─ speech.synthesize(...)  # 캐시 키 sha1(text|voiceId|style|styleWeight|speed|pitch|intonation|engineConnectionId|textVersion)
             └─ engine.tts.synthesize → router('TTS') → styleBertHttp ⇒ M4 /synthesize
  ← audio/wav 또는 { cachedUrl }
```
LLM 호출 없음, `UserVoiceSetting` 쓰기 없음(저장은 별도 `PUT /api/v1/settings/voice`). Trace kind 는 `PREVIEW`.

### 4-3. Voice Package Import (관리자)

```
[클라 (admin)/admin/voices]  zip 업로드
⇒ POST /api/admin/v1/voices  (multipart)
  infra.requireUser → admin.requireCapability(user, 'voice.import')      # SUPER_ADMIN(Production) / ADMIN(LOCAL)
  → admin.importVoicePackage(actor, zip)
       ├─ admin.getEnvironment() Production 보호 검사
       ├─ speech.startVoiceImport(zip, actor)                           # VoiceImportJob UPLOADED
       │     ├─ manifest.json 파싱·필수 키 검증 → VALIDATING
       │     ├─ engine.tts.admin.importVoice(zip)                        # → styleBertHttp ⇒ M4 POST /admin/voices/import
       │     │      (tts-service: zip 검증 → model_assets/<modelName>/ → /admin/models/refresh → 고정 문장 합성 테스트)
       │     ├─ IMPORTING → TESTING: engine.functionalTest 와 같은 고정 문장으로 합성 1회
       │     ├─ speech.syncVoiceModels()                                 # engine.tts.admin.listVoices → VoiceModel upsert
       │     └─ VoiceProfile 생성(status VALIDATING → AVAILABLE, defaults = manifest 값) → REGISTERED
       ├─ infra.recordAudit({action:'voice.import', scope:'VOICE_PROFILE', after:{voiceProfileId}})
       └─ engine.configuration.apply(actor, 'VOICE_PROFILE', voiceProfileId, snapshot, reason)   # ConfigurationVersion v1
  ← 202 { importJobId }
⇒ GET /api/admin/v1/voices/import-jobs/{id}   # 상태·log 폴링
```
실패(어느 단계든)는 `VoiceImportJob.status=FAILED` + `log` 에 단계·원인, `VoiceProfile` 은 만들지 않는다(§34: 등록 실패 Voice 는 노출 금지).

### 4-4. (보조) 레슨 생성 잡에서의 프롬프트 전달 — L3 가 L2 를 import 하지 않는 방식

```
[POST /api/v1/lessons]
  → conversation.getActivePrompt('lesson')          # 라우트가 L2 에서 프롬프트 본문·버전을 꺼내
  → learning.createLesson(userId, {topicId}, {prompt, promptVersion})   # L3 에 인자로 넘긴다
       └─ (AiJob 러너) engine.llm.completeJson({task:'lesson', tier:'balanced', …})
```
잡 러너(`infra.jobs` 위에서 도는 `src/modules/learning/jobs/*`)도 같은 규칙: 프롬프트 **키·버전·입력 메타**를 enqueue 시점에 `AiJob.payload` 로 스냅샷해 넘긴다(본문은 넣지 않음 — domain-model `AiJob.payload`, 정합성 #1).

---

## 5. Python 서비스 대응 (`speech/common` ↔ `src/modules/engine`)

Python 서비스는 TS `engine` 층의 개념을 **같은 이름으로 미러링**하되 코드를 공유하지 않는다(언어 경계). 계약이 어긋나지 않도록 (a) 설정 스키마 JSON(`speech-platform/07`)을 양쪽이 같은 문서에서 옮겨 적고, (b) Functional Test 가 `GET /api/admin/v1/config/schema/:engineId` 와 각 서비스 `GET /admin/config/effective` 를 대조한다.

### 5-1. 개념 대응표

| TS `src/modules/engine` | Python `speech/common` (`kaiwa_speech_common`) | 비고 |
|---|---|---|
| `registry/descriptors` · `EngineDescriptor` | `engine/descriptor.py` · `EngineDescriptor` dataclass | `engineId`·`type(STT/TTS/LLM)`·`connectionTypes`·`capabilities`·`schemaVersion` |
| `registry/schemas` · `ConfigurationSchema` | `engine/schema.py` · `ConfigurationSchema`, `validate(schema, values)` | 키별 `editability`(READ_ONLY/RUNTIME_EDITABLE/RESTART_REQUIRED/REDEPLOY_REQUIRED/SECRET) 포함 |
| `EngineProvider`(어댑터가 구현: `descriptor()`·`configurationSchema()`·`healthCheck()`·`functionalTest()`) | `engine/interfaces.py` · `EngineProvider` Protocol(`descriptor()`·`configuration_schema()`·`health_check()`·`functional_test()`) | 시그니처 골격은 [`speech/gateway/interfaces.py`](../../speech/gateway/interfaces.py) — 구현 시 `common/engine/interfaces.py` 로 옮기고 gateway 가 re-export |
| `adapters/stt/reazonGateway`(HTTP/WS 클라 쪽) | `engine/adapters/stt/reazon_sherpa.py` · `ReazonSherpaEngine`(sherpa-onnx `OfflineRecognizer` + silero `Vad`, 실제 추론) | TS 쪽은 "gateway 를 부르는 어댑터", Python 쪽이 "엔진 자체" |
| `adapters/stt/whisperHttp` | `engine/adapters/stt/whisper.py` · `WhisperEngine`(`mode=http`: VoiceVault :8090 `/transcribe-chunk` 재사용 / `mode=local`: faster-whisper 직접 로드 옵션) | 처음엔 http, 정확도 부족 시 local(large-v3-turbo) |
| `adapters/tts/styleBertHttp` | `engine/adapters/tts/style_bert_vits.py` · `StyleBertVitsEngine`(M4 :8200 `/synthesize`·`/voices`·`/admin/*` HTTP) | Python 쪽은 Functional Test·(Phase 4) WS 내 TTS 슬롯에서만 사용 |
| `router` · `EngineRole` | `router.py` · `SpeechEngineRouter.resolve(role, ctx)` · `with_fallback(role, fn)` | `EngineFallbackPolicy` 행을 읽고 `status` 로 제외·1회 재시도 — TS 와 같은 규칙 |
| `configuration/resolver`(8층) | `config.py` · `resolve_effective(scope, target_id)` | DEFAULT(schema) → SOURCE_CODE → APPLICATION_CONFIG(`speech.config.yml`) → ENVIRONMENT(env) → DATABASE(`ConfigurationVersion` ACTIVE) → CONNECTION_PROFILE(`EngineConnection`) → USER_SETTING(**요청 payload 로 전달받음**, 서비스는 저장소를 읽지 않음) → RUNTIME_OVERRIDE(`RuntimeOverride` 미만료). 키별 `{value, source, sourceRef}` 반환은 동일 |
| `credentials` + `infra/secrets` | `secrets.py` · `resolve_secret(ref)`(`env:NAME` · `file:<name>` → `/home/brownjeon/apps/thekaiwa/shared/secrets/<name>` 0600) | 값은 로그·응답에 절대 싣지 않음 |
| `health` · `functionalTest` | `health.py` · `HealthCheckResult`, `run_health(provider)`, `run_functional_test(provider, asset)` | `speech/test-assets/ja-sample.wav` 를 STT 기능 테스트 입력으로 |
| `trace` | `trace.py` · `TraceStep` 을 콜백 payload 에 동봉(`steps[]`) | Python 은 `RequestTrace` 테이블을 직접 쓰지 않고 앱 콜백에 실어 보낸다 |
| ~~`infra/jobs`(`claimNextJob`)~~ → 앱 `speech/analysis`(`claimAnalysisJobs`·`reportJobFailure`) | **없음**(task-012b D-B1 — 종전 `db.py`·`claim_next_speech_job()` 폐기) | Python 은 **어떤 앱 테이블도 직접 읽고 쓰지 않는다**. `SpeechJob` 잠금(`FOR UPDATE SKIP LOCKED`)·고아 회수·백오프·환경 필터는 앱이 #139·#140 안에서 한다. worker env 에 `DATABASE_URL` 을 싣지 않는다 |
| `infra/logging.maskSensitive` | `logging.py` · `mask()` | 티켓·시크릿·전체 전사문 마스킹, INFO 에는 길이·해시만 |
| `/api/internal/*` 호출 | `internal_client.py` · `post_utterance(...)`(gateway), `claim_jobs(...)`·`report_failure(...)`·`post_analysis(...)`(worker) (`X-Internal-Secret`, `X-Service` 는 호출 서비스 이름으로 파라미터화) | 앱이 `Utterance`·`SpeechAnalysis`·`SpeechJob` 행의 소유자 |
| (Python 전용) 비교기 | `speech/worker/comparator.py` · `TranscriptComparator`(+ 읽기 변환 `ReadingProvider` = pyopenjtalk, worker 전용 requirements) | 앱에는 대응 없음 — 앱은 `similarity`·`flags` 로 `requiresReview` 만 판정(임계는 앱) |

### 5-2. 프로세스·호스트 배치

| 프로세스 | 호스트 | 바인드 | 실행 | 진입점 |
|---|---|---|---|---|
| `thekaiwa-speech-gateway` | 우분투 | `127.0.0.1:8100` (nginx `/ws/speech` 프록시) | pm2 + venv `~/.node-local/thekaiwa-speech/venv` | `uvicorn app:app --host 127.0.0.1 --port 8100` (cwd `speech/gateway`) |
| `thekaiwa-speech-worker` | 우분투 | **없음**(앱 `/api/internal/speech/jobs/claim` HTTP 폴링 — task-012b D-B1·D-B4, 생존은 claim 하트비트) | pm2 **`instances: 1`**(운영 워커 1개 — 전사가 호스트 CPU 코어를 다 쓴다, Leader 2026-09-29) + 같은 venv(+ `speech/worker/requirements.txt` — 운영 설치는 사용자 승인). **claim 식별자 = `SPEECH_WORKER_ID` + 부트 nonce(인스턴스 id `<id>-<8hex>`, REV-033 M1)** — 같은 이름으로 둘이 떠도·재기동해도 잡이 섞이지 않는다(재기동 전 잡은 15분 고아 회수). `SPEECH_WORKER_ID` 미설정 시 `worker-<host>-<pid>` | `python main.py` (cwd `speech/worker`, 패키지 `kaiwa_worker/`) |
| `kaiwa-tts` | 맥 M4 | `0.0.0.0:8200` (LAN, 우분투에서만 접근) | `~/kaiwa-tts-run` 독립 git clone + venv + uvicorn + **cron 워치독**(home-m4-api 방식, `.deploy.lock` 조율) | `uvicorn app:app --host 0.0.0.0 --port 8200` (cwd `~/kaiwa-tts-run/speech/tts-service`) |
| (재사용) `voicevault-whisper` | 우분투 | `127.0.0.1:8090` | VoiceVault 소유 pm2 | 변경 없음 — TheKaiwa 는 HTTP 로만 호출 |

pm2 항목 초안(`ecosystem.config.js` 에 task-003 에서 추가; VoiceVault `voicevault-whisper` 항목의 venv+uvicorn 패턴, `.env` → `pickNonEmpty` 주입, `<base>/shared/logs` 규칙을 그대로 따른다):

```js
{
  name: 'thekaiwa-speech-gateway',
  script: `${process.env.HOME}/.node-local/thekaiwa-speech/venv/bin/uvicorn`,
  args: 'app:app --host 127.0.0.1 --port 8100',
  interpreter: 'none', cwd: `${__dirname}/speech/gateway`, instances: 1, autorestart: true, watch: false,
  max_memory_restart: '2G',   // ReazonSpeech int8 상주 ≈0.5GB + 세션 버퍼. P0 실측 후 조정
  env: { ...pickNonEmpty(dotenv, ['DATABASE_URL','DATA_ROOT','APP_ENV','JWT_SECRET','SPEECH_INTERNAL_SECRET','SPEECH_CONFIG_PATH','APP_INTERNAL_URL','TTS_SERVICE_URL']) },
  out_file: `${LOG_DIR}/speech-gateway-out.log`, error_file: `${LOG_DIR}/speech-gateway-err.log`, merge_logs: true, log_date_format: 'YYYY-MM-DD HH:mm:ss',
},
{
  name: 'thekaiwa-speech-worker',
  script: `${process.env.HOME}/.node-local/thekaiwa-speech/venv/bin/python`,
  args: 'main.py',
  interpreter: 'none', cwd: `${__dirname}/speech/worker`, instances: 1, autorestart: true, watch: false,
  max_memory_restart: '256M', // http 모드 — 읽기 사전 포함 RSS ≈50~100MB(dev 실측 48MB + numpy, task-012b). local 모드 전환 시 재산정
  // instances 1 고정 — 운영 권장 워커 1개(전사가 CPU 코어를 다 쓴다). SPEECH_WORKER_ID 는 사람이 읽는 이름 — 실제 claim 식별자는 기동마다 부트 nonce 를 붙인 인스턴스 id(REV-033 M1).
  // task-012b D-B1: DATABASE_URL 을 싣지 않는다(DB 접속 없음). 공용 패키지는 gateway 처럼 PYTHONPATH 로 읽는다.
  env: { ...pickNonEmpty(dotenv, ['DATA_ROOT','APP_ENV','SPEECH_INTERNAL_SECRET','SPEECH_CONFIG_PATH','APP_INTERNAL_URL','WHISPER_SERVICE_URL','SECRETS_DIR']),
         SPEECH_WORKER_ID: 'worker-1',
         PYTHONPATH: `${HERE}/speech/worker:${HERE}/speech/common`, PYTHONDONTWRITEBYTECODE: '1', PYTHONUNBUFFERED: '1' },
  kill_timeout: 70000,        // SIGTERM 뒤 지금 잡(분석 STT 60s)을 끝낼 시간 — 넘기면 15분 고아 회수(재기동 = 새 인스턴스 id 라 self-reclaim 대상 아님)
  out_file: `${LOG_DIR}/speech-worker-out.log`, error_file: `${LOG_DIR}/speech-worker-err.log`, merge_logs: true, log_date_format: 'YYYY-MM-DD HH:mm:ss',
}
```

venv 는 릴리스 밖 공유 자원이다(VoiceVault whisper 와 같은 등급: `requirements.txt` 변경 = 별도 승인 작업, 롤백으로 되돌아가지 않음). 설치: `~/.node-local/thekaiwa-speech/venv/bin/pip install -r speech/gateway/requirements.txt -r speech/worker/requirements.txt`(공용 패키지는 설치하지 않고 PYTHONPATH — task-003e). **task-012b**: worker requirements(pyopenjtalk)의 운영 venv 설치는 사용자 승인(U2), 개발·테스트는 별도 dev venv `~/.node-local/thekaiwa-speech-dev`(운영 venv 를 건드리지 않는다). 워커를 운영 pm2 에 등록하려면 `ecosystem.config.js`·`deploy.yml runtime.apps` 와 함께 저장소 밖 webhook 배포 스크립트(`~/.local/webhook-deploy/deploy-thekaiwa.sh` 의 `--apps`)도 바꿔야 한다 — 사용자 승인(U1).

M4 `kaiwa-tts` 배포는 home-m4-api 와 동일: NFS 가 아닌 로컬 `~/kaiwa-tts-run`(독립 clone) · `git push` 후 사용자 승인 게이트 · webhook-deploy 실패 시 롤백 · crontab `* * * * * ~/kaiwa-tts-run/scripts/kaiwa-tts-watchdog.sh` 가 `/health` 실패 시 재기동 · 로그는 `~/kaiwa-tts-local-logs/`. 상세는 [`speech/tts-service/README.md`](../../speech/tts-service/README.md).

### 5-3. 공통 admin 엔드포인트(gateway·tts-service — worker 는 제외, task-012b D-B4: 포트를 열지 않고 claim 하트비트로 생존을 알린다)

`GET /health`(모델 로드 여부·메모리·버전·uptime) · `POST /admin/log-level` · `POST /admin/config/apply`(RUNTIME_EDITABLE 키만 수용, RESTART_REQUIRED 는 422 로 거부하고 안내) · `GET /admin/config/effective`. 앱 `admin.getDiagnostics(connectionId)` 가 이 응답을 합쳐 보여 준다. 정본 계약은 `api-contract.md` 의 "서비스 내부 API" 절.

---

## 6. 플러그인 `@thekaiwa/sherpa-stt` 경계

| 경계 | 규칙 |
|---|---|
| 웹 번들 | `@capacitor/*`·`@thekaiwa/sherpa-stt` 를 **import 하지 않는다**. 같은 번들이 폰(WebView, `server.url` 로 운영 웹 로드)과 PC 브라우저에 함께 나가고, 플러그인이 빠진 APK 에서도 화면이 죽지 않아야 한다(VoiceVault `bridge.ts` 헤더 주석의 두 근거). |
| 접근 경로 | `src/modules/infra/native/bridge.ts` 의 `getSherpaStt()`(구현 이름 **`getOnDeviceStt()`**) 만이 `window.Capacitor.Plugins.SherpaStt` 를 읽는다. 필요한 메서드(계약 v1: `checkPermissions·requestPermissions·checkModel·downloadModel·start·stop·cancel·release·addListener`) 중 하나라도 없으면 `null`(반쪽짜리 플러그인으로 녹음 UI 를 띄우지 않는다). 타입은 `bridge.ts` 안에 손으로 옮겨 적는다(플러그인 `definitions.ts` 를 import 하지 않음). `window.Capacitor` 를 읽는 파일은 bridge 하나(경계 테스트 `infra/__tests__/nativeBoundary.test.ts`). |
| 호출자 | (task-003f Leader ⑥) 플러그인을 꺼내는 곳은 **`src/modules/speech/stt/client/onDeviceModel.ts`**(휴대폰 인식 파일 스토어 — 확인·받기·지우기·권한 조회·진단) **하나**이고, 온디바이스 클라이언트 `OnDeviceSttClient`(설계 이름 `OnDeviceSherpaClient`)는 스토어가 넘겨 준 플러그인만 쓴다. `speech/stt/client/**` 는 엔진명 0 경계 테스트 대상이라 중립 이름을 쓴다. 화면 컴포넌트는 `createRealtimeSttClient()`(경로 라우터)가 돌려준 `RealtimeSttClient` 와 스토어 훅(`useOnDeviceModel`)만 본다. |
| 모델 | APK 에 넣지 않는다. 사용자가 누를 때(자동 받기 없음, Leader ⑬) `GET /models/ondevice-ja-v1/manifest.json`(불투명 id — api-contract #9) → 파일별 `sha256` 검증 → `filesDir/models/<version>/` 에 원자적 배치(임시 디렉토리 → rename). 규약은 [`speech/models/README.md`](../../speech/models/README.md). |
| 런타임 설정 | `GET /api/v1/speech/config`(#19) 의 `onDevice.runtime`(`numThreads·decodingMethod·vad{silenceMs,threshold}·partial`)을 `start()` 옵션으로 전달하고, `onDevice.model.version`(서빙 manifest 의 version)과 `checkModel().version` 을 비교해 새 버전 받기를 권한다. `connectionKey`(불투명 id)는 #21 업로드에 그대로 돌려준다. 값의 출처는 ONDEVICE connection 의 `runtime` JSON(설정 해석 규칙 6순위). 앱 내 상수 없음. |
| 폴백 | 경로는 **누를 때마다** 고른다. 셀 수 있는 플러그인 오류가 **앱 실행 동안 2회**(`fallback.onDeviceFailureThreshold`) 누적되면 앱을 다시 켤 때까지 `WebSocketSttClient` 로 간다. `start()` 거부는 그 누름을 서버로 이어 간다. `recognitionMode=OFFLINE` 이면 전환하지 않고 텍스트 입력 폴백을 안내한다. 강제 업데이트 상태면 휴대폰 경로를 쓰지 않는다. 상세 `speech-platform/12` §3.5 각주. |
| 릴리스 | `plugins/**`·`android/**`·`capacitor.config.ts`·Manifest 가 바뀐 task 는 deployer 가 `scripts/build-apk.sh` 로 APK 를 새로 빌드·배포하고 `AppRelease` 행을 추가한다. 앱은 `GET /api/app/version`(#8)에 `App.getInfo().build`(versionCode, bridge `getAppInfo()` 경유)를 `X-App-Build` 로 보내 **번호로** 비교한 결과로 띠를 띄운다. |

상세(API 표·Kotlin 구성·실측 항목)는 [`plugins/sherpa-stt/README.md`](../../plugins/sherpa-stt/README.md).

---

## 7. 재사용 이식 매핑표

경로 치환 규칙(계획 §4): 계획서·design-spec 에 남은 `src/lib/{vocab,study,plan}/*` → `src/modules/learning/*`, `src/lib/{tutor,ai}/*` → `src/modules/conversation/*` + `src/modules/engine/adapters/llm/*`, `src/lib/{speech,stt,tts,native}/*` → `src/modules/speech/*` · `src/modules/infra/native`, `src/lib/engine/*` → `src/modules/engine/*`, `src/lib/{auth,db,jwt,session}` → `src/modules/infra/{auth,db,session}`. 아래는 치환을 마친 최종 경로다.

| 원본(형제 프로젝트) | 대상(TheKaiwa) | 유지 | 변경 |
|---|---|---|---|
| `TheMeal/src/lib/ai/claudeCli.ts` | `src/modules/engine/adapters/llm/claudeCli.ts` | argv 배열 spawn(셸 없음)·stdin 프롬프트·`cleanEnv`·`--tools` 화이트리스트 + `--permission-mode dontAsk`·2레인 큐·`--json-schema`·오류 클래스 4종 | `spawn` 은 `infra.runtime.spawnArgv` 경유; `--agents <json> --agent tutor`(bjj `claudeCli.js:65-89`)·`stream-json --verbose` NDJSON → `RequestTrace` step(bjj `:111-157`)·`maxTurns` 추가; **`--agents` JSON 에 model 을 싣지 않고 `--model` 이 권위**; `EngineProvider` 구현(`descriptor()`·`configurationSchema()`·`healthCheck()`=`claude --version`·`functionalTest()`=고정 JSON 스키마 1회) |
| `TheMeal/src/lib/ai/llmClient.ts` | `src/modules/engine/adapters/llm/homeM4.ts` | `node:http` + `timeout:0` Agent·system-first 강제(`assertSystemFirst`)·`X-API-Key`·예산 계수 | 회화·채팅 턴 금지(A10·보기 생성·폴백 후보만) — 라우터 표에서 `task ∈ {talk,chat,ask}` 에 이 connection 을 배정할 수 없게 `capabilities` 로 표기 |
| `TheMeal/src/lib/ai/{extractJson,schemaValidate}.ts` | `src/modules/engine/json/{extractJson,schemaValidate}.ts` | 그대로 | `--json-schema` 를 써도 ajv 재검증 유지 |
| `TheMeal/prisma/schema.prisma`(User·AppAuthCode 부분), `src/lib/auth/**`, `src/app/api/auth/**`, `src/middleware.ts`, `src/lib/{db,jwt,session}.ts` | `src/modules/infra/{auth,db,session}/**`, `src/app/api/auth/**`, `src/middleware.ts` | OAuth+초대코드+httpOnly JWT+앱 딥링크 60초 1회용 코드 | 쿠키 `thekaiwa_session`·스킴 `thekaiwa://`·착지 `/study/today`; `Role` 4단계·`OWNER_EMAIL`=`SUPER_ADMIN` 시드; `(admin)` 은 capability 없으면 404 |
| `TheMeal/next.config.ts` | `next.config.ts` | 보안 헤더 전부 | **`:28` `microphone=()` → `microphone=(self)`**(task-002 완료 기준 `curl -I` 검사) |
| `TheMeal/.claude/settings.json` | `.claude/settings.json` | 훅 4종 상대경로 | 없음(복사 완료) |
| `VoiceVault/src/lib/native/bridge.ts` | `src/modules/infra/native/bridge.ts` | `window.Capacitor` 전역만·"없으면 조용히" 원칙·`onAuthDeepLink` 콜드스타트 보정·`toWebFileSrc` | `RecorderPlugin`·`KeepAwakePlugin` 제거(녹음은 플러그인이 직접 `AudioRecord`), `SherpaSttPlugin` 인터페이스 + `getSherpaStt()` 추가, 코드 정규식은 그대로 |
| `VoiceVault/capacitor.config.ts:32-50` | `capacitor.config.ts` | `server.url`(punycode https)·edge-to-edge·`errorPath` | appId `com.miraclepenguin.kaiwa`, `server.url=https://kaiwa.xn--lh0b87pnudm10a4vd.com` |
| `VoiceVault/src/components/nav/KeyboardInset.client.tsx` | `src/components/shell/KeyboardInset.client.tsx` | 그대로 | 없음 |
| `VoiceVault/android/.../MainActivity.java`(onPause 쿠키 flush) | `android/app/src/main/java/com/miraclepenguin/kaiwa/MainActivity.java` | flush 로직 | 패키지명; `RECORD_AUDIO` 권한은 플러그인 Manifest 병합으로 |
| `VoiceVault/scripts/build-apk.sh` | `scripts/build-apk.sh` | NFS→미러 동기화·`cap sync`·gradle 로그 파일 출력(파이프 금지)·JDK 21 | `LOCAL_ROOT=~/.node-local/thekaiwa`; 빌드 후 `versionCode/versionName` 추출 → `DATA_ROOT/releases/thekaiwa-<versionName>.apk` 복사 + sha256 출력(deployer 가 `AppRelease` 에 기록) |
| `VoiceVault/src/lib/whisper/client.ts:250`(`transcribeChunk`) | `src/modules/engine/adapters/stt/whisperHttp.ts` | multipart POST `/transcribe-chunk`·타임아웃 | `EngineProvider` 구현; 앱에서는 Functional Test·Playground 용, 운영 분석은 worker 의 Python `WhisperEngine` |
| `VoiceVault/whisper-service/main.py` | `speech/gateway/app.py`, `speech/worker/main.py`(패턴만) | 모델 1회 로딩 싱글턴·`asyncio.Lock` 직렬화·개별 try/except 로딩(실패해도 `/health` 응답)·503 규칙·env 만 읽기 | gateway 는 WS 세션별 VAD 상태, worker 는 폴링 루프 |
| `VoiceVault/ecosystem.config.js`(`voicevault-whisper` 항목) | `ecosystem.config.js` | venv `uvicorn` 직접 실행(`interpreter:'none'`)·`readEnvFile/pickNonEmpty`·`LOG_DIR` 사전 생성·`max_memory_restart` 주석 관례 | 항목 2개(§5-2) 추가, 앱 항목은 `thekaiwa`/3010 |
| bjj `backend/src/services/masterChat.js:165-195, 282-435` | `src/modules/conversation/{orchestrator,window}/**` | `buildWindow`(최근 N개·문자 상한·한 줄 초과 절단)·`runTurn` 의 사용자당 락·`runningTurns` 레지스트리·SSE `track`(done/error 전에 레지스트리 삭제)·저장 순서 | Sequelize raw SQL → `infra.db`(Prisma, 소유 테이블만); 출력은 §67 구조화 응답; `Correction` PROPOSED 저장 |
| bjj `backend/src/services/gymMasterPersona.js` | `src/modules/conversation/persona/loader.ts` | frontmatter 제거·본문 로드·캐시 | `## N.` 절 필터, key `teacher-persona` 로 `promptRegistry` 에 v0 등록 |
| bjj `.claude/agents/gym-master.md` | `.claude/agents/tutor.md` | 절 구조 | 절 1~9(계획 §8) |
| bjj `web/src/contexts/MasterContext.jsx` | `src/components/talk/TurnContext.tsx` | SSE 끊김 → 폴링(2.5s→5s)·`visibilitychange` 재조회 | React Native 아님 → Next 클라이언트 컴포넌트 |
| bjj `web/src/components/SwipeCardDeck.jsx`, `pages/PickMeUpPage.jsx:9-15,129-149` | `src/components/vocab/SwipeCardDeck.tsx`, `src/modules/learning/vocab/setGenerator.ts` | 드래그 좌표 ref·탭 10px/위 −80/좌우 ±60 임계·3장 스택 transform·`touchend preventDefault`·`touchAction:none`·Fisher-Yates·제외집합·날짜별 저장 | TSX+Tailwind+PointerEvent, 위=flag, 좌=답한 뒤에만, 우=이전 카드 읽기 전용, 키보드 1~4; 정오답·보관은 신규 |
| home-m4-api `scripts/ai-api-watchdog.sh`, README §6 배포 절 | `speech/tts-service/scripts/kaiwa-tts-watchdog.sh`, `speech/tts-service/README.md` | 매분 `/health` → 실패 시 uvicorn 재기동·`.deploy.lock`(mkdir 락) 조율·로컬 로그 디렉토리 | 포트 8200·cwd `~/kaiwa-tts-run/speech/tts-service` |

---

## 8. 금기

1. **라우트·서버 컴포넌트·컴포넌트에서 `spawn`·`fetch`(외부)·prisma·네이티브 플러그인 직접 호출 금지.** 전용 모듈(`infra.runtime`, `infra.db`, `engine.adapters`, `infra.native.bridge`)만 이를 만진다. ESLint §3-2 가 강제.
2. **엔진명 분기 금지.** `reazon|whisper|style-bert|claude-cli|home-m4` 문자열은 `src/modules/engine/adapters/**` 와 `prisma/seed-data/engines.json`(+ `speech/**`) 에만 있다. 라우트·화면·L1~L4 는 역할(`REALTIME_STT/ANALYSIS_STT/TTS/LLM`)과 `connectionId` 만 안다. 사용자 화면에는 `connectionId` 도 노출하지 않는다(엔진명·`model_id`·`speaker_id` 노출 금지).
3. **클라이언트에 시크릿 없음.** 앱·플러그인이 받는 것은 `connectionProfileId`·`credentialRef` 이름·60초 티켓뿐. API Key·`JWT_SECRET`·`SPEECH_INTERNAL_SECRET` 값은 서버 env/`shared/secrets/` 파일에만 있고 `SecretResolver` 가 해석한다. Export 스냅샷·Trace·로그·`/api/v1/speech/config` 응답에 SECRET 키 값이 실리지 않는다.
4. **실시간 경로에 동기 분석 삽입 금지.** whisper 재분석·발음 분석은 `SpeechJob` 큐 → worker 에서만 돈다. 턴 라우트가 분석 결과를 기다리지 않는다(대화 LLM 은 항상 실시간 텍스트로 먼저 응답).
5. **원본 오디오를 LLM 에 전달 금지**, 원음·전체 대화 텍스트를 `RequestTrace`·로그·Export 에 저장 금지(`DebugSession` 의 명시적 `captureAudio/captureText` 에서만).
6. **`ConfigurationVersion` 없는 설정 변경 금지.** 관리자 경로의 모든 변경(Connection·Fallback·Prompt·AppSetting·VoiceProfile·Preset)은 `engine.configuration.apply` 를 거쳐 새 버전을 만든다. Rollback 도 새 버전. (task-012c D-C5, 2026-09-29: engine 은 `AppSetting`(preferences)·`VoiceProfile`(speech) 을 import 할 수 없으므로, 관리자 적용은 **`admin/configuration`(L0)이 `infra.withTransaction` 하나를 열고** 대상 소유 층의 tx 쓰기 함수 + `engine.configuration` 의 버전 기록 + `infra.audit` 를 부른다 — 발음 사전(task-003g)과 같은 조합. `engine.configuration` 은 검증·Diff·버전 기록만 소유한다.)
7. **역방향 import 금지.** 하위 층이 상위 층 타입을 필요로 하면 설계 오류다 — 콜백 인자·이벤트·라우트 조합으로 되돌린다.
8. **다른 층 테이블 직접 접근 금지.** `speech` 가 `UserVoiceSetting` 을 읽고 싶으면 `preferences.getVoiceSetting`, `admin` 이 `VoiceProfile` 을 바꾸고 싶으면 `speech.disableVoice`.
9. **`tts-service` 가 `speech/common` 을 import 하는 것 금지**(AGPL 경계 유지). 앱·gateway·worker 는 tts-service 를 HTTP 로만 부른다. SBV2 원 API(`/voice`, `/models/info`) 를 앱·모바일이 직접 호출하지 않는다(§35).
10. **KST 날짜는 서버가 정한다.** 클라이언트가 보낸 날짜를 학습 기록의 키로 쓰지 않는다(`infra.dates.kstToday`).

---

## 9. 미결

| # | 항목 | 현재 결정(임시) | 확정 시점 |
|---|---|---|---|
| 1 | gateway 의 "TTS 프록시" 실체 | Phase 1 의 TTS 호출은 **앱 어댑터 `styleBertHttp` → M4 직접** 한 경로. gateway `POST /tts` 는 WS 세션 안에서 문장 오디오를 푸시하는 **Phase 4 슬롯**(웹 폴백의 HTTP 왕복 절감). 채택 시 `EngineConnection(style-bert-gateway, HTTP→127.0.0.1:8100/tts)` 을 추가해 Fallback Policy 로 고르며 라우트 변경 없음 | 음성 P4 |
| 2 | `speech/gateway/interfaces.py` 위치 | 골격은 gateway 에 두고(이 세션 산출) 구현 시 `speech/common/engine/interfaces.py` 로 이동, gateway 는 re-export | task-003 |
| 3 | 설정 스키마 JSON 의 단일 파일 공유(TS·Python) | 문서 `speech-platform/07` 이 정본, 코드는 양쪽이 각자 옮겨 적고 Functional Test 로 대조 | task-003 실측 후 |
| 4 | `conversation → learning` 허용 범위 | 읽기 함수 4종만. 쓰기가 필요해지면 라우트 조합으로 | task-006 리뷰 |
| 5 | Python 서비스가 8층 Resolver 를 직접 미러링 vs 앱 `GET /api/internal/speech/config` 로 Effective 를 받아오기 | 미러링(각 서비스가 yaml·env·DB 를 읽음). 불일치 사고가 나면 후자로 전환 | task-003 |
| 6 | 큐 = MariaDB `SpeechJob` 폴링 | 처리량 문제 시 Redis(사용자 sudo). `infra.jobs` 인터페이스는 큐 구현을 숨긴다 | 음성 P2 실측 |
| 7 | `/models/*` 서빙 주체 | 운영 nginx `alias DATA_ROOT/models/`(Range 지원), 개발은 `src/app/models/[...path]/route.ts` 폴백 | task-003 |
| 8 | 온디바이스 WASM(브라우저) 경로 | `RealtimeSttClient` 세 번째 구현 슬롯(`WasmSherpaClient`)만 예약 | 음성 P4 |
| 9 | Admin Web 의 별도 앱 분리 | `(admin)` 라우트 그룹 + `modules/admin` 이 경계라 분리 시 라우트만 옮기면 됨 | 음성 P4 |


## 10. 제안 모듈 (3차 보완 2026-09-26 — 사용자 결정 필요 항목은 표기, 반복 학습은 결정 완료)

정본 `../learning-personalization-and-llm-data.md` 와 짝. 행렬(§3)은 변하지 않는다 — 전부 L3 `learning` 안의 하위 모듈이거나 conversation→learning **읽기** 함수 추가다.

| 모듈 | 위치 | 공개 API(index.ts) | 소유 테이블 | 상태 |
|---|---|---|---|---|
| `learning/repetition` | L3 | `registerRepetitionItems(userId, items[], tx)`(레슨 complete·교정 accept·세트 finish 트랜잭션에서 호출) · `recordRepetitionOutcome(userId, itemId, {outcome, feedback}, tx)` · `listDueItems(userId, date)` · `sampleReviewSession(userId, items, dailyMinutes, seed)`(균등 랜덤: `1/(1+studiedCount)×(FOCUS?2:1)`) · `applyTutorDecision(userId, decisions[])`(3~7 클램프·FOCUS ≤3·`decidedBy` 기록) · `fallbackDecision(userId, items)` · `enqueueReviewDecision(userId)`(`AiJob(REVIEW_DECISION)`) | `RepetitionItem`, `ReviewSchedule`(기존) | **결정 완료**(R-1). Phase 2 |
| `learning/scenarios` | L3 | `listScenarios(userId, {topicId?, level?, recommended?})` · `getScenario(id)` · `createScenario` · `evaluateScenarioCompletion(chatId)`(핵심 표현 사용·목표 발화·강사 `goalAchieved` 결합) | `Scenario`, `ScenarioTopic` | 사용자 결정 필요(도입 Phase) |
| `learning/observations` | L3 | `recordObservation(userId, obs, tx)`(kind·outcome·latency·confidence·refId) · `listObservations(userId, range)` | `LearningObservation` | 사용자 결정 필요 |
| `learning/skills` | L3 | `updateSkillState(userId, observations[])`(결정적: 지수이동평균+신뢰도 가중, 채택만으로 상향 금지·REUSED 필요) · `getSkillState(userId)` · `pickTaskCandidates(userId, skill)`(실패→−1/단서, 2회 성공→+1/도움 감소) | `LearnerSkillState` | 사용자 결정 필요 |
| `learning/recordRetrieval` | L3 | `retrieveRecords(userId, intent, scope)` — 화이트리스트 함수 조합만: `getProgressSummary(range)` · `getDueReviews()` · `getRecentCorrections(filter)` · `findExpressions(query, range)` · `getLessonsByTopic(topicId)` · `getSkillState()`; 결과 ≤2,000자·건수 상한·`sourceRef{type,id,date,label}` 첨부 · **LLM 이 SQL 을 만들거나 실행하지 않음**, userId 는 세션 주입 | (읽기 전용: 위 L3 테이블) | Phase 3a |
| `learning/knowledge` | L3 | `retrieveKnowledge(userId, query)`(기존 슬롯) — 3c 에서 로컬 임베딩(home-m4 `bge-m3` + Qdrant 컬렉션 `thekaiwa_<userId>`) 구현, 대상은 채택 교정·레슨 표현·요약(대화 전문 아님) | (없음) | 조건부(정형 조회로 못 푸는 질문 ≥20% 실측) |
| `conversation/askRouter` | L2 | `classifyIntent(text)`(PROGRESS/EXPRESSION/GENERAL/MIXED) — 규칙 우선, 필요 시 LLM 1회 | — | Phase 3a |

- 라우트 조합 시퀀스 추가: **복습 판단** = `learning.completeLesson` 트랜잭션 → `learning.enqueueReviewDecision` → 잡 러너가 `conversation.getActivePrompt('reviewDecision')`+`learning.listDueItems` 로 A11 호출 → `learning.applyTutorDecision`(클램프) → 실패 시 `fallbackDecision`. **ASK** = `conversation.askRouter.classifyIntent` → `learning.retrieveRecords` → `conversation.buildTurnContext`(기록 ≤2,000자 삽입) → 턴.
- 금기 추가: `retrieveRecords` 결과를 프롬프트에 넣을 때 이름·이메일·id 를 가명화하고 원문 대화는 발췌 ≤300자, Trace 에는 개수·해시만.

## 11. TTS 플랫폼 계층 (5차 기획안 §129~§163, 2026-09-26)

정본 `../speech-platform/16-tts-productization-layer.md`. 층 배치는 그대로: **TTS Platform = L4 `speech/tts`**, **Engine Adapter = L5 `engine/adapters/tts`**, 엔진은 M4 `speech/tts-service`(자체 FastAPI, `style_bert_vits2` 라이브러리 직접 사용).

| 컴포넌트(§160) | 위치 | 공개 API / 책임 | Phase |
|---|---|---|---|
| `JapaneseTextNormalizer` | `speech/tts/normalizer` | `normalize(text, {context}) → {normalizedText, decisions[]}` — 숫자·날짜·시간·단위·Counter·기호·영문·외래어·고유명사·약어 읽기 결정, 엔진 정규화에 의존하지 않음 | P0 |
| `PronunciationLexiconService` | `speech/tts/lexicon` | `applyLexicon(normalizedText, scopeCtx) → {text, applied[], dictionaryVersion}` · `getActiveVersion()` · admin: `upsertEntry`·`disableEntry`·`import`·`export`·`createVersion`·`rollback(v)`·`preview` | P0 |
| `SpeechRenderingPlan` | `speech/tts/renderingPlan` | `buildPlan({text, responseMeta, speechProfile, userSetting, voiceProfile, personaHint}) → RenderingPlan{voiceId, profile, segments[{text, style, speed, pauseBeforeMs, emphasis?}]}` — 엔진 독립 표현만 | P0 |
| `TTS Parameter Resolver`(기존) | `speech/tts/parameterResolver` | 값 우선순위(User > VoiceProfile > Persona > Context > LLM) 결정 → **출력은 RenderingPlan** | 기존 |
| `SpeechProfile` | enum(L1 `UserVoiceSetting.speechProfile`) + `speech/tts/profiles`(프로필→기본 speed/style 매핑표) | NATIVE·LEARNING_NORMAL·LEARNING_SLOW·PRONUNCIATION·SHADOWING | P0 |
| `TtsChunkScheduler` + `sentenceDetector` | `speech/tts/chunkScheduler/{index,sentenceDetector}` | 문장 감지(。！？…·닫는 괄호, ≤100자 초과 시 、 2차 분할, 4자 미만 병합, 정규화 전 원문 + token map) → 청크 0 즉시·이후 큐(동시 1~2) → 캐시 HIT 는 합성 없이 즉시 → SSE `audio{chunkIndex,…,last,status}` emit, TTFA 계측, 새 턴 시 대기 청크 취소 | P0 |
| `TtsAudioCache`(기존 확장) | `speech/tts/cache` | 키 12요소(정규화 텍스트·모델 버전·사전 버전·프로필 포함), `dictionaryVersion`/`modelVersion` 구버전 purge | P0 |
| `TtsRuntimeStatus` | `speech/tts/status` + 클라 `TtsRuntimeStatusIndicator` | 라우터 선택 결과 기반 `executionMode`·`fallbackReason` 계산·캐시, `GET /api/v1/speech/tts/status` | P0 |
| `TtsPlaybackQueue` | 클라 `speech/tts/TtsPlaybackQueue`(기존 `TtsPlayer` 대체) | `chunkIndex` 순 재생(먼저 온 HIT 는 버퍼)·다음 URL 프리페치·profile gap + `pauseBeforeMs`·새 턴/이탈/모드 전환 시 큐 비움·`clientTimings{playbackStartDelayMs, firstAudioAtMs}` 를 다음 턴 요청에 동봉 | P0 |
| `TtsMetricsCollector` | `engine/metrics` 확장 + `speech/tts/metrics` | TTFA·합성 지연·오디오 길이·RTF·큐 대기·모델 로드·재생 시작 지연 → `RequestTrace` sub-steps + `EngineMetricsDaily` TTS 컬럼 | P1 |
| `TtsTimingMetadata` | `speech/tts/timing`(narabas 정렬은 Python `speech/worker` 잡) | 합성 wav + 텍스트 → words/moras/phonemes 타이밍 → `TtsCache.timing` | P1 |
| `TtsGoldenDataset`·`TtsQualityEvaluator` | `admin/playground` + `speech/tts/quality` + Python `speech/worker` 잡 | Golden 문장 관리·회귀 실행·A/B blind compare | P1 |
| `VoiceModelVersion`·`VoiceDeploymentPolicy` | `speech/voices/versions` + `engine/router`(Canary 세션 배정) | 버전 상태 전이·Canary %·Promote(SUPER_ADMIN) | P1 |
| 어댑터 매핑 | `engine/adapters/tts/styleBertHttp` | RenderingPlan 세그먼트 → SBV2 파라미터(예: ENCOURAGING → style Friendly·style_weight 0.8·intonation_scale 1.1 / SLOW → length 1.25 / EMPHASIS → intonation_scale 1.2·앞뒤 pause) — 매핑표는 어댑터 `descriptor().capabilities` 와 함께 코드 소유, 다른 엔진은 다른 매핑 | P0 |
| `OnDeviceTtsRuntime`·`TtsModelOptimizer` | (research) `plugins/sherpa-tts?` | ONNX 최적화·양자화·모바일 런타임 평가(§156~§157 기준) | P2 |

- import 행렬 불변: `speech/tts/*` → `engine`(어댑터·router·trace) → `infra`. Admin 화면은 L0 `admin/{speech/lexicon, speech/quality, voices/versions, diagnostics/tts}` 조합 모듈이 `speech/voices`·`speech/tts`·`engine/metrics` 를 호출. Python `speech/tts-service` 는 `style_bert_vits2`·narabas·pyopenjtalk 를 직접 import 하고 `speech/common` 은 import 하지 않는다(§5 원칙 유지). `EngineDescriptor.capabilities` 에 `SUPPORTS_STYLE·SUPPORTS_INTONATION·SUPPORTS_PITCH·SUPPORTS_USER_DICT·SUPPORTS_TIMING` 추가(speech-platform/05 §3.3). `conversation` 은 여전히 `speech` 를 import 하지 않고, 턴 라우트가 `structuredResponse → chunkScheduler` 를 잇는다.
- 금기 추가: 라우트·LLM·클라이언트가 SBV2 파라미터명(`style_weight`, `length`, `pitch_scale`…)을 다루지 않는다(어댑터 전용). 정규화·사전 결과(`normalizedText`)는 캐시 키·Trace 해시에만 쓰고 원문은 Trace 에 남기지 않는다.
