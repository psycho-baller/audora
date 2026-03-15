from __future__ import annotations

import hashlib
import math
import re
import shutil
from collections import Counter, defaultdict
from copy import deepcopy
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Iterable

from .constants import (
    ACTION_WORDS,
    AGENCY_COMMITMENTS,
    AGENCY_SOFTENERS,
    ANCHOR_MARKERS,
    APOLOGIES,
    AUDIENCE_WORDS,
    DEFAULT_EXPERIMENT_CONFIG,
    DEFAULT_LANGUAGE_ALLOWLIST,
    DIMENSION_LIBRARY,
    FEAR_WORDS,
    GENERIC_NOUNS,
    HEDGES,
    INTENSIFIERS,
    LANGUAGE_SENSITIVE_DIMENSIONS,
    MODALS,
    REVERSAL_MARKERS,
    SELF_ATTACK,
    STOP_WORDS,
    STRUCTURE_MARKERS,
    VAGUE_WORDS,
    VOCABULARY_CONTEXT_BANKS,
    VOCABULARY_TARGETS,
)
from .ingest import ingest_sources
from .llm import resolve_llm_config, synthesize_finding, synthesize_vocabulary_target
from .schemas import ArtifactSpan, DrillCard, EvidenceSpan, ExperimentRun, Finding, Segment, TranscriptNote
from .storage import (
    ARCHIVE_INDEX_PATH,
    EXPERIMENT_ARCHIVE_DIR,
    NORMALIZED_NOTES_PATH,
    NORMALIZED_INDEX_PATH,
    RUN_INDEX_PATH,
    archived_run_dir,
    ensure_dirs,
    latest_run_id,
    list_archived_runs,
    list_runs,
    read_json,
    run_dir,
    update_archive_index,
    update_run_index,
    write_json,
)

WORD_RE = re.compile(r"[A-Za-z']+")


def _load_notes() -> list[TranscriptNote]:
    payload = read_json(NORMALIZED_NOTES_PATH, [])
    notes: list[TranscriptNote] = []
    for item in payload:
        notes.append(
            TranscriptNote(
                **{
                    **item,
                    "artifact_spans": [ArtifactSpan(**artifact) for artifact in item.get("artifact_spans", [])],
                    "segments": [Segment(**segment) for segment in item.get("segments", [])],
                }
            )
        )
    return notes


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _tokenize(text: str) -> list[str]:
    return WORD_RE.findall(text.lower())


def _count_markers(text: str, markers: Iterable[str]) -> int:
    lowered = text.lower()
    count = 0
    for marker in markers:
        if " " in marker:
            count += lowered.count(marker)
        else:
            count += len(re.findall(rf"(?<![A-Za-z]){re.escape(marker)}(?![A-Za-z])", lowered))
    return count


def _safe_ratio(numerator: float, denominator: float) -> float:
    if denominator <= 0:
        return 0.0
    return numerator / denominator


def _clamp(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
    return max(minimum, min(maximum, value))


def _segment_token_set(text: str) -> set[str]:
    return {token for token in _tokenize(text) if token not in STOP_WORDS and len(token) > 2}


def _cosine_similarity(left: Counter[str], right: Counter[str]) -> float:
    if not left or not right:
        return 0.0
    dot = sum(left[token] * right[token] for token in set(left) & set(right))
    left_norm = math.sqrt(sum(value * value for value in left.values()))
    right_norm = math.sqrt(sum(value * value for value in right.values()))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return dot / (left_norm * right_norm)


def _build_lexical_vector(note: TranscriptNote) -> Counter[str]:
    tokens = [token for token in _tokenize(f"{note.title} {note.clean_text}") if token not in STOP_WORDS]
    return Counter(token for token in tokens if len(token) > 2)


def _cluster_notes(notes: list[TranscriptNote], similarity_threshold: float) -> dict[str, dict[str, Any]]:
    clusters: list[dict[str, Any]] = []
    note_vectors = {note.id: _build_lexical_vector(note) for note in notes}
    for note in notes:
        tags = set(note.context_tags)
        vector = note_vectors[note.id]
        best_index = -1
        best_score = 0.0
        for index, cluster in enumerate(clusters):
            vector_similarity = _cosine_similarity(vector, cluster["centroid"])
            tag_overlap = _safe_ratio(len(tags & set(cluster["tags"])), max(1, len(tags | set(cluster["tags"]))))
            score = (vector_similarity * 0.7) + (tag_overlap * 0.3)
            if score > best_score:
                best_score = score
                best_index = index
        if best_index >= 0 and best_score >= similarity_threshold:
            cluster = clusters[best_index]
            cluster["note_ids"].append(note.id)
            cluster["titles"].append(note.title)
            cluster["tags"].update(tags)
            cluster["centroid"].update(vector)
        else:
            clusters.append(
                {
                    "note_ids": [note.id],
                    "titles": [note.title],
                    "tags": set(tags),
                    "centroid": Counter(vector),
                }
            )

    mapping: dict[str, dict[str, Any]] = {}
    for index, cluster in enumerate(clusters):
        tag_counts = Counter(tag for tag in cluster["tags"])
        label = ", ".join(sorted(tag_counts.keys())[:2]) or f"cluster-{index + 1}"
        cluster_id = f"context-{index + 1:02d}"
        for note_id in cluster["note_ids"]:
            mapping[note_id] = {
                "clusterId": cluster_id,
                "clusterLabel": label,
                "clusterSize": len(cluster["note_ids"]),
            }
    return mapping


def _build_segment_strength(segment_text: str) -> float:
    lowered = segment_text.lower()
    hedges = _count_markers(lowered, HEDGES)
    anchors = _count_markers(lowered, ANCHOR_MARKERS)
    structure = _count_markers(lowered, STRUCTURE_MARKERS)
    actions = _count_markers(lowered, ACTION_WORDS)
    audience = _count_markers(lowered, AUDIENCE_WORDS)
    return _clamp((anchors * 16) + (structure * 18) + (actions * 12) + (audience * 10) - (hedges * 8))


def _make_evidence(
    note: TranscriptNote,
    detector: str,
    label: str,
    score: float,
    confidence: float,
    rationale: str,
    metrics: dict[str, Any],
    segment_index: int | None,
) -> EvidenceSpan:
    segment = None
    if segment_index is not None and 0 <= segment_index < len(note.segments):
        segment = note.segments[segment_index]
    start = segment.start if segment else 0
    end = segment.end if segment else min(len(note.raw_text), 240)
    text = segment.text if segment else note.raw_text[:240].strip()
    return EvidenceSpan(
        id=f"{detector}:{note.id}:{segment.id if segment else 'note'}",
        note_id=note.id,
        note_title=note.title,
        detector=detector,
        segment_id=segment.id if segment else None,
        start=start,
        end=end,
        text=text,
        label=label,
        score=round(score, 1),
        confidence=round(confidence, 2),
        rationale=rationale,
        metrics=metrics,
    )


def _bounded_pattern(marker: str) -> re.Pattern[str]:
    return re.compile(rf"(?<![A-Za-z]){re.escape(marker)}(?![A-Za-z])", re.IGNORECASE)


def _clip_excerpt(text: str, start: int, end: int, radius: int = 72) -> str:
    prefix_start = max(0, start - radius)
    suffix_end = min(len(text), end + radius)
    excerpt = text[prefix_start:suffix_end].strip()
    if prefix_start > 0:
        excerpt = f"...{excerpt}"
    if suffix_end < len(text):
        excerpt = f"{excerpt}..."
    return excerpt


def _find_target_matches(note: TranscriptNote, target: dict[str, Any]) -> list[dict[str, Any]]:
    matches: list[dict[str, Any]] = []
    for segment in note.segments:
        lowered = segment.text.lower()
        for term in target["terms"]:
            pattern = _bounded_pattern(term)
            for match_index, match in enumerate(pattern.finditer(lowered)):
                matches.append(
                    {
                        "id": f"{target['id']}:{note.id}:{segment.id}:{term}:{match_index}",
                        "term": term,
                        "segmentId": segment.id,
                        "segmentIndex": segment.index,
                        "localStart": match.start(),
                        "localEnd": match.end(),
                        "start": segment.start + match.start(),
                        "end": segment.start + match.end(),
                        "segmentText": segment.text,
                    }
                )
    matches.sort(key=lambda item: (item["start"], item["end"], item["term"]))
    return matches


def _choose_replacement_option(target: dict[str, Any], note: TranscriptNote, segment_text: str) -> tuple[dict[str, Any], int]:
    segment_tokens = _segment_token_set(segment_text)
    note_tokens = _segment_token_set(f"{note.title} {' '.join(note.context_tags)}")
    best_option = target["replacement_options"][0]
    best_score = -1
    for option in target["replacement_options"]:
        keywords = set(option.get("keywords", []))
        keyword_score = (len(segment_tokens & keywords) * 2) + len(note_tokens & keywords)
        if keyword_score > best_score:
            best_option = option
            best_score = keyword_score
    return best_option, best_score


def _cleanup_rewrite(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", text).strip()
    cleaned = re.sub(r"\s+([,.;:!?])", r"\1", cleaned)
    cleaned = re.sub(r"([,.;:!?]){2,}", r"\1", cleaned)
    cleaned = re.sub(r"\(\s+\)", "", cleaned)
    cleaned = re.sub(r"\s+'\s+", "'", cleaned)
    return cleaned.strip(" ,")


def _upgrade_intensifier(text: str) -> tuple[str, str]:
    upgrade_map = {
        "very good": ("useful", "useful"),
        "really good": ("useful", "useful"),
        "very bad": ("damaging", "damaging"),
        "really bad": ("damaging", "damaging"),
        "very hard": ("demanding", "demanding"),
        "really hard": ("demanding", "demanding"),
        "very important": ("critical", "critical"),
        "really important": ("critical", "critical"),
        "very interesting": ("revealing", "revealing"),
        "really interesting": ("revealing", "revealing"),
        "very clear": ("clear", "clear"),
        "really clear": ("clear", "clear"),
    }
    lowered = text.lower()
    for source, (replacement, label) in upgrade_map.items():
        pattern = _bounded_pattern(source)
        if pattern.search(lowered):
            return pattern.sub(replacement, text, count=1), label
    for source in ("really", "very"):
        pattern = _bounded_pattern(source)
        if pattern.search(lowered):
            return pattern.sub("", text, count=1), "remove the intensifier"
    return text, "remove the intensifier"


def _pluralize_replacement(text: str) -> str:
    if not text:
        return text
    parts = text.split(" ")
    last = parts[-1]
    if last.endswith("y") and len(last) > 1 and last[-2] not in "aeiou":
        parts[-1] = f"{last[:-1]}ies"
    elif last.endswith(("s", "x", "z", "ch", "sh")):
        parts[-1] = f"{last}es"
    else:
        parts[-1] = f"{last}s"
    return " ".join(parts)


def _rewrite_vocabulary_segment(
    segment_text: str,
    target: dict[str, Any],
    option: dict[str, Any],
    matched_term: str,
) -> tuple[str, str]:
    rewritten = segment_text
    replacement_label = option["word"]
    if target["id"] == "really_very":
        rewritten, replacement_label = _upgrade_intensifier(segment_text)
        return _cleanup_rewrite(rewritten), replacement_label

    replacement = option.get("rewrite_with", option["word"])
    if target["id"] == "people_family" and matched_term in {"someone", "person"}:
        lowered = segment_text.lower()
        if "i'm someone" in lowered or "i am someone" in lowered:
            return _cleanup_rewrite(segment_text), replacement_label
        replacement = f"a {replacement}"
    if matched_term in {"things", "people"} or matched_term.endswith("s"):
        replacement = option.get("plural_rewrite_with", _pluralize_replacement(replacement))
    for term in target["terms"]:
        pattern = _bounded_pattern(term)
        if pattern.search(rewritten):
            rewritten = pattern.sub(replacement, rewritten, count=1)
            break
    return _cleanup_rewrite(rewritten), replacement_label


def _make_vocabulary_evidence(
    note: TranscriptNote,
    target: dict[str, Any],
    match: dict[str, Any],
    total_in_note: int,
    replacement_word: str,
) -> EvidenceSpan:
    segment = note.segments[match["segmentIndex"]]
    rationale = (
        f"'{match['term']}' appears as a repeatable vocabulary habit here. A cleaner alternative in this context is '{replacement_word}'."
    )
    return EvidenceSpan(
        id=f"vocabulary:{target['id']}:{note.id}:{segment.id}:{match['localStart']}",
        note_id=note.id,
        note_title=note.title,
        detector="vocabulary",
        segment_id=segment.id,
        start=match["start"],
        end=match["end"],
        text=_clip_excerpt(segment.text, match["localStart"], match["localEnd"]),
        label=target["label"],
        score=round(min(100.0, 36 + (total_in_note * 10)), 1),
        confidence=round(min(0.96, 0.55 + (total_in_note * 0.08)), 2),
        rationale=rationale,
        metrics={
            "matchedTerm": match["term"],
            "segmentOccurrences": total_in_note,
            "suggestedReplacement": replacement_word,
        },
    )


def _build_context_word_banks(notes: list[TranscriptNote]) -> list[dict[str, Any]]:
    context_counts = Counter(tag for note in notes for tag in note.context_tags)
    banks = []
    for context, count in context_counts.most_common():
        words = VOCABULARY_CONTEXT_BANKS.get(context)
        if not words:
            continue
        banks.append({"context": context, "noteCount": count, "words": words})
        if len(banks) >= 4:
            break
    return banks


def _note_features(note: TranscriptNote) -> dict[str, Any]:
    clean_text = note.clean_text
    tokens = _tokenize(clean_text)
    token_count = max(len(tokens), 1)
    sentences = [segment.text for segment in note.segments if segment.text.strip()]
    unique_ratio = _safe_ratio(len(set(tokens)), token_count)
    repeated_generic = Counter(token for token in tokens if token in GENERIC_NOUNS)
    segment_vectors = [Counter(_segment_token_set(segment.text)) for segment in note.segments]
    similarities = [
        _cosine_similarity(segment_vectors[index - 1], segment_vectors[index])
        for index in range(1, len(segment_vectors))
    ]
    abrupt_shifts = [index for index, value in enumerate(similarities, start=1) if value < 0.14]
    sentence_lengths = [len(_tokenize(sentence)) for sentence in sentences]
    sentence_strengths = [_build_segment_strength(segment.text) for segment in note.segments]
    return {
        "tokenCount": token_count,
        "sentenceCount": len(sentences) or 1,
        "uniqueRatio": unique_ratio,
        "fillerCount": _count_markers(clean_text, ["um", "uh", "like", "you know", "i mean"]),
        "hedgeCount": _count_markers(clean_text, HEDGES),
        "vagueCount": _count_markers(clean_text, VAGUE_WORDS),
        "genericCount": sum(repeated_generic.values()),
        "modalCount": _count_markers(clean_text, MODALS),
        "structureCount": _count_markers(clean_text, STRUCTURE_MARKERS),
        "anchorCount": _count_markers(clean_text, ANCHOR_MARKERS),
        "actionCount": _count_markers(clean_text, ACTION_WORDS),
        "audienceCount": _count_markers(clean_text, AUDIENCE_WORDS),
        "softAgencyCount": _count_markers(clean_text, AGENCY_SOFTENERS),
        "commitmentCount": _count_markers(clean_text, AGENCY_COMMITMENTS),
        "reversalCount": _count_markers(clean_text, REVERSAL_MARKERS),
        "fearCount": _count_markers(clean_text, FEAR_WORDS),
        "selfAttackCount": _count_markers(clean_text, SELF_ATTACK),
        "intensityCount": _count_markers(clean_text, INTENSIFIERS),
        "apologyCount": _count_markers(clean_text, APOLOGIES),
        "absoluteCount": _count_markers(clean_text, ["always", "never", "everyone", "nothing"]),
        "artifactCount": len(note.artifact_spans),
        "artifactKinds": Counter(span.kind for span in note.artifact_spans),
        "segmentSimilarities": similarities,
        "abruptShifts": abrupt_shifts,
        "avgSentenceLength": sum(sentence_lengths) / max(1, len(sentence_lengths)),
        "maxSentenceLength": max(sentence_lengths) if sentence_lengths else 0,
        "sentenceStrengths": sentence_strengths,
    }


def _language_adjustment(note: TranscriptNote, dimension: str) -> tuple[float, bool]:
    if note.language in DEFAULT_LANGUAGE_ALLOWLIST:
        return 1.0, True
    if dimension in LANGUAGE_SENSITIVE_DIMENSIONS:
        return 0.45, False
    return note.language_confidence, True


def _segment_index_by_density(note: TranscriptNote, markers: Iterable[str]) -> int | None:
    best_index = None
    best_count = -1
    for index, segment in enumerate(note.segments):
        count = _count_markers(segment.text.lower(), markers)
        if count > best_count:
            best_index = index
            best_count = count
    return best_index


def _detect_disfluency(note: TranscriptNote, features: dict[str, Any]) -> dict[str, Any]:
    per_100 = _safe_ratio(features["artifactCount"] + features["fillerCount"], features["tokenCount"]) * 100
    restarts = features["artifactKinds"].get("stutter_restart", 0) + features["artifactKinds"].get("repeat_token", 0)
    score = _clamp((per_100 * 8) + (restarts * 5) + max(0, features["avgSentenceLength"] - 24) * 1.2)
    segment_index = _segment_index_by_density(note, ["...", "--", "um", "uh", "like", "i mean"])
    rationale = "Frequent restarts, fillers, and repair artifacts appear in dense clusters."
    confidence = 0.62 + min(0.3, _safe_ratio(features["artifactCount"], 10))
    return {
        "score": round(score, 1),
        "confidence": _clamp(confidence, 0.2, 0.95),
        "rationale": rationale,
        "metrics": {"artifacts": features["artifactCount"], "fillers": features["fillerCount"], "per100Words": round(per_100, 2)},
        "segmentIndex": segment_index,
        "counterStrength": max(features["sentenceStrengths"], default=0) / 100,
    }


def _detect_hedging(note: TranscriptNote, features: dict[str, Any]) -> dict[str, Any]:
    hedge_rate = _safe_ratio(features["hedgeCount"] + features["vagueCount"] + features["modalCount"], features["tokenCount"]) * 100
    score = _clamp((hedge_rate * 12) + (features["softAgencyCount"] * 4))
    rationale = "Claims are repeatedly softened before they fully commit."
    confidence = 0.68 + min(0.22, hedge_rate / 30)
    segment_index = _segment_index_by_density(note, HEDGES + VAGUE_WORDS + MODALS)
    return {
        "score": round(score, 1),
        "confidence": _clamp(confidence, 0.2, 0.95),
        "rationale": rationale,
        "metrics": {"hedges": features["hedgeCount"], "vagueWords": features["vagueCount"], "modals": features["modalCount"], "ratePer100Words": round(hedge_rate, 2)},
        "segmentIndex": segment_index,
        "counterStrength": _clamp((features["commitmentCount"] * 14) + (features["anchorCount"] * 8) - (features["hedgeCount"] * 4), 0, 100) / 100,
    }


def _detect_lexical_precision(note: TranscriptNote, features: dict[str, Any]) -> dict[str, Any]:
    generic_rate = _safe_ratio(features["genericCount"] + features["vagueCount"], features["tokenCount"]) * 100
    score = _clamp((generic_rate * 10) + max(0, (0.46 - features["uniqueRatio"]) * 90) + (features["maxSentenceLength"] / 6))
    rationale = "The transcript uses broad placeholders where concrete nouns or examples would carry more weight."
    confidence = 0.6 + min(0.26, generic_rate / 35)
    segment_index = _segment_index_by_density(note, GENERIC_NOUNS + VAGUE_WORDS)
    return {
        "score": round(score, 1),
        "confidence": _clamp(confidence, 0.2, 0.92),
        "rationale": rationale,
        "metrics": {"genericNouns": features["genericCount"], "vagueWords": features["vagueCount"], "uniqueRatio": round(features["uniqueRatio"], 3)},
        "segmentIndex": segment_index,
        "counterStrength": _clamp((features["anchorCount"] * 10) + (features["structureCount"] * 10) + (features["uniqueRatio"] * 100) - (generic_rate * 4), 0, 100) / 100,
    }


def _detect_coherence(note: TranscriptNote, features: dict[str, Any]) -> dict[str, Any]:
    drift_rate = _safe_ratio(len(features["abruptShifts"]), max(1, len(note.segments) - 1))
    reopeners = _count_markers(note.clean_text, ["back to", "anyway", "what i'm trying to say", "but yeah"])
    score = _clamp((drift_rate * 58) + (reopeners * 6) + max(0, features["avgSentenceLength"] - 18) * 0.6)
    rationale = "The note changes direction abruptly or reopens loops before the listener can consolidate the current one."
    confidence = 0.58 + min(0.26, drift_rate)
    segment_index = features["abruptShifts"][0] if features["abruptShifts"] else _segment_index_by_density(note, ["back to", "anyway"])
    return {
        "score": round(score, 1),
        "confidence": _clamp(confidence, 0.2, 0.92),
        "rationale": rationale,
        "metrics": {"abruptShifts": len(features["abruptShifts"]), "avgSimilarity": round(sum(features["segmentSimilarities"]) / max(1, len(features["segmentSimilarities"])), 3), "reopeners": reopeners},
        "segmentIndex": segment_index,
        "counterStrength": _clamp((features["structureCount"] * 14) + (features["anchorCount"] * 6) - (len(features["abruptShifts"]) * 12), 0, 100) / 100,
    }


def _detect_argument_structure(note: TranscriptNote, features: dict[str, Any]) -> dict[str, Any]:
    claim_density = _count_markers(note.clean_text, ["need", "problem", "solution", "should", "want", "goal"])
    support_gap = max(0, claim_density - (features["anchorCount"] + features["structureCount"]))
    score = _clamp((support_gap * 7) + max(0, (features["structureCount"] == 0) * 16) + max(0, (features["anchorCount"] == 0) * 10))
    if "startup" in note.context_tags or "communication" in note.context_tags:
        score = _clamp(score + 8 - (features["audienceCount"] * 3))
    rationale = "Claims show up faster than examples, anchors, or explicit asks."
    confidence = 0.59 + min(0.23, claim_density / 18)
    segment_index = _segment_index_by_density(note, ["problem", "solution", "need", "want", "goal"])
    return {
        "score": round(score, 1),
        "confidence": _clamp(confidence, 0.2, 0.9),
        "rationale": rationale,
        "metrics": {"claimDensity": claim_density, "anchors": features["anchorCount"], "structure": features["structureCount"], "audience": features["audienceCount"]},
        "segmentIndex": segment_index,
        "counterStrength": _clamp((features["anchorCount"] * 15) + (features["structureCount"] * 16) + (features["audienceCount"] * 10) - (support_gap * 4), 0, 100) / 100,
    }


def _detect_commitment(note: TranscriptNote, features: dict[str, Any]) -> dict[str, Any]:
    leakage = max(0, features["softAgencyCount"] - features["commitmentCount"])
    modal_rate = _safe_ratio(features["modalCount"], features["tokenCount"]) * 100
    action_gap = max(0, 10 - features["actionCount"])
    score = _clamp((leakage * 8) + (modal_rate * 10) + (action_gap * 2))
    rationale = "The wording leans toward aspiration and obligation more than decisive ownership."
    confidence = 0.61 + min(0.24, leakage / 10)
    segment_index = _segment_index_by_density(note, AGENCY_SOFTENERS + AGENCY_COMMITMENTS)
    return {
        "score": round(score, 1),
        "confidence": _clamp(confidence, 0.2, 0.93),
        "rationale": rationale,
        "metrics": {"softAgency": features["softAgencyCount"], "commitment": features["commitmentCount"], "actionWords": features["actionCount"]},
        "segmentIndex": segment_index,
        "counterStrength": _clamp((features["commitmentCount"] * 18) + (features["actionCount"] * 10) - (features["softAgencyCount"] * 8), 0, 100) / 100,
    }


def _detect_contradiction(note: TranscriptNote, features: dict[str, Any]) -> dict[str, Any]:
    flip_pairs = len(re.findall(r"\bi can\b.*\bi can't\b|\bi want\b.*\bi don't\b|\bi should\b.*\bi can't\b", note.clean_text.lower()))
    reversal_rate = _safe_ratio(features["reversalCount"], features["tokenCount"]) * 100
    score = _clamp((reversal_rate * 20) + (flip_pairs * 18) + (_safe_ratio(features["modalCount"], features["tokenCount"]) * 100 * 4))
    rationale = "Frequent reversals and caveats blur the actual stance."
    confidence = 0.56 + min(0.24, features["reversalCount"] / 12)
    segment_index = _segment_index_by_density(note, REVERSAL_MARKERS)
    return {
        "score": round(score, 1),
        "confidence": _clamp(confidence, 0.2, 0.91),
        "rationale": rationale,
        "metrics": {"reversals": features["reversalCount"], "flipPairs": flip_pairs},
        "segmentIndex": segment_index,
        "counterStrength": _clamp((features["structureCount"] * 10) + (features["commitmentCount"] * 10) - (features["reversalCount"] * 6), 0, 100) / 100,
    }


def _detect_stress(note: TranscriptNote, features: dict[str, Any]) -> dict[str, Any]:
    intensity = features["fearCount"] + features["selfAttackCount"] + features["apologyCount"] + features["intensityCount"] + features["absoluteCount"]
    pressure_categories = sum(
        1
        for key in ("fearCount", "selfAttackCount", "apologyCount", "intensityCount", "absoluteCount")
        if features[key] > 0
    )
    score = _clamp(
        (features["fearCount"] * 5)
        + (features["selfAttackCount"] * 7)
        + (features["apologyCount"] * 5)
        + (features["intensityCount"] * 4)
        + (features["absoluteCount"] * 2)
        + max(0, pressure_categories - 1) * 9
        + min(10, features["artifactCount"] / 20)
    )
    rationale = "Fear language, absolutes, or self-protective phrasing are visibly shaping the transcript."
    confidence = 0.66 + min(0.21, intensity / 16)
    segment_index = _segment_index_by_density(note, FEAR_WORDS + SELF_ATTACK + APOLOGIES + INTENSIFIERS)
    return {
        "score": round(score, 1),
        "confidence": _clamp(confidence, 0.2, 0.95),
        "rationale": rationale,
        "metrics": {"fear": features["fearCount"], "selfAttack": features["selfAttackCount"], "apology": features["apologyCount"], "intensity": features["intensityCount"], "absolutes": features["absoluteCount"]},
        "segmentIndex": segment_index,
        "counterStrength": _clamp((features["actionCount"] * 8) + (features["anchorCount"] * 10) - (intensity * 6), 0, 100) / 100,
    }


DETECTOR_MAP = {
    "disfluency_restarts": _detect_disfluency,
    "hedging_vagueness": _detect_hedging,
    "lexical_precision": _detect_lexical_precision,
    "coherence_topic_drift": _detect_coherence,
    "argument_structure": _detect_argument_structure,
    "commitment_agency": _detect_commitment,
    "contradiction_reversal": _detect_contradiction,
    "stress_self_protection": _detect_stress,
}


def _hash_config(config: dict[str, Any]) -> str:
    encoded = str(config).encode("utf-8")
    return hashlib.sha1(encoded).hexdigest()[:12]


def _summarize_corpus(notes: list[TranscriptNote]) -> dict[str, Any]:
    created = [note.created_at for note in notes if note.created_at]
    return {
        "noteCount": len(notes),
        "wordCount": sum(note.word_count for note in notes),
        "averageWords": round(sum(note.word_count for note in notes) / max(1, len(notes)), 1),
        "dateRange": {"start": min(created) if created else None, "end": max(created) if created else None},
        "contexts": Counter(tag for note in notes for tag in note.context_tags).most_common(12),
        "clusters": Counter(note.context_cluster_label for note in notes).most_common(),
    }


def _week_bucket(note: TranscriptNote) -> str:
    if not note.created_timestamp_ms:
        return "unknown"
    dt = datetime.fromtimestamp(note.created_timestamp_ms / 1000, tz=UTC)
    return f"{dt.isocalendar().year}-W{dt.isocalendar().week:02d}"


def _select_counterexamples(
    dimension: str,
    dimension_scores: dict[str, dict[str, Any]],
    notes_by_id: dict[str, TranscriptNote],
    target_cluster_ids: set[str],
) -> list[EvidenceSpan]:
    candidates = []
    for note_id, result in dimension_scores.items():
        note = notes_by_id[note_id]
        if note.context_cluster_id not in target_cluster_ids:
            continue
        if result["score"] > 32:
            continue
        strength_index = None
        if note.segments:
            strength_values = [_build_segment_strength(segment.text) for segment in note.segments]
            best_value = max(strength_values)
            strength_index = strength_values.index(best_value)
        candidates.append((result["counterStrength"], note, strength_index))
    candidates.sort(key=lambda item: item[0], reverse=True)
    spans = []
    for counter_strength, note, segment_index in candidates[:5]:
        spans.append(
            _make_evidence(
                note=note,
                detector=dimension,
                label="counterexample",
                score=counter_strength * 100,
                confidence=0.72,
                rationale="This passage is comparatively stronger and can serve as a reusable pattern.",
                metrics={"counterStrength": round(counter_strength, 3)},
                segment_index=segment_index,
            )
        )
    return spans


def _build_drills(finding: Finding, evidence: list[EvidenceSpan], notes_by_id: dict[str, TranscriptNote]) -> list[DrillCard]:
    contexts = []
    for note_id in finding.affected_note_ids[:6]:
        contexts.extend(notes_by_id[note_id].context_tags)
    dominant_contexts = ", ".join([item for item, _ in Counter(contexts).most_common(2)]) or "high-stakes conversations"
    scenario_map = {
        "disfluency_restarts": {
            "title": "Pause-Build-Land",
            "prompt": f"Explain one idea from your {dominant_contexts} notes in 20 seconds without fillers or self-repairs.",
            "rubric": [
                "Pause for one full beat before the first word.",
                "Lead with the claim, not the setup.",
                "Stop after one example instead of reopening the loop.",
            ],
            "success": [
                "No filler burst in the first sentence.",
                "One clear landing sentence under 14 words.",
                "No restart pattern after the example.",
            ],
        },
        "hedging_vagueness": {
            "title": "No-Softener Opening",
            "prompt": f"Answer a hard question from your {dominant_contexts} world using direct language first, then uncertainty only at the end if it is truly needed.",
            "rubric": [
                "Ban 'I think', 'maybe', 'kind of', and 'sort of' from the opening sentence.",
                "Replace vague nouns with one named object, metric, or actor.",
                "State your stance once before discussing nuance.",
            ],
            "success": [
                "The opening sentence survives without hedge language.",
                "At least one concrete noun replaces a placeholder like 'thing'.",
                "The listener could summarize your stance in one line.",
            ],
        },
        "lexical_precision": {
            "title": "Concrete Noun Rewrite",
            "prompt": f"Take one vague passage from your {dominant_contexts} notes and rewrite it with specific nouns, examples, and constraints.",
            "rubric": [
                "Replace 'thing', 'stuff', and 'something' with the actual object.",
                "Add one example or number.",
                "Keep the rewrite shorter than the original.",
            ],
            "success": [
                "Every core noun is concrete.",
                "A listener can picture the scene or mechanism.",
                "The rewrite removes at least one generic placeholder.",
            ],
        },
        "coherence_topic_drift": {
            "title": "Thread Lock Drill",
            "prompt": f"Respond to an investor or teammate objection from your {dominant_contexts} notes and hold one thread from claim to close without opening a second topic.",
            "rubric": [
                "State the claim.",
                "Give one supporting example.",
                "Close with the implication or ask.",
            ],
            "success": [
                "No abrupt transition into a new theme.",
                "No 'back to', 'anyway', or loop reopening phrase.",
                "The closing sentence answers the original objection directly.",
            ],
        },
        "argument_structure": {
            "title": "Claim-Evidence-Ask Simulation",
            "prompt": f"Pitch an idea from your {dominant_contexts} notes to a skeptical listener using a clean claim, one evidence anchor, and one explicit ask.",
            "rubric": [
                "Claim in one sentence.",
                "Evidence with one example, number, or observed moment.",
                "Ask or outcome in one sentence.",
            ],
            "success": [
                "All three parts are present.",
                "The evidence is not abstract.",
                "The ask is explicit and not implied.",
            ],
        },
        "commitment_agency": {
            "title": "Commitment Compression",
            "prompt": f"Turn one aspiration from your {dominant_contexts} notes into a direct commitment with owner, action, and timing.",
            "rubric": [
                "Replace 'I need to' with 'I will' only if you can name the action.",
                "Add timing or trigger conditions.",
                "Remove external-blame framing from the sentence.",
            ],
            "success": [
                "The sentence names a concrete action.",
                "The commitment has a time boundary or trigger.",
                "The wording sounds owned rather than wished for.",
            ],
        },
        "contradiction_reversal": {
            "title": "Single Frame Recovery",
            "prompt": f"Answer a follow-up question from your {dominant_contexts} notes without stacking caveats or reversing your own frame.",
            "rubric": [
                "Choose the primary frame before speaking.",
                "Allow one nuance sentence at most.",
                "End with the position you want remembered.",
            ],
            "success": [
                "No more than one reversal marker appears.",
                "The final sentence matches the opening claim.",
                "The listener leaves with one stable interpretation.",
            ],
        },
        "stress_self_protection": {
            "title": "Facts-Story-Request Split",
            "prompt": f"Take one emotionally loaded moment from your {dominant_contexts} notes and restate it as facts, interpretation, and request.",
            "rubric": [
                "Separate observable facts from conclusions.",
                "Remove absolutes like 'always' or 'never' unless proven.",
                "Name the request or next move in plain language.",
            ],
            "success": [
                "The restated version contains fewer emotional amplifiers.",
                "The core issue is still preserved.",
                "The request is clear enough to act on.",
            ],
        },
    }
    template = scenario_map[finding.dimension]
    return [
        DrillCard(
            id=f"drill:{finding.id}:0",
            weakness_target=finding.id,
            title=template["title"],
            scenario_prompt=template["prompt"],
            rubric=template["rubric"],
            success_criteria=template["success"],
            source_evidence_ids=[span.id for span in evidence[:3]],
        ),
        DrillCard(
            id=f"drill:{finding.id}:1",
            weakness_target=finding.id,
            title="Counterexample Imitation",
            scenario_prompt="Read one of your stronger counterexample passages, then restate a weak passage in that tighter pattern.",
            rubric=[
                "Copy the stronger passage's sentence shape, not its content.",
                "Keep the stronger opening structure.",
                "End on the decision, ask, or claim.",
            ],
            success_criteria=[
                "The rewrite is shorter than the weak original.",
                "The structure feels closer to the strong passage.",
                "One listener could repeat the main point immediately.",
            ],
            source_evidence_ids=[span.id for span in evidence[:2]],
        ),
    ]


def _apply_vocabulary_llm(vocabulary: dict[str, Any], llm_config: dict[str, Any]) -> None:
    for target in vocabulary.get("targets", [])[:6]:
        rewrite = synthesize_vocabulary_target(target, llm_config)
        if not rewrite:
            continue
        if rewrite.get("whyItLimitsYou"):
            target["why_it_limits_you"] = rewrite["whyItLimitsYou"]
        if rewrite.get("replacementOptions"):
            normalized_options = []
            for option in rewrite["replacementOptions"][:5]:
                if not isinstance(option, dict):
                    continue
                word = str(option.get("word", "")).strip()
                use_when = str(option.get("useWhen", "")).strip()
                caution = str(option.get("caution", "")).strip()
                if not word or not use_when:
                    continue
                normalized_options.append({"word": word, "useWhen": use_when, "caution": caution})
            if normalized_options:
                target["replacementOptions"] = normalized_options
        if rewrite.get("sampleRewrites"):
            normalized_rewrites = []
            for item in rewrite["sampleRewrites"][:3]:
                if not isinstance(item, dict):
                    continue
                original = str(item.get("original", "")).strip()
                rewritten = str(item.get("rewritten", "")).strip()
                replacement = str(item.get("replacement", "")).strip()
                if not original or not rewritten:
                    continue
                normalized_rewrites.append(
                    {
                        "noteId": item.get("noteId"),
                        "noteTitle": str(item.get("noteTitle", "")).strip(),
                        "original": original,
                        "rewritten": rewritten,
                        "replacement": replacement,
                    }
                )
            if normalized_rewrites:
                target["sampleRewrites"] = normalized_rewrites
        if rewrite.get("learningSystem"):
            steps = [str(step).strip() for step in rewrite["learningSystem"][:4] if str(step).strip()]
            if steps:
                target["learningSystem"] = steps


def _apply_llm_synthesis(findings: list[Finding], llm_config: dict[str, Any]) -> None:
    for finding in findings:
        rewrite = synthesize_finding(finding.to_dict(), llm_config)
        if not rewrite:
            continue
        if rewrite.get("summary"):
            finding.explanation = rewrite["summary"]
        if rewrite.get("hypothesis"):
            finding.hypothesis = f"Tentative: {rewrite['hypothesis']}"


def _build_vocabulary_section(
    notes: list[TranscriptNote],
    score_index: dict[str, Any],
    evidence_by_id: dict[str, EvidenceSpan],
) -> dict[str, Any]:
    eligible_notes = [note for note in notes if note.language in DEFAULT_LANGUAGE_ALLOWLIST]
    total_words = sum(note.word_count for note in eligible_notes)
    note_count = max(1, len(eligible_notes))
    clusters = {note.context_cluster_id for note in eligible_notes if note.context_cluster_id}
    targets: list[dict[str, Any]] = []

    for target in VOCABULARY_TARGETS:
        target_matches: list[tuple[TranscriptNote, dict[str, Any]]] = []
        matched_note_ids: set[str] = set()
        cluster_ids: set[str] = set()
        context_counter: Counter[str] = Counter()
        match_counter_by_note: Counter[str] = Counter()

        for note in eligible_notes:
            matches = _find_target_matches(note, target)
            if not matches:
                continue
            matched_note_ids.add(note.id)
            if note.context_cluster_id:
                cluster_ids.add(note.context_cluster_id)
            context_counter.update(note.context_tags)
            match_counter_by_note[note.id] = len(matches)
            for match in matches:
                target_matches.append((note, match))

        if not target_matches:
            continue

        total_occurrences = len(target_matches)
        note_coverage = _safe_ratio(len(matched_note_ids), note_count)
        cluster_spread = _safe_ratio(len(cluster_ids), max(1, len(clusters)))
        occurrence_rate = _safe_ratio(total_occurrences, max(1, total_words)) * 1000

        ranked_matches = sorted(
            target_matches,
            key=lambda item: (
                match_counter_by_note[item[0].id],
                score_index.get(item[0].id, {}).get("scores", {}).get("lexical_precision", 0)
                + score_index.get(item[0].id, {}).get("scores", {}).get("hedging_vagueness", 0),
                -item[1]["segmentIndex"],
            ),
            reverse=True,
        )

        evidence_ids: list[str] = []
        sample_rewrites: list[dict[str, Any]] = []
        seen_notes: set[str] = set()
        evidence_samples: list[str] = []
        for note, match in ranked_matches:
            option, option_score = _choose_replacement_option(target, note, match["segmentText"])
            evidence = _make_vocabulary_evidence(
                note=note,
                target=target,
                match=match,
                total_in_note=match_counter_by_note[note.id],
                replacement_word=option["word"],
            )
            evidence_by_id[evidence.id] = evidence
            if evidence.id not in evidence_ids:
                evidence_ids.append(evidence.id)
                evidence_samples.append(evidence.text)
            if note.id in seen_notes:
                if len(evidence_ids) >= 4:
                    break
                continue
            seen_notes.add(note.id)
            allow_rewrite = target["kind"] == "phrase" or target["id"] == "really_very" or option_score > 1
            if target["id"] in {"thing_family", "people_family", "way_family", "problem_family"}:
                allow_rewrite = option_score > 2
            rewritten, replacement_label = _rewrite_vocabulary_segment(match["segmentText"], target, option, match["term"])
            if allow_rewrite and rewritten and rewritten != _cleanup_rewrite(match["segmentText"]):
                sample_rewrites.append(
                    {
                        "noteId": note.id,
                        "noteTitle": note.title,
                        "original": _cleanup_rewrite(match["segmentText"]),
                        "rewritten": rewritten,
                        "replacement": replacement_label,
                    }
                )
            if len(evidence_ids) >= 4 and len(sample_rewrites) >= 3:
                break

        overuse_score = _clamp((note_coverage * 42) + (cluster_spread * 18) + min(36, occurrence_rate * 3.2) + min(12, len(matched_note_ids) * 0.5))
        confidence = round(min(0.95, 0.56 + (note_coverage * 0.18) + min(0.18, total_occurrences / 220)), 2)
        learning_system = list(target["practice_focus"])
        if sample_rewrites:
            learning_system[0] = (
                f"Use '{sample_rewrites[0]['replacement']}' as today's forced replacement whenever you hear '{target['label']}'."
            )

        targets.append(
            {
                "id": target["id"],
                "source": target["label"],
                "label": target["label"],
                "kind": target["kind"],
                "category": target["category"],
                "overuseScore": round(overuse_score, 1),
                "confidence": confidence,
                "totalOccurrences": total_occurrences,
                "occurrenceRatePerThousand": round(occurrence_rate, 2),
                "noteCoverage": round(note_coverage, 3),
                "clusterSpread": round(cluster_spread, 3),
                "notesImpacted": len(matched_note_ids),
                "contexts": [
                    {"label": label, "count": count}
                    for label, count in context_counter.most_common(4)
                ],
                "why_it_limits_you": target["why_it_limits_you"],
                "replacementOptions": [
                    {
                        "word": option["word"],
                        "useWhen": option["useWhen"],
                        "caution": option["caution"],
                    }
                    for option in target["replacement_options"]
                ],
                "evidenceSpanIds": evidence_ids,
                "sampleRewrites": sample_rewrites,
                "learningSystem": learning_system,
                "evidenceSamples": evidence_samples[:3],
            }
        )

    targets.sort(key=lambda item: (-item["overuseScore"], -item["totalOccurrences"], item["label"]))
    focus_targets = [target["id"] for target in targets[:3]]
    generic_target_ids = {"thing_family", "people_family", "way_family", "problem_family", "good_family"}
    phrase_target_ids = {"i_think_feel_guess", "you_know", "kind_of_sort_of"}
    generic_occurrences = sum(target["totalOccurrences"] for target in targets if target["id"] in generic_target_ids)
    phrase_occurrences = sum(target["totalOccurrences"] for target in targets if target["id"] in phrase_target_ids)

    return {
        "overview": {
            "eligibleNoteCount": len(eligible_notes),
            "trackedTargetCount": len(targets),
            "lexicalDiversity": round(
                _safe_ratio(
                    len({token for note in eligible_notes for token in _tokenize(note.clean_text) if token not in STOP_WORDS}),
                    max(1, total_words),
                ),
                3,
            ),
            "genericWordLoad": round(_safe_ratio(generic_occurrences, max(1, total_words)) * 100, 2),
            "phraseHabitLoad": round(_safe_ratio(phrase_occurrences, max(1, total_words)) * 100, 2),
            "focusTargets": focus_targets,
        },
        "targets": targets,
        "banks": _build_context_word_banks(eligible_notes),
        "experiments": [
            {
                "id": "frequency-coverage-scan",
                "label": "Frequency + coverage scan",
                "description": "Ranks repeated word families by raw count, note coverage, and spread across contexts.",
                "status": "active",
            },
            {
                "id": "contextual-rewrite-drafts",
                "label": "Contextual rewrite drafts",
                "description": "Builds rewrite examples by pairing each habit with context-aware replacement options.",
                "status": "active",
            },
            {
                "id": "targeted-word-banks",
                "label": "Context word banks",
                "description": "Surfaces learnable higher-value vocabulary for the contexts that dominate the corpus.",
                "status": "active",
            },
            {
                "id": "llm-refinement",
                "label": "Optional LLM refinement",
                "description": "Refines replacement guidance from evidence bundles only when env flags and API keys are present.",
                "status": "available",
            },
        ],
    }


def _compute_comparison(current: ExperimentRun, previous: dict[str, Any] | None, same_config: dict[str, Any] | None) -> dict[str, Any]:
    comparison = {
        "previousRunId": previous.get("id") if previous else None,
        "sameConfigRunId": same_config.get("id") if same_config else None,
        "severityShift": {},
        "stability": 1.0,
    }
    if not previous:
        return comparison

    previous_finding_map = {finding["dimension"]: finding["severity"] for finding in previous.get("findings", []) if finding.get("scope") == "corpus"}
    current_finding_map = {finding.dimension: finding.severity for finding in current.findings if finding.scope == "corpus"}
    deltas = {}
    for dimension, severity in current_finding_map.items():
        if dimension in previous_finding_map:
            deltas[dimension] = round(severity - previous_finding_map[dimension], 2)
    comparison["severityShift"] = deltas

    if same_config:
        same_map = {finding["dimension"]: finding["severity"] for finding in same_config.get("findings", []) if finding.get("scope") == "corpus"}
        shared = set(same_map) & set(current_finding_map)
        if shared:
            average_delta = sum(abs(current_finding_map[key] - same_map[key]) for key in shared) / len(shared)
            comparison["stability"] = round(max(0.0, 1 - (average_delta / 100)), 3)
    return comparison


def _quality_metrics(run_payload: dict[str, Any], previous: dict[str, Any] | None, same_config: dict[str, Any] | None) -> dict[str, Any]:
    corpus_findings = [finding for finding in run_payload["findings"] if finding["scope"] == "corpus"]
    note_scores = run_payload["notes"]["scoreIndex"]
    affected_notes = sum(
        1
        for note in note_scores.values()
        if any(score >= run_payload["config"]["thresholds"]["noteIssue"] for score in note["scores"].values())
    )
    coverage = round(affected_notes / max(1, len(note_scores)), 3)
    actionability = round(
        sum(
            1
            for finding in corpus_findings
            if finding["linked_drill_ids"] and finding["evidence_span_ids"] and finding["why_it_matters"]
        )
        / max(1, len(corpus_findings)),
        3,
    )
    novelty = 0.5
    if previous:
        previous_dims = [finding["dimension"] for finding in previous.get("findings", []) if finding.get("scope") == "corpus"]
        current_dims = [finding["dimension"] for finding in corpus_findings]
        overlap = len(set(previous_dims) & set(current_dims))
        novelty = round(max(0.1, 1 - _safe_ratio(overlap, max(1, len(set(previous_dims) | set(current_dims))))), 3)
    stability = 1.0
    if same_config:
        same_dims = {finding["dimension"]: finding["severity"] for finding in same_config.get("findings", []) if finding.get("scope") == "corpus"}
        current_dims = {finding["dimension"]: finding["severity"] for finding in corpus_findings}
        shared = set(same_dims) & set(current_dims)
        if shared:
            drift = sum(abs(current_dims[key] - same_dims[key]) for key in shared) / len(shared)
            stability = round(max(0.0, 1 - (drift / 100)), 3)
    overall = round((coverage * 0.3) + (actionability * 0.3) + (novelty * 0.15) + (stability * 0.25), 3)
    return {
        "coverage": coverage,
        "actionability": actionability,
        "novelty": novelty,
        "stability": stability,
        "overallQuality": overall,
    }


def bootstrap_workspace() -> dict[str, Any]:
    ensure_dirs()
    ingest_result = ingest_sources()
    if latest_run_id() is None:
        run_experiment()
    return ingest_result


def run_experiment(config: dict[str, Any] | None = None) -> dict[str, Any]:
    ensure_dirs()
    if not NORMALIZED_NOTES_PATH.exists():
        ingest_sources()

    experiment_config = deepcopy(DEFAULT_EXPERIMENT_CONFIG)
    if config:
        for key, value in config.items():
            if isinstance(value, dict) and key in experiment_config:
                experiment_config[key].update(value)
            else:
                experiment_config[key] = value
    experiment_config["llm"] = resolve_llm_config(experiment_config.get("llm"))

    notes = _load_notes()
    cluster_mapping = _cluster_notes(notes, experiment_config["clustering"]["similarityThreshold"])
    for note in notes:
        cluster = cluster_mapping[note.id]
        note.context_cluster_id = cluster["clusterId"]
        note.context_cluster_label = cluster["clusterLabel"]

    notes_by_id = {note.id: note for note in notes}
    detectors = [detector for detector in experiment_config["detectors"] if detector in DETECTOR_MAP]
    evidence_by_id: dict[str, EvidenceSpan] = {}
    score_index: dict[str, Any] = {}
    dimension_scores: dict[str, dict[str, Any]] = {dimension: {} for dimension in detectors}

    for note in notes:
        features = _note_features(note)
        note_entry = {
            "id": note.id,
            "title": note.title,
            "contextTags": note.context_tags,
            "contextClusterId": note.context_cluster_id,
            "contextClusterLabel": note.context_cluster_label,
            "language": note.language,
            "scores": {},
            "detectors": {},
        }
        for detector in detectors:
            adjustment, include_in_language_sensitive = _language_adjustment(note, detector)
            result = DETECTOR_MAP[detector](note, features)
            result["score"] = round(result["score"] * adjustment, 1)
            result["confidence"] = round(result["confidence"] * note.language_confidence, 2)
            result["languageEligible"] = include_in_language_sensitive
            note_entry["scores"][detector] = result["score"]
            note_entry["detectors"][detector] = result
            dimension_scores[detector][note.id] = result
            evidence = _make_evidence(
                note=note,
                detector=detector,
                label="evidence",
                score=result["score"],
                confidence=result["confidence"],
                rationale=result["rationale"],
                metrics=result["metrics"],
                segment_index=result["segmentIndex"],
            )
            evidence_by_id[evidence.id] = evidence
        score_index[note.id] = note_entry

    findings: list[Finding] = []
    drills: list[DrillCard] = []
    corpus = _summarize_corpus(notes)
    thresholds = experiment_config["thresholds"]

    for dimension in detectors:
        library = DIMENSION_LIBRARY[dimension]
        results = dimension_scores[dimension]
        eligible_results = {
            note_id: result
            for note_id, result in results.items()
            if result["languageEligible"] or notes_by_id[note_id].language in DEFAULT_LANGUAGE_ALLOWLIST
        }
        affected = {
            note_id: result
            for note_id, result in eligible_results.items()
            if result["score"] >= thresholds["noteIssue"]
        }
        if not eligible_results:
            continue
        note_count = len(eligible_results)
        prevalence = _safe_ratio(len(affected), note_count)
        top_scores = sorted((result["score"] for result in affected.values()), reverse=True)[: max(1, math.ceil(len(affected) * 0.3))]
        intensity = _safe_ratio(sum(top_scores), max(1, len(top_scores))) / 100 if top_scores else 0.0
        week_buckets = { _week_bucket(notes_by_id[note_id]) for note_id in affected }
        total_week_buckets = { _week_bucket(note) for note in notes }
        persistence = _safe_ratio(len(week_buckets), max(1, len(total_week_buckets)))
        context_buckets = { notes_by_id[note_id].context_cluster_id for note_id in affected }
        all_context_buckets = { note.context_cluster_id for note in notes }
        context_spread = _safe_ratio(len(context_buckets), max(1, len(all_context_buckets)))
        target_clusters = {notes_by_id[note_id].context_cluster_id for note_id in affected}
        counterexample_spans = _select_counterexamples(dimension, results, notes_by_id, target_clusters)
        for span in counterexample_spans:
            evidence_by_id[span.id] = span
        counterexample_factor = _safe_ratio(sum(span.score for span in counterexample_spans), max(1, len(counterexample_spans))) / 100
        severity = 100 * ((prevalence * 0.35) + (intensity * 0.3) + (persistence * 0.2) + (context_spread * 0.15))
        severity *= 1 - min(0.18, counterexample_factor * 0.12)
        evidence_ranked = sorted(
            affected.items(),
            key=lambda item: item[1]["score"],
            reverse=True,
        )[:5]
        evidence_ids = [
            f"{dimension}:{notes_by_id[note_id].id}:{notes_by_id[note_id].segments[result['segmentIndex']].id if result['segmentIndex'] is not None and result['segmentIndex'] < len(notes_by_id[note_id].segments) else 'note'}"
            for note_id, result in evidence_ranked
        ]
        confidence = round(
            min(
                0.96,
                0.52
                + (prevalence * 0.18)
                + (min(len(affected), 25) / 25 * 0.16)
                + (counterexample_factor * 0.06),
            ),
            2,
        )
        finding = Finding(
            id=f"finding:{dimension}",
            dimension=dimension,
            label=library["label"],
            scope="corpus",
            severity=round(severity, 1),
            confidence=confidence,
            explanation=library["explanation"],
            why_it_matters=library["why_it_matters"],
            hypothesis=f"Tentative: {library['hypothesis']}",
            metrics={
                "prevalence": round(prevalence, 3),
                "intensity": round(intensity, 3),
                "persistence": round(persistence, 3),
                "contextSpread": round(context_spread, 3),
                "affectedNotes": len(affected),
                "eligibleNotes": note_count,
            },
            evidence_span_ids=evidence_ids,
            counterexample_span_ids=[span.id for span in counterexample_spans],
            affected_note_ids=[note_id for note_id, _ in evidence_ranked],
        )
        if finding.severity >= thresholds["corpusIssue"]:
            findings.append(finding)

        clusters = defaultdict(list)
        for note_id, result in affected.items():
            clusters[notes_by_id[note_id].context_cluster_id].append((note_id, result))
        for cluster_id, cluster_results in sorted(clusters.items(), key=lambda item: len(item[1]), reverse=True)[:2]:
            cluster_severity = sum(result["score"] for _, result in cluster_results) / max(1, len(cluster_results))
            if cluster_severity < thresholds["contextIssue"]:
                continue
            cluster_label = notes_by_id[cluster_results[0][0]].context_cluster_label
            findings.append(
                Finding(
                    id=f"finding:{dimension}:{cluster_id}",
                    dimension=dimension,
                    label=f"{library['label']} in {cluster_label}",
                    scope="context",
                    severity=round(cluster_severity, 1),
                    confidence=round(min(0.92, 0.55 + len(cluster_results) * 0.06), 2),
                    explanation=f"This weakness concentrates inside the {cluster_label} context rather than appearing evenly across the corpus.",
                    why_it_matters=f"When {cluster_label} triggers this pattern, the transcript becomes materially weaker in the moments that likely matter most.",
                    hypothesis=f"Tentative: this may be context-linked rather than a universal trait.",
                    metrics={"affectedNotes": len(cluster_results)},
                    evidence_span_ids=[
                        f"{dimension}:{notes_by_id[note_id].id}:{notes_by_id[note_id].segments[result['segmentIndex']].id if result['segmentIndex'] is not None and result['segmentIndex'] < len(notes_by_id[note_id].segments) else 'note'}"
                        for note_id, result in sorted(cluster_results, key=lambda item: item[1]["score"], reverse=True)[:3]
                    ],
                    counterexample_span_ids=[],
                    affected_note_ids=[note_id for note_id, _ in cluster_results[:4]],
                    context_cluster_id=cluster_id,
                )
            )

    findings.sort(key=lambda finding: (finding.scope != "corpus", -finding.severity))
    if experiment_config["llm"]["enabled"]:
        _apply_llm_synthesis([finding for finding in findings if finding.scope == "corpus"], experiment_config["llm"])

    top_corpus_findings = [finding for finding in findings if finding.scope == "corpus"][:4]
    for finding in top_corpus_findings:
        source_spans = [evidence_by_id[span_id] for span_id in finding.evidence_span_ids if span_id in evidence_by_id]
        finding_drills = _build_drills(finding, source_spans, notes_by_id)
        drills.extend(finding_drills)
        finding.linked_drill_ids.extend([drill.id for drill in finding_drills])

    vocabulary = _build_vocabulary_section(notes, score_index, evidence_by_id)
    if experiment_config["llm"]["enabled"]:
        _apply_vocabulary_llm(vocabulary, experiment_config["llm"])

    created_at = _now()
    run_id = f"run-{datetime.now(UTC).strftime('%Y%m%d-%H%M%S-%f')}-{_hash_config(experiment_config)}"
    run_path = run_dir(run_id)
    run_path.mkdir(parents=True, exist_ok=True)

    previous_runs = list_runs()
    previous = read_json(run_dir(previous_runs[0]["id"]) / "run.json", None) if previous_runs else None
    same_config = None
    config_hash = _hash_config(experiment_config)
    for record in previous_runs:
        if record.get("configHash") == config_hash:
            same_config = read_json(run_dir(record["id"]) / "run.json", None)
            break

    run = ExperimentRun(
        id=run_id,
        created_at=created_at,
        config=experiment_config,
        corpus=corpus,
        notes={
            "scoreIndex": score_index,
            "index": [
                {
                    "id": note.id,
                    "title": note.title,
                    "language": note.language,
                    "contextTags": note.context_tags,
                    "contextClusterId": note.context_cluster_id,
                    "contextClusterLabel": note.context_cluster_label,
                    "wordCount": note.word_count,
                }
                for note in notes
            ],
        },
        vocabulary=vocabulary,
        findings=findings,
        evidence=list(evidence_by_id.values()),
        drills=drills,
        metrics={},
        comparisons={},
        archive_status={"archived": False, "archivedAt": None, "reason": None},
    )
    run.comparisons = _compute_comparison(run, previous, same_config)
    run_payload = run.to_dict()
    run.metrics = _quality_metrics(run_payload, previous, same_config)
    run_payload = run.to_dict()

    archive_floor = experiment_config["thresholds"]["archiveQualityFloor"]
    if run.metrics["overallQuality"] < archive_floor:
        run.archive_status = {
            "archived": True,
            "archivedAt": _now(),
            "reason": "overall quality below archive floor",
        }
        run_payload = run.to_dict()

    write_json(run_path / "run.json", run_payload)
    write_json(run_path / "summary.json", {
        "id": run.id,
        "createdAt": run.created_at,
        "configHash": config_hash,
        "metrics": run.metrics,
        "archiveStatus": run.archive_status,
        "topFindings": [
            {
                "dimension": finding.dimension,
                "label": finding.label,
                "severity": finding.severity,
            }
            for finding in run.findings
            if finding.scope == "corpus"
        ][:4],
    })

    index = previous_runs
    index.insert(
        0,
        {
            "id": run.id,
            "createdAt": run.created_at,
            "configHash": config_hash,
            "name": experiment_config["name"],
            "metrics": run.metrics,
            "archiveStatus": run.archive_status,
            "topDimension": next((finding.dimension for finding in run.findings if finding.scope == "corpus"), None),
        },
    )
    update_run_index(index)

    if run.archive_status["archived"]:
        archive_run(run.id, reason=run.archive_status["reason"])
        run_payload = read_json(archived_run_dir(run.id) / "run.json", {})
    return run_payload


def archive_run(run_id: str, reason: str | None = None) -> dict[str, Any]:
    ensure_dirs()
    source_dir = run_dir(run_id)
    if not source_dir.exists():
        return {"ok": False, "error": "Run not found"}

    archived_dir = archived_run_dir(run_id)
    if archived_dir.exists():
        shutil.rmtree(archived_dir)
    shutil.move(str(source_dir), str(archived_dir))

    run_payload = read_json(archived_dir / "run.json", {})
    run_payload.setdefault("archive_status", {})
    run_payload["archive_status"] = {
        "archived": True,
        "archivedAt": _now(),
        "reason": reason or run_payload.get("archive_status", {}).get("reason") or "archived manually",
    }
    write_json(archived_dir / "run.json", run_payload)

    runs = [record for record in list_runs() if record["id"] != run_id]
    update_run_index(runs)
    archives = list_archived_runs()
    archives.insert(
        0,
        {
            "id": run_id,
            "archivedAt": run_payload["archive_status"]["archivedAt"],
            "reason": run_payload["archive_status"]["reason"],
            "metrics": run_payload.get("metrics", {}),
            "name": run_payload.get("config", {}).get("name", "unknown"),
        },
    )
    update_archive_index(archives)
    return {"ok": True, "id": run_id}
