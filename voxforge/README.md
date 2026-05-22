# VOXFORGE

**Voice-to-Song DAW pipeline** — drop in a raw vocal recording, get back a finished hip-hop / R&B / rap song with auto-tune, beat, mix, and streaming-ready master.

This repo is the **Week 0 proof** described in the product blueprint: a complete, runnable Python audio pipeline that demonstrates every stage end-to-end. It is the reference implementation that the production WASM/native port will follow.

---

## What it does

Given a vocal WAV / FLAC / MP3:

1. **Preprocess** — loudness normalize, spectral-gate denoise, HPF, silence trim, plosive mitigation, clip repair, resonance taming.
2. **Analyze** — pYIN F0 tracking, note segmentation, Krumhansl-Schmuckler key inference, tempo estimate, section detection, voice-class classification.
3. **Auto-tune** — per-segment pitch correction with 5 presets (`natural`, `modern`, `hard`, `rnb`, `drill`), formant preservation, vibrato preservation, consonant guard, artifact gate, retune-speed ramp.
4. **Vocal chain** — HPF → subtractive EQ → de-esser → 2 compressors → saturation → presence EQ → soft limit → reverb send → tempo-synced delay send.
5. **Beat generation** — synth-only (no samples / no copyright issues) drums + 808 + chord pad + optional piano, 5 genre patterns, sidechained.
6. **Mix** — vocal-forward dynamic EQ on instrumental, sidechain bass-from-kick, M/S width.
7. **Master** — tilt EQ → multiband compression → optional saturation → oversampled true-peak limiter → LUFS normalize to genre target.
8. **AI lyrics** *(optional)* — offline template-based rap lyric generator with rhyme groups + theme/genre awareness. Optional Anthropic API path for higher-quality output.

Output:

- 24-bit master WAV at the genre's LUFS target (default −14 LUFS, true peak ≤ −1 dBTP)
- 16-bit dithered WAV (TPDF) for distribution
- Instrumental stem
- Acapella (tuned vocal) stem
- Lyrics markdown (when requested)

---

## Install

```bash
pip install numpy scipy soundfile pyloudnorm librosa numba
```

(Tested with Python 3.11. Optional `anthropic` SDK for the LLM lyric path.)

---

## Quick demo (no input needed)

```bash
python -m voxforge demo --genre trap --duration 15 --out output --basename demo \
  --lyrics-theme hustle --lyrics-bars 8
```

This synthesizes a test vocal, runs it through the entire pipeline, and writes:

```
output/demo_input_vocal.wav    # the raw synthesized vocal
output/demo_master.wav         # 24-bit master at -14 LUFS
output/demo_master_16.wav      # 16-bit dithered
output/demo_instrumental.wav   # beat only
output/demo_acapella.wav       # tuned vocal only
output/demo_lyrics.md          # AI-generated rap lyrics
```

## Real vocal input

```bash
python -m voxforge render your_vocal.wav \
  --genre trap --tune modern --tune-strength 75 \
  --energy 0.6 --warmth 0.4 \
  --out output --basename my_song
```

## Just lyrics

```bash
python -m voxforge lyrics --theme love --genre rnb --verses 2 --bars 16
```

## Just analyze

```bash
python -m voxforge analyze your_vocal.wav
```

---

## Genres

| Genre | BPM | LUFS | Tune | Vibe |
|---|---|---|---|---|
| `trap` | 140 | −14 | modern | 808 glide, off-beat snare |
| `boom_bap` | 90 | −12 | natural | Swung hats, piano, walking bass |
| `rnb` | 85 | −16 | rnb | Pad + piano, deep reverb |
| `drill` | 142 | −13 | drill | Sliding kicks, stutter hats |
| `melodic` | 145 | −14 | modern | Halftime feel, pad, melodic |

## Tune presets

| Preset | Retune | Humanize | Flex | Use it for |
|---|---|---|---|---|
| `natural` | 80 ms | 60% | 200 ¢ | Subtle correction; boom bap / soul |
| `modern` | 30 ms | 30% | 100 ¢ | Default for trap / melodic rap |
| `hard` | 0 ms | 0% | 30 ¢ | T-Pain-style iconic effect |
| `rnb` | 50 ms | 40% | 150 ¢ | Smooth R&B with vibrato preserved |
| `drill` | 25 ms | 25% | 80 ¢ | Aggressive UK drill flavor |

The `--tune-strength 0..100` knob blends from the named preset (low strength) toward harder settings (high strength), so users can dial in tune amount without picking a preset.

---

## What's verified

The test suite (`pytest tests/`) verifies:

- DSP primitives: HPF cuts low band; compressor reduces RMS; limiter holds ceiling; pitch shift moves pitch by N semitones; synths don't NaN or clip; de-esser attenuates sibilance.
- Auto-tune: pitch error decreases after correction; short notes are skipped; no NaN in output; tempo lands in the hip-hop range.
- Lyrics: structure (intro/verse/hook/outro); bar counts; syllable estimation; rhyme scheme integrity across all themes.
- Pipeline end-to-end (all 5 genres): output is stereo float32 ≤ 1.0; LUFS within ±0.5 LU of target; true peak ≤ −1.0 dBTP; no clipping; all four stem files writable.

Run:

```bash
python -m pytest tests/ -q
```

---

## Architecture

```
voxforge/
├── pipeline.py        # top-level orchestrator (render_song)
├── cli.py             # argparse CLI (render | analyze | autotune | lyrics | demo | presets)
├── io_utils.py        # load, save, resample, dither
├── preprocess.py      # HPF, denoise, trim, plosive, clip repair, resonance
├── analysis.py        # F0, key, tempo, sections, voice-class
├── autotune.py        # per-segment pitch correction w/ artifact safety
├── vocal_chain.py     # EQ/comp/de-ess/sat/presence/limiter/reverb/delay
├── beat.py            # drums + 808 + chords + arrangement per genre
├── mix.py             # vocal-forward, sidechain, M/S, bus
├── master.py          # tilt → MB comp → sat → TP limiter → LUFS normalize
├── lyrics.py          # offline template rap gen + optional Anthropic API
├── lyric_data.py      # rhyme groups, theme word pools, hook templates
├── presets.py         # genre + vocal chain + tune presets (single source)
├── demo_vocal.py      # synthesizer for test vocals
└── dsp/
    ├── eq.py          # HPF, LPF, peaking, shelves, tilt, resonance detection
    ├── dynamics.py    # comp, de-ess, limiter, sidechain, multiband, saturate
    ├── reverb.py      # FFT-convolution reverb + IIR delay
    ├── pitch_shift.py # phase-vocoder shift + formant correction + crossfades
    └── synth.py       # kick, snare, hihat, 808, pluck, pad, piano (no samples)
```

---

## What this isn't

This is the **algorithmic reference** for the product. Not the production app. It has:

- ✗ No GUI (the planned BandLab-meets-FL UI is a separate Web/React build)
- ✗ No real-time monitoring (offline render only)
- ✗ No native low-latency tracking (V2 deliverable per blueprint)
- ✗ No on-device ML (we use pYIN, not CREPE; CREPE-tiny port lives in the WASM build)
- ✗ No cloud rendering, auth, or storage (those live in the API tier)

It is, however, a **complete, tested, runnable pipeline** you can hand to engineers as the spec for the production WASM port. The DSP modules are designed to translate 1:1 to Rust (`fundsp`, `rustfft`, custom PSOLA), and the orchestration logic in `pipeline.py` is intentionally framework-free.

---

## License & copyright safety

- All sounds are synthesized from scratch (`dsp/synth.py`). No samples shipped.
- Lyric word pools and templates are generic English; no copyrighted lyrics.
- The pipeline is designed for the user's own vocals only. The blueprint's privacy / consent rules apply when this is wrapped into a product.
