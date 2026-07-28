# CLAUDE.md

This file is the orientation map. It says where things live and what state they are in; it does not restate their contents. The architecture and the reasoning behind it live in `docs/spec.md`, the build sequence in `docs/plan.md`, and the durable rules in `docs/knowledge/`.

## Project overview

A phone is propped at an angle, watches a boxing round, and reports what happened: how many punches, which ones, how hard the work rate held up, and whether the guard stayed up. Entirely on-device, in a browser, with no video ever leaving the frame buffer.

This is a companion to **Cornerman** (a separate repository — a round timer and combo library). Cornerman calls combos at you; this answers whether you actually threw them. There is no code dependency between the two and the current recommendation is that there never is one.

**Working title.** The name is unsettled and deliberately parked.

## Status — read this before proposing work

**Phase 1 has not begun and must not begin.** The spec gates it on a single unsettled decision: **MoveNet or BlazePose** — temporal resolution against dimensional completeness. That decision is settled by measurement on a real phone in a gym, not by argument, and not from this repository.

Phase 0 ran and was only partially conclusive. It settled that framerate is not the constraint (57.9fps measured, against an assumed 30). It broke three things the spec had assumed:

- **Rear-hand punches are undetectable in 2D.** Zero detected while crosses were being thrown. Not a threshold problem — the signal was never projected into the image.
- **The scale reference foreshortens.** Peak reach measured 1.84 shoulder-widths, which is geometrically impossible. Thresholds do not transfer between camera placements.
- **Elbow angle at peak is unusable in 2D.** Every detected punch read between 74° and 95°, including straights.

All three are projection problems. Depth is the only known answer, which is why the model decision gates everything downstream.

Work that is available now is foundation (Phase 0.5) and instrumentation (Phase 0.6). See `docs/plan.md`.

## External systems

- **TensorFlow.js pose-detection** — runtime pose estimation. Loaded from CDN in the spike, pinned exactly.
- **MediaPipe Tasks Vision** — BlazePose. Run on the `tfjs` runtime rather than the `mediapipe` one; the `+esm` build of `pose-detection` pulls a broken `@mediapipe/pose` transitive dependency missing its `Pose` export.
- **MMAction2** — offline only, never in the shipped runtime. A benchmark and labelling aid.
- **Vercel** — hosting. Camera access requires a secure context, which it provides.

## Repository layout

```
docs/
  spec.md            The durable WHAT and WHY. Authoritative.
  plan.md            The operational HOW. Phase-by-phase, with gates.
  mockups.html       Six annotated screens.
  SPEC_DRIVEN_DEVELOPMENT.md   How work moves from idea to shipped.
  SPEC_TEMPLATE.md / PLAN_TEMPLATE.md / KNOWLEDGE_DOC_TEMPLATE.md
  knowledge/
    INDEX.md         Router: touched files → docs to load. Read this first.
    domains/         One doc per subject area.
    cross-cutting/   One doc per technical concern spanning areas.
    processes/       One doc per operational flow.
spike/
  index.html         The Phase 0 instrument. Single file, no build step.
tools/
  Offline analysis over exported traces. Never ships to the browser.
```

## Commands

```bash
npm run dev          # Next dev server
npm run build        # Production build
npm run lint         # ESLint
npm test             # Vitest, single run
npm run test:watch   # Vitest, watching

# The spike has no build step — serve it over HTTPS and open it on a phone.
# Camera access requires a secure context; localhost over plain HTTP will not do.
```

## Architecture

Five stages, each discarding data: **capture → pose inference → normalization → feature extraction → punch events.** Nothing but keypoints and derived events survives an individual frame. That is not a policy requiring enforcement — it is what the architecture does, and it is the whole privacy story.

The processing loop is driven by the **per-video-frame callback**, never the animation-frame callback. The latter fires on display refresh and will silently reprocess duplicate frames or skip frames entirely, surfacing only as inexplicably noisy velocity data. This is the most common way to get the pipeline subtly wrong.

Full architecture and the reasoning behind every stage: **`docs/spec.md`**.

## This is not the Next.js you know

The app targets **Next.js 16** with the App Router and **React 19**. Conventions differ from what is in training data — async request APIs, caching defaults, and config shape have all moved. When uncertain about a Next API, read `node_modules/next/dist/docs/` in the repo rather than recalling it.

Styling is **Tailwind v4** with the shared TaioTech token set. The dark palette is not a per-project choice — it is shared with Cornerman and the taiotech hub so the surfaces read as one product.

## Working with Claude

Every slash command in `.claude/commands/` inherits this section by name rather than restating it.

<scope>
Do what was asked. No unsolicited refactoring, no adjacent improvements, no scope expansion because something nearby looked wrong. If you find a real problem outside the task, name it in one sentence and keep going — do not fix it uninvited.

Do not create documentation files unless asked. This repo has a documentation architecture; new docs belong in it deliberately, not as a side effect.
</scope>

<communication>
Concise and code-first. Explain reasoning when a decision involves a trade-off or when asked, not by default. Flag security concerns immediately.

Report outcomes faithfully. If a gate did not pass, say so with the output. If a step was skipped, say that. Never describe measured and estimated numbers in the same register — this project has already been burned once by an estimate that was wrong by 2× and propagated through an entire spec.
</communication>

<evidence>
This project is about measurement, and the documentation reflects that discipline: every quantitative claim in `docs/spec.md` is either measured, and says so, or flagged as an assumption pending measurement.

Preserve that. When adding a number to any document, mark which it is. When a measurement contradicts an assumption, correct the assumption in the spec rather than leaving both.
</evidence>

<deliberated_decisions>
`docs/spec.md` carries Non-goals, Open questions, and acceptance criteria with status annotations. These are decided positions, not oversights.

Before proposing a change that undoes one — technique grading, a power metric, video export, merging into Cornerman — check whether the spec already rejected it and why. If the case for reopening is genuinely new, surface the conflict explicitly rather than quietly building the thing.
</deliberated_decisions>

<quality_gates>
Non-negotiable before any change is called done: `npm test`, `npm run lint`, `npm run build`. A phase in `docs/plan.md` is closed by its stated Gate, not by the code existing.

Pipeline logic is unit-tested against recorded keypoint fixtures, never a live camera. Feel, framing, and detection quality cannot be unit-tested and require a real phone and a real workout — say so rather than claiming verification you did not do.
</quality_gates>

## Naming conventions

- TypeScript identifiers: `PascalCase` types and components, `camelCase` values.
- Files: `kebab-case` for modules, `PascalCase.tsx` for components.
- Tests co-located, `*.test.ts` beside the source they cover.
- Docs: `kebab-case.md`; templates and process docs at `docs/` root in `SCREAMING_SNAKE.md`.
- Branches: `phase-N-<topic>` or `docs/<topic>`, matching the sibling repos.
- Commits: Conventional Commits with lowercase feature scopes — `feat(spike):`, `docs(plan):`, `fix(pipeline):`. Spec-only commits use `spec(scope):`.

## Knowledge base

Durable rules live under `docs/knowledge/`, routed by `docs/knowledge/INDEX.md`. Read the index first and load only the docs matching the files you are touching, then state in one line what you loaded.

Each fact lives in exactly one doc. Cross-references go in a doc's `Related` header, never duplicated into prose.

## Slash commands

| Command | Purpose |
|---|---|
| `/0-write-spec` | Draft a feature spec — the permanent record of what to build |
| `/1-review-spec` | Audit a spec for consistency before it goes to planning |
| `/2-plan-spec` | Turn an approved spec into a phased plan with gates |
| `/3-implement-spec` | Execute an approved plan, end to end |
| `/4-review-changes` | Review a diff against the documented conventions and the spec's decided positions |
| `/5-quick-task` | Small ad-hoc work, outside the spec ceremony |
| `/analyze-trace` | Run the offline analyzer over an exported spike trace and report the model-decision table |

## Pointers

- `docs/spec.md` — the specification
- `docs/plan.md` — the build log and current phase
- `docs/SPEC_DRIVEN_DEVELOPMENT.md` — the workflow and when a spec is required
- `docs/knowledge/INDEX.md` — the knowledge-base router
- `docs/mockups.html` — the six annotated screens
- `CHANGELOG.md` — what has shipped
