"""WS 티켓 검증(api-contract §0-3·#20) — HS256·`JWT_SECRET`·`aud:"ws-speech"`·60초·`jti` 1회용.

- 알고리즘은 HS256 하나만 받는다(alg 혼동 차단). 앱 세션 JWT 는 aud 가 없어 여기서 거부된다.
- `exp - now > MAX_TTL_SEC` 인 토큰은 티켓이 아니다(같은 비밀키로 서명된 장수명 토큰 차단).
- `jti` 는 다른 검증을 모두 통과한 뒤에만 소비한다 — 형식이 틀린 요청이 남의 jti 를 태워 없애지 못하게.
- 재사용 기록은 프로세스 메모리뿐이라 재시작하면 잊는다 → **`iat` 가 이 프로세스 기동 시각보다 이른 티켓은 거부**
  (task-003e Codex C2). 재시작 전에 발급된 티켓은 재시작 뒤에 못 쓰고, 클라이언트는 4401 을 받아 새 티켓으로 1회 재시도한다.
  허용 오차 `BOOT_SKEW_SEC`(2s): 앱과 gateway 는 같은 호스트(같은 시계)라 오차는 `iat` 의 초 단위 절삭뿐이다 —
  그만큼(기동 직전 ≤2s 에 발급된 티켓)은 재시작 뒤 1회 재사용될 수 있는 잔여 위험으로 둔다.
- 다중 프로세스(uvicorn `--workers`·pm2 `instances>1`)면 jti 캐시가 프로세스마다 따로라 재사용 차단이 깨진다 —
  단일 프로세스 전제(ecosystem `instances: 1`, `--workers` 미지정, README §6).
- 오류 메시지·로그에 토큰 문자열을 싣지 않는다.
"""

from __future__ import annotations

import re
import time
from collections import OrderedDict
from collections.abc import Callable
from dataclasses import dataclass

import jwt

AUDIENCE = "ws-speech"
MAX_TTL_SEC = 120
LEEWAY_SEC = 2
MAX_TOKEN_CHARS = 4096
BOOT_SKEW_SEC = 2
PURPOSES = ("TURN", "MIC_TEST")
_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")
_JTI = re.compile(r"^[A-Za-z0-9._:-]{8,128}$")


class TicketError(Exception):
    """`kind`: INVALID(형식·서명·aud·만료) | REUSED(jti 재사용) | BUSY(재사용 캐시 포화)."""

    def __init__(self, kind: str, reason: str) -> None:
        super().__init__(reason)
        self.kind = kind


@dataclass(frozen=True)
class TicketClaims:
    user_id: str
    chat_id: str | None
    purpose: str
    jti: str
    exp: int


class ReplayCache:
    """사용한 jti → 만료 시각. 만료가 지난 항목은 넣을 때마다 앞에서부터 치운다(삽입 순 ≈ 만료 순)."""

    def __init__(self, max_entries: int = 10_000, clock: Callable[[], float] = time.time) -> None:
        self._items: OrderedDict[str, float] = OrderedDict()
        self._max = max_entries
        self._clock = clock

    def _purge(self) -> None:
        now = self._clock()
        while self._items:
            jti, until = next(iter(self._items.items()))
            if until > now:
                break
            del self._items[jti]

    def seen(self, jti: str) -> bool:
        self._purge()
        return jti in self._items

    def add(self, jti: str, until: float) -> None:
        self._purge()
        if len(self._items) >= self._max:
            raise TicketError("BUSY", "replay cache full")
        self._items[jti] = until

    def __len__(self) -> int:
        return len(self._items)


class TicketVerifier:
    def __init__(
        self, secret: str, cache: ReplayCache | None = None, clock: Callable[[], float] = time.time, boot_epoch: float | None = None
    ) -> None:
        if not secret:
            raise ValueError("ticket secret is empty")
        self._key = secret
        self._cache = cache or ReplayCache(clock=clock)
        self._clock = clock
        self.boot_epoch = clock() if boot_epoch is None else boot_epoch

    def verify(self, token: object) -> TicketClaims:
        if not isinstance(token, str) or not token or len(token) > MAX_TOKEN_CHARS:
            raise TicketError("INVALID", "ticket missing or too long")
        try:
            claims = jwt.decode(
                token,
                self._key,
                algorithms=["HS256"],
                audience=AUDIENCE,
                leeway=LEEWAY_SEC,
                options={"require": ["exp", "iat", "aud", "sub", "jti"]},
            )
        except jwt.ExpiredSignatureError:
            raise TicketError("INVALID", "ticket expired") from None
        except jwt.InvalidTokenError as e:
            raise TicketError("INVALID", f"ticket invalid ({type(e).__name__})") from None

        sub, jti, exp, iat = claims.get("sub"), claims.get("jti"), claims.get("exp"), claims.get("iat")
        chat_id = claims.get("chatId")
        purpose = claims.get("purpose", "TURN")
        if not isinstance(sub, str) or not _ID.match(sub):
            raise TicketError("INVALID", "ticket subject invalid")
        if not isinstance(jti, str) or not _JTI.match(jti):
            raise TicketError("INVALID", "ticket jti invalid")
        if chat_id is not None and (not isinstance(chat_id, str) or not _ID.match(chat_id)):
            raise TicketError("INVALID", "ticket chatId invalid")
        if purpose not in PURPOSES:
            raise TicketError("INVALID", "ticket purpose invalid")
        now = self._clock()
        if not isinstance(exp, (int, float)) or exp - now > MAX_TTL_SEC:
            raise TicketError("INVALID", "ticket lifetime too long")
        if not isinstance(iat, (int, float)) or isinstance(iat, bool) or iat > now + LEEWAY_SEC:
            raise TicketError("INVALID", "ticket iat invalid")
        if iat < int(self.boot_epoch) - BOOT_SKEW_SEC:
            raise TicketError("INVALID", "ticket issued before gateway start")
        if self._cache.seen(jti):
            raise TicketError("REUSED", "ticket already used")
        self._cache.add(jti, float(exp) + LEEWAY_SEC + 30)
        return TicketClaims(user_id=sub, chat_id=chat_id, purpose=str(purpose), jti=jti, exp=int(exp))
