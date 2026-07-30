#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'

const root = process.cwd()
const require = createRequire(import.meta.url)
const moduleCache = new Map()
const assertions = []

function registerAssertion(name, assertion) {
  assertions.push({ name, assertion })
}

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

  for (const extension of ['.ts', '.tsx', '.js', '.jsx']) {
    const resolved = path.join(candidate, `index${extension}`)
    if (fs.existsSync(resolved)) return resolved
  }

  throw new Error(`Cannot resolve module "${specifier}" from ${parentPath}`)
}

function loadTypeScriptModule(modulePath) {
  const resolvedPath = path.resolve(modulePath)
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`missing shared helper: ${path.relative(root, resolvedPath)}`)
  }
  if (moduleCache.has(resolvedPath)) return moduleCache.get(resolvedPath).exports

  const module = { exports: {} }
  moduleCache.set(resolvedPath, module)
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
    const dependencyPath = resolveTypeScriptModule(specifier, resolvedPath)
    return /\.(?:ts|tsx|js|jsx)$/.test(dependencyPath)
      ? loadTypeScriptModule(dependencyPath)
      : require(dependencyPath)
  }
  const wrapper = vm.runInThisContext(
    `(function (exports, require, module, __filename, __dirname) {${compiled}\n})`,
    { filename: resolvedPath },
  )
  wrapper(module.exports, localRequire, module, resolvedPath, path.dirname(resolvedPath))
  return module.exports
}

function loadContracts() {
  const projectSummaryPath = path.join(root, 'src/lib/projectSummary.ts')
  if (!fs.existsSync(projectSummaryPath)) {
    throw new Error('missing shared helper: src/lib/projectSummary.ts')
  }

  const projectSummary = loadTypeScriptModule(projectSummaryPath)
  const projectInfoSchema = loadTypeScriptModule(path.join(root, 'src/constants/projectInfoSchema.ts'))
  const filterConditions = loadTypeScriptModule(path.join(root, 'src/lib/filterConditions.ts'))
  const requiredProjectSummaryExports = [
    'getProjectSummaryFieldDefinitions',
    'getLatestPublishedTemplateTasks',
    'getLevel1SecondLevelTasks',
    'getProjectSummaryQuickFilterDefinitions',
    'updateLinkedQuickFilterCondition',
    'getWorkbenchListState',
  ]

  for (const name of requiredProjectSummaryExports) {
    if (typeof projectSummary[name] !== 'function') {
      throw new Error(`missing shared helper: src/lib/projectSummary.ts (${name})`)
    }
  }
  for (const name of ['MACHINE_PROJECT_INFO_FIELDS', 'TOS_PROJECT_INFO_FIELDS']) {
    if (!Array.isArray(projectInfoSchema[name])) throw new Error(`missing schema export: ${name}`)
  }
  if (typeof filterConditions.applyFilterConditions !== 'function') {
    throw new Error('missing shared helper: src/lib/filterConditions.ts (applyFilterConditions)')
  }

  return { ...projectSummary, ...projectInfoSchema, ...filterConditions }
}

let contracts
try {
  contracts = loadContracts()
} catch (error) {
  console.error(`FAIL project summary shared contracts`)
  console.error(`  ${error instanceof Error ? error.message : String(error)}`)
  console.error('\nProject summary contract failed: 1 assertion(s)')
  process.exit(1)
}

const {
  getProjectSummaryFieldDefinitions,
  getLatestPublishedTemplateTasks,
  getLevel1SecondLevelTasks,
  getProjectSummaryQuickFilterDefinitions,
  updateLinkedQuickFilterCondition,
  getWorkbenchListState,
  MACHINE_PROJECT_INFO_FIELDS,
  TOS_PROJECT_INFO_FIELDS,
  applyFilterConditions,
} = contracts

registerAssertion('project-info summary fields preserve each schema order', () => {
  const projectInfoKeys = projectType => getProjectSummaryFieldDefinitions(projectType)
    .filter(field => field.source === 'projectInfo')
    .map(field => field.key)

  assert.deepEqual(projectInfoKeys('整机产品项目'), MACHINE_PROJECT_INFO_FIELDS.map(field => field.key))
  assert.deepEqual(projectInfoKeys('tOS版本项目'), TOS_PROJECT_INFO_FIELDS.map(field => field.key))
})

registerAssertion('latest published template ignores the current draft', () => {
  const versions = [
    { id: 'v3', status: '已发布' },
    { id: 'v4', status: '修订中' },
    { id: 'v2', status: '已发布' },
  ]
  const snapshots = {
    v2: [{ id: '1', taskName: '旧节点' }],
    v3: [{ id: '1', taskName: '新节点' }],
  }

  assert.deepEqual(
    getLatestPublishedTemplateTasks(versions, snapshots, 'v4', []),
    [{ id: '1', taskName: '新节点' }],
  )
})

registerAssertion('level-one summary includes only direct second-level tasks', () => {
  const tasks = [
    { id: '1', taskName: '第一阶段' },
    { id: '1.1', parentId: '1', taskName: '直属二级任务' },
    { id: '1.1.1', parentId: '1.1', taskName: '三级任务' },
    { id: '2', taskName: '第二阶段' },
    { id: '2.1', parentId: '2', taskName: '直属二级任务' },
  ]

  assert.deepEqual(getLevel1SecondLevelTasks(tasks).map(task => task.id), ['1.1', '2.1'])
})

registerAssertion('workbench list state follows the selected category', () => {
  assert.deepEqual(getWorkbenchListState('all'), {
    mode: 'select-category',
    showSecondaryCategory: false,
    showStatusQuickFilter: false,
  })
  assert.deepEqual(getWorkbenchListState('整机产品项目'), {
    mode: 'table',
    showSecondaryCategory: true,
    showStatusQuickFilter: true,
  })
  assert.deepEqual(getWorkbenchListState('tOS版本项目'), {
    mode: 'table',
    showSecondaryCategory: false,
    showStatusQuickFilter: false,
  })
  assert.deepEqual(getWorkbenchListState('技术项目'), {
    mode: 'unsupported',
    showSecondaryCategory: true,
    showStatusQuickFilter: true,
  })
})

registerAssertion('quick filters expose the expected linked project-info fields', () => {
  assert.deepEqual(
    getProjectSummaryQuickFilterDefinitions('整机产品项目').map(field => field.key),
    ['firstSaleTosVersion', 'chipCode', 'brand', 'productSeries', 'productType'],
  )
  assert.deepEqual(
    getProjectSummaryQuickFilterDefinitions('tOS版本项目').map(field => field.key),
    ['versionType', 'tosVersion'],
  )
})

registerAssertion('linked quick filters add and clear equals-any conditions', () => {
  const updated = updateLinkedQuickFilterCondition([], 'brand', ['TECNO', 'Infinix'])
  assert.equal(updated.length, 1)
  assert.equal(updated[0].field, 'brand')
  assert.equal(updated[0].operator, 'equalsAny')
  assert.deepEqual(updated[0].value, ['TECNO', 'Infinix'])
  assert.deepEqual(updateLinkedQuickFilterCondition(updated, 'brand', []), [])
})

registerAssertion('equals-any linked quick filters compose with AND semantics', () => {
  const rows = [
    { id: 1, brand: 'TECNO', productType: '新品' },
    { id: 2, brand: 'Infinix', productType: '老品' },
    { id: 3, brand: 'itel', productType: '新品' },
  ]
  const filtered = applyFilterConditions(rows, [
    { id: 'brand', field: 'brand', operator: 'equalsAny', value: ['TECNO', 'Infinix'] },
    { id: 'productType', field: 'productType', operator: 'equalsAny', value: ['新品'] },
  ])

  assert.deepEqual(filtered.map(row => row.id), [1])
})

let failureCount = 0
for (const { name, assertion } of assertions) {
  try {
    assertion()
    console.log(`PASS ${name}`)
  } catch (error) {
    failureCount += 1
    console.error(`FAIL ${name}`)
    console.error(`  ${error instanceof Error ? error.message : String(error)}`)
  }
}

if (failureCount) {
  console.error(`\nProject summary contract failed: ${failureCount} assertion(s)`)
  process.exitCode = 1
} else {
  console.log('\nProject summary contract passed')
}
