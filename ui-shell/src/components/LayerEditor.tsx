import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MousePointer2, Brush, Eraser, Square, Type, SquareDashed, Pipette, Plus, Copy, Trash2, Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import { Layer, LayerKind, ToolType, Transform } from '../lib/editorTypes';

interface LayerEditorProps {
  initialBaseImageBase64?: string | null;
  onCompositeUpdate?: (base64: string) => void;
  width?: number;
  height?: number;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export default function LayerEditor({ 
  initialBaseImageBase64, 
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
  
  // Refs
  const compositeCanvasRef = useRef<HTMLCanvasElement>(null);
  const interactionCanvasRef = useRef<HTMLCanvasElement>(null); // For drawing live strokes/shapes before committing
  const isDrawing = useRef(false);
  const lastPos = useRef<{x: number, y: number} | null>(null);

  // Initialize base layer if provided
  useEffect(() => {
    if (initialBaseImageBase64 && layers.length === 0) {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
        }
        const baseLayer: Layer = {
          id: generateId(),
          name: "Background",
          kind: "raster",
          visible: true,
          opacity: 1.0,
          blendMode: "source-over",
          locked: true,
          canvas: canvas,
          transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }
        };
        setLayers([baseLayer]);
        setActiveLayerId(baseLayer.id);
      };
      img.src = initialBaseImageBase64;
    } else if (layers.length === 0) {
      // Empty canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = "#121212";
        ctx.fillRect(0, 0, width, height);
      }
      const baseLayer: Layer = {
        id: generateId(),
        name: "Background",
        kind: "raster",
        visible: true,
        opacity: 1.0,
        blendMode: "source-over",
        locked: true,
        canvas: canvas,
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }
      };
      setLayers([baseLayer]);
      setActiveLayerId(baseLayer.id);
    }
  }, [initialBaseImageBase64, width, height]);

  // Render composite
  const renderComposite = useCallback(() => {
    const canvas = compositeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // Render from bottom to top (assuming index 0 is bottom)
    layers.forEach(layer => {
      if (!layer.visible) return;

      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = layer.blendMode;

      // Apply transform
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

    if (onCompositeUpdate) {
      onCompositeUpdate(canvas.toDataURL('image/png'));
    }
  }, [layers, width, height, onCompositeUpdate]);

  useEffect(() => {
    renderComposite();
  }, [layers, renderComposite]);

  // Tool Handlers
  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = interactionCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDrawing.current = true;
    const pos = getMousePos(e);
    lastPos.current = pos;
    
    if (activeTool === 'brush' || activeTool === 'eraser') {
       paintStroke(pos, pos);
    }
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || !lastPos.current) return;
    const pos = getMousePos(e);
    
    if (activeTool === 'brush' || activeTool === 'eraser') {
      paintStroke(lastPos.current, pos);
    }
    
    lastPos.current = pos;
  };

  const handlePointerUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDrawing.current = false;
    lastPos.current = null;
    
    // Trigger re-render by cloning the layers array to update state reference
    setLayers(prev => [...prev]);
  };

  const paintStroke = (start: {x: number, y: number}, end: {x: number, y: number}) => {
    if (!activeLayerId) return;
    
    const layer = layers.find(l => l.id === activeLayerId);
    if (!layer || layer.locked || layer.kind !== 'raster' || !layer.canvas) return;
    
    const ctx = layer.canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = activeTool === 'eraser' ? 'rgba(0,0,0,1)' : brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = activeTool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.stroke();
    
    // Note: We don't call setLayers on every stroke move because it's too expensive.
    // Instead we render the interaction live (or since it modifies the layer canvas directly, 
    // we can just call renderComposite manually to update the screen).
    renderComposite();
  };

  // Layer Management
  const addLayer = () => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    
    const newLayer: Layer = {
      id: generateId(),
      name: `Layer ${layers.length}`,
      kind: 'raster',
      visible: true,
      opacity: 1.0,
      blendMode: 'source-over',
      locked: false,
      canvas: canvas,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }
    };
    
    setLayers(prev => [...prev, newLayer]);
    setActiveLayerId(newLayer.id);
  };

  const deleteLayer = (id: string) => {
    if (layers.length <= 1) return; // Don't delete last layer
    setLayers(prev => prev.filter(l => l.id !== id));
    if (activeLayerId === id) {
      setActiveLayerId(layers[0].id);
    }
  };

  return (
    <div className="flex h-full w-full bg-[#111] overflow-hidden rounded-md border border-morph-border">
      
      {/* Tool Palette (Left) */}
      <div className="w-12 bg-[#1a1a1a] border-r border-morph-border flex flex-col items-center py-2 gap-2">
        <ToolButton icon={<MousePointer2 size={18}/>} active={activeTool === 'move'} onClick={() => setActiveTool('move')} title="Move (V)" />
        <ToolButton icon={<Brush size={18}/>} active={activeTool === 'brush'} onClick={() => setActiveTool('brush')} title="Brush (B)" />
        <ToolButton icon={<Eraser size={18}/>} active={activeTool === 'eraser'} onClick={() => setActiveTool('eraser')} title="Eraser (E)" />
        <ToolButton icon={<Square size={18}/>} active={activeTool === 'shape'} onClick={() => setActiveTool('shape')} title="Shape (U)" />
        <ToolButton icon={<Type size={18}/>} active={activeTool === 'text'} onClick={() => setActiveTool('text')} title="Text (T)" />
        <ToolButton icon={<SquareDashed size={18}/>} active={activeTool === 'marquee'} onClick={() => setActiveTool('marquee')} title="Marquee Selection (M)" />
        <ToolButton icon={<Pipette size={18}/>} active={activeTool === 'eyedropper'} onClick={() => setActiveTool('eyedropper')} title="Eyedropper (I)" />
        
        <div className="mt-auto flex flex-col gap-2 p-1 w-full">
           <input type="color" value={brushColor} onChange={e => setBrushColor(e.target.value)} className="w-full h-8 rounded cursor-pointer border-0 p-0" />
        </div>
      </div>

      {/* Canvas Area (Center) */}
      <div className="flex-1 relative flex items-center justify-center bg-[#0a0a0a] overflow-hidden">
        {/* Checkerboard Background for transparency */}
        <div 
          className="absolute pointer-events-none" 
          style={{
            width, height, 
            backgroundImage: 'conic-gradient(#333 90deg, #222 90deg 180deg, #333 180deg 270deg, #222 270deg)',
            backgroundSize: '20px 20px'
          }}
        />
        
        <canvas 
          ref={compositeCanvasRef} 
          width={width} 
          height={height} 
          className="absolute pointer-events-none"
        />
        
        <canvas
          ref={interactionCanvasRef}
          width={width}
          height={height}
          className="absolute cursor-crosshair"
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
          <button onClick={addLayer} className="p-1 hover:bg-[#333] rounded text-gray-400 hover:text-white"><Plus size={16}/></button>
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
                onClick={(e) => { e.stopPropagation(); const n = [...layers]; n[idx].visible = !n[idx].visible; setLayers(n); }}
              >
                {layer.visible ? <Eye size={14}/> : <EyeOff size={14}/>}
              </button>
              
              <div className="w-8 h-8 bg-black border border-[#333] rounded overflow-hidden">
                 {/* Thumbnail representation */}
              </div>
              
              <div className="flex-1 truncate text-xs text-gray-200">
                {layer.name}
              </div>
              
              <button 
                className="text-gray-500 hover:text-red-400"
                onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }}
              >
                <Trash2 size={14}/>
              </button>
            </div>
          ))}
        </div>
        
        {/* Layer Controls */}
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
             className="w-full accent-blue-500"
           />
           <select 
             className="w-full bg-[#111] border border-morph-border text-xs p-1 rounded text-gray-300"
             value={layers.find(l => l.id === activeLayerId)?.blendMode || 'source-over'}
             onChange={e => {
                const n = [...layers];
                const idx = n.findIndex(l => l.id === activeLayerId);
                if(idx > -1) { n[idx].blendMode = e.target.value as GlobalCompositeOperation; setLayers(n); }
             }}
           >
             <option value="source-over">Normal</option>
             <option value="multiply">Multiply</option>
             <option value="screen">Screen</option>
             <option value="overlay">Overlay</option>
             <option value="darken">Darken</option>
             <option value="lighten">Lighten</option>
             <option value="color-dodge">Color Dodge</option>
             <option value="color-burn">Color Burn</option>
           </select>
        </div>
      </div>
    </div>
  );
}

function ToolButton({ icon, active, onClick, title }: { icon: React.ReactNode, active: boolean, onClick: () => void, title: string }) {
  return (
    <button 
      className={`p-2 rounded-md transition-colors ${active ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-[#333] hover:text-white'}`}
      onClick={onClick}
      title={title}
    >
      {icon}
    </button>
  );
}
