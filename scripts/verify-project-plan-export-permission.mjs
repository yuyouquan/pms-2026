import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const source = fs.readFileSync('src/components/plans/VersionTrainPlan.tsx', 'utf8')
const ast = ts.createSourceFile('component.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
let handler
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'handleExport') handler = node.initializer.getText(ast)
  ts.forEachChild(node, visit)
}
visit(ast)
assert(handler)
let downloads = 0, errors = 0, granted = true
const make = enabled => new Function('canExport', 'canExportNow', 'filteredData', 'message', 'URL', 'document', `return (${handler})`)(
  enabled, () => granted, [], { success() {}, warning() { errors++ } }, { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
  { createElement: () => ({ click() { downloads++ } }) },
)
make(false)()
assert.equal(downloads, 0, 'Read-only member must not export the version-train plan')
const stale = make(true)
granted = false
stale()
assert.equal(downloads, 0, 'Deferred export must revalidate current project/user/permission')
granted = true
make(true)()
assert.equal(downloads, 1, 'Authorized export still downloads')
assert.equal(errors, 2)
console.log('PASS version-train export permission and execution revalidation')
