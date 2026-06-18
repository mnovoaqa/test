"""Beat / instrumental generation per genre.

Deterministic-with-variation generator: drums, bass (808), chord pad,
optional piano, all synthesized from `dsp.synth` (no samples; copyright-safe).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Tuple

import numpy as np

from .analysis import VocalAnalysis, KeyEstimate, PITCH_NAMES
from .presets import GenrePreset
from .dsp import synth
from .dsp.eq import hpf, lpf
from .dsp.dynamics import sidechain_compressor


# ------- music theory helpers ---------------------------------------------


_ROMAN_TO_DEGREE = {
    "I": 0, "II": 1, "III": 2, "IV": 3, "V": 4, "VI": 5, "VII": 6,
}


def _parse_roman(rn: str) -> tuple[int, str]:
    """Return (scale_degree_0idx, 'major'|'minor'|'dim')."""
    raw = rn.replace("°", "")
    is_minor = raw[0].islower()
    is_dim = rn.endswith("°")
    key = raw.upper()
    deg = _ROMAN_TO_DEGREE[key]
    if is_dim:
        return deg, "dim"
    return deg, "minor" if is_minor else "major"


def chord_to_midi(roman: str, key: KeyEstimate, octave: int = 4) -> list[int]:
    """Return MIDI notes for a chord (triad) in the given key."""
    deg, quality = _parse_roman(roman)
    # Compute root pitch class
    scale_pc = key.scale_pcs[deg]
    root_midi = octave * 12 + scale_pc
    # Ensure root sits between C3 and B4 ballpark
    while root_midi < 48:
        root_midi += 12
    while root_midi > 67:
        root_midi -= 12
    if quality == "major":
        return [root_midi, root_midi + 4, root_midi + 7]
    if quality == "minor":
        return [root_midi, root_midi + 3, root_midi + 7]
    return [root_midi, root_midi + 3, root_midi + 6]  # dim


# ------- drum patterns -----------------------------------------------------


def _step_grid(n_steps: int) -> np.ndarray:
    return np.zeros(n_steps, dtype=np.float32)


def _trap_pattern(rng: np.random.Generator) -> dict:
    """16 steps per bar. Trap, half-time feel."""
    kick = _step_grid(16)
    kick[0] = 1.0
    kick[10] = 1.0
    # Occasional ghost kicks
    if rng.random() < 0.5:
        kick[7] = 0.5
    snare = _step_grid(16)
    snare[8] = 1.0    # half-time snare
    hat = _step_grid(16)
    hat[:] = 0.6
    hat[::2] = 0.8
    # Random rolls: replace some 16ths with 32nd-note doubles by boosting amplitude
    for i in range(16):
        r = rng.random()
        if r < 0.10:
            hat[i] = 1.0
        elif r < 0.15:
            hat[i] = 0.3
    open_hat = _step_grid(16)
    if rng.random() < 0.5:
        open_hat[6] = 0.7
    return {"kick": kick, "snare": snare, "hat": hat, "open_hat": open_hat}


def _boom_bap_pattern(rng: np.random.Generator) -> dict:
    kick = _step_grid(16); kick[0] = 1.0; kick[10] = 1.0
    if rng.random() < 0.4: kick[8] = 0.6
    snare = _step_grid(16); snare[4] = 1.0; snare[12] = 1.0
    hat = _step_grid(16); hat[::2] = 0.7
    return {"kick": kick, "snare": snare, "hat": hat, "open_hat": _step_grid(16)}


def _drill_pattern(rng: np.random.Generator) -> dict:
    kick = _step_grid(16); kick[0] = 1.0; kick[3] = 0.7; kick[10] = 1.0; kick[13] = 0.7
    snare = _step_grid(16); snare[8] = 1.0
    hat = _step_grid(16); hat[:] = 0.6
    for i in range(16):
        if rng.random() < 0.15: hat[i] = 1.0
    return {"kick": kick, "snare": snare, "hat": hat, "open_hat": _step_grid(16)}


def _rnb_pattern(rng: np.random.Generator) -> dict:
    kick = _step_grid(16); kick[0] = 1.0; kick[10] = 1.0
    if rng.random() < 0.6: kick[6] = 0.5
    snare = _step_grid(16); snare[4] = 1.0; snare[12] = 1.0
    if rng.random() < 0.6:
        snare[2] = 0.3; snare[6] = 0.3; snare[14] = 0.3   # ghost notes
    hat = _step_grid(16); hat[::2] = 0.45
    return {"kick": kick, "snare": snare, "hat": hat, "open_hat": _step_grid(16)}


_DRUM_PATTERN_FNS = {
    "trap": _trap_pattern,
    "boom_bap": _boom_bap_pattern,
    "drill": _drill_pattern,
    "rnb": _rnb_pattern,
    "melodic": _trap_pattern,
}


# ------- arrangement -------------------------------------------------------


@dataclass
class Arrangement:
    bpm: float
    total_bars: int
    bar_samples: int
    sections: List[Tuple[int, int, str]]   # (start_bar, end_bar, label)


def plan_arrangement(vocal_dur_s: float, bpm: float, preset: GenrePreset,
                     sr: int = 48000) -> Arrangement:
    """Decide intro/verse/hook structure given vocal length."""
    beats_per_bar = 4
    bar_s = (60.0 / bpm) * beats_per_bar
    if preset.half_time:
        # In half-time genres we still keep 4/4 bars; just feel changes.
        pass
    bar_samples = int(bar_s * sr)
    # Target song length: vocal_dur + 4 bars intro + 4 bars outro
    intro_bars = 4
    outro_bars = 4
    body_bars = max(8, int(np.ceil(vocal_dur_s / bar_s)) + 2)
    total_bars = intro_bars + body_bars + outro_bars

    sections = []
    cur = 0
    sections.append((cur, cur + intro_bars, "intro")); cur += intro_bars
    # Split body into verse/hook/verse/hook if long enough
    if body_bars >= 32:
        v1 = 8; h1 = 8; v2 = 8; h2 = body_bars - v1 - h1 - v2
        sections.append((cur, cur + v1, "verse")); cur += v1
        sections.append((cur, cur + h1, "hook"));  cur += h1
        sections.append((cur, cur + v2, "verse")); cur += v2
        sections.append((cur, cur + h2, "hook"));  cur += h2
    elif body_bars >= 16:
        v1 = body_bars // 2; h1 = body_bars - v1
        sections.append((cur, cur + v1, "verse")); cur += v1
        sections.append((cur, cur + h1, "hook"));  cur += h1
    else:
        sections.append((cur, cur + body_bars, "verse")); cur += body_bars
    sections.append((cur, cur + outro_bars, "outro"))
    return Arrangement(bpm=bpm, total_bars=total_bars, bar_samples=bar_samples,
                       sections=sections)


# ------- renderers ---------------------------------------------------------


def _render_drum_track(arr: Arrangement, preset: GenrePreset, sr: int,
                       seed: int = 1234) -> np.ndarray:
    """Stereo drum bus."""
    rng = np.random.default_rng(seed)
    pattern_fn = _DRUM_PATTERN_FNS[preset.drum_pattern]
    n_samples = arr.total_bars * arr.bar_samples
    out = np.zeros((n_samples, 2), dtype=np.float32)

    # One-shot samples
    kick_s = synth.kick(sr, duration_s=0.5, freq_start=110, freq_end=45, click_level=0.5)
    snare_s = synth.snare(sr, duration_s=0.25, tone_freq=200, noise_level=0.85)
    chat_s = synth.hihat(sr, duration_s=0.06, closed=True)
    ohat_s = synth.hihat(sr, duration_s=0.20, closed=False)

    step_samples = arr.bar_samples // 16
    for b_idx in range(arr.total_bars):
        # Drop drums in intro first 2 bars (build-up)
        in_intro_buildup = b_idx < 2
        in_outro_tail = b_idx >= arr.total_bars - 2
        pat = pattern_fn(rng)
        for s in range(16):
            t = b_idx * arr.bar_samples + s * step_samples
            # Swing: shift odd 16ths back
            swing_off = int(step_samples * 0.5 * preset.swing) if s % 2 == 1 else 0
            t += swing_off
            if pat["kick"][s] > 0 and not in_intro_buildup:
                synth.overlay(out, kick_s * pat["kick"][s], t, gain=0.95)
            if pat["snare"][s] > 0 and not in_intro_buildup and not in_outro_tail:
                # tiny humanize
                jitter = int(rng.integers(-50, 50))
                synth.overlay(out, snare_s * pat["snare"][s], t + jitter, gain=0.65, pan=0.05)
            if pat["hat"][s] > 0:
                synth.overlay(out, chat_s * pat["hat"][s], t, gain=0.35, pan=-0.10)
            if pat["open_hat"][s] > 0 and not in_intro_buildup:
                synth.overlay(out, ohat_s * pat["open_hat"][s], t, gain=0.30, pan=0.10)
    return out


def _render_bass_track(arr: Arrangement, preset: GenrePreset, key: KeyEstimate,
                       sr: int) -> np.ndarray:
    """808 sub-bass following chord roots."""
    n_samples = arr.total_bars * arr.bar_samples
    out = np.zeros((n_samples, 2), dtype=np.float32)
    prog = preset.chord_progression
    for b_idx in range(arr.total_bars):
        # Skip bass on first 2 intro bars and last 2 outro bars
        if b_idx < 2 or b_idx >= arr.total_bars - 2:
            continue
        chord = prog[b_idx % len(prog)]
        notes = chord_to_midi(chord, key, octave=3)
        root = notes[0] - 24  # drop to sub register (root - 2 octaves)
        prev_chord = prog[(b_idx - 1) % len(prog)] if b_idx > 0 else chord
        prev_root = chord_to_midi(prev_chord, key, octave=3)[0] - 24
        if preset.bass_pattern == "glide":
            # One sustained 808 per bar with glide from previous root
            dur_s = arr.bar_samples / sr * 0.95
            note = synth.sub_808(sr, dur_s, root, glide_from=prev_root, glide_time_s=0.08, drive=1.6)
            t = b_idx * arr.bar_samples
            synth.overlay(out, note, t, gain=0.75)
        elif preset.bass_pattern == "walking":
            # Two notes per bar: root, then 5th
            half = arr.bar_samples // 2
            for sub_i, midi_n in enumerate([root, notes[2] - 24]):
                note = synth.sub_808(sr, half / sr * 0.95, midi_n, drive=1.4)
                t = b_idx * arr.bar_samples + sub_i * half
                synth.overlay(out, note, t, gain=0.7)
        else:  # root
            dur_s = arr.bar_samples / sr * 0.95
            note = synth.sub_808(sr, dur_s, root, drive=1.4)
            t = b_idx * arr.bar_samples
            synth.overlay(out, note, t, gain=0.7)
    return out


def _render_chord_track(arr: Arrangement, preset: GenrePreset, key: KeyEstimate,
                        sr: int) -> np.ndarray:
    """Pad chord stabs and optional piano."""
    n_samples = arr.total_bars * arr.bar_samples
    out = np.zeros((n_samples, 2), dtype=np.float32)
    prog = preset.chord_progression
    for b_idx in range(arr.total_bars):
        chord = prog[b_idx % len(prog)]
        notes = chord_to_midi(chord, key, octave=preset.chord_octave)
        # Pluck (light, every bar)
        for n in notes:
            p = synth.pluck(sr, duration_s=arr.bar_samples / sr, midi_note=n, brightness=0.4)
            t = b_idx * arr.bar_samples
            pan = (n % 5 - 2) * 0.15
            synth.overlay(out, p, t, gain=0.25, pan=pan)
        if preset.pad_layer:
            pad = synth.pad(sr, duration_s=arr.bar_samples / sr, midi_notes=notes, detune_cents=8)
            synth.overlay(out, pad, b_idx * arr.bar_samples, gain=0.30, pan=-0.1)
            synth.overlay(out, pad, b_idx * arr.bar_samples, gain=0.30, pan=+0.1)
        if preset.piano_layer and b_idx >= 2 and b_idx < arr.total_bars - 2:
            # Quarter-note piano voicing
            qn_samples = arr.bar_samples // 4
            for q in range(4):
                # rotate inversion across the bar
                voice_notes = [notes[(q + i) % 3] + (12 if i > 1 else 0) for i in range(3)]
                for n in voice_notes:
                    piano = synth.piano_note(sr, qn_samples / sr * 0.95, midi_note=n)
                    t = b_idx * arr.bar_samples + q * qn_samples
                    synth.overlay(out, piano, t, gain=0.20, pan=0.0)
    return out


# ------- main entry --------------------------------------------------------


def render_beat(
    analysis: VocalAnalysis,
    preset: GenrePreset,
    sr: int,
    energy: float = None,
    seed: int = 1234,
) -> tuple[np.ndarray, Arrangement]:
    """Generate full instrumental matched to vocal length / tempo / key.

    Returns (stereo_audio, arrangement). Caller is responsible for shifting
    the vocal in time to align with intro bars.
    """
    if energy is None:
        energy = preset.energy_default
    vocal_dur = len(analysis.f0_hz) * 512 / sr
    bpm = analysis.tempo.bpm if analysis.tempo.confidence > 0.3 else preset.default_bpm
    if preset.half_time:
        # Trap/Drill: bpm is the actual grid bpm; half-time is feel only
        pass
    arr = plan_arrangement(vocal_dur, bpm, preset, sr)

    drums = _render_drum_track(arr, preset, sr, seed=seed)
    bass = _render_bass_track(arr, preset, analysis.key, sr)
    chords = _render_chord_track(arr, preset, analysis.key, sr)

    # Sidechain the bass to the kick a bit (uses kick energy via drums L)
    bass_mono = bass.mean(axis=1)
    drums_mono = drums.mean(axis=1)
    kick_proxy = hpf(drums_mono, sr, 30)
    kick_proxy = lpf(kick_proxy, sr, 120)
    bass_ducked_mono = sidechain_compressor(
        bass_mono, kick_proxy, sr,
        threshold_db=-22, ratio=6, attack_ms=3, release_ms=120,
    )
    # Replace bass with ducked version (still stereo: re-duplicate)
    bass = np.stack([bass_ducked_mono, bass_ducked_mono], axis=1)

    # Energy scaling: low energy => quieter drums, fewer 808 transients
    drum_gain = 0.7 + 0.4 * energy
    chord_gain = 1.0 - 0.3 * (energy - 0.5)
    mix = (drums * drum_gain + bass * 1.0 + chords * chord_gain).astype(np.float32)
    # Normalize so peak ~ -3 dBFS pre-master
    peak = float(np.max(np.abs(mix)))
    if peak > 0:
        mix *= 10 ** (-3.0 / 20.0) / peak
    return mix, arr


def beat_info_string(arr: Arrangement, preset: GenrePreset, key: KeyEstimate) -> str:
    sec_str = ", ".join(f"{lbl}({s}-{e})" for s, e, lbl in arr.sections)
    return (f"{preset.display} • {arr.bpm:.1f} BPM • {key.name} • "
            f"{arr.total_bars} bars • {sec_str}")
