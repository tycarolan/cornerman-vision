# Cornerman Vision

A phone propped at an angle watches a boxing round and reports what happened: how many punches, which ones, how the work rate held up, and whether the guard stayed up. On-device, in a browser. No video is written to disk or transmitted — frames pass from camera to inference and are discarded.

Companion to [Cornerman](https://github.com/TaioTech/cornerman), which calls the combos. This answers whether you threw them.

Working title.

## Status

**Pre-implementation.** Phase 0 — the feasibility spike — has run once and is reopened.

What it settled: framerate is not the constraint. The target phone sustained 57.9fps against an assumed 30, giving 5.7 frames per punch on punches averaging 98ms. Lead-hand detection works with no false positives across a full round of guard movement.

What it broke: three assumptions in the spec, all of them the same problem in different clothes. A single 2D camera cannot see motion travelling along its own depth axis. Rear-hand punches went entirely undetected while crosses were being thrown, the shoulder-width scale reference foreshortens at exactly the camera angles the spec recommends, and elbow angle at peak read between 74° and 95° for every punch including straights.

The blocking decision is **MoveNet or BlazePose** — temporal resolution against dimensional completeness. It is settled by measurement on a real phone, and Phase 1 does not begin until it is.

See [docs/plan.md](docs/plan.md) for what is being built in the meantime.

## Running it

```bash
npm install
npm run dev
```

The spike is a single file with no build step. It needs a secure context for camera access, so it must be served over HTTPS and opened on a phone — a desktop webcam produces badly framed data that is worse than no data.

```bash
npm test        # Vitest, over recorded keypoint fixtures
npm run lint
npm run build
```

## What's in here

```
docs/spec.md         What is being built and why. Authoritative.
docs/plan.md         The build sequence, phase by phase, with gates.
docs/mockups.html    Six annotated screens.
docs/knowledge/      Durable rules, routed by INDEX.md.
spike/index.html     The Phase 0 instrument.
tools/               Offline trace analysis. Never ships to the browser.
```

Development follows a spec-driven workflow — see [docs/SPEC_DRIVEN_DEVELOPMENT.md](docs/SPEC_DRIVEN_DEVELOPMENT.md).

## Non-goals

No technique or form grading, no power metric, no video recording or export, no accounts or backend, no live sparring, no native app. Each of these is a decided position with reasoning in the spec, not an unbuilt feature.

## License

Personal project; not yet licensed for redistribution.
