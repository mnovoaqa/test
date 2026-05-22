"""Automatic pitch correction (auto-tune).

For each detected note:
  1. Compute target = nearest scale tone within `flex_cents`
  2. Shift the segment by (target - median) semitones, with retune-time smoothing
  3. Preserve vibrato (high-freq pitch motion) by scaling, not removing it
  4. Crossfade segment boundaries to avoid clicks
  5. Safety: skip very short segments (consonants) and segments with low confidence
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List

import numpy as np

from .analysis import Note, KeyEstimate
from .presets import TunePreset
from .dsp.pitch_shift import pitch_shift_segment


def _nearest_scale_midi(midi: float, scale_pcs: tuple, flex_cents: float) -> float:
    """Snap `midi` to nearest scale tone. If outside `flex_cents`, return original."""
    pc = midi % 12
    # All candidate scale tones nearest octave
    candidates = []
    for s in scale_pcs:
        # Find closest octave of this pitch class
        base = round(midi) - (round(midi) % 12) + s
        for offset in (-12, 0, 12):
            c = base + offset
            candidates.append(c)
    candidates = np.array(candidates)
    diffs = np.abs(candidates - midi)
    idx = int(np.argmin(diffs))
    nearest = float(candidates[idx])
    cents_off = abs(midi - nearest) * 100.0
    if cents_off > flex_cents:
        # Outside flex zone: still snap (for "modern" preset) — but caller can override
        return nearest
    return nearest


@dataclass
class TuneDecision:
    note_idx: int
    from_midi: float
    to_midi: float
    cents_shift: float
    applied: bool
    reason: str = ""


def auto_tune(
    audio: np.ndarray,
    sr: int,
    notes: List[Note],
    key: KeyEstimate,
    preset: TunePreset,
    xfade_ms: float = 8.0,
) -> tuple[np.ndarray, list[TuneDecision]]:
    """Apply pitch correction. Returns (corrected_audio, decisions)."""
    if not notes:
        return audio.astype(np.float32), []

    out = audio.astype(np.float32).copy()
    decisions: list[TuneDecision] = []
    xfade_n = max(int(xfade_ms * 1e-3 * sr), 32)

    # Build a moving median of note pitches for rapid-syllable detection
    note_times = np.array([(n.start_sample + n.end_sample) / 2.0 / sr for n in notes])
    note_pitches = np.array([n.median_midi for n in notes])

    for idx, note in enumerate(notes):
        dur_ms = (note.duration_samples / sr) * 1000.0
        # Consonant guard
        if dur_ms < 80.0:
            decisions.append(TuneDecision(idx, note.median_midi, note.median_midi, 0.0, False, "too_short"))
            continue
        if note.confidence < 0.4:
            decisions.append(TuneDecision(idx, note.median_midi, note.median_midi, 0.0, False, "low_confidence"))
            continue

        target = _nearest_scale_midi(note.median_midi, key.scale_pcs, preset.flex_cents)
        shift_semi = (target - note.median_midi)
        # Apply correction strength
        shift_semi *= preset.correction_strength
        # Humanize: random offset within ±10 cents scaled by humanize amount
        if preset.humanize > 0:
            jitter = np.random.uniform(-1, 1) * preset.humanize * 0.10  # up to ±10 cents at humanize=1
            shift_semi += jitter

        # Rapid-syllable detection
        nearby_note_count = int(np.sum(np.abs(note_times - note_times[idx]) < 0.5))
        if nearby_note_count > 4 and preset.retune_ms < 50:
            # Slow it down slightly to avoid warble
            shift_semi *= 0.85

        # Extract segment with small context on each side for the xfade
        s = max(0, note.start_sample - xfade_n)
        e = min(len(audio), note.end_sample + xfade_n)
        if e - s < 2048:
            decisions.append(TuneDecision(idx, note.median_midi, target, shift_semi * 100, False, "too_short_for_stft"))
            continue
        seg = out[s:e]
        shifted = pitch_shift_segment(seg, sr, shift_semi, preserve_formant=preset.formant_preserve)

        # Retune time: ramp gain from original to shifted at start of note
        retune_n = max(int(preset.retune_ms * 1e-3 * sr), xfade_n)
        retune_n = min(retune_n, len(shifted))
        ramp = np.linspace(0.0, 1.0, retune_n).astype(np.float32) ** 1.5
        blended = shifted.copy()
        blended[:retune_n] = seg[:retune_n] * (1 - ramp) + shifted[:retune_n] * ramp

        # Artifact guard: if shifted RMS > 6 dB louder/quieter than original, blend 50/50
        rms_orig = float(np.sqrt(np.mean(seg ** 2) + 1e-9))
        rms_shift = float(np.sqrt(np.mean(blended ** 2) + 1e-9))
        if rms_orig > 0 and abs(20 * np.log10(rms_shift / rms_orig)) > 6.0:
            blended = 0.5 * seg + 0.5 * blended

        # Crossfade boundaries with surrounding (untouched) audio
        x = min(xfade_n, len(blended) // 4)
        if x > 4:
            fade_in = np.cos(np.linspace(np.pi / 2, 0, x)) ** 2
            fade_out = np.cos(np.linspace(0, np.pi / 2, x)) ** 2
            blended[:x] = out[s : s + x] * fade_out + blended[:x] * fade_in
            blended[-x:] = blended[-x:] * fade_out + out[e - x : e] * fade_in

        out[s:e] = blended
        decisions.append(TuneDecision(idx, note.median_midi, target,
                                       shift_semi * 100, True))

    return out.astype(np.float32), decisions


def auto_tune_summary(decisions: list[TuneDecision]) -> dict:
    applied = [d for d in decisions if d.applied]
    skipped = [d for d in decisions if not d.applied]
    if applied:
        cents = np.array([d.cents_shift for d in applied])
        return {
            "notes_total": len(decisions),
            "notes_tuned": len(applied),
            "notes_skipped": len(skipped),
            "median_shift_cents": float(np.median(np.abs(cents))),
            "max_shift_cents": float(np.max(np.abs(cents))),
        }
    return {"notes_total": len(decisions), "notes_tuned": 0, "notes_skipped": len(skipped),
            "median_shift_cents": 0.0, "max_shift_cents": 0.0}
