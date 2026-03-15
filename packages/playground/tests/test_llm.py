from __future__ import annotations

import os
import unittest
from unittest.mock import patch

from transcript_lab.llm import DEFAULT_OPENAI_MODEL, resolve_llm_config


class LlmConfigTests(unittest.TestCase):
    def test_llm_requires_api_key(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            config = resolve_llm_config({"enabled": True})
            self.assertFalse(config["enabled"])
            self.assertFalse(config["configured"])
            self.assertEqual(config["model"], DEFAULT_OPENAI_MODEL)
            self.assertEqual(config["disabledReason"], "OPENAI_API_KEY is missing")

    def test_llm_uses_default_model_when_key_exists(self) -> None:
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}, clear=True):
            config = resolve_llm_config({"enabled": True})
            self.assertTrue(config["enabled"])
            self.assertTrue(config["configured"])
            self.assertEqual(config["model"], DEFAULT_OPENAI_MODEL)

    def test_env_can_force_disable_llm(self) -> None:
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key", "PLAYGROUND_ENABLE_LLM": "0"}, clear=True):
            config = resolve_llm_config({"enabled": True})
            self.assertFalse(config["enabled"])
            self.assertEqual(config["disabledReason"], "PLAYGROUND_ENABLE_LLM=0")


if __name__ == "__main__":
    unittest.main()
