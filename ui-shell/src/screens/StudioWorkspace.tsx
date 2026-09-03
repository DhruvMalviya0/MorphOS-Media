import { useState, useEffect, ChangeEvent, DragEvent, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import "../App.css";

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

interface RoutingDecision {
  resolution: string;
  precision: string;
  batch_size: number;
  reasoning: string[];
}

interface StudioWorkspaceProps {
  defaultTab?: "photo" | "audio";
  onBack: () => void;
}

export default function StudioWorkspace({ defaultTab = "photo", onBack }: StudioWorkspaceProps) {
  // Navigation & Viewport State Handles
  const [activeTab, setActiveTab] = useState<"photo" | "audio">(defaultTab);
  const [hardwareProfile, setHardwareProfile] = useState<string>("Detecting System Profile...");
  const [routingDecision, setRoutingDecision] = useState<RoutingDecision | null>(null);

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

  // Inpainting Mask Drawing State
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isMaskMode, setIsMaskMode] = useState<boolean>(false);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [brushSize, setBrushSize] = useState<number>(30);
  const [hasMask, setHasMask] = useState<boolean>(false);
  const [inpaintStrength, setInpaintStrength] = useState<number>(0.85);

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

  // Fetch Auto-Routing Decision
  useEffect(() => {
    if (activeTab === "photo") {
      const fetchRouting = async () => {
        try {
          const res = await fetch("http://127.0.0.1:8000/api/gatekeeper/route-decision", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ op_type: "photo-gen" })
          });
          if (res.ok) {
            const data = await res.json();
            setRoutingDecision(data);
          }
        } catch (e) {
          console.error("Failed to fetch routing decision", e);
        }
      };
      fetchRouting();
    }
  }, [activeTab]);

  // Reset mask canvas whenever the source image changes
  useEffect(() => {
    if (maskCanvasRef.current) {
      const ctx = maskCanvasRef.current.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
    }
    setHasMask(false);
    setIsMaskMode(false);
  }, [activePhoto?.localUrl]);

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

  // ── Inpainting Mask Drawing Handlers ────────────────────────────────────────
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = maskCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  const paintStroke = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const ctx = maskCanvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.arc(x, y, brushSize, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
    ctx.fill();
    setHasMask(true);
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isMaskMode) return;
    setIsDrawing(true);
    paintStroke(e);
  };

  const continueDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isMaskMode || !isDrawing) return;
    paintStroke(e);
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearMask = () => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasMask(false);
  };

  /** Exports mask as base64 PNG: WHITE background (preserve) + BLACK strokes (inpaint region). */
  const getMaskBase64 = (): string | null => {
    const srcCanvas = maskCanvasRef.current;
    if (!srcCanvas) return null;
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = 512;
    exportCanvas.height = 512;
    const ctx = exportCanvas.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 512, 512);
    ctx.drawImage(srcCanvas, 0, 0, 512, 512);
    return exportCanvas.toDataURL("image/png");
  };

  // API Integration: Photo Generation
  const triggerAiGeneration = async () => {
    if (!aiPrompt.trim()) {
      setStudioLogs("[WARN] Halted: Prompt input string cannot be blank.");
      return;
    }

    setIsGenerating(true);
    setStudioLogs(`[LAUNCH] Dispatching inpainting request to MorphPhotoEngine... Inference Passes: ${samplingSteps}`);

    try {
      const maskBase64 = hasMask ? getMaskBase64() : null;

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
              imageBase64) : null,
          mask_image: maskBase64,
          strength: inpaintStrength
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
    <div className="flex flex-col h-screen bg-morph-bg text-white font-sans overflow-hidden">
      {/* Top Header */}
      <header className="flex items-center justify-between px-6 h-16 border-b border-morph-border bg-[#121212] flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-300 hover:text-white bg-[#1a1a1a] hover:bg-[#252525] rounded-md transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </button>
          <h1 className="text-xl font-semibold tracking-wide">
            MorphOS Media Studio - {activeTab === "photo" ? "Visual Engine" : "Audio Engine"}
          </h1>
          <span className="px-2 py-0.5 text-xs rounded bg-[#2a2a2a] text-gray-400 border border-[#333]">
            v2.1.0-DAW-Intelli
          </span>
        </div>
        <div className="px-3 py-1 text-xs rounded-full bg-blue-900/30 text-blue-400 border border-blue-900/50">
          {hardwareProfile}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Main Canvas (Left) */}
        <div className="flex-1 p-6 flex flex-col overflow-hidden bg-[#0a0a0a]">
          <div
            className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-lg transition-colors overflow-hidden ${
              isDragging ? "border-blue-500 bg-blue-900/10" : "border-morph-border hover:border-gray-600 bg-morph-card"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {!activePhoto && !activeAudio ? (
              <div className="text-center">
                <p className="text-gray-400 mb-2">Drag and drop media here or click to browse files</p>
                <span className="text-xs text-gray-500 block mb-4">Supports: PNG, JPEG, WEBP, MP3, WAV</span>
                <input type="file" id="media-picker" onChange={handleFileSelect} hidden accept="image/*,audio/*" />
                <label htmlFor="media-picker" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded cursor-pointer transition-colors text-sm font-medium">
                  Browse Files
                </label>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col">
                {/* Photo Workspace Viewport Layer */}
                {activePhoto && (
                  <div className="flex-1 flex flex-col h-full overflow-hidden">
                    <div className="flex justify-between items-center p-3 border-b border-morph-border bg-[#161616] flex-shrink-0">
                      <h4 className="text-sm font-medium">Visual Canvas Layer ({activePhoto.name})</h4>
                      <button className="text-xs px-2 py-1 bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded transition-colors" onClick={() => { setActivePhoto(null); setImageBase64(null); clearMask(); setIsMaskMode(false); }}>
                        Remove
                      </button>
                    </div>
                    {/* Stacked image + mask canvas overlay */}
                    <div className="flex-1 relative overflow-hidden bg-black flex items-center justify-center">
                      <img src={activePhoto.localUrl} alt="Active Studio Layer" className="w-full h-full object-contain pointer-events-none" />
                      <canvas
                        ref={maskCanvasRef}
                        width={512}
                        height={512}
                        className={`absolute top-0 left-0 w-full h-full opacity-65 ${isMaskMode ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'}`}
                        onMouseDown={startDrawing}
                        onMouseMove={continueDrawing}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                      />
                    </div>
                    {/* Mask Toolbar */}
                    <div className="flex gap-2 items-center p-3 bg-[#161616] border-t border-morph-border flex-shrink-0 flex-wrap">
                      <button
                        className={`px-3 py-1.5 text-xs font-medium rounded transition-colors flex-shrink-0 ${isMaskMode ? 'bg-blue-500 text-white' : 'bg-[#2a2a2a] text-gray-300 hover:bg-[#333]'}`}
                        onClick={() => setIsMaskMode(prev => !prev)}
                      >
                        {isMaskMode ? '🖊️ Drawing...' : '✏️ Draw Mask'}
                      </button>
                      <button
                        className="px-3 py-1.5 text-xs font-medium bg-[#2a2a2a] text-gray-300 hover:bg-[#333] rounded transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={clearMask}
                        disabled={!hasMask}
                      >
                        🗑️ Clear
                      </button>
                      {hasMask && (
                        <span className="text-[11px] text-teal-400 drop-shadow-[0_0_6px_rgba(45,212,191,0.4)]">● Mask active</span>
                      )}
                      <span className="text-[11px] text-gray-400 ml-auto hidden sm:inline-block">
                        Paint a mask over the specific target area to regenerate. Unpainted pixels will remain strictly locked.
                      </span>
                    </div>
                    {isMaskMode && (
                      <div className="p-3 bg-[#161616] border-t border-morph-border flex-shrink-0">
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[11px] text-gray-300">Brush Size</label>
                          <span className="text-[11px] text-blue-400">{brushSize}px</span>
                        </div>
                        <input type="range" className="w-full accent-blue-500" min="5" max="80" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} />
                      </div>
                    )}
                  </div>
                )}

                {/* Audio Workspace Timeline Layer */}
                {activeAudio && (
                  <div className="flex-1 flex flex-col h-full overflow-hidden">
                    <div className="flex justify-between items-center p-3 border-b border-morph-border bg-[#161616] flex-shrink-0">
                      <h4 className="text-sm font-medium">Audio Track Timeline ({activeAudio.name})</h4>
                      <button className="text-xs px-2 py-1 bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded transition-colors" onClick={() => { setActiveAudio(null); setAudioBase64(null); setAudioAnalysis(null); }}>
                        Remove
                      </button>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center bg-[#0f0f0f] p-6 relative">
                      <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none gap-1">
                        <div className="w-2 bg-blue-500 h-1/3 rounded-full animate-pulse"></div>
                        <div className="w-2 bg-blue-500 h-2/3 rounded-full animate-pulse delay-75"></div>
                        <div className="w-2 bg-blue-500 h-1/2 rounded-full animate-pulse delay-150"></div>
                        <div className="w-2 bg-blue-500 h-5/6 rounded-full animate-pulse delay-200"></div>
                        <div className="w-2 bg-blue-500 h-2/3 rounded-full animate-pulse delay-300"></div>
                        <div className="w-2 bg-blue-500 h-1/3 rounded-full animate-pulse delay-500"></div>
                      </div>
                      <audio controls src={activeAudio.localUrl} className="w-full max-w-2xl z-10 filter invert hue-rotate-180 opacity-90" key={activeAudio.localUrl} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Control Panel (Right) */}
        <div className="w-full md:w-80 border-l border-morph-border bg-[#161616] flex-shrink-0 flex flex-col overflow-y-auto">
          {/* TAB 1: PHOTO GENERATION CONTROLS */}
          {activeTab === "photo" && (
            <div className="p-5 flex flex-col gap-6">
              <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider mb-2">Visual Canvas Controls</h3>
              
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-medium">Neural Text Prompt Intent</label>
                <textarea
                  className="w-full h-24 bg-[#0a0a0a] border border-morph-border rounded-md p-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none transition-colors"
                  placeholder="Describe the image modification or latent generation details..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  disabled={isGenerating}
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-gray-400 font-medium">Sampling Interference Passes</label>
                  <span className="text-xs text-blue-400">{samplingSteps}</span>
                </div>
                <input
                  type="range"
                  className="w-full accent-blue-500"
                  min="1"
                  max="50"
                  value={samplingSteps}
                  onChange={(e) => setSamplingSteps(parseInt(e.target.value))}
                  disabled={isGenerating}
                />
                <span className="text-[10px] text-gray-500">Note: Laptop 4060 runs optimal Turbo passes at depth 4.</span>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-gray-400 font-medium">Inpaint Denoise Strength</label>
                  <span className="text-xs text-blue-400">{inpaintStrength.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  className="w-full accent-blue-500"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={inpaintStrength}
                  onChange={(e) => setInpaintStrength(parseFloat(e.target.value))}
                  disabled={isGenerating}
                />
                <span className="text-[10px] text-gray-500">1.0 = full regeneration inside mask · 0.5 = blend with original</span>
              </div>

              {/* Auto-Routing Panel */}
              {routingDecision && (
                <div className="flex flex-col gap-2 p-3 bg-blue-900/10 border border-blue-900/30 rounded-md">
                  <h4 className="text-xs font-semibold text-blue-400">⚡ Hardware Auto-Routing</h4>
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-400">
                    <div><span className="text-gray-500">Resolution:</span> {routingDecision.resolution}</div>
                    <div><span className="text-gray-500">Precision:</span> {routingDecision.precision}</div>
                    <div><span className="text-gray-500">Batch Size:</span> {routingDecision.batch_size}</div>
                  </div>
                  <div className="mt-2 text-[10px] text-gray-400">
                    <span className="text-gray-500 font-medium">Reasoning:</span>
                    <ul className="list-disc pl-3 mt-1 space-y-1">
                      {routingDecision.reasoning.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <button
                className={`w-full py-2.5 rounded-md font-medium text-sm transition-all duration-300 ${
                  isGenerating 
                    ? "bg-blue-600/50 text-white cursor-wait relative overflow-hidden" 
                    : "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_20px_rgba(37,99,235,0.5)]"
                }`}
                onClick={triggerAiGeneration}
                disabled={isGenerating}
              >
                {isGenerating ? "Synthesizing Latent Grid..." : "Generate AI Asset Canvas"}
              </button>
            </div>
          )}

          {/* TAB 2: AUDIO DAW CONTROLS */}
          {activeTab === "audio" && (
            <div className="p-5 flex flex-col gap-6">
              <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider mb-2">DAW Intelligence Pipeline</h3>

              {/* DSP Analytics Display */}
              {isAnalyzing ? (
                <div className="flex flex-col gap-2 p-3 bg-blue-900/10 border border-blue-900/30 rounded-md animate-pulse">
                  <h4 className="text-xs font-semibold text-blue-400">Extracting DSP Analytics...</h4>
                </div>
              ) : audioAnalysis && (
                <div className="flex flex-col gap-2 p-3 bg-blue-900/10 border border-blue-900/30 rounded-md">
                  <h4 className="text-xs font-semibold text-blue-400">DSP Analysis Complete</h4>
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-400">
                    <div><span className="text-gray-500">BPM:</span> {audioAnalysis.estimated_bpm}</div>
                    <div><span className="text-gray-500">Duration:</span> {audioAnalysis.duration_seconds}s</div>
                    <div><span className="text-gray-500">Beats:</span> {audioAnalysis.total_beats_detected}</div>
                    <div><span className="text-gray-500">Offset:</span> {audioAnalysis.first_beat_offset_seconds}s</div>
                  </div>
                </div>
              )}

              {/* Tempo Modifier */}
              <div className="flex flex-col gap-4">
                <h4 className="text-xs font-semibold text-blue-400 uppercase">Tempo Modulation</h4>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs text-gray-400 font-medium">Speed Factor</label>
                    <span className="text-xs text-blue-400">{speedFactor}x</span>
                  </div>
                  <input
                    type="range"
                    className="w-full accent-blue-500"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={speedFactor}
                    onChange={(e) => setSpeedFactor(parseFloat(e.target.value))}
                    disabled={isModifying || !activeAudio}
                  />
                </div>
                <button
                  className={`w-full py-2.5 rounded-md font-medium text-sm transition-all duration-300 ${
                    isModifying || !activeAudio
                      ? "bg-[#2a2a2a] text-gray-500 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_20px_rgba(37,99,235,0.5)]"
                  }`}
                  onClick={modifyAudioTempo}
                  disabled={isModifying || !activeAudio}
                >
                  {isModifying ? "Modifying Tempo..." : "Apply Tempo Shift"}
                </button>
              </div>

              <hr className="border-morph-border my-2" />

              {/* Generative Audio */}
              <div className="flex flex-col gap-4">
                <h4 className="text-xs font-semibold text-blue-400 uppercase">Generative Soundscape Synthesis</h4>
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-gray-400 font-medium">Acoustic Scene Prompt</label>
                  <textarea
                    className="w-full h-20 bg-[#0a0a0a] border border-morph-border rounded-md p-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none transition-colors"
                    placeholder="e.g., retro lofi synthwave loop, high energy techno drums..."
                    value={audioPrompt}
                    onChange={(e) => setAudioPrompt(e.target.value)}
                    disabled={isGeneratingAudio}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs text-gray-400 font-medium">Duration</label>
                    <span className="text-xs text-blue-400">{audioDuration}s</span>
                  </div>
                  <input
                    type="range"
                    className="w-full accent-blue-500"
                    min="2"
                    max="15"
                    value={audioDuration}
                    onChange={(e) => setAudioDuration(parseInt(e.target.value))}
                    disabled={isGeneratingAudio}
                  />
                </div>

                <button
                  className={`w-full py-2.5 rounded-md font-medium text-sm transition-all duration-300 ${
                    isGeneratingAudio
                      ? "bg-purple-600/50 text-white cursor-wait relative overflow-hidden"
                      : "bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)] hover:shadow-[0_0_20px_rgba(147,51,234,0.5)]"
                  }`}
                  onClick={generateAudioTrack}
                  disabled={isGeneratingAudio}
                >
                  {isGeneratingAudio ? "Synthesizing..." : "Synthesize Soundscape"}
                </button>
              </div>

              <hr className="border-morph-border" />

              {/* Sample Bin Vault */}
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-semibold text-blue-400 uppercase">Sample Bin Vault</h4>
                  <span className="px-2 py-0.5 text-[10px] bg-teal-900/30 text-teal-400 border border-teal-900/50 rounded-full">
                    {uploadedFXSamples.length} Active
                  </span>
                </div>
                
                <div className="flex flex-col gap-2">
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
                  <label htmlFor="daw-fx-upload" className="w-full py-2 bg-[#2a2a2a] hover:bg-[#333] text-gray-300 rounded cursor-pointer transition-colors text-xs font-medium text-center border border-dashed border-gray-600 hover:border-gray-400">
                    + Load Custom FX Samples
                  </label>
                </div>

                {uploadedFXSamples.length === 0 ? (
                  <div className="text-[11px] text-gray-500 text-center p-3 border border-morph-border rounded bg-[#0a0a0a]">
                    No custom sound layers loaded. Add loops/effects to combine with sequencer tokens.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                      {uploadedFXSamples.map((sample, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2 bg-[#0a0a0a] border border-morph-border rounded group hover:border-gray-600 transition-colors">
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-[11px] font-medium text-gray-300 truncate" title={sample.name}>
                              {sample.name}
                            </span>
                            <span className="text-[9px] text-gray-500">{sample.size || 'N/A'}</span>
                          </div>
                          <button 
                            className="ml-2 px-1.5 py-0.5 text-[10px] text-red-500/70 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
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
                      className="w-full py-1.5 text-[11px] text-gray-500 hover:text-red-400 transition-colors"
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
            </div>
          )}
        </div>
      </div>

      {/* Console (Bottom Full Width) */}
      <div className="h-40 border-t border-morph-border bg-[#050505] flex-shrink-0 flex flex-col p-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
          Core System Communication Pipeline Monitor
        </h4>
        <div className="flex-1 overflow-y-auto font-mono text-[11px] text-[#00ffcc] leading-relaxed whitespace-pre-wrap opacity-80 custom-scrollbar">
          {studioLogs}
        </div>
      </div>
    </div>
  );
}
