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
const planSchema = read('src/constants/projectPlanInfoSchema.ts')
const styles = read('src/styles/globals.css')

const evaluateTypeScriptModule = (filename, requireModule = id => {
  throw new Error(`Unexpected module: ${id}`)
}) => {
  const output = ts.transpileModule(read(filename), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(output, { module, exports: module.exports, require: requireModule }, { filename })
  return module.exports
}

const { getBalancedRows } = evaluateTypeScriptModule('src/lib/balancedRows.ts')
assert.equal(
  JSON.stringify(getBalancedRows([1, 2, 3, 4, 5, 6, 7], 6)),
  JSON.stringify([[1, 2, 3, 4], [5, 6, 7]]),
  'seven fields must balance as 4 + 3',
)

const schemaModule = evaluateTypeScriptModule(
  'src/constants/projectInfoSchema.ts',
  id => {
    if (id === '@/constants/projectTypes') {
      return {
        MACHINE_PROJECT_TYPES: ['整机产品-手机', '整机产品-PAD', '整机产品-笔电'],
        PROJECT_TYPE_TOS_VERSION: 'tOS版本项目',
        isMachineProjectType: type => [
          '整机产品-手机',
          '整机产品-PAD',
          '整机产品-笔电',
          '整机产品项目',
        ].includes(type),
      }
    }
    throw new Error(`Unexpected schema module: ${id}`)
  },
)
const machineFields = Array.from(schemaModule.MACHINE_PROJECT_INFO_FIELDS)
const tosFields = Array.from(schemaModule.TOS_PROJECT_INFO_FIELDS)
const keysFor = (fields, group) => fields.filter(field => field.group === group).map(field => field.key)
const keysWhere = (fields, predicate) => fields.filter(predicate).map(field => field.key)

assert.deepEqual(Array.from(schemaModule.TARGET_PROJECT_TYPES), [
  '整机产品-手机',
  '整机产品-PAD',
  '整机产品-笔电',
  'tOS版本项目',
], 'new project choices must expose the three machine categories without the legacy value')
for (const type of ['整机产品-手机', '整机产品-PAD', '整机产品-笔电', '整机产品项目']) {
  assert.equal(schemaModule.isTargetProjectInfoType(type), true, `${type} must use target project information`)
  assert.equal(schemaModule.getProjectInfoFields(type), schemaModule.MACHINE_PROJECT_INFO_FIELDS, `${type} must reuse the machine field schema`)
  assert.equal(schemaModule.getProjectInfoGroups(type), schemaModule.MACHINE_PROJECT_INFO_GROUPS, `${type} must reuse the machine group schema`)
}

assert.equal(JSON.stringify(keysFor(machineFields, 'basic')), JSON.stringify([
  'researchMode', 'developmentMode', 'firstSaleTosVersion', 'isFirstLaunchProject',
  'softwareProjectLevel', 'versionType', 'dimensionUpgradeStrategy', 'projectModel',
  'mainboardName', 'androidMajorUpgrade', 'productType', 'targetMarkets', 'systemType',
  'kernelVersion', 'confidentialityLevel', 'androidVersion', 'productSeries',
  'modelCategory', 'currentTosVersion', 'launchDate', 'productionForbiddenDate',
]), 'machine basic field order must match the reference document')
assert.equal(JSON.stringify(keysFor(machineFields, 'extended')), JSON.stringify([
  'chipCode', 'chipModel', 'chipPlatform', 'memorySize', 'startingRam', 'wholeMachinePd',
  'pcbaSheet', 'shippingCountrySheet', 'keyComponentsSheet', 'isTwoStage',
  'isOutsourcedMini', 'baselineName', 'jiraProjects',
]), 'machine extended field order must match the reference document')
assert.equal(JSON.stringify(keysFor(machineFields, 'team')), JSON.stringify([
  'machineSpm', 'machineSpp', 'machineCmo', 'machineSoftwareSe', 'machineUx',
  'machineDevelopmentRepresentative', 'machineTestRepresentative',
]), 'machine team field order must match the reference document')
assert.equal(JSON.stringify(keysWhere(machineFields, field => field.required)), JSON.stringify([
  'developmentMode', 'firstSaleTosVersion', 'isFirstLaunchProject', 'softwareProjectLevel',
  'versionType', 'dimensionUpgradeStrategy', 'systemType', 'kernelVersion', 'productSeries',
  'chipModel', 'chipPlatform', 'wholeMachinePd', 'pcbaSheet', 'shippingCountrySheet',
  'keyComponentsSheet', 'isTwoStage', 'isOutsourcedMini', 'machineSpm',
]), 'machine overall required fields must match the reference document')
assert.equal(JSON.stringify(keysWhere(machineFields, field => field.requiredOnCreate)), JSON.stringify([
  'developmentMode', 'firstSaleTosVersion', 'isFirstLaunchProject', 'softwareProjectLevel',
  'versionType', 'dimensionUpgradeStrategy', 'systemType', 'kernelVersion', 'productSeries',
  'chipModel', 'chipPlatform', 'wholeMachinePd', 'pcbaSheet', 'shippingCountrySheet',
  'keyComponentsSheet', 'isTwoStage', 'isOutsourcedMini',
]), 'machine create-required fields must match the reference document')
assert.equal(JSON.stringify(keysWhere(machineFields, field => field.defaultVisible)), JSON.stringify([
  'researchMode', 'developmentMode', 'firstSaleTosVersion', 'isFirstLaunchProject',
  'softwareProjectLevel', 'versionType', 'dimensionUpgradeStrategy', 'androidMajorUpgrade',
  'modelCategory', 'chipCode', 'chipModel', 'chipPlatform', 'memorySize', 'startingRam',
  'wholeMachinePd', 'pcbaSheet', 'shippingCountrySheet', 'keyComponentsSheet',
  'machineSpm', 'machineSpp', 'machineCmo', 'machineSoftwareSe', 'machineUx',
  'machineDevelopmentRepresentative', 'machineTestRepresentative',
]), 'machine default-visible fields must match the reference document')
assert.equal(JSON.stringify(keysWhere(tosFields, field => field.requiredOnCreate)), JSON.stringify([
  'firstLaunchProjects', 'firstLaunchProjectChips', 'applicableBrands',
  'applicableProductLines', 'applicableChipPlatforms', 'tosVersionProjectManager',
  'tosPlanningRepresentative', 'tosSe', 'tosTestRepresentative', 'tosSqa', 'tosCmo', 'tosUx',
]), 'tOS create-required fields must match the reference document')
assert.equal(tosFields.every(field => field.required), true, 'every tOS category field must be overall required')
assert.equal(tosFields.filter(field => field.group === 'team').every(field => field.inputType === 'people'), true, 'all tOS roles must allow multiple members')
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
assert.match(view, /afterCore/, 'the target project view must support content immediately after the core card')
assert.match(view, /visibleGroupKeys/, 'the target project view must pass display-group filtering')
assert.match(sections, /visibleGroupKeys/, 'project-space sections must support caller-selected groups')
assert.match(sections, /getBalancedRows/, 'information sections must balance visible fields without blank cells')
assert.match(sections, /pms-project-info-team-role/, 'team sections must separate role names from member lists')
assert.match(modal, /mode === 'create' \? field\.requiredOnCreate : field\.required/, 'create and edit must use their own required rules')
assert.match(styles, /\.pms-project-info-form-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/, 'project forms must use four desktop columns')

assert.match(market, /pms-market-matrix/, 'market editing must use the matrix surface')
assert.match(market, /dataIndex:\s*row\.id/, 'each market row must become a table column')

assert.match(plan, /visibleFieldKeys/, 'plan information must accept field visibility preferences')
assert.match(plan, /getBalancedRows\(metrics, 5, 2\)/, 'plan information must fit visible fields into at most two rows')
assert.match(planSchema, /planStartDate[\s\S]*isMadaControlled[\s\S]*isCarrierCustomized[\s\S]*cancelPauseDate/, 'plan fields must keep the reference document order')
assert.match(planSchema, /key: 'isCarrierCustomized'[^\n]*hideable: false/, 'carrier customization must remain fixed visible')

console.log('Project info matrix refresh verification passed.')
