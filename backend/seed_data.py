"""Generate 14 days of realistic demo signal data."""

import random
import uuid
from datetime import datetime, timedelta, timezone

import db


def generate():
    db.init_db()
    conn = db.get_conn()

    # Clear existing seed data
    conn.execute("DELETE FROM signals WHERE source = 'seed'")
    conn.execute("DELETE FROM conversations WHERE id LIKE 'seed_%'")
    conn.commit()

    now = datetime.now(timezone.utc)
    topics_pool = [
        "work", "meetings", "sleep", "exercise", "family", "deadline",
        "food", "commute", "friends", "project", "weekend", "weather",
    ]

    for day_offset in range(14, 0, -1):
        day = now - timedelta(days=day_offset)
        is_weekend = day.weekday() >= 5

        # Weekend = better mood, less stress
        base_mood = random.uniform(5.5, 8.0) if is_weekend else random.uniform(3.5, 7.0)
        base_energy = random.uniform(5.0, 7.5) if is_weekend else random.uniform(3.0, 6.5)
        base_stress = random.uniform(1.5, 4.0) if is_weekend else random.uniform(4.0, 8.0)
        base_anxiety = max(1, base_stress - random.uniform(0.5, 2.0))
        base_sleep = random.uniform(4.0, 8.0)

        conv_id = f"seed_{uuid.uuid4().hex[:8]}"
        day_str = day.strftime("%Y-%m-%dT%H:%M:%S")

        conn.execute(
            "INSERT INTO conversations (id, created_at, summary) VALUES (?, ?, ?)",
            (conv_id, day_str, f"Check-in on {day.strftime('%A %b %d')}"),
        )

        topics = random.sample(topics_pool, k=random.randint(2, 4))
        summary = f"User discussed {', '.join(topics)}."

        signal_data = [
            ("mood", round(base_mood, 1)),
            ("energy", round(base_energy, 1)),
            ("stress", round(base_stress, 1)),
            ("anxiety", round(base_anxiety, 1)),
            ("sleep_quality", round(base_sleep, 1)),
        ]

        for signal_type, value in signal_data:
            sig_id = f"sig_{uuid.uuid4().hex[:8]}"
            label = _label(signal_type, value)
            conn.execute(
                "INSERT INTO signals (id, conversation_id, timestamp, signal_type, value, label, confidence, context, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (sig_id, conv_id, day_str, signal_type, value, label, 0.85, summary, "seed"),
            )

    conn.commit()
    conn.close()
    print("Seeded 14 days of demo data.")


def _label(signal_type, value):
    if signal_type in ("stress", "anxiety"):
        if value <= 3:
            return "low"
        elif value <= 6:
            return "moderate"
        else:
            return "elevated"
    else:
        if value <= 3:
            return "low"
        elif value <= 6:
            return "moderate"
        else:
            return "good"


if __name__ == "__main__":
    generate()
