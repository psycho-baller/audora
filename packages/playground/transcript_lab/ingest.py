from __future__ import annotations

import csv
import re
from collections import Counter
from pathlib import Path
from typing import Iterable

from .constants import CONTEXT_MAP, DEFAULT_LANGUAGE_ALLOWLIST, FILLERS
from .schemas import ArtifactSpan, Segment, TranscriptNote
from .storage import (
    NORMALIZED_INDEX_PATH,
    NORMALIZED_NOTES_PATH,
    discover_sources,
    write_json,
)

WORD_RE = re.compile(r"[A-Za-z']+")


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _find_artifacts(note_id: str, raw_text: str) -> list[ArtifactSpan]:
    spans: list[ArtifactSpan] = []
    patterns = [
        ("ellipsis", re.compile(r"\.\.\.")),
        ("dash_fragment", re.compile(r"\b[A-Za-z]{1,15}-\b|--+")),
        ("repeat_token", re.compile(r"\b([A-Za-z']{1,15})\s+\1\b", re.IGNORECASE)),
        ("stutter_restart", re.compile(r"\b([A-Za-z]{1,6})-\s*[A-Za-z]{1,20}\b")),
    ]
    for kind, pattern in patterns:
        for index, match in enumerate(pattern.finditer(raw_text)):
            spans.append(
                ArtifactSpan(
                    id=f"{note_id}:artifact:{kind}:{index}",
                    kind=kind,
                    start=match.start(),
                    end=match.end(),
                    text=match.group(0),
                )
            )

    lowered = raw_text.lower()
    for filler in FILLERS:
        pattern = re.compile(rf"(?<![A-Za-z]){re.escape(filler)}(?![A-Za-z])")
        for index, match in enumerate(pattern.finditer(lowered)):
            spans.append(
                ArtifactSpan(
                    id=f"{note_id}:artifact:filler:{filler}:{index}",
                    kind="filler",
                    start=match.start(),
                    end=match.end(),
                    text=raw_text[match.start() : match.end()],
                    metadata={"token": filler},
                )
            )
    spans.sort(key=lambda span: (span.start, span.end))
    return spans


def _segment_text(note_id: str, raw_text: str, artifact_spans: list[ArtifactSpan]) -> list[Segment]:
    boundaries = [0]
    for match in re.finditer(r"[.!?]+(?:\s+|$)|\n+", raw_text):
        boundaries.append(match.end())
    if boundaries[-1] != len(raw_text):
        boundaries.append(len(raw_text))

    segments: list[Segment] = []
    for index, (start, end) in enumerate(zip(boundaries, boundaries[1:])):
        text = raw_text[start:end].strip()
        if not text:
            continue
        segment_artifacts = [
            span.id
            for span in artifact_spans
            if not (span.end <= start or span.start >= end)
        ]
        segments.append(
            Segment(
                id=f"{note_id}:segment:{len(segments)}",
                note_id=note_id,
                index=len(segments),
                start=start,
                end=end,
                text=text,
                token_count=len(WORD_RE.findall(text)),
                artifact_span_ids=segment_artifacts,
            )
        )
    return segments


def _infer_context_tags(title: str, clean_text: str) -> list[str]:
    haystack = f"{title} {clean_text}".lower()
    tokens = set(WORD_RE.findall(haystack))
    tags: list[str] = []
    for tag, keywords in CONTEXT_MAP.items():
        if tokens.intersection({word.lower().replace(" ", "") for word in keywords}):
            tags.append(tag)
            continue
        for keyword in keywords:
            if keyword in haystack:
                tags.append(tag)
                break
    if not tags:
        tags.append("general-reflection")
    return sorted(set(tags))


def _language_confidence(language: str) -> float:
    if language.lower() in DEFAULT_LANGUAGE_ALLOWLIST:
        return 1.0
    if language.lower() == "und":
        return 0.45
    return 0.65


def _parse_csv(path: Path) -> list[TranscriptNote]:
    notes: list[TranscriptNote] = []
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            raw_text = row.get("text", "") or ""
            clean_text = _normalize_text(raw_text)
            note_id = row.get("id", "") or f"unknown-{len(notes)}"
            artifacts = _find_artifacts(note_id, raw_text)
            segments = _segment_text(note_id, raw_text, artifacts)
            tags = [tag for tag in (row.get("tags", "") or "").split(",") if tag]
            language = (row.get("lang", "") or "und").lower()
            note = TranscriptNote(
                id=note_id,
                note_type=row.get("type", "") or "note",
                rewrite_id=row.get("rewrite_id") or None,
                rewrite_type=row.get("rewrite_type") or None,
                language=language,
                title=row.get("title", "") or "Untitled",
                raw_text=raw_text,
                clean_text=clean_text,
                tags=tags,
                created_at=row.get("created_at") or None,
                updated_at=row.get("updated_at") or None,
                created_timestamp_ms=int(row["created_timestamp_ms"]) if row.get("created_timestamp_ms") else None,
                updated_timestamp_ms=int(row["updated_timestamp_ms"]) if row.get("updated_timestamp_ms") else None,
                source_file=path.name,
                word_count=len(WORD_RE.findall(clean_text)),
                artifact_spans=artifacts,
                segments=segments,
                context_tags=_infer_context_tags(row.get("title", "") or "", clean_text),
                language_confidence=_language_confidence(language),
            )
            notes.append(note)
    return notes


def ingest_sources(paths: Iterable[Path] | None = None) -> dict:
    source_paths = list(paths or discover_sources())
    all_notes: list[TranscriptNote] = []
    for path in source_paths:
        all_notes.extend(_parse_csv(path))

    all_notes.sort(
        key=lambda note: (
            note.created_timestamp_ms or 0,
            note.updated_timestamp_ms or 0,
            0 if note.id.isdigit() else 1,
            int(note.id) if note.id.isdigit() else note.id,
        )
    )

    payload = [note.to_dict() for note in all_notes]
    language_counts = Counter(note.language for note in all_notes)
    context_counts = Counter(tag for note in all_notes for tag in note.context_tags)
    index = {
        "noteCount": len(all_notes),
        "sourceFiles": [path.name for path in source_paths],
        "languageCounts": dict(sorted(language_counts.items())),
        "topContexts": context_counts.most_common(12),
    }
    write_json(NORMALIZED_NOTES_PATH, payload)
    write_json(NORMALIZED_INDEX_PATH, index)
    return {"notes": payload, "index": index}
