import os
import sys
import logging
import psutil
import torch
import onnxruntime as ort

# Setup isolated logging directory for open-source debugging
LOG_DIR = os.path.join(os.path.dirname(__file__), "logs")
os.makedirs(LOG_DIR, exist_ok=True)
logging.basicConfig(
    filename=os.path.join(LOG_DIR, "system_check.log"),
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

class HardwareGatekeeper:
    def __init__(self):
        self.MIN_RAM_GB = 12.0
        self.MIN_VRAM_GB = 4.0
        
        self.sys_ram = psutil.virtual_memory().total / (1024 ** 3)
        self.vram = 0.0
        self.gpu_vendor = "Unknown"
        self.gpu_name = "None/Integrated"
        self.providers = ort.get_available_providers()
        
        self._scan_resources()

    def _scan_resources(self):
        """Scans system silicon architectures to identify NVIDIA or AMD/Intel ecosystems."""
        if torch.cuda.is_available():
            # Matches NVIDIA cards 
            dev_id = 0
            self.vram = torch.cuda.get_device_properties(dev_id).total_memory / (1024 ** 3)
            self.gpu_name = torch.cuda.get_device_name(dev_id)
            self.gpu_vendor = "NVIDIA"
        else:
            # Matches AMD Radeon GPUs or Intel Graphics using Windows DirectML (DX12)
            if 'DmlExecutionProvider' in self.providers:
                self.gpu_vendor = "AMD/Intel Accelerated"
                self.gpu_name = "DirectX 12 Machine Learning Adapter"
                # Safe baseline approximation for shared/dedicated VRAM mapping
                self.vram = self.sys_ram * 0.5  
        
        logging.info(f"Scan Finished. Vendor: {self.gpu_vendor} | Card: {self.gpu_name} | Calculated VRAM: {self.vram:.2f}GB")

    def verify_clearance(self):
        """Validates baseline boundaries to prevent user application OOM crashes."""
        # 1. Total System RAM Guard
        if self.sys_ram < self.MIN_RAM_GB:
            msg = f"Launch Interrupted: Found {self.sys_ram:.1f}GB RAM. MorphOS Media requires at minimum {self.MIN_RAM_GB}GB RAM to maintain core stability."
            logging.error(msg)
            return {"status": "DENIED", "reason": msg}

        # 2. Hardware Acceleration Engine Guard
        has_accel = any(p in self.providers for p in ['CUDAExecutionProvider', 'DmlExecutionProvider'])
        if not has_accel:
            msg = "Launch Interrupted: No supported high-speed hardware runtimes found (CUDA or DirectML missing)."
            logging.error(msg)
            return {"status": "DENIED", "reason": msg}

        # 3. Dynamic Profile Target Map Assignation
        if self.gpu_vendor == "NVIDIA" and self.vram >= 15.0:
            profile = "MORPH_ULTRA_NVIDIA" # High end nvidia gpu
        elif self.gpu_vendor == "NVIDIA" and self.vram >= 6.0:
            profile = "MORPH_HIGH_NVIDIA"  # Mid end nvidia gpu
        elif "AMD" in self.gpu_vendor or 'DmlExecutionProvider' in self.providers:
            profile = "MORPH_ADAPTIVE_DML"  # AMD Desktop Cards & Integrated Silicon users
        else:
            profile = "MORPH_LOW_BACKUP"

        logging.info(f"Startup Clearance Granted. Target Engine Profile: {profile}")
        return {"status": "ALLOWED", "profile": profile}

    def evaluate_job_routing(self, job_spec: dict):
        """
        Dynamically evaluates current hardware headroom (VRAM/RAM) to make a routing decision.
        """
        reasoning = []
        op_type = job_spec.get("op_type", "photo-gen")
        
        # 1. Read live available memory
        free_ram_gb = psutil.virtual_memory().available / (1024 ** 3)
        reasoning.append(f"Detected {free_ram_gb:.1f}GB available System RAM.")
        
        free_vram_gb = 0.0
        if torch.cuda.is_available():
            try:
                free_bytes, total_bytes = torch.cuda.mem_get_info()
                free_vram_gb = free_bytes / (1024 ** 3)
                reasoning.append(f"Detected {free_vram_gb:.1f}GB VRAM headroom.")
            except Exception as e:
                logging.error(f"Failed to read live VRAM: {e}")
                free_vram_gb = self.vram * 0.5 # fallback
                reasoning.append(f"Estimated {free_vram_gb:.1f}GB VRAM headroom (fallback).")
        else:
            reasoning.append("No CUDA detected. Assuming CPU/DirectML unified memory model.")
            free_vram_gb = free_ram_gb * 0.5 # rough estimate for integrated/shared memory
        
        # 2. Make routing decisions
        resolution = "512x512"
        precision = "fp32"
        batch_size = 1
        
        if op_type == "photo-gen":
            if free_vram_gb >= 8.0:
                precision = "fp16"
                resolution = "1024x1024"
                batch_size = 1
                reasoning.append(f"VRAM headroom >= 8GB -> {precision} selected for speed, resolution maxed at {resolution}.")
            elif free_vram_gb >= 4.0:
                precision = "fp16"
                resolution = "768x768"
                batch_size = 1
                reasoning.append(f"VRAM headroom between 4-8GB -> {precision} selected over fp32, resolution capped at {resolution} to stay under working set.")
            else:
                precision = "fp32" if not torch.cuda.is_available() else "fp16"
                resolution = "512x512"
                reasoning.append(f"Low VRAM headroom (<4GB) -> resolution restricted to {resolution}, precision set to {precision}.")
                
        elif op_type == "manga-panel-extract":
            resolution = "Native"
            if free_ram_gb > 8.0:
                batch_size = 4
                reasoning.append("High System RAM available -> extracting up to 4 panels in parallel.")
            else:
                batch_size = 1
                reasoning.append("Low System RAM -> extracting sequentially (batch size 1).")
        
        return {
            "resolution": resolution,
            "precision": precision,
            "batch_size": batch_size,
            "reasoning": reasoning
        }