# dsh-manuscript-check

**Before you submit: is the manuscript complete, does it report what the guideline asks for, and is the submission pack actually packed?**

*A keyword-based checklist with locators and advice — structure and declarations, starter CONSORT / STROBE / PRISMA item coverage, and a submission-directory scan.*

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24.9-brightgreen.svg)]()

English · [简体中文](README-zh.md)

---

## What it does

- **`manuscript_check`** — detects title/abstract/introduction/methods/results/discussion/conclusion, the usual declarations (ethics, consent, funding, conflicts, data availability, contributions, registration), and checks one guideline (`manuscript` default, `consort`, `strobe`, `prisma`, or `auto` from the wording). Missing items come with advice; present items carry the character range that matched.
- **`reporting_check`** — several guidelines at once, a flat missing-item list ready to paste into a submission checklist.
- **`submission_pack`** — scans a submission directory for manuscript, cover letter, numbered figures (detects numbering gaps), tables, supplements and declarations; writes a JSON + Markdown pack report.

## What it does not do

- **No compliance verdict.** Presence is detected by keyword patterns. A statement written in different words can be missed, and a present keyword does not mean the content is adequate. The README and tool descriptions say this; so does every report.
- **No PDF/DOCX parsing.** Convert to `.md`/`.txt`/`.tex`, or extract PDF text with `dsh-doc-anchor`.
- **No full guideline reproduction.** These are starter checklists (14–18 items), not the certified CONSORT/STROBE/PRISMA checklists.
- **No upload, no conversion, no renaming.** The pack scan reports; it never moves a file.
- **No journal-specific rules** (word limits, reference styles): those belong to a journal profile, not this plugin.

## Coverage targets

| Guideline | Items | Target |
|---|---:|---:|
| `manuscript` (structure + declarations) | 14 | 80% |
| `consort` (starter) | 18 | 75% |
| `strobe` (starter) | 16 | 75% |
| `prisma` (starter) | 17 | 75% |

Coverage below the target is flagged as "below target"; it is not an error.

## Tools

### `manuscript_check`

`{ text? | path?, guideline?, persist? }` → `{ ok, analysis, evidenceId?, recordPath? }`.
`analysis = { sections, missingCoreSections, wordCount, results[], notes }`.

### `reporting_check`

`{ text? | path?, guidelines?: string[] }` → `{ ok, analysis, missing[], evidenceId? }`.

### `submission_pack`

`{ path?, recursive? }` → `{ ok, pack, exports: {json, markdown} }`.

### Error codes

`INVALID_INPUT` · `NOT_FOUND` · `PATH_ESCAPE` · `NOT_A_FILE` · `NOT_A_DIRECTORY` · `TOO_LARGE` · `UNSUPPORTED_FILE` · `STORE_ERROR`

## Compatibility & install

| | |
|---|---|
| DeepSeek Harness | **`dsh-v0.2.1-rc.5`** (verified 2026-11-08); peer `>=0.2.1-0 <0.3.0 \|\| >=0.2.2-0 <0.3.0` |
| Node | `^22.19.0 \|\| >=24.9.0` (tested `24.22.1`), ESM only |
| Peers | `@perrylink/dsh-research-core ^0.1.0`, `@deepseek-ai/cordis ^4.0.5-alpha.1`, `@deepseek-ai/dsh-tools`, `@deepseek-ai/schemastery ^3.18.5-alpha.1` |
| Runtime dependencies | **zero** |

```sh
dsh plugin --profile <name> add @perrylink/dsh-research-core dsh-manuscript-check
dsh --profile <name> --dump-config | grep dsh-manuscript-check
```

## Configuration

| Key | Default | Meaning |
|---|---|---|
| `enabled` | `true` | `false` mounts nothing |
| `root` | `.manuscript-check` | store, records and exports root |
| `workspaceRoot` | `process.cwd()` | manuscript paths must resolve inside it |
| `maxChars` | `2000000` | hard cap (fails; never truncates) |
| `persist` | `true` | store the checked text as REP evidence + record |

## Security boundaries

- Read-only on the manuscript; the only writes are under `root`.
- Path containment with `realpath` (symlink escapes rejected).
- Character cap fails loudly instead of truncating; a file is byte-capped
  before it is read, so an oversized file cannot exhaust memory.
- PDF/DOCX are rejected with a clear message rather than parsed unsafely.

## Evaluation

**22 tests**: section splitting (markdown + plain + mixed markdown-title/plain-section), guideline coverage (complete CONSORT-style fixture ≥90%, missing items with advice, locators), auto-detection, guideline catalogue, pack scanning (complete pack, figure gap, missing declarations, not-ready without a manuscript), runtime (REP record validity, auto guideline + file reading, traversal/binary/oversize rejection including a pre-read byte cap, pack exports), tools (schemas, flat missing list, failure branch), package contract.

### Synthetic manuscript benchmark

A separate deterministic benchmark (dataset `manuscripts` v0.1.0, frozen) lives in the sibling `dsh-research-bench` repository under `data/manuscripts`; it is not vendored into this package. Ten 300–800-word synthetic manuscripts (525–774 words each; 6,361 total) carry **140 item labels** from the 14-item `manuscript` guideline (135 present / 5 missing), plus a document-level `missingCoreSections` label.

Coverage: complete CONSORT-style trial, missing ethics/consent, missing data availability, missing randomization/registration, missing abstract, missing statistical methods, STROBE-style cohort, PRISMA-style review, a plain-text title without markdown `#`, and a mixed Chinese-English title.

The adapter calls `analyzeManuscript(text, [guidelineOf('manuscript')], ['manuscript'])` once per manuscript and writes [`bench/results-manuscripts.json`](bench/results-manuscripts.json) and [`bench/results-manuscripts.md`](bench/results-manuscripts.md) (no timestamps; re-running is byte-identical).

```sh
pnpm run bench:manuscripts   # builds, then reads ../dsh-research-bench/data/manuscripts (BENCH_DIR overrides)
```

| Metric | TP | FP | FN | TN | Precision | Recall | F1 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Item presence (positive = `present`, headline) | 130 | 1 | 5 | 4 | 0.9924 | 0.9630 | 0.9774 |
| Missing-item alert (positive = `missing`) | 4 | 5 | 1 | 130 | 0.4444 | 0.8000 | 0.5714 |

- Item accuracy **0.9571** (134/140); per-document accuracy ranges from 0.7143 to 1.0000.
- Document-level `missingCoreSections` exact match **10/10** (1.0000).
- All 14 items are exact on 7/10 documents.

**Measured misses (labels were not changed).** Four of the five presence misses are in the content-complete STROBE manuscript: `funding` ("supported by"), `conflicts` ("competing financial interests"), `data` ("dataset is deposited"), and `contributions` (a roles line with no "Author contributions" or CRediT cue). The fifth is the plain-text title: the title cue requires `#` or `Title:`, so a standalone plain title line is missed. The single false present is `abstract` in the missing-abstract manuscript, where "In summary" in the discussion matches `summary`. Because missing alerts are what a user acts on, the alert row matters: four missed present items plus the plain title become five false alarms, so alert precision is 0.4444 even though presence coverage is high.

**Label-space limit.** The 14-item `manuscript` guideline has no statistical-methods or randomization item. `ms-0004` (no randomization/registration) and `ms-0006` (no statistical methods) exercise those content gaps, but only `ms-0004`'s missing registration is scored; `ms-0006` is all-14-present by construction. Do not cite this benchmark as evidence that those two gaps are detected.

**Validity caveat.** The ten synthetic manuscripts and the keyword rules were authored by the same project. This is a **regression baseline, not an unbiased estimate** of real-manuscript accuracy. Labels are fixed by the generator; none was changed after seeing the detector.

## Known limitations (v0.1)

- Keyword detection: different wording → false "missing"; keyword present → not an adequacy check.
- English cues only; Chinese manuscripts need their own cue lists.
- No journal-specific requirements (word count, reference style, ORCID, submission-system metadata).
- Pack scan is depth-limited and filename-based; embedded tables are not detected.

## License

Apache-2.0. No third-party runtime code.
