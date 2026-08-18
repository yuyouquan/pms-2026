import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadTypeScriptModule } from './lib/source-contract.mjs'

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
const filterModule = loadTypeScriptModule(root, 'src/lib/projectListFilters.ts')

assert.match(projectStore, /projectListView:\s*'list'\s*\|\s*'card'\s*\|\s*'calendar'/, 'project list view supports list, card, and calendar')
assert.match(projectList, /value:\s*'list'[\s\S]*value:\s*'calendar'[\s\S]*value:\s*'card'/, 'view switch order is list, calendar, card')
for (const token of ['二级分类', '项目状态', '切换为全部项目', '切换为我的项目']) {
  assert.match(projectList, new RegExp(token), `project list renders ${token}`)
}
for (const functionName of ['filterProjectsForList', 'countProjectsByCategory', 'matchesAboutMine']) {
  assert.match(filters, new RegExp(`export function ${functionName}`), `project list filters export ${functionName}`)
}
const roles = { tech: [{ members: ['李四'] }] }
assert.equal(filterModule.canEnterProjectSpace('tech', '张三', roles, true), true, 'global admins can enter projects without a project role')
assert.equal(filterModule.canEnterProjectSpace('tech', '张三', roles, false), false, 'ordinary users without a project role remain blocked')
assert.equal(filterModule.canEnterProjectSpace('tech', '李四', roles, false), true, 'users with a project role can enter')
assert.equal(filterModule.canEnterProjectSpace('tech', '', roles, true), false, 'empty project identities cannot enter even as global admins')
assert.equal(filterModule.canEnterProjectSpace('tech', '   ', roles, true), false, 'whitespace project identities cannot enter even as global admins')
assert.equal(filterModule.matchesAboutMine('tech', '张三', roles), false, 'about-mine remains membership-only for global admins')
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
assert.match(projectList, /const canEnterProject = \(projectId: string\) => canEnterProjectSpace\([\s\S]{0,160}isAdminUser/, 'project-space access allows global admins in addition to configured project roles')
assert.match(projectList, /const isAdminUser = useMemo\(\(\) => \{[\s\S]*?const adminGroup = globalRoles\.find\(r => r\.name === '管理组'\)[\s\S]*?adminGroup \? adminGroup\.members\.includes\(currentLoginUser\)/, 'global admin status is derived from the 管理组 membership')
assert.match(projectList, /const showProjectAccessDenied = \(\) => message\.warning/, 'access denial provides user feedback')
assert.match(projectList, /<ProjectListCalendar[\s\S]*?onOpenRow=\{enterSummaryRow\}/, 'calendar rows use the guarded project-space entry callback')
assert.match(projectList, /matrixVariant=\{technicalActiveType === 'tdt' \? 'technical-tdt' : 'technical-subproject'\}[\s\S]*?onViewRow=\{enterSummaryRow\}/, 'technical table rows use the guarded project-space entry callback')
assert.match(projectList, /onViewProject=\{\(projectId\) => \{/, 'standard table entries bind the project-space callback')
assert.match(projectList, /onViewProject=\{\(projectId\) => \{[\s\S]*?if \(!canEnterProject\(projectId\)\)/, 'standard table callback explicitly gates project-space access')
assert.match(projectList, /if \(!canEnterProject\(targetProjectId\)\)[\s\S]{0,160}showProjectAccessDenied\(\)[\s\S]{0,80}return/, 'technical row callback denies missing project access')
assert.match(projectList, /canOpen=\{canEnterProject\(project\.id\)\}/, 'standard cards receive the same project-role access gate')
assert.match(workspaceModule, /canOpen\?: boolean/, 'project cards expose an optional access gate')
assert.match(workspaceModule, /if \(!canOpen\)[\s\S]{0,120}onOpenDenied\?\.\(\)/, 'project cards do not navigate when access is denied')
assert.match(projectCalendar, /const WEEKDAYS = \['周一', '周二', '周三', '周四', '周五', '周六', '周日'\]/, 'calendar starts on Monday')
assert.match(projectCalendar, /day\.date\(\) === 1\s*\? day\.format\('M月D日'\)/, 'the first day of every month shows month and day')
assert.match(projectCalendar, /pms-project-calendar-today/, 'today has a dedicated visual marker')
assert.match(projectCalendar, /events\.slice\(0, 3\)/, 'calendar shows at most three events per day')
assert.match(projectCalendar, /还有 \{events\.length - 3\} 条记录/, 'calendar reports remaining events using the approved copy')

console.log('project list refinement contract passed')
