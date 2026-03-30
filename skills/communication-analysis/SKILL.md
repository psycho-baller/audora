---
name: communication-analysis
description: Analyze a single markdown transcript or written note into a dense communication coaching report. Use this whenever the user wants one `.md` file turned into practical feedback about speech flaws, vocabulary overuse, clarity gaps, persuasion weaknesses, rambling, hedging, weak structure, or communication habits. Trigger on requests to analyze a transcript, inspect a spoken note, review a reflection for communication problems, extract vocabulary lessons, or generate a text-only communication forensics report instead of a dashboard.
---

# Communication Analysis

This skill does one job: it takes one markdown source file and writes a full communication analysis beside it.

Prefer this skill when the task is "read one markdown file and tell me what is weak, what is overused, what is strong, and how to improve it." Do not use it for folders; the orchestrator handles that.

## What to run
- Use `scripts/analyze_file.py` for the actual analysis.
- The script writes:
- `analysis/<same-name>.md`
- `analysis/<same-name>.json`

## Source rules
- Accept only markdown input.
- Optional YAML frontmatter keys:
- `analysis_mode`
- `title`
- `date`
- `tags`
- `context`
- `language`
- If frontmatter is missing, let the script infer transcript vs note mode.

## Output expectations
- The markdown report must include:
- Snapshot
- Executive Diagnosis
- Highest-Leverage Gaps
- Vocabulary Pressure Points
- Sentence Upgrade Lab
- Counterexamples And Strengths
- Practice Systems
- Daily Activation Loop
- Evidence Appendix
- The JSON artifact is the structured contract used by the other skills. Do not skip it.
- Keep the report evidence-bound. Quote the supporting excerpt for each major finding.
- Stay honest about limits: transcript-only analysis can infer wording habits, not prosody or vocal tone.
- Prefer practical coaching over abstract personality judgments.

## Runtime notes
- The runtime is in `scripts/communication_runtime/`.
- Deterministic analysis always runs.
- If `OPENAI_API_KEY` is present and `COMMUNICATION_SKILL_ENABLE_LLM` is not `0`, the script adds sharper wording and coaching refinements.
- If you are asked to improve the skill itself, run the script on the real target file, inspect the generated markdown and JSON, identify weak output quality, then tighten the runtime or this skill description and rerun.

## References
- Read `references/report-contract.md` only if you need the exact output contract while reasoning about the skill.
