import os
import time
import base64
import cv2
import numpy as np
import urllib.request
from ultralytics import YOLO
from transformers import pipeline
import torch

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

        print("[Manga Engine] Initializing Segment Anything (SAM)... (Pending Weight Download)")
        self.sam_predictor = None # We will load the actual SAM weights in the next step.

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
        Phase 3, Step 2: The Parallax Engine.
        Accepts a list of configured panels (with specific depth and sfx settings)
        and simulates the rendering process.
        """
        print("\n--- Starting Dynamic Slideshow Render ---")
        print(f"[Manga Engine] Received {len(panels_config)} panels for rendering.")
        
        # Ensure directory exists
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        output_dir = os.path.join(base_dir, "ui-shell", "public", "generated_outputs")
        os.makedirs(output_dir, exist_ok=True)
        filepath = os.path.join(output_dir, "final_motion_comic.mp4")
        
        print("[Manga Engine] Analyzing panels and stitching into video slideshow...")
        width, height = 1280, 720  # Increased resolution for better readability
        fps = 30.0
        
        # Use imageio to write browser-compatible H.264 mp4
        import imageio
        writer = imageio.get_writer(filepath, fps=fps, codec='libx264', macro_block_size=None)
        
        for panel in panels_config:
            panel_id = panel.get("id")
            b64_str = panel.get("image", "")
            if b64_str.startswith("data:image"):
                b64_str = b64_str.split(",")[1]
            
            try:
                img_data = base64.b64decode(b64_str)
                np_arr = np.frombuffer(img_data, np.uint8)
                img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
                
                if img is not None:
                    h, w = img.shape[:2]
                    scale = min(width/w, height/h)
                    nw, nh = int(w * scale), int(h * scale)
                    resized = cv2.resize(img, (nw, nh))
                    
                    canvas = np.zeros((height, width, 3), dtype=np.uint8)
                    x_offset = (width - nw) // 2
                    y_offset = (height - nh) // 2
                    canvas[y_offset:y_offset+nh, x_offset:x_offset+nw] = resized
                    
                    # Convert BGR to RGB for imageio
                    canvas_rgb = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)
                    
                    # Calculate duration dynamically based on scene complexity using AI
                    base_duration = 2.0
                    extra_duration = 0.0
                    text_count = 0
                    
                    try:
                        # Run YOLO AI to analyze the scene
                        results = self.yolo(img)
                        boxes = results[0].boxes
                        
                        for i in range(len(boxes)):
                            class_id = int(boxes.cls[i].item())
                            class_name = self.yolo.names[class_id].lower()
                            # If the model detects text, add more reading time
                            if 'text' in class_name:
                                text_count += 1
                                extra_duration += 1.5  # 1.5s per text bubble
                            # Optionally add minor time for characters/faces
                            elif 'face' in class_name or 'body' in class_name or 'person' in class_name:
                                extra_duration += 0.5
                    except Exception as yolo_err:
                        print(f"[Manga Engine] Warning: YOLO analysis failed for panel {panel_id}: {yolo_err}")
                    
                    # Cap maximum duration so it doesn't drag too long
                    total_duration = min(base_duration + extra_duration, 10.0)
                    print(f" -> Panel {panel_id} | Detected {text_count} text regions | Duration: {total_duration:.1f}s")
                    
                    frames_to_write = int(fps * total_duration)
                    for _ in range(frames_to_write):
                        writer.append_data(canvas_rgb)
            except Exception as e:
                print(f"[Manga Engine] Warning: Failed to process panel {panel_id}: {e}")
                
        writer.close()
            
        print("--- Render Complete ---\n")
        
        return {
            "status": "SUCCESS",
            "video_url": "http://127.0.0.1:8000/static/outputs/final_motion_comic.mp4",
        }

    # Keep old method for backward compatibility if needed
    # (Removed since we just promoted it to the top level)
