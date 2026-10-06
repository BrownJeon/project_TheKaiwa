"""Sbv2Backend 의 정렬 정보 잡기 — 모듈 속성 감싸기(`models.infer.clean_text`)와 재호출 경로를 가짜 SBV2 로 확인한다.

모듈 속성 감싸기는 프로세스 전역이므로 ① 원래 반환값을 그대로(같은 객체) 돌려주는지 ② 잡기가 실패하면 재호출 경로로
떨어지는지 ③ 두 경로의 결과가 같은지 ④ 모델 입력 토큰과 다르면 버리는지를 못 박는다. 실제 SBV2 로는 M4 에서
`scripts/check_timing.py`(--no-text-capture · --break-capture)가 같은 것을 확인한다.
"""

from __future__ import annotations

import importlib.util
import logging
import sys
import threading
import types
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import numpy as np
import pytest
from conftest import HOP, PUNCT, SR, fake_normalize

import kaiwa_tts.backend as backend_mod
from kaiwa_tts.backend import Sbv2Backend
from kaiwa_tts.models import ModelSpec
from kaiwa_tts.timing import TimingError, compute_timing

BLANK_FRAMES = 1
PHONE_FRAMES = 3


class FakeTensor:
    """`_capture_alignment`·`_materialize_alignment` 가 쓰는 torch 텐서 메서드만 흉내 낸다."""

    def __init__(self, a: Any) -> None:
        self.a = np.asarray(a)

    def __getitem__(self, idx: Any) -> FakeTensor:
        return FakeTensor(self.a[idx])

    def sum(self, dim: int) -> FakeTensor:
        return FakeTensor(self.a.sum(axis=dim))

    def round(self) -> FakeTensor:
        return FakeTensor(np.round(self.a))

    def long(self) -> FakeTensor:
        return FakeTensor(self.a.astype(np.int64))

    def cpu(self) -> FakeTensor:
        return self

    def reshape(self, *shape: int) -> FakeTensor:
        return FakeTensor(self.a.reshape(*shape))

    def tolist(self) -> Any:
        return self.a.tolist()


def _phones(norm: str) -> tuple[list[str], list[int]]:
    phones = ["_"]
    counts = [1]
    for ch in norm:
        if ch in PUNCT:
            phones.append(ch)
            counts.append(1)
        else:
            phones += [f"{ch}:a", f"{ch}:b"]
            counts.append(2)
    return phones + ["_"], counts + [1]


def _words(norm: str) -> list[str]:
    out: list[str] = []
    prev = ""
    for ch in norm:
        kind = "p" + ch if ch in PUNCT else ("hira" if "぀" <= ch <= "ゟ" else "kata" if "゠" <= ch <= "ヿ" else "kanji")
        if out and kind == prev and not kind.startswith("p"):
            out[-1] += ch
        else:
            out.append(ch)
        prev = kind
    return out


class FakeSbv2:
    """가짜 style_bert_vits2 — 공개 clean_text 호출 수와 models.infer 의 get_text 흐름(word2ph 제자리 수정)을 재현한다."""

    def __init__(self) -> None:
        self.public_calls = 0
        self.vocab: dict[str, int] = {"_": 0}
        self.infer_mod = types.ModuleType("style_bert_vits2.models.infer")
        self.infer_mod.clean_text = self._clean_text  # type: ignore[attr-defined]
        self.original_clean_text = self.infer_mod.clean_text  # type: ignore[attr-defined]

    def _clean_text(self, text: str, language: str, use_jp_extra: bool = True, raise_yomi_error: bool = False) -> Any:
        norm = fake_normalize(text)
        phones, counts = _phones(norm)
        return norm, phones, [0] * len(phones), counts

    def public_clean_text(self, *args: Any, **kwargs: Any) -> Any:
        self.public_calls += 1
        return self._clean_text(*args, **kwargs)

    def to_sequence(self, phones: list[str], tones: list[int], language: str) -> tuple[list[int], list[int], list[int]]:
        ids = [self.vocab.setdefault(p, len(self.vocab)) for p in phones]
        return ids, list(tones), [0] * len(ids)

    def get_text(self, text: str) -> list[int]:
        # SBV2 2.5.0 models/infer.py get_text 와 같은 순서: 모듈 전역 clean_text → 토큰화 → blank 끼우기 → word2ph 제자리 ×2.
        _norm, phones, tones, word2ph = self.infer_mod.clean_text(text, "JP", use_jp_extra=True, raise_yomi_error=False)
        ids, _, _ = self.to_sequence(phones, tones, "JP")
        inter = [0] * (2 * len(ids) + 1)
        inter[1::2] = ids
        for i in range(len(word2ph)):
            word2ph[i] *= 2
        word2ph[0] += 1
        return inter

    def install(self, monkeypatch: pytest.MonkeyPatch) -> None:
        root = types.ModuleType("style_bert_vits2")
        models = types.ModuleType("style_bert_vits2.models")
        models.infer = self.infer_mod  # type: ignore[attr-defined]
        constants = types.ModuleType("style_bert_vits2.constants")
        constants.Languages = types.SimpleNamespace(JP="JP")  # type: ignore[attr-defined]
        nlp = types.ModuleType("style_bert_vits2.nlp")
        nlp.clean_text = self.public_clean_text  # type: ignore[attr-defined]
        nlp.cleaned_text_to_sequence = self.to_sequence  # type: ignore[attr-defined]
        g2p = types.ModuleType("style_bert_vits2.nlp.japanese.g2p")
        g2p.text_to_sep_kata = lambda norm, raise_yomi_error=False: (_words(norm), [])  # type: ignore[attr-defined]
        normalizer = types.ModuleType("style_bert_vits2.nlp.japanese.normalizer")
        normalizer.normalize_text = fake_normalize  # type: ignore[attr-defined]
        symbols = types.ModuleType("style_bert_vits2.nlp.symbols")
        symbols.PUNCTUATION_SYMBOLS = ["!", "?", "…", ",", ".", "'", "-", "SP", "UNK"]  # type: ignore[attr-defined]
        for name, mod in {
            "style_bert_vits2": root,
            "style_bert_vits2.models": models,
            "style_bert_vits2.models.infer": self.infer_mod,
            "style_bert_vits2.constants": constants,
            "style_bert_vits2.nlp": nlp,
            "style_bert_vits2.nlp.japanese": types.ModuleType("style_bert_vits2.nlp.japanese"),
            "style_bert_vits2.nlp.japanese.g2p": g2p,
            "style_bert_vits2.nlp.japanese.normalizer": normalizer,
            "style_bert_vits2.nlp.symbols": symbols,
        }.items():
            monkeypatch.setitem(sys.modules, name, mod)


class FakeNet:
    def infer(self, x: FakeTensor, *args: Any, **kwargs: Any) -> tuple[Any, ...]:
        ids = x.a.reshape(-1).tolist()
        frames = [BLANK_FRAMES if i % 2 == 0 else PHONE_FRAMES for i in range(len(ids))]
        attn = np.zeros((1, 1, sum(frames), len(ids)))
        row = 0
        for k, f in enumerate(frames):
            attn[0, 0, row : row + f, k] = 1
            row += f
        return FakeTensor(np.zeros((1, 1, sum(frames) * HOP))), FakeTensor(attn), None


class FakeModel:
    """TTSModel 흉내 — infer 는 get_text 로 토큰을 만들고 net_g.infer(인스턴스 속성 — 감싼 것)를 부른다."""

    def __init__(self, sbv2: FakeSbv2) -> None:
        self.sbv2 = sbv2
        self.device = "cpu"
        self.net = FakeNet()
        self.hyper_parameters = types.SimpleNamespace(version="2.5.0-JP-Extra", data=types.SimpleNamespace(add_blank=True, hop_length=HOP))

    def infer(self, language: str, text: str, **kwargs: Any) -> tuple[int, Any]:
        ids = self.sbv2.get_text(text)
        out = self.net.infer(FakeTensor([ids]))
        n = out[0].a.size
        return SR, (np.sin(np.arange(n) / 20) * 20000).astype(np.int16)


@pytest.fixture
def sbv2(monkeypatch: pytest.MonkeyPatch) -> Iterator[FakeSbv2]:
    fake = FakeSbv2()
    fake.install(monkeypatch)
    if importlib.util.find_spec("torch") is None:
        monkeypatch.setitem(sys.modules, "torch", types.ModuleType("torch"))
    monkeypatch.setattr(backend_mod, "_TEXT_CAPTURE_INSTALLED", False)
    yield fake
    for name in ("text", "cleaned", "frames_t", "ids_t", "frames", "ids"):
        setattr(backend_mod._SLOT, name, None)


def _model(sbv2: FakeSbv2) -> tuple[Sbv2Backend, FakeModel]:
    backend = Sbv2Backend("bert")
    model = FakeModel(sbv2)
    backend._capture_alignment(model.net)
    return backend, model


TEXT = "今日は駅前で、友達に会います。"


# ---- ① 원래 반환값 그대로 ----


def test_capture_returns_the_original_object_and_keeps_its_own_copy(sbv2: FakeSbv2) -> None:
    returned: list[Any] = []

    def original(*args: Any, **kwargs: Any) -> Any:
        out = sbv2._clean_text(*args, **kwargs)
        returned.append(out)
        return out

    sbv2.infer_mod.clean_text = original  # type: ignore[attr-defined]
    backend_mod._install_text_capture()
    wrapped = sbv2.infer_mod.clean_text  # type: ignore[attr-defined]
    assert wrapped is not original
    out = wrapped(TEXT, "JP", use_jp_extra=True, raise_yomi_error=False)
    assert out is returned[0]  # 같은 객체 — 감싸기가 값을 바꾸거나 새로 만들지 않는다
    norm, phones, _tones, word2ph = out
    before = list(word2ph)
    word2ph[0] += 99  # get_text 가 하듯 제자리 수정해도
    assert backend_mod._SLOT.cleaned == (norm, phones, before)  # 잡아 둔 것은 복사본이라 그대로


def test_capture_failure_leaves_nothing_and_still_returns_the_value(sbv2: FakeSbv2) -> None:
    odd = ("only", "three", "items")
    sbv2.infer_mod.clean_text = lambda *a, **k: odd  # type: ignore[attr-defined]
    backend_mod._install_text_capture()
    assert sbv2.infer_mod.clean_text("x") is odd  # type: ignore[attr-defined]
    assert backend_mod._SLOT.cleaned is None


def test_capture_propagates_the_original_exception(sbv2: FakeSbv2) -> None:
    def boom(*args: Any, **kwargs: Any) -> Any:
        raise ValueError("yomi")

    sbv2.infer_mod.clean_text = boom  # type: ignore[attr-defined]
    backend_mod._install_text_capture()
    with pytest.raises(ValueError, match="yomi"):
        sbv2.infer_mod.clean_text("x")  # type: ignore[attr-defined]


def test_install_is_idempotent(sbv2: FakeSbv2) -> None:
    backend_mod._install_text_capture()
    first = sbv2.infer_mod.clean_text  # type: ignore[attr-defined]
    backend_mod._install_text_capture()
    assert sbv2.infer_mod.clean_text is first  # type: ignore[attr-defined]


def test_install_is_skipped_when_the_library_layout_differs(sbv2: FakeSbv2, monkeypatch: pytest.MonkeyPatch) -> None:
    del sbv2.infer_mod.clean_text  # type: ignore[attr-defined]
    backend_mod._install_text_capture()
    assert backend_mod._TEXT_CAPTURE_INSTALLED is False
    monkeypatch.setitem(sys.modules, "style_bert_vits2.models", types.ModuleType("style_bert_vits2.models"))
    monkeypatch.setitem(sys.modules, "style_bert_vits2.models.infer", None)  # import 실패
    backend_mod._install_text_capture()
    assert backend_mod._TEXT_CAPTURE_INSTALLED is False


# ---- ②③ 두 경로 ----


def _run(backend: Sbv2Backend, model: FakeModel, text: str) -> tuple[Any, Any]:
    sr, audio = backend.infer(model, {"text": text, "length": 1.0})
    cap = backend.take_alignment(model)
    return cap, audio


@pytest.mark.parametrize("text", [TEXT, "3時15分です。", "  ｶﾞｲﾄﾞは「ＯＫ」です…"])
def test_capture_and_recall_paths_give_identical_alignment_and_audio(sbv2: FakeSbv2, text: str) -> None:
    backend, model = _model(sbv2)
    backend_mod._install_text_capture()
    cap_a, audio_a = _run(backend, model, text)
    assert sbv2.public_calls == 0  # 잡기 경로 — 공개 함수를 다시 부르지 않는다

    sbv2.infer_mod.clean_text = sbv2.original_clean_text  # type: ignore[attr-defined]  # 감싸기 없음
    cap_b, audio_b = _run(backend, model, text)
    assert sbv2.public_calls == 1  # 재호출 경로
    assert cap_a is not None and cap_a == cap_b
    assert np.array_equal(audio_a, audio_b)
    t = compute_timing(cap_a, text, int(audio_a.size), SR)
    assert t == compute_timing(cap_b, text, int(audio_b.size), SR)
    assert [text[w.char_start : w.char_end] for w in t.words]


def test_capture_failure_falls_back_to_recall(sbv2: FakeSbv2) -> None:
    backend, model = _model(sbv2)
    backend_mod._install_text_capture()
    wrapped = sbv2.infer_mod.clean_text  # type: ignore[attr-defined]

    def capture_breaks(*args: Any, **kwargs: Any) -> Any:
        out = wrapped(*args, **kwargs)
        backend_mod._SLOT.cleaned = None  # 감싸기 안의 복사가 실패한 것과 같은 상태
        return out

    sbv2.infer_mod.clean_text = capture_breaks  # type: ignore[attr-defined]
    cap, _audio = _run(backend, model, TEXT)
    assert cap is not None and sbv2.public_calls == 1


def test_captured_text_not_matching_model_tokens_is_rejected(sbv2: FakeSbv2) -> None:
    backend, model = _model(sbv2)
    backend_mod._install_text_capture()
    backend.infer(model, {"text": TEXT, "length": 1.0})
    norm, phones, word2ph = backend_mod._SLOT.cleaned
    backend_mod._SLOT.cleaned = (norm, phones[:-2] + ["?", "_"], word2ph)  # 다른 분석 결과가 남은 경우
    with pytest.raises(TimingError) as e:
        backend.take_alignment(model)
    assert e.value.status == "token_mismatch"


def test_alignment_is_taken_once_and_needs_a_synthesis(sbv2: FakeSbv2) -> None:
    backend, model = _model(sbv2)
    backend_mod._install_text_capture()
    assert backend.take_alignment(model) is None
    cap, _ = _run(backend, model, TEXT)
    assert cap is not None
    assert backend.take_alignment(model) is None  # 한 번만 꺼낸다(다음 합성의 것과 섞이지 않게)


# ---- ⑤ 스레드 격리 ----

OTHER = "もう一度ゆっくり言ってください。"


def test_overlapping_threads_take_only_their_own_capture(sbv2: FakeSbv2) -> None:
    """두 스레드의 합성이 겹쳐도(둘 다 보관한 뒤에 꺼냄) 각자 자기 합성의 정렬 정보만 꺼낸다 — 보관소가 스레드별이어야 한다.

    운영은 SerialRunner(워커 1개)라 겹치지 않는다. 워커를 늘리는 리팩터에서 교차 오염을 막는 마지막 확인이다.
    겹침은 Barrier 로 강제한다(sleep 없음). 보관소를 전역 한 칸으로 바꾸면 뒤에 꺼내는 쪽이 None 이 되어 실패한다.
    """
    backend, model_a = _model(sbv2)
    model_b = FakeModel(sbv2)
    backend._capture_alignment(model_b.net)
    backend_mod._install_text_capture()
    models = {"a": model_a, "b": model_b}
    texts = {"a": TEXT, "b": OTHER}
    expected = {k: _run(backend, models[k], texts[k])[0] for k in models}  # 겹치지 않을 때(같은 스레드에서 차례로)
    assert expected["a"] is not None and expected["b"] is not None and expected["a"] != expected["b"]

    synthesized = threading.Barrier(2, timeout=5)
    materialized = threading.Barrier(2, timeout=5)
    for m in models.values():
        orig = m.infer

        def infer_then_wait(language: str, text: str, _orig: Any = orig, **kw: Any) -> tuple[int, Any]:
            out = _orig(language, text, **kw)
            synthesized.wait()  # 두 스레드 모두 글 분석·정렬을 보관한 뒤에야 어느 쪽도 다음으로 넘어간다
            return out

        m.infer = infer_then_wait  # type: ignore[method-assign]

    results: dict[str, Any] = {}

    def work(key: str) -> None:
        try:
            backend.infer(models[key], {"text": texts[key], "length": 1.0})
            materialized.wait()  # 둘 다 합성을 끝낸 뒤 꺼낸다
            results[key] = backend.take_alignment(models[key])
        except Exception as e:  # noqa: BLE001 — 실패를 결과로 남기고 상대 스레드를 풀어 준다
            results[key] = e
            synthesized.abort()
            materialized.abort()

    threads = [threading.Thread(target=work, args=(k,)) for k in models]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=10)
    assert not any(t.is_alive() for t in threads)
    assert results == expected


# ---- ⑥ 모델 로드 때 감싸기 실패 ----

_SPEC = ModelSpec(
    model_id="jvnv-F1-jp",
    weights=Path("m.safetensors"),
    config=Path("config.json"),
    style_vectors=Path("style_vectors.npy"),
    version=None,
    checkpoint=None,
    fingerprint=(),
)


class _Param:
    dtype = "float32"


class ReadOnlyInferNet(FakeNet):
    """`net_g.infer` 를 바꿔 끼울 수 없는 모델(라이브러리 구조가 바뀐 경우 흉내). 합성 자체는 된다."""

    def parameters(self) -> Iterator[_Param]:
        yield _Param()

    def __setattr__(self, name: str, value: Any) -> None:
        raise AttributeError("read-only 秘密の文")


class NoInferNet:
    """`net_g.infer` 가 없는 모델."""

    def parameters(self) -> Iterator[_Param]:
        yield _Param()


def _install_tts_model(monkeypatch: pytest.MonkeyPatch, sbv2: FakeSbv2, net: Any) -> None:
    torch = types.ModuleType("torch")
    torch.float32 = "float32"  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "torch", torch)

    class TTSModel(FakeModel):
        def __init__(self, model_path: Any, config_path: Any, style_vec_path: Any, device: str) -> None:
            super().__init__(sbv2)
            self.net = net
            self._TTSModel__net_g = net
            self.device = device
            self.spk2id = {"spk": 0}
            self.style2id = {"Neutral": 0}
            self.hyper_parameters.data.sampling_rate = SR

        def load(self) -> None:
            pass

    mod = types.ModuleType("style_bert_vits2.tts_model")
    mod.TTSModel = TTSModel  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "style_bert_vits2.tts_model", mod)


@pytest.mark.parametrize("net", [ReadOnlyInferNet(), NoInferNet()], ids=["read_only", "missing"])
def test_load_model_survives_alignment_wrapper_failure(sbv2: FakeSbv2, monkeypatch: pytest.MonkeyPatch, net: Any) -> None:
    _install_tts_model(monkeypatch, sbv2, net)
    records: list[logging.LogRecord] = []

    class Capture(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            records.append(record)

    logger = logging.getLogger("kaiwa_tts.backend")
    handler = Capture(level=logging.DEBUG)
    logger.addHandler(handler)
    prev_level = logger.level
    logger.setLevel(logging.DEBUG)
    backend = Sbv2Backend("bert")
    try:
        model, info = backend.load_model(_SPEC, "cpu")  # 감싸기 실패가 모델 로드 실패(LOAD_FAILED)가 되면 안 된다
    finally:
        logger.removeHandler(handler)
        logger.setLevel(prev_level)
    assert info.sample_rate == SR and info.speakers == [(0, "spk")] and info.styles == ["Neutral"]
    warnings_ = [r.getMessage() for r in records if r.levelno == logging.WARNING]
    assert len(warnings_) == 1
    assert "alignment capture skipped" in warnings_[0] and "model=jvnv-F1-jp" in warnings_[0] and "AttributeError" in warnings_[0]
    assert not any("秘密" in r.getMessage() for r in records)  # 예외 메시지·글은 남기지 않는다(타입 이름만)

    if isinstance(net, ReadOnlyInferNet):
        backend_mod._install_text_capture()
        _sr, audio = backend.infer(model, {"text": TEXT, "length": 1.0})
        assert backend.take_alignment(model) is None  # → holder 가 X-Kaiwa-Timing: unavailable, 오디오는 그대로
        ok_backend, ok_model = _model(sbv2)
        _sr, ok_audio = ok_backend.infer(ok_model, {"text": TEXT, "length": 1.0})
        assert np.array_equal(audio, ok_audio)
