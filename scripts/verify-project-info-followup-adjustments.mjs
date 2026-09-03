import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
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

const technicalProjectFields = {
  TECHNICAL_TEAM_FIELDS: [
    'technicalLead', 'technicalProjectManager', 'testRepresentative',
    'qualityRepresentative', 'productRepresentative',
    'standardizationRepresentative', 'technicalOther',
  ].map(key => ({ key })),
  TECHNICAL_DELIVERABLE_FIELDS: [
    'projectKpi', 'conceptDesign', 'charterReport', 'pdcpReport',
    'tdcpReport', 'edcpReport',
  ].map(key => ({ key })),
}

const schemaModule = evaluateTypeScriptModule(
  'src/constants/projectInfoSchema.ts',
  id => {
    if (id === '@/constants/projectTypes') return projectTypes
    if (id === '@/constants/technicalProject') return technicalProjectFields
    throw new Error(`Unexpected schema module: ${id}`)
  },
)

const jiraProjectModule = evaluateTypeScriptModule('src/lib/jiraProject.ts')

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
    if (id === '@/lib/jiraProject') return jiraProjectModule
    if (id === '@/lib/projectStatus') {
      return { mapIpmProjectStatus: value => String(value || '') }
    }
    throw new Error(`Unexpected project-info rules module: ${id}`)
  },
)

const modalFields = Array.from(rulesModule.getProjectInfoModalFields('tOS版本项目'))
const modalGroups = Array.from(rulesModule.getProjectInfoModalGroups('tOS版本项目'))
assert.deepEqual(
  modalGroups.map(group => group.key),
  ['basic', 'team'],
  'the tOS create/edit modal must show the basic and team groups',
)
assert.equal(
  modalFields.some(field => field.group === 'basic' && field.key === 'firstLaunchProjects'),
  true,
  'the tOS create/edit modal must expose first-launch projects in basic information',
)

const editableFieldKeys = new Set(modalFields.filter(field => !field.readOnly).map(field => field.key))
const expectedRequiredModalKeys = Array.from(schemaModule.TOS_PROJECT_INFO_FIELDS)
  .filter(field => !field.readOnly && field.requiredOnCreate)
  .map(field => field.key)
const emptyCreateErrors = Array.from(rulesModule.validateProjectInfoValues(
  'tOS版本项目',
  {},
  {
    fieldKeys: editableFieldKeys,
    tosAggregateMissingSources: [],
    validateRequiredOnCreate: true,
  },
))
assert.deepEqual(
  emptyCreateErrors.map(error => error.fieldKey),
  expectedRequiredModalKeys,
  'tOS creation must require first-launch projects and the configured team fields',
)
assert.equal(
  emptyCreateErrors.some(error => error.fieldKey === 'firstLaunchProjects'),
  true,
  'visible first-launch projects remain required for tOS creation',
)
const completedTeamValues = Object.fromEntries(expectedRequiredModalKeys.map(key => [key, ['测试用户']]))
assert.equal(
  rulesModule.validateProjectInfoValues('tOS版本项目', completedTeamValues, {
    fieldKeys: editableFieldKeys,
    validateRequiredOnCreate: true,
  }).length,
  0,
  'tOS creation must pass once its visible required basic and team fields are complete',
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
  tosVersionProjectManager: ['新版本经理'],
}
const tosSubmitValues = rulesModule.getProjectInfoModalSubmitValues('tOS版本项目', editedTosValues)
assert.deepEqual(
  Object.keys(tosSubmitValues),
  [...Object.keys(historicalBasicValues), 'tosVersionProjectManager'],
  'the tOS modal payload must contain visible basic aggregate and team fields',
)
assert.deepEqual(
  Array.from(tosSubmitValues.tosVersionProjectManager),
  ['新版本经理'],
  'the tOS modal payload must retain edited visible team values',
)
for (const basicKey of Object.keys(historicalBasicValues)) {
  assert.equal(basicKey in tosSubmitValues, true, `visible tOS basic field ${basicKey} must enter the modal payload`)
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
for (const [basicKey, historicalValue] of Object.entries(historicalBasicValues)) {
  assert.equal(
    JSON.stringify(mergedTosProject.fieldValues[basicKey]),
    JSON.stringify(historicalValue),
    `merging the modal payload must preserve submitted ${basicKey}`,
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

const completeJiraRow = {
  id: 'jira-complete', server: 'jira.transsion.com', projectKey: 'KN4-tOS16', type: 'sw', shared: true, affectProjects: 'KN4',
}
assert.equal(
  rulesModule.validateProjectInfoValues('整机产品项目', { jiraProjects: [] }, { fieldKeys: new Set(['jiraProjects']) }).length,
  0,
  'an empty JIRA row array is valid for whole-machine project info',
)
const incompleteJiraErrors = rulesModule.validateProjectInfoValues('整机产品项目', {
  jiraProjects: [{ id: 'jira-incomplete', server: 'jira.transsion.com', projectKey: '', type: 'sw', shared: false, affectProjects: '' }],
}, { fieldKeys: new Set(['jiraProjects']) })
assert.ok(incompleteJiraErrors.some(error => error.fieldKey === 'jiraProjects' && error.groupKey === 'extended' && error.message.startsWith('第 1 行：')),
  'incomplete JIRA rows map to the jiraProjects extended field with a row number')
const sharedJiraErrors = rulesModule.validateProjectInfoValues('整机产品项目', { jiraProjects: [{ ...completeJiraRow, affectProjects: '' }] }, { fieldKeys: new Set(['jiraProjects']) })
assert.ok(sharedJiraErrors.some(error => error.fieldKey === 'jiraProjects' && error.message.includes('影响项目')),
  'shared JIRA rows require Affect Projects through project-info validation')
const invalidTypeErrors = rulesModule.validateProjectInfoValues('整机产品项目', { jiraProjects: [{ ...completeJiraRow, type: '' }] }, { fieldKeys: new Set(['jiraProjects']) })
assert.ok(invalidTypeErrors.some(error => error.fieldKey === 'jiraProjects' && error.message.startsWith('第 1 行：')),
  'invalid JIRA type is reported through project-info validation')
assert.equal(
  rulesModule.validateProjectInfoValues('整机产品项目', { jiraProjects: [{ ...completeJiraRow, affectProjects: '' }] }, { fieldKeys: new Set(['projectModel']) }).length,
  0,
  'JIRA validation is skipped when jiraProjects is outside the validation scope',
)

const modal = read('src/components/project-info/ProjectInfoModal.tsx')
assert.match(modal, /getProjectInfoModalFields\(projectType\)/, 'the modal must use its scoped field projection')
assert.match(modal, /getProjectInfoModalGroups\(projectType\)/, 'the modal must omit empty tOS groups')
assert.match(modal, /fieldKeys:\s*editableFieldKeys/, 'submission validation must be scoped to modal-editable fields')
assert.match(modal, /getProjectInfoModalSubmitValues\(normalizedProjectType, values\)/, 'submission must use the modal field projection')
assert.match(modal, /projectType === PROJECT_TYPE_TOS_VERSION && aggregateWarnings\.length > 0/, 'visible tOS aggregate source warnings must render above grouped fields')

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

const projectInformationFramePath = 'src/components/project-info/ProjectInformationFrame.tsx'
const collapsibleInformationSectionPath = 'src/components/project-info/CollapsibleInformationSection.tsx'
assert.equal(existsSync(projectInformationFramePath), true, 'the shared project information frame must exist')
assert.equal(existsSync(collapsibleInformationSectionPath), true, 'the shared collapsible information section must exist')

const projectInformationFrame = read(projectInformationFramePath)
assert.match(projectInformationFrame, /projectName:\s*string/, 'the shared frame exposes the project name slot')
assert.match(projectInformationFrame, /coreFields:/, 'the shared frame exposes explicit core-field data')
assert.match(projectInformationFrame, /actions:\s*ReactNode/, 'the shared frame exposes the action slot')
assert.match(projectInformationFrame, /planInformation:\s*ReactNode/, 'the shared frame exposes the plan-information slot')
assert.match(projectInformationFrame, /informationSections:\s*ReactNode/, 'the shared frame exposes the information-sections slot')
assert.match(projectInformationFrame, /anchorItems:/, 'the shared frame exposes explicit anchor items')
assert.match(projectInformationFrame, /embedded\??:\s*boolean/, 'the shared frame exposes a host-layout compatibility switch')
assert.match(projectInformationFrame, /embedded\s*=\s*false/, 'the shared frame owns the full layout and navigation by default')
assert.match(projectInformationFrame, /id="section-header"/, 'the shared frame preserves the project-core anchor')
assert.match(projectInformationFrame, /embedded \? planInformation : <ProjectInformationSlot anchorId="section-plan">\{planInformation\}<\/ProjectInformationSlot>/, 'the complete shared frame provides a stable plan-information slot anchor while embedded hosts retain their own')
assert.match(projectInformationFrame, /embedded \? informationSections : <ProjectInformationSlot anchorId="section-basic">\{informationSections\}<\/ProjectInformationSlot>/, 'the complete shared frame provides a stable project-information slot anchor while embedded hosts retain their own')
assert.match(projectInformationFrame, /basic-info-scroll-container/, 'anchor navigation keeps using the existing scroll container')
assert.doesNotMatch(projectInformationFrame, /isWholeMachine|isTechnicalProject|projectType/, 'the shared frame contains no project-type branches')

const collapsibleInformationSection = read(collapsibleInformationSectionPath)
assert.match(collapsibleInformationSection, /defaultActive\??:\s*boolean/, 'collapsible sections support an explicit default-open state')
assert.match(collapsibleInformationSection, /defaultActive\s*=\s*false/, 'collapsible sections are closed by default')
assert.match(collapsibleInformationSection, /pms-project-info-collapse/, 'collapsible sections reuse the established information-section visuals')
assert.match(collapsibleInformationSection, /aria-label/, 'collapsible sections expose a stable accessible label')

const targetProjectInformationView = read('src/components/project-info/TargetProjectInformationView.tsx')
assert.match(targetProjectInformationView, /ProjectInformationFrame/, 'whole-machine and tOS information must consume the shared frame')
assert.match(targetProjectInformationView, /embedded/, 'the existing target-project host keeps its outer layout without rendering a second anchor navigation')
assert.match(targetProjectInformationView, /planInformation=\{afterCore\}/, 'the target-project adapter preserves its existing plan-information slot')
assert.match(targetProjectInformationView, /informationSections=\{/, 'the target-project adapter preserves its existing project-information sections')

const smoke = read('screenshots/smoke-tos-type-plan.mjs')
assert.match(smoke, /assertNoVisibleText\(page, '里程碑计划（横排视图）', '#section-plan'\)/, 'the smoke path must reject the removed subtitle')
assert.match(smoke, /assertNoVisibleText\(page, '首发项目', '\.pms-project-info-modal'\)/, 'the smoke path must reject the removed tOS modal field')
assert.match(smoke, /async function assertTransferInformationCollapse[\s\S]*'折叠'[\s\S]*!document\.querySelector\('#section-transfer-content'\)[\s\S]*'展开'/, 'the browser smoke must collapse and restore real transfer table content')
assert.match(smoke, /collapsedLayout\.bodyDisplay !== 'none'[\s\S]*collapsedLayout\.cardHeight > collapsedLayout\.headHeight \+ 6/, 'the browser smoke must reject blank transfer-card body space')
assert.match(smoke, /'tOS版本项目'[\s\S]*selectVisibleModalOption\(page, '项目名', 'tOS19\.0'\)[\s\S]*assertNoVisibleText\(page, '基础信息', '\.pms-project-info-modal'\)[\s\S]*assertVisibleText\(page, '团队信息', '\.pms-project-info-modal'\)/, 'the browser smoke must select tOS in create mode and verify its modal groups')

console.log('Project information follow-up adjustment verification passed.')
