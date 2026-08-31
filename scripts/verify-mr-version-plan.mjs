import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { loadTypeScriptModule, projectRoot, readSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const templateRules = loadTypeScriptModule(root, 'src/lib/mrTemplateRules.ts')
const templateMocks = loadTypeScriptModule(root, 'src/data/mrVersionPlanMocks.ts')
assert.equal(typeof templateMocks.MR_MOCK_SCENARIOS, 'object', 'MR mock scenarios must expose a stable catalog')
const level1PlanRules = loadTypeScriptModule(root, 'src/lib/level1PlanRules.ts')
const templateMocksSource = readSource(root, 'src/data/mrVersionPlanMocks.ts')
const task13PackageJson = JSON.parse(readSource(root, 'package.json'))
const mrBrowserVerifierSource = readSource(root, 'screenshots/verify-mr-version-plan-browser.mjs')
const planRules = loadTypeScriptModule(root, 'src/lib/mrVersionPlanRules.ts')
const aggregationRules = loadTypeScriptModule(root, 'src/lib/mrAggregationRules.ts')
const dateRules = loadTypeScriptModule(root, 'src/lib/mrDateRules.ts')
const adapter = loadTypeScriptModule(root, 'src/lib/mrPlanSourceAdapters.ts')
const shanghaiBusinessDate = loadTypeScriptModule(root, 'src/lib/shanghaiBusinessDate.ts')
const templateCompare = loadTypeScriptModule(root, 'src/lib/mrTemplateCompare.ts')
const templateConfigPermissions = loadTypeScriptModule(root, 'src/lib/mrTemplateConfigPermissions.ts')
const templateHistoryRules = loadTypeScriptModule(root, 'src/lib/mrTemplateHistory.ts')
const configSource = readSource(root, 'src/containers/ConfigContainer.tsx')
const mrTemplateTableSource = readSource(root, 'src/components/plans/MrTemplateTable.tsx')
const mrTemplateCompareSource = readSource(root, 'src/lib/mrTemplateCompare.ts')
const mrPlanGridSource = readSource(root, 'src/components/plans/MrPlanGrid.tsx')
const tosMrVersionPlanSource = readSource(root, 'src/components/plans/TosMrVersionPlan.tsx')
const projectSpaceSource = readSource(root, 'src/containers/ProjectSpaceContainer.tsx')
const globalsSource = readSource(root, 'src/styles/globals.css')
const uiSource = readSource(root, 'src/stores/ui.ts')
const headerSource = readSource(root, 'src/containers/AppShell.tsx')
const pageSource = readSource(root, 'src/app/page.tsx')
const jointContainerSource = readSource(root, 'src/containers/JointProjectSpaceContainer.tsx')
const jointPlanSource = readSource(root, 'src/components/joint/JointMrVersionPlan.tsx')
assert.doesNotMatch(jointPlanSource, /<Space\s+direction=/, 'MR joint space must not emit Ant Design Space deprecation errors')
assert.doesNotMatch(configSource, /<Divider\s+type=/, 'MR template configuration must not emit Ant Design Divider deprecation errors')
assert.doesNotMatch(configSource, /<Space[^>]*\ssplit=/, 'MR template configuration must not emit Ant Design Space deprecation errors')
assert.match(configSource, /function MrTemplateConfigSurface[\s\S]*message\.useMessage\(\)[\s\S]*Modal\.useModal\(\)/, 'MR template feedback must use scoped Ant Design context APIs')
const stopReleaseUiRules = loadTypeScriptModule(root, 'src/lib/mrStopReleaseUiRules.ts')
const machineMarketRules = loadTypeScriptModule(root, 'src/lib/mrMachineMarketRules.ts')
const navigationRules = loadTypeScriptModule(root, 'src/lib/mrNavigationRules.ts')
const templateCompatibility = loadTypeScriptModule(root, 'src/lib/projectTemplateCompatibility.ts')
const machineMrVersionPlanSource = readSource(root, 'src/components/plans/MachineMrVersionPlan.tsx')
const NOW = '2026-08-29T08:00:00.000Z'

const tsConfigPath = path.join(root, 'tsconfig.json')
const tsConfigFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile)
assert.equal(tsConfigFile.error, undefined, 'MR AST contract must read tsconfig.json')
const parsedTsConfig = ts.parseJsonConfigFileContent(tsConfigFile.config, ts.sys, root, { noEmit: true }, tsConfigPath)
assert.equal(parsedTsConfig.errors.length, 0, 'MR AST contract must parse tsconfig.json')
const mrRulePaths = [
  path.join(root, 'src/lib/mrVersionPlanRules.ts'),
  path.join(root, 'src/lib/mrDateRules.ts'),
]
const mrTypesPath = path.join(root, 'src/types/mrVersionPlan.ts')
const mrAstProgram = ts.createProgram({
  rootNames: [...mrRulePaths, mrTypesPath],
  options: parsedTsConfig.options,
})
const mrAstChecker = mrAstProgram.getTypeChecker()
const mrTypesSource = mrAstProgram.getSourceFile(mrTypesPath)
assert.ok(mrTypesSource, 'MR AST contract must load mrVersionPlan types')
const mrCellErrorDeclaration = mrTypesSource.statements.find(statement => (
  ts.isInterfaceDeclaration(statement) && statement.name.text === 'MrCellError'
))
assert.ok(mrCellErrorDeclaration, 'MR AST contract must find MrCellError')
const mrCellErrorType = mrAstChecker.getTypeAtLocation(mrCellErrorDeclaration.name)

function unwrapTsExpression(expression) {
  let current = expression
  while (
    ts.isParenthesizedExpression(current)
    || ts.isAsExpression(current)
    || ts.isTypeAssertionExpression(current)
    || ts.isNonNullExpression(current)
    || ts.isSatisfiesExpression(current)
  ) current = current.expression
  return current
}

function isMrCellErrorArray(type) {
  const elementType = mrAstChecker.getIndexTypeOfType(type, ts.IndexKind.Number)
  return Boolean(elementType && mrAstChecker.isTypeAssignableTo(elementType, mrCellErrorType))
}

function isInsideMrCellErrorValidator(node) {
  let current = node.parent
  while (current) {
    if (ts.isFunctionLike(current)) {
      const signature = mrAstChecker.getSignatureFromDeclaration(current)
      if (signature && isMrCellErrorArray(mrAstChecker.getReturnTypeOfSignature(signature))) return true
    }
    current = current.parent
  }
  return false
}

function assertMrErrorPushContract(sourceFile) {
  const allowedConstructors = new Set(['makeMrBoundaryError', 'makeMrFormatError'])
  let inspectedPushes = 0
  const visit = node => {
    if (
      ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === 'push'
      && isInsideMrCellErrorValidator(node)
    ) {
      const receiver = unwrapTsExpression(node.expression.expression)
      if (isMrCellErrorArray(mrAstChecker.getTypeAtLocation(receiver))) {
        inspectedPushes += 1
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
        const location = `${path.relative(root, sourceFile.fileName)}:${line + 1}:${character + 1}`
        assert.equal(node.arguments.length, 1, `${location} MR error push must have exactly one argument`)
        const argument = unwrapTsExpression(node.arguments[0])
        const constructor = ts.isCallExpression(argument) ? unwrapTsExpression(argument.expression) : undefined
        assert.ok(
          constructor && ts.isIdentifier(constructor) && allowedConstructors.has(constructor.text),
          `${location} MR error push must call makeMrBoundaryError or makeMrFormatError`,
        )
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  assert.ok(inspectedPushes > 0, `${path.relative(root, sourceFile.fileName)} must expose an MR error push contract`)
}

function assertMrBoundaryHelperContract(sourceFile) {
  const helper = sourceFile.statements.find(statement => (
    ts.isFunctionDeclaration(statement) && statement.name?.text === 'makeMrBoundaryError'
  ))
  assert.ok(helper && ts.isFunctionDeclaration(helper), 'makeMrBoundaryError must be a function declaration')
  assert.ok(helper.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword), 'makeMrBoundaryError must be exported')
  assert.deepEqual(helper.parameters.map(parameter => parameter.name.getText(sourceFile)), ['base', 'message', 'date', 'type'])
  assert.ok(helper.parameters.every(parameter => !parameter.questionToken && !parameter.initializer && !parameter.dotDotDotToken), 'makeMrBoundaryError parameters must be required')
  assert.equal(helper.parameters[2].type?.getText(sourceFile), 'string')
  assert.equal(helper.parameters[3].type?.getText(sourceFile), 'MrBoundaryType')
  assert.equal(helper.type?.getText(sourceFile), 'MrBoundaryError')
}

// The previous 2/10 call-count checks were brittle under safe refactors and
// could be padded with dead calls. The AST contract now checks every real push
// into an MrCellError array inside an MrCellError[] validator, independent of
// variable names or call-site count. Row-grouping copies are outside validators.
const [planRulesAstSource, dateRulesAstSource] = mrRulePaths.map(filePath => mrAstProgram.getSourceFile(filePath))
assert.ok(planRulesAstSource && dateRulesAstSource, 'MR AST contract must load both rule modules')
assertMrBoundaryHelperContract(planRulesAstSource)
assertMrErrorPushContract(planRulesAstSource)
assertMrErrorPushContract(dateRulesAstSource)
assert.deepEqual(planRules.makeMrBoundaryError(
  { rowKey: 'row', activityId: 'activity', activityName: '测试开始时间' },
  '测试开始时间不能早于下限',
  '2026-07-01',
  'minimum',
), {
  rowKey: 'row', activityId: 'activity', activityName: '测试开始时间',
  message: '测试开始时间不能早于下限（2026-07-01）', boundaryDate: '2026-07-01', boundaryType: 'minimum',
})
assert.throws(() => planRules.makeMrBoundaryError(
  { rowKey: 'row', activityId: 'activity', activityName: '测试开始时间' },
  '测试开始时间不能早于下限',
  '',
  'minimum',
), /MR边界日期格式不正确/)

// Machine project-space MR projection: only meaningful numeric joint rows
// project into the market plan, with structure retained from the exact tOS
// instance snapshot rather than today's template.
const machineProjectionActivities = [
  { id: 'stage', parentId: null, order: 0, activityName: '快照阶段' },
  { id: 'node', parentId: 'stage', order: 0, activityName: '快照节点' },
]
const machineProjectionInstance = {
  projectId: 'tos-project-16.3', tosVersion: '16.3.0.140', templateVersionId: 'template-v7',
  activities: machineProjectionActivities, dates: { node: '2026-07-01' },
  createdBy: '管理员', createdAt: NOW, updatedBy: '管理员', updatedAt: NOW,
}
const machineProjectionPlan = {
  projectId: 'machine-c09', tosProjectId: 'tos-project-16.3', tosVersion: '16.3.0.140',
  transferType: '1', dates: { node: '2026-07-02' }, updatedBy: '张三', updatedAt: NOW,
}
assert.equal(machineMarketRules.isEligibleMachineMrPlan(machineProjectionPlan), true)
assert.equal(machineMarketRules.isEligibleMachineMrPlan({ ...machineProjectionPlan, dates: {} }), false)
assert.equal(machineMarketRules.isEligibleMachineMrPlan({ ...machineProjectionPlan, transferType: 'N/A' }), false)
assert.equal(machineMarketRules.isEligibleMachineMrPlan({ ...machineProjectionPlan, transferType: '2', dates: { node: '2026-02-30' } }), false)
assert.equal(machineMarketRules.isEligibleMachineMrPlan({ ...machineProjectionPlan, transferType: '2', dates: { node: '2026/07/02' } }), false)
const marketRows = [
  { id: 'ru', market: 'RU', isMain: false, followsMain: false },
  { id: 'op', market: 'OP', isMain: true, followsMain: false },
  { id: 'in', market: 'IN', isMain: false, followsMain: false },
]
const machineProjection = machineMarketRules.projectMachineMarketMrVersions({
  projectId: 'machine-c09',
  plansByKey: {
    'machine-c09::16.3.0.140': machineProjectionPlan,
    'machine-c09::16.3.0.145': { ...machineProjectionPlan, tosVersion: '16.3.0.145', dates: { node: '2026-07-09' } },
    'other::16.3.0.140': { ...machineProjectionPlan, projectId: 'other' },
  },
  instancesByProjectId: { 'tos-project-16.3': [machineProjectionInstance] },
  marketRows,
})
assert.deepEqual(machineProjection.versions.map(version => version.tosVersion), ['16.3.0.140'])
assert.deepEqual(machineProjection.missingInstanceVersions, ['16.3.0.145'])
assert.deepEqual(machineProjection.markets, ['OP', 'RU', 'IN'])
assert.equal(machineProjection.mainMarket, 'OP')
assert.equal(machineProjection.versions[0].templateVersionId, 'template-v7')
assert.deepEqual(machineProjection.versions[0].activities, machineProjectionActivities)
assert.notEqual(machineProjection.versions[0].activities, machineProjectionActivities)
assert.notEqual(machineProjection.versions[0].activities[0], machineProjectionActivities[0])
assert.notEqual(machineProjection.versions[0].plan, machineProjectionPlan)
assert.notEqual(machineProjection.versions[0].plan.dates, machineProjectionPlan.dates)
assert.deepEqual(machineProjectionActivities, [
  { id: 'stage', parentId: null, order: 0, activityName: '快照阶段' },
  { id: 'node', parentId: 'stage', order: 0, activityName: '快照节点' },
])
assert.equal(machineMarketRules.getMachineMarketDate({
  plan: machineProjectionPlan, overridesByKey: {}, market: 'OP', mainMarket: 'OP', activityId: 'node',
}), '2026-07-02')
assert.equal(machineMarketRules.getMachineMarketDate({
  plan: machineProjectionPlan,
  overridesByKey: { 'machine-c09::16.3.0.140::RU': { projectId: 'machine-c09', tosVersion: '16.3.0.140', market: 'RU', mainMarket: 'OP', dates: { node: '2026-07-01' } } },
  market: 'RU', mainMarket: 'OP', activityId: 'node',
}), '2026-07-01')
const edgeMarketRows = [
  { id: 'op-space', market: ' OP ', isMain: true, followsMain: false },
  { id: 'ru-first', market: 'RU', isMain: false, followsMain: false },
  { id: 'op-duplicate', market: 'OP', isMain: false, followsMain: false },
  { id: 'blank', market: '   ', isMain: false, followsMain: false },
  { id: 'ru-duplicate', market: ' RU ', isMain: false, followsMain: false },
]
const edgeMarketsBefore = structuredClone(edgeMarketRows)
assert.deepEqual(machineMarketRules.orderedMachineMarkets(edgeMarketRows), { mainMarket: 'OP', markets: ['OP', 'RU'] })
assert.deepEqual(edgeMarketRows, edgeMarketsBefore)

assert.equal(navigationRules.resolveMrPlanNavigationAction({
  intentProjectId: 'machine-a', selectedProjectId: 'machine-b', activeContextMatches: false, targetAvailable: false,
}), 'clear-stale')
assert.equal(navigationRules.resolveMrPlanNavigationAction({
  intentProjectId: 'machine-a', selectedProjectId: 'machine-a', activeContextMatches: true, targetAvailable: false,
}), 'wait')
assert.equal(navigationRules.resolveMrPlanNavigationAction({
  intentProjectId: 'machine-a', selectedProjectId: 'machine-a', activeContextMatches: false, targetAvailable: false,
}), 'wait')
assert.equal(navigationRules.resolveMrPlanNavigationAction({
  intentProjectId: 'machine-a', selectedProjectId: 'machine-a', activeContextMatches: true, targetAvailable: true,
}), 'focus')

for (const label of ['tOS版本号', '活动序号', '活动名称', '市场项目', '竖版视图', '横版视图']) {
  assert.ok(machineMrVersionPlanSource.includes(label), `machine MR source label: ${label}`)
}
assert.match(machineMrVersionPlanSource, /getMainMarket/)
assert.match(machineMrVersionPlanSource, /主市场对应时间未填写，当前市场不可填写/)
assert.match(machineMrVersionPlanSource, /非主市场时间不得晚于主市场对应时间/)
assert.match(machineMrVersionPlanSource, /validateMachineMarketDate/)
assert.match(machineMrVersionPlanSource, /marketOverridesByKey/)
assert.match(machineMrVersionPlanSource, /resolveMrPermissions/)
assert.match(machineMrVersionPlanSource, /machineProjectId:\s*project\.id/)
assert.match(machineMrVersionPlanSource, /updateMarketDate/)
assert.match(machineMrVersionPlanSource, /machine::\$\{project\.id\}/)
assert.match(machineMrVersionPlanSource, /data-mr-tos-version/)
assert.match(machineMrVersionPlanSource, /data-mr-version/)
assert.match(machineMrVersionPlanSource, /renderMachineMrErrorTrigger/)
assert.match(machineMrVersionPlanSource, /tabIndex=\{0\}/)
assert.match(machineMrVersionPlanSource, /aria-label=\{`\$\{version\.tosVersion\}-\$\{market\}-\$\{activity\.activityName\}-错误：\$\{errors\.join\(['"]；['"]\)\}`\}/)
assert.match(machineMrVersionPlanSource, /market\s*===\s*mainMarket\s*\|\|\s*!permission\.canEditMarket[\s\S]*renderMachineMrErrorTrigger/)
assert.match(projectSpaceSource, /isWholeMachineProject[\s\S]*['"]一级计划['"][\s\S]*['"]三级计划-MR版本计划['"]/)
assert.match(projectSpaceSource, /showMarketControls\s*=\s*isMachineProjectType\([^)]*\)[\s\S]*projectPlanLevel\s*===\s*['"]level1['"]/)
assert.match(projectSpaceSource, /市场编辑/)
assert.match(projectSpaceSource, /<MachineMrVersionPlan/)
assert.match(projectSpaceSource, /data-plan-shared-market-editor/)
assert.ok(projectSpaceSource.indexOf('{isWholeMachineProject && planLevelTabs}') < projectSpaceSource.indexOf('{showMarketControls && ('))
assert.match(projectSpaceSource, /document\.activeElement\s*===\s*target[\s\S]*consumeMrPlanNavigationIntent/)
assert.match(projectSpaceSource, /resolveMrPlanNavigationAction/)
assert.match(projectSpaceSource, /['"]clear-stale['"][\s\S]*consumeMrPlanNavigationIntent/)
assert.doesNotMatch(machineMrVersionPlanSource, /templateVersions|DEFAULT_MR_TEMPLATE_ACTIVITIES/)

// Joint project space: navigation, real source aggregation, stable editable grid and validation UI.
assert.ok(headerSource.indexOf('项目列表') < headerSource.indexOf('联合项目空间'))
assert.ok(headerSource.indexOf('联合项目空间') < headerSource.indexOf('tOS路标'))
assert.match(uiSource, /\| ['"]jointProjectSpace['"]/)
assert.match(pageSource, /activeModule === ['"]jointProjectSpace['"]/)
assert.match(jointContainerSource, /tOS&整机MR版本计划/)
for (const label of ['tOS版本号', '项目名称', '1+N版本类型', '停止发版', '停止发版记录']) {
  assert.ok(jointPlanSource.includes(label))
}
const jointFixedLabels = ['tOS版本号', '项目名称', '市场名', '产品线', 'SPM', '是否MADA', 'SOC平台', '组包方式', '1+N转测类型']
jointFixedLabels.reduce((previousIndex, label) => {
  const index = jointPlanSource.indexOf(label, previousIndex + 1)
  assert.ok(index > previousIndex, `joint fixed column order: ${label}`)
  return index
}, -1)
assert.match(headerSource, /navigateWithEditGuard\([\s\S]*setTransferView\(null\)/)
assert.match(jointPlanSource, /rehydrateMrVersionPlanStore/)
assert.match(jointPlanSource, /buildMrAggregationSources/)
assert.match(jointPlanSource, /reconcileMachinePlans/)
assert.match(jointPlanSource, /const today = useShanghaiBusinessDate\(\)/)
assert.match(jointPlanSource, /buildJointMrColumnSchema/)
assert.match(jointPlanSource, /resolveMrPermissions/)
assert.match(jointPlanSource, /validateJointMachineRows/)
assert.match(jointPlanSource, /selectTosMrVersionCandidates/)
assert.match(jointPlanSource, /resolveTosMrInstanceDateAccess/)
assert.match(jointPlanSource, /validateTosMrInstanceDates/)
assert.match(jointPlanSource, /MrDateCellContent/)
assert.match(jointPlanSource, /pms-mr-invalid-cell/)
assert.doesNotMatch(jointPlanSource, /ExclamationCircleOutlined/)
assert.doesNotMatch(jointPlanSource, /title:\s*['"]错误提示['"]|data-mr-fixed-error-cell/)
assert.match(jointPlanSource, /aria-label=\{`打开项目-\$\{metadata\.projectName\}`\}/)
assert.match(jointPlanSource, /const MR_TRANSFER_OPTIONS[^;]*['"]N\/A['"][\s\S]*['"]8['"]/)
assert.match(jointPlanSource, /updateMachineTransferType/)
assert.match(jointPlanSource, /updateMachineDate/)
assert.match(jointPlanSource, /if\s*\(!updated\)/)
assert.match(jointPlanSource, /machineProjectId:\s*project\.id/)
assert.match(jointPlanSource, /compareTosVersionNumbers/)
assert.match(jointPlanSource, /leftName\.localeCompare\(rightName/)
assert.match(jointPlanSource, /kind === ['"]tos-reference['"][\s\S]*disabled/)
assert.match(jointPlanSource, /kind === ['"]tos-reference['"][\s\S]*['"]\/['"]/)
assert.match(jointPlanSource, /useMemo\([\s\S]*sourceInput/)
assert.match(jointPlanSource, /useShanghaiBusinessDate/)
assert.match(globalsSource, /\.pms-joint-mr-table/)
assert.match(globalsSource, /\.pms-joint-mr-table[\s\S]*\.ant-table-cell-fix-left/)
assert.equal([...jointPlanSource.matchAll(/fixed:\s*['"]left['"]/g)].length, 2)
assert.equal([...jointPlanSource.matchAll(/fixed:\s*['"]right['"]/g)].length, 0)
assert.match(globalsSource, /\.pms-joint-mr-table[\s\S]*background:\s*#fff/)
assert.match(
  globalsSource,
  /\.pms-joint-mr-table[\s\S]*\.ant-table-cell-fix-start[\s\S]*position:\s*sticky\s*!important/,
)
const jointMrCss = globalsSource.slice(globalsSource.indexOf('/* Joint MR version plan'))
assert.match(jointMrCss, /\.ant-table-thead[^{}]*\.ant-table-cell\s*\{[^}]*z-index:\s*1[^}]*background:\s*#f7f7ff/)
assert.match(jointMrCss, /th\.ant-table-cell-fix-start,[\s\S]*th\.ant-table-cell-fix-end\s*\{[^}]*position:\s*sticky\s*!important[^}]*z-index:\s*6[^}]*background:\s*#f7f7ff/)
assert.match(jointMrCss, /td\.ant-table-cell-fix-start,[\s\S]*td\.ant-table-cell-fix-end\s*\{[^}]*position:\s*sticky\s*!important[^}]*z-index:\s*3[^}]*background:\s*#fff/)
assert.match(jointMrCss, /\.pms-joint-mr-reference-row\s*>\s*td\.ant-table-cell-fix-start,[\s\S]*\.pms-joint-mr-reference-row\s*>\s*td\.ant-table-cell-fix-end\s*\{[^}]*z-index:\s*3[^}]*background:\s*#fffbe8/)

// Stop-release UI: only present, unstopped machine projects in the current
// user's authoritative permission scope are candidates. A missing exact
// collection activity disables submission; an existing empty date stays eligible.
const stopUiActivities = [
  { id: 'p', parentId: null, order: 0, activityName: '需求&修改点' },
  { id: 'collect', parentId: 'p', order: 0, activityName: '修改点收集开始时间' },
]
const stopUiInstance = (version, date) => ({
  projectId: 'tos-project-16.3', tosVersion: version, templateVersionId: 'tpl',
  activities: stopUiActivities, dates: date === undefined ? {} : { collect: date },
  createdBy: '张三', createdAt: NOW, updatedBy: '张三', updatedAt: NOW,
})
const stopUiRows = [
  { key: 'tos-ref', kind: 'tos-reference', projectId: 'tos-project-16.3', tosProjectId: 'tos-project-16.3', tosVersion: '16.3.0.140', instance: stopUiInstance('16.3.0.140', '2026-07-01') },
  { key: 'own-140', kind: 'machine', projectId: 'own', tosProjectId: 'tos-project-16.3', tosVersion: '16.3.0.140', plan: { projectId: 'own', tosProjectId: 'tos-project-16.3', tosVersion: '16.3.0.140', transferType: '1', dates: {}, updatedBy: '张三', updatedAt: NOW } },
  { key: 'own-145', kind: 'machine', projectId: 'own', tosProjectId: 'tos-project-16.3', tosVersion: '16.3.0.145', plan: { projectId: 'own', tosProjectId: 'tos-project-16.3', tosVersion: '16.3.0.145', transferType: '1', dates: {}, updatedBy: '张三', updatedAt: NOW } },
  { key: 'other', kind: 'machine', projectId: 'other', tosProjectId: 'tos-project-16.3', tosVersion: '16.3.0.140', plan: { projectId: 'other', tosProjectId: 'tos-project-16.3', tosVersion: '16.3.0.140', transferType: '1', dates: {}, updatedBy: '李白', updatedAt: NOW } },
]
const ownStopPermission = planRules.resolveMrPermissions({ currentUser: '张三', globalAdminUsers: [], tosManagerUsers: [], machineSpm: '张三', machineProjectId: 'own', context: 'joint-machine' })
const otherStopPermission = planRules.resolveMrPermissions({ currentUser: '张三', globalAdminUsers: [], tosManagerUsers: [], machineSpm: '李白', machineProjectId: 'other', context: 'joint-machine' })
const adminStopPermission = planRules.resolveMrPermissions({ currentUser: '管理员', globalAdminUsers: ['管理员'], tosManagerUsers: [], machineSpm: '', machineProjectId: 'other', context: 'joint-machine' })
const stopUiMetadata = {
  own: { projectName: '我的项目', marketName: '/', productLine: '/', spm: '张三', spmUsers: ['张三'], isMada: '否', socPlatform: '/', packageMode: '/' },
  other: { projectName: '其他项目', marketName: '/', productLine: '/', spm: '李白', spmUsers: ['李白'], isMada: '否', socPlatform: '/', packageMode: '/' },
}
const ownCandidates = stopReleaseUiRules.buildStopReleaseCandidates({
  rows: stopUiRows,
  instances: [stopUiInstance('16.3.0.140', '2026-07-01'), stopUiInstance('16.3.0.145')],
  stopRecords: [],
  permissionsByProjectId: new Map([['own', ownStopPermission], ['other', otherStopPermission]]),
  metadataByProjectId: stopUiMetadata,
})
assert.deepEqual(ownCandidates, [{ projectId: 'own', projectName: '我的项目', disabled: false }])
const adminCandidates = stopReleaseUiRules.buildStopReleaseCandidates({
  rows: stopUiRows,
  instances: [stopUiInstance('16.3.0.140', '2026-07-01'), stopUiInstance('16.3.0.145')],
  stopRecords: [{ id: 'stopped', projectId: 'own', projectName: '历史项目名', stopDate: '2026-07-01', operator: '管理员', operatedAt: NOW }],
  permissionsByProjectId: new Map([['own', adminStopPermission], ['other', adminStopPermission]]),
  metadataByProjectId: stopUiMetadata,
})
assert.deepEqual(adminCandidates, [{ projectId: 'other', projectName: '其他项目', disabled: false }])
const missingReferenceCandidates = stopReleaseUiRules.buildStopReleaseCandidates({
  rows: stopUiRows.filter(row => row.kind === 'machine' && row.projectId === 'own'),
  instances: [stopUiInstance('16.3.0.140'), stopUiInstance('16.3.0.145')],
  stopRecords: [], permissionsByProjectId: new Map([['own', ownStopPermission]]), metadataByProjectId: stopUiMetadata,
})
assert.deepEqual(missingReferenceCandidates, [{ projectId: 'own', projectName: '我的项目', disabled: false }])
const exactActivityMissingCandidates = stopReleaseUiRules.buildStopReleaseCandidates({
  rows: stopUiRows.filter(row => row.kind === 'machine' && row.projectId === 'own'),
  instances: [{ ...stopUiInstance('16.3.0.140'), activities: [{ id: 'p', parentId: null, order: 0, activityName: '需求&修改点' }] }],
  stopRecords: [], permissionsByProjectId: new Map([['own', ownStopPermission]]), metadataByProjectId: stopUiMetadata,
})
assert.deepEqual(exactActivityMissingCandidates, [{
  projectId: 'own', projectName: '我的项目', disabled: true,
  reason: '当前MR版本计划缺少修改点收集开始时间，无法判断停止范围',
}])
const malformedReferenceCandidates = stopReleaseUiRules.buildStopReleaseCandidates({
  rows: stopUiRows.filter(row => row.kind === 'machine' && row.projectId === 'own'),
  instances: [stopUiInstance('16.3.0.140', '2026-02-30')],
  stopRecords: [], permissionsByProjectId: new Map([['own', ownStopPermission]]), metadataByProjectId: stopUiMetadata,
})
assert.deepEqual(malformedReferenceCandidates, [{
  projectId: 'own', projectName: '我的项目', disabled: true,
  reason: '当前MR版本计划缺少修改点收集开始时间，无法判断停止范围',
}])
assert.equal(stopReleaseUiRules.resolveStopReleaseButtonReason([], 0), '当前筛选结果没有可停止发版的项目')
assert.equal(stopReleaseUiRules.resolveStopReleaseButtonReason([], 2), '当前用户没有可停止发版的项目')
assert.equal(stopReleaseUiRules.resolveStopReleaseButtonReason(exactActivityMissingCandidates, 2), '当前MR版本计划缺少修改点收集开始时间，无法判断停止范围')
assert.equal(stopReleaseUiRules.resolveStopReleaseButtonReason(missingReferenceCandidates, 2), undefined)
const historyInput = [
  { id: 'b', projectId: 'gone', projectName: '已删除项目', stopDate: '2026-07-02', operator: '李白', operatedAt: '2026-08-29T01:00:00.000Z' },
  { id: 'a', projectId: 'own', projectName: '我的项目', stopDate: '2026-07-01', operator: '张三', operatedAt: '2026-08-29T02:00:00.000Z' },
  { id: 'c', projectId: 'other', projectName: '其他项目', stopDate: '2026-07-03', operator: '王五', operatedAt: '2026-08-29T01:00:00.000Z' },
]
assert.deepEqual(stopReleaseUiRules.sortStopReleaseHistory(historyInput).map(record => record.id), ['a', 'b', 'c'])
assert.deepEqual(historyInput.map(record => record.id), ['b', 'a', 'c'])
assert.equal(stopReleaseUiRules.formatStopReleaseOperatedAt('2026-08-29T08:00:00.000Z'), '2026-08-29 16:00:00')
assert.equal(stopReleaseUiRules.formatStopReleaseOperatedAt('legacy-time'), 'legacy-time')
assert.equal(stopReleaseUiRules.formatStopReleaseOperatedAt(''), '-')
for (const label of ['停止发版项目名称', '停止发版日期', '操作人', '操作时间', '操作项目']) assert.ok(jointPlanSource.includes(label))
assert.match(jointPlanSource, /stopRelease\(/)
assert.match(jointPlanSource, /if\s*\(!stopped\)/)
assert.doesNotMatch(jointPlanSource, /恢复发版|重新发版|删除记录/)
assert.match(jointPlanSource, /buildStopReleaseCandidates\(\{[\s\S]*?rows:\s*filteredRows/)
assert.match(jointPlanSource, /resolveStopReleaseButtonReason\(stopCandidates,\s*visibleMachineRowCount\)/)
assert.match(jointPlanSource, /render:\s*formatStopReleaseOperatedAt/)
assert.match(jointPlanSource, /useEffect\(\(\)\s*=>\s*\{[\s\S]*?stopProjectId[\s\S]*?stopCandidates\.some[\s\S]*?setStopProjectId\(undefined\)/)

// Joint-space deep links mutate selection only inside the guarded action, set
// the MR tab and intent together, and clear the transient intent only after an
// accessible matching target was focused.
assert.match(uiSource, /interface MrPlanNavigationIntent[\s\S]*source:\s*['"]joint-mr['"][\s\S]*mrTosVersion:\s*string/)
assert.match(uiSource, /setMrPlanNavigationIntent/)
assert.match(uiSource, /consumeMrPlanNavigationIntent/)
assert.match(uiSource, /clearMrPlanNavigationIntent/)
assert.match(jointContainerSource, /navigateWithEditGuard\([\s\S]*activateProject\(project\)[\s\S]*setMrPlanNavigationIntent[\s\S]*setProjectPlanLevel\(['"]mr-version-plan['"]\)[\s\S]*enterProjectSpace\(\{\s*module:\s*['"]jointProjectSpace['"]\s*\}\)/)
assert.match(jointContainerSource, /onOpenProject=\{handleOpenProject\}/)
assert.match(mrPlanGridSource, /data-mr-tos-version/)
assert.match(mrPlanGridSource, /tabIndex:\s*-1/)
assert.match(projectSpaceSource, /mrPlanNavigationIntent[\s\S]*querySelector[\s\S]*scrollIntoView[\s\S]*focus\(\)[\s\S]*consumeMrPlanNavigationIntent/)
assert.match(projectSpaceSource, /targetAction\s*!==\s*['"]focus['"]\s*\|\|\s*!target/)
assert.doesNotMatch(projectSpaceSource, /clearMrPlanNavigationIntent/)
const deepLinkEffectSource = projectSpaceSource.slice(
  projectSpaceSource.indexOf("mrPlanNavigationIntent.source !== 'joint-mr'"),
  projectSpaceSource.indexOf('// 进入项目空间「计划」时按权限', projectSpaceSource.indexOf("mrPlanNavigationIntent.source !== 'joint-mr'")),
)
assert.ok(deepLinkEffectSource.indexOf('target.scrollIntoView') < deepLinkEffectSource.indexOf('target.focus()'))
assert.ok(deepLinkEffectSource.indexOf('target.focus()') < deepLinkEffectSource.indexOf('consumeMrPlanNavigationIntent()', deepLinkEffectSource.indexOf('target.focus()')))
assert.match(deepLinkEffectSource, /remainingAttempts[\s\S]*setTimeout/, 'deep-link focus must retry until the MR table row mounts')

// The business date rolls over without a render, emits once, reschedules once,
// and releases the active timer on unmount.
let fakeNow = new Date('2026-08-29T15:59:59.900Z')
let nextTimerId = 0
const timers = new Map()
const emittedBusinessDates = []
const cancelBusinessDateTicker = shanghaiBusinessDate.createShanghaiBusinessDateTicker(
  value => emittedBusinessDates.push(value),
  {
    now: () => fakeNow,
    setTimer: (callback, delay) => {
      const id = ++nextTimerId
      timers.set(id, { callback, delay })
      return id
    },
    clearTimer: id => timers.delete(id),
  },
)
assert.equal(shanghaiBusinessDate.getShanghaiBusinessDate(fakeNow), '2026-08-29')
assert.equal(timers.size, 1)
assert.equal([...timers.values()][0].delay, 125)
const midnightTimer = [...timers.entries()][0]
timers.delete(midnightTimer[0])
fakeNow = new Date('2026-08-29T16:00:00.025Z')
midnightTimer[1].callback()
assert.deepEqual(emittedBusinessDates, ['2026-08-30'])
assert.equal(timers.size, 1)
cancelBusinessDateTicker()
assert.equal(timers.size, 0)

assert.match(configSource, /key:\s*['"]mr-version-plan['"][\s\S]*三级计划-MR版本计划/)
assert.match(configSource, /selectedTemplateType\s*===\s*PROJECT_TYPE_TOS_VERSION/)
assert.match(configSource, /<MrTemplateTable/)
assert.doesNotMatch(configSource, /<Level3TemplateTable/)
assert.match(configSource, /rehydrateMrVersionPlanStore\(\)/)
assert.match(configSource, /useMrVersionPlanStore/)
assert.doesNotMatch(configSource, /isGlobalAdmin\(currentLoginUser\)/)
assert.match(configSource, /useHasGlobalPermission\(currentLoginUser\)/)
assert.match(configSource, /canEditMrTemplate[\s\S]*configCenter:planEdit/)
assert.match(configSource, /canPublishMrTemplate[\s\S]*configCenter:planPublish/)
assert.match(configSource, /canEditMrTemplate\s*&&\s*!draft/)
assert.match(configSource, /canPublishMrTemplate[\s\S]*publishRevision/)
assert.match(configSource, /validateMrTemplateForPublish/)
assert.match(configSource, /errors\.map\(/)
assert.match(configSource, /templateHistory/)
assert.match(configSource, /compareMrTemplateSnapshots/)
assert.match(configSource, /resolveMrTemplateHistoryActivityLabel/)
assert.match(configSource, /currentTemplateVersionId/)
assert.match(configSource, /useMrVersionPlanStore\.setState\(\{\s*currentTemplateVersionId:\s*versionId\s*\}\)/)
assert.match(configSource, /模板数据加载中/)

for (const title of ['tOS版本号', '活动序号', '活动名称', '日期']) {
  assert.match(mrTemplateTableSource, new RegExp(`title:\\s*['"]${title}['"]`))
}
assert.match(mrTemplateTableSource, /export interface MrTemplateTableProps[\s\S]*activities:\s*MrTemplateActivity\[\][\s\S]*editable:\s*boolean[\s\S]*onChange:\s*\(activities:\s*MrTemplateActivity\[\]\)\s*=>\s*void/)
assert.match(mrTemplateTableSource, /aria-label=\{`活动名称-\$\{row\.number\}`\}/)
assert.match(mrTemplateTableSource, /aria-label=\{`删除活动-\$\{row\.number\}`\}/)
assert.match(mrTemplateTableSource, /aria-label=\{`新增子活动-\$\{row\.number\}`\}/)
assert.match(mrTemplateTableSource, /aria-label=\{`拖动活动-\$\{row\.number\}`\}/)
assert.match(mrTemplateTableSource, /aria-label=['"]新增一级活动['"]/)
assert.match(mrTemplateTableSource, /moveMrTemplateActivity/)
assert.match(mrTemplateTableSource, /removeMrTemplateActivity/)
assert.match(mrTemplateTableSource, /activeRow\.parentId\s*!==\s*overRow\.parentId/)
assert.match(mrTemplateTableSource, /KeyboardSensor/)
assert.match(mrTemplateTableSource, /sortableKeyboardCoordinates/)
assert.match(mrTemplateTableSource, /useSensor\(KeyboardSensor,\s*\{\s*coordinateGetter:\s*sortableKeyboardCoordinates\s*\}\)/)
assert.match(mrTemplateTableSource, /type="button"[\s\S]*aria-label=\{`拖动活动-\$\{row\.number\}`\}/)
assert.match(mrTemplateTableSource, /normalizeMrTemplateActivities/)
assert.match(mrTemplateTableSource, /onChange\(/)
assert.doesNotMatch(mrTemplateTableSource, /row\.source\s*===\s*['"]custom['"]/)
assert.doesNotMatch(mrTemplateTableSource, /Level3TemplateTable/)
assert.match(globalsSource, /\.pms-mr-template-table/)
assert.match(globalsSource, /\.pms-mr-toolbar/)
assert.match(globalsSource, /\.pms-mr-invalid-cell/)
assert.match(globalsSource, /\.pms-config-template-tabs/)
assert.doesNotMatch(mrTemplateCompareSource, /\.sort\(.*activities/)

// tOS project-space MR plan: shared accessible views, guarded writes, and L1-source integration.
assert.match(projectSpaceSource, /三级计划-MR版本计划/)
assert.match(projectSpaceSource, /<TosMrVersionPlan/)
assert.match(projectSpaceSource, /projectPlanLevel\s*===\s*['"]mr-version-plan['"]/)
assert.match(projectSpaceSource, /showTosTypeTabs[\s\S]*projectPlanLevel\s*===\s*['"]level1['"]/)
assert.match(
  projectSpaceSource,
  /showMarketControls\s*=\s*isMachineProjectType\([^)]*\)\s*&&\s*projectPlanLevel\s*===\s*['"]level1['"]/,
)
assert.match(projectSpaceSource, /navigateWithEditGuard\(\(\)\s*=>\s*\{[\s\S]*setIsEditMode\(false\)[\s\S]*setProjectPlanLevel/)

assert.match(tosMrVersionPlanSource, /新增tOS版本号/)
assert.match(tosMrVersionPlanSource, /selectLatestPublishedTosLevel1/)
assert.match(tosMrVersionPlanSource, /selectTosMrVersionCandidates/)
assert.match(tosMrVersionPlanSource, /resolveMrPermissions/)
assert.match(tosMrVersionPlanSource, /validateTosMrInstanceDates/)
assert.match(tosMrVersionPlanSource, /resolveTosMrInstanceDateAccess/)
assert.match(tosMrVersionPlanSource, /rehydrateMrVersionPlanStore/)
assert.match(tosMrVersionPlanSource, /请先在配置中心发布三级计划-MR版本计划模板/)
assert.match(tosMrVersionPlanSource, /请先完善一级计划中的计划开始时间和计划完成时间/)
assert.match(tosMrVersionPlanSource, /当前tOS版本在最新发布的一级计划中不存在，无法修改日期/)
assert.match(tosMrVersionPlanSource, /if\s*\(!access\?\.canEdit\)/)
assert.match(tosMrVersionPlanSource, /instance\.activities[\s\S]*filter\(activity\s*=>\s*activity\.parentId\s*!==\s*null\)/)
assert.match(tosMrVersionPlanSource, /tos::\$\{project\.id\}/)
assert.match(tosMrVersionPlanSource, /vertical/)
assert.match(tosMrVersionPlanSource, /horizontal/)
assert.match(tosMrVersionPlanSource, /aria-label=['"]竖版视图['"]/)
assert.match(tosMrVersionPlanSource, /aria-label=['"]横版视图['"]/)
assert.match(tosMrVersionPlanSource, /addTosVersionInstance/)
assert.match(tosMrVersionPlanSource, /updateTosDate/)
assert.match(tosMrVersionPlanSource, /if\s*\(!updated\)/)

// tOS version search is display-only: filtering never narrows add candidates or write access.
assert.match(tosMrVersionPlanSource, /const\s*\[versionQuery,\s*setVersionQuery\]\s*=\s*useState\(['"]['"]\)/)
assert.match(
  tosMrVersionPlanSource,
  /const\s+visibleInstances\s*=\s*useMemo\([\s\S]*versionQuery\.trim\(\)\.toLocaleLowerCase\(\)[\s\S]*sortedInstances\.filter\([\s\S]*tosVersion\.toLocaleLowerCase\(\)\.includes\(query\)[\s\S]*:\s*sortedInstances[\s\S]*\[sortedInstances,\s*versionQuery\]/,
)
assert.match(tosMrVersionPlanSource, /usedVersions:\s*sortedInstances\.map\(/)
assert.match(tosMrVersionPlanSource, /new Map\(sortedInstances\.map\(/)
assert.match(tosMrVersionPlanSource, /visibleInstances\.forEach\(instance\s*=>/)
assert.match(tosMrVersionPlanSource, /const rows:\s*MrPlanGridRow\[\]\s*=\s*visibleInstances\.map\(/)
assert.match(tosMrVersionPlanSource, /<Input\.Search[\s\S]*allowClear[\s\S]*aria-label=['"]搜索tOS版本号['"][\s\S]*value=\{versionQuery\}[\s\S]*onChange=\{event\s*=>\s*setVersionQuery\(event\.target\.value\)\}/)
assert.match(tosMrVersionPlanSource, /<Input\.Search[\s\S]*aria-label=['"]搜索tOS版本号['"][\s\S]*<Button[\s\S]*aria-label=['"]新增tOS版本号['"]/, '搜索输入必须位于新增按钮左侧')
assert.match(tosMrVersionPlanSource, /description=\{versionQuery\.trim\(\)\s*\?\s*['"]未找到匹配的tOS版本号['"]\s*:\s*['"]暂无MR版本计划['"]\}/)
assert.match(tosMrVersionPlanSource, /<MrPlanGrid[\s\S]*logicalRows=\{rows\}/)
assert.doesNotMatch(tosMrVersionPlanSource, /useMrVersionPlanStore\([^\n]*versionQuery/)
assert.doesNotMatch(tosMrVersionPlanSource, /localStorage[\s\S]*versionQuery|versionQuery[\s\S]*localStorage/)

assert.match(mrPlanGridSource, /export interface MrPlanGridProps/)
assert.match(mrPlanGridSource, /mode:\s*MrPlanViewMode/)
assert.match(mrPlanGridSource, /editableCell:/)
assert.match(mrPlanGridSource, /cellErrors:/)
assert.match(mrPlanGridSource, /onDateChange:/)
assert.match(mrPlanGridSource, /pms-mr-parent-row/)
assert.match(mrPlanGridSource, /pms-mr-sticky-version/)
assert.match(mrPlanGridSource, /pms-mr-invalid-cell/)
assert.match(mrPlanGridSource, /slashDates/)
assert.match(mrPlanGridSource, /const ariaLabel\s*=\s*`\$\{row\.version\}-\$\{activity\.activityName\}-日期`/)
assert.match(mrPlanGridSource, /aria-label=\{ariaLabel\}/)
assert.match(mrPlanGridSource, /Tooltip/)
assert.match(mrPlanGridSource, /ExclamationCircleOutlined/)
assert.match(mrPlanGridSource, /export function MrDateCellContent/)
assert.match(mrPlanGridSource, /if\s*\(!messages\.length\)\s*return content/)
assert.match(mrPlanGridSource, /pms-mr-invalid-cell-content/)
assert.match(mrPlanGridSource, /className=['"]pms-mr-cell-error-icon['"][\s\S]*tabIndex=\{0\}[\s\S]*role=['"]img['"][\s\S]*aria-label=/)
assert.match(globalsSource, /\.pms-mr-invalid-cell-content/)
assert.match(globalsSource, /\.pms-mr-cell-error-icon/)
assert.match(globalsSource, /\.pms-mr-plan-grid/)
assert.match(globalsSource, /\.pms-mr-plan-grid[\s\S]*\.pms-mr-sticky-version/)
assert.match(globalsSource, /\.pms-mr-plan-grid[\s\S]*\.pms-mr-parent-row/)
assert.match(globalsSource, /\.pms-mr-plan-grid[\s\S]*\.pms-mr-invalid-cell/)

assert.doesNotMatch(templateMocksSource, /as unknown as MrTemplateActivity\[\]/)
assert.match(
  templateMocksSource,
  /export const DEFAULT_MR_TEMPLATE_ACTIVITIES:\s*readonly Readonly<MrTemplateActivity>\[\]\s*=/,
)

assert.equal(templateRules.DEFAULT_MR_TEMPLATE_ACTIVITIES.length, 15)
assert.deepEqual(
  templateRules.numberMrTemplateActivities(templateRules.DEFAULT_MR_TEMPLATE_ACTIVITIES)
    .map(row => [row.number, row.activityName]),
  [
    ['1', '需求&修改点'],
    ['1.1', '修改点收集开始时间'],
    ['1.2', '修改点锁定时间'],
    ['2', '入库&自测&转测'],
    ['2.1', 'MP入库开始时间'],
    ['2.2', 'MP入库截止时间'],
    ['2.3', '版本转测时间'],
    ['3', '版本测试'],
    ['3.1', '测试开始时间'],
    ['3.2', '测试完成时间'],
    ['4', '版本评审'],
    ['4.1', '评审时间'],
    ['5', '版本发布'],
    ['5.1', '软件归档时间'],
    ['5.2', 'OTA开放验证&部署'],
  ],
)

const LATER = '2026-08-30T08:00:00.000Z'
const parent = { id: 'stage-a', parentId: null, order: 0, activityName: '阶段A' }
const parentB = { id: 'stage-b', parentId: null, order: 1, activityName: '第二阶段' }
const childA = { id: 'node-a', parentId: parent.id, order: 0, activityName: '子活动A' }
const childB = { id: 'node-b', parentId: parent.id, order: 1, activityName: '子活动B' }
const childC = { id: 'node-c', parentId: parentB.id, order: 0, activityName: '子活动C' }
const grandchild = { id: 'node-a-child', parentId: childA.id, order: 0, activityName: '三级活动' }

assert.deepEqual(templateConfigPermissions.resolveMrTemplateConfigCapabilities(key => key === 'configCenter:planEdit'), {
  canEdit: true,
  canPublish: false,
})
assert.deepEqual(templateConfigPermissions.resolveMrTemplateConfigCapabilities(key => key === 'configCenter:planPublish'), {
  canEdit: false,
  canPublish: true,
})
assert.deepEqual(templateConfigPermissions.resolveMrTemplateConfigCapabilities(() => false), {
  canEdit: false,
  canPublish: false,
})

assert.deepEqual(templateRules.removeMrTemplateActivity([parent, childA, childB, parentB, childC], parent.id), [
  { ...parentB, order: 0 },
  { ...childC, order: 0 },
])
assert.deepEqual(templateRules.removeMrTemplateActivity([parent, childA, childB], childA.id), [
  { ...parent, order: 0 },
  { ...childB, order: 0 },
])

const compareBefore = [parent, childA, parentB, childC]
const compareAfter = [
  { ...parentB, order: 0 },
  { ...childC, parentId: parentB.id, order: 0, activityName: '子活动C-改名' },
  { id: 'stage-new', parentId: null, order: 1, activityName: '新增阶段' },
  { id: 'node-new', parentId: 'stage-new', order: 0, activityName: '新增节点' },
  { ...parent, order: 2 },
]
const compareBeforeClone = structuredClone(compareBefore)
const compareAfterClone = structuredClone(compareAfter)
assert.deepEqual(templateCompare.compareMrTemplateSnapshots(compareBefore, compareAfter), [
  { activityId: 'stage-b', number: '1', activityName: '第二阶段', changeType: 'reorder', before: '2', after: '1' },
  { activityId: 'node-c', number: '1.1', activityName: '子活动C-改名', changeType: 'rename', before: '子活动C', after: '子活动C-改名' },
  { activityId: 'node-c', number: '1.1', activityName: '子活动C-改名', changeType: 'reorder', before: '2.1', after: '1.1' },
  { activityId: 'stage-new', number: '2', activityName: '新增阶段', changeType: 'add', before: '-', after: '2' },
  { activityId: 'node-new', number: '2.1', activityName: '新增节点', changeType: 'add', before: '-', after: '2.1' },
  { activityId: 'stage-a', number: '3', activityName: '阶段A', changeType: 'reorder', before: '1', after: '3' },
  { activityId: 'node-a', number: '1.1', activityName: '子活动A', changeType: 'remove', before: '1.1', after: '-' },
])
assert.deepEqual(compareBefore, compareBeforeClone)
assert.deepEqual(compareAfter, compareAfterClone)

assert.deepEqual(templateRules.validateMrTemplateForPublish([
  parent,
  { ...childA, activityName: '节点A' },
  { ...childB, activityName: ' 节点A ' },
]), ['活动名称重复：节点A'])
assert.deepEqual(
  templateRules.validateMrTemplateForPublish([{ ...parent, activityName: ' ' }]),
  ['活动名称不能为空'],
)

assert.throws(
  () => templateRules.normalizeMrTemplateActivities([parent, childA, grandchild]),
  /最多支持两级活动/,
)
assert.throws(
  () => templateRules.normalizeMrTemplateActivities([{ ...childA, parentId: 'missing' }]),
  /父活动不存在/,
)
assert.throws(
  () => templateRules.normalizeMrTemplateActivities([{ ...parent, activityName: ' ' }]),
  /活动名称不能为空/,
)
assert.throws(
  () => templateRules.normalizeMrTemplateActivities([parent, { ...parent }]),
  /活动 ID 重复/,
)
assert.throws(
  () => templateRules.normalizeMrTemplateActivities([{ ...parent, id: ' ' }]),
  /活动 ID 不能为空/,
)

const normalized = templateRules.normalizeMrTemplateActivities([
  { ...childB, order: 8 },
  { ...parentB, order: 4 },
  { ...childC, order: 3 },
  { ...parent, order: 7 },
  { ...childA, order: 9 },
])
assert.deepEqual(normalized.map(row => row.id), [parentB.id, childC.id, parent.id, childB.id, childA.id])
assert.deepEqual(normalized.map(row => [row.id, row.order]), [
  [parentB.id, 0], [childC.id, 0], [parent.id, 1], [childB.id, 0], [childA.id, 1],
])

const seed = templateRules.DEFAULT_MR_TEMPLATE_ACTIVITIES
assert.deepEqual(templateRules.validateMrTemplateForPublish([]), ['模板至少需要一个活动'])
const cloned = templateRules.cloneMrTemplateSnapshot(seed)
assert.deepEqual(cloned, seed)
assert.notStrictEqual(cloned, seed)
assert.notStrictEqual(cloned[0], seed[0])

const initialVersions = templateMocks.createInitialMrTemplateVersions()
const nextInitialVersions = templateMocks.createInitialMrTemplateVersions()
assert.notStrictEqual(initialVersions[0].activities, seed)
assert.notStrictEqual(initialVersions[0].activities[0], seed[0])
assert.notStrictEqual(initialVersions[0].activities, nextInitialVersions[0].activities)
assert.notStrictEqual(initialVersions[0].activities[0], nextInitialVersions[0].activities[0])
const revision = templateRules.createMrTemplateRevision(initialVersions, '张三', NOW)
assert.equal(revision.filter(item => item.status === '修订中').length, 1)
assert.equal(revision.find(item => item.status === '修订中').versionNo, 'V2')
assert.throws(() => templateRules.createMrTemplateRevision(revision, '张三', NOW), /已存在修订版本/)
assert.deepEqual(initialVersions, templateMocks.createInitialMrTemplateVersions())
const highestVersionRevision = templateRules.createMrTemplateRevision([
  initialVersions[0],
  { ...initialVersions[0], id: 'mr-template-v3', versionNo: 'V3' },
], '张三', NOW)
assert.equal(highestVersionRevision.at(-1).versionNo, 'V4')
assert.notStrictEqual(highestVersionRevision.at(-1).activities, initialVersions[0].activities)
assert.throws(
  () => templateRules.createMrTemplateRevision([
    initialVersions[0],
    { ...initialVersions[0], id: 'mr-template-latest', versionNo: 'latest' },
  ], '张三', NOW),
  /版本号格式无效：latest/,
)
assert.throws(
  () => templateRules.createMrTemplateRevision([
    initialVersions[0],
    { ...initialVersions[0], id: 'mr-template-unsafe', versionNo: 'V9007199254740992' },
  ], '张三', NOW),
  /版本号格式无效：V9007199254740992/,
)
assert.throws(
  () => templateRules.createMrTemplateRevision([
    { ...initialVersions[0], id: 'mr-template-max-safe', versionNo: 'V9007199254740991' },
  ], '张三', NOW),
  /版本号已达到最大安全值：V9007199254740991/,
)

const revisionBeforePublish = JSON.parse(JSON.stringify(revision))
const published = templateRules.publishMrTemplateRevision(revision, revision.at(-1).id, '张三', LATER)
assert.equal(published.at(-1).status, '已发布')
assert.equal(published.at(-1).publishedAt, LATER)
assert.deepEqual(revision, revisionBeforePublish)
assert.equal(templateRules.cancelMrTemplateRevision(revision, revision.at(-1).id).length, 1)
assert.throws(() => templateRules.cancelMrTemplateRevision(initialVersions, initialVersions[0].id), /仅可取消修订版本/)
assert.throws(() => templateRules.cancelMrTemplateRevision(revision, 'missing'), /修订版本不存在/)
assert.throws(
  () => templateRules.publishMrTemplateRevision(
    revision.map(version => version.id === revision.at(-1).id
      ? { ...version, activities: [{ ...version.activities[0], activityName: '重复' }, { ...version.activities[1], activityName: ' 重复 ' }] }
      : version),
    revision.at(-1).id,
    '张三',
    LATER,
  ),
  /活动名称重复：重复/,
)
assert.throws(
  () => templateRules.publishMrTemplateRevision(
    revision.map(version => version.id === revision.at(-1).id ? { ...version, activities: [] } : version),
    revision.at(-1).id,
    '张三',
    LATER,
  ),
  /模板至少需要一个活动/,
)

const shuffledDraftActivities = [
  { ...childC, order: 9 },
  { ...parentB, order: 8 },
  { ...childB, order: 7 },
  { ...parent, order: 4 },
  { ...childA, order: 6 },
]
const shuffledRevision = templateRules.createMrTemplateRevision(initialVersions, '张三', NOW)
const shuffledRevisionWithActivities = shuffledRevision.map(version => version.status === '修订中'
  ? { ...version, activities: shuffledDraftActivities }
  : version)
const shuffledRevisionBeforePublish = JSON.parse(JSON.stringify(shuffledRevisionWithActivities))
const canonicalPublished = templateRules.publishMrTemplateRevision(
  shuffledRevisionWithActivities,
  shuffledRevisionWithActivities.at(-1).id,
  '张三',
  LATER,
)
assert.deepEqual(canonicalPublished.at(-1).activities.map(row => [row.id, row.order]), [
  [parent.id, 0], [childA.id, 0], [childB.id, 1], [parentB.id, 1], [childC.id, 0],
])
assert.deepEqual(shuffledRevisionWithActivities, shuffledRevisionBeforePublish)
assert.notStrictEqual(canonicalPublished.at(-1).activities, shuffledRevisionWithActivities.at(-1).activities)
assert.notStrictEqual(canonicalPublished.at(-1).activities[0], shuffledRevisionWithActivities.at(-1).activities[0])
assert.notStrictEqual(canonicalPublished[0], shuffledRevisionWithActivities[0])
assert.notStrictEqual(canonicalPublished[0].activities, shuffledRevisionWithActivities[0].activities)
assert.notStrictEqual(canonicalPublished[0].activities[0], shuffledRevisionWithActivities[0].activities[0])

assert.equal(Object.isFrozen(seed), true)
assert.equal(Object.isFrozen(seed[0]), true)
const originalSeedName = seed[0].activityName
try {
  seed[0].activityName = '不应写入'
} catch {
  // Frozen ESM bindings throw in strict mode; either path must preserve the seed.
}
assert.equal(seed[0].activityName, originalSeedName)
const postMutationInitialVersions = templateMocks.createInitialMrTemplateVersions()
const anotherPostMutationInitialVersions = templateMocks.createInitialMrTemplateVersions()
assert.equal(postMutationInitialVersions[0].activities[0].activityName, originalSeedName)
assert.notStrictEqual(postMutationInitialVersions[0].activities, anotherPostMutationInitialVersions[0].activities)
assert.notStrictEqual(postMutationInitialVersions[0].activities[0], anotherPostMutationInitialVersions[0].activities[0])

const moveFixture = [parent, childA, childB, parentB, childC]
const sourceBeforeMove = JSON.parse(JSON.stringify(moveFixture))
const movedChild = templateRules.moveMrTemplateActivity(moveFixture, childB.id, childA.id)
assert.deepEqual(
  templateRules.numberMrTemplateActivities(movedChild)
    .filter(row => row.parentId === parent.id).map(row => row.activityName),
  ['子活动B', '子活动A'],
)
assert.deepEqual(moveFixture, sourceBeforeMove)
assert.notStrictEqual(movedChild, moveFixture)
assert.notStrictEqual(movedChild[0], moveFixture[0])

const movedParent = templateRules.moveMrTemplateActivity(moveFixture, parentB.id, parent.id)
assert.deepEqual(movedParent.map(row => row.id), [parentB.id, childC.id, parent.id, childA.id, childB.id])
assert.deepEqual(
  templateRules.moveMrTemplateActivity(moveFixture, childC.id, childA.id),
  templateRules.normalizeMrTemplateActivities(moveFixture),
)
assert.deepEqual(
  templateRules.moveMrTemplateActivity(moveFixture, 'missing', childA.id),
  templateRules.normalizeMrTemplateActivities(moveFixture),
)
assert.deepEqual(
  templateRules.moveMrTemplateActivity(moveFixture, childA.id, childA.id),
  templateRules.normalizeMrTemplateActivities(moveFixture),
)

const childThird = { id: 'node-third', parentId: parent.id, order: 2, activityName: '子活动C' }
assert.deepEqual(
  templateRules.moveMrTemplateActivity([parent, childA, childB, childThird], childA.id, childThird.id)
    .filter(row => row.parentId === parent.id).map(row => row.activityName),
  ['子活动B', '子活动C', '子活动A'],
)

const parentThird = { id: 'stage-c', parentId: null, order: 2, activityName: '第三阶段' }
const childOfThirdParent = { id: 'node-d', parentId: parentThird.id, order: 0, activityName: '子活动D' }
assert.deepEqual(
  templateRules.numberMrTemplateActivities(templateRules.moveMrTemplateActivity(
    [parent, childA, childB, parentB, childC, parentThird, childOfThirdParent],
    parent.id,
    parentThird.id,
  )).map(row => [row.number, row.id]),
  [
    ['1', parentB.id], ['1.1', childC.id],
    ['2', parentThird.id], ['2.1', childOfThirdParent.id],
    ['3', parent.id], ['3.1', childA.id], ['3.2', childB.id],
  ],
)

// tOS MR-plan rules: version source, date validation, permissions, and projections.
assert.equal(planRules.compareTosVersionNumbers('16.3.0.9', '16.3.0.110') < 0, true)
assert.equal(planRules.compareTosVersionNumbers('16.3', '16.3.1') < 0, true)
assert.equal(planRules.compareTosVersionNumbers('tOS17.0', '17.0'), 0)
assert.deepEqual(
  planRules.sortTosVersionNumbers(['invalid-B', '16.3.0.145', 'tOS17.0', '16.3.0.110', 'invalid-A', '16.3.0.9']),
  ['16.3.0.9', '16.3.0.110', '16.3.0.145', 'tOS17.0', 'invalid-A', 'invalid-B'],
)
const sortingSource = ['16.3.0.110', '16.3.0.110', 'invalid-A']
assert.deepEqual(planRules.sortTosVersionNumbers(sortingSource), sortingSource)
assert.notStrictEqual(planRules.sortTosVersionNumbers(sortingSource), sortingSource)
assert.equal(planRules.normalizeMrBusinessDate('2028-02-29'), '2028-02-29')
assert.equal(planRules.normalizeMrBusinessDate('2026-02-29'), '')
assert.equal(planRules.normalizeMrBusinessDate('2026-02-30'), '')
assert.equal(planRules.normalizeMrBusinessDate(new Date('invalid')), '')
assert.equal(planRules.normalizeMrBusinessDate(new Date('2026-01-01T16:00:00.000Z')), '2026-01-02')
assert.equal(planRules.normalizeMrBusinessDate('2026-01-02T00:30:00+08:00'), '2026-01-02')
assert.equal(planRules.normalizeMrBusinessDate('2026-01-01T23:30:00-05:00'), '2026-01-02')
assert.equal(planRules.normalizeMrBusinessDate('2026/01/02'), '')
assert.equal(planRules.normalizeMrBusinessDate('2026-01-02 00:00:00'), '')

const tosLevel1Tasks = [
  { id: 'maintenance-id', stableId: 'maintenance-stable', parentId: null, taskName: ' 维护阶段 ', order: 2 },
  { id: '上市-id', stableId: '上市-stable', parentId: null, taskName: ' 上市迭代阶段 ', order: 1 },
  { id: 'child-115', parentId: '上市-stable', taskName: ' 16.3.0.115 ', order: 2, planStartDate: new Date('2026-01-02T00:00:00.000Z'), planEndDate: '2026-01-03' },
  { id: 'child-110', parentId: '上市-id', taskName: '16.3.0.110', order: 1, planStartDate: '', planEndDate: '2026-01-02' },
  { id: 'child-120', parentId: 'maintenance-id', taskName: '16.3.0.120', order: 1, planStartDate: '2026-02-30', planEndDate: '2026-01-04' },
  { id: 'child-duplicate', parentId: 'maintenance-stable', taskName: '16.3.0.115', order: 2, planStartDate: '2026-01-05', planEndDate: '2026-01-06' },
  { id: 'child-blank', parentId: 'maintenance-id', taskName: '   ', order: 3, planStartDate: '2026-01-06', planEndDate: '2026-01-07' },
]
const draftTasks = [{ id: 'draft-stage', parentId: null, taskName: '上市迭代阶段', order: 0 }, { id: 'draft-child', parentId: 'draft-stage', taskName: '99.0', order: 0, planStartDate: '2026-01-01', planEndDate: '2026-01-02' }]
const candidateInput = {
  versions: [
    { id: 'v3', versionNo: 'V3', status: '已发布' },
    { id: 'v4', versionNo: 'V4', status: '修订中' },
    { id: 'bad', versionNo: 'latest', status: '已发布' },
  ],
  getSnapshot: id => id === 'v3' ? tosLevel1Tasks : id === 'v4' ? draftTasks : undefined,
  usedVersions: ['16.3.0.110'],
}
const candidatesBefore = structuredClone(tosLevel1Tasks)
const candidates = planRules.selectTosMrVersionCandidates(candidateInput)
assert.deepEqual(candidates.map(item => [item.value, item.disabled]), [
  ['16.3.0.110', true],
  ['16.3.0.115', false],
  ['16.3.0.120', true],
])
assert.equal(candidates[0].reason, '该tOS版本号已添加')
assert.equal(candidates[0].planStartDate, '')
assert.equal(candidates[1].planStartDate, '2026-01-02')
assert.equal(candidates[2].planStartDate, '')
assert.equal(candidates[2].reason, '请先完善一级计划中的计划开始时间和计划完成时间')
assert.deepEqual(tosLevel1Tasks, candidatesBefore)
assert.deepEqual(planRules.selectTosMrVersionCandidates({ ...candidateInput, versions: [{ id: 'v4', versionNo: 'V4', status: '修订中' }] }), [])

const retainedStaleDates = { collect: '2026-01-02', ota: '2026-01-09' }
const staleDatesBefore = structuredClone(retainedStaleDates)
assert.deepEqual(planRules.resolveTosMrInstanceDateAccess('016.03.0.110', [
  { value: '16.3.0.115', label: '16.3.0.115', planStartDate: '2026-01-10', planEndDate: '2026-01-20', disabled: false },
]), {
  canEdit: false,
  reason: '当前tOS版本在最新发布的一级计划中不存在，无法修改日期',
})
assert.deepEqual(planRules.resolveTosMrInstanceDateAccess('016.03.0.110', [
  { value: '16.3.0.110', label: '16.3.0.110', planStartDate: '', planEndDate: '2026-01-20', disabled: true, reason: '该tOS版本号已添加' },
]), {
  canEdit: false,
  reason: '请先完善一级计划中的计划开始时间和计划完成时间',
})
assert.deepEqual(planRules.resolveTosMrInstanceDateAccess('016.03.0.110', [
  { value: '16.3.0.110', label: '16.3.0.110', planStartDate: '2026-01-01', planEndDate: '2026-01-20', disabled: true, reason: '该tOS版本号已添加' },
]), {
  canEdit: true,
  bounds: { planStartDate: '2026-01-01', planEndDate: '2026-01-20' },
})
assert.deepEqual(retainedStaleDates, staleDatesBefore)

const latestPublishedSnapshot = [
  { id: 'valid-stage', parentId: null, taskName: '上市迭代阶段', order: 0 },
  { id: 'valid-child', parentId: 'valid-stage', taskName: '5.0', order: 0, planStartDate: '2026-02-01', planEndDate: '2026-02-02' },
  { id: 'grandchild', parentId: 'valid-child', taskName: '5.0.1', order: 0, planStartDate: '2026-02-01', planEndDate: '2026-02-02' },
  { id: 'near-stage', parentId: null, taskName: ' 上市迭代阶段X ', order: 1 },
  { id: 'near-child', parentId: 'near-stage', taskName: '5.1', order: 0, planStartDate: '2026-02-01', planEndDate: '2026-02-02' },
]
const readSnapshots = []
assert.deepEqual(planRules.selectTosMrVersionCandidates({
  versions: [
    { id: 'v3', versionNo: 'V3', status: '已发布' },
    { id: 'invalid-zero', versionNo: 'V0', status: '已发布' },
    { id: 'invalid-unsafe', versionNo: 'V9007199254740992', status: '已发布' },
    { id: 'v5', versionNo: 'V5', status: '已发布' },
    { id: 'v6', versionNo: 'V6', status: '修订中' },
  ],
  getSnapshot: id => {
    readSnapshots.push(id)
    return id === 'v5' ? latestPublishedSnapshot : draftTasks
  },
  usedVersions: ['5.0'],
}), [{ value: '5.0', label: '5.0', planStartDate: '2026-02-01', planEndDate: '2026-02-02', disabled: true, reason: '该tOS版本号已添加' }])
assert.deepEqual(readSnapshots, ['v5'])
assert.deepEqual(planRules.selectTosMrVersionCandidates({
  versions: [{ id: 'zero', versionNo: 'V0', status: '已发布' }, { id: 'unsafe', versionNo: 'V9007199254740992', status: '已发布' }],
  getSnapshot: () => latestPublishedSnapshot,
  usedVersions: [],
}), [])

const tosActivities = [
  { id: 'parent', parentId: null, order: 0, activityName: '需求&修改点' },
  { id: 'collect', parentId: 'parent', order: 0, activityName: ' 修改点收集开始时间 ' },
  { id: 'release-parent', parentId: null, order: 1, activityName: '版本发布' },
  { id: 'ota', parentId: 'release-parent', order: 0, activityName: 'OTA开放验证&部署' },
  { id: 'renamed', parentId: 'release-parent', order: 1, activityName: '已改名活动' },
]
const tosInstance = { projectId: 'project-1', tosVersion: '16.3.0.110', templateVersionId: 'template-v1', activities: tosActivities, dates: { parent: '2026-01-01', collect: '2025-12-31', ota: '2026-02-01', renamed: '2025-01-01' }, createdBy: '张三', createdAt: NOW, updatedBy: '张三', updatedAt: NOW }
assert.deepEqual(planRules.validateTosMrInstanceDates(tosInstance, { planStartDate: '2026-01-01', planEndDate: '2026-01-31' }), [
  { rowKey: 'project-1::16.3.0.110', activityId: 'collect', activityName: ' 修改点收集开始时间 ', message: '修改点收集开始时间不能早于一级计划中的计划开始时间（2026-01-01）', boundaryDate: '2026-01-01', boundaryType: 'minimum' },
  { rowKey: 'project-1::16.3.0.110', activityId: 'ota', activityName: 'OTA开放验证&部署', message: 'OTA开放验证&部署不能晚于一级计划中的计划完成时间（2026-01-31）', boundaryDate: '2026-01-31', boundaryType: 'maximum' },
])
assert.deepEqual(planRules.validateTosMrInstanceDates({ ...tosInstance, dates: { collect: '', ota: '' } }, { planStartDate: '', planEndDate: '' }), [])

assert.deepEqual(planRules.resolveMrPermissions({ currentUser: '李白', globalAdminUsers: [], tosManagerUsers: ['李白'], machineSpm: '张三', context: 'tos' }), { canView: true, canEditTemplate: false, canEditTos: false, canEditMachine: false, canStopRelease: false, canEditMarket: false })
assert.deepEqual(planRules.resolveMrPermissions({ currentUser: '李白', globalAdminUsers: [], tosManagerUsers: ['李白'], machineSpm: '张三', tosProjectId: 'tos-project-16.3', context: 'tos' }), { canView: true, canEditTemplate: false, canEditTos: true, canEditMachine: false, canStopRelease: false, canEditMarket: false, tosProjectIds: ['tos-project-16.3'] })
assert.deepEqual(planRules.resolveMrPermissions({ currentUser: ' 管理员 ', globalAdminUsers: ['管理员'], tosManagerUsers: [], machineSpm: '张三', context: 'config' }), { canView: true, canEditTemplate: true, canEditTos: true, canEditMachine: true, canStopRelease: true, canEditMarket: true })
assert.deepEqual(planRules.resolveMrPermissions({ currentUser: '张三', globalAdminUsers: [], tosManagerUsers: ['张三'], machineSpm: '张三', machineProjectId: 'machine-c09', context: 'joint-machine' }), { canView: true, canEditTemplate: false, canEditTos: false, canEditMachine: true, canStopRelease: true, canEditMarket: false, machineProjectIds: ['machine-c09'] })
assert.deepEqual(planRules.resolveMrPermissions({ currentUser: '张三', globalAdminUsers: [], tosManagerUsers: ['张三'], machineSpm: '张三', machineProjectId: 'machine-c09', context: 'machine-market' }), { canView: true, canEditTemplate: false, canEditTos: false, canEditMachine: false, canStopRelease: false, canEditMarket: true, machineProjectIds: ['machine-c09'] })
assert.deepEqual(planRules.resolveMrPermissions({ currentUser: '普通用户', globalAdminUsers: [], tosManagerUsers: ['普通用户'], machineSpm: '张三', context: 'config' }), { canView: true, canEditTemplate: false, canEditTos: false, canEditMachine: false, canStopRelease: false, canEditMarket: false })
assert.deepEqual(planRules.resolveMrPermissions({ currentUser: '', globalAdminUsers: [''], tosManagerUsers: [''], machineSpm: '', context: 'tos' }), { canView: false, canEditTemplate: false, canEditTos: false, canEditMachine: false, canStopRelease: false, canEditMarket: false })
const multiSpmJointPermission = currentUser => planRules.resolveMrPermissions({
  currentUser, globalAdminUsers: [], tosManagerUsers: [], machineSpm: '旧负责人', machineSpmUsers: [' 李白 ', '张三', '李白'], machineProjectId: 'machine-c09', context: 'joint-machine',
})
assert.equal(multiSpmJointPermission('李白').canEditMachine, true)
assert.equal(multiSpmJointPermission('张三').canStopRelease, true)
assert.equal(multiSpmJointPermission('王五').canEditMachine, false)
const multiSpmMarketPermission = currentUser => planRules.resolveMrPermissions({
  currentUser, globalAdminUsers: [], tosManagerUsers: [], machineSpm: '旧负责人', machineSpmUsers: [' 李白 ', '张三', '李白'], machineProjectId: 'machine-c09', context: 'machine-market',
})
assert.equal(multiSpmMarketPermission('李白').canEditMarket, true)
assert.equal(multiSpmMarketPermission('张三').canEditMarket, true)
assert.equal(multiSpmMarketPermission('王五').canEditMarket, false)
const legacyMultiSpmPermission = currentUser => planRules.resolveMrPermissions({
  currentUser, globalAdminUsers: [], tosManagerUsers: [], machineSpm: '李白,张三', machineProjectId: 'machine-c09', context: 'joint-machine',
})
assert.equal(legacyMultiSpmPermission('李白').canEditMachine, true)
assert.equal(legacyMultiSpmPermission('张三').canStopRelease, true)
assert.equal(legacyMultiSpmPermission('王五').canEditMachine, false)
assert.equal(planRules.resolveMrPermissions({ currentUser: '张三', globalAdminUsers: [], tosManagerUsers: [], machineSpm: '张三', machineSpmUsers: [], machineProjectId: 'machine-c09', context: 'machine-market' }).canEditMarket, true)

const publishedTemplate = { id: 'template-v1', versionNo: 'V1', status: '已发布', activities: tosActivities, createdBy: '张三', createdAt: NOW }
const templateBeforeCreate = JSON.parse(JSON.stringify(publishedTemplate))
const createdInstance = planRules.createTosMrVersionInstance({ projectId: ' project-1 ', tosVersion: ' 16.3.0.110 ', templateVersion: publishedTemplate, actor: ' 张三 ', now: NOW })
assert.deepEqual(createdInstance, { projectId: 'project-1', tosVersion: '16.3.0.110', templateVersionId: 'template-v1', activities: tosActivities, dates: {}, createdBy: '张三', createdAt: NOW, updatedBy: '张三', updatedAt: NOW })
assert.notStrictEqual(createdInstance.activities, publishedTemplate.activities)
assert.notStrictEqual(createdInstance.activities[0], publishedTemplate.activities[0])
assert.deepEqual(publishedTemplate, templateBeforeCreate)
assert.throws(() => planRules.createTosMrVersionInstance({ projectId: '', tosVersion: '16.3', templateVersion: publishedTemplate, actor: '张三', now: NOW }))
assert.throws(() => planRules.createTosMrVersionInstance({ projectId: 'p', tosVersion: ' ', templateVersion: publishedTemplate, actor: '张三', now: NOW }))
assert.throws(() => planRules.createTosMrVersionInstance({ projectId: 'p', tosVersion: '16.3', templateVersion: publishedTemplate, actor: ' ', now: NOW }))
assert.throws(() => planRules.createTosMrVersionInstance({ projectId: 'p', tosVersion: '16.3', templateVersion: { ...publishedTemplate, status: '修订中' }, actor: '张三', now: NOW }))
const gappedTemplate = {
  ...publishedTemplate,
  activities: [
    { id: 'parent-b', parentId: null, order: 5, activityName: 'B' },
    { id: 'child-b', parentId: 'parent-b', order: 9, activityName: 'B1' },
    { id: 'parent-a', parentId: null, order: 1, activityName: 'A' },
    { id: 'child-a2', parentId: 'parent-a', order: 8, activityName: 'A2' },
    { id: 'child-a1', parentId: 'parent-a', order: 2, activityName: 'A1' },
  ],
}
const gappedBeforeCreate = structuredClone(gappedTemplate)
assert.deepEqual(planRules.createTosMrVersionInstance({ projectId: 'p', tosVersion: '16.3', templateVersion: gappedTemplate, actor: '张三', now: NOW }).activities.map(row => [row.id, row.order]), [
  ['parent-a', 0], ['child-a1', 0], ['child-a2', 1], ['parent-b', 1], ['child-b', 0],
])
assert.deepEqual(gappedTemplate, gappedBeforeCreate)

assert.deepEqual(planRules.projectTosMrVerticalRows({ ...createdInstance, dates: { collect: '2026-01-01' } }).map(row => [row.number, row.depth, row.date]), [
  ['1', 0, '/'], ['1.1', 1, '2026-01-01'], ['2', 0, '/'], ['2.1', 1, ''], ['2.2', 1, ''],
])
assert.equal(planRules.projectTosMrVerticalRows({ ...createdInstance, dates: { collect: '未规范日期' } })[1].date, '未规范日期')
const logicalKey = (parentName, activityName = '') => `${encodeURIComponent(parentName)}::${encodeURIComponent(activityName)}`
assert.deepEqual(planRules.projectTosMrHorizontalColumns(tosActivities).map(group => [group.title, group.children.map(child => [child.title, child.key, child.activityId])]), [
  ['需求&修改点', [['修改点收集开始时间', logicalKey('需求&修改点', '修改点收集开始时间'), 'collect']]],
  ['版本发布', [['OTA开放验证&部署', logicalKey('版本发布', 'OTA开放验证&部署'), 'ota'], ['已改名活动', logicalKey('版本发布', '已改名活动'), 'renamed']]],
])
const delimiterActivities = [
  { id: 'parent-delimited', parentId: null, order: 0, activityName: 'A::B' }, { id: 'child-percent', parentId: 'parent-delimited', order: 0, activityName: 'C%1' },
  { id: 'parent-plain', parentId: null, order: 1, activityName: 'A' }, { id: 'child-delimited', parentId: 'parent-plain', order: 0, activityName: 'B::C%1' },
]
const delimiterColumns = planRules.projectTosMrHorizontalColumns(delimiterActivities)
assert.deepEqual(delimiterColumns.map(group => group.children[0].key), [logicalKey('A::B', 'C%1'), logicalKey('A', 'B::C%1')])
assert.notEqual(delimiterColumns[0].children[0].key, delimiterColumns[1].children[0].key)
assert.deepEqual(planRules.buildJointMrColumnSchema([], delimiterActivities).flatMap(group => group.children.map(child => child.key)), [logicalKey('A::B', 'C%1'), logicalKey('A', 'B::C%1')])

const latestActivities = [
  { id: 'a', parentId: null, order: 0, activityName: 'A' }, { id: 'x', parentId: 'a', order: 0, activityName: 'X' }, { id: 'y', parentId: 'a', order: 1, activityName: 'Y' },
]
const olderActivities = [
  { id: 'old-a', parentId: null, order: 0, activityName: 'A' }, { id: 'old-x', parentId: 'old-a', order: 0, activityName: 'X' }, { id: 'b', parentId: null, order: 1, activityName: 'B' }, { id: 'z', parentId: 'b', order: 0, activityName: 'Z' },
]
const renamedActivities = [{ id: 'new-a', parentId: null, order: 0, activityName: 'A' }, { id: 'x2', parentId: 'new-a', order: 0, activityName: 'X2' }]
const jointInstances = [
  { ...createdInstance, tosVersion: '16.3.0.110', activities: olderActivities },
  { ...createdInstance, tosVersion: '16.3.0.120', activities: renamedActivities },
]
const unionInputBefore = JSON.parse(JSON.stringify({ latestActivities, jointInstances }))
assert.deepEqual(planRules.buildJointMrColumnSchema(jointInstances, latestActivities).map(group => [group.title, group.children.map(child => [child.title, child.key])]), [
  ['A', [['X', logicalKey('A', 'X')], ['Y', logicalKey('A', 'Y')], ['X2', logicalKey('A', 'X2')]]],
  ['B', [['Z', logicalKey('B', 'Z')]]],
])
assert.deepEqual({ latestActivities, jointInstances }, unionInputBefore)

const latestDuplicateActivities = [
  { id: 'latest-a', parentId: null, order: 0, activityName: ' A ' }, { id: 'latest-x', parentId: 'latest-a', order: 0, activityName: ' X ' },
  { id: 'latest-a-duplicate', parentId: null, order: 1, activityName: 'A' }, { id: 'latest-x-duplicate', parentId: 'latest-a-duplicate', order: 0, activityName: 'X' },
]
const semanticEarlyActivities = [
  { id: 'early-a', parentId: null, order: 0, activityName: 'A' }, { id: 'early-x', parentId: 'early-a', order: 0, activityName: ' X ' }, { id: 'early-x1', parentId: 'early-a', order: 1, activityName: 'X1' },
  { id: 'early-b', parentId: null, order: 1, activityName: ' B ' }, { id: 'early-z', parentId: 'early-b', order: 0, activityName: ' Z ' },
]
const semanticLateActivities = [
  { id: 'late-a', parentId: null, order: 0, activityName: 'A' }, { id: 'late-x2', parentId: 'late-a', order: 0, activityName: 'X2' },
]
const outOfOrderInstances = [
  { ...createdInstance, tosVersion: '16.3.0.120', activities: semanticLateActivities },
  { ...createdInstance, tosVersion: '16.3.0.110', activities: semanticEarlyActivities },
]
const dedupeInputBefore = structuredClone({ latestDuplicateActivities, outOfOrderInstances })
assert.deepEqual(planRules.buildJointMrColumnSchema(outOfOrderInstances, latestDuplicateActivities).map(group => [group.title, group.children.map(child => [child.title, child.key])]), [
  ['A', [['X', logicalKey('A', 'X')], ['X1', logicalKey('A', 'X1')], ['X2', logicalKey('A', 'X2')]]],
  ['B', [['Z', logicalKey('B', 'Z')]]],
])
assert.deepEqual({ latestDuplicateActivities, outOfOrderInstances }, dedupeInputBefore)

// Joint aggregation: version intervals, matching, dynamic reconciliation, and stop-release.
const mrActivities = [
  { id: 'stage-change', parentId: null, order: 0, activityName: '需求&修改点' },
  { id: 'collect', parentId: 'stage-change', order: 0, activityName: '修改点收集开始时间' },
  { id: 'lock', parentId: 'stage-change', order: 1, activityName: '修改点锁定时间' },
  { id: 'stage-transfer', parentId: null, order: 1, activityName: '入库&自测&转测' },
  { id: 'mp-deadline', parentId: 'stage-transfer', order: 0, activityName: 'MP入库截止时间' },
  { id: 'transfer', parentId: 'stage-transfer', order: 1, activityName: '版本转测时间' },
  { id: 'stage-test', parentId: null, order: 2, activityName: '版本测试' },
  { id: 'test-start', parentId: 'stage-test', order: 0, activityName: '测试开始时间' },
  { id: 'test-complete', parentId: 'stage-test', order: 1, activityName: '测试完成时间' },
  { id: 'stage-review', parentId: null, order: 3, activityName: '版本评审' },
  { id: 'review', parentId: 'stage-review', order: 0, activityName: '评审时间' },
  { id: 'stage-release', parentId: null, order: 4, activityName: '版本发布' },
  { id: 'archive', parentId: 'stage-release', order: 0, activityName: '软件归档时间' },
  { id: 'ota', parentId: 'stage-release', order: 1, activityName: 'OTA开放验证&部署' },
]
const makeTosInstance = (tosVersion, dates, projectId = 'tos-project-16.3') => ({
  projectId, tosVersion, templateVersionId: 'template-v1', activities: mrActivities,
  dates, createdBy: '张三', createdAt: NOW, updatedBy: '张三', updatedAt: NOW,
})
const tos140 = makeTosInstance('16.3.0.140', {
  collect: '2026-06-22', lock: '2026-06-24', 'mp-deadline': '2026-06-25', transfer: '2026-06-26',
  'test-start': '2026-06-29', 'test-complete': '2026-07-03', review: '2026-07-06', archive: '2026-07-08', ota: '2026-07-11',
})
const tos145 = makeTosInstance('16.3.0.145', {
  collect: '2026-07-12', lock: '2026-07-14', 'mp-deadline': '2026-07-15', transfer: '2026-07-16',
  'test-start': '2026-07-20', 'test-complete': '2026-07-24', review: '2026-07-27', archive: '2026-07-29', ota: '2026-07-31',
})
const tos150 = makeTosInstance('16.3.0.150', {
  collect: '2026-08-01', lock: '2026-08-03', 'mp-deadline': '2026-08-04', transfer: '2026-08-05',
  'test-start': '2026-08-10', 'test-complete': '2026-08-14', review: '2026-08-17', archive: '2026-08-19', ota: '2026-08-21',
})
const intervalBefore = structuredClone(tos140)
assert.deepEqual(aggregationRules.getTosVersionInterval(tos140), { startDate: '2026-06-22', endDate: '2026-07-11' })
assert.deepEqual(tos140, intervalBefore)
assert.equal(aggregationRules.getTosVersionInterval(makeTosInstance('16.3.0.100', { collect: '', lock: 'bad', 'stage-change': '2026-01-01' })), null)
assert.equal(aggregationRules.resolveMachineTosProjectKey({ id: 'new', productType: '新品', firstSaleTosVersion: ' tOS16.3.0.140 ', currentTosVersion: '99.1' }), '16.3')
assert.equal(aggregationRules.resolveMachineTosProjectKey({ id: 'old', productType: '老品', firstSaleTosVersion: '99.1', currentTosVersion: '16.3.0.145' }), '16.3')
assert.equal(aggregationRules.resolveMachineTosProjectKey({ id: 'legacy', productType: '升级', currentTosVersion: 'tOS16.3' }), '16.3')
assert.equal(aggregationRules.resolveMachineTosProjectKey({ id: 'bad', productType: '新品', firstSaleTosVersion: 'tOS16' }), null)
assert.equal(aggregationRules.resolveMachineTosProjectKey({ id: 'unknown', productType: '技术项目', currentTosVersion: '16.3' }), null)

const level1Source = (str5Date, versionNo = 'V3') => ({
  versions: [{ id: 'v2', versionNo: 'V2', status: '已发布' }, { id: 'draft', versionNo: 'V4', status: '修订中' }, { id: 'latest', versionNo, status: '已发布' }],
  getSnapshot: id => id === 'latest' ? [
    { id: 'phase', parentId: null, taskName: '开发验证阶段', order: 0 },
    { id: 'str5', parentId: 'phase', taskName: ' STR5 ', order: 0, planEndDate: str5Date },
  ] : [{ id: 'old-str5', parentId: 'old', taskName: 'STR5', planEndDate: '2025-01-01' }],
})
assert.equal(aggregationRules.resolveLatestPublishedStr5Date(level1Source('2026-06-21')), '2026-06-21')
assert.equal(aggregationRules.resolveLatestPublishedStr5Date(level1Source('2026-02-30')), null)
assert.equal(aggregationRules.resolveLatestPublishedStr5Date({ versions: [{ id: 'd', versionNo: 'V9', status: '修订中' }], getSnapshot: () => [] }), null)

const tosProjects = [{ projectId: 'tos-project-16.3', tosProjectKey: '16.3', projectName: 'tOS16.3' }]
const machineProjects = [
  { id: 'machine-c09', projectName: 'C09', productType: '新品', firstSaleTosVersion: '16.3.0.110', spm: '张三' },
  { id: 'machine-too-new', projectName: 'NEW', productType: '老品', currentTosVersion: '16.3', spm: '李白' },
]
const stalePlan = { projectId: 'stale', tosProjectId: 'tos-project-16.3', tosVersion: '16.3.0.140', transferType: '2', dates: { transfer: '2026-01-01' }, updatedBy: '旧', updatedAt: NOW }
const validPlan = { projectId: 'machine-c09', tosProjectId: 'tos-project-16.3', tosVersion: '16.3.0.140', transferType: '2', dates: { transfer: '2026-07-02' }, updatedBy: '张三', updatedAt: NOW }
const reconcileInput = {
  today: '2026-08-29', tosProjects, tosInstances: [tos150, tos145, tos140], machineProjects,
  latestPublishedLevel1ByProjectId: { 'machine-c09': level1Source('2026-06-21'), 'machine-too-new': level1Source('2026-08-29') },
  persistedPlans: { 'stale::16.3.0.140': stalePlan, 'machine-c09::16.3.0.140': validPlan }, stopRecords: [],
}
const reconcileBefore = structuredClone({ tosProjects, tosInstances: reconcileInput.tosInstances, machineProjects, persistedPlans: reconcileInput.persistedPlans })
const reconciled = aggregationRules.reconcileJointMachinePlans(reconcileInput)
assert.deepEqual(reconciled.rows.map(row => row.key), [
  'tos-project-16.3::16.3.0.140::reference', 'machine-c09::16.3.0.140',
  'tos-project-16.3::16.3.0.145::reference', 'machine-c09::16.3.0.145',
  'tos-project-16.3::16.3.0.150::reference', 'machine-c09::16.3.0.150',
])
assert.deepEqual(Object.keys(reconciled.persistedPlans), ['machine-c09::16.3.0.140', 'machine-c09::16.3.0.145', 'machine-c09::16.3.0.150'])
assert.deepEqual(reconciled.persistedPlans['machine-c09::16.3.0.140'].dates, { transfer: '2026-07-02' })
assert.deepEqual(reconciled.persistedPlans['machine-c09::16.3.0.145'].transferType, '1')
assert.deepEqual(reconciled.persistedPlans['machine-c09::16.3.0.145'].dates, {})
assert.deepEqual({ tosProjects, tosInstances: reconcileInput.tosInstances, machineProjects, persistedPlans: reconcileInput.persistedPlans }, reconcileBefore)
const persistedBeforeInvalidToday = structuredClone(reconcileInput.persistedPlans)
assert.throws(() => aggregationRules.reconcileJointMachinePlans({ ...reconcileInput, today: '2026-02-30' }), /当前日期格式无效/)
assert.throws(() => aggregationRules.reconcileJointMachinePlans({ ...reconcileInput, today: '2026\/08\/29' }), /当前日期格式无效/)
assert.deepEqual(reconcileInput.persistedPlans, persistedBeforeInvalidToday)

// Semantic aliases share one canonical identity; the first input instance is the stable winner.
assert.equal(aggregationRules.canonicalizeTosMrVersion(' 016.03.00.001.0 '), '16.3.0.1')
assert.equal(aggregationRules.canonicalizeTosMrVersion('16.3.0.1'), '16.3.0.1')
assert.equal(aggregationRules.canonicalizeTosMrVersion('16.3.1'), null)
assert.equal(aggregationRules.canonicalizeTosMrVersion('invalid'), null)
const aliasWinner = makeTosInstance('016.03.00.001.0', { collect: '2026-06-22', ota: '2026-07-11' })
const aliasDuplicate = makeTosInstance('16.3.0.1', { collect: '2020-01-01', ota: '2020-01-02' })
const malformedInstance = makeTosInstance('unknown', { collect: '2026-06-22', ota: '2026-07-11' })
const aliasReconciled = aggregationRules.reconcileJointMachinePlans({
  ...reconcileInput,
  tosInstances: [aliasWinner, aliasDuplicate, malformedInstance],
  machineProjects: [machineProjects[0]],
  latestPublishedLevel1ByProjectId: { 'machine-c09': level1Source('2026-06-21') },
  persistedPlans: {
    'z-alias': { ...validPlan, tosVersion: '16.3.0.1.0', dates: { transfer: '2026-07-02' } },
    'a-canonical': { ...validPlan, tosVersion: '16.3.0.1', dates: { transfer: 'stable-winner' } },
  },
})
assert.deepEqual(aliasReconciled.rows.map(row => row.key), ['tos-project-16.3::16.3.0.1::reference', 'machine-c09::16.3.0.1'])
assert.deepEqual(Object.keys(aliasReconciled.persistedPlans), ['machine-c09::16.3.0.1'])
assert.equal(aliasReconciled.persistedPlans['machine-c09::16.3.0.1'].tosVersion, '16.3.0.1')
assert.equal(aliasReconciled.persistedPlans['machine-c09::16.3.0.1'].dates.transfer, 'stable-winner')
assert.equal(aliasReconciled.rows[0].instance.dates.collect, '2026-06-22')

const tos101 = makeTosInstance('16.10.0.1', { collect: '2026-09-01', ota: '2026-09-02' }, 'tos-project-16.10')
const crossProjectRows = aggregationRules.reconcileJointMachinePlans({
  today: '2026-08-29',
  tosProjects: [
    { projectId: 'tos-project-16.10', tosProjectKey: '16.10', projectName: 'tOS16.10' },
    { projectId: 'tos-project-16.3-z', tosProjectKey: '16.3', projectName: 'tOS16.3-Z' },
    { projectId: 'tos-project-16.3-a', tosProjectKey: '16.3', projectName: 'tOS16.3-A' },
  ],
  tosInstances: [tos101, { ...makeTosInstance('16.3.0.2', { collect: '2026-01-01', ota: '2026-01-02' }), projectId: 'tos-project-16.3-z' }, { ...makeTosInstance('16.3.0.1', { collect: '2026-01-01', ota: '2026-01-02' }), projectId: 'tos-project-16.3-a' }],
  machineProjects: [], latestPublishedLevel1ByProjectId: {}, persistedPlans: {}, stopRecords: [],
}).rows.map(row => row.key)
assert.deepEqual(crossProjectRows, [
  'tos-project-16.3-a::16.3.0.1::reference',
  'tos-project-16.3-z::16.3.0.2::reference',
  'tos-project-16.10::16.10.0.1::reference',
])

// Inclusive lower and upper interval boundaries both select the matching version.
assert.equal(aggregationRules.reconcileJointMachinePlans({ ...reconcileInput, latestPublishedLevel1ByProjectId: { 'machine-c09': level1Source('2026-06-21') }, machineProjects: [machineProjects[0]], persistedPlans: {} }).persistedPlans['machine-c09::16.3.0.140'].tosVersion, '16.3.0.140')
assert.equal(aggregationRules.reconcileJointMachinePlans({ ...reconcileInput, latestPublishedLevel1ByProjectId: { 'machine-c09': level1Source('2026-07-10') }, machineProjects: [machineProjects[0]], persistedPlans: {} }).persistedPlans['machine-c09::16.3.0.140'].tosVersion, '16.3.0.140')
// Source-date movement removes no-longer-eligible persisted rows and their dates.
assert.deepEqual(aggregationRules.reconcileJointMachinePlans({
  ...reconcileInput,
  latestPublishedLevel1ByProjectId: { ...reconcileInput.latestPublishedLevel1ByProjectId, 'machine-c09': level1Source('2026-08-22') },
}).persistedPlans, {})
// A row that remains eligible retains even invalid dates for UI validation.
assert.equal(aggregationRules.reconcileJointMachinePlans({ ...reconcileInput, persistedPlans: { 'machine-c09::16.3.0.140': { ...validPlan, dates: { transfer: 'malformed' } } } }).persistedPlans['machine-c09::16.3.0.140'].dates.transfer, 'malformed')

const stopRecord = { id: 'stop-1', projectId: 'machine-c09', projectName: 'C09', stopDate: '2026-07-12', operator: '张三', operatedAt: NOW }
const stopped = aggregationRules.applyStopRelease({ persistedPlans: reconciled.persistedPlans, tosInstances: [tos140, tos145, tos150], stopRecords: [], record: stopRecord })
assert.deepEqual(stopped.removedPlanKeys, ['machine-c09::16.3.0.150'])
assert.deepEqual(Object.keys(stopped.persistedPlans), ['machine-c09::16.3.0.140', 'machine-c09::16.3.0.145'])
assert.deepEqual(stopped.stopRecords, [stopRecord])
assert.notStrictEqual(stopped.stopRecords[0], stopRecord)
assert.equal(aggregationRules.isPlanExcludedByStopRecord({ plan: reconciled.persistedPlans['machine-c09::16.3.0.150'], tosInstances: [tos150], stopRecords: [stopRecord] }), true)
assert.equal(aggregationRules.isPlanExcludedByStopRecord({ plan: reconciled.persistedPlans['machine-c09::16.3.0.145'], tosInstances: [tos145], stopRecords: [stopRecord] }), false)
assert.equal(aggregationRules.isPlanExcludedByStopRecord({ plan: { ...validPlan, tosVersion: '16.3.0.999' }, tosInstances: [makeTosInstance('16.3.0.999', { lock: '2027-01-01' })], stopRecords: [stopRecord] }), false)
const emptyCollectionInstance = makeTosInstance('16.3.0.150', { collect: '', ota: '2026-08-20' })
const emptyCollectionStop = aggregationRules.applyStopRelease({
  persistedPlans: { 'machine-c09::16.3.0.150': { ...validPlan, tosVersion: '16.3.0.150' } },
  tosInstances: [emptyCollectionInstance], stopRecords: [], record: stopRecord,
})
assert.equal(emptyCollectionStop.stopRecords.length, 1)
assert.ok(emptyCollectionStop.persistedPlans['machine-c09::16.3.0.150'])
assert.equal(aggregationRules.isPlanExcludedByStopRecord({
  plan: emptyCollectionStop.persistedPlans['machine-c09::16.3.0.150'],
  tosInstances: [{ ...emptyCollectionInstance, dates: { ...emptyCollectionInstance.dates, collect: '2026-08-01' } }],
  stopRecords: emptyCollectionStop.stopRecords,
}), true)
const reconciledStopped = aggregationRules.reconcileJointMachinePlans({ ...reconcileInput, stopRecords: [stopRecord] })
assert.equal(reconciledStopped.persistedPlans['machine-c09::16.3.0.150'], undefined)
const stoppedInputsBefore = structuredClone({ persistedPlans: reconciled.persistedPlans, tosInstances: [tos140, tos145, tos150], stopRecords: [] })
assert.throws(() => aggregationRules.applyStopRelease({ persistedPlans: reconciled.persistedPlans, tosInstances: [tos140], stopRecords: [], record: { ...stopRecord, stopDate: '2026-02-30' } }), /停止发版日期格式无效/)
assert.throws(() => aggregationRules.applyStopRelease({ persistedPlans: reconciled.persistedPlans, tosInstances: [tos140], stopRecords: [], record: { ...stopRecord, projectName: '' } }), /停止发版项目名称不能为空/)
assert.deepEqual({ persistedPlans: reconciled.persistedPlans, tosInstances: [tos140, tos145, tos150], stopRecords: [] }, stoppedInputsBefore)
const exactDuplicateStop = aggregationRules.applyStopRelease({ persistedPlans: stopped.persistedPlans, tosInstances: [tos140, tos145, tos150], stopRecords: stopped.stopRecords, record: { ...stopRecord } })
assert.deepEqual(exactDuplicateStop.stopRecords, [stopRecord])
assert.throws(() => aggregationRules.applyStopRelease({ persistedPlans: stopped.persistedPlans, tosInstances: [tos140], stopRecords: stopped.stopRecords, record: { ...stopRecord, projectId: 'other' } }), /停止发版记录ID已存在/)
const secondProjectStop = aggregationRules.applyStopRelease({ persistedPlans: stopped.persistedPlans, tosInstances: [tos140, tos145, tos150], stopRecords: stopped.stopRecords, record: { ...stopRecord, id: 'stop-2', stopDate: '2026-08-01' } })
assert.deepEqual(secondProjectStop.stopRecords, [stopRecord])
assert.equal(aggregationRules.isPlanExcludedByStopRecord({ plan: { ...validPlan, tosVersion: '016.03.00.150.0' }, tosInstances: [tos150], stopRecords: [stopRecord] }), true)

// Joint and market date validation.
const machineRow = (projectId, tosVersion, transferType, dates) => ({ projectId, tosProjectId: 'tos-project-16.3', tosVersion, transferType, dates, updatedBy: projectId, updatedAt: NOW })
const errorsFor = (rows, instances = [tos140, tos145, tos150]) => dateRules.validateJointMachineRows({ tosInstances: instances, machinePlans: rows })
const immutableValidationRows = [machineRow('immutable', '16.3.0.140', '1', { transfer: 'bad' })]
const immutableValidationBefore = structuredClone(immutableValidationRows)
dateRules.validateJointMachineRows({ tosInstances: [tos140], machinePlans: immutableValidationRows })
assert.deepEqual(immutableValidationRows, immutableValidationBefore)
assert.deepEqual(errorsFor([machineRow('m1', '16.3.0.140', '1', { collect: '2026-06-23', lock: '2026-06-25' })]).map(error => error.message), [
  '修改点收集开始时间需与tOS项目时间保持一致（2026-06-22）', '修改点锁定时间需与tOS项目时间保持一致（2026-06-24）',
])
const collectionAndLockErrors = errorsFor([machineRow('m1', '16.3.0.140', '1', { collect: '2026-06-23', lock: '2026-06-25' })])
assert.deepEqual(collectionAndLockErrors.map(error => [error.boundaryDate, error.boundaryType]), [
  ['2026-06-22', 'equality'], ['2026-06-24', 'equality'],
])
assert.deepEqual(errorsFor([machineRow('m1', '16.3.0.140', '1', { 'mp-deadline': '2026-06-26' })]), [{
  rowKey: 'm1::16.3.0.140', activityId: 'mp-deadline', activityName: 'MP入库截止时间',
  message: '整机产品项目的MP入库截止时间不得晚于tOS项目时间（2026-06-25）', boundaryDate: '2026-06-25', boundaryType: 'maximum',
}])
assert.deepEqual(errorsFor([machineRow('m1', '16.3.0.140', '1', { transfer: '2026-06-27' })]), [{
  rowKey: 'm1::16.3.0.140', activityId: 'transfer', activityName: '版本转测时间',
  message: '版本转测时间应等于tOS版本转测时间（2026-06-26）', boundaryDate: '2026-06-26', boundaryType: 'equality',
}])
assert.deepEqual(errorsFor([machineRow('m1', '16.3.0.140', '2', { transfer: '2026-07-02' }), machineRow('m2', '16.3.0.140', '2', { transfer: '2026-07-03' })]).filter(error => error.activityName === '版本转测时间').map(error => error.message), [
  '同一1+N转测类型的版本转测时间需保持一致（2026-07-03）', '同一1+N转测类型的版本转测时间需保持一致（2026-07-02）',
])
assert.ok(errorsFor([machineRow('base', '16.3.0.140', '1', { transfer: '2026-06-26' }), machineRow('m2', '16.3.0.140', '2', { transfer: '2026-07-02' })]).some(error => error.message === '版本转测时间需晚于上一个1+N转测类型至少1周（2026-07-03）'))
assert.equal(errorsFor([machineRow('base', '16.3.0.140', '1', { transfer: '2026-06-26' }), machineRow('m2', '16.3.0.140', '2', { transfer: '2026-07-03' })]).some(error => error.message.includes('至少1周')), false)
// Type gaps compare to the greatest existing smaller numeric type (3, not 1).
assert.ok(errorsFor([machineRow('one', '16.3.0.140', '1', { transfer: '2026-06-26' }), machineRow('three', '16.3.0.140', '3', { transfer: '2026-07-10' }), machineRow('five', '16.3.0.140', '5', { transfer: '2026-07-16' })]).some(error => error.rowKey === 'five::16.3.0.140' && error.message === '版本转测时间需晚于上一个1+N转测类型至少1周（2026-07-17）'))
assert.ok(errorsFor([machineRow('m', '16.3.0.140', '2', { transfer: '2026-07-21' })]).some(error => error.message === '版本转测时间不能超过下一个tOS版本的测试开始时间（2026-07-20）'))

const dynamicPreviousBoundaryErrors = errorsFor([
  machineRow('previous-a', '16.3.0.140', '2', { transfer: '2026-07-01' }),
  machineRow('previous-b', '16.3.0.140', '2', { transfer: '2026-07-05' }),
  machineRow('current', '16.3.0.140', '3', { transfer: '2026-07-10' }),
]).filter(error => error.rowKey === 'current::16.3.0.140' && error.activityName === '版本转测时间')
assert.deepEqual(dynamicPreviousBoundaryErrors, [{
  rowKey: 'current::16.3.0.140', activityId: 'transfer', activityName: '版本转测时间',
  message: '版本转测时间需晚于上一个1+N转测类型至少1周（2026-07-12）', boundaryDate: '2026-07-12', boundaryType: 'minimum',
}])

const boundedFields = ['测试开始时间', '测试完成时间', '评审时间', '软件归档时间', 'OTA开放验证&部署']
const idByName = Object.fromEntries(mrActivities.filter(activity => activity.parentId).map(activity => [activity.activityName, activity.id]))
for (const name of boundedFields) {
  const id = idByName[name]
  const tosFieldDate = tos140.dates[id]
  assert.ok(errorsFor([machineRow('m', '16.3.0.140', '1', { [id]: '2026-01-01' })]).some(error => error.message === `${name}不早于tOS项目时间，可与tOS项目保持一致（${tosFieldDate}）` && error.boundaryDate === tosFieldDate && error.boundaryType === 'minimum'))
  assert.ok(errorsFor([machineRow('m', '16.3.0.140', '1', { [id]: '2026-07-21' })]).some(error => error.message === `${name}不能超过下一个tOS版本的测试开始时间（2026-07-20）` && error.boundaryDate === '2026-07-20' && error.boundaryType === 'maximum'))
  const previousDate = '2026-07-01'
  assert.ok(errorsFor([machineRow('prev', '16.3.0.140', '3', { [id]: previousDate }), machineRow('current', '16.3.0.140', '5', { [id]: '2026-07-07' })]).some(error => error.message === `${name}需晚于上一个1+N转测类型至少1周（2026-07-08）` && error.boundaryDate === '2026-07-08' && error.boundaryType === 'minimum'))
}
const correspondingNextActivityErrors = errorsFor([machineRow('m', '16.3.0.140', '2', { review: '2026-07-28' })])
assert.ok(correspondingNextActivityErrors.some(error => (
  error.message === '评审时间不能超过下一个tOS版本的评审时间（2026-07-27）'
  && error.boundaryDate === '2026-07-27'
  && error.boundaryType === 'maximum'
)))
const crossedBoundsCurrent = makeTosInstance('16.3.0.140', { review: '2026-07-30' })
const crossedBoundsNext = makeTosInstance('16.3.0.145', { 'test-start': '2026-07-20' })
const crossedBoundsErrors = errorsFor([machineRow('crossed', '16.3.0.140', '1', { review: '2026-07-25' })], [crossedBoundsCurrent, crossedBoundsNext])
assert.deepEqual(crossedBoundsErrors.map(error => [error.boundaryType, error.boundaryDate, error.message]), [
  ['minimum', '2026-07-30', '评审时间不早于tOS项目时间，可与tOS项目保持一致（2026-07-30）'],
  ['maximum', '2026-07-20', '评审时间不能超过下一个tOS版本的测试开始时间（2026-07-20）'],
])
// Last tOS version has no next upper bound, while missing references skip comparison.
assert.deepEqual(errorsFor([machineRow('last', '16.3.0.150', '1', { 'test-start': '2027-01-01' })]).filter(error => error.activityName === '测试开始时间'), [])
assert.deepEqual(errorsFor([machineRow('missing-ref', '16.3.0.999', '1', { transfer: '2027-01-01' })], [makeTosInstance('16.3.0.999', {})]), [])
const malformedErrors = errorsFor([machineRow('bad', '16.3.0.140', '1', { transfer: '2026-02-30', review: 'not-a-date' })])
assert.deepEqual(malformedErrors.map(error => error.message), ['版本转测时间日期格式不正确', '评审时间日期格式不正确'])
assert.ok(malformedErrors.every(error => error.boundaryDate === undefined && error.boundaryType === undefined))
const aliasValidationErrors = errorsFor([
  machineRow('alias-a', '016.03.00.140.0', '2', { transfer: '2026-07-02' }),
  machineRow('alias-b', '16.3.0.140', '2', { transfer: '2026-07-03' }),
])
assert.equal(aliasValidationErrors.filter(error => (
  error.message.startsWith('同一1+N转测类型的版本转测时间需保持一致（')
  && error.boundaryType === 'equality'
  && error.message.endsWith(`（${error.boundaryDate}）`)
)).length, 2)

const naSource = machineRow('na', '16.3.0.140', 'N/A', { transfer: '2026-01-01' })
const clearedNa = dateRules.clearDatesForNa(naSource)
assert.deepEqual(clearedNa.dates, {})
assert.deepEqual(naSource.dates, { transfer: '2026-01-01' })
assert.notStrictEqual(clearedNa, naSource)
assert.deepEqual(dateRules.validateMachineMarketDate({ value: '2026-07-10', mainValue: '', activityId: 'test-start', activityName: '测试开始时间' }), ['主市场对应时间未填写，当前市场不可填写'])
assert.deepEqual(dateRules.validateMachineMarketDate({ value: '2026-07-12', mainValue: '2026-07-11', activityId: 'test-start', activityName: '测试开始时间' }), ['非主市场时间不得晚于主市场对应时间（2026-07-11）'])
assert.deepEqual(dateRules.validateMachineMarketDate({ value: '', mainValue: '2026-07-11', activityId: 'test-start', activityName: '测试开始时间' }), [])
assert.deepEqual(dateRules.validateMachineMarketDate({ value: 'bad', mainValue: '2026-07-11', activityId: 'test-start', activityName: '测试开始时间' }), ['测试开始时间日期格式不正确'])
const grouped = dateRules.groupMrErrorsByRow([
  { rowKey: 'r2', activityId: 'a', activityName: 'A', message: 'E2' },
  { rowKey: 'r1', activityId: 'b', activityName: 'B', message: 'E1' },
  { rowKey: 'r2', activityId: 'a', activityName: 'A', message: 'E2' },
  { rowKey: 'r3', activityId: 'c', activityName: 'C', message: 'E3', boundaryDate: '2026-01-01', boundaryType: 'minimum' },
  { rowKey: 'r3', activityId: 'c', activityName: 'C', message: 'E3', boundaryDate: '2026-01-01', boundaryType: 'minimum' },
  { rowKey: 'r3', activityId: 'c', activityName: 'C', message: 'E3', boundaryDate: '2026-01-02', boundaryType: 'minimum' },
])
assert.deepEqual(grouped, {
  r2: [{ rowKey: 'r2', activityId: 'a', activityName: 'A', message: 'E2' }],
  r1: [{ rowKey: 'r1', activityId: 'b', activityName: 'B', message: 'E1' }],
  r3: [
    { rowKey: 'r3', activityId: 'c', activityName: 'C', message: 'E3', boundaryDate: '2026-01-01', boundaryType: 'minimum' },
    { rowKey: 'r3', activityId: 'c', activityName: 'C', message: 'E3', boundaryDate: '2026-01-02', boundaryType: 'minimum' },
  ],
})

// Read-only adapters: select only the latest published L1 source from the effective scope.
const adapterFallbackVersions = [
  { id: 'fallback-published', versionNo: 'V1', status: '已发布' },
]
const tosAdapterProject = {
  id: 'tos-adapter', name: 'tOS16.3', type: 'tOS版本项目', status: '在研', progress: 0,
  leader: '李白', markets: [], androidVersion: '', chipPlatform: '', spm: '', updatedAt: '',
  productLine: 'tOS', tosVersion: 'tOS16.3', planStartDate: '', planEndDate: '', developCycle: 0,
  healthStatus: 'normal', versionType: 'Slim', versionTypes: ['Slim', 'Full'],
  fieldValues: { tosVersionProjectManager: [' 李白 ', '张三', '李白', ''] },
}
const tosTypeRows = [
  { id: 'full', type: 'Full', isMain: true, followsMain: false },
  { id: 'slim', type: 'Slim', isMain: false, followsMain: true },
]
const tosVersionsByKey = {
  'project::tos-adapter::tos-type::Full::level1::versions': [
    { id: 'tos-v5-draft', versionNo: 'V5', status: '修订中' },
    { id: 'tos-v2', versionNo: 'V2', status: '已发布' },
    { id: 'tos-v4', versionNo: 'V4', status: '已发布' },
  ],
  'project::tos-adapter::tos-type::Slim::level1::versions': [
    { id: 'slim-v99', versionNo: 'V99', status: '已发布' },
  ],
}
const tosPublishedSnapshots = {
  'project::tos-adapter::tos-type::Full::level1::tos-v2::snapshot': [
    { id: 'tos-old', taskName: 'STR5', planEndDate: '2025-01-01' },
  ],
  'project::tos-adapter::tos-type::Full::level1::tos-v4::snapshot': [
    { id: 'tos-stage', parentId: null, taskName: '上市迭代阶段', order: 0 },
    { id: 'tos-node', stableId: 'tos-node-stable', parentId: 'tos-stage', taskName: '16.3.0.140', order: 1, planStartDate: new Date('2026-01-01T16:00:00.000Z'), planEndDate: '2026-01-02T23:30:00-05:00' },
    { id: 'tos-invalid', parentId: 'tos-stage', taskName: '16.3.0.145', order: 2, planStartDate: '2026-02-30', planEndDate: '2026/03/01' },
  ],
}
const selectedTosSource = adapter.selectLatestPublishedTosLevel1({
  project: tosAdapterProject,
  tosTypeRows,
  tosTypeVersionsByKey: tosVersionsByKey,
  publishedSnapshots: tosPublishedSnapshots,
  fallbackVersions: adapterFallbackVersions,
})
assert.equal(selectedTosSource.versionId, 'tos-v4')
assert.equal(selectedTosSource.versionNo, 'V4')
assert.deepEqual(selectedTosSource.tasks.map(task => [task.id, task.stableId, task.planStartDate, task.planEndDate]), [
  ['tos-stage', undefined, '', ''],
  ['tos-node', 'tos-node-stable', '2026-01-02', '2026-01-03'],
  ['tos-invalid', undefined, '', ''],
])
assert.deepEqual(selectedTosSource.getSnapshot('tos-v4'), selectedTosSource.tasks)
assert.notStrictEqual(selectedTosSource.getSnapshot('tos-v4'), selectedTosSource.tasks)
assert.equal(adapter.selectLatestPublishedTosLevel1({
  project: tosAdapterProject,
  tosTypeRows,
  tosTypeVersionsByKey: {
    'project::tos-adapter::tos-type::Full::level1::versions': [{ id: 'draft-only', versionNo: 'V9', status: '修订中' }],
  },
  publishedSnapshots: tosPublishedSnapshots,
  fallbackVersions: adapterFallbackVersions,
}), null)

const machineAdapterProject = {
  id: 'machine-adapter', name: 'X6877-D8400_H991', type: '整机产品项目', status: '在研', progress: 0,
  leader: '张三', markets: ['OP', 'RU'], androidVersion: '', chipPlatform: 'MTK', spm: '李白', updatedAt: '',
  productLine: 'NOTE', tosVersion: 'tOS16.3', planStartDate: '', planEndDate: '', developCycle: 0,
  healthStatus: 'normal', productType: '新品', firstSaleTosVersion: '16.3.0.110', cpu: 'MT6877',
}
const machineMarketRows = [
  { id: 'ru', market: 'RU', isMain: false, followsMain: false, isMadaControlled: '否' },
  { id: 'op', market: 'OP', isMain: true, followsMain: false, isMadaControlled: '否' },
  { id: 'in', market: 'IN', isMain: false, followsMain: false, isMadaControlled: '是' },
]
const machineVersionsByKey = {
  'project::machine-adapter::OP::level1::versions': [
    { id: 'machine-v4-draft', versionNo: 'V4', status: '修订中' },
    { id: 'machine-v1', versionNo: 'V1', status: '已发布' },
    { id: 'machine-v3', versionNo: 'V3', status: '已发布' },
  ],
  'project::machine-adapter::RU::level1::versions': [
    { id: 'ru-v99', versionNo: 'V99', status: '已发布' },
  ],
}
const machinePublishedSnapshots = {
  'project::machine-adapter::OP::level1::machine-v1': [{ id: 'old', taskName: 'STR5', planEndDate: '2024-01-01' }],
  'project::machine-adapter::OP::level1::machine-v3': [
    { id: 'machine-stage', parentId: null, taskName: '开发验证阶段', order: 0 },
    { id: 'machine-str5', stableId: 'ms-str5', parentId: 'machine-stage', taskName: 'STR5', order: 1, planStartDate: 'bad', planEndDate: '2026-05-15T00:30:00+08:00' },
  ],
  'project::machine-adapter::RU::level1::ru-v99': [{ id: 'ru-str5', taskName: 'STR5', planEndDate: '2099-01-01' }],
}
const selectedMachineSource = adapter.selectLatestPublishedMachineLevel1({
  project: machineAdapterProject,
  marketRows: machineMarketRows,
  marketVersionsByKey: machineVersionsByKey,
  publishedSnapshots: machinePublishedSnapshots,
  fallbackVersions: adapterFallbackVersions,
})
assert.equal(selectedMachineSource.versionId, 'machine-v3')
assert.equal(selectedMachineSource.tasks.find(row => row.taskName === 'STR5').planEndDate, '2026-05-15')
assert.equal(selectedMachineSource.tasks.find(row => row.taskName === 'STR5').planStartDate, '')
assert.equal(adapter.selectLatestPublishedMachineLevel1({
  project: machineAdapterProject,
  marketRows: machineMarketRows,
  marketVersionsByKey: { 'project::machine-adapter::OP::level1::versions': [{ id: 'draft', versionNo: 'V8', status: '修订中' }] },
  publishedSnapshots: machinePublishedSnapshots,
  fallbackVersions: adapterFallbackVersions,
}), null)

assert.deepEqual(adapter.projectMachineMrMetadata(machineAdapterProject, machineMarketRows), {
  projectName: 'X6877-D8400_H991',
  marketName: 'OP',
  productLine: 'NOTE',
  spm: '李白',
  spmUsers: ['李白'],
  isMada: '是',
  socPlatform: 'MT6877',
  packageMode: '/',
})
assert.equal(adapter.projectMachineMrMetadata(machineAdapterProject, machineMarketRows.map(row => ({ ...row, isMadaControlled: '否' }))).isMada, '否')
assert.deepEqual(adapter.getTosManagerUsers(tosAdapterProject), ['李白', '张三'])
assert.deepEqual(adapter.getTosManagerUsers({ ...tosAdapterProject, fieldValues: {}, versionFiveRoles: undefined, responsiblePersons: undefined, leader: '' }), [])

const adapterInput = {
  projects: [machineAdapterProject, tosAdapterProject],
  marketConfigsByProjectId: { 'machine-adapter': machineMarketRows },
  tosTypeConfigsByProjectId: { 'tos-adapter': tosTypeRows },
  marketVersionsByKey: machineVersionsByKey,
  tosTypeVersionsByKey: tosVersionsByKey,
  publishedSnapshots: { ...tosPublishedSnapshots, ...machinePublishedSnapshots },
  fallbackVersions: adapterFallbackVersions,
}
const adapterInputBefore = structuredClone(adapterInput)
const aggregationSources = adapter.buildMrAggregationSources(adapterInput)
assert.deepEqual(aggregationSources.tosProjects, [
  { projectId: 'tos-adapter', tosProjectKey: '16.3', projectName: 'tOS16.3' },
])
assert.deepEqual(aggregationSources.machineProjects, [
  { id: 'machine-adapter', projectName: 'X6877-D8400_H991', productType: '新品', firstSaleTosVersion: '16.3.0.110', currentTosVersion: '16.3', spm: '李白', spmUsers: ['李白'] },
])
const legacyMultiSpmProject = { ...machineAdapterProject, spm: '李白，张三; 李白；王五' }
const legacyMultiSpmMetadata = adapter.projectMachineMrMetadata(legacyMultiSpmProject, machineMarketRows)
assert.deepEqual(legacyMultiSpmMetadata.spmUsers, ['李白', '张三', '王五'])
assert.equal(legacyMultiSpmMetadata.spm, '李白,张三,王五')
const legacyMultiSpmSources = adapter.buildMrAggregationSources({ ...adapterInput, projects: [legacyMultiSpmProject] })
assert.deepEqual(legacyMultiSpmSources.machineProjects[0].spmUsers, ['李白', '张三', '王五'])
for (const currentUser of ['李白', '张三', '王五']) {
  assert.equal(planRules.resolveMrPermissions({ currentUser, globalAdminUsers: [], tosManagerUsers: [], machineSpm: legacyMultiSpmSources.machineProjects[0].spm, machineSpmUsers: legacyMultiSpmSources.machineProjects[0].spmUsers, machineProjectId: legacyMultiSpmSources.machineProjects[0].id, context: 'joint-machine' }).canEditMachine, true)
}
assert.equal(planRules.resolveMrPermissions({ currentUser: '赵六', globalAdminUsers: [], tosManagerUsers: [], machineSpm: legacyMultiSpmSources.machineProjects[0].spm, machineSpmUsers: legacyMultiSpmSources.machineProjects[0].spmUsers, machineProjectId: legacyMultiSpmSources.machineProjects[0].id, context: 'joint-machine' }).canEditMachine, false)
const legacyReferenceSources = adapter.buildMrAggregationSources({
  ...adapterInput,
  projects: [{ ...machineAdapterProject, firstSaleTosVersionId: 'tos-16-3', currentTosVersionId: 'tos-17-1' }],
})
assert.equal(legacyReferenceSources.machineProjects[0].firstSaleTosVersion, '16.3')
assert.equal(legacyReferenceSources.machineProjects[0].currentTosVersion, '17.1')

const namedTosProjects = [
  { ...tosAdapterProject, id: 'tos-17-1', name: 'tOS17.1', tosVersion: 'tOS16.3' },
  { ...tosAdapterProject, id: 'tos-16-2', name: 'tOS16.2', tosVersion: 'tOS16.3' },
  { ...tosAdapterProject, id: 'tos-16-3', name: 'tOS16.3', tosVersion: 'tOS16.3' },
  { ...tosAdapterProject, id: 'tos-invalid', name: 'HiOS-Launcher', tosVersion: 'tOS16.3' },
]
const namedTosSources = adapter.buildMrAggregationSources({
  ...adapterInput,
  projects: namedTosProjects,
  tosTypeConfigsByProjectId: Object.fromEntries(namedTosProjects.map(project => [project.id, tosTypeRows])),
})
assert.deepEqual(namedTosSources.tosProjects.map(project => [project.projectId, project.tosProjectKey]), [
  ['tos-16-2', '16.2'],
  ['tos-16-3', '16.3'],
  ['tos-17-1', '17.1'],
])
assert.throws(() => adapter.buildMrAggregationSources({
  ...adapterInput,
  projects: [
    { ...tosAdapterProject, id: 'tos-duplicate-a', name: 'tOS16.3' },
    { ...tosAdapterProject, id: 'tos-duplicate-b', name: 'TOS016.03' },
  ],
  tosTypeConfigsByProjectId: { 'tos-duplicate-a': tosTypeRows, 'tos-duplicate-b': tosTypeRows },
}), /tOS项目版本键重复：16\.3/)
assert.deepEqual(Object.keys(aggregationSources.latestPublishedLevel1ByProjectId), ['machine-adapter', 'tos-adapter'])
assert.deepEqual(aggregationSources.machineMetadataByProjectId['machine-adapter'], adapter.projectMachineMrMetadata(machineAdapterProject, machineMarketRows))
assert.deepEqual(aggregationSources.tosManagerUsersByProjectId, { 'tos-adapter': ['李白', '张三'] })
assert.deepEqual(adapterInput, adapterInputBefore)
const rebuiltAggregationSources = adapter.buildMrAggregationSources(adapterInput)
assert.deepEqual(JSON.parse(JSON.stringify(rebuiltAggregationSources)), JSON.parse(JSON.stringify(aggregationSources)))
assert.notStrictEqual(rebuiltAggregationSources.machineProjects[0], aggregationSources.machineProjects[0])
aggregationSources.latestPublishedLevel1ByProjectId['machine-adapter'].tasks[0].taskName = 'mutated output'
assert.equal(machinePublishedSnapshots['project::machine-adapter::OP::level1::machine-v3'][0].taskName, '开发验证阶段')

const noPublishedSources = adapter.buildMrAggregationSources({
  ...adapterInput,
  tosTypeVersionsByKey: { 'project::tos-adapter::tos-type::Full::level1::versions': [{ id: 'tos-draft', versionNo: 'V8', status: '修订中' }] },
  marketVersionsByKey: { 'project::machine-adapter::OP::level1::versions': [{ id: 'machine-draft', versionNo: 'V8', status: '修订中' }] },
})
assert.deepEqual(noPublishedSources.latestPublishedLevel1ByProjectId, {})

// Persisted MR store: guarded writes, atomic reconciliation, migration, and hydration.
const createMemoryStorage = (seed = {}) => {
  const values = new Map(Object.entries(seed))
  const counts = { get: 0, set: 0, remove: 0 }
  return {
    getItem: key => { counts.get += 1; return values.get(key) ?? null },
    setItem: (key, value) => { counts.set += 1; values.set(key, value) },
    removeItem: key => { counts.remove += 1; values.delete(key) },
    dump: () => Object.fromEntries(values),
    counts,
  }
}
const hydrationStorage = createMemoryStorage({ 'pms-level3-plan-store': JSON.stringify({ legacy: true }) })
globalThis.window = { localStorage: hydrationStorage }
const mrStore = loadTypeScriptModule(root, 'src/stores/mrVersionPlan.ts')
assert.equal(mrStore.MR_VERSION_PLAN_STORAGE_KEY, 'pms-mr-version-plan-store')

// Task 13 acceptance seed and real-browser registration contract.
assert.equal(task13PackageJson.scripts['verify:mr-version-plan-browser'], 'node screenshots/verify-mr-version-plan-browser.mjs')
assert.equal(typeof templateMocks.createInitialMrVersionPlanState, 'function')
assert.equal(typeof templateMocks.createMrAcceptancePlanScopeSeed, 'function')
assert.equal(typeof templateMocks.MR_MOCK_SCENARIOS, 'object', 'MR mock scenarios must expose a stable catalog')
assert.deepEqual(templateMocks.MR_MOCK_SCENARIOS.tos, [
  'normal', 'boundary-valid', 'before-plan-start', 'after-plan-end',
])
assert.deepEqual(templateMocks.MR_MOCK_SCENARIOS.joint, [
  'normal-type-1', 'same-type-mismatch', 'one-week-gap', 'tos-baseline', 'next-version-boundary',
])
assert.deepEqual(templateMocks.MR_MOCK_SCENARIOS.market, [
  'normal-follow', 'later-than-main', 'missing-main-boundary',
])
assert.equal(Object.isFrozen(templateMocks.MR_MOCK_SCENARIOS), true)
assert.ok(Object.values(templateMocks.MR_MOCK_SCENARIOS).every(Object.isFrozen))
const acceptanceStateA = templateMocks.createInitialMrVersionPlanState()
const acceptanceStateB = templateMocks.createInitialMrVersionPlanState()
assert.notEqual(acceptanceStateA, acceptanceStateB)
assert.notEqual(acceptanceStateA.templateVersions, acceptanceStateB.templateVersions)
assert.notEqual(acceptanceStateA.tosInstancesByProjectId, acceptanceStateB.tosInstancesByProjectId)
assert.notEqual(acceptanceStateA.machinePlansByKey, acceptanceStateB.machinePlansByKey)
assert.notEqual(acceptanceStateA.marketOverridesByKey, acceptanceStateB.marketOverridesByKey)
assert.deepEqual(acceptanceStateA, acceptanceStateB)
assert.deepEqual(
  acceptanceStateA.tosInstancesByProjectId['19'].map(instance => instance.tosVersion),
  ['16.3.0.135', '16.3.0.140', '16.3.0.145', '16.3.0.150', '16.3.0.155'],
)
assert.ok(acceptanceStateA.tosInstancesByProjectId['19'].every(instance => (
  instance.activities.filter(activity => activity.parentId !== null).every(activity => /^\d{4}-\d{2}-\d{2}$/.test(instance.dates[activity.id]))
)))
assert.ok(Object.keys(acceptanceStateA.machinePlansByKey).length >= 5)
assert.ok(Object.keys(acceptanceStateA.marketOverridesByKey).length >= 4)
assert.equal(acceptanceStateA.machinePlansByKey['1::16.3.0.140'].transferType, '2')
assert.equal(acceptanceStateA.machinePlansByKey['3::16.3.0.140'].transferType, '2')
assert.equal(acceptanceStateA.machinePlansByKey['3::16.3.0.140'].dates['mr-node-mp-intake-deadline'], '2026-05-25')
assert.equal(acceptanceStateA.marketOverridesByKey['1::16.3.0.140::TR'].dates['mr-node-test-start'], '2026-05-23')
assert.notStrictEqual(acceptanceStateA.tosInstancesByProjectId['19'][0], acceptanceStateB.tosInstancesByProjectId['19'][0])
assert.notStrictEqual(acceptanceStateA.tosInstancesByProjectId['19'][0].activities, acceptanceStateB.tosInstancesByProjectId['19'][0].activities)
assert.notStrictEqual(acceptanceStateA.tosInstancesByProjectId['19'][0].activities[0], acceptanceStateB.tosInstancesByProjectId['19'][0].activities[0])
assert.notStrictEqual(acceptanceStateA.tosInstancesByProjectId['19'][0].dates, acceptanceStateB.tosInstancesByProjectId['19'][0].dates)
assert.notStrictEqual(acceptanceStateA.machinePlansByKey['1::16.3.0.140'].dates, acceptanceStateB.machinePlansByKey['1::16.3.0.140'].dates)
assert.notStrictEqual(acceptanceStateA.marketOverridesByKey['1::16.3.0.140::TR'].dates, acceptanceStateB.marketOverridesByKey['1::16.3.0.140::TR'].dates)
Object.values(acceptanceStateA.tosInstancesByProjectId).flat().forEach(instance => {
  Object.values(instance.dates).filter(Boolean).forEach(date => assert.equal(planRules.normalizeMrBusinessDate(date), date))
})
Object.values(acceptanceStateA.machinePlansByKey).forEach(plan => {
  Object.values(plan.dates).filter(Boolean).forEach(date => assert.equal(planRules.normalizeMrBusinessDate(date), date))
})
Object.values(acceptanceStateA.marketOverridesByKey).forEach(override => {
  Object.values(override.dates).filter(Boolean).forEach(date => assert.equal(planRules.normalizeMrBusinessDate(date), date))
})

const acceptancePlanScopeA = templateMocks.createMrAcceptancePlanScopeSeed()
const acceptancePlanScopeB = templateMocks.createMrAcceptancePlanScopeSeed()
assert.deepEqual(acceptancePlanScopeA, acceptancePlanScopeB)
assert.notEqual(acceptancePlanScopeA.publishedSnapshots, acceptancePlanScopeB.publishedSnapshots)
assert.notStrictEqual(
  acceptancePlanScopeA.publishedSnapshots['project::19::tos-type::Full::level1::v3::snapshot'],
  acceptancePlanScopeB.publishedSnapshots['project::19::tos-type::Full::level1::v3::snapshot'],
)
assert.notStrictEqual(
  acceptancePlanScopeA.publishedSnapshots['project::19::tos-type::Full::level1::v3::snapshot'][0],
  acceptancePlanScopeB.publishedSnapshots['project::19::tos-type::Full::level1::v3::snapshot'][0],
)
const machineAcceptanceSnapshot = acceptancePlanScopeA.publishedSnapshots['project::1::OP::level1::v3']
const secondMachineAcceptanceSnapshot = acceptancePlanScopeA.publishedSnapshots['project::3::OP::level1::v3']
const tosAcceptanceSnapshot = acceptancePlanScopeA.publishedSnapshots['project::19::tos-type::Full::level1::v3::snapshot']
const tosBoundsByVersion = Object.fromEntries(tosAcceptanceSnapshot
  .filter(task => task.nodeKind === 'business-period')
  .map(task => [task.taskName, { planStartDate: task.planStartDate, planEndDate: task.planEndDate }]))
const acceptanceTosByVersion = Object.fromEntries(
  acceptanceStateA.tosInstancesByProjectId['19'].map(instance => [instance.tosVersion, instance]),
)
const acceptanceTosErrors = version => planRules.validateTosMrInstanceDates(
  acceptanceTosByVersion[version],
  tosBoundsByVersion[version],
)
assert.deepEqual(acceptanceTosErrors('16.3.0.135'), [])
assert.deepEqual(acceptanceTosErrors('16.3.0.140'), [])
assert.equal(acceptanceTosByVersion['16.3.0.140'].dates['mr-node-change-collection'], tosBoundsByVersion['16.3.0.140'].planStartDate)
assert.equal(acceptanceTosByVersion['16.3.0.140'].dates['mr-node-ota-deploy'], tosBoundsByVersion['16.3.0.140'].planEndDate)
assert.deepEqual(acceptanceTosErrors('16.3.0.145').map(error => ({
  activityId: error.activityId,
  message: error.message,
  boundaryDate: error.boundaryDate,
  boundaryType: error.boundaryType,
})), [{
  activityId: 'mr-node-change-collection',
  message: '修改点收集开始时间不能早于一级计划中的计划开始时间（2026-06-16）',
  boundaryDate: '2026-06-16',
  boundaryType: 'minimum',
}])
assert.deepEqual(acceptanceTosErrors('16.3.0.150').map(error => ({
  activityId: error.activityId,
  message: error.message,
  boundaryDate: error.boundaryDate,
  boundaryType: error.boundaryType,
})), [{
  activityId: 'mr-node-ota-deploy',
  message: 'OTA开放验证&部署不能晚于一级计划中的计划完成时间（2026-08-15）',
  boundaryDate: '2026-08-15',
  boundaryType: 'maximum',
}])
assert.deepEqual(acceptanceTosErrors('16.3.0.155'), [])

const initialJointErrors = dateRules.validateJointMachineRows({
  tosInstances: acceptanceStateA.tosInstancesByProjectId['19'],
  machinePlans: Object.values(acceptanceStateA.machinePlansByKey),
})
const initialJointMessages = initialJointErrors.map(error => `${error.rowKey}:${error.message}`)
assert.equal(initialJointErrors.some(error => error.rowKey === '1::16.3.0.145'), false, 'type-1 fixture must stay clean')
assert.equal(initialJointErrors.some(error => error.rowKey === '3::16.3.0.150'), false, 'later numeric type fixture must stay clean')
assert.ok(initialJointMessages.some(message => message.includes('同一1+N转测类型的版本转测时间需保持一致（')))
assert.ok(initialJointMessages.some(message => message.includes('版本转测时间需晚于上一个1+N转测类型至少1周（2026-06-29）')))
assert.ok(initialJointMessages.some(message => message.includes('整机产品项目的MP入库截止时间不得晚于tOS项目时间（2026-05-20）')))
assert.ok(initialJointMessages.some(message => message.includes('测试开始时间不能超过下一个tOS版本的测试开始时间（2026-07-23）')))
assert.ok(initialJointErrors.filter(error => error.boundaryDate).every(error => error.message.endsWith(`（${error.boundaryDate}）`)))

const acceptanceMarketProjection = machineMarketRules.projectMachineMarketMrVersions({
  projectId: '1',
  plansByKey: acceptanceStateA.machinePlansByKey,
  instancesByProjectId: acceptanceStateA.tosInstancesByProjectId,
  marketRows: [
    { id: 'market-op', market: 'OP', isMain: true, followsMain: false },
    { id: 'market-tr', market: 'TR', isMain: false, followsMain: false },
    { id: 'market-ru', market: 'RU', isMain: false, followsMain: false },
  ],
})
const market140 = acceptanceMarketProjection.versions.find(version => version.tosVersion === '16.3.0.140')
assert.ok(market140)
const marketDateErrors = (market, activityId, activityName) => dateRules.validateMachineMarketDate({
  value: machineMarketRules.getMachineMarketDate({
    plan: market140.plan,
    overridesByKey: acceptanceStateA.marketOverridesByKey,
    market,
    mainMarket: 'OP',
    activityId,
  }),
  mainValue: machineMarketRules.getMachineMarketDate({
    plan: market140.plan,
    overridesByKey: acceptanceStateA.marketOverridesByKey,
    market: 'OP',
    mainMarket: 'OP',
    activityId,
  }),
  activityId,
  activityName,
})
assert.deepEqual(marketDateErrors('TR', 'mr-node-test-start', '测试开始时间'), [])
assert.deepEqual(marketDateErrors('RU', 'mr-node-review', '评审时间'), ['非主市场时间不得晚于主市场对应时间（2026-06-03）'])
assert.deepEqual(marketDateErrors('TR', 'mr-node-archive', '软件归档时间'), ['主市场对应时间未填写，当前市场不可填写'])

acceptanceStateA.tosInstancesByProjectId['19'][0].dates['mr-node-test-start'] = '2099-01-01'
assert.equal(acceptanceStateB.tosInstancesByProjectId['19'][0].dates['mr-node-test-start'], '2026-04-23')
const taskTopology = tasks => tasks.map(task => ({
  stableId: task.stableId,
  parentStableId: task.parentId == null
    ? null
    : tasks.find(candidate => candidate.id === task.parentId)?.stableId,
  order: task.order,
  taskName: task.taskName,
  nodeKind: task.nodeKind,
}))
assert.deepEqual(
  machineAcceptanceSnapshot.filter(task => task.parentId == null).map(task => task.taskName),
  ['概念阶段', '计划阶段', '开发验证阶段', '上市阶段', '生命周期阶段'],
  'MR acceptance seed must preserve all five machine level-one stages',
)
assert.deepEqual(
  taskTopology(machineAcceptanceSnapshot),
  taskTopology(level1PlanRules.MACHINE_LEVEL1_TEMPLATE_TASKS),
  'MR acceptance seed must preserve every fixed machine milestone and its parent/order topology',
)
assert.deepEqual(
  taskTopology(secondMachineAcceptanceSnapshot),
  taskTopology(level1PlanRules.MACHINE_LEVEL1_TEMPLATE_TASKS),
  'both seeded machine projects must retain the complete level-one topology',
)
assert.notEqual(machineAcceptanceSnapshot, secondMachineAcceptanceSnapshot)
assert.deepEqual(
  tosAcceptanceSnapshot.filter(task => task.parentId == null).map(task => task.taskName),
  ['概念阶段', '计划阶段', '开发验证阶段', '上市迭代阶段', '维护阶段'],
  'MR acceptance seed must preserve all five tOS level-one stages',
)
const fixedTosTopology = taskTopology(tosAcceptanceSnapshot.filter(task => !/^16\.3\.0\./.test(task.taskName)))
assert.deepEqual(
  fixedTosTopology,
  taskTopology(level1PlanRules.TOS_LEVEL1_TEMPLATE_TASKS),
  'MR acceptance seed must preserve every fixed tOS milestone and its parent/order topology',
)
assert.deepEqual(
  tosAcceptanceSnapshot.filter(task => /^16\.3\.0\./.test(task.taskName)).map(task => task.taskName),
  ['16.3.0.135', '16.3.0.140', '16.3.0.145', '16.3.0.150', '16.3.0.155', '16.3.0.160'],
)
assert.deepEqual(
  tosAcceptanceSnapshot.filter(task => /^16\.3\.0\./.test(task.taskName)).map(task => ({
    taskName: task.taskName,
    parentName: tosAcceptanceSnapshot.find(parent => parent.id === task.parentId)?.taskName,
    planStartDate: task.planStartDate,
    planEndDate: task.planEndDate,
  })),
  [
    { taskName: '16.3.0.135', parentName: '上市迭代阶段', planStartDate: '2026-04-16', planEndDate: '2026-05-15' },
    { taskName: '16.3.0.140', parentName: '上市迭代阶段', planStartDate: '2026-05-16', planEndDate: '2026-06-15' },
    { taskName: '16.3.0.145', parentName: '维护阶段', planStartDate: '2026-06-16', planEndDate: '2026-07-15' },
    { taskName: '16.3.0.150', parentName: '维护阶段', planStartDate: '2026-07-16', planEndDate: '2026-08-15' },
    { taskName: '16.3.0.155', parentName: '维护阶段', planStartDate: '2026-08-16', planEndDate: '2026-09-15' },
    { taskName: '16.3.0.160', parentName: '维护阶段', planStartDate: '2026-09-16', planEndDate: '' },
  ],
  'tOS MR candidates must retain their required business ranges, including the deliberately incomplete candidate',
)
assert.ok(
  tosAcceptanceSnapshot.filter(task => /^16\.3\.0\./.test(task.taskName))
    .every(task => task.role !== 'SPM' && task.responsible !== 'SPM'),
  'seeded business nodes must not use a role label as a fake notification user identity',
)
assert.equal(
  tosAcceptanceSnapshot.find(task => task.taskName === '16.3.0.160').planEndDate,
  '',
)
assert.equal(
  machineAcceptanceSnapshot.find(task => task.taskName === 'STR5').planEndDate,
  '2026-05-15',
)
assert.deepEqual(
  acceptancePlanScopeA.marketVersionsByKey['project::1::OP::level1::versions'].map(version => version.versionNo),
  ['V1', 'V2', 'V3'],
  'MR eligibility seed must retain published machine plan history instead of collapsing the level-one surface to one row',
)
assert.deepEqual(
  acceptancePlanScopeA.tosTypeVersionsByKey['project::19::tos-type::Full::level1::versions'].map(version => version.versionNo),
  ['V1', 'V2', 'V3'],
  'MR eligibility seed must retain published tOS plan history for revision and name-rule flows',
)
assert.deepEqual(
  acceptancePlanScopeA.marketVersionsByKey['project::1::OP::level1::versions'].map(version => version.id),
  ['v1', 'v2', 'v3'],
  'acceptance history ids must align with the plan compare store defaults instead of leaving a blank comparison target',
)
assert.deepEqual(
  acceptancePlanScopeA.tosTypeVersionsByKey['project::19::tos-type::Full::level1::versions'].map(version => version.id),
  ['v1', 'v2', 'v3'],
  'tOS acceptance history uses the same scoped compare-compatible version ids',
)
const acceptanceVersionScopes = [
  {
    versions: acceptancePlanScopeA.marketVersionsByKey['project::1::OP::level1::versions'],
    snapshotKey: versionId => `project::1::OP::level1::${versionId}`,
  },
  {
    versions: acceptancePlanScopeA.marketVersionsByKey['project::3::OP::level1::versions'],
    snapshotKey: versionId => `project::3::OP::level1::${versionId}`,
  },
  {
    versions: acceptancePlanScopeA.tosTypeVersionsByKey['project::19::tos-type::Full::level1::versions'],
    snapshotKey: versionId => `project::19::tos-type::Full::level1::${versionId}::snapshot`,
  },
]
const allAcceptanceSnapshots = []
for (const scope of acceptanceVersionScopes) {
  for (const version of scope.versions.filter(candidate => candidate.status === '已发布')) {
    const snapshot = acceptancePlanScopeA.publishedSnapshots[scope.snapshotKey(version.id)]
    assert.ok(snapshot, `every published acceptance version requires a matching snapshot: ${scope.snapshotKey(version.id)}`)
    assert.equal(snapshot.filter(task => task.parentId == null).length, 5, 'every published acceptance snapshot preserves the complete five-stage topology')
    allAcceptanceSnapshots.push(snapshot)
  }
}
assert.equal(new Set(allAcceptanceSnapshots).size, allAcceptanceSnapshots.length, 'published snapshots must not share array references across versions or project scopes')
assert.equal(
  new Set(allAcceptanceSnapshots.flat()).size,
  allAcceptanceSnapshots.reduce((count, snapshot) => count + snapshot.length, 0),
  'published snapshots must not share task object references across versions or project scopes',
)
assert.ok(
  allAcceptanceSnapshots.flat().every(task => task.responsible !== 'SPM'),
  'seed snapshots may retain the SPM role but responsible must remain empty instead of using the role label as a user identity',
)
assert.equal(
  machineAcceptanceSnapshot.find(task => task.stableId === 'machine-ms-str5')?.planEndDate,
  '2026-05-15',
  'MR eligibility must bind the machine STR5 date through its stable id',
)
assert.equal(
  tosAcceptanceSnapshot.find(task => task.stableId === 'tos-ms-str5')?.planEndDate,
  '2026-05-15',
  'tOS MR eligibility must bind STR5 through its stable id',
)
const assertAcceptanceMilestoneBuffer = (snapshot, stableIds, scopeName) => {
  const dates = stableIds.map(stableId => snapshot.find(task => task.stableId === stableId)?.planEndDate || '')
  assert.ok(dates.every(date => /^\d{4}-\d{2}-\d{2}$/.test(date)), `${scopeName} fixed milestone dates must be complete ISO dates`)
  assert.ok(dates.every((date, index) => index === 0 || date >= dates[index - 1]), `${scopeName} fixed milestone dates must stay non-decreasing`)
  const conceptStart = Date.parse(`${dates[0]}T00:00:00.000Z`)
  const str1 = Date.parse(`${dates[1]}T00:00:00.000Z`)
  assert.ok((str1 - conceptStart) / 86_400_000 >= 21, `${scopeName} concept kickoff requires at least 21 days before STR1 so a legal gantt drag is not rolled back`)
}
assertAcceptanceMilestoneBuffer(
  machineAcceptanceSnapshot,
  ['machine-ms-concept-kickoff', 'machine-ms-str1', 'machine-ms-str2', 'machine-ms-str3', 'machine-ms-str4', 'machine-ms-str4a', 'machine-ms-str5'],
  'machine V3',
)
assertAcceptanceMilestoneBuffer(
  tosAcceptanceSnapshot,
  ['tos-ms-concept-kickoff', 'tos-ms-str1', 'tos-ms-str2', 'tos-ms-str3', 'tos-ms-str4', 'tos-ms-str4a', 'tos-ms-str5'],
  'tOS V3',
)
assert.match(templateMocksSource, /MR_ACCEPTANCE_FIXED_MILESTONE_DATES[\s\S]*['"]machine-ms-str5['"][\s\S]*['"]tos-ms-str5['"]/, 'acceptance milestone dates must be keyed by project-specific stable ids')
assert.match(templateMocksSource, /MR_ACCEPTANCE_FIXED_MILESTONE_DATES\[task\.stableId!\]/, 'acceptance date injection must read the immutable stable id')
assert.doesNotMatch(templateMocksSource, /MR_ACCEPTANCE_FIXED_MILESTONE_DATES\[task\.taskName\]/, 'acceptance dates must not depend on editable display names')

assert.match(mrBrowserVerifierSource, /setViewport\(\{\s*width:\s*1600,\s*height:\s*1000\s*\}\)/)
assert.match(mrBrowserVerifierSource, /pms-mr-version-plan-store/)
assert.match(mrBrowserVerifierSource, /pms-level3-plan-store/)
assert.doesNotMatch(mrBrowserVerifierSource, /localStorage\.clear\s*\(/)
for (const helper of [
  'installDeterministicBrowserEnvironment',
  'waitForStableEvidence',
  'assertNaMachineProjection',
  'assertJointStickyColumns',
  'snapshotTemplateRevision',
  'assertTemplateRevisionMutation',
]) assert.match(mrBrowserVerifierSource, new RegExp(`(?:async\\s+)?function\\s+${helper}\\b`), `MR browser acceptance requires named helper ${helper}`)
assert.match(mrBrowserVerifierSource, /FIXED_BROWSER_NOW\s*=\s*['"]2026-08-30T00:00:00\.000\+08:00['"]/)
assert.match(mrBrowserVerifierSource, /evaluateOnNewDocument\(installDeterministicBrowserEnvironment/)
assert.match(
  mrBrowserVerifierSource,
  /['"]--deterministic-mode['"]/,
  'MR browser acceptance must run Chrome compositor stages deterministically so backdrop-filter evidence is byte stable',
)
assert.match(
  mrBrowserVerifierSource,
  /['"]--disable-features=UseSkiaRenderer['"]/,
  'MR browser acceptance must use the stable legacy software renderer for byte-exact transparent SVG evidence',
)
assert.doesNotMatch(mrBrowserVerifierSource, /\.ant-modal-mask\s*\{/, 'MR evidence must preserve the product modal mask visual')
assert.doesNotMatch(mrBrowserVerifierSource, /box-shadow:\s*none\s*!important/, 'MR evidence must preserve product shadows')
assert.doesNotMatch(mrBrowserVerifierSource, /shape-rendering:\s*crispEdges/, 'MR evidence must preserve product icon rendering')
assert.match(
  mrBrowserVerifierSource,
  /const\s+UPDATE_TRACKED_SCREENSHOTS\s*=\s*process\.env\.PMS_UPDATE_SCREENSHOTS\s*===\s*['"]1['"]/,
  'MR browser acceptance must require an explicit opt-in before updating tracked screenshot baselines',
)
assert.match(
  mrBrowserVerifierSource,
  /const\s+OUTPUT\s*=\s*fs\.mkdtempSync\(/,
  'MR browser acceptance must write every run to an isolated temporary actual directory',
)
assert.match(mrBrowserVerifierSource, /function\s+validateScreenshotEvidence\b/, 'MR browser acceptance must validate the complete screenshot allowlist')
assert.match(mrBrowserVerifierSource, /function\s+promoteTrackedScreenshotsAtomically\b/, 'MR screenshot updates must use a transactional directory promotion')
assert.match(mrBrowserVerifierSource, /\.mr-version-plan-staging-/, 'MR screenshot updates must stage beside the tracked directory')
assert.match(mrBrowserVerifierSource, /fs\.renameSync\(TRACKED_OUTPUT,\s*backup\)/, 'MR screenshot updates must first preserve the complete prior baseline')
assert.match(mrBrowserVerifierSource, /fs\.renameSync\(staging,\s*TRACKED_OUTPUT\)/, 'MR screenshot updates must atomically promote the complete staged directory')
assert.match(mrBrowserVerifierSource, /fs\.renameSync\(backup,\s*TRACKED_OUTPUT\)/, 'MR screenshot update failures must roll the prior baseline back')
const mrBrowserErrorGateIndex = mrBrowserVerifierSource.indexOf('assert.deepEqual(browserErrors')
const mrBrowserEvidenceGateIndex = mrBrowserVerifierSource.indexOf('validateScreenshotEvidence(OUTPUT)')
const mrBrowserForcedFailureIndex = mrBrowserVerifierSource.indexOf('PMS_FORCE_FAILURE_AFTER_SCREENSHOTS')
const mrBrowserPromotionIndex = mrBrowserVerifierSource.indexOf('promoteTrackedScreenshotsAtomically(OUTPUT)')
assert.ok(mrBrowserErrorGateIndex >= 0 && mrBrowserErrorGateIndex < mrBrowserEvidenceGateIndex, 'browser errors must fail before screenshot promotion')
assert.ok(mrBrowserEvidenceGateIndex < mrBrowserForcedFailureIndex, 'all eight non-empty screenshots must validate before the controlled failure gate')
assert.ok(mrBrowserForcedFailureIndex < mrBrowserPromotionIndex, 'a failed acceptance run must occur before and never touch baseline promotion')
assert.match(mrBrowserVerifierSource, /document\.fonts\.ready/)
assert.doesNotMatch(
  mrBrowserVerifierSource,
  /\.catch\(\(\)\s*=>\s*\{\}\)/,
  'MR screenshot stabilization must fail when a visible Ant message does not clear before the timeout',
)
assert.match(mrBrowserVerifierSource, /data-mr-row-key/)
assert.match(mrBrowserVerifierSource, /data-mr-date-cell/)
assert.match(mrBrowserVerifierSource, /assert\.equal\(await page\.\$\(['"]\[data-mr-fixed-error-cell\]['"]\),\s*null\)/)
assert.match(mrBrowserVerifierSource, /错误提示/)
assert.match(mrBrowserVerifierSource, /pms-mr-cell-error-icon/)
assert.match(mrBrowserVerifierSource, /2026-05-16/)
assert.match(mrBrowserVerifierSource, /2026-06-16/)
assert.match(mrBrowserVerifierSource, /2026-08-15/)
assert.match(mrBrowserVerifierSource, /2026-06-03/)
assert.match(mrBrowserVerifierSource, /initialScenarioMatrixVerified/)
assert.doesNotMatch(mrBrowserVerifierSource, /setTosCollectionDateThroughProject/)
assert.doesNotMatch(mrBrowserVerifierSource, /fillDate\(['"]input\[aria-label=['"]16\.3\.0\.145-修改点收集开始时间-日期/)
assert.doesNotMatch(mrBrowserVerifierSource, /fillDate\(['"]input\[aria-label=['"]16\.3\.0\.150-OTA开放验证&部署-日期/)
assert.match(mrBrowserVerifierSource, /assert\.deepEqual\([^\n]*dates,\s*\{\}\)/)
assert.match(mrBrowserVerifierSource, /assert\.equal\([^\n]*editableDateInputs[^\n]*,\s*0\)/)
assert.match(mrBrowserVerifierSource, /assertTemplateRevisionMutation\([\s\S]*priorPublished/)
assert.match(mrBrowserVerifierSource, /git\s+diff\s+--exit-code\s+--\s+screenshots\/mr-version-plan/)
assert.doesNotMatch(mrBrowserVerifierSource, /failure\.png/)
assert.match(jointPlanSource, /data-mr-row-key/)
assert.match(jointPlanSource, /data-mr-date-cell/)
assert.doesNotMatch(jointPlanSource, /data-mr-fixed-error-cell/)
assert.match(mrTemplateTableSource, /data-mr-template-activity-id/)
for (let step = 1; step <= 15; step += 1) assert.match(mrBrowserVerifierSource, new RegExp(`STEP ${step} PASS`))
for (const screenshot of [
  'configuration.png', 'tos-vertical.png', 'tos-horizontal.png', 'joint-valid.png',
  'joint-invalid.png', 'stop-record.png', 'machine-vertical.png', 'machine-horizontal.png',
]) assert.match(mrBrowserVerifierSource, new RegExp(screenshot.replace('.', '\\.')))
assert.match(mrBrowserVerifierSource, /PASS MR version plan browser verification/)
assert.equal(mrStore.MR_VERSION_PLAN_STORE_VERSION, 1)
const allFalsePermission = planRules.resolveMrPermissions({ currentUser: '普通用户', globalAdminUsers: [], tosManagerUsers: [], machineSpm: '', context: 'config' })
const adminPermission = planRules.resolveMrPermissions({ currentUser: '管理员', globalAdminUsers: ['管理员'], tosManagerUsers: [], machineSpm: '', context: 'config' })
const tosManagerPermission = planRules.resolveMrPermissions({ currentUser: '李白', globalAdminUsers: [], tosManagerUsers: ['李白'], machineSpm: '', tosProjectId: 'tos-project-16.3', context: 'tos' })
const machinePermission = planRules.resolveMrPermissions({ currentUser: '张三', globalAdminUsers: [], tosManagerUsers: [], machineSpm: '张三', machineProjectId: 'machine-c09', context: 'joint-machine' })
const otherMachinePermission = planRules.resolveMrPermissions({ currentUser: '王五', globalAdminUsers: [], tosManagerUsers: [], machineSpm: '王五', machineProjectId: 'other-machine', context: 'joint-machine' })
const marketPermission = planRules.resolveMrPermissions({ currentUser: '张三', globalAdminUsers: [], tosManagerUsers: [], machineSpm: '张三', machineProjectId: 'machine-c09', context: 'machine-market' })

const freshStore = (initialState, storage = createMemoryStorage()) => mrStore.createMrVersionPlanStore({
  storage,
  initialState,
  now: () => NOW,
  createId: prefix => `${prefix}-contract-id`,
})

const lifecycleStore = freshStore()
assert.equal(lifecycleStore.getState().templateVersions[0].status, '已发布')
const initialLifecycleSnapshot = structuredClone(mrStore.partializeMrVersionPlanState(lifecycleStore.getState()))
assert.equal(lifecycleStore.getState().createTemplateRevision('张三', allFalsePermission), false)
assert.deepEqual(mrStore.partializeMrVersionPlanState(lifecycleStore.getState()), initialLifecycleSnapshot)
assert.equal(lifecycleStore.getState().createTemplateRevision('张三', adminPermission), true)
let draft = lifecycleStore.getState().templateVersions.find(version => version.status === '修订中')
assert.ok(draft)
assert.equal(lifecycleStore.getState().templateHistory.at(-1).action, 'create-revision')
const renamedActivitiesInput = draft.activities.map(activity => activity.id === draft.activities[1].id
  ? { ...activity, activityName: ' 修改点收集启动时间 ' }
  : { ...activity })
const renamedActivitiesBefore = structuredClone(renamedActivitiesInput)
assert.equal(lifecycleStore.getState().updateTemplateActivities(draft.id, renamedActivitiesInput, '王五', allFalsePermission), false)
assert.equal(lifecycleStore.getState().updateTemplateActivities(draft.id, renamedActivitiesInput, '王五', adminPermission), true)
assert.deepEqual(renamedActivitiesInput, renamedActivitiesBefore)
assert.equal(lifecycleStore.getState().templateHistory.at(-1).action, 'rename')
assert.equal(lifecycleStore.getState().templateHistory.at(-1).actor, '王五')
assert.equal(lifecycleStore.getState().templateVersions.find(version => version.id === draft.id).activities[1].activityName, '修改点收集启动时间')
assert.deepEqual(lifecycleStore.getState().publishTemplateRevision(draft.id, '张三', allFalsePermission), { ok: false, errors: ['无权发布模板修订'] })
assert.deepEqual(lifecycleStore.getState().publishTemplateRevision(draft.id, '张三', adminPermission), { ok: true, errors: [] })
assert.equal(lifecycleStore.getState().templateHistory.at(-1).action, 'publish')
assert.equal(lifecycleStore.getState().createTemplateRevision('李白', adminPermission), true)
draft = lifecycleStore.getState().templateVersions.find(version => version.status === '修订中')
const historyLengthBeforeCancel = lifecycleStore.getState().templateHistory.length
assert.equal(lifecycleStore.getState().cancelTemplateRevision(draft.id, '赵六', adminPermission), true)
assert.equal(lifecycleStore.getState().templateVersions.some(version => version.id === draft.id), false)
assert.equal(lifecycleStore.getState().templateHistory.length, historyLengthBeforeCancel + 1)
assert.equal(lifecycleStore.getState().templateHistory.at(-1).action, 'cancel-revision')
assert.equal(lifecycleStore.getState().templateHistory.at(-1).actor, '赵六')
assert.equal(mrStore.partializeMrVersionPlanState(lifecycleStore.getState()).templateHistory.at(-1).action, 'cancel-revision')
assert.equal(new Set(lifecycleStore.getState().templateHistory.map(item => item.id)).size, lifecycleStore.getState().templateHistory.length)

const readableHistoryStore = freshStore()
assert.equal(readableHistoryStore.getState().createTemplateRevision('张三', adminPermission), true)
const readableDraft = readableHistoryStore.getState().templateVersions.find(version => version.status === '修订中')
const readableParentId = 'history-readable-parent'
assert.equal(readableHistoryStore.getState().updateTemplateActivities(readableDraft.id, [
  ...readableDraft.activities,
  { id: readableParentId, parentId: null, order: 99, activityName: '历史活动初始名', source: 'custom' },
], '张三', adminPermission), true)
let readableRows = readableHistoryStore.getState().templateVersions.find(version => version.id === readableDraft.id).activities
assert.equal(readableHistoryStore.getState().updateTemplateActivities(readableDraft.id, readableRows.map(activity => (
  activity.id === readableParentId ? { ...activity, activityName: '历史活动新名称' } : activity
)), '张三', adminPermission), true)
readableRows = readableHistoryStore.getState().templateVersions.find(version => version.id === readableDraft.id).activities
assert.equal(readableHistoryStore.getState().updateTemplateActivities(readableDraft.id, readableRows.map(activity => (
  activity.id === readableParentId ? { ...activity, order: -1 } : activity
)), '张三', adminPermission), true)
readableRows = readableHistoryStore.getState().templateVersions.find(version => version.id === readableDraft.id).activities
assert.equal(readableHistoryStore.getState().updateTemplateActivities(readableDraft.id, readableRows.filter(activity => activity.id !== readableParentId), '张三', adminPermission), true)
assert.equal(readableHistoryStore.getState().cancelTemplateRevision(readableDraft.id, '张三', adminPermission), true)
const readableHistory = readableHistoryStore.getState().templateHistory
const readableActivityLogs = readableHistory.filter(log => log.activityId === readableParentId)
assert.deepEqual(readableActivityLogs.map(log => log.action), ['add', 'rename', 'move', 'delete'])
assert.deepEqual(readableActivityLogs.map(log => templateHistoryRules.resolveMrTemplateHistoryActivityLabel(log, new Map())), [
  '历史活动初始名', '历史活动新名称', '历史活动新名称', '历史活动新名称',
])
assert.equal(readableActivityLogs.some(log => templateHistoryRules.resolveMrTemplateHistoryActivityLabel(log, new Map()).includes(readableParentId)), false)
assert.equal(templateHistoryRules.resolveMrTemplateHistoryActivityLabel(readableHistory.at(-1), new Map()), '整个修订版本')
const readablePersistedHistory = mrStore.partializeMrVersionPlanState(readableHistoryStore.getState()).templateHistory
assert.deepEqual(readablePersistedHistory.filter(log => log.activityId === readableParentId).map(log => log.activityName), [
  '历史活动初始名', '历史活动新名称', '历史活动新名称', '历史活动新名称',
])

const collidingIds = ['existing-log', 'batch-log', 'unused-log', 'other-log', 'batch-log']
const batchLogStore = mrStore.createMrVersionPlanStore({
  storage: createMemoryStorage(), now: () => NOW, createId: () => collidingIds.shift() ?? 'batch-log',
})
assert.equal(batchLogStore.getState().createTemplateRevision('张三', adminPermission), true)
const batchDraft = batchLogStore.getState().templateVersions.find(version => version.status === '修订中')
const batchActivities = batchDraft.activities.map((activity, index) => index === 1 || index === 2
  ? { ...activity, activityName: `${activity.activityName}-批量修改` }
  : { ...activity })
assert.equal(batchLogStore.getState().updateTemplateActivities(batchDraft.id, batchActivities, '王五', adminPermission), true)
assert.equal(batchLogStore.getState().templateHistory.length, 3)
assert.equal(new Set(batchLogStore.getState().templateHistory.map(item => item.id)).size, 3)

const tosStore = freshStore()
const addTosInput = { projectId: 'tos-project-16.3', tosVersion: '16.3.0.140', actor: '李白', now: NOW }
const addTosInputBefore = structuredClone(addTosInput)
assert.equal(tosStore.getState().addTosVersionInstance(addTosInput, allFalsePermission), false)
assert.equal(tosStore.getState().addTosVersionInstance(addTosInput, tosManagerPermission), true)
assert.deepEqual(addTosInput, addTosInputBefore)
assert.equal(tosStore.getState().addTosVersionInstance(addTosInput, tosManagerPermission), false)
const storedTos = tosStore.getState().tosInstancesByProjectId['tos-project-16.3'][0]
const storedTosChild = storedTos.activities.find(activity => activity.parentId !== null)
const storedTosParent = storedTos.activities.find(activity => activity.parentId === null)
assert.equal(tosStore.getState().updateTosDate('tos-project-16.3', '16.3.0.140', storedTosChild.id, '2026-06-22', '李白', tosManagerPermission), true)
assert.equal(tosStore.getState().updateTosDate('tos-project-16.3', '16.3.0.140', storedTosParent.id, '2026-06-22', '李白', tosManagerPermission), false)
assert.equal(tosStore.getState().updateTosDate('tos-project-16.3', '16.3.0.140', storedTosChild.id, '2026-02-30', '李白', tosManagerPermission), false)
assert.equal(tosStore.getState().updateTosDate('other-tos-project', '16.3.0.140', storedTosChild.id, '2026-06-22', '李白', tosManagerPermission), false)
const adminTosStore = freshStore()
assert.equal(adminTosStore.getState().addTosVersionInstance({ ...addTosInput, projectId: 'admin-tos-project' }, adminPermission), true)

const machinePlanFixture = {
  'machine-c09::16.3.0.140': { ...validPlan, dates: { transfer: '2026-07-02' } },
  'other-machine::16.3.0.140': { ...validPlan, projectId: 'other-machine', dates: { transfer: '2026-07-03' } },
}
const machineStore = freshStore({
  machinePlansByKey: machinePlanFixture,
  tosInstancesByProjectId: { 'tos-project-16.3': [tos140, tos145, tos150] },
})
assert.deepEqual(Object.keys(machineStore.getState().machinePlansByKey), ['machine-c09::16.3.0.140', 'other-machine::16.3.0.140'])
assert.equal(machineStore.getState().updateMachineDate('other-machine::16.3.0.140', 'transfer', '2026-07-04', '张三', machinePermission), false)
assert.equal(machineStore.getState().updateMachineDate('machine-c09::16.3.0.140', 'transfer', '2026-02-30', '张三', machinePermission), false)
assert.equal(machineStore.getState().updateMachineDate('machine-c09::16.3.0.140', 'transfer', '2026-07-04', '张三', machinePermission), true)
assert.equal(machineStore.getState().updateMachineTransferType('machine-c09::16.3.0.140', '9', '张三', machinePermission), false)
assert.equal(machineStore.getState().updateMachineTransferType('machine-c09::16.3.0.140', 'N/A', '张三', machinePermission), true)
assert.deepEqual(machineStore.getState().machinePlansByKey['machine-c09::16.3.0.140'].dates, {})
assert.equal(machineStore.getState().updateMachineDate('machine-c09::16.3.0.140', 'transfer', '2026-07-04', '张三', machinePermission), false)
assert.equal(machineStore.getState().updateMachineDate('other-machine::16.3.0.140', 'unknown-activity', '2026-07-04', '张三', otherMachinePermission), false)
assert.equal(machineStore.getState().updateMachineTransferType('other-machine::16.3.0.140', '2', '张三', machinePermission), false)
assert.equal(machineStore.getState().updateMachineTransferType('machine-c09::16.3.0.140', '2', '张三', machinePermission), true)
assert.equal(machineStore.getState().updateMachineDate('machine-c09::16.3.0.140', 'transfer', '2026-07-02', '张三', machinePermission), true)

assert.equal(machineStore.getState().updateMarketDate({
  projectId: 'machine-c09', tosVersion: '16.3.0.140', market: 'OP', mainMarket: 'OP', activityId: 'transfer', value: '2026-07-01', mainValue: '2026-07-02',
}, '张三', adminPermission), false)
assert.equal(machineStore.getState().updateMarketDate({
  projectId: 'machine-c09', tosVersion: '16.3.0.140', market: 'TR', mainMarket: 'OP', activityId: 'lock', value: '2026-07-01', mainValue: '2099-01-01',
}, '张三', marketPermission), false)
let emptyOverrideNotifications = 0
const unsubscribeEmptyOverride = machineStore.subscribe(() => { emptyOverrideNotifications += 1 })
assert.equal(machineStore.getState().updateMarketDate({
  projectId: 'machine-c09', tosVersion: '16.3.0.140', market: 'RU', mainMarket: 'OP', activityId: 'transfer', value: '', mainValue: '2099-01-01',
}, '张三', marketPermission), false)
unsubscribeEmptyOverride()
assert.equal(emptyOverrideNotifications, 0)
assert.equal(machineStore.getState().updateMarketDate({
  projectId: 'machine-c09', tosVersion: '16.3.0.140', market: 'TR', mainMarket: 'OP', activityId: 'transfer', value: '2026-07-03', mainValue: '2099-01-01',
}, '张三', marketPermission), true)
assert.equal(machineStore.getState().marketOverridesByKey['machine-c09::16.3.0.140::TR'].dates.transfer, '2026-07-03')
assert.equal(machineStore.getState().updateMachineDate('machine-c09::16.3.0.140', 'transfer', '2026-07-01', '张三', machinePermission), true)
assert.equal(machineStore.getState().marketOverridesByKey['machine-c09::16.3.0.140::TR'].dates.transfer, '2026-07-03')
assert.deepEqual(dateRules.validateMachineMarketDate({
  value: machineStore.getState().marketOverridesByKey['machine-c09::16.3.0.140::TR'].dates.transfer,
  mainValue: machineStore.getState().machinePlansByKey['machine-c09::16.3.0.140'].dates.transfer,
  activityId: 'transfer', activityName: '版本转测时间',
}), ['非主市场时间不得晚于主市场对应时间（2026-07-01）'])
assert.equal(machineStore.getState().updateMarketDate({
  projectId: 'machine-c09', tosVersion: '16.3.0.140', market: 'TR', mainMarket: 'OP', activityId: 'transfer', value: 'bad', mainValue: '2026-07-02',
}, '张三', marketPermission), false)
assert.equal(machineStore.getState().updateMarketDate({
  projectId: 'machine-c09', tosVersion: '16.3.0.140', market: 'TR', mainMarket: 'OP', activityId: 'transfer', value: '', mainValue: '',
}, '张三', marketPermission), true)
assert.equal(machineStore.getState().marketOverridesByKey['machine-c09::16.3.0.140::TR'], undefined)

const atomicStore = freshStore({
  machinePlansByKey: {
    'machine-c09::16.3.0.140': validPlan,
    'stale::16.3.0.140': stalePlan,
  },
  marketOverridesByKey: {
    'machine-c09::16.3.0.140::TR': { projectId: 'machine-c09', tosVersion: '16.3.0.140', market: 'TR', mainMarket: 'OP', dates: { transfer: '2026-07-01' } },
    'stale::16.3.0.140::TR': { projectId: 'stale', tosVersion: '16.3.0.140', market: 'TR', mainMarket: 'OP', dates: { transfer: '2026-01-01' } },
  },
  tosInstancesByProjectId: { 'tos-project-16.3': [tos140, tos145, tos150] },
})
const atomicResult = atomicStore.getState().reconcileMachinePlans(reconcileInput)
assert.deepEqual(Object.keys(atomicResult.persistedPlans), ['machine-c09::16.3.0.140', 'machine-c09::16.3.0.145', 'machine-c09::16.3.0.150'])
assert.equal(atomicStore.getState().marketOverridesByKey['stale::16.3.0.140::TR'], undefined)
atomicResult.persistedPlans['machine-c09::16.3.0.140'].dates.transfer = '2026-01-01'
assert.equal(atomicStore.getState().machinePlansByKey['machine-c09::16.3.0.140'].dates.transfer, '2026-07-02')
let reconcileNotifications = 0
const unsubscribeReconcile = atomicStore.subscribe(() => { reconcileNotifications += 1 })
atomicStore.getState().reconcileMachinePlans(reconcileInput)
unsubscribeReconcile()
assert.equal(reconcileNotifications, 0)
const stopAtomicInput = { ...stopRecord, id: 'stop-store', stopDate: '2026-07-12' }
const emptyStopStore = freshStore({ tosInstancesByProjectId: { 'tos-project-16.3': [tos140, tos145, tos150] } })
assert.equal(emptyStopStore.getState().stopRelease(stopAtomicInput, machinePermission), false)
assert.equal(atomicStore.getState().stopRelease(stopAtomicInput, otherMachinePermission), false)
assert.equal(atomicStore.getState().stopRelease({ ...stopAtomicInput, id: 'stop-other', projectId: 'other-machine', projectName: 'OTHER' }, otherMachinePermission), false)
assert.equal(atomicStore.getState().stopRelease(stopAtomicInput, machinePermission), true)
assert.equal(atomicStore.getState().stopRelease(stopAtomicInput, machinePermission), false)
assert.equal(atomicStore.getState().stopReleaseRecords.at(-1).id, 'stop-store')
assert.ok(atomicStore.getState().machinePlansByKey['machine-c09::16.3.0.145'])
assert.equal(atomicStore.getState().machinePlansByKey['machine-c09::16.3.0.150'], undefined)
assert.ok(atomicStore.getState().marketOverridesByKey['machine-c09::16.3.0.140::TR'])

const emptyCollectionStore = freshStore({
  machinePlansByKey: { 'machine-c09::16.3.0.150': { ...validPlan, tosVersion: '16.3.0.150' } },
  tosInstancesByProjectId: { 'tos-project-16.3': [emptyCollectionInstance] },
})
assert.equal(emptyCollectionStore.getState().stopRelease(stopAtomicInput, machinePermission), true)
assert.ok(emptyCollectionStore.getState().machinePlansByKey['machine-c09::16.3.0.150'])
assert.equal(emptyCollectionStore.getState().updateTosDate(
  'tos-project-16.3', '16.3.0.150', 'collect', '2026-08-01', '李白', tosManagerPermission,
), true)
emptyCollectionStore.getState().reconcileMachinePlans(reconcileInput)
assert.equal(emptyCollectionStore.getState().machinePlansByKey['machine-c09::16.3.0.150'], undefined)

assert.equal(machineStore.getState().setViewMode(' machine::machine-c09 ', 'horizontal'), undefined)
assert.equal(machineStore.getState().viewModeByScope['machine::machine-c09'], 'horizontal')
machineStore.getState().setViewMode('', 'vertical')
machineStore.getState().setViewMode('machine::machine-c09', 'bad')
assert.deepEqual(machineStore.getState().viewModeByScope, { 'machine::machine-c09': 'horizontal' })

const corruptPersisted = {
  templateVersions: [
    { ...initialVersions[0], activities: [parent, childA, { ...childB, id: 'orphan', parentId: 'missing' }] },
    { ...initialVersions[0], id: 'duplicate-v1' },
    { ...initialVersions[0], id: 'unsafe-version', versionNo: 'V9007199254740992' },
    { ...initialVersions[0], id: 'draft-v2', versionNo: 'V2', status: '修订中', publishedAt: undefined, activities: [parent, childA] },
    { ...initialVersions[0], id: 'draft-v3', versionNo: 'V3', status: '修订中', publishedAt: undefined, activities: [parent, childA] },
  ],
  currentTemplateVersionId: 'discarded-current',
  templateHistory: [
    { id: 'history-1', versionId: 'draft-v3', action: 'rename', actor: '王五', occurredAt: NOW },
    { id: 'history-1', versionId: 'draft-v3', action: 'move', actor: '赵六', occurredAt: LATER },
    { id: ' ', versionId: 'x', action: 'rename', actor: '', occurredAt: '' },
  ],
  tosInstancesByProjectId: {
    ' ': [tos140],
    'tos-project-16.3': [{ ...tos140, dates: { collect: '2026-02-30', lock: '2026-06-24', 'stage-change': '2026-01-01' } }],
  },
  machinePlansByKey: {
    ' ': validPlan,
    'bad-type::16.3.0.140': { ...validPlan, projectId: 'bad-type', transferType: '9' },
    'machine-c09::16.3.0.140': { ...validPlan, dates: { transfer: '2026-02-30', collect: '2026-06-22', unknown: '2026-06-23' } },
    'machine-c09::16.3.0.999': { ...validPlan, tosVersion: '16.3.0.999' },
    'wrong-tos::16.3.0.140': { ...validPlan, projectId: 'wrong-tos', tosProjectId: 'missing-tos-project' },
  },
  marketOverridesByKey: {
    'machine-c09::16.3.0.140::OP': { projectId: 'machine-c09', tosVersion: '16.3.0.140', market: 'OP', mainMarket: 'OP', dates: { collect: '2026-06-22' } },
    'machine-c09::16.3.0.140::TR': { projectId: 'machine-c09', tosVersion: '16.3.0.140', market: 'TR', mainMarket: 'OP', dates: { collect: '2026-06-23', lock: 'bad', unknown: '2026-06-24' } },
    'machine-c09::16.3.0.140::RU': { projectId: 'machine-c09', tosVersion: '16.3.0.140', market: 'RU', mainMarket: 'OP', dates: { lock: 'bad', unknown: '2026-06-24' } },
    'missing::16.3.0.140::TR': { projectId: 'missing', tosVersion: '16.3.0.140', market: 'TR', mainMarket: 'OP', dates: { collect: '2026-06-23' } },
  },
  stopReleaseRecords: [
    { ...stopRecord },
    { ...stopRecord, id: 'duplicate-project', stopDate: '2026-07-20' },
    { ...stopRecord, projectId: 'other-project', projectName: 'OTHER' },
    { ...stopRecord, id: 'bad-stop', stopDate: '2026-02-30' },
  ],
  viewModeByScope: { ok: 'vertical', bad: 'gantt', ' ': 'horizontal' },
}
const corruptBefore = structuredClone(corruptPersisted)
const migrated = mrStore.migrateMrVersionPlanState(corruptPersisted, 0)
assert.deepEqual(corruptPersisted, corruptBefore)
assert.deepEqual(migrated.templateVersions.map(version => version.id), [initialVersions[0].id, 'draft-v3'])
assert.equal(migrated.currentTemplateVersionId, 'draft-v3')
assert.deepEqual(migrated.templateVersions[0].activities.map(activity => activity.id), [parent.id, childA.id])
assert.deepEqual(migrated.templateHistory, [{ id: 'history-1', versionId: 'draft-v3', action: 'rename', actor: '王五', occurredAt: NOW }])
assert.deepEqual(Object.keys(migrated.tosInstancesByProjectId), ['tos-project-16.3'])
assert.deepEqual(migrated.tosInstancesByProjectId['tos-project-16.3'][0].dates, { lock: '2026-06-24' })
assert.deepEqual(Object.keys(migrated.machinePlansByKey), ['machine-c09::16.3.0.140'])
assert.deepEqual(migrated.machinePlansByKey['machine-c09::16.3.0.140'].dates, { collect: '2026-06-22' })
assert.deepEqual(Object.keys(migrated.marketOverridesByKey), ['machine-c09::16.3.0.140::TR'])
assert.deepEqual(migrated.marketOverridesByKey['machine-c09::16.3.0.140::TR'].dates, { collect: '2026-06-23' })
assert.deepEqual(migrated.stopReleaseRecords, [stopRecord])
assert.deepEqual(migrated.viewModeByScope, { ok: 'vertical' })
const recoveredPublished = mrStore.migrateMrVersionPlanState({
  templateVersions: [{ ...initialVersions[0], id: 'draft-only', versionNo: 'V2', status: '修订中' }],
  currentTemplateVersionId: 'draft-only',
}, 0)
assert.equal(recoveredPublished.templateVersions.length, 1)
assert.equal(recoveredPublished.templateVersions[0].status, '已发布')
const staleDraftMigration = mrStore.migrateMrVersionPlanState({
  templateVersions: [
    { ...initialVersions[0], id: 'published-v3', versionNo: 'V3' },
    { ...initialVersions[0], id: 'stale-draft-v2', versionNo: 'V2', status: '修订中', publishedAt: undefined },
  ],
  currentTemplateVersionId: 'stale-draft-v2',
}, 0)
assert.deepEqual(staleDraftMigration.templateVersions.map(version => version.id), ['published-v3'])
assert.equal(staleDraftMigration.currentTemplateVersionId, 'published-v3')

const historicalSelectionVersions = [
  { ...initialVersions[0], id: 'published-v1', versionNo: 'V1' },
  { ...initialVersions[0], id: 'published-v2', versionNo: 'V2' },
  { ...initialVersions[0], id: 'draft-v3-selection', versionNo: 'V3', status: '修订中', publishedAt: undefined },
]
const historicalSelectionMigration = mrStore.migrateMrVersionPlanState({
  templateVersions: historicalSelectionVersions,
  currentTemplateVersionId: 'published-v1',
}, 0)
assert.equal(historicalSelectionMigration.currentTemplateVersionId, 'published-v1')
assert.equal(mrStore.partializeMrVersionPlanState({
  ...freshStore({ templateVersions: historicalSelectionVersions, currentTemplateVersionId: 'published-v1' }).getState(),
  currentTemplateVersionId: 'published-v1',
}).currentTemplateVersionId, 'published-v1')
const invalidHistoricalSelection = mrStore.migrateMrVersionPlanState({
  templateVersions: historicalSelectionVersions,
  currentTemplateVersionId: 'unknown-version',
}, 0)
assert.equal(invalidHistoricalSelection.currentTemplateVersionId, 'draft-v3-selection')

const persistedOnly = mrStore.partializeMrVersionPlanState(machineStore.getState())
assert.deepEqual(Object.keys(persistedOnly).sort(), [
  'currentTemplateVersionId', 'machinePlansByKey', 'marketOverridesByKey', 'stopReleaseRecords',
  'templateHistory', 'templateVersions', 'tosInstancesByProjectId', 'viewModeByScope',
].sort())
assert.equal(Object.values(persistedOnly).some(value => typeof value === 'function'), false)
hydrationStorage.setItem(mrStore.MR_VERSION_PLAN_STORAGE_KEY, JSON.stringify({
  state: { ...mrStore.migrateMrVersionPlanState({}, 0), viewModeByScope: { hydrated: 'horizontal', bad: 'gantt' } },
  version: mrStore.MR_VERSION_PLAN_STORE_VERSION,
}))
const readsBeforeStoreCreation = hydrationStorage.counts.get
const hydrationStore = mrStore.createMrVersionPlanStore({ storage: hydrationStorage, now: () => NOW })
assert.equal(hydrationStorage.counts.get, readsBeforeStoreCreation)
assert.equal(hydrationStore.getState().viewModeByScope.hydrated, undefined)
assert.notEqual(hydrationStorage.getItem('pms-level3-plan-store'), null)
await mrStore.rehydrateMrVersionPlanStore(hydrationStore)
assert.equal(hydrationStore.getState().viewModeByScope.hydrated, 'horizontal')
assert.equal(hydrationStore.getState().viewModeByScope.bad, undefined)
assert.equal(hydrationStorage.getItem('pms-level3-plan-store'), null)
assert.equal(hydrationStore.persist.getOptions().version, 1)
const selectedVersionHydrationStorage = createMemoryStorage()
selectedVersionHydrationStorage.setItem(mrStore.MR_VERSION_PLAN_STORAGE_KEY, JSON.stringify({
  state: mrStore.migrateMrVersionPlanState({ templateVersions: historicalSelectionVersions, currentTemplateVersionId: 'published-v1' }, 0),
  version: mrStore.MR_VERSION_PLAN_STORE_VERSION,
}))
const selectedVersionHydrationStore = mrStore.createMrVersionPlanStore({ storage: selectedVersionHydrationStorage, now: () => NOW })
await mrStore.rehydrateMrVersionPlanStore(selectedVersionHydrationStore)
assert.equal(selectedVersionHydrationStore.getState().currentTemplateVersionId, 'published-v1')
const throwingStorage = {
  getItem: () => { throw new Error('storage read failed') },
  setItem: () => { throw new Error('storage write failed') },
  removeItem: () => { throw new Error('storage remove failed') },
}
globalThis.window = { localStorage: throwingStorage }
const throwingHydrationStore = mrStore.createMrVersionPlanStore({ storage: throwingStorage, now: () => NOW })
let failingStorageMutationResult
assert.doesNotThrow(() => { failingStorageMutationResult = throwingHydrationStore.getState().createTemplateRevision('管理员', adminPermission) })
assert.equal(failingStorageMutationResult, true)
assert.equal(throwingHydrationStore.getState().templateVersions.some(version => version.status === '修订中'), true)
assert.doesNotThrow(() => throwingHydrationStore.getState().setViewMode('failure-safe', 'horizontal'))
assert.equal(throwingHydrationStore.getState().viewModeByScope['failure-safe'], 'horizontal')
await assert.doesNotReject(() => mrStore.rehydrateMrVersionPlanStore(throwingHydrationStore))
const rejectingAsyncStorage = {
  getItem: () => Promise.reject(new Error('async storage read failed')),
  setItem: () => Promise.reject(new Error('async storage write failed')),
  removeItem: () => Promise.reject(new Error('async storage remove failed')),
}
globalThis.window = { localStorage: rejectingAsyncStorage }
const asyncFailureStore = mrStore.createMrVersionPlanStore({ storage: rejectingAsyncStorage, now: () => NOW })
assert.equal(asyncFailureStore.getState().createTemplateRevision('管理员', adminPermission), true)
assert.equal(asyncFailureStore.getState().templateVersions.some(version => version.status === '修订中'), true)
await assert.doesNotReject(() => mrStore.rehydrateMrVersionPlanStore(asyncFailureStore))

// Legacy standalone level-three plan retirement: old source, runtime symbols,
// package commands and persisted plan-store fields must all be gone while the
// MR store remains the sole guarded owner of legacy-key cleanup.
const retiredLevel3Paths = [
  'src/types/level3Plan.ts',
  'src/types/level3Template.ts',
  'src/lib/level3PlanRules.ts',
  'src/lib/level3TemplateRules.ts',
  'src/stores/level3Plan.ts',
  'src/components/plans/Level3PlanModule.tsx',
  'src/components/plans/Level3TemplateTable.tsx',
  'scripts/verify-level3-plan.mjs',
  'scripts/verify-level3-template-config.mjs',
  'screenshots/verify-level3-template-config-browser.mjs',
]
retiredLevel3Paths.forEach(relativePath => {
  assert.equal(fs.existsSync(path.join(root, relativePath)), false, `legacy level3 path retired: ${relativePath}`)
})
const collectRuntimeSources = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const absolutePath = path.join(directory, entry.name)
  if (entry.isDirectory()) return collectRuntimeSources(absolutePath)
  return /\.(?:ts|tsx)$/.test(entry.name) ? [absolutePath] : []
})
const runtimeSource = collectRuntimeSources(path.join(root, 'src'))
  .map(file => fs.readFileSync(file, 'utf8'))
  .join('\n')
for (const retiredSymbol of ['useLevel3PlanStore', 'Level3PlanModule', 'Level3TemplateTable', 'level3TemplateTasksByType']) {
  assert.doesNotMatch(runtimeSource, new RegExp(`\\b${retiredSymbol}\\b`), `runtime symbol retired: ${retiredSymbol}`)
}
assert.doesNotMatch(runtimeSource, /(?:getItem|read|import)[^\n]{0,120}pms-level3-plan-store/)
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
for (const retiredScript of ['verify:level3-plan', 'verify:level3-template', 'verify:level3-template-browser', 'verify:machine-tos-version']) {
  assert.equal(packageJson.scripts?.[retiredScript], undefined, `package script retired: ${retiredScript}`)
}
assert.equal(packageJson.scripts?.['verify:machine-tos'], 'node scripts/verify-machine-tos-versions.mjs')
assert.doesNotMatch(globalsSource, /\.pms-level3-/)
for (const retiredSnapshotKey of [
  'template::整机产品项目::level3::v3',
  'project::machine::OP::level3::v1',
  'project::tos::tos-type::Full::level3::v1::snapshot',
]) assert.equal(templateCompatibility.isRetiredLevel3SnapshotKey(retiredSnapshotKey), true)
for (const retainedSnapshotKey of [
  'project::machine::level3::level1::v1',
  'project::level3::level1::v1',
  'template::整机产品项目::level1::level3',
]) assert.equal(templateCompatibility.isRetiredLevel3SnapshotKey(retainedSnapshotKey), false)
const mrStoreSource = readSource(root, 'src/stores/mrVersionPlan.ts')
assert.match(mrStoreSource, /LEGACY_LEVEL3_STORAGE_KEY\s*=\s*['"]pms-level3-plan-store['"]/)
assert.match(mrStoreSource, /rehydrateMrVersionPlanStore[\s\S]*removeItem\(LEGACY_LEVEL3_STORAGE_KEY\)/)

const legacyPlanFixture = {
  versions: [{ id: 'selected-v7', versionNo: 'V7', status: '已发布' }],
  currentVersion: 'selected-v7',
  tasks: [{ id: 'l1', taskName: '一级任务保留' }],
  configTemplateTasksByType: {
    整机产品项目: [{ id: 'template-l1', taskName: '模板保留' }],
    '技术项目::TDT项目计划': [{ id: 'tdt-stage', taskName: '技术模板保留' }],
    '技术项目::子项目计划': [{ id: 'subproject-stage', taskName: '子项目模板保留' }],
  },
  publishedSnapshots: { 'project::machine::OP::level1::v1': [{ id: 'snapshot-l1', taskName: '快照保留' }] },
  columnSettingsByView: {
    'project-level1-table': { order: ['taskName', 'id'], visible: ['taskName'], widths: { taskName: 333 } },
    'project-technical-table': { order: ['technicalName', 'id'], visible: ['technicalName', 'id'], widths: { technicalName: 275 } },
    'project-market-table': { order: ['market', 'taskName'], visible: ['market'], widths: { market: 144 } },
  },
  marketPlanData: { OP: { tasks: [{ id: 'market-l1', taskName: '市场计划保留' }], level2Tasks: [], createdLevel2Plans: [] } },
  marketVersionsByKey: { 'project::machine::OP::level1::versions': [{ id: 'market-v1', versionNo: 'V1', status: '已发布' }] },
  marketCurrentVersionByKey: { 'project::machine::OP::level1::current': 'market-v1' },
  tosTypePlanDataByProjectId: { tos: { Full: { level1Tasks: [{ id: 'tos-l1', taskName: 'tOS计划保留' }], level2Tasks: [], createdLevel2Plans: [] } } },
  tosTypeVersionsByKey: { 'project::tos::tos-type::Full::level1::versions': [{ id: 'tos-v1', versionNo: 'V1', status: '已发布' }] },
  tosTypeCurrentVersionByKey: { 'project::tos::tos-type::Full::level1::current': 'tos-v1' },
  configTemplateVersionScopes: {
    'config-template::整机产品项目::level1': { versions: [{ id: 'machine-template-v6', versionNo: 'V6', status: '修订中' }], currentVersion: 'machine-template-v6' },
    legacyLevel3: { versions: [{ id: 'old', versionNo: 'V1', status: '已发布' }], currentVersion: 'old' },
  },
  configTemplateCompareScopes: {
    'config-template::整机产品项目::level1': { versionA: 'machine-template-v5', versionB: 'machine-template-v6' },
    legacyLevel3: { versionA: 'old', versionB: 'old' },
  },
  level3TemplateTasksByType: { 整机产品项目: [{ id: 'old-level3' }] },
  level3ScopesByKey: { old: { activities: [] } },
  currentLevel3Scope: 'old',
}
legacyPlanFixture.publishedSnapshots['template::整机产品项目::level3::v3'] = [{ id: 'retired-template-level3' }]
legacyPlanFixture.publishedSnapshots['project::machine::OP::level3::v1'] = [{ id: 'retired-market-level3' }]
legacyPlanFixture.publishedSnapshots['project::tos::tos-type::Full::level3::v1::snapshot'] = [{ id: 'retired-tos-type-level3' }]
legacyPlanFixture.publishedSnapshots['project::machine::level3::level1::v1'] = [{ id: 'literal-level3-market' }]
legacyPlanFixture.publishedSnapshots['project::level3::level1::v1'] = [{ id: 'literal-level3-project' }]
const planStore = loadTypeScriptModule(root, 'src/stores/plan.ts')
assert.equal(planStore.PLAN_STORE_VERSION, 10)
const migratedPlanFixture = planStore.migratePlanStoreState(structuredClone(legacyPlanFixture), 9)
assert.equal('level3TemplateTasksByType' in migratedPlanFixture, false)
assert.equal('level3ScopesByKey' in migratedPlanFixture, false)
assert.equal('currentLevel3Scope' in migratedPlanFixture, false)
assert.deepEqual(migratedPlanFixture.versions, legacyPlanFixture.versions)
assert.equal(migratedPlanFixture.currentVersion, legacyPlanFixture.currentVersion)
assert.deepEqual(migratedPlanFixture.tasks, legacyPlanFixture.tasks)
assert.deepEqual(migratedPlanFixture.configTemplateTasksByType.整机产品项目, legacyPlanFixture.configTemplateTasksByType.整机产品项目)
assert.deepEqual(migratedPlanFixture.configTemplateTasksByType['技术项目::TDT项目计划'], legacyPlanFixture.configTemplateTasksByType['技术项目::TDT项目计划'])
assert.deepEqual(migratedPlanFixture.configTemplateTasksByType['技术项目::子项目计划'], legacyPlanFixture.configTemplateTasksByType['技术项目::子项目计划'])
assert.deepEqual(migratedPlanFixture.publishedSnapshots['project::machine::OP::level1::v1'], legacyPlanFixture.publishedSnapshots['project::machine::OP::level1::v1'])
assert.equal(migratedPlanFixture.publishedSnapshots['template::整机产品项目::level3::v3'], undefined)
assert.equal(migratedPlanFixture.publishedSnapshots['project::machine::OP::level3::v1'], undefined)
assert.equal(migratedPlanFixture.publishedSnapshots['project::tos::tos-type::Full::level3::v1::snapshot'], undefined)
assert.deepEqual(migratedPlanFixture.publishedSnapshots['project::machine::level3::level1::v1'], legacyPlanFixture.publishedSnapshots['project::machine::level3::level1::v1'])
assert.deepEqual(migratedPlanFixture.publishedSnapshots['project::level3::level1::v1'], legacyPlanFixture.publishedSnapshots['project::level3::level1::v1'])
assert.deepEqual(migratedPlanFixture.columnSettingsByView['project-level1-table'], legacyPlanFixture.columnSettingsByView['project-level1-table'])
assert.deepEqual(migratedPlanFixture.columnSettingsByView['project-technical-table'], legacyPlanFixture.columnSettingsByView['project-technical-table'])
assert.deepEqual(migratedPlanFixture.columnSettingsByView['project-market-table'], legacyPlanFixture.columnSettingsByView['project-market-table'])
assert.ok(migratedPlanFixture.columnSettingsByView['config-level1-table'])
assert.ok(migratedPlanFixture.columnSettingsByView['config-level2-table'])
assert.deepEqual(migratedPlanFixture.marketPlanData.OP, legacyPlanFixture.marketPlanData.OP)
assert.deepEqual(migratedPlanFixture.marketVersionsByKey, legacyPlanFixture.marketVersionsByKey)
assert.deepEqual(migratedPlanFixture.marketCurrentVersionByKey, legacyPlanFixture.marketCurrentVersionByKey)
assert.deepEqual(migratedPlanFixture.tosTypePlanDataByProjectId, legacyPlanFixture.tosTypePlanDataByProjectId)
assert.deepEqual(migratedPlanFixture.tosTypeVersionsByKey, legacyPlanFixture.tosTypeVersionsByKey)
assert.deepEqual(migratedPlanFixture.tosTypeCurrentVersionByKey, legacyPlanFixture.tosTypeCurrentVersionByKey)
assert.deepEqual(migratedPlanFixture.configTemplateVersionScopes['config-template::整机产品项目::level1'], legacyPlanFixture.configTemplateVersionScopes['config-template::整机产品项目::level1'])
assert.deepEqual(migratedPlanFixture.configTemplateCompareScopes['config-template::整机产品项目::level1'], legacyPlanFixture.configTemplateCompareScopes['config-template::整机产品项目::level1'])
assert.equal('legacyLevel3' in migratedPlanFixture.configTemplateVersionScopes, false)
assert.equal('legacyLevel3' in migratedPlanFixture.configTemplateCompareScopes, false)
