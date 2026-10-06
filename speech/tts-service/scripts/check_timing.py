"""timing(X-Tts-Timing) 실물 확인 — 서비스와 같은 경로(ModelHolder.synthesize)로 합성해 timing 이 유효한지, 정렬 정보를
꺼내는 래퍼가 오디오를 바꾸지 않는지(같은 시드의 래퍼 없는 모델과 바이트 비교), timing 계산 비용을 잰다.

정규화 글을 잡는 모듈 속성 감싸기(`models.infer.clean_text`)는 프로세스 전역이라 같은 프로세스의 "래퍼 없는 모델"도 거친다 —
바이트 비교는 net_g 인스턴스 래퍼만 증명한다. 감싸기 자체의 무영향은 `--no-text-capture`(감싸지 않음)·`--break-capture`(감쌌지만
잡기 실패 → 재호출 경로) 실행의 `wavSha`·`headerSha` 를 기본 실행과 문장별로 대조해 확인한다. 각 행 `path` 는 실제로 탄 경로
(`capture` = 잡은 값, `recall` = 공개 함수 재호출), `wrapEqual` 은 같은 인자로 부른 원래 함수와 감싼 함수의 반환값 동일 여부다.

실행(M4, **운영 프로세스·운영 model_assets 와 분리된 디렉터리에서** — 모델을 따로 한 벌 더 올린다):
  .venv/bin/python speech/tts-service/scripts/check_timing.py --assets <model_assets 사본> [--model jvnv-F1-jp] [--device cpu]
출력: 문장별 `ROW`(번호·상태·경로·단어 수·timing ms·바이트 동일) + `SUMMARY` JSON. 문장 원문은 `--show` 일 때만 단어 조각으로 찍는다.
이 파일은 AGPL 경계(speech/tts-service) 안의 확인 도구다.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import statistics
import sys
import time
from pathlib import Path
from typing import Any

os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from bench_synth import SENTENCES  # noqa: E402

from kaiwa_tts.backend import Sbv2Backend  # noqa: E402
from kaiwa_tts.config import Settings  # noqa: E402
from kaiwa_tts.holder import ModelHolder  # noqa: E402
from kaiwa_tts.params import build_plan, clean_text  # noqa: E402
from kaiwa_tts.schemas import SynthesizeIn  # noqa: E402
from kaiwa_tts.server import encode_wav  # noqa: E402
from kaiwa_tts.timing import decode_header, encode_header  # noqa: E402

# 경계 문장: 숫자·쉼표·카타카나 장음·반각·이모지·앞 공백·괄호 — 저장소 작성 합성 문장.
EDGE = [
    "3時15分に駅で会いましょう。",
    "ええ、そうですね。ちょっと待ってください。",
    "キャッシュカードはコンビニでも使えますか？",
    "  ｶﾞｲﾄﾞは「ＯＫ」です…",
    "こんにちは\U0001f600、元気？",
]


def pct(values: list[float], q: float) -> float:
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, max(0, round(q * (len(ordered) - 1))))]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--assets", required=True, help="model_assets 디렉터리(운영과 분리된 사본)")
    ap.add_argument("--model", default="jvnv-F1-jp")
    ap.add_argument("--device", default="cpu", choices=("cpu", "mps"))
    ap.add_argument("--n", type=int, default=len(SENTENCES))
    ap.add_argument("--pitch", type=float, default=1.0)
    ap.add_argument("--speed", type=float, default=1.0)
    ap.add_argument("--no-compare", action="store_true", help="래퍼 없는 모델과의 바이트 비교를 건너뛴다")
    ap.add_argument("--no-text-capture", action="store_true", help="clean_text 결과 잡기를 끄고 공개 함수 재호출 경로만 쓴다")
    ap.add_argument("--break-capture", action="store_true", help="감싸기는 두되 잡은 값을 지워 재호출 경로로 떨어지는지 본다")
    ap.add_argument("--show", action="store_true")
    args = ap.parse_args()

    import style_bert_vits2.nlp as sbv2_nlp
    import torch
    from style_bert_vits2.constants import Languages
    from style_bert_vits2.models import infer as sbv2_infer
    from style_bert_vits2.tts_model import TTSModel

    import kaiwa_tts.backend as backend_mod

    original_clean_text = sbv2_infer.clean_text
    if args.no_text_capture:
        backend_mod._TEXT_CAPTURE_INSTALLED = True  # 설치된 것으로 표시해 감싸지 않게 한다(재호출 경로 확인용)
    # take_alignment 의 재호출 경로는 호출 시점에 `style_bert_vits2.nlp.clean_text` 를 import 한다 — 세어서 경로를 판정한다
    # (get_text 는 모듈을 읽을 때 묶은 이름을 쓰므로 이 카운터를 거치지 않는다).
    recalls = [0]
    public_clean_text = sbv2_nlp.clean_text

    def counted_clean_text(*a: Any, **k: Any) -> Any:
        recalls[0] += 1
        return public_clean_text(*a, **k)

    sbv2_nlp.clean_text = counted_clean_text
    assets = Path(args.assets).expanduser().resolve()
    settings = Settings(model_assets=assets, log_dir=assets.parent / "logs", default_model=args.model, device=args.device)
    holder = ModelHolder(settings, Sbv2Backend(settings.bert_model))
    holder.startup()
    lm = holder.get(args.model)
    if lm is None:
        print(f"MODEL NOT LOADED phase={holder.phase}")
        return 1
    wrapped_clean_text = sbv2_infer.clean_text
    installed = wrapped_clean_text is not original_clean_text
    if args.break_capture:

        def capture_breaks(*a: Any, **k: Any) -> Any:
            out = wrapped_clean_text(*a, **k)
            backend_mod._SLOT.cleaned = None  # 감싸기 안의 복사가 실패한 것과 같은 상태
            return out

        sbv2_infer.clean_text = capture_breaks
    use_jp_extra = str(lm.handle.hyper_parameters.version).endswith("JP-Extra")
    plain = None
    if not args.no_compare:
        plain = TTSModel(model_path=lm.spec.weights, config_path=lm.spec.config, style_vec_path=lm.spec.style_vectors, device=holder.device)
        plain.load()
        plain_net = getattr(plain, "_TTSModel__net_g", None)
        if plain_net is not None:
            plain_net.float()

    texts = SENTENCES[: args.n] + EDGE
    rows = []
    for i, text in enumerate(texts):
        req = SynthesizeIn.model_validate({"text": text, "controls": {"pitch": args.pitch, "speed": args.speed}})
        plan = build_plan(req, clean_text(req.text), lm.info.styles)
        torch.manual_seed(1000 + i)
        recalls[0] = 0
        t0 = time.perf_counter()
        result = holder.synthesize(args.model, plan)
        wall_ms = (time.perf_counter() - t0) * 1000
        path = "recall" if recalls[0] else "capture"
        wrap_equal = None
        if installed:
            ck = {"use_jp_extra": use_jp_extra, "raise_yomi_error": False}
            wrap_equal = wrapped_clean_text(plan.kwargs["text"], Languages.JP, **ck) == original_clean_text(
                plan.kwargs["text"], Languages.JP, **ck
            )
        wav = encode_wav(result.sample_rate, result.audio)
        same = None
        if plain is not None:
            torch.manual_seed(1000 + i)
            sr2, audio2 = plain.infer(language=Languages.JP, **plan.kwargs)
            if args.device == "mps":
                torch.mps.empty_cache()
            same = encode_wav(int(sr2), audio2) == wav
        row: dict[str, object] = {
            "i": i,
            "edge": i >= args.n,
            "status": result.timing_status,
            "path": path,
            "wrapEqual": wrap_equal,
            "timingMs": round(result.timing_ms, 3),
            "synthMs": result.synth_ms,
            "wallMs": round(wall_ms, 1),
            "audioMs": round(result.audio.size * 1000 / result.sample_rate),
            "bytesEqual": same,
            "wavSha": hashlib.sha256(wav).hexdigest()[:12],
        }
        problems: list[str] = []
        if result.timing is not None:
            value = encode_header(result.timing)
            row["headerBytes"] = len(value) if value else None
            row["headerSha"] = hashlib.sha256(value.encode()).hexdigest()[:12] if value else None
            data: dict[str, Any] = decode_header(value) if value else {"words": [], "durationMs": 0}
            words: list[list[int]] = data["words"]
            row["words"] = len(words)
            prev_end, prev_start = 0, -1
            for s, e, cs, ce in words:
                piece = req.text[cs:ce]
                if not piece or cs < prev_end or s < prev_start or not (0 <= s < e <= data["durationMs"]):
                    problems.append(f"bad word {s},{e},{cs},{ce}")
                prev_end, prev_start = ce, s
            row["firstStartMs"] = words[0][0] if words else None
            row["lastEndGapMs"] = data["durationMs"] - words[-1][1] if words else None
            if args.show:
                row["pieces"] = [req.text[cs:ce] for _, _, cs, ce in words]
        row["problems"] = problems
        rows.append(row)
        print("ROW", json.dumps(row, ensure_ascii=False), flush=True)

    ok = [r for r in rows if r["status"] == "ok" and not r["problems"]]
    tms = [float(str(r["timingMs"])) for r in rows]
    summary = {
        "device": holder.device,
        "textCapture": "off" if not installed else ("broken" if args.break_capture else "on"),
        "paths": {p: sum(1 for r in rows if r["path"] == p) for p in ("capture", "recall")},
        "wrapEqual": None if not installed else sum(1 for r in rows if r["wrapEqual"]),
        "pitch": args.pitch,
        "speed": args.speed,
        "sentences": len(rows),
        "timingOk": len(ok),
        "bytesEqual": None if plain is None else sum(1 for r in rows if r["bytesEqual"]),
        "timingMsP50": round(statistics.median(tms), 3),
        "timingMsP95": round(pct(tms, 0.95), 3),
        "timingMsMax": round(max(tms), 3),
        "headerBytesMax": max((int(str(r.get("headerBytes") or 0)) for r in rows), default=0),
        "statuses": sorted({str(r["status"]) for r in rows}),
    }
    print("SUMMARY", json.dumps(summary, ensure_ascii=False))
    expected_path = "capture" if installed and not args.break_capture else "recall"
    paths_ok = all(r["path"] == expected_path for r in rows) and (not installed or summary["wrapEqual"] == len(rows))
    return 0 if len(ok) == len(rows) and paths_ok and (plain is None or summary["bytesEqual"] == len(rows)) else 1


if __name__ == "__main__":
    sys.exit(main())
