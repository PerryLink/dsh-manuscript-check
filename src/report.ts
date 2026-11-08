/**
 * Markdown and SARIF rendering for manuscript checks.
 * @module dsh-manuscript-check/report
 */

import type { ManuscriptAnalysis } from './analyze.ts'
import type { PackReport } from './pack.ts'

/** Render the manuscript analysis as Markdown. */
export function renderAnalysisMarkdown(analysis: ManuscriptAnalysis): string {
  const lines = ['# Manuscript check', '']
  lines.push(`**Words:** ${analysis.wordCount} · **sections:** ${analysis.sections.map(section => section.name).join(', ') || 'none detected'}`)
  if (analysis.missingCoreSections.length > 0) lines.push(`**Missing core sections:** ${analysis.missingCoreSections.join(', ')}`)
  lines.push('')
  for (const result of analysis.results) {
    lines.push(`## ${result.guideline.title}`)
    lines.push('')
    lines.push(`Coverage: **${result.present}/${result.total}** (${(result.coverage * 100).toFixed(0)}%; target ${(result.targetCoverage * 100).toFixed(0)}%) — ${result.met ? 'target met' : 'below target'}`)
    lines.push('')
    const missing = result.items.filter(item => item.status === 'missing')
    if (missing.length > 0) {
      lines.push('| Missing item | Advice |')
      lines.push('|---|---|')
      for (const item of missing) lines.push(`| ${item.label} | ${item.advice ?? ''} |`)
      lines.push('')
    }
  }
  lines.push('## Notes')
  lines.push('')
  for (const note of analysis.notes) lines.push(`- ${note}`)
  lines.push('')
  lines.push('> This is a keyword-based checklist, not a compliance verdict. A present statement can be missed when the wording differs.')
  return `${lines.join('\n')}\n`
}

/** Render the pack report as Markdown. */
export function renderPackMarkdown(report: PackReport): string {
  const lines = ['# Submission pack', '']
  lines.push(`**Ready:** ${report.ready ? 'yes (no error-level issue)' : 'no'} · **files:** ${report.entries.length}`)
  lines.push('')
  lines.push('| File | Kind | Bytes |')
  lines.push('|---|---|---:|')
  for (const entry of report.entries) lines.push(`| ${entry.path} | ${entry.kind} | ${entry.bytes} |`)
  lines.push('')
  if (report.issues.length > 0) {
    lines.push('| Severity | Issue | Detail | Suggestion |')
    lines.push('|---|---|---|---|')
    for (const issue of report.issues) lines.push(`| ${issue.severity} | ${issue.code} | ${issue.detail} | ${issue.suggestion} |`)
    lines.push('')
  } else {
    lines.push('No issues found.')
    lines.push('')
  }
  return `${lines.join('\n')}\n`
}

/** Render missing items and pack issues as SARIF 2.1.0. */
export function renderSarif(analysis: ManuscriptAnalysis | undefined, pack: PackReport | undefined, version: string): Record<string, unknown> {
  const results: Array<Record<string, unknown>> = []
  for (const guideline of analysis?.results ?? []) {
    for (const item of guideline.items.filter(finding => finding.status === 'missing')) {
      results.push({
        ruleId: `manuscript-check/${guideline.guideline.id}/${item.id}`,
        level: 'warning',
        message: { text: `${guideline.guideline.title}: missing ${item.label}. ${item.advice ?? ''}`.trim() },
        properties: { guideline: guideline.guideline.id, item: item.id },
      })
    }
  }
  for (const issue of pack?.issues ?? []) {
    results.push({
      ruleId: `manuscript-check/pack/${issue.code}`,
      level: issue.severity === 'error' ? 'error' : issue.severity === 'warning' ? 'warning' : 'note',
      message: { text: `${issue.detail} — ${issue.suggestion}` },
      properties: { code: issue.code },
    })
  }
  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [{ tool: { driver: { name: 'dsh-manuscript-check', version } }, results }],
  }
}
