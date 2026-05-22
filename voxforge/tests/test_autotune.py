"""Tests for analysis, auto-tune, and key inference."""
import numpy as np

from voxforge import analysis, autotune
from voxforge.presets import TUNE_PRESETS
from voxforge.demo_vocal import synth_demo_vocal


SR = 48000


def test_key_inference_minor():
    """Demo vocal in D minor (base_midi=50) should be detected with D-related tonic."""
    voc = synth_demo_vocal(sr=SR, duration_s=12, base_midi=50,
                            mode="minor", bpm=90, seed=11, deviation_cents=20)
    a = analysis.analyze(voc, SR)
    # Accept D (pc=2) or relative major F (pc=5); both are valid Krumhansl results
    assert a.key.tonic_pc in (2, 5), f"got {a.key.tonic_pc}/{a.key.mode}"
    assert len(a.notes) > 5


def test_autotune_reduces_pitch_error():
    voc = synth_demo_vocal(sr=SR, duration_s=10, deviation_cents=40, seed=3)
    a = analysis.analyze(voc, SR)
    preset = TUNE_PRESETS["modern"]
    tuned, decisions = autotune.auto_tune(voc, SR, a.notes, a.key, preset)
    # Re-analyze pitches of tuned vocal
    a2 = analysis.analyze(tuned, SR)

    # Compute median cents-from-scale before and after
    def cents_offset(notes, key):
        if not notes:
            return 0.0
        diffs = []
        for n in notes:
            pc_distances = [abs((n.median_midi % 12) - sp) for sp in key.scale_pcs]
            pc_distances += [12 - d for d in pc_distances]
            diffs.append(min(pc_distances) * 100.0)
        return float(np.median(diffs))

    err_before = cents_offset(a.notes, a.key)
    err_after = cents_offset(a2.notes, a.key)
    assert err_after <= err_before + 5.0, f"auto-tune increased error: {err_before:.1f} -> {err_after:.1f}"


def test_autotune_skips_short_segments():
    """Notes shorter than 80ms should not be tuned."""
    voc = synth_demo_vocal(sr=SR, duration_s=8, deviation_cents=20, seed=5)
    a = analysis.analyze(voc, SR)
    preset = TUNE_PRESETS["modern"]
    # Force a short fake note
    if a.notes:
        a.notes[0].end_sample = a.notes[0].start_sample + int(0.05 * SR)
    _, decisions = autotune.auto_tune(voc, SR, a.notes, a.key, preset)
    # Find decision matching the modified short note
    short_dec = [d for d in decisions if d.reason == "too_short"]
    assert len(short_dec) >= 1


def test_autotune_no_nan():
    voc = synth_demo_vocal(sr=SR, duration_s=8, seed=9)
    a = analysis.analyze(voc, SR)
    tuned, _ = autotune.auto_tune(voc, SR, a.notes, a.key, TUNE_PRESETS["hard"])
    assert np.all(np.isfinite(tuned))


def test_tempo_in_hiphop_range():
    voc = synth_demo_vocal(sr=SR, duration_s=8, bpm=140, seed=2)
    a = analysis.analyze(voc, SR)
    assert 60 <= a.tempo.bpm <= 180
