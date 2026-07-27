import React, { useState, useRef } from 'react';
import { ArrowLeft, Upload, ArrowRight, Loader2, Maximize, Sliders } from 'lucide-react';

interface MangaWorkspaceProps {
  onBack: () => void;
}

export default function MangaWorkspace({ onBack }: MangaWorkspaceProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [readingFlow, setReadingFlow] = useState<'rtl' | 'ltr'>('rtl');
  const [parallaxDepth, setParallaxDepth] = useState<number>(0.5);
  const [isExtracting, setIsExtracting] = useState(false);
  const [panels, setPanels] = useState<any[]>([]);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImageFile = (file: File) => {
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    setPanels([]);
    
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
    setPanels([]);
    
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
        setPanels(data.panels || []);
      } else {
        console.error("Backend error:", data.detail);
      }
    } catch (err) {
      console.error("Network error:", err);
    } finally {
      setIsExtracting(false);
    }
  };

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
                onClick={() => setImageSrc(null)}
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
            {imageSrc ? (
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

        {/* Control Panel (Top Right) */}
        <div className="w-full md:w-80 border-l border-morph-border bg-morph-card flex-shrink-0 flex flex-col overflow-y-auto">
          <div className="p-6">
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

              {/* Parallax Depth */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm text-gray-400">Parallax Depth Strength</label>
                  <span className="text-xs text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">{parallaxDepth.toFixed(2)}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05" 
                  value={parallaxDepth}
                  onChange={(e) => setParallaxDepth(parseFloat(e.target.value))}
                  className="w-full accent-purple-500"
                />
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
                    Initialize Panel Extraction
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Strip (Bottom Full Width) */}
      <div className="h-48 border-t border-morph-border bg-[#0a0a0a] flex-shrink-0 flex flex-col">
        <div className="px-6 py-2 border-b border-morph-border flex items-center justify-between bg-morph-card/30">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Motion Timeline</h2>
          <div className="text-xs text-gray-500">
            {panels.length > 0 ? `${panels.length} Panels Extracted` : 'Awaiting Extraction'}
          </div>
        </div>
        
        <div className="flex-1 overflow-x-auto p-4 flex items-center gap-4 min-w-min">
          {panels.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm italic">
              Upload an image and initialize extraction to populate timeline
            </div>
          ) : (
            panels.map((panelObj, index) => (
              <React.Fragment key={panelObj.panel_id || index}>
                <div className="w-32 h-24 bg-morph-card border border-morph-border rounded-lg flex flex-col items-center justify-center flex-shrink-0 hover:border-purple-500/50 transition-colors cursor-pointer group">
                  <div className="w-8 h-8 rounded-full bg-black/50 border border-gray-700 flex items-center justify-center mb-2 group-hover:bg-purple-500/20 group-hover:border-purple-500 group-hover:text-purple-400 transition-colors">
                    {panelObj.panel_id || index + 1}
                  </div>
                  <span className="text-xs text-gray-400">Panel {panelObj.panel_id || index + 1}</span>
                </div>
                {index < panels.length - 1 && (
                  <ArrowRight className="w-5 h-5 text-gray-600 flex-shrink-0" />
                )}
              </React.Fragment>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
