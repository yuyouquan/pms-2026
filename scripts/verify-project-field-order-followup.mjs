#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot, readSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const schema = loadTypeScriptModule(root, 'src/constants/projectInfoSchema.ts')
const planSchema = loadTypeScriptModule(root, 'src/constants/projectPlanInfoSchema.ts')
const technical = loadTypeScriptModule(root, 'src/constants/technicalProject.ts')
const preferences = loadTypeScriptModule(root, 'src/lib/projectFieldPreferences.ts')
const projectInfoValues = loadTypeScriptModule(root, 'src/lib/projectInfoValues.ts')
const projectInfoRules = loadTypeScriptModule(root, 'src/lib/projectInfoRules.ts')
const technicalProjectRules = loadTypeScriptModule(root, 'src/lib/technicalProjectRules.ts')
const externalProjectPool = loadTypeScriptModule(root, 'src/data/externalProjectPool.ts')
const schemaSource = readSource(root, 'src/constants/projectInfoSchema.ts')
const technicalSource = readSource(root, 'src/constants/technicalProject.ts')
const modalSource = readSource(root, 'src/components/project-info/ProjectInfoModal.tsx')
const technicalCreateSource = readSource(root, 'src/components/technical-project/TechnicalProjectCreateFields.tsx')
const fieldVisibilityPickerSource = readSource(root, 'src/components/project-info/FieldVisibilityPicker.tsx')
const targetProjectInformationSource = readSource(root, 'src/components/project-info/TargetProjectInformationView.tsx')
const projectInfoSectionsSource = readSource(root, 'src/components/project-info/ProjectInfoSections.tsx')
const globalsSource = readSource(root, 'src/styles/globals.css')
const projectPlanInfoGridSource = readSource(root, 'src/components/project-info/ProjectPlanInfoGrid.tsx')
const technicalInformationSource = readSource(root, 'src/components/technical-project/TechnicalProjectInformationView.tsx')
const redesignBrowserSource = readSource(root, 'screenshots/verify-workbench-technical-project-redesign.mjs')

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
  'memorySize', 'startingRam', 'isTwoStage', 'isOutsourcedMini',
  'baselineName', 'wholeMachinePd', 'pcbaSheet', 'shippingCountrySheet',
  'keyComponentsSheet', 'machineSpm', 'machineSpp', 'machineCmo',
  'machineSoftwareSe', 'machineQualityRepresentative',
  'machineDevelopmentRepresentative', 'machineTestRepresentative', 'machineOther',
  'jiraProjects',
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
  'machineSpm', 'machineSpp', 'machineCmo', 'machineSoftwareSe',
  'machineQualityRepresentative', 'machineDevelopmentRepresentative',
  'machineTestRepresentative', 'machineOther', 'jiraProjects',
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
  'status', 'tmg', 'subdomain', 'projectValue', 'projectYear', 'technicalLead',
  'technicalProjectManager',
]
const technicalSpaceCoreKeys = [
  'secondaryCategory', 'technicalTrack', 'tmg', 'subdomain', 'status', 'projectStage',
  'projectYear', 'preProjectId', 'projectValue',
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
  Array.from(schema.TECHNICAL_PROJECT_SPACE_FIELDS, field => field.key),
  technicalSpaceKeys,
  'the actual technical project-space projection must follow the approved 27-field order',
)
assert.deepEqual(
  [
    ...schema.TECHNICAL_PROJECT_SPACE_CORE_FIELD_KEYS,
    schema.TECHNICAL_PROJECT_SPACE_PLAN_FIELD_KEY,
    ...schema.TECHNICAL_PROJECT_SPACE_BASIC_FIELD_KEYS,
    ...technical.TECHNICAL_TEAM_FIELDS.map(field => field.key),
    ...technical.TECHNICAL_DELIVERABLE_FIELDS.map(field => field.key),
  ],
  technicalSpaceKeys,
  'technical project space must be core 1-9 + plan 10 + basic 11-14 + team 15-21 + deliverables 22-27',
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
assert.match(projectInfoSectionsSource, /field\.key === 'jiraProjects'[\s\S]*pms-project-info-display-item--full-row/)
assert.match(
  projectInfoSectionsSource,
  /field\.key === 'jiraProjects'[\s\S]*pms-project-info-jira-horizontal/,
  'JIRA projects must use the dedicated horizontal full-row display class',
)
for (const rule of [
  /\.pms-project-info-jira-horizontal\s*\{[\s\S]*flex-direction:\s*row/,
  /\.pms-project-info-jira-horizontal\s+\.pms-project-info-display-label\s*\{[\s\S]*min-width:\s*120px/,
  /\.pms-project-info-jira-horizontal\s+\.pms-project-info-display-value\s*\{[\s\S]*margin-top:\s*0/,
  /\.pms-project-info-jira-horizontal\s+\.pms-project-info-display-value\s*\{[\s\S]*text-align:\s*left/,
  /\.pms-project-info-jira-horizontal\s+\.ant-space\s*\{[\s\S]*flex-wrap:\s*wrap/,
]) {
  assert.match(globalsSource, rule, 'JIRA project display must keep label and wrapped linked tags on one horizontal row')
}
for (const rule of [
  /@media\s*\(max-width:\s*480px\)\s*\{[\s\S]*\.pms-project-info-jira-horizontal\s*\{[\s\S]*flex-direction:\s*column/,
  /@media\s*\(max-width:\s*480px\)\s*\{[\s\S]*\.pms-project-info-jira-horizontal\s+\.pms-project-info-display-value\s*\{[\s\S]*width:\s*100%/,
  /@media\s*\(max-width:\s*480px\)\s*\{[\s\S]*\.pms-project-info-jira-horizontal\s+\.ant-tag\s*\{[\s\S]*max-width:\s*100%/,
  /@media\s*\(max-width:\s*480px\)\s*\{[\s\S]*\.pms-project-info-jira-horizontal\s+\.ant-tag\s+a\s*\{[\s\S]*text-overflow:\s*ellipsis/,
]) {
  assert.match(globalsSource, rule, 'JIRA project display must stay within the row on narrow screens')
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
for (const key of ['secondaryCategory', 'technicalTrack', 'projectName']) {
  assert.equal(technicalCreateDefinitions.get(key)?.readOnly, true, `${key} is a displayed source snapshot`)
}
assert.equal(technicalCreateDefinitions.get('status')?.inputType, 'select', 'technical status is a configured user selection')
assert.doesNotMatch(technicalCreateSource, /TECHNICAL_SOURCE_SNAPSHOT_KEYS[^\n]*['"]status['"]/, 'technical status is not an IPM source snapshot')
assert.match(technicalCreateSource, /useSingleEnumOptions\(['"]technical-project-status['"]/, 'technical status reads its configured enum')
assert.match(technicalCreateSource, /field\.key === ['"]status['"][\s\S]*<Select/, 'technical status renders as a Select')
assert.equal(technicalCreateDefinitions.get('technicalOther')?.label, '其他')
assert.equal(technical.TECHNICAL_TEAM_FIELDS.find(field => field.key === 'technicalProjectManager')?.required, true)
assert.equal(technical.TECHNICAL_DELIVERABLE_FIELDS.find(field => field.key === 'charterReport')?.label, 'Charter报告')
assert.equal(technicalSpaceTeamKeys.filter(key => key === 'testRepresentative').length, 1)
assert.equal(technicalSpaceKeys.length, 27)
assert.equal(schema.TECHNICAL_PROJECT_SPACE_FIELDS.every(field => field.defaultVisible), true)

assert.deepEqual(
  Array.from(projectInfoRules.getProjectInfoCreateFields('整机产品-手机'), field => field.key),
  machineCreateKeys,
  'machine create rules must expose the approved create projection',
)
assert.deepEqual(
  Array.from(projectInfoRules.getProjectInfoModalFields('整机产品-手机'), field => field.key),
  machineCreateKeys,
  'machine modal rules must expose the create projection, including create-only fields',
)
assert.deepEqual(
  Array.from(projectInfoRules.getProjectInfoCreateFields('技术项目'), field => field.key),
  technicalCreateKeys,
  'technical create rules must expose the approved create projection',
)

const newMachineSubmit = projectInfoRules.getProjectInfoModalSubmitValues('整机产品-手机', {
  firstSaleTosVersion: 'tOS17.0',
  status: '进行中',
  researchMode: '自研',
  developmentMode: '自研',
  productType: '新品',
  projectModel: 'Spark40',
  mainboardName: 'SPARK40_MB',
  androidVersion: 'Android 16',
  productionForbiddenDate: '2026-12-01',
  baselineName: 'Spark40-baseline',
  isTwoStage: '是',
})
assert.equal(newMachineSubmit.firstSaleTosVersion, 'tOS17.0', 'new-machine first-sale tOS must be stored')
assert.equal(newMachineSubmit.status, undefined, 'project status must remain outside canonical infoValues')
assert.equal(newMachineSubmit.isTwoStage, undefined, 'hidden conditional fields must not be submitted')
for (const [key, value] of [
  ['productType', '新品'],
  ['projectModel', 'Spark40'],
  ['mainboardName', 'SPARK40_MB'],
  ['androidVersion', 'Android 16'],
  ['productionForbiddenDate', '2026-12-01'],
  ['baselineName', 'Spark40-baseline'],
]) {
  assert.equal(newMachineSubmit[key], value, `${key} source-derived storage value must be preserved`)
}

const legacyMachineSubmit = projectInfoRules.getProjectInfoModalSubmitValues('整机产品-手机', {
  firstSaleTosVersion: 'tOS16.0',
  productType: '老品',
  currentTosVersion: 'tOS16.3',
})
assert.equal(legacyMachineSubmit.firstSaleTosVersion, 'tOS16.0')
assert.equal(legacyMachineSubmit.currentTosVersion, 'tOS16.3', 'legacy-machine current tOS must be stored')
assert.equal(externalProjectPool.fetchByBid('EXT-010').tosVersion, 'tOS14.0.0', 'new-machine source carries its real first/current tOS snapshot')
assert.equal(externalProjectPool.fetchByBid('EXT-011').tosVersion, 'tOS15.0.0', 'first legacy source carries current tOS without requiring a form field')
assert.equal(externalProjectPool.fetchByBid('EXT-012').tosVersion, 'tOS17.10.0', 'second legacy source carries current tOS without requiring a form field')

const externalResearchMachineSubmit = projectInfoRules.getProjectInfoModalSubmitValues('整机产品-手机', {
  firstSaleTosVersion: 'tOS17.0',
  researchMode: '外研',
  isTwoStage: '是',
})
assert.equal(externalResearchMachineSubmit.firstSaleTosVersion, 'tOS17.0')
assert.equal(externalResearchMachineSubmit.isTwoStage, '是', 'visible conditional fields must be submitted')

assert.match(
  modalSource,
  /showConfiguredProjectStatus && !isMachineProjectType\(projectType\)/,
  'the universal project-status control must exclude machine projects',
)
assert.match(
  modalSource,
  /field\.key === 'status' \? \([\s\S]{0,500}?options=\{projectStatusOptions\}/,
  'the machine status schema field must use the configured project-status options',
)
assert.equal(
  (modalSource.match(/<Form\.Item label="项目状态" name="status"/g) || []).length,
  1,
  'the modal source must keep only one explicit universal status render path',
)
assert.match(modalSource, /getProjectInfoCreateFields/, 'create pages must consume the ordered create projection')
assert.match(
  modalSource,
  /aria-label="IPM项目来源"[\s\S]*aria-label="整机项目新建字段"/,
  'the IPM source selector must render before the machine business fields',
)
assert.match(
  modalSource,
  /machineCreateFields\.map\(renderProjectInfoField\)/,
  'all machine business Form.Items must be rendered directly from the ordered create projection',
)
assert.match(modalSource, /data-project-create-field=\{field\.key\}/, 'rendered create fields must expose their source key in the live DOM')
assert.doesNotMatch(
  modalSource,
  /field\.key === 'firstSaleTosVersion' && isLegacyMachine[\s\S]{0,160}key: 'currentTosVersion'/,
  'legacy machine edit must keep the approved first-sale field instead of rendering current tOS',
)
assert.match(
  modalSource,
  /field\.key === 'firstSaleTosVersion'\s*\? \{ \.\.\.field, readOnly: false \}/,
  'the approved first-sale field must remain editable for both new and legacy machines',
)
assert.match(
  modalSource,
  /const isRequired = !renderedField\.readOnly[\s\S]{0,160}field\.requiredOnCreate/,
  'read-only source snapshots must stay disabled without participating in create validation',
)
assert.doesNotMatch(
  modalSource,
  /machineCreateFields\.filter\([^\n]*readOnly/,
  'read-only machine fields must not be removed from the 34-field page projection',
)
assert.match(
  modalSource,
  /fields=\{technicalCreateFields\}/,
  'the technical form must receive the same ordered create projection',
)
assert.match(
  technicalCreateSource,
  /fields\.map\(field =>/,
  'the technical page must render its Form.Items from the ordered create projection',
)
assert.match(
  technicalCreateSource,
  /TECHNICAL_SOURCE_SNAPSHOT_KEYS\.has\(field\.key\)[\s\S]{0,160}<Input disabled/,
  'the first four source-derived technical fields must render as disabled snapshots',
)
assert.equal(
  (technicalCreateSource.match(/<Form\.Item/g) || []).length,
  1,
  'the technical renderer must own one generic Form.Item path so team and snapshot fields cannot be duplicated',
)
assert.match(fieldVisibilityPickerSource, /mask=\{\{ closable: !confirming \}\}/, 'field visibility Drawer uses the AntD v6 mask closable API')
assert.doesNotMatch(fieldVisibilityPickerSource, /maskClosable=/, 'field visibility Drawer must not emit the deprecated maskClosable warning')
assert.match(
  targetProjectInformationSource,
  /MACHINE_PROJECT_SPACE_CORE_FIELDS\.map\(field =>/,
  'the whole-machine core card must render the seven-key space projection instead of a second handwritten order',
)
assert.doesNotMatch(
  targetProjectInformationSource,
  /const coreFields = isWholeMachine \? \[[\s\S]{0,240}label: '项目名称'|const coreFields = isWholeMachine \? \[[\s\S]{0,520}label: '项目分类'/,
  'whole-machine project name and category must not consume confirmed core-field positions',
)
assert.match(
  projectPlanInfoGridSource,
  /PROJECT_PLAN_INFO_FIELDS\.map\(field =>/,
  'the live plan grid must render the approved seven-field plan projection in schema order',
)
assert.match(
  projectInfoSectionsSource,
  /const spaceFields = getProjectInfoSpaceFields\(project\.type\)[\s\S]{0,120}spaceFields\.filter\(field => field\.group === group\.key\)/,
  'project-space information sections must consume the space projection rather than the shared storage definition order',
)
assert.match(
  technicalInformationSource,
  /TECHNICAL_PROJECT_SPACE_CORE_FIELDS\.map\(field =>/,
  'the technical core card must render the approved nine-field space projection',
)
assert.match(
  technicalInformationSource,
  /TECHNICAL_PROJECT_SPACE_BASIC_FIELDS\.map\(field =>/,
  'the technical TDT basic section must render the approved four-field space projection',
)
assert.match(
  technicalInformationSource,
  /TECHNICAL_TEAM_FIELDS\.map\(field =>/,
  'the technical team section must render the seven confirmed fixed roles in shared order',
)
assert.match(
  technicalInformationSource,
  /TECHNICAL_DELIVERABLE_FIELDS\.map\(field =>/,
  'the technical deliverable section must render the six confirmed deliverables in shared order',
)
assert.doesNotMatch(
  technicalInformationSource,
  /\.\.\.normalizedCustomRoles/,
  'custom permission roles must not expand the strict 27-field technical information projection',
)

const technicalInfoTeamFields = schema.TECHNICAL_PROJECT_INFO_FIELDS.filter(field => field.group === 'team')
assert.deepEqual(
  technicalInfoTeamFields.map(field => ({
    key: field.key,
    label: field.label,
    required: field.required,
    requiredOnCreate: field.requiredOnCreate,
  })),
  technical.TECHNICAL_TEAM_FIELDS.map(field => ({
    ...field,
    requiredOnCreate: field.required,
  })),
  'technical team schema metadata must derive from TECHNICAL_TEAM_FIELDS',
)
const technicalInfoDeliverableFields = schema.TECHNICAL_PROJECT_INFO_FIELDS.filter(field => field.group === 'extended')
assert.deepEqual(
  technicalInfoDeliverableFields.map(field => ({ key: field.key, label: field.label })),
  technical.TECHNICAL_DELIVERABLE_FIELDS.map(field => ({ key: field.key, label: field.label })),
  'technical deliverable schema metadata must derive from TECHNICAL_DELIVERABLE_FIELDS',
)
assert.deepEqual(
  Array.from(technical.TECHNICAL_STRING_FIELD_KEYS).slice(-technical.TECHNICAL_TEAM_FIELDS.length),
  technical.TECHNICAL_TEAM_FIELDS.map(field => field.key),
  'technical string team keys must derive from TECHNICAL_TEAM_FIELDS',
)
assert.match(
  schemaSource,
  /const TECHNICAL_PROJECT_TEAM_INFO_FIELDS = defineFields\(TECHNICAL_TEAM_FIELDS\.map\(/,
  'technical team schema must use the shared metadata source',
)
assert.match(
  schemaSource,
  /const TECHNICAL_PROJECT_DELIVERABLE_INFO_FIELDS = defineFields\(TECHNICAL_DELIVERABLE_FIELDS\.map\(/,
  'technical deliverable schema must use the shared metadata source',
)
assert.match(technicalSource, /\.\.\.TECHNICAL_TEAM_FIELDS\.map\(/, 'technical string keys must use the shared team metadata source')

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
assert.deepEqual(
  Array.from(projectInfoRules.getProjectInfoModalFields('tOS版本项目'), field => field.key),
  tosKeySnapshot.slice(8),
  'tOS modal rules must continue to exclude read-only basic aggregate fields',
)

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

const scenario06Start = redesignBrowserSource.indexOf("runScenario('06 machine new and two legacy versions resolve maximum'")
const scenario06End = redesignBrowserSource.indexOf("runScenario('07 TDT create validation mapping team and deliverables'", scenario06Start)
assert.notEqual(scenario06Start, -1, 'browser scenario 06 must exist')
assert.notEqual(scenario06End, -1, 'browser scenario 06 must end before scenario 07')
const scenario06Source = redesignBrowserSource.slice(scenario06Start, scenario06End)
assert.match(
  scenario06Source,
  /visibleFieldKeys\.push\('targetMarkets', 'launchDate', 'machineUx'\)/,
  'browser migration must inject the real historical field keys',
)
assert.doesNotMatch(
  scenario06Source,
  /visibleFieldKeys\.push\([^\n]*'mainboardName'[^\n]*'productType'/,
  'browser must not simulate optional-field selection through localStorage',
)
assert.match(
  redesignBrowserSource,
  /const setCurrentFieldPickerChecked = async \(page, label, expectedChecked = true\)/,
  'browser must select optional fields through the real Drawer checkbox',
)
for (const label of ['主板名', '产品类型']) {
  assert.match(
    scenario06Source,
    new RegExp(`await setCurrentFieldPickerChecked\\(page, '${label}'\\)`),
    `browser must check ${label} through the field Drawer`,
  )
}
assert.match(
  scenario06Source,
  /await clickCurrentFieldPickerButton\(page, '确定'\)[\s\S]*await page\.reload\(\{ waitUntil: 'networkidle0' \}\)[\s\S]*迁移后字段刷新持久化错误/,
  'browser must confirm optional fields and verify their DOM order after refresh',
)

const mergedMachine = projectInfoValues.mergeProjectInfoValues({
  id: 'machine-new-fields',
  name: 'Machine',
  type: '整机产品-手机',
  spm: '历史SPM',
  fieldValues: {
    machineTeamRoles: {
      ux: ['历史UX'],
      developmentRepresentative: ['历史开发代表'],
    },
  },
}, {
  researchMode: '自研',
  machineQualityRepresentative: ['质量甲'],
  machineOther: ['协同乙'],
})
assert.deepEqual(mergedMachine.machineQualityRepresentative, ['质量甲'])
assert.deepEqual(mergedMachine.machineOther, ['协同乙'])
assert.deepEqual(mergedMachine.fieldValues.machineTeamRoles.qualityRepresentative, ['质量甲'])
assert.deepEqual(mergedMachine.fieldValues.machineTeamRoles.other, ['协同乙'])
assert.deepEqual(mergedMachine.fieldValues.machineTeamRoles.ux, ['历史UX'])
assert.deepEqual(mergedMachine.fieldValues.machineTeamRoles.spm, ['历史SPM'])
assert.deepEqual(mergedMachine.fieldValues.machineTeamRoles.developmentRepresentative, ['历史开发代表'])
assert.deepEqual(projectInfoValues.getProjectInfoValue(mergedMachine, 'machineQualityRepresentative'), ['质量甲'])
assert.deepEqual(projectInfoValues.getProjectInfoValue(mergedMachine, 'machineOther'), ['协同乙'])

const clearedMachineRole = projectInfoValues.mergeProjectInfoValues(mergedMachine, {
  machineQualityRepresentative: [],
})
assert.deepEqual(clearedMachineRole.fieldValues.machineTeamRoles.qualityRepresentative, [])
assert.deepEqual(clearedMachineRole.fieldValues.machineTeamRoles.ux, ['历史UX'])
assert.deepEqual(clearedMachineRole.fieldValues.machineTeamRoles.other, ['协同乙'])

const mergedTechnical = projectInfoValues.mergeProjectInfoValues({
  id: 'technical-new-field',
  name: 'Technical',
  type: '技术项目',
}, { technicalOther: '协同丙' })
assert.equal(mergedTechnical.technicalOther, '协同丙')
assert.equal(projectInfoValues.getProjectInfoValue(mergedTechnical, 'technicalOther'), '协同丙')

const machineCreatePayload = projectInfoRules.getProjectInfoModalSubmitValues('整机产品-手机', {
  machineQualityRepresentative: ['质量甲'],
  machineOther: ['协同乙'],
})
assert.deepEqual(machineCreatePayload.machineQualityRepresentative, ['质量甲'])
assert.deepEqual(machineCreatePayload.machineOther, ['协同乙'])

const technicalCreatePayload = technicalProjectRules.normalizeTechnicalProjectValues({
  technicalLead: '张三',
  technicalProjectManager: '李白',
  technicalOther: '协同丙',
})
assert.equal(technicalCreatePayload.technicalLead, '张三')
assert.equal(technicalCreatePayload.technicalProjectManager, '李白')
assert.equal(technicalCreatePayload.technicalOther, '协同丙', 'the new technical role must survive create/edit payload normalization')

assert.equal(
  projectInfoRules.resolveProjectHealthStatus({
    mode: 'create',
    projectType: '整机产品项目',
    submittedStatus: 'risk',
    originalStatus: 'warning',
  }),
  'normal',
  'a hidden create-only health value must always persist the normal default',
)
assert.equal(
  projectInfoRules.resolveProjectHealthStatus({
    mode: 'edit',
    projectType: '技术项目',
    submittedStatus: '',
    originalStatus: 'warning',
  }),
  'warning',
  'editing must preserve the stored health value when the field is hidden',
)
assert.equal(
  projectInfoRules.resolveProjectHealthStatus({
    mode: 'create',
    projectType: '能力建设项目',
    submittedStatus: 'risk',
  }),
  'risk',
  'project types that still render health status must preserve the submitted value',
)
assert.equal(
  projectInfoRules.resolveTechnicalProjectSecondaryCategory({
    mode: 'create',
    sourceCategory: '技术项目前置工作',
    displayedCategory: '旧分类',
    originalCategory: '',
  }),
  '技术项目前置工作',
  'technical create must persist the current IPM source category',
)
assert.equal(
  projectInfoRules.resolveTechnicalProjectSecondaryCategory({
    mode: 'edit',
    sourceCategory: '',
    displayedCategory: '',
    originalCategory: '部门级-技术研发',
  }),
  '部门级-技术研发',
  'technical edit must not clear the persisted IPM category',
)
assert.equal(
  projectInfoRules.resolveProjectCreationDraftSourceStatus({
    projectType: '技术项目',
    draftStatus: '已取消',
    sourceStatus: '筹备中',
  }),
  '已取消',
  'technical draft hydration must preserve the user-selected draft status',
)
assert.equal(
  projectInfoRules.resolveProjectCreationDraftSourceStatus({
    projectType: '整机产品项目',
    draftStatus: '进行中',
    sourceStatus: '筹备中',
  }),
  '进行中',
  'non-technical draft hydration must keep its draft status contract',
)

console.log('project field order follow-up contract passed')
