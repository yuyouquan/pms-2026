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
]) assert.equal(typeof todos[name], 'function', `missing ${name}`)
const input = {
  currentUser: '张三',
  today: '2026-07-31',
  planTodos: [
    { id: 'plan-overdue', assignee: '张三', dueDate: '2026-07-30', title: '逾期任务', projectId: 'p1', projectName: '项目 A', planLevel: 'level1', planKey: 'level1', versionId: 'v4', market: 'OP', marketKey: 'project::p1::OP::level1::versions' },
    { id: 'plan-today', assignee: '张三', dueDate: '2026-07-31', title: '今日任务', projectId: 'p2', projectName: '项目 B', planLevel: 'level2', planKey: 'plan2', versionId: 'v1', status: 'in_progress' },
    { id: 'plan-done', assignee: '张三', completedAt: '2026-07-30', title: '已完成任务', projectId: 'p1', projectName: '项目 A', planLevel: 'level1', planKey: 'level1', versionId: 'v4' },
    { id: 'plan-other', assignee: '李四' },
  ],
  transferApplications: [
    { id: 'transfer-mine', projectId: 'p1', projectName: '项目 A', activeOwner: '张三', completed: false, title: '转维录入', view: 'entry', checklist: [{ id: 'checklist' }] },
    { id: 'transfer-done', activeOwner: '张三', completed: true },
    { id: 'transfer-other', activeOwner: '李四', completed: false },
  ],
}
const all = todos.aggregateWorkbenchTodos(input)
assert.deepEqual(all.map(item => item.id), ['plan-overdue', 'plan-today', 'plan-done', 'transfer-mine'], 'aggregate excludes other users, completed transfers, and nested checklists')
assert.deepEqual(todos.filterWorkbenchTodos(all, { source: 'transfer' }).map(item => item.id), ['transfer-mine'], 'filters operate on aggregate output')
assert.deepEqual(todos.filterWorkbenchTodos(all, { source: 'plan' }).map(item => item.id), ['plan-overdue', 'plan-today', 'plan-done'], 'source filter counts plan todos separately')
assert.deepEqual(todos.summarizeWorkbenchTodos(all, '2026-07-31'), { total: 4, dueToday: 1, overdue: 1, completedThisWeek: 1 }, 'summary derives today, overdue, and this-week completion from aggregate output')
assert.equal(all[0].route.marketKey, 'project::p1::OP::level1::versions', 'market plan routes preserve their validated market scope key')
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
    { id: 'review', projectId: 'p1', projectName: '项目 A', status: 'in_progress', applicantId: 'u001', applicant: '张明辉', plannedReviewDate: '2026-08-01', pipeline: { dataEntry: 'success', maintenanceReview: 'in_progress', sqaReview: 'not_started' }, team: { maintenance: [{ id: 'u003', name: '王建国', role: 'SPM' }], research: [] } },
    { id: 'sqa', projectId: 'p1', projectName: '项目 A', status: 'in_progress', applicantId: 'u001', applicant: '张明辉', plannedReviewDate: '2026-08-02', pipeline: { dataEntry: 'success', maintenanceReview: 'success', sqaReview: 'in_progress' }, team: { maintenance: [], research: [{ id: 'u007', name: '陈晓峰', role: 'SQA' }] } },
  ],
})
assert.deepEqual(transferFixtures.map(item => [item.view, item.activeOwner, item.sourceLabel]), [
  ['review', '王五', '转维维护审核'],
  ['sqa-review', '李白', '转维 SQA 审核'],
], 'review and SQA nodes use their current authoritative owner identities')

const crossDayCandidates = {
  currentUser: '张三',
  planTodos: [
    { id: 'completed-earlier', assignee: '张三', dueDate: '2026-07-01', completed: true, title: '早期已完成', projectId: 'p1', projectName: '项目 A', planLevel: 'level1', planKey: 'level1', versionId: 'v3' },
    { id: 'pending-later', assignee: '张三', dueDate: '2026-07-31', completed: false, title: '稍后待办', projectId: 'p1', projectName: '项目 A', planLevel: 'level1', planKey: 'level1', versionId: 'v3' },
  ],
  transferApplications: [],
}
assert.deepEqual(
  todos.aggregateWorkbenchTodos({ ...crossDayCandidates, today: '2026-07-30' }).map(item => item.id),
  ['completed-earlier', 'pending-later'],
  'before the due date, stable due-date sorting applies without hidden wall-clock reads',
)
assert.deepEqual(
  todos.aggregateWorkbenchTodos({ ...crossDayCandidates, today: '2026-08-01' }).map(item => item.id),
  ['pending-later', 'completed-earlier'],
  'after the due date, explicit today moves overdue work first',
)
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
  route: all[0].route,
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
  route: all[0].route,
  baseVersions: [],
  marketVersionsByKey: {},
  marketCurrentVersionByKey: {},
  baseCurrentVersion: 'v1',
}), null, 'mismatched market keys are rejected instead of faking successful navigation')

assert.deepEqual(
  todos.filterWorkbenchTodos(all, {
    source: 'all',
    search: '项目 a',
    projectId: 'p1',
    status: 'all',
    dueDateFrom: '2026-07-30',
    dueDateTo: '2026-08-01',
  }).map(item => item.id),
  ['plan-overdue'],
  'search, project, and inclusive date filters compose on the same dataset',
)
assert.deepEqual(
  todos.filterWorkbenchTodos(all, { status: 'completed' }).map(item => item.id),
  ['plan-done'],
  'status filtering includes completed plan work without treating completed transfers as active todos',
)
assert.deepEqual(
  todos.summarizeWorkbenchTodos([
    ...all,
    { ...all[0], id: 'done-sunday', status: 'completed', completedAt: '2026-07-26', dueDate: '2026-07-01' },
    { ...all[0], id: 'done-monday', status: 'completed', completedAt: '2026-07-27', dueDate: '2026-07-01' },
  ], '2026-07-31'),
  { total: 6, dueToday: 1, overdue: 1, completedThisWeek: 2 },
  'completed items are never overdue and natural-week completion starts on Monday',
)

const todoCenterSource = readSource(root, 'src/components/workspace/TodoCenter.tsx')
const aggregationSource = readSource(root, 'src/lib/todoAggregation.ts')
const workbenchSource = readSource(root, 'src/containers/WorkbenchContainer.tsx')
const projectSpaceSource = readSource(root, 'src/containers/ProjectSpaceContainer.tsx')
const uiStoreSource = readSource(root, 'src/stores/ui.ts')
const todayHookSource = readSource(root, 'src/hooks/useLocalToday.ts')
const browserSource = readSource(root, 'screenshots/verify-workbench-summary-floating-panels.mjs')
for (const label of [
  '全部', '计划待办', '转维待办',
  '待办总数', '今日到期', '已逾期', '本周完成',
  '搜索待办', '项目筛选', '状态筛选', '开始日期', '结束日期', '清空筛选',
]) {
  assert.match(todoCenterSource, new RegExp(label), `todo center missing visible or accessible contract: ${label}`)
}
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
for (const column of ['所属项目', '来源', '操作']) assert.match(todoCenterSource, new RegExp(column), `todo table missing ${column} column`)
assert.doesNotMatch(todoCenterSource, /onRow=/, 'todo table rows are not interactive controls')
assert.match(todoCenterSource, /role="status"/, 'todo results expose a dedicated polite status region')
assert.match(todoCenterSource, /error\?:\s*string/, 'todo center exposes a contextual error state')
assert.match(todoCenterSource, /onRetry\?:\s*\(\)\s*=>\s*void/, 'todo error offers a recovery action')
assert.match(todoCenterSource, /<Skeleton\b/, 'todo loading state reserves the final table footprint')
assert.match(todoCenterSource, /role="alert"/, 'todo load errors are announced')
assert.match(todoCenterSource, /aria-label={`打开待办/, 'todo actions expose explicit accessible buttons')
assert.match(todayHookSource, /setTimeout/, 'local today hook schedules the next midnight refresh')
assert.match(todayHookSource, /clearTimeout/, 'local today hook cleans up its midnight timer')
assert.match(browserSource, /unexpectedBrowserErrors/, 'browser verification must retain unexpected errors')
assert.match(browserSource, /throw new Error\(`unexpected browser errors/, 'browser verification must fail on unexpected browser errors')
assert.doesNotMatch(todoCenterSource, /checklist\.map|tmChecklistItems\.map/, 'todo center must not split transfer checklists into rows')
console.log('todo center contract passed')
