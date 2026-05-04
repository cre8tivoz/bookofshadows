from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from typing import Any


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
        return d

    @staticmethod
    def _like(value: str) -> str:
        return f"%{value.replace('%', '').replace('_', '')}%"

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
    ) -> list[dict[str, Any]]:
        limit = max(1, min(int(limit or 100), 500))
        offset = max(0, int(offset or 0))
        q = (q or "").strip()
        source = (source or "").strip()
        scope = (scope or "").strip()
        session_id = (session_id or "").strip()
        sort = (sort or "recent").strip()
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
                    where.append("content LIKE ?")
                    params.append(self._like(q))
                if source:
                    where.append("source = ?")
                    params.append(source)
                if scope:
                    where.append("scope = ?")
                    params.append(scope)
                if session_id:
                    where.append("session_id = ?")
                    params.append(session_id)
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
            where.append("(subject LIKE ? OR predicate LIKE ? OR object LIKE ?)")
            like = self._like(q)
            params += [like, like, like]
        for col, value in [("subject", subject), ("predicate", predicate), ("object", object_)]:
            if value:
                where.append(f"{col} LIKE ?")
                params.append(self._like(value))
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
            where = "WHERE session_id LIKE ? OR summary_preview LIKE ? OR created_at LIKE ?"
            like = self._like(q)
            params = [like, like, like]
        with self.connect() as con:
            if "consolidation_log" not in self._tables(con):
                return []
            return [dict(r) for r in con.execute(
                f"SELECT id, session_id, items_consolidated, summary_preview, created_at FROM consolidation_log {where} ORDER BY created_at DESC LIMIT ?",
                [*params, limit],
            )]


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
