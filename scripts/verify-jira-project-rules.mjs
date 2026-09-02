#!/usr/bin/env node
import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const rules = loadTypeScriptModule(root, 'src/lib/jiraProject.ts')

for (const exportName of [
  'normalizeJiraProjectConfig',
  'normalizeJiraProjectRows',
  'patchJiraProjectConfig',
  'copyJiraProjectConfig',
  'validateJiraProjectRows',
]) {
  assert.equal(typeof rules[exportName], 'function', `src/lib/jiraProject.ts must export ${exportName}`)
}

const validRow = {
  id: 'jira-1',
  server: 'jira.transsion.com',
  projectKey: 'KN4-tOS16',
  type: 'sw',
  shared: true,
  affectProjects: 'KN4',
}

assert.deepEqual(rules.validateJiraProjectRows([]), [], 'an empty JIRA configuration is valid')
for (const field of ['server', 'projectKey', 'type']) {
  const errors = rules.validateJiraProjectRows([{ ...validRow, [field]: '' }])
  assert.ok(errors.some(error => error.rowIndex === 0 && error.fieldKey === field), `${field} is required when a row exists`)
}
assert.ok(
  rules.validateJiraProjectRows([{ ...validRow, shared: true, affectProjects: '' }])
    .some(error => error.rowIndex === 0 && error.fieldKey === 'affectProjects'),
  'shared JIRA rows require Affect Projects',
)
assert.deepEqual(rules.validateJiraProjectRows([{ ...validRow, shared: false, affectProjects: '' }]), [], 'non-shared rows do not require Affect Projects')

assert.equal(rules.patchJiraProjectConfig({ ...validRow }, { shared: false }).affectProjects, '', 'turning off shared clears Affect Projects')

const copied = rules.copyJiraProjectConfig(validRow)
assert.notEqual(copied.id, validRow.id, 'copy creates a unique row id')
assert.deepEqual(
  ['server', 'projectKey', 'type', 'shared', 'affectProjects'].map(field => copied[field]),
  ['server', 'projectKey', 'type', 'shared', 'affectProjects'].map(field => validRow[field]),
  'copy preserves all five business fields',
)

const legacy = { id: 'legacy', server: ' jira.transsion.com ', projectKey: ' KN4-tOS16 ', type: ' sw ' }
assert.deepEqual(rules.normalizeJiraProjectConfig(legacy), {
  id: 'legacy', server: 'jira.transsion.com', projectKey: 'KN4-tOS16', type: 'sw', shared: false, affectProjects: '',
}, 'legacy rows migrate missing shared and Affect Projects safely')

const rawIncomplete = { id: 'incomplete', server: '  ', projectKey: ' ', type: ' sw ' }
const normalizedIncompleteRows = rules.normalizeJiraProjectRows([rawIncomplete])
assert.equal(normalizedIncompleteRows.length, 1, 'normalization preserves incomplete rows for validation')
assert.deepEqual(normalizedIncompleteRows[0], {
  id: 'incomplete', server: '', projectKey: '', type: 'sw', shared: false, affectProjects: '',
}, 'batch normalization trims raw incomplete rows and applies legacy defaults')

console.log('JIRA project rules are correct.')
