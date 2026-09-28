import assert from 'node:assert/strict'
import path from 'node:path'
import { loadTypeScriptModule } from './lib/typescript-module-loader.mjs'
const load = file => loadTypeScriptModule(path.resolve(file))
const { createEmptyMenuPolicy, evaluateMenuPermission } = load('src/lib/permissionCenter.ts')
const { getPermissionFields } = load('src/constants/permissionCenter.ts')
const { registerProjectPermissionFields, projectPermissionSource, projectSummaryRows, projectMenuRows, canReadProjectRegistryHistory, canReadProjectClassification, matchesAuthorizedProjectClassification } = load('src/lib/projectMenuPermissions.ts')
const { usePermissionStore } = load('src/stores/permission.ts')
const { useProjectStore } = load('src/stores/project.ts')
const { canUseProjectRegistry, canChangeRegistryFields, getAllowedRegistryTypes } = load('src/lib/projectRegistryAuthorization.ts')
const { updateConfiguredProject, deleteConfiguredProject } = load('src/lib/projectRegistry.ts')
const { buildProjectSummaryRow, getProjectListFieldDefinitions, getTemplateTaskFieldDefinitions } = load('src/lib/projectSummary.ts')
const tasks = [{ id: 'phase', taskName: '阶段' }, { id: 'gate', parentId: 'phase', taskName: '验收', planEndDate: '2026-09-28' }]
registerProjectPermissionFields({ 整机产品项目: tasks })
assert.equal(getPermissionFields('project.view').find(f => f.key === 'name').required, true)
assert.equal(getPermissionFields('project.view').find(f => f.key === 'status').kind, 'enum')
assert(getPermissionFields('project.view').some(f => f.key === 'templateTask::整机产品项目::gate'))
const role = id => ({ id, groupId: 'g', name: id, description: '', members: [] })
const model = { version: 1, groups: [{ id: 'g', name: 'G' }], roles: [role('a'), role('b'), role('config')], policies: [] }
const grant = (roleId, menuId, actions, brand, fields) => ({ ...createEmptyMenuPolicy(roleId, menuId), users: ['reader'], actions, data: { mode: 'conditions', conjunction: 'all', conditions: [{ id: 'brand', field: 'brand', operator: 'eq', value: brand }] }, columns: { mode: 'selected', fields: ['name', ...fields] } })
model.policies = [grant('a', 'project.view', ['view', 'export'], '示例品牌A', ['status']), grant('b', 'project.view', ['view'], '示例品牌B', ['brand', 'code'])]
const definitions = [...getProjectListFieldDefinitions('machine', tasks, '整机产品项目'), ...getTemplateTaskFieldDefinitions('整机产品项目', tasks)]
const projects = [
  { id: 'a', type: '整机产品项目', name: 'A', status: '进行中', projectCode: 'secret-A', brand: '示例品牌A', fieldValues: { brand: '示例品牌A', machineSpm: ['secret person'] } },
  { id: 'b', type: '整机产品项目', name: 'B', status: '进行中', projectCode: 'B-code', brand: '示例品牌B', fieldValues: { brand: '示例品牌B' } },
  { id: 'c', type: '整机产品项目', name: 'C', status: '进行中', brand: '示例品牌C' },
]
const sourceMap = new Map(projects.map(project => [project.id, projectPermissionSource(project, definitions, tasks)]))
const rows = projects.map(project => ({ ...buildProjectSummaryRow(project, definitions, tasks), status: project.status, projectCode: project.projectCode }))
const viewed = projectSummaryRows(model, 'reader', rows, sourceMap)
assert.deepEqual(viewed.map(row => row.projectName), ['A', 'B'])
assert.equal(viewed[0].brand, undefined)
assert.equal(viewed[0].projectCode, undefined)
assert.equal(viewed[0].fieldValues, undefined)
assert.equal(viewed[1].status, undefined)
assert.equal(viewed[1].projectCode, 'B-code')
const exported = projectSummaryRows(model, 'reader', rows, sourceMap, 'export')
assert.equal(exported.length, 1)
assert.equal(exported[0].projectName, 'A')
assert.equal(exported[0].brand, undefined)
assert.equal(projectSummaryRows(model, 'outsider', rows, sourceMap).length, 0)
const dated = grant('a', 'project.view', ['view'], '示例品牌A', ['templateTask::整机产品项目::gate'])
dated.data.conditions = [{ id: 'gate', field: 'templateTask::整机产品项目::gate', operator: 'gte', value: '2026-09-28' }]
assert.equal(evaluateMenuPermission({ ...model, policies: [dated] }, 'reader', 'project.view', 'view', sourceMap.get('a')), true)
const config = grant('config', 'project.config', ['view', 'edit', 'delete', 'create', 'export'], '示例品牌A', ['code'])
const configModel = { ...model, policies: [config] }
usePermissionStore.setState({ permissionCenter: configModel })
assert.equal(canUseProjectRegistry('reader', 'edit', projects[0]), true)
assert.equal(canUseProjectRegistry('reader', 'edit', projects[1]), false)
assert.equal(canChangeRegistryFields('reader', projects[0], { ...projects[0], name: 'renamed' }), true)
assert.equal(canChangeRegistryFields('reader', projects[0], { ...projects[0], status: '上市' }), false)
assert.equal(canChangeRegistryFields('reader', projects[0], { ...projects[0], brand: '示例品牌B', fieldValues: { brand: '示例品牌B' } }), false)
assert(getAllowedRegistryTypes('reader', 'formal').includes('整机产品项目'), 'Form entry must allow feasible brand-scoped sources')
const configurationRows = projectMenuRows(configModel, 'reader', 'project.config', projects, 'export')
assert.equal(configurationRows.length, 1)
assert.equal(configurationRows[0].name, 'A')
assert.equal(configurationRows[0].brand, undefined)
assert.equal(configurationRows[0].type, undefined)
const seed = useProjectStore.getState().projects.find(project => project.projectAttribute === 'budget')
assert(seed)
const record = { ...seed, id: 'permission-test', name: 'permission-test', brand: '示例品牌A', fieldValues: { ...seed.fieldValues, brand: '示例品牌A' }, boundFormalProjectId: null }
useProjectStore.setState({ projects: [record], currentLoginUser: 'reader', registryHistory: [] })
assert.equal(updateConfiguredProject(record.id, { name: 'permission-edited' }, 'reader').ok, true, 'Explicit config grant must replace fixed-manager rule')
assert.equal(useProjectStore.getState().projects[0].name, 'permission-edited')
usePermissionStore.setState({ permissionCenter: { ...configModel, policies: [] } })
assert.equal(updateConfiguredProject(record.id, { name: 'blocked' }, 'reader').ok, false)
assert.equal(useProjectStore.getState().updateProject(record.id, { name: 'blocked' }, 'reader', { registryOperation: 'update' }), null)
assert.equal(deleteConfiguredProject(record.id, 'reader').ok, false)
assert.equal(useProjectStore.getState().deleteProject(record.id, 'reader'), false)
assert.equal(canUseProjectRegistry('游进', 'create', { type: '整机产品项目', projectAttribute: 'budget' }), false, 'Historic fixed manager must be revocable')
assert.equal(projectSummaryRows({ ...model, policies: [] }, 'reader', rows, sourceMap).length, 0)
console.log('Project permission row/field/export/dynamic-task/registry-mutation/revocation checks passed')

// A full-field grant for the current row cannot unlock another scope's historical fields.
const historyModel = { ...model, policies: [
  { ...grant('a', 'project.config', ['view'], '示例品牌A', []), columns: { mode: 'all', fields: [] } },
  grant('b', 'project.config', ['view'], '示例品牌B', []),
] }
const currentHistoryProject = { ...projects[0], id: 'historical-project' }
const limitedSnapshot = { ...projects[1], id: currentHistoryProject.id, projectCode: 'restricted-history-code', responsiblePersons: ['restricted-history-person'] }
const historyEntry = { projectId: currentHistoryProject.id, before: limitedSnapshot, after: currentHistoryProject, changes: [{ field: 'projectCode', before: 'restricted-history-code', after: 'current-code' }] }
assert.equal(evaluateMenuPermission(historyModel, 'reader', 'project.config', 'view', projectPermissionSource(limitedSnapshot)), true, 'Limited snapshot is viewable but its full history is not')
assert.equal(canReadProjectRegistryHistory(historyModel, 'reader', currentHistoryProject, historyEntry), false, 'Current full-field grant must not unlock limited historical snapshots')
assert.equal(canReadProjectRegistryHistory(historyModel, 'reader', currentHistoryProject, { ...historyEntry, before: currentHistoryProject, after: limitedSnapshot }), false, 'Both before and after need their own full-field grants')
assert.equal(canReadProjectRegistryHistory(historyModel, 'reader', currentHistoryProject, { ...historyEntry, before: null, after: limitedSnapshot, notification: { body: 'restricted-history-code', recipients: ['restricted-history-person'] } }), false, 'Creation notification is hidden with its restricted historical snapshot')
assert.equal(canReadProjectRegistryHistory(historyModel, 'reader', currentHistoryProject, { ...historyEntry, before: null, after: currentHistoryProject }), true, 'Authorized creation history stays available')
assert.equal(canReadProjectRegistryHistory(historyModel, 'reader', currentHistoryProject, { ...historyEntry, before: currentHistoryProject, after: null }), true, 'Null side of deletion history does not remove authorized history')
assert.equal(canReadProjectRegistryHistory(historyModel, 'reader', currentHistoryProject, { ...historyEntry, before: null, after: null }), false, 'Snapshot-free prose fails closed')
const allHistoryFieldsModel = { ...historyModel, policies: historyModel.policies.map(policy => ({ ...policy, columns: { mode: 'all', fields: [] } })) }
assert.equal(canReadProjectRegistryHistory(allHistoryFieldsModel, 'reader', currentHistoryProject, historyEntry), true, 'Independently authorized historical scopes remain readable')
assert.equal(canReadProjectRegistryHistory(historyModel, 'reader', limitedSnapshot, { ...historyEntry, before: currentHistoryProject, after: currentHistoryProject }), false, 'Current project full-field guard remains required')
console.log('Project registry historical snapshot field-isolation checks passed')

// Hidden classification values must not appear through counts or filter membership.
const { countProjectsByCategory } = load('src/lib/projectListFilters.ts')
const classificationRows = [
  { id: 'machine', type: '整机产品项目', name: 'Machine', secondaryCategory: '整机-手机' },
  { id: 'tos', type: 'tOS版本项目', name: 'TOS' },
]
const nameOnlyPolicy = { ...createEmptyMenuPolicy('a', 'project.view'), users: ['reader'], actions: ['view'], columns: { mode: 'selected', fields: ['name'] } }
const nameOnlyModel = { ...model, policies: [nameOnlyPolicy] }
const classificationMatches = (activeModel, row, category, secondary = 'all') => matchesAuthorizedProjectClassification(activeModel, 'reader', projectPermissionSource(row), category, secondary)
const classificationCounts = activeModel => countProjectsByCategory(classificationRows, ['整机产品项目', 'tOS版本项目'], (row, category) => classificationMatches(activeModel, row, category))
assert.equal(canReadProjectClassification(nameOnlyModel, 'reader', projectPermissionSource(classificationRows[0])), false)
assert.deepEqual(classificationCounts(nameOnlyModel), { '整机产品项目': 0, 'tOS版本项目': 0 }, 'Hidden types must not contribute to category counts')
assert.equal(classificationRows.filter(row => classificationMatches(nameOnlyModel, row, 'all')).length, 2, 'Generic all-project view retains authorized identities without classifying them')
assert.equal(classificationRows.filter(row => classificationMatches(nameOnlyModel, row, '整机产品项目')).length, 0, 'Category selection cannot reveal hidden type membership')
const typedModel = { ...nameOnlyModel, policies: [{ ...nameOnlyPolicy, columns: { mode: 'selected', fields: ['name', 'type'] } }] }
assert.deepEqual(classificationCounts(typedModel), { '整机产品项目': 1, 'tOS版本项目': 1 }, 'Permitted type counts remain available')
assert.equal(classificationMatches(typedModel, classificationRows[0], '整机产品项目', '整机-手机'), false, 'Hidden secondary type cannot affect a filtered result or option')
const secondaryModel = { ...nameOnlyModel, policies: [{ ...nameOnlyPolicy, columns: { mode: 'selected', fields: ['name', 'type', 'secondaryCategory'] } }] }
assert.equal(classificationMatches(secondaryModel, classificationRows[0], '整机产品项目', '整机-手机'), true, 'Explicit secondary type grant enables the real filter')
console.log('Project classification count/filter field-isolation checks passed')
