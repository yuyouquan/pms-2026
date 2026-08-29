import type {
  JointMachinePlan,
  MrMarketOverride,
  MrPlanViewMode,
  MrStopReleaseRecord,
  MrTemplateActivity,
  MrTemplateChangeLog,
  MrTemplateVersion,
  TosMrVersionInstance,
} from '@/types/mrVersionPlan'

const defaultMrTemplateActivities: MrTemplateActivity[] = [
  { id: 'mr-stage-requirements', parentId: null, order: 0, activityName: '需求&修改点' },
  { id: 'mr-node-change-collection', parentId: 'mr-stage-requirements', order: 0, activityName: '修改点收集开始时间' },
  { id: 'mr-node-change-lock', parentId: 'mr-stage-requirements', order: 1, activityName: '修改点锁定时间' },
  { id: 'mr-stage-intake-transfer', parentId: null, order: 1, activityName: '入库&自测&转测' },
  { id: 'mr-node-mp-intake-start', parentId: 'mr-stage-intake-transfer', order: 0, activityName: 'MP入库开始时间' },
  { id: 'mr-node-mp-intake-deadline', parentId: 'mr-stage-intake-transfer', order: 1, activityName: 'MP入库截止时间' },
  { id: 'mr-node-version-transfer', parentId: 'mr-stage-intake-transfer', order: 2, activityName: '版本转测时间' },
  { id: 'mr-stage-testing', parentId: null, order: 2, activityName: '版本测试' },
  { id: 'mr-node-test-start', parentId: 'mr-stage-testing', order: 0, activityName: '测试开始时间' },
  { id: 'mr-node-test-complete', parentId: 'mr-stage-testing', order: 1, activityName: '测试完成时间' },
  { id: 'mr-stage-review', parentId: null, order: 3, activityName: '版本评审' },
  { id: 'mr-node-review', parentId: 'mr-stage-review', order: 0, activityName: '评审时间' },
  { id: 'mr-stage-release', parentId: null, order: 4, activityName: '版本发布' },
  { id: 'mr-node-archive', parentId: 'mr-stage-release', order: 0, activityName: '软件归档时间' },
  { id: 'mr-node-ota-deploy', parentId: 'mr-stage-release', order: 1, activityName: 'OTA开放验证&部署' },
]

export const DEFAULT_MR_TEMPLATE_ACTIVITIES: readonly Readonly<MrTemplateActivity>[] = Object.freeze(
  defaultMrTemplateActivities.map(activity => Object.freeze(activity)),
)

export function createInitialMrTemplateVersions(): MrTemplateVersion[] {
  return [{
    id: 'mr-template-v1',
    versionNo: 'V1',
    status: '已发布',
    activities: DEFAULT_MR_TEMPLATE_ACTIVITIES.map(activity => ({ ...activity })),
    createdBy: '系统管理员',
    createdAt: '2026-08-29T00:00:00.000Z',
    publishedAt: '2026-08-29T00:00:00.000Z',
  }]
}

const MR_ACCEPTANCE_CREATED_AT = '2026-08-29T00:00:00.000Z'

const MR_ACCEPTANCE_DATES: Record<string, Record<string, string>> = {
  '16.3.0.140': {
    'mr-node-change-collection': '2026-05-16',
    'mr-node-change-lock': '2026-05-18',
    'mr-node-mp-intake-start': '2026-05-19',
    'mr-node-mp-intake-deadline': '2026-05-20',
    'mr-node-version-transfer': '2026-05-22',
    'mr-node-test-start': '2026-05-23',
    'mr-node-test-complete': '2026-06-01',
    'mr-node-review': '2026-06-03',
    'mr-node-archive': '2026-06-05',
    'mr-node-ota-deploy': '2026-06-15',
  },
  '16.3.0.145': {
    'mr-node-change-collection': '2026-06-16',
    'mr-node-change-lock': '2026-06-18',
    'mr-node-mp-intake-start': '2026-06-19',
    'mr-node-mp-intake-deadline': '2026-06-20',
    'mr-node-version-transfer': '2026-06-22',
    'mr-node-test-start': '2026-06-23',
    'mr-node-test-complete': '2026-07-01',
    'mr-node-review': '2026-07-03',
    'mr-node-archive': '2026-07-05',
    'mr-node-ota-deploy': '2026-07-15',
  },
}

const cloneActivities = () => DEFAULT_MR_TEMPLATE_ACTIVITIES.map(activity => ({ ...activity }))
const cloneDates = (dates: Readonly<Record<string, string>>) => ({ ...dates })

function createTosInstance(tosVersion: string): TosMrVersionInstance {
  return {
    projectId: '19',
    tosVersion,
    templateVersionId: 'mr-template-v1',
    activities: cloneActivities(),
    dates: cloneDates(MR_ACCEPTANCE_DATES[tosVersion]),
    createdBy: '张三',
    createdAt: MR_ACCEPTANCE_CREATED_AT,
    updatedBy: '张三',
    updatedAt: MR_ACCEPTANCE_CREATED_AT,
  }
}

function createMachinePlan(
  projectId: string,
  transferType: JointMachinePlan['transferType'],
  dates: Readonly<Record<string, string>>,
  actor: string,
): JointMachinePlan {
  return {
    projectId,
    tosProjectId: '19',
    tosVersion: '16.3.0.140',
    transferType,
    dates: cloneDates(dates),
    updatedBy: actor,
    updatedAt: MR_ACCEPTANCE_CREATED_AT,
  }
}

export interface InitialMrVersionPlanStateSeed {
  templateVersions: MrTemplateVersion[]
  currentTemplateVersionId: string
  templateHistory: MrTemplateChangeLog[]
  tosInstancesByProjectId: Record<string, TosMrVersionInstance[]>
  machinePlansByKey: Record<string, JointMachinePlan>
  marketOverridesByKey: Record<string, MrMarketOverride>
  stopReleaseRecords: MrStopReleaseRecord[]
  viewModeByScope: Record<string, MrPlanViewMode>
}

/** Fresh, deterministic acceptance state; callers may mutate it without sharing references. */
export function createInitialMrVersionPlanState(): InitialMrVersionPlanStateSeed {
  const templateVersions = createInitialMrTemplateVersions()
  const tosInstances = ['16.3.0.140', '16.3.0.145'].map(createTosInstance)
  const validTypeOne = createMachinePlan('1', '1', MR_ACCEPTANCE_DATES['16.3.0.140'], '王五')
  const invalidTypeTwo = createMachinePlan('3', '2', {
    ...MR_ACCEPTANCE_DATES['16.3.0.140'],
    'mr-node-mp-intake-deadline': '2026-05-25',
    'mr-node-version-transfer': '2026-05-29',
    'mr-node-test-start': '2026-05-30',
    'mr-node-test-complete': '2026-06-08',
    'mr-node-review': '2026-06-10',
    'mr-node-archive': '2026-06-12',
    'mr-node-ota-deploy': '2026-06-15',
  }, '赵六')
  return {
    templateVersions,
    currentTemplateVersionId: templateVersions[0].id,
    templateHistory: [],
    tosInstancesByProjectId: { '19': tosInstances },
    machinePlansByKey: {
      '1::16.3.0.140': validTypeOne,
      '3::16.3.0.140': invalidTypeTwo,
    },
    marketOverridesByKey: {
      '1::16.3.0.140::TR': {
        projectId: '1',
        tosVersion: '16.3.0.140',
        market: 'TR',
        mainMarket: 'OP',
        dates: { 'mr-node-test-start': '2026-05-23' },
      },
    },
    stopReleaseRecords: [],
    viewModeByScope: {},
  }
}

const publishedVersion = (id: string) => [{ id, versionNo: 'V1', status: '已发布' }]
const machineSnapshot = () => [
  { id: 'machine-stage-validation', stableId: 'machine-stage-validation', parentId: null, order: 0, taskName: '验证阶段' },
  { id: 'machine-ms-str5', stableId: 'machine-ms-str5', parentId: 'machine-stage-validation', order: 0, taskName: 'STR5', planEndDate: '2026-05-15' },
]
const tosSnapshot = () => [
  { id: 'tos-stage-launch-iteration', stableId: 'tos-stage-launch-iteration', parentId: null, order: 0, taskName: '上市迭代阶段' },
  { id: 'tos-mr-140', stableId: 'tos-mr-140', parentId: 'tos-stage-launch-iteration', order: 0, taskName: '16.3.0.140', planStartDate: '2026-05-16', planEndDate: '2026-06-15' },
  { id: 'tos-stage-maintenance', stableId: 'tos-stage-maintenance', parentId: null, order: 1, taskName: '维护阶段' },
  { id: 'tos-mr-145', stableId: 'tos-mr-145', parentId: 'tos-stage-maintenance', order: 0, taskName: '16.3.0.145', planStartDate: '2026-06-16', planEndDate: '2026-07-15' },
  { id: 'tos-mr-150', stableId: 'tos-mr-150', parentId: 'tos-stage-maintenance', order: 1, taskName: '16.3.0.150', planStartDate: '2026-07-16', planEndDate: '' },
]

export interface MrAcceptancePlanScopeSeed {
  publishedSnapshots: Record<string, Array<Record<string, unknown>>>
  marketVersionsByKey: Record<string, Array<{ id: string; versionNo: string; status: string }>>
  tosTypeVersionsByKey: Record<string, Array<{ id: string; versionNo: string; status: string }>>
}

/** Project-scoped L1 snapshots that make the MR acceptance story eligible. */
export function createMrAcceptancePlanScopeSeed(): MrAcceptancePlanScopeSeed {
  const machineVersionId = 'mr-acceptance-machine-v1'
  const tosVersionId = 'mr-acceptance-tos-v1'
  return {
    publishedSnapshots: {
      [`project::1::OP::level1::${machineVersionId}`]: machineSnapshot(),
      [`project::3::OP::level1::${machineVersionId}`]: machineSnapshot(),
      [`project::19::tos-type::Full::level1::${tosVersionId}::snapshot`]: tosSnapshot(),
    },
    marketVersionsByKey: {
      'project::1::OP::level1::versions': publishedVersion(machineVersionId),
      'project::3::OP::level1::versions': publishedVersion(machineVersionId),
    },
    tosTypeVersionsByKey: {
      'project::19::tos-type::Full::level1::versions': publishedVersion(tosVersionId),
    },
  }
}
