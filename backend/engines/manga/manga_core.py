import os
import time
import base64
import cv2
import numpy as np
from ultralytics import YOLO

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

    def generate_motion_comic(self, image_base64: str, reading_flow: str = "rtl"):
        """
        Orchestrates the entire Manga Motion AI Pipeline.
        """
        print(f"\n--- Starting Manga Motion Pipeline (Flow: {reading_flow}) ---")
        
        # 1. Panel Extraction
        panels = self.extract_panels(image_base64, reading_flow)
        
        # 2. Depth & Parallax Masking
        frames = self._dummy_sam_depth_parallax(panels)
        
        # 3. Audio Generation
        audio = self._dummy_audio_generation()
        
        # 4. Final Video Compilation
        final_video = self._dummy_compile_video(frames, audio)
        
        print("--- Pipeline Complete ---\n")
        
        return {
            "panels_extracted": len(panels),
            "video_url": f"http://127.0.0.1:8000/static/outputs/{final_video}",
            "panels": panels
        }

    # Keep old method for backward compatibility if needed
    # (Removed since we just promoted it to the top level)
