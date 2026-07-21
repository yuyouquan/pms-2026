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
const dimensionMatrix = read('src/components/project-info/DimensionMatrixEditor.tsx')
const plan = read('src/components/project-info/ProjectPlanInfoGrid.tsx')
const planSchema = read('src/constants/projectPlanInfoSchema.ts')
const styles = read('src/styles/globals.css')
const projectSpace = read('src/containers/ProjectSpaceContainer.tsx')
const projectMocks = read('src/data/projects.ts')

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
assert.equal(schemaModule.isTargetProjectInfoType('tOS版本项目'), true, 'tOS must use target project information')
assert.equal(schemaModule.isTargetProjectInfoType('技术项目'), false, 'technical projects must not satisfy the target project information predicate')
assert.match(schema, /export type TargetProjectInfoType\s*=/, 'target project information must expose an exact project-type union')
assert.match(schema, /type is TargetProjectInfoType/, 'target project information predicate must narrow to its exact union')

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
assert.deepEqual(
  Array.from(machineFields.find(field => field.key === 'versionType').options),
  ['Full', 'Slim', 'PAD', 'GO'],
  'version type options must match revision 259 exactly',
)
assert.deepEqual(
  Array.from(machineFields.find(field => field.key === 'systemType').options),
  ['32bit', '64bit', '64only'],
  'system type options must match revision 259 exactly',
)
assert.equal(machineFields.find(field => field.key === 'startingRam').readOnly, true, 'starting RAM must be derived and read-only')
assert.equal(tosFields.find(field => field.key === 'firstLaunchProjectChips').label, '首发项目芯片', 'tOS launch chip label must match revision 259')

const projectInfoValuesModule = evaluateTypeScriptModule(
  'src/lib/projectInfoValues.ts',
  id => {
    if (id === '@/constants/projectInfoSchema') return { isExternalMachineDevelopment: () => false }
    if (id === '@/constants/projectTypes') return { isMachineProjectType: type => type === '整机产品-手机' }
    throw new Error(`Unexpected project-info values module: ${id}`)
  },
)
const projectInfoRulesModule = evaluateTypeScriptModule(
  'src/lib/projectInfoRules.ts',
  id => {
    if (id === '@/constants/projectInfoSchema') {
      return { getEffectiveProjectInfoFields: () => [], getProjectInfoFields: () => [] }
    }
    if (id === '@/constants/projectTypes') {
      return {
        isMachineProjectType: type => type === '整机产品-手机',
        PROJECT_TYPE_TOS_VERSION: 'tOS版本项目',
      }
    }
    if (id === '@/lib/projectInfoValues') {
      return projectInfoValuesModule
    }
    throw new Error(`Unexpected project-info rules module: ${id}`)
  },
)
assert.equal(projectInfoRulesModule.deriveStartingRam('8GB+256GB'), '8GB', 'starting RAM must parse compact memory values')
assert.equal(projectInfoRulesModule.deriveStartingRam('8+256 GB, 12+512 GB'), '8GB', 'starting RAM must parse capacity-list values')
assert.equal(projectInfoRulesModule.deriveStartingRam('12+512 GB, 8+256 GB'), '8GB', 'starting RAM must use the smallest configured RAM regardless of option order')
assert.equal(projectInfoValuesModule.getProjectInfoValue({
  id: 'machine-legacy',
  name: 'Legacy machine',
  type: '整机产品-手机',
  memory: '8GB+256GB',
}, 'startingRam'), '8GB', 'existing machine projects must display automatically derived starting RAM')
assert.equal(projectInfoValuesModule.getProjectInfoValue({
  id: 'machine-stale-starting-ram',
  name: 'Machine with stale stored RAM',
  type: '整机产品-手机',
  memory: '8GB+256GB',
  startingRam: '12GB',
  fieldValues: { startingRam: '16GB' },
}, 'startingRam'), '8GB', 'derived starting RAM must override stale root and stored values')
const aggregates = projectInfoRulesModule.deriveTosProjectAggregates([
  'machine-1', 'machine-2',
], [
  { id: 'machine-1', type: '整机产品-手机', name: 'A', brand: 'TECNO', productLine: 'CAMON', chipPlatform: 'MTK', fieldValues: { chipCode: 'D1', chipModel: 'M1' } },
  { id: 'machine-2', type: '整机产品-手机', name: 'B', brand: 'Infinix', productLine: 'NOTE', chipPlatform: 'UNISOC', fieldValues: { chipCode: 'D2', chipModel: 'M2' } },
], 'tOS17.0')
assert.equal(aggregates.values.applicableBrands, 'TECNO,Infinix', 'tOS aggregates must use the reference English comma separator')
assert.equal(aggregates.values.firstLaunchProjectChips, 'D1（M1）,D2（M2）', 'tOS launch-chip aggregates must use the reference English comma separator')

assert.match(schema, /required:\s*boolean/, 'field schema must expose overall required metadata')
assert.doesNotMatch(projectMocks, /versionType:\s*'Go'/, 'machine project mocks must use the canonical GO version type')
assert.match(schema, /'tOS15\.0\.1'[\s\S]*'tOS17\.2'/, 'first-sale tOS options must match the reference document')
assert.match(schema, /\['S', 'A', 'B', 'C', 'D'\]/, 'software project levels must include S through D')
assert.match(schema, /'不维护'[\s\S]*'升3维5'/, 'dimension upgrade strategies must match the reference document')
assert.match(schema, /label:\s*'首发项目芯片'/, 'the tOS launch chip label must match the reference document')
assert.doesNotMatch(schema, /group:\s*'team',[^\n]*inputType:\s*'person'/, 'every team role must support multiple people')
assert.match(values, /normalizeTeamMembers/, 'legacy and multi-person team values must share a normalizer')

assert.doesNotMatch(view, /statusConfig\.tagColor/, 'project status must not be repeated beside the title')
assert.doesNotMatch(view, /healthConfig\.tagColor/, 'health status must not be repeated beside the title')
assert.match(view, /afterCore/, 'the target project view must support content immediately after the core card')
assert.match(view, /visibleGroupKeys/, 'the target project view must pass display-group filtering')
assert.match(sections, /visibleGroupKeys/, 'project-space sections must support caller-selected groups')
assert.doesNotMatch(sections, /Grid\.useBreakpoint|getBalancedRows|displayRows/, 'information sections must not use responsive or balanced dynamic columns')
assert.match(sections, /pms-project-info-display-grid[\s\S]*visibleFields\.map/, 'information sections must render visible fields in schema order through one grid')
assert.match(sections, /pms-project-info-team-role/, 'team sections must separate role names from member lists')
assert.match(modal, /mode === 'create' \? field\.requiredOnCreate : field\.required/, 'create and edit must use their own required rules')
assert.match(styles, /\.pms-project-info-form-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/, 'project forms must use four desktop columns')
assert.match(styles, /\.pms-project-info-display-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)[\s\S]*background:\s*#fff/, 'basic and extended information must use five equal white columns')
assert.match(styles, /\.pms-project-info-display-item\s*\{[\s\S]*background:\s*#fff/, 'each information field cell must retain a white background')

assert.match(dimensionMatrix, /pms-dimension-matrix/, 'shared dimension editing must use the common matrix surface')
assert.match(dimensionMatrix, /dataIndex:\s*dimension\.id/, 'each dimension must become a table column in the shared editor')
assert.match(market, /<DimensionMatrixEditor/, 'market editing must wrap the shared dimension matrix')
for (const hiddenField of ['isCarrierCustomized', 'branchInfo', 'jenkinsUrl', 'buildAddress']) {
  assert.doesNotMatch(
    market,
    new RegExp(`(?:key|case)\\s*:\\s*['\"]${hiddenField}['\"]|case\\s+['\"]${hiddenField}['\"]`),
    `market editing must not expose the hidden ${hiddenField} field`,
  )
}

assert.match(plan, /visibleFieldKeys/, 'plan information must accept field visibility preferences')
assert.match(plan, /getBalancedRows\(metrics, 5, 2\)/, 'plan information must fit visible fields into at most two rows')
const planSchemaModule = evaluateTypeScriptModule('src/constants/projectPlanInfoSchema.ts')
assert.deepEqual(Array.from(planSchemaModule.PROJECT_PLAN_INFO_FIELDS, field => field.key), [
  'buildOption', 'buildMarket', 'googleLaunchDate', 'isMadaControlled',
  'isSimLocked', 'isCancelPaused', 'cancelPauseDate',
], 'plan fields must keep the refreshed field order')
assert.deepEqual(
  Array.from(planSchemaModule.PROJECT_PLAN_INFO_FIELDS, field => field.defaultVisible ? field.key : undefined).filter(Boolean),
  ['googleLaunchDate', 'isMadaControlled', 'isSimLocked', 'isCancelPaused', 'cancelPauseDate'],
  'only the five fixed plan fields must be visible by default',
)
assert.deepEqual(
  Array.from(planSchemaModule.PROJECT_PLAN_INFO_FIELDS, field => field.hideable ? field.key : undefined).filter(Boolean),
  ['buildOption', 'buildMarket'],
  'only build fields must be hideable',
)
assert.doesNotMatch(plan, /planStartDate|planEndDate|developCycle|isCarrierCustomized/, 'plan grid must not retain removed metrics')
assert.match(plan, /key:\s*'buildOption'[\s\S]*key:\s*'buildMarket'[\s\S]*key:\s*'googleLaunchDate'[\s\S]*key:\s*'isMadaControlled'[\s\S]*key:\s*'isSimLocked'[\s\S]*key:\s*'isCancelPaused'[\s\S]*key:\s*'cancelPauseDate'/, 'plan display metrics must match schema order')
assert.match(plan, /import type \{ MarketYesNoValue \} from '@\/lib\/marketRules'/, 'plan grid must use the market yes-no value type')
assert.match(plan, /isMadaControlled\?: MarketYesNoValue \| undefined[\s\S]*isSimLocked\?: MarketYesNoValue \| undefined[\s\S]*isCancelPaused\?: MarketYesNoValue \| undefined/, 'plan grid boolean props must use the market yes-no value type')
assert.match(plan, /const displayBoolean = \(value: MarketYesNoValue \| undefined\)/, 'plan grid boolean display helper must use the market yes-no value type')

const wholeMachinePlanInfoStart = projectSpace.indexOf('const renderWholeMachinePlanInfo = () => {')
const wholeMachinePlanInfoEnd = projectSpace.indexOf('\n    const anchorSections', wholeMachinePlanInfoStart)
assert.notEqual(wholeMachinePlanInfoStart, -1, 'whole-machine plan information renderer must exist')
assert.notEqual(wholeMachinePlanInfoEnd, -1, 'whole-machine plan information renderer must have a bounded source section')
const wholeMachinePlanInfo = projectSpace.slice(wholeMachinePlanInfoStart, wholeMachinePlanInfoEnd)
assert.match(
  wholeMachinePlanInfo,
  /<ProjectPlanInfoGrid\s+visibleFieldKeys=\{visiblePlanInfoFieldKeys\}\s+buildOption=\{row\.buildOption\}\s+buildMarket=\{row\.buildMarket\}\s+googleLaunchDate=\{row\.googleLaunchDate\}\s+isMadaControlled=\{row\.isMadaControlled\}\s+isSimLocked=\{row\.isSimLocked\}\s+isCancelPaused=\{row\.isCancelPaused\}\s+cancelPauseDate=\{row\.isCancelPaused === '是' \? row\.cancelPauseDate : undefined\}\s+\/>/,
  'whole-machine plan information must pass every grid field from the selected market row',
)

assert.match(projectSpace, /afterCore=\{isWholeMachine \? renderWholeMachinePlanInfo\(\) : renderProjectPlanInfo\(\)\}/, 'target project plan information must remain directly below the core card')
assert.match(projectSpace, /const anchorSections = \[[\s\S]*id: 'section-plan', label: '计划信息'/, 'the target project anchor must use the unified plan-information label')
assert.match(projectSpace, /\{!isTargetProject && renderProjectPlanInfo\(\)\}/, 'only non-target projects may use the lower plan-information section')
assert.match(projectSpace, /\{!isTargetProject && \(isSoftware \|\| isTech\) && \(/, 'target machine and tOS projects must not render the standalone configuration section')

console.log('Project info matrix refresh verification passed.')
