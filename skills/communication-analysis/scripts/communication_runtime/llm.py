from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any

DEFAULT_OPENAI_MODEL = "gpt-5-mini"
DEFAULT_REASONING_EFFORT = "low"
RESPONSES_API_URL = "https://api.openai.com/v1/responses"


def resolve_llm_config() -> dict[str, Any]:
    env_flag = os.getenv("COMMUNICATION_SKILL_ENABLE_LLM")
    api_key = os.getenv("OPENAI_API_KEY")
    enabled = bool(api_key) and env_flag != "0"
    return {
        "enabled": enabled,
        "configured": bool(api_key),
        "model": os.getenv("COMMUNICATION_SKILL_OPENAI_MODEL") or os.getenv("PLAYGROUND_OPENAI_MODEL") or DEFAULT_OPENAI_MODEL,
        "reasoningEffort": os.getenv("COMMUNICATION_SKILL_REASONING_EFFORT") or DEFAULT_REASONING_EFFORT,
        "disabledReason": None if enabled else ("OPENAI_API_KEY is missing" if not api_key else "COMMUNICATION_SKILL_ENABLE_LLM=0"),
    }


def _response_output_text(payload: dict[str, Any]) -> str | None:
    for item in payload.get("output", []):
        if item.get("type") != "message":
            continue
        for content in item.get("content", []):
            if content.get("type") == "output_text" and content.get("text"):
                return str(content["text"])
    return None


def _responses_json(
    *,
    system_prompt: str,
    user_payload: dict[str, Any],
    schema_name: str,
    schema: dict[str, Any],
    llm_config: dict[str, Any],
    max_output_tokens: int,
) -> dict[str, Any] | None:
    if not llm_config.get("enabled"):
        return None

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None

    body = json.dumps(
        {
            "model": llm_config["model"],
            "input": [
                {"role": "system", "content": [{"type": "input_text", "text": system_prompt}]},
                {"role": "user", "content": [{"type": "input_text", "text": json.dumps(user_payload)}]},
            ],
            "reasoning": {"effort": llm_config.get("reasoningEffort", DEFAULT_REASONING_EFFORT)},
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": schema_name,
                    "strict": True,
                    "schema": schema,
                }
            },
            "store": False,
            "max_output_tokens": max_output_tokens,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        RESPONSES_API_URL,
        data=body,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return None

    text = _response_output_text(payload)
    if not text:
        return None

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def synthesize_finding(finding: dict[str, Any], llm_config: dict[str, Any]) -> dict[str, Any] | None:
    schema = {
        "type": "object",
        "properties": {
            "summary": {"type": "string"},
            "hypothesis": {"type": "string"},
        },
        "required": ["summary", "hypothesis"],
        "additionalProperties": False,
    }
    return _responses_json(
        system_prompt="You are a careful communication analyst. Keep the language evidence-bound and do not overstate psychological certainty.",
        user_payload={
            "finding": finding,
            "instruction": "Rewrite this finding more sharply, keep it practical, and mark any cause language as tentative.",
        },
        schema_name="communication_finding_rewrite",
        schema=schema,
        llm_config=llm_config,
        max_output_tokens=500,
    )


def synthesize_vocabulary_target(target: dict[str, Any], llm_config: dict[str, Any]) -> dict[str, Any] | None:
    schema = {
        "type": "object",
        "properties": {
            "whyItLimitsYou": {"type": "string"},
            "replacementOptions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "word": {"type": "string"},
                        "useWhen": {"type": "string"},
                        "caution": {"type": "string"},
                    },
                    "required": ["word", "useWhen", "caution"],
                    "additionalProperties": False,
                },
            },
            "learningSystem": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["whyItLimitsYou", "replacementOptions", "learningSystem"],
        "additionalProperties": False,
    }
    return _responses_json(
        system_prompt="You are a careful communication coach. Prefer practical spoken-language guidance over dramatic phrasing.",
        user_payload={
            "target": target,
            "instruction": "Tighten this vocabulary coaching target, keep it natural, and preserve the practical replacement guidance.",
        },
        schema_name="communication_vocab_rewrite",
        schema=schema,
        llm_config=llm_config,
        max_output_tokens=700,
    )


def synthesize_report_summary(report_slice: dict[str, Any], llm_config: dict[str, Any]) -> dict[str, Any] | None:
    schema = {
        "type": "object",
        "properties": {
            "executiveDiagnosis": {"type": "string"},
            "weeklyTheme": {"type": "string"},
        },
        "required": ["executiveDiagnosis", "weeklyTheme"],
        "additionalProperties": False,
    }
    return _responses_json(
        system_prompt="You are a precise communication coach. Stay concrete, plainspoken, and evidence-bound.",
        user_payload={
            "report": report_slice,
            "instruction": "Write a compact executive diagnosis and a weekly theme from these evidence-backed findings.",
        },
        schema_name="communication_report_summary",
        schema=schema,
        llm_config=llm_config,
        max_output_tokens=400,
    )
