"""Equalizers: HPF, LPF, peaking, shelving. Biquad cookbook + scipy butter."""
from __future__ import annotations

import numpy as np
from scipy.signal import butter, sosfiltfilt, sosfilt


def hpf(audio: np.ndarray, sr: int, cutoff: float = 80.0, order: int = 2) -> np.ndarray:
    sos = butter(order, cutoff, btype="highpass", fs=sr, output="sos")
    return sosfiltfilt(sos, audio).astype(np.float32)


def lpf(audio: np.ndarray, sr: int, cutoff: float = 18000.0, order: int = 2) -> np.ndarray:
    cutoff = min(cutoff, sr * 0.49)
    sos = butter(order, cutoff, btype="lowpass", fs=sr, output="sos")
    return sosfiltfilt(sos, audio).astype(np.float32)


def bandpass(audio: np.ndarray, sr: int, low: float, high: float, order: int = 2) -> np.ndarray:
    high = min(high, sr * 0.49)
    sos = butter(order, [low, high], btype="bandpass", fs=sr, output="sos")
    return sosfiltfilt(sos, audio).astype(np.float32)


def _biquad_peak(freq: float, q: float, gain_db: float, sr: int):
    """RBJ peaking EQ coefficients."""
    A = 10 ** (gain_db / 40.0)
    w0 = 2 * np.pi * freq / sr
    alpha = np.sin(w0) / (2 * q)
    cos_w0 = np.cos(w0)
    b0 = 1 + alpha * A
    b1 = -2 * cos_w0
    b2 = 1 - alpha * A
    a0 = 1 + alpha / A
    a1 = -2 * cos_w0
    a2 = 1 - alpha / A
    b = np.array([b0, b1, b2]) / a0
    a = np.array([1.0, a1 / a0, a2 / a0])
    return b, a


def _biquad_shelf(freq: float, gain_db: float, sr: int, kind: str = "low"):
    """RBJ shelving EQ. kind = 'low' or 'high'."""
    A = 10 ** (gain_db / 40.0)
    w0 = 2 * np.pi * freq / sr
    S = 1.0
    alpha = np.sin(w0) / 2 * np.sqrt((A + 1 / A) * (1 / S - 1) + 2)
    cos_w0 = np.cos(w0)
    sqrtA = np.sqrt(A)
    if kind == "low":
        b0 = A * ((A + 1) - (A - 1) * cos_w0 + 2 * sqrtA * alpha)
        b1 = 2 * A * ((A - 1) - (A + 1) * cos_w0)
        b2 = A * ((A + 1) - (A - 1) * cos_w0 - 2 * sqrtA * alpha)
        a0 = (A + 1) + (A - 1) * cos_w0 + 2 * sqrtA * alpha
        a1 = -2 * ((A - 1) + (A + 1) * cos_w0)
        a2 = (A + 1) + (A - 1) * cos_w0 - 2 * sqrtA * alpha
    else:
        b0 = A * ((A + 1) + (A - 1) * cos_w0 + 2 * sqrtA * alpha)
        b1 = -2 * A * ((A - 1) + (A + 1) * cos_w0)
        b2 = A * ((A + 1) + (A - 1) * cos_w0 - 2 * sqrtA * alpha)
        a0 = (A + 1) - (A - 1) * cos_w0 + 2 * sqrtA * alpha
        a1 = 2 * ((A - 1) - (A + 1) * cos_w0)
        a2 = (A + 1) - (A - 1) * cos_w0 - 2 * sqrtA * alpha
    b = np.array([b0, b1, b2]) / a0
    a = np.array([1.0, a1 / a0, a2 / a0])
    return b, a


def peak_eq(audio: np.ndarray, sr: int, freq: float, q: float, gain_db: float) -> np.ndarray:
    if abs(gain_db) < 1e-3:
        return audio.astype(np.float32)
    b, a = _biquad_peak(freq, q, gain_db, sr)
    from scipy.signal import filtfilt
    return filtfilt(b, a, audio).astype(np.float32)


def low_shelf(audio: np.ndarray, sr: int, freq: float, gain_db: float) -> np.ndarray:
    if abs(gain_db) < 1e-3:
        return audio.astype(np.float32)
    b, a = _biquad_shelf(freq, gain_db, sr, "low")
    from scipy.signal import filtfilt
    return filtfilt(b, a, audio).astype(np.float32)


def high_shelf(audio: np.ndarray, sr: int, freq: float, gain_db: float) -> np.ndarray:
    if abs(gain_db) < 1e-3:
        return audio.astype(np.float32)
    b, a = _biquad_shelf(freq, gain_db, sr, "high")
    from scipy.signal import filtfilt
    return filtfilt(b, a, audio).astype(np.float32)


def tilt_eq(audio: np.ndarray, sr: int, tilt_db: float) -> np.ndarray:
    """Positive tilt = brighter (lo cut, hi boost). Negative = warmer."""
    out = low_shelf(audio, sr, 200.0, -tilt_db * 0.5)
    out = high_shelf(out, sr, 8000.0, tilt_db * 0.5)
    return out


def detect_resonances(audio: np.ndarray, sr: int, n_peaks: int = 3, fmin: float = 200.0, fmax: float = 4000.0):
    """Find prominent spectral peaks for surgical EQ. Returns list of (freq_hz, prominence_db)."""
    from scipy.signal import find_peaks
    n_fft = 1 << 14
    win = np.hanning(min(len(audio), n_fft))
    seg = audio[: len(win)] * win
    if len(seg) < n_fft:
        seg = np.pad(seg, (0, n_fft - len(seg)))
    spec = np.abs(np.fft.rfft(seg, n_fft))
    spec_db = 20 * np.log10(spec + 1e-12)
    freqs = np.fft.rfftfreq(n_fft, 1 / sr)
    mask = (freqs >= fmin) & (freqs <= fmax)
    peaks, props = find_peaks(spec_db[mask], prominence=4.0, distance=20)
    if len(peaks) == 0:
        return []
    prom = props["prominences"]
    order = np.argsort(prom)[::-1][:n_peaks]
    freqs_masked = freqs[mask]
    return [(float(freqs_masked[peaks[i]]), float(prom[i])) for i in order]
