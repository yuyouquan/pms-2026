import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'

globalThis.localStorage = createCurrentDatasetStorage()
globalThis.window = { localStorage }
const load = createTypeScriptModuleLoader()
const allocation = load(path.resolve('src/lib/resourceAllocation.ts'))
assert.equal(typeof allocation.buildMachineInvestmentView, 'function', 'all machine consumers share one actual-row view')

const config = load(path.resolve('src/stores/hrConfig.ts')).useHrConfigStore.getState().data.hrModel
const selected = config.find(row => row.enabled !== false)
const actualRows = [{
  id: 'actual', primaryDepartment: '研发中心', secondaryDepartment: '产品部', estimatedInvestment: 38.4,
  conceptToStr1: 2, str1ToStr2: 6, str2ToStr3: 4, str3ToStr4: 2,
  str4ToStr4a: 2, str4aToStr5: 4, str5ToSixMonths: 18.4,
}]
const changedModelVersion = {
  modelSnapshot: config,
  projectLevel: String(selected.projectLevel),
  hrModelVersion: String(selected.modelVersion),
  levelCoefficient: 2,
  machineDepartmentInvestments: actualRows,
}
const view = allocation.buildMachineInvestmentView(changedModelVersion)
assert.deepEqual(view.rows, actualRows)
assert.equal(view.total, 38.4)
assert.deepEqual(view.phaseFields.map(field => field.key), [
  'conceptToStr1', 'str1ToStr2', 'str2ToStr3', 'str3ToStr4', 'str4ToStr4a', 'str4aToStr5', 'str5ToSixMonths',
])

const { formatMachineDetailPhase } = load(path.resolve('src/components/hr-machine/machineVersionDetailView.ts'))
const mixedRows = [
  { ...actualRows[0], id: 'current-zero', conceptToStr1: 0 },
  { id: 'legacy-zero', primaryDepartment: '研发中心', secondaryDepartment: '软件部', estimatedInvestment: 6,
    conceptPhase: 0, planningPhase: 1, developmentPhase: 1, validationPhase: 1, launchPhase: 1, lifecycle: 2 },
]
const mixedView = allocation.buildMachineInvestmentView({ ...changedModelVersion, machineDepartmentInvestments: mixedRows })
assert.equal(formatMachineDetailPhase(mixedView.rows[0], 'conceptToStr1'), '-', 'detail keeps the supported-zero formatter output')
assert.equal(formatMachineDetailPhase(mixedView.rows[0], 'conceptPhase'), '—', 'detail marks a current row legacy phase unsupported')
assert.equal(formatMachineDetailPhase(mixedView.rows[1], 'conceptPhase'), '-', 'detail keeps the supported legacy-zero formatter output')
assert.equal(formatMachineDetailPhase(mixedView.rows[1], 'conceptToStr1'), '—', 'detail marks a legacy row current phase unsupported')

for (const file of [
  'src/components/hr-machine/HistoryVersionSpace.tsx',
  'src/components/hr-machine/MachineVersionDetailModal.tsx',
  'src/components/hr-machine/NewVersionModal.tsx',
]) {
  const source = fs.readFileSync(file, 'utf8')
  assert.match(source, /buildMachineInvestmentView/, `${file}: consumes saved actual-row view`)
}

const exportModule = load(path.resolve('src/components/project-resources/exportResourceVersion.ts'))
const expenseVersion = {
  id: 'expense-version', projectId: 'p', budgetType: 'annual', versionNumber: 'V0.1', isActive: true,
  lockState: 'unlocked', majorVersion: 0, minorVersion: 1, createdBy: 'tester', createdAt: '2026-01-01', lockedAt: null,
  projectStartTime: '2026-01-01', projectEndTime: '2026-02-28', departmentInvestments: [], estimatedInvestment: 0,
  nonLaborInvestment: { startMonth: '2026-01', endMonth: '2026-02', items: [{
    id: 'expense', secondaryDepartment: '软件部', tertiaryDepartment: '驱动开发', subjectId: 'flight',
    secondarySubject: '交通费', tertiarySubject: '机票',
    monthlyAmounts: { '2025-12': 99, '2026-01': 4, '2026-02': 6, '2026-03': 88 },
  }] },
}
const exported = exportModule.buildResourceVersionExportData('费用范围', expenseVersion, [])
assert.deepEqual(exported.moneyMonths, ['2026-01', '2026-02'])
assert.equal(exported.nonLaborRows[0].estimatedInvestment, 10, 'export total uses only the current displayed range')

const { applyNonLaborItemTotalChange } = load(path.resolve('src/components/project-resources/nonLaborItemTotalChange.ts'))
const missingMonths = { startMonth: null, endMonth: null, items: structuredClone(expenseVersion.nonLaborInvestment.items) }
const missingBefore = structuredClone(missingMonths)
const warnings = []
const changes = []
assert.doesNotThrow(() => applyNonLaborItemTotalChange({
  value: missingMonths, itemId: 'expense', amount: 12, inline: false,
  onChange: next => changes.push(next), onError: text => warnings.push(text),
}))
assert.deepEqual(missingMonths, missingBefore, 'invalid non-inline total callback leaves its input immutable')
assert.deepEqual(changes, [], 'invalid non-inline total callback does not replace the draft')
assert.deepEqual(warnings, ['请先完善里程碑日期以生成费用投入月份，再填写预估投入合计'])
const validBefore = structuredClone(expenseVersion.nonLaborInvestment)
applyNonLaborItemTotalChange({
  value: expenseVersion.nonLaborInvestment, itemId: 'expense', amount: 10, inline: false,
  onChange: next => changes.push(next), onError: text => warnings.push(text),
})
assert.deepEqual(changes.at(-1).items[0].monthlyAmounts, { '2025-12': 99, '2026-01': 5, '2026-02': 5, '2026-03': 88 })
assert.deepEqual(expenseVersion.nonLaborInvestment, validBefore, 'valid non-inline callback returns a new draft')
assert.throws(() => applyNonLaborItemTotalChange({
  value: missingMonths, itemId: 'expense', amount: 12, inline: true,
  onChange: next => changes.push(next), onError: text => warnings.push(text),
}), /请先完善里程碑日期/)
assert.throws(() => applyNonLaborItemTotalChange({
  value: missingMonths, itemId: 'expense', amount: 12, inline: true,
  onItemTotalChange: () => { throw new Error('inline session validation') }, onError: text => warnings.push(text),
}), /inline session validation/, 'inline session errors keep propagating')
assert.equal(warnings.length, 1, 'inline callback keeps propagating to the inline session')

const projectStore = load(path.resolve('src/stores/project.ts')).useProjectStore
const machineStore = load(path.resolve('src/stores/hrMachine.ts')).useHrMachineStore
machineStore.getState().refreshFormalProjects()
const project = machineStore.getState().projects.find(item => item.id.includes('mock-budget-machine-unbound'))
const version = project.versions.at(-1)
const scopeId = project.pmsProjectId
const edit = patch => machineStore.getState().updateVersionInline(project.id, version.id, patch, scopeId)
const row = allocation.resolveMachineDepartmentInvestments(version)[0]
assert.throws(() => edit({ type: 'departments', rows: allocation.resolveMachineDepartmentInvestments(version) }), /只读/, 'machine resource cannot override configured department investments')
edit({ type: 'model', key: 'levelCoefficient', value: 2 })
const saved = machineStore.getState().projects.find(item => item.id === project.id).versions.find(item => item.id === version.id)
assert.equal(saved.levelCoefficient, 2, 'store persists coefficient 2')
assert.equal(projectStore.getState().currentLoginUser, '演示用户01')

console.log('PASS machine consumers, current-range expense export, non-inline total callbacks, and reported numeric store writes')
