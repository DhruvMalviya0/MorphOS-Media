import { useState, useEffect, ChangeEvent, DragEvent, useRef } from "react";
import "./App.css";

interface MediaFile {
  name: string;
  size: string;
  type: "photo" | "audio";
  localUrl: string;
}

interface AudioAnalysisReport {
  file_name: string;
  duration_seconds: number;
  estimated_bpm: number;
  total_beats_detected: number;
  first_beat_offset_seconds: number;
  beat_offsets_sample_array: number[];
}

interface FXSample {
  name: string;
  base64_data: string;
  size?: string;
}

export default function App() {
  // Navigation & Viewport State Handles
  const [activeTab, setActiveTab] = useState<"photo" | "audio">("photo");
  const [hardwareProfile, setHardwareProfile] = useState<string>("Detecting System Profile...");

  // Media Upload State Handles
  const [activePhoto, setActivePhoto] = useState<MediaFile | null>(null);
  const [activeAudio, setActiveAudio] = useState<MediaFile | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);

  // AI Generative Option State Handles
  const [aiPrompt, setAiPrompt] = useState<string>("");
  const [samplingSteps, setSamplingSteps] = useState<number>(4);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [studioLogs, setStudioLogs] = useState<string>("Studio monitoring console online...");

  // Audio Pipeline State Handles
  const [audioPrompt, setAudioPrompt] = useState<string>("");
  const [audioDuration, setAudioDuration] = useState<number>(5);
  const [speedFactor, setSpeedFactor] = useState<number>(1.0);
  const [audioAnalysis, setAudioAnalysis] = useState<AudioAnalysisReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isModifying, setIsModifying] = useState<boolean>(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<boolean>(false);
  const [uploadedFXSamples, setUploadedFXSamples] = useState<FXSample[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hardware Profiling Probe
  useEffect(() => {
    const checkHardwareStatus = async () => {
      try {
        const response = await fetch("http://127.0.0.1:8000/api/hardware");
        if (response.ok) {
          const data = await response.json();
          setHardwareProfile(`Optimization Tier: ${data.profile.replace(/_/g, " ")}`);
        } else {
          setHardwareProfile("Optimization Tier: Local Standby");
        }
      } catch (err) {
        setHardwareProfile("Optimization Tier: Standby (Offline)");
      }
    };
    checkHardwareStatus();
  }, [activeTab]);

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
      setActiveTab("photo");
      setStudioLogs(`[OK] Loaded photo asset: ${file.name} (${fileMeta.size})`);

      const reader = new FileReader();
      reader.onloadend = () => {
        setImageBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else if (audioExtensions.includes(file.type)) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64StreamString = reader.result as string;

        if (activeAudio) {
          // Primary track exists -> route asset smoothly into the Sample Vault array
          setUploadedFXSamples(prev => [
            ...prev, 
            { name: file.name, base64_data: base64StreamString, size: `${(file.size / (1024 * 1024)).toFixed(2)} MB` }
          ]);
          setStudioLogs(prev => prev + `\n[VAULT] Loaded custom sound effect sample: ${file.name}`);
        } else {
          // No timeline track -> set as the primary background asset and call DSP analytics
          fileMeta.type = "audio";
          setActiveAudio(fileMeta);
          setActiveTab("audio");
          setAudioBase64(base64StreamString);
          setStudioLogs(prev => prev + `\n[OK] Loaded primary track timeline: ${file.name}`);
          runAudioAnalysis(base64StreamString, file.name);
        }
      };
      reader.readAsDataURL(file);
    } else {
      setStudioLogs(`[WARN] Unsupported media format blocked: ${file.type || file.name.split('.').pop()}`);
    }
  };

  // Drag and Drop Listeners
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      let primaryAssigned = !!activeAudio;
      
      files.forEach(file => {
        const photoExtensions = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
        const audioExtensions = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav"];
        
        if (photoExtensions.includes(file.type)) {
          validateAndProcessFile(file);
        } else if (audioExtensions.includes(file.type)) {
          if (!primaryAssigned) {
            validateAndProcessFile(file);
            primaryAssigned = true;
          } else {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64StreamString = reader.result as string;
              setUploadedFXSamples(prev => [
                ...prev, 
                { name: file.name, base64_data: base64StreamString, size: `${(file.size / (1024 * 1024)).toFixed(2)} MB` }
              ]);
              setStudioLogs(prev => prev + `\n[VAULT] Loaded custom sound effect sample: ${file.name}`);
            };
            reader.readAsDataURL(file);
          }
        }
      });
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  // API Integration: Photo Generation
  const triggerAiGeneration = async () => {
    if (!aiPrompt.trim()) {
      setStudioLogs("[WARN] Halted: Prompt input string cannot be blank.");
      return;
    }

    setIsGenerating(true);
    setStudioLogs(`[LAUNCH] Dispatching neural request to MorphPhotoEngine... Inference Passes: ${samplingSteps}`);

    try {
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
        setStudioLogs(`[OK] ${data.log}\n[API SUCCESS] Rendering new asset canvas.`);
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

  // API Integration: Audio DSP Analysis
  const runAudioAnalysis = async (base64Data: string, fileName: string) => {
    setIsAnalyzing(true);
    setStudioLogs(`[LAUNCH] Dispatching audio analysis request to backend for: ${fileName}...`);
    try {
      const response = await fetch("http://127.0.0.1:8000/api/audio/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audio_base64: base64Data
        })
      });

      const data = await response.json();
      if (response.ok) {
        setAudioAnalysis(data);
        setStudioLogs(
          `[OK] Audio analysis complete for ${fileName}:\n` +
          `  Duration: ${data.duration_seconds}s\n` +
          `  Estimated BPM: ${data.estimated_bpm}\n` +
          `  Total Beats: ${data.total_beats_detected}\n` +
          `  First Beat Offset: ${data.first_beat_offset_seconds}s`
        );
      } else {
        setStudioLogs(`[ERROR] Audio analysis failed: ${data.detail}`);
      }
    } catch (error: any) {
      setStudioLogs(`[NETWORK ERROR] Failed to connect to audio analysis backend: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // API Integration: Tempo Modifier
  const modifyAudioTempo = async () => {
    if (!audioBase64) {
      setStudioLogs("[WARN] Halted: No audio file currently loaded in the timeline.");
      return;
    }

    setIsModifying(true);
    setStudioLogs(`[LAUNCH] Dispatching tempo modification request... Factor: ${speedFactor}x`);
    try {
      const response = await fetch("http://127.0.0.1:8000/api/audio/modify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audio_base64: audioBase64,
          speed_factor: speedFactor
        })
      });

      const data = await response.json();
      if (response.ok) {
        setStudioLogs(`[OK] Tempo modified successfully! Loaded speed-shifted track.`);
        const modifiedName = `mod_${speedFactor}x_${activeAudio?.name || "track.wav"}`;
        setActiveAudio({
          name: modifiedName,
          size: activeAudio?.size || "Modified size",
          type: "audio",
          localUrl: data.modified_audio_url
        });
      } else {
        setStudioLogs(`[ERROR] Tempo modification failed: ${data.detail}`);
      }
    } catch (error: any) {
      setStudioLogs(`[NETWORK ERROR] Failed to connect to tempo modifier backend: ${error.message}`);
    } finally {
      setIsModifying(false);
    }
  };

  // API Integration: MusicGen Prompt-to-Audio
  const generateAudioTrack = async () => {
    if (!audioPrompt.trim()) {
      setStudioLogs("[WARN] Halted: Prompt input string cannot be blank.");
      return;
    }

    setIsGeneratingAudio(true);
    setStudioLogs(`[LAUNCH] Dispatching generative audio request: "${audioPrompt}" (Duration: ${audioDuration}s)...`);
    try {
      const response = await fetch("http://127.0.0.1:8000/api/audio/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: audioPrompt,
          duration: audioDuration,
          user_samples: uploadedFXSamples
        })
      });

      const data = await response.json();
      if (response.ok) {
        setStudioLogs(`[OK] Audio synthesis complete:\n${data.log}\n[API SUCCESS] Loading generated track.`);
        
        setActiveAudio({
          name: `synth_${Math.floor(Math.random() * 1000000)}.wav`,
          size: `${audioDuration}s Synthesized Track`,
          type: "audio",
          localUrl: data.generated_audio_url
        });

        // Background download generated track to support editing
        try {
          const res = await fetch(data.generated_audio_url);
          const blob = await res.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            setAudioBase64(reader.result as string);
            runAudioAnalysis(reader.result as string, "synthesized_soundtrack.wav");
          };
          reader.readAsDataURL(blob);
        } catch (e) {
          console.error("Failed to load synthesized audio to base64", e);
        }
      } else {
        setStudioLogs(`[ERROR] Audio generation failed: ${data.detail}`);
      }
    } catch (error: any) {
      setStudioLogs(`[NETWORK ERROR] Failed to connect to audio generation backend: ${error.message}`);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  return (
    <div className="studio-root-container">
      {/* Upper Global Navigation Console */}
      <header className="studio-top-bar">
        <div className="brand-lockup">
          <h2>MorphOS Media Studio</h2>
          <span className="version-tag">v2.1.0-DAW-Intelli</span>
        </div>
        <div className="hardware-pill">{hardwareProfile}</div>
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
                      <button className="btn-clear" onClick={() => { setActiveAudio(null); setAudioBase64(null); setAudioAnalysis(null); }}>Remove</button>
                    </div>
                    <div className="audio-preview-box">
                      <div className="waveform-mock">
                        <div className="wave-bar" style={{ height: '40%' }}></div>
                        <div className="wave-bar" style={{ height: '75%' }}></div>
                        <div className="wave-bar" style={{ height: '90%' }}></div>
                        <div className="wave-bar" style={{ height: '30%' }}></div>
                        <div className="wave-bar" style={{ height: '60%' }}></div>
                        <div className="wave-bar" style={{ height: '85%' }}></div>
                        <div className="wave-bar" style={{ height: '45%' }}></div>
                      </div>
                      <audio controls src={activeAudio.localUrl} className="universal-audio-player" key={activeAudio.localUrl} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {/* Right Hand Column: AI Latent Control Room Panel */}
        <aside className="ai-control-panel">
          <div className="studio-tabs">
            <button 
              className={`tab-btn ${activeTab === "photo" ? "active" : ""}`}
              onClick={() => setActiveTab("photo")}
            >
              Visual Studio
            </button>
            <button 
              className={`tab-btn ${activeTab === "audio" ? "active" : ""}`}
              onClick={() => setActiveTab("audio")}
            >
              Audio DAW
            </button>
          </div>
          <hr className="divider" />

          {/* TAB 1: PHOTO GENERATION CONTROLS */}
          {activeTab === "photo" && (
            <div className="tab-content">
              <h3>Visual Canvas Controls</h3>
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
            </div>
          )}

          {/* TAB 2: AUDIO DAW CONTROLS */}
          {activeTab === "audio" && (
            <div className="tab-content scrollable-tab-content">
              <h3>DAW Intelligence Pipeline</h3>

              {/* SECTION A: Generative Audio from Prompt */}
              <div className="daw-section">
                <h4>Generative Soundscape Synthesis</h4>
                <div className="control-group">
                  <label>Acoustic Scene Prompt</label>
                  <textarea
                    placeholder="e.g., retro lofi synthwave loop, high energy techno drums, calm ambient rain..."
                    value={audioPrompt}
                    onChange={(e) => setAudioPrompt(e.target.value)}
                    disabled={isGeneratingAudio}
                  />
                </div>

                <div className="control-group">
                  <div className="slider-header">
                    <label>Duration (Seconds)</label>
                    <span className="slider-value">{audioDuration}s</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="15"
                    value={audioDuration}
                    onChange={(e) => setAudioDuration(parseInt(e.target.value))}
                    disabled={isGeneratingAudio}
                  />
                </div>

                <button
                  className={`btn-generate ${isGeneratingAudio ? "generating" : ""}`}
                  onClick={generateAudioTrack}
                  disabled={isGeneratingAudio}
                >
                  {isGeneratingAudio ? "Synthesizing Soundtrack..." : "Synthesize Soundscape"}
                </button>
              </div>

              <hr className="divider" />

              {/* SECTION: Sample Bin Vault */}
              <div className="daw-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4>Sample Bin Vault</h4>
                  <span className="badge" style={{ 
                    fontSize: '11px', 
                    padding: '2px 8px', 
                    backgroundColor: 'var(--bg-primary)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '10px',
                    color: '#00ffcc',
                    textShadow: '0 0 6px rgba(0, 255, 204, 0.2)'
                  }}>
                    {uploadedFXSamples.length} Active
                  </span>
                </div>
                
                <div className="control-group">
                  <input 
                    type="file" 
                    id="daw-fx-upload" 
                    ref={fileInputRef} 
                    onChange={(e) => {
                      if (e.target.files) {
                        Array.from(e.target.files).forEach(file => {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setUploadedFXSamples(prev => [
                              ...prev,
                              { name: file.name, base64_data: reader.result as string, size: `${(file.size / (1024 * 1024)).toFixed(2)} MB` }
                            ]);
                            setStudioLogs(prev => prev + `\n[VAULT] Loaded custom sound effect sample: ${file.name}`);
                          };
                          reader.readAsDataURL(file);
                        });
                      }
                    }}
                    multiple
                    accept="audio/*"
                    hidden
                  />
                  <label htmlFor="daw-fx-upload" className="btn-primary btn-tempo" style={{ width: '100%', margin: '0' }}>
                    + Load Custom FX Samples
                  </label>
                </div>

                {uploadedFXSamples.length === 0 ? (
                  <div className="dsp-placeholder">
                    No custom sound layers loaded. Add loops/effects to combine with sequencer tokens.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ 
                      maxHeight: '180px', 
                      overflowY: 'auto', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '6px',
                      paddingRight: '4px'
                    }}>
                      {uploadedFXSamples.map((sample, idx) => (
                        <div key={idx} className="dsp-stat-card" style={{ 
                          flexDirection: 'row', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          padding: '8px 12px'
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', width: '70%' }}>
                            <span style={{ 
                              fontSize: '12px', 
                              fontWeight: 500,
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              whiteSpace: 'nowrap' 
                            }} title={sample.name}>
                              {sample.name}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{sample.size || 'N/A'}</span>
                          </div>
                          <button 
                            className="btn-clear" 
                            style={{ 
                              padding: '2px 8px', 
                              fontSize: '11px',
                              borderColor: 'rgba(255, 0, 0, 0.3)',
                              color: 'rgba(255, 100, 100, 0.8)'
                            }} 
                            onClick={() => {
                              setUploadedFXSamples(prev => prev.filter((_, i) => i !== idx));
                              setStudioLogs(prev => prev + `\n[VAULT] Purged sample: ${sample.name}`);
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                    <button 
                      className="btn-clear" 
                      style={{ width: '100%', fontSize: '12px', padding: '8px', color: 'var(--text-muted)' }}
                      onClick={() => {
                        setUploadedFXSamples([]);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                        setStudioLogs(prev => prev + `\n[VAULT] Cleared all custom samples.`);
                      }}
                    >
                      Purge Sample Vault
                    </button>
                  </div>
                )}
              </div>

              <hr className="divider" />

              {/* SECTION B: DSP Analysis Report Dashboard */}
              <div className="daw-section">
                <h4>DSP Analysis Report</h4>
                {isAnalyzing ? (
                  <div className="dsp-loading-box">
                    <span className="dsp-spinner"></span> Running Deep FFT Beat Extraction...
                  </div>
                ) : audioAnalysis ? (
                  <div className="dsp-dashboard">
                    <div className="dsp-stats-grid">
                      <div className="dsp-stat-card">
                        <span className="stat-label">Estimated BPM</span>
                        <span className="stat-value bpm-badge">{audioAnalysis.estimated_bpm}</span>
                      </div>
                      <div className="dsp-stat-card">
                        <span className="stat-label">Duration</span>
                        <span className="stat-value">{audioAnalysis.duration_seconds}s</span>
                      </div>
                      <div className="dsp-stat-card">
                        <span className="stat-label">Total Beats</span>
                        <span className="stat-value">{audioAnalysis.total_beats_detected}</span>
                      </div>
                      <div className="dsp-stat-card">
                        <span className="stat-label">First Offset</span>
                        <span className="stat-value">{audioAnalysis.first_beat_offset_seconds}s</span>
                      </div>
                    </div>
                    {audioAnalysis.beat_offsets_sample_array && audioAnalysis.beat_offsets_sample_array.length > 0 && (
                      <div className="beat-offsets-container">
                        <span className="stat-label">Beat Timestamps (10 samples)</span>
                        <div className="beat-pills">
                          {audioAnalysis.beat_offsets_sample_array.map((offset, idx) => (
                            <span key={idx} className="beat-pill">{offset}s</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="dsp-placeholder">
                    No track metadata parsed. Load a track to inspect DSP elements.
                  </div>
                )}
              </div>

              <hr className="divider" />

              {/* SECTION C: Tempo Modifier */}
              <div className="daw-section">
                <h4>Speed/Tempo Modifier</h4>
                <div className="control-group">
                  <div className="slider-header">
                    <label>Tempo Factor</label>
                    <span className="slider-value">{speedFactor.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={speedFactor}
                    onChange={(e) => setSpeedFactor(parseFloat(e.target.value))}
                    disabled={isModifying || !audioBase64}
                  />
                  <span className="slider-tip">Note: Changing tempo scales pitch proportionally.</span>
                </div>

                <button
                  className={`btn-primary btn-tempo ${isModifying ? "generating" : ""}`}
                  onClick={modifyAudioTempo}
                  disabled={isModifying || !audioBase64}
                  style={{ width: '100%', marginTop: '8px' }}
                >
                  {isModifying ? "Re-matching sample frame rates..." : "Apply Speed Shift"}
                </button>
              </div>
            </div>
          )}
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