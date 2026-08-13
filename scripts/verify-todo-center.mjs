#!/usr/bin/env node
import assert from 'node:assert/strict'
import {
  loadTypeScriptModule,
  projectRoot,
  readSource,
  requireSource,
} from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const todos = loadTypeScriptModule(root, 'src/lib/todoAggregation.ts')
for (const name of [
  'aggregateWorkbenchTodos',
  'filterWorkbenchTodos',
  'summarizeWorkbenchTodos',
  'mapTransferOwnerToPmsUser',
  'buildPlanTodoCandidates',
  'buildTransferTodoCandidates',
  'filterTodoCandidatesByAccess',
  'resolveVisiblePlanVersion',
  'resolvePlanTodoNavigation',
  'resolveWorkbenchDefaultSelection',
]) assert.equal(typeof todos[name], 'function', `missing ${name}`)
const input = {
  currentUser: '张三',
  today: '2026-07-31',
  planTodos: [
    { id: 'plan-overdue', assignee: '张三', dueDate: '2026-07-30', generatedAt: '2026-07-30 09:30:00', title: '逾期任务', projectId: 'p1', projectName: '项目 A', planLevel: 'level1', planKey: 'level1', versionId: 'v4', market: 'OP', marketKey: 'project::p1::OP::level1::versions' },
    { id: 'plan-today', assignee: '张三', dueDate: '2026-07-31', title: '今日任务', projectId: 'p2', projectName: '项目 B', planLevel: 'level2', planKey: 'plan2', versionId: 'v1', status: 'in_progress' },
    { id: 'plan-done', assignee: '张三', completedAt: '2026-07-30', title: '已完成任务', projectId: 'p1', projectName: '项目 A', planLevel: 'level1', planKey: 'level1', versionId: 'v4' },
    { id: 'plan-other', assignee: '李四' },
  ],
  transferApplications: [
    { id: 'transfer-mine', projectId: 'p1', projectName: '项目 A', activeOwner: '张三', generatedAt: '2026-07-29 08:10:00', completed: false, title: '转维录入', view: 'entry', checklist: [{ id: 'checklist' }] },
    { id: 'transfer-done', activeOwner: '张三', completed: true },
    { id: 'transfer-other', activeOwner: '李四', completed: false },
  ],
}
const all = todos.aggregateWorkbenchTodos(input)
assert.deepEqual(all.map(item => [item.id, item.status]), [
  ['plan-overdue', 'pending'],
  ['transfer-mine', 'pending'],
  ['plan-today', 'pending'],
  ['transfer-done', 'completed'],
  ['plan-done', 'completed'],
], 'aggregate exposes only pending and completed work for the current user')
assert.equal(all.find(item => item.id === 'plan-today')?.generatedAt, '', 'missing plan generation dates remain unrecorded')
assert.equal(all.find(item => item.id === 'transfer-mine')?.generatedAt, '2026-07-29', 'transfer generation timestamps normalize to a date key')
assert.deepEqual(
  todos.resolveWorkbenchDefaultSelection(all),
  { source: 'plan', status: 'pending' },
  'plan wins when both directories have pending work',
)
assert.deepEqual(
  todos.resolveWorkbenchDefaultSelection([{ source: 'plan', status: 'completed' }, { source: 'transfer', status: 'pending' }]),
  { source: 'transfer', status: 'pending' },
  'transfer is selected when it is the first directory with pending work',
)
assert.deepEqual(
  todos.resolveWorkbenchDefaultSelection([{ source: 'plan', status: 'completed' }]),
  { source: 'plan', status: 'all' },
  'plan/all is the fallback when neither directory has pending work',
)
assert.deepEqual(todos.filterWorkbenchTodos(all, { source: 'transfer', status: 'all' }).map(item => item.id), ['transfer-mine', 'transfer-done'], 'directory filtering includes pending and completed work')
assert.deepEqual(todos.filterWorkbenchTodos(all, { source: 'plan', status: 'pending' }).map(item => item.id), ['plan-overdue', 'plan-today'], 'status filtering collapses every unfinished plan state into pending')
assert.deepEqual(todos.summarizeWorkbenchTodos(all, '2026-07-31'), { total: 5, dueToday: 1, overdue: 1, completedThisWeek: 1 }, 'summary remains compatible with the two-state aggregate output')
assert.equal(all.find(item => item.id === 'plan-overdue')?.route.marketKey, 'project::p1::OP::level1::versions', 'market plan routes preserve their validated market scope key')
assert.deepEqual(
  todos.aggregateWorkbenchTodos({ ...input, currentUser: '   ', planTodos: [{ ...input.planTodos[0], assignee: '' }] }),
  [],
  'blank current users never receive anonymous candidates',
)

const versions = [
  { id: 'v3', versionNo: 'V3', status: '已发布' },
  { id: 'v4', versionNo: 'V4', status: '修订中' },
]
const indexedCandidates = todos.buildPlanTodoCandidates({
  projects: [
    { id: 'generic-a', name: '通用项目 A' },
    { id: 'market-a', name: '整机项目 A', markets: ['OP'] },
    { id: 'market-b', name: '整机项目 B', markets: ['TR'] },
    { id: 'tos-a', name: 'tOS 项目 A', versionTypes: ['Full'] },
  ],
  sources: [
    { projectId: 'generic-a', planLevel: 'level1', planKey: 'level1', planName: '一级计划', tasks: [{ id: 'g1', taskName: '通用任务', responsible: '张三' }], versions, currentVersionId: 'v4' },
    { projectId: 'market-a', planLevel: 'level1', planKey: 'level1', planName: '一级计划', dimension: { kind: 'market', value: 'OP', versionKey: 'project::market-a::OP::level1::versions' }, tasks: [{ id: 'm1', taskName: '市场 A 任务', responsible: '张三' }], versions, currentVersionId: 'v3' },
    { projectId: 'market-b', planLevel: 'level1', planKey: 'level1', planName: '一级计划', dimension: { kind: 'market', value: 'TR', versionKey: 'project::market-b::TR::level1::versions' }, tasks: [{ id: 'm2', taskName: '市场 B 任务', responsible: '李四' }], versions, currentVersionId: 'v4' },
    { projectId: 'tos-a', planLevel: 'level1', planKey: 'level1', planName: '一级计划', dimension: { kind: 'tos', value: 'Full', versionKey: 'project::tos-a::tos-type::Full::level1::versions' }, tasks: [{ id: 't1', taskName: 'Full 任务', responsible: '张三' }], versions, currentVersionId: 'v3' },
    { projectId: 'generic-a', planLevel: 'level2', planKey: 'plan2', planName: 'FR版本火车计划', tasks: [{ id: 'l2', taskName: '版本评审', responsible: '张三' }], versions, currentVersionId: 'v3' },
    { projectId: 'missing', planLevel: 'level1', planKey: 'level1', tasks: [{ id: 'bad', taskName: '不应生成', responsible: '张三' }], versions, currentVersionId: 'v3' },
  ],
})
assert.deepEqual(
  indexedCandidates.map(candidate => `${candidate.projectId}:${candidate.planLevel}:${candidate.market || candidate.tosType || 'generic'}:${candidate.title}`),
  [
    'generic-a:level1:generic:通用任务',
    'market-a:level1:OP:OP · 市场 A 任务',
    'market-b:level1:TR:TR · 市场 B 任务',
    'tos-a:level1:Full:Full · Full 任务',
    'generic-a:level2:generic:版本评审',
  ],
  'explicit generic, market, tOS, and L2 sources stay bound to their own projects',
)
assert.equal(indexedCandidates[1].context, 'OP · V3 (已发布)')
assert.equal(indexedCandidates[3].context, 'tOS Full · V3 (已发布)')
assert.equal(indexedCandidates[4].sourceLabel, 'FR版本火车计划')

const accessFiltered = todos.filterTodoCandidatesByAccess({
  currentUser: '李四',
  planTodos: indexedCandidates,
  transferApplications: [{ applicationId: 'ta-secret', projectId: 'market-b', projectName: '整机项目 B', activeOwner: '李四', completed: false, title: '机密转维节点', view: 'review' }],
  canViewPlan: (_projectId, planLevel) => planLevel === 'level2',
  canViewTransfer: () => false,
})
assert.deepEqual(accessFiltered, { planTodos: [], transferApplications: [] }, 'non-admin users never receive titles from unauthorized plan or transfer work')

assert.equal(todos.resolveVisiblePlanVersion(versions, 'v4', false), 'v3', 'users without draft visibility fall back to the latest published version')
assert.equal(todos.resolveVisiblePlanVersion(versions, 'v4', true), 'v4', 'authorized todo intent may restore a draft')
assert.equal(todos.resolveVisiblePlanVersion(versions, undefined, true), 'v4', 'ordinary authorized project entry keeps role-default draft behavior')

const transferFixtures = todos.buildTransferTodoCandidates({
  projects: [{ id: 'p1', name: '项目 A' }],
  applications: [
    { id: 'review', projectId: 'p1', projectName: '项目 A', status: 'in_progress', createdAt: '2026-07-28 10:00:00', applicantId: 'u001', applicant: '张明辉', plannedReviewDate: '2026-08-01', pipeline: { dataEntry: 'success', maintenanceReview: 'in_progress', sqaReview: 'not_started' }, team: { maintenance: [{ id: 'u003', name: '王建国', role: 'SPM' }], research: [] } },
    { id: 'sqa', projectId: 'p1', projectName: '项目 A', status: 'in_progress', applicantId: 'u001', applicant: '张明辉', plannedReviewDate: '2026-08-02', pipeline: { dataEntry: 'success', maintenanceReview: 'success', sqaReview: 'in_progress' }, team: { maintenance: [], research: [{ id: 'u007', name: '陈晓峰', role: 'SQA' }] } },
  ],
})
assert.deepEqual(transferFixtures.map(item => [item.view, item.activeOwner, item.sourceLabel]), [
  ['detail', '张三', '转维资料录入'],
  ['review', '王五', '转维维护审核'],
  ['detail', '张三', '转维资料录入'],
  ['sqa-review', '李白', '转维 SQA 审核'],
], 'completed history and active nodes use their authoritative owner identities')
assert.equal(transferFixtures[0].generatedAt, '2026-07-28 10:00:00', 'transfer candidates preserve the application creation timestamp')
assert.equal(transferFixtures[1].applicationId, 'review', 'transfer routes preserve the real application id rather than the row id')
assert.equal(transferFixtures[1].id, 'review:review', 'each transfer node keeps a unique workbench row id')

const crossDayCandidates = {
  currentUser: '张三',
  planTodos: [
    { id: 'completed-earlier', assignee: '张三', dueDate: '2026-07-01', completed: true, title: '早期已完成', projectId: 'p1', projectName: '项目 A', planLevel: 'level1', planKey: 'level1', versionId: 'v3' },
    { id: 'pending-later', assignee: '张三', dueDate: '2026-07-31', completed: false, title: '稍后待办', projectId: 'p1', projectName: '项目 A', planLevel: 'level1', planKey: 'level1', versionId: 'v3' },
  ],
  transferApplications: [],
}
assert.deepEqual(todos.aggregateWorkbenchTodos({ ...crossDayCandidates, today: '2026-07-30' }).map(item => item.id), ['pending-later', 'completed-earlier'], 'completed work remains available after pending work')
assert.deepEqual(todos.aggregateWorkbenchTodos({ ...crossDayCandidates, today: '2026-08-01' }).map(item => item.id), ['pending-later', 'completed-earlier'], 'two-state work remains deterministic across aggregation dates')
assert.deepEqual(
  todos.aggregateWorkbenchTodos({ ...crossDayCandidates, today: '2026-08-01' }),
  todos.aggregateWorkbenchTodos({ ...crossDayCandidates, today: '2026-08-01' }),
  'identical aggregate inputs and today values are deterministic',
)

assert.deepEqual(
  todos.TRANSFER_TO_PMS_USER_MAP.u001,
  { transferUserName: '张明辉', pmsUserName: '张三' },
  'transfer applicant identity maps explicitly into the PMS mock user set',
)
assert.equal(todos.mapTransferOwnerToPmsUser('u001', '张明辉'), '张三')
assert.equal(todos.mapTransferOwnerToPmsUser('u001', '同 ID 的错误姓名'), undefined, 'a mismatched external ID/name pair is not accepted')
assert.equal(todos.mapTransferOwnerToPmsUser('unmapped-user', '未映射用户'), undefined, 'unmapped transfer identities do not fabricate PMS ownership')

const resolvedMarketNavigation = todos.resolvePlanTodoNavigation({
  projectId: 'p1',
  projectMarkets: ['OP', 'TR'],
  todoMarket: 'OP',
  route: all.find(item => item.id === 'plan-overdue').route,
  baseVersions: [
    { id: 'v1', versionNo: 'V1', status: '已发布' },
    { id: 'v4', versionNo: 'V4', status: '修订中' },
  ],
  marketVersionsByKey: {
    'project::p1::OP::level1::versions': [
      { id: 'v1', versionNo: 'V1', status: '已发布' },
      { id: 'v4', versionNo: 'V4', status: '修订中' },
    ],
    'project::p1::TR::level1::versions': [{ id: 'v1', versionNo: 'V1', status: '已发布' }],
  },
  marketCurrentVersionByKey: { 'project::p1::TR::level1::versions': 'v1' },
  baseCurrentVersion: 'v1',
})
assert.deepEqual(
  resolvedMarketNavigation,
  { usesMarketVersion: true, market: 'OP', marketKey: 'project::p1::OP::level1::versions', versionId: 'v4' },
  'a market todo restores its own market/version even after another market was selected',
)
assert.equal(todos.resolvePlanTodoNavigation({
  projectId: 'p1',
  projectMarkets: ['OP', 'TR'],
  todoMarket: 'TR',
  route: all.find(item => item.id === 'plan-overdue').route,
  baseVersions: [],
  marketVersionsByKey: {},
  marketCurrentVersionByKey: {},
  baseCurrentVersion: 'v1',
}), null, 'mismatched market keys are rejected instead of faking successful navigation')

assert.deepEqual(
  todos.filterWorkbenchTodos(all, {
    search: '项目 a',
    projectId: 'p1',
    source: 'plan',
    status: 'pending',
    generatedDateFrom: '2026-07-30',
    generatedDateTo: '2026-07-31',
  }).map(item => item.id),
  ['plan-overdue'],
  'search, project, directory, status, and inclusive generation-date filters compose on the same dataset',
)
assert.deepEqual(
  todos.filterWorkbenchTodos(all, { status: 'all' }).map(item => item.id),
  all.map(item => item.id),
  'the all status preserves the complete two-state dataset',
)
assert.deepEqual(
  todos.summarizeWorkbenchTodos([
    ...all,
    { ...all[0], id: 'done-sunday', status: 'completed', completedAt: '2026-07-26', dueDate: '2026-07-01' },
    { ...all[0], id: 'done-monday', status: 'completed', completedAt: '2026-07-27', dueDate: '2026-07-01' },
  ], '2026-07-31'),
  { total: 7, dueToday: 1, overdue: 1, completedThisWeek: 2 },
  'completed items are never overdue and natural-week completion starts on Monday',
)

const todoCenterSource = readSource(root, 'src/components/workspace/TodoCenter.tsx')
const globalStyles = readSource(root, 'src/styles/globals.css')
const aggregationSource = readSource(root, 'src/lib/todoAggregation.ts')
const workbenchSource = readSource(root, 'src/containers/WorkbenchContainer.tsx')
const projectSpaceSource = readSource(root, 'src/containers/ProjectSpaceContainer.tsx')
const uiStoreSource = readSource(root, 'src/stores/ui.ts')
const todayHookSource = readSource(root, 'src/hooks/useLocalToday.ts')
const browserSource = readSource(root, 'screenshots/verify-workbench-summary-floating-panels.mjs')
for (const label of ['任务目录', '计划', '转维护', '全部', '待处理', '已完成', '搜索待办', '项目筛选', '生成时间', '清空筛选', '前往处理', '查看详情']) {
  assert.match(todoCenterSource, new RegExp(label), `todo center missing visible or accessible contract: ${label}`)
}
for (const removedLabel of ['待办总数', '今日到期', '已逾期', '本周完成', '状态筛选']) {
  assert.doesNotMatch(todoCenterSource, new RegExp(removedLabel), `todo center must remove ${removedLabel}`)
}
assert.match(workbenchSource, /个人工作台/, 'workbench exposes the single personal-workbench title')
assert.doesNotMatch(todoCenterSource, /mode="multiple"/, 'directory replaces the task-classification multi-select')
assert.match(todoCenterSource, /RangePicker/, 'generation time uses one date-range picker')
for (const className of ['pms-todo-filter--search', 'pms-todo-filter--project', 'pms-todo-filter--date', 'pms-todo-filter--clear']) {
  assert.match(todoCenterSource, new RegExp(className), `todo filter bar missing sizing hook: ${className}`)
}
assert.match(todoCenterSource, /resolveWorkbenchDefaultSelection/, 'initial source and status use the pure default selector')
assert.match(todoCenterSource, /role="tablist"/, 'status filters expose a tab list')
assert.match(todoCenterSource, /aria-selected=/, 'status tabs expose their selected state')
assert.match(globalStyles, /\.pms-todo-center__filters[\s\S]*display:\s*flex[\s\S]*flex-wrap:\s*wrap/, 'todo filters use one compact wrapping row')
assert.match(globalStyles, /\.pms-todo-center__filters[\s\S]*height:\s*32px\s*!important/, 'todo filter controls share one compact height')
assert.match(globalStyles, /grid-template-columns:\s*176px minmax\(0, 1fr\)/, 'desktop uses directory and data columns')
assert.match(globalStyles, /@media \(max-width: 760px\)[\s\S]*grid-template-columns:\s*1fr/, 'narrow layout stacks the directory above the table')
assert.match(todoCenterSource, /pagination=\{\{/, 'todo table exposes pagination')
requireSource(root, 'src/containers/WorkbenchContainer.tsx', /<TodoCenter\b/, 'workbench must render the classified TodoCenter')
requireSource(root, 'src/containers/WorkbenchContainer.tsx', /useActivateProject\(\)/, 'todo navigation must reuse shared project activation')
assert.doesNotMatch(aggregationSource, /new Date\(\)/, 'todo aggregation must not read the process wall clock')
assert.match(aggregationSource, /TRANSFER_TO_PMS_USER_MAP|mapTransferOwnerToPmsUser/, 'transfer ownership must use the explicit mock identity bridge')
assert.match(aggregationSource, /application\.applicantId/, 'entry ownership must start from the authoritative transfer applicant identity')
assert.doesNotMatch(workbenchSource, /linkedProject\?\.leader/, 'entry ownership must never fall back to the project leader')
assert.doesNotMatch(workbenchSource, /projects\.find\(item => Array\.isArray\(item\.markets\)/, 'plan candidates must never guess the first market project')
assert.doesNotMatch(workbenchSource, /\.find\(meta => typeof meta\?\.projectName/, 'plan candidates must never guess ownership from the first metadata row')
assert.match(uiStoreSource, /planNavigationIntent/, 'todo navigation requires a typed one-shot intent')
assert.match(projectSpaceSource, /setPlanNavigationIntent\(null\)/, 'project space must consume and clear todo navigation intent')
assert.doesNotMatch(projectSpaceSource, /explicitMarketVersion/, 'historical market selection must not masquerade as explicit todo navigation')
for (const column of ['任务名称', '所属项目', '状态', '任务节点', '任务内容', '处理人', '生成时间', '操作']) assert.match(todoCenterSource, new RegExp(`title:\\s*['"]${column}['"]`), `todo table missing ${column} column`)
assert.doesNotMatch(todoCenterSource, /title:\s*['"]任务来源['"]/, 'task source is represented by the directory')
assert.doesNotMatch(todoCenterSource, /title:\s*['"]截止日期['"]/, 'todo table removes the due-date column')
assert.doesNotMatch(todoCenterSource, /onRow=/, 'todo table rows are not interactive controls')
assert.match(todoCenterSource, /role="status"/, 'todo results expose a dedicated polite status region')
assert.match(todoCenterSource, /error\?:\s*string/, 'todo center exposes a contextual error state')
assert.match(todoCenterSource, /onRetry\?:\s*\(\)\s*=>\s*void/, 'todo error offers a recovery action')
assert.match(todoCenterSource, /<Skeleton\b/, 'todo loading state reserves the final table footprint')
assert.match(todoCenterSource, /role="alert"/, 'todo load errors are announced')
assert.match(todoCenterSource, /record\.status === ['"]completed['"] \? ['"]查看详情['"] : ['"]前往处理['"]/, 'todo actions match their two-state purpose')
assert.match(todayHookSource, /setTimeout/, 'local today hook schedules the next midnight refresh')
assert.match(todayHookSource, /clearTimeout/, 'local today hook cleans up its midnight timer')
assert.match(browserSource, /unexpectedBrowserErrors/, 'browser verification must retain unexpected errors')
assert.match(browserSource, /throw new Error\(`unexpected browser errors/, 'browser verification must fail on unexpected browser errors')
assert.doesNotMatch(todoCenterSource, /checklist\.map|tmChecklistItems\.map/, 'todo center must not split transfer checklists into rows')
console.log('todo center contract passed')
