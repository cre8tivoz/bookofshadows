import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import effective_config, load_config, save_config
from dashboard_core import DashboardStore


def make_db(path: Path):
    con = sqlite3.connect(path)
    con.executescript("""
    CREATE TABLE working_memory (
        id TEXT PRIMARY KEY, content TEXT NOT NULL, source TEXT, timestamp TEXT,
        session_id TEXT DEFAULT 'default', importance REAL DEFAULT 0.5,
        metadata_json TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        recall_count INTEGER DEFAULT 0, last_recalled TIMESTAMP DEFAULT NULL,
        valid_until TIMESTAMP DEFAULT NULL, superseded_by TEXT DEFAULT NULL,
        scope TEXT DEFAULT 'global', author_id TEXT, author_type TEXT, channel_id TEXT
    );
    CREATE TABLE episodic_memory (
        rowid INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT UNIQUE NOT NULL, content TEXT NOT NULL, source TEXT, timestamp TEXT,
        session_id TEXT DEFAULT 'default', importance REAL DEFAULT 0.5,
        metadata_json TEXT, summary_of TEXT DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        recall_count INTEGER DEFAULT 0, last_recalled TIMESTAMP DEFAULT NULL,
        valid_until TIMESTAMP DEFAULT NULL, superseded_by TEXT DEFAULT NULL,
        scope TEXT DEFAULT 'global', author_id TEXT, author_type TEXT, channel_id TEXT
    );
    CREATE TABLE triples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject TEXT NOT NULL, predicate TEXT NOT NULL, object TEXT NOT NULL,
        valid_from TEXT NOT NULL, valid_until TEXT, source TEXT, confidence REAL DEFAULT 1.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE consolidation_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, items_consolidated INTEGER,
        summary_preview TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    con.execute("INSERT INTO working_memory(id,content,source,timestamp,session_id,importance,scope) VALUES (?,?,?,?,?,?,?)",
                ('w1','YC prefers local-only WhatsApp memory','preference','2026-01-01T00:00:00','s1',0.9,'global'))
    con.execute("INSERT INTO episodic_memory(id,content,source,timestamp,session_id,importance,scope,summary_of) VALUES (?,?,?,?,?,?,?,?)",
                ('e1','Built a Mnemosyne dashboard visualiser','task','2026-01-02T00:00:00','s2',0.6,'session','w1'))
    con.execute("INSERT INTO triples(subject,predicate,object,valid_from,source,confidence) VALUES (?,?,?,?,?,?)",
                ('YC','prefers','local-only memory','2026-01-01','preference',0.95))
    con.execute("INSERT INTO consolidation_log(session_id,items_consolidated,summary_preview) VALUES (?,?,?)",
                ('s2',3,'Dashboard work'))
    con.commit()
    con.close()


def test_stats_counts_memory_tables(tmp_path):
    db = tmp_path / 'mnemosyne.db'
    make_db(db)
    stats = DashboardStore(db).stats()
    assert stats['counts']['working_memory'] == 1
    assert stats['counts']['episodic_memory'] == 1
    assert stats['counts']['triples'] == 1
    assert stats['counts']['consolidation_log'] == 1


def test_list_memories_searches_both_tiers(tmp_path):
    db = tmp_path / 'mnemosyne.db'
    make_db(db)
    rows = DashboardStore(db).list_memories(kind='all', q='dashboard', limit=10)
    assert [r['id'] for r in rows] == ['e1']
    assert rows[0]['tier'] == 'episodic'


def test_list_memories_filters_and_sorts_by_importance(tmp_path):
    db = tmp_path / 'mnemosyne.db'
    make_db(db)
    rows = DashboardStore(db).list_memories(kind='all', scope='global', sort='importance', limit=10)
    assert [r['id'] for r in rows] == ['w1']
    assert rows[0]['importance'] == 0.9


def test_graph_returns_nodes_edges_and_filterable_metadata(tmp_path):
    db = tmp_path / 'mnemosyne.db'
    make_db(db)
    graph = DashboardStore(db).graph(q='local-only', limit=10)
    labels = {n['label'] for n in graph['nodes']}
    assert {'YC', 'local-only memory'} <= labels
    assert graph['edges'][0]['predicate'] == 'prefers'
    assert graph['edges'][0]['subject'] == 'YC'
    assert graph['edges'][0]['object'] == 'local-only memory'


def test_config_file_env_and_runtime_overrides(tmp_path, monkeypatch):
    monkeypatch.setenv('HERMES_HOME', str(tmp_path / 'hermes'))
    monkeypatch.delenv('MNEMOSYNE_DASHBOARD_CONFIG', raising=False)
    cfg = load_config(create=True)
    assert cfg.host == '127.0.0.1'
    assert cfg.port == 8765
    assert Path(tmp_path / 'hermes' / 'plugin-data' / 'mnemosyne-dashboard' / 'config.json').exists()

    cfg = save_config(host='0.0.0.0', port=9876, db_path=str(tmp_path / 'test.db'))
    assert cfg.host == '0.0.0.0'
    assert cfg.port == 9876
    assert cfg.local_url == 'http://127.0.0.1:9876/'

    monkeypatch.setenv('MNEMOSYNE_DASHBOARD_PORT', '9999')
    assert load_config().port == 9999
    assert effective_config({'port': 7777}).port == 7777


def test_config_validates_port(tmp_path, monkeypatch):
    monkeypatch.setenv('HERMES_HOME', str(tmp_path / 'hermes'))
    save_config(port=8765)
    try:
        save_config(port=70000)
    except ValueError as exc:
        assert 'between 1 and 65535' in str(exc)
    else:
        raise AssertionError('invalid port should fail')
