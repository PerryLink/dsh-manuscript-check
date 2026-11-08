// Manuscript benchmark adapter for dsh-manuscript-check.
//
// Reads dsh-research-bench/data/manuscripts/cases.jsonl, calls the plugin's
// own `analyzeManuscript(text, [manuscriptGuideline], ['manuscript'])` once per
// manuscript, and scores the 14 `manuscript` guideline items against the
// generator's frozen labels. The labels are data, not predictions: this script
// never changes them.
//
// The headline confusion matrix uses `present` as the positive class (the
// checklist reports that an item is stated). A second matrix uses `missing` as
// the positive class (the actionable alert) so alert precision is visible too.
//
// Writes bench/results-manuscripts.json and bench/results-manuscripts.md. Both
// are deterministic: no timestamps, no environment-dependent fields.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const benchDir = path.resolve(process.env.BENCH_DIR ?? path.join(root, '..', 'dsh-research-bench'))
const outputDir = path.join(root, 'bench')

const ITEM_IDS = [
  'title',
  'abstract',
  'introduction',
  'methods',
  'results',
  'discussion',
  'conclusion',
  'ethics',
  'consent',
  'funding',
  'conflicts',
  'data',
  'contributions',
  'registration',
]

const CORE_SECTIONS = ['abstract', 'introduction', 'methods', 'results', 'discussion']
const STATUSES = ['present', 'missing']

const fail = message => {
  console.error(`bench:manuscripts: ${message}`)
  process.exit(1)
}

const readJson = file => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    fail(`${file}: ${error.message}`)
  }
}

const readJsonl = file => {
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch (error) {
    fail(`${file}: ${error.message}`)
  }
  return text
    .split('\n')
    .filter(line => line.trim() !== '')
    .map((line, index) => {
      try {
        const value = JSON.parse(line)
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          fail(`${file}:${index + 1}: each line must be a JSON object`)
        }
        return value
      } catch (error) {
        fail(`${file}:${index + 1}: ${error.message}`)
      }
    })
}

const countWords = text => text.split(/\s+/u).filter(token => token !== '').length
const ratio = (numerator, denominator) => (denominator === 0 ? null : Number((numerator / denominator).toFixed(4)))
const formatRatio = value => (value === null ? 'n/a' : value.toFixed(4))
const sameStringSet = (left, right) =>
  [...left].sort().join('\u0000') === [...right].sort().join('\u0000')

const emptyCounts = () => ({ tp: 0, fp: 0, fn: 0, tn: 0 })

/** Fold a (expected, predicted) pair into one cell of the requested positive class. */
const classify = (expected, predicted, positive) => {
  const actualPositive = expected === positive
  const predictedPositive = predicted === positive
  if (actualPositive && predictedPositive) return 'tp'
  if (!actualPositive && predictedPositive) return 'fp'
  if (actualPositive && !predictedPositive) return 'fn'
  return 'tn'
}

const finishCounts = counts => ({
  ...counts,
  precision: ratio(counts.tp, counts.tp + counts.fp),
  recall: ratio(counts.tp, counts.tp + counts.fn),
  f1: ratio(2 * counts.tp, 2 * counts.tp + counts.fp + counts.fn),
})

const casesFile = path.join(benchDir, 'data', 'manuscripts', 'cases.jsonl')
const summaryFile = path.join(benchDir, 'data', 'manuscripts', 'SUMMARY.json')
const schemaFile = path.join(benchDir, 'data', 'manuscripts', 'schema.json')
for (const file of [casesFile, summaryFile, schemaFile]) {
  if (!existsSync(file)) fail(`missing ${file}; run dsh-research-bench/scripts/generate-manuscripts.mjs first`)
}

const packageFile = path.join(root, 'package.json')
const pkg = readJson(packageFile)
const summary = readJson(summaryFile)
const schema = readJson(schemaFile)
const cases = readJsonl(casesFile)

// ── dataset contract ────────────────────────────────────────────────────────

if (summary.dataset !== 'manuscripts') fail(`SUMMARY.dataset is ${String(summary.dataset)}, expected "manuscripts"`)
if (summary.synthetic !== true) fail('SUMMARY must declare synthetic: true')
if (summary.total !== cases.length) fail(`SUMMARY.total is ${String(summary.total)}, cases file has ${cases.length}`)
if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') fail('data/manuscripts/schema.json is not JSON Schema 2020-12')
if (!Array.isArray(summary.itemSpace) || !sameStringSet(summary.itemSpace, ITEM_IDS)) fail('SUMMARY.itemSpace disagrees with the 14-item manuscript guideline')
if (JSON.stringify(summary.coreSections) !== JSON.stringify(CORE_SECTIONS)) fail('SUMMARY.coreSections disagrees with the five core sections')
if (!sameStringSet(summary.statusSpace ?? [], STATUSES)) fail('SUMMARY.statusSpace must be present/missing')
if (!Array.isArray(cases) || cases.length === 0) fail('cases file is empty')

const seenIds = new Set()
const expectedMissingCounts = Object.fromEntries(ITEM_IDS.map(id => [id, 0]))
let expectedPresentTotal = 0
let expectedMissingTotal = 0

for (const [index, item] of cases.entries()) {
  const where = `data/manuscripts/cases.jsonl:${index + 1}`
  if (typeof item.id !== 'string' || !/^ms-[0-9]{4}$/u.test(item.id)) fail(`${where}: bad id ${String(item.id)}`)
  if (seenIds.has(item.id)) fail(`${where}: duplicate id ${item.id}`)
  seenIds.add(item.id)
  if (typeof item.category !== 'string' || item.category === '') fail(`${where}: category missing`)
  if (typeof item.description !== 'string' || item.description === '') fail(`${where}: description missing`)
  if (!Array.isArray(item.tags) || item.tags.length === 0 || item.tags.some(tag => typeof tag !== 'string' || tag === '')) {
    fail(`${where}: tags must be a non-empty array of strings`)
  }
  if (typeof item.text !== 'string' || item.text === '') fail(`${where}: text missing`)
  if (!Number.isInteger(item.wordCount) || item.wordCount < 300 || item.wordCount > 800) fail(`${where}: wordCount must be an integer in 300-800`)
  if (countWords(item.text) !== item.wordCount) fail(`${where}: wordCount disagrees with the text`)
  if (typeof item.expected !== 'object' || item.expected === null || Array.isArray(item.expected)) fail(`${where}: expected must be an object`)
  const expected = item.expected
  if (typeof expected.items !== 'object' || expected.items === null || Array.isArray(expected.items)) fail(`${where}: expected.items must be an object`)
  const keys = Object.keys(expected.items)
  if (keys.length !== ITEM_IDS.length || !ITEM_IDS.every(id => Object.hasOwn(expected.items, id))) {
    fail(`${where}: expected.items must contain exactly the 14 manuscript item ids`)
  }
  if (!Array.isArray(expected.missingCoreSections)) fail(`${where}: expected.missingCoreSections must be an array`)
  if (new Set(expected.missingCoreSections).size !== expected.missingCoreSections.length) fail(`${where}: duplicate missingCoreSections entry`)
  for (const section of expected.missingCoreSections) {
    if (!CORE_SECTIONS.includes(section)) fail(`${where}: unknown core section ${String(section)}`)
  }
  for (const id of ITEM_IDS) {
    const status = expected.items[id]
    if (!STATUSES.includes(status)) fail(`${where}: expected.items.${id} must be present/missing`)
    if (status === 'present') expectedPresentTotal += 1
    else {
      expectedMissingTotal += 1
      expectedMissingCounts[id] += 1
    }
  }
}

const totalLabels = cases.length * ITEM_IDS.length
if (expectedPresentTotal + expectedMissingTotal !== totalLabels) fail('expected label totals do not add up')
if (summary.labelCounts?.items !== totalLabels) fail('SUMMARY.labelCounts.items disagrees with the cases')
if (summary.labelCounts?.present !== expectedPresentTotal) fail('SUMMARY.labelCounts.present disagrees with the cases')
if (summary.labelCounts?.missing !== expectedMissingTotal) fail('SUMMARY.labelCounts.missing disagrees with the cases')
if (!summary.byMissingItem || typeof summary.byMissingItem !== 'object') fail('SUMMARY.byMissingItem is missing')
for (const id of ITEM_IDS) {
  if (summary.byMissingItem[id] !== expectedMissingCounts[id]) fail(`SUMMARY.byMissingItem.${id} disagrees with the cases`)
}

// ── plugin ──────────────────────────────────────────────────────────────────

const libFile = path.join(root, 'lib', 'index.js')
if (!existsSync(libFile)) fail('lib/index.js is missing; run pnpm run build first')
const { analyzeManuscript, guidelineOf } = await import(pathToFileURL(libFile).href)
const guideline = guidelineOf('manuscript')
if (guideline === undefined) fail("guidelineOf('manuscript') returned undefined")
if (guideline.items.length !== ITEM_IDS.length) fail(`the manuscript guideline has ${guideline.items.length} items, expected ${ITEM_IDS.length}`)
if (!sameStringSet(guideline.items.map(item => item.id), ITEM_IDS)) fail('the manuscript guideline item ids disagree with the benchmark label space')
const labelOf = Object.fromEntries(guideline.items.map(item => [item.id, item.label]))

// ── scoring ─────────────────────────────────────────────────────────────────

const perItemPresent = Object.fromEntries(ITEM_IDS.map(id => [id, emptyCounts()]))
const perItemMissing = Object.fromEntries(ITEM_IDS.map(id => [id, emptyCounts()]))
const totalPresent = emptyCounts()
const totalMissing = emptyCounts()
let correctItems = 0
const perDocument = []
const mismatches = []

for (const item of cases) {
  const analysis = analyzeManuscript(item.text, [guideline], ['manuscript'])
  if (!analysis.guidelinesChecked.includes('manuscript')) fail(`${item.id}: analysis did not record the requested guideline`)
  const result = analysis.results.find(entry => entry.guideline.id === 'manuscript')
  if (result === undefined) fail(`${item.id}: no manuscript guideline result`)
  if (result.total !== ITEM_IDS.length) fail(`${item.id}: result has ${result.total} items, expected ${ITEM_IDS.length}`)

  const predictedItems = Object.fromEntries(result.items.map(finding => [finding.id, finding.status]))
  const predictedMissing = ITEM_IDS.filter(id => predictedItems[id] === 'missing')
  const expectedMissing = ITEM_IDS.filter(id => item.expected.items[id] === 'missing')
  const expectedCore = [...item.expected.missingCoreSections]
  const presentCounts = emptyCounts()
  const missingCounts = emptyCounts()
  let documentCorrect = 0
  const documentMismatches = []

  for (const id of ITEM_IDS) {
    const expectedStatus = item.expected.items[id]
    const predictedStatus = predictedItems[id]
    if (predictedStatus === undefined) fail(`${item.id}: missing prediction for item ${id}`)
    if (expectedStatus === predictedStatus) {
      documentCorrect += 1
      correctItems += 1
    } else {
      const finding = result.items.find(entry => entry.id === id)
      const detail = {
        case: item.id,
        category: item.category,
        item: id,
        label: labelOf[id],
        expected: expectedStatus,
        predicted: predictedStatus,
        ...(predictedStatus === 'present' && finding?.locator !== undefined ? { locator: finding.locator } : {}),
        ...(predictedStatus === 'missing' && finding?.advice !== undefined ? { advice: finding.advice } : {}),
      }
      documentMismatches.push(detail)
      mismatches.push(detail)
    }
    perItemPresent[id][classify(expectedStatus, predictedStatus, 'present')] += 1
    perItemMissing[id][classify(expectedStatus, predictedStatus, 'missing')] += 1
    presentCounts[classify(expectedStatus, predictedStatus, 'present')] += 1
    missingCounts[classify(expectedStatus, predictedStatus, 'missing')] += 1
  }

  for (const key of ['tp', 'fp', 'fn', 'tn']) {
    totalPresent[key] += presentCounts[key]
    totalMissing[key] += missingCounts[key]
  }

  const actualCore = [...analysis.missingCoreSections]
  const coreMatch = sameStringSet(actualCore, expectedCore)

  perDocument.push({
    id: item.id,
    category: item.category,
    wordCount: analysis.wordCount,
    sectionsDetected: analysis.sections.length,
    expectedItems: item.expected.items,
    predictedItems,
    expectedMissing,
    predictedMissing,
    present: finishCounts(presentCounts),
    missing: finishCounts(missingCounts),
    correctItems: documentCorrect,
    accuracy: ratio(documentCorrect, ITEM_IDS.length),
    allItemsMatch: documentCorrect === ITEM_IDS.length,
    coreMissing: {
      expected: expectedCore,
      actual: actualCore,
      match: coreMatch,
    },
    mismatches: documentMismatches,
  })
}

const perItem = ITEM_IDS.map(id => ({
  id,
  label: labelOf[id],
  expectedPresent: cases.length - expectedMissingCounts[id],
  expectedMissing: expectedMissingCounts[id],
  present: finishCounts(perItemPresent[id]),
  missing: finishCounts(perItemMissing[id]),
}))

const coreMatches = perDocument.filter(item => item.coreMissing.match).length
const allItemsExact = perDocument.filter(item => item.allItemsMatch).length
const words = cases.map(item => item.wordCount)
const wordSummary = {
  min: Math.min(...words),
  max: Math.max(...words),
  total: words.reduce((sum, value) => sum + value, 0),
  mean: Number((words.reduce((sum, value) => sum + value, 0) / words.length).toFixed(1)),
}

const results = {
  dataset: summary.dataset,
  datasetVersion: summary.version,
  synthetic: summary.synthetic,
  plugin: { name: pkg.name, version: pkg.version },
  command: 'pnpm run bench:manuscripts',
  call: "analyzeManuscript(text, [guidelineOf('manuscript')], ['manuscript'])",
  cases: cases.length,
  itemsPerCase: ITEM_IDS.length,
  labels: {
    total: totalLabels,
    present: expectedPresentTotal,
    missing: expectedMissingTotal,
  },
  words: wordSummary,
  metrics: {
    averaging: 'micro',
    positiveClass: 'present',
    present: finishCounts(totalPresent),
    missing: finishCounts(totalMissing),
    itemAccuracy: ratio(correctItems, totalLabels),
  },
  documents: {
    total: cases.length,
    allItemsExact,
    allItemsExactRate: ratio(allItemsExact, cases.length),
    coreMissingExact: coreMatches,
    coreMissingExactRate: ratio(coreMatches, cases.length),
  },
  perItem,
  perDocument,
  mismatches,
  notes: [
    'Positive class for the headline metrics is present: an item is positive when the manuscript states it.',
    'The missing matrix treats a missing verdict as positive, so it reports alert precision/recall rather than presence recall.',
    'Labels are assigned by the generator from the manuscript construction; this adapter never changes them.',
    'The manuscript guideline has no statistical-methods or randomization item; those content gaps are outside the 14-item label space.',
    'Synthetic cases and keyword rules were authored by the same project; these numbers are a regression baseline, not an unbiased estimate.',
  ],
}

// ── markdown ────────────────────────────────────────────────────────────────

const mismatchLine = item => {
  const locator = item.locator === undefined ? '' : `; matched \`${item.locator.match}\` at ${item.locator.charStart}-${item.locator.charEnd}`
  const advice = item.advice === undefined ? '' : `; advice: ${item.advice}`
  return `- \`${item.case}\` ${item.item}: expected \`${item.expected}\`, predicted \`${item.predicted}\`${locator}${advice}`
}

const markdown = [
  '# dsh-manuscript-check benchmark: manuscripts',
  '',
  `- Dataset: \`${summary.dataset}\` v${summary.version} (${cases.length} synthetic manuscripts, ${totalLabels} item labels; ${wordSummary.min}-${wordSummary.max} words each)`,
  `- Plugin: \`${pkg.name}\` v${pkg.version}`,
  `- Call: \`${results.call}\``,
  '- Command: `pnpm run bench:manuscripts`',
  `- Labels: **${expectedPresentTotal} present / ${expectedMissingTotal} missing**`,
  '',
  '## Micro-averaged item metrics',
  '',
  '| Positive class | TP | FP | FN | TN | Precision | Recall | F1 |',
  '|---|---:|---:|---:|---:|---:|---:|---:|',
  `| \`present\` (headline) | ${totalPresent.tp} | ${totalPresent.fp} | ${totalPresent.fn} | ${totalPresent.tn} | ${formatRatio(results.metrics.present.precision)} | ${formatRatio(results.metrics.present.recall)} | ${formatRatio(results.metrics.present.f1)} |`,
  `| \`missing\` (alert) | ${totalMissing.tp} | ${totalMissing.fp} | ${totalMissing.fn} | ${totalMissing.tn} | ${formatRatio(results.metrics.missing.precision)} | ${formatRatio(results.metrics.missing.recall)} | ${formatRatio(results.metrics.missing.f1)} |`,
  '',
  `Item accuracy: **${formatRatio(results.metrics.itemAccuracy)}** (${correctItems}/${totalLabels}). ` +
    `Document-level \`missingCoreSections\` exact match: **${formatRatio(results.documents.coreMissingExactRate)}** (${coreMatches}/${cases.length}); ` +
    `all-14-items exact match: **${formatRatio(results.documents.allItemsExactRate)}** (${allItemsExact}/${cases.length}).`,
  '',
  '`present` counts a detected statement as positive; `missing` counts an alert as positive.',
  '',
  '## Per document',
  '',
  '| Case | Category | Words | Expected missing items | Correct | Accuracy | Present TP | FP | FN | TN | Core missing expected → actual |',
  '|---|---|---:|---|---:|---:|---:|---:|---:|---:|---|',
  ...perDocument.map(item => {
    const core = `\`${JSON.stringify(item.coreMissing.expected)}\` → \`${JSON.stringify(item.coreMissing.actual)}\`${item.coreMissing.match ? '' : ' **MISMATCH**'}`
    return `| \`${item.id}\` | ${item.category} | ${item.wordCount} | \`${JSON.stringify(item.expectedMissing)}\` | ${item.correctItems}/${ITEM_IDS.length} | ${formatRatio(item.accuracy)} | ${item.present.tp} | ${item.present.fp} | ${item.present.fn} | ${item.present.tn} | ${core} |`
  }),
  '',
  '## Per item',
  '',
  '| Item | Expected P/M | Present TP/FP/FN/TN | Present P | Present R | Present F1 | Missing TP/FP/FN/TN | Missing P | Missing R | Missing F1 |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  ...perItem.map(item => {
    const p = item.present
    const m = item.missing
    return `| \`${item.id}\` | ${item.expectedPresent}/${item.expectedMissing} | ${p.tp}/${p.fp}/${p.fn}/${p.tn} | ${formatRatio(p.precision)} | ${formatRatio(p.recall)} | ${formatRatio(p.f1)} | ${m.tp}/${m.fp}/${m.fn}/${m.tn} | ${formatRatio(m.precision)} | ${formatRatio(m.recall)} | ${formatRatio(m.f1)} |`
  }),
  '',
  '## Mismatches',
  '',
  ...(mismatches.length === 0 ? ['No item mismatches.'] : mismatches.map(mismatchLine)),
  '',
  '## Notes',
  '',
  ...results.notes.map(note => `- ${note}`),
  '',
].join('\n')

mkdirSync(outputDir, { recursive: true })
writeFileSync(path.join(outputDir, 'results-manuscripts.json'), `${JSON.stringify(results, null, 2)}\n`, 'utf8')
writeFileSync(path.join(outputDir, 'results-manuscripts.md'), markdown, 'utf8')

console.log(markdown)
