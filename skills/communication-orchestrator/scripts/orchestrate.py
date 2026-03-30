from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
ANALYZE_SCRIPT = REPO_ROOT / "skills" / "communication-analysis" / "scripts" / "analyze_file.py"
SUMMARY_SCRIPT = REPO_ROOT / "skills" / "communication-summary" / "scripts" / "summarize_folder.py"
SKIP_DIRS = {"analysis", "repairs", ".git", "node_modules", "__pycache__"}


def _run_script(script: Path, target: Path) -> dict:
    result = subprocess.run(
        [sys.executable, str(script), str(target)],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def _discover_markdown_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for path in root.rglob("*.md"):
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        files.append(path)
    return sorted(files)


def _analysis_artifacts_exist(source: Path) -> bool:
    output_dir = source.parent / "analysis"
    return (output_dir / f"{source.stem}.md").exists() and (output_dir / f"{source.stem}.json").exists()


def orchestrate(target: Path, force: bool = False) -> dict:
    target = target.resolve()
    if not target.exists():
        raise SystemExit(f"Target does not exist: {target}")

    if target.is_file():
        if target.suffix.lower() != ".md":
            raise SystemExit(f"Target must be a markdown file: {target}")
        result = _run_script(ANALYZE_SCRIPT, target)
        return {"ok": True, "mode": "file", "analyzed": [result], "summary": None}

    markdown_files = _discover_markdown_files(target)
    if not markdown_files:
        raise SystemExit(f"No markdown files found under {target}")

    analyzed: list[dict] = []
    skipped: list[str] = []
    for path in markdown_files:
        if not force and _analysis_artifacts_exist(path):
            skipped.append(str(path))
            continue
        analyzed.append(_run_script(ANALYZE_SCRIPT, path))

    summary = _run_script(SUMMARY_SCRIPT, target)
    return {
        "ok": True,
        "mode": "folder",
        "analyzed": analyzed,
        "skipped": skipped,
        "summary": summary,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Route a file or folder through the communication analysis skill suite.")
    parser.add_argument("target_path", help="Markdown file or folder to analyze")
    parser.add_argument("--force", action="store_true", help="Rebuild per-file analysis even when artifacts already exist")
    args = parser.parse_args()

    payload = orchestrate(Path(args.target_path), force=args.force)
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
