import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { loadTypeScriptModule } from './lib/source-contract.mjs'

const root = process.cwd()
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')

const uiRules = loadTypeScriptModule(root, 'src/lib/projectManagementUi.ts')
const formal = { id: 'formal', name: '正式', type: '整机产品项目', projectAttribute: 'formal' }
const legacyFormal = { id: 'legacy', name: '历史正式', type: '技术项目' }
const budget = { id: 'budget', name: '预算', type: '整机产品项目', projectAttribute: 'budget' }
assert.deepEqual(
  uiRules.filterFormalRegistryProjects([formal, budget, legacyFormal]).map(project => project.id),
  ['formal', 'legacy'],
  'formal-only projections include normalized legacy formal projects and exclude budgets',
)
assert.equal(uiRules.normalizeConfigurationCellValue('  新名称  '), '新名称')
assert.equal(uiRules.normalizeConfigurationCellValue(null), '')
assert.equal(uiRules.shouldConfirmConfigurationChange(' 原值 ', '原值'), false)
assert.equal(uiRules.shouldConfirmConfigurationChange('原值', '新值'), true)
const historyRows = uiRules.buildProjectRegistryHistoryRows([
  {
    id: 'created', projectId: 'budget', action: 'create', actor: '演示用户01', timestamp: '2026-09-11T00:00:00.000Z',
    before: null, after: { ...budget, createdBy: '演示用户01', createdAt: '2026-09-11T00:00:00.000Z', responsiblePersons: ['演示用户02'], projectCode: '' },
    changes: [{ field: 'id', before: null, after: 'budget' }, { field: 'healthStatus', before: null, after: 'normal' }],
  },
  {
    id: 'updated', projectId: 'budget', action: 'update', actor: '演示用户01', timestamp: '2026-09-11T00:01:00.000Z', before: budget, after: budget,
    changes: [{ field: 'projectAttribute', before: 'budget', after: 'roadmap' }, { field: 'fieldValues', before: { spm: ['演示用户02'] }, after: { spm: ['演示用户07'] } }],
  },
], [formal, budget])
assert.equal(historyRows.length, 3)
assert.deepEqual(historyRows.slice(0, 2).map(row => [row.field, row.before, row.after]), [
  ['项目属性', '预算项目', '路标项目'],
  ['SPM', '演示用户02', '演示用户07'],
])
assert.equal(historyRows[2].field, '项目档案', 'history is reverse chronological')
assert.match(historyRows[2].after, /名称：预算/)
assert.doesNotMatch(historyRows[2].after, /healthStatus|normal|\"id\"/)

const { useUiStore } = loadTypeScriptModule(root, 'src/stores/ui.ts')
useUiStore.setState({
  activeModule: 'workbench',
  projectManagementTab: 'view',
  projectSpaceOrigin: null,
})
useUiStore.getState().openProjectConfiguration()
assert.equal(useUiStore.getState().activeModule, 'projectManagement')
assert.equal(useUiStore.getState().projectManagementTab, 'configuration')
useUiStore.getState().setProjectManagementTab('view')
useUiStore.getState().enterProjectSpace({ module: 'projectManagement', projectManagementTab: 'view' })
useUiStore.getState().setProjectManagementTab('configuration')
useUiStore.getState().returnFromProjectSpace()
assert.equal(useUiStore.getState().activeModule, 'projectManagement')
assert.equal(useUiStore.getState().projectManagementTab, 'view', 'return restores the originating project-management tab')

const page = read('src/app/page.tsx')
const header = read('src/containers/AppShell.tsx')
const management = read('src/containers/ProjectManagementContainer.tsx')
const configuration = read('src/components/project-management/ProjectConfiguration.tsx')
const creation = read('src/components/project-management/NewProjectModal.tsx')
const projectList = read('src/containers/ProjectListContainer.tsx')
const projectSummary = read('src/components/project-summary/ProjectSummaryTable.tsx')
const accessBoundary = read('src/components/permission/ProjectSpaceAccessBoundary.tsx')
const joint = read('src/components/joint/JointMrVersionPlan.tsx')

assert.match(page, /activeModule === 'projectManagement' && <ProjectManagementContainer/)
assert.doesNotMatch(page, /activeModule === 'projectList'/, 'obsolete standalone project-list route is removed')
const expectedHeaderOrder = /key:\s*['"]workbench['"],\s*label:\s*['"]工作台['"][\s\S]*?key:\s*['"]projectManagement['"],\s*label:\s*['"]项目管理['"][\s\S]*?key:\s*['"]jointProjectSpace['"],\s*label:\s*['"]项目组合管理['"][\s\S]*?key:\s*['"]roadmap['"],\s*label:\s*['"]tOS路标['"][\s\S]*?key:\s*['"]hrPipeline['"],\s*label:\s*['"]人力资源管道['"][\s\S]*?key:\s*['"]config['"],\s*label:\s*['"]配置中心['"]/
assert.match(header, expectedHeaderOrder)
assert.doesNotMatch(header, /key:\s*['"]projectList['"]/, 'standalone project-list nav item is removed')
assert.match(header, /返回项目管理/)

assert.match(management, /key:\s*['"]configuration['"],\s*label:\s*['"]项目配置['"]/)
assert.match(management, /key:\s*['"]view['"],\s*label:\s*['"]项目视图['"]/)
assert.match(management, /<ProjectConfiguration/)
assert.match(management, /<ProjectListContainer/)

for (const label of ['项目名称', '项目类型', '项目属性', '项目编码', '创建人', '创建时间', '绑定正式项目', '操作']) {
  assert.match(configuration, new RegExp(`title:\\s*['"]${label}['"]`), `configuration table contains ${label}`)
}
assert.match(configuration, /updateConfiguredProject/)
assert.match(configuration, /deleteConfiguredProject/)
assert.match(configuration, /getBindableFormalProjects/)
assert.match(configuration, /getLinkedRegistryProjects/)
assert.match(configuration, /canManageProjectRegistry/)
assert.match(configuration, /confirmingRef/)
assert.match(configuration, /shouldConfirmConfigurationChange/)
assert.equal((configuration.match(/pms-project-config__editable-value/g) ?? []).length, 2, 'code and binding values are direct edit affordances')
assert.match(configuration, /navigateWithEditGuard\(\(\) => \{[\s\S]*?activateProject\(project\)[\s\S]*?enterProjectSpace\(/, 'configuration entry uses the shared edit guard')
assert.match(configuration, /enterProjectSpace\(\{\s*module:\s*['"]projectManagement['"],\s*projectManagementTab:\s*['"]configuration['"]\s*\}\)/)

for (const label of ['项目属性', '项目名称', '项目类型', '责任人']) {
  assert.match(creation, new RegExp(`label=['"]${label}['"]`), `creation modal contains ${label}`)
}
assert.match(creation, /title=['"]新增项目['"]/)
assert.match(creation, /createConfiguredProject/)
assert.match(creation, /EXTERNAL_PROJECT_POOL/)
assert.match(creation, /ALL_USERS/)
assert.doesNotMatch(creation, /项目编码|安卓版本|里程碑|产品线|品牌/, 'minimal creation stays limited to four fields')

assert.match(projectList, /filterFormalRegistryProjects\(projects\)/, 'all project-list modes share a formal-only base')
assert.match(projectList, /controlledTablePage=\{projectListTablePage\}/, 'project list controls table pagination across project-space round trips')
assert.match(projectSummary, /controlledTablePage\?: number/, 'summary tables support session-owned pagination')
assert.doesNotMatch(projectList, /AddProjectModal|addProjectOpen|setAddProjectOpen/, 'old project-list creation modal is removed')
assert.match(projectList, /const openProjectFromList[\s\S]*?navigateWithEditGuard\(\(\) => \{/, 'project-list entries use the shared edit guard')
assert.match(projectList, /onOpenProject=\{openProjectFromList\}/, 'project cards delegate their complete navigation action to the guarded handler')
assert.match(projectList, /onViewProject=\{\(projectId\) => \{[\s\S]*?openProjectFromList\(project\)[\s\S]*?\}\}/, 'project table delegates navigation to the guarded handler')
assert.match(projectList, /module:\s*['"]projectManagement['"],\s*projectManagementTab:\s*['"]view['"]/, 'project-list entries preserve their tab origin')
assert.match(joint, /filterFormalRegistryProjects\(projectState\.projects\)/, 'imperative joint source filters the live project store')
assert.match(joint, /filterFormalRegistryProjects\(projects\)/, 'rendered joint source filters the subscribed project store')
assert.match(accessBoundary, /returnFromProjectSpace\(\)/, 'denied project-space entry returns through the recorded origin')
assert.doesNotMatch(accessBoundary, /setProjectManagementTab|setActiveModule/, 'denied project-space entry does not overwrite the recorded origin')

console.log('Project management navigation and UI contract passed')
