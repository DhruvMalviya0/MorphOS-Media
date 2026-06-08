import { useState, useEffect, ChangeEvent, DragEvent } from "react";
import "./App.css";

interface ModelReport {
  id: string;
  name: string;
  status: "RECOMMENDED" | "COMPATIBLE" | "DANGEROUS";
  warning_sign: boolean;
  file_exists: boolean;
  description: string;
}

interface MediaFile {
  name: string;
  size: string;
  type: "photo" | "audio";
  localUrl: string;
}

export default function App() {
  // Pre-flight & Model Management States
  const [hardwareInfo, setHardwareInfo] = useState<string>("Scanning Architecture...");
  const [modelReports, setModelReports] = useState<ModelReport[]>([]);
  const [activeModelId, setActiveModelId] = useState<string>("");
  const [showPreflightModal, setShowPreflightModal] = useState<boolean>(true);

  // Core Media States
  const [activePhoto, setActivePhoto] = useState<MediaFile | null>(null);
  const [activeAudio, setActiveAudio] = useState<MediaFile | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Generation Controls
  const [aiPrompt, setAiPrompt] = useState<string>("");
  const [samplingSteps, setSamplingSteps] = useState<number>(4);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [studioLogs, setStudioLogs] = useState<string>("Awaiting pre-flight model initialization pass...");

  // 1. Run Pre-flight Scan on Startup
  // 1. Run Pre-flight Scan on Startup with robust catch guards
  useEffect(() => {
    const fetchPreflight = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/preflight/check");
        if (!res.ok) throw new Error(`HTTP status error: ${res.status}`);

        const data = await res.json();
        setHardwareInfo(data.gpu_info || "Generic Compute Adapter");
        setModelReports(data.report || []);

        // Dynamic Bypass evaluation logic
        if (data.redirect && data.report) {
          const defaultModel = data.report.find((m: ModelReport) => m.file_exists && m.status !== "DANGEROUS");
          if (defaultModel) {
            initializeModel(defaultModel.id, true);
            return;
          }
        }
        setShowPreflightModal(true);
      } catch (err: any) {
        console.error("Preflight failure interception:", err);
        // Fallback placeholders prevent the UI thread from crashing into a black screen
        setHardwareInfo("Local Pipeline Offline");
        setStudioLogs(`[CONNECTION ERROR] Backend server is not responding. Please check your terminal windows.`);
        setModelReports([
          {
            id: "offline_fallback",
            name: "Offline Diagnostic Sandbox Engine",
            status: "COMPATIBLE",
            warning_sign: false,
            file_exists: false,
            description: "Connection to Python core server was reset. Interface running in standalone UI mode."
          }
        ]);
        setShowPreflightModal(true);
      }
    };

    fetchPreflight();
  }, []);

  // 2. Model Initializer Dispatcher
  const initializeModel = async (modelId: string, bypassModal = false) => {
    setStudioLogs(`[LAUNCH] Loading neural graph weights for configuration: ${modelId}...`);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/preflight/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_id: modelId }),
      });
      if (res.ok) {
        setActiveModelId(modelId);
        if (!bypassModal) setShowPreflightModal(false);
        setStudioLogs(`[OK] Switched active model runtime session context safely to: ${modelId}`);
      } else {
        setStudioLogs(`[ERROR] Backend configuration runtime setup failed for model: ${modelId}`);
      }
    } catch (err: any) {
      setStudioLogs(`[NETWORK ERROR] Failed to dispatch model choice: ${err.message}`);
    }
  };

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
    } else if (audioExtensions.includes(file.type)) {
      fileMeta.type = "audio";
      setActiveAudio(fileMeta);
      setStudioLogs(`[OK] Loaded audio asset: ${file.name} (${fileMeta.size})`);
    } else {
      setStudioLogs(`[WARN] Unsupported media format blocked: ${file.type || file.name.split('.').pop()}`);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => { setIsDragging(false); };
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) validateAndProcessFile(e.dataTransfer.files[0]);
  };

  // AI Studio Image Dispatcher Action
  const triggerAiGeneration = async () => {
    if (!aiPrompt.trim()) {
      setStudioLogs("[WARN] Halted: Prompt input string cannot be blank.");
      return;
    }
    setIsGenerating(true);
    setStudioLogs(`[LAUNCH] Dispatching neural request to MorphPhotoEngine [${activeModelId}]...`);
    try {
      const response = await fetch("http://127.0.0.1:8000/api/generate/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt, steps: samplingSteps }),
      });
      const data = await response.json();
      if (response.ok) {
        setStudioLogs(`[OK] ${data.log}\n[API SUCCESS] Confirmed prompt receipt: "${data.prompt_received}"`);
      } else {
        setStudioLogs(`[ERROR] Generation failed: ${data.detail}`);
      }
    } catch (error: any) {
      setStudioLogs(`[NETWORK ERROR] Failed to connect to server: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="studio-root-container">
      {/* Dynamic Pre-flight Setup Modal Overlay */}
      {showPreflightModal && (
        <div className="modal-backdrop">
          <div className="preflight-modal-card">
            <h3>Engine Pre-flight Initialization Checklist</h3>
            <p className="modal-hardware-desc">Detected Host Platform: <strong>{hardwareInfo}</strong></p>
            <hr className="divider" />
            <div className="manifest-selection-list">
              {modelReports.map((model) => (
                <div key={model.id} className={`manifest-item card-status-${model.status.toLowerCase()}`}>
                  <div className="manifest-meta-block">
                    <div className="title-row">
                      <h4>{model.name}</h4>
                      <span className={`badge-pill status-${model.status.toLowerCase()}`}>
                        {model.status === "DANGEROUS" ? "⚠️ PC KILLER / VRAM OVERFLOW" : model.status}
                      </span>
                    </div>
                    <p className="model-desc">{model.description}</p>
                  </div>
                  <button
                    className="btn-select-model"
                    onClick={() => initializeModel(model.id)}
                  >
                    Load Weight Graph
                  </button>
                </div>
              ))}
            </div>
            <button className="btn-close-modal" onClick={() => setShowPreflightModal(false)}>Bypass to Workspace</button>
          </div>
        </div>
      )}

      <header className="studio-top-bar">
        <div className="brand-lockup">
          <h2>MorphOS Media Studio</h2>
          <span className="version-tag">v2.0.0-Beta</span>
        </div>
        <div className="hardware-pill">Active Silicon Target: {hardwareInfo}</div>
      </header>

      <div className="studio-workspace-grid">
        <main className="creative-canvas-area">
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

                {/* Hidden native input file handle element */}
                <input
                  type="file"
                  id="media-picker"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      validateAndProcessFile(e.target.files[0]);
                    }
                  }}
                  hidden
                  accept="image/*,audio/*"
                />

                {/* Clean, isolated button trigger with absolute event propagation containment */}
                <button
                  type="button"
                  className="btn-primary"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    document.getElementById('media-picker')?.click();
                  }}
                >
                  Browse Files
                </button>
              </div>
            ) : (
              <div className="active-viewports-container">
                {activePhoto && (
                  <div className="canvas-card">
                    <div className="card-header">
                      <h4>Visual Canvas Layer ({activePhoto.name})</h4>
                      <button className="btn-clear" onClick={() => setActivePhoto(null)}>Remove</button>
                    </div>
                    <div className="photo-preview-box">
                      <img src={activePhoto.localUrl} alt="Active Studio Layer" />
                    </div>
                  </div>
                )}
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
                      </div>
                      <audio controls src={activeAudio.localUrl} className="universal-audio-player" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        <aside className="ai-control-panel">
          <h3>AI Generation Dashboard</h3>
          <hr className="divider" />

          {/* Model Hot-Switcher Layout Component Block */}
          <div className="control-group">
            <label>Active Graph Switcher Context</label>
            <select
              className="model-dropdown-selector"
              value={activeModelId}
              onChange={(e) => initializeModel(e.target.value)}
            >
              <option value="" disabled>-- Select Execution Node --</option>
              {modelReports.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.status === "DANGEROUS" ? "⚠️ OVERFLOW RISK" : m.status})
                </option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label>Neural Text Prompt Intent</label>
            <textarea
              placeholder="Describe the image modification details..."
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              disabled={isGenerating || !activeModelId}
            />
          </div>

          <div className="control-group">
            <div className="slider-header">
              <label>Sampling Interference Passes</label>
              <span className="slider-value">{samplingSteps}</span>
            </div>
            <input
              type="range" min="1" max="50" value={samplingSteps}
              onChange={(e) => setSamplingSteps(parseInt(e.target.value))}
              disabled={isGenerating || !activeModelId}
            />
          </div>

          <button
            className={`btn-generate ${isGenerating || !activeModelId ? "generating" : ""}`}
            onClick={triggerAiGeneration}
            disabled={isGenerating || !activeModelId}
          >
            {!activeModelId ? "Select a Model First" : isGenerating ? "Synthesizing..." : "Generate AI Asset Canvas"}
          </button>
        </aside>
      </div>

      <footer className="studio-logs-bar">
        <h5>Core System Communication Pipeline Monitor:</h5>
        <pre className="logs-terminal-view">{studioLogs}</pre>
      </footer>
    </div>
  );
}