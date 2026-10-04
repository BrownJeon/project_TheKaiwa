"""`POST /text/annotate`(task-026 S1) — 데모 v2 문장 8개·숫자·반각·영문 혼합 원문 대응, 내부 시크릿·상한, 분석기 불가 503.

실제 분석기(pyopenjtalk)가 있으면(dev venv) 데모 기대값과 대조하고, 없으면 그 테스트만 건너뛴다. 라우트·정렬 규칙은 가짜 노드로도 돈다.
"""

from __future__ import annotations

import asyncio
import threading
from typing import Any

import pytest

from kaiwa_gateway.text import MAX_CHARS, MAX_PENDING, MAX_TEXTS, TextAnnotator, TextBusyError, annotate_one

from .conftest import INTERNAL_SECRET, build_client, make_settings


def _pyopenjtalk() -> Any:
    try:
        import pyopenjtalk

        pyopenjtalk.run_frontend("テスト")
        return pyopenjtalk
    except Exception:  # noqa: BLE001
        return None


PJ = _pyopenjtalk()
needs_pj = pytest.mark.skipif(PJ is None, reason="pyopenjtalk 없음(dev venv 에서만)")


def ruby_markup(segs: list[dict[str, Any]]) -> str:
    out = ""
    for s in segs:
        if s["ruby"]:
            out += "".join(f"{t}{{{r}}}" if r else t for t, r in s["ruby"])
        else:
            out += s["surface"]
    return out


def pron_line(segs: list[dict[str, Any]]) -> str | None:
    if any(s["pron"] is None for s in segs):
        return None
    sep = {"phrase": " ", "particle": "|", None: ""}
    return "".join(sep[s["boundary"]] + s["pron"] for s in segs).strip()


# 데모 v2(docs/demo/task-026-improve-hangul-reading-v2.html) 회화·채팅 문장 — (원문, 루비 표기, 발음 줄).
DEMO = [
    ("今日は何を食べましたか？", "今日{きょう}は何{なに}を食{た}べましたか？", "キョーワ|ナニオ|タベマシタカ？"),
    ("こんにちは！今日は何をしましたか？", "こんにちは！今日{きょう}は何{なに}をしましたか？", "コンニチワ！ キョーワ|ナニオ|シマシタカ？"),
    (
        "友達と映画を見ました。とても面白いでした。",
        "友達{ともだち}と映画{えいが}を見{み}ました。とても面白{おもしろ}いでした。",
        "トモダチト エーガオ|ミマシタ。 トテモ オモシロイデシタ。",
    ),
    ("そうですか。どんな映画でしたか？", "そうですか。どんな映画{えいが}でしたか？", "ソーデスカ。 ドンナ エーガデシタカ？"),
    (
        "アクション映画です。主人公がかっこよかったです。",
        "アクション映画{えいが}です。主人公{しゅじんこう}がかっこよかったです。",
        "アクション エーガデス。 シュジンコーガ カッコヨカッタデス。",
    ),
    ("いいですね。また見に行きたいですか？", "いいですね。また見{み}に行{い}きたいですか？", "イーデスネ。 マタ ミニ イキタイデスカ？"),
    ("来週、続編を見に行きます。", "来週{らいしゅう}、続編{ぞくへん}を見{み}に行{い}きます。", "ライシュー、 ゾクヘンオ|ミニ イキマス。"),
    ("はじめまして！ブラウンです。", "はじめまして！ブラウンです。", "ハジメマシテ！ ブラウンデス。"),
]


@needs_pj
def test_demo_sentences_ruby_all_match_and_sound_matches() -> None:
    ruby_ok = 0
    exact_ok = 0
    for text, ja, p in DEMO:
        segs = annotate_one(text, PJ.run_frontend)
        assert "".join(s["surface"] for s in segs) == text
        ruby_ok += ruby_markup(segs) == ja
        line = pron_line(segs)
        assert line is not None
        # 소리(구분 기호 제외)는 데모와 같다 — 「いい」만 イイ/イー 표기 차이(한글은 둘 다 장음 표시).
        assert line.replace(" ", "").replace("|", "").replace("イイ", "イー") == p.replace(" ", "").replace("|", "")
        exact_ok += line == p
    assert ruby_ok == 8
    assert exact_ok >= 6  # 차이 2: 「アクション映画」를 한 악센트구로 묶음 · 「いい」イイ


@needs_pj
@pytest.mark.parametrize(
    ("text", "ruby", "pron"),
    [
        ("3時に会いましょう", "3時{じ}に会{あ}いましょう", "サンジニ アイマショー"),
        ("1,000円です", "1,000円{えん}です", "センエンデス"),
        ("ABCです 本当?", "ABCです 本当{ほんとう}?", "エイビーシーデス ホントー?"),
        ("20人で2.5時間", "20人{にん}で2.5時間{じかん}", "ニジューニンデ ニーテンゴジカン"),
        ("ﾃﾞｰﾀです", "ﾃﾞｰﾀです", "データデス"),
        ("3万円", "3万円{えん}", "サンマンエン"),
        ("今日は\n雨", "今日{きょう}は\n雨{あめ}", "キョーワ アメ"),
        ("持ち帰る", "持{も}ち帰{かえ}る", "モチカエル"),
        ("東京へ行きます", "東京{とうきょう}へ行{い}きます", "トーキョーエ|イキマス"),
    ],
)
def test_original_positions_survive_normalization(text: str, ruby: str, pron: str) -> None:
    segs = annotate_one(text, PJ.run_frontend)
    assert "".join(s["surface"] for s in segs) == text
    assert ruby_markup(segs) == ruby
    assert pron_line(segs) == pron


@needs_pj
@pytest.mark.parametrize(
    ("text", "ruby", "pron"),
    [
        # REV-086 H1: 문장 끝 「静か」를 분석기가 静(シズカ)+か 로 나눠 シズカカ 가 되던 것 — 합쳐서 바르게.
        ("この町は静か", "この町{まち}は静{しず}か", "コノ マチワ|シズカ"),
        ("とても静か", "とても静{しず}か", "トテモ シズカ"),
        ("静かです", "静{しず}かです", "シズカデス"),
        ("静かな", "静{しず}かな", "シズカナ"),
        # 읽기가 다음 조사로 끝나는 정상 분리는 합치지 않는다.
        ("人と話す", "人{ひと}と話{はな}す", "ヒトト ハナス"),
        ("中か外か", "中{なか}か外{そと}か", "ナカカ ソトカ"),
        ("赤か", "赤{あか}か", "アカカ"),
        # REV-087 N1: 다시 분석해도 같은 두 조각인 語幹 쌍은 안정된 정상 분리 — 숨기지 않는다.
        ("無駄だ", "無駄{むだ}だ", "ムダダ"),
        ("派手で", "派手{はで}で", "ハデデ"),
        ("見事と", "見事{みごと}と", "ミゴトト"),
        ("身近か", "身近{みぢか}か", "ミジカカ"),
    ],
)
def test_split_stem_and_trailing_kana(text: str, ruby: str, pron: str) -> None:
    segs = annotate_one(text, PJ.run_frontend)
    assert "".join(s["surface"] for s in segs) == text
    assert ruby_markup(segs) == ruby
    assert pron_line(segs) == pron


def test_split_stem_merge_or_hide_with_fake_frontend() -> None:
    stem = {**_node("静", "シズカ"), "pos_group1": "形容動詞語幹"}
    ka = _node("か", "カ", pos="助詞", chain=1)
    confirmed = {"静か": [stem, ka], "静かです": [_node("静か", "シズカ"), _node("です", "デス", pos="助動詞")]}
    segs = annotate_one("静か", lambda t: confirmed[t])
    assert segs == [{"surface": "静か", "ruby": [["静", "しず"], ["か", None]], "pron": "シズカ", "boundary": None}]
    # (b) 다시 분석해도 같은 두 조각(같은 읽기)이면 안정된 정상 분리 — 그대로 둔다.
    stable = {"静か": [stem, ka], "静かです": [stem, ka, _node("です", "デス", pos="助動詞")]}
    segs = annotate_one("静か", lambda t: stable[t])
    assert segs == [
        {"surface": "静", "ruby": [["静", "しずか"]], "pron": "シズカ", "boundary": None},
        {"surface": "か", "ruby": None, "pron": "カ", "boundary": None},
    ]
    # (c) 분해가 흔들리면(다른 조각·다른 읽기·재분석 실패) 語幹 쌍은 어느 쪽인지 모르므로 숨긴다.
    hidden = [{"surface": "静か", "ruby": None, "pron": None, "boundary": None}]
    other_split = {"静か": [stem, ka], "静かです": [stem, _node("かで", "カデ"), _node("す", "ス")]}
    assert annotate_one("静か", lambda t: other_split[t]) == hidden
    other_read = {"静か": [stem, ka], "静かです": [{**stem, "read": "セイ"}, ka, _node("です", "デス", pos="助動詞")]}
    assert annotate_one("静か", lambda t: other_read[t]) == hidden

    def failing(t: str) -> list[dict[str, Any]]:
        if t == "静か":
            return [stem, ka]
        raise RuntimeError("probe")

    assert annotate_one("静か", failing) == hidden


@needs_pj
def test_unknown_or_unmappable_spans_are_hidden_not_guessed() -> None:
    segs = annotate_one("2026年10月4日", PJ.run_frontend)
    assert "".join(s["surface"] for s in segs) == "2026年10月4日"
    for s in segs:
        if s["ruby"]:
            assert "".join(p[0] for p in s["ruby"]) == s["surface"]
    # 기호는 원문 그대로, 소리 없는 글자는 pron 에 원문을 흘리지 않는다.
    star = annotate_one("★です", PJ.run_frontend)
    assert star[0] == {"surface": "★", "ruby": None, "pron": "★", "boundary": None}


def _node(string: str, read: str, pron: str | None = None, pos: str = "名詞", chain: int = 0) -> dict[str, Any]:
    return {"string": string, "read": read, "pron": pron or read, "pos": pos, "chain_flag": chain}


def test_alignment_rules_with_fake_frontend() -> None:
    nodes = {
        "私は母": [_node("私", "ワタシ", chain=-1), _node("は", "ハ", "ワ", pos="助詞", chain=1), _node("母", "ハハ")],
        "ご注文を": [_node("ご注文", "ゴチュウモン", "ゴチューモン", chain=-1), _node("を", "ヲ", pos="助詞", chain=1)],
        "x?y": [_node("ｘ", "エックス", chain=-1), _node("？", "？", pos="記号"), _node("ｙ", "ワイ")],
        "未知": [_node("未知", "、", pos="記号", chain=-1)],
        "ずれ": [_node("ぜんぜんちがう", "ゼンゼンチガウ", chain=-1)],
    }
    segs = annotate_one("私は母", lambda t: nodes[t])
    assert [s["boundary"] for s in segs] == [None, None, "particle"]
    assert segs[1]["pron"] == "ワ" and segs[2]["ruby"] == [["母", "はは"]]
    segs = annotate_one("ご注文を", lambda t: nodes[t])
    assert segs[0]["ruby"] == [["ご", None], ["注文", "ちゅうもん"]]
    assert segs[1]["pron"] == "オ"
    segs = annotate_one("x?y", lambda t: nodes[t])
    assert [s["surface"] for s in segs] == ["x", "?", "y"] and segs[1]["pron"] == "?" and segs[2]["boundary"] == "phrase"
    segs = annotate_one("未知", lambda t: nodes[t])
    assert segs == [{"surface": "未知", "ruby": None, "pron": None, "boundary": None}]
    segs = annotate_one("ずれ", lambda t: nodes[t])
    assert segs == [{"surface": "ずれ", "ruby": None, "pron": None, "boundary": None}]
    assert annotate_one("", lambda t: []) == []


def _client(tmp_path: Any, annotator: TextAnnotator) -> Any:
    from kaiwa_gateway.server import create_app
    from kaiwa_speech_common.router import SpeechEngineRouter

    from .conftest import GatewayTestClient

    settings = make_settings(tmp_path)
    app = create_app(settings, router=SpeechEngineRouter(settings), load_engine=False, annotator=annotator)
    return GatewayTestClient(app)


H = {"x-internal-secret": INTERNAL_SECRET}


def test_route_requires_internal_secret(tmp_path: Any) -> None:
    client = _client(tmp_path, TextAnnotator(lambda t: [_node(t, "テスト")]))
    assert client.post("/text/annotate", json={"texts": ["テスト"]}).status_code == 401
    assert client.post("/text/annotate", json={"texts": ["テスト"]}, headers={"x-internal-secret": "wrong"}).status_code == 401
    r = client.post("/text/annotate", json={"texts": ["テスト", "\x00"]}, headers=H)
    assert r.status_code == 200
    body = r.json()
    assert body["items"][0]["segments"][0]["surface"] == "テスト"
    assert body["items"][1] is None  # 제어 문자는 분석기에 넣지 않는다


def test_route_limits(tmp_path: Any) -> None:
    client = _client(tmp_path, TextAnnotator(lambda t: [_node(t, "テスト")]))
    assert client.post("/text/annotate", json={"texts": []}, headers=H).status_code == 400
    assert client.post("/text/annotate", json={"texts": [1]}, headers=H).status_code == 400
    assert client.post("/text/annotate", content=b"{", headers={**H, "content-type": "application/json"}).status_code == 400
    deep = client.post("/text/annotate", content=b"[" * 100_000 + b"]" * 100_000, headers={**H, "content-type": "application/json"})
    assert deep.status_code == 400 and deep.json() == {"error": {"code": "BAD_JSON"}}
    assert client.post("/text/annotate", json={"texts": ["あ"] * (MAX_TEXTS + 1)}, headers=H).status_code == 413
    assert client.post("/text/annotate", json={"texts": ["あ" * (MAX_CHARS + 1)]}, headers=H).status_code == 413
    big = b'{"texts":["' + b"a" * 300_000 + b'"]}'
    assert client.post("/text/annotate", content=big, headers={**H, "content-type": "application/json"}).status_code == 413


def test_route_503_when_analyzer_failed(tmp_path: Any) -> None:
    annotator = TextAnnotator(lambda t: [])
    annotator.state = "FAILED"
    client = _client(tmp_path, annotator)
    r = client.post("/text/annotate", json={"texts": ["テスト"]}, headers=H)
    assert r.status_code == 503 and r.json() == {"error": {"code": "NOT_READY"}}


def test_health_detail_shows_analyzer_state_only_with_secret(tmp_path: Any) -> None:
    client = build_client(make_settings(tmp_path), None)
    assert "textAnalyzer" not in client.get("/health").json()
    detail = client.get("/health", headers=H).json()
    assert detail["textAnalyzer"]["state"] in ("IDLE", "OK", "FAILED")


# ── 대기열 상한(REV-089) ──────────────────────────────────────────────────


def _blocking_annotator() -> tuple[TextAnnotator, threading.Event]:
    gate = threading.Event()

    def frontend(t: str) -> list[dict[str, Any]]:
        gate.wait(5)
        return [_node(t, "テスト")]

    return TextAnnotator(frontend), gate


def test_pending_limit_accepts_exactly_max_then_busy() -> None:
    async def run() -> None:
        annotator, gate = _blocking_annotator()
        tasks = [asyncio.ensure_future(annotator.annotate(["テスト"])) for _ in range(MAX_PENDING + 3)]
        await asyncio.sleep(0.05)
        busy = [t for t in tasks if t.done()]
        assert len(busy) == 3 and all(isinstance(t.exception(), TextBusyError) for t in busy)
        assert annotator.pending == MAX_PENDING
        gate.set()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        assert sum(1 for r in results if isinstance(r, list)) == MAX_PENDING
        assert annotator.pending == 0
        assert (await annotator.annotate(["テスト"]))[0] is not None  # 비면 다시 받는다
        annotator.shutdown()

    asyncio.run(run())


def test_pending_recovers_after_error_and_cancel() -> None:
    async def run() -> None:
        annotator, gate = _blocking_annotator()
        running = asyncio.ensure_future(annotator.annotate(["テスト"]))
        queued = asyncio.ensure_future(annotator.annotate(["テスト"]))
        await asyncio.sleep(0.05)
        assert annotator.pending == 2
        queued.cancel()
        with pytest.raises(asyncio.CancelledError):
            await queued
        assert annotator.pending == 1
        gate.set()
        await running
        assert annotator.pending == 0

        def broken(texts: list[str]) -> list[Any]:
            raise RuntimeError("TEXT_ANALYZER_UNAVAILABLE")

        annotator._run = broken  # type: ignore[method-assign]
        with pytest.raises(RuntimeError):
            await annotator.annotate(["テスト"])
        assert annotator.pending == 0
        annotator.shutdown()

    asyncio.run(run())


def test_route_503_busy_is_distinct_from_not_ready(tmp_path: Any) -> None:
    annotator = TextAnnotator(lambda t: [_node(t, "テスト")])
    client = _client(tmp_path, annotator)
    annotator._pending = MAX_PENDING
    r = client.post("/text/annotate", json={"texts": ["ひみつの文"]}, headers=H)
    assert r.status_code == 503 and r.json() == {"error": {"code": "BUSY"}}
    assert "ひみつ" not in r.text
    annotator._pending = 0
    assert client.post("/text/annotate", json={"texts": ["テスト"]}, headers=H).status_code == 200
    annotator.state = "FAILED"
    r = client.post("/text/annotate", json={"texts": ["テスト"]}, headers=H)
    assert r.status_code == 503 and r.json() == {"error": {"code": "NOT_READY"}}
