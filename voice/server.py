"""Local, offline speech-to-text service for SATQUERY AI.

The selected Whisper model is downloaded once into /models, then all audio
transcription runs locally in this container without a browser speech service.
"""

import os
import tempfile
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, UploadFile
from faster_whisper import WhisperModel

model: WhisperModel | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global model
    model = WhisperModel(
        os.getenv("WHISPER_MODEL", "base.en"),
        device="cpu",
        compute_type=os.getenv("WHISPER_COMPUTE_TYPE", "int8"),
        download_root=os.getenv("WHISPER_MODEL_DIR", "/models"),
    )
    yield
    model = None


app = FastAPI(title="SATQUERY Offline Voice", lifespan=lifespan)


@app.get("/health")
def health():
    return {"ready": model is not None, "engine": "faster-whisper"}


@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    if model is None:
        raise HTTPException(status_code=503, detail="Offline speech model is still loading.")
    raw_audio = await audio.read()
    if not raw_audio:
        raise HTTPException(status_code=400, detail="No audio was received.")
    if len(raw_audio) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Voice recordings must be 8 MB or smaller.")

    suffix = os.path.splitext(audio.filename or "voice.webm")[1] or ".webm"
    file_path = ""
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
            temp_file.write(raw_audio)
            file_path = temp_file.name
        segments, _ = model.transcribe(file_path, beam_size=1, vad_filter=True)
        transcript = " ".join(segment.text.strip() for segment in segments).strip()
        if not transcript:
            raise HTTPException(status_code=422, detail="No speech was detected. Please try again.")
        return {"transcript": transcript}
    finally:
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
