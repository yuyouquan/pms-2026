import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const filename = 'src/constants/projectTypes.ts'
const source = readFileSync(filename, 'utf8')
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const module = { exports: {} }
vm.runInNewContext(output, { module, exports: module.exports }, { filename })

const {
  LEGACY_PROJECT_TYPE_MACHINE,
  MACHINE_PROJECT_TYPES,
  PROJECT_TEMPLATE_TYPES,
  PROJECT_TYPES,
  PROJECT_TYPE_MACHINE,
  PROJECT_TYPE_MACHINE_LAPTOP,
  PROJECT_TYPE_MACHINE_PAD,
  PROJECT_TYPE_MACHINE_PHONE,
  getProjectTypeFamilyKey,
  isMachineProjectType,
  normalizeMachineProjectType,
} = module.exports
const plain = value => JSON.parse(JSON.stringify(value))

assert.equal(PROJECT_TYPE_MACHINE_PHONE, '整机产品-手机')
assert.equal(PROJECT_TYPE_MACHINE_PAD, '整机产品-PAD')
assert.equal(PROJECT_TYPE_MACHINE_LAPTOP, '整机产品-笔电')
assert.equal(PROJECT_TYPE_MACHINE, PROJECT_TYPE_MACHINE_PHONE)
assert.equal(LEGACY_PROJECT_TYPE_MACHINE, '整机产品项目')
assert.deepEqual(plain(MACHINE_PROJECT_TYPES), [
  '整机产品-手机',
  '整机产品-PAD',
  '整机产品-笔电',
])
assert.equal(MACHINE_PROJECT_TYPES.every(isMachineProjectType), true)
assert.equal(isMachineProjectType(LEGACY_PROJECT_TYPE_MACHINE), true)
assert.equal(isMachineProjectType('tOS版本项目'), false)
assert.equal(normalizeMachineProjectType(LEGACY_PROJECT_TYPE_MACHINE), PROJECT_TYPE_MACHINE_PHONE)
assert.equal(normalizeMachineProjectType(PROJECT_TYPE_MACHINE_PAD), PROJECT_TYPE_MACHINE_PAD)
assert.equal(normalizeMachineProjectType('tOS版本项目'), 'tOS版本项目')
assert.equal(getProjectTypeFamilyKey(PROJECT_TYPE_MACHINE_PAD), PROJECT_TYPE_MACHINE_PHONE)
assert.equal(getProjectTypeFamilyKey(PROJECT_TYPE_MACHINE_LAPTOP), PROJECT_TYPE_MACHINE_PHONE)
assert.equal(PROJECT_TYPES.includes(LEGACY_PROJECT_TYPE_MACHINE), false)
assert.equal(PROJECT_TYPES.includes(PROJECT_TYPE_MACHINE_PHONE), true)
assert.equal(PROJECT_TYPES.includes(PROJECT_TYPE_MACHINE_PAD), true)
assert.equal(PROJECT_TYPES.includes(PROJECT_TYPE_MACHINE_LAPTOP), true)
assert.equal(PROJECT_TEMPLATE_TYPES.filter(isMachineProjectType).length, 1)
assert.equal(PROJECT_TEMPLATE_TYPES.includes(PROJECT_TYPE_MACHINE), true)
assert.match(source, /export const PROJECT_TYPE_MACHINE = PROJECT_TYPE_MACHINE_PHONE/)
assert.match(source, /export type CurrentProjectTypeName = typeof PROJECT_TYPES\[number\]/)
assert.match(source, /export type PersistedProjectTypeName = CurrentProjectTypeName \| typeof LEGACY_PROJECT_TYPE_MACHINE/)

console.log('Machine project type verification passed.')
