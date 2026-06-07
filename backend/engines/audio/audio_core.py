import os
import onnxruntime as ort
from .config import AUDIO_MODEL_MATRIX

class MorphAudioEngine:
    def __init__(self, fallback_providers):
        # We explicitly check if DirectML is ready to capture NPU/Integrated compute lines
        self.use_dml = 'DmlExecutionProvider' in fallback_providers
        self.tier = "NPU_ACCELERATED" if self.use_dml else "CPU_BACKUP"
        self.config = AUDIO_MODEL_MATRIX[self.tier]
        self.session = None
        
        print(f"[Audio Engine] Routing Workloads to: {self.config['friendly_name']}")
        self._load_audio_graph()

    def _load_audio_graph(self):
        """Loads the specialized audio vocal splitting node graph into memory."""
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        model_path = os.path.join(base_dir, "models_cache", "audio", self.config["model_file"])
        
        os.makedirs(os.path.dirname(model_path), exist_ok=True)

        if not os.path.exists(model_path):
            print(f"[Audio Engine] Target model missing: {self.config['model_file']}")
            print(f"[Audio Engine] Awaiting background pipeline streaming...")
            return

        print(f"[Audio Engine] Loading computational graph: {model_path}")
        try:
            # Set up session options to constrain background CPU threads strictly
            opts = ort.SessionOptions()
            opts.intra_op_num_threads = self.config["threads"]
            
            self.session = ort.InferenceSession(
                model_path,
                sess_options=opts,
                providers=[self.config["provider"]]
            )
            print(f"[Audio Engine] Pipeline linked cleanly onto processing core.")
        except Exception as e:
            print(f"[Audio Engine Warning] DirectML NPU handshake failed. Falling back to multi-threaded CPU. Log: {e}")
            self.session = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])

    def process_audio_frequency(self, mock_hertz_array):
        """Simulates isolating vocals from audio frequency bands."""
        print(f"[Processing] Splitting high/low frequency decibel vectors synchronously...")
        # Simulates a fast signal transformation matrix layer
        isolated_vocal_vector = mock_hertz_array * 0.88
        return isolated_vocal_vector, f"Audio processed via {self.config['provider']} optimization layers."