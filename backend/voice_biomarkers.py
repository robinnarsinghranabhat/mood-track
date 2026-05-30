import io
import tempfile
import os
import numpy as np

try:
    import librosa
    _LIBROSA = True
except ImportError:
    _LIBROSA = False

try:
    import parselmouth
    from parselmouth.praat import call as praat_call
    _PARSELMOUTH = True
except ImportError:
    _PARSELMOUTH = False


def extract_voice_biomarkers(audio_bytes: bytes) -> dict:
    """
    Extract voice biomarkers from raw audio bytes (WebM/Opus from browser).
    Requires ffmpeg in PATH for WebM decoding (pip install librosa praat-parselmouth).
    Returns dict of signal_type -> value.
    """
    if not _LIBROSA and not _PARSELMOUTH:
        print("[voice] librosa and parselmouth not installed, skipping biomarkers")
        return {}

    try:
        tmp = tempfile.NamedTemporaryFile(suffix=".webm", delete=False)
        tmp.write(audio_bytes)
        tmp.close()
        audio, sr = librosa.load(tmp.name, sr=16000, mono=True)
        os.unlink(tmp.name)
    except Exception as e:
        print(f"[voice] Audio decode failed (is ffmpeg installed?): {e}")
        return {}

    if len(audio) < sr * 0.5:
        return {}

    biomarkers = {}

    if _LIBROSA:
        biomarkers.update(_librosa_features(audio, sr))

    if _PARSELMOUTH:
        biomarkers.update(_praat_features(audio, sr))

    return biomarkers


def _librosa_features(audio: np.ndarray, sr: int) -> dict:
    duration = len(audio) / sr
    result = {}

    # RMS energy → voice_energy (1-10)
    rms = librosa.feature.rms(y=audio)[0]
    result["voice_energy"] = _scale(float(np.mean(rms)), 0.0, 0.12)

    # Onset events per second → speaking_rate (1-10)
    onsets = librosa.onset.onset_detect(y=audio, sr=sr, units="time")
    rate = len(onsets) / duration if duration > 0 else 0
    result["speaking_rate"] = _scale(rate, 0, 8)

    # Spectral centroid → voice_brightness (1-10, higher = more tension)
    centroid = librosa.feature.spectral_centroid(y=audio, sr=sr)[0]
    result["voice_brightness"] = _scale(float(np.mean(centroid)), 500, 3500)

    return result


def _praat_features(audio: np.ndarray, sr: int) -> dict:
    result = {}
    sound = parselmouth.Sound(audio.astype(np.float64), sampling_frequency=float(sr))

    # Pitch mean + variability
    try:
        pitch = sound.to_pitch(pitch_floor=75, pitch_ceiling=500)
        pitch_vals = pitch.selected_array["frequency"]
        pitch_vals = pitch_vals[pitch_vals > 0]
        if len(pitch_vals) > 5:
            result["pitch_mean"] = round(float(np.mean(pitch_vals)), 1)
            result["pitch_variability"] = _scale(float(np.std(pitch_vals)), 0, 80)
    except Exception:
        pass

    # Jitter + Shimmer (voice stability)
    try:
        pp = praat_call(sound, "To PointProcess (periodic, cc)", 75, 500)
        jitter = praat_call(pp, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3)
        if not np.isnan(jitter):
            result["jitter"] = round(float(jitter), 6)

        shimmer = praat_call([sound, pp], "Get shimmer (local)", 0, 0, 0.0001, 0.02, 1.3, 1.6)
        if not np.isnan(shimmer):
            result["shimmer"] = round(float(shimmer), 6)
    except Exception:
        pass

    # HNR (harmonics-to-noise ratio → voice quality, 1-10)
    try:
        harmonicity = praat_call(sound, "To Harmonicity (cc)", 0.01, 75, 0.1, 1.0)
        hnr = praat_call(harmonicity, "Get mean", 0, 0)
        if not np.isnan(hnr):
            result["hnr"] = _scale(float(hnr), -20, 30)
    except Exception:
        pass

    return result


def _scale(value: float, lo: float, hi: float) -> float:
    """Normalize a raw value to a 1-10 scale."""
    if hi == lo:
        return 5.0
    return round(max(1.0, min(10.0, 1 + (value - lo) / (hi - lo) * 9)), 2)


def biomarkers_to_rows(conversation_id: str, biomarkers: dict, timestamp: str) -> list[dict]:
    return [
        {
            "conversation_id": conversation_id,
            "timestamp": timestamp,
            "signal_type": signal_type,
            "value": float(value),
            "label": None,
            "confidence": 0.75,
            "context": None,
            "source": "voice",
        }
        for signal_type, value in biomarkers.items()
    ]
