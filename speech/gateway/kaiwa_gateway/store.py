"""발화 wav 저장(gateway/README §4) — 모든 경로는 `DATA_ROOT/users/<userId>/utterances/` 아래로만.

1. `write_incoming` : `incoming/<32hex>.wav.part` 에 쓴다(앱 콜백 전).
2. `promote`        : 앱이 정한 `audioPath`(DATA_ROOT 상대)를 검증한 뒤 `.part` → 그 경로로 rename.
                      앱이 이미 옮겼으면(대상 존재) `.part` 만 지운다.
3. `orphan`         : 콜백 실패 시 `_orphan/<32hex>.wav` 로 옮긴다(재등록 미결, 30일 정리는 앱 잡).
경로 조각은 앱 `infra.storage` 와 같은 규칙(`[A-Za-z0-9][A-Za-z0-9._-]*`, `..` 금지) + 결과가 루트 밖이면 거부.
"""

from __future__ import annotations

import os
import re
import secrets
from dataclasses import dataclass
from pathlib import Path

from kaiwa_speech_common.audio import write_wav

_SEGMENT = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
_USER = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")


class StoreError(Exception):
    pass


@dataclass(frozen=True)
class IncomingFile:
    rel: str  # DATA_ROOT 상대(앞 슬래시 없음)
    path: Path
    size: int


class UtteranceStore:
    def __init__(self, data_root: Path) -> None:
        self._root = data_root.resolve()

    def _inside(self, path: Path) -> Path:
        resolved = path.resolve()
        if resolved != self._root and self._root not in resolved.parents:
            raise StoreError("path escapes DATA_ROOT")
        return resolved

    def _user_dir(self, user_id: str) -> Path:
        if not _USER.match(user_id):
            raise StoreError("invalid user id")
        return self._root / "users" / user_id / "utterances"

    def write_incoming(self, user_id: str, pcm: bytes, sample_rate: int) -> IncomingFile:
        directory = self._user_dir(user_id) / "incoming"
        directory.mkdir(parents=True, exist_ok=True, mode=0o750)
        name = secrets.token_hex(16) + ".wav.part"
        path = self._inside(directory / name)
        try:
            size = write_wav(path, pcm, sample_rate)
            os.chmod(path, 0o640)
        except OSError:
            path.unlink(missing_ok=True)
            raise
        return IncomingFile(rel=path.relative_to(self._root).as_posix(), path=path, size=size)

    def resolve_audio_path(self, user_id: str, audio_path: object, final_path: object = None) -> Path:
        """앱 응답의 audioPath(상대)·finalPath(절대, 선택)를 검증해 최종 절대 경로를 돌려준다."""
        if not isinstance(audio_path, str) or not audio_path or audio_path.startswith("/"):
            raise StoreError("audioPath must be relative")
        parts = audio_path.split("/")
        if len(parts) < 4 or parts[0] != "users" or parts[1] != user_id or parts[2] != "utterances":
            raise StoreError("audioPath outside user utterances")
        if not all(_SEGMENT.match(p) and ".." not in p for p in parts) or not parts[-1].endswith(".wav"):
            raise StoreError("audioPath segment invalid")
        if parts[3] in ("incoming", "_orphan"):
            raise StoreError("audioPath in reserved dir")
        target = self._inside(self._root.joinpath(*parts))
        if final_path is not None:
            if not isinstance(final_path, str) or Path(final_path).resolve() != target:
                raise StoreError("finalPath does not match audioPath")
        return target

    def promote(self, incoming: IncomingFile, target: Path) -> None:
        target.parent.mkdir(parents=True, exist_ok=True, mode=0o750)
        if target.exists():
            incoming.path.unlink(missing_ok=True)
            return
        os.replace(incoming.path, target)

    def orphan(self, user_id: str, incoming: IncomingFile) -> Path | None:
        if not incoming.path.exists():
            return None
        directory = self._user_dir(user_id) / "_orphan"
        directory.mkdir(parents=True, exist_ok=True, mode=0o750)
        target = self._inside(directory / incoming.path.name.removesuffix(".part"))
        os.replace(incoming.path, target)
        return target

    def discard(self, incoming: IncomingFile) -> None:
        incoming.path.unlink(missing_ok=True)
