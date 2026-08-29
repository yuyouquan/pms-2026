import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot, readSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const templateRules = loadTypeScriptModule(root, 'src/lib/mrTemplateRules.ts')
const templateMocks = loadTypeScriptModule(root, 'src/data/mrVersionPlanMocks.ts')
const templateMocksSource = readSource(root, 'src/data/mrVersionPlanMocks.ts')
const planRules = loadTypeScriptModule(root, 'src/lib/mrVersionPlanRules.ts')
const aggregationRules = loadTypeScriptModule(root, 'src/lib/mrAggregationRules.ts')
const dateRules = loadTypeScriptModule(root, 'src/lib/mrDateRules.ts')
const adapter = loadTypeScriptModule(root, 'src/lib/mrPlanSourceAdapters.ts')

assert.doesNotMatch(templateMocksSource, /as unknown as MrTemplateActivity\[\]/)
assert.match(
  templateMocksSource,
  /export const DEFAULT_MR_TEMPLATE_ACTIVITIES:\s*readonly Readonly<MrTemplateActivity>\[\]\s*=/,
)

assert.equal(templateRules.DEFAULT_MR_TEMPLATE_ACTIVITIES.length, 15)
assert.deepEqual(
  templateRules.numberMrTemplateActivities(templateRules.DEFAULT_MR_TEMPLATE_ACTIVITIES)
    .map(row => [row.number, row.activityName]),
  [
    ['1', '需求&修改点'],
    ['1.1', '修改点收集开始时间'],
    ['1.2', '修改点锁定时间'],
    ['2', '入库&自测&转测'],
    ['2.1', 'MP入库开始时间'],
    ['2.2', 'MP入库截止时间'],
    ['2.3', '版本转测时间'],
    ['3', '版本测试'],
    ['3.1', '测试开始时间'],
    ['3.2', '测试完成时间'],
    ['4', '版本评审'],
    ['4.1', '评审时间'],
    ['5', '版本发布'],
    ['5.1', '软件归档时间'],
    ['5.2', 'OTA开放验证&部署'],
  ],
)

const NOW = '2026-08-29T08:00:00.000Z'
const LATER = '2026-08-30T08:00:00.000Z'
const parent = { id: 'stage-a', parentId: null, order: 0, activityName: '阶段A' }
const parentB = { id: 'stage-b', parentId: null, order: 1, activityName: '第二阶段' }
const childA = { id: 'node-a', parentId: parent.id, order: 0, activityName: '子活动A' }
const childB = { id: 'node-b', parentId: parent.id, order: 1, activityName: '子活动B' }
const childC = { id: 'node-c', parentId: parentB.id, order: 0, activityName: '子活动C' }
const grandchild = { id: 'node-a-child', parentId: childA.id, order: 0, activityName: '三级活动' }

assert.deepEqual(templateRules.validateMrTemplateForPublish([
  parent,
  { ...childA, activityName: '节点A' },
  { ...childB, activityName: ' 节点A ' },
]), ['活动名称重复：节点A'])
assert.deepEqual(
  templateRules.validateMrTemplateForPublish([{ ...parent, activityName: ' ' }]),
  ['活动名称不能为空'],
)

assert.throws(
  () => templateRules.normalizeMrTemplateActivities([parent, childA, grandchild]),
  /最多支持两级活动/,
)
assert.throws(
  () => templateRules.normalizeMrTemplateActivities([{ ...childA, parentId: 'missing' }]),
  /父活动不存在/,
)
assert.throws(
  () => templateRules.normalizeMrTemplateActivities([{ ...parent, activityName: ' ' }]),
  /活动名称不能为空/,
)
assert.throws(
  () => templateRules.normalizeMrTemplateActivities([parent, { ...parent }]),
  /活动 ID 重复/,
)
assert.throws(
  () => templateRules.normalizeMrTemplateActivities([{ ...parent, id: ' ' }]),
  /活动 ID 不能为空/,
)

const normalized = templateRules.normalizeMrTemplateActivities([
  { ...childB, order: 8 },
  { ...parentB, order: 4 },
  { ...childC, order: 3 },
  { ...parent, order: 7 },
  { ...childA, order: 9 },
])
assert.deepEqual(normalized.map(row => row.id), [parentB.id, childC.id, parent.id, childB.id, childA.id])
assert.deepEqual(normalized.map(row => [row.id, row.order]), [
  [parentB.id, 0], [childC.id, 0], [parent.id, 1], [childB.id, 0], [childA.id, 1],
])

const seed = templateRules.DEFAULT_MR_TEMPLATE_ACTIVITIES
assert.deepEqual(templateRules.validateMrTemplateForPublish([]), ['模板至少需要一个活动'])
const cloned = templateRules.cloneMrTemplateSnapshot(seed)
assert.deepEqual(cloned, seed)
assert.notStrictEqual(cloned, seed)
assert.notStrictEqual(cloned[0], seed[0])

const initialVersions = templateMocks.createInitialMrTemplateVersions()
const nextInitialVersions = templateMocks.createInitialMrTemplateVersions()
assert.notStrictEqual(initialVersions[0].activities, seed)
assert.notStrictEqual(initialVersions[0].activities[0], seed[0])
assert.notStrictEqual(initialVersions[0].activities, nextInitialVersions[0].activities)
assert.notStrictEqual(initialVersions[0].activities[0], nextInitialVersions[0].activities[0])
const revision = templateRules.createMrTemplateRevision(initialVersions, '张三', NOW)
assert.equal(revision.filter(item => item.status === '修订中').length, 1)
assert.equal(revision.find(item => item.status === '修订中').versionNo, 'V2')
assert.throws(() => templateRules.createMrTemplateRevision(revision, '张三', NOW), /已存在修订版本/)
assert.deepEqual(initialVersions, templateMocks.createInitialMrTemplateVersions())
const highestVersionRevision = templateRules.createMrTemplateRevision([
  initialVersions[0],
  { ...initialVersions[0], id: 'mr-template-v3', versionNo: 'V3' },
], '张三', NOW)
assert.equal(highestVersionRevision.at(-1).versionNo, 'V4')
assert.notStrictEqual(highestVersionRevision.at(-1).activities, initialVersions[0].activities)
assert.throws(
  () => templateRules.createMrTemplateRevision([
    initialVersions[0],
    { ...initialVersions[0], id: 'mr-template-latest', versionNo: 'latest' },
  ], '张三', NOW),
  /版本号格式无效：latest/,
)
assert.throws(
  () => templateRules.createMrTemplateRevision([
    initialVersions[0],
    { ...initialVersions[0], id: 'mr-template-unsafe', versionNo: 'V9007199254740992' },
  ], '张三', NOW),
  /版本号格式无效：V9007199254740992/,
)
assert.throws(
  () => templateRules.createMrTemplateRevision([
    { ...initialVersions[0], id: 'mr-template-max-safe', versionNo: 'V9007199254740991' },
  ], '张三', NOW),
  /版本号已达到最大安全值：V9007199254740991/,
)

const revisionBeforePublish = JSON.parse(JSON.stringify(revision))
const published = templateRules.publishMrTemplateRevision(revision, revision.at(-1).id, '张三', LATER)
assert.equal(published.at(-1).status, '已发布')
assert.equal(published.at(-1).publishedAt, LATER)
assert.deepEqual(revision, revisionBeforePublish)
assert.equal(templateRules.cancelMrTemplateRevision(revision, revision.at(-1).id).length, 1)
assert.throws(() => templateRules.cancelMrTemplateRevision(initialVersions, initialVersions[0].id), /仅可取消修订版本/)
assert.throws(() => templateRules.cancelMrTemplateRevision(revision, 'missing'), /修订版本不存在/)
assert.throws(
  () => templateRules.publishMrTemplateRevision(
    revision.map(version => version.id === revision.at(-1).id
      ? { ...version, activities: [{ ...version.activities[0], activityName: '重复' }, { ...version.activities[1], activityName: ' 重复 ' }] }
      : version),
    revision.at(-1).id,
    '张三',
    LATER,
  ),
  /活动名称重复：重复/,
)
assert.throws(
  () => templateRules.publishMrTemplateRevision(
    revision.map(version => version.id === revision.at(-1).id ? { ...version, activities: [] } : version),
    revision.at(-1).id,
    '张三',
    LATER,
  ),
  /模板至少需要一个活动/,
)

const shuffledDraftActivities = [
  { ...childC, order: 9 },
  { ...parentB, order: 8 },
  { ...childB, order: 7 },
  { ...parent, order: 4 },
  { ...childA, order: 6 },
]
const shuffledRevision = templateRules.createMrTemplateRevision(initialVersions, '张三', NOW)
const shuffledRevisionWithActivities = shuffledRevision.map(version => version.status === '修订中'
  ? { ...version, activities: shuffledDraftActivities }
  : version)
const shuffledRevisionBeforePublish = JSON.parse(JSON.stringify(shuffledRevisionWithActivities))
const canonicalPublished = templateRules.publishMrTemplateRevision(
  shuffledRevisionWithActivities,
  shuffledRevisionWithActivities.at(-1).id,
  '张三',
  LATER,
)
assert.deepEqual(canonicalPublished.at(-1).activities.map(row => [row.id, row.order]), [
  [parent.id, 0], [childA.id, 0], [childB.id, 1], [parentB.id, 1], [childC.id, 0],
])
assert.deepEqual(shuffledRevisionWithActivities, shuffledRevisionBeforePublish)
assert.notStrictEqual(canonicalPublished.at(-1).activities, shuffledRevisionWithActivities.at(-1).activities)
assert.notStrictEqual(canonicalPublished.at(-1).activities[0], shuffledRevisionWithActivities.at(-1).activities[0])
assert.notStrictEqual(canonicalPublished[0], shuffledRevisionWithActivities[0])
assert.notStrictEqual(canonicalPublished[0].activities, shuffledRevisionWithActivities[0].activities)
assert.notStrictEqual(canonicalPublished[0].activities[0], shuffledRevisionWithActivities[0].activities[0])

assert.equal(Object.isFrozen(seed), true)
assert.equal(Object.isFrozen(seed[0]), true)
const originalSeedName = seed[0].activityName
try {
  seed[0].activityName = '不应写入'
} catch {
  // Frozen ESM bindings throw in strict mode; either path must preserve the seed.
}
assert.equal(seed[0].activityName, originalSeedName)
const postMutationInitialVersions = templateMocks.createInitialMrTemplateVersions()
const anotherPostMutationInitialVersions = templateMocks.createInitialMrTemplateVersions()
assert.equal(postMutationInitialVersions[0].activities[0].activityName, originalSeedName)
assert.notStrictEqual(postMutationInitialVersions[0].activities, anotherPostMutationInitialVersions[0].activities)
assert.notStrictEqual(postMutationInitialVersions[0].activities[0], anotherPostMutationInitialVersions[0].activities[0])

const moveFixture = [parent, childA, childB, parentB, childC]
const sourceBeforeMove = JSON.parse(JSON.stringify(moveFixture))
const movedChild = templateRules.moveMrTemplateActivity(moveFixture, childB.id, childA.id)
assert.deepEqual(
  templateRules.numberMrTemplateActivities(movedChild)
    .filter(row => row.parentId === parent.id).map(row => row.activityName),
  ['子活动B', '子活动A'],
)
assert.deepEqual(moveFixture, sourceBeforeMove)
assert.notStrictEqual(movedChild, moveFixture)
assert.notStrictEqual(movedChild[0], moveFixture[0])

const movedParent = templateRules.moveMrTemplateActivity(moveFixture, parentB.id, parent.id)
assert.deepEqual(movedParent.map(row => row.id), [parentB.id, childC.id, parent.id, childA.id, childB.id])
assert.deepEqual(
  templateRules.moveMrTemplateActivity(moveFixture, childC.id, childA.id),
  templateRules.normalizeMrTemplateActivities(moveFixture),
)
assert.deepEqual(
  templateRules.moveMrTemplateActivity(moveFixture, 'missing', childA.id),
  templateRules.normalizeMrTemplateActivities(moveFixture),
)
assert.deepEqual(
  templateRules.moveMrTemplateActivity(moveFixture, childA.id, childA.id),
  templateRules.normalizeMrTemplateActivities(moveFixture),
)

const childThird = { id: 'node-third', parentId: parent.id, order: 2, activityName: '子活动C' }
assert.deepEqual(
  templateRules.moveMrTemplateActivity([parent, childA, childB, childThird], childA.id, childThird.id)
    .filter(row => row.parentId === parent.id).map(row => row.activityName),
  ['子活动B', '子活动C', '子活动A'],
)

const parentThird = { id: 'stage-c', parentId: null, order: 2, activityName: '第三阶段' }
const childOfThirdParent = { id: 'node-d', parentId: parentThird.id, order: 0, activityName: '子活动D' }
assert.deepEqual(
  templateRules.numberMrTemplateActivities(templateRules.moveMrTemplateActivity(
    [parent, childA, childB, parentB, childC, parentThird, childOfThirdParent],
    parent.id,
    parentThird.id,
  )).map(row => [row.number, row.id]),
  [
    ['1', parentB.id], ['1.1', childC.id],
    ['2', parentThird.id], ['2.1', childOfThirdParent.id],
    ['3', parent.id], ['3.1', childA.id], ['3.2', childB.id],
  ],
)

// tOS MR-plan rules: version source, date validation, permissions, and projections.
assert.equal(planRules.compareTosVersionNumbers('16.3.0.9', '16.3.0.110') < 0, true)
assert.equal(planRules.compareTosVersionNumbers('16.3', '16.3.1') < 0, true)
assert.equal(planRules.compareTosVersionNumbers('tOS17.0', '17.0'), 0)
assert.deepEqual(
  planRules.sortTosVersionNumbers(['invalid-B', '16.3.0.145', 'tOS17.0', '16.3.0.110', 'invalid-A', '16.3.0.9']),
  ['16.3.0.9', '16.3.0.110', '16.3.0.145', 'tOS17.0', 'invalid-A', 'invalid-B'],
)
const sortingSource = ['16.3.0.110', '16.3.0.110', 'invalid-A']
assert.deepEqual(planRules.sortTosVersionNumbers(sortingSource), sortingSource)
assert.notStrictEqual(planRules.sortTosVersionNumbers(sortingSource), sortingSource)
assert.equal(planRules.normalizeMrBusinessDate('2028-02-29'), '2028-02-29')
assert.equal(planRules.normalizeMrBusinessDate('2026-02-29'), '')
assert.equal(planRules.normalizeMrBusinessDate('2026-02-30'), '')
assert.equal(planRules.normalizeMrBusinessDate(new Date('invalid')), '')
assert.equal(planRules.normalizeMrBusinessDate(new Date('2026-01-01T16:00:00.000Z')), '2026-01-02')
assert.equal(planRules.normalizeMrBusinessDate('2026-01-02T00:30:00+08:00'), '2026-01-02')
assert.equal(planRules.normalizeMrBusinessDate('2026-01-01T23:30:00-05:00'), '2026-01-02')
assert.equal(planRules.normalizeMrBusinessDate('2026/01/02'), '')
assert.equal(planRules.normalizeMrBusinessDate('2026-01-02 00:00:00'), '')

const tosLevel1Tasks = [
  { id: 'maintenance-id', stableId: 'maintenance-stable', parentId: null, taskName: ' 维护阶段 ', order: 2 },
  { id: '上市-id', stableId: '上市-stable', parentId: null, taskName: ' 上市迭代阶段 ', order: 1 },
  { id: 'child-115', parentId: '上市-stable', taskName: ' 16.3.0.115 ', order: 2, planStartDate: new Date('2026-01-02T00:00:00.000Z'), planEndDate: '2026-01-03' },
  { id: 'child-110', parentId: '上市-id', taskName: '16.3.0.110', order: 1, planStartDate: '', planEndDate: '2026-01-02' },
  { id: 'child-120', parentId: 'maintenance-id', taskName: '16.3.0.120', order: 1, planStartDate: '2026-02-30', planEndDate: '2026-01-04' },
  { id: 'child-duplicate', parentId: 'maintenance-stable', taskName: '16.3.0.115', order: 2, planStartDate: '2026-01-05', planEndDate: '2026-01-06' },
  { id: 'child-blank', parentId: 'maintenance-id', taskName: '   ', order: 3, planStartDate: '2026-01-06', planEndDate: '2026-01-07' },
]
const draftTasks = [{ id: 'draft-stage', parentId: null, taskName: '上市迭代阶段', order: 0 }, { id: 'draft-child', parentId: 'draft-stage', taskName: '99.0', order: 0, planStartDate: '2026-01-01', planEndDate: '2026-01-02' }]
const candidateInput = {
  versions: [
    { id: 'v3', versionNo: 'V3', status: '已发布' },
    { id: 'v4', versionNo: 'V4', status: '修订中' },
    { id: 'bad', versionNo: 'latest', status: '已发布' },
  ],
  getSnapshot: id => id === 'v3' ? tosLevel1Tasks : id === 'v4' ? draftTasks : undefined,
  usedVersions: ['16.3.0.110'],
}
const candidatesBefore = structuredClone(tosLevel1Tasks)
const candidates = planRules.selectTosMrVersionCandidates(candidateInput)
assert.deepEqual(candidates.map(item => [item.value, item.disabled]), [
  ['16.3.0.110', true],
  ['16.3.0.115', false],
  ['16.3.0.120', true],
])
assert.equal(candidates[0].reason, '该tOS版本号已添加')
assert.equal(candidates[0].planStartDate, '')
assert.equal(candidates[1].planStartDate, '2026-01-02')
assert.equal(candidates[2].planStartDate, '')
assert.equal(candidates[2].reason, '请先完善一级计划中的计划开始时间和计划完成时间')
assert.deepEqual(tosLevel1Tasks, candidatesBefore)
assert.deepEqual(planRules.selectTosMrVersionCandidates({ ...candidateInput, versions: [{ id: 'v4', versionNo: 'V4', status: '修订中' }] }), [])

const latestPublishedSnapshot = [
  { id: 'valid-stage', parentId: null, taskName: '上市迭代阶段', order: 0 },
  { id: 'valid-child', parentId: 'valid-stage', taskName: '5.0', order: 0, planStartDate: '2026-02-01', planEndDate: '2026-02-02' },
  { id: 'grandchild', parentId: 'valid-child', taskName: '5.0.1', order: 0, planStartDate: '2026-02-01', planEndDate: '2026-02-02' },
  { id: 'near-stage', parentId: null, taskName: ' 上市迭代阶段X ', order: 1 },
  { id: 'near-child', parentId: 'near-stage', taskName: '5.1', order: 0, planStartDate: '2026-02-01', planEndDate: '2026-02-02' },
]
const readSnapshots = []
assert.deepEqual(planRules.selectTosMrVersionCandidates({
  versions: [
    { id: 'v3', versionNo: 'V3', status: '已发布' },
    { id: 'invalid-zero', versionNo: 'V0', status: '已发布' },
    { id: 'invalid-unsafe', versionNo: 'V9007199254740992', status: '已发布' },
    { id: 'v5', versionNo: 'V5', status: '已发布' },
    { id: 'v6', versionNo: 'V6', status: '修订中' },
  ],
  getSnapshot: id => {
    readSnapshots.push(id)
    return id === 'v5' ? latestPublishedSnapshot : draftTasks
  },
  usedVersions: ['5.0'],
}), [{ value: '5.0', label: '5.0', planStartDate: '2026-02-01', planEndDate: '2026-02-02', disabled: true, reason: '该tOS版本号已添加' }])
assert.deepEqual(readSnapshots, ['v5'])
assert.deepEqual(planRules.selectTosMrVersionCandidates({
  versions: [{ id: 'zero', versionNo: 'V0', status: '已发布' }, { id: 'unsafe', versionNo: 'V9007199254740992', status: '已发布' }],
  getSnapshot: () => latestPublishedSnapshot,
  usedVersions: [],
}), [])

const tosActivities = [
  { id: 'parent', parentId: null, order: 0, activityName: '需求&修改点' },
  { id: 'collect', parentId: 'parent', order: 0, activityName: ' 修改点收集开始时间 ' },
  { id: 'release-parent', parentId: null, order: 1, activityName: '版本发布' },
  { id: 'ota', parentId: 'release-parent', order: 0, activityName: 'OTA开放验证&部署' },
  { id: 'renamed', parentId: 'release-parent', order: 1, activityName: '已改名活动' },
]
const tosInstance = { projectId: 'project-1', tosVersion: '16.3.0.110', templateVersionId: 'template-v1', activities: tosActivities, dates: { parent: '2026-01-01', collect: '2025-12-31', ota: '2026-02-01', renamed: '2025-01-01' }, createdBy: '张三', createdAt: NOW, updatedBy: '张三', updatedAt: NOW }
assert.deepEqual(planRules.validateTosMrInstanceDates(tosInstance, { planStartDate: '2026-01-01', planEndDate: '2026-01-31' }), [
  { rowKey: 'project-1::16.3.0.110', activityId: 'collect', activityName: ' 修改点收集开始时间 ', message: '修改点收集开始时间不能早于一级计划中的计划开始时间' },
  { rowKey: 'project-1::16.3.0.110', activityId: 'ota', activityName: 'OTA开放验证&部署', message: 'OTA开放验证&部署不能晚于一级计划中的计划完成时间' },
])
assert.deepEqual(planRules.validateTosMrInstanceDates({ ...tosInstance, dates: { collect: '', ota: '' } }, { planStartDate: '', planEndDate: '' }), [])

assert.deepEqual(planRules.resolveMrPermissions({ currentUser: '李白', globalAdminUsers: [], tosManagerUsers: ['李白'], machineSpm: '张三', context: 'tos' }), { canView: true, canEditTemplate: false, canEditTos: true, canEditMachine: false, canStopRelease: false, canEditMarket: false })
assert.deepEqual(planRules.resolveMrPermissions({ currentUser: ' 管理员 ', globalAdminUsers: ['管理员'], tosManagerUsers: [], machineSpm: '张三', context: 'config' }), { canView: true, canEditTemplate: true, canEditTos: true, canEditMachine: true, canStopRelease: true, canEditMarket: true })
assert.deepEqual(planRules.resolveMrPermissions({ currentUser: '张三', globalAdminUsers: [], tosManagerUsers: ['张三'], machineSpm: '张三', context: 'joint-machine' }), { canView: true, canEditTemplate: false, canEditTos: false, canEditMachine: true, canStopRelease: true, canEditMarket: false })
assert.deepEqual(planRules.resolveMrPermissions({ currentUser: '张三', globalAdminUsers: [], tosManagerUsers: ['张三'], machineSpm: '张三', context: 'machine-market' }), { canView: true, canEditTemplate: false, canEditTos: false, canEditMachine: false, canStopRelease: false, canEditMarket: true })
assert.deepEqual(planRules.resolveMrPermissions({ currentUser: '普通用户', globalAdminUsers: [], tosManagerUsers: ['普通用户'], machineSpm: '张三', context: 'config' }), { canView: true, canEditTemplate: false, canEditTos: false, canEditMachine: false, canStopRelease: false, canEditMarket: false })
assert.deepEqual(planRules.resolveMrPermissions({ currentUser: '', globalAdminUsers: [''], tosManagerUsers: [''], machineSpm: '', context: 'tos' }), { canView: false, canEditTemplate: false, canEditTos: false, canEditMachine: false, canStopRelease: false, canEditMarket: false })

const publishedTemplate = { id: 'template-v1', versionNo: 'V1', status: '已发布', activities: tosActivities, createdBy: '张三', createdAt: NOW }
const templateBeforeCreate = JSON.parse(JSON.stringify(publishedTemplate))
const createdInstance = planRules.createTosMrVersionInstance({ projectId: ' project-1 ', tosVersion: ' 16.3.0.110 ', templateVersion: publishedTemplate, actor: ' 张三 ', now: NOW })
assert.deepEqual(createdInstance, { projectId: 'project-1', tosVersion: '16.3.0.110', templateVersionId: 'template-v1', activities: tosActivities, dates: {}, createdBy: '张三', createdAt: NOW, updatedBy: '张三', updatedAt: NOW })
assert.notStrictEqual(createdInstance.activities, publishedTemplate.activities)
assert.notStrictEqual(createdInstance.activities[0], publishedTemplate.activities[0])
assert.deepEqual(publishedTemplate, templateBeforeCreate)
assert.throws(() => planRules.createTosMrVersionInstance({ projectId: '', tosVersion: '16.3', templateVersion: publishedTemplate, actor: '张三', now: NOW }))
assert.throws(() => planRules.createTosMrVersionInstance({ projectId: 'p', tosVersion: ' ', templateVersion: publishedTemplate, actor: '张三', now: NOW }))
assert.throws(() => planRules.createTosMrVersionInstance({ projectId: 'p', tosVersion: '16.3', templateVersion: publishedTemplate, actor: ' ', now: NOW }))
assert.throws(() => planRules.createTosMrVersionInstance({ projectId: 'p', tosVersion: '16.3', templateVersion: { ...publishedTemplate, status: '修订中' }, actor: '张三', now: NOW }))
const gappedTemplate = {
  ...publishedTemplate,
  activities: [
    { id: 'parent-b', parentId: null, order: 5, activityName: 'B' },
    { id: 'child-b', parentId: 'parent-b', order: 9, activityName: 'B1' },
    { id: 'parent-a', parentId: null, order: 1, activityName: 'A' },
    { id: 'child-a2', parentId: 'parent-a', order: 8, activityName: 'A2' },
    { id: 'child-a1', parentId: 'parent-a', order: 2, activityName: 'A1' },
  ],
}
const gappedBeforeCreate = structuredClone(gappedTemplate)
assert.deepEqual(planRules.createTosMrVersionInstance({ projectId: 'p', tosVersion: '16.3', templateVersion: gappedTemplate, actor: '张三', now: NOW }).activities.map(row => [row.id, row.order]), [
  ['parent-a', 0], ['child-a1', 0], ['child-a2', 1], ['parent-b', 1], ['child-b', 0],
])
assert.deepEqual(gappedTemplate, gappedBeforeCreate)

assert.deepEqual(planRules.projectTosMrVerticalRows({ ...createdInstance, dates: { collect: '2026-01-01' } }).map(row => [row.number, row.depth, row.date]), [
  ['1', 0, '/'], ['1.1', 1, '2026-01-01'], ['2', 0, '/'], ['2.1', 1, ''], ['2.2', 1, ''],
])
assert.equal(planRules.projectTosMrVerticalRows({ ...createdInstance, dates: { collect: '未规范日期' } })[1].date, '未规范日期')
const logicalKey = (parentName, activityName = '') => `${encodeURIComponent(parentName)}::${encodeURIComponent(activityName)}`
assert.deepEqual(planRules.projectTosMrHorizontalColumns(tosActivities).map(group => [group.title, group.children.map(child => [child.title, child.key, child.activityId])]), [
  ['需求&修改点', [['修改点收集开始时间', logicalKey('需求&修改点', '修改点收集开始时间'), 'collect']]],
  ['版本发布', [['OTA开放验证&部署', logicalKey('版本发布', 'OTA开放验证&部署'), 'ota'], ['已改名活动', logicalKey('版本发布', '已改名活动'), 'renamed']]],
])
const delimiterActivities = [
  { id: 'parent-delimited', parentId: null, order: 0, activityName: 'A::B' }, { id: 'child-percent', parentId: 'parent-delimited', order: 0, activityName: 'C%1' },
  { id: 'parent-plain', parentId: null, order: 1, activityName: 'A' }, { id: 'child-delimited', parentId: 'parent-plain', order: 0, activityName: 'B::C%1' },
]
const delimiterColumns = planRules.projectTosMrHorizontalColumns(delimiterActivities)
assert.deepEqual(delimiterColumns.map(group => group.children[0].key), [logicalKey('A::B', 'C%1'), logicalKey('A', 'B::C%1')])
assert.notEqual(delimiterColumns[0].children[0].key, delimiterColumns[1].children[0].key)
assert.deepEqual(planRules.buildJointMrColumnSchema([], delimiterActivities).flatMap(group => group.children.map(child => child.key)), [logicalKey('A::B', 'C%1'), logicalKey('A', 'B::C%1')])

const latestActivities = [
  { id: 'a', parentId: null, order: 0, activityName: 'A' }, { id: 'x', parentId: 'a', order: 0, activityName: 'X' }, { id: 'y', parentId: 'a', order: 1, activityName: 'Y' },
]
const olderActivities = [
  { id: 'old-a', parentId: null, order: 0, activityName: 'A' }, { id: 'old-x', parentId: 'old-a', order: 0, activityName: 'X' }, { id: 'b', parentId: null, order: 1, activityName: 'B' }, { id: 'z', parentId: 'b', order: 0, activityName: 'Z' },
]
const renamedActivities = [{ id: 'new-a', parentId: null, order: 0, activityName: 'A' }, { id: 'x2', parentId: 'new-a', order: 0, activityName: 'X2' }]
const jointInstances = [
  { ...createdInstance, tosVersion: '16.3.0.110', activities: olderActivities },
  { ...createdInstance, tosVersion: '16.3.0.120', activities: renamedActivities },
]
const unionInputBefore = JSON.parse(JSON.stringify({ latestActivities, jointInstances }))
assert.deepEqual(planRules.buildJointMrColumnSchema(jointInstances, latestActivities).map(group => [group.title, group.children.map(child => [child.title, child.key])]), [
  ['A', [['X', logicalKey('A', 'X')], ['Y', logicalKey('A', 'Y')], ['X2', logicalKey('A', 'X2')]]],
  ['B', [['Z', logicalKey('B', 'Z')]]],
])
assert.deepEqual({ latestActivities, jointInstances }, unionInputBefore)

const latestDuplicateActivities = [
  { id: 'latest-a', parentId: null, order: 0, activityName: ' A ' }, { id: 'latest-x', parentId: 'latest-a', order: 0, activityName: ' X ' },
  { id: 'latest-a-duplicate', parentId: null, order: 1, activityName: 'A' }, { id: 'latest-x-duplicate', parentId: 'latest-a-duplicate', order: 0, activityName: 'X' },
]
const semanticEarlyActivities = [
  { id: 'early-a', parentId: null, order: 0, activityName: 'A' }, { id: 'early-x', parentId: 'early-a', order: 0, activityName: ' X ' }, { id: 'early-x1', parentId: 'early-a', order: 1, activityName: 'X1' },
  { id: 'early-b', parentId: null, order: 1, activityName: ' B ' }, { id: 'early-z', parentId: 'early-b', order: 0, activityName: ' Z ' },
]
const semanticLateActivities = [
  { id: 'late-a', parentId: null, order: 0, activityName: 'A' }, { id: 'late-x2', parentId: 'late-a', order: 0, activityName: 'X2' },
]
const outOfOrderInstances = [
  { ...createdInstance, tosVersion: '16.3.0.120', activities: semanticLateActivities },
  { ...createdInstance, tosVersion: '16.3.0.110', activities: semanticEarlyActivities },
]
const dedupeInputBefore = structuredClone({ latestDuplicateActivities, outOfOrderInstances })
assert.deepEqual(planRules.buildJointMrColumnSchema(outOfOrderInstances, latestDuplicateActivities).map(group => [group.title, group.children.map(child => [child.title, child.key])]), [
  ['A', [['X', logicalKey('A', 'X')], ['X1', logicalKey('A', 'X1')], ['X2', logicalKey('A', 'X2')]]],
  ['B', [['Z', logicalKey('B', 'Z')]]],
])
assert.deepEqual({ latestDuplicateActivities, outOfOrderInstances }, dedupeInputBefore)

// Joint aggregation: version intervals, matching, dynamic reconciliation, and stop-release.
const mrActivities = [
  { id: 'stage-change', parentId: null, order: 0, activityName: '需求&修改点' },
  { id: 'collect', parentId: 'stage-change', order: 0, activityName: '修改点收集开始时间' },
  { id: 'lock', parentId: 'stage-change', order: 1, activityName: '修改点锁定时间' },
  { id: 'stage-transfer', parentId: null, order: 1, activityName: '入库&自测&转测' },
  { id: 'mp-deadline', parentId: 'stage-transfer', order: 0, activityName: 'MP入库截止时间' },
  { id: 'transfer', parentId: 'stage-transfer', order: 1, activityName: '版本转测时间' },
  { id: 'stage-test', parentId: null, order: 2, activityName: '版本测试' },
  { id: 'test-start', parentId: 'stage-test', order: 0, activityName: '测试开始时间' },
  { id: 'test-complete', parentId: 'stage-test', order: 1, activityName: '测试完成时间' },
  { id: 'stage-review', parentId: null, order: 3, activityName: '版本评审' },
  { id: 'review', parentId: 'stage-review', order: 0, activityName: '评审时间' },
  { id: 'stage-release', parentId: null, order: 4, activityName: '版本发布' },
  { id: 'archive', parentId: 'stage-release', order: 0, activityName: '软件归档时间' },
  { id: 'ota', parentId: 'stage-release', order: 1, activityName: 'OTA开放验证&部署' },
]
const makeTosInstance = (tosVersion, dates, projectId = 'tos-project-16.3') => ({
  projectId, tosVersion, templateVersionId: 'template-v1', activities: mrActivities,
  dates, createdBy: '张三', createdAt: NOW, updatedBy: '张三', updatedAt: NOW,
})
const tos140 = makeTosInstance('16.3.0.140', {
  collect: '2026-06-22', lock: '2026-06-24', 'mp-deadline': '2026-06-25', transfer: '2026-06-26',
  'test-start': '2026-06-29', 'test-complete': '2026-07-03', review: '2026-07-06', archive: '2026-07-08', ota: '2026-07-11',
})
const tos145 = makeTosInstance('16.3.0.145', {
  collect: '2026-07-12', lock: '2026-07-14', 'mp-deadline': '2026-07-15', transfer: '2026-07-16',
  'test-start': '2026-07-20', 'test-complete': '2026-07-24', review: '2026-07-27', archive: '2026-07-29', ota: '2026-07-31',
})
const tos150 = makeTosInstance('16.3.0.150', {
  collect: '2026-08-01', lock: '2026-08-03', 'mp-deadline': '2026-08-04', transfer: '2026-08-05',
  'test-start': '2026-08-10', 'test-complete': '2026-08-14', review: '2026-08-17', archive: '2026-08-19', ota: '2026-08-21',
})
const intervalBefore = structuredClone(tos140)
assert.deepEqual(aggregationRules.getTosVersionInterval(tos140), { startDate: '2026-06-22', endDate: '2026-07-11' })
assert.deepEqual(tos140, intervalBefore)
assert.equal(aggregationRules.getTosVersionInterval(makeTosInstance('16.3.0.100', { collect: '', lock: 'bad', 'stage-change': '2026-01-01' })), null)
assert.equal(aggregationRules.resolveMachineTosProjectKey({ id: 'new', productType: '新品', firstSaleTosVersion: ' tOS16.3.0.140 ', currentTosVersion: '99.1' }), '16.3')
assert.equal(aggregationRules.resolveMachineTosProjectKey({ id: 'old', productType: '老品', firstSaleTosVersion: '99.1', currentTosVersion: '16.3.0.145' }), '16.3')
assert.equal(aggregationRules.resolveMachineTosProjectKey({ id: 'legacy', productType: '升级', currentTosVersion: 'tOS16.3' }), '16.3')
assert.equal(aggregationRules.resolveMachineTosProjectKey({ id: 'bad', productType: '新品', firstSaleTosVersion: 'tOS16' }), null)
assert.equal(aggregationRules.resolveMachineTosProjectKey({ id: 'unknown', productType: '技术项目', currentTosVersion: '16.3' }), null)

const level1Source = (str5Date, versionNo = 'V3') => ({
  versions: [{ id: 'v2', versionNo: 'V2', status: '已发布' }, { id: 'draft', versionNo: 'V4', status: '修订中' }, { id: 'latest', versionNo, status: '已发布' }],
  getSnapshot: id => id === 'latest' ? [
    { id: 'phase', parentId: null, taskName: '开发验证阶段', order: 0 },
    { id: 'str5', parentId: 'phase', taskName: ' STR5 ', order: 0, planEndDate: str5Date },
  ] : [{ id: 'old-str5', parentId: 'old', taskName: 'STR5', planEndDate: '2025-01-01' }],
})
assert.equal(aggregationRules.resolveLatestPublishedStr5Date(level1Source('2026-06-21')), '2026-06-21')
assert.equal(aggregationRules.resolveLatestPublishedStr5Date(level1Source('2026-02-30')), null)
assert.equal(aggregationRules.resolveLatestPublishedStr5Date({ versions: [{ id: 'd', versionNo: 'V9', status: '修订中' }], getSnapshot: () => [] }), null)

const tosProjects = [{ projectId: 'tos-project-16.3', tosProjectKey: '16.3', projectName: 'tOS16.3' }]
const machineProjects = [
  { id: 'machine-c09', projectName: 'C09', productType: '新品', firstSaleTosVersion: '16.3.0.110', spm: '张三' },
  { id: 'machine-too-new', projectName: 'NEW', productType: '老品', currentTosVersion: '16.3', spm: '李白' },
]
const stalePlan = { projectId: 'stale', tosProjectId: 'tos-project-16.3', tosVersion: '16.3.0.140', transferType: '2', dates: { transfer: '2026-01-01' }, updatedBy: '旧', updatedAt: NOW }
const validPlan = { projectId: 'machine-c09', tosProjectId: 'tos-project-16.3', tosVersion: '16.3.0.140', transferType: '2', dates: { transfer: '2026-07-02' }, updatedBy: '张三', updatedAt: NOW }
const reconcileInput = {
  today: '2026-08-29', tosProjects, tosInstances: [tos150, tos145, tos140], machineProjects,
  latestPublishedLevel1ByProjectId: { 'machine-c09': level1Source('2026-06-21'), 'machine-too-new': level1Source('2026-08-29') },
  persistedPlans: { 'stale::16.3.0.140': stalePlan, 'machine-c09::16.3.0.140': validPlan }, stopRecords: [],
}
const reconcileBefore = structuredClone({ tosProjects, tosInstances: reconcileInput.tosInstances, machineProjects, persistedPlans: reconcileInput.persistedPlans })
const reconciled = aggregationRules.reconcileJointMachinePlans(reconcileInput)
assert.deepEqual(reconciled.rows.map(row => row.key), [
  'tos-project-16.3::16.3.0.140::reference', 'machine-c09::16.3.0.140',
  'tos-project-16.3::16.3.0.145::reference', 'machine-c09::16.3.0.145',
  'tos-project-16.3::16.3.0.150::reference', 'machine-c09::16.3.0.150',
])
assert.deepEqual(Object.keys(reconciled.persistedPlans), ['machine-c09::16.3.0.140', 'machine-c09::16.3.0.145', 'machine-c09::16.3.0.150'])
assert.deepEqual(reconciled.persistedPlans['machine-c09::16.3.0.140'].dates, { transfer: '2026-07-02' })
assert.deepEqual(reconciled.persistedPlans['machine-c09::16.3.0.145'].transferType, '1')
assert.deepEqual(reconciled.persistedPlans['machine-c09::16.3.0.145'].dates, {})
assert.deepEqual({ tosProjects, tosInstances: reconcileInput.tosInstances, machineProjects, persistedPlans: reconcileInput.persistedPlans }, reconcileBefore)
const persistedBeforeInvalidToday = structuredClone(reconcileInput.persistedPlans)
assert.throws(() => aggregationRules.reconcileJointMachinePlans({ ...reconcileInput, today: '2026-02-30' }), /当前日期格式无效/)
assert.throws(() => aggregationRules.reconcileJointMachinePlans({ ...reconcileInput, today: '2026\/08\/29' }), /当前日期格式无效/)
assert.deepEqual(reconcileInput.persistedPlans, persistedBeforeInvalidToday)

// Semantic aliases share one canonical identity; the first input instance is the stable winner.
assert.equal(aggregationRules.canonicalizeTosMrVersion(' 016.03.00.001.0 '), '16.3.0.1')
assert.equal(aggregationRules.canonicalizeTosMrVersion('16.3.0.1'), '16.3.0.1')
assert.equal(aggregationRules.canonicalizeTosMrVersion('16.3.1'), null)
assert.equal(aggregationRules.canonicalizeTosMrVersion('invalid'), null)
const aliasWinner = makeTosInstance('016.03.00.001.0', { collect: '2026-06-22', ota: '2026-07-11' })
const aliasDuplicate = makeTosInstance('16.3.0.1', { collect: '2020-01-01', ota: '2020-01-02' })
const malformedInstance = makeTosInstance('unknown', { collect: '2026-06-22', ota: '2026-07-11' })
const aliasReconciled = aggregationRules.reconcileJointMachinePlans({
  ...reconcileInput,
  tosInstances: [aliasWinner, aliasDuplicate, malformedInstance],
  machineProjects: [machineProjects[0]],
  latestPublishedLevel1ByProjectId: { 'machine-c09': level1Source('2026-06-21') },
  persistedPlans: {
    'z-alias': { ...validPlan, tosVersion: '16.3.0.1.0', dates: { transfer: '2026-07-02' } },
    'a-canonical': { ...validPlan, tosVersion: '16.3.0.1', dates: { transfer: 'stable-winner' } },
  },
})
assert.deepEqual(aliasReconciled.rows.map(row => row.key), ['tos-project-16.3::16.3.0.1::reference', 'machine-c09::16.3.0.1'])
assert.deepEqual(Object.keys(aliasReconciled.persistedPlans), ['machine-c09::16.3.0.1'])
assert.equal(aliasReconciled.persistedPlans['machine-c09::16.3.0.1'].tosVersion, '16.3.0.1')
assert.equal(aliasReconciled.persistedPlans['machine-c09::16.3.0.1'].dates.transfer, 'stable-winner')
assert.equal(aliasReconciled.rows[0].instance.dates.collect, '2026-06-22')

const tos101 = makeTosInstance('16.10.0.1', { collect: '2026-09-01', ota: '2026-09-02' }, 'tos-project-16.10')
const crossProjectRows = aggregationRules.reconcileJointMachinePlans({
  today: '2026-08-29',
  tosProjects: [
    { projectId: 'tos-project-16.10', tosProjectKey: '16.10', projectName: 'tOS16.10' },
    { projectId: 'tos-project-16.3-z', tosProjectKey: '16.3', projectName: 'tOS16.3-Z' },
    { projectId: 'tos-project-16.3-a', tosProjectKey: '16.3', projectName: 'tOS16.3-A' },
  ],
  tosInstances: [tos101, { ...makeTosInstance('16.3.0.2', { collect: '2026-01-01', ota: '2026-01-02' }), projectId: 'tos-project-16.3-z' }, { ...makeTosInstance('16.3.0.1', { collect: '2026-01-01', ota: '2026-01-02' }), projectId: 'tos-project-16.3-a' }],
  machineProjects: [], latestPublishedLevel1ByProjectId: {}, persistedPlans: {}, stopRecords: [],
}).rows.map(row => row.key)
assert.deepEqual(crossProjectRows, [
  'tos-project-16.3-a::16.3.0.1::reference',
  'tos-project-16.3-z::16.3.0.2::reference',
  'tos-project-16.10::16.10.0.1::reference',
])

// Inclusive lower and upper interval boundaries both select the matching version.
assert.equal(aggregationRules.reconcileJointMachinePlans({ ...reconcileInput, latestPublishedLevel1ByProjectId: { 'machine-c09': level1Source('2026-06-21') }, machineProjects: [machineProjects[0]], persistedPlans: {} }).persistedPlans['machine-c09::16.3.0.140'].tosVersion, '16.3.0.140')
assert.equal(aggregationRules.reconcileJointMachinePlans({ ...reconcileInput, latestPublishedLevel1ByProjectId: { 'machine-c09': level1Source('2026-07-10') }, machineProjects: [machineProjects[0]], persistedPlans: {} }).persistedPlans['machine-c09::16.3.0.140'].tosVersion, '16.3.0.140')
// Source-date movement removes no-longer-eligible persisted rows and their dates.
assert.deepEqual(aggregationRules.reconcileJointMachinePlans({
  ...reconcileInput,
  latestPublishedLevel1ByProjectId: { ...reconcileInput.latestPublishedLevel1ByProjectId, 'machine-c09': level1Source('2026-08-22') },
}).persistedPlans, {})
// A row that remains eligible retains even invalid dates for UI validation.
assert.equal(aggregationRules.reconcileJointMachinePlans({ ...reconcileInput, persistedPlans: { 'machine-c09::16.3.0.140': { ...validPlan, dates: { transfer: 'malformed' } } } }).persistedPlans['machine-c09::16.3.0.140'].dates.transfer, 'malformed')

const stopRecord = { id: 'stop-1', projectId: 'machine-c09', projectName: 'C09', stopDate: '2026-07-12', operator: '张三', operatedAt: NOW }
const stopped = aggregationRules.applyStopRelease({ persistedPlans: reconciled.persistedPlans, tosInstances: [tos140, tos145, tos150], stopRecords: [], record: stopRecord })
assert.deepEqual(stopped.removedPlanKeys, ['machine-c09::16.3.0.150'])
assert.deepEqual(Object.keys(stopped.persistedPlans), ['machine-c09::16.3.0.140', 'machine-c09::16.3.0.145'])
assert.deepEqual(stopped.stopRecords, [stopRecord])
assert.notStrictEqual(stopped.stopRecords[0], stopRecord)
assert.equal(aggregationRules.isPlanExcludedByStopRecord({ plan: reconciled.persistedPlans['machine-c09::16.3.0.150'], tosInstances: [tos150], stopRecords: [stopRecord] }), true)
assert.equal(aggregationRules.isPlanExcludedByStopRecord({ plan: reconciled.persistedPlans['machine-c09::16.3.0.145'], tosInstances: [tos145], stopRecords: [stopRecord] }), false)
assert.equal(aggregationRules.isPlanExcludedByStopRecord({ plan: { ...validPlan, tosVersion: '16.3.0.999' }, tosInstances: [makeTosInstance('16.3.0.999', { lock: '2027-01-01' })], stopRecords: [stopRecord] }), false)
const reconciledStopped = aggregationRules.reconcileJointMachinePlans({ ...reconcileInput, stopRecords: [stopRecord] })
assert.equal(reconciledStopped.persistedPlans['machine-c09::16.3.0.150'], undefined)
const stoppedInputsBefore = structuredClone({ persistedPlans: reconciled.persistedPlans, tosInstances: [tos140, tos145, tos150], stopRecords: [] })
assert.throws(() => aggregationRules.applyStopRelease({ persistedPlans: reconciled.persistedPlans, tosInstances: [tos140], stopRecords: [], record: { ...stopRecord, stopDate: '2026-02-30' } }), /停止发版日期格式无效/)
assert.throws(() => aggregationRules.applyStopRelease({ persistedPlans: reconciled.persistedPlans, tosInstances: [tos140], stopRecords: [], record: { ...stopRecord, projectName: '' } }), /停止发版项目名称不能为空/)
assert.deepEqual({ persistedPlans: reconciled.persistedPlans, tosInstances: [tos140, tos145, tos150], stopRecords: [] }, stoppedInputsBefore)
const exactDuplicateStop = aggregationRules.applyStopRelease({ persistedPlans: stopped.persistedPlans, tosInstances: [tos140, tos145, tos150], stopRecords: stopped.stopRecords, record: { ...stopRecord } })
assert.deepEqual(exactDuplicateStop.stopRecords, [stopRecord])
assert.throws(() => aggregationRules.applyStopRelease({ persistedPlans: stopped.persistedPlans, tosInstances: [tos140], stopRecords: stopped.stopRecords, record: { ...stopRecord, projectId: 'other' } }), /停止发版记录ID已存在/)
const secondProjectStop = aggregationRules.applyStopRelease({ persistedPlans: stopped.persistedPlans, tosInstances: [tos140, tos145, tos150], stopRecords: stopped.stopRecords, record: { ...stopRecord, id: 'stop-2', stopDate: '2026-08-01' } })
assert.deepEqual(secondProjectStop.stopRecords, [stopRecord])
assert.equal(aggregationRules.isPlanExcludedByStopRecord({ plan: { ...validPlan, tosVersion: '016.03.00.150.0' }, tosInstances: [tos150], stopRecords: [stopRecord] }), true)

// Joint and market date validation.
const machineRow = (projectId, tosVersion, transferType, dates) => ({ projectId, tosProjectId: 'tos-project-16.3', tosVersion, transferType, dates, updatedBy: projectId, updatedAt: NOW })
const errorsFor = (rows, instances = [tos140, tos145, tos150]) => dateRules.validateJointMachineRows({ tosInstances: instances, machinePlans: rows })
const immutableValidationRows = [machineRow('immutable', '16.3.0.140', '1', { transfer: 'bad' })]
const immutableValidationBefore = structuredClone(immutableValidationRows)
dateRules.validateJointMachineRows({ tosInstances: [tos140], machinePlans: immutableValidationRows })
assert.deepEqual(immutableValidationRows, immutableValidationBefore)
assert.deepEqual(errorsFor([machineRow('m1', '16.3.0.140', '1', { collect: '2026-06-23', lock: '2026-06-25' })]).map(error => error.message), [
  '修改点收集开始时间需与tOS项目时间保持一致', '修改点锁定时间需与tOS项目时间保持一致',
])
assert.deepEqual(errorsFor([machineRow('m1', '16.3.0.140', '1', { 'mp-deadline': '2026-06-26' })]).map(error => error.message), ['整机产品项目的MP入库截止时间不得晚于tOS项目时间'])
assert.deepEqual(errorsFor([machineRow('m1', '16.3.0.140', '1', { transfer: '2026-06-27' })]).map(error => error.message), ['版本转测时间应等于tOS版本转测时间'])
assert.deepEqual(errorsFor([machineRow('m1', '16.3.0.140', '2', { transfer: '2026-07-02' }), machineRow('m2', '16.3.0.140', '2', { transfer: '2026-07-03' })]).filter(error => error.activityName === '版本转测时间').map(error => error.message), [
  '同一1+N转测类型的版本转测时间需保持一致', '同一1+N转测类型的版本转测时间需保持一致',
])
assert.ok(errorsFor([machineRow('base', '16.3.0.140', '1', { transfer: '2026-06-26' }), machineRow('m2', '16.3.0.140', '2', { transfer: '2026-07-02' })]).some(error => error.message === '版本转测时间需晚于上一个1+N转测类型至少1周'))
assert.equal(errorsFor([machineRow('base', '16.3.0.140', '1', { transfer: '2026-06-26' }), machineRow('m2', '16.3.0.140', '2', { transfer: '2026-07-03' })]).some(error => error.message.includes('至少1周')), false)
// Type gaps compare to the greatest existing smaller numeric type (3, not 1).
assert.ok(errorsFor([machineRow('one', '16.3.0.140', '1', { transfer: '2026-06-26' }), machineRow('three', '16.3.0.140', '3', { transfer: '2026-07-10' }), machineRow('five', '16.3.0.140', '5', { transfer: '2026-07-16' })]).some(error => error.rowKey === 'five::16.3.0.140' && error.message === '版本转测时间需晚于上一个1+N转测类型至少1周'))
assert.ok(errorsFor([machineRow('m', '16.3.0.140', '2', { transfer: '2026-07-21' })]).some(error => error.message === '版本转测时间需晚于上一个1+N转测类型至少1周'))

const boundedFields = ['测试开始时间', '测试完成时间', '评审时间', '软件归档时间', 'OTA开放验证&部署']
const idByName = Object.fromEntries(mrActivities.filter(activity => activity.parentId).map(activity => [activity.activityName, activity.id]))
for (const name of boundedFields) {
  const id = idByName[name]
  assert.ok(errorsFor([machineRow('m', '16.3.0.140', '1', { [id]: '2026-01-01' })]).some(error => error.message === `${name}不早于tOS项目时间，可与tOS项目保持一致，且不能超过下一个tOS版本的测试开始时间`))
  assert.ok(errorsFor([machineRow('m', '16.3.0.140', '1', { [id]: '2026-07-21' })]).some(error => error.message === `${name}不早于tOS项目时间，可与tOS项目保持一致，且不能超过下一个tOS版本的测试开始时间`))
  const previousDate = '2026-07-01'
  assert.ok(errorsFor([machineRow('prev', '16.3.0.140', '3', { [id]: previousDate }), machineRow('current', '16.3.0.140', '5', { [id]: '2026-07-07' })]).some(error => error.message === `${name}需晚于上一个1+N转测类型至少1周，且不能超过下一个tOS版本的${name}`))
}
// Last tOS version has no next upper bound, while missing references skip comparison.
assert.deepEqual(errorsFor([machineRow('last', '16.3.0.150', '1', { 'test-start': '2027-01-01' })]).filter(error => error.activityName === '测试开始时间'), [])
assert.deepEqual(errorsFor([machineRow('missing-ref', '16.3.0.999', '1', { transfer: '2027-01-01' })], [makeTosInstance('16.3.0.999', {})]), [])
const malformedErrors = errorsFor([machineRow('bad', '16.3.0.140', '1', { transfer: '2026-02-30', review: 'not-a-date' })])
assert.deepEqual(malformedErrors.map(error => error.message), ['版本转测时间日期格式不正确', '评审时间日期格式不正确'])
const aliasValidationErrors = errorsFor([
  machineRow('alias-a', '016.03.00.140.0', '2', { transfer: '2026-07-02' }),
  machineRow('alias-b', '16.3.0.140', '2', { transfer: '2026-07-03' }),
])
assert.equal(aliasValidationErrors.filter(error => error.message === '同一1+N转测类型的版本转测时间需保持一致').length, 2)

const naSource = machineRow('na', '16.3.0.140', 'N/A', { transfer: '2026-01-01' })
const clearedNa = dateRules.clearDatesForNa(naSource)
assert.deepEqual(clearedNa.dates, {})
assert.deepEqual(naSource.dates, { transfer: '2026-01-01' })
assert.notStrictEqual(clearedNa, naSource)
assert.deepEqual(dateRules.validateMachineMarketDate({ value: '2026-07-10', mainValue: '', activityId: 'test-start', activityName: '测试开始时间' }), ['主市场对应时间未填写，当前市场不可填写'])
assert.deepEqual(dateRules.validateMachineMarketDate({ value: '2026-07-12', mainValue: '2026-07-11', activityId: 'test-start', activityName: '测试开始时间' }), ['非主市场时间不得晚于主市场对应时间'])
assert.deepEqual(dateRules.validateMachineMarketDate({ value: '', mainValue: '2026-07-11', activityId: 'test-start', activityName: '测试开始时间' }), [])
assert.deepEqual(dateRules.validateMachineMarketDate({ value: 'bad', mainValue: '2026-07-11', activityId: 'test-start', activityName: '测试开始时间' }), ['测试开始时间日期格式不正确'])
const grouped = dateRules.groupMrErrorsByRow([
  { rowKey: 'r2', activityId: 'a', activityName: 'A', message: 'E2' },
  { rowKey: 'r1', activityId: 'b', activityName: 'B', message: 'E1' },
  { rowKey: 'r2', activityId: 'a', activityName: 'A', message: 'E2' },
])
assert.deepEqual(grouped, {
  r2: [{ rowKey: 'r2', activityId: 'a', activityName: 'A', message: 'E2' }],
  r1: [{ rowKey: 'r1', activityId: 'b', activityName: 'B', message: 'E1' }],
})

// Read-only adapters: select only the latest published L1 source from the effective scope.
const adapterFallbackVersions = [
  { id: 'fallback-published', versionNo: 'V1', status: '已发布' },
]
const tosAdapterProject = {
  id: 'tos-adapter', name: 'tOS16.3', type: 'tOS版本项目', status: '在研', progress: 0,
  leader: '李白', markets: [], androidVersion: '', chipPlatform: '', spm: '', updatedAt: '',
  productLine: 'tOS', tosVersion: 'tOS16.3', planStartDate: '', planEndDate: '', developCycle: 0,
  healthStatus: 'normal', versionType: 'Slim', versionTypes: ['Slim', 'Full'],
  fieldValues: { tosVersionProjectManager: [' 李白 ', '张三', '李白', ''] },
}
const tosTypeRows = [
  { id: 'full', type: 'Full', isMain: true, followsMain: false },
  { id: 'slim', type: 'Slim', isMain: false, followsMain: true },
]
const tosVersionsByKey = {
  'project::tos-adapter::tos-type::Full::level1::versions': [
    { id: 'tos-v5-draft', versionNo: 'V5', status: '修订中' },
    { id: 'tos-v2', versionNo: 'V2', status: '已发布' },
    { id: 'tos-v4', versionNo: 'V4', status: '已发布' },
  ],
  'project::tos-adapter::tos-type::Slim::level1::versions': [
    { id: 'slim-v99', versionNo: 'V99', status: '已发布' },
  ],
}
const tosPublishedSnapshots = {
  'project::tos-adapter::tos-type::Full::level1::tos-v2::snapshot': [
    { id: 'tos-old', taskName: 'STR5', planEndDate: '2025-01-01' },
  ],
  'project::tos-adapter::tos-type::Full::level1::tos-v4::snapshot': [
    { id: 'tos-stage', parentId: null, taskName: '上市迭代阶段', order: 0 },
    { id: 'tos-node', stableId: 'tos-node-stable', parentId: 'tos-stage', taskName: '16.3.0.140', order: 1, planStartDate: new Date('2026-01-01T16:00:00.000Z'), planEndDate: '2026-01-02T23:30:00-05:00' },
    { id: 'tos-invalid', parentId: 'tos-stage', taskName: '16.3.0.145', order: 2, planStartDate: '2026-02-30', planEndDate: '2026/03/01' },
  ],
}
const selectedTosSource = adapter.selectLatestPublishedTosLevel1({
  project: tosAdapterProject,
  tosTypeRows,
  tosTypeVersionsByKey: tosVersionsByKey,
  publishedSnapshots: tosPublishedSnapshots,
  fallbackVersions: adapterFallbackVersions,
})
assert.equal(selectedTosSource.versionId, 'tos-v4')
assert.equal(selectedTosSource.versionNo, 'V4')
assert.deepEqual(selectedTosSource.tasks.map(task => [task.id, task.stableId, task.planStartDate, task.planEndDate]), [
  ['tos-stage', undefined, '', ''],
  ['tos-node', 'tos-node-stable', '2026-01-02', '2026-01-03'],
  ['tos-invalid', undefined, '', ''],
])
assert.deepEqual(selectedTosSource.getSnapshot('tos-v4'), selectedTosSource.tasks)
assert.notStrictEqual(selectedTosSource.getSnapshot('tos-v4'), selectedTosSource.tasks)
assert.equal(adapter.selectLatestPublishedTosLevel1({
  project: tosAdapterProject,
  tosTypeRows,
  tosTypeVersionsByKey: {
    'project::tos-adapter::tos-type::Full::level1::versions': [{ id: 'draft-only', versionNo: 'V9', status: '修订中' }],
  },
  publishedSnapshots: tosPublishedSnapshots,
  fallbackVersions: adapterFallbackVersions,
}), null)

const machineAdapterProject = {
  id: 'machine-adapter', name: 'X6877-D8400_H991', type: '整机产品项目', status: '在研', progress: 0,
  leader: '张三', markets: ['OP', 'RU'], androidVersion: '', chipPlatform: 'MTK', spm: '李白', updatedAt: '',
  productLine: 'NOTE', tosVersion: 'tOS16.3', planStartDate: '', planEndDate: '', developCycle: 0,
  healthStatus: 'normal', productType: '新品', firstSaleTosVersion: '16.3.0.110', cpu: 'MT6877',
}
const machineMarketRows = [
  { id: 'ru', market: 'RU', isMain: false, followsMain: false, isMadaControlled: '否' },
  { id: 'op', market: 'OP', isMain: true, followsMain: false, isMadaControlled: '否' },
  { id: 'in', market: 'IN', isMain: false, followsMain: false, isMadaControlled: '是' },
]
const machineVersionsByKey = {
  'project::machine-adapter::OP::level1::versions': [
    { id: 'machine-v4-draft', versionNo: 'V4', status: '修订中' },
    { id: 'machine-v1', versionNo: 'V1', status: '已发布' },
    { id: 'machine-v3', versionNo: 'V3', status: '已发布' },
  ],
  'project::machine-adapter::RU::level1::versions': [
    { id: 'ru-v99', versionNo: 'V99', status: '已发布' },
  ],
}
const machinePublishedSnapshots = {
  'project::machine-adapter::OP::level1::machine-v1': [{ id: 'old', taskName: 'STR5', planEndDate: '2024-01-01' }],
  'project::machine-adapter::OP::level1::machine-v3': [
    { id: 'machine-stage', parentId: null, taskName: '开发验证阶段', order: 0 },
    { id: 'machine-str5', stableId: 'ms-str5', parentId: 'machine-stage', taskName: 'STR5', order: 1, planStartDate: 'bad', planEndDate: '2026-05-15T00:30:00+08:00' },
  ],
  'project::machine-adapter::RU::level1::ru-v99': [{ id: 'ru-str5', taskName: 'STR5', planEndDate: '2099-01-01' }],
}
const selectedMachineSource = adapter.selectLatestPublishedMachineLevel1({
  project: machineAdapterProject,
  marketRows: machineMarketRows,
  marketVersionsByKey: machineVersionsByKey,
  publishedSnapshots: machinePublishedSnapshots,
  fallbackVersions: adapterFallbackVersions,
})
assert.equal(selectedMachineSource.versionId, 'machine-v3')
assert.equal(selectedMachineSource.tasks.find(row => row.taskName === 'STR5').planEndDate, '2026-05-15')
assert.equal(selectedMachineSource.tasks.find(row => row.taskName === 'STR5').planStartDate, '')
assert.equal(adapter.selectLatestPublishedMachineLevel1({
  project: machineAdapterProject,
  marketRows: machineMarketRows,
  marketVersionsByKey: { 'project::machine-adapter::OP::level1::versions': [{ id: 'draft', versionNo: 'V8', status: '修订中' }] },
  publishedSnapshots: machinePublishedSnapshots,
  fallbackVersions: adapterFallbackVersions,
}), null)

assert.deepEqual(adapter.projectMachineMrMetadata(machineAdapterProject, machineMarketRows), {
  projectName: 'X6877-D8400_H991',
  marketName: 'OP',
  productLine: 'NOTE',
  spm: '李白',
  isMada: '是',
  socPlatform: 'MT6877',
  packageMode: '/',
})
assert.equal(adapter.projectMachineMrMetadata(machineAdapterProject, machineMarketRows.map(row => ({ ...row, isMadaControlled: '否' }))).isMada, '否')
assert.deepEqual(adapter.getTosManagerUsers(tosAdapterProject), ['李白', '张三'])
assert.deepEqual(adapter.getTosManagerUsers({ ...tosAdapterProject, fieldValues: {}, versionFiveRoles: undefined, responsiblePersons: undefined, leader: '' }), [])

const adapterInput = {
  projects: [machineAdapterProject, tosAdapterProject],
  marketConfigsByProjectId: { 'machine-adapter': machineMarketRows },
  tosTypeConfigsByProjectId: { 'tos-adapter': tosTypeRows },
  marketVersionsByKey: machineVersionsByKey,
  tosTypeVersionsByKey: tosVersionsByKey,
  publishedSnapshots: { ...tosPublishedSnapshots, ...machinePublishedSnapshots },
  fallbackVersions: adapterFallbackVersions,
}
const adapterInputBefore = structuredClone(adapterInput)
const aggregationSources = adapter.buildMrAggregationSources(adapterInput)
assert.deepEqual(aggregationSources.tosProjects, [
  { projectId: 'tos-adapter', tosProjectKey: '16.3', projectName: 'tOS16.3' },
])
assert.deepEqual(aggregationSources.machineProjects, [
  { id: 'machine-adapter', projectName: 'X6877-D8400_H991', productType: '新品', firstSaleTosVersion: '16.3.0.110', currentTosVersion: '16.3', spm: '李白' },
])
const legacyReferenceSources = adapter.buildMrAggregationSources({
  ...adapterInput,
  projects: [{ ...machineAdapterProject, firstSaleTosVersionId: 'tos-16-3', currentTosVersionId: 'tos-17-1' }],
})
assert.equal(legacyReferenceSources.machineProjects[0].firstSaleTosVersion, '16.3')
assert.equal(legacyReferenceSources.machineProjects[0].currentTosVersion, '17.1')
assert.deepEqual(Object.keys(aggregationSources.latestPublishedLevel1ByProjectId), ['machine-adapter', 'tos-adapter'])
assert.deepEqual(aggregationSources.machineMetadataByProjectId['machine-adapter'], adapter.projectMachineMrMetadata(machineAdapterProject, machineMarketRows))
assert.deepEqual(aggregationSources.tosManagerUsersByProjectId, { 'tos-adapter': ['李白', '张三'] })
assert.deepEqual(adapterInput, adapterInputBefore)
const rebuiltAggregationSources = adapter.buildMrAggregationSources(adapterInput)
assert.deepEqual(JSON.parse(JSON.stringify(rebuiltAggregationSources)), JSON.parse(JSON.stringify(aggregationSources)))
assert.notStrictEqual(rebuiltAggregationSources.machineProjects[0], aggregationSources.machineProjects[0])
aggregationSources.latestPublishedLevel1ByProjectId['machine-adapter'].tasks[0].taskName = 'mutated output'
assert.equal(machinePublishedSnapshots['project::machine-adapter::OP::level1::machine-v3'][0].taskName, '开发验证阶段')

const noPublishedSources = adapter.buildMrAggregationSources({
  ...adapterInput,
  tosTypeVersionsByKey: { 'project::tos-adapter::tos-type::Full::level1::versions': [{ id: 'tos-draft', versionNo: 'V8', status: '修订中' }] },
  marketVersionsByKey: { 'project::machine-adapter::OP::level1::versions': [{ id: 'machine-draft', versionNo: 'V8', status: '修订中' }] },
})
assert.deepEqual(noPublishedSources.latestPublishedLevel1ByProjectId, {})
