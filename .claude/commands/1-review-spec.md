Audit a feature specification before it goes to planning.

review @$ARGUMENTS
review @docs/spec.md
review @docs/SPEC_TEMPLATE.md
review @docs/knowledge/INDEX.md

The standing preamble in `CLAUDE.md` → "Working with Claude" applies (scope, communication, evidence, deliberated decisions, quality gates).

## Knowledge base loading

Read `docs/knowledge/INDEX.md` first. Load only the docs whose routing row matches the area the spec under review touches. State in one line, at the start of the response, which docs were loaded and why.

## Review criteria

Work through all six, in order, against the spec named in the command argument:

1. **Internal consistency.** Contradictions between sections; acceptance criteria that don't match the stated Non-goals or Core behavior.
2. **Template alignment.** Every section `docs/SPEC_TEMPLATE.md` requires is present (a mini spec may omit "Why this, and why it's scoped this way" and "Open questions" — nothing else).
3. **Alignment with the product spec.** Nothing in the draft contradicts a decided position already standing in `docs/spec.md` — its Non-goals, its resolved Open questions, its acceptance criteria — without saying so.
4. **Measured versus assumed.** Every quantitative claim is marked one or the other, with no third category and none left ambiguous.
5. **Acceptance criteria are independently verifiable.** Each one names how it is verified — by test, by measurement, by inspection, or by a specific manual check — not left as an assertion.
6. **Nothing claimed that a single 2D camera cannot support.** This project's characteristic failure mode: technique grading, a power metric, or any signal that depends on motion along the camera's own depth axis, presented as though a 2D pipeline can deliver it.

## Before flagging a conflict

Do not recommend a change that undoes a documented decision in `docs/spec.md` — a Non-goal, a resolved Open question, a Locked Decision — without first surfacing the conflict explicitly. State what the product spec decided, why, and only then whether the draft's departure is a genuine problem or a deliberate, justified difference.

## Output

Findings in chat, not written to any file, grouped as:

- **Blockers** — must be fixed before this goes to `/2-plan-spec`.
- **Should fix** — real problems, not blocking.
- **Nitpicks** — everything else worth mentioning.
