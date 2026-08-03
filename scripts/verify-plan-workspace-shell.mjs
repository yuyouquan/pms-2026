#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import { loadTypeScriptModule, projectRoot, readSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const workspacePath = 'src/lib/planWorkspace.ts'
assert.equal(fs.existsSync(`${root}/${workspacePath}`), true, 'shared plan-workspace rules exist')

const workspace = loadTypeScriptModule(root, workspacePath)
assert.equal(workspace.normalizePlanViewMode('horizontal', true), 'vertical', 'disabled horizontal view normalizes to vertical')
assert.equal(workspace.normalizePlanViewMode('horizontal', false), 'horizontal', 'enabled horizontal view is preserved')
assert.equal(workspace.normalizePlanViewMode('gantt', true), 'gantt', 'gantt view is preserved')

const tasks = [
  { id: '2', order: 2, taskName: '开发阶段', status: '未开始', progress: 0 },
  { id: '2.2', parentId: '2', order: 2, taskName: 'PDCP', responsible: '李四', status: '未开始', progress: 0 },
  { id: '1', order: 1, taskName: '概念阶段', status: '未开始', progress: 0 },
  { id: '1.2', parentId: '1', order: 2, taskName: 'CDCP', responsible: '李四', status: '未开始', progress: 0 },
  { id: '1.1', parentId: '1', order: 1, taskName: 'STR1', responsible: '张三', status: '未开始', progress: 0 },
]

assert.deepEqual(
  workspace.filterPlanTasksByCollapsed(tasks, new Set(['1'])).map(task => task.id),
  ['2', '2.2', '1'],
  'collapsed phases hide all descendants while preserving source row order',
)
assert.deepEqual(
  workspace.applyPlanWorkspaceFilters(tasks, [{ id: 'filter-1', field: 'responsible', operator: 'contains', value: '李' }]).map(task => task.id),
  ['2.2', '1.2'],
  'shared plan filtering keeps existing all-active-conditions semantics',
)

const stageGroups = workspace.buildPlanHorizontalStageGroups(tasks)
assert.deepEqual(stageGroups.map(group => [group.stage.id, group.milestones.map(task => task.id), group.colSpan]), [
  ['1', ['1.1', '1.2'], 2],
  ['2', ['2.2'], 1],
], 'horizontal plan groups primary phases and sorted secondary milestones')
assert.deepEqual(
  workspace.buildPlanHorizontalMilestones(stageGroups).map(task => task.id),
  ['1.1', '1.2', '2.2'],
  'horizontal milestone columns flatten in phase and milestone order',
)

const parseTsx = (source, fileName) => ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const hasExport = (sourceFile, name) => sourceFile.statements.some(statement => {
  const exported = statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)
  if (!exported) return false
  if (ts.isFunctionDeclaration(statement)) return statement.name?.text === name
  if (ts.isVariableStatement(statement)) return statement.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === name)
  return false
})
const visits = (node, predicate) => {
  if (predicate(node)) return true
  let found = false
  ts.forEachChild(node, child => { if (!found) found = visits(child, predicate) })
  return found
}
const importsAndMounts = (sourceFile, name, modulePath) => {
  const imported = sourceFile.statements.some(statement => ts.isImportDeclaration(statement)
    && ts.isStringLiteral(statement.moduleSpecifier)
    && statement.moduleSpecifier.text === modulePath
    && statement.importClause?.namedBindings
    && ts.isNamedImports(statement.importClause.namedBindings)
    && statement.importClause.namedBindings.elements.some(element => element.name.text === name))
  const mounted = visits(sourceFile, node => (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(sourceFile) === name)
  return imported && mounted
}

const shellSource = readSource(root, 'src/components/plans/PlanWorkspaceShell.tsx')
const shellFile = parseTsx(shellSource, 'PlanWorkspaceShell.tsx')
assert.equal(hasExport(shellFile, 'PlanWorkspaceShell'), true, 'shared shell exports a real React component')
for (const prop of ['scopeTabs', 'notices', 'versionControls', 'primaryActions', 'utilityActions', 'viewMode', 'onViewModeChange', 'horizontalDisabled', 'children']) {
  assert.match(shellSource, new RegExp(`\\b${prop}\\b`), `shared shell declares and consumes ${prop}`)
}
for (const label of ['计划作用域', '计划版本操作', '计划工具', '计划内容']) {
  assert.match(shellSource, new RegExp(`aria-label=[{]?['\"]${label}`), `shared shell exposes stable aria label ${label}`)
}
assert.equal(hasExport(parseTsx(readSource(root, 'src/components/plans/PlanViewModeSwitcher.tsx'), 'PlanViewModeSwitcher.tsx'), 'PlanViewModeSwitcher'), true, 'view switcher is exported')
assert.equal(hasExport(parseTsx(readSource(root, 'src/components/plans/PlanVersionCompareModal.tsx'), 'PlanVersionCompareModal.tsx'), 'PlanVersionCompareModal'), true, 'version compare modal is exported')

const projectSpaceFile = parseTsx(readSource(root, 'src/containers/ProjectSpaceContainer.tsx'), 'ProjectSpaceContainer.tsx')
assert.equal(importsAndMounts(projectSpaceFile, 'PlanWorkspaceShell', '@/components/plans/PlanWorkspaceShell'), true, 'whole-machine plan imports and mounts the canonical shared shell')

console.log('plan workspace shell contract passed')
