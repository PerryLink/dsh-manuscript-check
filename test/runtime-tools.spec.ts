/**
 * Runtime and tool surface: evidence, path safety, pack exports.
 * @module test/runtime-tools.spec
 */

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { validateRep } from '@perrylink/dsh-research-core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveConfig } from '../src/config.ts'
import { ManuscriptRuntime } from '../src/runtime.ts'
import { makeManuscriptCheckTool } from '../src/tools/manuscript-check.ts'
import { makeReportingCheckTool } from '../src/tools/reporting-check.ts'
import { makeSubmissionPackTool } from '../src/tools/submission-pack.ts'
import { VERSION } from '../src/version.ts'

const AT = new Date('2026-10-01T09:00:00.000Z')
const MANUSCRIPT = '# A randomized trial\n\n## Methods\nRandomized, allocation concealment, blinding, sample size.\n'
let workspace: string
let store: string

beforeEach(async () => {
  workspace = await mkdtemp(path.join(tmpdir(), 'manuscript-work-'))
  store = await mkdtemp(path.join(tmpdir(), 'manuscript-store-'))
  await writeFile(path.join(workspace, 'paper.md'), MANUSCRIPT, 'utf8')
})

afterEach(async () => {
  for (const directory of [workspace, store]) {
    if (directory.startsWith(tmpdir())) await rm(directory, { recursive: true, force: true })
  }
})

/** Build a runtime over the fixtures. */
function runtime(): ManuscriptRuntime {
  return new ManuscriptRuntime({ config: resolveConfig({ workspaceRoot: workspace, root: store }), now: () => AT })
}

const EXEC = {} as never

describe('runtime', () => {
  it('checks text and writes a valid REP record', async () => {
    const result = await runtime().check({ text: MANUSCRIPT, guideline: 'consort' })
    expect(result.analysis.guidelinesChecked).toEqual(['consort'])
    expect(result.evidenceId).toMatch(/^ev-/u)
    const record = JSON.parse(await readFile(result.recordPath!, 'utf8')) as unknown
    expect(validateRep(record).ok, JSON.stringify(validateRep(record).issues)).toBe(true)
  })

  it('auto-detects the guideline and reads a workspace file', async () => {
    const result = await runtime().check({ path: 'paper.md', guideline: 'auto' })
    expect(result.analysis.guidelinesChecked).toContain('consort')
  })

  it('rejects traversal, unknown guidelines and binary formats', async () => {
    await expect(runtime().check({ path: '../escape.md' })).rejects.toMatchObject({ code: 'PATH_ESCAPE' })
    await expect(runtime().check({ text: 'x', guideline: 'nope' })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await writeFile(path.join(workspace, 'paper.pdf'), 'PDF', 'utf8')
    await expect(runtime().check({ path: 'paper.pdf' })).rejects.toMatchObject({ code: 'UNSUPPORTED_FILE' })
  })

  it('rejects oversized input', async () => {
    const tiny = new ManuscriptRuntime({ config: resolveConfig({ workspaceRoot: workspace, root: store, maxChars: 10 }), now: () => AT })
    await expect(tiny.check({ text: MANUSCRIPT })).rejects.toMatchObject({ code: 'TOO_LARGE' })
  })

  it('scans a pack and writes JSON + Markdown exports', async () => {
    await writeFile(path.join(workspace, 'manuscript.md'), MANUSCRIPT, 'utf8')
    await writeFile(path.join(workspace, 'cover-letter.md'), 'Dear editor', 'utf8')
    const result = await runtime().pack()
    expect(result.exports.json).toBeDefined()
    const markdown = await readFile(result.exports.markdown, 'utf8')
    expect(markdown).toContain('Submission pack')
  })
})

describe('tools', () => {
  it('declares names and schemas', () => {
    for (const [tool, name] of [
      [makeManuscriptCheckTool(runtime()), 'manuscript_check'],
      [makeReportingCheckTool(runtime()), 'reporting_check'],
      [makeSubmissionPackTool(runtime()), 'submission_pack'],
    ] as const) {
      expect(tool.name).toBe(name)
      expect(Object.keys(tool.parameters).length).toBeGreaterThan(0)
      expect(tool.output.schema).toBeDefined()
    }
  })

  it('reporting_check returns a flat missing list', async () => {
    const tool = makeReportingCheckTool(runtime())
    const value = (await tool.execute({ text: MANUSCRIPT, guidelines: ['manuscript', 'consort'] }, EXEC)) as {
      ok: true
      missing: Array<{ guideline: string; label: string }>
      analysis: { results: Array<{ guideline: { id: string }; met: boolean }> }
    }
    expect(value.ok).toBe(true)
    expect(value.analysis.results).toHaveLength(2)
    expect(value.missing.length).toBeGreaterThan(0)
    expect(value.missing[0]?.guideline).toBeDefined()
  })

  it('submission_pack reports issues and exports', async () => {
    const tool = makeSubmissionPackTool(runtime())
    // The fixture has a manuscript but no cover letter, figures or declarations:
    // warnings, so the pack is still "ready" (readiness is about error-level issues).
    const value = (await tool.execute({}, EXEC)) as { ok: true; pack: { ready: boolean; issues: Array<{ code: string }> }; exports: { json: string } }
    expect(value.ok).toBe(true)
    expect(value.pack.ready).toBe(true)
    expect(value.pack.issues.map(issue => issue.code)).toContain('no_figures')
    expect(value.exports.json).toContain('pack-')
  })

  it('failure branch carries a stable code', async () => {
    const value = (await makeManuscriptCheckTool(runtime()).execute({}, EXEC)) as { ok: false; error: { code: string } }
    expect(value.ok).toBe(false)
    expect(value.error.code).toBe('INVALID_INPUT')
  })
})

describe('package', () => {
  it('VERSION matches package.json and the manifest declares a bundle patch', async () => {
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as Record<string, unknown>
    expect(pkg['version']).toBe(VERSION)
    expect(pkg['dsh']).toEqual({ manifestVersion: 1, bundle: { patch: './cordis.patch.yml' } })
    expect(pkg['dependencies']).toEqual({})
  })
})
