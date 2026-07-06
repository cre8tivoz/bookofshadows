import platform
from pathlib import Path


def test_hermes_home_env_override(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path))
    from paths import hermes_home
    assert hermes_home() == tmp_path


def test_hermes_home_posix_default(monkeypatch):
    monkeypatch.delenv("HERMES_HOME", raising=False)
    monkeypatch.setattr(platform, "system", lambda: "Darwin")
    from paths import hermes_home
    assert hermes_home() == Path.home() / ".hermes"


def test_hermes_home_windows_default(monkeypatch):
    monkeypatch.delenv("HERMES_HOME", raising=False)
    monkeypatch.setattr(platform, "system", lambda: "Windows")
    monkeypatch.setenv("LOCALAPPDATA", r"C:\Users\TestUser\AppData\Local")
    from paths import hermes_home
    result = hermes_home()
    assert str(result).endswith("hermes")
    assert "AppData" in str(result)
    assert "Local" in str(result)


def test_hermes_home_windows_no_localappdata(monkeypatch):
    monkeypatch.delenv("HERMES_HOME", raising=False)
    monkeypatch.delenv("LOCALAPPDATA", raising=False)
    monkeypatch.setattr(platform, "system", lambda: "Windows")
    from paths import hermes_home
    assert str(hermes_home()).endswith("hermes")


def test_mnemosyne_db_env_override(tmp_path, monkeypatch):
    db = tmp_path / "test.db"
    db.write_text("")
    monkeypatch.setenv("MNEMOSYNE_DB_PATH", str(db))
    from paths import mnemosyne_db_path
    assert mnemosyne_db_path() == db


def test_mempalace_config_path(tmp_path, monkeypatch):
    monkeypatch.delenv("MEMPALACE_DIR", raising=False)
    monkeypatch.delenv("MEMPALACE_CONFIG", raising=False)
    from paths import mempalace_config_path
    assert mempalace_config_path() == Path.home() / ".mempalace" / "config.json"


def test_mempalace_config_path_env_var(tmp_path, monkeypatch):
    cfg = tmp_path / "mempalace.json"
    monkeypatch.setenv("MEMPALACE_CONFIG", str(cfg))
    from paths import mempalace_config_path
    assert mempalace_config_path() == cfg
