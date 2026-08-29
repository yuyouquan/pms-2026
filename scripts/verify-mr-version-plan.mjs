import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot, readSource } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const templateRules = loadTypeScriptModule(root, 'src/lib/mrTemplateRules.ts')
const templateMocks = loadTypeScriptModule(root, 'src/data/mrVersionPlanMocks.ts')
const templateMocksSource = readSource(root, 'src/data/mrVersionPlanMocks.ts')
const planRules = loadTypeScriptModule(root, 'src/lib/mrVersionPlanRules.ts')

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

const tosLevel1Tasks = [
  { id: 'maintenance-id', stableId: 'maintenance-stable', parentId: null, taskName: ' 维护阶段 ', order: 2 },
  { id: '上市-id', stableId: '上市-stable', parentId: null, taskName: ' 上市迭代阶段 ', order: 1 },
  { id: 'child-115', parentId: '上市-stable', taskName: ' 16.3.0.115 ', order: 2, planStartDate: new Date('2026-01-02T00:00:00.000Z'), planEndDate: '2026-01-03' },
  { id: 'child-110', parentId: '上市-id', taskName: '16.3.0.110', order: 1, planStartDate: '2026-01-01', planEndDate: '2026-01-02' },
  { id: 'child-120', parentId: 'maintenance-id', taskName: '16.3.0.120', order: 1, planStartDate: 'invalid', planEndDate: '2026-01-04' },
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
assert.equal(candidates[1].planStartDate, '2026-01-02')
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
