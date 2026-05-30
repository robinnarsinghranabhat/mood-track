# MoodTrack Backend

FastAPI backend for MoodTrack — handles conversations, signal extraction, and dashboard data.

## Commands

```bash
# Activate venv
source .venv/bin/activate

# Run the server
uvicorn server:app --reload

# Seed 14 days of demo data
python seed_data.py
```

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Requires `.env` with:
```
ANTHROPIC_API_KEY=sk-ant-...
```

## Architecture

- **server.py** — FastAPI app, all REST endpoints, CORS middleware
- **db.py** — SQLite schema (conversations, messages, signals tables), query helpers
- **agent.py** — Claude system prompts (check-in persona, signal extraction)
- **signals.py** — Calls Claude to extract mood/energy/stress/anxiety/sleep from conversation transcripts
- **seed_data.py** — Generates realistic demo data with weekday/weekend patterns

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/conversations` | POST | Start new conversation |
| `/conversations` | GET | List past conversations |
| `/conversations/{id}/messages` | POST | Save a message (user or assistant) |
| `/conversations/{id}/messages` | GET | Get conversation history |
| `/conversations/{id}/end` | POST | End convo + extract signals via Claude |
| `/conversations/{id}/audio` | POST | Upload audio file (multipart) |
| `/chat` | POST | LLM proxy — send messages, get Claude response |
| `/signals` | GET | Query signals (optional: start, end params) |
| `/signals/summary` | GET | Aggregated signal averages |

## Database

SQLite file: `moodtrack.db` (auto-created on first run)

Three tables: `conversations`, `messages`, `signals`
