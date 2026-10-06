"""Timing Metadata(speech-platform/16 §8) — 합성이 실제로 쓴 프레임 배분으로 단어 시작·끝 ms 를 만든다.

엔진 중립: 백엔드가 `AlignmentCapture`(엔진이 다시 정규화한 글·문자별 음소 수·음소별 발화 여부·단어 길이·토큰별
프레임 수)를 채우고, 이 파일은 그 숫자만으로 계산한다(모델·torch 없이 계약 테스트가 전부 돈다).

좌표는 **요청 `text` 그대로의 코드포인트**다. 엔진은 받은 글을 한 번 더 바꾸므로(`。`→`.`, 숫자→한자, 기호 삭제)
엔진 글 좌표를 요청 글 좌표로 되돌린다(`align_to_source`). 앱은 이 좌표를 자기 정규화 token map 으로 한 번 더 되돌린다.
"""

from __future__ import annotations

import base64
import json
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Any

from .config import MAX_TEXT_CHARS

TIMING_HEADER = "X-Tts-Timing"
FORMAT_VERSION = 1
METHOD = "ENGINE_DURATION"
ALIGNER_VERSION = "engine-duration-1"
# base64url 길이 상한. 100자 문장(단어 ≤60)이 ≈2KB 라 평소엔 닿지 않는다. 앱 → 브라우저 구간은 nginx
# proxy_buffer_size(기본 4KB, 응답 헤더 전체) 를 지나므로 그보다 작게 둔다.
MAX_HEADER_BYTES = 4096
# pitch·intonation 후처리(pyworld) 는 프레임 주기 5ms 단위로 다시 합성해 길이가 조금 달라진다(M4 실측 ≤4.4ms).
PITCH_ADJUST_TOLERANCE_MS = 5.0
BLANK_SHARE_MAX_FRAMES = 1.0
# 요청 `text` 원본(코드포인트) 상한 — 넘으면 정렬 계산을 건너뛴다(`too_long`, 오디오는 그대로). 원본은 스키마상 4096자까지
# 오고(앞뒤 공백·NFC 결합 전 글자는 합성 100자 검사에 안 걸림) align_to_source 접두사 경로는 길이에 대해 O(n²)라 단일 워커를
# 붙잡는다(M4 실측, 실제 정규화기: 숫자 100자+공백 3,996자 171ms vs 숫자 100자+공백 100자 4.3ms). 앱은 정규화 뒤
# ≤100 코드포인트 조각만 보내므로 그 2배면 정상 요청은 닿지 않는다.
TIMING_MAX_TEXT_CHARS = 2 * MAX_TEXT_CHARS

STATUS_OK = "ok"


class TimingError(Exception):
    """timing 을 만들 수 없다 — 오디오는 정상이고 헤더만 생략한다. `status` 는 응답 헤더 `X-Kaiwa-Timing` 값."""

    def __init__(self, status: str) -> None:
        super().__init__(status)
        self.status = status


@dataclass(frozen=True)
class AlignmentCapture:
    """한 번의 합성에서 엔진이 쓴 텍스트·음소·프레임 정보(엔진 이름·파라미터 없음)."""

    normalized_text: str
    # [앞 경계 음소 수] + 정규화 글 문자별 음소 수 + [뒤 경계 음소 수] — 길이 = len(normalized_text) + 2
    phone_counts: tuple[int, ...]
    # 음소별 발화 여부(경계·구두점 = False) — 길이 = sum(phone_counts)
    phone_is_speech: tuple[bool, ...]
    # 엔진 단어 분할 길이(정규화 글 문자 수) — 합 = len(normalized_text)
    word_lengths: tuple[int, ...]
    # 모델 입력 토큰별 프레임 수. blank_interleaved 면 [blank, 음소0, blank, 음소1, …, blank] (2N+1)
    token_frames: tuple[int, ...]
    blank_interleaved: bool
    samples_per_frame: int
    normalize: Callable[[str], str]


@dataclass(frozen=True)
class WordTiming:
    start_ms: int
    end_ms: int
    char_start: int
    char_end: int


@dataclass(frozen=True)
class Timing:
    duration_ms: int
    words: tuple[WordTiming, ...]


def align_to_source(source: str, target: str, normalize: Callable[[str], str]) -> list[tuple[int, int]] | None:
    """`target`(= normalize(source)) 의 문자마다 그 문자를 만든 `source` 구간 [start, end) (코드포인트).

    1) 문자 하나씩 정규화해 이어 붙인 것이 target 과 같으면 문자 단위 대응(대부분의 문장, 문장당 수 µs).
    2) 아니면(숫자 `15`→`十五`, 반각 탁점 `ｶﾞ`→`ガ` 같은 문맥 변환) 접두사 정규화로 끊을 수 있는 지점만 찾아
       그 사이 블록끼리 대응시킨다 — 끊는 지점마다 normalize(source[:i]) 가 target 의 접두사인지 실제 함수로 확인한다.
    source 쪽에서 지워진 문자(공백·이모지·기호)는 어떤 target 문자에도 대응하지 않는다. 대응을 못 찾으면 None.
    """
    parts = [normalize(ch) for ch in source]
    if "".join(parts) == target:
        spans: list[tuple[int, int]] = []
        for i, part in enumerate(parts):
            spans.extend([(i, i + 1)] * len(part))
        return spans
    if normalize(source) != target:
        return None
    spans = []
    cut_src, cut_dst = 0, 0
    for i in range(1, len(source) + 1):
        head = normalize(source[:i])
        if len(head) < cut_dst or not target.startswith(head):
            continue
        spans.extend([(cut_src, i)] * (len(head) - cut_dst))
        cut_src, cut_dst = i, len(head)
    return spans if cut_dst == len(target) else None


def _validate(cap: AlignmentCapture, audio_samples: int, tolerance_samples: int) -> None:
    n_chars = len(cap.normalized_text)
    n_phones = sum(cap.phone_counts)
    if len(cap.phone_counts) != n_chars + 2 or any(c < 0 for c in cap.phone_counts) or len(cap.phone_is_speech) != n_phones:
        raise TimingError("token_mismatch")
    expected_tokens = 2 * n_phones + 1 if cap.blank_interleaved else n_phones
    if len(cap.token_frames) != expected_tokens or any(f < 0 for f in cap.token_frames) or cap.samples_per_frame <= 0:
        raise TimingError("token_mismatch")
    # 디코더는 프레임 하나당 정확히 samples_per_frame 샘플을 만든다 — 어긋나면 엔진 내부 구조가 바뀐 것이다.
    if abs(sum(cap.token_frames) * cap.samples_per_frame - audio_samples) > tolerance_samples:
        raise TimingError("frame_mismatch")
    if sum(cap.word_lengths) != n_chars or any(n <= 0 for n in cap.word_lengths):
        raise TimingError("word_mismatch")


def _phone_bounds(cap: AlignmentCapture) -> list[tuple[float, float]]:
    """음소별 [시작, 끝) 샘플. blank 를 끼운 모델은 음소 토큰 앞뒤 blank 의 절반을, 최대 BLANK_SHARE_MAX_FRAMES 까지만
    음소 쪽으로 넓힌다. 같은 음성의 강제정렬과 비교(스파이크 23문장·237단어)에서 단어 시작 |오차| 가
    토큰 경계 그대로 p50 18 · p95 50 · 편향 −11ms, blank 가운데 p50 11 · p95 68 · 최대 166ms(쉼표 뒤 긴 쉼의 절반이
    앞당겨짐), 1프레임 상한 p50 12 · p95 42 · 최대 79 · 편향 0ms 였다. 앞뒤 단어가 같은 blank 를 나눠 가지므로
    상한이 있어도 단어 시간은 겹치지 않는다."""
    cum = [0]
    for f in cap.token_frames:
        cum.append(cum[-1] + f)
    spf = cap.samples_per_frame
    share = BLANK_SHARE_MAX_FRAMES
    bounds: list[tuple[float, float]] = []
    for j in range(len(cap.phone_is_speech)):
        if cap.blank_interleaved:
            t = 2 * j + 1
            start = cum[t] - min((cum[t] - cum[t - 1]) / 2, share)
            end = cum[t + 1] + min((cum[t + 2] - cum[t + 1]) / 2, share)
        else:
            start, end = cum[j], cum[j + 1]
        bounds.append((start * spf, end * spf))
    return bounds


def compute_timing(
    cap: AlignmentCapture,
    source_text: str,
    audio_samples: int,
    sample_rate: int,
    tolerance_samples: int = 0,
) -> Timing:
    """단어(엔진 단어 분할, 발화 음소가 있는 것만) 시작·끝 ms 와 요청 글 좌표. 못 만들면 TimingError."""
    if len(source_text) > TIMING_MAX_TEXT_CHARS:
        raise TimingError("too_long")
    if sample_rate <= 0 or audio_samples <= 0:
        raise TimingError("frame_mismatch")
    _validate(cap, audio_samples, tolerance_samples)
    spans = align_to_source(source_text, cap.normalized_text, cap.normalize)
    if spans is None:
        raise TimingError("text_mismatch")
    bounds = _phone_bounds(cap)
    first_phone = [0] * (len(cap.normalized_text) + 1)
    acc = cap.phone_counts[0]
    for c in range(len(cap.normalized_text)):
        first_phone[c] = acc
        acc += cap.phone_counts[c + 1]
    first_phone[len(cap.normalized_text)] = acc

    duration_ms = round(audio_samples * 1000 / sample_rate)
    words: list[WordTiming] = []
    c0 = 0
    for length in cap.word_lengths:
        c1 = c0 + length
        speech = [j for j in range(first_phone[c0], first_phone[c1]) if cap.phone_is_speech[j]]
        if speech:
            char_start = min(spans[c][0] for c in range(c0, c1))
            char_end = max(spans[c][1] for c in range(c0, c1))
            start_ms = max(0, min(duration_ms, round(bounds[speech[0]][0] * 1000 / sample_rate)))
            end_ms = max(0, min(duration_ms, round(bounds[speech[-1]][1] * 1000 / sample_rate)))
            words.append(WordTiming(start_ms, end_ms, char_start, char_end))
        c0 = c1
    merged = _merge_overlaps(words)
    if not merged:
        raise TimingError("empty")
    return Timing(duration_ms=duration_ms, words=merged)


def _merge_overlaps(words: Sequence[WordTiming]) -> tuple[WordTiming, ...]:
    """요청 글 구간이 겹치는 이웃 단어를 합친다(예: `15`→`十`·`五` 두 단어가 같은 원문 `15` 를 가리킴).
    화면은 구간이 겹치면 timing 전체를 버리므로 여기서 겹침 0·오름차순을 보장한다."""
    out: list[WordTiming] = []
    for w in words:
        if w.char_end <= w.char_start:
            continue
        if out and w.char_start < out[-1].char_end:
            prev = out[-1]
            out[-1] = WordTiming(prev.start_ms, max(prev.end_ms, w.end_ms), prev.char_start, max(prev.char_end, w.char_end))
            continue
        out.append(w)
    fixed: list[WordTiming] = []
    for w in out:
        end = w.end_ms if w.end_ms > w.start_ms else w.start_ms + 1
        fixed.append(WordTiming(w.start_ms, end, w.char_start, w.char_end))
    return tuple(fixed)


def timing_payload(timing: Timing) -> dict[str, Any]:
    """헤더 JSON. 단어는 [startMs, endMs, charStart, charEnd] 4-튜플(크기 절약). 글·음소·엔진 이름은 싣지 않는다."""
    return {
        "v": FORMAT_VERSION,
        "method": METHOD,
        "alignerVersion": ALIGNER_VERSION,
        "coord": "codepoint",
        "durationMs": timing.duration_ms,
        "words": [[w.start_ms, w.end_ms, w.char_start, w.char_end] for w in timing.words],
    }


def encode_header(timing: Timing, max_bytes: int = MAX_HEADER_BYTES) -> str | None:
    """base64url(패딩 없음) JSON. 상한을 넘으면 None — 호출자는 헤더를 생략한다."""
    if not timing.words:
        return None
    raw = json.dumps(timing_payload(timing), separators=(",", ":")).encode("ascii")
    value = base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")
    return value if len(value) <= max_bytes else None


def decode_header(value: str) -> dict[str, Any]:
    """encode_header 의 역(테스트·운영 확인 스크립트용). 형식이 깨졌으면 ValueError."""
    padded = value + "=" * (-len(value) % 4)
    data = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")))
    if not isinstance(data, dict) or data.get("v") != FORMAT_VERSION or not isinstance(data.get("words"), list):
        raise ValueError("unsupported timing header")
    return data
