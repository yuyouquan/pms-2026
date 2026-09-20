import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
const load = createTypeScriptModuleLoader()
const { planTaskDisplayNumbers, nextPlanTaskId } = load(path.resolve('src/lib/planTaskDisplayNumbers.ts'))
const tasks = [
  { id: '1' }, { id: '1.1', parentId: '1' }, { id: '1.2', parentId: '1' },
  { id: '2' }, { id: '2.1', parentId: '2' },
  { id: '3' }, { id: '3.1', parentId: '3' }, { id: '3.2', parentId: '3' },
  { id: 'machine-stage-validation' }, { id: '3.3', parentId: 'machine-stage-validation' },
  { id: '4' }, { id: '5' },
]
const original = structuredClone(tasks)
const numbers = planTaskDisplayNumbers(tasks)
assert.equal(numbers.get('machine-stage-validation'), '4')
assert.equal(numbers.get('3.3'), '4.1')
assert.equal(numbers.get('4'), '5')
assert.equal(numbers.get('5'), '6')
assert.equal(nextPlanTaskId(tasks, '3', 3), '3.4', 'STR5 retains 3.3; adding development child must not reuse it')
const added = [...tasks, { id: nextPlanTaskId(tasks, '3', 3), parentId: '3' }]
assert.equal(planTaskDisplayNumbers(added).get('3.4'), '3.3', 'visible number is independent of retained IDs')
assert.equal(nextPlanTaskId(tasks, null, 4), '6')
assert.equal(new Set(added.map(task => task.id)).size, added.length)
assert.deepEqual(tasks, original)
console.log('PASS migrated phase display numbering and new-task global identity uniqueness')
