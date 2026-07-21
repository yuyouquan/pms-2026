import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const evaluateTypeScriptModule = (filename) => {
  const source = fs.readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    require: (id) => { throw new Error(`Unexpected module: ${id}`) },
    console,
  }, { filename })
  return module.exports
}

const marketRulesPath = 'src/lib/marketRules.ts'
const dimensionMatrixPath = 'src/components/project-info/DimensionMatrixEditor.tsx'
const marketEditorPath = 'src/components/project-info/MarketEditorModal.tsx'
const projectSpacePath = 'src/containers/ProjectSpaceContainer.tsx'
const spugProviderPath = 'src/lib/spugBuildOptions.ts'

const { buildMarketRowsFromMarkets, normalizeMarketRows, normalizeTargetMarkets } = evaluateTypeScriptModule(marketRulesPath)
const {
  formatMarketBuildSelectionIssue,
  loadSpugBuildOptions,
  mockSpugBuildOptionsProvider,
  validateMarketBuildSelections,
} = evaluateTypeScriptModule(spugProviderPath)
const fallback = {
  buildOption: 'ko2_sl303',
  buildMarket: 'op',
  branchInfo: 'feature/global',
  jenkinsUrl: 'https://jenkins.example/job/global',
  buildAddress: 'https://build.example/global',
}

const spugBuildOptions = await mockSpugBuildOptionsProvider.load()
const secondSpugBuildOptions = await mockSpugBuildOptionsProvider.load()
assert.deepEqual(
  JSON.parse(JSON.stringify(spugBuildOptions.buildOptions)),
  ['ko2_sl303', 'ko2', 'a681l_sm386', 'lj8k_h781', 'lj8_h781', 'lj7_h782', 'x1103b'],
  'SPUG provider must expose the mock build options asynchronously',
)
assert.deepEqual(
  JSON.parse(JSON.stringify(spugBuildOptions.buildMarkets)),
  ['op', 'tr'],
  'SPUG provider must expose the mock build markets asynchronously',
)
assert.notStrictEqual(
  spugBuildOptions.buildOptions,
  secondSpugBuildOptions.buildOptions,
  'each SPUG provider response must own its build options array',
)
assert.notStrictEqual(
  spugBuildOptions.buildMarkets,
  secondSpugBuildOptions.buildMarkets,
  'each SPUG provider response must own its build markets array',
)
spugBuildOptions.buildOptions.push('mutated-option')
spugBuildOptions.buildMarkets.push('mutated-market')
assert.deepEqual(
  JSON.parse(JSON.stringify(secondSpugBuildOptions.buildOptions)),
  ['ko2_sl303', 'ko2', 'a681l_sm386', 'lj8k_h781', 'lj8_h781', 'lj7_h782', 'x1103b'],
  'mutating one SPUG response must not affect a later response build options',
)
assert.deepEqual(
  JSON.parse(JSON.stringify(secondSpugBuildOptions.buildMarkets)),
  ['op', 'tr'],
  'mutating one SPUG response must not affect a later response build markets',
)

assert.equal(typeof loadSpugBuildOptions, 'function', 'SPUG loading must expose a testable stale-request guard')
assert.equal(typeof validateMarketBuildSelections, 'function', 'SPUG selections must expose pure structured validation')
assert.equal(typeof formatMarketBuildSelectionIssue, 'function', 'SPUG selection issues must expose exact user messages')

let resolveStaleRequest
let staleRequestActive = true
const staleRequestEvents = []
const staleRequest = loadSpugBuildOptions({
  load: () => new Promise(resolve => {
    resolveStaleRequest = resolve
  }),
}, {
  isActive: () => staleRequestActive,
  onSuccess: () => staleRequestEvents.push('success'),
  onError: () => staleRequestEvents.push('error'),
  onSettled: () => staleRequestEvents.push('settled'),
})
staleRequestActive = false
resolveStaleRequest(secondSpugBuildOptions)
await staleRequest
assert.deepEqual(staleRequestEvents, [], 'a request resolved after cleanup must not update success, error, or settled state')

const retryState = { error: false, options: undefined, events: [] }
await loadSpugBuildOptions({
  load: async () => { throw new Error('SPUG unavailable') },
}, {
  isActive: () => true,
  onSuccess: options => {
    retryState.options = options
    retryState.error = false
    retryState.events.push('success')
  },
  onError: () => {
    retryState.error = true
    retryState.events.push('error')
  },
  onSettled: () => retryState.events.push('settled'),
})
assert.deepEqual(retryState.events, ['error', 'settled'], 'an active rejected request must publish error and settled callbacks')
retryState.events = []
await loadSpugBuildOptions({
  load: async () => secondSpugBuildOptions,
}, {
  isActive: () => true,
  onSuccess: options => {
    retryState.options = options
    retryState.error = false
    retryState.events.push('success')
  },
  onError: () => {
    retryState.error = true
    retryState.events.push('error')
  },
  onSettled: () => retryState.events.push('settled'),
})
assert.deepEqual(retryState.events, ['success', 'settled'], 'a later active retry must publish success and settled callbacks')
assert.equal(retryState.error, false, 'a successful retry must not retain the earlier failure state')
assert.deepEqual(
  JSON.parse(JSON.stringify(retryState.options)),
  JSON.parse(JSON.stringify(secondSpugBuildOptions)),
  'a successful retry must publish the current provider values',
)

const selectionOptions = {
  buildOptions: ['ko2', 'x1103b'],
  buildMarkets: ['op', 'tr'],
}
const validSelectionResult = validateMarketBuildSelections([{
  market: 'OP', buildOption: 'ko2', buildMarket: 'op',
}, {
  market: 'TR', buildOption: 'x1103b', buildMarket: 'tr',
}], selectionOptions)
assert.equal(validSelectionResult.firstRequiredIssue, undefined, 'valid independent rows must not have a required issue')
assert.deepEqual(JSON.parse(JSON.stringify(validSelectionResult.unsupportedIssues)), [], 'valid independent rows must not have unsupported issues')

const missingBuildOptionResult = validateMarketBuildSelections([{
  market: 'OP', buildOption: '', buildMarket: 'op',
}], selectionOptions)
assert.deepEqual(JSON.parse(JSON.stringify(missingBuildOptionResult.firstRequiredIssue)), {
  field: 'buildOption', reason: 'required', market: 'OP', value: '',
}, 'a missing build option must return the first exact issue')
assert.equal(formatMarketBuildSelectionIssue(missingBuildOptionResult.firstRequiredIssue), '请填写 OP 市场的编译选项', 'missing build option message must identify its market')

const missingBuildMarketResult = validateMarketBuildSelections([{
  market: 'TR', buildOption: 'x1103b', buildMarket: '  ',
}], selectionOptions)
assert.deepEqual(JSON.parse(JSON.stringify(missingBuildMarketResult.firstRequiredIssue)), {
  field: 'buildMarket', reason: 'required', market: 'TR', value: '  ',
}, 'a missing build market must return the first exact issue')
assert.equal(formatMarketBuildSelectionIssue(missingBuildMarketResult.firstRequiredIssue), '请填写 TR 市场的编译市场', 'missing build market message must identify its market')

const buildOptionRequiredBeforeEarlierBuildMarket = validateMarketBuildSelections([{
  market: 'OP', buildOption: 'ko2', buildMarket: '',
}, {
  market: 'TR', buildOption: '', buildMarket: 'tr',
}], selectionOptions)
assert.deepEqual(JSON.parse(JSON.stringify(buildOptionRequiredBeforeEarlierBuildMarket.firstRequiredIssue)), {
  field: 'buildOption', reason: 'required', market: 'TR', value: '',
}, 'missing build options across all rows must take precedence over an earlier missing build market')

const requiredAndUnsupportedResult = validateMarketBuildSelections([{
  market: 'OP', buildOption: '', buildMarket: 'op',
}, {
  market: 'TR', buildOption: 'x1103b', buildMarket: 'legacy-market',
}], selectionOptions)
assert.deepEqual(JSON.parse(JSON.stringify(requiredAndUnsupportedResult.firstRequiredIssue)), {
  field: 'buildOption', reason: 'required', market: 'OP', value: '',
}, 'required validation must retain its first missing build option')
assert.deepEqual(JSON.parse(JSON.stringify(requiredAndUnsupportedResult.unsupportedIssues)), [{
  field: 'buildMarket', reason: 'unsupported', market: 'TR', value: 'legacy-market',
}], 'unsupported aggregation must remain visible even when a required issue exists')

const multipleUnsupportedResult = validateMarketBuildSelections([{
  market: 'OP', buildOption: 'legacy-option-op', buildMarket: 'legacy-market-op',
}, {
  market: 'TR', buildOption: 'legacy-option-tr', buildMarket: 'legacy-market-tr',
}], selectionOptions)
assert.equal(multipleUnsupportedResult.firstRequiredIssue, undefined, 'non-empty unsupported values must not be reported as required')
assert.deepEqual(JSON.parse(JSON.stringify(multipleUnsupportedResult.unsupportedIssues)), [{
  field: 'buildOption', reason: 'unsupported', market: 'OP', value: 'legacy-option-op',
}, {
  field: 'buildMarket', reason: 'unsupported', market: 'OP', value: 'legacy-market-op',
}, {
  field: 'buildOption', reason: 'unsupported', market: 'TR', value: 'legacy-option-tr',
}, {
  field: 'buildMarket', reason: 'unsupported', market: 'TR', value: 'legacy-market-tr',
}], 'all unsupported values must be returned in deterministic row and field order')
assert.equal(formatMarketBuildSelectionIssue(multipleUnsupportedResult.unsupportedIssues[0]), 'OP 市场的编译选项不在当前 SPUG 枚举中，请重新选择', 'unsupported build option message must be exact')
assert.equal(formatMarketBuildSelectionIssue(multipleUnsupportedResult.unsupportedIssues[1]), 'OP 市场的编译市场不在当前 SPUG 枚举中，请重新选择', 'unsupported build market message must be exact')

const initialized = buildMarketRowsFromMarkets(['OP', 'TR'], undefined, fallback)
assert.equal(initialized[0].buildOption, fallback.buildOption, 'existing OP must initialize the historical build option')
assert.equal(initialized[1].buildMarket, fallback.buildMarket, 'every existing market must initialize the historical build market')
assert.equal(initialized[0].branchInfo, fallback.branchInfo, 'existing OP must initialize the historical branch')
assert.equal(initialized[0].jenkinsUrl, fallback.jenkinsUrl, 'existing OP must initialize the historical Jenkins URL')
assert.equal(initialized[1].buildAddress, fallback.buildAddress, 'every existing market must initialize the historical build URL')

const preserved = buildMarketRowsFromMarkets(['OP'], [{
  id: 'market-OP',
  market: 'OP',
  isMain: true,
  followsMain: false,
  buildOption: '',
  buildMarket: undefined,
  branchInfo: '',
  jenkinsUrl: undefined,
  buildAddress: 'https://build.example/op',
}], fallback)[0]
assert.equal(preserved.buildOption, '', 'an explicitly cleared build option must not be backfilled')
assert.equal(preserved.buildMarket, fallback.buildMarket, 'only an undefined build market should be backfilled')
assert.equal(preserved.branchInfo, '', 'an explicitly cleared branch must not be backfilled')
assert.equal(preserved.jenkinsUrl, fallback.jenkinsUrl, 'only an undefined legacy field should be backfilled')
assert.equal(preserved.buildAddress, 'https://build.example/op', 'a market-specific value must win over the historical project value')

const untouchedWithoutFallback = buildMarketRowsFromMarkets(['OP'])[0]
assert.equal(untouchedWithoutFallback.branchInfo, undefined, 'store bootstrap must leave legacy rows detectable until the project fallback is available')

const normalizedBuildConfig = normalizeMarketRows([{
  id: 'market-OP',
  market: 'OP',
  isMain: true,
  followsMain: false,
  branchInfo: 'feature/op',
  jenkinsUrl: 'https://jenkins.example/job/op',
  buildAddress: 'https://build.example/op',
}])[0]
assert.equal(normalizedBuildConfig.branchInfo, 'feature/op', 'normalizing markets must preserve branch values')
assert.equal(normalizedBuildConfig.jenkinsUrl, 'https://jenkins.example/job/op', 'normalizing markets must preserve Jenkins values')
assert.equal(normalizedBuildConfig.buildAddress, 'https://build.example/op', 'normalizing markets must preserve build values')

const isolatedBuildConfigs = normalizeMarketRows([{
  id: 'market-OP',
  market: 'OP',
  isMain: true,
  followsMain: false,
  buildOption: 'ko2',
  buildMarket: 'op',
}, {
  id: 'market-TR',
  market: 'TR',
  isMain: false,
  followsMain: true,
  buildOption: 'x1103b',
  buildMarket: 'tr',
}])
assert.equal(isolatedBuildConfigs[0].buildOption, 'ko2', 'main market must retain its own build option')
assert.equal(isolatedBuildConfigs[0].buildMarket, 'op', 'main market must retain its own build market')
assert.equal(isolatedBuildConfigs[1].buildOption, 'x1103b', 'following market must retain its own build option')
assert.equal(isolatedBuildConfigs[1].buildMarket, 'tr', 'following market must retain its own build market')

assert.deepEqual(
  JSON.parse(JSON.stringify(normalizeTargetMarkets(' OP,TR, OP , ,RU '))),
  ['OP', 'TR', 'RU'],
  'machine creation must normalize, de-duplicate, and preserve target-market order',
)
assert.deepEqual(
  JSON.parse(JSON.stringify(normalizeTargetMarkets(['TR', ' OP ', 'TR', '', 'RU']))),
  ['TR', 'OP', 'RU'],
  'machine creation must accept array-shaped target-market values',
)

const dimensionMatrixSource = fs.readFileSync(dimensionMatrixPath, 'utf8')
const marketEditorSource = fs.readFileSync(marketEditorPath, 'utf8')
assert.match(dimensionMatrixSource, /dataIndex:\s*dimension\.id/, 'the shared matrix must key each dimension column by its id')
assert.match(dimensionMatrixSource, /pms-dimension-matrix/, 'the shared matrix must expose the common matrix class')
assert.match(marketEditorSource, /import DimensionMatrixEditor[\s\S]*from '@\/components\/project-info\/DimensionMatrixEditor'/, 'the market editor must import the shared dimension matrix')
assert.match(marketEditorSource, /<DimensionMatrixEditor/, 'the market editor must render the shared dimension matrix')
assert.match(
  marketEditorSource,
  /key: 'isMain'[\s\S]*key: 'followsMain'[\s\S]*key: 'buildOption'[\s\S]*key: 'buildMarket'[\s\S]*key: 'googleLaunchDate'[\s\S]*key: 'isMadaControlled'[\s\S]*key: 'isSimLocked'[\s\S]*key: 'isCancelPaused'[\s\S]*key: 'cancelPauseDate'/,
  'the market matrix must expose structural and business fields in the required order',
)
for (const hiddenField of ['isCarrierCustomized', 'branchInfo', 'jenkinsUrl', 'buildAddress']) {
  assert.doesNotMatch(
    marketEditorSource,
    new RegExp(`(?:key|case)\\s*:\\s*['\"]${hiddenField}['\"]|case\\s+['\"]${hiddenField}['\"]`),
    `the market editor must not expose the hidden ${hiddenField} field`,
  )
}
assert.match(marketEditorSource, /mockSpugBuildOptionsProvider/, 'the market editor must use the default mock SPUG provider')
assert.match(marketEditorSource, /spugLoading/, 'the market editor must track SPUG loading state')
assert.match(marketEditorSource, /spugError/, 'the market editor must track SPUG failure state')
assert.match(marketEditorSource, /loadSpugBuildOptions/, 'the market editor effect must use the tested SPUG loader')
assert.match(marketEditorSource, /spugLoaded/, 'the market editor must track whether the current SPUG request loaded successfully')
assert.match(marketEditorSource, /validateMarketBuildSelections/, 'the market editor must use structured SPUG selection validation')
assert.match(marketEditorSource, /firstRequiredIssue/, 'the market editor must retain the container-compatible required issue')
assert.match(marketEditorSource, /unsupportedIssues/, 'the market editor must retain every unsupported issue')
assert.match(marketEditorSource, /status=\{[^\n]*Unsupported[^\n]*\? 'error' : undefined\}/, 'unsupported legacy selections must remain visible with error status')
assert.match(marketEditorSource, /type="warning"[\s\S]*formatMarketBuildSelectionIssue/, 'the market editor must visibly warn about unsupported loaded values')
assert.match(marketEditorSource, /const handleSave =[\s\S]*spugLoading[\s\S]*spugError[\s\S]*spugLoaded[\s\S]*firstRequiredIssue[\s\S]*unsupportedIssues\[0\][\s\S]*onSave\(\)/, 'market save must enforce required ordering before its defensive unsupported guard')
assert.match(marketEditorSource, /saveDisabled=\{[\s\S]{0,240}spugLoading[\s\S]{0,240}spugError[\s\S]{0,240}!spugLoaded[\s\S]{0,240}unsupportedIssues\.length/, 'market save must disable when any unsupported issue exists')
assert.match(marketEditorSource, />重新获取</, 'the market editor must expose a visible SPUG retry action')

const projectSpaceSource = fs.readFileSync(projectSpacePath, 'utf8')
assert.match(projectSpaceSource, /const legacyMarketBuildConfig =/, 'the project space must define the historical project-level fallback')
const legacyMarketBuildConfigSource = projectSpaceSource.slice(
  projectSpaceSource.indexOf('const legacyMarketBuildConfig ='),
  projectSpaceSource.indexOf('  const marketConfigRows ='),
)
assert.match(legacyMarketBuildConfigSource, /buildOption:\s*legacyBuildFields\.buildOption/, 'the historical fallback must include the project build option')
assert.match(legacyMarketBuildConfigSource, /buildMarket:\s*legacyBuildFields\.buildMarket/, 'the historical fallback must include the project build market')
assert.doesNotMatch(legacyMarketBuildConfigSource, /\(selectedProject as any\)\.(buildOption|buildMarket)/, 'the historical fallback must avoid broad any casts')
assert.match(projectSpaceSource, /buildMarketRowsFromMarkets\([\s\S]*legacyMarketBuildConfig[\s\S]*\)/, 'market rows must be hydrated with the historical project values')
const wholeMachinePlanStart = projectSpaceSource.indexOf('const renderWholeMachinePlanInfo = () =>')
const wholeMachinePlanEnd = projectSpaceSource.indexOf('const anchorSections = [', wholeMachinePlanStart)
const wholeMachinePlanSource = projectSpaceSource.slice(wholeMachinePlanStart, wholeMachinePlanEnd)
assert.match(wholeMachinePlanSource, /title=\{sectionTitle\([^\n]*'计划信息'/, 'whole-machine plan card must use the plan-information title')
assert.doesNotMatch(wholeMachinePlanSource, /配置信息|构建信息|label="分支信息"|label="Jenkins构建"|label="版本地址"/, 'whole-machine plan view must not display build configuration')
assert.match(projectSpaceSource, /<MarketEditorModal[\s\S]*rows=\{marketDraftRows\}/, 'market configuration editing must remain available')
assert.match(projectSpaceSource, /setMarketConfigForProject\(selectedProject\.id, normalizedRows\)/, 'saving the market editor must persist the full normalized rows')
assert.match(projectSpaceSource, /message\.error\(`请填写 \$\{missingBuildOptionRow\.market\} 市场的编译选项`\)/, 'market save must identify the market missing its build option')
assert.match(projectSpaceSource, /message\.error\(`请填写 \$\{missingBuildMarketRow\.market\} 市场的编译市场`\)/, 'market save must identify the market missing its build market')
assert.match(projectSpaceSource, /showMarketControls\s*=\s*isMachineProjectType/, 'machine plan controls must remain visible before the first market exists')
assert.match(projectSpaceSource, /尚未配置市场[\s\S]*onClick=\{openMarketEditor\}/, 'machine basic information must expose the first-market editor from an empty state')
assert.match(projectSpaceSource, /selectedMarketIsConfigured\s*=\s*isConfiguredMarket\(marketConfigRows, selectedMarketTab\)/, 'market plan scope must derive membership from the current project configuration')
assert.match(projectSpaceSource, /canUseSelectedMarketPlanScope\s*=\s*canUseMarketPlanScope\([\s\S]*marketConfigRows,[\s\S]*selectedMarketTab,[\s\S]*isWholeMachineProject,[\s\S]*projectPlanLevel/, 'production plan scoping must call the tested market-scope decision helper')
assert.match(projectSpaceSource, /currentMarketData\s*=\s*isWholeMachineProject && selectedMarketIsConfigured/, 'machine plan data must never read an unconfigured selected market')
assert.match(projectSpaceSource, /setSelectedMarketTab\(getConfiguredMarketSelection\(normalizedRows, selectedMarketTab\)\)/, 'saving market configuration must activate a configured market')
assert.match(projectSpaceSource, /configuredMarketName\s*=\s*getConfiguredMarketMetadataValue\(marketConfigRows, selectedMarketTab\)/, 'level-two market metadata must use the tested configuration-aware helper')
assert.doesNotMatch(projectSpaceSource, /marketName:\s*selectedMarketTab/, 'level-two metadata must never persist the raw default market tab')
assert.doesNotMatch(projectSpaceSource, /label="市场名"[\s\S]{0,120}value=\{selectedMarketTab\}/, 'the MR creation form must not display a phantom default market')
assert.match(projectSpaceSource, /const draftDimension = isTosTypeScoped[\s\S]*isMarketScopedLevel1[\s\S]*configuredMarketName[\s\S]*isWholeMachineProject[\s\S]*'machine'/, 'machine level-two version initialization must use a stable non-market dimension')
assert.match(projectSpaceSource, /projectPlanLevel === 'level1'[\s\S]*`market::\$\{configuredMarketName\}`[\s\S]*: 'machine'/, 'machine level-two collapse state must not be keyed by the default market tab')
const planNavigationIndex = projectSpaceSource.indexOf('items={planTabItems.map')
const unavailableContentIndex = projectSpaceSource.indexOf('{machineMarketPlanUnavailable ? (')
assert.equal(planNavigationIndex >= 0, true, 'the plan level navigation must remain rendered')
assert.equal(unavailableContentIndex > planNavigationIndex, true, 'the empty-market decision must live below plan level navigation')
assert.doesNotMatch(projectSpaceSource, /if \(isWholeMachineProject && !selectedMarketIsConfigured\) \{[\s\S]{0,300}return/, 'empty markets must not return before level-two navigation')

const addProjectSource = fs.readFileSync('src/components/workspace/AddProjectModal.tsx', 'utf8')
assert.match(addProjectSource, /isMachineProjectType\(projectType\)[\s\S]*normalizeTargetMarkets\(payload\.infoValues\.targetMarkets \?\? extra\.targetMarkets\)/, 'machine creation must bootstrap markets from targetMarkets')

console.log('market-specific build configuration verification passed')
