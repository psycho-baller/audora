from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from transcript_lab.analysis import run_experiment
from transcript_lab.ingest import ingest_sources
from transcript_lab.storage import NORMALIZED_NOTES_PATH, read_json


CSV_FIXTURE = """id,type,rewrite_id,rewrite_type,lang,title,text,tags,created_at,updated_at,created_timestamp_ms,updated_timestamp_ms
1,note,0,,en,Fixture One,"Um, I think this thing is... kind of hard. But I will fix it tomorrow.",,01.01.2026 10:00:00,01.01.2026 10:00:00,1704103200000,1704103200000
2,note,0,,und,Fixture Two,"I want to do this but I can't explain it well -- I mean, maybe later.",,01.01.2026 11:00:00,01.01.2026 11:00:00,1704106800000,1704106800000
"""


class IngestTests(unittest.TestCase):
    def test_ingest_creates_notes_and_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            fixture = Path(temp_dir) / "fixture.csv"
            fixture.write_text(CSV_FIXTURE, encoding="utf-8")
            result = ingest_sources([fixture])
            self.assertEqual(result["index"]["noteCount"], 2)
            notes = read_json(NORMALIZED_NOTES_PATH, [])
            self.assertEqual(len(notes), 2)
            self.assertEqual(notes[0]["raw_text"], "Um, I think this thing is... kind of hard. But I will fix it tomorrow.")
            artifact_kinds = {artifact["kind"] for artifact in notes[0]["artifact_spans"]}
            self.assertIn("ellipsis", artifact_kinds)
            self.assertIn("filler", artifact_kinds)

    def test_run_is_stable_for_same_fixture(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            fixture = Path(temp_dir) / "fixture.csv"
            fixture.write_text(CSV_FIXTURE, encoding="utf-8")
            ingest_sources([fixture])
            first = run_experiment({"name": "fixture-baseline"})
            second = run_experiment({"name": "fixture-baseline"})
            first_dims = [finding["dimension"] for finding in first["findings"] if finding["scope"] == "corpus"]
            second_dims = [finding["dimension"] for finding in second["findings"] if finding["scope"] == "corpus"]
            self.assertEqual(first_dims[:4], second_dims[:4])
            self.assertGreaterEqual(second["metrics"]["stability"], 0.8)


if __name__ == "__main__":
    unittest.main()
