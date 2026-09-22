import assert from 'node:assert/strict'
import path from 'node:path'
import { createRequire } from 'node:module'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
const get = createTypeScriptModuleLoader()
const { PROJECT_REGISTRY_MANAGERS } = get(path.resolve('src/lib/projectRegistryPermissions.ts'))
const Input = get(path.resolve('src/components/project-info/ProjectInfoFieldInput.tsx')).default
for (const inputType of ['person', 'people']) {
  let saved
  const field = Input({ field: { key: 'technicalLead', label: '技术项目负责人', inputType }, value: inputType === 'people' ? ['游进'] : '游进', onChange: value => { saved = value } })
  const choices = field.props.options.map(option => option.value)
  assert.equal(new Set(choices).size, choices.length)
  for (const name of PROJECT_REGISTRY_MANAGERS) assert.ok(choices.includes(name), `${inputType}: ${name} remains selectable when completing a created project`)
  const replacement = inputType === 'people' ? ['邓伟俊', '陈佩玲'] : '邓伟俊'
  field.props.onChange(replacement)
  assert.deepEqual(saved, replacement)
}
console.log('PASS actual basic-info person and team selectors retain creation identities and save replacements')

// Exercise the separate technical-project form rather than assuming it shares the generic control.
const require = createRequire(import.meta.url)
const React = require('react')
const antd = require('antd')
const { renderToStaticMarkup } = require('react-dom/server')
const technicalOptions = []
const cache = new Map([[require.resolve('antd'), { exports: { ...antd, Select: props => {
  if (props.placeholder === '请选择技术项目负责人') technicalOptions.push(props.options)
  return React.createElement('span')
} } }]])
cache.set(require.resolve('react'), { exports: React })
cache.set(require.resolve('react/jsx-runtime'), { exports: require('react/jsx-runtime') })
const TechnicalFields = createTypeScriptModuleLoader(cache)(path.resolve('src/components/technical-project/TechnicalProjectCreateFields.tsx')).default
function TechnicalForm() {
  const [form] = antd.Form.useForm()
  return React.createElement(antd.Form, { form }, React.createElement(TechnicalFields, {
    form, existingProjects: [], validateRequiredOnCreate: false,
    fields: [{ key: 'technicalLead', label: '技术项目负责人', inputType: 'people', group: 'team' }],
    groups: [{ key: 'team', label: '团队人员' }], activeGroups: ['team'], onActiveGroupsChange() {},
  }))
}
renderToStaticMarkup(React.createElement(TechnicalForm))
assert.equal(technicalOptions.length, 1)
for (const name of PROJECT_REGISTRY_MANAGERS) assert.ok(technicalOptions[0].some(option => option.value === name), `technical form retains ${name}`)
console.log('PASS actual technical-project team form retains the same selectable identities')
