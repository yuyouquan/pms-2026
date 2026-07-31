#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot } from './lib/source-contract.mjs'

const rules = loadTypeScriptModule(projectRoot(import.meta.url), 'src/lib/machineTosVersions.ts')
for (const name of ['compareThreePartVersions', 'resolveMachineTosUpdate']) assert.equal(typeof rules[name], 'function', `missing ${name}`)

assert.ok(rules.compareThreePartVersions('17.10.0', '17.2.0') > 0, 'three-part versions sort numerically')
assert.deepEqual(
  rules.resolveMachineTosUpdate({ machine: { isNew: true, name: 'A' }, tosProjects: [{ name: 'A', version: '17.2.0' }] }),
  { version: '17.2.0', mode: 'initialize' },
  'a unique new-machine match initializes the linked tOS version',
)
assert.deepEqual(
  rules.resolveMachineTosUpdate({ machine: { isNew: false, name: 'A', tosVersion: '17.2.0' }, tosProjects: [{ name: 'A', version: '17.10.0' }, { name: 'A', version: '17.2.0' }] }),
  { version: '17.10.0', mode: 'inherit' },
  'a legacy machine inherits the greatest same-name tOS version',
)
console.log('machine tOS versions contract passed')
