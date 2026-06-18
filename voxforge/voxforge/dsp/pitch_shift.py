"""Pitch shifting with formant control.

Approach: phase-vocoder pitch shift via librosa (high quality), with
optional formant preservation by spectral envelope warping.
"""
from __future__ import annotations

import numpy as np
import librosa


def pitch_shift_segment(
    audio: np.ndarray,
    sr: int,
    n_semitones: float,
    preserve_formant: bool = True,
    n_fft: int = 2048,
) -> np.ndarray:
    """Shift `audio` by `n_semitones`. Length preserved (within ~1 sample)."""
    if abs(n_semitones) < 1e-3 or len(audio) < n_fft * 2:
        return audio.astype(np.float32)
    shifted = librosa.effects.pitch_shift(
        y=audio.astype(np.float32),
        sr=sr,
        n_steps=float(n_semitones),
        bins_per_octave=12,
        res_type="soxr_hq",
    )
    if len(shifted) != len(audio):
        if len(shifted) > len(audio):
            shifted = shifted[: len(audio)]
        else:
            shifted = np.pad(shifted, (0, len(audio) - len(shifted)))
    if preserve_formant:
        shifted = _formant_correct(audio, shifted, sr, n_semitones, n_fft=n_fft)
    return shifted.astype(np.float32)


def _smoothed_envelope(spec_mag: np.ndarray, smoothing: int = 30) -> np.ndarray:
    """Spectral envelope via moving-average smoothing of magnitude spectrum."""
    if smoothing < 2:
        return spec_mag
    kernel = np.ones(smoothing, dtype=np.float32) / smoothing
    out = np.empty_like(spec_mag)
    for k in range(spec_mag.shape[1]):
        out[:, k] = np.convolve(spec_mag[:, k], kernel, mode="same")
    return np.maximum(out, 1e-9)


def _formant_correct(
    original: np.ndarray,
    shifted: np.ndarray,
    sr: int,
    n_semitones: float,
    n_fft: int = 2048,
) -> np.ndarray:
    """Re-impose the spectral envelope of `original` onto `shifted`."""
    hop = n_fft // 4
    S_orig = librosa.stft(original.astype(np.float32), n_fft=n_fft, hop_length=hop)
    S_shift = librosa.stft(shifted.astype(np.float32), n_fft=n_fft, hop_length=hop)
    mag_orig = np.abs(S_orig)
    mag_shift = np.abs(S_shift)
    phase_shift = np.angle(S_shift)

    # Align frame counts
    nf = min(mag_orig.shape[1], mag_shift.shape[1])
    mag_orig = mag_orig[:, :nf]
    mag_shift = mag_shift[:, :nf]
    phase_shift = phase_shift[:, :nf]

    env_orig = _smoothed_envelope(mag_orig, smoothing=24)
    env_shift = _smoothed_envelope(mag_shift, smoothing=24)
    correction = env_orig / np.maximum(env_shift, 1e-9)
    # Limit extreme corrections (avoid amplifying noise floor)
    correction = np.clip(correction, 0.2, 5.0)
    new_mag = mag_shift * correction
    new_spec = new_mag * np.exp(1j * phase_shift)
    out = librosa.istft(new_spec, hop_length=hop, n_fft=n_fft, length=len(shifted))
    return out.astype(np.float32)


def pitch_shift_curve(
    audio: np.ndarray,
    sr: int,
    semitone_curve: np.ndarray,
    hop_length: int = 512,
    preserve_formant: bool = True,
) -> np.ndarray:
    """Apply a time-varying pitch shift defined by `semitone_curve` (one value per hop).

    Used when the per-note approach is undesirable. For auto-tune we typically
    apply per-segment shifts (cleaner artifacts) — see autotune.py.
    """
    n_segments = max(1, len(audio) // (hop_length * 16))
    seg_len = len(audio) // n_segments
    out_parts = []
    for i in range(n_segments):
        a = i * seg_len
        b = (i + 1) * seg_len if i < n_segments - 1 else len(audio)
        frames = semitone_curve[a // hop_length : b // hop_length]
        shift = float(np.median(frames)) if len(frames) else 0.0
        seg = audio[a:b]
        out_parts.append(pitch_shift_segment(seg, sr, shift, preserve_formant=preserve_formant))
    out = np.concatenate(out_parts)
    if len(out) > len(audio):
        out = out[: len(audio)]
    elif len(out) < len(audio):
        out = np.pad(out, (0, len(audio) - len(out)))
    return out.astype(np.float32)


def crossfade_concat(segments: list[np.ndarray], xfade_samples: int = 64) -> np.ndarray:
    """Concatenate audio segments with equal-power crossfades to hide seams."""
    if not segments:
        return np.zeros(0, dtype=np.float32)
    if len(segments) == 1:
        return segments[0]
    out = segments[0].copy()
    for seg in segments[1:]:
        x = min(xfade_samples, len(out), len(seg))
        if x <= 0:
            out = np.concatenate([out, seg])
            continue
        fade_out = np.cos(np.linspace(0, np.pi / 2, x)) ** 2
        fade_in = np.cos(np.linspace(np.pi / 2, 0, x)) ** 2
        tail = out[-x:] * fade_out + seg[:x] * fade_in
        out = np.concatenate([out[:-x], tail, seg[x:]])
    return out.astype(np.float32)
