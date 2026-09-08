#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { loadTypeScriptModule } from './lib/source-contract.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const modulePath = path.join(root, 'src/lib/mockDatasetStorage.ts')
assert.ok(fs.existsSync(modulePath), 'mock dataset storage must gate persistence before hydration')
const source = fs.readFileSync(modulePath, 'utf8')
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function verifyStorageEntrypoints(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) verifyStorageEntrypoints(entryPath)
    else if (/\.tsx?$/.test(entry.name) && entryPath !== modulePath) {
      const entrySource = fs.readFileSync(entryPath, 'utf8')
      assert.doesNotMatch(entrySource, /\b(?:localStorage|sessionStorage)\s*\.\s*(?:getItem|setItem|removeItem|clear)\s*\(/, `${path.relative(root, entryPath)} must not bypass the dataset storage guard`)
      assert.doesNotMatch(entrySource, /createJSONStorage\(\s*\(\)\s*=>\s*(?:window\.)?localStorage\s*\)/, `${path.relative(root, entryPath)} must guard automatic hydration`)
    }
  }
}
verifyStorageEntrypoints(path.join(root, 'src'))

function memoryStorage(entries = []) {
  const values = new Map(entries)
  const removed = []
  return {
    values,
    removed,
    get length() { return values.size },
    key(index) { return [...values.keys()][index] ?? null },
    getItem(key) { return values.get(key) ?? null },
    setItem(key, value) { values.set(key, String(value)) },
    removeItem(key) { removed.push(key); values.delete(key) },
    clear() { assert.fail('dataset refresh must never clear unrelated application storage') },
  }
}

function load(window) {
  const context = vm.createContext({ exports: {}, ...(window ? { window } : {}) })
  vm.runInContext(output, context, { filename: modulePath })
  return context.exports
}

const localKeys = [
  'pms-projects',
  'pms-project-permissions',
  'pms-plan-store',
  'pms-enum-values',
  'pms-project-roadmap',
  'pms-technical-projects',
  'pms-technical-plans',
  'pms-mr-version-plan-store',
  'pms-level3-plan-store',
  'pms_roadmap_milestone_views',
  'pms_project_custom_views',
  'pms:project-creation-draft:user-a',
  'pms:project-creation-draft:user-b',
  'pms:project-summary:v1:workbench:software',
  'pms:project-summary:v2:summary:machine:summary',
  'pms%3Aproject-field-visibility%3Av1:user-a:project-a:basic',
]
const unrelatedKeys = [
  'other-app:project',
  'pms-unrelated-app',
  'pms:another-application',
  'pms-projects-backup',
  'pms_project_custom_views_extra',
]
const sessionKey = 'pms:technical-project-list-target-child'
const localStorage = memoryStorage([...localKeys, ...unrelatedKeys].map(key => [key, 'legacy synthetic fixture']))
const sessionStorage = memoryStorage([[sessionKey, 'legacy-child'], ['other-app:session', 'keep']])
const api = load({ localStorage, sessionStorage })

for (const key of localKeys) assert.equal(localStorage.getItem(key), null, `startup removes ${key}`)
for (const key of unrelatedKeys) assert.equal(localStorage.getItem(key), 'legacy synthetic fixture', `startup retains ${key}`)
assert.equal(sessionStorage.getItem(sessionKey), null, 'startup removes the stale technical-project navigation target')
assert.equal(sessionStorage.getItem('other-app:session'), 'keep', 'session refresh retains unrelated application data')
assert.equal(localStorage.getItem(api.MOCK_DATASET_VERSION_STORAGE_KEY), api.MOCK_DATASET_VERSION)
assert.equal(sessionStorage.getItem(api.MOCK_DATASET_VERSION_STORAGE_KEY), api.MOCK_DATASET_VERSION)

api.pmsLocalStorage.setItem('pms-projects', 'new project edit')
api.pmsLocalStorage.setItem('pms:project-creation-draft:user-a', 'new draft')
api.pmsSessionStorage.setItem(sessionKey, 'new-child')
const removalCount = localStorage.removed.length
const reloadedApi = load({ localStorage, sessionStorage })
assert.equal(reloadedApi.pmsLocalStorage.getItem('pms-projects'), 'new project edit', 'fresh module/browser reload keeps edits from the current dataset')
assert.equal(reloadedApi.pmsLocalStorage.getItem('pms:project-creation-draft:user-a'), 'new draft', 'current drafts survive reload')
assert.equal(reloadedApi.pmsSessionStorage.getItem(sessionKey), 'new-child', 'new one-shot navigation targets survive initialization')
assert.equal(localStorage.removed.length, removalCount, 'matching dataset version does not repeat cleanup')

const staleLocal = memoryStorage([
  [api.MOCK_DATASET_VERSION_STORAGE_KEY, 'older-dataset'],
  ['pms-projects', 'stale projects'],
])
const upgraded = load({ localStorage: staleLocal, sessionStorage: memoryStorage() })
assert.equal(upgraded.pmsLocalStorage.getItem('pms-projects'), null, 'an old version is refreshed before the first consumer read')
assert.equal(staleLocal.getItem(api.MOCK_DATASET_VERSION_STORAGE_KEY), api.MOCK_DATASET_VERSION)

const lazyWindow = {}
const lazy = load(lazyWindow)
lazyWindow.localStorage = memoryStorage([['pms-plan-store', 'stale snapshot']])
lazyWindow.sessionStorage = memoryStorage()
assert.equal(lazy.pmsLocalStorage.getItem('pms-plan-store'), null, 'storage that becomes available later still refreshes before hydration')

const failedRemoval = memoryStorage([['pms-projects', 'stale project'], ['pms-plan-store', 'stale plan']])
failedRemoval.removeItem = key => {
  if (key === 'pms-plan-store') throw new Error('storage removal blocked')
  failedRemoval.values.delete(key)
}
const failed = load({ localStorage: failedRemoval, sessionStorage: memoryStorage() })
assert.equal(failedRemoval.getItem('pms-plan-store'), 'stale plan', 'fixture retains an undeletable legacy value')
assert.equal(failed.pmsLocalStorage.getItem('pms-plan-store'), null, 'failed cleanup never exposes residual old values')
assert.equal(failedRemoval.getItem(api.MOCK_DATASET_VERSION_STORAGE_KEY), null, 'partial cleanup is never marked complete')
assert.throws(() => failed.getPmsLocalStorage(), /blocked/, 'strict consumers retain observable persistence errors')
failed.pmsLocalStorage.setItem('pms-projects', 'unsaved edit')
assert.equal(failedRemoval.getItem('pms-projects'), null, 'writes cannot bypass incomplete cleanup')

const failedMarker = memoryStorage([['pms-plan-store', 'stale plan']])
failedMarker.setItem = () => { throw new Error('storage quota exceeded') }
const quota = load({ localStorage: failedMarker, sessionStorage: memoryStorage() })
assert.equal(quota.pmsLocalStorage.getItem('pms-plan-store'), null, 'marker write failure cannot leak old values')
assert.throws(() => quota.getPmsLocalStorage(), /quota/, 'strict consumers can report marker persistence failures')

const blockedWindow = { sessionStorage: memoryStorage([[sessionKey, 'stale-child']]) }
Object.defineProperty(blockedWindow, 'localStorage', { get() { throw new Error('storage blocked') } })
const blocked = load(blockedWindow)
assert.equal(blocked.pmsLocalStorage.getItem('pms-projects'), null, 'blocked storage getter is safe')
assert.doesNotThrow(() => blocked.pmsLocalStorage.setItem('pms-projects', 'temporary edit'))
assert.doesNotThrow(() => blocked.pmsLocalStorage.removeItem('pms-projects'))
assert.equal(blockedWindow.sessionStorage.getItem(sessionKey), null, 'local storage failure does not prevent independent session cleanup')

const ssr = load()
assert.equal(ssr.pmsLocalStorage.getItem('pms-projects'), null, 'SSR has safe empty storage reads')
assert.equal(ssr.pmsSessionStorage.getItem(sessionKey), null, 'SSR has safe empty session reads')
assert.doesNotThrow(() => ssr.pmsLocalStorage.setItem('pms-projects', 'server edit'))
assert.doesNotThrow(() => ssr.refreshMockDatasetStorage())

const previousWindow = globalThis.window
try {
  const browserStorage = memoryStorage(localKeys.map(key => [key, 'legacy fixture before store import']))
  const session = memoryStorage([[sessionKey, 'legacy-child']])
  globalThis.window = { localStorage: browserStorage, sessionStorage: session, location: { href: 'https://prototype.example.test/' } }
  const project = loadTypeScriptModule(root, 'src/stores/project.ts').useProjectStore
  assert.ok(project.getState().projects.length > 0, 'automatic hydration starts with the refreshed seed projects')
  for (const key of localKeys) assert.notEqual(browserStorage.getItem(key), 'legacy fixture before store import', `store import has already removed ${key}`)
  const editedProjectId = project.getState().projects[0].id
  project.getState().setProjects(projects => projects.map(item => item.id === editedProjectId ? { ...item, remark: 'current synthetic project edit' } : item))
  // Alter only memory, then verify hydration restores the durable edit from the active dataset.
  project.getState().projects.find(item => item.id === editedProjectId).remark = 'temporary memory value'
  await project.persist.rehydrate()
  assert.equal(project.getState().projects.find(item => item.id === editedProjectId).remark, 'current synthetic project edit', 'actual project-store hydration keeps post-refresh edits')
  const draftModule = loadTypeScriptModule(root, 'src/lib/projectCreationDraft.ts')
  const draft = { schemaVersion: draftModule.PROJECT_CREATION_DRAFT_SCHEMA_VERSION, ownerId: 'user-a', values: { name: 'current synthetic draft' }, activeGroups: [], updatedAt: '2026-09-08T00:00:00.000Z' }
  await draftModule.defaultProjectCreationDraftRepository.save(draft)
  assert.deepEqual(await new draftModule.LocalStorageProjectCreationDraftRepository().get('user-a'), draft, 'new draft repositories restore drafts from the active dataset')
  const utils = loadTypeScriptModule(root, 'src/components/roadmap/utils.ts')
  const state = { scope: 'overall', statusFilter: 'all', visibleColumns: [], filters: [], collapsedKeys: [], sharedRows: [{ projectName: 'new synthetic snapshot' }] }
  const savedView = { id: 'new-view', kind: 'summary-board', name: 'new synthetic view', state, createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' }
  utils.saveProjectView(savedView)
  assert.deepEqual(utils.loadProjectViews('summary-board'), [savedView], 'views created after refresh survive later guarded reads')
  const sharedUrl = utils.createProjectViewShareUrl('summary-board', state, 'new synthetic view')
  const sharedPayload = JSON.parse(new URL(sharedUrl).searchParams.get('pmsProjectViewShare'))
  assert.equal(sharedPayload.datasetVersion, api.MOCK_DATASET_VERSION, 'new snapshot links identify the active dataset')
  globalThis.window.location.href = sharedUrl
  assert.deepEqual(utils.parseProjectViewShare('summary-board').state, state, 'current snapshot content remains usable')

  for (const datasetVersion of [undefined, 'older-dataset']) {
    const legacyUrl = new URL('https://prototype.example.test/')
    legacyUrl.searchParams.set('pmsProjectViewShare', JSON.stringify({ kind: 'summary-board', datasetVersion, name: 'legacy fixture', state: { sharedRows: [{ projectName: 'legacy fixture' }] } }))
    globalThis.window.location.href = legacyUrl.toString()
    assert.deepEqual(utils.parseProjectViewShare('summary-board'), { expired: true }, 'old snapshot payloads expose only expiration and never any legacy content')
    assert.equal(utils.parseProjectViewShare('roadmap-milestone'), null, 'a different view type does not consume the link')
  }
  globalThis.window.location.href = 'https://prototype.example.test/share/plan?projectId=1&level=level1'
  assert.equal(utils.parseProjectViewShare('summary-board'), null, 'dynamic ID-only plan sharing is unaffected')

  for (const file of ['src/components/roadmap/MilestoneView.tsx', 'src/components/roadmap/ProjectPlanSummaryBoard.tsx']) {
    const component = fs.readFileSync(path.join(root, file), 'utf8')
    assert.match(component, /if\s*\([^\n]*expired[^\n]*\)\s*\{[\s\S]{0,220}分享链接已过期[\s\S]{0,120}return/, `${file} reports expiration before applying shared state`)
  }
} finally {
  if (previousWindow === undefined) delete globalThis.window
  else globalThis.window = previousWindow
}

console.log('Mock dataset storage verification passed: startup, allowlist, reload, lazy access, partial failure, blocked storage, SSR, hydration, snapshot expiration')
