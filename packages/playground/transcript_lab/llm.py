from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any


DEFAULT_OPENAI_MODEL = "gpt-5-mini"
DEFAULT_REASONING_EFFORT = "low"
RESPONSES_API_URL = "https://api.openai.com/v1/responses"


def resolve_llm_config(requested: dict[str, Any] | None = None) -> dict[str, Any]:
    requested = requested or {}
    api_key_present = bool(os.getenv("OPENAI_API_KEY"))
    model = requested.get("model") or os.getenv("PLAYGROUND_OPENAI_MODEL") or DEFAULT_OPENAI_MODEL
    reasoning_effort = os.getenv("PLAYGROUND_OPENAI_REASONING_EFFORT") or DEFAULT_REASONING_EFFORT
    env_flag = os.getenv("PLAYGROUND_ENABLE_LLM")
    requested_enabled = bool(requested.get("enabled"))
    env_forced_off = env_flag == "0"
    active = requested_enabled and api_key_present and not env_forced_off
    disabled_reason = None
    if requested_enabled and not api_key_present:
        disabled_reason = "OPENAI_API_KEY is missing"
    elif requested_enabled and env_forced_off:
        disabled_reason = "PLAYGROUND_ENABLE_LLM=0"
    return {
        "enabled": active,
        "requested": requested_enabled,
        "configured": api_key_present,
        "model": model,
        "reasoningEffort": reasoning_effort,
        "disabledReason": disabled_reason,
    }


def llm_runtime_summary() -> dict[str, Any]:
    api_key_present = bool(os.getenv("OPENAI_API_KEY"))
    model = os.getenv("PLAYGROUND_OPENAI_MODEL") or DEFAULT_OPENAI_MODEL
    reasoning_effort = os.getenv("PLAYGROUND_OPENAI_REASONING_EFFORT") or DEFAULT_REASONING_EFFORT
    return {
        "configured": api_key_present,
        "model": model,
        "reasoningEffort": reasoning_effort,
        "disabledReason": None if api_key_present else "OPENAI_API_KEY is missing",
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
            "max_output_tokens": max_output_tokens,
            "store": False,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        RESPONSES_API_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return None

    content = _response_output_text(payload)
    if not content:
        return None

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return None


def synthesize_finding(finding: dict[str, Any], llm_config: dict[str, Any]) -> dict[str, Any] | None:
    prompt = {
        "finding": {
            "dimension": finding["dimension"],
            "label": finding["label"],
            "severity": finding["severity"],
            "confidence": finding["confidence"],
            "explanation": finding["explanation"],
            "why_it_matters": finding["why_it_matters"],
            "metrics": finding["metrics"],
        },
        "instruction": (
            "Rewrite this communication finding more sharply, keep it evidence-bound, and if you mention "
            "possible causes mark them as tentative hypotheses."
        ),
    }
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
        system_prompt="You are a careful communication analyst. Never overstate psychological certainty.",
        user_payload=prompt,
        schema_name="finding_rewrite",
        schema=schema,
        llm_config=llm_config,
        max_output_tokens=600,
    )


def synthesize_vocabulary_target(target: dict[str, Any], llm_config: dict[str, Any]) -> dict[str, Any] | None:
    prompt = {
        "target": {
            "label": target["label"],
            "kind": target["kind"],
            "category": target["category"],
            "why_it_limits_you": target["why_it_limits_you"],
            "replacement_options": target["replacementOptions"],
            "sample_rewrites": target["sampleRewrites"],
            "evidence": target["evidenceSamples"],
        },
        "instruction": (
            "Tighten this vocabulary coaching target for a spoken-communication lab. Keep it practical, "
            "evidence-bound, and avoid inflated or clinical language."
        ),
    }
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
            "sampleRewrites": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "noteId": {"type": ["string", "null"]},
                        "noteTitle": {"type": "string"},
                        "original": {"type": "string"},
                        "rewritten": {"type": "string"},
                        "replacement": {"type": "string"},
                    },
                    "required": ["noteId", "noteTitle", "original", "rewritten", "replacement"],
                    "additionalProperties": False,
                },
            },
            "learningSystem": {
                "type": "array",
                "items": {"type": "string"},
            },
        },
        "required": ["whyItLimitsYou", "replacementOptions", "sampleRewrites", "learningSystem"],
        "additionalProperties": False,
    }
    return _responses_json(
        system_prompt="You are a careful communication coach. Prefer precise, teachable wording over dramatic phrasing.",
        user_payload=prompt,
        schema_name="vocabulary_target_rewrite",
        schema=schema,
        llm_config=llm_config,
        max_output_tokens=900,
    )
