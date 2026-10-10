---
task_id: task-012b-4
title: "TTS P1 타이밍 — narabas 정렬 스파이크(A vs B)·M4 tts-service timing 후처리·TtsCache.timing 부착·#24 JSON timing·자막 강조·섀도잉 강조 화면"
status: todo
base_ref: 5c3a701
risk_level: R2
roles_involved: [leader, judge, designer, developer, reviewer, qa, deployer]
related_tasks: [task-012b-speech-p2, task-012b-3-tts-observability, task-003d-tts-p0, task-003c-tts-productization-design, task-007-talk-voice-web, task-010-today-lesson]
tags:
  - type/task
  - domain/speech
  - domain/voice
  - domain/infra
  - domain/ui
aliases:
  - TTS 타이밍
  - 자막 강조
  - narabas
  - task-012b-4
created: 2026-10-06
updated: 2026-10-06
demo_gate:
  required: true
  level: "delta"
  status: "waived"
  version: 0
  repo_path: ""
  artifact_url: ""
  content_sha256: ""
  decided_by: "judge"
  rule_id: "DM-low-confidence"
  approved_by: ""
  approved_at: ""
  approval_quote: ""
  waived_by: "user"
  waived_at: "2026-10-06T23:43:51+09:00"
  waiver_quote: "데모 생략하고 진행해줘"
  active: false
---

## 목표 (Leader)
선생님 음성(TTS)에 **단어·모라 단위 시각 정보(timing)** 를 붙여, 재생 중인 단어를 말풍선에서 강조(Karaoke 자막)하고 섀도잉 때 다음 문장을 미리 강조한다(speech-platform/16 §8). 산출 방식은 **A 사후 강제정렬(narabas, M4)** 을 기본으로 하되, 착수 첫 단계에서 **B VITS duration 추출** 과 한 번 비교(스파이크)해 고른다. 오디오는 지금처럼 먼저 나가고 timing 은 나중에 캐시에 붙는다 — **회화 TTFA 에 영향이 없어야 한다**.

## 사용자 결정·지시
- 2026-10-06 사용자 지시 원문(Leader 전달): **"지금부터 페이즈2작업에 전체 작업을 데모화면 승인없이 한번에 진행해주고 결과를 정리해서 알려줘"** — 데모 승인 생략 의사. `check.mjs waive` 가 이 문장을 인식하지 못해 **게이트 기록은 없다**(waived 아님, 훅 warn). designer 는 승인용 데모 대신 **구현 가이드**를 낸다.
- 같은 날 사용자 답(AskUserQuestion, Leader 전달): **M4 설치·배포 포함(012b-4: narabas·torch 설치, tts-service 웹훅 배포)** · 운영 배포는 모든 작업이 끝난 뒤 한 번에 · DB 는 이 task 에 해당 없음(`TtsCache.timing`·`timingVersion` 칸이 이미 있다 — `prisma/schema.prisma:1404-1407`).
- → [[task-012b-speech-p2]] **U5 승인**(narabas M4 설치·tts-service 배포·Timing A/B·스파이크용 torch). 16 §16 #6(계산 위치·동기 여부·MPS 가능성)은 스파이크 결과로 이 task 안에서 정한다(기본안: M4 비동기 후처리, 불가 시 우분투 worker).
- 배포 경로 주의: `docs/deploy-order.md:98` 은 M4 를 "git push 웹훅"이라 적었지만, `speech/tts-service/README.md:16`·`SETUP-M4.md:159` 는 **우분투에서 `scripts/deploy-from-ubuntu.sh <ref>`(SSH push → M4 ff-merge → 핀 대조 → restart → smoke, 실패 시 직전 SHA 롤백)** 이고 "M4 는 Gitea 에서 pull 못 함(키체인)"이라 한다 [확실 — 두 문서 직접 읽음]. 실제 경로는 스크립트로 본다 [가능성 높음 — deploy-order 문구가 낡음, Leader 정정 대상].

## 설계 방침 (Leader 초안 — 스파이크 뒤 확정)
- **순서**: ① 스파이크(저장소 변경 0) → ② M4 tts-service timing 후처리 → ③ 앱: timing 부착·#24 JSON·Trace `TTS_TIMING` → ④ 화면(자막·섀도잉 강조) → ⑤ M4 배포(웹 push 전) → 웹 일괄 배포.
- **스파이크(첫 단계, 사용자 승인 범위 안)**: M4 에 **운영과 분리된 venv**(예: `~/kaiwa-tts-spike`)를 만들어 narabas·torch(MPS)·pyopenjtalk 를 설치한다. **운영 venv `~/kaiwa-tts-run` 과 8200 프로세스는 건드리지 않는다** — 운영 핀(`speech/tts-service/requirements.txt`: style-bert-vits2 2.5.0·torch 2.14.0·transformers 4.57.6·numpy 1.26.4·setuptools 80.10.2)이 바뀌면 SBV2 가 깨진다(`SETUP-M4.md:57`, numpy≥2 는 pyopenjtalk-dict ABI 불일치) [확실]. 고정 20문장(운영 8200 에서 합성한 wav)으로 A: 정렬 시간 p50/p95·단어 경계 오차(눈 판정 기준표), B: `TTSModel.infer` 내부 duration 을 꺼낼 수 있는지·A 와의 차이를 잰다. narabas 설치 방법·MPS 지원 여부는 `[추측]` — 스파이크가 확인한다.
- **본 구현 위치(기본안 A)**: M4 tts-service 에 `timing=true` 선택 후처리 — 오디오 응답은 지금처럼 먼저, 정렬은 비동기로 끝낸 뒤 앱이 가져가 `TtsCache.timing`(+`timingVersion` = aligner 버전)에 붙인다(첫 청취는 강조 없이, 캐시 HIT 부터 강조 — 16 §8.2). narabas 를 운영 venv 에 넣어야 하면 **핀 고정 파일로 제약(`pip install -c`)** 하고 `scripts/check_pins.py` 가 대조하도록 requirements 를 갱신. 넣을 수 없으면(핀 충돌) 정렬기를 **별도 venv 의 별도 프로세스**(M4 로컬 포트, 8200 이 내부 호출)로 둔다 — 결정은 스파이크 결과로 Leader.
- **응답 모델**(16 §8.1): `timing?: {method: FORCED_ALIGN|ENGINE_DURATION, alignerVersion, words[{text,startMs,endMs,charStart,charEnd}], moras?[…]}` — `charStart/charEnd` 는 정규화 token map 으로 되돌린 **원문 `replyJa` 좌표**. `phonemes[]` 는 사용자 API 에 싣지 않고 `TtsCache.timing` 에만. #24 `Accept: application/json` 은 이미 `timing: null` 자리를 돌려준다(`src/app/api/v1/speech/tts/[token]/route.ts:13,24`) [확실] → 값을 채운다.
- **호환**: timing 은 선택 파라미터 — **M4 를 먼저 배포해도 구 앱이 그대로 동작**해야 하고, 새 앱이 구 M4 를 만나도 `timing=null` 로 동작해야 한다(배포 순서 독립).
- **Trace**: `TTS_TIMING{words, moras, method, alignMs}`(16 §7.2) — 허용 키 목록 `src/modules/speech/tts/metrics.ts:9-17` 에 추가(본문 0).
- **화면**: 말풍선 현재 단어 강조(회화방 선생님 말풍선 재생과 동기) · 레슨 듣기 단계 섀도잉 강조 · timing 없으면 지금 화면 그대로. 엔진명 0, 후리가나·한글 표시 설정과 겹칠 때 강조가 루비 줄을 깨지 않게(designer 가이드).
- 5초 예산: 정렬은 회화 TTS 큐 밖(비동기)·M4 MPS 를 SBV2 와 나눠 쓰므로 **정렬 중 합성 지연 증가를 측정**(TTFA 30턴 전후 비교).

## 예상 변경 경로
- M4: `speech/tts-service/{app.py, kaiwa_tts/**, requirements.txt, scripts/check_pins.py, tests/**, README.md, SETUP-M4.md}`
- 앱 서버: `src/modules/speech/tts/{cache.ts, synthesize.ts, metrics.ts, types.ts, client/**}` · (신규) `src/modules/speech/tts/timing.ts` · `src/app/api/v1/speech/tts/[token]/route.ts` · `src/modules/engine/adapters/tts/**`(어댑터가 timing 요청·응답을 앎) · `src/types/tts.ts`
- 화면: `src/components/talk/{TalkTutorBubble.tsx, useTalkPlayback.ts}` · `src/components/lesson/{StageUnderstand.tsx, useLessonPlayback.ts}` · `src/components/speech/ttsAudio.ts`(필요 시)
- 문서: `docs/screens.md`(designer) · `docs/design/api-contract.md`·`speech-platform/16` §8·§16 #6·`docs/deploy-order.md:98` 정정(Leader)
- 테스트: `speech/tts-service/tests/**` · `src/modules/speech/__tests__/**` · `src/components/talk/__tests__/**` · `tests/live/task012b4-smoke.ts`(신규)

## 파일 경계 (다른 WP 와 충돌 방지 — [[phase2-batch-plan]] §2)
- `src/modules/speech/tts/{cache,metrics,synthesize,index}.ts` 는 [[task-012b-3-tts-observability]] 가 먼저 — **이 task 의 앱 부분은 012b-3 로컬 커밋 뒤**. 스파이크·M4 서비스 부분은 그 전에 병렬 가능.
- `src/components/talk/TalkTutorBubble.tsx`·`useTalkPlayback.ts`·`components/lesson/{StageUnderstand.tsx,useLessonPlayback.ts}` 는 **이 task 소유** — 010d-B·012b-2·T4 는 건드리지 않는다. 이 task 는 `TalkRoom.tsx`·`components/chat/**`·`components/vocab/**`·`TodayLessonCard.tsx` 를 건드리지 않는다.
- `prisma/**` 금지(칸 이미 있음).
- 미러 `~/.node-local/thekaiwa-012b4`(dev 포트 3028). M4 는 스파이크 venv 와 운영 디렉터리(`~/kaiwa-tts-run`)를 구분하고, 운영 쪽은 deployer 의 배포 스크립트로만 바꾼다.

## 완료 기준 (QA 가 실행으로 확인)
1. 스파이크 보고: A·B 각각 20문장 정렬 성공률·시간 p50/p95·단어 경계 오차, MPS/CPU, 운영 핀과의 충돌 여부, 채택안·이유(이력서 Developer 기록).
2. M4: `timing=true` 요청에서 오디오 응답 시각이 timing 없는 요청과 같고(차이 측정), timing 은 나중에 조회 가능. 정렬 실패 → `timing=null`·오디오 정상. `scripts/check_pins.py`·`smoke.py` 통과, 구 앱 요청(파라미터 없음) 동작 동일.
3. 앱: 캐시 MISS 첫 재생은 timing 없음 → 이후 HIT 에서 timing 있음. `words[].charStart/charEnd` 로 원문 `replyJa` 를 자르면 `text` 와 일치(정규화 되돌림 — 숫자·장음·발음 사전 치환 문장 포함). #24 JSON 의 timing 이 사용자 결속·만료 규칙을 그대로 따름. 응답·로그·Trace 에 문장 원문 0.
4. 화면: 재생 단어 강조가 소리와 어긋남 ≤ 기준(스파이크에서 정한 값) · timing 없으면 지금과 동일 · 후리가나/한글 표시 켬·끔 3폭에서 줄 깨짐 0 · 섀도잉 강조.
5. 회화 TTFA·턴 p50 30턴 전후 회귀 없음(정렬이 M4 를 같이 쓰는 영향 포함), M4 메모리 footprint 증가 기록.
6. M4 배포: `deploy-from-ubuntu.sh` 성공 → `/health` `{"status":"OK","warmedUp":true}` → 운영 앱 미리듣기·회화 TTS 정상. 실패 시 직전 SHA 롤백 확인.
7. 회귀: 단위 전부 + 스모크 003d·007·010(레슨 듣기).

## 관련 과거 이력 요약
- [[task-012b-speech-p2]]: 범위 분할(012b-4 = Timing, M4 설치·배포 승인 + 데모) · U5 기본안(A, M4 비동기 후처리, 불가 시 우분투 worker).
- [[task-003d-tts-p0]]: M4 자체 FastAPI(:8200 상시·pf·워치독)·배포 스크립트·핀 대조·실측(합성 p50 716ms·HIT 24ms). [[task-003c-tts-productization-design]]: 16 §8 Timing Metadata 설계.
- [[task-007-talk-voice-web]]: 청크 TTS·재생 큐·첫 문장 조기 합성(TTFA p50 ≈1.8~2.1s). [[task-010-today-lesson]]: 레슨 듣기 구간 반복.
- [[task-012b-3-tts-observability]]: 같은 `speech/tts` 파일을 먼저 바꾼다.
- 승인된 교훈: 없음(`/이슈기록 관련 tts` 0건, 2026-10-06).

## 승인 상태
- **M4**: narabas·torch 설치·tts-service 배포 — **사용자 승인(2026-10-06, Leader 전달)**. 운영 venv·8200 변경은 배포 스크립트 경유만. **접근 경로 미확인** — 문서상 우분투에서 `ssh -o BatchMode=yes brownjeon@192.168.219.100`(키 인증, `deploy-from-ubuntu.sh:10,25`), 기록된 마지막 사용 2026-09-27(task-003d). 착수 첫 단계에서 `ssh … true` 로 확인, 실패하면 사용자에게(맥 앞에서 `SETUP-M4.md` 대화형 실행).
- **DB**: 변경 없음(`TtsCache.timing`·`timingVersion` 이미 있음).
- **데모**: 사용자 지시로 승인 생략 의사 — 게이트 기록 없음. `demo_gate` 는 judge intake 뒤 Leader 가 `check.mjs init` 으로 만든다.
- **네이티브/APK**: 없음(웹 재생 경로만).

## 판단 기록 (judge)

## Leader 기록 (Phase 2 일괄 접수, 2026-10-06 21:50)

- **judge intake**(Leader 가 `judge.mjs` 직접 실행, `judge-result@2`·engine=jev·fallback 없음): standard · developer=**opus** · risk=R1→**R2 로 Leader 상향**(M4 운영 서비스 변경·배포) · demo=delta(`DM-low-confidence`) · 규칙 덮어쓰기 없음. 결과 JSON `/tmp/judge-task-012b-intake.result.json`.
- **데모 승인 생략**: 사용자 지시(2026-10-06): "지금부터 페이즈2작업에 전체 작업을 데모화면 승인없이 한번에 진행해주고 결과를 정리해서 알려줘". delta 데모(승인용)를 만들지 않고 designer 가 **구현 가이드**를 낸다. 데모 게이트 도구 `check.mjs waive` 는 이 문장을 생략 요청으로 인식하지 못해(정규식 `(데모|목업|시안|mockup|demo)\s*(는|은|를|을|도)?\s*(생략|없이…)` — "데모화면 승인없이" 불일치) **정식 waive 기록은 없다** — 게이트 상태는 `init` 직후 값 그대로이고 편집 훅은 warn 단계라 막지 않는다. 사용자가 도구가 인식하는 문장(예: "데모 생략하고 진행해줘")을 한 번 입력하면 정식 기록으로 바꾼다.
- **사용자 승인 사항(AskUserQuestion 2026-10-06)**: DB 변경 전부 승인(추가만·백업 후 통합 `db push`) · 운영 배포는 전부 끝난 뒤 한 번에 · M4 설치·배포 포함 · 챌린지 U3=B2.

## 데모 검토 (demo gate)

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge: delta (DM-low-confidence) | 10-06 21:48 |
| - | 생략 | - | - | "데모 생략하고 진행해줘" | 10-06 23:43 |

## Designer 기록

- [22:06] 디자인 스킬: component(레이아웃·정보 구조 변경 없음 — 기존 말풍선·수업 줄 위 강조만이라 layout 생략, `project-ui-system` 미적용) / 자체 점검 P0 0·P1 0·P2 2, a11y Critical 0·Major 0·Minor 1 (아래 §8)
- [22:06] 승인용 데모 대신 **화면 구현 가이드**(사용자 지시 "데모화면 승인없이" — 게이트 기록 없음). 이 가이드는 ④ 화면 단계만 다룬다(스파이크·M4·서버 timing 부착은 developer). `docs/screens.md` 반영은 웨이브 끝 일괄. 근거 표기 `[확인]` = 이번에 코드·정본을 직접 읽음 · `[추측]`.
- [22:11] **Leader 결정(이력서 표기 22:30, B = 합성 때 동기 산출) 반영해 가이드 수정**: "첫 재생은 timing 없음"(16 §8.2, A 전제)이 사라졌으므로 ① 실시간 턴 재생도 강조 대상으로 넣고(K14 수정) ② timing 운반을 **#24·#23 wav 응답 헤더**로 권고(M4 → 앱과 같은 방식 — TalkRoom·SSE 무변경, 요청 수 0 증가, D-T1·D-T4 수정) ③ 완료 기준 3 의 "MISS 첫 재생은 timing 없음 → HIT 부터 있음"은 B 에선 **"MISS 첫 재생부터 있음, 012b-4 이전 캐시 행만 없음"**으로 바뀌어야 한다(QA 기준 정정 — Leader).

### 012b-4 화면 구현 가이드 — 회화 말풍선 단어 강조(Karaoke) · 수업 ① 단어 강조 · 다음 줄 예고

승인 데모: 없음(사용자 지시로 승인 생략 의사, 2026-10-06 — 게이트 기록 없음). 쓰는 토큰 이름: `accent`(밑줄)·`accent-soft`(기존 문장·줄 배경)·`ink` — **새 색 0, 새 문구 0**(강조는 장식이라 글이 없다).

#### 0. 먼저 볼 것 — 정본·설계 방침과 다른 점 4
1. **timing 을 SSE 가 아니라 오디오 응답 헤더로 받는다**(D-T1·D-T4, 권고 — 22:11 수정): B 는 합성과 같은 호출에서 timing 이 나오므로 실시간 턴 첫 재생(MISS)에도 timing 이 있다. 이것을 SSE `audio` 에 실으면 `TalkRoom.tsx:363-372`(SSE 처리 — 012b-2 → 010d-B 소유, C10) 수정과 #32 계약 변경(`api-contract.md:2062` "timing 은 P1 전까지 싣지 않는다")이 필요하다. 대신 **청크 소리를 받는 #24 wav 응답에 헤더 `X-Tts-Timing`**(Leader 가 M4 → 앱에 정한 방식과 같은 모양)을 실으면, 소리를 받는 곳(재생 큐의 `fetchAudio` — `useTalkPlayback.ts:54`, 012b-4 소유)이 같은 응답에서 timing 을 읽는다 → **TalkRoom·SSE 무변경, 요청 수 증가 0, TTFA 영향 0**. 같은 헤더가 #23(다시 듣기)·#62c clip(#24 URL)에도 그대로 쓰인다.
2. **timing 좌표는 "원문 replyJa 좌표"가 아니라 "그 청크(문장) 글 좌표"여야 한다** [확인 — 모순]: 16 §8.1 은 `charStart/charEnd` 를 `replyJa` 좌표라 적었지만, `TtsCache` 는 문장(청크) 하나를 캐시 키로 여러 메시지가 함께 쓴다(같은 문장이 다른 답장 다른 위치에 나온다). 화면은 **청크 글 기준 좌표**를 받고, 말풍선 안 위치는 이미 있는 문장 조각(`spans`)으로 더한다. 수업 #62c 는 화면이 clip 글을 모르므로 서버가 clip 의 줄 안 시작 위치(`clips[].charStart`)를 같이 준다(D-T2). Leader 결정 22:30 의 "원문 `replyJa` 좌표로 되돌리는 2단 매핑"은 **SBV2 정규화 좌표 → 앱이 보낸 정규화 글(M4) → 정규화 전 청크 원문(앱 token map)** 까지만 하면 되고, 청크 → 말풍선 전체 좌표는 화면 몫이다(숫자·발음 사전 치환 문장에서 `charStart/charEnd` 가 원문 글자를 가리키는지 = 완료 기준 3 의 검사). 정본 문구 정정 = Leader.
3. **좌표 단위가 정본에 없다**: 화면의 범위(`TextRange`)는 **코드포인트** 기준이다(`annotations.ts:428` [확인]). timing 도 코드포인트로 못 박아야 한다(UTF-16 이면 이모지·서로게이트에서 어긋남, D-T3). 또 `api-contract.md:638` 은 `source:"ALIGN"`, 16 §8.1 은 `method: FORCED_ALIGN|ENGINE_DURATION` — 이름 불일치(화면은 둘 다 안 씀, 정본 정리 대상).
4. **"섀도잉 강조"를 그대로 만들 자리가 지금 수업에 없다** [확인]: 16 §8.3 은 "SHADOWING 쉼 동안 다음 문장 미리 강조"인데, 수업 ① 은 `SHADOWING` 프로필·쉼이 없고 줄이 이어서 재생된다(`useLessonPlayback.ts:137-158`, 16 §6 머리말 "SHADOWING 은 Phase 3 섀도잉 화면"). → 012b-4 에서는 **"지금 줄의 마지막 단어가 시작되면 다음 줄을 예고"**(눈이 다음 줄로 미리 가게)로 해석했다 [추측 — Leader 확인 D-T5]. 진짜 섀도잉(쉼 동안 따라 말하기)은 Phase 3.

#### 1. 화면 개요
| 항목 | 내용 |
|---|---|
| 목적 | 선생님 목소리가 나오는 동안 지금 소리 나는 단어를 말풍선·수업 줄에서 밑줄로 따라가게 한다(듣기 ↔ 글자 연결) |
| 적용 자리 | ① 회화방 선생님 말풍선 — **실시간 턴 재생**(스트리밍 모드·done 모드 둘 다)과 **▶ 다시 듣기** ② 오늘의 회화 **① 이해** 구간 재생·줄 다시 듣기(`StageUnderstand`) |
| 적용 안 함 | 내 목소리 ▶ · 미리듣기(설정) · 수업 ②~⑤·평가 듣기·단어 소리 — 범위 밖 |
| 가시성 | 모든 사용자 같음. timing 이 없으면 **지금 화면 그대로**(기능 감지 없이 조용히 빠짐) |
| 앱/웹 | 같음(웹 재생 경로만, 네이티브 0) |

#### 2. UI 구조 (상태 · 의사코드, 390px)

**A. 상태**
| id | 조건 | 회화 말풍선 | 수업 ① 줄 |
|---|---|---|---|
| K0 timing 없음 | 012b-4 이전에 만든 캐시 행 · 추출 실패(`timing=null`) · 구 M4 · 헤더 없음 · 검증 실패(K7) | **지금 그대로** — 재생 문장 `bg-accent-soft` | 지금 그대로 — 재생 줄 `bg-accent-soft` |
| K1 timing 받는 중 | 소리를 아직 받는 중(헤더는 소리와 같이 온다) | K0 그대로(표시·자리표시 없음) | 〃 |
| K2 단어 재생 중 | 이 조각에 유효한 timing + 재생 위치가 단위 안 | 문장 배경 + **현재 단위 밑줄**(accent 3px) | 줄 배경 + 현재 단위 밑줄 |
| K3 단어 사이 쉼 | 위치가 두 단위 사이 | 쉼 ≤250ms → 앞 단위 유지(깜빡임 방지) / 더 길면 밑줄 없음 | 〃 |
| K4 늦게 도착 | 재생 중에 timing 이 붙음(헤더 방식이면 생기지 않음 — D-T1 대안(SSE·#24 JSON 따로)을 고를 때만) | 그 순간 위치의 단위부터 밑줄 — 되감기·애니메이션 없음, 레이아웃 변화 0 | 〃 |
| K5 멈춤·끊김 | ■ 멈춤·barge-in·새 턴·화면 가림·다른 재생 | 모든 강조 즉시 끔(기존 규칙) + 시계 정지 | 〃 |
| K6 재생 차단 | `phase==='blocked'` | 강조 없음(기존 "눌러서 듣기") | 〃 |
| K7 검증 실패 | §2-C 검사 하나라도 실패 | K0 | K0 |
| K8 자막만 | TEXT_ONLY(소리 없음) | 강조 없음 | 강조 없음(기존 자막만 화면) |
| K9 reduced-motion | `prefers-reduced-motion: reduce` | 단위 교체만(전환 0) | 〃 |
| K10 히라가나 켬/끔 | 표시 스위치 | 켬: 단위를 루비 묶음 경계로 넓힘(§2-C) · 끔: 글자 단위 그대로. 재생 중에 바꾸면 범위 집합을 한 번 다시 계산 | 〃 |
| K11 한글 줄·번역 | — | 강조하지 않는다(단어 대응이 없다) | 〃 |
| K12 글자 가림 | 수업 ① 느리게 첫 듣기(`hidden`) | — | 단어 강조 없음(막대만) · 줄 배경·다음 줄 예고는 유지 |
| K13 다음 줄 예고 | 수업 구간 재생에서 지금 줄의 **마지막 단위가 시작됨**(timing 필요) | — | 다음 줄 왼쪽 3px 막대(모양 단서) — 다음 줄이 시작되면 사라지고 그 줄이 배경 강조로 |
| K14 실시간 턴 재생 | 스트리밍 모드(문장이 드러나는 중) | K2 와 같음 — 드러난 문장 조각 안에서 밑줄(루비 없음 → 넓힘 없음). `done` 으로 바뀌어도 재생 중이면 같은 단위가 이어진다(모드 전환 때 밑줄이 한 번 끊겼다 다시 붙어도 레이아웃 0) | — |
| K15 일시정지·배속 | — | 앱에 일시정지가 없다(■ = 끝) [확인 `ttsAudio.ts`]. 속도는 합성 단계(`speechProfile`·수업 `pace`)라 timing 이 그 소리 기준 — 클라 배속 없음. 나중에 배속을 넣으면 위치에 배속을 곱한다 | 〃 |

**B. 회화 말풍선 (`TalkTutorBubble.tsx`)**
```
스트리밍 모드(K14) — 지금: chunks.map(c => <span key={c.chunkIndex} className={playingIndex===c.chunkIndex ? HIGHLIGHT : undefined}>{c.text}</span>)
           → 재생 중 조각에 단위가 있으면 그 <span> 안을 단위·사이 조각 <span> 으로 나눠 그린다(key = 조각 안 시작 좌표 — 문장 내내 고정).
             루비가 없으므로 넓힘 없음. 말풍선은 이미 aria-busy="true" 라 낭독 영향 없음.
done 모드 — 지금(K0):  ranges = playing ? [spanRange(spans, playingIndex, HIGHLIGHT)] : undefined        ← HIGHLIGHT = 'rounded-sm bg-accent-soft text-ink'
K2:        const k = useKaraokeUnit(message.id, playingIndex)    ← 재생 훅이 쓰는 저장소를 말풍선이 직접 구독(TalkRoom 무변경)
           if (k && spans && playing):
             off = spanRange(spans, playingIndex, '').start     ← 말풍선 안 문장 시작(코드포인트)
             ranges = karaokeRanges({ off, sentenceLen: cp(spans[playingIndex]), units: k.units, current: k.current,
                                      tint: 'bg-accent-soft text-ink', on: WORD_ON, off: WORD_OFF })
           → TutorBubble ranges={ranges}  (MessageBubble.tsx 무변경 — ranges 는 이미 받는다)
WORD_OFF = 'bg-accent-soft text-ink underline decoration-transparent decoration-[3px] underline-offset-[4px] motion-safe:transition-[text-decoration-color] motion-safe:duration-75'
WORD_ON  = WORD_OFF 에서 decoration-transparent → decoration-accent
```
- 문장 배경은 그대로 두고 **현재 단위만 밑줄** — 이유 ① 굵게·글자색·여백 변화는 줄바꿈을 바꿔 말풍선이 뛴다(밑줄·배경은 레이아웃 0) ② 강한 반전(`bg-accent text-on-accent`)은 배경이 루비 rt 까지 덮으면 `ink2` rt 명암이 무너진다 ③ 밑줄 `accent` vs 배경 `accent-soft` = 4.08:1(비텍스트 3:1↑ [확인 §1-1]), vs `surface` 4.80.
- 문장 전체를 단위·사이 조각 범위로 **빈틈없이 덮는다**(사이 조각 = 구두점 등, `tint` 만). 그래서 배경 모양은 지금과 같다(조각 모서리 둥글림은 빼서 이음매가 안 보이게 — 2px 차이).
- 루비 rt 위에는 밑줄이 없다(본문 글자 아래에만). `[한글]` 줄·번역 칸 무강조.

**C. 단위 만들기 규칙 (`components/speech/karaoke.ts` — 순수 함수, 단위 테스트)**
1. `validTiming(text, timing, durationMs?)`: `words` 비어 있지 않음 · 각 `0 ≤ charStart < charEnd ≤ cp(text)` · `startMs`·`charStart` 오름차순, 겹침 없음 · (`w.text` 가 있을 때만) `Array.from(text).slice(charStart, charEnd).join('') === w.text` · `0 ≤ startMs < endMs` · 마지막 `endMs ≤ durationMs + 250`(알 때). 하나라도 실패 → K7(조용히 K0, 개발 로그에 개수만 — 글 0).
2. `snapUnits(words, rubyPieces | null)`: 히라가나 켬 + 분석 ready 면, 단위 경계가 읽기 있는 루비 묶음 한가운데에 걸릴 때 그 묶음 끝까지 넓힌다(`cutRubyByRanges` 는 묶음을 자르면 그 묶음 읽기를 뺀다 [확인 `annotations.ts:443`] — 넓히지 않으면 강조가 지나갈 때마다 히라가나가 깜빡인다). 넓힌 뒤 겹치는 단위는 합친다(시각 = 앞 start ~ 뒤 end).
3. `unitAt(units, ms, holdMs=250)`: 이진 탐색, `ms + KARAOKE_LEAD_MS(40)` 기준 — rAF 지연·눈 인지 보정 [추측 — 스파이크 기준값으로 조정].
4. **범위 집합은 그 문장을 재생하는 동안 바뀌지 않는다** — 바뀌는 것은 `className` 뿐(아래 §7 접근성 이유). 집합이 바뀌는 때 = 문장 바뀜·timing 도착·히라가나 토글뿐.

**D. 수업 ① 줄 (`StageUnderstand.tsx` — 줄 렌더 `:191-202`, 가림 줄 `:179-190`)**
```
지금: <div className={`… ${now ? 'bg-accent-soft' : ''}`}> … <JaText text={d.ja} state={anns[idx]} className=… /> …
K2:   const w = pb.wordOf(pk ?? lineReplayKey(idx))           ← { lineIdx, units, current } | null
      <JaText … ranges={w && w.lineIdx === idx && !hidden ? karaokeRanges({ off: 0, sentenceLen: cp(d.ja), units: w.units, current: w.current,
                                                                       tint: '', on: LINE_WORD_ON, off: LINE_WORD_OFF }) : undefined} />
      LINE_WORD_OFF = 'underline decoration-transparent decoration-[3px] underline-offset-[4px] motion-safe:transition-[text-decoration-color] motion-safe:duration-75'
      LINE_WORD_ON  = 'underline decoration-accent decoration-[3px] underline-offset-[4px] …'      ← 줄 배경이 이미 accent-soft
K13:  const preview = pb.previewNext(pk) && li === line + 1
      <div className={`… ${now ? 'bg-accent-soft' : ''} ${preview ? 'shadow-[inset_3px_0_0_var(--color-accent)]' : ''}`}>    ← 가림 줄(:181)도 같은 클래스
```
- 다음 줄 예고는 **구간 재생(`seg:k:slow|normal`)에서만** — 줄 다시 듣기(한 줄)·마지막 줄·자막만에는 없다. 막대는 레이아웃 0(inset shadow), 글·`aria` 0.
- 줄 그리드·▶ 버튼·상태 줄(`role="status"` 문구) 무변경 — 상태 줄에 단어 정보를 넣지 않는다(낭독 폭주).

#### 3. API·데이터 계획 (화면이 받아야 하는 것 — 계약은 Leader)
화면이 필요한 것 = 소리 조각(턴 청크·다시 듣기 문장·수업 clip)마다 `words[{charStart, charEnd, startMs, endMs}]` — **그 조각 글 기준·코드포인트**, `startMs` 는 그 wav 시작 기준. `text`(단어 글)는 선택 — 있으면 검증(§2-C ①)에 쓰고, 없으면 화면이 아는 조각 글로 잘라 본다(헤더 크기·로그 노출을 줄이려면 빼는 쪽을 권고).

| 자리 | 소리를 받는 곳 | 권고 공급(D-T1) | 대안 |
|---|---|---|---|
| 회화 실시간 턴 | 재생 큐 `fetchAudio` → #24 `GET /api/v1/speech/tts/:token`(SSE `audio.url`) | **#24 wav 응답 헤더 `X-Tts-Timing`**(base64url JSON, `TtsCache.timing` 에서 — HIT·MISS 모두 B 로 이미 있음). 구 캐시 행이면 헤더 없음 → K0 | SSE `audio.timing`(TalkRoom·#32 변경 — C10 순서 문제) · #24 `Accept: application/json` 따로(청크마다 요청 1회 추가) |
| 회화 ▶ 다시 듣기 — 보관본 | 같은 턴 청크(이미 받은 응답) | 위 헤더를 받을 때 청크별로 보관해 둔 값을 그대로 | — |
| 회화 ▶ 다시 듣기 — #23 문장별 | `apiPostAudio('/api/v1/speech/tts', …)`(`useTalkPlayback.ts:104`) | **#23 wav 응답에도 같은 헤더** | #23 JSON 변형(`{url, timing}`) + #24(문장마다 왕복 1회 늘어 첫 소리가 늦어짐) |
| 수업 ① #62c | clip 마다 `fetchChunkAudio(c.url)`(#24) | **D-T2**: #24 헤더(clip 글 기준) + #62c `clips[].charStart`(그 clip 이 줄 `ja` 에서 시작하는 코드포인트 — 화면은 clip 글을 모른다, `api-contract.md:1116`) | #62c `clips[].timing` 을 줄 기준 좌표로 직접(헤더 불필요) |
- 헤더를 읽으려면 `common/api.ts` 에 **추가 export 1개**(`apiGetAudioMeta(path, opts) → {data, timing|null}`, #23 용은 `apiPostAudio` 반환에 `timing` 칸 추가)가 필요하다 — 공용 파일이라 Leader 확인(지금 미커밋 변경 없음 [확인 `git status`]). `chunkFetch.ts` 는 고치지 않고 getter 를 감싸서 쓴다.
- `phonemes[]`·`alignerVersion`·`method` 는 화면이 쓰지 않는다(헤더에 싣지 않아도 됨).
- timing 없음(`null`·헤더 없음)은 정상 값 — 화면은 오류로 다루지 않는다.

#### 4. 상태 관리
- **재생 위치 시계**: `ttsAudio.ts` 의 `TtsPlayback` 에 `positionMs()` 추가 — AudioContext 경로 = `(ctx.currentTime - startedAt) * 1000 - latencyMs`(`latencyMs = (ctx.outputLatency || ctx.baseLatency || 0) * 1000` — 안드로이드 출력 지연을 빼야 강조가 소리보다 앞서지 않는다), `HTMLAudioElement` 경로 = `el.currentTime * 1000`. 큐(`modules/speech/tts/client/playbackQueue.ts`) `PlaybackHandle.positionMs?()` + `queue.positionMs(): number | null`(지금 소리 나는 조각 기준, 선택 메서드 — 기존 테스트 무영향).
- **저장소**: `karaoke.ts` 의 작은 외부 저장소(`subscribe/getSnapshot`) — 키 = 메시지 id(회화) / 재생 key(수업). 값 = `{ partIndex, units, current } | null`. 말풍선은 `useSyncExternalStore` 로 자기 id 만 본다(TalkRoom 이 props 를 새로 넘길 필요 없음 → **TalkRoom 무변경**).
- **틱**: `requestAnimationFrame` 은 ① 소리 나는 조각에 유효한 timing 이 있고 ② 화면이 보일 때만 돈다. 매 프레임 `unitAt` 을 계산하되 **값이 바뀔 때만** 저장소를 갱신(초당 2~5회) — 목록 전체가 다시 그려지지 않게. idle·blocked·hidden 이면 루프 0.
- **조각 메타**: 큐 deps 의 `fetchAudio` 와 `playParts` 조각 함수가 `ArrayBuffer` 대신 `{ buf, timing }` 도 돌려줄 수 있게 하고(둘 다 받기 — 기존 호출 무영향), 큐가 슬롯·조각마다 `timing` 을 보관해 `queue.timingOf(messageId, index)` 로 내준다. 보관본(`buffersOf`)으로 다시 들을 때도 같은 timing 이 따라간다(따로 묻지 않음).
- **회화 턴** `useTalkPlayback`: `fetchAudio: (url, s) => fetchChunkAudio(url, s, getterThatCapturesHeader)` — `chunkFetch.ts` 의 재시도 규칙 그대로, 성공한 응답의 `X-Tts-Timing` 만 잡아 `{buf, timing}`. 소리 받는 순서·동시 수(2)·요청 수 변화 0.
- **회화 다시 듣기 #23**: `apiPostAudio` 응답의 `timing` 을 조각 결과에 같이 넘긴다. 보관본 경로는 큐가 가진 값.
- **수업** `useLessonPlayback.playLines`: clip 마다 받은 `timing`(clip 글 기준) → 줄 좌표로 = `+ clips[i].charStart`(D-T2), 시각은 clip 시작 위치 = 앞 clip 길이 합 + `pauseBeforeMs` 합(`concatWav` 와 같은 규칙). 길이는 받은 wav 에서 `parseWav`(`components/lesson/wav.ts` — **수정 없이 import**)로 — 서버 `durationMs` 는 `null` 일 수 있다 [확인 `types/lesson.ts:266`]. clip 하나라도 timing 이 없으면 그 줄 전체 K0(줄 중간에 강조가 끊기면 더 어색하다). `pb.wordOf(key)`·`pb.previewNext(key)` 를 `LessonPlayback` 에 추가.
- **B 산출의 경계 보정**(스파이크 위험 기록 반영): 첫 실음소 시작이 소리 시작보다 48~94ms 늦게 찍히고, 마지막 실음소 끝이 소리 끝보다 97~185ms 이르다 [스파이크 실측] → ① `KARAOKE_LEAD_MS`(기본 40)로 앞당겨 맞추고 ② **마지막 단위의 끝은 그 조각 wav 끝까지 늘린다**(문장 끝에서 밑줄이 먼저 사라지지 않게). 한자 1자 단위는 근사라 단위는 늘 단어 이상(스파이크 위험 4).

#### 5. 생성/수정 파일 (src/app·src/components·client)
| 파일 | 새/수정 | 내용 | 경계 |
|---|---|---|---|
| `src/components/speech/karaoke.ts` (+ `__tests__/karaoke.test.ts`) | 새 | `validTiming`·`snapUnits`·`unitAt`·`karaokeRanges`·저장소·`useKaraokeUnit`·rAF 틱 | 새 파일(012b-2 의 새 파일들과 이름 겹침 없음) |
| `src/components/speech/ttsAudio.ts` | 수정 | `positionMs()` | 012b-4 "필요 시" |
| `src/modules/speech/tts/client/playbackQueue.ts`(+`index.ts` export) | 수정 | `PlaybackHandle.positionMs?` · `queue.positionMs()` · `{buf, timing}` 받기 · `queue.timingOf()` | `client/**` = 012b-4 (C13 의 012b-3 파일과 겹치지 않음) |
| `src/components/common/api.ts` | 수정(**추가만**) | `apiGetAudioMeta` 새 export · `apiPostAudio` 반환에 `timing` 칸 | 공용 파일 — **Leader 확인**(현재 미커밋 변경 없음) |
| `src/components/talk/useTalkPlayback.ts` | 수정 | 헤더 잡는 getter·틱·저장소 | 012b-4 소유 |
| `src/components/talk/TalkTutorBubble.tsx` | 수정 | 스트리밍 조각 나누기 · done 모드 ranges | 012b-4 소유 |
| `src/components/lesson/useLessonPlayback.ts` | 수정 | clip timing·offset·`wordOf`·`previewNext` | 012b-4 소유 |
| `src/components/lesson/StageUnderstand.tsx` | 수정 | 줄 ranges·예고 막대 | 012b-4 소유 |
| **건드리지 않음** | — | `TalkRoom.tsx`(SSE 처리 무변경 — D-T4) · `talk/chunkFetch.ts`(getter 를 감싸 씀) · `chat/MessageBubble.tsx`(ranges 이미 있음) · `common/japanese/*`(기존 export 만) · `lesson/{logic,wav}.ts`(import 만 — `playLineReplay` 가 `playLines` 를 부르므로 자동 적용) · 서버 timing 부착·#24/#23 헤더·#62c `charStart`(developer ②③ 단계, 012b-3 뒤) | |

#### 6. 구현 순서 (화면 부분 — 서버 ②③ 뒤)
1. `karaoke.ts` 순수 함수 + 테스트: 검증 실패 7가지 · 루비 넓힘(「昨日」 한가운데 경계 → 묶음 전체) · 겹침 합치기 · 쉼 유지 250ms · 마지막 단위 끝 = wav 끝 · 범위 집합이 문장 내내 같은지(className 만 바뀜).
2. `positionMs()`·`{buf, timing}`·`timingOf()`(ttsAudio·queue) + 큐 테스트(가짜 handle·가짜 fetch — 기존 `ArrayBuffer` 반환도 그대로 통과).
3. `api.ts` 추가 export → 회화 턴·다시 듣기(서버 #24·#23 헤더 단계와 짝) → 수업 ①(#62c `charStart` 와 짝).
4. 3폭 × 히라가나·한글 켬/끔 화면 확인 → QA.

#### 7. 주의사항 · QA 체크리스트
- **TTFA 영향 없음 UI 규칙**(완료 기준 5): ① 실시간 턴의 SSE 처리(`TalkRoom`)·요청 수·받기 순서·동시 수 변화 0 — 바뀌는 것은 이미 받는 #24 응답에서 헤더 하나를 읽는 것뿐 ② timing 때문에 소리 시작을 **기다리게 하지 않는다**(헤더가 없거나 깨져도 소리는 그대로 — 턴 첫 소리·다시 듣기 첫 소리 지연이 지금 ±10% 안, 각 30회 비교) ③ 강조가 켜지고 꺼져도 레이아웃 변화 0(말풍선·줄 높이가 재생 전 = 재생 중 — `ResizeObserver` 로 0px, 회화 목록이 바닥 따라가기를 일으키지 않음) ④ timing "받는 중" 표시를 만들지 않는다 ⑤ rAF 는 소리 나는 동안·화면이 보일 때만.
- **접근성**: 회화 목록은 `role="log" aria-live="polite" aria-relevant="additions"`(`MessageList.tsx:296-299` [확인]) — 단어마다 `<span>` 을 새로 만들면 TalkBack 이 조각 글을 반복해서 읽을 수 있다. 그래서 §2-C ④ "범위 집합 고정·className 만 교체"(`JaText` 의 run key 가 순번이라 집합이 같으면 DOM 노드가 그대로). `<mark>` 금지(`as` 생략 = span), `aria-current`·`aria-live` 추가 0 — 강조는 장식이다. QA: TalkBack 켜고 3문장 답장 ▶ — 추가 낭독 0.
- 360/390/412 × 780/892 × 히라가나·한글 켬/끔: 재생 중 줄바꿈 변화 0(밑줄·배경만이라 폭 불변), 밑줄이 아래 줄 루비·`[한글]` 줄과 겹치지 않음(줄간격 1.7·2.1 두 경우 눈 확인), 가로 넘침 0.
- 동기 어긋남(완료 기준 4): 스파이크가 제안한 **단어 시작 |오차| p95 ≤100ms(목표 ≤50ms)** 를 화면 기준으로 쓴다. QA 방법 제안: S25 화면 녹화(내부 소리 포함)로 밑줄 시작 프레임 ↔ 소리 시작 비교, 3문장·30단어 [추측 — 녹화 프레임 간격 16ms 오차 포함]. 앱 WebView·웹 Chrome 둘 다(출력 지연이 다르다).
- 터치: 새 터치 대상 0(단어 탭 → 그 구간 재생은 16 §8.3 Pronunciation Practice — 범위 밖).
- reduced-motion: `motion-safe:` 전환만, 그 밖 애니메이션 0.
- 엔진명 0: 화면·DOM·콘솔에 `method`·`alignerVersion`·엔진 이름 0(화면은 그 칸을 읽지도 않는다). 오류 로그는 개수만.

#### 8. 자체 점검 (ui-design-reviewer · ui-accessibility-reviewer)
- 디자인 P0 0 · P1 0.
  - P2-1 단어 단위가 루비 묶음으로 넓혀지면(히라가나 켬) 한자어 두 단어가 한 단위로 합쳐질 수 있다 — 깜빡임 방지와 맞바꾼 것. 히라가나 끔이면 글자 단위 그대로.
  - P2-2 다음 줄 예고(K13)는 해석 [추측](§0-4). 사용자가 원한 "섀도잉 강조"와 다르면 Phase 3 섀도잉 화면으로 미룬다(D-T5).
- a11y Critical 0 · Major 0.
  - Minor-1 강조는 시각 전용 — 스크린리더 사용자에게 단어 위치를 주지 않는다(의도: 소리 자체가 내용, 낭독과 겹치면 방해).

#### 9. Leader·developer 결정 필요
| # | 항목 | 권고 |
|---|---|---|
| D-T1 | 앱 → 화면 timing 운반 = **#24·#23 wav 응답 헤더 `X-Tts-Timing`**(M4 → 앱과 같은 방식) · 헤더 크기 상한·`text` 생략 여부 | 헤더(대안: SSE `audio.timing` — TalkRoom·#32 변경 필요) |
| D-T2 | #62c `clips[].charStart`(clip 이 줄에서 시작하는 코드포인트) 추가 | 추가(대안: `clips[].timing` 줄 좌표 직접) |
| D-T3 | 좌표 = **조각 글 기준·코드포인트** 로 정본 정정 — 16 §8.1 "replyJa 좌표" 문구 · `source`/`method` 이름 통일 · 16 §8.2 "첫 청취는 강조 없이"(A 전제) 삭제 | 정정 |
| D-T4 | 실시간 턴 재생도 강조(헤더 방식이면 TalkRoom·SSE·#32 무변경) | 포함 |
| D-T5 | "섀도잉 강조" = 수업 ① 다음 줄 예고로 해석 | 해석대로 진행, 다르면 Phase 3 |
| D-T6 | `common/api.ts` 추가 export(공용 파일) | 허용 |
| D-T7 | 완료 기준 3 정정: "MISS 첫 재생은 timing 없음 → HIT 부터" → B 에선 "MISS 첫 재생부터 있음, 012b-4 이전 캐시 행만 없음" | 정정 |

## Developer 기록

### 스파이크 (dev-012b4-spike)

- [21:52] **착수 — 접근 확인 OK**: `ssh -o BatchMode=yes -o ConnectTimeout=8 brownjeon@192.168.219.100 true` → exit 0. 운영 `:8200/health` = `{"status":"OK","warmedUp":true}`. M4 현황(읽기만): macOS 26.3 · 디스크 여유 260GiB · RAM 24GB(여유 68%, Ollama llama-server 2개 ≈6.3GB·tts uvicorn RSS ≈0.66GB 상주) · `/opt/homebrew/bin/python3.11` 3.11.16 · 운영 venv 핀 10종 = requirements.txt 그대로 · 운영 HEAD `36f3795` 추적 파일 변경 없음 · `~/kaiwa-tts-spike` 없음(새로 만든다).
- [21:52] **사전 발견(설치 방법에 영향)**: narabas 는 **PyPI 에 없다**(`pypi.org/pypi/narabas` 404) — GitHub `darashi/narabas`(MIT, v0.1.0, 마지막 push 2023-03, "experimental"). 추론은 **onnxruntime(CPUExecutionProvider 고정, cuda 만 선택)** 이라 torch MPS 를 쓰지 않는다 — torch 는 다운로드·`torchaudio.load`·resample·log_softmax 에만. 모델 `narabas-v0.onnx`(wav2vec2-large LV60K 기반, GitHub release, 첫 실행 때 내려받음). 선언 의존성 `torchaudio ^0.13.1`(=<0.14)·`librosa ^0.9.2`·`onnxruntime ^1.14` → **운영 핀 torchaudio 2.11.0 과 정면 충돌** — 의존성 해석으로 설치하면 안 되고 `--no-deps` + onnxruntime 만 핀 제약으로 넣어야 한다 [확실 — pyproject.toml·narabas.py 원문 읽음]. 정렬(Viterbi)은 순수 Python 이중 루프.
- [21:52] **설치 계획·용량**: `~/kaiwa-tts-spike/.venv`(python3.11) 에 운영 핀 그대로(`requirements.txt` 사본) + narabas(`--no-deps`, git sha 고정) + onnxruntime(`-c` 핀 제약) → `check_pins.py` 로 핀 유지 확인. B(VITS duration)는 같은 venv 에서 SBV2 를 CPU 로 띄워 확인 — 모델은 `jvnv-F1-jp` 를 스파이크 디렉터리로 **복사**(운영 `model_assets` 는 읽기만), BERT 는 HF 공용 캐시 오프라인. 예상 용량 **약 3~5GB**(venv 2~3GB + narabas onnx ≈1.2GB + 모델 사본 ≈0.25GB). 운영 venv·8200·crontab·launchd 무변경.
- [22:03] **스파이크 결과 — 결론 먼저: B(엔진 duration) 채택을 권고, A(narabas)는 운영 설치하지 않는 것을 권고.** 결정은 Leader.

**설치 로그 요약** (`~/kaiwa-tts-spike/logs/setup.log`, 25초 — pip 캐시)
| 단계 | 명령 | 결과 |
|---|---|---|
| 1 | `pip install -r requirements.prod.txt`(운영 핀 사본) | 성공 → `check_pins.py` **PINS OK**. 단 핀 밖 전이 의존성은 운영과 다르게 들어온다(예: numba 운영 0.67.0 ↔ 새로 0.68.0) — requirements.txt 만으로 운영 venv 가 똑같이 재현되지 않는다 [확실 — 두 venv pip list 비교] |
| 2 | `pip install -c constraints.txt onnxruntime` | 성공(onnxruntime 1.30.0 + flatbuffers·protobuf 7.36.2 추가, numpy 1.26.4 유지) → PINS OK |
| 3 | `pip install --no-deps git+https://github.com/darashi/narabas@b5e6511…` | 성공(narabas 0.1.0) |
| 3b | 같은 것을 의존성 포함 `--dry-run -c constraints.txt` | **ResolutionImpossible**(torchaudio 0.13 배포본 없음) — `-c` 가 핀 훼손을 막는다 |
| 4 | `pip check` | **exit 1** — narabas 가 `torchaudio<0.14`·`librosa` 를 요구한다고 보고. 운영 반영 시 `pip check` 를 쓰는 절차가 있으면 걸린다 |
| 주의 | pip constraints 파일은 extras(`uvicorn[standard]`)를 거부 → 사본에서 `[...]` 를 지운 `constraints.txt` 를 따로 만들어야 했다 | |
- 런타임 확인: `torch.backends.mps.is_available()` **True**(스파이크 venv) · onnxruntime providers = CoreML·Azure·CPU · `torchaudio.functional.forced_align` 있음(2.11) · **`torchaudio.load` 실패**(2.11 은 torchcodec 필요) → narabas `align(경로)` 는 **원본 그대로는 동작하지 않는다**, 메모리 배열을 넘기도록 우회해야 한다 [확실 — 실행].

**측정 방법·기준**
- 문장: `speech/tts-service/scripts/bench_synth.py` 의 고정 20문장(저장소 작성 합성 문장, 학습자 데이터 0) + 경계 3문장(숫자·쉼표·카타카나 장음, 로컬 합성만).
- 운영 경로: M4 로컬 `127.0.0.1:8200/synthesize` 순차 20회(기본 파라미터·jvnv-F1-jp, 문장 사이 0.3s) — **20/20 200**, 서버 합성 p50 289ms(첫 요청 665ms, 새 음소 길이 셰이더 컴파일로 보임). 시크릿은 `~/kaiwa-tts-run/.env` 에서 읽기만, 출력 0.
- **기준(오차의 정답)**: 사람이 라벨링한 정답이 없으므로 **B(그 합성 자체가 쓴 VITS 프레임 배분)를 기준으로 삼는다** — `Σ(토큰별 프레임) × hop(512)` 가 오디오 샘플 수와 **정확히 일치**(기본·느리게 28/28)하므로 디코더가 실제로 그 순서·길이로 프레임을 만들었다 [가능성 높음 — 디코더 합성곱의 수십 ms 번짐은 남는다]. B 는 합성마다 확률적(sdp_ratio 0.2·noise_w)이라 운영 wav 와 비교할 수 없다 → **로컬(스파이크 venv, CPU)로 합성한 같은 wav 에 A 를 돌려 A−B 를 잰다**. 운영 wav 20개에는 A 의 성공률·속도·에너지 기준 onset 차만 잰다.
- 화면 강조 허용 기준(제안): 단어 시작 |오차| **p95 ≤ 100ms**(목표 ≤ 50ms). 근거: 소리·화면 어긋남은 수십 ms 단위에서 지각되기 시작한다(방송 AV 동기 권고 ITU-R BT.1359 의 검지 한계 대략 +45/−125ms) [가능성 높음 — 수치는 기억에 의존, 원문 대조 안 함]. QA 완료 기준 4 의 "어긋남 ≤ 기준" 값으로 쓰면 된다.

**A vs B 요약** (A = narabas onnx 출력을 정렬. `fa` = 같은 출력을 `torchaudio.functional.forced_align` 으로 정렬, `원본` = narabas 자체 Viterbi)
| 항목 | A 원본 | A fa | B |
|---|---|---|---|
| 정렬 성공(음소 수·순서 일치) | **46/51**(운영 19/20 · 로컬 21/23 · 느리게 4/5 · pitch 2/3) — 실패는 전부 **첫 음소 누락**(`今日は`→`ky`, `先生の`→`s`) | **51/51** | 31/31(로컬 CPU) + 3/3(MPS) |
| 처리 시간(운영 wav, 2.1~3.4s 음성) p50 / p95 | 154 / 187ms | **105 / 121ms**(onnx 71~128ms + 정렬 0~9ms) | 합성 안에서 **0.05~0.3ms**(CPU). MPS 는 24~32ms 로 찍혔으나 측정 구간에 `torch.mps.empty_cache()` 를 넣은 탓 [가능성 높음 — 운영은 이미 매 합성 뒤 호출] |
| RTF p50 | 0.052 | 0.036(CPU 전 코어) · 0.059(스레드 2) · 0.109(CoreML, 5문장, 첫 문장 533ms) | ≈0 |
| 메모리(프로세스 RSS) | +2.4GB | +2.9GB(CPU) · +3.1GB·peak 4.6GB(CoreML) | 추가 0(이미 있는 attn 텐서) |
| 모델 로드 | 1.4s | 0.9s(CPU) · 2.2s(CoreML) | 0 |
| 같은 음성 A−B 단어 **시작** \|오차\| (로컬 23문장·237단어) | p50 19 · p95 61 · max **215**ms · ≤100ms 96.8% | p50 **18** · p95 **50** · max 68ms · ≤50ms 97.5% · ≤100ms **100%** · 편향 −11ms | 기준 |
| 같은 음성 A−B 단어 **끝** | p95 138 · max 392ms | p95 92 · max 231ms(CTC 출력이 뾰족해 끝 경계가 부정확) | 기준 |
| 음소 시작(867개) | p50 27 · p95 76ms | p50 27 · p95 65ms(B 앞 blank 중점 기준이면 p50 20 · p95 56) | 기준 |
| 느리게(length 1.25) 단어 시작 | p95 120ms | p95 63 · max 74ms | Σ프레임×hop = 샘플 5/5 |
| pitch 1.1(pyworld 재합성) 단어 시작 | p95 103ms | p95 50ms | 오디오가 24~193샘플(≤4.4ms) 길어짐 — 무시 가능 |
| 장치 | onnxruntime CPU(MPS 미사용). CoreML 은 **CPU 보다 3배 느림** | 같음 | 운영과 같은 장치(MPS)에서 동작 확인 |
| 문자 좌표 | g2p 결과를 문자로 되돌리는 매핑이 따로 필요 | 같음 | SBV2 `clean_text` 의 `word2ph`(문자별 음소 수)로 **문자 단위 시각이 바로 나온다** — 단 SBV2 `norm_text` 좌표(아래 위험 3) |

**문장별** (운영 wav = A 성공·시간 / 로컬 wav = 같은 음성에서 A(fa)−B 단어 시작 차, E0~E2 = 경계 문장 로컬만)
| # | 음성 s | 운영 합성 ms | A narabas 원본 | A fa 정렬 ms (RTF) | 같은 음성 A(fa)−B 단어 시작 평균/최대 ms (단어) | B 추출 ms |
|---|---|---|---|---|---|---|
| 00 | 2.832 | 665 | **첫 음소 누락** | 121 (0.043) | 22 / 61 (10) | 0.3 |
| 01 | 2.705 | 298 | OK | 105 (0.039) | 23 / 68 (12) | 0.07 |
| 02 | 3.355 | 289 | OK | 120 (0.036) | 20 / 50 (12) | 0.08 |
| 03 | 3.297 | 290 | OK | 121 (0.037) | 16 / 29 (11) | 0.06 |
| 04 | 3.053 | 283 | OK | 112 (0.037) | 17 / 28 (9) | 0.06 |
| 05 | 2.937 | 282 | OK | 93 (0.032) | 18 / 50 (13) | 0.05 |
| 06 | 3.424 | 297 | OK | 128 (0.037) | 17 / 40 (11) | 0.06 |
| 07 | 2.426 | 283 | OK | 94 (0.039) | 24 / 38 (7) | 0.06 |
| 08 | 3.401 | 284 | OK | 112 (0.033) | 17 / 61 (10) | 0.06 |
| 09 | 3.366 | 294 | OK | 111 (0.033) | 25 / 50 (12) | 0.06 |
| 10 | 2.647 | 284 | OK | 91 (0.034) | 20 / 50 (11) | 0.06 |
| 11 | 3.308 | 288 | OK | 109 (0.033) | 18 / 50 (11) | 0.06 |
| 12 | 2.844 | 291 | OK | 93 (0.033) | 25 / 50 (11) | 0.06 |
| 13 | 2.983 | 293 | OK | 93 (0.031) | 16 / 38 (12) | 0.06 |
| 14 | 2.844 | 289 | OK | 111 (0.039) | 16 / 44 (11) | 0.06 |
| 15 | 2.832 | 287 | OK(로컬 wav 에선 누락) | 89 (0.031) | 19 / 30 (9) | 0.06 |
| 16 | 2.565 | 283 | OK | 99 (0.039) | 18 / 30 (8) | 0.05 |
| 17 | 3.25 | 286 | OK | 105 (0.032) | 24 / 65 (13) | 0.06 |
| 18 | 2.554 | 297 | OK | 92 (0.036) | 22 / 38 (10) | 0.05 |
| 19 | 2.113 | 277 | OK | 73 (0.035) | 20 / 34 (7) | 0.06 |
| E0 | 2.159 | (로컬만) | - | - | 10 / 27 (11) | 0.05 |
| E1 | 3.03 | (로컬만) | - | - | 25 / 64 (8) | 0.06 |
| E2 | 2.461 | (로컬만) | - | - | 23 / 61 (8) | 0.06 |

**B 를 꺼내는 방법(코드 읽기 + 실행 확인, 라이브러리 무수정)**: SBV2 2.5.0 `SynthesizerTrnJPExtra.infer` 는 `(o, attn, y_mask, …)` 를 돌려주는데(`models_jp_extra.py:1157`), 상위 `models/infer.py:286` 이 `output[0]` 만 쓰고 `attn` 을 버린다. 모델 **인스턴스**의 `net_g.infer` 를 감싸 `out[1]` 을 보관하면 된다(`backend.py:91` 이 이미 쓰는 `_TTSModel__net_g` 핸들). `attn[0,0].sum(0)` = blank 를 끼운 토큰(`add_blank=true`, 길이 2N+1)별 프레임 수 → 음소 j = 토큰 2j+1, 프레임 = 512/44100 s(11.6ms). 문자 매핑은 `clean_text()` 의 `word2ph`(앞뒤 `_` 패드 포함, 문자별 음소 수).

**판정 권고 (Leader 결정 사항)**
1. **B 채택(`method: ENGINE_DURATION`)**. 이유: ① 정확도 — A(fa) 와 단어 시작 p50 18ms·p95 50ms 로 일치하고, B 쪽이 오디오 프레임과 정의상 맞물린다(Σ프레임×hop = 샘플) ② **동기 산출** — 합성과 같은 호출에서 1ms 미만으로 나오므로 비동기 후처리·캐시 뒤늦은 부착·"첫 청취는 강조 없음"(16 §8.2)이 필요 없다 → **TTFA 영향 0**, 16 §16 #6 의 "계산 위치·동기 여부"는 "M4 tts-service 합성 안, 동기"로 정리된다 ③ 새 의존성 0 — onnxruntime·1.26GB 모델·RSS +2.4~3.1GB·narabas(2023 이후 무관리, "experimental", 자체 Viterbi 결함, `torchaudio.load` 비호환)를 들이지 않는다 → **운영 핀·venv 를 건드릴 일이 없다**.
2. B 의 대가: SBV2 내부 구조 의존(`_TTSModel__net_g`·`infer` 반환 튜플 2번째·`word2ph` 의미·`add_blank` 끼움). 2.5.0 핀으로 고정돼 있고, 서비스 테스트에 "Σ프레임×hop = 샘플 수" 불변식 검사를 넣어 버전이 바뀌면 깨지게 하면 된다. 깨지면 `timing=null`(오디오 정상)로 떨어지게.
3. **A 는 이번에 운영에 넣지 않는다.** Phase 3 발음 분석(학습자 음성 정렬)은 원래 우분투 worker 자리라(`speech/worker/README.md:35,100`) 그때 다시 본다. 그때 쓰더라도 **narabas 패키지 대신 onnx 모델 + `torchaudio.functional.forced_align`(또는 자체 CTC 정렬 30줄)** 로 — narabas 원본 정렬은 10%(5/51) 첫 음소를 잃는다(같은 프레임 안에서 likelihood 를 제자리 갱신하면서 역추적은 프레임당 한 칸만 함).
4. **응답 운반·배포 순서(본 구현 설계에 반영 필요)**: 지금 `/synthesize` 요청 스키마는 `extra="forbid"`(`kaiwa_tts/schemas.py:21`) 라 **새 앱이 `timing: true` 를 보내면 구 M4 가 400** 을 낸다 — 이력서 "호환" 요건(새 앱 × 구 M4 → `timing=null`)과 충돌. 요청 쪽 새 키 없이 **M4 가 항상 응답 헤더(예: `X-Kaiwa-Timing`, base64url JSON — 단어·문자 범위·음소, 20자 문장 기준 수백 B~2KB 추정 [추측])로 싣고, 구 앱은 모르는 헤더를 무시**하는 안이 배포 순서와 무관하다. 대안(요청 헤더 opt-in / 400 시 재시도)은 Leader 판단. 헤더 크기 상한(Node undici 기본 16KB [가능성 높음])·nginx 를 거치지 않는 LAN 직접 호출임을 본 구현에서 확인.
5. 만약 Leader 가 A 를 고르면(설치 절차·핀 보호): `pip install -c constraints.txt onnxruntime==1.30.0`(constraints = requirements.txt 에서 extras 제거) → narabas 는 **pip 설치 대신 `narabas.py`·`symbols.py` 두 파일(MIT, 저작권 고지 유지)을 vendoring** 하고 정렬은 `forced_align` 으로 교체(→ `pip check` 오류·git 의존 제거) → requirements.txt 에 `onnxruntime==1.30.0`·`protobuf==7.36.2`·`flatbuffers==25.12.19` 핀 추가(`check_pins.py` 가 대조) → 모델 1.26GB 는 git 밖 `model_assets/_aligner/narabas-v0.onnx`(sha256 앞 16자 `ac9983740343b260`)에 두고 `deploy-from-ubuntu.sh` 는 "모델 파일 존재·sha 대조" 1단계 추가 → onnxruntime `intra_op_num_threads` 를 2로 제한(SBV2·Ollama 와 CPU 공유; RTF 0.036→0.059) → 정렬은 오디오 응답 뒤 별도 큐(합성 워커 스레드와 분리). 배포 스크립트는 venv 에 설치하지 않으므로 **패키지 설치 단계 자체가 지금 배포 스크립트에 없다** — A 를 고르면 설치는 사용자 승인 후 수동(또는 스크립트 확장)이다.

**남은 위험·확인 못 한 것**
- [확인 못 함] 운영 MPS 합성과 A(CPU) 동시 실행 시 합성 지연 증가 — 운영 요청을 20회로 제한해 재지 않았다. B 를 고르면 해당 없음.
- [확인 못 함] B 의 절대 정확도(사람 라벨 대비). 근거는 A 와의 일치 + 프레임 수 = 샘플 수뿐. 에너지 기준 sanity: B 첫 실음소 시작이 에너지 onset(−35dB) 보다 48~94ms 늦고, 마지막 실음소 끝이 에너지 offset 보다 97~185ms 이르다(문장 끝 `.`·`_` 토큰에 숨·잔향이 실림) — A 도 같은 방향(onset +10~110ms). 마지막 단어 끝은 오디오 끝까지 늘리는 규칙이 필요.
- 위험 3 — **좌표**: B 의 문자 좌표는 SBV2 `normalize_text` 결과(`norm_text`) 기준이다. SBV2 는 서비스 입력을 다시 바꾼다(`。`→`.`, `、`→`,`, `？`→`?`, `3時15分`→`三時十五分`, 기호 제거 가능). 앱 정규화기가 숫자는 이미 읽기로 바꾸므로(`src/modules/speech/tts/normalizer.ts`) 남는 건 주로 구두점·폭·기호 — 서비스가 `norm_text`↔입력 텍스트를 문자열 대응(difflib 류)으로 되돌려 **입력 텍스트 좌표**를 내고, 앱이 자기 token map 으로 `replyJa` 좌표로 한 번 더 되돌리는 2단 매핑이 필요하다 [가능성 높음 — 매핑 코드는 아직 안 씀].
- 위험 4: 한 단어 안 여러 한자(예 `今日`=ky·o|o)는 `word2ph` 가 음소를 문자에 나눠 준 근사값 — 단어 단위 강조는 정확, 한자 1자 단위 강조는 근사.
- pip 공용 캐시(`~/Library/Caches/pip`)에 onnxruntime·narabas 빌드 휠이 추가됨(운영 venv 무관). MPS 셰이더 디스크 캐시가 스파이크 프로세스로 몇 건 생겼을 수 있다 [추측].

**M4 에 남긴 것** — `~/kaiwa-tts-spike/` **2.8GB**: `.venv` 1.4GB(운영 핀 + onnxruntime 1.30.0 + narabas 0.1.0) · `cache/narabas/narabas-v0.onnx` 1.2GB · `model_assets/jvnv-F1-jp` 240MB(운영 사본) · `wav/` 14MB(합성 문장만) · `out/`·`logs/`·스크립트. 프로세스 0개, crontab·launchd·pf 무변경. 정리는 사용자 판단(`rm -rf ~/kaiwa-tts-spike` — B 채택 시 남길 이유 없음). **운영 무변경 확인(22:00)**: `:8200/health` OK·warmedUp · `~/kaiwa-tts-run` HEAD `36f3795`·추적 파일 변경 0 · 운영 venv `check_pins.py` **PINS OK**.

**원자료(우분투 scratchpad)**: `/tmp/claude-1000/-home-brownjeon-NFS-homes-brownjeon-project-TheKaiwa/729e3300-9a56-4bdf-bda2-ca7f7603c97f/scratchpad/` — 스크립트 `common.py·fetch_prod.py·spike_a.py·spike_b.py·compare.py·table.py·setup_venv.sh`, 결과 `m4-results/out/*.json`·`m4-results/logs/*`(세션 임시 경로 — 지워질 수 있음, M4 `~/kaiwa-tts-spike/out` 에 같은 사본).

**체크포인트** — 완료: 스파이크(접근·설치·A/B 실측·권고) / 남은 일: Leader 의 A·B 결정 → 본 구현(M4 timing 산출·운반 방식·앱 부착) / 다음 첫 행동: Leader 결정이 B 면 `kaiwa_tts/backend.py` `Sbv2Backend.infer` 에 인스턴스 래퍼(모델 로드 시 1회) + `word2ph` 매핑 + 불변식 테스트부터 / 주의점: 요청 스키마 `extra="forbid"` 로 인한 배포 순서 문제(위 4), `norm_text` 좌표(위험 3) / 미커밋 파일: 없음(저장소 변경은 이 이력서·20-Log 한 줄뿐).

### 본 구현 — M4 서비스 timing (dev-012b4-m4)

- [23:40] **중간 기록 1 (로컬 구현·테스트 끝, M4 실물 검증 전)**
  - 완료: `speech/tts-service/kaiwa_tts/timing.py`(신규 — 엔진 중립 계산: 프레임→ms·blank 가운데 경계·요청 글 코드포인트 되돌리기·겹침 합치기·불변식·헤더 인코딩) · `backend.py`(net_g.infer **인스턴스** 래퍼로 attn 토큰별 프레임 합·입력 토큰 id 보관 → `take_alignment()` 가 공개 함수 `clean_text`·`text_to_sep_kata` 를 같은 인자로 다시 불러 정규화 글·문자별 음소 수·단어 분할을 얻고 **모델이 실제로 받은 토큰 id 와 대조**) · `holder.py`(합성 뒤 `_timing` — 실패해도 오디오 그대로) · `params.py`(`SynthPlan.source_text` = 요청 원문) · `server.py`(헤더 `X-Tts-Timing`·`X-Kaiwa-Timing`·`X-Kaiwa-Timing-Ms`, 로그에 상태·단어 수만) · `__init__.py` VERSION 0.3.0→0.4.0 · `tests/conftest.py`(가짜 정렬) · `tests/test_timing.py`(신규) · `tests/test_api.py`(timing 7종 추가).
  - 로컬(우분투 `~/.node-local/thekaiwa-tts-test/venv`): pytest **117 passed, 1 skipped**(skip = 실제 SBV2 정규화기 검사, M4 전용) · ruff check/format 통과 · mypy strict 0.
  - 남은 일: M4 스파이크 venv 실물 검증(20문장 헤더 유효·오디오 바이트 동일·timing 비용) → README 계약 단락 → 최종 기록.
  - 다음 첫 행동: 저장소 사본을 `~/kaiwa-tts-spike/work/tts-service/` 로 복사, 스파이크 venv 로 pytest(실제 정규화기 포함) + 실물 하니스.
  - 주의점: 모듈 전역 함수 바꿔치기(`models.infer.clean_text` 감싸기)는 **하지 않았다** — 비용 0 대신 프로세스 전역 패치라 안정성 우선으로 공개 함수 재호출(M4 실측 clean_text ≈0.22ms/문장)을 택함. 비용은 M4 실측으로 확인 예정.
  - 미커밋 파일: 위 9개(`speech/tts-service/**`) + 이 이력서. M4 에 둔 것: `~/kaiwa-tts-spike/work/probe_cost.py`(비용 측정 스크립트, 스파이크 영역).
- [00:20] **중간 기록 2 (M4 실물 1차 검증 → 설계 2건 보정)**
  - M4 1차 실측(스파이크 venv·모델 사본, CPU 25문장): timing 25/25 유효·**오디오 바이트 동일 25/25**(같은 시드, 래퍼 없는 모델과 비교) — 그러나 timing 비용 **p50 0.47ms**(목표 0.05~0.3ms 초과). 분해(모델 없이): `clean_text` 재호출 ≈0.46ms 가 85%, 단어 분할 26µs, 계산 43µs, 헤더 8µs.
  - 보정 ①: get_text 가 이미 부른 `clean_text` 결과를 **복사만 하는 감싸기**(`style_bert_vits2.models.infer.clean_text` 모듈 속성, 반환값 그대로)를 추가하고, 못 잡으면 공개 함수 재호출로 되돌아간다. 두 경로 모두 **모델 입력 토큰 id 와 대조**한 뒤에만 쓴다. → 비용 CPU p50 **0.16ms**·p95 0.19·최대 0.31, MPS(10문장) p50 0.19·최대 0.35. 재호출 경로(`--no-text-capture`)와 **헤더 25/25 동일·wav 25/25 동일**.
  - 보정 ②: 단어 경계 규칙 — blank 가운데(스파이크 제안)는 쉼표 뒤 긴 쉼의 절반만큼 시작이 앞당겨져 꼬리가 나빠서(같은 음성 강제정렬 대비 시작 p95 68·최대 166ms) **blank 절반을 1프레임(11.6ms)까지만** 음소 쪽으로 넓히도록 바꿈 → 시작 p50 12·**p95 42**·최대 79·편향 0ms(스파이크 원자료 재계산, 237단어). 앞뒤 단어 시간 겹침 0 보장.
  - 남은 일: README 계약 단락 → 최종 코드로 M4 재검증(CPU 25·pitch·느리게·MPS) → 최종 기록. 다음 첫 행동: README §2 응답 헤더·timing 단락.
  - 주의점: 모듈 속성 감싸기는 프로세스 전역이지만 원래 반환값을 그대로 돌려주고(오디오 바이트 동일로 확인) 실패 시 재호출 경로로 떨어진다 — Reviewer 판단 대상으로 명시.
  - 미커밋: `speech/tts-service/{kaiwa_tts/{timing,backend,holder,params,server,__init__}.py, tests/{conftest,test_timing,test_api}.py, scripts/check_timing.py}` + 이 이력서. M4: `~/kaiwa-tts-spike/work/{tts-service/(저장소 사본), probe_cost.py, profile_timing.py, compare_mid.py, compare_cap.py, logs/}` · 스파이크 venv 에 `pytest 9.1.1`·`httpx 0.28.1` 추가(운영 venv 무관).

### 본 구현 — 최종 (dev-012b4m4b)

- [00:01] **체크포인트 1 (점검 직후 — 신규 소환 이어받기)**
  - 점검 결과: 코드 9개 + check_timing·smoke 는 이력서 중간 기록 2 와 일치. `requirements.txt`·`requirements-dev.txt`·`SETUP-M4.md`·`deploy-from-ubuntu.sh`·`check_pins.py` 무변경(git diff 0) → 핀 영향 0. README §2 timing 단락은 헤더·인코딩·상한·상태값·좌표·요청 스키마 불변까지 있음 — **빠진 것: 핀 영향 0·롤백(구 앱·구 M4) 단락, `(아래)` 오기(단락이 위에 있음), 모듈 속성 감싸기가 프로세스 전역이라는 명시**.
  - 빈 곳: ① `_install_text_capture`(모듈 속성 감싸기)·`take_alignment` 두 경로에 단위 테스트 없음 ② `check_timing.py` 가 어느 경로(잡기/재호출)를 탔는지 보고하지 않음 ③ 같은 프로세스의 "래퍼 없는 모델" 비교도 모듈 속성 감싸기를 거치므로 **바이트 동일 비교는 net_g 인스턴스 래퍼만 증명** — 모듈 속성 감싸기의 무영향은 `--no-text-capture` 실행과의 wav 해시 대조로 따로 증명해야 함.
  - M4 상태(읽기만): 운영 `:8200/health` OK·warmedUp, `~/kaiwa-tts-run` HEAD `36f3795`·추적 변경 0. 스파이크 `work/` 의 8299 uvicorn(앞 세션 HTTP 확인용)은 이미 종료(pid 4475 없음). `logs/final_*.log` 5개(23:57~58)는 앞 세션이 기록 없이 남긴 실행 — 최종 수치로 쓰지 않고 다시 돈다.
  - 남은 일: 테스트 추가(`tests/test_backend_capture.py`) → `check_timing.py` 경로 보고·`--break-capture` → README 보완 → 로컬 pytest·ruff·mypy → M4 재복사·재검증(CPU 25·pitch·느리게·MPS 10·재호출·잡기 실패) → 시작 오차 재계산 → 최종 기록.
  - 다음 첫 행동: `tests/test_backend_capture.py` 작성(가짜 `style_bert_vits2` 모듈을 `sys.modules` 에 넣어 감싸기·두 경로 확인).
  - 미커밋: 위 중간 기록 2 목록 그대로 + 이 이력서.
- [00:15] **M4 서비스 부분 완료 — 최종 기록** (운영 배포는 하지 않음 — Leader 가 마지막에 배포 스크립트로)

**변경 파일**(전부 `speech/tts-service/**`, 미커밋 — 이 세션 추가분은 ★)
| 파일 | 내용 |
|---|---|
| `kaiwa_tts/timing.py`(신규) | 엔진 중립 계산: 토큰별 프레임 → 음소 경계(blank 절반을 최대 1프레임까지) → 엔진 단어 시작·끝 ms, 엔진 글 → 요청 글 코드포인트 되돌리기(`align_to_source`), 원문 구간 겹침 합치기, 불변식(토큰 수·Σ프레임×hop=샘플·단어 길이 합), 헤더 인코딩/디코딩·4096B 상한 |
| `kaiwa_tts/backend.py` | 모델 인스턴스 `net_g.infer` 래퍼(attn 토큰별 프레임·입력 토큰 id 보관) + 모듈 속성 `models.infer.clean_text` 래퍼(결과 복사본만 보관) + `take_alignment`(잡은 값 또는 공개 함수 재호출 → **모델 입력 토큰 id 와 대조 후에만** 사용) |
| `kaiwa_tts/holder.py` | 합성 뒤 `_timing` — 무엇이 실패해도 timing 만 빠지고 오디오 그대로, pitch/intonation 후처리 때만 5ms 허용 |
| `kaiwa_tts/params.py` | `SynthPlan.source_text` = 요청 `text` 원본(좌표 기준) |
| `kaiwa_tts/server.py` | 응답 헤더 `X-Tts-Timing`·`X-Kaiwa-Timing`·`X-Kaiwa-Timing-Ms`, 로그에 상태·단어 수·ms 만(문장 0) |
| `kaiwa_tts/__init__.py` | VERSION 0.3.0 → **0.4.0** |
| `scripts/check_timing.py`(신규, ★보강) | M4 실물 확인 — ★ 탄 경로 `path`(capture/recall)·`wrapEqual`(원래 함수와 반환값 동일)·`--break-capture`(감쌌지만 잡기 실패) 추가, 종료 코드에 경로 기대값 포함 |
| `scripts/smoke.py` | timing 상태·바이트 표시만(성공 판정 무관 — 구 버전도 통과) |
| `tests/conftest.py`·`tests/test_timing.py`(신규)·`tests/test_api.py` | 가짜 정렬·좌표·불변식·헤더·API 7종 |
| ★`tests/test_backend_capture.py`(신규, 11개) | 가짜 SBV2(`sys.modules`)로 모듈 속성 감싸기: **같은 객체 반환**·복사본 유지(제자리 수정 무영향)·복사 실패 시 None+값 그대로·원래 예외 전파·중복 설치 없음·라이브러리 모양 다르면 설치 안 함 / 두 경로(잡기·재호출) **정렬·오디오·timing 동일**(3문장: 일반·숫자·반각+괄호+말줄임) / 잡기 실패 → 재호출 / 잡은 글이 모델 토큰과 다르면 `token_mismatch` / 한 번만 꺼냄 |
| ★`README.md` | §2 timing 단락 보강: 두 래퍼(인스턴스 한정 vs **프로세스 전역**) 명시·재호출 경로·테스트 위치 / **핀·의존성 영향 0** / **호환·롤백**(구 앱×새 서비스 동일, 새 앱×구 서비스 = 헤더 없음 → 앱 `timing=null`, 롤백 = 배포 스크립트 직전 SHA 1회, 서비스는 아무것도 저장 안 함) / 최종 M4 수치 / `(아래)` 오기 정정 / §8 check_timing 옵션 |

**헤더 계약(앱 어댑터가 따를 것)** — 요청 스키마 무변경(`extra="forbid"` 라 새 키를 보내면 구 서비스 400 — 테스트로 고정). 응답:
- `X-Tts-Timing` = base64url(패딩 없음) JSON `{"v":1,"method":"ENGINE_DURATION","alignerVersion":"engine-duration-1","coord":"codepoint","durationMs":N,"words":[[startMs,endMs,charStart,charEnd],…]}` — 글·읽기·음소·엔진 이름 없음. 오름차순, 시간·글 구간 겹침 0, `0 ≤ start < end ≤ durationMs`.
- `X-Kaiwa-Timing` = `ok|unavailable|token_mismatch|frame_mismatch|word_mismatch|text_mismatch|empty|too_large|error` — `ok` 가 아니면 `X-Tts-Timing` 없음, 오디오 정상. `X-Kaiwa-Timing-Ms` = 계산 시간(소수 2자리).
- 크기 실측 최대 443B(25문장), 상한 4096B 초과 시 생략(`too_large`).

**좌표 매핑 처리** — 1단(서비스): `charStart/charEnd` 는 **앱이 보낸 `text` 그대로(NFC·strip 전)의 코드포인트**. SBV2 가 다시 바꾼 글(`。`→`.`, 숫자→한자, 반각→전각, 공백·이모지·기호 삭제)을 `align_to_source` 로 되돌린다 — 문자별 정규화가 전체와 같으면 1:1, 아니면(숫자·반각 탁점) 실제 정규화 함수로 접두사 경계를 찾아 블록 대응. 여러 엔진 단어가 같은 원문(`15`→`十`·`五`)을 가리키면 한 단어로 합친다. 실제 SBV2 정규화기 테스트(M4 에서만 실행)는 일반·숫자·반각+괄호·이모지·앞 공백·`1,000円` 통과. 2단(앱, 미구현): 아래.

**검증 숫자**
- 로컬(우분투 `~/.node-local/thekaiwa-tts-test/venv`, Python 3.11.16): pytest **129 passed, 1 skipped**(skip = 실제 SBV2 정규화기 — SBV2 미설치) · `ruff check .` 통과 · `ruff format --check .` 26 files 통과 · `mypy app.py kaiwa_tts`(strict) **0 issues / 12 files** · `mypy scripts/check_timing.py` 0.
- M4 스파이크 venv(`~/kaiwa-tts-spike/.venv`, 저장소 사본 17개 파일 sha256 로컬과 동일 확인, torch 2.14.0·numpy 1.26.4·transformers 4.57.6, `check_pins.py` **PINS OK**): pytest **130 passed, 0 skipped**(실제 정규화기 포함).
- M4 실물(`check_timing.py`, 모델 사본 `jvnv-F1-jp`, 문장 = `bench_synth` 20 + 경계 5, 같은 시드):

| 실행 | 문장 | timing 유효 | 탄 경로 | wrapEqual | 바이트 동일(래퍼 없는 모델) | timing ms p50 / p95 / 최대 | 헤더 최대 | 합성 p50 |
|---|---|---|---|---|---|---|---|---|
| CPU 기본 | 25 | **25/25** | capture 25 | 25/25 | **25/25** | **0.165 / 0.197 / 0.296** | 443B | 401ms |
| CPU `--no-text-capture`(감싸지 않음) | 25 | 25/25 | recall 25 | — | 25/25 | 0.500 / 0.558 / 0.628 | 443B | 400ms |
| CPU `--break-capture`(감쌌지만 잡기 실패) | 25 | 25/25 | recall 25 | 25/25 | 25/25 | 0.517 / 0.584 / 0.633 | 443B | 398ms |
| CPU pitch 1.1(pyworld 후처리) | 10 | 10/10 | capture 10 | 10/10 | 10/10 | 0.188 / 0.342 / 0.342 | 424B | 783ms |
| CPU 속도 0.8(느리게) | 10 | 10/10 | capture 10 | 10/10 | 10/10 | 0.182 / 0.364 / 0.364 | 424B | 445ms |
| MPS | 10 | 10/10 | capture 10 | 10/10 | 10/10 | 0.199 / 0.360 / 0.360 | 424B | 243ms |

  - 목표 ≤0.3ms: p50·p95(25문장) 충족. **최대 0.34~0.36ms 는 넘음** — 전부 경계 첫 문장(숫자 `3時15分…`, 원문↔엔진 글 대응이 접두사 경로)에서 났고, 그 밖 문장 최대 0.20~0.30ms. 합성 0.24~0.78s 대비 0.05% 미만이라 TTFA 영향 없음 [확실 — 실측]. 앱 정규화기가 숫자를 미리 읽기로 바꾸므로 운영에선 이 경로가 드물다 [가능성 높음].
- **모듈 속성 감싸기 판정 근거**(프로세스 전역이라 같은 프로세스의 "래퍼 없는 모델"도 거침 → 위 "바이트 동일" 은 net_g 인스턴스 래퍼만 증명):

| 확인 | 결과 |
|---|---|
| 원래 반환값 그대로 | 단위: 같은 객체(`is`) 반환·복사본은 제자리 수정 무영향·원래 예외 전파 / 실물: 같은 인자로 원래 함수와 감싼 함수 반환값 동일 **25/25·10/10·10/10·10/10** |
| 감싸기가 오디오를 바꾸지 않음 | 기본(감쌈) vs `--no-text-capture`(감싸지 않음) — 문장별 **wav sha256 25/25 동일** |
| 감싸기 실패 시 재호출 경로로 떨어짐 | `--no-text-capture`(설치 안 됨)·`--break-capture`(설치됐으나 잡은 값 없음) 둘 다 **recall 25/25**, timing 25/25 유효 / 단위: 라이브러리 모양이 다르거나 import 실패면 설치 안 함, 복사 실패 시 None |
| 두 경로 결과 동일 | 기본 vs recall, 기본 vs broken — 문장별 **헤더 sha256 25/25 동일·wav sha256 25/25 동일** / 단위: AlignmentCapture·timing·오디오 동일 |
| 엉뚱한 값을 쓰지 않음 | 어느 경로든 모델이 실제로 받은 토큰 id 와 대조, 다르면 `token_mismatch`(단위) |

- **단어 시작 오차**(최종 코드가 헤더에 싣는 값 vs **같은 오디오**의 강제정렬 narabas onnx + `torchaudio.functional.forced_align`, 스파이크 영역 `final_align.py`, 25문장 × 3조건, 겹침 합친 단어 기준): 기본 p50 12·p95 41·최대 79 / pitch 1.1 p50 11·p95 45·최대 79 / 속도 0.8 p50 14·p95 57·최대 98 → **전체 726단어 p50 12·p95 50·최대 98ms·편향 0·≤100ms 100%**(기준 p95 ≤100ms 충족). 강제정렬 실패 0. 끝 경계는 p95 96~125·최대 369ms(강제정렬의 끝 경계도 부정확 — 스파이크 기록) → 화면은 시작 기준 강조 권장. 마지막 단어 끝 → 소리 끝 105~313ms. (첫 계산에서 최대 207/266ms 가 나왔으나 `15`→`十`·`五` 합친 단어의 둘째 엔진 단어를 따로 비교한 **측정 스크립트 오류**였고, 합친 뒤 다시 잼.)
- 운영 무변경 확인(00:13): `:8200/health` `{"status":"OK","warmedUp":true}` · `~/kaiwa-tts-run` HEAD `36f3795`·추적 변경 0 · 운영 venv `check_pins.py` **PINS OK**. crontab·launchd·pf·운영 venv 손대지 않음.

**핀 유지** — `requirements.txt`·`requirements-dev.txt`·`SETUP-M4.md`·`deploy-from-ubuntu.sh`·`check_pins.py` git diff 0. 새 패키지·모델·환경 변수·요청 키 0. narabas·onnxruntime 운영 설치 없음(B 채택).

**앱 쪽에 필요한 것 — 012b-4 앱 단계 지시 초안**(이 세션은 `src/**` 무변경)
1. 어댑터 `src/modules/engine/adapters/tts/styleBertHttp.ts`(헤더 읽기는 지금 `headerMs` ≈166~172행): `x-tts-timing` 을 읽어 base64url 디코드 → `v===1`·`words` 가 정수 4-튜플·오름차순·겹침 0·`0≤s<e≤durationMs`·`charEnd ≤ 보낸 text 의 코드포인트 수` 를 검사, 하나라도 어긋나면 `null`(오디오는 그대로). `x-kaiwa-timing`(상태)·`x-kaiwa-timing-ms` 는 Trace 용으로만. 헤더 없음(구 M4 0.3.x) = `null`. 엔진 이름이 없는 중립 객체로 넘긴다(`method` 는 `ENGINE_DURATION` 그대로).
2. 좌표 2단 매핑(`src/modules/speech/tts/timing.ts` 신규 권장): 헤더 좌표는 **앱이 M4 에 보낸 글(정규화기·발음 사전 치환 뒤)의 코드포인트** → 보낸 글의 UTF-16 인덱스로 바꾸고 → `normalizer.ts` token map(`srcStart/srcEnd`, **UTF-16**, 10·18행)으로 조각 원문 구간으로 되돌리고 → 조각 원문 **코드포인트**로(D-T3). 치환 토큰 안에 걸친 단어는 토큰 원문 전체로 넓히고, 넓혀서 겹치면 서비스처럼 합친다(화면은 겹침이 있으면 전체를 버림). 테스트: 숫자·장음·발음 사전 치환·이모지(서로게이트) 문장에서 `조각.slice` 결과 = 단어 글(완료 기준 3).
3. 캐시 `src/modules/speech/tts/cache.ts`: `TtsCache.timing`(조각 좌표 결과, 글 없음)·`timingVersion`(= `alignerVersion` `engine-duration-1`) 을 **create 와 update 둘 다**에 싣는다 — 지금 upsert update(113행)는 `bytes·durationMs·path` 만 갱신한다. HIT 는 저장된 timing 반환, 012b-4 이전 행은 `null`(D-T7).
4. #24 `src/app/api/v1/speech/tts/[token]/route.ts:24` 의 `timing: null` 을 채우고, #23 wav 응답에 앱 형식 `X-Tts-Timing` 헤더(D-T1). nginx `proxy_buffer_size`(4KB, 응답 헤더 전체)를 넘지 않게 앱 헤더 상한(예: 3KB)을 두고 넘으면 생략. 사용자 결속·만료는 기존 토큰 규칙 그대로. 브라우저로 `X-Kaiwa-*` 를 넘기지 않는다.
5. Trace `TTS_TIMING{words, method, alignMs, status}` 를 `metrics.ts` ALLOWED(9~18행)에 추가하고, **합성을 기록하는 그 `recordTrace` 호출 안에서** 함께 싣는다 — REV-123 경고: `appendTraceSteps` 로 나중에 덧붙이면 이미 굳은 행에 반영되지 않는다.
6. #62c `clips[].charStart`(D-T2) — 서비스와 무관, 앱 레슨 쪽.
7. 앱 테스트: 구 M4(헤더 없음)·`X-Kaiwa-Timing: token_mismatch`·깨진 base64·범위 밖 좌표 → 전부 `timing=null` 이고 재생 정상.

**M4 배포 전 체크리스트**(Leader/deployer — 사용자 승인 범위 "배포", 설치 없음)
1. 커밋에 `speech/tts-service/**` 13개(위 표) 포함 — 현재 `36f3795`(M4 HEAD)는 로컬 HEAD `5c3a701` 의 조상이고 그 사이 tts-service 커밋 0 → ff-merge 가능 [확실 — `git merge-base --is-ancestor`].
2. `bash speech/tts-service/scripts/deploy-from-ubuntu.sh <커밋 SHA>` — SSH push → M4 ff-merge → `check_pins.py`(requirements 무변경이라 통과 예상) → `restart.sh`(warmedUp 대기) → `smoke.py`. 확인 줄: smoke 출력 `timing=ok timing_bytes=<200~450>`, `/health` `{"status":"OK","warmedUp":true}`, `/health/detail` `version: 0.4.0`, 서비스 로그 `synth ok … timing=ok timing_words=N`.
3. 실패 시 스크립트가 직전 SHA(`36f3795`)로 자동 롤백. 수동 롤백 = 같은 스크립트에 `36f3795`. 앱·DB 쪽에 되돌릴 것 없음.
4. 배포 순서 무관: M4 먼저 나가도 구 앱은 헤더를 무시(요청 무변경) — 웹 일괄 배포 전에 M4 를 먼저 내도 된다.
5. 메모리: 새 모델·패키지 없음 — 늘어날 것은 attn 합계 텐서(토큰 수 × int) 수준 [가능성 높음 — 운영 footprint 미측정, 배포 뒤 `/health/detail` `memoryMb·gpuMb` 를 배포 전 값과 비교 권장].

**M4 에 남긴 것**(전부 `~/kaiwa-tts-spike/`, 운영 무관) — 총 **2.8GB**(앞 세션과 같음): `.venv` 1.4GB(운영 핀 + onnxruntime·narabas + pytest·httpx) · `cache/narabas` 1.2GB · `model_assets/jvnv-F1-jp` 240MB · `work/` 12MB(★ 이 세션: `work/tts-service/` 저장소 사본 갱신, `run_final2.sh`, `final_align.py`, `logs/f2_*.log`·`f2_align*.json` — 앞 세션: `probe_cost.py`·`profile_timing.py`·`compare_*.py`·`spike.env`(0600, 스파이크용 시크릿)·`logs/`). 프로세스 0개(`final_align.py` 종료 때 onnxruntime/torch 정리 중 `libc++abi … recursive_mutex lock failed` 로 비정상 종료 — 결과 파일은 이미 쓴 뒤, 운영 무관). **정리는 사용자 판단**: B 채택이라 남길 이유 없음 — `~/kaiwa-tts-spike` 통째 삭제 가능(이 세션은 지우지 않음).

**남은 위험**
- 모듈 속성 감싸기(프로세스 전역) — 위 표로 무영향을 확인했지만 SBV2 를 올리면 다시 확인해야 한다(`check_timing.py` 세 실행 대조). 구조가 바뀌면 토큰 대조·프레임 불변식에서 `timing=null` 로 떨어질 뿐 오디오는 영향 없음(단위·실물 확인). **Reviewer 판단 대상**.
- 최대 비용 0.36ms(숫자 문장 접두사 경로)가 목표 0.3ms 를 넘음 — 문장 길이에 따라 정규화 호출이 늘어나는 O(n) 경로. 100자 숫자 다수 문장의 최악값은 재지 않음 [추측: 1ms 안팎].
- 단어 **끝** 경계는 시작보다 부정확(p95 ≈100~125ms) — 화면이 끝 시각으로 강조를 끄면 짧게 비거나 늦게 꺼질 수 있다. 시작 기준 전환 권장(designer 가이드와 대조 필요).
- 정확도 기준은 강제정렬과의 일치뿐(사람 라벨 없음) — 스파이크 기록 그대로.
- 운영 MPS 에서 timing 비용·메모리는 스파이크 venv MPS(10문장)로만 확인 — 운영 프로세스 실측은 배포 뒤.
- 미커밋: `speech/tts-service/{kaiwa_tts/{timing,backend,holder,params,server,__init__}.py, scripts/{check_timing,smoke}.py, tests/{conftest,test_timing,test_api,test_backend_capture}.py, README.md}` + 이 이력서.

### dev-012b4m4c (REV-130)

- [00:47] **REV-130 보강 4건 완료**(M-1·L-1·L-2·L-4, Leader 결정 "4건 모두"; L-3 은 수용·무변경). `speech/tts-service/**` 만, 커밋·푸시·배포 없음, 운영 M4 무접촉.

**변경 파일**(전부 미커밋)
| 파일 | 내용 |
|---|---|
| `kaiwa_tts/timing.py` | `TIMING_MAX_TEXT_CHARS = 2 × MAX_TEXT_CHARS`(=200, `config` 에서 가져옴). `compute_timing` 첫 줄 — 요청 원문 코드포인트가 넘으면 `TimingError("too_long")`(정규화 호출 0회로 바로 건너뜀) |
| `kaiwa_tts/backend.py` | `load_model` 의 `_capture_alignment(net)` 를 try/except — 실패 시 경고 1줄 `alignment capture skipped model=<id> err=<예외 타입> — timing unavailable`(문장·예외 메시지 없음), 모델은 그대로 올라가고 그 모델의 `take_alignment` 는 None → `X-Kaiwa-Timing: unavailable`, 오디오 정상 |
| `kaiwa_tts/holder.py` | `SynthResult.timing_status` 주석 값 목록에 `empty·too_long`(동작 무변경) |
| `README.md` | ① `X-Kaiwa-Timing` 값에 `too_long` 한 항목(200 코드포인트·이유·앱은 닿지 않음) ② 비용 서술 정정: "0.1% 미만" → **MPS 최대 0.36ms ÷ 합성 p50 243ms ≈ 0.15%**, "p95 0.20ms" 는 CPU 기본 25문장 한정(pitch·속도·MPS 10문장 0.34~0.36ms)으로 명시, 접두사 경로 O(n²) 실측(숫자 100자 정렬 ≈3.8ms·상한 200자 ≈4.3ms·상한 없을 때 4096자 ≈171ms) ③ 구현 의존 단락에 "로드 때 ①을 못 걸면 경고 1줄·모델 그대로·`unavailable`" 1문장 |
| `tests/test_backend_capture.py` | +3: `test_overlapping_threads_take_only_their_own_capture`(M-1) · `test_load_model_survives_alignment_wrapper_failure[read_only·missing]`(L-2 — 가짜 `TTSModel`·가짜 torch, `net_g.infer` 를 바꿔 끼울 수 없음/없음 → 로드 성공·경고 1줄·`秘密` 없음, read_only 는 합성까지 해서 `take_alignment` None·오디오가 정상 모델과 같음) |
| `tests/test_timing.py` | +2(L-1): 상한 > 합성 상한(100) 고정 · 상한 길이 그대로는 계산(좌표 원문 기준)·1자 넘으면 `too_long` 이고 정규화 호출 0회 |
| `tests/test_api.py` | +1(L-1): 공백 패딩 200자 = `ok`(좌표 `今日`), 201자 = 200·`audio/wav`·`X-Kaiwa-Timing: too_long`·`X-Tts-Timing` 없음·오디오 바이트가 짧은 요청과 같음 |

**M-1 시험 설계**(reviewer 초안 `extra_tests.py` 사본에서 출발, 원본 scratchpad 무수정): 같은 스레드에서 차례로 합성·꺼낸 `AlignmentCapture` 를 기대값으로 두고 두 스레드 결과가 **전체 동일**한지 본다(초안은 정규화 글 접두사만 비교). `threading.Barrier(2, timeout=5)` 2개로 "둘 다 글 분석·정렬 보관(모델 infer 안) → 둘 다 꺼낼 준비 → 꺼내기" 순서를 강제, 한쪽이 예외면 두 Barrier 를 abort 해 상대를 바로 풀어 준다. sleep 없음. 초안의 `test_stale_cleaned…`(m7 과 무관)·`test_wrong_value_never_leaks_only_null`(기존 `test_captured_text_not_matching_model_tokens_is_rejected` 와 같은 내용)·API 동시성 초안(m11, sleep 의존·지시 범위 밖)은 넣지 않았다.

**변이 확인**(우분투 scratchpad `dev012b4m4c/run_mut.py` — 저장소 사본을 한 곳씩 바꿔 전체 pytest, 원본 무수정)
| 변이 | 결과 |
|---|---|
| 없음(base) | 135 passed · 1 skipped |
| m7 `_SLOT = threading.local()` → 전역 `SimpleNamespace()` | **1 failed**(`test_overlapping_threads_take_only_their_own_capture` 만) — 반복: base 겹침 시험 **30/30 통과**, m7 사본 **15/15 실패**(결정적) |
| L-1 길이 가드 삭제 | 2 failed(`test_request_text_over_cap_skips_alignment`·`test_overlong_request_text_skips_timing_but_keeps_audio`) |
| L-2 try/except 삭제 | 2 failed(`test_load_model_survives_alignment_wrapper_failure[read_only·missing]`) |

**상한값 200 의 근거**
- 앱이 M4 로 보내는 글: 정본 16 §6.1 "세그먼트 ≤ `runtime.maxChars`(100)" · `src/modules/speech/tts/synthesize.ts:211`(정규화 글 코드포인트 >100 이면 M4 호출 전 `TEXT_TOO_LONG`) · `sentences.ts:62`(4자 미만 조각 합치기도 maxChars 이내) [확인 — 코드]. 서비스도 NFC·strip 뒤 >100 을 400 으로 거부하므로 timing 까지 오는 요청은 NFC·strip 뒤 ≤100. 원문이 그보다 긴 경우는 앞뒤 공백·결합 전 글자(`か`+U+3099 등)뿐이고 앱은 만들지 않는다 [가능성 높음 — 앱 정규화기 출력 형태는 코드로만 확인].
- 100 으로 두면 공백 1자 붙은 정상 100자 요청이 걸리므로 2배 여유. 200 에서 최악 비용은 아래 4.3ms.
- M4 실측(스파이크 venv, **실제** `normalize_text`, `align_to_source` 만, 서버·모델 없음, ssh 표준입력 실행 — M4 에 스크립트 안 남김): 일반 100자 0.06ms · 숫자 다수 100자 **3.8ms** · 숫자 100자+공백 100자(=200, 상한 경계) **4.3ms** · 숫자 100자+공백 300자 5.7ms · 숫자 100자+공백 3,996자(=4096) **171ms**. reviewer 대용 정규화기 4,004자 617ms 보다 실제는 작지만 단일 워커를 그만큼 붙잡는 것은 같다.
- 덧: 이전 기록의 "100자 숫자 다수 문장 최악 [추측: 1ms 안팎]" 은 실제 **3.8ms**(상한 아래라 이번 가드로는 안 막힘). 100자 합성 시간 대비 비율은 합성을 재지 않아 [추측: 1% 미만].

**검증 숫자**
- 로컬(`~/.node-local/thekaiwa-tts-test/venv`, Python 3.11.16): pytest **135 passed · 1 skipped**(129→+6) · `ruff check .` All checks passed · `ruff format --check .` 26 files already formatted · `mypy app.py kaiwa_tts`(strict) **0 issues / 12 files** · `mypy scripts/check_timing.py` 0.
- M4 스파이크 venv(`~/kaiwa-tts-spike/.venv`, torch 2.14.0·numpy 1.26.4): 저장소 사본 33개 파일 갱신 후 **sha256 33/33 로컬과 동일** → pytest **136 passed · 0 skipped**(130→+6, 실제 SBV2 정규화기 시험 포함; L-2 시험은 실제 torch 가 있어도 가짜 torch 로 바꿔 돈다).
- 핀·`schemas.py`·`security.py`(`requirements.txt`·`requirements-dev.txt`·`SETUP-M4.md`·`deploy-from-ubuntu.sh`·`check_pins.py` 포함) git diff **0줄** · 보이지 않는 문자 grep(`speech/tts-service`) **0건**.
- 운영 무변경(00:45): `:8200/health` `{"status":"OK","warmedUp":true}` · `~/kaiwa-tts-run` HEAD `36f3795`·추적 변경 0 · 스파이크 프로세스 0. crontab·launchd·pf·운영 venv 미접촉.

**남은 위험**
- 길이 가드는 비정상 입력의 비용만 막는다 — 숫자 많은 100자 문장은 상한 아래라 정렬 ≈3.8ms 가 그대로 든다(앱 정규화기가 숫자를 읽기로 바꾸므로 운영 빈도 낮음 [가능성 높음]).
- `too_long` 은 새 상태값 — 앱 어댑터(미구현) 계약이 "`ok` 아니면 null" 이라 영향 없음. Trace 에서 상태값을 열거형으로 고정한다면 추가 필요(앱 단계 인계).
- 직렬화(SerialRunner 워커 1·Lock)를 고정하는 API 수준 동시성 시험은 이번 범위 밖 — 워커를 늘리면 이번 스레드 격리 시험과 토큰·정규화·프레임 3중 대조가 막는다.
- M4 에 남긴 것: `~/kaiwa-tts-spike/work/tts-service/` 사본 갱신만(스파이크 영역). 우분투 scratchpad `dev012b4m4c/`(`probe_align_cost.py`·`run_mut.py`·sha 목록·m7 반복 사본).
- 미커밋: `speech/tts-service/{kaiwa_tts/{timing,backend,holder,params,server,__init__}.py, scripts/{check_timing,smoke}.py, tests/{conftest,test_timing,test_api,test_backend_capture}.py, README.md}` + 이 이력서(이번 세션 수정: timing·backend·holder·README·tests 3개).

### dev-012b4app2 (앱 서버 쪽 — dev-012b4app 이어받기)

- [01:25] **체크포인트 1 — 이어받은 상태 점검**(앞 developer `dev-012b4app` 은 80턴 한도로 기록 없이 멈춤. 코드·`git diff HEAD` 로 판정)

| # | 항목 | 상태(이어받을 때) | 근거(파일) | 이번에 할 것 |
|---|---|---|---|---|
| 1 | 어댑터 헤더 읽기·검증 | **완료** — `readTimingHeaders`(상태·base64url·≤4096·JSON·v/coord/method/버전·`checkTimingWords`·사전 치환 되돌리기 `substituteReadingsMapped`), 실패는 전부 `timing=null`·합성 성공, `try` 로 감쌈 | `engine/adapters/tts/styleBertHttp.ts`, `engine/tts/timing.ts`(신규), `engine/registry/types.ts`(+`TtsTimingWord`·`TtsTimingOutput`·`timingStatus`·`timingMs`) | 상태값을 **열거 목록**으로 닫기(`too_long` 포함, 모르는 값 `UNKNOWN`) |
| 2 | `speech/tts/timing.ts` 좌표 매핑 | **완료** — 캐시에는 정규화 글 좌표, 응답 때 정규화 token map(`normalizationUnitMap`)으로 조각 글 코드포인트로(`chunkTiming`), 매핑 불가·길이 어긋남·3KB 초과 → 전체 null | `speech/tts/timing.ts`(신규), `renderingPlan.ts`(`prepareSegmentsWithTokens`) | Trace 상태명 `TOO_LARGE`(엔진과 같은 이름) → `HEADER_TOO_LARGE` |
| 3 | 캐시 timing·timingVersion | **완료** — `ttsCacheUpsertArgs` create·update 둘 다, 없으면 DbNull, HIT 는 `parseStoredTiming`(버전 칸 일치) | `speech/tts/cache.ts` | 없음 |
| 4 | 라우트 #23·#24 | **완료** — #23 wav `ttsAudioResponse` 헤더·JSON `timing`+서명에 묶기, #24 wav 헤더·JSON `timing`(토큰에 묶인 조각 글 timing, 길이 어긋나면 null) | `app/api/v1/speech/{_lib/tts.ts,tts/route.ts,tts/[token]/route.ts}`, `speech/tts/audioUrl.ts`, `turnSpeaker.ts` | 없음(마지막 작업 "#23 JSON+signer" 는 diff 에 들어가 있음) |
| 5 | Trace `TTS_TIMING` | **완료** — `attachTiming` 이 CACHE·SHARED·SYNTH 세 경로 모두 `finishTrace` **전에** 같은 `steps` 에, `metrics.ts` ALLOWED, 012b-3 집계 무시(시험) | `speech/tts/{synthesize,metrics}.ts` | 상태 목록 주석 |
| 6 | #62c `clips[].charStart` | **완료** — `lessonClipPieces`, 평가 듣기(#67a `evalAudio.ts`)는 일부러 제외 | `speech/tts/lessonAudio.ts`, `app/api/v1/lessons/[id]/audio/route.ts`(주석) | 없음 |
| - | lexicon 회귀(task-035 L-2) | **해소돼 있음** — `prepareSegments` 출력 모양을 그대로 두고 token map 은 `prepareSegmentsWithTokens` 에만 → `lexiconCompoundGuard.test.ts` **무수정 통과**(기대값 갱신 없음) | `renderingPlan.ts` | 없음 |
| - | 시험 | 신규 2개 파일 존재·통과(32/32, lexicon 포함) | `engine/__tests__/task012b4Timing.test.ts`·`speech/__tests__/task012b4Timing.test.ts` | 상태 목록 시험 추가·변이 확인 |

  - 발견(내 범위 밖, 수정 안 함): `src/modules/conversation/prompts/talkScenario.ts`(미추적, task-010d 진행 중 파일) 53행 정규식 안에 **줄 구분 문자 U+2028·U+2029 가 글자 그대로** 있어 TS 구문 오류 → 저장소 그대로면 `tsc` 가 구문 오류 6건에서 멈추고(의미 검사 생략) conversation 시험 13개 파일이 실패. 검증은 **미러 사본만** 정규식 이스케이프 표기(U+2028·U+2029 를 역슬래시 u 네 자리로) 바꿔 돌렸다(NFS 무수정).
  - 남은 일: 전체 시험 숫자 → 변이 확인 → 최종 기록. 다음 첫 행동: 백그라운드 시험 결과 확인.
  - 미커밋(이 task 앱 쪽): 위 표의 파일 + `src/types/tts.ts` + 신규 시험 2개.
- [01:40] **앱 서버 쪽 완료 — 최종 기록**(커밋·푸시·db push·DB 쓰기·라이브·운영 3010·운영 M4 접촉 없음, 화면 무변경)
  - 데모 게이트: `node ../.claude/tools/demo-gate/check.mjs check --task …task-012b-4…` → `DEMO_GATE_PASSED` / `task: task-012b-4`(waived).
  - **이번 세션에 새로 한 것**(나머지는 앞 developer 산출 그대로 — 점검·시험·변이로 확인만)
    1. 어댑터 `styleBertHttp.ts`: `X-Kaiwa-Timing` 비-ok 값을 **닫힌 목록**으로 — 서비스 `kaiwa_tts/{timing,holder,server}.py` 의 값 전부(`unavailable·token_mismatch·frame_mismatch·word_mismatch·text_mismatch·empty·too_large·too_long·error`)와 대조해 일치 확인 [확인 — grep], 목록 밖(형식이 맞아도)은 `UNKNOWN`. 시험에 9개 사유·목록 밖 값 추가.
    2. `speech/tts/timing.ts`: 앱 헤더 3KB 초과 상태 `TOO_LARGE` → **`HEADER_TOO_LARGE`**(엔진의 `TOO_LARGE`=서비스 헤더 4KB 초과와 Trace 에서 구별). 시험 기대값 함께.
    3. `metrics.ts`: `TTS_TIMING.status` 값 목록 주석(엔진 쪽·앱 쪽).
  - **lexicon 회귀(task-035 L-2)**: 이어받을 때 이미 해소 — `prepareSegments` 는 출력 모양 그대로(`tokens` 없음), token map 은 새 `prepareSegmentsWithTokens` 에만. `lexiconCompoundGuard.test.ts` 는 **무수정**으로 통과(기대값 갱신 없음). `prepareSegments` 소비자는 시험뿐이고 합성 경로는 `prepareSegmentsWithTokens` 로 바뀌었지만 캐시 키 12요소·hint·`TtsSegmentInput` 모양은 그대로(`parts`·`hints` 계산 무변경, diff 로 확인).
  - **캐시 버전 동작**(임무 3 "버전 바뀌면 오디오 유지·timing 만 갱신" 해석): timing 버전은 캐시 키에 없음 → 산출기 버전이 바뀌어도 오디오 행·파일 유지. HIT 는 저장된 timing 을 그대로 씀(같은 오디오의 timing 이라 옛 버전이어도 유효, `timingVersion` 칸과 JSON 버전이 다르면 null). 같은 키를 다시 합성하는 upsert update 때 timing·timingVersion 이 새 값으로(없으면 DbNull) 바뀐다. 옛 버전 행을 일부러 다시 합성하는 경로는 만들지 않았다 [Leader 판단 — 필요하면 별도].
  - **좌표 설계(이어받은 결정, 기록)**: 캐시에는 **정규화 글 좌표**(키가 정규화 글로 정해져 원문이 다른 조각이 같은 행을 쓰므로), 응답 때 그 조각의 정규화 token map 으로 조각 글 코드포인트로 되돌린다. #24 는 토큰만 받아 조각 글을 모르므로 **서명하는 쪽**이 되돌린 값을 토큰에 묶어 프로세스 메모리(최대 512, 토큰 만료와 같은 10분)에 둔다 — 재시작·다른 인스턴스면 timing 없음(정상 값), 같은 토큰에 다른 값이 오면 둘 다 null.
  - **실행 증빙**(전용 미러 `~/.node-local/thekaiwa-012b3`, `DATABASE_URL=mysql://invalid:invalid@127.0.0.1:1/invalid`, 01:3x 최종 동기화 기준)
    | 명령 | 결과 |
    |---|---|
    | 신규 시험 2개 | **17/17** |
    | 신규 2개 + `lexiconCompoundGuard.test.ts` | 32/32 |
    | `src/modules/speech` 전체 | **262 tests · 261 pass · 0 fail · 1 skip**(skip 은 기존) |
    | `src/modules/engine` 전체 | **170/170** |
    | `src/modules` 전체 | 1328 tests · 1326 pass · **1 fail** · 1 skip — 실패 1건은 `conversation/__tests__/task037.test.ts` "repairRootClose 는 buildTalk·buildChat 만": 기대 목록에 없는 `buildScenarioVerdictRequest` 가 생김 = task-010d 진행 중 미추적 파일 `conversation/prompts/scenarioVerdict.ts` 탓(내 범위 밖, 무수정) |
    | `src/components`+`src/types` | **561/561** |
    | `tsc --noEmit -p .` | **exit 0**(최종 동기화 시점). 중간에 010d 진행 중 파일 2개(`talkScenario.ts` — 정규식 안 U+2028·U+2029 글자 그대로 / `scenarioVerdict.ts` — 편집 중 스냅샷)가 구문 오류라 tsc 가 의미 검사를 건너뛰던 때가 있어, 그때는 미러 사본만 고쳐 exit 0 확인 → 두 파일이 NFS 에서 고쳐진 뒤 무패치로 다시 exit 0 |
    | eslint(변경 파일 20개) | exit 0 |
    | 보이지 않는 문자 grep(변경 파일·이력서) | 0건(이력서에 Edit 도구가 `U+2028` 표기를 실제 글자로 바꿔 넣은 2자를 내가 만들었다가 제거 — **도구 함정**: Edit 의 new_string 에 역슬래시-u 이스케이프를 쓰면 실제 글자가 들어간다. talkScenario.ts 의 원인도 같은 것으로 [추측]) |
    | 엔진명 grep(어댑터·시험 밖 변경 파일) | 0건(`synthesize.ts:154` `speakerId: voice.speakerId` 는 HEAD 부터 있던 어댑터 입력 조립) |
  - **변이 확인**(scratchpad `mut012b4.mjs` — 미러 사본을 한 곳씩 바꿔 해당 시험, 끝나면 되돌림·원본 무수정·되돌림 cmp 확인): **8/8 검출**
    | 변이 | 결과 |
    |---|---|
    | m1 `checkTimingWords` 글 겹침 검사 삭제 | 검출(엔진 시험 1) |
    | m2 상태 목록 → 형식만 검사(이번 변경) | 검출 |
    | m3 넓힌 단어 합치기 끔 | 검출(2 — 숫자 `十|五`·약어 `OK`) |
    | m4 엔진 timing 길이 ↔ wav 길이 허용차 삭제 | 검출 |
    | m5 캐시 upsert **update** 에 timing 빠짐 | 검출 |
    | m6 CACHE 경로 `attachTiming` 을 `finishTrace` 뒤로(REV-123) | 검출 |
    | m7 #24 같은 토큰 다른 값 충돌 무시 | 검출 |
    | m8 정규화 지도에서 바뀐 token 을 첫 글자 한 칸만 | 검출 |
  - **6층·계약**: speech → `@/modules/engine`(index)·`@/types/tts` 만, engine 안에서 어댑터 → `../../tts/timing`. 요청 본문 키 무변경(시험: 6키 고정). 합성 본문·`X-Tts-Cache`·`X-Trace-Id`·SSE #32 무변경(라우트 diff). 브라우저로 `X-Kaiwa-*` 를 넘기지 않음(앱 헤더는 `{v,coord,durationMs,words}` 숫자만 다시 만듦). 평가 듣기(#67a `evalAudio.ts`)는 timing·`charStart` 를 일부러 싣지 않음(글을 숨기는 화면).
  - **정본 반영 필요**(Leader — 나는 수정 안 함)
    1. `api-contract.md` #23: wav 헤더 `X-Tts-Timing`(base64url 패딩 없음 JSON `{v:1,coord:'codepoint',durationMs,words:[[startMs,endMs,charStart,charEnd]…]}`, 요청 `text` 기준 코드포인트, ≤3072자 넘으면 생략), JSON 변형 `timing`(같은 객체 또는 null).
    2. #24: wav 헤더 `X-Tts-Timing`·JSON `timing` = 서명 때 묶은 조각 글 timing(프로세스 메모리 — 재시작 뒤·묶지 않은 토큰은 null), wav 길이와 2ms 넘게 어긋나면 null.
    3. #62c: `clips[].charStart`(줄 글 안 시작 코드포인트, additive). #67a 는 싣지 않음.
    4. `domain-model.md` `TtsCache.timing` JSON 모양 `{v,method,alignerVersion,coord:'codepoint',base:'normalizedText',durationMs,words}`(정규화 글 좌표·글 없음)·`timingVersion`=`alignerVersion`, create·update 둘 다 기록·없으면 NULL.
    5. `speech-platform/16` §7.2 `TTS_TIMING[i]` meta(`chunkIndex·status·source(ENGINE|SHARED|CACHE)·words·method·alignMs·bytes`)·status 목록(`metrics.ts` 주석), §8.1·§8.2(D-T3 — B 방식·조각 글 좌표·캐시는 정규화 글 좌표).
  - **남은 위험**
    - #24 timing 은 프로세스 메모리 의존 — 서명(턴 SSE·#23 JSON·#62c)과 #24 사이에 blue/green 전환·재시작이 끼면 그 조각만 강조 없이 재생(정상 폴백). 다중 인스턴스로 늘리면 다시 설계해야 한다.
    - 같은 사용자·같은 캐시 키·같은 초에 원문이 다른 두 조각을 서명하면(예: `OK です` / `オーケーです` 가 같은 정규화 글) 토큰이 같아 둘 다 null — 드묾·안전 방향.
    - 앱 헤더 상한 3072 + 다른 응답 헤더(쿠키 갱신 `Set-Cookie` 포함 시)가 nginx 4KB 안에 드는지는 실측 안 함 [가능성 높음 — 100자 조각 실제 헤더는 ≈1KB 안팎, 상한은 안전망]. QA 가 운영 스모크에서 `X-Tts-Timing` 길이 최대값을 봐 주면 좋다.
    - 라이브(M4 0.4.0 실물·DB 캐시 행 왕복)는 시험 안 함 — QA 몫. 운영 M4 는 아직 0.3.x(헤더 없음) → 지금 배포하면 전부 `ABSENT`·timing null(오디오 정상).
  - **미커밋 파일**(앱 쪽, 이 task 소속): `src/modules/engine/{adapters/tts/styleBertHttp.ts, registry/types.ts, tts/index.ts, tts/timing.ts(신규), __tests__/task012b4Timing.test.ts(신규)}` · `src/modules/speech/tts/{timing.ts(신규), audioUrl.ts, cache.ts, index.ts, lessonAudio.ts, metrics.ts, renderingPlan.ts, synthesize.ts, turnSpeaker.ts}` · `src/modules/speech/__tests__/task012b4Timing.test.ts(신규)` · `src/types/tts.ts` · `src/app/api/v1/speech/{_lib/tts.ts, tts/route.ts, tts/[token]/route.ts}` · `src/app/api/v1/lessons/[id]/audio/route.ts` + 이 이력서. **012b-2 소속이라 제외**: `src/types/speech.ts`·`src/app/api/v1/speech/utterances/route.ts`·`src/modules/speech/{index.ts, utterances/**}`(이 task 는 `speech/index.ts` 의 `export * from './tts'` 로만 내보냄 — 그 파일 수정 불필요).

### dev-012b4app3 (REV-133)

- [02:15] **REV-133 M-1·L-1·L-4 시험 보강 완료**(신규 소환. judge standard·R2·opus. 커밋·푸시·db push·DB 쓰기·라이브·운영 3010·운영 M4 접촉 없음, 화면 무변경)
  - 데모 게이트: `check.mjs check --task …task-012b-4…` → `DEMO_GATE_PASSED` / `task: task-012b-4`(waived).
  - **제품 코드 변경: 없음.** REV-133 감사 때 sha256(`rev133/sha-after.txt`, 시험 제외 18개)과 지금 NFS 가 전부 같다(`sha256sum -c` 불일치 0). 시험이 드러낸 결함 0건이다.
  - **변경 파일**(전부 시험 — 미커밋·미추적)
    1. `src/modules/speech/__tests__/task012b4Wiring.test.ts`(신규, 9건) — prisma 델리게이트 대역(Object.defineProperty, task037·039 와 같은 방식)과 임시 DATA_ROOT 로 **캐시 HIT 경로 전체**(준비→캐시 조회→CACHE `attachTiming`→서명→#24)를 실제로 돌린다. 캐시 키는 실제 `prepareSentence` 로 계산해 행·파일을 심고, MISS(엔진 호출) 경로로 새면 대역이 던지게 해서 시험이 바로 실패한다. 라우트(`src/app/**`)는 모듈 시험이 `@/app` 을 import 하면 eslint 경계 위반이라 **정적 확인**(012b-2 `evaluationVoiced` 방식)으로 했다. `attachTiming` 은 export 되지 않고 `tts`(모듈 네임스페이스)를 바꿀 수 없어 던지는 대역을 넣을 수 없으므로 이것도 정적 확인이다.
    2. `src/modules/engine/__tests__/task012b4Timing.test.ts`(+1건) — `synthesizeHttp` 안전망 시험이다. 응답 `headers` 를 Proxy 로 감싸 timing 헤더 3종을 읽을 때만 던지게 하고, 오디오 성공·`timing=null`·`INVALID`·다른 헤더(`x-kaiwa-synth-ms`)는 그대로 읽히는지 본다(대역이 실제로 끼었는지 확인).
    3. `src/modules/speech/__tests__/task012b4Timing.test.ts`(1건 보강, L-4) — 보호 구간 안쪽 경계 `日本|橋` 를 쪼갠 단어를 넣고 `[[0,2],[2,3],…]` 를 기대값으로 둔다. 전제로 보호 구간이 "바뀌지 않은 token"인지도 확인한다.
  - **변이 → 검출 시험**(scratchpad `app3mut/` 사본만 한 곳씩 바꾸고 시험 3파일을 돌린 뒤 되돌림. node_modules 는 미러 심볼릭 링크. 끝난 뒤 `diff -rq 사본 미러` 0, 미러·NFS 제품 파일 `cmp` 0. 스크립트 `app3mut.mjs`, 결과 `app3mut-results.json`): **20/20 검출**(REV-133 생존 9종 9/9 + 추가 배선 11종 11/11)
    | 변이 | REV-133 | 이번 | 검출 시험(파일) |
    |---|---|---|---|
    | n12 #24 맵 상한 삭제(`while (false)`) | 생존 | 검출 | #24 토큰 timing 맵 — 상한 512·만료 청소(Wiring) |
    | n12b #24 맵 만료 청소 삭제 | 생존 | 검출 | 같은 시험(가짜 시계 = `signTtsAudioToken` 의 `now`, 600초 경계) |
    | n17 어댑터 `readTimingHeaders` try/catch 삭제 | 생존 | 검출 | synthesizeHttp 안전망(engine Timing) |
    | n18 `attachTiming` try/catch 삭제 | 생존 | 검출 | attachTiming 안전망(정적, Wiring) |
    | n19 turnSpeaker 서명에 timing 안 묶음 | 생존 | 검출 | 회화 턴(createTurnSpeaker) → #24 캐시 파일 경로(Wiring) |
    | n20 #23 wav `X-Tts-Timing` 헤더 삭제 | 생존 | 검출 | #23 라우트 배선(정적, Wiring) |
    | n21 보호 구간 token 도 블록 지도 | 생존 | 검출 | 사전 보호 구간…표기 안 경계(speech Timing, L-4 보강) |
    | n30 #62c `charStart: 0` | 생존 | 검출 | 레슨 오디오(#62c) — 줄 좌표 대조(Wiring) |
    | n32 HIT 가 저장 timing 버림 | 생존 | 검출(4건) | readCachedAudio(HIT) · CACHE 경로 · 회화 턴 · 레슨(Wiring) |
    | a1 #23 JSON `timing` 필드 삭제 | - | 검출 | #23 라우트 배선(정적) |
    | a2 #23 JSON 서명에 timing 안 묶음 | - | 검출 | #23 라우트 배선(정적) |
    | a3 #24 wav 헤더 삭제 | - | 검출 | #24·#62c 라우트 배선(정적) |
    | a4 #24 JSON `timing: null` 고정 | - | 검출 | #24·#62c 라우트 배선(정적) |
    | a5 `encodeTimingHeader` 3KB 상한 삭제 | - | 검출(2건) | 헤더 상한 3KB(기존) · 헤더 직렬화 상한 3KB(Wiring) |
    | a6 레슨 서명에 timing 안 묶음 | - | 검출 | 레슨 오디오(#62c) |
    | a7 #24 캐시 파일 경로 timing null | - | 검출(2건) | 회화 턴 · 레슨 |
    | a8 CACHE 경로가 `hit.timing` 안 넘김 | - | 검출(3건) | CACHE 경로 · 회화 턴 · 레슨 |
    | a9 #24 맵이 가장 새 것을 밀어냄 | - | 검출 | #24 토큰 timing 맵 |
    | a10 #62c 라우트가 `charStart` 를 뺌 | - | 검출 | #24·#62c 라우트 배선(정적) |
    | a11 d-m6 CACHE `attachTiming` 을 `finishTrace` 뒤로 | (정적만) | 검출(2건) | 기존 정적 시험 + CACHE 경로(**동작** — 기록된 Trace 행 steps 에 `TTS_TIMING` 이 있는지) |
  - **실행 증빙**(전용 미러 `~/.node-local/thekaiwa-012b3`, 02:1x 전체 동기화·`prisma generate` 뒤, `DATABASE_URL=mysql://invalid:invalid@127.0.0.1:1/invalid`)
    | 명령 | 결과 |
    |---|---|
    | 시험 3파일(engine Timing·speech Timing·speech Wiring) | **27/27**(앞 17 + 신규 10) |
    | 3파일 + `lexiconCompoundGuard.test.ts` | 42/42 |
    | `src/modules/speech` 전체 | 271 tests · 270 pass · **0 fail** · 1 skip(기존) |
    | `src/modules/engine` 전체 | **171/171** |
    | `src/modules` 전체 | 1395 tests · 1393 pass · **0 fail** · 2 skip |
    | `tsc --noEmit -p .` | exit 0(010d 진행 파일 격리 필요 없었음 — 동기화 시점 구문 오류 없음) |
    | eslint(바뀐 시험 3파일) | exit 0 |
    | 보이지 않는 문자 grep(시험 3파일, NBSP 포함) | 0건 |
    | 엔진명 grep(신규 시험 파일) | 0건(대역 engineId 는 `tts-test`) |
  - **닫은 공백**: REV-133 시험 공백 9/9(n12·n12b·n17·n18·n19·n20·n21·n30·n32)와 Leader ①~⑨(#23 JSON `timing`·서명, #24 wav/JSON, 헤더 3KB, HIT 반환, 맵 상한·청소, 안전망 2, 보호 구간). **남은 공백은 아래 위험 1·2 둘이다.**
  - **남은 위험**
    1. 라우트 3곳(#23·#24·#62c)과 `attachTiming` try/catch 는 **정적 시험**이다. 한 줄을 지우거나 바꾸면 잡지만, 같은 뜻으로 다시 쓰는 리팩터에서도 실패한다(거짓 양성). 동작 시험을 하려면 라우트 시험을 `src/app/api/v1/speech/_lib/__tests__/`(012b-2 `evaluationVoiced` 처럼)에 두어야 하는데, 이번 소유 범위(`src/modules/{engine,speech}/__tests__/task012b4*`) 밖이라 하지 않았다. 필요하면 Leader 가 범위를 열어 주면 된다.
    2. **MISS(SYNTH)·SHARED 경로의 배선**(엔진 timing → `toStoredTiming` → upsert, SHARED `attachTiming`)은 여전히 순수 함수 시험(d-m4·d-m5·n9)과 정적 순서 시험(d-m6b)에만 기대고 있다. 동작 시험으로 하려면 설정 해석기(`resolveEffective`)·연결 자격 증명까지 대역을 세워야 해서 이번 범위에서 뺐다. 이 부분은 QA 라이브(high_risk 2·3)가 맡는다.
    3. Wiring 시험은 prisma 델리게이트 이름(`userVoiceSetting`·`appSetting`·`voiceProfile`·`pronunciationLexiconVersion`·`engineFallbackPolicy`·`engineConnection`·`ttsCache`·`requestTrace`)과 준비 경로의 조회 모양에 기대고 있다. 그 조회가 바뀌면 이 시험이 먼저 깨지는데, 기능 회귀가 아니라 대역을 고치라는 신호다(시험 머리 주석에 적어 둠).
  - **미커밋 파일**(이 task, 시험만): `src/modules/speech/__tests__/task012b4Wiring.test.ts`(신규) · `src/modules/engine/__tests__/task012b4Timing.test.ts` · `src/modules/speech/__tests__/task012b4Timing.test.ts` + 이 이력서. 앞 블록의 제품 파일 18개(시험 2개 제외)는 무변경이다.

### dev-012b4app4 (REV-136)

- [02:36] **REV-136 M-1·L-1 보강 완료 — Leader 1안 (d′) 오디오 지문**(신규 소환, judge standard·R2·opus. 커밋·푸시·db push·DB 쓰기·라이브·운영 3010·운영 M4 접촉 없음, 스키마·화면 무변경)
  - 데모 게이트: `check.mjs check --task …task-012b-4…` → `DEMO_GATE_PASSED` / `task: task-012b-4`(waived).
  - **변경 파일**
    1. `src/modules/speech/tts/cache.ts` — ⑴ 쓸 때: `timingColumns(timing, audio)` 가 timing JSON 끝에 `audioSha1`(저장하는 wav 바이트 전체의 sha1 hex)을 넣는다. `ttsCacheUpsertArgs` 가 create·update 둘 다에 같은 값을 실으므로 행 쓰기 한 문장 안에 들어간다. timing 이 null 이면 지문도 없다(DbNull 그대로). ⑵ 읽을 때: 새 `audioFingerprint(audio)`·`storedTimingForAudio(raw, timingVersion, audio)` 를 추가했다. 모양 검사(`parseStoredTiming`)를 통과하고 `audioSha1` 이 `/^[0-9a-f]{40}$/` 이며 읽은 파일 지문과 같을 때만 timing 을 준다. 지문이 없거나 다르면 null(오디오는 정상). `readCachedAudio` 가 이 함수를 쓴다. ⑶ 길이: `readCachedAudio` 가 `durationMs = wavInfo(파일)?.durationMs ?? 행 값` 을 돌려준다. ⑷ 주석: "같은 입력 → 같은 오디오"를 지우고 `storeCachedAudio` 머리 주석에 사실대로 적었다(파일 rename 과 행이 한 단위가 아님, 엔진 합성은 확률적·시드 고정 없음, 읽는 쪽은 길이를 파일에서·timing 을 지문 일치 때만 씀, `bytes` 칸만 어긋날 수 있음). P2002 분기 주석도 같은 내용으로 고쳤다. `CachedAudio.durationMs`·`timing` 필드 주석과 `readCachedAudio` 머리 주석에는 "캐시 HIT 의 유일한 읽기 경로"라고 적었다.
    2. `src/modules/speech/tts/synthesize.ts`(`fromCache`) — 따로 하던 `wavInfo(hit.audio)` 를 지우고 `hit.durationMs`(이미 파일 값)를 응답·Trace `audioMs`·`attachTiming` 길이 검사에 쓴다. 응답 `durationMs` 가 행 값을 우선하던 `hit.durationMs ?? fileMs` 순서가 사라졌다.
    3. `src/modules/speech/tts/audioUrl.ts`(`readSignedTtsAudio` 캐시 파일 경로) — `timingFor(hit.durationMs)` 로 바꾸고 `wavInfo` import 를 지웠다. 동작은 같다(값을 readCachedAudio 에서 가져옴).
    4. 시험 `src/modules/speech/__tests__/task012b4Timing.test.ts`(+2건, 2건 갱신) — 지문 단위 시험(알려진 sha1 벡터 2개·같은 내용이면 같음·1바이트 차이는 다름) · `storedTimingForAudio` 순수 시험(일치·다른 파일·지문 없음·대문자·39자·숫자·버전 칸 불일치·null) · upsert create/update 에 같은 지문이 들어가는지.
    5. 시험 `src/modules/speech/__tests__/task012b4Wiring.test.ts`(+7건, 1건 갱신) — prisma 대역에 `upsert` 를 MariaDB 식(SELECT → 없으면 INSERT/있으면 UPDATE, INSERT 때 이미 있으면 P2002)으로 넣었다. 단계마다 **게이트**(도착·허가·완료 Promise, writer 구분은 AsyncLocalStorage)를 둬서 sleep 없이 순서를 정한다. `X:file` 단계는 writer 를 시작하고 upsert 에 도착할 때까지(= 파일 rename 완료) 기다린다. 아래 인터리빙 6건은 각각 최종 파일·행의 출처와 P2002 횟수를 **시험 전제로 단언**하고, readCachedAudio·`synthesizeSentence` CACHE·#24 캐시 파일 경로 세 곳의 오디오·길이·timing 을 본다. 기존 HIT 시험에 지문 없는 행·지문 다른 행(길이 같음)을 넣었다. 새 시험 하나는 durationMs 가 파일 헤더 값이고 헤더가 깨지면 행 값으로 폴백하는지 본다. `putRow` 는 기본으로 지문을 넣는다(storeCachedAudio 와 같은 모양).
  - **인터리빙 결과**(A=1200ms, B 길이 같음=1200ms·경계만 다름 / B 길이 다름=1240ms, 내용 바이트 다름)
    | 시나리오 | 최종 파일/행 | HIT·CACHE·#24 결과 |
    |---|---|---|
    | ① A 파일→B 파일→B upsert→A upsert · 길이 같음 | B / A | timing **null**(옛 코드였다면 A 경계가 통과 = REV-136 S2), 오디오 B, 길이 1200, TTS_TIMING `NONE` |
    | ① 같은 순서 · 길이 다름 | B / A | timing null, 오디오 B, **길이 1240(행 값 1200 아님)** |
    | ③ 동시 첫 저장(A INSERT → B INSERT P2002) · 길이 같음 | B / A | P2002 1회, B 의 저장은 던지지 않음, timing null, 오디오 B |
    | ③ 같은 순서 · 길이 다름 | B / A | 위와 같음 + 길이 1240 |
    | ② B 전부 → A 전부(정상 역순) | A / A | timing = A 값(OK), 길이 1200 |
    | ④ A 전부 → B 전부(정상 순서) | B / B | timing = B 값(OK), 길이 1240 |
  - **변이 → 검출 시험**(scratchpad `rev136mut/` 사본만 한 곳씩 바꾸고 시험 3파일 실행 뒤 되돌림. node_modules 는 미러 심볼릭 링크. 스크립트 `rev136mut.mjs`, 결과 `rev136mut-results.json`. 끝난 뒤 사본 `cache.ts` 와 NFS 의 차이는 그 뒤 고친 주석 한 줄뿐이다): **6/6 검출**
    | 변이 | 결과 | 검출 시험 |
    |---|---|---|
    | m1 읽을 때 지문 비교 제거(`return timing`) — Leader 지정 | 검출(6건) | storedTimingForAudio 순수 · HIT(지문 다른 행) · ①×2 · ③×2 |
    | m2 쓸 때 지문 미저장 — Leader 지정 | 검출(5건) | 캐시 형식 · upsert · storedTimingForAudio · ② · ④(정상 순서인데 timing 이 사라짐) |
    | m3 durationMs 를 행에서 읽기 — Leader 지정 | 검출(3건) | durationMs 파일 값 · ① 길이 다름 · ③ 길이 다름 |
    | m4 HIT 이 `parseStoredTiming` 직접(지문 검사 우회) | 검출(5건) | HIT · ①×2 · ③×2 |
    | m5 update 절에서 timing·지문 제외 | 검출(5건) | upsert · ①×2 · ② · ④ |
    | m6 P2002 를 삼키지 않고 던짐 | 검출(2건) | ③×2 |
  - **실행 증빙**(전용 미러 `~/.node-local/thekaiwa-012b3`, 02:3x 전체 동기화·`prisma generate` 뒤, `DATABASE_URL=mysql://invalid:invalid@127.0.0.1:1/invalid`)
    | 명령 | 결과 |
    |---|---|
    | 시험 3파일(engine Timing·speech Timing·speech Wiring) | **36/36**(앞 27 + 신규 9) |
    | 3파일 + `lexiconCompoundGuard.test.ts` | 51/51 |
    | `src/modules/speech` 전체 | 280 tests · 279 pass · **0 fail** · 1 skip(기존) |
    | `src/modules/engine` 전체 | **171/171** |
    | `src/modules` 전체 | 1404 tests · 1403 pass · **0 fail** · 1 skip |
    | `tsc --noEmit -p .` | exit 0 — 다른 에이전트 진행 파일 2개는 **미러에서만** 격리했다: `src/components/scenario/index.ts` 의 `ScenarioDraftScreen` export 줄(010d B1, 대상 파일이 아직 없음 — 디렉터리 전체가 미추적이라 HEAD 판이 없어 그 줄만 지움) · `tests/live/p2a-qa/task043-screens-x.ts`(미추적 QA 파일, `delayMs` 타입 오류 — 미러에서 scratchpad 로 옮김). NFS 원본은 건드리지 않았다 |
    | eslint(바뀐 5파일) | exit 0 |
    | 보이지 않는 문자 grep(바뀐 5파일) | 0건 |
    | 엔진명 grep(cache.ts·Wiring 시험) | 0건(주석에 엔진 파라미터명도 쓰지 않음) |
  - **정본 반영 필요**(Leader — 나는 수정 안 함): `domain-model.md` `TtsCache.timing` — "`TtsCache.timing` JSON 에 선택 키 `audioSha1`(WAV sha1 hex) — 읽을 때 파일 지문과 같아야 timing 사용".
  - **남은 위험**
    1. **#24 토큰에 묶인 timing 은 지문이 없다.** `readSignedTtsAudio` 의 timing 은 서명 때 합성 결과에서 만든 값(턴·#23·레슨)이고 확인은 길이 비교뿐이다. 같은 키 경합으로 캐시 파일이 다른 합성으로 바뀐 뒤, recentAudio(60초)가 지나 다시 재생하면(토큰 10분 안) 길이가 같은 경우 서명 쪽 경계가 다른 오디오에 붙을 수 있다 [가능성 높음 — 코드 추적, 시험 안 함]. 닫으려면 서명 때 그 오디오 지문을 함께 묶고(`signTtsAudioToken(…, { timing, audio })` 같은 모양) #24 가 줄 오디오 지문과 비교해야 한다. 호출 지점은 `turnSpeaker.ts`(소유 범위 밖)·#23 route·`lessonAudio.ts` 세 곳이다. 이번 Leader 결정 범위(캐시 행) 밖이라 구현하지 않았다. 발생 조건은 REV-136 ①·③과 같고(공유 캐시 동시 첫 합성), 그에 더해 60초 뒤 다시 재생해야 한다.
    2. 파일과 행이 어긋난 키는 `bytes` 칸이 파일과 다른 채로 남고, timing 은 그 키가 다시 합성될 때까지 영구 null 이다(자가 치유 안 함 — 결정 범위 밖). 지문 없는 012b-4 행도 timing null 로 읽힌다(Leader 결정: 방치).
    3. 지문 불일치로 버려진 timing 은 Trace `TTS_TIMING` 상태가 옛 행과 같은 `NONE` 이다. 경합 발생을 Trace 로 구별하려면 `readCachedAudio` 가 이유를 돌려줘야 한다(`AUDIO_MISMATCH` 같은 상태). 이번엔 넣지 않았다 — QA high_risk ⒞(지문 없는 옛 행 HIT 재생)는 오디오·timing 없음으로 확인할 수 있다.
    4. 인터리빙 시험의 upsert 대역은 "MariaDB 에서 Prisma upsert = SELECT 후 INSERT/UPDATE" 가정(REV-136 I-1, 쿼리 로그 미확인)을 따른다. 네이티브 upsert 라도 ①·② 순서의 결과는 같고, ③ 은 P2002 대신 UPDATE 가 되어 ① 과 같은 모양이 된다 [추측]. 어느 쪽이든 지문 검사가 막는다.
  - **미커밋 파일**(이 블록): `src/modules/speech/tts/{cache,synthesize,audioUrl}.ts` · `src/modules/speech/__tests__/task012b4{Timing,Wiring}.test.ts` + 이 이력서·`20-Log/2026-10-07.md`.

## Reviewer 기록 (REV-130)

**REV-130 — task-012b-4 중 M4 tts-service timing(dev-012b4m4b 산출, `speech/tts-service/**` 13개 미커밋). 앱 쪽 연동은 미구현이라 범위 밖.**

**판정: PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 1 · Low 4 · Info 5. `native_change: false`(APK·네이티브 변경 없음, 앱 `src/**` 변경 없음). 재순환 시작점: 아래 M-1 을 고치면 Developer → Reviewer.

**데모 게이트**: 화면 변경 0. `check.mjs check --task` → `DEMO_GATE_PASSED`(status waived). `evidence.jsonl` waive 줄(23:43:51)의 transcript uuid 를 열어 보니 실제 user 메시지 "데모 생략하고 진행해줘"(14:43:26Z = 23:43:26 KST) 와 일치 — 에이전트 대행·`.claude/state/demo-gate/` 직접 쓰기 흔적 없음 [확인].

**직접 재실행**(우분투 `~/.node-local/thekaiwa-tts-test/venv`, Python 3.11.16) [확인]: `pytest` **129 passed · 1 skipped**(1.98s, skip = 실제 SBV2 정규화기 시험 — SBV2 미설치) · `ruff check` All checks passed · `ruff format --check` 26 files already formatted · `mypy`(strict) `app.py kaiwa_tts` **0 issues / 12 files** · `scripts/check_timing.py` 0 issues. dev 보고의 M4 스파이크 venv 130 passed·CPU/MPS 실물 수치·wav/헤더 해시 동일·단어 시작 오차는 **이번에 M4 에 접촉하지 않았으므로 [추측] 취급**(스크립트·README 서술과의 정합만 확인).

### 감사 항목별 결과

**1. 프로세스 전역 `clean_text` 래퍼 + 모델 인스턴스 `net_g.infer` 래퍼**(`backend.py:54-87,145-230`, `holder.py:240-290`)
- 반환값·예외: `out = original(*args, **kwargs)` 를 그대로 `return out`. 복사·분해가 실패하면 래퍼 안쪽 `try` 에서 `cleaned=None` 만 남기고 값은 그대로 나간다. 원래 예외는 그 `try` 밖에서 나므로 그대로 전파. [확인] 변이 — 사본 반환(m1b)·None 반환(m2)·예외 삼킴(m8) 전부 기존 테스트가 잡는다.
- 복사본: `str(norm)`·`[str(p)]`·`[int(n)]` 새 객체 — `get_text` 의 `word2ph` 제자리 ×2 와 분리. 참조 보관 변이(m3) 검출 [확인].
- **동시 요청 혼선(가장 큰 위험) — 판정: 다른 요청의 값이 응답에 실리는 경로를 찾지 못함 [확인 — 코드 + 변이 + 직접 실험]**. 보관소는 전역 변수가 아니라 `threading.local()`(`_SLOT`), `infer` 시작 때 6칸 초기화, `take_alignment` 가 한 번 꺼내고 비움, 호출은 `SerialRunner`(`max_workers=1` + `asyncio.Lock`) 안의 같은 워커 스레드에서만(`runtime.py:27`). 취소로 Lock 이 먼저 풀려도 executor 가 1개라 다음 작업은 앞 작업 뒤에 선다. 그래도 어긋나면 **틀린 값이 아니라 null** 로 떨어지는 3중 대조가 있다 — ① 모델이 실제로 받은 토큰 id 대조(`token_mismatch`) ② `normalize(요청글) == 엔진글`(`text_mismatch`, `align_to_source`) ③ Σ프레임×hop = 샘플 수(`frame_mismatch`). 실험 3종(scratchpad `mut/extra_tests.py`·`extra_api_tests.py`): (a) 두 스레드가 둘 다 `infer` 를 끝낸 채 `take_alignment` 를 부르는 겹침 시험 — 원본 통과, 슬롯을 전역으로 바꾼 변이(m7)에선 A 가 B 의 정규화 글을 가져가 실패 (b) API 수준 8스레드 24건 동시 `/synthesize`(FakeBackend delay) — 각 응답의 `durationMs`≈`X-Kaiwa-Audio-Ms`·좌표 ≤ 자기 글 길이, 직렬화를 깬 변이(m11: 실행기 4·Lock 제거)에선 실패 (c) 다른 글의 정규화 결과를 슬롯에 주입 → `token_mismatch`(null), 토큰 대조를 지운 변이(m4)는 "crossed capture was used" 로 검출. **다만 (a) 스레드 로컬 격리는 기존 테스트가 고정하지 않는다(m7 생존) → M-1.** (c) 토큰 대조는 기존 `test_captured_text_not_matching_model_tokens_is_rejected` 가 m4 를 이미 잡는다.
- 설치/제거 멱등성: 전역 플래그로 1회만 설치(변이 m9 검출), 제거 경로는 없다(프로세스 수명 동안 유지 — 의도). `refresh()` 재로딩은 새 `TTSModel`→새 `net_g` 에 래퍼를 새로 건다(옛 래퍼는 옛 net 과 함께 해제, 중복 래핑 없음) [확인 — 코드].
- SBV2 업그레이드 시 폴백: 모듈 속성 없음·import 실패 → 미설치 / 래퍼가 불리지 않거나 반환 모양이 다름 → `cleaned=None` → 공개 함수 재호출 / `net_g.infer` 반환 모양이 다름 → `unavailable` / 공개 `clean_text` 이동 → `error` — 전부 `timing=null`·오디오 정상. **예외 1건**: `net.infer` 속성 부재·setattr 실패는 `load_model` 이 보호하지 않아 모델 로드 실패가 된다(L-2).
- 모델 락·holder: 새 락 없음. `_timing` 은 같은 워커 스레드·같은 `synthesize` 호출 안(≈0.2ms)이라 직렬화 위반·데드락 경로 없음. pitch 재시도: 첫 `infer` 실패 → `finally` 가 텐서 참조를 비움 → 둘째 `infer` 가 슬롯을 초기화. MPS 텐서 참조는 `torch.mps.empty_cache()` **전에** `finally` 에서 해제 [확인 — 순서].

**2. 계약 유지** — 요청 스키마(`schemas.py`) git diff 0, `extra="forbid"` 유지(`test_request_schema_is_unchanged_for_timing`) [확인]. 응답 본문은 `encode_wav` 무변경 — 래퍼 유무 오디오 바이트 동일은 단위(가짜)로는 자명한 시험뿐이고 **실물 증거는 dev 의 M4 `check_timing.py` 해시 대조 [추측 취급]**. 타이밍 실패 4종(`unavailable·token_mismatch·frame_mismatch·error`)이 오디오를 안 깨는 경로는 `holder._timing` 의 `TimingError`+`Exception` 이중 catch(변이 m10 검출) [확인]. 헤더 `X-Tts-Timing` 은 `ok` 일 때만, base64url(패딩 없음) ASCII JSON, 단어 `[startMs,endMs,charStart,charEnd]`, 좌표 = Python `str` 인덱스 = **코드포인트**(이모지 시험 `spans[2]==(4,5)`), 버전 `v:1`·`alignerVersion`·`coord`. 상한 4096 — **100단어·5자리 ms 최악을 직접 계산하니 2,803B**(README "≈2.8KB" 일치), `MAX_TEXT_CHARS=100` 이라 실제로 `too_large` 에 닿기 어렵다. 3개 헤더 이름(`X-Kaiwa-Timing`·`X-Kaiwa-Timing-Ms`·`X-Tts-Timing`)은 `server.py`·`timing.py`·README §2 가 일치. 옛 앱×새 서비스: `styleBertHttp.ts` 는 이름을 지정해 `res.headers.get` 만 하고 헤더를 통째로 중계하지 않는다 [확인] → 무해.

**3. 보안·프라이버시** — 로그: `synth ok … timing=%s timing_words=%d timing_ms=%.2f` 와 `timing failed … err=<예외 타입명>` 뿐, `TimingError` 메시지는 상태 문자열뿐. `test_timing_failure_logs_have_no_text`(DEBUG 로 "秘密" 문장 0)·기존 `text_sha` 시험 통과. 헤더에는 숫자만(글·읽기·음소·엔진명 없음). `security.py`·`schemas.py`·인증 경로 git diff 0. 프로세스 메모리에는 마지막 합성 글이 `take_alignment` 까지 스레드 로컬에 남지만 거기서 비움(워밍업 글은 저장소 정의). nginx 4KB: M4→앱은 LAN 직접 호출이라 nginx 를 안 지난다. 앱→브라우저 헤더는 앱 단계 몫 → I-4.

**4. 품질 주장 검증** — ① 타이밍 비용 max 0.36ms(목표 0.3 초과): **수용**. 0.3ms 는 dev 자체 목표(사양 아님), 합성 0.24~0.78s 대비 0.05~0.15%, 최대치가 README 에 그대로 적힘. 숫자 문장 느린 경로는 대용 정규화기로 재 보니 105자 숫자 문장 0.74ms vs 숫자 없음 0.08ms(**실제 `normalize_text` 아님 → [추측]**), dev 의 "1ms 안팎" 추정과 같은 자리수. ② 정렬 오차(726단어 p50 12·p95 50·max 98, 단어 끝 p95 96~125·max 369, 마지막 단어 끝→소리 끝 105~313ms)는 "같은 음성의 강제정렬 대비"·"끝 경계는 덜 정확→시작 기준 강조 권장" 으로 README:57 에 정직하게 적혀 있다(사람 라벨 아님 — 이력서 남은 위험에 명시). 수치 원자료는 M4 측정이라 [추측 취급]. ③ 핀 파일 `requirements.txt`·`requirements-dev.txt`·`SETUP-M4.md`·`deploy-from-ubuntu.sh`·`check_pins.py` git diff **0**, 새 import 는 stdlib(`threading`·`base64`·`json`)뿐 [확인]. README 수치 표기 소폭 낙관 → L-4.

**5. 테스트 실효성 — 변이 17종**(scratchpad 사본, 소스 무수정):
| 변이 | 결과 |
|---|---|
| 래퍼가 사본/None 반환(m1b·m2)·예외 삼킴(m8)·`word2ph` 참조 보관(m3) | 검출 |
| 토큰 id 대조 삭제(m4)·꺼낸 뒤 비우기 삭제(m5)·중복 설치 허용(m9) | 검출 |
| 프레임 합 불변식 삭제(m12)·pitch 없는데 허용오차 적용(m13)·헤더 상한 무시(m14)·blank 몫 상한 해제(m16)·겹침 합치기 삭제(m17)·holder catch-all 삭제(m10) | 검출 |
| **슬롯을 `threading.local` → 전역 단일 슬롯(m7)** | **기존 129개 전부 통과(생존)** — 내 겹침 시험만 검출 |
| `infer` 시작 초기화 삭제(m6) | 생존 — 다른 방어층(토큰·정규화·프레임 합)이 같은 값을 걸러 거의 동등 변이, Info |
| 비-ok 인데 헤더 송출(m15) | 생존 — `timing_value` 가 `ok` 일 때만 채워져 동등 변이 |
폴백 두 경로(잡기·재호출 동일 결과)·`--break-capture` 는 단위 3문장 + dev 의 M4 실행으로 고정.

**6. 배포 영향** — M4 HEAD `36f3795` 는 로컬 HEAD `5c3a701` 의 조상이고 그 사이 `speech/tts-service` 커밋 0 → ff-merge 가능 [확인]. 서비스는 아무것도 저장하지 않으므로 `deploy-from-ubuntu.sh` 자동 롤백(`git reset --hard $PREV`+restart)과 충돌하는 상태가 없다. 요청이 그대로라 옛 앱×새 서비스 무해, 새 앱×구 서비스(0.3.x)는 헤더 없음 → 앱이 `null` 처리해야 한다(앱 계약). 스모크는 timing 을 성공 판정에 쓰지 않아 `timing!=ok` 로는 롤백되지 않는다(오디오 정상이므로 의도).

### 이슈

| # | 심각도 | 위치 | 내용 · 근거 · 권고 |
|---|---|---|---|
| M-1 | **MEDIUM** | `tests/test_backend_capture.py`(없음) | 캡처 슬롯의 **스레드 로컬·동시 격리를 고정하는 테스트가 없다**. 근거: 슬롯을 전역으로 바꾼 변이(m7)가 129 passed·1 skipped 그대로 통과. 현재는 단일 워커+Lock 과 3중 대조 덕에 틀린 값이 나가지 못하지만, 직렬화가 약해지는 리팩터(워커 증설 등) 때 이 시험이 마지막 보루다. 권고: 겹침 스레드 시험 + 다른 글 주입 시 `token_mismatch` 시험을 추가(초안 `/tmp/claude-1000/-home-brownjeon-NFS-homes-brownjeon-project-TheKaiwa/729e3300-9a56-4bdf-bda2-ca7f7603c97f/scratchpad/mut/extra_tests.py` — 기존 `sbv2` 픽스처·`FakeModel` 재사용, 원본 3건 통과·m7 검출 확인). |
| L-1 | LOW | `holder.py:283`·`params.py:88`·`schemas.py:53` | `align_to_source` 입력 상한이 없다. 좌표 기준 `plan.source_text = req.text`(원문, 최대 4096자)인데 합성 글은 `strip` 후 ≤100자 — 앞뒤 공백이 많은 원문+숫자가 섞이면 접두사 경로가 O(n²) 정규화 호출. 대용 정규화기로 **4,004자 617ms**(숫자 없음 3ms) — 단일 워커를 그만큼 점유해 다른 합성이 BUSY 로 밀린다. 실제 `normalize_text` 비용은 미측정 [추측: 같은 자리수 이상]. 호출자는 내부 시크릿 보유 앱뿐이고 앱은 ≤100자 조각만 보내므로 LOW. 권고: `len(source_text) > 2*MAX_TEXT_CHARS` 면 정렬 없이 `text_mismatch` 로 건너뛴다(3줄). |
| L-2 | LOW | `backend.py:139-140,166-178` | `_capture_alignment(net)` 가 보호되지 않는다 — `net.infer` 부재·setattr 실패면 `load_model` 이 예외 → 모델 `LOAD_FAILED`. "timing 실패가 오디오를 깨지 않는다" 원칙이 **기동 시점에는** 안 지켜진다(SBV2 핀 변경 때만 가능, `check_pins` 가 핀 고정). 권고: try/except 로 경고(예외 타입만) 남기고 래퍼 없이 계속. |
| L-3 | LOW | `server.py:240-246,259` | 합성 뒤 `encode_header`·헤더 문자열 조립이 try 밖이다. 값이 전부 int/고정 문자열이라 실제로 예외가 날 수 없지만 계약 문구("헤더 생성 실패 시 생략")를 코드가 그대로 구현하진 않는다. 권고: try/except 로 `timing_status="error"` 처리 또는 문구 정정. |
| L-4 | LOW | `README.md:54-57` | 비용 서술 "합성 대비 0.1% 미만"은 dev 표의 MPS 최악(0.36/243ms ≈0.15%)과 안 맞고, "p95 0.20ms" 는 CPU 기본 25문장 한정(pitch 0.34·속도 0.36ms). 운영 영향은 없음 — 숫자만 정정. |

**Info**: I-1 핀·의존성 영향 0(위 4). I-2 `m6`·`m15` 생존은 동등 변이. I-3 **배포 전 13개 파일이 미커밋**이라 배포 ref 가 아직 없다(`deploy-from-ubuntu.sh <SHA>` 는 커밋 SHA 필요). I-4 **앱 단계 인계**: ⒜ 앱→브라우저 헤더는 nginx `proxy_buffer_size`(기본 4KB, 헤더 전체; `/` 는 `proxy_buffering off` 여도 헤더 버퍼는 그대로)를 지나므로 M4 헤더(최대 4096자)를 그대로 중계하지 말고 앱 형식 ≤≈3KB 로 다시 만들 것 ⒝ Trace `TTS_TIMING` 은 합성을 기록하는 그 `recordTrace` 호출 안에서(REV-123) ⒞ 정본 `speech-platform/16` §8.1(`:264` 단어 `text` 필드)·§8.2/표(`:435` "narabas 를 M4 에 배치")는 아직 A 안·`replyJa 좌표` 기술 — Leader 가 웨이브 끝에 D-T3 대로 정정. I-5 `check_timing.py` 는 `--show` 일 때만 문장 조각을 찍고 대상은 저장소 작성 합성 문장(학습자 데이터 0); 스파이크 `~/kaiwa-tts-spike`(2.8GB) 정리는 사용자 몫.

### QA `high_risk_areas`
1. **운영 M4 응답 헤더**(배포 뒤): 스모크 줄 `timing=ok timing_bytes=<200~450>`, 다양한 문장(숫자·`、。`·반각 탁점·이모지·앞뒤 공백·100자 근접)에서 `X-Kaiwa-Timing` 비-ok 비율과, ok 일 때 `text[cs:ce]` 가 비어 있지 않고 오름차순·겹침 0.
2. **오디오 불변**: 같은 요청의 wav 바이트가 0.3.0 대비 동일(시드 고정 가능한 환경) 또는 최소 재생·길이(`X-Kaiwa-Audio-Ms`) 동일.
3. **`/health/detail` version `0.4.0`·`memoryMb`/`gpuMb`** 배포 전후 비교(운영 MPS footprint 는 미측정 — dev 도 인정).
4. **pitch/speed 조절 요청**(`X-Kaiwa-Adjust` applied·skipped)에서 timing 상태, 허용오차 5ms 경계(`frame_mismatch` 비율).
5. **동시 요청 N건**(앱 회화 청크 TTS 겹침)에서 각 응답 `durationMs`≈`X-Kaiwa-Audio-Ms`·좌표가 자기 글 범위.
6. **옛 앱 회귀**: 003d 미리듣기·007 회화 TTS·010 레슨 듣기 스모크가 서비스 0.4.0 에서 그대로.
7. **롤백 리허설**(사용자 승인 하): `deploy-from-ubuntu.sh 36f3795` 로 0.3.0 복귀 시 앱 동작 무변화.

### Leader 확인 필요
1. **래퍼 동시성 판정**: 현 구조에서 교차 오염 경로 없음(위 근거). 다만 M-1(스레드 로컬 시험 부재)은 배포 전 보강을 **권고**한다 — 추가 시 Developer 수정 → Reviewer 재확인(변이 m7 이 잡히는지).
2. L-1(원문 길이 가드)·L-2(기동 보호)를 이번에 넣을지 수용할지 결정. 운영 영향은 낮고 수정은 각각 수 줄.
3. 13개 파일 **커밋 단위·배포 시점**(사용자 지시 "운영 배포는 전부 끝난 뒤 한 번에" 와 맞추기) — 다른 task 의 `src/**` 미커밋분과 섞지 않기.
4. 정본 16 §8.1·§8.2 정정(D-T3) 와 앱 단계 헤더 상한(I-4 ⒜) — 앱 단계 reviewer 에게 전달.

## Reviewer 기록 (REV-131)

**REV-131 — REV-130 보강분(dev-012b4m4c) 좁은 재검토 + Codex C2(adversarial·concurrency, 1/4) 결과 판정. 범위: `speech/tts-service/` 의 `timing.py`·`backend.py`·`holder.py`·`README.md`·`tests/{test_backend_capture,test_timing,test_api}.py`. 앱 `src/**` 변경 없음(`native_change: false`). 운영 M4 무접촉.**

**판정: PASS** — Critical 0 · High 0 · Medium 0 · Low 0 · Info 4(+ Codex 메모 1건 = 오탐). REV-130 의 M-1·L-1·L-2·L-4 네 건 해소 확인, L-3 은 dev 의 "수용·무변경"을 그대로 수용. 화면 변경 0(데모 게이트는 REV-130 때 `DEMO_GATE_PASSED`(waived) 확인, task `demo_gate` 무변경).

**재실행**(우분투 `~/.node-local/thekaiwa-tts-test/venv`, Python 3.11.16) [확인]: `pytest` **135 passed · 1 skipped**(2.04s, 129→+6, skip = 실제 SBV2 정규화기 시험) · `ruff check` All checks passed · `ruff format --check` 26 files already formatted · `mypy`(strict) `app.py kaiwa_tts` **0 issues / 12 files** · `mypy scripts/check_timing.py` 0 issues. dev 보고의 M4 스파이크 venv 136 passed·M4 실제 정규화기 비용(3.8ms·4.3ms·171ms)은 **이번에 M4 에 접촉하지 않아 [추측] 취급**. 델타 확인: REV-130 시점 저장소 사본(scratchpad `mut/base2`)과 현재 파일을 `diff -u` — 바뀐 파일은 dev 보고의 7개뿐이고 `server.py`·`params.py`·`schemas.py`·`security.py`·`config.py`·`tests/conftest.py`·`scripts/*` 는 차이 0.

### 확인 항목별 결과

**1. Medium(M-1) 해소 — 해소 [확인 — 직접 재현]**
- 새 시험 `test_overlapping_threads_take_only_their_own_capture`(`test_backend_capture.py:319-`) 는 `threading.Barrier(2, timeout=5)` 두 개로 "둘 다 글 분석·정렬을 보관(모델 `infer` 안) → 둘 다 꺼낼 준비 → 꺼내기" 순서를 강제한다. **sleep 없음**(`grep sleep` 은 docstring 의 "sleep 없음" 한 줄뿐). 기대값은 같은 스레드에서 차례로 합성·꺼낸 `AlignmentCapture` 전체이고 두 스레드 결과가 `==` 로 전부 일치해야 통과(내 초안의 "정규화 글 접두사만 비교"보다 엄격). 한쪽이 예외면 두 Barrier 를 abort 해 상대를 풀어 줘 5초 timeout·`join(10)` 안에서 끝난다.
- 직접 재현(내 변이 사본 `base3` = 현재 저장소 사본, 원본 불변): **원본 30/30 통과**(회당 최대 0.30s) · **슬롯을 `threading.local()` → 전역 `SimpleNamespace()` 로 바꾼 변이(m7) 15/15 실패**. 전체 스위트를 m7 에 돌리면 실패는 이 시험 1건뿐 — REV-130 때 129개가 전부 통과하던 생존 변이를 이제 잡는다. 전역 슬롯에서는 먼저 꺼낸 쪽이 슬롯을 비우므로 나중 쪽이 항상 `None` 이 되어 타이밍 경합과 무관하게 실패한다(코드로도 확인).

**2. Low 1(길이 가드) — 해소, 상한 근거 맞음 [확인]**
- 구현: `timing.py` `TIMING_MAX_TEXT_CHARS = 2 * MAX_TEXT_CHARS`(=200, `config` 의 100 에서), `compute_timing` **첫 줄** `if len(source_text) > TIMING_MAX_TEXT_CHARS: raise TimingError("too_long")` — 정규화·검증 호출보다 앞이라 비용 0. `holder._timing` 이 `TimingError.status` 를 그대로 받아 `X-Kaiwa-Timing: too_long`, `timing=None` 이라 `X-Tts-Timing` 생략, 오디오 경로는 무변경(`server.py` diff 0). `test_overlong_request_text_skips_timing_but_keeps_audio`: 공백 패딩 정확히 200자 = `ok`·좌표 `今日`, 201자 = 200·`audio/wav`·`too_long`·헤더 없음·오디오 바이트가 짧은 요청과 동일 [확인 — 실행].
- **길이 기준 텍스트**: 요청 `text` **원본**(NFC 전·앞뒤 공백 제거 전). `plan.source_text = req.text`(`params.py:88`)이고 `compute_timing` 호출이 `plan.source_text or plan.text` 라서다. 이유가 타당하다 — 좌표 기준이 원본이고 `align_to_source` 비용도 원본 길이에 O(n²)다. 변이 `strip()` 기준(n5)·`>=`(n3)·가드 삭제(n1)·상한=100(n2) 모두 시험이 잡는다. 합성 쪽(`take_alignment`)은 이미 ≤100 인 정리된 글만 다루므로 가드가 뒤에 있어도 비용이 새지 않는다.
- **코드포인트 vs UTF-16**: 서비스는 Python `len(str)` = 코드포인트, README 도 "200 코드포인트". 앱은 M4 로 보내는 **바로 그 문자열**(발음 사전 치환 뒤 `text`)을 `[...text].length`(= 코드포인트)로 세어 `maxCharsOf` 이하여야 보낸다 — `styleBertHttp.ts:112-113`, 그리고 `maxCharsOf` 는 `Math.min(DEFAULT_MAX_CHARS, …)` 라 설정값이 커도 **≤100 으로 고정**(`styleBertHttp.ts:38-40`; 스키마상 max 200·runtimeMax 100). 서비스도 NFC·strip 뒤 100 초과는 400. 따라서 앱발 요청이 `too_long` 에 닿을 수 없다(원본 ≤100, 상한 200 은 2배 여유). 단위 혼동은 없다. dev 가 근거로 든 `synthesize.ts:211` 은 **치환 전** `seg.normalizedText` 검사이고 `sentences.ts:62` 는 조각 합치기라, 실제로 보낸 문자열을 막는 가드는 위 어댑터 쪽이 더 직접적이다(I-3).

**3. Low 2(`_capture_alignment` 보호) — 해소, 보호 범위 좁음 [확인]**
- 변경(`backend.py:139-143`): `try: self._capture_alignment(net) except Exception: log.warning("alignment capture skipped model=%s err=%s — timing unavailable", spec.model_id, type(e).__name__)` **한 줄만** 감싼다. `model.load()`·`net.float()`·`spk2id`/`style2id` 읽기·`ModelInfo` 조립은 try 밖이라 진짜 로드 실패는 그대로 전파(`LOAD_FAILED`)된다 — diff 로 확인. 래퍼가 안 걸린 모델은 `_SLOT.frames_t` 가 비어 `take_alignment` → `None` → holder `unavailable`, 오디오 정상(시험이 정상 모델과 오디오 배열 동일까지 확인).
- 로그: 모델 id(정규식 검증된 값)와 **예외 타입명만**. 시험은 일부러 예외 메시지에 "秘密の文" 를 넣고 전 로그 레코드에 "秘密" 0 을 확인, 경고는 정확히 1줄. 변이 — try 삭제(n6)·메시지를 `e` 로 남김(n7) 둘 다 시험이 잡는다.
- 한 가지 못 고정한 것: "try 가 `model.load()` 까지 삼키는" 방향의 회귀(내 변이 n8)는 시험이 못 잡는다(Info I-2). 현재 코드는 맞다.

**4. Low 4(README) — 해소 [확인]** — 비용 문장: "p95 0.20ms" 를 **CPU 기본 25문장 한정**으로 명시하고 "pitch·속도·MPS 10문장은 0.34~0.36ms", 최대 0.36ms, **"MPS 최대 0.36ms ÷ 합성 p50 243ms ≈ 0.15%"**(0.36/243 = 0.148% — 산술 일치). 이력서 `### 본 구현 — 최종` 표(CPU 0.165/0.197/0.296 · pitch 0.188/0.342/0.342 · 속도 0.182/0.364/0.364 · MPS 0.199/0.360/0.360 · MPS 합성 p50 243)와 일치한다. `too_long` 은 `X-Kaiwa-Timing` 값 목록에 정의·이유·"앱은 ≤100자만 보내 닿지 않음"과 함께 들어갔고, "`ok` 가 아니면 `X-Tts-Timing` 이 없고 오디오는 그대로" 문장도 유지 — README 의 상태 목록과 코드의 `TimingError` 상태 집합이 일치. 호환(옛 앱×새 서비스: 알려진 헤더 이름만 읽음 / 새 앱×옛 서비스: 헤더 없음 → null)도 변경 없음. 새 숫자(접두사 경로 3.8ms·4.3ms·171ms)는 dev 의 M4 실제 정규화기 측정이라 [추측 취급]이지만, 내 대용 정규화기 측정(105자 숫자 0.74ms·4,004자 617ms)과 방향·"상한이 없을 때만 크다"는 서술은 일치한다.

**5. 무변경·가시성** — `requirements.txt`·`requirements-dev.txt`·`SETUP-M4.md`·`scripts/deploy-from-ubuntu.sh`·`scripts/check_pins.py`·`schemas.py`·`security.py`·`config.py` 모두 HEAD 대비 `git diff --name-only` 0건 [확인]. 보이지 않는 문자(Cf/Cc·NBSP·BOM·ZWSP·방향 제어) `speech/tts-service` 의 `.py/.md/.txt/.sh/.toml` 전부 **0건** [확인].

### 변이 재확인(현재 저장소 사본, 소스 무수정)
| 변이 | 결과 |
|---|---|
| 슬롯 `threading.local` → 전역(m7) | **검출**(겹침 시험 1건, 15/15) |
| 길이 가드 삭제(n1)·`>=`(n3)·strip 기준(n5)·상한=100(n2) | 검출 |
| `load_model` 보호 삭제(n6)·예외 메시지 로그(n7) | 검출 |
| 길이를 UTF-16 단위로 셈(n4) | 생존 — 시험의 경계 문장이 BMP 뿐(I-1) |
| `model.load()` 실패까지 삼킴(n8) | 생존 — 전파를 고정하는 시험 없음(I-2) |

### Codex C2(adversarial·concurrency, 1/4) 결과 판정
Codex 지적 **0건**(reasoning effort low, 운영 M4·실제 SBV2 동시 요청·연결 중단 실험 미수행 — `not_reviewed` 에 명시). 지적이 없으므로 채택할 항목은 없고, 내 감사(위 1~5 + REV-130 의 동시성 실험)를 Codex 결과로 대체하지 않았다. Codex 가 이론적 메모로 남긴 1건만 판정:

- **메모**: "전역 `clean_text` 설치 플래그는 동시 `__init__`(이중 설치) 시 이중 래핑될 수 있으나 … 오디오·타이밍 실패 시나리오는 없다." → **판정: 오탐(도달 불가) — 락·플래그 보강 불필요. Info 메모만(이슈 수에는 불산입).**
  - **도달 경로 확인** [확인 — 코드]: `_install_text_capture()` 호출 지점은 `Sbv2Backend.init()` 한 곳(`backend.py:121`)이고 `init` 은 `ModelHolder._init_backend`(`holder.py:145-147`) 에서만 불린다. 그 호출자는 ① `_startup`(`holder.py:164`) = `server.py:118` 의 `runner.run("startup", holder.startup)` ② `refresh`(`holder.py:194`, 백엔드 초기화가 앞서 실패했을 때만) = `server.py:312` 의 `runner.run("refresh", holder.refresh)` — **둘 다 `SerialRunner`(`max_workers=1` 실행기 + `asyncio.Lock`)의 같은 워커 스레드**이고 서로 겹칠 수 없다. 그 밖의 호출자는 `scripts/check_timing.py:94`(`holder.startup()` 을 메인 스레드에서 1회, 서비스와 별개 일회성 프로세스)뿐. 설치 플래그 `_TEXT_CAPTURE_INSTALLED` 는 **프로세스 전역**이라 같은 프로세스에서 `create_app` 을 다시 불러도(테스트 등) 두 번째 `init` 은 건너뛴다. 다중 프로세스(uvicorn `--workers`)는 프로세스별 모듈 상태라 이중 래핑이 아니다. 결국 "두 스레드가 동시에 `init`" 은 서비스 구조상 일어나지 않는다.
  - **일어나도 무해함** [확인 — 실험]: 내 사본에서 플래그를 내리고 일부러 **이중 설치**한 뒤(래퍼가 실제로 중첩됨을 확인) 한 번 합성 — 원본 `clean_text` 호출은 **합성당 1회**, 잡기 경로 유지(공개 함수 재호출 0), 정렬·오디오가 단일 설치 결과와 **동일**. 중첩 래퍼는 같은 스레드 로컬 슬롯에 같은 복사본을 두 번 쓸 뿐이다(Codex 서술과 일치).
  - **권고**: 락·원자적 플래그를 넣지 않는다 — 그 불변식(모델 작업은 전부 단일 워커)은 이미 `runtime.py` docstring 이 계약으로 못 박았고, 워커를 늘리면 먼저 REV-131 의 겹침 시험(M-1 보강)이 깨진다. 수정하지 않음.

### 이슈 — Info 4건 (조치 불필요, 기록)
- **I-1** `n4` 생존: 길이 가드를 UTF-16 코드 유닛으로 세어도 시험이 통과한다(경계 시험이 BMP 문자와 공백뿐). 앱발 요청은 코드포인트 ≤100 → UTF-16 유닛 ≤200 이라 상한 200 에 어느 쪽 단위로도 닿지 않아 실제 영향 없음. 원하면 이모지 1~2개 포함한 경계 시험 1건.
- **I-2** `n8` 생존: `model.load()` 실패가 `load_model` 밖으로 전파되는 것을 고정한 시험이 없다. 현재 보호 범위는 정확히 한 줄이라 코드로 확인됨. 원하면 `TTSModel.load` 가 예외를 던지는 가짜로 전파를 확인하는 시험 1건.
- **I-3** 근거 인용 정밀도: 상한 200 의 앱 쪽 근거는 `synthesize.ts:211`(치환 전)보다 `styleBertHttp.ts:38-40,112-113`(실제 전송 문자열, ≤100 고정)이 더 직접적이다. 결론은 같다(앱발 요청은 닿지 않음).
- **I-4** 잔여 비용: 상한 아래의 숫자 많은 100자 문장은 정렬 ≈3.8ms 가 그대로 든다(dev 보고, M4 실측 [추측 취급]). 합성 0.24~0.78s 대비 1% 미만이라 수용, 운영 빈도는 앱 정규화기가 숫자를 읽기로 바꾸므로 낮다(dev 가 이미 "남은 위험"에 적음). REV-130 L-3(헤더 조립 무보호)은 dev 수용대로 무변경 — 값이 전부 int·고정 문자열이라 예외 경로가 없다.

### QA `high_risk_areas` (REV-130 목록에서 바뀐 것만)
- 1·2·3·4·5·6·7 은 REV-130 그대로. **추가·보강**: (8) 운영 스모크에서 `X-Kaiwa-Timing` 값 집합이 `ok`·`unavailable`·(드물게) `empty`·`frame_mismatch` 외에 `too_long` 이 **앱 요청에서는 0건**이어야 한다 — 나오면 앱이 100자 초과를 보낸 것(앱 가드 회귀 신호). (9) 모델 로드 로그에 `alignment capture skipped` 경고가 **0줄**이어야 한다 — 나오면 SBV2 구조 변경(그 모델 `unavailable`, 오디오 정상). (10) 서비스 기동 `/health` OK·`warmedUp`·모델 3종 로드(`modelsLoaded`)가 0.3.0 과 같은지 — 감싸기 보호가 모델 로드를 삼키지 않는다는 REV-131 확인의 운영 대응.

### Leader 확인 필요
없음(차단 사항 0, Codex 지적 0·채택 0). 선택: I-1·I-2 는 시험 각 1건이지만 현재 코드가 맞아 이번에 안 넣어도 된다. Codex 호출 차수는 1/4 사용 — 이후 단계(judge C2 재판정·QA)는 Leader 판단.

## Reviewer 기록 (REV-133)

**REV-133 — task-012b-4 앱(서버) 쪽 timing 연동(dev-012b4app2 산출, `src/**` 미커밋 20개). M4 서비스 쪽은 REV-130·131 PASS(커밋 `78bde96`)라 범위 밖, 화면(`src/components/**`)은 아직 없음. 감사 2026-10-07 01:20~01:56, reviewer 신규 소환 — 소스·테스트·스키마 수정 0, DB 쓰기 0, 운영 3010·운영 M4 접촉 0(미러 시험은 `DATABASE_URL=mysql://invalid:invalid@127.0.0.1:1/invalid`).**

**판정: PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 1 · Low 4 · Info 8. `native_change: false`(plugins·android·Manifest·capacitor 변경 없음). 재순환 시작점: Medium 을 고치기로 하면 Developer → Reviewer.

**데모 게이트**: 화면 변경 0(이번 범위). `check.mjs check --task …` → `DEMO_GATE_PASSED`(waived 2026-10-06T23:43:51+09:00). `evidence.jsonl` waive 줄의 `transcript_uuid` 를 세션 transcript 에서 열어 보니 user 역할 메시지 "데모 생략하고 진행해줘"(14:43:26Z = 23:43:26 KST)이고 `quote_sha256` 이 그 문장의 해시와 같다 — 에이전트 대행·`.claude/state/demo-gate/` 직접 쓰기 흔적 없음 [확인]. 승인 데모가 없고 designer 구현 가이드만 있으므로 데모 대비 material/implementation/defect 분류는 해당 없음. 가이드와의 차이 1건(implementation 로 허용): 가이드는 단어 필드를 `{charStart,charEnd,startMs,endMs}` 객체로 적었고 구현은 튜플 `[startMs,endMs,charStart,charEnd]` — Leader 결정 D-T1 헤더 JSON 이며 화면 개발자에게 순서를 알려야 한다(L-3).

**재실행**(미러 `~/.node-local/thekaiwa-012b3`, 이번에 NFS 에서 다시 sync·`prisma generate`) [확인]:
| 명령 | 이번 | dev 보고 |
|---|---|---|
| 신규 시험 2파일 | **17/17** | 17/17 |
| `src/modules/speech` | 262 tests · 261 pass · **0 fail** · 1 skip | 같음 |
| `src/modules/engine` | **170/170** | 같음 |
| `src/modules` 전체 | **1373 tests · 1371 pass · 0 fail · 2 skip** | 1328 · 1326 · 1 fail · 1 skip |
| `src/components`+`src/types` | **561/561** | 561 |
| `tsc --noEmit` | exit 0 | exit 0 |
| eslint(변경 20파일, 시험 포함) | exit 0 | exit 0 |
- 전체 숫자 차이: 그 사이 010d·012b-2 가 시험 파일을 더해 총 시험 수 +45·skip +1. dev 가 본 1 fail(`task037.test.ts` "repairRootClose 는 buildTalk·buildChat 만")은 **재현하지 못했다**(지금 0 fail). 그 시험은 `repairRootClose: true` 를 켠 빌더 목록을 보는데, 현재 010d 미추적 `scenarioVerdict.ts`(01:47 수정)에는 `repairRootClose` 가 없다(grep 0)·`task037.test.ts` 무수정(10-05)·이 task 변경 파일에 `conversation/**` 없음 → dev 의 귀속(010d 파일 상태 탓)과 모순은 없으나 과거 실패 자체를 내가 다시 보지는 못했다 [추측 취급].
- 감사 전후 20개 파일 sha256 동일(NFS 무수정), NFS ↔ 미러 `cmp` 20개 동일.

### 감사 항목별

**1. 오디오 불변(최우선) — 오디오를 깨뜨리는 경로를 찾지 못함 [확인 — 코드·fuzz·변이]**
- 어댑터: `readTimingHeaders` 호출을 try/catch(→ `INVALID`)로 감쌌고, 검사 실패는 전부 `timing=null`·합성 성공이다. timing 읽기는 `isWav` 검증 **뒤**다. 요청 본문 키 6개 고정(시험). 엔진에 보내는 글 무변경: `substituteReadingsMapped().derived` 를 HEAD 의 `substituteReadings` 구현과 **30,000 랜덤 입력**(서로게이트·빈 읽기·겹치는 표기 포함)에서 비교해 0건 차이(scratchpad `subst.ts`).
- L4: `attachTiming` 은 try/catch(→ `ERROR`). 가드가 없는 곳 — `toStoredTiming`(합성 `.then`)·`parseStoredTiming`(HIT)·`rememberTokenTiming`(서명)·`wavInfo`(HIT) — 은 던질 수 없게 짜였는지 fuzz 로 확인: 함수 8종 × 20,000 반복(쓰레기 JSON·NaN·`[[null…]]`·초과 길이·뒤집힌 token·서로게이트) **throw 0**(`fuzz2.ts`). 검증을 거치지 않은 `stored` 를 `chunkTiming` 에 직접 넣으면 TypeError 가 나지만 `stored` 는 늘 `parseStoredTiming`/`toStoredTiming` 을 지나고 `attachTiming` 이 잡는다.
- 응답: #23 `ttsAudioResponse`·#24 모두 헤더 **추가만**(`X-Tts-Cache`·`X-Trace-Id`·본문·`Content-Length`·`Cache-Control` 무변경 — diff 확인). SSE #32: `turnSpeaker` 는 서명 인자 하나만 바뀌었고 `TurnChunkAudio` 모양·`turnAudio.ts`·`TalkRoom` 무변경. HIT·SHARED·MISS 세 경로의 timing 부착이 같은 구조다. HIT 에서 `wavInfo` 가 이제 항상 불리지만 헤더만 읽고, 손상 파일이면 null 로 timing 만 빠진다.
- 남은 위험 → QA: `readCachedAudio` select 에 `timing`·`timingVersion` 이 늘었다 — 운영 DB 에 칸이 없으면 **모든 HIT 가 실패**한다. 스키마에는 오래전부터 있고(`git log -S timingVersion` → 325007c)·TtsCache 표는 003d 에서 이미 쓰였으므로 칸이 있을 가능성이 높지만 DB 를 직접 보지 않았다 [추측]. upsert 인자 모양은 `tsc` 가 `Prisma.DbNull` 타입을 받아들였고, 오프라인으로는 더 검증할 수 없다(Prisma 가 DB 연결 뒤에 인자를 검증 — 알 수 없는 필드 대조군도 InitializationError 였다).

**2. 좌표 정확성 — 맞음. 틀린 강조가 나가는 경로를 찾지 못함 [확인]**
- 손계산 4건을 실제 코드로 돌려 일치(`hand.ts`): ① `2026/9/26に行く。`(정규화 `二千二十六年九月二十六日に行く。` 16자) 서비스 단어 [0,12)·[12,15) → 조각 글 **[0,9)·[9,12)** = `2026/9/26`·`に行く`, 날짜를 6|2|4 로 쪼갠 단어도 [0,9) 하나로 합침 ② `１２人です。`(전각 숫자) `十二人` [0,3) → `１２人` [0,3) ③ `😊こんにちは。` [0,5) → **[1,6)**(이모지 1 코드포인트, UTF-16 이었다면 2) ④ 사전 `日本橋`→`ニホンバシ` + `10人`: 서비스 `ニホンバシ`[0,5)·`十人`[6,8) → 정규화 글 [0,3)·[4,6) → 조각 글 [0,3)·[4,7)(`10人`).
- 성질 검사: 31문장 × 40분할(1,223시행·4,318단어)에서 범위·순서·겹침 위반 **0**. 단독 재정규화 대조 41건 어긋남은 전부 오라클의 문맥 의존(`…` 가 중간이면 `、`·단독이면 `。`, 세 자리 숫자 `百二十三` 의 일부 글자가 숫자 전체 `123` 으로 넓혀짐 — 설계 그대로)이며 지도 오류가 아니다.
- 서로게이트 쌍·역행·범위 밖·겹침: 어댑터 `checkTimingWords`(4-튜플·0≤s<e≤durationMs·글 범위·시간·글 오름차순·겹침 0)와 `projectTimingWords` 가 **전체 null**(부분 폐기 없음). 서로게이트 한가운데 경계는 null. 결합 문자는 서비스(NFC 전 글 기준 코드포인트, REV-130)가 맡고 앱은 코드포인트만 센다.

**3. 캐시 — 맞음**
- `ttsCacheUpsertArgs` 가 create·update 둘 다 `timing`·`timingVersion` 을 싣고 timing 이 없으면 둘 다 `DbNull`/null(옛 오디오의 timing 이 새 파일에 남지 않게). 변이 d-m5(update 누락)·n9(create 누락) 검출. 옛 행(timing NULL)은 `parseStoredTiming(null,…)` → null → HIT 서빙·상태 `NONE`, `timingVersion` 칸과 JSON 버전이 다르면 null.
- 오디오 캐시 키 12요소 불변: `ttsCacheKey`·`prepareSentence` 의 `parts` 계산 diff 0, `tokens` 는 `PreparedSentence` 의 부가 칸일 뿐. `prepareSegments` 는 출력 모양을 그대로 두고(`tokens` 없음) token map 은 새 `prepareSegmentsWithTokens` 에만 있다. `lexiconCompoundGuard.test.ts` 는 `prepareSegments` 를 부르고 파일이 **무수정**(git status)이라 기대값 갱신 없이 통과한다. 합성 경로는 `prepareSegmentsWithTokens` 로 옮겨 갔고 `prepareSegments` 의 소비자는 이제 시험뿐이다(I-4).
- 타 사용자 오염: 캐시 키에 사용자가 없어 같은 키를 여러 사용자가 공유한다. 저장 timing 은 **정규화 글 좌표·숫자뿐**(글·사용자 정보 없음)이고, 조각 글 좌표는 요청마다 그 요청의 token map 으로 따로 만든다(`OK`/`オーケー` 처럼 원문이 달라도 같은 행을 안전하게 씀). 저장 전에 `toStoredTiming` 이 엔진 길이↔wav 길이(허용 2ms)·글 범위를 다시 검사한다.

**4. #24 메모리 timing 맵 — 안전, 시험 공백 1건(L-1)**
- 소유 검증: 토큰 MAC 이 `userId` 를 포함하고 `readSignedTtsAudio` 가 `verifyTtsAudioToken` 통과 **뒤에만** 조회한다 — 다른 사용자는 같은 `cacheKey`·같은 초여도 토큰 문자열이 달라 조회도 불가(시험: 타인 세션 null).
- 상한·정리: 512건·토큰 만료(10분)와 같은 TTL·서명 때마다 만료 청소·꽉 차면 가장 오래된 것 삭제. 항목 크기는 `chunkTiming` 이 앱 헤더 ≤3072자(JSON ≈2.3KB)만 통과시키므로 최악 ≈1.2MB. pm2 `thekaiwa` `instances: 1` [확인 — ecosystem.config.js].
- 재시작·blue/green: 그 시각에 서명된 조각만 `X-Tts-Timing` 없이(오디오 정상) 재생 — 수용 가능(recentAudio 와 같은 방식). 다중 인스턴스로 늘리면 다시 설계해야 한다.
- 동시성: 한 프로세스 단일 스레드라 경합 없음. 같은 사용자·키·초에 **다른** 값이 서명되면 둘 다 null(시험·변이 d-m7 검출), 같은 값(같은 글이 한 턴에 두 번)은 유지.

**5. 헤더 크기·정보 — 여유 있음, 새 정보 노출 없음**
- 앱 형식을 다시 만든다: `{v,coord,durationMs,words}` 숫자만, M4 헤더(`method`·`alignerVersion`·`X-Kaiwa-*`)를 중계하지 않음. 앱 상한 3072자(`TTS_TIMING_HEADER_MAX`) 초과면 생략.
- nginx: 운영 `/etc/nginx` 어디에도 `proxy_buffer_size`·`proxy_buffers` 설정이 없다(grep 0) → 기본 4k(x86_64) [확인 — 파일 조회, 실제 요청 실측은 못 함]. 응답 헤더 합 **최악 ≈3,643B**(`X-Tts-Timing` 3072자 + 보안 헤더 4개·`Vary`·`Date`·`Keep-Alive`·모델/사전 버전 헤더 가정 계산)/4,096, 보통(1,200자) ≈1,771B. `proxy.ts` 는 `Set-Cookie` 를 붙이지 않고 `next.config.ts` 의 보안 헤더 4개가 전부다. 실제 100자 조각의 timing 은 ≈1.1KB 안팎이고 단어 100개 최악도 ≈2.8KB(base64) 로 3072 아래라 상한이 걸리지 않는다. 여유가 ≈450B 뿐이므로 #23/#24 에 헤더를 더 붙일 때는 다시 계산할 것(I-3).
- 새는 정보 없음: 앱 헤더·#23 JSON `timing`·Trace 에는 시간·좌표·상태뿐(`#23` JSON 의 `normalizedText` 는 기존 필드). 시험이 "글·엔진 정보 없음"을 직접 확인.

**6. Trace — 맞음**
- `TTS_TIMING[i]` 는 `attachTiming` 이 **`finishTrace` 호출 앞에** 같은 `steps` 에 넣는다(CACHE·SHARED·SYNTH 세 경로 — 시험은 소스 스캔, 변이 d-m6(CACHE)·d-m6b(SYNTH) 둘 다 검출). 회화 턴은 `record:false` 라 `turnSpeaker` 가 `steps` 를 돌려주고 오케스트레이터가 `steps.push(...audio.steps())` 로 **턴의 `recordTrace` 한 번**에 합친다(`orchestrator/index.ts:593`); `appendTraceSteps` 는 쓰지 않는다. 실패 경로는 timing 이 존재하지 않으므로 단계가 없다(정상).
- 012b-3 집계(`ttsAggregate.ts`)는 이름 정규식 `^TTS_SYNTH\[n\]$`·`^TTS\[n\]$`·`TTS` 만 보므로 `TTS_TIMING[i]` 는 무시된다(시험 + 코드 확인, 다른 소비자에 `startsWith('TTS')` 류 없음).
- 상태값: 서비스 값 목록(grep 으로 `timing.py`·`holder.py`·`server.py` 의 `ok·error·unavailable·empty·frame_mismatch·text_mismatch·token_mismatch·too_long·word_mismatch·too_large` 대조)과 어댑터 닫힌 목록이 일치하고 그 밖은 `UNKNOWN`. `TOO_LARGE`(서비스 4096 초과)와 `HEADER_TOO_LARGE`(앱 3072 초과)가 구분된다(시험). 상태 문자열이 M4 에서 와도 닫힌 목록 밖은 Trace 에 못 들어간다.

**7. #62c `charStart` — 맞음**
- `codePointLength(text.slice(0, p.start))` — UTF-16 인덱스 `p.start` 를 코드포인트로 센다. 이모지 줄(`はい😊、そうです。…`)에서 조각 글이 줄을 `Array.from` 으로 자른 것과 같음(시험), UTF-16 로 바꾼 변이 n4 검출. `splitSentences` 는 조각이 서로 이어 붙고(공백만 있는 조각은 맨 끝에서만 걸러짐) 앞 공백을 조각에 남기므로 조각 글 좌표 + `charStart` = 줄 좌표다. additive 라 옛 클라이언트에 영향 없음(응답 키 하나 추가, 라우트는 `r.clips` 를 그대로 반환).
- 평가 듣기(#67a, `evalAudio.ts`)를 뺀 것은 타당 — 글을 숨기는 화면이라 단어 위치·문장 길이를 주면 답을 드러낸다. 그 토큰은 timing 을 묶지 않으므로 #24 도 헤더를 주지 않는다. 이론상 같은 사용자·같은 캐시 키·같은 초에 레슨 clip 과 평가 clip 이 같은 토큰이 되면 timing 이 공유되지만 같은 초에 같은 문장을 두 경로가 서명할 일은 사실상 없다(I-5).

**8. 계약·6층·위생 — 이상 없음**
- 엔진명(`reazon|whisper|style-bert|stylebert|sbv2|narabas|claude`)은 어댑터 밖 변경 파일에서 **0건**. `method: ENGINE_DURATION` 은 산출 방식 라벨이며 사용자 응답·헤더에는 없다(관리자 Trace·DB 만).
- import: speech → `@/modules/engine`(index)·`@/types/tts`·`@/modules/infra`(index) 뿐, 내부 경로 import 0(grep). engine 안에서 어댑터 → `../../tts/timing`. 요청 스키마 무변경.
- 소유 밖 파일: `git diff HEAD` 로 이 task 변경 20개 외에 timing 을 건드린 diff 없음(`components`·`conversation`·`learning`·`evaluations`·`utterances`·`seed.ts` 의 diff 에 `X-Tts-Timing|TtsTiming|timingVersion|charStart|encodeTimingHeader` 0). `src/modules/speech/index.ts` 의 diff 는 012b-2 몫뿐이다. `speech/tts-service` 미커밋 변경 0.
- 보이지 않는 문자: 이 task 20개 파일에 U+2028/2029·ZW·방향 제어·BOM·NBSP **0건**(grep -P 가 양성 대조군 `repairRootClose.test.ts` 에서는 잡힘을 확인, 파이썬 교차 확인 0). 비밀 하드코딩 없음(grep 0).

**9. 테스트 실효성 — 순수 로직은 강하고, 배선·안전망은 비어 있음**
- 변이 **42종**을 scratchpad 사본에서 한 곳씩(원본 무수정). dev 보고 8건(m1~m8)은 **8/8 재현 검출**(m6 은 CACHE·SYNTH 두 경로). 전체 **27 검출 · 15 생존**. 생존 15건 = 동등·중복 6건(n7·n7b `lead` 보정 — 정규화기가 앞뒤 공백을 token 으로 이미 지워 실제로 `lead` 가 0, n12c recall 만료는 verify 가 이미 확인, n16 헤더 길이 검사는 쓰레기 값이 어차피 INVALID, n22·n26 구성상 도달 불가) + **실제 시험 공백 9건**(n12·n12b #24 맵 상한·청소, n17·n18 어댑터·`attachTiming` try/catch, n19 `turnSpeaker` 서명에 timing 묶기, n20 #23 wav 헤더, n21 보호 구간 한 칸씩 지도, n30 `charStart` 응답 배선, n32 HIT 가 저장 timing 반환).
- 좌표를 뒤집는 변이는 전부 검출: 정규화 지도 start/end 뒤집기(n1)·바뀐 token 을 한 칸만(d-m8)·source/derived 코드포인트↔유닛 변환 생략(n27·n28)·합치기 끔(d-m3)·시간 end 합치기(n29)·사전 지도 길이(n3·n31)·`a=max`(n2).

| 변이(대표) | 결과 |
|---|---|
| d-m1~m8(dev 보고 8종) | 전부 검출 |
| n1·n2·n3·n4·n5·n8·n9·n10·n13·n14·n15·n23·n24·n25·n27~n29·n31 | 검출 |
| n7·n7b·n12c·n16·n22·n26 | 생존(동등·중복) |
| n12·n12b·n17·n18·n19·n20·n21·n30·n32 | **생존(시험 공백)** |

### 이슈

| # | 심각도 | 위치 | 내용 · 근거 · 권고 |
|---|---|---|---|
| M-1 | **MEDIUM** | `speech/__tests__/task012b4Timing.test.ts`·`engine/__tests__/task012b4Timing.test.ts`(배선 시험 없음) | timing 을 클라이언트에 **실제로 전달하는 배선 지점**과 안전망에 단위·정적 시험이 없다. 변이 근거(15건 중): #23 wav 헤더 삭제(n20)·`turnSpeaker` 가 서명에 timing 을 안 묶음(n19)·`synthesizeLessonClips` 가 `charStart` 를 0 으로(n30, 시험은 `lessonClipPieces` 도우미만)·HIT 가 저장 timing 을 버림(n32)·어댑터/`attachTiming` try/catch 삭제(n17·n18)가 모두 초록으로 통과. #24 wav/JSON 헤더(라우트)도 시험이 없다. 지금은 순수 로직이 강해 배선만 라이브 QA 가 지킨다 — 한 줄 지우는 리팩터가 조용히 기능을 끈다. 권고: ① `ttsAudioResponse`(순수)에 헤더 있음/없음 시험 ② `signTtsAudioToken(…,{timing})` → `readSignedTtsAudio` 가 이미 있는 시험을 `turnSpeaker`·레슨 서명 호출부(소스 스캔 또는 `synthesizeSentence` 대역)로 확장 ③ `readCachedAudio` 의 timing 반환은 prisma 대역으로 1건 ④ 안전망은 던지는 대역 주입 1건씩. 라이브 QA 가 end-to-end 로 덮으므로 배포 차단은 아니다. |
| L-1 | LOW | `audioUrl.ts` `rememberTokenTiming` | #24 맵의 **상한 512·만료 청소가 시험으로 고정돼 있지 않다**(n12·n12b 생존) — 감사 요구 항목(메모리 상한·정리)이 변이로 증명되지 않음. 권고: 513번째 서명 후 크기 ≤512·오래된 것 제거, 만료 항목 청소를 확인하는 시험 2건. 코드 자체는 읽어서 맞음. |
| L-2 | LOW | `synthesize.ts`·`cache.ts`(HIT 경로) | **timing 이 없는 캐시 행은 다시 채워지지 않는다.** HIT 는 있는 그대로 서빙하고 재합성 경로가 없다(dev 가 "Leader 판단"으로 남김). 결과: ① 배포 전에 캐시된 문장(오늘의 회화 레슨 문장 포함)은 캐시에서 밀려날 때까지 강조 없음 ② **웹을 M4 0.4.0 보다 먼저 배포하면 그 사이 합성된 모든 행이 `timing=null` 로 영구 저장**된다 — 이력서 M4 체크리스트의 "배포 순서 무관"은 **안전**에 대해서만 맞고 **커버리지**에는 틀리다. 권고: 배포 순서를 M4 → 웹으로 고정하고, 기존 NULL 행 처리(방치/폐기/HIT 시 1회 재합성 — upsert update 가 이미 timing 을 갱신함)를 Leader 가 정한다. 사양(D-T7 "012b-4 이전 캐시 행만 없음")과는 일치하므로 결함은 아님. |
| L-3 | LOW | `docs/design/api-contract.md`(#23·#24·#62c)·`domain-model.md`(TtsCache.timing)·`speech-platform/16` §7.2·§8.1·§8.2 | **정본 미동기화.** 코드는 헤더·JSON `{v,coord,durationMs,words:[[startMs,endMs,charStart,charEnd]…]}`·조각 글 좌표·정규화 글 좌표 캐시인데 정본은 `words[{text,startMs,endMs,charStart,charEnd}]`·`method/alignerVersion`·`replyJa` 좌표·"첫 청취는 강조 없이"·narabas 기술이 남아 있고 api-contract 에는 `X-Tts-Timing`·`charStart` 가 한 줄도 없다(grep 0). dev 가 5항목 반영안을 이미 제출했다. 권고: 웨이브 끝 정본 반영 때 함께, **화면 개발자·QA 에 튜플 순서와 코드포인트 단위를 전달**(designer 가이드는 객체 표기). 배포 전 반영 필수. |
| L-4 | LOW | `speech/__tests__/task012b4Timing.test.ts` "사전 보호 구간…표기 안 경계도 유지" | 시험 제목은 보호 구간 **안쪽 경계도 유지**를 말하지만 입력은 `日本橋` 하나를 통째 단어로 줘서 안쪽 경계가 없다 → 보호 token 을 블록 지도로 바꾸는 변이 n21 이 생존. 영향은 보호 구간 단어가 합쳐져 강조가 거칠어지는 정도(틀리지는 않음). 권고: `日本`|`橋` 로 쪼갠 단어를 넣어 기대값 `[[0,3]]` vs `[[0,2],[2,3]]` 를 가른다. |

**Info**(조치 불필요)
- **I-1** 가드 없는 곳(`toStoredTiming`·`parseStoredTiming`·`rememberTokenTiming`·`wavInfo`)은 던질 수 없다(fuzz 20,000×8함수 throw 0, 위 1).
- **I-2** 동등 변이 6건은 위 9 표 참고 — 특히 `normalizationUnitMap` 의 `lead` 보정은 현재 정규화기에서 항상 0 이라 죽은 코드에 가깝다(정규화기가 앞뒤 공백을 token 으로 지움). 제거해도 되지만 정규화기 규칙이 바뀔 때의 안전망으로 남겨도 무방.
- **I-3** 헤더 여유 ≈450B(최악 계산 3,643/4,096) — #23/#24 에 헤더를 더하기 전에 재계산. 운영 nginx 실측은 못 했다 → QA.
- **I-4** `prepareSegments` 는 이제 시험(task-035 L-2 고정값)만 부른다 — 모양을 고정하려고 남긴 것으로 이해, 정리는 선택.
- **I-5** 평가 듣기 토큰·레슨 clip 토큰의 이론상 같은 토큰 겹침(7 참고) — 사실상 불가.
- **I-6** `Synthesized.timingStatus = 'DURATION_MISMATCH'` 는 `toStoredTiming` 이 null 인 모든 사유(방식·버전·길이)를 한 이름으로 묶는다 — 어댑터가 먼저 거르므로 사실상 길이 어긋남뿐, 표기만 부정확.
- **I-7** 서비스 상태값 ↔ 어댑터 닫힌 목록 손으로 대조 일치(위 6). 서비스가 새 사유를 내면 `UNKNOWN` 으로 떨어져 안전하다(Trace 만 덜 구체적).
- **I-8** `prisma.ttsCache.upsert` 의 새 인자 모양(특히 `update` 의 `Prisma.DbNull`)은 오프라인으로 검증할 방법이 없었다(위 1) — QA 의 DB 왕복으로.

### QA `high_risk_areas`
1. **운영 DB `TtsCache.timing`·`timingVersion` 칸 실존**과 새 select 로 HIT 정상(없으면 모든 HIT 실패) — 배포 전 개발 DB(같은 NAS)에서 HIT 1회.
2. **DB 캐시 행 왕복**: MISS 뒤 행에 timing JSON(`v·method·alignerVersion·coord·base·durationMs·words`)+`timingVersion=engine-duration-1`, 같은 문장 HIT 에서 timing 반환, upsert update(같은 키 동시 재합성) 때 갱신·없으면 NULL, MariaDB 에서 `Prisma.DbNull` create·update 모두 성공, 캐시 쓰기 실패 로그 `[tts] 캐시 저장 실패` 0.
3. **M4 0.4.0 실물**(배포 뒤): 앱 Trace `TTS_TIMING.status` 분포 — `OK` 가 대부분이고 `INVALID`·`PROJECT_FAILED`·`DURATION_MISMATCH`·`HEADER_TOO_LARGE`·`UNKNOWN` 은 0 이어야 함, `TOO_LONG` 0(앱 ≤100자), 숫자·이모지·앞 공백·사전 치환(`日本橋`)·`、。` 문장에서 `조각글[cs:ce]` 가 단어와 일치. 구 M4(0.3.x)·헤더 깨짐에서도 재생·상태 `ABSENT`/`INVALID`.
4. **헤더 실측**: 운영 nginx 경유 #23·#24 wav 의 `X-Tts-Timing` 길이 최대값과 응답 헤더 합(≤4096 여유), 단어가 많은 100자(ひらがな) 조각에서 502 `upstream sent too big header` 0.
5. **오디오 불변**: 같은 요청의 wav 바이트(시드 고정 가능 시)·`X-Tts-Cache`·`X-Trace-Id`·SSE `audio` 이벤트 모양 전후 동일, HIT·MISS TTFA 30턴 전후(회귀 없음), timing 이 없거나 깨져도 재생.
6. **#24 소유·수명**: 타 계정 토큰 404, timing 은 서명한 계정 토큰에서만, 재시작·blue/green 전환 직후 그 조각만 헤더 없음(재생 정상), 512건 넘는 burst 에서 밀려난 조각은 강조 없이 재생.
7. **Trace**: 회화 턴 1건의 `RequestTrace.steps` 에 `TTS_TIMING[i]` 가 청크마다 있고(MISS·HIT 혼합) 같은 행(별도 append 없음), 012b-3 `EngineMetricsDaily` 집계 값이 timing 도입 전후 같음.
8. **#62c**: 레슨 clips `charStart` — 이모지·여러 조각 줄에서 `Array.from(줄)` 위치와 일치, clip timing 좌표 + `charStart` 로 줄을 자르면 단어와 일치. 평가 듣기(#67a) 응답에 `charStart`·timing 헤더 없음.
9. **배포 순서·롤백**: M4 → 웹 순서(L-2), 롤백 시 앱 `timing=null`·오디오 정상, 배포 직후 HIT 의 `TTS_TIMING.status=NONE`(옛 행) 비율 기록.
10. 003d 미리듣기·007 회화 TTS·010 레슨 듣기 스모크(옛 클라이언트 회귀).

### Leader 확인 필요
1. **배포 순서 M4 → 웹**(L-2)과 기존 NULL 행 처리 방침(방치/폐기/HIT 시 재합성). 이력서 M4 체크리스트 4번("배포 순서 무관")은 "안전"에 한정해 고칠 것.
2. **M-1 시험 보강 여부** — 하면 Developer 수정 → Reviewer 재확인(변이 n19·n20·n30·n32·n12 가 잡히는지). 안 하면 QA 라이브가 유일한 배선 보증이므로 high_risk 1·2·3·6·8 을 반드시 실행.
3. **정본 5건 반영**(L-3)과 화면 개발자에게 `words` 튜플 순서 `[startMs,endMs,charStart,charEnd]`·코드포인트 단위·헤더 `X-Tts-Timing`(base64url, `{v,coord,durationMs,words}`)·#62c `charStart` 전달.
4. 차단 사항 없음. 화면 단계는 이번 감사 범위 밖(별도 재감사 필요). 재실행 숫자·변이 원자료: scratchpad `rev133/`(`mut-run*.log`·`hand.ts`·`fuzz2.ts`·`prop.ts`·`subst.ts`).

## Reviewer 기록 (REV-136)

**REV-136 — Codex C2(2/4, data_integrity) 지적 1건 판정: `cache.ts:130` `storeCachedAudio` 다중 writer 경합.** 코드·문서·scratchpad 모의만 사용(라이브·M4·DB 접촉 0, 제품 코드 무수정). 확신 표기: `[확인]` = 이번 세션에서 읽거나 실행, `[추측]` = 근거 있는 추정.

**판정: 부분 채택 — Codex [high] → [Medium]**(오탐 아님. 단 Codex 의 전제 일부 — "pm2·blue/green 다중 프로세스" — 는 이 배포 구조에 맞지 않고, 위험의 성격은 "잘못된 단어 강조"보다 "timing 이 영구히 꺼짐"이 주된 모양). 차단 사항 아님 · **배포 전 소규모 보강 권고**.

| ID | 심각도 | 내용 |
|---|---|---|
| M-1 | Medium | 파일(wav)과 행(`bytes`·`durationMs`·`timing`)이 한 단위로 묶이지 않아, 같은 키를 두 프로세스가 겹쳐 쓰면 **마지막 파일 ≠ 마지막 행**이 될 수 있고(실험 재현), 길이가 같은 쪽은 `chunkTiming` 의 2ms 길이 검사를 통과해 다른 합성의 단어 경계가 나간다. `timing.ts` 머리의 "틀린 강조 금지" 불변식 위반 경로 |
| L-1 | Low | `cache.ts:136` 주석 "같은 입력 → 같은 오디오" 는 사실이 아니다(아래 2). `fromCache`(`synthesize.ts:319`)·#24(`audioUrl.ts:160`)가 길이를 행 값(`hit.durationMs`)으로 내보내는 것은 이 task 이전부터 있던 같은 계열 위험(`git show d8598fd` — 옛 update 절도 `bytes·durationMs·path` 덮어씀) |
| I-1 | Info | MariaDB 에서 Prisma `upsert` 는 네이티브가 아닐 가능성이 높아(SELECT 후 INSERT/UPDATE) 동시 첫 저장은 P2002 로 나타난다 [가능성 높음 — Prisma 문서 기억, 쿼리 로그 미확인]. 이 경우 `return` 한 쪽 파일이 이미 덮어써져 있다(Codex 의 P2002 서술은 코드와 맞음) |

### 1. 같은 키 동시 합성이 실제로 일어나는가 — 운영 단독에서는 거의 없고, 개발·QA·운영이 캐시를 공유하는 쪽이 문
- **프로세스 안**: `synthesize.ts:141-148` `createSingleFlight` 가 같은 키를 in-flight Map 으로 합치고 저장이 끝난 뒤에야 지운다(`singleFlight.ts:33-43`) → 한 프로세스·한 모듈 인스턴스 안에서는 두 번째 writer 가 안 생긴다 [확인]. 다만 `flights` 는 모듈 상수다. 같은 코드베이스의 `recentAudio.ts:12`·`audioUrl.ts:40` 는 "route 마다 번들이 달라도 같은 보관소"를 위해 `globalThis` 를 쓴다 → Next 가 route 별로 모듈을 따로 올리면 `flights` 도 갈라질 수 있음 [추측 — 실제로 갈라지는지는 이번에 확인 못 함].
- **운영 인스턴스**: `ecosystem.config.js` 의 `thekaiwa` 는 `instances: 1`·`exec_mode` 없음(fork)·`-p 3010` 고정 [확인]. 같은 포트라 두 릴리스가 동시에 설 수 없고 `startOrReload` 는 fork 모드에서 재시작이다(`docs/dev-deploy-workflow.md:252` "링크 되돌리고 reload") [가능성 높음 — pm2 를 실행해 보지는 않음]. 요청이 짚은 "blue/green 전환 중 두 릴리스 동시 구간"은 이 구조에 없다.
- **실제로 닿는 곳**: `TtsCache` 에 환경 칸이 없고 `DATA_ROOT` 도 개발·운영 공유(`cache.ts:146` 주석 [확인]). 키 12요소의 `engineConnectionKey` 는 `EngineConnection.key`(환경별 행이지만 seed 가 환경마다 같은 `c.key` 문자열을 넣는다 — `seed.ts:33·39`, `synthesize.ts:286`) → **환경은 키에 안 들어간다**. 개발(3011)·QA 두 번째 프로세스(3012, ACTIVE.md:39 "2프로세스 경합")·운영(3010)이 같은 문장·같은 설정을 겹치면 같은 키를 두 프로세스가 쓴다. 창 = 합성 0.25~1s + 저장(파일+행 커밋 0.6~1.4s, `recentAudio.ts:5-9`·task-003d:327) ≈ 2초 안팎. 사람이 쓰는 운영 트래픽만으로는 사실상 0, **QA 의 의도적 경합 시험이 가장 현실적인 발화점**.

### 2. "같은 입력 → 같은 오디오" — 성립하지 않는다
- 이력서 288행(dev 스파이크): "B(VITS 프레임 배분)는 합성마다 확률적(sdp_ratio 0.2·noise_w)이라 운영 wav 와 비교할 수 없다" [확인 — 저장소 내 근거].
- 서비스에 시드 고정이 없다: `speech/tts-service/kaiwa_tts/*.py`·`app.py` 에서 seed 0건, 기본 noise 0.6·noiseW 0.8·sdpRatio 0.2(`README.md:47`·`schemas.py:48-49`) [확인]. VITS 가 `randn` 으로 길이·잠재 변수를 뽑는다는 라이브러리 내부는 이 PC 에 없어 직접 못 읽음 [가능성 높음].
- "오디오 바이트 동일 25/25" 는 반복 합성 결정성의 증거가 아니다: `check_timing.py:123·138` 이 합성마다 `torch.manual_seed(1000+i)` 를 건 뒤 **래퍼 유무**만 비교한다(이력서 366·409행도 "같은 시드"로 명시) [확인]. task-003d 의 "5 동시 요청 바이트 동일 663,748B" 는 single-flight 로 엔진을 1번만 부른 결과라 마찬가지 [확인].
- **어긋남의 크기 [추측 — 모의, 실측 아님]** (`rev136/mc.py`: 음소별 기본 3~12프레임, 실제 = ceil(base·exp(0.2·σ·z)), σ∈{0.3,0.6,1.0} 가정, 음소 15/30/45개, 단어 = 3음소): 두 독립 합성의 **총 프레임이 같을 확률 2.5~13%**(σ 클수록·문장 길수록 낮음). 같을 때 단어 경계 최대 어긋남은 중앙 23~116ms, p95 35~221ms, 최대 약 70~340ms. 즉 낮은 σ 가정에서는 "수십 ms 흔들림", 높은 σ 꼬리에서는 "단어 하나 길이"까지 간다. σ 를 실측하지 못해 꼬리는 열어 둔다. 길이가 다르면(90%↑) 아래 2ms 검사(프레임 1칸 = 11.6ms)가 100% 걸러 timing=null.

### 3. 역전 시 실제 피해 — 실험 재현 (scratchpad `rev136/`)
방법: 실제 `cache.ts` 사본(import 3줄만 스텁으로 교체, `diff` 로 확인)을 임시 DATA_ROOT + MySQL 방식 upsert 에뮬레이션(SELECT→INSERT/UPDATE, 동시 INSERT 는 P2002) 위에서 두 writer 를 단계 게이트로 인터리빙. 읽기는 실제 `readCachedAudio`→`chunkTiming`(`fromCache` 와 같은 호출).

| 시나리오(A=먼저, B=나중 파일) | 최종 파일 / 최종 행 | 읽기 경로 결과 |
|---|---|---|
| S1 A.file→B.file→B.INSERT→A.UPDATE, **길이 다름**(2322 vs 2403ms) | B / A | 행 `durationMs` 2322 ≠ 파일 2403(`fromCache` 가 행 값을 내보냄), `bytes` 204,844 ≠ 212,012, timing = `DURATION_MISMATCH` → **null**(안전, 단 그 키는 영구히 null) |
| S2 같은 순서, **길이 같고 경계만 다름** | B / A | timing = **OK**, A 의 경계가 B 의 오디오에 붙음(내 임의 값으로 최대 69ms 어긋남) → **틀린 강조 경로 실재** |
| S3 A.file→B.file→A.INSERT→B.INSERT | B / A | B 는 **P2002 로 `return`**, 행은 A, 파일은 B — S2 와 같은 결과 |
| S4 정상 순서(A 전부 → B 전부) | B / B | 일치(어긋남 0) — 현행 update 절의 의도는 이 경우에만 맞다 |

- 이전에도 있던 위험인가: `bytes·durationMs·path` 는 이 task 이전부터 같은 update 절에 있었다(`git show d8598fd -- cache.ts` [확인]). 피해는 `X-Tts-Duration`·응답 `durationMs` 가 파일과 수십 ms 다른 정도라 눈에 안 띄었다. 이 task 는 **같은 경합에 `timing`·`timingVersion` 을 얹어** 눈에 보이는 기능(강조)을 붙였다 → "기존 위험의 확대".
- `writeDataFile` 은 이미 임시 파일+`rename` 이라(`infra/storage.ts:73-86` [확인]) 반쯤 쓰인 파일은 없다. 문제는 "누가 마지막 rename 이고 누가 마지막 행이냐"의 순서뿐.

### 4. 완화책 비교 (제품 코드 무수정 — 제안만)
| 안 | 변경 크기 | 위험 | 효과 | 시험 방법 |
|---|---|---|---|---|
| (a) 결정성 확인·문서화 후 수용 | 주석만 | 근거가 거짓(2) → 근거 없는 수용 | 없음 | — |
| (b) update 에서 덮어쓰지 않기(create-only) | 작음 | 마지막 rename 이 이기고 행은 첫 creator 라 **역전이 안 사라지고 방향만 바뀜**(S3 그대로). 파일도 선착순(`link` EEXIST)이어야 하고 행 없는 옛 파일 처리가 따라온다 → 영구 MISS 위험 | 불완전 | 인터리빙 4종 |
| (c) 파일 경로에 내용 해시(`<키>.<sha8>.wav`), 행이 가리키는 파일 불변 | 중~대: 경로 생성·`readCachedAudio`·prune `removeFile`·고아 청소·"경로는 키에서만, DB path 신뢰 안 함" 불변식 개정 | 경로 검증·prune 회귀 | **완전**(한 문장 UPDATE 가 path·bytes·duration·timing 을 같이 가리킴) | 인터리빙 4종 + prune·경로 탈출 회귀 |
| (d) `bytes` 로 검증 | 작음 | wav 길이 = 프레임×hop×2+44 라 bytes 차이 ⇔ 길이 차이 → `chunkTiming` 의 길이 검사와 같은 정보. **S2 를 못 잡음** | 없음(이미 있는 방어) | — |
| **(d′) 오디오 지문**: 쓸 때 wav sha1 을 `timing` JSON 안에 같은 UPDATE 로 저장, 읽을 때 파일 sha1 이 같을 때만 timing 제공 | **작음**: `cache.ts` ≈10줄 + 시험 + 도메인 모델 한 줄. **스키마 변경 없음(db push 불요)**, 경로 불변식 유지 | 지문 없는 행은 timing null 로 읽힘 — d8598fd 웹은 아직 미배포라 영향은 dev/QA 행뿐. 불일치 키는 timing null 이 영구(자가 치유 선택: 불일치 감지 시 행 삭제 → MISS 재합성) | **틀린 강조 0**(S1·S2·S3 → null, S4 정상 — 시제품 실험 `rev136/cacheProto.ts`), sha1 0.125ms/307KB | 인터리빙 4종 × 길이 같음/다름 |
| (e) 프로세스 간 직렬화(MariaDB `GET_LOCK`·파일 락) | 중 | Prisma 풀은 연결 스코프라 `GET_LOCK` 이 새고, NFS 락 신뢰성 | 불확실 | — |

**권고 1안: (d′)** + 같은 패치에서 ⑴ `fromCache`·`readSignedTtsAudio` 가 길이를 **파일**(`wavInfo`)에서 읽게(행 값이 아니라 — 한 줄) ⑵ `cache.ts:136` 주석 정정("같은 입력이어도 합성은 확률적 — 행과 파일이 다른 합성일 수 있다"). 이유: 위험이 낮은 확률·완만한 피해라 (c) 의 구조 변경은 과하고, (a)·(b)·(d) 는 S2 를 못 막는다. (c) 는 **`instances > 1`·cluster 도입 시** 다시 검토(트리거 조건). 필요한 시험 = "두 writer 인터리빙" — `task012b4Wiring.test.ts` 가 쓰는 prisma 델리게이트 대역(`Object.defineProperty`)+임시 DATA_ROOT 위에 게이트를 얹어 S1~S4 를 고정하고, 지문 비교를 지우는 변이가 S2 로 검출되는지 확인. 하네스 원형은 `rev136/{infraStub,exp}.ts`(그대로 이식 가능, `missingCacheKeys(keys, db = prisma)` 처럼 `storeCachedAudio` 도 `db` 인자를 받게 하면 대역 없이도 시험 가능).

### 못 한 것·한계
- SBV2 내부(`randn` 사용)·실제 σ(길이 산포)·M4 반복 합성은 확인 못 함 — 2의 확률·크기는 가정 모의다. Next 16 Turbopack 에서 route 별 모듈 중복 여부, Prisma MySQL upsert 의 실제 SQL, NFS `rename` 의 프로세스 간 가시성도 미확인.
- 캐시 정리(prune)는 아직 진입점이 없어(`cache.ts:145-148`) 이 경합과 겹치는 경로는 이번 범위 밖.

### 인계
- **Leader 확인**: ① (d′) 적용 여부 — 적용하면 Developer(`cache.ts`·`synthesize.ts:319`·`audioUrl.ts` 길이 읽기·시험) → Reviewer 좁은 재감사. 미적용(수용)이면 Medium 으로 기록하고 위 트리거에서 (c) 재검토. ② 정본: `domain-model` `TtsCache.timing` JSON 에 선택 키 `audioSha1` 한 줄(적용 시). ③ 채택 지적 수정 뒤에는 judge 규칙(C3 재발 여부)에 따라 Codex 재호출 필요성 판정.
- **QA `high_risk_areas`**: ⒜ 공유 `TtsCache` 에서 "두 프로세스 같은 문장 동시 합성" 시험은 운영 캐시 행을 오염시킬 수 있으니 시험 뒤 해당 키 행·파일 정리 ⒝ 캐시 HIT 에서 `X-Tts-Timing` 의 `durationMs` 가 응답 wav 길이와 같은지 ⒞ (d′) 적용 시: 지문 없는 옛 행 HIT 이 timing 없이 정상 재생되는지.
- 원자료: scratchpad `rev136/`(`infraStub.ts`·`exp.ts`·`exp.log`·`cacheCopy.ts`·`cacheProto.ts`·`mc.py`).

```json
{ "reviewId": "REV-136", "status": "CONDITIONAL_PASS", "issues": [
  { "issue": "storeCachedAudio 두 writer 경합 — 파일과 행(bytes·durationMs·timing) 비결속, 길이 같은 쪽은 다른 합성의 단어 경계가 통과", "severity": "MEDIUM", "component": "src/modules/speech/tts/cache.ts:130-142", "risk": "캐시 키 단위로 timing 영구 null 또는 수십~수백 ms 어긋난 강조(희박)", "evidence": "rev136/exp.log S1~S3, README.md:47, check_timing.py:123·138, 이력서:288, ecosystem.config.js instances:1", "recommendation": "(d') 오디오 sha1 을 timing JSON 에 같은 UPDATE 로 저장·읽을 때 파일 sha1 일치 시에만 timing 제공 + 길이는 파일에서 + 주석 정정" },
  { "issue": "cache.ts:136 주석의 결정성 가정이 사실과 다름·행 durationMs 를 길이로 내보냄(이전부터)", "severity": "LOW", "component": "cache.ts:136, synthesize.ts:319, audioUrl.ts", "risk": "응답 durationMs 가 파일과 불일치", "evidence": "rev136/exp.log S1", "recommendation": "위 패치에 포함" } ],
  "summary": { "critical": 0, "high": 0, "medium": 1, "low": 1 },
  "high_risk_areas": ["공유 TtsCache 동시 합성 시험의 행 오염", "캐시 HIT X-Tts-Timing durationMs ↔ wav 길이", "지문 없는 옛 행 HIT 재생"], "native_change": false }
```

## Reviewer 기록 (REV-138)

**REV-138 — REV-136 보강(오디오 지문 `audioSha1`, 커밋 `c8acab8`) 좁은 재감사.** 대상 5파일(`speech/tts/{cache,synthesize,audioUrl}.ts` · 시험 `task012b4{Timing,Wiring}.test.ts`)만. 제품 코드 무수정(Read 전용) — 변이·재현은 scratchpad 사본 `rev138/mut`, HEAD 사본 `rev138/head`(`git archive`)에서만. 라이브·운영 3010·DB 쓰기·M4 접촉 0(`DATABASE_URL=mysql://invalid:invalid@127.0.0.1:1/invalid`). 데모 게이트 `check.mjs check --task …task-012b-4…` → `DEMO_GATE_PASSED` / `task: task-012b-4`(status waived — 화면 무변경). 확신 표기: `[확인]` = 이번 세션에서 읽거나 실행, `[추측]` = 근거 있는 추정.

**판정: PASS_WITH_NOTES** — Critical 0 · High 0 · Medium 0 · Low 3 · Info 4. `native_change: false`. 재순환 필요 없음(권고만). REV-136 의 M-1(파일≠행 경합 시 틀린 단어 강조)·L-1(행 길이·거짓 주석)은 **종결로 본다**(아래 3 의 변이 시험 근거). 남는 것은 #24 토큰 묶음 timing 의 이론적 구멍 하나(L-1, 수용 권고).

| ID | 심각도 | 내용 |
|---|---|---|
| L-1 | Low | **#24 토큰에 묶인 timing 에는 지문이 없다**(dev 보고 ① 확인). 사본 재현 `rev138/mut/src/modules/speech/__tests__/rev138repro.test.ts` — 서명 때 timing A(1200ms), recentAudio 만료 후 캐시 파일이 같은 길이의 B 로 바뀌면 `readSignedTtsAudio` 가 **B 오디오에 A 경계**를 준다 [확인]. 도달성은 아래 4 ①로 매우 낮다 → 수용 권고 |
| L-2 | Low | 지문 불일치로 버린 timing 의 Trace 상태가 옛 행·timing 없는 행과 같은 `NONE` — 경합 발생을 Trace 로 구별 못 한다(dev 보고 ③) |
| L-3 | Low | 정본 `docs/design/domain-model.md` `TtsCache.timing`(1819-1821행) 주석이 실제 저장 모양(`{v,method,alignerVersion,coord,base,durationMs,words}`)과 이미 달랐고(`TtsTimingMetadata{…startMs,endMs,charStart…}`), 새 선택 키 `audioSha1` 도 없다 — Leader 문서 작업(dev 가 이미 요청) |
| I-1 | Info | `bytes` 칸이 파일과 어긋난 채 남는 것·지문 불일치 키의 timing 이 null 로 남는 것 = 수용 가능(4 ②) |
| I-2 | Info | 변이 15건 중 미검출 3건은 모두 실효 없는 변이(아래 3) — 시험 보강은 한 줄(지문 마지막 글자만 다른 케이스) 권고 |
| I-3 | Info | 재실행 모집단 차이(dev 1404 ≠ 내 1405/1376)와 tsc 의 `tests/` 오류는 타 에이전트 진행 파일·스크래치 위치 탓(아래 5) — 이 커밋과 무관 |
| I-4 | Info | `wavInfo` 는 형식 태그(PCM/float)를 보지 않고 `byteRate` 로만 길이를 계산한다(float 태그 → 100ms 그대로 반환). 이 커밋 이전부터의 동작이며 길이 폴백 안전성에는 영향 없음 |

### 1. 지문 로직 정확성 — 이상 없음 [확인]
- **쓸 때**: `storeCachedAudio` 가 `writeDataFile(segs, audio)` 와 `ttsCacheUpsertArgs(key, parts, audio, …)` 에 **같은 `audio` 인자**를 넘긴다(`cache.ts:169-171`). `writeDataFile` 은 `writeFile(tmp, data)` → `rename` 으로 변환·재인코딩이 없다(`infra/storage.ts:73-86`). 호출처 `synthesize.ts:144` 는 `r.out.audio`(응답·recentAudio 에 넣은 객체와 같다). `timingColumns(timing, audio)` 가 `audioFingerprint(audio)` 를 JSON 끝에 붙이고, `ttsCacheUpsertArgs` 가 **같은 `...t`** 를 create(`data` 스프레드 `cache.ts:156`)·update(`:158`)에 실어 한 문장 안에서 간다. timing 이 null 이면 `{DbNull, null}` — 지문도 없다(시험 `캐시 upsert`가 단언).
- **읽을 때**: `readCachedAudio`(`cache.ts:105-121`)가 파일을 읽고 `storedTimingForAudio(row.timing, row.timingVersion, audio)` 에 **읽은 바이트**를 넘긴다. 이 함수는 `parseStoredTiming`(모양·버전 검사)을 먼저 통과시킨 뒤 `SHA1_RE`(소문자 hex 40) + `sha === audioFingerprint(audio)` 문자열 비교. 옛 행(지문 없음)·지문 불일치·대문자·39자·비문자열 → null. **오디오와 길이는 timing 과 무관하게 항상 정상 반환**. 비용: 모양 검사가 먼저라 timing 없는 행은 sha1 을 계산하지 않는다.
- `audioSha1` 이 응답·헤더·Trace 로 새지 않는다: `parseStoredTiming` 이 알려진 필드만 골라 새 객체를 만든다(`timing.ts:61`), `encodeTimingHeader`·`TtsTiming` 은 `{v,coord,durationMs,words}` 만 직렬화(`timing.ts:100-104`).
- **단일 경로 전수 grep**: `prisma.ttsCache` 사용처는 `cache.ts` 뿐(`findUnique` 1곳 = `readCachedAudio`, `update`·`delete`·`upsert`, prune 의 `findMany`·`deleteMany`, `missingCacheKeys` 의 `select key`). `readCachedAudio` 호출처는 `synthesize.ts:142`(singleFlight `readCache` — `lookup`·`produce` 재조회 → `fromCache`)와 `audioUrl.ts:158`(#24) 둘. #23 route·회화 턴(`turnSpeaker.ts:51`)·레슨(`lessonAudio.ts:56`)은 모두 `synthesizeSentence` 경유라 같은 지문 검사를 지난다. `tests/live/*` 는 `storeCachedAudio`·`cacheSegments` 만 쓴다(행 timing 직접 읽기 0). 행의 timing 을 지문 없이 읽는 다른 경로는 없다.

### 2. 길이를 파일에서 — 이상 없음 [확인]
- `wavInfo` 퍼즈(사본 `rev138/mut/fuzz138.ts`): 유효 wav 를 **모든 길이로 절단**·헤더 바이트 무작위 변조 20,000·무작위 버퍼 5,000(절반은 RIFF/WAVE 머리)·빈 버퍼·43바이트·float 태그·`byteRate` 0·거대 `data`/`fmt` size → **25,553회 throw 0**. 헤더 불량·0바이트·잘림은 null → `?? row.durationMs` 로 행 값 폴백(시험 `readCachedAudio(HIT) — durationMs …`가 깨진 헤더 → 777 단언). `storedTimingForAudio` 에 null·undefined·배열·`Object.create(null)`·Date·함수 등 14가지 raw → throw 0.
- `synthesize.ts` `fromCache` 는 `hit.durationMs` 를 응답·Trace `audioMs`·`attachTiming` 길이 검사에 쓰고(지운 `wavInfo`/`fileMs` 없음), `audioUrl.ts:160` #24 는 `timingFor(hit.durationMs)`. **회귀 없음**: 단일 writer 에서는 행 `durationMs` 가 합성 때 `info.durationMs`(= 같은 wav 헤더 값)라 응답 `durationMs`·`X-Tts-Duration`·`Content-Length`(`f.audio.length`)·#24 JSON 모양이 그대로이고, 값이 달라지는 경우는 경합·헤더 불량뿐이다. `chunkTiming` 의 2ms 길이 방어(`timing.ts` DURATION_MISMATCH)도 그대로 남아 이중이다.

### 3. 인터리빙 시험 실효성 — 실효 있음 [확인]
- **결정성**: 시험 파일에 `setTimeout`·sleep 없음(grep — 주석 한 줄만). 게이트(도착·허가·완료 Promise, writer 구분 AsyncLocalStorage)가 순서를 정하고, `reach()` 는 writer 가 그 단계 전에 끝나면 매달리지 않고 실패한다. 각 시나리오는 **전제를 단언**한다: 최종 파일 출처·최종 행 출처(`[fileFrom,rowFrom]`)·`p2002` 횟수·불일치 키의 행 timing non-null. 전제가 깨지면 결과 단언 전에 실패한다.
- **변이 재현**(사본만 한 곳씩 바꿔 3파일 36건 실행 후 되돌림, 스크립트 `rev138/mut.mjs`, 로그 `mut.log`·`mut2.log`·`mut3.log`, 끝난 뒤 사본≠미러는 내 재현 시험 파일 하나뿐 `diff -rq`): **15건 중 12 검출 · 3 미검출(실효 없음)**
  | 변이 | 결과 | 검출 시험 |
  |---|---|---|
  | r1 읽을 때 지문 비교 제거 | 검출(6) | storedTimingForAudio · HIT · ①×2 · ③×2 |
  | r2 쓸 때 지문 미저장 | 검출(5) | 캐시 형식 · upsert · storedTimingForAudio · ② · ④ |
  | r3 길이를 행에서 | 검출(3) | durationMs 파일 값 · ① 길이 다름 · ③ 길이 다름 |
  | r4 update 절에서 timing 제외 | 검출(5) | upsert · ①×2 · ② · ④ |
  | r5 쓸 때 **다른 바이트**(끝 1바이트 제외)의 지문 | 검출(5) | 캐시 형식 · upsert · storedTimingForAudio · ② · ④ |
  | r10 create 에만 지문 없음 | 검출(1) | 캐시 upsert |
  | r11 P2002 를 던짐 | 검출(2) | ③×2 |
  | r12 헤더 파싱 실패 폴백 제거 | 검출(1) | durationMs 파일 값(깨진 헤더) |
  | r13 **옛 방어(길이 2ms 검사)만**으로 대체(REV-136 S2 재현 모양) | 검출(4) | storedTimingForAudio · HIT · ① 길이 같음 · ③ 길이 같음 |
  | r9 #24 캐시 경로 길이를 null | 검출(2) | 회화 턴 · 레슨 #62c |
  | r6 지문 **앞 2자만** 비교 | 미검출 | 가상 변이(해시 앞 2자 충돌 확률 1/256 — 고정 입력 시험으로는 못 가름). I-2: "마지막 글자만 다른 지문" 케이스 한 줄 추가 권고 |
  | r7·r8 길이 검사·응답 길이에 timing 값 우선 | 미검출 | 지문이 맞을 때만 timing 이 있고 그 길이는 합성 때 같은 wav 와 ≤2ms 차 → 실효 없는 변이 |
- **REV-133 변이 6/6 여전히 검출**: #24 헤더 제거(`rev133a`)·레슨 `charStart` 제거(`b`)·좌표 +1(`c`, 9건)·#23 헤더 제거(`d`)·#24 토큰 맵 상한 제거(`e`)·2ms 길이 방어 제거(`f`). `task012b4Wiring` 전체 통과(36/36 안).

### 4. 남은 위험 판정
1. **#24 토큰 timing 무지문 — Low, 수용 권고.** 재현은 됐지만 도달 조건이 겹겹이다: (i) 서로 다른 두 프로세스가 **같은 키를 동시에 첫 합성**(개발·QA·운영이 TtsCache·DATA_ROOT 공유, 창 ≈2초) (ii) 두 합성의 wav 길이가 ±2ms 안으로 같음(REV-136 모의 2.5~13% [추측]) (iii) #24 를 **recentAudio 보관 60초(`recentAudio.ts` `RECENT_AUDIO_TTL_MS`) 뒤**에 다시 받아야 함 — 토큰 TTL 은 10분(`TTS_AUDIO_URL_TTL_SEC=600`) [확인]. 출하된 클라이언트는 `audio` 이벤트 직후 한 번 받고 **404 만** 4초 안에 재시도한다(`components/talk/chunkFetch.ts`) [확인] — 60초 뒤 재요청 경로가 없다. 응답은 `Cache-Control: private, max-age=<남은 초>`(`tts/[token]/route.ts`) [확인]이라 브라우저는 첫 응답을 재사용한다(WebView 동작은 [추측]). 지난 메시지 다시 듣기는 #23(`synthesizeSentence` CACHE — 지문 검사 통과)으로 간다. 피해는 단어 강조가 수백 ms 어긋나는 외형뿐이고 데이터 노출·오디오 손상은 없다. **권고: 지금은 수용**, 다음 중 하나가 생기면 닫는다 — ⒜ `signTtsAudioToken(…, { timing, audio })` 로 서명 때 지문을 토큰 항목에 함께 묶고 `readSignedTtsAudio` 파일 경로에서 비교(호출처 `turnSpeaker.ts`·#23 route·`lessonAudio.ts` 세 곳 — 소유 범위가 달라 이번 task 에서는 하지 않는다) ⒝ `instances>1`·cluster 도입 ⒞ QA 의 교차 프로세스 경합 시험에서 #24 불일치가 실제로 관찰됨.
2. **`bytes` 불일치·timing 영구 null — 수용 가능.** `bytes` 는 prune 용량 합계 계산에만 쓰인다(`cache.ts:223·237·323·328`) — 차이는 합성 간 길이 차이(수 KB)라 정리 판단에 영향 없음 [확인]. timing null 은 "영구"가 아니다: 캐시 키 12요소에 `modelVersion`·`dictionaryVersion` 이 들어 있어 사전·모델 버전이 바뀌거나 LRU purge 되면 그 키가 새로 합성된다 [확인 — `cache.ts` 키 구성]. 그 사이에는 강조 없이 정상 재생(원칙 "틀린 강조보다 없는 강조"). 자가 치유(불일치 시 행 삭제)는 다른 프로세스 쓰기와 다시 경합하므로 권하지 않는다.
3. **Trace `NONE` 동일(L-2) — 비차단 후속.** QA 가 경합 시험에서 "지문 불일치로 버려졌다"를 Trace 로는 확인할 수 없고 응답에서 timing 없음 + 오디오 정상으로만 확인한다. 후속으로 `readCachedAudio` 가 이유(예: `AUDIO_MISMATCH`)를 돌려주고 `attachTiming` 의 `missing` 에 쓰면 된다(Leader 판단).

### 5. 회귀·위생·재실행 숫자
- `git show HEAD --stat`: 5파일(제품 3 + 시험 2), 전부 소유 범위(speech/tts·speech/__tests__). 이후 커밋(9e9eccc·b8164de)은 `src/modules/speech`·`src/app/api/v1/speech` 를 건드리지 않음(`git diff c8acab8 HEAD --stat` 빈 결과). 작업본에 speech 미커밋 변경 0.
- 보이지 않는 문자 grep(변경 5파일) **0건** · 엔진명·모델·화자 파라미터명 grep(cache·audioUrl·두 시험) **0건**(`synthesize.ts` 는 이 커밋의 추가 줄에 0건) · Secret 0(시험의 `JWT_SECRET` 은 기존 더미). 6층 import 변경 없음(`cache.ts` 가 같은 모듈 `./wav` 만 추가).
- 재실행(미러 `~/.node-local/thekaiwa-012b3` 를 NFS 에서 전체 동기화 + `prisma generate` 후, `DATABASE_URL=invalid`):
  | 명령 | 결과 |
  |---|---|
  | task012b4 시험 3파일 | **36/36** |
  | 3파일 + `speech/tts/__tests__/lexiconCompoundGuard.test.ts` | **51/51** |
  | `src/modules/speech` 전체 | 280 tests · 279 pass · **0 fail** · 1 skip |
  | `src/modules/engine` 전체 | **171/171** |
  | `src/modules` 전체 — 미러(NFS 작업본, 타 에이전트 010d 진행 파일 포함) | 1405 tests · 1398 pass · **6 fail** · 1 skip — 6건 전부 `conversation`(시나리오·역할극 진행 파일: task-037 repairRootClose, 대화 생성 FEATURE_NOT_READY, 역할극 3, G1 가드). speech·engine 실패 0 |
  | `src/modules` 전체 — **HEAD 만**(`git archive HEAD` 사본) | 1376 tests · 1375 pass · **0 fail** · 1 skip |
  | `tsc --noEmit` — HEAD 사본 | `src/` 오류 **0**. 전체 exit 2 = `tests/` 23건: 22건은 `playwright-core` 를 `~/node_modules` 에서 찾는 위치 차이(내 scratchpad 사본에서만 발생, 미러에서는 해소) + 1건은 `tests/prompts/scenario-seed-check.ts` 가 **미추적** `src/modules/conversation/prompts/talkScenario.ts` 를 import(HEAD 자체가 010d 진행 파일 없이는 안 맞음 — 010d 소유) |
  | `tsc --noEmit` — 미러(NFS 작업본) | exit 2, 오류 1건 `conversation/__tests__/task010d.test.ts(64)`(타 에이전트 진행 파일, speech 0). 이 파일을 격리하지는 않았다(미러는 읽기 전용 용도로만 사용) |
  | eslint(변경 5파일, HEAD 사본) | exit 0 |
  - dev 의 "modules 1404/1403" 숫자는 그때의 NFS 작업본 시험 모집단 기준이라 재현되지 않는다(내 모집단 1405·HEAD 1376). 판정에 쓴 근거는 speech·engine 전체와 변경 시험 파일이다.

### QA `high_risk_areas` (갱신)
- ⒜ **공유 `TtsCache` 에서 같은 문장 동시 합성 시험**은 운영 캐시 행·파일을 오염시킨다(환경 칸 없음·`DATA_ROOT` 공유). **그 시험 전용의 유일한 문장**만 쓰고, 끝난 뒤 그 키의 `TtsCache` 행과 `DATA_ROOT/tts-cache/<키 앞 2자>/<키>.wav` 를 반드시 정리한다(운영 키는 건드리지 않는다).
- ⒝ 캐시 HIT 응답의 `X-Tts-Duration`·JSON `durationMs` 가 응답 wav 헤더 길이와 같은지(이제 파일 기준).
- ⒞ 지문 없는 옛 행 HIT: 정상 재생·`X-Tts-Timing` 없음·Trace `TTS_TIMING` `NONE`.
- ⒟ 교차 프로세스 경합 키: HIT 에서 오디오 정상·timing 없음이 정상(틀린 강조 0). 경합 직후 **#24 는 첫 요청(recentAudio 경로)** 만 합격 기준으로 삼고, 60초 뒤 #24 재요청의 timing 은 알려진 한계(L-1)라 합격 기준에서 뺀다.
- ⒠ 어떤 응답·헤더·Trace 에도 `audioSha1` 이 없다.

### Leader 확인 필요
1. L-1 수용(권고) vs 지금 보강(세 호출처 변경, Developer → Reviewer 재순환).
2. L-3 정본 `domain-model.md` `TtsCache.timing` — 실제 저장 모양 + 선택 키 `audioSha1`(WAV sha1 hex, 읽을 때 파일 지문과 같아야 timing 사용) 한 줄.
3. L-2 `AUDIO_MISMATCH` 상태 후속 여부.
4. judge 규칙(C3 재발)에 따른 Codex 재호출 필요성 판정은 Leader 몫.
5. 010d 소유: HEAD(`93ef9b1`)의 `tests/prompts/scenario-seed-check.ts` 가 미추적 `talkScenario.ts` 에 의존 — 다음 010d 커밋에 같이 들어가는지 확인.
- 원자료: scratchpad `rev138/`(`mut.mjs`·`mut.log`·`mut2.log`·`mut3.log`·`mut/fuzz138.ts`·`mut/src/modules/speech/__tests__/rev138repro.test.ts`·`four.log`·`speech.log`·`engine.log`·`modules.log`·`head-modules.log`·`head-tsc.log`·`head/`).

```json
{ "reviewId": "REV-138", "status": "PASS_WITH_NOTES", "issues": [
  { "issue": "#24 서명 토큰에 묶인 timing 에는 오디오 지문이 없다 — recentAudio(60s) 만료 뒤 캐시 파일이 다른 합성(같은 길이)으로 바뀌었으면 그 오디오에 서명 쪽 경계가 붙는다", "severity": "LOW", "component": "src/modules/speech/tts/audioUrl.ts:148-161", "risk": "교차 프로세스 동시 첫 합성 + 60초 뒤 #24 재요청에서만 단어 강조가 수백 ms 어긋남(데이터 노출·오디오 손상 없음)", "evidence": "rev138/mut/src/modules/speech/__tests__/rev138repro.test.ts 재현, chunkFetch.ts 404-only 재시도, tts/[token]/route.ts Cache-Control max-age, recentAudio.ts TTL 60s, TTS_AUDIO_URL_TTL_SEC=600", "recommendation": "수용. 세 호출처(turnSpeaker·#23·lessonAudio)를 건드릴 때 signTtsAudioToken 에 오디오 지문을 함께 묶어 파일 경로에서 비교. instances>1 도입 시 재검토" },
  { "issue": "지문 불일치로 버려진 timing 의 Trace 상태가 NONE — 옛 행과 구별 불가", "severity": "LOW", "component": "src/modules/speech/tts/cache.ts:105-121, synthesize.ts:316", "risk": "경합 발생을 운영 Trace 로 확인 불가", "evidence": "fromCache 가 missing:'NONE' 고정", "recommendation": "readCachedAudio 가 이유(AUDIO_MISMATCH)를 돌려주고 attachTiming missing 에 사용(선택)" },
  { "issue": "정본 domain-model.md TtsCache.timing 주석이 실제 저장 모양과 audioSha1 을 반영하지 않음", "severity": "LOW", "component": "docs/design/domain-model.md:1819-1821", "risk": "정본↔구현 불일치", "evidence": "grep audioSha1 docs → 0건", "recommendation": "Leader 가 한 줄 반영" } ],
  "summary": { "critical": 0, "high": 0, "medium": 0, "low": 3 },
  "high_risk_areas": ["공유 TtsCache 동시 합성 시험 뒤 해당 키 행·파일 정리", "캐시 HIT X-Tts-Duration ↔ wav 헤더 길이", "지문 없는 옛 행 HIT 재생(timing 없음)", "교차 프로세스 경합 키는 오디오 정상·timing 없음이 정상, #24 는 첫 요청만 기준", "응답·헤더·Trace 에 audioSha1 없음"], "native_change": false }
```

## QA 기록

## Codex 검토

### [2026-10-07 00:49] C2 adversarial-review focus=concurrency — done
- judge 판정: §95-99 / 호출 차수: 1/4
- 대상: repo=/home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa base=5c3a70(task_file) snapshot=8c5885f
- 지적 0건
- 검토하지 못한 범위: 운영 M4 및 실제 Style-Bert-VITS2 모델을 사용한 동시 요청·클라이언트 연결 중단·서비스 종료 실험 · 허용 파일 밖의 변경 사항
- 원본: /home/brownjeon/NFS/homes/brownjeon/project/.claude/state/codex-review/runs/20261006T154952Z-task-012b-4-C2/raw.txt

**요약**: 정적 추적상 프로세스 전역 `clean_text` 래퍼 + 스레드 로컬 캡처가 동시 요청에서 정규화 결과를 섞지 않는다. `infer` 와 `take_alignment` 가 단일 워커 직렬화(`max_workers=1` + `asyncio.Lock`) 안에서 연속 실행되므로 asyncio 취소로 락이 풀려도 다른 추론이 끼어들 수 없고, 스레드 로컬 슬롯은 요청별 초기화·사용·삭제로 보호된다. 모델 로드·래퍼 설치·정렬 계산도 같은 워커에서 직렬화되어 모델 교체와 합성이 동시에 일어나지 않는다. 전역 설치 플래그는 동시 `__init__` 시 이중 래핑될 이론적 경합이 있으나, 중첩 래퍼 모두 원본을 한 번만 호출해 현재 코드에서 오디오·타이밍 정확성 실패로 이어지는 구체적 시나리오는 관찰되지 않았다(변이 테스트와 직접 실험으로 확인). Reviewer 는 스레드 로컬 격리를 고정하는 추가 시험(M-1, 변이 m7 검출용)을 권고했고, 이는 배포 전 보강 대상이다 — 단일 워커 구조가 유지되는 한 현재 결과 및 3중 대조(토큰 id·정규화 텍스트·프레임 합)가 다층 방어로 작동한다.

## 배포 기록

## 최종 요약

## Leader 결정 (스파이크 결과, 2026-10-06 22:30)

- **스파이크(dev-012b4-spike)**: M4 SSH 접근 성공(운영 `:8200` 정상·운영 venv 무변경). **A(narabas) 비권고** — PyPI 에 없고(GitHub·experimental·2023 이후 미갱신), `torchaudio<0.14` 가 운영 핀과 충돌(`--no-deps` 만 가능), 자체 정렬 46/51 실패(첫 음소 누락)·`torchaudio.load` 불가, 추가 +2.9GB 메모리. **B(SBV2 합성 때 VITS 가 정한 길이/정렬 행렬 `attn` 추출)** 가 합성 안에서 0.05~0.3ms·프레임수×hop=샘플수 28/28 일치 → **동기 산출이라 TTFA 영향 0**, 새 의존성·모델·메모리 0.
- **결정: B 채택, A 는 운영에 넣지 않음.** 따라서 **M4 에 narabas·torch 추가 설치는 하지 않는다**(사용자 승인은 "설치·배포까지 포함"이었으나 B 에는 설치가 필요 없음 — 배포만 남음). 스파이크 venv `~/kaiwa-tts-spike`(2.8GB)는 쓸모가 없어졌으니 **사용자 정리 대상**(최종 보고에 명시).
- **계약 결정**: M4 요청 스키마가 모르는 키를 거부(`extra="forbid"`, `schemas.py:21`)하므로 새 앱이 `timing:true` 를 요청 본문에 실으면 구 M4 가 400 → **요청은 그대로 두고 M4 가 응답 헤더로 timing 을 싣는다**(구 앱은 모르는 헤더를 무시 → 배포 순서와 무관). 헤더 크기(문장당 수 KB 이하)·인코딩은 구현 때 상한을 정한다. SBV2 2.5.0 내부 구조 의존은 "프레임수×hop=샘플수" 검사 테스트로 막고 깨지면 `timing=null`.
- **좌표 매핑 위험**: SBV2 가 텍스트를 한 번 더 정규화(`。`→`.` 등)하므로 timing 좌표를 원문 `replyJa` 좌표로 되돌리는 2단 매핑이 필요 — 구현·테스트 범위에 넣는다.
- 순서: 앱 부분은 012b-3 로컬 커밋 뒤(파일 경계), M4 서비스 부분은 병렬 가능.

## Leader 결정 (designer 가이드의 결정 항목 확정, 2026-10-06 23:05)

designer 가이드의 결정 D-T1~D-T7 을 **모두 designer 권고대로 확정**한다.
- **D-T1·D-T4** timing 은 **#24·#23 wav 응답 헤더 `X-Tts-Timing`**(M4 → 앱 → 화면 같은 방식), 실시간 턴 재생(MISS 첫 재생)도 강조 대상 — `TalkRoom.tsx`·SSE·#32 계약 무변경. 헤더 크기 상한·`text` 생략 여부는 developer 가 실측으로 정하고 상한 초과 시 `timing=null`.
- **D-T2** #62c `clips[].charStart`(clip 이 줄 `ja` 에서 시작하는 코드포인트) **추가**.
- **D-T3** 좌표 = **조각(문장) 글 기준·코드포인트**. 정본 정정(16 §8.1 "replyJa 좌표" 문구·`source`/`method` 이름 통일·§8.2 "첫 청취는 강조 없이" 삭제)은 Leader 가 웨이브 끝 정본 반영 때 한다. (스파이크가 말한 SBV2 텍스트 정규화(`。`→`.`) 좌표 되돌리기 매핑은 developer 구현 범위.)
- **D-T5** "섀도잉 강조" = 수업 ① **다음 줄 예고**로 해석해 진행(진짜 섀도잉은 Phase 3) — 최종 보고에 명시.
- **D-T6** `common/api.ts` 추가 export 허용(한 줄, 공용 파일이라 다른 WP 와 충돌 확인).
- **D-T7** 완료 기준 3 정정: "MISS 첫 재생부터 timing 있음, 012b-4 이전 캐시 행만 없음".
- 순서 재확인: 앱 서버 부분은 task-012b-3 로컬 커밋 뒤, M4 서비스 부분은 병렬 가능.

## Leader 기록 (2026-10-07, REV-130 이후 — M4 서비스 부분)

- **REV-130**: PASS_WITH_NOTES (Critical0·High0·Medium1·Low4·Info5). 래퍼 동시성 — 다른 요청의 값이 응답에 실리는 경로 없음(스레드 로컬 + `max_workers=1` + asyncio.Lock + 3중 대조, 어긋나면 null). Medium = 스레드 로컬 격리를 고정하는 시험 부재(전역 슬롯 변이를 기존 129개가 통과).
- **결정**: Medium·Low 1(원문 길이 가드)·Low 2(`_capture_alignment` 보호)·Low 4(README 비용 서술) **전부 적용**, Low 3 수용. dev-012b4m4c 소환(M4 서비스 파일만, 운영 M4 불가침·스파이크 venv 만).
- **다음 순서**: dev-012b4m4c → rev-012b4m4 좁은 재검토 → judge C2(R2 → Codex 필수) → Codex → reviewer 판정 → QA(M4 스모크는 배포 단계에서 `timing=ok`·`/health/detail` 0.4.0).
- **배포 ref**: 13+개 파일이 미커밋 — 최종 통합 단계에서 `speech/tts-service/**` 만 pathspec 으로 **별도 커밋**(다른 task 의 `src/**` 와 섞지 않음)해 `deploy-from-ubuntu.sh <SHA>` 의 ref 로 쓴다.
- **앱 단계(012b-4 앱 쪽) 인계**: 앱→브라우저 헤더는 nginx 4KB 헤더 버퍼를 지나므로 M4 `X-Tts-Timing` 을 그대로 중계하지 않고 앱 형식 ≤3KB 로 다시 만든다. 정본 `16-tts-productization-layer.md` §8.1·§8.2 의 narabas·`replyJa` 좌표 기술은 Leader 문서 동기화 때 정정(좌표 = 청크 텍스트 코드포인트, 옵션 B 어텐션 추출).

## Leader 기록 (2026-10-07, M4 서비스 부분 종결)

- **REV-131 PASS**(Critical0·High0·Medium0·Low0·Info4) — REV-130 의 M-1·L-1·L-2·L-4 해소, L-3 수용. Codex C2(1/4) 지적 0건 → Codex 이론적 메모(전역 설치 플래그 이중 래핑)는 reviewer 가 **오탐**(설치 경로가 단일 워커뿐이고 이중 설치돼도 무해, 사본 실험)으로 판정. Codex 한계: reasoning effort low, 운영 M4·실제 SBV2 동시 실험 미수행.
- **로컬 커밋**: `78bde96`(`speech/tts-service/**` 13개, pathspec) — M4 배포 ref. **푸시·M4 배포는 최종 통합 단계**(`speech/tts-service/scripts/deploy-from-ubuntu.sh 78bde96`, 사용자 승인 "M4 설치·배포 포함·전부 끝난 뒤 한 번에" 범위).
- **QA(배포 단계)**: `timing=ok` 스모크, `/health`·`/health/detail` 0.4.0·warmedUp·모델 3종, 모델 로드 로그 `alignment capture skipped` 0줄, 앱 요청 `X-Kaiwa-Timing: too_long` 0건, 메모리 전후 비교. 실패 시 스크립트가 `36f3795` 로 자동 롤백.
- **이 task 의 남은 일**: 앱 쪽(어댑터 헤더 읽기·`speech/tts/timing.ts`·`TtsCache.timing`·#23/#24 헤더·Trace `TTS_TIMING`·#62c `clips[].charStart`)은 012b-3·task-039 로컬 커밋 뒤.

### [2026-10-07 02:07] C2 adversarial-review focus=data_integrity — done
- judge 판정: §95-99 / 호출 차수: 2/4
- 대상: repo=/home/brownjeon/NFS/homes/brownjeon/project/TheKaiwa base=5c3a701(task_file) snapshot=b7fdb45
- 지적 1건: [high] src/modules/speech/tts/cache.ts:130 — 둘 이상의 pm2 프로세스·blue/green 인스턴스가 동일 캐시 키로 동시 합성할 때 WAV 파일 쓰기와 DB timing·timingVersion 갱신이 원자적으로 결속되지 않음 → 실제 재생 오디오와 다른 타이밍이 캐시·#24에서 반환될 수 있음 (권고: 프로세스 간 직렬화 또는 오디오 해시 검증·원자적 커밋·다중 writer 테스트)
- 검토하지 못한 범위: 운영 MariaDB의 `TtsCache.timing`·`timingVersion` 컬럼 실존·실제 트랜잭션 동작 / 실제 M4 0.4.0 서비스 왕복 및 nginx 응답 헤더 4KB 한계 / 허용 파일 밖의 대규모 동시 커밋 변경
- 원본: /home/brownjeon/NFS/homes/brownjeon/project/.claude/state/codex-review/runs/20261006T170051Z-task-012b-4-C2/raw.txt

**요약**: 코드포인트·UTF-16 변환은 서로게이트 경계·범위·역행·겹침·매핑 실패를 전체 null로 처리하며, #24 timing 맵도 검증된 사용자 결속 토큰만 조회하고 충돌·만료·퇴거는 timing 누락으로 안전하게 실패한다. 그러나 캐시 저장에서 공유 WAV 파일과 DB timing 메타데이터가 원자적으로 결속되지 않아 **다중 프로세스 동시 합성 시 서로 다른 결과가 조합될 수 있으며, duration-only 검사는 같은 길이의 다른 합성을 식별하지 못한다**. 캐시 HIT 및 #24 응답에서 실제 재생되는 오디오와 다른 단어 timing 이 반환되어 잘못된 단어가 강조될 수 있음. 최소한 DB에 오디오 해시를 저장해 읽을 때 실제 파일 해시와 일치할 때만 duration과 timing 을 반환해야 함.

## Leader 기록 (2026-10-07, 앱 쪽 종결)

- **리뷰 이력**: REV-133(PASS_WITH_NOTES) → 배선 시험 보강(dev-012b4app3, 변이 20/20) → Codex C2 2/4(지적 1건 high) → REV-136(부분 채택 Medium: 확률적 합성이라 파일/행 경합 시 timing 어긋남) → 오디오 지문 `audioSha1` 보강(dev-012b4app4, 커밋 `c8acab8`) → REV-138(PASS_WITH_NOTES, Critical0·High0·Medium0·Low3·Info4).
- **결정**: ① **#24 토큰에 묶인 timing 무지문 — 수용(Low)**. 도달 조건이 겹침(두 프로세스 동시 첫 합성 + wav 길이 동일 + 60초 뒤 #24 재요청)이고 피해는 강조 어긋남뿐, 강조 화면은 이번 배치에 없음. 서명 시 지문을 묶는 보강은 `turnSpeaker.ts`·#23·`lessonAudio.ts` 변경이 필요 — **`instances>1` 도입·QA 경합 시험에서 실제 관찰·강조 화면 착수 중 하나가 생기면** 그때 한다. ② `AUDIO_MISMATCH` Trace 상태 추가는 선택 후속(경합과 옛 행을 Trace 로 구분). ③ Codex 재호출 불필요(C3 는 결함 재발 규칙). ④ 정본 반영: `domain-model.md` 1819~1821행 `TtsCache.timing` 주석이 실제 저장 모양과 이미 달랐고 `audioSha1` 도 없음 — 웨이브 끝 문서 동기화 때 한 번에 정정.
- **배포 순서(재확인)**: M4(`78bde96`) 먼저 → 웹 나중. M4 가 0.4.0 이 되기 전에 앱만 나가면 timing 은 전부 null·오디오 정상. 기존 NULL 캐시 행은 방치(재합성 안 함).
- **QA 주의**: 공유 `TtsCache` 에서 같은 문장 동시 합성 시험은 운영 캐시 행을 오염시킬 수 있다 — 시험 전용 문장만 쓰고 시험 뒤 그 키의 행과 `DATA_ROOT/tts-cache/<앞2자>/<키>.wav` 를 정리. 배포 단계 확인: M4 `timing=ok`·`/health/detail` 0.4.0·앱 `X-Tts-Timing` 헤더 길이(≤3KB, nginx 4KB)·`TtsCache.timing` 실제 컬럼 존재(REV-133 `[추측]`).
- **커밋 현황**: M4 `78bde96` · 앱 `d8598fd` · 지문 `c8acab8`. 이 task 의 남은 일 = QA 라이브 일부(LLM 0 이지만 M4 0.4.0 이 필요해 **배포 후** 실측: 헤더·좌표·캐시 왕복).

## 상태 정리 — 열어 둔 이유 (2026-10-10)

- 상태 `todo` 유지(2026-10-10 상태 정리에서 의도적으로 닫지 않음).
- 이유: 서버·M4 부분은 완료·배포됨(M4 0.4.0 `78bde96`, 앱 `d8598fd`·`c8acab8`, 운영 합성 200 + `X-Tts-Timing` 263자 확인). 그러나 **완료 기준 4 「재생 단어 강조 화면·섀도잉 강조」는 구현되지 않았다** — `src/components` 에 단어 강조(카라오케) 화면이 없고 timing 을 읽는 화면 코드도 없다(`talk/timings.ts` 는 턴 지연 측정 코드, `TalkRoom` 의 highlight 는 교정 카드 강조 — 2026-10-10 Leader 가 코드로 대조). designer 가이드는 있으나 구현 task·IMP 가 없다. 완료 기준 3(MISS 후 HIT timing 실측)·5(TTFA 30턴·M4 메모리)도 QA 기록이 비어 있다.
- 결정 필요(사용자): 강조 화면을 후속 task 로 분리해 이 task 를 `done-with-note` 로 닫을지, 기준 4 를 명시적으로 철회할지. `ACTIVE.md` 의 「012b-4 단어 강조(timing)」 표현은 서버 부분만 나갔다는 뜻으로 읽어야 한다.
