PHOTO_MODEL_MATRIX = {
    "MORPH_ULTRA_NVIDIA": {
        "friendly_name": "Ultra Mode (Studio Grade FP16)",
        "model_file": "sd3_medium_fp16.onnx",
        "steps": 30,
        "provider": "CUDAExecutionProvider",
        "provider_options": {"device_id": 0, "gpu_mem_limit": 0} # No limits on a 5080
    },
    "MORPH_HIGH_NVIDIA": {
        "friendly_name": "High Performance Mode (Optimized INT8)",
        "model_file": "sdxl_turbo_int8.onnx",
        "steps": 4, # Turbo models generate spectacular canvas files in 4 steps
        "provider": "CUDAExecutionProvider",
        "provider_options": {"device_id": 0, "gpu_mem_limit": 6 * 1024 * 1024 * 1024} # Caps VRAM safely for your 4060
    },
    "MORPH_ADAPTIVE_DML": {
        "friendly_name": "Universal DirectML Mode (DirectX 12)",
        "model_file": "sdxl_turbo_int8.onnx",
        "steps": 4,
        "provider": "DmlExecutionProvider",
        "provider_options": {}
    }
}