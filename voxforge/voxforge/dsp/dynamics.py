"""Dynamics processors: compressor, de-esser, limiter, sidechain.

Hot loops are numba-JITed for speed on multi-minute audio.
"""
from __future__ import annotations

import numpy as np
from numba import njit
from scipy.signal import resample_poly
from scipy.ndimage import maximum_filter1d

from .eq import bandpass


def _db(x):
    return 20.0 * np.log10(np.maximum(np.abs(x), 1e-9))


def _from_db(x):
    return 10.0 ** (np.asarray(x) / 20.0)


@njit(cache=True, fastmath=True)
def _env_follow(audio: np.ndarray, a_atk: float, a_rel: float) -> np.ndarray:
    n = len(audio)
    env = np.empty(n, dtype=np.float32)
    prev = np.float32(0.0)
    for i in range(n):
        x = abs(audio[i])
        if x > prev:
            prev = np.float32(a_atk * prev + (1.0 - a_atk) * x)
        else:
            prev = np.float32(a_rel * prev + (1.0 - a_rel) * x)
        env[i] = prev
    return env


def envelope_follower(audio: np.ndarray, sr: int, attack_ms: float, release_ms: float) -> np.ndarray:
    a_atk = np.exp(-1.0 / (sr * attack_ms * 1e-3 + 1e-9))
    a_rel = np.exp(-1.0 / (sr * release_ms * 1e-3 + 1e-9))
    return _env_follow(audio.astype(np.float32), float(a_atk), float(a_rel))


def compressor(
    audio: np.ndarray,
    sr: int,
    threshold_db: float = -18.0,
    ratio: float = 4.0,
    attack_ms: float = 10.0,
    release_ms: float = 80.0,
    knee_db: float = 6.0,
    makeup_db: float | None = None,
) -> np.ndarray:
    env = envelope_follower(audio, sr, attack_ms, release_ms)
    env_db = _db(env)
    over = env_db - threshold_db
    gr_db = np.zeros_like(env_db)
    above = over > (knee_db / 2)
    in_knee = (over > -knee_db / 2) & (over <= knee_db / 2)
    gr_db[above] = over[above] - over[above] / ratio
    if knee_db > 0:
        k_over = over[in_knee] + knee_db / 2
        gr_db[in_knee] = (1 - 1 / ratio) * (k_over ** 2) / (2 * knee_db)
    if makeup_db is None:
        ref_over = max(0.0, -6.0 - threshold_db)
        ref_gr = ref_over - ref_over / ratio
        makeup_db = ref_gr * 0.5
    gain_db = -gr_db + makeup_db
    return (audio * _from_db(gain_db)).astype(np.float32)


def de_esser(
    audio: np.ndarray,
    sr: int,
    freq: float = 6500.0,
    bw: float = 3000.0,
    threshold_db: float = -22.0,
    ratio: float = 4.0,
    attack_ms: float = 2.0,
    release_ms: float = 40.0,
) -> np.ndarray:
    low_cut = max(2000.0, freq - bw / 2)
    high_cut = min(sr / 2 - 1000, freq + bw / 2)
    high = bandpass(audio, sr, low_cut, high_cut)
    low = audio - high
    env = envelope_follower(high, sr, attack_ms, release_ms)
    env_db = _db(env)
    over = env_db - threshold_db
    gr_db = np.where(over > 0, over - over / ratio, 0.0)
    gain = _from_db(-gr_db)
    return (low + high * gain).astype(np.float32)


@njit(cache=True, fastmath=True)
def _limiter_release(target_gain: np.ndarray, a_rel: float) -> np.ndarray:
    n = len(target_gain)
    g = np.empty(n, dtype=np.float32)
    prev = np.float32(1.0)
    for i in range(n):
        t = target_gain[i]
        if t < prev:
            prev = t
        else:
            prev = np.float32(a_rel * prev + (1.0 - a_rel) * t)
        g[i] = prev
    return g


def limiter(
    audio: np.ndarray,
    sr: int,
    ceiling_db: float = -1.0,
    release_ms: float = 60.0,
    lookahead_ms: float = 5.0,
    oversample: int = 4,
) -> np.ndarray:
    """Lookahead brick-wall limiter with oversampled true-peak detection."""
    if oversample > 1:
        up = resample_poly(audio, oversample, 1).astype(np.float32)
    else:
        up = audio.astype(np.float32)
    sr_os = sr * oversample
    ceiling = float(_from_db(ceiling_db))

    look = max(int(lookahead_ms * 1e-3 * sr_os), 1)
    padded = np.concatenate([up, np.zeros(look, dtype=np.float32)])
    abs_p = np.abs(padded)
    win_peak = maximum_filter1d(abs_p, size=look, mode="constant", origin=-(look // 2))[: len(up)]
    target_gain = np.minimum(1.0, ceiling / np.maximum(win_peak, 1e-9)).astype(np.float32)
    a_rel = float(np.exp(-1.0 / (sr_os * release_ms * 1e-3 + 1e-9)))
    g = _limiter_release(target_gain, a_rel)
    delayed = np.concatenate([np.zeros(look, dtype=np.float32), up])[: len(up)]
    out = delayed * g
    np.clip(out, -ceiling * 0.9995, ceiling * 0.9995, out=out)
    if oversample > 1:
        out = resample_poly(out, 1, oversample).astype(np.float32)
        out = np.clip(out, -ceiling * 0.999, ceiling * 0.999)
    return out.astype(np.float32)


def saturate(audio: np.ndarray, drive_db: float = 6.0, mix: float = 0.2, kind: str = "tape") -> np.ndarray:
    g = _from_db(drive_db)
    x = audio * g
    if kind == "tube":
        y = np.where(x >= 0, np.tanh(x), np.tanh(x * 0.8))
    else:
        y = np.tanh(x)
    y = y / g
    return ((1 - mix) * audio + mix * y).astype(np.float32)


def sidechain_compressor(
    target: np.ndarray,
    key: np.ndarray,
    sr: int,
    threshold_db: float = -24.0,
    ratio: float = 8.0,
    attack_ms: float = 5.0,
    release_ms: float = 120.0,
) -> np.ndarray:
    n = min(len(target), len(key))
    t_ = target[:n]
    k_ = key[:n]
    env = envelope_follower(k_, sr, attack_ms, release_ms)
    env_db = _db(env)
    over = env_db - threshold_db
    gr_db = np.where(over > 0, over - over / ratio, 0.0)
    gain = _from_db(-gr_db)
    return (t_ * gain).astype(np.float32)


def multiband_compress(
    audio: np.ndarray,
    sr: int,
    crossovers: tuple = (200.0, 2500.0),
    settings: tuple = ((-20.0, 2.0), (-18.0, 2.0), (-22.0, 2.0)),
    attack_ms: float = 10.0,
    release_ms: float = 100.0,
) -> np.ndarray:
    """3-band compression (low, mid, high). settings: tuple of (threshold_db, ratio)."""
    from .eq import lpf, hpf, bandpass
    low = lpf(audio, sr, crossovers[0], order=4)
    mid = bandpass(audio, sr, crossovers[0], crossovers[1], order=4)
    high = hpf(audio, sr, crossovers[1], order=4)
    out = np.zeros_like(audio)
    for band, (thr, r) in zip([low, mid, high], settings):
        out += compressor(band, sr, threshold_db=thr, ratio=r,
                          attack_ms=attack_ms, release_ms=release_ms, knee_db=4.0, makeup_db=0.0)
    return out.astype(np.float32)
