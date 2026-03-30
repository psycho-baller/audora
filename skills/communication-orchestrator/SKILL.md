---
name: communication-orchestrator
description: Route a markdown file or a folder through the communication skill suite automatically. Use this whenever the user points at a path and wants the system to figure out whether to run single-file communication analysis or folder-level communication summarization without making the user choose the flow manually.
---

# Communication Orchestrator

This is the normal entry skill for users.

## What to run
- Use `scripts/orchestrate.py`.

## Behavior
- If the target is one markdown file:
- Run the analysis skill on that file.
- If the target is one folder:
- Discover markdown files recursively.
- Skip `analysis/`, `repairs/`, `.git/`, `node_modules/`, and `__pycache__/`.
- Create missing per-file analysis artifacts automatically.
- Then run the summary skill on the folder.

## Defaults
- Do not ask the user to choose file vs folder mode.
- Skip already analyzed files unless the caller explicitly passes `--force`.

## References
- Read `references/orchestrator-flow.md` if you need the exact routing rules.

