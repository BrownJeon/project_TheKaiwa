"""형태소별 표기·읽기 분석(task-026 S1) — `POST /text/annotate` 의 본체.
화면의 후리가나(한자 묶음별 히라가나)와 한글 줄(발음 가나)을 같은 분석 한 번으로 만든다.

- 분석기는 pyopenjtalk `run_frontend`(NJD 노드 `string/read/pron/pos/chain_flag`).
  스레드 안전하지 않아 **전용 1-스레드 executor** 에서만 부르고, 사전은 기동 때 1회 로드(warm)한다.
  없거나 로드에 실패하면 FAILED — 라우트는 503, 앱은 빈 결과로 degrade(화면은 숨김).
- pyopenjtalk 은 표면형을 바꿔 돌려준다(반각→전각, 반각 가나→전각, 숫자→한자 `3時`→`三時`, 공백→`　`, 줄바꿈 삭제).
  그래서 원문을 같은 규칙으로 전각화한 문자열(zt)에 노드를 맞춰 나가고, 경계는 원문 위치로 되돌린다. 숫자 묶음은 한자 수사 노드를 흡수하고,
  그래도 맞출 수 없는 구간은 `ruby/pron = None`(표시 안 함 — "애매하면 숨김"). 이어 붙인 `surface` 는 항상 원문과 같다.
- 세그먼트 `{surface, ruby, pron, boundary}`:
  `ruby` = 한자 묶음별 히라가나 조각 `[[표기, 읽기|None], …]`(送り仮名는 읽기 None, 이어 붙이면 surface) — 한자 없음·정렬 실패면 None.
  `pron` = 발음 가타카나(조사 は→ワ·へ→エ·を→オ, 장음 ー, 악센트 기호 제거).
         기호·공백은 원문 그대로(변환기가 문장부호로 다룬다). 대응 실패 None.
  `boundary` = 이 조각 **앞** 구분 — `phrase`(악센트구·문장부호 뒤, 데모 ' ') / `particle`(조사 は·を·へ 뒤, 데모 '|') / None.
- 원문은 로그에 남기지 않는다(호출자가 건수·길이만 계측).
"""

from __future__ import annotations

import asyncio
import re
import unicodedata
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from typing import Any

MAX_TEXTS = 64
MAX_CHARS = 400
MAX_BODY_BYTES = 256 * 1024
# 대기+실행 작업 상한 — 최악 요청(64문장×400자) ≈0.24s × 6 ≈ 1.5s 로 앱 시간 제한 3s 안에 비운다(REV-089 실측).
MAX_PENDING = 6
VERSION = "1"

Frontend = Callable[[str], list[dict[str, Any]]]
Segment = dict[str, Any]

_KAN = "㐀-䶿一-鿿豈-﫿々〆ヶ"
_KAN_RE = re.compile(f"[{_KAN}]")
_PARTS_RE = re.compile(f"[{_KAN}]+|[^{_KAN}]+")
_KANA_RE = re.compile(r"^[ぁ-ゖァ-ヺー]+$")
_HAS_KANA = re.compile(r"[ぁ-ゖァ-ヺ]")
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_DIGITS = re.compile(r"[０-９]+(?:[，．][０-９]+)*")
_NUM_NODE = set("〇一二三四五六七八九十百千万億兆点・．０１２３４５６７８９")
_NUM_PREFIX = re.compile("[〇一二三四五六七八九十百千万億兆]+")
_OPENERS = set("「『（(【〔［[｛{〈《“‘")
_PARTICLE_PRON = {"ハ": "ワ", "ヘ": "エ", "ヲ": "オ"}


class TextRequestError(ValueError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class TextBusyError(Exception):
    """대기열이 찼다 — 라우트 503 BUSY(실패가 아니라 일시 거절, 앱은 쉬지 않고 숨김)."""


def parse_request(body: Any) -> list[str]:
    """`{texts: string[]}` — 1~64건, 각 400자 이하. 어긋나면 TextRequestError(code)."""
    if not isinstance(body, dict):
        raise TextRequestError("BAD_REQUEST")
    texts = body.get("texts")
    if not isinstance(texts, list) or not texts:
        raise TextRequestError("BAD_REQUEST")
    if len(texts) > MAX_TEXTS:
        raise TextRequestError("TOO_MANY_TEXTS")
    out: list[str] = []
    for t in texts:
        if not isinstance(t, str):
            raise TextRequestError("BAD_REQUEST")
        if len(t) > MAX_CHARS:
            raise TextRequestError("TEXT_TOO_LONG")
        out.append(t)
    return out


def _kata_to_hira(s: str) -> str:
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in s)


def _zenkaku(text: str) -> tuple[str, list[int]]:
    """pyopenjtalk 입력 정규화를 흉내 낸 전각 문자열과, 그 각 글자의 원문 시작 위치(끝에 len(text) 보초)."""
    out: list[str] = []
    starts: list[int] = []
    i = 0
    n = len(text)
    while i < n:
        c = text[i]
        o = ord(c)
        step = 1
        if 0x21 <= o <= 0x7E:
            z = chr(o + 0xFEE0)
        elif c == " ":
            z = "　"
        elif 0xFF61 <= o <= 0xFF9F:
            z = c
            if i + 1 < n and text[i + 1] in "ﾞﾟ":
                pair = unicodedata.normalize("NFKC", text[i : i + 2])
                if len(pair) == 1:
                    z, step = pair, 2
            if step == 1:
                single = unicodedata.normalize("NFKC", c)
                z = single if len(single) == 1 else c
        else:
            z = c
        out.append(z)
        starts.append(i)
        i += step
    starts.append(n)
    return "".join(out), starts


def _ruby_pieces(zs: str, read: str) -> list[tuple[int, int, str | None]] | None:
    """노드 표기(전각) 안의 한자 묶음별 읽기 — (시작, 끝, 히라가나|None). 한자 없음·읽기가 가나 아님·정렬 실패면 None."""
    if not _KAN_RE.search(zs) or not read or not _KANA_RE.match(read):
        return None
    hira = _kata_to_hira(read)
    parts = _PARTS_RE.findall(zs)
    pattern = ""
    for p in parts:
        if _KAN_RE.match(p):
            pattern += "(.+?)"
        else:
            if not _KANA_RE.match(p):
                return None
            pattern += "(" + re.escape(_kata_to_hira(p)) + ")"
    m = re.fullmatch(pattern, hira)
    if not m:
        return None
    pieces: list[tuple[int, int, str | None]] = []
    pos = 0
    for p, g in zip(parts, m.groups(), strict=True):
        pieces.append((pos, pos + len(p), g if _KAN_RE.match(p) else None))
        pos += len(p)
    return pieces


def _clean_pron(p: str) -> str:
    return p.replace("’", "").replace("'", "")


class _Unit:
    __slots__ = ("end", "kind", "nodes", "start")

    def __init__(self, start: int, end: int, kind: str, nodes: list[dict[str, Any]]) -> None:
        self.start = start
        self.end = end
        self.kind = kind  # node | number | space | unmapped
        self.nodes = nodes


def _resync(zt: str, j: int, nodes: list[dict[str, Any]], k: int) -> tuple[int, int] | None:
    """맞지 않는 구간을 건너뛸 가장 가까운 (원문 글자 수, 노드 수). 짧은 노드 한 개 우연 일치를 피하려고 다음 노드까지 이어 맞는지 본다."""
    best: tuple[int, int] | None = None
    for dj in range(0, 9):
        for dk in range(0, 5):
            if dj == 0 and dk == 0:
                continue
            kk = k + dk
            if kk >= len(nodes):
                break
            s = str(nodes[kk].get("string", ""))
            if not s or not zt.startswith(s, j + dj):
                continue
            nxt = kk + 1
            if len(s) < 2 and nxt < len(nodes):
                ns = str(nodes[nxt].get("string", ""))
                if not ns or not zt.startswith(ns, j + dj + len(s)):
                    continue
            if best is None or dj + dk < best[0] + best[1]:
                best = (dj, dk)
    return best


def _units(zt: str, nodes: list[dict[str, Any]]) -> list[_Unit]:
    units: list[_Unit] = []
    j = 0
    k = 0
    while j < len(zt):
        if k < len(nodes):
            s = str(nodes[k].get("string", ""))
            if s and zt.startswith(s, j):
                units.append(_Unit(j, j + len(s), "node", [nodes[k]]))
                j += len(s)
                k += 1
                continue
            m = _DIGITS.match(zt, j)
            if m:
                k1 = k
                while k1 < len(nodes) and str(nodes[k1].get("string", "")) and set(str(nodes[k1]["string"])) <= _NUM_NODE:
                    k1 += 1
                end = m.end()
                # 「3万円」→ 노드 三·万·円: 숫자 뒤에 원문 그대로 남은 한자 수사(万)는 같은 묶음으로 흡수한다.
                for t in range(k + 1, k1):
                    tail = "".join(str(nd["string"]) for nd in nodes[t:k1])
                    if zt.startswith(tail, end):
                        end += len(tail)
                        break
                # 「4日」→ 노드 四日: 수사로 시작하는 다음 노드의 나머지가 원문에 이어지면 그 노드까지 한 묶음.
                if end == m.end() and k1 < len(nodes):
                    s1 = str(nodes[k1].get("string", ""))
                    pre = _NUM_PREFIX.match(s1)
                    if pre and pre.end() < len(s1) and zt.startswith(s1[pre.end() :], end):
                        end += len(s1) - pre.end()
                        k1 += 1
                if k1 > k:
                    units.append(_Unit(j, end, "number", nodes[k:k1]))
                    j = end
                    k = k1
                    continue
        if zt[j].isspace():
            units.append(_Unit(j, j + 1, "space", []))
            j += 1
            continue
        hop = _resync(zt, j, nodes, k) if k < len(nodes) else None
        if hop is None:
            units.append(_Unit(j, len(zt), "unmapped", []))
            break
        dj, dk = hop
        if dj:
            units.append(_Unit(j, j + dj, "unmapped", []))
        j += dj
        k += dk
    return units


def _absorbs_next_kana(node: dict[str, Any], nxt: dict[str, Any]) -> bool:
    """한자로 끝나는 노드의 읽기가 다음 가나 노드의 표기로 끝나는가 — 「静(シズカ)+か」 와 「人(ヒト)+と」 모두 해당(판정은 호출자)."""
    s = str(node.get("string", ""))
    ns = str(nxt.get("string", ""))
    read = _kata_to_hira(str(node.get("read", "")))
    if not s or not _KAN_RE.match(s[-1]) or not ns or not _KANA_RE.match(ns):
        return False
    tail = _kata_to_hira(ns)
    return len(read) > len(tail) and read.endswith(tail)


def _merge_split_stems(nodes: list[dict[str, Any]], frontend: Frontend) -> list[dict[str, Any]]:
    """「この町は静か」 → 분석기가 静(形容動詞語幹, 읽기 シズカ) + か(助詞) 로 나눠 送り仮名 か 를 두 번 센다(シズカカ).
    읽기가 다음 가나로 끝나는 쌍만 의심하고 「표기+가나+です」를 다시 분석한다.
    (a) 한 단어(같은 읽기)로 나오면 합친다(静か=シズカ).
    (b) 같은 두 조각(같은 읽기)으로 다시 나오면 문맥이 바뀌어도 안정된 정상 분리다 — 그대로 둔다(人と·無駄だ·派手で).
    (c) 그 밖(분해가 흔들림·재분석 실패)인 語幹(形容動詞語幹) 쌍은 어느 쪽인지 모르므로 읽기 없는 한 노드로 숨긴다(틀린 발음보다 없음)."""
    out: list[dict[str, Any]] = []
    i = 0
    while i < len(nodes):
        node = nodes[i]
        if i + 1 < len(nodes) and _absorbs_next_kana(node, nodes[i + 1]):
            joined = str(node["string"]) + str(nodes[i + 1]["string"])
            try:
                probe = frontend(joined + "です")
            except Exception:  # noqa: BLE001 — 확인 실패는 "모름"
                probe = []
            head = probe[0] if probe and isinstance(probe[0], dict) else {}
            second = probe[1] if len(probe) > 1 and isinstance(probe[1], dict) else {}
            same_read = _kata_to_hira(str(head.get("read", ""))) == _kata_to_hira(str(node["read"]))
            if str(head.get("string", "")) == joined and same_read:
                out.append({**node, "string": joined})
                i += 2
                continue
            stable_split = same_read and head.get("string") == node["string"] and second.get("string") == nodes[i + 1]["string"]
            if not stable_split and node.get("pos_group1") == "形容動詞語幹":
                out.append({**node, "string": joined, "read": "", "pron": ""})
                i += 2
                continue
        out.append(node)
        i += 1
    return out


def annotate_one(text: str, frontend: Frontend) -> list[Segment]:
    if not text:
        return []
    zt, starts = _zenkaku(text)
    nodes = _merge_split_stems([n for n in frontend(text) if isinstance(n, dict)], frontend)
    segments: list[Segment] = []
    prev = "start"  # start | word | particle | punct | open | space
    for u in _units(zt, nodes):
        a, b = starts[u.start], starts[u.end]
        surface = text[a:b]
        if not surface:
            continue
        if u.kind == "space":
            segments.append({"surface": surface, "ruby": None, "pron": " ", "boundary": None})
            prev = "space"
            continue
        if u.kind == "unmapped":
            segments.append({"surface": surface, "ruby": None, "pron": None, "boundary": None})
            prev = "word"
            continue
        first = u.nodes[0]
        read = "".join(str(n.get("read", "")) for n in u.nodes)
        if not _HAS_KANA.search(read):
            if any(unicodedata.category(c)[0] in "LN" for c in surface):
                # 글자인데 읽기가 없다(사전 밖 한자 등) — 원문을 소리 자리에 흘리지 않는다.
                segments.append({"surface": surface, "ruby": None, "pron": None, "boundary": None})
                prev = "word"
                continue
            # 기호(。、？「」★ 등 — read 가 「、」 같은 비가나). 소리는 없고 원문 문장부호를 그대로 둔다.
            if surface.isspace():
                segments.append({"surface": surface, "ruby": None, "pron": " ", "boundary": None})
                prev = "space"
                continue
            opener = surface in _OPENERS
            sym_boundary = "phrase" if opener and prev in ("word", "particle") else None
            segments.append({"surface": surface, "ruby": None, "pron": surface, "boundary": sym_boundary})
            prev = "open" if opener else "punct"
            continue
        pron = "".join(_clean_pron(str(n.get("pron", ""))) for n in u.nodes)
        particle = u.kind == "node" and first.get("pos") == "助詞" and read in _PARTICLE_PRON
        if particle:
            pron = _PARTICLE_PRON[read]
        if prev == "punct":
            boundary: str | None = "phrase"
        elif prev == "particle":
            boundary = "particle"
        elif prev == "word" and first.get("chain_flag") == 0:
            boundary = "phrase"
        else:
            boundary = None
        ruby = None
        if u.kind == "node":
            pieces = _ruby_pieces(zt[u.start : u.end], read)
            if pieces is not None:
                ruby = [[text[starts[u.start + p0] : starts[u.start + p1]], r] for p0, p1, r in pieces]
                if "".join(str(p[0]) for p in ruby) != surface or any(not p[0] for p in ruby):
                    ruby = None
        segments.append({"surface": surface, "ruby": ruby, "pron": pron or None, "boundary": boundary})
        prev = "particle" if particle else "word"
    if "".join(s["surface"] for s in segments) != text:
        return [{"surface": text, "ruby": None, "pron": None, "boundary": None}]
    return segments


class TextAnnotator:
    """분석기 수명 — 전용 1-스레드 executor, 기동 때 사전 1회 로드. 상태 IDLE → OK | FAILED."""

    def __init__(self, frontend: Frontend | None = None) -> None:
        self._frontend = frontend
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="text-annotate")
        self.state = "OK" if frontend is not None else "IDLE"
        self.error: str | None = None
        # 이벤트 루프(단일 스레드)에서만 바뀌어 락이 필요 없다.
        self._pending = 0

    def _load(self) -> None:
        if self._frontend is not None:
            return
        try:
            import pyopenjtalk  # noqa: PLC0415 — 없으면 FAILED(라우트 503, 실시간 인식과 무관)

            pyopenjtalk.run_frontend("テスト")
        except Exception as e:  # noqa: BLE001 — import·사전 로드 실패를 한 종류로 본다
            self.state = "FAILED"
            self.error = type(e).__name__
            return
        self._frontend = pyopenjtalk.run_frontend
        self.state = "OK"

    async def warm(self) -> None:
        await asyncio.get_running_loop().run_in_executor(self._executor, self._load)

    def _run(self, texts: list[str]) -> list[list[Segment] | None]:
        self._load()
        frontend = self._frontend
        if frontend is None:
            raise RuntimeError("TEXT_ANALYZER_UNAVAILABLE")
        out: list[list[Segment] | None] = []
        for t in texts:
            if _CONTROL.search(t):
                out.append(None)
                continue
            try:
                out.append(annotate_one(t, frontend))
            except Exception:  # noqa: BLE001 — 한 문장 실패는 그 칸만 비운다
                out.append(None)
        return out

    @property
    def pending(self) -> int:
        return self._pending

    async def annotate(self, texts: list[str]) -> list[list[Segment] | None]:
        if self._pending >= MAX_PENDING:
            raise TextBusyError
        self._pending += 1
        try:
            return await asyncio.get_running_loop().run_in_executor(self._executor, self._run, texts)
        finally:
            # 취소 시 이미 실행 중인 작업(1-스레드라 최대 1건)은 끝까지 돈다 — 그만큼만 덜 센다.
            self._pending -= 1

    def shutdown(self) -> None:
        self._executor.shutdown(wait=False, cancel_futures=True)
