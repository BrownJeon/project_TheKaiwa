---
task_id: task-005
title: "설정 허브(기본정보·학습·AI 선생님 목소리·음성 인식) + 출석 체크인"
status: review
roles_involved: [leader, developer, reviewer, qa]
related_tasks: [task-002-phase0-scaffolding, task-004-ai-client-persona, task-003-speech-p0]
tags:
  - type/task
  - domain/preferences
  - domain/speech
  - domain/ui
created: 2026-09-27
updated: 2026-09-27
---

## 목표 (Leader)
design-spec §15 task-005: `/settings` 에 기본정보·목표·학습 / AI 선생님(VoiceProfile·스타일·속도·높낮이·억양·Speech Profile·통합 미리듣기 draft) / 음성 인식 4모드, settings API 3종·voices·preview·출석 체크인(하루 2회 열어도 1행), 화면 엔진명 0.

## 관련 과거 이력
- [[task-002-phase0-scaffolding]]: 인증·앱 셸·seed(VoiceProfile 3·AppSetting). [[task-004-ai-client-persona]]: engine router(NoEngineAvailableError 이름 규약).
- 미리듣기 합성은 TTS 플랫폼 층 + M4 tts-service 가 필요 → [[task-003-speech-p0]] 전까지 `422 ENGINE_UNAVAILABLE`("목소리 서버 준비 중").

## Developer 기록 (2026-09-27)
- infra: `http.ts`(봉투·오류 코드 매핑·withApi·requireSession·readJsonObject(64KB)·rateLimit), `src/types/api.ts`(실패에 `data.code`).
- preferences: 화이트리스트 검증(`validate.ts`)·지연 생성 upsert·`getAppSetting`. speech: `listSelectableVoices`(모델·speaker 비노출)·`assertSelectableVoice`·`resolveRecognitionMode`·`platformFrom`·`previewVoice`(task-003 전 422). learning: `checkIn`(P2002 → isNew=false)·`listMonth`·`computeStreak`.
- 라우트 7개(`/api/v1/settings/{profile,voice,speech}`·`voices`·`voices/preview`·`attendance`·`attendance/check-in`), Voice 검증 조합은 `app/api/v1/_lib/voice.ts`.
- 화면: `components/settings/{LearningSettings,VoiceSettings,SpeechSettings,AttendanceCard}`, `components/shell/AttendancePing`(sessionStorage 하루 1회), 설정 페이지 조합. 클라이언트 API 래퍼가 앱이면 `X-Client-Platform: app` 을 붙인다.
- 검증: tsc 0 · lint 에러 0 · 단위 테스트 24/24 · build 0 · QA 계정(`qa-bot@thekaiwa.test`, `tests/live/qa-session.ts`)으로 127.0.0.1 스모크 16항목 계약대로(`tests/live/task005-smoke.sh`).
- 화면 육안(360/390/412·로그인 후)은 사용자 계정 로그인이 필요해 **NOT_VERIFIED** — 사용자 폰 확인 항목.
