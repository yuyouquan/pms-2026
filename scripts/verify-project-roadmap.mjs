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

const expectedMachineProjectTypes = [
  '整机-手机',
  '整机-平板',
  '整机-笔电',
  '整机-功能机',
  '整机-AIOT扩品类',
  '整机-基线项目',
  '整机-N+1项目',
  '整机-预研项目',
]
const expectedProjectCategories = ['整机产品项目', 'tOS版本项目', '技术项目', '能力建设项目']
const expectedIpmProjectClassifications = [
  ['整机产品-基线IPD', '整机产品项目', '整机-手机'],
  ['整机产品-模块化IPD', '整机产品项目', '整机-手机'],
  ['整机产品-非IPD', '整机产品项目', '整机-手机'],
  ['手机整机产品-大版本升级', '整机产品项目', '整机-手机'],
  ['其他-平板--整机产品项目', '整机产品项目', '整机-平板'],
  ['其他-笔电/移动互联及其他--整机产品项目', '整机产品项目', '整机-笔电'],
  ['其他-功能机', '整机产品项目', '整机-功能机'],
  ['其他-AIOT', '整机产品项目', '整机-AIOT扩品类'],
  ['基线项目', '整机产品项目', '整机-基线项目'],
  ['N+1项目', '整机产品项目', '整机-N+1项目'],
  ['预研类项目', '整机产品项目', '整机-预研项目'],
  ['软件产品项目', 'tOS版本项目', 'tOS版本项目'],
  ['研发级-基础研究-重点项目', '技术项目', '中长期技术'],
  ['研发级-基础研究-非重点项目', '技术项目', '中长期技术'],
  ['部门级-基础研究', '技术项目', '中长期技术'],
  ['研发级-技术研发-重点项目', '技术项目', '技术项目'],
  ['研发级-技术研发-非重点项目', '技术项目', '技术项目'],
  ['部门级-技术研发', '技术项目', '技术项目'],
  ['技术项目前置工作', '技术项目', '技术项目'],
  ['部门级能力建设', '能力建设项目', '能力建设项目'],
  ['公司级/研发级能力建设', '能力建设项目', '能力建设项目'],
]

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
      const comparesOldMachineConstant = [node.left, node.right]
        .some(operand => ts.isIdentifier(operand) && operand.text === 'PROJECT_TYPE_MACHINE')
      if (comparesOldMachineConstant) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
        failures.push(`${path.relative(root, filePath)}:${line + 1} ${node.getText(sourceFile)}`)
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return failures
}

function getInitialProjectClassificationInitializers(filePath) {
  const source = fs.readFileSync(filePath, 'utf8')
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const projectTypes = new Map()

  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'initialProjects' && ts.isArrayLiteralExpression(node.initializer)) {
      for (const element of node.initializer.elements) {
        if (!ts.isObjectLiteralExpression(element)) continue
        const idProperty = element.properties.find(property => ts.isPropertyAssignment(property) && property.name.getText(sourceFile) === 'id')
        const typeProperty = element.properties.find(property => ts.isPropertyAssignment(property) && property.name.getText(sourceFile) === 'type')
        const secondaryCategoryProperty = element.properties.find(property => (
          ts.isPropertyAssignment(property) && property.name.getText(sourceFile) === 'secondaryCategory'
        ))
        if (!idProperty || !typeProperty || !ts.isPropertyAssignment(idProperty) || !ts.isPropertyAssignment(typeProperty)) continue
        if (!ts.isStringLiteral(idProperty.initializer)) continue
        projectTypes.set(idProperty.initializer.text, {
          type: typeProperty.initializer.getText(sourceFile),
          secondaryCategory: secondaryCategoryProperty && ts.isPropertyAssignment(secondaryCategoryProperty)
            ? secondaryCategoryProperty.initializer.getText(sourceFile)
            : undefined,
        })
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

registerAssertion('RoadmapView exposes the rebuilt tOS roadmap as its only surface', () => {
  if (!roadmapAnalysis.hasTosRoadmapHeader) throw new Error('missing tOS roadmap header text')
  if (!roadmapAnalysis.hasProjectRoadmapImport) throw new Error('missing rebuilt ProjectRoadmapModule import')
  if (!roadmapAnalysis.mountsProjectRoadmapModule) throw new Error('rebuilt ProjectRoadmapModule is not mounted')
  if (roadmapAnalysis.importsSummaryBoard || roadmapAnalysis.mountsSummaryBoard) throw new Error('summary board remains reachable')
  if (roadmapAnalysis.hasProjectViewSwitcher) throw new Error('legacy project-view switcher remains')
})

registerAssertion('machine project types expose the exact supported values in order', () => {
  const projectTypes = loadTypeScriptModule(path.join(root, 'src/constants/projectTypes.ts'))
  if (JSON.stringify(projectTypes.MACHINE_PROJECT_TYPES) !== JSON.stringify(expectedMachineProjectTypes)) {
    throw new Error(`expected ${JSON.stringify(expectedMachineProjectTypes)}, got ${JSON.stringify(projectTypes.MACHINE_PROJECT_TYPES)}`)
  }
  for (const type of expectedMachineProjectTypes) {
    if (!projectTypes.isMachineProjectType(type)) throw new Error(`${type} must be recognized as a machine project`)
  }
  if (!projectTypes.isMachineProjectType('整机产品项目')) throw new Error('machine project category must be recognized')
  if ('PROJECT_TYPE_MACHINE' in projectTypes) throw new Error('legacy PROJECT_TYPE_MACHINE export must be removed')
})

registerAssertion('PROJECT_TYPES contains the four first-level project categories', () => {
  const { PROJECT_TYPES } = loadTypeScriptModule(path.join(root, 'src/constants/projectTypes.ts'))
  if (JSON.stringify(PROJECT_TYPES) !== JSON.stringify(expectedProjectCategories)) {
    throw new Error(`expected first-level project categories ${JSON.stringify(expectedProjectCategories)}, got ${JSON.stringify(PROJECT_TYPES)}`)
  }
})

registerTableAssertions('IPM project classification mapping', expectedIpmProjectClassifications.map(([
  ipmProjectCategoryName,
  projectCategory,
  secondaryCategory,
]) => [
  ipmProjectCategoryName,
  () => {
    const { mapIpmProjectClassification } = loadTypeScriptModule(path.join(root, 'src/constants/projectTypes.ts'))
    const actual = mapIpmProjectClassification(ipmProjectCategoryName)
    const expected = { projectCategory, secondaryCategory }
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
    }
  },
]))

registerAssertion('unknown IPM project classification returns undefined', () => {
  const { mapIpmProjectClassification } = loadTypeScriptModule(path.join(root, 'src/constants/projectTypes.ts'))
  if (mapIpmProjectClassification('未知分类') !== undefined) {
    throw new Error('unknown IPM project classification must return undefined')
  }
})

registerAssertion('existing machine mocks use the machine category and phone secondary category', () => {
  const classificationsById = getInitialProjectClassificationInitializers(path.join(root, 'src/data/projects.ts'))
  const expectedMachineMockIds = ['1', '3', '7', '12', '13', '14', '15', '16', '17', '18']
  const failures = expectedMachineMockIds
    .filter(id => (
      classificationsById.get(id)?.type !== 'PROJECT_CATEGORY_MACHINE'
      || classificationsById.get(id)?.secondaryCategory !== 'PROJECT_TYPE_MACHINE_PHONE'
    ))
    .map(id => `${id}:${JSON.stringify(classificationsById.get(id) || 'missing project')}`)
  if (failures.length) throw new Error(failures.join(', '))
})

registerAssertion('runtime files contain no legacy machine equality logic', () => {
  const runtimeFiles = [
    'src/data/projects.ts',
    'src/stores/project.ts',
    'src/components/workspace/WorkspaceModule.tsx',
    'src/containers/ProjectListContainer.tsx',
    'src/containers/WorkbenchContainer.tsx',
    'src/hooks/useActivateProject.ts',
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

  if (JSON.stringify(TEMPLATE_PROJECT_TYPES) !== JSON.stringify(expectedProjectCategories)) {
    throw new Error(`template project types must contain only first-level categories: ${JSON.stringify(TEMPLATE_PROJECT_TYPES)}`)
  }
  for (const [index, secondaryCategory] of expectedMachineProjectTypes.entries()) {
    const project = {
      id: `machine-${index}`,
      name: secondaryCategory,
      type: '整机产品项目',
      secondaryCategory,
      markets: ['OP', 'TR'],
    }
    const rows = generateTableData([project], [], '整机产品项目', {}, [])
    if (rows.length !== 2 || rows.map(row => row.market).join(',') !== 'OP,TR') {
      throw new Error(`${secondaryCategory} did not expand into per-market roadmap rows`)
    }
  }
})

registerAssertion('workspace machine filters expose the exact machine subtypes', () => {
  const {
    MACHINE_PROJECT_FILTER_OPTIONS,
    MACHINE_PROJECT_TYPE_FILTER,
    matchesProjectTypeFilter,
  } = loadTypeScriptModule(path.join(root, 'src/constants/projectTypes.ts'))
  const expectedFilterValues = expectedMachineProjectTypes
  const actualFilterValues = MACHINE_PROJECT_FILTER_OPTIONS?.map(option => option.value)
  if (JSON.stringify(actualFilterValues) !== JSON.stringify(expectedFilterValues)) {
    throw new Error(`expected machine filters ${JSON.stringify(expectedFilterValues)}, got ${JSON.stringify(actualFilterValues)}`)
  }
  if (MACHINE_PROJECT_TYPE_FILTER !== 'machine') throw new Error('aggregate machine filter value must remain machine')

  for (const selectedType of expectedMachineProjectTypes) {
    for (const secondaryCategory of expectedMachineProjectTypes) {
      const expected = secondaryCategory === selectedType
      if (matchesProjectTypeFilter('整机产品项目', selectedType, secondaryCategory) !== expected) {
        throw new Error(`${selectedType} must ${expected ? '' : 'not '}match ${secondaryCategory}`)
      }
    }
    if (!matchesProjectTypeFilter('整机产品项目', MACHINE_PROJECT_TYPE_FILTER, selectedType)) {
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
  const workspacePath = path.join(root, 'src/containers/ProjectListContainer.tsx')
  const toolbarStyle = getNamedObjectLiteralProperties(workspacePath, 'WORKSPACE_FILTER_TOOLBAR_STYLE')
  const chipStyle = getNamedObjectLiteralProperties(workspacePath, 'WORKSPACE_FILTER_CHIP_STYLE')
  if (toolbarStyle.get('flexWrap') !== "'wrap'") throw new Error('workspace toolbar must flex-wrap')
  if (!toolbarStyle.has('rowGap')) throw new Error('workspace toolbar must retain a stable row gap')
  if (chipStyle.get('whiteSpace') !== "'nowrap'") throw new Error('workspace filter labels must not wrap')
  if (chipStyle.get('flexShrink') !== '0') throw new Error('workspace filter chips must not shrink')
})

registerAssertion('workspace links category and supported secondary-category filters while retaining status state', () => {
  const workspacePath = path.join(root, 'src/containers/ProjectListContainer.tsx')
  const workspaceSource = fs.readFileSync(workspacePath, 'utf8')
  const projectStoreSource = fs.readFileSync(path.join(root, 'src/stores/project.ts'), 'utf8')
  const {
    matchesProjectSecondaryCategoryFilter,
  } = loadTypeScriptModule(path.join(root, 'src/constants/projectTypes.ts'))

  for (const fragment of [
    'projectSecondaryCategoryFilter, setProjectSecondaryCategoryFilter',
    'PROJECT_SECONDARY_CATEGORIES[projectTypeFilter',
    'matchesProjectTypeFilter(p.type, projectTypeFilter, p.secondaryCategory)',
    'matchesProjectSecondaryCategoryFilter(',
    'setProjectSecondaryCategoryFilter(\'all\')',
    'setProjectStatusFilter(\'all\')',
    'const categoryCounts = useMemo(() => {',
    '{categoryCounts[item.value] || 0}',
    'aria-label="项目分类筛选"',
    'aria-label="项目二级分类快捷筛选"',
    "workbenchListState.showSecondaryCategory && (",
  ]) {
    if (!workspaceSource.includes(fragment)) throw new Error(`workspace linked filter source missing: ${fragment}`)
  }
  if (workspaceSource.includes('{statusCounts[item.value] || 0}')) {
    throw new Error('workspace status filters must not display project counts')
  }
  for (const fragment of [
    'projectSecondaryCategoryFilter: string',
    'setProjectSecondaryCategoryFilter: (v: string) => void',
    "projectSecondaryCategoryFilter: 'all'",
  ]) {
    if (!projectStoreSource.includes(fragment)) throw new Error(`project store secondary filter source missing: ${fragment}`)
  }
  if (!matchesProjectSecondaryCategoryFilter('整机产品项目', '整机-手机', 'all')) {
    throw new Error('secondary category all filter must match every project')
  }
  if (!matchesProjectSecondaryCategoryFilter('整机产品项目', '整机-手机', '整机-手机')) {
    throw new Error('secondary category filter must match its exact classification')
  }
  if (matchesProjectSecondaryCategoryFilter('整机产品项目', '整机-手机', '整机-平板')) {
    throw new Error('secondary category filter must reject a different classification')
  }
})

registerAssertion('MR train labels machine subtype data as project secondary category', () => {
  const source = fs.readFileSync(path.join(root, 'src/components/roadmap/MRTrainView.tsx'), 'utf8')
  const secondaryCategoryTitles = source.match(/title:\s*'项目二级分类'/g) || []
  if (secondaryCategoryTitles.length < 2) {
    throw new Error('MR train table and export must both label projectType as 项目二级分类')
  }
  if (/title:\s*'项目分类'[\s\S]{0,100}dataIndex:\s*'projectType'/.test(source)) {
    throw new Error('MR train projectType column must not claim to contain first-level project category data')
  }
  if (/\{\s*key:\s*'projectType',\s*title:\s*'项目分类'\s*\}/.test(source)) {
    throw new Error('MR train projectType export must not claim to contain first-level project category data')
  }
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
  if (validation.normalizeTosVersionName('tOS 17.2.0') !== null) throw new Error('maintained tOS version must contain only major and minor')
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
    firstSaleTosVersionId: '17.2',
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
  const validTosIds = new Set(['17.2'])
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
  firstSaleTosVersionId: '17.2',
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
const validRoadmapTosIds = new Set(['17.2'])

registerTableAssertions('planned-project runtime enum validation', [
  ['machine project type', 'machineProjectType', '整机-电视'],
  ['first-level project category', 'machineProjectType', '整机产品项目'],
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
  if (field === 'machineProjectType' && errors.machineProjectType !== '项目二级分类无效') {
    throw new Error(`machine project type error copy is wrong: ${JSON.stringify(errors)}`)
  }
  if (!errors[field]) throw new Error(`${field} malformed runtime value was accepted`)
}]))

registerAssertion('roadmap persistence migrates the envelope once and current-state sanitization is idempotent', () => {
  const store = loadIsolatedRoadmapStore()
  const currentState = {
    ...store.createInitialRoadmapState(),
    viewMode: 'evolution',
    visibleColumns: ['marketName', 'displayName', 'remark'],
    visibleColumnsByView: {
      table: ['firstSaleTosVersionId', 'displayName'],
      evolution: ['marketName', 'displayName', 'remark'],
    },
    columnOrderByView: {
      table: ['firstSaleTosVersionId', 'displayName'],
      evolution: ['marketName', 'displayName', 'remark'],
    },
  }
  const hydrated = hydrateRoadmapStoreFromEnvelope({
    version: store.ROADMAP_STORE_VERSION,
    state: store.partializeRoadmapState(currentState),
  })
  const expected = ['marketName', 'displayName', 'remark']
  if (JSON.stringify(hydrated.visibleColumnsByView.evolution) !== JSON.stringify(expected)) {
    throw new Error(`current custom evolution columns replayed a legacy upgrade: ${JSON.stringify(hydrated.visibleColumnsByView.evolution)}`)
  }
  const legacy = store.migrateRoadmapState(store.partializeRoadmapState(currentState), 1)
  if (JSON.stringify(legacy.visibleColumnsByView.evolution) === JSON.stringify(expected) || !legacy.visibleColumnsByView.evolution.includes('developMode')) {
    throw new Error('legacy version 1 no longer receives the evolution-column upgrades')
  }
  const once = store.sanitizeRoadmapCurrentState(store.partializeRoadmapState(currentState))
  const twice = store.sanitizeRoadmapCurrentState(once)
  if (JSON.stringify(once) !== JSON.stringify(twice)) throw new Error('current-state sanitizer is not idempotent')
})

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
  const renamedAcrossProductTypes = audit.diffRoadmapProjectFields(
    { ...before, projectCode: 'CN6', productType: '新品', androidVersion: 'Android 16' },
    { ...after, projectCode: 'CN7', productType: '老品', androidVersion: 'Android 17' },
    versions,
  ).find(change => change.field === 'projectCode')
  if (renamedAcrossProductTypes?.before !== 'CN6' || renamedAcrossProductTypes?.after !== 'CN7(Android 17)') {
    throw new Error(`project-name audit values are not canonical: ${JSON.stringify(renamedAcrossProductTypes)}`)
  }

  const snapshot = audit.createRoadmapAuditSnapshot(after, versions)
  if (Object.keys(snapshot).join(',') !== expectedFields) throw new Error(`audit snapshot order is wrong: ${Object.keys(snapshot).join(',')}`)
  if (snapshot.firstSaleTosVersionId !== 'tOS 18.0' || snapshot.brand !== 'Infinix' || snapshot.remark !== 'updated') {
    throw new Error(`audit snapshot content is wrong: ${JSON.stringify(snapshot)}`)
  }
  if ('androidVersion' in snapshot || 'productSeries' in snapshot) throw new Error('audit snapshot contains excluded fields')
})

registerAssertion('roadmap STR5 estimate and canonical project-name contracts stay end to end', () => {
  const modalSource = fs.readFileSync(path.join(root, 'src/components/roadmap/PlannedProjectModal.tsx'), 'utf8')
  const tableSource = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapTableView.tsx'), 'utf8')
  const cardSource = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapProjectCard.tsx'), 'utf8')
  const conflictSource = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapConflictDrawer.tsx'), 'utf8')
  const projectStoreSource = fs.readFileSync(path.join(root, 'src/stores/project.ts'), 'utf8')
  const roadmapStoreSource = fs.readFileSync(path.join(root, 'src/stores/roadmap.ts'), 'utf8')

  for (const contract of [
    'Checkbox',
    'name="str5Estimated"',
    'valuePropName="checked"',
    'str5Estimated: editingProject.str5Estimated === true',
    'str5Estimated: false',
  ]) {
    if (!modalSource.includes(contract)) throw new Error(`planned-project modal is missing ${contract}`)
  }
  if (!tableSource.includes('row.str5Estimated')
    || !tableSource.includes('ClockCircleOutlined')
    || !tableSource.includes('title="预估时间"')
    || tableSource.includes('>预估</Tag>')) {
    throw new Error('table does not render the compact estimated-time icon')
  }
  if (!cardSource.includes('row.str5Estimated')
    || !cardSource.includes('ClockCircleOutlined')
    || !cardSource.includes('title="预估时间"')
    || cardSource.includes('>预估</Tag>')) {
    throw new Error('evolution card does not render the compact estimated-time icon')
  }
  for (const [sourceName, source] of [['table', tableSource], ['card', cardSource]]) {
    if (!source.includes('wrap={false}')) throw new Error(`${sourceName} may wrap the STR5 estimate marker`)
  }
  if (conflictSource.includes('{project.displayName}')) {
    throw new Error('conflict drawer trusts a potentially stale displayName')
  }
  for (const [sourceName, source] of [['normal project audit', projectStoreSource], ['planned project audit', roadmapStoreSource]]) {
    if (!source.includes('buildRoadmapDisplayName(')) throw new Error(`${sourceName} does not build canonical project names`)
    if (source.includes('projectDisplayName: afterRow.displayName')
      || source.includes('projectDisplayName: auditRow.displayName')
      || source.includes('projectDisplayName: project.displayName')
      || source.includes('projectDisplayName: updated.displayName')) {
      throw new Error(`${sourceName} still trusts a potentially stale displayName`)
    }
  }
  const audit = loadTypeScriptModule(path.join(root, 'src/lib/roadmapAudit.ts'))
  if (audit.ROADMAP_AUDIT_FIELDS.includes('str5Estimated')) {
    throw new Error('STR5 estimate must stay outside the audit whitelist')
  }
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
  for (const token of ['persist(', "name: 'pms-project-roadmap'", 'ROADMAP_STORE_VERSION = 6', 'version: ROADMAP_STORE_VERSION', 'migrate:', 'partialize:']) {
    if (!source.includes(token)) throw new Error(`Roadmap store is missing ${token}`)
  }
  const mergeBody = source.slice(source.indexOf('export function mergeRoadmapPersistedState'), source.indexOf('const safeRoadmapStorage'))
  if (mergeBody.includes('migrateRoadmapState(') || mergeBody.includes('fromVersion')) {
    throw new Error('current-state merge must sanitize without replaying version upgrades')
  }
  if (/from ['"]@\/stores\/project['"]/.test(source)) throw new Error('roadmap store must not import the project store')
  if (/normalProjects\s*:/.test(source)) throw new Error('normal projects must not be copied into roadmap state')
})

registerAssertion('initial roadmap state has exact semantic-descending versions and UI defaults', () => {
  const store = loadIsolatedRoadmapStore()
  const versions = store.createInitialTosVersions()
  const expected = [
    ['18.0', 'tOS18.0'],
    ['17.2', 'tOS17.2'],
    ['17.1', 'tOS17.1'],
    ['17.0', 'tOS17.0'],
    ['16.3', 'tOS16.3'],
    ['16.2', 'tOS16.2'],
    ['16.1', 'tOS16.1'],
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
    || initial.selectedTosVersionId !== null
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
  if (state.changeLogs[0]?.action !== 'create' || state.changeLogs[0]?.snapshot?.firstSaleTosVersionId !== 'tOS17.2') {
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

registerAssertion('roadmap store has no independent tOS option CRUD', () => {
  const storeModule = loadIsolatedRoadmapStore()
  const state = resetRoadmapStore(storeModule).getState()
  for (const action of ['createTosVersion', 'renameTosVersion', 'deleteTosVersion']) {
    if (action in state) throw new Error(`roadmap store still exposes ${action}`)
  }
  const source = fs.readFileSync(roadmapStorePath, 'utf8')
  for (const declaration of ['createTosVersion:', 'renameTosVersion:', 'deleteTosVersion:']) {
    if (source.includes(declaration)) throw new Error(`roadmap store still implements ${declaration}`)
  }
})

registerAssertion('roadmap setters sanitize columns and persistence excludes transient conflict state', () => {
  const storeModule = loadIsolatedRoadmapStore()
  const store = resetRoadmapStore(storeModule)
  store.getState().setVisibleColumns(['unknown', 'brand', 'brand'])
  if (JSON.stringify(store.getState().visibleColumns) !== JSON.stringify(['firstSaleTosVersionId', 'brand'])) {
    throw new Error('known visible columns or fixed table prefix were not sanitized')
  }
  store.getState().setVisibleColumns([])
  if (store.getState().visibleColumns.length < 1) throw new Error('at least one business field must remain visible')
  store.getState().setSelectedConflictKey('X6877|Android 16|新品')
  const persisted = storeModule.partializeRoadmapState(store.getState())
  const expectedKeys = ['plannedProjects', 'tosVersions', 'changeLogs', 'viewMode', 'selectedTosVersionId', 'brandFilter', 'productTypeFilter', 'filters', 'columnOrder', 'columnOrderByView', 'visibleColumns', 'visibleColumnsByView', 'sort']
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
  if (migrated.tosVersions.map(version => version.name).join(',') !== 'tOS18.0,tOS17.2') throw new Error('versions were not normalized/sorted')
  if (migrated.tosVersions[1].id !== '17.2' || JSON.stringify(migrated.tosVersions[1].targets) !== JSON.stringify(['first', 'second'])) {
    throw new Error('missing stable ID or targets were not repaired')
  }
  const planned = migrated.plannedProjects[0]
  if (!planned || planned.firstSaleTosVersionId !== '17.2' || planned.displayName !== 'X6877(Android 16)' || planned.status !== '待规划') {
    throw new Error(`legacy planned project was not repaired: ${JSON.stringify(planned)}`)
  }
  if (!Number.isFinite(Date.parse(planned.createdAt)) || !Number.isFinite(Date.parse(planned.updatedAt))) throw new Error('timestamps were not normalized')
  if (
    migrated.filters.length !== 2
    || JSON.stringify(migrated.filters.find(condition => condition.field === 'brand')?.value) !== JSON.stringify(['TECNO'])
    || JSON.stringify(migrated.filters.find(condition => condition.field === 'productType')?.value) !== JSON.stringify(['老品'])
    || JSON.stringify(migrated.visibleColumns) !== JSON.stringify([
      'marketName', 'displayName', 'platform', 'startRam', 'versionType', 'str5Date', 'launchDate', 'developMode',
    ])
  ) throw new Error(`filters/columns were not sanitized or synchronized: ${JSON.stringify({
    filters: migrated.filters,
    visibleColumns: migrated.visibleColumns,
  })}`)
  if (migrated.selectedTosVersionId !== null || migrated.changeLogs.length !== 1 || 'conflictGroups' in migrated) {
    throw new Error('selection/log/conflict migration is wrong')
  }
})

registerAssertion('roadmap migration and malformed persisted JSON safely fall back', () => {
  const store = loadIsolatedRoadmapStore()
  const fallback = store.migrateRoadmapState(null, 0)
  if (fallback.tosVersions[0]?.id !== '18.0' || fallback.plannedProjects.length) throw new Error('unusable shape did not fall back')

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
    if (state.tosVersions[0]?.id !== '18.0' || state.plannedProjects.length) throw new Error('malformed JSON did not hydrate initial state')
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

registerAssertion('empty migrated tOS catalogs preserve a normalized saved orphan selection', () => {
  const store = loadIsolatedRoadmapStore()
  const migrated = store.migrateRoadmapState({
    tosVersions: [],
    plannedProjects: [],
    changeLogs: [],
    selectedTosVersionId: 'tos-18-0',
  }, 0)
  if (migrated.tosVersions.length || migrated.selectedTosVersionId !== '18.0') {
    throw new Error(`empty catalog selection must preserve the saved orphan: ${JSON.stringify(migrated.selectedTosVersionId)}`)
  }
})

registerAssertion('roadmap metadata cannot delete the enum-owned last option', () => {
  const storeModule = loadIsolatedRoadmapStore()
  const store = resetRoadmapStore(storeModule)
  const before = store.getState().tosVersions.map(version => version.id)
  if ('deleteTosVersion' in store.getState()) throw new Error('roadmap metadata regained enum deletion authority')
  if (JSON.stringify(store.getState().tosVersions.map(version => version.id)) !== JSON.stringify(before)) {
    throw new Error('reading enum-owned options mutated compatibility metadata')
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
    || !hydrated.visibleColumns.includes('firstSaleTosVersionId')
    || hydrated.visibleColumns[0] === 'unknown'
    || hydrated.columnOrder[0] !== 'firstSaleTosVersionId'
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

registerTableAssertions('roadmap hydration normalizes every legacy planned machine subtype', [
  ['machine category', '整机产品项目', '整机-手机'],
  ['legacy phone', '整机产品-手机', '整机-手机'],
  ['legacy current PAD', '整机-PAD', '整机-平板'],
  ['legacy PAD', '整机产品-PAD', '整机-平板'],
  ['legacy laptop', '整机产品-笔电', '整机-笔电'],
  ['legacy AIOT', '整机-AIOT', '整机-AIOT扩品类'],
  ['legacy baseline', '整机-基线', '整机-基线项目'],
  ['legacy N+1', '整机-N+1', '整机-N+1项目'],
  ['legacy pre-research', '整机-预研', '整机-预研项目'],
].map(([caseName, legacyValue, expectedValue], index) => [caseName, () => {
  const hydrated = hydrateRoadmapStoreFromEnvelope({
    version: 5,
    state: {
      tosVersions: [{
        id: 'tos-17-2',
        name: 'tOS 17.2',
        major: 17,
        minor: 2,
        periodStartDate: '',
        periodEndDate: '',
        targets: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }],
      plannedProjects: [
        persistedPlannedProject(`LEGACY-${index + 1}`, { machineProjectType: legacyValue }),
      ],
      changeLogs: [],
      selectedTosVersionId: null,
    },
  })
  const hydratedLegacyProject = hydrated.plannedProjects.find(
    project => project.projectCode === `LEGACY-${index + 1}`,
  )
  if (hydratedLegacyProject?.machineProjectType !== expectedValue) {
    throw new Error(`legacy planned subtype was not hydrated: ${JSON.stringify(hydrated.plannedProjects)}`)
  }
}]))

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
  if (migrated.selectedTosVersionId !== null) {
    throw new Error('sanitizer did not repair an invalid selected version to all')
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

registerAssertion('tOS selection actions accept only current enum values', () => {
  const storeModule = loadIsolatedRoadmapStore()
  const store = resetRoadmapStore(storeModule)
  store.getState().setSelectedTosVersionId('missing')
  if (store.getState().selectedTosVersionId !== null) throw new Error('setter accepted an unknown tOS ID')
  store.getState().setSelectedTosVersionId(null)
  if (store.getState().selectedTosVersionId !== null) throw new Error('setter did not preserve all')

  const nullPersistedState = {
    ...storeModule.partializeRoadmapState(store.getState()),
    selectedTosVersionId: null,
  }
  const nullRoundTrip = storeModule.migrateRoadmapState(nullPersistedState, 1)
  if (nullRoundTrip.selectedTosVersionId !== null) throw new Error('migration did not preserve all for a non-empty catalog')
  const hydrated = hydrateRoadmapStoreFromEnvelope({ state: nullPersistedState, version: 1 })
  if (hydrated.selectedTosVersionId !== null) throw new Error('merge did not preserve all for a non-empty catalog')
  store.getState().setSelectedTosVersionId('17.2')
  if (store.getState().selectedTosVersionId !== '17.2') throw new Error('current two-part enum value was rejected')
  store.getState().setSelectedTosVersionId('tos-17-2')
  if (store.getState().selectedTosVersionId !== '17.2') throw new Error('legacy ID unexpectedly replaced current selection')
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
    androidVersion: 'Android 16', firstSaleTosVersionId: 'tos-17-2', currentTosVersionId: 'tos-16-3', tosVersion: 'tOS16.3',
    projectCode: ' X6877 ', model: 'legacy-code', brand: 'TECNO', productLine: 'SPARK', productSeries: 'SPARK 60', marketName: 'SPARK 60',
    productType: '升级', platform: 'explicit-platform', cpu: 'legacy-cpu', startRam: '8GB', memory: '6GB+128GB', versionType: 'Full',
    str5Date: '2027-01-01', launchDate: '2027-02-01', developMode: '外研', remark: 'explicit remark', projectDescription: 'legacy remark',
  }, versions)
  if (!normal) throw new Error('machine project was excluded')
  if (
    normal.source !== 'normal'
    || !normal.readOnly
    || normal.projectCode !== 'X6877'
    || normal.displayName !== 'X6877(Android 16)'
    || normal.firstSaleTosVersionId !== '16.3'
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
    currentTosVersionId: undefined,
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
    || switched.firstSaleTosVersionId !== '16.3'
    || switched.startRam !== '6GB'
    || switched.productType !== '老品'
    || switched.developMode !== 'ITD-ODC'
    || switched.remark !== 'legacy description'
  ) throw new Error(`legacy fallback mapping is wrong: ${JSON.stringify(switched)}`)
  if (adapter.adaptNormalProject({ ...normal, type: '技术项目' }, versions) !== null) {
    throw new Error('non-machine project entered the normal roadmap')
  }
  const categorized = adapter.adaptNormalProject({
    ...normal,
    id: 'normal-categorized',
    type: '整机产品项目',
    secondaryCategory: '整机-笔电',
    currentTosVersionId: 'tos-16-3',
  }, versions)
  if (!categorized || categorized.machineProjectType !== '整机-笔电') {
    throw new Error(`normal adapter did not prefer the project secondary category: ${JSON.stringify(categorized)}`)
  }
  if (adapter.adaptNormalProject({
    ...normal,
    id: 'normal-category-only',
    type: '整机产品项目',
    secondaryCategory: undefined,
    currentTosVersionId: 'tos-16-3',
  }, versions)?.machineProjectType !== '整机-手机') {
    throw new Error('normal adapter did not apply the default phone secondary category')
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
    [{ ...normal, type: '技术项目' }, {
      ...normal,
      id: 'normal-merge',
      type: '整机-手机',
      currentTosVersionId: normal.firstSaleTosVersionId,
    }],
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
    ['missing project code', { projectCode: null, model: null, name: null }],
  ]
  for (const [label, override] of invalidCases) {
    const row = adapter.adaptNormalProject({ ...validNormal, ...override }, versions)
    if (row !== null) throw new Error(`${label} was silently normalized: ${JSON.stringify(row)}`)
  }
  const historicalUnknown = adapter.adaptNormalProject({
    ...validNormal,
    firstSaleTosVersionId: 'missing',
    tosVersion: 'tOS 17.2',
  }, versions)
  if (historicalUnknown?.firstSaleTosVersionId !== 'missing') {
    throw new Error(`unknown historical tOS text was not preserved: ${JSON.stringify(historicalUnknown)}`)
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
  let matchedMachineMocks = 0

  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'initialProjects' && ts.isArrayLiteralExpression(node.initializer)) {
      for (const element of node.initializer.elements) {
        if (!ts.isObjectLiteralExpression(element)) continue
        const properties = new Map(element.properties.flatMap(property => {
          if (!ts.isPropertyAssignment(property)) return []
          const name = property.name.getText(sourceFile).replaceAll("'", '')
          return [[name, property.initializer.getText(sourceFile)]]
        }))
        if (properties.get('type') !== 'PROJECT_CATEGORY_MACHINE') continue
        matchedMachineMocks += 1
        if (properties.get('secondaryCategory') !== 'PROJECT_TYPE_MACHINE_PHONE') {
          missing.push(`${properties.get('id') || 'unknown'}:secondaryCategory`)
        }
        for (const field of required) {
          if (!properties.has(field)) missing.push(`${properties.get('id') || 'unknown'}:${field}`)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  if (matchedMachineMocks === 0) throw new Error('machine mock scan matched zero first-level machine projects')
  if (missing.length) throw new Error(missing.join(', '))
})

registerAssertion('normal project writes expose one shared audited action boundary', () => {
  const projectStoreSource = fs.readFileSync(path.join(root, 'src/stores/project.ts'), 'utf8')
  for (const action of ['addProject:', 'updateProject:', 'deleteProject:']) {
    if (!projectStoreSource.includes(action)) throw new Error(`ProjectActions is missing ${action}`)
  }
  if (!projectStoreSource.includes('recordNormalProjectChange')) {
    throw new Error('project store does not route normal-project audit records through roadmap store')
  }

  const projectSpaceSource = fs.readFileSync(path.join(root, 'src/containers/ProjectSpaceContainer.tsx'), 'utf8')
  if (projectSpaceSource.includes('setProjects(')) {
    throw new Error('project-space saves still replace the project array directly')
  }
  if (!projectSpaceSource.includes('updateProject(selectedProject.id')) {
    throw new Error('project-space saves do not use the shared updateProject action')
  }
  if (!projectSpaceSource.includes('整机项目的路标必填信息不完整或取值不合法，无法保存')) {
    throw new Error('project-space invalid machine updates do not explain the roadmap validation failure')
  }
})

registerAssertion('normal machine creation requires the current three-part enum and maps roadmap fields', () => {
  const addModalSource = fs.readFileSync(path.join(root, 'src/components/workspace/AddProjectModal.tsx'), 'utf8')
  if (addModalSource.includes('destroyOnClose')) throw new Error('AddProjectModal still uses deprecated destroyOnClose')
  for (const fragment of [
    'firstSaleTosVersionId',
    '请选择首销 tOS 版本',
    'isMachineProjectType',
    "useTosEnumOptions('tos-3-part'",
    'allowedFirstSaleTosValues',
    'projectCode',
    'platform',
    'productType',
    'startRam',
    'versionType',
    'str5Date',
    'launchDate',
    'developMode',
    'remark',
    'adaptNormalProject',
    '外部项目缺少或不符合路标字段',
  ]) {
    if (!addModalSource.includes(fragment)) throw new Error(`AddProjectModal is missing ${fragment}`)
  }
  if (addModalSource.includes('useRoadmapStore') || addModalSource.includes('state.tosVersions')) {
    throw new Error('AddProjectModal still derives whole-machine choices from roadmap metadata')
  }

  const externalSource = fs.readFileSync(path.join(root, 'src/data/externalProjectPool.ts'), 'utf8')
  for (const field of ['projectCode', 'platform', 'productType', 'startRam', 'versionType', 'str5Date', 'launchDate', 'developMode', 'remark']) {
    if (!externalSource.includes(`${field}?:`)) throw new Error(`external project mapping is missing ${field}`)
  }
})

registerAssertion('global roadmap permissions combine all global roles and preserve admin bypass', () => {
  const permissionSource = fs.readFileSync(path.join(root, 'src/stores/permission.ts'), 'utf8')
  if (!permissionSource.includes('export function hasGlobalPermission')) throw new Error('missing hasGlobalPermission')
  if (!permissionSource.includes('export function useHasGlobalPermission')) throw new Error('missing useHasGlobalPermission')
  const moduleCache = new Map([[
    path.join(root, 'src/data/projects.ts'),
    { exports: { initialProjects: [] } },
  ]])
  const loader = createTypeScriptModuleLoader(moduleCache)
  const permissionModule = loader(path.join(root, 'src/stores/permission.ts'))
  if (typeof permissionModule.hasGlobalPermission !== 'function') throw new Error('missing hasGlobalPermission')
  if (typeof permissionModule.useHasGlobalPermission !== 'function') throw new Error('missing useHasGlobalPermission')

  const permissionStore = permissionModule.usePermissionStore
  const original = permissionStore.getState()
  try {
    permissionStore.setState({
      globalRoles: [
        { name: '管理组', members: ['管理员'] },
        { name: '只看', members: ['多角色用户'] },
        { name: '可编辑', members: ['多角色用户'] },
      ],
      globalRolePerms: {
        管理组: {},
        只看: { 'roadmap:view': true },
        可编辑: { 'roadmap:edit': true },
      },
    })
    if (!permissionModule.hasGlobalPermission('管理员', '任意权限')) throw new Error('management group lost global bypass')
    if (!permissionModule.hasGlobalPermission('多角色用户', 'roadmap:view')) throw new Error('first global role permission was ignored')
    if (!permissionModule.hasGlobalPermission('多角色用户', 'roadmap:edit')) throw new Error('second global role permission was ignored')
    if (permissionModule.hasGlobalPermission('陌生用户', 'roadmap:view')) throw new Error('unassigned user gained a global permission')
  } finally {
    permissionStore.setState({
      globalRoles: original.globalRoles,
      globalRolePerms: original.globalRolePerms,
    })
  }
})

registerAssertion('shared project actions audit only legal normal machine snapshots once', () => {
  const projectSource = fs.readFileSync(path.join(root, 'src/stores/project.ts'), 'utf8')
  if (!projectSource.includes('updateProject:') || !projectSource.includes('deleteProject:')) {
    throw new Error('project store audited actions are not implemented')
  }
  const moduleCache = new Map([[
    path.join(root, 'src/data/projects.ts'),
    { exports: { initialProjects: [] } },
  ]])
  const loader = createTypeScriptModuleLoader(moduleCache)
  const projectModule = loader(path.join(root, 'src/stores/project.ts'))
  const roadmapModule = loader(path.join(root, 'src/stores/roadmap.ts'))
  const projectStore = projectModule.useProjectStore
  const roadmapStore = roadmapModule.useRoadmapStore
  const initialRoadmap = roadmapModule.createInitialRoadmapState()
  roadmapStore.setState(initialRoadmap)
  projectStore.setState({
    projects: [],
    selectedProject: null,
    currentLoginUser: '默认操作人',
  })

  const validMachine = {
    id: 'normal-audit-1', name: 'X9000', type: '整机-手机', status: '待立项', progress: 0,
    leader: '张三', markets: [], androidVersion: 'Android 18', chipPlatform: 'G200', spm: '张三',
    updatedAt: '刚刚', productLine: 'SPARK', tosVersion: 'tOS 18.0', planStartDate: '', planEndDate: '',
    developCycle: 0, healthStatus: 'normal', firstSaleTosVersionId: '18.0.0', projectCode: 'X9000',
    brand: 'TECNO', productSeries: 'SPARK 80', marketName: 'SPARK 80', productType: '新品', platform: 'G200',
    startRam: '8GB', versionType: 'Full', str5Date: '2027-01-01', launchDate: '2027-02-01',
    developMode: '自研', remark: '',
  }

  const validCreateResult = projectStore.getState().addProject(validMachine, '创建人', {
    allowedFirstSaleTosValues: ['18.0.0'],
  })
  let logs = roadmapStore.getState().changeLogs
  if (validCreateResult !== true || logs.length !== 1 || logs[0].action !== 'create' || logs[0].actor !== '创建人' || !logs[0].snapshot) {
    throw new Error(`valid machine create did not emit one snapshot log: ${JSON.stringify(logs)}`)
  }

  const externalModule = loader(path.join(root, 'src/data/externalProjectPool.ts'))
  const externalWithoutRoadmapFields = externalModule.fetchByBid('EXT-006')
  const invalidExternalMachine = {
    ...validMachine,
    id: 'normal-invalid-external',
    name: 'AI-Engine-V3',
    brand: externalWithoutRoadmapFields.brand,
    productType: externalWithoutRoadmapFields.productType,
    startRam: externalWithoutRoadmapFields.startRam,
    versionType: externalWithoutRoadmapFields.versionType,
    developMode: externalWithoutRoadmapFields.developMode,
  }
  const invalidCreateResult = projectStore.getState().addProject(invalidExternalMachine, '创建人')
  if (
    invalidCreateResult !== false
    || projectStore.getState().projects.some(project => project.id === invalidExternalMachine.id)
    || roadmapStore.getState().changeLogs.length !== 1
  ) {
    throw new Error('invalid external machine project was written without a roadmap row or audit log')
  }

  projectStore.setState({ selectedProject: validMachine })
  const updated = projectStore.getState().updateProject(validMachine.id, { brand: 'Infinix' }, '修改人')
  logs = roadmapStore.getState().changeLogs
  if (!updated || updated.brand !== 'Infinix' || projectStore.getState().selectedProject?.brand !== 'Infinix') {
    throw new Error('updateProject did not update both canonical and selected project state')
  }
  if (logs.length !== 2 || logs[0].action !== 'update' || logs[0].changes.length !== 1 || logs[0].changes[0].field !== 'brand') {
    throw new Error(`valid machine update did not emit exactly one diff log: ${JSON.stringify(logs)}`)
  }

  projectStore.getState().updateProject(validMachine.id, { progress: 50 }, '修改人')
  if (roadmapStore.getState().changeLogs.length !== 2) throw new Error('non-roadmap update emitted an empty audit log')

  const rejectedUpdate = projectStore.getState().updateProject(validMachine.id, { productType: '未知' }, '修改人')
  const projectAfterRejectedUpdate = projectStore.getState().projects.find(project => project.id === validMachine.id)
  if (rejectedUpdate !== null || projectAfterRejectedUpdate?.productType !== '新品' || roadmapStore.getState().changeLogs.length !== 2) {
    throw new Error('invalid machine update mutated canonical state or emitted an audit log')
  }

  const deleted = projectStore.getState().deleteProject(validMachine.id, '删除人')
  logs = roadmapStore.getState().changeLogs
  if (!deleted || projectStore.getState().projects.length || projectStore.getState().selectedProject !== null) {
    throw new Error('deleteProject did not remove and deselect the project')
  }
  if (logs.length !== 3 || logs[0].action !== 'delete') {
    throw new Error('valid machine state was not preserved for audited deletion')
  }

  const validDelete = { ...validMachine, id: 'normal-audit-delete' }
  if (projectStore.getState().addProject(validDelete, undefined, { allowedFirstSaleTosValues: ['18.0.0'] }) !== true) {
    throw new Error('valid delete fixture was rejected')
  }
  projectStore.getState().deleteProject(validDelete.id, '删除人')
  logs = roadmapStore.getState().changeLogs
  if (logs[0].action !== 'delete' || logs[0].actor !== '删除人' || !logs[0].snapshot) {
    throw new Error(`valid machine delete did not emit a snapshot log: ${JSON.stringify(logs[0])}`)
  }

  const nonMachine = { ...validMachine, id: 'normal-tech', type: '技术项目' }
  const beforeNonMachine = roadmapStore.getState().changeLogs.length
  if (projectStore.getState().addProject(nonMachine, '张三') !== true) throw new Error('non-machine create compatibility changed')
  projectStore.getState().updateProject(nonMachine.id, { projectDescription: '不应审计' }, '张三')
  projectStore.getState().deleteProject(nonMachine.id, '张三')
  if (roadmapStore.getState().changeLogs.length !== beforeNonMachine) throw new Error('non-machine writes emitted roadmap audit logs')
  if (projectStore.getState().updateProject('missing', {}, '张三') !== null) throw new Error('missing update must return null')
  if (projectStore.getState().deleteProject('missing', '张三') !== false) throw new Error('missing delete must return false')
})

registerAssertion('whole-machine project mutations require current hydrated three-part values without clearing history', () => {
  const previousWindow = globalThis.window
  const storage = new Map()
  globalThis.window = {
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
  }
  try {
  const moduleCache = new Map([[
    path.join(root, 'src/data/projects.ts'),
    { exports: { initialProjects: [] } },
  ]])
  const loader = createTypeScriptModuleLoader(moduleCache)
  const projectModule = loader(path.join(root, 'src/stores/project.ts'))
  const roadmapModule = loader(path.join(root, 'src/stores/roadmap.ts'))
  const enumModule = loader(path.join(root, 'src/stores/enums.ts'))
  const projectStore = projectModule.useProjectStore
  const enumStore = enumModule.useEnumStore
  projectStore.setState({ projects: [], selectedProject: null, currentLoginUser: '张三' })
  roadmapModule.useRoadmapStore.setState(roadmapModule.createInitialRoadmapState())

  const machine = {
    id: 'enum-boundary-1', name: 'X9100', type: '整机-手机', status: '待立项', progress: 0,
    leader: '张三', markets: [], androidVersion: 'Android 18', chipPlatform: 'G200', spm: '张三',
    updatedAt: '刚刚', productLine: 'SPARK', planStartDate: '', planEndDate: '', developCycle: 0,
    healthStatus: 'normal', firstSaleTosVersionId: '18.0.0', projectCode: 'X9100', brand: 'TECNO',
    productSeries: 'SPARK 90', marketName: 'SPARK 90', productType: '新品', platform: 'G200',
    startRam: '8GB', versionType: 'Full', str5Date: '2027-03-01', launchDate: '2027-04-01',
    developMode: '自研', remark: '',
  }

  enumStore.setState({ hasHydrated: false, hydrationError: null, valuesByType: { 'tos-2-part': ['18.0'], 'tos-3-part': ['18.0.0'] } })
  if (projectStore.getState().addProject(machine, '创建人') !== false) {
    throw new Error('unhydrated enum defaults were trusted for a new whole-machine project')
  }
  if (!projectStore.getState().addProject(machine, '创建人', { allowedFirstSaleTosValues: ['18.0.0'] })) {
    throw new Error('explicit current three-part allow-list was ignored')
  }

  enumStore.setState({ hasHydrated: true, hydrationError: null, valuesByType: { 'tos-2-part': ['18.0'], 'tos-3-part': [] } })
  const historicalUpdate = projectStore.getState().updateProject(machine.id, { brand: 'Infinix' }, '修改人')
  if (!historicalUpdate || historicalUpdate.firstSaleTosVersionId !== '18.0.0') {
    throw new Error('deleting an enum option made an unchanged historical project value unsavable')
  }
  const replacedWithDeleted = projectStore.getState().updateProject(machine.id, { firstSaleTosVersionId: '18.1.0' }, '修改人')
  if (replacedWithDeleted !== null || projectStore.getState().projects[0]?.firstSaleTosVersionId !== '18.0.0') {
    throw new Error('a deleted or unknown three-part value was accepted as a new selection')
  }

  const second = { ...machine, id: 'enum-boundary-2', name: 'X9200', projectCode: 'X9200' }
  if (projectStore.getState().addProject(second, '创建人') !== false) {
    throw new Error('a deleted historical value remained selectable for new projects')
  }
  enumStore.setState({ valuesByType: { 'tos-2-part': ['18.0'], 'tos-3-part': ['18.0.0'] } })
  if (!projectStore.getState().addProject(second, '创建人')) {
    throw new Error('a same-session current three-part enum addition was not visible to project validation')
  }
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
})

registerAssertion('machine addProject rejects invalid data before canonical state mutation', () => {
  const moduleCache = new Map([[
    path.join(root, 'src/data/projects.ts'),
    { exports: { initialProjects: [] } },
  ]])
  const loader = createTypeScriptModuleLoader(moduleCache)
  const projectModule = loader(path.join(root, 'src/stores/project.ts'))
  const roadmapModule = loader(path.join(root, 'src/stores/roadmap.ts'))
  const projectStore = projectModule.useProjectStore
  const roadmapStore = roadmapModule.useRoadmapStore
  projectStore.setState({ projects: [], selectedProject: null, currentLoginUser: '张三' })
  roadmapStore.setState(roadmapModule.createInitialRoadmapState())

  const result = projectStore.getState().addProject({
    id: 'invalid-machine-boundary',
    name: 'AI-Engine-V3',
    type: '整机-手机',
    firstSaleTosVersionId: 'tos-18-0',
  }, '张三')
  if (result !== false || projectStore.getState().projects.length || roadmapStore.getState().changeLogs.length) {
    throw new Error('invalid machine escaped the final addProject boundary')
  }
})

registerAssertion('normal projects and their audit logs survive the same reload lifecycle', () => {
  const previousWindow = globalThis.window
  const storage = new Map()
  globalThis.window = {
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
  }

  const loadStores = () => {
    const moduleCache = new Map([[
      path.join(root, 'src/data/projects.ts'),
      { exports: { initialProjects: [] } },
    ]])
    const loader = createTypeScriptModuleLoader(moduleCache)
    const projectModule = loader(path.join(root, 'src/stores/project.ts'))
    const roadmapModule = loader(path.join(root, 'src/stores/roadmap.ts'))
    return { projectModule, roadmapModule }
  }

  const validMachine = {
    id: 'normal-persist-1', name: 'X9900', type: '整机-手机', status: '待立项', progress: 0,
    leader: '张三', markets: [], androidVersion: 'Android 18', chipPlatform: 'G200', spm: '张三',
    updatedAt: '刚刚', productLine: 'SPARK', tosVersion: 'tOS 18.0', planStartDate: '', planEndDate: '',
    developCycle: 0, healthStatus: 'normal', firstSaleTosVersionId: '18.0.0', projectCode: 'X9900',
    brand: 'TECNO', productSeries: 'SPARK 90', marketName: 'SPARK 90', productType: '新品', platform: 'G200',
    startRam: '8GB', versionType: 'Full', str5Date: '2027-03-01', launchDate: '2027-04-01',
    developMode: '自研', remark: '',
  }

  try {
    const first = loadStores()
    if (!first.projectModule.useProjectStore.getState().addProject(validMachine, '创建人', {
      allowedFirstSaleTosValues: ['18.0.0'],
    })) {
      throw new Error('valid persisted fixture was rejected')
    }
    if (!storage.has('pms-projects') || !storage.has('pms-project-roadmap')) {
      throw new Error('project and roadmap stores did not both persist the normal create')
    }

    const second = loadStores()
    if (!second.projectModule.useProjectStore.getState().projects.some(project => project.id === validMachine.id)) {
      throw new Error('normal project disappeared after reload')
    }
    const createLog = second.roadmapModule.useRoadmapStore.getState().changeLogs.find(log => (
      log.projectId === validMachine.id && log.action === 'create'
    ))
    if (!createLog) throw new Error('normal create audit disappeared after reload')

    if (!second.projectModule.useProjectStore.getState().deleteProject(validMachine.id, '删除人')) {
      throw new Error('persisted normal project could not be deleted')
    }
    const third = loadStores()
    if (third.projectModule.useProjectStore.getState().projects.some(project => project.id === validMachine.id)) {
      throw new Error('deleted normal project reappeared after reload')
    }
    const deleteLog = third.roadmapModule.useRoadmapStore.getState().changeLogs.find(log => (
      log.projectId === validMachine.id && log.action === 'delete'
    ))
    if (!deleteLog) throw new Error('normal delete audit disappeared after reload')
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
})

registerAssertion('machine basic information exposes three-part enum selectors and fields', () => {
  const fieldModule = loadTypeScriptModule(path.join(root, 'src/constants/projectBasicFields.ts'))
  const basicFields = new Map(fieldModule.WHOLE_MACHINE_BASIC_INFO_FIELDS.map(field => [field.key, field.label]))
  const hardwareFields = new Map(fieldModule.WHOLE_MACHINE_HARDWARE_CONFIG_FIELDS.map(field => [field.key, field.label]))
  for (const [key, label] of [
    ['firstSaleTosVersionId', '首销 tOS 版本'],
    ['projectCode', '项目名'],
    ['startRam', '起步RAM'],
    ['str5Date', 'STR5时间'],
    ['launchDate', '上市时间'],
    ['remark', '备注'],
  ]) {
    if (basicFields.get(key) !== label) throw new Error(`basic information is missing ${key}:${label}`)
  }
  if (hardwareFields.get('platform') !== '平台') throw new Error('hardware information is missing roadmap platform')

  const projectSpaceSource = fs.readFileSync(path.join(root, 'src/containers/ProjectSpaceContainer.tsx'), 'utf8')
  if (!projectSpaceSource.includes("useTosEnumOptions('tos-3-part'")) throw new Error('project-space tOS selector is not backed by the three-part enum adapter')
  if (projectSpaceSource.includes('roadmapTosVersions') || projectSpaceSource.includes('roadmapTosOptions')) {
    throw new Error('project-space tOS selector still reads roadmap metadata')
  }
  if (!projectSpaceSource.includes("field.key === 'firstSaleTosVersionId'")) throw new Error('missing first-sale tOS editor')
  if (!projectSpaceSource.includes("editableField('firstSaleTosVersionId', firstSaleTosVersionName") || !projectSpaceSource.includes('machineTosOptions')) {
    throw new Error('read-only first-sale tOS renders a stable ID instead of its maintained name')
  }
})

registerAssertion('planned-project overlay exposes the complete accessible maintenance contract', () => {
  const plannedModalPath = path.join(root, 'src/components/roadmap/PlannedProjectModal.tsx')
  if (!fs.existsSync(plannedModalPath)) throw new Error('PlannedProjectModal.tsx is missing')
  const source = fs.readFileSync(plannedModalPath, 'utf8')
  if (source.includes('maskClosable')) throw new Error('planned-project modal uses deprecated Ant Design maskClosable')
  for (const classificationContract of [
    'PROJECT_SECONDARY_CATEGORIES[PROJECT_CATEGORY_MACHINE]',
    'label="项目分类"',
    '<Input value={PROJECT_CATEGORY_MACHINE} disabled />',
    'label="项目二级分类"',
  ]) {
    if (!source.includes(classificationContract)) {
      throw new Error(`planned-project classification is missing ${classificationContract}`)
    }
  }
  for (const field of [
    'machineProjectType',
    'projectCode',
    'androidVersion',
    'firstSaleTosVersionId',
    'brand',
    'productLine',
    'productSeries',
    'marketName',
    'productType',
    'platform',
    'startRam',
    'versionType',
    'str5Date',
    'launchDate',
    'developMode',
    'remark',
  ]) {
    if (!source.includes(`name="${field}"`) && !source.includes(`name='${field}'`)) {
      throw new Error(`planned-project form is missing ${field}`)
    }
  }
  for (const section of ['项目分类与识别', '产品与版本', '时间与备注']) {
    if (!source.includes(section)) throw new Error(`planned-project form is missing the ${section} section`)
  }
  for (const contract of [
    'Form.useWatch',
    'findRoadmapHistoryMatches',
    'buildRoadmapDuplicateKey',
    '已存在相同项目',
    'getProductLineOptions',
    "form.setFieldValue('productLine'",
    "form.scrollToField(firstErrorField, { block: 'center' })",
    'getFieldInstance',
    "format('YYYY-MM-DD')",
    'onDeletePlannedProject',
    'Modal.confirm',
    'canEdit',
    'submitLockRef',
    'form.isFieldsTouched()',
    'requestClose',
    '放弃未保存的修改',
  ]) {
    if (!source.includes(contract)) throw new Error(`planned-project form is missing ${contract}`)
  }
  if (!/const handleSubmit = async \(\) => \{\s*if \(submitLockRef\.current\) return\s+submitLockRef\.current = true/.test(source)) {
    throw new Error('planned-project submit must acquire a synchronous ref lock before any other work')
  }
  if (!source.includes('submitLockRef.current = false')) {
    throw new Error('planned-project submit lock is never released')
  }
  if (!source.includes('onCancel={requestClose}') || !source.includes('<Button onClick={requestClose}>取消</Button>')) {
    throw new Error('planned-project X, Escape, and footer cancel must share the touched close guard')
  }
  const historyHeaders = ['项目名称', '项目名', '安卓版本', '产品类型']
  const missingHeaders = historyHeaders.filter(header => !source.includes(`title: '${header}'`) && !source.includes(`title: "${header}"`))
  if (missingHeaders.length) throw new Error(`history table is missing exact columns: ${missingHeaders.join(', ')}`)
})

registerAssertion('retired tOS-version compatibility overlay is deleted', () => {
  const maintenancePath = path.join(root, 'src/components/roadmap/TosVersionMaintenanceModal.tsx')
  if (fs.existsSync(maintenancePath)) throw new Error('unused tOS compatibility shell still exists')
})

registerAssertion('roadmap version choices come only from the shared two-part enum', () => {
  const moduleSource = fs.readFileSync(path.join(root, 'src/components/roadmap/ProjectRoadmapModule.tsx'), 'utf8')
  if (!moduleSource.includes("useTosEnumOptions('tos-2-part'") || !moduleSource.includes('selectable: currentValues.includes')) {
    throw new Error('roadmap did not distinguish current enum options from historical display values')
  }
  const filterSource = fs.readFileSync(path.join(root, 'src/lib/roadmapFilters.ts'), 'utf8')
  if (!filterSource.includes('.filter(version => version.selectable !== false)')) {
    throw new Error('roadmap filters still expose historical orphan values as new choices')
  }
})

registerAssertion('roadmap business views use compact display versions with full tooltips and periods', () => {
  const table = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapTableView.tsx'), 'utf8')
  const evolution = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapEvolutionView.tsx'), 'utf8')
  const card = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapProjectCard.tsx'), 'utf8')
  for (const [name, source] of [['table', table], ['evolution', evolution], ['card', card]]) {
    if (!source.includes('formatTosVersionDisplay') || !source.includes('formatTosVersionFull')) {
      throw new Error(`${name} view is missing display/full version formatting`)
    }
  }
  for (const contract of ['periodStartDate', 'periodEndDate', '<Tooltip']) {
    if (!evolution.includes(contract)) throw new Error(`evolution version header is missing ${contract}`)
  }
})

registerAssertion('historical tOS references remain display-only after enum removal', () => {
  const validation = loadTypeScriptModule(path.join(root, 'src/lib/roadmapValidation.ts'))
  const persisted = validation.normalizeRoadmapTosReference('tOS16.3')
  const options = validation.buildRoadmapTosSelectOptions(['17.2'], persisted)
  if (persisted !== '16.3' || options[0]?.value !== '16.3' || options[0]?.disabled !== true) {
    throw new Error(`historical reference did not become a disabled display option: ${JSON.stringify(options)}`)
  }
  if (options.filter(option => !option.disabled).map(option => option.value).join(',') !== '17.2') {
    throw new Error('historical reference leaked into enabled choices')
  }
})

registerAssertion('tOS reference migration collapses legacy patch identities', () => {
  const validation = loadTypeScriptModule(path.join(root, 'src/lib/roadmapValidation.ts'))
  if (validation.normalizeRoadmapTosReference('tOS 17.2.3') !== '17.2') {
    throw new Error('legacy patch tOS reference was not collapsed to major.minor')
  }
})

registerAssertion('tOS target editor preserves one multiline target value', () => {
  const targetPath = path.join(root, 'src/components/roadmap/TosTargetEditor.tsx')
  if (!fs.existsSync(targetPath)) throw new Error('TosTargetEditor.tsx is missing')
  const source = fs.readFileSync(targetPath, 'utf8')
  if (source.includes('maskClosable')) throw new Error('target editor uses deprecated Ant Design maskClosable')
  for (const contract of [
    'targetText',
    '<Input.TextArea',
    '.trim()',
    'setTosTargets',
    'setTosTargets(version.id, normalizedTargets)',
    'canEdit',
    'aria-label',
  ]) {
    if (!source.includes(contract)) throw new Error(`tOS target editor is missing ${contract}`)
  }
})

registerAssertion('roadmap maintenance submissions use same-tick locks around every async path', () => {
  for (const fileName of ['PlannedProjectModal.tsx']) {
    const source = fs.readFileSync(path.join(root, 'src/components/roadmap', fileName), 'utf8')
    if (!/const handleSubmit = async \(\) => \{\s*if \(submitLockRef\.current\) return\s+submitLockRef\.current = true/.test(source)) {
      throw new Error(`${fileName} does not reject a rapid second submit before awaiting validation`)
    }
    const acquireIndex = source.indexOf('submitLockRef.current = true')
    const validateIndex = source.indexOf('form.validateFields()', acquireIndex)
    const releaseIndex = source.indexOf('submitLockRef.current = false', validateIndex)
    if (acquireIndex < 0 || validateIndex < acquireIndex || releaseIndex < validateIndex) {
      throw new Error(`${fileName} does not hold its submit lock across validation and mutation`)
    }
  }
})

registerAssertion('planned-project close guard confirms only touched drafts and bypasses successful completion', () => {
  const source = fs.readFileSync(path.join(root, 'src/components/roadmap/PlannedProjectModal.tsx'), 'utf8')
  if (!source.includes('form.isFieldsTouched()') || !source.includes("title: '放弃未保存的修改？'")) {
    throw new Error('planned-project modal does not distinguish untouched and dirty close requests')
  }
  if (!source.includes('dirtyRef.current && form.isFieldsTouched()') || !source.includes('onValuesChange')) {
    throw new Error('planned-project modal must distinguish user changes from programmatic initialization')
  }
  if (!source.includes('onCancel={requestClose}') || !source.includes('<Button onClick={requestClose}>取消</Button>')) {
    throw new Error('planned-project close affordances do not share the close guard')
  }
  if ((source.match(/onChanged\?\.\(\)\s+clearDraftAndClose\(\)/g) ?? []).length < 1
    || !source.includes('onDeletePlannedProject(editingProject.id)')) {
    throw new Error('successful save must clear its draft and shared deletion must bypass the discard confirmation')
  }
  const moduleSource = fs.readFileSync(path.join(root, 'src/components/roadmap/ProjectRoadmapModule.tsx'), 'utf8')
  if (!moduleSource.includes('requestDeletePlannedProject(projectId, closePlannedProjectModal)')) {
    throw new Error('successful shared deletion does not close the planned-project editor directly')
  }
})

registerAssertion('roadmap typed filters enforce kind-specific operators with AND semantics', () => {
  const filters = loadTypeScriptModule(path.join(root, 'src/lib/filterConditions.ts'))
  for (const exportName of [
    'getFilterOperatorsForKind',
    'normalizeFilterConditions',
    'applyFilterConditions',
  ]) {
    if (typeof filters[exportName] !== 'function') throw new Error(`filterConditions is missing ${exportName}`)
  }

  const definitions = [
    { key: 'name', label: '项目名', kind: 'text' },
    { key: 'brand', label: '品牌', kind: 'enum', options: [{ label: 'TECNO', value: 'TECNO' }] },
    { key: 'launchDate', label: '上市时间', kind: 'date' },
  ]
  const rows = [
    { name: 'Spark 40', brand: 'TECNO', launchDate: '2026-10-02' },
    { name: 'Note 70', brand: 'Infinix', launchDate: '2026-08-01' },
    { name: '', brand: 'TECNO', launchDate: '' },
  ]
  const filtered = filters.applyFilterConditions(rows, [
    { id: 'name', field: 'name', operator: 'contains', value: 'spark' },
    { id: 'brand', field: 'brand', operator: 'equals', value: 'TECNO' },
    { id: 'date', field: 'launchDate', operator: 'after', value: '2026-09-30' },
  ], definitions)
  if (filtered.length !== 1 || filtered[0].name !== 'Spark 40') {
    throw new Error(`typed filter AND semantics failed: ${JSON.stringify(filtered)}`)
  }
  const invalidEnumContains = filters.normalizeFilterConditions([
    { id: 'invalid', field: 'brand', operator: 'contains', value: 'TEC' },
  ], definitions)
  if (invalidEnumContains.length !== 0) throw new Error('enum fields accepted the text-only contains operator')
  const duplicateFields = filters.normalizeFilterConditions([
    { id: 'one', field: 'name', operator: 'contains', value: 'Spark' },
    { id: 'two', field: 'name', operator: 'notContains', value: 'Note' },
  ], definitions)
  if (duplicateFields.length !== 1) throw new Error('typed filters did not suppress duplicate fields')
  const beforeRows = filters.applyFilterConditions(rows, [
    { id: 'before', field: 'launchDate', operator: 'before', value: '2026-09-01' },
  ], definitions)
  if (beforeRows.length !== 1 || beforeRows[0].name !== 'Note 70') {
    throw new Error(`date before/after operators must not treat empty values as dates: ${JSON.stringify(beforeRows)}`)
  }

  const textOperators = filters.getFilterOperatorsForKind('text').map(option => option.value)
  const enumOperators = filters.getFilterOperatorsForKind('enum').map(option => option.value)
  const dateOperators = filters.getFilterOperatorsForKind('date').map(option => option.value)
  for (const operator of ['equals', 'notEquals', 'contains', 'notContains', 'isEmpty', 'isNotEmpty']) {
    if (!textOperators.includes(operator)) throw new Error(`text operators are missing ${operator}`)
  }
  if (enumOperators.includes('contains') || !enumOperators.includes('isNotEmpty')) {
    throw new Error('enum operators do not match the approved contract')
  }
  if (!dateOperators.includes('before') || !dateOperators.includes('after') || dateOperators.includes('contains')) {
    throw new Error('date operators do not match the approved contract')
  }
})

registerAssertion('roadmap filter domain sanitizers preserve valid saved orphans and approved column invariants', () => {
  const domainPath = path.join(root, 'src/lib/roadmapFilters.ts')
  if (!fs.existsSync(domainPath)) throw new Error('roadmapFilters.ts is missing')
  const domain = loadTypeScriptModule(domainPath)
  const versions = [
    { id: 'tos-18-0', name: 'tOS 18.0', major: 18, minor: 0, targets: [], createdAt: '', updatedAt: '' },
    { id: 'tos-17-2', name: 'tOS 17.2', major: 17, minor: 2, targets: [], createdAt: '', updatedAt: '' },
  ]
  const malicious = [
    { id: 'text', field: 'marketName', operator: 'contains', value: '  Europe  ' },
    { id: 'duplicate-field', field: 'marketName', operator: 'equals', value: 'ignored' },
    { id: 'bad-enum-operator', field: 'brand', operator: 'contains', value: 'TEC' },
    { id: 'bad-enum-value', field: 'brand', operator: 'equals', value: 'Unknown' },
    { id: 'valid-enum', field: 'brand', operator: 'equals', value: ['TECNO', 'Infinix', 'Unknown', 'TECNO'] },
    { id: 'valid-ram', field: 'startRam', operator: 'notEquals', value: '4GB' },
    { id: 'bad-date', field: 'launchDate', operator: 'after', value: '2026-02-30' },
    { id: 'valid-date', field: 'str5Date', operator: 'before', value: '2028-02-29' },
    { id: 'bad-version', field: 'firstSaleTosVersionId', operator: 'equals', value: 'tos-99-0' },
    { id: 'bad-version-not-equals', field: 'firstSaleTosVersionId', operator: 'notEquals', value: 'tos-17-2' },
    { id: 'bad-version-empty', field: 'firstSaleTosVersionId', operator: 'isEmpty', value: '' },
    { id: 'bad-version-not-empty', field: 'firstSaleTosVersionId', operator: 'isNotEmpty', value: '' },
    { id: 'legacy-version', field: 'firstSaleTosVersionId', operator: 'equals', value: ['tos-18-0', 'tos-99-0'] },
    { id: 'blank-text', field: 'remark', operator: 'contains', value: '   ' },
    { id: 'empty', field: 'productSeries', operator: 'isEmpty', value: 'discard-me' },
  ]
  const sanitized = domain.sanitizeRoadmapFilterConditions(malicious, versions)
  const expected = [
    ['marketName', 'contains', 'Europe'],
    ['brand', 'equals', ['TECNO', 'Infinix']],
    ['startRam', 'notEquals', ['4GB']],
    ['str5Date', 'before', '2028-02-29'],
    ['firstSaleTosVersionId', 'equals', ['99.0']],
    ['productSeries', 'isEmpty', ''],
  ]
  if (JSON.stringify(sanitized.map(item => [item.field, item.operator, item.value])) !== JSON.stringify(expected)) {
    throw new Error(`roadmap filter sanitizer leaked invalid state: ${JSON.stringify(sanitized)}`)
  }
  const secondPass = domain.sanitizeRoadmapFilterConditions(sanitized, versions)
  if (JSON.stringify(secondPass) !== JSON.stringify(sanitized)) throw new Error('roadmap filter sanitizer is not idempotent')
  const tosOperators = domain.getRoadmapFilterOperators('firstSaleTosVersionId', 'enum')
  if (JSON.stringify(tosOperators) !== JSON.stringify([{ value: 'equals', label: '等于' }])) {
    throw new Error(`tOS filter exposed non-equality operators: ${JSON.stringify(tosOperators)}`)
  }

  const columns = domain.sanitizeRoadmapVisibleColumns(['remark', 'brand', 'brand', 'unknown'])
  if (JSON.stringify(columns) !== JSON.stringify(['brand', 'remark'])) {
    throw new Error(`visible columns did not restore approved order: ${JSON.stringify(columns)}`)
  }
  const minimumColumns = domain.sanitizeRoadmapVisibleColumns(['unknown'])
  if (JSON.stringify(minimumColumns) !== JSON.stringify(['firstSaleTosVersionId'])) {
    throw new Error(`visible columns did not preserve the one-column minimum: ${JSON.stringify(minimumColumns)}`)
  }
})

registerAssertion('roadmap selectable filters use OR within a condition and AND across conditions', () => {
  const domain = loadTypeScriptModule(path.join(root, 'src/lib/roadmapFilters.ts'))
  const definitions = domain.buildRoadmapFilterFieldDefinitions([])
  const rows = [
    { id: 'one', brand: 'TECNO', startRam: '4GB' },
    { id: 'two', brand: 'Infinix', startRam: '8GB' },
    { id: 'three', brand: 'itel', startRam: '4GB' },
  ]
  const equals = domain.applyRoadmapFilters(rows, 'all', 'all', [
    { id: 'brand', field: 'brand', operator: 'equals', value: ['TECNO', 'Infinix'] },
    { id: 'ram', field: 'startRam', operator: 'equals', value: ['4GB', '8GB'] },
  ], definitions)
  if (equals.map(row => row.id).join(',') !== 'one,two') {
    throw new Error(`multi equals must OR values and AND conditions: ${JSON.stringify(equals)}`)
  }
  const notEquals = domain.applyRoadmapFilters(rows, 'all', 'all', [
    { id: 'brand', field: 'brand', operator: 'notEquals', value: ['TECNO', 'itel'] },
  ], definitions)
  if (notEquals.map(row => row.id).join(',') !== 'two') {
    throw new Error(`multi notEquals must reject every listed value: ${JSON.stringify(notEquals)}`)
  }
})

registerAssertion('roadmap selectable filter UI and evolution columns honor multi-selection', () => {
  const drawerSource = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapFilterDrawer.tsx'), 'utf8')
  for (const contract of ['mode="multiple"', 'maxTagCount="responsive"', "definition.kind === 'enum'"]) {
    if (!drawerSource.includes(contract)) throw new Error(`selectable filter UI is missing ${contract}`)
  }
  const evolution = loadTypeScriptModule(path.join(root, 'src/components/roadmap/RoadmapEvolutionView.tsx'))
  const versions = [
    { id: 'tos-17-2', major: 17, minor: 2 },
    { id: 'tos-18-0', major: 18, minor: 0 },
    { id: 'tos-16-3', major: 16, minor: 3 },
  ]
  const all = evolution.selectEvolutionVersions(versions, [])
  if (all.map(version => version.id).join(',') !== 'tos-16-3,tos-17-2,tos-18-0') {
    throw new Error(`evolution versions lost old-to-new chronology: ${JSON.stringify(all)}`)
  }
  const selected = evolution.selectEvolutionVersions(versions, ['tos-17-2', 'tos-18-0'])
  if (selected.map(version => version.id).join(',') !== 'tos-17-2,tos-18-0') {
    throw new Error(`evolution did not restrict columns to selected versions: ${JSON.stringify(selected)}`)
  }
})

registerAssertion('roadmap filter setters accept only current enum values', () => {
  const storeModule = loadIsolatedRoadmapStore()
  const store = resetRoadmapStore(storeModule)
  for (const operator of ['notEquals', 'isEmpty', 'isNotEmpty']) {
    store.getState().setFilters([{
      id: `invalid-tos-${operator}`,
      field: 'firstSaleTosVersionId',
      operator,
      value: operator === 'notEquals' ? '17.2' : '',
    }])
    if (store.getState().selectedTosVersionId !== null
      || store.getState().filters.some(filter => filter.field === 'firstSaleTosVersionId')) {
      throw new Error(`runtime sanitizer retained tOS ${operator}`)
    }
  }
  store.getState().setFilters([
    { id: 'version', field: 'firstSaleTosVersionId', operator: 'equals', value: '17.2' },
    { id: 'bad-version', field: 'firstSaleTosVersionId', operator: 'equals', value: '99.0' },
    { id: 'bad-brand', field: 'brand', operator: 'equals', value: 'Other' },
    { id: 'date', field: 'launchDate', operator: 'after', value: '2027-12-01' },
  ])
  if (store.getState().filters.map(filter => filter.id).join(',') !== 'version,date') {
    throw new Error(`setFilters bypassed domain sanitization: ${JSON.stringify(store.getState().filters)}`)
  }
  store.getState().setVisibleColumns(['remark', 'brand', 'brand'])
  if (JSON.stringify(store.getState().visibleColumns) !== JSON.stringify(['firstSaleTosVersionId', 'brand', 'remark'])) {
    throw new Error(`setVisibleColumns did not restore approved order: ${JSON.stringify(store.getState().visibleColumns)}`)
  }
  if (store.getState().filters.some(filter => JSON.stringify(filter.value).includes('99.0'))) {
    throw new Error('non-current tOS enum value survived runtime filtering')
  }
})

registerAssertion('current-version roadmap hydration rejects malicious typed filters', () => {
  const initialStore = loadIsolatedRoadmapStore()
  const state = initialStore.createInitialRoadmapState()
  const hydrated = hydrateRoadmapStoreFromEnvelope({
    version: 1,
    state: {
      ...state,
      viewMode: 'evolution',
      selectedTosVersionId: null,
      filters: [
        { id: 'bad-operator', field: 'brand', operator: 'contains', value: 'TEC' },
        { id: 'bad-enum', field: 'brand', operator: 'equals', value: '__proto__' },
        { id: 'bad-date', field: 'launchDate', operator: 'before', value: '2026-13-01' },
        { id: 'bad-version', field: 'firstSaleTosVersionId', operator: 'equals', value: 'missing' },
        { id: 'bad-version-not-equals', field: 'firstSaleTosVersionId', operator: 'notEquals', value: '17.2' },
        { id: 'bad-version-empty', field: 'firstSaleTosVersionId', operator: 'isEmpty', value: '' },
        { id: 'bad-version-not-empty', field: 'firstSaleTosVersionId', operator: 'isNotEmpty', value: '' },
        { id: 'valid-version', field: 'firstSaleTosVersionId', operator: 'equals', value: '17.2' },
        { id: 'valid-text', field: 'remark', operator: 'notContains', value: '  risk  ' },
      ],
      visibleColumns: ['remark', 'brand', 'unknown', 'brand'],
      visibleColumnsByView: {
        ...state.visibleColumnsByView,
        table: ['remark', 'brand', 'unknown', 'brand'],
      },
    },
  })
  if (hydrated.filters.map(filter => filter.id).join(',') !== 'valid-version,valid-text') {
    throw new Error(`malicious version-1 filters survived hydration: ${JSON.stringify(hydrated.filters)}`)
  }
  if (JSON.stringify(hydrated.filters[0].value) !== JSON.stringify(['17.2'])
    || hydrated.filters[1].value !== 'risk'
    || JSON.stringify(hydrated.visibleColumnsByView.table) !== JSON.stringify(['firstSaleTosVersionId', 'brand', 'remark'])) {
    throw new Error(`hydrated filter/column state was not normalized: ${JSON.stringify(hydrated)}`)
  }
})

registerAssertion('roadmap text-filter debouncer removes stale conditions before delaying replacements', () => {
  const domain = loadTypeScriptModule(path.join(root, 'src/lib/roadmapFilters.ts'))
  const oldText = { id: 'name', field: 'displayName', operator: 'contains', value: 'old' }
  const retainedText = { id: 'remark', field: 'remark', operator: 'notContains', value: 'risk' }
  const nextText = { ...oldText, value: 'new' }
  const addedText = { id: 'market', field: 'marketName', operator: 'contains', value: 'EU' }
  const transition = domain.transitionRoadmapTextFilters([oldText, retainedText], [nextText, retainedText, addedText])
  if (transition.immediate.map(filter => filter.id).join(',') !== 'remark' || transition.pending.map(filter => filter.id).join(',') !== 'name,market') {
    throw new Error(`text transition retained stale filters: ${JSON.stringify(transition)}`)
  }

  const scheduled = new Map()
  let timerId = 0
  const scheduler = {
    setTimeout(callback, delay) {
      timerId += 1
      scheduled.set(timerId, { callback, delay })
      return timerId
    },
    clearTimeout(id) { scheduled.delete(id) },
  }
  const publications = []
  const debouncer = domain.createRoadmapTextFilterDebouncer(
    [oldText, retainedText],
    filters => publications.push(filters.map(filter => `${filter.id}:${filter.value}`).join(',')),
    scheduler,
  )
  debouncer.update([nextText, retainedText, addedText])
  if (publications.at(-1) !== 'remark:risk') throw new Error(`stale text stayed effective: ${JSON.stringify(publications)}`)
  const pendingTimer = [...scheduled.values()][0]
  if (!pendingTimer || pendingTimer.delay !== 150) throw new Error(`text debounce delay is wrong: ${JSON.stringify([...scheduled.values()])}`)
  pendingTimer.callback()
  if (publications.at(-1) !== 'name:new,remark:risk,market:EU') throw new Error(`new text did not apply after fake time: ${JSON.stringify(publications)}`)
  debouncer.update([])
  if (publications.at(-1) !== '' || scheduled.size !== 0) throw new Error('text reset was not immediate')
  debouncer.dispose()
})

registerAssertion('roadmap filter drawer resets draft state without mutating applied filters', () => {
  const drawerSource = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapFilterDrawer.tsx'), 'utf8')
  const moduleSource = fs.readFileSync(path.join(root, 'src/components/roadmap/ProjectRoadmapModule.tsx'), 'utf8')
  if (moduleSource.includes('onReset={() => setFilters([])}')) {
    throw new Error('filter reset still mutates the applied store before Apply')
  }
  const resetBody = drawerSource.match(/const resetAdvancedFilters = \(\) => \{([\s\S]*?)\n  \}/)?.[1] ?? ''
  if (!resetBody.includes('setDraftConditions') || resetBody.includes('onApply')) {
    throw new Error('filter reset is not draft-only')
  }
  if (!drawerSource.includes('onReset={resetAdvancedFilters}')) {
    throw new Error('floating filter reset is not wired to the draft-only reset handler')
  }
  if ((drawerSource.match(/onApply\(/g) ?? []).length !== 1) {
    throw new Error('only the Apply action may submit drawer conditions')
  }
  if (!drawerSource.includes('if (!open) return') || !drawerSource.includes('setDraftConditions(conditions.length')) {
    throw new Error('cancel/reopen does not restore the original applied filters')
  }
})

registerAssertion('roadmap module composes controls and overlays without standalone search', () => {
  const componentNames = [
    'ProjectRoadmapModule.tsx',
    'RoadmapToolbar.tsx',
    'RoadmapFilterDrawer.tsx',
    'RoadmapColumnSettingsDrawer.tsx',
  ]
  for (const componentName of componentNames) {
    if (!fs.existsSync(path.join(root, 'src/components/roadmap', componentName))) {
      throw new Error(`${componentName} is missing`)
    }
  }
  const toolbarSource = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapToolbar.tsx'), 'utf8')
  for (const label of ['表单视图', '版本演进视图', '记录', 'tOS 版本维护', '创建项目', '筛选', '列设置']) {
    if (!toolbarSource.includes(label)) throw new Error(`Roadmap toolbar is missing ${label}`)
  }
  if (/placeholder=["'][^"']*搜索/.test(toolbarSource)) throw new Error('Roadmap must not add a standalone search input')
  for (const contract of [
    'canView',
    'canEdit',
    'onToggleFullscreen',
    "viewMode === 'evolution'",
    'filterCount',
    'roadmap-toolbar-glass',
  ]) {
    if (!toolbarSource.includes(contract)) throw new Error(`Roadmap toolbar is missing ${contract}`)
  }
  const wrappingQuickFilters = toolbarSource.match(/<Flex[^>]*data-roadmap-quick-filter[^>]*wrap[^>]*>/g) ?? []
  if (wrappingQuickFilters.length !== 2) {
    throw new Error('brand and product-type quick-filter groups must wrap their labels on narrow screens')
  }
  const moduleSource = fs.readFileSync(path.join(root, 'src/components/roadmap/ProjectRoadmapModule.tsx'), 'utf8')
  for (const contract of [
    'useHasGlobalPermission',
    "hasPermission('roadmap:view')",
    "hasPermission('roadmap:edit')",
    'adaptNormalProject',
    'adaptPlannedProject',
    'deriveRoadmapPlanningConflicts',
    'applyRoadmapFilters',
    'PlannedProjectModal',
    'useEnumStore',
    'openSharedTosEnumConfig',
    'configuredFilterCount',
    'filterCount={configuredFilterCount}',
  ]) {
    if (!moduleSource.includes(contract)) throw new Error(`ProjectRoadmapModule is missing ${contract}`)
  }
  const conflictIndex = moduleSource.indexOf('deriveRoadmapPlanningConflicts')
  const filterIndex = moduleSource.indexOf('applyRoadmapFilters', conflictIndex)
  if (conflictIndex < 0 || filterIndex < conflictIndex) {
    throw new Error('conflicts must be derived from the full row sets before filtering')
  }
  const filterDomainSource = fs.readFileSync(path.join(root, 'src/lib/roadmapFilters.ts'), 'utf8')
  if (!filterDomainSource.includes('ROADMAP_FILTER_DEBOUNCE_MS = 150')
    || !moduleSource.includes('createRoadmapTextFilterDebouncer')) {
    throw new Error('free-text roadmap filters are missing the shared 150ms debounce')
  }
  if (!toolbarSource.includes('已配置')) {
    throw new Error('roadmap toolbar must describe the badge as configured filters during debounce')
  }
})

registerAssertion('sticky roadmap toolbar stays below the main header', () => {
  const toolbarSource = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapToolbar.tsx'), 'utf8')
  if (!toolbarSource.includes("top: isFullscreen ? 0 : 'var(--pms-main-header-height, 56px)'")) {
    throw new Error('sticky roadmap toolbar must offset below the 56px main header')
  }
  if (!toolbarSource.includes('zIndex: 30')) {
    throw new Error('roadmap toolbar z-index must stay below the main header and above roadmap content')
  }
})

registerAssertion('roadmap filter and column drawers preserve quick filters and shared business columns', () => {
  const filterSource = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapFilterDrawer.tsx'), 'utf8')
  for (const contract of [
    '筛选条件',
    '字段',
    '条件',
    '值',
    'getFieldOptionsWithDuplicateDisabled',
    'DatePicker',
    'Select',
    'Input',
    'resetAdvancedFilters',
    'onApply',
    'getRoadmapFilterOperators',
  ]) {
    if (!filterSource.includes(contract)) throw new Error(`RoadmapFilterDrawer is missing ${contract}`)
  }
  if (filterSource.includes('setBrandFilter') || filterSource.includes('setProductTypeFilter')) {
    throw new Error('resetting advanced filters is coupled to quick filters')
  }
  const columnsSource = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapColumnSettingsDrawer.tsx'), 'utf8')
  for (const contract of ['SortableColumnSettings', 'getRoadmapSortableColumnDefinitions', 'value', 'onChange']) {
    if (!columnsSource.includes(contract)) throw new Error(`RoadmapColumnSettingsDrawer is missing ${contract}`)
  }
  if (columnsSource.includes("操作列") || columnsSource.includes("key: 'action'")) {
    throw new Error('the fixed action column leaked into shared column settings')
  }
  const roadMapTypes = loadTypeScriptModule(path.join(root, 'src/types/roadmap.ts'))
  if (roadMapTypes.ROADMAP_COLUMNS.length !== 14) throw new Error('shared roadmap columns must contain all 14 business fields')
})

registerAssertion('single-version roadmap table preserves sorting, targets, sources, and conflicts', () => {
  const tablePath = path.join(root, 'src/components/roadmap/RoadmapTableView.tsx')
  if (!fs.existsSync(tablePath)) throw new Error('RoadmapTableView.tsx is missing')
  const source = fs.readFileSync(tablePath, 'utf8')
  for (const contract of [
    'ROADMAP_COLUMNS',
    'visibleColumns',
    'compareRoadmapValues',
    'sortOrder',
    'aria-sort',
    'resolveRoadmapTableVersion',
    'firstSaleTosVersionId',
    "formatRoadmapTableValue",
    "rowKey={row => `${row.source}:${row.id}`}",
    'version.targets.length',
    '已存在正式项目',
    'roadmap-conflict-row',
    'onOpenConflict',
    'onEditPlannedProject',
    'onDeletePlannedProject',
    'action',
  ]) {
    if (!source.includes(contract)) throw new Error(`RoadmapTableView is missing ${contract}`)
  }
  if (!source.includes("row.source !== 'planned'")) {
    throw new Error('normal roadmap rows are not explicitly excluded from planned edit/delete actions')
  }
  if (source.includes("key: 'action'\n") && source.includes('ROADMAP_COLUMNS.push')) {
    throw new Error('the fixed action column must not mutate the shared business-column catalog')
  }
  if (source.includes('Modal.confirm') || source.includes('deletePlannedProject = useRoadmapStore')) {
    throw new Error('the table duplicated the shared planned-project deletion path')
  }

  const moduleSource = fs.readFileSync(path.join(root, 'src/components/roadmap/ProjectRoadmapModule.tsx'), 'utf8')
  for (const contract of [
    "import RoadmapTableView from './RoadmapTableView'",
    '<RoadmapTableView',
    'setSelectedTosVersionId',
    'setSort',
    'setSelectedConflictKey',
    'requestDeletePlannedProject',
    'Modal.confirm',
    'deletePlannedProject',
  ]) {
    if (!moduleSource.includes(contract)) throw new Error(`ProjectRoadmapModule table integration is missing ${contract}`)
  }
  const plannedModalSource = fs.readFileSync(path.join(root, 'src/components/roadmap/PlannedProjectModal.tsx'), 'utf8')
  if (!plannedModalSource.includes('onDeletePlannedProject') || plannedModalSource.includes('Modal.confirm({\n      title: \'删除待规划项目？\'')) {
    throw new Error('PlannedProjectModal must reuse the module-owned delete confirmation')
  }
})

registerAssertion('roadmap table hides planned labels and uses opaque fixed columns with hover actions', () => {
  const source = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapTableView.tsx'), 'utf8')
  for (const contract of [
    'roadmap-planned-row',
    'roadmap-table-row-actions',
    '.ant-table-cell-fix-start',
    '.ant-table-cell-fix-end',
    'position: sticky !important',
    'background: var(--bg-secondary) !important',
    'tr.roadmap-planned-row:hover .roadmap-table-row-actions',
    'tr.roadmap-planned-row:focus-within .roadmap-table-row-actions',
    '已存在正式项目',
  ]) {
    if (!source.includes(contract)) throw new Error(`roadmap table refinement is missing ${contract}`)
  }
  if (source.includes('roadmap-table-project-source-tag') || />待规划<\/Tag>/.test(source)) {
    throw new Error('roadmap table still displays planned-project tags')
  }
})

registerAssertion('version evolution uses one aligned shared scroll grid', () => {
  const evolutionSource = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapEvolutionView.tsx'), 'utf8')
  const cardSource = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapProjectCard.tsx'), 'utf8')
  for (const contract of [
    'grid-template-rows',
    'scrollTo',
    'scrollSignature',
    "EVOLUTION_BRAND_ORDER = ['TECNO', 'Infinix', 'itel']",
    'position: sticky',
    'gridRow: 4',
    'prefers-reduced-motion',
  ]) {
    if (!evolutionSource.includes(contract)) throw new Error(`RoadmapEvolutionView is missing ${contract}`)
  }
  if (evolutionSource.includes("overflowY: 'auto'") || evolutionSource.includes('最新')) {
    throw new Error('evolution columns must share scrolling and must not mark a latest version')
  }
  for (const contract of ['待规划', '已存在正常项目', 'onEditPlannedProject', 'onDeletePlannedProject']) {
    if (!cardSource.includes(contract)) throw new Error(`RoadmapProjectCard is missing ${contract}`)
  }
})

registerAssertion('evolution old-product divider and planned actions use compact progressive disclosure', () => {
  const evolutionSource = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapEvolutionView.tsx'), 'utf8')
  const cardSource = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapProjectCard.tsx'), 'utf8')
  const globalStyles = fs.readFileSync(path.join(root, 'src/styles/globals.css'), 'utf8')
  for (const contract of [
    '.pms-roadmap-evolution-separator',
    'className="pms-roadmap-evolution-shell pms-solid-surface"',
    'background: var(--pms-surface-solid)',
    'box-shadow: inset 0 1px 0',
  ]) {
    if (!evolutionSource.includes(contract)) throw new Error(`old-product divider is missing ${contract}`)
  }
  if (!/\.pms-roadmap-evolution-shell\.pms-solid-surface\s+\.pms-roadmap-evolution-separator,[\s\S]{0,220}\{[\s\S]{0,160}background:\s*var\(--pms-surface-solid\);/.test(globalStyles)) {
    throw new Error('old-product divider is missing the opaque semantic material override')
  }
  if (evolutionSource.includes('background: rgba(238, 242, 255, 0.54)')) {
    throw new Error('old-product divider still uses the translucent legacy fill')
  }
  for (const contract of [
    'MoreOutlined',
    'actionsExpanded',
    'aria-expanded={actionsExpanded}',
    'pms-roadmap-evolution-actions-collapse',
    'grid-template-rows: 0fr',
    'grid-template-rows: 1fr',
  ]) {
    if (!cardSource.includes(contract) && !evolutionSource.includes(contract)) {
      throw new Error(`planned-project action disclosure is missing ${contract}`)
    }
  }
})

registerAssertion('evolution cards keep locked titles and approved colors', () => {
  const filters = loadTypeScriptModule(path.join(root, 'src/lib/roadmapFilters.ts'))
  const cardModule = loadTypeScriptModule(path.join(root, 'src/components/roadmap/RoadmapProjectCard.tsx'))
  const cardSource = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapProjectCard.tsx'), 'utf8')
  const drawerSource = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapColumnSettingsDrawer.tsx'), 'utf8')
  const evolutionSource = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapEvolutionView.tsx'), 'utf8')
  const moduleSource = fs.readFileSync(path.join(root, 'src/components/roadmap/ProjectRoadmapModule.tsx'), 'utf8')
  const tableSource = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapTableView.tsx'), 'utf8')

  if (cardModule.formatEvolutionCardTitle({
    marketName: ' SPARK 60 ', projectCode: 'KJ6', androidVersion: 'Android 16', productType: '新品',
  }) !== 'SPARK 60（KJ6）') {
    throw new Error('evolution card title does not use market name, project name, and full-width parentheses')
  }
  if (cardModule.formatEvolutionCardTitle({
    marketName: ' ', projectCode: '', androidVersion: 'Android 16', productType: '新品',
  }) !== '—（—）') {
    throw new Error('evolution card title does not fall back for empty structural values')
  }
  const expectedLocked = ['marketName', 'displayName']
  if (JSON.stringify(filters.ROADMAP_EVOLUTION_LOCKED_COLUMNS) !== JSON.stringify(expectedLocked)) {
    throw new Error('evolution structural columns are not locked')
  }
  const expectedEvolution = [
    'marketName', 'displayName', 'platform', 'startRam', 'versionType', 'str5Date', 'launchDate', 'developMode',
  ]
  if (JSON.stringify(filters.DEFAULT_ROADMAP_EVOLUTION_VISIBLE_COLUMNS) !== JSON.stringify(expectedEvolution)) {
    throw new Error('evolution defaults do not include both structural title fields')
  }
  const lockedSelection = filters.ensureRoadmapLockedColumns(['marketName'], expectedLocked)
  if (JSON.stringify(lockedSelection) !== JSON.stringify(['marketName', 'displayName'])) {
    throw new Error('locked structural fields can be removed from a column selection')
  }

  for (const token of ['SortableColumnSettings', 'normalizeRoadmapColumnSettings', 'getRoadmapSortableColumnDefinitions']) {
    if (!drawerSource.includes(token)) throw new Error(`column settings are missing ${token}`)
  }
  for (const token of ["viewMode === 'table'", "['firstSaleTosVersionId']", 'ROADMAP_EVOLUTION_LOCKED_COLUMNS']) {
    if (!fs.readFileSync(path.join(root, 'src/lib/roadmapFilters.ts'), 'utf8').includes(token)) {
      throw new Error(`roadmap column definitions are missing ${token}`)
    }
  }
  if (!moduleSource.includes('value={{ order: [...columnOrder], visible: [...visibleColumns] }}')) {
    throw new Error('active ordered settings are not passed to the roadmap column settings entry')
  }
  for (const token of ['formatEvolutionCardTitle', "Full: 'blue'", "Slim: 'gold'", "Go: 'cyan'", "column.key !== 'marketName'", "column.key !== 'displayName'"]) {
    if (!cardSource.includes(token)) throw new Error(`card is missing ${token}`)
  }
  for (const token of ['brand-tecno', 'brand-infinix', 'brand-itel', 'pms-roadmap-evolution-brand-label']) {
    if (!evolutionSource.includes(token)) throw new Error(`brand styling is missing ${token}`)
  }
  for (const contract of [
    '.pms-roadmap-evolution-brand-label.brand-tecno {\n          color: #0958d9;',
    '.pms-roadmap-evolution-brand-label.brand-infinix {\n          color: #237804;',
    '.pms-roadmap-evolution-brand-label.brand-itel {\n          color: #cf1322;',
  ]) {
    if (!evolutionSource.includes(contract)) throw new Error(`brand label contrast is missing ${contract}`)
  }
  for (const token of ['pms-roadmap-evolution-card-header', 'pms-roadmap-evolution-card-title']) {
    if (!evolutionSource.includes(token) && !cardSource.includes(token)) throw new Error(`card nowrap styling is missing ${token}`)
  }
  for (const token of ['roadmap-table-project-name-row', 'roadmap-table-project-name']) {
    if (!tableSource.includes(token)) throw new Error(`table project-name nowrap styling is missing ${token}`)
  }
})

registerAssertion('global roadmap conflicts stay visible and actionable until resolved', () => {
  const alertPath = path.join(root, 'src/components/roadmap/RoadmapConflictAlert.tsx')
  const drawerSource = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapConflictDrawer.tsx'), 'utf8')
  const moduleSource = fs.readFileSync(path.join(root, 'src/components/roadmap/ProjectRoadmapModule.tsx'), 'utf8')
  const toolbarSource = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapToolbar.tsx'), 'utf8')
  if (fs.existsSync(alertPath) || moduleSource.includes('RoadmapConflictAlert')) {
    throw new Error('full-width conflict alert remains mounted')
  }
  for (const contract of ['查看正常项目', '删除待规划项目', 'selectedConflictKey', 'scrollIntoView']) {
    if (!drawerSource.includes(contract)) throw new Error(`conflict drawer is missing ${contract}`)
  }
  for (const contract of ['RoadmapConflictDrawer', 'openConflictDrawer', 'countConflictingPlannedProjects']) {
    if (!moduleSource.includes(contract)) throw new Error(`conflict integration is missing ${contract}`)
  }
  for (const contract of ['冲突', 'count={conflictCount}', 'onClick={onResolveConflicts}']) {
    if (!toolbarSource.includes(contract)) throw new Error(`compact conflict action is missing ${contract}`)
  }
  if (!moduleSource.includes('删除后，该待规划项目会立即从 tOS 路标中移除；修改记录仍保留删除前快照。确认删除？')) {
    throw new Error('planned deletion must use the approved shared confirmation copy')
  }
})

registerAssertion('roadmap change history filters, sorts, and renders fixed audit fields', () => {
  const logSource = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapChangeLogDrawer.tsx'), 'utf8')
  const moduleSource = fs.readFileSync(path.join(root, 'src/components/roadmap/ProjectRoadmapModule.tsx'), 'utf8')
  const logModule = loadTypeScriptModule(path.join(root, 'src/components/roadmap/RoadmapChangeLogDrawer.tsx'))
  const projectNameEntries = logModule.getRoadmapAuditDisplayEntries({
    action: 'update',
    projectDisplayName: 'CN7(Android 16)',
    changes: [{ field: 'projectCode', before: 'CN6', after: 'CN7' }],
  })
  if (projectNameEntries[0]?.before !== 'CN6(Android 16)' || projectNameEntries[0]?.after !== 'CN7(Android 16)') {
    throw new Error(`project-name audit lost its canonical Android suffix: ${JSON.stringify(projectNameEntries)}`)
  }
  for (const label of ['项目标识', '来源', '动作', '日期范围', '正常项目', '待规划项目', '创建', '修改', '删除']) {
    if (!logSource.includes(label)) throw new Error(`change log drawer is missing ${label}`)
  }
  for (const contract of ['ROADMAP_AUDIT_FIELDS', 'occurredAt', 'Pagination', '→']) {
    if (!logSource.includes(contract)) throw new Error(`change log drawer is missing ${contract}`)
  }
  if (!moduleSource.includes('RoadmapChangeLogDrawer') || !moduleSource.includes('changeLogs={changeLogs}')) {
    throw new Error('change log drawer is not connected to persisted roadmap logs')
  }
  for (const compactContract of [
    'CHANGE_LOG_FILTER_CONTROL_HEIGHT = 32',
    'pms-roadmap-change-log-filters-compact',
    'size="small"',
  ]) {
    if (!logSource.includes(compactContract)) throw new Error(`change log filters are missing compact contract ${compactContract}`)
  }
})

registerAssertion('roadmap filter conditions use one compact row per condition', () => {
  const source = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapFilterDrawer.tsx'), 'utf8')
  for (const contract of [
    'ROADMAP_FILTER_CONTROL_HEIGHT = 32',
    'conditionRowStyle',
    "gridTemplateColumns: 'minmax(108px, 1fr) minmax(86px, .8fr) minmax(132px, 1.2fr) 32px'",
    'pms-roadmap-filter-condition-row',
  ]) {
    if (!source.includes(contract)) throw new Error(`roadmap filter drawer is missing compact row contract ${contract}`)
  }
  if (source.includes('>值</Typography.Text>')) throw new Error('filter value label must not occupy a second row')
})

registerAssertion('rebuilt roadmap is mounted without legacy roadmap content', () => {
  const viewSource = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapView.tsx'), 'utf8')
  const pageSource = fs.readFileSync(path.join(root, 'src/app/page.tsx'), 'utf8')
  const moduleSource = fs.readFileSync(path.join(root, 'src/components/roadmap/ProjectRoadmapModule.tsx'), 'utf8')
  if (!viewSource.includes("import ProjectRoadmapModule from './ProjectRoadmapModule'")) {
    throw new Error('RoadmapView is missing the rebuilt module import')
  }
  if (!viewSource.includes('<ProjectRoadmapModule')) throw new Error('RoadmapView does not mount the rebuilt module')
  if (viewSource.includes('MilestoneView') || viewSource.includes('MRTrainView')) {
    throw new Error('legacy roadmap content returned to RoadmapView')
  }
  if (pageSource.includes('marketPlanData={marketPlanData}') || pageSource.includes('level1Tasks={LEVEL1_TASKS}')) {
    throw new Error('obsolete roadmap props are still passed from the page')
  }
  for (const contract of ['pms-roadmap-shell', 'RoadmapEvolutionView', 'RoadmapChangeLogDrawer']) {
    if (!moduleSource.includes(contract)) throw new Error(`rebuilt module is missing ${contract}`)
  }
})

registerAssertion('roadmap quick filters and drawer conditions share one source', () => {
  const filterModule = loadTypeScriptModule(path.join(root, 'src/lib/roadmapFilters.ts'))
  const brandEquals = filterModule.setRoadmapQuickFilter([], 'brand', 'TECNO')
  if (brandEquals.length !== 1 || brandEquals[0].operator !== 'equals'
    || JSON.stringify(brandEquals[0].value) !== JSON.stringify(['TECNO'])) {
    throw new Error('brand quick filter did not create an equals condition')
  }
  if (filterModule.getRoadmapQuickFilterValue(brandEquals, 'brand') !== 'TECNO') {
    throw new Error('drawer equals condition did not select the quick value')
  }
  const custom = [{ ...brandEquals[0], operator: 'notEquals' }]
  if (filterModule.getRoadmapQuickFilterValue(custom, 'brand') !== 'custom') {
    throw new Error('non-equals drawer condition did not expose custom state')
  }
  if (filterModule.setRoadmapQuickFilter(custom, 'brand', 'all').length !== 0) {
    throw new Error('quick all did not clear the drawer condition')
  }
  const nonQuickBrand = [{ ...brandEquals[0], value: ['待定'] }]
  if (filterModule.getRoadmapQuickFilterValue(nonQuickBrand, 'brand') !== 'custom') {
    throw new Error('brand values without an external shortcut must expose custom state')
  }
})

registerAssertion('table tOS selector and drawer tOS condition stay synchronized', () => {
  const storeModule = loadIsolatedRoadmapStore()
  const store = resetRoadmapStore(storeModule)
  if (store.getState().selectedTosVersionId !== null) {
    throw new Error('table did not default to the all-tOS scope')
  }
  store.getState().setSelectedTosVersionId('17.2')
  const selectorCondition = store.getState().filters.find(condition => condition.field === 'firstSaleTosVersionId')
  if (selectorCondition?.operator !== 'equals'
    || JSON.stringify(selectorCondition.value) !== JSON.stringify(['17.2'])) {
    throw new Error('table tOS selector did not update the drawer condition')
  }
  store.getState().setSelectedTosVersionId(null)
  if (store.getState().selectedTosVersionId !== null
    || store.getState().filters.some(condition => condition.field === 'firstSaleTosVersionId')) {
    throw new Error('all-tOS scope retained a version condition')
  }
  store.getState().setFilters([{
    id: 'drawer-tos',
    field: 'firstSaleTosVersionId',
    operator: 'equals',
    value: ['16.0', '17.2'],
  }])
  if (store.getState().selectedTosVersionId !== null) {
    throw new Error('multi-select drawer condition must not pretend the table has one selected version')
  }
  store.getState().setFilters([{
    id: 'drawer-single-tos',
    field: 'firstSaleTosVersionId',
    operator: 'equals',
    value: ['16.0'],
  }])
  if (store.getState().selectedTosVersionId !== '16.0') {
    throw new Error('single-value drawer tOS condition did not synchronize the table selector')
  }
  store.getState().setFilters([])
  if (store.getState().selectedTosVersionId !== null) {
    throw new Error('removing the drawer tOS condition did not restore all')
  }
  const moduleSource = fs.readFileSync(path.join(root, 'src/components/roadmap/ProjectRoadmapModule.tsx'), 'utf8')
  for (const contract of ['handleViewModeChange', "viewMode === 'table'", "nextViewMode === 'evolution'", "condition.field !== 'firstSaleTosVersionId'", 'setSelectedTosVersionId(null)']) {
    if (!moduleSource.includes(contract)) throw new Error(`table-to-evolution cleanup is missing ${contract}`)
  }
})

registerAssertion('persisted tOS selection repairs to all unless its concrete ID is valid', () => {
  const storeModule = loadIsolatedRoadmapStore()
  const initial = storeModule.createInitialRoadmapState()
  const persisted = storeModule.partializeRoadmapState(initial)
  const valid = storeModule.migrateRoadmapState({
    ...persisted,
    selectedTosVersionId: '17.2',
    filters: [],
  }, 1)
  const validCondition = valid.filters.find(condition => condition.field === 'firstSaleTosVersionId')
  if (valid.selectedTosVersionId !== '17.2'
    || validCondition?.operator !== 'equals'
    || JSON.stringify(validCondition.value) !== JSON.stringify(['17.2'])) {
    throw new Error('valid persisted concrete selection was not preserved and synchronized')
  }
  const evolutionMulti = storeModule.migrateRoadmapState({
    ...persisted,
    viewMode: 'evolution',
    selectedTosVersionId: null,
    filters: [{
      id: 'evolution-tos',
      field: 'firstSaleTosVersionId',
      operator: 'equals',
      value: ['16.0', '17.2'],
    }],
  }, 1)
  const evolutionCondition = evolutionMulti.filters.find(condition => condition.field === 'firstSaleTosVersionId')
  if (evolutionMulti.selectedTosVersionId !== null
    || JSON.stringify(evolutionCondition?.value) !== JSON.stringify(['16.0', '17.2'])) {
    throw new Error(`evolution multi-select filter was lost on reload: ${JSON.stringify(evolutionMulti)}`)
  }
  const roundTripStore = resetRoadmapStore(storeModule)
  roundTripStore.getState().setViewMode('evolution')
  roundTripStore.getState().setFilters([{
    id: 'round-trip-tos',
    field: 'firstSaleTosVersionId',
    operator: 'equals',
    value: ['16.0', '17.2'],
  }])
  roundTripStore.getState().setViewMode('table')
  const tableReload = storeModule.migrateRoadmapState(
    storeModule.partializeRoadmapState(roundTripStore.getState()),
    1,
  )
  const roundTripCondition = tableReload.filters.find(condition => condition.field === 'firstSaleTosVersionId')
  if (tableReload.viewMode !== 'table'
    || tableReload.selectedTosVersionId !== null
    || JSON.stringify(roundTripCondition?.value) !== JSON.stringify(['16.0', '17.2'])) {
    throw new Error(`evolution multi-select did not survive table reload: ${JSON.stringify(tableReload)}`)
  }

  for (const [name, overrides] of [
    ['invalid', { selectedTosVersionId: 'missing-version' }],
    ['metadata-missing', {
      selectedTosVersionId: '16.0',
      tosVersions: initial.tosVersions.filter(version => version.id !== '16.0'),
    }],
    ['missing', { selectedTosVersionId: undefined }],
  ]) {
    const migrated = storeModule.migrateRoadmapState({
      ...persisted,
      filters: [{ id: 'stale-version', field: 'firstSaleTosVersionId', operator: 'equals', value: '17.2' }],
      ...overrides,
    }, 1)
    const filter = migrated.filters.find(condition => condition.field === 'firstSaleTosVersionId')
    if (migrated.selectedTosVersionId !== '17.2'
      || JSON.stringify(filter?.value) !== JSON.stringify(['17.2'])) {
      throw new Error(`${name} persisted selection overrode the valid filter fact`)
    }
  }
  const invalidWithoutFilter = storeModule.migrateRoadmapState({
    ...persisted,
    selectedTosVersionId: 'missing-version',
    filters: [],
  }, 1)
  if (invalidWithoutFilter.selectedTosVersionId !== null
    || invalidWithoutFilter.filters.some(condition => condition.field === 'firstSaleTosVersionId')) {
    throw new Error('invalid persisted selection without a filter did not fall back to all')
  }
})

registerAssertion('table and evolution views keep the approved independent default columns', () => {
  const filterModule = loadTypeScriptModule(path.join(root, 'src/lib/roadmapFilters.ts'))
  const expectedTable = [
    'firstSaleTosVersionId', 'brand', 'productLine', 'marketName', 'displayName',
    'productType', 'platform', 'startRam', 'versionType', 'str5Date', 'launchDate',
    'developMode', 'remark',
  ]
  const expectedEvolution = [
    'marketName', 'displayName', 'platform', 'startRam', 'versionType', 'str5Date', 'launchDate', 'developMode',
  ]
  if (JSON.stringify(filterModule.DEFAULT_ROADMAP_TABLE_VISIBLE_COLUMNS) !== JSON.stringify(expectedTable)) {
    throw new Error('table default columns do not match the approved matrix')
  }
  if (JSON.stringify(filterModule.DEFAULT_ROADMAP_EVOLUTION_VISIBLE_COLUMNS) !== JSON.stringify(expectedEvolution)) {
    throw new Error('evolution default columns do not match the approved matrix')
  }
  const evolutionOrder = filterModule.DEFAULT_ROADMAP_EVOLUTION_COLUMN_ORDER
  if (evolutionOrder.indexOf('developMode') !== evolutionOrder.indexOf('versionType') + 1) {
    throw new Error('evolution development mode is not positioned directly after version type')
  }
  const storeModule = loadIsolatedRoadmapStore()
  const store = resetRoadmapStore(storeModule)
  store.getState().setVisibleColumns(['brand'])
  store.getState().setViewMode('evolution')
  if (JSON.stringify(store.getState().visibleColumns) !== JSON.stringify(expectedEvolution)) {
    throw new Error('evolution view did not retain its independent defaults')
  }
  store.getState().setVisibleColumns(['marketName'])
  if (JSON.stringify(store.getState().visibleColumns) !== JSON.stringify(expectedEvolution)) {
    throw new Error(`evolution direct column setter removed structural title fields: ${JSON.stringify(store.getState().visibleColumns)}`)
  }
  store.getState().setViewMode('table')
  if (JSON.stringify(store.getState().visibleColumns) !== JSON.stringify(['firstSaleTosVersionId', 'brand'])) {
    throw new Error('table view column customization was overwritten by evolution view')
  }
})

registerAssertion('roadmap migration canonicalizes locked evolution columns without changing table columns', () => {
  const storeModule = loadIsolatedRoadmapStore()
  const initial = storeModule.createInitialRoadmapState()
  const persisted = storeModule.partializeRoadmapState(initial)
  const migrated = storeModule.migrateRoadmapState({
    ...persisted,
    viewMode: 'evolution',
    visibleColumns: ['marketName'],
    visibleColumnsByView: {
      table: ['brand'],
      evolution: ['marketName'],
    },
  }, 1)
  const expectedEvolution = [
    'marketName', 'displayName', 'platform', 'startRam', 'versionType', 'str5Date', 'launchDate', 'developMode',
  ]
  if (JSON.stringify(migrated.visibleColumns) !== JSON.stringify(expectedEvolution)
    || JSON.stringify(migrated.visibleColumnsByView.evolution) !== JSON.stringify(expectedEvolution)) {
    throw new Error(`persisted evolution columns were not repaired with structural title fields: ${JSON.stringify({
      visibleColumns: migrated.visibleColumns,
      evolution: migrated.visibleColumnsByView.evolution,
    })}`)
  }
  if (JSON.stringify(migrated.visibleColumnsByView.table) !== JSON.stringify(['firstSaleTosVersionId', 'brand'])) {
    throw new Error('evolution migration changed table columns')
  }
})

registerAssertion('roadmap targets preserve raw text and expose collapse controls', () => {
  const editor = fs.readFileSync(path.join(root, 'src/components/roadmap/TosTargetEditor.tsx'), 'utf8')
  const table = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapTableView.tsx'), 'utf8')
  const evolution = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapEvolutionView.tsx'), 'utf8')
  const moduleSource = fs.readFileSync(path.join(root, 'src/components/roadmap/ProjectRoadmapModule.tsx'), 'utf8')
  if (!editor.includes('targetText') || editor.includes('<Form.List')) throw new Error('target editor is not one multiline field')
  for (const source of [table, evolution]) {
    if (!source.includes("whiteSpace: 'pre-wrap'") || !source.includes("targets.join('\\n')")) {
      throw new Error('target text is not rendered with original line breaks')
    }
    if (!source.includes('aria-expanded')) throw new Error('target section is missing accessible collapse state')
  }
  for (const token of ['collapsedTargetVersionIds', 'toggleAllTargets', 'allTargetsCollapsed']) {
    if (!moduleSource.includes(token)) throw new Error(`target collapse integration is missing ${token}`)
  }
  for (const contract of [
    'new Set(versions.filter(version => version.targets.length > 0).map(version => version.id))',
    'knownTargetVersionIdsRef',
    'newTargetIds.forEach(id => next.add(id))',
  ]) {
    if (!moduleSource.includes(contract)) throw new Error(`target default collapse is missing ${contract}`)
  }
})

registerAssertion('roadmap supports compact fullscreen controls', () => {
  const toolbar = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapToolbar.tsx'), 'utf8')
  const moduleSource = fs.readFileSync(path.join(root, 'src/components/roadmap/ProjectRoadmapModule.tsx'), 'utf8')
  const styles = fs.readFileSync(path.join(root, 'src/styles/globals.css'), 'utf8')
  for (const token of ['FullscreenOutlined', 'FullscreenExitOutlined', 'onToggleFullscreen', 'isFullscreen']) {
    if (!toolbar.includes(token)) throw new Error(`compact toolbar is missing ${token}`)
  }
  if (toolbar.includes('表单视图 tOS 版本')) throw new Error('table tOS selector still lives in the toolbar')
  if (!moduleSource.includes("event.key === 'Escape'") || !moduleSource.includes('pms-roadmap-shell-fullscreen')) {
    throw new Error('module fullscreen lifecycle is incomplete')
  }
  for (const token of ['requestFullscreen', 'fullscreenchange', 'document.exitFullscreen']) {
    if (!moduleSource.includes(token)) throw new Error(`native fullscreen lifecycle is missing ${token}`)
  }
  if (!toolbar.includes('data-roadmap-actions') || !toolbar.includes('wrap={false}')) {
    throw new Error('roadmap action buttons may wrap the fullscreen control onto a second row')
  }
  if (!styles.includes('.pms-roadmap-shell-fullscreen')) throw new Error('fullscreen shell styles are missing')
})

registerAssertion('roadmap table owns the tOS selector and fixed columns', () => {
  const table = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapTableView.tsx'), 'utf8')
  for (const token of ['<Select', '表单视图 tOS 版本', "fixed: column.key === 'firstSaleTosVersionId' ? 'left'", "fixed: 'right'"]) {
    if (!table.includes(token)) throw new Error(`roadmap table is missing ${token}`)
  }
  for (const contract of [
    "{ label: '全部', value: 'all' }",
    "value={selectedTosVersionId ?? 'all'}",
    "selectedId === 'all' ? null : selectedId",
    ': rows',
  ]) {
    if (!table.includes(contract)) throw new Error(`roadmap all-tOS table scope is missing ${contract}`)
  }
  if (table.indexOf("{ label: '全部', value: 'all' }") > table.indexOf('descendingVersions.map')) {
    throw new Error('all must be the first tOS selector option')
  }
  if (table.includes('>只读</Typography.Text>')) throw new Error('normal project action still renders read-only text')
})

registerAssertion('two-digit roadmap contracts stay canonical end to end', () => {
  const validation = loadTypeScriptModule(path.join(root, 'src/lib/roadmapValidation.ts'))
  const maintained = validation.normalizeTosVersionName('tOS 16.3')
  if (JSON.stringify(maintained) !== JSON.stringify({ name: 'tOS 16.3', major: 16, minor: 3 })) {
    throw new Error(`two-digit maintained version is not canonical: ${JSON.stringify(maintained)}`)
  }
  const legacyPatch = validation.normalizeLegacyTosVersionName('tOS 16.3.2')
  if (JSON.stringify(legacyPatch) !== JSON.stringify({ name: 'tOS 16.3', major: 16, minor: 3 })) {
    throw new Error(`legacy patch version does not collapse to major.minor: ${JSON.stringify(legacyPatch)}`)
  }
  const storeModule = loadIsolatedRoadmapStore()
  const migrated = storeModule.migrateRoadmapState({
    tosVersions: [
      {
        id: 'tos-15-1-0', name: 'tOS 15.1.0', targets: ['旧目标'],
        periodStartDate: '2026-01-01', periodEndDate: '2026-03-01',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'tos-15-1-2', name: 'tOS 15.1.2', targets: ['最新目标'],
        periodStartDate: '2026-02-01', periodEndDate: '2026-04-01',
        updatedAt: '2026-02-01T00:00:00.000Z',
      },
    ],
  }, 2)
  const collapsed = migrated.tosVersions.filter(version => version.major === 15 && version.minor === 1)
  if (
    collapsed.length !== 1
    || collapsed[0].id !== '15.1'
    || collapsed[0].targets[0] !== '最新目标'
    || collapsed[0].periodStartDate !== '2026-02-01'
    || collapsed[0].periodEndDate !== '2026-04-01'
  ) {
    throw new Error(`legacy maintained versions did not keep the latest two-digit config: ${JSON.stringify(collapsed)}`)
  }

  const types = fs.readFileSync(path.join(root, 'src/types/roadmap.ts'), 'utf8')
  if (!types.includes('launchEstimated: boolean')) throw new Error('launch estimate field is missing')
  if (types.includes('patch: number')) throw new Error('maintained tOS still exposes patch identity')

  const modal = fs.readFileSync(path.join(root, 'src/components/roadmap/PlannedProjectModal.tsx'), 'utf8')
  for (const token of ['label="tOS 版本"', 'name="launchEstimated"', 'valuePropName="checked"']) {
    if (!modal.includes(token)) throw new Error(`planned project modal is missing ${token}`)
  }

  const toolbar = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapToolbar.tsx'), 'utf8')
  for (const token of ['展开目标', '收起目标', '冲突', '记录', '创建项目']) {
    if (!toolbar.includes(token)) throw new Error(`compact tOS roadmap toolbar is missing ${token}`)
  }
  for (const oldText of ['展开全部目标', '收起全部目标', '修改记录', '创建待规划项目']) {
    if (toolbar.includes(oldText)) throw new Error(`compact toolbar still contains ${oldText}`)
  }

  const roadmapView = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapView.tsx'), 'utf8')
  if (!roadmapView.includes('tOS路标') || roadmapView.includes('项目计划汇总看板') || roadmapView.includes('PROJECT_VIEW_OPTIONS')) {
    throw new Error('roadmap surface is not a single tOS roadmap entry')
  }

  const card = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapProjectCard.tsx'), 'utf8')
  if (!card.includes('row.marketName?.trim()') || card.includes('pms-roadmap-evolution-source-tag')) {
    throw new Error('evolution card title/source layout is stale')
  }
  if (!card.includes("column.key === 'launchDate' && row.launchEstimated")) {
    throw new Error('evolution card does not render launch estimate')
  }
  const table = fs.readFileSync(path.join(root, 'src/components/roadmap/RoadmapTableView.tsx'), 'utf8')
  if (!table.includes("column.key === 'launchDate' && row.launchEstimated")) {
    throw new Error('table does not render launch estimate')
  }

  const filters = loadTypeScriptModule(path.join(root, 'src/lib/roadmapFilters.ts'))
  if (filters.DEFAULT_ROADMAP_EVOLUTION_VISIBLE_COLUMNS.includes('productLine')) {
    throw new Error('product line must be disabled by default in evolution view')
  }
})

registerAssertion('roadmap tOS values normalize persistence while preserving historical display strings', () => {
  const validation = loadTypeScriptModule(path.join(root, 'src/lib/roadmapValidation.ts'))
  for (const [input, expected] of [
    ['17.2', '17.2'],
    [' tOS17.2 ', '17.2'],
    ['TOS 17.2', '17.2'],
    ['legacy-beta', 'legacy-beta'],
    ['', ''],
  ]) {
    const actual = validation.normalizeRoadmapTosValue(input)
    if (actual !== expected) throw new Error(`${input} normalized to ${actual}, expected ${expected}`)
  }
  for (const [input, expected] of [
    ['17.2', 'tOS17.2'],
    ['tOS17.2', 'tOS17.2'],
    ['legacy-beta', 'tOSlegacy-beta'],
    ['', '-'],
  ]) {
    const actual = validation.formatRoadmapTosValue(input)
    if (actual !== expected) throw new Error(`${input} displayed as ${actual}, expected ${expected}`)
  }
  const current = validation.buildRoadmapTosSelectOptions(['17.2', '18.0'])
  if (JSON.stringify(current) !== JSON.stringify([
    { label: 'tOS17.2', value: '17.2' },
    { label: 'tOS18.0', value: '18.0' },
  ])) throw new Error(`current enum options are wrong: ${JSON.stringify(current)}`)
  const orphan = validation.buildRoadmapTosSelectOptions(['17.2'], '16.3')
  if (JSON.stringify(orphan) !== JSON.stringify([
    { label: 'tOS16.3（已停用）', value: '16.3', disabled: true },
    { label: 'tOS17.2', value: '17.2' },
  ])) throw new Error(`historical orphan option is wrong: ${JSON.stringify(orphan)}`)
  const compatibilityDirectory = [
    { id: 'tos-17-2', name: 'tOS 17.2', major: 17, minor: 2 },
  ]
  if (validation.normalizeRoadmapTosReference('tos-17-2', compatibilityDirectory) !== '17.2') {
    throw new Error('legacy stable ID did not migrate through the compatibility directory')
  }
  if (validation.normalizeRoadmapTosReference('tOS16.3', compatibilityDirectory) !== '16.3') {
    throw new Error('prefixed two-part value was not normalized for persistence')
  }
  if (validation.normalizeRoadmapTosReference('retired-beta', compatibilityDirectory) !== 'retired-beta') {
    throw new Error('unrecognized historical text was cleared or rewritten')
  }
  const storeModule = loadIsolatedRoadmapStore()
  const initial = storeModule.createInitialRoadmapState()
  const baseProject = {
    ...createPlannedInput(),
    id: 'legacy-enum-project',
    displayName: 'stale',
    status: '待规划',
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: '甲',
    updatedAt: '2026-01-02T00:00:00.000Z',
    updatedBy: '乙',
  }
  const migrated = storeModule.migrateRoadmapState({
    ...storeModule.partializeRoadmapState(initial),
    tosVersions: [{
      ...compatibilityDirectory[0],
      periodStartDate: '2026-02-01',
      periodEndDate: '2026-03-01',
      targets: ['legacy target'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    }],
    plannedProjects: [
      { ...baseProject, firstSaleTosVersionId: 'tos-17-2' },
      { ...baseProject, id: 'orphan-format', projectCode: 'X7001', firstSaleTosVersionId: 'tOS16.3' },
      { ...baseProject, id: 'orphan-text', projectCode: 'X7002', firstSaleTosVersionId: 'retired-beta' },
    ],
    changeLogs: [],
  }, 5)
  if (migrated.plannedProjects.map(project => project.firstSaleTosVersionId).join(',') !== '17.2,16.3,retired-beta') {
    throw new Error(`business values were not migrated without data loss: ${JSON.stringify(migrated.plannedProjects)}`)
  }
  const migratedMetadata = migrated.tosVersions.find(version => version.id === '17.2')
  if (migratedMetadata?.targets[0] !== 'legacy target' || migratedMetadata.periodStartDate !== '2026-02-01') {
    throw new Error(`legacy metadata association was lost: ${JSON.stringify(migrated.tosVersions)}`)
  }
})

registerAssertion('roadmap defers enum policy until hydration and preserves saved orphan filters', () => {
  const storeModule = loadIsolatedRoadmapStore()
  const initial = storeModule.createInitialRoadmapState()
  const orphanFilter = {
    id: 'saved-orphan-filter',
    field: 'firstSaleTosVersionId',
    operator: 'equals',
    value: ['tos-19-4'],
  }
  const migrated = storeModule.migrateRoadmapState({
    ...storeModule.partializeRoadmapState(initial),
    plannedProjects: [],
    changeLogs: [],
    selectedTosVersionId: 'tos-19-4',
    filters: [orphanFilter],
  }, 6)
  if (migrated.selectedTosVersionId !== '19.4') {
    throw new Error(`migration cleared the not-yet-hydrated selection: ${migrated.selectedTosVersionId}`)
  }
  const migratedValues = migrated.filters.find(filter => filter.field === 'firstSaleTosVersionId')?.value
  if (JSON.stringify(migratedValues) !== JSON.stringify(['19.4'])) {
    throw new Error(`migration cleared the not-yet-hydrated filter: ${JSON.stringify(migrated.filters)}`)
  }

  const filtersModule = loadTypeScriptModule(path.join(root, 'src/lib/roadmapFilters.ts'))
  const versions = [
    { id: '17.2', name: 'tOS17.2', major: 17, minor: 2, selectable: true },
    { id: '16.3', name: 'tOS16.3', major: 16, minor: 3, selectable: false },
  ]
  const sanitized = filtersModule.sanitizeRoadmapFilterConditions([orphanFilter], versions)
  const savedValues = filtersModule.getRoadmapSelectedTosVersionIds(sanitized)
  if (JSON.stringify(savedValues) !== JSON.stringify(['19.4'])) {
    throw new Error(`runtime sanitizer deleted the saved orphan: ${JSON.stringify(sanitized)}`)
  }
  const tosDefinition = filtersModule.buildRoadmapFilterFieldDefinitions(versions, savedValues)
    .find(definition => definition.key === 'firstSaleTosVersionId')
  if (JSON.stringify(tosDefinition?.options) !== JSON.stringify([
    { label: 'tOS19.4（已停用）', value: '19.4', disabled: true },
    { label: 'tOS17.2', value: '17.2' },
  ])) {
    throw new Error(`filter options leaked unrelated history or lost the saved orphan: ${JSON.stringify(tosDefinition?.options)}`)
  }

  const moduleSource = fs.readFileSync(path.join(root, 'src/components/roadmap/ProjectRoadmapModule.tsx'), 'utf8')
  for (const token of ['useTosEnumOptions', 'hasHydrated', 'hydrationError', '正在加载 tOS 版本配置', '加载 tOS 版本配置失败', '前往枚举配置恢复']) {
    if (!moduleSource.includes(token)) throw new Error(`roadmap hydration UX is missing ${token}`)
  }
})

registerAssertion('roadmap tOS maintenance routes to the shared two-part enum configuration', () => {
  const moduleSource = fs.readFileSync(path.join(root, 'src/components/roadmap/ProjectRoadmapModule.tsx'), 'utf8')
  for (const token of [
    'useEnumStore',
    "useTosEnumOptions('tos-2-part'",
    'navigateWithEditGuard',
    "setSelectedType('tos-2-part')",
    "setConfigTab('enum')",
    "setActiveModule('config')",
  ]) {
    if (!moduleSource.includes(token)) throw new Error(`shared enum navigation is missing ${token}`)
  }
  if (moduleSource.includes('setTosMaintenanceOpen(true)')) {
    throw new Error('roadmap still opens an independent tOS directory')
  }
  const plannedModalSource = fs.readFileSync(path.join(root, 'src/components/roadmap/PlannedProjectModal.tsx'), 'utf8')
  for (const token of ['buildRoadmapTosSelectOptions', '（已停用）', 'disabled']) {
    if (!plannedModalSource.includes(token)) throw new Error(`planned-project orphan display is missing ${token}`)
  }
  for (const token of ['forceRender', 'form.setFieldsValue(nextValues)', 'clearDraftAndClose']) {
    if (!plannedModalSource.includes(token)) throw new Error(`planned-project create/edit lifecycle is missing ${token}`)
  }
})

const focus = process.env.ROADMAP_VERIFY_FOCUS?.trim()
const selectedAssertions = focus
  ? assertions.filter(({ name }) => name.includes(focus))
  : assertions
if (focus && !selectedAssertions.length) {
  console.error(`FAIL no roadmap assertions matched focus: ${focus}`)
  process.exit(1)
}

const failures = []
for (const { name, assertion } of selectedAssertions) {
  try {
    assertion()
    console.log(`PASS ${name}`)
  } catch (error) {
    failures.push({ name, error })
    console.error(`FAIL ${name}: ${error.message}`)
  }
}

if (failures.length) process.exit(1)

console.log(`Project roadmap baseline verification passed (${selectedAssertions.length} assertions).`)
