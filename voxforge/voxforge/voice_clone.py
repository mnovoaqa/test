"""Voice cloning TTS wrapper.

Uses Chatterbox (Resemble AI's MIT-licensed open-source voice clone TTS).
Given a short reference of a speaker, synthesize new speech in their voice.

This module is *purposeful*: it exists so the user can hear new lyrics
performed in their own voice. By the product's design rules, voice cloning
is only ever applied to the user's own voice (with their consent).
"""
from __future__ import annotations

import os
import re
import warnings
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np

warnings.filterwarnings("ignore")


# Lazy global so we only load the model once per process
_TTS = None
_TTS_SR: Optional[int] = None


def _ensure_loaded() -> tuple[object, int]:
    """Load the Chatterbox model on first use. Returns (model, sample_rate)."""
    global _TTS, _TTS_SR
    if _TTS is None:
        from chatterbox.tts import ChatterboxTTS
        device = os.environ.get("VOXFORGE_TTS_DEVICE", "cpu")
        _TTS = ChatterboxTTS.from_pretrained(device=device)
        _TTS_SR = int(_TTS.sr)
    return _TTS, _TTS_SR


def _split_lyrics(text: str) -> list[str]:
    """Split lyric markdown / plain text into utterance-sized pieces.

    Strategy: each non-empty line is one utterance, EXCEPT we collapse short
    consecutive lines (< 25 chars) into a single utterance for natural pacing.
    Section headers like [VERSE 1] and markdown decorations are stripped.
    """
    lines: list[str] = []
    for raw in text.splitlines():
        s = raw.strip()
        if not s:
            continue
        if s.startswith("#"):           # markdown header
            continue
        if s.startswith(">") or s.startswith("---") or s.startswith("`"):
            continue
        if re.match(r"^\[.+?\]\s*$", s):  # section marker like [VERSE 1]
            continue
        if s.startswith("*") and s.endswith("*"):  # italic block
            continue
        # strip leading list bullets / numbering
        s = re.sub(r"^[\-\*\d\.]+\s+", "", s)
        # strip trailing markdown emphasis
        s = re.sub(r"[\*_`]+$", "", s).strip()
        if not s:
            continue
        lines.append(s)
    # Merge very short consecutive lines
    merged: list[str] = []
    for line in lines:
        if merged and len(merged[-1]) < 25 and len(line) < 25:
            merged[-1] = merged[-1] + ". " + line
        else:
            merged.append(line)
    return merged


@dataclass
class CloneSettings:
    exaggeration: float = 0.5   # 0..1 emotion strength; higher = more expressive
    cfg_weight: float = 0.5     # 0..1 prompt adherence; higher = closer to ref
    temperature: float = 0.8    # sampling temp
    pause_between_lines_ms: int = 280   # gap inserted between lines
    leading_silence_ms: int = 200


def synthesize_lines(
    lines: list[str],
    reference_audio_path: str | Path,
    settings: CloneSettings | None = None,
    progress_cb=None,
) -> tuple[np.ndarray, int]:
    """Synthesize a list of utterances in the reference speaker's voice.

    Returns (audio_float32_mono, sample_rate). Audio is the lines concatenated
    with small natural pauses between them.
    """
    if not lines:
        return np.zeros(0, dtype=np.float32), 24000
    settings = settings or CloneSettings()
    model, sr = _ensure_loaded()
    import torch

    out_parts: list[np.ndarray] = []
    if settings.leading_silence_ms > 0:
        out_parts.append(np.zeros(int(settings.leading_silence_ms / 1000 * sr), dtype=np.float32))

    pause_n = int(settings.pause_between_lines_ms / 1000 * sr)
    pause = np.zeros(pause_n, dtype=np.float32)

    for i, text in enumerate(lines):
        if progress_cb is not None:
            progress_cb(i, len(lines), text)
        with torch.no_grad():
            wav = model.generate(
                text,
                audio_prompt_path=str(reference_audio_path),
                exaggeration=settings.exaggeration,
                cfg_weight=settings.cfg_weight,
                temperature=settings.temperature,
            )
        arr = wav.squeeze().cpu().numpy().astype(np.float32)
        # Trim leading / trailing silence to keep pacing tight
        arr = _trim_edges(arr, sr, threshold_dbfs=-45.0)
        out_parts.append(arr)
        out_parts.append(pause)

    out = np.concatenate(out_parts) if out_parts else np.zeros(0, dtype=np.float32)
    return out.astype(np.float32), sr


def _trim_edges(audio: np.ndarray, sr: int, threshold_dbfs: float = -45.0,
                pad_ms: float = 30.0) -> np.ndarray:
    if len(audio) == 0:
        return audio
    abs_a = np.abs(audio)
    thr = 10 ** (threshold_dbfs / 20.0)
    above = abs_a > thr
    if not above.any():
        return audio
    pad = int(pad_ms / 1000 * sr)
    first = max(0, np.argmax(above) - pad)
    last = min(len(audio), len(audio) - np.argmax(above[::-1]) + pad)
    return audio[first:last]


def extract_reference_clip(audio_path: str | Path, out_path: str | Path,
                           target_seconds: float = 10.0) -> str:
    """Extract a clean short clip from an upload for use as Chatterbox reference.

    Picks the highest-RMS contiguous window of `target_seconds` from the source.
    """
    from . import io_utils
    audio, sr = io_utils.load_audio(audio_path, target_sr=24000, mono=True)
    n_target = int(target_seconds * sr)
    if len(audio) <= n_target:
        clip = audio
    else:
        # Slide a window, pick highest mean abs
        step = sr // 4  # 0.25s steps
        best_score = -1.0
        best_start = 0
        for start in range(0, len(audio) - n_target, step):
            seg = audio[start : start + n_target]
            score = float(np.mean(np.abs(seg)))
            if score > best_score:
                best_score = score
                best_start = start
        clip = audio[best_start : best_start + n_target]
    # Normalize to a healthy level (peak -3 dBFS) so the model gets a clean reference
    peak = float(np.max(np.abs(clip)))
    if peak > 0:
        clip = (clip * (10 ** (-3.0 / 20.0) / peak)).astype(np.float32)
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    io_utils.save_audio(out_path, clip, sr, subtype="PCM_16")
    return str(out_path)


def lyrics_to_vocal_audio(
    lyrics_text: str,
    reference_audio_path: str | Path,
    target_sr: int = 48000,
    settings: CloneSettings | None = None,
    progress_cb=None,
) -> np.ndarray:
    """End-to-end: lyrics markdown -> cloned vocal audio at target_sr (mono)."""
    lines = _split_lyrics(lyrics_text)
    if not lines:
        raise ValueError("Lyrics produced no usable lines")
    audio, sr = synthesize_lines(lines, reference_audio_path, settings, progress_cb)
    if sr != target_sr:
        import soxr
        audio = soxr.resample(audio, sr, target_sr, quality="HQ").astype(np.float32)
    return audio
