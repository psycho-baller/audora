from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import textwrap
import unittest
import unittest.mock
from pathlib import Path


REPO_ROOT = Path("/Users/rami/Documents/code/react-native/audora")
ANALYZE_SCRIPT = REPO_ROOT / "skills" / "communication-analysis" / "scripts" / "analyze_file.py"
ORCHESTRATE_SCRIPT = REPO_ROOT / "skills" / "communication-orchestrator" / "scripts" / "orchestrate.py"


TRANSCRIPT_FIXTURE = textwrap.dedent(
    """
    # Investor practice

    I think this thing is really important because people keep asking about it.
    You know, the way I explain it is kind of vague and I sort of restart the point when I get nervous.
    The product solves a problem, but maybe I still talk around the mechanism instead of naming it directly.
    """
).strip()


NOTE_FIXTURE = textwrap.dedent(
    """
    ---
    analysis_mode: note
    title: Written reflection
    context:
      - communication
      - learning
    tags:
      - journal
      - reflection
    ---

    I think the main issue in my writing is that the thing stays too abstract.
    I want the explanation to be clearer, more direct, and more concrete for the listener.
    """
).strip()


TRANSCRIBED_SYSTEM_FIXTURE = textwrap.dedent(
    """
    ---
    source_media: "/tmp/audio.m4a"
    transcription_model: "gpt-4o-transcribe"
    ---

    # transcript: workflow setup

    source media: `/tmp/audio.m4a`
    model: `gpt-4o-transcribe`

    ## transcript

    My view is that this setup takes time because the workflow has to match your actual bottleneck.
    The mistake is trying to automate everything before you know what slows you down.
    Be self-aware about where you lose time and focus, then improve that part of the system first.
    Build the plan around the one task that keeps wasting time each day.
    Do things in the right order instead of optimizing random stuff.
    """
).strip()


class CommunicationSkillTests(unittest.TestCase):
    def _workspace(self, name: str) -> Path:
        workspace_root = REPO_ROOT / "skills" / "tests" / "__workspace__"
        workspace_root.mkdir(exist_ok=True)
        target = workspace_root / name
        if target.exists():
            shutil.rmtree(target)
        target.mkdir(parents=True)
        return target

    def _run(self, script: Path, target: Path) -> dict:
        env = dict(os.environ)
        env["COMMUNICATION_SKILL_ENABLE_LLM"] = "0"
        result = subprocess.run(
            [sys.executable, str(script), str(target)],
            check=True,
            capture_output=True,
            text=True,
            env=env,
        )
        return json.loads(result.stdout)

    def test_single_file_analysis_writes_markdown_and_json(self) -> None:
        workspace = self._workspace("single-file")
        source = workspace / "investor-practice.md"
        source.write_text(TRANSCRIPT_FIXTURE, encoding="utf-8")

        payload = self._run(ANALYZE_SCRIPT, source)
        report_md = Path(payload["analysis_markdown_path"])
        report_json = Path(payload["analysis_json_path"])

        self.assertTrue(report_md.exists())
        self.assertTrue(report_json.exists())

        report = json.loads(report_json.read_text(encoding="utf-8"))
        self.assertEqual(report["source"]["analysis_mode"], "transcript")
        self.assertIn("## Highest-Leverage Gaps", report_md.read_text(encoding="utf-8"))
        self.assertIn("## Vocabulary Pressure Points", report_md.read_text(encoding="utf-8"))
        self.assertIn("## Sentence Upgrade Lab", report_md.read_text(encoding="utf-8"))
        self.assertTrue(report["findings"])
        self.assertTrue(report["vocabulary"])
        self.assertTrue(report["sentence_upgrades"])
        self.assertIn("use_this_when", report["sentence_upgrades"][0])
        self.assertTrue(report["evidence"])

    def test_frontmatter_note_override_suppresses_spoken_disfluency_priority(self) -> None:
        workspace = self._workspace("note-file")
        source = workspace / "written-reflection.md"
        source.write_text(NOTE_FIXTURE, encoding="utf-8")

        payload = self._run(ANALYZE_SCRIPT, source)
        report = json.loads(Path(payload["analysis_json_path"]).read_text(encoding="utf-8"))

        self.assertEqual(report["source"]["analysis_mode"], "note")
        disfluency = next(item for item in report["evidence"] if item["detector"] == "disfluency_restarts")
        self.assertLess(disfluency["metrics"]["modeWeight"], 0.3)
        self.assertNotEqual(report["source"]["contexts"], [])
        self.assertIn("communication", report["source"]["contexts"])

    def test_folder_orchestration_builds_per_file_reports_and_summary(self) -> None:
        root = self._workspace("folder-run")
        transcript = root / "talk.md"
        notes_dir = root / "notes"
        notes_dir.mkdir()
        note = notes_dir / "reflection.md"
        transcript.write_text(TRANSCRIPT_FIXTURE, encoding="utf-8")
        note.write_text(NOTE_FIXTURE, encoding="utf-8")

        preexisting_analysis = root / "analysis"
        preexisting_analysis.mkdir()
        (preexisting_analysis / "ignore-me.md").write_text("# already analysis", encoding="utf-8")

        payload = self._run(ORCHESTRATE_SCRIPT, root)
        summary_payload = payload["summary"]
        summary_json = Path(summary_payload["analysis_json_path"])
        summary_md = Path(summary_payload["analysis_markdown_path"])

        self.assertTrue((root / "analysis" / "index.md").exists())
        self.assertTrue(summary_json.exists())
        self.assertTrue(summary_md.exists())
        self.assertFalse((root / "analysis" / "analysis" / "ignore-me.md").exists())
        self.assertTrue((root / "analysis" / "talk.json").exists())
        self.assertTrue((notes_dir / "analysis" / "reflection.json").exists())

        summary = json.loads(summary_json.read_text(encoding="utf-8"))
        self.assertEqual(summary["metadata"]["report_count"], 2)
        self.assertTrue(summary["findings"])
        self.assertTrue(summary["metadata"]["file_priorities"])

    def test_transcribed_markdown_uses_body_section_and_conservative_contexts(self) -> None:
        workspace = self._workspace("transcribed-system")
        source = workspace / "workflow-setup.md"
        source.write_text(TRANSCRIBED_SYSTEM_FIXTURE, encoding="utf-8")

        payload = self._run(ANALYZE_SCRIPT, source)
        report = json.loads(Path(payload["analysis_json_path"]).read_text(encoding="utf-8"))

        self.assertIn("systems", report["source"]["contexts"])
        self.assertIn("productivity", report["source"]["contexts"])
        self.assertNotIn("career", report["source"]["contexts"])

        disfluency = next(item for item in report["evidence"] if item["detector"] == "disfluency_restarts")
        self.assertLess(disfluency["metrics"]["modeWeight"], 1.0)

        thing_family = next(item for item in report["vocabulary"] if item["id"] == "thing_family")
        rewrites = [rewrite["rewritten"].lower() for rewrite in thing_family.get("sampleRewrites", [])]
        self.assertFalse(any("do constraint" in rewrite for rewrite in rewrites))

    def test_artifact_detection_avoids_false_fillers_and_hyphen_fragments(self) -> None:
        scripts_root = REPO_ROOT / "skills" / "communication-analysis" / "scripts"
        sys.path.insert(0, str(scripts_root))
        try:
            from communication_runtime.markdown_source import _find_artifacts

            artifacts = _find_artifacts("I feel like this over-optimized setup is still too vague.")
        finally:
            sys.path.pop(0)

        kinds = [(item["kind"], item["text"].lower()) for item in artifacts]
        self.assertNotIn(("filler", "like"), kinds)
        self.assertFalse(any(kind == "dash_fragment" for kind, _ in kinds))


    def test_short_text_does_not_crash(self) -> None:
        workspace = self._workspace("short-text")
        source = workspace / "short.md"
        source.write_text("The problem needs a fix.", encoding="utf-8")

        payload = self._run(ANALYZE_SCRIPT, source)
        report_json = Path(payload["analysis_json_path"])
        report_md = Path(payload["analysis_markdown_path"])

        self.assertTrue(report_md.exists())
        self.assertTrue(report_json.exists())
        report = json.loads(report_json.read_text(encoding="utf-8"))
        self.assertIn("findings", report)
        self.assertIn("vocabulary", report)
        self.assertIn("sentence_upgrades", report)

    def test_llm_path_does_not_break_output_contract(self) -> None:
        scripts_root = REPO_ROOT / "skills" / "communication-analysis" / "scripts"
        sys.path.insert(0, str(scripts_root))
        try:
            import communication_runtime.engine as engine_module

            workspace = self._workspace("llm-path")
            source_path = workspace / "investor-practice.md"
            source_path.write_text(TRANSCRIPT_FIXTURE, encoding="utf-8")

            llm_config = {"enabled": True, "model": "mock", "reasoningEffort": "low"}
            # Patch at the engine module level — engine imports these names directly
            with (
                unittest.mock.patch.object(engine_module, "resolve_llm_config", return_value=llm_config),
                unittest.mock.patch.object(
                    engine_module,
                    "synthesize_finding",
                    return_value={"summary": "Mock summary.", "hypothesis": "Mock hypothesis."},
                ),
                unittest.mock.patch.object(
                    engine_module,
                    "synthesize_report_summary",
                    return_value={"executiveDiagnosis": "Mock diagnosis.", "weeklyTheme": "Mock theme."},
                ),
                unittest.mock.patch.object(engine_module, "synthesize_vocabulary_target", return_value=None),
            ):
                report = engine_module.build_analysis_report(source_path)

            self.assertIn("findings", report)
            self.assertIn("sentence_upgrades", report)
            self.assertTrue(report["findings"])
            self.assertEqual(report["summary"]["executive_diagnosis"], "Mock diagnosis.")
            self.assertEqual(report["summary"]["weekly_theme"], "Mock theme.")
            top_finding = next(f for f in report["findings"] if f["severity"] >= 35)
            self.assertEqual(top_finding["explanation"], "Mock summary.")
        finally:
            sys.path.pop(0)


if __name__ == "__main__":
    unittest.main()
