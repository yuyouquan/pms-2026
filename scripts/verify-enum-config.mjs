#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot, requireSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
requireSource(root, 'src/types/enums.ts', /tos-2-part[\s\S]*tos-3-part/, 'missing fixed tOS enum types')
const values = loadTypeScriptModule(root, 'src/lib/enumValues.ts')
const store = loadTypeScriptModule(root, 'src/stores/enums.ts')
assert.deepEqual(Object.keys(values.TOS_ENUM_REGISTRY).sort(), ['tos-2-part', 'tos-3-part'], 'only two tOS enum registries are registered')
assert.equal(values.normalizeEnumValue(' 17.10.0 '), '17.10.0', 'normalization only trims input')
assert.throws(() => values.validateEnumValue('tos-3-part', '17.a.0'), /format/i, 'format validation rejects nonnumeric versions')
assert.equal(typeof store.createEnumStore, 'function', 'missing enum store fixture factory')
const enums = store.createEnumStore({ 'tos-3-part': ['17.2.0'] })
assert.deepEqual(enums.addEnumValue('tos-3-part', ' 17.10.0 '), { ok: true }, 'store adds a trimmed value')
assert.deepEqual(enums.addEnumValue('tos-3-part', '17.10.0'), { ok: false, reason: 'duplicate' }, 'store rejects duplicate values')
const businessRecord = { version: '17.2.0' }
assert.deepEqual(enums.deleteEnumValue('tos-3-part', '17.2.0'), { ok: true }, 'store deletes configured option')
assert.equal(businessRecord.version, '17.2.0', 'deleting an option preserves historical business strings')
assert.equal(enums.getValues('tos-3-part').includes('17.2.0'), false, 'deleted option is gone from configuration')
console.log('enum config contract passed')
