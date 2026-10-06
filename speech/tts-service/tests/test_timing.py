"""timing 계산(엔진 중립) — 가짜 정렬 입력으로 프레임→ms·좌표 되돌리기·겹침 합치기·불변식·헤더를 확인한다.

실제 SBV2 정규화기로 도는 검사는 맨 아래(style_bert_vits2 가 설치된 M4 venv 에서만, 우분투는 skip).
"""

from __future__ import annotations

import base64
import json
import re
from collections.abc import Callable

import pytest
from conftest import HOP, SR, fake_alignment, fake_normalize

from kaiwa_tts.config import MAX_TEXT_CHARS
from kaiwa_tts.timing import (
    MAX_HEADER_BYTES,
    TIMING_MAX_TEXT_CHARS,
    AlignmentCapture,
    Timing,
    TimingError,
    WordTiming,
    align_to_source,
    compute_timing,
    decode_header,
    encode_header,
)

BENCH = [
    "今日は駅前の喫茶店で友達に会います。",
    "すみません、駅までの道を教えてください。",
    "キャッシュカードはコンビニでも使えますか？",
    "ええ、そうですね。ちょっと待ってください。",
    "毎朝コーヒーを飲みながらニュースを見る。",
    "もう一度ゆっくり言ってもらえますか。",
]


def _slices(source: str, spans: list[tuple[int, int]]) -> list[str]:
    return [source[a:b] for a, b in spans]


# ---- 좌표 되돌리기 ----


def test_align_identity_fast_path() -> None:
    src = "今日はいい天気ですね。"
    spans = align_to_source(src, fake_normalize(src), fake_normalize)
    assert spans == [(i, i + 1) for i in range(len(src))]


def test_align_drops_deleted_chars_and_counts_codepoints() -> None:
    # 공백·이모지(서로게이트 쌍 = 코드포인트 1개)·♪ 는 엔진 글에서 지워진다 — 대응 없음, 뒤 글자 좌표는 코드포인트 기준.
    src = " こん\U0001f600にちは♪！"
    target = fake_normalize(src)
    assert target == "こんにちは!"
    spans = align_to_source(src, target, fake_normalize)
    assert spans is not None
    assert _slices(src, spans) == ["こ", "ん", "に", "ち", "は", "！"]
    assert spans[2] == (4, 5)  # UTF-16 이라면 5 — 코드포인트라 4


def test_align_fullwidth_alnum_and_ellipsis() -> None:
    src = "ＯＫです…〜"
    target = fake_normalize(src)
    assert target == "OKです...ー"
    spans = align_to_source(src, target, fake_normalize)
    assert spans is not None
    assert _slices(src, spans) == ["Ｏ", "Ｋ", "で", "す", "…", "…", "…", "〜"]


def test_align_halfwidth_kana_with_voicing_mark_uses_prefix_path() -> None:
    src = "ｶﾞｲﾄﾞです"
    target = fake_normalize(src)
    assert target == "ガイドです"
    spans = align_to_source(src, target, fake_normalize)
    assert spans is not None
    assert _slices(src, spans) == ["ｶﾞ", "ｲ", "ﾄﾞ", "で", "す"]


def test_align_numbers_map_to_whole_digit_run() -> None:
    src = "3時15分です。"
    target = fake_normalize(src)
    assert target == "三時十五分です."
    spans = align_to_source(src, target, fake_normalize)
    assert spans is not None
    assert _slices(src, spans) == ["3", "時", "15", "15", "分", "で", "す", "。"]


def test_align_long_vowel_and_sokuon_are_plain() -> None:
    src = "ちょっと待ってー、カードっ！"
    spans = align_to_source(src, fake_normalize(src), fake_normalize)
    assert spans == [(i, i + 1) for i in range(len(src))]


def test_align_returns_none_when_target_is_not_the_normalization() -> None:
    assert align_to_source("こんにちは", "こんばんは", fake_normalize) is None
    assert align_to_source("", "", fake_normalize) == []


def test_align_outside_bmp_kanji_is_dropped_by_engine() -> None:
    # 𠮷(U+20BB7)은 엔진 허용 범위 밖이라 지워진다 — 뒤 단어 좌표가 코드포인트로 1부터.
    src = "\U00020bb7野家です"
    spans = align_to_source(src, fake_normalize(src), fake_normalize)
    assert spans is not None and spans[0] == (1, 2)


# ---- 프레임 → ms ----


def _capture(
    norm: str,
    counts: list[int],
    speech: list[bool],
    words: list[int],
    frames: list[int],
    *,
    blank: bool = True,
    normalize: Callable[[str], str] = fake_normalize,
) -> AlignmentCapture:
    return AlignmentCapture(
        normalized_text=norm,
        phone_counts=tuple(counts),
        phone_is_speech=tuple(speech),
        word_lengths=tuple(words),
        token_frames=tuple(frames),
        blank_interleaved=blank,
        samples_per_frame=HOP,
        normalize=normalize,
    )


def test_word_bounds_take_capped_share_of_neighbouring_blanks() -> None:
    # 글 "あい." — 음소: _ a i . _ (문자별 1·1·1). 토큰 11개 = blank 와 음소 교대.
    cap = _capture("あい.", [1, 1, 1, 1, 1], [False, True, True, False, False], [1, 1, 1], [2, 4, 2, 10, 4, 20, 6, 2, 2, 4, 2])
    samples = sum(cap.token_frames) * HOP
    t = compute_timing(cap, "あい。", samples, SR)
    frame_ms = HOP * 1000 / SR
    # 토큰 누적 프레임: blank0[0,2) _[2,6) blank2[6,8) a[8,18) blank4[18,22) i[22,42) blank6[42,48) …
    # あ = 8 − min(2/2, 1) = 7 → 18 + min(4/2, 1) = 19,  い = 22 − 1 = 21 → 42 + min(6/2, 1) = 43
    assert t.words == (
        WordTiming(round(7 * frame_ms), round(19 * frame_ms), 0, 1),
        WordTiming(round(21 * frame_ms), round(43 * frame_ms), 1, 2),
    )


def test_adjacent_words_never_overlap_in_time() -> None:
    for src in BENCH:
        cap, samples = fake_alignment(src)
        t = compute_timing(cap, src, samples, SR)
        assert all(a.end_ms <= b.start_ms for a, b in zip(t.words, t.words[1:]))
    assert t.duration_ms == round(samples * 1000 / SR)


def test_word_bounds_without_blank_tokens() -> None:
    cap = _capture("あい", [1, 1, 1, 1], [False, True, True, False], [2], [4, 6, 8, 2], blank=False)
    t = compute_timing(cap, "あい", 20 * HOP, SR)
    frame_ms = HOP * 1000 / SR
    assert t.words == (WordTiming(round(4 * frame_ms), round(18 * frame_ms), 0, 2),)


def test_punctuation_only_words_are_skipped_and_order_is_kept() -> None:
    for src in BENCH:
        cap, samples = fake_alignment(src)
        t = compute_timing(cap, src, samples, SR)
        assert t.words
        prev_end_char, prev_start = 0, -1
        for w in t.words:
            piece = src[w.char_start : w.char_end]
            assert piece and not re.fullmatch(r"[、。？！,.?!]+", piece)
            assert w.char_start >= prev_end_char and w.start_ms >= prev_start
            assert 0 <= w.start_ms < w.end_ms <= t.duration_ms
            prev_end_char, prev_start = w.char_end, w.start_ms


def test_overlapping_source_spans_are_merged() -> None:
    # 엔진이 "十" "五" 를 두 단어로 나눠도 원문은 둘 다 "15" — 한 단어로 합친다(화면은 겹침이 있으면 전체를 버림).
    norm = "三時十五分"
    counts = [1, 2, 2, 2, 2, 2, 1]
    speech = [False] + [True] * 10 + [False]
    frames = [1 if i % 2 == 0 else 3 for i in range(2 * 12 + 1)]
    cap = _capture(norm, counts, speech, [1, 1, 1, 1, 1], frames)
    t = compute_timing(cap, "3時15分", sum(frames) * HOP, SR)
    assert [(w.char_start, w.char_end) for w in t.words] == [(0, 1), (1, 2), (2, 4), (4, 5)]
    merged = t.words[2]
    assert merged.start_ms < merged.end_ms and t.words[3].start_ms >= merged.start_ms


def test_frame_invariant_and_tolerance() -> None:
    cap, samples = fake_alignment(BENCH[0])
    with pytest.raises(TimingError) as e:
        compute_timing(cap, BENCH[0], samples + 1, SR)
    assert e.value.status == "frame_mismatch"
    tol = 221  # PITCH_ADJUST_TOLERANCE_MS(5ms) @44.1kHz
    assert compute_timing(cap, BENCH[0], samples + 200, SR, tol).words
    with pytest.raises(TimingError):
        compute_timing(cap, BENCH[0], samples + 300, SR, tol)


@pytest.mark.parametrize(
    "change, status",
    [
        ({"token_frames": (1, 2, 3)}, "token_mismatch"),
        ({"phone_counts": (1, 1)}, "token_mismatch"),
        ({"phone_is_speech": (True,)}, "token_mismatch"),
        ({"word_lengths": (1,)}, "word_mismatch"),
        ({"samples_per_frame": 0}, "token_mismatch"),
    ],
)
def test_inconsistent_capture_is_rejected(change: dict[str, object], status: str) -> None:
    cap, samples = fake_alignment(BENCH[1])
    bad = AlignmentCapture(**{**cap.__dict__, **change})  # type: ignore[arg-type]
    with pytest.raises(TimingError) as e:
        compute_timing(bad, BENCH[1], samples, SR)
    assert e.value.status == status


def test_text_mismatch_when_request_text_does_not_normalize_to_engine_text() -> None:
    cap, samples = fake_alignment(BENCH[0])
    with pytest.raises(TimingError) as e:
        compute_timing(cap, "違う文です。", samples, SR)
    assert e.value.status == "text_mismatch"


def test_only_punctuation_is_empty() -> None:
    cap, samples = fake_alignment("。、！")
    with pytest.raises(TimingError) as e:
        compute_timing(cap, "。、！", samples, SR)
    assert e.value.status == "empty"


def test_leading_whitespace_shifts_coordinates_to_raw_request() -> None:
    raw = "  こんにちは。"
    cap, samples = fake_alignment(raw)
    t = compute_timing(cap, raw, samples, SR)
    assert t.words[0].char_start == 2 and raw[t.words[0].char_start : t.words[-1].char_end] == "こんにちは"


def test_cap_on_request_text_is_not_below_the_synthesis_limit() -> None:
    # 앱은 정규화 뒤 ≤100 코드포인트 조각만 보낸다(합성 상한과 같음) — 앞뒤 공백이 붙은 정상 요청도 too_long 에 걸리면 안 된다.
    assert TIMING_MAX_TEXT_CHARS > MAX_TEXT_CHARS


def test_request_text_over_cap_skips_alignment() -> None:
    calls: list[str] = []

    def counting(text: str) -> str:
        calls.append(text)
        return fake_normalize(text)

    cap, samples = fake_alignment(BENCH[0])
    cap = AlignmentCapture(**{**cap.__dict__, "normalize": counting})  # type: ignore[arg-type]
    at_cap = " " * (TIMING_MAX_TEXT_CHARS - len(BENCH[0])) + BENCH[0]
    t = compute_timing(cap, at_cap, samples, SR)  # 상한과 같은 길이는 계산한다(좌표는 원문 그대로)
    assert at_cap[t.words[0].char_start : t.words[0].char_end] == "今日"
    calls.clear()
    with pytest.raises(TimingError) as e:
        compute_timing(cap, " " + at_cap, samples, SR)
    assert e.value.status == "too_long"
    assert calls == []  # 정렬 계산(정규화 호출) 없이 바로 건너뛴다


# ---- 헤더 ----


def test_header_roundtrip_is_ascii_and_has_no_text() -> None:
    src = BENCH[2]
    cap, samples = fake_alignment(src)
    t = compute_timing(cap, src, samples, SR)
    value = encode_header(t)
    assert value is not None and re.fullmatch(r"[A-Za-z0-9_-]+", value)
    data = decode_header(value)
    assert data["v"] == 1 and data["method"] == "ENGINE_DURATION" and data["coord"] == "codepoint"
    assert data["durationMs"] == t.duration_ms
    assert data["words"] == [[w.start_ms, w.end_ms, w.char_start, w.char_end] for w in t.words]
    raw_json = base64.urlsafe_b64decode(value + "=" * (-len(value) % 4)).decode("ascii")
    assert not any(ord(ch) > 127 for ch in raw_json)
    assert set(json.loads(raw_json)) == {"v", "method", "alignerVersion", "coord", "durationMs", "words"}


def test_header_size_for_longest_allowed_sentence_is_well_under_cap() -> None:
    # 100자(요청 상한)·단어 100개 최악 가정에서도 상한 안 — 실제 문장은 단어가 더 적다.
    words = tuple(WordTiming(i * 120, i * 120 + 110, i, i + 1) for i in range(100))
    value = encode_header(Timing(duration_ms=12000, words=words))
    assert value is not None and len(value) < MAX_HEADER_BYTES


def test_header_over_cap_is_omitted() -> None:
    t = Timing(duration_ms=1000, words=(WordTiming(0, 100, 0, 1),))
    assert encode_header(t, max_bytes=10) is None
    assert encode_header(Timing(duration_ms=1000, words=())) is None


def test_decode_rejects_other_versions() -> None:
    bad = base64.urlsafe_b64encode(b'{"v":2,"words":[]}').decode().rstrip("=")
    with pytest.raises(ValueError):
        decode_header(bad)


# ---- 실제 SBV2 정규화기(M4 venv 에서만) ----


def test_align_with_real_engine_normalizer() -> None:
    normalizer = pytest.importorskip("style_bert_vits2.nlp.japanese.normalizer")
    normalize = normalizer.normalize_text
    cases = BENCH + ["3時15分に駅で会いましょう。", "ｶﾞｲﾄﾞは「ＯＫ」です…", " こん\U0001f600にちは♪！", "1,000円です。"]
    for src in cases:
        target = normalize(src)
        spans = align_to_source(src, target, normalize)
        assert spans is not None, src
        assert len(spans) == len(target)
        assert all(0 <= a < b <= len(src) for a, b in spans)
        assert spans == sorted(spans)
