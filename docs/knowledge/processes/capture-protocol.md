# Capture Protocol — Phase 0, Session 2

> **Authoritative for**: the gym-session procedure that settles the pose-model decision; block structure, ordering, and throwing discipline; what invalidates a capture.
> **Related**: `domains/trace-format.md`, `cross-cutting/projection.md`
> **Last verified**: 2026-07-28

## Why this exists

Session 1 exported an undifferentiated stream of punches. Recall could therefore only be *inferred* — the spec's rear-hand figure came from noticing that crosses were being thrown and none were detected, which is convincing but not a number. The spec asks session 2 for **per-punch-type recall**, and that is not recoverable after the fact from an unlabelled trace. It has to be declared before the punches are thrown.

The session has one job: **settle MoveNet versus BlazePose.** Everything below is in service of that, and anything that does not serve it is optional.

## Rules

### The session is invalid if any of these is untrue

- **A phone, not a laptop webcam.** A badly framed desk run measured 19% two-arm dropout against 3.1% correctly framed. Desk data is worse than no data because it looks like data.
- **Served over HTTPS.** Camera access requires a secure context. A LAN IP over plain HTTP is blocked, and this is discovered at the gym unless it is checked beforehand.
- **The phone does not move within a model's run.** Thresholds are camera-placement dependent — the scale reference foreshortens, so a reposition invalidates comparison between blocks either side of it. If it is knocked, end the block, note it, and restart the model's run.
- **Rep counts are exact.** A block declaring ten and delivering nine reports 90% recall on a model that detected everything. If you lose count, end the block and redo it. Count out loud.
- **One punch type per block.** A mixed block cannot produce per-type recall, which is the entire output of the session.

### Throwing discipline

- **Training speed, not maximum.** The spec's realistic expectation degrades with speed by design; measuring at maximum measures the wrong thing first. A separate fast block at the end is worth having, marked as such, but it is not the baseline.
- **Return to guard between reps.** The detector requires a retraction to register a punch at all — a punch left extended is not a detection failure, it is an incomplete punch.
- **Roughly a second between reps.** The refractory interval defaults to 140ms, so this is not close to the limit, but merged reps are unrecoverable and pauses cost nothing.
- **Full body in frame throughout.** Watch the docked skeleton between blocks, not during them.

### Camera placement

Oblique to the stance, around 45°, full body in frame. **Never across the bag from the operator** — the bag occludes the hands at exactly the moment of impact, and it occludes the torso, which breaks the shoulder-width scale reference and corrupts every reach value at once rather than obviously failing.

Note that at 45° the *rear* hand is the one aligned with the depth axis. This is the thing being measured, not a setup error to be corrected.

## Patterns

### Stage A — framerate triage, about five minutes

Thirty seconds of freestyle per model, all four, using **Freestyle Rec**. Read sustained fps off the stat strip and record it.

Purpose: BlazePose's cost is the entire argument against it. If a model cannot hold the frames-per-punch floor, it is out, and there is no reason to spend twenty minutes of labelled blocks on it. Drop any model whose frames per punch sits below 4.

### Stage B — labelled blocks, shadowboxing

For each surviving model, all six punch types, ten reps each:

| Block | Label | Reps |
|---|---|---|
| 1 | Jab | 10 |
| 2 | Cross | 10 |
| 3 | Lead hook | 10 |
| 4 | Rear hook | 10 |
| 5 | Lead uppercut | 10 |
| 6 | Rear uppercut | 10 |

Context set to **Shadowbox**. Declare the type and reps, Start Block, throw exactly ten, End Block. The block's live readout shows detected-against-expected and how many landed on the declared hand — glance at it between blocks, not during.

**The cross block is the one that matters most.** Session 1 detected zero rear-hand punches in 2D. Whether depth recovers them is the decision.

### Stage C — labelled blocks, bag

Context set to **Bag**. At minimum jab, cross, and lead hook, ten reps each, for the frontrunner model and for MoveNet Lightning as the baseline.

Purpose is not model comparison but the gap between contexts: on a bag the punch terminates at impact rather than full extension, so peaks sit below the shadowboxing range by an amount that varies with distance from the bag. That gap is what justifies separate calibration profiles, and it is currently assumed rather than measured.

### Stage D — a full round, for count accuracy

One three-minute round of mixed combos at training speed, labelled **Freestyle**, on the chosen model. Have someone hand-count, or film it separately for review.

This is acceptance criterion 2 — detected count within 5% of a hand count — and it is the only stage that measures the product rather than the model.

### Stage E — the thermal control

**Re-run Stage A's thirty seconds on the first model tested, at the end of the session.**

Without this, a framerate decline across the session is indistinguishable from a difference between models, because the models were tested in order and the phone got hotter throughout. This is five minutes of work that prevents attributing a thermal effect to an architecture, and it is the easiest measurement in the session to skip and the most expensive to omit.

### Exporting

Blocks accumulate across model switches — one Export carries the whole session. Export after every stage anyway, not only at the end: a browser tab that reloads takes the session with it, and nothing else clears it.

Switching models mid-block closes the block automatically and says so in the log. That is deliberate and the resulting partial block is still valid data; it is simply short.

## History

**Blocks were added after session 1 (2026-07-28).** Session 1 shipped with a single Record toggle and no labelling. Its export could support "punches were detected" and "the rear hand appears absent" but not "rear-hand recall is N%", which is what acceptance criterion 13 is written in terms of and what the model decision requires. The block mechanism exists solely to make that number measurable rather than inferred.

**The thermal control exists because model order confounds it.** Testing four models in sequence on one phone means the last model is measured on the hottest device. Session 1 measured 57.9fps sustained but over a single 20-second window, so this effect has never actually been observed here — which is the reason to control for it rather than the reason to assume it is absent.

**Rep-count exactness is called out because it silently inverts the result.** A miscounted block attributes the operator's error to the model, and recall is the number the decision turns on. There is no way to detect this afterwards in the trace.
