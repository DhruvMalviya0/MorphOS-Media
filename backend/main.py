import sys
from gatekeeper import HardwareGatekeeper

def bootstrap():
    print("==============================================")
    print("      MORPHOS MEDIA: UNIVERSAL BACKEND        ")
    print("==============================================\n")
    
    # Initialize hardware checks
    gatekeeper = HardwareGatekeeper()
    clearance = gatekeeper.verify_clearance()
    
    if clearance["status"] == "DENIED":
        print("❌ CRITICAL ERROR - LAUNCH KILLED:")
        print(clearance["reason"])
        print("\nReview the diagnostic dump files at: 'backend/logs/system_check.log'")
        sys.exit(1)
        
    print(f"✅ Hardware diagnostics checked out successfully.")
    print(f"🚀 Initializing pipelines on optimization tier: [{clearance['profile']}]\n")

if __name__ == "__main__":
    bootstrap()