import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import default_db_path, effective_config, load_config, public_config, save_config
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
    con.execute("INSERT INTO working_memory(id,content,source,timestamp,session_id,importance,scope) VALUES (?,?,?,?,?,?,?)",
                ('w2','YC uses Obsidian for notes','preference','2026-01-03T00:00:00','s3',0.4,'global'))
    con.execute("INSERT INTO working_memory(id,content,source,timestamp,session_id,importance,scope) VALUES (?,?,?,?,?,?,?)",
                ('w3','YC knows Diana from school','preference','2026-01-04T00:00:00','s4',0.4,'global'))
    con.execute("INSERT INTO triples(subject,predicate,object,valid_from,source,confidence) VALUES (?,?,?,?,?,?)",
                ('YC','prefers','local-only memory','2026-01-01','preference',0.95))
    con.execute("INSERT INTO triples(subject,predicate,object,valid_from,source,confidence) VALUES (?,?,?,?,?,?)",
                ('YC','uses','Obsidian','2026-01-01','preference',0.95))
    con.execute("INSERT INTO triples(subject,predicate,object,valid_from,source,confidence) VALUES (?,?,?,?,?,?)",
                ('YC','knows','Diana','2026-01-01','preference',0.95))
    con.execute("INSERT INTO consolidation_log(session_id,items_consolidated,summary_preview) VALUES (?,?,?)",
                ('s2',3,'Dashboard work'))
    con.commit()
    con.close()


def test_stats_counts_memory_tables(tmp_path):
    db = tmp_path / 'mnemosyne.db'
    make_db(db)
    stats = DashboardStore(db).stats()
    assert stats['counts']['working_memory'] == 3
    assert stats['counts']['episodic_memory'] == 1
    assert stats['counts']['triples'] == 3
    assert stats['counts']['consolidation_log'] == 1


def test_list_memories_searches_both_tiers(tmp_path):
    db = tmp_path / 'mnemosyne.db'
    make_db(db)
    rows = DashboardStore(db).list_memories(kind='all', q='dashboard', limit=10)
    assert [r['id'] for r in rows] == ['e1']
    assert rows[0]['tier'] == 'episodic'


def test_search_uses_token_prefix_not_mid_word_substring(tmp_path):
    db = tmp_path / 'mnemosyne.db'
    make_db(db)
    store = DashboardStore(db)

    memory_rows = store.list_memories(kind='all', q='Dian', limit=10)
    assert [r['id'] for r in memory_rows] == ['w3']

    triple_rows = store.triples(q='Dian', limit=10)
    assert [r['object'] for r in triple_rows] == ['Diana']

    search = store.global_search(q='Dian', limit=10)
    assert [r['id'] for r in search['memories']] == ['w3']
    assert [r['object'] for r in search['triples']] == ['Diana']


def test_list_memories_filters_and_sorts_by_importance(tmp_path):
    db = tmp_path / 'mnemosyne.db'
    make_db(db)
    rows = DashboardStore(db).list_memories(kind='all', scope='global', session_id='s1', sort='importance', limit=10)
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


def test_diagnostics_reports_database_health(tmp_path):
    db = tmp_path / 'mnemosyne.db'
    make_db(db)
    diag = DashboardStore(db).diagnostics()
    assert diag['ok'] is True
    assert diag['exists'] is True
    assert diag['read_only'] is True
    assert diag['table_counts']['working_memory'] == 3
    assert diag['table_counts']['triples'] == 3


def test_session_detail_unifies_related_items(tmp_path):
    db = tmp_path / 'mnemosyne.db'
    make_db(db)
    detail = DashboardStore(db).session_detail('s2')
    assert detail['session_id'] == 's2'
    assert detail['counts']['memories'] == 1
    assert detail['counts']['consolidations'] == 1
    assert {e['type'] for e in detail['events']} == {'memory', 'consolidation'}


def test_memory_status_filter_and_safe_mutations(tmp_path, monkeypatch):
    monkeypatch.setenv('HERMES_HOME', str(tmp_path / 'hermes'))
    db = tmp_path / 'mnemosyne.db'
    make_db(db)
    store = DashboardStore(db)

    assert [r['id'] for r in store.list_memories(kind='all', status='active', limit=10)] == ['w3', 'w2', 'e1', 'w1']

    expired = store.invalidate_memory('w2')
    assert expired['ok'] is True
    assert expired['item']['status'] == 'expired'
    assert [r['id'] for r in store.list_memories(kind='all', status='expired', limit=10)] == ['w2']

    updated = store.set_memory_importance('w1', 0.33)
    assert updated['item']['importance'] == 0.33

    superseded = store.supersede_memory('w1', 'YC prefers local-only private memory', importance=0.95)
    assert superseded['item']['status'] == 'superseded'
    assert superseded['replacement']['content'] == 'YC prefers local-only private memory'
    assert superseded['replacement']['status'] == 'active'
    assert superseded['replacement_id'] in {r['id'] for r in store.list_memories(kind='working', status='active', limit=20)}

    audit = store.audit_log()
    assert [row['action'] for row in audit[:3]] == ['supersede', 'importance', 'invalidate']
    assert Path(superseded['backup']['path']).exists()


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


def test_default_db_path_detects_existing_mnemosyne_database(tmp_path, monkeypatch):
    monkeypatch.setenv('HERMES_HOME', str(tmp_path / 'hermes'))
    db = tmp_path / 'hermes' / 'mnemosyne' / 'data' / 'mnemosyne.db'
    db.parent.mkdir(parents=True)
    db.write_text('sqlite placeholder')
    assert default_db_path() == db
    assert load_config(create=True).db_path == str(db)


def test_public_config_reports_lan_url_for_wildcard_bind(tmp_path, monkeypatch):
    monkeypatch.setenv('HERMES_HOME', str(tmp_path / 'hermes'))
    monkeypatch.setattr('config.lan_host', lambda: '192.168.1.160')
    cfg = save_config(host='0.0.0.0', port=8765)
    assert public_config(cfg)['local_url'] == 'http://127.0.0.1:8765/'
    assert public_config(cfg)['lan_url'] == 'http://192.168.1.160:8765/'


def test_config_validates_port(tmp_path, monkeypatch):
    monkeypatch.setenv('HERMES_HOME', str(tmp_path / 'hermes'))
    save_config(port=8765)
    try:
        save_config(port=70000)
    except ValueError as exc:
        assert 'between 1 and 65535' in str(exc)
    else:
        raise AssertionError('invalid port should fail')


def test_admin_mode_requires_password_auth(tmp_path, monkeypatch):
    monkeypatch.setenv('HERMES_HOME', str(tmp_path / 'hermes'))
    save_config(auth_enabled=False, clear_password=True)
    try:
        save_config(memory_admin_enabled=True)
    except ValueError as exc:
        assert 'password auth' in str(exc)
    else:
        raise AssertionError('admin mode should require password auth')

    cfg = save_config(password='secret', auth_enabled=True, memory_admin_enabled=True)
    assert public_config(cfg)['memory_admin_enabled'] is True
