# Transcript Playground

This playground turns raw Letterly transcript exports into a communication-forensics report.

## What it does

- Separates likely self-transcripts from mixed or imported speech before scoring.
- Computes communication signals that are stronger than the product's current lightweight filler-word analytics.
- Emits a machine-readable report and a short markdown summary.
- Keeps failed or low-signal experiments in [`archive/`](/Users/rami/Documents/code/react-native/audora/packages/playground/archive).

## Core signals

- `clarity_drag`: live self-editing, fillers, vagueness, repetition, long sentence load.
- `confidence_leakage`: hedges, fear language, apology language, self-critique.
- `listener_drift`: self-focus without enough audience framing, structure, or concrete anchors.
- `emotional_amplification`: absolutes, emotional intensity, negative-other framing.

## Run it

```bash
python3 packages/playground/scripts/build_report.py
```

Outputs:

- [`output/latest-analysis.json`](/Users/rami/Documents/code/react-native/audora/packages/playground/output/latest-analysis.json)
- [`output/latest-analysis.md`](/Users/rami/Documents/code/react-native/audora/packages/playground/output/latest-analysis.md)

## Explore it in the app

Run the web app and open `/playground`.

```bash
pnpm --filter my-react-router-app dev
```

## Extending the system

- Add or refine lexicons in [`scripts/build_report.py`](/Users/rami/Documents/code/react-native/audora/packages/playground/scripts/build_report.py).
- Add new composites by extending `SIGNAL_DEFINITIONS`.
- If an experiment looks clever but produces weak insights, move it into [`archive/`](/Users/rami/Documents/code/react-native/audora/packages/playground/archive) instead of keeping it in the active pipeline.
