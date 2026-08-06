#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import { loadTypeScriptModule, projectRoot, readSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const rules = loadTypeScriptModule(root, 'src/lib/technicalPlanRules.ts')
assert.deepEqual(rules.TDT_TEMPLATE_SEED, [['规划阶段', ['规划启动', 'charter DCP']], ['概念阶段', ['TDR1']], ['计划阶段', ['TDR2', 'PDCP']], ['开发验证阶段', ['TDR3_X', 'TDCP_X']], ['迁移阶段', ['TDR4', 'EDCP']]], 'TDT seed is complete and ordered')
assert.deepEqual(rules.SUBPROJECT_TEMPLATE_SEED, ['第1版转测', '第2版转测', '第X版转测', 'TDR3'], 'subproject seed is ordered')
assert.throws(() => rules.validateTechnicalTemplateDepth('tdt', [{ children: [{ children: [{ children: [] }] }] }]), /depth/i)
assert.throws(() => rules.validateTechnicalTemplateDepth('subproject', [{ children: [{}] }]), /child/i)

const tdtTasks = rules.buildTdtTemplateTasks()
assert.deepEqual(
  tdtTasks.map(task => task.id),
  ['1', '1.1', '1.2', '2', '2.1', '3', '3.1', '3.2', '4', '4.1', '4.2', '5', '5.1', '5.2'],
  'TDT template uses the same hierarchical numeric numbering as whole-machine templates',
)
assert.deepEqual(tdtTasks.filter(task => !task.parentId).map(task => task.taskName), rules.TDT_TEMPLATE_SEED.map(([name]) => name), 'TDT phases use exact order')
for (const [phase, children] of rules.TDT_TEMPLATE_SEED) {
  const parent = tdtTasks.find(task => task.taskName === phase)
  assert.ok(parent, `TDT phase ${phase} exists`)
  assert.deepEqual(tdtTasks.filter(task => task.parentId === parent.id).map(task => task.taskName), children, `${phase} children and order are exact`)
}
assert.equal(rules.validateTechnicalTemplateDepth('tdt', tdtTasks), true, 'TDT seed is valid')

const subprojectTasks = rules.buildSubprojectTemplateTasks()
assert.deepEqual(subprojectTasks.map(task => task.id), ['1', '2', '3', '4'], 'subproject template uses numeric root numbering')
assert.deepEqual(subprojectTasks.map(task => task.taskName), rules.SUBPROJECT_TEMPLATE_SEED, 'subproject seed task order is exact')
assert.ok(subprojectTasks.every(task => !task.parentId), 'subproject seed is single-level')
assert.equal(rules.validateTechnicalTemplateDepth('subproject', subprojectTasks), true, 'subproject seed is valid')

const renumberedLegacyTasks = rules.renumberTechnicalTasks([
  { id: 'legacy-parent', order: 1, taskName: '父任务', predecessor: '' },
  { id: 'legacy-child-a', parentId: 'legacy-parent', order: 1, taskName: '子任务A', predecessor: '' },
  { id: 'legacy-child-b', parentId: 'legacy-parent', order: 2, taskName: '子任务B', predecessor: 'legacy-child-a' },
])
assert.deepEqual(renumberedLegacyTasks.map(task => task.id), ['1', '1.1', '1.2'], 'legacy technical IDs are migrated to hierarchical numeric IDs')
assert.equal(renumberedLegacyTasks[2].predecessor, '1.1', 'predecessor references follow migrated task numbering')

const nontechnical = [{ id: 'keep', taskName: '保留原模板' }]
const migrated = rules.migrateTechnicalTemplateState({
  configTemplateTasksByType: {
    整机产品项目: nontechnical,
    技术项目: [{ id: 'legacy' }],
    '技术项目::一级计划': [{ id: 'legacy-l1' }],
  },
  publishedSnapshots: {
    'template::整机产品项目::level1::v3': nontechnical,
    'template::技术项目::level1::v3': [{ id: 'legacy-snapshot' }],
  },
  untouched: { value: 1 },
})
assert.strictEqual(migrated.configTemplateTasksByType.整机产品项目, nontechnical, 'migration preserves nontechnical template reference')
assert.deepEqual(migrated.untouched, { value: 1 }, 'migration preserves unrelated persisted state')
assert.deepEqual(migrated.configTemplateTasksByType[rules.TECHNICAL_TEMPLATE_STORAGE_KEYS.tdt], tdtTasks, 'migration resets legacy technical TDT template')
assert.deepEqual(migrated.configTemplateTasksByType[rules.TECHNICAL_TEMPLATE_STORAGE_KEYS.subproject], subprojectTasks, 'migration resets legacy technical subproject template')
assert.deepEqual(migrated.configTemplateTasksByType.技术项目, tdtTasks, 'migration resets legacy technical compatibility key to TDT seed')
assert.equal(migrated.configTemplateTasksByType['技术项目::一级计划'], undefined, 'migration removes legacy technical level key')
assert.strictEqual(migrated.publishedSnapshots['template::整机产品项目::level1::v3'], nontechnical, 'migration preserves nontechnical snapshots')
assert.deepEqual(migrated.publishedSnapshots['template::技术项目::tdt::v3'], tdtTasks, 'migration replaces legacy technical TDT snapshot')
assert.deepEqual(migrated.publishedSnapshots['template::技术项目::subproject::v3'], subprojectTasks, 'migration replaces legacy technical subproject snapshot')
assert.deepEqual(migrated.publishedSnapshots['template::技术项目::level1::v3'], tdtTasks, 'migration resets legacy technical compatibility snapshot')

const planSource = readSource(root, 'src/stores/plan.ts')
const configSource = readSource(root, 'src/containers/ConfigContainer.tsx')
assert.match(planSource, /PLAN_STORE_VERSION\s*=\s*\d+/, 'plan store declares a persistence version')
assert.ok(Number(planSource.match(/PLAN_STORE_VERSION\s*=\s*(\d+)/)?.[1]) >= 3, 'plan store migrates persisted technical template numbering')
assert.match(planSource, /setTechnicalTemplateTasks/, 'plan store exposes a validating technical-template setter')
assert.match(planSource, /validateTechnicalTemplateDepth/, 'plan store enforces technical template depth')
assert.doesNotMatch(configSource, /publishedSnapshots\[versionId\]/, 'config snapshots never fall back across template scopes')
assert.match(configSource, /title:\s*['"]序号['"]/, 'technical templates use the shared numbered task table')
assert.match(configSource, /技术项目负责人/, 'technical template role selector includes the technical project owner role')
assert.match(configSource, /创建非正式版本/, 'config template revisions offer nonformal versions')
assert.match(configSource, /创建正式版本/, 'config template revisions offer formal versions')

const technicalPlanUiSource = readSource(root, 'src/components/technical-project/TechnicalPlanModule.tsx')
assert.match(technicalPlanUiSource, /创建非正式版本/, 'technical project plans offer nonformal revisions')
assert.match(technicalPlanUiSource, /创建正式版本/, 'technical project plans offer formal revisions')
assert.match(technicalPlanUiSource, /revisionKind/, 'technical project plan passes revision kind into its store')

const memoryStorage = new Map()
globalThis.localStorage = {
  getItem: key => memoryStorage.get(key) ?? null,
  setItem: (key, value) => memoryStorage.set(key, value),
  removeItem: key => memoryStorage.delete(key),
}
const planModule = loadTypeScriptModule(root, 'src/stores/plan.ts')
const planStore = planModule.usePlanStore
const tdtScope = rules.getTemplateConfigScopeKey('技术项目', 'tdt')
const subprojectScope = rules.getTemplateConfigScopeKey('技术项目', 'subproject')
const tdtInitial = planStore.getState().configTemplateVersionScopes[tdtScope]
const subprojectInitial = planStore.getState().configTemplateVersionScopes[subprojectScope]
assert.ok(tdtInitial && subprojectInitial, 'both technical template version scopes are seeded')
assert.notStrictEqual(tdtInitial.versions, subprojectInitial.versions, 'technical tabs do not share version arrays')

planStore.getState().setConfigTemplateVersions(tdtScope, previous => [
  ...previous,
  { id: 'v-tdt-only', versionNo: 'V-TDT', status: '修订中' },
])
assert.equal(planStore.getState().setConfigTemplateCurrentVersion(tdtScope, 'v-tdt-only'), true, 'TDT can select its own revision')
assert.equal(planStore.getState().setConfigTemplateCurrentVersion(subprojectScope, 'v-tdt-only'), false, 'subproject rejects a nonexistent TDT version')
assert.equal(planStore.getState().configTemplateVersionScopes[subprojectScope].versions.some(version => version.id === 'v-tdt-only'), false, 'TDT revision never appears in subproject')

planStore.getState().setConfigTemplateVersions(subprojectScope, previous => [
  ...previous,
  { id: 'v-subproject-only', versionNo: 'V-SUB', status: '修订中' },
])
assert.equal(planStore.getState().setConfigTemplateCurrentVersion(subprojectScope, 'v-subproject-only'), true, 'subproject can select its own revision')
planStore.getState().setConfigTemplateVersions(tdtScope, previous => previous.map(version => (
  version.id === 'v-tdt-only' ? { ...version, status: '已发布' } : version
)))
planStore.getState().setConfigTemplateVersions(subprojectScope, previous => previous.map(version => (
  version.id === 'v-subproject-only' ? { ...version, status: '已发布' } : version
)))
assert.equal(planStore.getState().configTemplateVersionScopes[tdtScope].currentVersion, 'v-tdt-only', 'switching back restores TDT current version')
assert.equal(planStore.getState().configTemplateVersionScopes[subprojectScope].currentVersion, 'v-subproject-only', 'subproject current version remains independent')

assert.equal(planStore.getState().setConfigTemplateCompareVersions(tdtScope, 'v3', 'v-tdt-only'), true, 'TDT compare selects only versions in its scope')
assert.equal(planStore.getState().setConfigTemplateCompareVersions(subprojectScope, 'v3', 'v-tdt-only'), false, 'subproject compare rejects a TDT-only version')

const compatibility = loadTypeScriptModule(root, 'src/lib/projectTemplateCompatibility.ts')
const compare = loadTypeScriptModule(root, 'src/lib/versionCompare.ts')
const tdtPublishedTasks = [{ ...tdtTasks[0], taskName: 'TDT独立发布' }]
const subprojectPublishedTasks = [{ ...subprojectTasks[0], taskName: '子项目独立发布' }]
planStore.getState().setPublishedSnapshots(previous => ({
  ...previous,
  [compatibility.getTemplateSnapshotKey('技术项目', 'v-tdt-only', 'tdt')]: tdtPublishedTasks,
  [compatibility.getTemplateSnapshotKey('技术项目', 'v-subproject-only', 'subproject')]: subprojectPublishedTasks,
}))
const snapshots = planStore.getState().publishedSnapshots
assert.deepEqual(compatibility.getTemplateSnapshotForProjectType(snapshots, '技术项目', 'v-tdt-only', 'tdt'), tdtPublishedTasks, 'TDT publish stays in TDT snapshot scope')
assert.deepEqual(compatibility.getTemplateSnapshotForProjectType(snapshots, '技术项目', 'v-subproject-only', 'subproject'), subprojectPublishedTasks, 'subproject publish stays in subproject snapshot scope')
assert.equal(compatibility.getTemplateSnapshotForProjectType(snapshots, '技术项目', 'v-tdt-only', 'subproject'), undefined, 'subproject cannot read a TDT publication')
assert.equal(compare.compareVersionsForTable(tdtTasks, tdtPublishedTasks).some(row => row.changeType !== '未变更'), true, 'TDT compare uses its scoped publication')
assert.equal(compare.compareVersionsForTable(subprojectTasks, subprojectPublishedTasks).some(row => row.changeType !== '未变更'), true, 'subproject compare uses its scoped publication')

const technicalProjectModule = loadTypeScriptModule(root, 'src/stores/technicalProject.ts')
const technicalPlanModule = loadTypeScriptModule(root, 'src/stores/technicalPlan.ts')
assert.ok(technicalPlanModule.TECHNICAL_PLAN_STORE_VERSION >= 2, 'technical plan persistence declares a migration version')
const migratedLegacyPlan = technicalPlanModule.migrateTechnicalPlanState({
  plansByKey: {
    '9:tdt': {
      planKey: '9:tdt', templateKind: 'tdt', currentVersionId: 'tech-9-v2-draft',
      versions: [{ id: 'tech-9-v2-draft', versionNo: 'V2', templateType: 'tdt', status: '修订中', tasks: [{ id: 'legacy-only', taskName: '旧默认任务' }] }],
    },
  },
}, 0)
assert.deepEqual(
  migratedLegacyPlan.plansByKey['9:tdt'].versions[0].tasks.map(task => task.taskName),
  tdtTasks.map(task => task.taskName),
  'legacy seeded TDT draft migrates to the complete Task10 TDT template',
)
assert.deepEqual(migratedLegacyPlan.plansByKey['9:tdt'].versions.at(-1).tasks.map(task => task.taskName), tdtTasks.map(task => task.taskName), 'legacy seeded draft is also reset to the complete TDT template')
assert.ok(migratedLegacyPlan.plansByKey['9:tdt'].columnSettings, 'migration backfills per-instance columns')
assert.deepEqual(migratedLegacyPlan.plansByKey['9:tdt'].collapsedRows, [], 'migration backfills collapsed rows')
const orderedTabs = technicalPlanModule.buildTechnicalPlanTabs('9', technicalProjectModule.INITIAL_TECHNICAL_SUBPROJECTS, false)
assert.deepEqual(orderedTabs.map(tab => tab.key), ['9:tdt', '9:subproject:IPM-AI-001', '9:subproject:IPM-AI-002'], 'TDT is first and active children follow IPM order')
assert.equal(orderedTabs[0].label, 'TDT项目计划')
assert.deepEqual(
  technicalPlanModule.buildTechnicalPlanTabs('9', technicalProjectModule.INITIAL_TECHNICAL_SUBPROJECTS, true).map(tab => tab.key),
  ['9:tdt', '9:subproject:IPM-AI-001', '9:subproject:IPM-AI-002', '9:subproject:IPM-AI-003'],
  'history mode includes inactive children in IPM order',
)

const instanceStore = technicalPlanModule.createTechnicalPlanStore({ plansByKey: {} })
const tdtPlanScope = { kind: 'tdt', parentProjectId: '9' }
const childPlanScope = { kind: 'subproject', parentProjectId: '9', subprojectId: 'IPM-AI-001' }
const incompleteChildScope = { kind: 'subproject', parentProjectId: '9', subprojectId: 'IPM-AI-002' }
const inactiveChildScope = { kind: 'subproject', parentProjectId: '9', subprojectId: 'IPM-AI-003' }
const configuredChild = technicalProjectModule.INITIAL_TECHNICAL_SUBPROJECTS[0]
const incompleteChild = technicalProjectModule.INITIAL_TECHNICAL_SUBPROJECTS[1]
const inactiveChild = technicalProjectModule.INITIAL_TECHNICAL_SUBPROJECTS[2]
assert.deepEqual(instanceStore.createRevision({ scope: tdtPlanScope, templateKind: 'tdt', templateTasks: tdtTasks }), { ok: true, versionId: 'V1-draft' }, 'TDT creates its own first draft')
assert.deepEqual(instanceStore.createRevision({ scope: tdtPlanScope, templateKind: 'tdt', templateTasks: tdtTasks }), { ok: false, reason: 'draft-exists' }, 'one instance allows at most one draft')
assert.equal(instanceStore.publishRevision(tdtPlanScope, '2026-08-01T00:00:00Z').ok, true, 'TDT draft publishes')
assert.deepEqual(instanceStore.createRevision({ scope: childPlanScope, templateKind: 'subproject', templateTasks: subprojectTasks, subproject: configuredChild }), { ok: true, versionId: 'V1-draft' }, 'child has an independent V1 sequence')
assert.equal(instanceStore.getState().plansByKey['9:tdt'].versions.length, 1, 'publishing child does not mutate TDT versions')
assert.deepEqual(instanceStore.createRevision({ scope: inactiveChildScope, templateKind: 'subproject', templateTasks: subprojectTasks, subproject: inactiveChild }), { ok: false, reason: 'inactive' }, 'inactive child is history-only')
assert.deepEqual(instanceStore.createRevision({ scope: incompleteChildScope, templateKind: 'subproject', templateTasks: subprojectTasks, subproject: incompleteChild }), { ok: false, reason: 'incomplete-configuration' }, 'incomplete child cannot create a revision')

const childV1 = instanceStore.getState().plansByKey['9:subproject:IPM-AI-001'].versions[0]
const editedTemplate = subprojectTasks.map((task, index) => ({ ...task, taskName: index === 0 ? '后改模板' : task.taskName }))
assert.equal(instanceStore.publishRevision(childPlanScope, '2026-08-01T01:00:00Z').ok, true)
assert.deepEqual(instanceStore.createRevision({ scope: childPlanScope, templateKind: 'subproject', templateTasks: editedTemplate, subproject: configuredChild }), { ok: true, versionId: 'V2-draft' }, 'next child revision advances only its own sequence')
const childState = instanceStore.getState().plansByKey['9:subproject:IPM-AI-001']
assert.equal(childState.versions[0].tasks[0].taskName, childV1.tasks[0].taskName, 'template edits never mutate existing versions')
assert.equal(childState.versions[1].tasks[0].taskName, '后改模板', 'new draft uses latest matching template snapshot')
assert.notStrictEqual(childState.versions[0].tasks, childState.versions[1].tasks, 'version task snapshots are isolated')
assert.deepEqual(instanceStore.getState().plansByKey['9:tdt'].versions.map(version => version.versionNo), ['V1'], 'child actions do not change TDT sequence')
instanceStore.setColumns(childPlanScope, { order: ['taskName'], visible: ['taskName'] })
instanceStore.setCollapsed(childPlanScope, ['subproject-1'])
assert.deepEqual(instanceStore.getState().plansByKey['9:subproject:IPM-AI-001'].columnSettings.visible, ['taskName'], 'columns persist per plan key')
assert.deepEqual(instanceStore.getState().plansByKey['9:subproject:IPM-AI-001'].collapsedRows, ['subproject-1'], 'collapsed rows persist per plan key')
assert.equal(instanceStore.getState().plansByKey['9:tdt'].columnSettings.visible.includes('taskName'), true, 'TDT column state remains independent')

const invalidTdtTasks = [{ ...tdtTasks[0] }, { ...tdtTasks[1] }, { ...tdtTasks[1], id: 'too-deep', parentId: tdtTasks[1].id }]
assert.deepEqual(
  instanceStore.createRevision({ scope: { kind: 'tdt', parentProjectId: 'depth-test' }, templateKind: 'tdt', maxDepth: 2, templateTasks: invalidTdtTasks }),
  { ok: false, reason: 'max-depth' },
  'TDT store rejects revisions deeper than two levels',
)
assert.deepEqual(
  instanceStore.createRevision({ scope: { kind: 'subproject', parentProjectId: '9', subprojectId: 'depth-child' }, templateKind: 'subproject', maxDepth: 1, templateTasks: [{ ...subprojectTasks[0], parentId: 'parent' }], subproject: configuredChild }),
  { ok: false, reason: 'max-depth' },
  'subproject store rejects child tasks',
)
const tdtBeforeInvalidWrite = instanceStore.getState().plansByKey['9:tdt'].versions[0].tasks
assert.equal(instanceStore.createRevision({ scope: tdtPlanScope, templateKind: 'tdt', maxDepth: 2, templateTasks: tdtTasks }).ok, true)
assert.deepEqual(instanceStore.updateCurrentTasks(tdtPlanScope, invalidTdtTasks, 2), { ok: false, reason: 'max-depth' }, 'all task writes enforce maxDepth')
assert.deepEqual(instanceStore.getState().plansByKey['9:tdt'].versions[0].tasks, tdtBeforeInvalidWrite, 'rejected writes are atomic')

const addedTopLevel = rules.insertTechnicalPlanTask(tdtTasks, { ...tdtTasks[0], id: 'new-top', parentId: undefined }, 'tdt', 2)
assert.equal(addedTopLevel.at(-1).id, 'new-top', 'draft editing can add a top-level task')
const addedTdtChild = rules.insertTechnicalPlanTask(tdtTasks, { ...tdtTasks[0], id: 'new-child', parentId: tdtTasks[0].id }, 'tdt', 2)
assert.equal(addedTdtChild.find(task => task.id === 'new-child').parentId, tdtTasks[0].id, 'TDT editing can add a second-level task')
assert.throws(() => rules.insertTechnicalPlanTask(subprojectTasks, { ...subprojectTasks[0], id: 'illegal-child', parentId: subprojectTasks[0].id }, 'subproject', 1), /depth|child/i, 'subproject editing cannot add child tasks')
assert.deepEqual(
  rules.deleteTechnicalPlanTaskCascade(addedTdtChild, tdtTasks[0].id).map(task => task.id),
  tdtTasks.filter(task => task.id !== tdtTasks[0].id && task.parentId !== tdtTasks[0].id).map(task => task.id),
  'deleting a parent cascades through its children',
)

const technicalModuleSource = readSource(root, 'src/components/technical-project/TechnicalPlanModule.tsx')
const technicalWorkspace = loadTypeScriptModule(root, 'src/lib/technicalPlanWorkspace.ts')
const planWorkspaceShellPath = 'src/components/plans/PlanWorkspaceShell.tsx'
assert.equal(fs.existsSync(`${root}/${planWorkspaceShellPath}`), true, 'plan workspace provides a shared shell for whole-machine and technical projects')
const planWorkspaceShell = readSource(root, planWorkspaceShellPath)
const parseTsx = (source, fileName) => ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const shellSourceFile = parseTsx(planWorkspaceShell, planWorkspaceShellPath)
const technicalSourceFile = parseTsx(technicalModuleSource, 'TechnicalPlanModule.tsx')
const hasExportModifier = node => node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)
const functionLikeFromDeclaration = declaration => {
  if (ts.isFunctionDeclaration(declaration)) return declaration
  if (ts.isVariableDeclaration(declaration) && declaration.initializer && (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))) return declaration.initializer
  return undefined
}
const findLocalDeclaration = (sourceFile, name) => {
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) return statement
    if (ts.isVariableStatement(statement)) {
      const declaration = statement.declarationList.declarations.find(item => ts.isIdentifier(item.name) && item.name.text === name)
      if (declaration) return declaration
    }
  }
  return undefined
}
const findExportedFunctionComponent = (sourceFile, name) => {
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === name && hasExportModifier(statement)) return { declaration: statement, functionLike: statement }
    if (ts.isVariableStatement(statement) && hasExportModifier(statement)) {
      const declaration = statement.declarationList.declarations.find(item => ts.isIdentifier(item.name) && item.name.text === name)
      const functionLike = declaration && functionLikeFromDeclaration(declaration)
      if (declaration && functionLike) return { declaration, functionLike }
    }
    if (ts.isExportAssignment(statement) && ts.isIdentifier(statement.expression) && statement.expression.text === name) {
      const declaration = findLocalDeclaration(sourceFile, name)
      const functionLike = declaration && functionLikeFromDeclaration(declaration)
      if (declaration && functionLike) return { declaration, functionLike }
    }
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      const element = statement.exportClause.elements.find(item => item.name.text === name)
      const declaration = element && findLocalDeclaration(sourceFile, element.propertyName?.text || element.name.text)
      const functionLike = declaration && functionLikeFromDeclaration(declaration)
      if (declaration && functionLike) return { declaration, functionLike }
    }
  }
  return undefined
}
const importsComponent = (sourceFile, name, modulePath) => sourceFile.statements.some(statement => {
  if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== modulePath) return false
  const clause = statement.importClause
  if (clause?.name?.text === name) return true
  return Boolean(clause?.namedBindings && ts.isNamedImports(clause.namedBindings) && clause.namedBindings.elements.some(element => element.name.text === name))
})
const collectBindings = sourceFile => {
  const bindings = new Map()
  const walk = node => {
    if (ts.isFunctionDeclaration(node) && node.name) bindings.set(node.name.text, node)
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) bindings.set(node.name.text, node.initializer)
    ts.forEachChild(node, walk)
  }
  walk(sourceFile)
  return bindings
}
const returnedExpressions = functionLike => {
  if (!ts.isBlock(functionLike.body)) return [functionLike.body]
  const returns = []
  const walk = node => {
    if (node !== functionLike.body && ts.isFunctionLike(node)) return
    if (ts.isReturnStatement(node) && node.expression) returns.push(node.expression)
    else ts.forEachChild(node, walk)
  }
  walk(functionLike.body)
  return returns
}
const collectReachableFromRoots = (sourceFile, roots) => {
  const bindings = collectBindings(sourceFile)
  const nodes = []
  const seen = new Set()
  const walk = node => {
    if (!node || seen.has(node)) return
    seen.add(node)
    nodes.push(node)
    if (ts.isIdentifier(node) && bindings.has(node.text)) {
      const binding = bindings.get(node.text)
      if (ts.isFunctionLike(binding)) returnedExpressions(binding).forEach(walk)
      else walk(binding)
    }
    ts.forEachChild(node, walk)
  }
  roots.forEach(walk)
  return nodes
}
const collectReachableNodes = (sourceFile, component) => collectReachableFromRoots(sourceFile, returnedExpressions(component.functionLike))
const findJsxMount = (nodes, sourceFile, name) => nodes.find(node => (
  (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(sourceFile) === name
))
const jsxAttributeNames = node => new Set(node.attributes.properties.filter(ts.isJsxAttribute).map(attribute => attribute.name.getText()))
const jsxAttribute = (node, name) => node.attributes.properties.find(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText() === name)
const propsMembersForComponent = (sourceFile, component) => {
  let typeNode = component.functionLike.parameters[0]?.type
  if (!typeNode && ts.isVariableDeclaration(component.declaration) && component.declaration.type && ts.isTypeReferenceNode(component.declaration.type)) {
    typeNode = component.declaration.type.typeArguments?.[0]
  }
  const resolveMembers = candidate => {
    if (!candidate) return []
    if (ts.isTypeLiteralNode(candidate)) return candidate.members
    if (ts.isIntersectionTypeNode(candidate)) return candidate.types.flatMap(resolveMembers)
    if (ts.isTypeReferenceNode(candidate)) {
      const typeName = candidate.typeName.getText(sourceFile)
      const declaration = sourceFile.statements.find(statement => (
        (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) && statement.name.text === typeName
      ))
      if (declaration && ts.isInterfaceDeclaration(declaration)) return declaration.members
      if (declaration && ts.isTypeAliasDeclaration(declaration)) return resolveMembers(declaration.type)
    }
    return []
  }
  return new Set(resolveMembers(typeNode).map(member => member.name?.getText(sourceFile)).filter(Boolean))
}
const jsxControlHasLabel = (node, sourceFile, label) => {
  const opening = ts.isJsxElement(node) ? node.openingElement : node
  if ((!ts.isJsxSelfClosingElement(opening) && !ts.isJsxOpeningElement(opening)) || !['Button', 'Tooltip'].includes(opening.tagName.getText(sourceFile))) return false
  const hasAttributeLabel = opening.attributes.properties.some(attribute => {
    if (!ts.isJsxAttribute(attribute) || !['aria-label', 'title'].includes(attribute.name.getText())) return false
    if (attribute.initializer && ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text === label
    return Boolean(attribute.initializer && ts.isJsxExpression(attribute.initializer) && ts.isStringLiteral(attribute.initializer.expression) && attribute.initializer.expression.text === label)
  })
  const hasTextLabel = ts.isJsxElement(node) && node.children.some(child => ts.isJsxText(child) && child.text.trim() === label)
  return hasAttributeLabel || hasTextLabel
}
const rendersLiveCapabilityControl = (nodes, sourceFile, label) => nodes.some(node => (
  (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node))
  && jsxControlHasLabel(node, sourceFile, label)
))
const configuresViewMode = (nodes, sourceFile, mode) => nodes.some(node => (
  ts.isPropertyAssignment(node) && node.name.getText(sourceFile) === 'value' && ts.isStringLiteral(node.initializer) && node.initializer.text === mode
))
const hasViewBranch = (nodes, sourceFile, mode) => nodes.some(node => {
  if (!ts.isBinaryExpression(node) || ![ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(node.operatorToken.kind)) return false
  const pairs = [[node.left, node.right], [node.right, node.left]]
  return pairs.some(([candidate, value]) => candidate.getText(sourceFile).endsWith('viewMode') && ts.isStringLiteral(value) && value.text === mode)
})

const shellComponent = findExportedFunctionComponent(shellSourceFile, 'PlanWorkspaceShell')
assert.ok(shellComponent, 'shared plan workspace shell resolves to an exported live function component')
const shellProps = propsMembersForComponent(shellSourceFile, shellComponent)
const shellReachableNodes = collectReachableNodes(shellSourceFile, shellComponent)
for (const prop of ['versionControls', 'primaryActions', 'utilityActions', 'viewMode', 'onViewModeChange', 'children']) {
  assert.equal(shellProps.has(prop), true, `the exported shell props declare live structure slot ${prop}`)
}
for (const label of ['计划版本操作', '计划工具', '计划内容']) {
  assert.ok(shellReachableNodes.some(node => (
    (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
    && node.attributes.properties.some(attribute => ts.isJsxAttribute(attribute)
      && attribute.name.getText() === 'aria-label'
      && attribute.initializer
      && ts.isStringLiteral(attribute.initializer)
      && attribute.initializer.text === label)
  )), `the exported shell return tree renders its ${label} structure`)
}
assert.equal(importsComponent(shellSourceFile, 'PlanViewModeSwitcher', '@/components/plans/PlanViewModeSwitcher'), true, 'the exported shell imports the canonical view-mode switcher')
assert.ok(findJsxMount(shellReachableNodes, shellSourceFile, 'PlanViewModeSwitcher'), 'the exported shell return tree mounts its canonical view-mode switcher')
assert.equal(importsComponent(technicalSourceFile, 'PlanWorkspaceShell', '@/components/plans/PlanWorkspaceShell'), true, 'technical plan module imports the shared shell from its canonical module')
const technicalComponent = findExportedFunctionComponent(technicalSourceFile, 'TechnicalPlanModule')
assert.ok(technicalComponent, 'technical plan module resolves to its exported live function component')
const technicalReachableNodes = collectReachableNodes(technicalSourceFile, technicalComponent)
const technicalShellMount = findJsxMount(technicalReachableNodes, technicalSourceFile, 'PlanWorkspaceShell')
assert.ok(technicalShellMount, 'technical plan module mounts the imported shared plan workspace shell')
const technicalShellProps = jsxAttributeNames(technicalShellMount)
const shellCapabilities = [
  ['创建修订', 'primaryActions'],
  ['计划克隆', 'primaryActions'],
  ['筛选', 'utilityActions'],
  ['字段配置', 'utilityActions'],
  ['全部展开', 'utilityActions'],
  ['全部收起', 'utilityActions'],
  ['版本对比', 'utilityActions'],
  ['分享计划', 'utilityActions'],
]
for (const slot of ['primaryActions', 'utilityActions']) assert.equal(technicalShellProps.has(slot), true, `technical plan fills the shared shell ${slot} slot`)
for (const [label, slot] of shellCapabilities) {
  const slotAttribute = jsxAttribute(technicalShellMount, slot)
  assert.ok(slotAttribute?.initializer && ts.isJsxExpression(slotAttribute.initializer) && slotAttribute.initializer.expression, `technical plan passes a live ${slot} expression for ${label}`)
  const slotNodes = collectReachableFromRoots(technicalSourceFile, [slotAttribute.initializer.expression])
  assert.equal(rendersLiveCapabilityControl(slotNodes, technicalSourceFile, label), true, `technical plan's ${slot} slot renders an actual ${label} control`)
}
const viewSwitcherSource = readSource(root, 'src/components/plans/PlanViewModeSwitcher.tsx')
const viewSwitcherSourceFile = parseTsx(viewSwitcherSource, 'PlanViewModeSwitcher.tsx')
const viewSwitcherComponent = findExportedFunctionComponent(viewSwitcherSourceFile, 'PlanViewModeSwitcher')
assert.ok(viewSwitcherComponent, 'canonical plan view-mode switcher resolves to its exported live component')
const viewSwitcherReachableNodes = collectReachableNodes(viewSwitcherSourceFile, viewSwitcherComponent)
for (const mode of ['vertical', 'horizontal', 'gantt']) {
  assert.equal(configuresViewMode(viewSwitcherReachableNodes, viewSwitcherSourceFile, mode), true, `the live canonical view switcher configures the ${mode} view option`)
  assert.equal(hasViewBranch(technicalReachableNodes, technicalSourceFile, mode), true, `the exported technical plan renders a real ${mode} view branch`)
}
assert.equal(technicalShellProps.has('viewMode'), true, 'technical plan passes its current view mode into the shell')
assert.equal(technicalShellProps.has('onViewModeChange'), true, 'technical plan passes its view-mode handler into the shell')
assert.match(technicalModuleSource, /TDT项目计划/, 'technical plan UI renders the fixed TDT tab')
assert.doesNotMatch(technicalModuleSource, /显示已停用|showInactive|Switch/, 'technical plan UI hides inactive subprojects instead of exposing history mode')
assert.match(technicalModuleSource, /SettingOutlined/, 'child plan tabs expose configuration')
assert.match(technicalModuleSource, /compareVersionsForTable/, 'technical plans reuse version comparison')
assert.match(technicalModuleSource, /exportSheet/, 'technical plans reuse Excel export')
assert.match(technicalModuleSource, /SortableRow/, 'technical plans reuse sortable task rows')
assert.match(technicalModuleSource, /getInvalidTechnicalTaskFields/, 'technical plans enforce plan date validation')
assert.match(technicalModuleSource, /maxDepthByKind/, 'technical plan depth is a component input')
assert.match(technicalModuleSource, /handleAddTopLevelTask/, 'drafts can add top-level tasks')
assert.match(technicalModuleSource, /handleAddChildTask/, 'TDT drafts can add second-level tasks')
assert.match(technicalModuleSource, /CaretDownOutlined/, 'technical top-level tasks expose the same row collapse affordance as whole-machine plans')
assert.match(technicalModuleSource, /toggleCollapsedTask/, 'technical top-level tasks can toggle their own persisted collapsed state')
assert.match(technicalModuleSource, /aria-expanded=\{!collapsedIds\.has\(row\.id\)\}/, 'the row collapse control exposes its current expanded state')
assert.match(technicalModuleSource, /handleDeleteTask/, 'drafts can delete tasks with cascade handling')
assert.match(technicalModuleSource, /SortableColumnSettings/, 'column settings reuse sortable staged apply/cancel interaction')
assert.match(technicalModuleSource, /canImport/, 'technical plan import has a dedicated permission input')
assert.match(technicalModuleSource, /canExport/, 'technical plan export has a dedicated permission input')
for (const label of ['实际开始', '实际完成', '实际工期']) {
  assert.match(technicalModuleSource, new RegExp(label), `technical plan vertical table exposes the whole-machine ${label} field`)
}
assert.match(technicalModuleSource, /canViewTechnicalPlan/, 'technical plan accepts only its L1 technical view capability')
assert.match(technicalModuleSource, /isResponsibleForTechnicalPlanTasks/, 'technical draft visibility derives responsibility from the active technical scope')
assert.doesNotMatch(technicalModuleSource, /effectiveTasks|level2PlanTasks|projectPlanLevel/, 'technical plan never reads whole-machine or level-2 plan state')
assert.match(technicalModuleSource, /visibleVersions/, 'all technical plan version surfaces share one visible-version selector')
assert.match(technicalModuleSource, /navigateWithEditGuard\([^,]+,\s*Boolean\(isDraft\)\)/s, 'scope and version switches use the current draft state for edit guarding')
assert.match(technicalModuleSource, /<DHTMLXGantt[\s\S]{0,260}readOnly/, 'technical Gantt is explicitly read-only until write-back is implemented')
assert.match(technicalModuleSource, /scrollIntoView/, 'publish validation moves focus to the first invalid row')
assert.match(technicalModuleSource, /if \(invalid\.size\)[\s\S]{0,320}setCollapsed\(scope, \[\]\)[\s\S]{0,320}requestAnimationFrame/, 'publish validation expands the active scope before locating an invalid child task')
assert.match(technicalModuleSource, /const publishedVersions = useMemo\([\s\S]{0,160}canViewTechnicalPlan/, 'published versions remain inaccessible without technical-plan view permission')
assert.match(technicalModuleSource, /canShareTechnicalPlan/, 'technical plan sharing accepts its dedicated L1 share capability')
assert.match(technicalModuleSource, /const handleShare = \(\) => \{\s*if \(!canViewTechnicalPlan \|\| !canShareTechnicalPlan\) return/, 'sharing has strict view and share permission guards')
assert.match(technicalModuleSource, /disabled=\{!canViewTechnicalPlan \|\| !canShareTechnicalPlan \|\| !publishedVersions\.length\}[^>]*aria-label="分享计划"/, 'sharing is disabled without technical-plan view or share permission')
assert.match(technicalModuleSource, /编辑模式[\s\S]{0,180}自动保存/, 'technical drafts expose the same edit-mode guidance as whole-machine plans')
assert.match(technicalModuleSource, /key:\s*['"]id['"][^\n]*fixed:\s*['"]left['"]/, 'the technical sequence column stays fixed on horizontal scroll')
assert.match(technicalModuleSource, /key:\s*['"]taskName['"][^\n]*fixed:\s*['"]left['"]/, 'the technical task-name column stays fixed on horizontal scroll')
assert.doesNotMatch(technicalModuleSource, /key:\s*['"]drag['"]/, 'task name remains the first technical-plan column instead of following an empty drag column')
assert.match(technicalModuleSource, /technical-plan-sequence-cell[\s\S]{0,260}<DragHandle\s*\/>/, 'the drag handle lives inside the fixed sequence column, matching whole-machine plans')
assert.match(technicalModuleSource, /key:\s*['"]actions['"][^\n]*fixed:\s*['"]right['"]/, 'the technical operation column stays fixed on horizontal scroll')
assert.match(technicalModuleSource, /className=[^\n]*technical-plan-vertical-table/, 'the technical vertical plan table has a stable layout scope')
assert.match(technicalModuleSource, /technical-plan-add-task[\s\S]{0,320}handleAddTopLevelTask/, 'top-level task creation follows the whole-machine table footer interaction')
assert.match(technicalModuleSource, /icon=\{<CopyOutlined\s*\/>\}[^>]*aria-label="计划克隆"[^>]*\/>/, 'technical plan clone uses the same icon-only draft action as whole-machine plans')
assert.match(technicalModuleSource, /icon=\{<SaveOutlined\s*\/>\}[^>]*aria-label="发布"[^>]*\/>/, 'technical plan publish uses the same icon-only draft action as whole-machine plans')
const globalStylesSource = readSource(root, 'src/styles/globals.css')
assert.match(globalStylesSource, /\.pms-table \.ant-table-thead\s*>\s*tr\s*>\s*th\.ant-table-cell-fix-(?:start|end)[\s\S]{0,900}position:\s*sticky\s*!important/s, 'fixed technical-plan headers remain aligned with fixed body cells')
for (const label of ['预估工期', '实际工期', '进度']) {
  assert.match(technicalModuleSource, new RegExp(`TECHNICAL_FILTER_FIELDS[\\s\\S]*${label}`), `technical filters include ${label}`)
}
assert.match(readSource(root, 'src/stores/technicalPlan.ts'), /DEFAULT_COLUMNS[\s\S]{0,420}actualStartDate[\s\S]{0,120}actualEndDate[\s\S]{0,120}actualDays/, 'technical plan persisted defaults include actual-date columns')

const publishedVersion = { id: 'v1', versionNo: 'V1', status: '已发布', templateType: 'tdt', tasks: [] }
const draftVersion = { id: 'v2', versionNo: 'V2', status: '修订中', templateType: 'tdt', tasks: [] }
assert.deepEqual(technicalWorkspace.selectVisibleTechnicalPlanVersions([publishedVersion, draftVersion], false).map(version => version.id), ['v1'], 'read-only users never receive a draft technical version')
assert.deepEqual(technicalWorkspace.selectVisibleTechnicalPlanVersions([publishedVersion, draftVersion], true).map(version => version.id), ['v1', 'v2'], 'draft-capable users retain technical drafts')

const hierarchy = [
  { id: 'p1', order: 1, taskName: '阶段1' },
  { id: 'c1', parentId: 'p1', order: 2, taskName: '节点1' },
  { id: 'p2', order: 3, taskName: '阶段2' },
  { id: 'c2', parentId: 'p2', order: 4, taskName: '节点2' },
]
assert.deepEqual(technicalWorkspace.includeTechnicalPlanAncestors(hierarchy, [hierarchy[1]]).map(task => task.id), ['p1', 'c1'], 'a child filter result retains its parent context')
assert.deepEqual(technicalWorkspace.reorderTechnicalTasksWithinParent(hierarchy, 'c1', 'c2').map(task => task.id), hierarchy.map(task => task.id), 'dragging across parents cannot corrupt the technical hierarchy')

const imported = technicalWorkspace.parseTechnicalPlanImportRows([
  { ID: 'p1', '父任务ID': '', '任务名称': '阶段', '责任人': '甲', '前置任务': '', '计划开始': '2026-01-01', '计划完成': '2026-01-10', '预估工期': 10, '实际开始': '2026-01-02', '实际完成': '2026-01-09', '实际工期': 8, '状态': '已完成', '进度': 100 },
  { ID: 'c1', '父任务ID': 'p1', '任务名称': '节点', '责任人': '乙', '前置任务': 'p1', '计划开始': '2026-01-02', '计划完成': '2026-01-08', '预估工期': 7, '实际开始': '2026-01-03', '实际完成': '2026-01-07', '实际工期': 5, '状态': '进行中', '进度': 80 },
])
assert.deepEqual(imported.map(task => [task.id, task.parentId, task.actualEndDate, task.actualDays, task.progress]), [['p1', undefined, '2026-01-09', 8, 100], ['c1', 'p1', '2026-01-07', 5, 80]], 'technical import preserves hierarchy and every exported actual/progress field')
for (const title of ['ID', '父任务ID', '任务名称', '预估工期', '实际开始', '实际完成', '实际工期', '状态', '进度']) {
  assert.equal(technicalWorkspace.TECHNICAL_PLAN_EXPORT_COLUMNS.some(column => column.title === title), true, `technical export includes ${title}`)
}
const horizontalRows = technicalWorkspace.buildTechnicalHorizontalRows([{
  ...publishedVersion,
  tasks: [{ ...hierarchy[0], planStartDate: '2026-01-01', planEndDate: '2026-01-10', actualStartDate: '2026-01-02', actualEndDate: '2026-01-09' }],
}], 'v1')
assert.equal(horizontalRows[0].rowType, 'version', 'horizontal plan includes a version row')
assert.equal(horizontalRows.at(-1).rowType, 'actual', 'horizontal plan includes a final actual row')
assert.equal(typeof horizontalRows[0].cycleDays, 'number', 'horizontal version rows include development cycle')
assert.throws(
  () => technicalWorkspace.parseTechnicalPlanImportRows([{ ID: 'same', '任务名称': 'A' }, { ID: 'same', '任务名称': 'B' }]),
  /duplicate-id/,
  'technical import rejects duplicate IDs',
)
assert.throws(
  () => technicalWorkspace.parseTechnicalPlanImportRows([{ ID: '', '任务名称': 'A' }], [imported[0]]),
  /missing-id/,
  'an ID-based technical import rejects blank IDs',
)
const idMatchedFallback = technicalWorkspace.parseTechnicalPlanImportRows(
  [{ ID: 'c1', '任务名称': '节点更新' }, { ID: 'p1', '任务名称': '阶段更新' }],
  imported,
)
assert.deepEqual(idMatchedFallback.map(task => [task.id, task.responsible]), [['c1', '乙'], ['p1', '甲']], 'ID-based imports match fallback fields by ID instead of row index')
assert.deepEqual(
  technicalWorkspace.parseTechnicalPlanImportRows([{ '任务名称': '旧文件阶段' }], [imported[0]]).map(task => task.id),
  ['p1'],
  'legacy files without an ID column alone may fall back by row index',
)
const actualVersionRows = technicalWorkspace.buildTechnicalHorizontalRows([
  { ...publishedVersion, id: 'selected', tasks: [{ ...imported[0], actualEndDate: '2026-01-09' }] },
  { ...publishedVersion, id: 'later', tasks: [{ ...imported[0], actualEndDate: '2026-02-09' }] },
], 'selected')
assert.equal(actualVersionRows.at(-1).endDatesByTaskId.p1, '2026-01-09', 'horizontal actual row explicitly follows the selected version')
const projectSpaceSource = readSource(root, 'src/containers/ProjectSpaceContainer.tsx')
const projectSpaceSourceFile = parseTsx(projectSpaceSource, 'ProjectSpaceContainer.tsx')
assert.equal(importsComponent(projectSpaceSourceFile, 'PlanWorkspaceShell', '@/components/plans/PlanWorkspaceShell'), true, 'whole-machine project space imports the shared shell from its canonical module')
const projectSpaceComponent = findExportedFunctionComponent(projectSpaceSourceFile, 'ProjectSpaceContainer')
assert.ok(projectSpaceComponent, 'whole-machine project space resolves to its exported live function component')
assert.ok(findJsxMount(collectReachableNodes(projectSpaceSourceFile, projectSpaceComponent), projectSpaceSourceFile, 'PlanWorkspaceShell'), 'whole-machine project space mounts the imported shared shell in its live return tree')
assert.match(projectSpaceSource, /canDo\('plan:导入'\)/, 'project space passes technical import permission')
assert.match(projectSpaceSource, /canDo\('plan:导出'\)/, 'project space passes technical export permission')
assert.match(projectSpaceSource, /<TechnicalPlanModule[\s\S]{0,420}canViewTechnicalPlan=\{canViewLevel1Plan\}/, 'project space passes only the technical L1 view capability')
assert.match(projectSpaceSource, /const canShareTechnicalPlan = canDo\('plan:一级计划-分享'\)/, 'project space resolves the dedicated L1 share capability')
assert.match(projectSpaceSource, /<TechnicalPlanModule[\s\S]{0,420}canShareTechnicalPlan=\{canShareTechnicalPlan\}/, 'project space passes the technical L1 share capability')
assert.doesNotMatch(projectSpaceSource.match(/<TechnicalPlanModule[\s\S]{0,520}\/>/)?.[0] || '', /canViewDraft|effectiveTasks|level2PlanTasks|projectPlanLevel/, 'technical draft access never depends on whole-machine or level-2 plan state')

const machineScope = rules.getTemplateConfigScopeKey('整机产品项目', 'level1')
const migratedPlan = planModule.migratePlanStoreState({
  versions: [{ id: 'legacy-v', versionNo: 'V88', status: '已发布' }],
  currentVersion: 'legacy-v',
  configTemplateVersionScopes: {
    [machineScope]: {
      versions: [{ id: 'machine-v', versionNo: 'V99', status: '已发布' }],
      currentVersion: 'machine-v',
    },
  },
})
assert.deepEqual(migratedPlan.configTemplateVersionScopes[machineScope], {
  versions: [{ id: 'machine-v', versionNo: 'V99', status: '已发布' }],
  currentVersion: 'machine-v',
}, 'migration preserves an existing nontechnical version scope')
const editedTdt = [{ ...tdtTasks[0], taskName: '用户已编辑TDT模板' }]
const migratedFromTask10 = planModule.migratePlanStoreState({
  configTemplateTasksByType: {
    [rules.TECHNICAL_TEMPLATE_STORAGE_KEYS.tdt]: editedTdt,
  },
  publishedSnapshots: {
    'template::技术项目::tdt::v5': editedTdt,
  },
}, 1)
assert.deepEqual(migratedFromTask10.configTemplateTasksByType[rules.TECHNICAL_TEMPLATE_STORAGE_KEYS.tdt], editedTdt, 'v1 to v2 migration preserves edited TDT templates')
assert.deepEqual(migratedFromTask10.publishedSnapshots['template::技术项目::tdt::v5'], editedTdt, 'v1 to v2 migration preserves technical publications')
delete globalThis.localStorage

assert.match(configSource, /TDT项目计划/, 'technical config exposes TDT project plan tab')
assert.match(configSource, /子项目计划/, 'technical config exposes subproject plan tab')
assert.match(configSource, /isTechnicalTemplate/, 'technical config branches from generic templates')
assert.match(configSource, /setTechnicalTemplateTasks/, 'technical config writes through validated store action')
console.log('technical plan contract passed')
