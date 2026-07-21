import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const read = path => readFileSync(path, 'utf8')

const schema = read('src/constants/projectInfoSchema.ts')
const values = read('src/lib/projectInfoValues.ts')
const view = read('src/components/project-info/TargetProjectInformationView.tsx')
const sections = read('src/components/project-info/ProjectInfoSections.tsx')
const modal = read('src/components/project-info/ProjectInfoModal.tsx')
const market = read('src/components/project-info/MarketEditorModal.tsx')
const plan = read('src/components/project-info/ProjectPlanInfoGrid.tsx')
const styles = read('src/styles/globals.css')

const evaluateTypeScriptModule = filename => {
  const output = ts.transpileModule(read(filename), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(output, { module, exports: module.exports }, { filename })
  return module.exports
}

const { getBalancedRows } = evaluateTypeScriptModule('src/lib/balancedRows.ts')
assert.equal(
  JSON.stringify(getBalancedRows([1, 2, 3, 4, 5, 6, 7], 6)),
  JSON.stringify([[1, 2, 3, 4], [5, 6, 7]]),
  'seven fields must balance as 4 + 3',
)
assert.equal(
  JSON.stringify(getBalancedRows([1, 2, 3, 4, 5, 6, 7, 8], 6)),
  JSON.stringify([[1, 2, 3, 4], [5, 6, 7, 8]]),
  'eight fields must balance as 4 + 4',
)

assert.match(schema, /required:\s*boolean/, 'field schema must expose overall required metadata')
assert.match(schema, /'tOS15\.0\.1'[\s\S]*'tOS17\.2'/, 'first-sale tOS options must match the reference document')
assert.match(schema, /\['S', 'A', 'B', 'C', 'D'\]/, 'software project levels must include S through D')
assert.match(schema, /'不维护'[\s\S]*'升3维5'/, 'dimension upgrade strategies must match the reference document')
assert.match(schema, /label:\s*'首发项目芯片编码'/, 'the tOS launch chip label must match the reference document')
assert.doesNotMatch(schema, /group:\s*'team',[^\n]*inputType:\s*'person'/, 'every team role must support multiple people')
assert.match(values, /normalizeTeamMembers/, 'legacy and multi-person team values must share a normalizer')

assert.doesNotMatch(view, /statusConfig\.tagColor/, 'project status must not be repeated beside the title')
assert.doesNotMatch(view, /healthConfig\.tagColor/, 'health status must not be repeated beside the title')
assert.match(sections, /getBalancedRows/, 'information sections must balance visible fields without blank cells')
assert.match(sections, /pms-project-info-team-role/, 'team sections must separate role names from member lists')
assert.match(modal, /mode === 'create' \? field\.requiredOnCreate : field\.required/, 'create and edit must use their own required rules')
assert.match(styles, /\.pms-project-info-form-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/, 'project forms must use four desktop columns')

assert.match(market, /pms-market-matrix/, 'market editing must use the matrix surface')
assert.match(market, /dataIndex:\s*row\.id/, 'each market row must become a table column')

assert.match(plan, /visibleFieldKeys/, 'plan information must accept field visibility preferences')
assert.match(plan, /getBalancedRows\(metrics, 5, 2\)/, 'plan information must fit visible fields into at most two rows')

console.log('Project info matrix refresh verification passed.')
