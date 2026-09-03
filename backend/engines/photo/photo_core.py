# backend/engines/photo/photo_core.py
import os
import torch
import urllib.request
import base64
import io
from PIL import Image, ImageOps
from diffusers import AutoPipelineForInpainting  # Upgraded: Inpainting preserves character details outside the mask

class MorphPhotoEngine:
    def __init__(self, model_id: str):
        self.model_id = model_id
        self.pipeline = None
        # Going up 4 levels to point correctly to the MorphOS-Media root directory
        self.base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        self.output_dir = os.path.join(self.base_dir, "ui-shell", "public", "generated_outputs")
        
        os.makedirs(self.output_dir, exist_ok=True)
        print(f"[Photo Engine] Initializing Professional Inpainting Core for: {self.model_id}")
        self._bootstrap_inference_session()

    def _bootstrap_inference_session(self):
        """Loads weights with aggressive memory management to prevent VRAM Out-Of-Memory crashes."""
        try:
            # Load the dedicated image-to-image version of the model graph.
            # Try fp16 variant first (smaller/faster on GPU), fall back to default if files are missing.
            try:
                self.pipeline = AutoPipelineForInpainting.from_pretrained(
                    "stabilityai/sdxl-turbo",
                    torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
                    variant="fp16" if torch.cuda.is_available() else None,
                    local_files_only=False  # TODO: flip back to True once model is re-cached
                )
            except Exception as variant_err:
                print(f"[Photo Engine] fp16 variant not found locally ({variant_err}). Retrying without variant flag...")
                self.pipeline = AutoPipelineForInpainting.from_pretrained(
                    "stabilityai/sdxl-turbo",
                    torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
                    local_files_only=False  # TODO: flip back to True once model is re-cached
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
                    self.pipeline.set_progress_bar_config(disable=True)
                    print("[Photo Engine] Success! VRAM protection shields armed with sequential CPU offloading.")
                except Exception as offload_err:
                    self.pipeline.to("cuda")
                    print(f"[Photo Engine Warning] CPU offload fail ({offload_err}). Running on CUDA directly.")
            else:
                self.pipeline.to("cpu")
        except Exception as e:
            print(f"[Photo Engine Critical Error] Boot failed: {e}")
            print("[Photo Engine] *** ACTION REQUIRED: The sdxl-turbo model weights are not fully cached. ***")
            print("[Photo Engine] Run this once with internet access to download them:")
            print("[Photo Engine]   HF_HUB_OFFLINE=0 python -c \"from diffusers import AutoPipelineForInpainting; AutoPipelineForInpainting.from_pretrained('stabilityai/sdxl-turbo', torch_dtype='auto', variant='fp16')\"")
            self.pipeline = None

    def process_canvas_layer(self, prompt: str, steps: int, base_image_path: str = None, strength: float = 1.0, mask_image_data: str = None):
        """Decodes raw payload strings directly to avoid system drive path failures on Windows.
        
        mask_image_data: base64 PNG from the frontend canvas (RGBA, transparent background + opaque brush strokes).
        We extract the Alpha channel directly as the inpainting mask:
          - Painted brush areas  → alpha=255 (WHITE in Diffusers = regenerate this region)
          - Untouched background → alpha=0   (BLACK in Diffusers = preserve, do not touch)
        No inversion needed. An eraser tool on the frontend will also work natively.
        """
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
            strength = 1.0

        # ── Inpainting Mask Decoding ──────────────────────────────────────────────
        # Convention: BLACK (0) = regenerate inside mask, WHITE (255) = preserve untouched.
        mask_image = None
        if mask_image_data:
            try:
                if mask_image_data.startswith("data:image"):
                    _, encoded = mask_image_data.split(",", 1)
                    mask_bytes = base64.b64decode(encoded)

                    # ── Bulletproof Dual-Mode Mask Parser ────────────────────────────────
                    # React canvas can export with either a transparent or solid background
                    # depending on browser/OS defaults. We handle both cases automatically.
                    mask_rgba = Image.open(io.BytesIO(mask_bytes)).convert("RGBA")
                    min_alpha = mask_rgba.getextrema()[3][0]  # Min value of alpha channel

                    if min_alpha == 255:
                        # ⚠️  SOLID background detected — no transparency in the export.
                        # This happens when React/browser renders the canvas with a white bg.
                        # Strategy: convert to greyscale and invert so dark brush strokes
                        # (which are close to black/0) become the white=regenerate mask region.
                        print("[Photo Engine] Solid canvas detected. Using greyscale inversion strategy.")
                        mask_image = ImageOps.invert(mask_rgba.convert("L")).resize((512, 512))
                    else:
                        # ✅ TRANSPARENT background detected — alpha channel is meaningful.
                        # Strategy: extract the A channel directly.
                        # Painted opaque strokes  → alpha=255 → WHITE → Diffusers: regenerate
                        # Untouched transparent px → alpha=0   → BLACK → Diffusers: preserve
                        # Future eraser tool will work natively without any code change.
                        print("[Photo Engine] Transparent canvas detected. Using alpha channel extraction strategy.")
                        mask_image = mask_rgba.getchannel("A").resize((512, 512))

                    print(f"[Photo Engine] Mask loaded — min_alpha={min_alpha}, mode={mask_image.mode}, size={mask_image.size}")
                else:
                    print("[Photo Engine Warning] Mask data format unrecognised. Using full-white fallback.")
            except Exception as mask_err:
                print(f"[Photo Engine Error] Mask decode failed: {mask_err}. Using full-white fallback.")

        if mask_image is None:
            # No mask drawn = regenerate everything (full-white = entire region selected for inpainting).
            print("[Photo Engine] No inpainting mask provided. Using full-white regeneration mask.")
            mask_image = Image.new("L", (512, 512), 255)

        execution_steps = min(steps, 4)

        with torch.inference_mode():
            image_artifact = self.pipeline(
                prompt=prompt,
                image=init_image,
                mask_image=mask_image,
                strength=strength,
                num_inference_steps=execution_steps,
                guidance_scale=1.5   # SDXL-Turbo sweet spot: enough to read style words, low enough to stay clean
            ).images[0]
        
        file_name = f"gen_{int(torch.randint(0, 1000000, (1,)).item())}.png"
        full_save_path = os.path.join(self.output_dir, file_name)
        image_artifact.save(full_save_path)
        
        return file_name, f"Inpainting synthesis complete in {execution_steps} steps."