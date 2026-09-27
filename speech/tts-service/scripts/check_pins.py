"""설치본과 requirements.txt 핀 대조 — 불일치가 있으면 exit 1(deploy-from-ubuntu.sh 가 롤백).

실행: .venv/bin/python speech/tts-service/scripts/check_pins.py speech/tts-service/requirements.txt
"""

from __future__ import annotations

import re
import sys
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path

_PIN = re.compile(r"^([A-Za-z0-9_.\-]+)(?:\[[^\]]*\])?==([^\s;#]+)")


def main(path: str) -> int:
    bad = 0
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        m = _PIN.match(line.strip())
        if not m:
            continue
        name, want = m.group(1), m.group(2)
        try:
            have = version(name)
        except PackageNotFoundError:
            have = "(missing)"
        if have != want:
            bad += 1
            print(f"PIN MISMATCH {name}: installed {have}, required {want}")
    print("PINS OK" if bad == 0 else f"PINS FAILED ({bad})")
    return 0 if bad == 0 else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else str(Path(__file__).resolve().parents[1] / "requirements.txt")))
