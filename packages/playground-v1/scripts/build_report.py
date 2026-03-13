#!/usr/bin/env python3

from __future__ import annotations

import bisect
import csv
import json
import math
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean, median
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "output"
ARCHIVE_DIR = ROOT / "archive"


FILLERS = [
    "um",
    "uh",
    "like",
    "you know",
    "basically",
    "actually",
    "literally",
    "sort of",
    "kind of",
    "i mean",
    "right",
    "okay",
    "well",
]

HEDGES = [
    "maybe",
    "probably",
    "perhaps",
    "i think",
    "i guess",
    "i feel",
    "i don't know",
    "it seems",
    "seems like",
    "in some way",
    "somehow",
    "potentially",
    "possibly",
    "relatively",
    "kind of",
    "sort of",
]

VAGUE_WORDS = [
    "thing",
    "things",
    "stuff",
    "something",
    "anything",
    "everything",
    "nothing",
    "just",
    "really",
    "very",
    "quite",
    "pretty",
    "somehow",
    "somewhat",
]

ABSOLUTES = [
    "always",
    "never",
    "everyone",
    "no one",
    "nobody",
    "everything",
    "nothing",
    "completely",
    "totally",
    "absolutely",
    "everywhere",
    "all the time",
]

INTENSITY = [
    "crazy",
    "insane",
    "wild",
    "dangerous",
    "horrendous",
    "terrifying",
    "scary",
    "fucked",
    "hate",
    "abuse",
    "invisible",
    "disaster",
    "awful",
    "brutal",
    "massive",
    "huge",
]

SELF_ATTACK = [
    "inferior",
    "weak",
    "stupid",
    "pathetic",
    "embarrassing",
    "ashamed",
    "failure",
    "flawed",
    "broken",
    "wrong",
    "not enough",
    "robot",
]

FEAR_WORDS = [
    "afraid",
    "fear",
    "scared",
    "anxious",
    "nervous",
    "worry",
    "worried",
    "dread",
]

APOLOGY = [
    "sorry",
    "i messed up",
    "i fucked up",
    "my fault",
    "i was wrong",
]

AUDIENCE_WORDS = [
    "customer",
    "customers",
    "investor",
    "investors",
    "cofounder",
    "co-founder",
    "friend",
    "friends",
    "team",
    "audience",
    "listener",
    "listeners",
    "mentor",
    "mentors",
    "user",
    "users",
    "people",
]

REFLECTION_WORDS = [
    "realize",
    "realized",
    "realizing",
    "think",
    "thinking",
    "thought",
    "reflect",
    "reflection",
    "understand",
    "wonder",
    "why",
    "how",
    "meaning",
    "learned",
    "learn",
    "notice",
    "noticed",
]

ACTION_WORDS = [
    "plan",
    "planning",
    "build",
    "building",
    "write",
    "writing",
    "ship",
    "shipping",
    "apply",
    "practice",
    "improve",
    "improving",
    "learn",
    "fix",
    "execute",
    "record",
    "post",
    "reach out",
    "focus",
    "train",
    "do",
    "doing",
]

STRUCTURE_MARKERS = [
    "first",
    "second",
    "third",
    "one thing",
    "the point is",
    "for example",
    "for instance",
    "because",
    "which means",
    "in other words",
    "the problem is",
    "the solution is",
    "so that",
]

ANCHOR_MARKERS = [
    "today",
    "tomorrow",
    "yesterday",
    "morning",
    "night",
    "week",
    "month",
    "year",
    "minute",
    "hour",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
    "for example",
    "when",
    "after",
    "before",
    "during",
    "pm",
    "am",
    "percent",
]

NEGATIVE_OTHER_PHRASES = [
    "they don't",
    "they didnt",
    "they rejected",
    "they ignore",
    "they abused",
    "they automatically reject",
    "people don't",
    "people think",
    "world doesn't",
    "team doesn't",
    "they will continue to abuse",
]

STOPWORDS = {
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "is",
    "was",
    "are",
    "were",
    "be",
    "been",
    "being",
    "it",
    "that",
    "this",
    "these",
    "those",
    "as",
    "from",
    "by",
    "if",
    "then",
    "there",
    "here",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "can",
    "could",
    "should",
    "would",
    "will",
    "just",
    "really",
    "very",
    "like",
    "into",
    "about",
    "than",
    "also",
    "what",
    "when",
    "where",
    "why",
    "how",
    "because",
    "while",
    "they",
    "them",
    "their",
    "you",
    "your",
    "i",
    "me",
    "my",
    "we",
    "our",
    "so",
    "right",
    "okay",
    "well",
}

THEMES = {
    "communication": [
        "communication",
        "speak",
        "speech",
        "articulate",
        "conversation",
        "voice",
        "pitch",
        "listener",
    ],
    "startup": [
        "startup",
        "founder",
        "investor",
        "customer",
        "product",
        "company",
        "cofounder",
        "team",
        "market",
    ],
    "productivity": [
        "productivity",
        "focus",
        "plan",
        "work",
        "career",
        "job",
        "task",
        "time",
    ],
    "identity": [
        "identity",
        "confidence",
        "worth",
        "purpose",
        "fear",
        "shame",
        "anxiety",
        "self",
    ],
    "relationships": [
        "relationship",
        "women",
        "woman",
        "marriage",
        "friend",
        "friends",
        "respect",
        "team",
    ],
    "health": [
        "sleep",
        "gym",
        "workout",
        "ramadan",
        "health",
        "body",
        "walk",
    ],
    "learning": [
        "learn",
        "reading",
        "book",
        "article",
        "insight",
        "lesson",
    ],
}

RESEARCH_REFERENCES = [
    {
        "label": "Disfluencies and perceived speaker effectiveness",
        "url": "https://pubmed.ncbi.nlm.nih.gov/38819033/",
        "note": "Used to justify tracking filler density and repair markers as audience-facing costs.",
    },
    {
        "label": "Pronoun use as a self-focus marker in spoken language",
        "url": "https://pubmed.ncbi.nlm.nih.gov/26818665/",
        "note": "Used to justify the self-focus and voice-purity lens.",
    },
    {
        "label": "Hedges in unscripted collaboration",
        "url": "https://pubmed.ncbi.nlm.nih.gov/36757986/",
        "note": "Used to justify uncertainty and hedge tracking instead of treating all soft language as noise.",
    },
    {
        "label": "Cognitive distortion signals in language",
        "url": "https://pubmed.ncbi.nlm.nih.gov/34301899/",
        "note": "Used to justify overgeneralization and absolutist language detection.",
    },
]


SIGNAL_DEFINITIONS = [
    {
        "id": "clarity_drag",
        "label": "Clarity drag",
        "description": "The point is often assembled in real time, so the listener hears the thinking process before the conclusion.",
        "components": [
            ("filler_density", 1.0, False),
            ("repair_density", 1.2, False),
            ("vague_density", 0.9, False),
            ("repetition_density", 0.8, False),
            ("long_sentence_rate", 0.7, False),
        ],
    },
    {
        "id": "confidence_leakage",
        "label": "Confidence leakage",
        "description": "Ideas are often softened by hedges, fear language, apology language, or self-critique before they fully land.",
        "components": [
            ("hedge_density", 1.1, False),
            ("fear_density", 0.8, False),
            ("self_attack_density", 0.9, False),
            ("apology_density", 0.9, False),
            ("question_density", 0.5, False),
        ],
    },
    {
        "id": "listener_drift",
        "label": "Listener drift",
        "description": "The transcript can remain inside your internal world longer than it translates the idea into audience value and concrete anchors.",
        "components": [
            ("self_focus_ratio", 1.0, False),
            ("audience_density", 1.0, True),
            ("anchor_density", 0.8, True),
            ("structure_density", 0.6, True),
            ("reflection_density", 0.5, False),
        ],
    },
    {
        "id": "emotional_amplification",
        "label": "Emotional amplification",
        "description": "When emotional load rises, the framing shifts toward sweeping judgments, extremes, and negative-other narratives.",
        "components": [
            ("absolute_density", 1.0, False),
            ("intensity_density", 0.9, False),
            ("blame_density", 0.8, False),
            ("question_density", 0.5, False),
            ("self_attack_density", 0.5, False),
        ],
    },
]

STRENGTH_DEFINITIONS = [
    {
        "id": "self_awareness",
        "label": "Self-awareness",
        "description": "You surface internal conflict quickly and keep searching for the mechanism underneath it.",
        "components": [
            ("reflection_density", 1.1, False),
            ("structure_density", 0.6, False),
            ("anchor_density", 0.4, False),
        ],
    },
    {
        "id": "bias_to_action",
        "label": "Bias to action",
        "description": "Even when frustrated, the transcripts still move toward plans, experiments, and next steps.",
        "components": [
            ("action_density", 1.1, False),
            ("structure_density", 0.5, False),
            ("anchor_density", 0.4, False),
        ],
    },
]

PRACTICE_LIBRARY = {
    "clarity_drag": {
        "title": "Pause-Build-Land",
        "when": "Use this before any high-stakes answer or pitch response.",
        "protocol": [
            "Pause for one beat before speaking.",
            "State the claim in one clean sentence of 8-14 words.",
            "Add one anchor: example, number, or moment in time.",
            "Stop after the landing sentence instead of reopening the loop.",
        ],
    },
    "confidence_leakage": {
        "title": "No-Softener Opening",
        "when": "Use this when you notice 'maybe', 'I think', or apology language in the first 20 seconds.",
        "protocol": [
            "Ban hedge phrases from the first sentence.",
            "Replace 'I think' with a direct claim.",
            "If uncertainty is real, name it once at the end, not throughout the answer.",
            "Review recordings and count how often authority is diluted before the point lands.",
        ],
    },
    "listener_drift": {
        "title": "For-Them Translation",
        "when": "Use this when the transcript is rich in introspection but thin on audience value.",
        "protocol": [
            "After every idea, add one line starting with 'For them, this means...'",
            "Name the audience explicitly: investor, teammate, friend, customer.",
            "Force one concrete example before moving to the next abstract point.",
            "End with the decision, ask, or outcome you want from the listener.",
        ],
    },
    "emotional_amplification": {
        "title": "Fact-Story-Request Split",
        "when": "Use this after frustrating meetings or when your wording becomes absolute.",
        "protocol": [
            "Write the raw reaction exactly as spoken.",
            "Split it into three columns: facts, interpretation, request.",
            "Delete universal words like 'always', 'never', 'everyone' unless you can prove them.",
            "Re-speak the moment using only the facts and the request.",
        ],
    },
}

ARCHIVED_EXPERIMENTS = [
    {
        "id": "naive_sentiment",
        "name": "Naive sentiment average",
        "reason": "Long reflective notes often mix frustration, hope, planning, and curiosity in the same entry, so a single polarity score hid the actual communication problem.",
        "archiveFile": "archive/naive_sentiment.md",
    },
    {
        "id": "title_only_clustering",
        "name": "Title-only clustering",
        "reason": "The exported titles are already compressed and cleaner than the spoken transcript, so title-only grouping missed the hesitations, repairs, and framing flaws.",
        "archiveFile": "archive/title_only_clustering.md",
    },
    {
        "id": "raw_frequency_only",
        "name": "Raw word-frequency ranking",
        "reason": "Common words like 'that', 'like', and 'just' surfaced quickly, but without contextual framing they did not explain what was breaking listener trust.",
        "archiveFile": "archive/raw_frequency_only.md",
    },
]


WORD_RE = re.compile(r"[A-Za-z']+")
SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+|\n+")
STUTTER_RE = re.compile(r"\b[a-z]{1,5}-\s*[a-z]", re.IGNORECASE)


def compile_phrase_patterns(phrases: Iterable[str]) -> dict[str, re.Pattern[str]]:
    patterns: dict[str, re.Pattern[str]] = {}
    for phrase in phrases:
        escaped = r"\s+".join(re.escape(part) for part in phrase.split())
        patterns[phrase] = re.compile(rf"(?<![a-z]){escaped}(?![a-z])", re.IGNORECASE)
    return patterns


FILLER_PATTERNS = compile_phrase_patterns(FILLERS)
HEDGE_PATTERNS = compile_phrase_patterns(HEDGES)
VAGUE_PATTERNS = compile_phrase_patterns(VAGUE_WORDS)
ABSOLUTE_PATTERNS = compile_phrase_patterns(ABSOLUTES)
INTENSITY_PATTERNS = compile_phrase_patterns(INTENSITY)
SELF_ATTACK_PATTERNS = compile_phrase_patterns(SELF_ATTACK)
FEAR_PATTERNS = compile_phrase_patterns(FEAR_WORDS)
APOLOGY_PATTERNS = compile_phrase_patterns(APOLOGY)
AUDIENCE_PATTERNS = compile_phrase_patterns(AUDIENCE_WORDS)
REFLECTION_PATTERNS = compile_phrase_patterns(REFLECTION_WORDS)
ACTION_PATTERNS = compile_phrase_patterns(ACTION_WORDS)
STRUCTURE_PATTERNS = compile_phrase_patterns(STRUCTURE_MARKERS)
ANCHOR_PATTERNS = compile_phrase_patterns(ANCHOR_MARKERS)
NEGATIVE_OTHER_PATTERNS = compile_phrase_patterns(NEGATIVE_OTHER_PHRASES)


@dataclass
class Note:
    raw: dict[str, str]
    created_at: datetime
    text: str
    normalized_text: str
    words: list[str]
    sentences: list[str]
    themes: list[str]


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def safe_density(count: float, word_count: int) -> float:
    if word_count <= 0:
        return 0.0
    return count / word_count * 1000.0


def count_patterns(text: str, patterns: dict[str, re.Pattern[str]]) -> tuple[int, Counter[str]]:
    hits: Counter[str] = Counter()
    total = 0
    for label, pattern in patterns.items():
        count = len(pattern.findall(text))
        if count:
            hits[label] = count
            total += count
    return total, hits


def tokenize(text: str) -> list[str]:
    return WORD_RE.findall(text.lower())


def split_sentences(text: str) -> list[str]:
    return [segment.strip() for segment in SENTENCE_SPLIT_RE.split(text) if segment.strip()]


def discover_latest_csv() -> Path:
    candidates = sorted(ROOT.glob("Letterly-export-*.csv"))
    if not candidates:
        raise FileNotFoundError("No Letterly export found inside packages/playground")
    return max(candidates, key=lambda path: path.stat().st_mtime)


def parse_datetime(row: dict[str, str]) -> datetime:
    timestamp_ms = row.get("created_timestamp_ms", "").strip()
    if timestamp_ms:
        return datetime.fromtimestamp(int(timestamp_ms) / 1000.0, tz=timezone.utc)
    created_at = row.get("created_at", "").strip()
    return datetime.strptime(created_at, "%d.%m.%Y %H:%M:%S").replace(tzinfo=timezone.utc)


def assign_themes(title: str, text: str) -> list[str]:
    haystack = f"{title} {text[:800]}".lower()
    hits: list[tuple[str, int]] = []
    for theme, keywords in THEMES.items():
        score = sum(1 for keyword in keywords if keyword in haystack)
        if score:
            hits.append((theme, score))
    hits.sort(key=lambda item: item[1], reverse=True)
    return [theme for theme, _ in hits[:3]]


def load_notes(csv_path: Path) -> list[Note]:
    rows: list[Note] = []
    with csv_path.open(encoding="utf-8-sig", newline="") as handle:
        for raw in csv.DictReader(handle):
            text = raw.get("text", "").strip()
            if not text:
                continue
            normalized_text = " ".join(text.split())
            title = raw.get("title", "").strip()
            rows.append(
                Note(
                    raw=raw,
                    created_at=parse_datetime(raw),
                    text=text,
                    normalized_text=normalized_text,
                    words=tokenize(text),
                    sentences=split_sentences(text),
                    themes=assign_themes(title, text),
                )
            )
    return rows


def first_sentence(text: str) -> str:
    sentences = split_sentences(text)
    if not sentences:
        return text[:220].strip()
    return sentences[0][:220].strip()


def fallback_title(text: str) -> str:
    candidate = re.sub(r"\s+", " ", first_sentence(text)).strip(" -")
    return candidate[:60].strip()


def percentile_rank(sorted_values: list[float], value: float) -> float:
    if not sorted_values:
        return 50.0
    if len(sorted_values) == 1:
        return 50.0
    idx = bisect.bisect_right(sorted_values, value) - 1
    idx = max(0, idx)
    return idx / (len(sorted_values) - 1) * 100.0


def quantile(sorted_values: list[float], q: float) -> float:
    if not sorted_values:
        return 0.0
    if len(sorted_values) == 1:
        return sorted_values[0]
    index = clamp(q, 0.0, 1.0) * (len(sorted_values) - 1)
    lower = math.floor(index)
    upper = math.ceil(index)
    if lower == upper:
        return sorted_values[int(index)]
    fraction = index - lower
    return sorted_values[lower] + (sorted_values[upper] - sorted_values[lower]) * fraction


def build_note_report(note: Note) -> dict:
    text_lower = note.text.lower()
    word_count = len(note.words)
    sentence_count = len(note.sentences)
    if word_count == 0:
        return {}
    title = (
        note.raw.get("title", "").strip()
        or fallback_title(note.text)
        or f"Untitled note {note.raw.get('id', '?')}"
    )

    filler_count, filler_hits = count_patterns(text_lower, FILLER_PATTERNS)
    hedge_count, hedge_hits = count_patterns(text_lower, HEDGE_PATTERNS)
    vague_count, vague_hits = count_patterns(text_lower, VAGUE_PATTERNS)
    absolute_count, absolute_hits = count_patterns(text_lower, ABSOLUTE_PATTERNS)
    intensity_count, intensity_hits = count_patterns(text_lower, INTENSITY_PATTERNS)
    self_attack_count, self_attack_hits = count_patterns(text_lower, SELF_ATTACK_PATTERNS)
    fear_count, fear_hits = count_patterns(text_lower, FEAR_PATTERNS)
    apology_count, apology_hits = count_patterns(text_lower, APOLOGY_PATTERNS)
    audience_count, audience_hits = count_patterns(text_lower, AUDIENCE_PATTERNS)
    reflection_count, reflection_hits = count_patterns(text_lower, REFLECTION_PATTERNS)
    action_count, action_hits = count_patterns(text_lower, ACTION_PATTERNS)
    structure_count, structure_hits = count_patterns(text_lower, STRUCTURE_PATTERNS)
    anchor_count, anchor_hits = count_patterns(text_lower, ANCHOR_PATTERNS)
    blame_count, blame_hits = count_patterns(text_lower, NEGATIVE_OTHER_PATTERNS)

    digit_count = sum(character.isdigit() for character in note.text)
    anchor_count += digit_count

    ellipsis_count = note.text.count("...")
    dash_repair_count = note.text.count("--")
    stutter_count = len(STUTTER_RE.findall(note.text))
    repair_count = ellipsis_count + dash_repair_count + stutter_count

    first_person = sum(
        1 for word in note.words if word in {"i", "me", "my", "myself", "i'm", "i've", "i'll"}
    )
    second_person = sum(1 for word in note.words if word in {"you", "your", "yourself"})
    third_person = sum(
        1 for word in note.words if word in {"he", "she", "they", "them", "their", "people"}
    )
    greeting_markers = sum(
        text_lower.count(phrase)
        for phrase in ["thank you", "welcome", "good afternoon", "good luck", "alex", "hello"]
    )
    self_focus_ratio = (first_person + 1) / (second_person + third_person + 1)

    repeated_word_counter = Counter(
        word for word in note.words if len(word) >= 4 and word not in STOPWORDS
    )
    repeated_words = [
        {"word": word, "count": count}
        for word, count in repeated_word_counter.most_common(8)
        if count >= 3
    ]
    repetition_burden = sum(max(0, item["count"] - 2) for item in repeated_words)

    bigrams = Counter(
        " ".join(pair)
        for pair in zip(note.words, note.words[1:])
        if pair[0] not in STOPWORDS or pair[1] not in STOPWORDS
    )
    repeated_phrases = [
        {"phrase": phrase, "count": count}
        for phrase, count in bigrams.most_common(5)
        if count >= 2
    ]

    long_sentences = sum(
        1 for sentence in note.sentences if len(WORD_RE.findall(sentence)) >= 35
    )

    voice_purity_score = clamp(
        (min(self_focus_ratio, 2.0) / 2.0) * 70.0 + 30.0 - greeting_markers * 5.0,
        0.0,
        100.0,
    )
    voice_label = "self" if self_focus_ratio > 0.8 and greeting_markers < 4 else "mixed"

    top_words = [
        {"word": word, "count": count}
        for word, count in repeated_word_counter.most_common(5)
        if count >= 2
    ]

    metrics = {
        "word_count": word_count,
        "sentence_count": sentence_count,
        "avg_sentence_words": round(word_count / max(sentence_count, 1), 2),
        "question_count": note.text.count("?"),
        "question_density": round(safe_density(note.text.count("?"), word_count), 3),
        "filler_count": filler_count,
        "filler_density": round(safe_density(filler_count, word_count), 3),
        "hedge_count": hedge_count,
        "hedge_density": round(safe_density(hedge_count, word_count), 3),
        "vague_count": vague_count,
        "vague_density": round(safe_density(vague_count, word_count), 3),
        "absolute_count": absolute_count,
        "absolute_density": round(safe_density(absolute_count, word_count), 3),
        "intensity_count": intensity_count,
        "intensity_density": round(safe_density(intensity_count, word_count), 3),
        "self_attack_count": self_attack_count,
        "self_attack_density": round(safe_density(self_attack_count, word_count), 3),
        "fear_count": fear_count,
        "fear_density": round(safe_density(fear_count, word_count), 3),
        "apology_count": apology_count,
        "apology_density": round(safe_density(apology_count, word_count), 3),
        "audience_count": audience_count,
        "audience_density": round(safe_density(audience_count, word_count), 3),
        "reflection_count": reflection_count,
        "reflection_density": round(safe_density(reflection_count, word_count), 3),
        "action_count": action_count,
        "action_density": round(safe_density(action_count, word_count), 3),
        "structure_count": structure_count,
        "structure_density": round(safe_density(structure_count, word_count), 3),
        "anchor_count": anchor_count,
        "anchor_density": round(safe_density(anchor_count, word_count), 3),
        "blame_count": blame_count,
        "blame_density": round(safe_density(blame_count, word_count), 3),
        "repair_count": repair_count,
        "repair_density": round(safe_density(repair_count, word_count), 3),
        "repetition_burden": repetition_burden,
        "repetition_density": round(safe_density(repetition_burden, word_count), 3),
        "long_sentence_count": long_sentences,
        "long_sentence_rate": round(long_sentences / max(sentence_count, 1) * 100.0, 3),
        "self_focus_ratio": round(self_focus_ratio, 3),
        "voice_purity_score": round(voice_purity_score, 1),
    }

    return {
        "id": note.raw["id"],
        "title": title,
        "createdAt": note.created_at.date().isoformat(),
        "createdAtLabel": note.raw.get("created_at", ""),
        "lang": note.raw.get("lang", ""),
        "tags": [tag for tag in note.raw.get("tags", "").split(",") if tag.strip()],
        "themes": note.themes,
        "voice": {"label": voice_label, "score": round(voice_purity_score, 1)},
        "metrics": metrics,
        "hotspots": {
            "fillers": filler_hits.most_common(5),
            "hedges": hedge_hits.most_common(5),
            "vague": vague_hits.most_common(5),
            "absolutes": absolute_hits.most_common(5),
            "intensity": intensity_hits.most_common(5),
            "selfAttack": self_attack_hits.most_common(5),
            "fear": fear_hits.most_common(5),
            "apology": apology_hits.most_common(5),
            "audience": audience_hits.most_common(5),
            "reflection": reflection_hits.most_common(5),
            "action": action_hits.most_common(5),
            "structure": structure_hits.most_common(5),
            "anchors": anchor_hits.most_common(5),
            "negativeOther": blame_hits.most_common(5),
        },
        "repeatedWords": repeated_words,
        "repeatedPhrases": repeated_phrases,
        "topWords": top_words,
        "excerpt": note.normalized_text[:360].strip(),
        "openingLine": first_sentence(note.text),
    }


def compute_signal_score(note: dict, baselines: dict[str, list[float]], definition: dict) -> int:
    weighted_total = 0.0
    weight_sum = 0.0
    for metric_key, weight, invert in definition["components"]:
        baseline = baselines.get(metric_key, [])
        value = float(note["metrics"][metric_key])
        percentile = percentile_rank(baseline, value)
        if invert:
            percentile = 100.0 - percentile
        weighted_total += percentile * weight
        weight_sum += weight
    if weight_sum == 0:
        return 0
    return int(round(clamp(weighted_total / weight_sum, 0.0, 100.0)))


def signal_level(score: int) -> str:
    if score >= 80:
        return "acute"
    if score >= 65:
        return "high"
    if score >= 45:
        return "medium"
    return "low"


def build_listener_simulations(note: dict) -> list[dict[str, str]]:
    top_signal = note["signals"][0]["id"]
    themes = set(note["themes"])
    personas = ["coach", "general listener"]
    if "startup" in themes:
        personas = ["investor", "teammate"]
    elif "relationships" in themes:
        personas = ["friend", "partner"]
    elif "communication" in themes:
        personas = ["coach", "audience"]

    message_by_signal = {
        "clarity_drag": "I hear intelligence and urgency, but I have to work too hard to keep the thread because the sentence is still being built mid-flight.",
        "confidence_leakage": "The idea may be strong, but the wording keeps partially withdrawing from the claim before it lands.",
        "listener_drift": "I understand your inner state, but I still have to infer why this matters to me and what I am supposed to do with it.",
        "emotional_amplification": "The frustration feels real, but the framing jumps to conclusions faster than the evidence does.",
    }
    return [{"persona": persona, "takeaway": message_by_signal[top_signal]} for persona in personas]


def coaching_moves_for_note(note: dict) -> list[dict[str, str]]:
    moves: list[dict[str, str]] = []
    for signal in note["signals"][:2]:
        practice = PRACTICE_LIBRARY[signal["id"]]
        moves.append({"title": practice["title"], "focus": signal["label"], "when": practice["when"]})
    return moves


def dominant_finding_for_note(note: dict) -> str:
    top_signal = note["signals"][0]
    if top_signal["id"] == "clarity_drag":
        return (
            f"This note shows heavy live self-editing: {note['metrics']['repair_count']} repair markers and "
            f"{note['metrics']['filler_count']} filler hits keep the idea from landing cleanly."
        )
    if top_signal["id"] == "confidence_leakage":
        return (
            f"The content is there, but authority leaks out through {note['metrics']['hedge_count']} hedges, "
            f"{note['metrics']['fear_count']} fear markers, and self-softening language."
        )
    if top_signal["id"] == "listener_drift":
        return (
            "This note spends more energy describing your internal loop than translating the point into audience value, "
            "examples, or an explicit ask."
        )
    return (
        "The note carries emotional truth, but the wording leans toward absolutes and verdicts, which can make the claim feel less precise."
    )


def average_signal(notes: list[dict], signal_id: str) -> float:
    values = [note["signalMap"][signal_id] for note in notes]
    return round(mean(values), 1) if values else 0.0


def summarize_signal(signal_id: str, notes: list[dict]) -> dict:
    definition = next(item for item in SIGNAL_DEFINITIONS if item["id"] == signal_id)
    values = [note["signalMap"][signal_id] for note in notes]
    affected = [note for note in notes if note["signalMap"][signal_id] >= 65]
    examples = sorted(notes, key=lambda note: note["signalMap"][signal_id], reverse=True)[:3]
    summary = {
        "id": signal_id,
        "label": definition["label"],
        "description": definition["description"],
        "average": round(mean(values), 1) if values else 0.0,
        "median": round(median(values), 1) if values else 0.0,
        "p90": round(quantile(sorted(values), 0.9), 1) if values else 0.0,
        "affectedNotes": len(affected),
        "examples": [
            {
                "id": note["id"],
                "title": note["title"],
                "score": note["signalMap"][signal_id],
            }
            for note in examples
        ],
    }
    return summary


def build_markdown_report(report: dict) -> str:
    lines: list[str] = []
    lines.append("# Communication Forensics Report")
    lines.append("")
    lines.append(f"Generated: {report['generatedAt']}")
    lines.append("")
    lines.append("## Corpus")
    lines.append(f"- Notes: {report['source']['noteCount']}")
    lines.append(f"- Self voice notes: {report['source']['selfVoiceCount']}")
    lines.append(f"- Mixed voice notes: {report['source']['mixedVoiceCount']}")
    lines.append(f"- Average words per note: {report['source']['averageWords']}")
    lines.append(f"- Date range: {report['source']['dateRange']['start']} to {report['source']['dateRange']['end']}")
    lines.append("")
    lines.append("## Strongest Communication Drags")
    for finding in report["overview"]["topFindings"]:
        lines.append(f"### {finding['label']} ({finding['average']})")
        lines.append(finding["summary"])
        lines.append(f"- Affected self-voice notes: {finding['affectedNotes']}")
        lines.append(
            "- Example notes: "
            + ", ".join(example["title"] for example in finding["examples"])
        )
        lines.append("")
    lines.append("## Strengths")
    for strength in report["overview"]["strengths"]:
        lines.append(f"- **{strength['label']}**: {strength['summary']}")
    lines.append("")
    lines.append("## Practice Systems")
    for practice in report["practiceSystems"]:
        lines.append(f"### {practice['title']}")
        lines.append(practice["when"])
        for step in practice["protocol"]:
            lines.append(f"- {step}")
        lines.append("")
    lines.append("## Archived Experiments")
    for experiment in report["experiments"]["archived"]:
        lines.append(f"- **{experiment['name']}**: {experiment['reason']}")
    lines.append("")
    return "\n".join(lines)


def active_experiments(report: dict) -> list[dict]:
    return [
        {
            "id": "voice_purity_filter",
            "name": "Voice purity filter",
            "why": "Separates your own introspection from imported speech or mixed transcripts before scoring.",
            "impact": f"Flagged {report['source']['mixedVoiceCount']} notes as mixed so they do not distort the personal baseline.",
        },
        {
            "id": "relative_percentile_scoring",
            "name": "Relative percentile scoring",
            "why": "Scores each note against your own corpus instead of a generic speaking benchmark.",
            "impact": "Makes the playground sensitive to your recurring personal patterns rather than public-speaking averages from elsewhere.",
        },
        {
            "id": "listener_drift_composite",
            "name": "Listener-drift composite",
            "why": "Measures when the transcript stays inside your head longer than it serves a listener.",
            "impact": "Combines self-focus, audience scarcity, low anchoring, and weak structure into one friction signal.",
        },
        {
            "id": "repair_stack",
            "name": "Repair stack",
            "why": "Treats ellipses, stutter fragments, and mid-sentence reroutes as a separate clarity problem instead of lumping them under filler words.",
            "impact": "Catches the 'thinking on stage' pattern that plain filler counts miss.",
        },
    ]


def main() -> None:
    csv_path = discover_latest_csv()
    notes = load_notes(csv_path)
    note_reports = [build_note_report(note) for note in notes]
    note_reports = [note for note in note_reports if note]

    self_notes = [note for note in note_reports if note["voice"]["label"] == "self"]
    baseline_source = self_notes or note_reports

    baselines: dict[str, list[float]] = defaultdict(list)
    metric_keys = baseline_source[0]["metrics"].keys() if baseline_source else []
    for metric_key in metric_keys:
        baselines[metric_key] = sorted(float(note["metrics"][metric_key]) for note in baseline_source)

    for note in note_reports:
        signals = []
        signal_map: dict[str, int] = {}
        for definition in SIGNAL_DEFINITIONS:
            score = compute_signal_score(note, baselines, definition)
            signal_map[definition["id"]] = score
            signals.append(
                {
                    "id": definition["id"],
                    "label": definition["label"],
                    "score": score,
                    "level": signal_level(score),
                }
            )
        strengths = []
        strength_map: dict[str, int] = {}
        for definition in STRENGTH_DEFINITIONS:
            score = compute_signal_score(note, baselines, definition)
            strength_map[definition["id"]] = score
            strengths.append(
                {
                    "id": definition["id"],
                    "label": definition["label"],
                    "score": score,
                    "level": signal_level(score),
                }
            )

        signals.sort(key=lambda item: item["score"], reverse=True)
        strengths.sort(key=lambda item: item["score"], reverse=True)
        note["signals"] = signals
        note["signalMap"] = signal_map
        note["strengths"] = strengths
        note["strengthMap"] = strength_map
        note["dominantFinding"] = dominant_finding_for_note(note)
        note["listenerSimulations"] = build_listener_simulations(note)
        note["coachingMoves"] = coaching_moves_for_note(note)

    sorted_by_date = sorted(note_reports, key=lambda item: item["createdAt"])
    timeline_buckets: dict[str, list[dict]] = defaultdict(list)
    for note in self_notes:
        bucket = datetime.fromisoformat(note["createdAt"]).strftime("%Y-W%W")
        timeline_buckets[bucket].append(note)

    timeline = []
    for bucket, bucket_notes in sorted(timeline_buckets.items()):
        timeline.append(
            {
                "bucket": bucket,
                "noteCount": len(bucket_notes),
                "clarityDrag": average_signal(bucket_notes, "clarity_drag"),
                "confidenceLeakage": average_signal(bucket_notes, "confidence_leakage"),
                "listenerDrift": average_signal(bucket_notes, "listener_drift"),
                "emotionalAmplification": average_signal(bucket_notes, "emotional_amplification"),
            }
        )

    composite_summaries = [
        summarize_signal(definition["id"], self_notes or note_reports)
        for definition in SIGNAL_DEFINITIONS
    ]
    composite_summaries.sort(key=lambda item: item["average"], reverse=True)

    theme_counts = Counter(theme for note in note_reports for theme in note["themes"])
    lexical_hotspots = {
        "fillers": Counter(
            label
            for note in note_reports
            for label, count in note["hotspots"]["fillers"]
            for _ in range(count)
        ).most_common(5),
        "hedges": Counter(
            label
            for note in note_reports
            for label, count in note["hotspots"]["hedges"]
            for _ in range(count)
        ).most_common(5),
        "vague": Counter(
            label
            for note in note_reports
            for label, count in note["hotspots"]["vague"]
            for _ in range(count)
        ).most_common(5),
    }

    top_findings = []
    for summary in composite_summaries:
        examples = summary["examples"]
        top_findings.append(
            {
                "id": summary["id"],
                "label": summary["label"],
                "average": summary["average"],
                "affectedNotes": summary["affectedNotes"],
                "examples": examples,
                "summary": (
                    f"{summary['description']} This signal stays elevated across {summary['affectedNotes']} self-voice notes, "
                    f"with the strongest examples showing up in {', '.join(example['title'] for example in examples[:2])}."
                ),
            }
        )

    strength_summaries = []
    for definition in STRENGTH_DEFINITIONS:
        values = [note["strengthMap"][definition["id"]] for note in self_notes or note_reports]
        strength_summaries.append(
            {
                "id": definition["id"],
                "label": definition["label"],
                "summary": definition["description"],
                "average": round(mean(values), 1) if values else 0.0,
            }
        )
    strength_summaries.sort(key=lambda item: item["average"], reverse=True)

    top_self_notes = sorted(
        self_notes,
        key=lambda note: (
            note["signalMap"]["clarity_drag"]
            + note["signalMap"]["confidence_leakage"]
            + note["signalMap"]["listener_drift"]
            + note["signalMap"]["emotional_amplification"]
        ),
        reverse=True,
    )

    output_notes = []
    for note in sorted(note_reports, key=lambda item: item["createdAt"], reverse=True):
        note_copy = dict(note)
        note_copy.pop("signalMap", None)
        note_copy.pop("strengthMap", None)
        output_notes.append(note_copy)

    report = {
        "generatedAt": datetime.now(tz=timezone.utc).isoformat(),
        "source": {
            "csvFile": csv_path.name,
            "noteCount": len(note_reports),
            "selfVoiceCount": len(self_notes),
            "mixedVoiceCount": len(note_reports) - len(self_notes),
            "averageWords": round(mean(note["metrics"]["word_count"] for note in note_reports), 1),
            "medianWords": round(median(note["metrics"]["word_count"] for note in note_reports), 1),
            "dateRange": {
                "start": sorted_by_date[0]["createdAt"],
                "end": sorted_by_date[-1]["createdAt"],
            },
        },
        "overview": {
            "topFindings": top_findings,
            "strengths": strength_summaries[:2],
            "dominantThemes": [
                {"theme": theme, "count": count}
                for theme, count in theme_counts.most_common(6)
            ],
            "topSelfNotes": [
                {
                    "id": note["id"],
                    "title": note["title"],
                    "score": note["signals"][0]["score"],
                    "dominantSignal": note["signals"][0]["label"],
                }
                for note in top_self_notes[:8]
            ],
        },
        "aggregates": {
            "composites": composite_summaries,
            "timeline": timeline,
            "themes": [{"theme": theme, "count": count} for theme, count in theme_counts.most_common(10)],
            "lexicalHotspots": {
                key: [{"label": label, "count": count} for label, count in values]
                for key, values in lexical_hotspots.items()
            },
            "voicePurity": {
                "self": len(self_notes),
                "mixed": len(note_reports) - len(self_notes),
            },
        },
        "experiments": {
            "active": [],
            "archived": ARCHIVED_EXPERIMENTS,
            "research": RESEARCH_REFERENCES,
        },
        "practiceSystems": [],
        "notes": output_notes,
    }

    report["experiments"]["active"] = active_experiments(report)
    report["practiceSystems"] = [
        {
            "id": signal_id,
            "title": PRACTICE_LIBRARY[signal_id]["title"],
            "when": PRACTICE_LIBRARY[signal_id]["when"],
            "protocol": PRACTICE_LIBRARY[signal_id]["protocol"],
        }
        for signal_id in [finding["id"] for finding in top_findings[:4]]
    ]

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    report_path = OUTPUT_DIR / "latest-analysis.json"
    markdown_path = OUTPUT_DIR / "latest-analysis.md"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    markdown_path.write_text(build_markdown_report(report), encoding="utf-8")

    print(f"Wrote {report_path.relative_to(ROOT)}")
    print(f"Wrote {markdown_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
