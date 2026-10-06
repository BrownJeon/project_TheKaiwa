"""모델 홀더 — 기동 로드·워밍업·MPS→CPU 폴백·refresh·합성. 변경 메서드는 전부 SerialRunner 워커 스레드에서만 호출된다.

읽기(`catalog`·`get`)는 이벤트 루프 스레드에서 오므로, 모델 사전은 제자리 수정 없이 새 dict 로 통째 교체한다.
"""

from __future__ import annotations

import hashlib
import logging
import math
import time
from dataclasses import dataclass
from typing import Any

from numpy.typing import NDArray

from .backend import Backend, ModelInfo
from .config import Settings
from .models import ModelSpec, ScanIssue, scan_model_assets
from .params import SynthPlan, without_pitch_adjust
from .timing import PITCH_ADJUST_TOLERANCE_MS, STATUS_OK, Timing, TimingError, compute_timing

log = logging.getLogger("kaiwa_tts.holder")

_HASH_CHUNK = 4 * 1024 * 1024


class UnknownModel(Exception):
    pass


class SynthFailed(Exception):
    pass


@dataclass
class LoadedModel:
    spec: ModelSpec
    handle: Any
    info: ModelInfo
    sha256: str


@dataclass(frozen=True)
class SynthResult:
    sample_rate: int
    audio: NDArray[Any]
    adjust: str  # none | applied | skipped
    synth_ms: int
    timing: Timing | None = None
    # ok | unavailable | token_mismatch | frame_mismatch | word_mismatch | text_mismatch | empty | too_long | error
    timing_status: str = "unavailable"
    timing_ms: float = 0.0


def _sha256(path: Any) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(_HASH_CHUNK):
            h.update(chunk)
    return h.hexdigest()


def _default_kwargs(text: str, style: str) -> dict[str, Any]:
    return {
        "text": text,
        "speaker_id": 0,
        "style": style,
        "style_weight": 1.0,
        "length": 1.0,
        "pitch_scale": 1.0,
        "intonation_scale": 1.0,
        "sdp_ratio": 0.2,
        "noise": 0.6,
        "noise_w": 0.8,
        "line_split": False,
    }


class ModelHolder:
    def __init__(self, settings: Settings, backend: Backend) -> None:
        self.settings = settings
        self.backend = backend
        self.phase = "LOADING"  # LOADING | READY | FAILED
        self.requested_device = settings.device
        self.device = settings.device
        self.device_fallback = False
        self.warmed_up = False
        self.cold_start_ms: int | None = None
        self._backend_ready = False
        self.gpu_mb: int | None = None
        self._models: dict[str, LoadedModel] = {}
        self._issues: dict[str, ScanIssue] = {}

    # ---- 읽기(이벤트 루프 스레드) ----
    def get(self, model_id: str) -> LoadedModel | None:
        return self._models.get(model_id)

    @property
    def model_ids(self) -> list[str]:
        return sorted(self._models)

    def catalog(self) -> list[dict[str, Any]]:
        models = self._models
        issues = self._issues
        rows: list[dict[str, Any]] = []
        for model_id in sorted(set(models) | set(issues)):
            lm = models.get(model_id)
            if lm is not None:
                rows.append(
                    {
                        "modelName": model_id,
                        "version": lm.spec.version,
                        "checkpoint": lm.spec.checkpoint,
                        "status": "LOADED",
                        "loaded": True,
                        "sampleRate": lm.info.sample_rate,
                        "speakers": [{"id": i, "name": n} for i, n in lm.info.speakers],
                        "styles": list(lm.info.styles),
                        "defaultStyle": "Neutral" if "Neutral" in lm.info.styles else (lm.info.styles[0] if lm.info.styles else None),
                        "sha256": lm.sha256,
                        "error": None,
                    }
                )
            else:
                issue = issues[model_id]
                rows.append(
                    {
                        "modelName": model_id,
                        "version": None,
                        "checkpoint": None,
                        "status": issue.status,
                        "loaded": False,
                        "sampleRate": None,
                        "speakers": [],
                        "styles": [],
                        "defaultStyle": None,
                        "sha256": None,
                        "error": None if issue.status == "DISABLED" else issue.code,
                    }
                )
        return rows

    # ---- 변경(워커 스레드) ----
    def _init_backend(self) -> bool:
        try:
            self.device = self.backend.init(self.requested_device)
        except Exception as e:  # noqa: BLE001 — 기동 실패는 health 로 보이고 프로세스는 살아 있어야 한다
            log.error("backend init failed: %s", type(e).__name__)
            return False
        self.device_fallback = self.device != self.requested_device
        self._backend_ready = True
        return True

    def startup(self) -> None:
        try:
            self._startup()
        except Exception as e:  # noqa: BLE001 — LOADING 에 머물면 워치독이 못 알아챈다
            log.error("startup aborted: %s", type(e).__name__)
            self.phase = "FAILED"

    def _startup(self) -> None:
        t0 = time.perf_counter()
        if not self._init_backend():
            self.phase = "FAILED"
            return
        self._load_all()
        failed = self._warmup(list(self._models.values()))
        if failed and self.device == "mps":
            log.warning("MPS warmup failed for %s — reloading on CPU", ",".join(failed))
            for lm in self._models.values():
                self.backend.release(lm.handle)
            self._models = {}
            self.device = "cpu"
            self.device_fallback = True
            self._load_all()
            failed = self._warmup(list(self._models.values()))
        if failed:
            self._drop(failed, "WARMUP_FAILED")
        self.warmed_up = bool(self._models)
        self.phase = "READY" if self._models else "FAILED"
        self._sample_gpu()
        self.cold_start_ms = int((time.perf_counter() - t0) * 1000)
        log.info(
            "startup phase=%s device=%s fallback=%s models=%s cold_start_ms=%d",
            self.phase,
            self.device,
            self.device_fallback,
            ",".join(self.model_ids) or "-",
            self.cold_start_ms,
        )

    def refresh(self) -> dict[str, Any]:
        if not self._backend_ready and not self._init_backend():
            return {"models": [], "added": [], "reloaded": [], "removed": [], "errors": [{"modelName": "*", "code": "BACKEND_INIT_FAILED"}]}
        specs, issues = scan_model_assets(self.settings.model_assets)
        current = self._models
        new: dict[str, LoadedModel] = {}
        new_issues: dict[str, ScanIssue] = {i.model_id: i for i in issues}
        added: list[str] = []
        reloaded: list[str] = []
        errors: list[dict[str, str]] = []
        for spec in specs:
            cur = current.get(spec.model_id)
            if cur is not None and cur.spec.fingerprint == spec.fingerprint:
                new[spec.model_id] = cur
                continue
            try:
                lm = self._load(spec)
            except Exception as e:  # noqa: BLE001
                log.error("refresh load failed model=%s err=%s", spec.model_id, type(e).__name__)
                errors.append({"modelName": spec.model_id, "code": "LOAD_FAILED"})
                if cur is not None:
                    new[spec.model_id] = cur
                else:
                    new_issues[spec.model_id] = ScanIssue(spec.model_id, "ERROR", "LOAD_FAILED")
                continue
            if self._warmup([lm]):
                errors.append({"modelName": spec.model_id, "code": "WARMUP_FAILED"})
                self.backend.release(lm.handle)
                if cur is not None:
                    new[spec.model_id] = cur
                else:
                    new_issues[spec.model_id] = ScanIssue(spec.model_id, "ERROR", "WARMUP_FAILED")
                continue
            new[spec.model_id] = lm
            (reloaded if cur is not None else added).append(spec.model_id)
        removed = sorted(set(current) - set(new))
        self._models = new
        self._issues = {k: v for k, v in new_issues.items() if k not in new}
        for model_id in removed + reloaded:
            old = current.get(model_id)
            if old is not None:
                self.backend.release(old.handle)
        if self._models and self.phase == "FAILED":
            self.phase = "READY"
            self.warmed_up = True
        log.info("refresh added=%s reloaded=%s removed=%s errors=%d", added, reloaded, removed, len(errors))
        return {"models": sorted(new), "added": added, "reloaded": reloaded, "removed": removed, "errors": errors}

    def synthesize(self, model_id: str, plan: SynthPlan) -> SynthResult:
        lm = self._models.get(model_id)
        if lm is None:
            raise UnknownModel(model_id)
        t0 = time.perf_counter()
        adjust = "applied" if plan.adjusts_pitch else "none"
        try:
            sr, audio = self.backend.infer(lm.handle, plan.kwargs)
        except Exception as e:
            if not plan.adjusts_pitch:
                raise SynthFailed(type(e).__name__) from e
            # pyworld 후처리는 무성 구간뿐인 짧은 음성에서 0 나누기 등으로 실패한다 — 피치 조절 없이 1회 재합성.
            log.warning("pitch/intonation adjust failed (%s) — retry without adjust", type(e).__name__)
            try:
                sr, audio = self.backend.infer(lm.handle, without_pitch_adjust(plan.kwargs))
            except Exception as e2:
                raise SynthFailed(type(e2).__name__) from e2
            adjust = "skipped"
        if audio.size == 0:
            raise SynthFailed("EmptyAudio")
        synth_ms = int((time.perf_counter() - t0) * 1000)
        timing, status, timing_ms = self._timing(lm, plan, sr, int(audio.size), adjust)
        self._sample_gpu()
        return SynthResult(
            sample_rate=sr,
            audio=audio,
            adjust=adjust,
            synth_ms=synth_ms,
            timing=timing,
            timing_status=status,
            timing_ms=timing_ms,
        )

    def _timing(self, lm: LoadedModel, plan: SynthPlan, sr: int, samples: int, adjust: str) -> tuple[Timing | None, str, float]:
        # 오디오는 이미 나왔다 — 여기서 무엇이 실패해도 timing 만 빠지고 합성 응답은 그대로다.
        t0 = time.perf_counter()
        timing: Timing | None = None
        try:
            cap = self.backend.take_alignment(lm.handle)
            if cap is None:
                status = "unavailable"
            else:
                tolerance = math.ceil(sr * PITCH_ADJUST_TOLERANCE_MS / 1000) if adjust == "applied" else 0
                timing = compute_timing(cap, plan.source_text or plan.text, samples, sr, tolerance)
                status = STATUS_OK
        except TimingError as e:
            status = e.status
        except Exception as e:  # noqa: BLE001 — timing 은 부가 정보다
            log.warning("timing failed model=%s err=%s", lm.spec.model_id, type(e).__name__)
            status = "error"
        return timing, status, (time.perf_counter() - t0) * 1000

    def g2p(self, text: str) -> tuple[str, list[tuple[str, int]]]:
        return self.backend.g2p(text)

    # ---- 내부 ----
    def _load(self, spec: ModelSpec) -> LoadedModel:
        t0 = time.perf_counter()
        handle, info = self.backend.load_model(spec, self.device)
        digest = _sha256(spec.weights)
        log.info("loaded model=%s device=%s ms=%d", spec.model_id, self.device, int((time.perf_counter() - t0) * 1000))
        return LoadedModel(spec=spec, handle=handle, info=info, sha256=digest)

    def _load_all(self) -> None:
        specs, issues = scan_model_assets(self.settings.model_assets)
        models: dict[str, LoadedModel] = {}
        new_issues = {i.model_id: i for i in issues}
        for spec in specs:
            try:
                models[spec.model_id] = self._load(spec)
            except Exception as e:  # noqa: BLE001
                log.error("load failed model=%s err=%s", spec.model_id, type(e).__name__)
                new_issues[spec.model_id] = ScanIssue(spec.model_id, "ERROR", "LOAD_FAILED")
        self._models = models
        self._issues = new_issues
        if not specs:
            log.error("no models found under KAIWA_TTS_MODEL_ASSETS")

    def _warmup(self, models: list[LoadedModel]) -> list[str]:
        failed: list[str] = []
        for lm in models:
            style = "Neutral" if "Neutral" in lm.info.styles else (lm.info.styles[0] if lm.info.styles else "Neutral")
            t0 = time.perf_counter()
            try:
                _, audio = self.backend.infer(lm.handle, _default_kwargs(self.settings.warmup_text, style))
                if audio.size == 0:
                    raise SynthFailed("EmptyAudio")
            except Exception as e:  # noqa: BLE001
                log.error("warmup failed model=%s err=%s", lm.spec.model_id, type(e).__name__)
                failed.append(lm.spec.model_id)
                continue
            log.info("warmup model=%s ms=%d", lm.spec.model_id, int((time.perf_counter() - t0) * 1000))
        return failed

    def _sample_gpu(self) -> None:
        # health 는 이벤트 루프 스레드라 torch 를 직접 부르지 않고, 워커가 남긴 마지막 값을 읽는다.
        try:
            self.gpu_mb = self.backend.gpu_memory_mb()
        except Exception:  # noqa: BLE001 — 계측 실패가 합성을 막으면 안 된다
            self.gpu_mb = None

    def _drop(self, model_ids: list[str], code: str) -> None:
        models = dict(self._models)
        issues = dict(self._issues)
        for model_id in model_ids:
            lm = models.pop(model_id, None)
            if lm is not None:
                self.backend.release(lm.handle)
            issues[model_id] = ScanIssue(model_id, "ERROR", code)
        self._models = models
        self._issues = issues
