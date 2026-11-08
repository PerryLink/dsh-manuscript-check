/**
 * Submission-pack scanning.
 *
 * A bounded directory scan that checks the usual submission furniture: a
 * manuscript file, a cover letter, numbered figures, tables, supplementary
 * material and the declaration statements. It reports what is missing; it never
 * renames, moves or converts anything.
 *
 * @module dsh-manuscript-check/pack
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

/** One pack entry. */
export interface PackEntry {
  readonly path: string
  readonly kind: 'manuscript' | 'cover-letter' | 'figure' | 'table' | 'supplement' | 'declarations' | 'reviewer-response' | 'other'
  readonly bytes: number
}

/** One pack issue. */
export interface PackIssue {
  readonly code: string
  readonly severity: 'info' | 'warning' | 'error'
  readonly detail: string
  readonly suggestion: string
}

/** The pack report. */
export interface PackReport {
  readonly rootId: string
  readonly entries: readonly PackEntry[]
  readonly issues: readonly PackIssue[]
  readonly figures: readonly string[]
  readonly figureGaps: readonly number[]
  readonly ready: boolean
}

/** Classify one file name. */
function kindOf(relative: string): PackEntry['kind'] {
  const base = path.basename(relative).toLowerCase()
  const extension = path.extname(base)
  if (/(cover.?letter|submission.?letter)/u.test(base)) return 'cover-letter'
  if (/(response|rebuttal|reviewer)/u.test(base) && /\.(md|txt|docx|pdf)$/u.test(base)) return 'reviewer-response'
  if (/(manuscript|paper|main)\.(docx?|pdf|tex|md)$/u.test(base)) return 'manuscript'
  if (/^fig(ure)?[\s_-]?\d+\.(png|jpe?g|tiff?|eps|svg|pdf)$/u.test(base)) return 'figure'
  if (/^table[\s_-]?\d+\.(docx?|csv|xlsx|pdf)$/u.test(base)) return 'table'
  if (/(supplement|appendix)/u.test(base)) return 'supplement'
  if (/(declaration|ethics|consent|funding|conflict|data.?availability)/u.test(base) && /\.(md|txt|docx|pdf)$/u.test(base)) return 'declarations'
  if (['.docx', '.doc', '.pdf', '.tex', '.md'].includes(extension)) return 'other'
  return 'other'
}

/**
 * Scan a submission directory (one level, non-recursive by default).
 * @param root - absolute directory.
 * @param options - `recursive` descends one extra level.
 * @returns the pack report.
 */
export async function scanPack(root: string, options: { recursive?: boolean; maxEntries?: number } = {}): Promise<PackReport> {
  const maxEntries = options.maxEntries ?? 2000
  const entries: PackEntry[] = []
  let truncated = false
  const walk = async (directory: string, depth: number): Promise<void> => {
    if (depth > 2) return
    let listing
    try {
      listing = await readdir(directory, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of listing.sort((left, right) => left.name.localeCompare(right.name))) {
      if (entries.length >= maxEntries) { truncated = true; return }
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        if (depth < (options.recursive === true ? 2 : 0) || entry.name.toLowerCase() === 'figures') await walk(absolute, depth + 1)
        continue
      }
      if (!entry.isFile()) continue
      const info = await stat(absolute)
      const relative = path.relative(root, absolute).split(path.sep).join('/')
      entries.push({ path: relative, kind: kindOf(relative), bytes: info.size })
    }
  }
  await walk(root, 0)

  const figures = entries.filter(entry => entry.kind === 'figure').map(entry => entry.path)
  const numbers = figures
    .map(file => Number(/^fig(?:ure)?[\s_-]?(\d+)/iu.exec(path.basename(file))?.[1] ?? Number.NaN))
    .filter(value => Number.isFinite(value))
    .sort((left, right) => left - right)
  const figureGaps: number[] = []
  for (let expected = 1; expected <= (numbers.at(-1) ?? 0); expected += 1) {
    if (!numbers.includes(expected)) figureGaps.push(expected)
  }

  const issues: PackIssue[] = []
  if (!entries.some(entry => entry.kind === 'manuscript')) {
    issues.push({ code: 'no_manuscript', severity: 'error', detail: 'no manuscript file found (manuscript/paper/main with .docx/.pdf/.tex/.md)', suggestion: 'add the manuscript file at the pack root' })
  }
  if (!entries.some(entry => entry.kind === 'cover-letter')) {
    issues.push({ code: 'no_cover_letter', severity: 'warning', detail: 'no cover letter found', suggestion: 'add a cover letter (most journals require one)' })
  }
  if (figures.length === 0) {
    issues.push({ code: 'no_figures', severity: 'warning', detail: 'no numbered figure files found', suggestion: 'name figures Figure1.png / fig1.pdf so they can be matched to the captions' })
  }
  if (figureGaps.length > 0) {
    issues.push({ code: 'figure_numbering_gap', severity: 'warning', detail: `figure numbering has gaps: ${figureGaps.join(', ')}`, suggestion: 'renumber figures consecutively' })
  }
  if (!entries.some(entry => entry.kind === 'table')) {
    issues.push({ code: 'no_tables', severity: 'info', detail: 'no table files found (tables may be embedded in the manuscript)', suggestion: 'submit tables separately when the journal requires it' })
  }
  if (truncated) {
    issues.push({ code: 'scan_truncated', severity: 'info', detail: `the pack scan stopped after ${maxEntries} files`, suggestion: 'raise maxEntries or audit a narrower directory; the report does not cover every file' })
  }
  if (!entries.some(entry => entry.kind === 'declarations')) {
    issues.push({ code: 'no_declarations_file', severity: 'warning', detail: 'no declarations file found (ethics/funding/conflicts/data availability)', suggestion: 'add the declaration statements or include them in the manuscript' })
  }
  const ready = !issues.some(issue => issue.severity === 'error')
  return { rootId: path.basename(root), entries, issues, figures, figureGaps, ready }
}

/**
 * Read one manuscript file as text (docx/pdf are rejected with a clear message).
 * @param file - absolute path.
 * @returns the text.
 */
export async function readManuscriptText(file: string): Promise<string> {
  const extension = path.extname(file).toLowerCase()
  if (extension === '.docx' || extension === '.pdf' || extension === '.doc') {
    throw new Error(`${extension} is not parsed here; convert to .md/.txt/.tex or pass the text (PDF text extraction: dsh-doc-anchor)`)
  }
  return readFile(file, 'utf8')
}
