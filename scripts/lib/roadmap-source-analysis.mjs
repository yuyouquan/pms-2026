import ts from 'typescript'

const LEGACY_COMPONENTS = new Set(['MilestoneView', 'MRTrainView'])
const ROADMAP_MODULE = 'ProjectRoadmapModule'
const PROJECT_VIEW_OPTION_LABELS = new Set(['项目计划汇总看板', '项目路标视图'])

function getPropertyName(property) {
  return ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)
    ? property.name.text
    : undefined
}

function getTagName(tagName) {
  return ts.isIdentifier(tagName) ? tagName.text : undefined
}

function isLegacyModulePath(modulePath) {
  const normalizedPath = modulePath.replace(/\.(?:ts|tsx|js|jsx)$/, '')
  return [...LEGACY_COMPONENTS].some(component => (
    normalizedPath === `./${component}`
    || normalizedPath === `@/components/roadmap/${component}`
  ))
}

function isProjectRoadmapModulePath(modulePath) {
  const normalizedPath = modulePath.replace(/\.(?:ts|tsx|js|jsx)$/, '')
  return normalizedPath === `./${ROADMAP_MODULE}`
    || normalizedPath === `@/components/roadmap/${ROADMAP_MODULE}`
}

function isSummaryConditional(node) {
  return ts.isConditionalExpression(node)
    && ts.isBinaryExpression(node.condition)
    && node.condition.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken
    && ts.isIdentifier(node.condition.left)
    && node.condition.left.text === 'activeProjectView'
    && ts.isStringLiteral(node.condition.right)
    && node.condition.right.text === 'summary'
}

function containsJsxTag(node, tagNames) {
  let found = false
  const visit = current => {
    if ((ts.isJsxOpeningElement(current) || ts.isJsxSelfClosingElement(current))
      && tagNames.has(getTagName(current.tagName))) {
      found = true
    }
    if (!found) ts.forEachChild(current, visit)
  }
  visit(node)
  return found
}

function collectProjectViewOptionLabels(sourceFile) {
  const labels = new Set()
  const visit = node => {
    if (ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.name.text === 'PROJECT_VIEW_OPTIONS'
      && node.initializer
      && ts.isArrayLiteralExpression(node.initializer)) {
      for (const element of node.initializer.elements) {
        if (!ts.isObjectLiteralExpression(element)) continue
        for (const property of element.properties) {
          if (ts.isPropertyAssignment(property)
            && getPropertyName(property) === 'label'
            && ts.isStringLiteral(property.initializer)) {
            labels.add(property.initializer.text)
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return labels
}

export function analyzeRoadmapSource(source, fileName = 'RoadmapView.tsx') {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const legacyImports = []
  const legacyJsxMounts = []
  const legacyLocalNames = new Set(LEGACY_COMPONENTS)
  const roadmapModuleLocalNames = new Set([ROADMAP_MODULE])
  let hasProjectRoadmapImport = false
  const headerTexts = new Set()
  const summaryConditionals = []

  const collect = node => {
    if (ts.isImportDeclaration(node)
      && ts.isStringLiteral(node.moduleSpecifier)
      && isLegacyModulePath(node.moduleSpecifier.text)) {
      legacyImports.push(node.moduleSpecifier.text)
      if (node.importClause?.name) legacyLocalNames.add(node.importClause.name.text)
    }
    if (ts.isImportDeclaration(node)
      && ts.isStringLiteral(node.moduleSpecifier)
      && isProjectRoadmapModulePath(node.moduleSpecifier.text)) {
      hasProjectRoadmapImport = true
      if (node.importClause?.name) roadmapModuleLocalNames.add(node.importClause.name.text)
    }
    if (ts.isJsxText(node) && node.text.trim()) headerTexts.add(node.text.trim())
    if (isSummaryConditional(node)) {
      summaryConditionals.push({
        mountsSummaryBoard: containsJsxTag(node.whenTrue, new Set(['ProjectPlanSummaryBoard'])),
        mountsProjectRoadmapModule: containsJsxTag(node.whenFalse, roadmapModuleLocalNames),
        hasNullFalseBranch: node.whenFalse.kind === ts.SyntaxKind.NullKeyword,
      })
    }
    ts.forEachChild(node, collect)
  }
  collect(sourceFile)

  const collectJsx = node => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
      && legacyLocalNames.has(getTagName(node.tagName))) {
      legacyJsxMounts.push(getTagName(node.tagName))
    }
    ts.forEachChild(node, collectJsx)
  }
  collectJsx(sourceFile)

  const projectViewOptionLabels = collectProjectViewOptionLabels(sourceFile)
  return {
    legacyImports,
    legacyJsxMounts,
    hasProjectViewHeader: headerTexts.has('项目视图'),
    hasProjectViewOptionLabels: [...PROJECT_VIEW_OPTION_LABELS].every(label => projectViewOptionLabels.has(label)),
    hasProjectRoadmapImport,
    summaryConditionals,
  }
}

export function getRoadmapAnalysisFixtureFailures() {
  const failures = []
  const legacyFixtures = [
    ['alias path', 'import LegacyMilestone from "@/components/roadmap/MilestoneView"\nconst view = <LegacyMilestone />'],
    ['explicit extension', 'import LegacyTrain from "./MRTrainView.tsx"\nconst view = <LegacyTrain />'],
    ['multiline import', 'import\n  LegacyMilestone\nfrom\n  "./MilestoneView"\nconst view = <LegacyMilestone />'],
  ]

  for (const [name, source] of legacyFixtures) {
    const analysis = analyzeRoadmapSource(source, `${name}.tsx`)
    if (analysis.legacyImports.length !== 1 || analysis.legacyJsxMounts.length !== 1) {
      failures.push(`${name} fixture was not detected`)
    }
  }

  const commentedAnalysis = analyzeRoadmapSource('// import LegacyMilestone from "./MilestoneView"\n// const view = <LegacyMilestone />')
  if (commentedAnalysis.legacyImports.length || commentedAnalysis.legacyJsxMounts.length) {
    failures.push('commented legacy code was incorrectly detected')
  }

  const wrongRoadmapBranch = analyzeRoadmapSource("const view = activeProjectView === 'summary' ? <ProjectPlanSummaryBoard /> : <RoadmapPlaceholder />")
  if (wrongRoadmapBranch.summaryConditionals.length !== 1
    || wrongRoadmapBranch.summaryConditionals[0].mountsProjectRoadmapModule) {
    failures.push('wrong populated roadmap branch was not rejected')
  }

  const rebuiltRoadmapBranch = analyzeRoadmapSource("import RebuiltRoadmap from './ProjectRoadmapModule.tsx'\nconst view = activeProjectView === 'summary' ? <ProjectPlanSummaryBoard /> : <RebuiltRoadmap />")
  if (!rebuiltRoadmapBranch.hasProjectRoadmapImport
    || !rebuiltRoadmapBranch.summaryConditionals[0]?.mountsProjectRoadmapModule) {
    failures.push('rebuilt roadmap branch fixture was not detected')
  }

  return failures
}
