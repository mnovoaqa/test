"""Original synth-based sound sources for beat generation.

All sounds are synthesized from scratch (no samples) to avoid copyright.
- Kick (sub + click)
- Snare (tonal + noise)
- Hi-hat (filtered noise)
- 808 (sine sub with pitch glide + saturation)
- Pluck / lead (additive + envelope)
- Piano-ish (FM-lite)
"""
from __future__ import annotations

import numpy as np
from scipy.signal import butter, sosfilt


def _adsr(n: int, attack: float, decay: float, sustain: float, release: float, sr: int) -> np.ndarray:
    """Sample-accurate ADSR envelope. Times in seconds; n = total length in samples.

    Gracefully degrades when n is short: segments are proportionally scaled.
    """
    a = max(int(attack * sr), 1)
    d = max(int(decay * sr), 1)
    r = max(int(release * sr), 1)
    # If the requested segments exceed total length, scale them down proportionally
    if a + d + r > n:
        scale = n / float(a + d + r)
        a = max(int(a * scale), 1)
        d = max(int(d * scale), 1)
        r = max(n - a - d, 1)
    s_len = max(n - a - d - r, 0)
    env = np.zeros(n, dtype=np.float32)
    env[:a] = np.linspace(0, 1, a, dtype=np.float32)
    env[a : a + d] = np.linspace(1, sustain, d, dtype=np.float32)
    if s_len > 0:
        env[a + d : a + d + s_len] = sustain
    rel_start = a + d + s_len
    rel_len = n - rel_start
    if rel_len > 0:
        env[rel_start:n] = np.linspace(sustain, 0, rel_len, dtype=np.float32)
    return env


def kick(sr: int, duration_s: float = 0.5, freq_start: float = 110.0, freq_end: float = 45.0,
         click_level: float = 0.4) -> np.ndarray:
    n = int(duration_s * sr)
    t = np.arange(n) / sr
    # Pitch envelope (exponential glide)
    freq = freq_end + (freq_start - freq_end) * np.exp(-t * 30.0)
    phase = 2 * np.pi * np.cumsum(freq) / sr
    body = np.sin(phase).astype(np.float32)
    body_env = np.exp(-t * 6.0).astype(np.float32)
    body *= body_env
    # Click transient
    click = np.zeros(n, dtype=np.float32)
    click_len = min(int(0.003 * sr), n)
    click[:click_len] = (np.random.randn(click_len) * click_level).astype(np.float32)
    # Lowpass the click a bit
    sos = butter(2, 4000.0, btype="lowpass", fs=sr, output="sos")
    click = sosfilt(sos, click).astype(np.float32)
    out = body + click * 0.6
    out *= 0.9 / max(np.max(np.abs(out)), 1e-6)
    return out.astype(np.float32)


def snare(sr: int, duration_s: float = 0.25, tone_freq: float = 200.0,
          noise_level: float = 0.8) -> np.ndarray:
    n = int(duration_s * sr)
    t = np.arange(n) / sr
    tone1 = np.sin(2 * np.pi * tone_freq * t)
    tone2 = np.sin(2 * np.pi * (tone_freq * 1.5) * t)
    tone = (tone1 + 0.5 * tone2).astype(np.float32)
    tone_env = np.exp(-t * 25.0).astype(np.float32)
    tone *= tone_env
    noise = np.random.randn(n).astype(np.float32) * noise_level
    sos_bp = butter(2, [800.0, 8000.0], btype="bandpass", fs=sr, output="sos")
    noise = sosfilt(sos_bp, noise).astype(np.float32)
    noise *= np.exp(-t * 12.0).astype(np.float32)
    out = tone * 0.6 + noise
    out *= 0.85 / max(np.max(np.abs(out)), 1e-6)
    return out.astype(np.float32)


def hihat(sr: int, duration_s: float = 0.08, closed: bool = True) -> np.ndarray:
    n = int(duration_s * sr)
    t = np.arange(n) / sr
    noise = np.random.randn(n).astype(np.float32)
    sos = butter(4, [6000.0, min(15000.0, sr * 0.45)], btype="bandpass", fs=sr, output="sos")
    noise = sosfilt(sos, noise).astype(np.float32)
    decay = 30.0 if closed else 8.0
    env = np.exp(-t * decay).astype(np.float32)
    out = noise * env
    out *= 0.5 / max(np.max(np.abs(out)), 1e-6)
    return out.astype(np.float32)


def sub_808(sr: int, duration_s: float, midi_note: int, glide_from: int | None = None,
            glide_time_s: float = 0.05, drive: float = 1.5) -> np.ndarray:
    """Sub-bass 808 with optional pitch glide from another note."""
    n = int(duration_s * sr)
    t = np.arange(n) / sr
    freq_target = 440.0 * 2 ** ((midi_note - 69) / 12.0)
    if glide_from is not None:
        freq_start = 440.0 * 2 ** ((glide_from - 69) / 12.0)
        glide_n = max(int(glide_time_s * sr), 1)
        freq = np.empty(n, dtype=np.float32)
        freq[:glide_n] = np.linspace(freq_start, freq_target, glide_n)
        freq[glide_n:] = freq_target
    else:
        freq = np.full(n, freq_target, dtype=np.float32)
    phase = 2 * np.pi * np.cumsum(freq) / sr
    osc = np.sin(phase).astype(np.float32)
    osc = np.tanh(osc * drive).astype(np.float32) / max(np.tanh(drive), 1e-6)
    env = _adsr(n, attack=0.005, decay=0.05, sustain=0.85, release=0.15, sr=sr)
    out = osc * env
    out *= 0.9 / max(np.max(np.abs(out)), 1e-6)
    return out.astype(np.float32)


def pluck(sr: int, duration_s: float, midi_note: int, brightness: float = 0.5) -> np.ndarray:
    """Additive pluck: 5 harmonics, fast decay per harmonic (higher = faster)."""
    n = int(duration_s * sr)
    t = np.arange(n) / sr
    f0 = 440.0 * 2 ** ((midi_note - 69) / 12.0)
    out = np.zeros(n, dtype=np.float32)
    for k in range(1, 7):
        amp = (1.0 / k) * (1 + brightness * (k - 1) * 0.15)
        decay = 3.0 + k * (1.0 - brightness * 0.5)
        out += amp * np.sin(2 * np.pi * f0 * k * t) * np.exp(-t * decay)
    out *= 0.5 / max(np.max(np.abs(out)), 1e-6)
    return out.astype(np.float32)


def pad(sr: int, duration_s: float, midi_notes: list[int], detune_cents: float = 8.0) -> np.ndarray:
    """Slow attack chord pad: detuned saws stacked, lowpassed."""
    n = int(duration_s * sr)
    t = np.arange(n) / sr
    out = np.zeros(n, dtype=np.float32)
    for note in midi_notes:
        f0 = 440.0 * 2 ** ((note - 69) / 12.0)
        for det in [-detune_cents, 0.0, detune_cents]:
            f = f0 * 2 ** (det / 1200.0)
            # Bandlimited-ish saw (3 harmonics)
            for k in range(1, 4):
                if f * k > sr / 2 - 1000:
                    break
                out += (1.0 / k) * np.sin(2 * np.pi * f * k * t)
    env = _adsr(n, attack=0.25, decay=0.5, sustain=0.7, release=0.6, sr=sr)
    out *= env
    sos = butter(4, 2500.0, btype="lowpass", fs=sr, output="sos")
    out = sosfilt(sos, out).astype(np.float32)
    out *= 0.5 / max(np.max(np.abs(out)), 1e-6)
    return out.astype(np.float32)


def piano_note(sr: int, duration_s: float, midi_note: int) -> np.ndarray:
    """FM-lite piano-ish: 2-op FM with envelope."""
    n = int(duration_s * sr)
    t = np.arange(n) / sr
    f0 = 440.0 * 2 ** ((midi_note - 69) / 12.0)
    # Modulator: 1x carrier
    fm_env = np.exp(-t * 8.0).astype(np.float32)
    mod = np.sin(2 * np.pi * f0 * t) * fm_env * 3.0
    car = np.sin(2 * np.pi * f0 * t + mod).astype(np.float32)
    env = _adsr(n, attack=0.005, decay=0.4, sustain=0.25, release=0.4, sr=sr)
    out = car * env
    # Add a soft octave below
    out += 0.3 * np.sin(2 * np.pi * f0 * 0.5 * t) * env
    out *= 0.6 / max(np.max(np.abs(out)), 1e-6)
    return out.astype(np.float32)


def overlay(target: np.ndarray, sample: np.ndarray, position_samples: int, gain: float = 1.0,
            pan: float = 0.0) -> None:
    """Mix `sample` into stereo `target` (n, 2) at given offset. Pan in [-1, 1]."""
    n = target.shape[0]
    start = max(0, position_samples)
    end = min(n, start + len(sample))
    if end <= start:
        return
    seg = sample[: end - start] * gain
    l = 1.0 - max(0.0, pan)
    r = 1.0 + min(0.0, pan)
    target[start:end, 0] += seg * l
    target[start:end, 1] += seg * r
