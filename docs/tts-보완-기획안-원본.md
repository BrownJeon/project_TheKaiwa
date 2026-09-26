> 사용자 제공 원문 (2026-09-26, 5차). 설계 반영은 `design-spec.md` §9-D 와 `design/speech-platform/16-tts-productization-layer.md`. 이 파일은 수정하지 않는다.

TTS 상용 제품 벤치마크 기반 추가 보완 설계

129. 보완 목적

상용 TTS 제품인 SELVAS TTS의 공개 기능을 벤치마크한 결과, 현재 Style-Bert-VITS2 기반 설계는 음성 생성 기능 자체에는 충분한 확장성이 있다.

다만 오픈소스 엔진 기능과 실제 상용 서비스 사이에는 다음 영역의 차이가 존재한다.

TTS Engine

        vs

Commercial TTS Platform

따라서 Style-Bert-VITS2 기능을 직접 애플리케이션에서 사용하는 방식이 아니라 다음 계층을 추가한다.

Japanese Learning App

↓

TTS Platform

↓

TTS Engine Adapter

↓

Style-Bert-VITS2

---

130. Pronunciation Lexicon Service

Style-Bert-VITS2에는 User Dictionary 기능이 존재하지만 이를 엔진 내부 설정으로만 사용하지 않는다.

일본어 교육 플랫폼의 공통 기능으로 "Pronunciation Lexicon Service"를 구성한다.

역할:

단어

표기

읽기

Accent

우선순위

적용 범위

Version

예:

{
  "surface": "日本橋",

  "reading": "ニホンバシ",

  "accent": 3,

  "priority": 10,

  "scope": "GLOBAL"
}

적용 범위:

GLOBAL

COURSE

LESSON

VOICE

USER

---

131. 발음 사전 관리 UI

Admin Console에 다음 기능을 추가한다.

Pronunciation Dictionary

검색

추가

수정

삭제

Import

Export

Preview

Version History

예:

単語
日本橋

読み
ニホンバシ

Accent
3

Priority
10

[ 발음 미리듣기 ]

---

132. Pronunciation Dictionary Version 관리

사전 변경으로 기존 TTS 발음이 달라질 수 있으므로 Version을 관리한다.

Dictionary v12

↓

日本橋 Accent 수정

↓

Dictionary v13

문제가 발생하면:

Rollback v12

가 가능해야 한다.

---

133. TTS Text Processing Pipeline

TTS Engine에 원문을 바로 전달하지 않는다.

다음 Pipeline을 거친다.

LLM Response

↓

Text Normalizer

↓

Pronunciation Lexicon

↓

Speech Rendering Plan

↓

TTS Parameter Resolver

↓

TTS Engine

---

134. Japanese Text Normalizer

일본어 학습 앱이기 때문에 별도의 일본어 Text Normalization Layer를 둔다.

처리 대상:

숫자

날짜

시간

단위

Counter

기호

영문

외래어

고유명사

약어

예:

2026年9月26日

를 TTS Engine에 그대로 의존시키지 않고 필요할 경우 읽기 형태를 결정한다.

또한 다음과 같은 Counter도 테스트 대상에 포함한다.

一人

二人

一本

一匹

一日

---

135. TTS Speech Rendering Plan

현재 "TTS Parameter Resolver"를 확장한다.

LLM이나 앱이 Style-Bert-VITS2의 실제 parameter를 직접 사용하지 않는다.

대신 Engine 독립적인 "Speech Rendering Plan"을 사용한다.

예:

{
  "voiceId": "teacher_haruka",

  "segments": [
    {
      "text": "そうですね。",
      "style": "FRIENDLY",
      "speed": "NORMAL"
    },

    {
      "text": "もう一度言ってみましょう。",
      "style": "ENCOURAGING",
      "speed": "SLOW",
      "pauseBeforeMs": 300
    }
  ]
}

---

136. Engine Independent Speech Control

내부적으로 다음과 같은 공통 표현을 정의한다.

NORMAL

SLOW

VERY_SLOW

FRIENDLY

CALM

ENCOURAGING

EXPLANATION

EMPHASIS

PAUSE

이를 Engine Adapter가 실제 Engine Parameter로 변환한다.

예:

ENCOURAGING

↓

Style-Bert

style = Friendly
styleWeight = 0.8
intonationScale = 1.1

향후 다른 TTS Engine에서는 다른 Parameter로 매핑한다.

이를 통해 상용 TTS의 Control Tag와 유사한 기능을 특정 Engine에 종속되지 않고 제공한다.

---

137. Segment 단위 TTS 제어

문장 전체에 하나의 설정만 적용하지 않고 Segment별 설정을 지원한다.

예:

「昨日、新宿に行きました。」

↓

昨日
NORMAL

新宿
EMPHASIS

行きました
SLOW

이 기능은 일반 TTS보다 교육용 서비스에서 더욱 중요하다.

---

138. Native / Learning Speech Profile

교육용 TTS Profile을 공식적으로 정의한다.

NATIVE

LEARNING_NORMAL

LEARNING_SLOW

PRONUNCIATION

SHADOWING

예:

NATIVE

실제 일본인 회화에 가까운 발음.

LEARNING_SLOW

속도를 줄이되 Mora Timing과 자연스러운 Accent를 최대한 유지한다.

PRONUNCIATION

발음 비교가 쉽도록 명확하게 발화한다.

SHADOWING

따라 말하기에 적합한 속도로 출력한다.

---

139. Streaming TTS Architecture

현재 서버에서 WAV 전체를 생성한 이후 사용자에게 보내는 방식만으로 제한하지 않는다.

회화 서비스의 UX에서는 다음 값이 중요하다.

Total Synthesis Time

보다

Time To First Audio

따라서 장기적으로 Streaming 또는 Chunked TTS를 지원한다.

---

140. Chunk Based TTS

Streaming을 직접 지원하지 않는 Engine도 사용할 수 있도록 Application Layer에서 Chunk 처리를 제공한다.

예:

LLM Streaming Response

↓

Sentence Detector

↓

Chunk 1
「そうですね。」

↓

TTS

↓

즉시 재생


동시에


Chunk 2
「昨日は何をしましたか？」

↓

TTS

사용자는 전체 답변 생성이 끝날 때까지 기다리지 않는다.

---

141. TTS Playback Queue

모바일 Client에는 TTS Playback Queue를 둔다.

Audio Chunk 1

↓

Audio Chunk 2

↓

Audio Chunk 3

다음 Chunk를 생성하는 동안 이전 Chunk를 재생한다.

Generate Chunk 2
       ↕

Play Chunk 1

형태로 Latency를 숨긴다.

---

142. Time To First Audio 측정

TTS 성능의 핵심 Metrics로 다음을 추가한다.

TTFA
Time To First Audio

추가 Metrics:

Total Synthesis Latency

Audio Duration

Real Time Factor

Queue Delay

Model Loading Time

Playback Start Delay

---

143. TTS Observability

기존 Admin Console의 Health Check를 운영 통계 수준으로 확장한다.

Dashboard:

Requests / minute

Average Latency

P50 Latency

P95 Latency

P99 Latency

TTFA

Error Rate

Cache Hit Rate

Voice별 요청 수

Engine별 요청 수

Model Load Time

---

144. TTS Trace

Conversation Trace에서 TTS 내부 과정도 확인할 수 있도록 한다.

예:

Trace

LLM Response
80ms

↓

Text Normalization
4ms

↓

Dictionary
2ms

↓

Rendering Plan
1ms

↓

TTS Queue
14ms

↓

Style-Bert Inference
310ms

↓

Audio Encode
22ms

↓

Client Playback

---

145. Timing Metadata

상용 TTS의 Lip Sync 기능을 그대로 따라갈 필요는 없다.

그러나 일본어 교육 앱에서는 Lip Sync보다 다음 정보가 훨씬 가치 있다.

Word Timing

Mora Timing

Phoneme Timing

따라서 장기적으로 TTS 응답 구조를:

Audio only

에서:

Audio

+

Timing Metadata

형태로 확장한다.

---

146. TTS Response Model

예:

{
  "audioUrl": "...",

  "durationMs": 2120,

  "timing": {
    "words": [
      {
        "text": "昨日",
        "startMs": 0,
        "endMs": 420
      },

      {
        "text": "新宿",
        "startMs": 500,
        "endMs": 970
      }
    ]
  }
}

---

147. Timing Metadata 활용

이를 이용하여 다음 기능을 구현할 수 있다.

Karaoke Subtitle

Shadowing Highlight

현재 읽는 단어 강조

Mora 단위 발음 비교

Avatar Mouth Animation

Pronunciation Practice

Lip Sync 자체보다 일본어 학습 기능에 먼저 활용한다.

---

148. TTS Quality Evaluation Platform

오픈소스 TTS의 가장 큰 운영 위험 중 하나는 Engine 또는 Model 업데이트 후 품질이 변하는 것이다.

따라서 자동/수동 TTS 품질 테스트 체계를 구축한다.

---

149. Japanese TTS Golden Dataset

대표 일본어 문장을 관리한다.

예:

General Conversation

Long Vowel

Sokuon

Pitch Accent

Counter

Date

Number

Proper Noun

Loanword

Question

Emotion

Long Sentence

최소 초기:

100 ~ 300 sentences

정도의 Golden Set을 구축한다.

---

150. Regression Test

Voice Model 또는 Engine 변경 시:

Old Model

vs

New Model

에 동일한 Golden Dataset을 생성한다.

비교 항목:

Pronunciation

Naturalness

Pitch Accent

Speed

Audio Duration

Latency

Failure Rate

---

151. 관리자 A/B Voice 비교

Admin Console에서:

Voice A

▶ Play


Voice B

▶ Play

형태의 Blind Compare 기능을 제공할 수 있도록 한다.

평가값:

Naturalness

Pronunciation

Teacher Suitability

Clarity

Preference

---

152. Model Versioning 강화

Voice는 단순 Voice ID만 가지지 않는다.

Voice

+

Model Version

으로 관리한다.

예:

teacher_haruka

v1.0

v1.1

v2.0

---

153. Voice Model Deployment

새 Model을 바로 전체 사용자에게 적용하지 않는다.

TRAINED

↓

VALIDATED

↓

STAGING

↓

CANARY

↓

PRODUCTION

↓

DEPRECATED

상태를 지원한다.

---

154. Canary Voice 배포

예:

Haruka v1

90%

Haruka v2

10%

일부 Session에 먼저 적용하여:

Latency

Error

사용자 평가

TTS 품질

을 비교할 수 있도록 한다.

---

155. TTS Audio Cache

교육 서비스에서는 동일 문장의 반복 재생이 빈번하다.

예:

もう一度言ってみましょう。

おはようございます。

ありがとうございます。

따라서 합성 결과 Cache를 지원한다.

Cache Key:

normalizedText

voice

modelVersion

style

speed

pitch

intonation

dictionaryVersion

Dictionary가 변경되면 기존 Cache가 잘못 사용되지 않도록 "dictionaryVersion"도 포함한다.

---

156. On-Device TTS Roadmap

SELVAS 상용 제품에서 특히 참고할 부분은 On-Device TTS이다.

SELVAS는 Android/iOS 등에서 인터넷 없이 실시간으로 합성하는 제품을 제공한다고 공개하고 있다.

현재 Style-Bert-VITS2는 ONNX 모델 지원 및 ONNX 변환 기능을 제공하지만, 이것 자체가 모바일 상용 SDK 수준을 의미하지는 않는다.

따라서 On-Device TTS는 별도 Research Track으로 관리한다.

Server TTS

현재 기본

↓

ONNX Optimization

↓

Quantization

↓

Mobile Runtime

↓

Android Prototype

↓

iOS Prototype

↓

Production Evaluation

---

157. On-Device 평가 기준

모델이 모바일에서 실행된다는 것만으로 도입하지 않는다.

다음 기준을 통과해야 한다.

Model Size

RAM

Startup Time

TTS Latency

Real Time Factor

Battery Usage

Thermal

Voice Quality

Crash Rate

---

158. Hybrid TTS 및 앱 상태 표시

장기적으로 다음 구조를 허용한다.

              TTS Router

                  │
        ┌─────────┴─────────┐
        │                   │

    On Device             Server

        │                   │

Low Latency             High Quality
Offline                 Advanced Voice

기본 동작은 다음과 같이 정의한다.

네트워크 정상
→ Server

오프라인
→ On Device

서버 장애
→ On Device

앱은 현재 실제로 사용 중인 TTS 실행 상태를 사용자에게 명확하게 표시해야 한다.

AI 강사 프로필 옆에 상태 표시등을 배치한다.

초록불
→ 온라인 상태
→ 현재 Server TTS 사용 중

빨간불
→ 온디바이스 모드
→ 오프라인 또는 서버 장애로 현재 On-Device TTS 사용 중

상태 표시등만으로 의미가 불분명할 수 있으므로 색상과 함께 텍스트 또는 접근성 레이블도 제공한다.

온라인

온디바이스 모드

네트워크가 정상이어도 서버 상태 확인이 완료되지 않았거나 전환 중인 경우에는 별도의 상태를 표시할 수 있다.

전환 중

상태 확인 중

상태 판단은 단순히 네트워크 연결 여부만으로 결정하지 않고, 실제 TTS Router의 선택 결과를 기준으로 한다.

예:

네트워크 없음
→ On Device 선택
→ 빨간불 표시

네트워크 정상 + 서버 응답 가능
→ Server 선택
→ 초록불 표시

네트워크 정상 + 서버 장애
→ On Device Fallback
→ 빨간불 표시

서버 장애로 온디바이스 모드로 전환된 경우에는 사용자가 현재 상태를 알 수 있도록 일시적인 안내 메시지를 제공한다.

서버 연결이 원활하지 않아 온디바이스 모드로 전환했습니다.

상태 표시 정보는 다음 항목을 포함한다.

executionMode

networkStatus

serverHealth

fallbackReason

lastUpdatedAt

예:

{
  "executionMode": "ON_DEVICE",
  "networkStatus": "ONLINE",
  "serverHealth": "UNAVAILABLE",
  "fallbackReason": "SERVER_ERROR",
  "lastUpdatedAt": "2026-09-26T12:00:00Z"
}

이를 통해 사용자는 현재 AI 강사의 음성이 서버에서 생성되는지, 기기 내부에서 생성되는지 즉시 확인할 수 있다.

---

159. 기존 설계 중 이미 충분한 부분

SELVAS 벤치마크 결과 다음 항목은 현재 기획 방향을 유지한다.

Multi Voice

기존 "Voice Registry" 구조 유지.

Voice Preview

현재 모든 설정을 적용한 통합 Preview 구조 유지.

Engine Monitoring

기존 Admin Console 구조 유지하되 Metrics를 확장한다.

Engine Configuration

Engine Registry + Connection Profile 구조 유지.

Model Add / Remove

Voice Package + Voice Import Service 구조 유지.

Runtime Status

Engine Health Check 구조 유지.

즉 이 영역은 새로 재설계할 필요가 없다.

---

160. 이번 벤치마크를 통해 추가할 핵심 컴포넌트

다음 Component를 기존 Architecture에 추가한다.

PronunciationLexiconService

JapaneseTextNormalizer

SpeechRenderingPlan

SpeechProfile

TtsChunkScheduler

TtsPlaybackQueue

TtsMetricsCollector

TtsTimingMetadata

TtsQualityEvaluator

TtsGoldenDataset

VoiceModelVersion

VoiceDeploymentPolicy

TtsAudioCache

TtsRuntimeStatusIndicator

장기 후보:

OnDeviceTtsRuntime

TtsModelOptimizer

---

161. 최종 보완 TTS Architecture

                Conversation LLM

                       │
                       ▼

                 Japanese Text

                       │
                       ▼

              JapaneseTextNormalizer

                       │
                       ▼

             PronunciationLexicon

                       │
                       ▼

              SpeechRenderingPlan

                       │
                       ▼

              TTS Parameter Resolver

                       │
                       ▼

                   TTS Router

                  ┌────┴────┐
                  │         │

                  ▼         ▼

              Server      OnDevice
                TTS       Future TTS

                  │
                  ▼

             Style-Bert-VITS2

                  │
                  ▼

              Audio + Timing

                  │
                  ▼

             Playback Queue

                  │
                  ▼

          Runtime Status Indicator

                  │
                  ▼

                 User

운영 측면에서는:

TTS Engine
     │
     ├─ Metrics
     ├─ Trace
     ├─ Cache
     ├─ Quality Test
     ├─ Model Version
     ├─ Deployment
     └─ Runtime Status

구조를 추가한다.

---

162. 구현 우선순위

P0 — MVP 전 설계 반영

Pronunciation Lexicon Service

Japanese Text Normalizer

Speech Rendering Plan

Chunked / Low Latency TTS 설계

TTFA 측정

Server / On-Device 실행 상태 표시

P1 — 서비스 초기 버전

TTS Metrics

Audio Cache

Golden Dataset

Model Versioning

Timing Metadata

A/B Voice Test

Fallback 상태 안내

P2 — 서비스 확장

On-Device TTS

Model Quantization

Hybrid TTS Router

Lip Sync / Avatar

---

163. 설계 결론

SELVAS TTS의 벤치마크 결과 오픈소스 TTS Engine을 교체할 필요는 없다.

현재 Architecture에서 부족한 것은 주로:

Engine Capability

보다

Productization Layer

이다.

따라서 Style-Bert-VITS2를 유지하면서 그 위에:

발음 관리

Text Normalization

Speech Control

Low Latency Delivery

Monitoring

Quality Assurance

Model Lifecycle

Hybrid Routing

Runtime Status 표시

Future On-Device

계층을 구축한다.

특히 Hybrid TTS 환경에서는 사용자가 현재 어떤 실행 모드를 사용하고 있는지 앱에서 즉시 확인할 수 있어야 한다. AI 강사 프로필 옆에 초록불과 빨간불을 표시하여 온라인 서버 상태와 온디바이스 모드를 구분하고, 서버 장애나 오프라인 전환 시에도 사용자에게 현재 상태를 명확히 안내한다.

이를 통해 오픈소스 TTS의 높은 자유도를 유지하면서 상용 TTS 제품 수준의 운영성과 안정성, 그리고 사용자에게 투명한 실행 상태 안내를 확보하는 것을 목표로 한다.
