---
tags:
  - type/board
---
# 칸반 보드

> 현재 상태·인수인계는 [[ACTIVE]] 참조. 설계 과정 전체 기록은 [[task-001-initial-planning]].

## Done
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
- [[task-009-release-cutover]] — Phase 1 통합: 운영 blue/green 컷오버(미러 → 릴리스)·APP_ENV=PRODUCTION·운영 E2E·롤백 리허설 (2026-09-28 착수)
- [[task-003f-android-ondevice-stt]] — 안드로이드 앱(현 1.0.1 Lingofy Japanese)·온디바이스 STT — 팀 작업·운영 반영 완료, **사용자 폰 F6 실측 대기**(nginx 재적용 ✅ 2026-09-28)

## Backlog (Phase 1, 순서·의존은 design-spec §15)
- task-003 — 온디바이스 STT 플러그인(Kotlin+sherpa-onnx) + gateway 폴백 + **M4 tts-service 자체 FastAPI(정규화·발음 사전 P0·SpeechProfile·RenderingPlan·캐시 키 12요소)** + Capacitor 셸 + **§9 실측 게이트 6항목 + TTFA** (002 후, 003·004·005 병렬)

## 개선 백로그 (사용자 점검분 — task-009 완료 전 착수 금지)
- `/개선작업` 으로 추가·조회. 항목은 `improvements/items/`, 표는 `improvements/improvements.base`, 규칙은 [[improvements/README|README]]. 구현팀은 건드리지 않는다.

## 정리 backlog (소규모)
- (005b) 발음 사전(Pronunciation Dictionary P0) — task-003 이후 · #93b credentialRef 쓰기·functional test 30초 슬롯 원자성 — Phase 2(012c) · 운영 APP_ENV=LOCAL·dev 상태 점검이 운영 connection 행을 바꾸는 문제 — task-009
- `infra/http.ts` 기본 오류 문구 "AI 엔진…" 사용자 노출 가능 · 공용 `Badge` warn/accent·`ink3` 라이트 명암비 미달 · `ComingSoon` Phase/task 번호 노출
- `conversation/persona/loader.ts` 동적 `statSync` → 빌드 "프로젝트 전체 추적" 경고(정적 경로 또는 `outputFileTracingExcludes`) · webpack dev 에서 `crypto` 해석 실패(Turbopack 기본은 정상)

## Phase 2 이후
- 010 주제·상황(결정 시)·오늘의 회화(청취 구간·단어 메모·nextPreview)·**반복 학습(RepetitionItem·A11 강사 판단 3~7일)** · 011 AI평가 · 012 달력 · 012b 음성 P2(worker·SpeechJob·Comparator) · 012c Console P2(편집·Diff·Version·Rollback·Prompt Registry·Playground) · 013 분석·성장기록 · 014 서랍장 전체 · 015 무엇이든 물어보세요(3a→3b MCP) · 015b 음성 P3(PronunciationAnalyzer) · 016 음성 P4(Voice Package Import·스타일·Preset·Override)

## 미결정
- **TTS 5차 보완**: 발음 사전 적용 방식(플랫폼 치환 vs SBV2 user_dict 병행) / Timing 산출(narabas vs VITS duration) / TTS P1(품질·버전·지표) Phase 2 vs 4 / TEXT_ONLY UX / 온디바이스 TTS research 조건 → [[task-003c-tts-productization-design]]
- `Scenario`·`LearnerSkillState`·`LearningObservation` 도입 Phase / 개인 기록의 Claude CLI 전송 범위 / 의미 검색 도입 조건 / M4 LoRA 실험 조건 → `learning-personalization-and-llm-data.md` §8
- Style-Bert-VITS2 기본 모델 화자 id 매핑(Haruka/Sakura/Takumi 표시명 ↔ speaker) — task-003 실측 후
- `EngineMetricsDaily` 물화 vs 뷰 — Phase 3 진입 시
- Redis 도입 여부 — SpeechJob 처리량이 문제될 때만
