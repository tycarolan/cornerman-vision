# Trace Format — the spike's export schema

> **Authoritative for**: the JSON shape `spike/index.html` exports; the `schema` version field and its compatibility rule; the meaning of every field the analyzer reads.
> **Related**: `../processes/capture-protocol.md`, `../cross-cutting/projection.md`
> **Last verified**: 2026-07-28

## Rules

**The top-level `schema` field is mandatory and is checked, not ignored.** The analyzer refuses a version it does not recognise rather than reading a file whose fields have moved. A trace misread silently produces numbers that look plausible and are wrong, which is the failure mode this whole project keeps encountering.

**Current version: 2.** Version 1 traces are session-1 exports: no `schema` field at all, no `blocks`, and no `b` stamp on samples or punches. They are still readable for framerate, reach distributions, and lead-versus-rear separation, but they cannot produce per-type recall because nothing declared what was being thrown. Treat an absent `schema` field as version 1.

**Every quantitative field is measured.** There are no estimated or derived-at-export values in a trace except the four explicitly aggregated ones (`meanFps`, `framesPerPunch`, and each block's `detected` counts), all of which are computed from real counters rather than reconstructed from wall-clock time. An earlier build reconstructed frames-per-punch from a fluctuating fps estimate and ran 28% low.

### Top level

| Field | Meaning |
|---|---|
| `schema` | Format version. Absent means version 1. |
| `ua` | User agent string — identifies the device, which is part of any framerate claim. |
| `cfg` | `{thresh, refract, minConf}` at export time. Note these are session-wide, not per-block: moving a slider mid-session is not recorded against the blocks it affected. |
| `model` | The model selected at export time. Not necessarily the one that produced most of the data — use the per-block field. |
| `modelsUsed` | Distinct models across all blocks. More than one entry means the trace spans a comparison. |
| `depthActive` | Whether the model was actually emitting usable `keypoints3D` at export time. |
| `meanFps` | Inference frames divided by run seconds, from the real frame counter. |
| `inferenceFrames` | Monotonic count of frames inference actually ran on, for the life of the page. |
| `runSeconds` | Wall time since the first Start. |
| `framesPerPunch` | Mean frames spanned per recorded punch. Under 4 was the floor at which classification was to be abandoned. |
| `blocks` | The labelled declarations. See below. |
| `punches` | Detected punch events, each stamped with its block. |
| `samples` | Per-frame rows, each stamped with its block. |

### Blocks

A block is a declaration made **before** the punches were thrown — what was about to be thrown, how many, in what context, on which model. It is the only thing in the trace that carries ground truth, and everything the analyzer reports about recall comes from it.

| Field | Meaning |
|---|---|
| `id` | Sequence number within the session. Referenced by `b` on samples and punches. |
| `label` | Punch type, or `freestyle` for unlabelled capture. |
| `hand` | `lead`, `rear`, or `null` for freestyle — derived from the label, not observed. |
| `context` | `shadow` or `bag`. |
| `model` | The model that produced this block's data. Authoritative over the top-level `model`. |
| `depthActive` | Whether depth was live when the block opened. |
| `expected` | Declared rep count, or `null` for freestyle. The denominator of recall. |
| `t0`, `t1` | Block span in page-relative milliseconds. |
| `f0`, `f1` | Block span in inference frame numbers. Per-block framerate is `(f1-f0)/((t1-t0)/1000)`, and is more useful than the session-wide `meanFps` because a session spans several models. |
| `detected` | Punches detected during the block, either hand. |
| `detectedOnDeclaredHand` | Of those, how many landed on the hand the label implies. |
| `open` | Present and true only when the export happened mid-block. |

**`detected` can exceed `expected`.** That is a false-positive signal, not a data error, and the analyzer reports it as such rather than clamping.

**`hand` is derived from the label, and `detectedOnDeclaredHand` compares it against which wrist moved.** The two disagreeing means either a misdetection or a stance assumption that does not hold — lead and rear are inferred from stance, and the spike's internal `lead`/`rear` are really left and right. For an orthodox operator filmed from the correct side these coincide; for a southpaw they invert. This is an open question in the spec and the trace does not resolve it.

### Samples and punches

Sample rows carry `t`, `f` (frame number), `fps`, `conf`, `d3` (whether depth was live for that frame), `b` (block id), and per-side objects under `lead` and `rear`.

Each side object carries **both** metrics on the same frame: `reach` and `elbow` are the depth-aware values where the model provides them, and `reach2d` and `elbow2d` are always the projected 2D values. When the model has no depth the pairs are identical. **This is the single most important property of the format** — it means the 2D-versus-3D comparison is made on identical punches rather than on two separate runs, which is what makes the model argument settleable at all.

A missing side object for a frame means that side's keypoints fell below the confidence floor. Absence is data: it is the dropout rate.

Punch records carry `hand`, `t`, `ms`, `frames`, `peak`, `elbow`, and `b`.

## History

**Schema 2 added blocks, per-block model stamping, and the version field (2026-07-28).** Before it, switching models mid-recording left `recording` set and the detector replaced, so a second model's frames appended into the same arrays with nothing marking the seam. The export claimed a single `model` for a file containing two. That defect is fixed at the source — a model switch now closes the open block — but the version field exists so an analyzer can never make that mistake about an older file either.

**Frame numbers are monotonic for the life of the page, not per Start.** They used to reset on every Start, which meant blocks recorded before a model switch pointed at frame ranges that blocks after it also claimed. Reload the page for a clean session.
