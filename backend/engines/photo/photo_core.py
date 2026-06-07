import os
import numpy as np
import onnxruntime as ort
from .config import PHOTO_MODEL_MATRIX

class MorphPhotoEngine:
    def __init__(self, hardware_profile):
        self.profile = hardware_profile
        self.config = PHOTO_MODEL_MATRIX.get(self.profile, PHOTO_MODEL_MATRIX["MORPH_ADAPTIVE_DML"])
        self.session = None
        
        print(f"[Photo Engine] Initialized Profile: {self.config['friendly_name']}")
        self._bootstrap_inference_session()

    def _bootstrap_inference_session(self):
        """Prepares ONNX sessions, matching weights to silicon targets dynamically."""
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        model_path = os.path.join(base_dir, "models_cache", "photo", self.config["model_file"])
        
        # Ensure model directory skeleton exists
        os.makedirs(os.path.dirname(model_path), exist_ok=True)

        # For open-source deployment, if weights don't exist, we fallback safely or log an warning
        if not os.path.exists(model_path):
            print(f"[Photo Engine] Target model missing: {self.config['model_file']}")
            print(f"[Photo Engine] Awaiting lazy download pipeline or manual assignment...")
            return

        print(f"[Photo Engine] Loading neural graph from: {model_path}")
        try:
            # Dynamically attach the session execution provider (CUDA vs DirectML)
            self.session = ort.InferenceSession(
                model_path,
                providers=[self.config["provider"]],
                provider_options=[self.config["provider_options"]] if self.config["provider_options"] else None
            )
            print(f"[Photo Engine] Memory bound successfully onto: {self.config['provider']}")
        except Exception as e:
            print(f"[Photo Engine Warning] Provider assignment failed. Falling back to CPU. Dev log: {e}")
            self.session = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])

    def process_canvas_layer(self, dummy_image_buffer):
        """Simulates processing a photo frame utilizing the scaled pipeline depth configuration metrics."""
        steps = self.config["steps"]
        print(f"[Processing] Running inpainting loops at depth: {steps} computational sampling passes.")
        
        # Mocking an ONNX matrix math operation mapping tensor fields
        # In full production, this maps standard OpenCV frames directly into ONNX tensors
        output_data = dummy_image_buffer * 1.5
        return output_data, f"Rendered via {self.config['friendly_name']} at {steps} steps."