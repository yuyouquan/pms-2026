#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot, requireSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
requireSource(root, 'src/types/enums.ts', /tos-2-part[\s\S]*tos-3-part/, 'missing fixed tOS enum types')
requireSource(root, 'src/stores/enums.ts', /useEnumStore\b/, 'missing enum store contract')
const values = loadTypeScriptModule(root, 'src/lib/enumValues.ts')
for (const name of ['normalizeEnumValue', 'sortEnumValues', 'removeEnumValue']) assert.equal(typeof values[name], 'function', `missing ${name}`)
assert.equal(values.normalizeEnumValue(' 17.10.0 '), '17.10.0', 'enum values trim whitespace')
assert.throws(() => values.normalizeEnumValue('17.a.0'), /format/i, 'tOS values require numeric version format')
assert.throws(() => values.normalizeEnumValue('17.10.0', ['17.10.0']), /duplicate/i, 'duplicate values are rejected')
assert.deepEqual(values.sortEnumValues(['17.2.0', '17.10.0']), ['17.10.0', '17.2.0'], 'tOS values sort numerically')
const history = { version: '17.2.0' }
assert.deepEqual(values.removeEnumValue(['17.2.0', '17.10.0'], '17.2.0'), ['17.10.0'], 'option deletion changes configuration')
assert.equal(history.version, '17.2.0', 'option deletion preserves historical business strings')
console.log('enum config contract passed')
