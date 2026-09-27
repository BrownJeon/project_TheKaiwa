"""모델 백엔드 — 실제 구현은 Style-Bert-VITS2(`Sbv2Backend`). 테스트는 같은 Protocol 의 가짜를 넣는다.

style_bert_vits2·torch 는 이 파일의 메서드 안에서만 import 한다(계약 테스트가 모델·torch 없이 돌게).
"""

from __future__ import annotations

import logging
import sys
import warnings
from dataclasses import dataclass
from typing import Any, Protocol

import numpy as np
from numpy.typing import NDArray

from .models import ModelSpec

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

    def g2p(self, text: str) -> tuple[str, list[tuple[str, int]]]: ...

    def release(self, handle: Any) -> None: ...

    def gpu_memory_mb(self) -> int | None:
        """워커 스레드에서만 호출. MPS 드라이버 할당량(없으면 None)."""
        ...


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
        speakers = sorted((int(i), str(n)) for n, i in model.spk2id.items())
        styles = [str(s) for s in model.style2id]
        return model, ModelInfo(sample_rate=int(model.hyper_parameters.data.sampling_rate), speakers=speakers, styles=styles)

    def infer(self, handle: Any, kwargs: dict[str, Any]) -> tuple[int, NDArray[Any]]:
        import torch
        from style_bert_vits2.constants import Languages

        try:
            sr, audio = handle.infer(language=Languages.JP, **kwargs)
        finally:
            # 문장 길이마다 텐서 모양이 달라 MPS 캐시 할당이 요청당 ≈45MB 씩 끝없이 쌓인다(2026-09-27 M4 실측:
            # 80회에 footprint 4.6→7.4GB). 매 합성 뒤 비우면 ≈3.0GB 로 고정되고 지연도 오히려 줄었다(p95 0.93→0.34s).
            if getattr(handle, "device", "") == "mps":
                torch.mps.empty_cache()
        return int(sr), np.asarray(audio)

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
