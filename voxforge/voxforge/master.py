"""Mastering chain: EQ -> multiband -> saturation -> true-peak limiter -> LUFS normalize."""
from __future__ import annotations

import numpy as np
import pyloudnorm as pyln

from .dsp.eq import tilt_eq, peak_eq
from .dsp.dynamics import multiband_compress, limiter, saturate


def measure_lufs(stereo: np.ndarray, sr: int) -> float:
    meter = pyln.Meter(sr)
    return float(meter.integrated_loudness(stereo.astype(np.float32)))


def measure_true_peak_dbfs(stereo: np.ndarray, sr: int, oversample: int = 4) -> float:
    """Approximate true peak by oversampling and reading max abs."""
    from scipy.signal import resample_poly
    up_l = resample_poly(stereo[:, 0], oversample, 1)
    up_r = resample_poly(stereo[:, 1], oversample, 1)
    peak = max(float(np.max(np.abs(up_l))), float(np.max(np.abs(up_r))))
    return 20.0 * np.log10(max(peak, 1e-12))


def master(
    stereo: np.ndarray,
    sr: int,
    target_lufs: float = -14.0,
    true_peak_db: float = -1.0,
    tilt_db: float = 0.5,
    add_saturation: bool = True,
    saturation_mix: float = 0.10,
) -> tuple[np.ndarray, dict]:
    """Master a stereo mix. Returns (mastered_stereo, telemetry)."""
    x = stereo.astype(np.float32).copy()
    # 1. Master EQ tilt
    if abs(tilt_db) > 0.05:
        x[:, 0] = tilt_eq(x[:, 0], sr, tilt_db)
        x[:, 1] = tilt_eq(x[:, 1], sr, tilt_db)
    # Slight high-mid shimmer
    x[:, 0] = peak_eq(x[:, 0], sr, 10000, q=0.8, gain_db=0.5)
    x[:, 1] = peak_eq(x[:, 1], sr, 10000, q=0.8, gain_db=0.5)

    # 2. Multiband compression (light glue)
    x[:, 0] = multiband_compress(x[:, 0], sr,
                                 crossovers=(180, 2800),
                                 settings=((-18, 2.0), (-16, 1.8), (-20, 2.0)),
                                 attack_ms=15, release_ms=120)
    x[:, 1] = multiband_compress(x[:, 1], sr,
                                 crossovers=(180, 2800),
                                 settings=((-18, 2.0), (-16, 1.8), (-20, 2.0)),
                                 attack_ms=15, release_ms=120)

    # 3. Optional saturation glue
    if add_saturation:
        x[:, 0] = saturate(x[:, 0], drive_db=4, mix=saturation_mix, kind="tape")
        x[:, 1] = saturate(x[:, 1], drive_db=4, mix=saturation_mix, kind="tape")

    # 4. Initial loudness measurement to roughly match target before limiting
    lufs_pre = measure_lufs(x, sr)
    target_gain_db = target_lufs - lufs_pre - 1.5  # leave 1.5 dB headroom for limiter
    target_gain = 10 ** (target_gain_db / 20.0)
    x = x * target_gain

    # 5. True-peak limiter (oversampled). Tighten ceiling by 0.3 dB to absorb
    # downsample reconstruction overshoot when we later remeasure at 4x oversample.
    limiter_ceiling = true_peak_db - 0.3
    out = np.zeros_like(x)
    out[:, 0] = limiter(x[:, 0], sr, ceiling_db=limiter_ceiling, release_ms=50,
                        lookahead_ms=5, oversample=8)
    out[:, 1] = limiter(x[:, 1], sr, ceiling_db=limiter_ceiling, release_ms=50,
                        lookahead_ms=5, oversample=8)

    # 6. Verify and trim if still hot
    lufs_post = measure_lufs(out, sr)
    delta = target_lufs - lufs_post
    if abs(delta) > 0.5:
        gain = 10 ** (delta / 20.0)
        out *= gain
        # If gain >1, run a second limiter pass to keep TP under ceiling
        if delta > 0:
            out[:, 0] = limiter(out[:, 0], sr, ceiling_db=limiter_ceiling, release_ms=50,
                                lookahead_ms=5, oversample=8)
            out[:, 1] = limiter(out[:, 1], sr, ceiling_db=limiter_ceiling, release_ms=50,
                                lookahead_ms=5, oversample=8)

    lufs_final = measure_lufs(out, sr)
    tp_final = measure_true_peak_dbfs(out, sr)
    telemetry = {
        "lufs_pre": lufs_pre,
        "lufs_final": lufs_final,
        "lufs_target": target_lufs,
        "true_peak_dbfs": tp_final,
        "true_peak_target": true_peak_db,
    }
    return out.astype(np.float32), telemetry
