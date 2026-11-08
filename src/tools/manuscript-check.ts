/**
 * `manuscript_check` — structure + declarations + one reporting guideline.
 * @module dsh-manuscript-check/tools/manuscript-check
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
    evidenceId: { type: 'string' },
    recordPath: { type: 'string' },
    error: ERROR_SCHEMA,
  },
} as const

/**
 * Build the `manuscript_check` tool.
 * @param runtime - the runtime.
 * @returns the tool definition.
 */
export function makeManuscriptCheckTool(runtime: ManuscriptRuntime) {
  return defineTool({
    name: 'manuscript_check',
    description: [
      'Check a manuscript for structure, declaration statements and reporting-guideline items (dsh-manuscript-check).',
      '',
      'Detects sections (title/abstract/introduction/methods/results/discussion/conclusion), the usual declarations (ethics, consent, funding, conflicts, data availability, contributions, registration), and the items of one guideline: `manuscript` (default), `consort`, `strobe`, `prisma`, or `auto` (guess from the wording).',
      '',
      'Presence is keyword-based: a missing item is reported with advice and a locator, but this is a checklist, not a compliance verdict — a present statement can be missed when the wording differs. Accepts .md/.txt/.tex; PDF/DOCX must be converted (PDF text: dsh-doc-anchor).',
    ].join('\n'),
    parameters: {
      text: { type: 'string', description: 'Manuscript text (mutually exclusive with path).' },
      path: { type: 'string', description: 'Workspace-relative .md/.txt/.tex manuscript.' },
      guideline: { type: 'string', description: 'manuscript | consort | strobe | prisma | auto.' },
      persist: { type: 'boolean', description: 'Store the text as REP evidence + record (default true).' },
    },
    output: {
      schema: OUTPUT_SCHEMA,
      render: (_args, value) => {
        const result = value as
          | { ok: true; analysis: { wordCount: number; missingCoreSections: string[]; results: Array<{ guideline: { title: string }; present: number; total: number; coverage: number; met: boolean }> } }
          | { ok: false; error: { code: string; message: string } }
        if (!result.ok) return [{ type: 'text', text: `manuscript_check failed (${result.error.code}): ${result.error.message}` }]
        const lines = [`manuscript_check: ${result.analysis.wordCount} words`]
        if (result.analysis.missingCoreSections.length > 0) lines.push(`  missing sections: ${result.analysis.missingCoreSections.join(', ')}`)
        for (const item of result.analysis.results) {
          lines.push(`  ${item.guideline.title}: ${item.present}/${item.total} (${(item.coverage * 100).toFixed(0)}%) ${item.met ? 'target met' : 'below target'}`)
        }
        lines.push('  keyword-based checklist, not a compliance verdict')
        return [{ type: 'text', text: lines.join('\n') }]
      },
    },
    async execute(args: unknown) {
      const request = args as Parameters<ManuscriptRuntime['check']>[0]
      try {
        const result = await runtime.check(request)
        return {
          ok: true as const,
          analysis: result.analysis as never,
          ...(result.evidenceId === undefined ? {} : { evidenceId: result.evidenceId }),
          ...(result.recordPath === undefined ? {} : { recordPath: result.recordPath }),
        }
      } catch (error) {
        if (error instanceof McError) return { ok: false as const, error: { code: error.code, message: error.message } }
        throw error
      }
    },
  })
}
