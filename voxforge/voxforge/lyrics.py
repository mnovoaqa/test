"""AI-style rap lyric generation.

Offline by default: template-based generator with rhyme groups,
theme-aware word choice, and structured song output (intro/verse/hook/etc).

Optional online mode: if an API key is present in the environment, can call
out to a hosted LLM (Anthropic by default — set VOXFORGE_LLM_PROVIDER=anthropic
and ANTHROPIC_API_KEY). The online path is best for higher-quality lyrics;
the offline path always works.

Outputs structured `Song` with sections, each section with bars (lines).
Each bar carries an estimated syllable count to help the user pace delivery.
"""
from __future__ import annotations

import os
import random
import re
from dataclasses import dataclass, field
from typing import List, Optional

from .lyric_data import (
    RHYME_GROUPS, THEMES, HOOK_TEMPLATES, VERSE_LINE_TEMPLATES,
    INTRO_LINES, OUTRO_LINES, GENRE_STYLE,
)


# ----- syllable estimation -------------------------------------------------


def _count_syllables(word: str) -> int:
    """Rough heuristic: count vowel groups."""
    w = word.lower().strip("',.!?\"()[]")
    if not w:
        return 0
    vowels = "aeiouy"
    count = 0
    prev = False
    for ch in w:
        is_v = ch in vowels
        if is_v and not prev:
            count += 1
        prev = is_v
    if w.endswith("e") and count > 1:
        count -= 1
    return max(count, 1)


def estimate_syllables(line: str) -> int:
    return sum(_count_syllables(w) for w in line.split())


# ----- data classes --------------------------------------------------------


@dataclass
class Bar:
    text: str
    syllables: int
    rhyme_group: str | None = None

    def __str__(self) -> str:
        return self.text


@dataclass
class Section:
    label: str             # "intro", "verse_1", "hook", "verse_2", "outro"
    bars: List[Bar] = field(default_factory=list)

    def __str__(self) -> str:
        header = f"[{self.label.upper()}]"
        return header + "\n" + "\n".join(b.text for b in self.bars)


@dataclass
class Song:
    title: str
    theme: str
    genre: str
    sections: List[Section] = field(default_factory=list)

    def render(self) -> str:
        out = [f"# {self.title}", f"_genre: {self.genre} • theme: {self.theme}_", ""]
        for s in self.sections:
            out.append(str(s))
            out.append("")
        return "\n".join(out).strip()

    @property
    def total_bars(self) -> int:
        return sum(len(s.bars) for s in self.sections)


# ----- rhyme + line construction -------------------------------------------


def _pick_rhyme_group(rng: random.Random) -> tuple[str, list[str]]:
    keys = list(RHYME_GROUPS.keys())
    k = rng.choice(keys)
    return k, RHYME_GROUPS[k]


def _pick_theme_word(rng: random.Random, theme: str, pos: str) -> str:
    pool = THEMES.get(theme, THEMES["hustle"])
    words = pool.get(pos, ["thing"])
    return rng.choice(words)


def _fill_template(template: str, rng: random.Random, theme: str,
                   rhyme_word_a: str, rhyme_word_b: str | None = None) -> str:
    """Fill a {placeholder} template with theme words and rhyme words."""
    text = template
    text = text.replace("{noun}", _pick_theme_word(rng, theme, "nouns"))
    text = text.replace("{verb}", _pick_theme_word(rng, theme, "verbs"))
    text = text.replace("{adj}", _pick_theme_word(rng, theme, "adjectives"))
    text = text.replace("{place}", _pick_theme_word(rng, theme, "places"))
    text = text.replace("{theme_noun}", _pick_theme_word(rng, theme, "nouns"))
    text = text.replace("{A}", rhyme_word_a)
    if rhyme_word_b:
        text = text.replace("{B}", rhyme_word_b)
    # Cleanup repeated articles, capitalize
    text = re.sub(r"\s+", " ", text).strip()
    if text:
        text = text[0].upper() + text[1:]
    return text


def _generate_verse(rng: random.Random, theme: str, n_bars: int, target_syllables: int,
                    scheme: str = "AABB") -> List[Bar]:
    """Generate a verse with a fixed rhyme scheme."""
    bars: List[Bar] = []
    scheme = scheme.upper()
    # Allocate rhyme groups per unique letter in scheme
    letters = sorted(set(scheme))
    letter_groups: dict[str, tuple[str, list[str]]] = {}
    for letter in letters:
        letter_groups[letter] = _pick_rhyme_group(rng)
    for i in range(n_bars):
        letter = scheme[i % len(scheme)]
        group_name, group_words = letter_groups[letter]
        rhyme_word = rng.choice(group_words)
        template = rng.choice(VERSE_LINE_TEMPLATES)
        text = _fill_template(template, rng, theme, rhyme_word_a=rhyme_word)
        # Truncate or pad to target syllable count (gentle)
        syl = estimate_syllables(text)
        # Try a couple of alternatives if way off
        attempts = 0
        while abs(syl - target_syllables) > 4 and attempts < 5:
            template = rng.choice(VERSE_LINE_TEMPLATES)
            text = _fill_template(template, rng, theme, rhyme_word_a=rhyme_word)
            syl = estimate_syllables(text)
            attempts += 1
        bars.append(Bar(text=text, syllables=syl, rhyme_group=group_name))
    return bars


def _generate_hook(rng: random.Random, theme: str) -> List[Bar]:
    template = rng.choice(HOOK_TEMPLATES["default"])
    group_a, words_a = _pick_rhyme_group(rng)
    group_b, words_b = _pick_rhyme_group(rng)
    while group_b == group_a:
        group_b, words_b = _pick_rhyme_group(rng)
    rhyme_a = rng.choice(words_a)
    rhyme_b = rng.choice(words_b)
    bars: List[Bar] = []
    for line in template:
        text = _fill_template(line, rng, theme, rhyme_word_a=rhyme_a, rhyme_word_b=rhyme_b)
        bars.append(Bar(text=text, syllables=estimate_syllables(text), rhyme_group=group_a))
    return bars


def _generate_title(rng: random.Random, theme: str) -> str:
    pool = THEMES.get(theme, THEMES["hustle"])
    n = rng.choice(pool["nouns"])
    a = rng.choice(pool["adjectives"])
    forms = [f"{a.title()} {n.title()}", f"{n.title()} Season",
             f"All My {n.title()}", f"Forever {n.title()}",
             f"{a.title()} Days", f"On My {n.title()}"]
    return rng.choice(forms)


# ----- main entry point ----------------------------------------------------


def generate_lyrics(
    theme: str = "hustle",
    genre: str = "trap",
    bars_per_verse: int = 16,
    n_verses: int = 2,
    include_hook: bool = True,
    include_intro_outro: bool = True,
    rhyme_scheme: str = "AABB",
    seed: int | None = None,
    use_llm: bool = False,
) -> Song:
    """Generate a structured rap song.

    `use_llm=True` will attempt an online provider call (if API key set);
    falls back silently to offline templates on any error.
    """
    if seed is not None:
        rng = random.Random(seed)
    else:
        rng = random.Random()

    if use_llm:
        try:
            return _llm_lyrics(theme, genre, bars_per_verse, n_verses, include_hook,
                               include_intro_outro, seed)
        except Exception:
            # Silent fall-through to offline
            pass

    style = GENRE_STYLE.get(genre, GENRE_STYLE["trap"])
    target_syl = style["avg_syllables"]

    title = _generate_title(rng, theme)
    sections: list[Section] = []

    if include_intro_outro:
        intro = Section("intro", [Bar(text=rng.choice(INTRO_LINES), syllables=4)])
        sections.append(intro)

    hook_bars = _generate_hook(rng, theme) if include_hook else []

    for v_idx in range(n_verses):
        verse = Section(f"verse_{v_idx + 1}",
                        _generate_verse(rng, theme, bars_per_verse, target_syl, rhyme_scheme))
        sections.append(verse)
        if include_hook:
            sections.append(Section("hook", list(hook_bars)))

    if include_intro_outro:
        outro = Section("outro", [Bar(text=rng.choice(OUTRO_LINES), syllables=4)])
        sections.append(outro)

    return Song(title=title, theme=theme, genre=genre, sections=sections)


# ----- optional LLM path ---------------------------------------------------


def _llm_lyrics(theme: str, genre: str, bars_per_verse: int, n_verses: int,
                include_hook: bool, include_intro_outro: bool,
                seed: int | None) -> Song:
    """Call Anthropic API if available. Otherwise raise."""
    provider = os.environ.get("VOXFORGE_LLM_PROVIDER", "anthropic").lower()
    if provider != "anthropic":
        raise RuntimeError(f"Unknown LLM provider: {provider}")
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")
    try:
        import anthropic  # type: ignore
    except ImportError as e:
        raise RuntimeError("anthropic SDK not installed; run `pip install anthropic`") from e

    client = anthropic.Anthropic(api_key=api_key)
    prompt = _build_llm_prompt(theme, genre, bars_per_verse, n_verses,
                               include_hook, include_intro_outro)
    msg = client.messages.create(
        model=os.environ.get("VOXFORGE_LLM_MODEL", "claude-sonnet-4-6"),
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )
    text = "".join(b.text for b in msg.content if hasattr(b, "text"))
    return _parse_llm_output(text, theme, genre)


def _build_llm_prompt(theme: str, genre: str, bars_per_verse: int, n_verses: int,
                      include_hook: bool, include_intro_outro: bool) -> str:
    parts = [
        f"Write original rap lyrics in the {genre} subgenre about: {theme}.",
        f"Structure: " + (
            ("intro, " if include_intro_outro else "") +
            ", ".join([f"verse {i+1} ({bars_per_verse} bars)" +
                       (" + hook" if include_hook else "") for i in range(n_verses)]) +
            (", outro." if include_intro_outro else ".")
        ),
        "Rules: AABB end-rhyme scheme by default. Original imagery, no copyrighted lyrics, "
        "no real names of artists, no slurs. Use radio-friendly language.",
        "Output format strictly as:",
        "TITLE: <title>",
        "[INTRO]",
        "<lines>",
        "[VERSE 1]",
        "<lines>",
        "[HOOK]",
        "<lines>",
        "... etc.",
    ]
    return "\n".join(parts)


def _parse_llm_output(text: str, theme: str, genre: str) -> Song:
    title = "Untitled"
    sections: list[Section] = []
    current: Section | None = None
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        m_title = re.match(r"^TITLE\s*:\s*(.+)$", line, flags=re.IGNORECASE)
        if m_title:
            title = m_title.group(1).strip()
            continue
        m_header = re.match(r"^\[(.+?)\]$", line)
        if m_header:
            if current is not None:
                sections.append(current)
            label = m_header.group(1).strip().lower().replace(" ", "_")
            current = Section(label, [])
            continue
        if current is None:
            current = Section("verse_1", [])
        current.bars.append(Bar(text=line, syllables=estimate_syllables(line)))
    if current is not None:
        sections.append(current)
    if not sections:
        # Fall back to offline
        return generate_lyrics(theme=theme, genre=genre)
    return Song(title=title, theme=theme, genre=genre, sections=sections)
