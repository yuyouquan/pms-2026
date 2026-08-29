import type { MrTemplateActivity, MrTemplateVersion } from '@/types/mrVersionPlan'

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

export const DEFAULT_MR_TEMPLATE_ACTIVITIES: MrTemplateActivity[] = Object.freeze(
  defaultMrTemplateActivities.map(activity => Object.freeze(activity)),
) as unknown as MrTemplateActivity[]

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
