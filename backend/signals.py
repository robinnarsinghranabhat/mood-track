import json
import os
from datetime import datetime
from zoneinfo import ZoneInfo

PACIFIC = ZoneInfo("America/Los_Angeles")

import anthropic
from dotenv import load_dotenv

from agent import SIGNAL_EXTRACTION_PROMPT

load_dotenv()

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


def _label_for(signal_type: str, value: float) -> str:
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


def extract_signals(messages: list[dict]) -> dict:
    transcript = "\n".join(f"{m['role'].upper()}: {m['text']}" for m in messages)
    prompt = SIGNAL_EXTRACTION_PROMPT + transcript

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text
    start = raw.find("{")
    end = raw.rfind("}") + 1
    return json.loads(raw[start:end])


def signals_to_rows(conversation_id: str, extracted: dict) -> list[dict]:
    now = datetime.now(PACIFIC).isoformat()
    rows = []
    for signal_type in ("mood", "energy", "stress", "anxiety", "sleep_quality"):
        value = extracted.get(signal_type)
        if value is None:
            continue
        rows.append({
            "conversation_id": conversation_id,
            "timestamp": now,
            "signal_type": signal_type,
            "value": float(value),
            "label": _label_for(signal_type, value),
            "confidence": 0.8,
            "context": extracted.get("summary", ""),
            "source": "conversation",
        })
    return rows
