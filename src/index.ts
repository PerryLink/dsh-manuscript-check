/**
 * `dsh-manuscript-check` — pre-submission reporting checklist, not a compliance
 * verdict: structure + declarations, guideline item coverage (starter CONSORT /
 * STROBE / PRISMA lists), and a submission-pack scan.
 *
 * Function plugin — no default export.
 * @module dsh-manuscript-check
 */

import type { Context } from '@deepseek-ai/cordis'
import { Config, resolveConfig, type Config as ConfigShape } from './config.ts'
import { ManuscriptRuntime, type EvidencePort } from './runtime.ts'
import { makeManuscriptCheckTool } from './tools/manuscript-check.ts'
import { makeReportingCheckTool } from './tools/reporting-check.ts'
import { makeSubmissionPackTool } from './tools/submission-pack.ts'

/** Cordis plugin name. */
export const name = 'manuscript-check'

/** The tool registry is required; the REP service is optional. */
export const inject = ['tools']

export { Config, resolveConfig }
export type { ConfigShape }
export type { ResolvedConfig } from './config.ts'
export { VERSION } from './version.ts'
export { GUIDELINES, guidelineOf } from './guidelines.ts'
export type { Guideline, GuidelineItem } from './guidelines.ts'
export { analyzeManuscript, checkGuideline, splitSections } from './analyze.ts'
export type { GuidelineResult, ItemFinding, ManuscriptAnalysis, SectionRange } from './analyze.ts'
export { readManuscriptText, scanPack } from './pack.ts'
export type { PackEntry, PackIssue, PackReport } from './pack.ts'
export { renderAnalysisMarkdown, renderPackMarkdown, renderSarif } from './report.ts'
export { detectGuidelines, ManuscriptRuntime, McError } from './runtime.ts'
export type { CheckRequest, CheckResultValue, EvidencePort, ManuscriptRuntimeOptions, McErrorCode } from './runtime.ts'
export { makeManuscriptCheckTool } from './tools/manuscript-check.ts'
export { makeReportingCheckTool } from './tools/reporting-check.ts'
export { makeSubmissionPackTool } from './tools/submission-pack.ts'

/**
 * Mount the three tools.
 * @param ctx - the plugin context (host).
 * @param config - raw plugin config.
 */
export function apply(ctx: Context, config: ConfigShape): void {
  const resolved = resolveConfig(config)
  const logger = ctx.logger('manuscript-check')
  if (!resolved.enabled) {
    logger.info('disabled: enabled is false — no tools are mounted')
    return
  }
  const service = ctx.get('researchEvidence') as EvidencePort | undefined
  const runtime = new ManuscriptRuntime({ config: resolved, ...(service === undefined ? {} : { service }) })
  if (service === undefined) {
    logger.info(`ctx.researchEvidence is not mounted; using a local core store under ${resolved.root}`)
  }
  ctx.effect(() => ctx.tools.register(makeManuscriptCheckTool(runtime)), 'manuscript-check: manuscript_check tool')
  ctx.effect(() => ctx.tools.register(makeReportingCheckTool(runtime)), 'manuscript-check: reporting_check tool')
  ctx.effect(() => ctx.tools.register(makeSubmissionPackTool(runtime)), 'manuscript-check: submission_pack tool')
}
