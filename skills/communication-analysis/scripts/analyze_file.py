from __future__ import annotations

import argparse
import json
from pathlib import Path

from communication_runtime.engine import build_analysis_report
from communication_runtime.render import render_markdown_report, write_report_files


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze one markdown transcript or note into markdown + JSON reports.")
    parser.add_argument("source_path", help="Absolute or relative path to a markdown file")
    args = parser.parse_args()

    source_path = Path(args.source_path).resolve()
    if not source_path.exists():
        raise SystemExit(f"Source file not found: {source_path}")
    if source_path.suffix.lower() != ".md":
        raise SystemExit(f"Source file must be markdown: {source_path}")

    report = build_analysis_report(source_path)
    markdown = render_markdown_report(report)
    markdown_path, json_path = write_report_files(report, markdown)
    print(
        json.dumps(
            {
                "ok": True,
                "source": str(source_path),
                "analysis_markdown_path": str(markdown_path),
                "analysis_json_path": str(json_path),
                "mode": report["source"]["analysis_mode"],
                "top_findings": [finding["label"] for finding in report["findings"][:3]],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
