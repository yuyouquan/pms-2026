#!/usr/bin/env node
import assert from 'node:assert/strict'
import {
  actionReadsObjectFields,
  getStringUnionTypeMembers,
  hasNestedCallExpression,
  hasPropertyDefinition,
  loadTypeScriptModule,
  projectRoot,
  readSource,
  requireSource,
} from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
requireSource(root, 'src/stores/ui.ts', /type\s+MainModule[\s\S]*?['"]workbench['"][\s\S]*?['"]projectList['"]/, 'missing workbench and project-list modules')
requireSource(root, 'src/stores/ui.ts', /projectSpaceOrigin\b/, 'missing project-space origin state')
const uiSource = readSource(root, 'src/stores/ui.ts')
assert.deepEqual(
  getStringUnionTypeMembers(uiSource, 'MainModule'),
  ['workbench', 'projectList', 'roadmap', 'hrPipeline', 'config', 'projectSpace'],
  'MainModule must be the typed six-module navigation contract',
)
requireSource(root, 'src/stores/ui.ts', /activeModule:\s*['"]workbench['"]/, 'workbench must be the default module')
assert.match(uiSource, /export type WorkbenchTab = ['"]todo['"]/, 'legacy workbench origin supports only the task page')
requireSource(root, 'src/stores/ui.ts', /workbenchTab:\s*['"]todo['"]/, 'todo must be the default workbench tab')
requireSource(root, 'src/stores/ui.ts', /projectSpaceOrigin:\s*null/, 'project-space origin must default to null')
assert.equal(hasPropertyDefinition(uiSource, 'enterProjectSpace'), true, 'UI store defines enterProjectSpace as an action property')
assert.equal(hasPropertyDefinition(uiSource, 'returnFromProjectSpace'), true, 'UI store defines returnFromProjectSpace as an action property')
assert.equal(actionReadsObjectFields(uiSource, 'returnFromProjectSpace', 'projectSpaceOrigin', ['module', 'workbenchTab']), true, 'origin return reads module and workbench tab by access or destructuring')

requireSource(root, 'src/app/page.tsx', /ProjectListContainer\b/, 'missing ProjectListContainer route')
requireSource(root, 'src/app/page.tsx', /['"]workbench['"]/, 'missing workbench route branch')
requireSource(root, 'src/app/page.tsx', /['"]projectList['"]/, 'missing project-list route branch')
requireSource(root, 'src/app/page.tsx', /enterProjectSpace\(\{\s*module:\s*['"]roadmap['"]\s*\}\)/, 'roadmap project entry must record its origin')

const workbenchSource = readSource(root, 'src/containers/WorkbenchContainer.tsx')
assert.doesNotMatch(workbenchSource, /WorkTracker|工作跟踪|pms-workbench-switch|<Segmented\b/, 'workbench renders only personal tasks')
assert.doesNotMatch(workbenchSource, /setWorkbenchTab/, 'workbench no longer switches internal modules')
assert.match(workbenchSource, /<TodoCenter[\s\S]*?todos=\{todos\}[\s\S]*?onOpenTodo=\{openTodo\}/, 'task table is the only workbench body')
assert.doesNotMatch(workbenchSource, /项目列表视图|todoCollapsed|MenuFoldOutlined|MenuUnfoldOutlined|ProjectSummaryTable/, 'workbench must not contain project-list view controls or a collapsible todo rail')
assert.match(workbenchSource, /module:\s*['"]workbench['"],\s*workbenchTab:\s*['"]todo['"]/, 'todo project entry must record its workbench tab')
assert.match(workbenchSource, /route\.view === ['"]detail['"]/, 'completed transfer tasks explicitly use the detail route')

const projectListSource = readSource(root, 'src/containers/ProjectListContainer.tsx')
assert.match(projectListSource, /ProjectSummaryTable/, 'project-list implementation must own the summary table')
assert.match(projectListSource, /AddProjectModal/, 'project-list implementation must own project creation')
assert.match(projectListSource, /enterProjectSpace\(\{\s*module:\s*['"]projectList['"]\s*\}\)/, 'project-list entries must record their origin')
assert.match(projectListSource, /useActivateProject\(\)/, 'project list must reuse the shared project activation hook')
assert.doesNotMatch(projectListSource, /const\s+activateProject\s*=\s*\(/, 'project list must not duplicate project activation')
assert.match(workbenchSource, /useActivateProject\(\)/, 'workbench must reuse the shared project activation hook')
assert.doesNotMatch(workbenchSource, /const\s+activateProject\s*=\s*\(/, 'workbench must not duplicate project activation')
const todoSource = readSource(root, 'src/components/workspace/TodoCenter.tsx')
assert.match(todoSource, /error\?:\s*string/, 'todo center exposes a contextual error state')
assert.match(todoSource, /onRetry\?:\s*\(\)\s*=>\s*void/, 'todo center error state offers recovery')
assert.match(todoSource, /<Skeleton\b/, 'todo loading state reserves the final table footprint')
assert.match(todoSource, /role="alert"/, 'todo errors are announced accessibly')
assert.match(projectListSource, /className="pms-project-list"/, 'project list owns a scoped polish shell')
assert.match(projectListSource, /className="pms-project-list-toolbar pms-wide-table-toolbar"/, 'wide project lists keep their toolbar visible')
assert.match(projectListSource, /className="pms-project-list-view-switch"/, 'labeled card/list segmented control uses the dedicated project-list style')
assert.match(projectListSource, /aria-label="卡片视图"/, 'card view control has an accessible name')
assert.match(projectListSource, /aria-label="列表视图"/, 'list view control has an accessible name')
const globalStyles = readSource(root, 'src/styles/globals.css')
assert.match(globalStyles, /\.pms-wide-table-toolbar\s*\{[^}]*position:\s*sticky;[^}]*top:/s, 'wide table toolbar is sticky')
assert.match(globalStyles, /\.pms-project-list\s*\{/, 'project-list styling is scoped')
assert.match(globalStyles, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.pms-project-list/s, 'project-list motion respects reduced-motion')
const compatibilitySource = readSource(root, 'src/containers/WorkspaceContainer.tsx')
assert.match(compatibilitySource, /export\s*\{\s*default\s*\}\s*from\s*['"]@\/containers\/ProjectListContainer['"]/, 'WorkspaceContainer must be a compatibility re-export')
assert.doesNotMatch(compatibilitySource, /^import\s/m, 'WorkspaceContainer compatibility file must not retain implementation imports')

const shellSource = readSource(root, 'src/containers/AppShell.tsx')
assert.match(shellSource, /useActivateProject\(\)/, 'project-space header must reuse the shared project activation hook')
const activationSource = readSource(root, 'src/hooks/useActivateProject.ts')
assert.match(activationSource, /setTransferView\(null\)/, 'shared activation must reset transfer view')
assert.match(activationSource, /setSelectedProject\(project\)/, 'shared activation must select the project')
assert.match(activationSource, /setSelectedMarketTab\(selectedMarket\)/, 'shared activation must select the requested or default market')
assert.match(activationSource, /buildTosTypeRows[\s\S]*?getMainTosType[\s\S]*?setSelectedTosTypeTab/, 'shared activation must select the tOS main type')
const expectedHeaderOrder = /key:\s*['"]workbench['"],\s*label:\s*['"]工作台['"][\s\S]*?key:\s*['"]projectList['"],\s*label:\s*['"]项目列表['"][\s\S]*?key:\s*['"]roadmap['"],\s*label:\s*['"]tOS路标['"][\s\S]*?key:\s*['"]hrPipeline['"],\s*label:\s*['"]人力资源管道['"][\s\S]*?key:\s*['"]config['"],\s*label:\s*['"]配置中心['"]/
assert.match(
  shellSource,
  expectedHeaderOrder,
  'main header order must be workbench, project list, roadmap, HR pipeline, config',
)
assert.equal(hasNestedCallExpression(shellSource, 'navigateWithEditGuard', 'returnFromProjectSpace'), true, 'ProjectSpaceHeader calls origin return inside the edit-guard callback')

const { useUiStore } = loadTypeScriptModule(root, 'src/stores/ui.ts')
assert.equal(useUiStore.getState().activeModule, 'workbench')
assert.equal(useUiStore.getState().workbenchTab, 'todo')
let guardedNavigationCount = 0
useUiStore.setState({
  isEditMode: true,
  showLeaveConfirm: false,
  pendingNavigation: null,
})
useUiStore.getState().navigateWithEditGuard(() => { guardedNavigationCount += 1 }, true)
assert.equal(guardedNavigationCount, 1, 'current auto-saved draft navigation must run immediately')
assert.equal(useUiStore.getState().showLeaveConfirm, false, 'current auto-saved draft must not show leave confirmation')
useUiStore.getState().navigateWithEditGuard(() => { guardedNavigationCount += 1 }, false)
assert.equal(guardedNavigationCount, 1, 'unsubmitted navigation must wait for confirmation')
assert.equal(useUiStore.getState().showLeaveConfirm, true, 'unsubmitted navigation must show leave confirmation')
assert.equal(typeof useUiStore.getState().pendingNavigation, 'function', 'unsubmitted navigation must retain its pending action')
useUiStore.getState().handleConfirmLeave()
assert.equal(guardedNavigationCount, 2, 'confirmed guarded navigation executes its pending action exactly once')
assert.equal(useUiStore.getState().showLeaveConfirm, false, 'confirmed guarded navigation closes leave confirmation')
assert.equal(useUiStore.getState().pendingNavigation, null, 'confirmed guarded navigation clears its pending action')
useUiStore.setState({ isEditMode: true })
useUiStore.getState().navigateWithEditGuard(() => { guardedNavigationCount += 1 }, false)
useUiStore.getState().handleCancelLeave()
assert.equal(guardedNavigationCount, 2, 'cancelled guarded navigation must not execute its pending action')
useUiStore.getState().enterProjectSpace({ module: 'workbench', workbenchTab: 'todo' })
useUiStore.getState().returnFromProjectSpace()
assert.equal(useUiStore.getState().activeModule, 'workbench')
assert.equal(useUiStore.getState().workbenchTab, 'todo')
useUiStore.getState().enterProjectSpace({ module: 'projectList' })
useUiStore.getState().returnFromProjectSpace()
assert.equal(useUiStore.getState().activeModule, 'projectList')
assert.equal(useUiStore.getState().projectSpaceOrigin, null)
useUiStore.setState({ activeModule: 'projectSpace', projectSpaceOrigin: null, workbenchTab: 'todo' })
useUiStore.getState().returnFromProjectSpace()
assert.equal(useUiStore.getState().activeModule, 'workbench')
assert.equal(useUiStore.getState().workbenchTab, 'todo')
console.log('workbench split contract passed')
