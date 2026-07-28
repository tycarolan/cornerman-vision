# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- The specification and annotated mockups.
- The Phase 0 spike.
- The Phase 0 findings, folded into the spec.
- The repo documentation architecture: spec-driven workflow, templates, and the knowledge-base router.
- Slash commands for the spec workflow, under `.claude/commands/`.
- `docs/plan.md`, the phase-by-phase build log with explicit gates.
- Labelled block capture in the spike — punch type, context, and declared rep count, so per-punch-type recall is measurable rather than inferred.
- Export schema 2, carrying blocks and per-block model attribution.
- The offline trace analyzer in `tools/`, with `npm run analyze`.
- The Next.js app shell, on the shared TaioTech token set.

### Changed

- The spike's Vercel project is connected to GitHub with `main` as the production branch and `spike/` as the root directory, so merges deploy and pull requests get preview URLs.
- Resolved the open question on integration with Cornerman: the two stay separate applications, each with its own card on the taiotech hub.

### Fixed

- Switching models mid-recording left the recording flag set and appended a second model's frames into the same trace with nothing marking the seam. The switch now closes the open block.
- Flipping the camera left per-side punch state and the framerate window stale, which could fire a spurious detection across the gap.
- Frame numbers reset on every Start, so blocks recorded before a model switch pointed at frame ranges that later blocks also claimed. They are now monotonic for the life of the page.
