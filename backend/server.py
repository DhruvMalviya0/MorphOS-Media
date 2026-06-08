# backend/server.py
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from gatekeeper import HardwareGatekeeper
from engines.photo.photo_core import MorphPhotoEngine

app = FastAPI(title="MorphOS Media Studio Universal Core API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global engine controllers
gatekeeper = HardwareGatekeeper()
photo_engine = None  # Instantiated dynamically by model selection action

class ModelSelectRequest(BaseModel):
    model_id: str

class GenerationRequest(BaseModel):
    prompt: str
    steps: int

@app.get("/api/preflight/check")
def run_preflight_check():
    """Evaluates host system stability bounds and reads cache footprints."""
    return gatekeeper.evaluate_model_compatibility()

@app.post("/api/preflight/select")
def select_active_model(payload: ModelSelectRequest):
    """Dynamic Model Switcher: Hot-swaps the underlying active ONNX node graph."""
    global photo_engine
    try:
        # Re-boots the photo core utilizing the freshly selected model configurations
        # In a following step, photo_core will accept this payload dynamically
        photo_engine = MorphPhotoEngine(payload.model_id)
        return {"status": "SUCCESS", "active_model": payload.model_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate/photo")
def generate_photo(payload: GenerationRequest):
    """Triggers the active model execution pass layer."""
    global photo_engine
    if not photo_engine:
        raise HTTPException(status_code=400, detail="No active model initialized. Complete pre-flight selection.")
    
    mock_buffer = 128.0
    _, report = photo_engine.process_canvas_layer(mock_buffer)
    return {"status": "SUCCESS", "log": report, "prompt_received": payload.prompt}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)