Review a diff against the repo's conventions and the spec's decided positions.

review @docs/spec.md
review @docs/knowledge/INDEX.md
review @CLAUDE.md

The standing preamble in `CLAUDE.md` → "Working with Claude" applies (scope, communication, evidence, deliberated decisions, quality gates).

## Knowledge base loading

Read `docs/knowledge/INDEX.md` first. Load only the docs whose routing row matches the files the diff touches. State in one line, at the start of the response, which docs were loaded and why.

## Before flagging anything

Check every finding against `docs/spec.md`'s deliberated decisions — its Non-goals, its resolved Open questions, its acceptance criteria — before raising it. Do not recommend "fixes" that undo an intentional, documented trade-off without surfacing the conflict first. Treat the spec's decision log as authoritative context for what counts as a defect versus what counts as working as designed.

## Two checks

**Check A — does the diff contradict something decided.** Does it contradict a documented convention in `CLAUDE.md`, or a decided position in `docs/spec.md` — a Non-goal, a resolved Open question, an acceptance criterion?

**Check B — does the diff owe the knowledge base something.** Does it establish a new durable rule — a pattern applied three or more times, a non-obvious fact that would otherwise be silently rediscovered — that should have been written into `docs/knowledge/` per `docs/KNOWLEDGE_DOC_TEMPLATE.md`, but wasn't?

## Output

Findings in chat, grouped as:

- **Summary** — what the diff does, in one or two sentences.
- **Blockers** — contradicts a decided position or convention; must be fixed.
- **Should fix** — real problems, not blocking.
- **Nitpicks** — everything else worth mentioning.
- **Good stuff** — what the diff got right, worth naming so it keeps happening.
