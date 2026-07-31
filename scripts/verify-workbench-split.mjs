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
assert.match(workbenchSource, /<Tabs\b/, 'workbench must use Ant Tabs')
assert.match(workbenchSource, /key:\s*['"]todo['"][\s\S]*?key:\s*['"]workTracker['"]/, 'workbench tab order must be todo then work tracker')
assert.match(workbenchSource, /待办中心[\s\S]*?工作跟踪/, 'workbench tab labels must be todo center then work tracker')
assert.doesNotMatch(workbenchSource, /项目列表视图|todoCollapsed|MenuFoldOutlined|MenuUnfoldOutlined|ProjectSummaryTable/, 'workbench must not contain project-list view controls or a collapsible todo rail')
assert.match(workbenchSource, /module:\s*['"]workbench['"],\s*workbenchTab:\s*['"]todo['"]/, 'todo project entry must record its workbench tab')
assert.match(workbenchSource, /module:\s*['"]workbench['"],\s*workbenchTab:\s*['"]workTracker['"]/, 'work-tracker project entry must record its workbench tab')

const projectListSource = readSource(root, 'src/containers/ProjectListContainer.tsx')
assert.match(projectListSource, /ProjectSummaryTable/, 'project-list implementation must own the summary table')
assert.match(projectListSource, /AddProjectModal/, 'project-list implementation must own project creation')
assert.match(projectListSource, /enterProjectSpace\(\{\s*module:\s*['"]projectList['"]\s*\}\)/, 'project-list entries must record their origin')
const compatibilitySource = readSource(root, 'src/containers/WorkspaceContainer.tsx')
assert.match(compatibilitySource, /export\s*\{\s*default\s*\}\s*from\s*['"]@\/containers\/ProjectListContainer['"]/, 'WorkspaceContainer must be a compatibility re-export')
assert.doesNotMatch(compatibilitySource, /^import\s/m, 'WorkspaceContainer compatibility file must not retain implementation imports')

const shellSource = readSource(root, 'src/containers/AppShell.tsx')
const expectedHeaderOrder = /key:\s*['"]workbench['"],\s*label:\s*['"]工作台['"][\s\S]*?key:\s*['"]projectList['"],\s*label:\s*['"]项目列表['"][\s\S]*?key:\s*['"]roadmap['"],\s*label:\s*['"]项目视图['"][\s\S]*?key:\s*['"]hrPipeline['"],\s*label:\s*['"]人力资源管道['"][\s\S]*?key:\s*['"]config['"],\s*label:\s*['"]配置中心['"]/
assert.match(
  shellSource,
  expectedHeaderOrder,
  'main header order must be workbench, project list, roadmap, HR pipeline, config',
)
assert.equal(hasNestedCallExpression(shellSource, 'navigateWithEditGuard', 'returnFromProjectSpace'), true, 'ProjectSpaceHeader calls origin return inside the edit-guard callback')

const { useUiStore } = loadTypeScriptModule(root, 'src/stores/ui.ts')
assert.equal(useUiStore.getState().activeModule, 'workbench')
assert.equal(useUiStore.getState().workbenchTab, 'todo')
useUiStore.getState().enterProjectSpace({ module: 'workbench', workbenchTab: 'workTracker' })
useUiStore.getState().returnFromProjectSpace()
assert.equal(useUiStore.getState().activeModule, 'workbench')
assert.equal(useUiStore.getState().workbenchTab, 'workTracker')
useUiStore.getState().enterProjectSpace({ module: 'projectList' })
useUiStore.getState().returnFromProjectSpace()
assert.equal(useUiStore.getState().activeModule, 'projectList')
assert.equal(useUiStore.getState().projectSpaceOrigin, null)
useUiStore.setState({ activeModule: 'projectSpace', projectSpaceOrigin: null, workbenchTab: 'workTracker' })
useUiStore.getState().returnFromProjectSpace()
assert.equal(useUiStore.getState().activeModule, 'workbench')
assert.equal(useUiStore.getState().workbenchTab, 'todo')
console.log('workbench split contract passed')
