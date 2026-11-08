/**
 * Sections, guideline coverage, submission-pack scanning.
 * @module test/analyze-pack.spec
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { checkGuideline, splitSections } from '../src/analyze.ts'
import { GUIDELINES, guidelineOf } from '../src/guidelines.ts'
import { scanPack } from '../src/pack.ts'
import { detectGuidelines } from '../src/runtime.ts'

/** A synthetic CONSORT-style manuscript. */
const MANUSCRIPT = `# A randomized controlled trial of a synthetic intervention

## Abstract
Background: the effect is unknown. Methods: randomized trial. Results: see below. Conclusion: positive.

## Introduction
The background and objective of this randomized controlled trial.

## Methods
Trial design: parallel group. Eligibility criteria: adults. Intervention: drug. Control group: placebo.
Primary outcome: survival. Secondary outcome: adverse events. Sample size: power calculation for 200 participants.
Randomisation via a random sequence; allocation concealment with sealed envelopes. Blinding: double blind.
Statistical methods: intention-to-treat analysis.

## Results
Participant flow diagram; 100 assessed for eligibility, 80 randomly assigned. Baseline table 1. Numbers analysed per arm.
Effect size with confidence interval. Adverse events were rare.

## Discussion
Limitations: short follow-up.

## Conclusion
The intervention may help.

## Declarations
Ethics approval from the IRB. Informed consent obtained. Funding: grant. Conflicts of interest: none.
Data availability: repository. Author contributions: CRediT. Registered: NCT12345678.
`

let root: string

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'manuscript-pack-'))
})

afterEach(async () => {
  if (root.startsWith(tmpdir())) await rm(root, { recursive: true, force: true })
})

describe('sections', () => {
  it('splits markdown headings into canonical section names', () => {
    const sections = splitSections(MANUSCRIPT)
    expect(sections.map(section => section.name)).toEqual(expect.arrayContaining(['abstract', 'introduction', 'methods', 'results', 'discussion', 'conclusion', 'declarations']))
  })

  it('returns no sections when there are no headings', () => {
    expect(splitSections('Just a paragraph.')).toEqual([])
  })

  it('splits plain-text headings when there are no markdown headings', () => {
    const sections = splitSections('ABSTRACT\nText.\n\nMETHODS\nMore text.\n\nRESULTS\nDone.\n')
    expect(sections.map(section => section.name)).toEqual(['abstract', 'methods', 'results'])
    expect(sections[1]?.start).toBeGreaterThan(sections[0]!.start)
  })
})

describe('guidelines', () => {
  it('reports high coverage for a complete CONSORT-style manuscript', () => {
    const guideline = guidelineOf('consort')!
    const result = checkGuideline(MANUSCRIPT, guideline)
    expect(result.coverage).toBeGreaterThanOrEqual(0.9)
    expect(result.met).toBe(true)
  })

  it('lists missing items with advice and locators for present ones', () => {
    const text = '# Title\n\n## Methods\nWe did things.\n'
    const result = checkGuideline(text, guidelineOf('manuscript')!)
    const missing = result.items.filter(item => item.status === 'missing').map(item => item.id)
    expect(missing).toContain('funding')
    expect(missing).toContain('data')
    const methods = result.items.find(item => item.id === 'methods')
    expect(methods?.locator?.charStart).toBeGreaterThanOrEqual(0)
    expect(result.met).toBe(false)
  })

  it('detects the likely guideline from wording', () => {
    expect(detectGuidelines(MANUSCRIPT)).toContain('consort')
    expect(detectGuidelines('This systematic review followed PRISMA.')).toContain('prisma')
    expect(detectGuidelines('A cross-sectional cohort study.')).toContain('strobe')
    expect(detectGuidelines('A plain essay.')).toEqual(['manuscript'])
  })

  it('exposes four guidelines with non-empty item lists', () => {
    expect(GUIDELINES.map(guideline => guideline.id)).toEqual(['manuscript', 'consort', 'strobe', 'prisma'])
    for (const guideline of GUIDELINES) expect(guideline.items.length).toBeGreaterThan(10)
  })
})

describe('submission pack', () => {
  it('accepts a complete pack and flags a figure-numbering gap', async () => {
    await writeFile(path.join(root, 'manuscript.md'), MANUSCRIPT, 'utf8')
    await writeFile(path.join(root, 'cover-letter.md'), 'Dear editor', 'utf8')
    await writeFile(path.join(root, 'Figure1.png'), Buffer.from([1]))
    await writeFile(path.join(root, 'Figure3.png'), Buffer.from([3]))
    await writeFile(path.join(root, 'table1.csv'), 'a,b', 'utf8')
    await mkdir(path.join(root, 'figures'), { recursive: true })
    await writeFile(path.join(root, 'figures', 'Figure4.png'), Buffer.from([4]))
    const report = await scanPack(root)
    expect(report.ready).toBe(true)
    expect(report.figureGaps).toEqual([2])
    expect(report.issues.map(issue => issue.code)).toContain('figure_numbering_gap')
    expect(report.issues.map(issue => issue.code)).toContain('no_declarations_file')
  })

  it('is not ready without a manuscript file', async () => {
    await writeFile(path.join(root, 'cover-letter.md'), 'Dear editor', 'utf8')
    const report = await scanPack(root)
    expect(report.ready).toBe(false)
    expect(report.issues.find(issue => issue.code === 'no_manuscript')?.severity).toBe('error')
  })
})
