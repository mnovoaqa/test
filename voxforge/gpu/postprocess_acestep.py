"""Feed ACE-Step's output back through the VOXFORGE mastering chain.

ACE-Step produces a full mixed song. We don't want to remix it from scratch,
just polish: master EQ + multiband + true-peak limiter + LUFS normalize
to the streaming-ready target.

Usage:
  python gpu/postprocess_acestep.py acestep_song.wav -o song_final.wav --lufs -14
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np
from voxforge import io_utils, master


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input", help="WAV from ACE-Step")
    ap.add_argument("-o", "--out", required=True)
    ap.add_argument("--lufs", type=float, default=-14.0)
    ap.add_argument("--true-peak", type=float, default=-1.0)
    ap.add_argument("--warmth", type=float, default=0.4)
    args = ap.parse_args()

    audio, sr = io_utils.load_audio(args.input, target_sr=48000, mono=False)
    if audio.ndim == 1:
        audio = np.stack([audio, audio], axis=1)
    mastered, tel = master.master(
        audio, sr,
        target_lufs=args.lufs,
        true_peak_db=args.true_peak,
        tilt_db=(args.warmth - 0.4) * -2.0,
    )
    io_utils.save_audio(args.out, mastered, sr, subtype="PCM_24")
    print(f"Mastered to {tel['lufs_final']:.2f} LUFS, "
          f"TP {tel['true_peak_dbfs']:.2f} dBTP -> {args.out}")


if __name__ == "__main__":
    main()
