import os
import sys
import uvicorn

def bootstrap():
    print("==============================================")
    print("      MORPHOS MEDIA: CORE ENGINE SERVER       ")
    print("==============================================\n")
    
    # Forward execution directly over to the Uvicorn network adapter
    os.system("python backend/server.py")

if __name__ == "__main__":
    bootstrap()