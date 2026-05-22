"""Mix bus: combine vocal (stereo) + beat (stereo), apply vocal-forward and sidechain."""
from __future__ import annotations

import numpy as np

from .dsp.eq import peak_eq, hpf
from .dsp.dynamics import sidechain_compressor


def align_lengths(*tracks: np.ndarray) -> list[np.ndarray]:
    """Pad/truncate stereo tracks to the same (max) length."""
    n = max(t.shape[0] for t in tracks)
    out = []
    for t in tracks:
        if t.shape[0] < n:
            pad = np.zeros((n - t.shape[0], t.shape[1]), dtype=t.dtype)
            t = np.concatenate([t, pad], axis=0)
        out.append(t.astype(np.float32))
    return out


def place_vocal_in_song(vocal: np.ndarray, intro_samples: int, total_samples: int) -> np.ndarray:
    """Pad vocal so it starts after the intro bars and matches total length."""
    if vocal.ndim == 1:
        vocal = np.stack([vocal, vocal], axis=1)
    out = np.zeros((total_samples, 2), dtype=np.float32)
    end = min(total_samples, intro_samples + vocal.shape[0])
    seg = vocal[: end - intro_samples]
    out[intro_samples:end] = seg
    return out


def vocal_forward(beat: np.ndarray, vocal_mono: np.ndarray, sr: int) -> np.ndarray:
    """Duck 1-4 kHz of the instrumental when vocal is present."""
    n = min(beat.shape[0], len(vocal_mono))
    beat = beat[:n]
    voc = vocal_mono[:n]
    # Sidechain only the upper-mid band of the beat
    from .dsp.eq import bandpass
    upper = bandpass(beat[:, 0], sr, 1000, 4000)
    upper_r = bandpass(beat[:, 1], sr, 1000, 4000)
    rest_l = beat[:, 0] - upper
    rest_r = beat[:, 1] - upper_r
    ducked_l = sidechain_compressor(upper, voc, sr,
                                    threshold_db=-30, ratio=3.0, attack_ms=10, release_ms=200)
    ducked_r = sidechain_compressor(upper_r, voc, sr,
                                    threshold_db=-30, ratio=3.0, attack_ms=10, release_ms=200)
    out_l = rest_l + ducked_l
    out_r = rest_r + ducked_r
    return np.stack([out_l, out_r], axis=1).astype(np.float32)


def mix_bus(
    vocal_stereo: np.ndarray,
    beat_stereo: np.ndarray,
    sr: int,
    vocal_level_db: float = 0.0,
    beat_level_db: float = -1.5,
    vocal_forward_on: bool = True,
    width: float = 1.0,
) -> np.ndarray:
    """Combine vocal + beat into a stereo mix. Returns (n, 2)."""
    vocal_stereo, beat_stereo = align_lengths(vocal_stereo, beat_stereo)
    # Vocal-forward ducking
    if vocal_forward_on:
        beat_stereo = vocal_forward(beat_stereo, vocal_stereo.mean(axis=1), sr)
    vg = 10 ** (vocal_level_db / 20.0)
    bg = 10 ** (beat_level_db / 20.0)
    mix = (vocal_stereo * vg) + (beat_stereo * bg)
    # Width on instrumental side only
    if width != 1.0:
        mid = 0.5 * (mix[:, 0] + mix[:, 1])
        side = 0.5 * (mix[:, 0] - mix[:, 1]) * width
        mix = np.stack([mid + side, mid - side], axis=1)
    # Bus HPF to clean rumble
    out_l = hpf(mix[:, 0], sr, 28.0)
    out_r = hpf(mix[:, 1], sr, 28.0)
    return np.stack([out_l, out_r], axis=1).astype(np.float32)
