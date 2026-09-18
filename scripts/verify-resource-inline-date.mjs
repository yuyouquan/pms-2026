import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'
const get = createTypeScriptModuleLoader()
const { createInlineFieldSession, inlineDateInputHandlers } = get(path.resolve('src/components/project-resources/inlineFieldSession.ts'))
assert.equal(typeof inlineDateInputHandlers, 'function', 'date text must be captured before DatePicker final onChange')
const session = createInlineFieldSession(() => {})
let saved = '2026-12-31'
const persist = value => {
  if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(value).toISOString().slice(0, 10) !== value)) throw new Error('请选择有效日期')
  saved = value
}
const handlers = inlineDateInputHandlers(session.change)
session.begin(saved)
handlers.onInputCapture({ target: { tagName: 'INPUT', value: '2027-01-31' } })
assert.equal(session.leave(false, persist), true)
assert.equal(saved, '2027-01-31', 'outside save receives actual typed text without waiting for DatePicker onChange')
session.begin(saved)
handlers.onInputCapture({ target: { tagName: 'INPUT', value: '2026-02-31' } })
assert.equal(session.leave(false, persist), false)
assert.equal(session.state.editing, true)
assert.equal(session.state.value, '2026-02-31')
assert.equal(saved, '2027-01-31')
assert.match(session.state.error, /日期/)
session.cancel()
session.begin(saved)
handlers.onInputCapture({ target: { tagName: 'INPUT', value: '' } })
assert.equal(session.save(persist), true)
assert.equal(saved, null, 'clearing date remains intentionally blank')
console.log('PASS typed date outside save, invalid raw date retention, cancellation and blank date')
