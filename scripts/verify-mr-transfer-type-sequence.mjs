import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
const load = createTypeScriptModuleLoader()
const { getJointTransferTypeGaps } = load(path.resolve('src/lib/mrDateRules.ts'))
const row = (projectId, transferType, tosVersion = '16.3.0.135', tosProjectId = 'tos') => ({ projectId, transferType, tosVersion, tosProjectId, dates: {} })
const baseline = { projectId: 'tos', tosVersion: '16.3.0.135' }
const input = rows => ({ machinePlans: rows, tosInstances: [baseline] })
const rows = [row('a', '1'), row('b', '3'), row('c', '4'), row('d', 'N/A'), row('e', '3')]
let gaps = getJointTransferTypeGaps(input(rows))
assert.deepEqual(Object.keys(gaps).sort(), ['b::16.3.0.135', 'c::16.3.0.135', 'e::16.3.0.135'])
assert.equal(gaps['c::16.3.0.135'], 2)
assert.deepEqual(getJointTransferTypeGaps(input([...rows, row('f', '2')])), {}, 'filling the gap clears all later rows')
assert.deepEqual(getJointTransferTypeGaps(input([row('a', '2'), row('b', '3')])), {}, 'tOS reference row is the type 1 baseline')
assert.equal(getJointTransferTypeGaps(input([row('a', '2'), row('b', '4'), row('c', '5')]))['c::16.3.0.135'], 3)
assert.equal(getJointTransferTypeGaps(input([row('a', '3'), row('b', '2', '16.3.0.140'), row('c', '2', '16.3.0.135', 'other')]))['a::16.3.0.135'], 2, 'other versions/projects cannot fill gaps')
assert.deepEqual(getJointTransferTypeGaps(input([row('a', '2', 'tOS16.3.0.135'), row('b', '3')])), {}, 'canonical version aliases share one sequence')
assert.equal(getJointTransferTypeGaps({ machinePlans: [row('a', '2')], tosInstances: [] })['a::16.3.0.135'], 1)
assert.deepEqual(rows.map(row => row.transferType), ['1', '3', '4', 'N/A', '3'], 'validation must not change data')
console.log('PASS transfer type gaps: 1/3/4, later gaps, duplicates, N/A, baseline, project/version isolation, recovery')
