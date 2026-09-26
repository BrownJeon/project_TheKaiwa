---
task_id: task-003c
title: "TTS 상용 벤치마크 보완 설계(5차 기획안 §129~§163) — TTS Productization 층·발음 사전·Rendering Plan·Speech Profile·스트리밍·상태 표시등"
status: done
roles_involved: [leader]
related_tasks: [task-001-initial-planning, task-003b-tutor-persona-v1, task-002-phase0-scaffolding, task-003-speech-p0]
tags:
  - type/task
  - domain/speech
  - domain/tts
  - domain/admin
aliases:
  - TTS보완
  - TTS플랫폼층
created: 2026-09-26
updated: 2026-09-26
---

## 목표 (Leader 작성)
사용자가 제시한 5차 기획안(상용 TTS(SELVAS) 벤치마크 기반 보완, §129~§163)을 읽고 **기획서·정본·설계 문서를 보완**한다. 구현·실물 스키마·API 구현·배포 없음. 원문은 `docs/tts-보완-기획안-원본.md` 로 보존(수정 금지). 기존 확정 결정(SBV2·M4·Voice Registry·Resolver 우선순위·AGPL 격리·6층)은 유지하고, 바뀌는 항목은 이유와 함께 기록하며, 새 결정이 필요한 것은 "사용자 결정 필요"로 분리한다.

## 관련 과거 이력 요약
- [[task-001-initial-planning]] §9·§9-B: TTS = Style-Bert-VITS2 on M4, `TtsMode{NATIVE,LEARNING}`, 캐시 키 9요소, Parameter Resolver 출력 = SBV2 파라미터.
- [[speech-architecture-decisions]]: SBV2 AGPL 격리·CPU 실측 필요·100자 분할.
- [[task-003b-tutor-persona-v1]]: 강사가 `speech.style` 만 낸다는 원칙(§68·§69) — 이번에 Rendering Plan 의 `styleHint` 입력으로 그대로 연결.

## Leader 지시사항 / 수행 기록
1. **원문 보존** `docs/tts-보완-기획안-원본.md`(1,234줄, §129~§163).
2. **실측**: `litagin02/Style-Bert-VITS2` `server_fastapi.py` 조회 → 라우트는 `/voice`(text·model_id/name·speaker_id/name·sdp_ratio·noise·noisew·length·language·auto_split·split_interval·assist_text·style·style_weight·reference_audio_path)·`/g2p`·`/models/info`·`/models/refresh`·`/status`·`/tools/get_audio` 뿐. **사용자 사전 라우트·타이밍 출력·스트리밍·`pitch_scale/intonation_scale` 없음** → M4 tts-service 는 `style_bert_vits2` 라이브러리 위의 자체 FastAPI 래퍼여야 한다(정본·CLAUDE.md 에 반영).
3. **새 설계 문서** `docs/design/speech-platform/16-tts-productization-layer.md`(서브에이전트 `doc-tts-layer` 작성 452줄·§0~§17, Leader 검수 후 정본과 상호 정합) — 층 배치·§133 파이프라인·발음 사전(범위 규칙 L-1~L-6·버전·A/B 적용)·Normalizer·Rendering Plan+SBV2 매핑표·Speech Profile 5종·청크 스케줄러/Playback Queue/TTFA 예산·Trace 하위 단계·Timing(A narabas 권고)·Golden/회귀/A/B·Voice Version 전이·Canary·캐시 키 12요소·상태 표시등 5상태·온디바이스 research 기준·정본 변경표·Phase·미결 15건. 검수에서 맞춘 것: `speechProfile` 기본값 NATIVE(기존 `learningSpeed` 유지와 정합), 사전 엔티티 `environment`·unique·VarChar, 상태 API 값(`serverHealth HEALTHY…`, `fallbackReason 4종`), Trace step 이름(`TTS_SYNTH[i]` 등), tts-service 계약(`/synthesize` 헤더·`/g2p`·`/admin/lexicon/apply`), `POST /api/v1/speech/tts/chunks`, `#32 clientTimings`, `#19 tts.speechProfiles`.
4. **정본 갱신**
   - `domain-model.md` §3: `enum TtsMode` → `enum SpeechProfile{NATIVE, LEARNING_NORMAL, LEARNING_SLOW, PRONUNCIATION, SHADOWING}` + `UserVoiceSetting.speechProfile @default(LEARNING_NORMAL)` / `TtsCache` 에 `normalizedText·modelVersion·dictionaryVersion·speechProfile·timing Json?` / P0 신규 `LexiconScope`·`PronunciationLexiconEntry`·`PronunciationLexiconVersion`(48→50 모델) / §4·§5·§6 행, §8 미결 17~19 / **§10 제안(P1)**: `VoiceDeployStatus`·`VoiceModelVersion`·`TtsGoldenSentence`·`TtsQualityRun`·`TtsQualityResult`·`TtsAbCompare`·`EngineMetricsDaily` 확장 컬럼. `prisma/schema.prisma` 재추출(50 모델).
   - `api-contract.md`: 총람 #23 갱신, #23 상세 교체(정규화→사전→Rendering Plan→Resolver→어댑터, 캐시 키 12요소, `timing`, `runtime.executionMode`, `422 TTS_UNAVAILABLE`, Trace 하위 단계), **§7** — `GET /api/v1/speech/tts/status`(상태 표시등), SSE `audio{chunkIndex}` 변경, admin `lexicon*`·`voices/:id/versions*`·`tts/golden*`·`tts/quality-runs*`·`tts/ab-compare*`·`tts/metrics`, tts-service 내부 계약(`/synthesize` RenderingPlan·`/voices`·`/admin/lexicon/apply`·`/health`·`/metrics`), 미결 13~15.
   - `module-dependency.md` §11: 컴포넌트 14종 → `speech/tts/{normalizer, lexicon, renderingPlan, profiles, chunkScheduler, cache, status, metrics, timing, quality}`·`speech/voices/versions`·`engine/adapters/tts/styleBertHttp` 매핑표·클라 `TtsPlaybackQueue`/`TtsRuntimeStatusIndicator`, import 행렬 불변, 금기(SBV2 파라미터명은 어댑터 전용).
   - `configuration-resolution.md`(USER_SETTING 키·Resolver 출력 = RenderingPlan), `speech-platform/03·04(캐시 키)·12(TTS Hybrid 폴백·상태)·13(§3.4 Speech Profile)`, `admin-console/01(IA: Pronunciation Dictionary P0·Voices › Versions·TTS Quality·TTS 대시보드)·11·12(예시 JSON)`.
   - `design-spec.md`: 서문(기획서 5종)·정본 표·§0 행·§2·§9 TTS 모드·**§9-D 신설**·§11(상태 표시등·접근성)·§15(003·005·005b·007·012b·012c·016)·§16(결정 필요·리스크 5건).
   - `CLAUDE.md` 스택 표 TTS 행.
5. **유지 항목(§159)** 확인: Voice Registry·Profile·미리듣기·Resolver 우선순위·M4·AGPL·TtsCache·Router/Fallback·Console — 변경 없음. 바뀐 것 4건(TtsMode→SpeechProfile, Resolver 출력 = RenderingPlan, 캐시 키 확장, tts-service 자체 래퍼)은 §9-D 에 이유 기록.

## Reviewer / QA 기록
- (설계 문서 단계라 생략. task-003·007 구현 시 reviewer 는 "라우트·LLM·클라에 SBV2 파라미터명 없음", "원문은 Trace 에 없고 normalizedText 해시만", "사전 변경에 ConfigurationVersion/AuditLog" 를 체크리스트에 추가.)

## 사용자 결정 필요
1. 발음 사전 적용 방식 — 플랫폼 치환(기본) vs SBV2 `text/user_dict`(LGPL) push 병행.
2. Timing Metadata 산출 — A) narabas 강제정렬(권고) vs B) VITS duration 추출.
3. TTS P1(Observability·Timing·Golden·회귀·A/B·Voice Versions·Canary) 를 Phase 2(task-012b/012c) 에 넣을지 Phase 4 로 미룰지.
4. TEXT_ONLY 상태 UX(자막 자동 표시 + "다시 시도").
5. 온디바이스 TTS research 착수 조건(서버 TTS p95 실측 후).

## 최종 요약 (Leader, 사용자용)
5차 TTS 보완 기획안을 "엔진 교체"가 아니라 **엔진 위의 플랫폼 층**으로 흡수했다. P0(발음 사전+버전, 정규화, 엔진 독립 Rendering Plan, Speech Profile 5종, 청크 스트리밍, 캐시 키 확장, 강사 프로필 옆 실행 상태 표시등)는 정본 본문과 Phase 1 task 에 넣었고, P1(관측·타이밍·품질 평가·모델 버전/Canary)은 정본 §10 제안 + Phase 2 후보로, P2(온디바이스 TTS)는 research 로 두었다. SBV2 원 서버를 실측해 사전·타이밍·스트리밍·pitch 라우트가 없음을 확인했으므로 M4 tts-service 는 자체 FastAPI 래퍼로 설계를 바꿨다. 코드·실물 스키마 변경 없음(`prisma/schema.prisma` 는 정본 재추출만).
