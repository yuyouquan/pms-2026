#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { analyzeRoadmapSource, getRoadmapAnalysisFixtureFailures } from './lib/roadmap-source-analysis.mjs'

const root = process.cwd()
const require = createRequire(import.meta.url)
const assertions = []
const typeScriptModuleCache = new Map()

export function registerAssertion(name, assertion) {
  assertions.push({ name, assertion })
}

export function resolveTypeScriptModule(specifier, parentPath = path.join(root, 'index.ts')) {
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

export function loadTypeScriptModule(modulePath, moduleCache = typeScriptModuleCache) {
  const resolvedPath = path.resolve(modulePath)
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
  const wrapper = vm.runInThisContext(`(function (exports, require, module, __filename, __dirname) {${compiled}\n})`, {
    filename: resolvedPath,
  })
  wrapper(module.exports, localRequire, module, resolvedPath, path.dirname(resolvedPath))
  return module.exports
}

export function createTypeScriptModuleLoader(moduleCache = new Map()) {
  return modulePath => loadTypeScriptModule(modulePath, moduleCache)
}

const roadmapPath = path.join(root, 'src/components/roadmap/RoadmapView.tsx')
const roadmapSource = fs.readFileSync(roadmapPath, 'utf8')
const roadmapAnalysis = analyzeRoadmapSource(roadmapSource, roadmapPath)

const expectedMachineProjectTypes = ['整机-手机', '整机-PAD', '整机-笔电']

function findLegacyMachineComparisons(filePath) {
  const source = fs.readFileSync(filePath, 'utf8')
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const failures = []
  const equalityKinds = new Set([
    ts.SyntaxKind.EqualsEqualsToken,
    ts.SyntaxKind.EqualsEqualsEqualsToken,
    ts.SyntaxKind.ExclamationEqualsToken,
    ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ])

  function visit(node) {
    if (ts.isBinaryExpression(node) && equalityKinds.has(node.operatorToken.kind)) {
      const operands = [node.left, node.right]
      const comparesLegacyLiteral = operands.some(operand => ts.isStringLiteral(operand) && operand.text === '整机产品项目')
      const comparesOldMachineConstant = operands.some(operand => ts.isIdentifier(operand) && operand.text === 'PROJECT_TYPE_MACHINE')
      if (comparesLegacyLiteral || comparesOldMachineConstant) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
        failures.push(`${path.relative(root, filePath)}:${line + 1} ${node.getText(sourceFile)}`)
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return failures
}

function getInitialProjectTypeInitializers(filePath) {
  const source = fs.readFileSync(filePath, 'utf8')
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const projectTypes = new Map()

  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'initialProjects' && ts.isArrayLiteralExpression(node.initializer)) {
      for (const element of node.initializer.elements) {
        if (!ts.isObjectLiteralExpression(element)) continue
        const idProperty = element.properties.find(property => ts.isPropertyAssignment(property) && property.name.getText(sourceFile) === 'id')
        const typeProperty = element.properties.find(property => ts.isPropertyAssignment(property) && property.name.getText(sourceFile) === 'type')
        if (!idProperty || !typeProperty || !ts.isPropertyAssignment(idProperty) || !ts.isPropertyAssignment(typeProperty)) continue
        if (!ts.isStringLiteral(idProperty.initializer)) continue
        projectTypes.set(idProperty.initializer.text, typeProperty.initializer.getText(sourceFile))
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return projectTypes
}

function functionCallsMachineTypeGuard(filePath, functionName) {
  const source = fs.readFileSync(filePath, 'utf8')
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  let found = false

  function visit(node, insideTarget = false) {
    const isTargetDeclaration = ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.name.text === functionName
    const inTarget = insideTarget || isTargetDeclaration
    if (
      inTarget
      && ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === 'isMachineProjectType'
      && node.arguments.some(argument => ts.isIdentifier(argument) && argument.text === 'projectType')
    ) {
      found = true
    }
    ts.forEachChild(node, child => visit(child, inTarget))
  }

  visit(sourceFile)
  return found
}

function findIdentifierReferences(filePath, identifierName) {
  const source = fs.readFileSync(filePath, 'utf8')
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const references = []

  function visit(node) {
    if (ts.isIdentifier(node) && node.text === identifierName) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
      references.push(`${path.relative(root, filePath)}:${line + 1}`)
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return references
}

function listTypeScriptFiles(directoryPath) {
  return fs.readdirSync(directoryPath, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directoryPath, entry.name)
    if (entry.isDirectory()) return listTypeScriptFiles(entryPath)
    return /\.tsx?$/.test(entry.name) ? [entryPath] : []
  })
}

function getNamedObjectLiteralProperties(filePath, variableName) {
  const source = fs.readFileSync(filePath, 'utf8')
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const properties = new Map()

  function visit(node) {
    if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.name.text === variableName
      && ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const property of node.initializer.properties) {
        if (!ts.isPropertyAssignment(property)) continue
        properties.set(property.name.getText(sourceFile), property.initializer.getText(sourceFile))
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return properties
}

registerAssertion('RoadmapView does not import or mount legacy roadmap views', () => {
  if (roadmapAnalysis.legacyImports.length || roadmapAnalysis.legacyJsxMounts.length) {
    throw new Error(`found imports [${roadmapAnalysis.legacyImports.join(', ')}] and JSX mounts [${roadmapAnalysis.legacyJsxMounts.join(', ')}]`)
  }
})

registerAssertion('roadmap AST analysis handles legacy and cleared-state fixtures', () => {
  const fixtureFailures = getRoadmapAnalysisFixtureFailures()
  if (fixtureFailures.length) {
    throw new Error(fixtureFailures.join('; '))
  }
})

registerAssertion('RoadmapView retains the summary shell and blank roadmap branch', () => {
  if (!roadmapAnalysis.hasProjectViewHeader) throw new Error('missing project-view header text')
  if (!roadmapAnalysis.hasProjectViewOptionLabels) throw new Error('missing project-view option labels')
  if (!roadmapAnalysis.summaryConditionals.some(conditional => conditional.mountsSummaryBoard && conditional.hasNullFalseBranch)) {
    throw new Error('summary conditional must mount ProjectPlanSummaryBoard with a null false branch')
  }
})

registerAssertion('machine project types expose the exact supported values in order', () => {
  const projectTypes = loadTypeScriptModule(path.join(root, 'src/constants/projectTypes.ts'))
  if (JSON.stringify(projectTypes.MACHINE_PROJECT_TYPES) !== JSON.stringify(expectedMachineProjectTypes)) {
    throw new Error(`expected ${JSON.stringify(expectedMachineProjectTypes)}, got ${JSON.stringify(projectTypes.MACHINE_PROJECT_TYPES)}`)
  }
  for (const type of expectedMachineProjectTypes) {
    if (!projectTypes.isMachineProjectType(type)) throw new Error(`${type} must be recognized as a machine project`)
  }
  if (projectTypes.isMachineProjectType('整机产品项目')) throw new Error('legacy machine project type must not be recognized')
  if ('PROJECT_TYPE_MACHINE' in projectTypes) throw new Error('legacy PROJECT_TYPE_MACHINE export must be removed')
})

registerAssertion('PROJECT_TYPES contains every machine type and excludes the legacy value', () => {
  const { PROJECT_TYPES } = loadTypeScriptModule(path.join(root, 'src/constants/projectTypes.ts'))
  const machinePrefix = PROJECT_TYPES.slice(0, expectedMachineProjectTypes.length)
  if (JSON.stringify(machinePrefix) !== JSON.stringify(expectedMachineProjectTypes)) {
    throw new Error(`machine types must lead PROJECT_TYPES, got ${JSON.stringify(PROJECT_TYPES)}`)
  }
  if (PROJECT_TYPES.includes('整机产品项目')) throw new Error('PROJECT_TYPES still contains the legacy value')
})

registerAssertion('existing machine mocks are explicitly migrated to the phone project type', () => {
  const projectTypesById = getInitialProjectTypeInitializers(path.join(root, 'src/data/projects.ts'))
  const expectedMachineMockIds = ['1', '3', '7', '12', '13', '14', '15', '16', '17', '18']
  const failures = expectedMachineMockIds
    .filter(id => projectTypesById.get(id) !== 'PROJECT_TYPE_MACHINE_PHONE')
    .map(id => `${id}:${projectTypesById.get(id) || 'missing project'}`)
  if (failures.length) throw new Error(failures.join(', '))
})

registerAssertion('runtime files contain no legacy machine equality logic', () => {
  const runtimeFiles = [
    'src/data/projects.ts',
    'src/stores/project.ts',
    'src/components/workspace/WorkspaceModule.tsx',
    'src/containers/WorkspaceContainer.tsx',
    'src/containers/ProjectSpaceContainer.tsx',
    'src/components/plan/PlanModule.tsx',
    'src/app/page.tsx',
    'src/app/share/plan/page.tsx',
    'src/components/roadmap/ProjectPlanSummaryBoard.tsx',
    'src/components/roadmap/utils.ts',
    'src/components/roadmap/MilestoneView.tsx',
    'src/components/roadmap/MRTrainView.tsx',
  ]
  const failures = runtimeFiles.flatMap(file => findLegacyMachineComparisons(path.join(root, file)))
  if (failures.length) throw new Error(failures.join('; '))
})

registerAssertion('machine type guard drives market rows, status mapping, and template coverage', () => {
  const dataPath = path.join(root, 'src/data/projects.ts')
  if (!functionCallsMachineTypeGuard(dataPath, 'mapIpmStatus')) {
    throw new Error('mapIpmStatus must call isMachineProjectType(projectType)')
  }
  const { TEMPLATE_PROJECT_TYPES } = createTypeScriptModuleLoader()(path.join(root, 'src/stores/plan.ts'))
  const { generateTableData } = createTypeScriptModuleLoader()(path.join(root, 'src/components/roadmap/utils.ts'))

  for (const [index, type] of expectedMachineProjectTypes.entries()) {
    if (!TEMPLATE_PROJECT_TYPES.includes(type)) throw new Error(`${type} is missing from template project types`)
    const project = { id: `machine-${index}`, name: type, type, markets: ['OP', 'TR'] }
    const rows = generateTableData([project], [], type, {}, [])
    if (rows.length !== 2 || rows.map(row => row.market).join(',') !== 'OP,TR') {
      throw new Error(`${type} did not expand into per-market roadmap rows`)
    }
  }
})

registerAssertion('workspace machine filters preserve exact and aggregate subtype semantics', () => {
  const {
    MACHINE_PROJECT_FILTER_OPTIONS,
    MACHINE_PROJECT_TYPE_FILTER,
    matchesProjectTypeFilter,
  } = loadTypeScriptModule(path.join(root, 'src/constants/projectTypes.ts'))
  const expectedFilterValues = ['machine', ...expectedMachineProjectTypes]
  const actualFilterValues = MACHINE_PROJECT_FILTER_OPTIONS?.map(option => option.value)
  if (JSON.stringify(actualFilterValues) !== JSON.stringify(expectedFilterValues)) {
    throw new Error(`expected machine filters ${JSON.stringify(expectedFilterValues)}, got ${JSON.stringify(actualFilterValues)}`)
  }
  if (MACHINE_PROJECT_TYPE_FILTER !== 'machine') throw new Error('aggregate machine filter value must remain machine')

  for (const selectedType of expectedMachineProjectTypes) {
    for (const projectType of expectedMachineProjectTypes) {
      const expected = projectType === selectedType
      if (matchesProjectTypeFilter(projectType, selectedType) !== expected) {
        throw new Error(`${selectedType} must ${expected ? '' : 'not '}match ${projectType}`)
      }
    }
    if (!matchesProjectTypeFilter(selectedType, MACHINE_PROJECT_TYPE_FILTER)) {
      throw new Error(`aggregate machine filter must match ${selectedType}`)
    }
  }

  if (matchesProjectTypeFilter('技术项目', MACHINE_PROJECT_TYPE_FILTER)) throw new Error('aggregate machine filter matched a non-machine type')
  if (!matchesProjectTypeFilter('技术项目', '技术项目')) throw new Error('exact non-machine filter behavior changed')
  if (matchesProjectTypeFilter('技术项目', 'tOS版本项目')) throw new Error('different non-machine filters must not match')
})

registerAssertion('MilestoneView does not translate aggregate machine scope into an exact project type', () => {
  const milestonePath = path.join(root, 'src/components/roadmap/MilestoneView.tsx')
  const ambiguousReferences = [
    ...findIdentifierReferences(milestonePath, 'PROJECT_TYPE_BY_SCOPE'),
    ...findIdentifierReferences(milestonePath, 'onProjectTypeChange'),
  ]
  if (ambiguousReferences.length) throw new Error(ambiguousReferences.join(', '))
})

registerAssertion('runtime source has no references to the removed PROJECT_TYPE_MACHINE identifier', () => {
  const references = listTypeScriptFiles(path.join(root, 'src'))
    .flatMap(file => findIdentifierReferences(file, 'PROJECT_TYPE_MACHINE'))
  if (references.length) throw new Error(references.join(', '))
})

registerAssertion('workspace filter toolbar wraps without squeezing chip labels', () => {
  const workspacePath = path.join(root, 'src/containers/WorkspaceContainer.tsx')
  const toolbarStyle = getNamedObjectLiteralProperties(workspacePath, 'WORKSPACE_FILTER_TOOLBAR_STYLE')
  const chipStyle = getNamedObjectLiteralProperties(workspacePath, 'WORKSPACE_FILTER_CHIP_STYLE')
  if (toolbarStyle.get('flexWrap') !== "'wrap'") throw new Error('workspace toolbar must flex-wrap')
  if (!toolbarStyle.has('rowGap')) throw new Error('workspace toolbar must retain a stable row gap')
  if (chipStyle.get('whiteSpace') !== "'nowrap'") throw new Error('workspace filter labels must not wrap')
  if (chipStyle.get('flexShrink') !== '0') throw new Error('workspace filter chips must not shrink')
})

const failures = []
for (const { name, assertion } of assertions) {
  try {
    assertion()
    console.log(`PASS ${name}`)
  } catch (error) {
    failures.push({ name, error })
    console.error(`FAIL ${name}: ${error.message}`)
  }
}

if (failures.length) process.exit(1)

console.log(`Project roadmap baseline verification passed (${assertions.length} assertions).`)
