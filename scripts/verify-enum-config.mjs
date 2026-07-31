#!/usr/bin/env node
import assert from 'node:assert/strict'
import { getStringUnionTypeMembers, loadTypeScriptModule, projectRoot, readSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
assert.deepEqual(getStringUnionTypeMembers(readSource(root, 'src/types/enums.ts'), 'EnumTypeKey').sort(), ['tos-2-part', 'tos-3-part'], 'EnumTypeKey must be exactly the two fixed tOS string literals')
const values = loadTypeScriptModule(root, 'src/lib/enumValues.ts')
const store = loadTypeScriptModule(root, 'src/stores/enums.ts')
assert.deepEqual(Object.keys(values.TOS_ENUM_REGISTRY).sort(), ['tos-2-part', 'tos-3-part'], 'only two tOS enum registries are registered')
assert.equal(values.normalizeEnumValue(' 17.10.0 '), '17.10.0', 'normalization only trims input')
assert.throws(() => values.validateEnumValue('tos-3-part', '17.a.0'), /format/i, 'format validation rejects nonnumeric versions')
assert.doesNotThrow(() => values.validateEnumValue('tos-2-part', '17.10'), 'two-part values are accepted only by the two-part category')
assert.throws(() => values.validateEnumValue('tos-2-part', '17.10.0'), /format/i, 'two-part category rejects three-part values')
assert.throws(() => values.validateEnumValue('tos-3-part', '17.10'), /format/i, 'three-part category rejects two-part values')
assert.deepEqual(values.sortEnumValues(['17.10.0', '17.2.0']), ['17.2.0', '17.10.0'], 'version values sort by numeric segments in natural ascending order, not lexical order')
assert.equal(typeof store.createEnumStore, 'function', 'missing enum store fixture factory')
const enums = store.createEnumStore({ valuesByType: { 'tos-3-part': ['17.2.0'] } })
assert.deepEqual(enums.addEnumValue('tos-3-part', ' 17.10.0 '), { ok: true }, 'store adds a trimmed value')
assert.deepEqual(enums.addEnumValue('tos-3-part', '17.10.0'), { ok: false, reason: 'duplicate' }, 'store rejects duplicate values')
const selectedString = enums.getValues('tos-3-part')[0]
const businessRecord = { tosVersion: selectedString }
const readBusinessValue = record => record.tosVersion
assert.deepEqual(enums.deleteEnumValue('tos-3-part', '17.2.0'), { ok: true }, 'store deletes configured option')
assert.equal(readBusinessValue(businessRecord), '17.2.0', 'independent business snapshot keeps its selected string after deletion')
assert.equal(enums.getValues('tos-3-part').includes('17.2.0'), false, 'deleted option is gone from configuration')
console.log('enum config contract passed')
