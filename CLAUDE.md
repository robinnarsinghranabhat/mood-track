# MoodTrack

## What is this?

A conversational mood-tracking agent that calls you (or you call it), has a natural voice conversation about how you're feeling, silently extracts emotional/wellness signals from the conversation, detects patterns over time, and pushes insights to you only when they matter. No forms, no sliders, no active effort from the user.

## Core Philosophy

- **The check-in IS the measurement.** The user just talks naturally. Signal extraction happens behind the scenes.
- **Push, not pull.** Users are lazy. They won't open a dashboard daily. The system should push notifications when it detects something worth knowing. The dashboard exists for when they actively want to dig in.
- **Valuable from conversation one.** Even a single check-in should produce something useful — a reflection, a snapshot, a data point.
- **Extensible signal sources.** Today: conversation content analysis. Future: Vibes AI voice biomarkers, AWEAR EEG, Apple Health, Fitbit, etc. All produce the same `Signal` shape.

## Origin

Built at the Biofeedback Hack @ MIT (May 30, 2026) — a Mindful Makers hackathon with Vibes AI and AWEAR as partners. Solo project.

## Tech Stack

- **Voice conversation:** Deepgram Voice Agent API (handles STT → LLM → TTS pipeline)
- **Backend:** FastAPI (Python)
- **LLM:** Claude API (signal extraction, insight detection)
- **Database:** SQLite
- **Frontend:** Vanilla HTML/CSS/JS, Plotly.js for charts
- **Notifications:** TBD (push notifications for insights)

## Key Concepts

- **Signal** — A normalized data point (mood, energy, stress, etc.) extracted from any source. See `docs/plan.md` for the schema.
- **Signal Provider** — Pluggable interface for data sources (conversation analysis, Vibes AI, AWEAR, etc.)
- **Insight** — A pattern or observation detected across accumulated signals. Can be programmatic (rules we define) or agentic (LLM-discovered).
- **Check-in** — A voice conversation between user and agent. Primary data collection method.

## Project Structure

```
mood-track/
├── CLAUDE.md              # You are here
├── docs/
│   └── plan.md            # Architecture, design, and build plan
├── research/              # Hackathon research, source analysis, Deepgram config
├── server.py              # FastAPI app
├── agent.py               # Conversation + insights agent prompts
├── signals.py             # Signal model, extraction, provider interface
├── db.py                  # SQLite
├── static/                # Frontend
└── seed_data.py           # Demo data generation
```

## Commands

```bash
# Run the server
uvicorn server:app --reload

# Seed demo data
python seed_data.py
```
