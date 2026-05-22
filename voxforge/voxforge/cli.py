"""VOXFORGE command-line interface.

Commands:
  render        Vocal-to-song pipeline end-to-end
  analyze       Vocal analysis only (key, tempo, notes)
  autotune      Auto-tune a vocal in place; output tuned WAV
  lyrics        Generate AI rap lyrics
  demo          Synthesize a demo vocal and render a full song
  presets       List genre / tune presets

Usage:
  python -m voxforge render vocal.wav --genre trap --tune modern --out out/song
  python -m voxforge lyrics --theme hustle --genre trap --verses 2 --bars 16
  python -m voxforge demo --genre rnb --out out/demo
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import pipeline, lyrics as lyric_mod, demo_vocal
from .presets import list_genres, list_tune_styles, GENRE_PRESETS, TUNE_PRESETS
from . import io_utils, analysis


def cmd_render(args: argparse.Namespace) -> int:
    """Full pipeline."""
    lyrics_text = None
    if args.lyrics_theme:
        song = lyric_mod.generate_lyrics(
            theme=args.lyrics_theme, genre=args.genre,
            bars_per_verse=args.lyrics_bars, n_verses=args.lyrics_verses,
            include_hook=True, include_intro_outro=True,
            seed=args.lyrics_seed, use_llm=args.lyrics_llm,
        )
        lyrics_text = song.render()
        print("--- LYRICS ---")
        print(lyrics_text)
        print("--------------")

    result = pipeline.render_song(
        vocal_path=args.vocal,
        genre=args.genre,
        tune_style=args.tune,
        tune_strength=args.tune_strength,
        energy=args.energy,
        warmth=args.warmth,
        vocal_level_db=args.vocal_db,
        beat_level_db=args.beat_db,
        lufs_target=args.lufs,
        seed=args.seed,
        verbose=True,
        skip_denoise=args.no_denoise,
    )
    result.lyrics_text = lyrics_text
    paths = pipeline.write_outputs(result, args.out, basename=args.basename)
    summary = {
        "paths": paths,
        "key": result.key,
        "bpm": result.bpm,
        "voice_class": result.voice_class,
        "tune_preset": result.tune_preset,
        "tune_summary": result.tune_summary,
        "master_telemetry": result.master_telemetry,
        "arrangement": result.arrangement,
    }
    print(json.dumps(summary, indent=2, default=str))
    return 0


def cmd_analyze(args: argparse.Namespace) -> int:
    audio, sr = io_utils.load_audio(args.vocal)
    a = analysis.analyze(audio, sr)
    print(json.dumps({
        "duration_s": len(audio) / sr,
        "key": a.key.name,
        "key_confidence": a.key.confidence,
        "bpm": a.tempo.bpm,
        "bpm_confidence": a.tempo.confidence,
        "voice_class": a.voice_class,
        "n_notes": len(a.notes),
        "n_sections": len(a.sections),
    }, indent=2))
    return 0


def cmd_autotune(args: argparse.Namespace) -> int:
    from . import autotune
    audio, sr = io_utils.load_audio(args.vocal)
    a = analysis.analyze(audio, sr)
    base = TUNE_PRESETS[args.tune]
    tuned, decisions = autotune.auto_tune(audio, sr, a.notes, a.key, base)
    io_utils.save_audio(args.out, tuned, sr, subtype="PCM_24")
    print(json.dumps({
        "out": args.out,
        "key": a.key.name,
        "tune_preset": args.tune,
        "summary": autotune.auto_tune_summary(decisions),
    }, indent=2))
    return 0


def cmd_lyrics(args: argparse.Namespace) -> int:
    song = lyric_mod.generate_lyrics(
        theme=args.theme, genre=args.genre,
        bars_per_verse=args.bars, n_verses=args.verses,
        include_hook=not args.no_hook,
        include_intro_outro=not args.no_intro,
        rhyme_scheme=args.rhyme,
        seed=args.seed,
        use_llm=args.llm,
    )
    text = song.render()
    if args.out:
        Path(args.out).write_text(text)
        print(f"Wrote {args.out}")
    print(text)
    return 0


def cmd_demo(args: argparse.Namespace) -> int:
    print("Synthesizing demo vocal...")
    voc = demo_vocal.synth_demo_vocal(
        sr=48000, duration_s=args.duration,
        bpm=GENRE_PRESETS[args.genre].default_bpm,
        seed=args.seed,
    )
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    demo_path = out_dir / f"{args.basename}_input_vocal.wav"
    io_utils.save_audio(demo_path, voc, 48000, subtype="PCM_24")
    print(f"  Wrote demo vocal: {demo_path}")
    lyrics_text = None
    if args.lyrics_theme:
        song = lyric_mod.generate_lyrics(
            theme=args.lyrics_theme, genre=args.genre,
            bars_per_verse=args.lyrics_bars, n_verses=args.lyrics_verses,
            seed=args.lyrics_seed, use_llm=args.lyrics_llm,
        )
        lyrics_text = song.render()
        print("--- LYRICS ---"); print(lyrics_text); print("--------------")

    result = pipeline.render_song(
        vocal_audio=voc, sr_in=48000,
        genre=args.genre, tune_style=args.tune,
        tune_strength=args.tune_strength, energy=args.energy,
        warmth=args.warmth, seed=args.seed,
        verbose=True,
    )
    result.lyrics_text = lyrics_text
    paths = pipeline.write_outputs(result, args.out, basename=args.basename)
    print(json.dumps({
        "paths": paths,
        "key": result.key, "bpm": result.bpm,
        "tune_preset": result.tune_preset,
        "master_telemetry": result.master_telemetry,
        "tune_summary": result.tune_summary,
    }, indent=2, default=str))
    return 0


def cmd_sing(args: argparse.Namespace) -> int:
    """Voice-clone the user's voice and render a full song with new lyrics."""
    from . import song_synth
    if args.lyrics_file:
        lyrics_text = Path(args.lyrics_file).read_text()
    else:
        lyrics_text = None  # will be auto-generated inside song_synth
    result = song_synth.synth_song(
        reference_voice_path=args.reference,
        lyrics_text=lyrics_text,
        lyrics_theme=args.lyrics_theme,
        lyrics_genre=args.genre,
        lyrics_verses=args.lyrics_verses,
        lyrics_bars=args.lyrics_bars,
        lyrics_seed=args.lyrics_seed,
        genre=args.genre,
        tune_style=args.tune,
        tune_strength=args.tune_strength,
        energy=args.energy if args.energy is not None else 0.45,
        warmth=args.warmth,
        seed=args.seed,
        out_dir=args.out,
        basename=args.basename,
        clone_exaggeration=args.clone_exaggeration,
        clone_cfg=args.clone_cfg,
        pause_ms=args.pause_ms,
    )
    print(json.dumps({
        "master": result.master_path,
        "instrumental": result.instrumental_path,
        "acapella": result.acapella_path,
        "lyrics": result.lyrics_path,
        "voice_ref": result.voice_ref_path,
        "info": result.info,
    }, indent=2, default=str))
    return 0


def cmd_presets(args: argparse.Namespace) -> int:
    print("GENRES:")
    for g, p in GENRE_PRESETS.items():
        print(f"  {g:<12} {p.display:<14} bpm={p.default_bpm:>5.1f} tune={p.tune:<8} LUFS={p.lufs_target}")
    print("\nTUNE STYLES:")
    for n, t in TUNE_PRESETS.items():
        print(f"  {n:<10} retune={t.retune_ms:>5.1f}ms humanize={t.humanize:.2f} flex={t.flex_cents:>5.1f}¢")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="voxforge",
                                 description="Vocal-to-song DAW pipeline.")
    sub = p.add_subparsers(dest="cmd", required=True)

    # render
    r = sub.add_parser("render", help="Full vocal-to-song render")
    r.add_argument("vocal", help="Path to vocal audio (wav/mp3/m4a/flac)")
    r.add_argument("--out", default="output", help="Output directory")
    r.add_argument("--basename", default="song", help="Output filename base")
    r.add_argument("--genre", choices=list_genres(), default="trap")
    r.add_argument("--tune", choices=list_tune_styles(), default=None,
                   help="Tune style; defaults to the genre's tune preset")
    r.add_argument("--tune-strength", type=int, default=75, help="0..100, default 75")
    r.add_argument("--energy", type=float, default=None, help="0..1, defaults per genre")
    r.add_argument("--warmth", type=float, default=0.4, help="0..1, default 0.4")
    r.add_argument("--vocal-db", type=float, default=0.0, help="Vocal level offset dB")
    r.add_argument("--beat-db", type=float, default=-2.0, help="Beat level offset dB")
    r.add_argument("--lufs", type=float, default=None, help="Override LUFS target")
    r.add_argument("--seed", type=int, default=1234)
    r.add_argument("--no-denoise", action="store_true")
    r.add_argument("--lyrics-theme", default=None,
                   help="If set, also generate AI lyrics with this theme")
    r.add_argument("--lyrics-verses", type=int, default=2)
    r.add_argument("--lyrics-bars", type=int, default=16)
    r.add_argument("--lyrics-seed", type=int, default=None)
    r.add_argument("--lyrics-llm", action="store_true",
                   help="Use online LLM if ANTHROPIC_API_KEY is set")
    r.set_defaults(func=cmd_render)

    # analyze
    a = sub.add_parser("analyze", help="Analyze vocal (key, tempo, notes)")
    a.add_argument("vocal")
    a.set_defaults(func=cmd_analyze)

    # autotune
    t = sub.add_parser("autotune", help="Auto-tune only")
    t.add_argument("vocal")
    t.add_argument("--out", required=True)
    t.add_argument("--tune", choices=list_tune_styles(), default="modern")
    t.set_defaults(func=cmd_autotune)

    # lyrics
    l = sub.add_parser("lyrics", help="Generate AI rap lyrics")
    l.add_argument("--theme", default="hustle",
                   choices=["hustle", "love", "struggle", "party", "flex", "reflection"])
    l.add_argument("--genre", choices=list_genres(), default="trap")
    l.add_argument("--verses", type=int, default=2)
    l.add_argument("--bars", type=int, default=16)
    l.add_argument("--rhyme", default="AABB")
    l.add_argument("--no-hook", action="store_true")
    l.add_argument("--no-intro", action="store_true")
    l.add_argument("--out", default=None)
    l.add_argument("--seed", type=int, default=None)
    l.add_argument("--llm", action="store_true",
                   help="Use online LLM if ANTHROPIC_API_KEY is set")
    l.set_defaults(func=cmd_lyrics)

    # demo
    d = sub.add_parser("demo", help="Render a song from a synthesized demo vocal")
    d.add_argument("--out", default="output", help="Output directory")
    d.add_argument("--basename", default="demo", help="Output filename base")
    d.add_argument("--genre", choices=list_genres(), default="trap")
    d.add_argument("--tune", choices=list_tune_styles(), default=None)
    d.add_argument("--tune-strength", type=int, default=80)
    d.add_argument("--energy", type=float, default=None)
    d.add_argument("--warmth", type=float, default=0.4)
    d.add_argument("--duration", type=float, default=15.0)
    d.add_argument("--seed", type=int, default=7)
    d.add_argument("--lyrics-theme", default=None,
                   help="If set, also generate AI lyrics with this theme")
    d.add_argument("--lyrics-verses", type=int, default=2)
    d.add_argument("--lyrics-bars", type=int, default=16)
    d.add_argument("--lyrics-seed", type=int, default=None)
    d.add_argument("--lyrics-llm", action="store_true")
    d.set_defaults(func=cmd_demo)

    # sing — voice-clone + synth full song with new lyrics
    s = sub.add_parser("sing", help="Voice-clone your voice and render a full song with new lyrics")
    s.add_argument("--reference", required=True,
                   help="Path to a vocal clip of YOUR voice (>= 5s, any format)")
    s.add_argument("--lyrics-file", default=None,
                   help="Path to markdown/text lyrics file. If omitted, lyrics are auto-generated.")
    s.add_argument("--out", default="output")
    s.add_argument("--basename", default="my_song")
    s.add_argument("--genre", choices=list_genres(), default="boom_bap")
    s.add_argument("--tune", choices=list_tune_styles(), default=None)
    s.add_argument("--tune-strength", type=int, default=55)
    s.add_argument("--energy", type=float, default=None)
    s.add_argument("--warmth", type=float, default=0.5)
    s.add_argument("--seed", type=int, default=808)
    s.add_argument("--clone-exaggeration", type=float, default=0.55,
                   help="0..1; higher = more expressive cloned vocal")
    s.add_argument("--clone-cfg", type=float, default=0.55,
                   help="0..1; higher = closer match to reference voice")
    s.add_argument("--pause-ms", type=int, default=300,
                   help="Pause inserted between cloned lines")
    s.add_argument("--lyrics-theme", default="reflection",
                   choices=["hustle", "love", "struggle", "party", "flex", "reflection"])
    s.add_argument("--lyrics-verses", type=int, default=2)
    s.add_argument("--lyrics-bars", type=int, default=8)
    s.add_argument("--lyrics-seed", type=int, default=None)
    s.set_defaults(func=cmd_sing)

    # presets
    pr = sub.add_parser("presets", help="List available presets")
    pr.set_defaults(func=cmd_presets)

    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
