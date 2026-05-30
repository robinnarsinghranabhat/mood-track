# OpenClaw — Reference Architecture

*Not a hackathon partner — used as architectural inspiration for the "always-on agent" concept.*

## What It Is

Self-hosted, open-source (MIT) gateway that bridges chat apps to AI agents. Runs as a single process on your machine, handles messaging across WhatsApp, Telegram, iMessage, Slack, Discord, Signal, etc.

## Key Architecture Ideas (relevant to our project)

- **Single process, many channels**: One gateway manages all connected channels
- **Per-sender sessions**: Each person gets isolated conversation context
- **Persistent memory**: Context maintained across interactions
- **Daemon mode**: Runs as background service, always available
- **Multi-surface access**: Message from phone, desktop, or browser
- **Media support**: Handles images, audio, documents bidirectionally

## Setup

- Node 24 recommended
- Config at `~/.openclaw/openclaw.json`
- Zero-config out of the box
- `openclaw onboard --install-daemon`

## Why Referenced

The user's idea involves an always-on personal agent that can call/be called. OpenClaw provides the "always running, reachable from anywhere" infrastructure pattern — but the actual implementation doesn't need to use OpenClaw specifically.
