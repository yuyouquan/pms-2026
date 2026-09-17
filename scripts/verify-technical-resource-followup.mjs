import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'

globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage: globalThis.localStorage }
const load = createTypeScriptModuleLoader(), get = file => load(path.resolve(file))
const registry = get('src/stores/project.ts').useProjectStore
const technical = get('src/stores/hrTechnical.ts').useHrTechnicalStore
const plan = get('src/stores/technicalPlan.ts').useTechnicalPlanStore
const { TECH_MILESTONE_FIELDS } = get('src/constants/hrTechnical.ts')
const { resolveHrFormalSource } = get('src/lib/hrFormalProjectSource.ts')
const newDates = { tdr2: '2030-03-02', tdr3x: '2030-05-03', tdr4: '2030-07-04' }
assert.deepEqual(TECH_MILESTONE_FIELDS.map(field => field.label), [
  '规划启动', 'charter DCP', 'TDR1', 'TDR2', 'PDCP', 'TDR3_X', 'TDCP_X', 'TDR4', 'EDCP',
])
const formal = registry.getState().projects.find(project => project.type === '技术项目' && project.projectAttribute === 'formal')
const budget = registry.getState().projects.find(project => project.type === '技术项目' && project.projectAttribute === 'budget')
assert.ok(formal && budget)
technical.getState().refreshFormalProjects()
const record = id => technical.getState().projects.find(project => project.pmsProjectId === id)
const before = structuredClone(record(budget.id).versions)
const departments = [{ id: 'followup-dept', primaryDepartment: '研发中心', secondaryDepartment: '产品部', estimatedInvestment: 15, planningPhase: 1, conceptPhase: 2, planPhase: 3, developmentPhase: 4, migrationPhase: 5 }]
technical.getState().addVersion(record(budget.id).id, { budgetType: 'annual', departmentInvestments: departments, milestones: newDates })
const latest = id => record(id).versions.at(-1)
assert.equal(record(budget.id).versions.length, before.length + 1)
assert.deepEqual(record(budget.id).versions.slice(0, -1), before, 'new version does not overwrite history')
for (const key of Object.keys(newDates)) assert.equal(latest(budget.id).milestones[key], newDates[key])
const edited = { tdr2: '2031-03-02', tdr3x: '2031-05-03', tdr4: '2031-07-04' }
technical.getState().updateVersion(record(budget.id).id, latest(budget.id).id, { milestones: edited })
registry.setState({ projects: registry.getState().projects.map(project => project.id === budget.id ? { ...project, boundFormalProjectId: formal.id } : project) })
technical.getState().refreshFormalProjects()
await technical.persist.rehydrate()
for (const key of Object.keys(edited)) assert.equal(latest(budget.id).milestones[key], edited[key], 'budget keeps independent dates after binding/reload')
const previousId = latest(budget.id).id
technical.getState().copyVersion(record(budget.id).id, previousId)
technical.getState().updateVersion(record(budget.id).id, previousId, { milestones: newDates })
for (const key of Object.keys(edited)) {
  assert.equal(latest(budget.id).milestones[key], edited[key], 'copy inherits milestones')
  assert.equal(record(budget.id).versions.find(version => version.id === previousId).milestones[key], edited[key], 'history stays read-only')
}
const tasks = TECH_MILESTONE_FIELDS.map((field, index) => ({ id: field.key, taskName: field.label, nodeKind: 'fixed-milestone', order: index, planStartDate: `2032-01-${String(index + 1).padStart(2, '0')}`, planEndDate: `2032-01-${String(index + 1).padStart(2, '0')}` }))
plan.setState({ plansByKey: { ...plan.getState().plansByKey, [`${formal.id}:tdt`]: { planKey: `${formal.id}:tdt`, templateKind: 'tdt', versions: [{ id: 'followup-published', versionNo: 'V99', status: '已发布', templateType: 'tdt', tasks }] } } })
technical.getState().refreshFormalProjects()
technical.getState().addVersion(record(formal.id).id, { budgetType: 'projectBudget', departmentInvestments: departments, milestones: newDates })
const source = resolveHrFormalSource('technical', null, formal.id)
for (const key of Object.keys(newDates)) assert.ok(source.milestones[key])
technical.getState().updateVersion(record(formal.id).id, latest(formal.id).id, { milestones: edited })
for (const key of Object.keys(newDates)) assert.equal(latest(formal.id).milestones[key], source.milestones[key], 'formal dates come from published plan and reject manual edits')
for (const key of Object.keys(edited)) assert.equal(latest(budget.id).milestones[key], edited[key], 'formal plan refresh never overwrites linked budget')

for (const category of ['technical', 'tos', 'capability']) {
  const source = fs.readFileSync(`src/components/hr-${category}/NewVersionModal.tsx`, 'utf8')
  // Version context now belongs to the modal title Tag, not the old body banner.
  assert.doesNotMatch(source.replace(/versionLabel="将创建版本"/g, ''), /将创建版本|IPM编码：|IPM：|TDT项目：/)
  assert.match(source, /aria-label="选择项目"/, 'aggregate entry still supports project selection')
  assert.match(source, /人力预估投入合计：/)
  assert.doesNotMatch(source, /编辑各阶段预估投入，合计将自动更新|版本规则：/)
}
console.log('PASS: technical milestones create/edit/bind/copy/reload/history/formal-source rules and compact modal contracts')
