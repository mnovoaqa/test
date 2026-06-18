"""Audio I/O: load, save, resample, format conversion."""
from __future__ import annotations

from pathlib import Path
from typing import Tuple

import numpy as np
import soundfile as sf
import soxr


INTERNAL_SR = 48000


def load_audio(path: str | Path, target_sr: int = INTERNAL_SR, mono: bool = True) -> Tuple[np.ndarray, int]:
    """Load WAV/FLAC/OGG. For MP3/M4A install audioread or run ffmpeg upstream.

    Returns float32 in [-1, 1], shape (n,) if mono else (n, channels), at target_sr.
    """
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(path)

    data, sr = sf.read(str(path), dtype="float32", always_2d=True)
    if mono and data.shape[1] > 1:
        data = data.mean(axis=1, keepdims=True)
    if sr != target_sr:
        data = soxr.resample(data, sr, target_sr, quality="HQ")
    out = data[:, 0] if mono else data
    return out.astype(np.float32, copy=False), target_sr


def save_audio(path: str | Path, audio: np.ndarray, sr: int = INTERNAL_SR, subtype: str = "PCM_24") -> None:
    """Save float audio. subtype: PCM_16, PCM_24, FLOAT."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    if audio.ndim == 1:
        out = audio.astype(np.float32)
    else:
        out = audio.astype(np.float32)
    # Hard clip safety net (mastering should already keep us under 0 dBFS)
    out = np.clip(out, -1.0, 1.0)
    sf.write(str(path), out, sr, subtype=subtype)


def to_stereo(audio: np.ndarray) -> np.ndarray:
    """Mono (n,) -> stereo (n, 2)."""
    if audio.ndim == 1:
        return np.stack([audio, audio], axis=1)
    if audio.shape[1] == 1:
        return np.repeat(audio, 2, axis=1)
    return audio


def to_mono(audio: np.ndarray) -> np.ndarray:
    if audio.ndim == 1:
        return audio
    return audio.mean(axis=1)


def dither_tpdf(audio: np.ndarray, bits: int = 16) -> np.ndarray:
    """Triangular PDF dither for bit-depth reduction."""
    q = 1.0 / (2 ** (bits - 1))
    n1 = np.random.uniform(-0.5, 0.5, size=audio.shape).astype(np.float32)
    n2 = np.random.uniform(-0.5, 0.5, size=audio.shape).astype(np.float32)
    return audio + (n1 + n2) * q
