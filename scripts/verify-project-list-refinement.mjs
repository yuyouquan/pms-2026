import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')

const projectStore = read('src/stores/project.ts')
const projectList = read('src/containers/ProjectListContainer.tsx')
const filtersPath = path.join(root, 'src/lib/projectListFilters.ts')
const filters = fs.existsSync(filtersPath) ? fs.readFileSync(filtersPath, 'utf8') : ''

assert.match(projectStore, /projectListView:\s*'list'\s*\|\s*'card'\s*\|\s*'calendar'/, 'project list view supports list, card, and calendar')
assert.match(projectList, /value:\s*'list'[\s\S]*value:\s*'card'[\s\S]*value:\s*'calendar'/, 'view switch order is list, card, calendar')
for (const token of ['二级分类', '项目状态', '关于我的']) {
  assert.match(projectList, new RegExp(token), `project list renders ${token}`)
}
for (const functionName of ['filterProjectsForList', 'countProjectsByCategory', 'matchesAboutMine']) {
  assert.match(filters, new RegExp(`export function ${functionName}`), `project list filters export ${functionName}`)
}
assert.match(projectList, /maxTagCount=\{1\}/, 'quick multi-selects keep one visible tag')
assert.match(projectList, /ProjectListCalendar/, 'project list renders the shared filtered calendar')

console.log('project list refinement contract passed')
