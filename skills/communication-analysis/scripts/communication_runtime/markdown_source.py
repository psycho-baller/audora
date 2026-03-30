from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from .constants import CONTEXT_MAP, DEFAULT_LANGUAGE_ALLOWLIST, FILLERS

WORD_RE = re.compile(r"[A-Za-z']+")
FRONTMATTER_RE = re.compile(r"\A---\s*\n(.*?)\n---\s*\n?", re.DOTALL)


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _split_csvish(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def _parse_scalar(raw: str) -> Any:
    value = raw.strip()
    if not value:
        return ""
    if value.startswith("[") and value.endswith("]"):
        inner = value[1:-1].strip()
        return _split_csvish(inner)
    if value.lower() in {"true", "false"}:
        return value.lower() == "true"
    return value.strip('"').strip("'")


def parse_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    match = FRONTMATTER_RE.match(text)
    if not match:
        return {}, text

    block = match.group(1)
    metadata: dict[str, Any] = {}
    active_key: str | None = None
    for raw_line in block.splitlines():
        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith("- ") and active_key:
            metadata.setdefault(active_key, [])
            metadata[active_key].append(_parse_scalar(stripped[2:]))
            continue
        active_key = None
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        normalized_key = key.strip().lower().replace("-", "_")
        parsed = _parse_scalar(value)
        if parsed == "" and not value.strip():
            metadata[normalized_key] = []
            active_key = normalized_key
        else:
            metadata[normalized_key] = parsed
    body = text[match.end() :]
    return metadata, body


def _strip_markdown(text: str) -> str:
    cleaned = re.sub(r"```.*?```", " ", text, flags=re.DOTALL)
    cleaned = re.sub(r"`([^`]*)`", r"\1", cleaned)
    cleaned = re.sub(r"!\[[^\]]*\]\([^)]+\)", " ", cleaned)
    cleaned = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", cleaned)
    cleaned = re.sub(r"^\s{0,3}#{1,6}\s*", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"^\s*>\s?", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"^\s*[-*+]\s+", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"^\s*\d+\.\s+", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"[*_~]", "", cleaned)
    cleaned = cleaned.replace("|", " ")
    return _normalize_text(cleaned)


def _extract_analysis_body(body: str) -> str:
    heading_patterns = [
        r"(?im)^##\s+transcript\s*$",
        r"(?im)^#\s+transcript\s*$",
        r"(?im)^##\s+note\s*$",
        r"(?im)^#\s+note\s*$",
    ]
    for pattern in heading_patterns:
        match = re.search(pattern, body)
        if match:
            extracted = body[match.end() :].strip()
            if extracted:
                return extracted
    return body


def _keyword_occurrences(haystack: str, keyword: str) -> int:
    normalized = keyword.strip().lower()
    if not normalized:
        return 0
    if " " in normalized:
        pattern = re.compile(rf"(?<![A-Za-z]){re.escape(normalized)}(?![A-Za-z])")
        return len(pattern.findall(haystack))
    pattern = re.compile(rf"(?<![A-Za-z]){re.escape(normalized)}(?![A-Za-z])")
    return len(pattern.findall(haystack))


def _infer_title(body: str, path: Path) -> str:
    for line in body.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip()
    return path.stem.replace("-", " ").replace("_", " ").strip().title() or "Untitled"


def _find_artifacts(text: str) -> list[dict[str, Any]]:
    spans: list[dict[str, Any]] = []
    patterns = [
        ("ellipsis", re.compile(r"\.\.\.")),
        ("dash_fragment", re.compile(r"\b[A-Za-z]{1,15}-(?=\s|$)|--+")),
        ("repeat_token", re.compile(r"\b([A-Za-z']{1,15})\s+\1\b", re.IGNORECASE)),
        ("stutter_restart", re.compile(r"\b([A-Za-z]{1,6})-\s*[A-Za-z]{1,20}\b")),
    ]
    for kind, pattern in patterns:
        for index, match in enumerate(pattern.finditer(text)):
            spans.append(
                {
                    "id": f"artifact:{kind}:{index}",
                    "kind": kind,
                    "start": match.start(),
                    "end": match.end(),
                    "text": match.group(0),
                    "metadata": {},
                }
            )
    lowered = text.lower()
    for filler in FILLERS:
        if filler == "like":
            pattern = re.compile(
                r"(?:^|[,.;!?]\s+|\b(?:and|but|or|so)\s+)(like)(?=(?:\s+(?:i|you|we|he|she|they|it|this|that|what|a|an|the)\b|[,.!?]))"
            )
        else:
            pattern = re.compile(rf"(?<![A-Za-z]){re.escape(filler)}(?![A-Za-z])")
        for index, match in enumerate(pattern.finditer(lowered)):
            start, end = match.span(1) if match.lastindex else match.span()
            spans.append(
                {
                    "id": f"artifact:filler:{filler}:{index}",
                    "kind": "filler",
                    "start": start,
                    "end": end,
                    "text": text[start:end],
                    "metadata": {"token": filler},
                }
            )
    spans.sort(key=lambda item: (item["start"], item["end"]))
    return spans


def _segment_text(text: str, artifact_spans: list[dict[str, Any]]) -> list[dict[str, Any]]:
    boundaries = [0]
    for match in re.finditer(r"[.!?]+(?:\s+|$)|\n+", text):
        boundaries.append(match.end())
    if boundaries[-1] != len(text):
        boundaries.append(len(text))

    segments: list[dict[str, Any]] = []
    for start, end in zip(boundaries, boundaries[1:]):
        segment_text = text[start:end].strip()
        if not segment_text:
            continue
        segment_id = f"segment:{len(segments)}"
        segments.append(
            {
                "id": segment_id,
                "index": len(segments),
                "start": start,
                "end": end,
                "text": segment_text,
                "token_count": len(WORD_RE.findall(segment_text)),
                "artifact_span_ids": [
                    span["id"]
                    for span in artifact_spans
                    if not (span["end"] <= start or span["start"] >= end)
                ],
            }
        )
    return segments


def _infer_context_tags(title: str, clean_body: str, metadata: dict[str, Any]) -> list[str]:
    explicit: list[str] = []
    for key in ("context", "contexts"):
        raw = metadata.get(key)
        if isinstance(raw, list):
            explicit.extend(str(item).strip().lower() for item in raw if str(item).strip())
        elif isinstance(raw, str) and raw.strip():
            explicit.extend(item.lower() for item in _split_csvish(raw))

    if explicit:
        return sorted(set(explicit))

    haystack = f"{title} {clean_body}".lower()
    tag_scores: list[tuple[str, int, int]] = []
    for tag, keywords in CONTEXT_MAP.items():
        score = 0
        unique_hits = 0
        for keyword in keywords:
            hits = _keyword_occurrences(haystack, keyword)
            if hits <= 0:
                continue
            unique_hits += 1
            score += hits * (2 if " " in keyword else 1)
        if score > 0:
            tag_scores.append((tag, score, unique_hits))
    tag_scores.sort(key=lambda item: (-item[1], -item[2], item[0]))

    tags: list[str] = []
    top_score = tag_scores[0][1] if tag_scores else 0
    for tag, score, unique_hits in tag_scores:
        has_breadth = unique_hits >= 2 and score >= 3
        has_depth = score >= 6
        stays_competitive = top_score == 0 or score >= max(2, int(top_score * 0.2))
        if (has_breadth or has_depth) and stays_competitive:
            tags.append(tag)
        if len(tags) >= 4:
            break
    if not tags:
        tags.append("general-reflection")
    return sorted(set(tags))


def _infer_language(metadata: dict[str, Any], clean_body: str) -> str:
    raw = metadata.get("language") or metadata.get("lang")
    if isinstance(raw, str) and raw.strip():
        return raw.strip().lower()
    ascii_ratio = sum(char.isascii() for char in clean_body) / max(1, len(clean_body))
    return "en" if ascii_ratio > 0.95 else "und"


def _speaker_line_count(body: str) -> int:
    count = 0
    for line in body.splitlines():
        stripped = line.strip()
        if re.match(r"^([A-Za-z][A-Za-z0-9 _-]{0,20}|me|speaker \d+):\s", stripped, re.IGNORECASE):
            count += 1
        elif re.match(r"^\[[^\]]+\]\s", stripped):
            count += 1
    return count


def _infer_mode(metadata: dict[str, Any], body: str, clean_body: str, artifact_spans: list[dict[str, Any]]) -> str:
    explicit = str(metadata.get("analysis_mode") or metadata.get("mode") or "").strip().lower()
    if explicit in {"transcript", "speech", "spoken"}:
        return "transcript"
    if explicit in {"note", "written", "journal"}:
        return "note"

    filler_count = sum(1 for span in artifact_spans if span["kind"] == "filler")
    speaker_lines = _speaker_line_count(body)
    transcript_markers = filler_count + speaker_lines
    transcript_markers += len(re.findall(r"\b(um|uh|you know|i mean)\b", clean_body.lower()))
    transcript_markers += len(re.findall(r"\b([A-Za-z]{1,6})-\s*[A-Za-z]{1,20}\b", body))
    return "transcript" if transcript_markers >= 3 else "note"


def load_markdown_source(path: str | Path) -> dict[str, Any]:
    source_path = Path(path).resolve()
    raw_text = source_path.read_text(encoding="utf-8")
    metadata, body = parse_frontmatter(raw_text)
    title = str(metadata.get("title") or _infer_title(body, source_path)).strip() or "Untitled"
    analysis_body = _extract_analysis_body(body)
    analysis_body = re.sub(r"^\s*#\s+.*(?:\n|$)", "", analysis_body, count=1)
    clean_body = _strip_markdown(analysis_body)
    artifact_spans = _find_artifacts(clean_body)
    segments = _segment_text(clean_body, artifact_spans)
    language = _infer_language(metadata, clean_body)
    mode = _infer_mode(metadata, body, clean_body, artifact_spans)
    tags_raw = metadata.get("tags", [])
    if isinstance(tags_raw, str):
        tags = _split_csvish(tags_raw)
    elif isinstance(tags_raw, list):
        tags = [str(item).strip() for item in tags_raw if str(item).strip()]
    else:
        tags = []
    contexts = _infer_context_tags(title, clean_body, metadata)
    date = metadata.get("date") or metadata.get("created_at")
    return {
        "path": str(source_path),
        "title": title,
        "analysis_mode": mode,
        "language": language,
        "date": str(date).strip() if date else None,
        "tags": tags,
        "contexts": contexts,
        "raw_body": analysis_body,
        "clean_body": clean_body,
        "word_count": len(WORD_RE.findall(clean_body)),
        "artifact_spans": artifact_spans,
        "segments": segments,
        "metadata": metadata,
        "language_eligible": language in DEFAULT_LANGUAGE_ALLOWLIST,
        "transcript_source": "transcribed_markdown" if metadata.get("transcription_model") or metadata.get("source_media") else "manual_markdown",
    }
