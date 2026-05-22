"""Word pools, rhyme groups, and templates for offline rap lyric generation.

Rhyme groups are organized by terminal sound (vowel + final consonant cluster).
Words are common, radio-friendly English. Custom themes are biased toward
their pool but can sample any group for surprise rhymes.

Nothing here is copyrighted text — only generic word lists.
"""
from __future__ import annotations


# Rhyme groups, keyed by an approximate phonetic ending.
RHYME_GROUPS: dict[str, list[str]] = {
    "-AYN":   ["pain", "rain", "brain", "chain", "gain", "lane", "vein", "stain", "flame", "name", "game", "frame"],
    "-OWN":   ["alone", "phone", "zone", "throne", "stone", "shown", "home", "roam", "known", "grown", "bone"],
    "-IGHT":  ["night", "fight", "light", "right", "tight", "flight", "sight", "ignite", "bright", "spite", "white"],
    "-IDE":   ["ride", "side", "pride", "slide", "tide", "glide", "wide", "guide", "decide", "denied", "lied", "stride"],
    "-OW":    ["flow", "low", "slow", "show", "glow", "snow", "row", "blow", "throw", "below", "know", "ago"],
    "-EE":    ["free", "see", "be", "me", "we", "key", "tree", "city", "money", "honey", "sunny", "real-ly"],
    "-AY":    ["away", "today", "stay", "way", "play", "say", "okay", "betray", "pay", "lay", "may", "weigh"],
    "-ART":   ["heart", "start", "part", "smart", "art", "apart", "chart", "depart"],
    "-ACK":   ["back", "track", "stack", "rack", "attack", "black", "jack", "pack", "crack", "lack", "tack"],
    "-AME":   ["fame", "name", "game", "frame", "flame", "blame", "same", "tame", "shame", "claim"],
    "-OCK":   ["lock", "block", "rock", "shock", "clock", "stock", "knock", "talk-and-walk", "dock"],
    "-OOL":   ["cool", "rule", "school", "fool", "tool", "pool", "cruel", "drool", "duel", "fuel"],
    "-INK":   ["think", "link", "sink", "blink", "drink", "ink", "pink", "shrink", "wink"],
    "-AIN":   ["chain", "gain", "stain", "brain", "rain", "pain", "lane", "plane", "main", "Spain"],
    "-OUNCE": ["bounce", "ounce", "pounce", "announce", "renounce"],
    "-AST":   ["fast", "last", "past", "blast", "cast", "vast", "amassed", "outclass"],
    "-IRE":   ["fire", "wire", "higher", "tire", "desire", "buyer", "liar", "spire", "inspire"],
    "-ORN":   ["born", "worn", "morn", "scorn", "torn", "horn", "thorn", "sworn"],
}


# Theme word pools — drop these into lines for topical color
THEMES: dict[str, dict[str, list[str]]] = {
    "hustle": {
        "nouns": ["grind", "block", "hustle", "dream", "wallet", "rent", "team", "vision", "ladder", "moves", "steps", "trade", "mission", "blueprint"],
        "verbs": ["chase", "build", "stack", "climb", "earn", "lift", "ship", "ship", "carry", "secure", "compound", "outwork"],
        "adjectives": ["hungry", "patient", "focused", "ruthless", "quiet", "ready", "sharp", "tired", "young"],
        "places": ["block", "city", "studio", "garage", "rooftop", "trenches"],
    },
    "love": {
        "nouns": ["heart", "lover", "midnight", "promise", "kiss", "touch", "fate", "memory", "voice", "smile", "dream", "letter"],
        "verbs": ["hold", "miss", "wait", "save", "promise", "find", "lose", "remember", "ache", "burn", "trust"],
        "adjectives": ["sweet", "honest", "lonely", "true", "soft", "tender", "lost", "wild", "quiet"],
        "places": ["city", "balcony", "rooftop", "ocean", "freeway", "skyline"],
    },
    "struggle": {
        "nouns": ["pain", "scar", "fight", "demon", "ghost", "shadow", "weight", "doubt", "test", "mirror", "rain", "winter"],
        "verbs": ["bleed", "survive", "rise", "carry", "break", "heal", "fall", "stand", "fight", "pray", "endure"],
        "adjectives": ["broken", "tired", "cold", "lost", "heavy", "silent", "alone", "dark", "fearless"],
        "places": ["bottom", "trenches", "rain", "city", "alley", "shadow"],
    },
    "party": {
        "nouns": ["lights", "bass", "club", "weekend", "crew", "ride", "music", "stage", "speakers", "VIP", "drink", "vibe"],
        "verbs": ["dance", "ride", "shine", "celebrate", "scream", "vibe", "roll", "live", "burn", "shake"],
        "adjectives": ["loud", "wild", "young", "free", "neon", "alive", "hot", "fearless"],
        "places": ["club", "rooftop", "downtown", "Vegas", "city", "skyline"],
    },
    "flex": {
        "nouns": ["chain", "watch", "drip", "ride", "stack", "racks", "team", "name", "shoes", "throne", "crown", "view"],
        "verbs": ["count", "stack", "shine", "ride", "drive", "claim", "earn", "own", "post up", "stunt", "flex"],
        "adjectives": ["iced", "clean", "bold", "fly", "fresh", "rich", "platinum", "loud", "double"],
        "places": ["penthouse", "studio", "stage", "city", "lobby", "skyline"],
    },
    "reflection": {
        "nouns": ["mirror", "yesterday", "memory", "lesson", "regret", "story", "page", "time", "self", "youth", "voice"],
        "verbs": ["remember", "learn", "grow", "wonder", "reflect", "forgive", "change", "look back", "rise"],
        "adjectives": ["older", "wiser", "quiet", "honest", "tired", "grateful", "humbled"],
        "places": ["window", "city", "rain", "freeway", "skyline", "studio"],
    },
}


# Hook templates: short, repeatable, with rhyme placeholders {A}, {B}.
HOOK_TEMPLATES: dict[str, list[list[str]]] = {
    "default": [
        ["I been on my {theme_noun}, I can't slow my {A}",
         "Up before the {place}, watch the {theme_noun} {A}",
         "Tell 'em that I'm comin', they can't stop the {B}",
         "Locked in on the {theme_noun}, ain't no time to {B}"],
        ["Through the {place}, through the {A}",
         "I'ma rise no matter what they {A}",
         "Couldn't break me, couldn't take my {B}",
         "I'ma write my own {B}"],
        ["Light up, light up the {A}",
         "Hold on, hold on to the {A}",
         "We been waitin' for the {B}",
         "Now it's time to make it {B}"],
    ],
}


# Verse line templates - each is filled with theme words and rhymes
VERSE_LINE_TEMPLATES: list[str] = [
    "I been {verb}in' on my {noun}, ain't no time to {A}",
    "Came up from the {place}, with the {noun} on my {A}",
    "They was sleepin' on the kid, now they wishin' they could {A}",
    "Used to ride that {noun}, now I'm {verb}in' on the {A}",
    "Every {adj} {noun} I got, I ain't doin' it for {A}",
    "Tell 'em hold the {noun}, I been buildin' for the {A}",
    "{adj} when I {verb}, I be locked into the {A}",
    "Watch me {verb} through the {place}, with the {noun} on my {A}",
    "Yeah I {verb} for my {noun}, you should never {A}",
    "Born inside the {place}, gotta keep it {A}",
    "Don't be lookin' for my {noun}, you ain't gon' {A}",
    "On my {adj} {noun} energy, can't be {A}",
    "I been {verb}, you been {verb}in' for the {A}",
    "When the {place} get cold, I'ma stay {A}",
    "Real ones know my {noun}, fakes can't {A}",
    "We the {adj} ones {verb}in', leave a {A}",
]


# Intro / outro single-liners
INTRO_LINES = [
    "Yeah, yeah...",
    "VOXFORGE, in the studio...",
    "Aight, listen...",
    "One time for the real ones...",
    "Look...",
]

OUTRO_LINES = [
    "Yeah... that's how it go.",
    "Real talk.",
    "Forever, forever.",
    "On to the next one.",
    "Out.",
]


# Genre style hints — bias word choice / cadence per genre
GENRE_STYLE: dict[str, dict] = {
    "trap":      {"avg_syllables": 12, "themes": ["hustle", "flex", "reflection"]},
    "boom_bap":  {"avg_syllables": 14, "themes": ["reflection", "hustle", "struggle"]},
    "rnb":       {"avg_syllables": 10, "themes": ["love", "reflection"]},
    "drill":     {"avg_syllables": 11, "themes": ["struggle", "flex"]},
    "melodic":   {"avg_syllables": 12, "themes": ["love", "reflection", "hustle"]},
}
