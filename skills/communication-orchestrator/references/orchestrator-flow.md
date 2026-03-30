# Orchestrator Flow

`orchestrate.py` is the entrypoint.

Routing:
- markdown file -> `communication-analysis/scripts/analyze_file.py`
- folder -> discover markdown files, analyze missing files, then `communication-summary/scripts/summarize_folder.py`

Skip directories:
- `analysis`
- `repairs`
- `.git`
- `node_modules`
- `__pycache__`
