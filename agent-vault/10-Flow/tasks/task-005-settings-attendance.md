---
task_id: task-005
title: "설정 허브(기본정보·학습·AI 선생님 목소리·음성 인식) + 출석 체크인"
status: done
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

## Reviewer 재검증 (2026-09-27, 커밋 564a03c)

**REV-006 재검증 · 판정: PASS** (Critical 0 · High 0 · Medium 0 · Low 0, 잔여 노트만). 8건 전부 코드 확인.

- High(QA 토큰): `jwt.ts isQaTokenAllowed`(Host=localhost·`X-Real-IP` 없음)+`auth.ts`/`proxy.ts` 적용·1시간·PRODUCTION 가드 확인. Host 기반 판단만으로는 이론상 이 저장소 밖 nginx 전역 설정(이 vhost 가 443 의 `default_server` 인지)에 의존해 불완전하지만, `ecosystem.config.js`(`-H 127.0.0.1`로 3010 loopback 전용 확인)와 `docs/nginx/kaiwa....conf`의 `location /`·`/ws/speech`가 `proxy_set_header X-Real-IP $remote_addr`를 **무조건 덮어쓰는** 점을 함께 보면, 외부 요청은 Host 위조 여부와 무관하게 X-Real-IP 조건에서 항상 막힌다 — 이중 방어라 실효성 있음. smoke #16(X-Real-IP 주입 시 401)도 이 경로를 검증. 잔여 노트(비차단): 코드 주석이 Host 근거만 언급하고 더 확실한 근거(X-Real-IP 강제 주입+loopback 바인딩)는 적지 않음 — 다음에 손댈 때 주석 보강 권장. 커밋 메시지의 "사용 후 쿠키 삭제"는 실제 삭제 코드가 없음(cosmetic, 비차단).
- M1 `Prisma.DbNull` 정확히 적용(`preferences/index.ts:27-29`) — undefined/null 분기 올바름.
- M2 `modeResolver.ts` OFFLINE+web→GATEWAY로 정정, 위험 수용 코멘트 명시.
- M3 `http.ts` 정확한 이름 Set 4개로 교체 — 저장소 내 실제로 던지는 모든 에러 이름(`grep` 확인: JsonSchemaError·Llm*·ClaudeCli*·NoEngineAvailableError) 전부 커버.
- M4 `settings/voice/route.ts` 재배정+`notice` 구현, DB persist 확인(재조회 시 notice 재발생 안 함), 동시요청도 update 멱등이라 안전.
- M5 `http.ts` 버킷 500개 초과 시 만료분 스윕 — 무한누적 해소.
- M6 `validate.ts`에서 두 필드 필수 강제 + `SpeechSettings.tsx`가 항상 explainLang 동반 전송 확인.
- Low `registry.ts pickDefaults` 5키만 통과 확인.

tsc/lint/test 수치는 이번에도 재실행하지 않음(node_modules 미설치) — 우분투 실측 보고 신뢰. QA 진행 가능.

## QA 기록 (2026-09-27)
- **PASS(결함 0)** — tsc 0 · lint 에러 0 · 단위 테스트 24/24 · build 0 · QA 계정 스모크 16항목 계약대로(응답에 엔진·모델·speaker 문자열 0) · 운영 도메인에서 QA 쿠키 무효(API 401·페이지 307→/login) · 비로그인 401 봉투·health 200 · 같은 날 체크인 2회 → DB 1행.
- 설정 화면 360/390/412 육안: **NOT_VERIFIED — 사용자 폰 확인 필요**(로그인 필요).

## 최종 요약 (Leader, 사용자용)
설정 화면과 출석 체크를 붙였습니다. 상단 아바타 → 설정에서 ① 이번 달 출석·연속 출석 ② 내 이름·선생님 이름·수준·목표·문체·교정 강도·설명 자세히·하루 단어 수·공부 시간 ③ AI 선생님 목소리(3명)·말투·들려주는 방식(자연 속도·학습 속도·천천히)·속도·높낮이·억양 ④ 음성 인식 방식(자동·빠르게·정확하게·오프라인)을 바꿀 수 있습니다. 앱을 열면 하루 한 번 자동으로 출석이 찍힙니다.
- 화면과 응답에 엔진·모델 이름은 나오지 않고, 잘못된 값은 서버가 거절합니다.
- **미리듣기 소리는 아직 나오지 않습니다** — 맥 M4 목소리 서버(task-003)가 생기면 동작하며, 그 전에는 "목소리 서버 준비 중" 안내가 뜹니다.
- 검증용으로 QA 테스트 계정(`qa-bot@thekaiwa.test`, 비밀번호 없음)을 만들었습니다. 이 계정의 세션은 서버 내부(localhost)에서만 통하고 운영 도메인에서는 막힙니다.
