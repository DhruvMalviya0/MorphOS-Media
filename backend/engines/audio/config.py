AUDIO_MODEL_MATRIX = {
    "NPU_ACCELERATED": {
        "friendly_name": "Background NPU / Copilot+ Co-Processor Acceleration",
        "model_file": "vocal_splitter_quantized.onnx",
        "provider": "DmlExecutionProvider", # Targets DirectML / Windows AI runtime hooks
        "threads": 2
    },
    "CPU_BACKUP": {
        "friendly_name": "Multi-Threaded CPU Core Standby",
        "model_file": "vocal_splitter_baseline.onnx",
        "provider": "CPUExecutionProvider",
        "threads": 4
    }
}