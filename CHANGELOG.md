# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-11-08

First release: the pre-submission checklist.

### Added

- `manuscript_check`: section detection, declaration statements (ethics,
  consent, funding, conflicts, data availability, contributions, registration)
  and one guideline (`manuscript`, `consort`, `strobe`, `prisma`, `auto`), with
  locators for present items and advice for missing ones.
- `reporting_check`: several guidelines at once plus a flat missing-item list.
- `submission_pack`: submission-directory scan (manuscript, cover letter,
  numbered figures with gap detection, tables, supplements, declarations) and
  JSON + Markdown exports.
- REP v1 integration: checked text becomes immutable evidence with one check per
  guideline item, plus a valid record.
- 18 tests covering sections, coverage, detection, pack scanning, path safety,
  oversize/binary rejection and the tool surface.

### Notes

- Presence is keyword-based; this is a checklist, not a compliance verdict.
- Starter checklists only (14–18 items); certified guideline checklists and
  journal-specific rules are out of scope.
