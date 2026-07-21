import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const read = path => readFileSync(path, 'utf8')

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

const projectTypes = {
  MACHINE_PROJECT_TYPES: ['整机产品-手机', '整机产品-PAD', '整机产品-笔电'],
  PROJECT_TYPE_TOS_VERSION: 'tOS版本项目',
  isMachineProjectType: type => [
    '整机产品-手机',
    '整机产品-PAD',
    '整机产品-笔电',
    '整机产品项目',
  ].includes(type),
}

const schemaModule = evaluateTypeScriptModule(
  'src/constants/projectInfoSchema.ts',
  id => {
    if (id === '@/constants/projectTypes') return projectTypes
    throw new Error(`Unexpected schema module: ${id}`)
  },
)

const rulesModule = evaluateTypeScriptModule(
  'src/lib/projectInfoRules.ts',
  id => {
    if (id === '@/constants/projectInfoSchema') return schemaModule
    if (id === '@/constants/projectTypes') return projectTypes
    if (id === '@/lib/projectInfoValues') {
      return {
        deriveStartingRam: value => String(value || ''),
        getProjectInfoValue: () => undefined,
      }
    }
    throw new Error(`Unexpected project-info rules module: ${id}`)
  },
)

const modalFields = Array.from(rulesModule.getProjectInfoModalFields('tOS版本项目'))
const modalGroups = Array.from(rulesModule.getProjectInfoModalGroups('tOS版本项目'))
assert.deepEqual(
  modalGroups.map(group => group.key),
  ['team'],
  'the tOS create/edit modal must only show the team group',
)
assert.equal(
  modalFields.some(field => field.group === 'basic' || field.key === 'firstLaunchProjects'),
  false,
  'the tOS create/edit modal must not expose basic fields or first-launch projects',
)
assert.equal(
  schemaModule.TOS_PROJECT_INFO_FIELDS.some(field => field.key === 'firstLaunchProjects'),
  true,
  'the display/storage schema must retain first-launch project metadata',
)

const editableFieldKeys = new Set(modalFields.filter(field => !field.readOnly).map(field => field.key))
const expectedRequiredTeamKeys = Array.from(schemaModule.TOS_PROJECT_INFO_FIELDS)
  .filter(field => field.group === 'team' && field.requiredOnCreate)
  .map(field => field.key)
const emptyCreateErrors = Array.from(rulesModule.validateProjectInfoValues(
  'tOS版本项目',
  {},
  {
    fieldKeys: editableFieldKeys,
    tosAggregateMissingSources: ['隐藏的首发项目来源缺字段'],
    validateRequiredOnCreate: true,
  },
))
assert.deepEqual(
  emptyCreateErrors.map(error => error.fieldKey),
  expectedRequiredTeamKeys,
  'tOS creation must require the original team fields without requiring hidden basic fields',
)
assert.equal(
  emptyCreateErrors.some(error => error.fieldKey === 'firstLaunchProjects'),
  false,
  'hidden first-launch aggregate warnings must not block tOS creation',
)
const completedTeamValues = Object.fromEntries(expectedRequiredTeamKeys.map(key => [key, ['测试用户']]))
assert.equal(
  rulesModule.validateProjectInfoValues('tOS版本项目', completedTeamValues, {
    fieldKeys: editableFieldKeys,
    validateRequiredOnCreate: true,
  }).length,
  0,
  'tOS creation must pass once its visible required team fields are complete',
)
const historicalBasicValues = {
  firstLaunchProjects: ['machine-1'],
  firstLaunchProjectChips: 'D1（M1）',
  applicableBrands: 'TECNO',
  applicableProductLines: 'CAMON',
  applicableChipPlatforms: 'MTK',
}
const editedTosValues = {
  ...historicalBasicValues,
  firstLaunchProjectChips: '',
  applicableBrands: '',
  applicableProductLines: '',
  applicableChipPlatforms: '',
  tosVersionProjectManager: ['新版本经理'],
}
const tosSubmitValues = rulesModule.getProjectInfoModalSubmitValues('tOS版本项目', editedTosValues)
assert.deepEqual(
  Object.keys(tosSubmitValues),
  ['tosVersionProjectManager'],
  'the tOS modal payload must contain maintained team fields only',
)
assert.deepEqual(
  Array.from(tosSubmitValues.tosVersionProjectManager),
  ['新版本经理'],
  'the tOS modal payload must retain edited visible team values',
)
for (const hiddenKey of Object.keys(historicalBasicValues)) {
  assert.equal(hiddenKey in tosSubmitValues, false, `hidden tOS field ${hiddenKey} must not enter the modal payload`)
}

const projectInfoValuesModule = evaluateTypeScriptModule(
  'src/lib/projectInfoValues.ts',
  id => {
    if (id === '@/constants/projectInfoSchema') return schemaModule
    if (id === '@/constants/projectTypes') return projectTypes
    throw new Error(`Unexpected project-info values module: ${id}`)
  },
)
const mergedTosProject = projectInfoValuesModule.mergeProjectInfoValues({
  id: 'tos-history',
  name: 'tOS17.0',
  type: 'tOS版本项目',
  fieldValues: historicalBasicValues,
}, tosSubmitValues)
for (const [hiddenKey, historicalValue] of Object.entries(historicalBasicValues)) {
  assert.equal(
    JSON.stringify(mergedTosProject.fieldValues[hiddenKey]),
    JSON.stringify(historicalValue),
    `merging the modal payload must preserve historical ${hiddenKey}`,
  )
}
assert.deepEqual(
  Array.from(mergedTosProject.fieldValues.tosVersionProjectManager),
  ['新版本经理'],
  'merging the modal payload must update visible team values',
)
const machineSubmitValues = rulesModule.getProjectInfoModalSubmitValues('整机产品-手机', {
  developmentMode: 'ODC',
  chipModel: 'M1',
})
assert.equal(machineSubmitValues.developmentMode, 'ODC', 'machine modal submission must retain basic fields')
assert.equal(machineSubmitValues.chipModel, 'M1', 'machine modal submission must retain extended fields')

const modal = read('src/components/project-info/ProjectInfoModal.tsx')
assert.match(modal, /getProjectInfoModalFields\(projectType\)/, 'the modal must use its scoped field projection')
assert.match(modal, /getProjectInfoModalGroups\(projectType\)/, 'the modal must omit empty tOS groups')
assert.match(modal, /fieldKeys:\s*editableFieldKeys/, 'submission validation must be scoped to modal-editable fields')
assert.match(modal, /getProjectInfoModalSubmitValues\(normalizedProjectType, values\)/, 'submission must use the modal field projection')

const projectSpace = read('src/containers/ProjectSpaceContainer.tsx')
const wholePlanStart = projectSpace.indexOf('const renderWholeMachinePlanInfo = () => {')
const wholePlanEnd = projectSpace.indexOf('\n    const anchorSections', wholePlanStart)
assert.notEqual(wholePlanStart, -1, 'whole-machine plan information renderer must exist')
assert.notEqual(wholePlanEnd, -1, 'whole-machine plan information renderer must have a bounded section')
assert.doesNotMatch(
  projectSpace.slice(wholePlanStart, wholePlanEnd),
  /里程碑计划（横排视图）/,
  'whole-machine plan information must not show the horizontal-view subtitle',
)
const sharedPlanStart = projectSpace.indexOf('const renderProjectPlanInfo = () => {')
const sharedPlanEnd = projectSpace.indexOf('\n  // ═══════ renderProjectPlanOverview', sharedPlanStart)
const sharedPlan = projectSpace.slice(sharedPlanStart, sharedPlanEnd)
assert.match(
  sharedPlan,
  /!isTosVersionProject[\s\S]*里程碑计划（横排视图）/,
  'the shared renderer must hide the horizontal-view subtitle only for tOS',
)
assert.match(
  projectSpace,
  /const \[transferInfoCollapsed, setTransferInfoCollapsed\] = useState\(false\)/,
  'transfer information must be expanded by default',
)
assert.match(
  projectSpace,
  /aria-expanded=\{!transferInfoCollapsed\}[\s\S]*setTransferInfoCollapsed\(collapsed => !collapsed\)/,
  'the transfer control must expose and toggle its expanded state',
)
assert.match(
  projectSpace,
  /!transferInfoCollapsed && <div id="section-transfer-content">/,
  'the transfer table must follow the collapse state while preserving its section anchor',
)
assert.match(
  projectSpace,
  /styles=\{\{ body: transferInfoCollapsed \? \{ display: 'none', padding: 0 \} : undefined \}\}/,
  'the collapsed transfer card must remove its body padding and layout space',
)

const smoke = read('screenshots/smoke-tos-type-plan.mjs')
assert.match(smoke, /assertNoVisibleText\(page, '里程碑计划（横排视图）', '#section-plan'\)/, 'the smoke path must reject the removed subtitle')
assert.match(smoke, /assertNoVisibleText\(page, '首发项目', '\.pms-project-info-modal'\)/, 'the smoke path must reject the removed tOS modal field')
assert.match(smoke, /async function assertTransferInformationCollapse[\s\S]*'折叠'[\s\S]*!document\.querySelector\('#section-transfer-content'\)[\s\S]*'展开'/, 'the browser smoke must collapse and restore real transfer table content')
assert.match(smoke, /collapsedLayout\.bodyDisplay !== 'none'[\s\S]*collapsedLayout\.cardHeight > collapsedLayout\.headHeight \+ 6/, 'the browser smoke must reject blank transfer-card body space')
assert.match(smoke, /'tOS版本项目'[\s\S]*selectVisibleModalOption\(page, '项目名', 'tOS19\.0'\)[\s\S]*assertNoVisibleText\(page, '基础信息', '\.pms-project-info-modal'\)[\s\S]*assertVisibleText\(page, '团队信息', '\.pms-project-info-modal'\)/, 'the browser smoke must select tOS in create mode and verify its modal groups')

console.log('Project information follow-up adjustment verification passed.')
