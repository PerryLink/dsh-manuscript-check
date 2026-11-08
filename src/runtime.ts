/**
 * Runtime: workspace-safe file access, guideline analysis, REP evidence and the
 * submission-pack scan.
 * @module dsh-manuscript-check/runtime
 */

import { mkdir, realpath, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  EvidenceStore,
  RepStoreError,
  stableId,
  validateRep,
  type AddEvidenceInput,
  type CaptureInput,
  type CheckResult,
  type Evidence,
  type ResearchRecord,
  type Snapshot,
} from '@perrylink/dsh-research-core'
import type { ResolvedConfig } from './config.ts'
import { analyzeManuscript, type ManuscriptAnalysis } from './analyze.ts'
import { GUIDELINES, guidelineOf, type Guideline } from './guidelines.ts'
import { readManuscriptText, scanPack, type PackReport } from './pack.ts'
import { renderPackMarkdown } from './report.ts'
import { VERSION } from './version.ts'

/** Stable error codes. */
export type McErrorCode = 'INVALID_INPUT' | 'NOT_FOUND' | 'PATH_ESCAPE' | 'NOT_A_FILE' | 'NOT_A_DIRECTORY' | 'TOO_LARGE' | 'UNSUPPORTED_FILE' | 'STORE_ERROR'

/** A typed failure. */
export class McError extends Error {
  /** Stable code. */
  readonly code: McErrorCode

  constructor(code: McErrorCode, message: string) {
    super(message)
    this.name = 'McError'
    this.code = code
  }
}

/** The subset of the REP service used here. */
export interface EvidencePort {
  capture(input: CaptureInput): Promise<{ snapshot: Snapshot }>
  addEvidence(input: AddEvidenceInput): Promise<{ evidence: Evidence }>
  buildRecord(options?: { evidenceIds?: readonly string[] }): Promise<Omit<ResearchRecord, 'manifest'>>
}

/** Input for a structure/reporting check. */
export interface CheckRequest {
  readonly text?: string
  readonly path?: string
  readonly guideline?: string
  readonly guidelines?: readonly string[]
  readonly persist?: boolean
}

/** Result of a check. */
export interface CheckResultValue {
  readonly analysis: ManuscriptAnalysis
  readonly evidenceId?: string
  readonly recordPath?: string
}

/** Options for {@link ManuscriptRuntime}. */
export interface ManuscriptRuntimeOptions {
  readonly config: ResolvedConfig
  readonly service?: EvidencePort
  readonly now?: () => Date
}

/** True when `candidate` is inside `root`. */
function isInside(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(root.endsWith(path.sep) ? root : `${root}${path.sep}`)
}

/** Resolve a guideline id, throwing a typed error. */
function resolveGuidelines(requested: readonly string[]): { definitions: Guideline[]; ids: string[] } {
  const ids = requested.length === 0 ? ['manuscript'] : [...new Set(requested)]
  const definitions: Guideline[] = []
  for (const id of ids) {
    const guideline = guidelineOf(id)
    if (guideline === undefined) throw new McError('INVALID_INPUT', `unknown guideline "${id}"; known: ${GUIDELINES.map(item => item.id).join(', ')}`)
    definitions.push(guideline)
  }
  return { definitions, ids }
}

/** Guess the guideline from manuscript wording. */
export function detectGuidelines(text: string): string[] {
  const ids = ['manuscript']
  if (/\bsystematic review\b/iu.test(text) || /\bmeta[- ]analysis\b/iu.test(text) || /\bPRISMA\b/u.test(text)) ids.push('prisma')
  else if (/\brandomi[sz]ed\b/iu.test(text) || /\bcontrolled trial\b/iu.test(text) || /\bCONSORT\b/u.test(text)) ids.push('consort')
  else if (/\bcohort\b/iu.test(text) || /\bcase[- ]control\b/iu.test(text) || /\bcross[- ]sectional\b/iu.test(text) || /\bSTROBE\b/u.test(text)) ids.push('strobe')
  return ids
}

/** The runtime. */
export class ManuscriptRuntime {
  readonly config: ResolvedConfig

  readonly #service: EvidencePort | undefined
  readonly #now: () => Date
  #store: EvidenceStore | undefined

  constructor(options: ManuscriptRuntimeOptions) {
    this.config = options.config
    this.#service = options.service
    this.#now = options.now ?? (() => new Date())
  }

  /** Current ISO timestamp. */
  iso(): string {
    return this.#now().toISOString()
  }

  /** The evidence port. */
  port(): EvidencePort {
    if (this.#service !== undefined) return this.#service
    this.#store ??= new EvidenceStore(path.join(this.config.root, 'store'))
    return this.#store
  }

  /** Resolve a file inside the workspace. */
  async resolveFile(input: string): Promise<{ absolute: string; id: string }> {
    if (typeof input !== 'string' || input.trim() === '') throw new McError('INVALID_INPUT', 'path must be a non-empty string')
    const root = this.config.workspaceRoot
    let realRoot: string
    try {
      realRoot = await realpath(root)
    } catch {
      throw new McError('NOT_FOUND', `workspace root does not exist: ${root}`)
    }
    const candidate = path.resolve(realRoot, input)
    if (!isInside(realRoot, candidate)) throw new McError('PATH_ESCAPE', 'path resolves outside the workspace root')
    let real: string
    try {
      real = await realpath(candidate)
    } catch {
      throw new McError('NOT_FOUND', `file not found: ${input}`)
    }
    if (!isInside(realRoot, real)) throw new McError('PATH_ESCAPE', 'path escapes the workspace root through a symlink')
    if (!(await stat(real)).isFile()) throw new McError('NOT_A_FILE', `not a regular file: ${input}`)
    return { absolute: real, id: path.relative(realRoot, real).split(path.sep).join('/') }
  }

  /** Resolve a directory inside the workspace. */
  async resolveDirectory(input?: string): Promise<{ absolute: string; id: string }> {
    const root = this.config.workspaceRoot
    let realRoot: string
    try {
      realRoot = await realpath(root)
    } catch {
      throw new McError('NOT_FOUND', `workspace root does not exist: ${root}`)
    }
    const candidate = path.resolve(realRoot, input ?? '.')
    if (!isInside(realRoot, candidate)) throw new McError('PATH_ESCAPE', 'path resolves outside the workspace root')
    let real: string
    try {
      real = await realpath(candidate)
    } catch {
      throw new McError('NOT_FOUND', `directory not found: ${input ?? '.'}`)
    }
    if (!isInside(realRoot, real)) throw new McError('PATH_ESCAPE', 'path escapes the workspace root through a symlink')
    if (!(await stat(real)).isDirectory()) throw new McError('NOT_A_DIRECTORY', `not a directory: ${input ?? '.'}`)
    return { absolute: real, id: path.relative(realRoot, real).split(path.sep).join('/') || '.' }
  }

  /**
   * Check a manuscript against reporting guidelines.
   * @param request - text/path and guideline selection.
   * @returns the analysis and (when persisted) the evidence id.
   */
  async check(request: CheckRequest): Promise<CheckResultValue> {
    if ((request.text === undefined) === (request.path === undefined)) throw new McError('INVALID_INPUT', 'pass exactly one of text or path')
    let text: string
    let sourceRef: AddEvidenceInput['sourceRef']
    let mediaType: Snapshot['mediaType'] = 'text/plain'
    if (request.text !== undefined) {
      if (request.text.length > this.config.maxChars) throw new McError('TOO_LARGE', `text is ${request.text.length} characters, the cap is ${this.config.maxChars}`)
      text = request.text
      sourceRef = { kind: 'other', id: 'inline:manuscript', retrievedAt: this.iso() }
    } else {
      const file = await this.resolveFile(request.path!)
      try {
        text = await readManuscriptText(file.absolute)
      } catch (error) {
        throw new McError('UNSUPPORTED_FILE', (error as Error).message)
      }
      if (text.length > this.config.maxChars) throw new McError('TOO_LARGE', `manuscript is ${text.length} characters, the cap is ${this.config.maxChars}`)
      mediaType = file.id.endsWith('.md') ? 'text/markdown' : file.id.endsWith('.tex') ? 'text/x-latex' : 'text/plain'
      sourceRef = { kind: 'file', id: file.id, retrievedAt: this.iso() }
    }
    const requested = request.guidelines !== undefined && request.guidelines.length > 0
      ? [...request.guidelines]
      : request.guideline === 'auto' ? detectGuidelines(text) : request.guideline === undefined ? ['manuscript'] : [request.guideline]
    const { definitions, ids } = resolveGuidelines(requested)
    const analysis = analyzeManuscript(text, definitions, ids)

    const persist = request.persist ?? this.config.persist
    if (!persist) return { analysis }
    const checks: CheckResult[] = analysis.results.flatMap(result =>
      result.items.map(item => ({
        checkId: `chk-mc-${item.guideline}-${item.id}`,
        check: 'other' as const,
        status: item.status === 'present' ? ('pass' as const) : ('warn' as const),
        severity: item.status === 'present' ? ('info' as const) : ('warning' as const),
        detail: item.status === 'present' ? `${result.guideline.title}: ${item.label} present` : `${result.guideline.title}: ${item.label} missing — ${item.advice ?? ''}`,
        ...(item.locator === undefined ? {} : { actual: { charStart: item.locator.charStart, charEnd: item.locator.charEnd } }),
      })),
    )
    const port = this.port()
    let evidence: Evidence
    try {
      const captured = await port.capture({ bytes: text, mediaType, sourceRef, capturedAt: this.iso() })
      evidence = (
        await port.addEvidence({
          evidenceId: stableId('ev', ['manuscript-check', sourceRef.id, captured.snapshot.snapshotId]),
          title: `Manuscript checked against ${ids.join(', ')}`,
          sourceRef,
          snapshotIds: [captured.snapshot.snapshotId],
          anchors: [{ snapshotId: captured.snapshot.snapshotId, kind: 'record', value: 'field:text' }],
          provenance: { plugin: 'dsh-manuscript-check', version: VERSION, method: 'keyword-guideline', retrievedAt: this.iso() },
          checks,
          notes: `${ids.join(', ')}: ${analysis.results.map(result => `${result.guideline.id} ${result.present}/${result.total}`).join('; ')}`,
        })
      ).evidence
    } catch (error) {
      if (error instanceof RepStoreError) throw new McError('STORE_ERROR', error.message)
      throw error
    }
    try {
      const record = await port.buildRecord({ evidenceIds: [evidence.evidenceId] })
      if (!validateRep(record).ok) throw new McError('STORE_ERROR', 'refusing to write an invalid REP record')
      const directory = path.join(this.config.root, 'records')
      await mkdir(directory, { recursive: true })
      const file = path.join(directory, `${evidence.evidenceId}.rep.json`)
      await writeFile(file, `${JSON.stringify(record, null, 2)}\n`, 'utf8')
      return { analysis, evidenceId: evidence.evidenceId, recordPath: file }
    } catch (error) {
      if (error instanceof McError) throw error
      throw new McError('STORE_ERROR', `could not write the REP record: ${(error as Error).message}`)
    }
  }

  /**
   * Scan a submission directory.
   * @param request - directory and recursion option.
   * @returns the pack report and export paths.
   */
  async pack(request: { path?: string; recursive?: boolean } = {}): Promise<PackReport & { exports: { json: string; markdown: string } }> {
    const directory = await this.resolveDirectory(request.path)
    const report = await scanPack(directory.absolute, request.recursive === true ? { recursive: true } : {})
    const exportsDirectory = path.join(this.config.root, 'exports')
    await mkdir(exportsDirectory, { recursive: true })
    const json = path.join(exportsDirectory, `pack-${report.rootId}.json`)
    const markdown = path.join(exportsDirectory, `pack-${report.rootId}.md`)
    await writeFile(json, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    await writeFile(markdown, renderPackMarkdown(report), 'utf8')
    return { ...report, exports: { json, markdown } }
  }
}
