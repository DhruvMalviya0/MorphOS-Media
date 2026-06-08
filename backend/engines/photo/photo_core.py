# backend/engines/photo/photo_core.py
import os
import torch
import urllib.request
import base64
import io
from PIL import Image
from diffusers import AutoPipelineForImage2Image

class MorphPhotoEngine:
    def __init__(self, model_id: str):
        self.model_id = model_id
        self.pipeline = None
        # Going up 4 levels to point correctly to the MorphOS-Media root directory
        self.base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        self.output_dir = os.path.join(self.base_dir, "ui-shell", "public", "generated_outputs")
        
        os.makedirs(self.output_dir, exist_ok=True)
        print(f"[Photo Engine] Initializing Optimized Img2Img Core for: {self.model_id}")
        self._bootstrap_inference_session()

    def _bootstrap_inference_session(self):
        """Loads weights with aggressive memory management to prevent VRAM Out-Of-Memory crashes."""
        try:
            # Load the dedicated image-to-image version of the model graph
            self.pipeline = AutoPipelineForImage2Image.from_pretrained(
                "stabilityai/sdxl-turbo", 
                torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
                variant="fp16" if torch.cuda.is_available() else None
            )
            
            if torch.cuda.is_available():
                # VRAM Protection Mechanics: Slice attention grids and optimize offloads
                self.pipeline.enable_attention_slicing()
                try:
                    self.pipeline.enable_xformers_memory_efficient_attention()
                except:
                    pass  # Fall back gracefully if xformers isn't installed yet
                
                try:
                    # Enable sequential CPU offload to bring VRAM footprint under 2-3 GB
                    self.pipeline.enable_sequential_cpu_offload()
                    print("[Photo Engine] Success! VRAM protection shields armed with sequential CPU offloading.")
                except Exception as offload_err:
                    self.pipeline.to("cuda")
                    print(f"[Photo Engine Warning] CPU offload fail ({offload_err}). Running on CUDA directly.")
            else:
                self.pipeline.to("cpu")
        except Exception as e:
            print(f"[Photo Engine Critical Error] Boot failed: {e}")

    def process_canvas_layer(self, prompt: str, steps: int, base_image_path: str = None, strength: float = 0.5):
        """Decodes raw payload strings directly to avoid system drive path failures on Windows."""
        if not self.pipeline:
            return None, "Model framework is not loaded into memory."

        init_image = None
        
        # Parse and decode base64 data stream sequences
        if base_image_path:
            if base_image_path.startswith("data:image"):
                try:
                    print("[Photo Engine] Decoding raw base64 visual asset array stream...")
                    header, encoded = base_image_path.split(",", 1)
                    image_data = base64.b64decode(encoded)
                    init_image = Image.open(io.BytesIO(image_data)).convert("RGB").resize((512, 512))
                except Exception as e:
                    print(f"[Photo Engine Error] Base64 array decode failed: {e}. Falling back.")
            elif base_image_path.startswith("http://") or base_image_path.startswith("https://"):
                # Resolve local server URLs
                if "/static/outputs/" in base_image_path:
                    filename = base_image_path.split("/static/outputs/")[-1]
                    resolved_path = os.path.join(self.output_dir, filename)
                    if os.path.exists(resolved_path):
                        try:
                            init_image = Image.open(resolved_path).convert("RGB").resize((512, 512))
                            print(f"[Photo Engine] Loaded base asset structure from resolved URL: {resolved_path}")
                        except Exception as img_err:
                            print(f"[Photo Engine Error] Failed to open resolved URL path: {img_err}")
                if init_image is None:
                    # Fallback download
                    try:
                        temp_filename = f"downloaded_{int(torch.randint(0, 1000000, (1,)).item())}.png"
                        resolved_path = os.path.join(self.output_dir, temp_filename)
                        urllib.request.urlretrieve(base_image_path, resolved_path)
                        init_image = Image.open(resolved_path).convert("RGB").resize((512, 512))
                        print(f"[Photo Engine] Downloaded base image from external URL: {base_image_path}")
                    except Exception as download_err:
                        print(f"[Photo Engine Error] Failed to download image from URL: {download_err}")
            else:
                # Direct file path
                if os.path.exists(base_image_path):
                    try:
                        init_image = Image.open(base_image_path).convert("RGB").resize((512, 512))
                        print(f"[Photo Engine] Loaded base asset structure from path: {base_image_path}")
                    except Exception as img_err:
                        print(f"[Photo Engine Error] Failed to open base image path: {img_err}")
        
        if init_image is None:
            print("[Photo Engine Warning] No valid base image payload. Creating safe dark baseline template.")
            init_image = Image.new("RGB", (512, 512), (18, 18, 18))

        execution_steps = min(steps, 4)

        with torch.inference_mode():
            # strength=0.5 uses your leaf structures as a strong structural baseline anchor
            image_artifact = self.pipeline(
                prompt=prompt, 
                image=init_image,
                strength=strength,
                num_inference_steps=execution_steps, 
                guidance_scale=0.0
            ).images[0]
        
        file_name = f"gen_{int(torch.randint(0, 1000000, (1,)).item())}.png"
        full_save_path = os.path.join(self.output_dir, file_name)
        image_artifact.save(full_save_path)
        
        return file_name, f"Hybrid composition generated successfully in {execution_steps} steps."