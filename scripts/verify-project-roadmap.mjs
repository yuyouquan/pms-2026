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

export function registerTableAssertions(groupName, cases) {
  for (const [caseName, assertion] of cases) {
    registerAssertion(`${groupName}: ${caseName}`, assertion)
  }
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

registerAssertion('roadmap contracts expose the approved column order and defaults', () => {
  const { ROADMAP_COLUMNS } = loadTypeScriptModule(path.join(root, 'src/types/roadmap.ts'))
  const expectedColumns = [
    ['firstSaleTosVersionId', 'tOS版本'],
    ['brand', '品牌'],
    ['productLine', '产品线'],
    ['productSeries', '产品系列'],
    ['marketName', '市场名'],
    ['displayName', '项目名'],
    ['productType', '产品类型'],
    ['platform', '平台'],
    ['startRam', '起步RAM'],
    ['versionType', '版本类型'],
    ['str5Date', 'STR5时间'],
    ['launchDate', '上市时间'],
    ['developMode', '开发模式'],
    ['remark', '备注'],
  ]
  const actualColumns = ROADMAP_COLUMNS.map(column => [column.key, column.label])
  if (JSON.stringify(actualColumns) !== JSON.stringify(expectedColumns)) {
    throw new Error(`expected ${JSON.stringify(expectedColumns)}, got ${JSON.stringify(actualColumns)}`)
  }
  const hiddenByDefault = ROADMAP_COLUMNS.filter(column => !column.defaultVisible).map(column => column.key)
  if (JSON.stringify(hiddenByDefault) !== JSON.stringify(['productSeries'])) {
    throw new Error(`only productSeries may be hidden by default, got ${JSON.stringify(hiddenByDefault)}`)
  }
  if (ROADMAP_COLUMNS.some(column => !column.kind)) throw new Error('every roadmap column needs a field kind')
})

registerAssertion('roadmap validation normalizes names, duplicate keys, tOS versions, and legacy product types', () => {
  const validation = loadTypeScriptModule(path.join(root, 'src/lib/roadmapValidation.ts'))
  if (validation.buildRoadmapDisplayName(' X6877 ', 'Android 16', '新品') !== 'X6877') {
    throw new Error('new-product display name is wrong')
  }
  if (validation.buildRoadmapDisplayName(' X6877 ', 'Android 16', '老品') !== 'X6877(Android 16)') {
    throw new Error('old-product display name is wrong')
  }
  const firstKey = validation.buildRoadmapDuplicateKey(' x6877 ', 'Android 16', '新品')
  const secondKey = validation.buildRoadmapDuplicateKey('X6877', ' Android 16 ', ' 新品 ')
  if (firstKey !== 'X6877|Android 16|新品' || firstKey !== secondKey) {
    throw new Error('duplicate keys must trim fields and ignore project-code case')
  }

  for (const input of ['tOS17.2', 'tos 17.2', ' TOS  17.2 ']) {
    const normalized = validation.normalizeTosVersionName(input)
    if (JSON.stringify(normalized) !== JSON.stringify({ name: 'tOS 17.2', major: 17, minor: 2 })) {
      throw new Error(`failed to normalize ${input}`)
    }
  }
  if (validation.normalizeTosVersionName('tOS 17') !== null) throw new Error('tOS version must include major and minor')
  if (validation.normalizeLegacyRoadmapProductType('新品') !== '新品') throw new Error('新品 must remain 新品')
  for (const legacyValue of ['老品', '升级', '换代']) {
    if (validation.normalizeLegacyRoadmapProductType(legacyValue) !== '老品') {
      throw new Error(`${legacyValue} must normalize to 老品`)
    }
  }
  if (validation.normalizeLegacyRoadmapProductType('未知') !== null) throw new Error('unknown product types must normalize to null')
})

registerAssertion('roadmap duplicate keys normalize only ASCII case and surrounding space', () => {
  const { buildRoadmapDuplicateKey } = loadTypeScriptModule(path.join(root, 'src/lib/roadmapValidation.ts'))
  const asciiKey = buildRoadmapDuplicateKey(' x6877 ', 'Android 16', '新品')
  const upperAsciiKey = buildRoadmapDuplicateKey('X6877', 'Android 16', '新品')
  const compatibilityKey = buildRoadmapDuplicateKey(' ｘ６８７７ ', 'Android 16', '新品')
  if (asciiKey !== upperAsciiKey) throw new Error('ASCII case and surrounding spaces must collapse')
  if (compatibilityKey === asciiKey) throw new Error('compatibility characters must not be silently normalized')
})

registerTableAssertions('tOS normalization rejects unsafe components', [
  ['negative major', () => {
    const { normalizeTosVersionName } = loadTypeScriptModule(path.join(root, 'src/lib/roadmapValidation.ts'))
    if (normalizeTosVersionName('tOS -1.2') !== null) throw new Error('negative major must be rejected')
  }],
  ['negative minor', () => {
    const { normalizeTosVersionName } = loadTypeScriptModule(path.join(root, 'src/lib/roadmapValidation.ts'))
    if (normalizeTosVersionName('tOS 17.-1') !== null) throw new Error('negative minor must be rejected')
  }],
  ['large safe integer component', () => {
    const { normalizeTosVersionName } = loadTypeScriptModule(path.join(root, 'src/lib/roadmapValidation.ts'))
    const normalized = normalizeTosVersionName('tOS 1000.0')
    if (JSON.stringify(normalized) !== JSON.stringify({ name: 'tOS 1000.0', major: 1000, minor: 0 })) {
      throw new Error('safe non-negative components must normalize without an arbitrary ceiling')
    }
  }],
  ['overflowing digits', () => {
    const { normalizeTosVersionName } = loadTypeScriptModule(path.join(root, 'src/lib/roadmapValidation.ts'))
    if (normalizeTosVersionName(`tOS ${'9'.repeat(400)}.0`) !== null) throw new Error('overflowing version must not emit Infinity')
  }],
])

registerAssertion('semantic tOS sorting has no arbitrary component ceiling', () => {
  const sortingSource = fs.readFileSync(path.join(root, 'src/lib/roadmapSorting.ts'), 'utf8')
  if (sortingSource.includes('MAX_TOS_VERSION_COMPONENT')) throw new Error('semantic sorting still applies the removed component ceiling')
})

registerAssertion('roadmap product-line and planned-project validation enforce only approved rules', () => {
  const validation = loadTypeScriptModule(path.join(root, 'src/lib/roadmapValidation.ts'))
  const expectedLines = {
    TECNO: ['PHANTOM', 'CAMON', 'POVA', 'SPARK', 'POP'],
    Infinix: ['ZERO', 'NOTE', 'GT', 'HOT', 'SMART'],
    itel: ['SUPER', 'POWER', 'CITY', 'A'],
    待定: ['待定'],
    其他品牌: ['其他系列'],
  }
  for (const [brand, lines] of Object.entries(expectedLines)) {
    if (JSON.stringify(validation.getProductLineOptions(brand)) !== JSON.stringify(lines)) {
      throw new Error(`${brand} product lines are wrong`)
    }
  }

  const validInput = {
    machineProjectType: '整机-手机',
    projectCode: 'X6877',
    androidVersion: 'Android 16',
    firstSaleTosVersionId: 'tos-17-2',
    brand: 'TECNO',
    productLine: 'SPARK',
    productSeries: 'SPARK 60',
    marketName: 'SPARK 60',
    productType: '新品',
    platform: 'G100',
    startRam: '4GB',
    versionType: 'Slim',
    str5Date: '2027-02-01',
    launchDate: '2027-01-01',
    developMode: '自研',
  }
  const existing = [{ id: 'planned-1', ...validInput, displayName: 'X6877', source: 'planned', status: '待规划', readOnly: false, remark: '' }]
  const validTosIds = new Set(['tos-17-2'])
  const validErrors = validation.validatePlannedProject(validInput, existing, 'planned-1', validTosIds)
  if (Object.keys(validErrors).length) {
    throw new Error(`remark must be optional, editing must exclude self, and dates have no cross-field rule: ${JSON.stringify(validErrors)}`)
  }
  if (!validation.isExactRoadmapDuplicate(validInput, existing)) throw new Error('exact duplicate was not detected')
  if (validation.isExactRoadmapDuplicate(validInput, existing, 'planned-1')) throw new Error('edit duplicate check did not exclude self')

  const missingRequired = { ...validInput }
  delete missingRequired.platform
  const requiredErrors = validation.validatePlannedProject(missingRequired, [], undefined, validTosIds)
  if (!requiredErrors.platform || requiredErrors.remark) throw new Error(`required-field errors are wrong: ${JSON.stringify(requiredErrors)}`)

  const badBrandLineErrors = validation.validatePlannedProject({ ...validInput, productLine: 'ZERO' }, [], undefined, validTosIds)
  if (!badBrandLineErrors.productLine) throw new Error('brand/product-line mismatch must be rejected')
  const invalidBrandErrors = validation.validatePlannedProject({ ...validInput, brand: 'Unknown', productLine: 'SPARK' }, [], undefined, validTosIds)
  if (!invalidBrandErrors.brand) throw new Error('unknown brands must be rejected')
  const badDateErrors = validation.validatePlannedProject({ ...validInput, str5Date: '2027-2-1' }, [], undefined, validTosIds)
  if (!badDateErrors.str5Date) throw new Error('dates must use exact YYYY-MM-DD format')
})

const validPlannedRoadmapInput = {
  machineProjectType: '整机-手机',
  projectCode: 'X6877',
  androidVersion: 'Android 16',
  firstSaleTosVersionId: 'tos-17-2',
  brand: 'TECNO',
  productLine: 'SPARK',
  productSeries: 'SPARK 60',
  marketName: 'SPARK 60',
  productType: '新品',
  platform: 'G100',
  startRam: '4GB',
  versionType: 'Slim',
  str5Date: '2027-02-01',
  launchDate: '2027-01-01',
  developMode: '自研',
}
const validRoadmapTosIds = new Set(['tos-17-2'])

registerTableAssertions('planned-project runtime enum validation', [
  ['machine project type', 'machineProjectType', '整机-电视'],
  ['Android version', 'androidVersion', 'Android 19'],
  ['product type', 'productType', '换代'],
  ['start RAM', 'startRam', '5GB'],
  ['version type', 'versionType', 'Lite'],
  ['develop mode', 'developMode', '外研'],
  ['brand', 'brand', 'Unknown'],
  ['product line', 'productLine', 'ZERO'],
].map(([caseName, field, malformedValue]) => [caseName, () => {
  const { validatePlannedProject } = loadTypeScriptModule(path.join(root, 'src/lib/roadmapValidation.ts'))
  const errors = validatePlannedProject(
    { ...validPlannedRoadmapInput, [field]: malformedValue },
    [],
    undefined,
    validRoadmapTosIds,
  )
  if (!errors[field]) throw new Error(`${field} malformed runtime value was accepted`)
}]))

registerAssertion('planned-project validation rejects unknown stable tOS IDs', () => {
  const { validatePlannedProject } = loadTypeScriptModule(path.join(root, 'src/lib/roadmapValidation.ts'))
  const errors = validatePlannedProject(
    { ...validPlannedRoadmapInput, firstSaleTosVersionId: 'tos-99-0' },
    [],
    undefined,
    validRoadmapTosIds,
  )
  if (!errors.firstSaleTosVersionId) throw new Error('unknown first-sale tOS ID was accepted')
})

registerAssertion('roadmap sorting uses semantic versions, numeric RAM, ISO dates, and localized text', () => {
  const sorting = loadTypeScriptModule(path.join(root, 'src/lib/roadmapSorting.ts'))
  if (sorting.compareSemanticTos({ major: 18, minor: 0 }, { major: 17, minor: 2 }) <= 0) throw new Error('semantic tOS major ordering is wrong')
  if (sorting.compareSemanticTos({ major: 17, minor: 10 }, { major: 17, minor: 2 }) <= 0) throw new Error('semantic tOS minor ordering is wrong')
  if (sorting.compareRam('12GB', '8GB') <= 0) throw new Error('RAM ordering is wrong')
  if (sorting.compareIsoDate('2027-10-01', '2027-02-01') <= 0) throw new Error('ISO date ordering is wrong')
  if (sorting.compareLocalizedText('项目2', '项目10') >= 0) throw new Error('localized text must use numeric comparison')
  if (sorting.compareLocalizedText('TECNO', 'tecno') !== 0) throw new Error('localized text must be case-insensitive')

  const versions = [
    { id: 'tos-17-2', name: 'tOS 17.2', major: 17, minor: 2 },
    { id: 'tos-18-0', name: 'tOS 18.0', major: 18, minor: 0 },
  ]
  const older = { firstSaleTosVersionId: 'tos-17-2', startRam: '8GB', launchDate: '2027-02-01', displayName: '项目2' }
  const newer = { firstSaleTosVersionId: 'tos-18-0', startRam: '12GB', launchDate: '2027-10-01', displayName: '项目10' }
  for (const field of ['firstSaleTosVersionId', 'startRam', 'launchDate', 'displayName']) {
    if (sorting.compareRoadmapValues(field, older, newer, versions) >= 0) throw new Error(`${field} field comparator is wrong`)
  }
})

registerTableAssertions('roadmap RAM sorting rejects partial and missing values deterministically', [
  ['empty sorts after valid', () => {
    const { compareRam } = loadTypeScriptModule(path.join(root, 'src/lib/roadmapSorting.ts'))
    const result = compareRam('', '8GB')
    if (!Number.isFinite(result) || result <= 0) throw new Error('empty RAM must sort after valid RAM')
  }],
  ['malformed suffix sorts after valid', () => {
    const { compareRam } = loadTypeScriptModule(path.join(root, 'src/lib/roadmapSorting.ts'))
    const result = compareRam('8GB-extra', '8GB')
    if (!Number.isFinite(result) || result <= 0) throw new Error('partially parsed RAM must be invalid')
  }],
  ['2TB sorts after valid', () => {
    const { compareRam } = loadTypeScriptModule(path.join(root, 'src/lib/roadmapSorting.ts'))
    const result = compareRam('2TB', '16GB')
    if (!Number.isFinite(result) || result <= 0) throw new Error('2TB must not be parsed as approved RAM')
  }],
  ['invalid values have total order', () => {
    const { compareRam } = loadTypeScriptModule(path.join(root, 'src/lib/roadmapSorting.ts'))
    const forward = compareRam('', '2TB')
    const reverse = compareRam('2TB', '')
    if (forward === 0 || forward !== -reverse) throw new Error('invalid RAM values need deterministic antisymmetric ordering')
  }],
])

registerTableAssertions('semantic tOS sorting guards malformed values', [
  ['valid sorts before invalid', () => {
    const { compareSemanticTos } = loadTypeScriptModule(path.join(root, 'src/lib/roadmapSorting.ts'))
    const result = compareSemanticTos({ major: 17, minor: 2 }, { major: Infinity, minor: 0 })
    if (!Number.isFinite(result) || result >= 0) {
      throw new Error('valid semantic version must sort before invalid')
    }
  }],
  ['missing component is invalid', () => {
    const { compareSemanticTos } = loadTypeScriptModule(path.join(root, 'src/lib/roadmapSorting.ts'))
    const result = compareSemanticTos({ major: 17 }, { major: 18, minor: 0 })
    if (!Number.isFinite(result) || result <= 0) {
      throw new Error('malformed semantic version must sort after valid')
    }
  }],
  ['invalid values have total order', () => {
    const { compareSemanticTos } = loadTypeScriptModule(path.join(root, 'src/lib/roadmapSorting.ts'))
    const forward = compareSemanticTos({ major: Infinity, minor: 0 }, { major: NaN, minor: 0 })
    const reverse = compareSemanticTos({ major: NaN, minor: 0 }, { major: Infinity, minor: 0 })
    if (forward === 0 || forward !== -reverse) throw new Error('invalid semantic versions need deterministic antisymmetric ordering')
  }],
])

registerAssertion('roadmap mutation failure contracts require reason-specific payloads', () => {
  const typesSource = fs.readFileSync(path.join(root, 'src/types/roadmap.ts'), 'utf8')
  for (const token of [
    'export interface RoadmapReferencedMutationFailure',
    "reason: 'referenced'",
    'referenceCount: number',
    'export interface RoadmapInvalidMutationFailure',
    "reason: 'invalid'",
    'errors: Record<string, string>',
  ]) {
    if (!typesSource.includes(token)) throw new Error(`missing mutation contract token ${token}`)
  }
})

registerAssertion('roadmap audit snapshots have a display-value contract distinct from project fields', () => {
  const typesSource = fs.readFileSync(path.join(root, 'src/types/roadmap.ts'), 'utf8')
  if (!typesSource.includes('export type RoadmapAuditSnapshot = Partial<Record<RoadmapAuditField, string>>')) {
    throw new Error('missing RoadmapAuditSnapshot display-value type')
  }
  if (!typesSource.includes('snapshot?: RoadmapAuditSnapshot')) throw new Error('change logs must use RoadmapAuditSnapshot')
  const auditSource = fs.readFileSync(path.join(root, 'src/lib/roadmapAudit.ts'), 'utf8')
  if (!auditSource.includes('): RoadmapAuditSnapshot')) throw new Error('snapshot helper must return RoadmapAuditSnapshot')
})

registerAssertion('roadmap audit uses the fixed whitelist, resolved tOS names, and true changes only', () => {
  const audit = loadTypeScriptModule(path.join(root, 'src/lib/roadmapAudit.ts'))
  const expectedFields = 'firstSaleTosVersionId,brand,productLine,marketName,projectCode,productType,platform,startRam,versionType,str5Date,launchDate,developMode,remark'
  if (audit.ROADMAP_AUDIT_FIELDS.join(',') !== expectedFields) throw new Error('audit field whitelist or order is wrong')

  const versions = [
    { id: 'tos-17-2', name: 'tOS 17.2', major: 17, minor: 2 },
    { id: 'tos-18-0', name: 'tOS 18.0', major: 18, minor: 0 },
  ]
  const before = {
    machineProjectType: '整机-手机', projectCode: 'X6877', displayName: 'X6877', androidVersion: 'Android 16',
    firstSaleTosVersionId: 'tos-17-2', brand: 'TECNO', productLine: 'SPARK', productSeries: 'SPARK 60', marketName: 'SPARK 60',
    productType: '新品', platform: 'G100', startRam: '4GB', versionType: 'Slim', str5Date: '2027-01-01', launchDate: '2027-02-01',
    developMode: '自研', remark: '',
  }
  const after = { ...before, androidVersion: 'Android 17', productSeries: 'SPARK 70', firstSaleTosVersionId: 'tos-18-0', brand: 'Infinix', remark: 'updated' }
  const changes = audit.diffRoadmapProjectFields(before, after, versions)
  if (changes.map(change => change.field).join(',') !== 'firstSaleTosVersionId,brand,remark') {
    throw new Error(`audit diff included wrong fields or order: ${JSON.stringify(changes)}`)
  }
  if (changes[0].before !== 'tOS 17.2' || changes[0].after !== 'tOS 18.0') throw new Error('audit diff must resolve stable tOS IDs')
  if (changes.some(change => change.field === 'androidVersion' || change.field === 'productSeries')) {
    throw new Error('Android version and product series must be excluded from ordinary diffs')
  }

  const snapshot = audit.createRoadmapAuditSnapshot(after, versions)
  if (Object.keys(snapshot).join(',') !== expectedFields) throw new Error(`audit snapshot order is wrong: ${Object.keys(snapshot).join(',')}`)
  if (snapshot.firstSaleTosVersionId !== 'tOS 18.0' || snapshot.brand !== 'Infinix' || snapshot.remark !== 'updated') {
    throw new Error(`audit snapshot content is wrong: ${JSON.stringify(snapshot)}`)
  }
  if ('androidVersion' in snapshot || 'productSeries' in snapshot) throw new Error('audit snapshot contains excluded fields')
})

const roadmapStorePath = path.join(root, 'src/stores/roadmap.ts')

function loadIsolatedRoadmapStore() {
  return createTypeScriptModuleLoader()(roadmapStorePath)
}

function resetRoadmapStore(storeModule) {
  storeModule.useRoadmapStore.setState(storeModule.createInitialRoadmapState())
  return storeModule.useRoadmapStore
}

function createPlannedInput(overrides = {}) {
  return {
    ...validPlannedRoadmapInput,
    remark: '',
    actor: '张三',
    ...overrides,
  }
}

registerAssertion('roadmap store declares the exact persistence boundary', () => {
  const source = fs.readFileSync(roadmapStorePath, 'utf8')
  for (const token of ['persist(', "name: 'pms-project-roadmap'", 'version: 1', 'migrate:', 'partialize:']) {
    if (!source.includes(token)) throw new Error(`Roadmap store is missing ${token}`)
  }
  if (/from ['"]@\/stores\/project['"]/.test(source)) throw new Error('roadmap store must not import the project store')
  if (/normalProjects\s*:/.test(source)) throw new Error('normal projects must not be copied into roadmap state')
})

registerAssertion('initial roadmap state has exact semantic-descending versions and UI defaults', () => {
  const store = loadIsolatedRoadmapStore()
  const versions = store.createInitialTosVersions()
  const expected = [
    ['tos-18-0', 'tOS 18.0'],
    ['tos-17-2', 'tOS 17.2'],
    ['tos-17-1', 'tOS 17.1'],
    ['tos-17-0', 'tOS 17.0'],
    ['tos-16-3', 'tOS 16.3'],
    ['tos-16-2', 'tOS 16.2'],
    ['tos-16-1', 'tOS 16.1'],
  ]
  if (JSON.stringify(versions.map(version => [version.id, version.name])) !== JSON.stringify(expected)) {
    throw new Error(`initial versions are wrong: ${JSON.stringify(versions)}`)
  }
  if (versions.some(version => 'latest' in version || !Number.isFinite(Date.parse(version.createdAt)) || !Number.isFinite(Date.parse(version.updatedAt)))) {
    throw new Error('initial versions must have valid timestamps and no latest metadata')
  }
  const initial = store.createInitialRoadmapState()
  const expectedVisible = loadTypeScriptModule(path.join(root, 'src/types/roadmap.ts')).ROADMAP_COLUMNS
    .filter(column => column.defaultVisible)
    .map(column => column.key)
  if (
    initial.plannedProjects.length
    || initial.viewMode !== 'table'
    || initial.selectedTosVersionId !== 'tos-18-0'
    || initial.brandFilter !== 'all'
    || initial.productTypeFilter !== 'all'
    || initial.filters.length
    || JSON.stringify(initial.visibleColumns) !== JSON.stringify(expectedVisible)
    || JSON.stringify(initial.sort) !== JSON.stringify({ field: null, direction: null })
    || initial.selectedConflictKey !== null
  ) throw new Error(`initial roadmap UI state is wrong: ${JSON.stringify(initial)}`)
})

registerAssertion('planned project CRUD enforces duplicates and audit semantics', () => {
  const storeModule = loadIsolatedRoadmapStore()
  const store = resetRoadmapStore(storeModule)
  const createResult = store.getState().createPlannedProject(createPlannedInput())
  if (!createResult.ok) throw new Error(`valid create failed: ${JSON.stringify(createResult)}`)
  let state = store.getState()
  const created = state.plannedProjects[0]
  if (!created || created.displayName !== 'X6877' || created.status !== '待规划' || created.createdBy !== '张三' || created.updatedBy !== '张三') {
    throw new Error(`created planned project is wrong: ${JSON.stringify(created)}`)
  }
  if (state.changeLogs[0]?.action !== 'create' || state.changeLogs[0]?.snapshot?.firstSaleTosVersionId !== 'tOS 17.2') {
    throw new Error(`create audit is wrong: ${JSON.stringify(state.changeLogs[0])}`)
  }
  const duplicate = store.getState().createPlannedProject(createPlannedInput({ actor: '李四' }))
  if (duplicate.ok || duplicate.reason !== 'duplicate') throw new Error(`own duplicate was accepted: ${JSON.stringify(duplicate)}`)
  const externalDuplicate = store.getState().createPlannedProject(createPlannedInput({ projectCode: 'A100' }), {
    allRows: [{
      id: 'normal-a100', source: 'normal', projectCode: 'A100', androidVersion: 'Android 16', productType: '新品',
    }],
  })
  if (externalDuplicate.ok || externalDuplicate.reason !== 'duplicate') throw new Error('caller-supplied normal row was ignored')

  const updated = store.getState().updatePlannedProject(created.id, createPlannedInput({
    productType: '老品',
    androidVersion: 'Android 17',
    productSeries: 'SPARK 70',
    remark: '已更新',
    actor: '李四',
  }))
  if (!updated.ok) throw new Error(`valid update failed: ${JSON.stringify(updated)}`)
  state = store.getState()
  const after = state.plannedProjects[0]
  if (after.displayName !== 'X6877(Android 17)' || after.createdAt !== created.createdAt || after.createdBy !== '张三' || after.updatedBy !== '李四') {
    throw new Error(`updated planned project is wrong: ${JSON.stringify(after)}`)
  }
  if (state.changeLogs[0]?.action !== 'update' || state.changeLogs[0]?.changes.map(change => change.field).join(',') !== 'productType,remark') {
    throw new Error(`update audit is wrong: ${JSON.stringify(state.changeLogs[0])}`)
  }
  const logCount = state.changeLogs.length
  const excludedOnly = store.getState().updatePlannedProject(created.id, createPlannedInput({
    productType: '老品', androidVersion: 'Android 18', productSeries: 'SPARK 80', remark: '已更新', actor: '王五',
  }))
  if (!excludedOnly.ok || store.getState().changeLogs.length !== logCount) {
    throw new Error('Android/product-series-only update must mutate without an ordinary update log')
  }
  const deleted = store.getState().deletePlannedProject(created.id, '赵六')
  if (!deleted.ok || store.getState().plannedProjects.length || store.getState().changeLogs[0]?.action !== 'delete') {
    throw new Error(`delete behavior is wrong: ${JSON.stringify(store.getState())}`)
  }
  const missing = store.getState().deletePlannedProject(created.id, '赵六')
  if (missing.ok || missing.reason !== 'not-found') throw new Error('missing delete needs a not-found result')
})

registerAssertion('planned project validation uses the current tOS catalog and caller comparison rows', () => {
  const storeModule = loadIsolatedRoadmapStore()
  const store = resetRoadmapStore(storeModule)
  const malformedInput = { ...createPlannedInput() }
  delete malformedInput.platform
  const malformed = store.getState().createPlannedProject(malformedInput)
  if (malformed.ok || malformed.reason !== 'invalid' || !malformed.errors.platform) {
    throw new Error(`malformed runtime input needs a validation result: ${JSON.stringify(malformed)}`)
  }
  const invalid = store.getState().createPlannedProject(createPlannedInput({ firstSaleTosVersionId: 'tos-99-0' }))
  if (invalid.ok || invalid.reason !== 'invalid' || !invalid.errors.firstSaleTosVersionId) {
    throw new Error(`unknown tOS version was accepted: ${JSON.stringify(invalid)}`)
  }
  const comparisonRows = [{ id: 'normal-1', ...createPlannedInput(), displayName: 'X6877', source: 'normal', status: '进行中', readOnly: true }]
  const duplicate = store.getState().createPlannedProject(createPlannedInput(), { allRows: comparisonRows })
  if (duplicate.ok || duplicate.reason !== 'duplicate') throw new Error('caller comparison row was ignored')
})

registerAssertion('tOS CRUD normalizes names, preserves IDs, sorts, trims targets, and protects references', () => {
  const storeModule = loadIsolatedRoadmapStore()
  const store = resetRoadmapStore(storeModule)
  if (!store.getState().createTosVersion({ name: ' TOS  19.2 ' }).ok) throw new Error('normalized tOS create failed')
  let state = store.getState()
  const created = state.tosVersions.find(version => version.name === 'tOS 19.2')
  if (!created || created.id !== 'tos-19-2' || state.tosVersions[0].id !== created.id) throw new Error('new version ID/order is wrong')
  const duplicate = store.getState().createTosVersion({ name: 'tos19.2' })
  if (duplicate.ok || duplicate.reason !== 'duplicate') throw new Error('normalized duplicate version was accepted')
  if (!store.getState().renameTosVersion(created.id, { name: 'tOS 15.9' }).ok) throw new Error('version rename failed')
  state = store.getState()
  const renamed = state.tosVersions.find(version => version.id === created.id)
  if (!renamed || renamed.name !== 'tOS 15.9' || state.tosVersions.at(-1)?.id !== created.id) throw new Error('rename changed ID or failed to re-sort')
  if (!store.getState().setTosTargets(created.id, ['  target A ', '', '   ', 'target B']).ok) throw new Error('target update failed')
  if (JSON.stringify(store.getState().tosVersions.find(version => version.id === created.id)?.targets) !== JSON.stringify(['target A', 'target B'])) {
    throw new Error('targets were not trimmed')
  }

  store.getState().createPlannedProject(createPlannedInput())
  const referenced = store.getState().deleteTosVersion('tos-17-2', 2)
  if (referenced.ok || referenced.reason !== 'referenced' || referenced.referenceCount !== 3) {
    throw new Error(`reference count is wrong: ${JSON.stringify(referenced)}`)
  }
  store.getState().setSelectedTosVersionId('tos-18-0')
  const deleted = store.getState().deleteTosVersion('tos-18-0', 0)
  if (!deleted.ok || store.getState().selectedTosVersionId !== 'tos-17-2') {
    throw new Error('selected-version fallback is wrong')
  }
})

registerAssertion('roadmap setters sanitize columns and persistence excludes transient conflict state', () => {
  const storeModule = loadIsolatedRoadmapStore()
  const store = resetRoadmapStore(storeModule)
  store.getState().setVisibleColumns(['unknown', 'brand', 'brand'])
  if (JSON.stringify(store.getState().visibleColumns) !== JSON.stringify(['brand'])) throw new Error('known visible columns were not sanitized')
  store.getState().setVisibleColumns([])
  if (store.getState().visibleColumns.length < 1) throw new Error('at least one business field must remain visible')
  store.getState().setSelectedConflictKey('X6877|Android 16|新品')
  const persisted = storeModule.partializeRoadmapState(store.getState())
  const expectedKeys = ['plannedProjects', 'tosVersions', 'changeLogs', 'viewMode', 'selectedTosVersionId', 'brandFilter', 'productTypeFilter', 'filters', 'visibleColumns', 'sort']
  if (JSON.stringify(Object.keys(persisted)) !== JSON.stringify(expectedKeys)) throw new Error(`persistence boundary is wrong: ${Object.keys(persisted)}`)
  if ('selectedConflictKey' in persisted || 'normalProjects' in persisted || 'conflictGroups' in persisted) throw new Error('transient/derived state was persisted')
})

registerAssertion('roadmap migration repairs legacy names, references, UI controls, and selected version', () => {
  const store = loadIsolatedRoadmapStore()
  const migrated = store.migrateRoadmapState({
    tosVersions: [
      { name: 'tos17.2', targets: [' first ', '', 'second'], createdAt: '2024-01-01T00:00:00.000Z' },
      { id: 'legacy-18', name: 'TOS 18.0', targets: [' top '] },
    ],
    plannedProjects: [{
      id: 'planned-legacy', ...validPlannedRoadmapInput, displayName: 'stale', firstSaleTosVersionId: undefined,
      tosVersion: 'tOS17.2', productType: '换代', status: '草稿', createdAt: 'bad', updatedAt: 'bad', createdBy: '甲', updatedBy: '乙',
    }],
    changeLogs: [{
      id: 'log-1', projectId: 'normal-1', projectDisplayName: 'X1', source: 'normal', action: 'update', actor: '甲',
      occurredAt: '2024-01-01T00:00:00.000Z', tosVersionName: 'tOS 17.2',
      changes: [{ field: 'brand', before: 'TECNO', after: 'Infinix' }],
    }],
    viewMode: 'evolution', selectedTosVersionId: 'missing', brandFilter: 'TECNO', productTypeFilter: '老品',
    filters: [
      { id: 'valid', field: 'brand', operator: 'equals', value: 'TECNO' },
      { id: 'bad-field', field: 'unknown', operator: 'equals', value: 'x' },
      { id: 'bad-operator', field: 'brand', operator: 'wat', value: 'x' },
    ],
    visibleColumns: ['unknown', 'marketName', 'marketName'],
    sort: { field: 'launchDate', direction: 'descend' },
  }, 0)
  if (migrated.tosVersions.map(version => version.name).join(',') !== 'tOS 18.0,tOS 17.2') throw new Error('versions were not normalized/sorted')
  if (migrated.tosVersions[1].id !== 'tos-17-2' || JSON.stringify(migrated.tosVersions[1].targets) !== JSON.stringify(['first', 'second'])) {
    throw new Error('missing stable ID or targets were not repaired')
  }
  const planned = migrated.plannedProjects[0]
  if (!planned || planned.firstSaleTosVersionId !== 'tos-17-2' || planned.displayName !== 'X6877(Android 16)' || planned.status !== '待规划') {
    throw new Error(`legacy planned project was not repaired: ${JSON.stringify(planned)}`)
  }
  if (!Number.isFinite(Date.parse(planned.createdAt)) || !Number.isFinite(Date.parse(planned.updatedAt))) throw new Error('timestamps were not normalized')
  if (migrated.filters.length !== 1 || JSON.stringify(migrated.visibleColumns) !== JSON.stringify(['marketName'])) throw new Error('filters/columns were not sanitized')
  if (migrated.selectedTosVersionId !== 'legacy-18' || migrated.changeLogs.length !== 1 || 'conflictGroups' in migrated) {
    throw new Error('selection/log/conflict migration is wrong')
  }
})

registerAssertion('roadmap migration and malformed persisted JSON safely fall back', () => {
  const store = loadIsolatedRoadmapStore()
  const fallback = store.migrateRoadmapState(null, 0)
  if (fallback.tosVersions[0]?.id !== 'tos-18-0' || fallback.plannedProjects.length) throw new Error('unusable shape did not fall back')

  const previousWindow = globalThis.window
  const previousError = console.error
  const messages = []
  globalThis.window = {
    localStorage: {
      getItem: () => '{malformed',
      setItem: () => {},
      removeItem: () => {},
    },
  }
  console.error = (...args) => messages.push(args)
  try {
    const malformedModule = loadIsolatedRoadmapStore()
    const state = malformedModule.useRoadmapStore.getState()
    if (state.tosVersions[0]?.id !== 'tos-18-0' || state.plannedProjects.length) throw new Error('malformed JSON did not hydrate initial state')
  } finally {
    console.error = previousError
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
  if (messages.length !== 1) throw new Error(`malformed JSON must emit one console.error, got ${messages.length}`)
})

const validMigratedLogBase = {
  id: 'log-valid',
  projectId: 'project-1',
  projectDisplayName: 'X6877',
  source: 'planned',
  actor: '张三',
  occurredAt: '2026-01-02T00:00:00.000Z',
  tosVersionName: 'tOS 17.2',
}

function migrateChangeLogFixtures(changeLogs) {
  const store = loadIsolatedRoadmapStore()
  return store.migrateRoadmapState({
    tosVersions: [],
    plannedProjects: [],
    changeLogs,
    selectedTosVersionId: null,
  }, 0).changeLogs
}

registerTableAssertions('roadmap migration rejects malformed audit changes', [
  ['unknown audit field', () => {
    const logs = migrateChangeLogFixtures([{
      ...validMigratedLogBase,
      action: 'update',
      changes: [{ field: 'androidVersion', before: 'Android 16', after: 'Android 17' }],
    }])
    if (logs.length) throw new Error('unknown audit field was preserved')
  }],
  ['missing before string', () => {
    const logs = migrateChangeLogFixtures([{
      ...validMigratedLogBase,
      action: 'update',
      changes: [{ field: 'brand', after: 'Infinix' }],
    }])
    if (logs.length) throw new Error('change without before string was preserved')
  }],
  ['empty update changes', () => {
    const logs = migrateChangeLogFixtures([{ ...validMigratedLogBase, action: 'update', changes: [] }])
    if (logs.length) throw new Error('update without a valid change was preserved')
  }],
])

registerTableAssertions('roadmap migration requires snapshots for create and delete audit logs', [
  ['create snapshot', () => {
    const logs = migrateChangeLogFixtures([{ ...validMigratedLogBase, action: 'create', changes: [] }])
    if (logs.length) throw new Error('create log without snapshot was preserved')
  }],
  ['delete snapshot', () => {
    const logs = migrateChangeLogFixtures([{ ...validMigratedLogBase, action: 'delete', changes: [] }])
    if (logs.length) throw new Error('delete log without snapshot was preserved')
  }],
])

registerTableAssertions('roadmap migration rejects malformed audit snapshots', [
  ['empty snapshot', () => {
    const logs = migrateChangeLogFixtures([{
      ...validMigratedLogBase,
      action: 'create',
      changes: [],
      snapshot: {},
    }])
    if (logs.length) throw new Error('empty snapshot was preserved')
  }],
  ['unknown snapshot key', () => {
    const logs = migrateChangeLogFixtures([{
      ...validMigratedLogBase,
      action: 'create',
      changes: [],
      snapshot: { brand: 'TECNO', androidVersion: 'Android 16' },
    }])
    if (logs.length) throw new Error('snapshot with unknown key was preserved')
  }],
  ['non-string snapshot value', () => {
    const logs = migrateChangeLogFixtures([{
      ...validMigratedLogBase,
      action: 'delete',
      changes: [],
      snapshot: { brand: 17 },
    }])
    if (logs.length) throw new Error('snapshot with non-string value was preserved')
  }],
])

registerAssertion('roadmap migration preserves valid create, update, and delete audit logs', () => {
  const logs = migrateChangeLogFixtures([
    { ...validMigratedLogBase, id: 'create', action: 'create', changes: [], snapshot: { brand: 'TECNO' } },
    { ...validMigratedLogBase, id: 'update', action: 'update', changes: [{ field: 'brand', before: 'TECNO', after: 'Infinix' }] },
    { ...validMigratedLogBase, id: 'delete', action: 'delete', changes: [], snapshot: { firstSaleTosVersionId: 'tOS 17.2' } },
  ])
  if (logs.map(log => log.id).join(',') !== 'create,update,delete') {
    throw new Error(`valid audit logs were not preserved: ${JSON.stringify(logs)}`)
  }
})

registerAssertion('empty migrated tOS catalogs use null selection', () => {
  const store = loadIsolatedRoadmapStore()
  const migrated = store.migrateRoadmapState({
    tosVersions: [],
    plannedProjects: [],
    changeLogs: [],
    selectedTosVersionId: 'tos-18-0',
  }, 0)
  if (migrated.tosVersions.length || migrated.selectedTosVersionId !== null) {
    throw new Error(`empty catalog selection must be null: ${JSON.stringify(migrated.selectedTosVersionId)}`)
  }
})

registerAssertion('deleting the last tOS version sets selection to null', () => {
  const storeModule = loadIsolatedRoadmapStore()
  const store = resetRoadmapStore(storeModule)
  const onlyVersion = storeModule.createInitialTosVersions().at(-1)
  store.setState({ tosVersions: [onlyVersion], selectedTosVersionId: 'stale-version-id' })
  const result = store.getState().deleteTosVersion(onlyVersion.id, 0)
  if (!result.ok || store.getState().tosVersions.length || store.getState().selectedTosVersionId !== null) {
    throw new Error(`delete-last selection must be null: ${JSON.stringify(store.getState().selectedTosVersionId)}`)
  }
})

function hydrateRoadmapStoreFromEnvelope(envelope) {
  const previousWindow = globalThis.window
  globalThis.window = {
    localStorage: {
      getItem: key => key === 'pms-project-roadmap' ? JSON.stringify(envelope) : null,
      setItem: () => {},
      removeItem: () => {},
    },
  }
  try {
    const storeModule = loadIsolatedRoadmapStore()
    return storeModule.useRoadmapStore.getState()
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
}

registerTableAssertions('roadmap hydration sanitizes every persisted envelope version', [
  ['current version', 1],
  ['missing version', undefined],
].map(([caseName, version]) => [caseName, () => {
  const envelope = {
    state: {
      tosVersions: [],
      plannedProjects: [],
      changeLogs: [],
      selectedTosVersionId: 'missing-version',
      filters: [{ id: 'bad', field: 'unknown', operator: 'equals', value: 'x' }],
      visibleColumns: ['unknown'],
      selectedConflictKey: 'must-not-hydrate',
    },
  }
  if (version !== undefined) envelope.version = version
  const hydrated = hydrateRoadmapStoreFromEnvelope(envelope)
  if (
    hydrated.selectedTosVersionId !== null
    || hydrated.filters.length
    || hydrated.visibleColumns.length !== 1
    || hydrated.visibleColumns[0] === 'unknown'
    || hydrated.selectedConflictKey !== null
    || typeof hydrated.createPlannedProject !== 'function'
  ) throw new Error(`persisted state bypassed sanitization: ${JSON.stringify(hydrated)}`)
}]))

registerAssertion('roadmap duplicate-comparison contract uses source-aware allRows only', () => {
  const typesSource = fs.readFileSync(path.join(root, 'src/types/roadmap.ts'), 'utf8')
  if (!typesSource.includes("'id' | 'source' | 'projectCode' | 'androidVersion' | 'productType'")) {
    throw new Error('comparison rows must carry source and ID')
  }
  if (!typesSource.includes('allRows?: readonly RoadmapDuplicateComparisonRow[]')) throw new Error('missing allRows comparison boundary')
  if (typesSource.includes('duplicateKeys')) throw new Error('ambiguous duplicateKeys boundary remains')
})

registerAssertion('roadmap update excludes only its current planned row from natural allRows', () => {
  const storeModule = loadIsolatedRoadmapStore()
  const store = resetRoadmapStore(storeModule)
  if (!store.getState().createPlannedProject(createPlannedInput()).ok) throw new Error('fixture create failed')
  const created = store.getState().plannedProjects[0]
  const allRows = [
    { ...created, source: 'planned', readOnly: false },
    {
      ...created,
      id: 'normal-unrelated',
      source: 'normal',
      projectCode: 'NORMAL-1',
      displayName: 'NORMAL-1',
      readOnly: true,
    },
  ]
  const updated = store.getState().updatePlannedProject(created.id, createPlannedInput({ remark: '正常更新' }), { allRows })
  if (!updated.ok || store.getState().plannedProjects[0].remark !== '正常更新') {
    throw new Error(`current planned row was treated as an external duplicate: ${JSON.stringify(updated)}`)
  }
})

function persistedPlannedProject(projectCode, overrides = {}) {
  return {
    ...validPlannedRoadmapInput,
    id: `planned-${projectCode}`,
    projectCode,
    displayName: projectCode,
    remark: '',
    status: '待规划',
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: '张三',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: '张三',
    ...overrides,
  }
}

registerAssertion('roadmap migration deterministically repairs IDs across persisted collections', () => {
  const storeModule = loadIsolatedRoadmapStore()
  const migrated = storeModule.migrateRoadmapState({
    tosVersions: [
      { name: 'tOS 17.2' },
      { id: 'tos-17-2', name: 'tOS 18.0' },
    ],
    plannedProjects: [
      persistedPlannedProject('A1', { id: undefined }),
      persistedPlannedProject('A2', { id: 'planned-migrated-1' }),
      persistedPlannedProject('A3', { id: 'planned-shared' }),
      persistedPlannedProject('A4', { id: 'planned-shared' }),
    ],
    changeLogs: [
      { ...validMigratedLogBase, id: undefined, action: 'update', changes: [{ field: 'brand', before: 'TECNO', after: 'Infinix' }] },
      { ...validMigratedLogBase, id: 'roadmap-log-migrated-1', action: 'update', changes: [{ field: 'brand', before: 'Infinix', after: 'itel' }] },
      { ...validMigratedLogBase, id: 'shared-log', action: 'create', changes: [], snapshot: { brand: 'TECNO' } },
      { ...validMigratedLogBase, id: 'shared-log', action: 'delete', changes: [], snapshot: { brand: 'TECNO' } },
    ],
    filters: [
      { field: 'brand', operator: 'equals', value: 'TECNO' },
      { id: 'roadmap-filter-migrated-1', field: 'marketName', operator: 'contains', value: 'A' },
      { id: 'shared-filter', field: 'brand', operator: 'equals', value: 'Infinix' },
      { id: 'shared-filter', field: 'brand', operator: 'equals', value: 'itel' },
    ],
    visibleColumns: ['brand'],
    selectedTosVersionId: 'missing',
  }, 0)
  for (const [label, records] of [
    ['versions', migrated.tosVersions],
    ['projects', migrated.plannedProjects],
    ['logs', migrated.changeLogs],
    ['filters', migrated.filters],
  ]) {
    const ids = records.map(record => record.id)
    if (ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) {
      throw new Error(`${label} IDs are not React-key safe: ${JSON.stringify(ids)}`)
    }
  }
  const secondPass = storeModule.migrateRoadmapState(migrated, 1)
  if (JSON.stringify(secondPass) !== JSON.stringify(migrated)) throw new Error('roadmap sanitizer is not idempotent')
  if (migrated.selectedTosVersionId === null || !migrated.tosVersions.some(version => version.id === migrated.selectedTosVersionId)) {
    throw new Error('sanitizer left an invalid selected version reference')
  }

  const store = resetRoadmapStore(storeModule)
  store.setState(migrated)
  const repairedProject = migrated.plannedProjects.find(project => project.projectCode === 'A2')
  const updateInput = { ...repairedProject, actor: '李四', remark: '修复后可编辑' }
  if (!store.getState().updatePlannedProject(repairedProject.id, updateInput).ok) throw new Error('repaired project ID cannot be updated')
  if (!store.getState().deletePlannedProject(repairedProject.id, '李四').ok) throw new Error('repaired project ID cannot be deleted')
})

registerAssertion('normal change actions reject invalid shapes and round-trip through persistence', () => {
  const storeModule = loadIsolatedRoadmapStore()
  const store = resetRoadmapStore(storeModule)
  const invalid = store.getState().recordNormalProjectChange({
    projectId: 'normal-bad', projectDisplayName: 'BAD', action: 'update', actor: '张三', tosVersionName: 'tOS 17.2', changes: [],
  })
  if (invalid?.ok !== false || invalid.reason !== 'invalid' || store.getState().changeLogs.length) {
    throw new Error('invalid normal update was persisted')
  }
  const inputs = [
    {
      id: 'normal-shared', projectId: 'normal-update', projectDisplayName: 'N1', action: 'update', actor: '张三', tosVersionName: 'tOS 17.2',
      changes: [{ field: 'brand', before: 'TECNO', after: 'Infinix' }],
    },
    {
      id: 'normal-shared', projectId: 'normal-create', projectDisplayName: 'N2', action: 'create', actor: '张三', tosVersionName: 'tOS 17.2',
      changes: [], snapshot: { brand: 'TECNO' },
    },
    {
      projectId: 'normal-delete', projectDisplayName: 'N3', action: 'delete', actor: '张三', tosVersionName: 'tOS 17.2',
      changes: [], snapshot: { brand: 'TECNO' },
    },
  ]
  for (const input of inputs) {
    const result = store.getState().recordNormalProjectChange(input)
    if (!result?.ok) throw new Error(`valid normal log was rejected: ${JSON.stringify(result)}`)
  }
  const producedIds = store.getState().changeLogs.map(log => log.id)
  if (new Set(producedIds).size !== producedIds.length) throw new Error(`caller log ID collision survived: ${JSON.stringify(producedIds)}`)
  const persisted = storeModule.partializeRoadmapState(store.getState())
  const migrated = storeModule.migrateRoadmapState(persisted, 1)
  if (migrated.changeLogs.length !== inputs.length) throw new Error('action-produced normal logs did not survive migration')
})

registerAssertion('tOS selection actions enforce valid references and repair transitions', () => {
  const storeModule = loadIsolatedRoadmapStore()
  const store = resetRoadmapStore(storeModule)
  store.getState().setSelectedTosVersionId('missing')
  if (store.getState().selectedTosVersionId !== 'tos-18-0') throw new Error('setter accepted an unknown tOS ID')
  store.getState().setSelectedTosVersionId(null)
  if (store.getState().selectedTosVersionId !== 'tos-18-0') throw new Error('setter left a non-empty catalog unselected')

  const nullPersistedState = {
    ...storeModule.partializeRoadmapState(store.getState()),
    selectedTosVersionId: null,
  }
  const nullRoundTrip = storeModule.migrateRoadmapState(nullPersistedState, 1)
  if (nullRoundTrip.selectedTosVersionId !== 'tos-18-0') throw new Error('migration preserved null for a non-empty catalog')
  const hydrated = hydrateRoadmapStoreFromEnvelope({ state: nullPersistedState, version: 1 })
  if (hydrated.selectedTosVersionId !== 'tos-18-0') throw new Error('merge preserved null for a non-empty catalog')

  store.setState({ selectedTosVersionId: null })
  const unselectedId = store.getState().tosVersions.at(-1).id
  if (!store.getState().deleteTosVersion(unselectedId, 0).ok) throw new Error('unselected version delete failed')
  if (store.getState().selectedTosVersionId !== store.getState().tosVersions[0].id) throw new Error('delete did not repair null selection')

  store.setState({ selectedTosVersionId: null })
  if (!store.getState().createTosVersion({ name: 'tOS 19.0' }).ok) throw new Error('version create failed')
  if (store.getState().selectedTosVersionId !== store.getState().tosVersions[0].id) throw new Error('create did not repair null selection')

  const renamedId = 'tos-17-2'
  store.setState({ selectedTosVersionId: null })
  if (!store.getState().renameTosVersion(renamedId, { name: 'tOS 20.0' }).ok) throw new Error('rename failed')
  if (store.getState().selectedTosVersionId !== renamedId || store.getState().tosVersions[0].id !== renamedId) {
    throw new Error('rename did not repair selection to the highest semantic version')
  }

  store.setState({ tosVersions: [], selectedTosVersionId: null })
  if (!store.getState().createTosVersion({ name: 'tOS 21.0' }).ok) throw new Error('first version create failed')
  const first = store.getState().tosVersions[0]
  if (store.getState().selectedTosVersionId !== first.id) throw new Error('first created version was not selected')
  if (!store.getState().renameTosVersion(first.id, { name: 'tOS 21.1' }).ok) throw new Error('single-version rename failed')
  if (store.getState().selectedTosVersionId !== first.id || store.getState().tosVersions[0].id !== first.id) {
    throw new Error('rename changed the stable selected ID')
  }
})

registerAssertion('roadmap store loads in Node without localStorage and prepends normal logs only', () => {
  const previousWindow = globalThis.window
  try {
    delete globalThis.window
    const storeModule = loadIsolatedRoadmapStore()
    const store = resetRoadmapStore(storeModule)
    store.getState().recordNormalProjectChange({
      projectId: 'normal-1', projectDisplayName: 'X1', action: 'update', actor: '张三',
      tosVersionName: 'tOS 17.2', changes: [{ field: 'brand', before: 'TECNO', after: 'Infinix' }],
    })
    store.getState().recordNormalProjectChange({
      projectId: 'normal-2', projectDisplayName: 'X2', action: 'delete', actor: '李四',
      tosVersionName: 'tOS 18.0', changes: [], snapshot: { brand: 'TECNO' },
    })
    const state = store.getState()
    if (state.changeLogs.map(log => log.projectId).join(',') !== 'normal-2,normal-1') throw new Error('normal logs were not prepended')
    if ('normalProjects' in state) throw new Error('normal projects leaked into roadmap state')
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
})

function roadmapRow(overrides = {}) {
  return {
    id: 'normal-x6877',
    source: 'normal',
    readOnly: true,
    status: '在研',
    machineProjectType: '整机-手机',
    projectCode: 'X6877',
    displayName: 'X6877',
    androidVersion: 'Android 16',
    firstSaleTosVersionId: 'tos-17-2',
    brand: 'TECNO',
    productLine: 'SPARK',
    productSeries: 'SPARK 60',
    marketName: 'SPARK 60',
    productType: '新品',
    platform: 'G100',
    startRam: '8GB',
    versionType: 'Full',
    str5Date: '2027-01-01',
    launchDate: '2027-02-01',
    developMode: '自研',
    remark: '',
    ...overrides,
  }
}

registerAssertion('normal and planned roadmap adapters enforce source boundaries and migration fallbacks', () => {
  const adapter = loadTypeScriptModule(path.join(root, 'src/lib/roadmapProjectAdapter.ts'))
  const versions = [
    { id: 'tos-17-2', name: 'tOS 17.2', major: 17, minor: 2, targets: [], createdAt: '', updatedAt: '' },
    { id: 'tos-16-3', name: 'tOS 16.3', major: 16, minor: 3, targets: [], createdAt: '', updatedAt: '' },
  ]
  const normal = adapter.adaptNormalProject({
    id: 'normal-1', name: 'legacy-name', type: '整机-手机', status: '在研',
    androidVersion: 'Android 16', firstSaleTosVersionId: 'tos-17-2', tosVersion: 'tOS16.3',
    projectCode: ' X6877 ', model: 'legacy-code', brand: 'TECNO', productLine: 'SPARK', productSeries: 'SPARK 60', marketName: 'SPARK 60',
    productType: '升级', platform: 'explicit-platform', cpu: 'legacy-cpu', startRam: '8GB', memory: '6GB+128GB', versionType: 'Full',
    str5Date: '2027-01-01', launchDate: '2027-02-01', developMode: '外研', remark: 'explicit remark', projectDescription: 'legacy remark',
  }, versions)
  if (!normal) throw new Error('machine project was excluded')
  if (
    normal.source !== 'normal'
    || !normal.readOnly
    || normal.projectCode !== 'X6877'
    || normal.displayName !== 'legacy-name'
    || normal.firstSaleTosVersionId !== 'tos-17-2'
    || normal.productType !== '老品'
    || normal.platform !== 'explicit-platform'
    || normal.startRam !== '8GB'
    || normal.developMode !== '纯外研'
    || normal.remark !== 'explicit remark'
  ) throw new Error(`normal adapter ignored explicit fields or legacy normalization: ${JSON.stringify(normal)}`)

  const switched = adapter.adaptNormalProject({
    ...normal,
    id: 'normal-switch',
    source: undefined,
    readOnly: undefined,
    type: '整机-PAD',
    firstSaleTosVersionId: undefined,
    tosVersion: 'tos16.3',
    projectCode: undefined,
    model: ' A100 ',
    platform: undefined,
    cpu: 'MTK-A',
    startRam: undefined,
    memory: '6GB+128GB',
    productType: '切换',
    developMode: '联合开发',
    remark: undefined,
    projectDescription: 'legacy description',
  }, versions)
  if (
    !switched
    || switched.projectCode !== 'A100'
    || switched.firstSaleTosVersionId !== 'tos-16-3'
    || switched.startRam !== '6GB'
    || switched.productType !== '老品'
    || switched.developMode !== 'ITD-ODC'
    || switched.remark !== 'legacy description'
  ) throw new Error(`legacy fallback mapping is wrong: ${JSON.stringify(switched)}`)
  if (adapter.adaptNormalProject({ ...normal, type: '技术项目' }, versions) !== null) {
    throw new Error('non-machine project entered the normal roadmap')
  }

  const plannedInput = {
    ...roadmapRow({ id: 'planned-1', source: undefined, readOnly: undefined, status: '待规划', displayName: 'stale name' }),
    createdAt: '', createdBy: '张三', updatedAt: '', updatedBy: '张三',
  }
  const planned = adapter.adaptPlannedProject(plannedInput)
  if (planned.source !== 'planned' || planned.readOnly || planned.displayName !== 'X6877') {
    throw new Error(`planned adapter boundary is wrong: ${JSON.stringify(planned)}`)
  }

  const merged = adapter.mergeRoadmapProjects(
    [{ ...normal, type: '技术项目' }, { ...normal, id: 'normal-merge', type: '整机-手机' }],
    [plannedInput],
    versions,
  )
  if (merged.map(row => `${row.source}:${row.id}`).join(',') !== 'normal:normal-merge,planned:planned-1') {
    throw new Error(`merge copied non-machine or lost source order: ${JSON.stringify(merged)}`)
  }
})

registerAssertion('normal adapter rejects invalid business values without inventing roadmap data', () => {
  const adapter = loadTypeScriptModule(path.join(root, 'src/lib/roadmapProjectAdapter.ts'))
  const versions = [
    { id: 'tos-17-2', name: 'tOS 17.2', major: 17, minor: 2, targets: [], createdAt: '', updatedAt: '' },
  ]
  const validNormal = {
    id: 'normal-valid', name: 'X6877-D8400_H991', type: '整机-手机', status: '在研',
    androidVersion: 'Android 16', firstSaleTosVersionId: 'tos-17-2', projectCode: 'X6877',
    brand: 'TECNO', productLine: 'SPARK', productSeries: 'SPARK 60', marketName: 'SPARK 60',
    productType: '新品', platform: 'G100', startRam: '8GB', versionType: 'Full',
    str5Date: '2027-01-01', launchDate: '2027-02-01', developMode: '自研', remark: '',
  }
  const invalidCases = [
    ['missing product type', { productType: undefined }],
    ['invalid RAM', { startRam: '32GB', memory: '32GB+512GB' }],
    ['invalid version type', { versionType: 'Ultra' }],
    ['invalid develop mode', { developMode: '合作开发' }],
    ['invalid Android version', { androidVersion: 'Android 19', operatingSystem: 'Android 16' }],
    ['invalid brand', { brand: 'Unknown' }],
    ['unresolved first-sale tOS version', { firstSaleTosVersionId: 'missing', tosVersion: 'tOS 17.2' }],
    ['missing project code', { projectCode: null, model: null, name: null }],
  ]
  for (const [label, override] of invalidCases) {
    const row = adapter.adaptNormalProject({ ...validNormal, ...override }, versions)
    if (row !== null) throw new Error(`${label} was silently normalized: ${JSON.stringify(row)}`)
  }

  const nullable = adapter.adaptNormalProject({
    ...validNormal,
    name: null,
    marketName: null,
    productSeries: null,
    remark: null,
    projectDescription: null,
  }, versions)
  if (!nullable || nullable.displayName !== 'X6877' || nullable.marketName !== '' || nullable.productSeries !== '' || nullable.remark !== '') {
    throw new Error(`nullable text was not handled safely: ${JSON.stringify(nullable)}`)
  }

  const invalidNormal = adapter.adaptNormalProject({ ...validNormal, productType: undefined }, versions)
  const planned = roadmapRow({ id: 'planned-conflict', source: 'planned', readOnly: false })
  const groups = adapter.deriveRoadmapPlanningConflicts(invalidNormal ? [invalidNormal] : [], [planned])
  if (groups.length) throw new Error(`invalid normal data manufactured a planning conflict: ${JSON.stringify(groups)}`)
})

registerAssertion('history matches use normalized project codes and exclude only the edited planned row', () => {
  const adapter = loadTypeScriptModule(path.join(root, 'src/lib/roadmapProjectAdapter.ts'))
  const rows = [
    roadmapRow({ id: 'shared-id', source: 'normal' }),
    roadmapRow({ id: 'shared-id', source: 'planned', readOnly: false }),
    roadmapRow({ id: 'other', source: 'normal', projectCode: 'A100', displayName: 'A100' }),
  ]
  const matches = adapter.findRoadmapHistoryMatches(rows, ' x6877 ', 'shared-id')
  if (matches.length !== 1 || matches[0].source !== 'normal') {
    throw new Error(`history exclusion hid a normal project or retained the current planned row: ${JSON.stringify(matches)}`)
  }
})

registerAssertion('roadmap conflicts derive only cross-source duplicates from complete input sets', () => {
  const adapter = loadTypeScriptModule(path.join(root, 'src/lib/roadmapProjectAdapter.ts'))
  const normalRows = [
    roadmapRow({ id: 'normal-1', projectCode: ' x6877 ' }),
    roadmapRow({ id: 'normal-2', projectCode: 'X6877', firstSaleTosVersionId: 'tos-18-0' }),
    roadmapRow({ id: 'normal-2', projectCode: 'X6877', firstSaleTosVersionId: 'tos-18-0' }),
    roadmapRow({ id: 'normal-only', projectCode: 'N100', displayName: 'N100' }),
  ]
  const plannedRows = [
    roadmapRow({ id: 'planned-1', source: 'planned', readOnly: false, projectCode: 'X6877', firstSaleTosVersionId: 'tos-16-3' }),
    roadmapRow({ id: 'planned-2', source: 'planned', readOnly: false, projectCode: 'x6877', firstSaleTosVersionId: 'tos-17-2' }),
    roadmapRow({ id: 'planned-2', source: 'planned', readOnly: false, projectCode: 'x6877', firstSaleTosVersionId: 'tos-17-2' }),
    roadmapRow({ id: 'planned-only', source: 'planned', readOnly: false, projectCode: 'P100', displayName: 'P100' }),
  ]
  const groups = adapter.deriveRoadmapPlanningConflicts(normalRows, plannedRows)
  if (groups.length !== 1) throw new Error(`cross-source duplicates must form one group: ${JSON.stringify(groups)}`)
  if (groups[0].normalProjects.length !== 2) throw new Error('conflict group must retain unique normal projects only')
  if (groups[0].plannedProjects.length !== 2) throw new Error('conflict group must retain all unique planned projects across tOS versions')
  if (adapter.countConflictingPlannedProjects(groups) !== 2) throw new Error('conflict count must count unique planned projects')
  if (adapter.deriveRoadmapPlanningConflicts(normalRows, []).length) throw new Error('normal-vs-normal duplicates became conflicts')
  if (adapter.deriveRoadmapPlanningConflicts([], plannedRows).length) throw new Error('planned-vs-planned duplicates became conflicts')
  if (adapter.deriveRoadmapPlanningConflicts.length !== 2) throw new Error('conflict derivation must not accept view filter arguments')
})

registerAssertion('roadmap conflict groups sort by planned display name', () => {
  const adapter = loadTypeScriptModule(path.join(root, 'src/lib/roadmapProjectAdapter.ts'))
  const normalRows = [
    roadmapRow({ id: 'normal-b', projectCode: 'B200', displayName: 'B200' }),
    roadmapRow({ id: 'normal-a', projectCode: 'A100', displayName: 'A100' }),
  ]
  const plannedRows = [
    roadmapRow({ id: 'planned-b', source: 'planned', readOnly: false, projectCode: 'B200', displayName: 'B200' }),
    roadmapRow({ id: 'planned-a', source: 'planned', readOnly: false, projectCode: 'A100', displayName: 'A100' }),
  ]
  const groups = adapter.deriveRoadmapPlanningConflicts(normalRows, plannedRows)
  if (groups.map(group => group.plannedProjects[0].displayName).join(',') !== 'A100,B200') {
    throw new Error(`conflict group order is wrong: ${JSON.stringify(groups)}`)
  }
})

registerAssertion('every machine mock owns explicit normal-roadmap fields', () => {
  const projectPath = path.join(root, 'src/data/projects.ts')
  const source = fs.readFileSync(projectPath, 'utf8')
  const sourceFile = ts.createSourceFile(projectPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const required = ['firstSaleTosVersionId', 'projectCode', 'platform', 'startRam', 'str5Date', 'remark']
  const missing = []

  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'initialProjects' && ts.isArrayLiteralExpression(node.initializer)) {
      for (const element of node.initializer.elements) {
        if (!ts.isObjectLiteralExpression(element)) continue
        const properties = new Map(element.properties.flatMap(property => {
          if (!ts.isPropertyAssignment(property)) return []
          const name = property.name.getText(sourceFile).replaceAll("'", '')
          return [[name, property.initializer.getText(sourceFile)]]
        }))
        if (properties.get('type') !== 'PROJECT_TYPE_MACHINE_PHONE') continue
        for (const field of required) {
          if (!properties.has(field)) missing.push(`${properties.get('id') || 'unknown'}:${field}`)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  if (missing.length) throw new Error(missing.join(', '))
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
