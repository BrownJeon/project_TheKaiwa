from __future__ import annotations

import time

import jwt
import pytest

from kaiwa_gateway.ticket import ReplayCache, TicketError, TicketVerifier
from tests.conftest import JWT_SECRET, make_ticket


def verifier() -> TicketVerifier:
    return TicketVerifier(JWT_SECRET)


def test_valid_ticket_defaults_to_turn() -> None:
    claims = verifier().verify(make_ticket(chatId="cchat01"))
    assert claims.user_id == "cuser0001"
    assert claims.chat_id == "cchat01"
    assert claims.purpose == "TURN"


def test_mic_test_purpose() -> None:
    assert verifier().verify(make_ticket(purpose="MIC_TEST")).purpose == "MIC_TEST"


@pytest.mark.parametrize(
    "claims",
    [
        {"aud": "speech-ws"},  # 설계 초안 표기 — 정본은 ws-speech
        {"aud": None},
        {"exp": int(time.time()) - 30},  # 만료(leeway 2s 초과)
        {"exp": int(time.time()) + 3600},  # 티켓이 아닌 장수명 토큰
        {"purpose": "ADMIN"},
        {"sub": "../etc"},
        {"sub": None},
        {"jti": None},
        {"jti": "short"},
        {"chatId": "c/../x"},
    ],
)
def test_invalid_claims_rejected(claims: dict) -> None:
    with pytest.raises(TicketError) as e:
        verifier().verify(make_ticket(**claims))
    assert e.value.kind == "INVALID"


def test_wrong_secret_and_algorithms_rejected() -> None:
    v = verifier()
    with pytest.raises(TicketError):
        v.verify(make_ticket(secret="another-secret-0123456789abcdef0123456789"))
    now = int(time.time())
    body = {"sub": "cuser0001", "aud": "ws-speech", "jti": "jti-12345678", "exp": now + 60}
    with pytest.raises(TicketError):
        v.verify(jwt.encode(body, JWT_SECRET * 2, algorithm="HS512"))
    unsigned = jwt.encode(body, key=None, algorithm="none")  # type: ignore[arg-type]
    with pytest.raises(TicketError):
        v.verify(unsigned)


def test_session_jwt_is_not_a_ticket() -> None:
    session_token = jwt.encode({"userId": "cuser0001", "email": "a@b.c", "exp": int(time.time()) + 60}, JWT_SECRET, algorithm="HS256")
    with pytest.raises(TicketError):
        verifier().verify(session_token)


def test_reuse_rejected_and_invalid_does_not_consume_jti() -> None:
    v = verifier()
    with pytest.raises(TicketError):
        v.verify(make_ticket(jti="same-jti-000001", purpose="BAD"))
    token = make_ticket(jti="same-jti-000001")
    v.verify(token)
    with pytest.raises(TicketError) as e:
        v.verify(token)
    assert e.value.kind == "REUSED"


def test_non_string_and_oversized_tokens() -> None:
    v = verifier()
    for token in (None, 123, "", "x" * 5000):
        with pytest.raises(TicketError):
            v.verify(token)


def test_replay_cache_expiry_and_capacity() -> None:
    now = [1000.0]
    cache = ReplayCache(max_entries=2, clock=lambda: now[0])
    cache.add("a", 1010)
    cache.add("b", 1020)
    with pytest.raises(TicketError) as e:
        cache.add("c", 1030)
    assert e.value.kind == "BUSY"
    now[0] = 1015
    assert not cache.seen("a")
    cache.add("c", 1030)
    assert cache.seen("b") and cache.seen("c")
