import sys
from gatekeeper import HardwareGatekeeper
from engines.photo.photo_core import MorphPhotoEngine

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

    # 2. Spawning the Shape-Shifting Photo Core Core
    photo_studio = MorphPhotoEngine(clearance["profile"])
    
    # Quick live execution test simulation
    mock_pixel_buffer = float(128.0)
    _, render_report = photo_studio.process_canvas_layer(mock_pixel_buffer)
    print(f"\n[PIPELINE REPORT] {render_report}")

if __name__ == "__main__":
    bootstrap()