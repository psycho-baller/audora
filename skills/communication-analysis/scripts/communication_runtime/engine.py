from __future__ import annotations

import math
import re
from collections import Counter
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
    CONTEXT_MAP,
    DEFAULT_LANGUAGE_ALLOWLIST,
    DIMENSION_LIBRARY,
    FEAR_WORDS,
    GENERIC_NOUNS,
    HEDGES,
    INTENSIFIERS,
    MODE_WEIGHTS,
    MODALS,
    REPORT_VERSION,
    REVERSAL_MARKERS,
    SELF_ATTACK,
    STOP_WORDS,
    STRUCTURE_MARKERS,
    VAGUE_WORDS,
    VOCABULARY_CONTEXT_BANKS,
    VOCABULARY_TARGETS,
)
from .llm import resolve_llm_config, synthesize_finding, synthesize_report_summary, synthesize_vocabulary_target
from .markdown_source import load_markdown_source

WORD_RE = re.compile(r"[A-Za-z']+")


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _tokenize(text: str) -> list[str]:
    return WORD_RE.findall(text.lower())


def _safe_ratio(numerator: float, denominator: float) -> float:
    if denominator <= 0:
        return 0.0
    return numerator / denominator


def _clamp(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
    return max(minimum, min(maximum, value))


def _count_markers(text: str, markers: Iterable[str]) -> int:
    lowered = text.lower()
    count = 0
    for marker in markers:
        if " " in marker:
            count += lowered.count(marker)
        else:
            count += len(re.findall(rf"(?<![A-Za-z]){re.escape(marker)}(?![A-Za-z])", lowered))
    return count


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


def _build_segment_strength(segment_text: str, artifact_count: int = 0) -> float:
    lowered = segment_text.lower()
    hedges = _count_markers(lowered, HEDGES)
    anchors = _count_markers(lowered, ANCHOR_MARKERS)
    structure = _count_markers(lowered, STRUCTURE_MARKERS)
    actions = _count_markers(lowered, ACTION_WORDS)
    audience = _count_markers(lowered, AUDIENCE_WORDS)
    commitments = _count_markers(lowered, AGENCY_COMMITMENTS)
    fillers = _count_markers(lowered, ["um", "uh", "like", "you know", "i mean", "basically", "actually"])
    vague_words = _count_markers(lowered, VAGUE_WORDS)
    generic_nouns = _count_markers(lowered, GENERIC_NOUNS)
    token_count = len(_tokenize(segment_text))
    length_penalty = max(0, token_count - 28) * 1.2
    return _clamp(
        (anchors * 12)
        + (structure * 16)
        + (actions * 10)
        + (audience * 8)
        + (commitments * 10)
        - (hedges * 10)
        - (fillers * 7)
        - (vague_words * 6)
        - (generic_nouns * 6)
        - (artifact_count * 8)
        - length_penalty
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


def _segment_index_by_density(source: dict[str, Any], markers: Iterable[str]) -> int | None:
    best_index = None
    best_score = -1.0
    best_count = -1
    for index, segment in enumerate(source["segments"]):
        count = _count_markers(segment["text"].lower(), markers)
        if count <= 0:
            continue
        density = (count * 100) / max(6, segment["token_count"])
        score = density + min(count, 4) * 2.5
        if score > best_score or (score == best_score and count > best_count):
            best_index = index
            best_count = count
            best_score = score
    return best_index


def _segment_index_by_artifacts(source: dict[str, Any]) -> int | None:
    best_index = None
    best_score = -1.0
    for index, segment in enumerate(source["segments"]):
        artifact_count = len(segment["artifact_span_ids"])
        if artifact_count <= 0:
            continue
        score = (artifact_count * 100) / max(6, segment["token_count"])
        if score > best_score:
            best_index = index
            best_score = score
    return best_index


def _note_features(source: dict[str, Any]) -> dict[str, Any]:
    clean_text = source["clean_body"]
    tokens = _tokenize(clean_text)
    token_count = max(len(tokens), 1)
    sentences = [segment["text"] for segment in source["segments"] if segment["text"].strip()]
    unique_ratio = _safe_ratio(len(set(tokens)), token_count)
    repeated_generic = Counter(token for token in tokens if token in GENERIC_NOUNS)
    segment_vectors = [Counter(_segment_token_set(segment["text"])) for segment in source["segments"]]
    similarities = [
        _cosine_similarity(segment_vectors[index - 1], segment_vectors[index])
        for index in range(1, len(segment_vectors))
    ]
    abrupt_shifts = [index for index, value in enumerate(similarities, start=1) if value < 0.14]
    sentence_lengths = [len(_tokenize(sentence)) for sentence in sentences]
    sentence_strengths = [
        _build_segment_strength(segment["text"], len(segment["artifact_span_ids"]))
        for segment in source["segments"]
    ]
    artifact_kinds = Counter(span["kind"] for span in source["artifact_spans"])
    return {
        "tokenCount": token_count,
        "sentenceCount": len(sentences) or 1,
        "uniqueRatio": unique_ratio,
        "fillerCount": artifact_kinds.get("filler", 0),
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
        "artifactCount": len(source["artifact_spans"]),
        "artifactKinds": artifact_kinds,
        "segmentSimilarities": similarities,
        "abruptShifts": abrupt_shifts,
        "avgSentenceLength": sum(sentence_lengths) / max(1, len(sentence_lengths)),
        "maxSentenceLength": max(sentence_lengths) if sentence_lengths else 0,
        "sentenceStrengths": sentence_strengths,
    }


def _make_evidence(
    source: dict[str, Any],
    detector: str,
    label: str,
    score: float,
    confidence: float,
    rationale: str,
    metrics: dict[str, Any],
    segment_index: int | None,
    source_type: str = "finding",
) -> dict[str, Any]:
    segment = None
    if segment_index is not None and 0 <= segment_index < len(source["segments"]):
        segment = source["segments"][segment_index]
    start = segment["start"] if segment else 0
    end = segment["end"] if segment else min(len(source["clean_body"]), 240)
    text = segment["text"] if segment else source["clean_body"][:240].strip()
    return {
        "id": f"{source_type}:{detector}:{Path(source['path']).stem}:{segment['id'] if segment else 'note'}",
        "detector": detector,
        "sourceType": source_type,
        "segment_id": segment["id"] if segment else None,
        "start": start,
        "end": end,
        "text": text,
        "label": label,
        "score": round(score, 1),
        "confidence": round(confidence, 2),
        "rationale": rationale,
        "metrics": metrics,
    }


def _detect_disfluency(source: dict[str, Any], features: dict[str, Any]) -> dict[str, Any]:
    per_100 = _safe_ratio(features["artifactCount"] + features["fillerCount"], features["tokenCount"]) * 100
    restarts = features["artifactKinds"].get("stutter_restart", 0) + features["artifactKinds"].get("repeat_token", 0)
    score = _clamp((per_100 * 8) + (restarts * 5) + max(0, features["avgSentenceLength"] - 24) * 1.2)
    segment_index = _segment_index_by_density(source, ["...", "--", "um", "uh", "you know", "i mean", "basically"])
    if segment_index is None:
        segment_index = _segment_index_by_artifacts(source)
    return {
        "score": round(score, 1),
        "confidence": _clamp(0.62 + min(0.3, _safe_ratio(features["artifactCount"], 10)), 0.2, 0.95),
        "rationale": "Frequent restarts, fillers, and repair artifacts appear in dense clusters.",
        "metrics": {"artifacts": features["artifactCount"], "fillers": features["fillerCount"], "per100Words": round(per_100, 2)},
        "segmentIndex": segment_index,
        "counterStrength": max(features["sentenceStrengths"], default=0) / 100,
    }


def _detect_hedging(source: dict[str, Any], features: dict[str, Any]) -> dict[str, Any]:
    hedge_rate = _safe_ratio(features["hedgeCount"] + features["vagueCount"] + features["modalCount"], features["tokenCount"]) * 100
    score = _clamp((hedge_rate * 12) + (features["softAgencyCount"] * 4))
    segment_index = _segment_index_by_density(source, HEDGES + VAGUE_WORDS + MODALS)
    return {
        "score": round(score, 1),
        "confidence": _clamp(0.68 + min(0.22, hedge_rate / 30), 0.2, 0.95),
        "rationale": "Claims are repeatedly softened before they fully commit.",
        "metrics": {"hedges": features["hedgeCount"], "vagueWords": features["vagueCount"], "modals": features["modalCount"], "ratePer100Words": round(hedge_rate, 2)},
        "segmentIndex": segment_index,
        "counterStrength": _clamp((features["commitmentCount"] * 14) + (features["anchorCount"] * 8) - (features["hedgeCount"] * 4), 0, 100) / 100,
    }


def _detect_lexical_precision(source: dict[str, Any], features: dict[str, Any]) -> dict[str, Any]:
    generic_rate = _safe_ratio(features["genericCount"] + features["vagueCount"], features["tokenCount"]) * 100
    score = _clamp((generic_rate * 10) + max(0, (0.46 - features["uniqueRatio"]) * 90) + (features["maxSentenceLength"] / 6))
    segment_index = _segment_index_by_density(source, GENERIC_NOUNS + VAGUE_WORDS)
    return {
        "score": round(score, 1),
        "confidence": _clamp(0.6 + min(0.26, generic_rate / 35), 0.2, 0.92),
        "rationale": "The transcript uses broad placeholders where concrete nouns or examples would carry more weight.",
        "metrics": {"genericNouns": features["genericCount"], "vagueWords": features["vagueCount"], "uniqueRatio": round(features["uniqueRatio"], 3)},
        "segmentIndex": segment_index,
        "counterStrength": _clamp((features["anchorCount"] * 10) + (features["structureCount"] * 10) + (features["uniqueRatio"] * 100) - (generic_rate * 4), 0, 100) / 100,
    }


def _detect_coherence(source: dict[str, Any], features: dict[str, Any]) -> dict[str, Any]:
    drift_rate = _safe_ratio(len(features["abruptShifts"]), max(1, len(source["segments"]) - 1))
    reopeners = _count_markers(source["clean_body"], ["back to", "anyway", "what i'm trying to say", "but yeah"])
    score = _clamp((drift_rate * 58) + (reopeners * 6) + max(0, features["avgSentenceLength"] - 18) * 0.6)
    segment_index = features["abruptShifts"][0] if features["abruptShifts"] else _segment_index_by_density(source, ["back to", "anyway"])
    return {
        "score": round(score, 1),
        "confidence": _clamp(0.58 + min(0.26, drift_rate), 0.2, 0.92),
        "rationale": "The note changes direction abruptly or reopens loops before the listener can consolidate the current one.",
        "metrics": {"abruptShifts": len(features["abruptShifts"]), "avgSimilarity": round(sum(features["segmentSimilarities"]) / max(1, len(features["segmentSimilarities"])), 3), "reopeners": reopeners},
        "segmentIndex": segment_index,
        "counterStrength": _clamp((features["structureCount"] * 14) + (features["anchorCount"] * 6) - (len(features["abruptShifts"]) * 12), 0, 100) / 100,
    }


def _detect_argument_structure(source: dict[str, Any], features: dict[str, Any]) -> dict[str, Any]:
    claim_density = _count_markers(source["clean_body"], ["need", "problem", "solution", "should", "want", "goal"])
    support_gap = max(0, claim_density - (features["anchorCount"] + features["structureCount"]))
    score = _clamp((support_gap * 7) + max(0, (features["structureCount"] == 0) * 16) + max(0, (features["anchorCount"] == 0) * 10))
    if "startup" in source["contexts"] or "communication" in source["contexts"]:
        score = _clamp(score + 8 - (features["audienceCount"] * 3))
    segment_index = _segment_index_by_density(source, ["problem", "solution", "need", "want", "goal"])
    return {
        "score": round(score, 1),
        "confidence": _clamp(0.59 + min(0.23, claim_density / 18), 0.2, 0.9),
        "rationale": "Claims show up faster than examples, anchors, or explicit asks.",
        "metrics": {"claimDensity": claim_density, "anchors": features["anchorCount"], "structure": features["structureCount"], "audience": features["audienceCount"]},
        "segmentIndex": segment_index,
        "counterStrength": _clamp((features["anchorCount"] * 15) + (features["structureCount"] * 16) + (features["audienceCount"] * 10) - (support_gap * 4), 0, 100) / 100,
    }


def _detect_commitment(source: dict[str, Any], features: dict[str, Any]) -> dict[str, Any]:
    leakage = max(0, features["softAgencyCount"] - features["commitmentCount"])
    modal_rate = _safe_ratio(features["modalCount"], features["tokenCount"]) * 100
    action_gap = max(0, 10 - features["actionCount"])
    score = _clamp((leakage * 8) + (modal_rate * 10) + (action_gap * 2))
    segment_index = _segment_index_by_density(source, AGENCY_SOFTENERS + AGENCY_COMMITMENTS)
    return {
        "score": round(score, 1),
        "confidence": _clamp(0.61 + min(0.24, leakage / 10), 0.2, 0.93),
        "rationale": "The wording leans toward aspiration and obligation more than decisive ownership.",
        "metrics": {"softAgency": features["softAgencyCount"], "commitment": features["commitmentCount"], "actionWords": features["actionCount"]},
        "segmentIndex": segment_index,
        "counterStrength": _clamp((features["commitmentCount"] * 18) + (features["actionCount"] * 10) - (features["softAgencyCount"] * 8), 0, 100) / 100,
    }


def _detect_contradiction(source: dict[str, Any], features: dict[str, Any]) -> dict[str, Any]:
    flip_pairs = len(re.findall(r"\bi can\b.*\bi can't\b|\bi want\b.*\bi don't\b|\bi should\b.*\bi can't\b", source["clean_body"].lower()))
    reversal_rate = _safe_ratio(features["reversalCount"], features["tokenCount"]) * 100
    score = _clamp((reversal_rate * 20) + (flip_pairs * 18) + (_safe_ratio(features["modalCount"], features["tokenCount"]) * 100 * 4))
    segment_index = _segment_index_by_density(source, REVERSAL_MARKERS)
    return {
        "score": round(score, 1),
        "confidence": _clamp(0.56 + min(0.24, features["reversalCount"] / 12), 0.2, 0.91),
        "rationale": "Frequent reversals and caveats blur the actual stance.",
        "metrics": {"reversals": features["reversalCount"], "flipPairs": flip_pairs},
        "segmentIndex": segment_index,
        "counterStrength": _clamp((features["structureCount"] * 10) + (features["commitmentCount"] * 10) - (features["reversalCount"] * 6), 0, 100) / 100,
    }


def _detect_stress(source: dict[str, Any], features: dict[str, Any]) -> dict[str, Any]:
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
    segment_index = _segment_index_by_density(source, FEAR_WORDS + SELF_ATTACK + APOLOGIES + INTENSIFIERS)
    return {
        "score": round(score, 1),
        "confidence": _clamp(0.66 + min(0.21, intensity / 16), 0.2, 0.95),
        "rationale": "Fear language, absolutes, or self-protective phrasing are visibly shaping the transcript.",
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


def _choose_replacement_option(target: dict[str, Any], source: dict[str, Any], segment_text: str) -> tuple[dict[str, Any], int]:
    segment_tokens = _segment_token_set(segment_text)
    doc_tokens = _segment_token_set(f"{source['title']} {' '.join(source['contexts'])}")
    if target["id"] == "i_think_feel_guess" and not segment_text.lower().strip().startswith(tuple(target["terms"])):
        for option in target["replacement_options"]:
            if option["word"] == "drop the opener":
                return option, 99
    best_option = target["replacement_options"][0]
    best_score = -1
    for option in target["replacement_options"]:
        keywords = set(option.get("keywords", []))
        keyword_score = (len(segment_tokens & keywords) * 2) + len(doc_tokens & keywords)
        if keyword_score > best_score:
            best_option = option
            best_score = keyword_score
    return best_option, best_score


def _cleanup_rewrite(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", text).strip()
    cleaned = re.sub(r"\s+([,.;:!?])", r"\1", cleaned)
    cleaned = re.sub(r"([,.;:!?]){2,}", r"\1", cleaned)
    cleaned = re.sub(r"\(\s+\)", "", cleaned)
    return cleaned.strip(" ,")


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
    for source_phrase, (replacement, label) in upgrade_map.items():
        pattern = _bounded_pattern(source_phrase)
        if pattern.search(lowered):
            return pattern.sub(replacement, text, count=1), label
    for source_phrase in ("really", "very"):
        pattern = _bounded_pattern(source_phrase)
        if pattern.search(lowered):
            return pattern.sub("", text, count=1), "remove the intensifier"
    return text, "remove the intensifier"


def _rewrite_vocabulary_segment(segment_text: str, target: dict[str, Any], option: dict[str, Any], matched_term: str) -> tuple[str, str]:
    rewritten = segment_text
    replacement_label = option["word"]
    if target["id"] == "really_very":
        rewritten, replacement_label = _upgrade_intensifier(segment_text)
        return _cleanup_rewrite(rewritten), replacement_label

    if target["id"] == "i_think_feel_guess" and not segment_text.lower().strip().startswith(matched_term):
        option = {**option, "rewrite_with": ""}
        replacement_label = "drop the opener"

    replacement = option.get("rewrite_with", option["word"])
    if target["id"] == "people_family" and matched_term in {"someone", "person"}:
        replacement = f"a {replacement}"
    if matched_term in {"things", "people"} or matched_term.endswith("s"):
        replacement = option.get("plural_rewrite_with", _pluralize_replacement(replacement))
    for term in target["terms"]:
        pattern = _bounded_pattern(term)
        if pattern.search(rewritten):
            rewritten = pattern.sub(replacement, rewritten, count=1)
            break
    return _cleanup_rewrite(rewritten), replacement_label


def _allow_vocabulary_rewrite(target: dict[str, Any], segment_text: str, option_score: int) -> bool:
    lowered = segment_text.lower()
    if target["kind"] == "phrase" or target["id"] == "really_very":
        return True
    if target["id"] == "thing_family":
        broad_patterns = [
            r"\bdo things\b",
            r"\bthese things\b",
            r"\ball these things\b",
            r"\bthings like that\b",
            r"\bsomething like that\b",
            r"\bkind of thing\b",
        ]
        if any(re.search(pattern, lowered) for pattern in broad_patterns):
            return False
        return option_score > 4
    if target["id"] in {"people_family", "way_family", "problem_family"}:
        return option_score > 2
    return option_score > 1


def _mode_weight(source: dict[str, Any], dimension: str) -> float:
    weight = MODE_WEIGHTS[source["analysis_mode"]][dimension]
    if source["analysis_mode"] == "transcript" and source.get("transcript_source") == "transcribed_markdown":
        if dimension == "disfluency_restarts":
            weight *= 0.68
        if dimension == "coherence_topic_drift":
            weight *= 0.92
    return weight


def _find_target_matches(source: dict[str, Any], target: dict[str, Any]) -> list[dict[str, Any]]:
    matches: list[dict[str, Any]] = []
    for segment in source["segments"]:
        lowered = segment["text"].lower()
        for term in target["terms"]:
            pattern = _bounded_pattern(term)
            for match_index, match in enumerate(pattern.finditer(lowered)):
                matches.append(
                    {
                        "id": f"{target['id']}:{segment['id']}:{term}:{match_index}",
                        "term": term,
                        "segmentId": segment["id"],
                        "segmentIndex": segment["index"],
                        "localStart": match.start(),
                        "localEnd": match.end(),
                        "start": segment["start"] + match.start(),
                        "end": segment["start"] + match.end(),
                        "segmentText": segment["text"],
                    }
                )
    matches.sort(key=lambda item: (item["start"], item["end"], item["term"]))
    return matches


def _build_context_banks(contexts: list[str]) -> list[dict[str, Any]]:
    banks = []
    for context in contexts:
        words = VOCABULARY_CONTEXT_BANKS.get(context)
        if words:
            banks.append({"context": context, "words": words})
    if not banks:
        banks.append({"context": "communication", "words": VOCABULARY_CONTEXT_BANKS["communication"]})
    return banks[:3]


def _build_vocabulary_section(source: dict[str, Any], lexical_score: float, evidence: list[dict[str, Any]], llm_config: dict[str, Any]) -> list[dict[str, Any]]:
    eligible = source["language"] in DEFAULT_LANGUAGE_ALLOWLIST
    if not eligible:
        return []

    total_words = max(1, source["word_count"])
    targets: list[dict[str, Any]] = []
    evidence_map = {item["id"]: item for item in evidence}
    for target in VOCABULARY_TARGETS:
        matches = _find_target_matches(source, target)
        min_occurrences = 1 if target["kind"] == "phrase" else 2
        if len(matches) < min_occurrences:
            continue
        occurrence_rate = _safe_ratio(len(matches), total_words) * 1000
        if target["kind"] == "word" and occurrence_rate < 12 and len(matches) < 3:
            continue
        evidence_ids: list[str] = []
        evidence_samples: list[str] = []
        sample_rewrites: list[dict[str, Any]] = []
        for match in matches[:4]:
            option, option_score = _choose_replacement_option(target, source, match["segmentText"])
            evidence_item = {
                "id": f"vocabulary:{target['id']}:{match['segmentId']}:{match['localStart']}",
                "detector": "vocabulary",
                "sourceType": "vocabulary",
                "segment_id": match["segmentId"],
                "start": match["start"],
                "end": match["end"],
                "text": _clip_excerpt(match["segmentText"], match["localStart"], match["localEnd"]),
                "label": target["label"],
                "score": round(min(100.0, 38 + (len(matches) * 11)), 1),
                "confidence": round(min(0.96, 0.58 + (len(matches) * 0.08)), 2),
                "rationale": f"'{match['term']}' appears as a repeatable vocabulary habit here. A cleaner alternative in this context is '{option['word']}'.",
                "metrics": {"matchedTerm": match["term"], "suggestedReplacement": option["word"]},
            }
            evidence_map[evidence_item["id"]] = evidence_item
            evidence_ids.append(evidence_item["id"])
            evidence_samples.append(evidence_item["text"])
            allow_rewrite = _allow_vocabulary_rewrite(target, match["segmentText"], option_score)
            rewritten, replacement_label = _rewrite_vocabulary_segment(match["segmentText"], target, option, match["term"])
            if allow_rewrite and rewritten and rewritten != _cleanup_rewrite(match["segmentText"]):
                sample_rewrites.append(
                    {
                        "original": _cleanup_rewrite(match["segmentText"]),
                        "rewritten": rewritten,
                        "replacement": replacement_label,
                    }
                )
        overuse_score = _clamp((min(50, occurrence_rate * 2.8)) + min(28, len(matches) * 7) + min(14, lexical_score * 0.12))
        item = {
            "id": target["id"],
            "label": target["label"],
            "kind": target["kind"],
            "category": target["category"],
            "overuseScore": round(overuse_score, 1),
            "confidence": round(min(0.95, 0.58 + min(0.22, len(matches) * 0.06)), 2),
            "totalOccurrences": len(matches),
            "occurrenceRatePerThousand": round(occurrence_rate, 2),
            "why_it_limits_you": target["why_it_limits_you"],
            "replacementOptions": [
                {"word": option["word"], "useWhen": option["useWhen"], "caution": option["caution"]}
                for option in target["replacement_options"]
            ],
            "sampleRewrites": sample_rewrites[:3],
            "learningSystem": list(target["practice_focus"]),
            "evidenceSpanIds": evidence_ids,
            "evidenceSamples": evidence_samples[:3],
        }
        if sample_rewrites:
            item["learningSystem"][0] = f"Use '{sample_rewrites[0]['replacement']}' as today's forced replacement whenever you hear '{target['label']}'."
        if llm_config["enabled"]:
            rewrite = synthesize_vocabulary_target(item, llm_config)
            if rewrite:
                if rewrite.get("whyItLimitsYou"):
                    item["why_it_limits_you"] = rewrite["whyItLimitsYou"]
                replacement_options = []
                for option in rewrite.get("replacementOptions", [])[:5]:
                    if not isinstance(option, dict):
                        continue
                    if not option.get("word") or not option.get("useWhen"):
                        continue
                    replacement_options.append(
                        {
                            "word": str(option["word"]).strip(),
                            "useWhen": str(option["useWhen"]).strip(),
                            "caution": str(option.get("caution", "")).strip(),
                        }
                    )
                if replacement_options:
                    item["replacementOptions"] = replacement_options
                learning_steps = [str(step).strip() for step in rewrite.get("learningSystem", []) if str(step).strip()]
                if learning_steps:
                    item["learningSystem"] = learning_steps[:4]
        targets.append(item)

    targets.sort(key=lambda item: (-item["overuseScore"], -item["totalOccurrences"], item["label"]))
    evidence[:] = sorted(evidence_map.values(), key=lambda item: (item["sourceType"], item["start"], item["end"]))
    return targets[:5]


def _build_strengths(source: dict[str, Any], detector_results: list[dict[str, Any]], evidence_items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    strengths: list[dict[str, Any]] = []
    ranked_segments = sorted(
        source["segments"],
        key=lambda segment: _build_segment_strength(segment["text"], len(segment["artifact_span_ids"])),
        reverse=True,
    )
    for segment in ranked_segments:
        score = round(_build_segment_strength(segment["text"], len(segment["artifact_span_ids"])), 1)
        lowered = segment["text"].lower()
        filler_penalty = _count_markers(lowered, ["um", "uh", "like", "you know", "i mean"])
        abstraction_penalty = _count_markers(lowered, VAGUE_WORDS + GENERIC_NOUNS)
        if score < 34:
            continue
        if filler_penalty > 1 or abstraction_penalty > 3 or segment["token_count"] > 40:
            continue
        strengths.append(
            {
                "id": f"strength:segment:{segment['id']}",
                "kind": "counterexample",
                "label": "Cleaner passage",
                "score": score,
                "explanation": "This passage is comparatively tighter and more anchored than the weaker stretches around it, so it is a better pattern to reuse.",
                "evidence_text": segment["text"],
            }
        )
        if len(strengths) >= 2:
            break
    return strengths[:2]


def _build_practice_systems(findings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    drills = []
    scenario_map = {
        "disfluency_restarts": {
            "title": "Pause-Build-Land",
            "prompt": "Explain one idea from this source in 20 seconds without fillers or self-repairs.",
            "rubric": ["Pause for one full beat before the first word.", "Lead with the claim, not the setup.", "Stop after one example instead of reopening the loop."],
            "success": ["No filler burst in the first sentence.", "One clear landing sentence under 14 words.", "No restart pattern after the example."],
        },
        "hedging_vagueness": {
            "title": "No-Softener Opening",
            "prompt": "Answer a hard question from this source using direct language first, then uncertainty only at the end if it is truly needed.",
            "rubric": ["Ban 'I think', 'maybe', 'kind of', and 'sort of' from the opening sentence.", "Replace vague nouns with one named object, metric, or actor.", "State your stance once before discussing nuance."],
            "success": ["The opening sentence survives without hedge language.", "At least one concrete noun replaces a placeholder like 'thing'.", "The listener could summarize your stance in one line."],
        },
        "lexical_precision": {
            "title": "Concrete Noun Rewrite",
            "prompt": "Take one vague passage from this source and rewrite it with specific nouns, examples, and constraints.",
            "rubric": ["Replace 'thing', 'stuff', and 'something' with the actual object.", "Add one example or number.", "Keep the rewrite shorter than the original."],
            "success": ["Every core noun is concrete.", "A listener can picture the scene or mechanism.", "The rewrite removes at least one generic placeholder."],
        },
        "coherence_topic_drift": {
            "title": "Thread Lock Drill",
            "prompt": "Respond to one objection from this source and hold one thread from claim to close without opening a second topic.",
            "rubric": ["State the claim.", "Give one supporting example.", "Close with the implication or ask."],
            "success": ["No abrupt transition into a new theme.", "No loop reopening phrase.", "The closing sentence answers the original objection directly."],
        },
        "argument_structure": {
            "title": "Claim-Evidence-Ask Simulation",
            "prompt": "Pitch the core idea from this source using a clean claim, one evidence anchor, and one explicit ask.",
            "rubric": ["Claim in one sentence.", "Evidence with one example, number, or observed moment.", "Ask or outcome in one sentence."],
            "success": ["All three parts are present.", "The evidence is not abstract.", "The ask is explicit and not implied."],
        },
        "commitment_agency": {
            "title": "Commitment Compression",
            "prompt": "Turn one aspiration from this source into a direct commitment with owner, action, and timing.",
            "rubric": ["Replace 'I need to' with 'I will' only if you can name the action.", "Add timing or trigger conditions.", "Remove external-blame framing from the sentence."],
            "success": ["The sentence names a concrete action.", "The commitment has a time boundary or trigger.", "The wording sounds owned rather than wished for."],
        },
        "contradiction_reversal": {
            "title": "Single Frame Recovery",
            "prompt": "Answer a follow-up question from this source without stacking caveats or reversing your own frame.",
            "rubric": ["Choose the primary frame before speaking.", "Allow one nuance sentence at most.", "End with the position you want remembered."],
            "success": ["No more than one reversal marker appears.", "The final sentence matches the opening claim.", "The listener leaves with one stable interpretation."],
        },
        "stress_self_protection": {
            "title": "Facts-Story-Request Split",
            "prompt": "Take one emotionally loaded moment from this source and restate it as facts, interpretation, and request.",
            "rubric": ["Separate observable facts from conclusions.", "Remove absolutes like 'always' or 'never' unless proven.", "Name the request or next move in plain language."],
            "success": ["The restated version contains fewer emotional amplifiers.", "The core issue is still preserved.", "The request is clear enough to act on."],
        },
    }
    for finding in findings[:3]:
        template = scenario_map[finding["dimension"]]
        drills.append(
            {
                "id": f"practice:{finding['dimension']}",
                "finding_id": finding["id"],
                "title": template["title"],
                "scenario_prompt": template["prompt"],
                "rubric": template["rubric"],
                "success_criteria": template["success"],
            }
        )
    return drills


def _build_activation_loop(source: dict[str, Any], findings: list[dict[str, Any]], vocabulary_targets: list[dict[str, Any]]) -> dict[str, Any]:
    top_vocab = vocabulary_targets[:3]
    top_findings = findings[:2]
    ban_terms = [target["label"] for target in top_vocab[:2]]
    preload_words = [option["word"] for target in top_vocab for option in target["replacementOptions"][:1]]
    daily_repairs = [finding["label"] for finding in top_findings]
    weekly_focus = top_vocab[0]["label"] if top_vocab else (top_findings[0]["label"] if top_findings else "clarity")
    return {
        "weekly_focus": weekly_focus,
        "trigger_question": "What is the exact object, stance, or request I mean here?",
        "ban_terms": ban_terms,
        "preload_words": preload_words[:5],
        "daily_loop": [
            "Start the day by reading the preload words once out loud.",
            "Catch one vague or softened sentence in real use and repair it immediately.",
            "Reuse one repaired sentence or replacement word later the same day.",
        ],
        "repair_prompt": "Capture the weak line, rewrite it once, and say the stronger version out loud once.",
        "contexts": source["contexts"],
        "repair_targets": daily_repairs,
    }


def _trim_clause(text: str) -> str:
    cleaned = _cleanup_rewrite(text)
    if cleaned and cleaned[-1] not in ".!?":
        cleaned = f"{cleaned}."
    return cleaned


def _remove_marker(text: str, marker: str) -> tuple[str, bool]:
    pattern = _bounded_pattern(marker)
    if pattern.search(text.lower()):
        return _cleanup_rewrite(pattern.sub("", text, count=1)), True
    return text, False


def _rewrite_sentence_for_dimension(text: str, dimension: str, source: dict[str, Any], vocabulary_targets: list[dict[str, Any]]) -> tuple[str, list[str]]:
    rewritten = text
    changes: list[str] = []
    if source["title"] and rewritten.lower().startswith(source["title"].lower() + " "):
        rewritten = rewritten[len(source["title"]) :].strip(" ,")
        changes.append("Removed the title framing so the sentence stands on its own.")

    if dimension == "disfluency_restarts":
        for marker in ["you know", "i mean", "basically", "actually"]:
            rewritten, removed = _remove_marker(rewritten, marker)
            if removed:
                changes.append(f"Removed filler phrase '{marker}'.")
        rewritten = _cleanup_rewrite(rewritten.replace("...", "."))
    elif dimension == "hedging_vagueness":
        for marker in ["i think", "i feel", "i guess", "maybe", "kind of", "sort of", "probably"]:
            rewritten, removed = _remove_marker(rewritten, marker)
            if removed:
                changes.append(f"Removed hedge '{marker}'.")
        if rewritten and rewritten[0].islower():
            rewritten = rewritten[0].upper() + rewritten[1:]
        if rewritten and not rewritten.lower().startswith(("the core point is", "my view is")):
            rewritten = f"The core point is {rewritten[0].lower() + rewritten[1:]}" if rewritten else rewritten
            changes.append("Moved the stance to the front of the sentence.")
    elif dimension == "lexical_precision":
        _precision_ids = {"thing_family", "people_family", "way_family", "good_family", "problem_family"}
        for target in vocabulary_targets:
            if target.get("id") not in _precision_ids or not target.get("sampleRewrites"):
                continue
            for rewrite in target["sampleRewrites"]:
                if rewrite["original"].lower() == _cleanup_rewrite(text).lower():
                    return rewrite["rewritten"], [f"Replaced vague wording with '{rewrite['replacement']}'."]  # type: ignore[list-item]
        for target in vocabulary_targets:
            if target.get("id") not in _precision_ids:
                continue
            match = next((item for item in target.get("sampleRewrites", []) if item["original"].lower() in _cleanup_rewrite(text).lower()), None)
            if match:
                return match["rewritten"], [f"Replaced vague wording with '{match['replacement']}'."]
    elif dimension == "coherence_topic_drift":
        rewritten, removed = _remove_marker(rewritten, "you know")
        if removed:
            changes.append("Removed the filler before tightening the thread.")
        parts = [part.strip(" ,") for part in re.split(r"\b(?:but|and|so|because)\b", rewritten, maxsplit=2) if part.strip()]
        if parts:
            rewritten = parts[0]
            changes.append("Kept the main thread and removed the extra branch.")
        if rewritten and not rewritten.lower().startswith("the core point is"):
            rewritten = f"The core point is {rewritten[0].lower() + rewritten[1:]}"
            changes.append("Added a single-frame opener.")
    elif dimension == "argument_structure":
        cleaned = _cleanup_rewrite(rewritten)
        if cleaned and not cleaned.lower().startswith("the core point is"):
            rewritten = f"The core point is {cleaned[0].lower() + cleaned[1:]}"
            changes.append("Turned the sentence into a direct claim.")
    elif dimension == "commitment_agency":
        replacements = {
            "i need to": "I will",
            "i should": "I will",
            "i want to": "I will",
            "i hope to": "I will",
        }
        lowered = rewritten.lower()
        for source_phrase, replacement in replacements.items():
            pattern = _bounded_pattern(source_phrase)
            if pattern.search(lowered):
                rewritten = pattern.sub(replacement, rewritten, count=1)
                changes.append(f"Replaced '{source_phrase}' with '{replacement}'.")
                break
    elif dimension == "contradiction_reversal":
        parts = [part.strip(" ,") for part in re.split(r"\b(?:but|however|though|although)\b", rewritten, maxsplit=1) if part.strip()]
        if parts:
            rewritten = parts[0]
            changes.append("Chose one frame instead of keeping both directions alive.")
    elif dimension == "stress_self_protection":
        replacements = {
            "always": "often",
            "never": "rarely",
            "crazy": "unexpected",
            "insane": "surprising",
            "awful": "costly",
        }
        for source_phrase, replacement in replacements.items():
            pattern = _bounded_pattern(source_phrase)
            if pattern.search(rewritten.lower()):
                rewritten = pattern.sub(replacement, rewritten, count=1)
                changes.append(f"Lowered emotional load by replacing '{source_phrase}' with '{replacement}'.")
    rewritten = _trim_clause(rewritten)
    return rewritten, changes


def _use_this_when(dimension: str, contexts: list[str]) -> str:
    context_hint = contexts[0] if contexts else "high-stakes communication"
    mapping = {
        "disfluency_restarts": f"Use this cleaner version when you are answering live in {context_hint} and you need the point to land on the first pass.",
        "hedging_vagueness": f"Use this pattern when you already know your stance in {context_hint} and the listener needs a direct answer.",
        "lexical_precision": f"Use this pattern when the listener needs a named object, mechanism, or request instead of a broad placeholder in {context_hint}.",
        "coherence_topic_drift": f"Use this pattern when you feel yourself opening a second thread before the first one has landed in {context_hint}.",
        "argument_structure": f"Use this pattern when you are persuading, pitching, or defending a point in {context_hint}.",
        "commitment_agency": f"Use this pattern when you want the sentence to sound owned and actionable in {context_hint}.",
        "contradiction_reversal": f"Use this pattern when you need one stable frame instead of keeping every caveat alive in {context_hint}.",
        "stress_self_protection": f"Use this pattern when the sentence is emotionally charged and you need clarity before intensity in {context_hint}.",
    }
    return mapping.get(dimension, f"Use this pattern in {context_hint} when clarity matters more than hedging.")


def _build_sentence_upgrades(
    source: dict[str, Any],
    findings: list[dict[str, Any]],
    vocabulary_targets: list[dict[str, Any]],
    evidence_items: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    evidence_by_id = {item["id"]: item for item in evidence_items}
    upgrades: list[dict[str, Any]] = []

    for finding in findings[:4]:
        evidence = evidence_by_id.get(finding["evidence_id"])
        if not evidence or not evidence.get("text"):
            continue
        weak_sentence = _cleanup_rewrite(evidence["text"])
        better_sentence, changes = _rewrite_sentence_for_dimension(weak_sentence, finding["dimension"], source, vocabulary_targets)
        if not better_sentence or better_sentence == weak_sentence:
            continue
        upgrades.append(
            {
                "id": f"sentence:{finding['dimension']}",
                "source": "finding",
                "finding_id": finding["id"],
                "title": f"Upgrade {finding['label']}",
                "weak_sentence": weak_sentence,
                "better_sentence": better_sentence,
                "why_better": finding["why_it_matters"],
                "what_changed": changes or ["Made the sentence more direct and easier to follow."],
                "use_this_when": _use_this_when(finding["dimension"], source["contexts"]),
            }
        )

    for target in vocabulary_targets[:3]:
        for rewrite in target.get("sampleRewrites", [])[:1]:
            upgrades.append(
                {
                    "id": f"sentence:vocabulary:{target['id']}",
                    "source": "vocabulary",
                    "finding_id": None,
                    "title": f"Upgrade {target['label']}",
                    "weak_sentence": rewrite["original"],
                    "better_sentence": rewrite["rewritten"],
                    "why_better": target["why_it_limits_you"],
                    "what_changed": [f"Replaced the weak wording with '{rewrite['replacement']}'.", "Kept the meaning while making the sentence more specific."],
                    "use_this_when": f"Use this replacement when you notice yourself reaching for {target['label'].lower()} and the listener needs a more exact word.",
                }
            )

    unique: list[dict[str, Any]] = []
    seen_pairs: set[tuple[str, str]] = set()
    for upgrade in upgrades:
        key = (upgrade["weak_sentence"], upgrade["better_sentence"])
        if key in seen_pairs:
            continue
        seen_pairs.add(key)
        unique.append(upgrade)
    return unique[:6]


def _build_executive_diagnosis(source: dict[str, Any], findings: list[dict[str, Any]], vocabulary_targets: list[dict[str, Any]], llm_config: dict[str, Any]) -> tuple[str, str]:
    if not findings:
        return (
            "This document does not show a major communication breakdown. The main opportunity is to keep pushing specificity and reuse your stronger sentence patterns deliberately.",
            "Consolidate precision rather than chasing a totally new speaking style.",
        )

    top_gap = findings[0]["label"]
    second_gap = findings[1]["label"] if len(findings) > 1 else None
    vocab_label = vocabulary_targets[0]["label"] if vocabulary_targets else None
    summary = f"The biggest drag in this {source['analysis_mode']} is {top_gap.lower()}."
    if second_gap:
        summary += f" The next pressure point is {second_gap.lower()}."
    if vocab_label:
        summary += f" The fastest vocabulary leverage comes from replacing habits like {vocab_label.lower()}."

    weekly_theme = f"Train against {top_gap.lower()} while forcing more precise nouns and cleaner openings."
    if llm_config["enabled"]:
        rewrite = synthesize_report_summary(
            {
                "source": {"title": source["title"], "mode": source["analysis_mode"], "contexts": source["contexts"]},
                "findings": [{"label": finding["label"], "severity": finding["severity"], "why": finding["why_it_matters"]} for finding in findings[:3]],
                "vocabulary": [{"label": target["label"], "why": target["why_it_limits_you"]} for target in vocabulary_targets[:3]],
            },
            llm_config,
        )
        if rewrite:
            summary = rewrite.get("executiveDiagnosis", summary) or summary
            weekly_theme = rewrite.get("weeklyTheme", weekly_theme) or weekly_theme
    return summary, weekly_theme


def build_analysis_report(path: str | Path) -> dict[str, Any]:
    source = load_markdown_source(path)
    llm_config = resolve_llm_config()
    features = _note_features(source)
    results: list[dict[str, Any]] = []
    evidence_items: list[dict[str, Any]] = []

    for dimension, detector in DETECTOR_MAP.items():
        raw = detector(source, features)
        mode_weight = _mode_weight(source, dimension)
        adjusted_score = round(raw["score"] * mode_weight, 1)
        adjusted_confidence = round(raw["confidence"] * (1.0 if source["language_eligible"] else 0.55), 2)
        library = DIMENSION_LIBRARY[dimension]
        evidence = _make_evidence(
            source=source,
            detector=dimension,
            label=library["label"],
            score=adjusted_score,
            confidence=adjusted_confidence,
            rationale=raw["rationale"],
            metrics={**raw["metrics"], "modeWeight": mode_weight},
            segment_index=raw["segmentIndex"],
            source_type="finding",
        )
        evidence_items.append(evidence)
        severity = round(adjusted_score * (1 - min(0.12, raw["counterStrength"] * 0.08)), 1)
        result = {
            "id": f"finding:{dimension}",
            "dimension": dimension,
            "label": library["label"],
            "severity": severity,
            "confidence": adjusted_confidence,
            "explanation": library["explanation"],
            "why_it_matters": library["why_it_matters"],
            "hypothesis": f"Tentative: {library['hypothesis']}",
            "metrics": {**raw["metrics"], "modeWeight": mode_weight},
            "evidence_id": evidence["id"],
        }
        if llm_config["enabled"] and severity >= 35:
            rewrite = synthesize_finding(
                {
                    "dimension": dimension,
                    "label": library["label"],
                    "severity": severity,
                    "confidence": adjusted_confidence,
                    "explanation": library["explanation"],
                    "why_it_matters": library["why_it_matters"],
                    "metrics": result["metrics"],
                },
                llm_config,
            )
            if rewrite:
                result["explanation"] = rewrite.get("summary", result["explanation"]) or result["explanation"]
                hypothesis = rewrite.get("hypothesis")
                if hypothesis:
                    result["hypothesis"] = f"Tentative: {hypothesis}"
        results.append(result)

    results.sort(key=lambda item: (-item["severity"], item["label"]))
    findings = [item for item in results if item["severity"] >= 30][:5]
    vocabulary = _build_vocabulary_section(source, next((item["severity"] for item in results if item["dimension"] == "lexical_precision"), 0), evidence_items, llm_config)
    strengths = _build_strengths(source, results, evidence_items)
    practice_systems = _build_practice_systems(findings)
    activation_loop = _build_activation_loop(source, findings, vocabulary)
    sentence_upgrades = _build_sentence_upgrades(source, findings, vocabulary, evidence_items)
    executive_diagnosis, weekly_theme = _build_executive_diagnosis(source, findings, vocabulary, llm_config)

    output_dir = source_output_dir(source["path"])
    markdown_path = output_dir / f"{Path(source['path']).stem}.md"
    json_path = output_dir / f"{Path(source['path']).stem}.json"

    report = {
        "source": {
            "path": source["path"],
            "title": source["title"],
            "analysis_mode": source["analysis_mode"],
            "language": source["language"],
            "date": source["date"],
            "tags": source["tags"],
            "contexts": source["contexts"],
            "word_count": source["word_count"],
            "analysis_markdown_path": str(markdown_path),
            "analysis_json_path": str(json_path),
        },
        "summary": {
            "executive_diagnosis": executive_diagnosis,
            "weekly_theme": weekly_theme,
            "snapshot": {
                "mode": source["analysis_mode"],
                "word_count": source["word_count"],
                "segments": len(source["segments"]),
                "contexts": source["contexts"],
                "ai_enabled": llm_config["enabled"],
            },
        },
        "findings": findings,
        "vocabulary": vocabulary,
        "strengths": strengths,
        "practice_systems": practice_systems,
        "activation_loop": activation_loop,
        "sentence_upgrades": sentence_upgrades,
        "evidence": evidence_items,
        "metadata": {
            "generated_at": _now(),
            "report_version": REPORT_VERSION,
            "llm": llm_config,
            "context_banks": _build_context_banks(source["contexts"]),
            "available_contexts": sorted(CONTEXT_MAP.keys()),
        },
    }
    return report


def source_output_dir(path: str | Path) -> Path:
    source_path = Path(path).resolve()
    return source_path.parent / "analysis"
