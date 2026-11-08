# dsh-manuscript-check benchmark: manuscripts

- Dataset: `manuscripts` v0.1.0 (10 synthetic manuscripts, 140 item labels; 525-774 words each)
- Plugin: `dsh-manuscript-check` v0.1.2
- Call: `analyzeManuscript(text, [guidelineOf('manuscript')], ['manuscript'])`
- Command: `pnpm run bench:manuscripts`
- Labels: **135 present / 5 missing**

## Micro-averaged item metrics

| Positive class | TP | FP | FN | TN | Precision | Recall | F1 |
|---|---:|---:|---:|---:|---:|---:|---:|
| `present` (headline) | 130 | 1 | 5 | 4 | 0.9924 | 0.9630 | 0.9774 |
| `missing` (alert) | 4 | 5 | 1 | 130 | 0.4444 | 0.8000 | 0.5714 |

Item accuracy: **0.9571** (134/140). Document-level `missingCoreSections` exact match: **1.0000** (10/10); all-14-items exact match: **0.7000** (7/10).

`present` counts a detected statement as positive; `missing` counts an alert as positive.

## Per document

| Case | Category | Words | Expected missing items | Correct | Accuracy | Present TP | FP | FN | TN | Core missing expected → actual |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|---|
| `ms-0001` | complete-consort | 774 | `[]` | 14/14 | 1.0000 | 14 | 0 | 0 | 0 | `[]` → `[]` |
| `ms-0002` | missing-ethics-consent | 683 | `["ethics","consent"]` | 14/14 | 1.0000 | 12 | 0 | 0 | 2 | `[]` → `[]` |
| `ms-0003` | missing-data-availability | 611 | `["data"]` | 14/14 | 1.0000 | 13 | 0 | 0 | 1 | `[]` → `[]` |
| `ms-0004` | missing-randomization | 636 | `["registration"]` | 14/14 | 1.0000 | 13 | 0 | 0 | 1 | `[]` → `[]` |
| `ms-0005` | missing-abstract | 545 | `["abstract"]` | 13/14 | 0.9286 | 13 | 1 | 0 | 0 | `["abstract"]` → `["abstract"]` |
| `ms-0006` | missing-statistical-methods | 598 | `[]` | 14/14 | 1.0000 | 14 | 0 | 0 | 0 | `[]` → `[]` |
| `ms-0007` | strobe-cohort | 617 | `[]` | 10/14 | 0.7143 | 10 | 0 | 4 | 0 | `[]` → `[]` |
| `ms-0008` | prisma-review | 706 | `[]` | 14/14 | 1.0000 | 14 | 0 | 0 | 0 | `[]` → `[]` |
| `ms-0009` | plain-text-title | 525 | `[]` | 13/14 | 0.9286 | 13 | 0 | 1 | 0 | `[]` → `[]` |
| `ms-0010` | mixed-language-title | 666 | `[]` | 14/14 | 1.0000 | 14 | 0 | 0 | 0 | `[]` → `[]` |

## Per item

| Item | Expected P/M | Present TP/FP/FN/TN | Present P | Present R | Present F1 | Missing TP/FP/FN/TN | Missing P | Missing R | Missing F1 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `title` | 10/0 | 9/0/1/0 | 1.0000 | 0.9000 | 0.9474 | 0/1/0/9 | 0.0000 | n/a | 0.0000 |
| `abstract` | 9/1 | 9/1/0/0 | 0.9000 | 1.0000 | 0.9474 | 0/0/1/9 | n/a | 0.0000 | 0.0000 |
| `introduction` | 10/0 | 10/0/0/0 | 1.0000 | 1.0000 | 1.0000 | 0/0/0/10 | n/a | n/a | n/a |
| `methods` | 10/0 | 10/0/0/0 | 1.0000 | 1.0000 | 1.0000 | 0/0/0/10 | n/a | n/a | n/a |
| `results` | 10/0 | 10/0/0/0 | 1.0000 | 1.0000 | 1.0000 | 0/0/0/10 | n/a | n/a | n/a |
| `discussion` | 10/0 | 10/0/0/0 | 1.0000 | 1.0000 | 1.0000 | 0/0/0/10 | n/a | n/a | n/a |
| `conclusion` | 10/0 | 10/0/0/0 | 1.0000 | 1.0000 | 1.0000 | 0/0/0/10 | n/a | n/a | n/a |
| `ethics` | 9/1 | 9/0/0/1 | 1.0000 | 1.0000 | 1.0000 | 1/0/0/9 | 1.0000 | 1.0000 | 1.0000 |
| `consent` | 9/1 | 9/0/0/1 | 1.0000 | 1.0000 | 1.0000 | 1/0/0/9 | 1.0000 | 1.0000 | 1.0000 |
| `funding` | 10/0 | 9/0/1/0 | 1.0000 | 0.9000 | 0.9474 | 0/1/0/9 | 0.0000 | n/a | 0.0000 |
| `conflicts` | 10/0 | 9/0/1/0 | 1.0000 | 0.9000 | 0.9474 | 0/1/0/9 | 0.0000 | n/a | 0.0000 |
| `data` | 9/1 | 8/0/1/1 | 1.0000 | 0.8889 | 0.9412 | 1/1/0/8 | 0.5000 | 1.0000 | 0.6667 |
| `contributions` | 10/0 | 9/0/1/0 | 1.0000 | 0.9000 | 0.9474 | 0/1/0/9 | 0.0000 | n/a | 0.0000 |
| `registration` | 9/1 | 9/0/0/1 | 1.0000 | 1.0000 | 1.0000 | 1/0/0/9 | 1.0000 | 1.0000 | 1.0000 |

## Mismatches

- `ms-0005` abstract: expected `missing`, predicted `present`; matched `summary` at 2588-2595
- `ms-0007` funding: expected `present`, predicted `missing`; advice: add a funding statement
- `ms-0007` conflicts: expected `present`, predicted `missing`; advice: add a conflicts-of-interest statement
- `ms-0007` data: expected `present`, predicted `missing`; advice: add a data-availability statement with an accession or repository
- `ms-0007` contributions: expected `present`, predicted `missing`; advice: add an author-contributions statement
- `ms-0009` title: expected `present`, predicted `missing`; advice: add a title

## Notes

- Positive class for the headline metrics is present: an item is positive when the manuscript states it.
- The missing matrix treats a missing verdict as positive, so it reports alert precision/recall rather than presence recall.
- Labels are assigned by the generator from the manuscript construction; this adapter never changes them.
- The manuscript guideline has no statistical-methods or randomization item; those content gaps are outside the 14-item label space.
- Synthetic cases and keyword rules were authored by the same project; these numbers are a regression baseline, not an unbiased estimate.
