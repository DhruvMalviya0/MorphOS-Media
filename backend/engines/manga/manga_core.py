import os
import time
import base64
import cv2
import numpy as np
import urllib.request
from ultralytics import YOLO, SAM
from transformers import pipeline
import torch
import moderngl
import pyrr

class MorphMangaEngine:
    def __init__(self):
        print("[Manga Engine] Initialized MorphMangaEngine pipeline orchestrator")
        
        # Dynamically resolve the absolute path to the backend/models directory
        # __file__ is backend/engines/manga/manga_core.py
        current_dir = os.path.dirname(os.path.abspath(__file__))
        
        # Go up two levels to reach the 'backend' folder, then into 'models'
        model_path = os.path.abspath(os.path.join(current_dir, "../../models/comic_yolov8.pt"))
        
        print(f"[Manga Engine] Attempting to load YOLO model from: {model_path}")
        
        try:
            self.yolo = YOLO(model_path)
            print("[Manga Engine] Successfully loaded custom manga weights!")
        except Exception as e:
            print(f"[Manga Engine] WARNING: Failed to load custom weights. Error: {e}")
            print("[Manga Engine] Falling back to base COCO model (yolov8n.pt)...")
            self.yolo = YOLO('yolov8n.pt')

        print("[Manga Engine] Initializing Depth Estimation Model...")
        try:
            # Using a fast, lightweight depth model suitable for local inference
            self.depth_estimator = pipeline(task="depth-estimation", model="Intel/dpt-large")
            print("[Manga Engine] Depth model loaded successfully.")
        except Exception as e:
            print(f"[Manga Engine] ERROR loading depth model: {e}")
            self.depth_estimator = None

        print("[Manga Engine] Initializing Segment Anything (SAM)...")
        try:
            self.sam_predictor = SAM('sam_b.pt')
            print("[Manga Engine] SAM model loaded successfully.")
        except Exception as e:
            print(f"[Manga Engine] ERROR loading SAM model: {e}")
            self.sam_predictor = None

    def extract_panels(self, base64_image: str, reading_direction: str = "rtl"):
        """Extract panels using OpenCV contour detection as fallback"""
        print(f"[Manga Engine] Running OpenCV panel extraction (Flow: {reading_direction})...")
        
        # 1. Decode base64 to OpenCV image
        if "," in base64_image:
            base64_data = base64_image.split(",")[1]
        else:
            base64_data = base64_image
            
        img_data = base64.b64decode(base64_data)
        np_arr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise ValueError("Failed to decode image from base64")

        # 2. Run AI Inference with YOLO
        print("[Manga Engine] Running YOLO object detection...")
        results_yolo = self.yolo(img)
        
        # 3. Extract bounding boxes and filter
        boxes_data = results_yolo[0].boxes
        
        # Debug: Print the dictionary of classes this model knows
        print(f"\n--- YOLO DEBUG INFO ---")
        print(f"Model Classes: {self.yolo.names}")
        print(f"Total objects found: {len(boxes_data)}")
        
        valid_boxes = []
        
        for i in range(len(boxes_data)):
            # Get the class name of the detected object
            class_id = int(boxes_data.cls[i].item())
            class_name = self.yolo.names[class_id].lower()
            
            # Extract coordinates
            coords = boxes_data.xyxy[i].cpu().numpy()
            x1, y1, x2, y2 = map(int, coords)
            
            # CRITICAL: The Manga109 model uses 'frame', not 'panel'!
            if 'frame' in class_name or 'panel' in class_name:
                valid_boxes.append([x1, y1, x2, y2])
                print(f"KEEPING: {class_name}")
            else:
                print(f"REJECTING: {class_name}")
                
        print(f"Total valid frames kept: {len(valid_boxes)}\n-----------------------\n")
                
        # CRITICAL FAILSAFE: If no panels passed the filters (or no detections), return the entire image as one panel
        if len(valid_boxes) == 0:
            print("FAILSAFE TRIGGERED: No frames found. Returning full page.")
            valid_boxes.append([0, 0, img.shape[1], img.shape[0]])
                
        # 7. Reading Flow Sorting Logic
        # Group by rows based on y-coordinate proximity (e.g. within 50 pixels)
        valid_boxes.sort(key=lambda b: b[1]) # Sort top-to-bottom primarily
        
        rows = []
        current_row = []
        for box in valid_boxes:
            if not current_row:
                current_row.append(box)
            else:
                # If y1 is within 50px of the current row's average y1, add to row
                avg_y = sum(b[1] for b in current_row) / len(current_row)
                if abs(box[1] - avg_y) < 50:
                    current_row.append(box)
                else:
                    rows.append(current_row)
                    current_row = [box]
        if current_row:
            rows.append(current_row)
            
        sorted_boxes = []
        for row in rows:
            if reading_direction == "rtl":
                # Right-to-Left: sort x1 descending
                row.sort(key=lambda b: b[0], reverse=True)
            else:
                # Left-to-Right: sort x1 ascending
                row.sort(key=lambda b: b[0])
            sorted_boxes.extend(row)
            
        # 8. Crop and format response
        results = []
        for i, box in enumerate(sorted_boxes):
            x1, y1, x2, y2 = box
            
            # Crop image
            cropped_img = img[y1:y2, x1:x2]
            
            # Encode cropped image back to base64
            _, buffer = cv2.imencode('.jpg', cropped_img)
            cropped_b64 = base64.b64encode(buffer).decode('utf-8')
            
            results.append({
                "panel_id": i + 1,
                "bbox": [x1, y1, x2, y2],
                "cropped_image_base64": f"data:image/jpeg;base64,{cropped_b64}"
            })
            
        print(f"[Manga Engine] Found {len(results)} valid panels.")
        return results

    def _dummy_sam_depth_parallax(self, panels):
        """Phase 3 Dummy: Simulate Depth Anything and SAM for parallax"""
        print(f"[Manga Engine] [Step 2] Applying Depth/SAM masking to {len(panels)} panels...")
        time.sleep(0.5)
        return ["parallax_frame_1.mp4", "parallax_frame_2.mp4", "parallax_frame_3.mp4", "parallax_frame_4.mp4"]

    def _dummy_audio_generation(self, script_text: str = ""):
        """Phase 3 Dummy: Simulate MusicGen SFX/Audio track generation"""
        print("[Manga Engine] [Step 3] Synthesizing Audio Track via MusicGen...")
        time.sleep(0.5)
        return "manga_audio_mix.wav"

    def _dummy_compile_video(self, parallax_frames, audio_track):
        """Phase 3 Dummy: Simulate Final Compilation (e.g. via moviepy/ffmpeg)"""
        print("[Manga Engine] [Step 4] Compiling final .mp4...")
        time.sleep(0.5)
        return "final_motion_comic_simulated.mp4"

    def generate_motion_comic(self, panels_config: list):
        """
        Phase 3, Step 2: 2.5D Ambient Render Pipeline.
        Accepts a list of configured panels (with specific depth and sfx settings)
        and orchestrates Layer Separation (SAM, DPT, Inpaint) and GLSL Shaders.
        """
        print("\n--- Starting 2.5D Ambient Render Pipeline ---")
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        output_dir = os.path.join(base_dir, "ui-shell", "public", "generated_outputs")
        os.makedirs(output_dir, exist_ok=True)
        filepath = os.path.join(output_dir, "final_motion_comic.mp4")
        
        width, height = 1280, 720
        fps = 30.0
        
        # Use imageio to write browser-compatible H.264 mp4
        import imageio
        writer = imageio.get_writer(filepath, fps=fps, codec='libx264', macro_block_size=None)
        
        # 1. Setup ModernGL Context & Shaders
        try:
            ctx = moderngl.create_standalone_context()
            shader_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shaders")
            with open(os.path.join(shader_dir, "vertex.glsl"), "r") as f:
                vertex_shader = f.read()
            with open(os.path.join(shader_dir, "fragment.glsl"), "r") as f:
                fragment_shader = f.read()
            prog = ctx.program(vertex_shader=vertex_shader, fragment_shader=fragment_shader)
            
            # Setup Mesh Grid (High Density)
            grid_x, grid_y = 100, 100
            x = np.linspace(-1, 1, grid_x)
            y = np.linspace(-1, 1, grid_y)
            X, Y = np.meshgrid(x, y)
            U = (X + 1) / 2
            V = 1 - (Y + 1) / 2 # Invert V for OpenGL textures
            
            vertices = np.stack([X, Y, U, V], axis=-1).reshape(-1, 4).astype('f4')
            
            indices = []
            for i in range(grid_y - 1):
                for j in range(grid_x - 1):
                    p0 = i * grid_x + j
                    p1 = p0 + 1
                    p2 = (i + 1) * grid_x + j
                    p3 = p2 + 1
                    indices.extend([p0, p2, p1, p1, p2, p3])
            index_buffer = ctx.buffer(np.array(indices, dtype='i4'))
            vbo = ctx.buffer(vertices)
            vao = ctx.vertex_array(prog, [(vbo, '2f 2f', 'in_vert', 'in_uv')], index_buffer)
            
            fbo = ctx.framebuffer(
                color_attachments=[ctx.texture((width, height), 3)]
            )
            ctx.enable(moderngl.DEPTH_TEST)
        except Exception as e:
            print(f"[Manga Engine] FATAL OpenGL Error: {e}")
            return {"status": "ERROR", "detail": str(e)}

        for panel in panels_config:
            panel_id = panel.get("id")
            b64_str = panel.get("image", "")
            if b64_str.startswith("data:image"):
                b64_str = b64_str.split(",")[1]
            
            try:
                img_data = base64.b64decode(b64_str)
                np_arr = np.frombuffer(img_data, np.uint8)
                img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
                if img is None: continue
                
                h, w = img.shape[:2]
                scale = min(width/w, height/h)
                nw, nh = int(w * scale), int(h * scale)
                resized = cv2.resize(img, (nw, nh))
                
                canvas = np.zeros((height, width, 3), dtype=np.uint8)
                x_offset = (width - nw) // 2
                y_offset = (height - nh) // 2
                canvas[y_offset:y_offset+nh, x_offset:x_offset+nw] = resized
                
                canvas_rgb = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)
                
                # Phase 1: Layer Separation & Analysis
                fg_mask = np.zeros((height, width), dtype=np.uint8)
                depth_map_np = np.zeros((height, width), dtype=np.float32)
                bg_rgb = canvas_rgb.copy()
                
                base_duration = 3.0
                extra_duration = 0.0
                
                try:
                    # YOLO Analysis
                    results = self.yolo(canvas)
                    boxes = results[0].boxes
                    
                    target_bboxes = []
                    for i in range(len(boxes)):
                        cls_name = self.yolo.names[int(boxes.cls[i].item())].lower()
                        if 'text' in cls_name:
                            extra_duration += 1.5
                        elif any(k in cls_name for k in ['face', 'body', 'person', 'character', 'frame', 'panel']):
                            x1, y1, x2, y2 = map(int, boxes.xyxy[i].cpu().numpy())
                            # Keep realistic character boxes
                            if 'frame' not in cls_name and 'panel' not in cls_name:
                                target_bboxes.append([x1, y1, x2, y2])
                    
                    # SAM Foreground Extraction
                    if target_bboxes and self.sam_predictor:
                        print(f" -> Panel {panel_id}: Prompting SAM with {len(target_bboxes)} character boxes...")
                        sam_results = self.sam_predictor(canvas, bboxes=target_bboxes)
                        if sam_results and len(sam_results) > 0 and sam_results[0].masks is not None:
                            # Combine all masks
                            masks = sam_results[0].masks.data.cpu().numpy()
                            for m in masks:
                                fg_mask = np.maximum(fg_mask, (cv2.resize(m.astype(np.uint8), (width, height)) * 255).astype(np.uint8))
                    
                    # Background Inpainting (Heal background behind mask)
                    if np.max(fg_mask) > 0:
                        print(f" -> Panel {panel_id}: Inpainting background...")
                        bg_canvas = cv2.inpaint(canvas, fg_mask, 5, cv2.INPAINT_TELEA)
                        bg_rgb = cv2.cvtColor(bg_canvas, cv2.COLOR_BGR2RGB)
                    
                    # Depth Map Generation
                    if self.depth_estimator:
                        from PIL import Image
                        pil_img = Image.fromarray(canvas_rgb)
                        depth_res = self.depth_estimator(pil_img)
                        depth_img = np.array(depth_res['depth'].resize((width, height)))
                        # Normalize depth to 0.0-1.0
                        depth_map_np = (depth_img - np.min(depth_img)) / (np.max(depth_img) - np.min(depth_img) + 1e-5)
                        depth_map_np = depth_map_np.astype('f4')
                except Exception as ai_err:
                    print(f"[Manga Engine] Warning: AI processing failed for panel {panel_id}: {ai_err}")
                    
                total_duration = min(base_duration + extra_duration, 10.0)
                frames_to_write = int(fps * total_duration)
                
                # Textures for ModernGL
                tex_bg = ctx.texture((width, height), 3, bg_rgb.tobytes())
                tex_fg = ctx.texture((width, height), 3, canvas_rgb.tobytes())
                tex_mask = ctx.texture((width, height), 1, fg_mask.tobytes())
                tex_depth = ctx.texture((width, height), 1, depth_map_np.tobytes(), dtype='f4')
                
                # Assign to texture units
                tex_depth.use(0)
                tex_mask.use(1)
                tex_bg.use(2)
                tex_fg.use(3)
                
                prog['TextureDepth'].value = 0
                prog['TextureMask'].value = 1
                prog['TextureBg'].value = 2
                prog['TextureFg'].value = 3
                prog['u_depthStrength'].value = float(panel.get("depthStrength", 0.5))
                
                # Setup shaders parameters
                sfx_prompt = panel.get("sfxPrompt", "").lower()
                prog['u_windStrength'].value = 1.0 if 'wind' in sfx_prompt else 0.0
                prog['u_rippleStrength'].value = 1.0 if ('water' in sfx_prompt or 'ripple' in sfx_prompt) else 0.0
                prog['u_rippleCenter'].value = (0.5, 0.5)

                fbo.use()
                
                print(f" -> Rendering 3D frames for Panel {panel_id}...")
                for frame_idx in range(frames_to_write):
                    u_time = frame_idx / fps
                    prog['u_time'].value = u_time
                    
                    # Camera Matrix (Panning)
                    pan_x = np.sin(u_time * 0.5) * 0.1
                    pan_y = np.cos(u_time * 0.2) * 0.05
                    
                    view = pyrr.matrix44.create_look_at(
                        eye=[pan_x, pan_y, 1.5],
                        target=[0, 0, 0],
                        up=[0, 1, 0]
                    )
                    proj = pyrr.matrix44.create_perspective_projection(45.0, width/height, 0.1, 10.0)
                    mvp = pyrr.matrix44.multiply(view, proj)
                    prog['Mvp'].write(mvp.astype('f4').tobytes())
                    
                    ctx.clear(0.0, 0.0, 0.0)
                    vao.render(moderngl.TRIANGLES)
                    
                    # Read framebuffer
                    frame_data = fbo.read(components=3)
                    frame_rgb = np.frombuffer(frame_data, dtype=np.uint8).reshape((height, width, 3))
                    
                    # ModernGL reads upside down
                    frame_rgb = np.flipud(frame_rgb)
                    
                    writer.append_data(frame_rgb)
                    
                # Clean up textures
                tex_bg.release()
                tex_fg.release()
                tex_mask.release()
                tex_depth.release()
            except Exception as e:
                print(f"[Manga Engine] Warning: Failed to process panel {panel_id}: {e}")
                import traceback
                traceback.print_exc()
                
        writer.close()
        
        # Clean up GL
        try:
            fbo.release()
            vao.release()
            vbo.release()
            index_buffer.release()
            prog.release()
            ctx.release()
        except:
            pass

        print("--- Render Complete ---\n")
        
        return {
            "status": "SUCCESS",
            "video_url": "http://127.0.0.1:8000/static/outputs/final_motion_comic.mp4",
        }
    # Keep old method for backward compatibility if needed
    # (Removed since we just promoted it to the top level)
