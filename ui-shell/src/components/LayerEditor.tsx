import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MousePointer2, Brush, Eraser, Square, Circle, Type, SquareDashed, Pipette, Plus, Copy, Trash2, Eye, EyeOff, Lock, Unlock, Undo, Redo, Upload, Download, ImagePlus } from 'lucide-react';
import { Layer, LayerKind, ToolType, Transform, TextLayerData, ShapeLayerData } from '../lib/editorTypes';

interface LayerEditorProps {
  initialBaseImageBase64?: string | null;
  newExternalLayerBase64?: string | null;
  onExternalLayerConsumed?: () => void;
  onCompositeUpdate?: (base64: string, maskBase64: string | null) => void;
  width?: number;
  height?: number;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

const cloneLayer = (layer: Layer): Layer => {
  let newCanvas = undefined;
  if (layer.canvas) {
    newCanvas = document.createElement('canvas');
    newCanvas.width = layer.canvas.width;
    newCanvas.height = layer.canvas.height;
    const ctx = newCanvas.getContext('2d');
    if (ctx) ctx.drawImage(layer.canvas, 0, 0);
  }
  return { 
    ...layer, 
    canvas: newCanvas, 
    data: layer.data ? JSON.parse(JSON.stringify(layer.data)) : undefined, 
    transform: { ...layer.transform } 
  };
};

export default function LayerEditor({ 
  initialBaseImageBase64, 
  newExternalLayerBase64,
  onExternalLayerConsumed,
  onCompositeUpdate,
  width = 512,
  height = 512
}: LayerEditorProps) {
  
  // State
  const [layers, setLayers] = useState<Layer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolType>("brush");
  const [brushSize, setBrushSize] = useState<number>(20);
  const [brushColor, setBrushColor] = useState<string>("#ffffff");
  
  // History
  const [history, setHistory] = useState<Layer[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  
  // Selection Marquee
  const [selection, setSelection] = useState<{x: number, y: number, w: number, h: number} | null>(null);

  // Shape / Temp Drawing
  const [tempShape, setTempShape] = useState<{x: number, y: number, w: number, h: number} | null>(null);

  // Refs
  const compositeCanvasRef = useRef<HTMLCanvasElement>(null);
  const interactionCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const startPos = useRef<{x: number, y: number} | null>(null);
  const lastPos = useRef<{x: number, y: number} | null>(null);
  const dragStartTransform = useRef<{x: number, y: number} | null>(null);
  const hasUnsavedChanges = useRef(false);

  const saveHistory = useCallback((currentLayers: Layer[]) => {
    const stateSnapshot = currentLayers.map(cloneLayer);
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(stateSnapshot);
      return newHistory;
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  // Initialize
  useEffect(() => {
    if (layers.length === 0) {
      const initLayers = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (initialBaseImageBase64 && ctx) {
          const img = new Image();
          img.crossOrigin = "anonymous";
          await new Promise(r => { img.onload = r; img.src = initialBaseImageBase64; });
          ctx.drawImage(img, 0, 0, width, height);
        } else if (ctx) {
          ctx.fillStyle = "#121212";
          ctx.fillRect(0, 0, width, height);
        }
        
        const baseLayer: Layer = {
          id: generateId(), name: "Background", kind: "raster", visible: true, opacity: 1.0, 
          blendMode: "source-over", locked: true, canvas: canvas, transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }
        };
        setLayers([baseLayer]);
        setActiveLayerId(baseLayer.id);
        saveHistory([baseLayer]);
      };
      initLayers();
    }
  }, [initialBaseImageBase64, width, height]);

  // Prevent infinite loops from callback props
  const onCompositeUpdateRef = useRef(onCompositeUpdate);
  const onExternalLayerConsumedRef = useRef(onExternalLayerConsumed);

  useEffect(() => {
    onCompositeUpdateRef.current = onCompositeUpdate;
    onExternalLayerConsumedRef.current = onExternalLayerConsumed;
  }, [onCompositeUpdate, onExternalLayerConsumed]);

  // Inject external AI layer
  useEffect(() => {
    if (newExternalLayerBase64) {
      const injectLayer = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const img = new Image();
          img.crossOrigin = "anonymous";
          await new Promise(r => { img.onload = r; img.src = newExternalLayerBase64; });
          ctx.drawImage(img, 0, 0, width, height);
        }
        
        const newLayer: Layer = {
          id: generateId(), name: `AI Output ${Math.floor(Math.random()*1000)}`, kind: "raster", visible: true, opacity: 1.0, 
          blendMode: "source-over", locked: false, canvas: canvas, transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }
        };
        
        let updatedLayers: Layer[] = [];
        setLayers(prev => {
          updatedLayers = [...prev, newLayer];
          return updatedLayers;
        });
        
        // Push side effects outside the state updater
        setTimeout(() => {
           setActiveLayerId(newLayer.id);
           saveHistory(updatedLayers);
           if (onExternalLayerConsumedRef.current) {
             onExternalLayerConsumedRef.current();
           }
        }, 0);
      };
      injectLayer();
    }
  }, [newExternalLayerBase64, width, height]);

  // Expose Composite and Mask
  const pushUpdateToBackend = useCallback(() => {
    if (!compositeCanvasRef.current) return;
    const base64 = compositeCanvasRef.current.toDataURL('image/png');
    
    let maskBase64 = null;
    if (selection) {
      const mCanvas = document.createElement('canvas');
      mCanvas.width = width;
      mCanvas.height = height;
      const mCtx = mCanvas.getContext('2d');
      if (mCtx) {
        mCtx.fillStyle = "black";
        mCtx.fillRect(0, 0, width, height);
        mCtx.fillStyle = "white";
        mCtx.fillRect(selection.x, selection.y, selection.w, selection.h);
        maskBase64 = mCanvas.toDataURL('image/png');
      }
    }
    
    if (onCompositeUpdateRef.current) {
      onCompositeUpdateRef.current(base64, maskBase64);
    }
  }, [selection, width, height]);

  // Render composite
  const renderComposite = useCallback(() => {
    const canvas = compositeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // Render layers
    layers.forEach(layer => {
      if (!layer.visible) return;
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = layer.blendMode;

      ctx.translate(layer.transform.x + width/2, layer.transform.y + height/2);
      ctx.rotate(layer.transform.rotation);
      ctx.scale(layer.transform.scaleX, layer.transform.scaleY);
      ctx.translate(-width/2, -height/2);

      if (layer.kind === 'raster' && layer.canvas) {
        ctx.drawImage(layer.canvas, 0, 0);
      } else if (layer.kind === 'text' && layer.data && 'text' in layer.data) {
        ctx.font = `${layer.data.fontWeight} ${layer.data.fontSize}px ${layer.data.fontFamily}`;
        ctx.fillStyle = layer.data.color;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(layer.data.text, width/2, height/2);
      } else if (layer.kind === 'shape' && layer.data && 'shapeType' in layer.data) {
        ctx.fillStyle = layer.data.fill;
        ctx.strokeStyle = layer.data.stroke;
        ctx.lineWidth = layer.data.strokeWidth;
        ctx.beginPath();
        if (layer.data.shapeType === 'rectangle') {
          ctx.rect(width/2 - layer.data.width/2, height/2 - layer.data.height/2, layer.data.width, layer.data.height);
        } else if (layer.data.shapeType === 'ellipse') {
          ctx.ellipse(width/2, height/2, layer.data.width/2, layer.data.height/2, 0, 0, Math.PI * 2);
        }
        if (layer.data.fill !== 'transparent') ctx.fill();
        if (layer.data.strokeWidth > 0) ctx.stroke();
      }
      ctx.restore();
    });

    // Render Interaction Extras (Selection, Temp Shapes)
    const intCanvas = interactionCanvasRef.current;
    if (intCanvas) {
      const intCtx = intCanvas.getContext('2d');
      if (intCtx) {
        intCtx.clearRect(0, 0, width, height);
        
        // Draw selection marquee
        if (selection) {
          intCtx.setLineDash([5, 5]);
          intCtx.strokeStyle = 'white';
          intCtx.lineWidth = 1;
          intCtx.strokeRect(selection.x, selection.y, selection.w, selection.h);
          intCtx.strokeStyle = 'black';
          intCtx.strokeRect(selection.x - 1, selection.y - 1, selection.w + 2, selection.h + 2);
          intCtx.setLineDash([]);
        }

        // Draw temp shape
        if (tempShape) {
          intCtx.fillStyle = brushColor;
          intCtx.fillRect(tempShape.x, tempShape.y, tempShape.w, tempShape.h);
        }
      }
    }
  }, [layers, width, height, selection, tempShape, brushColor]);

  useEffect(() => {
    renderComposite();
    pushUpdateToBackend();
  }, [layers, selection, tempShape, renderComposite, pushUpdateToBackend]);

  // Event Handlers
  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = interactionCanvasRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (width / rect.width),
      y: (e.clientY - rect.top) * (height / rect.height)
    };
  };

  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    isDrawing.current = true;
    startPos.current = pos;
    lastPos.current = pos;
    hasUnsavedChanges.current = false;

    if (activeTool === 'eyedropper') {
      const ctx = compositeCanvasRef.current?.getContext('2d');
      if (ctx) {
        const pixel = ctx.getImageData(pos.x, pos.y, 1, 1).data;
        const hex = "#" + [pixel[0], pixel[1], pixel[2]].map(x => x.toString(16).padStart(2, '0')).join('');
        setBrushColor(hex);
      }
      isDrawing.current = false;
      return;
    }

    if (activeTool === 'text') {
      const text = prompt("Enter text:");
      if (text) {
        const newLayer: Layer = {
          id: generateId(), name: `Text: ${text.substring(0, 10)}`, kind: 'text', visible: true, opacity: 1.0, blendMode: 'source-over', locked: false,
          transform: { x: pos.x - width/2, y: pos.y - height/2, scaleX: 1, scaleY: 1, rotation: 0 },
          data: { text, fontFamily: 'sans-serif', fontSize: brushSize * 2, color: brushColor, fontWeight: 'bold' } as TextLayerData
        };
        const newLayers = [...layers, newLayer];
        setLayers(newLayers);
        setActiveLayerId(newLayer.id);
        saveHistory(newLayers);
      }
      isDrawing.current = false;
      return;
    }

    if (activeTool === 'move') {
      const layer = layers.find(l => l.id === activeLayerId);
      if (layer) dragStartTransform.current = { ...layer.transform };
    }

    if (activeTool === 'brush' || activeTool === 'eraser') {
      paintStroke(pos, pos);
    }
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || !lastPos.current || !startPos.current) return;
    const pos = getMousePos(e);

    if (activeTool === 'brush' || activeTool === 'eraser') {
      paintStroke(lastPos.current, pos);
    } else if (activeTool === 'move' && dragStartTransform.current) {
      const dx = pos.x - startPos.current.x;
      const dy = pos.y - startPos.current.y;
      setLayers(prev => prev.map(l => l.id === activeLayerId && !l.locked ? 
        { ...l, transform: { ...l.transform, x: dragStartTransform.current!.x + dx, y: dragStartTransform.current!.y + dy } } : l
      ));
      hasUnsavedChanges.current = true;
    } else if (activeTool === 'marquee' || activeTool === 'shape') {
      const x = Math.min(startPos.current.x, pos.x);
      const y = Math.min(startPos.current.y, pos.y);
      const w = Math.abs(pos.x - startPos.current.x);
      const h = Math.abs(pos.y - startPos.current.y);
      
      if (activeTool === 'marquee') setSelection({x, y, w, h});
      if (activeTool === 'shape') setTempShape({x, y, w, h});
    }

    lastPos.current = pos;
  };

  const handlePointerUp = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (activeTool === 'shape' && tempShape && tempShape.w > 5) {
      const newLayer: Layer = {
        id: generateId(), name: `Rectangle`, kind: 'shape', visible: true, opacity: 1.0, blendMode: 'source-over', locked: false,
        transform: { x: tempShape.x + tempShape.w/2 - width/2, y: tempShape.y + tempShape.h/2 - height/2, scaleX: 1, scaleY: 1, rotation: 0 },
        data: { shapeType: 'rectangle', width: tempShape.w, height: tempShape.h, fill: brushColor, stroke: 'transparent', strokeWidth: 0 } as ShapeLayerData
      };
      const newLayers = [...layers, newLayer];
      setLayers(newLayers);
      setActiveLayerId(newLayer.id);
      saveHistory(newLayers);
      setTempShape(null);
    } else if (hasUnsavedChanges.current) {
      saveHistory(layers);
      hasUnsavedChanges.current = false;
    }
  };

  const paintStroke = (start: {x: number, y: number}, end: {x: number, y: number}) => {
    if (!activeLayerId) return;
    const layer = layers.find(l => l.id === activeLayerId);
    if (!layer || layer.locked || layer.kind !== 'raster' || !layer.canvas) return;
    
    const ctx = layer.canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.save();
    // Reverse layer transform to draw correctly on canvas space
    ctx.translate(width/2, height/2);
    ctx.rotate(-layer.transform.rotation);
    ctx.scale(1/layer.transform.scaleX, 1/layer.transform.scaleY);
    ctx.translate(-width/2 - layer.transform.x, -height/2 - layer.transform.y);

    if (selection) {
      ctx.beginPath();
      ctx.rect(selection.x, selection.y, selection.w, selection.h);
      ctx.clip();
    }

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = activeTool === 'eraser' ? 'rgba(0,0,0,1)' : brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = activeTool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.stroke();
    ctx.restore();
    
    renderComposite();
    hasUnsavedChanges.current = true;
  };

  // Layer Commands
  const addLayer = () => {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const newLayer: Layer = { id: generateId(), name: `Layer ${layers.length}`, kind: 'raster', visible: true, opacity: 1.0, blendMode: 'source-over', locked: false, canvas, transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 } };
    const n = [...layers, newLayer];
    setLayers(n);
    setActiveLayerId(newLayer.id);
    saveHistory(n);
  };

  const handleAddImageLayer = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const src = event.target?.result as string;
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise(r => { img.onload = r; img.src = src; });
      
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(img, 0, 0, width, height); // Scale image to canvas size
      
      const newLayer: Layer = { 
        id: generateId(), 
        name: file.name, 
        kind: 'raster', 
        visible: true, 
        opacity: 1.0, 
        blendMode: 'source-over', 
        locked: false, 
        canvas, 
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 } 
      };
      
      const n = [...layers, newLayer];
      setLayers(n);
      setActiveLayerId(newLayer.id);
      saveHistory(n);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const deleteLayer = (id: string) => {
    if (layers.length <= 1) return;
    const n = layers.filter(l => l.id !== id);
    setLayers(n);
    if (activeLayerId === id) setActiveLayerId(n[0].id);
    saveHistory(n);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1].map(cloneLayer);
      setLayers(prevState);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1].map(cloneLayer);
      setLayers(nextState);
      setHistoryIndex(historyIndex + 1);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) redo(); else undo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const handleUploadProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.layers) {
          const restoredLayers = await Promise.all(data.layers.map(async (l: any) => {
            if (l.kind === 'raster' && l.canvasDataUrl) {
              const img = new Image();
          img.crossOrigin = "anonymous";
              await new Promise(r => { img.onload = r; img.src = l.canvasDataUrl; });
              const canvas = document.createElement('canvas');
              canvas.width = width; canvas.height = height;
              canvas.getContext('2d')?.drawImage(img, 0, 0);
              l.canvas = canvas;
            }
            delete l.canvasDataUrl;
            return l;
          }));
          setLayers(restoredLayers);
          saveHistory(restoredLayers);
        }
      } catch (err) {
        console.error("Failed to load project", err);
      }
    };
    reader.readAsText(file);
  };

  const downloadProject = () => {
    const serialized = {
      version: 1,
      width, height,
      layers: layers.map(l => ({
        ...l,
        canvas: undefined, // strip HTML element
        canvasDataUrl: l.kind === 'raster' && l.canvas ? l.canvas.toDataURL() : null
      }))
    };
    const blob = new Blob([JSON.stringify(serialized)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "morphos-project.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#111] overflow-hidden rounded-md border border-morph-border">
      {/* Top Toolbar */}
      <div className="h-10 bg-[#1a1a1a] border-b border-morph-border flex items-center px-2 gap-2 text-xs">
         <button onClick={undo} disabled={historyIndex <= 0} className="p-1.5 hover:bg-[#333] rounded disabled:opacity-50"><Undo size={14}/></button>
         <button onClick={redo} disabled={historyIndex >= history.length - 1} className="p-1.5 hover:bg-[#333] rounded disabled:opacity-50"><Redo size={14}/></button>
         <div className="w-px h-4 bg-[#333] mx-1"></div>
         {selection && (
           <button onClick={() => setSelection(null)} className="px-2 py-1 bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded">Clear Selection</button>
         )}
         <div className="ml-auto flex gap-2">
           <input type="file" id="project-upload" accept=".json" hidden onChange={handleUploadProject} />
           <label htmlFor="project-upload" className="flex items-center gap-1 cursor-pointer p-1.5 hover:bg-[#333] rounded text-gray-300"><Upload size={14}/> Load</label>
           <button onClick={downloadProject} className="flex items-center gap-1 p-1.5 hover:bg-[#333] rounded text-gray-300"><Download size={14}/> Save</button>
         </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Tool Palette (Left) */}
        <div className="w-12 bg-[#1a1a1a] border-r border-morph-border flex flex-col items-center py-2 gap-2">
          <ToolButton icon={<MousePointer2 size={18}/>} active={activeTool === 'move'} onClick={() => setActiveTool('move')} title="Move (V)" />
          <ToolButton icon={<SquareDashed size={18}/>} active={activeTool === 'marquee'} onClick={() => setActiveTool('marquee')} title="Marquee Selection (M)" />
          <ToolButton icon={<Brush size={18}/>} active={activeTool === 'brush'} onClick={() => setActiveTool('brush')} title="Brush (B)" />
          <ToolButton icon={<Eraser size={18}/>} active={activeTool === 'eraser'} onClick={() => setActiveTool('eraser')} title="Eraser (E)" />
          <ToolButton icon={<Square size={18}/>} active={activeTool === 'shape'} onClick={() => setActiveTool('shape')} title="Shape (U)" />
          <ToolButton icon={<Type size={18}/>} active={activeTool === 'text'} onClick={() => setActiveTool('text')} title="Text (T)" />
          <ToolButton icon={<Pipette size={18}/>} active={activeTool === 'eyedropper'} onClick={() => setActiveTool('eyedropper')} title="Eyedropper (I)" />
          
          <div className="mt-auto flex flex-col gap-2 p-1 w-full items-center">
             <input type="range" min="1" max="100" value={brushSize} onChange={e => setBrushSize(parseInt(e.target.value))} className="w-10 accent-blue-500" style={{ transform: 'rotate(270deg)', marginTop: '20px', marginBottom: '20px' }} title="Brush Size"/>
             <input type="color" value={brushColor} onChange={e => setBrushColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 p-0" title="Brush Color"/>
          </div>
        </div>

        {/* Canvas Area (Center) */}
        <div className="flex-1 relative flex items-center justify-center bg-[#0a0a0a] overflow-hidden">
          <div 
            className="absolute pointer-events-none" 
            style={{ width, height, backgroundImage: 'conic-gradient(#333 90deg, #222 90deg 180deg, #333 180deg 270deg, #222 270deg)', backgroundSize: '20px 20px' }}
          />
          <canvas ref={compositeCanvasRef} width={width} height={height} className="absolute pointer-events-none shadow-lg shadow-black/50" />
          <canvas
            ref={interactionCanvasRef}
            width={width}
            height={height}
            className={`absolute ${activeTool === 'move' ? 'cursor-move' : activeTool === 'text' ? 'cursor-text' : 'cursor-crosshair'}`}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
          />
        </div>

        {/* Layers Panel (Right) */}
        <div className="w-64 bg-[#1a1a1a] border-l border-morph-border flex flex-col">
          <div className="p-3 border-b border-morph-border flex justify-between items-center">
            <h3 className="text-xs font-semibold text-gray-300 uppercase">Layers</h3>
            <div className="flex gap-1">
              <input type="file" id="image-layer-upload" accept="image/*" hidden onChange={handleAddImageLayer} />
              <label htmlFor="image-layer-upload" className="p-1 hover:bg-[#333] rounded text-gray-400 hover:text-white cursor-pointer" title="Add Image Layer"><ImagePlus size={16}/></label>
              <button onClick={addLayer} className="p-1 hover:bg-[#333] rounded text-gray-400 hover:text-white" title="Add Blank Layer"><Plus size={16}/></button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 flex flex-col-reverse gap-1">
            {layers.map((layer, idx) => (
              <div 
                key={layer.id} 
                className={`flex items-center gap-2 p-2 rounded cursor-pointer ${activeLayerId === layer.id ? 'bg-blue-900/40 border border-blue-900/60' : 'hover:bg-[#252525] border border-transparent'}`}
                onClick={() => setActiveLayerId(layer.id)}
              >
                <button 
                  className="text-gray-400 hover:text-white"
                  onClick={(e) => { e.stopPropagation(); const n = [...layers]; n[idx].visible = !n[idx].visible; setLayers(n); saveHistory(n); }}
                >
                  {layer.visible ? <Eye size={14}/> : <EyeOff size={14}/>}
                </button>
                <button 
                  className="text-gray-400 hover:text-white"
                  onClick={(e) => { e.stopPropagation(); const n = [...layers]; n[idx].locked = !n[idx].locked; setLayers(n); saveHistory(n); }}
                >
                  {layer.locked ? <Lock size={12}/> : <Unlock size={12}/>}
                </button>
                
                <div className="flex-1 truncate text-xs text-gray-200">
                  {layer.name} <span className="text-[9px] text-gray-500">[{layer.kind}]</span>
                </div>
                
                <button className="text-gray-500 hover:text-red-400" onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }}>
                  <Trash2 size={14}/>
                </button>
              </div>
            ))}
          </div>
          
          <div className="p-3 border-t border-morph-border flex flex-col gap-2">
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>Opacity</span>
              <span>{Math.round((layers.find(l => l.id === activeLayerId)?.opacity || 1) * 100)}%</span>
            </div>
            <input 
              type="range" min="0" max="1" step="0.01" 
              value={layers.find(l => l.id === activeLayerId)?.opacity || 1}
              onChange={e => {
                  const n = [...layers];
                  const idx = n.findIndex(l => l.id === activeLayerId);
                  if(idx > -1) { n[idx].opacity = parseFloat(e.target.value); setLayers(n); }
              }}
              onMouseUp={() => saveHistory(layers)}
              className="w-full accent-blue-500"
            />
            <select 
              className="w-full bg-[#111] border border-morph-border text-xs p-1 rounded text-gray-300"
              value={layers.find(l => l.id === activeLayerId)?.blendMode || 'source-over'}
              onChange={e => {
                  const n = [...layers];
                  const idx = n.findIndex(l => l.id === activeLayerId);
                  if(idx > -1) { n[idx].blendMode = e.target.value as GlobalCompositeOperation; setLayers(n); saveHistory(n); }
              }}
            >
              <option value="source-over">Normal</option>
              <option value="multiply">Multiply</option>
              <option value="screen">Screen</option>
              <option value="overlay">Overlay</option>
              <option value="darken">Darken</option>
              <option value="lighten">Lighten</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolButton({ icon, active, onClick, title }: { icon: React.ReactNode, active: boolean, onClick: () => void, title: string }) {
  return (
    <button 
      className={`p-2 rounded-md transition-colors ${active ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-[#333] hover:text-white'}`}
      onClick={onClick} title={title}
    >
      {icon}
    </button>
  );
}
