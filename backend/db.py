import json
import sqlite3
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

PACIFIC = ZoneInfo("America/Los_Angeles")

DB_PATH = "moodtrack.db"


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL,
            summary TEXT,
            extracted_data TEXT
        );

        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL,
            text TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id)
        );

        CREATE TABLE IF NOT EXISTS signals (
            id TEXT PRIMARY KEY,
            conversation_id TEXT,
            timestamp TEXT NOT NULL,
            signal_type TEXT NOT NULL,
            value REAL NOT NULL,
            label TEXT,
            confidence REAL,
            context TEXT,
            source TEXT DEFAULT 'conversation',
            FOREIGN KEY (conversation_id) REFERENCES conversations(id)
        );
    """)
    conn.close()


def create_conversation():
    conn = get_conn()
    conv_id = f"conv_{uuid.uuid4().hex[:8]}"
    now = datetime.now(PACIFIC).isoformat()
    conn.execute("INSERT INTO conversations (id, created_at) VALUES (?, ?)", (conv_id, now))
    conn.commit()
    conn.close()
    return {"id": conv_id, "created_at": now}


def ensure_conversation(conv_id: str):
    conn = get_conn()
    existing = conn.execute("SELECT id FROM conversations WHERE id = ?", (conv_id,)).fetchone()
    if not existing:
        now = datetime.now(PACIFIC).isoformat()
        conn.execute("INSERT INTO conversations (id, created_at) VALUES (?, ?)", (conv_id, now))
        conn.commit()
    conn.close()


def add_message(conversation_id: str, role: str, text: str):
    conn = get_conn()
    msg_id = f"msg_{uuid.uuid4().hex[:8]}"
    now = datetime.now(PACIFIC).isoformat()
    conn.execute(
        "INSERT INTO messages (id, conversation_id, role, text, created_at) VALUES (?, ?, ?, ?, ?)",
        (msg_id, conversation_id, role, text, now),
    )
    conn.commit()
    conn.close()
    return {"id": msg_id, "role": role, "text": text, "created_at": now}


def get_messages(conversation_id: str):
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, role, text, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at",
        (conversation_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def list_conversations(limit: int = 20):
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, created_at, summary FROM conversations ORDER BY created_at DESC LIMIT ?",
        (limit,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def update_conversation_summary(conversation_id: str, summary: str, extracted_data: dict | None = None):
    conn = get_conn()
    conn.execute(
        "UPDATE conversations SET summary = ?, extracted_data = ? WHERE id = ?",
        (summary, json.dumps(extracted_data) if extracted_data else None, conversation_id),
    )
    conn.commit()
    conn.close()


def get_conversation_signals(conversation_id: str):
    conn = get_conn()
    row = conn.execute(
        "SELECT extracted_data, created_at FROM conversations WHERE id = ?",
        (conversation_id,),
    ).fetchone()
    conn.close()
    if not row or not row["extracted_data"]:
        return None
    data = json.loads(row["extracted_data"])
    data["conversation_id"] = conversation_id
    data["created_at"] = row["created_at"]
    return data


def save_signals(conversation_id: str, signals: list[dict]):
    conn = get_conn()
    for s in signals:
        sig_id = f"sig_{uuid.uuid4().hex[:8]}"
        conn.execute(
            "INSERT INTO signals (id, conversation_id, timestamp, signal_type, value, label, confidence, context, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (sig_id, conversation_id, s["timestamp"], s["signal_type"], s["value"],
             s.get("label"), s.get("confidence"), s.get("context"), s.get("source", "conversation")),
        )
    conn.commit()
    conn.close()


def get_signals(start: str | None = None, end: str | None = None, types: list[str] | None = None):
    conn = get_conn()
    query = "SELECT timestamp, signal_type, value, label, context FROM signals WHERE 1=1"
    params = []
    if start:
        query += " AND timestamp >= ?"
        params.append(start)
    if end:
        query += " AND timestamp <= ?"
        params.append(end)
    if types:
        placeholders = ",".join("?" for _ in types)
        query += f" AND signal_type IN ({placeholders})"
        params.extend(types)
    query += " ORDER BY timestamp"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_signals_summary(period: str = "daily"):
    conn = get_conn()
    rows = conn.execute(
        "SELECT signal_type, AVG(value) as avg_value FROM signals GROUP BY signal_type"
    ).fetchall()
    summary = {}
    for r in rows:
        summary[f"avg_{r['signal_type']}"] = round(r["avg_value"], 1)

    topics_rows = conn.execute(
        "SELECT context FROM signals WHERE signal_type = 'mood' ORDER BY timestamp DESC LIMIT 10"
    ).fetchall()
    conn.close()

    summary["top_topics"] = []
    for r in topics_rows:
        if r["context"]:
            summary["top_topics"].append(r["context"])

    return summary
