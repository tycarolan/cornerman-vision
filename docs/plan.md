# Cornerman Vision — Implementation Plan

The operational record of *how* this gets built. `docs/spec.md` is the durable record of *what* and *why*; where the two disagree, the spec wins and this file gets corrected.

Each phase carries a **Gate** — the literal command or observation that closes it. A phase is not done because the code exists; it is done because its gate passed.

## Progress

| Phase | Status | Notes |
|---|---|---|
| 0 — The spike | Run, reopened | Session 1 answered framerate, broke three assumptions. Session 2 pending. |
| 0.5 — Repo foundation | **Done** | Documentation architecture, slash commands, app scaffold. Gates pass. |
| 0.6 — Measurement instrument | **Done** | Labelled capture and offline analyzer landed. Awaiting the session. |
| 1 — Detection and count | **Blocked** | Gated on the model decision, which session 2 settles. |
| 2 — Guard tracking | Blocked | Follows Phase 1. |
| 3 — Classification | Blocked | May be dropped entirely — see spec, Punch classification. |
| 4 — Calibration and learned classifier | Blocked | Upside, not commitment. |

**Last updated:** 2026-07-28
**Current phase:** Phase 0, session 2 — an operator phase
**Blocked on:** a gym session with a real phone — the only way the model decision gets made

## Why there is a Phase 0.5 and 0.6

The spec states plainly that **Phase 1 does not begin until the model decision is settled**, and that decision is settled by measurement in a gym, not by argument. That is an operator action which cannot be brought forward by writing code.

So the work that *is* available splits in two:

- **0.5 — foundation that no measurement can invalidate.** Repo documentation, the spec-driven workflow, and an empty deployed app shell. None of it depends on which pose model wins.
- **0.6 — making the measurement decisive.** The session-1 spike could not produce what the spec asks of session 2. It has no way to label which punch type is being thrown, no way to mark bag versus shadowboxing, and no per-sample record of which model produced a frame. Without those, session 2 produces the same inferred numbers session 1 did, and the model decision stays open for a third session.

0.6 is the critical path. A gym session that produces unlabelled data is a gym session spent twice.

## Phase 0.5 — Repo foundation

**Goal:** this repo carries the same engineering discipline as its siblings, and a new session can orient itself without archaeology.

### Files

| Action | Path | Purpose |
|---|---|---|
| New | `CLAUDE.md` | Orientation map and the standing preamble every command inherits |
| New | `AGENTS.md` | Pointer to `CLAUDE.md`, for tooling that looks for this name |
| New | `README.md` | Short, human-facing: what this is, how to run it |
| New | `CHANGELOG.md` | Keep a Changelog; every shipped phase adds an entry |
| New | `.editorconfig` | Editor-level formatting floor |
| New | `docs/SPEC_DRIVEN_DEVELOPMENT.md` | The workflow: when a spec is required, spec vs plan, absorption |
| New | `docs/SPEC_TEMPLATE.md` | Canonical spec shape |
| New | `docs/PLAN_TEMPLATE.md` | Canonical plan shape |
| New | `docs/KNOWLEDGE_DOC_TEMPLATE.md` | Canonical knowledge-doc shape |
| New | `docs/knowledge/INDEX.md` | Router: touched file → docs to load |
| New | `.claude/commands/*.md` | The spec-driven workflow as slash commands |

### Tasks

- [ ] `CLAUDE.md` as a real orientation map, not an import pointer — it names where things live and does not restate them
- [ ] Standing preamble section (`## Working with Claude`) that commands reference by name instead of re-typing
- [ ] Templates for spec, plan, and knowledge doc
- [ ] `docs/knowledge/INDEX.md` router with the initial topic areas
- [ ] Slash commands, each opening with the files it loads and inheriting the preamble
- [ ] `README.md`, `CHANGELOG.md`, `.editorconfig`

**Gate:** a fresh session given only `CLAUDE.md` can name the blocking decision, find the spec, find the spike, and state what Phase 1 is waiting on — without reading any source.

## Phase 0.6 — The measurement instrument

**Goal:** the next gym session produces per-punch-type recall per model, not an anecdote.

This phase has a hard external deadline: it must land before the session, or the session runs on the session-1 instrument and yields session-1-grade data.

### Files

| Action | Path | Purpose |
|---|---|---|
| Modify | `spike/index.html` | Labelled block capture, context marker, per-row model tagging, defect fixes |
| New | `docs/knowledge/processes/capture-protocol.md` | The gym procedure, written to be followed while tired |
| New | `tools/analyze-trace.*` | Offline analyzer over exported traces |
| New | `tools/fixtures/` | Recorded trace fixtures the analyzer is tested against |

### Tasks — spike

- [ ] Block labelling: select a punch type and expected rep count, record punches within that block against that label
- [ ] Context marker: shadowboxing versus bag, carried on the export
- [ ] Stamp every sample row and every punch with the model that produced it
- [ ] Version the export schema, so the analyzer can reject traces it does not understand
- [ ] Fix mid-recording model switch — it currently disposes the detector but leaves `recording`, `samples`, and `punches` intact, silently mixing two models into one trace
- [ ] Fix flip-cam stale state — per-side punch state and the fps window survive a camera flip

**Gate:** an export from a labelled session, read back by the analyzer, reports a per-punch-type recall table without hand-editing the JSON.

### Tasks — analyzer

- [ ] Per-punch-type recall: detected against the expected count declared for each block
- [ ] Per-hand separation: lead versus rear reach distributions and threshold crossings, the criterion-13 number
- [ ] 2D versus 3D comparison on identical punches — reach and elbow angle, which is the whole model argument
- [ ] Sustained fps and frames-per-punch, per model
- [ ] Reject traces whose schema version it does not know, rather than silently misreading them

**Gate:** `npm test` passes over recorded fixtures, and the analyzer run against a session-1 export reproduces the figures already quoted in the spec.

## Phase 0 — session 2, the model decision

**Goal:** close the only open question Phase 1 waits on.

This is an operator phase. No code ships in it.

### Tasks

- [ ] Run the protocol in `docs/knowledge/processes/capture-protocol.md`, both contexts, all four models
- [ ] Analyze every export
- [ ] Record the decision and its evidence in `docs/spec.md` — the spike's own numbers become the thresholds, replacing every estimate in that document
- [ ] Close or narrow the open question, and update the acceptance criteria whose status is currently *unmet*

**Gate:** the "Model choice" open question in the spec is checked off, with a measured table behind it. If depth does not recover the rear hand, the narrowing rule fires and phases 3–4 are dropped rather than shipped inaccurate — that is also a valid outcome of this gate.

## Phase 1 — Detection and count

**Blocked.** Framing checks, capture pipeline, normalization, peak detection. Delivers punch count, punches per minute, work rate, the live screen, and round summaries. No classification.

Scope will be rewritten against the chosen model before it starts; normalization in particular is a different design in 2D and 3D.

**Gate:** acceptance criteria 1, 2, 3, 7, 8, 12.

## Phase 2 — Guard tracking

**Blocked.** Guard state detection, the audio cue, the edge-glow treatment, guard-held percentage, and the guard timeline. Depends on none of the classification work, and is the phase that justifies the product.

**Gate:** acceptance criteria 5, 6.

## Phase 3 — Classification

**Blocked, and conditional.** Only begins if session 2 shows depth recovers elbow angle against a real body. Otherwise dropped.

**Gate:** acceptance criteria 10, 11, 13.

## Phase 4 — Calibration and the learned classifier

**Blocked.** Guided capture, per-user model training, combo reconstruction.

**Gate:** acceptance criterion 14.

## Risks

| Risk | Consequence | Mitigation |
|---|---|---|
| Session 2 runs on unlabelled capture | The model decision needs a third session | Phase 0.6, landed before the session |
| Depth recovers neither the rear hand nor elbow angle | Product narrows to work rate and guard tracking | The narrowing rule is already written into the spec; this is a planned outcome, not a failure |
| BlazePose is too slow on the target phone | Two-dimensional projection problems stay unsolved | Measure all four models in the same session rather than committing to one |
| Thermal throttling during a long session | Late-round data quality silently degrades | The spike already reports sustained fps; watch it across the session rather than trusting a spot reading |
| Foundation work crowds out the deadline | Session 2 runs on the old instrument | 0.6 takes priority over 0.5 whenever they compete |

## Deployment

The spike deploys from this repository's `spike/` directory to its own Vercel project, connected to GitHub with `main` as the production branch. **A merge to main deploys the spike; a pull request gets a preview URL.** The preview is the useful half — it means a change can be tested on a phone in a gym before it lands.

The application at the repository root is a separate concern and does not yet have a deployment, because it does not yet have anything to deploy. It gets its own project when Phase 1 produces surface worth visiting.

Vision and Cornerman stay separate applications with separate deployments, each carrying its own card on the taiotech hub — see the resolved open question in `docs/spec.md`.

## Related

- `docs/spec.md` — what is being built and why
- `docs/knowledge/INDEX.md` — which docs to load for a given change
- `docs/SPEC_DRIVEN_DEVELOPMENT.md` — how work moves from spec to plan to shipped
