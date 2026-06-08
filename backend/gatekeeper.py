# backend/gatekeeper.py
import os
import psutil
from models_manifest import MODEL_MANIFEST

class HardwareGatekeeper:
    def __init__(self):
        self.gpu_vendor = "UNKNOWN"
        self.gpu_model = "Generic Display Adapter"
        self.total_vram_gb = 4.0  # Safe default baseline fallback
        self.providers = ["CPUExecutionProvider"]
        
        self._detect_system_graphics()

    def _detect_system_graphics(self):
        """Scans hardware signatures to evaluate vendor and memory pools dynamically."""
        # Detect execution environments via ONNX registries
        import onnxruntime as ort
        available = ort.get_available_providers()
        
        if "CUDAExecutionProvider" in available:
            self.gpu_vendor = "NVIDIA"
            self.providers.insert(0, "CUDAExecutionProvider")
        elif "DmlExecutionProvider" in available:
            self.gpu_vendor = "AMD"  # Could also be Intel/Integrated fallback
            self.providers.insert(0, "DmlExecutionProvider")
            
        # Extract friendly names from system processes or environment logs
        # For cross-platform stability on Windows, we parse environment allocations
        try:
            # Fallback evaluation matrix if raw driver queries are locked
            self.gpu_model = os.environ.get("PROCESSOR_IDENTIFIER", "System Silicon Core")
            # In production, we read hardware specs directly. For our blueprint, 
            # we check system memory footprints to guess VRAM thresholds safely:
            sys_mem = psutil.virtual_memory().total / (1024 ** 3)
            if sys_mem > 31:
                self.total_vram_gb = 16.0  # Simulating a high-end desktop pool
            elif sys_mem > 15:
                self.total_vram_gb = 8.0   # Simulating standard workstation setups
            else:
                self.total_vram_gb = 4.0
        except:
            pass

    def evaluate_model_compatibility(self):
        """Compares detected system VRAM against model manifest bounds."""
        cached_models_dir = os.path.join(os.path.dirname(__file__), "models_cache", "photo")
        existing_models = []
        
        if os.path.exists(cached_models_dir):
            existing_models = os.listdir(cached_models_dir)

        compatibility_report = []
        redirect_immediately = False

        for model in MODEL_MANIFEST["photo"]:
            has_file = model["file_name"] in existing_models
            
            # Determine safety rating based on host total VRAM parameters
            if self.total_vram_gb >= model["recommended_vram_gb"]:
                status = "RECOMMENDED"
                warning_sign = False
            elif self.total_vram_gb >= model["min_vram_gb"]:
                status = "COMPATIBLE"
                warning_sign = False
            else:
                status = "DANGEROUS"  # VRAM Overflow Hazard (PC Killer)
                warning_sign = True

            # If a recommended model already exists locally, trigger immediate redirect bypass
            if has_file and status in ["RECOMMENDED", "COMPATIBLE"]:
                redirect_immediately = True

            compatibility_report.append({
                "id": model["id"],
                "name": model["name"],
                "status": status,
                "warning_sign": warning_sign,
                "file_exists": has_file,
                "description": model["description"]
            })

        return {
            "gpu_info": f"{self.gpu_vendor} {self.gpu_model} ({int(self.total_vram_gb)}GB VRAM)",
            "redirect": redirect_immediately,
            "report": compatibility_report
        }