from __future__ import annotations

import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "raw"
NORMALIZED_DIR = ROOT / "normalized"
RUNS_DIR = ROOT / "runs"
ARCHIVE_DIR = ROOT / "archive"
EXPERIMENT_ARCHIVE_DIR = ARCHIVE_DIR / "experiments"
HEURISTICS_ARCHIVE_DIR = ARCHIVE_DIR / "heuristics"
SEEDED_CSV = ROOT / "Letterly-export-2026-03-13_2202.csv"
NORMALIZED_NOTES_PATH = NORMALIZED_DIR / "notes.json"
NORMALIZED_INDEX_PATH = NORMALIZED_DIR / "index.json"
RUN_INDEX_PATH = RUNS_DIR / "index.json"
ARCHIVE_INDEX_PATH = EXPERIMENT_ARCHIVE_DIR / "index.json"


def ensure_dirs() -> None:
    for directory in (
        RAW_DIR,
        NORMALIZED_DIR,
        RUNS_DIR,
        ARCHIVE_DIR,
        EXPERIMENT_ARCHIVE_DIR,
        HEURISTICS_ARCHIVE_DIR,
    ):
        directory.mkdir(parents=True, exist_ok=True)


def discover_sources() -> list[Path]:
    ensure_dirs()
    sources = sorted(RAW_DIR.glob("*.csv"))
    if SEEDED_CSV.exists():
        sources.append(SEEDED_CSV)
    return list(dict.fromkeys(sources))


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=False) + "\n",
        encoding="utf-8",
    )


def run_dir(run_id: str) -> Path:
    return RUNS_DIR / run_id


def archived_run_dir(run_id: str) -> Path:
    return EXPERIMENT_ARCHIVE_DIR / run_id


def list_runs() -> list[dict[str, Any]]:
    return read_json(RUN_INDEX_PATH, [])


def list_archived_runs() -> list[dict[str, Any]]:
    return read_json(ARCHIVE_INDEX_PATH, [])


def update_run_index(records: list[dict[str, Any]]) -> None:
    write_json(RUN_INDEX_PATH, records)


def update_archive_index(records: list[dict[str, Any]]) -> None:
    write_json(ARCHIVE_INDEX_PATH, records)


def latest_run_id() -> str | None:
    runs = list_runs()
    if not runs:
        return None
    return runs[0]["id"]
