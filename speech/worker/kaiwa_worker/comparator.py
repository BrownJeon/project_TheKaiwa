"""TranscriptComparator(task-012b, speech/worker/README §4) — 실시간 인식(realtimeText)과 분석 인식(analysisText)의 유사도·플래그.

normalize(s):
  1. NFKC(전각/반각·합성 문자 통일)
  2. 읽기 접기: `ReadingProvider.read` 로 전체를 가나 읽기로(한자·숫자·기호 읽기 — 「今日」「きょう」→ キョー, 「7時」「七時」→ シチジ).
     구두점을 먼저 지우지 않는 이유: `%`·`円` 같은 기호도 읽기가 있다(「7%」→ ナナパーセント).
  3. 문자·숫자·결합 문자(유니코드 L·N·M)만 남긴다 — 구두점·공백·기호(、。！？…「」·전각 공백·이모지)는 버린다. 장음 'ー'(Lm)는 그대로(長音 오류는 발음 분석 몫).
  4. 카타카나 → 히라가나(U+30A1–U+30F6 − 0x60).
similarity = 1 − levenshtein(a', b') / max(len(a'), len(b'), 1)
flags: ANALYSIS_EMPTY(분석이 비었는데 실시간은 있음, similarity 0) · REALTIME_EMPTY(반대, similarity 0) · LENGTH_RATIO(둘 다 있고 길이 3배 이상).
둘 다 비면 `both_empty` — 워커가 #140 EMPTY_TRANSCRIPTS 로 보고한다. **requiresReview 판정은 앱**(임계가 사용자 모드·AppSetting 에 달림).
정규화 문자열은 앱에 보내지 않고 로그에도 남기지 않는다(길이만).
"""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass
from importlib.metadata import PackageNotFoundError, version
from typing import Any, Protocol

COMPARATOR_VERSION = "1.0"
MAX_COMPARE_CHARS = 2000
LENGTH_RATIO_LIMIT = 3.0


class ReadingUnavailableError(Exception):
    """읽기 변환기를 쓸 수 없다 — 워커는 claim 하지 않고 기다린다(README §2 기동 점검)."""


class ReadingProvider(Protocol):
    version: str

    def check(self) -> None: ...

    def read(self, text: str) -> str: ...


class OpenJTalkReading:
    """pyopenjtalk `g2p(kana=True)` — 사전은 첫 사용 때 패키지 안에 받는다(dev venv / 운영 venv 설치는 사용자 승인 U2)."""

    def __init__(self) -> None:
        self._mod: Any = None
        try:
            self.version = f"pyopenjtalk-{version('pyopenjtalk')}"
        except PackageNotFoundError:
            self.version = "pyopenjtalk-unknown"

    def check(self) -> None:
        try:
            import pyopenjtalk  # noqa: PLC0415 — 없으면 워커가 claim 하지 않는다(ImportError 를 기동 점검으로)

            if pyopenjtalk.g2p("テスト", kana=True) != "テスト":
                raise ReadingUnavailableError("reading self-test mismatch")
        except ReadingUnavailableError:
            raise
        except Exception as e:  # noqa: BLE001 — import·사전 로드 실패를 한 종류로 본다
            raise ReadingUnavailableError(type(e).__name__) from None
        self._mod = pyopenjtalk

    def read(self, text: str) -> str:
        if self._mod is None:
            self.check()
        return str(self._mod.g2p(text, kana=True)) if text else ""


def kata_to_hira(s: str) -> str:
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in s)


def keep_letters(s: str) -> str:
    return "".join(c for c in s if unicodedata.category(c)[0] in ("L", "N", "M"))


def levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if len(a) < len(b):
        a, b = b, a
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


@dataclass(frozen=True, repr=False)
class Comparison:
    similarity: float
    flags: tuple[str, ...]
    realtime_len: int
    analysis_len: int

    @property
    def both_empty(self) -> bool:
        return self.realtime_len == 0 and self.analysis_len == 0

    def __repr__(self) -> str:
        return f"Comparison(similarity={self.similarity:.3f}, flags={self.flags}, realtime_len={self.realtime_len}, analysis_len={self.analysis_len})"


class TranscriptComparator:
    def __init__(self, reading: ReadingProvider) -> None:
        self.reading = reading
        self.version = COMPARATOR_VERSION

    def normalize(self, text: str) -> str:
        s = unicodedata.normalize("NFKC", text or "").strip()
        if not keep_letters(s):
            return ""
        return kata_to_hira(keep_letters(self.reading.read(s)))[:MAX_COMPARE_CHARS]

    def compare(self, realtime_text: str, analysis_text: str) -> Comparison:
        a = self.normalize(realtime_text)
        b = self.normalize(analysis_text)
        la, lb = len(a), len(b)
        flags: list[str] = []
        if lb == 0 and la > 0:
            flags.append("ANALYSIS_EMPTY")
        if la == 0 and lb > 0:
            flags.append("REALTIME_EMPTY")
        if la and lb and max(la, lb) / min(la, lb) >= LENGTH_RATIO_LIMIT:
            flags.append("LENGTH_RATIO")
        if la == 0 or lb == 0:
            similarity = 0.0
        else:
            similarity = 1.0 - levenshtein(a, b) / max(la, lb, 1)
        return Comparison(similarity=round(max(0.0, min(1.0, similarity)), 4), flags=tuple(flags), realtime_len=la, analysis_len=lb)
