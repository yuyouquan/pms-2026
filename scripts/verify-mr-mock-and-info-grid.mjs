import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot, readSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const mocks = loadTypeScriptModule(root, 'src/data/mrVersionPlanMocks.ts')
const dateRules = loadTypeScriptModule(root, 'src/lib/mrDateRules.ts')
const aggregationRules = loadTypeScriptModule(root, 'src/lib/mrAggregationRules.ts')
const level1Rules = loadTypeScriptModule(root, 'src/lib/level1PlanRules.ts')
const styles = readSource(root, 'src/styles/globals.css')
const projectSpace = readSource(root, 'src/containers/ProjectSpaceContainer.tsx')

const stateA = mocks.createInitialMrVersionPlanState()
const stateB = mocks.createInitialMrVersionPlanState()
const instances = stateA.tosInstancesByProjectId['19']
const plans = Object.values(stateA.machinePlansByKey)
const versions = instances.map(instance => instance.tosVersion)

assert.deepEqual(versions, [
  '16.3.0.135',
  '16.3.0.140',
  '16.3.0.145',
  '16.3.0.150',
  '16.3.0.155',
  '16.3.0.160',
], 'the joint acceptance story must expose six sorted tOS versions')
assert.ok(plans.length >= 25 && plans.length <= 30, `visible machine-plan count must be 25-30, received ${plans.length}`)
assert.equal(stateA.stopReleaseRecords.length, 4, 'the acceptance seed must include four stopped-release records')
assert.ok(plans.filter(plan => plan.transferType === 'N/A').length >= 4, 'the acceptance seed must include at least four N/A rows')
assert.ok(plans.filter(plan => plan.transferType === 'N/A').every(plan => Object.keys(plan.dates).length === 0), 'N/A rows must persist no dates')
assert.deepEqual(stateA, stateB, 'MR acceptance seed must be deterministic')

assert.deepEqual(Object.keys(mocks.MR_MOCK_SCENARIOS), ['tos', 'joint', 'market', 'na', 'stopped'])
assert.ok(mocks.MR_MOCK_SCENARIOS.joint.includes('mp-deadline'))
assert.ok(mocks.MR_MOCK_SCENARIOS.na.includes('slash-dates'))
assert.ok(mocks.MR_MOCK_SCENARIOS.stopped.includes('future-rows-removed'))
assert.ok(Object.values(mocks.MR_MOCK_SCENARIOS).every(Object.isFrozen), 'every scenario group must be immutable')

for (const plan of plans) {
  assert.equal(aggregationRules.isPlanExcludedByStopRecord({
    plan,
    tosInstances: instances,
    stopRecords: stateA.stopReleaseRecords,
  }), false, `visible plan ${plan.projectId}::${plan.tosVersion} must not violate a stop record`)
}
for (const record of stateA.stopReleaseRecords) {
  assert.ok(plans.some(plan => plan.projectId === record.projectId), `stopped project ${record.projectId} must retain pre-stop history`)
}

const errors = dateRules.validateJointMachineRows({ tosInstances: instances, machinePlans: plans })
const messages = errors.map(error => error.message)
assert.ok(errors.length >= 8, 'the acceptance seed must expose several real validation errors')
assert.ok(messages.some(message => message.includes('同一1+N转测类型的版本转测时间需保持一致')))
assert.ok(messages.some(message => message.includes('至少1周')))
assert.ok(messages.some(message => message.includes('MP入库截止时间不得晚于tOS项目时间')))
assert.ok(messages.some(message => message.includes('不能超过下一个tOS版本')))
assert.ok(errors.every(error => error.boundaryDate ? error.message.endsWith(`（${error.boundaryDate}）`) : true), 'boundary messages must include the concrete date')
assert.ok(plans.some(plan => !errors.some(error => error.rowKey === `${plan.projectId}::${plan.tosVersion}`)), 'the matrix must retain clean rows')

assert.match(styles, /\.pms-project-info-display-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(8, minmax\(0, 1fr\)\)/, 'ordinary project-space fields must use eight desktop columns')
assert.match(styles, /\.pms-project-info-team-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/, 'team roles must use four desktop columns')
assert.match(styles, /@media\s*\(max-width:\s*1279px\)[\s\S]*?\.pms-project-info-display-grid[\s\S]*?repeat\(4,[\s\S]*?\.pms-project-info-team-grid[\s\S]*?repeat\(2,/, 'medium screens must reduce ordinary/team grids to 4/2')
assert.match(styles, /@media\s*\(max-width:\s*899px\)[\s\S]*?\.pms-project-info-display-grid[\s\S]*?repeat\(2,[\s\S]*?\.pms-project-info-team-grid[\s\S]*?grid-template-columns:\s*1fr/, 'small screens must reduce ordinary/team grids to 2/1')
assert.match(styles, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.pms-project-info-display-grid[\s\S]*?grid-template-columns:\s*1fr/, 'phones must use one ordinary field per row')
assert.match(projectSpace, /pms-project-info-legacy-grid/, 'capability-project basic information must opt into the responsive legacy grid')
assert.match(projectSpace, /pms-project-info-legacy-team-grid/, 'capability-project team information must opt into the responsive legacy team grid')

const primaryScopeStart = projectSpace.indexOf('const planWorkspacePrimaryScopeTabs')
const primaryScopeEnd = projectSpace.indexOf('const planWorkspaceSecondaryScopeTabs', primaryScopeStart)
const primaryScopeSource = projectSpace.slice(primaryScopeStart, primaryScopeEnd)
assert.ok(primaryScopeStart >= 0 && primaryScopeEnd > primaryScopeStart, 'plan primary-scope rendering must remain discoverable')
assert.ok(primaryScopeSource.includes('(isWholeMachineProject || isTosVersionProject) && planLevelTabs'), 'machine and tOS projects must share the top plan-level tab placement')
assert.ok(
  primaryScopeSource.indexOf('(isWholeMachineProject || isTosVersionProject) && planLevelTabs')
    < primaryScopeSource.indexOf('showTosTypeTabs &&'),
  'machine and tOS plan-level tabs must render before market/type scope selectors',
)
assert.match(projectSpace, /const showTosTypeTabs = selectedProject\?\.type === PROJECT_TYPE_TOS_VERSION[\s\S]{0,140}projectPlanLevel === 'level1'/, 'tOS type selector must remain exclusive to the level-one plan')

const adminStructure = level1Rules.getLevel1StructurePermissions({
  projectType: '整机产品项目',
  isDraft: true,
  isSuperAdmin: true,
  isSpm: false,
})
assert.equal(adminStructure.canAddStage, false, 'super administrators must not add level-one stages')
assert.equal(adminStructure.canAddChild, true, 'the stage restriction must not remove administrator child-node maintenance')

console.log(`MR mock and information grid verification passed (${versions.length} tOS versions, ${plans.length} visible machine rows, ${errors.length} dynamic errors)`)
