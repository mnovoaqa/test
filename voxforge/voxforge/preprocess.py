"""Vocal preprocessing: loudness normalize, denoise, HPF, silence trim,
plosive mitigation, clip repair, resonance taming.
"""
from __future__ import annotations

import numpy as np
from scipy.signal import butter, sosfilt
from scipy.ndimage import median_filter

from .dsp.eq import hpf, peak_eq, detect_resonances


def rms_normalize(audio: np.ndarray, target_dbfs: float = -20.0) -> np.ndarray:
    rms = float(np.sqrt(np.mean(audio.astype(np.float64) ** 2)) + 1e-12)
    cur_db = 20.0 * np.log10(rms + 1e-12)
    gain_db = target_dbfs - cur_db
    g = 10.0 ** (gain_db / 20.0)
    return (audio * g).astype(np.float32)


def spectral_gate_denoise(
    audio: np.ndarray, sr: int, strength: float = 0.6, n_fft: int = 2048,
    noise_seconds: float = 0.5,
) -> np.ndarray:
    """Stationary-noise spectral gating.

    Estimates noise floor from the quietest portions of the signal,
    then subtracts a scaled version of it from every magnitude frame.
    `strength` 0..1 controls aggressiveness.
    """
    import librosa
    if strength <= 0:
        return audio.astype(np.float32)
    hop = n_fft // 4
    S = librosa.stft(audio.astype(np.float32), n_fft=n_fft, hop_length=hop)
    mag = np.abs(S)
    phase = np.angle(S)
    # Frames sorted by total energy; bottom 10% as noise reference
    frame_energy = mag.sum(axis=0)
    cutoff = np.quantile(frame_energy, 0.10)
    noise_mask = frame_energy <= cutoff
    if not noise_mask.any():
        noise_mask = frame_energy <= np.quantile(frame_energy, 0.25)
    noise_profile = mag[:, noise_mask].mean(axis=1, keepdims=True) + 1e-9
    # Subtract scaled noise floor
    sub = mag - strength * 1.5 * noise_profile
    sub = np.maximum(sub, mag * (1.0 - strength))  # floor at attenuated original
    # Slight smoothing in time to avoid musical noise
    if sub.shape[1] >= 3:
        sub = median_filter(sub, size=(1, 3))
    out_spec = sub * np.exp(1j * phase)
    out = librosa.istft(out_spec, hop_length=hop, n_fft=n_fft, length=len(audio))
    return out.astype(np.float32)


def trim_silence(audio: np.ndarray, sr: int, threshold_dbfs: float = -50.0,
                 frame_ms: float = 20.0, keep_pad_ms: float = 100.0) -> np.ndarray:
    """Trim leading/trailing silence. Does NOT cut interior silence."""
    frame_n = max(int(frame_ms * 1e-3 * sr), 32)
    pad_n = int(keep_pad_ms * 1e-3 * sr)
    abs_a = np.abs(audio)
    # Energy per frame
    n_frames = len(abs_a) // frame_n
    if n_frames < 2:
        return audio.astype(np.float32)
    energy = abs_a[: n_frames * frame_n].reshape(n_frames, frame_n).max(axis=1)
    thr = 10.0 ** (threshold_dbfs / 20.0)
    above = energy > thr
    if not above.any():
        return audio.astype(np.float32)
    first = max(0, np.argmax(above) * frame_n - pad_n)
    last = min(len(audio), (len(above) - np.argmax(above[::-1])) * frame_n + pad_n)
    return audio[first:last].astype(np.float32)


def mitigate_plosives(audio: np.ndarray, sr: int, threshold_db: float = -30.0) -> np.ndarray:
    """Detect low-freq transient bursts (<150 Hz) and notch them out."""
    sos = butter(2, 150.0, btype="lowpass", fs=sr, output="sos")
    lows = sosfilt(sos, audio).astype(np.float32)
    abs_l = np.abs(lows)
    # Detect transients: local max > threshold AND > 4x surrounding average
    win = max(int(0.05 * sr), 256)
    moving = np.convolve(abs_l, np.ones(win, dtype=np.float32) / win, mode="same")
    thr = 10.0 ** (threshold_db / 20.0)
    transient_mask = (abs_l > thr) & (abs_l > 4.0 * moving)
    if not transient_mask.any():
        return audio.astype(np.float32)
    # Dip the low band by 9 dB for ~80 ms around each detection
    dip_n = int(0.08 * sr)
    duck = np.ones(len(audio), dtype=np.float32)
    idx = np.where(transient_mask)[0]
    for i in idx:
        a = max(0, i - dip_n // 2)
        b = min(len(audio), i + dip_n // 2)
        duck[a:b] = np.minimum(duck[a:b], 0.35)  # ~ -9 dB
    out = audio - lows + lows * duck
    return out.astype(np.float32)


def repair_clips(audio: np.ndarray, threshold: float = 0.99) -> np.ndarray:
    """Replace short clipped regions with cubic-spline interpolation."""
    out = audio.copy()
    clipped = np.abs(out) >= threshold
    if not clipped.any():
        return out
    # Identify runs
    diffs = np.diff(clipped.astype(np.int8))
    starts = np.where(diffs == 1)[0] + 1
    ends = np.where(diffs == -1)[0] + 1
    if clipped[0]:
        starts = np.concatenate([[0], starts])
    if clipped[-1]:
        ends = np.concatenate([ends, [len(out)]])
    for s, e in zip(starts, ends):
        if e - s > 8:
            continue  # too long; can't interp credibly
        a = max(0, s - 4)
        b = min(len(out), e + 4)
        if b - a < 6:
            continue
        idx_known = np.array([i for i in range(a, b) if not (s <= i < e)])
        if len(idx_known) < 4:
            continue
        vals_known = out[idx_known]
        idx_fill = np.arange(s, e)
        # Cubic interp via polyfit on the local segment
        try:
            coeffs = np.polyfit(idx_known, vals_known, 3)
            out[s:e] = np.polyval(coeffs, idx_fill)
        except np.linalg.LinAlgError:
            continue
    return out.astype(np.float32)


def tame_resonances(audio: np.ndarray, sr: int) -> np.ndarray:
    """Detect prominent peaks in 200-4000 Hz and apply gentle dips."""
    peaks = detect_resonances(audio, sr, n_peaks=2)
    out = audio
    for freq, prom in peaks:
        if prom < 6:
            continue
        gain = -min(prom * 0.4, 3.0)  # cap dip at -3 dB
        out = peak_eq(out, sr, freq, q=4.0, gain_db=gain)
    return out.astype(np.float32)


def preprocess(
    audio: np.ndarray,
    sr: int,
    denoise_strength: float = 0.5,
    hpf_hz: float = 80.0,
    tame_resonances_on: bool = True,
) -> np.ndarray:
    """Full preprocessing chain."""
    x = rms_normalize(audio, target_dbfs=-20.0)
    x = spectral_gate_denoise(x, sr, strength=denoise_strength)
    x = hpf(x, sr, cutoff=hpf_hz)
    x = trim_silence(x, sr)
    x = mitigate_plosives(x, sr)
    x = repair_clips(x)
    if tame_resonances_on:
        x = tame_resonances(x, sr)
    return x.astype(np.float32)
