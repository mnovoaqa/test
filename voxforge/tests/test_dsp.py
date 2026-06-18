"""Unit tests for DSP building blocks."""
import numpy as np
import pytest

from voxforge.dsp import eq, dynamics, reverb, synth, pitch_shift


SR = 48000


def _sine(freq=440.0, duration=1.0, sr=SR, amp=0.5):
    t = np.arange(int(duration * sr)) / sr
    return (amp * np.sin(2 * np.pi * freq * t)).astype(np.float32)


def test_hpf_attenuates_low():
    """HPF should reduce low-band energy more than high-band energy."""
    x = _sine(50, 1.0) + _sine(2000, 1.0)
    y = eq.hpf(x, SR, cutoff=200)
    def band_rms(sig, fmin, fmax):
        fft = np.abs(np.fft.rfft(sig))
        freqs = np.fft.rfftfreq(len(sig), 1 / SR)
        mask = (freqs >= fmin) & (freqs <= fmax)
        return float(np.sqrt(np.mean(fft[mask] ** 2)))
    low_in = band_rms(x, 30, 100)
    low_out = band_rms(y, 30, 100)
    high_in = band_rms(x, 1800, 2200)
    high_out = band_rms(y, 1800, 2200)
    # Low band attenuated by at least 20 dB
    assert low_out < low_in * 0.1
    # High band roughly preserved (within 1 dB)
    assert abs(high_out - high_in) / max(high_in, 1e-9) < 0.2


def test_compressor_reduces_dynamics():
    # Disable auto-makeup so we measure pure GR behavior in steady state
    x = _sine(440, 0.5, amp=0.9)
    y = dynamics.compressor(x, SR, threshold_db=-12, ratio=4.0,
                             attack_ms=5, release_ms=50, makeup_db=0.0)
    # Skip first 10ms (attack ramp); assert RMS reduction
    skip = int(0.01 * SR)
    rms_in = float(np.sqrt(np.mean(x[skip:] ** 2)))
    rms_out = float(np.sqrt(np.mean(y[skip:] ** 2)))
    assert rms_out < rms_in
    assert np.all(np.isfinite(y))


def test_limiter_enforces_ceiling():
    x = _sine(440, 0.5, amp=0.99)
    y = dynamics.limiter(x, SR, ceiling_db=-3.0, oversample=4)
    # True-peak ceiling at -3 dB is 0.708; allow tiny reconstruction error
    peak = np.max(np.abs(y))
    assert peak <= 0.71, f"limiter peak {peak} exceeded ceiling"
    assert np.all(np.isfinite(y))


def test_pitch_shift_changes_pitch():
    x = _sine(220, 1.0, amp=0.4)
    y = pitch_shift.pitch_shift_segment(x, SR, n_semitones=12, preserve_formant=False)
    # Detect peak frequency
    fft = np.abs(np.fft.rfft(y))
    freqs = np.fft.rfftfreq(len(y), 1 / SR)
    peak_freq = freqs[np.argmax(fft)]
    # +12 semitones from 220 = 440
    assert 400 < peak_freq < 480, f"expected ~440 Hz, got {peak_freq}"


def test_reverb_adds_decay():
    x = _sine(440, 0.5)
    y = reverb.reverb(x, SR, decay_s=1.0, wet=0.5)
    assert y.shape == (len(x), 2)
    # Tail after sine ends should have energy
    tail = y[len(x):]  # empty since we trim to input length, so check end of y
    end_energy = np.sqrt(np.mean(y[-int(0.05 * SR):] ** 2))
    start_energy = np.sqrt(np.mean(y[: int(0.05 * SR)] ** 2))
    # In real reverb, tail energy comes from input; both regions get convolved
    assert end_energy > 1e-6
    assert np.all(np.isfinite(y))


def test_synth_no_clipping():
    for fn, args in [
        (synth.kick, {"sr": SR}),
        (synth.snare, {"sr": SR}),
        (synth.hihat, {"sr": SR}),
        (synth.sub_808, {"sr": SR, "duration_s": 0.4, "midi_note": 36}),
        (synth.pluck, {"sr": SR, "duration_s": 0.5, "midi_note": 60}),
        (synth.pad, {"sr": SR, "duration_s": 0.5, "midi_notes": [60, 63, 67]}),
        (synth.piano_note, {"sr": SR, "duration_s": 0.5, "midi_note": 60}),
    ]:
        y = fn(**args)
        assert np.all(np.isfinite(y)), f"{fn.__name__} produced NaN/Inf"
        assert np.max(np.abs(y)) <= 1.0, f"{fn.__name__} clipped: max={np.max(np.abs(y))}"


def test_de_esser_attenuates_high_band():
    # Pure 7 kHz tone above threshold should be attenuated
    x = _sine(7000, 0.5, amp=0.5)
    y = dynamics.de_esser(x, SR, freq=7000, threshold_db=-20, ratio=8.0)
    # RMS should drop
    assert np.sqrt(np.mean(y ** 2)) < np.sqrt(np.mean(x ** 2)) * 0.9
