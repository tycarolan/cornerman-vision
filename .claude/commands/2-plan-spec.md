Turn an approved spec into a phased implementation plan.

review @$ARGUMENTS
review @docs/PLAN_TEMPLATE.md
review @docs/plan.md
review @docs/knowledge/INDEX.md

The standing preamble in `CLAUDE.md` → "Working with Claude" applies (scope, communication, evidence, deliberated decisions, quality gates).

## Knowledge base loading

Read `docs/knowledge/INDEX.md` first. Load only the docs whose routing row matches the area the spec covers. State in one line, at the start of the response, which docs were loaded and why.

## Produce a plan, not code

Follow `docs/PLAN_TEMPLATE.md`'s shape. This command writes phases, tasks, and gates — it does not write or modify implementation code.

Every phase names:

- A **Goal**, one sentence, what the phase delivers.
- Checkbox tasks (`- [ ]`).
- A literal **Gate** — a command to run or an observation to make, not "code reviewed" or another vague closing condition. A phase is not done because the code exists; it is done because its gate passed.

Include the plan's **Files**, **Decisions**, and **Risks** tables, matching the shape in `docs/PLAN_TEMPLATE.md`.

If this feature has its own spec-and-plan pair under `docs/specs/`, write the matching plan alongside it rather than folding phases into the top-level `docs/plan.md`. If it is scoped within the existing top-level plan, add or revise phases there instead of creating a duplicate document.

## The human gate

This is the one required approval point in the whole workflow, and it sits here deliberately: after planning, before implementation. Planning is cheap to redo; implementation is not.

This command stops once the plan is written. It does not proceed to `/3-implement-spec` on its own, and it does not ask to. Wait for the plan to be approved by a human before that command runs against it.
