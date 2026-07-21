import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const transpile = (filename) => ts.transpileModule(
  fs.readFileSync(filename, 'utf8'),
  {
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  },
).outputText

const evaluate = (filename, requireModule, globals = {}) => {
  const module = { exports: {} }
  vm.runInNewContext(transpile(filename), {
    module,
    exports: module.exports,
    require: requireModule,
    console,
    ...globals,
  }, { filename })
  return module.exports
}

const schemaModule = {
  LEGACY_PROJECT_INFO_SCHEMA_VERSION: 0,
  PROJECT_INFO_SCHEMA_VERSION: 1,
}
const preferences = evaluate(
  'src/lib/projectFieldPreferences.ts',
  (id) => {
    if (id === '@/constants/projectInfoSchema') return schemaModule
    throw new Error(`Unexpected module: ${id}`)
  },
  { window: undefined },
)

const fields = [
  { key: 'required', defaultVisible: true, hideable: false },
  { key: 'oldDefault', defaultVisible: true, hideable: true },
  { key: 'newDefault', defaultVisible: true, hideable: true, introducedInSchemaVersion: 1 },
]

assert.deepEqual(
  Array.from(preferences.reconcileVisibleFieldKeys(fields, {
    visibleFieldKeys: ['required'],
    schemaVersion: 0,
  })),
  ['required', 'newDefault'],
  'upgrade must preserve an explicitly hidden old default and add a new default',
)
assert.deepEqual(
  Array.from(preferences.reconcileVisibleFieldKeys(fields, {
    visibleFieldKeys: ['required'],
    schemaVersion: 1,
  })),
  ['required'],
  'current schema must not re-add a default the user explicitly hid',
)

const planFields = [
  { key: 'planStartDate', label: '计划开始时间', defaultVisible: true, hideable: true },
  { key: 'isCarrierCustomized', label: '是否运营商定制', defaultVisible: true, hideable: false },
  { key: 'isSimLocked', label: '是否锁卡', defaultVisible: true, hideable: true },
]
assert.deepEqual(
  Array.from(preferences.reconcileVisibleFieldKeys(planFields, {
    visibleFieldKeys: [],
    schemaVersion: 1,
  })),
  ['isCarrierCustomized'],
  'plan preferences must keep the non-hideable carrier field visible',
)

const hookStateUpdates = []
let hookStateIndex = 0
const hookReact = {
  useCallback: (callback) => callback,
  useEffect: (effect) => effect(),
  useMemo: (factory) => factory(),
  useRef: (value) => ({ current: value }),
  useState: (value) => {
    const index = hookStateIndex++
    hookStateUpdates[index] = []
    return [value, (next) => hookStateUpdates[index].push(Array.from(next))]
  },
}
const visibilityHook = evaluate(
  'src/hooks/useProjectFieldVisibility.ts',
  (id) => {
    if (id === 'react') return hookReact
    if (id === '@/constants/projectInfoSchema') return schemaModule
    if (id === '@/lib/projectFieldPreferences') return preferences
    throw new Error(`Unexpected module: ${id}`)
  },
)
let saveErrorCount = 0
const hookResult = visibilityHook.useProjectFieldVisibility({
  userId: 'u',
  projectId: 'p',
  groupKey: 'basic',
  fields,
  repository: {
    get: () => ({
      userId: 'u',
      projectId: 'p',
      groupKey: 'basic',
      visibleFieldKeys: ['required'],
      schemaVersion: 1,
      updatedAt: '',
    }),
    save: () => {
      throw new Error('quota')
    },
  },
  onSaveError: () => {
    saveErrorCount += 1
  },
})
await assert.rejects(
  hookResult.setVisibleFieldKeys(['required', 'oldDefault']),
  /Project field preference save failed/,
)
assert.deepEqual(
  hookStateUpdates[0],
  [['required'], ['required', 'oldDefault'], ['required']],
  'failed save must roll optimistic state back to the previously loaded keys',
)
assert.equal(saveErrorCount, 1, 'failed save must report one user-facing error')

const pickerStateUpdates = []
let pickerStateIndex = 0
const pickerReact = {
  createElement: (type, props, ...children) => ({
    type,
    props: { ...props, children: children.length <= 1 ? children[0] : children },
  }),
  useEffect: () => undefined,
  useRef: (value) => ({ current: value }),
  useState: (value) => {
    const index = pickerStateIndex++
    pickerStateUpdates[index] = []
    return [value, (next) => pickerStateUpdates[index].push(next)]
  },
}
const pickerModule = evaluate(
  'src/components/project-info/FieldVisibilityPicker.tsx',
  (id) => {
    if (id === 'react') return pickerReact
    if (id === 'antd') {
      return {
        Button: 'Button',
        Checkbox: 'Checkbox',
        Drawer: 'Drawer',
        Space: 'Space',
        Tooltip: 'Tooltip',
      }
    }
    if (id === '@ant-design/icons') return { SettingOutlined: 'SettingOutlined' }
    throw new Error(`Unexpected module: ${id}`)
  },
  { React: pickerReact },
)
const pickerTree = pickerModule.default({
  groupLabel: '基础信息',
  fields,
  visibleFieldKeys: ['required'],
  onChange: async () => {
    throw new Error('quota')
  },
})
const drawer = Array.isArray(pickerTree.props.children)
  ? pickerTree.props.children.find(child => child?.type === 'Drawer')
  : pickerTree.props.children
const footerChildren = drawer.props.footer.props.children
const actions = footerChildren[1].props.children
const confirmButton = actions.find(child => child.props.type === 'primary')
await confirmButton.props.onClick()
assert.deepEqual(
  pickerStateUpdates[0],
  [],
  'Drawer open state must remain unchanged when persistence fails',
)
assert.deepEqual(
  pickerStateUpdates[2],
  [true, false],
  'Drawer confirm loading state must settle after failure',
)

console.log('project field preferences regression checks passed (7 assertions)')
