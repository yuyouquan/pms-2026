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
assert.deepEqual(rules.validateJiraProjectRows([validRow]), [], 'a complete shared JIRA row with Affect Projects is valid')
for (const field of ['server', 'projectKey', 'type']) {
  const errors = rules.validateJiraProjectRows([validRow, { ...validRow, id: 'invalid-1', [field]: '' }])
  const error = errors.find(item => item.rowIndex === 1 && item.fieldKey === field)
  assert.ok(error, `${field} is required when a row exists`)
  assert.equal(error.rowId, 'invalid-1', `${field} validation identifies the invalid row`)
  assert.equal(typeof error.message, 'string', `${field} validation includes a meaningful message`)
  assert.ok(error.message.trim().length > 0, `${field} validation message is not empty`)
}
{
  const errors = rules.validateJiraProjectRows([validRow, { ...validRow, id: 'invalid-1', shared: true, affectProjects: '' }])
  const error = errors.find(item => item.rowIndex === 1 && item.fieldKey === 'affectProjects')
  assert.ok(error, 'shared JIRA rows require Affect Projects')
  assert.equal(error.rowId, 'invalid-1', 'Affect Projects validation identifies the invalid row')
  assert.equal(typeof error.message, 'string', 'Affect Projects validation includes a meaningful message')
  assert.ok(error.message.trim().length > 0, 'Affect Projects validation message is not empty')
}
assert.deepEqual(rules.validateJiraProjectRows([{ ...validRow, shared: false, affectProjects: '' }]), [], 'non-shared rows do not require Affect Projects')

assert.deepEqual(
  rules.patchJiraProjectConfig({ ...validRow }, { shared: false }),
  { ...validRow, shared: false, affectProjects: '' },
  'turning off shared clears Affect Projects while preserving other fields',
)

const copied = rules.copyJiraProjectConfig(validRow)
const copiedAgain = rules.copyJiraProjectConfig(validRow)
assert.ok(copied.id, 'copy creates a non-empty row id')
assert.ok(copiedAgain.id, 'a second copy creates a non-empty row id')
assert.notEqual(copied.id, validRow.id, 'copy creates a unique row id')
assert.notEqual(copied.id, copiedAgain.id, 'separate copies receive distinct row ids')
assert.notEqual(copiedAgain.id, validRow.id, 'the second copy also receives a unique row id')
assert.deepEqual(
  ['server', 'projectKey', 'type', 'shared', 'affectProjects'].map(field => copied[field]),
  ['server', 'projectKey', 'type', 'shared', 'affectProjects'].map(field => validRow[field]),
  'copy preserves all five business fields',
)
assert.deepEqual(
  ['server', 'projectKey', 'type', 'shared', 'affectProjects'].map(field => copiedAgain[field]),
  ['server', 'projectKey', 'type', 'shared', 'affectProjects'].map(field => validRow[field]),
  'a second copy preserves all five business fields',
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
