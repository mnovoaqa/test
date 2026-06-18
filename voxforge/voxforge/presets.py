"""Genre and tuning presets. Single source of truth for all defaults."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Tuple


@dataclass
class TunePreset:
    name: str
    retune_ms: float        # 0 (instant) .. 200 (lazy)
    humanize: float         # 0..1 (fraction of original pitch kept)
    flex_cents: float       # snap zone (cents)
    correction_strength: float  # 0..1
    formant_preserve: bool
    vibrato_sensitivity: float  # 0..1 — preserves vibrato around moving median

    @classmethod
    def by_name(cls, name: str) -> "TunePreset":
        return TUNE_PRESETS.get(name.lower(), TUNE_PRESETS["modern"])


TUNE_PRESETS = {
    "natural":   TunePreset("natural",   retune_ms=80,  humanize=0.60, flex_cents=200, correction_strength=0.55, formant_preserve=True, vibrato_sensitivity=0.80),
    "modern":    TunePreset("modern",    retune_ms=30,  humanize=0.30, flex_cents=100, correction_strength=0.85, formant_preserve=True, vibrato_sensitivity=0.50),
    "hard":      TunePreset("hard",      retune_ms=0,   humanize=0.00, flex_cents=30,  correction_strength=1.00, formant_preserve=True, vibrato_sensitivity=0.00),
    "rnb":       TunePreset("rnb",       retune_ms=50,  humanize=0.40, flex_cents=150, correction_strength=0.75, formant_preserve=True, vibrato_sensitivity=0.70),
    "drill":     TunePreset("drill",     retune_ms=25,  humanize=0.25, flex_cents=80,  correction_strength=0.90, formant_preserve=True, vibrato_sensitivity=0.40),
}


@dataclass
class VocalChainPreset:
    hpf_hz: float
    de_ess_freq: float
    de_ess_threshold_db: float
    comp1: Tuple[float, float, float, float]   # (thresh_db, ratio, atk_ms, rel_ms)
    comp2: Tuple[float, float, float, float]
    saturation_drive_db: float
    saturation_mix: float
    saturation_kind: str
    presence_boost_db: float
    presence_freq: float
    reverb_decay_s: float
    reverb_wet: float
    reverb_predelay_ms: float
    delay_time_div: float       # division of beat (e.g. 0.25 = 1/4 note)
    delay_feedback: float
    delay_mix: float


VOCAL_CHAIN_PRESETS = {
    "trap":       VocalChainPreset(hpf_hz=90,  de_ess_freq=6500, de_ess_threshold_db=-22,
                                   comp1=(-18, 4, 12, 80), comp2=(-12, 3, 3, 50),
                                   saturation_drive_db=6, saturation_mix=0.15, saturation_kind="tape",
                                   presence_boost_db=2.0, presence_freq=3200,
                                   reverb_decay_s=1.2, reverb_wet=0.18, reverb_predelay_ms=20,
                                   delay_time_div=0.25, delay_feedback=0.30, delay_mix=0.10),
    "boom_bap":   VocalChainPreset(hpf_hz=100, de_ess_freq=7000, de_ess_threshold_db=-20,
                                   comp1=(-16, 3, 15, 90), comp2=(-10, 2.5, 5, 60),
                                   saturation_drive_db=8, saturation_mix=0.25, saturation_kind="tube",
                                   presence_boost_db=1.5, presence_freq=3000,
                                   reverb_decay_s=0.8, reverb_wet=0.16, reverb_predelay_ms=15,
                                   delay_time_div=0.375, delay_feedback=0.25, delay_mix=0.08),
    "rnb":        VocalChainPreset(hpf_hz=70,  de_ess_freq=6000, de_ess_threshold_db=-24,
                                   comp1=(-20, 3, 15, 100), comp2=(-12, 2.5, 8, 70),
                                   saturation_drive_db=5, saturation_mix=0.20, saturation_kind="tube",
                                   presence_boost_db=2.5, presence_freq=4500,
                                   reverb_decay_s=1.8, reverb_wet=0.28, reverb_predelay_ms=25,
                                   delay_time_div=0.5, delay_feedback=0.30, delay_mix=0.12),
    "drill":      VocalChainPreset(hpf_hz=110, de_ess_freq=7000, de_ess_threshold_db=-22,
                                   comp1=(-16, 5, 8, 60), comp2=(-10, 3, 3, 40),
                                   saturation_drive_db=4, saturation_mix=0.10, saturation_kind="tape",
                                   presence_boost_db=2.5, presence_freq=3500,
                                   reverb_decay_s=0.9, reverb_wet=0.14, reverb_predelay_ms=18,
                                   delay_time_div=0.25, delay_feedback=0.20, delay_mix=0.08),
    "melodic":    VocalChainPreset(hpf_hz=80,  de_ess_freq=6500, de_ess_threshold_db=-23,
                                   comp1=(-18, 3, 12, 90), comp2=(-10, 2.5, 5, 60),
                                   saturation_drive_db=6, saturation_mix=0.18, saturation_kind="tape",
                                   presence_boost_db=2.0, presence_freq=4000,
                                   reverb_decay_s=1.5, reverb_wet=0.22, reverb_predelay_ms=22,
                                   delay_time_div=0.25, delay_feedback=0.30, delay_mix=0.12),
}


@dataclass
class GenrePreset:
    name: str
    display: str
    default_bpm: float
    half_time: bool
    swing: float                          # 0..0.5
    chain: str                            # vocal chain preset key
    tune: str                             # tune preset key
    lufs_target: float
    drum_pattern: str                     # 'trap', 'boom_bap', 'drill', 'rnb', 'melodic'
    kick_subdiv: int                      # 16 = sixteenth-note grid
    energy_default: float                 # 0..1
    chord_progression: tuple              # roman numerals
    chord_octave: int = 4
    bass_pattern: str = "root"            # "root", "glide", "walking"
    pad_layer: bool = False
    piano_layer: bool = False


GENRE_PRESETS = {
    "trap": GenrePreset(
        name="trap", display="Trap", default_bpm=140.0, half_time=True, swing=0.10,
        chain="trap", tune="modern", lufs_target=-14.0, drum_pattern="trap",
        kick_subdiv=16, energy_default=0.65,
        chord_progression=("i", "VI", "III", "VII"),
        bass_pattern="glide",
    ),
    "boom_bap": GenrePreset(
        name="boom_bap", display="Boom Bap", default_bpm=90.0, half_time=False, swing=0.18,
        chain="boom_bap", tune="natural", lufs_target=-12.0, drum_pattern="boom_bap",
        kick_subdiv=16, energy_default=0.50,
        chord_progression=("i", "iv", "V", "i"),
        piano_layer=True, bass_pattern="walking",
    ),
    "rnb": GenrePreset(
        name="rnb", display="R&B Smooth", default_bpm=85.0, half_time=False, swing=0.05,
        chain="rnb", tune="rnb", lufs_target=-16.0, drum_pattern="rnb",
        kick_subdiv=16, energy_default=0.35,
        chord_progression=("ii", "V", "I", "vi"),
        pad_layer=True, piano_layer=True, bass_pattern="root",
    ),
    "drill": GenrePreset(
        name="drill", display="Drill", default_bpm=142.0, half_time=True, swing=0.0,
        chain="drill", tune="drill", lufs_target=-13.0, drum_pattern="drill",
        kick_subdiv=16, energy_default=0.75,
        chord_progression=("i", "VI", "iv", "VII"),
        bass_pattern="glide",
    ),
    "melodic": GenrePreset(
        name="melodic", display="Melodic Rap", default_bpm=145.0, half_time=True, swing=0.08,
        chain="melodic", tune="modern", lufs_target=-14.0, drum_pattern="trap",
        kick_subdiv=16, energy_default=0.55,
        chord_progression=("vi", "IV", "I", "V"),
        pad_layer=True, bass_pattern="root",
    ),
}


def list_genres() -> list[str]:
    return list(GENRE_PRESETS.keys())


def list_tune_styles() -> list[str]:
    return list(TUNE_PRESETS.keys())
