---
task_id: task-056
role: deployer
title: "task-056 배포 후 확인 기록 — 웹 릴리스 20261012-003701-6f8301c0"
tags:
  - type/task-record
  - domain/conversation
created: 2026-10-12
---

# task-056 배포 후 확인 기록 (deployer, 읽기 전용)

> 범위: 배포 후 확인(post_deploy_checks)만 했다. 배포·롤백·pm2 조작·push·코드 수정은 하지 않았다. 쿠키·토큰·`.env` 값은 기록하지 않았다.
> 관련: [[task-056-improve-talk-phrase-helper]] · [[task-056-qa-record]] · 배포 커밋 `6f8301c` (task-056 `facff39` · task-058 `30b8b4c` 포함)

## 1. 배포 경위 (webhook, 로그 시각 KST)

- 릴리스 `20261012-003701-6f8301c0` · sha `6f8301c0d03ece120dde5031a3e9018306a88099` · 이전 `20261011-201916-1cf4d29d` · `migrated: false` · `RELEASE_RESULT status ok`
- 00:36:48 시작 → 00:37:50 종료. 빌드 통과(`next build`, 경고는 기존 persona loader 의 trace 경고).
- 전개: `current` 전환 → pm2 `reloadProcessId` 3개 → 「실제 구동 경로 확인」 단계에서 3개 모두 `pm_cwd` 가 옛 릴리스 → 앱별 delete 후 재등록(수 초 중단) → 헬스 정상.

## 2. 확인 결과

| # | 항목 | 명령·대상 | 결과 | 판정 |
|---|---|---|---|---|
| 1 | 릴리스 포인터 | `readlink -f .../apps/thekaiwa/current` | `20261012-003701-6f8301c0` | OK |
| 2 | pm2 3개 상태·경로 | `pm2 jlist` | thekaiwa · thekaiwa-speech-gateway · thekaiwa-speech-worker 모두 online. `pm_cwd` 는 새 릴리스(`/speech/gateway`, `/speech/worker` 포함). restart 0 (재등록으로 카운터가 리셋되어 00:37 이후 기준) | OK |
| 3 | 실제 프로세스 cwd | `readlink /proc/<pid>/cwd` 3개 | 3개 모두 새 릴리스 | OK |
| 4 | 웹 헬스 본문 | `127.0.0.1:3010/api/health` | 200 · `status ok` · `env PRODUCTION` · `degraded []` · checks 11개 전부 true | OK |
| 5 | 공개 도메인 헬스 | `https://kaiwa.xn--lh0b87pnudm10a4vd.com/api/health` | 200 (nginx 경유) | OK |
| 6 | 음성 gateway | `127.0.0.1:8100/health` | 200 · `{"ok":true,"status":"OK"}` | OK |
| 7 | M4 TTS | `192.168.219.100:8200/health` | 200 · `{"status":"OK","warmedUp":true}` | OK (메모 3) |
| 8 | 온디바이스 모델 | 도메인 `/models/ondevice-ja-v1/manifest.json` | 200 · version `2024-08-01-int8-v1` | OK |
| 9 | APK 배포본 헤더 | HEAD 도메인 `/app/download/latest.apk` | 200 · `attachment; filename="LingofyJapanese-1.0.3.apk"` · length 35,216,161 | OK |
| 10 | 앱 버전 API | `127.0.0.1:3010/api/app/version` | latest 1.0.3 · latestCode 4 · minSupportedCode 2 (웹만 배포, 불변이 기대값) | OK |
| 11 | 새 라우트 | `.next/server/app/api/v1/chats/[id]/phrase-help/route.js` | 존재 | OK |
| 12 | 새 번들 문자열 | `.next/static` `*.js` grep | 「일본어 도우미」·「선생님이 답하는 중에는 열 수 없어요」·「말하는 동안 도우미를 멈췄어요」·`kaiwa.talk.helperTipSeen` 각 1파일 (옛 릴리스 0) | OK |
| 13 | 엔진명 누출 | 같은 범위 grep: claude · haiku · sonnet · reazon · whisper · style-bert | 신·구 릴리스 모두 0 파일 | OK |
| 14 | 오류 로그 | `shared/logs` | `pm2-err.log` 최종 수정 10-11 16:41 (배포 후 새 줄 없음). `speech-gateway-out.log` 00:37 이후 13줄, 오류 0. `speech-worker-out.log` 기동 `app_env='PRODUCTION'`·`kinds=ANALYSIS_STT`, 오류 0. `speech-worker-err.log` 0 bytes | OK |
| 15 | 화면 GET (QA4 쿠키, 127.0.0.1:3010) | `/study/ai` `/study/today` `/plan` `/drawer/words` `/drawer/corrections` `/settings` `/ask` | 전부 200. `/study/ai` `/study/today` `/plan` `/settings` HTML 에 오류 문구 0 | OK |
| 16 | API GET (QA4) | `/api/v1/settings/profile` · `/api/v1/chats?limit=5` · `/api/v1/corrections?status=ACCEPTED&limit=1` · `/api/v1/drawer/corrections?limit=1` · `/api/v1/words?limit=1` | 전부 200 | OK |
| 17 | 무쿠키 경계 | `/api/v1/settings/profile` · `/api/v1/chats?limit=5` | 401 · 401 | OK |
| 18 | 도우미 ① 무쿠키 | `POST /api/v1/chats/00000000-0000-4000-8000-000000000000/phrase-help` | 401 | OK |
| 19 | 도우미 ② 없는 대화 (QA4) | 본문 `{"queryKo":"목이 쉬었어요"}` | 404 · `NOT_FOUND` · 「채팅을 찾을 수 없어요.」 · `Cache-Control` 헤더 없음 | 상태 OK, 헤더 기대치 정정 (메모 4) |
| 20 | 도우미 ③ 한글 없음 | 본문 `{"queryKo":"hello"}` | 400 · `VALIDATION` · `details.reason=no_hangul` | OK |
| 21 | 도우미 ④ 배열 본문 | 본문 `["x"]` | 400 · `VALIDATION` · 「요청 본문은 JSON 객체여야 합니다.」 | OK |

- 도우미 ②~④ 는 LLM 을 부르지 않는다. 근거: `src/modules/conversation/chats/phraseHelp.ts` 에서 대화 조회(`notFoundChat`, 101~102행)가 LLM 호출 경로보다 앞에 있다.
- LLM 을 부르는 200 경로(도우미 실호출)와 성공 응답의 `Cache-Control` 헤더는 **호출하지 않았다** (읽기 전용 범위). 성공 응답 헤더는 `route.ts` 27행 소스로만 확인했다.

## 3. 확인하지 못한 것

- 도우미 실호출 200 · 콜드 스타트 504 (Leader 가 사용자 허락을 받은 뒤 별도 확인)
- Google 로그인 · 회화 1턴 실호출(LLM·TTS 재생) · 실시간 STT · 360/390/412 폭 렌더링 · 실기기 (읽기 전용 범위 밖, 사용자 몫)
- pm2 restart 0 은 재등록으로 카운터가 리셋된 값이다. 기동 후 수 분 기준이므로 안정성의 근거로 쓰지 않는다.

## 4. 메모 (이상 소견)

1. **[확실] pm2 reload 가 실행 경로를 옮기지 못했다.** webhook 로그 「실제 구동 경로 확인」 블록과 `pm2-out.log` 1201~1210행이 근거다. 3개 앱 모두 reload 후 `pm_cwd` 가 옛 릴리스였고, 스크립트가 delete 후 재등록으로 보정했다. 웹은 00:37:42 에 옛 릴리스 코드로 한 번 떴다가 00:37:44 에 새 코드로 다시 떴고, 앱별로 수 초 중단이 있었다. 현재 상태는 정상이다. 다음 배포 전에 `scripts/deploy.sh` 의 reload 경로를 점검할 필요가 있다. 수정은 developer·Leader 판단이다.
2. **[가능성 높음] 개발 미러의 `.env` 로 서명한 QA 토큰을 운영 서버가 받아들였다.** 쿠키는 `tests/live/qa-session.ts` 를 개발 미러 `~/.node-local/thekaiwa` 에서 `QA_ACCOUNT=4` 로 실행해 만들었다. 같은 토큰이 `127.0.0.1:3010`(PRODUCTION)에서 200 을 받았다. 서명 검증이 통과했으므로 두 환경의 `JWT_SECRET` 이 같은 값일 가능성이 높다. 값은 확인하지 않았다.
   - `src/modules/infra/jwt.ts` 100행을 보면 `qa: true` 토큰만 localhost 로 제한되고, 그 밖의 서명된 토큰은 서명만으로 세션이 된다. [추측] 같은 비밀로 `qa` 플래그 없는 토큰을 만들면 공개 도메인에서도 세션이 될 수 있다. 사용자 존재 확인 경로는 이 파일 밖에 있어 미확인이며, 위조 토큰은 시험하지 않았다.
   - 영향: 개발 환경의 `.env` 를 읽을 수 있는 사람이 운영 세션을 만들 수 있을 수 있다. 운영 JWT_SECRET 분리와 기존 세션 무효화 여부는 **사용자 결정 사항**이다. 이 점검에서 운영 `.env`·`shared/.env` 는 열람하지 않았다.
3. deploy-order §5-2 의 M4 헬스 기대값 `jq .ok` 가 실제 응답 형식(`status: "OK"`)과 다르다. 문서 정정 대상이다(Leader).
4. 요청 ②의 기대치 「404 에 `Cache-Control: private, no-store`」는 코드와 맞지 않는다. `route.ts` 27행은 성공 응답의 `ok(...)`에만 헤더를 붙이고, 401·404 에는 붙지 않는다. 에러 응답에는 사용자 데이터가 없으므로 문제로 보지 않는다.
5. 점검 중 제 실수 1건: `/api/v1/drawer/words` 를 추정해 404 를 받았다. 실제 라우트는 `/api/v1/words` 이며 200 이다. 배포 결함이 아니다.
6. QA4 계정 행은 쿠키 발급 스크립트가 upsert 로 조회했다(기존 행, 갱신 필드 없음). 운영 사용자 데이터 쓰기는 0이다. 도우미 ②~④ 요청은 프로세스 메모리의 분당 한도 카운터를 소모했다(재기동으로 리셋된다).
7. 쿠키 파일(scratchpad `qa4.cookie`)은 점검 후 비웠다(0 bytes). 토큰 자체는 발급 후 1시간(약 01:40 KST)까지 유효하다.

## 5. 판정

- 배포 판정: **OK** — 헬스·경로·라우트·번들·스모크가 정상이고 배포 이후 오류 로그가 없다.
- 이상 소견: 메모 1(reload 경로, 배포 스크립트 점검 필요), 메모 2(개발·운영 JWT 비밀 공유 가능성 — 보안, Leader 에스컬레이션 권고).
- 롤백: 불필요. 롤백 대상 `20261011-201916-1cf4d29d` 는 releases 에 남아 있다.
- 앱(APK): 이번 배포는 웹만이다. APK 재빌드·업데이트 안내 없음.
