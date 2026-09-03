#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot, readSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const matrix = loadTypeScriptModule(root, 'src/lib/projectListMatrix.ts')
const projectStatus = loadTypeScriptModule(root, 'src/lib/projectStatus.ts')
const enumStore = loadTypeScriptModule(root, 'src/stores/enums.ts')
const enumValues = loadTypeScriptModule(root, 'src/lib/enumValues.ts')
const projectStore = loadTypeScriptModule(root, 'src/stores/project.ts')
const projectSeedSource = readSource(root, 'src/data/projects.ts')
const projectListContainerSource = readSource(root, 'src/containers/ProjectListContainer.tsx')

assert.deepEqual(projectStatus.getActiveProjectStatuses('整机产品项目'), ['待立项', '在研', '上市', 'EOS', '转维', '已取消', '已暂停'])
assert.deepEqual(projectStatus.getActiveProjectStatuses('tOS版本项目'), ['在研', '已完成'])
assert.deepEqual(projectStatus.getActiveProjectStatuses('能力建设项目'), ['在研', '已完成'])
assert.deepEqual(projectStatus.getActiveProjectStatuses('技术项目'), ['进行中', '已完成', '暂停', '已取消'])
assert.equal(projectStatus.normalizeLegacyProjectStatus('整机产品项目', '暂停'), '已暂停')
assert.equal(projectStatus.normalizeLegacyProjectStatus('整机产品项目', '规划中'), '待立项')
assert.equal(projectStatus.normalizeLegacyProjectStatus('技术项目', '已迁移'), '已完成')
assert.equal(projectStatus.normalizeLegacyProjectStatus('技术项目', '在研'), '进行中')
for (const [type, mappings] of Object.entries({
  整机产品项目: {
    暂停: '已暂停', 规划中: '待立项', 筹备中: '待立项', 进行中: '在研',
    已上市: '上市', 已完成: '转维', 维护: '转维', 维护期: '转维', 已迁移: '转维',
  },
  技术项目: {
    待立项: '进行中', 待立议: '进行中', 规划中: '进行中', 筹备中: '进行中', 在研: '进行中',
    上市: '已完成', 已上市: '已完成', 转维: '已完成', 维护: '已完成', 维护期: '已完成', EOS: '已完成', 已迁移: '已完成',
  },
})) {
  for (const [legacy, active] of Object.entries(mappings)) {
    assert.equal(projectStatus.normalizeLegacyProjectStatus(type, legacy), active, `${type} ${legacy} must migrate to ${active}`)
  }
}
for (const type of ['整机产品项目', '技术项目', 'tOS版本项目', '能力建设项目']) {
  assert.ok(
    projectStatus.getActiveProjectStatuses(type).includes(projectStatus.normalizeLegacyProjectStatus(type, '未知旧状态')),
    `${type} unknown persisted status must fall back into its active catalog`,
  )
}
const legacyEnumRows = enumValues.createInitialEnumRows()
legacyEnumRows['machine-project-status'] = [
  { id: 'legacy-machine-planning', value: '规划中' },
  { id: 'legacy-machine-paused', value: '暂停' },
]
legacyEnumRows['technical-project-status'] = [{ id: 'legacy-tech-migrated', value: '已迁移' }]
legacyEnumRows['tos-capability-project-status'] = [{ id: 'legacy-tos-cancelled', value: '已取消' }]
const migratedEnumRows = enumStore.migrateEnumState({ rowsByType: legacyEnumRows }, 3).rowsByType
for (const [enumType, projectType] of [
  ['machine-project-status', '整机产品项目'],
  ['technical-project-status', '技术项目'],
  ['tos-capability-project-status', 'tOS版本项目'],
]) {
  assert.deepEqual(
    migratedEnumRows[enumType].map(row => row.value),
    projectStatus.getActiveProjectStatuses(projectType),
    `v3 ${enumType} cache must migrate to the exact active catalog`,
  )
  assert.equal(new Set(migratedEnumRows[enumType].map(row => row.id)).size, migratedEnumRows[enumType].length, `${enumType} migrated ids stay unique`)
}
const legacyProjectStatuses = [
  ['machine-maintenance', '整机产品项目', '维护'],
  ['machine-complete', '整机产品项目', '已完成'],
  ['machine-unknown', '整机产品项目', '未知旧状态'],
  ['tech-proposed', '技术项目', '待立议'],
  ['tech-migrated', '技术项目', '已迁移'],
  ['tech-unknown', '技术项目', '未知旧状态'],
  ['tos-cancelled', 'tOS版本项目', '已取消'],
  ['capability-unknown', '能力建设项目', '未知旧状态'],
].map(([id, type, status]) => ({ id, name: id, type, status }))
const migratedProjects = projectStore.migrateProjectState({ projects: legacyProjectStatuses, projectListView: 'list' }, 8).projects
for (const project of migratedProjects.filter(project => legacyProjectStatuses.some(legacy => legacy.id === project.id))) {
  assert.ok(projectStatus.getActiveProjectStatuses(project.type).includes(project.status), `${project.id} must migrate into its active catalog`)
}
assert.match(projectListContainerSource, /useSingleEnumOptions\(\s*statusEnumType,\s*\[\]/)
for (const retiredStatus of ["status: '规划中'", "status: '筹备中'", "status: '已迁移'"]) {
  assert.doesNotMatch(projectSeedSource, new RegExp(retiredStatus), `project mocks must not keep retired status ${retiredStatus}`)
}
assert.equal(typeof matrix.getProjectListMatrix, 'function', 'missing getProjectListMatrix')
assert.equal(typeof matrix.buildGroupedMilestoneColumns, 'function', 'missing grouped milestone builder')
assert.equal(typeof matrix.buildTechnicalProjectListRows, 'function', 'missing technical row builder')
assert.equal(typeof matrix.isOverdueProjectListDate, 'function', 'missing overdue date helper')
assert.equal(typeof matrix.selectLatestPublishedScopedSnapshot, 'function', 'missing strict scoped published selector')
assert.equal(typeof matrix.buildStableGroupSegments, 'function', 'missing stable group segment builder')
assert.equal(typeof matrix.resolveTechnicalProjectType, 'function', 'missing technical type resolver')
assert.equal(typeof matrix.getProjectListFixedColumnKeys, 'function', 'missing project-list fixed-column resolver')
assert.deepEqual(matrix.PROJECT_LIST_CATEGORIES, ['整机产品项目', 'tOS版本项目', '技术项目', '能力建设项目'])
assert.deepEqual(matrix.PROJECT_LIST_QUICK_FILTERS.machine.map(item => item.label), ['项目名称', '首销tOS版本', '芯片编码', '研发模式'])
assert.deepEqual(matrix.PROJECT_LIST_QUICK_FILTERS.tos.map(item => item.label), ['项目名称'])
assert.deepEqual(matrix.PROJECT_LIST_QUICK_FILTERS.technicalTdt.map(item => item.label), ['项目名称', '技术赛道', 'TMG及技术领域'])
assert.deepEqual(matrix.PROJECT_LIST_QUICK_FILTERS.technicalSubproject.map(item => item.label), ['子任务名称', '所属TDT项目名称'])
assert.deepEqual(matrix.TECHNICAL_PROJECT_TYPE_OPTIONS, [
  { label: 'TDT项目', value: 'tdt' },
  { label: '子项目', value: 'subproject' },
])
assert.equal(matrix.resolveTechnicalProjectType([]), 'tdt')
assert.equal(matrix.resolveTechnicalProjectType(['tdt']), 'tdt')
assert.equal(matrix.resolveTechnicalProjectType(['subproject']), 'subproject')
assert.deepEqual(matrix.getProjectListFixedColumnKeys('machine'), [])
assert.deepEqual(matrix.getProjectListFixedColumnKeys('tos'), ['tosVersion'])
assert.deepEqual(matrix.getProjectListFixedColumnKeys('technical-tdt'), [])
assert.deepEqual(matrix.getProjectListFixedColumnKeys('technical-subproject'), ['projectName'])
const seriesGroups = matrix.groupProjectListRows([
  { projectId: '1', productSeries: 'CAMON 50', projectName: 'A' },
  { projectId: '2', productSeries: 'P', projectName: 'B' },
  { projectId: '3', productSeries: 'CAMON 50', projectName: 'C' },
  { projectId: '4', productSeries: '-', projectName: 'D' },
], 'productSeries', '未配置产品系列')
assert.deepEqual(seriesGroups.map(group => [group.key, group.rows.map(row => row.projectId)]), [
  ['CAMON 50', ['1', '3']],
  ['P', ['2']],
  ['未配置产品系列', ['4']],
])
const hierarchyRows = [
  { key: '1', projectId: '1', brand: 'TECNO', productLine: 'CAMON', productSeries: 'CAMON 60' },
  { key: '3', projectId: '3', brand: 'TECNO', productLine: 'CAMON', productSeries: 'CAMON 70' },
  { key: '2', projectId: '2', brand: 'TECNO', productLine: 'CAMON', productSeries: 'CAMON 60' },
  { key: '4', projectId: '4', brand: 'Infinix', productLine: '-', productSeries: '' },
  { key: '5', projectId: '5', brand: 'Infinix', productLine: 'CAMON', productSeries: 'CAMON 60' },
]
const hierarchy = matrix.buildMachineProjectHierarchyPage(hierarchyRows, hierarchyRows, new Set())
assert.deepEqual(hierarchy.map(row => [
  row.projectId, row.__brandRowSpan, row.__productLineRowSpan,
  row.__productSeriesRowSpan, row.__productSeriesProjectCount,
]), [
  ['1', 3, 3, 2, 2],
  ['2', 0, 0, 0, 2],
  ['3', 0, 0, 1, 1],
  ['4', 2, 1, 1, 1],
  ['5', 0, 1, 1, 1],
])
assert.equal(hierarchy[3].__productLineLabel, '未配置产品线')
assert.equal(hierarchy[3].__productSeriesLabel, '未配置产品系列')
assert.notEqual(hierarchy[0].__productSeriesKey, hierarchy[4].__productSeriesKey, 'same series under a different brand must not merge')
const collapsed = matrix.buildMachineProjectHierarchyPage(
  hierarchyRows,
  hierarchyRows,
  new Set(['TECNO::CAMON::CAMON 60']),
)
assert.deepEqual(collapsed.map(row => row.projectId), ['1', '3', '4', '5'])
assert.equal(collapsed[0].__productSeriesProjectCount, 2)
const expected = {
  tos: ['tOS版本', '动态节点', '版本项目经理'],
  'technical-tdt': ['TDT项目名称', '子任务数', '技术赛道', 'TMG及技术领域', '子领域', '技术项目负责人', '技术项目经理', '质量代表', '产品代表', '标准化代表'],
  'technical-subproject': ['子任务名称', '所属TDT项目名称', '核心价值', '开发模式', '首导tOS', '首导整机产品', '项目阶段', '第1版转测', '第2版转测', '第X版转测', 'TDR3'],
}
for (const [variant, labels] of Object.entries(expected)) {
  const columns = matrix.getProjectListMatrix(variant, { milestones: ['动态节点'] })
  assert.deepEqual(columns.slice(0, labels.length).map(column => column.label), labels, `${variant} labels`)
  columns.slice(0, labels.length).forEach(column => assert.equal(column.reorderable, true))
}
const machineFieldLabels = [
  '品牌', '产品线', '产品系列', '项目数', '市场名', '项目名称', '项目状态', '下一个节点',
  '版本类型', '首销tOS版本', '当前tOS版本', '芯片编码', '芯片型号', '芯片平台',
  '研发模式', '开发模式', '产品类型', '软件项目等级', '健康状态', '是否首发项目',
  '升级策略', '系统类型', 'Kernel版本', '是否大版本升级', '机型分类', '禁止生产时间',
  '保密级别', '安卓版本', '目标市场', '内存大小', '起步RAM', '是否二段式',
  '是否外研Mini版本', 'JIRA项目', 'SPM', 'SPM部门（二级部门）',
]
const machineColumns = matrix.getProjectListMatrix('machine', {
  templateTasks: [
    { id: 'concept', taskName: '概念', order: 1 },
    { id: 'concept-start', parentId: 'concept', taskName: '概念启动', order: 1 },
    { id: 'str1', parentId: 'concept', taskName: 'STR1', order: 2 },
  ],
})
assert.deepEqual(
  machineColumns.map(column => column.label),
  [...machineFieldLabels, '概念启动', 'STR1'],
)
assert.ok(machineColumns.every(column => column.hideable && column.reorderable))
assert.deepEqual(
  machineColumns.filter(column => column.source !== 'templateTask' && column.defaultVisible).map(column => column.label),
  ['品牌', '产品线', '产品系列', '项目数', '市场名', '项目名称', '项目状态', '下一个节点', '版本类型', '首销tOS版本', '当前tOS版本', '芯片编码', '研发模式', '开发模式', '软件项目等级', 'SPM', 'SPM部门（二级部门）'],
)
const machineColumnsWithAliasedOptionalFields = matrix.getProjectListMatrix('machine', {
  templateTasks: machineColumns.filter(column => column.source === 'templateTask'),
  optionalFields: [
    { key: 'firstSaleTosVersion', label: '首销 tOS 版本' },
    { key: 'developmentMode', label: '开发模式' },
    { key: 'remark', label: '备注' },
  ],
})
assert.equal(machineColumnsWithAliasedOptionalFields.filter(column => column.key === 'firstSaleTosVersion').length, 1)
assert.equal(machineColumnsWithAliasedOptionalFields.find(column => column.key === 'firstSaleTosVersion')?.hideable, true)
assert.equal(machineColumnsWithAliasedOptionalFields.filter(column => column.key === 'developmentMode').length, 1)
assert.equal(machineColumnsWithAliasedOptionalFields.find(column => column.key === 'developmentMode')?.hideable, true)
assert.equal(machineColumnsWithAliasedOptionalFields.some(column => column.key === 'remark'), false, 'machine matrix is limited to the approved 37 field units')
assert.ok(matrix.getProjectListMatrix('machine', { milestones: ['最新一级模板节点'] }).some(column => column.label === '最新一级模板节点'), 'machine dynamic milestone column')
assert.ok(matrix.getProjectListMatrix('tos', { milestones: ['最新已发布一级模板节点'] }).some(column => column.label === '最新已发布一级模板节点'), 'tOS latest published L1 milestone column')
assert.deepEqual(
  matrix.getProjectListMatrix('tos', { milestones: ['STR1'] })
    .filter(column => column.source !== 'templateTask')
    .map(column => [column.label, column.defaultVisible, column.hideable]),
  [['tOS版本', true, true], ['版本项目经理', true, true]],
  'tOS list keeps only the three configurable units: tOS version, milestone and version project manager',
)
assert.deepEqual(
  matrix.getProjectListMatrix('tos', {
    milestones: ['STR1'],
    optionalFields: [{ key: 'firstProject', label: '首发项目' }],
  }).map(column => column.label),
  ['tOS版本', 'STR1', '版本项目经理'],
  'tOS list must not append project-space optional fields',
)
assert.ok(matrix.getProjectListMatrix('technical-tdt', { templateStages: ['阶段'], directLevel2Nodes: ['直属二级'] }).some(column => column.label === '直属二级'), 'TDT dynamic direct level-two column')
assert.deepEqual(matrix.getProjectListMatrix('capability', {}), [], 'capability list has no matrix columns')
const grouped = matrix.buildGroupedMilestoneColumns([
  { id: 'phase-a', taskName: '概念', order: 1 },
  { id: 'a-1', parentId: 'phase-a', taskName: '概念启动', order: 1 },
  { id: 'a-2', parentId: 'phase-a', taskName: 'STR1', order: 2 },
  { id: 'phase-b', taskName: '计划', order: 2 },
  { id: 'b-1', parentId: 'phase-b', taskName: 'STR2', order: 1 },
], 'machine')
assert.deepEqual(grouped.map(item => [item.label, item.group?.label]), [['概念启动', '概念'], ['STR1', '概念'], ['STR2', '计划']])
assert.ok(grouped.every(item => item.defaultVisible && item.hideable && item.reorderable))

const childMilestones = matrix.buildGroupedMilestoneColumns([
  { id: 'c1', taskName: '第1版转测', order: 1 },
  { id: 'c2', taskName: 'TDR3', order: 2 },
], 'technical-subproject')
assert.deepEqual(childMilestones.map(item => item.label), ['第1版转测', 'TDR3'])
assert.ok(childMilestones.every(item => item.group?.color === '#f2e8ff'))

const rows = matrix.buildTechnicalProjectListRows({
  projects: [{ id: '9', name: '端侧AI技术', type: '技术项目', status: '在研', technicalTrack: 'AI', tmg: '系统应用', subdomain: 'AIOS', technicalLead: '张三', technicalProjectManager: '李四' }],
  subprojects: [{ id: 'IPM-1', parentProjectId: '9', name: '子项目A', active: true, ipmOrder: 1, configuration: { coreValue: '追赶', developmentMode: '自研', firstTosVersion: '16.0', firstMachineProjectId: '1' } }],
  plansByKey: {
    '9:tdt': { planKey: '9:tdt', templateKind: 'tdt', currentVersionId: 'draft', versions: [
      { id: 'pub', versionNo: 'V1', templateType: 'tdt', status: '已发布', publishedAt: '2026-01-01', tasks: [{ id: 'phase', name: '规划阶段', parentId: null, order: 1, planStartDate: '2026-01-01', planEndDate: '2026-12-31' }, { id: 'node', name: '规划启动', parentId: 'phase', order: 1, planStartDate: '2026-01-01', planEndDate: '2026-02-01' }] },
      { id: 'draft', versionNo: 'V2', templateType: 'tdt', status: '修订中', tasks: [{ id: 'node', name: '规划启动', parentId: 'phase', order: 1, planEndDate: '2099-01-01' }] },
    ] },
    '9:subproject:IPM-1': { planKey: '9:subproject:IPM-1', templateKind: 'subproject', currentVersionId: 'cpub', versions: [{ id: 'cpub', versionNo: 'V1', templateType: 'subproject', status: '已发布', tasks: [{ id: 'c1', name: '第1版转测', parentId: null, order: 1, planEndDate: '2026-03-01' }] }] },
  },
  machineProjects: [{ id: '1', name: 'X6870' }],
  today: '2026-06-01',
})
assert.equal(rows.tdt[0]['milestone::规划启动'], '2026-02-01', 'latest published TDT date only')
assert.equal(rows.tdt[0].subprojectCount, 1)
assert.equal(rows.children[0].projectName, '子项目A')
assert.equal(rows.children[0].parentProjectName, '端侧AI技术')
assert.equal(rows.children[0].firstMachineProject, 'X6870')
assert.equal(rows.children[0]['milestone::第1版转测'], '2026-03-01')
assert.equal(rows.children[0].targetProjectId, '9')
assert.equal(rows.children[0].targetSubprojectId, 'IPM-1')
assert.equal(matrix.isOverdueProjectListDate('2026-05-31', '2026-06-01'), true)
assert.equal(matrix.isOverdueProjectListDate('2026-02-30', '2026-06-01'), false)

const scoped = matrix.selectLatestPublishedScopedSnapshot(
  [
    { id: 'v1.2', versionNo: 'V1.2', status: '已发布' },
    { id: 'v1.10', versionNo: 'V1.10', status: '已发布' },
    { id: 'v2', versionNo: 'V2', status: '修订中' },
  ],
  { 'scope::v1.2': [{ id: 'old' }], 'scope::v1.10': [{ id: 'latest' }], 'scope::v2': [{ id: 'draft' }] },
  versionId => `scope::${versionId}`,
)
assert.equal(scoped[0]?.id, 'latest', 'semantic latest published scoped snapshot')
assert.deepEqual(matrix.selectLatestPublishedScopedSnapshot(
  [{ id: 'v9', versionNo: 'V9', status: '已发布' }],
  { v9: [{ id: 'global-pollution' }] },
  versionId => `missing-project::${versionId}`,
), [], 'strict scope never falls back to a global snapshot')
assert.deepEqual(matrix.selectLatestPublishedScopedSnapshot(
  [{ id: 'v1', versionNo: 'V1', status: '已发布' }, { id: 'v2', versionNo: 'V2', status: '已发布' }],
  { 'scope::v1': [{ id: 'stale' }] },
  versionId => `scope::${versionId}`,
), [], 'missing latest snapshot never falls back to an older published version')

const semanticTechnical = matrix.buildTechnicalProjectListRows({
  projects: [{ id: 'semantic', name: '语义版本项目', type: '技术项目', status: '在研' }],
  subprojects: [],
  plansByKey: {
    'semantic:tdt': { planKey: 'semantic:tdt', templateKind: 'tdt', currentVersionId: 'draft', versions: [
      { id: 'v1.2', versionNo: 'V1.2', templateType: 'tdt', status: '已发布', tasks: [{ id: 'old', name: '旧阶段', parentId: null, order: 1, planStartDate: '2026-01-01', planEndDate: '2026-12-31' }] },
      { id: 'v1.10', versionNo: 'V1.10', templateType: 'tdt', status: '已发布', tasks: [
        { id: 'a', name: '阶段A', parentId: null, order: 1, planStartDate: '2026-01-01', planEndDate: '2026-08-01' },
        { id: 'b', name: '阶段B', parentId: null, order: 2, planStartDate: '2026-07-01', planEndDate: '2026-12-31' },
        { id: 'node', name: '最新节点', parentId: 'a', order: 1, planStartDate: '2026-01-01', planEndDate: '2026-07-31' },
      ] },
      { id: 'draft', versionNo: 'V2', templateType: 'tdt', status: '修订中', tasks: [{ id: 'draft-node', name: '草稿节点', parentId: null, order: 1, planStartDate: '2026-01-01', planEndDate: '2026-12-31' }] },
    ] },
  },
  today: '2026-07-15',
})
assert.equal(semanticTechnical.tdt[0].projectStage, '-', 'overlapping top-level phases have no inferred stage')
assert.equal(semanticTechnical.tdt[0]['milestone::最新节点'], '2026-07-31', 'V1.10 beats V1.2')
assert.equal(semanticTechnical.tdt[0]['milestone::草稿节点'], undefined, 'draft tasks never enter list rows')

const segments = matrix.buildStableGroupSegments([
  { key: 'a', group: { key: 'phase', label: '阶段', color: '#fff' } },
  { key: 'plain' },
  { key: 'b', group: { key: 'phase', label: '阶段', color: '#fff' } },
])
assert.deepEqual(segments.map(segment => segment.key), ['phase::segment-0', 'plain::plain', 'phase::segment-2'])

const seedRoot = projectRoot(import.meta.url)
const seedData = loadTypeScriptModule(seedRoot, 'src/data/projects.ts')
const allowedStatuses = {
  '整机产品项目': new Set(['待立项', '在研', '上市', 'EOS', '转维', '已取消', '已暂停']),
  'tOS版本项目': new Set(['在研', '已完成']),
  '能力建设项目': new Set(['在研', '已完成']),
  '技术项目': new Set(['进行中', '已完成', '暂停', '已取消']),
}
for (const project of seedData.initialProjects) {
  assert.ok(allowedStatuses[project.type]?.has(project.status), `${project.name}: ${project.status} is not an active ${project.type} status`)
}
const projectListSource = readSource(seedRoot, 'src/containers/ProjectListContainer.tsx')
assert.match(projectListSource, /configuredStatusOptions/, 'project status shortcuts consume configured enum values')
assert.doesNotMatch(projectListSource, /statusOptions\s*=\s*useMemo\([\s\S]{0,500}PROJECT_STATUS_CONFIG/, 'project status shortcuts never fall back to retired color-map values')
const seedChildren = loadTypeScriptModule(seedRoot, 'src/stores/technicalProject.ts').INITIAL_TECHNICAL_SUBPROJECTS
const seedPlans = loadTypeScriptModule(seedRoot, 'src/stores/technicalPlan.ts').INITIAL_TECHNICAL_PLANS
const seedRows = matrix.buildTechnicalProjectListRows({
  projects: seedData.initialProjects,
  subprojects: seedChildren,
  plansByKey: seedPlans,
  machineProjects: seedData.initialProjects.filter(project => project.type === '整机产品项目'),
  today: '2026-06-01',
})
assert.equal(seedRows.tdt.length, 8, 'matrix projection exposes eight TDT roots')
assert.equal(seedRows.children.length, 10, 'matrix projection exposes ten active configured children')
assert.ok(seedRows.tdt.every(row => row.technicalTrack && row.tmg && row.subdomain && row.technicalLead && row.technicalProjectManager && row.projectStage !== '-'), 'matrix roots expose configured technical fields and published-plan stages')
assert.ok(seedRows.children.every(row => Object.entries(row).some(([key, value]) => key.startsWith('milestone::') && value)), 'matrix child rows expose published-plan node values')
const isProjected = value => typeof value === 'string' && value.trim() !== '' && value !== '-'
const rootRequiredProjectionFields = ['projectName', 'technicalTrack', 'tmg', 'subdomain', 'technicalLead', 'technicalProjectManager', 'projectStage']
const childRequiredProjectionFields = ['projectName', 'parentProjectName', 'coreValue', 'developmentMode', 'firstTosVersion', 'firstMachineProject', 'projectStage']
assert.ok(seedRows.tdt.every(row => rootRequiredProjectionFields.every(field => isProjected(row[field])) && Object.entries(row).filter(([key]) => key.startsWith('milestone::')).every(([, value]) => isProjected(value))), 'every required root technical field and milestone projects a non-placeholder value')
assert.ok(seedRows.children.every(row => childRequiredProjectionFields.every(field => isProjected(row[field])) && Object.entries(row).filter(([key]) => key.startsWith('milestone::')).every(([, value]) => isProjected(value))), 'every required child technical field and milestone projects a non-placeholder value')
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
const rootDateSets = []
for (const project of seedData.initialProjects.filter(project => project.type === '技术项目')) {
  const plan = seedPlans[`${project.id}:tdt`]
  const published = plan.versions.find(version => version.status === '已发布')
  const phases = published.tasks.filter(task => !task.parentId)
  rootDateSets.push(phases.map(task => `${task.planStartDate}/${task.planEndDate}`).join('|'))
  published.tasks.forEach(task => {
    assert.ok(validDate(task.planStartDate) && validDate(task.planEndDate) && task.planStartDate <= task.planEndDate, `${project.id} root tasks keep valid ordered ISO plan dates`)
    assert.ok(task.planStartDate >= project.planStartDate && task.planEndDate <= project.planEndDate, `${project.id} root task dates are contained by the root project schedule`)
  })
}
assert.ok(new Set(rootDateSets).size > 2, 'root plan seeds use multiple distinct deterministic phase date sets')
assert.ok(new Set(seedRows.tdt.map(row => row.projectStage)).size > 2, 'root plan seeds expose diverse current stages')
for (const child of seedChildren.filter(child => child.active)) {
  const parent = seedData.initialProjects.find(project => project.id === child.parentProjectId)
  const published = seedPlans[`${child.parentProjectId}:subproject:${child.id}`].versions.find(version => version.status === '已发布')
  published.tasks.forEach(task => {
    assert.ok(validDate(task.planStartDate) && validDate(task.planEndDate) && task.planStartDate <= task.planEndDate, `${child.id} child tasks keep valid ordered ISO plan dates`)
    assert.ok(task.planStartDate >= parent.planStartDate && task.planEndDate <= parent.planEndDate, `${child.id} child task dates are contained by the parent schedule`)
  })
}
console.log('project list matrix contract passed')
