#!/usr/bin/env node
import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
import { createCurrentDatasetStorage } from './lib/mock-dataset-storage.mjs'

globalThis.window = { localStorage: createCurrentDatasetStorage() }
const load = createTypeScriptModuleLoader()
const { useProjectStore: store } = load(path.resolve('src/stores/project.ts'))
const registry = load(path.resolve('src/lib/projectRegistry.ts'))
const actor = '演示用户01'
store.setState({ projects: [], registryHistory: [] })

function atomic(action, run) {
  const snapshots = []
  const unsubscribe = store.subscribe(state => snapshots.push({
    projects: state.projects, history: state.registryHistory, members: state.projectMemberMap,
  }))
  let result
  try { result = run() } finally { unsubscribe() }
  assert.equal(result.ok, true, result.message)
  assert.equal(snapshots.length, 1, `${action}: only one observable project-store update`)
  const snapshot = snapshots[0]
  const entry = snapshot.history[0]
  assert.equal(entry.action, action)
  if (action === 'delete') {
    assert.equal(snapshot.projects.some(project => project.id === entry.projectId), false)
    assert.equal(entry.before.name, '事务验收预算-已改名')
  } else {
    const project = snapshot.projects.find(project => project.id === entry.projectId)
    assert.deepEqual(entry.after, JSON.parse(JSON.stringify(project)), `${action}: history matches the visible data`)
    assert.deepEqual(snapshot.members[project.id], [actor], `${action}: registry members are immediately available`)
  }
  console.log(`PASS ${action}: project, members and history are coherent for subscribers`)
  return result
}

const { projectId } = atomic('create', () => registry.createConfiguredProject({
  projectAttribute: 'budget', type: '技术项目', name: '事务验收预算', responsiblePersons: [actor],
}, actor))
atomic('update', () => registry.updateConfiguredProject(projectId, { name: '事务验收预算-已改名' }, actor))
atomic('delete', () => registry.deleteConfiguredProject(projectId, actor))
console.log('Project registry atomic transaction checks passed.')
