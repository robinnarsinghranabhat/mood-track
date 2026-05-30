# MoodTrack Frontend

Vanilla HTML/CSS/JS frontend for MoodTrack — chat interface with voice I/O and a dashboard.

## Commands

```bash
# Serve frontend
python3 -m http.server 3000
```

Then open http://localhost:3000 in Chrome.

## Requires

- Backend running on `http://localhost:8000` (see `../backend/CLAUDE.md`)
- Falls back to mock responses if backend is offline

## Architecture

- **index.html** — Single page with two tabs: Check-in (chat) and Dashboard
- **app.js** — App shell, API layer, conversation state. Calls backend `/chat` for Claude responses, falls back to mock if backend is down. All backend communication goes through the `api` object.
- **chat.js** — Chat UI: message bubbles, text input, send button, typing indicator
- **voice.js** — Voice I/O: WebSpeech API for speech-to-text, SpeechSynthesis for TTS, MediaRecorder for capturing audio blobs
- **dashboard.js** — Plotly.js charts: mood/energy/stress timelines, summary cards, topic tags
- **style.css** — Pico CSS (CDN) + custom styling

## How It Works

1. On load, creates a conversation via `POST /conversations`
2. User types or speaks → message sent to backend `POST /chat` (which calls Claude + saves both messages)
3. Agent response displayed as chat bubble + spoken via TTS
4. "End Check-in" calls `POST /conversations/{id}/end` → backend extracts signals → displayed in chat
5. Dashboard tab fetches signals from `GET /signals` and renders Plotly charts

## Key Config

In `app.js`:
- `BACKEND_URL` — where the backend lives (default: `http://localhost:8000`)
- `backendUp` — auto-detected on load, controls mock fallback

## Browser Requirements

- Chrome recommended (WebSpeech API for voice input)
- Voice input won't work in Firefox/Safari
- Everything else works cross-browser
