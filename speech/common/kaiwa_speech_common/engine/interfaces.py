"""TheKaiwa 음성 엔진 인터페이스 골격 — Protocol/dataclass 시그니처만 (구현 없음).

설계 단계 산출물이다(2026-09-26). 구현(task-003)에서는 이 파일을
`speech/common/kaiwa_speech_common/engine/interfaces.py` 로 옮기고 gateway 는 re-export 한다.
TS 쪽 `src/modules/engine` 의 `EngineProvider`·역할 파사드와 개념·이름을 맞춘다
(대응표: docs/design/module-dependency.md §5-1). 메서드명은 Python 관례(snake_case)를 쓰되
TS 이름을 docstring 에 병기한다.

규칙
- 이 파일은 엔진명(reazon·whisper·style-bert)을 모른다. 엔진 고유 값은 `EngineContext.connection`
  과 `SpeechRequest.options` 의 dict 로만 흐른다.
- 오디오 원본·전사 전문은 여기 정의된 객체에 담기더라도 로그·트레이스에 실리지 않는다
  (`__repr__` 가 길이만 노출하도록 구현할 것).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Awaitable, Callable, Mapping, Optional, Protocol, Sequence, runtime_checkable


# ── 공통 열거형 ──────────────────────────────────────────────────────────────


class EngineRole(str, Enum):
    """엔진 역할. TS `EngineRole` 과 동일 값. 라우터·Fallback Policy 의 키."""

    REALTIME_STT = "REALTIME_STT"
    ANALYSIS_STT = "ANALYSIS_STT"
    TTS = "TTS"
    LLM = "LLM"


class EngineType(str, Enum):
    STT = "STT"
    TTS = "TTS"
    LLM = "LLM"


class ConnectionType(str, Enum):
    """EngineConnection.connectionType 과 동일 값."""

    LOCAL = "LOCAL"
    HTTP = "HTTP"
    ONDEVICE = "ONDEVICE"
    CLI = "CLI"


class Editability(str, Enum):
    """ConfigurationSchema 키의 편집성(관리자 콘솔 기획안 §87)."""

    READ_ONLY = "READ_ONLY"
    RUNTIME_EDITABLE = "RUNTIME_EDITABLE"
    RESTART_REQUIRED = "RESTART_REQUIRED"
    REDEPLOY_REQUIRED = "REDEPLOY_REQUIRED"
    SECRET = "SECRET"


# ── 데이터 객체 ──────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class AudioData:
    """PCM 오디오 한 덩어리.

    Attributes:
        pcm: 16-bit little-endian mono 샘플 바이트. 파일 경로 대신 바이트를 들고 다닌다
            (어댑터가 임시 파일을 만들지 결정).
        sample_rate: Hz. 실시간 경로는 16000 고정.
        channels: 1 고정(스테레오는 어댑터 앞단에서 다운믹스).
        duration_ms: 계산값(캐시). 로그에는 이 값과 바이트 수만 남긴다.
        source_path: 원본이 파일이면 그 경로(DATA_ROOT 규약). 로그 금지.
    """

    pcm: bytes
    sample_rate: int = 16000
    channels: int = 1
    duration_ms: int = 0
    source_path: Optional[str] = None


@dataclass(frozen=True)
class TranscriptionSegment:
    """VAD 세그먼트 1개의 디코드 결과. WS `partial`/`final.segments[]` 의 항목."""

    seg_idx: int
    text: str
    start_ms: int
    end_ms: int
    confidence: Optional[float] = None


@dataclass(frozen=True)
class TranscriptionResult:
    """STT 결과. TS `TranscriptionResult` 와 필드 동일.

    Attributes:
        text: 세그먼트를 이어 붙인 전체 텍스트(정규화 전 원문).
        segments: 세그먼트 목록(분석 STT 는 whisper 세그먼트).
        engine_id: 실제 사용 엔진(어댑터가 채움). 상위 로직은 분기에 쓰지 않는다.
        connection_id: 실제 사용 connection(라우터가 채움) — Utterance.realtimeEngine / toolLog 기록용.
        language: 감지·고정 언어 코드("ja").
        timings_ms: 단계별 소요 {"vad": …, "decode": …, "load": …}.
        raw: 엔진 원본 응답(디버그 세션에서만 보관, 평소 버림).
    """

    text: str
    segments: Sequence[TranscriptionSegment] = ()
    engine_id: str = ""
    connection_id: str = ""
    language: str = "ja"
    timings_ms: Mapping[str, int] = field(default_factory=dict)
    raw: Optional[Mapping[str, Any]] = None


@dataclass(frozen=True)
class VoiceOptions:
    """엔진 중립 TTS 파라미터. TTS Parameter Resolver 의 출력이자 TS `TtsSynthesisRequest` 와 동일.

    LLM 은 이 값을 정하지 않는다(speech.style 은 Resolver 의 5순위 입력일 뿐).
    SBV2 파라미터(model_id·speaker_id·length=1/speed·pitch_scale·intonation_scale)로의 변환은
    `StyleBertVitsEngine` 어댑터 내부에서만 일어난다.
    """

    voice_model_ref: str
    speaker: str
    style: str = "Neutral"
    style_weight: float = 1.0
    speed: float = 1.0
    pitch: float = 1.0
    intonation: float = 1.0
    language: str = "JP"


@dataclass(frozen=True)
class SpeechRequest:
    """모든 음성 요청의 공통 봉투. 어댑터는 이 안의 값만 본다.

    Attributes:
        trace_id: 앱 RequestTrace.traceId(없으면 서비스가 생성).
        role: 요청이 소비할 엔진 역할.
        user_id: 소유자(로그에는 남겨도 되는 내부 식별자).
        chat_id / utterance_id: 관련 리소스(있을 때).
        options: 설정 해석 7순위 USER_SETTING 층 값 등 요청 단위 오버라이드
            (예: {"endpoint_silence_ms": 400}). 서비스는 사용자 설정 저장소를 읽지 않으므로
            앱이 여기에 실어 보낸다.
        text: TTS 입력 문장(≤ max_sentence_chars). STT 요청에서는 None.
        voice: TTS 파라미터. STT 요청에서는 None.
        audio: STT 입력. TTS 요청에서는 None.
    """

    trace_id: str
    role: EngineRole
    user_id: Optional[str] = None
    chat_id: Optional[str] = None
    utterance_id: Optional[str] = None
    options: Mapping[str, Any] = field(default_factory=dict)
    text: Optional[str] = None
    voice: Optional[VoiceOptions] = None
    audio: Optional[AudioData] = None


@dataclass(frozen=True)
class ConnectionProfile:
    """EngineConnection 행의 읽기 전용 투영(시크릿 값 없음 — credential_ref 이름만)."""

    id: str
    engine_id: str
    role: EngineRole
    connection_type: ConnectionType
    enabled: bool
    connection: Mapping[str, Any] = field(default_factory=dict)  # baseUrl·timeoutMs·retry …
    runtime: Mapping[str, Any] = field(default_factory=dict)  # model·numThreads·decodingMethod …
    credential_ref: Optional[str] = None
    status: str = "UNKNOWN"


@dataclass(frozen=True)
class EngineContext:
    """라우터가 고른 실행 문맥. 어댑터 호출의 두 번째 인자.

    Attributes:
        connection: 선택된 Connection Profile(Effective Configuration 적용 후).
        effective: 키별 {value, source, sourceRef} — 진단·트레이스용.
        environment: APP_ENV(LOCAL|PRODUCTION).
        secret_resolver: credential_ref → 값. 어댑터 안에서만 호출하고 결과를 밖으로 내지 않는다.
        logger: 마스킹이 적용된 로거.
    """

    connection: ConnectionProfile
    effective: Mapping[str, Mapping[str, Any]] = field(default_factory=dict)
    environment: str = "LOCAL"
    secret_resolver: Optional[Callable[[str], str]] = None
    logger: Any = None


@dataclass(frozen=True)
class HealthCheckResult:
    """가벼운 상태 확인 결과(EngineHealth kind=HEALTH)."""

    ok: bool
    latency_ms: int
    status: str  # HEALTHY | DEGRADED | UNAVAILABLE | MISCONFIGURED
    detail: Mapping[str, Any] = field(default_factory=dict)  # 모델 로드 여부·메모리·버전 등, 시크릿 없음
    checked_at: Optional[str] = None  # ISO8601


@dataclass(frozen=True)
class FunctionalTestResult:
    """실제 추론 1회 결과(EngineHealth kind=FUNCTIONAL)."""

    ok: bool
    latency_ms: int
    summary: str  # 사람이 읽는 한 줄(예: "20자 합성 0.8s", "ja-sample.wav 전사 일치 0.93")
    detail: Mapping[str, Any] = field(default_factory=dict)
    trace_steps: Sequence[Mapping[str, Any]] = ()


@dataclass(frozen=True)
class EngineDescriptor:
    """코드가 제공하는 엔진 설명(Engine 테이블에 기동 시 스냅샷 upsert)."""

    engine_id: str
    display_name: str
    type: EngineType
    connection_types: Sequence[ConnectionType]
    capabilities: Mapping[str, Any] = field(default_factory=dict)  # {"realtime": true, "languages": ["ja"], "tasksDenied": ["talk"]} …
    schema_version: int = 1
    license: str = ""  # 표시용(예: "Apache-2.0", "AGPL-3.0(별도 서비스)")


@dataclass(frozen=True)
class ConfigurationKey:
    """ConfigurationSchema 의 키 1개(관리자 콘솔 기획안 §57·§86·§87)."""

    key: str
    type: str  # string | number | integer | boolean | enum | object
    default: Any = None
    description: str = ""
    min: Optional[float] = None
    max: Optional[float] = None
    enum: Optional[Sequence[str]] = None
    impact: str = ""  # 바꾸면 무엇이 달라지는지 한 줄
    editability: Editability = Editability.RUNTIME_EDITABLE
    restart_required: bool = False


@dataclass(frozen=True)
class ConfigurationSchema:
    engine_id: str
    version: int
    keys: Sequence[ConfigurationKey]


# ── 콜백 타입 ────────────────────────────────────────────────────────────────

PartialCallback = Callable[[TranscriptionSegment], Awaitable[None]]
FinalCallback = Callable[[TranscriptionResult], Awaitable[None]]
VadCallback = Callable[[str, int], Awaitable[None]]  # (state: "speech"|"silence", at_ms)


# ── 엔진 Protocol ────────────────────────────────────────────────────────────


@runtime_checkable
class SpeechToTextEngine(Protocol):
    """오프라인(비스트리밍) 전사. 분석 STT(whisper)와 실시간 세그먼트 디코드(ReazonSpeech) 공통.

    TS: `engine.stt.transcribe(audio, opts, traceId)`.
    """

    async def transcribe(self, audio: AudioData, request: SpeechRequest, ctx: EngineContext) -> TranscriptionResult:
        """오디오 전체를 한 번에 전사한다. 실시간 경로에서는 VAD 세그먼트 1개가 `audio` 다."""
        ...


@runtime_checkable
class RealtimeSttSession(Protocol):
    """WS 세션 1개에 대응하는 실시간 인식 세션(VAD 상태기계 + 세그먼트 디코드).

    생성은 `RealtimeSttEngine.open_session(...)` 이 한다. 프레임은 40ms PCM16 mono.
    콜백은 이벤트 루프에서 await 되므로 무거운 디코드는 구현이 스레드 풀로 넘긴다.
    """

    async def push_frame(self, pcm16_frame: bytes) -> None:
        """40ms 프레임 1개를 넣는다. VAD 전이 시 on_vad, 세그먼트 종료 시 디코드 → on_partial."""
        ...

    async def stop(self) -> TranscriptionResult:
        """남은 버퍼를 강제 세그먼트로 처리하고 전체 결과를 돌려준다(WS `stop` 또는 max_utterance_sec)."""
        ...

    async def close(self) -> None:
        """리소스 해제. stop 없이 끊긴 세션(idle timeout)에도 호출된다."""
        ...

    @property
    def elapsed_ms(self) -> int:
        """세션 시작 이후 받은 오디오 길이(ms). 상한 판정에 쓴다."""
        ...


@runtime_checkable
class RealtimeSttEngine(SpeechToTextEngine, Protocol):
    """실시간 세션을 열 수 있는 STT 엔진(ReazonSherpaEngine 이 구현)."""

    async def open_session(
        self,
        request: SpeechRequest,
        ctx: EngineContext,
        on_vad: VadCallback,
        on_partial: PartialCallback,
        on_final: FinalCallback,
    ) -> RealtimeSttSession:
        """세션을 만든다. `request.options` 의 endpoint_silence_ms 등 요청 단위 값을 적용한다."""
        ...


@runtime_checkable
class TextToSpeechEngine(Protocol):
    """문장 1건 합성. TS: `engine.tts.synthesize(req, traceId)`.

    입력 문장은 이미 `max_sentence_chars`(100) 이하로 분할되어 온다. 캐시는 호출자(앱/gateway) 책임.
    """

    async def synthesize(self, request: SpeechRequest, ctx: EngineContext) -> AudioData:
        """`request.text` 와 `request.voice` 로 wav 를 만든다. 반환 sample_rate 는 엔진 기본(SBV2 44.1kHz)."""
        ...

    async def list_voices(self, ctx: EngineContext) -> Sequence[Mapping[str, Any]]:
        """엔진이 아는 모델·화자·스타일 목록(정규화). VoiceModel 동기화 입력."""
        ...


@runtime_checkable
class EngineProvider(Protocol):
    """어댑터가 반드시 구현하는 4메서드. TS `EngineProvider` 와 1:1.

    - descriptor()            ↔ descriptor()
    - configuration_schema()  ↔ configurationSchema()
    - health_check(ctx)       ↔ healthCheck()
    - functional_test(ctx)    ↔ functionalTest()
    Health 와 Functional Test 는 분리한다(추가 기획안 §59): 전자는 가볍고 주기적, 후자는 실제 추론.
    """

    def descriptor(self) -> EngineDescriptor:
        ...

    def configuration_schema(self) -> ConfigurationSchema:
        ...

    async def health_check(self, ctx: EngineContext) -> HealthCheckResult:
        """프로세스·모델 로드·엔드포인트 응답만 본다. 추론하지 않는다."""
        ...

    async def functional_test(self, ctx: EngineContext, asset_path: Optional[str] = None) -> FunctionalTestResult:
        """실제 추론 1회. STT 는 `speech/test-assets/ja-sample.wav`, TTS 는 고정 문장, LLM 은 고정 JSON 스키마."""
        ...

    def engine(self) -> SpeechToTextEngine | TextToSpeechEngine:
        """이 provider 가 감싼 엔진 인스턴스(역할에 맞는 Protocol)."""
        ...


# ── 라우터 Protocol ──────────────────────────────────────────────────────────


@runtime_checkable
class SpeechEngineRouter(Protocol):
    """역할 → 활성 connection 선택 + fallback 순회. TS `engine.router` 와 규칙 동일.

    선택 규칙: EngineFallbackPolicy[role] 의 primary → fallbacks 순서, status 가
    UNAVAILABLE·DISABLED·MISCONFIGURED 인 connection 은 제외, 실패 시 다음 connection 으로 1회 재시도,
    실제 사용 connection_id 를 결과·트레이스에 기록.
    """

    async def resolve(self, role: EngineRole, request: SpeechRequest) -> EngineContext:
        """선택할 connection 이 없으면 EngineUnavailableError(HTTP 422 ENGINE_UNAVAILABLE 대응)."""
        ...

    async def with_fallback(
        self,
        role: EngineRole,
        request: SpeechRequest,
        fn: Callable[[EngineProvider, EngineContext], Awaitable[Any]],
    ) -> Any:
        """`fn` 을 primary 로 실행하고 실패 시 다음 connection 으로 1회 재시도한다."""
        ...
