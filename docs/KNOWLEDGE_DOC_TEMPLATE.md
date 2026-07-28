<!--
  Single-ownership invariant: each fact lives in exactly one knowledge doc.
  If two docs would otherwise state the same rule, one of them keeps it and
  the other links to it — cross-references belong in the Related header,
  never duplicated into prose. A reader should be able to trust that any
  fact they find here is not contradicted or restated with drift elsewhere.
-->

# <Title>

> **Authoritative for**: *the specific facts this doc owns — name them, don't describe a vague topic*
> **Related**: *other docs this one cross-references — must be reciprocal, every doc named here names this one back*
> **Last verified**: *date*

## Rules

*Load-bearing facts. Each one cites the spec section or commit it comes from.*

## Patterns

*Recurring shapes — things applied three or more times elsewhere in the codebase, described once here.*

## History

*Why a non-obvious rule exists. Name the bug or incident it prevents, not just what changed.*

---

Authoring checklist:

- [ ] Authoritative-for lists specific facts, not vague concepts
- [ ] Related is reciprocal — every doc named here names this one back
- [ ] Last verified is current
- [ ] Every rule cites its source
- [ ] History explains why, not what
- [ ] No fact is duplicated across docs
- [ ] Doc is under ~300 lines
- [ ] Every rule is load-bearing — no filler
