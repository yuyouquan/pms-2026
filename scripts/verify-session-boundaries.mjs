import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { loadTypeScriptModule } from './lib/source-contract.mjs'

const root = process.cwd()
const { useUiStore } = loadTypeScriptModule(root, 'src/stores/ui.ts')

// Execute the real navigation callbacks, including the Zustand setter contract.
for (const file of ['ProjectSpaceContainer', 'ConfigContainer']) {
  const source = fs.readFileSync(`src/containers/${file}.tsx`, 'utf8')
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let callback
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'navigateWithEditGuard') callback = node.initializer
    ts.forEachChild(node, visit)
  }
  visit(ast)
  assert.ok(callback)
  const javascript = ts.transpile(`const navigate = ${callback.getText(ast)}; navigate`, { target: ts.ScriptTarget.ES2022 })
  let navigated = false
  let discarded = false
  const ui = useUiStore.getState()
  const context = {
    isEditMode: true, isCurrentDraft: false, basicInfoEditMode: false,
    setPendingNavigation: ui.setPendingNavigation,
    setShowLeaveConfirm: ui.setShowLeaveConfirm,
    setShowLeaveConfirmFn: ui.setShowLeaveConfirm,
    setBasicInfoEditMode: value => { discarded = !value },
    setEditingProjectFields: () => {},
  }
  const navigate = vm.runInNewContext(javascript, context)
  navigate(() => { navigated = true })
  assert.equal(navigated, false, `${file}: do not navigate before confirmation`)
  assert.equal(useUiStore.getState().showLeaveConfirm, true)
  useUiStore.getState().handleConfirmLeave()
  assert.equal(navigated, true, `${file}: confirm actually invokes destination`)
  if (file === 'ProjectSpaceContainer') {
    context.isEditMode = false
    context.isCurrentDraft = true
    context.basicInfoEditMode = true
    navigated = false
    navigate(() => { navigated = true })
    assert.equal(navigated, false, 'unsaved basic information is guarded even with a plan draft selected')
    useUiStore.getState().handleCancelLeave()
    assert.equal(navigated, false, 'cancel retains the current page')
    navigate(() => { navigated = true })
    useUiStore.getState().handleConfirmLeave()
    assert.equal(navigated, true)
    assert.equal(discarded, true, 'confirmed navigation clears the discarded basic draft')
  }
}
console.log('Session navigation boundaries passed')
