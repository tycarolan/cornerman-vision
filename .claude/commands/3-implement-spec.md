Implement a feature from an approved plan, end to end.

review @$ARGUMENTS
review @docs/spec.md
review @docs/knowledge/INDEX.md

The standing preamble in `CLAUDE.md` → "Working with Claude" applies (scope, communication, evidence, deliberated decisions, quality gates).

## Knowledge base loading

Read `docs/knowledge/INDEX.md` first. Load only the docs whose routing row matches the files this phase touches. State in one line, at the start of the response, which docs were loaded and why.

## Work the plan

Work phases in the order the plan states them. Within a phase, tick its checkbox tasks in the plan file as each one completes — the plan file is the running record, not a one-time reference.

Before moving to the next phase, run that phase's stated **Gate** — the literal command or observation the plan named. Never mark a phase done on a failing gate, and never move to the next phase until the current one's gate has actually passed. If a gate cannot pass, stop and say so with the output, rather than continuing past it.

## Worktree convention

If this work needs a worktree, it goes in `.claude/worktrees/`, named after the branch (e.g. `.claude/worktrees/phase-1-detection`), created manually with `git worktree add` — never an auto-generated ID, and never the isolated-worktree mode of an agent tool.

## On completion

Once every phase in scope is done and its gate has passed:

- Update `docs/plan.md`'s Progress table to reflect the new status.
- Add an entry to `CHANGELOG.md` under Unreleased describing what shipped.
- Absorb any durable rule this work established into `docs/knowledge/`, following `docs/KNOWLEDGE_DOC_TEMPLATE.md`'s shape, and add or update its row in `docs/knowledge/INDEX.md`. A rule belongs here only once it has been earned by the work just done, not written in anticipation.

## Quality gates

Non-negotiable before any phase or the overall change is called done: `npm test`, `npm run lint`, `npm run build`. Pipeline logic is unit-tested against recorded keypoint fixtures, never a live camera — say so plainly if a change needs a real phone and a real workout to actually verify, rather than claiming verification that wasn't done.
