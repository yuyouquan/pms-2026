#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const schema = loadTypeScriptModule(root, 'src/constants/projectInfoSchema.ts')
const planSchema = loadTypeScriptModule(root, 'src/constants/projectPlanInfoSchema.ts')
const technical = loadTypeScriptModule(root, 'src/constants/technicalProject.ts')
const preferences = loadTypeScriptModule(root, 'src/lib/projectFieldPreferences.ts')
const projectInfoValues = loadTypeScriptModule(root, 'src/lib/projectInfoValues.ts')

const machineCreateKeys = [
  'firstSaleTosVersion', 'status', 'versionType', 'softwareProjectLevel',
  'isFirstLaunchProject', 'productSeries', 'researchMode', 'developmentMode',
  'dimensionUpgradeStrategy', 'systemType', 'kernelVersion', 'androidMajorUpgrade',
  'modelCategory', 'confidentialityLevel', 'chipCode', 'chipModel', 'chipPlatform',
  'memorySize', 'startingRam', 'isTwoStage', 'isOutsourcedMini', 'wholeMachinePd',
  'pcbaSheet', 'shippingCountrySheet', 'keyComponentsSheet', 'jiraProjects',
  'machineSpm', 'machineSpp', 'machineCmo', 'machineSoftwareSe',
  'machineQualityRepresentative', 'machineDevelopmentRepresentative',
  'machineTestRepresentative', 'machineOther',
]
const machineCreateRequiredKeys = [
  'firstSaleTosVersion', 'status', 'versionType', 'softwareProjectLevel',
  'isFirstLaunchProject', 'productSeries', 'developmentMode', 'systemType',
  'kernelVersion', 'chipCode', 'memorySize', 'isTwoStage', 'machineSpm',
]
const machineSpaceCoreKeys = [
  'brand', 'productLine', 'marketName', 'firstSaleTosVersion', 'status',
  'healthStatus', 'currentNode',
]
const machineSpacePlanKeys = [
  'isMadaControlled', 'isSimLocked', 'googleLaunchDate', 'isCancelPaused',
  'cancelPauseDate', 'buildOption', 'buildMarket',
]
const machineSpaceInfoKeys = [
  'currentTosVersion', 'versionType', 'softwareProjectLevel', 'isFirstLaunchProject',
  'productSeries', 'researchMode', 'developmentMode', 'dimensionUpgradeStrategy',
  'systemType', 'kernelVersion', 'androidMajorUpgrade', 'modelCategory',
  'productionForbiddenDate', 'confidentialityLevel', 'projectModel', 'androidVersion',
  'mainboardName', 'productType', 'chipCode', 'chipModel', 'chipPlatform',
  'memorySize', 'startingRam', 'isTwoStage', 'isOutsourcedMini', 'jiraProjects',
  'baselineName', 'wholeMachinePd', 'pcbaSheet', 'shippingCountrySheet',
  'keyComponentsSheet', 'machineSpm', 'machineSpp', 'machineCmo',
  'machineSoftwareSe', 'machineQualityRepresentative',
  'machineDevelopmentRepresentative', 'machineTestRepresentative', 'machineOther',
]
const machineSpaceDefaultVisible = [
  ...machineSpaceCoreKeys,
  'isMadaControlled', 'isSimLocked', 'googleLaunchDate', 'isCancelPaused',
  'cancelPauseDate',
  'currentTosVersion', 'versionType', 'softwareProjectLevel', 'isFirstLaunchProject',
  'productSeries', 'researchMode', 'developmentMode', 'dimensionUpgradeStrategy',
  'systemType', 'kernelVersion', 'androidMajorUpgrade', 'modelCategory',
  'productionForbiddenDate', 'confidentialityLevel', 'chipCode', 'chipModel',
  'chipPlatform', 'memorySize', 'startingRam', 'isTwoStage', 'isOutsourcedMini',
  'jiraProjects', 'machineSpm', 'machineSpp', 'machineCmo', 'machineSoftwareSe',
  'machineQualityRepresentative', 'machineDevelopmentRepresentative',
  'machineTestRepresentative', 'machineOther',
]

const technicalCreateKeys = [
  'secondaryCategory', 'technicalTrack', 'projectName', 'status', 'tmg', 'subdomain',
  'projectValue', 'projectYear', 'preProjectId', 'technicalLead',
  'technicalProjectManager', 'testRepresentative', 'qualityRepresentative',
  'productRepresentative', 'standardizationRepresentative', 'technicalOther',
  'projectKpi', 'conceptDesign', 'charterReport', 'pdcpReport', 'tdcpReport',
  'edcpReport',
]
const technicalCreateRequiredKeys = [
  'tmg', 'subdomain', 'projectValue', 'projectYear', 'technicalLead',
  'technicalProjectManager',
]
const technicalSpaceCoreKeys = [
  'secondaryCategory', 'technicalTrack', 'tmg', 'subdomain', 'status', 'projectStage',
  'projectYear', 'projectValue', 'preProjectId', 'tdtAndSubprojectName',
]
const technicalSpaceBasicKeys = [
  'coreValue', 'developmentMode', 'firstTosVersion', 'firstMachineProjectId',
]
const technicalSpaceTeamKeys = [
  'technicalLead', 'technicalProjectManager', 'testRepresentative',
  'qualityRepresentative', 'productRepresentative', 'standardizationRepresentative',
  'technicalOther',
]
const technicalSpaceDeliverableKeys = [
  'projectKpi', 'conceptDesign', 'charterReport', 'pdcpReport', 'tdcpReport',
  'edcpReport',
]
const technicalSpaceKeys = [
  ...technicalSpaceCoreKeys,
  'technicalPlan',
  ...technicalSpaceBasicKeys,
  ...technicalSpaceTeamKeys,
  ...technicalSpaceDeliverableKeys,
]

for (const [name, value] of [
  ['MACHINE_PROJECT_CREATE_FIELD_KEYS', schema.MACHINE_PROJECT_CREATE_FIELD_KEYS],
  ['MACHINE_PROJECT_SPACE_CORE_FIELD_KEYS', schema.MACHINE_PROJECT_SPACE_CORE_FIELD_KEYS],
  ['MACHINE_PROJECT_SPACE_INFO_FIELD_KEYS', schema.MACHINE_PROJECT_SPACE_INFO_FIELD_KEYS],
  ['TECHNICAL_PROJECT_CREATE_FIELD_KEYS', schema.TECHNICAL_PROJECT_CREATE_FIELD_KEYS],
  ['TECHNICAL_PROJECT_SPACE_CORE_FIELD_KEYS', schema.TECHNICAL_PROJECT_SPACE_CORE_FIELD_KEYS],
  ['TECHNICAL_PROJECT_SPACE_BASIC_FIELD_KEYS', schema.TECHNICAL_PROJECT_SPACE_BASIC_FIELD_KEYS],
  ['MACHINE_PROJECT_SPACE_PLAN_FIELD_KEYS', planSchema.MACHINE_PROJECT_SPACE_PLAN_FIELD_KEYS],
]) {
  assert.equal(Array.isArray(value), true, `${name} must be exported as an ordered array`)
}

assert.deepEqual(Array.from(schema.MACHINE_PROJECT_CREATE_FIELD_KEYS), machineCreateKeys)
assert.deepEqual(Array.from(schema.MACHINE_PROJECT_SPACE_CORE_FIELD_KEYS), machineSpaceCoreKeys)
assert.deepEqual(Array.from(planSchema.MACHINE_PROJECT_SPACE_PLAN_FIELD_KEYS), machineSpacePlanKeys)
assert.deepEqual(Array.from(schema.MACHINE_PROJECT_SPACE_INFO_FIELD_KEYS), machineSpaceInfoKeys)
assert.deepEqual(
  [...schema.MACHINE_PROJECT_SPACE_CORE_FIELD_KEYS, ...planSchema.MACHINE_PROJECT_SPACE_PLAN_FIELD_KEYS, ...schema.MACHINE_PROJECT_SPACE_INFO_FIELD_KEYS],
  [...machineSpaceCoreKeys, ...machineSpacePlanKeys, ...machineSpaceInfoKeys],
  'machine project space must be core 1-7 + plan 8-14 + information 15-53',
)

assert.deepEqual(Array.from(schema.TECHNICAL_PROJECT_CREATE_FIELD_KEYS), technicalCreateKeys)
assert.deepEqual(Array.from(schema.TECHNICAL_PROJECT_SPACE_CORE_FIELD_KEYS), technicalSpaceCoreKeys)
assert.deepEqual(Array.from(schema.TECHNICAL_PROJECT_SPACE_BASIC_FIELD_KEYS), technicalSpaceBasicKeys)
assert.deepEqual(Array.from(technical.TECHNICAL_TEAM_FIELDS, field => field.key), technicalSpaceTeamKeys)
assert.deepEqual(Array.from(technical.TECHNICAL_DELIVERABLE_FIELDS, field => field.key), technicalSpaceDeliverableKeys)
assert.deepEqual(
  [
    ...schema.TECHNICAL_PROJECT_SPACE_CORE_FIELD_KEYS,
    schema.TECHNICAL_PROJECT_SPACE_PLAN_FIELD_KEY,
    ...schema.TECHNICAL_PROJECT_SPACE_BASIC_FIELD_KEYS,
    ...technical.TECHNICAL_TEAM_FIELDS.map(field => field.key),
    ...technical.TECHNICAL_DELIVERABLE_FIELDS.map(field => field.key),
  ],
  technicalSpaceKeys,
  'technical project space must be core 1-10 + plan 11 + basic 12-15 + team 16-22 + deliverables 23-28',
)

const machineFieldsByKey = new Map(schema.MACHINE_PROJECT_INFO_FIELDS.map(field => [field.key, field]))
const machineCreateDefinitions = new Map(schema.MACHINE_PROJECT_CREATE_FIELDS.map(field => [field.key, field]))
const machineSpaceDefinitions = [
  ...schema.MACHINE_PROJECT_SPACE_CORE_FIELDS,
  ...planSchema.PROJECT_PLAN_INFO_FIELDS,
  ...schema.MACHINE_PROJECT_SPACE_INFO_FIELDS,
]
const machineSpaceByKey = new Map(machineSpaceDefinitions.map(field => [field.key, field]))
assert.deepEqual(
  machineCreateKeys.filter(key => machineCreateDefinitions.get(key)?.requiredOnCreate),
  machineCreateRequiredKeys,
  'machine create required metadata must match the approved list',
)
assert.equal(machineCreateDefinitions.get('dimensionUpgradeStrategy')?.label, '升级策略')
assert.equal(machineCreateDefinitions.get('dimensionUpgradeStrategy')?.requiredOnCreate, false)
assert.equal(machineCreateDefinitions.get('isOutsourcedMini')?.requiredOnCreate, false)
for (const key of ['wholeMachinePd', 'pcbaSheet', 'shippingCountrySheet', 'keyComponentsSheet', 'jiraProjects']) {
  assert.equal(machineCreateDefinitions.get(key)?.requiredOnCreate, false, `${key} must remain optional on create`)
}
assert.deepEqual(
  machineSpaceDefinitions.filter(field => field.defaultVisible).map(field => field.key),
  machineSpaceDefaultVisible,
  'machine project-space default visibility must match all 53 approved rows',
)
assert.deepEqual(
  machineSpaceInfoKeys.filter(key => ['targetMarkets', 'launchDate', 'machineUx'].includes(key)),
  [],
  'removed machine fields must not remain in the project-space projection',
)
assert.deepEqual(
  machineCreateKeys.filter(key => ['targetMarkets', 'launchDate', 'machineUx'].includes(key)),
  [],
  'removed machine fields must not remain in the create projection',
)
assert.equal(machineSpaceInfoKeys.filter(key => key === 'productionForbiddenDate').length, 1)
for (const key of ['projectModel', 'androidVersion', 'mainboardName', 'productType', 'baselineName']) {
  assert.equal(machineSpaceByKey.get(key)?.defaultVisible, false, `${key} must remain available but default hidden`)
  assert.equal(machineSpaceByKey.get(key)?.hideable, true, `${key} must remain configurable`)
}
for (const key of ['machineQualityRepresentative', 'machineOther']) {
  assert.equal(machineFieldsByKey.get(key)?.introducedInSchemaVersion, schema.PROJECT_INFO_SCHEMA_VERSION)
}

const technicalCreateDefinitions = new Map(schema.TECHNICAL_PROJECT_CREATE_FIELDS.map(field => [field.key, field]))
assert.deepEqual(
  technicalCreateKeys.filter(key => technicalCreateDefinitions.get(key)?.requiredOnCreate),
  technicalCreateRequiredKeys,
  'technical create required metadata must match the approved list',
)
for (const key of ['secondaryCategory', 'technicalTrack', 'projectName', 'status']) {
  assert.equal(technicalCreateDefinitions.get(key)?.readOnly, true, `${key} is a displayed source snapshot`)
}
assert.equal(technicalCreateDefinitions.get('technicalOther')?.label, '其他')
assert.equal(technical.TECHNICAL_TEAM_FIELDS.find(field => field.key === 'technicalProjectManager')?.required, true)
assert.equal(technical.TECHNICAL_DELIVERABLE_FIELDS.find(field => field.key === 'charterReport')?.label, 'Charter报告')
assert.equal(technicalSpaceTeamKeys.filter(key => key === 'testRepresentative').length, 1)
assert.equal(technicalSpaceKeys.length, 28)
assert.equal(schema.TECHNICAL_PROJECT_SPACE_FIELDS.every(field => field.defaultVisible), true)

const tosKeySnapshot = [
  'tosVersion', 'firstLaunchProjects', 'firstLaunchProjectChips', 'applicableBrands',
  'applicableProductLines', 'applicableChipPlatforms', 'newProductProjectList',
  'legacyProductProjectList', 'tosVersionProjectManager', 'tosPlanningRepresentative',
  'tosSe', 'tosTestRepresentative', 'tosSqa', 'tosCmo', 'tosUx',
  'tosStabilityRepresentative', 'tosPerformanceRepresentative',
  'tosPowerRepresentative', 'tosSystemAppDevRepresentative',
  'tosBasebandDevRepresentative', 'tosIntegrationDevRepresentative',
  'tosArchitectureDevRepresentative', 'tosInnovationDevRepresentative',
  'tosTexAiDevRepresentative', 'tosImagingDevRepresentative',
  'tosPreinstallRepresentative', 'tosEcosystemRepresentative',
]
assert.deepEqual(Array.from(schema.TOS_PROJECT_INFO_FIELDS, field => field.key), tosKeySnapshot)

assert.equal(schema.PROJECT_INFO_SCHEMA_VERSION, 3, 'field preference schema version must advance exactly once')
const reconciled = preferences.reconcileVisibleFieldKeys(schema.MACHINE_PROJECT_SPACE_INFO_FIELDS, {
  visibleFieldKeys: ['projectModel', 'targetMarkets', 'launchDate', 'machineUx'],
  schemaVersion: schema.PROJECT_INFO_SCHEMA_VERSION - 1,
})
assert.equal(reconciled.includes('projectModel'), true, 'valid old selections must survive migration')
for (const key of ['targetMarkets', 'launchDate', 'machineUx']) {
  assert.equal(reconciled.includes(key), false, `${key} must be removed from stored preferences`)
}
for (const key of ['machineQualityRepresentative', 'machineOther']) {
  assert.equal(reconciled.includes(key), true, `${key} must be introduced as default visible`)
}
for (const key of ['mainboardName', 'productType']) {
  assert.equal(reconciled.includes(key), false, `${key} must not be auto-added because it is default hidden`)
  assert.equal(machineSpaceByKey.has(key), true, `${key} must remain in the field picker projection`)
}

const mergedMachine = projectInfoValues.mergeProjectInfoValues({
  id: 'machine-new-fields',
  name: 'Machine',
  type: '整机产品-手机',
}, {
  researchMode: '自研',
  machineQualityRepresentative: ['质量甲'],
  machineOther: ['协同乙'],
})
assert.deepEqual(mergedMachine.machineQualityRepresentative, ['质量甲'])
assert.deepEqual(mergedMachine.machineOther, ['协同乙'])
assert.deepEqual(mergedMachine.fieldValues.machineTeamRoles.qualityRepresentative, ['质量甲'])
assert.deepEqual(mergedMachine.fieldValues.machineTeamRoles.other, ['协同乙'])
assert.deepEqual(projectInfoValues.getProjectInfoValue(mergedMachine, 'machineQualityRepresentative'), ['质量甲'])
assert.deepEqual(projectInfoValues.getProjectInfoValue(mergedMachine, 'machineOther'), ['协同乙'])

const mergedTechnical = projectInfoValues.mergeProjectInfoValues({
  id: 'technical-new-field',
  name: 'Technical',
  type: '技术项目',
}, { technicalOther: '协同丙' })
assert.equal(mergedTechnical.technicalOther, '协同丙')
assert.equal(projectInfoValues.getProjectInfoValue(mergedTechnical, 'technicalOther'), '协同丙')

console.log('project field order follow-up contract passed')
