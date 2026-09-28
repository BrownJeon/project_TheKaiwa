---
tags:
  - type/board
---
# 칸반 보드

> 현재 상태·인수인계는 [[ACTIVE]] 참조. 설계 과정 전체 기록은 [[task-001-initial-planning]].

## Done
- [[task-012b-speech-p2]] — **음성 P2 1단계: 분석 STT 파이프라인**(2026-09-29). SpeechJob 적재 게이트·사용자별 디바운스(+20s·상한 5분)·claim SKIP LOCKED+재검사·self-reclaim(인스턴스 id)·#138~#140·#22·#21a·health `stt_analysis_worker`·D-B7 평가 텍스트·Python 워커(whisper_http·pyopenjtalk 비교기). REV-033·Codex C2 2건 수정·QA(운영 모드) PASS, 운영 반영 `8af4542`(007 44/44·011 60/60). **워커 운영 등록 U1·U2 사용자 승인 대기**
- [[task-010-today-lesson]] — **Phase 2 오늘의 회화(레슨)**(2026-09-28). 주제/붙여넣기 → A4 5단계(듣기·메모 제안·퀴즈 첫 답 고정·응용·말하기 3과제+발화 연결) → 완료 한 트랜잭션(StudyLog·스냅샷·RepetitionItem 3일)·nextPreview, 오늘 홈 카드. REV-028~031·Codex C2 2건 수정(2차 0)·QA 65/65·UI E2E 61/61, 운영 반영 `67771a5`·운영 스모크 65/65. 붙여넣기 A4 신뢰도 관찰 중
- [[task-018-db-structure-hardening]] — **DB 구조 보강 3건**(2026-09-28, 사용자 승인): Utterance.chatId·chatMessageId unique / ConfigScope LEXICON / LexiconVersion.rollbackOf — 백업→db push→REV-026→webhook 배포 ok·운영 44/44
- [[task-009-release-cutover]] — **운영 blue/green 컷오버·APP_ENV=PRODUCTION**(2026-09-28). `/home/brownjeon/apps/thekaiwa` 릴리스 운영(앱+gateway), 첫 배포 ok·롤백 리허설 통과, 운영 E2E 단어 74·채팅 41·회화 37·음성 3/3, health 필수 503 게이트
- [[task-003h-app-branding]] — **앱 이름 Lingofy Japanese·부제 「일본어가 자연스러워지는 AI 회화」**(2026-09-28). 웹·앱 1.0.1(versionCode 2) 운영 반영, REV-024 PASS
- [[task-003g-lexicon-admin]] — **발음 사전 관리**(2026-09-28). 콘솔 API 9라우트+화면(검색·추가·수정·끄기·미리듣기 비교·Import dryRun/Export·버전 diff·Rollback), 버전+감사 한 트랜잭션·환경 잠금·스냅샷 무결성. REV-017~020·Codex C2 1 반영·QA-017 PASS·화면 E2E 55/55, 운영 반영
- [[task-007-talk-voice-web]] — **AI 회화(음성) 웹 경로**(2026-09-28). 푸시투토크→턴→문장별 청크 TTS(SSE audio)·재생 큐·barge-in·교정 카드 즉시, 예열 CLI·첫 문장 조기 합성으로 손 뗌→첫 음성 바이트 p50 ≈1.8~2.1s, #24 서명 URL·발화 1회 연결. Codex C1 3·C2 2 반영, REV-014~016·QA-016 PASS, 화면 E2E 40/40, 운영 반영·운영 스모크 37/37
- [[task-003e-stt-gateway-web]] — **STT gateway + 웹 음성 인식 + 마이크 테스트**(2026-09-28). pm2 `thekaiwa-speech-gateway`(127.0.0.1:8100, nginx wss), 60초 1회 티켓·Origin 허용 목록·발화 저장/콜백, 합성 20문장 CER 0.57%·final p50 63ms. REV-013→Codex C2 2건→QA-015 PASS, 운영 E2E 215ms
- [[task-003d-tts-p0]] — **TTS P0**(2026-09-27). M4 자체 FastAPI(`:8200` 상시·pf·워치독) + 앱 TTS 플랫폼(정규화·사전·Rendering Plan·Profile·12요소 캐시·상태 판정)·미리듣기·상태 표시등. Codex C1·C2(보안) 각 3건 반영, QA-014 재확인 PASS, 합성 p50 716ms·HIT 24ms. 운영 반영 완료
- [[task-005b-admin-console-skeleton]] — **Admin Console 골격**(2026-09-27). 권한 매트릭스·404/403·Effective Config+출처·Plugins/Connections·Health/Functional Test·Trace·비밀 이름만+감사, 콘솔 화면 14. REV-009+Codex C2(보안)→수정→QA-013(터치 44px)→수정→PASS. 발음 사전·#93b 이월. 19:15 운영 반영
- [[task-008-vocab-today-words]] — **단어장 최소판 + 오늘의 단어**(2026-09-27). 라우트 18(#40~#46b·#47~#54)·가중 샘플링·정답 미노출·서버 채점·finish 단일 트랜잭션·A10 초안, 화면(단어장·오늘 홈·스와이프 덱·결과). REV-008(H1 수정)→PASS·QA-012 PASS(2프로세스 실경합·실브라우저 3폭). 운영 반영(18:26)·Codex C2 지적 2건 수정
- [[task-006-chat-correction]] — **AI 채팅 + 표현 점검 + 교정 채택**(2026-09-27). 서버 13라우트·SSE 턴·사용자당 락·점검(동기/잡)·채택 트랜잭션, 화면 3종. REV-007 PASS_WITH_NOTES·QA-011 PASS(결함 0, 2프로세스 경합 실증). 운영 반영(18:26)·Codex C2 지적 0
- [[task-017-dev-env-judge-codex]] — **개발환경 개선 선도입**(2026-09-27): judge(Jev 판정)·codex(외부 검토) 에이전트 적용, 공용 도구·템플릿, 테스트 18건·독립 리뷰 PASS. 실제 호출 검증은 task-006 진행 중
- [[task-005-settings-attendance]] — **설정 허브·출석**(2026-09-27). API 7개·설정 화면 4섹션·AttendancePing, reviewer 2회(High 1 포함 8건 수정)·QA 9항목 PASS. 미리듣기 소리는 task-003 후
- [[task-004-ai-client-persona]] — **AI 클라이언트·페르소나 로더·프롬프트 3종**(2026-09-27). CLI 지연 원인 2개 해소 → 회화 턴 p50 5.1s·검출 16/16·오탐 0/4, reviewer 2회(Critical 1 수정)·QA 9항목 PASS. 4s 목표·qwen 비교는 후속 → [[llm-japanese-quality]]
- [[task-002-phase0-scaffolding]] — **Phase 0 스캐폴딩 완료**(2026-09-26). 인증 이식·6층 골격+ESLint 경계·앱 셸 5탭·seed·pm2 `thekaiwa` 기동, reviewer 2회·QA 11항목 PASS. 폰 로그인 육안 확인·첫 로그인 후 재시드 남음
- [[task-003c-tts-productization-design]] — **TTS 상용 벤치마크 보완 설계**(5차 기획안 §129~§163, 2026-09-26). TTS Productization 층(발음 사전+버전·정규화·Rendering Plan·SpeechProfile 5종·청크 스트리밍·상태 표시등 = P0 / 관측·타이밍·품질·버전/Canary = P1 제안 / 온디바이스 = P2). SBV2 원 서버 실측 → M4 자체 래퍼. 정본 48→50 모델. 코드 없음
- [[task-003b-tutor-persona-v1]] — **강사 역할정의·페르소나 v1 + 학습 설계 보완**(2026-09-26). 기획서 대조 15건 → 사용자 결정(스케줄 주체=강사, 3~7일 판단·균등 랜덤·FOCUS, 청취 구간·단어 메모·종료 지점). `tutor.md` v1·검증 세트·`learning-personalization-and-llm-data.md`·정본 갱신·정합성 17건. Git 원격 연동 ✅. 코드 없음
- [[task-001-initial-planning]] — **초기 기획·설계 확정**(2026-09-26). 기획서 4종 통합 → `design-spec.md` + 정본 5종 + 설계 문서 33종, 팀 7인 + 강사 페르소나, Agent Vault 구성. 코드 없음.

## Doing
- task-012b-2·-3·-4 — 음성 P2 후속(재확인 카드·발화 로그 화면=데모 / TTS 지표=DB 추가 / 타이밍=M4 설치) — 승인 뒤 착수
- [[task-010b-repetition]] — 반복 학습(RepetitionItem 3경로·LearningObservation·A11·오늘의 복습·A5): 데모 v1(delta) ∥ PE A11·A5 — **스키마 push 사용자 승인 대기 예정**
- [[task-010c-correction-mode]] — 교정 방식(유창성 기본·코치 힌트): 데모 v1(delta) · PE talk@v3(A11 뒤) — **스키마 push 승인 대기 예정**
- [[task-011-ai-evaluation]] — AI 평가(A6·A7·기록률 100%): **서버·프롬프트 운영 반영(67771a5, 운영 61/61)** · 화면은 데모 v1(full) **사용자 승인 대기** · DB `EvaluationItem.textRevealedAt` 승인 대기
- [[task-012-calendar]] — 달력(계획표 탭·기록 삭제 스냅샷 불변): **서버 운영 반영(67771a5, 운영 32/32)** · 화면은 데모 v1(full) **사용자 승인 대기**
- [[task-012c-console-p2]] — Console P2 1단계(설정 Form/Raw JSON 편집·Validate/Test/Diff/Apply·ConfigurationVersion·이력·Rollback·credentialRef 연결·PRODUCTION 보호, 스키마 0): judge R2·opus·demo **full** · **C1 확정(D-C1~C12, D-C13 은 U-C1 대기)** · Codex C1 지적 3건 채택·정본 반영 → **C1 종결** · 정본 갱신 완료 · designer 데모 v1 → 사용자 승인 대기 · developer A 인계 작성(012b 커밋 뒤 착수, 첫 커밋 = D-C3 선결 게이트). 후속 분할 012c-2(Prompt Registry+Playground)·012c-3(TTS Quality+대시보드, DB 추가), Voice Versions·Canary 는 Phase 4 이관 권고(U-C1)
- [[task-010d-scenario-roleplay]] — 상황 역할극(Scenario 10개·코치·종료 판정): 데모 v1(full) — 구현은 010b·010c 뒤, **스키마 push 승인 대기 예정**
- [[task-003f-android-ondevice-stt]] — 안드로이드 앱(현 1.0.1 Lingofy Japanese)·온디바이스 STT — 팀 작업·운영 반영 완료, **사용자 폰 F6 실측 대기**(nginx 재적용 ✅ 2026-09-28)

## Backlog (Phase 1, 순서·의존은 design-spec §15)
- task-003 — 온디바이스 STT 플러그인(Kotlin+sherpa-onnx) + gateway 폴백 + **M4 tts-service 자체 FastAPI(정규화·발음 사전 P0·SpeechProfile·RenderingPlan·캐시 키 12요소)** + Capacitor 셸 + **§9 실측 게이트 6항목 + TTFA** (002 후, 003·004·005 병렬)

## 개선 백로그 (사용자 점검분 — task-009 완료 전 착수 금지)
- `/개선작업` 으로 추가·조회. 항목은 `improvements/items/`, 표는 `improvements/improvements.base`, 규칙은 [[improvements/README|README]]. 구현팀은 건드리지 않는다.

## 정리 backlog (소규모)
- (REV-035 재검 Low) Claude CLI 자식 env 허용 목록의 프록시 키(`HTTP(S)_PROXY` 등) — 쓰지 않으면 빼거나 userinfo 제거 · 운영 반영 뒤 006/007/008 운영 스모크로 CLI 가용성 재확인
- (REV-034) ESLint 6층 규칙이 **상대경로 교차 모듈 import**(`../../engine/...`)를 못 잡는다 — 규칙 보강 · A4 스키마 밖 필드 제거를 WeakSet 전역 등록 대신 `LlmJsonRequest.stripAdditionalProperties` 요청 옵션으로 전환
- (005b) 발음 사전(Pronunciation Dictionary P0) — task-003 이후 · #93b credentialRef 쓰기·functional test 30초 슬롯 원자성 — Phase 2(012c) · 운영 APP_ENV=LOCAL·dev 상태 점검이 운영 connection 행을 바꾸는 문제 — task-009
- `infra/http.ts` 기본 오류 문구 "AI 엔진…" 사용자 노출 가능 · 공용 `Badge` warn/accent·`ink3` 라이트 명암비 미달 · `ComingSoon` Phase/task 번호 노출
- `conversation/persona/loader.ts` 동적 `statSync` → 빌드 "프로젝트 전체 추적" 경고(정적 경로 또는 `outputFileTracingExcludes`) · webpack dev 에서 `crypto` 해석 실패(Turbopack 기본은 정상)

## Phase 2 이후
- 순서(2026-09-28 사용자 결정 반영, design-spec §15): **010 오늘의 회화** → **010b 반복 학습**(RepetitionItem 3경로·`LearningObservation` 기록·A11·오늘의 복습·A5) → **010c 교정 방식 설정**(`Profile.correctionMode` FLUENCY 기본) → **011 AI평가** → **012 달력** → **010d 상황 역할극**(Scenario, Phase 2 후반) → 012b 음성 P2 → 012c Console P2
- Phase 3: 013 분석·성장기록(+`LearnerSkillState`) · 014 서랍장 전체 · 015 무엇이든 물어보세요(3a→3b MCP, **D2 외부 전송 범위 결정 필요 — 이때 사용자에게**) · 015b 음성 P3 · 016 음성 P4

## 미결정
- **TTS 5차 보완**: 발음 사전 적용 방식(플랫폼 치환 vs SBV2 user_dict 병행) / Timing 산출(narabas vs VITS duration) / TTS P1(품질·버전·지표) Phase 2 vs 4 / TEXT_ONLY UX / 온디바이스 TTS research 조건 → [[task-003c-tts-productization-design]]
- ~~`Scenario`·`LearnerSkillState`·`LearningObservation` 도입 Phase~~ ✅ 2026-09-28 결정(D1 010d·D5 관측만 010b·D6 010c) / 개인 기록의 Claude CLI 전송 범위(D2, task-015 때) / 의미 검색 도입 조건 / M4 LoRA 실험 조건 → `learning-personalization-and-llm-data.md` §8
- Style-Bert-VITS2 기본 모델 화자 id 매핑(Haruka/Sakura/Takumi 표시명 ↔ speaker) — task-003 실측 후
- `EngineMetricsDaily` 물화 vs 뷰 — Phase 3 진입 시
- Redis 도입 여부 — SpeechJob 처리량이 문제될 때만
