import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'

// Exercise the real container with isolated stores and lightweight child surfaces.
// Browser checks cover subscriptions, mounted tab cleanup, and effect-driven resets.
const require = createRequire(import.meta.url)
const source = fs.readFileSync('src/containers/ProjectManagementContainer.tsx', 'utf8')
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText
const state = {
  currentLoginUser: '管理员',
  globalRoles: [{ name: '管理组', members: ['管理员', '第二位管理员'] }, { name: '项目管理员', members: ['普通用户'] }],
  projectManagementTab: 'configuration',
}
const store = selector => selector({ ...state, setProjectManagementTab: value => { state.projectManagementTab = value } })
let offeredTabs = []
const mocks = {
  '@/lib/projectRegistryPermissions': createTypeScriptModuleLoader()(path.resolve('src/lib/projectRegistryPermissions.ts')),
  antd: {
    Card: ({ children }) => React.createElement('div', null, children),
    Segmented: ({ options }) => React.createElement('div', { role: 'radiogroup' }, options.map(option => React.createElement(React.Fragment, { key: option.value }, option.label))),
    Tabs: ({ activeKey, items, renderTabBar }) => {
      offeredTabs = items.map(item => item.key)
      return React.createElement('div', null, renderTabBar(), items.find(item => item.key === activeKey)?.children)
    },
  },
  '@/stores/ui': { useUiStore: store },
  '@/stores/project': { useProjectStore: store },
  '@/stores/permission': { usePermissionStore: store },
  '@/components/project-management/ProjectConfiguration': { default: () => React.createElement('div', null, '配置内容') },
  '@/containers/ProjectListContainer': { default: () => React.createElement('div', null, '项目列表内容') },
}
const module = { exports: {} }
vm.runInThisContext(`(function(require, module, exports) { ${output}\n })`)(
  name => mocks[name] ?? require(name), module, module.exports,
)
const render = () => renderToStaticMarkup(React.createElement(module.exports.default))

const admin = render()
assert.match(admin, /radiogroup/)
assert.match(admin, /项目视图/)
assert.match(admin, /项目配置/)
assert.match(admin, /配置内容/)
assert.deepEqual(offeredTabs, ['view', 'configuration'])

for (const user of ['普通用户', '无角色用户', '']) {
  state.currentLoginUser = user
  for (const tab of ['view', 'configuration']) {
    state.projectManagementTab = tab
    const page = render()
    assert.doesNotMatch(page, /radiogroup|项目配置|配置内容/, `${user || '空用户'} must not see configuration or the view switch`)
    assert.match(page, /项目列表内容/, 'non-admins must render the project view even with a stale configuration tab')
    assert.deepEqual(offeredTabs, ['view'], 'configuration must be removed from mounted tabs, not only hidden')
  }
}

state.currentLoginUser = '第二位管理员'
state.projectManagementTab = 'configuration'
assert.match(render(), /配置内容/, 'access follows group membership, not a hardcoded login')
state.globalRoles = state.globalRoles.map(role => role.name === '管理组' ? { ...role, members: [] } : role)
assert.doesNotMatch(render(), /radiogroup|配置内容/, 'revoking management membership removes access')
for (const name of ['乔永峰','徐如秀（大圆）','孙仁海','游进','邓伟俊','陈佩玲','王健（Jim）']) {
  state.currentLoginUser = name
  assert.match(render(), /配置内容/, `${name} can enter configuration without gaining global administration`)
}
console.log('project management access: admin, non-admin, stale tab, alternate admin, revoked membership, and scoped managers passed')
