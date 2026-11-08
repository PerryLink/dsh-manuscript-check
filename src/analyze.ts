/**
 * Manuscript analysis: sections, guideline item presence, structural summary.
 *
 * Presence is keyword-based and intentionally labelled as such: the plugin can
 * prove that a statement is missing from the text, not that it is adequate.
 * Every "present" finding carries the character range that triggered it.
 *
 * @module dsh-manuscript-check/analyze
 */

import type { Guideline, GuidelineItem } from './guidelines.ts'

/** One detected section. */
export interface SectionRange {
  readonly name: string
  readonly heading: string
  readonly start: number
  readonly end: number
}

/** One item finding. */
export interface ItemFinding {
  readonly id: string
  readonly label: string
  readonly guideline: Guideline['id']
  readonly status: 'present' | 'missing'
  readonly severity: 'info' | 'warning'
  readonly locator?: { readonly charStart: number; readonly charEnd: number; readonly match: string }
  readonly advice?: string
}

/** One guideline result. */
export interface GuidelineResult {
  readonly guideline: { readonly id: Guideline['id']; readonly title: string }
  readonly items: readonly ItemFinding[]
  readonly present: number
  readonly total: number
  readonly coverage: number
  readonly targetCoverage: number
  readonly met: boolean
}

/** The full analysis. */
export interface ManuscriptAnalysis {
  readonly sections: readonly SectionRange[]
  readonly missingCoreSections: readonly string[]
  readonly wordCount: number
  readonly results: readonly GuidelineResult[]
  readonly guidelinesChecked: readonly string[]
  readonly notes: readonly string[]
}

/** Canonical section names and their heading patterns. */
const SECTION_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: 'abstract', pattern: /^(abstract|summary)\b/iu },
  { name: 'introduction', pattern: /^(introduction|background)\b/iu },
  { name: 'methods', pattern: /^(methods?|materials and methods|methodology)\b/iu },
  { name: 'results', pattern: /^(results?|findings)\b/iu },
  { name: 'discussion', pattern: /^(discussion)\b/iu },
  { name: 'conclusion', pattern: /^(conclusions?|concluding remarks)\b/iu },
  { name: 'references', pattern: /^(references?|bibliography)\b/iu },
  { name: 'declarations', pattern: /^(declarations?|statements?|acknowledg(e)?ments?)\b/iu },
]

/** Core sections a research manuscript is expected to have. */
const CORE_SECTIONS = ['abstract', 'introduction', 'methods', 'results', 'discussion'] as const

/**
 * Split the text into sections using markdown headings or ALL-CAPS/Title lines.
 * @param text - the manuscript text.
 * @returns the detected sections (empty when no headings are recognizable).
 */
export function splitSections(text: string): SectionRange[] {
  const headings: Array<{ name: string; heading: string; index: number; length: number }> = []
  for (const match of text.matchAll(/^#{1,6}[ \t]+(.+?)[ \t]*$/gmu)) {
    const heading = match[1]!.trim()
    const name = SECTION_PATTERNS.find(entry => entry.pattern.test(heading))?.name ?? heading.toLowerCase().slice(0, 40)
    headings.push({ name, heading, index: match.index, length: match[0].length })
  }
  // Also scan plain-text headings even when markdown headings exist: a
  // manuscript may use a markdown title and plain ALL-CAPS/Title sections.
  // Only recognized section names are accepted here, so author/affiliation
  // lines are not invented as sections.
  for (const match of text.matchAll(/^([A-Z][A-Za-z ]{2,40})[ \t]*$/gmu)) {
    const heading = match[1]!.trim()
    const name = SECTION_PATTERNS.find(entry => entry.pattern.test(heading))?.name
    if (name === undefined) continue
    if (headings.some(existing => existing.index === match.index)) continue
    headings.push({ name, heading, index: match.index, length: match[0].length })
  }
  headings.sort((left, right) => left.index - right.index)
  return headings.map((heading, index) => ({
    name: heading.name,
    heading: heading.heading,
    start: heading.index,
    end: headings[index + 1]?.index ?? text.length,
  }))
}

/** Check one item against the whole text. */
function checkItem(text: string, item: GuidelineItem, guideline: Guideline['id']): ItemFinding {
  for (const pattern of item.patterns) {
    // Patterns are stateful only if /g is used; these are not, but reset anyway.
    pattern.lastIndex = 0
    const match = pattern.exec(text)
    if (match !== null) {
      return {
        id: item.id,
        label: item.label,
        guideline,
        status: 'present',
        severity: 'info',
        locator: { charStart: match.index, charEnd: match.index + match[0].length, match: match[0].slice(0, 80) },
      }
    }
  }
  return { id: item.id, label: item.label, guideline, status: 'missing', severity: 'warning', advice: item.advice }
}

/**
 * Check one guideline against the manuscript.
 * @param text - manuscript text.
 * @param guideline - the guideline definition.
 * @returns the item findings and coverage.
 */
export function checkGuideline(text: string, guideline: Guideline): GuidelineResult {
  const items = guideline.items.map(item => checkItem(text, item, guideline.id))
  const present = items.filter(item => item.status === 'present').length
  const coverage = items.length === 0 ? 1 : Number((present / items.length).toFixed(4))
  return {
    guideline: { id: guideline.id, title: guideline.title },
    items,
    present,
    total: items.length,
    coverage,
    targetCoverage: guideline.targetCoverage,
    met: coverage >= guideline.targetCoverage,
  }
}

/**
 * Analyze a manuscript text.
 * @param text - the manuscript text.
 * @param guidelines - guideline definitions to check.
 * @param requested - the guideline ids the caller asked for.
 * @returns sections, word count and guideline results.
 */
export function analyzeManuscript(text: string, guidelines: readonly Guideline[], requested: readonly string[]): ManuscriptAnalysis {
  const sections = splitSections(text)
  const present = new Set(sections.map(section => section.name))
  const missingCoreSections = CORE_SECTIONS.filter(name => !present.has(name))
  const wordCount = text.split(/\s+/u).filter(token => token !== '').length
  const results = guidelines.map(guideline => checkGuideline(text, guideline))
  const notes: string[] = []
  notes.push('item presence is detected by keyword patterns; a present statement can be missed when authors use different wording')
  if (sections.length === 0) notes.push('no section headings were recognized; guideline items were checked against the whole text')
  return { sections, missingCoreSections, wordCount, results, guidelinesChecked: requested, notes }
}
