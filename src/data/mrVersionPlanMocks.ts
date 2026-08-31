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
import { applyStopRelease } from '@/lib/mrAggregationRules'

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

export const MR_MOCK_SCENARIOS = Object.freeze({
  tos: Object.freeze(['normal', 'boundary-valid', 'before-plan-start', 'after-plan-end'] as const),
  joint: Object.freeze(['normal-type-1', 'normal-type-2-plus', 'same-type-mismatch', 'one-week-gap', 'tos-baseline', 'mp-deadline', 'next-version-boundary'] as const),
  market: Object.freeze(['normal-follow', 'later-than-main', 'missing-main-boundary'] as const),
  na: Object.freeze(['slash-dates', 'date-write-disabled'] as const),
  stopped: Object.freeze(['history-visible', 'future-rows-removed'] as const),
})

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
  '16.3.0.135': {
    'mr-node-change-collection': '2026-04-17',
    'mr-node-change-lock': '2026-04-18',
    'mr-node-mp-intake-start': '2026-04-19',
    'mr-node-mp-intake-deadline': '2026-04-20',
    'mr-node-version-transfer': '2026-04-22',
    'mr-node-test-start': '2026-04-23',
    'mr-node-test-complete': '2026-05-01',
    'mr-node-review': '2026-05-03',
    'mr-node-archive': '2026-05-05',
    'mr-node-ota-deploy': '2026-05-14',
  },
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
    'mr-node-change-collection': '2026-06-15',
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
  '16.3.0.150': {
    'mr-node-change-collection': '2026-07-16',
    'mr-node-change-lock': '2026-07-18',
    'mr-node-mp-intake-start': '2026-07-19',
    'mr-node-mp-intake-deadline': '2026-07-20',
    'mr-node-version-transfer': '2026-07-22',
    'mr-node-test-start': '2026-07-23',
    'mr-node-test-complete': '2026-08-01',
    'mr-node-review': '2026-08-03',
    'mr-node-archive': '2026-08-05',
    'mr-node-ota-deploy': '2026-08-16',
  },
  '16.3.0.155': {
    'mr-node-change-collection': '2026-08-16',
    'mr-node-change-lock': '2026-08-18',
    'mr-node-mp-intake-start': '2026-08-19',
    'mr-node-mp-intake-deadline': '2026-08-20',
    'mr-node-version-transfer': '2026-08-22',
    'mr-node-test-start': '2026-08-23',
    'mr-node-test-complete': '2026-09-01',
    'mr-node-review': '2026-09-03',
    'mr-node-archive': '2026-09-05',
    'mr-node-ota-deploy': '2026-09-15',
  },
  '16.3.0.160': {
    'mr-node-change-collection': '2026-09-16',
    'mr-node-change-lock': '2026-09-18',
    'mr-node-mp-intake-start': '2026-09-19',
    'mr-node-mp-intake-deadline': '2026-09-20',
    'mr-node-version-transfer': '2026-09-22',
    'mr-node-test-start': '2026-09-23',
    'mr-node-test-complete': '2026-10-01',
    'mr-node-review': '2026-10-03',
    'mr-node-archive': '2026-10-05',
    'mr-node-ota-deploy': '2026-10-15',
  },
}

const MR_ACCEPTANCE_TOS_VERSIONS = Object.freeze([
  '16.3.0.135',
  '16.3.0.140',
  '16.3.0.145',
  '16.3.0.150',
  '16.3.0.155',
  '16.3.0.160',
] as const)

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
  tosVersion: string,
  transferType: JointMachinePlan['transferType'],
  dates: Readonly<Record<string, string>>,
  actor: string,
): JointMachinePlan {
  return {
    projectId,
    tosProjectId: '19',
    tosVersion,
    transferType,
    dates: cloneDates(dates),
    updatedBy: actor,
    updatedAt: MR_ACCEPTANCE_CREATED_AT,
  }
}

function withoutDate(dates: Readonly<Record<string, string>>, activityId: string): Record<string, string> {
  return Object.fromEntries(Object.entries(dates).filter(([id]) => id !== activityId))
}

function shiftDates(dates: Readonly<Record<string, string>>, days: number): Record<string, string> {
  return Object.fromEntries(Object.entries(dates).map(([activityId, value]) => {
    const date = new Date(`${value}T00:00:00.000Z`)
    date.setUTCDate(date.getUTCDate() + days)
    return [activityId, date.toISOString().slice(0, 10)]
  }))
}

function createMarketOverride(
  projectId: string,
  tosVersion: string,
  market: string,
  dates: Readonly<Record<string, string>>,
): MrMarketOverride {
  return { projectId, tosVersion, market, mainMarket: 'OP', dates: cloneDates(dates) }
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
  const tosInstances = MR_ACCEPTANCE_TOS_VERSIONS.map(createTosInstance)
  const mismatchedTypeTwoA = createMachinePlan('1', '16.3.0.140', '2', {
    ...withoutDate(MR_ACCEPTANCE_DATES['16.3.0.140'], 'mr-node-archive'),
    'mr-node-version-transfer': '2026-05-29',
  }, '王五')
  const mismatchedTypeTwoB = createMachinePlan('3', '16.3.0.140', '2', {
    ...MR_ACCEPTANCE_DATES['16.3.0.140'],
    'mr-node-mp-intake-deadline': '2026-05-25',
    'mr-node-version-transfer': '2026-05-30',
  }, '赵六')
  const cleanTypeOne = createMachinePlan('1', '16.3.0.145', '1', MR_ACCEPTANCE_DATES['16.3.0.145'], '王五')
  const shortGapAndNextBoundary = createMachinePlan('3', '16.3.0.145', '2', {
    ...MR_ACCEPTANCE_DATES['16.3.0.145'],
    'mr-node-version-transfer': '2026-06-28',
    'mr-node-test-start': '2026-07-24',
    'mr-node-test-complete': '2026-07-08',
    'mr-node-review': '2026-07-10',
    'mr-node-archive': '2026-07-12',
    'mr-node-ota-deploy': '2026-07-22',
  }, '赵六')
  const nextCleanTypeOne = createMachinePlan('1', '16.3.0.150', '1', MR_ACCEPTANCE_DATES['16.3.0.150'], '王五')
  const cleanTypeTwo = createMachinePlan('3', '16.3.0.150', '2', {
    ...MR_ACCEPTANCE_DATES['16.3.0.150'],
    'mr-node-version-transfer': '2026-07-29',
    'mr-node-test-start': '2026-07-30',
    'mr-node-test-complete': '2026-08-08',
    'mr-node-review': '2026-08-10',
    'mr-node-archive': '2026-08-12',
    'mr-node-ota-deploy': '2026-08-23',
  }, '赵六')

  const rawPlans = [
    createMachinePlan('14', '16.3.0.135', '1', MR_ACCEPTANCE_DATES['16.3.0.135'], '周敏'),
    createMachinePlan('15', '16.3.0.135', '2', shiftDates(MR_ACCEPTANCE_DATES['16.3.0.135'], 7), '陈晨'),
    createMachinePlan('16', '16.3.0.135', 'N/A', {}, '李白'),
    mismatchedTypeTwoA,
    mismatchedTypeTwoB,
    createMachinePlan('7', '16.3.0.140', '1', MR_ACCEPTANCE_DATES['16.3.0.140'], '王五'),
    createMachinePlan('14', '16.3.0.140', '3', shiftDates(MR_ACCEPTANCE_DATES['16.3.0.140'], 14), '周敏'),
    createMachinePlan('15', '16.3.0.140', 'N/A', {}, '陈晨'),
    createMachinePlan('16', '16.3.0.140', '1', MR_ACCEPTANCE_DATES['16.3.0.140'], '李白'),
    cleanTypeOne,
    shortGapAndNextBoundary,
    createMachinePlan('7', '16.3.0.145', '3', shiftDates(MR_ACCEPTANCE_DATES['16.3.0.145'], 14), '王五'),
    createMachinePlan('12', '16.3.0.145', '1', MR_ACCEPTANCE_DATES['16.3.0.145'], '孙悦'),
    createMachinePlan('15', '16.3.0.145', '2', shiftDates(MR_ACCEPTANCE_DATES['16.3.0.145'], 7), '陈晨'),
    createMachinePlan('17', '16.3.0.145', 'N/A', {}, '李白'),
    nextCleanTypeOne,
    cleanTypeTwo,
    createMachinePlan('12', '16.3.0.150', '3', shiftDates(MR_ACCEPTANCE_DATES['16.3.0.150'], 14), '孙悦'),
    createMachinePlan('13', '16.3.0.150', '1', MR_ACCEPTANCE_DATES['16.3.0.150'], '吴迪'),
    createMachinePlan('16', '16.3.0.150', '2', shiftDates(MR_ACCEPTANCE_DATES['16.3.0.150'], 7), '李白'),
    createMachinePlan('17', '16.3.0.150', '3', shiftDates(MR_ACCEPTANCE_DATES['16.3.0.150'], 14), '李白'),
    createMachinePlan('1', '16.3.0.155', '1', MR_ACCEPTANCE_DATES['16.3.0.155'], '王五'),
    createMachinePlan('3', '16.3.0.155', '2', shiftDates(MR_ACCEPTANCE_DATES['16.3.0.155'], 7), '赵六'),
    createMachinePlan('13', '16.3.0.155', '3', shiftDates(MR_ACCEPTANCE_DATES['16.3.0.155'], 14), '吴迪'),
    createMachinePlan('15', '16.3.0.155', '4', shiftDates(MR_ACCEPTANCE_DATES['16.3.0.155'], 21), '陈晨'),
    createMachinePlan('18', '16.3.0.155', 'N/A', {}, '赵六'),
    createMachinePlan('1', '16.3.0.160', '1', MR_ACCEPTANCE_DATES['16.3.0.160'], '王五'),
    createMachinePlan('3', '16.3.0.160', '2', shiftDates(MR_ACCEPTANCE_DATES['16.3.0.160'], 7), '赵六'),
    // These four future rows prove that the same production stop rule removes forbidden releases.
    createMachinePlan('7', '16.3.0.150', '1', MR_ACCEPTANCE_DATES['16.3.0.150'], '王五'),
    createMachinePlan('12', '16.3.0.155', '1', MR_ACCEPTANCE_DATES['16.3.0.155'], '孙悦'),
    createMachinePlan('13', '16.3.0.160', '1', MR_ACCEPTANCE_DATES['16.3.0.160'], '吴迪'),
    createMachinePlan('14', '16.3.0.145', '1', MR_ACCEPTANCE_DATES['16.3.0.145'], '周敏'),
  ]
  const stopReleaseFixtures: MrStopReleaseRecord[] = [
    { id: 'mr-stop-7', projectId: '7', projectName: 'X6890-D8500_H1001', stopDate: '2026-06-30', operator: '张三', operatedAt: '2026-08-29T09:10:00.000Z' },
    { id: 'mr-stop-12', projectId: '12', projectName: 'CN5C-D8400_H992', stopDate: '2026-07-31', operator: '张三', operatedAt: '2026-08-29T09:20:00.000Z' },
    { id: 'mr-stop-13', projectId: '13', projectName: 'CN5M-D8400_H993', stopDate: '2026-08-31', operator: '吴迪', operatedAt: '2026-08-29T09:30:00.000Z' },
    { id: 'mr-stop-14', projectId: '14', projectName: 'CN6_H902', stopDate: '2026-05-31', operator: '周敏', operatedAt: '2026-08-29T09:40:00.000Z' },
  ]
  const rawPlansByKey = Object.fromEntries(rawPlans.map(plan => [`${plan.projectId}::${plan.tosVersion}`, plan]))
  const stoppedState = stopReleaseFixtures.reduce((state, record) => applyStopRelease({
    persistedPlans: state.persistedPlans,
    tosInstances,
    stopRecords: state.stopRecords,
    record,
  }), { persistedPlans: rawPlansByKey, stopRecords: [] as MrStopReleaseRecord[], removedPlanKeys: [] as string[] })
  return {
    templateVersions,
    currentTemplateVersionId: templateVersions[0].id,
    templateHistory: [],
    tosInstancesByProjectId: { '19': tosInstances },
    machinePlansByKey: stoppedState.persistedPlans,
    marketOverridesByKey: {
      '1::16.3.0.140::TR': createMarketOverride('1', '16.3.0.140', 'TR', {
        'mr-node-test-start': '2026-05-23',
        'mr-node-archive': '2026-06-12',
      }),
      '1::16.3.0.140::RU': createMarketOverride('1', '16.3.0.140', 'RU', {
        'mr-node-review': '2026-06-04',
      }),
      '1::16.3.0.145::TR': createMarketOverride('1', '16.3.0.145', 'TR', {
        'mr-node-test-complete': '2026-07-01',
      }),
      '1::16.3.0.145::RU': createMarketOverride('1', '16.3.0.145', 'RU', {
        'mr-node-test-complete': '2026-06-30',
      }),
    },
    stopReleaseRecords: stoppedState.stopRecords,
    viewModeByScope: {},
  }
}

const publishedVersions = () => [
  { id: 'v1', versionNo: 'V1', status: '已发布' },
  { id: 'v2', versionNo: 'V2', status: '已发布' },
  { id: 'v3', versionNo: 'V3', status: '已发布' },
]
const MR_ACCEPTANCE_FIXED_MILESTONE_DATES: Readonly<Record<string, string>> = {
  'machine-ms-concept-kickoff': '2026-01-15',
  'machine-ms-str1': '2026-02-15',
  'machine-ms-str2': '2026-03-01',
  'machine-ms-str3': '2026-03-15',
  'machine-ms-str4': '2026-04-01',
  'machine-ms-str4a': '2026-05-01',
  'machine-ms-str5': '2026-05-15',
  'tos-ms-concept-kickoff': '2026-01-15',
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
    businessNode('tos-mr-135', launchStage, 0, '16.3.0.135', '2026-04-16', '2026-05-15'),
    businessNode('tos-mr-140', launchStage, 1, '16.3.0.140', '2026-05-16', '2026-06-15'),
    businessNode('tos-mr-145', maintenanceStage, 0, '16.3.0.145', '2026-06-16', '2026-07-15'),
    businessNode('tos-mr-150', maintenanceStage, 1, '16.3.0.150', '2026-07-16', '2026-08-15'),
    businessNode('tos-mr-155', maintenanceStage, 2, '16.3.0.155', '2026-08-16', '2026-09-15'),
    businessNode('tos-mr-160', maintenanceStage, 3, '16.3.0.160', '2026-09-16', ''),
  ]
}

export interface MrAcceptancePlanScopeSeed {
  publishedSnapshots: Record<string, Level1PlanTask[]>
  marketVersionsByKey: Record<string, Array<{ id: string; versionNo: string; status: string }>>
  tosTypeVersionsByKey: Record<string, Array<{ id: string; versionNo: string; status: string }>>
}

/** Project-scoped L1 snapshots that make the MR acceptance story eligible. */
export function createMrAcceptancePlanScopeSeed(): MrAcceptancePlanScopeSeed {
  const machineVersions = publishedVersions()
  const tosVersions = publishedVersions()
  const versionOffset = (versionNo: string) => ({ V1: -14, V2: -7, V3: 0 }[versionNo] || 0)
  const publishedSnapshots: Record<string, Level1PlanTask[]> = {}
  for (const projectId of ['1', '3']) {
    for (const version of machineVersions.filter(candidate => candidate.status === '已发布')) {
      publishedSnapshots[`project::${projectId}::OP::level1::${version.id}`] = machineSnapshot(versionOffset(version.versionNo))
    }
  }
  for (const version of tosVersions.filter(candidate => candidate.status === '已发布')) {
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
