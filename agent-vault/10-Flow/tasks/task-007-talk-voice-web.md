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

### B(화면)

## Reviewer 기록

## QA 기록

## 최종 요약
- [2026-09-28 03:15] codex_gate/C1 engine=jev → codex_required=true, mode=adversarial-review, focus=security, budget_rule=CX-limit-unknown-r2 | overrides=- | fallback=- | tokens=862
