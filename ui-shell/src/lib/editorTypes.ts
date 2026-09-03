export type LayerKind = "raster" | "text" | "shape" | "adjustment";

export interface Transform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export interface TextLayerData {
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  fontWeight: string;
}

export interface ShapeLayerData {
  shapeType: "rectangle" | "ellipse";
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export interface Layer {
  id: string;
  name: string;
  kind: LayerKind;
  visible: boolean;
  opacity: number; // 0.0 to 1.0
  blendMode: GlobalCompositeOperation;
  locked: boolean;
  
  // For raster layers, this holds the pixel data. 
  // It could be a base64 Data URL or an offscreen canvas. 
  // Since we need to serialize this to JSON easily, storing as a base64 string or an HTMLCanvasElement is tricky.
  // We will store it as an HTMLCanvasElement for fast real-time compositing, 
  // but we serialize it to base64 when saving.
  canvas?: HTMLCanvasElement;
  
  // For text and shape layers
  data?: TextLayerData | ShapeLayerData;
  
  transform: Transform;
}

export type ToolType = "move" | "brush" | "eraser" | "shape" | "text" | "marquee" | "eyedropper" | null;
