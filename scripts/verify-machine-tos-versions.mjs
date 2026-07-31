#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot } from './lib/source-contract.mjs'

const rules = loadTypeScriptModule(projectRoot(import.meta.url), 'src/lib/machineTosVersions.ts')
assert.ok(rules.compareThreePartVersions('17.10.0', '17.2.0') > 0, 'three-part versions sort numerically')
const newMachine = { id: 'new', name: 'A', kind: 'new', firstSale: '14.0.0', current: '' }
const oldMachine = { id: 'old', name: ' A ', kind: 'legacy', firstSale: '14.0.0', current: '15.0.0' }
assert.deepEqual(rules.resolveMachineTosUpdate(newMachine, [newMachine]), { current: '14.0.0' }, 'new machine initializes current from first sale')
assert.deepEqual(rules.resolveMachineTosUpdate(oldMachine, [newMachine, oldMachine]), { firstSale: '14.0.0', current: '15.0.0' }, 'legacy machine inherits first sale while preserving current version')
assert.deepEqual(rules.resolveMachineTosUpdate(newMachine, [newMachine, oldMachine]), { current: '15.0.0' }, 'new machine recomputes to same-name legacy current')
const laterOld = { id: 'old-2', name: 'A', kind: 'legacy', firstSale: '14.0.0', current: '17.10.0' }
assert.deepEqual(rules.resolveMachineTosUpdate(newMachine, [newMachine, oldMachine, laterOld]), { current: '17.10.0' }, 'new machine recomputes to greatest same-name legacy current')
assert.equal(laterOld.current, '17.10.0', 'legacy history is never rewritten')
assert.throws(() => rules.resolveMachineTosUpdate(oldMachine, []), /unique/i, 'zero matching new machines fails')
assert.throws(() => rules.resolveMachineTosUpdate(oldMachine, [newMachine, { ...newMachine, id: 'new-2' }]), /unique/i, 'multiple matching new machines fail')
console.log('machine tOS versions contract passed')
