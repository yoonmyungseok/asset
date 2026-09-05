from decimal import Decimal

from app.external import toss_invest
from app.external.market_data import (
    build_symbol_candidates,
    extract_korean_code,
    get_provider_name,
    normalize_symbol_query,
    parse_display_price,
)


def test_normalize_symbol_query_strips_trailing_dot():
    assert normalize_symbol_query("379780.") == "379780"


def test_normalize_symbol_query_handles_suffix():
    assert normalize_symbol_query("005930.ks") == "005930.KS"


def test_build_symbol_candidates_for_six_digit_code():
    assert build_symbol_candidates("379780") == ["379780.KS", "379780.KQ"]


def test_build_symbol_candidates_for_trailing_dot():
    assert build_symbol_candidates("379780.") == ["379780.KS", "379780.KQ"]


def test_build_symbol_candidates_for_explicit_suffix():
    assert build_symbol_candidates("005930.KS") == ["005930.KS"]


def test_build_symbol_candidates_for_alphanumeric_code():
    assert build_symbol_candidates("0177R0") == ["0177R0"]


def test_normalize_alphanumeric_symbol_query():
    assert normalize_symbol_query("0177R0") == "0177R0"
    assert normalize_symbol_query("0177R0.KS") == "0177R0.KS"


def test_extract_korean_code():
    assert extract_korean_code("379780.KS") == "379780"
    assert extract_korean_code("123456.KQ") == "123456"
    assert extract_korean_code("0177R0") == "0177R0"
    assert extract_korean_code("0177R0.KS") == "0177R0"
    assert extract_korean_code("AAPL") is None


def test_parse_naver_price():
    assert parse_display_price("22,610") == Decimal("22610")
    assert parse_display_price("") is None


def test_to_app_symbol():
    assert toss_invest.to_app_symbol("379780", "KOSPI") == "379780.KS"
    assert toss_invest.to_app_symbol("123456", "KOSDAQ") == "123456.KQ"
    assert toss_invest.to_app_symbol("0177R0", "KOSPI") == "0177R0.KS"


def test_to_toss_symbol():
    assert toss_invest.to_toss_symbol("379780.KS") == "379780"
    assert toss_invest.to_toss_symbol("0177R0.KS") == "0177R0"
    assert toss_invest.to_toss_symbol("AAPL") == "AAPL"


def test_parse_oauth_token_flat_response():
    token, expires_in = toss_invest._parse_oauth_token({
        "access_token": "abc123",
        "token_type": "Bearer",
        "expires_in": 86400,
    })
    assert token == "abc123"
    assert expires_in == 86400


def test_parse_oauth_token_wrapped_response():
    token, expires_in = toss_invest._parse_oauth_token({
        "result": {
            "accessToken": "wrapped",
            "expiresIn": 3600,
        },
    })
    assert token == "wrapped"
    assert expires_in == 3600


def test_get_provider_name_without_credentials(monkeypatch):
    monkeypatch.setattr(toss_invest, "is_toss_configured", lambda: False)
    assert get_provider_name() == "fallback"
