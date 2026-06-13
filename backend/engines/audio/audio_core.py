import os
import torch
import librosa
import numpy as np
from pydub import AudioSegment
from transformers import AutoProcessor, MusicgenForConditionalGeneration
import scipy.io.wavfile as wavfile

class MorphAudioEngine:
    def __init__(self, fallback_providers=None):
        self.base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        self.output_dir = os.path.join(self.base_dir, "ui-shell", "public", "generated_outputs")
        os.makedirs(self.output_dir, exist_ok=True)
        
        # Generative Text-to-Audio Model States
        self.processor = None
        self.model = None
        
        # Legacy states for fallback compatibility
        self.fallback_providers = fallback_providers or []
        self.use_dml = 'DmlExecutionProvider' in self.fallback_providers
        self.tier = "NPU_ACCELERATED" if self.use_dml else "CPU_BACKUP"
        
        print("[Audio Engine] Core DSP Pipeline Armed.")

    def process_audio_frequency(self, mock_hertz_array):
        """Legacy vocal splitting simulator method to maintain backwards compatibility."""
        print(f"[Processing] Splitting high/low frequency decibel vectors synchronously...")
        isolated_vocal_vector = mock_hertz_array * 0.88
        provider = "DmlExecutionProvider" if self.use_dml else "CPUExecutionProvider"
        return isolated_vocal_vector, f"Audio processed via {provider} optimization layers."

    def analyze_track(self, file_path: str) -> dict:
        """Runs digital signal processing to extract absolute structural audio metadata."""
        if not os.path.exists(file_path):
            return {"error": "Target audio track binary inaccessible or missing."}
            
        if os.path.getsize(file_path) == 0:
            return {"error": "Target audio track is empty (0 bytes)."}
        
        try:
            print(f"[Audio DSP] Loading track layout for deep analysis: {file_path}")
            # Load audio data arrays at a standard sampling rate of 22050Hz
            y, sr = librosa.load(file_path, sr=None)
            
            # Calculate track duration
            duration = float(librosa.get_duration(y=y, sr=sr))
            
            # Isolate tempo (BPM) and absolute frame offsets of individual beat strikes
            tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
            beat_times = librosa.frames_to_time(beat_frames, sr=sr)
            
            # Safely convert numpy types to native Python floats for JSON serialization
            return {
                "status": "ANALYSIS_COMPLETE",
                "file_name": os.path.basename(file_path),
                "duration_seconds": round(duration, 2),
                "estimated_bpm": round(float(tempo[0] if isinstance(tempo, np.ndarray) else tempo), 2),
                "total_beats_detected": len(beat_times),
                "first_beat_offset_seconds": round(float(beat_times[0]), 3) if len(beat_times) > 0 else 0.0,
                "beat_offsets_sample_array": [round(float(t), 3) for t in beat_times[:10]] # Send first 10 beats
            }
        except Exception as e:
            print(f"[Audio DSP Failure] Failed to analyze audio track: {e}")
            return {"error": f"Audio analysis failed: {str(e)}"}

    def modify_tempo(self, file_path: str, speed_factor: float) -> str:
        """Modifies track play speed dynamically using pydub frame matching."""
        if not os.path.exists(file_path):
            return None
        
        print(f"[Audio DSP] Modifying tempo factor by: {speed_factor}x")
        sound = AudioSegment.from_file(file_path)
        
        # Speed change altering sample rate playback
        modified_sound = sound._spawn(sound.raw_data, overrides={
            "frame_rate": int(sound.frame_rate * speed_factor)
        }).set_frame_rate(sound.frame_rate)
        
        output_filename = f"mod_{os.path.basename(file_path)}"
        save_path = os.path.join(self.output_dir, output_filename)
        modified_sound.export(save_path, format="mp3" if file_path.endswith(".mp3") else "wav")
        
        return output_filename

    def _synthesize_synth_beep(self, duration=0.2, frequency=1000, sample_rate=22050):
        """Synthesizes a basic synth beep sound effect."""
        t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
        signal = np.sin(2 * np.pi * frequency * t)
        envelope = np.minimum(1.0, 20 * t) * (1.0 - t / duration)
        signal = signal * envelope
        signal = signal / np.max(np.abs(signal)) if np.max(np.abs(signal)) > 0 else signal
        audio_data = (signal * 32767).astype(np.int16)
        return AudioSegment(
            audio_data.tobytes(),
            frame_rate=sample_rate,
            sample_width=2,
            channels=1
        )

    def run_programmatic_sequencer(self, base_track_path: str, prompt: str) -> str:
        """Loads pristine real-world audio samples and mixes them over the track timeline."""
        print(f"[Sequencer Node] Running precision mix overlay for prompt: '{prompt}'")
        if not os.path.exists(base_track_path):
            return None
            
        # Load your original uploaded track layer
        base_audio = AudioSegment.from_file(base_track_path)
        duration_ms = len(base_audio)
        
        # Resolve the path to your high-fidelity sample directory
        fx_dir = os.path.join(os.path.dirname(__file__), "fx_assets")
        
        # Fallback to standard sequencer logic if samples aren't dropped in yet
        sample_path = os.path.join(fx_dir, "cat_meow.wav")
        
        if "meow" in prompt.lower() and os.path.exists(sample_path):
            print("[Sequencer Node] Success: Loading pristine real-world cat sample artifact.")
            fx_segment = AudioSegment.from_file(sample_path)
            # Lower the volume slightly so it sits beautifully in the lofi mix
            fx_segment = fx_segment - 3 
        else:
            print("[Sequencer Node Warning] Real sample asset missing. Generating fallback digital beep click.")
            fx_segment = self._synthesize_synth_beep()
            
        mixed_timeline = base_audio
        
        # Determine interval offsets in ms
        if "every second" in prompt.lower() or "every 1 second" in prompt.lower() or "each second" in prompt.lower():
            intervals = list(range(1000, duration_ms, 1000))
        elif "every beat" in prompt.lower() or "on the beat" in prompt.lower():
            # Perform simple DSP beat tracking to find beat times
            try:
                y, sr = librosa.load(base_track_path, sr=None)
                tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
                beat_times = librosa.frames_to_time(beat_frames, sr=sr)
                intervals = [int(t * 1000) for t in beat_times]
            except Exception as e:
                print(f"[Sequencer Node] Beat tracking failed, falling back to 1s intervals: {e}")
                intervals = list(range(1000, duration_ms, 1000))
        else:
            # Parse numerical seconds if possible (e.g. "every 2 seconds")
            import re
            match = re.search(r"every\s+(\d+)\s+second", prompt.lower())
            if match:
                sec = int(match.group(1))
                intervals = list(range(sec * 1000, duration_ms, sec * 1000))
            else:
                # Default: place a clean sample right at the 1-second mark
                intervals = [1000]
                
        print(f"[Sequencer Node] Overlaying sound effect at intervals: {intervals} ms")
        for offset_ms in intervals:
            if offset_ms < duration_ms:
                mixed_timeline = mixed_timeline.overlay(fx_segment, position=offset_ms)
                
        output_filename = f"seq_{int(torch.randint(0, 1000000, (1,)).item())}.wav"
        full_save_path = os.path.join(self.output_dir, output_filename)
        mixed_timeline.export(full_save_path, format="wav")
        print(f"[Sequencer Node] Saved modified track to: {output_filename}")
        return output_filename

    def run_user_sample_sequencer(self, base_track_path: str, prompt: str, user_samples_map: dict) -> str:
        """Intelligently checks if any individual word token in the uploaded filename matches the prompt."""
        print(f"[Dynamic Sequencer] Scanning prompt tokens against uploaded asset file names...")
        if not os.path.exists(base_track_path):
            return None
            
        mixed_timeline = AudioSegment.from_file(base_track_path)
        duration_ms = len(mixed_timeline)
        prompt_lower = prompt.lower()
        any_effect_applied = False
        
        for filename, full_sample_disk_path in user_samples_map.items():
            # Strip extension and split filename by common separators like hyphens/underscores
            base_name = filename.split(".")[0].lower()
            filename_word_tokens = base_name.replace("-", " ").replace("_", " ").split()
            
            # CHECK GUARD: Does your prompt contain ANY of the words in this filename? (e.g., "rain", "glass")
            has_match = any(token in prompt_lower for token in filename_word_tokens if len(token) > 2)
            
            if has_match:
                print(f"[Dynamic Sequencer] Match Found! Injecting: {filename}")
                fx_segment = AudioSegment.from_file(full_sample_disk_path)
                any_effect_applied = True
                
                # Check for timeline arrangement rules
                if "every second" in prompt_lower or "each second" in prompt_lower:
                    for offset_ms in range(1000, duration_ms, 1000):
                        mixed_timeline = mixed_timeline.overlay(fx_segment, position=offset_ms)
                elif "rain" in filename_word_tokens or "ambient" in filename_word_tokens or "loop" in prompt_lower:
                    mixed_timeline = mixed_timeline.overlay(fx_segment - 5, loop=True)
                else:
                    mixed_timeline = mixed_timeline.overlay(fx_segment, position=1500)

        if not any_effect_applied:
            print("[Dynamic Sequencer Warning] No filename keywords matched the prompt parameters.")

        output_filename = f"user_mix_{int(torch.randint(0, 1000000, (1,)).item())}.wav"
        full_save_path = os.path.join(self.output_dir, output_filename)
        mixed_timeline.export(full_save_path, format="wav")
        return output_filename

    def generate_audio_from_prompt(self, prompt: str, duration_seconds: int = 5) -> str:
        """Forces MusicGen to generate past the default 6-second tokenization boundary."""
        print(f"[Audio Generative AI] Synthesizing: '{prompt}' for {duration_seconds}s")
        
        if self.model is None:
            self.processor = AutoProcessor.from_pretrained("facebook/musicgen-medium")
            self.model = MusicgenForConditionalGeneration.from_pretrained("facebook/musicgen-medium")
            if torch.cuda.is_available():
                self.model.to("cuda")
                self.model.enable_attention_slicing()
        
        inputs = self.processor(text=[prompt], padding=True, return_tensors="pt")
        if torch.cuda.is_available():
            inputs = {k: v.to("cuda") for k, v in inputs.items()}
            
        # Hardcode frames target to completely overwrite default ceilings
        target_tokens = int(duration_seconds * 50)
        
        try:
            with torch.inference_mode():
                audio_tokens = self.model.generate(
                    **inputs, 
                    max_new_tokens=target_tokens,
                    min_new_tokens=target_tokens # Forces it to scale to your precise slider value!
                )
                
            audio_values = audio_tokens[0, 0].cpu().numpy()
            sampling_rate = self.model.config.audio_encoder.sampling_rate
            
            audio_values = audio_values / np.max(np.abs(audio_values)) if np.max(np.abs(audio_values)) > 0 else audio_values
            
            output_filename = f"synth_{int(torch.randint(0, 1000000, (1,)).item())}.wav"
            full_save_path = os.path.join(self.output_dir, output_filename)
            wavfile.write(full_save_path, rate=sampling_rate, data=(audio_values * 32767).astype(np.int16))
            return output_filename
        except Exception as e:
            print(f"[Audio Engine Error] Failed to generate: {e}")
            return None