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
const planned = initial.plannedProjects.find(project => project.id === 'planned-mock-x6877-android16-new')
if (!planned) throw new Error('missing planned X6877 roadmap mock')

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

console.log('Roadmap mock seed verification passed (1 derived conflict, 4 audit logs).')
