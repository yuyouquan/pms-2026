import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')

const projectStore = read('src/stores/project.ts')
const projectList = read('src/containers/ProjectListContainer.tsx')
const projectCalendar = read('src/components/project-list/ProjectListCalendar.tsx')
const activeFilterPath = path.join(root, 'src/components/project-list/ActiveFilterConditions.tsx')
const activeFilterSource = fs.existsSync(activeFilterPath) ? fs.readFileSync(activeFilterPath, 'utf8') : ''
const filtersPath = path.join(root, 'src/lib/projectListFilters.ts')
const filters = fs.existsSync(filtersPath) ? fs.readFileSync(filtersPath, 'utf8') : ''

assert.match(projectStore, /projectListView:\s*'list'\s*\|\s*'card'\s*\|\s*'calendar'/, 'project list view supports list, card, and calendar')
assert.match(projectList, /value:\s*'list'[\s\S]*value:\s*'calendar'[\s\S]*value:\s*'card'/, 'view switch order is list, calendar, card')
for (const token of ['二级分类', '项目状态', '关于我的']) {
  assert.match(projectList, new RegExp(token), `project list renders ${token}`)
}
for (const functionName of ['filterProjectsForList', 'countProjectsByCategory', 'matchesAboutMine']) {
  assert.match(filters, new RegExp(`export function ${functionName}`), `project list filters export ${functionName}`)
}
assert.doesNotMatch(projectList, /aria-label="项目字段快捷筛选"/, 'legacy quick-filter controls are removed')
assert.match(projectList, /projectListFilterSummaryHost/, 'project list exposes a host for active filter conditions')
assert.match(activeFilterSource, /aria-expanded=\{expanded\}/, 'active conditions expose their expanded state')
assert.match(activeFilterSource, /\+\{hiddenCount\}/, 'collapsed conditions expose the hidden count')
assert.match(activeFilterSource, /onRemove\(condition\.id\)/, 'active conditions can be removed immediately')
assert.match(projectList, /ProjectListCalendar/, 'project list renders the shared filtered calendar')
assert.match(projectCalendar, /const WEEKDAYS = \['周一', '周二', '周三', '周四', '周五', '周六', '周日'\]/, 'calendar starts on Monday')
assert.match(projectCalendar, /day\.date\(\) === 1\s*\? day\.format\('M月D日'\)/, 'the first day of every month shows month and day')
assert.match(projectCalendar, /pms-project-calendar-today/, 'today has a dedicated visual marker')
assert.match(projectCalendar, /events\.slice\(0, 3\)/, 'calendar shows at most three events per day')
assert.match(projectCalendar, /还有 \{events\.length - 3\} 条记录/, 'calendar reports remaining events using the approved copy')

console.log('project list refinement contract passed')
