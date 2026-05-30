import os
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

PACIFIC = ZoneInfo("America/Los_Angeles")

import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import speech
from pydantic import BaseModel

import db
from agent import CHECKIN_SYSTEM_PROMPT
from signals import extract_signals, signals_to_rows
from voice_biomarkers import extract_voice_biomarkers, biomarkers_to_rows

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

claude = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

AUDIO_DIR = Path("data/audio")


@app.on_event("startup")
def startup():
    db.init_db()
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)


# --- Request models ---

class MessageRequest(BaseModel):
    role: str
    text: str


class ChatRequest(BaseModel):
    conversation_id: str
    messages: list[dict]


# --- Conversations ---

@app.post("/conversations")
def create_conversation():
    return db.create_conversation()


@app.get("/conversations")
def list_conversations(limit: int = 20):
    return db.list_conversations(limit)


@app.post("/conversations/{conv_id}/messages")
def save_message(conv_id: str, req: MessageRequest):
    return db.add_message(conv_id, req.role, req.text)


@app.get("/conversations/{conv_id}/messages")
def get_messages(conv_id: str):
    return db.get_messages(conv_id)


@app.post("/conversations/{conv_id}/end")
def end_conversation(conv_id: str):
    messages = db.get_messages(conv_id)
    if not messages:
        return {"signals": {}}

    extracted = extract_signals(messages)
    rows = signals_to_rows(conv_id, extracted)
    db.save_signals(conv_id, rows)
    db.update_conversation_summary(conv_id, extracted.get("summary", ""), extracted)
    return {"signals": extracted}


# --- Audio ---

@app.post("/conversations/{conv_id}/audio")
async def upload_audio(conv_id: str, file: UploadFile = File(...)):
    conv_dir = AUDIO_DIR / conv_id
    conv_dir.mkdir(parents=True, exist_ok=True)
    file_path = conv_dir / file.filename
    content = await file.read()
    file_path.write_bytes(content)
    return {"path": str(file_path)}


@app.post("/conversations/{conv_id}/analyze-audio")
async def analyze_audio(conv_id: str):
    conv_dir = AUDIO_DIR / conv_id
    if not conv_dir.exists():
        return {"biomarkers": None, "error": "No audio files found"}

    audio_files = sorted(conv_dir.glob("*.webm"))
    if not audio_files:
        return {"biomarkers": None, "error": "No audio files found"}

    combined = b""
    for f in audio_files:
        combined += f.read_bytes()

    timestamp = datetime.now(PACIFIC).isoformat()
    biomarkers = extract_voice_biomarkers(combined)
    if biomarkers:
        rows = biomarkers_to_rows(conv_id, biomarkers, timestamp)
        db.save_signals(conv_id, rows)

    return {"biomarkers": biomarkers}


# --- Transcribe ---

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    content = await file.read()
    client = speech.SpeechClient()
    audio = speech.RecognitionAudio(content=content)
    config = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,
        sample_rate_hertz=48000,
        language_code="en-US",
        enable_automatic_punctuation=True,
    )
    response = client.recognize(config=config, audio=audio)
    transcript = " ".join(r.alternatives[0].transcript for r in response.results)
    return {"transcript": transcript}


# --- Chat (LLM proxy) ---

@app.post("/chat")
def chat(req: ChatRequest):
    claude_messages = [{"role": m["role"], "content": m["text"]} for m in req.messages]

    response = claude.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        system=CHECKIN_SYSTEM_PROMPT,
        messages=claude_messages,
    )

    assistant_text = response.content[0].text

    db.ensure_conversation(req.conversation_id)
    db.add_message(req.conversation_id, "user", req.messages[-1]["text"])
    db.add_message(req.conversation_id, "assistant", assistant_text)

    return {"response": assistant_text}


# --- Per-conversation signals (for dashboard) ---

@app.get("/conversations/{conv_id}/signals")
def get_conversation_signals(conv_id: str):
    data = db.get_conversation_signals(conv_id)
    if not data:
        return {"error": "No signals found for this conversation"}
    return data


# --- Signals & Dashboard ---

@app.get("/signals")
def get_signals(start: str | None = None, end: str | None = None):
    return db.get_signals(start, end)


@app.get("/signals/summary")
def get_signals_summary(period: str = "daily"):
    return db.get_signals_summary(period)
