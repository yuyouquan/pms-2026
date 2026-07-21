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

const { buildMarketRowsFromMarkets } = evaluateTypeScriptModule(marketRulesPath)
const fallback = {
  branchInfo: 'feature/global',
  jenkinsUrl: 'https://jenkins.example/job/global',
  buildAddress: 'https://build.example/global',
}

const initialized = buildMarketRowsFromMarkets(['OP', 'TR'], undefined, fallback)
assert.equal(initialized[0].branchInfo, fallback.branchInfo, 'existing OP must initialize the historical branch')
assert.equal(initialized[0].jenkinsUrl, fallback.jenkinsUrl, 'existing OP must initialize the historical Jenkins URL')
assert.equal(initialized[1].buildAddress, fallback.buildAddress, 'every existing market must initialize the historical build URL')

const preserved = buildMarketRowsFromMarkets(['OP'], [{
  id: 'market-OP',
  market: 'OP',
  isMain: true,
  followsMain: false,
  branchInfo: '',
  jenkinsUrl: undefined,
  buildAddress: 'https://build.example/op',
}], fallback)[0]
assert.equal(preserved.branchInfo, '', 'an explicitly cleared branch must not be backfilled')
assert.equal(preserved.jenkinsUrl, fallback.jenkinsUrl, 'only an undefined legacy field should be backfilled')
assert.equal(preserved.buildAddress, 'https://build.example/op', 'a market-specific value must win over the historical project value')

const untouchedWithoutFallback = buildMarketRowsFromMarkets(['OP'])[0]
assert.equal(untouchedWithoutFallback.branchInfo, undefined, 'store bootstrap must leave legacy rows detectable until the project fallback is available')

const marketEditorSource = fs.readFileSync(marketEditorPath, 'utf8')
assert.match(marketEditorSource, /branchInfo:\s*''/, 'a newly added market must start with an empty branch')
assert.match(marketEditorSource, /jenkinsUrl:\s*''/, 'a newly added market must start with an empty Jenkins URL')
assert.match(marketEditorSource, /buildAddress:\s*''/, 'a newly added market must start with an empty build URL')
assert.match(marketEditorSource, /label="分支信息"[\s\S]*value=\{row\.branchInfo \|\| ''\}/, 'the market editor must bind branch information to the current row')
assert.match(marketEditorSource, /label="Jenkins 构建"[\s\S]*value=\{row\.jenkinsUrl \|\| ''\}/, 'the market editor must bind Jenkins URL to the current row')
assert.match(marketEditorSource, /label="版本地址"[\s\S]*value=\{row\.buildAddress \|\| ''\}/, 'the market editor must bind build URL to the current row')

const projectSpaceSource = fs.readFileSync(projectSpacePath, 'utf8')
assert.match(projectSpaceSource, /const legacyMarketBuildConfig =/, 'the project space must define the historical project-level fallback')
assert.match(projectSpaceSource, /buildMarketRowsFromMarkets\([\s\S]*legacyMarketBuildConfig[\s\S]*\)/, 'market rows must be hydrated with the historical project values')
assert.match(projectSpaceSource, /label="分支信息">\{row\.branchInfo \|\| '-'\}/, 'whole-machine configuration must display the selected market branch')
assert.match(projectSpaceSource, /row\.jenkinsUrl \? <a href=\{row\.jenkinsUrl\}/, 'whole-machine configuration must display the selected market Jenkins URL')
assert.match(projectSpaceSource, /row\.buildAddress \? <a href=\{row\.buildAddress\}/, 'whole-machine configuration must display the selected market build URL')

console.log('market-specific build configuration verification passed (16 assertions)')
