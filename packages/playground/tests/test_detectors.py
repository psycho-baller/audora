from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from transcript_lab.analysis import run_experiment
from transcript_lab.ingest import ingest_sources


CSV_FIXTURE = """id,type,rewrite_id,rewrite_type,lang,title,text,tags,created_at,updated_at,created_timestamp_ms,updated_timestamp_ms
1,note,0,,en,Hedged Pitch,"I think maybe this thing could help founders because it is kind of useful.",,01.01.2026 10:00:00,01.01.2026 10:00:00,1704103200000,1704103200000
2,note,0,,en,Direct Pitch,"Founders lose deals when the pitch sounds uncertain. I fix that with targeted drills.",,01.01.2026 11:00:00,01.01.2026 11:00:00,1704106800000,1704106800000
3,note,0,,en,Drifting Answer,"First I want to talk about the problem. Anyway, back to what I was saying. Another thing is unrelated.",,01.01.2026 12:00:00,01.01.2026 12:00:00,1704110400000,1704110400000
4,note,0,,en,Stressed Note,"I am afraid and I feel like a failure. Everyone can see I messed up.",,01.01.2026 13:00:00,01.01.2026 13:00:00,1704114000000,1704114000000
"""


class DetectorTests(unittest.TestCase):
    def test_expected_dimensions_surface(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            fixture = Path(temp_dir) / "fixture.csv"
            fixture.write_text(CSV_FIXTURE, encoding="utf-8")
            ingest_sources([fixture])
            run = run_experiment({"name": "detector-fixture"})
            findings = {finding["dimension"]: finding for finding in run["findings"] if finding["scope"] == "corpus"}
            self.assertIn("hedging_vagueness", findings)
            self.assertIn("coherence_topic_drift", findings)
            self.assertIn("stress_self_protection", findings)
            self.assertGreater(findings["hedging_vagueness"]["severity"], 20)


if __name__ == "__main__":
    unittest.main()
