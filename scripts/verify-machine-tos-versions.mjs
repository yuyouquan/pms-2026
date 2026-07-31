#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot } from './lib/source-contract.mjs'

const rules = loadTypeScriptModule(projectRoot(import.meta.url), 'src/lib/machineTosVersions.ts')
assert.ok(rules.compareThreePartVersions('17.10.0', '17.2.0') > 0, 'three-part versions sort numerically')
const newMachine = { id: 'new', name: 'A', kind: 'new', firstSaleTosVersion: '14.0.0', currentTosVersion: '' }
const oldMachine = { id: 'old', name: ' A ', kind: 'legacy', firstSaleTosVersion: '', currentTosVersion: '15.0.0' }
assert.deepEqual(rules.resolveMachineTosUpdate([newMachine], newMachine), { ok: true, currentTosVersion: '14.0.0' }, 'new machine initializes current from first sale')
assert.deepEqual(rules.resolveMachineTosUpdate([newMachine, oldMachine], oldMachine), { ok: true, firstSaleTosVersion: '14.0.0', currentTosVersion: '15.0.0' }, 'legacy preserves current while inheriting first sale')
assert.deepEqual(rules.resolveMachineTosUpdate([newMachine, oldMachine], newMachine), { ok: true, currentTosVersion: '15.0.0' }, 'new machine recomputes current from same-name legacy')
const laterOld = { id: 'old-2', name: 'A', kind: 'legacy', firstSaleTosVersion: '14.0.0', currentTosVersion: '17.10.0' }
assert.deepEqual(rules.resolveMachineTosUpdate([newMachine, oldMachine, laterOld], newMachine), { ok: true, currentTosVersion: '17.10.0' }, 'new machine recomputes greatest legacy current')
assert.deepEqual(rules.resolveMachineTosUpdate([], oldMachine), { ok: false, reason: 'missing-new-product' })
assert.deepEqual(rules.resolveMachineTosUpdate([newMachine, { ...newMachine, id: 'new-2' }], oldMachine), { ok: false, reason: 'duplicate-new-product' })
assert.deepEqual(rules.resolveMachineTosUpdate([{ ...newMachine, firstSaleTosVersion: 'bad' }], newMachine), { ok: false, reason: 'invalid-version' })
console.log('machine tOS versions contract passed')
