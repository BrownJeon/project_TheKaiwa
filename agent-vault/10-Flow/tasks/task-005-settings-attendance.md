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

## Reviewer 기록 (2026-09-27)

**REV-006 · 판정: PASS_WITH_NOTES** (Critical 0 · High 1 · Medium 6 · Low 1) — 코드 미수정, Read 전용 감사. tsc/lint/test 재실행은 `node_modules` 미설치(NFS noexec, `~/.node-local` 미동기화)로 **재실행 미실시**(Developer 보고 수치는 확인 못함).

**확인됨(문제 없음)**: 라우트 전부 `requireSession()` + 세션 `userId` 만 사용(타 사용자 지정 경로 없음) · 화이트리스트·범위 검증(speed 0.6~1.2·pitch/intonation 0.8~1.2·styleWeight 0~2|null·dailyWordCount 5~30·dailyMinutes 5~120·teacherName ≤30) · 웹 OFFLINE 저장 거부 · 본문 64KB 상한(`readJsonObject`) · `grep -rnE 'reazon|whisper|style-?bert|sherpa|claude' src/modules/{preferences,speech,learning} src/app/api/v1 src/components/settings` 0건 · ESLint 6층 경계 규칙(`eslint.config.mjs`)이 module-dependency §3-1 행렬과 1:1 대응 · 출석 멱등은 `@@unique([userId,date])`+P2002 캐치로 동시요청 안전, `computeStreak` 경계 테스트 통과.

**이슈**:
1. **[HIGH]** `tests/live/qa-session.ts` — QA 세션 JWT(`{userId,email}`)에 환경/aud 클레임이 없고, `auth()`/`verifyJwt`(`src/modules/infra/{auth,jwt}.ts`)도 이를 검증하지 않는다. CLAUDE.md상 dev/prod가 같은 DB·env를 공유하므로, 이 쿠키는 "127.0.0.1:3010 전용"이라는 README 문구와 달리 운영 도메인에서도 그대로 유효할 것으로 추정된다(실측 안 함, 추측). 유출·재사용 시 `qa-bot@thekaiwa.test` 계정으로 운영 도메인 접근 가능. Google 로그인과의 계정 충돌은 provider 분리로 없음(정상). 권고: 토큰에 env/aud 클레임 추가해 서버가 검증하거나, 스크립트를 `APP_ENV!=='production'` 가드로 감싼다.
2. **[MEDIUM]** `src/modules/preferences/index.ts:27` — `updateProfile`이 `goalTopics:null`→`undefined` 변환, Prisma가 필드 갱신을 건너뛴다(`Json?`이라 실제 null 대입 가능한데도). 사용자는 200 응답과 이전 값을 받아 "삭제됐다"고 착각. 권고: null 그대로 전달.
3. **[MEDIUM]** `src/modules/speech/stt/modeResolver.ts:21-22` — `OFFLINE` 분기가 `platform` 인자를 무시하고 항상 `ONDEVICE`. `X-Client-Platform`은 클라이언트가 임의로 세팅 가능(`components/common/api.ts:71`)해 웹에서 헤더 위조로 저장 검증(`validate.ts:122`) 우회 가능하고, 위조 없는 실제 웹 요청에도 resolver가 모순되게 `ONDEVICE`를 돌려준다. 영향은 자기 계정 한정(타인 영향 없음).
4. **[MEDIUM]** `src/modules/infra/http.ts:47-49` — `toErrorResponse` 이름 매핑이 `includes('Timeout')`/`startsWith('Llm'|'ClaudeCli')` 부분일치라 무관한 이름의 예외가 500 대신 502/504로 오분류될 수 있음(버그 은폐 위험). 권고: 정확한 allow-list.
5. **[MEDIUM]** `src/app/api/v1/settings/voice/route.ts:12-15` — speech-platform/13 §3.6 "재배정+notice" 미구현, `voice:null`만 반환하고 DB `voiceProfileId`는 그대로.
6. **[MEDIUM]** `src/modules/infra/http.ts:89` — `rateLimit` 버킷 Map 만료 후 미제거(무한 누적, 현재 규모상 실질위험 낮음).
7. **[MEDIUM]** `src/app/api/v1/settings/speech/route.ts:16-22` — PUT이 부분 갱신으로 동작, 정본(§3.6) "전체 치환"과 불일치(voice PUT과 대조).
8. **[LOW, 추측]** `src/modules/speech/voices/registry.ts:28` — `VoiceProfile.defaults` JSON 통째 캐스팅 응답 포함, 화이트리스트 없음(현재 seed는 안전).

QA 전달 high_risk_areas: qa-session.ts 도메인 스코프, OFFLINE 헤더 위조, goalTopics null 저장. native_change: false.
