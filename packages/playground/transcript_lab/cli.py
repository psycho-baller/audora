from __future__ import annotations

import argparse
import json

from .analysis import archive_run, bootstrap_workspace, run_experiment
from .ingest import ingest_sources


def main() -> None:
    parser = argparse.ArgumentParser(description="Transcript Weakness Lab CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("bootstrap")
    subparsers.add_parser("ingest")

    run_parser = subparsers.add_parser("run")
    run_parser.add_argument("--config-json", default=None)

    archive_parser = subparsers.add_parser("archive")
    archive_parser.add_argument("run_id")
    archive_parser.add_argument("--reason", default="archived from CLI")

    args = parser.parse_args()

    if args.command == "bootstrap":
        print(json.dumps(bootstrap_workspace(), indent=2))
    elif args.command == "ingest":
        print(json.dumps(ingest_sources(), indent=2))
    elif args.command == "run":
        config = json.loads(args.config_json) if args.config_json else None
        print(json.dumps(run_experiment(config), indent=2))
    elif args.command == "archive":
        print(json.dumps(archive_run(args.run_id, reason=args.reason), indent=2))


if __name__ == "__main__":
    main()
