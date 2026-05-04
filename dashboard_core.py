from __future__ import annotations

import json
import os
import re
import shutil
import sqlite3
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


def plugin_data_dir() -> Path:
    home = Path(os.environ.get("HERMES_HOME", str(Path.home() / ".hermes")))
    path = home / "plugin-data" / "mnemosyne-dashboard"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _utc_now() -> str:
    return datetime.now(UTC).replace(tzinfo=None).isoformat(timespec="seconds")


def _is_expired(value: object, now: str | None = None) -> bool:
    text = str(value or "").strip()
    return bool(text and text <= (now or _utc_now()))

def default_db_path() -> Path:
    home = Path(os.environ.get("HERMES_HOME", str(Path.home() / ".hermes")))
    return home / "mnemosyne" / "data" / "mnemosyne.db"


class DashboardStore:
    """Read-only access helpers for the local Mnemosyne SQLite store."""

    def __init__(self, db_path: str | Path | None = None):
        self.db_path = Path(db_path) if db_path else default_db_path()

    def connect(self) -> sqlite3.Connection:
        if not self.db_path.exists():
            raise FileNotFoundError(f"Mnemosyne DB not found: {self.db_path}")
        uri = f"file:{self.db_path}?mode=ro"
        con = sqlite3.connect(uri, uri=True, timeout=10)
        con.row_factory = sqlite3.Row
        con.create_function("REGEXP", 2, self._regexp)
        return con

    def connect_rw(self) -> sqlite3.Connection:
        if not self.db_path.exists():
            raise FileNotFoundError(f"Mnemosyne DB not found: {self.db_path}")
        con = sqlite3.connect(str(self.db_path), timeout=10)
        con.row_factory = sqlite3.Row
        con.create_function("REGEXP", 2, self._regexp)
        con.execute("PRAGMA busy_timeout=5000")
        return con

    @staticmethod
    def _tables(con: sqlite3.Connection) -> set[str]:
        return {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}

    @staticmethod
    def _dict(row: sqlite3.Row) -> dict[str, Any]:
        d = dict(row)
        if d.get("metadata_json"):
            try:
                d["metadata"] = json.loads(d["metadata_json"])
            except Exception:
                d["metadata"] = None
        d["status"] = DashboardStore._memory_status(d)
        return d

    @staticmethod
    def _memory_status(item: dict[str, Any]) -> str:
        if str(item.get("superseded_by") or "").strip():
            return "superseded"
        if _is_expired(item.get("valid_until")):
            return "expired"
        return "active"

    @staticmethod
    def _regexp(pattern: str, value: object) -> int:
        if value is None:
            return 0
        return 1 if re.search(pattern, str(value), flags=re.IGNORECASE) else 0

    @staticmethod
    def _search_terms(value: str) -> list[str]:
        return [term for term in re.findall(r"[\w-]+", value or "") if term]

    @classmethod
    def _prefix_pattern(cls, value: str) -> str:
        terms = cls._search_terms(value)
        if not terms:
            return r"a^"
        lookaheads = "".join(rf"(?=.*(?:^|[^\w]){re.escape(term)})" for term in terms)
        return lookaheads + r".*"

    def diagnostics(self) -> dict[str, Any]:
        path = self.db_path.expanduser()
        info: dict[str, Any] = {
            "db_path": str(path),
            "exists": path.exists(),
            "readable": os.access(path, os.R_OK) if path.exists() else False,
            "read_only": True,
            "size_bytes": 0,
            "modified_at": "",
            "tables": [],
            "table_counts": {},
            "ok": False,
            "error": "",
        }
        if not path.exists():
            info["error"] = "Mnemosyne DB not found at configured path."
            return info
        try:
            stat = path.stat()
            info["size_bytes"] = stat.st_size
            info["modified_at"] = __import__("datetime").datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds")
            with self.connect() as con:
                tables = sorted(self._tables(con))
                info["tables"] = tables
                info["table_errors"] = {}
                for table in tables:
                    if re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", table):
                        try:
                            info["table_counts"][table] = int(con.execute(f"SELECT count(*) FROM {table}").fetchone()[0])
                        except Exception as exc:
                            info["table_errors"][table] = str(exc)
                required = {"working_memory", "episodic_memory", "triples", "consolidation_log"}
                info["missing_expected_tables"] = sorted(required - set(tables))
                info["ok"] = not info["missing_expected_tables"]
        except Exception as exc:
            info["error"] = str(exc)
        return info

    def stats(self) -> dict[str, Any]:
        with self.connect() as con:
            tables = self._tables(con)
            counts: dict[str, int] = {}
            for table in ["working_memory", "episodic_memory", "memories", "triples", "consolidation_log", "scratchpad"]:
                if table in tables:
                    counts[table] = int(con.execute(f"SELECT count(*) FROM {table}").fetchone()[0])
                else:
                    counts[table] = 0

            by_source_raw = []
            by_scope_raw = []
            by_session_raw = []
            for table, tier in [("working_memory", "working"), ("episodic_memory", "episodic")]:
                if table not in tables:
                    continue
                by_source_raw += [dict(r, tier=tier) for r in con.execute(
                    f"SELECT COALESCE(source,'') AS source, count(*) AS count FROM {table} GROUP BY source ORDER BY count DESC LIMIT 20"
                )]
                by_scope_raw += [dict(r, tier=tier) for r in con.execute(
                    f"SELECT COALESCE(scope,'') AS scope, count(*) AS count FROM {table} GROUP BY scope ORDER BY count DESC"
                )]
                by_session_raw += [dict(r, tier=tier) for r in con.execute(
                    f"SELECT COALESCE(session_id,'') AS session_id, count(*) AS count FROM {table} GROUP BY session_id ORDER BY count DESC LIMIT 20"
                )]

            def aggregate(rows: list[dict[str, Any]], key: str, limit: int = 20) -> list[dict[str, Any]]:
                totals: dict[str, int] = {}
                for row in rows:
                    label = row.get(key) or "unknown"
                    totals[label] = totals.get(label, 0) + int(row.get("count") or 0)
                return [{key: k, "count": v} for k, v in sorted(totals.items(), key=lambda kv: kv[1], reverse=True)[:limit]]

            by_source = aggregate(by_source_raw, "source", 20)
            by_scope = aggregate(by_scope_raw, "scope", 20)
            by_session = aggregate(by_session_raw, "session_id", 20)

            recent = self.list_memories(kind="all", limit=10)
            return {
                "db_path": str(self.db_path),
                "counts": counts,
                "by_source": by_source,
                "by_scope": by_scope,
                "by_session": by_session,
                "recent": recent,
            }

    def list_memories(
        self,
        kind: str = "all",
        q: str = "",
        source: str = "",
        scope: str = "",
        session_id: str = "",
        sort: str = "recent",
        limit: int = 100,
        offset: int = 0,
        status: str = "active",
    ) -> list[dict[str, Any]]:
        limit = max(1, min(int(limit or 100), 500))
        offset = max(0, int(offset or 0))
        q = (q or "").strip()
        source = (source or "").strip()
        scope = (scope or "").strip()
        session_id = (session_id or "").strip()
        sort = (sort or "recent").strip()
        status = (status or "active").strip().lower()
        if status not in {"active", "expired", "superseded", "all"}:
            status = "active"
        now = _utc_now()
        sql_order = {
            "recent": "COALESCE(timestamp, created_at) DESC",
            "oldest": "COALESCE(timestamp, created_at) ASC",
            "importance": "importance DESC, COALESCE(timestamp, created_at) DESC",
            "recall": "recall_count DESC, COALESCE(last_recalled, timestamp, created_at) DESC",
        }.get(sort, "COALESCE(timestamp, created_at) DESC")
        wanted = []
        if kind in ("all", "working"):
            wanted.append(("working_memory", "working"))
        if kind in ("all", "episodic"):
            wanted.append(("episodic_memory", "episodic"))

        rows: list[dict[str, Any]] = []
        with self.connect() as con:
            tables = self._tables(con)
            for table, tier in wanted:
                if table not in tables:
                    continue
                where = []
                params: list[Any] = []
                if q:
                    where.append("content REGEXP ?")
                    params.append(self._prefix_pattern(q))
                if source:
                    where.append("source = ?")
                    params.append(source)
                if scope:
                    where.append("scope = ?")
                    params.append(scope)
                if session_id:
                    where.append("session_id = ?")
                    params.append(session_id)
                if status == "active":
                    where.append("COALESCE(superseded_by, '') = ''")
                    where.append("(valid_until IS NULL OR valid_until = '' OR valid_until > ?)")
                    params.append(now)
                elif status == "expired":
                    where.append("COALESCE(superseded_by, '') = ''")
                    where.append("valid_until IS NOT NULL AND valid_until != '' AND valid_until <= ?")
                    params.append(now)
                elif status == "superseded":
                    where.append("COALESCE(superseded_by, '') != ''")
                clause = "WHERE " + " AND ".join(where) if where else ""
                sql = f"""
                    SELECT id, content, source, timestamp, session_id, importance, metadata_json,
                           created_at, recall_count, last_recalled, valid_until, superseded_by,
                           scope, author_id, author_type, channel_id
                    FROM {table}
                    {clause}
                    ORDER BY {sql_order}
                    LIMIT ? OFFSET ?
                """
                for row in con.execute(sql, [*params, limit, offset]):
                    d = self._dict(row)
                    d["tier"] = tier
                    rows.append(d)
        rows.sort(key=lambda r: (
            float(r.get("importance") or 0) if sort == "importance" else int(r.get("recall_count") or 0) if sort == "recall" else (r.get("timestamp") or r.get("created_at") or "")
        ), reverse=sort != "oldest")
        return rows[:limit]

    def get_memory(self, memory_id: str) -> dict[str, Any] | None:
        with self.connect() as con:
            for table, tier in [("working_memory", "working"), ("episodic_memory", "episodic")]:
                if table not in self._tables(con):
                    continue
                row = con.execute(f"SELECT * FROM {table} WHERE id = ?", (memory_id,)).fetchone()
                if row:
                    d = self._dict(row)
                    d["tier"] = tier
                    return d
        return None

    def triples(self, q: str = "", subject: str = "", predicate: str = "", object_: str = "", limit: int = 200) -> list[dict[str, Any]]:
        limit = max(1, min(int(limit or 200), 1000))
        where = []
        params: list[Any] = []
        if q:
            pattern = self._prefix_pattern(q)
            where.append("(subject REGEXP ? OR predicate REGEXP ? OR object REGEXP ?)")
            params += [pattern, pattern, pattern]
        for col, value in [("subject", subject), ("predicate", predicate), ("object", object_)]:
            if value:
                where.append(f"{col} REGEXP ?")
                params.append(self._prefix_pattern(value))
        clause = "WHERE " + " AND ".join(where) if where else ""
        with self.connect() as con:
            if "triples" not in self._tables(con):
                return []
            return [dict(r) for r in con.execute(
                f"SELECT id, subject, predicate, object, valid_from, valid_until, source, confidence, created_at FROM triples {clause} ORDER BY created_at DESC LIMIT ?",
                [*params, limit],
            )]

    def graph(self, q: str = "", limit: int = 300) -> dict[str, Any]:
        triples = self.triples(q=q, limit=limit)
        node_ids: dict[str, str] = {}
        node_counts: dict[str, int] = {}
        nodes: list[dict[str, Any]] = []
        edges: list[dict[str, Any]] = []

        def node(label: str) -> str:
            node_counts[label] = node_counts.get(label, 0) + 1
            if label not in node_ids:
                nid = f"n{len(node_ids)+1}"
                node_ids[label] = nid
                nodes.append({"id": nid, "label": label, "count": 0})
            return node_ids[label]

        for t in triples:
            s = node(str(t["subject"]))
            o = node(str(t["object"]))
            edges.append({
                "id": f"e{t['id']}",
                "triple_id": t.get("id"),
                "source": s,
                "target": o,
                "subject": t.get("subject"),
                "predicate": t["predicate"],
                "object": t.get("object"),
                "confidence": t.get("confidence"),
                "valid_from": t.get("valid_from"),
                "valid_until": t.get("valid_until"),
                "created_at": t.get("created_at"),
                "source_name": t.get("source"),
            })
        for n in nodes:
            n["count"] = node_counts.get(n["label"], 0)
        return {"nodes": nodes, "edges": edges}

    def consolidations(self, q: str = "", limit: int = 100) -> list[dict[str, Any]]:
        limit = max(1, min(int(limit or 100), 500))
        q = (q or "").strip()
        where = ""
        params: list[Any] = []
        if q:
            where = "WHERE session_id REGEXP ? OR summary_preview REGEXP ? OR created_at REGEXP ?"
            pattern = self._prefix_pattern(q)
            params = [pattern, pattern, pattern]
        with self.connect() as con:
            if "consolidation_log" not in self._tables(con):
                return []
            return [dict(r) for r in con.execute(
                f"SELECT id, session_id, items_consolidated, summary_preview, created_at FROM consolidation_log {where} ORDER BY created_at DESC LIMIT ?",
                [*params, limit],
            )]
    def session_detail(self, session_id: str, limit: int = 200) -> dict[str, Any]:
        session_id = (session_id or "").strip()
        if not session_id:
            raise ValueError("session_id is required")
        limit = max(1, min(int(limit or 200), 500))
        memories = self.list_memories(kind="all", session_id=session_id, sort="recent", limit=limit)
        consolidations = self.consolidations(q=session_id, limit=limit)
        triples: list[dict[str, Any]] = []
        with self.connect() as con:
            tables = self._tables(con)
            if "triples" in tables:
                cols = {r[1] for r in con.execute("PRAGMA table_info(triples)")}
                where = []
                params: list[Any] = []
                if "session_id" in cols:
                    where.append("session_id = ?")
                    params.append(session_id)
                if "source" in cols:
                    where.append("source = ?")
                    params.append(session_id)
                if where:
                    triples = [dict(r) for r in con.execute(
                        f"SELECT * FROM triples WHERE {' OR '.join(where)} ORDER BY COALESCE(created_at, valid_from) DESC LIMIT ?",
                        [*params, limit],
                    )]
        events: list[dict[str, Any]] = []
        for m in memories:
            events.append({"type": "memory", "timestamp": m.get("timestamp") or m.get("created_at") or "", "title": m.get("tier") or "memory", "preview": str(m.get("content") or "")[:240], "item": m})
        for t in triples:
            events.append({"type": "triple", "timestamp": t.get("created_at") or t.get("valid_from") or "", "title": t.get("predicate") or "triple", "preview": f"{t.get('subject')} → {t.get('object')}", "item": t})
        for c in consolidations:
            if c.get("session_id") == session_id:
                events.append({"type": "consolidation", "timestamp": c.get("created_at") or "", "title": f"{c.get('items_consolidated')} items", "preview": c.get("summary_preview") or "", "item": c})
        events.sort(key=lambda e: e.get("timestamp") or "", reverse=True)
        return {
            "session_id": session_id,
            "counts": {"memories": len(memories), "triples": len(triples), "consolidations": len([c for c in consolidations if c.get("session_id") == session_id]), "events": len(events)},
            "memories": memories,
            "triples": triples,
            "consolidations": [c for c in consolidations if c.get("session_id") == session_id],
            "events": events[:limit],
        }


    def audit_log(self, limit: int = 100) -> list[dict[str, Any]]:
        path = plugin_data_dir() / "audit.jsonl"
        if not path.exists():
            return []
        lines = path.read_text().splitlines()[-max(1, min(int(limit or 100), 1000)):]
        rows = []
        for line in lines:
            try:
                rows.append(json.loads(line))
            except Exception:
                rows.append({"raw": line})
        return list(reversed(rows))

    def _audit(self, action: str, memory_id: str, before: dict[str, Any] | None = None, after: dict[str, Any] | None = None, extra: dict[str, Any] | None = None) -> None:
        path = plugin_data_dir() / "audit.jsonl"
        path.parent.mkdir(parents=True, exist_ok=True)
        entry = {
            "timestamp": _utc_now(),
            "action": action,
            "memory_id": memory_id,
            "before": before,
            "after": after,
            "extra": extra or {},
        }
        with path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False, sort_keys=True) + "\n")

    def backup_database(self) -> dict[str, Any]:
        if not self.db_path.exists():
            raise FileNotFoundError(f"Mnemosyne DB not found: {self.db_path}")
        backup_dir = plugin_data_dir() / "backups"
        backup_dir.mkdir(parents=True, exist_ok=True)
        stamp = _utc_now().replace(":", "").replace("-", "")
        target = backup_dir / f"mnemosyne-{stamp}-{uuid.uuid4().hex[:8]}.db"
        shutil.copy2(self.db_path, target)
        return {"path": str(target), "size_bytes": target.stat().st_size, "created_at": _utc_now()}

    def invalidate_memory(self, memory_id: str, backup: bool = True) -> dict[str, Any]:
        memory_id = (memory_id or "").strip()
        if not memory_id:
            raise ValueError("memory_id is required")
        before = self.get_memory(memory_id)
        if not before:
            raise ValueError("memory not found")
        backup_info = self.backup_database() if backup else None
        now = _utc_now()
        with self.connect_rw() as con:
            updated = 0
            for table in ("working_memory", "episodic_memory"):
                if table in self._tables(con):
                    cur = con.execute(f"UPDATE {table} SET valid_until = ?, superseded_by = NULL WHERE id = ?", (now, memory_id))
                    updated += cur.rowcount
            if "memories" in self._tables(con):
                cols = {r[1] for r in con.execute("PRAGMA table_info(memories)")}
                if "valid_until" in cols:
                    con.execute("UPDATE memories SET valid_until = ? WHERE id = ?", (now, memory_id))
            con.commit()
        after = self.get_memory(memory_id)
        self._audit("invalidate", memory_id, before, after, {"backup": backup_info})
        return {"ok": updated > 0, "memory_id": memory_id, "status": "expired", "backup": backup_info, "item": after}

    def set_memory_importance(self, memory_id: str, importance: float, backup: bool = True) -> dict[str, Any]:
        memory_id = (memory_id or "").strip()
        if not memory_id:
            raise ValueError("memory_id is required")
        importance = float(importance)
        if not 0 <= importance <= 1:
            raise ValueError("importance must be between 0.0 and 1.0")
        before = self.get_memory(memory_id)
        if not before:
            raise ValueError("memory not found")
        backup_info = self.backup_database() if backup else None
        with self.connect_rw() as con:
            updated = 0
            for table in ("working_memory", "episodic_memory", "memories"):
                if table in self._tables(con):
                    cols = {r[1] for r in con.execute(f"PRAGMA table_info({table})")}
                    if "importance" in cols:
                        cur = con.execute(f"UPDATE {table} SET importance = ? WHERE id = ?", (importance, memory_id))
                        updated += cur.rowcount
            con.commit()
        after = self.get_memory(memory_id)
        self._audit("importance", memory_id, before, after, {"importance": importance, "backup": backup_info})
        return {"ok": updated > 0, "memory_id": memory_id, "importance": importance, "backup": backup_info, "item": after}

    def supersede_memory(self, memory_id: str, content: str, importance: float | None = None, backup: bool = True) -> dict[str, Any]:
        memory_id = (memory_id or "").strip()
        content = (content or "").strip()
        if not memory_id:
            raise ValueError("memory_id is required")
        if not content:
            raise ValueError("replacement content is required")
        before = self.get_memory(memory_id)
        if not before:
            raise ValueError("memory not found")
        replacement_id = f"dash_{uuid.uuid4().hex}"
        now = _utc_now()
        new_importance = float(before.get("importance") if importance is None else importance)
        if not 0 <= new_importance <= 1:
            raise ValueError("importance must be between 0.0 and 1.0")
        metadata = dict(before.get("metadata") or {})
        metadata.update({"supersedes": memory_id, "created_by": "mnemosyne-dashboard"})
        backup_info = self.backup_database() if backup else None
        with self.connect_rw() as con:
            tables = self._tables(con)
            if "working_memory" not in tables:
                raise ValueError("working_memory table not found")
            con.execute("""
                INSERT INTO working_memory(
                    id, content, source, timestamp, session_id, importance, metadata_json,
                    created_at, valid_until, superseded_by, scope, author_id, author_type, channel_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?)
            """, (
                replacement_id,
                content,
                before.get("source"),
                now,
                before.get("session_id") or "default",
                new_importance,
                json.dumps(metadata, ensure_ascii=False, sort_keys=True),
                now,
                before.get("scope") or "session",
                before.get("author_id"),
                before.get("author_type"),
                before.get("channel_id"),
            ))
            for table in ("working_memory", "episodic_memory"):
                if table in tables:
                    con.execute(f"UPDATE {table} SET valid_until = ?, superseded_by = ? WHERE id = ?", (now, replacement_id, memory_id))
            if "memories" in tables:
                cols = {r[1] for r in con.execute("PRAGMA table_info(memories)")}
                if {"id", "content"} <= cols:
                    keys = ["id", "content"]
                    values = [replacement_id, content]
                    optional = {
                        "source": before.get("source"),
                        "timestamp": now,
                        "session_id": before.get("session_id") or "default",
                        "importance": new_importance,
                        "metadata_json": json.dumps(metadata, ensure_ascii=False, sort_keys=True),
                    }
                    for k, v in optional.items():
                        if k in cols:
                            keys.append(k)
                            values.append(v)
                    con.execute(f"INSERT OR REPLACE INTO memories ({', '.join(keys)}) VALUES ({', '.join(['?'] * len(keys))})", values)
                    if "superseded_by" in cols or "valid_until" in cols:
                        sets = []
                        vals = []
                        if "valid_until" in cols:
                            sets.append("valid_until = ?")
                            vals.append(now)
                        if "superseded_by" in cols:
                            sets.append("superseded_by = ?")
                            vals.append(replacement_id)
                        vals.append(memory_id)
                        con.execute(f"UPDATE memories SET {', '.join(sets)} WHERE id = ?", vals)
            con.commit()
        replacement = self.get_memory(replacement_id)
        after = self.get_memory(memory_id)
        self._audit("supersede", memory_id, before, after, {"replacement_id": replacement_id, "backup": backup_info})
        return {"ok": True, "memory_id": memory_id, "replacement_id": replacement_id, "backup": backup_info, "item": after, "replacement": replacement}


    def global_search(self, q: str = "", limit: int = 30) -> dict[str, Any]:
        q = (q or "").strip()
        if not q:
            return {"query": q, "memories": [], "triples": [], "consolidations": []}
        per_kind = max(1, min(int(limit or 30), 100))
        return {
            "query": q,
            "memories": self.list_memories(kind="all", q=q, sort="recent", limit=per_kind),
            "triples": self.triples(q=q, limit=per_kind),
            "consolidations": self.consolidations(q=q, limit=per_kind),
        }

    def recall_debug(self, q: str = "", limit: int = 20) -> dict[str, Any]:
        q = (q or "").strip()
        rows = self.list_memories(kind="all", q=q, sort="importance", limit=max(1, min(int(limit or 20), 100))) if q else []
        terms = [t.lower() for t in q.split() if t.strip()]
        items = []
        for row in rows:
            content = str(row.get("content") or "")
            lower = content.lower()
            matched_terms = [t for t in terms if t in lower]
            importance = float(row.get("importance") or 0)
            recall_count = int(row.get("recall_count") or 0)
            term_score = len(matched_terms) / max(1, len(terms)) if terms else 0
            approx_score = round((0.55 * term_score) + (0.30 * importance) + (0.15 * min(recall_count, 10) / 10), 4)
            reasons = []
            if matched_terms:
                reasons.append(f"Matched terms: {', '.join(matched_terms[:8])}")
            if importance:
                reasons.append(f"Importance contributes {importance:.2f}")
            if recall_count:
                reasons.append(f"Previously recalled {recall_count} time(s)")
            if row.get("scope"):
                reasons.append(f"Scope: {row.get('scope')}")
            if row.get("source"):
                reasons.append(f"Source: {row.get('source')}")
            items.append({"memory": row, "approx_score": approx_score, "matched_terms": matched_terms, "reasons": reasons})
        items.sort(key=lambda x: x["approx_score"], reverse=True)
        return {
            "query": q,
            "note": "Approximate debugger: uses text matches, importance, and recall_count available in SQLite. It does not expose Mnemosyne's internal vector score unless upstream stores it.",
            "items": items,
        }

    def timeline(self, q: str = "", group: str = "day", limit: int = 300) -> dict[str, Any]:
        limit = max(1, min(int(limit or 300), 1000))
        q = (q or "").strip()
        memories = self.list_memories(kind="all", q=q, sort="recent", limit=limit)
        triples = self.triples(q=q, limit=limit)
        consolidations = self.consolidations(q=q, limit=limit)
        events: list[dict[str, Any]] = []
        for m in memories:
            ts = m.get("timestamp") or m.get("created_at") or ""
            events.append({"type": "memory", "timestamp": ts, "session_id": m.get("session_id") or "", "title": m.get("tier") or "memory", "preview": str(m.get("content") or "")[:240], "item": m})
        for t in triples:
            ts = t.get("created_at") or t.get("valid_from") or ""
            events.append({"type": "triple", "timestamp": ts, "session_id": "", "title": t.get("predicate") or "triple", "preview": f"{t.get('subject')} → {t.get('object')}", "item": t})
        for c in consolidations:
            ts = c.get("created_at") or ""
            events.append({"type": "consolidation", "timestamp": ts, "session_id": c.get("session_id") or "", "title": f"{c.get('items_consolidated')} items", "preview": c.get("summary_preview") or "", "item": c})
        events.sort(key=lambda e: e.get("timestamp") or "", reverse=True)
        groups: dict[str, list[dict[str, Any]]] = {}
        for e in events[:limit]:
            if group == "session":
                key = e.get("session_id") or "no session"
            else:
                key = (e.get("timestamp") or "unknown")[:10]
            groups.setdefault(key or "unknown", []).append(e)
        return {"query": q, "group": group, "groups": [{"key": k, "events": v, "count": len(v)} for k, v in groups.items()]}
