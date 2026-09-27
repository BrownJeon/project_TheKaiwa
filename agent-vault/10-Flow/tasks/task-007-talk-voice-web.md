---
task_id: task-007
title: "AI 회화(음성) — 웹 경로: 푸시투토크 → 턴 → 청크 스트리밍 TTS · 5초 예산"
status: in-progress
base_ref: 05f0cbb
risk_level: R2
roles_involved: [leader, judge, designer, prompt-engineer, developer, reviewer, qa, codex]
related_tasks: [task-003d-tts-p0, task-003e-stt-gateway-web, task-004-ai-client-persona, task-006-chat-correction]
tags:
  - type/task
  - domain/speech
  - domain/tutor
  - domain/talk
aliases:
  - 음성 회화
  - task-007
created: 2026-09-28
updated: 2026-09-28
---

## 목표 (Leader)
design-spec §15 task-007 — **말로 대화하는 AI 회화방**. 푸시투토크로 말하면(웹 = gateway STT) 선생님이 일본어로 답하고 **문장 단위로 바로 소리 내어** 읽어 주며, 틀린 표현은 그 자리에서 교정 카드로 보여 준다.
완료 기준(§15): `RealtimeSttClient` 라우팅 · 청크 스트리밍 TTS(SSE `audio{chunkIndex}`·`TtsPlaybackQueue`·TTFA 계측) · Rendering Plan(LLM 은 `speech.style` 만) · 프로필 옆 실행 상태 표시등 · 5구간 계측 · 원문 무수정 · 권한 거부 안내 · **웹 gateway 동작**. 실기기 30턴 p50 ≤5s·TTFA p50 ≤1.0s 는 **웹 경로 합성 E2E 로 먼저 재고, 폰 실측은 003f(Capacitor) 뒤 사용자와 함께**.

정본: `docs/design/api-contract.md` #18·#21·#22·#23·#24·#27~#32(특히 #32 SSE 표·`done`·저장 순서·시간 예산·계측)·§7-1(5차 변경표 — `audio{chunkIndex,…}`·#24 `Accept: application/json`)·`/ws/speech` · `docs/design/speech-platform/16-tts-productization-layer.md` §6(Chunk Scheduler·6.3 TtsPlaybackQueue·6.4 TTFA)·§7 · `docs/design/domain-model.md`(ChatMessage·Utterance·TtsCache·RequestTrace) · `docs/design/module-dependency.md`(L2↔L4 는 라우트가 조합) · design-spec §8(A1·5초 예산)·§9 · `docs/screens.md` §2(회화 행)·§3(채팅 — 재사용)·§7(표시등)·§8(푸시투토크).

## 관련 과거 이력 요약
- [[task-006-chat-correction]]: 턴 SSE(#32)·사용자당 락·resumePending·교정 원문 바이트 검사·제안 카드·채팅 화면. 오케스트레이터는 TALK 도 텍스트 턴으로 이미 처리(`buildTalkRequest`)하지만 `audio` 이벤트·`utteranceId`(현재 `400 FEATURE_NOT_READY`)·회화 화면(`TalkComingSoon`)은 이 task. CHAT 턴 p50 5.3s 중 ~1.2s 가 서버측(NAS DB 왕복: 수락 tx·학습자 헤더·이력·저장 tx).
- [[task-004-ai-client-persona]] + [[llm-japanese-quality]]: A1 p50 5.1s(목표 ≤4s 미달) — spawn ~1.9s + 생성 ~3s. 후보 ① 상주/예열 CLI ② 후리가나 코드 생성 ③ 첫 문장 조기 TTS(`--include-partial-messages`).
- [[task-003d-tts-p0]]: `speech/tts`(정규화·사전·Rendering Plan·SpeechProfile·캐시 키·single-flight·상태 표시등 스토어), `POST /speech/tts`(단일 청크 wav, 분당 60). **S3 이월: #24 캐시 오디오 GET 은 사용자·대상에 묶인 짧은 만료 HMAC 서명 URL 필수.** U5: 사용자 응답에 `connectionKey` 금지(SSE `audio.runtime` 도 같은 규칙). MISS p50 716ms·HIT 24ms.
- [[task-003e-stt-gateway-web]]: gateway(127.0.0.1:8100, nginx wss)·티켓(`purpose:TURN`, `chatId`)·TURN 발화는 wav 30일 + `Utterance` 행(internal 콜백)·`final.utteranceId`. 클라 `@/modules/speech/stt/client`(WebSocketSttClient)·`PushToTalkButton`(72px)·`useRealtimeStt`·`sttCopy`. stop→final p50 63ms. #22(발화 조회·오디오) 미구현.

## Leader 실측 (2026-09-28 02:30, 계획 근거)
우분투·CLI 2.1.222·haiku·thinking 끔, 짧은 시스템 프롬프트 + 2필드 JSON, 3회씩:

| 방식 | 첫 텍스트 delta(보낸 뒤) | 결과까지(보낸 뒤) |
|---|---|---|
| cold spawn(현행, stdin 텍스트) | 1.35~1.56s | 3.32~3.56s |
| **예열 spawn**(`--input-format stream-json` 으로 미리 띄워 두고 6초 뒤 user 메시지 1줄) | **0.60~0.71s** | **2.37~2.71s** |

→ 예열만으로 ~0.9s 절감. `replyJa` 가 JSON 첫 필드면 첫 문장(。？！)이 첫 delta 직후 수백 ms 안에 완성된다 → **첫 문장 조기 TTS** 가 TTFA 의 핵심 레버(나머지 필드 생성 ~2s 를 기다리지 않음). 예열 프로세스의 `system/init` 이벤트는 첫 메시지를 받은 뒤에 나온다(대기 중 API 호출 없음 — 비용 0 추정, developer 가 재확인).

## Leader's Plan (2026-09-28)

### 범위 결정
- **K1 경로**: 웹(gateway STT) 회화방 E2E 를 이 task 에서 끝낸다. 온디바이스 STT·Capacitor·APK·폰 실측은 003f. `RealtimeSttClient` 라우팅은 인터페이스·선택 로직(`modeResolver` 결과 → 웹은 항상 WebSocket)까지, `OnDeviceSherpaClient` 는 003f.
- **K2 LLM 지연(서버, developer A)** — 순서대로 적용·실측, 각 단계 p50 을 기록:
  1. **예열 CLI 프로세스**(engine `adapters/llm/claudeCli` 안): `(model, systemPrompt 해시, 플래그)` 키마다 **대기 프로세스 최대 1개**. 턴이 하나를 가져가면 즉시 다음 것을 띄운다. 유휴 TTL(기본 10분, 설정값)·전체 상한(기본 2)·프로세스당 1요청(무상태 — 대화 문맥은 지금처럼 프롬프트 창으로, CLI 세션 누적 금지)·실패/죽은 대기 프로세스는 버리고 cold 로 폴백. 예열 시점: TALK 방 진입(`GET /chats/:id` kind=TALK 또는 #19 config 조회) 또는 첫 턴 직후 — 명시적 warm 라우트를 새로 만들지 않는다(A 가 트리거 위치를 정하고 기록). 서버 기동·종료 시 정리(좀비 0), pm2 재시작 시 고아 프로세스 0.
  2. **첫 문장 조기 추출**: `--output-format stream-json --include-partial-messages` 의 텍스트 delta 를 누적하며 `conversation.replyJa` 문자열 값에서 완성 문장(。？！?! 경계, 최소 2자)을 **증분 추출** → 오케스트레이터에 `onSentence(idx, text)` 콜백. 최종 JSON 검증(ajv·원문 바이트·문장 수)은 지금과 같다. **재시도가 일어나 최종 `replyJa` 가 이미 낸 문장들로 시작하지 않으면** 이후 청크를 멈추고 `status{stage:"TTS", warning:"AUDIO_TEXT_MISMATCH"}` + Trace 기록(클라는 남은 청크를 버리고 최종 텍스트만 표시). JSON 키 순서는 prompt-engineer 가 보장(아래 K4).
  3. **서버측 DB 왕복 줄이기**: 수락 tx·학습자 헤더·이력 조회·저장 tx 의 순차 왕복을 계측(`toolLog`)하고 병렬화·캐시(학습자 헤더 60초 메모리 캐시 등)로 ~1.2s → 목표 ≤0.5s. 저장 tx 는 TTS 와 **병렬**(TTFA 경로에서 뺀다).
  - 셋 다 적용해도 목표 미달이면 `replyReading`(후리가나) 코드 생성은 **별도 task 제안**으로 남긴다(이번 범위 밖).
- **K3 턴 TTS 파이프라인(서버, developer A)** — #32 라우트가 `conversation` 과 `speech` 를 조합한다(두 모듈 상호 import 금지). 방식: `startTurn` 에 **주입 콜백**(`speaker: (sentence, ctx) => Promise<AudioChunkResult>` 류, 타입은 conversation 이 정의·route 가 speech 로 구현해 넘김)을 받게 한다. 문장마다 `speech/tts` 로 합성(캐시·single-flight 재사용, 청크당 8s 예산, 동시 1~2 — 순서 보장은 `chunkIndex`), 완료 즉시 SSE `audio{chunkIndex,text,url,cacheKey,durationMs,last,ttfaMs(첫 청크만),runtime:{executionMode},status}` — **`connectionKey` 는 싣지 않는다(U5)**. `done` 은 저장 + 모든 청크 종료 뒤 1회, `audioCount` = 성공 청크 수. TTS 실패·불가(TEXT_ONLY)는 턴을 실패시키지 않는다(`audio` 없음/`FAILED` 청크, `done` 정상). TTS 파라미터는 Parameter Resolver(User > VoiceProfile > Persona > Context > LLM `speech.style`), SpeechProfile 은 사용자 설정(회화 기본 NATIVE). TALK 만 TTS, CHAT 은 지금처럼 텍스트.
- **K4 프롬프트(prompt-engineer)**: A1 출력 JSON 키 순서를 `speech` → `conversation{replyJa, replyReading, replyKo}` → `correction` → `learning` → `endOfTopic` → `proposals` 로(스타일을 첫 문장 합성 전에 알게), `replyJa` 는 짧은 문장 2개(첫 문장은 짧은 반응 — TTFA 에 유리) 원칙 강화. 예열 프로세스용으로 **시스템 프롬프트(페르소나+모드 규칙)는 턴마다 고정**, 가변부(학습자 헤더·창·발화)는 user 메시지로 — 지금 구조가 이미 그렇다면 확인만. 회귀 픽스처 20문장 재실측(검출·오탐·JSON 실패·키 순서 준수율).
- **K5 #24 서명 URL(developer A, S3)**: `audio.url` = `/api/v1/speech/tts/<token>` — token 은 opaque(`base64url(payload).HMAC`, payload = `{u:userId, k:cacheKey, m:assistantMessageId, exp}`), 만료 기본 10분, 비밀키는 기존 `JWT_SECRET` 파생(HKDF 용도 분리) 또는 새 env — A 가 정하고 기록. 검증: 세션 사용자 = `u`, 미만료, 서명 일치 → `TtsCache` 조회 → `audio/wav`(`Cache-Control: private, max-age=<남은 만료>`); 실패는 모두 같은 `404`(존재 오라클 금지). `/status` 정적 세그먼트와 충돌 없게. 지난 메시지 다시 듣기는 **#23 `POST /speech/tts` 로 문장별 요청**(캐시 HIT)으로 하고 #29 `audio[]` 는 이번에 채우지 않는다(계약에 "task-007 후속" 주석).
- **K6 발화 연결(developer A)**: 턴 `utteranceId` 열기 — 라우트가 `speech.utterances` 로 소유자 검사(타인·없음 404)·`text≠finalText` 면 `finalText=text, finalSource=USER` 갱신 → 수락 뒤 `Utterance.chatMessageId = userMessageId` 연결(speech 테이블은 speech 가 쓴다). `inputSource=REALTIME_STT` 인데 `utteranceId` 없으면 `400`. 티켓 `chatId` 와 발화의 chat 이 다르면 `400`(발화 행에 chatId 가 없다면 A 가 판단해 기록). #22 발화 조회/오디오는 **최소판**(#21b `GET /speech/utterances/:id/audio` 소유자 wav)만 — 회화방에서 "내 발음 다시 듣기"에 쓴다.
- **K7 계측(5구간)**: Trace `TURN` step = `STT`(클라 `clientTimings`: 손 뗌→final) · `ACCEPT` · `PROMPT` · `LLM`(meta: `firstSentenceMs`·`warm:true|false`) · `TTS[n]`(meta: `cache HIT|MISS`, 첫 청크 `ttfaServerMs`) · `PLAYBACK`(다음 턴 `clientTimings.playbackStartDelayMs`·`firstAudioAtMs` → 지연 기록). `toolLog` 에 `sttMs, llmMs, llmFirstSentenceMs, ttsStartMs, ttfaMs, totalMs, warm`. 원문·응답 전문은 Trace 에 금지(기존 규칙).
- **K8 화면(designer → developer B)**: `/study/ai/talk/[chatId]` 회화방 + 목록(`/study/ai` 회화 탭 — 기본 탭을 `talk` 로, 새 회화 시트 = 채팅 시트 재사용). 헤더: 선생님 아바타·이름 + **TTS 상태 표시등**(§7 컴포넌트·스토어 재사용). 본문: 말풍선(사용자 발화 = STT 텍스트, 선생님 = 문장이 `audio` 로 올 때마다 점진 표시 → `done` 에 읽기·번역·학습 포인트), 교정 카드(채팅 `CorrectionCard` 재사용 — **대화 중 즉시 표시**가 채팅과 다른 점), 제안 카드. 하단: **푸시투토크 72px**(§8 재사용) + 텍스트 입력 전환(키보드 아이콘 — 말하기 어려울 때 `inputSource=TEXT`). 재생: `TtsPlaybackQueue`(`chunkIndex` 순, 다음 URL 프리페치, 사용자가 말하기 시작하면 즉시 멈춤 = barge-in, 재생 중 표시). 권한 거부·서버 불가·TTS 불가(텍스트만) 안내. 다시 듣기(선생님 말풍선 ▶·내 발화 ▶). 자동 전송: final 을 받으면 **바로 턴 전송**(5초 예산) — 인식 결과가 비었거나 1자 이하면 전송하지 않고 안내. 전송 전 편집은 텍스트 모드에서만.
- **K9 운영**: 새 env 가 생기면 `.env.example` + 운영 `.env` 반영, QA PASS 후 격리 빌드 → 미러 build → `pm2 restart thekaiwa`(사용자 자율 진행 지시 2026-09-28). 예열 프로세스는 pm2 `thekaiwa` 의 자식 — 메모리 한도 확인(예열 1개 ≈ node 100~200MB).

### 구현 전략 · 분배
| 역할 | 담당 | 순서 |
|---|---|---|
| designer | `docs/screens.md` §9 회화방(목록 탭 기본값·방 구조·턴 상태 머신(대기→녹음→인식→생각 중→말하는 중→대기)·재생 큐 UI·barge-in·교정 카드 즉시 표시·텍스트 입력 전환·오류 문구·3폭·접근성) | 1 |
| prompt-engineer | `conversation/prompts/talk.ts` 키 순서·첫 문장 짧게·예열용 고정 시스템 프롬프트 확인, 픽스처 재실측 | 1 |
| developer A (Opus, 서버) | K2(예열·조기 추출·DB 왕복) · K3(주입 콜백·턴 TTS·SSE audio) · K5(#24 서명 URL) · K6(utteranceId·#21b) · K7(계측) · api-contract 개정 · 단위 테스트 · 라이브 스모크 | 1(PE 결과 반영은 2) |
| developer B (Opus, 화면) | K8 전부 · `TtsPlaybackQueue`(클라, `@/modules/speech/tts/client` 또는 components — module-dependency 판독 규칙 따라 B 가 정하고 기록) · SSE `audio` 파싱(채팅 `sse.ts` 확장) · `clientTimings` 보고 · 화면 스모크 | 2(designer 후) |
| judge·codex | intake · C1(설계 — 예열 프로세스 수명·서명 URL·주입 콜백 경계) · C2(구현 — 보안: 서명 URL·utterance 소유·프로세스 누수) | |
| reviewer·qa | 6층 경계·엔진명·서명 URL·utterance IDOR·프로세스 누수·5초 계측·3폭 | |

파일 소유: A = `src/modules/{engine,conversation,speech/(서버)}`·`src/app/api/**`·`docs/design/api-contract.md`·`tests/live/task007-*`. B = `src/components/{talk,speech,chat(재사용 수정은 B)}`·`src/app/(app)/study/ai/**`·클라 재생 큐. PE = `src/modules/conversation/prompts/**`·`tests/prompts/**`·`.claude/agents/tutor.md`(필요 시). 겹치는 파일(`sse.ts` 등)은 B 소유, A 는 계약만 고정.

### 완료 기준 (qa)
1. tsc·lint·test 통과, 격리 build exit 0.
2. TALK 턴 SSE 순서 `accepted → status… → audio(chunkIndex 0..n, 순서 무관 도착 가능) → done{audioCount}`, CHAT 은 `audio` 없음. `audio`·`done` 에 엔진명·`connectionKey`·model 0.
3. TTS 불가(M4 중지 또는 connection UNAVAILABLE 모의)면 턴은 `done` 정상·`audioCount=0`·화면은 텍스트로 진행 + 표시등 TEXT_ONLY.
4. #24 서명 URL: 본인·미만료 200 `audio/wav` / 타인 세션·만료·변조·없는 키 → 전부 같은 `404` / 세션 없음 401.
5. `utteranceId`: 타인·없음 404, `REALTIME_STT` 인데 없음 400, `text≠finalText` → `finalSource=USER` 갱신, 수락 뒤 `Utterance.chatMessageId` 연결. #21b 소유자만 wav.
6. 교정: `correction.original` = 사용자 `text` 바이트 일치, 채택 전 `WordEntry`·`StudyLog` 행 0(006 회귀).
7. **지연(웹 합성 E2E, 우분투에서 gateway WS + M4 TTS 테스트 음성 30턴)**: 손 뗌(`stop`)→첫 `audio` 이벤트 수신 p50 **≤4.0s**(서버측 목표, 클라 재생 지연 제외), `ttfaServerMs` p50 기록(MISS ≤1.0s), LLM `firstSentenceMs` p50·warm 비율·턴 총 p50 기록. 폰 실측(p50 ≤5s)은 003f 후.
8. 예열 프로세스: 유휴 TTL 뒤 0개, 상한 초과 0, pm2 재시작·dev 서버 종료 후 고아 `claude` 프로세스 0, 예열 실패 시 cold 폴백으로 턴 성공.
9. 화면: 푸시투토크 → 인식 → 자동 전송 → 문장별 재생(순서 보장) → 교정 카드 즉시, barge-in(재생 중 누르면 즉시 멈춤), 텍스트 입력 전환, 권한 거부·서버 불가 문구, 다시 듣기 2종, 360/390/412 넘침 0·터치 ≥44px(푸시투토크 72px). Playwright fake audio 로 1회 이상 E2E.
10. 원문·전사·응답 전문이 로그·Trace 에 0.

### 네이티브 변경
없음(003f).

### 설계 확정 — designer §9-11 (Leader, 2026-09-28)
- **① barge-in 채택**: 재생 중 푸시투토크 = 재생 즉시 정지 → 녹음(K8). §8·designer 원칙의 "재생 중 비활성"은 "누르면 멈춘다는 표시"로 읽는다. 에코는 정지 후 녹음 + `getUserMedia` 기본 에코 제거.
- **② `final.utteranceId:null`** → `{text, inputSource:"TEXT"}` 로 보낸다(내 목소리 ▶ 없음). 계약 변경 없음.
- **③ SSE `audio` 에 `cached:boolean`·`pauseBeforeMs:number` 추가**(A). 엔진 정보가 아니므로 허용. 없으면 클라 기본 false·0.
- **④ TTS 를 시도하지 않은 TALK 턴**(TEXT_ONLY·connection 불가)은 `status{stage:"TTS", warning:"TTS_UNAVAILABLE"}` 를 `done` 전에 1회(A). 문장별 실패는 `audio{status:"FAILED"}`.
- **⑤ `clientTimings`** = `{prevMessageId, sttMs, releaseToFirstAudioEventMs, firstAudioAtMs, playbackStartDelayMs}` — 기준점은 **손 뗌(글자 턴은 보내기 누름)**, 모두 직전 턴 값(단 `sttMs` 는 이번 턴). 서버는 숫자 범위(0~120000) 검증 후 Trace `STT`·`PLAYBACK` step 에만 기록(A 가 계약 고정).
- **⑥ #29 확장(A)**: USER 메시지 `utteranceId` + `audioAvailable:boolean`(보존 기간 안·삭제 안 됨) — Utterance 는 speech 테이블이므로 **#29 라우트가 conversation 결과에 speech 조회를 조합**(conversation 이 Utterance 를 읽지 않는다). ASSISTANT `speechStyle`(toolLog meta.style — 다시 듣기 #23 캐시 HIT 용).
- **⑦ AUDIO_TEXT_MISMATCH**: 재생 중 청크도 즉시 끊고 드러낸 문장을 거둔 뒤 `done` 최종 텍스트만(들리는 것 = 보이는 것).
- **⑧ 같은 `utteranceId` 재전송 허용** — 수락 전 거절(409 턴 진행 중·429·네트워크)이라 아직 연결 안 된 발화만(C1-2: `chatMessageId IS NULL`·10분 이내). [글자로 고치기] = 같은 id + 고친 text + `REALTIME_STT` → `finalSource=USER`.
- **⑨ 표시등 폴링 pause 는 턴 진행 중에만**(방 체류 중엔 30초 폴링 유지).
- **⑩ 방 메뉴 "들려주는 방식"** = #13 GET → `speechProfile` 만 바꿔 #14 PUT(설정 화면과 같은 값). 채택.
- **⑪ #24 URL** 은 큐가 `/api/v1/speech/tts/` 접두만 수락, 다시 듣기는 보관본·#23 으로(만료 URL 재사용 금지), URL·토큰을 DOM 속성·로그에 남기지 않음. 채택.
- **⑫ 기존 결함 4건** B 가 이번 task 에서 수정(useRealtimeStt utteranceId·useChatTurn busy 무시→QUEUED·PendingCorrectionsCard TALK 포함·CorrectionCard 단건 카운터 숨김). 채택.

## 판단 기록 (judge)
- [2026-09-28 02:35] intake engine=jev → task_type=feature, risk=R1, developer_model=opus, next=assign | overrides=- | fallback=- | tokens=1127
  - **override**(Leader): risk **R2** 적용 — 신호도 high 0.51/normal 0.49 경계이고, 이번 범위에 서명 URL(인증 우회 시 타인 오디오 노출)·발화 소유 검사(IDOR)·자식 프로세스 수명(누수·고아) 이 들어 있어 보안·운영 위험을 R2 로 본다. developer_model=opus·next=assign 채택.


- [2026-09-28 04:09] C2 engine=jev → codex_required=true, mode=adversarial-review, focus=concurrency | overrides=- | fallback=- | tokens=994

## Codex 검토

### [2026-09-28 01:59] C1 adversarial-review focus=security — done
- judge 판정: [[task-007-talk-voice-web.md#판단-기록-judge]] §87~89 intake(R1→override R2) · §108 C1 gate codex_required / 호출 차수: 1/4 (R2)
- 대상: repo=TheKaiwa base=05f0cbb(HEAD_fallback 아님, 설계 문서 변경) snapshot=worktree-e87f3f
- 지적 **3건**:
  - [medium] **서명 URL 식별자 누출** (task-007-talk-voice-web.md:54) — K5 `/api/v1/speech/tts/<token>` 이 `base64url(payload).HMAC` 형식일 때 userId·messageId 원문 노출 (히스토리·로그·Referer) → 프라이버시/추적 위험. 권고: 진정한 opaque (랜덤 nonce 매핑 또는 JWE/AEAD), 최소한 URL 페이로드에 원문 금지.
  - [medium] **utteranceId 재사용/경합** (task-007-talk-voice-web.md:55) — K6 Utterance 모델에 chatId 없고 chatMessageId unique 아님 → 한 녹음을 여러 턴/채팅에 재사용 가능, 경합 시 마지막 update 우승 → 음성/채팅 증거 관계 깨짐, 다시 듣기/감사 기록 섞임. 권고: chatId 저장, 조건부 update WHERE id=? AND userId=? AND chatMessageId IS NULL AND chatId=?, chatMessageId @unique 제약.
  - [medium] **초기 partial LLM 음성 선노출** (task-007-talk-voice-web.md:49) — K2 step 2 `--include-partial-messages` delta에서 첫 문장 추출 → 최종 JSON 검증 전 TTS 합성/SSE 송신 → 검증 실패/보안 필터 실패 응답도 음성으로 선노출 (프롬프트 인젝션, 엔진명, 시스템 지시문 등). 권고: 초기 청크도 경로 확인 + 최소 보안 필터(길이, 제어문자, URL/secret/엔진명/지시문 패턴) 후 합성, 또는 검증 완료 후 조기 TTS 실행.
- 검토하지 못한 범위: 실제 HMAC 검증 방식(constant-time 비교)·라우트 응답 헤더·프로세스 정리 구현·테스트/빌드/E2E (설계 문서 변경만, 코드 diff 없음).
- 원본: `/home/brownjeon/NFS/homes/brownjeon/project/.claude/state/codex-review/runs/20260927T165640Z-task-007-C1/raw.txt`

### C1 지적 판정 (Leader, 2026-09-28 — 설계 단계라 Leader 가 판정, 구현 반영은 reviewer 가 확인)
- **C1-1 서명 URL 식별자 누출 → 채택(K5 수정)**: URL 에 `userId`·`messageId` 원문을 싣지 않는다. 토큰 = `base64url({k:cacheKey, e:exp})` + `.` + `HMAC-SHA256(키, "tts-audio|" + userId + "|" + k + "|" + e)` — **userId 는 MAC 입력에만** 들어가고 검증 시 세션 사용자로 재계산(타인 세션이면 MAC 불일치 → 404). cacheKey 는 내용 해시라 식별자가 아니다. 키는 `JWT_SECRET` 에서 HKDF(`info="thekaiwa/tts-audio-url/v1"`)로 파생(새 env 불필요), 비교는 `timingSafeEqual`. messageId 결속은 빼고 만료(10분)+사용자 결속으로 충분하다고 판단. AEAD·nonce 저장소는 과함(DB 쓰기 추가·Redis 없음).
- **C1-2 utteranceId 재사용/경합 → 부분 채택(K6 수정)**: 스키마 변경(`Utterance.chatId`·`chatMessageId @unique`)은 공유 DB `db push` = 사용자 승인 사항이라 **이번엔 하지 않고** 코드로 막는다 — ① 수락 전 검사: 소유자 + `chatMessageId IS NULL`(이미 연결된 발화는 `409 CONFLICT {reason:"UTTERANCE_USED"}`) + 생성 10분 이내(오래된 발화 재사용 차단) ② 수락 뒤 연결은 **조건부** `updateMany WHERE id AND userId AND chatMessageId IS NULL` — count 0 이면 턴은 계속하되 Trace warning(사용자당 턴 락이 이미 동시 턴을 막으므로 경합은 이중 방어). 발화↔chat 결속(티켓 chatId 보존)은 스키마가 필요해 **후속 백로그**(domain-model 에 `Utterance.chatId` 추가 제안으로 기록, 사용자 승인 시 db push). 같은 사용자 자기 발화를 자기 다른 방에 쓰는 것은 타인 노출이 아니라 수용.
- **C1-3 조기 TTS 선노출 → 채택(K2-2 수정)**: ① 추출기는 **경로 인식 증분 JSON 토크나이저**(최상위 객체의 `conversation.replyJa` 문자열 값만, 이스케이프 처리, 다른 문자열 값 안의 `"replyJa"` 흉내는 무시) — 정규식 금지 ② 문장별 **최소 안전 필터** 통과 시에만 합성: 길이 2~100자, 제어문자 0, 가나/한자 비율 ≥50%, URL·이메일·`[A-Za-z]{4,}` 연속 영문·엔진/모델명 패턴·`system`/`prompt`/`JSON` 같은 지시문 누출 패턴 0 — 실패하면 조기 경로를 끄고 최종 검증 후 합성(정상 경로)으로 되돌린다 ③ 최종 검증 실패(재시도) 시 이미 나간 문장은 되돌릴 수 없음을 **잔여 위험으로 수용**(강사 페르소나 고정·필터 통과 문장 1~2개 한정, 발생 시 Trace `AUDIO_TEXT_MISMATCH` 기록·클라는 최종 텍스트로 정정). 조기 경로는 설정값(`runtime.earlySentenceTts`, 기본 on)으로 끌 수 있게.

### [2026-09-28 04:17] C2 adversarial-review focus=concurrency — done
- judge 판정: [[task-007-talk-voice-web.md#판단-기록-judge]] §106 C2 gate codex_required / 호출 차수: 2/4 (R2)
- 대상: repo=TheKaiwa base=05f0cbb snapshot=98732a2
- 지적 **2건**:
  - [medium] **TTS chunk 동시 합성 vs SHADOWING 이전 길이 정책 충돌** (turnAudio.ts:266) — 최대 2개 동시 합성 중 chunk 1이 chunk 0 완료 전 시작 → `previousDurationMs` null 전달 → SHADOWING 정책의 이전 문장 길이만큼 쉼이 무시됨 → 다음 문장 즉시 재생. 권고: 이전 duration 필요한 프로필은 순차화하거나 계산을 분리, 최소한 프로필 메타 노출로 concurrency=1 조절.
  - [medium] **Early sentence mismatch 시 진행 중 TTS 취소 불가** (turnAudio.ts:211) — 최종 JSON 검증 실패/재시도 후 이미 보낸 문장과 다르면 `finalize()` 가 queue만 비우고 실행 중 speaker 작업은 취소 안 함 → `done` 이벤트 최대 9초 지연(청크 타임아웃) + M4 자원 낭비. 권고: TurnSpeaker에 AbortSignal 전달해 mismatch 시 in-flight 합성 취소, 또는 mismatch 확정 시 settled 즉시 해제.
- 검토하지 못한 범위: 라이브 M4 TTS 부하 테스트·Playwright 재실행(read-only 범위) / MariaDB 실제 동시 격리 재현(코드·Prisma만 검증).
- 원본: /home/brownjeon/NFS/homes/brownjeon/project/.claude/state/codex-review/runs/20260927T191314Z-task-007-C2/raw.txt

## Designer 기록
- [02:13] 가이드 완료 → `docs/screens.md` §9(9-0~9-11) + 변경 이력·§2 회화 두 행·§3 "회화 준비 중" 문구(§3-1 진입·3-2 A·3-5·3-8 ⓖ)·§7-3 A 폴링 멈춤 범위·§8-1/8-2 C(재생 중 버튼 → barge-in) 갱신. 경로: 홈 `/study/ai`(기본 `tab=talk`) → 방 `/study/ai/talk/[chatId]`(탭 숨김, 머리 56px = ← · 아바타 40·이름 · 표시등 · ⋯).
- [02:13] 결정: 화면 상태 6개(IDLE·RECORDING·RECOGNIZING·QUEUED·THINKING·SPEAKING)를 STT·턴·재생 세 상태에서 순수 `deriveTalkState` 로 유도(표 §9-3 A — PTT disabled·aria-label·상태 줄 문구). final 즉시 #32(≤1자 미전송+힌트), 앞 턴이 아직 streaming 이면 QUEUED 후 done 에 전송. 선생님 말풍선은 chunkIndex 0 부터 이어진 앞부분만 드러내고 재생 문장 `bg-accent-soft` 강조, done 에 replyJa 확정+읽기·번역·▶. barge-in = `queue.interrupt` → `unlockTtsAudio` → `stt.press` 순(동기), unlock 은 누름·뗌 둘 다(터치 pointerup 이 활성화). 교정 카드는 done 즉시 사용자 말풍선 아래 `CorrectionCard` 전체형. 거절된 말은 `UnsentBar`([다시 보내기]·[글자로 고치기]·✕). 녹음 중 목록 aria-live off·partial aria-hidden·생성 중 말풍선 aria-busy·토스트 보류.
- [02:13] 파일(B): 신규 `src/components/talk/*`(TalkRoom·TalkRoomHeader·TalkTutorBubble·TalkUserActions·LiveUtteranceBubble·TalkIntro·VoiceBar·SttAlert·UnsentBar·AutoplayBar·TopicEndNudge·ReplayButton·SpeakingBars·useTalkPlayback·talkState·revealChunks·timings·talkCopy + 테스트 3) · `src/modules/speech/tts/client/{index,playbackQueue}`(재생·오디오는 주입, `splitSentences` re-export, 경계 테스트) · `app/(app)/study/ai/talk/[chatId]/page.tsx`. 확장(기본값=현 동작): useChatTurn(send opts·onAudio/onWarning/onDone/onSettled·done 교정 붙이기)·MessageList 슬롯·MessageBubble 슬롯·CorrectionCard showCounter·Composer leading·ChatMenuSheet kind+들려주는 방식·NewChatSheet/ChatList kind·PendingCorrectionsCard TALK·ChatRoom kind 가드·useRealtimeStt onFinal(utteranceId)·api.ts apiGetAudio·TabBar·page 기본 talk. TalkComingSoon 삭제.
- [02:13] **Leader 확인 필요**(§9-11): ① barge-in 이 §8-2 C·designer 원칙(재생 중 버튼 비활성)을 대체 ② `final.utteranceId:null` → `{text, inputSource:'TEXT'}` ③ SSE audio 에 `cached`·`pauseBeforeMs` 추가 ④ 자막만 턴 신호 `status{TTS, warning:'TTS_UNAVAILABLE'}` 권장 ⑤ clientTimings 에 `sttMs`·`releaseToFirstAudioEventMs` 추가·`firstAudioAtMs` 기준점 ⑥ #29 USER `utteranceId`(현 MESSAGE_SELECT 에 없음)+만료, ASSISTANT `speechStyle`(다시 듣기 캐시 HIT) ⑦ AUDIO_TEXT_MISMATCH 때 재생 중 청크도 즉시 끊음 ⑧ UnsentBar 재전송 = 같은 utteranceId ⑨ 표시등 pause 는 턴 진행 중에만 ⑩ 방 메뉴 들려주는 방식 = #13 GET→#14 전체 PUT ⑪ #24 URL 은 `/api/v1/speech/tts/` 접두만 fetch·재사용 안 함 ⑫ 발견 이슈 4건(useRealtimeStt 가 utteranceId 버림·send 가 busy 면 조용히 무시·PendingCorrectionsCard CHAT 만·카운터 1/1).

## Prompt-Engineer 기록

- [02:40] K4 착수 — 대상 확인: `prompts/talk.ts`(A1)·`structuredResponse/schemas.ts`(필드·제약 불변, 읽기만)·`tests/prompts/fixtures/talk-corrections.json`(기존 20문장 그대로 재사용)·`tests/live/llm-measure.ts`·`decisions/llm-japanese-quality.md`. `buildTalkRequest`/`callOnce`(engine/llm)/`buildClaudeArgs`(claudeCli 어댑터)를 먼저 읽어 `persona`(→`--system-prompt`, K2-1 예열 키)와 `system`+`messages`(→ stdin)가 이미 분리돼 있음을 확인(K4-3, 코드 변경 없음).
- [02:52] K4-1·K4-2 설계 — `talkInstruction()`에 (a) 최상위 키 순서 지시(speech→conversation→correction→learning→endOfTopic→proposals, conversation 안은 replyJa→replyReading→replyKo) (b) `<...>` 자리표시자 "[순서 예]" 스켈레톤(모델이 그대로 베끼면 기존 `checkPlaceholderLeftovers`/ajv enum 검사가 잡는 안전망 활용) (c) replyJa 첫 문장을 「そうですね。」「いいですね！」류 짧은 맞장구로 예시. **함정**: 처음 초안(풀 JSON 예문 포함)은 +476자라 `altText`+꽉 찬 6개 이력 창이 겹치는 극단 시나리오에서 3,000자 캡을 30자 초과했다(파이썬으로 `renderHeader`/`buildWindow`/`renderTranscript` 로직을 그대로 복제해 사전 검증, 실제 TS 코드는 실행 전). `<...>` 스켈레톤 + 문구 압축으로 +372자로 줄여 재확인 후 확정(기존 unit-test 시나리오 마진 131자, altText+꽉 찬 이력 조합 마진 35자). **재발 방지**: 프롬프트에 지시문·예시를 추가할 때는 `TALK_USER_PROMPT_CAP` 시뮬레이션(또는 실제 단위 테스트)을 altText 있는 조합까지 포함해 반드시 먼저 돌려볼 것 — `room` 계산이 창을 자동으로 줄여 주지만 `system`+`text` 만으로도 캡을 넘길 수 있다.
- [03:05] K4-3 — persona 불변성 확인만(코드 변경 없음): `buildTalkRequest`·`buildChatRequest` 둘 다 `persona`가 `(sections, level, mode)`로만 정해지고 날짜·헤더 세부값·altText·이력·발화는 전부 `system`/`messages`로 간다. `prompts.test.ts`에 회귀 테스트로 박음(날짜·헤더·altText·이력·발화만 다른 두 TALK 호출·두 CHAT 호출의 `persona.prompt` 바이트 동일 어서션 + TALK≠CHAT).
- [03:10] `TALK_PROMPT_VERSION` `talk@v1`→`talk@v2`. Prompt Registry `prompts:sync`는 아직 스크립트·테이블이 없어(admin-console/14 미구현) 실행 못 함 — 코드 상수 버전만 올려 둠, Registry 붙을 때 반영 필요.
- [03:15] 픽스처(`tests/prompts/fixtures/talk-corrections.json`)는 기존 20문장(오류16·정답4) 그대로 재사용(변경 없음). 단위 테스트 7건 추가(`prompts.test.ts`): 키 순서 지시문 존재·순서, 첫 문장 단축 지시·교정 설명 correction 전용 유지, altText+꽉 찬 이력 캡 준수, TALK·CHAT 각각 persona 바이트 동일성. 미러 동기화 후 `node --import tsx --test` 로 conversation 전체(46건)·저장소 전체(284건) 통과, `tsc --noEmit`·eslint 클린 확인(1차 tsc 에러 9건은 테스트의 `req.persona` optional 타입 때문 — `!` 단언으로 해결, 실제 런타임에서는 `buildTalkRequest`/`buildChatRequest`가 항상 채움).
- [03:22] K4-4 라이브 재실측 — `tests/live/llm-measure.ts` 에 키 순서 준수율(top: speech<conversation, conv: replyJa 첫 키)·`splitJaSentences` 기반 첫 문장 글자 수 분포(min/p50/p90/max) 계측 추가(`JSON.parse`가 소스 순서로 프로퍼티를 넣는다는 사실 이용 — `extractAndValidate`가 파싱 결과를 재구성 없이 그대로 돌려주는 것을 코드로 확인 후 `Object.keys` 신뢰). 우분투에서 haiku·`--json-schema` OFF(기본 경로)로 20문장 실행(ON 경로는 기존에도 프로덕션 경로가 아니라 재실측 생략). 결과: 실패 0·재시도 1(5%, chunkType enum 위반 1건, 순서와 무관)·p50 4.96s(12s초과 0)·검출 16/16·오탐 0/4·**키 순서 준수 20/20(top)·20/20(conv), 둘 다 20/20 — 100%**·replyJa 첫 문장 글자 수 min5·p50 6·p90 8·max 15. `decisions/llm-japanese-quality.md` §6 에 표·결론·developer 전달 사항(순서는 강제되지 않으므로 K2-2 조기 추출에 폴백 필요) 기록.
- [03:28] 범위 밖 발견 — `TalkInput.altText`(STT 두 번째 인식 후보)에 길이 상한이 코드에 없다(구조적, 이 task 전이라 손대지 않음). `mcp__ccd_session__spawn_task` 로 별도 제안 큐잉(아래 참고), Leader 에게도 전달.
- **위반율**: 0/20(라이브, 스키마 위반 재시도 1건은 chunkType 분류 — 순서·문장 지시와 무관). **A1 프롬프트 길이**: `talkInstruction()` 1,106자(구 734자), 사용자 프롬프트 실측 6,04x자대(persona 포함 promptChars, 캡 자체는 persona 제외 `system`+`messages` 기준 ≤3,000자 — 위 시뮬레이션·단위 테스트로 확인). **픽스처 수**: 20문장(변경 없음) + 신규 단위 테스트 7건.

## Developer 기록

### A(서버)
- [02:05] 착수 — 이력서 K2·K3·K5·K6·K7 + C1 판정 3건 + 정본(#21b·#23·#24·#29·#32·§7-1, speech-platform/16 §6, module-dependency §4-1) + 기존 코드(claudeCli·engine/llm·orchestrator·speech/tts·utterances) 확인.
- [02:15] **예열 실측(대기 중 비용)**: `claude --print --input-format stream-json --output-format stream-json --verbose --include-partial-messages` 대기 프로세스를 `--debug-file` 로 관찰 — 대기 동안 부트스트랩·조직 설정·`/v1/mcp_servers` 목록 조회(메타데이터)와 TCP 6개만, **`/v1/messages` 호출 0 = 토큰 비용 0**. 같은 조회는 cold spawn 도 매번 한다(쓰이지 않고 TTL 로 버려지는 예열 1개 = 그 조회 1벌이 추가 비용). **메시지 없이 stdin EOF → 0.5초 안에 exit 0** — 서버가 SIGKILL 로 죽어도 파이프가 닫혀 대기 CLI 는 스스로 끝난다(고아 방지의 마지막 안전망). 메시지 보낸 뒤 첫 텍스트 delta ≈0.8s, 결과 ≈1.5s(짧은 프롬프트).
- [02:20] **K2-1 예열 풀** `engine/adapters/llm/claudeWarmPool.ts`(globalThis 상태 — dev HMR 에도 풀·훅 1개): 키 = sha256(CLI 경로·cwd·argv 전체)(argv 에 model·`--system-prompt`(페르소나)·플래그 — 학습자 데이터는 stdin 메시지로만 가므로 대기 프로세스에 사용자 정보 없음). 키당 대기 1·전체 상한 `runtime.prewarmMaxIdle`(기본 2, 0=끔, 넘으면 가장 오래된 것을 내림)·유휴 TTL `runtime.prewarmIdleTtlSec`(기본 600)·`runtime.prewarm`(기본 true) — claude-cli Provider 스키마에 키 3개 + `runtime.earlySentenceTts` 추가(seed 는 안 바꿈, 코드 기본값). **프로세스당 1요청**(메시지 1줄 쓰고 stdin 닫음 — 세션 누적 없음). 대기 중 죽으면 버리고, 시작 5초 안에 죽으면 30초 BACKOFF(인증 깨짐 등 spawn 폭주 방지). 꺼낸 예열이 메시지 뒤 아무 출력 없이 끝나면 `ClaudeWarmUnusableError` → 같은 요청을 cold 로(warm=FALLBACK). 수명: `process.once('exit')`·SIGTERM·SIGINT 에 대기+실행 중 자식 모두 kill(우리 핸들러만 있으면 기본 종료를 되살림), `detached` 안 씀. **트리거(명시적 warm 라우트 없음)**: ① #29 TALK 방 첫 조회(`after` 없음) ② #20 TALK 방 `purpose:TURN` 티켓(푸시투토크 누름 — 말하는 동안 뜬다) ③ 턴이 예열 키를 쓰면 끝난 직후 다시 채움(원하던 키·TTL 안만). 예열 요청은 `conversation.prewarmTalkTurn` 이 실제 턴과 같은 `buildTalkRequest` 로 모양만 만들어 `llm.prewarm` 에 넘긴다(PE 가 페르소나 절을 바꿔도 키가 따라간다).
- [02:25] **K2-2 조기 추출**: ① `engine/json/jsonPathStream.ts` — 문자 단위 상태기계(정규식 아님), 첫 `{` 앞(코드펜스) 건너뜀, 최상위부터 객체 키 연쇄로 경로 판정(배열은 경로를 끊음), 이스케이프·`\u` 서로게이트 해석, 문법 오류면 `failed` 로 멈춤, 키 순서 무관. ② claudeCli `onTextDelta`(`stream_event/content_block_delta/text_delta`) → `llm.completeJson({onTextDelta(delta, call)})` — LLM connection `runtime.earlySentenceTts !== false` 일 때만 흘림. ③ `conversation/orchestrator/turnAudio.ts` — `conversation.replyJa` 조각 → 문장 분리(`sentences.ts`: 。！？!?… 경계, 부호 뒤 다음 글자가 와야 확정, 부호 뺀 2자 미만은 다음 문장에 붙임) → 안전 필터(`earlyFilter.ts`: 2~100자·제어문자·가나/한자 ≥50%·URL/이메일·연속 영문 4자·JSON/마크업 기호·엔진명(`llm.mentionsEngineIdentity` — 이름 목록은 adapters/llm/identity.ts 에만)·지시문 낱말) 통과 문장부터 합성. 첫 호출(call 1)만 쓰고 재시도 조각은 무시. 필터·리더 실패 → 조기 경로 끔. ④ 최종 대조: 보낸 문장들이 최종 replyJa 앞부분(사이 공백만 허용)이 아니면 `status{TTS, warning:AUDIO_TEXT_MISMATCH}` + 대기 청크 폐기 + **이후 도착하는 청크 이벤트도 내보내지 않음**(designer ⑦ 들리는 것 = 보이는 것).
- [02:30] **K3 턴 TTS**: `TurnHooks{gate, onAccepted, speaker}` 를 conversation 이 정의하고 #32 라우트가 speech 로 구현해 넘긴다(conversation↔speech import 0). speech `createTurnSpeaker` = #23 과 같은 파이프라인(`synthesizeSentence` 에 `contextMode:'TALK'`·`chunk{index, previousDurationMs}`·`trace.record:false` 추가 — 턴 Trace 가 하위 단계를 합침) + #24 서명 URL. 청크 동시 2·청크당 9s(합성 8s + 준비). TEXT_ONLY(연결 없음·서킷) → `status{TTS, warning:TTS_UNAVAILABLE, runtime:{executionMode:TEXT_ONLY}}` 1회 후 남은 문장은 부르지도 내보내지도 않음. 문장 실패는 그 청크만 FAILED. `done` = 저장 + 모든 청크 종료 뒤 1회, `audioCount` = 보낸 OK 수. `pauseBeforeMs` = 첫 청크 0, 이후 SpeechProfile 간격(숫자·SHADOWING 은 직전 길이)과 Plan 세그먼트 쉼 중 큰 값.
- [02:33] **K5 #24** `speech/tts/audioUrl.ts` + `app/api/v1/speech/tts/[token]/route.ts` — C1-1 판정 그대로(payload `{k,e}` 만·userId 는 MAC 입력만·HKDF 키 `infra.deriveSubkey('thekaiwa/tts-audio-url/v1')`(infra/keys.ts 신규 — JWT_SECRET 파생, 새 env 없음)·timingSafeEqual·10분·만료가 +1시간 넘는 토큰 거부·payload 키 추가 거부). 401 은 세션 없음만, 그 밖은 전부 같은 404 본문. `/tts/status` 정적 세그먼트 우선 확인. #23 `Accept: application/json` 변형도 열어 서명 URL 을 준다(다시 듣기 프리페치용 — 계약 #23 에 있던 모양).
- [02:35] **K6** `speech/utterances/turn.ts` — `checkUtteranceForTurn`(수락 전: 소유 404·`chatMessageId` 있음 409 `UTTERANCE_USED`·10분 지남 409 `UTTERANCE_EXPIRED`) · `linkUtteranceToMessage`(수락 직후 조건부 updateMany, 고친 글자면 `finalText=text, finalSource=USER`, count 0 → Trace `UTTERANCE_LINK` warning) · `readUtteranceAudio`(#21b — 행 소유 + 경로의 사용자 조각도 세션 사용자, 보존 기한·삭제면 null) · `utterancesForMessages`(#29 조합). 본문 규칙: `utteranceId` 만 오면 `REALTIME_STT`, `TEXT`+id 400. **스키마 변경·db push 없음** — `Utterance.chatId`·`chatMessageId @unique` 는 domain-model §8 #17 에 사용자 결정 제안으로만.
- [02:40] **K2-3 DB — 원인이 왕복이 아니었다(실측)**: NAS MariaDB 왕복은 SELECT 1 p50 **0.4ms**, 트랜잭션 쿼리 6개 ~7ms 인데 **커밋 1회가 100~515ms** — `innodb_flush_log_at_trx_commit=1` + `log_bin=ON` + `sync_binlog=1`(커밋마다 NAS 디스크 fsync 2회). task-006 의 "서버측 ~1.2s" = 수락 커밋 + 저장 커밋이었다. 그래서 **수락 트랜잭션과 LLM 을 병렬로** 바꿨다: 잠금 없는 확인(채팅 소유·모드·수준 `precheckChat`, 발화 gate)을 먼저 끝내고 LLM 을 띄운 뒤 수락 커밋을 기다린다. 수락 거절(404·409·400) → `AbortSignal` 로 LLM 자식 kill(새 `ClaudeCliAbortedError`, 큐 대기 중이면 시작 안 함, router 는 AbortError 를 폴백하지 않음) 후 그 오류를 봉투로(행 0·SSE 0). 수락 전 이벤트는 `EarlyEmitter` 가 모았다가 `accepted` 바로 뒤에 순서대로. 음성 합성은 speaker 가 수락 promise 를 기다려 **수락 뒤에만**. 끊김 복구는 이전 사용자 메시지가 필요해 수락 뒤에 LLM. 학습자 헤더 재료 60초 메모리 캐시(진행 중 읽기 공유, #12 PUT 이 비움)·이력 미리 읽기(userId 조건 포함). 저장 트랜잭션은 조기/최종 합성과 병렬, 락은 저장 직후 해제(남은 합성은 락과 무관 — done 은 그 뒤). toolLog 의 TTS 값은 모든 청크 뒤 같은 객체로 한 번 더 씀.
- [02:40] **Leader 에스컬레이션(인프라, 사용자 결정)**: 커밋 지연의 근본 해결은 NAS MariaDB `innodb_flush_log_at_trx_commit=2`·`sync_binlog=0`(또는 100) — 커밋당 100~500ms → 수 ms. 대가는 OS/NAS 전원 장애 시 최근 ~1초 트랜잭션 유실 가능. 공유 DB(다른 프로젝트 포함)라 코드로는 건드리지 않았다.
- [02:45] **K7 계측**: Trace TURN = `STT`(clientTimings.sttMs, source client)·`ACCEPT`(parallelWithLlm)·`PROMPT`·`LLM`(startMs·warm HIT/MISS/FALLBACK/OFF·firstDeltaMs·firstSentenceMs(둘 다 LLM 시작 기준)·earlyStop)·`PARSE`·`SAVE`·`TTS[i]`(chunkIndex·early·cacheHit·status·errorCode, 0번 ttfaServerMs)·speech 하위 단계(`TTS_SYNTH[i]` 등 connectionKey 는 관리자 Trace 에만)·`UTTERANCE_LINK`, 다음 턴 clientTimings 로 직전 Trace 에 `PLAYBACK` 덧붙임(`engine.appendTraceSteps`, 주인·같은 채팅만). toolLog = domain-model ChatMessage 주석 갱신. 원문·전사·응답 전문 0.
- [02:47] `TALK_SCHEMA` 선언 순서를 talk@v2 지시(speech 먼저)와 맞춤(검증 의미 불변 — PE 20ff3e7 상충 메모 해소). 추출기는 순서 무관(단위 테스트: conversation 먼저여도 조기 경로 동작).
- [02:50] 단위 테스트 +36(engine `jsonPathStream` 5·`claudeWarm` 9(가짜 CLI 로 cold/HIT/1요청/재충전/상한·축출/TTL/BACKOFF/FALLBACK/drain 후 pid 0), conversation `task007` 12, speech `task007` 5, 006 테스트 1건 갱신(utteranceId 이제 받음)) — 전체 354/354, tsc 0, eslint 0 error(내 파일; `components/talk/useTalkPlayback.ts:54` "refs during render" 1건은 B 작업 중 파일).
- [02:37] ⚠ **Claude 구독 세션 한도 도달**("You've hit your session limit · resets 3am") — 라이브 턴·30턴 실측을 03:00 이후로 미룸. 참고: CLI 가 한도 문구를 stdout 에 쓰고 exit 1 이라 우리 로그에는 `ClaudeCliExecError exit=1 stderr 없음` 으로만 남는다(원인 식별 개선은 후속 제안). router 경고에 오류 이름(`실패(ClaudeCliExecError)`)을 붙였다.
- [03:10] **라이브 스모크** `tests/live/task007-smoke.sh`(dev 3011, QA 2계정) **35/35 PASS**(+SKIP 1: TEXT_ONLY — M4 는 운영과 공유라 멈출 수 없어 단위 테스트로 갈음). SSE 순서·audio 키 집합·엔진명 0·URL userId 0·CHAT audio 0·#24(본인 200 private max-age 591 / 타인·변조·만료·없는 키·형식 오류 = 같은 404 본문 / 무세션 401 / `/tts/status` 우선)·#23 JSON·utteranceId(404·타인 404·400×2·연결+USER·409 USED·409 EXPIRED)·#21b(200·404·401·만료 404)·#29 3필드·Trace STT/ACCEPT/LLM(warm)/TTS[0]/PLAYBACK/UTTERANCE_LINK·toolLog 키·원문 0·대기 예열 ≤2.
- [03:18] **지연 실측(완료 기준 7)** `tests/live/task007-latency.sh 3011 30` — 우분투, stt20 테스트 음성 30턴, 운영 gateway WS(Origin 허용 목록 때문에 스크립트가 앱 도메인 Origin 을 싣는다) → dev 턴 SSE → M4 TTS, haiku·예열+조기 추출 켬:

  | 구간 | n | p50 | p90 |
  |---|---|---|---|
  | **stop → 첫 audio 이벤트(목표 ≤4.0s)** | 30 | **2,123ms** | 2,876ms |
  | stop → final(STT) | 30 | 631 | 1,006 |
  | 턴 요청 → 첫 audio | 30 | 1,628 | 1,986 |
  | ACCEPT(커밋, LLM 과 병렬) | 30 | 598 | 1,066 |
  | LLM 첫 텍스트 조각(LLM 시작 기준) | 29 | 790 | 982 |
  | LLM 첫 문장 확정(LLM 시작 기준) | 29 | 1,106 | 1,286 |
  | LLM 총 | 29 | 3,918 | 6,348 |
  | ttfaServerMs(청크0, HIT 16/30 섞임) | 29 | 520 | 1,347 |
  | 턴 요청 → done | 30 | 5,046 | 7,579 |
  | 반사실: 조기 추출 끔(LLM 끝 + 청크0) stop → 첫 audio | 29 | 5,022 | 7,019 |

  warm HIT **29/29**(1턴 ENGINE_TIMEOUT — CLI 가 12s 를 넘김, 조기 audio 는 이미 나간 뒤 `error`). 조기 추출이 첫 음성을 **~2.9s** 당긴다. 예열 A/B(`task007-warm-measure.ts 3`, 어댑터 수준·같은 TALK 모양): 보낸 뒤 첫 조각 cold p50 1,489 → warm 796ms, 결과까지 4,958 → 3,456ms(Leader 실측 −0.9s 와 일치). 폰 재생 지연(클라)·실기기 p50 ≤5s 는 003f.
- [03:20] **예열 수명 실측**: 대기 예열 1개 RSS ≈ **265MB**(계획 추정 100~200MB 보다 큼 — 상한 2 + 실행 1 이면 ~0.8GB, K9 pm2 메모리 한도 확인 필요). 방치 10분 뒤 대기 0(TTL). dev 서버 워커 재시작(sync-local 이 next.config.ts 를 복사하면 재시작된다) 뒤 고아 `claude --print` 0. 스모크 뒤 대기 1(≤2).
- [03:22] #20 티켓 라우트의 소유자 확인을 `getChatDetail`(메시지·stale 정리 쓰기 포함) → `getOwnedChat`(읽기 1회)로 — 실측 중 티켓이 커밋과 겹치면 **1.5s** 걸렸다(누름 → 녹음 시작 경로). 바꾼 뒤 12ms.
- [03:25] 격리 빌드(`~/.node-local/thekaiwa-buildcheck-a`, node_modules `cp -al`, .next·logs 제외) **exit 0**(새 라우트 `/tts/[token]`·`/utterances/[id]/audio` 포함) 후 삭제. 경고 3건(Dynamic filesystem access)은 기존 코드(persona loader·`--version` 프로브) — 이번 변경 아님. 수동 시험 Chat·Trace 정리 완료.

- [03:29] 커밋 `6d8b3b1`(A 파일만 경로 지정 — B 의 components·app/(app)·eslint·speech/tts/client 와 vault 이력서는 포함 안 함, push 안 함). **dev 서버 종료 확인**: 종료 전 워커 자식 대기 예열 1개(RSS 267MB) → `kill <dev pid>` 뒤 워커·`claude --print` **0**, 3011 LISTEN 0(완료 기준 8 — dev 서버 종료 후 고아 0). 스크래치 쿠키 삭제.
- [03:40] **[High] MISS 청크 #24 404 경합 수정(B E2E 발견)** — 원인 확인: `synthesizeSentence` 는 singleFlight 가 캐시 저장(파일 쓰기 + `TtsCache` 행 커밋)을 **응답 뒤로** 미루도록 돼 있어(003d 설계 — 첫 오디오를 저장 I/O 만큼 늦추지 않음) SSE `audio` 가 행 커밋보다 먼저 나간다. NAS 커밋 fsync 100~500ms + NFS 파일 쓰기라 0.6~1.4s 동안 #24 가 404. **(a) 채택** — `speech/tts/recentAudio.ts`: 합성 직후(`startSynthesis` 의 then — 어느 호출자에게 결과가 가기 **전**) 오디오를 프로세스 메모리에 60초 보관(항목 64·16MB 상한, 넘으면 오래된 것부터), `readSignedTtsAudio` 가 **서명 검증을 통과한 뒤에만** 보관소를 먼저 보고 없으면 DB/파일. 이유: ① TTFA 에 아무것도 더하지 않는다(c 는 커밋 100~500ms 를 그대로 더함) ② (b) "파일 먼저 쓰고 키로 직접 서빙" 은 NFS 쓰기(수백 ms)를 여전히 이벤트 앞이나 경합 창에 두고, 행 없는 파일을 읽는 새 경로(경로·존재 판정)를 연다 — (a) 는 새 경로 없이 검증 뒤 메모리 조회뿐이라 오라클·경로 탈출 표면이 늘지 않는다 ③ 캐시 저장이 실패해도 60초는 들린다. globalThis 에 둬서 턴 라우트와 #24 라우트 번들이 달라도 같은 보관소(프로세스 1개 = pm2 `thekaiwa`). **blue/green**: 전환 순간 #24 가 다른 인스턴스로 가면 그쪽 보관소엔 없다 → 캐시 저장이 끝나기 전(≈1s)만 404 → B 의 클라 재시도(`chunkFetch`, 404 만)가 덮는다 — 전환은 순간이고 창이 1s 안팎이라 **수용**. B 파일 `chunkFetch.ts` 는 **수정 안 함**: 404 일 때만 재시도하므로 서버가 즉시 200 이면 한 번도 기다리지 않는다(아래 실측 재시도 0회).
- [03:45] **[REV-014 M2] 수락 거절 인터리빙 테스트** — `orchestrator/index.ts` 의 DB·LLM 의존을 `turnDeps{precheckChat, acceptTurn, loadRecentHistory, buildLearnerHeader, completeJson}` 로 모아(운영 동작 동일) 단위 테스트가 `mock.method` 로 바꿔 낀다. `conversation/__tests__/task007`: ① gate 통과 → LLM 선행 시작(조기 첫 문장까지 흘림) → 수락 409 → `startTurn` 이 409 로 거절(핸들 없음 = 이벤트 0)·LLM signal abort·speaker 팩토리 0회(수락 전 합성 없음)·락 해제 ② gate 404·채팅 확인 404 → LLM·수락 0회. `engine/__tests__/claudeWarm`(가짜 CLI): cold 실행 중 abort → `ClaudeCliAbortedError`·**자식 pid 죽음** / 예열에서 꺼낸 자식 abort → 죽음 + 재충전 / 이미 취소된 요청 → spawn 0. 라이브 `task007-smoke` **E8**: 다른 채팅에 살아 있는 PENDING 강사 행(다른 인스턴스 턴 흉내)을 넣고 턴 → 409 `runningMessageId`·**DB 행 수 불변**·SSE 0, **E9**: dev 로그에 `[claudeCli] 취소`(완료 없음). claudeCli 에 취소 로그 추가(시작 전 취소 포함), 취소 시 warm 표시가 OFF 로 찍히던 것 수정(꺼낸 순간 HIT).
- [03:48] **[REV-014 Low]** ⑧ 스모크 "행 0" 라벨 → E1~E4·E6·E7·E8 이 모두 **DB 에서 해당 채팅 행 수 전후 비교 + SSE 0** 을 실제로 확인. ⑦ `learnerBaseCache` 를 진짜 LRU 로(적중 시 맨 뒤로). ④ `appendTraceSteps` read-modify-write 는 **그대로**: 같은 traceId 에 PLAYBACK 을 쓰는 것은 그 다음 턴 하나뿐(사용자당 턴 락)이라 동시 append 가 사실상 없다 — 원자적 JSON_ARRAY_APPEND 로 바꾸면 MariaDB 전용 raw SQL 이 생겨 이득보다 비용이 크다. ⑥ `steps` 가 SSE 로 새는 경로: audio 이벤트는 필드를 하나씩 골라 만들고(스프레드 없음) 기존 단위 테스트("speaker 의 관리자 단계는 SSE 로 나가지 않는다")가 막는다 — 추가 조치 없음. ⑤ 테스트 수 차이는 B 테스트 포함 여부(현재 367/367).
- [03:52] **검증**: 단위 **367/367**(신규: 수락 거절 2·abort 3·보관소 2), tsc 0·eslint 0 error, 격리 build exit 0(`thekaiwa-buildcheck-a` 생성·삭제). 라이브 스모크 **39/39**(+SKIP TEXT_ONLY) — 새 **A9** 턴 audio 이벤트 **받는 순간** #24 → 200 · **D2** #23 새 문장(MISS, cached:false) → 곧바로 서명 URL 200 · E8·E9.
- [03:55] **재실측 — 손 뗌 → 첫 청크 오디오 바이트 수신(#24 200, 클라 재시도 흉내 포함)**, `task007-latency.sh 3011 14` + `… 10`(2번째 이후 청크까지 이벤트 즉시 받기):

  | 구간 | 14턴 p50 / p90 | 10턴 p50 / p90 |
  |---|---|---|
  | stop → 첫 audio 이벤트 | 1,847 / 2,926 | 1,711 / 2,400 |
  | **stop → 첫 청크 바이트(#24 200)** | **1,921 / 2,975** | **1,761 / 2,960** |
  | └ 첫 청크 MISS | 2,504 / 3,879 (n=3) | 2,984 (n=1) |
  | 첫 audio 이벤트 → 바이트 | 48 / 128 | 49 / 409 |
  | ttfaServerMs(청크0) | 97 / 742 | 20 / 457 |

  **#24 404 재시도 0회**(24턴 전부), 2번째 이후 청크 즉시 받기 MISS 8건·HIT 7건 **404 0**. warm HIT 24/24, AUDIO_TEXT_MISMATCH 0. (14턴 #1 HIT 의 1.0s 는 dev 서버가 `/tts/[token]` 라우트를 처음 컴파일한 시간.) dev 서버 종료 뒤 워커·`claude --print` 0.
- [03:58] 커밋 `de48fe3`(A 파일 13개 — api-contract #24 "발급 직후 곧바로 200" 주석 포함, B 파일·vault 미포함, push 안 함).
- [04:20] **Codex C2-1(SHADOWING·동시 합성) 수정** — ① `speech/tts/profiles.resolveSpeechProfile`(요청값 > 저장값 > NATIVE, **TALK 문맥은 저장값 PRONUNCIATION·SHADOWING 을 물려받지 않고 NATIVE**)를 `prepareSentence` 가 쓴다 — 청크 스케줄러(`turnAudio`)는 프로필을 모르는 채로 둔다(L2↔L4 경계, reviewer 권고). 회화가 아닌 문맥(#23 다시 듣기·미리듣기)과 화면이 요청으로 지정한 값은 그대로(회귀 테스트). ② Leader 추가 지시 — `preferences/validate.parseVoiceDraft`(#14 PUT·#18 미리듣기 draft)를 **설정 화면 3종만** 받게(`USER_SPEECH_PROFILES`, PRONUNCIATION·SHADOWING → 400). 기존 행 확인: 운영 DB `UserVoiceSetting` 은 NATIVE 1·LEARNING_SLOW 1 뿐이고 설정 화면(`VoiceSettings` 는 모르는 값을 NATIVE 로 보여 저장)·회화방 메뉴(3종) 모두 3종만 보내므로 **깨지는 행·화면 없음** → 두 겹 모두 적용(검증 + TALK 가드 — 옛 행/직접 DB 쓰기 방어). 컬럼 enum 은 그대로(스키마 변경 없음). api-contract #13~#14 갱신. **후속(Phase 3 섀도잉 화면)**: 그 화면이 SHADOWING 을 요청 단위로 보내면 동시 합성과 "직전 길이만큼 쉼" 이 다시 충돌한다 — 그때 순차화 또는 `pauseBeforeMs` 를 직전 청크 확정 뒤 SSE 송신 시점에 계산(reviewer 가 Leader 에 speech-platform/16 각주 요청).
- [04:22] **Codex C2-2(불일치 시 진행 중 합성 대기) 수정** — `TurnAudio.checkSettled` 조건을 `queue 비어 있음 && (running 0 || mismatch || textOnly)` 로: 불일치·자막 전환이 확정되면 진행 중 합성(최대 9s)을 기다리지 않고 `settled()` → `done` 곧바로. 늦게 끝난 합성은 캐시에만 남고 이벤트 0(기존 run 가드), 그 청크의 관리자 Trace 단계는 빠질 수 있다(진단 정보만). M4 요청 자체의 취소(자원 낭비)는 speaker 에 AbortSignal 계약이 없어 후속. 테스트 설명을 위해 `saveTurn` 도 `turnDeps` 로.
- [04:25] **테스트** +6: TurnAudio — 불일치 뒤 느린 조기 합성이 돌아도 settled 즉시·그 뒤 이벤트 0 / TEXT_ONLY(동시 2) 즉시·이벤트 0 / 회귀: 정상 경로는 진행 중 청크를 기다림 / **턴 전체**(turnDeps mock): 조기 문장 → 재시도로 답 바뀜 → speaker 가 막혀 있어도 `done` 이 1.5s 안(9s 아님)·`AUDIO_TEXT_MISMATCH`·audio 0·done 뒤 이벤트 0·락 해제. speech — TALK+저장 SHADOWING/PRONUNCIATION → NATIVE(간격 0·속도 1, 직전 길이 몰라도 쉼 0), 3종·TTS/PREVIEW 문맥·요청 지정은 그대로. preferences — 저장/미리듣기 PRONUNCIATION·SHADOWING 400. 수정 전 코드(미러에서만 되돌려)로 C2-2 테스트 3건이 실패하는 것 확인 후 원복. 단위 **373/373**, tsc 0·eslint 0 error.
- [04:30] **라이브**: `PUT /settings/voice` SHADOWING·PRONUNCIATION 400 · LEARNING_NORMAL 200 / QA 계정 저장값을 DB 직접 SHADOWING 으로(옛 행 흉내) → TALK 턴 Trace `TTS_PLAN.speechProfile` = NATIVE·NATIVE, audio `pauseBeforeMs` 0·0 / 같은 저장값으로 #23(TTS 문맥) = SHADOWING(회귀 없음) → QA 계정 speechProfile 원래 값(LEARNING_SLOW)으로 복원(운영 DB 분포 NATIVE 1·LEARNING_SLOW 1 그대로). 스모크 **39/39**(+SKIP TEXT_ONLY). dev 서버 종료 뒤 `claude --print` 0·3011 LISTEN 0.
- [04:32] 커밋 `0293cd3`(A 파일 9개 — api-contract #13~#14 포함, vault·B 파일 미포함, push 안 함). 격리 build(`thekaiwa-buildcheck-a` 생성·삭제) **exit 0**.

**정본과 다르게 한 것**
1. 청크 스케줄러·문장 감지를 `speech/tts/chunkScheduler` 가 아니라 `conversation/orchestrator/{turnAudio,sentences}` 에 뒀다 — LLM 스트림 조각에서 바로 끊어야 하고 conversation 은 speech 를 import 할 수 없어서. speech 는 문장 1개 합성(`createTurnSpeaker`)만. 문장 규칙은 §6.1 과 거의 같고(4자 병합 대신 "부호 뺀 2자"), 최종 대조는 앞부분 일치라 경계가 달라도 된다.
2. `audio.runtime` 에 `connectionKey` 없음(§7-1 예시와 다름 — task-003d U5), `audio.timing` 은 P1 전까지 싣지 않음, `ttfaMs` = 턴 요청 수신 → 청크0 준비(Trace 의 `ttfaServerMs` = 청크0 합성 시작 → 준비가 §6.4 정의).
3. 수락 트랜잭션과 LLM 을 병렬로(계획은 "왕복 병렬화·캐시" — 원인이 커밋 fsync 라 수락 커밋을 LLM 뒤로 숨겼다). 거절되면 LLM abort.
4. 사용자당 턴 락을 `done` 전이 아니라 **저장 직후** 푼다(남은 합성 동안 다음 턴 수락 가능 — 클라는 done 뒤에 보내므로 영향 없음).
5. `utteranceId` 409 사유 2개(`UTTERANCE_USED`·`UTTERANCE_EXPIRED`), `TEXT`+id 400 — 정본 #32 에 없던 규칙을 계약에 추가.
6. #23 JSON 변형을 이번에 열었다(#18 미리듣기는 wav 그대로). #29 `audio[]` 는 채우지 않는다(다시 듣기 = #23).

**한계·후속**
- TEXT_ONLY 경로는 라이브로 못 봤다(M4 공유) — M4 가 내려간 날 QA 가 확인하거나 단위 테스트로 갈음.
- 검증 전 조기 문장 1~2개가 소리로 나갈 수 있음(C1-3 ③ 수용). 30턴 실측 중 JSON 재시도 2회(교정 스키마 위반·corrected=original) — 이번 스크립트는 `AUDIO_TEXT_MISMATCH` 경고를 세지 않아 발생 여부를 확인하지 못했다(스크립트에 경고 집계를 추가하고 6턴 재실측: stop→첫 audio p50 1,907ms·warm 6/6·MISMATCH 0·TTS_UNAVAILABLE 0·교정 불일치 0).
- LLM 이 12s 를 넘기면 조기 audio 뒤에 `error` 가 온다 — 클라는 큐를 비워야 한다(B 계약 요약에 적음).
- NAS MariaDB 커밋 fsync(100~500ms)는 코드로 못 줄였다 — `done` 은 저장 커밋을 기다린다(합성과 병렬이라 대부분 가려짐). 근본 해결은 위 에스컬레이션.
- 예열 RSS 265MB/개. 스키마 변경 제안(`Utterance.chatId`·`chatMessageId @unique`)은 domain-model §8 #17.
- CLI 구독 한도 도달이 로그에 원인 없이 `exit=1 stderr 없음` 으로만 남는다.

**B 용 계약 요약 추가(03:55)**: #24 는 이제 `audio` 이벤트 **직후 곧바로 200**(방금 합성한 청크 포함) — `chunkFetch` 의 404 재시도는 방어용으로 남겨도 기다림이 생기지 않는다(blue/green 전환 순간에만 쓰일 수 있음).

**B 용 계약 요약(A 확정 — 코드 타입 `src/types/talk.ts`, 정본 api-contract #24·#29·#32·§7-1)**
- **#32 요청** `{text, inputSource?, utteranceId?, clientTimings?}` — `utteranceId` 만 주면 `REALTIME_STT`(명시해도 됨), `TEXT`+id 는 400. 글자로 고쳐 보낼 때도 같은 id + 고친 text + `REALTIME_STT`(서버가 finalSource=USER). `clientTimings = {prevMessageId, sttMs, releaseToFirstAudioEventMs, firstAudioAtMs, playbackStartDelayMs}` — 기준 손 뗌(글자 턴은 보내기 누름), `sttMs` 만 이번 턴·나머지는 `prevMessageId`(같은 채팅의 직전 강사 메시지) 턴, 각 0~120000(밖이면 400), 모르는 키 무시. **수락 전 오류(JSON 봉투)**: 404(채팅·발화 없음/타인) · 409 `details.runningMessageId`(턴 진행 중) · 409 `details.reason` `UTTERANCE_USED`|`UTTERANCE_EXPIRED`(→ 글자 턴으로 재전송 권장) · 400 · 429 `Retry-After`. 수락 전 거절된 발화는 같은 id 로 다시 보내도 된다.
- **SSE 순서**: `accepted` → `status`(PROMPT, LLM) → [`status TTS` · `audio`…(**PARSE 전에 올 수 있다 — 조기 합성**)] → `status PARSE`(+`warning` 가능) → `audio`… → `done` 1회(모든 audio 뒤) | `error`. `status` 경고: `AUDIO_TEXT_MISMATCH`(stage TTS — 재생 즉시 끊고 드러낸 문장 거두고 done 텍스트만), `TTS_UNAVAILABLE`(stage TTS + `runtime:{executionMode:'TEXT_ONLY'}` — 이후 audio 없음, 표시등 TEXT_ONLY), `CORRECTION_ORIGINAL_MISMATCH`(PARSE). `error` 는 audio 뒤에도 올 수 있다(LLM 12s 초과) → 큐 비우고 재시도 안내.
- **audio** `{chunkIndex, text, url, cacheKey, durationMs, cached, pauseBeforeMs, last, ttfaMs?(0번만, 실패면 null), runtime:{executionMode:'SERVER'}, status:'OK'|'FAILED'}` — `chunkIndex` 순으로만 재생(도착 순서 무관), FAILED 는 url/cacheKey/durationMs null(건너뜀), `pauseBeforeMs` 는 청크 앞 쉼(첫 청크 0), `last` 는 서버가 알 때만 true(조기 청크는 false) → **끝 판정은 `done`**. `done.audioCount` = 보낸 OK 수. 엔진명·connectionKey 없음.
- **#24** `GET audio.url`(쿠키) → 200 `audio/wav`(`Cache-Control: private, max-age=<남은 초>`, `X-Tts-Duration-Ms`) · 무세션 401 · 그 밖 전부 404. 만료 10분 — 보관·재사용 금지, `/api/v1/speech/tts/` 접두만 받는다. `Accept: application/json` → `{audioUrl, durationMs, timing:null}`.
- **다시 듣기(선생님)** = #23 `POST /api/v1/speech/tts` 본문 `{text: 문장, context:{styleHint: <#29 speechStyle 또는 done.speech.style>}}` → wav(기본) 또는 `Accept: application/json` 이면 `{url(서명), cacheKey, cached, durationMs, ttfaMs, normalizedText, dictionaryVersion, modelVersion, timing:null, runtime:{executionMode:'SERVER'}, traceId}`. `styleHint` 는 **`context` 안**(최상위 아님 — 400). 같은 문장·말투·설정이면 캐시 HIT.
- **다시 듣기(내 발화)** = #21b `GET /api/v1/speech/utterances/:id/audio` → 200 wav(`X-Audio-Duration-Ms`) · 404(타인·없음·30일 지남).
- **#29** USER `utteranceId: string|null`·`audioAvailable: boolean`, ASSISTANT `speechStyle: string|null`. `audio[]` 는 없다.
- **예열**: 클라가 할 일 없음 — TALK 방 첫 #29 조회(`after` 없음)와 TALK 방 `purpose:'TURN'` 티켓(#20)이 서버에서 예열을 건다.

### B(화면)
- [04:10] 착수 — 이력서 K8·설계 확정 ①~⑫·C1(K5·K6)·screens §9 전부 + §3·§7·§8 재사용 코드(chat/*·speech/*·stt/client)를 읽고 구현 순서는 §9-7 그대로.
- [04:25] **재생 큐 위치 결정(K8 "B 가 정하고 기록")**: `src/modules/speech/tts/client/{index,playbackQueue}.ts` — module-dependency L4 클라 `TtsPlaybackQueue` 자리. 받기(`fetchAudio`)·재생(`play`)·시계·타이머를 **주입**받아 DOM·오디오 API·components 를 import 하지 않는다. `index.ts` 는 큐 + 순수 `splitSentences`(`../sentences` re-export)만. eslint 경계 블록 추가(`src/modules/speech/tts/client/**` — `@/modules`·`@/app|components`·상위 경로(단 `../sentences` 만 허용)·서버 패키지 금지) + components 허용 하위 진입점에 `tts/client` 추가 = **지시대로 Leader 승인으로 간주**. `sttClientBoundary.test.ts` 의 컴포넌트 검사 정규식을 `(stt|tts)/client` 로 넓힘(A 파일 아님 — speech `__tests__` 중 경계 테스트만) + `ttsClientBoundary.test.ts` 신설(진입점 import 화이트리스트·엔진명/console/process.env 0·`sentences.ts` import 0).
- [04:40] 큐 구현·테스트 20건: chunkIndex 순 재생(HIT 먼저 도착해도)·동시 2 받기(낮은 index 먼저)·FAILED/비서명 URL/받기 실패 건너뜀(+표시등 신호)·endTurn 뒤 빈틈 건너뜀·`pauseBeforeMs`(첫 청크 제외, 쉬는 동안 playing 유지)·barge-in 뒤 받기만·abortTurn(재생 중도 즉시 끊고 보관본 폐기)·blocked→resumeBlocked(autoplayed=false)·timings·새 턴이 다시 듣기를 이김·재생 중 다시 듣기가 턴 자동재생을 멈춤·다시 듣기 조각 순차+다음 1개 프리페치·HIDDEN(받기 abort)·LRU 20·같은 메시지 재수신(다시 받기).
- [04:55] 순수 모듈 + 테스트 21건: `talkState.deriveTalkState`(§9-3 A 표 전 행) · `revealChunks`(visiblePrefix·hasMoreAfter·sentenceSpans·completeChunkTexts) · `timings.buildClientTimings`(⑤ 5필드·빼는 경우·0~120,000) · `talkCopy`(§9-8).
- [05:20] 채팅 확장(기본값 = 현 동작): `useChatTurn` send(text, {inputSource, utteranceId, clientTimings}) · 선택 콜백 onAccepted/onAudio/onWarning/onDone/onSettled(done·error·detached·rejected, 폴링 종료도 알림) · `restoreText(text, info)`(status·details — 회화방 UnsentBar) · done 교정을 사용자 말풍선 `corrections` 에 붙임(`required` 버림) · `speechStyle` 보관 · `isBusy()`. `MessageList` 슬롯(renderUser·renderTutor·renderPending·intro·tail·liveOff·followContent — 내용 ResizeObserver 로 바닥 따라감) · `MessageBubble`(TutorRow·JA_BODY export, TutorBubble body/actions/headerExtra, UserBubble actions/correctionChip) · `CorrectionCard showCounter` · `Composer` leading/onTextChange/focus · `ChatMenuSheet` kind 문구·삭제 뒤 경로·extra · `NewChatSheet kind` · `ChatList` kind 별 제목·빈 상태·링크 · `PendingCorrectionsCard` TALK 행 · `StudyAiHome` 회화 탭 · 홈 기본 탭 talk · `ChatRoom` kind=TALK → 회화방 replace · `TabBar` 숨김 경로 · `api.ts apiGetAudio` · `Toast bottomPx`(음성 입력 바가 116px 라 토스트를 136px 로) · `TalkComingSoon` 삭제.
- [05:25] **⑫ 기존 결함 4건 수정**: ① `useRealtimeStt` 가 final 의 `utteranceId`·`durationMs` 를 버림 → `onFinal({text, utteranceId, durationMs, releasedAt, finalAt})`(finishing 에서 받은 final 만, 시각 = performance.now, 30초 자동 멈춤이면 그 시각) ② `useChatTurn.send` 가 busy 면 조용히 무시 → `restoreText(text,{status:409})` 로 되돌림 + 회화방은 `isBusy()` 로 먼저 QUEUED ③ `PendingCorrectionsCard` CHAT 만 → TALK 포함(링크 `/study/ai/talk/{id}#cr_…`·"회화에서 보기 ›") ④ `CorrectionCard` 늘 "n/m" → `showCounter`.
- [05:40] 회화방: `talk/TalkRoom`(+Header·TutorBubble·UserActions·LiveUtteranceBubble·Intro·VoiceBar·SttAlert·UnsentBar·AutoplayBar·TopicEndNudge·ReplayButton·SpeakingBars·SpeechProfileMenu·useTalkPlayback) · `app/(app)/study/ai/talk/[chatId]/page.tsx`. tsc 0 · eslint 0(내 파일) · 단위 테스트 전체 354/354.
- [05:45] A 코드 확인(읽기만): SSE `audio` 에 `cached`·`pauseBeforeMs` 있음, `last` 는 **총 개수를 알 때만** true(조기 합성 문장은 끝내 last 없이 done) → 클라는 `done`(endTurn)으로 끝을 판단하고, 완료 말풍선 문장 강조·보관본 다시 듣기는 "done 이면 0..max 이어짐"으로 완전 판정(`completeChunkTexts(chunks, ended)` + 테스트).
  (위 [04:10]~[05:45] 의 시각은 세션 표기 오류 — 실제로는 02:40~02:58 작업. 이후는 실제 시각.)
- [02:44] 첫 화면 E2E — ① **수화 오류**: 상태 줄 `<p id="talk-status">` 안에 `MicLevelMeter`(div) → `<div>` 로(설계 의사코드도 p 였음) ② **운영 gateway(8100)는 운영 도메인 Origin 만 허용** + 개발 티켓 wsUrl 은 DB connection(8100)에서 옴 → 개발 dev 서버에서 웹 STT 불가. E2E 는 `run_dev.py --port 8197`(`SPEECH_GATEWAY_ALLOWED_ORIGINS=http://localhost:3012`·`APP_INTERNAL_URL=http://127.0.0.1:3012`) 로 개발 gateway 를 따로 띄우고 **테스트 페이지 안에서만** WS 주소를 바꿨다(`--ws-rewrite`, addInitScript — 앱 코드·DB 설정 무변경). ③ 02:46 턴 실패 = Claude 구독 세션 한도(03:00 리셋, A 기록과 같음).
- [03:31] 재개 — A 계약 요약(6d8b3b1·`src/types/talk.ts`)에 맞춤: `types/chat.ts` 의 내 `TurnAudioEvent`·`ClientTimings` 정의를 지우고 **`./talk` 재수출**(중복 타입 제거) · `audio.runtime` 은 SERVER 뿐 → onAudio 의 TEXT_ONLY 분기 삭제(자막만은 `status{TTS, warning:TTS_UNAVAILABLE}` 만) · **409 `UTTERANCE_USED`·`UTTERANCE_EXPIRED`** → UnsentBar 에 발화 id 없이(다시 보내기 = 글자 턴, 계약 권장) 전용 문구 2개, 글자로 고쳐 보낸 턴이어도 같은 띠(입력창에 죽은 id 가 다시 붙지 않게), ✕ 에서 `turn.clearNotice()`. PARSE 전 audio·audio 뒤 error(큐 비움·FailedBubble)는 이미 대응. #23 다시 듣기 본문 `{text, chatMessageId, context:{sentenceIdx, styleHint}}`(styleHint 는 context 안, 서버 `LLM_SPEECH_STYLES` 값만).
- [03:45] **서버 경합 발견 → Leader·A 보고 필요(아래 한계 1)**: 방금 합성된(캐시 MISS) 청크의 `audio.url` 을 이벤트 직후 GET 하면 **404**, 0.6~1.4초 뒤 200(직접 SSE 프로브 4턴: MISS 청크 4/4 가 즉시 404, HIT 는 즉시 200). `TtsCache` 행 커밋(NAS fsync)보다 이벤트가 먼저 나가는 것으로 보인다. 클라 방어: `talk/chunkFetch.ts` — #24 받기가 **404 일 때만** 0.25·0.5·0.75·1·1.5초 간격 재시도(대기 합 4초, 취소 즉시 중단, 그 밖 오류는 그대로) + 단위 테스트 3. 이 방어로 소리는 나지만 **MISS 첫 청크면 첫 재생이 0.6~1.4초 늦어진다**(5초 예산 직접 영향).
- [03:50] **검증**: `npm run typecheck` 0 · `npm run lint` 0 error(경고 5 = 기존 파일: GoogleLoginButton·DiagnosticsScreen·Learning/Speech/VoiceSettings) · `npm run test` **360/360**(B 신규 49: 큐 20·상태 10·드러내기 6·timings 6·chunkFetch 3·SSE audio/교정 2·경계 2). **Playwright E2E `tests/live/task007-ui-e2e.mjs` 40/40 PASS**(실 Chrome headless + `--use-file-for-fake-audio-capture`(M4 로 합성한 「昨日、映画を見に行くました。」 앞 2.5초 무음) + 마이크 권한, dev 3012 격리 복제본 + 개발 gateway 8197): 홈 기본 탭 회화·새 회화 · 방 IDLE·탭 숨김·PTT 72×72 · **360/390/412 가로 넘침 0·터치 ≥44px(대화 전·후)** · 상태 흐름 RECORDING→RECOGNIZING→THINKING→SPEAKING→IDLE · 손 뗌→첫 재생(클라 관측) 2.1~2.9s · 재생 문장 강조·이름 줄 "말하는 중" · 청크마다 최종 200 audio/wav · ▶ 다시 듣기(#23)·▶ 내 목소리(#21b) 상태 문구 · 글자 모드 전환·원문 그대로 보냄 · 글자 턴 답도 소리 · **barge-in: 재생 중 누름 → RECORDING 25~28ms**, 남은 청크 자동재생 없음 · **교정 카드 즉시 1장·카운터 숨김·원문 바이트 그대로** · 화면·aria 엔진명 0 · DOM 속성 서명 URL 0 · 콘솔 서명 URL·엔진명 0 · 콘솔 오류 0(청크 404 재시도 제외). 채팅 회귀(브라우저): `?tab=chat` 채팅 탭 · TALK↔CHAT 경로 교차 진입 시 제자리로 replace · 채팅 보내기→답 · 채팅에 회화 요소 0·표현 점검 유지 · 메뉴 문구(채팅 삭제 / 회화 삭제·들려주는 방식 3개) · 콘솔 오류 0.
- [03:55] 커밋 `23b984d`(B 파일만 경로 지정 52개 — CLAUDE.md·vault 이력서/로그·A 파일 미포함, push 안 함).
- [03:52] 정리: QA 계정(qa-bot) E2E 발화 행 7·wav 7 삭제(내 실행분 — 02:46·03:33~03:40 KST, 채팅은 스크립트가 지움), dev 3012·gateway 8197 PID 로 종료 → next 워커·**대기 예열 `claude --print` 1개 포함 자식 0**, 포트 LISTEN 0.

**정본과 다르게 한 것**
1. 상태 줄은 `<p>` 가 아니라 `<div id="talk-status">`(레벨 미터가 div — 수화 오류).
2. `clientTimings`·`TurnAudioEvent` 는 A 의 `types/talk.ts` 를 재수출해 쓴다(§9-4 는 `types/chat.ts` 에 새로 두라고 했음 — 중복 방지).
3. 409 `UTTERANCE_USED`·`UTTERANCE_EXPIRED` 두 사유와 문구를 UnsentBar 에 추가(§9-8 ⓒ 표에 없던 줄): "이 말은 이미 보낸 것 같아요. 대화를 확인하고, 다시 보내면 글자로 보내져요." / "녹음한 지 오래돼 목소리는 붙이지 못해요. 다시 보내면 글자로 보내져요."
4. #24 청크 받기 404 재시도(§9-4 는 "404 → 그 청크 건너뜀") — 위 서버 경합 때문. 재시도가 끝나도 404 면 설계대로 건너뜀 + 표시등 신호.
5. `Toast` 에 `bottomPx`(기본 84) 추가 — 음성 입력 바가 116px 라 토스트가 버튼을 덮었다(회화방 136px).
6. `MessageList` 에 `followContent`(내용 ResizeObserver) 추가 — 문장이 드러나거나 교정 카드가 붙을 때 바닥에 있던 경우 따라간다(§3 스크롤 규칙의 "새 메시지" 에 청크·카드 성장을 포함).
7. `useChatTurn.restoreText(text, info?)` 에 거절 사유(status·details)를 싣는다 — UnsentBar 문구·버튼용(채팅은 두 번째 인자를 무시).

**한계·후속(Leader 판단)**
1. **[서버 — A] MISS 청크 #24 즉시 404 경합**: `audio` 이벤트를 `TtsCache` 행 커밋 뒤에 내보내거나(#24 가 캐시 파일을 직접 읽거나) 해야 한다. 클라 재시도로 소리는 살렸지만 MISS 첫 청크의 재생이 0.6~1.4초 늦다 — 완료 기준 7(서버 첫 audio 수신 ≤4.0s)은 이벤트 기준이라 이 지연이 안 잡힌다. 실측은 A 의 dev 서버 코드(6d8b3b1) 기준.
2. **[인프라] 개발 dev 서버의 웹 STT**: 개발 티켓 wsUrl 이 DB connection(운영 gateway 8100)을 가리키고 운영 gateway 는 운영 Origin 만 허용 → dev 서버 화면에서 푸시투토크가 `연결 준비에 실패했어요`(TICKET/UNAUTHENTICATED)로 끝난다. QA 는 이 스크립트처럼 개발 gateway + `--ws-rewrite` 로 돌려야 한다(운영 도메인 화면은 영향 없음).
3. 합성 테스트 음성은 인식기가 틀린 활용을 바로잡아 적는다(行くました → 行きました) — 음성 턴 교정은 인식 결과에 달렸고, 교정 카드 즉시 표시는 글자 턴(같은 done 경로)으로 확인했다. 사람 목소리 실측은 003f.
4. 가짜 마이크 파일은 누를 때마다 처음부터가 아니라 이어서 재생된다 — 두 번째 음성 턴은 무음이라 barge-in 은 글자 턴 답의 재생 중에 음성 모드로 돌아가 눌러 확인했다(같은 onPress 경로).
5. TEXT_ONLY(자막만) 화면·AUDIO_TEXT_MISMATCH 화면은 라이브로 못 봤다(M4 공유·재현 불가) — 큐 단위 테스트(abortTurn·재생 중 끊기)와 코드 경로로만. 자동재생 차단(AutoplayBar)도 헤드리스에선 재현되지 않아 큐 테스트(blocked→resumeBlocked)로만.
6. 격리 복제본 `~/.node-local/thekaiwa-b`(node_modules 하드링크)는 남겨 둠 — 필요 없으면 지워도 된다.

## Reviewer 기록

### REV-014 (2026-09-28, 서버 6d8b3b1 기준)

**판정: PASS_WITH_NOTES** (Critical 0 · High 0 · Medium 3 · Low 5) — 화면(B)은 범위 밖, 별도 REV.

**검증 방법**: `git diff e2d7771 6d8b3b1` 전 파일(52개) + `git show 20ff3e7` 정독. api-contract.md/domain-model.md/module-dependency.md/speech-platform 16§6 대조. 커밋 `6d8b3b1` 을 스크래치 디렉터리에 `git archive` 로 추출(B 의 미커밋 작업과 분리) 후 `node_modules` 하드링크·`tsc --noEmit`·`node --test`·`eslint` 독립 재실행으로 A 의 자체 보고를 검증.

**독립 재실행 결과**(B WIP 제외, 6d8b3b1 단독):
- `tsc --noEmit` exit 0.
- `node --test`(45 파일) — **315 pass / 0 fail**(A 보고 "354/354" 와 수치가 다름 — 이력서 시점 이후 카운트 방식 차이로 보이나 실패 0 은 재확인됨, 아래 Low-5).
- `eslint` 신규/변경 핵심 파일 13개 — 0 error/warning(module-dependency import 경계 자동 검증 포함).
- `grep` 로 이번 diff 전 파일에서 엔진명 노출 재검사 — `engine/adapters`·`engine/llm`(내부) · 테스트 픽스처(`task007.test.ts` 의 "Claudeです" IDENTITY 필터 검증용 입력, `task006.test.ts` 의 부정 검증) 외 노출 0건.

#### Medium

1. **`speech-platform/16-tts-productization-layer.md` §6.1·§6.2 와 실제 배치가 어긋났고 정본이 갱신되지 않음**
   - `component`: `src/modules/conversation/orchestrator/{turnAudio.ts,sentences.ts}` vs `docs/design/speech-platform/16-tts-productization-layer.md:190-206`
   - `risk`: Sentence Detector·TtsChunkScheduler 는 정본에 `speech/tts/chunkScheduler`(L4) 소유로 못박혀 있다. 실제로는 `conversation/orchestrator`(L2)에 구현됐다. A 가 이력서 "정본과 다르게 한 것 #1"에 사유(LLM 스트림을 바로 끊어야 하고 conversation→speech import 가 금지라서)를 남겼고 근거는 타당하다 — `structuredResponse/schemas.ts` 의 `conversation.replyJa` 경로 지식은 conversation 소유 개념이라 speech 가 몰라야 하고, LLM 스트림은 conversation 만 접근 가능(`engine.llm` 파사드를 speech 는 import 할 수 없다 — module-dependency §3-1). eslint 로 6층 import 방향 위반은 0건 확인(자동 검증됨). 다만 이건 "규칙 위반"이 아니라 "정본 문서와 코드의 불일치"이고, 정본은 여전히 옛 배치를 가리킨다 — 다음 세션이 speech-platform/16 을 읽고 재구현을 시도하거나, 다른 developer 가 "왜 TtsChunkScheduler 가 없지"라고 헤맬 수 있다.
   - `evidence`: `speech-platform/16-tts-productization-layer.md:190-194`(Sentence Detector `speech/tts/chunkScheduler/sentenceDetector` 명시) vs `turnAudio.ts:1-16`(conversation 소유로 구현, 사유 명시).
   - `recommendation`: Leader 가 이 배치를 승인한다면 speech-platform/16 §6.1·§6.2 에 "task-007 구현 확정: LLM 스트림 판독·문장 스케줄링은 conversation/orchestrator, 문장 1개 합성만 speech/tts(turnSpeaker)" 각주를 추가해 정본을 코드에 맞춘다(task-006 이 api-contract 를 그렇게 갱신한 전례와 동일 패턴). module-dependency.md §3-1 표에도 "TALK 청크 스케줄링은 예외적으로 conversation 소유" 한 줄을 남길 것.

2. **"수락 거절 시 LLM abort·행 0·이벤트 0" 경로에 자동화 회귀 테스트가 없음**
   - `component`: `src/modules/conversation/orchestrator/index.ts:339-372`(`startTurn` 의 gate→LLM 선행 시작→accept 실패 시 `run?.abort()`)
   - `risk`: 코드 추적으로는 정확해 보인다(gate 가 accept 보다 먼저 실행돼 던지면 `acceptTurn` 자체가 호출되지 않아 행이 생기지 않고, `run.abort()` 가 `AbortController` 로 `claudeCli` 자식을 SIGTERM/SIGKILL 하며, `early`(`EarlyEmitter`) 는 `open()` 이 불리지 않으면 버퍼가 그냥 버려져 SSE 로 나가지 않는다 — `stream` 자체도 호출자에게 반환되지 않는다). 하지만 이 인터리빙(gate 통과 후 accept 자체가 409/404 로 거절되는 경합, 즉 "선행 LLM 이 이미 떠 있는데 accept 가 실패")을 검증하는 unit/live 테스트가 하나도 없다 — `task007.test.ts`(conversation)는 `TurnAudio` 단위 테스트만, `tests/live/task007-smoke.ts`E3 의 "행 0" 라벨도 실제로는 DB row count 를 재는 게 아니라 HTTP 404 만 확인한다(그 케이스는 gate 단계 거절이라 애초에 `acceptTurn` 호출 자체가 없어 architecturally 0 이 보장되지만, "accept 트랜잭션 자체가 실패하는" 케이스는 다르다). 회귀 시 조용히 깨질 수 있는 지점이다.
   - `evidence`: `orchestrator/index.ts:355-364`(`try { ... accepted = await acceptTurn(...) } catch (e) { run?.abort(); acceptedReject(e); releaseTurnLock(lock); throw e }`), `tests/live/task007-smoke.ts:226-230`(E3 라벨은 "행 0" 이라 쓰지만 assert 는 `status===404` 뿐).
   - `recommendation`: `acceptTurn` 이 예열된 LLM 이 이미 떠 있는 상태에서 CONFLICT(409, 동시 턴)로 실패하는 케이스를 unit 테스트로 추가(가짜 `run.abort` 스파이로 정확히 1회 호출됐는지, `acceptedPromise` 가 reject 됐는지, speaker 콜백이 실제 TTS 를 호출하지 않았는지 확인). QA 인계 시 이 경로를 수동 확인 항목으로 전달.

3. **사용자당 턴 락을 `done`(그리고 이제는 TTS 완료) 이전, "저장 직후"에 푸는 결정의 파급 범위가 문서화된 것보다 넓어짐**
   - `component`: `orchestrator/index.ts:383-386`(`release()` 가 `saveTurn` 직후, `await audio.settled()` 이전에 호출)
   - `risk`: 이 자체는 A 가 "정본과 다르게 한 것 #4"로 명시했고 사유("클라는 done 뒤에 보내므로 영향 없음")도 합리적이다. `tryAcquireTurnLock` 이 `userId` 단위(채팅 단위 아님) 전역 락이라는 점까지 확인했다 — TALK 이전에는 락 해제~`done` 방출 간격이 사실상 0(동기)이었지만, 이제 TALK 턴에서는 그 간격에 TTS 합성(수 초)이 들어간다. 잘 동작하는 클라이언트는 `done` 을 받은 뒤에만 다음 턴을 보내므로(§9-11 설계) 문제가 없지만, **같은 사용자의 다른 세션/탭/기기**가 그 수 초 창에 다른 채팅으로 새 턴을 보내면 이제는 409 없이 통과해 두 턴이 동시에 LLM/TTS 를 쓰게 된다. 데이터 손상은 없다(각자 자기 `assistantMessageId` 행에만 쓴다)고 판단했지만, CLI 큐(동시성 1)·M4 TTS 자원 경합을 유발할 수 있다.
   - `evidence`: `orchestrator/locks.ts:24-29`(`locks.has(userId)` — 채팅 단위 아님), `orchestrator/index.ts:383`(`release()` 위치).
   - `recommendation`: QA 가 같은 계정 다중 탭으로 "TALK 턴 진행 중(오디오 스트리밍 중) 다른 채팅에서 새 턴 시작" 시나리오를 1회 이상 수동 검증하고, 서버 리소스(CLI 큐 대기시간·M4 응답시간) 이상 없음을 확인. 의도된 트레이드오프이므로 코드 수정 요구는 아님 — 기록만 요구.

#### Low

4. **`appendTraceSteps` 가 read-modify-write 방식이라 같은 traceId 에 대한 동시 append 사이 경합 가능성** — `engine/trace/index.ts:68-82`. 두 `PLAYBACK` 보고가 같은 traceId 에 거의 동시에 오면 하나가 유실될 수 있다(계측 손실일 뿐 데이터 무결성 문제 아님). 낮은 빈도(한 traceId 당 PLAYBACK 은 통상 1회)라 그대로 두어도 무방하나, 인지 기록.
5. **`node --test` 실측(315/0) 이 이력서 기재 "354/354" 와 다름** — `agent-vault task-007:153`. B 가 이후 테스트 파일 3개(`turnAudio.test.ts`·`ttsClientBoundary.test.ts`·`ttsPlaybackQueue.test.ts`)를 추가해 현재 워킹트리 카운트가 커졌을 가능성이 높다(이번 REV 범위 밖). 실패는 0 으로 A 산출물 자체는 문제 없음 — 기록 목적의 지적.
6. **`speech/tts/synthesize.ts` catch 블록에서 `TtsEngineError` 에 `steps`(하위 Trace, `connectionKey` 포함)를 실어 `createTurnSpeaker` 로 전달** — `synthesize.ts:302`. `turnSpeaker.ts`→`turnAudio.ts` 경유로 `recordTrace`(관리자 전용) 에만 들어가고 SSE `audio` 이벤트에는 안 실리는 것을 코드로 확인했다(U5 준수). 다만 이 경로가 하나 더 생겨 향후 누군가 실수로 SSE 페이로드에 `steps` 를 얹을 위험 표면이 넓어졌다 — 타입 수준에서 `TurnSpeechResult.steps` 를 "관리자 전용" 이라고 명시한 주석 외에 강제 수단은 없다.
7. **`learnerBaseCache` 축출이 `Map.keys().next().value`(가장 먼저 삽입된 키, 진짜 LRU 아님)** — `turnContext.ts:56`. 500명 상한에서 최근 사용 여부와 무관하게 삽입 순으로 내려간다. 영향은 캐시 미스 증가뿐(정확성 문제 없음).
8. **테스트 라벨 정확성** — `tests/live/task007-smoke.ts` E3 라벨 "타인 utteranceId → 404(행 0)" 가 실제로는 행 수를 재지 않는다(위 Medium-2 참고, 같은 근거라 별도 조치 불필요하나 라벨 정정 권고).

#### Codex C1 판정(Leader) 확인

Leader 의 C1-1/C1-2/C1-3 판정문이 실제 구현과 일치하는지 코드로 재확인했다:
- **C1-1(서명 URL)**: 구현이 판정문 그대로다 — `audioUrl.ts` payload `{k,e}` 만, userId 는 MAC 입력에만, HKDF 파생 키(세션 JWT 서명 키와 다름 — `JWT_SECRET` 직접 재사용처(`session.ts`·`scopedToken.ts`·OAuth state/pending)와 대조해 `deriveSubkey` 가 실제로 다른 키를 내는 것을 확인), `timingSafeEqual`. 테스트(`speech/__tests__/task007.test.ts`)로 직접 커버됨. **일치**.
- **C1-2(utteranceId 재사용/경합)**: 판정문의 "부분 채택"(스키마 변경 보류 + 코드 검사) 그대로 구현됨 — `checkUtteranceForTurn`(수락 전 404/409×2) + `linkUtteranceToMessage`(조건부 updateMany) + 사용자당 턴 락(이중 방어). `domain-model.md` 미결 사항 #17 에 스키마 제안이 정확히 기록됨. **일치**.
- **C1-3(조기 TTS 선노출)**: 판정문의 경로 인식 토크나이저(정규식 아님) + 최소 안전 필터가 그대로 구현됨(`jsonPathStream.ts`·`earlyFilter.ts`). `runtime.earlySentenceTts` 로 끌 수 있는 것도 확인. **일치**. 잔여 위험(검증 전 문장 1~2개 소리 노출)은 Leader 가 이미 수용했고 재론하지 않는다.

#### 우선 감사 항목별 요약

1. **6층 경계**: `eslint` 0 error 로 확인. conversation↔speech 상호 import 0(라우트가 훅으로 조합, `TurnHooks.speaker`/`gate`/`onAccepted` 구조적 타입으로 우회 없이 조합). 엔진명·connectionKey·model 사용자 응답(SSE `audio`/`done`/#23/#24/#29) 0 확인 — 코드 재검토 + smoke 테스트(`!LEAK.test(...)`) 둘 다.
2. **예열 CLI 풀**: 프로세스당 1요청(stdin 닫힘으로 세션 불가) 확인. 상한·TTL·죽은 프로세스 폐기·cold 폴백 모두 구현·테스트됨. 종료 훅(`exit`/`SIGTERM`/`SIGINT`) 이 대기+실행 중 자식 모두 kill. stdin argv 노출 없음(프롬프트는 stdin 으로만). env 누출 — `cleanEnv` 가 `SPEECH_INTERNAL_SECRET`·`DATABASE_URL`·`JWT_SECRET` 등 시크릿을 자식 env 에서 제거하는 것 확인(claudeCli.ts:280-296 목록에 이번 diff 로 추가된 항목 없음 — 기존 목록 그대로 재사용). 대기 중 비용 0(A 실측 + 코드상 `/v1/messages` 미호출 경로 확인). Medium-3 참고.
3. **조기 추출**: 경로 인식(최상위 `conversation.replyJa`/`speech.style` 만, 이스케이프·중첩 문자열 흉내 무시) 코드 검증 완료(상태기계 직접 추적). 안전 필터 C1-3② 그대로. `AUDIO_TEXT_MISMATCH` 시 잔여 청크 폐기 + 이후 이벤트 억제(`this.m.mismatch` 가드) 확인. 키 순서 불이행 시 폴백 — `talkInstruction` 지시 불이행해도 `jsonPathStream` 은 경로 기반이라 순서 무관하게 동작(`task007.test.ts` "키 순서가 달라도" 테스트로 확인). 12s fail-fast 와 조기 음성 상호작용 — `TurnStream.emit()` 이 `finished` 가드로 `error`+`finish()` 이후 도착하는 late audio 이벤트를 무조건 드롭하는 것을 확인(이론상 가능한 "audio가 error 뒤에 클라로 전달" 은 이 가드로 차단됨) — A 의 실측(감사 뒤 audio, 그 뒤 error) 과도 일치.
4. **수락 tx 와 LLM 병렬 시작**: Medium-2 참고 — 로직은 정확해 보이나 이 정확한 인터리빙에 대한 자동 테스트가 없다. 락 순서(`lockUserRow`→채팅 행 `FOR UPDATE`)는 기존 패턴 유지, 신규 교착 경로 없음. resumePending 경로는 `hooks.speaker` 만 남기고 `gate`/`onAccepted` 재실행 안 함(발화 재연결 방지, 의도적)을 코드로 확인. 저장 조건부 update(`status:PENDING, createdAt:pendingSince`) 유지 확인.
5. **#24 서명 URL**: 위 C1-1 재확인 참고. `/status` 세그먼트 충돌 없음(Next.js 정적 우선 라우팅, 디렉터리 구조로 확인).
6. **발화 연결**: 소유자·`chatMessageId IS NULL`·10분·409 사유 2종·400(TEXT+utteranceId)·조건부 updateMany·`finalSource=USER` 전부 코드 확인. #21b 이중 방어(행 소유 + 경로 사용자 조각 대조) 확인. 30일 만료·경로 탈출(`AUDIO_PATH` 정규식으로 `../` 등 차단) 확인.
7. **LLM 계약**: talk@v2 프롬프트 캡 준수는 PE 가 시뮬레이션+단위테스트로 검증한 것을 재확인(코드 스캔으로 `TALK_USER_PROMPT_CAP` 로직 자체는 이번 diff 로 변경되지 않음 확인). 스키마 키 순서 재배치는 검증 의미와 무관함을 ajv 특성상 확인(순서는 JSON Schema 로 표현 불가 — `required` 배열 순서도 검증에 영향 없음). 원문 바이트 일치 검사(`checks.ts`, `shape.ts`)는 이번 diff 로 손대지 않음 확인(git diff stat 에 없음).
8. **계측·로그**: Trace/toolLog 원문·전사·응답 전문 0 — 모든 신규 step(`STT`·`ACCEPT`·`LLM`·`PARSE`·`SAVE`·`TTS[i]`·`PLAYBACK`·`UTTERANCE_LINK`) 의 meta 를 하나씩 대조해 숫자·짧은 코드값만 있는 것을 확인. `console.warn`/`console.info` 도 메시지 전문이 아니라 이름/길이만 로그. `clientTimings` 0~120000 범위 검증(`validate.ts`) 확인.
9. **테스트 충분성**: 독립 재실행 315/0 확인(Low-5). 신규 커버리지(예열 풀 9건·jsonPathStream·조기/최종 경로·필터·TEXT_ONLY·FAILED 등) 충분. Medium-2 의 경합 시나리오만 공백.
   **사용자 결정 4건 의견**: ① NAS fsync 설정은 공유 인프라라 코드 밖 에스컬레이션 타당, 동의. ② 예열 RSS 265MB 는 `prewarmMaxIdle=2` 기준 최대 ~0.8GB 로 Leader 가 ecosystem.config.js 메모리 한도를 재확인해야 함, 동의(QA 인계). ③ `Utterance.chatId`+`chatMessageId @unique` 스키마 제안은 지금 코드 방어(조건부 update + 사용자당 턴 락)로 C1-2 위험이 실질적으로 낮아 이번 db push 는 보류해도 무방하나, 애디티브 컬럼이라 다음 스키마 변경 창에 포함 권고. ④ CLI 구독 한도 오류가 `exit=1 stderr 없음` 으로만 남는 문제는 운영 관측성 개선으로 후속 task 제안 적합, 급하지 않음.

#### QA 인계 — high_risk_areas
- `orchestrator/index.ts` 의 accept-vs-LLM 병렬 경로(동시 턴 409 유발 후 LLM 자식 프로세스가 실제로 종료되는지 `ps` 로 확인 권고)
- 같은 계정 다중 탭에서 "TALK 턴 오디오 스트리밍 중 다른 채팅 새 턴 시작" 수동 시나리오(Medium-3)
- 예열 프로세스 메모리(`prewarmMaxIdle=2` 기준 pm2 한도 대비 여유) — task-009 blue/green 전 확인
- `#24`/`#21b`/`utteranceId` 404·409 코드 경로(자동화 테스트 다수 존재 — 회귀 위주로만 재확인)
- TEXT_ONLY 실경로(M4 중지) 는 A 도 라이브로 못 봄 — QA 가 M4 중지 상태에서 1회 이상 회화 턴 확인 권고

`native_change`: false.

### REV-015 (2026-09-28, 화면 23b984d + 수정 de48fe3)

**판정: PASS** (Critical 0 · High 0 · Medium 0 · Low 4)

**검증 방법**: `git show --stat`/`git diff 6d8b3b1 23b984d`(B, 52파일) · `git show de48fe3`(A 수정, 13파일) 전량 정독 + `docs/screens.md` §9(9-0~9-11) 전체 재대조. 독립 재실행은 REV-014 와 같은 `git archive` 스크래치 방식 2벌 — `~/.node-local/thekaiwa-revcheck-b`(23b984d 단독, node_modules 는 운영 미러에서 하드링크) · `~/.node-local/thekaiwa-revcheck-full`(de48fe3 = B+A 수정 결합 상태). 둘 다 pm2 운영 미러(`~/.node-local/thekaiwa`)는 건드리지 않았다(파괴적 명령 사전 고지 절차 준수).

**독립 재실행 결과**:
- 23b984d 단독: `tsc --noEmit` exit 0 · `eslint src` 0 error(경고 5 = 기존 파일, 아래 Low-1) · `node --test`(전체) **360 pass / 0 fail**.
- de48fe3(B+A 결합, = 현재 `main` 1648cc0 의 코드 상태와 동일): `tsc --noEmit` exit 0 · `eslint src` 0 error(경고 5, 동일) · `node --test` **367 pass / 0 fail** — **A 보고 "367/367" 를 독립 재확인**(REV-014 Low-5 가 지적한 315→354→360→367 수치 변화는 B 가 이후 테스트 파일을 계속 추가했기 때문이며, 실패 0 은 매 단계 일관됨을 확인했다).
- `grep -rniE "reazon|whisper|style-bert|claude|sonnet|opus|haiku|qwen|sherpa" src/components/talk src/modules/speech/tts/client` — 0건(주석·코드 전부).
- `grep -rn "console\." src/components/talk src/modules/speech/tts/client` — 0건. `grep -rn "<audio\|new Audio("` — `ttsAudio.ts`(기존 §7 코드, blob object URL 전용, revoke 확인됨) 1건뿐, 회화방 신규 코드에는 0건.

#### 1. B(화면) — 중점 항목별 확인

- **6층·eslint 경계**: `eslint.config.mjs`(diff) 가 `src/modules/speech/tts/client/**` 에 `stt/client` 와 대칭인 별도 블록을 추가 — 화면(`^@/(app|components)/`) 0, 다른 모듈(`^@/modules/`) 0, 상위 경로는 `../sentences` 만 허용(정규식 `^\.\.(/(?!sentences$)|$)`), 서버 전용 패키지(`node:`·`@prisma/`·`next/server`·`jsonwebtoken`·`jose`) 0. `components/**` 허용 하위 진입점에 `tts/client` 를 추가(`stt/client` 와 같은 패턴). **이중 확인**: `speech/__tests__/ttsClientBoundary.test.ts` 가 실제 소스를 정규식으로 파싱해 import 목록을 뽑아 화이트리스트와 대조하고(트리비얼하지 않음, `index.ts`/`playbackQueue.ts` 파일 존재까지 확인), `../sentences` 자체도 import 0(순수)임을 별도 assert. `modules/speech/tts/client/index.ts` 는 `createTtsPlaybackQueue`+타입+`splitSentences` re-export 뿐, `playbackQueue.ts`(646줄)는 `fetchAudio`·`play`·`onSignal`·`now`·`setTimer`·`clearTimer` 전부 주입(DOM·오디오 API 를 import 하지 않음, 코드 전체 정독으로 확인) — **컴포넌트 → `stt/client`·`tts/client` 클라이언트 안전 진입점만** 원칙 충족.
- **엔진명·model·connectionKey·서명 URL 토큰 노출**: 위 grep 결과 0건. `TalkRoom.tsx:820` 의 `data-talk-state={view.state}` 는 `IDLE|RECORDING|RECOGNIZING|QUEUED|THINKING|SPEAKING` 열거값만(E2E `ENGINE_RE` 도 같은 값 검사). `playbackQueue.ts` 는 `AUDIO_URL_PREFIX`(`/api/v1/speech/tts/`)로 시작하지 않는 `url` 을 아예 슬롯에 담지 않는다(`push()` 내부 `url = ... startsWith(AUDIO_URL_PREFIX) ? c.url : null`) — 서버가 다른 모양의 URL 을 보내도 큐가 fetch 대상으로 쓰지 않는다(§9-11 ⑪ 그대로 구현).
- **`deriveTalkState`(`talkState.ts:45-89`) 상태 머신**: §9-3 A 판정 순서(RECORDING→RECOGNIZING→QUEUED→SPEAKING→THINKING→IDLE)·각 행의 `ptt.disabled`·`keyboardDisabled`·`showStop`·상태 줄 문구를 표와 1:1 대조 — 전부 일치. SPEAKING 의 PTT `disabled` 는 표에 없는 조건(`sttPhase==='unavailable'` 일 때만 true)을 추가했는데, 마이크 자체가 막힌 상태에서 barge-in 을 눌러도 녹음이 시작될 수 없다는 합리적 방어이지 표 위반이 아니다. 115개 단위 테스트(`talkState.test.ts`)로 전 행 고정, 독립 재실행에서도 통과 확인.
- **자동 전송**: `TalkRoom.tsx:352-375` `onFinal` — trim 후 코드포인트 ≤1 이면 힌트만 띄우고 리턴(요청 0), 그 밖엔 `turn.isBusy()` → QUEUED/UnsentBar, 아니면 디바운스·확인 없이 곧바로 `sendOutgoing`(§9-9 "화면 지연 0" 항목대로 `setTimeout` 등 인위적 대기 없음 — 코드 추적으로 확인). QUEUED 항목은 `onSettled('done'|'error')` 에서 `setTimeout(…, 0)` 으로 컨트롤러가 idle 로 돌아간 **다음 틱**에 보낸다(같은 SSE 콜백 안에서 새 턴을 열지 않기 위한 스케줄링이며 추가 지연이 아니다).
- **`TtsPlaybackQueue`(`playbackQueue.ts`)**: `chunkIndex` 순 재생·동시 2 받기(`FETCH_CONCURRENCY=2`, 낮은 index 먼저)·`FAILED`/받기 실패 건너뜀(`t.next++`)·`endTurn` 뒤 빈틈 건너뜀(라인 318-326 `finishTurn`)·`pauseBeforeMs`(첫 청크 0, `t.next>0` 조건)·`interrupt('BARGE_IN')` 이 `turn.autoplay=false` 로 두고 받기는 계속(그 턴 청크는 버리지 않음, §9-3 D 그대로)·`abortTurn`(AUDIO_TEXT_MISMATCH)은 현재 재생까지 즉시 멈추고(`stopCurrent`) `forget()` 으로 보관본까지 지움·`blocked→resumeBlocked`·새 턴이 다시 듣기를 이김(라인 338-342)·LRU 20/8MB(`RETAIN_MESSAGES`/`RETAIN_BYTES`, `evict()`). 20건 단위 테스트로 커버, 독립 재실행 통과. `dispose()` 가 `useTalkPlayback.ts:81-83` 의 언마운트 cleanup(`visibilitychange` 리스너 제거 + `queue.dispose()`)에서 호출됨을 확인 — 메모리 누수 없음.
- **409 `UTTERANCE_USED`/`UTTERANCE_EXPIRED` 처리(중점 판단 요청)**: `TalkRoom.tsx:243-249` 에서 이 두 사유만 `utteranceId: null` 로 바꿔 `UnsentBar` 에 담는다(다른 409·429·400·0·detached 는 원래 `utteranceId` 유지). **합당하다고 판단**: A 의 "B 용 계약 요약"(이력서 §213)이 이미 "409 `details.reason` `UTTERANCE_USED`\|`UTTERANCE_EXPIRED`(→ 글자 턴으로 재전송 권장)"라고 명시했고, 이 두 사유는 재시도해도 서버가 같은 id 로는 절대 통과시키지 않는 상태(이미 다른 메시지에 연결됨·10분 초과, `checkUtteranceForTurn` 이 매번 다시 거절)라 **§9-11 ⑧ "같은 id 재전송 허용"은 애초에 이 두 사유에는 적용되지 않는다** — A 의 계약이 ⑧ 의 예외를 이미 규정했고 B 가 그 예외만 정확히 구현했다(`resendUnsent` 호출 시 `utteranceId=null` 이므로 `inputSource:'TEXT'` 로 나감, `TalkRoom.tsx:707-717`). §9-8 ⓒ 표에 없던 두 문구를 B 가 추가했다고 스스로 밝힌 것(정본과 다르게 한 것 #3)도 정확히 이 지점이며, 문구("다시 보내면 글자로 보내져요")가 동작을 사용자에게 정확히 알린다. 결함 아님.
- **`clientTimings` 5필드**: `timings.ts`(`buildClientTimings`) + `talkCopy`/`useTalkPlayback` 조합으로 `sttMs`(이번 턴만)·`prevMessageId`·`firstAudioAtMs`·`playbackStartDelayMs`·`releaseToFirstAudioEventMs` 를 다음 턴 요청에 싣는다. §9-11 ⑤ 에서 Leader 가 승인한 이름 그대로이고 A 의 서버측 검증(0~120000, 밖이면 400)과 필드명이 일치함을 타입(`talk.ts` 재수출)으로 대조.
- **aria-live**: `MessageList.tsx:256` `aria-live={liveOff ? 'off' : 'polite'}`, `TalkRoom.tsx:841` 에서 `liveOff={view.state === 'RECORDING'}` 로 넘김 — §9-0 ⑨ 그대로. 녹음 중 토스트 지연(`notify`, `recordingRef` 가드) 확인.
- **360/390/412·터치 44px·PTT 72px**: `VoiceBar.tsx` 의 `h-11 w-11`(44px, ⌨·■)·`PushToTalkButton`(§8 기존 72px 컴포넌트 그대로 재사용, 새로 구현하지 않음) 확인. Playwright E2E(`tests/live/task007-ui-e2e.mjs`) 가 세 폭 `scrollWidth===innerWidth`·모든 상호작용 요소 ≥44px·PTT 정확히 72×72 를 실제로 assert 하는 코드임을 스크립트 정독으로 확인(트리비얼한 항등식이 아니라 실제 `getBoundingClientRect` 비교) — **다만 이 E2E 자체는 라이브 dev 서버·별도 gateway·M4 가 필요해 독립 재실행하지 않았다**(Reviewer 는 기능/라이브 테스트를 실행하지 않는다 — QA 위임, 아래 인계 참고). B 의 자체 보고(40/40 PASS)는 스크립트 내용이 신뢰할 만하다는 근거로만 삼았다.
- **⑫ 기존 결함 4건이 CHAT 을 깨지 않는지**: `useChatTurn.ts` diff 전체 정독 — `send(text, opts?)` 의 `opts` 는 전부 optional·기본값 `{}`, 새 콜백(`onAccepted`/`onAudio`/`onWarning`/`onDone`/`onSettled`)은 전부 `d.xxx?.()` 로 CHAT 라우트(옵션 미전달)에서는 호출되지 않는다. `busy` 분기가 조용한 무시 대신 `restoreText(text, {status:409,...})` 를 호출하도록 바뀌었지만 CHAT 쪽 `restoreText` 콜백은 `info` 파라미터를 무시하는 기존 시그니처 그대로(`ChatRoom.tsx` 는 이 diff 에 없음 — CHAT 쪽 훅 사용처 미변경). `dropTemp` 가 `why` 를 항상 받도록 바뀌었지만 모든 호출부(`onError`·`rejected`·`lostBeforeAccept`)가 다 갱신됨을 확인, 특히 `rejected()` 의 404/409/429 분기 재구성이 기존 순서(429 먼저 처리 후 return)를 그대로 보존하면서 `dropTemp` 호출 위치만 옮겨졌음을 라인 단위로 대조 — 회귀 없음. 독립 테스트(367/367, CHAT 관련 기존 스펙 포함)로도 확인.
- **TALK↔CHAT 상호 리다이렉트**: `ChatRoom.tsx`(`detail.chat.kind==='TALK'` → `router.replace('/study/ai/talk/'+id)`) ↔ `TalkRoom.tsx:420-423`(`kind!=='TALK'` → `/study/ai/chat/'+id`) 양방향 확인.
- **`chunkFetch.ts` 404 재시도**: `CHUNK_RETRY_MS=[250,500,750,1000,1500]`(합 4000ms, 5회 상한) · **404 만** 재시도, 그 밖 오류·`signal.aborted` 는 즉시 던짐(무한 대기·과도한 대기 없음) · `sleepAbortable` 이 `AbortSignal` 리스너를 매번 `removeEventListener` 로 정리(타이머 누수 없음).

#### 2. A(수정, de48fe3) — 중점 항목별 확인

- **보관소가 서명 검증 뒤에만 조회되는지(존재 오라클 0)**: `audioUrl.ts:85-93` `readSignedTtsAudio` — `verifyTtsAudioToken` 이 `null` 이면 **그 즉시 return null**(87행), `recallRecentAudio` 호출(88행)은 검증 통과 뒤에만 실행된다. 서명이 틀린 요청은 보관소를 들여다보지도 않으므로 "방금 합성된 오디오가 있는지"를 서명 없이 알아낼 방법이 없다 — 확인됨.
- **사용자 결속**: `recentAudio.ts` 의 키는 `cacheKey`(12요소 캐시 키, 내용 해시)뿐이고 `userId` 를 모른다. 이것이 안전한 이유: ① 토큰의 HMAC 이 `userId` 를 MAC 입력에 넣으므로(`audioUrl.ts:25` `mac(userId,k,e)`) 다른 사용자가 같은 `cacheKey` 에 대한 유효 토큰을 스스로 만들 방법이 없다(자기 것이 아니면 서명 검증에서 걸러짐, 검증 자체가 요청 세션 사용자로 MAC 을 재계산) ② `cacheKey` 는 정규화 텍스트·화자·모델·사전 버전·스타일 등으로 정해지는 **내용 해시**이지 사용자 식별값이 아니다 — 같은 문구·같은 목소리 설정이면 서로 다른 사용자도 같은 TTS 오디오를 듣는 것이 기존 `TtsCache`(003d) 설계부터 의도된 동작(캐시 공유)이라 `recentAudio` 가 `userId` 없이 `cacheKey` 만으로 서빙하는 것은 기존 캐시 정책을 그대로 연장한 것이지 새 노출면이 아니다. **결론: 안전.**
- **메모리 상한·TTL·축출**: `RECENT_AUDIO_TTL_MS=60_000`·`RECENT_AUDIO_MAX_ENTRIES=64`·`RECENT_AUDIO_MAX_BYTES=16MB` — `rememberRecentAudio`(`recentAudio.ts:48-59`)가 매 저장마다 `sweep()`(만료분 제거) 후 개수·바이트 상한을 넘으면 `Map` 삽입 순서(가장 오래된 것)부터 `drop()`. 16MB 초과 단일 항목은 애초에 저장하지 않음(49행).
- **캐시 저장 실패 시 동작**: `readSignedTtsAudio` 는 `recentAudio` 미스면 `readCachedAudio(v.cacheKey)`(DB/파일)로 폴백하므로, `rememberRecentAudio` 가 애초에 안 불렸거나(예외) 60초가 지났어도 정상 경로(파일 커밋 완료 후)로 200 이 나온다 — 캐시 저장 실패가 청크 재생 자체를 막지 않는다(합성 자체가 실패하지 않는 한).
- **turnDeps 주입이 운영 경로를 바꾸지 않는지**: `conversation/orchestrator/index.ts` 의 `startTurn`이 실제 호출부(`app/api/v1/chats/[id]/turns/route.ts`)에서 여전히 기본 `turnDeps`(진짜 Prisma·진짜 `completeJson`)를 쓰고, 테스트만 `mock.method(turnDeps, 'xxx', …)` 로 프로퍼티를 바꿔치기(모듈 싱글턴 객체의 메서드 교체이지 별도 구현체 주입이 아님) — 라우트 코드 자체는 diff 에 없음(`git diff 6d8b3b1 de48fe3 -- 'src/app/api/**'` 결과 0). 운영 경로 불변 확인.
- **abort 시 자식 프로세스 종료**: `claudeWarm.test.ts` diff(위에서 미리보기 확인, cold 실행 중 abort → `ClaudeCliAbortedError` + 자식 pid 종료 / 예열에서 꺼낸 자식 abort → 종료 + 재충전 / 이미 취소된 요청 → spawn 0)와 `conversation/__tests__/task007.test.ts` 의 신규 테스트 2건(`수락 거절(409)…` · `gate 거절…`)을 직접 읽고 재실행(367/367 안에 포함) — **REV-014 Medium-2 가 지적한 "선행 LLM 이 이미 떠 있는데 accept 가 실패하는" 정확한 인터리빙**을 가짜 CLI·가짜 `turnDeps.acceptTurn`(30ms 뒤 409 CONFLICT)으로 재현해 `llm.aborted===true`·`speakerFactoryCalls===0`·`currentTurnLock(userId)===null` 을 단언한다 — **REV-014 Medium-2 해소를 코드·테스트 양쪽에서 확인**.
- **`console.info('[claudeCli] 취소 …')` 로그**: 경과 시간(ms)·`warm` 상태 문자열만 남기고 프롬프트·응답 전문·시크릿 없음(`claudeCli.ts:721,750`) — Trace/로그 원문 금지 원칙 위반 없음. `warm='HIT'` 를 `runWarm` 호출 **전**으로 옮긴 것도 확인(취소 시 warm 표시 오류 수정, 이전엔 성공 후에만 HIT 로 찍혀 취소 케이스가 항상 OFF 로 잘못 기록됐다).

#### REV-014 Medium 3건 해소 여부

| REV-014 항목 | 해소 여부 | 근거 |
|---|---|---|
| Medium-1 (speech-platform/16 §6.1·§6.2 정본-코드 불일치) | **해소** | 커밋 `88ee777` 이 §6 서두에 "task-007 구현 반영" 각주 추가, 권고안 그대로(대상 배치·사유 명시) |
| Medium-2 (수락 거절 시 LLM abort 경로 자동화 테스트 부재) | **해소** | `de48fe3` 가 정확히 그 인터리빙을 재현하는 단위 테스트 2건 추가(위 확인), 라이브 스모크 E8·E9 도 추가 |
| Medium-3 (턴 락을 `done` 전 "저장 직후"에 푸는 파급 범위) | **의도된 트레이드오프로 유지, 기록 요구만이었음** | REV-014 도 코드 수정을 요구하지 않고 QA 수동 검증만 요구했다 — 이번 REV 대상 파일(B·de48fe3)에 관련 변경 없음. QA 인계 유지(아래) |

#### Low

1. **`ecosystem.config.js` 의 `require()` 스타일 import 2건이 `npm run lint`(디렉터리 전체 대상) 에서 error 로 잡힘** — task-007 diff 에 이 파일이 없음(`git diff 05f0cbb 23b984d -- ecosystem.config.js` 결과 0, task-003e 부터 있던 기존 파일). B 의 "lint 0 error" 는 `src/` 범위에서는 정확하나, `npm run lint` 를 그대로 돌리면 이 2건이 섞여 나온다는 점을 인지 기록. task-007 결함 아님.
2. **`RECENT_AUDIO` 전역 메모리 저장소에 admin Trace/진단 노출 없음** — `recentAudioStats()`(엔트리 수·바이트) 는 테스트 전용이고 관리자 콘솔·헬스체크에 연결되지 않았다. task-009 blue/green 준비 전에 이 새 프로세스 메모리 구조(60초·64개·16MB)를 관측할 방법이 없다는 점을 deployer 에게 참고 전달 권고(기능 결함 아님, 운영 가시성 개선 후보).
3. **`UnsentBar`(`utteranceUsed`/`utteranceExpired`)의 "다시 보내기" 버튼 라벨이 실제로는 "글자로 다시 보내기"에 가까운 동작** — 상태 줄 문구가 "다시 보내면 글자로 보내져요" 라고 미리 알리므로 사용자 오인 위험은 낮지만, 버튼 라벨 자체는 그대로 "다시 보내기"(공용 `UNSENT_BUTTONS.resend`)다. 카피 다듬기 후보일 뿐 기능 결함 아님.
4. **`ttsAudio.ts` 의 싱글턴 `AudioContext` 는 방을 나가도 `close()` 되지 않는다**(기존 §7 코드, 페이지 수명 동안 유지되는 설계) — 회화방에서 반복 입장·퇴장해도 컨텍스트 자체는 재사용되므로 누수는 아니나, task-007 처럼 오디오를 훨씬 자주 재생하는 화면이 생긴 만큼 참고로 기록.

#### QA 인계 — high_risk_areas (REV-014 승계 + 이번 REV 추가)

- (REV-014 승계) 같은 계정 다중 탭에서 "TALK 턴 오디오 스트리밍 중 다른 채팅 새 턴 시작" 수동 시나리오 — 이번 REV 대상 변경 없음, 여전히 미검증.
- (REV-014 승계) TEXT_ONLY 실경로(M4 중지 상태에서 1회 이상 회화 턴) — A·B 모두 라이브로 못 봄, 여전히 미검증.
- (신규) `de48fe3` 의 MISS 청크 즉시 200 수정이 **blue/green 전환 순간**(다른 pm2 인스턴스로 트래픽이 넘어가는 찰나, `recentAudio` 는 프로세스 로컬이라 인스턴스 간 공유되지 않음)에도 클라 재시도(`chunkFetch.ts`)로 소리가 끊기지 않는지 — task-009 첫 blue/green 실전 배포 때 확인 권고(코드는 "창이 1초 안팎이라 수용"으로 설계돼 있고 로직상 타당하나, 실제 blue/green 하에서 관측된 적은 없음).
- (신규) 예열 프로세스 RSS(~265MB/개, `prewarmMaxIdle=2` 기준 최대 ~0.8GB) — `ecosystem.config.js` pm2 메모리 한도 대비 여유를 task-009 전에 재확인(REV-014 도 동일 권고).
- **QA 실행 방법 메모**: 로컬 dev 서버(`npm run dev`)에서 웹 STT 를 켜려면 **운영 gateway(8100)는 운영 도메인 Origin 만 허용**하므로 dev 서버 화면은 기본적으로 마이크 연결이 실패한다(`연결 준비에 실패했어요` TICKET/UNAUTHENTICATED). B 가 쓴 방식을 그대로 따를 것: 별도 개발용 gateway 를 `SPEECH_GATEWAY_ALLOWED_ORIGINS=http://localhost:<dev-port>`·`APP_INTERNAL_URL=http://127.0.0.1:<dev-port>` 로 띄우고(`speech/gateway/run_dev.py --port <gw-port>`), 테스트/브라우저 쪽에서만 WS 주소를 그 포트로 바꿔치기한다(`tests/live/task007-ui-e2e.mjs` 의 `--ws-rewrite` 패턴 참고 — 앱 코드·DB connection 행은 건드리지 않는다). 운영 도메인(`kaiwa.미라클펭귄.com`)에서는 이 문제가 없다. 라이브 스모크·지연 스크립트는 `tests/live/task007-smoke.sh`·`tests/live/task007-latency.sh <port> <n>` 로 재실행 가능(둘 다 QA 계정 쿠키 2개 필요).

`native_change`: false.

### Codex C2 지적 판정 (2026-09-28)

**검증 방법**: `agent-vault/10-Flow/tasks/task-007-talk-voice-web.md`의 `## Codex 검토` §C2 원문 + 원본 raw.txt(`/home/brownjeon/NFS/homes/brownjeon/project/.claude/state/codex-review/runs/20260927T191314Z-task-007-C2/raw.txt`) 재정독 · `src/modules/conversation/orchestrator/turnAudio.ts` 전체 · `src/modules/speech/tts/{profiles,synthesize,turnSpeaker}.ts` · `src/modules/preferences/validate.ts`·`src/app/api/v1/settings/voice/route.ts`·`src/components/settings/VoiceSettings.tsx`·`src/components/talk/SpeechProfileMenu.tsx`(사용자 설정 경로) · `docs/design/speech-platform/{13,16}-*.md`·`docs/design/domain-model.md`(SpeechProfile 정본) · `src/modules/conversation/orchestrator/index.ts`(`audio.settled()` 호출부) · 기존 단위 테스트(`src/modules/conversation/__tests__/task007.test.ts:137-153`) 정독. Read 전용, 코드 미수정.

#### C2-1 (turnAudio.ts:266, SHADOWING·동시 합성·previousDurationMs) → **채택(Medium)**

- **코드 확인**: `turnAudio.ts:236-251` `enqueue`→`pump` 은 `concurrency`(기본 2, `TURN_AUDIO_CONCURRENCY`)까지 즉시 job 을 동시에 `run()` 한다. `run()`(266-271행)은 `previousDurationMs: this.durations.get(job.index - 1) ?? null` 를 매 호출 때 스냅샷으로 넘기고, `durations` 맵은 그 chunk 의 speaker 호출이 **끝난 뒤**(297행)에만 채워진다 — chunk 1 이 chunk 0 완료 전에 시작되면(동시 2 이므로 흔함) `previousDurationMs=null` 이 그대로 넘어간다. `speech/tts/synthesize.ts:176` `chunkPauseMs` 가 `gap==='PREVIOUS_DURATION'` 일 때 `previousDurationMs ?? 0` 으로 null 을 0 취급 — Codex 주장과 정확히 일치.
- **Leader 질문 ① "TALK(회화방)이 실제로 SHADOWING 을 쓸 수 있는가?" → 예, 쓸 수 있다(설계 의도와 다르게).**
  - `profiles.ts:38` `SHADOWING: { ..., gapMs: 'PREVIOUS_DURATION', ... }` — 5개 프로필 중 이 정책을 쓰는 것은 SHADOWING 뿐(PRONUNCIATION 은 고정 300ms, 문제 재현 안 됨).
  - 정본 3곳(`docs/design/speech-platform/13-user-speech-setting-entity.md:63,134`·`16-tts-productization-layer.md:185`·`domain-model.md:987`)이 일관되게 "설정 화면 선택지는 NATIVE·LEARNING_NORMAL·LEARNING_SLOW 세 개, PRONUNCIATION·SHADOWING 은 **화면(문맥)이 요청 단위로 지정**"하고 "Phase 1 은 3종만, PRONUNCIATION·SHADOWING 은 Phase 3"라고 명시한다. 실제로 두 UI(`VoiceSettings.tsx:103` 세그먼트, `talk/SpeechProfileMenu.tsx` `SPEECH_PROFILE_DEFAULTS`) 모두 3종만 노출한다.
  - 그런데 **서버 검증은 5종 전부를 받는다** — `preferences/validate.ts:113` `parseVoiceDraft` 가 `oneOf(body.speechProfile, ..., SPEECH_PROFILES)`(5종)로 검사하고, `PUT /api/v1/settings/voice`(`route.ts`)에 UI 밖에서 온 값(예: `speechProfile:"SHADOWING"` 직접 호출)을 막는 추가 제약이 없다. 그리고 `turnSpeaker.ts:42-49` `createTurnSpeaker` 가 `synthesizeSentence` 를 부를 때 **`speechProfile` 을 넘기지 않는다**(`contextMode:'TALK'` 만) — `synthesize.ts:186` `prepareSentence` 는 `input.speechProfile` 가 없으면 **사용자 저장값**(`setting.speechProfile`)으로 그대로 떨어진다. 즉 사용자가 UI 를 우회해 저장값을 SHADOWING 으로 바꿔 두면 TALK 턴이 조용히 SHADOWING 정책(속도 0.9·gap=직전 길이)으로 합성된다 — 정본이 말하는 "화면이 요청 단위로 지정"(TALK 은 그 화면이 아니다) 원칙이 코드로 강제돼 있지 않다.
- **Leader 질문에 대한 결론**: 이론적 엣지케이스가 아니라 **오늘 이 Phase 에서 실제로 도달 가능한 경로**다(단, 두 UI 중 어디에서도 클릭으로는 못 만들고 API 직접 호출이 필요 — 그래서 발생 빈도는 낮을 것으로 추정, 보안/데이터 무결성 문제는 아님).
- **영향 재확인**: 데이터 손상·유출 없음. 순수하게 SHADOWING 학습 원칙("직전 청크 길이만큼 따라 말할 시간")이 동시성 2 아래서 조용히 깨져 문장이 바로 이어 재생된다 — 무음 실패(에러도 로그도 없음)라 발견하기 어렵다는 점이 가산 요인.
- **심각도**: Codex 원 판정(medium) 유지. 채택.
- **권고 수정(우선)**: 청크 스케줄러(`turnAudio.ts`)를 프로필-인식으로 만들지 않는다(그러면 conversation 이 speech 의 `SpeechProfile` 을 알아야 해 `module-dependency.md` §3-1 L2↔L4 경계를 넘는다). 대신 **speech 층에서 TALK 컨텍스트가 SHADOWING·PRONUNCIATION 을 상속하지 못하게 막는다** — `synthesize.ts:186` 근처에 `input.contextMode==='TALK'` 이고 `input.speechProfile` 미지정인데 해석된 프로필이 `SHADOWING`|`PRONUNCIATION` 이면 `NATIVE` 로 낮춘다(정본이 이미 "화면이 요청 단위로 지정" 이라고 규정한 것을 코드로 강제하는 것뿐, 새 규칙 아님). 이 fix 는 파일 1개·조건 1줄로 끝나고 `turnAudio.ts` 의 동시성 스케줄러는 건드리지 않는다 — 오늘 실제로 열려 있는 구멍을 가장 작은 반경으로 막는다.
- **후속(이번 fix 범위 밖, Phase 3 섀도잉 화면 착수 시 필요)**: 그 화면이 실제로 `speechProfile:'SHADOWING'` 을 요청 단위로 보내기 시작하면, `turnAudio.ts` 의 동시 합성과 `PREVIOUS_DURATION` 정책이 다시 충돌한다 — 그때는 Codex 의 원래 권고(직전 길이가 필요한 프로필은 청크를 순차화하거나, `pauseBeforeMs` 를 직전 청크 `durationMs` 확정 뒤 **SSE 전송 시점에** 재계산하도록 분리)가 필요하다. 이 각주를 `speech-platform/16-tts-productization-layer.md` §6 또는 §5(SHADOWING 행)에 남겨 두도록 Leader에게 요청.
- **필요 테스트**(scope-guard 채택 시): `src/modules/speech/__tests__/task007.test.ts`(또는 `synthesize` 테스트)에 — 사용자 `speechProfile='SHADOWING'` + `contextMode:'TALK'`(입력에 `speechProfile` 미지정) → 해석된 프로필이 `NATIVE` 로 낮아짐(`gapMs`·`speedFactor` 가 NATIVE 정책과 일치)을 단언. 기존 PREVIEW/TTS(#23 다시 듣기 등) 컨텍스트는 영향받지 않음(회귀 없음)도 같이 확인. 회귀: 기존 SHADOWING 유닛 테스트(있다면 PREVIEW·레슨 컨텍스트용)가 그대로 통과하는지 재실행.

#### C2-2 (turnAudio.ts:211, AUDIO_TEXT_MISMATCH 시 in-flight 합성 미취소) → **채택(Medium)**

- **코드 확인**: `finalize()`(195-222행)가 불일치(`!aligned`, 211행)를 확정하면 `this.queue.length = 0`(아직 시작 안 한 job 만 비움)·`this.total = this.nextIndex`·`emit(AUDIO_TEXT_MISMATCH)` 만 하고 **이미 실행 중인 `run()` 호출(최대 `concurrency`=2개)은 그대로 둔다**. `run()` 은 299행 `if (this.m.mismatch || this.m.textOnly) return` 으로 SSE `audio` 이벤트 송신은 막지만(들리는 것=보이는 것 유지, 실제로 확인), speaker 호출 자체(`withTimeout(..., 9000)`)는 계속 기다린다. `checkSettled()`(253-255행)는 `running===0` 이 될 때까지 `settledPromise` 를 풀지 않는다. `orchestrator/index.ts:387` `await audio.settled()` 가 `saveTurn`·`release()`(턴 락 해제, 384-385행) **뒤**에 있으므로 이 지연은 **다음 턴 시작을 막지는 않지만**(락은 이미 풀림 — REV-014 Medium-3 와 같은 맥락) `done` SSE 이벤트 자체를 최대 청크 타임아웃(9초)까지 늦출 수 있다 — Codex 주장과 정확히 일치.
- **Leader 질문 ② "AUDIO_TEXT_MISMATCH 가 실제로 발생 가능한가(조기 문장 송신 후 재시도)?" → 예, 이미 설계·테스트된 경로다.**
  - `task007.test.ts:137-153` 기존 테스트가 정확히 이 시나리오(조기 문장 합성이 `gate` 로 아직 안 끝난 상태에서 `finalize()` 로 다른 텍스트 확정)를 수동 재현해 통과시킨다 — 즉 developer 가 이미 "발생 가능"으로 보고 이 경로를 설계·테스트했다(C1-3 ③ "잔여 위험으로 수용"도 같은 경로를 가리킴).
  - 실측 근거: prompt-engineer 라이브 재실측에서 JSON 스키마 재시도율 ~5%(20문장 중 1회)이고, developer A 의 30턴+6턴 재실측에서도 재시도 2회 관측(MISMATCH 자체는 0회 관측이지만 표본이 작다 — "6턴 재실측: MISMATCH 0"). 재시도 자체가 드물지 않은 비율로 일어나고 그중 "이미 내보낸 조기 문장과 다른 답"이 나오면 바로 이 경로다 — 순수 이론이 아니라 낮은 빈도로 실제 발생 가능한 조건.
  - 단, C1-3③ 이 이미 수용한 잔여 위험은 "이미 재생된 조기 오디오는 되돌릴 수 없다"(클라 쪽)였고, 이번 Codex 지적은 **그것과 다른 지점**(서버가 이미 버려진 오디오의 합성 완료를 기다리느라 `done` 이 늦어짐)이라 C1-3 의 기존 수용 범위에 포함되지 않는다 — 별개 지적으로 유효.
- **영향 재확인**: 데이터 손상·유출 없음. 순수 지연(최악 9초)과 M4 자원 낭비(공유 자원이라 다른 요청에 간접 영향 가능). 5초 예산을 크게 벗어나는 사용자 체감 지연을 만들 수 있는 조건이 이미 코드·테스트로 확인된 경로라는 점에서 채택할 가치가 있다고 판단.
- **심각도**: Codex 원 판정(medium) 유지. 채택.
- **권고 수정(우선, 최소 변경)**: `AbortSignal` 을 speaker 에 전달해 실제로 M4 호출을 취소하는 전체 배관(conversation→speech 경계를 넘는 새 계약 추가) 대신, **`checkSettled()` 조건만 넓힌다** — `this.total !== null && this.queue.length === 0 && (this.running === 0 || this.m.mismatch || this.m.textOnly)` 로 바꿔 mismatch·textOnly 확정 시 in-flight job 을 기다리지 않고 `settled()` 를 즉시 푼다. 이미 시작된 `run()` 프로미스는 백그라운드에서 계속 끝까지 돌되(내부 `try/catch` 로 안전하게 처리됨, 미처리 rejection 없음) 그 결과는 버려진다(오디오 이벤트는 이미 299행 가드가 막는다). 이 경로는 `orchestrator/index.ts:387-390` 의 `audio.steps()`(관리자 Trace) 가 아직 안 끝난 job 의 TTS 스텝을 놓칠 수 있다는 트레이드오프가 있음(진단 정보 일부 손실, 기능·보안 영향 없음) — developer 가 원하면 후속으로 비동기 Trace 보강을 검토하되 이번 fix 의 필수 조건은 아니다. M4 자원 낭비 자체(실제 GPU/CPU 점유 취소)는 이 fix 로 해결되지 않는다 — 그건 실제 `AbortSignal`→M4 HTTP 취소 배관이 필요한 별개의, 더 큰 변경이라 이번엔 "지연" 문제만 우선 해결하고 "자원 낭비"는 후속 과제로 남기는 것을 권고(M4 가 운영과 공유돼 있어 값싸게 고칠 수 없다면 이번 fix 로 충분).
- **필요 테스트**: `task007.test.ts` 의 기존 불일치 테스트(137-153행)를 확장 — 현재는 `finalize()` 뒤 `release()` 를 호출해서 gate 를 바로 풀지만, 수정 후에는 **`release()` 호출 전**에 `h.audio.settled()` 가 이미 resolve 돼 있어야 함을 확인(예: `Promise.race([h.audio.settled(), sleep(30).then(() => 'TIMEOUT')])` 가 `'TIMEOUT'` 이 아님을 단언, 그 다음에 `release()` 로 남은 프로미스 정리). TEXT_ONLY 동시성 2 상황(한 job 은 TEXT_ONLY 로 먼저 끝나고 다른 job 은 여전히 gate 로 막혀 있음)에서도 같은 방식으로 `settled()` 가 즉시 풀리는지 추가. 회귀: 정상 완료 경로(불일치·TEXT_ONLY 없음)에서는 여전히 모든 청크가 끝난 뒤에만 `settled()` 가 풀리는 것을 기존 테스트(102-124행)로 재확인.

#### 요약

| 지적 | 판정 | 심각도 | 재현 가능성(Leader 질문 답) |
|---|---|---|---|
| C2-1 SHADOWING·동시성·previousDurationMs | 채택 | Medium | TALK 이 API 직접 호출로 SHADOWING 을 상속할 수 있음(오늘 실제로 열려 있음, UI 로는 불가) |
| C2-2 AUDIO_TEXT_MISMATCH 시 in-flight 미취소 | 채택 | Medium | 조기 합성 뒤 재시도로 발생 가능(기존 테스트가 이미 이 경로를 재현·통과시킴, 실측 재시도율 ~5%) |

두 건 모두 Developer(A)에게 수정 요청 → 수정 후 Reviewer 재순환(REV-016 예정). Critical·High 아니므로 QA 진행을 막을 필요는 없으나, 두 fix 모두 작고 국소적이라 QA 이전 반영을 권고.

### REV-016 (2026-09-28, 0293cd3 — Codex C2 수정 재검증)

**판정: PASS** (Critical 0 · High 0 · Medium 0 · Low 1 — 기존 트레이드오프 재확인)

**검증 방법**: `git show 0293cd3`(9파일) 전량 정독 + `git show d7451b2`(각주 커밋) 대조. 독립 재실행은 REV-014·015 와 같은 `git archive` 스크래치 방식 — `~/.node-local/thekaiwa-revcheck-0293cd3`(node_modules 는 운영 미러에서 하드링크, 검증 뒤 삭제). 운영 pm2 미러는 건드리지 않았다.

**독립 재실행 결과**: `tsc --noEmit` exit 0 · `eslint src` 0 error(경고 5 = 기존 파일, REV-015 와 동일 — 이번 diff 무관) · `node --test`(전체) **373 pass / 0 fail** — **A 보고 "373/373" 독립 재확인**. C2 관련 신규 테스트 6건(불일치 시 settled 즉시·그 뒤 이벤트 0 / TEXT_ONLY 동시 2 즉시·이벤트 0 / 정상 경로 회귀(TIMEOUT 확인) / 턴 전체 done 즉시(1.5s 안, 9s 아님) / TALK SHADOWING·PRONUNCIATION→NATIVE / 저장·미리듣기 3종 제한)을 `--test-name-pattern` 으로 개별 재확인 — 전부 `ok`.

#### C2-1 재검증

- **① `resolveSpeechProfile`(`speech/tts/profiles.ts`) 동작**: 코드(`if (i.requested) return i.requested` → `saved` 계산 → `contextMode==='TALK' && !USER_SPEECH_PROFILES.includes(saved)` 면 `NATIVE`)와 신규 테스트(`speech/__tests__/task007.test.ts` "회화(TALK) 문맥은 저장된 SHADOWING·PRONUNCIATION 을 물려받지 않고 NATIVE 로 낮춘다")를 대조 — **Leader 확인 항목 3가지 모두 코드·테스트로 확인**: (a) TALK + 저장값 SHADOWING/PRONUNCIATION → NATIVE(`resolveSpeechProfile({saved:'SHADOWING',contextMode:'TALK'})==='NATIVE'`, `PROFILE_POLICIES.NATIVE.gapMs===0` 도 같이 확인) (b) 명시적 요청값은 컨텍스트 무관하게 유지(`{requested:'SHADOWING', saved:'NATIVE', contextMode:'TALK'}` → `'SHADOWING'`) (c) 다른 컨텍스트(`TTS`·`PREVIEW`)는 저장값 SHADOWING 그대로 유지. `chunkPauseMs(NATIVE, 1, 0, null)===0` 로 "동시 합성으로 직전 길이를 몰라도 SHADOWING 만의 문제였던 조용한 쉼-0 이 재현되지 않음"도 같이 확인됨.
- **② `preferences/validate.parseVoiceDraft` 제한 + api-contract 일치**: `SPEECH_PROFILES`(5종, 컬럼 enum 그대로) 와 별개로 `USER_SPEECH_PROFILES`(3종)를 신설해 `oneOf(body.speechProfile, ..., USER_SPEECH_PROFILES)` 로 검사 — `PUT /api/v1/settings/voice`(#14, `requireSpeechProfile:true`)·`POST /api/v1/voices/preview`(#18, `requireSpeechProfile:false` 지만 필드가 오면 같은 검사)**둘 다** PRONUNCIATION·SHADOWING 을 `400 VALIDATION` 으로 거절함을 코드(`validate.ts:119` 변경)·신규 테스트(`preferences/__tests__/validate.test.ts` 6-way 단언: 3종 통과·2종×2컨텍스트 400)로 확인. `docs/design/api-contract.md` #13~#14 절이 "PRONUNCIATION·SHADOWING 은 저장할 수 없다(400)... 컬럼 enum 은 5종 그대로이며, 옛 행에 두 값이 남아 있어도 회화(TALK) 턴은 그 저장값을 물려받지 않고 NATIVE 로 합성한다" 로 정확히 갱신됨을 정독 확인 — 코드·계약·정본 3층 일치. `#18` 이 실제로 Settings 화면(§7) 의 통합 미리듣기(`voices/preview/route.ts`, "문장은 서버 고정·저장하지 않은 draft")이고 그 화면 자체가 3종만 노출하므로 이 제한이 실사용 흐름을 깨지 않음을 라우트 정독으로 확인.
- **③ 6층 경계**: `grep -rn "SpeechProfile\|speechProfile" src/modules/conversation/` **0건** — 청크 스케줄러(`turnAudio.ts`)는 여전히 프로필을 전혀 모른다(이번 diff 가 `turnAudio.ts` 의 `run()`·`enqueue`·요청 구성부를 건드리지 않았음을 `git show 0293cd3 -- turnAudio.ts` 로 확인 — 변경은 `checkSettled()` 뿐). 프로필 판단은 전부 `speech/tts/synthesize.ts:prepareSentence`(speech 층)에서 일어난다 — L2↔L4 경계 유지.
- 운영 DB 실측(A 04:30 "QA 계정 저장값을 DB 직접 SHADOWING 으로 → TALK 턴 Trace `speechProfile`=NATIVE·NATIVE / #23 은 SHADOWING 유지 → 원복")은 **프로덕션 DB 직접 조작이라 Reviewer 범위 밖**(Read 전용) — 재현하지 않았다. 다만 위 단위 테스트가 정확히 같은 조건(`saved:'SHADOWING', contextMode:'TALK'` vs `contextMode:'TTS'`)을 결정적으로 검증하므로 별도 재현 없이도 충분한 확신을 얻었다.
- **Phase 3 각주(`d7451b2`)**: `speech-platform/16-tts-productization-layer.md` §6 에 "SHADOWING 과 청크 동시성" 각주가 정확히 REV-015 가 요청한 내용(이번 fix 의 범위·Phase 3 섀도잉 화면 착수 시 순차화 또는 `pauseBeforeMs` 재계산 필요)을 담고 있음을 확인.

#### C2-2 재검증

- **① `settled()` 가 불일치·TEXT_ONLY 확정 시 즉시 풀리는지**: `checkSettled()` 조건이 `this.total !== null && this.queue.length === 0 && (this.running === 0 || this.m.mismatch || this.m.textOnly)` 로 확장됐고, `finalize()` 의 불일치 분기가 `this.m.mismatch=true` 설정 직후 `this.checkSettled()` 를 **동기 호출**함을 코드로 확인(대기 중인 job 의 `.finally()` 콜백을 기다리지 않음). 신규 테스트 2건(불일치·TEXT_ONLY 동시 2)이 `Promise.race([settled(), sleep(50)→'TIMEOUT'])` 로 **SETTLED 가 50ms 안에 이김**(gate 는 테스트가 끝날 때까지 안 풀어 둔 채로)을 단언 — 재실행에서 통과 확인.
- **② 늦게 끝난 합성이 캐시만 남기고 이벤트 0, done 뒤 이벤트 0**: 두 단계 방어를 코드로 확인 — (a) `run()` 내부의 기존 가드(`if (this.m.mismatch || this.m.textOnly) return`, 위치는 `traceSteps.push`·`durations.set` **뒤**·`emit('audio')` **앞**)가 언제 끝나든 오디오 이벤트 송신 자체를 막는다 (b) `stream.ts` 의 `finished` 플래그가 `emit()` 자체를 no-op 으로 만든다(`done`/`error` 이후 어떤 이벤트도 스트림에 안 실림) — 이중 방어. 신규 테스트가 `release()` 로 gate 를 연 **뒤**(즉 `done`/`settled` 가 이미 확정된 뒤) `sleep(30)` 하고 이벤트 개수가 그대로임을 단언 — 재실행 통과. **턴 전체 테스트**(`startTurn` 을 `turnDeps` mock 으로 완전히 감싼 e2e 형)는 speaker 가 테스트가 끝날 때까지 전혀 풀리지 않는 gate 로 막혀 있는데도(9초는커녕 아예 안 풀림) `done` 이 **1.5초 race 안에** 도착하고, 그 뒤 `release()` 해도 이벤트가 늘지 않으며 `currentTurnLock` 이 null(락 정상 해제)임을 확인 — 가장 설득력 있는 증거.
- **③ 정상 경로가 여전히 모든 청크를 기다리는지(회귀)**: `this.m.mismatch`·`this.m.textOnly` 가 모두 false 인 일반 완료는 조건이 `running===0` 하나로 그대로 남는다(수학적으로 원래 조건과 동치). 신규 "회귀" 테스트가 청크 1을 gate 로 막아 두고 `Promise.race(settled(), sleep(50))` 가 **TIMEOUT** 으로 나옴(=settled 가 성급하게 안 풀림)을 먼저 확인한 뒤 `release()` 하고 정상 완료를 재확인 — 이 테스트가 "회귀 없음"을 직접 증명한다. 기존 "조기 경로" 정상완료 테스트(102-124행, 이번 diff 로 안 바뀜)도 그대로 통과.
- **④ Trace 스텝 누락 부작용 평가(Leader 요청)**: `orchestrator/index.ts:387-389` 에서 `await audio.settled()` 직후 `steps.push(...audio.steps())` 가 **그 시점의 스냅샷**을 한 번만 복사해 간다. `settled()` 가 일찍 풀리면 아직 `run()` 이 `this.traceSteps.push(...)`(296행대, `emit` 가드보다 앞)에 도달하지 못한 job 의 TTS 스텝은 이 스냅샷에 없다 — 그 job 이 나중에 끝나 `this.traceSteps` 에 늦게 추가돼도 `processTurn` 의 로컬 `steps` 배열은 이미 복사가 끝나 `recordTrace(...)` 에 반영되지 않는다. **확인 결과**: (a) 크래시·미처리 rejection 없음(`run()` 이미 내부 try/catch, `.finally()` 의 `pump()`·`checkSettled()` 재호출도 안전, no-op) (b) 영향 범위는 **관리자 전용 Trace 진단 정보**(`TTS[i]` 스텝의 합성 시간·cacheHit 등) 하나뿐 — 사용자 응답(SSE)·저장 데이터(ChatMessage)·`toolLog.audioCount`(이미 `metrics()` 에서 mismatch/textOnly 이전에 카운트된 값만 집계, 즉 정확함) 어디에도 영향 없음 (c) 코드 주석·dev log 에 이미 명시적으로 문서화된 **의도된 트레이드오프**임을 확인. **결론**: 부작용은 실재하나 Low — 기능·보안·데이터 무결성에 영향 없는 진단 정보 완결성 손실뿐이라 이번 fix 를 막을 이유가 아니다.
- **M4 자원 낭비(취소 자체)**: 이번 fix 로 해결되지 않음(REV-015 권고에서도 "후속 과제"로 명시) — `AbortSignal` 배관 없음을 재확인, 의도된 범위 밖.

#### Low

1. **관리자 Trace 스텝 누락(위 C2-2 ④)** — 기능·보안 영향 없는 진단 정보 손실. 이미 코드 주석·dev log 에 문서화된 의도된 트레이드오프. Phase 2 Admin Diagnostics(§16) 강화 시 "늦게 끝난 TTS 스텝을 비동기로 Trace 에 추가로 patch" 를 후속 과제로 고려할 수 있다는 점만 기록(급하지 않음, 코드 수정 요구 아님).

#### QA 인계 추가

- REV-015 의 high_risk_areas·QA 실행 방법 메모는 그대로 유효(변경 없음).
- (신규, 낮은 우선순위) `PUT /api/v1/settings/voice`·`POST /api/v1/voices/preview` 에 `speechProfile:"PRONUNCIATION"`|`"SHADOWING"` 을 직접 보내면 `400`(`VALIDATION`)인지 스모크 1회 확인 권고 — 이미 단위 테스트로 커버되나 실제 라우트 왕복까지 QA 가 한 번 눈으로 보면 좋음.

`native_change`: false.

## QA 기록

## 최종 요약
- [2026-09-28 03:15] codex_gate/C1 engine=jev → codex_required=true, mode=adversarial-review, focus=security, budget_rule=CX-limit-unknown-r2 | overrides=- | fallback=- | tokens=862
