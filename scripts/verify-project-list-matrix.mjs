#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot } from './lib/source-contract.mjs'

const matrix = loadTypeScriptModule(projectRoot(import.meta.url), 'src/lib/projectListMatrix.ts')
assert.equal(typeof matrix.getProjectListMatrix, 'function', 'missing getProjectListMatrix')
assert.equal(typeof matrix.buildGroupedMilestoneColumns, 'function', 'missing grouped milestone builder')
assert.equal(typeof matrix.buildTechnicalProjectListRows, 'function', 'missing technical row builder')
assert.equal(typeof matrix.isOverdueProjectListDate, 'function', 'missing overdue date helper')
assert.deepEqual(matrix.PROJECT_LIST_CATEGORIES, ['整机产品项目', 'tOS版本项目', '技术项目', '能力建设项目'])
assert.deepEqual(matrix.PROJECT_LIST_QUICK_FILTERS.machine.map(item => item.label), ['项目二级分类', '状态', '首销tOS版本', '芯片编码', '品牌', '产品系列', '产品类型'])
assert.deepEqual(matrix.PROJECT_LIST_QUICK_FILTERS.tos.map(item => item.label), ['版本类型', 'tOS版本'])
assert.deepEqual(matrix.PROJECT_LIST_QUICK_FILTERS.technical.map(item => item.label), ['状态', '项目类型', '项目名称', '技术赛道', '项目阶段'])
assert.deepEqual(matrix.TECHNICAL_PROJECT_TYPE_OPTIONS.map(item => item.label), ['全部', 'TDT项目', '子项目'])
const expected = {
  machine: ['产品系列', '项目名称', '品牌', '芯片编码', '版本类型', '首销tOS版本', '项目状态', 'SPM', 'SPM部门'],
  tos: ['tOS版本', '版本类型', '项目状态', 'SPM'],
  'technical-tdt': ['TDT项目名称', '技术赛道', 'TMG及技术领域', '子领域', '技术项目负责人', '技术项目经理', '项目阶段'],
  'technical-subproject': ['子任务名称', '所属TDT项目名称', '核心价值', '开发模式', '首导tOS', '首导整机产品', '项目阶段', '第1版转测', '第2版转测', '第X版转测', 'TDR3'],
}
for (const [variant, labels] of Object.entries(expected)) {
  const columns = matrix.getProjectListMatrix(variant, { milestones: ['动态节点'] })
  assert.deepEqual(columns.slice(0, labels.length).map(column => column.label), labels, `${variant} labels`)
  columns.slice(0, labels.length).forEach(column => assert.deepEqual(
    { required: column.required, hideable: column.hideable, reorderable: column.reorderable },
    { required: true, hideable: false, reorderable: true },
  ))
}
assert.ok(matrix.getProjectListMatrix('machine', { milestones: ['最新一级模板节点'] }).some(column => column.label === '最新一级模板节点'), 'machine dynamic milestone column')
assert.ok(matrix.getProjectListMatrix('tos', { milestones: ['最新已发布一级模板节点'] }).some(column => column.label === '最新已发布一级模板节点'), 'tOS latest published L1 milestone column')
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
assert.ok(grouped.every(item => item.required && item.hideable === false && item.reorderable))

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
assert.equal(rows.children[0].projectName, '子项目A')
assert.equal(rows.children[0].parentProjectName, '端侧AI技术')
assert.equal(rows.children[0].firstMachineProject, 'X6870')
assert.equal(rows.children[0]['milestone::第1版转测'], '2026-03-01')
assert.equal(rows.children[0].targetProjectId, '9')
assert.equal(rows.children[0].targetSubprojectId, 'IPM-1')
assert.equal(matrix.isOverdueProjectListDate('2026-05-31', '2026-06-01'), true)
assert.equal(matrix.isOverdueProjectListDate('2026-02-30', '2026-06-01'), false)
console.log('project list matrix contract passed')
