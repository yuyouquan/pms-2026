#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { loadTypeScriptModule, projectRoot } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const jiraProjectModule = loadTypeScriptModule(root, 'src/lib/jiraProject.ts')
const source = readFileSync(new URL('../src/components/project-info/ProjectInfoModal.tsx', import.meta.url), 'utf8')
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText
const module = { exports: {} }
const inertModule = new Proxy({}, { get: () => () => undefined })
vm.runInNewContext(output, {
  module,
  exports: module.exports,
  require: id => id === '@/lib/jiraProject' ? jiraProjectModule : inertModule,
}, { filename: 'ProjectInfoModal.tsx' })

const {
  normalizeProjectInfoModalSubmitValues,
  getProjectInfoModalEditHydrationKey,
  shouldHydrateProjectInfoModalEdit,
} = module.exports

assert.equal(typeof normalizeProjectInfoModalSubmitValues, 'function', 'modal must export its submission normalizer')
assert.equal(typeof getProjectInfoModalEditHydrationKey, 'function', 'modal must export its edit hydration key')
assert.equal(typeof shouldHydrateProjectInfoModalEdit, 'function', 'modal must export its edit hydration decision')

const rawRows = [
  { id: 'jira-incomplete', server: ' jira.transsion.com ', projectKey: ' ', type: ' sw ' },
  { id: 'jira-complete', server: 'jira-ex.transsion.com:6001', projectKey: ' KN4-tOS16 ', type: 'monkey', shared: true, affectProjects: ' KN4 ' },
]
const submitted = normalizeProjectInfoModalSubmitValues({ jiraProjects: rawRows, brand: 'TECNO' })
assert.equal(submitted.jiraProjects.length, 2, 'submission normalization preserves incomplete JIRA rows instead of filtering them')
assert.deepEqual(submitted.jiraProjects[0], {
  id: 'jira-incomplete', server: 'jira.transsion.com', projectKey: '', type: 'sw', shared: false, affectProjects: '',
}, 'submission normalization trims and migrates the incomplete row')
assert.deepEqual(submitted.jiraProjects[1], {
  id: 'jira-complete', server: 'jira-ex.transsion.com:6001', projectKey: 'KN4-tOS16', type: 'monkey', shared: true, affectProjects: 'KN4',
}, 'submission normalization keeps all complete row values')
assert.deepEqual(normalizeProjectInfoModalSubmitValues({ jiraProjects: [] }).jiraProjects, [], 'an empty JIRA configuration remains a valid empty submission')

const firstOpenKey = getProjectInfoModalEditHydrationKey({ open: true, mode: 'edit', projectId: 'project-a' })
assert.equal(shouldHydrateProjectInfoModalEdit('', firstOpenKey), true, 'opening an edit modal hydrates its project')
assert.equal(shouldHydrateProjectInfoModalEdit(firstOpenKey, firstOpenKey), false, 'parent rerenders for the same open project preserve touched JIRA edits and errors')
const switchedProjectKey = getProjectInfoModalEditHydrationKey({ open: true, mode: 'edit', projectId: 'project-b' })
assert.equal(shouldHydrateProjectInfoModalEdit(firstOpenKey, switchedProjectKey), true, 'switching projects hydrates the new project')
assert.equal(getProjectInfoModalEditHydrationKey({ open: false, mode: 'edit', projectId: 'project-a' }), '', 'closing clears the edit hydration key')
assert.equal(getProjectInfoModalEditHydrationKey({ open: true, mode: 'create', projectId: 'project-a' }), '', 'create mode does not use edit hydration')

console.log('ProjectInfoModal JIRA save and hydration behavior is correct.')
