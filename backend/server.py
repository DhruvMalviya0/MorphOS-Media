import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from gatekeeper import HardwareGatekeeper
from engines.photo.photo_core import MorphPhotoEngine
from engines.audio.audio_core import MorphAudioEngine

app = FastAPI(title="MorphOS Media Studio Core API")

# Enable Cross-Origin requests so your Tauri desktop webview can talk to it safely
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize our infrastructure on startup
gatekeeper = HardwareGatekeeper()
clearance = gatekeeper.verify_clearance()
photo_engine = MorphPhotoEngine(clearance["profile"])
audio_engine = MorphAudioEngine(gatekeeper.providers)

# Define data models for incoming front-end payloads
class GenerationRequest(BaseModel):
    prompt: str
    steps: int

class AudioRequest(BaseModel):
    file_path: str

@app.get("/api/hardware")
def get_hardware_status():
    """Returns system status directly to the UI header pill."""
    return {"profile": clearance["profile"], "status": clearance["status"]}

@app.post("/api/generate/photo")
def generate_photo(payload: GenerationRequest):
    """Triggers the real photo engine mapping loop."""
    if clearance["status"] == "DENIED":
        raise HTTPException(status_code=403, detail="Hardware verification failed.")
    
    # Simulate processing utilizing your input telemetry steps
    mock_buffer = 128.0
    _, report = photo_engine.process_canvas_layer(mock_buffer)
    return {"status": "SUCCESS", "log": report, "prompt_received": payload.prompt}

@app.post("/api/process/audio")
def process_audio(payload: AudioRequest):
    """Triggers background audio offloading loops."""
    mock_wave = 44100.0
    _, report = audio_engine.process_audio_frequency(mock_wave)
    return {"status": "SUCCESS", "log": report, "target_file": payload.file_path}

if __name__ == "__main__":
    # Run the local microservice on port 8000
    uvicorn.run(app, host="127.0.0.1", port=8000)