---
name: communication-summary
description: Condense a folder of existing communication analysis artifacts into one folder-level markdown and JSON summary. Use this when the user already has per-file analysis reports and wants recurring weaknesses, vocabulary patterns, strongest counterexamples, or weekly priorities surfaced across a folder.
---

# Communication Summary

This skill is folder-only. It reads existing analysis artifacts and writes one corpus summary for the folder.

## What to run
- Use `scripts/summarize_folder.py`.
- Input is the folder root.
- Output is:
- `analysis/index.md`
- `analysis/index.json`

## Rules
- This skill summarizes existing report artifacts.
- It should not regenerate missing per-file analysis. That is the orchestrator's job.
- The primary input is per-file JSON reports under `analysis/` directories throughout the folder tree.

## Summary focus
- recurring communication gaps
- recurring vocabulary pressure points
- strongest counterexamples
- weekly priorities
- file-by-file priority list

## References
- Read `references/summary-contract.md` only if you need the exact output expectations.

