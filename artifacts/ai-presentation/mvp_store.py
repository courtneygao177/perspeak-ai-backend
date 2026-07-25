"""Persistence helpers for PerspeakAI's closed-beta accounts and practice history."""
import datetime as dt
import json
import os
import sqlite3
import uuid


def _db_path():
    base = os.environ.get("PERSPEAK_DATA_DIR", os.path.join(os.path.dirname(__file__), "uploads"))
    os.makedirs(base, exist_ok=True)
    return os.path.join(base, "perspeak.sqlite3")


def _now():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def _connect():
    conn = sqlite3.connect(_db_path(), timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init_db():
    with _connect() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            is_admin INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            last_login_at TEXT
        );
        CREATE TABLE IF NOT EXISTS practice_sessions (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            deck_file_key TEXT,
            deck_filename TEXT,
            config_json TEXT NOT NULL DEFAULT '{}',
            started_at TEXT NOT NULL,
            ended_at TEXT,
            duration_seconds INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'in_progress',
            report_key TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_practice_user_started
            ON practice_sessions(user_id, started_at DESC);
        CREATE INDEX IF NOT EXISTS idx_practice_report ON practice_sessions(report_key);
        CREATE TABLE IF NOT EXISTS survey_responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            practice_session_id TEXT NOT NULL UNIQUE REFERENCES practice_sessions(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            q1_barrier TEXT NOT NULL,
            q2_segment TEXT NOT NULL,
            q3_referral_check TEXT NOT NULL,
            q4_emails TEXT NOT NULL DEFAULT '',
            submitted_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_survey_user_submitted
            ON survey_responses(user_id, submitted_at DESC);
        """)


def _dict(row):
    return dict(row) if row else None


def get_user(user_id):
    with _connect() as conn:
        return _dict(conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone())


def get_user_by_email(email):
    with _connect() as conn:
        return _dict(conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone())


def create_user(email, password_hash, is_admin=False):
    with _connect() as conn:
        cur = conn.execute(
            "INSERT INTO users(email, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?)",
            (email, password_hash, int(is_admin), _now()),
        )
        return _dict(conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone())


def touch_login(user_id):
    with _connect() as conn:
        conn.execute("UPDATE users SET last_login_at = ? WHERE id = ?", (_now(), user_id))


def create_practice(user_id, file_key, filename, config):
    record_id = str(uuid.uuid4())
    with _connect() as conn:
        conn.execute(
            """INSERT INTO practice_sessions
               (id, user_id, deck_file_key, deck_filename, config_json, started_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (record_id, user_id, file_key, filename, json.dumps(config, ensure_ascii=False), _now()),
        )
    return record_id


def finish_practice(record_id, report_key, duration_seconds):
    with _connect() as conn:
        conn.execute(
            """UPDATE practice_sessions
               SET report_key = ?, duration_seconds = ?, ended_at = ?, status = 'completed'
               WHERE id = ?""",
            (report_key, max(0, int(duration_seconds or 0)), _now(), record_id),
        )


def save_survey(record_id, user_id, answers):
    with _connect() as conn:
        conn.execute(
            """INSERT INTO survey_responses
               (practice_session_id, user_id, q1_barrier, q2_segment,
                q3_referral_check, q4_emails, submitted_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(practice_session_id) DO UPDATE SET
                 q1_barrier = excluded.q1_barrier,
                 q2_segment = excluded.q2_segment,
                 q3_referral_check = excluded.q3_referral_check,
                 q4_emails = excluded.q4_emails,
                 submitted_at = excluded.submitted_at""",
            (
                record_id, user_id,
                answers.get("q1_barrier", ""), answers.get("q2_segment", ""),
                answers.get("q3_referral_check", ""), answers.get("q4_emails", ""), _now(),
            ),
        )


def list_practices_for_user(user_id, limit=100):
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM practice_sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
    return [_dict(row) for row in rows]


def get_practice(record_id):
    with _connect() as conn:
        return _dict(conn.execute("SELECT * FROM practice_sessions WHERE id = ?", (record_id,)).fetchone())


def admin_summary():
    with _connect() as conn:
        stats = _dict(conn.execute("""
            SELECT (SELECT COUNT(*) FROM users) AS users,
                   (SELECT COUNT(*) FROM practice_sessions) AS sessions,
                   (SELECT COUNT(*) FROM practice_sessions WHERE status = 'completed') AS completed,
                   (SELECT COALESCE(SUM(duration_seconds), 0) FROM practice_sessions) AS seconds,
                   (SELECT COUNT(*) FROM survey_responses) AS surveys
        """).fetchone())
        rows = conn.execute("""
            SELECT p.*, u.email
            FROM practice_sessions p JOIN users u ON u.id = p.user_id
            ORDER BY p.started_at DESC LIMIT 200
        """).fetchall()
    return stats, [_dict(row) for row in rows]
