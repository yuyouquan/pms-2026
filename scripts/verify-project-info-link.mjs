import assert from 'node:assert/strict'
import path from 'node:path'
import { createTypeScriptModuleLoader } from './lib/typescript-module-loader.mjs'

const load = createTypeScriptModuleLoader()
const { buildProjectInfoLink, parseProjectInfoLink } = load(path.resolve('src/lib/projectInfoLink.ts'))

for (const id of ['1', 'mock-budget-machine-unbound', '项目 A&B/#?']) {
  const url = new URL(buildProjectInfoLink(id), 'https://pms.example.com')
  assert.deepEqual(parseProjectInfoLink(url.search), { projectId: id })
  assert.equal(url.pathname, '/')
}
assert.equal(parseProjectInfoLink('?unrelated=1'), null)
for (const query of [
  '?projectId=', '?action=edit-basic-info', '?projectId=1',
  '?projectId=1&action=delete', '?projectId=1&projectId=2&action=edit-basic-info',
  '?projectId=1&action=edit-basic-info&action=delete',
]) assert.ok(parseProjectInfoLink(query)?.error, query)
assert.deepEqual(parseProjectInfoLink('?projectId=1&action=edit-basic-info&from=feishu'), { projectId: '1' })
console.log('PASS notification deep links preserve identity and reject malformed or ambiguous actions')
