Write a feature specification — the permanent record of what to build.

review @CLAUDE.md
review @docs/SPEC_DRIVEN_DEVELOPMENT.md
review @docs/SPEC_TEMPLATE.md
review @docs/spec.md
review @docs/knowledge/INDEX.md

The standing preamble in `CLAUDE.md` → "Working with Claude" applies (scope, communication, evidence, deliberated decisions, quality gates).

## Knowledge base loading

Read `docs/knowledge/INDEX.md` first. Load only the docs whose routing row matches the area this spec touches — do not load the whole knowledge base. State in one line, at the start of the response, which docs were loaded and why.

## Research before writing

Read the touched area of the codebase, the spike, and any relevant trace exports before drafting a word. A spec argued from memory instead of from what is actually there is exactly the failure mode this workflow exists to prevent.

## Choose the tier

Apply the three-tier rule from `docs/SPEC_DRIVEN_DEVELOPMENT.md`: full spec, mini spec, or no spec (escalate to `/5-quick-task` if it turns out to be that small). State which tier was chosen and why, before writing the rest of the document. A mini spec may omit "Why this, and why it's scoped this way" and "Open questions" — every other section still applies.

## Write the spec

Follow `docs/SPEC_TEMPLATE.md`'s shape exactly. Prose only — no code blocks. A code block in a spec goes stale the instant implementation diverges from it; describe behavior an operator or reviewer can check against reality, not an implementation detail.

Mark every quantitative claim measured or assumed, with no third category. When a measurement in this draft contradicts an assumption already standing in `docs/spec.md`, correct the assumption in place rather than leaving the two side by side.

Check `docs/spec.md`'s Non-goals and Open questions before proposing anything that reopens a decided position. If the case for reopening is genuinely new, surface the conflict explicitly in the draft rather than quietly building past it.

## Where it goes

Write the new spec to `docs/specs/<kebab-name>.md`. The product-level spec is `docs/spec.md` and this command does not overwrite it — a feature spec supplements it and should name what it depends on from the product spec in its own Related section.
