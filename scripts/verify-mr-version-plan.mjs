import assert from 'node:assert/strict'
import { loadTypeScriptModule, projectRoot } from './lib/source-contract.mjs'

const root = projectRoot(import.meta.url)
const templateRules = loadTypeScriptModule(root, 'src/lib/mrTemplateRules.ts')
const templateMocks = loadTypeScriptModule(root, 'src/data/mrVersionPlanMocks.ts')

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
