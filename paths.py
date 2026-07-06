"""Cross-platform path resolution for Hermes home directory."""
from __future__ import annotations

import os
import platform
from pathlib import Path


def hermes_home() -> Path:
    """Return the Hermes home directory, respecting env overrides and platform defaults."""
    if env := os.environ.get("HERMES_HOME"):
        return Path(env).expanduser()
    if platform.system() == "Windows":
        local_app_data = os.environ.get("LOCALAPPDATA")
        if not local_app_data:
            local_app_data = str(Path.home() / "AppData" / "Local")
        return Path(local_app_data) / "hermes"
    return Path.home() / ".hermes"


def mnemosyne_db_path() -> Path:
    """Default Mnemosyne database path."""
    candidates = [
        os.environ.get("MNEMOSYNE_DASHBOARD_DB"),
        os.environ.get("MNEMOSYNE_DB_PATH"),
        os.environ.get("MNEMOSYNE_DB"),
    ]
    for c in candidates:
        if c:
            p = Path(c).expanduser()
            return p
    # Check common locations
    hermes = hermes_home()
    locations = [
        hermes / "mnemosyne" / "data" / "mnemosyne.db",
        hermes / "mnemosyne.db",
        Path.home() / ".mnemosyne" / "mnemosyne.db",
        hermes / "profiles" / "claudia" / "mnemosyne" / "data" / "mnemosyne.db",
    ]
    for loc in locations:
        if loc.exists():
            return loc
    return locations[0]


def mempalace_config_path() -> Path | None:
    """Default MemPalace config path."""
    if env := os.environ.get("MEMPALACE_CONFIG"):
        return Path(env).expanduser()
    if env := os.environ.get("MEMPALACE_DIR"):
        return Path(env).expanduser() / "config.json"
    return Path.home() / ".mempalace" / "config.json"
