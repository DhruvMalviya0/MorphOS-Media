import React, { useState, useRef } from 'react';
import { ArrowLeft, Upload, ArrowRight, Loader2, Maximize, Sliders, BookOpen, ZoomIn, Film } from 'lucide-react';

interface MangaWorkspaceProps {
  onBack: () => void;
  addRecentProject?: (name: string, type: string, icon: any, accentColor: string) => void;
}

interface PanelData {
  id: number;
  image: string;
  depthStrength: number;
  sfxPrompt: string;
}

export default function MangaWorkspace({ onBack, addRecentProject }: MangaWorkspaceProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [readingFlow, setReadingFlow] = useState<'rtl' | 'ltr'>('rtl');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);
  
  // Phase 3: New Hybrid Workflow State
  const [panelsData, setPanelsData] = useState<PanelData[]>([]);
  const [activePanelId, setActivePanelId] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImageFile = (file: File) => {
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    setPanelsData([]);
    setActivePanelId(null);
    
    const reader = new FileReader();
    reader.onloadend = () => setImageBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleInitialize = async () => {
    if (!imageBase64) return;
    setIsExtracting(true);
    setPanelsData([]);
    setActivePanelId(null);
    
    try {
      const response = await fetch("http://127.0.0.1:8000/api/manga/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_data: imageBase64,
          reading_flow: readingFlow
        })
      });
      
      const data = await response.json();
      if (response.ok) {
        // Map backend panels to frontend configuration state
        const rawPanels = data.panels || [];
        const mappedPanels: PanelData[] = rawPanels.map((p: any) => ({
          id: p.panel_id,
          image: p.cropped_image_base64,
          depthStrength: 0.5,
          sfxPrompt: ""
        }));
        
        setPanelsData(mappedPanels);
        
        if (addRecentProject) {
          addRecentProject("Manga Extraction Activity", "animation", BookOpen, "#00e5c3");
        }
      } else {
        console.error("Backend error:", data.detail);
      }
    } catch (err) {
      console.error("Network error:", err);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleRenderComic = async () => {
    if (panelsData.length === 0) return;
    setIsRendering(true);
    
    try {
      const response = await fetch("http://127.0.0.1:8000/api/manga/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          panels: panelsData
        })
      });
      
      const data = await response.json();
      if (response.ok) {
        console.log("Render Success:", data);
        setRenderedVideoUrl(data.video_url);
      } else {
        console.error("Render error:", data.detail);
      }
    } catch (err) {
      console.error("Network error:", err);
    } finally {
      setIsRendering(false);
    }
  };

  const updatePanelData = (id: number, field: keyof PanelData, value: any) => {
    setPanelsData(prev => 
      prev.map(p => p.id === id ? { ...p, [field]: value } : p)
    );
  };

  const activePanel = panelsData.find(p => p.id === activePanelId);

  return (
    <div className="flex flex-col h-screen bg-morph-bg text-white font-sans overflow-hidden">
      {/* Top Header */}
      <header className="flex items-center px-6 h-16 border-b border-morph-border bg-[#121212] flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Dashboard</span>
        </button>
        <div className="flex-1 flex justify-center">
          <h1 className="text-lg font-semibold tracking-wide">Manga Motion Engine</h1>
        </div>
        <div className="w-24"></div> {/* Spacer for centering */}
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Main Canvas (Top Left) */}
        <div className="flex-1 p-6 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Canvas Dropzone</h2>
            {imageSrc && (
              <button 
                onClick={() => {
                  setImageSrc(null);
                  setPanelsData([]);
                  setActivePanelId(null);
                }}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Clear Image
              </button>
            )}
          </div>
          
          <div 
            className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center relative overflow-hidden transition-colors ${
              imageSrc ? 'border-morph-border bg-black/40' : 'border-gray-600 hover:border-gray-500 bg-morph-card/50'
            }`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            {renderedVideoUrl ? (
              <div className="relative w-full h-full flex items-center justify-center bg-black">
                <video 
                  src={renderedVideoUrl} 
                  controls 
                  autoPlay 
                  loop 
                  className="w-full h-full object-contain"
                />
                <button 
                  onClick={() => setRenderedVideoUrl(null)}
                  className="absolute top-4 right-4 bg-[#161616] text-white px-4 py-2 rounded border border-morph-border hover:bg-[#262626] transition-colors flex items-center gap-2 z-10"
                >
                  ✕ Close Video
                </button>
              </div>
            ) : imageSrc ? (
              <img 
                src={imageSrc} 
                alt="Uploaded Manga Page" 
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-morph-card flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-8 h-8 text-blue-400" />
                </div>
                <p className="text-lg font-medium text-gray-200">Drag & drop your manga page</p>
                <p className="text-sm text-gray-500 mt-2">Supports JPG, PNG</p>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-6 px-6 py-2 bg-morph-card hover:bg-[#202020] border border-morph-border rounded-lg text-sm transition-colors"
                >
                  Browse Files
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  accept="image/png, image/jpeg" 
                  className="hidden" 
                />
              </div>
            )}
          </div>
        </div>

        {/* Contextual Control Panel (Top Right) */}
        <div className="w-full md:w-80 border-l border-morph-border bg-morph-card flex-shrink-0 flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {activePanelId === null ? (
              /* Global Settings */
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-2 mb-6">
                  <Sliders className="w-5 h-5 text-purple-400" />
                  <h2 className="text-sm font-medium uppercase tracking-wider">Extraction Settings</h2>
                </div>

                <div className="space-y-6">
                  {/* Reading Flow */}
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400">Reading Flow</label>
                    <select 
                      value={readingFlow}
                      onChange={(e) => setReadingFlow(e.target.value as 'rtl' | 'ltr')}
                      className="w-full bg-[#101010] border border-morph-border rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                    >
                      <option value="rtl">Right-to-Left (Manga)</option>
                      <option value="ltr">Left-to-Right (Comic)</option>
                    </select>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={handleInitialize}
                    disabled={!imageSrc || isExtracting}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                      !imageSrc 
                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                        : isExtracting
                        ? 'bg-purple-600/50 text-purple-200 cursor-wait'
                        : 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:shadow-[0_0_20px_rgba(168,85,247,0.5)]'
                    }`}
                  >
                    {isExtracting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Extracting Panels...
                      </>
                    ) : (
                      <>
                        <Maximize className="w-5 h-5" />
                        Initialize Panels
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* Contextual Panel Settings */
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-blue-400" />
                    <h2 className="text-sm font-medium uppercase tracking-wider">Panel {activePanelId} Settings</h2>
                  </div>
                  <button 
                    onClick={() => setActivePanelId(null)}
                    className="text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    Back
                  </button>
                </div>

                {activePanel && (
                  <div className="space-y-6">
                    {/* Parallax Depth */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-sm text-gray-400">Parallax Depth</label>
                        <span className="text-xs text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">
                          {activePanel.depthStrength.toFixed(2)}
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.05" 
                        value={activePanel.depthStrength}
                        onChange={(e) => updatePanelData(activePanel.id, 'depthStrength', parseFloat(e.target.value))}
                        className="w-full accent-blue-500"
                      />
                    </div>

                    {/* SFX Prompt */}
                    <div className="space-y-2">
                      <label className="text-sm text-gray-400">Audio / SFX Prompt</label>
                      <textarea 
                        value={activePanel.sfxPrompt}
                        onChange={(e) => updatePanelData(activePanel.id, 'sfxPrompt', e.target.value)}
                        placeholder="e.g. 'Sword clash, heavy breathing...'"
                        className="w-full bg-[#101010] border border-morph-border rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors h-24 resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Render Action (Always Visible at bottom) */}
          <div className="p-6 border-t border-morph-border bg-[#121212]/50">
            <button
              onClick={handleRenderComic}
              disabled={panelsData.length === 0 || isRendering}
              className={`w-full py-4 rounded-xl font-bold tracking-wide transition-all flex items-center justify-center gap-2 ${
                panelsData.length === 0
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  : isRendering
                  ? 'bg-emerald-600/50 text-emerald-200 cursor-wait'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)]'
              }`}
            >
              {isRendering ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Rendering Video...
                </>
              ) : (
                <>
                  <Film className="w-5 h-5" />
                  Render Motion Comic
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Timeline Strip (Bottom Full Width) */}
      <div className="h-48 border-t border-morph-border bg-[#0a0a0a] flex-shrink-0 flex flex-col">
        <div className="px-6 py-2 border-b border-morph-border flex items-center justify-between bg-morph-card/30">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Motion Timeline</h2>
          <div className="text-xs text-gray-500">
            {panelsData.length > 0 ? `${panelsData.length} Panels Configured` : 'Awaiting Extraction'}
          </div>
        </div>
        
        <div className="flex-1 overflow-x-auto p-4 flex items-center gap-4 min-w-min">
          {panelsData.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm italic">
              Upload an image and initialize extraction to populate timeline
            </div>
          ) : (
            panelsData.map((panel, index) => (
              <React.Fragment key={panel.id}>
                <div 
                  className={`w-32 h-24 bg-morph-card rounded-lg flex flex-col items-center justify-center flex-shrink-0 cursor-pointer group relative overflow-hidden transition-all duration-200 ${
                    activePanelId === panel.id 
                      ? 'ring-2 ring-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)] opacity-100' 
                      : 'border border-morph-border hover:border-blue-500/50 opacity-70 hover:opacity-100'
                  }`}
                  onClick={() => setActivePanelId(panel.id)}
                >
                  {panel.image ? (
                    <>
                      <img src={panel.image} alt={`Panel ${panel.id}`} className="w-full h-full object-cover" />
                      
                      {/* Expand Icon for Lightbox */}
                      <button 
                        className="absolute inset-0 m-auto w-8 h-8 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                        onClick={(e) => {
                          e.stopPropagation();
                          const base64Data = panel.image.replace("data:image/jpeg;base64,", "");
                          setSelectedImage(base64Data);
                        }}
                      >
                        <ZoomIn className="w-4 h-4 text-white" />
                      </button>
                    </>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-black/50 border border-gray-700 flex items-center justify-center mb-2">
                      {panel.id}
                    </div>
                  )}
                  
                  {/* Panel ID Badge */}
                  {panel.image && (
                    <div className="absolute top-1 left-1 bg-black/70 px-1.5 rounded text-[10px] font-bold border border-gray-700">
                      P{panel.id}
                    </div>
                  )}
                </div>
                {index < panelsData.length - 1 && (
                  <ArrowRight className="w-5 h-5 text-gray-600 flex-shrink-0" />
                )}
              </React.Fragment>
            ))
          )}
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-8 backdrop-blur-sm"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-full max-h-full">
            <img 
              src={`data:image/jpeg;base64,${selectedImage}`} 
              alt="Panel Full View" 
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl border border-[#333]"
            />
            <button 
              className="absolute -top-4 -right-4 w-8 h-8 bg-[#262626] text-white rounded-full flex items-center justify-center border border-[#333] hover:bg-red-500 transition-colors"
              onClick={(e) => { e.stopPropagation(); setSelectedImage(null); }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
