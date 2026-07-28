Run the offline analyzer over an exported spike trace and report the model-decision table.

review @docs/knowledge/processes/capture-protocol.md
review @docs/knowledge/domains/trace-format.md
review @docs/plan.md

The standing preamble in `CLAUDE.md` → "Working with Claude" applies (scope, communication, evidence, deliberated decisions, quality gates).

## Knowledge base loading

Read `docs/knowledge/INDEX.md` first, confirm it still routes trace analysis to `domains/trace-format.md` and `processes/capture-protocol.md`, and load any other doc it points to for the files this run touches. State in one line, at the start of the response, which docs were loaded and why.

## Input

Takes a path to a `vision-spike-*.json` export, or a directory of them, as the command argument. Run the analyzer in `tools/` against it.

## What to report

Per model, and per punch type where the data supports it:

- Per-punch-type recall.
- Lead-versus-rear separation — reach distributions and threshold crossings for each hand.
- 2D-versus-3D comparison on the same punches — reach and elbow angle.
- Sustained fps and frames-per-punch.

## How to report it

This output is evidence for the model decision recorded in `docs/spec.md` → Open questions ("Model choice: MoveNet or BlazePose?"). Every number reported here is measured, from this run, and must be labelled as such — never presented alongside, or blended with, the estimates still standing elsewhere in the spec. If a figure here contradicts an assumption in `docs/spec.md`, say so explicitly rather than letting the two stand as competing numbers.

## Schema rejection is deliberate

The analyzer rejects traces whose schema version it does not recognise rather than attempting to read them anyway. If a run fails this way, report the rejection as expected behavior, not a bug — a silently misread trace would produce a wrong table with no indication it was wrong.
