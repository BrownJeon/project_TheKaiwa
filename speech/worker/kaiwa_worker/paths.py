"""발화 오디오 경로 — claim 이 준 `audioPath`(DATA_ROOT 상대)를 워커 `DATA_ROOT` 에 붙인다.

앱 규약(`users/<userId>/utterances/<YYYY-MM>/<id>.wav`)과 다른 모양·절대 경로·`..`·심볼릭 링크로 DATA_ROOT 밖을 가리키는 경로는 열지 않는다
(→ #140 AUDIO_MISSING, 재시도 없음). 경로는 로그에 남기지 않는다.
"""

from __future__ import annotations

import re
from pathlib import Path

_AUDIO = re.compile(r"^users/[A-Za-z0-9][A-Za-z0-9._-]{0,127}/utterances/\d{4}-\d{2}/[A-Za-z0-9][A-Za-z0-9_-]{0,63}\.wav$")
MAX_AUDIO_BYTES = 4 * 1024 * 1024


def resolve_audio(data_root: Path, rel: str | None) -> Path | None:
    if not rel or rel.startswith("/") or "\\" in rel or ".." in rel.split("/") or not _AUDIO.match(rel):
        return None
    root = data_root.resolve()
    try:
        p = (root / rel).resolve(strict=True)
    except (FileNotFoundError, RuntimeError, OSError):
        return None
    if not p.is_relative_to(root) or not p.is_file():
        return None
    return p
