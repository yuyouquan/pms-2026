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
import {
  buildMachineLevel1Tasks,
  buildTosLevel1Tasks,
  type Level1PlanTask,
} from '@/lib/level1PlanRules'

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

const publishedVersions = (latestId: string) => [
  { id: `${latestId}-history-v1`, versionNo: 'V1', status: '已发布' },
  { id: `${latestId}-history-v2`, versionNo: 'V2', status: '已发布' },
  { id: latestId, versionNo: 'V3', status: '已发布' },
]
const MR_ACCEPTANCE_FIXED_MILESTONE_DATES: Readonly<Record<string, string>> = {
  'machine-ms-concept-kickoff': '2026-02-01',
  'machine-ms-str1': '2026-02-15',
  'machine-ms-str2': '2026-03-01',
  'machine-ms-str3': '2026-03-15',
  'machine-ms-str4': '2026-04-01',
  'machine-ms-str4a': '2026-05-01',
  'machine-ms-str5': '2026-05-15',
  'tos-ms-concept-kickoff': '2026-02-01',
  'tos-ms-str1': '2026-02-15',
  'tos-ms-str2': '2026-03-01',
  'tos-ms-str3': '2026-03-15',
  'tos-ms-str4': '2026-04-01',
  'tos-ms-str4a': '2026-05-01',
  'tos-ms-str5': '2026-05-15',
}

const shiftAcceptanceDate = (date: string, days: number) => {
  if (!date || days === 0) return date
  const shifted = new Date(`${date}T00:00:00.000Z`)
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return shifted.toISOString().slice(0, 10)
}

const withAcceptanceMilestoneDates = (tasks: Level1PlanTask[], dayOffset = 0): Level1PlanTask[] => tasks.map(task => {
  const completionDate = MR_ACCEPTANCE_FIXED_MILESTONE_DATES[task.stableId!]
  return completionDate
    ? {
        ...task,
        responsible: '',
        planEndDate: shiftAcceptanceDate(completionDate, dayOffset),
        actualEndDate: shiftAcceptanceDate(completionDate, dayOffset),
      }
    : { ...task, responsible: '' }
})

const machineSnapshot = (dayOffset = 0): Level1PlanTask[] => (
  withAcceptanceMilestoneDates(buildMachineLevel1Tasks(false), dayOffset)
)

const tosSnapshot = (dayOffset = 0): Level1PlanTask[] => {
  const tasks = withAcceptanceMilestoneDates(buildTosLevel1Tasks(false), dayOffset)
  const launchStage = tasks.find(task => task.stableId === 'tos-stage-launch-iteration')!
  const maintenanceStage = tasks.find(task => task.stableId === 'tos-stage-maintenance')!
  const businessNode = (
    id: string,
    parent: Level1PlanTask,
    order: number,
    taskName: string,
    planStartDate: string,
    planEndDate: string,
  ): Level1PlanTask => ({
    id,
    stableId: id,
    parentId: parent.id,
    order,
    taskName,
    source: 'custom',
    nodeKind: 'business-period',
    predecessor: '',
    planStartDate: shiftAcceptanceDate(planStartDate, dayOffset),
    planEndDate: shiftAcceptanceDate(planEndDate, dayOffset),
    estimatedDays: null,
    actualStartDate: '',
    actualEndDate: '',
    actualDays: null,
    status: '未开始',
    progress: 0,
  })
  return [
    ...tasks,
    businessNode('tos-mr-140', launchStage, 0, '16.3.0.140', '2026-05-16', '2026-06-15'),
    businessNode('tos-mr-145', maintenanceStage, 0, '16.3.0.145', '2026-06-16', '2026-07-15'),
    businessNode('tos-mr-150', maintenanceStage, 1, '16.3.0.150', '2026-07-16', ''),
  ]
}

export interface MrAcceptancePlanScopeSeed {
  publishedSnapshots: Record<string, Level1PlanTask[]>
  marketVersionsByKey: Record<string, Array<{ id: string; versionNo: string; status: string }>>
  tosTypeVersionsByKey: Record<string, Array<{ id: string; versionNo: string; status: string }>>
}

/** Project-scoped L1 snapshots that make the MR acceptance story eligible. */
export function createMrAcceptancePlanScopeSeed(): MrAcceptancePlanScopeSeed {
  const machineVersionId = 'mr-acceptance-machine-v1'
  const tosVersionId = 'mr-acceptance-tos-v1'
  const machineVersions = publishedVersions(machineVersionId)
  const tosVersions = publishedVersions(tosVersionId)
  const versionOffset = (versionNo: string) => ({ V1: -14, V2: -7, V3: 0 }[versionNo] || 0)
  const publishedSnapshots: Record<string, Level1PlanTask[]> = {}
  for (const projectId of ['1', '3']) {
    for (const version of machineVersions) {
      publishedSnapshots[`project::${projectId}::OP::level1::${version.id}`] = machineSnapshot(versionOffset(version.versionNo))
    }
  }
  for (const version of tosVersions) {
    publishedSnapshots[`project::19::tos-type::Full::level1::${version.id}::snapshot`] = tosSnapshot(versionOffset(version.versionNo))
  }
  return {
    publishedSnapshots,
    marketVersionsByKey: {
      'project::1::OP::level1::versions': machineVersions.map(version => ({ ...version })),
      'project::3::OP::level1::versions': machineVersions.map(version => ({ ...version })),
    },
    tosTypeVersionsByKey: {
      'project::19::tos-type::Full::level1::versions': tosVersions.map(version => ({ ...version })),
    },
  }
}
