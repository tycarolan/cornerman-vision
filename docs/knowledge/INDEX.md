# Knowledge Base Index

The router. Before touching code, find the rows matching the files you are about to change and read those docs — then state in one line what you loaded.

This exists so that `CLAUDE.md` stays an orientation map instead of growing into a rulebook. Rules accrete here as features ship.

## Routing

| When you are working on | Read |
|---|---|
| `spike/**` | `processes/capture-protocol.md`, `cross-cutting/browser-camera.md` |
| `tools/**` — trace analysis | `domains/trace-format.md`, `processes/capture-protocol.md` |
| Pose inference, model selection, keypoint handling | `domains/pose-pipeline.md`, `cross-cutting/projection.md` |
| Normalization, thresholds, punch detection | `domains/pose-pipeline.md`, `cross-cutting/projection.md` |
| Camera access, framerate, frame scheduling, thermals | `cross-cutting/browser-camera.md` |
| Anything reporting a number to the user | `cross-cutting/projection.md` — what the system can and cannot honestly claim |
| `src/app/**`, `src/components/**` — UI | `cross-cutting/design-tokens.md` |
| A gym session, or preparing for one | `processes/capture-protocol.md` |

## Fallback rule

If the file you are touching matches no row above, do not guess and do not duplicate a rule from a neighbouring doc to make one fit. Either the rule belongs in an existing doc — add it there and add the row — or it needs a new doc, in which case propose it rather than writing it uninvited.

## Single-ownership invariant

Each fact lives in exactly one doc. If two docs both need it, one owns it and the other names that doc in its `Related` header. Prose cross-references that restate the fact are how a knowledge base drifts out of agreement with itself.

## Current docs

The knowledge base is near-empty by design — this project is pre-implementation, and durable rules are written when they have been earned by a measurement or a bug, not in anticipation.

| Doc | Status |
|---|---|
| `processes/capture-protocol.md` | Written — the gym session procedure |
| `domains/trace-format.md` | Written — the spike's export schema |
| `cross-cutting/projection.md` | Written — what a single 2D camera cannot see |
| `tools/` analyzer contract | Covered by `domains/trace-format.md` |
| `cross-cutting/browser-camera.md` | Pending — accrues as Phase 1 ships |
| `domains/pose-pipeline.md` | Pending — blocked on the model decision |
| `cross-cutting/design-tokens.md` | Pending — accrues with the app scaffold |
