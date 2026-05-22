"""Full vocal processing chain after auto-tune."""
from __future__ import annotations

import numpy as np

from .dsp.eq import hpf, peak_eq, high_shelf, detect_resonances
from .dsp.dynamics import de_esser, compressor, saturate, limiter
from .dsp.reverb import reverb, delay
from .presets import VocalChainPreset


def apply_chain(audio: np.ndarray, sr: int, chain: VocalChainPreset,
                wet_mult: float = 1.0, warmth: float = 0.4) -> np.ndarray:
    """Apply the vocal chain. Returns stereo (n, 2).

    Order: HPF -> subtractive EQ -> de-ess -> comp1 -> comp2 -> saturation
           -> presence EQ -> limiter -> stereo via reverb + delay sends.
    """
    x = hpf(audio, sr, chain.hpf_hz)
    # Subtractive: dip top 1 prominent resonance
    peaks = detect_resonances(x, sr, n_peaks=1)
    for f, p in peaks:
        if p > 6:
            x = peak_eq(x, sr, f, q=4.0, gain_db=-min(p * 0.4, 3.0))
    x = de_esser(x, sr, freq=chain.de_ess_freq, threshold_db=chain.de_ess_threshold_db)
    t1, r1, atk1, rel1 = chain.comp1
    x = compressor(x, sr, threshold_db=t1, ratio=r1, attack_ms=atk1, release_ms=rel1, knee_db=6)
    t2, r2, atk2, rel2 = chain.comp2
    x = compressor(x, sr, threshold_db=t2, ratio=r2, attack_ms=atk2, release_ms=rel2, knee_db=3)
    # Parallel saturation send
    x = saturate(x, drive_db=chain.saturation_drive_db, mix=chain.saturation_mix,
                 kind=chain.saturation_kind)
    # Presence boost (mood-dependent)
    x = peak_eq(x, sr, chain.presence_freq, q=1.2, gain_db=chain.presence_boost_db)
    # Warmth tilt (low shelf up if warmth>0.5)
    warm_db = (warmth - 0.4) * 4.0
    if abs(warm_db) > 0.2:
        from .dsp.eq import low_shelf
        x = low_shelf(x, sr, 250.0, warm_db * 0.6)
        x = high_shelf(x, sr, 8000.0, -warm_db * 0.3)
    # Soft limit to keep vocal level under -1 dB before bus
    x = limiter(x, sr, ceiling_db=-1.0, release_ms=80, lookahead_ms=3, oversample=2)

    # FX sends -> stereo
    rev = reverb(x, sr, decay_s=chain.reverb_decay_s, damping=0.4,
                 pre_delay_ms=chain.reverb_predelay_ms,
                 wet=chain.reverb_wet * wet_mult, width=1.0)
    # delay time will be set by caller based on tempo; default 250ms
    return rev.astype(np.float32)


def apply_delay_send(stereo: np.ndarray, sr: int, chain: VocalChainPreset, bpm: float) -> np.ndarray:
    """Add tempo-synced delay send to an already-stereo signal."""
    if chain.delay_mix <= 0:
        return stereo
    beat_s = 60.0 / max(bpm, 1.0)
    time_ms = beat_s * chain.delay_time_div * 1000.0
    mono = stereo.mean(axis=1)
    d = delay(mono, sr, time_ms=time_ms, feedback=chain.delay_feedback,
              mix=chain.delay_mix, low_cut=400.0, high_cut=6000.0)
    return (stereo + d * 0.7).astype(np.float32)
