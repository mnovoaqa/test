"""Reverb (FFT convolution with synthesized IR) and delay (scipy IIR)."""
from __future__ import annotations

import numpy as np
from scipy.signal import fftconvolve, lfilter

from .eq import lpf, bandpass


def _synth_ir(sr: int, decay_s: float, damping: float, pre_delay_ms: float, rng: np.random.Generator) -> np.ndarray:
    """Synthesize a vocal-friendly stereo IR: decaying noise + lowpass + pre-delay."""
    ir_len = max(int(decay_s * sr), 1024)
    t = np.arange(ir_len) / sr
    env = np.exp(-t * (6.0 / max(decay_s, 0.05)))
    # Add an early-reflection cluster (sparse impulses in first 80 ms)
    er_n = int(0.08 * sr)
    er = np.zeros(er_n, dtype=np.float32)
    for _ in range(8):
        k = int(rng.uniform(0.005, 0.08) * sr)
        if k < er_n:
            er[k] += rng.uniform(-0.6, 0.6)
    noise_l = (rng.standard_normal(ir_len).astype(np.float32) * env).astype(np.float32)
    noise_r = (rng.standard_normal(ir_len).astype(np.float32) * env).astype(np.float32)
    noise_l[: len(er)] += er
    noise_r[: len(er)] += er * rng.uniform(0.7, 1.0)
    cutoff = 14000.0 * (1 - damping) + 2000.0
    noise_l = lpf(noise_l, sr, cutoff)
    noise_r = lpf(noise_r, sr, cutoff)
    pre = int(pre_delay_ms * 1e-3 * sr)
    ir_l = np.concatenate([np.zeros(pre, dtype=np.float32), noise_l]).astype(np.float32)
    ir_r = np.concatenate([np.zeros(pre, dtype=np.float32), noise_r]).astype(np.float32)
    # Normalize energy (RMS) so wet level is predictable
    rms = np.sqrt(np.mean(ir_l ** 2) + np.mean(ir_r ** 2) + 1e-12)
    ir_l /= rms
    ir_r /= rms
    # Scale so that 100% wet ~ unity gain on broadband input
    ir_l *= 0.05
    ir_r *= 0.05
    return np.stack([ir_l, ir_r], axis=1)


def reverb(
    audio: np.ndarray,
    sr: int,
    decay_s: float = 1.4,
    damping: float = 0.4,
    pre_delay_ms: float = 20.0,
    wet: float = 0.25,
    width: float = 1.0,
    seed: int = 42,
) -> np.ndarray:
    """Mono-in / stereo-out reverb via FFT convolution. Returns (n, 2)."""
    rng = np.random.default_rng(seed)
    ir = _synth_ir(sr, decay_s, damping, pre_delay_ms, rng)
    wet_l = fftconvolve(audio, ir[:, 0], mode="full")[: len(audio)].astype(np.float32)
    wet_r = fftconvolve(audio, ir[:, 1], mode="full")[: len(audio)].astype(np.float32)
    mid = 0.5 * (wet_l + wet_r)
    side = 0.5 * (wet_l - wet_r) * width
    wet_l = mid + side
    wet_r = mid - side
    dry = audio.astype(np.float32)
    out_l = (1 - wet) * dry + wet * wet_l
    out_r = (1 - wet) * dry + wet * wet_r
    return np.stack([out_l, out_r], axis=1).astype(np.float32)


def delay(
    audio: np.ndarray,
    sr: int,
    time_ms: float = 250.0,
    feedback: float = 0.35,
    mix: float = 0.18,
    low_cut: float = 400.0,
    high_cut: float = 6000.0,
) -> np.ndarray:
    """Mono-in / stereo-out tape-style delay. Feedback path is band-limited."""
    d = max(int(time_ms * 1e-3 * sr), 1)
    # Single-tap delay-with-feedback IIR
    a = np.zeros(d + 1, dtype=np.float64)
    a[0] = 1.0
    a[d] = -feedback
    b = np.zeros(d + 1, dtype=np.float64)
    b[d] = 1.0  # output the delayed signal (the feedback IIR provides the regen)
    wet = lfilter(b, a, audio.astype(np.float64)).astype(np.float32)
    wet = bandpass(wet, sr, low_cut, high_cut)
    # Stereo: right channel offset by half delay for width
    d_half = max(int(time_ms * 0.5e-3 * sr), 1)
    wet_r = np.concatenate([np.zeros(d_half, dtype=np.float32), wet])[: len(wet)]
    dry = audio.astype(np.float32)
    out_l = (1 - mix) * dry + mix * wet
    out_r = (1 - mix) * dry + mix * wet_r
    return np.stack([out_l, out_r], axis=1).astype(np.float32)
