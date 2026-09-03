# MorphOS Media Studio

MorphOS Media Studio is a powerful, universal media generation and processing suite. It features a modern desktop interface built with Tauri and React, and a robust FastAPI backend for AI-driven media processing.

## Architecture

The project is split into two main components:
- **`backend/`**: A Python-based FastAPI server orchestrating multiple AI engines.
- **`ui-shell/`**: A Tauri + React + TypeScript frontend providing a sleek desktop application experience.

## Features

### 🎨 Photo Engine
- AI-driven photo generation.
- Inpainting support with mask-based regeneration.
- Seamless integration with base images and adjustable denoise strengths.

### 🎵 Audio Engine
- Audio track analysis (DSP analytics extraction).
- Tempo modification and timeline adjustment.
- Dynamic audio generation and sequencing (MusicGen).
- Ability to upload custom user samples and sequence them dynamically via prompts.

### 📖 Manga Engine
- Manga page processing and panel extraction.
- Support for Right-to-Left (RTL) reading flow.
- Motion comic rendering from extracted panels.

### 🛡️ Hardware Gatekeeper
- Real-time system hardware profiling and clearance verification.
- Smart model compatibility evaluation for optimal inference speeds.

## Getting Started

### Backend
1. Navigate to the `backend/` directory.
2. Install the required dependencies: `pip install -r ../requirements.txt`
3. Run the FastAPI server: `python server.py`
   - *The server will start on http://127.0.0.1:8000*

### UI Shell
1. Navigate to the `ui-shell/` directory.
2. Install dependencies: `npm install`
3. Start the development server: `npm run tauri dev`

## Technologies Used
- **Backend**: FastAPI, Uvicorn, Python
- **Frontend**: Tauri, React, TypeScript, Vite, TailwindCSS
- **AI Integration**: Custom audio, photo, and manga processing engines

