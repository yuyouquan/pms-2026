import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadTypeScriptModule } from './lib/typescript-module-loader.mjs'

const { normalizeProjectHealthStatus } = loadTypeScriptModule('src/lib/projectInfoRules.ts')
const { createInitialEnumRows } = loadTypeScriptModule('src/lib/enumValues.ts')
const { buildEnumOptions } = loadTypeScriptModule('src/lib/enumConsumers.ts')

for (const [legacy, expected] of [['normal', '正常'], ['warning', '关注'], ['attention', '关注'], ['risk', '风险']]) {
  const value = normalizeProjectHealthStatus(legacy)
  assert.equal(value, expected)
  const options = buildEnumOptions(createInitialEnumRows(), 'machine-health-status', [value])
  assert.equal(options.find(option => option.value === value)?.disabled, undefined, `${legacy} remains an enabled configured choice`)
  assert.equal(options.some(option => option.value === legacy), false, 'legacy codes must not become retired enum choices')
}
for (const value of ['正常', '关注', '风险', '历史自定义状态', 'constructor', 'toString', '']) {
  assert.equal(normalizeProjectHealthStatus(value), value, 'preserve configured and historical custom states')
}
assert.equal(normalizeProjectHealthStatus(undefined), '')
const rows = createInitialEnumRows()
rows['machine-health-status'].find(row => row.value === '正常').enabled = false
assert.equal(buildEnumOptions(rows, 'machine-health-status', [normalizeProjectHealthStatus('normal')]).find(option => option.value === '正常').disabled, true, 'normalization must not reactivate a disabled configuration')
const modal = readFileSync('src/components/project-info/ProjectInfoModal.tsx', 'utf8')
assert.match(modal, /healthStatus:\s*normalizeProjectHealthStatus\(editingProject.healthStatus\)/, 'every project edit form uses the canonical enum value')
console.log('project health enum regression passed')
