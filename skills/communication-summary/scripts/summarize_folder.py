from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _discover_reports(root: Path) -> list[dict[str, Any]]:
    reports = []
    for path in sorted(root.rglob("analysis/*.json")):
        if path.name == "index.json":
            continue
        try:
            report = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        if "source" not in report or "findings" not in report:
            continue
        reports.append(report)
    return reports


def _relative(root: Path, target: str | Path) -> str:
    return str(Path(target).resolve().relative_to(root.resolve()))


def build_summary(root: Path) -> dict[str, Any]:
    reports = _discover_reports(root)
    if not reports:
        raise SystemExit(f"No analysis artifacts found under {root}")

    finding_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    vocabulary_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    context_counter: Counter[str] = Counter()
    file_priorities: list[dict[str, Any]] = []
    strengths: list[dict[str, Any]] = []
    evidence: list[dict[str, Any]] = []

    for report in reports:
        source = report["source"]
        report_path = source["analysis_markdown_path"]
        contexts = source.get("contexts", [])
        context_counter.update(contexts)
        strongest_finding = report["findings"][0] if report["findings"] else None
        file_priorities.append(
            {
                "title": source["title"],
                "source_path": source["path"],
                "report_path": report_path,
                "top_finding": strongest_finding["label"] if strongest_finding else "No major drag",
                "top_severity": strongest_finding["severity"] if strongest_finding else 0,
                "mode": source["analysis_mode"],
            }
        )
        for finding in report.get("findings", []):
            finding_groups[finding["dimension"]].append(
                {
                    "label": finding["label"],
                    "severity": finding["severity"],
                    "why_it_matters": finding["why_it_matters"],
                    "source_title": source["title"],
                    "report_path": report_path,
                }
            )
        for target in report.get("vocabulary", []):
            vocabulary_groups[target["id"]].append(
                {
                    "label": target["label"],
                    "total_occurrences": target["totalOccurrences"],
                    "why_it_limits_you": target["why_it_limits_you"],
                    "source_title": source["title"],
                    "report_path": report_path,
                }
            )
        for strength in report.get("strengths", []):
            if strength.get("kind") == "counterexample":
                strengths.append(
                    {
                        "title": source["title"],
                        "report_path": report_path,
                        "label": strength["label"],
                        "score": strength["score"],
                        "explanation": strength["explanation"],
                        "evidence_text": strength.get("evidence_text", ""),
                    }
                )
        for item in report.get("evidence", [])[:2]:
            evidence.append(
                {
                    "source_title": source["title"],
                    "report_path": report_path,
                    "label": item["label"],
                    "text": item["text"],
                    "rationale": item["rationale"],
                }
            )

    recurring_findings = []
    for dimension, items in finding_groups.items():
        avg_severity = sum(item["severity"] for item in items) / len(items)
        recurring_findings.append(
            {
                "id": f"summary:{dimension}",
                "dimension": dimension,
                "label": items[0]["label"],
                "severity": round(avg_severity, 1),
                "affected_files": len(items),
                "why_it_matters": items[0]["why_it_matters"],
                "examples": items[:3],
            }
        )
    recurring_findings.sort(key=lambda item: (-item["affected_files"], -item["severity"], item["label"]))

    recurring_vocabulary = []
    for target_id, items in vocabulary_groups.items():
        total_occurrences = sum(item["total_occurrences"] for item in items)
        recurring_vocabulary.append(
            {
                "id": f"summary:vocab:{target_id}",
                "target_id": target_id,
                "label": items[0]["label"],
                "total_occurrences": total_occurrences,
                "affected_files": len(items),
                "why_it_limits_you": items[0]["why_it_limits_you"],
                "examples": items[:3],
            }
        )
    recurring_vocabulary.sort(key=lambda item: (-item["affected_files"], -item["total_occurrences"], item["label"]))

    file_priorities.sort(key=lambda item: (-item["top_severity"], item["title"]))
    strengths.sort(key=lambda item: item["score"], reverse=True)

    weekly_priorities = []
    for finding in recurring_findings[:2]:
        weekly_priorities.append(
            f"{finding['label']} ({finding['affected_files']} {'file' if finding['affected_files'] == 1 else 'files'}): {finding['why_it_matters']}"
        )
    for vocab in recurring_vocabulary[:1]:
        weekly_priorities.append(
            f"Replace {vocab['label'].lower()} ({vocab['affected_files']} {'file' if vocab['affected_files'] == 1 else 'files'}): {vocab['why_it_limits_you']}"
        )

    output_dir = root / "analysis"
    summary = {
        "source": {
            "path": str(root.resolve()),
            "title": root.name,
            "analysis_mode": "folder",
            "language": "mixed",
            "date": None,
            "tags": [],
            "contexts": [label for label, _ in context_counter.most_common(6)],
            "word_count": 0,
            "analysis_markdown_path": str((output_dir / "index.md").resolve()),
            "analysis_json_path": str((output_dir / "index.json").resolve()),
        },
        "summary": {
            "executive_diagnosis": f"The folder shows recurring pressure around {recurring_findings[0]['label'].lower() if recurring_findings else 'communication clarity'} and repeated vocabulary drag from {recurring_vocabulary[0]['label'].lower() if recurring_vocabulary else 'generic wording'}.",
            "weekly_theme": weekly_priorities[0] if weekly_priorities else "Consolidate the recurring patterns before expanding the scope of practice.",
            "snapshot": {
                "file_count": len(reports),
                "contexts": [label for label, _ in context_counter.most_common(6)],
                "report_count": len(reports),
            },
        },
        "findings": recurring_findings[:6],
        "vocabulary": recurring_vocabulary[:6],
        "strengths": strengths[:5],
        "practice_systems": [
            {
                "id": f"summary:practice:{index}",
                "title": f"Weekly priority {index + 1}",
                "scenario_prompt": item,
                "rubric": ["Review the linked files first.", "Pick one repeated weak pattern.", "Practice the upgraded wording in a real sentence."],
                "success_criteria": ["You can name the repeated pattern without looking.", "You can produce one cleaner version on demand.", "The new wording appears in real use within the week."],
            }
            for index, item in enumerate(weekly_priorities[:3])
        ],
        "activation_loop": {
            "weekly_focus": recurring_findings[0]["label"] if recurring_findings else "clarity",
            "trigger_question": "Which repeated weakness is showing up across multiple files here?",
            "ban_terms": [item["label"] for item in recurring_vocabulary[:2]],
            "preload_words": [item["label"] for item in recurring_vocabulary[:2]],
            "daily_loop": weekly_priorities[:3],
            "repair_prompt": "Open the linked file report, repair one sentence, and reuse the stronger wording that day.",
            "contexts": [label for label, _ in context_counter.most_common(4)],
            "repair_targets": [item["label"] for item in recurring_findings[:3]],
        },
        "evidence": evidence[:10],
        "metadata": {
            "generated_at": _now(),
            "report_version": "1.0.0",
            "report_count": len(reports),
            "file_priorities": [
                {
                    **item,
                    "relative_report_path": _relative(root, item["report_path"]),
                    "relative_source_path": _relative(root, item["source_path"]),
                }
                for item in file_priorities
            ],
            "context_counts": context_counter.most_common(),
        },
    }
    return summary


def render_summary_markdown(summary: dict[str, Any], root: Path) -> str:
    lines: list[str] = []
    lines.append(f"# {summary['source']['title']} Communication Summary")
    lines.append("")
    lines.append("## Snapshot")
    lines.append(f"- Folder: `{summary['source']['path']}`")
    lines.append(f"- Files analyzed: {summary['summary']['snapshot']['file_count']}")
    lines.append(f"- Contexts: {', '.join(summary['summary']['snapshot']['contexts']) or 'general-reflection'}")
    lines.append("")
    lines.append("## Executive Diagnosis")
    lines.append(summary["summary"]["executive_diagnosis"])
    lines.append("")
    lines.append(f"Weekly theme: {summary['summary']['weekly_theme']}")
    lines.append("")
    lines.append("## Recurring Communication Gaps")
    for finding in summary["findings"]:
        lines.append(f"### {finding['label']} ({finding['affected_files']} files, avg {finding['severity']}/100)")
        lines.append(finding["why_it_matters"])
        for example in finding["examples"]:
            lines.append(f"- [{example['source_title']}]({Path(_relative(root, example['report_path'])).as_posix()})")
        lines.append("")
    lines.append("## Vocabulary Pressure Points")
    for target in summary["vocabulary"]:
        lines.append(f"### {target['label']} ({target['affected_files']} files, {target['total_occurrences']} hits)")
        lines.append(target["why_it_limits_you"])
        for example in target["examples"]:
            lines.append(f"- [{example['source_title']}]({Path(_relative(root, example['report_path'])).as_posix()})")
        lines.append("")
    lines.append("## Strongest Counterexamples")
    for strength in summary["strengths"]:
        lines.append(f"### {strength['title']} ({strength['score']}/100)")
        lines.append(strength["explanation"])
        if strength.get("evidence_text"):
            lines.append(f"- Evidence: \"{strength['evidence_text']}\"")
        lines.append(f"- Report: [{strength['title']}]({Path(_relative(root, strength['report_path'])).as_posix()})")
        lines.append("")
    lines.append("## Weekly Priorities")
    for practice in summary["practice_systems"]:
        lines.append(f"- {practice['scenario_prompt']}")
    lines.append("")
    lines.append("## File-By-File Priority List")
    for item in summary["metadata"]["file_priorities"]:
        lines.append(
            f"- [{item['title']}]({Path(item['relative_report_path']).as_posix()}): {item['top_finding']} ({item['top_severity']}/100)"
        )
    lines.append("")
    return "\n".join(lines).strip() + "\n"


def write_summary(summary: dict[str, Any]) -> tuple[Path, Path]:
    markdown_path = Path(summary["source"]["analysis_markdown_path"])
    json_path = Path(summary["source"]["analysis_json_path"])
    markdown_path.parent.mkdir(parents=True, exist_ok=True)
    markdown_path.write_text(render_summary_markdown(summary, Path(summary["source"]["path"])), encoding="utf-8")
    json_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return markdown_path, json_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Summarize a folder of communication analysis artifacts.")
    parser.add_argument("folder_path", help="Folder containing markdown sources and analysis artifacts")
    args = parser.parse_args()

    root = Path(args.folder_path).resolve()
    if not root.exists() or not root.is_dir():
        raise SystemExit(f"Folder not found: {root}")

    summary = build_summary(root)
    markdown_path, json_path = write_summary(summary)
    print(
        json.dumps(
            {
                "ok": True,
                "folder": str(root),
                "analysis_markdown_path": str(markdown_path),
                "analysis_json_path": str(json_path),
                "report_count": summary["metadata"]["report_count"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
