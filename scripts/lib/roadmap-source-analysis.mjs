import ts from 'typescript'

const LEGACY_COMPONENTS = new Set(['MilestoneView', 'MRTrainView'])
const ROADMAP_MODULE = 'ProjectRoadmapModule'
const SUMMARY_BOARD = 'ProjectPlanSummaryBoard'

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

export function analyzeRoadmapSource(source, fileName = 'RoadmapView.tsx') {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const legacyImports = []
  const legacyJsxMounts = []
  const legacyLocalNames = new Set(LEGACY_COMPONENTS)
  const roadmapModuleLocalNames = new Set([ROADMAP_MODULE])
  const summaryBoardLocalNames = new Set([SUMMARY_BOARD])
  let hasProjectRoadmapImport = false
  let importsSummaryBoard = false
  const headerTexts = new Set()

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
    if (ts.isImportDeclaration(node)
      && ts.isStringLiteral(node.moduleSpecifier)
      && node.moduleSpecifier.text.replace(/\.(?:ts|tsx|js|jsx)$/, '') === `./${SUMMARY_BOARD}`) {
      importsSummaryBoard = true
      if (node.importClause?.name) summaryBoardLocalNames.add(node.importClause.name.text)
    }
    if (ts.isJsxText(node) && node.text.trim()) headerTexts.add(node.text.trim())
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

  return {
    legacyImports,
    legacyJsxMounts,
    hasTosRoadmapHeader: headerTexts.has('tOS路标'),
    hasProjectRoadmapImport,
    mountsProjectRoadmapModule: containsJsxTag(sourceFile, roadmapModuleLocalNames),
    importsSummaryBoard,
    mountsSummaryBoard: containsJsxTag(sourceFile, summaryBoardLocalNames),
    hasProjectViewSwitcher: source.includes('PROJECT_VIEW_OPTIONS')
      || source.includes('activeProjectView')
      || source.includes('项目计划汇总看板')
      || source.includes('tOS 路标视图'),
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

  const rebuiltRoadmap = analyzeRoadmapSource("import RebuiltRoadmap from './ProjectRoadmapModule.tsx'\nconst view = <RebuiltRoadmap />")
  if (!rebuiltRoadmap.hasProjectRoadmapImport || !rebuiltRoadmap.mountsProjectRoadmapModule) {
    failures.push('rebuilt roadmap fixture was not detected')
  }

  const staleSwitcher = analyzeRoadmapSource("import ProjectPlanSummaryBoard from './ProjectPlanSummaryBoard'\nconst PROJECT_VIEW_OPTIONS = []\nconst view = <ProjectPlanSummaryBoard />")
  if (!staleSwitcher.importsSummaryBoard || !staleSwitcher.mountsSummaryBoard || !staleSwitcher.hasProjectViewSwitcher) {
    failures.push('stale project-view switcher fixture was not detected')
  }

  return failures
}
