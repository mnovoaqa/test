"""End-to-end song synthesis: lyrics + reference voice -> finished song.

Wraps the voice cloning module and feeds the result into the existing
VOXFORGE pipeline (autotune + vocal chain + beat + mix + master).
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np

from . import voice_clone, pipeline, io_utils
from .lyrics import generate_lyrics


@dataclass
class SynthResult:
    master_path: str
    master16_path: str
    instrumental_path: str
    acapella_path: str
    lyrics_path: str
    voice_ref_path: str
    info: dict


def synth_song(
    reference_voice_path: str,
    lyrics_text: Optional[str] = None,
    lyrics_theme: str = "reflection",
    lyrics_genre: str = "boom_bap",
    lyrics_verses: int = 2,
    lyrics_bars: int = 8,
    lyrics_seed: int | None = None,
    genre: str = "boom_bap",
    tune_style: Optional[str] = None,
    tune_strength: int = 60,
    energy: float = 0.45,
    warmth: float = 0.5,
    seed: int = 808,
    out_dir: str = "output",
    basename: str = "synth_song",
    clone_exaggeration: float = 0.55,
    clone_cfg: float = 0.55,
    pause_ms: int = 320,
    progress=print,
) -> SynthResult:
    """Run the full text-to-song pipeline.

    1. Extract a clean reference clip from the user's vocal upload
    2. Generate or use supplied lyrics
    3. Voice-clone the lyrics in the user's voice
    4. Pipe the synth vocal through VOXFORGE (autotune + chain + beat + master)
    5. Write outputs
    """
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    # 1. Build a clean 10-s reference clip from the user's upload
    progress("[1/5] Extracting clean voice reference…")
    ref_clip_path = out_dir / f"{basename}_voice_ref.wav"
    voice_clone.extract_reference_clip(reference_voice_path, ref_clip_path, target_seconds=10.0)

    # 2. Get lyrics
    if lyrics_text is None:
        progress("[2/5] Generating lyrics…")
        song = generate_lyrics(
            theme=lyrics_theme, genre=lyrics_genre,
            bars_per_verse=lyrics_bars, n_verses=lyrics_verses,
            seed=lyrics_seed,
        )
        lyrics_text = song.render()
    else:
        progress("[2/5] Using supplied lyrics")

    lyrics_path = out_dir / f"{basename}_lyrics.md"
    lyrics_path.write_text(lyrics_text)

    # 3. Voice-clone the lyrics
    progress("[3/5] Synthesizing vocal in your voice (slow on CPU — be patient)…")

    def _cb(i, n, text):
        progress(f"      line {i + 1}/{n}: {text[:60]}{'…' if len(text)>60 else ''}")

    settings = voice_clone.CloneSettings(
        exaggeration=clone_exaggeration,
        cfg_weight=clone_cfg,
        temperature=0.85,
        pause_between_lines_ms=pause_ms,
        leading_silence_ms=400,
    )
    vocal = voice_clone.lyrics_to_vocal_audio(
        lyrics_text, ref_clip_path, target_sr=48000,
        settings=settings, progress_cb=_cb,
    )

    # Optional: bake the cloned-vocal stem so we can hear it before mastering
    raw_clone_path = out_dir / f"{basename}_cloned_vocal_dry.wav"
    io_utils.save_audio(raw_clone_path, vocal, 48000, subtype="PCM_24")

    # 4. Run the existing pipeline on the synthetic vocal
    progress("[4/5] Auto-tune + vocal chain + beat + mix + master…")
    result = pipeline.render_song(
        vocal_audio=vocal, sr_in=48000,
        genre=genre, tune_style=tune_style,
        tune_strength=tune_strength,
        energy=energy, warmth=warmth,
        seed=seed, verbose=False,
        skip_denoise=True,  # TTS is already clean; don't gate it
    )
    result.lyrics_text = lyrics_text
    paths = pipeline.write_outputs(result, out_dir, basename=basename)
    progress(f"[5/5] Done. Mastered to {result.master_telemetry['lufs_final']:.2f} LUFS, "
             f"TP {result.master_telemetry['true_peak_dbfs']:.2f} dBTP.")

    return SynthResult(
        master_path=paths["master_24"],
        master16_path=paths["master_16"],
        instrumental_path=paths["instrumental"],
        acapella_path=paths["acapella"],
        lyrics_path=str(lyrics_path),
        voice_ref_path=str(ref_clip_path),
        info={
            "key": result.key,
            "bpm": result.bpm,
            "voice_class": result.voice_class,
            "tune_preset": result.tune_preset,
            "lufs_final": result.master_telemetry["lufs_final"],
            "true_peak_dbfs": result.master_telemetry["true_peak_dbfs"],
            "tune_summary": result.tune_summary,
            "n_bars": result.arrangement["total_bars"],
            "dry_clone_path": str(raw_clone_path),
        },
    )
