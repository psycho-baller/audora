from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def _evidence_lookup(report: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {item["id"]: item for item in report.get("evidence", [])}


def render_markdown_report(report: dict[str, Any]) -> str:
    evidence_by_id = _evidence_lookup(report)
    lines: list[str] = []
    lines.append(f"# {report['source']['title']} Communication Analysis")
    lines.append("")
    lines.append("## Snapshot")
    lines.append(f"- Source: `{report['source']['path']}`")
    lines.append(f"- Mode: `{report['source']['analysis_mode']}`")
    lines.append(f"- Word count: {report['source']['word_count']}")
    lines.append(f"- Contexts: {', '.join(report['source']['contexts']) or 'general-reflection'}")
    lines.append(f"- AI refinement: {'enabled' if report['metadata']['llm']['enabled'] else 'disabled'}")
    lines.append("")
    lines.append("## Executive Diagnosis")
    lines.append(report["summary"]["executive_diagnosis"])
    lines.append("")
    lines.append(f"Weekly theme: {report['summary']['weekly_theme']}")
    lines.append("")
    lines.append("## Highest-Leverage Gaps")
    if report["findings"]:
        for finding in report["findings"]:
            evidence = evidence_by_id.get(finding["evidence_id"])
            lines.append(f"### {finding['label']} ({finding['severity']}/100)")
            lines.append(finding["explanation"])
            lines.append(f"- Why it matters: {finding['why_it_matters']}")
            if finding.get("hypothesis"):
                lines.append(f"- Tentative hypothesis: {finding['hypothesis']}")
            if evidence:
                lines.append(f"- Evidence: \"{evidence['text']}\"")
            lines.append("")
    else:
        lines.append("No major communication drag crossed the reporting threshold in this document.")
        lines.append("")
    lines.append("## Vocabulary Pressure Points")
    if report["vocabulary"]:
        for target in report["vocabulary"]:
            lines.append(f"### {target['label']} ({target['totalOccurrences']} hits)")
            lines.append(target["why_it_limits_you"])
            if target["replacementOptions"]:
                lines.append("- Better options:")
                for option in target["replacementOptions"][:4]:
                    lines.append(f"  - `{option['word']}`: {option['useWhen']}")
            if target["sampleRewrites"]:
                rewrite = target["sampleRewrites"][0]
                lines.append(f"- Rewrite: \"{rewrite['original']}\" -> \"{rewrite['rewritten']}\"")
            if target["learningSystem"]:
                lines.append("- Learning loop:")
                for step in target["learningSystem"][:3]:
                    lines.append(f"  - {step}")
            lines.append("")
    else:
        lines.append("No vocabulary family crossed the current pressure threshold.")
        lines.append("")
    lines.append("## Sentence Upgrade Lab")
    if report.get("sentence_upgrades"):
        for upgrade in report["sentence_upgrades"]:
            lines.append(f"### {upgrade['title']}")
            lines.append(f"- Weak sentence: \"{upgrade['weak_sentence']}\"")
            lines.append(f"- Better version: \"{upgrade['better_sentence']}\"")
            lines.append(f"- Why this is better: {upgrade['why_better']}")
            lines.append(f"- Use this when: {upgrade['use_this_when']}")
            lines.append("- What changed:")
            for item in upgrade["what_changed"]:
                lines.append(f"  - {item}")
            lines.append("")
    else:
        lines.append("No sentence-level upgrades were generated for this document.")
        lines.append("")
    lines.append("## Counterexamples And Strengths")
    if report["strengths"]:
        for strength in report["strengths"]:
            lines.append(f"### {strength['label']} ({strength['score']}/100)")
            lines.append(strength["explanation"])
            if strength.get("evidence_text"):
                lines.append(f"- Evidence: \"{strength['evidence_text']}\"")
            lines.append("")
    else:
        lines.append("No strong counterexample segment was isolated from this document.")
        lines.append("")
    lines.append("## Practice Systems")
    if report["practice_systems"]:
        for practice in report["practice_systems"]:
            lines.append(f"### {practice['title']}")
            lines.append(practice["scenario_prompt"])
            lines.append("- Rubric:")
            for item in practice["rubric"]:
                lines.append(f"  - {item}")
            lines.append("- Success criteria:")
            for item in practice["success_criteria"]:
                lines.append(f"  - {item}")
            lines.append("")
    else:
        lines.append("No practice system was generated because no major gap crossed the threshold.")
        lines.append("")
    lines.append("## Daily Activation Loop")
    lines.append(f"- Weekly focus: {report['activation_loop']['weekly_focus']}")
    lines.append(f"- Trigger question: {report['activation_loop']['trigger_question']}")
    if report["activation_loop"]["ban_terms"]:
        lines.append(f"- Ban terms: {', '.join(report['activation_loop']['ban_terms'])}")
    if report["activation_loop"]["preload_words"]:
        lines.append(f"- Preload words: {', '.join(report['activation_loop']['preload_words'])}")
    lines.append(f"- Repair prompt: {report['activation_loop']['repair_prompt']}")
    lines.append("- Daily loop:")
    for item in report["activation_loop"]["daily_loop"]:
        lines.append(f"  - {item}")
    lines.append("")
    lines.append("## Evidence Appendix")
    if report["evidence"]:
        for item in report["evidence"]:
            lines.append(f"### {item['label']} [{item['sourceType']}]")
            lines.append(f"- Detector: `{item['detector']}`")
            lines.append(f"- Score: {item['score']} | Confidence: {item['confidence']}")
            lines.append(f"- Excerpt: \"{item['text']}\"")
            lines.append(f"- Why it was flagged: {item['rationale']}")
            lines.append("")
    else:
        lines.append("No evidence items were generated.")
        lines.append("")
    return "\n".join(lines).strip() + "\n"


def write_report_files(report: dict[str, Any], markdown: str) -> tuple[Path, Path]:
    markdown_path = Path(report["source"]["analysis_markdown_path"])
    json_path = Path(report["source"]["analysis_json_path"])
    markdown_path.parent.mkdir(parents=True, exist_ok=True)
    markdown_path.write_text(markdown, encoding="utf-8")
    json_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return markdown_path, json_path
