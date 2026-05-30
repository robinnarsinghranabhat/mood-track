## Ideal world : 
Call agent through a phone


## For hackathon

## Minimal POC
A Web Application
Allows a voice interface button
We have a Agent that’s prompted just listen to us. Not a therapist ! 
Background  processing from another system.

Divide task between two people.



### After each conversation, what kind of background processing should we do ? 
INPUT :
 Metadata (date and time)
Text conversation data (for now)
OUTPUT : 
Unstructured Data : Natural language Summary of User State 
Structured Signal Extract  ?? Brain storm


### Have background processing things :
Daily
Weekly
Monthly 

once we have the per convo data, these things could be done in background processing layer.


## How exactly could system look like ? 
System 1 (UI )
Will write raw Voice data as well.
Will write raw conversation to some database 
TABLE raw_convo ( date, time, raw text convo ) 

Where to write the raw voice data though ? 

System 2 ( background processor )
Will read from TABLE raw_convo
Generate Summaries And write back to : 
TABLE summary ( date, time, summary, mood states from ?? ) 

## API Contract (Frontend ↔ Backend)

### WebSocket — Real-time conversation
### REST Endpoints

```
# --- Conversations ---

# Start a new conversation
POST /conversations
→ { "id": "conv_abc123", "created_at": "2026-05-30T14:00:00" }

# Save a message (frontend calls this for BOTH user and assistant messages)
POST /conversations/{id}/messages
Body: { "role": "user", "text": "I'm feeling kind of drained today" }
→ { "id": "msg_001", "role": "user", "text": "...", "created_at": "2026-05-30T14:00:00" }

Body: { "role": "assistant", "text": "That sounds tough. Tell me more..." }
→ { "id": "msg_002", "role": "assistant", "text": "...", "created_at": "2026-05-30T14:00:12" }

# Get conversation history (for reload / building Claude context)
GET /conversations/{id}/messages
→ [ { "id": "msg_001", "role": "user", "text": "...", "created_at": "..." }, ... ]

# End conversation + trigger signal extraction
POST /conversations/{id}/end
→ { "signals": { mood: 3, energy: 4, stress: 7, ... }, "summary": "..." }

# List past conversations
GET /conversations?limit=20
→ [ { "id": "conv_abc123", "created_at": "...", "summary": "..." }, ... ]

# --- Audio ---

# Upload audio chunk (one per voice input within a session)
POST /conversations/{id}/audio
Body: multipart/form-data (file + optional message_id field to link to a message)
→ { "path": "data/audio/conv_abc123/chunk_001.webm" }

# --- Signals & Dashboard ---

# Get signals for dashboard
GET /signals?start=2026-05-23&end=2026-05-30&type=mood,energy,stress
→ [ { "timestamp": "...", "signal_type": "mood", "value": 3, "label": "low", "context": "..." }, ... ]

# Get aggregated summary (for dashboard cards)
GET /signals/summary?period=daily
→ { "avg_mood": 5.2, "avg_energy": 4.8, "top_topics": ["work","sleep"], "trend": "improving" }

# --- LLM Proxy (so API key stays on server) ---

# Frontend sends user message, backend calls Claude, returns response
POST /chat
Body: { "conversation_id": "conv_abc123", "text": "I'm feeling drained" }
→ { "response": "That sounds tough. Tell me more about what's draining you." }
# Backend also auto-saves both messages to the DB, so frontend
# doesn't need to call POST /messages separately when using this endpoint.
# Use this OR call Claude directly from frontend + POST /messages yourself.
```

### Flow: How frontend uses these

```
Option A (backend ready — use /chat proxy):
  User input → POST /chat → get response → display + TTS
  Audio → POST /audio (fire and forget)
  End → POST /end → get signals → show dashboard

Option B (backend NOT ready — call Claude directly):
  User input → POST /messages (save) → call Claude API from frontend → POST /messages (save response) → display + TTS
  Audio → POST /audio (fire and forget)
  End → POST /end → get signals → show dashboard
```

Frontend can start with Option B today and switch to Option A when backend is ready. The database ends up the same either way.

### Signal Shape (what extraction returns)
```json
{
  "mood": 3,
  "energy": 4,
  "stress": 7,
  "anxiety": 6,
  "sleep_quality": 5,
  "topics": ["work", "deadline", "food"],
  "concerns": ["Friday deadline"],
  "summary": "User feels drained from back-to-back meetings, skipped lunch, stressed about Friday deadline."
}
```

---

## How to collaborate

**VS Code Live Share** — fastest option, zero setup:
1. One person (backend) installs Live Share extension, clicks "Share", sends link
2. Other person (frontend) clicks link, edits the same codebase live
3. Backend person runs the server — frontend person sees the terminal
4. Both can edit any file, but stay in your lane to avoid conflicts

**Git workflow (parallel to Live Share):**
- Same repo, same branch is fine for a hackathon
- Commit often with short messages
- If you get conflicts: just talk to each other, you're in the same room

**Folder ownership to avoid stepping on each other:**
```
Person A (Frontend):        Person B (Backend):
  static/index.html           server.py
  static/style.css            agent.py
  static/app.js               signals.py
  static/chat.js              db.py
  static/dashboard.js         seed_data.py
```

**First 15 minutes together:**
1. `pip install fastapi uvicorn anthropic` + create `.env` with API key
2. Person B: stub out all endpoints returning hardcoded JSON
3. Person A: start building UI hitting those stubs
4. Both work independently from there, meet at checkpoints

---

## How to divide work and what to work on

### Person A — Frontend (UI + Voice)
| Hour | Task |
|------|------|
| 1 | Chat UI — message bubbles, input box, send button |
| 2 | WebSocket connection to backend, streaming responses |
| 3 | Voice I/O — WebSpeech API for mic input, SpeechSynthesis for output, MediaRecorder to save audio |
| 4 | Dashboard — Plotly.js charts for mood/energy/stress over time |
| 5 | Summary cards + polish |

### Person B — Backend (Agent + Data)
| Hour | Task |
|------|------|
| 1 | FastAPI app, SQLite schema (conversations + signals tables), stub all endpoints |
| 2 | WebSocket chat — wire up Claude as the listening agent, streaming |
| 3 | Signal extraction — Claude structured output after conversation ends |
| 4 | REST endpoints — signals query, summary aggregation |
| 5 | Seed data + background processing (daily/weekly summaries) |

### Together (Hours 6-8)
| Hour | Task |
|------|------|
| 6 | Integration — connect real endpoints, fix bugs |
| 7 | End-to-end test — full conversation → signals → dashboard |
| 8 | Demo prep — seed data, rehearse pitch |
