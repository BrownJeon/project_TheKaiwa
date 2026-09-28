"""TranscriptComparator — README §4·§7 사례. 가짜 읽기(표)로 규칙을, pyopenjtalk 가 있으면 실제 읽기로 한 번 더."""

from __future__ import annotations

import pytest

from kaiwa_worker.comparator import OpenJTalkReading, ReadingUnavailableError, TranscriptComparator, kata_to_hira, keep_letters, levenshtein
from tests.conftest import TableReading


def cmp(table: dict[str, str] | None = None) -> TranscriptComparator:
    return TranscriptComparator(TableReading(table))


def test_levenshtein_basics() -> None:
    assert levenshtein("", "") == 0
    assert levenshtein("abc", "") == 3
    assert levenshtein("kitten", "sitting") == 3
    assert levenshtein("あいう", "あいう") == 0


def test_kana_fold_and_punctuation() -> None:
    assert kata_to_hira("コンニチワ") == "こんにちわ"
    assert kata_to_hira("ラーメン") == "らーめん", "장음 기호는 그대로"
    assert keep_letters("え、本当？！ 「はい」…") == "え本当はい"


def test_greeting_katakana_vs_hiragana_folds_to_same() -> None:
    # g2p 는 「こんにちは」를 발음대로 コンニチワ 로 읽는다 — 가짜 읽기도 같게.
    c = cmp({"こんにちは": "コンニチワ"})
    r = c.compare("こんにちは。", "コンニチワ")
    assert r.similarity == 1.0 and r.flags == ()


def test_kanji_vs_reading_is_one() -> None:
    c = cmp({"今日": "キョー", "きょう": "キョー"})
    assert c.compare("今日", "きょう").similarity == 1.0


def test_kanji_numeral_vs_digit() -> None:
    c = cmp({"七時": "シチジ", "7時": "シチジ"})
    assert c.compare("七時に起きました", "7時に起きました").similarity == 1.0


def test_fullwidth_digits_nfkc() -> None:
    c = cmp({"7時": "シチジ"})
    assert c.compare("７時", "7時").similarity == 1.0


def test_empty_rules() -> None:
    c = cmp()
    r = c.compare("こんにちは", "")
    assert r.similarity == 0.0 and r.flags == ("ANALYSIS_EMPTY",) and not r.both_empty
    r = c.compare("", "こんにちは")
    assert r.similarity == 0.0 and r.flags == ("REALTIME_EMPTY",)
    r = c.compare("。", "  ")
    assert r.both_empty and r.flags == ()


def test_length_ratio_flag() -> None:
    c = cmp()
    r = c.compare("はい", "はいそうですねありがとう")
    assert "LENGTH_RATIO" in r.flags and r.similarity < 0.85
    assert "LENGTH_RATIO" not in c.compare("はいそうです", "はいそうですね").flags


def test_similarity_partial_difference() -> None:
    c = cmp()
    r = c.compare("きのうがっこうにいった", "きのうがっこうにいって")
    assert 0.85 < r.similarity < 1.0 and r.flags == ()
    assert r.realtime_len == 11 and r.analysis_len == 11


def test_repr_has_no_text() -> None:
    r = cmp().compare("ひみつのぶん", "ひみつのぶん")
    assert "ひみつ" not in repr(r)


def test_reading_unavailable_raises() -> None:
    t = TableReading()
    t.ok = False
    with pytest.raises(ReadingUnavailableError):
        t.check()


def _openjtalk() -> OpenJTalkReading | None:
    r = OpenJTalkReading()
    try:
        r.check()
    except ReadingUnavailableError:
        return None
    return r


@pytest.mark.skipif(_openjtalk() is None, reason="pyopenjtalk 없음(dev venv 에서만)")
def test_real_reading_cases() -> None:
    reading = _openjtalk()
    assert reading is not None
    c = TranscriptComparator(reading)
    assert c.compare("こんにちは。", "コンニチワ").similarity == 1.0
    assert c.compare("今日", "きょう").similarity == 1.0
    assert c.compare("七時", "7時").similarity == 1.0
    assert c.compare("二百円です", "200円です").similarity == 1.0
    assert c.compare("7%", "七パーセント").similarity == 1.0
    assert reading.version.startswith("pyopenjtalk-")
