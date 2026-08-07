import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')

const projectStore = read('src/stores/project.ts')
const projectList = read('src/containers/ProjectListContainer.tsx')
const projectCalendar = read('src/components/project-list/ProjectListCalendar.tsx')
const workspaceModule = read('src/components/workspace/WorkspaceModule.tsx')
const activeFilterPath = path.join(root, 'src/components/project-list/ActiveFilterConditions.tsx')
const activeFilterSource = fs.existsSync(activeFilterPath) ? fs.readFileSync(activeFilterPath, 'utf8') : ''
const filtersPath = path.join(root, 'src/lib/projectListFilters.ts')
const filters = fs.existsSync(filtersPath) ? fs.readFileSync(filtersPath, 'utf8') : ''

assert.match(projectStore, /projectListView:\s*'list'\s*\|\s*'card'\s*\|\s*'calendar'/, 'project list view supports list, card, and calendar')
assert.match(projectList, /value:\s*'list'[\s\S]*value:\s*'calendar'[\s\S]*value:\s*'card'/, 'view switch order is list, calendar, card')
for (const token of ['二级分类', '项目状态', '切换为全部项目', '切换为我的项目']) {
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
assert.doesNotMatch(projectList, /projectMemberMap/, 'unchecked about-mine is not constrained by the legacy member map')
assert.match(projectList, /const visibleProjects = projects/, 'unchecked about-mine can display every project')
assert.doesNotMatch(projectList, /<Checkbox/, 'about-mine is an icon toggle instead of a checkbox')
assert.match(projectList, /projectListToolbarTrailingActions[\s\S]*aboutMineAction[\s\S]*projectListFullscreenAction/, 'mine/all toggle sits immediately before fullscreen')
assert.match(projectList, /hasActiveFilterConditions && \([\s\S]*pms-project-list-filter-summary-row/, 'empty active-filter rows are not rendered')
assert.match(projectList, /const canEnterProject = \(projectId: string\) => matchesAboutMine/, 'project-space access is based on configured project roles')
assert.match(projectList, /const showProjectAccessDenied = \(\) => message\.warning/, 'access denial provides user feedback')
assert.match(projectList, /if \(!canEnterProject\(targetProjectId\)\)[\s\S]{0,160}showProjectAccessDenied\(\)[\s\S]{0,80}return/, 'table and calendar entry is blocked when access is missing')
assert.match(projectList, /canOpen=\{canEnterProject\(project\.id\)\}/, 'standard cards receive the same project-role access gate')
assert.match(workspaceModule, /canOpen\?: boolean/, 'project cards expose an optional access gate')
assert.match(workspaceModule, /if \(!canOpen\)[\s\S]{0,120}onOpenDenied\?\.\(\)/, 'project cards do not navigate when access is denied')
assert.match(projectCalendar, /const WEEKDAYS = \['周一', '周二', '周三', '周四', '周五', '周六', '周日'\]/, 'calendar starts on Monday')
assert.match(projectCalendar, /day\.date\(\) === 1\s*\? day\.format\('M月D日'\)/, 'the first day of every month shows month and day')
assert.match(projectCalendar, /pms-project-calendar-today/, 'today has a dedicated visual marker')
assert.match(projectCalendar, /events\.slice\(0, 3\)/, 'calendar shows at most three events per day')
assert.match(projectCalendar, /还有 \{events\.length - 3\} 条记录/, 'calendar reports remaining events using the approved copy')

console.log('project list refinement contract passed')
