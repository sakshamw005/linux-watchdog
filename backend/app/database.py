import sqlite3
from contextlib import contextmanager
from typing import Generator
from app.config import DB_PATH

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    return conn

@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    conn = get_db_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    with get_db() as conn:
        cursor = conn.cursor()
        
        # System metrics table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS system_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                cpu_percent REAL NOT NULL,
                memory_total_bytes INTEGER NOT NULL,
                memory_used_bytes INTEGER NOT NULL,
                memory_available_bytes INTEGER NOT NULL,
                memory_percent REAL NOT NULL,
                disk_total_bytes INTEGER NOT NULL,
                disk_used_bytes INTEGER NOT NULL,
                disk_percent REAL NOT NULL,
                load_1m REAL NOT NULL,
                load_5m REAL NOT NULL,
                load_15m REAL NOT NULL,
                net_rx_bytes INTEGER DEFAULT 0,
                net_tx_bytes INTEGER DEFAULT 0
            );
        """)

        # Process metrics table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS process_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                pid INTEGER NOT NULL,
                process_name TEXT NOT NULL,
                state TEXT NOT NULL,
                ppid INTEGER DEFAULT 0,
                cpu_percent REAL NOT NULL,
                memory_bytes INTEGER NOT NULL,
                vm_size_bytes INTEGER DEFAULT 0,
                memory_percent REAL NOT NULL,
                thread_count INTEGER DEFAULT 1,
                uptime_seconds REAL DEFAULT 0.0,
                cmdline TEXT DEFAULT '',
                is_monitored INTEGER DEFAULT 0
            );
        """)

        # Events table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                pid INTEGER DEFAULT 0,
                process_name TEXT NOT NULL,
                event_type TEXT NOT NULL,
                severity TEXT NOT NULL,
                value REAL DEFAULT 0.0,
                threshold REAL DEFAULT 0.0,
                message TEXT NOT NULL,
                diagnosis TEXT DEFAULT '',
                evidence TEXT DEFAULT ''
            );
        """)

        # Watchdog actions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS watchdog_actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                pid INTEGER DEFAULT 0,
                process_name TEXT NOT NULL,
                action TEXT NOT NULL,
                result TEXT NOT NULL,
                message TEXT DEFAULT ''
            );
        """)

        # Indexes for fast querying
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sys_time ON system_metrics(timestamp DESC);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_proc_time ON process_metrics(timestamp DESC);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_proc_pid ON process_metrics(pid);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_proc_name ON process_metrics(process_name);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_time ON events(timestamp DESC);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_sev ON events(severity);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_actions_time ON watchdog_actions(timestamp DESC);")
