import sys
from gatekeeper import HardwareGatekeeper
from engines.photo.photo_core import MorphPhotoEngine
from engines.audio.audio_core import MorphAudioEngine

def bootstrap():
    print("==============================================")
    print("      MORPHOS MEDIA: UNIVERSAL BACKEND        ")
    print("==============================================\n")
    
    # 1. Initialize hardware checks
    gatekeeper = HardwareGatekeeper()
    clearance = gatekeeper.verify_clearance()
    
    if clearance["status"] == "DENIED":
        print("[ERROR] CRITICAL ERROR - LAUNCH KILLED:")
        print(clearance["reason"])
        sys.exit(1)
        
    print(f"[OK] Hardware diagnostics checked out successfully.")
    print(f"[LAUNCH] Initializing pipelines on optimization tier: [{clearance['profile']}]\n")

    print("--- SPAWNING ENGINE SUITES ---")
    # 2. Spawn the Shape-Shifting Photo Core
    photo_studio = MorphPhotoEngine(clearance["profile"])
    
    # 3. Spawn the Hybrid Background Audio Processing Core
    audio_studio = MorphAudioEngine(gatekeeper.providers)
    
    # Run rapid live execution test simulations
    print("\n--- SIMULATING CANVAS WORKLOADS ---")
    mock_pixel_buffer = float(128.0)
    _, photo_report = photo_studio.process_canvas_layer(mock_pixel_buffer)
    print(f"[PHOTO REPORT] {photo_report}")
    
    mock_audio_wave = float(44100.0)
    _, audio_report = audio_studio.process_audio_frequency(mock_audio_wave)
    print(f"[AUDIO REPORT] {audio_report}")
    print("\n==============================================")

if __name__ == "__main__":
    bootstrap()