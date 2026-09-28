import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
const load = createTypeScriptModuleLoader()
const get = file => load(path.resolve(file))
const { useProjectStore } = get('src/stores/project.ts')
const { usePlanStore } = get('src/stores/plan.ts')
const { useProjectTeamStore } = get('src/stores/projectTeam.ts')
const { usePermissionStore, hasPermission } = get('src/stores/permission.ts')
const { canExecuteProjectTeamWrite } = get('src/lib/projectTeamMutationGuard.ts')
const source = fs.readFileSync('src/containers/ProjectSpaceContainer.tsx', 'utf8')
const ast = ts.createSourceFile('ProjectSpaceContainer.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const expressions = []
let guardExpression
function visit(node) { if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'canMutateLevel2Plan') guardExpression = node.initializer; if (ts.isJsxAttribute(node) && node.initializer && ts.isJsxExpression(node.initializer)) expressions.push(node); ts.forEachChild(node, visit) }
visit(ast)
const create = expressions.find(node => node.name.getText(ast) === 'onClick' && node.initializer.expression?.getText(ast).includes('setLevel2PlanMilestones(selectedMilestones)'))
const remove = expressions.find(node => node.name.getText(ast) === 'onConfirm' && node.initializer.expression?.getText(ast).includes('const newPlans = createdLevel2Plans.filter'))
assert.ok(guardExpression, 'production L2 live guard exists')
assert.match(source, /level2CreateOpening.current = captureLevel2Opening\(\)/, 'creation records opening target')
assert.match(source, /level2DeleteOpening.current = open \? captureLevel2Opening\(plan2.id\)/, 'deletion records opening target')
assert.ok(create && remove, 'test executes production create and delete callback bodies')
const actor = '演示用户10'
const project = { id: 'l2-handler-project', name: 'Example', type: '整机产品项目', projectAttribute: 'formal' }
useProjectStore.setState({ currentLoginUser: actor, selectedProject: project })
usePermissionStore.setState({ rolesByProject: { [project.id]: [{ name: 'SPM', members: [actor] }] }, rolePermissionsByProject: { [project.id]: { SPM: { 'plan:二级计划-编辑': true } } } })
const opening = { actor, projectId: project.id, permissionProjectId: project.id, market: useProjectStore.getState().selectedMarketTab, tosType: useProjectStore.getState().selectedTosTypeTab, planId: 'custom' }
const starting = { createdLevel2Plans: [{ id: 'custom', name: 'Custom', type: '无' }], level2PlanMeta: {}, level2PlanMilestones: [], versions: [], activeLevel2Plan: 'custom', currentVersion: 'published' }
function execute(node) {
  const state = usePlanStore.getState()
  const scope = {
    ...state, selectedProject: project, selectedMilestones: ['milestone'], selectedLevel2PlanType: '无', createFormValues: { customPlanName: 'Created' }, selectedMRVersion: '', configuredMarketName: '',
    plan2: starting.createdLevel2Plans[0], message: { success() {}, warning() {} }, setShowCreateLevel2Plan() {},
    isMachineProjectType: () => true, level2CreateOpening: { current: opening }, level2DeleteOpening: { current: opening },
    canMutateCurrentProject: () => canExecuteProjectTeamWrite(actor, project.id, useProjectStore.getState()), hasPermission, currentLoginUser: actor, _permProjectId: project.id,
    useProjectStore, canExecuteProjectTeamWrite,
  }
  const guardCompiled = ts.transpileModule(`const guard = ${guardExpression.getText(ast)}; guard;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  scope.canMutateLevel2Plan = vm.runInNewContext(guardCompiled, scope)
  const compiled = ts.transpileModule(`const handler = ${node.initializer.expression.getText(ast)}; handler();`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  vm.runInNewContext(compiled, scope)
}
const snapshot = () => JSON.stringify(Object.fromEntries(Object.keys(starting).map(key => [key, usePlanStore.getState()[key]])))
for (const [label, prepare] of [
  ['team source arrives after open', () => useProjectTeamStore.getState().syncProjects([{ ...project, sourceBid: 'EXT-001' }])],
  ['actor changes after open', () => useProjectStore.setState({ currentLoginUser: '演示用户11' })],
  ['project changes after open', () => useProjectStore.setState({ selectedProject: { ...project, id: 'other' } })],
  ['market changes after open', () => useProjectStore.setState({ selectedMarketTab: 'stale-market' })],
  ['L2 permission removed after open', () => usePermissionStore.setState({ rolePermissionsByProject: {} })],
]) {
  useProjectStore.setState({ currentLoginUser: actor, selectedProject: project, selectedMarketTab: opening.market, selectedTosTypeTab: opening.tosType })
  useProjectTeamStore.getState().syncProjects([project])
  usePermissionStore.setState({ rolePermissionsByProject: { [project.id]: { SPM: { 'plan:二级计划-编辑': true } } } })
  usePlanStore.setState(structuredClone(starting))
  prepare()
  const before = snapshot()
  execute(create); assert.equal(snapshot(), before, `real create handler blocks ${label}`)
  execute(remove); assert.equal(snapshot(), before, `real delete handler blocks ${label}`)
}
useProjectStore.setState({ currentLoginUser: actor, selectedProject: project, selectedMarketTab: opening.market, selectedTosTypeTab: opening.tosType })
useProjectTeamStore.getState().syncProjects([project])
usePermissionStore.setState({ rolePermissionsByProject: { [project.id]: { SPM: { 'plan:二级计划-编辑': true } } } })
usePlanStore.setState(structuredClone(starting))
execute(create)
assert.equal(usePlanStore.getState().createdLevel2Plans.length, 2, 'authorized actual create writes collection')
assert.deepEqual(Array.from(usePlanStore.getState().level2PlanMilestones), ['milestone'])
assert.equal(usePlanStore.getState().versions.length, 1)
execute(remove)
assert.equal(usePlanStore.getState().createdLevel2Plans.some(row => row.id === 'custom'), false)
console.log('project-team actual L2 create/delete handlers: passed')
