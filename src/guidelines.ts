/**
 * Reporting-guideline item definitions.
 *
 * These are deliberately labelled **starter checklists**, not the certified
 * CONSORT/STROBE/PRISMA checklists: each item is detected by keyword patterns,
 * so a present item can be missed if the authors use different wording. The
 * plugin reports coverage and locators, never a compliance verdict.
 *
 * @module dsh-manuscript-check/guidelines
 */

/** One checklist item. */
export interface GuidelineItem {
  /** Stable item id. */
  readonly id: string
  /** Human label. */
  readonly label: string
  /** Section the item is usually reported in (informational). */
  readonly section?: string
  /** Case-insensitive patterns; any match counts as present. */
  readonly patterns: readonly RegExp[]
  /** Advice shown when the item is missing. */
  readonly advice: string
}

/** A guideline definition. */
export interface Guideline {
  readonly id: 'manuscript' | 'consort' | 'strobe' | 'prisma'
  readonly title: string
  readonly items: readonly GuidelineItem[]
  /** Coverage below this fraction is a warning. */
  readonly targetCoverage: number
}

/** Recommended minimum manuscript structure. */
const MANUSCRIPT_ITEMS: readonly GuidelineItem[] = [
  { id: 'title', label: 'Title', patterns: [/^#\s+\S/mu, /^title\s*[:：]/imu], advice: 'add a title' },
  { id: 'abstract', label: 'Abstract', section: 'abstract', patterns: [/\babstract\b/iu, /\bsummary\b/iu], advice: 'add a structured abstract' },
  { id: 'introduction', label: 'Introduction / background', section: 'introduction', patterns: [/\bintroduction\b/iu, /\bbackground\b/iu], advice: 'add an introduction' },
  { id: 'methods', label: 'Methods', section: 'methods', patterns: [/\bmethods?\b/iu, /\bmaterials and methods\b/iu], advice: 'add a methods section' },
  { id: 'results', label: 'Results', section: 'results', patterns: [/\bresults\b/iu, /\bfindings\b/iu], advice: 'add a results section' },
  { id: 'discussion', label: 'Discussion', section: 'discussion', patterns: [/\bdiscussion\b/iu], advice: 'add a discussion section' },
  { id: 'conclusion', label: 'Conclusion', section: 'conclusion', patterns: [/\bconclusions?\b/iu], advice: 'state the conclusion' },
  { id: 'ethics', label: 'Ethics approval', patterns: [/\bethic/iu, /\bIRB\b/u, /\binstitutional review board/iu, /\bapproval\b/iu], advice: 'report the ethics approval or the waiver' },
  { id: 'consent', label: 'Informed consent', patterns: [/\bconsent\b/iu, /\bassent\b/iu], advice: 'state how consent was obtained (or waived)' },
  { id: 'funding', label: 'Funding', patterns: [/\bfunding\b/iu, /\bgrant\b/iu, /\bfinancial support\b/iu], advice: 'add a funding statement' },
  { id: 'conflicts', label: 'Conflicts of interest', patterns: [/\bconflicts? of interest\b/iu, /\bcompeting interests?\b/iu, /\bdeclarations? of interest\b/iu], advice: 'add a conflicts-of-interest statement' },
  { id: 'data', label: 'Data availability', patterns: [/\bdata availability\b/iu, /\bdata are available\b/iu, /\bdata can be obtained\b/iu, /\bdata sharing\b/iu], advice: 'add a data-availability statement with an accession or repository' },
  { id: 'contributions', label: 'Author contributions', patterns: [/\bauthor contributions?\b/iu, /\bcontributorship\b/iu, /\bCRediT\b/u], advice: 'add an author-contributions statement' },
  { id: 'registration', label: 'Registration / protocol', patterns: [/\bregistered\b/iu, /\bregistration\b/iu, /\bprotocol\b/iu, /\bISRCTN\b/u, /\bNCT\d+/u, /\bPROSPERO\b/u], advice: 'report the trial/protocol registration identifier' },
]

/** CONSORT starter checklist (RCT reports). */
const CONSORT_ITEMS: readonly GuidelineItem[] = [
  { id: 'c-title', label: 'Title identifies the trial design', patterns: [/\brandomi[sz]ed\b/iu, /\btrial\b/iu], advice: 'say “randomized controlled trial” in the title' },
  { id: 'c-abstract', label: 'Structured abstract', patterns: [/\babstract\b/iu], advice: 'use a structured abstract' },
  { id: 'c-background', label: 'Background and objectives', patterns: [/\bbackground\b/iu, /\bobjective/iu, /\baim\b/iu], advice: 'state the objective' },
  { id: 'c-design', label: 'Trial design', patterns: [/\btrial design\b/iu, /\bparallel\b/iu, /\bcrossover\b/iu, /\bfactorial\b/iu], advice: 'describe the trial design' },
  { id: 'c-participants', label: 'Eligibility criteria', patterns: [/\beligib/iu, /\binclusion criteria\b/iu, /\bexclusion criteria\b/iu], advice: 'give eligibility criteria' },
  { id: 'c-interventions', label: 'Interventions', patterns: [/\bintervention/iu, /\bcontrol group\b/iu, /\bplacebo\b/iu], advice: 'describe both arms precisely' },
  { id: 'c-outcomes', label: 'Outcomes', patterns: [/\bprimary outcome\b/iu, /\bsecondary outcome\b/iu, /\boutcomes?\b/iu], advice: 'name primary and secondary outcomes' },
  { id: 'c-sample', label: 'Sample size', patterns: [/\bsample size\b/iu, /\bpower (analysis|calculation)\b/iu, /\bpowered\b/iu], advice: 'report the sample-size calculation' },
  { id: 'c-random', label: 'Randomization and allocation', patterns: [/\brandomi[sz]ation\b/iu, /\ballocation concealment\b/iu, /\brandom sequence\b/iu], advice: 'describe sequence generation and allocation concealment' },
  { id: 'c-blind', label: 'Blinding', patterns: [/\bblind/iu, /\bmasking\b/iu], advice: 'state who was blinded' },
  { id: 'c-stats', label: 'Statistical methods', patterns: [/\bstatistical (methods|analysis)\b/iu, /\bintention[- ]to[- ]treat\b/iu, /\bper[- ]protocol\b/iu], advice: 'report the analysis population and methods' },
  { id: 'c-flow', label: 'Participant flow', patterns: [/\bflow (diagram|chart)\b/iu, /\bassessed for eligibility\b/iu, /\brandomly assigned\b/iu], advice: 'report numbers at each stage (flow diagram)' },
  { id: 'c-baseline', label: 'Baseline characteristics', patterns: [/\bbaseline\b/iu, /\btable 1\b/iu], advice: 'report baseline characteristics per arm' },
  { id: 'c-numbers', label: 'Numbers analysed', patterns: [/\banalysed\b/iu, /\banalyzed\b/iu, /\bper arm\b/iu], advice: 'report the number analysed per arm' },
  { id: 'c-outcomes-result', label: 'Outcomes and estimation', patterns: [/\beffect size\b/iu, /\bconfidence interval\b/iu, /\bdifference\b/iu], advice: 'report effect estimates with CIs' },
  { id: 'c-harms', label: 'Harms', patterns: [/\badverse event/iu, /\bharm/iu, /\bside effect/iu], advice: 'report harms' },
  { id: 'c-limitations', label: 'Limitations', patterns: [/\blimitation/iu], advice: 'discuss limitations' },
  { id: 'c-registration', label: 'Registration', patterns: [/\bregistered\b/iu, /\bISRCTN\b/u, /\bNCT\d+/u], advice: 'give the registration number' },
]

/** STROBE starter checklist (observational reports). */
const STROBE_ITEMS: readonly GuidelineItem[] = [
  { id: 's-design', label: 'Study design in title/abstract', patterns: [/\bcohort\b/iu, /\bcase[- ]control\b/iu, /\bcross[- ]sectional\b/iu], advice: 'name the design' },
  { id: 's-background', label: 'Background and rationale', patterns: [/\bbackground\b/iu, /\brationale\b/iu], advice: 'give the rationale' },
  { id: 's-objectives', label: 'Objectives', patterns: [/\bobjective/iu, /\baim\b/iu, /\bhypothes/iu], advice: 'state the objectives' },
  { id: 's-setting', label: 'Setting', patterns: [/\bsetting\b/iu, /\bclinics?\b/iu, /\bhospitals?\b/iu, /\bpopulation\b/iu], advice: 'describe the setting' },
  { id: 's-participants', label: 'Participants', patterns: [/\beligib/iu, /\bparticipants?\b/iu, /\bpatients?\b/iu], advice: 'describe eligibility and selection' },
  { id: 's-variables', label: 'Variables', patterns: [/\bvariables?\b/iu, /\bexposure/iu, /\bpredictor/iu, /\boutcome/iu], advice: 'define exposures, outcomes and confounders' },
  { id: 's-data', label: 'Data sources / measurement', patterns: [/\bdata source/iu, /\bmeasurement\b/iu, /\bquestionnaire\b/iu, /\bregistry\b/iu], advice: 'describe data sources and measurement' },
  { id: 's-bias', label: 'Bias', patterns: [/\bbias\b/iu, /\bconfound/iu], advice: 'describe efforts to address bias' },
  { id: 's-size', label: 'Study size', patterns: [/\bsample size\b/iu, /\bstudy size\b/iu], advice: 'explain how the study size was determined' },
  { id: 's-quant', label: 'Quantitative variables', patterns: [/\bcategori[sz]/iu, /\bcontinuous\b/iu, /\bquartile/iu], advice: 'describe how quantitative variables were handled' },
  { id: 's-stats', label: 'Statistical methods', patterns: [/\bstatistical (methods|analysis)\b/iu, /\bregression\b/iu, /\badjusted\b/iu], advice: 'describe the statistical methods' },
  { id: 's-flow', label: 'Participants flow', patterns: [/\bflow (diagram|chart)\b/iu, /\bnumber of (participants|patients)\b/iu, /\bexcluded\b/iu], advice: 'report numbers at each stage' },
  { id: 's-descriptive', label: 'Descriptive data', patterns: [/\bdescriptive\b/iu, /\bbaseline\b/iu, /\bmedian\b/iu, /\bmean\b/iu], advice: 'report descriptive data' },
  { id: 's-main', label: 'Main results', patterns: [/\bmain results?\b/iu, /\bodds ratio\b/iu, /\bhazard ratio\b/iu, /\bestimate\b/iu], advice: 'report unadjusted and adjusted estimates' },
  { id: 's-limitations', label: 'Limitations', patterns: [/\blimitation/iu], advice: 'discuss limitations' },
  { id: 's-funding', label: 'Funding', patterns: [/\bfunding\b/iu, /\bgrant\b/iu], advice: 'report funding' },
]

/** PRISMA starter checklist (systematic reviews). */
const PRISMA_ITEMS: readonly GuidelineItem[] = [
  { id: 'p-title', label: 'Title identifies it as a systematic review', patterns: [/\bsystematic review\b/iu, /\bmeta[- ]analysis\b/iu], advice: 'say “systematic review” in the title' },
  { id: 'p-abstract', label: 'Structured abstract', patterns: [/\babstract\b/iu], advice: 'use a PRISMA-style abstract' },
  { id: 'p-rationale', label: 'Rationale', patterns: [/\brationale\b/iu, /\bbackground\b/iu], advice: 'state the rationale' },
  { id: 'p-objectives', label: 'Objectives / questions', patterns: [/\bobjective/iu, /\bquestion/iu, /\bPICO\b/u], advice: 'state the review questions' },
  { id: 'p-eligibility', label: 'Eligibility criteria', patterns: [/\beligib/iu, /\binclusion criteria\b/iu, /\bexclusion criteria\b/iu], advice: 'give inclusion/exclusion criteria' },
  { id: 'p-sources', label: 'Information sources', patterns: [/\bPubMed\b/u, /\bEmbase\b/u, /\bWeb of Science\b/u, /\bdatabase/iu], advice: 'list the databases and dates' },
  { id: 'p-search', label: 'Search strategy', patterns: [/\bsearch strategy\b/iu, /\bsearch string\b/iu, /\bkeywords?\b/iu], advice: 'give the full search strategy' },
  { id: 'p-selection', label: 'Selection process', patterns: [/\bscreen/iu, /\bselection process\b/iu, /\btwo reviewers\b/iu, /\bdual\b/iu], advice: 'describe screening and reviewers' },
  { id: 'p-collection', label: 'Data collection', patterns: [/\bdata (extraction|collection)\b/iu, /\bextracted\b/iu], advice: 'describe data extraction' },
  { id: 'p-items', label: 'Data items', patterns: [/\bdata items?\b/iu, /\bvariables? (sought|collected)\b/iu], advice: 'list the data items' },
  { id: 'p-rob', label: 'Risk of bias', patterns: [/\brisk of bias\b/iu, /\bRoB\s?2?\b/u, /\bNewcastle/iu, /\bquality assessment\b/iu], advice: 'describe the risk-of-bias assessment' },
  { id: 'p-synthesis', label: 'Synthesis methods', patterns: [/\brandom[- ]effects?\b/iu, /\bfixed[- ]effects?\b/iu, /\bheterogeneity\b/iu, /\bI²\b/u, /\bI2\b/u], advice: 'describe synthesis and heterogeneity' },
  { id: 'p-bias', label: 'Reporting bias', patterns: [/\bpublication bias\b/iu, /\bfunnel plot\b/iu, /\breporting bias\b/iu], advice: 'assess reporting bias' },
  { id: 'p-flow', label: 'Study selection flow', patterns: [/\bPRISMA\b/u, /\bflow diagram\b/iu, /\brecords identified\b/iu], advice: 'report the PRISMA flow counts' },
  { id: 'p-characteristics', label: 'Study characteristics', patterns: [/\bcharacteristics of (included )?studies\b/iu, /\btable of studies\b/iu], advice: 'table the included studies' },
  { id: 'p-certainty', label: 'Certainty of evidence', patterns: [/\bGRADE\b/u, /\bcertainty of evidence\b/iu, /\bquality of evidence\b/iu], advice: 'rate the certainty of evidence' },
  { id: 'p-registration', label: 'Registration', patterns: [/\bPROSPERO\b/u, /\bregistered\b/iu, /\bregistration\b/iu], advice: 'give the protocol registration' },
]

/** The guideline catalogue. */
export const GUIDELINES: readonly Guideline[] = [
  { id: 'manuscript', title: 'Manuscript structure and declarations', items: MANUSCRIPT_ITEMS, targetCoverage: 0.8 },
  { id: 'consort', title: 'CONSORT starter checklist (randomized trials)', items: CONSORT_ITEMS, targetCoverage: 0.75 },
  { id: 'strobe', title: 'STROBE starter checklist (observational studies)', items: STROBE_ITEMS, targetCoverage: 0.75 },
  { id: 'prisma', title: 'PRISMA starter checklist (systematic reviews)', items: PRISMA_ITEMS, targetCoverage: 0.75 },
]

/**
 * Look up a guideline by id.
 * @param id - guideline id.
 * @returns the guideline, or undefined.
 */
export function guidelineOf(id: string): Guideline | undefined {
  return GUIDELINES.find(guideline => guideline.id === id)
}
