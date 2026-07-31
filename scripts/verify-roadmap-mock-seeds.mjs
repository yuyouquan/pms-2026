#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'

const root = process.cwd()
const require = createRequire(import.meta.url)

function resolveTypeScriptModule(specifier, parentPath = path.join(root, 'index.ts')) {
  const candidate = specifier.startsWith('@/')
    ? path.join(root, 'src', specifier.slice(2))
    : specifier.startsWith('.')
      ? path.resolve(path.dirname(parentPath), specifier)
      : null
  if (!candidate) return require.resolve(specifier)
  for (const extension of ['', '.ts', '.tsx', '.js', '.jsx']) {
    const resolved = `${candidate}${extension}`
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved
  }
  throw new Error(`Cannot resolve module "${specifier}" from ${parentPath}`)
}

function createLoader() {
  const cache = new Map()
  cache.set(
    path.join(root, 'src/components/plan/PlanModule.tsx'),
    { exports: { LEVEL1_TASKS: [], FIXED_LEVEL2_PLANS: [] } },
  )
  return function load(modulePath) {
    const resolvedPath = path.resolve(modulePath)
    if (cache.has(resolvedPath)) return cache.get(resolvedPath).exports
    const module = { exports: {} }
    cache.set(resolvedPath, module)
    const compiled = ts.transpileModule(fs.readFileSync(resolvedPath, 'utf8'), {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
      fileName: resolvedPath,
    }).outputText
    const localRequire = specifier => {
      const dependency = resolveTypeScriptModule(specifier, resolvedPath)
      if (dependency.includes(`${path.sep}node_modules${path.sep}`)) return require(dependency)
      return /\.(?:ts|tsx|js|jsx)$/.test(dependency) ? load(dependency) : require(dependency)
    }
    const wrapper = vm.runInThisContext(
      `(function (exports, require, module, __filename, __dirname) {${compiled}\n})`,
      { filename: resolvedPath },
    )
    wrapper(module.exports, localRequire, module, resolvedPath, path.dirname(resolvedPath))
    return module.exports
  }
}

const load = createLoader()
const roadmapStore = load(path.join(root, 'src/stores/roadmap.ts'))
const projectData = load(path.join(root, 'src/data/projects.ts'))
const adapter = load(path.join(root, 'src/lib/roadmapProjectAdapter.ts'))
const audit = load(path.join(root, 'src/lib/roadmapAudit.ts'))

const initial = roadmapStore.createInitialRoadmapMockState()

const historicalDuplicateState = roadmapStore.migrateRoadmapState({
  ...roadmapStore.createInitialRoadmapState(),
  tosVersions: [
    { id: 'historical-17-2-0', name: 'tOS 17.2.0' },
    { id: 'historical-17-2-1', name: 'tOS 17.2.1' },
  ],
}, 1)
roadmapStore.useRoadmapStore.setState(historicalDuplicateState)
for (const removedAction of ['createTosVersion', 'renameTosVersion', 'deleteTosVersion']) {
  if (removedAction in roadmapStore.useRoadmapStore.getState()) {
    throw new Error(`roadmap compatibility metadata still exposes ${removedAction}`)
  }
}
const metadataOnlyUpdate = roadmapStore.useRoadmapStore.getState().setTosTargets('17.2', [' target A ', 'target B'])
if (!metadataOnlyUpdate.ok) {
  throw new Error(`target metadata update on a migrated two-part version was rejected: ${JSON.stringify(metadataOnlyUpdate)}`)
}
const metadataUpdated = roadmapStore.useRoadmapStore.getState().tosVersions.find(version => version.id === '17.2')
if (
  metadataUpdated?.targets.join(',') !== 'target A,target B'
) {
  throw new Error(`metadata-only update was not atomic: ${JSON.stringify(metadataUpdated)}`)
}

const migratedPeriods = roadmapStore.migrateRoadmapState({
  ...roadmapStore.createInitialRoadmapState(),
  tosVersions: [
    { id: 'single-period', name: 'tOS 15.1', periodStartDate: '2026-01-01', periodEndDate: '' },
    { id: 'invalid-period', name: 'tOS 15.2', periodStartDate: '2026-02-30', periodEndDate: '2026-03-01' },
    { id: 'valid-period', name: 'tOS 15.3', periodStartDate: '2026-01-01', periodEndDate: '2026-12-31' },
  ],
}, 1)
for (const id of ['15.1', '15.2']) {
  const version = migratedPeriods.tosVersions.find(candidate => candidate.id === id)
  if (version?.periodStartDate || version?.periodEndDate) {
    throw new Error(`migration did not clear invalid period pair ${id}`)
  }
}
const validPeriod = migratedPeriods.tosVersions.find(version => version.id === '15.3')
if (validPeriod?.periodStartDate !== '2026-01-01' || validPeriod.periodEndDate !== '2026-12-31') {
  throw new Error('migration did not preserve a valid period pair')
}

const planned = initial.plannedProjects.find(project => project.id === 'planned-mock-x6877-android16-new')
if (!planned) throw new Error('missing planned X6877 roadmap mock')
if (planned.firstSaleTosVersionId !== '16.3') {
  throw new Error(`Android 16 planned mock must use 16.3, got ${planned.firstSaleTosVersionId}`)
}

const normal = projectData.initialProjects.find(project => project.id === '1')
if (!normal) throw new Error('missing normal X6877 project mock')
const normalRow = adapter.adaptNormalProject(normal, initial.tosVersions)
const plannedRow = adapter.adaptPlannedProject(planned)
if (!normalRow) throw new Error('normal X6877 mock does not adapt to a roadmap row')

const conflicts = adapter.deriveRoadmapPlanningConflicts([normalRow], [plannedRow])
if (
  conflicts.length !== 1
  || conflicts[0].key !== 'X6877|Android 16|新品'
  || conflicts[0].normalProjects[0]?.id !== '1'
  || conflicts[0].plannedProjects[0]?.id !== planned.id
) {
  throw new Error(`X6877 conflict was not derived from canonical sources: ${JSON.stringify(conflicts)}`)
}

if (initial.changeLogs.length !== 4) {
  throw new Error(`expected 4 initial roadmap logs, got ${initial.changeLogs.length}`)
}
const sourceActions = new Set(initial.changeLogs.map(log => `${log.source}:${log.action}`))
for (const expected of ['normal:create', 'normal:update', 'planned:create', 'planned:update']) {
  if (!sourceActions.has(expected)) throw new Error(`missing initial audit example ${expected}`)
}

const occurredAt = initial.changeLogs.map(log => log.occurredAt)
if (JSON.stringify(occurredAt) !== JSON.stringify([...occurredAt].sort().reverse())) {
  throw new Error(`initial audit logs are not newest first: ${occurredAt.join(', ')}`)
}

for (const log of initial.changeLogs.filter(log => log.action === 'update')) {
  const actualOrder = log.changes.map(change => change.field)
  const expectedOrder = audit.ROADMAP_AUDIT_FIELDS.filter(field => actualOrder.includes(field))
  if (JSON.stringify(actualOrder) !== JSON.stringify(expectedOrder)) {
    throw new Error(`update ${log.id} is not in fixed audit order: ${actualOrder.join(', ')}`)
  }
  if (log.changes.some(change => change.before === change.after)) {
    throw new Error(`update ${log.id} contains an unchanged field`)
  }
}

const hydrated = roadmapStore.migrateRoadmapState(initial, 1)
if (hydrated.plannedProjects.length !== initial.plannedProjects.length) {
  throw new Error('planned mock was dropped during hydration')
}
if (hydrated.changeLogs.length !== initial.changeLogs.length) {
  throw new Error(`audit mock was silently dropped during hydration: ${hydrated.changeLogs.length}/4`)
}
for (const source of ['normal', 'planned']) {
  if (!hydrated.changeLogs.some(log => log.source === source)) {
    throw new Error(`${source} audit records did not survive hydration`)
  }
}
if (/tOS\s*17\./i.test(JSON.stringify({ planned, changeLogs: initial.changeLogs }))) {
  throw new Error('Android 16 mock state still contains a tOS 17.x reference')
}

const legacyHydrated = roadmapStore.mergeRoadmapPersistedState(
  roadmapStore.createInitialRoadmapState(),
  roadmapStore.useRoadmapStore.getState(),
)
if (
  !legacyHydrated.plannedProjects.some(project => project.id === planned.id)
  || legacyHydrated.changeLogs.length !== initial.changeLogs.length
) {
  throw new Error('legacy empty persisted state hid the visible roadmap mocks')
}

function hydrateActualRoadmapStore(envelope) {
  const previousWindow = globalThis.window
  globalThis.window = {
    localStorage: {
      getItem: key => key === 'pms-project-roadmap' && envelope !== null
        ? JSON.stringify(envelope)
        : null,
      setItem: () => {},
      removeItem: () => {},
    },
  }
  try {
    const isolatedLoad = createLoader()
    return isolatedLoad(path.join(root, 'src/stores/roadmap.ts')).useRoadmapStore.getState()
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
}

for (const [label, envelope] of [
  ['fresh browser', null],
  ['persisted empty state', { version: 1, state: roadmapStore.createInitialRoadmapState() }],
]) {
  const state = hydrateActualRoadmapStore(envelope)
  if (state.plannedProjects.length !== 1 || state.changeLogs.length !== 4) {
    throw new Error(`${label} did not receive visible mocks through Zustand hydration`)
  }
}

const legacyVersion = {
  id: 'legacy-tos-16-3',
  name: 'tOS 16.3.0',
  major: 16,
  minor: 3,
  patch: 0,
  periodStartDate: '',
  periodEndDate: '',
  targets: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}
const legacyCatalogHydrated = hydrateActualRoadmapStore({
  version: 1,
  state: {
    ...roadmapStore.createInitialRoadmapState(),
    tosVersions: [legacyVersion],
  },
})
const legacyPlanned = legacyCatalogHydrated.plannedProjects.find(project => project.id === planned.id)
if (
  !legacyPlanned
  || legacyPlanned.firstSaleTosVersionId !== '16.3'
  || legacyCatalogHydrated.changeLogs.length !== 4
  || legacyCatalogHydrated.changeLogs.some(log => log.source === 'planned' && log.tosVersionName !== 'tOS16.3')
) {
  throw new Error('legacy tOS catalog did not receive a fully resolvable planned mock and history')
}

const logOnlyLegacyHydrated = hydrateActualRoadmapStore({
  version: 1,
  state: {
    ...roadmapStore.createInitialRoadmapState(),
    tosVersions: [legacyVersion],
    changeLogs: initial.changeLogs,
  },
})
if (
  logOnlyLegacyHydrated.plannedProjects[0]?.id !== planned.id
  || logOnlyLegacyHydrated.plannedProjects[0]?.firstSaleTosVersionId !== '16.3'
) {
  throw new Error('a prior logs-only seed prevented the missing planned mock from being repaired')
}

const oldVersionPlanned = {
  ...planned,
  firstSaleTosVersionId: 'tos-17-2',
}
const oldVersionLogs = initial.changeLogs.map(log => (
  log.source !== 'planned'
    ? log
    : {
        ...log,
        tosVersionName: 'tOS 17.2',
        snapshot: log.snapshot
          ? { ...log.snapshot, firstSaleTosVersionId: 'tOS 17.2' }
          : log.snapshot,
      }
))
const oldMockHydrated = hydrateActualRoadmapStore({
  version: 1,
  state: {
    ...initial,
    plannedProjects: [oldVersionPlanned],
    changeLogs: oldVersionLogs,
  },
})
const refreshedPlanned = oldMockHydrated.plannedProjects.find(project => project.id === planned.id)
if (
  refreshedPlanned?.firstSaleTosVersionId !== '16.3'
  || oldMockHydrated.changeLogs.length !== 4
  || /tOS\s*17\./i.test(JSON.stringify({
    planned: refreshedPlanned,
    changeLogs: oldMockHydrated.changeLogs,
  }))
) {
  throw new Error('persisted tOS 17.2 mock records were not refreshed to canonical tOS 16.3')
}

const userPlanned = {
  ...planned,
  id: 'planned-user-kept',
  projectCode: 'X9001',
  displayName: 'X9001',
}
const deletedMockHydrated = hydrateActualRoadmapStore({
  version: 1,
  state: {
    ...initial,
    plannedProjects: [userPlanned],
    changeLogs: [
      {
        ...initial.changeLogs.find(log => log.id === 'roadmap-log-mock-planned-create-x6877'),
        id: 'roadmap-log-mock-planned-delete-x6877',
        action: 'delete',
        occurredAt: '2026-07-23T01:00:00.000Z',
      },
      ...initial.changeLogs,
    ],
  },
})
if (
  deletedMockHydrated.plannedProjects.map(project => project.id).join(',') !== userPlanned.id
  || deletedMockHydrated.changeLogs.length !== 5
) {
  throw new Error('hydration re-added a deleted mock or lost user-created planned data')
}

console.log('Roadmap mock seed verification passed (1 derived conflict, 4 audit logs).')
