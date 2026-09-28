"""claim(#139) 응답 잡 1개 — 형식을 확인한 값만 핸들러로 넘긴다. 워커는 SpeechJob·Utterance 테이블을 읽지 않는다(D-B1)."""

from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

_ID = re.compile(r"^[A-Za-z0-9_-]{1,40}$")
KINDS = ("ANALYSIS_STT", "PRONUNCIATION")


@dataclass(frozen=True, repr=False)
class ClaimedJob:
    id: str
    kind: str
    utterance_id: str
    audio_path: str | None
    realtime_text: str
    recognition_mode: str
    attempts: int

    def __repr__(self) -> str:
        return (
            f"ClaimedJob(id={self.id!r}, kind={self.kind!r}, utterance_id={self.utterance_id!r}, "
            f"attempts={self.attempts}, realtime_chars={len(self.realtime_text)})"
        )


def parse_job(raw: Mapping[str, Any]) -> ClaimedJob | None:
    jid, uid, kind = raw.get("id"), raw.get("utteranceId"), raw.get("kind")
    if not isinstance(jid, str) or not _ID.match(jid) or not isinstance(uid, str) or not _ID.match(uid) or kind not in KINDS:
        return None
    audio = raw.get("audioPath")
    text = raw.get("realtimeText")
    attempts = raw.get("attempts")
    mode = raw.get("recognitionMode")
    return ClaimedJob(
        id=jid,
        kind=str(kind),
        utterance_id=uid,
        audio_path=audio if isinstance(audio, str) else None,
        realtime_text=text if isinstance(text, str) else "",
        recognition_mode=mode if isinstance(mode, str) else "AUTO",
        attempts=attempts if isinstance(attempts, int) and not isinstance(attempts, bool) else 0,
    )
