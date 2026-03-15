from __future__ import annotations

import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from .analysis import archive_run, bootstrap_workspace, run_experiment
from .llm import llm_runtime_summary
from .storage import (
    ARCHIVE_INDEX_PATH,
    NORMALIZED_INDEX_PATH,
    NORMALIZED_NOTES_PATH,
    RUN_INDEX_PATH,
    archived_run_dir,
    latest_run_id,
    read_json,
    run_dir,
)

HOST = "127.0.0.1"
PORT = 8765


def _json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.end_headers()
    handler.wfile.write(body)


class TranscriptLabHandler(BaseHTTPRequestHandler):
    def _read_body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length == 0:
            return {}
        raw = self.rfile.read(length)
        if not raw:
            return {}
        return json.loads(raw.decode("utf-8"))

    def _resolve_run_payload(self, run_id: str | None) -> dict:
        target_id = run_id or latest_run_id()
        if not target_id:
            bootstrap_workspace()
            target_id = latest_run_id()
        if not target_id:
            return {}
        payload = read_json(run_dir(target_id) / "run.json", None)
        if payload:
            return payload
        return read_json(archived_run_dir(target_id) / "run.json", {})

    def do_OPTIONS(self) -> None:  # noqa: N802
        _json_response(self, HTTPStatus.NO_CONTENT, {})

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        body = self._read_body()
        if path == "/api/ingest":
            payload = bootstrap_workspace()
            _json_response(self, HTTPStatus.OK, {"ok": True, **payload})
            return
        if path == "/api/runs":
            run = run_experiment(body or None)
            _json_response(self, HTTPStatus.OK, {"ok": True, "run": run})
            return
        if path.startswith("/api/experiments/") and path.endswith("/archive"):
            run_id = path.split("/")[3]
            result = archive_run(run_id, reason=body.get("reason"))
            status = HTTPStatus.OK if result.get("ok") else HTTPStatus.NOT_FOUND
            _json_response(self, status, result)
            return
        _json_response(self, HTTPStatus.NOT_FOUND, {"ok": False, "error": "Route not found"})

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        if path == "/api/corpus":
            _json_response(
                self,
                HTTPStatus.OK,
                {
                    "ok": True,
                    "index": read_json(NORMALIZED_INDEX_PATH, {}),
                    "notes": read_json(NORMALIZED_NOTES_PATH, []),
                },
            )
            return

        if path == "/api/runs":
            _json_response(
                self,
                HTTPStatus.OK,
                {
                    "ok": True,
                    "runs": read_json(RUN_INDEX_PATH, []),
                    "archive": read_json(ARCHIVE_INDEX_PATH, []),
                },
            )
            return

        if path.startswith("/api/runs/"):
            run_id = path.split("/")[3]
            payload = self._resolve_run_payload(run_id)
            if payload:
                _json_response(self, HTTPStatus.OK, {"ok": True, "run": payload})
            else:
                _json_response(self, HTTPStatus.NOT_FOUND, {"ok": False, "error": "Run not found"})
            return

        if path == "/api/findings":
            run_id = query.get("runId", [None])[0]
            run_payload = self._resolve_run_payload(run_id)
            llm_status = llm_runtime_summary()
            _json_response(
                self,
                HTTPStatus.OK,
                {
                    "ok": True,
                    "runId": run_payload.get("id"),
                    "findings": run_payload.get("findings", []),
                    "evidence": run_payload.get("evidence", []),
                    "drills": run_payload.get("drills", []),
                    "notes": run_payload.get("notes", {}).get("index", []),
                    "vocabulary": run_payload.get("vocabulary", {}),
                    "llm": {
                        **llm_status,
                        "requested": run_payload.get("config", {}).get("llm", {}).get("requested", False),
                        "enabled": run_payload.get("config", {}).get("llm", {}).get("enabled", False),
                        "model": run_payload.get("config", {}).get("llm", {}).get("model") or llm_status.get("model"),
                        "disabledReason": run_payload.get("config", {}).get("llm", {}).get("disabledReason")
                        or llm_status.get("disabledReason"),
                    },
                    "metrics": run_payload.get("metrics", {}),
                    "comparisons": run_payload.get("comparisons", {}),
                    "corpus": run_payload.get("corpus", {}),
                },
            )
            return

        if path.startswith("/api/notes/"):
            note_id = path.split("/")[3]
            run_id = query.get("runId", [None])[0]
            run_payload = self._resolve_run_payload(run_id)
            note = next((item for item in read_json(NORMALIZED_NOTES_PATH, []) if item["id"] == note_id), None)
            note_scores = run_payload.get("notes", {}).get("scoreIndex", {}).get(note_id)
            if note:
                _json_response(self, HTTPStatus.OK, {"ok": True, "note": note, "analysis": note_scores})
            else:
                _json_response(self, HTTPStatus.NOT_FOUND, {"ok": False, "error": "Note not found"})
            return

        _json_response(self, HTTPStatus.NOT_FOUND, {"ok": False, "error": "Route not found"})


def main() -> None:
    bootstrap_workspace()
    server = ThreadingHTTPServer((HOST, PORT), TranscriptLabHandler)
    print(f"Transcript lab API listening on http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()


if __name__ == "__main__":
    main()
