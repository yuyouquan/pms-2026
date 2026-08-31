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
const basicInfoPresentationPath = 'src/lib/projectBasicInfoPresentation.ts'
const basicInfoPresentationSource = readSource(root, basicInfoPresentationPath)
const workspaceSource = readSource(root, 'src/components/workspace/WorkspaceModule.tsx')
const projectSummarySource = readSource(root, 'src/components/project-summary/ProjectSummaryTable.tsx')
const projectInfoModalSource = readSource(root, 'src/components/project-info/ProjectInfoModal.tsx')
const projectInformationFrameSource = readSource(root, 'src/components/project-info/ProjectInformationFrame.tsx')
const globalStylesSource = readSource(root, 'src/styles/globals.css')

for (const [surfaceName, source, scopeClass] of [
  ['project card view', workspaceSource, 'pms-project-card-surface'],
  ['project summary table', projectSummarySource, 'pms-project-summary-surface'],
  ['project add/edit modal', projectInfoModalSource, 'pms-project-info-modal-surface'],
  ['project-space information', projectInformationFrameSource, 'pms-project-information-surface'],
]) {
  assert.match(
    source,
    new RegExp(`className=[\\s\\S]{0,220}${scopeClass}`),
    `${surfaceName} must expose the stable ${scopeClass} visual scope`,
  )
  assert.match(
    globalStylesSource,
    new RegExp(`\\.${scopeClass}(?:[\\s\\n,{.:]|$)`),
    `${surfaceName} visual scope must be styled centrally`,
  )
}

for (const token of [
  '--pms-project-surface',
  '--pms-project-group-header',
  '--pms-project-surface-border',
  '--pms-project-surface-radius',
  '--pms-project-surface-shadow',
  '--pms-project-compact-space',
  '--pms-project-hover',
  '--pms-project-selected',
  '--pms-project-focus-ring',
  '--pms-project-transition',
]) {
  assert.match(
    globalStylesSource,
    new RegExp(`${token}\\s*:`),
    `shared project-surface token ${token} must be defined`,
  )
}

assert.match(
  globalStylesSource,
  /\.pms-project-(?:card|summary|info|information)[^,{]*:focus-visible[^{]*\{[\s\S]{0,240}(?:outline|box-shadow):\s*var\(--pms-project-focus-ring\)/,
  'project surfaces must expose a visible shared focus-visible treatment',
)
assert.match(
  globalStylesSource,
  /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.pms-project-(?:card|summary|info|information)[\s\S]{0,600}?transition:\s*none\s*!important/,
  'project surfaces must disable visual transitions when reduced motion is requested',
)
assert.match(
  globalStylesSource,
  /\.pms-project-info-modal-surface\s+\.ant-modal-footer\s*\{(?=[^}]*position:\s*sticky)(?=[^}]*bottom:\s*0(?:px)?\s*;)(?=[^}]*z-index:\s*[1-9]\d*\s*;)[^}]*\}/,
  'project add/edit modal footer must remain a stable sticky bottom action area',
)

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
  technicalProjectModule.INITIAL_TECHNICAL_SUBPROJECTS.length > 0,
  true,
  'technical subproject seed data must be non-empty',
)
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
    /['"]technical-subproject['"]/,
    `${surfaceName} must retain an explicit technical-subproject projection mode`,
  )
  assert.match(
    source,
    /data-technical-plan-header=['"]single-row['"]/,
    `${surfaceName} must expose the observable single-row subproject header`,
  )
  assert.match(
    source,
    /data-technical-plan-header=['"]grouped['"]/,
    `${surfaceName} must preserve an observable grouped-header path for standard plans`,
  )
}

assert.notEqual(
  basicInfoPresentationSource,
  '',
  'project basic-information summary presentation helper is missing',
)
const basicInfoPresentation = loadTypeScriptModule(root, basicInfoPresentationPath)
assert.equal(
  typeof basicInfoPresentation.shouldShowLatestPublishedLevel1Summary,
  'function',
  'project basic-information presentation must export shouldShowLatestPublishedLevel1Summary',
)
for (const projectType of ['整机-手机', '整机产品-手机', 'tOS版本项目']) {
  assert.equal(
    basicInfoPresentation.shouldShowLatestPublishedLevel1Summary(projectType),
    false,
    `${projectType} basic information must hide the latest-published L1 date summary`,
  )
}
for (const projectType of ['技术项目', '能力建设项目']) {
  assert.equal(
    basicInfoPresentation.shouldShowLatestPublishedLevel1Summary(projectType),
    true,
    `${projectType} must retain its existing basic-information summary decision`,
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
  assert.match(
    source,
    /shouldShowLatestPublishedLevel1Summary\([^)]*\)\s*(?:&&|\?)[\s\S]{0,500}renderLatestPublishedLevel1Summary\(/,
    `${surfaceName} must guard the reusable date-summary renderer with the pure presentation decision`,
  )
}

const ganttColumnProjection = sliceBetween(
  projectSpaceSource,
  'const ganttColumns = useMemo',
  'const applyColumnSettings =',
  'Gantt column projection',
)
const ganttRenderer = sliceBetween(
  projectSpaceSource,
  'const renderGanttChart = (customTasks?: any[]) =>',
  '// ═══════ renderTaskTable ═══════',
  'Gantt renderer',
)
const taskTableRenderer = sliceBetween(
  projectSpaceSource,
  'const renderTaskTable = (customTasks?: any[]) =>',
  '// ═══════ renderHorizontalTable ═══════',
  'task-table renderer',
)
const horizontalTableRenderer = sliceBetween(
  projectSpaceSource,
  'const renderHorizontalTable = (surface: Level1HorizontalSurface) =>',
  '// ═══════ renderActionButtons ═══════',
  'horizontal-table renderer',
)
for (const [field, label] of [
  ['planStartDate', '计划开始'],
  ['planEndDate', '计划完成'],
  ['actualStartDate', '实际开始'],
  ['actualEndDate', '实际完成'],
]) {
  assert.match(
    taskTableRenderer,
    new RegExp(`title:\\s*['"]${label}[时间]*['"][^\\n]{0,180}(?:dataIndex|key):\\s*['"]${field}['"]`),
    `the actual task-table renderer must retain the ${label} ${field} column`,
  )
}
assert.match(taskTableRenderer, /<DatePicker[\s\S]{0,420}planStartDate/, 'task-table renderer must retain planned-date editing')
assert.match(taskTableRenderer, /<ClickToEditDate[\s\S]{0,420}actualStartDate/, 'task-table renderer must retain actual-date editing')
assert.match(horizontalTableRenderer, /ClickToEditDate[\s\S]{0,260}planEndDate/, 'horizontal plan renderer must retain planned-completion editing')
assert.match(horizontalTableRenderer, /ClickToEditDate[\s\S]{0,260}actualEndDate/, 'horizontal plan renderer must retain actual-completion editing')
assert.match(ganttColumnProjection, /planStartDate:[\s\S]{0,160}label:\s*['"]计划开始['"]/, 'Gantt columns must retain planned-start dates')
assert.match(ganttColumnProjection, /planEndDate:[\s\S]{0,160}label:\s*['"]计划完成['"]/, 'Gantt columns must retain planned-completion dates')
assert.match(ganttRenderer, /<DHTMLXGantt[\s\S]{0,260}columns=\{ganttColumns\}/, 'Gantt renderer must consume the date-capable columns')
assert.match(ganttRenderer, /onTaskDateChange=\{change =>/, 'Gantt renderer must retain date editing callbacks')

console.log('project surfaces visual refresh contract passed')
