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
const marketEditorPath = 'src/components/project-info/MarketEditorModal.tsx'
const projectSpacePath = 'src/containers/ProjectSpaceContainer.tsx'
const spugProviderPath = 'src/lib/spugBuildOptions.ts'

const { buildMarketRowsFromMarkets, normalizeMarketRows, normalizeTargetMarkets } = evaluateTypeScriptModule(marketRulesPath)
const { mockSpugBuildOptionsProvider } = evaluateTypeScriptModule(spugProviderPath)
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

const marketEditorSource = fs.readFileSync(marketEditorPath, 'utf8')
assert.match(marketEditorSource, /branchInfo:\s*''/, 'a newly added market must start with an empty branch')
assert.match(marketEditorSource, /jenkinsUrl:\s*''/, 'a newly added market must start with an empty Jenkins URL')
assert.match(marketEditorSource, /buildAddress:\s*''/, 'a newly added market must start with an empty build URL')
assert.match(marketEditorSource, /key: 'branchInfo', label: '分支信息'/, 'the market matrix must include the branch row')
assert.match(marketEditorSource, /case 'branchInfo':[\s\S]*value=\{row\.branchInfo \|\| ''\}/, 'the market editor must bind branch information to the current market column')
assert.match(marketEditorSource, /case 'jenkinsUrl':[\s\S]*value=\{row\.jenkinsUrl \|\| ''\}/, 'the market editor must bind Jenkins URL to the current market column')
assert.match(marketEditorSource, /case 'buildAddress':[\s\S]*value=\{row\.buildAddress \|\| ''\}/, 'the market editor must bind build URL to the current market column')

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
