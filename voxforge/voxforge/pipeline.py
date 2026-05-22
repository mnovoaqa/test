"""Top-level orchestrator: vocal in -> finished song out."""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional

import numpy as np

from . import io_utils, preprocess, analysis, autotune, vocal_chain, beat, mix, master, lyrics
from .presets import GENRE_PRESETS, TUNE_PRESETS, TunePreset


@dataclass
class RenderResult:
    master_audio: np.ndarray   # (n, 2) stereo
    sr: int
    vocal_only: np.ndarray
    instrumental: np.ndarray
    bpm: float
    key: str
    voice_class: str
    tune_preset: str
    genre: str
    tune_summary: dict = field(default_factory=dict)
    master_telemetry: dict = field(default_factory=dict)
    arrangement: dict = field(default_factory=dict)
    lyrics_text: Optional[str] = None


def render_song(
    vocal_path: str | Path | None = None,
    vocal_audio: np.ndarray | None = None,
    sr_in: int | None = None,
    genre: str = "trap",
    tune_style: str | None = None,
    tune_strength: int = 75,
    energy: float | None = None,
    warmth: float = 0.4,
    vocal_level_db: float = 0.0,
    beat_level_db: float = -2.0,
    lufs_target: float | None = None,
    seed: int = 1234,
    verbose: bool = False,
    skip_denoise: bool = False,
) -> RenderResult:
    """Full vocal-to-song render.

    Provide either a `vocal_path` or `vocal_audio` + `sr_in` (float32 mono).
    """
    if vocal_audio is None:
        if vocal_path is None:
            raise ValueError("Provide vocal_path or vocal_audio")
        audio, sr = io_utils.load_audio(vocal_path, target_sr=io_utils.INTERNAL_SR, mono=True)
    else:
        sr = sr_in or io_utils.INTERNAL_SR
        audio = np.asarray(vocal_audio, dtype=np.float32)
        if sr != io_utils.INTERNAL_SR:
            import soxr
            audio = soxr.resample(audio, sr, io_utils.INTERNAL_SR, quality="HQ").astype(np.float32)
            sr = io_utils.INTERNAL_SR

    if verbose: print(f"[1/7] Loaded vocal: {len(audio)/sr:.1f}s @ {sr} Hz")

    # 1. Preprocess
    audio = preprocess.preprocess(audio, sr,
                                  denoise_strength=0.0 if skip_denoise else 0.5)
    if verbose: print("[2/7] Preprocess complete")

    # 2. Analyze
    a = analysis.analyze(audio, sr)
    if verbose:
        print(f"[3/7] Analysis: {a.key.name} (conf {a.key.confidence:.2f}) | "
              f"{a.tempo.bpm:.1f} BPM (conf {a.tempo.confidence:.2f}) | "
              f"{len(a.notes)} notes | voice={a.voice_class}")

    # 3. Auto-tune
    genre = genre.lower()
    if genre not in GENRE_PRESETS:
        raise ValueError(f"Unknown genre '{genre}'. Choices: {list(GENRE_PRESETS)}")
    g_preset = GENRE_PRESETS[genre]
    tune_name = (tune_style or g_preset.tune).lower()
    base_tune = TUNE_PRESETS[tune_name]
    # Tune strength knob (0..100) scales retune/humanize/flex toward 'hard'
    s = max(0, min(100, int(tune_strength))) / 100.0
    tune_preset = TunePreset(
        name=tune_name,
        retune_ms=base_tune.retune_ms * (1.0 - 0.9 * s),
        humanize=base_tune.humanize * (1.0 - 0.8 * s),
        flex_cents=base_tune.flex_cents * (1.0 - 0.7 * s),
        correction_strength=min(1.0, base_tune.correction_strength + 0.15 * s),
        formant_preserve=base_tune.formant_preserve,
        vibrato_sensitivity=base_tune.vibrato_sensitivity * (1.0 - 0.5 * s),
    )
    tuned, decisions = autotune.auto_tune(audio, sr, a.notes, a.key, tune_preset)
    tune_summary = autotune.auto_tune_summary(decisions)
    if verbose:
        print(f"[4/7] Auto-tune ({tune_name}, str={tune_strength}): "
              f"{tune_summary['notes_tuned']}/{tune_summary['notes_total']} notes, "
              f"median |Δ|={tune_summary['median_shift_cents']:.0f} cents")

    # 4. Vocal chain
    from .presets import VOCAL_CHAIN_PRESETS
    chain_def = VOCAL_CHAIN_PRESETS[g_preset.chain]
    vocal_stereo = vocal_chain.apply_chain(tuned, sr, chain_def, warmth=warmth)
    vocal_stereo = vocal_chain.apply_delay_send(vocal_stereo, sr, chain_def, bpm=a.tempo.bpm)
    if verbose: print("[5/7] Vocal chain applied")

    # 5. Beat generation
    beat_stereo, arr = beat.render_beat(a, g_preset, sr, energy=energy, seed=seed)
    if verbose: print(f"[6/7] Beat: {beat.beat_info_string(arr, g_preset, a.key)}")

    # 6. Mix — place vocal after the intro bars
    intro_end_bar = next((s_end for s_start, s_end, lbl in arr.sections if lbl == "intro"),
                         arr.sections[0][1])
    intro_samples = intro_end_bar * arr.bar_samples
    total_samples = arr.total_bars * arr.bar_samples
    vocal_in_song = mix.place_vocal_in_song(vocal_stereo, intro_samples, total_samples)
    full_mix = mix.mix_bus(vocal_in_song, beat_stereo, sr,
                           vocal_level_db=vocal_level_db, beat_level_db=beat_level_db,
                           vocal_forward_on=True)

    # 7. Master
    target_lufs = lufs_target if lufs_target is not None else g_preset.lufs_target
    mastered, mtel = master.master(full_mix, sr, target_lufs=target_lufs,
                                   true_peak_db=-1.0, tilt_db=(warmth - 0.4) * -2.0)
    if verbose:
        print(f"[7/7] Mastered to {mtel['lufs_final']:.2f} LUFS "
              f"(target {target_lufs}), TP {mtel['true_peak_dbfs']:.2f} dBTP")

    # Also place instrumental + vocal-only stems aligned to song length
    instr_only = mix.mix_bus(np.zeros_like(vocal_in_song), beat_stereo, sr,
                              vocal_level_db=-120, beat_level_db=beat_level_db,
                              vocal_forward_on=False)
    vocal_only = mix.mix_bus(vocal_in_song, np.zeros_like(beat_stereo), sr,
                              vocal_level_db=vocal_level_db, beat_level_db=-120,
                              vocal_forward_on=False)

    return RenderResult(
        master_audio=mastered, sr=sr,
        vocal_only=vocal_only, instrumental=instr_only,
        bpm=arr.bpm, key=a.key.name, voice_class=a.voice_class,
        tune_preset=tune_name, genre=genre,
        tune_summary=tune_summary,
        master_telemetry=mtel,
        arrangement={"total_bars": arr.total_bars, "sections": arr.sections},
    )


def write_outputs(result: RenderResult, out_dir: str | Path, basename: str = "song") -> dict[str, str]:
    """Write master + stems. Returns mapping of {label: path}."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = {}
    p_master_24 = out_dir / f"{basename}_master.wav"
    p_master_16 = out_dir / f"{basename}_master_16.wav"
    p_instr = out_dir / f"{basename}_instrumental.wav"
    p_vox = out_dir / f"{basename}_acapella.wav"
    io_utils.save_audio(p_master_24, result.master_audio, result.sr, subtype="PCM_24")
    io_utils.save_audio(p_master_16, io_utils.dither_tpdf(result.master_audio, bits=16),
                        result.sr, subtype="PCM_16")
    io_utils.save_audio(p_instr, result.instrumental, result.sr, subtype="PCM_24")
    io_utils.save_audio(p_vox, result.vocal_only, result.sr, subtype="PCM_24")
    paths["master_24"] = str(p_master_24)
    paths["master_16"] = str(p_master_16)
    paths["instrumental"] = str(p_instr)
    paths["acapella"] = str(p_vox)
    if result.lyrics_text:
        p_lyr = out_dir / f"{basename}_lyrics.md"
        p_lyr.write_text(result.lyrics_text)
        paths["lyrics"] = str(p_lyr)
    return paths
