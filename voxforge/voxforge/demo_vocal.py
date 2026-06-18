"""Synthesize a rough vocal-like signal for testing the pipeline end-to-end
without needing a user recording.

Generates a formant-filtered sawtooth following a melodic line with intentional
pitch deviation, breath gaps, and amplitude envelope - enough that auto-tune,
key detection, and the whole chain have something to work with.
"""
from __future__ import annotations

import numpy as np
from scipy.signal import butter, sosfilt

from .analysis import MAJOR_SCALE, MINOR_SCALE


def _vowel_filter(audio: np.ndarray, sr: int, vowel: str = "a") -> np.ndarray:
    """Simulate a vowel by stacking 3 resonant bandpasses at formant frequencies."""
    formants = {
        "a": [(700, 100), (1220, 110), (2600, 120)],
        "e": [(530, 90),  (1840, 110), (2480, 120)],
        "i": [(390, 80),  (1990, 100), (2550, 120)],
        "o": [(430, 80),  (840, 90),   (2240, 110)],
        "u": [(320, 80),  (920, 90),   (2200, 120)],
    }[vowel]
    out = np.zeros_like(audio)
    for f, bw in formants:
        low = max(50.0, f - bw)
        high = min(sr / 2 - 100, f + bw)
        sos = butter(2, [low, high], btype="bandpass", fs=sr, output="sos")
        out += sosfilt(sos, audio).astype(np.float32)
    return (out / 3.0).astype(np.float32)


def synth_demo_vocal(
    sr: int = 48000,
    duration_s: float = 15.0,
    base_midi: int = 50,            # D3 ~ baritone (tonic of the scale)
    mode: str = "minor",
    bpm: float = 90.0,
    deviation_cents: float = 35.0,  # intentional pitch error so auto-tune does something
    seed: int = 7,
) -> np.ndarray:
    """Generate a synthetic vocal: melody on a scale with intentional pitch deviation.

    The scale tonic = `base_midi`. e.g. base_midi=50 + mode='minor' → D3 minor.
    """
    rng = np.random.default_rng(seed)
    scale = MINOR_SCALE if mode == "minor" else MAJOR_SCALE
    # Two octaves of the scale so the melody has room to move
    scale_midis = [base_midi + p for p in scale] + [base_midi + 12 + p for p in scale]

    # Build melody: one note per beat (quarter note)
    beat_s = 60.0 / bpm
    n_notes = int(duration_s / beat_s)
    out = np.zeros(int(duration_s * sr), dtype=np.float32)
    cursor = 0
    melody_idx = 0
    vowels = ["a", "e", "i", "o", "u"]
    for i in range(n_notes):
        # Pick a scale tone, biased toward 1, 3, 5 of scale
        idx = melody_idx + rng.integers(-2, 3)
        idx = max(0, min(len(scale_midis) - 1, idx))
        target_midi = scale_midis[idx]
        # Add intentional deviation in cents
        cents_off = rng.uniform(-deviation_cents, deviation_cents)
        midi_actual = target_midi + cents_off / 100.0
        freq = 440.0 * 2 ** ((midi_actual - 69) / 12.0)
        # Note length: most full beats, occasional 2-beat hold
        hold_beats = 2 if rng.random() < 0.15 else 1
        n_samples = int(beat_s * hold_beats * sr)
        if cursor + n_samples > len(out):
            n_samples = len(out) - cursor
            if n_samples <= 0:
                break
        # Small breath gap at end (silence)
        gap = int(0.05 * sr)
        active = max(n_samples - gap, n_samples // 2)
        t = np.arange(active) / sr
        # Small natural vibrato (~5 Hz, ±15 cents)
        vib = np.sin(2 * np.pi * 5.0 * t) * (15.0 / 100.0)
        f_curve = freq * 2 ** (vib / 12.0)
        # Phase from cumulative freq
        phase = 2 * np.pi * np.cumsum(f_curve) / sr
        # Sawtooth-like via summed harmonics (4 harmonics)
        sig = np.zeros(active, dtype=np.float32)
        for k in range(1, 5):
            sig += (1.0 / k) * np.sin(k * phase)
        # Apply vowel filter
        vowel = vowels[i % len(vowels)]
        sig = _vowel_filter(sig.astype(np.float32), sr, vowel)
        # Amplitude envelope (rapid attack, slow decay-ish)
        env = np.ones(active, dtype=np.float32)
        atk = int(0.02 * sr)
        rel = int(0.05 * sr)
        if atk < active:
            env[:atk] = np.linspace(0, 1, atk)
        if rel < active:
            env[-rel:] = np.linspace(1, 0, rel)
        sig *= env
        # Random gain variation
        sig *= rng.uniform(0.7, 1.0)
        out[cursor : cursor + active] += sig
        cursor += n_samples
        melody_idx = idx
        if cursor >= len(out):
            break

    # Normalize to ~-6 dBFS peak
    peak = float(np.max(np.abs(out)))
    if peak > 0:
        out *= 0.5 / peak
    # Add a small amount of broadband noise (mic noise)
    out += rng.normal(0, 0.0008, size=out.shape).astype(np.float32)
    return out.astype(np.float32)
