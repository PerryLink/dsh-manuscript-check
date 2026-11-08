/**
 * `reporting_check` — coverage of one or more guidelines, item by item.
 * @module dsh-manuscript-check/tools/reporting-check
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { McError, type ManuscriptRuntime } from '../runtime.ts'
import { ERROR_SCHEMA } from './shared.ts'

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean', required: true },
    analysis: { type: 'json' },
    missing: { type: 'json' },
    evidenceId: { type: 'string' },
    error: ERROR_SCHEMA,
  },
} as const

/**
 * Build the `reporting_check` tool.
 * @param runtime - the runtime.
 * @returns the tool definition.
 */
export function makeReportingCheckTool(runtime: ManuscriptRuntime) {
  return defineTool({
    name: 'reporting_check',
    description: [
      'Check a manuscript against several reporting guidelines at once and list every missing item (dsh-manuscript-check).',
      '',
      'Same keyword-based detection as manuscript_check, but the caller chooses the guideline list (e.g. ["consort","manuscript"]) and gets a flat list of missing items with advice, ready to paste into a submission checklist. Coverage below the guideline target is flagged.',
    ].join('\n'),
    parameters: {
      text: { type: 'string', description: 'Manuscript text (mutually exclusive with path).' },
      path: { type: 'string', description: 'Workspace-relative manuscript path.' },
      guidelines: { type: 'array', items: { type: 'string' }, description: 'Guidelines: manuscript, consort, strobe, prisma.' },
    },
    output: {
      schema: OUTPUT_SCHEMA,
      render: (_args, value) => {
        const result = value as { ok: true; analysis: { results: Array<{ guideline: { id: string; title: string }; present: number; total: number; met: boolean }> }; missing: Array<{ guideline: string; label: string }> } | { ok: false; error: { code: string; message: string } }
        if (!result.ok) return [{ type: 'text', text: `reporting_check failed (${result.error.code}): ${result.error.message}` }]
        const lines = ['reporting_check:']
        for (const item of result.analysis.results) lines.push(`  ${item.guideline.title}: ${item.present}/${item.total} ${item.met ? 'target met' : 'below target'}`)
        lines.push(`  missing items: ${result.missing.length}`)
        for (const item of result.missing.slice(0, 20)) lines.push(`    - [${item.guideline}] ${item.label}`)
        return [{ type: 'text', text: lines.join('\n') }]
      },
    },
    async execute(args: unknown) {
      const request = args as { text?: string; path?: string; guidelines?: string[] }
      try {
        const result = await runtime.check({
          ...(request.text === undefined ? {} : { text: request.text }),
          ...(request.path === undefined ? {} : { path: request.path }),
          ...(request.guidelines === undefined ? {} : { guidelines: request.guidelines }),
        })
        const missing = result.analysis.results.flatMap(item =>
          item.items.filter(finding => finding.status === 'missing').map(finding => ({ guideline: item.guideline.id, id: finding.id, label: finding.label, advice: finding.advice })),
        )
        return { ok: true as const, analysis: result.analysis as never, missing: missing as never, ...(result.evidenceId === undefined ? {} : { evidenceId: result.evidenceId }) }
      } catch (error) {
        if (error instanceof McError) return { ok: false as const, error: { code: error.code, message: error.message } }
        throw error
      }
    },
  })
}
