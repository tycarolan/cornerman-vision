# Spec-Driven Development

## Why

This is a measurement-driven project, and that is the whole argument for writing specs before code. `docs/spec.md` was built on an assumed 30fps ceiling for browser pose estimation — a plausible number, never measured, that shaped the frame budget, the model choice, and the case against BlazePose. Phase 0 measured the real number: 57.9fps, off by roughly 2×. Because the assumption had been written down as a premise rather than buried in a constant somewhere in a pipeline, the error was findable. It had a name, a location in the document, and a chain of decisions that named it as their reason. Finding it meant reopening one paragraph, not auditing a codebase.

Had that same assumption lived only as a threshold in code, the error would have looked like normal tuning drift, if it was ever noticed at all. Nothing would have pointed back at the 30fps figure as the thing to check, because nothing would have written down that 30fps was a figure rather than a fact. The spec is what makes an assumption legible enough to be wrong out loud.

That is the case for specs on this project specifically: not process for its own sake, but a place to put a claim before it is spent. Every number in `docs/spec.md` is marked measured or assumed for the same reason a lab notebook dates its entries — so that later, when something doesn't add up, there is a record of what was known versus guessed at the time, and the guess can be found and corrected before it costs another phase of work.

## Spec versus plan

A spec is the permanent record of **what** is being built and **why**. It lives in `docs/`, survives the feature, and gets corrected rather than deleted when it turns out wrong — see Phase 0 above, folded back into `docs/spec.md` rather than left as a separate correction note.

A plan is the temporary record of **how**, phase by phase, each phase closed by a stated gate rather than by the code existing. `docs/plan.md` is disposable in a way the spec is not: once every phase ships, the plan has done its job and can be archived or trimmed without losing anything that mattered. What mattered gets written back into the spec or into `docs/knowledge/` first.

This repo currently has exactly one of each, because it is one product, not a monorepo. `docs/spec.md` and `docs/plan.md` cover the whole thing. If a feature ever grows large enough to need its own spec-and-plan pair — something genuinely separable, with its own acceptance criteria — it gets `docs/specs/<name>.md` and a matching plan, rather than being wedged into the top-level pair or given none at all.

## When a spec is required

**Full spec.** New user-facing capability. Anything that changes what the system claims it can measure. Anything touching the vision pipeline's honesty — what it reports, and with what confidence. Follows `docs/SPEC_TEMPLATE.md` in full.

**Mini spec.** A self-contained change with a clear boundary: a new view over data already collected, a new metric derived from existing events. Covers Summary, Non-goals, Core behavior, and Acceptance criteria only — the template marks which sections a mini spec may skip.

**No spec.** Bug fixes, dependency bumps, doc corrections, spike instrumentation changes, anything where investigating and doing it is faster than negotiating it. Use `/5-quick-task`.

## The workflow

`/0-write-spec` drafts the spec: the reasoning, the scope, the non-goals, the acceptance criteria. This is where the argument gets made, not just the conclusion.

`/1-review-spec` audits that draft for internal consistency — contradictions between sections, acceptance criteria that don't match the stated non-goals, numbers that aren't marked measured or assumed — before anyone plans against it.

`/2-plan-spec` turns an approved spec into `docs/plan.md`: phases, files, tasks, and a gate for each phase.

**Human gate.** This is the one approval point in the chain, and it sits here deliberately — after planning, before implementation. Planning is cheap to redo; implementation is not. This is the cheapest place to catch a wrong direction, and the only place a human is required to look before code gets written.

`/3-implement-spec` executes the approved plan, phase by phase, against its gates.

`/4-review-changes` reviews the resulting diff against the spec's decided positions and this repo's conventions — checking that what shipped matches what was approved, not re-litigating what was already decided.

## Specs describe behavior, not code

`docs/spec.md` contains no code blocks, deliberately. A code block in a spec goes stale the instant implementation diverges from it, and from that moment the spec is not merely incomplete — it is actively misleading, worse than no spec at all, because a reader trusts it as current.

A few contrasts, drawn from this project's own domain:

BAD: "a `PunchDetector` class with a `detect(keypoints: Keypoint[])` method."
GOOD: "a punch is registered as a peak in normalized wrist-to-shoulder distance satisfying a rise time, an amplitude threshold, a subsequent retraction, and a refractory interval."

BAD: "`normalizeScale(kp)` divides by `dist(leftShoulder, rightShoulder)`."
GOOD: "reach is normalized against torso length or shoulder width, so an identical punch produces identical numbers at six feet and at ten — except that a 2D shoulder-width denominator foreshortens at oblique angles, which is why this normalization is under revision."

BAD: "guard state is a boolean `guardUp: boolean` toggled by `wristY > chinY + threshold`."
GOOD: "a hand is scored down when its position relative to chin height and centerline crosses a scale-normalized threshold and holds there past a dwell time, so a punch's momentary drop through that zone does not register as a guard failure."

BAD: "the classifier is a `tf.Sequential` with two dense layers."
GOOD: "a small temporal classifier over roughly half a second of normalized keypoint frames separates straight, hook, and uppercut per hand — sub-100KB, trained on the operator's own calibration reps rather than a general dataset."

Each GOOD version states behavior an operator or a reviewer can check against reality without opening a file. Each BAD version is a fact about today's implementation that the next refactor will quietly break.

## Measured versus assumed

Every quantitative claim in a spec is marked one or the other, with no third category. The framerate figure is the reason this rule exists: an assumed 30fps ceiling sat in `docs/spec.md` unmarked as an assumption, was treated as load-bearing fact by every phase downstream of it, and was wrong by roughly 2× when Phase 0 finally measured it.

The rule going forward: when a measurement contradicts an assumption, the spec is corrected in place. The two are never left standing side by side as competing figures for a reader to arbitrate between. And the phase that depended on the wrong assumption is re-examined, not carried forward on the theory that its conclusion might still happen to hold — the model choice in `docs/spec.md` is exactly this case: the reasoning that picked MoveNet rested on the 30fps figure, so that decision reopened the moment the figure did, rather than being grandfathered in.

## Knowledge absorption

A spec is where an idea is argued into shape; `docs/knowledge/` is where the rule survives after the argument is forgotten. When a spec's work completes, whatever in it will still be true after this feature itself is history migrates out.

The trigger is simple: if a sentence in the spec will still be a fact worth knowing once nobody remembers why this feature was built, it belongs in `docs/knowledge/`, not only in the spec's prose. The mechanism is `docs/KNOWLEDGE_DOC_TEMPLATE.md` — a single-ownership invariant, where each fact lives in exactly one doc, and reciprocal `Related` headers so cross-references never drift into duplicated, disagreeing copies. The maintenance contract is `docs/knowledge/INDEX.md`: a new doc gets a row there, and an existing doc's `Last verified` date is updated whenever its rules are re-confirmed rather than left to go stale silently.

## Open questions are first-class

An open question in a spec is written as `- [ ]` and left there, unresolved, in full view, rather than handled in a side conversation and dropped. When it resolves, the line becomes `- [x]` and the resolution is written inline — the line is never deleted. The reasoning is the valuable part; a future session needs to see that a thing was considered and decided, not just that it doesn't appear.

`docs/spec.md`'s "Bag work versus shadowboxing" question is the working example: resolved by making calibration a per-setup step with separate profiles per context, and the line still reads out the original question, the resolution, and the two mechanical cautions that resolution left behind — rather than vanishing once decided.

## References

- `docs/spec.md` — the specification
- `docs/plan.md` — the current plan and phase gates
- `docs/SPEC_TEMPLATE.md`
- `docs/PLAN_TEMPLATE.md`
- `docs/KNOWLEDGE_DOC_TEMPLATE.md`
- `docs/knowledge/INDEX.md`
- `CLAUDE.md`
