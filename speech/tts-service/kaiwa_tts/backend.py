"""모델 백엔드 — 실제 구현은 Style-Bert-VITS2(`Sbv2Backend`). 테스트는 같은 Protocol 의 가짜를 넣는다.

style_bert_vits2·torch 는 이 파일의 메서드 안에서만 import 한다(계약 테스트가 모델·torch 없이 돌게).
"""

from __future__ import annotations

import logging
import sys
import threading
import warnings
from dataclasses import dataclass
from typing import Any, Protocol

import numpy as np
from numpy.typing import NDArray

from .models import ModelSpec
from .timing import AlignmentCapture, TimingError

log = logging.getLogger("kaiwa_tts.backend")


@dataclass(frozen=True)
class ModelInfo:
    sample_rate: int
    speakers: list[tuple[int, str]]
    styles: list[str]


class Backend(Protocol):
    def init(self, requested_device: str) -> str:
        """BERT 를 올리고 실제로 쓸 장치를 돌려준다(mps 불가면 cpu)."""
        ...

    def load_model(self, spec: ModelSpec, device: str) -> tuple[Any, ModelInfo]: ...

    def infer(self, handle: Any, kwargs: dict[str, Any]) -> tuple[int, NDArray[Any]]: ...

    def take_alignment(self, handle: Any) -> AlignmentCapture | None:
        """같은 워커 스레드의 직전 `infer` 가 실제로 쓴 정렬 정보를 꺼낸다(한 번만). 없으면 None,
        엔진 내부가 예상과 다르면 TimingError."""
        ...

    def g2p(self, text: str) -> tuple[str, list[tuple[str, int]]]: ...

    def release(self, handle: Any) -> None: ...

    def gpu_memory_mb(self) -> int | None:
        """워커 스레드에서만 호출. MPS 드라이버 할당량(없으면 None)."""
        ...


# 직전 합성의 정렬 정보(스레드별). 모델 작업은 SerialRunner 워커 스레드 하나에서만 돈다.
_SLOT = threading.local()
_TEXT_CAPTURE_INSTALLED = False


def _install_text_capture() -> None:
    """SBV2 `models/infer.py` 의 get_text 가 부르는 clean_text 결과(정규화 글·음소·문자별 음소 수)를 복사해 둔다.

    같은 값을 take_alignment 에서 다시 계산하면 문장당 ≈0.25~0.45ms(M4 실측)가 합성 응답 경로에 더해진다. 감싼 함수는
    원래 반환값을 그대로 돌려주고(get_text 가 이어서 word2ph 를 제자리 수정하므로 복사본만 남긴다), 감쌀 수 없으면
    take_alignment 가 같은 공개 함수를 다시 부른다 — 어느 쪽이든 모델 입력 토큰 id 와 대조한 뒤에만 쓴다.
    """
    global _TEXT_CAPTURE_INSTALLED
    if _TEXT_CAPTURE_INSTALLED:
        return
    try:
        from style_bert_vits2.models import infer as sbv2_infer
    except Exception:  # noqa: BLE001
        return
    original = getattr(sbv2_infer, "clean_text", None)
    if not callable(original):
        return

    def clean_text_keeping_result(*args: Any, **kwargs: Any) -> Any:
        out = original(*args, **kwargs)
        try:
            norm, phones, _tones, word2ph = out
            _SLOT.cleaned = (str(norm), [str(p) for p in phones], [int(n) for n in word2ph])
        except Exception:  # noqa: BLE001
            _SLOT.cleaned = None
        return out

    sbv2_infer.clean_text = clean_text_keeping_result
    _TEXT_CAPTURE_INSTALLED = True


class Sbv2Backend:
    """style_bert_vits2 2.5.0 라이브러리 직접 호출. 모델·BERT 는 float32 로 고정한다."""

    def __init__(self, bert_model: str) -> None:
        self.bert_model = bert_model

    def _quiet_library_logs(self) -> None:
        # SBV2 는 loguru INFO/DEBUG 로 합성 문장 전문·음소열을 찍는다 — 서비스 로그 레벨과 무관하게 ERROR 만 남긴다.
        from style_bert_vits2.logging import logger as sbv2_logger

        sbv2_logger.remove()
        sbv2_logger.add(sys.stderr, level="ERROR", format="{time:HH:mm:ss} | sbv2 {level} | {message}")
        warnings.filterwarnings("ignore", category=FutureWarning)
        warnings.filterwarnings("ignore", category=UserWarning, module="torch")

    def init(self, requested_device: str) -> str:
        self._quiet_library_logs()
        import torch
        from style_bert_vits2.constants import Languages
        from style_bert_vits2.nlp import bert_models

        device = requested_device
        if device == "mps" and not torch.backends.mps.is_available():
            log.warning("MPS unavailable — falling back to CPU")
            device = "cpu"
        bert = bert_models.load_model(Languages.JP, self.bert_model)
        bert_models.load_tokenizer(Languages.JP, self.bert_model)
        # transformers 5.x 는 체크포인트 dtype(fp16)으로 로드해 half/float 불일치를 낸다(SETUP-M4 실측) — 버전과 무관하게 고정.
        if next(bert.parameters()).dtype != torch.float32:
            bert.float()
            log.warning("BERT cast to float32")
        _install_text_capture()
        return device

    def load_model(self, spec: ModelSpec, device: str) -> tuple[Any, ModelInfo]:
        import torch
        from style_bert_vits2.tts_model import TTSModel

        model = TTSModel(
            model_path=spec.weights,
            config_path=spec.config,
            style_vec_path=spec.style_vectors,
            device=device,
        )
        model.load()
        net = getattr(model, "_TTSModel__net_g", None)
        if net is not None and next(net.parameters()).dtype != torch.float32:
            net.float()
            log.warning("model %s cast to float32", spec.model_id)
        if net is not None:
            try:
                self._capture_alignment(net)
            except Exception as e:  # noqa: BLE001 — 라이브러리 구조가 바뀌어 감싸지 못해도 모델은 올린다(timing 만 unavailable)
                log.warning("alignment capture skipped model=%s err=%s — timing unavailable", spec.model_id, type(e).__name__)
        speakers = sorted((int(i), str(n)) for n, i in model.spk2id.items())
        styles = [str(s) for s in model.style2id]
        return model, ModelInfo(sample_rate=int(model.hyper_parameters.data.sampling_rate), speakers=speakers, styles=styles)

    def infer(self, handle: Any, kwargs: dict[str, Any]) -> tuple[int, NDArray[Any]]:
        import torch
        from style_bert_vits2.constants import Languages

        slot = _SLOT
        slot.text, slot.cleaned, slot.frames_t, slot.ids_t, slot.frames, slot.ids = kwargs.get("text"), None, None, None, None, None
        try:
            sr, audio = handle.infer(language=Languages.JP, **kwargs)
            self._materialize_alignment()
        finally:
            slot.frames_t = slot.ids_t = None
            # 문장 길이마다 텐서 모양이 달라 MPS 캐시 할당이 요청당 ≈45MB 씩 끝없이 쌓인다(2026-09-27 M4 실측:
            # 80회에 footprint 4.6→7.4GB). 매 합성 뒤 비우면 ≈3.0GB 로 고정되고 지연도 오히려 줄었다(p95 0.93→0.34s).
            if getattr(handle, "device", "") == "mps":
                torch.mps.empty_cache()
        return int(sr), np.asarray(audio)

    def _capture_alignment(self, net: Any) -> None:
        # SBV2 2.5.0 `models/infer.py` 는 net_g.infer 의 반환 (o, attn, y_mask, …) 중 o 만 쓰고 attn(토큰→프레임
        # 정렬 경로)을 버린다. 라이브러리를 고치지 않고 이 모델 인스턴스의 infer 만 감싸 attn 의 토큰별 프레임 합과 입력
        # 토큰 id 를 남긴다. 반환값은 그대로 돌려주므로 오디오는 바뀌지 않는다(task-012b-4 스파이크·M4 바이트 비교).
        original = net.infer
        slot = _SLOT

        def infer_keeping_alignment(*args: Any, **kwargs: Any) -> Any:
            out = original(*args, **kwargs)
            try:
                slot.frames_t = out[1][0, 0].sum(dim=0)
                slot.ids_t = args[0] if args else kwargs.get("x")
            except Exception:  # noqa: BLE001 — 정렬 정보가 없어도 합성은 그대로 끝나야 한다
                slot.frames_t = slot.ids_t = None
            return out

        net.infer = infer_keeping_alignment

    def _materialize_alignment(self) -> None:
        # 오디오가 이미 CPU 로 넘어온 뒤(장치 동기화 끝)라 작은 텐서 둘을 옮기는 비용은 수 µs.
        slot = _SLOT
        try:
            if slot.frames_t is not None and slot.ids_t is not None:
                slot.frames = [int(v) for v in slot.frames_t.round().long().cpu().reshape(-1).tolist()]
                slot.ids = [int(v) for v in slot.ids_t.cpu().reshape(-1).tolist()]
        except Exception:  # noqa: BLE001
            slot.frames = slot.ids = None

    def take_alignment(self, handle: Any) -> AlignmentCapture | None:
        from style_bert_vits2.constants import Languages
        from style_bert_vits2.nlp import clean_text, cleaned_text_to_sequence
        from style_bert_vits2.nlp.japanese.g2p import text_to_sep_kata
        from style_bert_vits2.nlp.japanese.normalizer import normalize_text
        from style_bert_vits2.nlp.symbols import PUNCTUATION_SYMBOLS

        slot = _SLOT
        text, cleaned = getattr(slot, "text", None), getattr(slot, "cleaned", None)
        frames, ids = getattr(slot, "frames", None), getattr(slot, "ids", None)
        slot.text = slot.cleaned = slot.frames = slot.ids = None
        if not isinstance(text, str) or frames is None or ids is None:
            return None
        hps = handle.hyper_parameters
        if cleaned is not None:
            norm, phones, word2ph = cleaned
        else:
            # 텍스트 분석을 못 잡았으면 get_text(models/infer.py) 와 같은 인자로 공개 함수를 다시 부른다(결정적).
            norm, phones, _tones, word2ph = clean_text(
                text, Languages.JP, use_jp_extra=str(hps.version).endswith("JP-Extra"), raise_yomi_error=False
            )
        # 모델이 실제로 받은 토큰 id 와 대조해 하나라도 다르면 쓰지 않는다 — 라이브러리 내부 흐름이 바뀌면 여기서 걸린다.
        seq, _, _ = cleaned_text_to_sequence(list(phones), [0] * len(phones), Languages.JP)
        blank = bool(hps.data.add_blank)
        expected = [0] * (2 * len(seq) + 1) if blank else list(seq)
        if blank:
            expected[1::2] = seq
        if expected != ids:
            raise TimingError("token_mismatch")
        sep_text, _ = text_to_sep_kata(norm, raise_yomi_error=False)
        punct = set(PUNCTUATION_SYMBOLS) | {"_"}
        return AlignmentCapture(
            normalized_text=str(norm),
            phone_counts=tuple(int(n) for n in word2ph),
            phone_is_speech=tuple(p not in punct for p in phones),
            word_lengths=tuple(len(w) for w in sep_text),
            token_frames=tuple(frames),
            blank_interleaved=blank,
            samples_per_frame=int(hps.data.hop_length),
            normalize=normalize_text,
        )

    def g2p(self, text: str) -> tuple[str, list[tuple[str, int]]]:
        from style_bert_vits2.nlp.japanese.g2p_utils import g2kata_tone
        from style_bert_vits2.nlp.japanese.normalizer import normalize_text

        normalized = normalize_text(text)
        return normalized, [(str(k), int(t)) for k, t in g2kata_tone(normalized)]

    def gpu_memory_mb(self) -> int | None:
        import torch

        if not torch.backends.mps.is_available():
            return None
        return int(torch.mps.driver_allocated_memory() / (1024 * 1024))

    def release(self, handle: Any) -> None:
        on_mps = getattr(handle, "device", "") == "mps"
        del handle
        if on_mps:
            import torch

            torch.mps.empty_cache()
