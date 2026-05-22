"""VOXFORGE — Gradio web UI.

Launch with: python -m voxforge.app   (or   python app.py)

Two tabs:
  1. Make a Song  - upload vocal, pick genre, hit the big button, get song back
  2. Write Lyrics - generate rap lyrics by theme/genre
  3. Demo         - synthesize a fake vocal and run the full pipeline
"""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

import gradio as gr
import numpy as np
import soundfile as sf

# Make sure the package is importable when running this file directly
sys.path.insert(0, str(Path(__file__).parent))

from voxforge import pipeline, io_utils, demo_vocal
from voxforge.lyrics import generate_lyrics
from voxforge.presets import list_genres, list_tune_styles, GENRE_PRESETS


# Where to write outputs (Gradio will serve them back as audio components)
OUT_DIR = Path(tempfile.gettempdir()) / "voxforge_outputs"
OUT_DIR.mkdir(parents=True, exist_ok=True)


# ----------------- handlers ------------------------------------------------


def make_song(
    vocal_path: str | None,
    genre: str,
    tune_style: str,
    tune_strength: int,
    energy: float,
    warmth: float,
    vocal_db: float,
    beat_db: float,
    seed: int,
    progress=gr.Progress(track_tqdm=False),
):
    if not vocal_path:
        raise gr.Error("Upload or record a vocal first.")
    progress(0.1, desc="Loading vocal…")
    tune = None if tune_style == "auto" else tune_style
    progress(0.2, desc="Analyzing pitch, key, tempo…")
    result = pipeline.render_song(
        vocal_path=vocal_path,
        genre=genre,
        tune_style=tune,
        tune_strength=int(tune_strength),
        energy=float(energy),
        warmth=float(warmth),
        vocal_level_db=float(vocal_db),
        beat_level_db=float(beat_db),
        seed=int(seed),
        verbose=False,
    )
    progress(0.9, desc="Writing files…")
    basename = f"song_{int(seed)}"
    paths = pipeline.write_outputs(result, OUT_DIR, basename=basename)
    info = (
        f"**Key:** {result.key}    **BPM:** {result.bpm:.1f}    "
        f"**Voice:** {result.voice_class}    **Tune preset:** {result.tune_preset}\n\n"
        f"**Mastered to:** {result.master_telemetry['lufs_final']:.2f} LUFS "
        f"(target {result.master_telemetry['lufs_target']})    "
        f"**True peak:** {result.master_telemetry['true_peak_dbfs']:.2f} dBTP\n\n"
        f"**Auto-tune:** {result.tune_summary['notes_tuned']}/"
        f"{result.tune_summary['notes_total']} notes corrected "
        f"(median Δ {result.tune_summary['median_shift_cents']:.0f} ¢)\n\n"
        f"**Arrangement:** {result.arrangement['total_bars']} bars"
    )
    return (
        paths["master_24"], paths["instrumental"], paths["acapella"],
        paths["master_16"], info,
    )


def write_lyrics(
    theme: str, genre: str, verses: int, bars: int,
    include_hook: bool, include_intro: bool, seed: int, use_llm: bool,
):
    if seed <= 0:
        seed = None
    song = generate_lyrics(
        theme=theme, genre=genre,
        bars_per_verse=int(bars), n_verses=int(verses),
        include_hook=include_hook, include_intro_outro=include_intro,
        seed=seed, use_llm=use_llm,
    )
    return song.render()


def run_demo(
    genre: str, tune_style: str, tune_strength: int, energy: float,
    warmth: float, duration: float, seed: int, lyrics_theme: str,
    progress=gr.Progress(track_tqdm=False),
):
    progress(0.1, desc="Synthesizing demo vocal…")
    voc = demo_vocal.synth_demo_vocal(
        sr=48000, duration_s=float(duration),
        bpm=GENRE_PRESETS[genre].default_bpm, seed=int(seed),
    )
    progress(0.3, desc="Running pipeline…")
    tune = None if tune_style == "auto" else tune_style
    result = pipeline.render_song(
        vocal_audio=voc, sr_in=48000,
        genre=genre, tune_style=tune,
        tune_strength=int(tune_strength), energy=float(energy),
        warmth=float(warmth), seed=int(seed), verbose=False,
    )
    progress(0.85, desc="Writing files…")
    basename = f"demo_{genre}_{int(seed)}"
    # Also save the input vocal so it can be played back
    input_path = OUT_DIR / f"{basename}_input_vocal.wav"
    io_utils.save_audio(input_path, voc, 48000, subtype="PCM_24")
    paths = pipeline.write_outputs(result, OUT_DIR, basename=basename)
    lyrics_md = ""
    if lyrics_theme and lyrics_theme != "(none)":
        song = generate_lyrics(theme=lyrics_theme, genre=genre,
                                 bars_per_verse=8, n_verses=2, seed=int(seed))
        lyrics_md = song.render()
    info = (
        f"**Demo vocal:** {float(duration):.0f}s synthetic test signal\n\n"
        f"**Key:** {result.key}    **BPM:** {result.bpm:.1f}    "
        f"**Tune preset:** {result.tune_preset}\n\n"
        f"**Mastered to:** {result.master_telemetry['lufs_final']:.2f} LUFS, "
        f"**True peak:** {result.master_telemetry['true_peak_dbfs']:.2f} dBTP"
    )
    return (
        str(input_path), paths["master_24"], paths["instrumental"],
        paths["acapella"], info, lyrics_md,
    )


# ----------------- UI ------------------------------------------------------


CSS = """
.gradio-container { max-width: 1200px !important; }
#hero { text-align:center; padding: 16px 0 4px 0; }
#hero h1 { font-size: 40px; margin: 4px 0; letter-spacing: -1px; }
#hero p { color: #888; margin: 0; }
.pro-btn button { font-size: 18px !important; height: 56px !important;
                  background: linear-gradient(135deg,#00E676,#00B050) !important;
                  color: black !important; font-weight: 700 !important; }
"""


with gr.Blocks(title="VOXFORGE — Voice to Song", css=CSS,
                theme=gr.themes.Soft(primary_hue="green", neutral_hue="slate")) as app:
    gr.HTML(
        '<div id="hero"><h1>🎙️  VOXFORGE</h1>'
        '<p>Drop a vocal. Get a song. (Hip-hop / R&B / Rap)</p></div>'
    )

    with gr.Tabs():
        # ----- MAKE A SONG ------------------------------------------------
        with gr.Tab("🎵 Make a Song"):
            with gr.Row():
                with gr.Column(scale=1):
                    vocal_in = gr.Audio(
                        label="Your vocal (upload or record)",
                        sources=["upload", "microphone"],
                        type="filepath",
                    )
                    genre_in = gr.Dropdown(
                        choices=list_genres(), value="trap", label="Genre",
                    )
                    tune_style_in = gr.Dropdown(
                        choices=["auto"] + list_tune_styles(),
                        value="auto", label="Auto-tune style",
                        info="'auto' uses the genre's recommended preset",
                    )
                    tune_strength_in = gr.Slider(
                        0, 100, value=75, step=1, label="Tune strength",
                        info="0 = barely correct • 50 = natural • 100 = T-Pain",
                    )
                    with gr.Accordion("Vibe knobs", open=False):
                        energy_in = gr.Slider(0, 1, value=0.6, step=0.05,
                                              label="Energy (drum density)")
                        warmth_in = gr.Slider(0, 1, value=0.4, step=0.05,
                                              label="Warmth (Clean ↔ Warm)")
                        vocal_db_in = gr.Slider(-6, 6, value=0, step=0.5,
                                                label="Vocal level dB")
                        beat_db_in = gr.Slider(-6, 6, value=-2, step=0.5,
                                               label="Beat level dB")
                        seed_in = gr.Number(value=1234, label="Beat seed",
                                            precision=0)
                    make_btn = gr.Button("🚀  MAKE IT SOUND PRO",
                                          elem_classes="pro-btn", variant="primary")

                with gr.Column(scale=1):
                    out_info = gr.Markdown("_Upload a vocal and hit the green button._")
                    out_master = gr.Audio(label="Master (24-bit)", type="filepath")
                    out_instr = gr.Audio(label="Instrumental only", type="filepath")
                    out_voc = gr.Audio(label="Acapella (tuned)", type="filepath")
                    out_master16 = gr.File(label="Master 16-bit dithered (download)")

            make_btn.click(
                make_song,
                inputs=[vocal_in, genre_in, tune_style_in, tune_strength_in,
                        energy_in, warmth_in, vocal_db_in, beat_db_in, seed_in],
                outputs=[out_master, out_instr, out_voc, out_master16, out_info],
            )

        # ----- LYRICS ------------------------------------------------------
        with gr.Tab("✍️ Write Lyrics"):
            with gr.Row():
                with gr.Column(scale=1):
                    theme_in = gr.Dropdown(
                        choices=["hustle", "love", "struggle", "party", "flex", "reflection"],
                        value="hustle", label="Theme",
                    )
                    lyr_genre_in = gr.Dropdown(choices=list_genres(), value="trap", label="Genre")
                    verses_in = gr.Slider(1, 4, value=2, step=1, label="Verses")
                    bars_in = gr.Slider(4, 16, value=16, step=1, label="Bars per verse")
                    hook_in = gr.Checkbox(value=True, label="Include hook")
                    intro_in = gr.Checkbox(value=True, label="Include intro / outro")
                    lyr_seed_in = gr.Number(value=0, precision=0,
                                            label="Seed (0 = random)")
                    llm_in = gr.Checkbox(value=False,
                                          label="Use LLM (needs ANTHROPIC_API_KEY env var)")
                    write_btn = gr.Button("✍️  Generate Lyrics", variant="primary")
                with gr.Column(scale=2):
                    lyr_out = gr.Markdown(label="Lyrics")

            write_btn.click(
                write_lyrics,
                inputs=[theme_in, lyr_genre_in, verses_in, bars_in,
                        hook_in, intro_in, lyr_seed_in, llm_in],
                outputs=[lyr_out],
            )

        # ----- DEMO --------------------------------------------------------
        with gr.Tab("🧪 Demo (no input needed)"):
            gr.Markdown(
                "Don't have a vocal handy? This synthesizes a fake one and runs the "
                "whole pipeline so you can hear what the engine sounds like.")
            with gr.Row():
                with gr.Column(scale=1):
                    dgenre = gr.Dropdown(choices=list_genres(), value="trap", label="Genre")
                    dtune = gr.Dropdown(choices=["auto"] + list_tune_styles(),
                                          value="auto", label="Tune style")
                    dstrength = gr.Slider(0, 100, value=80, step=1, label="Tune strength")
                    denergy = gr.Slider(0, 1, value=0.65, step=0.05, label="Energy")
                    dwarmth = gr.Slider(0, 1, value=0.4, step=0.05, label="Warmth")
                    dduration = gr.Slider(8, 30, value=15, step=1, label="Vocal length (s)")
                    dseed = gr.Number(value=7, precision=0, label="Seed")
                    dlyrics_theme = gr.Dropdown(
                        choices=["(none)", "hustle", "love", "struggle", "party", "flex", "reflection"],
                        value="hustle", label="Also generate lyrics?")
                    dbtn = gr.Button("🧪  Run Demo", variant="primary")
                with gr.Column(scale=1):
                    dinfo = gr.Markdown()
                    dinput = gr.Audio(label="Demo input vocal (the fake one)", type="filepath")
                    dmaster = gr.Audio(label="Mastered song", type="filepath")
                    dinstr = gr.Audio(label="Instrumental only", type="filepath")
                    dvoc = gr.Audio(label="Acapella (tuned)", type="filepath")
                    dlyrics = gr.Markdown()
            dbtn.click(
                run_demo,
                inputs=[dgenre, dtune, dstrength, denergy, dwarmth, dduration, dseed, dlyrics_theme],
                outputs=[dinput, dmaster, dinstr, dvoc, dinfo, dlyrics],
            )

    gr.Markdown(
        "—\n\n"
        "Tip for best results: quiet room • mic 6–8 in. from mouth • peaks around −12 to −6 dBFS • "
        "wired headphones (no monitor speakers).")


def main():
    server_name = os.environ.get("VOXFORGE_HOST", "0.0.0.0")
    server_port = int(os.environ.get("VOXFORGE_PORT", "7860"))
    share = os.environ.get("VOXFORGE_SHARE", "1") == "1"
    app.queue(default_concurrency_limit=1).launch(
        server_name=server_name, server_port=server_port, share=share,
        show_error=True,
    )


if __name__ == "__main__":
    main()
