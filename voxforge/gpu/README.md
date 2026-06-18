# GPU Song Generation (real rap, not recited)

This is the path to **actual sung/rapped vocals**, not TTS-style recitation.
Runs ACE-Step (open-source song generation model, MIT-licensed) on a cloud GPU
via Modal.com.

The CPU pipeline already in `voxforge/` does: pitch correction, mixing, mastering.
The GPU pipeline here does: **end-to-end song generation from lyrics**, including
sung/rapped vocals. Use both: ACE-Step for the song, VOXFORGE for the master.

---

## Cost estimate

- Modal L4 GPU: ~$0.80/hr, billed by the second.
- Each render: 1–3 minutes of GPU time = $0.02–0.05 per song.
- Modal gives **$30 free starting credit** to new accounts — that's ~600 songs.
- After credit: a hobbyist burning 10 songs/day costs maybe $5/month.

Alternative providers (same idea, different pricing):
- Replicate: pay-per-second L40S ~$0.70/hr
- RunPod: A40 from ~$0.30/hr (community), needs more setup
- Beam.cloud: free tier for first hours, then ~$1/hr

I picked Modal because the setup is one command.

---

## One-time setup (5 minutes)

```bash
# 1. Make a Modal account at https://modal.com (free)
# 2. Install the CLI
pip install modal

# 3. Authenticate (opens browser)
modal setup

# 4. Deploy the function (uploads code; pulls the image; doesn't yet pay for GPU)
modal deploy gpu/modal_acestep.py
```

That's it. The function is live but only burns money when called.

---

## Render a song

```bash
modal run gpu/modal_acestep.py::generate \
  --lyrics-file output/my_voice_song_lyrics.md \
  --reference output/my_voice_song_voice_ref.wav \
  --style "boom bap, J Cole inspired, conscious rap, 90 BPM, soulful, vinyl warmth" \
  --duration 90 \
  --out acestep_song.wav
```

**First run downloads the model (~10 GB) into a Modal volume.** That takes 3–5 minutes.
Subsequent runs skip the download and finish in ~1–2 minutes on an L4.

Optional flags:
- `--seed 42` — reproducible output
- `--duration 30` (seconds) — shorter draft for faster iteration
- `--style "..."` — free-form style prompt; ACE-Step is conditioned on natural language

---

## Then master it

ACE-Step's output is good but not loudness-normalized to streaming spec.
Pipe it back through the VOXFORGE master chain:

```bash
python gpu/postprocess_acestep.py acestep_song.wav \
  -o final_song.wav --lufs -14
```

Result: same song, mastered to −14 LUFS / −1 dBTP.

---

## Honest caveats

- **Voice clone quality**: ACE-Step's reference-audio conditioning bias your generation
  toward a timbre, but it does NOT do exact voice cloning. The cloned voice from
  Chatterbox (CPU path) is actually a closer timbre match — but it's recited, not
  rapped. Tradeoff.
- **Cadence vs timbre**: the GPU path wins on cadence/flow (it's a song model);
  the CPU path wins on voice match (it's a voice clone model).
- **Best of both worlds**: render the song on GPU with ACE-Step, then run an open-source
  voice conversion model (RVC) to swap the vocal toward your voice. Not yet
  wired up; possible v2.
- **Suno/Udio are still ahead.** They train on proprietary data with bigger models.
  ACE-Step is the closest open-source you'll find as of late 2025.

---

## Architecture diagram

```
                  ┌─────────────────────────┐
   Lyrics ────────│                         │
                  │   ACE-Step on GPU       │── full song WAV
   Style prompt ──│   (Modal cloud)         │
                  │                         │
   Voice ref ─────│                         │
                  └────────────┬────────────┘
                               │
                  ┌────────────▼────────────┐
                  │  VOXFORGE master chain  │── streaming-ready WAV
                  │  (local CPU)            │   (-14 LUFS / -1 dBTP)
                  │  EQ → MB → TP limiter   │
                  │  → LUFS normalize       │
                  └─────────────────────────┘
```
