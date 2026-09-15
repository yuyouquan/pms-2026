import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const matrix = loadTypeScriptModule(root, 'src/lib/projectListMatrix.ts')
const summary = loadTypeScriptModule(root, 'src/lib/projectSummary.ts')
const columnOrder = loadTypeScriptModule(root, 'src/lib/projectListColumnOrder.ts')
const workspace = loadTypeScriptModule(root, 'src/lib/technicalPlanWorkspace.ts')
const rules = loadTypeScriptModule(root, 'src/lib/level1PlanRules.ts')
const filters = loadTypeScriptModule(root, 'src/lib/planWorkspace.ts')

const expectedFields = ['子任务名称', '所属TDT项目名称', '核心价值', '开发模式', '首导tOS', '首导整机产品']
const templateTasks = [
  { id: 'tdr3', taskName: 'TDR3', order: 3 },
  { id: 'transfer1', taskName: '第1版转测', order: 1 },
  { id: 'nested', parentId: 'transfer1', taskName: '不展示的二级节点', order: 1 },
  { id: 'transfer2', taskName: '第2版转测', order: 2 },
]
const columns = matrix.getProjectListMatrix('technical-subproject', {
  templateTasks,
  optionalFields: [{ key: 'projectStage', label: '项目阶段', defaultVisible: true }, { key: 'technicalLead', label: '技术负责人' }],
})
assert.deepEqual(columns.map(column => column.label), [...expectedFields, '第1版转测', '第2版转测', 'TDR3'])
assert.ok(columns.every(column => !column.group), 'subproject headers have only one level')
assert.ok(matrix.getProjectListMatrix('technical-subproject').every(column => !column.group), 'fallback milestone headers are also flat')

const fields = summary.getProjectListFieldDefinitions('technical-subproject', templateTasks, '技术项目')
assert.deepEqual(fields.map(field => field.title), columns.map(column => column.label), 'project-space fields cannot leak into the child table')
const units = columnOrder.buildProjectListColumnUnits(fields)
const restored = columnOrder.normalizeProjectListUnitSettings(units, {
  order: ['projectName', 'projectStage', 'technicalLead', 'milestone'],
  visible: ['projectName', 'projectStage', 'technicalLead', 'milestone'],
})
assert.ok(!restored.order.includes('projectStage') && !restored.order.includes('technicalLead'), 'old saved columns cannot restore removed fields')
assert.ok(restored.visible.includes('milestone'), 'saved milestone visibility remains usable')

const labels = ['序号', '阶段/节点', '计划开始时间', '计划完成时间', '预估工期', '实际开始时间', '实际完成时间', '实际工期', '是否延期']
assert.deepEqual(workspace.getTechnicalPlanExportColumns('subproject').map(column => column.title), labels)
assert.deepEqual(workspace.getTechnicalPlanFilterFields('subproject').map(field => field.label), labels)
const rows = rules.projectTechnicalSubprojectRows([
  { id: '1', taskName: '按时节点', order: 1, planStartDate: '2026-01-01', planEndDate: '2026-01-03', actualStartDate: '2026-01-01', actualEndDate: '2026-01-03' },
  { id: '2', taskName: '延期节点', order: 2, planStartDate: '2026-01-01', planEndDate: '2026-01-03', actualStartDate: '2026-01-01', actualEndDate: '2026-01-05' },
  { id: '3', taskName: '待补充日期', order: 3 },
], { today: '2026-02-01' })
assert.deepEqual(rows.map(row => row.delayStatus), ['按时', '延期', '-'])
assert.ok(rows[0].estimatedDays > 0 && rows[1].actualDays > rows[1].estimatedDays)
const delayed = filters.applyPlanWorkspaceFilters(rows, [{ id: 'delay', field: 'delayStatus', operator: 'equals', value: '延期' }], workspace.getTechnicalPlanFilterFields('subproject'))
assert.deepEqual(delayed.map(row => row.id), ['2'], 'delay filtering uses actual projected dates')
console.log('PASS technical child fields, flat milestone headers, saved-column migration, export/filter labels and delay data')
