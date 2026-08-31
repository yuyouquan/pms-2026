#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot, readSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const schema = loadTypeScriptModule(root, 'src/constants/projectInfoSchema.ts')
const technicalProjectModule = loadTypeScriptModule(root, 'src/stores/technicalProject.ts')
const schemaSource = readSource(root, 'src/constants/projectInfoSchema.ts')
const createSource = readSource(root, 'src/components/technical-project/TechnicalProjectCreateFields.tsx')
const technicalInformationSource = readSource(root, 'src/components/technical-project/TechnicalProjectInformationView.tsx')
const technicalSummarySource = readSource(root, 'src/components/technical-project/TechnicalPlanSummary.tsx')
const technicalPlanSource = readSource(root, 'src/components/technical-project/TechnicalPlanModule.tsx')
const projectSpaceSource = readSource(root, 'src/containers/ProjectSpaceContainer.tsx')

const technicalCoreKeys = [
  'secondaryCategory', 'technicalTrack', 'tmg', 'subdomain', 'status', 'projectStage',
  'projectYear', 'preProjectId', 'projectValue',
]

assert.deepEqual(
  Array.from(schema.TECHNICAL_PROJECT_SPACE_CORE_FIELD_KEYS),
  technicalCoreKeys,
  'technical project-space core cards must put preProjectId directly after projectYear and omit tdtAndSubprojectName',
)
assert.deepEqual(
  Array.from(schema.TECHNICAL_PROJECT_SPACE_CORE_FIELDS, field => field.key),
  technicalCoreKeys,
  'technical project-space core field definitions must match the approved nine-card order',
)
assert.equal(
  schema.TECHNICAL_PROJECT_SPACE_CORE_FIELD_KEYS.includes('tdtAndSubprojectName'),
  false,
  'tdtAndSubprojectName must not remain in the technical project-space core keys',
)
assert.equal(
  schema.TECHNICAL_PROJECT_SPACE_CORE_FIELDS.some(field => field.key === 'tdtAndSubprojectName'),
  false,
  'tdtAndSubprojectName must not remain in the technical project-space core fields',
)

const technicalCreateProjectName = schema.TECHNICAL_PROJECT_CREATE_FIELDS.find(field => field.key === 'projectName')
assert.equal(technicalCreateProjectName?.label, '子项目名称', 'technical create must retain the source subproject name field')
assert.equal(technicalCreateProjectName?.readOnly, true, 'technical create must retain the read-only source subproject name')
assert.match(createSource, /子项目名称/, 'technical create UI must retain the subproject-name surface')
assert.match(technicalInformationSource, /visibleChildren\.map\(child => \(\{[\s\S]*?<span>\{child\.name\}<\/span>/, 'technical project-space tabs must retain subproject names')
assert.equal(
  technicalProjectModule.INITIAL_TECHNICAL_SUBPROJECTS.every(item => typeof item.name === 'string' && item.name.length > 0),
  true,
  'technical subproject data must retain names after the aggregate core card is removed',
)
assert.match(schemaSource, /key:\s*['"]projectName['"][^\n]*label:\s*['"]子项目名称['"]/, 'technical create schema must retain the subproject-name definition')

for (const [surfaceName, source] of [
  ['technical basic-information summary', technicalSummarySource],
  ['technical plan workspace horizontal view', technicalPlanSource],
]) {
  assert.doesNotMatch(
    source,
    /taskName:\s*['"]子项目计划['"]/,
    `${surfaceName} must not synthesize a 子项目计划 stage for single-level subproject plans`,
  )
  assert.match(
    source,
    /const\s+directMilestoneHeader\s*=\s*(?:projectionMode|mode)\s*===\s*['"]technical-subproject['"]/,
    `${surfaceName} must declare a direct single-row header path for technical subprojects`,
  )
  assert.match(
    source,
    /directMilestoneHeader\s*\?[\s\S]{0,2400}(?:currentProjection\.rows|milestoneTasks)\.map/,
    `${surfaceName} direct header path must project the single-level milestones themselves`,
  )
}

const sliceBetween = (source, startMarker, endMarker, description) => {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start + startMarker.length)
  assert.notEqual(start, -1, `${description} start marker must exist`)
  assert.notEqual(end, -1, `${description} end marker must exist`)
  return source.slice(start, end)
}

const wholeMachineBasicInfo = sliceBetween(
  projectSpaceSource,
  'const renderWholeMachinePlanInfo = () =>',
  'const anchorSections =',
  'whole-machine basic-information market summary',
)
const tosBasicInfo = sliceBetween(
  projectSpaceSource,
  'const renderProjectPlanInfo = () =>',
  'const renderProjectPlanOverview = () =>',
  'tOS basic-information type summary',
)
for (const [surfaceName, source] of [
  ['whole-machine basic-information market summary', wholeMachineBasicInfo],
  ['tOS basic-information type summary', tosBasicInfo],
]) {
  assert.doesNotMatch(source, /renderLatestPublishedLevel1Summary\(/, `${surfaceName} must omit the four-date summary`)
  for (const field of ['planStartDate', 'planEndDate', 'actualStartDate', 'actualEndDate']) {
    assert.doesNotMatch(source, new RegExp(`data-summary-field=[{]?['"]${field}`), `${surfaceName} must not render ${field}`)
  }
}

const planWorkspace = sliceBetween(
  projectSpaceSource,
  'const renderProjectPlan = () =>',
  '// ═══════ Sidebar menu items ═══════',
  'project plan workspace',
)
for (const [field, label] of [
  ['planStartDate', '计划开始'],
  ['planEndDate', '计划完成'],
  ['actualStartDate', '实际开始'],
  ['actualEndDate', '实际完成'],
]) {
  assert.match(projectSpaceSource, new RegExp(`(?:${label}[时间]*[\\s\\S]{0,180}${field}|${field}[\\s\\S]{0,180}${label}[时间]*)`), `plan views must retain the ${label} label and ${field} binding`)
}
assert.match(projectSpaceSource, /<DatePicker[\s\S]{0,420}planStartDate/, 'plan views must retain planned-date editing')
assert.match(projectSpaceSource, /<ClickToEditDate[\s\S]{0,420}actualStartDate/, 'plan views must retain actual-date editing')
assert.match(planWorkspace, /renderHorizontalTable|renderTaskTable|renderGanttChart/, 'project plan workspace must retain its date-capable plan renderers')

console.log('project surfaces visual refresh contract passed')
