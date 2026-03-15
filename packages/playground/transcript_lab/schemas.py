from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class ArtifactSpan:
    id: str
    kind: str
    start: int
    end: int
    text: str
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class Segment:
    id: str
    note_id: str
    index: int
    start: int
    end: int
    text: str
    token_count: int
    artifact_span_ids: list[str] = field(default_factory=list)


@dataclass
class TranscriptNote:
    id: str
    note_type: str
    rewrite_id: str | None
    rewrite_type: str | None
    language: str
    title: str
    raw_text: str
    clean_text: str
    tags: list[str]
    created_at: str | None
    updated_at: str | None
    created_timestamp_ms: int | None
    updated_timestamp_ms: int | None
    source_file: str
    word_count: int
    artifact_spans: list[ArtifactSpan] = field(default_factory=list)
    segments: list[Segment] = field(default_factory=list)
    context_tags: list[str] = field(default_factory=list)
    context_cluster_id: str | None = None
    context_cluster_label: str | None = None
    language_confidence: float = 1.0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class EvidenceSpan:
    id: str
    note_id: str
    note_title: str
    detector: str
    segment_id: str | None
    start: int
    end: int
    text: str
    label: str
    score: float
    confidence: float
    rationale: str
    metrics: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Finding:
    id: str
    dimension: str
    label: str
    scope: str
    severity: float
    confidence: float
    explanation: str
    why_it_matters: str
    hypothesis: str | None = None
    metrics: dict[str, Any] = field(default_factory=dict)
    evidence_span_ids: list[str] = field(default_factory=list)
    counterexample_span_ids: list[str] = field(default_factory=list)
    linked_drill_ids: list[str] = field(default_factory=list)
    affected_note_ids: list[str] = field(default_factory=list)
    context_cluster_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class DrillCard:
    id: str
    weakness_target: str
    title: str
    scenario_prompt: str
    rubric: list[str]
    success_criteria: list[str]
    source_evidence_ids: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class ExperimentRun:
    id: str
    created_at: str
    config: dict[str, Any]
    corpus: dict[str, Any]
    notes: dict[str, Any]
    vocabulary: dict[str, Any]
    findings: list[Finding]
    evidence: list[EvidenceSpan]
    drills: list[DrillCard]
    metrics: dict[str, Any]
    comparisons: dict[str, Any]
    archive_status: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["findings"] = [finding.to_dict() for finding in self.findings]
        payload["evidence"] = [span.to_dict() for span in self.evidence]
        payload["drills"] = [drill.to_dict() for drill in self.drills]
        return payload
