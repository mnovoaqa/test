"""Vocal analysis: F0 tracking, note segmentation, key/scale inference,
tempo estimation, section detection.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Tuple

import numpy as np
import librosa


# Krumhansl-Schmuckler tonal hierarchy profiles
KS_MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52,
                     5.19, 2.39, 3.66, 2.29, 2.88])
KS_MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54,
                     4.75, 3.98, 2.69, 3.34, 3.17])

PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
MAJOR_SCALE = (0, 2, 4, 5, 7, 9, 11)
MINOR_SCALE = (0, 2, 3, 5, 7, 8, 10)
MINOR_HARMONIC = (0, 2, 3, 5, 7, 8, 11)


@dataclass
class Note:
    start_sample: int
    end_sample: int
    median_f0_hz: float
    median_midi: float
    confidence: float

    @property
    def duration_samples(self) -> int:
        return self.end_sample - self.start_sample


@dataclass
class KeyEstimate:
    tonic_pc: int          # pitch class 0-11
    mode: str              # "major" or "minor"
    confidence: float      # ratio best/second-best
    scale_pcs: tuple

    @property
    def name(self) -> str:
        return f"{PITCH_NAMES[self.tonic_pc]} {self.mode}"


@dataclass
class TempoEstimate:
    bpm: float
    confidence: float


@dataclass
class VocalAnalysis:
    sr: int
    f0_hz: np.ndarray      # frame-rate F0 (Hz), NaN where unvoiced
    voiced_mask: np.ndarray
    times: np.ndarray
    notes: List[Note]
    key: KeyEstimate
    tempo: TempoEstimate
    sections: List[Tuple[int, int, str]]   # (start_sample, end_sample, label)
    voice_class: str       # bass/tenor/alto/soprano (rough)


def track_f0(audio: np.ndarray, sr: int, fmin: float = 65.0, fmax: float = 1000.0,
             hop_length: int = 512) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """PYIN-based F0 tracking. Returns (f0_hz, voiced_mask, voiced_prob)."""
    f0, vflag, vprob = librosa.pyin(
        audio.astype(np.float32),
        fmin=fmin, fmax=fmax, sr=sr,
        frame_length=2048, hop_length=hop_length,
    )
    return f0, vflag.astype(bool), vprob


def segment_notes(
    f0_hz: np.ndarray, voiced_mask: np.ndarray, sr: int, hop_length: int = 512,
    min_duration_ms: float = 80.0, stable_cents: float = 50.0,
) -> List[Note]:
    """Group consecutive voiced frames with similar pitch into note segments."""
    if len(f0_hz) == 0:
        return []
    midi = 69 + 12 * np.log2(np.where(np.isnan(f0_hz), 1e-6, f0_hz) / 440.0)
    midi = np.where(voiced_mask & ~np.isnan(f0_hz), midi, np.nan)
    notes: List[Note] = []
    min_frames = max(int(min_duration_ms * 1e-3 * sr / hop_length), 2)
    tol_semi = stable_cents / 100.0

    i = 0
    n = len(midi)
    while i < n:
        if np.isnan(midi[i]):
            i += 1
            continue
        j = i
        running = [midi[i]]
        med = midi[i]
        while j + 1 < n and not np.isnan(midi[j + 1]) and abs(midi[j + 1] - med) <= tol_semi:
            j += 1
            running.append(midi[j])
            med = float(np.median(running))
        if (j - i + 1) >= min_frames:
            start_sample = i * hop_length
            end_sample = (j + 1) * hop_length
            f0_med = float(np.nanmedian(f0_hz[i : j + 1]))
            notes.append(Note(
                start_sample=start_sample,
                end_sample=end_sample,
                median_f0_hz=f0_med,
                median_midi=med,
                confidence=float(np.mean(voiced_mask[i : j + 1])),
            ))
        i = j + 1
    return notes


def infer_key(notes: List[Note]) -> KeyEstimate:
    """Krumhansl-Schmuckler key estimation from note durations."""
    if not notes:
        return KeyEstimate(tonic_pc=0, mode="minor", confidence=0.0, scale_pcs=MINOR_SCALE)
    pc_weight = np.zeros(12)
    for note in notes:
        pc = int(round(note.median_midi)) % 12
        pc_weight[pc] += note.duration_samples
    pc_weight /= max(pc_weight.sum(), 1e-9)
    scores = []
    for tonic in range(12):
        maj = np.corrcoef(np.roll(KS_MAJOR, tonic), pc_weight)[0, 1]
        mn = np.corrcoef(np.roll(KS_MINOR, tonic), pc_weight)[0, 1]
        scores.append((maj, tonic, "major"))
        scores.append((mn, tonic, "minor"))
    scores.sort(reverse=True, key=lambda x: x[0])
    best_score, tonic, mode = scores[0]
    second_score = scores[1][0]
    # Confidence as gap between top and second (in [0, 1])
    conf = max(0.0, min(1.0, (best_score - second_score) * 4.0 + 0.5))
    pcs = MINOR_SCALE if mode == "minor" else MAJOR_SCALE
    scale_pcs = tuple((p + tonic) % 12 for p in pcs)
    return KeyEstimate(tonic_pc=tonic, mode=mode, confidence=conf, scale_pcs=scale_pcs)


def estimate_tempo(audio: np.ndarray, sr: int) -> TempoEstimate:
    """Tempo from vocal: heuristic since most rap vocals are non-percussive.

    Strategy: onset strength autocorrelation + sanity-check against
    common hip-hop tempi (60-180 BPM).
    """
    onset_env = librosa.onset.onset_strength(y=audio, sr=sr, hop_length=512)
    if onset_env.std() < 1e-4:
        return TempoEstimate(bpm=140.0, confidence=0.0)
    tempo_arr = librosa.feature.tempo(onset_envelope=onset_env, sr=sr, hop_length=512,
                                      aggregate=None, ac_size=8.0)
    if np.ndim(tempo_arr) == 0:
        tempo = float(tempo_arr)
    else:
        tempo = float(np.median(tempo_arr))
    # Clamp into hip-hop range
    while tempo < 60:
        tempo *= 2
    while tempo > 180:
        tempo /= 2
    # Snap to half-bpm
    tempo = round(tempo * 2) / 2
    # Confidence: peak prominence vs noise floor
    ac = librosa.autocorrelate(onset_env)
    if ac.max() > 0:
        conf = float(np.clip((ac.max() - ac.mean()) / (ac.std() + 1e-6) / 5.0, 0.0, 1.0))
    else:
        conf = 0.0
    return TempoEstimate(bpm=tempo, confidence=conf)


def detect_sections(audio: np.ndarray, sr: int, voiced_mask: np.ndarray,
                    hop_length: int = 512) -> List[Tuple[int, int, str]]:
    """Detect vocal sections. Heuristic: contiguous voiced regions are 'verse';
    repeated similar regions can be flagged as 'hook' (V1)."""
    if len(voiced_mask) == 0:
        return [(0, len(audio), "verse")]
    # Find runs of voicing with small gaps merged
    sections = []
    i = 0
    n = len(voiced_mask)
    min_gap_frames = int(0.4 * sr / hop_length)
    min_run_frames = int(2.0 * sr / hop_length)
    while i < n:
        if not voiced_mask[i]:
            i += 1
            continue
        start = i
        j = i
        gap_count = 0
        while j < n:
            if voiced_mask[j]:
                gap_count = 0
                j += 1
            else:
                gap_count += 1
                if gap_count > min_gap_frames:
                    break
                j += 1
        end = j - gap_count if gap_count > 0 else j
        if end - start >= min_run_frames:
            sections.append((start * hop_length, end * hop_length, "verse"))
        i = j
    if not sections:
        sections = [(0, len(audio), "verse")]
    return sections


def classify_voice(notes: List[Note]) -> str:
    """Rough voice-type classifier from median pitch."""
    if not notes:
        return "tenor"
    midi_med = float(np.median([n.median_midi for n in notes]))
    if midi_med < 50:
        return "bass"
    if midi_med < 58:
        return "baritone"
    if midi_med < 65:
        return "tenor"
    if midi_med < 72:
        return "alto"
    return "soprano"


def analyze(audio: np.ndarray, sr: int) -> VocalAnalysis:
    """Full analysis pipeline. Returns a VocalAnalysis container."""
    hop = 512
    f0, voiced, _ = track_f0(audio, sr, hop_length=hop)
    times = librosa.times_like(f0, sr=sr, hop_length=hop)
    notes = segment_notes(f0, voiced, sr, hop_length=hop)
    key = infer_key(notes)
    tempo = estimate_tempo(audio, sr)
    sections = detect_sections(audio, sr, voiced, hop_length=hop)
    vc = classify_voice(notes)
    return VocalAnalysis(
        sr=sr, f0_hz=f0, voiced_mask=voiced, times=times,
        notes=notes, key=key, tempo=tempo, sections=sections, voice_class=vc,
    )
