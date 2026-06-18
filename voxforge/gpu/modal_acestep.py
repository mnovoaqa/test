"""Modal.com deployment of ACE-Step for full-song generation.

ACE-Step (ACE Studio / StepFun, Apr 2025) is the strongest open-source
song generation model: lyrics + style prompt → full song with vocals.
Comparable category to Suno / Udio, MIT-licensed.

Deploying via Modal because:
- Free $30 starting credit (covers many test renders)
- Scales to zero (you only pay when generating)
- Single-file deployment
- L4 or A10G is enough; A100 if you want faster

Setup (one time, ~5 minutes):

  pip install modal
  modal setup                                  # browser auth
  modal deploy gpu/modal_acestep.py            # deploys the function

Use:

  # From your local machine (anywhere with python+modal installed)
  modal run gpu/modal_acestep.py::generate \\
    --lyrics-file output/my_voice_song_lyrics.md \\
    --reference output/my_voice_song_voice_ref.wav \\
    --style "boom bap, J Cole, conscious rap, 90 BPM, vinyl warmth" \\
    --duration 90 \\
    --out song.wav

After it runs once, the model is cached in a Modal volume, so subsequent
renders skip the 10 GB download.
"""
from __future__ import annotations

import os
from pathlib import Path

import modal


# ---- Modal image: CUDA + ACE-Step deps -----------------------------------
image = (
    modal.Image.from_registry("nvidia/cuda:12.4.1-devel-ubuntu22.04",
                               add_python="3.11")
    .apt_install("git", "ffmpeg", "libsndfile1")
    .pip_install(
        "torch==2.6.0",
        "torchaudio==2.6.0",
        index_url="https://download.pytorch.org/whl/cu124",
    )
    .pip_install(
        "transformers>=4.40",
        "accelerate",
        "diffusers",
        "soundfile",
        "librosa",
        "huggingface_hub",
        "einops",
        "safetensors",
    )
    .run_commands(
        # ACE-Step is distributed via HuggingFace; clone the inference code
        "git clone --depth 1 https://github.com/ace-step/ACE-Step /opt/acestep || true",
        "pip install -e /opt/acestep || pip install acestep || true",
    )
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
)

app = modal.App("voxforge-acestep", image=image)
volume = modal.Volume.from_name("voxforge-models", create_if_missing=True)
MODEL_DIR = "/models"


# ---- core generation function -------------------------------------------
@app.function(
    gpu="L4",                                 # cheapest viable: ~$0.80/hr
    timeout=60 * 30,                          # 30 minutes
    volumes={MODEL_DIR: volume},
    secrets=[modal.Secret.from_name("hf-token", required_keys=[])],  # optional
)
def generate_song(
    lyrics: str,
    style_prompt: str = "hip hop, boom bap, conscious rap, soulful, 90 BPM",
    reference_audio_bytes: bytes | None = None,
    duration_s: float = 60.0,
    cfg_scale: float = 6.0,
    n_steps: int = 50,
    seed: int = 0,
) -> bytes:
    """Run ACE-Step. Returns the WAV bytes of the generated song.

    `reference_audio_bytes` is optional — if provided, ACE-Step will try
    to bias the vocal toward that timbre via its audio-conditioning input.
    """
    import io
    import sys
    import numpy as np
    import soundfile as sf

    sys.path.insert(0, "/opt/acestep")

    # Two import paths depending on which release we got — fall through
    try:
        from acestep.pipeline_ace_step import ACEStepPipeline  # type: ignore
    except ImportError:
        from pipeline_ace_step import ACEStepPipeline           # type: ignore

    pipe = ACEStepPipeline(
        checkpoint_dir=MODEL_DIR,
        device="cuda",
        dtype="bfloat16",
    )
    # Pre-flight: download weights into the cached volume if missing
    pipe.load_checkpoint()

    ref_path = None
    if reference_audio_bytes is not None:
        ref_path = "/tmp/ref.wav"
        Path(ref_path).write_bytes(reference_audio_bytes)

    audio = pipe(
        lyrics=lyrics,
        prompt=style_prompt,
        audio_path=ref_path,
        duration=duration_s,
        guidance_scale=cfg_scale,
        num_inference_steps=n_steps,
        seed=seed,
    )

    # ACEStepPipeline returns a numpy array or a path; normalize to WAV bytes
    if isinstance(audio, (list, tuple)):
        audio = audio[0]
    if hasattr(audio, "numpy"):
        audio = audio.numpy()
    audio = np.asarray(audio, dtype=np.float32)
    if audio.ndim == 1:
        audio = np.stack([audio, audio], axis=1)
    elif audio.shape[0] == 2 and audio.shape[1] > audio.shape[0]:
        audio = audio.T   # (2, n) -> (n, 2)

    buf = io.BytesIO()
    sf.write(buf, audio, 48000, subtype="PCM_24", format="WAV")
    volume.commit()    # persist the cached model weights for next run
    return buf.getvalue()


# ---- CLI entry points ----------------------------------------------------
@app.local_entrypoint()
def generate(
    lyrics_file: str,
    out: str = "acestep_song.wav",
    reference: str | None = None,
    style: str = "hip hop, boom bap, conscious rap, soulful, 90 BPM, vinyl warmth",
    duration: float = 60.0,
    seed: int = 0,
):
    """`modal run gpu/modal_acestep.py::generate --lyrics-file foo.md --out song.wav`"""
    lyrics = Path(lyrics_file).read_text()
    ref_bytes = Path(reference).read_bytes() if reference else None
    print(f"Submitting to Modal GPU: {len(lyrics)} chars of lyrics, "
          f"duration {duration}s, style='{style}'…")
    wav_bytes = generate_song.remote(
        lyrics=lyrics, style_prompt=style,
        reference_audio_bytes=ref_bytes,
        duration_s=duration, seed=seed,
    )
    Path(out).write_bytes(wav_bytes)
    print(f"Wrote {out} ({len(wav_bytes)/1024/1024:.1f} MB)")
