import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
import os

from gatekeeper import HardwareGatekeeper
from engines.photo.photo_core import MorphPhotoEngine
from engines.audio.audio_core import MorphAudioEngine

app = FastAPI(title="MorphOS Media Studio Universal Core API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

base_dir = os.path.dirname(os.path.dirname(__file__))
public_output_dir = os.path.join(base_dir, "ui-shell", "public", "generated_outputs")
os.makedirs(public_output_dir, exist_ok=True)
app.mount("/static/outputs", StaticFiles(directory=public_output_dir), name="static_outputs")

gatekeeper = HardwareGatekeeper()
clearance = gatekeeper.verify_clearance()
photo_engine = MorphPhotoEngine(clearance["profile"])
audio_engine = MorphAudioEngine(gatekeeper.providers)

class ModelSelectRequest(BaseModel):
    model_id: str

class GenerationRequest(BaseModel):
    prompt: str
    steps: int
    base_image_path: Optional[str] = None  # New path field handle
    strength: Optional[float] = 0.5

class AudioRequest(BaseModel):
    file_path: str

@app.get("/api/hardware")
def get_hardware_status():
    """Returns system status directly to the UI header pill."""
    return {"profile": clearance["profile"], "status": clearance["status"]}

@app.get("/api/preflight/check")
def run_preflight_check():
    return gatekeeper.evaluate_model_compatibility()

@app.post("/api/preflight/select")
def select_active_model(payload: ModelSelectRequest):
    global photo_engine
    try:
        photo_engine = MorphPhotoEngine(payload.model_id)
        return {"status": "SUCCESS", "active_model": payload.model_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate/photo")
def generate_photo(payload: GenerationRequest):
    global photo_engine
    if not photo_engine:
        raise HTTPException(status_code=400, detail="No active model initialized.")
    
    try:
        # Pass the local disk path parameter down into your optimized photo processing engine
        public_filename, engine_report = photo_engine.process_canvas_layer(
            prompt=payload.prompt, 
            steps=payload.steps,
            base_image_path=payload.base_image_path,
            strength=payload.strength if payload.strength is not None else 0.5
        )
        
        if not public_filename:
            raise HTTPException(status_code=500, detail=engine_report)
            
        server_hosted_url = f"http://127.0.0.1:8000/static/outputs/{public_filename}"
            
        return {
            "status": "SUCCESS", 
            "log": engine_report, 
            "generated_image_url": server_hosted_url,
            "prompt_received": payload.prompt
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failure: {str(e)}")

@app.post("/api/process/audio")
def process_audio(payload: AudioRequest):
    """Triggers background audio offloading loops."""
    mock_wave = 44100.0
    _, report = audio_engine.process_audio_frequency(mock_wave)
    return {"status": "SUCCESS", "log": report, "target_file": payload.file_path}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)