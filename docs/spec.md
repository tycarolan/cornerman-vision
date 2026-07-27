# Cornerman Vision — Camera-Based Round Analysis

The phone is propped at an angle, watches a boxing round, and reports what happened: how many punches, which ones, how hard the work rate held up, and whether the guard stayed up. Entirely on-device, in a browser, with no video ever leaving the frame buffer.

Working title. The name is unsettled and deliberately parked — see Open questions.

Visual design: `docs/mockups.html` (six screens, annotated).

## Why this, and why it's scoped this way

Cornerman already calls combos at you. The obvious missing half is whether you actually threw them. That question — *did I do what it told me?* — is what this exists to answer.

The scope is set by one hard constraint discovered up front: **browser pose estimation on a phone runs at roughly 30 frames per second, and a fast jab lasts 100–150 milliseconds.** That is four or five frames per punch. Everything in this spec is shaped by living inside that budget rather than pretending it isn't there.

That constraint pushes the product toward the signals that survive coarse sampling — punch count, work rate, and guard position — and away from the ones that don't, like technique grading. It also inverts the obvious model choice: the more accurate pose model is too slow in a browser to see hands at all, so the lighter, coarser model is the correct pick.

The feature that justifies the product is **guard tracking**, and it is deliberately the easiest thing in the system to detect rather than the flashiest. The non-punching hand is slow and nearly static, which is exactly what pose models are reliable at — the opposite of the fast-hand problem that makes punch classification hard. It is also genuinely useful coaching that no timer app provides.

## Non-goals

- **No technique or form grading.** Hip rotation, weight transfer, and shoulder mechanics are not recoverable from a single phone camera at this framerate. Claiming otherwise would be worse than silence: bad form feedback teaches bad habits and risks injury.
- **No force, power, or "punch strength" metric.** Pixel velocity is not force, and presenting it as such would be an invention.
- **No video recording, upload, or playback.** Frames are consumed and discarded. There is no export, no highlight reel, no cloud.
- **No accounts, no backend, no leaderboard.** Everything is local. The only opponent is the previous session.
- **No live sparring or partner work.** One person, shadowboxing or bag work, in frame alone. Two bodies break every assumption in the pipeline.
- **No native app.** Browser only — see Platform.
- **Not a replacement for a coach.** The app reports what it observed; it does not prescribe corrections beyond the guard cue.

## Core behavior

### Setup and framing

The app refuses to start until the camera is positioned usefully, because bad framing corrupts the data *silently* — the numbers still appear, they are simply wrong.

Four checks run continuously against the live preview, each passing or failing independently: **distance** (the full body occupies a usable fraction of the frame), **angle** (the operator's stance is oblique to the lens, not square to it), **lighting** (sufficient for the pose model's confidence scores to hold), and **full body in frame** (all tracked keypoints present). A dashed silhouette shows where to stand, and a small top-down diagram illustrates the intended body-to-phone angle, because the instruction is close to impossible to convey in words alone.

The start control is disabled until all four pass. This is intentionally a little obstructive.

**Why the oblique angle matters:** punching directly toward the camera is the intuitive setup and the worst possible one — a straight punch travels almost entirely along the camera's depth axis, which a 2D-dominant model barely registers as movement. Side-on captures straights cleanly but flattens hooks into ambiguity. An oblique setup around 45° is the only arrangement where straights and hooks both project a visible component. Body-local normalization (below) makes this a strong preference rather than a hard requirement.

### The round

Rounds follow Cornerman's existing work/rest structure. During work, the camera is live and inference runs. **During rest, inference pauses entirely** — a meaningful thermal and battery saving that costs nothing, because the round timer already knows which state it is in.

The live screen carries three numbers at large size: time remaining, punches thrown, and current punches per minute. Nothing else. The operator is several feet away, moving, and will glance at the screen for well under a second between combos, so anything requiring reading is wasted.

**Guard state is rendered as a screen-edge glow rather than a widget.** A red border filling peripheral vision registers while the operator is mid-combo and looking elsewhere entirely; a number in a corner does not.

**The primary live channel is audio, not visual.** A guard drop fires a short, distinct tick the instant it is detected. This is the only feedback that reaches someone whose hands are up and whose eyes are on an imaginary opponent. Every visual element on the live screen is secondary to it, and the app must remain fully usable — if less effective — when muted.

A small docked skeleton overlay sits in a corner. Its only job is answering "is this thing actually tracking me," a question the operator will have constantly and which is corrosive when unanswerable.

### Between and after rounds

The rest period is the only time the screen is genuinely being read, so it carries all the density: punches, punches per minute, guard-held percentage, and work rate — **each with a delta against the previous round.** The raw count is trivia; the fact that guard discipline dropped seven points since the last round is a cue that can be acted on in the next three minutes. An output curve shows where within the round the work faded.

The session summary carries one hero number, per-round output bars, averages, and any personal best just broken. Personal bests are the replay hook and provide the compete-against-yourself mechanic without inventing a game around it.

The **guard timeline** is a dedicated view: one track per round, marked wherever the guard was down. Stacked across a session it exposes a pattern invisible from inside the workout — drops migrating progressively earlier as fatigue accumulates.

## The vision pipeline

Five stages, each discarding data: capture → pose inference → normalization → feature extraction → punch events. Nothing but keypoints and derived events survives an individual frame.

### Capture

Camera access via the standard browser media capture API, requesting the rear camera and **prioritising framerate over resolution**. A lower resolution at 60fps is strictly better here than a higher one at 30 — the pose model downsamples to its own small input size regardless, so excess resolution is discarded before it is ever used.

The processing loop is driven by the **per-video-frame callback**, not the animation-frame callback. The former fires once per actual decoded video frame and supplies presentation timestamps; the latter fires on display refresh and will silently reprocess duplicate frames or skip frames entirely. Neither failure is visible during testing — it surfaces only as inexplicably noisy velocity data. This is the most common way to get the pipeline subtly wrong.

Inference runs off the main thread in a worker against an offscreen surface, so UI rendering stays smooth regardless of inference cost.

### Pose inference

**MoveNet Lightning** is the chosen model, via the maintained TensorFlow.js pose-detection package. Seventeen keypoints, and the only browser-viable option at the framerate punches require.

This is a deliberate inversion of the intuitive choice. The higher-fidelity alternative (BlazePose, 33 landmarks with depth estimates) is substantially more accurate per frame but runs at roughly a third the rate in a browser on mobile — fast enough for yoga or squat counting, far too slow to resolve a punch. Accuracy per frame is worthless if the punch happens between frames.

### Normalization

Raw keypoints arrive in pixel coordinates, which vary with distance from the camera and with where the operator happens to be standing. Two transforms make everything downstream stable:

**Scale normalization** against torso length or shoulder width, so an identical punch produces identical numbers at six feet and at ten.

**Rotation into a body-local coordinate frame**, with the shoulder line as the lateral axis, the spine as the vertical, and the derived normal as forward. After this transform, "the punch travelled forward" is a statement about the body rather than about camera placement.

Skipping this step means hand-tuning thresholds indefinitely that break the moment the phone moves. It is the difference between a demo and something usable in a different room.

### Punch detection

Three per-hand signals are derived each frame: normalized wrist-to-shoulder distance, elbow angle, and wrist velocity.

A punch is registered as a **peak in normalized wrist-to-shoulder distance** satisfying: a rise time within a plausible window, an amplitude above a scale-independent threshold, **a subsequent retraction**, and a refractory interval preventing a single punch from registering twice.

The retraction requirement is what distinguishes a punch from reaching, pointing, or adjusting a glove — and it costs nothing.

This stage is deliberately **heuristic, with no machine learning and no training data.** It is the tier the system can be confident about, and it alone supports punch count, punches per minute, work rate, and combo timing.

### Punch classification

The six-punch problem is not a six-way classification problem, and recognising that is what makes it tractable.

**Which hand threw the punch is free and near-perfect** — it is simply which wrist moved, read directly from pose. Odd numbers are the lead hand, even the rear. Six classes therefore collapse immediately into **two independent three-way problems**: for each hand, was that a straight, a hook, or an uppercut?

Three-way separation rests on two interpretable features:

| Class | Elbow angle at peak | Dominant displacement axis |
|---|---|---|
| Straight (1, 2) | Near-full extension | Forward |
| Hook (3, 4) | Remains sharply bent | Lateral |
| Uppercut (5, 6) | Remains bent | Vertical |

Elbow angle cleanly separates straights from everything else — a strong, near-binary signal. Dominant displacement axis then separates hook from uppercut. **This ships first as a hand-tuned decision tree over interpretable features, before any model is trained.**

Classification operates over the **full punch cycle including retraction**, not the outbound half alone. The return is slower and more distinctive, and extension-plus-retraction spans roughly three times as many frames — a free tripling of sample count at no cost.

Known weaknesses, stated plainly: hook versus uppercut is the confusion pair, since both keep the elbow bent and a tight upward hook genuinely is an intermediate case. Maximum-speed punches may not have a frame at peak extension, causing a straight to read as a hook. Overhands and looping shots sit between classes by definition. Realistic expectation is **near-perfect hand identification, high straight-versus-other accuracy, and 80–90% full six-way accuracy at training speed, degrading as speed increases.**

### Calibration — how the training-data problem is avoided

There is no adequate public labelled boxing dataset, and building a general one is the real cost of a project like this. It is avoided by not building a general model at all.

**The app collects its own data.** A calibration mode prompts for roughly ten repetitions of each punch in turn. Ninety seconds produces sixty labelled examples from the operator's own body, camera angle, lighting, and stance.

A personalized model trained on those samples will outperform a general model trained on thousands of strangers, because it never has to generalize across body types or camera placements. This is the single largest accuracy lever in the system and it costs a minute and a half of the operator's time.

The model consumes **normalized keypoint windows, never pixels** — dramatically cheaper and better-generalizing. A small temporal classifier over roughly half a second of frames is sufficient; this is a sub-100KB artifact, not a deep network.

## Open-source dependencies

| Project | Role | Licence |
|---|---|---|
| **TensorFlow.js pose-detection** (`@tensorflow-models/pose-detection`) | Runtime pose estimation, MoveNet Lightning. Actively maintained by the TensorFlow team; explicitly targeted at real-time in-browser fitness use. | Apache 2.0 |
| **MediaPipe Tasks Vision** | Evaluated alternative (BlazePose). Rejected for runtime on framerate grounds; retained as a fallback if the browser performance picture shifts. | Apache 2.0 |
| **MMAction2** (OpenMMLab) | *Offline only.* Reference implementations of skeleton-based action recognition — ST-GCN and PoseC3D — used to establish the accuracy ceiling and validate the shipped lightweight classifier. | Apache 2.0 |

Two notes on the third row. PoseC3D is documented as **more robust to pose-estimation noise and better at cross-dataset generalization than graph-convolution approaches**, which is directly relevant given that noisy keypoints are this system's central problem — and there is prior work fine-tuning it specifically for six punch classes by retraining only the classifier head. However, it operates on 3D heatmap volumes and is far too heavy for real-time browser inference. **It belongs in the offline toolchain as a benchmark and labelling aid, never in the shipped runtime.**

Explicitly avoided: `@tensorflow-models/posenet`, the deprecated predecessor to the pose-detection package. Superseded and not to be used.

## Data model and analytics

Each detected punch records: timestamp relative to round start, hand, class with a confidence score, peak velocity, extension quality, and — the field that earns its place — **the guard state of the opposite hand at that instant.** That last one makes observations like *the rear hand drops specifically on lead hooks* possible, which is the kind of thing a coach says and no app reports.

**Combos are derived, not separately detected.** Grouping timestamped punches by inter-punch interval reconstructs the thrown sequence, which can then be compared against the combo Cornerman prescribed. The original *did I do what it told me* question is answered as a consequence of the punch stream rather than as its own feature.

Round-level rollups: count, punches per minute, output curve, combo accuracy, guard-held percentage, work rate. Session-level: totals, per-round series, guard trend, personal bests.

Storage is local only — an indexed store for the punch stream, which is high-volume, and simple key-value storage for aggregates and records.

## Privacy

**No video is written to disk or transmitted, ever.** Frames pass from camera to inference and are discarded within the worker. Only keypoints and derived events persist.

This is not a policy requiring enforcement — it is what the architecture does. It is also the difference between an app one would run in a gym and one that stays uninstalled.

## Performance and thermals

Sustained camera capture plus continuous inference across a full session is genuinely demanding, and an overheating phone that throttles mid-round degrades data quality precisely when the operator is most fatigued and the guard data is most interesting.

Mitigations: **inference gated to work intervals only**, downscaling to the model's native input size before inference rather than after, all inference off the main thread, and hardware-accelerated backends with a portable fallback. Thermal state should be observed where the platform exposes it, and sustained degradation surfaced honestly rather than silently corrupting the numbers.

## Platform

Browser only, and this is a constraint rather than a preference: the operator's development machine is centrally managed with platform developer accounts unavailable, closing the native mobile route entirely. Fortunately in-browser pose estimation is mature, and the alternative would trade a large amount of friction for a modest accuracy gain.

Stack matches Cornerman and the taiotech hub — same framework, same styling approach, same dark palette so the surfaces read as one product. Camera access requires a secure context, which the existing hosting provides.

Unit-testable logic (normalization, peak detection, classification, rollups) is covered by the same test runner Cornerman uses, driven by **recorded keypoint fixtures** rather than live camera input — which is what makes the pipeline testable at all. Feel, framing, and detection quality cannot be unit-tested and require a real phone and a real workout.

## Phasing

**Phase 0 — the spike. Everything else is gated on this.** A throwaway page running MoveNet against the live camera, plotting normalized wrist-to-shoulder distance, elbow angle, and wrist velocity, and logging the traces. The question it answers: *are the peaks clean and separable at the operator's actual punching speed, in the operator's actual lighting?* One evening. If the signal is mush, phases 1–4 do not proceed as specified and the product narrows to work rate and guard only.

**Phase 1 — detection and count.** Framing checks, capture pipeline, normalization, peak detection. Delivers punch count, punches per minute, work rate, the live screen, and round summaries. No classification.

**Phase 2 — guard tracking.** Guard state detection, the audio cue, the edge-glow treatment, guard-held percentage, and the guard timeline view. This is the differentiating phase and it depends on none of the classification work.

**Phase 3 — classification.** Heuristic decision tree over elbow angle and dominant axis. Six-way punch typing, with confidence surfaced honestly in the UI.

**Phase 4 — calibration and the learned classifier.** The guided capture mode, per-user model training, and replacement of the heuristic tree where it measurably wins. Combo reconstruction and comparison against prescribed combos.

Phases 1 and 2 constitute a complete, useful product on their own. Phases 3 and 4 are upside.

## Acceptance criteria

1. The start control remains disabled until all four framing checks pass, and each check responds correctly to being individually broken.
2. Detected punch count is within 5% of a hand count over a full three-minute round of mixed combos, verified against video review, on a real phone.
3. Detection accuracy holds across a distance change from roughly six to ten feet with no threshold retuning — demonstrating that scale normalization works.
4. Detection accuracy holds when the phone is repositioned within a reasonable angular range — demonstrating that body-local normalization works.
5. A guard drop produces an audible cue within 300ms of occurring.
6. The application is fully usable muted, with no feature reachable only through audio.
7. Inference is verifiably suspended during rest intervals.
8. No video data is written to storage or emitted over the network — confirmed by inspecting both.
9. A full six-round session completes without thermal throttling degrading the framerate below the detection floor.
10. Hand identification (lead versus rear) is at least 98% accurate against a labelled review.
11. Six-way classification accuracy is measured and **reported in the UI as a confidence level**; the system never presents a low-confidence classification as certain.
12. All pipeline logic is unit-tested against recorded keypoint fixtures, independent of a live camera.

## Open questions

- [ ] **The name.** *Cornerman Vision* is a working title. A rename of Cornerman itself was discussed and deliberately parked — the existing name is liked, the live domain and certificate would need reissuing, and another workstream is currently active in that repository. Revisit once that lands.
- [ ] **Separate application or a Cornerman mode?** Built standalone first, deliberately: if detection quality proves inadequate, that finding should not have contaminated a working timer. Merging afterward is straightforward and there is a real argument for it — the timer already knows work from rest, which is what makes inference gating free. Decide after Phase 2.
- [ ] **Guard threshold definition.** "Hand down" needs a precise, scale-normalized definition — presumably a wrist position relative to chin height and centreline — plus a dwell time so that the natural drop during a punch is not counted. Requires tuning against real footage.
- [ ] **Southpaw and stance switching.** Lead/rear is currently inferred from stance. Whether stance is configured once or detected continuously is unresolved; switching mid-round would break the odd/even mapping.
- [ ] **Bag work versus shadowboxing.** Heavy bag work introduces an occluding object and a very different retraction profile. Whether the same thresholds serve both is unknown and should be tested in Phase 1.
- [ ] **Confidence presentation.** How to show an uncertain classification without either overclaiming or making the display noisy. Affects criterion 11.

## Related

- `docs/mockups.html` — the six annotated screens this spec describes
- Cornerman — the round timer and combo library this eventually attaches to; separate repository, no code dependency
