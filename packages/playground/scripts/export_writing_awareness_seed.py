#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from transcript_lab.storage import RUNS_DIR, latest_run_id, read_json


TOKEN_PATTERN = re.compile(r"[A-Za-z][A-Za-z-]*")
EXCLUDED_TARGET_PREFIXES = {"remove", "choose", "use", "drop", "pause"}


@dataclass
class VocabularyReplacementOption:
    word: str
    useWhen: str
    caution: str


@dataclass
class VocabularyRule:
    id: str
    type: str
    term: str
    replacementOptions: list[VocabularyReplacementOption]
    contexts: list[str]
    source: str
    active: bool
    priority: int
    notes: str
    family: str
    pinned: bool


@dataclass
class FocusTemplate:
    family: str
    targetWords: list[str]
    bannedTerms: list[str]
    triggerQuestion: str
    exampleRewrite: str


def _slug(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return cleaned or "term"


def _parse_terms(label: str) -> list[str]:
    candidates = [
        part.strip().lower()
        for part in re.split(r"\s*/\s*", label)
        if part.strip()
    ]
    unique: list[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        if candidate not in seen:
            unique.append(candidate)
            seen.add(candidate)
    return unique


def _priority(overuse_score: float) -> int:
    return max(1, min(5, round(overuse_score / 20)))


def _single_target_candidates(replacement_options: list[dict[str, Any]]) -> list[str]:
    values: list[str] = []
    for option in replacement_options:
        candidate = option.get("word", "").strip()
        if not candidate:
            continue
        tokens = TOKEN_PATTERN.findall(candidate)
        if len(tokens) != 1:
            continue
        if tokens[0].lower() in EXCLUDED_TARGET_PREFIXES:
            continue
        values.append(tokens[0].lower())
    return values


def _top_context_words(target: dict[str, Any], banks: list[dict[str, Any]], count: int = 3) -> list[str]:
    dominant_contexts = [item["label"] for item in target.get("contexts", [])[:2]]
    bank_map = {bank["context"]: bank["words"] for bank in banks}
    results: list[str] = []
    seen: set[str] = set()
    for context in dominant_contexts:
        for entry in bank_map.get(context, []):
            word = entry["word"].strip().lower()
            if word in seen:
                continue
            seen.add(word)
            results.append(word)
            if len(results) >= count:
                return results
    return results


def _make_focus_template(target: dict[str, Any], banks: list[dict[str, Any]]) -> FocusTemplate:
    banned_terms = _parse_terms(target["source"])[:2]
    direct_targets = _single_target_candidates(target.get("replacementOptions", []))
    fallback_targets = _top_context_words(target, banks, count=5)
    target_words = (direct_targets + fallback_targets)[:5]
    if len(target_words) < 3:
        target_words = (target_words + ["clarity", "signal", "specificity"])[:3]
    learning_lines = target.get("learningSystem", [])
    trigger_question = learning_lines[0] if learning_lines else (
        f"When you catch '{banned_terms[0]}', what exact role, object, action, or constraint do you mean?"
    )
    sample = target.get("sampleRewrites", [])
    if sample:
        rewrite = sample[0]
        example_rewrite = f"{rewrite['original']} -> {rewrite['rewritten']}"
    else:
        example_rewrite = target.get("why_it_limits_you", "")
    return FocusTemplate(
        family=target["id"],
        targetWords=target_words,
        bannedTerms=banned_terms,
        triggerQuestion=trigger_question,
        exampleRewrite=example_rewrite,
    )


def _build_rules(targets: list[dict[str, Any]], banks: list[dict[str, Any]]) -> list[VocabularyRule]:
    rules: list[VocabularyRule] = []
    seen_ids: set[str] = set()

    for target in targets:
        contexts = [item["label"] for item in target.get("contexts", [])]
        replacement_options = [
            VocabularyReplacementOption(
                word=option["word"],
                useWhen=option["useWhen"],
                caution=option["caution"],
            )
            for option in target.get("replacementOptions", [])
        ]
        for term in _parse_terms(target["source"]):
            rule_id = f"avoid:{target['id']}:{_slug(term)}"
            if rule_id in seen_ids:
                continue
            seen_ids.add(rule_id)
            rules.append(
                VocabularyRule(
                    id=rule_id,
                    type="avoid",
                    term=term,
                    replacementOptions=replacement_options,
                    contexts=contexts,
                    source="corpus-derived",
                    active=True,
                    priority=_priority(target.get("overuseScore", 50.0)),
                    notes=target.get("why_it_limits_you", ""),
                    family=target["id"],
                    pinned=False,
                )
            )

        for word in _single_target_candidates(target.get("replacementOptions", [])):
            rule_id = f"target:{target['id']}:{_slug(word)}"
            if rule_id in seen_ids:
                continue
            seen_ids.add(rule_id)
            option = next(
                (item for item in target.get("replacementOptions", []) if item["word"].lower().startswith(word)),
                {"useWhen": target.get("why_it_limits_you", ""), "caution": ""},
            )
            rules.append(
                VocabularyRule(
                    id=rule_id,
                    type="target",
                    term=word,
                    replacementOptions=[
                        VocabularyReplacementOption(
                            word=word,
                            useWhen=option.get("useWhen", ""),
                            caution=option.get("caution", ""),
                        )
                    ],
                    contexts=contexts,
                    source="corpus-derived",
                    active=True,
                    priority=max(1, _priority(target.get("overuseScore", 50.0)) - 1),
                    notes=f"Derived from {target['label']}",
                    family=target["id"],
                    pinned=False,
                )
            )

    for bank in banks:
        context = bank["context"]
        for entry in bank.get("words", []):
            word = entry["word"].strip().lower()
            rule_id = f"target:bank:{_slug(context)}:{_slug(word)}"
            if rule_id in seen_ids:
                continue
            seen_ids.add(rule_id)
            rules.append(
                VocabularyRule(
                    id=rule_id,
                    type="target",
                    term=word,
                    replacementOptions=[
                        VocabularyReplacementOption(
                            word=word,
                            useWhen=entry["useWhen"],
                            caution="Keep the word only when it names the exact thing you mean.",
                        )
                    ],
                    contexts=[context],
                    source="corpus-derived",
                    active=True,
                    priority=2,
                    notes=entry["example"],
                    family=f"context:{context}",
                    pinned=False,
                )
            )

    rules.sort(key=lambda rule: (-rule.priority, rule.type, rule.family, rule.term))
    return rules


def _load_run(run_id: str) -> dict[str, Any]:
    run_path = RUNS_DIR / run_id / "run.json"
    if not run_path.exists():
        raise FileNotFoundError(f"Run not found: {run_path}")
    return read_json(run_path, {})


def build_seed(run_id: str) -> dict[str, Any]:
    run = _load_run(run_id)
    vocabulary = run.get("vocabulary", {})
    targets = vocabulary.get("targets", [])
    banks = vocabulary.get("banks", [])
    focus_templates = [_make_focus_template(target, banks) for target in targets]
    rules = _build_rules(targets, banks)
    return {
        "sourceRunId": run["id"],
        "generatedAt": run["created_at"],
        "rules": [asdict(rule) for rule in rules],
        "focusTemplates": [asdict(template) for template in focus_templates],
        "contextWordBanks": banks,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export a writing-awareness seed for Audora writing-awareness clients."
    )
    parser.add_argument("--run-id", help="Specific playground run to export. Defaults to the latest run.")
    parser.add_argument(
        "--output",
        action="append",
        help="Destination JSON path. Can be provided multiple times.",
    )
    args = parser.parse_args()

    run_id = args.run_id or latest_run_id()
    if not run_id:
        raise SystemExit("No runs available to export.")

    payload = build_seed(run_id)
    default_outputs = [
        Path(__file__).resolve().parents[3]
        / "apps"
        / "macos"
        / "audora"
        / "Resources"
        / "WritingAwarenessSeed.json",
        Path(__file__).resolve().parents[3]
        / "apps"
        / "browser-extension"
        / "public"
        / "WritingAwarenessSeed.json",
    ]
    outputs = [Path(item).resolve() for item in args.output] if args.output else default_outputs

    for output_path in outputs:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"Exported writing-awareness seed from {run_id} to {output_path}")


if __name__ == "__main__":
    main()
