# backend/models_manifest.py

MODEL_MANIFEST = {
    "photo": [
        {
            "id": "sdxl_turbo_int8",
            "name": "SDXL Turbo (Quantized INT8)",
            "file_name": "sdxl_turbo_int8.onnx",
            "min_vram_gb": 4,
            "recommended_vram_gb": 6,
            "description": "Ultra-fast single-step latent generation. Highly optimized for mid-tier laptop and desktop GPUs.",
            "supported_vendors": ["NVIDIA", "AMD", "Intel"]
        },
        {
            "id": "sd15_fp16",
            "name": "Stable Diffusion v1.5 (Baseline FP16)",
            "file_name": "v1-5-pruned-emaonly_fp16.onnx",
            "min_vram_gb": 6,
            "recommended_vram_gb": 8,
            "description": "Standard studio baseline model. Requires a stable VRAM buffer to prevent memory thrashing.",
            "supported_vendors": ["NVIDIA", "AMD", "Intel"]
        },
        {
            "id": "sd3_medium_fp16",
            "name": "Stable Diffusion 3 Medium (Studio Grade FP16)",
            "file_name": "sd3_medium_fp16.onnx",
            "min_vram_gb": 12,
            "recommended_vram_gb": 16,
            "description": "Extreme precision multi-layer visual canvas engine. High memory footprint.",
            "supported_vendors": ["NVIDIA", "AMD"]
        },
        {
            "id": "flux_dev_fp16",
            "name": "Flux.1 Dev (Pro Studio Canvas FP16)",
            "file_name": "flux1_dev_fp16.onnx",
            "min_vram_gb": 16,
            "recommended_vram_gb": 24,
            "description": "Uncompromised generative accuracy. Designed exclusively for high-end workstation setups.",
            "supported_vendors": ["NVIDIA"]
        }
    ]
}