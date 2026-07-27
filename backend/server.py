import os
# os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"  # Drops annoying warnings
# os.environ["HF_HUB_OFFLINE"] = "1"            # ONE-TIME DOWNLOAD MODE: uncomment to restore offline lock after model is cached

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List

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
    base_image_path: Optional[str] = None  # Base image field (base64 or URL)
    mask_image: Optional[str] = None        # Inpainting mask: BLACK=regenerate, WHITE=preserve
    strength: Optional[float] = 0.85        # Denoise strength inside mask region (0.85 = strong regen while respecting edges)

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
        # Pass base image, inpainting mask, and strength into the photo engine
        public_filename, engine_report = photo_engine.process_canvas_layer(
            prompt=payload.prompt, 
            steps=payload.steps,
            base_image_path=payload.base_image_path,
            strength=payload.strength if payload.strength is not None else 0.85,
            mask_image_data=payload.mask_image
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

class AudioAnalysisRequest(BaseModel):
    audio_base64: str  # For raw frontend data uploads

class AudioModifyRequest(BaseModel):
    audio_base64: str
    speed_factor: float

class UserSampleFile(BaseModel):
    name: str
    base64_data: str

class AudioGenerateRequest(BaseModel):
    prompt: str
    duration: Optional[int] = 5
    user_samples: Optional[List[UserSampleFile]] = []

@app.post("/api/audio/analyze")
def analyze_audio_track(payload: AudioAnalysisRequest):
    """Decodes audio base64 streams, saves a temporary asset file, and extracts structural metadata."""
    import base64
    try:
        # Decode binary stream
        header, encoded = payload.audio_base64.split(",", 1) if "," in payload.audio_base64 else ("", payload.audio_base64)
        audio_data = base64.b64decode(encoded)
        
        # Save temporary file inside our output cache folder
        temp_filename = "analysis_target.wav"
        temp_path = os.path.join(public_output_dir, temp_filename)
        with open(temp_path, "wb") as f:
            f.write(audio_data)
            
        # Run deep librosa DSP analytics extraction loops
        analysis_report = audio_engine.analyze_track(temp_path)
        if "error" in analysis_report:
            raise HTTPException(status_code=400, detail=analysis_report["error"])
        return analysis_report
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DSP Analysis parsing failed: {str(e)}")

@app.post("/api/audio/modify")
def modify_audio_tempo(payload: AudioModifyRequest):
    """Speeds up or slows down the loaded track timeline."""
    import base64
    try:
        header, encoded = payload.audio_base64.split(",", 1) if "," in payload.audio_base64 else ("", payload.audio_base64)
        audio_data = base64.b64decode(encoded)
        
        temp_filename = "modify_target.wav"
        temp_path = os.path.join(public_output_dir, temp_filename)
        with open(temp_path, "wb") as f:
            f.write(audio_data)
            
        output_file = audio_engine.modify_tempo(temp_path, payload.speed_factor)
        hosted_url = f"http://127.0.0.1:8000/static/outputs/{output_file}"
        return {"status": "SUCCESS", "modified_audio_url": hosted_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audio rendering modifier failed: {str(e)}")

@app.post("/api/audio/generate")
def generate_audio_track(payload: AudioGenerateRequest):
    """Decodes user-uploaded samples and invokes the dynamic sequencer matrix."""
    import base64
    try:
        temp_target_path = os.path.join(public_output_dir, "analysis_target.wav")
        has_base_track = os.path.exists(temp_target_path) and os.path.getsize(temp_target_path) > 0
        
        # Create a clean temporary directory wrapper for this run's user-uploaded samples
        session_samples_dir = os.path.join(public_output_dir, "user_session_fx")
        os.makedirs(session_samples_dir, exist_ok=True)
        
        # Decode and write each user-uploaded sound effect to disk dynamically
        decoded_sample_paths = {}
        for sample in payload.user_samples or []:
            header, encoded = sample.base64_data.split(",", 1) if "," in sample.base64_data else ("", sample.base64_data)
            sample_bytes = base64.b64decode(encoded)
            
            # Save using the file's original name (e.g., my_rain_loop.wav)
            safe_filename = os.path.basename(sample.name)
            target_fx_path = os.path.join(session_samples_dir, safe_filename)
            with open(target_fx_path, "wb") as f:
                f.write(sample_bytes)
            
            # Map it so the sequencer can scan filenames against keywords later
            decoded_sample_paths[safe_filename.lower()] = target_fx_path

        # If user uploaded sounds and gave an arrangement prompt, trigger our dynamic sequencer
        if has_base_track and decoded_sample_paths:
            print(f"[Routing Gate] User uploaded {len(decoded_sample_paths)} custom samples. Mapping to sequencer...")
            output_file = audio_engine.run_user_sample_sequencer(temp_target_path, payload.prompt, decoded_sample_paths)
            report_msg = "Dynamic sequencer successfully stitched your uploaded sound effects onto the timeline!"
        else:
            print("[Routing Gate] No user samples provided or no base track found. Running pure MusicGen...")
            output_file = audio_engine.generate_audio_from_prompt(payload.prompt, payload.duration)
            report_msg = f"Synthesized asset matching: '{payload.prompt}'"
        
        if not output_file:
            raise HTTPException(status_code=500, detail="Audio pipeline failed to compile artifact.")
            
        hosted_url = f"http://127.0.0.1:8000/static/outputs/{output_file}"
        return {"status": "SUCCESS", "log": report_msg, "generated_audio_url": hosted_url}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audio production failure: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)