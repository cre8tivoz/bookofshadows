import pytest

from scripts.frontend_smoke import assert_contains


def test_assert_contains_success():
    """Verify assert_contains passes when expected substring is in body."""
    assert_contains("test_label", "hello world", "world")
    assert_contains("test_label", "hello world", "hello")
    assert_contains("test_label", "hello world", "hello world")


def test_assert_contains_failure():
    """Verify assert_contains raises AssertionError when expected substring is missing."""
    with pytest.raises(AssertionError) as exc_info:
        assert_contains("health_check", '{"ok": false}', '"ok": true')

    msg = str(exc_info.value)
    assert "health_check" in msg
    assert '\'"ok": true\'' in msg


def test_assert_contains_edge_cases():
    """Verify assert_contains handles edge cases such as empty strings and multiline text."""
    # Empty string expected should always succeed
    assert_contains("empty_expected", "some body text", "")

    # Empty body and non-empty expected should fail
    with pytest.raises(AssertionError):
        assert_contains("empty_body", "", "expected")

    # Empty body and empty expected should succeed
    assert_contains("both_empty", "", "")

    # Multiline text check
    body = "line 1\nline 2\nline 3"
    assert_contains("multiline", body, "line 2")
