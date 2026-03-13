# Transcript Weakness Lab

Local workbench for communication-forensics experiments over raw Letterly transcript exports.

## What this package contains

- A Python analysis engine in [`transcript_lab`](/Users/rami/Documents/code/react-native/audora/packages/playground/transcript_lab)
- A local JSON API that serves corpus, run, finding, drill, and archive data
- A standalone React explorer for Corpus, Weaknesses, Evidence, Drills, Experiments, and Archive views
- Derived data stores under [`normalized`](/Users/rami/Documents/code/react-native/audora/packages/playground/normalized), [`runs`](/Users/rami/Documents/code/react-native/audora/packages/playground/runs), and [`archive/experiments`](/Users/rami/Documents/code/react-native/audora/packages/playground/archive/experiments)

## Scripts

```bash
pnpm --filter @audora/playground dev
pnpm --filter @audora/playground bootstrap
pnpm --filter @audora/playground test
pnpm --filter @audora/playground typecheck
```

## Data flow

1. Raw CSV files live in [`raw`](/Users/rami/Documents/code/react-native/audora/packages/playground/raw) or at the package root.
2. Ingestion builds canonical `TranscriptNote` records with segments, artifact spans, and inferred contexts.
3. Experiment runs create findings, counterexamples, drill cards, and comparison metrics.
4. Low-value experiments can be archived without touching raw inputs.

## Notes

- v1 is transcript-only and does not claim vocal-tone or prosody diagnosis.
- LLM synthesis is opt-in. Set `PLAYGROUND_ENABLE_LLM=1` and `PLAYGROUND_OPENAI_MODEL` with `OPENAI_API_KEY` if you want the synthesis layer enabled.
