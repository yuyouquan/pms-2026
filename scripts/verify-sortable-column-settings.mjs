#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'

const root = process.cwd()
const require = createRequire(import.meta.url)
const assertions = []
const typeScriptModuleCache = new Map()

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

function loadTypeScriptModule(modulePath, moduleCache = typeScriptModuleCache) {
  const resolvedPath = path.resolve(modulePath)
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`missing shared helper: ${path.relative(root, resolvedPath)}`)
  }
  if (moduleCache.has(resolvedPath)) return moduleCache.get(resolvedPath).exports

  const module = { exports: {} }
  moduleCache.set(resolvedPath, module)
  const source = fs.readFileSync(resolvedPath, 'utf8')
  const compiled = ts.transpileModule(source, {
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
      ? loadTypeScriptModule(dependencyPath, moduleCache)
      : require(dependencyPath)
  }
  const wrapper = vm.runInThisContext(
    `(function (exports, require, module, __filename, __dirname) {${compiled}\n})`,
    { filename: resolvedPath },
  )
  wrapper(module.exports, localRequire, module, resolvedPath, path.dirname(resolvedPath))
  return module.exports
}

function parseTypeScript(filePath) {
  const source = fs.readFileSync(filePath, 'utf8')
  return {
    source,
    sourceFile: ts.createSourceFile(
      filePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    ),
  }
}

function importsSortableColumnSettings(filePath) {
  const { sourceFile } = parseTypeScript(filePath)
  return sourceFile.statements.some(statement => (
    ts.isImportDeclaration(statement)
    && ts.isStringLiteral(statement.moduleSpecifier)
    && statement.moduleSpecifier.text === '@/components/shared/SortableColumnSettings'
    && statement.importClause
    && (
      statement.importClause.name?.text === 'SortableColumnSettings'
      || statement.importClause.namedBindings
        && ts.isNamedImports(statement.importClause.namedBindings)
        && statement.importClause.namedBindings.elements.some(element => (
          (element.propertyName?.text ?? element.name.text) === 'SortableColumnSettings'
        ))
    )
  ))
}

function collectVariableInitializers(scope) {
  const initializers = new Map()
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      initializers.set(node.name.text, node.initializer)
    }
    ts.forEachChild(node, visit)
  }
  visit(scope)
  return initializers
}

function returnedExpressions(functionLike) {
  if (!functionLike) return []
  if (!ts.isBlock(functionLike.body)) return [functionLike.body]
  const expressions = []
  function visit(node) {
    if (ts.isFunctionLike(node) && node !== functionLike) return
    if (ts.isReturnStatement(node) && node.expression) expressions.push(node.expression)
    ts.forEachChild(node, visit)
  }
  visit(functionLike.body)
  return expressions
}

function findFunctionLike(scope, functionName) {
  let result
  function visit(node) {
    if (result) return
    if (
      ts.isFunctionDeclaration(node)
      && node.name?.text === functionName
      && node.body
    ) {
      result = node
      return
    }
    if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.name.text === functionName
      && node.initializer
      && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      result = node.initializer
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(scope)
  return result
}

function importedLocalNames(sourceFile, moduleSpecifier, exportedName) {
  const names = new Set()
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement)
      || !ts.isStringLiteral(statement.moduleSpecifier)
      || statement.moduleSpecifier.text !== moduleSpecifier
      || !statement.importClause?.namedBindings
      || !ts.isNamedImports(statement.importClause.namedBindings)
    ) continue
    for (const element of statement.importClause.namedBindings.elements) {
      if ((element.propertyName?.text ?? element.name.text) === exportedName) names.add(element.name.text)
    }
  }
  return names
}

function collectBindingNames(name, names) {
  if (ts.isIdentifier(name)) {
    names.add(name.text)
    return
  }
  for (const element of name.elements) {
    if (!ts.isOmittedExpression(element)) collectBindingNames(element.name, names)
  }
}

function createRenderAnalysis(sourceFile, componentName) {
  const component = findFunctionLike(sourceFile, componentName)
  if (!component) return null
  const initializers = collectVariableInitializers(component)
  const configuredNames = new Set()
  for (const parameter of component.parameters) collectBindingNames(parameter.name, configuredNames)

  function collectStateAndHookBindings(node) {
    if (ts.isFunctionLike(node) && node !== component) return
    if (ts.isVariableDeclaration(node) && node.initializer) {
      if (
        ts.isArrayBindingPattern(node.name)
        && ts.isCallExpression(node.initializer)
        && ts.isIdentifier(node.initializer.expression)
        && node.initializer.expression.text === 'useState'
      ) {
        const first = node.name.elements[0]
        if (first && !ts.isOmittedExpression(first)) collectBindingNames(first.name, configuredNames)
      }
      if (
        ts.isCallExpression(node.initializer)
        && ts.isIdentifier(node.initializer.expression)
        && /^use[A-Z]/.test(node.initializer.expression.text)
        && !['useMemo', 'useCallback'].includes(node.initializer.expression.text)
      ) {
        collectBindingNames(node.name, configuredNames)
      }
      if (
        !ts.isIdentifier(node.name)
        && ts.isIdentifier(node.initializer)
        && configuredNames.has(node.initializer.text)
      ) {
        collectBindingNames(node.name, configuredNames)
      }
    }
    ts.forEachChild(node, collectStateAndHookBindings)
  }
  collectStateAndHookBindings(component)

  return {
    sourceFile,
    component,
    initializers,
    configuredNames,
    orderHelperNames: importedLocalNames(sourceFile, '@/lib/columnSettings', 'orderVisibleDefinitions'),
    normalizeHelperNames: importedLocalNames(sourceFile, '@/lib/columnSettings', 'normalizeColumnSettings'),
  }
}

function resolveFunction(expression, analysis, resolving = new Set()) {
  if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression) || ts.isFunctionDeclaration(expression)) {
    return expression
  }
  if (!ts.isIdentifier(expression) || resolving.has(expression.text)) return null
  const next = new Set(resolving)
  next.add(expression.text)
  const declared = findFunctionLike(analysis.sourceFile, expression.text)
  if (declared) return declared
  const initializer = analysis.initializers.get(expression.text)
  return initializer ? resolveFunction(initializer, analysis, next) : null
}

function hasConfiguredOrder(expression, analysis, resolving = new Set()) {
  if (
    ts.isParenthesizedExpression(expression)
    || ts.isAsExpression(expression)
    || ts.isTypeAssertionExpression(expression)
    || ts.isNonNullExpression(expression)
  ) {
    return hasConfiguredOrder(expression.expression, analysis, resolving)
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text === 'order'
      && hasConfiguredOrder(expression.expression, analysis, resolving)
  }
  if (ts.isElementAccessExpression(expression)) {
    return hasConfiguredOrder(expression.expression, analysis, resolving)
  }
  if (ts.isArrayLiteralExpression(expression)) {
    return expression.elements.some(element => (
      hasConfiguredOrder(ts.isSpreadElement(element) ? element.expression : element, analysis, resolving)
    ))
  }
  if (ts.isObjectLiteralExpression(expression)) {
    return expression.properties.some(property => (
      (
        ts.isPropertyAssignment(property)
        && property.name.getText().replaceAll(/['"]/g, '') === 'order'
        && hasConfiguredOrder(property.initializer, analysis, resolving)
      )
      || (
        ts.isShorthandPropertyAssignment(property)
        && property.name.text === 'order'
        && hasConfiguredOrder(property.name, analysis, resolving)
      )
    ))
  }
  if (
    ts.isCallExpression(expression)
    && ts.isIdentifier(expression.expression)
    && analysis.normalizeHelperNames.has(expression.expression.text)
  ) {
    return Boolean(expression.arguments[1] && hasConfiguredOrder(expression.arguments[1], analysis, resolving))
  }
  if (
    ts.isCallExpression(expression)
    && ts.isIdentifier(expression.expression)
    && ['useMemo', 'useCallback'].includes(expression.expression.text)
    && expression.arguments[0]
  ) {
    const callback = resolveFunction(expression.arguments[0], analysis)
    if (!callback) return false
    const nested = { ...analysis, initializers: new Map([...analysis.initializers, ...collectVariableInitializers(callback)]) }
    return returnedExpressions(callback).some(result => hasConfiguredOrder(result, nested, resolving))
  }
  if (ts.isIdentifier(expression)) {
    if (resolving.has(expression.text)) return false
    if (
      analysis.configuredNames.has(expression.text)
      && /order|setting|column/i.test(expression.text)
    ) return true
    const initializer = analysis.initializers.get(expression.text)
    if (!initializer) return false
    const next = new Set(resolving)
    next.add(expression.text)
    return hasConfiguredOrder(initializer, analysis, next)
  }
  return false
}

function expressionUsesOrderedResult(expression, analysis, resolving = new Set()) {
  if (
    ts.isCallExpression(expression)
    && ts.isIdentifier(expression.expression)
    && analysis.orderHelperNames.has(expression.expression.text)
  ) {
    return Boolean(expression.arguments[1] && hasConfiguredOrder(expression.arguments[1], analysis))
  }
  if (ts.isIdentifier(expression)) {
    if (resolving.has(expression.text)) return false
    const initializer = analysis.initializers.get(expression.text)
    if (!initializer) return false
    const next = new Set(resolving)
    next.add(expression.text)
    return expressionUsesOrderedResult(initializer, analysis, next)
  }
  if (ts.isCallExpression(expression)) {
    if (
      ts.isIdentifier(expression.expression)
      && ['useMemo', 'useCallback'].includes(expression.expression.text)
      && expression.arguments[0]
    ) {
      const callback = resolveFunction(expression.arguments[0], analysis)
      if (callback) {
        const nested = { ...analysis, initializers: new Map([...analysis.initializers, ...collectVariableInitializers(callback)]) }
        return returnedExpressions(callback).some(result => expressionUsesOrderedResult(result, nested, resolving))
      }
    }
    const callable = resolveFunction(expression.expression, analysis)
    if (callable) {
      const nested = { ...analysis, initializers: new Map([...analysis.initializers, ...collectVariableInitializers(callable)]) }
      return returnedExpressions(callable).some(result => expressionUsesOrderedResult(result, nested, resolving))
    }
    return expressionUsesOrderedResult(expression.expression, analysis, resolving)
  }
  if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
    return expressionUsesOrderedResult(expression.expression, analysis, resolving)
  }
  if (ts.isParenthesizedExpression(expression)) {
    return expressionUsesOrderedResult(expression.expression, analysis, resolving)
  }
  if (ts.isConditionalExpression(expression)) {
    return expressionUsesOrderedResult(expression.whenTrue, analysis, resolving)
      && expressionUsesOrderedResult(expression.whenFalse, analysis, resolving)
  }
  if (ts.isArrayLiteralExpression(expression)) {
    return expression.elements.some(element => (
      expressionUsesOrderedResult(ts.isSpreadElement(element) ? element.expression : element, analysis, resolving)
    ))
  }
  return false
}

function visitReturnedRender(analysis, visitor) {
  const visitedExpressions = new Set()
  function visit(node) {
    if (!node || visitedExpressions.has(node)) return
    visitedExpressions.add(node)
    visitor(node)
    if (ts.isIdentifier(node)) {
      const initializer = analysis.initializers.get(node.text)
      if (initializer) visit(initializer)
    }
    if (ts.isCallExpression(node)) {
      const callable = resolveFunction(node.expression, analysis)
      if (callable) returnedExpressions(callable).forEach(visit)
    }
    ts.forEachChild(node, visit)
  }
  returnedExpressions(analysis.component).forEach(visit)
}

function returnedRenderHasOrderedColumns(analysis, elementName) {
  let found = false
  visitReturnedRender(analysis, node => {
    if (
      found
      || (!ts.isJsxSelfClosingElement(node) && !ts.isJsxOpeningElement(node))
      || node.tagName.getText() !== elementName
    ) return
    const attribute = node.attributes.properties.find(property => (
      ts.isJsxAttribute(property) && property.name.getText() === 'columns'
    ))
    const expression = attribute
      && ts.isJsxAttribute(attribute)
      && attribute.initializer
      && ts.isJsxExpression(attribute.initializer)
      ? attribute.initializer.expression
      : undefined
    if (expression && expressionUsesOrderedResult(expression, analysis)) found = true
  })
  return found
}

function returnedRenderHasOrderedMap(analysis) {
  let found = false
  visitReturnedRender(analysis, node => {
    if (
      ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === 'map'
      && expressionUsesOrderedResult(node.expression.expression, analysis)
    ) found = true
  })
  return found
}

function componentAssignsOrderedGanttColumns(analysis) {
  let found = false
  function visit(node) {
    if (
      ts.isBinaryExpression(node)
      && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && node.left.getText().endsWith('gantt.config.columns')
      && expressionUsesOrderedResult(node.right, analysis)
    ) found = true
    ts.forEachChild(node, visit)
  }
  visit(analysis.component)
  return found
}

function returnedRenderPassesConfiguredOrder(analysis, elementName) {
  let found = false
  visitReturnedRender(analysis, node => {
    if (
      found
      || (!ts.isJsxSelfClosingElement(node) && !ts.isJsxOpeningElement(node))
      || node.tagName.getText() !== elementName
    ) return
    found = node.attributes.properties.some(property => {
      if (
        !ts.isJsxAttribute(property)
        || !/order|setting|column/i.test(property.name.getText())
        || !property.initializer
        || !ts.isJsxExpression(property.initializer)
        || !property.initializer.expression
      ) return false
      return hasConfiguredOrder(property.initializer.expression, analysis)
    })
  })
  return found
}

const definitions = [
  { key: 'id', title: '序号', defaultVisible: true, hideable: false, fixed: 'left' },
  { key: 'name', title: '任务名称', defaultVisible: true, hideable: false },
  { key: 'owner', title: '责任人', defaultVisible: true },
  { key: 'status', title: '状态', defaultVisible: false },
]

registerAssertion('shared column-settings helper implements normalization, movement, and display ordering', () => {
  const helperPath = path.join(root, 'src/lib/columnSettings.ts')
  const {
    getColumnDefinitionSignature,
    getDefaultColumnSettings,
    getSortableColumnAccessibilityLabel,
    moveColumnSetting,
    normalizeColumnSettings,
    orderVisibleDefinitions,
  } = loadTypeScriptModule(helperPath)

  for (const [name, value] of Object.entries({
    getColumnDefinitionSignature,
    getDefaultColumnSettings,
    getSortableColumnAccessibilityLabel,
    normalizeColumnSettings,
    moveColumnSetting,
    orderVisibleDefinitions,
  })) {
    if (typeof value !== 'function') throw new Error(`missing export: ${name}`)
  }

  assert.deepEqual(
    getDefaultColumnSettings(definitions),
    {
      order: ['id', 'name', 'owner', 'status'],
      visible: ['id', 'name', 'owner'],
    },
  )

  assert.deepEqual(
    normalizeColumnSettings(definitions, null),
    getDefaultColumnSettings(definitions),
  )

  assert.deepEqual(
    normalizeColumnSettings(definitions, ['status', 'unknown', 'status']),
    {
      order: ['id', 'name', 'owner', 'status'],
      visible: ['id', 'name', 'status'],
    },
  )

  assert.deepEqual(
    normalizeColumnSettings(definitions, { order: [], visible: [] }),
    getDefaultColumnSettings(definitions),
  )

  assert.deepEqual(
    normalizeColumnSettings(definitions, {
      order: ['id', 'name', 'owner', 'status'],
      visible: ['id', 'name'],
    }),
    getDefaultColumnSettings(definitions),
  )

  assert.deepEqual(
    normalizeColumnSettings(definitions, {
      order: ['owner', 'unknown', 'owner', 'id'],
      visible: ['owner', 'unknown'],
    }),
    {
      order: ['id', 'owner', 'name', 'status'],
      visible: ['id', 'name', 'owner'],
    },
  )

  assert.deepEqual(
    moveColumnSetting(definitions, ['id', 'name', 'owner', 'status'], 'name', 'status'),
    ['id', 'owner', 'status', 'name'],
  )

  assert.deepEqual(
    moveColumnSetting(definitions, ['id', 'name', 'owner', 'status'], 'owner', 'id'),
    ['id', 'owner', 'name', 'status'],
  )

  assert.deepEqual(
    orderVisibleDefinitions(definitions, {
      order: ['id', 'status', 'name', 'owner'],
      visible: ['id', 'name', 'status'],
    }).map(column => column.key),
    ['id', 'status', 'name'],
  )

  const multipleFixedDefinitions = [
    { key: 'id', title: '序号', defaultVisible: true, hideable: false, fixed: 'left' },
    { key: 'select', title: '选择', defaultVisible: true, hideable: false, fixed: 'left' },
    { key: 'name', title: '任务名称', defaultVisible: true, hideable: false },
    { key: 'owner', title: '责任人', defaultVisible: true },
  ]

  assert.deepEqual(
    normalizeColumnSettings(multipleFixedDefinitions, {
      order: ['owner', 'select', 'id', 'owner'],
      visible: ['owner'],
    }),
    {
      order: ['id', 'select', 'owner', 'name'],
      visible: ['id', 'select', 'name', 'owner'],
    },
  )

  const multipleFixedOrder = ['id', 'select', 'name', 'owner']
  assert.deepEqual(
    moveColumnSetting(multipleFixedDefinitions, multipleFixedOrder, 'id', 'owner'),
    multipleFixedOrder,
  )
  assert.deepEqual(
    moveColumnSetting(multipleFixedDefinitions, multipleFixedOrder, 'select', 'owner'),
    multipleFixedOrder,
  )
  assert.deepEqual(
    moveColumnSetting(multipleFixedDefinitions, multipleFixedOrder, 'owner', 'id'),
    ['id', 'select', 'owner', 'name'],
  )

  assert.equal(
    getColumnDefinitionSignature(definitions),
    getColumnDefinitionSignature(definitions.map(definition => ({ ...definition }))),
  )
  assert.notEqual(
    getColumnDefinitionSignature(definitions),
    getColumnDefinitionSignature(definitions.map(definition => (
      definition.key === 'owner' ? { ...definition, hideable: false } : definition
    ))),
  )

  assert.equal(
    getSortableColumnAccessibilityLabel({
      key: 'jsx',
      title: {
        type: 'span',
        props: {
          children: ['里程碑', { type: 'strong', props: { children: '状态' } }],
        },
      },
      defaultVisible: true,
    }),
    '里程碑 状态',
  )
  assert.equal(
    getSortableColumnAccessibilityLabel({
      key: 'explicit',
      title: { type: 'span', props: { children: '忽略标题' } },
      accessibilityLabel: '自定义字段名',
      defaultVisible: true,
    }),
    '自定义字段名',
  )
})

registerAssertion('shared SortableColumnSettings component exists', () => {
  const componentPath = path.join(root, 'src/components/shared/SortableColumnSettings.tsx')
  if (!fs.existsSync(componentPath)) {
    throw new Error(`missing shared component: ${path.relative(root, componentPath)}`)
  }
  const source = fs.readFileSync(componentPath, 'utf8')
  assert.match(source, /getColumnDefinitionSignature\(definitions\)/)
  assert.match(
    source,
    /setDraft\(current\s*=>\s*normalizeColumnSettings\(\s*definitions,\s*current\s*\)\)/,
  )
  assert.match(source, /<FloatingConfigPopover\b/)
  assert.match(source, /\bKeyboardSensor\b/)
  assert.doesNotMatch(source, /<Drawer\b/)
  assert.doesNotMatch(source, /<Modal\b/)
})

registerAssertion('roadmap store normalizes and persists independent ordered column settings', () => {
  const roadmapTypes = loadTypeScriptModule(path.join(root, 'src/types/roadmap.ts'))
  const roadmapStoreModule = loadTypeScriptModule(path.join(root, 'src/stores/roadmap.ts'), new Map())
  const store = roadmapStoreModule.useRoadmapStore
  store.setState(roadmapStoreModule.createInitialRoadmapState())
  const allKeys = roadmapTypes.ROADMAP_COLUMNS.map(column => column.key)

  store.getState().setColumnSettings({
    order: ['firstSaleTosVersionId', 'displayName', 'brand', 'remark'],
    visible: ['firstSaleTosVersionId', 'displayName', 'brand'],
  })
  let state = store.getState()
  assert.deepEqual(state.columnOrder.slice(0, 4), [
    'firstSaleTosVersionId', 'displayName', 'brand', 'remark',
  ])
  assert.deepEqual([...new Set(state.columnOrder)], state.columnOrder)
  assert.deepEqual([...state.columnOrder].sort(), [...allKeys].sort())
  assert.deepEqual(state.visibleColumns, ['firstSaleTosVersionId', 'brand', 'displayName'])

  store.getState().setViewMode('evolution')
  store.getState().setColumnSettings({
    order: ['remark', 'displayName', 'productSeries', 'brand'],
    visible: ['remark'],
  })
  state = store.getState()
  assert.deepEqual(state.columnOrder.slice(0, 4), ['remark', 'displayName', 'productSeries', 'brand'])
  assert.deepEqual(state.visibleColumns, ['productSeries', 'displayName', 'remark'])

  store.getState().setViewMode('table')
  state = store.getState()
  assert.deepEqual(state.columnOrder.slice(0, 4), [
    'firstSaleTosVersionId', 'displayName', 'brand', 'remark',
  ])

  const migrated = roadmapStoreModule.migrateRoadmapState({
    ...roadmapStoreModule.partializeRoadmapState(state),
    viewMode: 'table',
    columnOrder: ['remark', 'unknown', 'remark', 'brand'],
    columnOrderByView: {
      table: ['remark', 'unknown', 'firstSaleTosVersionId', 'brand', 'brand'],
      evolution: ['displayName', 'unknown', 'remark', 'displayName'],
    },
  }, 1)
  assert.equal(migrated.columnOrderByView.table[0], 'firstSaleTosVersionId')
  assert.deepEqual([...new Set(migrated.columnOrderByView.table)], migrated.columnOrderByView.table)
  assert.deepEqual([...migrated.columnOrderByView.table].sort(), [...allKeys].sort())
  assert.deepEqual(migrated.columnOrder, migrated.columnOrderByView.table)
  assert.deepEqual(migrated.columnOrderByView.evolution.slice(0, 2), ['displayName', 'remark'])

  const persisted = roadmapStoreModule.partializeRoadmapState(migrated)
  assert.ok(Object.hasOwn(persisted, 'columnOrder'))
  assert.ok(Object.hasOwn(persisted, 'columnOrderByView'))
})

registerAssertion('roadmap migration preserves legacy visible-only relative order', () => {
  const roadmapStoreModule = loadTypeScriptModule(path.join(root, 'src/stores/roadmap.ts'), new Map())
  const persisted = roadmapStoreModule.partializeRoadmapState(
    roadmapStoreModule.createInitialRoadmapState(),
  )
  const {
    columnOrder: _legacyMissingColumnOrder,
    columnOrderByView: _legacyMissingOrderByView,
    ...legacyVisibleOnly
  } = persisted

  const migratedLegacy = roadmapStoreModule.migrateRoadmapState({
    ...legacyVisibleOnly,
    viewMode: 'table',
    visibleColumns: ['remark', 'unknown', 'brand', 'remark'],
    visibleColumnsByView: undefined,
  }, 0)
  assert.deepEqual(
    migratedLegacy.columnOrderByView.table.slice(0, 3),
    ['firstSaleTosVersionId', 'remark', 'brand'],
  )
  assert.deepEqual(
    migratedLegacy.visibleColumnsByView.table,
    ['firstSaleTosVersionId', 'brand', 'remark'],
  )

  const migratedPerView = roadmapStoreModule.migrateRoadmapState({
    ...legacyVisibleOnly,
    viewMode: 'evolution',
    visibleColumnsByView: {
      table: ['remark', 'unknown', 'brand', 'remark'],
      evolution: ['launchDate', 'unknown', 'brand', 'launchDate'],
    },
  }, 0)
  assert.deepEqual(
    migratedPerView.columnOrderByView.table.slice(0, 3),
    ['firstSaleTosVersionId', 'remark', 'brand'],
  )
  assert.deepEqual(
    migratedPerView.columnOrderByView.evolution.slice(0, 2),
    ['launchDate', 'brand'],
  )
})

registerAssertion('roadmap hydration migrates partial visibility maps per view', () => {
  const roadmapStoreModule = loadTypeScriptModule(path.join(root, 'src/stores/roadmap.ts'), new Map())
  const roadmapFilters = loadTypeScriptModule(path.join(root, 'src/lib/roadmapFilters.ts'), new Map())
  const persisted = roadmapStoreModule.partializeRoadmapState(
    roadmapStoreModule.createInitialRoadmapState(),
  )
  const {
    columnOrder: _legacyMissingColumnOrder,
    columnOrderByView: _legacyMissingOrderByView,
    ...legacyVisibleOnly
  } = persisted

  const hydrateEnvelope = envelope => {
    const previousWindow = globalThis.window
    globalThis.window = {
      localStorage: {
        getItem: key => key === 'pms-project-roadmap' ? JSON.stringify(envelope) : null,
        setItem: () => {},
        removeItem: () => {},
      },
    }
    try {
      return loadTypeScriptModule(path.join(root, 'src/stores/roadmap.ts'), new Map())
        .useRoadmapStore.getState()
    } finally {
      if (previousWindow === undefined) delete globalThis.window
      else globalThis.window = previousWindow
    }
  }

  const currentVersion = hydrateEnvelope({
    version: 1,
    state: {
      ...legacyVisibleOnly,
      viewMode: 'table',
      visibleColumns: ['remark', 'brand'],
      visibleColumnsByView: {
        evolution: ['launchDate', 'brand'],
      },
    },
  })
  assert.deepEqual(
    currentVersion.visibleColumnsByView.table,
    ['firstSaleTosVersionId', 'brand', 'remark'],
  )
  assert.deepEqual(
    currentVersion.columnOrderByView.table.slice(0, 3),
    ['firstSaleTosVersionId', 'remark', 'brand'],
  )

  const versionless = hydrateEnvelope({
    state: {
      ...legacyVisibleOnly,
      viewMode: 'evolution',
      visibleColumnsByView: {
        table: ['remark', 'brand'],
      },
    },
  })
  assert.deepEqual(
    versionless.visibleColumnsByView.evolution,
    roadmapFilters.DEFAULT_ROADMAP_EVOLUTION_VISIBLE_COLUMNS,
  )

  const malformedMembers = roadmapStoreModule.migrateRoadmapState({
    ...legacyVisibleOnly,
    viewMode: 'table',
    visibleColumns: ['remark', 'brand'],
    visibleColumnsByView: {
      table: { invalid: true },
      evolution: 'invalid',
    },
  }, 1)
  assert.deepEqual(
    malformedMembers.visibleColumnsByView.table,
    ['firstSaleTosVersionId', 'brand', 'remark'],
  )
  assert.deepEqual(
    malformedMembers.visibleColumnsByView.evolution,
    ['brand', 'productSeries', 'displayName', 'remark'],
  )
  assert.deepEqual(
    malformedMembers.columnOrderByView.evolution.slice(0, 2),
    ['remark', 'brand'],
  )
})

registerAssertion('roadmap per-target controls stay inside compact target-card headers', () => {
  const table = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapTableView.tsx'), 'utf8')
  const evolution = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapEvolutionView.tsx'), 'utf8')
  const toolbar = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapToolbar.tsx'), 'utf8')

  for (const [label, source] of [['table', table], ['evolution', evolution]]) {
    for (const contract of [
      'pms-roadmap-target-card-header',
      'pms-roadmap-target-card-actions',
      'wrap={false}',
      'aria-expanded={!targetCollapsed}',
    ]) {
      assert.ok(source.includes(contract), `${label} target card is missing ${contract}`)
    }
  }

  const tableCardIndex = table.indexOf('data-roadmap-target-card')
  const tableToggleIndex = table.indexOf('onClick={() => onToggleTarget(version.id)}')
  const tableEditIndex = table.indexOf('onClick={() => onEditTosTargets(version.id)}')
  assert.ok(tableCardIndex >= 0 && tableToggleIndex > tableCardIndex)
  assert.ok(tableEditIndex > tableCardIndex)
  assert.equal(table.match(/onToggleTarget\(version\.id\)/g)?.length, 1)
  assert.equal(table.match(/onEditTosTargets\(version\.id\)/g)?.length, 1)

  assert.ok(toolbar.includes("viewMode === 'evolution' && hasTargetVersions"))
  assert.ok(toolbar.includes('onToggleAllTargets'))
})

registerAssertion('roadmap conflicts use one compact counted toolbar action', () => {
  const alertPath = path.join(root, 'src/components/roadmap/RoadmapConflictAlert.tsx')
  const moduleSource = fs.readFileSync(path.join(root, 'src/components/roadmap/ProjectRoadmapModule.tsx'), 'utf8')
  const toolbar = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapToolbar.tsx'), 'utf8')

  assert.equal(fs.existsSync(alertPath), false, 'full-width roadmap conflict Alert still exists')
  assert.ok(!moduleSource.includes('RoadmapConflictAlert'))
  assert.ok(!moduleSource.includes('个待规划项目已存在对应正常项目'))
  for (const contract of [
    'countConflictingPlannedProjects',
    'conflictCount={conflictCount}',
    'onResolveConflicts={() => openConflictDrawer()}',
  ]) {
    assert.ok(moduleSource.includes(contract), `roadmap module is missing ${contract}`)
  }
  for (const contract of [
    'conflictCount > 0',
    'count={conflictCount}',
    'onClick={onResolveConflicts}',
    '解决冲突',
    'wrap={false}',
  ]) {
    assert.ok(toolbar.includes(contract), `roadmap toolbar is missing ${contract}`)
  }
})

registerAssertion('roadmap toolbar is one polished horizontally scrollable control rail', () => {
  const toolbar = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapToolbar.tsx'), 'utf8')
  for (const contract of [
    'roadmap-toolbar-scroll-row',
    'roadmap-toolbar-view-switch',
    'roadmap-toolbar-filter-group',
    'roadmap-toolbar-group-divider',
    "overflowX: 'auto'",
    'wrap={false}',
    'height: 32',
    'minHeight: 44',
    '.roadmap-toolbar-glass .ant-btn::before',
  ]) {
    assert.ok(toolbar.includes(contract), `roadmap toolbar polish is missing ${contract}`)
  }
})

registerAssertion('roadmap table and evolution card render from parent-provided column order', () => {
  const table = parseTypeScript(path.join(root, 'src/components/roadmap/RoadmapTableView.tsx'))
  const card = parseTypeScript(path.join(root, 'src/components/roadmap/RoadmapProjectCard.tsx'))
  const evolution = parseTypeScript(path.join(root, 'src/components/roadmap/RoadmapEvolutionView.tsx'))
  const moduleSource = parseTypeScript(path.join(root, 'src/components/roadmap/ProjectRoadmapModule.tsx')).source

  assert.ok(importedLocalNames(table.sourceFile, '@/lib/columnSettings', 'orderVisibleDefinitions').size)
  assert.ok(importedLocalNames(card.sourceFile, '@/lib/columnSettings', 'orderVisibleDefinitions').size)
  assert.ok(returnedRenderHasOrderedColumns(createRenderAnalysis(table.sourceFile, 'RoadmapTableView'), 'Table'))
  assert.ok(returnedRenderHasOrderedMap(createRenderAnalysis(card.sourceFile, 'RoadmapProjectCard')))
  assert.ok(returnedRenderPassesConfiguredOrder(
    createRenderAnalysis(evolution.sourceFile, 'RoadmapEvolutionView'),
    'RoadmapProjectCard',
  ))
  for (const contract of ['columnOrder', 'setColumnSettings']) {
    assert.ok(moduleSource.includes(contract), `ProjectRoadmapModule is missing ${contract}`)
  }
})

const entryFiles = [
  'src/components/roadmap/RoadmapColumnSettingsDrawer.tsx',
  'src/containers/ProjectSpaceContainer.tsx',
  'src/containers/ConfigContainer.tsx',
  'src/components/plan/PlanModule.tsx',
  'src/components/plans/RequirementDevPlan.tsx',
  'src/components/plans/VersionTrainPlan.tsx',
  'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
  'src/components/roadmap/MilestoneView.tsx',
  'src/app/share/plan/page.tsx',
]

registerAssertion('every user-facing column-settings entry imports SortableColumnSettings', () => {
  const missingImports = entryFiles.filter(relativePath => (
    !importsSortableColumnSettings(path.join(root, relativePath))
  ))
  if (missingImports.length) {
    throw new Error(`missing SortableColumnSettings import in: ${missingImports.join(', ')}`)
  }
})

registerAssertion('project-space and config-center use normalized full settings from the shared model', () => {
  for (const relativePath of [
    'src/containers/ProjectSpaceContainer.tsx',
    'src/containers/ConfigContainer.tsx',
  ]) {
    const filePath = path.join(root, relativePath)
    const { source, sourceFile } = parseTypeScript(filePath)
    assert.equal(
      importsSortableColumnSettings(filePath),
      true,
      `${relativePath} must import SortableColumnSettings from the shared component`,
    )
    assert.ok(
      importedLocalNames(sourceFile, '@/lib/columnSettings', 'normalizeColumnSettings').size,
      `${relativePath} must import normalizeColumnSettings from the shared model`,
    )
    assert.ok(
      importedLocalNames(sourceFile, '@/lib/columnSettings', 'orderVisibleDefinitions').size,
      `${relativePath} must import orderVisibleDefinitions from the shared model`,
    )
    assert.match(source, /\bcolumnSettingsByView\s*\[/)
    assert.match(source, /\bsetColumnSettingsByView\s*\(/)
    assert.doesNotMatch(source, /\bcolumnsByView\b/)
  }
})

registerAssertion('plan store keeps table and Gantt full settings independent and horizontal empty', () => {
  const planModule = loadTypeScriptModule(path.join(root, 'src/stores/plan.ts'), new Map())
  const {
    GANTT_COLUMNS,
    TABLE_COLUMNS,
    getColumnsForView,
    usePlanStore,
  } = planModule

  assert.deepEqual(getColumnsForView('horizontal'), [])
  assert.equal(TABLE_COLUMNS.find(column => column.key === 'id').fixed, 'left')
  assert.equal(TABLE_COLUMNS.find(column => column.key === 'id').hideable, false)
  assert.equal(TABLE_COLUMNS.find(column => column.key === 'taskName').hideable, false)
  assert.equal(TABLE_COLUMNS.find(column => column.key === 'taskName').fixed, undefined)
  assert.equal(GANTT_COLUMNS.find(column => column.key === 'taskName').hideable, false)
  assert.equal(GANTT_COLUMNS.find(column => column.key === 'taskName').fixed, undefined)

  const initial = usePlanStore.getState().columnSettingsByView
  assert.ok(initial['project-level1-table'])
  assert.ok(initial['project-level1-gantt'])
  assert.notStrictEqual(initial['project-level1-table'], initial['project-level1-gantt'])

  const priorGantt = initial['project-level1-gantt']
  usePlanStore.getState().setColumnSettingsByView(previous => ({
    ...previous,
    'project-level1-table': {
      order: [...previous['project-level1-table'].order].reverse(),
      visible: [...previous['project-level1-table'].visible],
    },
  }))
  assert.strictEqual(usePlanStore.getState().columnSettingsByView['project-level1-gantt'], priorGantt)
})

registerAssertion('ordered render analysis handles aliases, reachability, and configured settings', () => {
  const fixture = (name, source, componentName) => {
    const sourceFile = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    return createRenderAnalysis(sourceFile, componentName)
  }
  const helperImport = `import { orderVisibleDefinitions as arrange } from '@/lib/columnSettings'`

  const unusedJsx = fixture('unused-jsx.tsx', `
    ${helperImport}
    function Grid({ columnSettings }) {
      const ordered = arrange(definitions, columnSettings).map(column => ({ key: column.key }))
      const unused = <Table columns={ordered} />
      return <div>unused table is not rendered</div>
    }
  `, 'Grid')
  if (returnedRenderHasOrderedColumns(unusedJsx, 'Table')) {
    throw new Error('unused JSX incorrectly satisfied the table render contract')
  }

  const defaultOnly = fixture('default-only.tsx', `
    ${helperImport}
    function Grid() {
      const columns = arrange(definitions, getDefaultColumnSettings(definitions))
      return <Table columns={columns} />
    }
  `, 'Grid')
  if (returnedRenderHasOrderedColumns(defaultOnly, 'Table')) {
    throw new Error('default-only settings incorrectly satisfied the configured-order contract')
  }

  const aliasedBuilder = fixture('aliased-builder.tsx', `
    ${helperImport}
    function Grid({ columnSettings }) {
      function createColumns() {
        return arrange(definitions, columnSettings).map(column => ({ key: column.key }))
      }
      const buildColumns = createColumns
      return <Table columns={buildColumns()} />
    }
  `, 'Grid')
  if (!returnedRenderHasOrderedColumns(aliasedBuilder, 'Table')) {
    throw new Error('aliased helper and buildColumns function were not traced to rendered Table columns')
  }

  const task3SpreadSettings = fixture('task-3-spread-settings.tsx', `
    ${helperImport}
    function Task3Table({ columnOrder, visibleColumns }) {
      const columns = arrange(definitions, {
        order: [...columnOrder],
        visible: [...visibleColumns],
      })
      return <Table columns={columns} />
    }
  `, 'Task3Table')
  if (!returnedRenderHasOrderedColumns(task3SpreadSettings, 'Table')) {
    throw new Error('Task 3 array/spread column settings were not recognized as configured order')
  }

  const task4NormalizedViewSettings = fixture('task-4-normalized-view-settings.tsx', `
    import {
      normalizeColumnSettings as normalizeSettings,
      orderVisibleDefinitions as arrange,
    } from '@/lib/columnSettings'
    function Task4Table() {
      const { columnSettingsByView } = usePlanStore()
      const columnSettings = normalizeSettings(
        definitions,
        columnSettingsByView[getViewKey()] as StoredColumnSettings,
      )
      const columns = arrange(definitions, columnSettings!)
      return <Table columns={columns} />
    }
  `, 'Task4Table')
  if (!returnedRenderHasOrderedColumns(task4NormalizedViewSettings, 'Table')) {
    throw new Error('Task 4 normalized per-view Zustand settings were not traced to rendered columns')
  }

  const projectSpaceHookAlias = fixture('project-space-hook-alias.tsx', `
    import {
      normalizeColumnSettings,
      orderVisibleDefinitions,
    } from '@/lib/columnSettings'
    function ProjectSpaceContainer() {
      const plan = usePlanStore()
      const { columnSettingsByView } = plan
      const columnSettings = normalizeColumnSettings(
        definitions,
        columnSettingsByView[getViewKey()],
      )
      const orderedColumns = orderVisibleDefinitions(definitions, columnSettings)
      return <Table columns={orderedColumns} />
    }
  `, 'ProjectSpaceContainer')
  if (!returnedRenderHasOrderedColumns(projectSpaceHookAlias, 'Table')) {
    throw new Error('ProjectSpaceContainer hook-result destructuring was not traced to rendered columns')
  }

  const returnedJsxVariable = fixture('returned-jsx-variable.tsx', `
    ${helperImport}
    function Card({ columnSettings }) {
      const displayFields = arrange(definitions, columnSettings)
      const output = <div>{displayFields.map(field => <span key={field.key}>{field.title}</span>)}</div>
      return output
    }
  `, 'Card')
  if (!returnedRenderHasOrderedMap(returnedJsxVariable)) {
    throw new Error('ordered map inside a returned JSX variable was not recognized')
  }

  const deadMap = fixture('dead-map.tsx', `
    ${helperImport}
    function Card({ columnSettings }) {
      const displayFields = arrange(definitions, columnSettings)
      displayFields.map(field => <span key={field.key}>{field.title}</span>)
      return <div>no ordered fields rendered</div>
    }
  `, 'Card')
  if (returnedRenderHasOrderedMap(deadMap)) {
    throw new Error('dead ordered map incorrectly satisfied the card render contract')
  }

  const disconnectedEvolution = fixture('disconnected-evolution.tsx', `
    function Evolution({ columnOrder }) {
      return <RoadmapProjectCard row={row} />
    }
  `, 'Evolution')
  if (returnedRenderPassesConfiguredOrder(disconnectedEvolution, 'RoadmapProjectCard')) {
    throw new Error('evolution card without an order/settings prop incorrectly passed')
  }

  const connectedEvolution = fixture('connected-evolution.tsx', `
    function Evolution({ columnOrder }) {
      const output = <RoadmapProjectCard row={row} columnOrder={columnOrder} />
      return output
    }
  `, 'Evolution')
  if (!returnedRenderPassesConfiguredOrder(connectedEvolution, 'RoadmapProjectCard')) {
    throw new Error('configured evolution-card order prop was not recognized')
  }
})

registerAssertion('every display surface consumes column order when producing fields', () => {
  const roadmapTable = parseTypeScript(path.join(root, 'src/components/roadmap/RoadmapTableView.tsx')).sourceFile
  const roadmapCard = parseTypeScript(path.join(root, 'src/components/roadmap/RoadmapProjectCard.tsx')).sourceFile
  const projectSpace = parseTypeScript(path.join(root, 'src/containers/ProjectSpaceContainer.tsx')).sourceFile
  const configCenter = parseTypeScript(path.join(root, 'src/containers/ConfigContainer.tsx')).sourceFile
  const requirementPlan = parseTypeScript(path.join(root, 'src/components/plans/RequirementDevPlan.tsx')).sourceFile
  const versionTrain = parseTypeScript(path.join(root, 'src/components/plans/VersionTrainPlan.tsx')).sourceFile
  const summaryBoard = parseTypeScript(path.join(root, 'src/components/roadmap/ProjectPlanSummaryBoard.tsx')).sourceFile
  const milestoneView = parseTypeScript(path.join(root, 'src/components/roadmap/MilestoneView.tsx')).sourceFile
  const roadmapEvolution = parseTypeScript(path.join(root, 'src/components/roadmap/RoadmapEvolutionView.tsx')).sourceFile

  const failures = []
  const roadmapTableAnalysis = createRenderAnalysis(roadmapTable, 'RoadmapTableView')
  const roadmapCardAnalysis = createRenderAnalysis(roadmapCard, 'RoadmapProjectCard')
  const roadmapEvolutionAnalysis = createRenderAnalysis(roadmapEvolution, 'RoadmapEvolutionView')
  const projectSpaceAnalysis = createRenderAnalysis(projectSpace, 'ProjectSpaceContainer')
  const configCenterAnalysis = createRenderAnalysis(configCenter, 'ConfigContainer')
  const requirementPlanAnalysis = createRenderAnalysis(requirementPlan, 'RequirementDevPlan')
  const requirementGanttAnalysis = createRenderAnalysis(requirementPlan, 'RequirementGantt')
  const versionTrainAnalysis = createRenderAnalysis(versionTrain, 'VersionTrainPlan')
  const summaryBoardAnalysis = createRenderAnalysis(summaryBoard, 'ProjectPlanSummaryBoard')
  const milestoneViewAnalysis = createRenderAnalysis(milestoneView, 'MilestoneView')

  if (!roadmapTableAnalysis || !returnedRenderHasOrderedColumns(roadmapTableAnalysis, 'Table')) {
    failures.push('roadmap table: ordered definitions must flow into <Table columns>')
  }
  if (
    !roadmapCardAnalysis
    || !returnedRenderHasOrderedMap(roadmapCardAnalysis)
    || !roadmapEvolutionAnalysis
    || !returnedRenderPassesConfiguredOrder(roadmapEvolutionAnalysis, 'RoadmapProjectCard')
  ) {
    failures.push('roadmap card: parent-provided order must drive the returned card-field map')
  }
  if (!projectSpaceAnalysis || !returnedRenderHasOrderedColumns(projectSpaceAnalysis, 'Table')) {
    failures.push('plan table: configured order must drive returned <Table columns>')
  }
  if (!projectSpaceAnalysis || !returnedRenderHasOrderedColumns(projectSpaceAnalysis, 'DHTMLXGantt')) {
    failures.push('plan Gantt: ordered definitions must flow into <DHTMLXGantt columns>')
  }
  if (!configCenterAnalysis || !returnedRenderHasOrderedColumns(configCenterAnalysis, 'Table')) {
    failures.push('config table: configured order must drive returned <Table columns>')
  }
  if (!configCenterAnalysis || !returnedRenderHasOrderedColumns(configCenterAnalysis, 'DHTMLXGantt')) {
    failures.push('config Gantt: ordered definitions must flow into <DHTMLXGantt columns>')
  }
  if (!requirementPlanAnalysis || !returnedRenderHasOrderedMap(requirementPlanAnalysis)) {
    failures.push('requirement plan table: ordered fields must drive the rendered row map')
  }
  if (!requirementGanttAnalysis || !componentAssignsOrderedGanttColumns(requirementGanttAnalysis)) {
    failures.push('requirement plan Gantt: ordered definitions must be assigned to gantt.config.columns')
  }
  if (!versionTrainAnalysis || !returnedRenderHasOrderedColumns(versionTrainAnalysis, 'Table')) {
    failures.push('version train: ordered definitions must flow into <Table columns>')
  }
  if (!summaryBoardAnalysis || !returnedRenderHasOrderedColumns(summaryBoardAnalysis, 'Table')) {
    failures.push('summary board: ordered definitions must flow into <Table columns>')
  }
  if (!milestoneViewAnalysis || !returnedRenderHasOrderedColumns(milestoneViewAnalysis, 'Table')) {
    failures.push('milestone view: ordered definitions must flow into <Table columns>')
  }
  if (failures.length) throw new Error(failures.join('; '))
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
  console.error(`\nSortable column-settings contract failed: ${failureCount} assertion(s)`)
  process.exitCode = 1
} else {
  console.log('\nSortable column-settings contract passed')
}
