Do a small ad-hoc task outside the spec workflow.

review @CLAUDE.md
review @docs/knowledge/INDEX.md

The standing preamble in `CLAUDE.md` → "Working with Claude" applies (scope, communication, evidence, deliberated decisions, quality gates).

## Knowledge base loading

Read `docs/knowledge/INDEX.md` first. Load only the docs whose routing row matches the files this task touches. State in one line, at the start of the response, which docs were loaded and why.

## What belongs here

Work where investigating and doing it is faster than negotiating it: bug fixes, dependency bumps, spike instrumentation tweaks, doc corrections. No spec, no plan — this is the `docs/SPEC_DRIVEN_DEVELOPMENT.md` "No spec" tier, and this command is how it gets done without the rest of the ceremony.

## Escape hatch

If, while doing the task, it turns out to change what the system claims it can measure — a new signal reported, a claim about accuracy or confidence, anything touching the vision pipeline's honesty — stop. That is not a quick task. Say so, and escalate to `/0-write-spec` instead of finishing it here.

## Quality gates

Non-negotiable before this is called done: `npm test`, `npm run lint`, `npm run build`.
