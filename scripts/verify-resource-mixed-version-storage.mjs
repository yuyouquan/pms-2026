import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { resolveTypeScriptModule } from './lib/typescript-module-loader.mjs'

const root = process.cwd()
const require = createRequire(import.meta.url)
const sources = new Map()
function createRevisionLoader(revision) {
  const modules = new Map()
  const load = filename => {
    const resolved = path.resolve(filename)
    if (modules.has(resolved)) return modules.get(resolved).exports
    const module = { exports: {} }
    modules.set(resolved, module)
    const relative = path.relative(root, resolved)
    const key = `${revision}:${relative}`
    const fromGit = revision && relative.startsWith('src/')
    if (fromGit && !sources.has(key)) sources.set(key, execFileSync('git', ['show', key], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }))
    const source = fromGit ? sources.get(key) : fs.readFileSync(resolved, 'utf8')
    const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: resolved }).outputText
    const localRequire = specifier => {
      const dependency = resolveTypeScriptModule(specifier, resolved)
      if (/\.(?:css|less|scss|sass)$/.test(dependency)) return {}
      return /\.(?:ts|tsx|js|jsx)$/.test(dependency) ? load(dependency) : require(dependency)
    }
    vm.runInThisContext(`(function(exports,require,module,__filename,__dirname){${compiled}\n})`, { filename: `${revision || 'current'}:${relative}` })(module.exports, localRequire, module, resolved, path.dirname(resolved))
    return module.exports
  }
  return file => load(path.resolve(file))
}

function runScenario(legacyRevision, currentRevision) {
  const values = new Map([['pms:mock-dataset-version', '2026-09-15-v1']])
  const windows = [], queue = [], writes = []
  let activeTab = -1
  const storage = {
    get length() { return values.size }, key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(key) ?? null,
    setItem(key, input) {
      const value = String(input), oldValue = values.get(key) ?? null
      values.set(key, value)
      if (oldValue === value) return
      const payload = key.startsWith('pms-') ? JSON.parse(value) : null
      writes.push({ tab: activeTab, key, version: payload?.version })
      if (activeTab < 0) return
      windows.forEach((target, index) => { if (target && index !== activeTab) queue.push({ target, index, key, oldValue, newValue: value }) })
    },
    removeItem: key => values.delete(key),
  }
  globalThis.localStorage = storage
  const inTab = (index, action) => {
    const previous = globalThis.window, previousTab = activeTab
    globalThis.window = windows[index]; activeTab = index
    try { return action() } finally { globalThis.window = previous; activeTab = previousTab }
  }
  const open = (index, revision) => {
    windows[index] = new EventTarget(); windows[index].localStorage = storage
    return inTab(index, () => {
      const get = createRevisionLoader(revision)
      const machine = get('src/stores/hrMachine.ts').useHrMachineStore
      const plan = get('src/stores/plan.ts').usePlanStore
      const stop = get('src/hooks/useHrFormalProjectSync.ts').startHrFormalProjectSync(windows[index])
      return { get, machine, plan, stop }
    })
  }
  const settle = (label, limit = 40) => {
    let delivered = 0
    while (queue.length && delivered < limit) {
      const item = queue.shift(); delivered += 1
      inTab(item.index, () => {
        const event = new Event('storage')
        Object.assign(event, { key: item.key, oldValue: item.oldValue, newValue: item.newValue, storageArea: storage })
        item.target.dispatchEvent(event)
      })
    }
    assert.equal(queue.length, 0, `${legacyRevision} / ${label}: storage did not settle in ${limit} events; recent writes=${JSON.stringify(writes.slice(-10))}`)
    return delivered
  }
  const legacy = open(0, legacyRevision)
  const current = open(1, currentRevision)
  const init = settle('initial hydration')
  const project = () => current.machine.getState().projects.find(item => item.pmsProjectId === 'mock-budget-machine-unbound')
  assert.ok(project(), 'editable machine fixture is available')
  const createdId = inTab(1, () => current.machine.getState().createResourceVersion(project().id, 'annual', project().pmsProjectId, { sourceVersionId: project().versions.at(-1).id, versionNumber: 'V混合版本验收' }))
  const copy = settle('new version creation')
  const latest = () => project().versions.find(version => version.id === createdId)
  assert.ok(latest(), 'new version remains after storage synchronization')
  const snapshotKey = 'project::mixed-version::OP::level1::saved'
  const snapshot = current.get('src/lib/level1PlanRules.ts').buildMachineLevel1Tasks(false)
  snapshot.find(task => task.stableId === 'machine-ms-str5').planEndDate = '2032-09-20'
  snapshot.push({ id: 'mixed-custom-task', stableId: 'mixed-custom-task', parentId: snapshot.find(task => task.stableId === 'machine-stage-development').id,
    order: 7, taskName: '用户自定义保留', source: 'custom', planEndDate: '2032-08-19', ownerMemo: '跨版本保留' })
  inTab(1, () => current.plan.getState().setPublishedSnapshots(previous => ({ ...previous, [snapshotKey]: snapshot })))
  const planEvents = settle('saved plan snapshot update')
  assert.deepEqual(legacy.plan.getState().publishedSnapshots[snapshotKey], snapshot, 'old tab preserves split plan tasks, IDs and dates')
  assert.deepEqual(JSON.parse(storage.getItem('pms-plan-store')).state.publishedSnapshots[snapshotKey], snapshot, 'stored plan update is not rolled back by old migration')
  const expense = latest().nonLaborInvestment.items[0]
  assert.ok(expense, 'copied version includes an expense row')
  inTab(1, () => current.machine.getState().updateVersionInline(project().id, createdId, { type: 'nonLaborItemTotal', itemId: expense.id, value: 27182.82 }, project().pmsProjectId))
  const expenseEvents = settle('expense total change')
  const saved = structuredClone(latest())
  assert.ok(saved, 'edited version remains selected by its stable ID')
  const remote = legacy.machine.getState().projects.find(item => item.id === project().id).versions.find(version => version.id === createdId)
  assert.deepEqual(remote, saved, 'legacy tab retains the complete new version and edited expense data')
  const durable = JSON.parse(storage.getItem('pms-hr-machine')).state.projects.find(item => item.id === project().id).versions.find(version => version.id === createdId)
  assert.deepEqual(durable, saved, 'durable storage retains all newly saved data')
  inTab(0, () => legacy.machine.getState().updateVersionInline(project().id, createdId, { type: 'nonLaborItemTotal', itemId: expense.id, value: 31828.18 }, project().pmsProjectId))
  const reverse = settle('old tab edits newly created version')
  const legacyEdited = legacy.machine.getState().projects.find(item => item.id === project().id).versions.find(version => version.id === createdId)
  assert.deepEqual(latest(), legacyEdited, 'old-to-new expense editing preserves the new custom version')
  const expected = structuredClone(latest())
  writes.length = 0
  inTab(1, () => { current.machine.persist.rehydrate(); current.plan.persist.rehydrate() })
  const repeat = settle('repeated hydration')
  assert.deepEqual(latest(), expected, 'repeated hydration never rolls back versions')
  legacy.stop(); current.stop()
  console.log(`PASS mixed ${legacyRevision}/${currentRevision || 'current'}: init=${init}, create=${copy}, plan=${planEvents}, expense=${expenseEvents}, reverse=${reverse}, reload=${repeat}`)
}

for (const revision of process.env.PMS_LEGACY_REVISION ? [process.env.PMS_LEGACY_REVISION] : ['aba37e2', 'c969caa']) {
  runScenario(revision, process.env.PMS_CURRENT_REVISION)
}
