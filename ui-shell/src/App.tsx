import { useState, ChangeEvent, DragEvent } from "react";
import "./App.css";

interface MediaFile {
  name: string;
  size: string;
  type: "photo" | "audio";
  localUrl: string;
}

export default function App() {
  // Media Upload State Handles
  const [activePhoto, setActivePhoto] = useState<MediaFile | null>(null);
  const [activeAudio, setActiveAudio] = useState<MediaFile | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  // AI Generative Option State Handles
  const [aiPrompt, setAiPrompt] = useState<string>("");
  const [samplingSteps, setSamplingSteps] = useState<number>(4);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [studioLogs, setStudioLogs] = useState<string>("Studio monitoring console online...");

  // Universal Media Validator Matrix
  const validateAndProcessFile = (file: File) => {
    const photoExtensions = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    const audioExtensions = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav"];

    const fileMeta: MediaFile = {
      name: file.name,
      size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
      type: "photo",
      localUrl: URL.createObjectURL(file)
    };

    if (photoExtensions.includes(file.type)) {
      fileMeta.type = "photo";
      setActivePhoto(fileMeta);
      setStudioLogs(`[OK] Loaded photo asset: ${file.name} (${fileMeta.size})`);

      const reader = new FileReader();
      reader.onloadend = () => {
        setImageBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else if (audioExtensions.includes(file.type)) {
      fileMeta.type = "audio";
      setActiveAudio(fileMeta);
      setStudioLogs(`[OK] Loaded audio asset: ${file.name} (${fileMeta.size})`);
    } else {
      setStudioLogs(`[WARN] Unsupported media format blocked: ${file.type || file.name.split('.').pop()}`);
    }
  };

  // Update your listeners to look exactly like this:
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation(); // Stops the OS from blocking the event
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  // Replace the old simulation function with this live async connection:
  const triggerAiGeneration = async () => {
    if (!aiPrompt.trim()) {
      setStudioLogs("[WARN] Halted: Prompt input string cannot be blank.");
      return;
    }

    setIsGenerating(true);
    setStudioLogs(`[LAUNCH] Dispatching neural request to MorphPhotoEngine... Inference Passes: ${samplingSteps}`);

    try {
      // Direct HTTP connection down to your local FastAPI server endpoint
      const response = await fetch("http://127.0.0.1:8000/api/generate/photo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: aiPrompt,
          steps: samplingSteps,
          base_image_path: activePhoto ? 
            (activePhoto.localUrl.startsWith("http") ? 
              activePhoto.localUrl : 
              imageBase64) : null
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setStudioLogs(`[OK] ${data.log}\n[API SUCCESS] Rendering new asset context.`);

        // BIND THE REAL IMAGE URL TO THE CANVAS VIEW WINDOW VIEWPORT:
        setActivePhoto({
          name: `AI_Generated_${data.prompt_received.replace(/\s+/g, '_')}.png`,
          size: "Optimized 1024x1024 Canvas",
          type: "photo",
          localUrl: data.generated_image_url
        });
      } else {
        setStudioLogs(`[ERROR] Generation failed: ${data.detail}`);
      }
    } catch (error: any) {
      setStudioLogs(`[NETWORK ERROR] Failed to stream down to Python backend server: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="studio-root-container">
      {/* Upper Global Navigation Console */}
      <header className="studio-top-bar">
        <div className="brand-lockup">
          <h2>MorphOS Media Studio</h2>
          <span className="version-tag">v2.0.0-Beta</span>
        </div>
        <div className="hardware-pill">Optimization Tier: Active Window Mapping</div>
      </header>

      {/* Main Grid Division Layout */}
      <div className="studio-workspace-grid">

        {/* Left Hand Column: Creative Assets Workspace */}
        <main className="creative-canvas-area">

          {/* Universal Drop Zone Wrapper */}
          <div
            className={`dropzone-wrapper ${isDragging ? "dragging-active" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {!activePhoto && !activeAudio ? (
              <div className="dropzone-prompt">
                <p>Drag and drop media here or click to browse files</p>
                <span className="supported-formats">Supports: PNG, JPEG, WEBP, MP3, WAV</span>
                <input type="file" id="media-picker" onChange={handleFileSelect} hidden accept="image/*,audio/*" />
                <label htmlFor="media-picker" className="btn-primary">Browse Files</label>
              </div>
            ) : (
              <div className="active-viewports-container">
                {/* Photo Workspace Viewport Layer */}
                {activePhoto && (
                  <div className="canvas-card">
                    <div className="card-header">
                      <h4>Visual Canvas Layer ({activePhoto.name})</h4>
                      <button className="btn-clear" onClick={() => { setActivePhoto(null); setImageBase64(null); }}>Remove</button>
                    </div>
                    <div className="photo-preview-box">
                      <img src={activePhoto.localUrl} alt="Active Studio Layer" />
                    </div>
                  </div>
                )}

                {/* Audio Workspace Timeline Layer */}
                {activeAudio && (
                  <div className="canvas-card">
                    <div className="card-header">
                      <h4>Audio Track Timeline ({activeAudio.name})</h4>
                      <button className="btn-clear" onClick={() => setActiveAudio(null)}>Remove</button>
                    </div>
                    <div className="audio-preview-box">
                      <div className="waveform-mock">
                        <div className="wave-bar" style={{ height: '40%' }}></div>
                        <div className="wave-bar" style={{ height: '75%' }}></div>
                        <div className="wave-bar" style={{ height: '90%' }}></div>
                        <div className="wave-bar" style={{ height: '30%' }}></div>
                        <div className="wave-bar" style={{ height: '60%' }}></div>
                      </div>
                      <audio controls src={activeAudio.localUrl} className="universal-audio-player" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {/* Right Hand Column: AI Latent Control Room Panel */}
        <aside className="ai-control-panel">
          <h3>AI Generation Dashboard</h3>
          <hr className="divider" />

          <div className="control-group">
            <label>Neural Text Prompt Intent</label>
            <textarea
              placeholder="Describe the image modification or latent generation details..."
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              disabled={isGenerating}
            />
          </div>

          <div className="control-group">
            <div className="slider-header">
              <label>Sampling Interference Passes</label>
              <span className="slider-value">{samplingSteps}</span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              value={samplingSteps}
              onChange={(e) => setSamplingSteps(parseInt(e.target.value))}
              disabled={isGenerating}
            />
            <span className="slider-tip">Note: Laptop 4060 runs optimal Turbo passes at depth 4.</span>
          </div>

          <button
            className={`btn-generate ${isGenerating ? "generating" : ""}`}
            onClick={triggerAiGeneration}
            disabled={isGenerating}
          >
            {isGenerating ? "Synthesizing Latent Grid..." : "Generate AI Asset Canvas"}
          </button>
        </aside>

      </div>

      {/* Persistent Bottom Systems Diagnostic Dashboard Terminal */}
      <footer className="studio-logs-bar">
        <h5>Core System Communication Pipeline Monitor:</h5>
        <pre className="logs-terminal-view">{studioLogs}</pre>
      </footer>
    </div>
  );
}