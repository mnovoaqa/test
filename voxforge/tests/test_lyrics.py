"""Lyric generator tests (offline path)."""
from voxforge import lyrics


def test_generate_lyrics_structure():
    song = lyrics.generate_lyrics(theme="hustle", genre="trap",
                                   bars_per_verse=16, n_verses=2, seed=1)
    assert song.title
    labels = [s.label for s in song.sections]
    assert "intro" in labels
    assert "outro" in labels
    assert "verse_1" in labels and "verse_2" in labels
    assert labels.count("hook") == 2


def test_lyrics_bar_counts():
    song = lyrics.generate_lyrics(theme="love", genre="rnb",
                                   bars_per_verse=8, n_verses=1, seed=2)
    verse = [s for s in song.sections if s.label == "verse_1"][0]
    assert len(verse.bars) == 8


def test_syllable_estimation():
    assert lyrics.estimate_syllables("hello world") == 3
    assert lyrics.estimate_syllables("supercalifragilisticexpialidocious") >= 12


def test_all_themes_render():
    for theme in ["hustle", "love", "struggle", "party", "flex", "reflection"]:
        song = lyrics.generate_lyrics(theme=theme, genre="trap", seed=10)
        text = song.render()
        assert len(text) > 100, f"theme {theme} produced too-short output"


def test_rhyme_scheme_applied():
    song = lyrics.generate_lyrics(theme="hustle", genre="trap",
                                   bars_per_verse=4, n_verses=1, seed=42,
                                   rhyme_scheme="AABB")
    verse = [s for s in song.sections if s.label == "verse_1"][0]
    # Bars 0,1 should share a group; 2,3 should share another (possibly different)
    assert verse.bars[0].rhyme_group == verse.bars[1].rhyme_group
    assert verse.bars[2].rhyme_group == verse.bars[3].rhyme_group
