/**
 * `submission_pack` — check the submission directory and export the pack report.
 * @module dsh-manuscript-check/tools/submission-pack
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { McError, type ManuscriptRuntime } from '../runtime.ts'
import { ERROR_SCHEMA } from './shared.ts'

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean', required: true },
    pack: { type: 'json' },
    exports: { type: 'json' },
    error: ERROR_SCHEMA,
  },
} as const

/**
 * Build the `submission_pack` tool.
 * @param runtime - the runtime.
 * @returns the tool definition.
 */
export function makeSubmissionPackTool(runtime: ManuscriptRuntime) {
  return defineTool({
    name: 'submission_pack',
    description: [
      'Check a submission directory for the usual furniture and export the pack report (dsh-manuscript-check).',
      '',
      'Looks for a manuscript file, a cover letter, numbered figures (with gap detection), tables, supplementary material and a declarations file. Reports missing pieces; never renames, converts or uploads anything. Writes a JSON + Markdown report under `<root>/exports`.',
    ].join('\n'),
    parameters: {
      path: { type: 'string', description: 'Workspace-relative submission directory (default: workspace root).' },
      recursive: { type: 'boolean', description: 'Descend one extra level (figures/ is always scanned).' },
    },
    output: {
      schema: OUTPUT_SCHEMA,
      render: (_args, value) => {
        const result = value as { ok: true; pack: { ready: boolean; entries: unknown[]; issues: Array<{ severity: string; code: string; detail: string }> } } | { ok: false; error: { code: string; message: string } }
        if (!result.ok) return [{ type: 'text', text: `submission_pack failed (${result.error.code}): ${result.error.message}` }]
        const lines = [`submission_pack: ${result.pack.ready ? 'ready' : 'NOT ready'} — ${result.pack.entries.length} file(s), ${result.pack.issues.length} issue(s)`]
        for (const issue of result.pack.issues) lines.push(`  [${issue.severity}] ${issue.code}: ${issue.detail}`)
        return [{ type: 'text', text: lines.join('\n') }]
      },
    },
    async execute(args: unknown) {
      const request = args as { path?: string; recursive?: boolean }
      try {
        const result = await runtime.pack({
          ...(request.path === undefined ? {} : { path: request.path }),
          ...(request.recursive === true ? { recursive: true } : {}),
        })
        const { exports, ...pack } = result
        return { ok: true as const, pack: pack as never, exports: exports as never }
      } catch (error) {
        if (error instanceof McError) return { ok: false as const, error: { code: error.code, message: error.message } }
        throw error
      }
    },
  })
}
