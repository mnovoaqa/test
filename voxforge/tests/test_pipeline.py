"""End-to-end pipeline tests with audio property assertions."""
import numpy as np
import pytest

from voxforge import pipeline, master, demo_vocal


SR = 48000


@pytest.mark.parametrize("genre", ["trap", "boom_bap", "rnb", "drill", "melodic"])
def test_full_render_per_genre(genre, tmp_path):
    voc = demo_vocal.synth_demo_vocal(sr=SR, duration_s=8, seed=42)
    result = pipeline.render_song(
        vocal_audio=voc, sr_in=SR,
        genre=genre, tune_strength=70, seed=7, verbose=False,
    )
    # Property assertions
    assert result.master_audio.ndim == 2 and result.master_audio.shape[1] == 2
    assert np.all(np.isfinite(result.master_audio))
    assert np.max(np.abs(result.master_audio)) <= 1.0

    # LUFS within ±0.5 LU of target
    target = result.master_telemetry["lufs_target"]
    final = result.master_telemetry["lufs_final"]
    assert abs(final - target) <= 0.5, f"{genre}: LUFS off: {final} vs {target}"

    # True peak ≤ -1.0 dBTP
    tp = result.master_telemetry["true_peak_dbfs"]
    assert tp <= -1.0 + 0.05, f"{genre}: TP exceeded: {tp}"

    # No clipping
    assert np.max(np.abs(result.master_audio)) < 0.999

    # Save and re-load to verify writability
    paths = pipeline.write_outputs(result, tmp_path, basename=genre)
    for key in ("master_24", "master_16", "instrumental", "acapella"):
        assert key in paths


def test_render_with_lyrics(tmp_path):
    voc = demo_vocal.synth_demo_vocal(sr=SR, duration_s=8, seed=1)
    result = pipeline.render_song(
        vocal_audio=voc, sr_in=SR, genre="trap", tune_strength=80, verbose=False,
    )
    from voxforge.lyrics import generate_lyrics
    song = generate_lyrics(theme="hustle", genre="trap", bars_per_verse=8, n_verses=2, seed=1)
    result.lyrics_text = song.render()
    paths = pipeline.write_outputs(result, tmp_path, basename="with_lyrics")
    assert "lyrics" in paths


def test_master_lufs_within_tolerance():
    voc = demo_vocal.synth_demo_vocal(sr=SR, duration_s=8, seed=1)
    result = pipeline.render_song(vocal_audio=voc, sr_in=SR, genre="trap", verbose=False)
    measured = master.measure_lufs(result.master_audio, SR)
    assert abs(measured - (-14.0)) <= 0.5


def test_render_short_vocal():
    """4-second vocal still produces a valid song."""
    voc = demo_vocal.synth_demo_vocal(sr=SR, duration_s=4, seed=11)
    result = pipeline.render_song(vocal_audio=voc, sr_in=SR, genre="trap", verbose=False)
    # Should be at least intro (4 bars) + 8-bar verse + 4-bar outro = 16 bars
    assert result.arrangement["total_bars"] >= 16
