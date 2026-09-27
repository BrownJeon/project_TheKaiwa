---
tags:
  - type/board
---
# 칸반 보드

> 현재 상태·인수인계는 [[ACTIVE]] 참조. 설계 과정 전체 기록은 [[task-001-initial-planning]].

## Done
- [[task-006-chat-correction]] — **AI 채팅 + 표현 점검 + 교정 채택**(2026-09-27). 서버 13라우트·SSE 턴·사용자당 락·점검(동기/잡)·채택 트랜잭션, 화면 3종. REV-007 PASS_WITH_NOTES·QA-011 PASS(결함 0, 2프로세스 경합 실증). **운영 반영(pm2 재시작) 사용자 결정 대기**·Codex C1/C2 한도 충전 후 재확인
- [[task-017-dev-env-judge-codex]] — **개발환경 개선 선도입**(2026-09-27): judge(Jev 판정)·codex(외부 검토) 에이전트 적용, 공용 도구·템플릿, 테스트 18건·독립 리뷰 PASS. 실제 호출 검증은 task-006 진행 중
- [[task-005-settings-attendance]] — **설정 허브·출석**(2026-09-27). API 7개·설정 화면 4섹션·AttendancePing, reviewer 2회(High 1 포함 8건 수정)·QA 9항목 PASS. 미리듣기 소리는 task-003 후
- [[task-004-ai-client-persona]] — **AI 클라이언트·페르소나 로더·프롬프트 3종**(2026-09-27). CLI 지연 원인 2개 해소 → 회화 턴 p50 5.1s·검출 16/16·오탐 0/4, reviewer 2회(Critical 1 수정)·QA 9항목 PASS. 4s 목표·qwen 비교는 후속 → [[llm-japanese-quality]]
- [[task-002-phase0-scaffolding]] — **Phase 0 스캐폴딩 완료**(2026-09-26). 인증 이식·6층 골격+ESLint 경계·앱 셸 5탭·seed·pm2 `thekaiwa` 기동, reviewer 2회·QA 11항목 PASS. 폰 로그인 육안 확인·첫 로그인 후 재시드 남음
- [[task-003c-tts-productization-design]] — **TTS 상용 벤치마크 보완 설계**(5차 기획안 §129~§163, 2026-09-26). TTS Productization 층(발음 사전+버전·정규화·Rendering Plan·SpeechProfile 5종·청크 스트리밍·상태 표시등 = P0 / 관측·타이밍·품질·버전/Canary = P1 제안 / 온디바이스 = P2). SBV2 원 서버 실측 → M4 자체 래퍼. 정본 48→50 모델. 코드 없음
- [[task-003b-tutor-persona-v1]] — **강사 역할정의·페르소나 v1 + 학습 설계 보완**(2026-09-26). 기획서 대조 15건 → 사용자 결정(스케줄 주체=강사, 3~7일 판단·균등 랜덤·FOCUS, 청취 구간·단어 메모·종료 지점). `tutor.md` v1·검증 세트·`learning-personalization-and-llm-data.md`·정본 갱신·정합성 17건. Git 원격 연동 ✅. 코드 없음
- [[task-001-initial-planning]] — **초기 기획·설계 확정**(2026-09-26). 기획서 4종 통합 → `design-spec.md` + 정본 5종 + 설계 문서 33종, 팀 7인 + 강사 페르소나, Agent Vault 구성. 코드 없음.

## Doing
- (없음) — 다음 task-008(단어장 최소판 + 오늘의 단어)

## Backlog (Phase 1, 순서·의존은 design-spec §15)
- task-003 — 온디바이스 STT 플러그인(Kotlin+sherpa-onnx) + gateway 폴백 + **M4 tts-service 자체 FastAPI(정규화·발음 사전 P0·SpeechProfile·RenderingPlan·캐시 키 12요소)** + Capacitor 셸 + **§9 실측 게이트 6항목 + TTFA** (002 후, 003·004·005 병렬)
- task-005b — Admin Console 골격(capability 가드·Dashboard·Effective Config 읽기·Plugins·Connections·Health/Test·Trace·History 읽기)
- task-007 — AI 회화(음성) 실시간 교정(RealtimeSttClient 라우팅·청크 스트리밍 TTS+TtsPlaybackQueue·프로필 옆 실행 상태 표시등·5초/TTFA 계측)
- task-008 — 단어장 최소판 + 오늘의 단어(스와이프 덱·CHOICE·finish 트랜잭션·스냅샷)
- task-009 — Phase 1 통합 QA·실기기·라이브 배포·APK 배포본

## 정리 backlog (task-006 발견, 소규모)
- `infra/http.ts` 기본 오류 문구 "AI 엔진…" 사용자 노출 가능 · 공용 `Badge` warn/accent·`ink3` 라이트 명암비 미달 · `ComingSoon` Phase/task 번호 노출

## Phase 2 이후
- 010 주제·상황(결정 시)·오늘의 회화(청취 구간·단어 메모·nextPreview)·**반복 학습(RepetitionItem·A11 강사 판단 3~7일)** · 011 AI평가 · 012 달력 · 012b 음성 P2(worker·SpeechJob·Comparator) · 012c Console P2(편집·Diff·Version·Rollback·Prompt Registry·Playground) · 013 분석·성장기록 · 014 서랍장 전체 · 015 무엇이든 물어보세요(3a→3b MCP) · 015b 음성 P3(PronunciationAnalyzer) · 016 음성 P4(Voice Package Import·스타일·Preset·Override)

## 미결정
- **TTS 5차 보완**: 발음 사전 적용 방식(플랫폼 치환 vs SBV2 user_dict 병행) / Timing 산출(narabas vs VITS duration) / TTS P1(품질·버전·지표) Phase 2 vs 4 / TEXT_ONLY UX / 온디바이스 TTS research 조건 → [[task-003c-tts-productization-design]]
- `Scenario`·`LearnerSkillState`·`LearningObservation` 도입 Phase / 개인 기록의 Claude CLI 전송 범위 / 의미 검색 도입 조건 / M4 LoRA 실험 조건 → `learning-personalization-and-llm-data.md` §8
- Style-Bert-VITS2 기본 모델 화자 id 매핑(Haruka/Sakura/Takumi 표시명 ↔ speaker) — task-003 실측 후
- `EngineMetricsDaily` 물화 vs 뷰 — Phase 3 진입 시
- Redis 도입 여부 — SpeechJob 처리량이 문제될 때만
