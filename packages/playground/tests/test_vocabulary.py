from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from transcript_lab.analysis import run_experiment
from transcript_lab.ingest import ingest_sources


CSV_FIXTURE = """id,type,rewrite_id,rewrite_type,lang,title,text,tags,created_at,updated_at,created_timestamp_ms,updated_timestamp_ms
1,note,0,,en,Communication practice,"I think this thing is really good, you know, because people need it and I kind of explain it in a vague way.",,01.01.2026 10:00:00,01.01.2026 10:00:00,1704103200000,1704103200000
2,note,0,,en,Startup pitch,"People want this thing because it solves a problem, but I guess the way I talk about it is very broad.",,01.01.2026 11:00:00,01.01.2026 11:00:00,1704106800000,1704106800000
3,note,0,,en,Speaking reflection,"You know, I feel like people respond when the explanation is good, but the thing keeps sounding kind of weak.",,01.01.2026 12:00:00,01.01.2026 12:00:00,1704110400000,1704110400000
"""


class VocabularyTests(unittest.TestCase):
    def test_vocabulary_targets_and_rewrites_are_generated(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            fixture = Path(temp_dir) / "fixture.csv"
            fixture.write_text(CSV_FIXTURE, encoding="utf-8")
            ingest_sources([fixture])
            run = run_experiment({"name": "vocabulary-fixture"})

            vocabulary = run["vocabulary"]
            targets = {target["id"]: target for target in vocabulary["targets"]}

            self.assertIn("thing_family", targets)
            self.assertIn("people_family", targets)
            self.assertIn("i_think_feel_guess", targets)
            self.assertGreater(targets["thing_family"]["totalOccurrences"], 2)
            self.assertTrue(targets["thing_family"]["replacementOptions"])
            rewrites = [
                rewrite
                for target in vocabulary["targets"]
                for rewrite in target["sampleRewrites"]
            ]
            self.assertTrue(rewrites)
            self.assertNotEqual(rewrites[0]["original"], rewrites[0]["rewritten"])
            self.assertTrue(vocabulary["banks"])
            self.assertTrue(vocabulary["experiments"])


if __name__ == "__main__":
    unittest.main()
