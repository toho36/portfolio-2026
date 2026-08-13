#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

export const BUDGETS = Object.freeze({
  sharedRegressionGzipBytes: 8 * 1024,
  coldRallyRuntimeGzipBytes: 245 * 1024,
  visualAssetsBytes: 120 * 1024,
})
export const GZIP_OPTIONS = Object.freeze({ level: 9 })
const BASELINE_SHA = '09eb197'
const BASELINE_VITE_VERSION = '8.2.0'
const BASELINE_NODE_VERSION = 'v22.22.2'
const BASELINE_ZLIB_VERSION = '1.2.12'
const FROZEN_BASELINE = Object.freeze({
  sha: BASELINE_SHA,
  fullSha: '09eb1977e8e4547618f3509875db819c750d4da0',
  sharedInitialBytes: 247_555,
  sharedInitialGzipBytes: 76_237,
  viteVersion: BASELINE_VITE_VERSION,
  nodeVersion: BASELINE_NODE_VERSION,
  zlibVersion: BASELINE_ZLIB_VERSION,
  gzipLevel: GZIP_OPTIONS.level,
})
const TICKET = 't_e886e3c3'
const ROOT = resolve(
  process.env.VOLEYEVENTS_BUDGET_ROOT ?? dirname(fileURLToPath(import.meta.url)),
  process.env.VOLEYEVENTS_BUDGET_ROOT ? '.' : '..',
)
const MANIFEST_PATH = join(ROOT, 'dist/.vite/manifest.json')
const EVIDENCE_DIR = join(ROOT, 'docs/evidence/voleyevents-rally')
const BUNDLE_PATH = join(EVIDENCE_DIR, 'bundle-budget.json')

function fail(name, detail) {
  throw new Error(`${name}: ${detail}`)
}

function readJson(path, name) {
  if (!existsSync(path)) fail(name, `missing ${path}`)
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    fail(name, error instanceof Error ? error.message : 'invalid JSON')
  }
}

function manifestRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('MANIFEST_MALFORMED', 'root must be an object')
  }
  for (const [key, entry] of Object.entries(value)) {
    if (!entry || typeof entry !== 'object' || typeof entry.file !== 'string') {
      fail('MANIFEST_MALFORMED', `${key} has no emitted file`)
    }
    for (const field of ['imports', 'dynamicImports', 'css', 'assets']) {
      if (entry[field] !== undefined && !Array.isArray(entry[field])) {
        fail('MANIFEST_MALFORMED', `${key}.${field} must be an array`)
      }
    }
  }
  return value
}

function findUniqueEntry(manifest, predicate, name) {
  const matches = Object.entries(manifest).filter(([key, entry]) => predicate(entry, key))
  if (matches.length !== 1) fail(name, `expected one entry, found ${matches.length}`)
  return matches[0][0]
}

function walkEntries(manifest, roots, includeDynamic) {
  const visited = new Set()
  const pending = [...roots]
  while (pending.length > 0) {
    const key = pending.pop()
    if (visited.has(key)) continue
    const entry = manifest[key]
    if (!entry) fail('MANIFEST_MALFORMED', `missing referenced entry ${key}`)
    visited.add(key)
    pending.push(...(entry.imports ?? []))
    if (includeDynamic) pending.push(...(entry.dynamicImports ?? []))
  }
  return visited
}

function ownedFiles(manifest, entryKeys) {
  const files = new Set()
  for (const key of entryKeys) {
    const entry = manifest[key]
    files.add(entry.file)
    for (const file of entry.css ?? []) files.add(file)
    for (const file of entry.assets ?? []) files.add(file)
  }
  return files
}

export function collectManifestAttribution(rawManifest) {
  const manifest = manifestRecord(rawManifest)
  const indexKey = findUniqueEntry(
    manifest,
    (entry) => entry.isEntry === true,
    'MANIFEST_INDEX_ENTRY',
  )
  const rallyKey = findUniqueEntry(
    manifest,
    (entry, key) => entry.isDynamicEntry === true &&
      /(?:^|\/)src\/voleyevents\/loadRallyRuntime\.ts$/.test(entry.src ?? key),
    'MANIFEST_RALLY_ENTRY',
  )
  const sharedEntries = walkEntries(manifest, [indexKey], false)
  const routeEntries = walkEntries(manifest, [rallyKey], true)
  const sharedFiles = ownedFiles(manifest, sharedEntries)
  const routeFiles = ownedFiles(manifest, routeEntries)
  for (const file of sharedFiles) routeFiles.delete(file)

  return Object.freeze({
    indexKey,
    rallyKey,
    sharedEntries: Object.freeze([...sharedEntries].sort()),
    routeEntries: Object.freeze([...routeEntries].sort()),
    sharedFiles: Object.freeze([...sharedFiles].sort()),
    routeFiles: Object.freeze([...routeFiles].sort()),
  })
}

function fileFacts(relativePath) {
  const path = join(ROOT, 'dist', relativePath)
  if (!existsSync(path)) fail('MANIFEST_OUTPUT_MISSING', relativePath)
  const bytes = readFileSync(path)
  return Object.freeze({
    file: relativePath,
    bytes: bytes.length,
    gzipBytes: gzipSync(bytes, GZIP_OPTIONS).length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  })
}

function digestFacts(facts) {
  const hash = createHash('sha256')
  for (const fact of [...facts].sort((left, right) => left.file.localeCompare(right.file))) {
    hash.update(fact.file).update('\0').update(fact.sha256).update('\0')
  }
  return hash.digest('hex')
}

function candidateInputPaths() {
  const files = [
    'index.html',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'vercel.json',
    'vite.config.ts',
    'scripts/check-voleyevents-rally-budget.mjs',
  ]
  const visit = (path) => {
    if (!existsSync(path)) fail('CANDIDATE_SOURCE_MISSING', relative(ROOT, path))
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = join(path, entry.name)
      if (entry.isDirectory()) visit(child)
      else if (entry.isFile()) files.push(relative(ROOT, child))
      else fail('CANDIDATE_SOURCE_INVALID', relative(ROOT, child))
    }
  }
  visit(join(ROOT, 'src'))
  visit(join(ROOT, 'public'))
  return [...new Set(files)].sort()
}

function sourceDigest() {
  const hash = createHash('sha256')
  for (const path of candidateInputPaths()) {
    const absolute = join(ROOT, path)
    if (!existsSync(absolute)) fail('CANDIDATE_SOURCE_MISSING', path)
    hash.update(path).update('\0').update(readFileSync(absolute)).update('\0')
  }
  return hash.digest('hex')
}

export function validateFrozenBaseline(
  baseline,
  nodeVersion = BASELINE_NODE_VERSION,
  zlibVersion = BASELINE_ZLIB_VERSION,
) {
  if (
    !baseline || baseline.sha !== BASELINE_SHA ||
    !Number.isInteger(baseline.sharedInitialGzipBytes) ||
    baseline.sharedInitialGzipBytes <= 0 ||
    baseline.viteVersion !== BASELINE_VITE_VERSION ||
    baseline.nodeVersion !== nodeVersion ||
    baseline.zlibVersion !== zlibVersion ||
    baseline.gzipLevel !== GZIP_OPTIONS.level
  ) {
    fail(
      'BASELINE_INVALID',
      `freeze ${BASELINE_SHA} with Vite ${BASELINE_VITE_VERSION}, Node ${nodeVersion}, zlib ${zlibVersion}, level ${GZIP_OPTIONS.level}`,
    )
  }
  return baseline
}

function frozenBaseline() {
  return validateFrozenBaseline(FROZEN_BASELINE)
}

export function enforceBudgets(totals, baselineBytes) {
  const regression = totals.sharedGzipBytes - baselineBytes
  if (regression > BUDGETS.sharedRegressionGzipBytes) {
    fail('SHARED_INITIAL_BUDGET', `${regression} > ${BUDGETS.sharedRegressionGzipBytes}`)
  }
  if (totals.routeGzipBytes > BUDGETS.coldRallyRuntimeGzipBytes) {
    fail('COLD_RALLY_RUNTIME_BUDGET', `${totals.routeGzipBytes} > ${BUDGETS.coldRallyRuntimeGzipBytes}`)
  }
  if (totals.visualBytes > BUDGETS.visualAssetsBytes) {
    fail('VISUAL_ASSET_BUDGET', `${totals.visualBytes} > ${BUDGETS.visualAssetsBytes}`)
  }
  return regression
}

function assertNumber(value, name, predicate) {
  if (typeof value !== 'number' || !Number.isFinite(value) || !predicate(value)) {
    fail('RUNTIME_EVIDENCE_INVALID', name)
  }
}

const QUALITY_TIERS = Object.freeze(['Low', 'Medium', 'High'])

function transitionEvidenceFail(traceName, detail) {
  fail('TRANSITION_EVIDENCE_INVALID', `${traceName} ${detail}`)
}

export function validateTransitionTrace(trace, traceName = 'trace') {
  if (!trace || typeof trace !== 'object' || Array.isArray(trace)) {
    transitionEvidenceFail(traceName, 'must be an object')
  }
  const { platform, targetMs, recoveryMs, ceiling, startTier, windows, transitions } = trace
  const thresholds = platform === 'desktop' ? [18, 14]
    : platform === 'mobile' ? [25, 19]
      : null
  if (!thresholds || targetMs !== thresholds[0] || recoveryMs !== thresholds[1]) {
    transitionEvidenceFail(traceName, 'has invalid platform target/recovery thresholds')
  }
  const ceilingIndex = QUALITY_TIERS.indexOf(ceiling)
  const startIndex = QUALITY_TIERS.indexOf(startTier)
  if (ceilingIndex < 0 || startIndex < 0 || startIndex > ceilingIndex) {
    transitionEvidenceFail(traceName, 'has an invalid ceiling/startTier')
  }
  if (!Array.isArray(windows) || windows.length === 0 || !Array.isArray(transitions)) {
    transitionEvidenceFail(traceName, 'requires windows and transitions arrays')
  }

  let tier = startTier
  let surrendered = false
  let misses = 0
  let lowMisses = 0
  let recoverySince = null
  let lastChangeAt = -Infinity
  let previousEnd = null
  const expectedTransitions = []
  const resetEvidence = () => {
    misses = 0
    lowMisses = 0
    recoverySince = null
  }
  const changeTier = (window, to, reason) => {
    const entry = { at: window.endedAt, from: tier, to, reason }
    expectedTransitions.push(entry)
    if (to === 'Static') surrendered = true
    else tier = to
    lastChangeAt = window.endedAt
    resetEvidence()
  }

  for (const [index, window] of windows.entries()) {
    if (surrendered || !window || typeof window !== 'object' || Array.isArray(window)) {
      transitionEvidenceFail(traceName, `window ${index} is invalid or follows surrender`)
    }
    if (!Number.isFinite(window.startedAt) || !Number.isFinite(window.endedAt) ||
        window.endedAt - window.startedAt !== 2_000 ||
        (previousEnd !== null && window.startedAt !== previousEnd) ||
        !Number.isFinite(window.p95) || window.p95 < 0 ||
        !Number.isInteger(window.samples) || window.samples <= 0 ||
        window.tier !== tier) {
      transitionEvidenceFail(traceName, `window ${index} does not match a continuous 2s trace`)
    }
    previousEnd = window.endedAt

    if (window.p95 > targetMs) {
      recoverySince = null
      misses += 1
      if (tier === 'Low') {
        lowMisses += 1
        if (lowMisses >= 2) changeTier(window, 'Static', 'surrender')
      } else {
        lowMisses = 0
        if (misses >= 2) {
          changeTier(window, QUALITY_TIERS[QUALITY_TIERS.indexOf(tier) - 1], 'miss')
        }
      }
    } else {
      misses = 0
      lowMisses = 0
      if (window.p95 < recoveryMs) {
        recoverySince ??= window.startedAt
        const tierIndex = QUALITY_TIERS.indexOf(tier)
        if (window.endedAt - recoverySince >= 5_000 &&
            window.endedAt - lastChangeAt >= 5_000 && tierIndex < ceilingIndex) {
          changeTier(window, QUALITY_TIERS[tierIndex + 1], 'recovery')
        }
      } else {
        recoverySince = null
      }
    }
  }

  if (transitions.length !== expectedTransitions.length) {
    transitionEvidenceFail(traceName, 'transition count does not match its windows')
  }
  for (const [index, expected] of expectedTransitions.entries()) {
    const actual = transitions[index]
    if (!actual || actual.at !== expected.at || actual.from !== expected.from ||
        actual.to !== expected.to || actual.reason !== expected.reason) {
      transitionEvidenceFail(traceName, `transition ${index} does not match its windows`)
    }
  }
  return Object.freeze({ expectedTransitions, surrendered })
}

function validateForcedTransitionCoverage(trace, validation) {
  if (trace.ceiling !== 'High' || trace.startTier !== 'Medium') {
    transitionEvidenceFail('forced', 'must exercise a High ceiling from Medium start')
  }
  const reasons = validation.expectedTransitions.map(({ reason }) => reason)
  let sequenceAt = 0
  for (const required of ['miss', 'recovery', 'miss', 'surrender']) {
    sequenceAt = reasons.indexOf(required, sequenceAt)
    if (sequenceAt < 0) transitionEvidenceFail('forced', `missing ordered ${required}`)
    sequenceAt += 1
  }
  if (!validation.surrendered) transitionEvidenceFail('forced', 'does not surrender')

  const surrenderAt = trace.transitions.find(({ reason }) => reason === 'surrender')?.at
  const beforeSurrender = trace.windows.filter(({ endedAt }) => endedAt < surrenderAt)
  const provesReset = beforeSurrender.some((window, index) =>
    window.tier === 'Low' && window.p95 > trace.targetMs &&
    beforeSurrender[index + 1]?.tier === 'Low' &&
    beforeSurrender[index + 1]?.p95 <= trace.targetMs,
  )
  if (!provesReset) {
    transitionEvidenceFail('forced', 'must include a Low miss followed by an intervening pass')
  }
}

export function validateForcedTransitionTrace(trace) {
  const validation = validateTransitionTrace(trace, 'forced')
  validateForcedTransitionCoverage(trace, validation)
  return validation
}

export function validateRuntimeEvidence(candidateId, evidenceRoot = EVIDENCE_DIR) {
  const performance = readJson(
    join(evidenceRoot, 'performance-matrix.json'),
    'PERFORMANCE_EVIDENCE_MISSING',
  )
  if (performance.status !== 'PASS' || performance.candidateId !== candidateId) {
    fail('PERFORMANCE_EVIDENCE_INVALID', 'status/candidate mismatch')
  }
  const desktop = performance.desktop
  const mobile = performance.mobile
  if (desktop?.viewport !== '1440x1000' || mobile?.viewport !== '360x701') {
    fail('PERFORMANCE_EVIDENCE_INVALID', 'required desktop and physical-device viewports')
  }
  if (mobile?.device !== 'Samsung SM-G950F' || mobile?.os !== 'Android 9' ||
      mobile?.physical !== true || mobile?.serialRedacted !== true) {
    fail('PERFORMANCE_EVIDENCE_INVALID', 'named physical target')
  }
  assertNumber(desktop.p95FrameMs, 'desktop p95', (value) => value <= 18)
  assertNumber(mobile.p95FrameMs, 'mobile p95', (value) => value <= 25)
  for (const [name, record] of [['desktop', desktop], ['mobile', mobile]]) {
    if (record.measurementStart !== 'runtime-ready') {
      fail('PERFORMANCE_EVIDENCE_INVALID', `${name} measurement start`)
    }
    assertNumber(record.longTasksOver50Ms, `${name} long tasks`, (value) => value === 0)
    assertNumber(record.interactionP98Ms, `${name} interaction p98`, (value) => value <= 200)
    assertNumber(record.cls, `${name} CLS`, (value) => value <= 0.05)
  }
  for (const width of ['320', '390', '768', '1024', '1440']) {
    assertNumber(performance.overflow?.[width], `overflow ${width}`, (value) => value === 0)
  }
  if (performance.emulationIsLayoutOnly !== true) {
    fail('PERFORMANCE_EVIDENCE_INVALID', 'emulation must be identified as layout-only')
  }
  const rendererCaps = {
    High: { calls: 18, triangles: 30_000, dpr: 1.5, waves: 2 },
    Medium: { calls: 14, triangles: 20_000, dpr: 1.25, waves: 1 },
    Low: { calls: 10, triangles: 12_000, dpr: 1, waves: 1 },
  }
  for (const [tier, caps] of Object.entries(rendererCaps)) {
    const measured = performance.renderer?.[tier]
    if (measured?.measured !== true) {
      fail('PERFORMANCE_EVIDENCE_INVALID', `${tier} renderer measurement`)
    }
    assertNumber(measured.calls, `${tier} draw calls`, (value) => value <= caps.calls)
    assertNumber(measured.triangles, `${tier} triangles`, (value) => value <= caps.triangles)
    assertNumber(measured.dpr, `${tier} DPR`, (value) => value <= caps.dpr)
    assertNumber(measured.waves, `${tier} waves`, (value) => value === caps.waves)
  }

  const tiers = readJson(
    join(evidenceRoot, 'tier-transitions.json'),
    'TRANSITION_EVIDENCE_MISSING',
  )
  if (tiers.status !== 'PASS' || tiers.candidateId !== candidateId) {
    fail('TRANSITION_EVIDENCE_INVALID', 'trace/candidate mismatch')
  }
  validateTransitionTrace(tiers.unforced, 'unforced')
  validateForcedTransitionTrace(tiers.forced)

  const acceptancePath = join(evidenceRoot, 'browser-acceptance.md')
  if (!existsSync(acceptancePath)) {
    fail('BROWSER_ACCEPTANCE_MISSING', acceptancePath)
  }
  const acceptance = readFileSync(acceptancePath, 'utf8')
  const acceptanceLines = new Set(acceptance.split(/\r?\n/).map((line) => line.trim()))
  for (const requiredLine of [
    'Status: PASS',
    `Candidate ID: ${candidateId}`,
    '- [x] Desktop and physical-phone screenshots: hero plus four impact stops',
    '- [x] Direct load, trailing slash, fragments, and Back/Forward',
    '- [x] Keyboard focus and native scrolling',
    '- [x] Reduced motion: zero GSAP/Three requests and zero canvas',
    '- [x] No-WebGL and context-loss static fallback',
    '- [x] Forward/reverse/alternating progress determinism',
    '- [x] Pointer/touch disturbance without captured vertical scroll',
    '- [x] Resize/orientation and long-copy fit',
    '- [x] 10x route lifecycle: zero retained canvas, trigger, RAF, listener, or context',
    '- [x] Sibling-route request isolation',
    '- [x] Overflow zero; no console errors, failed requests, or hidden essential content',
    '- [x] No rendered HUD or public diagnostics/metrics',
  ]) {
    if (!acceptanceLines.has(requiredLine)) {
      fail('BROWSER_ACCEPTANCE_INVALID', requiredLine)
    }
  }
}

export function runBudgetCheck() {
  execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' })
  const manifest = manifestRecord(readJson(MANIFEST_PATH, 'MANIFEST_MISSING'))
  const attribution = collectManifestAttribution(manifest)
  const baseline = frozenBaseline()
  const allFiles = [...new Set([...attribution.sharedFiles, ...attribution.routeFiles])]
  const facts = allFiles.map(fileFacts)
  const byFile = new Map(facts.map((fact) => [fact.file, fact]))
  const shared = attribution.sharedFiles
    .filter((file) => extname(file) === '.js')
    .map((file) => byFile.get(file))
  const route = attribution.routeFiles
    .filter((file) => extname(file) === '.js')
    .map((file) => byFile.get(file))
  const visual = attribution.routeFiles
    .filter((file) => !['.js', '.css'].includes(extname(file)))
    .map((file) => byFile.get(file))
  const sharedGzipBytes = shared.reduce((sum, fact) => sum + fact.gzipBytes, 0)
  const routeGzipBytes = route.reduce((sum, fact) => sum + fact.gzipBytes, 0)
  const visualBytes = visual.reduce((sum, fact) => sum + fact.bytes, 0)
  const regression = enforceBudgets(
    { sharedGzipBytes, routeGzipBytes, visualBytes },
    baseline.sharedInitialGzipBytes,
  )

  const packageJson = readJson(join(ROOT, 'package.json'), 'PACKAGE_METADATA_MISSING')
  const buildDigest = digestFacts(facts)
  const candidateSourceDigest = sourceDigest()
  const candidateId = `working-tree:${candidateSourceDigest}:${buildDigest}`
  const report = {
    schemaVersion: 1,
    ticket: TICKET,
    status: 'PASS',
    runtimeEvidenceStatus: 'PENDING_CONTROLLER_CAPTURE',
    candidate: { id: candidateId, sourceDigest: candidateSourceDigest, buildDigest },
    baseline,
    tools: {
      node: process.version,
      zlib: process.versions.zlib,
      vite: packageJson.dependencies?.vite ?? packageJson.devDependencies?.vite,
      gzipLevel: GZIP_OPTIONS.level,
    },
    budgets: BUDGETS,
    totals: {
      sharedInitialGzipBytes: sharedGzipBytes,
      sharedRegressionGzipBytes: regression,
      coldRallyRuntimeGzipBytes: routeGzipBytes,
      visualAssetsBytes: visualBytes,
    },
    attribution,
    files: facts,
  }
  writeFileSync(BUNDLE_PATH, `${JSON.stringify(report, null, 2)}\n`)
  return report
}

export function runRuntimeEvidenceCheck() {
  const report = readJson(BUNDLE_PATH, 'BUNDLE_EVIDENCE_MISSING')
  const candidateId = report.candidate?.id
  if (report.status !== 'PASS' || typeof candidateId !== 'string') {
    fail('BUNDLE_EVIDENCE_INVALID', 'run the bundle check before runtime validation')
  }
  if (report.candidate.sourceDigest !== sourceDigest()) {
    fail('CANDIDATE_CHANGED', 'source digest differs from the bundle report')
  }
  if (!Array.isArray(report.files) || report.files.length === 0) {
    fail('BUNDLE_EVIDENCE_INVALID', 'missing attributed files')
  }
  const currentBuildDigest = digestFacts(
    report.files.map((fact) => fileFacts(fact.file)),
  )
  if (report.candidate.buildDigest !== currentBuildDigest) {
    fail('CANDIDATE_CHANGED', 'build digest differs from the bundle report')
  }
  validateRuntimeEvidence(candidateId)
  const complete = {
    ...report,
    runtimeEvidenceStatus: 'PASS',
  }
  writeFileSync(BUNDLE_PATH, `${JSON.stringify(complete, null, 2)}\n`)
  return complete
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const report = process.argv.includes('--runtime-evidence')
      ? runRuntimeEvidenceCheck()
      : runBudgetCheck()
    process.stdout.write(`${JSON.stringify(report.totals)}\n`)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
